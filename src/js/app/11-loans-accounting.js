  // ===================================================================
  // "BẢNG ĐỐI CHIẾU & KIỂM ĐỊNH SỐ LIỆU ĐÓNG LÃI - THANH TOÁN KHOẢN VAY" — công cụ kiểm tra/đối
  // chiếu số liệu thường xuyên, tính toán TƯƠI MỚI hoàn toàn mỗi lần mở, không lưu trữ gì cả.
  // ===================================================================
  const AUDIT_C = {
    money:'#1b5e20', lai:'#1565c0', goc:'#e65100', yearCur:'#6a1b9a', yearLast:'#00838f',
    qCur:'#3f51b5', qPrev:'#c2185b', qPrev2:'#880e4f', ho:'#795548', receipt:'#4a148c', confirm:'#0277bd',
  };
  function auditMoney(v){ return `<b style="color:${AUDIT_C.money};">${moneySpaced(Math.round(v||0))}</b>`; }
  function auditLai(){ return `<span style="color:${AUDIT_C.lai}; font-weight:700;">Tiền lãi</span>`; }
  function auditGoc(){ return `<span style="color:${AUDIT_C.goc}; font-weight:700;">Tiền gốc</span>`; }
  function auditYearCur(y){ return `<span style="color:${AUDIT_C.yearCur}; font-weight:700;">Năm ${y}</span>`; }
  function auditYearLast(y){ return `<span style="color:${AUDIT_C.yearLast}; font-weight:700;">Năm ${y} (năm ngoái)</span>`; }
  // qInfo = {qNum, year}; curYear dùng để quyết định có cần ghi rõ năm hay không (chỉ ẩn năm khi
  // trùng đúng năm hiện tại — Quý hiện tại luôn ẩn năm, các Quý trước nếu khác năm PHẢI ghi rõ năm).
  function auditQLabel(qInfo, curYear, kind){
    const base = `Quý ${qInfo.qNum}` + (qInfo.year!==curYear? ` -${qInfo.year}` : '');
    const suffix = kind==='cur'? ' (Quý hiện tại)' : kind==='prev'? ' (Quý trước)' : ' (Quý trước nữa)';
    const color = kind==='cur'? AUDIT_C.qCur : kind==='prev'? AUDIT_C.qPrev : AUDIT_C.qPrev2;
    return `<span style="color:${color}; font-weight:700;">${base}${suffix}</span>`;
  }
  function auditHo(){ return `<span style="color:${AUDIT_C.ho};">hộ vay</span>`; }
  function auditReceipt(){ return `<span style="color:${AUDIT_C.receipt}; font-weight:700;">Biên lai</span>`; }
  function auditConfirm(){ return `<span style="color:${AUDIT_C.confirm}; font-weight:700;">Giấy xác nhận</span>`; }

  function computeAuditStats(hamletFilter, projectFilter, fundSourceFilter){
    const hamletOk = (b)=> (!hamletFilter || hamletFilter.includes(b.hamlet)) && (!projectFilter || projectFilter.includes(b.projectId)) && (!fundSourceFilter || fundSourceFilter.includes((b.fundSource||'').trim()));
    const allActive = state.borrowers.filter(b=>!b.deleted && !b.settled && hamletOk(b));
    const allSettled = state.borrowers.filter(b=>!b.deleted && b.settled && hamletOk(b));
    const allNonDeleted = state.borrowers.filter(b=>!b.deleted && hamletOk(b));
    const curYear = new Date().getFullYear();
    const lastYear = curYear-1;
    const curQNum = parseInt(todayBasedQuarterKey().replace('q',''),10);
    let prevQNum = curQNum-1, prevQYear = curYear;
    if(prevQNum<1){ prevQNum=4; prevQYear=curYear-1; }
    const curQk = 'q'+curQNum, prevQk = 'q'+prevQNum;
    // Lùi lại "offset" Quý so với (qNum, year) — dùng cho các dòng "Quý trước nữa".
    function quarterGoBack(qNum, year, offset){
      let q = qNum - offset, y = year;
      while(q<1){ q+=4; y-=1; }
      return { qNum:q, year:y, qk:'q'+q };
    }
    const qMinus2 = quarterGoBack(curQNum, curYear, 2);
    const qMinus3 = quarterGoBack(curQNum, curYear, 3);

    function sumInterestQ(list, qk, year, wantPaid){
      let s=0;
      list.forEach(b=>{ const disp=computeInterestPaymentBoxDisplay(b); disp.allBoxes.forEach(bx=>{ if(bx.qk===qk && bx.year===year && disp.paidKeys.has(bx.key)===wantPaid) s+=bx.interestAmount; }); });
      return s;
    }
    function sumInterestYear(list, year, wantPaid){
      let s=0;
      list.forEach(b=>{ const disp=computeInterestPaymentBoxDisplay(b); disp.allBoxes.forEach(bx=>{ if(bx.year===year && disp.paidKeys.has(bx.key)===wantPaid) s+=bx.interestAmount; }); });
      return s;
    }
    function countQApprovedYear(list, year){
      let c=0;
      list.forEach(b=>{ const disp=computeInterestPaymentBoxDisplay(b); disp.allBoxes.forEach(bx=>{ if(bx.year===year && disp.paidKeys.has(bx.key)) c++; }); });
      return c;
    }
    // "Luỹ kế từ trước đến nay ĐÃ PHÊ DUYỆT" — PHẢI dùng ĐÚNG CÙNG 1 phương pháp với sumInterestYear/
    // sumInterestQ ở trên (duyệt qua allBoxes, chỉ cộng đúng Quý có paidKeys=true) để đảm bảo nhất quán
    // TUYỆT ĐỐI — không dùng "paidSum" nữa (dù về lý thuyết 2 cách phải cho cùng kết quả, nhưng đã phát
    // hiện có sai lệch trên thực tế mà chưa xác định được nguyên nhân sâu xa, nên chuyển hẳn sang cách
    // tính đã được xác nhận đúng và đang dùng nhất quán cho mọi dòng Quý/Năm khác trong cùng bảng này).
    let interestAllTimeApproved=0;
    allNonDeleted.forEach(b=>{
      const disp = computeInterestPaymentBoxDisplay(b);
      disp.allBoxes.forEach(bx=>{ if(disp.paidKeys.has(bx.key)) interestAllTimeApproved += bx.interestAmount; });
    });

    // Nhóm B: tiền gốc theo hạn
    let principalDueSoon=0, principalOverdue=0, countDueSoon=0, countOverdue=0;
    allActive.forEach(b=>{
      const proj = projectOf(b);
      const exts = getBorrowerExtensions(b.id);
      const dueRef = exts.length? exts[exts.length-1].to : (proj? proj.dueDate : b.dueDate);
      const dLeft = daysRemainingUntil(dueRef);
      if(dLeft!=null){
        if(dLeft>0 && dLeft<=60){ principalDueSoon += parseFloat(b.principal)||0; countDueSoon++; }
        if(dLeft<=0){ principalOverdue += parseFloat(b.principal)||0; countOverdue++; }
      }
    });

    // Nhóm C: lãi quá hạn — TOÀN BỘ tiền lãi (chưa đóng/đã đóng) tính TỪ QUÁ KHỨ tới đúng Quý TRƯỚC
    // Quý hiện tại 1 Quý (KHÔNG tính Quý hiện tại và các Quý tương lai).
    const quarterOrdinalValue = (qk, year)=> year*4 + parseInt(String(qk).replace('q',''),10);
    const curQOrdinalForOverdue = quarterOrdinalValue(curQk, curYear);
    let overdueInterestUnapproved=0, overdueInterestApproved=0, countOverdueInterest=0;
    allActive.forEach(b=>{
      const disp = computeInterestPaymentBoxDisplay(b);
      let hasUnpaidBefore = false;
      disp.allBoxes.forEach(bx=>{
        if(quarterOrdinalValue(bx.qk, bx.year) < curQOrdinalForOverdue){
          if(disp.paidKeys.has(bx.key)) overdueInterestApproved += bx.interestAmount;
          else { overdueInterestUnapproved += bx.interestAmount; hasUnpaidBefore = true; }
        }
      });
      if(hasUnpaidBefore) countOverdueInterest++;
    });

    // Nhóm D+E: Tất toán / Trả nợ trước hạn
    let principalSettledYear=0, principalSettledAllTime=0, countSettledYear=0, interestSettledYear=0;
    let principalSettledLastYear=0, countSettledLastYear=0, interestSettledLastYear=0;
    let principalEarlyYear=0, principalEarlyAllTime=0, countEarlyYear=0, interestEarlyYear=0;
    let principalEarlyLastYear=0, countEarlyLastYear=0, interestEarlyLastYear=0;
    allSettled.forEach(b=>{
      const y = b.settledAt? new Date(b.settledAt).getFullYear() : null;
      const isFinal = b.settledType==='final';
      const p = parseFloat(b.principal)||0;
      const interest = b.settledInterestIncluded||0;
      if(isFinal){
        principalSettledAllTime += p;
        if(y===curYear){ principalSettledYear+=p; countSettledYear++; interestSettledYear+=interest; }
        if(y===lastYear){ principalSettledLastYear+=p; countSettledLastYear++; interestSettledLastYear+=interest; }
      } else {
        principalEarlyAllTime += p;
        if(y===curYear){ principalEarlyYear+=p; countEarlyYear++; interestEarlyYear+=interest; }
        if(y===lastYear){ principalEarlyLastYear+=p; countEarlyLastYear++; interestEarlyLastYear+=interest; }
      }
    });

    // Nhóm F: đã tất toán/TNTH còn nợ lãi
    const settledUnpaidList = allSettled.filter(b=> computeInterestPaymentBoxDisplay(b).unpaidTotal>0);
    const settledUnpaidCount = settledUnpaidList.length;
    const settledUnpaidTotal = settledUnpaidList.reduce((s,b)=> s+computeInterestPaymentBoxDisplay(b).unpaidTotal, 0);

    // Nhóm G: gia hạn nợ
    let extCount=0, extPrincipalTotal=0, extApprovedThisYear=0, extApprovedLastYear=0;
    allActive.forEach(b=>{
      const exts = getBorrowerExtensions(b.id);
      if(exts.length){
        extCount++; extPrincipalTotal += parseFloat(b.principal)||0;
        exts.forEach(e=>{ if(e.savedAt){ const y=new Date(e.savedAt).getFullYear(); if(y===curYear) extApprovedThisYear++; if(y===lastYear) extApprovedLastYear++; } });
      }
    });

    // Nhóm H: nợ rủi ro
    const riskDebtCount = allActive.filter(b=> b.riskDebt && !b.badDebt).length;
    const badDebtCount = allActive.filter(b=> b.badDebt).length;
    const riskDebtPrincipal = allActive.filter(b=>b.riskDebt && !b.badDebt).reduce((s,b)=>s+(parseFloat(b.principal)||0),0);
    const badDebtPrincipal = allActive.filter(b=>b.badDebt).reduce((s,b)=>s+(parseFloat(b.principal)||0),0);

    // Nhóm I: tiền dư
    let leftoverTotal=0, leftoverCount=0;
    allNonDeleted.forEach(b=>{ const l=computeInterestPaymentBoxDisplay(b).leftover; if(l>0){ leftoverTotal+=l; leftoverCount++; } });

    // Nhóm J: biên lai / giấy xác nhận / nhật ký
    const logEntries = buildActivityLogEntries();
    const yearOf = (e)=>{ const d=new Date(e.createdAt); return isNaN(d.getTime())? null : d.getFullYear(); };
    const receiptCountYear = logEntries.filter(e=> e.type==='receipt' && yearOf(e)===curYear).length;
    const receiptCountLastYear = logEntries.filter(e=> e.type==='receipt' && yearOf(e)===lastYear).length;
    const confCountYear = logEntries.filter(e=> e.type==='confirmation' && yearOf(e)===curYear).length;
    const confCountLastYear = logEntries.filter(e=> e.type==='confirmation' && yearOf(e)===lastYear).length;
    const logCountYear = logEntries.filter(e=> yearOf(e)===curYear).length;
    const logCountLastYear = logEntries.filter(e=> yearOf(e)===lastYear).length;
    const sumReceiptAmount = (sign, year)=> logEntries.filter(e=> e.type==='receipt' && e.sign===sign && yearOf(e)===year).reduce((s,e)=> s+(e.amount||0), 0);

    return {
      curYear, lastYear, curQNum, prevQNum, prevQYear, curQk, prevQk, qMinus2, qMinus3,
      interestQCurUnapproved: sumInterestQ(allNonDeleted, curQk, curYear, false),
      interestQCurApproved: sumInterestQ(allNonDeleted, curQk, curYear, true),
      interestQPrevUnapproved: sumInterestQ(allNonDeleted, prevQk, prevQYear, false),
      interestQPrevApproved: sumInterestQ(allNonDeleted, prevQk, prevQYear, true),
      interestQMinus2Unapproved: sumInterestQ(allNonDeleted, qMinus2.qk, qMinus2.year, false),
      interestQMinus2Approved: sumInterestQ(allNonDeleted, qMinus2.qk, qMinus2.year, true),
      interestQMinus3Unapproved: sumInterestQ(allNonDeleted, qMinus3.qk, qMinus3.year, false),
      interestQMinus3Approved: sumInterestQ(allNonDeleted, qMinus3.qk, qMinus3.year, true),
      interestYearCurUnapproved: sumInterestYear(allNonDeleted, curYear, false),
      interestYearCurApproved: sumInterestYear(allNonDeleted, curYear, true),
      interestYearLastUnapproved: sumInterestYear(allNonDeleted, lastYear, false),
      interestYearLastApproved: sumInterestYear(allNonDeleted, lastYear, true),
      interestAllTimeApproved,
      qApprovedCountCurYear: countQApprovedYear(allNonDeleted, curYear),
      qApprovedCountLastYear: countQApprovedYear(allNonDeleted, lastYear),
      principalDueSoon, principalOverdue, countDueSoon, countOverdue,
      overdueInterestUnapproved, overdueInterestApproved, countOverdueInterest,
      principalSettledYear, principalSettledAllTime, countSettledYear, interestSettledYear,
      principalSettledLastYear, countSettledLastYear, interestSettledLastYear,
      principalEarlyYear, principalEarlyAllTime, countEarlyYear, interestEarlyYear,
      principalEarlyLastYear, countEarlyLastYear, interestEarlyLastYear,
      settledUnpaidCount, settledUnpaidTotal,
      extCount, extPrincipalTotal, extApprovedThisYear, extApprovedLastYear,
      riskDebtCount, badDebtCount, riskDebtPrincipal, badDebtPrincipal,
      leftoverTotal, leftoverCount,
      receiptCountYear, receiptCountLastYear, confCountYear, confCountLastYear, logCountYear, logCountLastYear,
      sumReceiptPlusYear: sumReceiptAmount('+', curYear), sumReceiptPlusLastYear: sumReceiptAmount('+', lastYear),
      sumReceiptMinusYear: sumReceiptAmount('-', curYear), sumReceiptMinusLastYear: sumReceiptAmount('-', lastYear),
    };
  }

  // Tính số tiền lãi ĐÃ ĐƯỢC PHÊ DUYỆT (đã đóng) phân bổ về từng cấp (Trung ương/Tỉnh/Xã/Khu dân cư),
  // cho từng mốc thời gian (Quý hiện tại/trước/trước nữa x2, Năm hiện tại/ngoái, luỹ kế). Tôn trọng
  // đúng tỷ lệ % phân bổ đã lưu trên từng hồ sơ vay (b.splitCentral/splitProvince/splitWard) và tỷ lệ
  // Xã chia lại cho Khu dân cư (b.hamletAllocPercent — CHIA RA từ phần của Xã, không phải cộng thêm).
  function computeInterestLevelStats(hamletFilter, managerFilter, projectFilter, fundSourceFilter){
    const filterOk = (b)=> (!hamletFilter || hamletFilter.includes(b.hamlet)) && (!managerFilter || managerFilter.includes(b.managerId||'chihoitruong')) && (!projectFilter || projectFilter.includes(b.projectId)) && (!fundSourceFilter || fundSourceFilter.includes((b.fundSource||'').trim()));
    const list = state.borrowers.filter(b=>!b.deleted && filterOk(b));
    const curYear = new Date().getFullYear();
    const lastYear = curYear-1;
    const curQNum = parseInt(todayBasedQuarterKey().replace('q',''),10);
    const curQk = 'q'+curQNum;
    function quarterGoBack(qNum, year, offset){
      let q=qNum-offset, y=year;
      while(q<1){ q+=4; y-=1; }
      return { qNum:q, year:y, qk:'q'+q };
    }
    const prevQ = quarterGoBack(curQNum, curYear, 1);
    const qMinus2 = quarterGoBack(curQNum, curYear, 2);
    const qMinus3 = quarterGoBack(curQNum, curYear, 3);
    function sumForPeriod(qk, year){
      let central=0, province=0, ward=0, hamlet=0, total=0;
      list.forEach(b=>{
        const disp = computeInterestPaymentBoxDisplay(b);
        let bTotal=0;
        disp.allBoxes.forEach(bx=>{
          if(!disp.paidKeys.has(bx.key)) return;
          // year===null -> KHÔNG lọc theo thời gian nữa, cộng dồn TẤT CẢ các Quý đã đóng lãi (đã phê
          // duyệt) từ trước tới nay — dùng cho "luỹ kế từ trước đến nay" (xem sumAllTime() bên dưới).
          if(year==null){ bTotal += bx.interestAmount; return; }
          if(qk? (bx.qk===qk && bx.year===year) : (bx.year===year)) bTotal += bx.interestAmount;
        });
        if(bTotal<=0) return;
        const rate = parseFloat(b.rate)||0;
        if(rate<=0) return;
        const c = bTotal*(parseFloat(b.splitCentral)||0)/rate;
        const p = bTotal*(parseFloat(b.splitProvince)||0)/rate;
        const w = bTotal*(parseFloat(b.splitWard)||0)/rate;
        const h = w*(parseFloat(b.hamletAllocPercent)||0)/100;
        central+=c; province+=p; ward+=w; hamlet+=h; total+=bTotal;
      });
      return { central, province, ward, hamlet, total };
    }
    // "Luỹ kế từ trước đến nay" — QUAN TRỌNG: PHẢI dùng ĐÚNG CÙNG 1 logic với sumForPeriod ở trên (chỉ
    // tính các Quý ĐÃ THẬT SỰ được đánh dấu "đã đóng lãi/đã phê duyệt", không tính Quý chưa đóng) — chứ
    // KHÔNG được dùng nguồn dữ liệu/logic khác (trước đây dùng computeBorrowerAllocations, một hàm
    // hoàn toàn KHÁC, gây ra kết quả không nhất quán, "luỹ kế" lại nhỏ hơn tổng các Quý/Năm cộng lại —
    // đây là lỗi thật đã được xác nhận và sửa dứt điểm tại đây).
    function sumAllTime(){ return sumForPeriod(null, null); }
    return {
      curYear, lastYear, curQNum, curQk, prevQ, qMinus2, qMinus3,
      cur: sumForPeriod(curQk, curYear), prev: sumForPeriod(prevQ.qk, prevQ.year),
      m2: sumForPeriod(qMinus2.qk, qMinus2.year), m3: sumForPeriod(qMinus3.qk, qMinus3.year),
      yearCur: sumForPeriod(null, curYear), yearLast: sumForPeriod(null, lastYear),
      allTime: sumAllTime(),
    };
  }
  function renderLevelAllocationModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    let timerId = null;
    const close = ()=>{ if(timerId) clearInterval(timerId); wrap.remove(); };
    const LC = { total:'#4a148c', central:'#c62828', province:'#ef6c00', ward:'#2e7d32', hamlet:'#0277bd',
      money:'#1b5e20', qCur:'#3f51b5', qPrev:'#c2185b', qPrev2:'#880e4f', yearCur:'#6a1b9a', yearLast:'#00838f' };
    function lvlMoney(v){ return `<b style="color:${LC.money};">${moneySpaced(Math.round(v||0))}</b>`; }
    function render(){
      // Lưu lại vị trí cuộn của menu bộ lọc ĐANG MỞ (nếu có) trước khi vẽ lại toàn bộ modal — vì vẽ
      // lại sẽ tạo DOM MỚI hoàn toàn, tự động mất vị trí cuộn cũ. Khôi phục lại NGAY SAU khi vẽ xong.
      const __openFilterPanel = document.querySelector('.sv-filter-panel');
      const __savedScrollTop = __openFilterPanel? __openFilterPanel.scrollTop : null;
      const hamlets = state.config.hamlets||[];
      const managers = ensureDefaultManagers();
      const allProjectsForFilter = svAllProjectsForFilterSorted();
      const allFundSourcesForFilter = fundSourcesInUse();
      if(!state.levelAllocFilterHamlets) state.levelAllocFilterHamlets = hamlets.slice();
      if(!state.levelAllocFilterManagers) state.levelAllocFilterManagers = managers.map(m=>m.id);
      if(!state.levelAllocFilterProjectIds) state.levelAllocFilterProjectIds = allProjectsForFilter.map(p=>p.id);
      if(!state.levelAllocFilterFundSources) state.levelAllocFilterFundSources = allFundSourcesForFilter.slice();
      const hamletAllSel = state.levelAllocFilterHamlets.length===hamlets.length;
      const managerAllSel = state.levelAllocFilterManagers.length===managers.length;
      const isFiltered = !hamletAllSel || !managerAllSel;
      const hamletFilter = hamletAllSel? null : state.levelAllocFilterHamlets;
      const managerFilter = managerAllSel? null : state.levelAllocFilterManagers;
      const projectAllSel = state.levelAllocFilterProjectIds.length===allProjectsForFilter.length;
      const fundSourceAllSel = state.levelAllocFilterFundSources.length===allFundSourcesForFilter.length;
      const projectFilter = projectAllSel? null : state.levelAllocFilterProjectIds;
      const fundSourceFilter = fundSourceAllSel? null : state.levelAllocFilterFundSources;
      const s = computeInterestLevelStats(hamletFilter, managerFilter, projectFilter, fundSourceFilter);
      const qCurInfo = {qNum:s.curQNum, year:s.curYear};
      const ROMAN = ['I','II','III','IV','V'];
      let groupIdx = 0;
      function group(title, titleColor, field, extraNote){
        groupIdx++;
        const roman = ROMAN[groupIdx-1];
        if(isFiltered && groupIdx!==5) return '';
        const lines = [
          [`Số tiền lãi phân bổ trong ${auditQLabel(qCurInfo, s.curYear, 'cur')} là`, lvlMoney(s.cur[field])],
          [`Số tiền lãi phân bổ trong ${auditQLabel(s.prevQ, s.curYear, 'prev')} là`, lvlMoney(s.prev[field])],
          [`Số tiền lãi phân bổ trong ${auditQLabel(s.qMinus2, s.curYear, 'prev2')} là`, lvlMoney(s.m2[field])],
          [`Số tiền lãi phân bổ trong ${auditQLabel(s.qMinus3, s.curYear, 'prev2')} là`, lvlMoney(s.m3[field])],
          [`Số tiền lãi phân bổ trong ${auditYearCur(s.curYear)} là`, lvlMoney(s.yearCur[field])],
          [`Số tiền lãi phân bổ trong ${auditYearLast(s.lastYear)} là`, lvlMoney(s.yearLast[field])],
          [`Số tiền lãi phân bổ luỹ kế từ trước đến nay là`, lvlMoney(s.allTime[field])],
        ];
        // Mỗi dòng SỐ TIỀN được tách thành 2 dòng riêng: dòng CHỮ (căn trái) ở trên, dòng SỐ TIỀN (căn
        // phải, đậm) ở dưới — dễ đọc, dễ đối chiếu số liệu hơn khi các con số dài ngắn khác nhau.
        const rowsHtml = lines.map(([label,money],i)=>`<div style="padding:10px 14px; background:#fff; border-top:1px solid var(--line);">
          <div style="text-align:left;"><b>${i+1}.</b> ${label}</div>
          <div style="text-align:right; font-weight:800; font-size:15px; margin-top:2px;">${money}</div>
        </div>`).join('');
        const noteHtml = extraNote? `<div style="padding:10px 14px; background:#fff; border-top:1px solid var(--line);">${extraNote}</div>` : '';
        return `<div style="margin-bottom:16px; border:1px solid var(--line); border-radius:10px; overflow:hidden;">
          <div style="background:#fff; padding:10px 14px; border-bottom:2px solid ${titleColor};"><b style="color:${titleColor}; font-size:14px;">${roman}. ${title}</b></div>
          <div>${rowsHtml}${noteHtml}</div>
        </div>`;
      }
      const groupsHtml = [
        group('🏛️ Tất cả 3 cấp (TW; tỉnh/Tp; xã/phường)', LC.total, 'total'),
        group('🏙️ Cấp Trung ương', LC.central, 'central'),
        group('🏢 Cấp Tỉnh/Thành phố', LC.province, 'province'),
        group('🏘️ Cấp xã/phường', LC.ward, 'ward'),
        group('🏠 Cấp Khu dân cư trực thuộc', LC.hamlet, 'hamlet',
          `<span class="sub" style="font-style:italic;">Ghi chú: Số tiền của cấp Khu dân cư trực thuộc KHÔNG phải nhận trực tiếp từ việc phân bổ lãi suất của các cấp, mà được cấp xã/phường CHIA LẠI từ chính số tiền lãi cấp xã/phường đã nhận được, theo đúng tỷ lệ quy định chung của xã/phường hoặc quy định riêng của từng khoản vay.</span>`),
      ].join('');
      const now = new Date();
      const dateLbl = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
      const bodyEl = wrap.querySelector('#lvlalloc-body-inner');
      const hamletDropdown = `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="lvlalloc-hamlet-btn" style="${!hamletAllSel?'border:2px solid #b71c1c;':''}">📍 Địa phương (${state.levelAllocFilterHamlets.length})</button>
        ${state.openFilterDropdown==='lvlalloc-hamlet'? `<div class="sv-filter-panel">
          <label class="sv-filter-item"><input type="checkbox" id="lvlalloc-hamlet-all" class="preview-allow" ${hamletAllSel?'checked':''}><span><b>Tất cả địa phương</b></span></label>
          ${hamlets.map(h=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow lvlalloc-hamlet-item" data-h="${escapeHtml(h)}" ${state.levelAllocFilterHamlets.includes(h)?'checked':''}><span>${escapeHtml(h)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
      const managerDropdown = `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="lvlalloc-manager-btn" style="${!managerAllSel?'border:2px solid #b71c1c;':''}">👤 Người quản lý (${state.levelAllocFilterManagers.length})</button>
        ${state.openFilterDropdown==='lvlalloc-manager'? `<div class="sv-filter-panel">
          <label class="sv-filter-item"><input type="checkbox" id="lvlalloc-manager-all" class="preview-allow" ${managerAllSel?'checked':''}><span><b>Tất cả người quản lý</b></span></label>
          ${managers.map(m=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow lvlalloc-manager-item" data-m="${m.id}" ${state.levelAllocFilterManagers.includes(m.id)?'checked':''}><span>${escapeHtml(m.name)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
      const projectDropdown = svProjectFilterDropdownHtml('lvlalloc', state.levelAllocFilterProjectIds, allProjectsForFilter);
      const fundSourceDropdown = svFundSourceFilterDropdownHtml('lvlalloc', state.levelAllocFilterFundSources, allFundSourcesForFilter);
      const bodyHtml = `
          <p style="color:#000; line-height:1.7; margin:0 0 8px;">Đây là bảng tự động thống kê chi tiết số tiền lãi được phân bổ về từng cấp quản lý (Trung ương, Tỉnh/Thành phố, Xã/phường, Khu dân cư trực thuộc), dựa trên đúng tỷ lệ % phân bổ đã cấu hình cho từng khoản vay và số tiền lãi ĐÃ ĐƯỢC PHÊ DUYỆT (đã đóng) trong từng mốc thời gian. Dùng để đối chiếu số tiền mỗi cấp thực nhận được so với sổ sách báo cáo lên cấp trên.</p>
          <p style="color:#000; font-weight:700; margin:0 0 14px;">Được tính vào ngày ${dateLbl}</p>
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            ${hamletDropdown}
            ${projectDropdown}
            ${fundSourceDropdown}
            ${managerDropdown}
            <button type="button" class="btn btn-ghost btn-sm preview-allow ${(!hamletAllSel || !managerAllSel || !projectAllSel || !fundSourceAllSel)?'reset-filter-active':''}" id="lvlalloc-reset-btn">↺ Khôi phục bộ lọc gốc</button>${exportPrintButtonsHtml('lvlalloc-ep')}
          </div>
          <p style="font-weight:700; margin:0 0 14px;"><span style="color:#1565c0;">${hamletAllSel? 'Đang chọn tất cả địa phương' : (state.levelAllocFilterHamlets.length? `Đang chọn ${state.levelAllocFilterHamlets.length} địa phương: ${state.levelAllocFilterHamlets.map(escapeHtml).join(', ')}` : 'Đang KHÔNG chọn địa phương nào cả (0 địa phương)')}</span> — <span style="color:#6a1b9a;">${managerAllSel? 'Đang chọn tất cả người quản lý' : (state.levelAllocFilterManagers.length? `Đang chọn ${state.levelAllocFilterManagers.length} người quản lý: ${state.levelAllocFilterManagers.map(id=>{ const m=managers.find(x=>x.id===id); return escapeHtml(m? m.name : id); }).join(', ')}` : 'Đang KHÔNG chọn người quản lý nào cả (0 người)')}</span>${svProjectFundSourceSummaryText(state.levelAllocFilterProjectIds, allProjectsForFilter, state.levelAllocFilterFundSources, allFundSourcesForFilter)}${isFiltered? ' — vì vậy chỉ Nhóm V (Khu dân cư trực thuộc) còn hợp lý để hiển thị, các nhóm còn lại đã tự ẩn.' : ''}</p>
          ${groupsHtml}`;
      function wireFilters(container){
        const hb = container.querySelector('#lvlalloc-hamlet-btn'); if(hb) hb.onclick=(e)=>{ e.stopPropagation(); state.openFilterDropdown = state.openFilterDropdown==='lvlalloc-hamlet'?null:'lvlalloc-hamlet'; render(); };
        const mb = container.querySelector('#lvlalloc-manager-btn'); if(mb) mb.onclick=(e)=>{ e.stopPropagation(); state.openFilterDropdown = state.openFilterDropdown==='lvlalloc-manager'?null:'lvlalloc-manager'; render(); };
        const hAll = container.querySelector('#lvlalloc-hamlet-all'); if(hAll) hAll.onclick=(e)=>{ e.stopPropagation(); state.levelAllocFilterHamlets = hAll.checked? hamlets.slice() : []; render(); };
        container.querySelectorAll('.lvlalloc-hamlet-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const h=cb.dataset.h; state.levelAllocFilterHamlets = cb.checked? state.levelAllocFilterHamlets.concat([h]) : state.levelAllocFilterHamlets.filter(x=>x!==h); render(); });
        const mAll = container.querySelector('#lvlalloc-manager-all'); if(mAll) mAll.onclick=(e)=>{ e.stopPropagation(); state.levelAllocFilterManagers = mAll.checked? managers.map(m=>m.id) : []; render(); };
        container.querySelectorAll('.lvlalloc-manager-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const m=cb.dataset.m; state.levelAllocFilterManagers = cb.checked? state.levelAllocFilterManagers.concat([m]) : state.levelAllocFilterManagers.filter(x=>x!==m); render(); });
        wireSvProjectAndFundSourceFilters(container, 'lvlalloc', 'levelAllocFilterProjectIds', 'levelAllocFilterFundSources', allProjectsForFilter, allFundSourcesForFilter, render);
        const rb = container.querySelector('#lvlalloc-reset-btn'); if(rb) rb.onclick = ()=>{ state.levelAllocFilterHamlets = hamlets.slice(); state.levelAllocFilterManagers = managers.map(m=>m.id); state.levelAllocFilterProjectIds = allProjectsForFilter.map(p=>p.id); state.levelAllocFilterFundSources = allFundSourcesForFilter.slice(); state.openFilterDropdown = null; render(); };
        wireExportPrintButtons(wrap, 'lvlalloc-ep', '#lvlalloc-body-inner', 'Thống kê phân bổ tiền lãi các cấp');
        if(!wrap._lvlallocOutsideClickBound){
          wrap._lvlallocOutsideClickBound = true;
          document.addEventListener('click', (e)=>{
            if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
            if(e.target.closest('.sv-filter-dropdown')) return;
            state.openFilterDropdown = null;
            if(document.body.contains(wrap)) render();
          });
        }
      }
      if(bodyEl){ bodyEl.innerHTML = bodyHtml; wireFilters(bodyEl); return; }
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:900px; border:6px solid #00acc1;">
          <div class="modal-head" style="background:linear-gradient(180deg, #4dd0e1 0%, #00acc1 50%, #00838f 100%);"><h3 style="color:#000;">${waveTextHtmlSlow('📊 Thống kê phân bổ tiền lãi các cấp')}</h3><button class="modal-close preview-allow" id="lvlalloc-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; overflow:auto;">
            <div id="lvlalloc-body-inner">${bodyHtml}</div>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="lvlalloc-close2">Đóng bảng</button></div>
        </div>`;
      wrap.querySelector('#lvlalloc-close').onclick = close;
      wrap.querySelector('#lvlalloc-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wireFilters(wrap);
      if(__savedScrollTop!=null){
        const __newPanel = wrap.querySelector('.sv-filter-panel');
        if(__newPanel) __newPanel.scrollTop = __savedScrollTop;
      }
    }
    render();
    // Đồng hồ tự vẽ lại mỗi giây (để cập nhật số liệu + giờ hiện tại theo thời gian thực) — NHƯNG nếu
    // đang có 1 menu thả xuống (bộ lọc) đang mở và người dùng đang cuộn xem danh sách bên trong nó, thì
    // GIỮ NGUYÊN vị trí cuộn đó qua mỗi lần vẽ lại, tránh bị đẩy về đầu danh sách liên tục mỗi giây.
    timerId = setInterval(()=>{
      const openPanel = document.querySelector('.sv-filter-panel');
      const savedScrollTop = openPanel? openPanel.scrollTop : null;
      render();
      if(savedScrollTop!=null){
        const newPanel = document.querySelector('.sv-filter-panel');
        if(newPanel) newPanel.scrollTop = savedScrollTop;
      }
    }, 1000);
  }
  function renderAuditStatsModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    let timerId = null;
    const close = ()=>{ if(timerId) clearInterval(timerId); wrap.remove(); };
    const AUDIT_GROUP_NAMES = [
      '💰 Tiền lãi theo Quý/Năm', '⏰ Lãi quá hạn (Lãi tồn)', '💧 Tiền dư', '🏦 Tiền gốc theo hạn',
      '✅ Tất toán khoản vay', '📤 Trả nợ trước hạn', '⚠️ Đã tất toán/TNTH nhưng còn nợ lãi',
      '📅 Gia hạn nợ', '🚨 Nợ rủi ro', '📋 Biên lai / Giấy xác nhận / Dòng nhật ký',
    ];
    function render(){
      const __openFilterPanel = document.querySelector('.sv-filter-panel');
      const __savedScrollTop = __openFilterPanel? __openFilterPanel.scrollTop : null;
      const hamlets = state.config.hamlets||[];
      const allProjectsForFilter = svAllProjectsForFilterSorted();
      const allFundSourcesForFilter = fundSourcesInUse();
      if(!state.auditFilterHamlets) state.auditFilterHamlets = hamlets.slice();
      if(!state.auditFilterGroups) state.auditFilterGroups = AUDIT_GROUP_NAMES.map((_,i)=>i+1);
      if(!state.auditFilterProjectIds) state.auditFilterProjectIds = allProjectsForFilter.map(p=>p.id);
      if(!state.auditFilterFundSources) state.auditFilterFundSources = allFundSourcesForFilter.slice();
      const hamletFilter = state.auditFilterHamlets.length < hamlets.length ? state.auditFilterHamlets : null;
      const projectAllSel = state.auditFilterProjectIds.length===allProjectsForFilter.length;
      const fundSourceAllSel = state.auditFilterFundSources.length===allFundSourcesForFilter.length;
      const projectFilter = projectAllSel? null : state.auditFilterProjectIds;
      const fundSourceFilter = fundSourceAllSel? null : state.auditFilterFundSources;
      const s = computeAuditStats(hamletFilter, projectFilter, fundSourceFilter);
      const qCurInfo = {qNum:s.curQNum, year:s.curYear};
      const qPrevInfo = {qNum:s.prevQNum, year:s.prevQYear};
      const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
      let groupIdx = 0;
      // Nhận diện mẫu "...là {giá trị}" ở CUỐI chuỗi — giá trị có thể là tiền (kết thúc bằng "đ", có
      // thể có thẻ <u>...</u> ngay trước) hoặc số lượng in đậm (<b>...</b>). Nếu khớp, tách thành 2
      // dòng riêng: dòng CHỮ (căn trái) ở trên, dòng GIÁ TRỊ (căn phải, đậm) ở dưới. Dòng nào KHÔNG
      // khớp mẫu này (VD dòng ghi chú/giải thích) thì giữ nguyên hiển thị 1 dòng như cũ, không tách.
      function splitLabelValue(l){
        // Nhận dạng số tiền được bọc trong thẻ <b style="...">...đ</b> (do auditMoney() tạo ra) — kèm
        // theo có thể có <u>đã phê duyệt</u> ở NGAY TRƯỚC thẻ <b> đó (một số dòng "chưa/đã phê duyệt").
        let m = l.match(/^(.*?\bl[àA]\s*)((?:<u>[^<]*<\/u>\s*)?<b[^>]*>[\d][\d\s.,]*\s*đ<\/b>)$/i);
        if(m) return [m[1].replace(/\s*$/,''), m[2]];
        // Số tiền dạng chuỗi thô (không có thẻ bọc) — vẫn giữ để tương thích các dòng khác.
        m = l.match(/^(.*?\bl[àA]\s*(?:<u>đã phê duyệt<\/u>\s*)?)([\d][\d\s.,]*\s*đ)$/i);
        if(m) return [m[1].replace(/\s*$/,''), m[2]];
        // Số lượng in đậm dạng <b>...</b> (không phải tiền, VD "Số Quý... là <b>3</b>").
        m = l.match(/^(.*?\bl[àA]\s*)(<b>[^<]*<\/b>)$/i);
        if(m) return [m[1].replace(/\s*$/,''), m[2]];
        return null;
      }
      function group(title, titleColor, lines){
        groupIdx++;
        const roman = ROMAN[groupIdx-1] || String(groupIdx);
        if(!state.auditFilterGroups.includes(groupIdx)) return '';
        return `<div style="margin-bottom:16px; border:1px solid var(--line); border-radius:10px; overflow:hidden;">
          <div style="background:#fff; padding:10px 14px; border-bottom:2px solid ${titleColor};"><b style="color:${titleColor}; font-size:14px;">${roman}. ${title}</b></div>
          <div>${lines.map((l,i)=>{
            const parts = splitLabelValue(l);
            if(parts){
              return `<div style="padding:10px 14px; background:#fff; border-top:1px solid var(--line);">
                <div style="text-align:left;"><b>${i+1}.</b> ${parts[0]}</div>
                <div style="text-align:right; font-weight:800; font-size:15px; margin-top:2px;">${parts[1]}</div>
              </div>`;
            }
            return `<div style="padding:10px 14px; background:#fff; border-top:1px solid var(--line);"><b>${i+1}.</b> ${l}</div>`;
          }).join('')}</div>
        </div>`;
      }
      const groupsHtml = [
        group('💰 Tiền lãi theo Quý/Năm', '#1565c0', [
          `Số tiền ${auditLai()} trong ${auditQLabel(qCurInfo, s.curYear, 'cur')} chưa phê duyệt là ${auditMoney(s.interestQCurUnapproved)}`,
          `Số tiền ${auditLai()} trong ${auditQLabel(qPrevInfo, s.curYear, 'prev')} chưa phê duyệt là ${auditMoney(s.interestQPrevUnapproved)}`,
          `Số tiền ${auditLai()} trong ${auditQLabel(s.qMinus2, s.curYear, 'prev2')} chưa phê duyệt là ${auditMoney(s.interestQMinus2Unapproved)}`,
          `Số tiền ${auditLai()} trong ${auditQLabel(s.qMinus3, s.curYear, 'prev2')} chưa phê duyệt là ${auditMoney(s.interestQMinus3Unapproved)}`,
          `Số tiền ${auditLai()} trong ${auditYearCur(s.curYear)} chưa phê duyệt là ${auditMoney(s.interestYearCurUnapproved)}`,
          `Số tiền ${auditLai()} trong ${auditYearLast(s.lastYear)} chưa phê duyệt là ${auditMoney(s.interestYearLastUnapproved)}`,
          `Số tiền ${auditLai()} trong ${auditQLabel(qCurInfo, s.curYear, 'cur')} <u>đã phê duyệt</u> là ${auditMoney(s.interestQCurApproved)}`,
          `Số tiền ${auditLai()} trong ${auditQLabel(qPrevInfo, s.curYear, 'prev')} <u>đã phê duyệt</u> là ${auditMoney(s.interestQPrevApproved)}`,
          `Số tiền ${auditLai()} trong ${auditQLabel(s.qMinus2, s.curYear, 'prev2')} <u>đã phê duyệt</u> là ${auditMoney(s.interestQMinus2Approved)}`,
          `Số tiền ${auditLai()} trong ${auditQLabel(s.qMinus3, s.curYear, 'prev2')} <u>đã phê duyệt</u> là ${auditMoney(s.interestQMinus3Approved)}`,
          `Số tiền ${auditLai()} trong ${auditYearCur(s.curYear)} <u>đã phê duyệt</u> là ${auditMoney(s.interestYearCurApproved)}`,
          `Số tiền ${auditLai()} trong ${auditYearLast(s.lastYear)} <u>đã phê duyệt</u> là ${auditMoney(s.interestYearLastApproved)}`,
          `Số tiền ${auditLai()} luỹ kế từ trước đến nay <u>đã phê duyệt</u> là ${auditMoney(s.interestAllTimeApproved)}`,
          `Số Quý (lượt) <u>đã được phê duyệt</u> đóng lãi trong ${auditYearCur(s.curYear)} là <b>${s.qApprovedCountCurYear}</b>`,
          `Số Quý (lượt) <u>đã được phê duyệt</u> đóng lãi trong ${auditYearLast(s.lastYear)} là <b>${s.qApprovedCountLastYear}</b>`,
        ]),
        group('⏰ Lãi quá hạn (Lãi tồn)', '#b71c1c', [
          `Số tiền ${auditLai()} quá hạn chưa phê duyệt là ${auditMoney(s.overdueInterestUnapproved)}`,
          `Số tiền ${auditLai()} quá hạn <u>đã phê duyệt</u> là ${auditMoney(s.overdueInterestApproved)}`,
          `Số ${auditHo()} đang có lãi quá hạn chưa đóng là <b>${s.countOverdueInterest}</b>`,
          `<span class="sub" style="font-style:italic;">Giải thích: "Lãi quá hạn" là tổng số tiền lãi (chưa đóng hoặc đã đóng) được tính từ quá khứ cho tới đúng ${auditQLabel(qPrevInfo, s.curYear, 'prev')} — KHÔNG bao gồm Quý hiện tại và các Quý trong tương lai.</span>`,
        ]),
        group('💧 Tiền dư', '#00838f', [
          `Tổng số tiền dư (chưa thuộc Quý nào) của tất cả ${auditHo()} là ${auditMoney(s.leftoverTotal)}`,
          `Số ${auditHo()} đang có tiền dư chưa thuộc Quý nào là <b>${s.leftoverCount}</b>`,
        ]),
        group('🏦 Tiền gốc theo hạn', '#e65100', [
          `Số tiền ${auditGoc()} sắp đến hạn (≤60 ngày) chưa thanh toán là ${auditMoney(s.principalDueSoon)}`,
          `Số tiền ${auditGoc()} đã đến hạn chưa thanh toán là ${auditMoney(s.principalOverdue)}`,
          `Số ${auditHo()} sắp đến hạn (≤60 ngày) chưa thanh toán là <b>${s.countDueSoon}</b>`,
          `Số ${auditHo()} đã đến hạn chưa thanh toán là <b>${s.countOverdue}</b>`,
        ]),
        group('✅ Tất toán khoản vay', '#2e7d32', [
          `Số tiền ${auditGoc()} đã tất toán xong trong ${auditYearCur(s.curYear)} là ${auditMoney(s.principalSettledYear)}`,
          `Số tiền ${auditGoc()} đã tất toán xong trong ${auditYearLast(s.lastYear)} là ${auditMoney(s.principalSettledLastYear)}`,
          `Số tiền ${auditGoc()} đã tất toán xong từ trước đến nay là ${auditMoney(s.principalSettledAllTime)}`,
          `Số ${auditHo()} đã tất toán khoản vay trong ${auditYearCur(s.curYear)} là <b>${s.countSettledYear}</b>`,
          `Số ${auditHo()} đã tất toán khoản vay trong ${auditYearLast(s.lastYear)} là <b>${s.countSettledLastYear}</b>`,
          `Số tiền ${auditLai()} đóng kèm khi tất toán trong ${auditYearCur(s.curYear)} là ${auditMoney(s.interestSettledYear)}`,
          `Số tiền ${auditLai()} đóng kèm khi tất toán trong ${auditYearLast(s.lastYear)} là ${auditMoney(s.interestSettledLastYear)}`,
        ]),
        group('📤 Trả nợ trước hạn', '#0d47a1', [
          `Số tiền ${auditGoc()} đã trả nợ trước hạn trong ${auditYearCur(s.curYear)} là ${auditMoney(s.principalEarlyYear)}`,
          `Số tiền ${auditGoc()} đã trả nợ trước hạn trong ${auditYearLast(s.lastYear)} là ${auditMoney(s.principalEarlyLastYear)}`,
          `Số tiền ${auditGoc()} đã trả nợ trước hạn từ trước đến nay là ${auditMoney(s.principalEarlyAllTime)}`,
          `Số ${auditHo()} đã trả nợ trước hạn trong ${auditYearCur(s.curYear)} là <b>${s.countEarlyYear}</b>`,
          `Số ${auditHo()} đã trả nợ trước hạn trong ${auditYearLast(s.lastYear)} là <b>${s.countEarlyLastYear}</b>`,
          `Số tiền ${auditLai()} đóng kèm khi trả nợ trước hạn trong ${auditYearCur(s.curYear)} là ${auditMoney(s.interestEarlyYear)}`,
          `Số tiền ${auditLai()} đóng kèm khi trả nợ trước hạn trong ${auditYearLast(s.lastYear)} là ${auditMoney(s.interestEarlyLastYear)}`,
        ]),
        group('⚠️ Đã tất toán/TNTH nhưng còn nợ lãi', '#ef6c00', [
          `Số ${auditHo()} đã tất toán/trả nợ trước hạn nhưng còn nợ tiền ${auditLai()} là <b>${s.settledUnpaidCount}</b>`,
          `Tổng số tiền ${auditLai()} còn nợ của các ${auditHo()} đã tất toán/TNTH là ${auditMoney(s.settledUnpaidTotal)}`,
        ]),
        group('📅 Gia hạn nợ', '#6a1b9a', [
          `Số ${auditHo()} đang trong thời gian gia hạn nợ là <b>${s.extCount}</b>`,
          `Tổng số tiền ${auditGoc()} đang được gia hạn nợ là ${auditMoney(s.extPrincipalTotal)}`,
          `Số lượt gia hạn nợ đã phê duyệt trong ${auditYearCur(s.curYear)} là <b>${s.extApprovedThisYear}</b>`,
          `Số lượt gia hạn nợ đã phê duyệt trong ${auditYearLast(s.lastYear)} là <b>${s.extApprovedLastYear}</b>`,
        ]),
        group('🚨 Nợ rủi ro', '#c62828', [
          `Số ${auditHo()} đang là Nợ rủi ro (trong diện xử lý) là <b>${s.riskDebtCount}</b>`,
          `Số ${auditHo()} Không có khả năng trả nợ (Nợ xấu) là <b>${s.badDebtCount}</b>`,
          `Tổng số tiền ${auditGoc()} thuộc nợ rủi ro (trong diện đang xử lý) là ${auditMoney(s.riskDebtPrincipal)}`,
          `Tổng số tiền ${auditGoc()} thuộc diện không có khả năng trả nợ là ${auditMoney(s.badDebtPrincipal)}`,
        ]),
        group('📋 Biên lai / Giấy xác nhận / Dòng nhật ký', '#4a148c', [
          `Tổng số ${auditReceipt()} đã lập trong ${auditYearCur(s.curYear)} là <b>${s.receiptCountYear}</b>`,
          `Tổng số ${auditReceipt()} đã lập trong ${auditYearLast(s.lastYear)} là <b>${s.receiptCountLastYear}</b>`,
          `Tổng số ${auditConfirm()} đã lập trong ${auditYearCur(s.curYear)} là <b>${s.confCountYear}</b>`,
          `Tổng số ${auditConfirm()} đã lập trong ${auditYearLast(s.lastYear)} là <b>${s.confCountLastYear}</b>`,
          `Tổng số dòng nhật ký đã được tạo ra trong ${auditYearCur(s.curYear)} là <b>${s.logCountYear}</b>`,
          `Tổng số dòng nhật ký đã được tạo ra trong ${auditYearLast(s.lastYear)} là <b>${s.logCountLastYear}</b>`,
          `Tổng số tiền cộng vào (${auditReceipt()} cộng tiền) trong ${auditYearCur(s.curYear)} là ${auditMoney(s.sumReceiptPlusYear)}`,
          `Tổng số tiền cộng vào (${auditReceipt()} cộng tiền) trong ${auditYearLast(s.lastYear)} là ${auditMoney(s.sumReceiptPlusLastYear)}`,
          `Tổng số tiền trừ ra (${auditReceipt()} trừ tiền) trong ${auditYearCur(s.curYear)} là ${auditMoney(s.sumReceiptMinusYear)}`,
          `Tổng số tiền trừ ra (${auditReceipt()} trừ tiền) trong ${auditYearLast(s.lastYear)} là ${auditMoney(s.sumReceiptMinusLastYear)}`,
          `<span class="sub" style="font-style:italic;">Ghi chú: Nhóm này luôn luôn tính toán dựa trên số liệu của TOÀN XÃ, không dựa vào bất cứ một Khu dân cư trực thuộc nào cả (không bị ảnh hưởng bởi bộ lọc Địa phương phía trên).</span>`,
        ]),
      ].join('');
      const now = new Date();
      const timeLbl = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} ngày ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;
      const bodyEl = wrap.querySelector('#audit-body-inner');
      const allHamletsSel = state.auditFilterHamlets.length===hamlets.length;
      const allGroupsSel = state.auditFilterGroups.length===AUDIT_GROUP_NAMES.length;
      const hamletDropdown = `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="audit-hamlet-btn" style="${!allHamletsSel?'border:2px solid #b71c1c;':''}">📍 Địa phương (${state.auditFilterHamlets.length})</button>
        ${state.openFilterDropdown==='audit-hamlet'? `<div class="sv-filter-panel">
          <label class="sv-filter-item"><input type="checkbox" id="audit-hamlet-all" class="preview-allow" ${allHamletsSel?'checked':''}><span><b>Tất cả địa phương</b></span></label>
          ${hamlets.map(h=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow audit-hamlet-item" data-h="${escapeHtml(h)}" ${state.auditFilterHamlets.includes(h)?'checked':''}><span>${escapeHtml(h)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
      const groupDropdown = `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="audit-group-btn" style="${!allGroupsSel?'border:2px solid #b71c1c;':''}">📂 Nhóm (${state.auditFilterGroups.length})</button>
        ${state.openFilterDropdown==='audit-group'? `<div class="sv-filter-panel" style="min-width:300px;">
          <label class="sv-filter-item"><input type="checkbox" id="audit-group-all" class="preview-allow" ${allGroupsSel?'checked':''}><span><b>Tất cả nhóm</b></span></label>
          ${AUDIT_GROUP_NAMES.map((name,i)=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow audit-group-item" data-g="${i+1}" ${state.auditFilterGroups.includes(i+1)?'checked':''}><span>${ROMAN[i]}. ${escapeHtml(name)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
      const projectDropdown = svProjectFilterDropdownHtml('audit', state.auditFilterProjectIds, allProjectsForFilter);
      const fundSourceDropdown = svFundSourceFilterDropdownHtml('audit', state.auditFilterFundSources, allFundSourcesForFilter);
      const bodyHtml = `
          <p style="color:#000; line-height:1.7; margin:0 0 8px;">Đây là công cụ đối chiếu và kiểm định số liệu — dùng để so sánh nhanh các con số đang có trong Sổ vay vốn với sổ sách thực tế của xã/phường, giúp phát hiện sớm sai lệch (nếu có). Cứ mở bảng này lên bất cứ lúc nào, xem từng dòng và so sánh trực tiếp với sổ tay/sổ giấy đang lưu — nếu con số khớp nhau thì yên tâm, nếu lệch thì nên kiểm tra lại ngay. Toàn bộ số liệu bên dưới được tính lại HOÀN TOÀN MỚI, cập nhật đúng theo thời gian thực từng giây, không lưu trữ sẵn.</p>
          <p style="color:#000; font-weight:700; margin:0 0 14px;">Được tính vào lúc ${timeLbl}</p>
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            ${hamletDropdown}
            ${projectDropdown}
            ${fundSourceDropdown}
            ${groupDropdown}
            <button type="button" class="btn btn-ghost btn-sm preview-allow ${(!allHamletsSel || !allGroupsSel || !projectAllSel || !fundSourceAllSel)?'reset-filter-active':''}" id="audit-reset-btn">↺ Khôi phục bộ lọc gốc</button>${exportPrintButtonsHtml('audit-ep')}
          </div>
          <p style="font-weight:700; margin:0 0 14px;"><span style="color:#1565c0;">${allHamletsSel? 'Đang chọn tất cả địa phương' : (state.auditFilterHamlets.length? `Đang chọn ${state.auditFilterHamlets.length} địa phương: ${state.auditFilterHamlets.map(escapeHtml).join(', ')}` : 'Đang KHÔNG chọn địa phương nào cả (0 địa phương)')}</span> — <span style="color:#e65100;">${allGroupsSel? `Đang chọn tất cả ${AUDIT_GROUP_NAMES.length} nhóm` : (state.auditFilterGroups.length? `Đang chọn ${state.auditFilterGroups.length} nhóm` : 'Đang KHÔNG chọn nhóm nào cả (0 nhóm)')}</span>${svProjectFundSourceSummaryText(state.auditFilterProjectIds, allProjectsForFilter, state.auditFilterFundSources, allFundSourcesForFilter)}</p>
          ${groupsHtml}`;
      function wireFilters(container){
        const hb = container.querySelector('#audit-hamlet-btn'); if(hb) hb.onclick=(e)=>{ e.stopPropagation(); state.openFilterDropdown = state.openFilterDropdown==='audit-hamlet'?null:'audit-hamlet'; render(); };
        const gb = container.querySelector('#audit-group-btn'); if(gb) gb.onclick=(e)=>{ e.stopPropagation(); state.openFilterDropdown = state.openFilterDropdown==='audit-group'?null:'audit-group'; render(); };
        const hAll = container.querySelector('#audit-hamlet-all'); if(hAll) hAll.onclick=(e)=>{ e.stopPropagation(); state.auditFilterHamlets = hAll.checked? hamlets.slice() : []; render(); };
        container.querySelectorAll('.audit-hamlet-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const h=cb.dataset.h; state.auditFilterHamlets = cb.checked? state.auditFilterHamlets.concat([h]) : state.auditFilterHamlets.filter(x=>x!==h); render(); });
        const gAll = container.querySelector('#audit-group-all'); if(gAll) gAll.onclick=(e)=>{ e.stopPropagation(); state.auditFilterGroups = gAll.checked? AUDIT_GROUP_NAMES.map((_,i)=>i+1) : []; render(); };
        container.querySelectorAll('.audit-group-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const g=parseInt(cb.dataset.g,10); state.auditFilterGroups = cb.checked? state.auditFilterGroups.concat([g]) : state.auditFilterGroups.filter(x=>x!==g); render(); });
        wireSvProjectAndFundSourceFilters(container, 'audit', 'auditFilterProjectIds', 'auditFilterFundSources', allProjectsForFilter, allFundSourcesForFilter, render);
        const rb = container.querySelector('#audit-reset-btn'); if(rb) rb.onclick = ()=>{ state.auditFilterHamlets = hamlets.slice(); state.auditFilterGroups = AUDIT_GROUP_NAMES.map((_,i)=>i+1); state.auditFilterProjectIds = allProjectsForFilter.map(p=>p.id); state.auditFilterFundSources = allFundSourcesForFilter.slice(); state.openFilterDropdown = null; render(); };
        wireExportPrintButtons(wrap, 'audit-ep', '#audit-body-inner', 'Bảng Đối chiếu và Kiểm định Số liệu Sổ vay vốn');
        if(!wrap._auditOutsideClickBound){
          wrap._auditOutsideClickBound = true;
          document.addEventListener('click', (e)=>{
            if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
            if(e.target.closest('.sv-filter-dropdown')) return;
            state.openFilterDropdown = null;
            if(document.body.contains(wrap)) render();
          });
        }
      }
      if(bodyEl){ bodyEl.innerHTML = bodyHtml; wireFilters(bodyEl); return; }
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:900px; border:6px solid #fbc02d;">
          <div class="modal-head" style="background:linear-gradient(180deg, #fff9c4 0%, #ffd54f 50%, #fbc02d 100%);"><h3 style="color:#000;">${waveTextHtmlSlow('🔍 Bảng Đối chiếu & Kiểm định Số liệu Sổ vay vốn')}</h3><button class="modal-close preview-allow" id="audit-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; min-height:78vh; overflow:auto;">
            <div id="audit-body-inner">${bodyHtml}</div>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="audit-close2">Đóng bảng</button></div>
        </div>`;
      wrap.querySelector('#audit-close').onclick = close;
      wrap.querySelector('#audit-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wireFilters(wrap);
      if(__savedScrollTop!=null){
        const __newPanel = wrap.querySelector('.sv-filter-panel');
        if(__newPanel) __newPanel.scrollTop = __savedScrollTop;
      }
    }
    render();
    timerId = setInterval(()=>{
      const openPanel = document.querySelector('.sv-filter-panel');
      const savedScrollTop = openPanel? openPanel.scrollTop : null;
      render();
      if(savedScrollTop!=null){
        const newPanel = document.querySelector('.sv-filter-panel');
        if(newPanel) newPanel.scrollTop = savedScrollTop;
      }
    }, 1000); // cập nhật lại toàn bộ số liệu + đồng hồ đúng mỗi giây, vẫn giữ nguyên vị trí cuộn menu nếu đang mở
  }
  function buildActivityLogPanelHtml(){
    if(!state.logFilterKind) state.logFilterKind = LOG_FILTER_KIND_LIST.map(x=>x[0]);
    if(state.logSpecificTime===undefined) state.logSpecificTime = false;
    if(state.logSearch===undefined) state.logSearch = '';
    const allEntries = buildActivityLogEntries();
    allEntries.forEach((e,i)=> e.__idx = i);
    const searchLower = state.logSearch.trim().toLowerCase();
    let filtered;
    if(!searchLower){
      filtered = allEntries.filter(e=> logEntryMatchesKindFilter(e) && logEntryMatchesQuarterFilter(e));
    } else {
      const nameMatches = allEntries.filter(e=> logEntryMatchesKindFilter(e) && logEntryMatchesQuarterFilter(e)
        && e.kind!=='quarter_config_change_bulk' && e.affectedNames.some(n=> (n||'').toLowerCase().includes(searchLower)));
      // Chỉ khi tìm kiếm ra được ÍT NHẤT 1 kết quả thì mới bổ sung thêm các dòng "Đổi mốc thời gian
      // hàng quý" (áp dụng cho TẤT CẢ mọi người, kể cả người đang tìm) — xen đúng vị trí theo thời
      // gian. Nếu tìm không ra ai thì KHÔNG bổ sung các dòng này nữa.
      const quarterEntries = nameMatches.length? allEntries.filter(e=> e.kind==='quarter_config_change_bulk' && logEntryMatchesKindFilter(e) && logEntryMatchesQuarterFilter(e)) : [];
      filtered = nameMatches.concat(quarterEntries);
    }
    filtered = filtered.sort((a,c)=> (c.createdAt||'').localeCompare(a.createdAt||''));
    const curYear = new Date().getFullYear();
    if(!state.logExpandedYears) state.logExpandedYears = [curYear];
    if(state.logExpandedBucket===undefined) state.logExpandedBucket = null;
    const byYear = {};
    filtered.forEach(e=>{ const d=new Date(e.createdAt); const y=isNaN(d.getTime())?null:d.getFullYear(); if(y!=null) (byYear[y]=byYear[y]||[]).push(e); });
    const recentYears = [];
    for(let y=curYear; y>=curYear-4; y--){ if(y===curYear || byYear[y]) recentYears.push(y); }
    const olderBuckets = {};
    Object.keys(byYear).map(Number).filter(y=> y<curYear-4).forEach(y=>{
      const yearsAgo = curYear-y;
      let idx = Math.floor(yearsAgo/5)+1; if(idx<2) idx=2;
      const fromYear = curYear-5*idx, toYear = curYear-5*(idx-1);
      if(!olderBuckets[idx]) olderBuckets[idx] = { idx, fromYear, toYear, years:[] };
      olderBuckets[idx].years.push(y);
    });
    const olderBucketList = Object.keys(olderBuckets).map(Number).sort((a,c2)=>a-c2).map(i=>olderBuckets[i]);
    function yearSectionHtml(y){
      const isCur = y===curYear;
      const expanded = state.logExpandedYears.includes(y);
      const entries = byYear[y]||[];
      return `<div style="margin-bottom:10px;">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" data-log-year-toggle="${y}">📅 Năm ${y} (${entries.length}) ${expanded?'▴':'▾'}</button>
        ${expanded? `<div style="margin-top:8px; padding-left:10px; border-left:2px solid var(--line);">
          ${entries.length? entries.map(activityLogRowHtml).join('') : `<p class="sub">${isCur? 'Chưa có dòng nhật ký nào trong năm nay.' : 'Không có dòng nhật ký nào trong năm này.'}</p>`}
          <div style="text-align:center; margin-top:6px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" data-log-year-collapse="${y}" style="color:#b71c1c; font-weight:700;">Rút gọn toàn bộ danh sách</button></div>
        </div>` : ''}
      </div>`;
    }
    const recentHtml = recentYears.map(yearSectionHtml).join('');
    const olderBucketsHtml = olderBucketList.map(bucket=>{
      const bucketExpanded = state.logExpandedBucket===bucket.idx;
      return `<div style="margin-bottom:10px;">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" data-log-bucket-toggle="${bucket.idx}">🗄️ Từ năm ${bucket.toYear} đến ${bucket.fromYear} ${bucketExpanded?'▴':'▾'}</button>
        ${bucketExpanded? `<div style="margin-top:8px; padding-left:10px; border-left:2px solid var(--line);">${bucket.years.slice().sort((a,c2)=>c2-a).map(yearSectionHtml).join('')}</div>` : ''}
      </div>`;
    }).join('');
    const listBodyHtml = (recentHtml + olderBucketsHtml) || `<p class="sub" style="padding:10px 0;">${allEntries.length===0? 'Chưa có dòng nhật ký nào cả.' : 'Không có dòng nhật ký nào theo bộ lọc hiện tại.'}</p>`;
    const allSel = state.logFilterKind.length===LOG_FILTER_KIND_LIST.length;
    const kindDropdown = `<div class="sv-filter-dropdown">
      <button type="button" class="btn btn-ghost btn-sm preview-allow" id="log-kind-btn" style="${!allSel?'border:2px solid #b71c1c;':''}">📂 Loại dòng nhật ký (${state.logFilterKind.length})</button>
      ${state.openFilterDropdown==='log-kind'? `<div class="sv-filter-panel" style="min-width:280px;">
        <label class="sv-filter-item"><input type="checkbox" id="log-kind-all" class="preview-allow" ${allSel?'checked':''}><span><b>Tất cả loại dòng nhật ký</b></span></label>
        ${LOG_FILTER_KIND_LIST.map(([key,label])=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow log-kind-item" data-key="${key}" ${state.logFilterKind.includes(key)?'checked':''}><span>${escapeHtml(label)}</span></label>`).join('')}
      </div>` : ''}
    </div>`;
    return `
      <div class="toolbar" style="flex-wrap:wrap; gap:8px;">
        <input id="log-search" class="preview-allow" placeholder="🔎 Tìm theo tên người vay..." value="${escapeHtml(state.logSearch)}" style="min-width:200px;${(state.logSearch!=='' && state.logSearch!==' ')? 'border:2px solid #b71c1c;' : ''}">
        ${kindDropdown}
        ${state.logSpecificTime? buildTimelineFilterDropdownHtml('main') : ''}
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="log-specifictime-btn">${state.logSpecificTime? 'Tất cả thời điểm' : 'Chọn thời điểm cụ thể'}</button>
        <button class="btn btn-ghost btn-sm preview-allow ${((state.logSearch!=='' && state.logSearch!==' ') || !allSel || state.logSpecificTime)?'reset-filter-active':''}" id="log-reset-all-btn">↺ Khôi phục bộ lọc gốc</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="log-collapse-all-btn" style="color:#b71c1c; font-weight:700;">Rút gọn tất cả danh sách</button>
      </div>
      <div style="margin-top:14px; border:2px solid #fbc02d; border-radius:10px; padding:12px; min-height:60vh; max-height:60vh; overflow:auto;">
        ${listBodyHtml}
      </div>`;
  }
  // Định dạng nội dung Giấy xác nhận — MỖI DÒNG xuống hàng riêng cho dễ đọc (sửa lỗi cũ dùng sai
  // regex khiến các dòng bị dính liền không xuống hàng), in đậm tên Quý ("Quý 1"...) và mọi mốc ngày
  // tháng dạng D/M (VD: "31/12") xuất hiện trong nội dung.
  function formatConfirmationDetailsHtml(detailsText){
    const lines = String(detailsText||'').split('\n').map(l=>l.trim()).filter(Boolean);
    return lines.map(line=>{
      let safe = escapeHtml(line);
      safe = safe.replace(/(Quý\s*[1-4])/gi, '<b>$1</b>');
      safe = safe.replace(/\b(\d{1,2}\/\d{1,2})\b/g, '<b>$1</b>');
      return `<p style="line-height:1.9; margin:0 0 10px;">${safe}</p>`;
    }).join('');
  }
  function renderConfirmationDetailModal(c){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const d = new Date(c.createdAt);
    const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    const kindColor = CONFIRMATION_KIND_COLOR[c.kind] || '#000000';
    // "Đối với hộ vay..." — GXN riêng đã có sẵn borrowerName, GXN chung cần tự resolve tên từ danh sách
    // ID liên quan. Riêng loại "Chỉnh mốc hàng quý" (áp dụng cho TẤT CẢ hộ vay) thì KHÔNG cần dòng này.
    let confirmAffectedNames = [];
    if(c.kind!=='quarter_config_change_bulk' && c.kind!=='quarter_config_change'){
      if(c.borrowerName) confirmAffectedNames = [c.borrowerName];
      else if(c.affectedBorrowerIds) confirmAffectedNames = c.affectedBorrowerIds.map(id=>{ const bx=state.borrowers.find(x=>x.id===id); return bx? bx.name : null; }).filter(Boolean);
    }
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:600px;">
        <div class="modal-head" style="background:#fff; border-bottom:1px solid var(--line); display:block;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;"><h3 style="color:${kindColor};">${escapeHtml(c.title||'')}</h3><button class="modal-close preview-allow" id="cfd-close">✕</button></div>
          ${confirmAffectedNames.length? `<div style="font-weight:700; color:#6a1b9a; font-size:13.5px; margin-top:4px;">Đối với hộ vay ${confirmAffectedNames.map(n=>escapeHtml(n)).join(', ')}</div>` : ''}
        </div>
        <div class="modal-body">
          <p class="sub" style="margin:0 0 10px;">Giấy này được lập vào ${dateLbl}</p>
          ${formatConfirmationDetailsHtml(c.details||'')}
          <div class="divider-lbl" style="margin-top:14px;">Người lập giấy</div>
          <div class="kv-row"><span>Họ và tên</span><b>${escapeHtml(c.createdByName||'')}</b></div>
          <div class="kv-row"><span>Email</span><b>${escapeHtml(c.createdBy||'(không có)')}</b></div>
          <div class="kv-row"><span>Địa chỉ IP</span><b>${escapeHtml(c.createdByIp||'(không lấy được)')}</b></div>
          <div class="kv-row"><span>Thiết bị</span><b style="font-size:11px;">${escapeHtml(c.createdByDevice||'(không lấy được)')}</b></div>
        </div>
        <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="cfd-close2">Đóng bảng</button></div>
      </div>`;
    wrap.querySelector('#cfd-close').onclick = close;
    wrap.querySelector('#cfd-close2').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
  }
  // Xem chi tiết 1 Biên lai CHUNG — tiêu đề đầy đủ "Biên lai chung..." (không viết tắt BL).
  // Định dạng lại nội dung "biên lai chung" (vốn lưu dạng 1 đoạn text nhiều dòng) thành dạng đẹp hơn:
  // mỗi dòng "nhãn = số tiền" tách thành 2 dòng riêng (nhãn trên, số tiền dưới, căn phải) — dòng
  // "Tổng..." tô xanh lá đậm — chèn thêm đường kẻ ngang phân chia các khu vực hợp lý.
  function formatSharedReceiptDetailsHtml(detailsText){
    const lines = String(detailsText||'').split('\n');
    const moneyLineRe = /^(.*?)\s*(=|:)\s*([+-]?\s*[\d][\d\s.,]*\s*đ)\s*$/;
    const dividerBeforePrefixes = ['Tổng tiền các quý','Tổng tất cả','Người đóng tiền','Người thu tiền','--- Thông tin nâng cao ---'];
    let out = '';
    let dividerDone = {};
    lines.forEach(line=>{
      const trimmed = line.trim();
      if(!trimmed) return;
      if(/^-{2,}.*-{2,}$/.test(trimmed)){
        out += `<div class="divider-lbl" style="margin-top:14px;">${escapeHtml(trimmed.replace(/^-+\s*|\s*-+$/g,''))}</div>`;
        return;
      }
      const prefixMatch = dividerBeforePrefixes.find(p=> trimmed.startsWith(p) && p!=='--- Thông tin nâng cao ---');
      if(prefixMatch && !dividerDone[prefixMatch]){ out += `<hr style="border:none; border-top:1px solid var(--line); margin:10px 0;">`; dividerDone[prefixMatch]=true; }
      const m = trimmed.match(moneyLineRe);
      if(m){
        const label = m[1].trim();
        const amount = m[3].replace(/\s+/g,' ').trim();
        const isTotal = /^Tổng/.test(label) && !/hộ vay:/.test(label);
        const isPrincipalLine = /^Tiền vay gốc /.test(label); // "Tiền vay gốc [tên]" -> đậm, tím
        // Dòng SỐ TIỀN THỰC NHẬN CUỐI CÙNG của cả Biên lai chung (thu lãi: "Tổng tất cả (số tiền thực
        // nhận)"; tất toán: "Số tiền thực tế nhận được") -> luôn tô XANH DƯƠNG + GẠCH CHÂN, khác hẳn
        // các dòng "Tổng" khác (vẫn giữ đậm/xanh lá như trước).
        const isFinalAmount = /^Tổng tất cả \(số tiền thực nhận\)$/.test(label) || /^Số tiền thực tế nhận được$/.test(label);
        const sepPrefix = m[2]==='=' ? '= ' : ''; // bỏ hẳn dấu ":" thừa trước số tiền — chỉ giữ dấu "="
        const amountStyle = isFinalAmount ? 'color:#0d47a1; font-weight:800; font-size:15px; text-decoration:underline;'
          : (isTotal ? 'color:#1b5e20; font-weight:800; font-size:15px;' : 'font-weight:700;');
        out += `<div style="margin:8px 0;"><div style="${isTotal?'font-weight:800;':(isPrincipalLine?'font-weight:800; color:#6a1b9a;':'')}">${escapeHtml(label)}</div><div style="text-align:right; ${amountStyle}">${sepPrefix}${escapeHtml(amount)}</div></div>`;
      } else if(/^Tổng\s+\d+\s+hộ vay:/.test(trimmed)){
        // "Tổng N hộ vay: [tên], [tên]..." (biên lai chung Đóng tiền lãi) -> đậm, tím
        out += `<p style="margin:6px 0; font-weight:800; color:#6a1b9a;">${escapeHtml(trimmed)}</p>`;
      } else {
        out += `<p class="sub" style="margin:6px 0;">${escapeHtml(trimmed)}</p>`;
      }
    });
    return out;
  }
  function renderSharedReceiptDetailModal(r){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    function render(){
    const sign = r.sign==='-' ? '-' : '+';
    const signColor = sign==='+' ? '#0d47a1' : '#b71c1c';
    const d = new Date(r.createdAt);
    const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    const fullTitle = (r.title||'').replace(/^BL chung:\s*/i, 'Biên lai chung: ');
    const editedMarkHtml = `<span style="color:#b71c1c; font-weight:700; font-style:italic;"> (nội dung này đã được sửa lại)</span>`;
    const hasLabel = r.kind==='shared_interest_payment';
    let labelName = '', labelColor = '#fff';
    if(hasLabel){
      if(r.receiptCategoryId){
        const l = receiptAllLabels().find(x=>x.id===r.receiptCategoryId);
        labelName = l? l.name : '(phân loại đã bị xoá)'; labelColor = l? (l.color||'#fff') : '#fff';
      } else { labelName = 'Không phân loại'; labelColor = '#fff'; }
    }
    const affectedNamesForTitle = (r.affectedBorrowerIds||[]).map(id=>{ const bx=state.borrowers.find(x=>x.id===id); return bx? bx.name : null; }).filter(Boolean);
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:680px;">
        <div class="modal-head" style="background:#fff; border-bottom:1px solid var(--line); display:block;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;"><h3>${styleSharedReceiptTitle(fullTitle)}</h3><button class="modal-close preview-allow" id="srd-close">✕</button></div>
          ${affectedNamesForTitle.length? `<div style="font-weight:700; color:#6a1b9a; font-size:13.5px; margin-top:4px;">Đối với hộ vay ${affectedNamesForTitle.map(n=>escapeHtml(n)).join(', ')}</div>` : ''}
        </div>
        <div class="modal-body" id="srd-content">
          <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ${dateLbl}</p>
          ${formatSharedReceiptDetailsHtml(r.details||'')}
          ${hasLabel? `<div class="divider-lbl" style="margin-top:14px;">Phân loại biên lai</div><div class="kv-row"><span style="display:flex; align-items:center; gap:6px;">${escapeHtml(labelName)}${r.categoryEdited?editedMarkHtml:''}<span style="display:inline-block; width:30px; height:10px; background:${labelColor}; border:1px solid var(--line);"></span></span><button type="button" class="btn btn-ghost btn-sm preview-allow" id="srd-edit-cat" style="padding:2px 8px;">✏️ Sửa</button></div>` : ''}
          <div class="divider-lbl" style="margin-top:14px;">Người lập Biên lai</div>
          <div class="kv-row"><span>Họ và tên</span><b>${escapeHtml(r.createdByName||'')}</b></div>
          <div class="kv-row"><span>Email</span><b>${escapeHtml(r.createdBy||'(không có)')}</b></div>
          <div class="kv-row"><span>Địa chỉ IP</span><b>${escapeHtml(r.createdByIp||'(không lấy được)')}</b></div>
          <div class="kv-row"><span>Thiết bị</span><b style="font-size:11px;">${escapeHtml(r.createdByDevice||'(không lấy được)')}</b></div>
        </div>
        <div class="modal-foot">${exportPrintButtonsHtml('srd-ep')}<button class="btn btn-ghost preview-allow" id="srd-link">🔗 Đường link</button><button class="btn btn-ghost preview-allow" id="srd-close2">Đóng bảng</button></div>
      </div>`;
    wrap.querySelector('#srd-close').onclick = close;
    wrap.querySelector('#srd-close2').onclick = close;
    wrap.querySelector('#srd-link').onclick = ()=>{
      const names = (r.affectedBorrowerIds||[]).map(id=>{ const bx = state.borrowers.find(x=>x.id===id); return bx? bx.name : null; }).filter(Boolean);
      renderReceiptLinkModal(r.id, fullTitle.replace(/<[^>]+>/g,''), wrap.querySelector('#srd-content'), r.createdAt, names, r.amount);
    };
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    const catBtn = wrap.querySelector('#srd-edit-cat');
    if(catBtn) catBtn.onclick = ()=> renderEditReceiptCategoryDialog(r.receiptCategoryId||null, async (newId)=>{
      await updateSharedReceiptField(r.id, { receiptCategoryId: newId, categoryEdited: true });
      r.receiptCategoryId = newId; r.categoryEdited = true;
      render();
      showBigToast('Đã lưu thành công phân loại mới!');
    });
    wireExportPrintButtons(wrap, 'srd-ep', '#srd-content', fullTitle.replace(/<[^>]+>/g,''));
    }
    render();
  }
  function renderReceiptDetailModal(b, r){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    function render(){
    const sign = r.sign==='-' ? '-' : '+';
    const signColor = sign==='+' ? '#0d47a1' : '#b71c1c';
    const d = new Date(r.createdAt);
    const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    const extra = r.extra||{};
    const headClass = r.groupKey==='thu_lai' ? 'receipt-head-payment' : 'receipt-head-refund';
    // (quarterLbl giờ dùng bản TOÀN CỤC khai báo ở đầu file — đã bỏ bản cục bộ trùng lặp ở đây)
    const hasLabel = ['thu_lai','tra_lai'].includes(r.groupKey);
    const editedMarkHtml = `<span style="color:#b71c1c; font-weight:700; font-style:italic;"> (nội dung này đã được sửa lại)</span>`;
    let labelName = '', labelColor = '#fff';
    if(hasLabel){
      if(r.receiptCategoryId){
        const l = receiptAllLabels().find(x=>x.id===r.receiptCategoryId);
        labelName = l? l.name : '(phân loại đã bị xoá)'; labelColor = l? (l.color||'#fff') : '#fff';
      } else { labelName = 'Không phân loại'; labelColor = '#fff'; }
    }

    // ---- Bảng chi tiết từng Quý (dùng cho biên lai thu/trả lãi) — Y HỆT cách trình bày lúc lập ----
    const quarterTableHtml = (r.quarterLines&&r.quarterLines.length)? `
      <div class="divider-lbl" style="margin-top:14px;">Chi tiết từng Quý</div>
      ${r.quarterLines.map(q=>`<div class="kv-row"><span>${quarterLbl(q.qk)}/${q.year}</span><b>${moneySpaced(q.amount||0)}</b></div>`).join('')}
      <div class="kv-row" style="border-top:1px solid var(--line); padding-top:6px; margin-top:4px;"><span>Tổng ${r.quarterLines.length} quý</span><b>= ${moneySpaced(r.quarterLines.reduce((s,q)=>s+(q.amount||0),0))}</b></div>` : '';

    // ---- Khối thông tin riêng theo từng NHÓM hạng mục — bố cục giống hệt biên lai gốc lúc lập ----
    let bodyExtraHtml = '';
    if(['settlement_with_interest','settlement_no_interest','early_province_with_interest','early_province_no_interest','early_heir_with_interest','early_heir_no_interest'].includes(r.categoryKey)){
      bodyExtraHtml = `
        <div class="kv-row" style="margin-top:10px;"><span>Số tiền vay gốc</span><b>${moneySpaced(extra.principal||0)}</b></div>
        ${extra.interestIncluded? `<div class="kv-row"><span>Tiền lãi đóng kèm theo (tính đến ngày/Quý lập biên lai)</span><b>${moneySpaced(extra.interestIncluded)}</b></div>${quarterTableHtml}` : `<p class="sub" style="margin-top:6px;">Chưa trả tiền lãi chưa đóng trong biên lai này.</p>`}
        <div class="kv-row big-money-row" style="border-top:2px solid var(--line); margin-top:10px; padding-top:8px;"><span>Số tiền thực tế nhận được</span><b>= ${moneySpaced(r.amount)}</b></div>
        ${(r.quarterLines&&r.quarterLines.length)? r.quarterLines.map(q=>{ const qd = resolveQuarterDatesForYear(q.qk, q.year); return `<p class="sub" style="margin:4px 0 0;">${quarterLbl(q.qk)}/${q.year} bắt đầu từ ngày ${fmtDate(qd.from)} đến ngày ${fmtDate(qd.to)}</p>`; }).join('') : ''}
        ${extra.heirName? `<div class="kv-row heir-info-block" style="margin-top:8px;"><span>Người thừa kế</span><b>${escapeHtml(extra.heirName)}</b></div>` : ''}
        ${extra.isLocalOrOtherFund!=null? `<div class="kv-row"><span>Hình thức</span><b>${extra.isLocalOrOtherFund?'Trả lại cho cấp quản lý vốn vay':'Trả lại cấp Tỉnh/Thành phố hoặc Trung ương'}</b></div>` : ''}
        <div class="kv-row"><span>Lý do trả nợ trước hạn</span><b>${escapeHtml(extra.reason||'(không có)')}${extra.reasonEdited?editedMarkHtml:''} <button type="button" class="btn btn-ghost btn-sm preview-allow" data-edit-field="reason" style="padding:2px 8px;">✏️ Sửa</button></b></div>
        <div class="divider-lbl" style="margin-top:14px;">Người trả / Người nhận</div>
        <div class="kv-row"><span>Người trả nợ</span><b>${escapeHtml(extra.payerName||'')}</b></div>
        <div class="kv-row"><span>Người nhận tiền</span><b>${escapeHtml(extra.collectorName||'')}</b></div>`;
    } else if(r.categoryKey==='reversal_early' || r.categoryKey==='reversal_settlement'){
      bodyExtraHtml = `
        <div class="kv-row" style="margin-top:10px;"><span>Số tiền vay gốc</span><b>${moneySpaced(extra.principal||0)}</b></div>
        ${extra.interestIncluded? `<div class="kv-row"><span>Trong đó tiền lãi</span><b>${moneySpaced(extra.interestIncluded)}</b></div>` : ''}
        <div class="kv-row big-money-row" style="border-top:2px solid var(--line); margin-top:10px; padding-top:8px;"><span>Tổng số tiền được trả lại</span><b>= ${moneySpaced(r.amount)}</b></div>`;
    } else if(r.categoryKey==='overflow_paid'){
      bodyExtraHtml = `
        <div class="kv-row big-money-row" style="margin-top:10px;"><span>Số tiền xử lý</span><b>= ${moneySpaced(r.amount)}</b></div>
        ${extra.quarterCount!=null? `<p class="sub">Số tiền này = Tổng tiền đã đóng lãi trừ đi Tổng ${extra.quarterCount} quý của cả khoản vay.</p>` : ''}
        <div class="divider-lbl" style="margin-top:14px;">Phương án xử lý</div>
        ${extra.mode==='return'? `
          <div class="kv-row"><span>Phương án</span><b>Trả lại hộ vay ${escapeHtml(b.name)}</b></div>
          <div class="kv-row"><span>Người trả lại tiền</span><b>${escapeHtml(extra.payerName||'')}</b></div>
          <div class="kv-row"><span>Người nhận lại tiền</span><b>${escapeHtml(extra.collectorName||'')}</b></div>
          <div class="kv-row"><span>Ghi chú thêm</span><b>${escapeHtml(extra.note||'(không có)')}${extra.noteEdited?editedMarkHtml:''} <button type="button" class="btn btn-ghost btn-sm preview-allow" data-edit-field="note" style="padding:2px 8px;">✏️ Sửa</button></b></div>
        ` : `
          <div class="kv-row"><span>Phương án</span><b>Xử lý theo phương án khác</b></div>
          <div class="kv-row"><span>Tên phương án xử lý</span><b>${escapeHtml(extra.planName||'')}</b></div>
          <div class="kv-row"><span>Nội dung cụ thể</span><b>${escapeHtml(extra.planDetail||'')}</b></div>
        `}`;
    } else {
      // Nhóm thu lãi / trả lãi theo Quý hoặc theo tiền
      const hasReasonField = ['refund_quarter','refund_money'].includes(r.categoryKey); // CHỈ trả lãi mới có trường "Lý do" — thu lãi không có
      bodyExtraHtml = `
        ${quarterTableHtml}
        <div class="kv-row big-money-row" style="border-top:2px solid var(--line); margin-top:10px; padding-top:8px;"><span>${sign==='+'?'Tổng số tiền thực nhận':'Tổng số tiền trả lại'}</span><b>= ${moneySpaced(r.amount)}</b></div>
        ${(r.quarterLines&&r.quarterLines.length)? r.quarterLines.map(q=>{ const qd = resolveQuarterDatesForYear(q.qk, q.year); return `<p class="sub" style="margin:4px 0 0;">${quarterLbl(q.qk)}/${q.year} bắt đầu từ ngày ${fmtDate(qd.from)} đến ngày ${fmtDate(qd.to)}</p>`; }).join('') : ''}
        ${extra.explanation? `<p class="sub" style="margin:6px 0 0;">${escapeHtml(extra.explanation)}</p>` : ''}
        ${(extra.payerName||extra.collectorName)? `
        <div class="divider-lbl" style="margin-top:14px;">Người đóng / Người thu</div>
        <div class="kv-row"><span>${sign==='+'?'Người đóng tiền':'Người trả lại tiền'}</span><b>${escapeHtml(extra.payerName||'')}</b></div>
        <div class="kv-row"><span>${sign==='+'?'Người thu tiền':'Người nhận lại tiền'}</span><b>${escapeHtml(extra.collectorName||'')}</b></div>` : ''}
        ${hasReasonField? `<div class="kv-row"><span>Lý do</span><b>${escapeHtml(extra.reason||'(không có)')}${extra.reasonEdited?editedMarkHtml:''} <button type="button" class="btn btn-ghost btn-sm preview-allow" data-edit-field="reason" style="padding:2px 8px;">✏️ Sửa</button></b></div>` : ''}`;
    }

    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:620px;">
        <div class="modal-head" style="background:#fff; border-bottom:1px solid var(--line); display:block;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;"><h3>${(RECEIPT_TITLE_HTML[r.categoryKey]||escapeHtml(r.displayTitle||'')).replace(/^BL /, 'Biên Lai ')}</h3><button class="modal-close preview-allow" id="rcd-close">✕</button></div>
          <div style="font-weight:700; color:#6a1b9a; font-size:13.5px; margin-top:4px;">Đối với hộ vay ${escapeHtml(b.name)}</div>
        </div>
        <div class="modal-body" id="rcd-content">
          <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ${dateLbl}</p>
          ${bodyExtraHtml}
          ${hasLabel? `<div class="divider-lbl" style="margin-top:14px;">Phân loại biên lai</div><div class="kv-row"><span style="display:flex; align-items:center; gap:6px;">${escapeHtml(labelName)}${r.categoryEdited?editedMarkHtml:''}<span style="display:inline-block; width:30px; height:10px; background:${labelColor}; border:1px solid var(--line);"></span></span><button type="button" class="btn btn-ghost btn-sm preview-allow" data-edit-field="category" style="padding:2px 8px;">✏️ Sửa</button></div>` : ''}
          ${advancedInfoHtml(b, (r.quarterLines||[]).map(q=>({ ...resolveQuarterDatesForYear(q.qk, q.year), qk:q.qk, year:q.year })), 'rcd', false, [
            `Người lập biên lai: ${r.createdByName||''}`,
            `Email: ${r.createdBy||'(không có)'}`,
            `Địa chỉ IP: ${r.createdByIp||'(không lấy được)'}`,
            `Thiết bị: ${r.createdByDevice||'(không lấy được)'}`,
            `Mã biên lai: ${r.id}`,
          ])}
        </div>
        <div class="modal-foot">${exportPrintButtonsHtml('rcd-ep')}<button class="btn btn-ghost preview-allow" id="rcd-link">🔗 Đường link</button><button class="btn btn-ghost preview-allow" id="rcd-close2">Đóng bảng</button></div>
      </div>`;
    wrap.querySelector('#rcd-close').onclick = close;
    wrap.querySelector('#rcd-close2').onclick = close;
    wrap.querySelector('#rcd-link').onclick = ()=> renderReceiptLinkModal(r.id, (RECEIPT_TITLE_HTML[r.categoryKey]||r.displayTitle||'Biên lai').replace(/<[^>]+>/g,''), wrap.querySelector('#rcd-content'), r.createdAt, [b.name], r.amount);
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wireAdvancedInfo(wrap, 'rcd', ()=>{});
    wireExportPrintButtons(wrap, 'rcd-ep', '#rcd-content', (RECEIPT_TITLE_HTML[r.categoryKey]||r.displayTitle||'Biên lai').replace(/<[^>]+>/g,'').replace(/^BL /, 'Biên Lai '));
    const reasonBtn = wrap.querySelector('[data-edit-field="reason"]');
    if(reasonBtn) reasonBtn.onclick = ()=> renderEditReceiptTextDialog(extra.reason||'', 200, async (newVal)=>{
      await updateBorrowerReceiptField(b.id, r.id, { 'extra/reason': newVal, 'extra/reasonEdited': true });
      r.extra = {...r.extra, reason:newVal, reasonEdited:true };
      render();
      showBigToast('Đã lưu thành công nội dung mới!');
    });
    const noteBtn = wrap.querySelector('[data-edit-field="note"]');
    if(noteBtn) noteBtn.onclick = ()=> renderEditReceiptTextDialog(extra.note||'', 200, async (newVal)=>{
      await updateBorrowerReceiptField(b.id, r.id, { 'extra/note': newVal, 'extra/noteEdited': true });
      r.extra = {...r.extra, note:newVal, noteEdited:true };
      render();
      showBigToast('Đã lưu thành công nội dung mới!');
    });
    const catBtn = wrap.querySelector('[data-edit-field="category"]');
    if(catBtn) catBtn.onclick = ()=> renderEditReceiptCategoryDialog(r.receiptCategoryId||null, async (newId)=>{
      await updateBorrowerReceiptField(b.id, r.id, { receiptCategoryId: newId, categoryEdited: true });
      r.receiptCategoryId = newId; r.categoryEdited = true;
      render();
      showBigToast('Đã lưu thành công phân loại mới!');
    });
    }
    render();
  }
  // Lấy đúng {label,get} của 1 số cột trong BORROWER_COLUMNS() theo đúng key được liệt kê, đúng thứ
  // tự được yêu cầu — dùng để dựng nhanh bộ cột riêng cho từng danh sách trong Kho lưu trữ.
  function pickBorrowerColumnsByKey(keys){
    const all = BORROWER_COLUMNS();
    const byKey = {}; all.forEach(c=> byKey[c.key]=c);
    return keys.map(k=>byKey[k]).filter(Boolean);
  }
  // Bảng 1 danh sách bất kỳ trong Kho lưu trữ — CỐ ĐỊNH 2 cột đầu (Mở Hộp biên lai + Họ và tên),
  // KHÔNG có bảng {thống kê chung}, KHÔNG có bộ lọc/tuỳ chỉnh cột/in ấn riêng (dùng bộ lọc chung ở
  // trên cùng của toàn Kho Biên lai).
  // Lấy tên phương án hiển thị cho 1 người vay trong Kho Biên lai — ưu tiên tra theo projectId (còn
  // tồn tại), nếu không có thì dùng tên đã lưu kèm khi gộp từ Thùng rác (__trashProjectName).
  function archiveProjectNameOf(b){
    if(b.projectId){
      const p = state.loanProjects.find(x=>x.id===b.projectId);
      if(p) return p.name;
    }
    if(b.__trashProjectName) return b.__trashProjectName;
    return '(Không rõ phương án — có thể đã bị xoá)';
  }
  function archiveSimpleTableHtml(list, cols, mode, listKind, perGroupButtonHtml){
    mode = mode||'receipts';
    const colHeader = mode==='confirmations' ? 'Mở hộp GXN' : 'Mở hộp BL';
    const borderColor = { active:'#2e7d32', settled:'#0d47a1', trash:'#4a148c' }[listKind] || '';
    if(!list.length) return `<p class="sub" style="padding:10px 0;">Không có ai trong danh sách này.</p>`;
    // Nhóm theo projectId (nếu còn tồn tại) để có thể sắp xếp đúng theo thứ tự tuỳ chỉnh đã lưu ở
    // panel "Danh sách Phương án vay đang hoạt động" — người vay không rõ phương án dồn về cuối cùng.
    const groupsById = {}; // projectId hoặc '__none__' -> { name, list }
    list.forEach(b=>{
      const key = (b.projectId && state.loanProjects.some(p=>p.id===b.projectId)) ? b.projectId : '__none__';
      if(!groupsById[key]) groupsById[key] = { name: archiveProjectNameOf(b), list: [] };
      groupsById[key].list.push(b);
    });
    const order = (state.config && state.config.projectOrder) || [];
    const orderIndex = {}; order.forEach((id,i)=> orderIndex[id]=i);
    const groupIds = Object.keys(groupsById).sort((a,c)=>{
      if(a==='__none__') return 1; if(c==='__none__') return -1;
      const ai = orderIndex[a], ci = orderIndex[c];
      if(ai!=null && ci!=null) return ai-ci;
      if(ai!=null) return -1; if(ci!=null) return 1;
      return groupsById[a].name.localeCompare(groupsById[c].name, 'vi');
    });
    return groupIds.map(gid=>{
      const projName = groupsById[gid].name;
      const groupList = gid!=='__none__' ? sortedBorrowerGroup(groupsById[gid].list, gid) : groupsById[gid].list;
      return `
      <div style="margin-bottom:14px;">
        <div class="sv-group-header" style="${perGroupButtonHtml?'display:flex; align-items:center; justify-content:space-between; gap:10px;':''}">
          <span>📋 ${escapeHtml(projName)} (${groupList.length} người vay)</span>
          ${perGroupButtonHtml||''}
        </div>
        <div class="table-wrap"${borderColor?` style="border-color:${borderColor}; border-width:2px;"`:''}><table>
          <thead><tr>
            <th class="frz-col1" style="background:var(--paper-2); min-width:110px;">${colHeader}</th>
            <th class="frz-col2" style="background:var(--paper-2); ${svColStyleHeader({key:'name',label:'Họ và tên', userInput:true})}">Họ và tên</th>
            ${cols.map(c=>`<th style="${svColStyleHeader(c)}">${htmlLabel(c.label)}</th>`).join('')}
          </tr></thead>
          <tbody>${groupList.map(b=>`<tr>
            <td class="frz-col1" style="background:var(--white);">${receiptBoxButtonHtml(b,false,mode)}</td>
            <td class="frz-col2 sv-col-wrap-check" style="background:var(--white);${b.isHeir?' text-decoration:underline;':''} ${svColStyle({key:'name',label:'Họ và tên', userInput:true})}">${escapeHtml(b.name)}</td>
            ${cols.map(c=>`<td class="${c.align==='right'?'money':'sv-col-wrap-check'}" style="${svColStyle(c)}">${c.get(b)}</td>`).join('')}
          </tr>`).join('')}
          <tr style="background:var(--paper-2); font-weight:700;">
            <td class="frz-col1" style="background:var(--paper-2);"></td>
            <td class="frz-col2" style="background:var(--paper-2);">TỔNG (${groupList.length})</td>
            ${cols.map(()=>`<td></td>`).join('')}
          </tr>
          </tbody>
        </table></div>
      </div>`;
    }).join('');
  }
  // Bọc ngoài archiveSimpleTableHtml cho riêng danh sách "Đã tất toán/Trả nợ trước hạn" trong Kho lưu
  // trữ — đầy đủ cấu trúc y hệt panel gốc "✅ Danh sách đã Tất toán...": mặc định chỉ hiện hộ còn nợ
  // tiền lãi, có nút "Danh sách từ 5 năm..."/"Danh sách cũ hơn 5 năm...", nút "Rút gọn toàn bộ".
  function buildArchiveSettledPanelHtml(allSettledList, cols, mode2, idPrefix){
    if(!allSettledList.length) return `<p class="sub" style="padding:10px 0;">Không có ai trong danh sách này.</p>`;
    const rangeMode = state.settledExpandedRange; // null (mặc định) | '5y' | số (chỉ số khung 5 năm)
    const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear()-5);
    const fiveYearsAgoStr = fiveYearsAgo.toISOString();
    const buckets = settledYearBuckets(allSettledList);
    const fiveYearCount = allSettledList.filter(b=> (b.settledAt||'') >= fiveYearsAgoStr).length;
    let settled, sectionTitle;
    if(!rangeMode){
      settled = allSettledList.filter(b=> computeInterestPaymentBoxDisplay(b).unpaidTotal>0);
      sectionTitle = null;
    } else if(rangeMode==='5y'){
      settled = allSettledList.filter(b=> (b.settledAt||'') >= fiveYearsAgoStr);
      sectionTitle = 'Danh sách từ 5 năm trước đến thời điểm hiện tại';
    } else {
      const bucket = buckets.find(bk=>bk.idx===rangeMode);
      settled = bucket? bucket.list : [];
      sectionTitle = bucket? `Danh sách từ năm ${bucket.fromYear} đến năm ${bucket.toYear}` : '';
    }
    settled = settled.slice().sort((a,b2)=>{
      if(!rangeMode){
        const aOwed = computeInterestPaymentBoxDisplay(a).unpaidTotal>0;
        const bOwed = computeInterestPaymentBoxDisplay(b2).unpaidTotal>0;
        if(aOwed !== bOwed) return aOwed? -1 : 1;
      }
      return (b2.settledAt||'').localeCompare(a.settledAt||'');
    });
    if(!settled.length && !rangeMode) return `<p class="sub" style="padding:10px 0;">Không có hộ vay nào đã tất toán/trả nợ trước hạn mà còn nợ tiền lãi.</p>${settledRangeButtonsHtml(idPrefix, buckets, fiveYearCount)}`;
    const titleHtml = rangeMode? `<div class="divider-lbl">${escapeHtml(sectionTitle)}</div>` : `<div class="divider-lbl">Danh sách khoản vay đã tất toán hoặc trả nợ xong Nhưng chưa hoàn tất việc đóng lãi</div>`;
    if(!settled.length) return `${titleHtml}<p class="sub" style="padding:10px 0;">Không có hộ vay nào.</p>${settledCollapseButtonHtml(idPrefix)}`;
    return `${titleHtml}${archiveSimpleTableHtml(settled, cols, mode2, 'settled', rangeMode? settledCollapseButtonHtml(idPrefix) : null)}${!rangeMode? settledRangeButtonsHtml(idPrefix, buckets, fiveYearCount) : ''}`;
  }
  // Gộp phẳng TẤT CẢ người vay đang nằm trong Thùng rác (Sổ vay vốn) — cả người bị xoá riêng lẻ lẫn
  // người nằm trong gói phương án bị xoá cả cụm — kèm tên phương án + người xoá + ngày xoá.
  function flattenTrashBorrowers(){
    const result = [];
    (state.trash||[]).forEach(item=>{
      if(item.borrowersSnapshot){
        Object.values(item.borrowersSnapshot).forEach(b=>{
          result.push({ ...b, __trashProjectName:item.name||'', __deletedByName:item.deletedByName||item.deletedBy||'', __deletedAt:item.deletedAt });
        });
      } else {
        const proj = state.loanProjects.find(p=>p.id===item.projectId);
        result.push({ ...item, __trashProjectName: proj? proj.name : '', __deletedByName:item.deletedByName||item.deletedBy||'', __deletedAt:item.deletedAt });
      }
    });
    return result;
  }

  function buildArchiveReceiptsContentHtml(mode){
    mode = mode||'receipts';
    const hamlets = state.config.hamlets||[];
    const projects = activeLoanProjects();
    ensureFilterHamletsInit(hamlets);
    ensureFilterProjectsInit(projects);

    let activeList = state.borrowers.filter(b=>!b.deleted && !b.settled && !b.riskDebt);
    const overdueList = activeList.filter(borrowerIsOverdueUnhandled); // MIỄN NHIỄM mọi bộ lọc
    activeList = activeList.filter(b=>!borrowerIsOverdueUnhandled(b));
    const totalActiveCountArc = activeList.length; // Tổng số THỰC SỰ — lấy TRƯỚC khi áp dụng bộ lọc

    const applyFilters = (list)=>{
      let l = list;
      if(state.search) l = l.filter(b=> (b.name+b.cccd+b.phone).toLowerCase().includes(state.search.toLowerCase()));
      if(state.filterHamlets.length < hamlets.length) l = l.filter(b=>state.filterHamlets.includes(b.hamlet));
      if(state.filterProjectIds.length < projects.length) l = l.filter(b=>state.filterProjectIds.includes(b.projectId));
      { const fs=fundSourcesInUse(); ensureFilterFundSourcesInit(fs); if(state.filterFundSources.length < fs.length) l = l.filter(b=>state.filterFundSources.includes((b.fundSource||'').trim())); }
      { const mgrs=ensureDefaultManagers(); ensureFilterManagersInit(mgrs); if(state.filterManagerIds.length < mgrs.length) l = l.filter(b=>state.filterManagerIds.includes(b.managerId||'chihoitruong')); }
      return l;
    };
    activeList = applyFilters(activeList);
    const showBadDebt = !!state.archiveShowBadDebt;
    const riskDebtBaseList = state.borrowers.filter(b=>!b.deleted && !b.settled && b.riskDebt && (showBadDebt? !!b.badDebt : !b.badDebt));
    const riskDebtList = applyFilters(riskDebtBaseList);
    const riskDebtOppositeCount = applyFilters(state.borrowers.filter(b=>!b.deleted && !b.settled && b.riskDebt && (showBadDebt? !b.badDebt : !!b.badDebt))).length;
    const settledBaseList = state.borrowers.filter(b=>!b.deleted && b.settled);
    const totalSettledCountArc = settledBaseList.length;
    const settledList = applyFilters(settledBaseList);
    const trashBaseList = flattenTrashBorrowers();
    const totalTrashCountArc = trashBaseList.length;
    const trashList = applyFilters(trashBaseList);
    const purgedBaseList = state.permanentlyDeletedBorrowers||[];
    const totalPurgedCountArc = purgedBaseList.length;
    const purgedList = applyFilters(purgedBaseList);

    // ---- Bộ cột riêng cho từng danh sách ----
    const activeCols = pickBorrowerColumnsByKey(['hamlet','principal','loanDate','dueDate','fundSource','rate','managerName','daysRemaining']);
    const purgedCols = pickBorrowerColumnsByKey(['hamlet','principal','loanDate','dueDate','fundSource','rate','managerName']);
    const trashCols = [
      ...pickBorrowerColumnsByKey(['hamlet']),
      { label:'Thuộc phương án', get:b=> escapeHtml(b.__trashProjectName||'') },
      ...pickBorrowerColumnsByKey(['principal','loanDate','dueDate','fundSource','rate','managerName']),
      { label:'Xoá bởi', get:b=> `${escapeHtml(b.__deletedByName||'')}${b.__deletedAt? ' — '+fmtDate(b.__deletedAt.slice(0,10)) : ''}` },
    ];
    // Cột riêng cho Nợ rủi ro / Đã tất toán — dựng lại ĐÚNG logic gốc ở panel cùng tên, bỏ hết cột nút
    const riskDebtCols = [
      pickBorrowerColumnsByKey(['principal'])[0],
      { label:'Ngày đến hạn', get:b=> fmtDate(b.dueDate) },
      { label:'Ngày gia hạn gần nhất', get:b=>{ const e=latestBorrowerExtension(b.id); return e? 'hạn '+fmtDate(e.to) : ''; } },
      { label:'Số lần gia hạn', get:b=> `${getBorrowerExtensions(b.id).length} lần` },
      { label:'Ngày xác nhận<br>Nợ rủi ro', get:b=> fmtDate(b.riskDebtDate) },
      { label:'Lý do', get:b=> escapeHtml(b.riskDebtReason||'') },
    ];
    const settledCols = [
      pickBorrowerColumnsByKey(['principal'])[0],
      { label:'Loại', get:b=> b.settledViaRiskDebt? 'Tất toán (hết nợ rủi ro)' : (b.settledType==='final'? 'Tất toán khoản vay' : 'Trả nợ trước hạn') },
      { label:'Ngày tất toán / trả nợ', get:b=> fmtDate((b.settledAt||'').slice(0,10) || b.dueDate) },
      { label:'Tiền lãi còn nợ (nếu có)', get:b=>{ const s=computeInterestPaymentBoxDisplay(b).unpaidTotal; return s>0? `<span style="color:var(--red); font-weight:700;">${moneySpaced(s)}</span>` : '—'; } },
      { label:'Người thừa kế', get:b=> b.heirName? escapeHtml((state.borrowers.find(x=>x.isHeir && x.heirOfBorrowerId===b.id)||{}).name || b.heirName) : '' },
    ];

    let html = '';
    if(overdueList.length){
      html += `<div class="panel" style="margin-bottom:14px;"><div class="panel-head"><h3 style="color:#b71c1c;">⚠️ Khoản vay quá hạn nhưng chưa được xử lý (${overdueList.length} hộ vay)</h3></div><div class="panel-body">${archiveSimpleTableHtml(overdueList, activeCols, mode)}</div></div>`;
    }
    html += `<div class="panel" style="margin-bottom:14px;">
      <div class="panel-head" style="cursor:pointer;" id="arc-borrowers-toggle"><h3>👥 Danh sách Khoản vay đang hoạt động (${totalActiveCountArc}) ${state.archiveShowBorrowers===false?'▾':'▴'}</h3></div>
      ${state.archiveShowBorrowers===false? '' : `<div class="panel-body ${panelBodyAnimClass()}">${archiveSimpleTableHtml(activeList, activeCols, mode, 'active')}
        <div style="text-align:center; margin-top:10px;"><button class="btn btn-ghost btn-sm preview-allow" id="arc-borrowers-collapse-all" style="color:#b71c1c; font-weight:700;">Rút gọn toàn bộ danh sách</button></div>
      </div>`}
    </div>`;
    html += `<div class="panel" style="margin-bottom:14px;">
      <div class="panel-head" style="cursor:pointer;" id="arc-riskdebt-toggle"><h3>⚠️ Danh sách khoản vay Nợ rủi ro (${countRiskDebtProcessing()}) ${state.archiveShowRiskDebt?'▴':'▾'}</h3></div>
      ${state.archiveShowRiskDebt? `<div class="panel-body ${panelBodyAnimClass()}">
        <div class="divider-lbl">${showBadDebt? '🚫 Các khoản vay Không có khả năng trả nợ' : '⚠️ Danh sách Nợ rủi ro trong diện đang xử lý'}</div>
        ${archiveSimpleTableHtml(riskDebtList, riskDebtCols, mode)}
        <div style="text-align:center; margin-top:10px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" id="arc-riskdebt-toggle-bad" style="${!showBadDebt?'color:#b71c1c; font-weight:700;':''}">${showBadDebt? `Xem Danh sách Nợ rủi ro trong diện đang xử lý (${riskDebtOppositeCount})` : `Xem Các khoản vay Không có khả năng trả nợ (${riskDebtOppositeCount})`}</button></div>
      </div>` : ''}
    </div>`;
    html += `<div class="panel" style="margin-bottom:14px;">
      <div class="panel-head" style="cursor:pointer;" id="arc-settled-toggle"><h3>✅ Danh sách đã Tất toán khoản vay hoặc Trả nợ trước hạn (${totalSettledCountArc}) ${state.archiveShowSettled?'▴':'▾'}</h3></div>
      ${state.archiveShowSettled? `<div class="panel-body ${panelBodyAnimClass()}">${buildArchiveSettledPanelHtml(settledList, settledCols, mode, 'arc-settled')}</div>` : ''}
    </div>`;
    html += `<div class="panel" style="margin-bottom:14px;">
      <div class="panel-head" style="cursor:pointer;" id="arc-trash-toggle"><h3>🗑️ Thùng rác (Sổ vay vốn) (${totalTrashCountArc}) ${state.archiveShowTrash?'▴':'▾'}</h3></div>
      ${state.archiveShowTrash? `<div class="panel-body ${panelBodyAnimClass()}">${archiveSimpleTableHtml(trashList, trashCols, mode, 'trash')}</div>` : ''}
    </div>`;
    html += `<div class="panel">
      <div class="panel-head" style="cursor:pointer;" id="arc-purged-toggle"><h3>Danh sách người vay đã bị xoá vĩnh viễn khỏi thùng rác - Không thể Khôi phục (${totalPurgedCountArc}) ${state.archiveShowPurged?'▴':'▾'}</h3></div>
      ${state.archiveShowPurged? `<div class="panel-body ${panelBodyAnimClass()}">${archiveSimpleTableHtml(purgedList, purgedCols, mode, 'trash')}</div>` : ''}
    </div>`;
    return { html, hamlets, projects };
  }

  function renderArchiveModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const TAB_COLORS = { receipts:'#7e57c2', confirmations:'#1976d2', logs:'#fbc02d' };
    const TAB_LABELS_UPPER = { receipts:'KHO BIÊN LAI', confirmations:'KHO GIẤY XÁC NHẬN', logs:'KHO DÒNG NHẬT KÝ SỔ VAY VỐN' };
    const TAB_LABELS_TOAST = { receipts:'Kho Biên lai', confirmations:'Kho Giấy xác nhận', logs:'Kho dòng nhật ký' };
    let lastToastTab = null;
    function tabBtnsHtml(idPrefix){
      const tabs = [ ['receipts','Kho Biên lai'], ['confirmations','Kho Giấy xác nhận'], ['logs','Kho dòng nhật ký'] ];
      const inner = `<div style="display:flex; border:2px solid #2e7d32;">${tabs.map(([key,label])=>{
        const active = state.archiveTab===key;
        const color = TAB_COLORS[key];
        const textColor = (active && key==='logs') ? '#000' : (active? '#fff' : '');
        return `<button type="button" class="archive-tab-btn preview-allow ${active?'active':''}" data-archive-tab="${idPrefix}-${key}" data-archive-tab-key="${key}" style="${active?`background:${color}; border-color:${color}; color:${textColor};`:''}"><span class="archive-tab-text">${label}</span></button>`;
      }).join('')}</div>`;
      // Chỉ khung tiêu đề (top) mới có thêm viền vàng bao ngoài viền xanh lá.
      return idPrefix==='top' ? `<div style="border:2px solid #fbc02d; padding:2px; display:inline-block;">${inner}</div>` : inner;
    }
    function render(){
      capturePanelAnimFlag();
      if(state.archiveTab!==lastToastTab){ lastToastTab = state.archiveTab; showTabSwitchToast(TAB_LABELS_TOAST[state.archiveTab]||''); }
      const hamlets = state.config.hamlets||[];
      const projects = activeLoanProjects();
      let receiptsBody = '', receiptsHamlets = hamlets, receiptsProjects = projects;
      if(state.archiveTab==='receipts' || state.archiveTab==='confirmations'){
        const r = buildArchiveReceiptsContentHtml(state.archiveTab);
        receiptsBody = r.html; receiptsHamlets = r.hamlets; receiptsProjects = r.projects;
      }
      const activeLabelTextColor = state.archiveTab==='logs' ? '#000' : '#fff';
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1300px; border:6px solid ${TAB_COLORS[state.archiveTab]};">
          <div class="modal-head modal-head-stack-narrow" style="background:linear-gradient(180deg, #9575cd 0%, #512da8 50%, #311b92 100%); display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <h3 style="color:#fff; margin:0;">${waveTextHtmlSlow('Kho lưu trữ các Biên lai, Giấy xác nhận, dòng nhật ký')}</h3>
            <div style="display:flex; align-items:center; gap:10px;">
              ${tabBtnsHtml('top')}
              <button class="modal-close preview-allow" id="arc-close">✕</button>
            </div>
          </div>
          <div class="modal-body" style="max-height:78vh; overflow:auto;">
            <p class="sub" style="margin:0 0 10px;">Các Biên lai (đã thanh toán), Giấy xác nhận, dòng nhật ký là KHÔNG thể Xoá hoặc thay đổi thông tin bên trong, và đây là nguồn sự thật duy nhất.</p>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
              <div style="display:inline-block; padding:6px 14px; background:${TAB_COLORS[state.archiveTab]}; color:${activeLabelTextColor}; font-weight:800;">${TAB_LABELS_UPPER[state.archiveTab]}</div>
              ${state.archiveTab==='receipts'? `<button type="button" class="btn btn-ghost btn-sm preview-allow" id="arc-shared-receipt-btn" style="border:2px solid #4a148c;">Hộp Biên lai dùng Chung</button><button type="button" class="btn btn-ghost btn-sm preview-allow" id="arc-unpaid-receipt-btn" style="border:2px solid #e65100;"><span id="arc-unpaid-receipt-btn-text">Hộp biên lai chưa thanh toán</span></button>` : ''}
              ${state.archiveTab==='confirmations'? `<button type="button" class="btn btn-ghost btn-sm preview-allow" id="arc-shared-conf-btn" style="border:2px solid #1565c0;">Hộp giấy xác nhận dùng Chung</button>` : ''}
            </div>
            <div style="min-height:120px;">
              ${(state.archiveTab==='receipts'||state.archiveTab==='confirmations')? `
                <div class="toolbar" style="flex-wrap:wrap;">
                  <input id="arc-search" class="preview-allow" placeholder="🔎 Tìm theo tên, CCCD, SĐT..." value="${state.search}" style="min-width:200px;${(state.search!=='' && state.search!==' ')? "border:2px solid #b71c1c;" : ""}">
                  ${buildHamletFilterDropdownHtml(receiptsHamlets)}
                  ${buildProjectFilterDropdownHtml(receiptsProjects)}
                  ${buildFundSourceFilterDropdownHtml()}
                  ${buildManagerFilterDropdownHtml()}
                  <button class="btn btn-ghost btn-sm preview-allow ${resetFilterBtnClass(receiptsHamlets, receiptsProjects)}" id="arc-reset-all-btn">↺ Khôi phục bộ lọc gốc</button>
                  <button type="button" class="btn btn-ghost btn-sm preview-allow" id="arc-collapse-everything-btn" style="background:none; border:none;">Rút gọn mọi thứ</button>
                </div>
                <div style="margin-top:14px;">${receiptsBody}</div>
              ` : ''}
              ${state.archiveTab==='logs'? (function(){ try{ return buildActivityLogPanelHtml(); }catch(err){ console.error('Lỗi khi dựng Kho dòng nhật ký:', err); return `<p class="sub" style="color:var(--red);">Có lỗi khi hiển thị Kho dòng nhật ký: ${escapeHtml(String(err&&err.message||err))}</p>`; } })() : ''}
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="arc-close2">Đóng bảng</button>
            <div class="modal-foot-tabs" style="display:contents;">${tabBtnsHtml('bottom')}</div>
          </div>
        </div>`;
      wrap.querySelector('#arc-close').onclick = close;
      wrap.querySelector('#arc-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('[data-archive-tab]').forEach(btn=>{
        btn.onclick = ()=>{ state.archiveTab = btn.dataset.archiveTabKey; state.openFilterDropdown = null; render(); };
      });
      if(state.archiveTab==='receipts' || state.archiveTab==='confirmations'){
        const sharedReceiptBtn = wrap.querySelector('#arc-shared-receipt-btn');
        if(sharedReceiptBtn) sharedReceiptBtn.onclick = ()=> renderSharedReceiptBoxModal();
        const unpaidReceiptBtn = wrap.querySelector('#arc-unpaid-receipt-btn');
        if(unpaidReceiptBtn) unpaidReceiptBtn.onclick = ()=> renderUnpaidReceiptBoxModal();
        const sharedConfBtn = wrap.querySelector('#arc-shared-conf-btn');
        if(sharedConfBtn) sharedConfBtn.onclick = ()=> renderSharedConfirmationBoxModal();
        wrap.querySelector('#arc-search').oninput = (e)=>{ state.search = e.target.value; rerenderKeepingFocus(render); };
        const toggleDropdown = (kind)=>{ state.openFilterDropdown = state.openFilterDropdown===kind ? null : kind; render(); };
        const hb = wrap.querySelector('#f-hamlet-btn'); if(hb) hb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('hamlet'); };
        const pb = wrap.querySelector('#f-project-btn'); if(pb) pb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('project'); };
        const hAll = wrap.querySelector('#f-hamlet-all'); if(hAll) hAll.onclick=(e)=>{ e.stopPropagation(); toggleHamletAll(receiptsHamlets, hAll.checked); render(); };
        wrap.querySelectorAll('.f-hamlet-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleHamletOne(receiptsHamlets, cb.dataset.name, cb.checked); render(); });
        const pAll = wrap.querySelector('#f-project-all'); if(pAll) pAll.onclick=(e)=>{ e.stopPropagation(); toggleProjectAll(receiptsProjects, pAll.checked); render(); };
        wrap.querySelectorAll('.f-project-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleProjectOne(receiptsProjects, cb.dataset.id, cb.checked); render(); });
        const fsb = wrap.querySelector('#f-fundsource-btn'); if(fsb) fsb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('fundsource'); };
        const mb = wrap.querySelector('#f-manager-btn'); if(mb) mb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('manager'); };
        const fsAll = wrap.querySelector('#f-fundsource-all'); if(fsAll) fsAll.onclick=(e)=>{ e.stopPropagation(); toggleFundSourceAll(fundSourcesInUse(), fsAll.checked); render(); };
        wrap.querySelectorAll('.f-fundsource-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleFundSourceOne(fundSourcesInUse(), cb.dataset.name, cb.checked); render(); });
        const mAll = wrap.querySelector('#f-manager-all'); if(mAll) mAll.onclick=(e)=>{ e.stopPropagation(); toggleManagerAll(ensureDefaultManagers(), mAll.checked); render(); };
        wrap.querySelectorAll('.f-manager-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleManagerOne(ensureDefaultManagers(), cb.dataset.id, cb.checked); render(); });
        const resetAllBtn = wrap.querySelector('#arc-reset-all-btn'); if(resetAllBtn) resetAllBtn.onclick=()=>{ resetAllBorrowerFilters(receiptsHamlets, receiptsProjects); render(); };
        const collapseEverythingBtn = wrap.querySelector('#arc-collapse-everything-btn'); if(collapseEverythingBtn) collapseEverythingBtn.onclick = ()=>{
          state.archiveShowBorrowers = false;
          state.archiveShowRiskDebt = false;
          state.archiveShowBadDebt = false;
          state.archiveShowSettled = false;
          state.archiveShowTrash = false;
          state.archiveShowPurged = false;
          render();
        };
        const bt = wrap.querySelector('#arc-borrowers-toggle'); if(bt) bt.onclick = ()=>{ state.archiveShowBorrowers = state.archiveShowBorrowers===false? true : false; if(state.archiveShowBorrowers!==false) showOpeningListToast('Khoản vay đang hoạt động'); markPanelJustToggled(); rerenderKeepingScroll(wrap, '.modal-body', render); if(state.archiveShowBorrowers!==false) setTimeout(()=>{ const h=wrap.querySelector('#arc-borrowers-toggle'); if(h) h.scrollIntoView({behavior:'smooth', block:'start'}); }, 50); };
        const arcCollapseAll = wrap.querySelector('#arc-borrowers-collapse-all'); if(arcCollapseAll) arcCollapseAll.onclick = ()=>{ state.archiveShowBorrowers = false; rerenderKeepingScroll(wrap, '.modal-body', render); };
        const rt = wrap.querySelector('#arc-riskdebt-toggle'); if(rt) rt.onclick = ()=>{ state.archiveShowRiskDebt = !state.archiveShowRiskDebt; if(state.archiveShowRiskDebt) showOpeningListToast('Nợ rủi ro'); markPanelJustToggled(); rerenderKeepingScroll(wrap, '.modal-body', render); if(state.archiveShowRiskDebt) setTimeout(()=>{ const h=wrap.querySelector('#arc-riskdebt-toggle'); if(h) h.scrollIntoView({behavior:'smooth', block:'start'}); }, 50); };
        const rtb = wrap.querySelector('#arc-riskdebt-toggle-bad'); if(rtb) rtb.onclick = ()=>{ state.archiveShowBadDebt = !state.archiveShowBadDebt; rerenderKeepingScroll(wrap, '.modal-body', render); };
        const st = wrap.querySelector('#arc-settled-toggle'); if(st) st.onclick = ()=>{ state.archiveShowSettled = !state.archiveShowSettled; if(state.archiveShowSettled) showOpeningListToast('đã Tất toán/Trả nợ trước hạn'); markPanelJustToggled(); rerenderKeepingScroll(wrap, '.modal-body', render); if(state.archiveShowSettled) setTimeout(()=>{ const h=wrap.querySelector('#arc-settled-toggle'); if(h) h.scrollIntoView({behavior:'smooth', block:'start'}); }, 50); };
        wireSettledRangeButtons(wrap, ()=> rerenderKeepingScroll(wrap, '.modal-body', render));
        const tt = wrap.querySelector('#arc-trash-toggle'); if(tt) tt.onclick = ()=>{ state.archiveShowTrash = !state.archiveShowTrash; if(state.archiveShowTrash) showOpeningListToast('Thùng rác (Sổ vay vốn)'); markPanelJustToggled(); rerenderKeepingScroll(wrap, '.modal-body', render); if(state.archiveShowTrash) setTimeout(()=>{ const h=wrap.querySelector('#arc-trash-toggle'); if(h) h.scrollIntoView({behavior:'smooth', block:'start'}); }, 50); };
        const pt = wrap.querySelector('#arc-purged-toggle'); if(pt) pt.onclick = ()=>{ state.archiveShowPurged = !state.archiveShowPurged; if(state.archiveShowPurged) showOpeningListToast('người vay đã bị xoá vĩnh viễn'); markPanelJustToggled(); rerenderKeepingScroll(wrap, '.modal-body', render); if(state.archiveShowPurged) setTimeout(()=>{ const h=wrap.querySelector('#arc-purged-toggle'); if(h) h.scrollIntoView({behavior:'smooth', block:'start'}); }, 50); };
        wrap.querySelectorAll('[data-open-receipt-box]').forEach(btn=>{
          btn.onclick = ()=>{
            const bid = btn.dataset.openReceiptBox;
            const found = state.borrowers.find(x=>x.id===bid) || flattenTrashBorrowers().find(x=>x.id===bid) || (state.permanentlyDeletedBorrowers||[]).find(x=>x.id===bid);
            if(!found) return;
            if(state.openFilterDropdown){ state.openFilterDropdown = null; render(); }
            if(btn.dataset.openReceiptMode==='confirmations'){
              renderConfirmationBoxModal(found);
            } else {
              renderReceiptBoxModal(found);
            }
          };
        });
        if(!wrap._outsideClickBound){
          wrap._outsideClickBound = true;
          document.addEventListener('click', (e)=>{
            if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
            if(e.target.closest('.sv-filter-dropdown')) return;
            state.openFilterDropdown = null;
            if(document.body.contains(wrap)) render();
          });
        }
      }
      if(state.archiveTab==='logs'){
       try{
        const toggleDropdown = (kind)=>{ state.openFilterDropdown = state.openFilterDropdown===kind ? null : kind; render(); };
        const logSearchInput = wrap.querySelector('#log-search'); if(logSearchInput) logSearchInput.oninput = (e)=>{ state.logSearch = e.target.value; rerenderKeepingFocus(render); };
        const kb = wrap.querySelector('#log-kind-btn'); if(kb) kb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('log-kind'); };
        const kAll = wrap.querySelector('#log-kind-all'); if(kAll) kAll.onclick=(e)=>{ e.stopPropagation(); state.logFilterKind = kAll.checked? LOG_FILTER_KIND_LIST.map(x=>x[0]) : []; render(); };
        wrap.querySelectorAll('.log-kind-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const k=cb.dataset.key; state.logFilterKind = cb.checked? state.logFilterKind.concat([k]) : state.logFilterKind.filter(x=>x!==k); render(); });
        const stb = wrap.querySelector('#log-specifictime-btn'); if(stb) stb.onclick=()=>{
          state.logSpecificTime = !state.logSpecificTime;
          if(state.logSpecificTime){ resetTimelineFilter('main'); }
          render();
        };
        const logResetBtn = wrap.querySelector('#log-reset-all-btn'); if(logResetBtn) logResetBtn.onclick = ()=>{
          state.logSearch = '';
          state.logFilterKind = LOG_FILTER_KIND_LIST.map(x=>x[0]);
          state.logSpecificTime = false; resetTimelineFilter('main');
          state.logExpandedYears = [new Date().getFullYear()];
          state.logExpandedBucket = null;
          render();
        };
        const logCollapseAllBtn = wrap.querySelector('#log-collapse-all-btn'); if(logCollapseAllBtn) logCollapseAllBtn.onclick = ()=>{
          state.logExpandedYears = [];
          state.logExpandedBucket = null;
          render();
        };
        wrap.querySelectorAll('[data-log-year-toggle]').forEach(btn=>{
          btn.onclick = ()=>{
            const y = parseInt(btn.dataset.logYearToggle,10);
            const opening = !state.logExpandedYears.includes(y);
            state.logExpandedYears = state.logExpandedYears.includes(y) ? state.logExpandedYears.filter(x=>x!==y) : state.logExpandedYears.concat([y]);
            render();
            if(opening) setTimeout(()=>{ const h=wrap.querySelector(`[data-log-year-toggle="${y}"]`); if(h) h.scrollIntoView({behavior:'smooth', block:'start'}); }, 50);
          };
        });
        wrap.querySelectorAll('[data-log-year-collapse]').forEach(btn=>{
          btn.onclick = ()=>{
            const y = parseInt(btn.dataset.logYearCollapse,10);
            state.logExpandedYears = state.logExpandedYears.filter(x=>x!==y);
            render();
          };
        });
        wrap.querySelectorAll('[data-log-bucket-toggle]').forEach(btn=>{
          btn.onclick = ()=>{
            const idx = parseInt(btn.dataset.logBucketToggle,10);
            const opening = state.logExpandedBucket!==idx;
            state.logExpandedBucket = state.logExpandedBucket===idx ? null : idx;
            render();
            if(opening) setTimeout(()=>{ const h=wrap.querySelector(`[data-log-bucket-toggle="${idx}"]`); if(h) h.scrollIntoView({behavior:'smooth', block:'start'}); }, 50);
          };
        });
        const qb = wrap.querySelector('#f-quarter-btn'); if(qb) qb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('quarter'); };
        const yb = wrap.querySelector('#f-year-btn'); if(yb) yb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('year'); };
        wireTimelineFilterDropdown('main', render, wrap);
        wrap.querySelectorAll('.f-quarter-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleQuarterFilter(cb.dataset.key, cb.checked); render(); });
        wrap.querySelectorAll('.f-year-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleYearFilter(parseInt(cb.dataset.year,10), cb.checked); render(); });
        { const yp = wrap.querySelector('#f-year-panel'); if(yp){ const sel = yp.querySelector('[data-selected-year]'); if(sel) sel.scrollIntoView({block:'center'}); }
          const qp = wrap.querySelector('#f-quarter-panel'); if(qp){ const selQ = qp.querySelector('[data-selected-quarter]'); if(selQ) selQ.scrollIntoView({block:'center'}); } }
        const logEntries = buildActivityLogEntries();
        wrap.querySelectorAll('[data-log-entry-idx]').forEach(el=>{
          el.onclick = ()=>{
            const e = logEntries[parseInt(el.dataset.logEntryIdx,10)];
            if(e && e.openFn) e.openFn();
          };
        });
        if(!wrap._logsOutsideClickBound){
          wrap._logsOutsideClickBound = true;
          document.addEventListener('click', (e)=>{
            if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
            if(e.target.closest('.sv-filter-dropdown')) return;
            state.openFilterDropdown = null;
            if(document.body.contains(wrap)) render();
          });
        }
       }catch(err){ console.error('Lỗi khi gắn sự kiện Kho dòng nhật ký:', err); }
      }
    }
    if(!state.archiveTab) state.archiveTab = 'receipts';
    if(state.archiveShowBorrowers===undefined) state.archiveShowBorrowers = true;
    render();
  }

  function renderSettlementModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.dataset.settlementModal = '1'; // đánh dấu để biên lai con tìm lại đúng modal này mà làm mới
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();

    function renderBody(){
      const hamlets = state.config.hamlets||[];
      const projects = activeLoanProjects();
      ensureFilterHamletsInit(hamlets);
      ensureFilterProjectsInit(projects);
      let list = state.borrowers.filter(b=>!b.deleted && !b.settled);
      if(state.search) list = list.filter(b=> (b.name+b.cccd+b.phone).toLowerCase().includes(state.search.toLowerCase()));
      if(state.filterHamlets.length < hamlets.length) list = list.filter(b=>state.filterHamlets.includes(b.hamlet));
      if(state.filterProjectIds.length < projects.length) list = list.filter(b=>state.filterProjectIds.includes(b.projectId));
      { const fs=fundSourcesInUse(); ensureFilterFundSourcesInit(fs); if(state.filterFundSources.length < fs.length) list = list.filter(b=>state.filterFundSources.includes((b.fundSource||'').trim())); }
      { const mgrs=ensureDefaultManagers(); ensureFilterManagersInit(mgrs); if(state.filterManagerIds.length < mgrs.length) list = list.filter(b=>state.filterManagerIds.includes(b.managerId||'chihoitruong')); }
      const statsHtml = renderSettlementStatsHtml(list, hamlets);
      const tablesHtml = renderSettlementGroupedTablesHtml(list, projects);

      // ---- Danh sách đã Tất toán/Trả nợ trước hạn xong — CÙNG bộ lọc Ấp/Phương án/Nguồn vay/Người
      // quản lý/Tìm kiếm như trên.
      let settledList = state.borrowers.filter(b=>!b.deleted && b.settled);
      if(state.search) settledList = settledList.filter(b=> (b.name+b.cccd+b.phone).toLowerCase().includes(state.search.toLowerCase()));
      if(state.filterHamlets.length < hamlets.length) settledList = settledList.filter(b=>state.filterHamlets.includes(b.hamlet));
      if(state.filterProjectIds.length < projects.length) settledList = settledList.filter(b=>state.filterProjectIds.includes(b.projectId));
      { const fs=fundSourcesInUse(); if(state.filterFundSources.length < fs.length) settledList = settledList.filter(b=>state.filterFundSources.includes((b.fundSource||'').trim())); }
      { const mgrs=ensureDefaultManagers(); if(state.filterManagerIds.length < mgrs.length) settledList = settledList.filter(b=>state.filterManagerIds.includes(b.managerId||'chihoitruong')); }
      const settledHtml = buildSettledBorrowersPanelHtml(settledList);

      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1300px; border:6px solid #0d47a1;">
          <div class="modal-head" style="background:linear-gradient(180deg, #64b5f6 0%, #1e6fd9 50%, #0d47a1 100%);"><h3 style="color:#fff;">${waveTextHtmlSlow('💰 Phê duyệt tất toán khoản vay hoặc trả nợ trước hạn')}</h3><button class="modal-close preview-allow" id="setm-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; overflow:auto;">
            <div class="toolbar" style="flex-wrap:wrap;">
              <input id="setm-search" class="preview-allow" placeholder="🔎 Tìm theo tên, CCCD, SĐT..." value="${state.search}" style="min-width:200px;${(state.search!=='' && state.search!==' ')? "border:2px solid #b71c1c;" : ""}">
              ${buildHamletFilterDropdownHtml(hamlets)}
              ${buildProjectFilterDropdownHtml(projects)}
              ${buildFundSourceFilterDropdownHtml()}
              ${buildManagerFilterDropdownHtml()}
              <button class="btn btn-ghost btn-sm preview-allow ${resetFilterBtnClass(hamlets, projects)}" id="setm-reset-all-btn">↺ Khôi phục bộ lọc gốc</button>
            </div>
            <div class="divider-lbl" style="margin-top:14px;">📋 Danh sách khoản vay đang hoạt động</div>
            ${statsHtml}
            ${tablesHtml}
            <div class="divider-lbl" style="margin-top:24px;">✅ Danh sách khoản vay đã tất toán hoặc trả nợ trước hạn xong</div>
            <div id="setm-settled-area">${settledHtml}</div>
            <div style="display:flex; gap:8px; margin-top:16px;">
              <button class="btn btn-ghost preview-allow" id="setm-close-bottom">Đóng bảng</button>
            </div>
          </div>
        </div>`;
      wire(hamlets, projects);
    }

    function wire(hamlets, projects){
      wrap.querySelector('#setm-close').onclick = close;
      wrap.querySelector('#setm-close-bottom').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)

      // Bấm bất kỳ nút nào trong khu vực "Đã tất toán/trả nợ trước hạn xong" -> tự cuộn cả bảng
      // xuống cuối cùng (tránh bị tự cuộn ngược lên đầu, bất tiện với màn hình laptop nhỏ).
      const settledArea = wrap.querySelector('#setm-settled-area');
      if(settledArea) settledArea.addEventListener('click', (e)=>{
        if(!e.target.closest('button')) return;
        setTimeout(()=>{ const body = wrap.querySelector('.modal-body'); if(body) body.scrollTop = body.scrollHeight; }, 0);
      });

      wrap.querySelector('#setm-search').oninput = (e)=>{ state.search = e.target.value; rerenderKeepingFocus(renderBody); };
      const toggleDropdown = (kind)=>{ state.openFilterDropdown = state.openFilterDropdown===kind ? null : kind; renderBody(); };
      const hb = wrap.querySelector('#f-hamlet-btn'); if(hb) hb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('hamlet'); };
      const pb = wrap.querySelector('#f-project-btn'); if(pb) pb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('project'); };
      const qb = wrap.querySelector('#f-quarter-btn'); if(qb) qb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('quarter'); };
      const yb = wrap.querySelector('#f-year-btn'); if(yb) yb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('year'); };
      const hAll = wrap.querySelector('#f-hamlet-all'); if(hAll) hAll.onclick=(e)=>{ e.stopPropagation(); toggleHamletAll(hamlets, hAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-hamlet-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleHamletOne(hamlets, cb.dataset.name, cb.checked); renderBody(); });
      const pAll = wrap.querySelector('#f-project-all'); if(pAll) pAll.onclick=(e)=>{ e.stopPropagation(); toggleProjectAll(projects, pAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-project-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleProjectOne(projects, cb.dataset.id, cb.checked); renderBody(); });
      const fsb = wrap.querySelector('#f-fundsource-btn'); if(fsb) fsb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('fundsource'); };
      const mb = wrap.querySelector('#f-manager-btn'); if(mb) mb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('manager'); };
      const fsAll = wrap.querySelector('#f-fundsource-all'); if(fsAll) fsAll.onclick=(e)=>{ e.stopPropagation(); toggleFundSourceAll(fundSourcesInUse(), fsAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-fundsource-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleFundSourceOne(fundSourcesInUse(), cb.dataset.name, cb.checked); renderBody(); });
      const mAll = wrap.querySelector('#f-manager-all'); if(mAll) mAll.onclick=(e)=>{ e.stopPropagation(); toggleManagerAll(ensureDefaultManagers(), mAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-manager-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleManagerOne(ensureDefaultManagers(), cb.dataset.id, cb.checked); renderBody(); });
      wrap.querySelectorAll('.f-quarter-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleQuarterFilter(cb.dataset.key, cb.checked); renderBody(); });
      wrap.querySelectorAll('.f-year-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleYearFilter(parseInt(cb.dataset.year,10), cb.checked); renderBody(); });
      const yearPanel = wrap.querySelector('#f-year-panel'); if(yearPanel){ const sel = yearPanel.querySelector('[data-selected-year]'); if(sel) sel.scrollIntoView({block:'center'}); }
      const quarterPanel = wrap.querySelector('#f-quarter-panel'); if(quarterPanel){ const selQ = quarterPanel.querySelector('[data-selected-quarter]'); if(selQ) selQ.scrollIntoView({block:'center'}); }
      const resetAllBtn = wrap.querySelector('#setm-reset-all-btn'); if(resetAllBtn) resetAllBtn.onclick=()=>{ resetAllBorrowerFilters(hamlets, projects); renderBody(); };

      // "Trả nợ trước hạn" / "Tất toán khoản vay"
      wrap.querySelectorAll('[data-settle-early]').forEach(btn=>{
        btn.onclick = ()=>{
          if(btn.dataset.settleEarlyOk!=='1'){
            alert(btn.dataset.settleEarlyReason || 'Hộ vay này hiện chưa đủ điều kiện Trả nợ trước hạn.');
            return;
          }
          const b = state.borrowers.find(x=>x.id===btn.dataset.settleEarly);
          if(b) renderEarlyRepaymentModal(b);
        };
      });
      wrap.querySelectorAll('[data-shared-early-repay]').forEach(btn=>{
        btn.onclick = ()=>{
          const gid = btn.dataset.sharedEarlyRepay;
          const ids = (btn.dataset.sharedEarlyRepayIds||'').split(',').filter(Boolean);
          const groupList = ids.map(id=> state.borrowers.find(b=>b.id===id)).filter(Boolean);
          if(!groupList.length){ alert('Không tìm thấy người vay nào trong danh sách này.'); return; }
          if(groupList.length<2){ alert('Chức năng "Tất toán khoản vay" ở dòng Tổng chỉ có tác dụng khi trong danh sách có từ 2 người trở lên.'); return; }
          const allOk = groupList.every(b=>{
            const exts = getBorrowerExtensions(b.id);
            const inExt = exts.length>0;
            const proj = projectOf(b);
            const dueRef = exts.length? exts[exts.length-1].to : (proj? proj.dueDate : b.dueDate);
            const dLeft = daysRemainingUntil(dueRef);
            return inExt || (dLeft!=null && dLeft<=60);
          });
          if(!allOk){
            alert('Chỉ cho phép các hộ trong danh sách có "Ngày đến hạn" (hoặc "Ngày gia hạn gần nhất" nếu có) còn ≤ 60 ngày, hoặc đang trong thời gian gia hạn nợ, mới được Tất toán khoản vay. Đối với hộ chưa gần đến ngày đến hạn, vui lòng chọn "Trả nợ trước hạn".');
            return;
          }
          renderSharedFinalSettlementModal(gid, groupList);
        };
      });
      wrap.querySelectorAll('[data-settle-final]').forEach(btn=>{
        btn.onclick = ()=>{
          if(btn.dataset.settleFinalOk!=='1'){
            alert('Chỉ cho phép hộ có "Ngày đến hạn" (hoặc "Ngày gia hạn gần nhất" nếu có) còn ≤ 60 ngày, hoặc đang trong thời gian gia hạn nợ, mới được Tất toán khoản vay. Đối với hộ chưa gần đến ngày đến hạn, vui lòng chọn "Trả nợ trước hạn".');
            return;
          }
          const b = state.borrowers.find(x=>x.id===btn.dataset.settleFinal);
          if(b) renderFinalSettlementModal(b);
        };
      });
      wrap.querySelectorAll('[data-settle-history]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.settleHistory);
          if(b) renderSettlementHistoryModal(b);
        };
      });
      wireSettledRangeButtons(wrap, renderBody);

      if(!wrap._outsideClickBound){
        wrap._outsideClickBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
          if(e.target.closest('.sv-filter-dropdown')) return;
          state.openFilterDropdown = null;
          if(document.body.contains(wrap)) renderBody();
        });
      }
    }

    wrap._refreshSettlement = renderBody;
    renderBody();
  }

