    // =====================================================================
    // THIẾT KẾ ĐÚNG: "Tổng tiền đã đóng lãi" (totalPaid) LUÔN LUÔN bất biến — đây là NGUỒN SỰ THẬT
    // DUY NHẤT. Nhưng việc "Quý nào được coi là đã đóng lãi xong" thì KHÔNG dựa vào việc quý đó có
    // từng được "đánh dấu" (payments{}) hay không — bộ nhớ payments{} CHỈ có tác dụng nhất thời ngay
    // lúc vừa lập xong 1 biên lai (để "gọi tên" đúng quý đó lên trước), sau đó coi như hết nhiệm vụ.
    // Mỗi lần tính toán, hệ thống LUÔN tính lại HOÀN TOÀN MỚI: lấy totalPaid làm ngân sách, rồi phân
    // bổ tuần tự cho TẤT CẢ các hộp theo đúng thứ tự thời gian cũ -> mới (kể cả hộp quá khứ, hiện tại
    // lẫn tương lai) — hộp nào ngân sách còn đủ trả (theo đúng số tiền lãi HIỆN TẠI của hộp đó) thì
    // coi là đã đóng xong; ngay khi ngân sách không đủ nữa thì DỪNG HẲN, mọi hộp còn lại (dù mới hơn
    // hay từng được đánh dấu đóng trước đây) đều là CHƯA đóng. Nhờ vậy, mọi quý luôn có thể "văng ra"
    // hoặc "quay trở lại" đã đóng lãi hoàn toàn linh hoạt theo đúng tiền gốc/lãi suất hiện hành, không
    // hề bị kẹt lại vì 1 lỗ hổng nào đó từng bị bỏ sót lúc lập biên lai trước đây.
    let budget = totalPaid;
    const paidEntries = [];
    for(const box of allBoxes){
      if(box.interestAmount<=0) continue; // hộp 0 đồng (nếu có) -> bỏ qua, không tính vào bên nào cả
      if(budget >= box.interestAmount - 0.001){
        paidEntries.push({ key:box.key, box, amount:box.interestAmount });
        budget = Math.round((budget - box.interestAmount)*100)/100;
      } else {
        break; // hết ngân sách -> dừng hẳn, mọi hộp còn lại (kể cả tương lai) đều là CHƯA đóng
      }
    }
    const paidSum = paidEntries.reduce((s,e)=>s+e.amount, 0);
    const leftover = Math.max(0, Math.round((totalPaid - paidSum)*100)/100);
    return { totalPaid, payments, paidEntries, paidSum, leftover, allBoxes };
  }
  // "Dàn xếp" số tiền thừa: nếu số dư (leftover) đủ trả trọn 1 hay nhiều "hộp chứa Quý" đang CHƯA có
  // khoản trả riêng, thì tự động gán trọn số tiền quý đó vào payments — ƯU TIÊN các Quý "từ QUÁ KHỨ
  // tới HIỆN TẠI" trước (quý cũ nhất trước), CHỈ khi không còn Quý nào thuộc nhóm đó nữa thì mới xét
  // tới các Quý "trong TƯƠNG LAI" (cũng ưu tiên tương lai gần nhất trước). Chạy khi vừa xác nhận
  // thêm 1 khoản đóng lãi mới.
  // =====================================================================
  // "LỊCH SỬ TRẠNG THÁI CÁC QUÝ" — nhật ký ghi lại mỗi khi 1 Quý chuyển từ "đã đóng lãi" sang "chưa
  // đóng lãi" hoặc ngược lại. CHỈ GHI (write-only), dựa vào so sánh 2 lần ĐỌC (computeInterestPayment-
  // BoxDisplay) trước và sau 1 hành động — TUYỆT ĐỐI KHÔNG đụng vào bất kỳ hàm TÍNH TOÁN nào.
  // =====================================================================
  // Ghi log khi ai đó TẠO MỚI hoặc SỬA (tên/màu) 1 tên phân loại biên lai — dùng cho Kho dòng nhật ký.
  async function pushCategoryChangeLog(kind, action, entry){
    const device = await getClientDeviceInfo();
    const logEntry = { id:uid(), kind, action, ...entry, at:new Date().toISOString(),
      createdByName: state.identity.name, createdBy: state.identity.email, createdByIp: device.ip, createdByDevice: device.userAgent };
    await cPush('categoryChangeLog', logEntry);
  }
  async function pushQuarterStatusLog(b, box, direction, reason, overrideAt, estimated){
    const entry = { id:uid(), key:box.key, qk:box.qk, year:box.year, label:formatTimelineQuarterLabel(box), direction, reason, at: overrideAt||new Date().toISOString() };
    if(estimated) entry.estimated = true;
    await cPush('quarterStatusLog/'+b.id, entry);
  }
  // So sánh paidKeys TRƯỚC và SAU 1 hành động, tự động ghi log cho từng Quý bị thay đổi trạng thái.
  async function logQuarterStatusDiff(b, beforeDisp, afterDisp, reasonPaid, reasonUnpaid){
    const boxByKey = {};
    beforeDisp.allBoxes.forEach(bx=> boxByKey[bx.key]=bx);
    afterDisp.allBoxes.forEach(bx=> boxByKey[bx.key]=bx);
    for(const key of afterDisp.paidKeys){
      if(!beforeDisp.paidKeys.has(key)){ const bx=boxByKey[key]; if(bx) await pushQuarterStatusLog(b, bx, 'paid', reasonPaid); }
    }
    for(const key of beforeDisp.paidKeys){
      if(!afterDisp.paidKeys.has(key)){ const bx=boxByKey[key]; if(bx) await pushQuarterStatusLog(b, bx, 'unpaid', reasonUnpaid); }
    }
  }
  async function settleInterestPaymentLeftover(b){
    const st = computeInterestPaymentBoxState(b);
    let leftover = st.leftover;
    if(leftover<=0) return;
    const payments = Object.assign({}, st.payments);
    const today = new Date(); today.setHours(0,0,0,0);
    const pastCurrent = st.allBoxes.filter(bx=>{
      const f = new Date(bx.from+'T00:00:00');
      return !isNaN(f.getTime()) && f<=today && bx.interestAmount>0;
    });
    const future = st.allBoxes.filter(bx=>{
      const f = new Date(bx.from+'T00:00:00');
      return !isNaN(f.getTime()) && f>today && bx.interestAmount>0;
    });
    let changed = false;
    for(const bx of pastCurrent){
      if(payments[bx.key]) continue;
      if(leftover >= bx.interestAmount){ payments[bx.key] = bx.interestAmount; leftover = Math.round((leftover-bx.interestAmount)*100)/100; changed = true; }
    }
    const stillHasPastCurrentUnpaid = pastCurrent.some(bx=> !payments[bx.key]);
    if(!stillHasPastCurrentUnpaid){
      // Quý TƯƠNG LAI bắt buộc theo đúng thứ tự gần->xa — hễ gặp 1 quý không đủ tiền trả là DỪNG
      // HẲN, không được nhảy cóc qua trả cho quý xa hơn nó.
      for(const bx of future){
        if(payments[bx.key]) continue;
        if(leftover >= bx.interestAmount){ payments[bx.key] = bx.interestAmount; leftover = Math.round((leftover-bx.interestAmount)*100)/100; changed = true; }
        else break;
      }
    }
    if(changed) await cSet('interestPaymentBoxes/'+b.id, { totalPaid: st.totalPaid, payments });
  }
  // Toàn bộ thông tin hiển thị của Hộp tiền (đúng cấu trúc bạn mô tả) — quý đã đóng (mới->cũ), tổng,
  // số dư thừa, quý chưa đóng TỪ QUÁ KHỨ TỚI HIỆN TẠI (cũ->mới), quý chưa đóng TRONG TƯƠNG LAI
  // (gần->xa), tổng từng loại.
  // Trích xuất "phần tiền LÃI" (Y) bên trong tổng số tiền (X) của 1 biên lai — dùng cho tính năng
  // "Xem các Biên lai đã tác động vào Tiền đã đóng lãi". Biên lai thu lãi/trả lại tiền lãi thì TOÀN BỘ
  // số tiền là tiền lãi (Y=X). Biên lai tất toán/trả nợ trước hạn (và các biến thể trả lại/qua đường
  // link) thì đọc đúng trường extra.interestIncluded đã lưu sẵn lúc lập biên lai.
  function extractInterestPortion(r){
    if(['interest_quarter','interest_money','interest_money_riskdebt','refund_quarter','refund_money'].includes(r.categoryKey)) return r.amount||0;
    return (r.extra && r.extra.interestIncluded) || 0;
  }
  function interestImpactReceiptRowHtml(r, interestPortion, isShared){
    const sign = r.sign==='-' ? '-' : '+';
    const signColor = sign==='+' ? '#0d47a1' : '#b71c1c';
    const d = new Date(r.createdAt);
    const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    const titleHtml = isShared ? styleSharedReceiptTitle(r.title) : (RECEIPT_TITLE_HTML[r.categoryKey]||escapeHtml(r.displayTitle||''));
    const openAttr = isShared ? `data-shared-receipt-view="${r.id}"` : `data-receipt-view="${r.id}"`;
    const sameAsTotal = Math.round(interestPortion) === Math.round(r.amount||0);
    return `<div class="preview-allow" ${openAttr} style="border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:8px; cursor:pointer; background:#fff;">
      <div style="font-weight:700;">📋 ${titleHtml}</div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:4px; flex-wrap:wrap; gap:8px;">
        <span style="color:${signColor}; font-weight:800; text-decoration:underline;">${sign} ${moneySpaced(interestPortion)}${sameAsTotal? '' : ` (trong ${sign} ${moneySpaced(r.amount)})`}</span>
        <span class="sub" style="margin-left:auto;">${dateLbl}</span>
      </div>
    </div>`;
  }
  function computeInterestPaymentBoxDisplay(b){
    const st = computeInterestPaymentBoxState(b);
    const allBoxes = st.allBoxes;
    const indexOf = {}; allBoxes.forEach((bx,i)=> indexOf[bx.key]=i);
    const paidSorted = st.paidEntries.slice().sort((a,c)=> indexOf[c.key]-indexOf[a.key]); // mới trước, cũ sau
    const paidLines = paidSorted.map(e=> ({ name: formatTimelineQuarterLabel(e.box), amount: e.amount, box:e.box }));
    const today = new Date(); today.setHours(0,0,0,0);
    const paidKeys = new Set(st.paidEntries.map(e=>e.key));
    const unpaidBoxes = allBoxes.filter(bx=>{
      const f = new Date(bx.from+'T00:00:00');
      return !isNaN(f.getTime()) && f<=today && !paidKeys.has(bx.key);
    }); // đã theo đúng thứ tự cũ->mới (allBoxes vốn đã là chuỗi thời gian)
    const unpaidLines = unpaidBoxes.map(bx=> ({ name: formatTimelineQuarterLabel(bx), amount: bx.interestAmount, box:bx }));
    const unpaidTotal = unpaidLines.reduce((s,x)=>s+x.amount, 0);
    const futureUnpaidBoxes = allBoxes.filter(bx=>{
      const f = new Date(bx.from+'T00:00:00');
      return !isNaN(f.getTime()) && f>today && !paidKeys.has(bx.key);
    }); // gần->xa (allBoxes vốn đã là chuỗi thời gian)
    const futureUnpaidLines = futureUnpaidBoxes.map(bx=> ({ name: formatTimelineQuarterLabel(bx), amount: bx.interestAmount, box:bx }));
    const futureUnpaidTotal = futureUnpaidLines.reduce((s,x)=>s+x.amount, 0);
    return { totalPaid: st.totalPaid, paidLines, paidTotal: st.paidSum, leftover: st.leftover, unpaidLines, unpaidTotal, futureUnpaidLines, futureUnpaidTotal, allBoxes, paidKeys };
  }
  // "Tiền lãi chưa đóng (tính đến NGÀY hiện tại)" — y hệt disp.unpaidLines/unpaidTotal (tính đến hết
  // Quý hiện tại), NHƯNG riêng Quý đang chứa hôm nay thì chỉ tính đúng số ngày từ đầu Quý đó tới hôm
  // nay (không tính hết cả Quý). Dùng cho cột mới và Biên lai tất toán/trả nợ trước hạn.
  // Hộp chứa Quý ĐANG chứa đúng ngày hôm nay — dùng cho cột "Tiền lãi (Quý X hiện tại)" ở modal
  // "Tính tiền lãi và phê duyệt đóng lãi". Lấy nguyên hộp bất kể đã đóng/chưa đóng/thiếu ngày/trong
  // hạn hay gia hạn — không lọc gì cả.
  function borrowerCurrentQuarterBox(b){
    const today = todayStr();
    return borrowerQuarterBoxes(b).find(bx=> bx.from<=today && today<=bx.to) || null;
  }
  function borrowerUnpaidInterestUpToToday(b){
    const disp = computeInterestPaymentBoxDisplay(b);
    const today = todayStr();
    const principal = parseFloat(b.principal)||0;
    const lines = disp.unpaidLines.map(x=>{
      const bx = x.box;
      if(bx.to <= today) return { ...x }; // Quý đã kết thúc hẳn trước/đúng hôm nay -> tính đủ như cũ
      // Quý đang chứa hôm nay (bx.from <= today < bx.to) -> chỉ tính đúng số ngày đã trôi qua
      const partialDays = Math.max(0, daysBetween(bx.from, today));
      const cycleDays = annualCycleDaysForYear(bx.year, b.frozenQuarterConfig);
      const partialAmount = Math.round(principal * ((bx.rate||0)/100/cycleDays) * partialDays);
      return { name: x.name, amount: partialAmount, box: bx, partialDays, partialTo: today };
    });
    const total = lines.reduce((s,x)=>s+x.amount, 0);
    return { lines, total };
  }

  // =====================================================================
  // Tính toán "Biên lai thu tiền lãi" thật sự sẽ phân bổ Tổng số tiền vào đúng những Quý nào —
  // dùng CHUNG kết quả này cho cả (1) câu giải thích hiển thị và (2) logic ghi nhận thật khi bấm
  // "Xác nhận đóng lãi thành công", đảm bảo 2 nơi LUÔN khớp nhau tuyệt đối.
  //   • Nếu Tổng < Tổng các Quý đã chọn: trả lần lượt CÁC QUÝ ĐÃ CHỌN theo đúng thứ tự cũ->mới cho
  //     tới khi không đủ trả tiếp thì DỪNG — các Quý còn lại (kể cả sau đó) đều CHƯA được trả.
  //   • Nếu Tổng >= Tổng các Quý đã chọn: trả HẾT các Quý đã chọn, phần dư (nếu có) tiếp tục thử trả
  //     thêm cho các Quý KHÁC chưa đóng (không nằm trong danh sách đã chọn), theo đúng thứ tự quá
  //     khứ→hiện tại rồi mới tới tương lai, DỪNG ngay khi không đủ trả tiếp.
  // =====================================================================
  function computeReceiptSettlementPreview(b, chosen, grandTotal, disp){
    let remaining = grandTotal;
    const paidQuarters = [];
    for(const bx of chosen){
      if(remaining >= bx.interestAmount){ paidQuarters.push(bx); remaining = Math.round((remaining-bx.interestAmount)*100)/100; }
      else break;
    }
    const unpaidChosenQuarters = chosen.filter(bx=> !paidQuarters.includes(bx));
    let extraPaidQuarters = [];
    if(unpaidChosenQuarters.length===0 && remaining>0){
      const chosenKeys = new Set(chosen.map(x=>x.key));
      const candidates = disp.unpaidLines.map(x=>x.box).concat(disp.futureUnpaidLines.map(x=>x.box)).filter(bx=> !chosenKeys.has(bx.key));
      for(const bx of candidates){
        if(remaining >= bx.interestAmount){ extraPaidQuarters.push(bx); remaining = Math.round((remaining-bx.interestAmount)*100)/100; }
        else break;
      }
    }
    return { paidQuarters, extraPaidQuarters, unpaidChosenQuarters, leftoverAmount: Math.max(0, remaining) };
  }
  // Khung "Người đóng tiền" / "Người thu tiền" — dùng CHUNG cho cả "biên lai theo cách tính quý" và
  // "biên lai theo cách tính tiền". Mặc định: người đóng = tên hộ vay, người thu = tên người đang
  // đăng nhập — cả 2 đều cho sửa tự do, tối đa 30 ký tự, bắt buộc phải có chữ mới cho xác nhận.
  function receiptPayerFieldsHtml(b){
    return `
      <div class="field" style="margin-top:14px;"><label>Người đóng tiền</label><input id="rcpt-payer" maxlength="30" class="preview-allow" value="${escapeHtml(b.name||'')}"></div>
      <div class="field"><label>Người thu tiền</label><input id="rcpt-collector" maxlength="30" class="preview-allow" value="${escapeHtml((state.identity&&state.identity.name)||'')}"></div>`;
  }
  // Biến thể dùng cho "Biên lai trả lại tiền lãi đã đóng" — người NHẬN lại tiền là hộ vay, người
  // TRẢ lại tiền là người đang thao tác (thường là cán bộ Hội).
  // Khung "Người trả nợ" / "Người nhận tiền" — dùng cho Biên lai tất toán/trả nợ trước hạn.
  function settlementPayerFieldsHtml(b, idPrefix){
    return `
      <div class="field" style="margin-top:14px;"><label>Người trả nợ</label><input id="${idPrefix}-payer" maxlength="30" class="preview-allow" value="${escapeHtml(b.name||'')}"></div>
      <div class="field"><label>Người nhận tiền</label><input id="${idPrefix}-collector" maxlength="30" class="preview-allow" value="${escapeHtml((state.identity&&state.identity.name)||'')}"></div>`;
  }
  // Đánh dấu 1 người vay đã TẤT TOÁN / TRẢ NỢ TRƯỚC HẠN — khoá "đến hạn" tại đúng ngày lập biên lai
  // (đóng băng lịch sử, không sinh thêm hộp chứa Quý tương lai nữa), chuyển hẳn sang danh sách riêng.
  // Đánh dấu 1 người vay là "Nợ rủi ro" — vẫn là khoản vay ĐANG HOẠT ĐỘNG (không đóng băng hộp chứa
  // Quý như Tất toán/Trả nợ trước hạn), chỉ đơn thuần tách sang danh sách riêng để dễ quản lý.
  async function markBorrowerRiskDebt(b, reason, date, keepInterest){
    const updated = { ...b, riskDebt:true, riskDebtReason:reason, riskDebtDate:date, riskDebtConfirmedAt:new Date().toISOString(),
      riskDebtKeepInterest: !!keepInterest };
    if(!keepInterest){
      // Tái sử dụng đúng cơ chế frozenAsOf đã có (dùng cho Tất toán/Trả nợ trước hạn) để khoá mọi hộp
      // chứa Quý bắt đầu SAU "Ngày xác nhận được nêu trong hồ sơ thực tế" (date) — KHÔNG phải ngày
      // lập giấy xác nhận trên hệ thống (riskDebtConfirmedAt) — vì đó mới là ngày thực tế xã/phường
      // xác nhận hộ này là Nợ rủi ro. Người này vẫn ĐANG HOẠT ĐỘNG bình thường (không phải settled).
      updated.frozenAsOf = date;
      updated.frozenQuarterConfig = JSON.parse(JSON.stringify((state.config&&state.config.quarters)||DEFAULT_QUARTERS));
    }
    await cSetRecord('borrowers', b.id, updated);
    const idx = state.borrowers.findIndex(x=>x.id===b.id);
    if(idx>=0) state.borrowers[idx] = updated;
    return updated;
  }
  // Khôi phục 1 hộ vay đã bị xác nhận Nợ rủi ro về đúng trạng thái ban đầu do phê duyệt nhầm — xoá
  // sạch mọi dấu vết Nợ rủi ro (kể cả frozenAsOf nếu có, để hộp chứa Quý tự hiện lại đầy đủ).
  async function restoreBorrowerFromRiskDebt(b){
    const updated = { ...b };
    delete updated.riskDebt; delete updated.riskDebtReason; delete updated.riskDebtDate;
    delete updated.riskDebtConfirmedAt; delete updated.riskDebtKeepInterest;
    delete updated.frozenAsOf; delete updated.frozenQuarterConfig;
    await cSetRecord('borrowers', b.id, updated);
    const idx = state.borrowers.findIndex(x=>x.id===b.id);
    if(idx>=0) state.borrowers[idx] = updated;
    return updated;
  }
  // "Không thể tất toán khoản vay" — vẫn là Nợ rủi ro (riskDebt=true), chỉ thêm cờ phụ badDebt=true
  // để chuyển sang danh sách "Khoản vay Không có khả năng trả nợ".
  async function markBorrowerBadDebt(b, reason, noInterestToo){
    const updated = { ...b, badDebt:true, badDebtReason:reason, badDebtDate:todayStr(), badDebtConfirmedAt:new Date().toISOString(),
      badDebtNoInterestToo: !!noInterestToo };
    await cSetRecord('borrowers', b.id, updated);
    const idx = state.borrowers.findIndex(x=>x.id===b.id);
    if(idx>=0) state.borrowers[idx] = updated;
    return updated;
  }
  // "Khôi phục lại trạng thái trước đó do phê duyệt nhầm" — chỉ xoá cờ badDebt, quay về đúng trạng
  // thái "Đang xử lý Nợ rủi ro" (KHÔNG đụng gì tới riskDebt/frozenAsOf).
  async function restoreBorrowerFromBadDebt(b){
    const updated = { ...b };
    delete updated.badDebt; delete updated.badDebtReason; delete updated.badDebtDate; delete updated.badDebtConfirmedAt; delete updated.badDebtNoInterestToo;
    await cSetRecord('borrowers', b.id, updated);
    const idx = state.borrowers.findIndex(x=>x.id===b.id);
    if(idx>=0) state.borrowers[idx] = updated;
    return updated;
  }
  async function markBorrowerSettled(b, settledType, extra){
    // frozenAsOf = ngày "đóng băng" — mọi hộp chứa Quý bắt đầu SAU ngày này sẽ tự động biến mất
    // (xem borrowerQuarterBoxes). KHÔNG đổi b.dueDate — giữ nguyên lịch sử thật của khoản vay.
    // frozenQuarterConfig = "ảnh chụp" đúng mốc 4 Quý xã đang dùng NGAY thời điểm tất toán — để nếu
    // sau này xã đổi mốc Quý mới thì người đã tất toán KHÔNG bị tính lại theo mốc mới.
    const updated = { ...b, settled:true, settledType, settledAt:new Date().toISOString(), frozenAsOf: todayStr(),
      frozenQuarterConfig: JSON.parse(JSON.stringify((state.config&&state.config.quarters)||DEFAULT_QUARTERS)), ...extra };
    await cSetRecord('borrowers', b.id, updated);
    const idx = state.borrowers.findIndex(x=>x.id===b.id);
    if(idx>=0) state.borrowers[idx] = updated;
    return updated;
  }
  // Ghi nhận CÁC QUÝ được trả tiền lãi (tính đến Quý hiện tại hoặc tính đến Ngày hiện tại) vào Hộp
  // tiền đóng lãi khi tất toán/trả nợ trước hạn có bổ sung thêm tiền lãi chưa đóng.
  async function settleInterestForClosure(b, upToToday){
    const info = upToToday ? borrowerUnpaidInterestUpToToday(b) : { lines: computeInterestPaymentBoxDisplay(b).unpaidLines, total: computeInterestPaymentBoxDisplay(b).unpaidTotal };
    if(info.total<=0) return info;
    const raw = getInterestPaymentBoxRaw(b.id);
    const payments = Object.assign({}, raw.payments||{});
    info.lines.forEach(x=>{ payments[x.box.key] = x.amount; });
    const newTotalPaid = (raw.totalPaid||0) + info.total;
    await cSet('interestPaymentBoxes/'+b.id, { totalPaid: newTotalPaid, payments });
    state.interestPaymentBoxes = state.interestPaymentBoxes||{};
    state.interestPaymentBoxes[b.id] = { totalPaid:newTotalPaid, payments };
    return info;
  }
  // Khối "Thông tin nâng cao" riêng cho Biên lai tất toán/trả nợ trước hạn — liệt kê rõ từng Quý
  // được tính tiền lãi trong đợt này (kèm ngày bắt đầu/kết thúc, có ghi rõ nếu Quý bị "ngắt quãng"
  // tính tới đúng ngày hôm nay), và thông tin BẮT BUỘC của người thừa kế (nếu có).
  function settlementAdvancedInfoHtml(b, interestInfo, upToToday, heir, idPrefix, forceOpen, frozenSnapshot){
    const proj = projectOf(b);
    const lines = [];
    if(frozenSnapshot){
      lines.push(`Địa chỉ: ${frozenSnapshot.hamlet||''}`);
      lines.push(`Phương án vay: ${frozenSnapshot.projName||''}`);
      lines.push(`Số tiền vay gốc: ${moneySpaced(frozenSnapshot.principal)}`);
      lines.push(`Ngày vay: ${fmtDate(frozenSnapshot.loanDate)}`);
      lines.push(`Lãi suất: ${frozenSnapshot.rate||''}%/năm`);
      if(frozenSnapshot.interestLines && frozenSnapshot.interestLines.length){
        lines.push(`— Các Quý được tính tiền lãi trong đợt này (${frozenSnapshot.upToToday? 'tính đến NGÀY hiện tại':'tính đến hết QUÝ hiện tại'}):`);
        frozenSnapshot.interestLines.forEach(x=> lines.push(`${x.label}: từ ngày ${fmtDate(x.from)} đến ngày ${fmtDate(x.to)} — số tiền ${moneySpaced(x.amount)}${x.noteBroken||''}`));
      }
      let heirLineStartIdx = -1;
      if(frozenSnapshot.heir){
        heirLineStartIdx = lines.length;
        lines.push(`— Thông tin người thừa kế (bắt buộc):`);
        lines.push(`Họ và tên: ${(heir&&heir.name) || frozenSnapshot.heir.name || ''}`); // CHỈ dòng này vẫn cập nhật theo thời gian thực
        lines.push(`Số tiền vay kế thừa: ${moneySpaced(frozenSnapshot.heir.principal)}`);
        lines.push(`Ngày bắt đầu kế thừa: ${fmtDate(frozenSnapshot.heir.loanDate)}`);
        lines.push(`Ngày đến hạn: ${fmtDate(frozenSnapshot.heir.dueDate)}`);
        lines.push(`Địa bàn dân cư: ${frozenSnapshot.heir.hamlet||''}`);
      }
      return `
        <div style="text-align:center; margin-top:14px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" id="${idPrefix}-adv-toggle">Thông tin nâng cao</button></div>
        <div id="${idPrefix}-adv-info" style="display:${forceOpen?'block':'none'}; margin-top:8px;">${lines.map((l,li)=>`<p class="sub${heirLineStartIdx>=0&&li>=heirLineStartIdx?' heir-info-block':''}" style="margin:0 0 6px;">${escapeHtml(l)}</p>`).join('')}</div>`;
    }
    lines.push(`Địa chỉ: ${b.hamlet||''}`);
    lines.push(`Phương án vay: ${proj? proj.name : ''}`);
    lines.push(`Số tiền vay gốc: ${moneySpaced(b.principal)}`);
    lines.push(`Ngày vay: ${fmtDate(b.loanDate)}`);
    lines.push(`Lãi suất: ${String(parseFloat(b.rate)||0).replace('.',',')}%/năm`);
    if(interestInfo && interestInfo.lines && interestInfo.lines.length){
      lines.push(`— Các Quý được tính tiền lãi trong đợt này (${upToToday? 'tính đến NGÀY hiện tại':'tính đến hết QUÝ hiện tại'}):`);
      interestInfo.lines.forEach(x=>{
        const bx = x.box;
        const toShow = (upToToday && x.partialTo) ? x.partialTo : bx.to;
        const noteBroken = (upToToday && x.partialTo && x.partialTo!==bx.to) ? ` (Quý này bị NGẮT QUÃNG tại đúng ngày hôm nay, chưa hết trọn Quý)` : '';
        lines.push(`${formatTimelineQuarterLabel(bx)}: từ ngày ${fmtDate(bx.from)} đến ngày ${fmtDate(toShow)} — số tiền ${moneySpaced(x.amount)}${noteBroken}`);
      });
    }
    let heirLineStartIdx2 = -1;
    if(heir){
      heirLineStartIdx2 = lines.length;
      lines.push(`— Thông tin người thừa kế (bắt buộc):`);
      lines.push(`Họ và tên: ${heir.name||''}`);
      lines.push(`Số tiền vay kế thừa: ${moneySpaced(heir.principal)}`);
      lines.push(`Ngày bắt đầu kế thừa: ${fmtDate(heir.loanDate)}`);
      lines.push(`Ngày đến hạn: ${fmtDate(heir.dueDate)}`);
      lines.push(`Địa bàn dân cư: ${heir.hamlet||''}`);
    }
    return `
      <div style="text-align:center; margin-top:14px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" id="${idPrefix}-adv-toggle">Thông tin nâng cao</button></div>
      <div id="${idPrefix}-adv-info" style="display:${forceOpen?'block':'none'}; margin-top:8px;">${lines.map((l,li)=>`<p class="sub${heirLineStartIdx2>=0&&li>=heirLineStartIdx2?' heir-info-block':''}" style="margin:0 0 6px;">${escapeHtml(l)}</p>`).join('')}</div>`;
  }
  // Xây dựng "ảnh chụp đóng băng" thông tin nâng cao NGAY thời điểm tất toán/trả nợ trước hạn — để dù
  // sau này Phương án vay hay hồ sơ người thừa kế có bị sửa thì "Xem lịch sử..." vẫn hiện ĐÚNG như lúc
  // lập biên lai (CHỈ riêng "Họ và tên" người thừa kế vẫn cập nhật theo thời gian thực).
  function buildSettlementSnapshot(b, interestInfo, upToToday, heir){
    const proj = projectOf(b);
    return {
      hamlet: b.hamlet||'', projName: proj? proj.name : '', principal: b.principal, loanDate: b.loanDate,
      rate: String(parseFloat(b.rate)||0).replace('.',','), upToToday,
      interestLines: (interestInfo && interestInfo.lines) ? interestInfo.lines.map(x=>{
        const bx = x.box;
        const toShow = (upToToday && x.partialTo) ? x.partialTo : bx.to;
        const noteBroken = (upToToday && x.partialTo && x.partialTo!==bx.to) ? ` (Quý này bị NGẮT QUÃNG tại đúng ngày hôm nay, chưa hết trọn Quý)` : '';
        return { label: formatTimelineQuarterLabel(bx), from: bx.from, to: toShow, amount: x.amount, noteBroken };
      }) : [],
      heir: heir ? { name: heir.name||'', principal: heir.principal, loanDate: heir.loanDate, dueDate: heir.dueDate, hamlet: heir.hamlet||'' } : null,
    };
  }

  function receiptPayerFieldsHtmlRefund(b){
    return `
      <div class="field" style="margin-top:14px;"><label>Người trả lại tiền</label><input id="rcpt-refund-payer" maxlength="30" class="preview-allow" value="${escapeHtml((state.identity&&state.identity.name)||'')}"></div>
      <div class="field"><label>Người nhận lại tiền</label><input id="rcpt-refund-collector" maxlength="30" class="preview-allow" value="${escapeHtml(b.name||'')}"></div>
      <div class="field"><label>Lý do trả lại</label><textarea id="rcpt-refund-reason" maxlength="150" rows="2" class="preview-allow" placeholder="Nhập lý do trả lại tiền lãi (bắt buộc)..."></textarea></div>`;
  }

  // =====================================================================
  // "PHÂN LOẠI BIÊN LAI" — 2 danh sách riêng (thu tiền lãi / trả tiền lãi), thuộc bộ nhớ chung của
  // mã định danh xã/phường. Dùng chung modal quản lý (thêm/sửa/xoá/chọn màu) cho cả 2 loại.
  // =====================================================================
  // =====================================================================
  // "NGƯỜI QUẢN LÝ HỘ VAY" — danh sách thuộc bộ nhớ chung của xã/phường. 2 mục đầu tiên (Chi hội
  // trưởng, Chi hội phó) luôn tồn tại mặc định, không sửa/xoá được; các mục thêm sau tự do sửa/xoá.
  // =====================================================================
  function ensureDefaultManagers(){
    const list = state.borrowerManagers || [];
    const truong = list.find(m=>m.id==='chihoitruong');
    const pho = list.find(m=>m.id==='chihoipho');
    const rest = list.filter(m=> m.id!=='chihoitruong' && m.id!=='chihoipho');
    return [
      truong || {id:'chihoitruong', name:'Chi hội trưởng', protected:true},
      pho || {id:'chihoipho', name:'Chi hội phó', protected:true},
      ...rest,
    ].map(m=> ({...m, protected: m.id==='chihoitruong'||m.id==='chihoipho'}));
  }
  function renderBorrowerManagerModal(onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let items = ensureDefaultManagers().map(x=>({...x}));

    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:480px;">
          <div class="modal-head"><h3>Người quản lý hộ vay đại diện cho Ấp hoặc Xã/Phường</h3><button class="modal-close" id="bmm-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 12px;">Đây là danh sách những người thuộc hệ thống chi hội Ấp (hoặc đại diện Xã/Phường) phụ trách quản lý các hộ vay. Việc thiết lập sẵn danh sách này giúp sau này dễ dàng tra cứu người quản lý của từng hộ, cũng như tự động tính đúng số tiền lãi được phân bổ về cho từng người quản lý.</p>
            ${items.map((it,i)=>`
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <button type="button" ${it.protected?'disabled':''} data-bmm-del="${i}" style="border:1px solid var(--line); border-radius:50%; width:24px; height:24px; color:#c00; background:#fff; cursor:pointer; ${it.protected?'opacity:.3; cursor:not-allowed;':''}">✕</button>
                <input data-bmm-name="${i}" maxlength="20" value="${escapeHtml(it.name)}" ${it.protected?'disabled':''} style="flex:1;">
              </div>`).join('')}
            <button class="btn btn-ghost btn-sm" id="bmm-add" ${items.length>=20?'disabled':''}>Thêm +</button>
            ${items.length>=20? `<p class="sub" style="color:var(--red);">Đã đạt tối đa 20 người quản lý.</p>` : ''}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="bmm-cancel">Quay lại không lưu</button>
            <button class="btn btn-primary" id="bmm-save">Lưu vào bộ nhớ chung</button>
          </div>
        </div>`;
      wire();
    }
    function wire(){
      wrap.querySelector('#bmm-close').onclick = close;
      wrap.querySelector('#bmm-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('[data-bmm-name]').forEach(inp=>{
        inp.oninput = ()=>{ items[parseInt(inp.dataset.bmmName,10)].name = inp.value; };
      });
      wrap.querySelectorAll('[data-bmm-del]').forEach(btn=>{
        if(btn.disabled) return;
        btn.onclick = ()=>{ items.splice(parseInt(btn.dataset.bmmDel,10),1); render(); };
      });
      const addBtn = wrap.querySelector('#bmm-add');
      if(addBtn) addBtn.onclick = ()=>{
        if(items.length>=20) return;
        if(items.length && !items[items.length-1].name.trim()){ alert('Vui lòng đặt tên cho người quản lý vừa thêm trước khi thêm tiếp.'); return; }
        items.push({id:uid(), name:''});
        render();
      };
      const saveBtn = wrap.querySelector('#bmm-save');
      if(saveBtn) saveBtn.onclick = async ()=>{
        const clean = items.filter(it=> it.protected || (it.name && it.name.trim()));
        const obj = {}; clean.forEach(it=> obj[it.id]={id:it.id,name:it.name});
        await cSet('borrowerManagers', obj);
        state.borrowerManagers = clean;
        window.__instantRemoveModal(wrap); // xoá NGAY LẬP TỨC — tránh trùng ID với modal cha sắp dựng lại ngay sau đây
        if(onSaved) onSaved();
      };
    }
    render();
  }

  // =====================================================================
  // "DANH SÁCH ĐỊA BÀN DÂN CƯ" — thay thế hẳn cơ chế nút "Khác" cũ. Thuộc bộ nhớ chung xã/phường
  // (chính là state.config.hamlets). Không cho lưu nếu còn ô nào để trống.
  // =====================================================================
  function renderHamletManagerModal(onSaved, localList){
    const isLocal = localList !== undefined;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    // "Khác" LUÔN đứng đầu mọi danh sách địa danh của MỌI xã/phường trên toàn hệ thống — không xoá
    // được, không sửa được, không tính vào giới hạn 100 địa danh.
    const rawItems = (isLocal ? localList : (state.config.hamlets||[])).filter(n=>n!=='Khác');
    let items = ['Khác', ...rawItems];

    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:480px;">
          <div class="modal-head"><h3>Danh sách địa bàn dân cư</h3><button class="modal-close" id="hmm-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 12px;">Đây là nơi lưu tên các địa bàn thôn, khu phố, ấp… của xã/phường. Không cần ghi kèm các từ như "ấp", "thôn", "khu phố", "xóm"… vào trước tên — chỉ cần nhập đúng tên riêng của từng địa bàn. Mục "Khác" luôn có sẵn, không xoá được, dùng khi hộ vay không thuộc địa bàn cụ thể nào.</p>
            ${items.map((name,i)=>{
              const protectedRow = (i===0); // "Khác"
              return `
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <button type="button" data-hmm-del="${i}" ${protectedRow?'disabled':''} style="border:1px solid var(--line); border-radius:50%; width:24px; height:24px; color:#c00; background:#fff; cursor:pointer; ${protectedRow?'opacity:.3; cursor:not-allowed;':''}">✕</button>
                <input data-hmm-name="${i}" maxlength="15" value="${escapeHtml(name)}" ${protectedRow?'disabled':''} style="flex:1; ${protectedRow?'opacity:.7;':''}">
              </div>`;
            }).join('')}
            <button class="btn btn-ghost btn-sm" id="hmm-add" ${items.length>=101?'disabled':''}>Thêm +</button>
            ${items.length>=101? `<p class="sub" style="color:var(--red);">Đã đạt tối đa 100 địa bàn dân cư.</p>` : ''}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="hmm-cancel">Đóng bảng quay lại</button>
            <button class="btn btn-primary" id="hmm-save">Lưu vào bộ nhớ chung</button>
          </div>
        </div>`;
      wire();
    }
    function wire(){
      wrap.querySelector('#hmm-close').onclick = close;
      wrap.querySelector('#hmm-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('[data-hmm-name]').forEach(inp=>{
        if(inp.disabled) return;
        inp.oninput = ()=>{ items[parseInt(inp.dataset.hmmName,10)] = inp.value; };
      });
      wrap.querySelectorAll('[data-hmm-del]').forEach(btn=>{
        if(btn.disabled) return;
        btn.onclick = ()=>{
          const idx = parseInt(btn.dataset.hmmDel,10);
          const name = items[idx];
          if(name && name.trim() && !confirm(`Xoá địa bàn "${name}"?`)) return;
          items.splice(idx,1); render();
        };
      });
      const addBtn = wrap.querySelector('#hmm-add');
      if(addBtn) addBtn.onclick = ()=>{
        if(items.length>=101) return;
        if(items.length && !items[items.length-1].trim()){ alert('Vui lòng nhập tên cho ô vừa thêm trước khi thêm ô mới.'); return; }
        items.push('');
        render();
      };
      const saveBtn = wrap.querySelector('#hmm-save');
      if(saveBtn) saveBtn.onclick = async ()=>{
        if(items.some(n=> !n || !n.trim())){ alert('Không thể lưu khi còn ô địa bàn dân cư để trống — vui lòng điền đầy đủ hoặc xoá ô trống đó.'); return; }
        const clean = items.map(n=>n.trim());
        if(isLocal){
          window.__instantRemoveModal(wrap);
          if(onSaved) onSaved(clean);
          return;
        }
        // Tự động đồng bộ "Địa chỉ trước sáp nhập": mỗi địa danh MỚI vừa được thêm (chưa từng có
        // trước đó) sẽ tự có thêm 1 mục "Tên (cũ)" tương ứng.
        const oldHamlets = new Set(state.config.hamlets||[]);
        const newlyAdded = clean.filter(h=> h!=='Khác' && !oldHamlets.has(h));
        const legacy = (state.config.hamletsLegacyHidden||[]).slice();
        newlyAdded.forEach(h=>{ const full = `${h} (cũ)`; if(!legacy.includes(full)) legacy.push(full); });
        const newCfg = {...state.config, hamlets: clean, hamletsLegacyHidden: legacy};
        await cSet('config', newCfg);
        state.config = newCfg;
        // Dùng xoá NGAY LẬP TỨC (không hiệu ứng trễ) — vì onSaved() thường dựng lại modal cha NGAY sau
        // đây; nếu để hiệu ứng đóng trễ như bình thường, modal quản lý này vẫn còn tồn tại trong DOM
        // một lúc, có thể trùng ID với phần tử trong modal cha mới dựng, gây nhầm lẫn khi khôi phục dữ
        // liệu form đang gõ dở (lỗi thật đã xảy ra, nay chặn dứt điểm ngay tại nguồn).
        window.__instantRemoveModal(wrap);
        if(onSaved) onSaved();
      };
    }
    render();
  }

  // =====================================================================
  // "DANH SÁCH NGUỒN VAY" — 4 nguồn cố định (Trung ương/Tỉnh-thành phố/Nguồn 841/Nguồn địa phương) hiện
  // CHỈ ĐỂ XEM, không sửa/xoá được — phía dưới cho phép thêm/sửa/xoá các nguồn vay TUỲ CHỈNH (thay thế
  // hẳn cho khái niệm "Nguồn khác" + trường "Tên nguồn vay khác" cũ, đã trở nên thừa thãi).
  // =====================================================================
  function renderFundSourceManagerModal(onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let items = (state.config.customFundSources||[]).slice();

    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:480px;">
          <div class="modal-head"><h3>Danh sách Nguồn vay</h3><button class="modal-close" id="fsm-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 12px;">4 nguồn vay cố định bên dưới luôn có sẵn cho mọi xã/phường, không sửa/xoá được. Nếu nguồn vay của địa phương đồng chí không nằm trong 4 nguồn này, hãy thêm vào danh sách "Nguồn vay tuỳ chỉnh" phía dưới.</p>
            <div class="divider-lbl">4 nguồn vay cố định (chỉ xem)</div>
            ${FUND_SOURCE_OPTIONS.filter(o=>o!=='Nguồn khác').map(name=>`
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <input value="${escapeHtml(name)}" disabled style="flex:1; opacity:.7;">
              </div>`).join('')}
            <div class="divider-lbl" style="margin-top:14px;">Nguồn vay tuỳ chỉnh (của riêng địa phương đồng chí)</div>
            ${items.map((name,i)=>`
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <button type="button" data-fsm-del="${i}" style="border:1px solid var(--line); border-radius:50%; width:24px; height:24px; color:#c00; background:#fff; cursor:pointer;">✕</button>
                <input data-fsm-name="${i}" maxlength="20" value="${escapeHtml(name)}" style="flex:1;">
              </div>`).join('')}
            <button class="btn btn-ghost btn-sm" id="fsm-add" ${items.length>=30?'disabled':''}>Thêm +</button>
            ${items.length>=30? `<p class="sub" style="color:var(--red);">Đã đạt tối đa 30 nguồn vay tuỳ chỉnh.</p>` : ''}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="fsm-cancel">Đóng bảng quay lại</button>
            <button class="btn btn-primary" id="fsm-save">Lưu vào bộ nhớ chung</button>
          </div>
        </div>`;
      wire();
    }
    function wire(){
      wrap.querySelector('#fsm-close').onclick = close;
      wrap.querySelector('#fsm-cancel').onclick = close;
      wrap.querySelectorAll('[data-fsm-name]').forEach(inp=>{
        inp.oninput = ()=>{ items[parseInt(inp.dataset.fsmName,10)] = inp.value; };
      });
      wrap.querySelectorAll('[data-fsm-del]').forEach(btn=>{
        btn.onclick = ()=>{
          const idx = parseInt(btn.dataset.fsmDel,10);
          const name = items[idx];
          if(name && name.trim() && !confirm(`Xoá nguồn vay tuỳ chỉnh "${name}"?`)) return;
          items.splice(idx,1); render();
        };
      });
      const addBtn = wrap.querySelector('#fsm-add');
      if(addBtn) addBtn.onclick = ()=>{
        if(items.length>=30) return;
        if(items.length && !items[items.length-1].trim()){ alert('Vui lòng nhập tên cho ô vừa thêm trước khi thêm ô mới.'); return; }
        items.push('');
        render();
      };
      const saveBtn = wrap.querySelector('#fsm-save');
      if(saveBtn) saveBtn.onclick = async ()=>{
        if(items.some(n=> !n || !n.trim())){ alert('Không thể lưu khi còn ô nguồn vay để trống — vui lòng điền đầy đủ hoặc xoá ô trống đó.'); return; }
        const clean = items.map(n=>n.trim());
        const newCfg = {...state.config, customFundSources: clean};
        await cSet('config', newCfg);
        state.config = newCfg;
        // Dùng xoá NGAY LẬP TỨC (không hiệu ứng trễ) — vì onSaved() thường dựng lại modal cha NGAY sau
        // đây; nếu để hiệu ứng đóng trễ như bình thường, modal quản lý này vẫn còn tồn tại trong DOM
        // một lúc, có thể trùng ID với phần tử trong modal cha mới dựng, gây nhầm lẫn khi khôi phục dữ
        // liệu form đang gõ dở (lỗi thật đã xảy ra ở các modal quản lý khác trước đây, nay chặn ngay từ
        // đầu cho modal này).
        window.__instantRemoveModal(wrap);
        if(onSaved) onSaved(clean);
      };
    }
    render();
  }
  // =====================================================================
  // "DANH SÁCH ĐỊA CHỈ TRƯỚC SÁP NHẬP" — thay thế nút "Khác..." cũ. Lưu ở state.config.hamletsLegacyHidden
  // (mỗi phần tử đã là chuỗi đầy đủ "Tên (cũ)"). Tự động gợi ý sẵn 1 mục cho MỖI địa bàn dân cư đang
  // có trong danh sách hiện hành (không trùng lặp), phần đuôi "(cũ)" luôn hiện cố định bên phải ô
  // nhập — không cho gõ trực tiếp vào chuỗi đó để tránh lỗi định dạng.
  // =====================================================================
  function renderLegacyAddressManagerModal(onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const SUFFIX = ' (cũ)';
    let items = (state.config.hamletsLegacyHidden||[]).map(full=> full.endsWith(SUFFIX) ? full.slice(0,-SUFFIX.length) : full);
    // Tự động bổ sung 1 mục cho mỗi địa bàn dân cư hiện hành, nếu chưa có sẵn.
    (state.config.hamlets||[]).forEach(h=>{ if(!items.includes(h)) items.push(h); });

    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:520px;">
          <div class="modal-head"><h3>Danh sách địa chỉ trước sáp nhập</h3><button class="modal-close" id="lam-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 12px;">Đây là các địa bàn dân cư CŨ, trước khi sáp nhập vào địa bàn dân cư hiện hành. Chỉ cần nhập đúng tên khu dân cư cũ — hệ thống sẽ tự động thêm chữ "(cũ)" vào cuối, đồng chí không cần gõ thêm.</p>
            ${items.map((name,i)=>`
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <button type="button" data-lam-del="${i}" style="border:1px solid var(--line); border-radius:50%; width:24px; height:24px; color:#c00; background:#fff; cursor:pointer;">✕</button>
                <input data-lam-name="${i}" maxlength="15" value="${escapeHtml(name)}" style="flex:1;">
                <span class="sub" style="white-space:nowrap;">(cũ)</span>
              </div>`).join('')}
            <button class="btn btn-ghost btn-sm" id="lam-add" ${items.length>=150?'disabled':''}>Thêm +</button>
            ${items.length>=150? `<p class="sub" style="color:var(--red);">Đã đạt tối đa 150 địa chỉ trước sáp nhập.</p>` : ''}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="lam-cancel">Đóng bảng quay lại</button>
            <button class="btn btn-primary" id="lam-save">Lưu vào bộ nhớ chung</button>
          </div>
        </div>`;
      wire();
    }
    function wire(){
      wrap.querySelector('#lam-close').onclick = close;
      wrap.querySelector('#lam-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('[data-lam-name]').forEach(inp=>{
        inp.oninput = ()=>{ items[parseInt(inp.dataset.lamName,10)] = inp.value; };
      });
      wrap.querySelectorAll('[data-lam-del]').forEach(btn=>{
        btn.onclick = ()=>{
          const idx = parseInt(btn.dataset.lamDel,10);
          const name = items[idx];
          if(name && name.trim() && !confirm(`Xoá địa chỉ "${name}${SUFFIX}"?`)) return;
          items.splice(idx,1); render();
        };
      });
      const addBtn = wrap.querySelector('#lam-add');
      if(addBtn) addBtn.onclick = ()=>{
        if(items.length>=150) return;
        if(items.length && !items[items.length-1].trim()){ alert('Vui lòng nhập tên cho ô vừa thêm trước khi thêm ô mới.'); return; }
        items.push('');
        render();
      };
      const saveBtn = wrap.querySelector('#lam-save');
      if(saveBtn) saveBtn.onclick = async ()=>{
        if(items.some(n=> !n || !n.trim())){ alert('Không thể lưu khi còn ô địa chỉ để trống — vui lòng điền đầy đủ hoặc xoá ô trống đó.'); return; }
        const clean = [...new Set(items.map(n=> n.trim()+SUFFIX))];
        const newCfg = {...state.config, hamletsLegacyHidden: clean};
        await cSet('config', newCfg);
        state.config = newCfg;
        // Dùng xoá NGAY LẬP TỨC (không hiệu ứng trễ) — vì onSaved() thường dựng lại modal cha NGAY sau
        // đây; nếu để hiệu ứng đóng trễ như bình thường, modal quản lý này vẫn còn tồn tại trong DOM
        // một lúc, có thể trùng ID với phần tử trong modal cha mới dựng, gây nhầm lẫn khi khôi phục dữ
        // liệu form đang gõ dở (lỗi thật đã xảy ra, nay chặn dứt điểm ngay tại nguồn).
        window.__instantRemoveModal(wrap);
        if(onSaved) onSaved();
      };
    }
    render();
  }

  // Bảng thông tin 1 mã định danh (tên xã/tỉnh, mã, mật khẩu ẩn/hiện khi giữ nút mắt, nút tham gia)
  // — dùng chung cho cả danh sách mã ở tab Cài đặt lẫn ở "Ví mã định danh" đầy đủ.
  async function renderWardInfoModal(wid, allowEdit){
    if(allowEdit===undefined) allowEdit = true;
    let cfgW = await cGetOnceFor(wid, 'config', null);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let pw = (cfgW && cfgW.accessCode) || '';
    let editingPw = false;
    let editingName = false;
    function render(){
      const isCurrent = wid === wardId();
      const isRealOwner = !!(cfgW && state.identity && state.identity.email && cfgW.ownerEmail===state.identity.email);
      const isMineOwner = allowEdit && isRealOwner;
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:420px;">
          <div class="modal-head"><h3>Thông tin mã định danh</h3><button class="modal-close" id="wim-close">✕</button></div>
          <div class="modal-body">
            <div class="kv-row"><span>Tên xã/phường</span><b>${escapeHtml((cfgW&&cfgW.wardName)||'')}</b></div>
            <div class="kv-row"><span>Tên tỉnh/thành phố</span><b>${escapeHtml((cfgW&&cfgW.provinceName)||'')}</b></div>
            <div class="field" style="margin-top:10px;">
              <label>Mã định danh</label>
              <div style="border:1px solid var(--line); border-radius:8px; padding:8px 12px; background:var(--white);">
                ${editingName? `<input id="wim-name" value="${escapeHtml(wid)}" style="width:100%; box-sizing:border-box;">` : `<b class="mono">${escapeHtml(wid)}</b>`}
              </div>
              ${isMineOwner? (editingName?
                `<button type="button" class="btn btn-primary btn-sm" id="wim-name-save" style="margin-top:6px;">Lưu</button>`
                : `<button type="button" class="btn btn-ghost btn-sm" id="wim-name-edit" style="margin-top:6px;">✏️ Sửa tên mã</button>`) : ''}
            </div>
            <div class="field" style="margin-top:10px;">
              <label>Mật khẩu của mã định danh</label>
              <div style="display:flex; align-items:center; gap:8px;">
                ${editingPw?
                  `<input id="wim-pw" value="${escapeHtml(pw)}" style="flex:1;"><button type="button" class="btn btn-primary btn-sm" id="wim-pw-save">Lưu</button>`
                  : `<input id="wim-pw" value="${pw? '•'.repeat(pw.length) : 'Không có'}" disabled style="flex:1;">
                     ${pw? `<button type="button" id="wim-eye" title="Giữ để xem" style="border:1px solid var(--line); border-radius:8px; width:36px; height:36px; background:#fff; cursor:pointer;">👁️</button>` : ''}`}
              </div>
              ${isMineOwner && !editingPw? `<button type="button" class="btn btn-ghost btn-sm" id="wim-pw-edit" style="margin-top:6px;">🔑 Đổi mật khẩu</button>` : ''}
              ${isRealOwner && !allowEdit? `<p class="sub" style="margin-top:6px;">Để thay đổi tên mã và mật khẩu, vui lòng chọn "Quản lý mã định danh".</p>` : ''}
            </div>
            <div class="field" style="margin-top:10px;">
              <label>Mã ẩn cố định bên trong là: <span class="mono">${escapeHtml((cfgW&&cfgW.secretId)||'')}</span></label>
              <p class="sub" style="margin:4px 0 0;">Đồng chí có thể không cần quan tâm đến mã ẩn bên trong này, đây chỉ là định danh cố định vĩnh viễn của tên mã định danh phía trên.</p>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="wim-close2">Đóng bảng</button>
            ${!isCurrent? `<button class="btn" style="background:#0d3b78; color:#fff;" id="wim-join">Tham gia bằng mã này</button>` : ''}
          </div>
        </div>`;
      wrap.querySelector('#wim-close').onclick = close;
      wrap.querySelector('#wim-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const eyeBtn = wrap.querySelector('#wim-eye');
      const pwInput = wrap.querySelector('#wim-pw');
      if(eyeBtn){
        const show = (e)=>{ e.preventDefault(); pwInput.value = pw; };
        const hide = ()=>{ pwInput.value = '•'.repeat(pw.length); };
        eyeBtn.addEventListener('mousedown', show);
        eyeBtn.addEventListener('touchstart', show, {passive:false});
        eyeBtn.addEventListener('mouseup', hide);
        eyeBtn.addEventListener('mouseleave', hide);
        eyeBtn.addEventListener('touchend', hide);
      }
      const nameEditBtn = wrap.querySelector('#wim-name-edit');
      if(nameEditBtn) nameEditBtn.onclick = ()=>{ editingName = true; render(); };
      const nameSaveBtn = wrap.querySelector('#wim-name-save');
      if(nameSaveBtn) nameSaveBtn.onclick = async ()=>{
        const newVal = wrap.querySelector('#wim-name').value;
        if(!newVal.trim()){ alert('Tên mã định danh không được để trống.'); return; }
        // renameWardGeneric() đã tự hỏi xác nhận kèm cảnh báo Khách bị văng ra khi đổi mã — không
        // cần hỏi thêm lần nữa ở đây.
        const result = await renameWardGeneric(wid, newVal, cfgW);
        if(!result) return; // người dùng huỷ xác nhận, hoặc lỗi -> giữ nguyên trạng thái đang sửa
        if(wardId()===result){ close(); return; } // vừa đổi tên đúng mã đang dùng -> app đã tự chuyển màn hình khác rồi
        wid = result; editingName = false;
        cfgW = await cGetOnceFor(wid, 'config', null);
        render();
      };
      const editBtn = wrap.querySelector('#wim-pw-edit');
      if(editBtn) editBtn.onclick = ()=>{ editingPw = true; render(); };
      const saveBtn = wrap.querySelector('#wim-pw-save');
      if(saveBtn) saveBtn.onclick = async ()=>{
        const newPass = wrap.querySelector('#wim-pw').value;
        if(!confirm('Đồng chí có chắc chắn muốn đổi mật khẩu mã định danh này? Các Khách đang dùng ké mã cũ sẽ bị yêu cầu nhập lại mật khẩu mới ngay lập tức.')) return;
        const newCfg = {...cfgW, accessCode: newPass||'', accessVersion: (cfgW.accessVersion||0)+1};
        await wrefFor(wid, 'config').set(newCfg);
        cfgW.accessCode = newCfg.accessCode; cfgW.accessVersion = newCfg.accessVersion;
        pw = newCfg.accessCode; editingPw = false;
        await pushLog('đổi mật khẩu mã xã', wid);
        alert('Đã cập nhật mật khẩu mã xã. Các Khách đã đăng nhập đang sài ké sẽ được yêu cầu nhập lại mật khẩu mới.');
        render();
      };
      const joinBtn = wrap.querySelector('#wim-join');
      if(joinBtn) joinBtn.onclick = ()=>{ close(); enterWard(wid); };
    }
    render();
  }

  function renderReceiptCategoryManagerModal(kind, onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const storageKey = kind==='payment' ? 'receiptCategoriesPayment' : 'receiptCategoriesRefund';
    const title = kind==='payment' ? 'Các tên phân loại biên lai thu tiền lãi' : 'Các tên phân loại biên lai trả tiền lãi';
    const descText = kind==='payment'
      ? `Biên lai là không thể xóa vĩnh viễn hoặc thay đổi thông tin bên trong, vì vậy phân loại biên lai giúp cho quản lý biên lai, tìm kiếm biên lai dễ dàng hơn, có thể tạo các tên phân loại biên lai như sau: chưa có tiền thực nhận, đã có tiền thực nhận, chờ đợi nhận tiền, ghi nhầm tên, "biên lai" thu nhầm, "biên lai" không còn tác dụng, .v.v… không cần ghi thêm chữ "biên lai" vào trong tên phân loại, sau này vẫn có thể thay đổi tên phân loại cho biên lai.`
      : `Biên lai là không thể xóa vĩnh viễn hoặc thay đổi thông tin bên trong, vì vậy phân loại biên lai giúp cho quản lý biên lai, tìm kiếm biên lai dễ dàng hơn, có thể tạo các tên phân loại biên lai như sau: chưa có tiền thực trả, đã có tiền thực trả, chờ đợi trả tiền, trả nhầm, ghi nhầm tên, "biên lai" thu nhầm, "biên lai" không còn tác dụng, .v.v… không cần ghi thêm chữ "biên lai" vào trong tên phân loại, sau này vẫn có thể thay đổi tên phân loại cho biên lai.`;
    let items = (kind==='payment' ? (state.receiptCategoriesPayment||[]) : (state.receiptCategoriesRefund||[])).map(x=>({...x}));
    const originalItems = items.map(x=>({...x})); // snapshot ban đầu để so sánh phát hiện thay đổi

    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:520px;">
          <div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="modal-close" id="rcm-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 12px;">${escapeHtml(descText)}</p>
            ${items.map((it,i)=>`
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <button type="button" style="border:1px solid var(--line); border-radius:50%; width:24px; height:24px; color:#c00; background:#fff; cursor:pointer;" data-rcm-del="${i}">✕</button>
                <input data-rcm-name="${i}" maxlength="20" value="${escapeHtml(it.name)}" style="flex:1;">
                <input type="color" data-rcm-color="${i}" value="${it.color||'#1976d2'}" style="width:32px; height:32px; padding:0; border:none; cursor:pointer;">
              </div>`).join('')}
            <button class="btn btn-ghost btn-sm" id="rcm-add" ${items.length>=20?'disabled':''}>Thêm +</button>
            ${items.length>=20? `<p class="sub" style="color:var(--red);">Đã đạt tối đa 20 tên phân loại.</p>` : ''}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="rcm-cancel">Đóng bảng (không lưu)</button>
            <button class="btn btn-primary" id="rcm-save">Lưu vào bộ nhớ chung</button>
          </div>
        </div>`;
      wire();
    }
    function wire(){
      wrap.querySelector('#rcm-close').onclick = close;
      wrap.querySelector('#rcm-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('[data-rcm-name]').forEach(inp=>{
        inp.oninput = ()=>{ items[parseInt(inp.dataset.rcmName,10)].name = inp.value; };
      });
      wrap.querySelectorAll('[data-rcm-color]').forEach(inp=>{
        inp.oninput = ()=>{ items[parseInt(inp.dataset.rcmColor,10)].color = inp.value; };
      });
      wrap.querySelectorAll('[data-rcm-del]').forEach(btn=>{
        btn.onclick = ()=>{
          const idx = parseInt(btn.dataset.rcmDel,10);
          const it = items[idx];
          if(!it.name || !it.name.trim()){ items.splice(idx,1); render(); return; }
          if(!confirm(`Xoá tên phân loại "${it.name}"?`)) return;
          items.splice(idx,1); render();
        };
      });
      const addBtn = wrap.querySelector('#rcm-add');
      if(addBtn) addBtn.onclick = ()=>{
        if(items.length>=20) return;
        if(items.length && !items[items.length-1].name.trim()){ alert('Vui lòng đặt tên cho ô vừa thêm trước khi thêm ô mới.'); return; }
        items.push({id:uid(), name:'', color:'#1976d2'});
        render();
      };
      const saveBtn = wrap.querySelector('#rcm-save');
      if(saveBtn) saveBtn.onclick = async ()=>{
        const clean = items.filter(it=>it.name && it.name.trim());
        const obj = {}; clean.forEach(it=> obj[it.id]=it);
        await cSet(storageKey, obj);
        const kindLabel = kind==='payment' ? 'Biên lai thu lãi' : 'Biên lai trả lãi';
        for(const it of clean){
          const before = originalItems.find(x=>x.id===it.id);
          if(!before){
            await pushCategoryChangeLog(kind, 'created', { name: it.name, color: it.color, kindLabel });
          } else if(before.name!==it.name && before.color!==it.color){
            await pushCategoryChangeLog(kind, 'edited_both', { name: it.name, oldName: before.name, color: it.color, oldColor: before.color, kindLabel });
          } else if(before.name!==it.name){
            await pushCategoryChangeLog(kind, 'renamed', { name: it.name, oldName: before.name, color: it.color, kindLabel });
          } else if(before.color!==it.color){
            await pushCategoryChangeLog(kind, 'recolored', { name: it.name, color: it.color, oldColor: before.color, kindLabel });
          }
        }
        if(kind==='payment') state.receiptCategoriesPayment = clean; else state.receiptCategoriesRefund = clean;
        close();
        if(onSaved) onSaved();
      };
    }
    render();
  }
  // Khối "Phân loại biên lai" (nhãn + nút i + dropdown) — dùng chung cho cả 4 loại biên lai.
  function receiptCategoryFieldHtml(kind, idPrefix, selectedId){
    const list = kind==='payment' ? (state.receiptCategoriesPayment||[]) : (state.receiptCategoriesRefund||[]);
    const current = list.find(c=>c.id===selectedId);
    const isOpen = state.openFilterDropdown === (idPrefix+'-cat');
    const swatch = (color)=> `<span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:${escapeHtml(color||'#999')}; border:1px solid rgba(0,0,0,.15);"></span>`;
    return `
      <div class="field" style="margin-top:14px;">
        <label style="display:flex; align-items:center; gap:4px;"><button type="button" class="qbox-info-btn" id="${idPrefix}-cat-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button> Phân loại biên lai</label>
        <div id="${idPrefix}-cat-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:4px 0;">Vì Biên lai không thể xóa vĩnh viễn hoặc thay đổi thông tin bên trong, nên việc phân loại biên lai giúp cho quản lý biên lai, tìm kiếm biên lai dễ dàng hơn. Sau này vẫn có thể thay đổi "tên phân loại" cho mỗi biên lai.</div>
        <div class="sv-filter-dropdown" style="width:100%;">
          <button type="button" class="btn btn-ghost btn-sm preview-allow" id="${idPrefix}-cat-btn" style="display:flex; align-items:center; justify-content:space-between; width:100%; box-sizing:border-box;">
            <span style="display:flex; align-items:center; gap:6px;">${current? swatch(current.color) : ''}${escapeHtml(current? current.name : 'Không phân loại')}</span>
            <span>▾</span>
          </button>
          ${isOpen? `<div class="sv-filter-panel" style="min-width:100%;">
            <label class="sv-filter-item" data-cat-pick="" style="display:flex; justify-content:space-between; cursor:pointer;"><span>Không phân loại</span></label>
            ${list.map(c=>`<label class="sv-filter-item" data-cat-pick="${c.id}" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;"><span>${escapeHtml(c.name)}</span>${swatch(c.color)}</label>`).join('')}
            <div class="sv-filter-divider"></div>
            <label class="sv-filter-item" data-cat-add="1" style="cursor:pointer; font-weight:700;"><span>+ Thêm tên phân loại mới...</span></label>
          </div>` : ''}
        </div>
      </div>`;
  }
  function wireReceiptCategoryField(wrap, kind, idPrefix, rerenderFn, onPick){
    const infoBtn = wrap.querySelector(`#${idPrefix}-cat-info`);
    const tip = wrap.querySelector(`#${idPrefix}-cat-tip`);
    if(infoBtn) infoBtn.onclick = (e)=>{ e.stopPropagation(); tip.style.display = tip.style.display==='none'?'block':'none'; };
    const btn = wrap.querySelector(`#${idPrefix}-cat-btn`);
    if(btn) btn.onclick = (e)=>{
      e.stopPropagation();
      state.openFilterDropdown = state.openFilterDropdown===(idPrefix+'-cat') ? null : (idPrefix+'-cat');
      if(rerenderFn) rerenderKeepingScrollAndInputs(wrap, '.modal-body', rerenderFn);
    };
    wrap.querySelectorAll('[data-cat-pick]').forEach(el=>{
      el.onclick = (e)=>{
        e.stopPropagation();
        state.openFilterDropdown = null;
        if(onPick) onPick(el.dataset.catPick);
        if(rerenderFn) rerenderKeepingScrollAndInputs(wrap, '.modal-body', rerenderFn);
      };
    });
    const addEl = wrap.querySelector('[data-cat-add]');
    if(addEl) addEl.onclick = (e)=>{
      e.stopPropagation();
      state.openFilterDropdown = null;
      const savedValues = {};
      wrap.querySelectorAll('input[id], select[id], textarea[id]').forEach(el=>{ savedValues[el.id] = el.value; });
      const savedModalBody = wrap.querySelector('.modal-body');
      const savedScroll = savedModalBody ? savedModalBody.scrollTop : null;
      renderReceiptCategoryManagerModal(kind, ()=>{
        // Tự động chọn phân loại CUỐI CÙNG trong danh sách (thường chính là phân loại vừa được thêm
        // mới) TRƯỚC khi vẽ lại — để màn hình phản ánh đúng lựa chọn mới ngay. Người dùng vẫn có thể tự
        // chọn lại phân loại khác tuỳ ý ngay sau đó.
        const list = kind==='payment' ? (state.receiptCategoriesPayment||[]) : (state.receiptCategoriesRefund||[]);
        if(list.length && onPick) onPick(list[list.length-1].id);
        if(rerenderFn) rerenderFn();
        requestAnimationFrame(()=>{
          Object.keys(savedValues).forEach(id=>{ const el = wrap.querySelector('#'+CSS.escape(id)); if(el) el.value = savedValues[id]; });
          const newModalBody = wrap.querySelector('.modal-body');
          if(newModalBody && savedScroll!=null) newModalBody.scrollTop = savedScroll;
          const newCatBtn = wrap.querySelector(`#${idPrefix}-cat-btn`);
          if(newCatBtn) newCatBtn.classList.add('field-border-flash');
        });
      });
    };
  }
  // Khối "Thông tin nâng cao" (đóng/mở, tự cuộn xuống khi mở) — dùng chung cho cả 4 loại biên lai.
  // quarterBoxesForLines = danh sách hộp chứa Quý sẽ được nêu tên trong đó (CHỈ những Quý thật sự
  // được tính là đóng/trả lãi xong trong biên lai này, không nêu Quý nào chưa chắc chắn).
  function advancedInfoHtml(b, quarterBoxesForLines, idPrefix, forceOpen, extraLines){
    const proj = projectOf(b);
    const hamletName = b.hamlet || '';
    const extList = getBorrowerExtensions(b.id);
    const fmtPct = n=> String(n).replace('.',',');
    const lines = [];
    lines.push(`Địa chỉ: ${hamletName}`);
    lines.push(`Phương án vay: ${proj? proj.name : ''}`);
    lines.push(`Nguồn vay: ${b.fundSource||''}`);
    lines.push(`Số tiền vay gốc ${moneySpaced(b.principal)}`);
    lines.push(`Ngày vay ${fmtDate(b.loanDate)}`);
    lines.push(`Ngày đến hạn ${fmtDate(b.dueDate)}`);
    extList.forEach((e,i)=> lines.push(`Ngày kết thúc gia hạn lần ${i+1} ${fmtDate(e.to)}`));
    lines.push(`Lãi suất: ${fmtPct(parseFloat(b.rate)||0)}%/năm`);
    extList.forEach((e,i)=> lines.push(`Lãi suất quá hạn lần ${i+1}: ${fmtPct(e.ratePct||0)}%/năm`));
    quarterBoxesForLines.forEach(bx=> lines.push(`${formatTimelineQuarterLabel(bx)} được bắt đầu từ ngày ${fmtDate(bx.from)} đến ngày ${fmtDate(bx.to)}`));
    if(extraLines) extraLines.forEach(l=> lines.push(l));
    return `
      <div style="text-align:center; margin-top:14px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" id="${idPrefix}-adv-toggle">Thông tin nâng cao</button></div>
      <div id="${idPrefix}-adv-info" style="display:${forceOpen?'block':'none'}; margin-top:8px;">${lines.map(l=>`<p class="sub" style="margin:0 0 6px;">${escapeHtml(l)}</p>`).join('')}</div>`;
  }
  function wireAdvancedInfo(wrap, idPrefix, onToggle){
    const toggleBtn = wrap.querySelector(`#${idPrefix}-adv-toggle`);
    const infoEl = wrap.querySelector(`#${idPrefix}-adv-info`);
    if(toggleBtn) toggleBtn.onclick = ()=>{
      const opening = infoEl.style.display==='none';
      infoEl.style.display = opening? 'block' : 'none';
      if(onToggle) onToggle(opening);
      if(opening){
        const body = wrap.querySelector('.modal-body');
        if(body) setTimeout(()=> body.scrollTo({ top: body.scrollHeight, behavior:'smooth' }), 50);
      }
    };
  }

  // "Biên lai theo cách tính tiền" — người dùng nhập tiền trước, hệ thống tự động xét xem số tiền
  // đó trả được cho những Quý nào (ưu tiên quá khứ->hiện tại trước, hết mới xét tới tương lai, đúng
  // thứ tự thời gian, dừng ngay khi không đủ trả tiếp — không nhảy cóc).
  function computeMoneyBasedSettlement(finalAmount, disp){
    let remaining = finalAmount;
    const paidQuarters = [];
    const candidates = disp.unpaidLines.map(x=>x.box).concat(disp.futureUnpaidLines.map(x=>x.box));
    for(const bx of candidates){
      if(remaining >= bx.interestAmount){ paidQuarters.push(bx); remaining = Math.round((remaining-bx.interestAmount)*100)/100; }
      else break;
    }
    return { paidQuarters, leftoverAmount: Math.max(0, remaining) };
  }
  function buildMoneyBasedExplanation(paidQuarters, leftoverAmount){
    if(!paidQuarters.length){
      return leftoverAmount>0 ? `Số tiền này chưa đủ để trả cho bất kỳ Quý nào, toàn bộ ${moneySpaced(leftoverAmount)} sẽ được cộng dồn vào Tổng số tiền đã đóng lãi của hộ vay, chờ khi đủ tiền sẽ tự động trả cho Quý.` : '';
    }
    const base = `Tổng tiền (Tiền thực nhận + Tiền dư từ đợt trước) sẽ trả đủ cho các quý ở trên`;
    if(leftoverAmount<=0.5) return `${base}.`;
    return `${base}, số tiền dư còn lại là ${moneySpaced(leftoverAmount)}, số tiền này sẽ được cộng dồn vào Tổng số tiền đã đóng lãi của hộ vay.`;
  }
  function buildReceiptExplanation(result, chosenSum, grandTotal){
    if(Math.abs(grandTotal-chosenSum)<0.5) return ''; // bằng nhau -> không cần giải thích
    const { paidQuarters, extraPaidQuarters, unpaidChosenQuarters, leftoverAmount } = result;
    const names = (list)=> list.map(bx=>formatTimelineQuarterLabel(bx)).join(', ');
    if(grandTotal < chosenSum){
      if(paidQuarters.length===0){
        return `Tổng tiền: ${moneySpaced(grandTotal)} (Tiền thực nhận + Tiền dư từ đợt trước) không đủ trả cho bất cứ quý nào ở trên, số tiền còn dư là: ${moneySpaced(leftoverAmount)}, số tiền dư này sẽ được cộng dồn vào Tổng số tiền đã đóng lãi của hộ vay, ${names(unpaidChosenQuarters)} sẽ chưa được tính là đóng lãi xong`;
      }
      return `Tổng tiền: ${moneySpaced(grandTotal)} (Tiền thực nhận + Tiền dư từ đợt trước) chỉ đủ trả cho ${names(paidQuarters)}, số tiền còn dư là: ${moneySpaced(leftoverAmount)}, số tiền dư này sẽ được cộng dồn vào Tổng số tiền đã đóng lãi của hộ vay, ${names(unpaidChosenQuarters)} sẽ chưa được tính là đóng lãi xong`;
    }
    // grandTotal > chosenSum
    if(extraPaidQuarters.length===0){
      return `Tổng tiền: ${moneySpaced(grandTotal)} (Tiền thực nhận + Tiền dư từ đợt trước) sẽ trả cho ${names(paidQuarters)}, số tiền còn dư là: ${moneySpaced(leftoverAmount)}, số tiền dư này sẽ được cộng dồn vào Tổng số tiền đã đóng lãi của hộ vay`;
    }
    const afterChosenLeftover = Math.round((grandTotal-chosenSum)*100)/100;
    return `Tổng tiền: ${moneySpaced(grandTotal)} (Tiền thực nhận + Tiền dư từ đợt trước) sẽ trả cho ${names(paidQuarters)}, số tiền còn dư là ${moneySpaced(afterChosenLeftover)}, số tiền dư này sẽ được trả luôn cho ${names(extraPaidQuarters)}, số tiền còn lại là: ${moneySpaced(leftoverAmount)}, số tiền dư này sẽ được cộng dồn vào Tổng số tiền đã đóng lãi của hộ vay`;
  }
  // Trả về { unpaidText, paidText } cho cột công khai "Quý chưa/đã đóng lãi" — nguồn dữ liệu giờ là
  // Hộp tiền đóng lãi (không còn dùng checkbox phê duyệt cũ nữa).
  function borrowerQuarterPaymentLabels(b){
    const disp = computeInterestPaymentBoxDisplay(b);
    const unpaidText = disp.unpaidLines.map(x=>x.name).join(', '); // cũ trước, mới sau
    const paidText = disp.paidLines.map(x=>x.name).join(', '); // mới trước, cũ sau (đã sort sẵn)
    return { unpaidText, paidText };
  }

  // =====================================================================
  // Trạng thái hạn trả gốc của 1 người vay TÍNH ĐẾN HÔM NAY — 'active' (còn trong hạn gốc),
  // 'extended' (đang trong 1 đợt gia hạn còn hiệu lực), 'overdue' (đã quá hạn/quá hạn gia hạn gần
  // nhất mà chưa được gia hạn tiếp).
  // =====================================================================
  function borrowerLoanStatusToday(b){
    const today = new Date(); today.setHours(0,0,0,0);
    const exts = getBorrowerExtensions(b.id);
    if(exts.length){
      const last = exts[exts.length-1];
      const to = new Date(last.to+'T00:00:00');
      return today<=to ? 'extended' : 'overdue';
    }
    if(!b.dueDate) return 'active';
    const due = new Date(b.dueDate+'T00:00:00');
    return today<=due ? 'active' : 'overdue';
  }
  function computeExtensionStatusCounts(list){
    let inTerm=0, overdue=0, extended=0;
    list.forEach(b=>{
      const st = borrowerLoanStatusToday(b);
      if(st==='active') inTerm++; else if(st==='overdue') overdue++; else if(st==='extended') extended++;
    });
    return { inTerm, overdue, extended };
  }
  // Cộng N tháng (có thể lẻ .5 = thêm 15 ngày xấp xỉ) vào 1 ngày yyyy-mm-dd.
  function addMonthsToDateStr(dateStr, months){
    const d = new Date(dateStr+'T00:00:00');
    if(isNaN(d.getTime())) return '';
    const whole = Math.trunc(months);
    const frac = months - whole;
    let nd = new Date(d.getFullYear(), d.getMonth()+whole, d.getDate());
    if(frac>0.01) nd = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate()+15);
    const pad = n=>String(n).padStart(2,'0');
    return `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}`;
  }

  // Yêu cầu mới: cột "Số tiền lãi" công khai giờ là TỔNG của "Số tiền lãi (trong hạn)" + "Số tiền
  // lãi (gia hạn lần 1)" + ... + "Số tiền lãi (gia hạn lần 5)" — mỗi thành phần đã tự tính đúng dựa
  // trên các hộp chứa Quý đang khớp bộ lọc Quý/Năm hiện hành (xem getInTermColumnValue /
  // getExtensionLevelColumnValue). Không tính trực tiếp nữa, chỉ CỘNG DỒN từ các cột ẩn.
  function computeCurrentQuarterInterest(b){
    let total = getInTermColumnValue(b, 'interestAmount');
    for(let lvl=1; lvl<=MAX_LOAN_EXTENSIONS; lvl++) total += getExtensionLevelColumnValue(b, lvl, 'interestAmount');
    return Math.round(total);
  }
  // Các loại câu hỏi hỗ trợ trong module [Biểu mẫu/Khảo sát/Bài kiểm tra] — giống Google Forms.
  const SURVEY_QTYPES = [
    { key:'short', label:'Trả lời ngắn' },
    { key:'paragraph', label:'Đoạn văn trả lời dài' },
    { key:'radio', label:'Trắc nghiệm (chỉ chọn 1 phương án)' },
    { key:'checkbox', label:'Hộp kiểm (được chọn nhiều phương án)' },
    { key:'dropdown', label:'Menu thả xuống (chỉ chọn 1 phương án)' },
  ];
  function surveyQTypeLabel(t){ return (SURVEY_QTYPES.find(x=>x.key===t)||{}).label || t; }
  function surveyQTypeHasOptions(t){ return t==='radio' || t==='checkbox' || t==='dropdown'; }
  // Danh sách "Nguồn vay" của 1 Phương án vay — chọn "Nguồn khác" thì phải tự gõ tên nguồn cụ thể.
  const FUND_SOURCE_OPTIONS = ['Cấp trung ương', 'Cấp tỉnh/thành phố', 'Nguồn 841', 'Nguồn địa phương', 'Nguồn khác'];
  // Danh sách lựa chọn Nguồn vay ĐẦY ĐỦ — 4 nguồn cố định + các nguồn TUỲ CHỈNH đã lưu ở
  // state.config.customFundSources + lựa chọn "+ Thêm nguồn khác" ở cuối cùng để mở modal quản lý. Nếu
  // giá trị hiện tại (currentVal) là 1 tên KHÔNG nằm trong bất kỳ danh sách nào (VD do AI trích xuất ra
  // 1 tên lạ, hoặc nguồn tuỳ chỉnh đã bị xoá sau đó) thì vẫn giữ lại, chèn thêm vào đầu để không mất dữ
  // liệu gốc.
  function fundSourceSelectOptionsHtml(currentVal){
    const fixed = FUND_SOURCE_OPTIONS.filter(o=>o!=='Nguồn khác');
    const custom = state.config.customFundSources||[];
    const all = [...fixed, ...custom];
    let extra = '';
    if(currentVal && !all.includes(currentVal)) extra = `<option value="${escapeHtml(currentVal)}" selected>${escapeHtml(currentVal)}</option>`;
    return extra + all.map(o=>`<option value="${escapeHtml(o)}" ${currentVal===o?'selected':''}>${escapeHtml(o)}</option>`).join('') + `<option value="__add_fundsource__">+ Thêm nguồn khác</option>`;
  }
  // ---------------------------------------------------------------------
  // Khi Admin thêm/sửa người vay mà gõ tên 1 địa bàn (ấp/thôn/khu phố) chưa từng có trong danh
  // sách — TỰ ĐỘNG thêm tên đó vào config.hamlets (sẽ hiện ra ở Cài đặt & Chia sẻ), ĐỒNG THỜI duy
  // trì 1 danh sách ẨN riêng (config.hamletsLegacyHidden — KHÔNG hiện ở Cài đặt) là bản sao của
  // toàn bộ hamlets nhưng thêm hậu tố " (cũ)" vào từng tên, dùng cho trường "Địa chỉ trước sáp
  // nhập" ở hồ sơ người vay.
  async function registerHamletIfNew(hamletName){
    if(!hamletName) return;
    const cfg = state.config;
    if(!cfg.hamlets) cfg.hamlets = [];
    if(!cfg.hamletsLegacyHidden) cfg.hamletsLegacyHidden = cfg.hamlets.map(h=>`${h} (cũ)`);
    if(!cfg.hamlets.includes(hamletName)){
      cfg.hamlets.push(hamletName);
      cfg.hamletsLegacyHidden.push(`${hamletName} (cũ)`);
      await cSet('config', cfg);
    }
  }
  function projectFundSourceLabel(p){
    if(!p) return '';
    if(p.fundSourceType==='Nguồn khác') return (p.fundSourceOther||'').trim() || 'Nguồn khác';
    return p.fundSourceType || '';
  }
  function provinceTitle(){
    const cfg = state.config||{};
    const t = PROVINCE_TYPE_OPTIONS.includes(cfg.provinceType) ? cfg.provinceType : '';
    const name = (cfg.provinceName||'').trim();
    return name ? `${t} ${name}`.trim() : '';
  }

  // Cấp quản lý: "Xã" hoặc "Phường" (mặc định "Xã" nếu chưa cấu hình)
  function adminLevelLabel(){
    const v = state.config && state.config.adminLevel;
    return ADMIN_LEVEL_OPTIONS.includes(v) ? v : 'Xã';
  }
  // Cấp cơ sở trực thuộc: "Ấp"/"Khu phố"/"Thôn"/... hoặc tên tự điền khi chọn "Khác"
  function subAdminLabel(){
    const cfg = state.config||{};
    return SUB_ADMIN_OPTIONS.includes(cfg.subAdminType) ? cfg.subAdminType : 'Khu dân cư';
  }
  function subAdminLabelLower(){ return subAdminLabel().toLowerCase(); }
  // "Xã Hưng Phước" / "Phường Bình Minh"
  function wardTitle(){
    const name = ((state.config && state.config.wardName)||'').trim();
    return name ? `${adminLevelLabel()} ${name}` : '';
  }
  function wardTitleUpper(){ return wardTitle().toUpperCase(); }
  // Yêu cầu 2: "[xã/phường] [tên xã/phường] – [tỉnh/thành phố] [tên tỉnh/thành phố]" — dùng cho
  // góc trái trên cùng của giao diện chính (không viết hoa toàn bộ, giữ nguyên chữ hoa/thường của
  // tên riêng như người dùng đã nhập).
  function wardProvinceHeaderLine(){
    const cfg = state.config || {};
    const wardName = (cfg.wardName||'').trim();
    if(!wardName) return '';
    let line = `${adminLevelLabelLower()} ${wardName}`;
    const provType = PROVINCE_TYPE_OPTIONS.includes(cfg.provinceType) ? cfg.provinceType.toLowerCase() : '';
    const provName = (cfg.provinceName||'').trim();
    if(provName) line += ` – ${provType} ${provName}`.replace(/\s+/g,' ').trim();
    return line;
  }
  // "HỘI NÔNG DÂN XÃ HƯNG PHƯỚC" / "HỘI NÔNG DÂN PHƯỜNG BÌNH MINH"
  function hoiNongDanTitle(){
    const t = wardTitleUpper();
    return t ? `HỘI NÔNG DÂN ${t}` : 'HỘI NÔNG DÂN';
  }
  // Bản 2 DÒNG (xuống hàng ngay sau "DÂN") — dùng cho MỌI nơi hiển thị dạng HTML (xuất Word, in, xem
  // biên lai qua đường link...) — dòng 1: "HỘI NÔNG DÂN", dòng 2: "XÃ/PHƯỜNG [tên]".
  function hoiNongDanTitleHtml(){
    const t = wardTitleUpper();
    return t ? `HỘI NÔNG DÂN<br>${escapeHtml(t)}` : 'HỘI NÔNG DÂN';
  }
  // "Hội Nông dân Xã Hưng Phước" (không viết hoa toàn bộ — dùng trong câu văn thường)
  function hoiNongDanNatural(){
    const t = wardTitle();
    return t ? `Hội Nông dân ${t}` : 'Hội Nông dân';
  }
  function adminLevelLabelLower(){ return adminLevelLabel().toLowerCase(); }
  // "Danh sách các khu phố" / "Danh sách các ấp"
  function subAdminListLabel(){ return `Danh sách các ${subAdminLabelLower()}`; }

  // Module "Nhật ký hoạt động" đã bị XOÁ bỏ theo yêu cầu — pushLog() giờ không còn làm gì cả (giữ lại
  // hàm rỗng để không phải sửa hàng trăm chỗ gọi nó trong toàn bộ code).
  async function pushLog(action, target){}
  // "Kho Giấy xác nhận" — hạ tầng lưu trữ TỐI GIẢN (chuẩn bị sẵn dữ liệu), giao diện xem lại đầy đủ
  // sẽ được xây dựng sau. Mỗi giấy xác nhận là 1 bản ghi bất biến, không thể sửa/xoá.
  // Lưu 1 Giấy xác nhận — GẮN ĐÚNG vào Hộp giấy xác nhận của 1 người vay cụ thể (borrowerId), y hệt
  // cấu trúc "Kho Biên lai" — để sau này "Hộp giấy xác nhận của [Họ và tên]" đọc được đúng dữ liệu.
  // `b` = null cho các trường hợp không gắn với 1 người cụ thể nào (VD: xoá cả phương án — khi đó
  // gọi hàm này riêng cho TỪNG người vay bên trong, không gọi 1 lần chung).
  // Lấy thông tin thiết bị (trình duyệt) + địa chỉ IP công khai (nếu lấy được) của người đang thao
  // tác — CHỈ LẤY 1 LẦN DUY NHẤT cho cả phiên làm việc (cache lại) để tránh gọi mạng nhiều lần không
  // cần thiết. Nếu không lấy được IP (mất mạng, bị chặn...) thì bỏ qua, không làm gián đoạn gì cả.
  let __cachedClientIp, __clientIpFetchAttempted = false;
  async function getClientDeviceInfo(){
    if(!__clientIpFetchAttempted){
      __clientIpFetchAttempted = true;
      try{
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        __cachedClientIp = data && data.ip;
      }catch(e){ __cachedClientIp = null; }
    }
    return { ip: __cachedClientIp||'', userAgent: (typeof navigator!=='undefined' && navigator.userAgent) || '' };
  }
  async function pushConfirmationDocument(kind, title, details, b){
    const device = await getClientDeviceInfo();
    const entry = { id:uid(), kind, title, details, createdAt:new Date().toISOString(), createdBy: state.identity.email, createdByName: state.identity.name,
      createdByIp: device.ip, createdByDevice: device.userAgent,
      borrowerId: b? b.id : null, borrowerName: b? b.name : null };
    await cPush('confirmationDocuments', entry);
    if(b) await cSetRecord('borrowerConfirmations/'+b.id, entry.id, entry);
    // KHÔNG tự cập nhật state.borrowerConfirmations thủ công — realtime binding sẽ tự nhận đúng bản
    // ghi mới này ngay lập tức, tránh bị hiển thị trùng lặp cho tới khi tải lại trang.
    return entry;
  }
  // "GIẤY XÁC NHẬN CHUNG" — dùng cho hành động ảnh hưởng tới NHIỀU người vay cùng lúc (sửa/xoá cả
  // Phương án vay, đổi mốc thời gian hàng quý cho tất cả). CHỈ lập đúng 1 bản ghi DUY NHẤT (tránh lập
  // hàng loạt giấy trùng lặp nội dung, giảm tải cho hệ thống) — lưu vào "Kho Giấy xác nhận CHUNG"
  // riêng, sau đó chỉ nối 1 LIÊN KẾT NHẸ (không sao chép nội dung) vào Hộp giấy xác nhận của TỪNG
  // người vay liên quan, để họ vẫn thấy đúng tên giấy này xuất hiện trong hộp của mình.
  async function pushSharedConfirmationDocument(kind, title, details, affectedBorrowerIds){
    const device = await getClientDeviceInfo();
    const entry = { id:uid(), kind, title, details, createdAt:new Date().toISOString(), createdBy: state.identity.email, createdByName: state.identity.name,
      createdByIp: device.ip, createdByDevice: device.userAgent, affectedBorrowerIds: affectedBorrowerIds||[] };
    await cSetRecord('sharedConfirmationDocuments', entry.id, entry);
    for(const bid of (affectedBorrowerIds||[])){
      const link = { id: entry.id, isSharedLink:true, kind: entry.kind, title: entry.title, createdAt: entry.createdAt };
      await cSetRecord('borrowerConfirmations/'+bid, entry.id, link);
    }
    return entry;
  }
  // "BIÊN LAI CHUNG" — dùng cho hành động thu/trả tiền của NHIỀU người vay cùng lúc trong 1 phương án
  // vay. CHỈ lập đúng 1 bản ghi DUY NHẤT, rồi nối LIÊN KẾT NHẸ vào Hộp biên lai của từng người liên
  // quan — y hệt cách làm với Giấy xác nhận CHUNG.
  async function pushSharedReceiptRecord(kind, title, details, amount, sign, affectedBorrowerIds, categoryLabelId, forceId, viaPaymentLink){
    const device = await getClientDeviceInfo();
    const entry = { id: forceId||uid(), kind, title, details, amount:Math.round(amount||0), sign:sign||'+',
      createdAt:new Date().toISOString(), createdBy: state.identity.email, createdByName: state.identity.name,
      createdByIp: device.ip, createdByDevice: device.userAgent, affectedBorrowerIds: affectedBorrowerIds||[], receiptCategoryId: categoryLabelId||null,
      ...(viaPaymentLink? { viaPaymentLink:true } : {}) };
    await cSetRecord('sharedBorrowerReceipts', entry.id, entry);
    for(const bid of (affectedBorrowerIds||[])){
      const link = { id: entry.id, isSharedLink:true, kind: entry.kind, categoryKey: entry.kind, displayTitle: entry.title, groupKey: (entry.kind==='shared_final_settlement'?'tat_toan':entry.kind==='shared_interest_payment'?'thu_lai':''), title: entry.title, amount: entry.amount, sign: entry.sign, createdAt: entry.createdAt, receiptCategoryId: entry.receiptCategoryId, quarterLines:[] };
      await cSetRecord('borrowerReceipts/'+bid, entry.id, link);
    }
    return entry;
  }
  // =====================================================================
  // "KHO BIÊN LAI" — hạ tầng lưu trữ TỪ THỜI ĐIỂM NÀY TRỞ ĐI (không hồi tố các biên lai đã lập
  // trước đây, vì website còn đang trong quá trình xây dựng). Mỗi lần 1 biên lai được lập THÀNH
  // CÔNG, hệ thống tự động lưu thêm đúng 1 bản ghi bất biến vào đây.
  // =====================================================================
  // Đúng 14 hạng mục biên lai — tên hiển thị CHÍNH XÁC theo quy định, không đổi.
  const RECEIPT_CATEGORY_NAMES = {
    interest_quarter: 'BL thu tiền lãi (theo cách tính quý)',
    interest_money: 'BL thu tiền lãi (theo cách tính tiền cụ thể)',
    interest_money_riskdebt: 'BL thu tiền lãi (theo cách tính tiền cụ thể) đối với hộ nợ rủi ro',
    refund_quarter: 'BL Trả lại tiền lãi đã đóng (theo cách tính quý)',
    refund_money: 'BL Trả lại tiền lãi đã đóng (theo cách tính tiền cụ thể)',
    settlement_with_interest: 'BL Tất toán khoản vay (trả kèm luôn lãi chưa đóng)',
    settlement_no_interest: 'BL Tất toán khoản vay (Chưa trả lãi chưa đóng)',
    early_province_with_interest: 'BL Trả nợ trước hạn (trả lại cấp quản lý vốn vay) (trả kèm luôn lãi chưa đóng)',
    early_province_no_interest: 'BL Trả nợ trước hạn (trả lại cấp quản lý vốn vay) (Chưa trả lãi chưa đóng)',
    early_heir_with_interest: 'BL Trả nợ trước hạn (có người thừa kế) (trả kèm luôn lãi chưa đóng)',
    early_heir_no_interest: 'BL Trả nợ trước hạn (có người thừa kế) (Chưa trả lãi chưa đóng)',
    reversal_early: 'BL trả lại số tiền "trả nợ trước hạn" do phê duyệt nhầm',
    reversal_settlement: 'BL trả lại số tiền "tất toán khoản vay" do phê duyệt nhầm',
    overflow_paid: 'BL xử lý số tiền lãi đã đóng vượt ngưỡng tổng số tiền cần phải đóng của khoản vay',
  };
  // Nhóm "Hạng mục biên lai" (dùng cho Bộ lọc Hạng mục) — gộp các categoryKey liên quan.
  const RECEIPT_GROUP_OF = {
    interest_quarter:'thu_lai', interest_money:'thu_lai', interest_money_riskdebt:'thu_lai',
    refund_quarter:'tra_lai', refund_money:'tra_lai', overflow_paid:'tra_lai',
    settlement_with_interest:'tat_toan', settlement_no_interest:'tat_toan',
    early_province_with_interest:'tra_no_truoc_han', early_province_no_interest:'tra_no_truoc_han',
    early_heir_with_interest:'tra_no_truoc_han', early_heir_no_interest:'tra_no_truoc_han',
    reversal_early:'hoan_tra_no_truoc_han', reversal_settlement:'hoan_tra_tat_toan',
  };
  // Lưu lại đúng 1 bản ghi Biên lai bất biến — gọi ngay sau khi 1 hành động tài chính được xác nhận
  // thành công. `opts.quarterLines` = [{qk,year}] các Quý mà biên lai này liên quan tới (dùng để lọc
  // theo Bộ lọc Quý/Năm trong Hộp biên lai) — để trống nếu biên lai không gắn với Quý nào cụ thể.
  // Phân tách key hộp chứa Quý (VD "q3-2026-0") thành {qk,year} — dùng để lưu vào quarterLines của
  // Biên lai, phục vụ Bộ lọc Quý/Năm trong Hộp biên lai sau này.
  function parseQuarterBoxKey(key){
    const m = /^(.+)-(\d{4})-\d+$/.exec(key||'');
    if(!m) return null;
    return { qk:m[1], year:parseInt(m[2],10) };
  }
  // Dòng 1 (Thể loại biên lai) — TÔ MÀU CHÍNH XÁC từng cụm chữ theo đúng quy định. Vì chỉ có đúng 13
  // hạng mục cố định nên dựng sẵn HTML cho từng hạng mục luôn (an toàn tuyệt đối, không cần regex).
  const RC = { // các mã màu dùng lại nhiều lần
    quy:'#3f51b5', tien:'#00897b', kemLai:'#2e7d32', chuaTraLai:'#f57f17',
    capQuanLy:'#ad1457', nguoiThuaKe:'#5e35b1', verbGreen:'#1b5e20', traLaiRed:'#c62828', doPhaCam:'#d84315',
  };
  const RECEIPT_TITLE_HTML = {
    interest_quarter: `BL <span style="color:${RC.verbGreen};">thu tiền</span> lãi <span style="color:${RC.quy};">(theo cách tính quý)</span>`,
    interest_money: `BL <span style="color:${RC.verbGreen};">thu tiền</span> lãi <span style="color:${RC.tien};">(theo cách tính tiền cụ thể)</span>`,
    interest_money_riskdebt: `BL <span style="color:${RC.verbGreen};">thu tiền</span> lãi <span style="color:${RC.tien};">(theo cách tính tiền cụ thể)</span> đối với hộ nợ rủi ro`,
    refund_quarter: `BL <span style="color:${RC.traLaiRed};">Trả lại</span> tiền lãi đã đóng <span style="color:${RC.quy};">(theo cách tính quý)</span>`,
    refund_money: `BL <span style="color:${RC.traLaiRed};">Trả lại</span> tiền lãi đã đóng <span style="color:${RC.tien};">(theo cách tính tiền cụ thể)</span>`,
    settlement_with_interest: `BL <span style="color:${RC.verbGreen};">Tất toán</span> khoản vay <span style="color:${RC.kemLai};">(trả kèm luôn lãi chưa đóng)</span>`,
    settlement_no_interest: `BL <span style="color:${RC.verbGreen};">Tất toán</span> khoản vay <span style="color:${RC.chuaTraLai};">(Chưa trả lãi chưa đóng)</span>`,
    early_province_with_interest: `BL <span style="color:${RC.verbGreen};">Trả nợ</span> trước hạn <span style="color:${RC.capQuanLy};">(trả lại cấp quản lý vốn vay)</span> <span style="color:${RC.kemLai};">(trả kèm luôn lãi chưa đóng)</span>`,
    early_province_no_interest: `BL <span style="color:${RC.verbGreen};">Trả nợ</span> trước hạn <span style="color:${RC.capQuanLy};">(trả lại cấp quản lý vốn vay)</span> <span style="color:${RC.chuaTraLai};">(Chưa trả lãi chưa đóng)</span>`,
    early_heir_with_interest: `BL <span style="color:${RC.verbGreen};">Trả nợ</span> trước hạn <span style="color:${RC.nguoiThuaKe};">(có người thừa kế)</span> <span style="color:${RC.kemLai};">(trả kèm luôn lãi chưa đóng)</span>`,
    early_heir_no_interest: `BL <span style="color:${RC.verbGreen};">Trả nợ</span> trước hạn <span style="color:${RC.nguoiThuaKe};">(có người thừa kế)</span> <span style="color:${RC.chuaTraLai};">(Chưa trả lãi chưa đóng)</span>`,
    reversal_early: `BL <span style="color:${RC.traLaiRed};">trả lại</span> số tiền "trả nợ trước hạn" do phê duyệt nhầm.`,
    reversal_settlement: `BL <span style="color:${RC.traLaiRed};">trả lại</span> số tiền "tất toán khoản vay" do phê duyệt nhầm.`,
    overflow_paid: `BL <span style="color:${RC.traLaiRed};">xử lý</span> số tiền lãi đã đóng <span style="color:${RC.doPhaCam};">vượt ngưỡng tổng số tiền cần phải đóng</span> của khoản vay`,
  };
  async function pushReceiptRecord(b, categoryKey, opts){
    opts = opts||{};
    const device = await getClientDeviceInfo();
    const entry = {
      id: opts.forceId || uid(), // Biên lai chuyển từ "chưa thanh toán" sang thật -> GIỮ NGUYÊN đúng
      // mã đã có sẵn (đã từng chia sẻ qua đường link) — để đường link cũ vẫn trỏ đúng, không tạo ra 2
      // mã/2 đường link khác nhau cho cùng 1 biên lai.
      borrowerId: b.id,
      borrowerName: b.name,
      categoryKey,
      groupKey: RECEIPT_GROUP_OF[categoryKey]||'',
      displayTitle: RECEIPT_CATEGORY_NAMES[categoryKey]||categoryKey,
      amount: Math.round(opts.amount||0),
      sign: opts.sign||'+',
      quarterLines: opts.quarterLines||[],
      receiptCategoryId: opts.categoryLabelId||null,
      createdAt: new Date().toISOString(),
      createdBy: state.identity.email,
      createdByName: state.identity.name,
      createdByIp: device.ip, createdByDevice: device.userAgent,
      extra: opts.extra||{},
      ...(opts.viaPaymentLink? { viaPaymentLink:true } : {}),
    };
    await cPush('borrowerReceipts/'+b.id, entry);
    // KHÔNG tự cập nhật state.borrowerReceipts thủ công ở đây nữa — bind('borrowerReceipts', ...) ở
    // attachRealtime() sẽ TỰ ĐỘNG nhận đúng bản ghi mới này ngay lập tức qua Firebase realtime rồi.
    // Nếu tự cập nhật thêm ở đây thì bản ghi sẽ bị hiển thị TRÙNG 2 LẦN cho tới khi tải lại trang.
    return entry;
  }
  // Sửa lại 1 vài trường của 1 biên lai ĐÃ lập trước đó (CHỈ cho phép: ghi chú/lý do, phân loại) — vì
  // biên lai được lưu bằng khoá tự sinh của Firebase (cPush), không phải theo entry.id, nên phải tìm
  // lại đúng bản ghi theo entry.id trước khi cập nhật.
  async function updateBorrowerReceiptField(borrowerId, receiptId, updates){
    const snap = await wref('borrowerReceipts/'+borrowerId).once('value');
    const val = snap.val() || {};
    const fbKey = Object.keys(val).find(k=> val[k] && val[k].id===receiptId);
    if(!fbKey) throw new Error('Không tìm thấy biên lai này để cập nhật (có thể đã bị xoá).');
    await wref('borrowerReceipts/'+borrowerId).child(fbKey).update(updates);
  }
  async function updateSharedReceiptField(receiptId, updates){
    const snap = await wref('sharedBorrowerReceipts').once('value');
    const val = snap.val() || {};
    const fbKey = Object.keys(val).find(k=> val[k] && val[k].id===receiptId);
    if(!fbKey) throw new Error('Không tìm thấy biên lai chung này để cập nhật (có thể đã bị xoá).');
    await wref('sharedBorrowerReceipts').child(fbKey).update(updates);
  }
  // Bảng nhỏ sửa 1 dòng chữ tự do (Ghi chú/Lý do) trong biên lai — giữ đúng giới hạn ký tự như lúc
  // lập biên lai, có xác nhận, và đánh dấu "đã được sửa lại" nếu nội dung mới khác nội dung cũ.
  function renderEditReceiptTextDialog(currentValue, maxLen, onSave){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:440px;">
        <div class="modal-head"><h3>✏️ Sửa nội dung</h3><button class="modal-close preview-allow" id="ert-close">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Nội dung (tối đa ${maxLen} ký tự)</label><textarea id="ert-input" maxlength="${maxLen}" class="preview-allow" rows="3">${escapeHtml(currentValue||'')}</textarea></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="ert-back">Quay lại</button>
          <button class="btn btn-primary preview-allow" id="ert-save">Lưu</button>
        </div>
      </div>`;
    wrap.querySelector('#ert-close').onclick = close;
    wrap.querySelector('#ert-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#ert-save').onclick = async ()=>{
      const newVal = (wrap.querySelector('#ert-input').value||'').trim();
      if(newVal===currentValue) { close(); return; }
      if(!confirm('Đồng chí có CHẮC CHẮN muốn lưu nội dung mới này không?')) return;
      close();
      await onSave(newVal);
    };
  }
  // Bảng nhỏ đổi Phân loại biên lai (chọn từ danh sách có sẵn, hoặc thêm phân loại mới) — y hệt lúc
  // lập biên lai.
  function renderEditReceiptCategoryDialog(currentLabelId, onSave){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    function render(){
      const labels = receiptAllLabels();
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:420px;">
          <div class="modal-head"><h3>✏️ Đổi Phân loại biên lai</h3><button class="modal-close preview-allow" id="erc-close">✕</button></div>
          <div class="modal-body">
            <div style="display:flex; flex-direction:column; gap:6px; max-height:340px; overflow:auto;">
              <label class="sv-filter-item"><input type="radio" name="erc-cat" class="preview-allow" value="" ${!currentLabelId?'checked':''}><span>Không phân loại</span></label>
              ${labels.map(l=>`<label class="sv-filter-item"><input type="radio" name="erc-cat" class="preview-allow" value="${l.id}" ${currentLabelId===l.id?'checked':''}><span style="display:flex; align-items:center; gap:6px;">${escapeHtml(l.name)}<span style="display:inline-block; width:22px; height:9px; background:${l.color}; border:1px solid var(--line);"></span></span></label>`).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="erc-add-new" style="margin-top:10px;">➕ Thêm phân loại mới</button>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="erc-back">Quay lại</button>
            <button class="btn btn-primary preview-allow" id="erc-save">Lưu</button>
          </div>
        </div>`;
      wrap.querySelector('#erc-close').onclick = close;
      wrap.querySelector('#erc-back').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelector('#erc-add-new').onclick = ()=> renderReceiptCategoryManagerModal('payment', ()=> render());
      wrap.querySelector('#erc-save').onclick = async ()=>{
        const sel = wrap.querySelector('input[name="erc-cat"]:checked');
        const newId = sel && sel.value ? sel.value : null;
        if(newId===currentLabelId){ close(); return; }
        if(!confirm('Đồng chí có CHẮC CHẮN muốn đổi Phân loại biên lai này không?')) return;
        close();
        await onSave(newId);
      };
    }
    render();
  }
  // Lan truyền thay đổi điều khoản chung của Phương án vay (lãi suất, ngày vay, ngày đến hạn, nguồn
  // vay, % phân bổ) xuống TẤT CẢ người vay đang thuộc phương án đó — TRỪ Ngày vay của Người thừa kế
  // (mãi mãi không đổi, đã thiết kế riêng).
  async function propagateProjectChangesToBorrowers(project){
    const members = state.borrowers.filter(b=>!b.deleted && b.projectId===project.id);
    const fundSourceLabel = projectFundSourceLabel(project);
    for(const b of members){
      const updated = { ...b,
        rate: parseFloat(project.interestRate)||0,
        dueDate: project.dueDate,
        fundSource: fundSourceLabel,
        splitCentral: project.splitCentral, splitProvince: project.splitProvince, splitWard: project.splitWard,
        hamletAllocPercent: project.hamletAllocPercent,
      };
      if(!b.isHeir) updated.loanDate = project.disburseDate; // Người thừa kế: Ngày vay KHÔNG BAO GIỜ đổi
      await cSetRecord('borrowers', b.id, updated);
      const idx = state.borrowers.findIndex(x=>x.id===b.id);
      if(idx>=0) state.borrowers[idx] = updated;
    }
  }

  const IDENTITY_KEY = 'hnd_identity'; // chỉ lưu trên máy này (localStorage), không đưa lên đám mây
  const GUEST_SESSION_KEY = 'hnd_guest_access_session_v1';
  // Mỗi tài khoản Google (email) có thể sở hữu/tham gia NHIỀU mã xã (multi-tenant).
  // Máy này chỉ cache "mã xã đang xem gần nhất" để lần sau mở lên vào thẳng, còn danh sách
  // đầy đủ các mã xã (Ví mã xã) luôn được đọc lại từ Firebase: users/{email}/wards.
  function activeWardCacheKey(email){ return `hnd_active_ward_${emailToKey(email)}`; }
  // "Mã ẩn" — chuỗi định danh cố định, KHÔNG BAO GIỜ đổi dù người dùng đổi tên/mã định danh
  // hiển thị bao nhiêu lần. Dùng riêng cho mục đích quản trị (thu phí / kích hoạt gói VIP-PRO
  // sau này) — hoàn toàn không hiển thị hay tác động gì tới trải nghiệm người dùng thường.
  function genSecretId(){ return 'sec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10); }
  // Đảm bảo MỖI tài khoản Google đã đăng nhập đều có 1 Mã ẩn cấp-tài khoản — kể cả khi họ
  // chưa/không kết nối với mã xã nào (mã định danh để trống), theo đúng yêu cầu quản trị.
  async function ensureAccountSecretId(){
    try{
      const ref = rtdb.ref(`users/${emailToKey(state.identity.email)}/secretId`);
      const snap = await ref.get();
      if(!snap.exists()) await ref.set(genSecretId());
    }catch(e){ console.error('Không tạo được Mã ẩn cấp tài khoản:', e); }
  }
  function setActiveWardCache(wid){ lset(activeWardCacheKey(state.identity.email), wid||''); }
  function seenWelcomeKey(email){ return `hnd_seen_welcome_${emailToKey(email)}`; }
  function beginWardGuestSession(wid){
    const session = {
      id:'guest_' + uid() + '_' + Date.now().toString(36),
      wardId:wid,
      startedAt:new Date().toISOString(),
    };
    state.guestSessionId = session.id;
    try{ sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session)); }catch(e){}
    return session.id;
  }
  function clearWardGuestSession(){
    state.guestSessionId = null;
    try{ sessionStorage.removeItem(GUEST_SESSION_KEY); }catch(e){}
  }

  // ---------- VÍ MÃ XÃ (multi-tenant wallet) ----------
  // users/{emailKey}/wards/{wardId}        = {kind:'owner'|'guest', wardName, addedAt, av}
  // users/{emailKey}/deletedWards/{wardId} = {wardId, wardName, deletedAt}  (thùng rác cấp tài khoản — chỉ của Chủ mã)
  // superadmin/trashWards/{wardId}         = {wardId, wardName, ownerEmail, deletedAt} (thùng rác hệ thống — chỉ site owner)
  function myWardsRef(){ return rtdb.ref(`users/${emailToKey(state.identity.email)}/wards`); }
  function myDeletedWardsRef(){ return rtdb.ref(`users/${emailToKey(state.identity.email)}/deletedWards`); }

  // ---------------------------------------------------------------------
  // YÊU CẦU 1 — Kiểm tra & cấp Mã định danh NGẪU NHIÊN khi người dùng bỏ qua
  // bước tạo/tham gia mã. Quy tắc trùng lặp áp dụng CHUNG cho mọi cách tạo mã
  // (tự gõ hay hệ thống sinh ngẫu nhiên):
  //   - Một mã bị coi là "đã bị chiếm" nếu nó đang hoạt động HOẶC đang nằm trong
  //     Thùng rác CÁ NHÂN của bất kỳ tài khoản nào (users/{email}/deletedWards).
  //   - NGOẠI LỆ: mã đang nằm trong "Thùng rác hệ thống" (superadmin/trashWards —
  //     tức chủ website đã xác nhận xoá lần 2) được coi là đã thả tự do, có thể
  //     dùng lại để tạo mã mới.
  // ---------------------------------------------------------------------
  async function isWardIdTaken(wid){
    const cfg = await cGetOnceFor(wid, 'config', null);
    if(!cfg) return false; // chưa từng tồn tại, hoặc đã bị Chủ website xoá vĩnh viễn (purge) -> coi như trống
    if(!cfg.deleted) return true; // đang hoạt động bình thường -> chắc chắn đã bị chiếm
    // Đang ở trạng thái "đã xoá" — chỉ được coi là TRỐNG nếu nó đang nằm trong Thùng rác hệ thống.
    try{
      const sysSnap = await rtdb.ref(`superadmin/trashWards/${wid}`).get();
      if(sysSnap.exists()) return false; // Ngoại lệ: đã thả tự do
    }catch(e){ /* không đọc được (không phải site owner) -> coi như KHÔNG được thả tự do, an toàn hơn */ }
    return true; // đang nằm trong thùng rác cá nhân của ai đó -> vẫn coi là đã bị chiếm
  }
  const RANDOM_WID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
  function randomWardIdCandidate(len){
    let s = '';
    for(let i=0;i<len;i++) s += RANDOM_WID_CHARS[Math.floor(Math.random()*RANDOM_WID_CHARS.length)];
    return s;
  }
  // Sinh 1 Mã định danh ngẫu nhiên 4 ký tự (chữ + số) CHƯA TỪNG bị chiếm — dò thử nhiều lần,
  // nếu cực hiếm vẫn trùng liên tục thì tăng dần độ dài để chắc chắn luôn tìm ra mã trống.
  async function generateUniqueRandomWardId(){
    for(let attempt=0; attempt<40; attempt++){
      const candidate = randomWardIdCandidate(4);
      if(!(await isWardIdTaken(candidate))) return candidate;
    }
    for(let len=5; len<=8; len++){
      for(let attempt=0; attempt<40; attempt++){
        const candidate = randomWardIdCandidate(len);
        if(!(await isWardIdTaken(candidate))) return candidate;
      }
    }
    return 'x' + Date.now().toString(36).slice(-7); // vét cạn cuối cùng, gần như không bao giờ chạm tới
  }
  // Cấp ngay 1 Mã định danh ngẫu nhiên cho tài khoản đang đăng nhập, biến họ thành CHỦ MÃ của
  // mã này, rồi đưa vào màn hình "Thiết lập cơ sở dữ liệu lõi" — dùng cho nút
  // "🎲 Làm việc mà không cần mã (mã tạo ngẫu nhiên)" ở cả màn Welcome lẫn Ví mã xã.
  async function createRandomWardAndOnboard(){
    const wid = await generateUniqueRandomWardId();
    // CHỈ tạo "bản nháp" cục bộ — KHÔNG ghi gì lên Firebase cả cho tới khi "Thiết lập cơ sở dữ liệu
    // lõi" được lưu thành công (finishOnboarding). Nếu người dùng bấm "Quay lại trang trước" thì coi
    // như chưa từng có chuyện gì xảy ra, không để sót rác trên Firebase.
    state.identity.wardId = wid;
    setActiveWardCache(wid);
    state._pendingAccessCode = '';
    state._pendingSecretId = genSecretId();
    state._pendingIsRandom = true;
    state.config = null; state.borrowers=[]; state.loanProjects=[]; state.borrowerColumnPrefsShared=null; state.borrowerVisibleCols=null; state.borrowerColumnOrder=null; state.filterHamlets=null; state.filterProjectIds=null; state.filterFundSources=null; state.filterManagerIds=null; state.filterQuarters=null; state.filterQuartersAdvanced=false; state.filterYears=null; state.filterYearsAdvanced=false; state.mainTimeline=null; state.openFilterDropdown=null; state.surveys=[]; state.expenses=[]; state.trash=[]; state.log=[]; state.collaborators={};
    state.view = 'onboarding';
    render();
    return wid;
  }

  // Tải danh sách Admin hiện tại từ Firebase (ngoài 2 Admin tối cao cố định trong code).
  async function loadAdmins(){
    try{
      const snap = await rtdb.ref('admins').get();
      state.admins = (snap && snap.exists()) ? snap.val() : {};
    }catch(e){ state.admins = {}; }
  }
  // CHỈ 2 Admin TỐI CAO mới có quyền thêm Admin mới — các Admin thường (được thêm sau) KHÔNG có
  // quyền này, dù bản thân họ vẫn được dùng đầy đủ các module Admin khác (Cấu hình AI, Quản lý hệ thống...).
  async function addAdminEmail(emailRaw){
    if(!isSuperAdmin()){ alert('Chỉ Admin tối cao mới có quyền thêm Admin mới.'); return false; }
    const email = (emailRaw||'').trim().toLowerCase();
    if(!email || !email.includes('@') || !email.includes('.')){ alert('Vui lòng nhập đúng địa chỉ email.'); return false; }
    if(SUPER_ADMIN_EMAILS.includes(email)){ alert('Tài khoản này đã là Admin tối cao mặc định.'); return false; }
    await rtdb.ref(`admins/${emailToKey(email)}`).set({ email, addedBy: state.identity.email, addedAt: new Date().toISOString() });
    await loadAdmins();
    return true;
  }
  // CHỈ 2 Admin TỐI CAO mới có quyền gỡ quyền Admin của người khác — TRỪ chính 2 Admin tối cao,
  // không ai (kể cả Admin tối cao khác) được phép gỡ.
  async function removeAdminEmail(email){
    if(!isSuperAdmin()){ alert('Chỉ Admin tối cao mới có quyền gỡ quyền Admin.'); return; }
    if(SUPER_ADMIN_EMAILS.includes(email)){ alert('Không thể gỡ quyền của Admin tối cao.'); return; }
    if(!confirm(`Gỡ quyền Admin của "${email}"? Đồng chí có chắc chắn?`)) return;
    await rtdb.ref(`admins/${emailToKey(email)}`).remove();
    await loadAdmins();
  }

  // ---------------------------------------------------------------------
  // Cấu hình AI (Khu vực 2, Module [CÀI ĐẶT ADMIN]) — lưu tại system_config/ai_providers/{id},
  // toàn ứng dụng kéo về chạy ngầm khi người dùng chat để không lộ API Key ở giao diện.
  // ---------------------------------------------------------------------
  async function loadAiProviders(){
    try{
      const snap = await rtdb.ref('system_config/ai_providers').get();
      state.aiProviders = (snap && snap.exists()) ? Object.entries(snap.val()).map(([id,v])=>({id, ...v})) : [];
    }catch(e){
      // Lỗi hay gặp nhất ở đây là PERMISSION_DENIED do Realtime Database Rules đang yêu cầu
      // auth != null cho path "system_config" — khách tham quan/chưa đăng nhập Google sẽ KHÔNG
      // có phiên đăng nhập Firebase Auth nên bị chặn đọc, dù code phía client không hề kiểm tra
      // điều kiện đăng nhập nào ở đây cả. Cần mở quyền đọc công khai cho đúng path này trong
      // Realtime Database Rules (KHÔNG PHẢI Firestore Rules — 2 hệ thống luật khác nhau hoàn
      // toàn, và app này dùng Realtime Database xuyên suốt), ví dụ:
      //   "system_config": { ".read": true }
      console.error('[AI] Không tải được Cấu hình AI (system_config/ai_providers) — rất có thể do Realtime Database Rules đang chặn đọc công khai:', e);
      state.aiProviders = [];
    }
  }
  async function saveAiProvider(id, data){
    if(!isAdmin()) return;
    await rtdb.ref(`system_config/ai_providers/${id}`).set(data);
    await loadAiProviders();
  }
  async function deleteAiProvider(id){
    if(!isAdmin()) return;
    if(!confirm('Xoá cấu hình AI này?')) return;
    await rtdb.ref(`system_config/ai_providers/${id}`).remove();
    await loadAiProviders();
  }

  async function loadWallet(){
    const wardsSnap = await myWardsRef().get().catch(()=>null);
    const wardsObj = (wardsSnap && wardsSnap.exists()) ? wardsSnap.val() : {};
    state.myWards = await Promise.all(Object.entries(wardsObj).map(async ([wid, w])=>{
      const live = await cGetOnceFor(wid, 'config', null);
      return {
        wardId: wid, kind: w.kind, addedAt: w.addedAt, av: w.av||0,
        wardName: (live && live.wardName) || w.wardName || '',
        adminLevel: live && live.adminLevel,
        live: live ? { deleted: !!live.deleted, accessVersion: live.accessVersion||0, ownerEmail: live.ownerEmail } : { deleted:true, accessVersion:0 },
      };
    }));
    const delSnap = await myDeletedWardsRef().get().catch(()=>null);
    const delObj = (delSnap && delSnap.exists()) ? delSnap.val() : {};
    state.myDeletedWards = Object.values(delObj);
    await loadAdmins();
    if(isAdmin()){
      const trashSnap = await rtdb.ref('superadmin/trashWards').get().catch(()=>null);
      state.sysTrash = (trashSnap && trashSnap.exists()) ? Object.values(trashSnap.val()) : [];
    } else state.sysTrash = [];
  }

  // Tự động thêm 1 mục "Chia sẻ đích danh" (mặc định CHƯA cấp quyền gì — 'none' ở mọi module)
  // vào cfg.grants ngay khi có người dùng tài khoản Google tham gia (KHÁCH) bằng đúng Mã định
  // danh của Chủ mã. Nhờ vậy Chủ mã vào "Cài đặt & Chia sẻ" sẽ thấy sẵn tài khoản đó và chỉ
  // cần bấm chọn quyền Xem/Sửa cho từng mục, không cần gõ tay lại email.
  // Trả về true nếu VỪA thêm mới (cần ghi lại cfg lên Firebase), false nếu tài khoản đã có sẵn
  // trong danh sách chia sẻ đích danh từ trước (giữ nguyên quyền đã cấp, không ghi đè).
  function ensureGrantEntryForGuest(cfg, email, name){
    if(!email) return false;
    const key = emailToKey(email);
    cfg.grants = cfg.grants || {};
    if(cfg.grants[key]){
      // Đã tồn tại — chỉ bổ sung tên hiển thị nếu trước đó chưa có, KHÔNG đụng vào quyền đã cấp.
      let changed = false;
      if(name && !cfg.grants[key].name){ cfg.grants[key].name = name; changed = true; }
      cfg.grants[key].lastJoinedAt = new Date().toISOString();
      return changed; // chỉ cần ghi lại nếu có thay đổi tên hiển thị
    }
    cfg.grants[key] = {
      email, name: name||'',
      joinedAt: new Date().toISOString(), autoAdded: true,
      data:'none', members:'none', strength:'none', internal:'none', settings:'none',
    };
    return true;
  }

  // Tham gia (Khách) hoặc tạo mới (trở thành Chủ mã) một mã định danh cấp xã.
  // Trả về true nếu thành công (đã chuyển màn hình), false nếu bị chặn (sai mật khẩu...).
  async function joinOrCreateWard(widRaw, password){
    const wid = (widRaw||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
    if(!wid || wid.length<3){ alert('Vui lòng nhập Mã định danh hợp lệ (tối thiểu 3 ký tự, chỉ gồm chữ thường/số/gạch dưới/gạch ngang).'); return false; }
    const emailKey = emailToKey(state.identity.email);
    const taken = await isWardIdTaken(wid);
    if(!taken){
      // Mã chưa từng tồn tại, hoặc đã được thả tự do (đang ở Thùng rác hệ thống) -> tài khoản này
      // trở thành CHỦ MÃ mới, cần thiết lập cơ bản (onboarding)
      await rtdb.ref(`users/${emailKey}/wards/${wid}`).set({kind:'owner', wardName:'', addedAt:new Date().toISOString()});
      state.identity.wardId = wid;
      setActiveWardCache(wid);
      state._pendingAccessCode = password || '';
      state._pendingSecretId = genSecretId();
      state.config = null;
      state.view = 'onboarding';
      render();
      return true;
    }
    const existingCfg = await cGetOnceFor(wid, 'config', null);
    if(existingCfg.deleted){ alert('Mã xã này hiện không khả dụng (đã bị xoá). Vui lòng liên hệ Chủ mã hoặc chọn mã khác.'); return false; }
    if(existingCfg.ownerEmail === state.identity.email){
      // Đã là Chủ mã của mã này (chỉ thiếu bản ghi trong Ví, ví dụ đăng nhập máy mới) -> tự phục hồi
      await rtdb.ref(`users/${emailKey}/wards/${wid}`).set({kind:'owner', wardName: existingCfg.wardName||'', addedAt:new Date().toISOString()});
    } else {
      if((existingCfg.accessCode||'') && existingCfg.accessCode !== (password||'')){
        alert('Sai mật khẩu mã xã. Vui lòng liên hệ Chủ mã để lấy đúng mật khẩu.');
        return false;
      }
      // Tự động đưa tài khoản KHÁCH này vào danh sách "Chia sẻ đích danh" của Chủ mã (Yêu cầu 2)
      if(ensureGrantEntryForGuest(existingCfg, state.identity.email, state.identity.name)){
        await wrefFor(wid, 'config').set(existingCfg);
        syncWardIndex(wid, existingCfg);
      }
      await rtdb.ref(`users/${emailKey}/wards/${wid}`).set({kind:'guest', wardName: existingCfg.wardName||'', addedAt:new Date().toISOString(), av: existingCfg.accessVersion||0});
    }
    await enterWard(wid);
    return true;
  }

  function normalizeWardIdStr(s){ return (s||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,''); }

  // ---- Dùng cho màn hình "Thiết lập ban đầu" (yêu cầu 4): 2 hành động RIÊNG BIỆT, không tự suy đoán ----
  // [Tạo mã định danh cấp xã mới] — báo lỗi rõ nếu mã đã có người dùng.
  async function createWardStrict(widRaw, password){
    const wid = normalizeWardIdStr(widRaw);
    if(!wid || wid.length<3){ alert('Vui lòng nhập Mã định danh hợp lệ (tối thiểu 3 ký tự, chỉ gồm chữ thường/số/gạch dưới/gạch ngang).'); return false; }
    if(await isWardIdTaken(wid)){ alert('Mã này đã bị trùng với mã hiện có, hoặc trong thùng rác của ai đó, vui lòng thay đổi ký tự!'); return false; }
    // CHỈ tạo "bản nháp" cục bộ — KHÔNG ghi gì lên Firebase cho tới khi "Thiết lập cơ sở dữ liệu lõi"
    // được lưu thành công (finishOnboarding), để "Quay lại trang trước" không để sót rác trên Firebase.
    state.identity.wardId = wid;
    setActiveWardCache(wid);
    state._pendingAccessCode = password || '';
    state._pendingSecretId = genSecretId();
    state.config = null;
    state.view = 'onboarding';
    render();
    return true;
  }
  // [Tham gia bằng mã định danh cấp xã] — CHỈ tham gia mã đã có, không tự tạo mới.
  async function joinWardStrict(widRaw, password){
    const wid = normalizeWardIdStr(widRaw);
    const cfg = wid ? await cGetOnceFor(wid, 'config', null) : null;
    if(!cfg || cfg.deleted){ alert('Mã định danh này chưa tồn tại hoặc đã bị xoá. Vui lòng kiểm tra lại cho đúng (chỉ gồm chữ thường/số/gạch dưới/gạch ngang, không dấu, không khoảng trắng).'); return false; }
    if((cfg.accessCode||'') !== (password||'')){ alert('Mã định danh đúng, nhưng sai mật khẩu mã xã. Vui lòng nhập đúng mật khẩu (để trống nếu mã này không đặt mật khẩu).'); return false; }
    const emailKey = emailToKey(state.identity.email);
    if(cfg.ownerEmail === state.identity.email){
      await rtdb.ref(`users/${emailKey}/wards/${wid}`).set({kind:'owner', wardName: cfg.wardName||'', addedAt:new Date().toISOString()});
    } else {
      // Tự động đưa tài khoản KHÁCH này vào danh sách "Chia sẻ đích danh" của Chủ mã (Yêu cầu 2)
      if(ensureGrantEntryForGuest(cfg, state.identity.email, state.identity.name)){
        await wrefFor(wid, 'config').set(cfg);
        syncWardIndex(wid, cfg);
      }
      await rtdb.ref(`users/${emailKey}/wards/${wid}`).set({kind:'guest', wardName: cfg.wardName||'', addedAt:new Date().toISOString(), av: cfg.accessVersion||0});
    }
    await enterWard(wid);
    return true;
  }
  // Tham gia bằng mã (Loại 1 công khai) mà KHÔNG cần đăng nhập Google — dùng ở màn hình đăng nhập.
  // Không có "Ví mã xã", quyền hạn hoàn toàn theo config.publicPerms của mã đó.
  async function joinWardAsCodeGuest(widRaw, password){
    const wid = normalizeWardIdStr(widRaw);
    const cfg = wid ? await cGetOnceFor(wid, 'config', null) : null;
    if(!cfg || cfg.deleted){ alert('Mã định danh này chưa tồn tại hoặc đã bị xoá. Vui lòng kiểm tra lại cho đúng (chỉ gồm chữ thường/số/gạch dưới/gạch ngang, không dấu, không khoảng trắng).'); return false; }
    if((cfg.accessCode||'') !== (password||'')){ alert('Mã định danh đúng, nhưng sai mật khẩu mã xã. Vui lòng nhập đúng mật khẩu (để trống nếu mã này không đặt mật khẩu).'); return false; }
    state.previewMode = false;
    state.accessMode = ACCESS_MODES.WARD_GUEST;
    beginWardGuestSession(wid);
    state.identity = { name:'Khách qua mã (không đăng nhập)', email:null, photo:'', wardId: wid };
    state.config = cfg;
    state.activeTab = 'dashboard';
    resetTabScrollMemory(); // phiên mới: bỏ trí nhớ cuộn của phiên trước
    state.view = 'app';
    state._showWardWelcome = true;
    attachRealtime();
    render();
    return true;
  }

  // ---- Môi trường THAM QUAN (yêu cầu 2): xem giao diện mẫu, không cần đăng nhập, không đụng Firebase ----
  // Dữ liệu môi trường THAM QUAN — TỰ SINH MỚI mỗi lần load (không lưu Firebase), NGÀY THÁNG LUÔN
  // ĐỒNG BỘ theo thời điểm thực tế đang xem (dùng new Date() ngay lúc gọi hàm), để dù 10 năm sau ai
  // vào tham quan cũng luôn thấy hồ sơ "như mới", không bao giờ lỗi thời.
  function buildDemoState(){
    const fmt = (d)=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const addDays = (d,n)=>{ const r=new Date(d); r.setDate(r.getDate()+n); return r; };
    const addYears = (d,n)=>{ const r=new Date(d); r.setFullYear(r.getFullYear()+n); return r; };
    const today = new Date(); today.setHours(0,0,0,0);
    const NAMES = ['Nguyễn Văn A','Trần Thị B','Lê Văn C','Phạm Thị D','Hoàng Văn E','Vũ Thị F','Đặng Văn G','Bùi Thị H','Đỗ Văn I','Ngô Thị J'];
    const hamlets = ['Hưng Phước','Phước Thiện','Bù Tam','Mười Mẫu'];
    let pIdSeq=0, bIdSeq=0;
    const nextPid = ()=> 'dp'+(++pIdSeq);
    const nextBid = ()=> 'db'+(++bIdSeq);

    const projects = [];
    const borrowers = [];
    const interestPaymentBoxes = {};
    const loanExtensions = {};

    // ---- Phương án 1: CÒN LÂU MỚI TỚI HẠN — nguồn Trung ương, kỳ hạn 3 năm ----
    // Ngày vay nằm trong năm hiện tại-1 (đồng bộ động), đến hạn còn rất xa.
    {
      const loanDate = new Date(today.getFullYear()-1, 5, 15); // 15/06 năm (hiện tại-1)
      const dueDate = addYears(loanDate, 3); // còn rất lâu mới tới hạn
      const pid = nextPid();
      const totalCapital = 500000000;
      const n = 5, per = totalCapital/n;
      projects.push({ id:pid, name:'Trồng rau sạch nhà lưới', totalCapital, disburseDate:fmt(loanDate), dueDate:fmt(dueDate),
        fundSourceType:'Cấp trung ương', fundSourceOther:'', interestRate:8.4, splitCentral:3.5, splitProvince:2, splitWard:2.9, hamletAllocPercent:45,
        createdAt:loanDate.toISOString(), updatedAt:loanDate.toISOString(), deleted:false });
      for(let i=0;i<n;i++){
        const bid = nextBid();
        borrowers.push({ id:bid, name:NAMES[i], birthYear:String(1965+i*3), cccd:String(79000000000+i*1111), phone:'09'+(10000000+i*11111),
          address:'', preMergerAddress:'', industry:'Trồng trọt', repayAbility:'Khá', guarantor:'',
          projectId:pid, hamlet:hamlets[i%hamlets.length], principal:per, rate:8.4,
          loanDate:fmt(loanDate), dueDate:fmt(dueDate), fundSource:'Cấp trung ương',
          splitCentral:3.5, splitProvince:2, splitWard:2.9, hamletAllocPercent:45,
          checked:false, note:'', prevBalance:0, interestPaid:0, principalPaid:0, isExtended:false, extensionDueDate:'', deleted:false });
        // Đa dạng lịch sử đóng lãi: người đóng rất nhiều lần, người đóng ít, người chưa đóng lần nào.
        const yearlyInterest = per*8.4/100;
        const quarterlyInterest = yearlyInterest/4;
        const paidQuarters = i===0? 6 : i===1? 3 : i===2? 1 : 0; // A đóng rất nhiều lần, B vừa phải, C mới 1 lần, D/E chưa đóng
        interestPaymentBoxes[bid] = { totalPaid: Math.round(quarterlyInterest*paidQuarters), payments:{} };
      }
    }

    // ---- Phương án 2: SẮP ĐẾN HẠN — CHỈ CÒN ~60 NGÀY — nguồn Cấp tỉnh/thành phố, kỳ hạn 4 năm ----
    {
      const dueDate = addDays(today, 58);
      const loanDate = addYears(dueDate, -4);
      const pid = nextPid();
      const totalCapital = 600000000;
      const n = 10, per = totalCapital/n;
      projects.push({ id:pid, name:'Chăn nuôi bò sữa khép kín', totalCapital, disburseDate:fmt(loanDate), dueDate:fmt(dueDate),
        fundSourceType:'Cấp tỉnh/thành phố', fundSourceOther:'', interestRate:6.6, splitCentral:0, splitProvince:4.32, splitWard:2.28, hamletAllocPercent:45,
        createdAt:loanDate.toISOString(), updatedAt:loanDate.toISOString(), deleted:false });
      for(let i=0;i<n;i++){
        const bid = nextBid();
        borrowers.push({ id:bid, name:NAMES[i], birthYear:String(1970+i*2), cccd:String(79100000000+i*2222), phone:'09'+(20000000+i*22222),
          address:'', preMergerAddress:'', industry:'Chăn nuôi', repayAbility:'Trung bình', guarantor:'',
          projectId:pid, hamlet:hamlets[i%hamlets.length], principal:per, rate:6.6,
          loanDate:fmt(loanDate), dueDate:fmt(dueDate), fundSource:'Cấp tỉnh/thành phố',
          splitCentral:0, splitProvince:4.32, splitWard:2.28, hamletAllocPercent:45,
          checked:false, note:'', prevBalance:0, interestPaid:0, principalPaid:0, isExtended:false, extensionDueDate:'', deleted:false });
        const quarterlyInterest = per*6.6/100/4;
        const paidQuarters = i%4===0? 10 : i%4===1? 4 : i%4===2? 1 : 0;
        interestPaymentBoxes[bid] = { totalPaid: Math.round(quarterlyInterest*paidQuarters), payments:{} };
      }
    }

    // ---- Phương án 3: SẮP ĐẾN HẠN — CHỈ CÒN ~30 NGÀY — nguồn Cấp tỉnh/thành phố, kỳ hạn 2 năm ----
    {
      const dueDate = addDays(today, 27);
      const loanDate = addYears(dueDate, -2);
      const pid = nextPid();
      const totalCapital = 450000000;
      const n = 5, per = totalCapital/n;
      projects.push({ id:pid, name:'Trồng nấm bào ngư sạch', totalCapital, disburseDate:fmt(loanDate), dueDate:fmt(dueDate),
        fundSourceType:'Cấp tỉnh/thành phố', fundSourceOther:'', interestRate:6.6, splitCentral:0, splitProvince:4.32, splitWard:2.28, hamletAllocPercent:45,
        createdAt:loanDate.toISOString(), updatedAt:loanDate.toISOString(), deleted:false });
      for(let i=0;i<n;i++){
        const bid = nextBid();
        borrowers.push({ id:bid, name:NAMES[i], birthYear:String(1968+i*4), cccd:String(79200000000+i*3333), phone:'09'+(30000000+i*33333),
          address:'', preMergerAddress:'', industry:'Trồng trọt', repayAbility:'Khá', guarantor:'',
          projectId:pid, hamlet:hamlets[i%hamlets.length], principal:per, rate:6.6,
          loanDate:fmt(loanDate), dueDate:fmt(dueDate), fundSource:'Cấp tỉnh/thành phố',
          splitCentral:0, splitProvince:4.32, splitWard:2.28, hamletAllocPercent:45,
          checked:false, note:'', prevBalance:0, interestPaid:0, principalPaid:0, isExtended:false, extensionDueDate:'', deleted:false });
        const quarterlyInterest = per*6.6/100/4;
        const paidQuarters = i===0? 5 : i===1? 2 : 0;
        interestPaymentBoxes[bid] = { totalPaid: Math.round(quarterlyInterest*paidQuarters), payments:{} };
      }
    }

    // ---- Phương án 4: ĐƯỢC GIA HẠN NỢ — nguồn Cấp tỉnh/thành phố, kỳ hạn 2 năm ----
    // Hạn GỐC đã trôi qua (đáng lẽ quá hạn), nhưng nhờ có 1 lần gia hạn nên hệ thống hiển thị đúng là
    // "đang gia hạn" (không còn là quá hạn) — hạn MỚI (sau gia hạn) còn khoảng 3 tháng nữa.
    {
      const origDueDate = addDays(today, -25); // hạn gốc đã qua 25 ngày
      const loanDate = addYears(origDueDate, -2);
      const newDueDate = addDays(today, 95); // hạn sau khi gia hạn
      const pid = nextPid();
      const totalCapital = 400000000;
      const n = 10, per = totalCapital/n;
      projects.push({ id:pid, name:'Nuôi gà thả vườn hữu cơ', totalCapital, disburseDate:fmt(loanDate), dueDate:fmt(origDueDate),
        fundSourceType:'Cấp tỉnh/thành phố', fundSourceOther:'', interestRate:6.6, splitCentral:0, splitProvince:4.32, splitWard:2.28, hamletAllocPercent:45,
        createdAt:loanDate.toISOString(), updatedAt:loanDate.toISOString(), deleted:false });
      for(let i=0;i<n;i++){
        const bid = nextBid();
        borrowers.push({ id:bid, name:NAMES[i], birthYear:String(1972+i*2), cccd:String(79300000000+i*4444), phone:'09'+(40000000+i*44444),
          address:'', preMergerAddress:'', industry:'Chăn nuôi', repayAbility:'Trung bình', guarantor:'',
          projectId:pid, hamlet:hamlets[i%hamlets.length], principal:per, rate:6.6,
          loanDate:fmt(loanDate), dueDate:fmt(origDueDate), fundSource:'Cấp tỉnh/thành phố',
          splitCentral:0, splitProvince:4.32, splitWard:2.28, hamletAllocPercent:45,
          checked:false, note:'', prevBalance:0, interestPaid:0, principalPaid:0, isExtended:true, extensionDueDate:fmt(newDueDate), deleted:false });
        const quarterlyInterest = per*6.6/100/4;
        const paidQuarters = i%3===0? 8 : i%3===1? 3 : 0;
        interestPaymentBoxes[bid] = { totalPaid: Math.round(quarterlyInterest*paidQuarters), payments:{} };
        loanExtensions[bid] = [{
          from: fmt(origDueDate), to: fmt(newDueDate), rateType:'same', ratePct:6.6, allocMode:'wardHamlet',
          hamletAllocPercent:45, splitCentral:null, splitProvince:null, splitWard:null,
          savedAt: today.toISOString(), savedBy:'demo@example.com', savedByName:'Khách tham quan',
        }];
      }
    }

    return {
      config: {
        wardName:'Hưng Phước', adminLevel:'Xã', subAdminType:'Ấp',
        provinceType:'Thành phố', provinceName:'Đồng Nai',
        officerTitle:'Chủ tịch Hội Nông dân', ownerEmail:'demo@example.com',
        hamlets, hamletsOld:[], projects: projects.map(p=>p.name),
        quarters: JSON.parse(JSON.stringify(DEFAULT_QUARTERS)),
        retainPercent:30, accessCode:'', accessVersion:0, deleted:false,
        publicPerms:{data:'edit', members:'edit', strength:'edit', internal:'edit'}, grants:{}, secretId:'demo',
      },
      borrowers, loanProjects: projects,
      expenses: [
        {id:'e1', date: fmt(addDays(today,-20)), amount:500000, purpose:CAT_MEETING, hamlet:'', purposeOther:'', note:'Họp giao ban quý (mẫu)'},
      ],
      trash: [], log: [], interestPaymentBoxes, loanExtensions,
    };
  }
  function enterPreviewMode(){
    const demo = buildDemoState();
    detachRealtime();
    state.previewMode = true;
    state.accessMode = ACCESS_MODES.TOUR;
    clearWardGuestSession();
    state.identity = { name:'Khách tham quan', email:null, photo:'', wardId:'demo' };
    state.config = demo.config;
    state.borrowers = demo.borrowers;
    state.loanProjects = demo.loanProjects;
    state.expenses = demo.expenses;
    state.trash = demo.trash;
    state.log = demo.log;
    state.interestPaymentBoxes = demo.interestPaymentBoxes;
    state.loanExtensions = demo.loanExtensions;
    state.activeTab = 'dashboard';
    resetTabScrollMemory(); // phiên mới: bỏ trí nhớ cuộn của phiên trước
    state.view = 'app';
    state._showPreviewWelcome = true; // yêu cầu 5: bật popup chào mừng ngay lần vào đầu tiên
    render();
  }
  function exitPreviewMode(){
    state.previewMode = false;
    state.accessMode = ACCESS_MODES.SIGNED_OUT;
    clearWardGuestSession();
    state.identity = null;
    state.config=null; state.borrowers=[]; state.loanProjects=[]; state.borrowerColumnPrefsShared=null; state.borrowerVisibleCols=null; state.borrowerColumnOrder=null; state.filterHamlets=null; state.filterProjectIds=null; state.filterFundSources=null; state.filterManagerIds=null; state.filterQuarters=null; state.filterQuartersAdvanced=false; state.filterYears=null; state.filterYearsAdvanced=false; state.mainTimeline=null; state.openFilterDropdown=null; state.surveys=[]; state.expenses=[]; state.trash=[]; state.log=[]; state.interestPaymentBoxes=null; state.loanExtensions=null;
    state.view = 'login';
    render();
  }

  // Vào xem/làm việc với 1 mã xã đã có trong Ví (không cần hỏi lại mật khẩu).
  async function enterWard(wid){
    state.accessMode = hasAuthenticatedIdentity() ? ACCESS_MODES.GOOGLE : ACCESS_MODES.WARD_GUEST;
    state.identity.wardId = wid;
    setActiveWardCache(wid);
    lset(IDENTITY_KEY, state.identity);
    state.config = await cGetOnce('config', null);
    if(!state.config){ state.view = 'onboarding'; render(); return; }
    if(state.config.deleted){
      alert('Mã xã này hiện đã bị Chủ mã xoá.');
      state.identity.wardId = ''; setActiveWardCache('');
      await loadWallet();
      state.view = 'wallet'; render();
      return;
    }
    resetTabScrollMemory(); // phiên mới: bỏ trí nhớ cuộn của phiên trước
    state.view = 'app';
    state._showWardWelcome = true;
    attachRealtime();
    render();
  }

  // Yêu cầu 2: cho phép Chủ mã đổi hẳn TÊN Mã định danh đang dùng (kể cả từ mã ngẫu nhiên 4 ký tự
  // sang tên tự chọn). Nhờ kiến trúc "Mã ẩn" (secretId) bảo lãnh dữ liệu thật, việc đổi tên CHỈ cần
  // di chuyển đúng 1 "con trỏ" (config) nhỏ gọn sang wardId mới — TOÀN BỘ dữ liệu thật (hộ vay, chi
  // tiêu, thùng rác, nhật ký...) ở secretdata/{secretId}/... không hề bị đụng tới, tuyệt đối an toàn.
  // Đổi tên mã định danh — bản TỔNG QUÁT, áp dụng được cho BẤT KỲ mã nào (không nhất thiết là mã
  // đang dùng), dùng chung cho cả nút "Đổi tên mã" trong tab Cài đặt lẫn trong bảng thông tin mã
  // định danh ở Ví mã xã. Nếu mã đang đổi tên CHÍNH LÀ mã đang dùng thì mới chuyển hẳn sang tên mới.
  async function renameWardGeneric(oldWid, newWidRaw, cfgSnapshot){
    const newWid = normalizeWardIdStr(newWidRaw);
    if(!newWid || newWid.length<3){ alert('Vui lòng nhập Mã định danh hợp lệ (tối thiểu 3 ký tự, chỉ gồm chữ thường/số/gạch dưới/gạch ngang).'); return false; }
    if(newWid === oldWid){ alert('Mã mới trùng với mã hiện tại, không có gì để đổi.'); return false; }
    if(await isWardIdTaken(newWid)){ alert('Mã này đã bị trùng với mã hiện có, hoặc trong thùng rác của ai đó, vui lòng thay đổi ký tự!'); return false; }
    if(!confirm(`Đổi tên mã định danh từ "${oldWid}" sang "${newWid}"?\n\nDữ liệu (hộ vay, chi tiêu, nhật ký...) hoàn toàn KHÔNG bị ảnh hưởng — luôn được "Mã ẩn" cố định phía sau bảo lãnh nguyên vẹn. Các Khách đang dùng mã cũ để tham gia sẽ cần được đồng chí cung cấp lại mã mới "${newWid}" để tiếp tục truy cập. Đồng chí có chắc chắn?`)) return false;
    const movedCfg = { ...cfgSnapshot }; // chỉ copy "con trỏ" — secretId bên trong giữ nguyên, không đổi
    await rtdb.ref(`data/${newWid}/config`).set(movedCfg);
    syncWardIndex(newWid, movedCfg);
    if(movedCfg.secretId) await rtdb.ref(`secret_ward_map/${movedCfg.secretId}`).set(newWid);
    await rtdb.ref(`data/${oldWid}`).remove(); // chỉ xoá con trỏ cũ, KHÔNG đụng tới secretdata/
    removeWardIndex(oldWid);
    const emailKey = emailToKey(state.identity.email);
    await rtdb.ref(`users/${emailKey}/wards/${oldWid}`).remove();
    await rtdb.ref(`users/${emailKey}/wards/${newWid}`).set({kind:'owner', wardName:movedCfg.wardName||'', addedAt:new Date().toISOString()});
    await pushLog('đổi tên mã định danh', `${oldWid} → ${newWid}`); // secretId không đổi nên nhật ký vẫn đúng chỗ
    if(wardId()===oldWid){
      detachRealtime();
      state.identity.wardId = newWid;
      setActiveWardCache(newWid);
      lset(IDENTITY_KEY, state.identity);
      await enterWard(newWid);
    } else {
      await loadWallet();
    }
    return newWid;
  }
  async function renameOwnWardId(newWidRaw){
    const result = await renameWardGeneric(wardId(), newWidRaw, state.config);
    return !!result;
  }

  // Rời mã xã đang xem, quay về Ví mã xã (KHÔNG đăng xuất tài khoản Google)
  async function exitToWallet(){
    detachRealtime();
    const wasAdminViewing = !!state._adminViewingWard;
    state._adminViewingWard = false;
    state.identity.wardId = '';
    if(!wasAdminViewing) setActiveWardCache(''); // Admin chỉ "xem thử" thì giữ nguyên cache mã thật của họ
    lset(IDENTITY_KEY, state.identity);
    state.config = null; state.borrowers=[]; state.loanProjects=[]; state.borrowerColumnPrefsShared=null; state.borrowerVisibleCols=null; state.borrowerColumnOrder=null; state.filterHamlets=null; state.filterProjectIds=null; state.filterFundSources=null; state.filterManagerIds=null; state.filterQuarters=null; state.filterQuartersAdvanced=false; state.filterYears=null; state.filterYearsAdvanced=false; state.mainTimeline=null; state.openFilterDropdown=null; state.surveys=[]; state.expenses=[]; state.trash=[]; state.log=[]; state.collaborators={};
    await loadWallet();
    state.view = 'wallet';
    render();
  }

  // ---- Xoá / khôi phục mã xã (chuỗi 3 tầng: đang dùng -> thùng rác cá nhân -> thùng rác hệ thống) ----
  async function ownerDeleteWard(wid){
    const w = state.myWards.find(x=>x.wardId===wid);
    if(!confirm(`Xoá mã xã "${wid}"${w&&w.wardName?` (${w.wardName})`:''}? Dữ liệu sẽ mất theo mã này khỏi giao diện làm việc (và văng toàn bộ Khách đang sài ké ra ngoài) — muốn khôi phục, vào mục "🗑️ Mã xã đã xoá của tôi" (Thùng rác chứa mã). Đồng chí có chắc chắn?`)) return;
    const cfg = await cGetOnceFor(wid, 'config', {});
    cfg.deleted = true; cfg.deletedAt = new Date().toISOString(); cfg.deletedBy = state.identity.email;
    await wrefFor(wid, 'config').set(cfg);
    syncWardIndex(wid, cfg);
    const emailKey = emailToKey(state.identity.email);
    await rtdb.ref(`users/${emailKey}/wards/${wid}`).remove();
    await rtdb.ref(`users/${emailKey}/deletedWards/${wid}`).set({wardId:wid, wardName:cfg.wardName||(w&&w.wardName)||'', deletedAt:new Date().toISOString()});
    const wasActive = wardId()===wid;
    await loadWallet();
    // Yêu cầu 2 (trường hợp đặc biệt): nếu vừa xoá xong mà không còn làm Chủ của bất kỳ mã nào nữa
    // -> lập tức tự động cấp một Mã định danh ngẫu nhiên mới để họ luôn có nơi lưu dữ liệu.
    const stillOwnsAny = state.myWards.some(x=>x.kind==='owner');
    if(!stillOwnsAny){
      detachRealtime();
      state._onboardingReturnView = 'wallet';
      await createRandomWardAndOnboard();
      alert('Mã định danh ngẫu nhiên mới đã được tự động tạo để đồng chí lưu cơ sở dữ liệu hoàn toàn mới, đồng chí có thể đổi tên mã ngẫu nhiên này bất cứ lúc nào trong phần Cài đặt.');
      return;
    }
    if(wasActive){ await kickToWalletSilent(); } else { render(); }
  }
  async function guestRemoveWard(wid){
    if(!confirm('Xoá mã xã này khỏi danh sách của đồng chí? Đồng chí có thể tham gia lại bất cứ lúc nào bằng đúng mã xã (và mật khẩu, nếu có).')) return;
    await rtdb.ref(`users/${emailToKey(state.identity.email)}/wards/${wid}`).remove();
    if(wardId()===wid){ await kickToWalletSilent(); } else { await loadWallet(); render(); }
  }
  async function kickToWalletSilent(){
    detachRealtime();
    state.identity.wardId = ''; setActiveWardCache('');
    state.config = null; state.borrowers=[]; state.loanProjects=[]; state.borrowerColumnPrefsShared=null; state.borrowerVisibleCols=null; state.borrowerColumnOrder=null; state.filterHamlets=null; state.filterProjectIds=null; state.filterFundSources=null; state.filterManagerIds=null; state.filterQuarters=null; state.filterQuartersAdvanced=false; state.filterYears=null; state.filterYearsAdvanced=false; state.mainTimeline=null; state.openFilterDropdown=null; state.surveys=[]; state.expenses=[]; state.trash=[]; state.log=[]; state.collaborators={};
    await loadWallet();
    state.view = 'wallet'; render();
  }
  async function restoreDeletedWard(wid){
    const entry = state.myDeletedWards.find(x=>x.wardId===wid);
    const cfg = await cGetOnceFor(wid, 'config', null);
    if(cfg){ cfg.deleted=false; delete cfg.deletedAt; delete cfg.deletedBy; await wrefFor(wid,'config').set(cfg); syncWardIndex(wid, cfg); }
    const emailKey = emailToKey(state.identity.email);
    await rtdb.ref(`users/${emailKey}/deletedWards/${wid}`).remove();
    await rtdb.ref(`users/${emailKey}/wards/${wid}`).set({kind:'owner', wardName:(cfg&&cfg.wardName)||(entry&&entry.wardName)||'', addedAt:new Date().toISOString()});
    await loadWallet(); render();
  }
  async function purgeDeletedWardToSuperadmin(wid){
    if(!confirm('Xoá vĩnh viễn: mã này sẽ KHÔNG còn trong thùng rác của đồng chí nữa (chỉ Quản trị viên trang web mới khôi phục được cho đồng chí). Dữ liệu thật vẫn được "Mã ẩn" bảo lãnh an toàn tuyệt đối. Đồng chí có chắc chắn?')) return;
    const entry = state.myDeletedWards.find(x=>x.wardId===wid);
    // Chụp lại TOÀN BỘ "con trỏ" config (bao gồm Mã ẩn/secretId) NGAY LÚC NÀY — vì kể từ khi vào
    // Thùng rác hệ thống, chuỗi wid này được coi là "thả tự do" nên CÓ THỂ bị người khác xin lại để
    // tạo mã mới (ghi đè lên data/{wid}/config). Nhờ lưu sẵn snapshot này, sau này khôi phục vẫn luôn
    // dựng lại đúng con trỏ trỏ về ĐÚNG secretId cũ — dữ liệu thật không bao giờ bị ảnh hưởng.
    const cfgSnapshot = await cGetOnceFor(wid, 'config', null);
    await rtdb.ref(`superadmin/trashWards/${wid}`).set({
      wardId:wid, wardName:(entry&&entry.wardName)||(cfgSnapshot&&cfgSnapshot.wardName)||'',
      ownerEmail: state.identity.email, deletedAt:new Date().toISOString(),
      configSnapshot: cfgSnapshot || null,
    });
    await rtdb.ref(`users/${emailToKey(state.identity.email)}/deletedWards/${wid}`).remove();
    await loadWallet(); render();
  }
  // ---- Thùng rác hệ thống (chỉ Chủ trang web) ----
  async function superRestoreWard(wid){
    if(!isAdmin()) return;
    const entry = state.sysTrash.find(x=>x.wardId===wid);
    if(!entry) return;
    // Yêu cầu 1: mã trong Thùng rác hệ thống được coi là "đã thả tự do" nên rất có thể đã bị người
    // khác tạo trùng trong lúc chờ khôi phục. Trước khi khôi phục, phải dò xem có bị trùng không
    // (kể cả trong thùng rác cá nhân của bất kỳ ai); nếu trùng thì tự đổi tên "con trỏ" theo công
    // thức "tênmã + 001", nếu vẫn trùng thì tăng dần 002, 003... Nhờ dữ liệu thật luôn được "Mã ẩn"
    // (secretId) cố định bảo lãnh — hoàn toàn tách biệt khỏi chuỗi wardId — nên dù có bị đổi tên con
    // trỏ, dữ liệu gốc (hộ vay, chi tiêu, nhật ký...) vẫn nguyên vẹn 100%, không hề bị mất hay lẫn
    // với dữ liệu của người đang chiếm cái tên cũ.
    let finalWid = wid;
    let renamed = false;
    if(await isWardIdTaken(wid)){
      renamed = true;
      let n = 1;
      while(await isWardIdTaken(`${wid}${String(n).padStart(3,'0')}`)) n++;
      finalWid = `${wid}${String(n).padStart(3,'0')}`;
    }
    if(entry.configSnapshot){
      // Dựng lại đúng "con trỏ" trỏ về ĐÚNG Mã ẩn (secretId) cũ -> toàn bộ dữ liệu thật hiện ra
      // nguyên vẹn ngay lập tức, bất kể con trỏ dùng tên nào.
      const restoredCfg = { ...entry.configSnapshot, deleted:false };
      delete restoredCfg.deletedAt; delete restoredCfg.deletedBy;
      await rtdb.ref(`data/${finalWid}/config`).set(restoredCfg);
      syncWardIndex(finalWid, restoredCfg);
      // Cập nhật lại con trỏ ngược secretId -> wardId (phục vụ Firebase Rules bảo mật)
      if(restoredCfg.secretId) await rtdb.ref(`secret_ward_map/${restoredCfg.secretId}`).set(finalWid);
    }
    if(renamed){
      alert(`Lưu ý: mã "${wid}" hiện đã có người khác đang sử dụng (do đã được thả tự do khi đưa vào Thùng rác hệ thống), nên con trỏ khôi phục sẽ dùng tên mới "${finalWid}". Yên tâm: TOÀN BỘ dữ liệu gốc (hộ vay, chi tiêu, nhật ký...) vẫn còn nguyên vẹn 100% vì luôn được "Mã ẩn" cố định bảo lãnh — hoàn toàn không bị mất hay lẫn với mã đang hoạt động kia.`);
    }
    await rtdb.ref(`users/${emailToKey(entry.ownerEmail)}/deletedWards/${finalWid}`).set({wardId:finalWid, wardName:(entry.configSnapshot&&entry.configSnapshot.wardName)||entry.wardName||'', deletedAt: entry.deletedAt||new Date().toISOString()});
    await rtdb.ref(`superadmin/trashWards/${wid}`).remove();
    await loadWallet(); render();
  }
  async function superPurgeForever(wid){
    if(!isAdmin()) return;
    if(!confirm('XOÁ VĨNH VIỄN — TOÀN BỘ dữ liệu (hộ vay, chi tiêu, nhật ký, cộng tác viên...) của mã xã này trên đám mây sẽ bị xoá sạch, KHÔNG THỂ khôi phục. Đồng chí có chắc chắn tuyệt đối?')) return;
    try{
      // Dữ liệu thật nằm ở secretdata/{secretId}/... (không phải data/{wid}/...) — phải lấy đúng
      // Mã ẩn từ snapshot đã chụp lúc đưa vào Thùng rác hệ thống để xoá đúng chỗ.
      const entry = state.sysTrash.find(x=>x.wardId===wid);
      const sid = entry && entry.configSnapshot && entry.configSnapshot.secretId;
      if(sid) await rtdb.ref(`secretdata/${sid}`).remove();
      await rtdb.ref(`data/${wid}`).remove();
      removeWardIndex(wid);
      await rtdb.ref(`superadmin/trashWards/${wid}`).remove();
      await loadWallet(); render();
    }catch(e){
      console.error('superPurgeForever lỗi:', e);
      alert(`Không thể xoá vĩnh viễn mã "${wid}" — Firebase từ chối yêu cầu này (${e && e.message ? e.message : 'lỗi không rõ'}). Nguyên nhân thường gặp nhất là Quy tắc bảo mật (Security Rules) trên Firebase chưa cấp quyền ghi/xoá cho tài khoản Admin ở nhánh "superadmin/", "data/" hoặc "secretdata/". Vui lòng kiểm tra lại Firebase Rules.`);
    }
  }

  async function boot(){
    state.view = 'boot'; render();
    // Đảm bảo Local Persistence đã được thiết lập xong TRƯỚC KHI Firebase Auth khôi phục phiên
    // đăng nhập cũ — tránh trường hợp hiếm gặp bị lệch thời điểm khiến phiên không được khôi phục.
    await authPersistenceReady;
    // Lắng nghe trạng thái đăng nhập Google thật qua Firebase Auth.
    // Không còn cho phép gõ tay tên/email — email lấy trực tiếp từ tài khoản
    // Google đã xác thực, dùng để đối chiếu phân quyền Owner/Editor/Viewer/Khách.
    auth.onAuthStateChanged(async (user) => {
      if(!user){
        detachRealtime();
        detachKnowledgeRealtime();
        detachSurveysRealtime();
        state.identity = null; lset(IDENTITY_KEY, null);
         state.accessMode = ACCESS_MODES.SIGNED_OUT;
         state.guestSessionId = null;
        state.config = null; state.borrowers=[]; state.loanProjects=[]; state.borrowerColumnPrefsShared=null; state.borrowerVisibleCols=null; state.borrowerColumnOrder=null; state.filterHamlets=null; state.filterProjectIds=null; state.filterFundSources=null; state.filterManagerIds=null; state.filterQuarters=null; state.filterQuartersAdvanced=false; state.filterYears=null; state.filterYearsAdvanced=false; state.mainTimeline=null; state.openFilterDropdown=null; state.surveys=[]; state.surveySpace='personal'; state.surveyView='list'; state.surveyDraft=null; state.surveyEditingId=null; state.expenses=[]; state.trash=[]; state.log=[]; state.collaborators={};
        state.myWards=[]; state.myDeletedWards=[]; state.sysTrash=[];
        state.admins={}; state.aiChats=[]; state.aiActiveChatId=null; state._aiChatOpen=false; state._adminViewingWard=false;
        state.propagandaChats=[]; state.propagandaActiveChatId=null; state._propagandaChatsLoaded=false; state.propagandaPendingAttachments=[];
        state.knowledgeTree={}; state.knowledgeCurrentFolder=null; state.knowledgeTrashOpen=false;
        state._quickNoteOpen=false; state._quickNoteCache=null;
        state.view = 'login';
        render();
        return;
      }
      const email = (user.email||'').toLowerCase().trim();
      if(!email){
        alert('Tài khoản Google này không trả về địa chỉ email công khai. Vui lòng đăng nhập bằng một tài khoản Google khác.');
        await auth.signOut();
        return;
      }
       state.identity = { uid:user.uid || '', name: user.displayName || email, email, photo: user.photoURL || '', wardId:'' };
       state.accessMode = ACCESS_MODES.GOOGLE;
      lset(IDENTITY_KEY, state.identity);
      migrateLegacyPersonalDataToUid().catch(e=>console.warn('Migration kho cá nhân UID bị bỏ qua:',e));
      ensureAccountSecretId(); // không cần chờ — chạy nền, không ảnh hưởng luồng hiển thị
      await loadWallet();
      const cachedActive = lget(activeWardCacheKey(email), '');
      const stillHave = cachedActive && state.myWards.some(w=>w.wardId===cachedActive && !(w.live && w.live.deleted));
      if(stillHave){ await enterWard(cachedActive); return; }
      if(!lget(seenWelcomeKey(email), false) && state.myWards.length===0){
        state.view = 'welcome';
        render();
        return;
      }
      state.view = 'wallet';
      render();
    });
  }

  // ---------- interest engine ----------
  function periodRange(){
    if(state.reportMode==='quarter'){
      return resolveQuarterDates(state.reportQuarter);
    }
    return { from: state.reportFrom, to: state.reportTo };
  }
  function calcInterest(b, from, to){
    if(!from || !to) return {days:0, interest:0, due:0};
    const days = Math.max(0, daysBetween(from, to));
    const rate = parseFloat(b.rate)||0;
    const principal = parseFloat(b.principal)||0;
    const interest = principal * (rate/100) * (days/365);
    const prev = parseFloat(b.prevBalance)||0;
    return { days, interest: Math.round(interest), due: Math.round(interest + prev) };
  }
  function interestStatus(b, due){
    const paid = parseFloat(b.interestPaid)||0;
    const diff = Math.round(paid - due);
    if(diff===0) return {label:'Đã đóng đủ', cls:'pill-green', diff:0};
    if(diff<0) return {label:`Còn thiếu ${money(-diff)}`, cls:'pill-red', diff};
    return {label:`Đóng thừa ${money(diff)}`, cls:'pill-orange', diff};
  }
  function principalStatus(b){
    const principal = parseFloat(b.principal)||0;
    const paid = parseFloat(b.principalPaid)||0;
    const diff = Math.round(paid - principal);
    if(diff===0) return {label:'Đã đóng đủ', cls:'pill-green'};
    if(diff<0) return {label:`Còn thiếu ${money(-diff)}`, cls:'pill-red'};
    return {label:`Đóng thừa ${money(diff)}`, cls:'pill-orange'};
  }

  // ---------- notifications engine ----------
  function computeAlerts(){
    const alerts = [];
    const today = new Date(todayStr());
    if(!state.config) return alerts;
    // quarter end reminder (interest)
    Object.entries(state.config.quarters||DEFAULT_QUARTERS).forEach(([qk,q])=>{
      const resolved = resolveQuarterDates(qk);
      if(!resolved.to) return;
      const d = daysBetween(todayStr(), resolved.to);
      if(d===15 || (d>=0 && d<=15)){
        alerts.push({color:'orange', text:`Sắp hết ${q.label||qk.toUpperCase()} (còn ${d} ngày) — nhắc thu lãi định kỳ`, key:'q-'+qk});
      }
    });
    state.borrowers.forEach(b=>{
      if(b.dueDate){
        const d = daysBetween(todayStr(), b.dueDate);
        if(d>=0 && d<=15) alerts.push({color:'red', text:`Gốc của ${b.name} (${b.hamlet}) đến hạn còn ${d} ngày`, key:'p-'+b.id});
        else if(d>0 && d<=30) alerts.push({color:'orange', text:`Gốc của ${b.name} (${b.hamlet}) đến hạn còn ${d} ngày`, key:'p-'+b.id});
        else if(d>0 && d<=60) alerts.push({color:'yellow', text:`Gốc của ${b.name} (${b.hamlet}) đến hạn còn ${d} ngày`, key:'p-'+b.id});
      }
    });
    return alerts;
  }
  function dashboardCounts(alerts){
    // one borrower counted at its most severe color among principal/extension alerts
    const sevMap = {};
    alerts.forEach(a=>{
      if(!a.key.startsWith('p-') && !a.key.startsWith('e-')) return;
      const id = a.key.slice(2);
      const rank = {yellow:1, orange:2, red:3};
      if(!sevMap[id] || rank[a.color] > rank[sevMap[id]]) sevMap[id] = a.color;
    });
    const counts = {yellow:0, orange:0, red:0};
    Object.values(sevMap).forEach(c=>counts[c]++);
    return counts;
  }

  // ---------- accounting engine (Thu - Chi cấp Xã) ----------
  function acctPeriodRange(mode, quarterKey, prefix){
    mode = mode || state.acctMode; quarterKey = quarterKey || state.acctQuarter; prefix = prefix || 'exp';
    if(mode==='all') return { from:'2000-01-01', to: todayStr() };
    if(mode==='quarter'){
      // "Chọn Quý cụ thể" — dùng ĐÚNG bộ lọc thống nhất mới (danh sách liên tục theo dòng thời gian
      // thật) — về bản chất KHÔNG THỂ có khoảng trống nữa, không cần xử lý gì thêm.
      const quarterSet = timelineFilterToQuarterSet(prefix);
      const { from, to } = timelineFilterToDateRange(prefix);
      return { from, to, quarterSet };
    }
    if(mode==='yprev'){
      const y = new Date().getFullYear()-1;
      const q4r = resolveQuarterDatesForYear('q4', y);
      const q1r = resolveQuarterDatesForYear('q1', y);
      return { from:q1r.from, to:q4r.to };
    }
    // 'ycur' (mặc định, hoặc giá trị 'year' cũ trước đây) — Cả năm hiện tại: từ đầu Quý 1 đến cuối Quý 4.
    const q4r = resolveQuarterDates('q4');
    const q1r = resolveQuarterDates('q1');
    return { from:q1r.from, to:q4r.to };
  }
  // =====================================================================
  // Tính "Thu" của Sổ Thu Chi Lãi Quỹ — dùng ĐÚNG CÙNG 1 logic với "Thống kê phân bổ tiền lãi các cấp"
  // (theo tỷ lệ % phân bổ RIÊNG của TỪNG khoản vay, chỉ tính các Quý ĐÃ THỰC SỰ đóng lãi/đã phê duyệt)
  // — thay thế hoàn toàn công thức retainPercent chung chung cũ (vốn không khớp với Sổ vay vốn).
  // hamletFilter: null = không lọc (tính tất cả địa bàn); mảng tên địa bàn = chỉ tính các địa bàn đó.
  // quarterSet: mảng các {qk,year} cần tính — null = tính TẤT CẢ (luỹ kế từ trước đến nay).
  // =====================================================================
  function computeInterestIncomeStats(hamletFilter, quarterSet){
    const list = state.borrowers.filter(b=> !b.deleted && (!hamletFilter || hamletFilter.includes(b.hamlet)));
    const inScope = (qk, year)=>{
      if(!quarterSet) return true; // không lọc theo Quý -> tính luỹ kế toàn bộ
      return quarterSet.some(q=> q.qk===qk && q.year===year);
    };
    let central=0, province=0, ward=0, hamletTotal=0;
    const hamletByName = {}; // {tên địa bàn: số tiền phân bổ về Khu dân cư/Ấp của riêng địa bàn đó}
    list.forEach(b=>{
      const disp = computeInterestPaymentBoxDisplay(b);
      let bTotal = 0;
      disp.allBoxes.forEach(bx=>{
        if(!disp.paidKeys.has(bx.key)) return; // chỉ tính Quý ĐÃ đóng lãi (đã phê duyệt)
        if(!inScope(bx.qk, bx.year)) return;
        bTotal += bx.interestAmount;
      });
      if(bTotal<=0) return;
      const rate = parseFloat(b.rate)||0;
      if(rate<=0) return;
      const c = bTotal*(parseFloat(b.splitCentral)||0)/rate;
      const p = bTotal*(parseFloat(b.splitProvince)||0)/rate;
      const w = bTotal*(parseFloat(b.splitWard)||0)/rate;
      const h = w*(parseFloat(b.hamletAllocPercent)||0)/100;
      central+=c; province+=p; ward+=w; hamletTotal+=h;
      const hName = b.hamlet || '—';
      hamletByName[hName] = (hamletByName[hName]||0) + h;
    });
    return { central, province, ward, hamletTotal, hamletByName };
  }
  // Chuyển đổi 1 khoảng ngày (from/to, kiểu chuỗi 'YYYY-MM-DD') thành danh sách các {qk,year} — dùng để
  // tính "Thu" đúng phạm vi kỳ hạch toán đang chọn (Quý này/Năm này/Từ trước tới nay) của module.
  function quarterSetFromDateRange(from, to){
    if(!from || !to || from==='2000-01-01') return null; // chế độ "Từ trước đến nay" (hoặc dữ liệu chưa hợp lệ) -> không lọc, tính luỹ kế toàn bộ
    const q = state.config.quarters || DEFAULT_QUARTERS;
    const result = [];
    const pad = n=> String(n).padStart(2,'0');
    Object.keys(q).forEach(qk=>{
      const item = q[qk] || DEFAULT_QUARTERS[qk];
      if(!item || item.startMonth==null || item.endMonth==null) return;
      // Xét TỪNG Quý đã cấu hình (q1..q4) của TỪNG năm xuất hiện trong khoảng from->to — vì cấu hình
      // Quý chỉ lưu ngày/tháng (không có năm cụ thể), suy ra năm từ chính khoảng from/to đang xét.
      const fromYear = parseInt(from.slice(0,4),10);
      const toYear = parseInt(to.slice(0,4),10);
      for(let y=fromYear; y<=toYear; y++){
        // Ước lượng khoảng ngày thực tế của Quý qk trong năm y (dùng đúng tháng-ngày đã cấu hình, ghép với năm y).
        const startMD = `${pad(item.startMonth)}-${pad(item.startDay)}`;
        const endMD = `${pad(item.endMonth)}-${pad(item.endDay)}`;
        const qStart = `${y}-${startMD}`;
        const qEnd = `${y}-${endMD}`;
        if(qStart<=to && qEnd>=from) result.push({ qk, year:y });
      }
    });
    return result;
  }
  // Kiểm tra 1 ngày có rơi vào ĐÚNG 1 trong các Quý thuộc quarterSet hay không — dùng khi lọc theo tập
  // hợp Quý+Năm CỤ THỂ (có thể không liền kề nhau), tránh gồm nhầm khoảng trống giữa các Quý đã chọn.
  function dateFallsInQuarterSet(dateStr, quarterSet){
    if(!dateStr) return false;
    return quarterSet.some(({qk,year})=>{
      const r = resolveQuarterDatesForYear(qk, year);
      return r.from && r.to && dateStr>=r.from && dateStr<=r.to;
    });
  }
  // =====================================================================
  // Đối chiếu "Trích về Ấp" — theo TỪNG QUÝ, KHÔNG phụ thuộc bộ lọc kỳ hạch toán nào (luôn tính toàn bộ
  // thời gian từ trước tới nay) — dùng 1 lượt duyệt duy nhất qua toàn bộ người vay để tính số tự động
  // (nhanh hơn nhiều so với gọi lặp lại computeInterestIncomeStats cho từng cặp Ấp+Quý riêng lẻ).
  // =====================================================================
  function computeHamletQuarterReconciliation(){
    const hamlets = state.config.hamlets||[];
    // ---- Số tự động theo công thức (khớp Sổ vay vốn), gộp theo {Ấp: {Quý: số tiền}} ----
    const autoByHamletQuarter = {};
    state.borrowers.filter(b=>!b.deleted).forEach(b=>{
      const rate = parseFloat(b.rate)||0;
      if(rate<=0) return;
      const disp = computeInterestPaymentBoxDisplay(b);
      const hName = b.hamlet || '—';
      disp.allBoxes.forEach(bx=>{
        if(!disp.paidKeys.has(bx.key)) return;
        const w = bx.interestAmount*(parseFloat(b.splitWard)||0)/rate;
        const h = w*(parseFloat(b.hamletAllocPercent)||0)/100;
        if(h<=0) return;
        const qk2 = `${bx.qk}_${bx.year}`;
        if(!autoByHamletQuarter[hName]) autoByHamletQuarter[hName] = {};
        autoByHamletQuarter[hName][qk2] = (autoByHamletQuarter[hName][qk2]||0) + h;
      });
    });
    // ---- Số tiền + số lượng bản ghi ĐÃ CHI thực tế, gộp theo {Ấp: {Quý: {amount, count}}} ----
    const actualByHamletQuarter = {};
    state.expenses.filter(e=>!e.deleted && isCatHamlet(e.purpose) && Array.isArray(e.quarters)).forEach(e=>{
      const hName = e.hamlet || '—';
      e.quarters.forEach(q=>{
        const qk2 = `${q.qk}_${q.year}`;
        if(!actualByHamletQuarter[hName]) actualByHamletQuarter[hName] = {};
        if(!actualByHamletQuarter[hName][qk2]) actualByHamletQuarter[hName][qk2] = { amount:0, count:0 };
        actualByHamletQuarter[hName][qk2].amount += (parseFloat(e.amount)||0);
        actualByHamletQuarter[hName][qk2].count += 1;
      });
    });
    // ---- Luôn liệt kê ĐỦ mọi Ấp đã cấu hình + mọi Ấp xuất hiện trong dữ liệu (phòng trường hợp Ấp cũ
    // đã bị xoá khỏi cấu hình nhưng vẫn còn dữ liệu lịch sử) — không phụ thuộc bộ lọc nào. ----
    const allHamletNames = Array.from(new Set([...hamlets, ...Object.keys(autoByHamletQuarter), ...Object.keys(actualByHamletQuarter)])).sort((a,b)=>a.localeCompare(b,'vi'));
    const rows = allHamletNames.map(h=>{
      const autoMap = autoByHamletQuarter[h]||{};
      const actualMap = actualByHamletQuarter[h]||{};
      const allQuarterKeys = Array.from(new Set([...Object.keys(autoMap), ...Object.keys(actualMap)]))
        .filter(qk2=> timelineSeqIndex(qk2)!=null)
        .sort((a,b)=> timelineSeqIndex(a)-timelineSeqIndex(b));
      let totalDiff=0, dupQuarterCount=0, dupTotalOccurrences=0;
      const deficitLines=[], surplusLines=[], dupDetails=[];
      allQuarterKeys.forEach(qk2=>{
        const auto = Math.round(autoMap[qk2]||0);
        const act = actualMap[qk2] || { amount:0, count:0 };
        const actual = Math.round(act.amount);
        const label = TIMELINE_SEQ[timelineSeqIndex(qk2)].label;
        if(act.count>1){ dupQuarterCount++; dupTotalOccurrences += (act.count-1); dupDetails.push({ label, times: act.count-1 }); }
        const diff = actual - auto;
        if(diff===0) return;
        totalDiff += diff;
        if(diff<0) deficitLines.push(`${label}: thiếu ${money(-diff)}`);
        else surplusLines.push(`${label}: dư ${money(diff)}`);
      });
      return { hamlet:h, dupQuarterCount, dupTotalOccurrences, totalDiff, deficitLines, surplusLines, dupDetails };
    });
    return rows;
  }

  function computeAcctTotals(from, to, explicitQuarterSet){
    // "Thu" giờ dùng ĐÚNG công thức tính theo tỷ lệ % phân bổ riêng của từng khoản vay (khớp hoàn toàn
    // với "Thống kê phân bổ tiền lãi các cấp" ở Sổ vay vốn) — thay thế hẳn công thức retainPercent
    // chung chung cũ (2 nơi từng cho ra số liệu lệch nhau, nay đã đồng bộ tuyệt đối).
    const quarterSet = explicitQuarterSet || quarterSetFromDateRange(from, to);
    const stats = computeInterestIncomeStats(null, quarterSet);
    const thu = stats.central + stats.province + stats.ward; // tổng lãi ĐÃ đóng trong kỳ, cả 3 cấp cộng lại — chỉ để xem tổng quan
    const xaNhan = Math.round(stats.ward); // đây mới là "Thu" THẬT SỰ được quản lý trong module này
    const giuLaiAp = Math.round(thu - xaNhan); // phần thuộc về Trung ương + Tỉnh (không phải của Xã/phường)
    const activeExpenses = state.expenses.filter(e=> !e.deleted && e.date && (explicitQuarterSet? dateFallsInQuarterSet(e.date, explicitQuarterSet) : (e.date>=from && e.date<=to)));
    const chiTotal = activeExpenses.reduce((s,e)=> s + (parseFloat(e.amount)||0), 0);
    const chiByCategory = {};
    const chiByHamlet = {};
    activeExpenses.forEach(e=>{
      const label = e.purpose===CAT_OTHER ? `${CAT_OTHER}: ${e.purposeOther||'(chưa ghi rõ)'}` : (isCatHamlet(e.purpose) ? CAT_HAMLET : e.purpose);
      chiByCategory[label] = (chiByCategory[label]||0) + (parseFloat(e.amount)||0);
      if(isCatHamlet(e.purpose)){
        const h = e.hamlet || '—';
        chiByHamlet[h] = (chiByHamlet[h]||0) + (parseFloat(e.amount)||0);
      }
    });
    return {
      thu, xaNhan, giuLaiAp, chiTotal, chiByCategory, chiByHamlet, tonQuy: Math.round(xaNhan - chiTotal), expenses: activeExpenses,
      // Số liệu bổ sung mới — phục vụ các bước sau (đối chiếu Chi Khu dân cư/Ấp tự động vs thực tế...).
      central: stats.central, province: stats.province, hamletTotal: stats.hamletTotal, hamletByName: stats.hamletByName,
    };
  }


  // ---------- báo cáo tổng quan toàn xã (theo phương án vay) ----------
  function computeProjectOverview(){
    const active = state.borrowers.filter(b=>!b.deleted && !b.settled);
    const byProject = {};
    active.forEach(b=>{
      const p = borrowerProjectName(b) || '—';
      if(!byProject[p]) byProject[p] = { name:p, hamlets:new Set(), disbursed:0, recovered:0 };
      byProject[p].hamlets.add(b.hamlet||'—');
      byProject[p].disbursed += parseFloat(b.principal)||0;
      byProject[p].recovered += parseFloat(b.principalPaid)||0;
    });
    const list = Object.values(byProject).map(p=>{
      const outstanding = Math.max(0, Math.round(p.disbursed - p.recovered));
      return {
        name: p.name,
        hamlets: [...p.hamlets].join(', '),
        disbursed: Math.round(p.disbursed),
        recovered: Math.round(p.recovered),
        outstanding,
        status: outstanding>0 ? 'Đang hoạt động' : 'Đã tất toán',
      };
    }).sort((a,b)=>a.name.localeCompare(b.name));
    const activeCount = list.filter(p=>p.status==='Đang hoạt động').length;
    const settledCount = list.filter(p=>p.status==='Đã tất toán').length;
    const totalBorrowers = active.filter(b=> ((parseFloat(b.principal)||0) - (parseFloat(b.principalPaid)||0)) > 0 ).length;
    const totalOutstanding = list.reduce((s,p)=>s+p.outstanding,0);
    return { list, activeCount, settledCount, totalBorrowers, totalOutstanding };
  }

  // ---------- activity feed for bell (chỉ còn cảnh báo — đã bỏ "Nhật ký hoạt động") ----------
  function bellItems(){
    const alerts = computeAlerts().map(a=>({type:'alert', ...a}));
    const personal = (state._persistentNotifs||[]).map(n=>({ type:'personal', color:'orange', text:n.text, time:n.createdAt, receiptCode:n.receiptCode, notifId:n.id }));
    return personal.concat(alerts.map(a=>({...a,time:null})));
  }

  // ================= RENDER =================
  function render(){
    if(state.view==='login'){ renderLogin(); syncFloatingChat(); return; }
    if(state.view==='welcome'){ renderWelcome(); syncFloatingChat(); return; }
    if(state.view==='wallet'){ renderWallet(); syncFloatingChat(); return; }
    if(state.view==='onboarding'){ renderOnboarding(); syncFloatingChat(); return; }
    if(state.view==='app'){ (isPending() ? renderPendingScreen() : renderApp()); syncFloatingChat(); return; }
    root.innerHTML = `<div class="center-screen">${waveTextHtmlSlow('Đang tải: Hoinongdan.sotay.org')}</div>`;
    syncFloatingChat();
  }

  // =====================================================================
  // ---------- TRỢ LÝ AI "ANH NÔNG DÂN THÔNG MINH" (Gemini) ----------
  // Nút chat tròn bập bềnh (góc dưới-phải) + không gian chat toàn màn hình kiểu Gemini, có
  // lịch sử các đoạn chat lưu theo tài khoản Google (users/{email}/aiChats/...).
  // Kéo-thả THEO NHÓM — kéo bất kỳ 1 phần tử nào trong nhóm thì TẤT CẢ các phần tử còn lại cũng di
  // chuyển theo ĐÚNG CÙNG khoảng cách, luôn "dính liền" với nhau như 1 khối duy nhất. Chỉ theo chiều
  // dọc, không lưu lại vĩnh viễn (giống hệt nguyên tắc của makeVerticallyDraggable ở trên).
  // elements: mảng các {el, verticalProp} — mỗi phần tử tự có cạnh định vị riêng (thường đều là
  // 'bottom' với bộ 3 nút nổi này).
  function makeGroupDraggable(elements){
    elements.forEach(({el})=>{
      if(!el || el.dataset.vDragGroupWired) return;
      el.dataset.vDragGroupWired = '1';
      let dragging = false, startY = 0, startVals = [], moved = false;
      const onDown = (e)=>{
        dragging = true; moved = false;
        startY = (e.touches? e.touches[0].clientY : e.clientY);
        startVals = elements.map(({el:e2, verticalProp:p})=> parseFloat(getComputedStyle(e2)[p]) || 0);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, {passive:false});
        document.addEventListener('touchend', onUp);
      };
      const onMove = (ev)=>{
        if(!dragging) return;
        const curY = (ev.touches? ev.touches[0].clientY : ev.clientY);
        let deltaY = curY - startY;
        if(Math.abs(deltaY) > 4) moved = true;
        if(!moved) return;
        ev.preventDefault();
        // QUAN TRỌNG: tính CHUNG 1 khoảng dịch chuyển (deltaY) cho CẢ NHÓM, giới hạn theo đúng phần tử
        // nào sắp chạm biên màn hình SỚM NHẤT — để cả nhóm LUÔN dừng lại CÙNG LÚC, giữ nguyên khoảng
        // cách ban đầu giữa các nút, không còn tình trạng nút này chạm biên trước rồi bị các nút khác
        // "đè" chồng lên khi chúng tiếp tục di chuyển.
        elements.forEach(({el:e2, verticalProp:p}, i)=>{
          const rawVal = p==='bottom' ? startVals[i] - deltaY : startVals[i] + deltaY;
          const maxVal = window.innerHeight - e2.offsetHeight - 4;
          if(rawVal < 4) deltaY = p==='bottom' ? (startVals[i]-4) : -(4-startVals[i]);
          else if(rawVal > maxVal) deltaY = p==='bottom' ? (startVals[i]-maxVal) : (maxVal-startVals[i]);
        });
        elements.forEach(({el:e2, verticalProp:p}, i)=>{
          const newVal = p==='bottom' ? startVals[i] - deltaY : startVals[i] + deltaY;
          e2.style[p] = newVal + 'px';
        });
      };
      const onUp = ()=>{
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        if(moved){
          // CHỈ chặn click "ma" trên ĐÚNG phần tử vừa được cầm để kéo (el) — KHÔNG chặn ở 2 phần tử còn
          // lại trong nhóm (chúng không hề được bấm, chỉ bị "rê theo", không có click ma nào phát sinh
          // ở đó cả). Tự động GỠ bộ chặn sau 300ms (không dùng {once:true} chờ vô thời hạn) — vì sau 1
          // cú kéo thật sự (có di chuyển), trình duyệt thường KHÔNG tự phát sinh sự kiện click nào cả,
          // nên bộ chặn kiểu "chờ đúng 1 lần" sẽ vô tình "ăn mất" lần bấm THẬT SỰ kế tiếp của người
          // dùng, khiến phải bấm tới 2 lần mới có tác dụng — đây chính là lỗi thật đã xảy ra, nay sửa
          // bằng cách giới hạn thời gian chặn thay vì chờ đúng 1 sự kiện bất kỳ khi nào nó tới.
          const suppressClick = (ev)=>{ ev.stopPropagation(); ev.preventDefault(); };
          el.addEventListener('click', suppressClick, { capture:true });
          setTimeout(()=> el.removeEventListener('click', suppressClick, { capture:true }), 300);
        }
      };
      el.addEventListener('mousedown', onDown);
      el.addEventListener('touchstart', onDown, {passive:true});
    });
  }
  // Cho phép kéo-thả 1 nút/khung nổi (fixed) theo CHIỀU DỌC MÀ THÔI (không cho đổi vị trí ngang) —
  // dùng chung cho nút Chat AI, Ghi chú nhanh, và nút Thao tác (ẩn/hiện menu). Vị trí thay đổi NGAY LẬP
  // TỨC theo thời gian thực trong lúc đang kéo. KHÔNG lưu lại vị trí — mỗi lần vào lại app (tải lại
  // trang) đều tự động bắt đầu lại đúng vị trí mặc định ban đầu, đúng yêu cầu; trong CÙNG 1 phiên làm
  // việc thì vị trí vừa kéo được giữ nguyên xuyên suốt (vì phần tử DOM không bị tạo lại giữa các lần
  // vẽ lại — chỉ tạo đúng 1 lần).
  // verticalProp: 'bottom' hoặc 'top' — tuỳ phần tử đang định vị theo cạnh nào.
  // rememberKey (tuỳ chọn): nếu phần tử này có thể bị VẼ LẠI (tạo mới) thường xuyên trong 1 phiên làm
  // việc (VD nút "Thao tác" — nằm trong HTML render() chính, không giống nút Chat AI/Ghi chú nhanh được
  // tạo đúng 1 lần) — truyền vào 1 tên khoá bất kỳ để hàm này tự ghi nhớ + tự áp dụng lại đúng vị trí
  // đã kéo mỗi lần phần tử mới được tạo ra, không bị "quên" mất vị trí sau mỗi lần vẽ lại.
  window.__vDragPositions = window.__vDragPositions || {};
  function makeVerticallyDraggable(el, verticalProp, rememberKey){
    if(rememberKey && window.__vDragPositions[rememberKey]!=null){
      el.style[verticalProp] = window.__vDragPositions[rememberKey] + 'px';
    }
    if(!el || el.dataset.vDragWired) return;
    el.dataset.vDragWired = '1';
    let dragging = false, startY = 0, startVal = 0, moved = false;
    const getVal = ()=> parseFloat(getComputedStyle(el)[verticalProp]) || 0;
    const onDown = (e)=>{
      // Bỏ qua nếu bấm đúng vào 1 nút/khung có thể cuộn ngang riêng bên trong (không áp dụng ở đây,
      // nhưng để phòng hờ mở rộng về sau).
      dragging = true; moved = false;
      startY = (e.touches? e.touches[0].clientY : e.clientY);
      startVal = getVal();
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, {passive:false});
      document.addEventListener('touchend', onUp);
    };
    const onMove = (e)=>{
      if(!dragging) return;
      const curY = (e.touches? e.touches[0].clientY : e.clientY);
      const deltaY = curY - startY;
      if(Math.abs(deltaY) > 4) moved = true;
      if(!moved) return;
      e.preventDefault();
      // "bottom" tăng khi kéo LÊN (deltaY âm) — "top" tăng khi kéo XUỐNG (deltaY dương).
      const newVal = verticalProp==='bottom' ? startVal - deltaY : startVal + deltaY;
      const maxVal = window.innerHeight - el.offsetHeight - 4;
      const clamped = Math.max(4, Math.min(maxVal, newVal));
      el.style[verticalProp] = clamped + 'px';
      if(rememberKey) window.__vDragPositions[rememberKey] = clamped;
    };
    const onUp = ()=>{
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      // Nếu chỉ bấm (không kéo di chuyển gì) thì để nguyên hành vi click bình thường (mở Chat AI/Siêu
      // ghi chú/Thao tác) — chặn sự kiện click "ảo" phát sinh ngay sau khi vừa kéo thả xong.
      if(moved){
        const suppressClick = (ev)=>{ ev.stopPropagation(); ev.preventDefault(); };
        el.addEventListener('click', suppressClick, { capture:true });
        setTimeout(()=> el.removeEventListener('click', suppressClick, { capture:true }), 300);
      }
    };
    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onDown, {passive:true});
  }
  // =====================================================================
  // Chỉ hiển thị nút chat khi đang ở trong app (không hiện ở màn đăng nhập/welcome/onboarding).
  function syncFloatingChat(){
    let btn = document.getElementById('fab-chat-btn');
    const shouldShow = state.view === 'app';
    if(!shouldShow){
      if(btn) btn.remove();
      const overlay = document.getElementById('ai-chat-overlay');
      if(overlay) overlay.remove();
      if(aiOutsideClickHandler){ document.removeEventListener('click', aiOutsideClickHandler); aiOutsideClickHandler = null; }
      const notesWrap = document.getElementById('fab-notes-wrap');
      if(notesWrap) notesWrap.remove();
      const notesOverlay = document.getElementById('quick-note-overlay');
      if(notesOverlay) notesOverlay.remove();
      const peopleBtn = document.getElementById('fab-people-btn');
      if(peopleBtn) peopleBtn.remove();
      const peopleOverlay = document.getElementById('people-chat-overlay');
      if(peopleOverlay) peopleOverlay.remove();
      const officeOverlay = document.getElementById('office-overlay');
      if(officeOverlay){ officeOverlay.remove(); state._officeAppOpen = null; }
      const propagandaOverlay = document.getElementById('propaganda-overlay');
      if(propagandaOverlay){ propagandaOverlay.remove(); state._propagandaOpen = false; }
      return;
    }
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'fab-chat-btn';
      // Nếu popup chào mừng SẮP hiện (hoặc đang hiện) thì tạo nút ở trạng thái ĐỨNG YÊN (không nhảy
      // ngay) — chỉ khi popup biến mất hẳn, renderWardWelcomePopup mới kích hoạt nhảy để thu hút chú ý.
      const willShowPopup = !!state._showWardWelcome;
      btn.className = willShowPopup ? 'fab-chat fab-pre-popup' : 'fab-chat fab-intro'; // Yêu cầu 6: nhún nhảy 5 giây đầu để thu hút sự chú ý
      btn.title = 'Chàng Nông dân Thông minh — Trợ lý AI';
      btn.dataset.tooltip = 'Chat với AI';
      btn.textContent = '🤖';
      btn.onclick = openAiChat;
      document.body.appendChild(btn);
      if(!willShowPopup) setTimeout(()=>{ const b = document.getElementById('fab-chat-btn'); if(b) b.classList.remove('fab-intro'); }, 5000);
    }
    if(state._aiChatOpen && !document.getElementById('ai-chat-overlay')){
      renderAiChatOverlay();
    } else if(!state._aiChatOpen){
      const overlay = document.getElementById('ai-chat-overlay');
      if(overlay) overlay.remove();
      if(aiOutsideClickHandler){ document.removeEventListener('click', aiOutsideClickHandler); aiOutsideClickHandler = null; }
    }

    // ---- Icon "Ghi chú nhanh" — hiện cho MỌI phiên đang ở giao diện chính (kể cả tham quan/khách
    // qua mã, để họ vẫn thấy được module + cảnh báo tương ứng — quyền hạn xử lý bên trong module).
    let notesWrap = document.getElementById('fab-notes-wrap');
    {
      if(!notesWrap){
        notesWrap = document.createElement('div');
        notesWrap.id = 'fab-notes-wrap';
        notesWrap.className = 'fab-notes-wrap';
        const willShowPopup = !!state._showWardWelcome;
        notesWrap.innerHTML = `<button id="fab-notes-btn" class="fab-notes-btn ${willShowPopup?'fab-pre-popup':'fab-intro'}" title="Ghi chú nhanh" data-tooltip="Ghi chú nhanh">🗒️</button>`;
        document.body.appendChild(notesWrap);
        notesWrap.querySelector('#fab-notes-btn').onclick = openQuickNote;
        if(!willShowPopup) setTimeout(()=>{ const b = document.getElementById('fab-notes-btn'); if(b) b.classList.remove('fab-intro'); }, 5000);
      }
      if(state._quickNoteOpen && !document.getElementById('quick-note-overlay')){
        renderQuickNoteOverlay();
      } else if(!state._quickNoteOpen){
        const notesOverlay = document.getElementById('quick-note-overlay');
        if(notesOverlay) notesOverlay.remove();
      }
    }

    // ---- Icon "Chat với Mọi người" — nút thứ 3, luôn nằm ngay dưới "Ghi chú nhanh", LUÔN dính liền
    // và di chuyển CÙNG LÚC với 2 nút phía trên khi kéo-thả bất kỳ nút nào trong 3 nút này.
    let peopleBtn = document.getElementById('fab-people-btn');
    if(!peopleBtn){
      peopleBtn = document.createElement('button');
      peopleBtn.id = 'fab-people-btn';
      const willShowPopup = !!state._showWardWelcome;
      peopleBtn.className = willShowPopup ? 'fab-people-btn fab-pre-popup' : 'fab-people-btn fab-intro';
      peopleBtn.title = 'Chat với Mọi người';
      peopleBtn.dataset.tooltip = 'Chat với Mọi người';
      peopleBtn.textContent = '💬';
      peopleBtn.onclick = openPeopleChat;
      document.body.appendChild(peopleBtn);
      if(!willShowPopup) setTimeout(()=>{ const b = document.getElementById('fab-people-btn'); if(b) b.classList.remove('fab-intro'); }, 5000);
    }
    // Kéo-thả THEO NHÓM — kéo bất kỳ 1 trong 3 nút này thì cả 3 luôn di chuyển cùng nhau, dính liền.
    makeGroupDraggable([
      { el: btn, verticalProp: 'bottom' },
      { el: notesWrap, verticalProp: 'bottom' },
      { el: peopleBtn, verticalProp: 'bottom' },
    ]);
  }
  // Mở modal "Chat với Mọi người" — chiếm trọn màn hình (cả rộng lẫn hẹp), nội dung tạm thời để trống,
  // sẽ xây dựng sau.
  function openPeopleChat(){
    let wrap = document.getElementById('people-chat-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'people-chat-overlay';
      wrap.className = 'ai-overlay';
      document.body.appendChild(wrap);
    }
    state._peopleChatOpen = true;
    wrap.innerHTML = `
      <button class="ai-close-fab preview-allow" id="people-chat-close-fab" title="Đóng Chat với Mọi người">✕</button>
      <div class="ai-main" id="people-chat-main" style="margin-left:0;">
        <div class="ai-header">💬 Chat với Mọi người (hoinongdan.sotay.org)</div>
        <div class="ai-messages" style="align-items:center; justify-content:center;">
          <p class="sub" style="text-align:center; font-size:15px;">🚧 Tính năng đang được xây dựng, sẽ sớm ra mắt.</p>
        </div>
      </div>`;
    document.getElementById('people-chat-close-fab').onclick = closePeopleChat;
    requestAnimationFrame(()=>{
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
  }
  function closePeopleChat(){
    state._peopleChatOpen = false;
    const wrap = document.getElementById('people-chat-overlay');
    if(wrap) wrap.remove();
    // Thoát module ra thì LUÔN hiện khung menu chính (bất kể trước đây đang đóng hay mở).
    state.sidebarCollapsed = false;
    applySidebarCollapsedVisual(false);
  }
  // Chuyển từ Chat AI sang Ghi chú nhanh và ngược lại — ẩn bên này, mở thẳng bên kia, mượt mà.
  async function openQuickNote(){
    closeAiChat();
    state._quickNoteOpen = true;
    // Ghi chú nhanh không còn cây thư mục hay không gian lưu trữ riêng — mọi ghi chú
    // được lưu thẳng vào Trung tâm dữ liệu (Bộ cá nhân) nên không cần gắn realtime gì ở đây.
    renderQuickNoteOverlay();
    // Đảm bảo KHÔNG có con trỏ văn bản (và do đó KHÔNG có bàn phím ảo tự bật lên trên điện thoại) ngay
    // lúc vừa mở module — chỉ khi người dùng TỰ bấm vào khung nhập thì mới có con trỏ để nhập liệu.
    requestAnimationFrame(()=>{
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
  }
  function closeQuickNote(){
    state._quickNoteOpen = false;
    const overlay = document.getElementById('quick-note-overlay');
    if(overlay) overlay.remove();
    if(qnOutsideClickHandler){ document.removeEventListener('click', qnOutsideClickHandler); qnOutsideClickHandler = null; }
    // Thoát module ra thì LUÔN hiện khung menu chính (bất kể trước đây đang đóng hay mở).
    state.sidebarCollapsed = false;
    applySidebarCollapsedVisual(false);
  }
  async function openAiChat(){
    state._aiChatOpen = true;
    await Promise.all([loadAiChats(), loadAiProviders()]);
    if(!state.aiActiveChatId && state.aiChats.length) state.aiActiveChatId = state.aiChats[0].id;
    if(!state.aiActiveProviderId || !state.aiProviders.some(p=>p.id===state.aiActiveProviderId)){
      const cached = lget('hnd_ai_active_provider', null);
      state.aiActiveProviderId = (cached && state.aiProviders.some(p=>p.id===cached)) ? cached : (state.aiProviders[0] ? state.aiProviders[0].id : null);
    }
    renderAiChatOverlay();
    // Đảm bảo KHÔNG có con trỏ văn bản (và do đó KHÔNG có bàn phím ảo tự bật lên trên điện thoại) ngay
    // lúc vừa mở module — chỉ khi người dùng TỰ bấm vào khung chat thì mới có con trỏ để nhập liệu.
    requestAnimationFrame(()=>{
      const inp = document.getElementById('ai-input');
      if(inp && document.activeElement===inp) inp.blur();
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
  }
  function getActiveAiProvider(){
    if(!state.aiProviders || !state.aiProviders.length) return null;
    return state.aiProviders.find(p=>p.id===state.aiActiveProviderId) || state.aiProviders[0];
  }
  function selectAiProvider(id){
    state.aiActiveProviderId = id;
    lset('hnd_ai_active_provider', id);
    state._aiModelMenuOpen = false;
    renderAiChatOverlay();
  }
  function closeAiChat(){
    state._aiChatOpen = false;
    state._aiModelMenuOpen = false; state._aiAddMenuOpen = false;
    state._aiBubbleEditingIndex = null;
    const overlay = document.getElementById('ai-chat-overlay');
    if(overlay) overlay.remove();
    if(aiOutsideClickHandler){ document.removeEventListener('click', aiOutsideClickHandler); aiOutsideClickHandler = null; }
    // Thoát module ra thì LUÔN hiện khung menu chính (bất kể trước đây đang đóng hay mở).
    state.sidebarCollapsed = false;
    applySidebarCollapsedVisual(false);
  }
  async function loadAiChats(){
    if(!state.identity || !state.identity.email){ state.aiChats = state.aiChats||[]; return; } // Khách/tham quan: chỉ lưu tạm trong phiên, không có tài khoản để lưu lâu dài
    try{
      const snap = await rtdb.ref(`users/${emailToKey(state.identity.email)}/aiChats`).get();
      state.aiChats = (snap && snap.exists()) ? Object.entries(snap.val()).map(([id,v])=>({id, ...v})).sort((a,b)=> new Date(b.updatedAt||0)-new Date(a.updatedAt||0)) : [];
    }catch(e){ state.aiChats = []; }
  }
  async function saveAiChatToCloud(chat){
    if(!state.identity || !state.identity.email) return;
    try{ await rtdb.ref(`users/${emailToKey(state.identity.email)}/aiChats/${chat.id}`).set(chat); }catch(e){ console.error('Lưu đoạn chat AI lỗi:', e); }
  }
  function newAiChat(){
    const chat = { id:'c_'+uid(), title:'Đoạn chat mới', messages:[], updatedAt:new Date().toISOString() };
    state.aiChats.unshift(chat);
    state.aiActiveChatId = chat.id;
    renderAiChatOverlay();
  }
  async function deleteAiChatById(chatId){
    state.aiChats = state.aiChats.filter(c=>c.id!==chatId);
    if(state.aiActiveChatId===chatId) state.aiActiveChatId = state.aiChats[0] ? state.aiChats[0].id : null;
    if(state.identity && state.identity.email){ try{ await rtdb.ref(`users/${emailToKey(state.identity.email)}/aiChats/${chatId}`).remove(); }catch(e){} }
    renderAiChatOverlay();
  }

  // ---------------------------------------------------------------------
  // Nút "➕ THÊM THÀNH PHẦN" — cho phép đính kèm ảnh/tài liệu hoặc bật chế độ Tìm kiếm web,
  // y hệt các lựa chọn ở nút dấu cộng trong khung chat của Gemini thực thụ.
  // ---------------------------------------------------------------------
  function toggleAiAddMenu(){
    state._aiAddMenuOpen = !state._aiAddMenuOpen;
    state._aiModelMenuOpen = false;
    // Ô nhập liệu <textarea id="ai-input"> KHÔNG hề gắn với biến trạng thái nào (chỉ là DOM thao tác
    // tay thuần tuý) — nên mỗi lần renderAiChatOverlay() vẽ lại TOÀN BỘ khung chat, ô này sẽ bị dựng
    // lại RỖNG, xoá sạch chữ đang gõ dở. Lưu lại giá trị TRƯỚC khi vẽ lại, rồi khôi phục lại NGAY SAU
    // đó, để người dùng không bị mất chữ chỉ vì mở menu "Thêm thành phần".
    const inputEl = document.getElementById('ai-input');
    const savedValue = inputEl ? inputEl.value : '';
    renderAiChatOverlay();
    const inputElAfter = document.getElementById('ai-input');
    if(inputElAfter && savedValue) inputElAfter.value = savedValue;
    if(inputElAfter) autoResizeTextarea(inputElAfter);
  }
  function toggleAiModelMenu(){
    state._aiModelMenuOpen = !state._aiModelMenuOpen;
    state._aiAddMenuOpen = false;
    const inputEl = document.getElementById('ai-input');
    const savedValue = inputEl ? inputEl.value : '';
    renderAiChatOverlay();
    const inputElAfter = document.getElementById('ai-input');
    if(inputElAfter && savedValue) inputElAfter.value = savedValue;
    if(inputElAfter) autoResizeTextarea(inputElAfter);
  }
  function triggerAiFileInput(kind){
    state._aiAddMenuOpen = false;
    renderAiChatOverlay();
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = kind==='image' ? 'image/*' : '*/*';
    input.onchange = ()=> handleAiFiles(input.files);
    input.click();
  }
  function handleAiFiles(fileList){
    const files = Array.from(fileList||[]);
    if(!files.length) return;
    const MAX_MB = 8;
    files.forEach(file=>{
      if(file.size > MAX_MB*1024*1024){ alert(`Tệp "${file.name}" vượt quá ${MAX_MB}MB, vui lòng chọn tệp nhỏ hơn.`); return; }
      const reader = new FileReader();
      reader.onload = ()=>{
        const base64 = String(reader.result).split(',')[1] || '';
        state.aiPendingAttachments.push({ name:file.name, mimeType: file.type || 'application/octet-stream', base64 });
        renderAiChatOverlay();
      };
      reader.onerror = ()=> alert(`Không đọc được tệp "${file.name}".`);
      reader.readAsDataURL(file);
    });
  }
  function removeAiAttachment(idx){
    state.aiPendingAttachments.splice(idx,1);
    renderAiChatOverlay();
  }
  function toggleAiWebSearch(){
    state.aiWebSearchOn = !state.aiWebSearchOn;
    state._aiAddMenuOpen = false;
    renderAiChatOverlay();
  }
  // Micro — nhận dạng giọng nói (Web Speech API), điền thẳng vào ô nhập, y hệt icon micro của Gemini.
  let aiRecognition = null;
  let aiOutsideClickHandler = null; // tham chiếu handler "bấm ra ngoài để đóng dropdown" — dùng để gỡ đúng lúc đóng chat
  let qnOutsideClickHandler = null; // tương tự, dùng cho dropdown trong Ghi chú nhanh
  // Bảng thông báo nhỏ "Đang lắng nghe..." khi micro (1 hoặc 2) đang hoạt động — CỐ Ý không có nút
  // đóng/X nào cả (chỉ tự ẩn khi dừng nghe, qua đúng các nút bên trong bảng hoặc các nút dừng khác).
  let micStatusTimerInterval = null;
  function showMicStatusPanel(opts){
    let panel = document.getElementById('ai-mic-status-panel');
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'ai-mic-status-panel';
      panel.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:550; background:#fff; border:2px solid #0d47a1; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,.25); padding:14px 18px; min-width:260px; max-width:92vw; text-align:center;';
      document.body.appendChild(panel);
    }
    panel.innerHTML = `
      <div style="font-weight:800; color:#0d47a1; font-size:13px; margin-bottom:8px;">${escapeHtml(opts.title)}</div>
      <div id="ai-mic-status-body" style="margin-bottom:10px; color:${opts.bodyColor||'#000'}; font-weight:700;">${waveTextHtml(opts.bodyText)}${opts.startTime? ` <span id="ai-mic-status-timer" style="font-weight:800; white-space:nowrap;">00:00</span>` : ''}</div>
      <button type="button" class="preview-allow" id="ai-mic-status-stop" style="width:100%; padding:8px 12px; border:none; border-radius:8px; background:#2e7d32; color:#fff; font-weight:800; cursor:pointer; ${opts.stopDisabled?'opacity:.5; cursor:not-allowed;':''}" ${opts.stopDisabled?'disabled':''}>✅ Đã nói xong</button>
      ${opts.onCancel? `<button type="button" class="preview-allow" id="ai-mic-status-cancel" style="width:100%; margin-top:8px; padding:8px 12px; border:none; border-radius:8px; background:#b71c1c; color:#fff; font-weight:800; cursor:pointer;">🗑️ Huỷ tất cả (không tạo văn bản)</button>` : ''}
      <div style="margin-top:10px; color:#000; font-weight:400; font-size:12.5px;">Hãy đảm bảo rằng Micro của Thiết bị đang hoạt động tốt</div>
    `;
    const stopBtn = document.getElementById('ai-mic-status-stop');
    if(stopBtn) stopBtn.onclick = opts.onStop;
    const cancelBtn = document.getElementById('ai-mic-status-cancel');
    if(cancelBtn && opts.onCancel) cancelBtn.onclick = opts.onCancel;
    // Đồng hồ đếm thời gian đã nghe được (mm:ss), cập nhật theo thời gian thực — chỉ dùng khi truyền
    // vào opts.startTime (mốc thời gian bắt đầu nghe). Luôn dọn đồng hồ CŨ trước khi tạo đồng hồ MỚI,
    // tránh chạy chồng nhiều đồng hồ cùng lúc qua các lần gọi hàm này.
    if(micStatusTimerInterval){ clearInterval(micStatusTimerInterval); micStatusTimerInterval = null; }
    if(opts.startTime){
      const updateTimer = ()=>{
        const timerEl = document.getElementById('ai-mic-status-timer');
        if(!timerEl){ if(micStatusTimerInterval) clearInterval(micStatusTimerInterval); return; }
        const elapsedSec = Math.max(0, Math.floor((Date.now()-opts.startTime)/1000));
        const mm = String(Math.floor(elapsedSec/60)).padStart(2,'0');
        const ss = String(elapsedSec%60).padStart(2,'0');
        timerEl.textContent = `${mm}:${ss}`;
      };
      updateTimer();
      micStatusTimerInterval = setInterval(updateTimer, 1000);
    }
  }
  function hideMicStatusPanel(){
    if(micStatusTimerInterval){ clearInterval(micStatusTimerInterval); micStatusTimerInterval = null; }
    const panel = document.getElementById('ai-mic-status-panel');
    if(panel) panel.remove();
  }
  // Tự động giãn chiều cao khung nhập liệu văn bản theo đúng số dòng đang gõ — y như tính năng chiều
  // cao linh hoạt của khung chat Claude: gõ càng nhiều dòng thì khung càng cao lên, tới khi chạm giới
  // hạn tối đa (gần bằng chiều cao màn hình) thì dừng lại, lúc đó khung tự hiện thanh cuộn dọc bên
  // trong để vuốt xem hết nội dung, không giãn cao thêm nữa.
  function autoResizeTextarea(el){
    if(!el) return;
    el.style.height = 'auto'; // đặt lại 'auto' TRƯỚC để trình duyệt tính lại đúng scrollHeight theo nội dung THỰC TẾ hiện có (không bị ảnh hưởng bởi chiều cao cũ đang áp dụng)
    const contentH = el.scrollHeight; // đo NGAY sau khi đặt lại 'auto' — phản ánh đúng chiều cao THỰC TẾ theo nội dung, trước khi bị kẹp giới hạn tối đa bên dưới
    const maxH = window.innerHeight * 0.65; // khớp với max-height:65vh ở CSS
    el.style.height = Math.min(contentH, maxH) + 'px';
    // Thu gọn nút "Thêm thành phần" thành nút tròn chỉ còn icon "+" khi khung chat đã giãn cao tới
    // khoảng 3,5 dòng văn bản trở lên — CHỈ áp dụng ở màn hình RỘNG (màn hình hẹp đã luôn thu gọn sẵn
    // qua media query CSS riêng từ trước, không liên quan gì tới đoạn này). Nhờ nút thu gọn lại mà khung
    // chat có thêm không gian, được kéo dài thêm sang bên trái.
    if(!isNarrowScreenForSidebar()){
      const prefix = el.id.replace(/-input$/, '');
      const addBtn = document.getElementById(prefix+'-add-btn');
      if(addBtn){
        const lineHeightPx = parseFloat(getComputedStyle(el).lineHeight) || 22;
        const threshold = lineHeightPx*3.5 + 24; // ~3,5 dòng + phần đệm trên dưới của khung (khớp CSS padding:12px 14px)
        addBtn.classList.toggle('ai-add-btn-collapsed', contentH > threshold);
      }
    }
  }
  function wireAutoResizeTextarea(id){
    const el = document.getElementById(id);
    if(!el) return;
    autoResizeTextarea(el); // tính đúng ngay khi vừa gắn (phòng trường hợp đã có sẵn nội dung, VD vừa khôi phục lại chữ đang gõ dở sau khi mở menu "Thêm thành phần")
    el.addEventListener('input', ()=> autoResizeTextarea(el));
  }
  function toggleMicGeneric(prefix, rerenderFn){
    const targetInputId = prefix+'-input';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ alert('Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Vui lòng dùng Google Chrome trên máy tính hoặc Android.'); return; }
    // Cập nhật RIÊNG các phần tử liên quan (nhãn nút micro trong menu "Thêm thành phần", nút Gửi/Dừng
    // cạnh khung nhập) bằng thao tác DOM trực tiếp — TUYỆT ĐỐI KHÔNG gọi lại rerenderFn() (hàm này vẽ
    // lại TOÀN BỘ khung chat từ đầu, làm khung <textarea> — vốn KHÔNG hề gắn với biến trạng thái nào,
    // chỉ là DOM thao tác tay — bị xoá sạch về rỗng mỗi lần gọi). Đây chính là nguyên nhân gốc của lỗi
    // "chữ đã nói tự nhiên biến mất" trước đây.
    function updateMicUiOnly(listening){
      const micLabelEl = document.querySelector(`[data-${prefix}-add="mic"]`);
      if(micLabelEl) micLabelEl.innerHTML = `🎤 ${listening? '✅ Đang nghe — bấm để dừng' : 'Vừa nói vừa ra chữ'}`;
      // Đồng bộ trạng thái khoá/xám của nút micro CÒN LẠI (mic2) — vì hàm này cập nhật DOM trực tiếp,
      // không vẽ lại cả menu, nên phải tự tay đồng bộ class xám cho đúng.
      const mic2LabelEl = document.querySelector(`[data-${prefix}-add="mic2"]`);
      if(mic2LabelEl) mic2LabelEl.classList.toggle('ai-add-opt-disabled', listening);
      const sendBtn = document.getElementById(prefix+'-send-btn');
      const stopMicBtn = document.getElementById(prefix+'-mic-stop-btn');
      if(listening){
        if(sendBtn) sendBtn.style.display = 'none';
        if(!stopMicBtn && sendBtn && sendBtn.parentElement){
          const btn = document.createElement('button');
          btn.id = prefix+'-mic-stop-btn';
          btn.className = 'ai-stop-btn';
          btn.title = 'Dừng nghe';
          btn.textContent = '⏸';
          btn.onclick = ()=>{ if(aiRecognition) aiRecognition.stop(); };
          sendBtn.parentElement.insertBefore(btn, sendBtn);
        }
        showMicStatusPanel({
          title: 'Micro: Người dùng nói đến đâu thì chữ sẽ ra đến đó',
          bodyText: 'Đang lắng nghe…', bodyColor: '#000',
          onStop: ()=>{ if(aiRecognition) aiRecognition.stop(); },
        });
      } else {
        if(sendBtn) sendBtn.style.display = '';
        if(stopMicBtn) stopMicBtn.remove();
        hideMicStatusPanel();
      }
    }
    if(state['_'+prefix+'MicListening']){ if(aiRecognition) aiRecognition.stop(); return; }
    // QUAN TRỌNG: lấy giá trị ô nhập liệu NGAY TẠI ĐÂY (đồng bộ, ngay lúc vừa bấm nút) — KHÔNG đợi tới
    // sự kiện onstart (bất đồng bộ) mới lấy, vì giữa lúc bấm nút và lúc onstart thực sự chạy có thể bị
    // trễ (trình duyệt xin quyền micro lần đầu...), nếu có bất kỳ điều gì khác xảy ra trong lúc chờ đó
    // làm mất nội dung ô nhập thì ta vẫn đã lỡ lưu lại đúng nội dung TỪ TRƯỚC rồi, không bị ảnh hưởng.
    const inputElAtClick = document.getElementById(targetInputId);
    let baseValueCaptured = inputElAtClick ? inputElAtClick.value : '';
    aiRecognition = new SR();
    aiRecognition.lang = 'vi-VN';
    aiRecognition.interimResults = true;
    aiRecognition.maxAlternatives = 1;
    // continuous:true — QUAN TRỌNG: trước đây để false khiến trình duyệt tự ngắt nghe chỉ sau khi
    // ngừng nói một khoảng RẤT ngắn (khoảng nửa giây). Bật continuous để trình duyệt tiếp tục lắng
    // nghe liên tục, không tự ngắt giữa chừng nữa — việc dừng lại sẽ do TA tự kiểm soát bằng đồng hồ
    // đếm im lặng 10 giây bên dưới, không phụ thuộc hành vi mặc định (hay ngắt sớm) của trình duyệt.
    aiRecognition.continuous = true;
    let baseValue = ''; // nội dung ĐÃ có sẵn trong ô nhập trước khi bắt đầu nói đợt này — giữ nguyên, chỉ nối thêm
    let finalTranscript = '';
    let silenceTimer = null;
    function resetSilenceTimer(){
      if(silenceTimer) clearTimeout(silenceTimer);
      // Im lặng liên tục 10 giây (không nghe thấy tiếng nói mới nào) -> tự động dừng nghe.
      silenceTimer = setTimeout(()=>{ if(aiRecognition) aiRecognition.stop(); }, 10000);
    }
    aiRecognition.onstart = ()=>{
      state['_'+prefix+'MicListening'] = true;
      const inputEl = document.getElementById(targetInputId);
      // Khôi phục lại ĐÚNG nội dung đã lưu từ lúc bấm nút (phòng trường hợp ô nhập đã lỡ bị mất nội
      // dung trong lúc chờ xin quyền micro) — rồi mới bắt đầu nối thêm chữ mới vào từ đây.
      if(inputEl && inputEl.value!==baseValueCaptured) inputEl.value = baseValueCaptured;
      baseValue = baseValueCaptured;
      finalTranscript = '';
      updateMicUiOnly(true);
      resetSilenceTimer();
    };
    aiRecognition.onerror = (e)=>{
      state['_'+prefix+'MicListening'] = false;
      if(silenceTimer) clearTimeout(silenceTimer);
      updateMicUiOnly(false);
      // Báo lỗi RÕ RÀNG thay vì im lặng — các lỗi thường gặp: "not-allowed" (chưa cấp quyền micro),
      // "no-speech" (không nghe thấy tiếng nói), "network" (cần kết nối Internet vì trình duyệt gửi âm
      // thanh lên máy chủ để nhận dạng), "audio-capture" (không tìm thấy micro).
      const reasons = { 'not-allowed':'Chưa được cấp quyền dùng micro — vui lòng cấp quyền micro cho trang web rồi thử lại.',
        'no-speech':'Không nghe thấy giọng nói nào — vui lòng thử lại và nói to, rõ hơn.',
        'network':'Lỗi kết nối mạng — nhận dạng giọng nói CẦN có Internet để hoạt động, vui lòng kiểm tra lại mạng.',
        'audio-capture':'Không tìm thấy micro trên thiết bị này.' };
      const msg = reasons[e.error] || `Có lỗi khi nhận dạng giọng nói (${e.error||'không rõ nguyên nhân'}).`;
      console.error('[Nhận dạng giọng nói] Lỗi:', e.error, e);
      // "no-speech" đã có đồng hồ 10 giây riêng lo liệu rồi -> khỏi cần alert làm phiền thêm.
      if(e.error!=='no-speech') alert(msg);
    };
    aiRecognition.onend = ()=>{
      state['_'+prefix+'MicListening'] = false;
      if(silenceTimer) clearTimeout(silenceTimer);
      updateMicUiOnly(false);
      // KHÔNG xoá/động gì tới nội dung <textarea> ở đây — chữ đã nói ra (bao gồm cả đợt trước lẫn đợt
      // vừa nói) vẫn đang nằm nguyên trong DOM, tự nhiên được giữ lại.
    };
    aiRecognition.onresult = (e)=>{
      resetSilenceTimer(); // vừa nghe thấy tiếng nói mới -> reset lại đồng hồ đếm im lặng 10 giây
      let interimTranscript = '';
      for(let i=e.resultIndex; i<e.results.length; i++){
        const chunk = e.results[i][0].transcript;
        if(e.results[i].isFinal) finalTranscript += chunk; else interimTranscript += chunk;
      }
      const inputEl = document.getElementById(targetInputId);
      if(inputEl){
        const joined = [baseValue, (finalTranscript+interimTranscript).trim()].filter(Boolean).join(' ');
        inputEl.value = joined;
      }
    };
    try{ aiRecognition.start(); }catch(e){ console.error('[Nhận dạng giọng nói] Không khởi động được:', e); }
  }
  function toggleAiMic(){ toggleMicGeneric('ai', renderAiChatOverlay); }
  // ---------------------------------------------------------------------------------------------
  // Nút micro THỨ 2: "Nói xong mới ra chữ" — khác hẳn nút thứ nhất (nhận dạng trực tiếp trên trình
  // duyệt, ra chữ ngay trong lúc nói). Cách này: ghi âm TOÀN BỘ bằng MediaRecorder, khi dừng (tự động
  // hoặc bấm tay) mới gửi 1 lần file ghi âm lên cho Gemini (CHỈ Gemini hỗ trợ nghe hiểu file âm thanh
  // trực tiếp — Claude/GPT chưa hỗ trợ) để trích xuất ra văn bản, rồi chèn 1 lần vào ô nhập.
  // ---------------------------------------------------------------------------------------------
  let aiRecorder2 = null;
  async function toggleMic2Generic(prefix, rerenderFn){
    if(state['_'+prefix+'Mic2Listening']){ if(aiRecorder2 && aiRecorder2.state!=='inactive') aiRecorder2.stop(); return; }
    // QUAN TRỌNG: lấy giá trị ô nhập liệu NGAY TẠI ĐÂY (đồng bộ, ngay lúc vừa bấm nút) — trước khi xin
    // quyền micro (có thể trễ, nhất là lần đầu) — để chèn văn bản AI trả về sau này luôn nối đúng vào
    // đúng nội dung tại THỜI ĐIỂM BẤM NÚT, không bị ảnh hưởng bởi bất kỳ điều gì xảy ra trong lúc chờ.
    const inputElAtClick2 = document.getElementById(prefix+'-input');
    const baseValueCaptured2 = inputElAtClick2 ? inputElAtClick2.value : '';
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      alert('Trình duyệt này không hỗ trợ ghi âm. Vui lòng dùng Google Chrome trên máy tính hoặc Android.'); return;
    }
    if(!state.aiProviders || !state.aiProviders.length) await loadAiProviders();
    const geminiProvider = (state.aiProviders||[]).find(p=> aiVendorOf(p)==='gemini');
    if(!geminiProvider){
      alert('Tính năng "Nói xong mới ra chữ" cần có ít nhất 1 Cấu hình AI dùng model Gemini (chỉ Gemini mới hỗ trợ nghe hiểu file âm thanh trực tiếp) — vui lòng thêm 1 Cấu hình Gemini trong phần Cài đặt AI trước.');
      return;
    }
    function updateMic2UiOnly(listening, processing){
      state['_'+prefix+'Mic2Processing'] = !!processing;
      const micLabelEl = document.querySelector(`[data-${prefix}-add="mic2"]`);
      if(micLabelEl) micLabelEl.innerHTML = `🎙️ ${processing? '⏳ Đang xử lý...' : (listening? '✅ Đang nghe — bấm để dừng' : 'Nói xong mới ra chữ')}`;
      // Đồng bộ trạng thái khoá/xám của nút micro CÒN LẠI (mic1) — khoá cả lúc đang nghe LẪN lúc đang
      // chờ AI xử lý xong (chưa thực sự "xong hẳn"), chỉ mở lại khi cả 2 đều false.
      const micLabelEl1 = document.querySelector(`[data-${prefix}-add="mic"]`);
      if(micLabelEl1) micLabelEl1.classList.toggle('ai-add-opt-disabled', !!(listening || processing));
      const sendBtn = document.getElementById(prefix+'-send-btn');
      const stopBtn = document.getElementById(prefix+'-mic2-stop-btn');
      // Khoá hẳn ô nhập liệu trong lúc đang chờ AI xử lý xong (đang gửi âm thanh lên, chưa có kết quả
      // trả về) — tránh trường hợp người dùng gõ tay vào đúng lúc văn bản AI trả về đang được chèn vào,
      // gây nhảy/lẫn lộn ký tự giữa 2 nguồn (gõ tay + AI chèn) cùng lúc.
      const inputEl = document.getElementById(prefix+'-input');
      if(inputEl) inputEl.disabled = !!processing;
      if(listening){
        if(sendBtn) sendBtn.style.display = 'none';
        if(!stopBtn && sendBtn && sendBtn.parentElement){
          const btn = document.createElement('button');
          btn.id = prefix+'-mic2-stop-btn'; btn.className = 'ai-stop-btn'; btn.title = 'Dừng ghi âm'; btn.textContent = '⏸';
          btn.onclick = ()=>{ if(aiRecorder2 && aiRecorder2.state!=='inactive') aiRecorder2.stop(); };
          sendBtn.parentElement.insertBefore(btn, sendBtn);
        }
        showMicStatusPanel({
          title: 'Micro: Ghi âm giọng nói từ micro, Ghi âm xong thì sẽ gửi cho AI chuyển thành văn bản',
          bodyText: 'Đang lắng nghe…', bodyColor: '#000', startTime: mic2StartTime,
          onStop: ()=>{ if(aiRecorder2 && aiRecorder2.state!=='inactive') aiRecorder2.stop(); },
          onCancel: cancelMic2Everything,
        });
      } else if(processing){
        if(sendBtn) sendBtn.style.display = '';
        if(stopBtn) stopBtn.remove();
        showMicStatusPanel({
          title: 'Micro: Ghi âm giọng nói từ micro, Ghi âm xong thì sẽ gửi cho AI chuyển thành văn bản',
          bodyText: 'AI đang tiêu hoá thành văn bản', bodyColor: '#b71c1c',
          onStop: ()=>{}, stopDisabled: true,
          onCancel: cancelMic2Everything,
        });
      } else {
        if(sendBtn) sendBtn.style.display = '';
        if(stopBtn) stopBtn.remove();
        hideMicStatusPanel();
      }
    }
    // Nút "Huỷ tất cả (không tạo văn bản)" — dừng ghi âm (nếu đang ghi) HOẶC huỷ luôn yêu cầu đang gửi
    // cho AI (nếu đang xử lý), không chèn bất kỳ văn bản nào vào ô nhập, trở về đúng trạng thái ban đầu
    // như chưa từng bấm nút micro 2.
    function cancelMic2Everything(){
      mic2Cancelled = true;
      if(mic2AbortController) mic2AbortController.abort();
      if(aiRecorder2 && aiRecorder2.state!=='inactive') aiRecorder2.stop();
      state['_'+prefix+'Mic2Listening'] = false;
      updateMic2UiOnly(false, false);
    }
    let mic2Cancelled = false;
    let mic2StartTime = null;
    let mic2AbortController = null;
    let stream;
    try{ stream = await navigator.mediaDevices.getUserMedia({ audio:true }); }
    catch(e){ alert('Không thể truy cập micro: '+(e&&e.message||e)+'. Vui lòng cấp quyền micro cho trang web.'); return; }
    const chunks = [];
    const mimeType = (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm'
      : (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/mp4')) ? 'audio/mp4' : '';
    aiRecorder2 = mimeType ? new MediaRecorder(stream, {mimeType}) : new MediaRecorder(stream);
    aiRecorder2.ondataavailable = (e)=>{ if(e.data && e.data.size>0) chunks.push(e.data); };
    // Phát hiện im lặng bằng cách đo MỨC ÂM LƯỢNG thực tế qua Web Audio API — im lặng liên tục 10 giây
    // (không phải chỉ dựa vào việc "có nhận được kết quả nhận dạng" như nút mic thứ nhất, vì ở đây
    // KHÔNG có nhận dạng trực tiếp) thì tự động dừng ghi âm.
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let silenceTimer = null, volumeCheckInterval = null, maxDurationTimer = null;
    const SILENCE_THRESHOLD = 8;
    const MAX_RECORD_DURATION_MS = 5*60*1000; // giới hạn tối đa 5 phút/lượt ghi âm — tránh file quá nặng, khó tải lên và AI xử lý quá lâu
    function resetSilenceTimer(){ if(silenceTimer) clearTimeout(silenceTimer); silenceTimer = setTimeout(()=>{ if(aiRecorder2 && aiRecorder2.state!=='inactive') aiRecorder2.stop(); }, 10000); }
    aiRecorder2.onstart = ()=>{
      state['_'+prefix+'Mic2Listening'] = true;
      mic2StartTime = Date.now();
      updateMic2UiOnly(true, false);
      resetSilenceTimer();
      volumeCheckInterval = setInterval(()=>{
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a,b)=>a+b,0) / dataArray.length;
        if(avg > SILENCE_THRESHOLD) resetSilenceTimer();
      }, 300);
      // Chạm giới hạn thời lượng tối đa -> tự động dừng NGAY, hệ thống sẽ tự gửi lên AI xử lý luôn
      // (logic xử lý nằm sẵn trong onstop, không cần thêm gì ở đây).
      maxDurationTimer = setTimeout(()=>{ if(aiRecorder2 && aiRecorder2.state!=='inactive') aiRecorder2.stop(); }, MAX_RECORD_DURATION_MS);
    };
    aiRecorder2.onstop = async ()=>{
      state['_'+prefix+'Mic2Listening'] = false;
      if(silenceTimer) clearTimeout(silenceTimer);
      if(maxDurationTimer) clearTimeout(maxDurationTimer);
      if(volumeCheckInterval) clearInterval(volumeCheckInterval);
      try{ audioCtx.close(); }catch(e){}
      stream.getTracks().forEach(t=> t.stop());
      // Đã bấm "Huỷ tất cả" trong lúc đang ghi âm -> dừng hẳn tại đây, KHÔNG gửi gì lên AI cả, trở về
      // đúng trạng thái ban đầu như chưa từng bấm micro 2.
      if(mic2Cancelled || !chunks.length){ updateMic2UiOnly(false, false); return; }
      updateMic2UiOnly(false, true);
      mic2AbortController = new AbortController();
      try{
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        const base64 = await new Promise((resolve,reject)=>{
          const reader = new FileReader();
          reader.onload = ()=> resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if(mic2Cancelled) return; // vừa bị huỷ trong lúc đang chuyển đổi âm thanh sang base64
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiProvider.model||'gemini-2.5-flash'}:generateContent?key=${geminiProvider.apiKey}`;
        const body = { contents: [{ role:'user', parts: [
          { text: 'Hãy chuyển đổi CHÍNH XÁC đoạn ghi âm sau đây thành văn bản tiếng Việt. CHỈ trả về đúng nội dung văn bản đã nói, không thêm bất kỳ lời giải thích, tiêu đề, hay ký tự thừa nào khác.' },
          { inline_data: { mime_type: mimeType || 'audio/webm', data: base64 } },
        ]}] };
        const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body), signal: mic2AbortController.signal });
        if(!res.ok){
          let msg = `HTTP ${res.status}`;
          try{ const errData = await res.json(); msg = (errData && errData.error && errData.error.message) || msg; }catch(e){}
          throw new Error(msg);
        }
        const data = await res.json();
        if(mic2Cancelled) return; // vừa bị huỷ đúng lúc AI trả lời về xong
        const text = (((data.candidates||[])[0]||{}).content?.parts||[]).map(p=>p.text||'').join('').trim();
        const inputEl = document.getElementById(prefix+'-input');
        if(inputEl && text){ inputEl.value = [baseValueCaptured2, text].filter(Boolean).join(' '); }
        else if(!text){ alert('Không nhận dạng được nội dung nào từ đoạn ghi âm — vui lòng thử lại.'); }
      }catch(err){
        // Bị huỷ chủ động (AbortError, do bấm "Huỷ tất cả") -> im lặng, không phải lỗi thật, khỏi báo.
        if(err && err.name==='AbortError'){ /* im lặng */ }
        else{
          console.error('[Nói xong mới ra chữ] Lỗi:', err);
          alert('Có lỗi khi chuyển đổi âm thanh thành văn bản: '+(err&&err.message||err));
        }
      } finally {
        updateMic2UiOnly(false, false);
      }
    };
    aiRecorder2.start();
  }
  function toggleAiRecordThenTranscribe(){ toggleMic2Generic('ai', renderAiChatOverlay); }
  function toggleNotesMic(){ toggleMicGeneric('sn', renderQuickNoteOverlay); }
  function toggleNotesMic2(){ toggleMic2Generic('sn', renderQuickNoteOverlay); }
  function togglePgMic(){ toggleMicGeneric('pg', renderPropagandaOverlay); }
  function togglePgMic2(){ toggleMic2Generic('pg', renderPropagandaOverlay); }
  function toggleQaiMic(rerenderFn){ toggleMicGeneric('qai', rerenderFn); }
  function toggleQaiMic2(rerenderFn){ toggleMic2Generic('qai', rerenderFn); }
  // Xây dựng System Instruction cho "Chàng Nông dân Thông minh" — gộp cả 4 vai trò yêu cầu,
  // kèm tóm tắt nhanh dữ liệu hộ vay của xã đang mở (phục vụ Vai trò 3: phân tích số liệu).
  // ---------------------------------------------------------------------
  // Huấn luyện AI biết cách tạo FILE THẬT (PowerPoint/Word/Excel/PDF) — dùng CHUNG cho cả Chat AI
  // và Tạo bài Tuyên truyền. AI chỉ cần xuất đúng cú pháp khối mã bên dưới, hệ thống (renderMarkdownLite)
  // sẽ TỰ ĐỘNG nhận diện và hiện thẻ file kèm nút "Tải xuống" — bấm vào là dựng file thật (không
  // phải giả lập): PowerPoint dùng PptxGenJS, Excel dùng SheetJS, Word dùng chuẩn .doc của Office,
  // PDF dùng hộp thoại in của trình duyệt.
  function fileGenerationTrainingText(){
    return `
KHẢ NĂNG TẠO FILE THẬT (PowerPoint/Word/Excel/PDF) VÀ GIỌNG NÓI AI — RẤT QUAN TRỌNG, đồng chí THỰC SỰ làm được:
Khi người dùng muốn có 1 file tải về máy (vd: "làm giúp tôi file PowerPoint", "xuất file Word", "làm file Excel", "tải về", "xuất file", "làm slide trình chiếu"...), hãy đặt ĐÚNG nội dung vào trong 1 khối mã (code fence) với "ngôn ngữ" tương ứng dưới đây — hệ thống sẽ TỰ ĐỘNG dựng thành file thật, hiện kèm nút "⬇️ Tải xuống" ngay dưới câu trả lời của đồng chí để người dùng tải về máy:

1) FILE POWERPOINT/SLIDE TRÌNH CHIẾU (.pptx) — dùng \`\`\`pptx : mỗi slide là 1 đoạn; dòng ĐẦU TIÊN của đoạn là tiêu đề slide; các dòng sau bắt đầu bằng "- " là gạch đầu dòng nội dung; các slide cách nhau bằng 1 dòng CHỈ có đúng 3 dấu gạch ngang "---". Ví dụ:
\`\`\`pptx
Tiêu đề Slide 1
- Ý chính 1
- Ý chính 2
---
Tiêu đề Slide 2
- Ý chính 1
- Ý chính 2
\`\`\`

2) FILE WORD (.docx) — dùng \`\`\`docx : viết nội dung bình thường bằng markdown (in đậm **chữ**, gạch đầu dòng "- ", có thể chèn bảng) bên trong khối.

3) FILE EXCEL (.xlsx) — dùng \`\`\`xlsx : mỗi dòng là 1 hàng, các cột cách nhau bằng dấu phẩy (định dạng CSV), dòng đầu tiên là tiêu đề cột.

4) FILE PDF (in/lưu PDF) — dùng \`\`\`pdf : viết nội dung bằng markdown như file Word, hệ thống sẽ mở hộp thoại in để người dùng chọn "Lưu dưới dạng PDF".

5) GIỌNG NÓI AI (đọc thành tiếng thật ngay trong trình duyệt) — dùng \`\`\`voice : đặt ĐÚNG NGUYÊN VĂN đoạn văn bản cần đọc thành giọng nói vào trong khối (viết câu cú rõ ràng, có dấu câu đầy đủ để đọc tự nhiên, tránh viết tắt). Hệ thống sẽ hiện thẻ có nút "🔊 Nghe giọng đọc AI" để người dùng bấm nghe trực tiếp bằng giọng đọc tiếng Việt có sẵn của trình duyệt/thiết bị — đây là tính năng CÓ THẬT, phát ra âm thanh thật, không phải chỉ mô tả suông. Ví dụ:
\`\`\`voice
Kính thưa bà con nhân dân! Hôm nay Hội Nông dân xã xin thông báo...
\`\`\`

Chỉ dùng các khối trên khi người dùng THỰC SỰ muốn 1 file tải về được hoặc muốn nghe giọng đọc AI. Nếu họ chỉ muốn xem/đọc ngay trong khung chat (không cần tải file) thì trả lời markdown bình thường, KHÔNG cần bọc trong các khối trên. Đồng chí cũng có thể dùng khối mã lập trình bình thường (\`\`\`js, \`\`\`python...) khi được yêu cầu viết code, và dùng bảng markdown (| cột | cột |) khi cần trình bày dạng bảng — cả hai đều tự có nút "Sao chép" riêng.`;
  }

  async function buildAiSystemPrompt(){
    let dataSummary = '';
    const list = (state.borrowers||[]).filter(x=>!x.deleted);
    const projects = activeLoanProjects ? activeLoanProjects() : [];
    if(list.length || projects.length){
      const totalPrincipal = list.reduce((s,x)=> s + (parseFloat(x.principal)||0), 0);
      const today = new Date();
      const in30 = new Date(); in30.setDate(today.getDate()+30);
      const overdue = list.filter(x=> x.dueDate && new Date(x.dueDate) < today).length;
      const dueSoon = list.filter(x=> x.dueDate && new Date(x.dueDate) >= today && new Date(x.dueDate) <= in30).length;
      const byHamlet = {};
      list.forEach(x=>{ const h = x.hamlet||'(chưa rõ)'; byHamlet[h] = (byHamlet[h]||0) + (parseFloat(x.principal)||0); });
      const hamletLines = Object.entries(byHamlet).sort((a,b)=>b[1]-a[1]).slice(0,5)
        .map(([h,v])=>`  • ${h}: ${v.toLocaleString('vi-VN')} đồng`).join('\n');
      const totalCapital = projects.reduce((s,p)=> s + (parseFloat(p.totalCapital)||0), 0);
      const projectLines = projects.slice(0,8).map(p=>`  • ${p.name}: tổng vốn ${money(p.totalCapital)}, đã cho vay ${money(projectDisbursedTotal(p.id))}`).join('\n');
      dataSummary = `\n\nDỮ LIỆU TÓM TẮT HIỆN TẠI của "${(state.config&&state.config.wardName)||wardId()||''}" (chỉ dùng khi người dùng hỏi về số liệu/dư nợ/hộ vay/phương án vay, không tự ý nhắc nếu không được hỏi):
- Tổng số Phương án vay đang có: ${projects.length} (tổng vốn cấu hình: ${totalCapital.toLocaleString('vi-VN')} đồng)
${projectLines? projectLines+'\n' : ''}- Tổng số hộ đang vay: ${list.length}
- Tổng dư nợ gốc: ${totalPrincipal.toLocaleString('vi-VN')} đồng
- Số hộ đã quá hạn trả nợ: ${overdue}
- Số hộ sắp đến hạn trong 30 ngày tới: ${dueSoon}
- Dư nợ theo địa bàn cao nhất (tối đa 5):\n${hamletLines}
(Đây là số liệu tóm tắt tức thời từ phần mềm, có thể không phản ánh 100% chi tiết từng hộ — khuyên người dùng đối chiếu lại Module "Sổ vay vốn" nếu cần độ chính xác tuyệt đối.)`;
    }
    // Yêu cầu mới: nạp "Bối cảnh tri thức" — gộp Nguồn 1 (kho tri thức chung do Admin huấn luyện)
    // và Nguồn 2 (ghi chú cá nhân trong Trung tâm dữ liệu của chính người dùng đang chat) — dùng CHUNG cho mọi model
    // AI, ở mọi tầng dự phòng (Gemini Pro/Flash, ChatGPT, Claude...).
    // KHÁCH THAM QUAN (chưa đăng nhập, chưa có mã định danh thật — state.previewMode) KHÔNG có
    // kho ghi chú cá nhân nào cả -> bỏ qua hẳn bước quét Nguồn 2 cho gọn, chỉ còn Nguồn 1 + kiến thức
    // nền sẵn có của mô hình AI (Nguồn 3).
    let knowledgeBlock = '';
    try{
      const [systemKnowledge, personalNotes] = await Promise.all([
        getSystemKnowledgeCached(),
        state.previewMode ? Promise.resolve('') : getUserQuickNoteKnowledgeCached(),
      ]);
      if(systemKnowledge) knowledgeBlock += `\n\n===== TÀI LIỆU TRI THỨC NỀN DO ADMIN CUNG CẤP (ưu tiên tham khảo khi trả lời nghiệp vụ/hướng dẫn sử dụng) =====\n${systemKnowledge}`;
      if(personalNotes) knowledgeBlock += `\n\n===== SIÊU GHI CHÚ CÁ NHÂN CỦA NGƯỜI ĐANG CHAT (ưu tiên cao nhất — đây là ghi chú riêng của chính họ) =====\n${personalNotes}`;
    }catch(e){ console.error('Nạp Bối cảnh tri thức lỗi:', e); }
    return `Bạn tên là "Chàng Nông dân Thông minh" — trợ lý AI thân thiện, gần gũi, nói năng như một cán bộ Hội Nông dân giàu kinh nghiệm, xưng "Chàng" và LUÔN gọi người dùng là "đồng chí" (tuyệt đối không gọi là "bạn" hay "anh/chị"). Bạn đảm nhiệm 4 vai trò:
1) Trợ lý nghiệp vụ Hội Nông dân: giải đáp nhanh nghiệp vụ công tác hội, công tác hội viên, chính sách, quy chế cho vay, thủ tục gia hạn nợ, lãi suất, quỹ hỗ trợ nông dân.
2) Hướng dẫn sử dụng phần mềm quản lý này: giải thích tính năng, cách nhập liệu, cách thao tác trên các Module (Tổng quan, Sổ vay vốn, Sổ Thu Chi Lãi Quỹ, Thùng rác, Thu-Chi nội bộ, Hồ sơ hội viên, Thực lực Hội, Biểu mẫu khảo sát, Cài đặt & Chia sẻ...).
3) Trợ lý phân tích số liệu: khi được hỏi về dư nợ/hộ vay/thống kê, hãy dựa vào phần "DỮ LIỆU TÓM TẮT HIỆN TẠI" bên dưới (nếu có); nếu không có hoặc không đủ, hãy nói rõ là chưa có dữ liệu và hướng dẫn xem trong Module tương ứng, không được bịa số liệu.
4) Trợ lý AI toàn năng: trả lời mọi câu hỏi kiến thức chung, viết/sửa văn bản, gợi ý code, dịch thuật, tư vấn... như một AI thông thường. Bạn còn tạo được file PowerPoint/Word/Excel/PDF thật cho người dùng tải về (xem hướng dẫn cú pháp bên dưới) — lưu ý: chỉ chưa hỗ trợ tạo/hiển thị hình ảnh, âm thanh, video.
Nếu có mục "TÀI LIỆU TRI THỨC NỀN DO ADMIN CUNG CẤP" và/hoặc "SIÊU GHI CHÚ CÁ NHÂN" bên dưới, hãy ưu tiên dựa vào đó để trả lời chính xác, cá nhân hoá theo đúng quy chế/hướng dẫn/ghi chú riêng của người dùng này, thay vì chỉ dùng kiến thức chung.
Luôn trả lời bằng tiếng Việt (trừ khi được yêu cầu khác), ngắn gọn, dễ hiểu, đúng trọng tâm, có thể dùng gạch đầu dòng khi liệt kê.${dataSummary}${knowledgeBlock}
${fileGenerationTrainingText()}`;
  }

