  // =====================================================================
  // Modal "BIÊN LAI TẤT TOÁN KHOẢN VAY" — chỉ dùng được khi hộ vay đã gần/đến/quá "ngày đến hạn"
  // (hoặc ngày gia hạn gần nhất) ≤60 ngày (đã kiểm tra ở bảng trước khi mở modal này).
  // =====================================================================
  function renderFinalSettlementModal(b, goBackOverride, viaRiskDebt){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const openedAt = Date.now();
    const close = ()=> wrap.remove();
    const snapshotTotalPaidAtOpen = getInterestPaymentBoxRaw(b.id).totalPaid;
    const goBack = goBackOverride || (()=>{ close(); renderSettlementModal(); });
    let includeInterest = true;
    let advOpen = false;

    function render(){
      const principal = parseFloat(b.principal)||0;
      const interestInfo = includeInterest ? borrowerUnpaidInterestUpToToday(b) : { lines:[], total:0 };
      const grandTotal = principal + interestInfo.total;
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head" style="background:#0d3b78;"><h3 style="color:#fff;">BIÊN LAI TẤT TOÁN KHOẢN VAY CỦA HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="fsm-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
            <div class="kv-row"><span>Số tiền vay gốc</span><b>${moneySpaced(principal)}</b></div>
            <div style="display:flex; align-items:center; gap:4px; margin-top:10px;">
              <button type="button" class="btn btn-sm preview-allow" id="fsm-interest-toggle" style="${includeInterest? 'background:#fb8c00; color:#fff;' : 'background:#1976d2; color:#fff;'}">${includeInterest? 'Tắt bổ sung: Tiền lãi chưa đóng (tính đến QUÝ hiện tại)' : 'Bổ sung: Tiền lãi chưa đóng (tính đến QUÝ hiện tại)'}</button>
            </div>
            ${includeInterest? `<div class="kv-row" style="margin-top:6px;"><span>Tiền lãi chưa đóng (tính đến QUÝ hiện tại)</span><b>${moneySpaced(interestInfo.total)}</b></div>` : ''}
            <div class="kv-row big-money-row" style="border-top:1px solid var(--line); margin-top:10px; padding-top:6px;"><span>Số tiền thực tế nhận được</span><b>= ${moneySpaced(grandTotal)}</b></div>
            ${(b.riskDebt && !b.riskDebtKeepInterest && b.frozenAsOf)? `<p class="sub" style="margin:6px 0 0; color:#b71c1c;">⚠️ Lưu ý: hộ vay này đã được xác nhận Nợ rủi ro và KHÔNG tính tiền lãi kể từ ngày ${fmtDate(b.frozenAsOf)} trở đi (theo đúng Giấy xác nhận Nợ rủi ro), nên "Tiền lãi chưa đóng (tính đến QUÝ hiện tại)" ở trên CHỈ tính tới đúng ngày đó, không phát sinh thêm gì sau đó.</p>` : ''}
            ${settlementPayerFieldsHtml(b,'fsm')}
            ${settlementAdvancedInfoHtml(b, interestInfo, false, null, 'fsm', advOpen)}
            <p class="sub" id="fsm-error" style="color:var(--red); font-weight:700; display:none; margin-top:6px;"></p>
          </div>
          <div class="modal-foot" style="justify-content:space-between;">
            <button class="btn btn-ghost preview-allow" id="fsm-back">Quay lại (không lưu)</button>
            <div style="display:flex; gap:8px;">
              ${sendPaymentLinkBtnHtml('fsm')}
              <button class="btn btn-primary preview-allow" id="fsm-confirm">Xác nhận tất toán thành công</button>
            </div>
          </div>
        </div>`;
      wrap.querySelector('#fsm-close').onclick = close;
      wrap.querySelector('#fsm-back').onclick = goBack;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelector('#fsm-interest-toggle').onclick = ()=>{ includeInterest = !includeInterest; render(); };
      wireAdvancedInfo(wrap, 'fsm', (open)=>{ advOpen = open; });
      wireConfirmBtnBehavior(wrap, wrap.querySelector('#fsm-confirm'), openedAt);
      wireSendPaymentLinkBtn(wrap, 'fsm', ()=>{
        const payerName = (wrap.querySelector('#fsm-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#fsm-collector').value||'').trim();
        return { title:'BL Tất toán khoản vay', amount: grandTotal, borrowerNames:[b.name], borrowerIds:[b.id], contentEl: wrap.querySelector('.modal-body'),
          replay: { applyFn:'settlement_final', borrowerId:b.id, includeInterest, viaRiskDebt, grandTotal, principal, payerName, collectorName } };
      }, async ()=>{
        if(includeInterest && interestInfo.total>0){
          if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return false;
        }
        return true;
      });
      wrap.querySelector('#fsm-confirm').onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
        const payerName = (wrap.querySelector('#fsm-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#fsm-collector').value||'').trim();
        if(!payerName || !collectorName){ alert('Vui lòng điền đầy đủ "Người trả nợ" và "Người nhận tiền" trước khi xác nhận.'); return; }
        if(includeInterest && interestInfo.total>0){
          if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return;
        }
        if(!(await assertNoUnpaidReceiptLock(b.id, b.name))) return;
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        if(includeInterest && interestInfo.total>0) await settleInterestForClosure(b, false);
        await markBorrowerSettled(b, 'final', { settledInterestIncluded: includeInterest? interestInfo.total : 0, settledUpToToday:false, settledGrandTotal: grandTotal,
          settledSnapshot: buildSettlementSnapshot(b, includeInterest? interestInfo : null, false, null),
          ...(viaRiskDebt? { settledViaRiskDebt:true, riskDebt:false } : {}) });
        await pushReceiptRecord(b, includeInterest? 'settlement_with_interest' : 'settlement_no_interest', {
          amount: grandTotal, sign:'+',
          quarterLines: includeInterest? (interestInfo.lines||[]).map(x=>({ qk:x.box.qk, year:x.box.year, amount:x.amount })) : [],
          extra: { principal, interestIncluded: includeInterest? interestInfo.total : 0, grandTotal, payerName, collectorName },
        });
        await pushLog('xác nhận', `tất toán khoản vay cho hộ vay ${b.name} (gốc ${moneySpaced(principal)}${includeInterest?` + lãi ${moneySpaced(interestInfo.total)}`:''})`);
        refreshOpenSettlementModal();
        if(viaRiskDebt) refreshOpenRiskDebtModal();
        hideProcessingToast(); // Bước 4
        showBigToast(`Tất toán thành công: hộ vay ${b.name}, tổng số tiền ${groupDigitsRight(String(Math.round(grandTotal)),3)}đ`);
      };
    }
    render();
  }

  // =====================================================================
  // Modal "BIÊN LAI TRẢ NỢ TRƯỚC HẠN" — luôn cho phép, không cần điều kiện "gần đến hạn".
  // =====================================================================
  // "BIÊN LAI CHUNG: TRẢ NỢ TRƯỚC HẠN CHO CÁC HỘ TRONG PHƯƠNG ÁN VAY..." — nội dung y hệt biên lai cá
  // nhân, chỉ khác là liệt kê riêng từng hộ (có checkbox bật/tắt từng dòng, gạch ngang khi tắt).
  // Tìm các Quý "CHUNG" giữa NHIỀU hộ vay — chỉ hiện Quý nào mà TẤT CẢ hộ đều có, cùng tên (kể cả
  // dấu * và #), cùng số tiền (tính TƯƠI MỚI theo box.interestAmount), cùng ngày bắt đầu/kết thúc.
  function findCommonQuarterLines(groupList, lineKey){
    if(!groupList.length) return [];
    const disps = groupList.map(b=> computeInterestPaymentBoxDisplay(b));
    const firstLines = disps[0][lineKey];
    const result = [];
    for(const ref of firstLines){
      const matched = disps.map(d=> d[lineKey].find(x=> x.name===ref.name));
      if(matched.some(m=>!m)) continue;
      const allSame = matched.every(m=> m.box.interestAmount===ref.box.interestAmount && m.box.from===ref.box.from && m.box.to===ref.box.to);
      if(!allSame) continue;
      result.push({ name: ref.name, amount: ref.box.interestAmount, from: ref.box.from, to: ref.box.to });
    }
    return result;
  }
  // "Thông tin chi tiết Quý X của các hộ vay" — bản rút gọn của nút chữ i trong luồng chung.
  function renderSharedQuarterInfoModal(qData, groupList, isPaid){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const days = daysBetween(qData.from, qData.to);
    const total = qData.amount * groupList.length;
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:520px;">
        <div class="modal-head"><h3>Thông tin chi tiết ${escapeHtml(qData.name)} của các hộ vay</h3><button class="modal-close preview-allow" id="sqi-close">✕</button></div>
        <div class="modal-body">
          <p>Đây là ${escapeHtml(qData.name)} ${isPaid?'đã đóng lãi':'chưa đóng lãi'}.</p>
          <p>Bắt đầu từ ngày ${fmtDate(qData.from)} đến ngày ${fmtDate(qData.to)}, tổng số ngày trong quý này là ${days} ngày.</p>
          <p>Số tiền ${isPaid?'đã đóng':'chưa đóng'} trong quý này là: ${moneySpaced(qData.amount)} (mỗi hộ)</p>
          <p>Tổng số tiền ${isPaid?'đã đóng':'chưa đóng'} của ${groupList.length} hộ trong quý này là: ${moneySpaced(total)}</p>
        </div>
        <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="sqi-close2">Đóng bảng</button></div>
      </div>`;
    wrap.querySelector('#sqi-close').onclick = close;
    wrap.querySelector('#sqi-close2').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
  }
  // "Chọn quý để tính tiền lãi cho các hộ vay" — y hệt bảng chọn quý cá nhân, chỉ khác không có nút
  // "nhập số tiền cụ thể", và chỉ hiện các Quý CHUNG (cùng tên, cùng tiền, cùng ngày ở TẤT CẢ hộ).
  function renderSharedInterestPaymentSelectModal(projectId, groupList){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const proj = state.loanProjects.find(p=>p.id===projectId);
    const projName = proj? proj.name : '';
    const namesStr = groupList.map(b=>b.name).join(', ');
    const selectedNames = new Set();
    function render(){
      const pastList = findCommonQuarterLines(groupList, 'unpaidLines');
      const futureList = findCommonQuarterLines(groupList, 'futureUnpaidLines');
      const paidList = findCommonQuarterLines(groupList, 'paidLines');
      const leftoverTotal = groupList.reduce((s,b)=> s+computeInterestPaymentBoxDisplay(b).leftover, 0);
      const pastSelectedCount = pastList.filter(x=>selectedNames.has(x.name)).length;
      const futureUnlocked = pastList.length===0 || pastSelectedCount===pastList.length;
      function renderGroup(list, kind){
        if(!list.length) return `<p class="sub">Không có quý nào trong danh sách này hoặc các quý bị ẩn do Không đáp ứng được điều kiện hiển thị ở phía trên (dòng chữ đỏ).</p>`;
        return `<div style="margin-top:6px;">${list.map((x,idx)=>{
          const sel = selectedNames.has(x.name);
          const locked = kind==='future' && !futureUnlocked;
          return `<span class="qbox-wrap">
            <button class="qbox-btn preview-allow ${sel?'qbox-selected':''}" data-qname="${escapeHtml(x.name)}" data-kind="${kind}" data-idx="${idx}" ${locked?'style="opacity:.45;"':''}>${escapeHtml(x.name)}</button>
            <button class="qbox-info-btn preview-allow" data-qinfo-name="${escapeHtml(x.name)}" data-qinfo-kind="${kind}">i</button>
          </span>`;
        }).join('')}</div>`;
      }
      const selectedList = pastList.concat(futureList).filter(x=>selectedNames.has(x.name));
      const selectedSum = selectedList.reduce((s,x)=>s+x.amount*groupList.length,0) - leftoverTotal;
      const canProceed = selectedNames.size>0 && selectedSum>=0;
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:900px;">
          <div class="modal-head"><h3>Chọn quý để tính tiền lãi cho các hộ vay (Biên lai Chung)</h3><button class="modal-close preview-allow" id="siap-close">✕</button></div>
          <div class="modal-body">
            <p style="margin:0 0 4px; color:#000;">Tổng ${groupList.length} hộ vay: ${escapeHtml(namesStr)}</p>
            <p class="sub" style="margin:0 0 10px; color:#b71c1c;">Chỉ hiển thị những quý được tính tiền lãi chung, điều kiện hiển thị: Các quý có cùng tên quý như nhau, và số tiền bên trong của từng quý cũng giống hệt nhau (của những hộ trên).</p>
            <div class="divider-lbl" style="margin-top:0;">Các Quý chưa đóng lãi từ QUÁ KHỨ tới HIỆN TẠI:</div>
            ${renderGroup(pastList,'past')}
            <div class="divider-lbl">Các Quý chưa đóng lãi trong TƯƠNG LAI:</div>
            ${renderGroup(futureList,'future')}
            ${leftoverTotal>0? `
            <div style="margin-top:14px; display:flex; align-items:center; gap:6px;">
              <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" checked disabled>
                <span style="color:${RC.verbGreen}; font-weight:700;">Bổ sung thêm: số tiền dư từ đợt trước ${moneySpaced(leftoverTotal)} của ${groupList.length} hộ vay (Trừ vào biên lai)</span>
              </label>
              <button type="button" class="qbox-info-btn preview-allow" id="siap-leftover-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button>
            </div>
            <div id="siap-leftover-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin-top:6px;">"Số tiền dư từ đợt trước" của từng hộ sẽ tự động được trừ vào Biên lai chung này - Số tiền dư của người nào luôn được tính đúng vào Thông tin đóng lãi và Biên lai của người đó — luôn bắt buộc, không thể bỏ chọn.</div>` : ''}
            <div class="divider-lbl">Các Quý đã đóng lãi XONG:</div>
            ${paidList.length? `<div style="margin-top:6px;">${paidList.map(x=>`<span class="qbox-wrap">
              <button class="qbox-btn" disabled style="opacity:.65; cursor:default;">${escapeHtml(x.name)}</button>
              <button class="qbox-info-btn preview-allow" data-qinfo-name="${escapeHtml(x.name)}" data-qinfo-kind="paid">i</button>
            </span>`).join('')}</div>` : `<p class="sub">Không có quý nào trong danh sách này hoặc các quý bị ẩn do Không đáp ứng được điều kiện hiển thị ở phía trên (dòng chữ đỏ).</p>`}
          </div>
          <div class="modal-foot" style="justify-content:space-between;">
            <button class="btn btn-ghost preview-allow" id="siap-cancel">Đóng bảng</button>
            <div style="display:flex; align-items:center; gap:12px;">
              ${canProceed? `<span class="sub" style="font-weight:700; color:var(--rice-dark);">Tổng ${groupDigitsRight(String(Math.round(selectedSum)),3)} đồng (trong ${selectedNames.size}-quý được chọn${leftoverTotal>0?' - tiền dư':''})</span>` : ''}
              <button class="btn btn-primary preview-allow" id="siap-start" ${canProceed?'':'disabled'}>Bắt đầu tính tiền và lập biên lai</button>
            </div>
          </div>
        </div>`;
      wrap.querySelector('#siap-close').onclick = close;
      wrap.querySelector('#siap-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('[data-qname]').forEach(btn=>{
        btn.onclick = ()=>{
          const name = btn.dataset.qname, kind = btn.dataset.kind, idx = parseInt(btn.dataset.idx,10);
          if(kind==='future'){
            if(!futureUnlocked){ alert('Phải chọn HẾT các Quý ở phần "QUÁ KHỨ tới HIỆN TẠI" trước khi chọn Quý tương lai (trừ khi không còn Quý nào ở phần đó).'); return; }
            const already = selectedNames.has(name);
            if(!already){
              if(idx>0 && !selectedNames.has(futureList[idx-1].name)){ alert('Chỉ được chọn Quý tương lai theo đúng thứ tự — vui lòng chọn Quý tương lai GẦN NHẤT trước.'); return; }
              selectedNames.add(name);
            } else {
              selectedNames.delete(name);
              for(let j=idx+1;j<futureList.length;j++) selectedNames.delete(futureList[j].name);
            }
          } else {
            if(selectedNames.has(name)){
              selectedNames.delete(name);
              futureList.forEach(x=> selectedNames.delete(x.name));
            } else {
              selectedNames.add(name);
            }
          }
          render();
        };
      });
      wrap.querySelectorAll('[data-qinfo-name]').forEach(btn=>{
        btn.onclick = (e)=>{
          e.stopPropagation();
          const kind = btn.dataset.qinfoKind;
          const list = kind==='past'? pastList : kind==='future'? futureList : paidList;
          const q = list.find(x=>x.name===btn.dataset.qinfoName);
          if(q) renderSharedQuarterInfoModal(q, groupList, kind==='paid');
        };
      });
      const leftoverInfoBtn = wrap.querySelector('#siap-leftover-info');
      const leftoverTip = wrap.querySelector('#siap-leftover-tip');
      if(leftoverInfoBtn) leftoverInfoBtn.onclick = (e)=>{ e.stopPropagation(); leftoverTip.style.display = leftoverTip.style.display==='none'?'block':'none'; };
      const startBtn = wrap.querySelector('#siap-start');
      if(startBtn){
        startBtn.addEventListener('mouseenter', ()=>{
          const body = wrap.querySelector('.modal-body');
          if(body) body.scrollTo({ top: body.scrollHeight, behavior:'smooth' });
        });
        startBtn.onclick = ()=>{
          if(!canProceed) return;
          close();
          renderSharedInterestPaymentReceiptModal(projectId, groupList, [...selectedNames].map(name=> pastList.concat(futureList).find(x=>x.name===name)).filter(Boolean));
        };
      }
    }
    render();
  }
  // "BIÊN LAI ĐÓNG TIỀN LÃI ĐỐI VỚI N HỘ VAY THUỘC PHƯƠNG ÁN VAY..." — bước cuối, thực sự đóng lãi
  // cho từng hộ trong nhóm.
  function renderSharedInterestPaymentReceiptModal(projectId, groupList, chosenQuarters){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const openedAt = Date.now();
    const close = ()=> wrap.remove();
    const snapshotTotalPaidAtOpen = {}; groupList.forEach(b=>{ snapshotTotalPaidAtOpen[b.id] = getInterestPaymentBoxRaw(b.id).totalPaid; });
    const proj = state.loanProjects.find(p=>p.id===projectId);
    const projName = proj? proj.name : '';
    const namesStr = groupList.map(b=>b.name).join(', ');
    const leftoverPerBorrower = groupList.map(b=> ({ b, leftover: computeInterestPaymentBoxDisplay(b).leftover }));
    const leftoverTotal = leftoverPerBorrower.reduce((s,x)=>s+x.leftover,0);
    const quarterTotal = chosenQuarters.reduce((s,q)=>s+q.amount*groupList.length,0);
    const grandTotal = quarterTotal - leftoverTotal;
    let selectedCategoryId = '';
    let advInfoOpen = false;
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:680px;">
          <div class="modal-head receipt-head-payment"><h3>BIÊN LAI CHUNG: ĐÓNG TIỀN LÃI ĐỐI VỚI ${groupList.length} HỘ VAY THUỘC PHƯƠNG ÁN VAY ${escapeHtml(projName).toUpperCase()}</h3><button class="modal-close preview-allow" id="sirc-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
            <p style="margin:0 0 6px; font-weight:700;">Tổng ${groupList.length} hộ vay: ${escapeHtml(namesStr)}</p>
            ${chosenQuarters.map(q=>`<div class="kv-row"><span>${escapeHtml(q.name)} (${moneySpaced(q.amount)} x ${groupList.length} hộ)</span><b>${moneySpaced(q.amount*groupList.length)}</b></div>`).join('')}
            <div class="kv-row" style="border-top:1px solid var(--line); margin-top:6px; padding-top:6px;"><span>Tổng tiền các quý</span><b style="color:#0d47a1;">= ${moneySpaced(quarterTotal)}</b></div>
            <div style="display:flex; align-items:center; gap:4px; margin-top:14px;">
              <span>Bổ sung tiền dư từ đợt trước (trừ vào biên lai)</span>
              <button type="button" class="qbox-info-btn preview-allow" id="sirc-leftover-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button>
            </div>
            <div id="sirc-leftover-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:6px 0;">Số tiền dư từ đợt trước của từng hộ được tự động trừ vào Biên lai chung này - Số tiền dư của người nào luôn được tính đúng vào Thông tin đóng lãi và Biên lai của người đó.</div>
            ${leftoverTotal<=0? `<p class="sub">Các hộ này không có hộ nào có tiền dư từ đợt trước</p>` : `
            ${leftoverPerBorrower.map(x=>`<div class="kv-row"><span>${escapeHtml(x.b.name)}</span><b>- ${moneySpaced(x.leftover)}</b></div>`).join('')}
            <div class="kv-row" style="border-top:1px solid var(--line); margin-top:6px; padding-top:6px;"><span>Tổng tiền dư đợt trước của ${groupList.length} hộ</span><b style="color:#b71c1c;">- ${moneySpaced(leftoverTotal)}</b></div>`}
            <div class="kv-row big-money-row" style="border-top:2px solid var(--line); margin-top:10px; padding-top:8px;">
              <span style="display:flex; align-items:center; gap:4px;">Tổng tất cả (số tiền thực nhận) <button type="button" class="qbox-info-btn" id="sirc-total-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button></span>
              <b>= ${moneySpaced(grandTotal)}</b>
            </div>
            <div id="sirc-total-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:6px 0;">Đây là số tiền nhận được thực tế từ những người đóng lãi.</div>
            <div class="field" style="margin-top:14px;"><label>Người đóng tiền *</label><input id="sirc-payer" maxlength="30" class="preview-allow" placeholder="Bắt buộc nhập...">
            </div>
            <div class="field"><label>Người thu tiền *</label><input id="sirc-collector" maxlength="30" class="preview-allow" value="${escapeHtml((state.identity&&state.identity.name)||'')}"></div>
            ${receiptCategoryFieldHtml('payment','sirc', selectedCategoryId)}
            <div id="sirc-advinfo"></div>
          </div>
          <div class="modal-foot" style="justify-content:flex-end; gap:8px;">
            ${sendPaymentLinkBtnHtml('sirc')}
            <button class="btn btn-primary preview-allow" id="sirc-confirm">Xác nhận đóng lãi thành công</button>
          </div>
        </div>`;
      wrap.querySelector('#sirc-close').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const leftoverInfoBtn = wrap.querySelector('#sirc-leftover-info');
      const leftoverTip = wrap.querySelector('#sirc-leftover-tip');
      if(leftoverInfoBtn) leftoverInfoBtn.onclick = (e)=>{ e.stopPropagation(); leftoverTip.style.display = leftoverTip.style.display==='none'?'block':'none'; };
      const totalInfoBtn = wrap.querySelector('#sirc-total-info');
      const totalTip = wrap.querySelector('#sirc-total-tip');
      if(totalInfoBtn) totalInfoBtn.onclick = (e)=>{ e.stopPropagation(); totalTip.style.display = totalTip.style.display==='none'?'block':'none'; };
      if(!wrap._tipCloserBound){
        wrap._tipCloserBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap)) return;
          const lt = wrap.querySelector('#sirc-leftover-tip'); const tt = wrap.querySelector('#sirc-total-tip');
          if(lt && lt.style.display!=='none' && !e.target.closest('#sirc-leftover-info') && !e.target.closest('#sirc-leftover-tip')) lt.style.display='none';
          if(tt && tt.style.display!=='none' && !e.target.closest('#sirc-total-info') && !e.target.closest('#sirc-total-tip')) tt.style.display='none';
        });
      }
      wireReceiptCategoryField(wrap, 'payment', 'sirc', render, (id)=>{ selectedCategoryId = id; });
      const advEl = wrap.querySelector('#sirc-advinfo');
      if(advEl) advEl.innerHTML = `
        <div style="text-align:center; margin-top:14px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" id="sirc-adv-toggle">Thông tin nâng cao</button></div>
        <div id="sirc-adv-body" style="display:${advInfoOpen?'block':'none'}; margin-top:8px;">
          <p class="sub" style="margin:0 0 6px;">Phương án vay: ${escapeHtml(projName)}</p>
          ${groupList.map(b=>`<p class="sub" style="margin:0 0 4px;">${escapeHtml(b.name)} — số tiền vay gốc ${moneySpaced(b.principal)}, lãi suất ${String(parseFloat(b.rate)||0).replace('.',',')}%/năm</p>`).join('')}
          ${chosenQuarters.map(q=>`<p class="sub" style="margin:0 0 4px;">${escapeHtml(q.name)} tính từ ngày ${fmtDate(q.from)} đến ngày ${fmtDate(q.to)}</p>`).join('')}
        </div>`;
      const advBtn = wrap.querySelector('#sirc-adv-toggle');
      if(advBtn) advBtn.onclick = ()=>{ advInfoOpen = !advInfoOpen; render(); };
      wireSendPaymentLinkBtn(wrap, 'sirc', ()=>{
        const payerName = (wrap.querySelector('#sirc-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#sirc-collector').value||'').trim();
        const perBorrower = groupList.map(b=>{
          const leftover = leftoverPerBorrower.find(x=>x.b.id===b.id).leftover;
          const amount = chosenQuarters.reduce((s,q)=>s+q.amount,0) - leftover;
          return { borrowerId:b.id, borrowerName:b.name, amount, leftover };
        });
        return { title:'BL chung: Đóng tiền lãi cho các hộ trong phương án vay '+projName, amount: grandTotal,
          borrowerNames: groupList.map(b=>b.name), borrowerIds: groupList.map(b=>b.id), contentEl: wrap.querySelector('.modal-body'),
          replay: { applyFn:'shared_interest', projName, perBorrower, chosenQuarters, quarterTotal, leftoverTotal, grandTotal, payerName, collectorName, categoryLabelId: selectedCategoryId||null } };
      }, async ()=>{
        for(const b of groupList){
          if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen[b.id]))) return false;
        }
        for(const b of groupList){
          if(!(await assertNoUnpaidReceiptLock(b.id, b.name))) return false;
        }
        return true;
      });
      const confirmBtn = wrap.querySelector('#sirc-confirm');
      wireConfirmBtnBehavior(wrap, confirmBtn, openedAt);
      confirmBtn.onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
        const payerName = (wrap.querySelector('#sirc-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#sirc-collector').value||'').trim();
        if(!payerName){ alert('Vui lòng điền "Người đóng tiền" trước khi xác nhận.'); return; }
        if(!collectorName){ alert('Vui lòng điền "Người thu tiền" trước khi xác nhận.'); return; }
        if(!confirm(`Đồng chí có CHẮC CHẮN muốn xác nhận đóng lãi CHUNG cho ${groupList.length} hộ vay trong phương án "${projName}" không?`)) return;
        for(const b of groupList){
          if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen[b.id]))) return;
        }
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        for(const b of groupList){
          const dispBefore = computeInterestPaymentBoxDisplay(b);
          const raw = getInterestPaymentBoxRaw(b.id);
          const perBorrowerLeftover = leftoverPerBorrower.find(x=>x.b.id===b.id).leftover;
          const perBorrowerAmount = chosenQuarters.reduce((s,q)=>s+q.amount,0) - perBorrowerLeftover;
          const newTotalPaid = (raw.totalPaid||0) + perBorrowerAmount;
          await cSet('interestPaymentBoxes/'+b.id, { totalPaid: newTotalPaid, payments: raw.payments||{} });
          state.interestPaymentBoxes = state.interestPaymentBoxes||{};
          state.interestPaymentBoxes[b.id] = { totalPaid:newTotalPaid, payments: raw.payments||{} };
          const dispAfter = computeInterestPaymentBoxDisplay(b);
          await logQuarterStatusDiff(b, dispBefore, dispAfter,
            `Đã được đóng lãi thành công bởi Biên lai chung Đóng tiền lãi cho các hộ trong Phương án vay "${projName}" lập ngày ${fmtDate(todayStr())}`,
            `Đã trở về trạng thái chưa đóng lãi do thay đổi thông tin liên quan tới khoản vay`);
        }
        const detailLines = [
          `Biên lai chung Đóng tiền lãi cho các hộ trong Phương án vay "${projName}" đã được lập vào ngày ${fmtDate(todayStr())}.`,
          `Tổng ${groupList.length} hộ vay: ${namesStr}`,
          ...chosenQuarters.map(q=> `${q.name} (${moneySpaced(q.amount)} x ${groupList.length} hộ) = ${moneySpaced(q.amount*groupList.length)}`),
          `Tổng tiền các quý = ${moneySpaced(quarterTotal)}`,
          (leftoverTotal<=0)
            ? `Các hộ này không có hộ nào có tiền dư từ đợt trước`
            : [...leftoverPerBorrower.map(x=> `Tiền dư đợt trước ${x.b.name}: - ${moneySpaced(x.leftover)}`), `Tổng tiền dư đợt trước của ${groupList.length} hộ = - ${moneySpaced(leftoverTotal)}`].join('\n'),
          `Tổng tất cả (số tiền thực nhận) = ${moneySpaced(grandTotal)}`,
          // Dòng chi tiết THEO TỪNG HỘ — mỗi hộ đóng đúng bằng tổng các Quý đã chọn (giống nhau cho mọi
          // hộ, vì cùng chọn chung 1 bộ Quý) trừ đi phần tiền dư của riêng hộ đó. Cần thiết cho tính
          // năng "Xem Biên lai đã tác động vào Tiền đã đóng lãi" tách đúng phần của từng hộ sau này.
          ...groupList.map(b=>{
            const perHouseholdQuarterSum = chosenQuarters.reduce((s,q)=>s+q.amount,0);
            const lb = leftoverPerBorrower.find(x=>x.b.id===b.id);
            const amt = perHouseholdQuarterSum - (lb? lb.leftover : 0);
            return `Tiền lãi đóng kèm theo ${b.name}: ${moneySpaced(amt)}`;
          }),
          ...chosenQuarters.map(q=> `${q.name} tính từ ngày ${fmtDate(q.from)} đến ngày ${fmtDate(q.to)}`),
          `Người đóng tiền: ${payerName}`,
          `Người thu tiền: ${collectorName}`,
          `--- Thông tin nâng cao ---`,
          `Phương án vay: ${projName}`,
          ...groupList.map(b=> `${b.name} — số tiền vay gốc ${moneySpaced(b.principal)}, lãi suất ${String(parseFloat(b.rate)||0).replace('.',',')}%/năm`),
          ...chosenQuarters.map(q=> `${q.name} tính từ ngày ${fmtDate(q.from)} đến ngày ${fmtDate(q.to)}`),
        ];
        await pushSharedReceiptRecord('shared_interest_payment', `BL chung: Đóng tiền lãi cho các hộ trong phương án vay ${projName}`,
          detailLines.join('\n'), grandTotal, '+', groupList.map(b=>b.id), selectedCategoryId||null);
        await pushLog('xác nhận', `đóng lãi chung cho ${groupList.length} hộ vay trong phương án ${projName}`);
        hideProcessingToast(); // Bước 4
        showBigToast(`Đã phê duyệt thành công: đóng lãi chung cho ${groupList.length} hộ vay (${groupDigitsRight(String(Math.round(grandTotal)),3)}đ)`);
      };
    }
    render();
  }
  function renderSharedFinalSettlementModal(projectId, groupList){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const openedAt = Date.now();
    const close = ()=> wrap.remove();
    const snapshotTotalPaidAtOpen = {}; groupList.forEach(b=>{ snapshotTotalPaidAtOpen[b.id] = getInterestPaymentBoxRaw(b.id).totalPaid; });
    const proj = state.loanProjects.find(p=>p.id===projectId);
    const projName = proj? proj.name : '';
    const rows = groupList.map(b=>{
      const disp = computeInterestPaymentBoxDisplay(b);
      return { b, principal: parseFloat(b.principal)||0, principalChecked:true, interestAmt: disp.unpaidTotal, interestChecked:true };
    });
    let advInfoOpen = false;
    function totals(){
      const checkedPrincipalRows = rows.filter(r=>r.principalChecked);
      const checkedInterestRows = rows.filter(r=>r.interestChecked);
      const totalPrincipal = checkedPrincipalRows.reduce((s,r)=> s + r.principal, 0);
      const totalInterest = checkedInterestRows.reduce((s,r)=> s + r.interestAmt, 0);
      return { totalPrincipal, totalInterest, grandTotal: totalPrincipal+totalInterest, principalCount: checkedPrincipalRows.length, interestCount: checkedInterestRows.length };
    }
    function checklistHtml(kind){
      return rows.map((r,i)=>{
        const checked = kind==='principal'? r.principalChecked : r.interestChecked;
        const amt = kind==='principal'? r.principal : r.interestAmt;
        const label = kind==='principal'? `tiền vay gốc ${escapeHtml(r.b.name)}` : escapeHtml(r.b.name);
        const style = checked? '' : 'color:#9e9e9e; text-decoration:line-through;';
        const disabled = kind==='interest' && !r.principalChecked;
        return `<div class="kv-row"><span style="display:flex; align-items:center; gap:6px; ${style}"><input type="checkbox" class="preview-allow srp-chk" data-kind="${kind}" data-idx="${i}" ${checked?'checked':''} ${disabled?'disabled':''}> ${label}</span><b style="${style}">${moneySpaced(amt)}</b></div>`;
      }).join('');
    }
    function render(){
      const { totalPrincipal, totalInterest, grandTotal, principalCount, interestCount } = totals();
      const allSameLoanDate = groupList.every(b=>b.loanDate===groupList[0].loanDate);
      const allSameHamlet = groupList.every(b=>b.hamlet===groupList[0].hamlet);
      const allSameDue = groupList.every(b=>b.dueDate===groupList[0].dueDate);
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:680px;">
          <div class="modal-head receipt-head-payment"><h3>BIÊN LAI CHUNG: TẤT TOÁN KHOẢN VAY CHO CÁC HỘ TRONG PHƯƠNG ÁN VAY ${escapeHtml(projName).toUpperCase()}</h3><button class="modal-close preview-allow" id="srp-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
            <div class="divider-lbl">Tiền vay gốc từng hộ</div>
            ${checklistHtml('principal')}
            <div class="kv-row" style="border-top:1px solid var(--line); padding-top:6px;"><span>Tổng tiền vay gốc ${principalCount} hộ vay</span><b>= ${moneySpaced(totalPrincipal)}</b></div>
            <div class="divider-lbl" style="margin-top:14px;">Tiền lãi chưa đóng (tính đến QUÝ hiện tại) của các hộ như sau</div>
            ${totalInterest<=0 && rows.every(r=>r.interestAmt<=0)? `<p class="sub">Các hộ trên đều không có Lãi tồn chưa đóng</p>` : `
            ${checklistHtml('interest')}
            <div class="kv-row" style="border-top:1px solid var(--line); padding-top:6px;"><span>Tổng tiền lãi chưa đóng của ${interestCount} hộ vay</span><b>= ${moneySpaced(totalInterest)}</b></div>`}
            <div class="kv-row big-money-row" style="border-top:2px solid var(--line); margin-top:10px; padding-top:8px;"><span>Số tiền thực tế nhận được</span><b>= ${moneySpaced(grandTotal)}</b></div>
            <div class="field" style="margin-top:14px;"><label>Người trả nợ</label><input id="srp-payer" maxlength="30" class="preview-allow" value=""></div>
            <div class="field"><label>Người nhận tiền</label><input id="srp-collector" maxlength="30" class="preview-allow" value="${escapeHtml((state.identity&&state.identity.name)||'')}"></div>
            <div style="text-align:center; margin-top:14px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" id="srp-adv-toggle">Thông tin nâng cao</button></div>
            <div id="srp-adv-info" style="display:${advInfoOpen?'block':'none'}; margin-top:8px;">
              <p class="sub" style="margin:0 0 6px;">Phương án vay: ${escapeHtml(projName)}</p>
              <p class="sub" style="margin:0 0 4px;">Địa chỉ: ${allSameHamlet? escapeHtml(groupList[0].hamlet||'') : rows.map(r=>`${escapeHtml(r.b.name)}: ${escapeHtml(r.b.hamlet||'')}`).join('; ')}</p>
              <p class="sub" style="margin:0 0 4px;">Ngày vay chung: ${allSameLoanDate? fmtDate(groupList[0].loanDate) : rows.map(r=>`${escapeHtml(r.b.name)}${r.b.isHeir?' (người thừa kế)':''}: ${fmtDate(r.b.loanDate)}`).join('; ')}</p>
              <p class="sub" style="margin:0 0 4px;">Ngày đến hạn: ${allSameDue? fmtDate(groupList[0].dueDate) : rows.map(r=>`${escapeHtml(r.b.name)}: ${fmtDate(r.b.dueDate)}`).join('; ')}</p>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="srp-back">Quay lại (không phê duyệt)</button>
            <div style="display:flex; gap:8px; margin-left:auto;">
              ${sendPaymentLinkBtnHtml('srp')}
              <button class="btn btn-primary preview-allow" id="srp-confirm">Xác nhận tất toán khoản vay thành công</button>
            </div>
          </div>
        </div>`;
      wrap.querySelector('#srp-close').onclick = close;
      wrap.querySelector('#srp-back').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('.srp-chk').forEach(cb=>{
        cb.onclick = (e)=>{
          e.stopPropagation();
          const i = parseInt(cb.dataset.idx,10);
          if(cb.dataset.kind==='principal'){
            // Biên lai chung không thể chỉ còn 1 người hoặc 0 người — chặn bỏ chọn khi chỉ còn đúng 2
            // người đang được chọn.
            if(!cb.checked && rows.filter(r=>r.principalChecked).length<=2){
              alert('Biên lai chung không thể chỉ còn 1 người hoặc 0 người — phải giữ lại ít nhất 2 hộ vay được chọn ở khung tiền vay gốc.');
              cb.checked = true;
              return;
            }
            rows[i].principalChecked = cb.checked;
            // Bỏ chọn tiền vay gốc -> tự động bỏ chọn luôn tiền lãi chưa đóng của ĐÚNG người đó (chỉ
            // được chọn lại khi tiền vay gốc của người đó được chọn lại).
            if(!cb.checked) rows[i].interestChecked = false;
          } else {
            rows[i].interestChecked = cb.checked;
          }
          render();
        };
      });
      const advBtn = wrap.querySelector('#srp-adv-toggle');
      advBtn.onclick = ()=>{ advInfoOpen = !advInfoOpen; render(); };
      wireSendPaymentLinkBtn(wrap, 'srp', ()=>{
        const { grandTotal } = totals();
        const checkedRows = rows.filter(r=>r.principalChecked);
        const payerName = (wrap.querySelector('#srp-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#srp-collector').value||'').trim();
        return { title:'BL chung: Tất toán khoản vay cho các hộ trong phương án vay '+projName, amount: grandTotal,
          borrowerNames: checkedRows.map(r=>r.b.name), borrowerIds: checkedRows.map(r=>r.b.id), contentEl: wrap.querySelector('.modal-body'),
          replay: { applyFn:'shared_settlement', projName, grandTotal, payerName, collectorName,
            rows: rows.map(r=>({ borrowerId:r.b.id, principal:r.principal, principalChecked:r.principalChecked, interestAmt:r.interestAmt, interestChecked:r.interestChecked })) } };
      }, async ()=>{
        const { totalPrincipal } = totals();
        if(totalPrincipal<=0){ alert('Tổng tiền vay gốc phải lớn hơn 0 mới được gửi đường link thanh toán. Vui lòng tích chọn ít nhất 1 hộ vay có tiền gốc.'); return false; }
        for(const r of rows){
          if(!r.principalChecked || !r.interestChecked || r.interestAmt<=0) continue;
          if(!(await assertInterestBoxStillFresh(r.b, snapshotTotalPaidAtOpen[r.b.id]))) return false;
        }
        for(const r of rows.filter(r=>r.principalChecked)){
          if(!(await assertNoUnpaidReceiptLock(r.b.id, r.b.name))) return false;
        }
        return true;
      });
      const confirmBtn = wrap.querySelector('#srp-confirm');
      wireConfirmBtnBehavior(wrap, confirmBtn, openedAt);
      confirmBtn.onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
        const { totalPrincipal, totalInterest, grandTotal, principalCount, interestCount } = totals();
        if(totalPrincipal<=0){ alert('Tổng tiền vay gốc phải lớn hơn 0 mới được lập biên lai này. Vui lòng tích chọn ít nhất 1 hộ vay có tiền gốc.'); return; }
        const payerName = (wrap.querySelector('#srp-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#srp-collector').value||'').trim();
        if(!payerName || !collectorName){ alert('Vui lòng điền đầy đủ "Người trả nợ" và "Người nhận tiền" trước khi xác nhận.'); return; }
        if(!confirm(`Đồng chí có CHẮC CHẮN muốn xác nhận tất toán khoản vay CHUNG cho ${principalCount} hộ vay trong phương án "${projName}" không?`)) return;
        for(const r of rows){
          if(!r.principalChecked || !r.interestChecked || r.interestAmt<=0) continue;
          if(!(await assertInterestBoxStillFresh(r.b, snapshotTotalPaidAtOpen[r.b.id]))) return;
        }
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        const settledIds = [];
        for(const r of rows){
          if(!r.principalChecked) continue;
          if(r.interestChecked && r.interestAmt>0) await settleInterestForClosure(r.b, false);
          await markBorrowerSettled(r.b, 'final', { settledReason:'Tất toán khoản vay chung theo Phương án vay', heirName:'',
            settledInterestIncluded: r.interestChecked? r.interestAmt : 0, settledUpToToday:false,
            settledGrandTotal: r.principal + (r.interestChecked? r.interestAmt : 0), settledMode:'province',
            settledSnapshot: buildSettlementSnapshot(r.b, r.interestChecked? { lines: computeInterestPaymentBoxDisplay(r.b).unpaidLines, total: r.interestAmt } : null, false, null) });
          settledIds.push(r.b.id);
        }
        const allSameLoanDate = groupList.every(b=>b.loanDate===groupList[0].loanDate);
        const allSameHamlet = groupList.every(b=>b.hamlet===groupList[0].hamlet);
        const allSameDue = groupList.every(b=>b.dueDate===groupList[0].dueDate);
        const detailLines = [
          `Biên lai chung Tất toán khoản vay cho các hộ trong Phương án vay "${projName}" đã được lập vào ngày ${fmtDate(todayStr())}.`,
          ...rows.filter(r=>r.principalChecked).map(r=> `Tiền vay gốc ${r.b.name}: ${moneySpaced(r.principal)}`),
          `Tổng tiền vay gốc ${principalCount} hộ vay = ${moneySpaced(totalPrincipal)}`,
          (totalInterest<=0 && rows.every(r=>r.interestAmt<=0))
            ? `Các hộ trên đều không có Lãi tồn chưa đóng`
            : [...rows.filter(r=>r.interestChecked).map(r=> `Tiền lãi đóng kèm theo ${r.b.name}: ${moneySpaced(r.interestAmt)}`), `Tổng tiền lãi đóng kèm theo của ${interestCount} hộ vay = ${moneySpaced(totalInterest)}`].join('\n'),
          `Số tiền thực tế nhận được = ${moneySpaced(grandTotal)}`,
          `Người trả nợ: ${payerName}`,
          `Người nhận tiền: ${collectorName}`,
          `--- Thông tin nâng cao ---`,
          `Phương án vay: ${projName}`,
          `Địa chỉ: ${allSameHamlet? (groupList[0].hamlet||'') : rows.map(r=>`${r.b.name}: ${r.b.hamlet||''}`).join('; ')}`,
          `Ngày vay chung: ${allSameLoanDate? fmtDate(groupList[0].loanDate) : rows.map(r=>`${r.b.name}${r.b.isHeir?' (người thừa kế)':''}: ${fmtDate(r.b.loanDate)}`).join('; ')}`,
          `Ngày đến hạn: ${allSameDue? fmtDate(groupList[0].dueDate) : rows.map(r=>`${r.b.name}: ${fmtDate(r.b.dueDate)}`).join('; ')}`,
        ];
        await pushSharedReceiptRecord('shared_final_settlement', `BL chung: Tất toán khoản vay cho các hộ trong phương án vay ${projName}`,
          detailLines.join('\n'), grandTotal, '+', settledIds);
        await pushLog('xác nhận', `tất toán khoản vay chung cho ${settledIds.length} hộ vay trong phương án ${projName}`);
        hideProcessingToast(); // Bước 4
        showBigToast(`Đã phê duyệt thành công: tất toán khoản vay chung cho ${settledIds.length} hộ vay (${groupDigitsRight(String(Math.round(grandTotal)),3)}đ)`);
      };
    }
    render();
  }
  function renderEarlyRepaymentModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const openedAt = Date.now();
    const close = ()=> wrap.remove();
    const snapshotTotalPaidAtOpen = getInterestPaymentBoxRaw(b.id).totalPaid;
    const goBack = ()=>{ close(); renderSettlementModal(); };
    const exts = getBorrowerExtensions(b.id);
    const dueRef = exts.length? exts[exts.length-1].to : b.dueDate;
    const dLeft = daysRemainingUntil(dueRef);
    const canChooseProvince = dLeft==null || dLeft>=90; // phải còn >=90 ngày mới cho "trả lại cấp Tỉnh/TW"
    // Nguồn vay "Nguồn địa phương"/"Nguồn khác" thì đổi tên lựa chọn thành "Trả lại cho cấp quản lý
    // vốn vay" (chỉ đổi chữ hiển thị, logic bên trong hoàn toàn không đổi).
    const fundSourceLower = (b.fundSource||'').toLowerCase();
    const isLocalOrOtherFund = fundSourceLower.includes('địa phương') || fundSourceLower.includes('khác');
    const provinceModeLabel = isLocalOrOtherFund ? 'Trả lại cho cấp quản lý vốn vay' : `Trả lại cấp ${provinceLevelLabel()} hoặc Trung ương`;
    let mode = canChooseProvince ? 'province' : 'heir'; // mặc định đúng theo điều kiện
    let includeInterest = true;
    let heir = null;
    let advOpen = false;

    function render(){
      const principal = parseFloat(b.principal)||0;
      const upToToday = mode==='heir';
      const interestInfo = (mode && includeInterest) ? (upToToday? borrowerUnpaidInterestUpToToday(b) : (()=>{ const d=computeInterestPaymentBoxDisplay(b); return { lines:d.unpaidLines, total:d.unpaidTotal }; })()) : { lines:[], total:0 };
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head" style="background:#0d3b78;"><h3 style="color:#fff;">BIÊN LAI TRẢ NỢ TRƯỚC HẠN CỦA HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="erm-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
            <div class="kv-row"><span>Tổng tiền vay gốc</span><b>${moneySpaced(principal)}</b></div>
            <div style="margin-top:12px; display:flex; flex-direction:column; gap:6px;">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input type="radio" name="erm-mode" id="erm-mode-province" ${mode==='province'?'checked':''}> <span>${provinceModeLabel}</span></label>
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input type="radio" name="erm-mode" id="erm-mode-heir" ${mode==='heir'?'checked':''}> <span>Chọn người thừa kế</span></label>
            </div>
            ${mode==='province'? `
            <div style="margin-top:10px; display:flex; align-items:center; gap:4px;">
              <button type="button" class="btn btn-sm preview-allow" id="erm-interest-toggle" style="${includeInterest? 'background:#fb8c00; color:#fff;' : 'background:#1976d2; color:#fff;'}">${includeInterest? 'Tắt bổ sung: Tiền lãi chưa đóng (Tính đến QUÝ hiện tại)' : 'Bổ sung: Tiền lãi chưa đóng (Tính đến QUÝ hiện tại)'}</button>
            </div>` : ''}
            ${mode==='heir'? `
            <div style="margin-top:10px;">
              ${heir? `<button type="button" class="btn btn-ghost preview-allow" id="erm-heir-edit" style="text-decoration:underline;">${escapeHtml(heir.name)}</button>`
                    : `<button type="button" class="btn btn-ghost preview-allow" id="erm-heir-add">+ Thêm người thừa kế</button>`}
            </div>
            ${heir? `<div style="margin-top:10px; display:flex; align-items:center; gap:4px;">
              <button type="button" class="btn btn-sm preview-allow" id="erm-interest-toggle" style="${includeInterest? 'background:#fb8c00; color:#fff;' : 'background:#1976d2; color:#fff;'}">${includeInterest? 'Tắt bổ sung: Tiền lãi chưa đóng (Tính đến Ngày hiện tại)' : 'Bổ sung: Tiền lãi chưa đóng (Tính đến Ngày hiện tại)'}</button>
            </div>` : ''}` : ''}
            ${(mode && includeInterest)? `<div class="kv-row" style="margin-top:6px;"><span>Tiền lãi chưa đóng (${upToToday?'tính đến Ngày hiện tại':'tính đến QUÝ hiện tại'})</span><b>${moneySpaced(interestInfo.total)}</b></div>` : ''}
            ${mode? `<div class="kv-row big-money-row" style="border-top:1px solid var(--line); margin-top:10px; padding-top:6px;"><span>Số tiền thực tế nhận được</span><b>= ${moneySpaced(principal+interestInfo.total)}</b></div>` : ''}
            <div class="field" style="margin-top:14px;"><label>Lý do trả nợ trước hạn</label><textarea id="erm-reason" maxlength="200" rows="2" class="preview-allow" placeholder="Nhập lý do (bắt buộc, tối đa 200 ký tự)..."></textarea></div>
            ${settlementPayerFieldsHtml(b,'erm')}
            ${settlementAdvancedInfoHtml(b, interestInfo, upToToday, heir, 'erm', advOpen)}
            <p class="sub" id="erm-error" style="color:var(--red); font-weight:700; display:none; margin-top:6px;"></p>
          </div>
          <div class="modal-foot" style="justify-content:space-between;">
            <button class="btn btn-ghost preview-allow" id="erm-back">Quay lại (không lưu)</button>
            <div style="display:flex; gap:8px;">
              ${sendPaymentLinkBtnHtml('erm')}
              <button class="btn btn-primary preview-allow" id="erm-confirm">Xác nhận trả nợ trước hạn thành công</button>
            </div>
          </div>
        </div>`;
      wrap.querySelector('#erm-close').onclick = close;
      wrap.querySelector('#erm-back').onclick = goBack;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelector('#erm-mode-province').onclick = ()=>{
        if(!canChooseProvince){
          alert(`Chỉ được chọn "${provinceModeLabel}" khi ngày hiện tại còn cách "Ngày đến hạn" (hoặc "Ngày gia hạn gần nhất") ít nhất 90 ngày trở lên. Hộ vay này hiện chỉ còn ${dLeft==null?'—':dLeft} ngày, vui lòng chọn "Chọn người thừa kế".`);
          render(); // vẽ lại để radio quay về đúng lựa chọn hiện tại (không cho tích chọn)
          return;
        }
        mode='province'; includeInterest=true; render();
      };
      wrap.querySelector('#erm-mode-heir').onclick = ()=>{ mode='heir'; includeInterest=true; render(); };
      const interestToggle = wrap.querySelector('#erm-interest-toggle');
      if(interestToggle) interestToggle.onclick = ()=>{ includeInterest = !includeInterest; render(); };
      const heirAddBtn = wrap.querySelector('#erm-heir-add');
      if(heirAddBtn) heirAddBtn.onclick = ()=> openHeirEditor(b, heir, (newHeir)=>{ heir = newHeir; render(); });
      const heirEditBtn = wrap.querySelector('#erm-heir-edit');
      if(heirEditBtn) heirEditBtn.onclick = ()=> openHeirEditor(b, heir, (newHeir)=>{ heir = newHeir; render(); });
      wireAdvancedInfo(wrap, 'erm', (open)=>{ advOpen = open; });
      wireConfirmBtnBehavior(wrap, wrap.querySelector('#erm-confirm'), openedAt);
      wireSendPaymentLinkBtn(wrap, 'erm', ()=>{
        const reason = (wrap.querySelector('#erm-reason').value||'').trim();
        const payerName = (wrap.querySelector('#erm-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#erm-collector').value||'').trim();
        return { title:'BL Trả nợ trước hạn', amount: principal + (includeInterest? interestInfo.total : 0), borrowerNames:[b.name], borrowerIds:[b.id], contentEl: wrap.querySelector('.modal-body'),
          replay: { applyFn:'early_repayment', borrowerId:b.id, mode, heir: heir? {...heir} : null, reason, includeInterest, upToToday: mode==='heir', principal, isLocalOrOtherFund, payerName, collectorName } };
      }, async ()=>{
        if(!mode){ alert(`Vui lòng chọn "${provinceModeLabel}" hoặc "Chọn người thừa kế" trước khi gửi đường link thanh toán.`); return false; }
        if(mode==='heir' && !heir){ alert('Vui lòng thêm thông tin người thừa kế trước khi gửi đường link thanh toán.'); return false; }
        const reason = (wrap.querySelector('#erm-reason').value||'').trim();
        if(!reason){ alert('Vui lòng điền "Lý do trả nợ trước hạn" trước khi gửi đường link thanh toán.'); return false; }
        if(includeInterest && interestInfo.total>0){
          if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return false;
        }
        return true;
      });
      wrap.querySelector('#erm-confirm').onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
        if(!mode){ alert(`Vui lòng chọn "${provinceModeLabel}" hoặc "Chọn người thừa kế".`); return; }
        if(mode==='heir' && !heir){ alert('Vui lòng thêm thông tin người thừa kế trước khi xác nhận.'); return; }
        const reason = (wrap.querySelector('#erm-reason').value||'').trim();
        if(!reason){ alert('Vui lòng điền "Lý do trả nợ trước hạn" trước khi xác nhận.'); return; }
        const payerName = (wrap.querySelector('#erm-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#erm-collector').value||'').trim();
        if(!payerName || !collectorName){ alert('Vui lòng điền đầy đủ "Người trả nợ" và "Người nhận tiền" trước khi xác nhận.'); return; }
        if(includeInterest && interestInfo.total>0){
          if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return;
        }
        if(!(await assertNoUnpaidReceiptLock(b.id, b.name))) return;
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        if(includeInterest && interestInfo.total>0) await settleInterestForClosure(b, upToToday);
        await markBorrowerSettled(b, 'early', { settledReason: reason, heirName: heir? heir.name : '',
          settledInterestIncluded: (includeInterest? interestInfo.total : 0), settledUpToToday: upToToday,
          settledGrandTotal: principal + (includeInterest? interestInfo.total : 0), settledMode: mode,
          settledSnapshot: buildSettlementSnapshot(b, includeInterest? interestInfo : null, upToToday, mode==='heir'? heir : null) });
        if(mode==='heir' && heir){
          const heirRecord = { ...emptyBorrowerForProject(projectOf(b)), ...heir, id: uid(), projectId: b.projectId, hamlet: heir.hamlet||b.hamlet, isHeir:true, heirOfBorrowerId: b.id, managerId: b.managerId };
          await cSetRecord('borrowers', heirRecord.id, heirRecord);
          // KHÔNG tự push thủ công vào state.borrowers — realtime binding sẽ tự nhận đúng bản ghi mới
          // này ngay lập tức, tự push thêm sẽ gây hiển thị TRÙNG LẶP tạm thời cho tới khi tải lại trang.
        }
        { const catKey = mode==='heir'
            ? (includeInterest? 'early_heir_with_interest' : 'early_heir_no_interest')
            : (includeInterest? 'early_province_with_interest' : 'early_province_no_interest');
          await pushReceiptRecord(b, catKey, {
            amount: principal + (includeInterest? interestInfo.total : 0), sign:'+',
            quarterLines: includeInterest? (interestInfo.lines||[]).map(x=>({ qk:x.box.qk, year:x.box.year, amount:x.amount })) : [],
            extra: { principal, interestIncluded: includeInterest? interestInfo.total : 0, heirName: heir? heir.name : '', payerName, collectorName, mode, isLocalOrOtherFund, reason: reason||'' },
          });
        }
        await pushLog('xác nhận', `trả nợ trước hạn cho hộ vay ${b.name} (gốc ${moneySpaced(principal)}${includeInterest&&interestInfo.total>0?` + lãi ${moneySpaced(interestInfo.total)}`:''})${heir?`, người thừa kế: ${heir.name}`:''}`);
        refreshOpenSettlementModal();
        hideProcessingToast(); // Bước 4
        showBigToast(`Trả nợ trước hạn thành công: hộ vay ${b.name}, tổng số tiền ${groupDigitsRight(String(Math.round(principal+interestInfo.total)),3)}đ`);
      };
    }
    render();
  }
  // Bảng phụ nhỏ nhập thông tin Người thừa kế — cùng cấu trúc trường bắt buộc/không bắt buộc như
  // modal Thêm người vay mới, chỉ khác "Ngày vay" luôn CỐ ĐỊNH = ngày lập biên lai hôm nay.
  // Đảo ngược 1 lần Tất toán/Trả nợ trước hạn đã duyệt NHẦM — trả người vay về đúng trạng thái hoạt
  // động bình thường (xoá frozenAsOf -> hộp chứa Quý tự động hiện lại đầy đủ, không cần tính toán gì
  // thêm). Nếu có người thừa kế: xoá hẳn hồ sơ người đó (CHỈ khi họ CHƯA từng đóng lãi đồng nào).
  async function reverseSettlement(b){
    if(b.heirName){
      const heir = state.borrowers.find(x=>x.isHeir && x.heirOfBorrowerId===b.id);
      if(heir){
        const raw = getInterestPaymentBoxRaw(heir.id);
        if((raw.totalPaid||0) > 0){
          alert(`Không thể khôi phục vì người thừa kế "${heir.name}" đã đóng lãi (${moneySpaced(raw.totalPaid)}). Chỉ khi số tiền đã đóng lãi của người thừa kế trở về đúng 0đ (bằng cách lập biên lai trả lại tiền lãi cho người đó) thì mới được khôi phục lại khoản vay.`);
          return false;
        }
        await cRemoveRecord('borrowers', heir.id);
        state.borrowers = state.borrowers.filter(x=>x.id!==heir.id);
      }
    }
    const updated = { ...b };
    delete updated.settled; delete updated.settledType; delete updated.settledAt;
    delete updated.settledReason; delete updated.heirName; delete updated.frozenAsOf; delete updated.frozenQuarterConfig;
    await cSetRecord('borrowers', b.id, updated);
    const idx = state.borrowers.findIndex(x=>x.id===b.id);
    if(idx>=0) state.borrowers[idx] = updated;
    return true;
  }

  // "Xem lịch sử tất toán" / "Xem lịch sử TNTH" — hiện lại thông tin biên lai gần nhất (dựng lại từ
  // dữ liệu đã lưu trên hồ sơ người vay), có nút "Khôi phục lại khoản vay do phê duyệt nhầm".
  // Tra cứu "phần tiền LÃI riêng của 1 hộ vay" trong 1 Biên lai CHUNG — dựa vào đúng dòng text đã ghi
  // sẵn lúc lập biên lai (nếu có). "Biên lai chung Tất toán" CÓ ghi rõ dòng này cho từng hộ. "Biên lai
  // chung Đóng tiền lãi" KHÔNG ghi chi tiết theo từng hộ (chỉ ghi tổng theo từng Quý) — trường hợp này
  // đành bỏ qua (không đủ dữ liệu để tách chính xác phần của riêng 1 hộ).
  function extractSharedInterestPortionForBorrower(r, borrowerName){
    const details = String(r.details||'');
    const escaped = borrowerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = details.match(new RegExp(`Tiền lãi đóng kèm theo ${escaped}:\\s*([\\d\\s.,]+)`));
    if(!m) return null;
    const num = parseFloat(m[1].replace(/[.\s]/g,'').replace(',','.'));
    return isNaN(num) ? null : num;
  }
  function renderInterestImpactReceiptsModal(b){
    if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xem chi tiết này.'); return; }
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const individualReceipts = (state.borrowerReceipts && state.borrowerReceipts[b.id]) || [];
    const rows = []; // { r, interestPortion, isShared }
    individualReceipts.forEach(link=>{
      if(link.isSharedLink){
        const full = (state.sharedBorrowerReceipts||[]).find(x=>x.id===link.id);
        if(!full) return;
        const portion = extractSharedInterestPortionForBorrower(full, b.name);
        if(portion) rows.push({ r: full, interestPortion: portion, isShared:true });
      } else {
        const portion = extractInterestPortion(link);
        if(portion) rows.push({ r: link, interestPortion: portion, isShared:false });
      }
    });
    rows.sort((a,c)=> (c.r.createdAt||'').localeCompare(a.r.createdAt||''));
    const totalZ = rows.reduce((s,x)=> s + (x.r.sign==='-'? -x.interestPortion : x.interestPortion), 0);
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:640px;">
        <div class="modal-head"><h3>Xem các Biên lai đã tác động vào Tiền đã đóng lãi của hộ vay ${escapeHtml(b.name)}</h3><button class="modal-close preview-allow" id="iirl-close">✕</button></div>
        <div class="modal-body">
          <p class="sub" style="font-weight:700; margin:0 0 12px;">Tổng số <span style="color:#b71c1c; font-weight:800;">${rows.length}</span> Biên lai đã tác động vào số tiền đã đóng lãi, với Tổng tiền cuối cùng<br>là <span style="color:#b71c1c; font-weight:800;">${moneySpaced(totalZ)}</span>.</p>
          ${rows.length? rows.map(x=> interestImpactReceiptRowHtml(x.r, x.interestPortion, x.isShared)).join('') : '<p class="sub" style="text-align:center; padding:20px;">Chưa có Biên lai nào tác động tới tiền đã đóng lãi.</p>'}
        </div>
        <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="iirl-close2">Đóng bảng</button></div>
      </div>`;
    wrap.querySelector('#iirl-close').onclick = close;
    wrap.querySelector('#iirl-close2').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelectorAll('[data-receipt-view]').forEach(el=> el.onclick = ()=>{
      const r = individualReceipts.find(x=>x.id===el.dataset.receiptView);
      if(r) renderReceiptDetailModal(b, r);
    });
    wrap.querySelectorAll('[data-shared-receipt-view]').forEach(el=> el.onclick = ()=>{
      const r = (state.sharedBorrowerReceipts||[]).find(x=>x.id===el.dataset.sharedReceiptView);
      if(r) renderSharedReceiptDetailModal(r);
    });
  }
  function renderSettlementHistoryModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const isFinal = b.settledType==='final';
    const heir = b.heirName ? state.borrowers.find(x=>x.isHeir && x.heirOfBorrowerId===b.id) : null;
    let advOpen = false;

    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head" style="background:#0d3b78;"><h3 style="color:#fff;">${isFinal? 'LỊCH SỬ TẤT TOÁN KHOẢN VAY':'LỊCH SỬ TRẢ NỢ TRƯỚC HẠN'} CỦA HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="shm-close">✕</button></div>
          <div class="modal-body" id="shm-content">
            <div style="text-align:center; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:10px;">
              <button type="button" class="btn preview-allow" style="background:#ffcdd2; color:#b71c1c; font-weight:700;" id="shm-reverse">↩️ Khôi phục lại khoản vay do phê duyệt nhầm</button>
              ${computeInterestPaymentBoxDisplay(b).unpaidTotal>0? `<button type="button" class="ext-action-btn ext-green preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" id="shm-pay-interest">Đóng tiền lãi</button>` : ''}
            </div>
            <p class="sub" style="margin:0 0 10px;">${isFinal?'Đã tất toán':'Đã trả nợ trước hạn'} vào ngày ${fmtDate((b.settledAt||'').slice(0,10))}</p>
            <div class="kv-row"><span>Số tiền vay gốc</span><b>${moneySpaced(b.principal)}</b></div>
            ${b.settledInterestIncluded>0? `<div class="kv-row" style="margin-top:6px;"><span>Tiền lãi đóng kèm theo (${b.settledUpToToday?'tính đến Ngày lập biên lai':'tính đến Quý của ngày lập biên lai'})</span><b>${moneySpaced(b.settledInterestIncluded)}</b></div>` : ''}
            ${b.settledGrandTotal!=null? `<div class="kv-row big-money-row" style="border-top:1px solid var(--line); margin-top:10px; padding-top:6px;"><span>Số tiền thực tế nhận được</span><b>= ${moneySpaced(b.settledGrandTotal)}</b></div>` : ''}
            ${b.settledReason? `<div class="kv-row"><span>Lý do trả nợ trước hạn</span><b>${escapeHtml(b.settledReason)}</b></div>` : ''}
            ${heir? `<div class="kv-row"><span>Người thừa kế</span><b>${escapeHtml(heir.name)}</b></div>
            <div class="kv-row"><span>Địa bàn dân cư (${subAdminLabel()}) của người thừa kế</span><b>${escapeHtml(heir.hamlet||'')}</b></div>
            <div class="kv-row"><span>Người quản lý hộ vay (người thừa kế)</span><b>${escapeHtml((ensureDefaultManagers().find(m=>m.id===(heir.managerId||'chihoitruong'))||{}).name||'')}</b></div>` : (b.heirName? `<div class="kv-row"><span>Người thừa kế</span><b>${escapeHtml(b.heirName)} (đã bị xoá/khôi phục trước đó)</b></div>` : '')}
            ${!isFinal && !b.heirName? `<div class="kv-row"><span>Hình thức</span><b>${((b.fundSource||'').toLowerCase().includes('địa phương')||(b.fundSource||'').toLowerCase().includes('khác'))?'Trả lại cho cấp quản lý vốn vay':`Trả lại cấp ${provinceLevelLabel()} hoặc Trung ương`}</b></div>` : ''}
            ${settlementAdvancedInfoHtml(b, {lines:[],total:0}, false, heir, 'shm', advOpen, b.settledSnapshot)}
          </div>
          <div class="modal-foot">
            ${exportPrintButtonsHtml('shm-ep')}
            <button class="btn btn-ghost preview-allow" id="shm-close2">Đóng bảng</button>
          </div>
        </div>`;
      wrap.querySelector('#shm-close').onclick = close;
      wrap.querySelector('#shm-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wireAdvancedInfo(wrap, 'shm', (open)=>{ advOpen = open; });
      wireExportPrintButtons(wrap, 'shm-ep', '#shm-content', `${isFinal?'Lịch sử tất toán khoản vay':'Lịch sử trả nợ trước hạn'} của hộ vay ${b.name}`);
      { const payBtn = wrap.querySelector('#shm-pay-interest'); if(payBtn) payBtn.onclick = ()=>{ close(); renderInterestPaymentApprovalModal(b, ()=> renderSettlementHistoryModal(b)); }; }
      wrap.querySelector('#shm-reverse').onclick = ()=>{
        if(heir){
          const raw = getInterestPaymentBoxRaw(heir.id);
          if((raw.totalPaid||0) > 0){
            alert(`Không thể khôi phục vì người thừa kế "${heir.name}" đã đóng lãi (${moneySpaced(raw.totalPaid)}). Muốn khôi phục, vui lòng lập biên lai trả lại tiền lãi đã đóng cho người thừa kế này cho tới khi số tiền đã đóng lãi của họ trở về đúng 0đ.`);
            return;
          }
        }
        close();
        renderReversalReceiptModal(b);
      };
    }
    render();
  }

  // "BIÊN LAI TRẢ LẠI SỐ TIỀN ... DO PHÊ DUYỆT NHẦM" — mọi nút đều KHOÁ trừ Thông tin nâng cao, nút
  // xác nhận có hỏi lại 1 lần nữa cho chắc.
  function renderReversalReceiptModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const openedAt = Date.now();
    const close = ()=> wrap.remove();
    const isFinal = b.settledType==='final';
    const title = isFinal
      ? `BIÊN LAI TRẢ LẠI SỐ TIỀN "TẤT TOÁN KHOẢN VAY" DO PHÊ DUYỆT NHẦM ĐỐI VỚI HỘ VAY ${escapeHtml(b.name).toUpperCase()}`
      : `BIÊN LAI TRẢ LẠI SỐ TIỀN "TRẢ NỢ TRƯỚC HẠN" DO PHÊ DUYỆT NHẦM ĐỐI VỚI HỘ VAY ${escapeHtml(b.name).toUpperCase()}`;
    const heir = b.heirName ? state.borrowers.find(x=>x.isHeir && x.heirOfBorrowerId===b.id) : null;
    let advOpen = false;

    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head" style="background:#ffcdd2;"><h3 style="color:#7a1010;">${title}</h3><button class="modal-close preview-allow" id="rrm-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
            <div class="kv-row"><span>Số tiền vay gốc được khôi phục lại</span><b>${moneySpaced(b.principal)}</b></div>
            ${b.settledInterestIncluded>0? `<div class="kv-row" style="margin-top:6px;"><span>Tiền lãi chưa đóng đã được thu trong đợt ${isFinal?'tất toán':'trả nợ trước hạn'} này (${b.settledUpToToday?'tính đến Ngày hiện tại':'tính đến QUÝ hiện tại'})</span><b>${moneySpaced(b.settledInterestIncluded)}</b></div>` : ''}
            ${b.settledGrandTotal!=null? `<div class="kv-row big-money-row" style="border-top:1px solid var(--line); margin-top:10px; padding-top:6px;"><span>Tổng số tiền sẽ được trả lại</span><b>= ${moneySpaced(b.settledGrandTotal)}</b></div>` : ''}
            ${b.settledReason? `<div class="kv-row"><span>Lý do trả nợ trước hạn (lúc trước)</span><b>${escapeHtml(b.settledReason)}</b></div>` : ''}
            <p class="sub" style="margin-top:6px;">Toàn bộ khoản vay của hộ vay này sẽ được khôi phục lại đúng trạng thái ĐANG HOẠT ĐỘNG bình thường như trước khi ${isFinal?'tất toán':'trả nợ trước hạn'}${heir? `, người thừa kế "${escapeHtml(heir.name)}" sẽ bị xoá khỏi hệ thống hoàn toàn` : ''}.</p>
            <button type="button" class="btn btn-ghost" disabled style="margin-top:10px; opacity:.5;">(Các thao tác khác đã bị khoá ở biên lai này)</button>
            ${settlementAdvancedInfoHtml(b, {lines:[],total:0}, false, heir, 'rrm', advOpen)}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="rrm-cancel">Đóng (không lưu)</button>
            <button class="btn btn-primary preview-allow" id="rrm-confirm">Xác nhận trả lại số tiền</button>
          </div>
        </div>`;
      wrap.querySelector('#rrm-close').onclick = close;
      wrap.querySelector('#rrm-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wireAdvancedInfo(wrap, 'rrm', (open)=>{ advOpen = open; });
      wireConfirmBtnBehavior(wrap, wrap.querySelector('#rrm-confirm'), openedAt);
      wrap.querySelector('#rrm-confirm').onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
        if(!confirm('Đồng chí có CHẮC CHẮN muốn trả lại số tiền và khôi phục khoản vay này không? Hành động này sẽ đưa hộ vay quay lại danh sách đang hoạt động.')) return;
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        const ok = await reverseSettlement(b);
        if(!ok){ hideProcessingToast(); return; }
        await pushReceiptRecord(b, isFinal? 'reversal_settlement' : 'reversal_early', {
          amount: b.settledGrandTotal!=null? b.settledGrandTotal : b.principal, sign:'-',
          extra: { principal:b.principal, interestIncluded:b.settledInterestIncluded||0 },
        });
        await pushLog('xác nhận', `trả lại số tiền "${isFinal?'Tất toán khoản vay':'Trả nợ trước hạn'}" do phê duyệt nhầm đối với hộ vay ${b.name}`);
        refreshOpenSettlementModal();
        hideProcessingToast(); // Bước 4
        showBigToast(`Khôi phục thành công: hộ vay ${b.name} đã quay lại danh sách khoản vay đang hoạt động`);
      };
    }
    render();
  }

  function openHeirEditor(originalBorrower, current, onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const h = current ? {...current} : { name:'', birthYear:'', cccd:'', phone:'', address:'', industry:'', repayAbility:'', guarantor:'', note:'',
      principal: originalBorrower.principal, hamlet: originalBorrower.hamlet, preMergerAddress:'',
      loanDate: todayStr(), dueDate: originalBorrower.dueDate, rate: originalBorrower.rate, fundSource: originalBorrower.fundSource,
      splitCentral: originalBorrower.splitCentral, splitProvince: originalBorrower.splitProvince, splitWard: originalBorrower.splitWard,
      hamletAllocPercent: originalBorrower.hamletAllocPercent };
    const hamlets = state.config.hamlets||[];
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:640px;">
        <div class="modal-head"><h3>Thông tin người thừa kế</h3><button class="modal-close" id="hem-close">✕</button></div>
        <div class="modal-body">
          <p class="sub" style="margin:0 0 10px;">Ngày bắt đầu kế thừa khoản vay luôn là ngày lập biên lai hôm nay (${fmtDate(todayStr())}), và các điều khoản chung (lãi suất, ngày đến hạn, nguồn vay, số tiền vay...) luôn kế thừa đúng từ hộ vay ban đầu — không đổi được ở đây.</p>
          <div class="divider-lbl">📌 Thông tin bắt buộc</div>
          <div class="form-grid">
            <div class="field"><label>Họ và tên *</label><input id="hem-name" value="${escapeHtml(h.name)}"></div>
            <div class="field"><label>Địa bàn dân cư (${subAdminLabel()}) *</label>
              <select id="hem-hamlet">${hamlets.map(x=>`<option value="${escapeHtml(x)}" ${h.hamlet===x?'selected':''}>${escapeHtml(x)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Số tiền vay kế thừa (đ) *</label><input value="${moneySpaced(h.principal||0)}" disabled></div>
            <div class="field"><label>Người quản lý hộ vay</label><select id="hem-manager">
              ${ensureDefaultManagers().map(m=>`<option value="${m.id}" ${(h.managerId||originalBorrower.managerId||'chihoitruong')===m.id?'selected':''}>${escapeHtml(m.name)}</option>`).join('')}
            </select></div>
          </div>
          <div class="divider-lbl">Điều khoản vay (kế thừa từ hộ vay ban đầu — không sửa được)</div>
          <div class="form-grid">
            <div class="field"><label>Lãi suất (%/năm)</label><input value="${h.rate}%/năm" disabled></div>
            <div class="field"><label>Ngày vay</label><input value="${fmtDate(h.loanDate)}" disabled></div>
            <div class="field"><label>Ngày đến hạn</label><input value="${fmtDate(h.dueDate)}" disabled></div>
            <div class="field"><label>Nguồn vay</label><input value="${escapeHtml(h.fundSource||'')}" disabled></div>
          </div>
          <div class="divider-lbl">💡 Thông tin nâng cao (không bắt buộc — có thể để trống)</div>
          <div class="form-grid">
            <div class="field"><label>Năm sinh</label><input maxlength="4" inputmode="numeric" id="hem-birthYear" value="${escapeHtml(h.birthYear||'')}" placeholder="Vd: 1985"></div>
            <div class="field"><label>Số CCCD</label><input id="hem-cccd" value="${h.cccd? String(h.cccd).replace(/\D/g,'') : ''}"></div>
            <div class="field"><label>Số điện thoại</label><input id="hem-phone" value="${h.phone? String(h.phone).replace(/[^\d+]/g,'') : ''}"></div>
            <div class="field full"><label>Địa chỉ cụ thể</label><input id="hem-address" value="${escapeHtml(h.address||'')}"></div>
            <div class="field"><label>Địa chỉ trước sáp nhập</label>
              <select id="hem-legacy-address">
                <option value="">-- Không chọn --</option>
                ${(state.config.hamletsLegacyHidden||[]).map(x=>`<option value="${escapeHtml(x)}" ${h.preMergerAddress===x?'selected':''}>${escapeHtml(x)}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>Ngành nghề sản xuất kinh doanh</label><input maxlength="100" id="hem-industry" value="${escapeHtml(h.industry||'')}"></div>
            <div class="field"><label>Khả năng trả nợ</label><input maxlength="100" id="hem-repayAbility" value="${escapeHtml(h.repayAbility||'')}"></div>
            <div class="field"><label>Người bảo lãnh</label><input maxlength="100" id="hem-guarantor" value="${escapeHtml(h.guarantor||'')}"></div>
          </div>
          <div class="field full"><label>Ghi chú thêm</label><textarea maxlength="200" id="hem-note" rows="2">${escapeHtml(h.note||'')}</textarea></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="hem-cancel">Đóng (không lưu)</button>
          <button class="btn btn-primary" id="hem-save">Lưu</button>
        </div>
      </div>`;
    wrap.querySelector('#hem-close').onclick = close;
    wrap.querySelector('#hem-cancel').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#hem-save').onclick = ()=>{
      const name = wrap.querySelector('#hem-name').value.trim();
      if(!name){ alert('Vui lòng nhập Họ và tên người thừa kế.'); return; }
      const newHeir = {
        name, principal: h.principal,
        hamlet: wrap.querySelector('#hem-hamlet').value,
        managerId: wrap.querySelector('#hem-manager').value,
        birthYear: wrap.querySelector('#hem-birthYear').value.trim(),
        cccd: wrap.querySelector('#hem-cccd').value.replace(/\D/g,''),
        phone: wrap.querySelector('#hem-phone').value.replace(/\s/g,'').trim(),
        address: wrap.querySelector('#hem-address').value.trim(),
        preMergerAddress: wrap.querySelector('#hem-legacy-address').value,
        industry: wrap.querySelector('#hem-industry').value.trim(),
        repayAbility: wrap.querySelector('#hem-repayAbility').value.trim(),
        guarantor: wrap.querySelector('#hem-guarantor').value.trim(),
        note: wrap.querySelector('#hem-note').value.trim(),
        loanDate: h.loanDate, dueDate: h.dueDate, rate: originalBorrower.rate,
        fundSource: originalBorrower.fundSource, splitCentral: originalBorrower.splitCentral,
        splitProvince: originalBorrower.splitProvince, splitWard: originalBorrower.splitWard,
        hamletAllocPercent: originalBorrower.hamletAllocPercent,
      };
      close();
      onSaved(newHeir);
    };
  }


  // cạnh 1 nút hộp chứa Quý bất kỳ. Toàn bộ thông tin lấy trực tiếp từ chính "hộp chứa Quý" đó.
  // Modal "THÔNG TIN LỊCH SỬ ĐÓNG TIỀN LÃI CỦA HỘ VAY [Họ và tên]" — mở từ nút "Xem" ở từng dòng
  // người vay trong modal "Tính tiền lãi và phê duyệt đóng lãi". Hiển thị TOÀN BỘ nội dung Hộp tiền
  // đã đóng lãi của người đó.
  function renderInterestPaymentHistoryModal(b){
    const disp = computeInterestPaymentBoxDisplay(b);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';    const grandUnpaid = disp.unpaidTotal + disp.futureUnpaidTotal;
    const selectedKeys = new Set();
    const allLineItems = disp.paidLines.concat(disp.unpaidLines, disp.futureUnpaidLines);
    const boxByKey = {}; allLineItems.forEach(x=> boxByKey[x.box.key]=x.box);
    const isPaidKey = (key)=> disp.paidKeys.has(key);

    // Dòng tên 1 Quý — có hiệu ứng nhảy múa, kèm nút chữ "i" xem chi tiết.
    const renderQLine = (x, section)=>{
      const sel = selectedKeys.has(x.box.key);
      const sectionClass = section==='paid' ? 'iahist-q-paid' : section==='future' ? 'iahist-q-future' : 'iahist-q-past';
      const selClass = sel ? 'iahist-qname-selected' : '';
      return `<div class="kv-row"><span><button type="button" class="qbox-info-btn" data-qinfo-key="${x.box.key}" style="width:20px; height:20px; font-size:11px; border-radius:50%; margin-right:4px;">i</button><span class="iahist-qname ${sectionClass} ${selClass}" data-qkey="${x.box.key}">${escapeHtml(x.name)}${sel?' ✅':''}</span></span><b>${moneySpaced(x.box.interestAmount)}</b></div>`;
    };

    const extList = getBorrowerExtensions(b.id);
    const loanInfoLines = [
      `<div class="kv-row"><span>Số tiền vay gốc</span><b>${moneySpaced(b.principal)}</b></div>`,
      `<div class="kv-row"><span>Lãi suất</span><b>${String(parseFloat(b.rate)||0).replace('.',',')}%/năm</b></div>`,
      ...extList.map((e,i)=> `<div class="kv-row"><span>Lãi suất quá hạn lần ${i+1}</span><b>${String(e.ratePct||0).replace('.',',')}%/năm</b></div>`),
      `<div class="kv-row"><span>Ngày vay</span><b>${fmtDate(b.loanDate)}</b></div>`,
      `<div class="kv-row"><span>Ngày đến hạn</span><b>${fmtDate(b.dueDate)}</b></div>`,
      ...extList.map((e,i)=> `<div class="kv-row"><span>Ngày kết thúc gia hạn lần ${i+1}</span><b>${fmtDate(e.to)}</b></div>`),
    ].join('');

    function renderBody(){
      // Giữ nguyên đúng vị trí đang cuộn trước khi vẽ lại (bấm chọn 1 Quý không được làm bảng nhảy
      // lên đầu — vì innerHTML bị vẽ lại toàn bộ nên phải tự lưu và khôi phục scrollTop thủ công).
      const prevBody = wrap.querySelector('.modal-body');
      const prevScrollTop = prevBody ? prevBody.scrollTop : 0;
      // QUAN TRỌNG: KHÔNG được dùng disp.paidTotal ở đây — vì đó là số tiền THỰC TẾ đã đóng, bị "đông
      // cứng" đúng tại thời điểm đóng lãi (không tự đổi theo). Phải tính lại HOÀN TOÀN MỚI từ
      // box.interestAmount (luôn tươi mới theo tiền gốc/lãi suất HIỆN TẠI) của TẤT CẢ hộp — kể cả hộp
      // đã đóng — thì mới phát hiện đúng trường hợp sửa tiền gốc/lãi suất làm hộp bị "co lại".
      const theoreticalTotal = disp.allBoxes.reduce((s,bx)=> s+bx.interestAmount, 0);
      const overflowAmount = disp.totalPaid - theoreticalTotal;
      const hasOverflow = overflowAmount > 0;
      const bodyHtml = `
          <div class="kv-row big-money-row"><span style="display:flex; align-items:center; gap:4px;"><button type="button" class="qbox-info-btn" id="iahist-totalpaid-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button> Tổng tiền đã đóng lãi</span><b>= ${moneySpaced(disp.totalPaid)}</b></div>
          ${hasOverflow? `<div class="kv-row" style="color:#b71c1c; font-weight:700;"><span>Số tiền vượt quá ngưỡng Tổng ${allLineItems.length} quý của cả khoản vay</span><b class="overflow-money-pulse">= ${moneySpaced(overflowAmount)} đ</b></div>` : ''}
          <div id="iahist-totalpaid-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin-top:4px;">Số tiền này sẽ chỉ được thay đổi khi: hộ vay được phê duyệt đóng lãi thành công, hoặc khi được trả lại tiền đã đóng lãi. Ngoài ra không có bất cứ cách nào khác để thay đổi số tiền trên. Khi xã/phường thay đổi thông tin lãi suất, chỉnh số tiền vay gốc, đổi ngày vay/ngày đến hạn/bổ sung ngày gia hạn, chỉnh thời gian hàng quý… khi đó thì các thông tin ở phía dưới sẽ bị thay đổi theo, nhưng Tổng tiền đã đóng lãi trên này là không thay đổi.</div>
          <div style="margin:6px 0 4px;">${hasOverflow
            ? `<button type="button" class="refund-btn preview-allow" id="iahist-overflow-btn">Xử lý số tiền vượt ngưỡng</button>`
            : `<button type="button" class="refund-btn preview-allow" id="iahist-refund-btn">Trả lại tiền đã đóng</button>`}</div>
          <div class="divider-lbl">Thông tin các quý đã đóng tiền lãi xong</div>
          ${disp.paidLines.length? disp.paidLines.map(x=>renderQLine(x,'paid')).join('') : `<p class="sub">Chưa có quý nào đóng xong.</p>`}
          <div class="kv-row" style="border-top:1px solid var(--line); padding-top:6px;"><span>Tổng ${disp.paidLines.length} quý là</span><b>= ${moneySpaced(disp.paidTotal)}</b></div>
          <div class="kv-row" style="margin-top:10px;"><span style="display:flex; align-items:center; gap:4px;"><button type="button" class="qbox-info-btn" id="iahist-leftover-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button> Số tiền còn dư chưa thuộc về quý nào</span><b>${moneySpaced(disp.leftover)}</b></div>
          <div id="iahist-leftover-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin-top:4px;">Đây chính là "Số tiền dư từ đợt đóng lãi trước". Số tiền này sẽ tự động trả cho các quý chưa đóng lãi (ưu tiên quý cũ nhất) khi nó đủ số tiền trả cho quý đó, hoặc sẽ được tính vào biên lai thu lãi được lập sau này.</div>
          <div class="divider-lbl">Thông tin các quý chưa đóng lãi (từ quá khứ tới Hiện tại)</div>
          ${disp.unpaidLines.length? disp.unpaidLines.map(x=>renderQLine(x,'past')).join('') : `<p class="sub">Không còn quý nào chưa đóng lãi từ quá khứ tới hiện tại.</p>`}
          <div class="kv-row" style="border-top:1px solid var(--line); padding-top:6px;"><span>Tổng ${disp.unpaidLines.length} quý chưa đóng lãi (Quá khứ tới hiện tại)</span><b>= ${moneySpaced(disp.unpaidTotal)}</b></div>
          <div class="divider-lbl">Thông tin các quý chưa đóng lãi (trong Tương lai)</div>
          ${disp.futureUnpaidLines.length? disp.futureUnpaidLines.map(x=>renderQLine(x,'future')).join('') : `<p class="sub">Không có quý nào chưa đóng lãi trong tương lai.</p>`}
          <div class="kv-row" style="border-top:1px solid var(--line); padding-top:6px;"><span>Tổng ${disp.futureUnpaidLines.length} quý chưa đóng lãi (tương lai)</span><b>= ${moneySpaced(disp.futureUnpaidTotal)}</b></div>
          <div class="kv-row" style="margin-top:10px; border-top:2px solid var(--line); padding-top:8px;"><span>Tổng ${disp.unpaidLines.length+disp.futureUnpaidLines.length} quý chưa đóng lãi (quá khứ, hiện tại và Tương lai)</span><b>= ${moneySpaced(grandUnpaid)}</b></div>
          <div class="kv-row" style="margin-top:6px; border-top:2px solid var(--line); padding-top:8px;"><span>Tổng tất cả (quá khứ + hiện tại + Tương lai) (${allLineItems.length} quý)</span><b>= ${moneySpaced(theoreticalTotal)}</b></div>
          ${loanInfoLines}
          ${currentQuarterBoundariesCaptionHtml()}`;

      const selCount = selectedKeys.size;
      const selSum = [...selectedKeys].reduce((s,k)=> s + (boxByKey[k]? boxByKey[k].interestAmount : 0), 0);
      const allSel = allLineItems.length>0 && allLineItems.every(x=> selectedKeys.has(x.box.key));

      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head"><h3>THÔNG TIN ĐÓNG TIỀN LÃI CỦA HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close" id="iahist-close">✕</button></div>
          <div class="modal-body" id="iahist-content">
            <div style="text-align:right; margin-bottom:8px; display:flex; justify-content:flex-end; gap:8px;">${exportPrintButtonsHtml('iahist-ep')}<button type="button" class="btn btn-ghost btn-sm preview-allow" id="iahist-statuslog-btn">Xem lịch sử trạng thái của các quý</button><button type="button" class="btn btn-ghost btn-sm preview-allow" id="iahist-impact-btn">Xem Biên lai đã tác động vào Tiền đã đóng lãi</button></div>
            <p class="sub" style="margin:0 0 10px;">được tính đến ngày ${fmtDate(todayStr())}</p>
            ${bodyHtml}
          </div>
          <div class="modal-foot" style="justify-content:space-between;">
            ${selCount? `
              <div class="iahist-selectall-wrap">
                <div style="display:flex; align-items:center; gap:8px;">
                  <button class="btn btn-ghost btn-sm" id="iahist-deselect-all">Bỏ chọn tất cả</button>
                  <button class="btn btn-ghost btn-sm" id="iahist-select-all">Chọn tất cả</button>
                </div>
                <span class="sub" style="font-weight:700; color:var(--rice-dark);">Tổng ${groupDigitsRight(String(selSum),3)} đồng (${selCount}-quý đang được chọn)</span>
              </div>` : `<div></div>`}
            <button class="btn btn-primary" id="iahist-close2">Đóng bảng</button>
          </div>
        </div>`;
      wire();
      const newBody = wrap.querySelector('.modal-body');
      if(newBody && prevScrollTop) newBody.scrollTop = prevScrollTop;
    }

    function wire(){
      const close = ()=> wrap.remove();
      wrap.querySelector('#iahist-close').onclick = close;
      wrap.querySelector('#iahist-close2').onclick = close;
      const statusLogBtn = wrap.querySelector('#iahist-statuslog-btn');
      if(statusLogBtn) statusLogBtn.onclick = ()=> renderQuarterStatusLogModal(b);
      const impactBtn = wrap.querySelector('#iahist-impact-btn');
      if(impactBtn) impactBtn.onclick = ()=> renderInterestImpactReceiptsModal(b);
      wireExportPrintButtons(wrap, 'iahist-ep', '#iahist-content', `Thông tin đóng tiền lãi của hộ vay ${b.name}`);
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const leftoverInfoBtn = wrap.querySelector('#iahist-leftover-info');
      const leftoverTip = wrap.querySelector('#iahist-leftover-tip');
      if(leftoverInfoBtn) leftoverInfoBtn.onclick = (e)=>{ e.stopPropagation(); leftoverTip.style.display = leftoverTip.style.display==='none' ? 'block' : 'none'; };
      const totalPaidInfoBtn = wrap.querySelector('#iahist-totalpaid-info');
      const totalPaidTip = wrap.querySelector('#iahist-totalpaid-tip');
      if(totalPaidInfoBtn) totalPaidInfoBtn.onclick = (e)=>{ e.stopPropagation(); totalPaidTip.style.display = totalPaidTip.style.display==='none' ? 'block' : 'none'; };
      if(!wrap._iahistTipCloserBound){
        wrap._iahistTipCloserBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap)) return;
          const lt = wrap.querySelector('#iahist-leftover-tip');
          const tt = wrap.querySelector('#iahist-totalpaid-tip');
          if(lt && lt.style.display!=='none' && !e.target.closest('#iahist-leftover-info') && !e.target.closest('#iahist-leftover-tip')) lt.style.display='none';
          if(tt && tt.style.display!=='none' && !e.target.closest('#iahist-totalpaid-info') && !e.target.closest('#iahist-totalpaid-tip')) tt.style.display='none';
        });
      }
      const refundBtn = wrap.querySelector('#iahist-refund-btn');
      if(refundBtn) refundBtn.onclick = ()=>{ close(); renderRefundSelectionModal(b); };
      // Nút "Xử lý số tiền vượt ngưỡng" — gắn sự kiện qua UỶ QUYỀN (event delegation) trên `wrap`
      // NGOÀI CÙNG (được tạo đúng 1 lần duy nhất khi mở bảng này, không bao giờ bị thay thế — khác
      // với các phần tử BÊN TRONG innerHTML sẽ bị dựng lại mới hoàn toàn mỗi lần renderBody() chạy).
      // Nhờ vậy nút này LUÔN nhận được click dù renderBody() có chạy lại bao nhiêu lần đi nữa. Số
      // tiền vượt ngưỡng được tính lại TƯƠI MỚI ngay tại thời điểm bấm (chỉ gọi lại hàm ĐỌC dữ liệu
      // có sẵn — computeInterestPaymentBoxDisplay — không đụng tới bất kỳ hàm tính toán nào cả).
      if(!wrap._overflowBtnDelegated){
        wrap._overflowBtnDelegated = true;
        wrap.addEventListener('click', (e)=>{
          if(!e.target.closest('#iahist-overflow-btn')) return;
          const freshDisp = computeInterestPaymentBoxDisplay(b);
          const freshTheoreticalTotal = freshDisp.allBoxes.reduce((s,bx)=> s+bx.interestAmount, 0);
          const freshOverflowAmount = freshDisp.totalPaid - freshTheoreticalTotal;
          const freshAllLineItems = freshDisp.paidLines.concat(freshDisp.unpaidLines, freshDisp.futureUnpaidLines);
          close();
          renderOverflowReceiptModal(b, freshOverflowAmount, freshAllLineItems.length);
        });
      }

      wrap.querySelectorAll('[data-qinfo-key]').forEach(btn=>{
        btn.onclick = (e)=>{
          e.stopPropagation();
          const key = btn.dataset.qinfoKey;
          const box = boxByKey[key];
          if(box) renderQuarterBoxInfoModal(b, box, isPaidKey(key));
        };
      });
      wrap.querySelectorAll('.iahist-qname').forEach(el=>{
        el.onclick = ()=>{
          const key = el.dataset.qkey;
          if(selectedKeys.has(key)) selectedKeys.delete(key); else selectedKeys.add(key);
          renderBody();
        };
        // Xử lý hover TRỰC TIẾP bằng JS (không chỉ dựa vào CSS :hover) để chắc chắn thắng được
        // animation nhấp nháy tuần hoàn đang chạy trên chính phần tử này.
        el.addEventListener('mouseenter', ()=>{
          if(el.classList.contains('iahist-qname-selected')) return; // đang chọn vĩnh viễn -> bỏ qua hover
          el.style.animationPlayState = 'paused';
          el.style.transform = 'scale(1.4)';
        });
        el.addEventListener('mouseleave', ()=>{
          if(el.classList.contains('iahist-qname-selected')) return;
          el.style.animationPlayState = '';
          el.style.transform = '';
        });
      });
      const selectAllBtn = wrap.querySelector('#iahist-select-all');
      if(selectAllBtn) selectAllBtn.onclick = ()=>{ allLineItems.forEach(x=> selectedKeys.add(x.box.key)); renderBody(); };
      const deselectAllBtn = wrap.querySelector('#iahist-deselect-all');
      if(deselectAllBtn) deselectAllBtn.onclick = ()=>{ selectedKeys.clear(); renderBody(); };
    }

    document.body.appendChild(wrap);
    renderBody();
  }

  // Trả lại tiền cho 1 hay nhiều Quý đã đóng — xoá khỏi payments (đưa về "chưa đóng"), giảm tổng
  // totalPaid đúng bằng số tiền đã trả lại thật.
  async function refundQuartersForBorrower(b, boxKeys, refundAmount){
    const raw = getInterestPaymentBoxRaw(b.id);
    const payments = Object.assign({}, raw.payments||{});
    boxKeys.forEach(k=> delete payments[k]);
    const newTotalPaid = Math.max(0, Math.round(((raw.totalPaid||0) - refundAmount)*100)/100);
    await cSet('interestPaymentBoxes/'+b.id, { totalPaid: newTotalPaid, payments });
    state.interestPaymentBoxes = state.interestPaymentBoxes||{};
    state.interestPaymentBoxes[b.id] = { totalPaid:newTotalPaid, payments };
  }
  // "Xử lý số tiền vượt ngưỡng" — CHỈ GHI dữ liệu vào Hộp tiền đóng lãi (giống hệt khuôn mẫu của
  // refundQuartersForBorrower ở trên), TUYỆT ĐỐI KHÔNG đụng vào bất kỳ hàm TÍNH TOÁN nào
  // (computeInterestPaymentBoxState/Display, borrowerQuarterBoxes...). Sau khi xử lý xong: giảm đúng
  // "Tổng tiền đã đóng lãi" đi đúng bằng số tiền vượt ngưỡng, đồng thời "cắt" các hộp đã đóng đang ghi
  // nhận NHIỀU hơn số tiền lãi hiện tại của chính hộp đó xuống đúng bằng số tiền lãi hiện tại — nhờ
  // vậy lần tính lại kế tiếp, số tiền vượt ngưỡng sẽ tự động về đúng 0.
  async function settleOverflowForBorrower(b, overflowAmount){
    const raw = getInterestPaymentBoxRaw(b.id);
    const disp = computeInterestPaymentBoxDisplay(b); // chỉ ĐỌC, an toàn tuyệt đối
    const payments = Object.assign({}, raw.payments||{});
    disp.allBoxes.forEach(bx=>{
      if(payments[bx.key]!=null && payments[bx.key] > bx.interestAmount) payments[bx.key] = bx.interestAmount;
    });
    const newTotalPaid = Math.max(0, Math.round(((raw.totalPaid||0) - overflowAmount)*100)/100);
    await cSet('interestPaymentBoxes/'+b.id, { totalPaid: newTotalPaid, payments });
    state.interestPaymentBoxes = state.interestPaymentBoxes||{};
    state.interestPaymentBoxes[b.id] = { totalPaid:newTotalPaid, payments };
  }

  // Modal "Chọn quý hoặc nhập số tiền để TRẢ LẠI tiền lãi cho hộ vay ..." — chỉ liệt kê các Quý ĐÃ
  // đóng lãi xong (mới->cũ), cho chọn nhiều Quý y hệt cơ chế chọn Quý chưa đóng ở bảng đóng lãi.
  function renderRefundSelectionModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const selectedKeys = new Set();
    let includeLeftover = false;

    function renderBody(){
      const disp = computeInterestPaymentBoxDisplay(b);
      const paidList = disp.paidLines; // đã mới->cũ
      const allSel = paidList.length>0 && paidList.every(x=>selectedKeys.has(x.box.key));
      const selCount = selectedKeys.size;
      const selSum = paidList.filter(x=>selectedKeys.has(x.box.key)).reduce((s,x)=>s+x.amount,0) + (includeLeftover? disp.leftover : 0);
      const canProceed = selectedKeys.size>0 || includeLeftover;
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:900px;">
          <div class="modal-head"><h3>Chọn quý hoặc nhập số tiền để TRẢ LẠI tiền lãi cho hộ vay ${escapeHtml(b.name)}</h3><button class="modal-close preview-allow" id="rfs-close">✕</button></div>
          <div class="modal-body">
            <div class="divider-lbl" style="margin-top:0;">Các Quý đã đóng lãi XONG:</div>
            ${paidList.length? `<div style="margin-top:6px;">${paidList.map(x=>{
              const sel = selectedKeys.has(x.box.key);
              return `<span class="qbox-wrap">
                <button class="qbox-btn qbox-pulsing preview-allow ${sel?'qbox-selected':''}" data-qkey="${x.box.key}">${escapeHtml(x.name)}</button>
                <button class="qbox-info-btn qbox-pulsing preview-allow" data-qinfo="${x.box.key}">i</button>
              </span>`;
            }).join('')}
            <button class="qbox-selectall-btn preview-allow" id="rfs-selall">${allSel? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button></div>` : `<p class="sub">Hộ vay này chưa đóng lãi lần nào.</p>`}
            <div style="margin-top:14px; display:flex; align-items:center; gap:6px;">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; width:fit-content;">
                <input type="checkbox" id="rfs-include-leftover" class="preview-allow" ${includeLeftover?'checked':''}>
                <span>Bổ sung thêm: Trả lại số tiền dư chưa thuộc về quý nào <b>(${moneySpaced(disp.leftover)})</b></span>
              </label>
              <button type="button" class="qbox-info-btn preview-allow" id="rfs-leftover-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button>
            </div>
            <div id="rfs-leftover-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin-top:6px; max-width:600px;">"Số tiền dư chưa thuộc về quý nào" trong "Thông tin đóng lãi" của hộ vay chính là "Số tiền dư từ đợt trước", tiền dư của hộ nào sẽ được tính vào đúng biên lai của hộ đó.</div>
            <div style="margin-top:16px; text-align:center;"><button class="btn btn-ghost btn-pulse-green preview-allow" id="rfs-money-mode">Hoặc TRẢ LẠI tiền lãi bằng cách nhập số tiền cụ thể</button></div>
          </div>
          <div class="modal-foot" style="justify-content:space-between;">
            <button class="btn btn-ghost preview-allow" id="rfs-cancel">Đóng bảng</button>
            <div style="display:flex; align-items:center; gap:12px;">
              ${canProceed? `<span class="sub" style="font-weight:700; color:var(--rice-dark);">Tổng ${groupDigitsRight(String(selSum),3)} đồng (trong ${selCount}-quý được chọn${includeLeftover?' + tiền dư':''})</span>` : ''}
              <button class="btn btn-primary preview-allow" id="rfs-start" ${canProceed? '' : 'disabled'}>Bắt đầu tính tiền trả lại và lập biên lai</button>
            </div>
          </div>
        </div>`;
      wrap.querySelector('#rfs-close').onclick = close;
      wrap.querySelector('#rfs-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const rfsStartBtn = wrap.querySelector('#rfs-start');
      if(rfsStartBtn) rfsStartBtn.addEventListener('mouseenter', ()=>{
        const body = wrap.querySelector('.modal-body');
        if(body) body.scrollTo({ top: body.scrollHeight, behavior:'smooth' });
      });
      wrap.querySelectorAll('[data-qkey]').forEach(btn=>{
        btn.onclick = ()=>{ const k=btn.dataset.qkey; if(selectedKeys.has(k)) selectedKeys.delete(k); else selectedKeys.add(k); renderBody(); };
      });
      wrap.querySelectorAll('[data-qinfo]').forEach(btn=>{
        btn.onclick = (e)=>{ e.stopPropagation(); const x=paidList.find(x=>x.box.key===btn.dataset.qinfo); if(x) renderQuarterBoxInfoModal(b, x.box, true); };
      });
      const selAllBtn = wrap.querySelector('#rfs-selall');
      if(selAllBtn) selAllBtn.onclick = ()=>{ if(allSel) selectedKeys.clear(); else paidList.forEach(x=>selectedKeys.add(x.box.key)); renderBody(); };
      const leftoverCb = wrap.querySelector('#rfs-include-leftover');
      if(leftoverCb) leftoverCb.onclick = ()=>{ includeLeftover = leftoverCb.checked; renderBody(); };
      const leftoverInfoBtn = wrap.querySelector('#rfs-leftover-info');
      const leftoverTip = wrap.querySelector('#rfs-leftover-tip');
      if(leftoverInfoBtn) leftoverInfoBtn.onclick = (e)=>{ e.stopPropagation(); leftoverTip.style.display = leftoverTip.style.display==='none'?'block':'none'; };
      setTimeout(()=>{ wrap.querySelectorAll('.qbox-pulsing').forEach(el=>el.classList.remove('qbox-pulsing')); }, 3000);
      const moneyModeBtn = wrap.querySelector('#rfs-money-mode');
      if(moneyModeBtn) moneyModeBtn.onclick = ()=>{ close(); renderRefundMoneyReceiptModal(b); };
      const startBtn = wrap.querySelector('#rfs-start');
      if(startBtn) startBtn.onclick = ()=>{ if(!canProceed) return; close(); renderRefundQuarterReceiptModal(b, [...selectedKeys], includeLeftover); };
    }
    renderBody();
  }

  // "BIÊN LAI TRẢ LẠI TIỀN LÃI ĐÃ ĐÓNG" — theo cách chọn Quý (đã chọn sẵn từ renderRefundSelectionModal).
  function renderRefundQuarterReceiptModal(b, chosenKeys, includeLeftover){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const openedAt = Date.now();
    const close = ()=> wrap.remove();
    const snapshotTotalPaidAtOpen = getInterestPaymentBoxRaw(b.id).totalPaid;
    const goBack = ()=>{ close(); renderRefundSelectionModal(b); };
    let selectedCategoryId = '';

    function render(){
      const disp = computeInterestPaymentBoxDisplay(b);
      const chosen = chosenKeys.map(k=> disp.paidLines.find(x=>x.box.key===k)).filter(Boolean).map(x=>x.box);
      const quartersSum = chosen.reduce((s,bx)=>s+bx.interestAmount,0);
      const leftoverPart = includeLeftover ? disp.leftover : 0;
      const refundAmount = quartersSum + leftoverPart;
      const explainLine = includeLeftover
        ? `Số tiền này sẽ được trừ khỏi Tổng số tiền đã đóng lãi của hộ vay${chosen.length? ', các quý ở trên sẽ quay về trạng thái CHƯA đóng lãi' : ''}, đồng thời "Số tiền còn dư chưa thuộc về quý nào" (${moneySpaced(leftoverPart)}) trong Hộp tiền đóng lãi cũng sẽ được trả lại hết và trở về 0đ.`
        : `Số tiền này sẽ được trừ khỏi Tổng số tiền đã đóng lãi của hộ vay, các quý ở trên sẽ quay về trạng thái CHƯA đóng lãi.`;
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head receipt-head-refund"><h3>BIÊN LAI TRẢ LẠI TIỀN LÃI ĐÃ ĐÓNG ĐỐI VỚI HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="rfq-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
            ${includeLeftover? `<div class="kv-row"><span>Số tiền dư trong ví chưa thuộc về quý nào, giờ được trả lại</span><b>${moneySpaced(leftoverPart)}</b></div>` : ''}
            ${chosen.length? `<p style="margin:${includeLeftover?'10px':'0'} 0 6px; font-weight:700;">Các quý được trả lại tiền là:</p>
            ${chosen.map(bx=>`<div class="kv-row"><span>${escapeHtml(formatTimelineQuarterLabel(bx))}</span><b>${moneySpaced(bx.interestAmount)}</b></div>`).join('')}` : ''}
            <div class="kv-row big-money-row" style="border-top:1px solid var(--line); margin-top:6px; padding-top:6px;">
              <span style="display:flex; align-items:center; gap:4px;">Tổng tất cả (số tiền thực trả) <button type="button" class="qbox-info-btn" id="rfq-total-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button></span>
              <b>= ${moneySpaced(refundAmount)}</b>
            </div>
            <div id="rfq-total-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:4px 0;">Đây là số tiền thực tế được trả lại</div>
            <p class="sub" style="margin-top:6px;">${escapeHtml(explainLine)}</p>
            ${receiptPayerFieldsHtmlRefund(b)}
            ${receiptCategoryFieldHtml('refund','rfq', selectedCategoryId)}
            ${advancedInfoHtml(b, chosen, 'rfq')}
          </div>
          <div class="modal-foot" style="justify-content:space-between;">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-ghost preview-allow" id="rfq-back">Quay lại</button>
            </div>
            <button class="btn btn-primary preview-allow" id="rfq-confirm">Xác nhận trả tiền lãi thành công</button>
          </div>
        </div>`;
      wrap.querySelector('#rfq-close').onclick = close;
      wrap.querySelector('#rfq-back').onclick = goBack;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wireReceiptCategoryField(wrap, 'refund', 'rfq', render, (id)=>{ selectedCategoryId = id; });
      wireAdvancedInfo(wrap, 'rfq');
      const totalInfoBtn = wrap.querySelector('#rfq-total-info');
      const totalTip = wrap.querySelector('#rfq-total-tip');
      if(totalInfoBtn) totalInfoBtn.onclick = (e)=>{ e.stopPropagation(); totalTip.style.display = totalTip.style.display==='none'?'block':'none'; };
      if(!wrap._tipCloserBound){
        wrap._tipCloserBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap)) return;
          const tt = wrap.querySelector('#rfq-total-tip');
          if(tt && tt.style.display!=='none' && !e.target.closest('#rfq-total-info') && !e.target.closest('#rfq-total-tip')) tt.style.display='none';
        });
      }
      wireConfirmBtnBehavior(wrap, wrap.querySelector('#rfq-confirm'), openedAt);
      wrap.querySelector('#rfq-confirm').onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
        const payerName = (wrap.querySelector('#rcpt-refund-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#rcpt-refund-collector').value||'').trim();
        const reason = (wrap.querySelector('#rcpt-refund-reason').value||'').trim();
        if(!payerName || !collectorName){ alert('Vui lòng điền đầy đủ "Người trả lại tiền" và "Người nhận lại tiền" trước khi xác nhận.'); return; }
        if(!reason){ alert('Vui lòng điền "Lý do trả lại" trước khi xác nhận.'); return; }
        { if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return; }
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        const dispBeforeRfq = computeInterestPaymentBoxDisplay(b);
        await refundQuartersForBorrower(b, chosenKeys, refundAmount);
        {
          const dispAfterRfq = computeInterestPaymentBoxDisplay(b);
          await logQuarterStatusDiff(b, dispBeforeRfq, dispAfterRfq,
            `Đã được đóng lãi trở lại do thay đổi thông tin liên quan tới khoản vay`,
            `Đã trở về trạng thái chưa đóng lãi bởi Biên lai Trả lại tiền lãi đã đóng (theo cách tính quý) lập ngày ${fmtDate(todayStr())}`);
        }
        { const boxByKeyRfq = {}; borrowerQuarterBoxes(b).forEach(bx=> boxByKeyRfq[bx.key]=bx);
          await pushReceiptRecord(b, 'refund_quarter', { amount:refundAmount, sign:'-',
            quarterLines: chosenKeys.map(k=>{ const p=parseQuarterBoxKey(k); const bx=boxByKeyRfq[k]; return p? {...p, amount: bx? bx.interestAmount : 0} : null; }).filter(Boolean),
            categoryLabelId: selectedCategoryId||null, extra: { payerName, collectorName, reason } });
        }
        await pushLog('xác nhận', `trả lại tiền lãi đã đóng cho hộ vay ${b.name} (${moneySpaced(refundAmount)})`);
        hideProcessingToast(); // Bước 4
        showBigToast(`Trả lãi thành công: hộ vay ${b.name}, số tiền ${groupDigitsRight(String(Math.round(refundAmount)),3)}đ`);
      };
    }
    render();
  }

  // "BIÊN LAI TRẢ LẠI TIỀN LÃI ĐÃ ĐÓNG" — theo cách nhập số tiền cụ thể (mới->cũ, hoàn trả các Quý
  // gần nhất trước).
  // Hoàn trả theo cách tính tiền: ưu tiên trả "số tiền dư chưa thuộc về quý nào" TRƯỚC (luôn nhỏ
  // hơn), rồi mới tới các Quý đã đóng theo thứ tự MỚI NHẤT trước. Nếu số tiền không đủ hoàn TRỌN 1
  // Quý nào đó, Quý đó vẫn quay về trạng thái CHƯA đóng lãi hoàn toàn, chỉ có phần tiền THỰC SỰ
  // được hoàn là ít hơn — phần chênh lệch tự động trở thành "số tiền dư mới" trong Hộp tiền đóng lãi.
  function computeRefundMoneySettlement(amount, disp){
    let remaining = amount;
    const leftoverPart = Math.min(remaining, disp.leftover);
    remaining = Math.round((remaining-leftoverPart)*100)/100;
    const fullQuarters = [];
    let partialQuarter = null;
    for(const x of disp.paidLines){ // mới->cũ
      if(remaining<=0) break;
      if(remaining >= x.amount){ fullQuarters.push(x.box); remaining = Math.round((remaining-x.amount)*100)/100; }
      else { partialQuarter = { box:x.box, amount:remaining, fullAmount:x.amount }; remaining = 0; }
    }
    const removedKeys = fullQuarters.map(bx=>bx.key).concat(partialQuarter? [partialQuarter.box.key] : []);
    return { leftoverPart, fullQuarters, partialQuarter, removedKeys };
  }
  function buildRefundMoneyExplanation(amount, result){
    if(amount<=0) return '';
    const { leftoverPart, fullQuarters, partialQuarter } = result;
    const names = (list)=> list.map(bx=>formatTimelineQuarterLabel(bx)).join(', ');
    const parts = [];
    parts.push(`Số tiền ${moneySpaced(amount)} này sẽ được trừ khỏi Tổng số tiền đã đóng lãi của hộ vay.`);
    if(leftoverPart>0) parts.push(`Trong đó ${moneySpaced(leftoverPart)} được dùng để trả lại đúng "Số tiền còn dư chưa thuộc về quý nào" hiện có trong Hộp tiền đóng lãi.`);
    if(fullQuarters.length) parts.push(`${names(fullQuarters)} sẽ quay về trạng thái CHƯA đóng lãi.`);
    if(partialQuarter){
      const remain = Math.round((partialQuarter.fullAmount-partialQuarter.amount)*100)/100;
      parts.push(`Số tiền còn sót lại sẽ tiếp tục trả cho ${formatTimelineQuarterLabel(partialQuarter.box)} — nhưng chỉ đủ trả ${moneySpaced(partialQuarter.amount)} trong tổng ${moneySpaced(partialQuarter.fullAmount)} của quý này, nên ${formatTimelineQuarterLabel(partialQuarter.box)} cũng sẽ quay về trạng thái CHƯA đóng lãi xong, còn phần chưa trả lại được là ${moneySpaced(remain)} sẽ trở thành số tiền dư MỚI trong Hộp tiền đóng lãi.`);
    }
    return parts.join(' ');
  }
  // "BIÊN LAI XỬ LÝ SỐ TIỀN LÃI ĐÃ ĐÓNG VƯỢT NGƯỠNG..." — hạng mục biên lai thứ 14. Số tiền LUÔN
  // khoá cứng = overflowAmount, không sửa được. 2 phương án xử lý dính chùm (chỉ chọn 1).
  function renderOverflowReceiptModal(b, overflowAmount, quarterCount){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const openedAt = Date.now();
    const close = ()=> wrap.remove();
    const snapshotTotalPaidAtOpen = getInterestPaymentBoxRaw(b.id).totalPaid;
    const goBack = ()=>{ close(); renderInterestPaymentHistoryModal(b); };
    let mode = 'return'; // 'return' | 'other'
    let advInfoOpen = false;
    let selectedCategoryId = '';

    function render(){
      try{
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head receipt-head-refund"><h3>BIÊN LAI XỬ LÝ SỐ TIỀN LÃI ĐÃ ĐÓNG VƯỢT NGƯỠNG TỔNG SỐ TIỀN CẦN PHẢI ĐÓNG CỦA KHOẢN VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="ovf-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
            <div class="kv-row big-money-row" style="margin-top:0;"><span>Số tiền xử lý</span><b class="overflow-money-pulse">= ${moneySpaced(overflowAmount)} đ</b></div>
            <p class="sub" style="margin:4px 0 14px;">Số tiền này được tính tự động (Tổng tiền đã đóng lãi trừ đi Tổng ${quarterCount} quý của cả khoản vay) — KHÔNG thể sửa đổi.</p>
            <div style="display:flex;">
              <button type="button" class="archive-tab-btn preview-allow ${mode==='return'?'active':''}" id="ovf-mode-return" style="flex:1;">Trả lại hộ vay ${escapeHtml(b.name)}</button>
              <button type="button" class="archive-tab-btn preview-allow ${mode==='other'?'active':''}" id="ovf-mode-other" style="flex:1;">Xử lý theo phương án khác</button>
            </div>
            <div style="margin-top:14px;">
              ${mode==='return'? `
                <p class="sub">Số tiền lãi đã đóng dư ra này (do vượt quá tổng số tiền lãi cần phải đóng của cả khoản vay) sẽ được trả lại trực tiếp cho hộ vay.</p>
                <div class="field"><label>Ghi chú thêm (không bắt buộc)</label><textarea id="ovf-note" maxlength="200" rows="2" class="preview-allow" placeholder="Có thể để trống..."></textarea></div>
                <div class="field"><label>Người trả lại tiền</label><input id="ovf-payer" maxlength="30" class="preview-allow" value="${escapeHtml((state.identity&&state.identity.name)||'')}"></div>
                <div class="field"><label>Người nhận lại tiền</label><input id="ovf-collector" maxlength="30" class="preview-allow" value="${escapeHtml(b.name||'')}"></div>
              ` : `
                <div class="field"><label>Tên phương án xử lý *</label><input id="ovf-plan-name" maxlength="30" class="preview-allow" placeholder="Bắt buộc nhập..."></div>
                <div class="field"><label>Nội dung cụ thể của phương án xử lý *</label><textarea id="ovf-plan-detail" maxlength="200" rows="3" class="preview-allow" placeholder="Bắt buộc nhập..."></textarea></div>
              `}
            </div>
            ${receiptCategoryFieldHtml('refund','ovf', selectedCategoryId)}
            <div id="ovf-advinfo"></div>
          </div>
          <div class="modal-foot" style="justify-content:space-between;">
            <button class="btn btn-ghost preview-allow" id="ovf-back">Quay lại (không phê duyệt)</button>
            <button class="btn btn-primary preview-allow" id="ovf-confirm">Xác nhận phê duyệt thành công</button>
          </div>
        </div>`;
      wrap.querySelector('#ovf-close').onclick = close;
      wrap.querySelector('#ovf-back').onclick = goBack;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelector('#ovf-mode-return').onclick = ()=>{ mode='return'; render(); };
      wrap.querySelector('#ovf-mode-other').onclick = ()=>{ mode='other'; render(); };
      wireReceiptCategoryField(wrap, 'refund', 'ovf', render, (id)=>{ selectedCategoryId = id; });
      const advEl = wrap.querySelector('#ovf-advinfo');
      if(advEl) advEl.innerHTML = advancedInfoHtml(b, [], 'ovf', advInfoOpen);
      wireAdvancedInfo(wrap, 'ovf', (open)=>{ advInfoOpen = open; });
      const confirmBtn = wrap.querySelector('#ovf-confirm');
      delayEnableConfirmBtn(confirmBtn, openedAt);
      confirmBtn.addEventListener('mouseenter', ()=>{
        if(confirmBtn.dataset.locked==='1') return;
        const body = wrap.querySelector('.modal-body');
        if(body) body.scrollTo({ top: body.scrollHeight, behavior:'smooth' });
      });
      confirmBtn.onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
        let extra = { quarterCount };
        if(mode==='return'){
          const payerName = (wrap.querySelector('#ovf-payer').value||'').trim();
          const collectorName = (wrap.querySelector('#ovf-collector').value||'').trim();
          if(!payerName || !collectorName){ alert('Vui lòng điền đầy đủ "Người trả lại tiền" và "Người nhận lại tiền" trước khi xác nhận.'); return; }
          extra.mode = 'return'; extra.payerName = payerName; extra.collectorName = collectorName;
          extra.note = (wrap.querySelector('#ovf-note').value||'').trim();
        } else {
          const planName = (wrap.querySelector('#ovf-plan-name').value||'').trim();
          const planDetail = (wrap.querySelector('#ovf-plan-detail').value||'').trim();
          if(!planName){ alert('Vui lòng điền "Tên phương án xử lý" trước khi xác nhận.'); return; }
          if(!planDetail){ alert('Vui lòng điền "Nội dung cụ thể của phương án xử lý" trước khi xác nhận.'); return; }
          extra.mode = 'other'; extra.planName = planName; extra.planDetail = planDetail;
        }
        { if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return; }
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        const dispBeforeOvf = computeInterestPaymentBoxDisplay(b);
        await settleOverflowForBorrower(b, overflowAmount);
        {
          const dispAfterOvf = computeInterestPaymentBoxDisplay(b);
          await logQuarterStatusDiff(b, dispBeforeOvf, dispAfterOvf,
            `Đã được đóng lãi trở lại do thay đổi thông tin liên quan tới khoản vay`,
            `Đã trở về trạng thái chưa đóng lãi bởi Biên lai xử lý số tiền lãi đã đóng vượt ngưỡng lập ngày ${fmtDate(todayStr())}`);
        }
        await pushReceiptRecord(b, 'overflow_paid', { amount: overflowAmount, sign:'-', categoryLabelId: selectedCategoryId||null, extra });
        await pushLog('xác nhận', `xử lý số tiền lãi đã đóng vượt ngưỡng của hộ vay ${b.name} (${moneySpaced(overflowAmount)})`);
        hideProcessingToast(); // Bước 4
        showBigToast(`Đã phê duyệt thành công: xử lý số tiền vượt ngưỡng của hộ vay ${b.name} là ${groupDigitsRight(String(Math.round(overflowAmount)),3)}đ`);
      };
      }catch(err){ console.error('Lỗi khi hiện Biên lai xử lý vượt ngưỡng:', err); alert('Có lỗi khi mở Biên lai xử lý vượt ngưỡng: '+(err&&err.message||err)); }
    }
    render();
  }

  function renderRefundMoneyReceiptModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const openedAt = Date.now();
    const close = ()=> wrap.remove();
    const snapshotTotalPaidAtOpen = getInterestPaymentBoxRaw(b.id).totalPaid;
    const goBack = ()=>{ close(); renderRefundSelectionModal(b); };
    let amount = 0;
    let lastResult = null, lastRefundAmount = 0, lastMaxAllowed = 0;
    let advInfoOpen = false;
    let selectedCategoryId = '';

    function renderShell(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head receipt-head-refund"><h3>BIÊN LAI TRẢ LẠI TIỀN LÃI ĐÃ ĐÓNG ĐỐI VỚI HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="rfm-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
            <div class="kv-row big-money-row" style="margin-top:0;">
              <span style="display:flex; align-items:center; gap:4px;">Tổng tất cả (số tiền thực trả) <button type="button" class="qbox-info-btn" id="rfm-total-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button></span>
              <b id="rfm-total-disp"></b>
            </div>
            <div id="rfm-total-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:4px 0;">Đây là số tiền thực tế được trả lại</div>
            <div class="rcpt-reset-wrap"><input id="rfm-total" class="preview-allow" style="text-align:center;" placeholder="sửa" value=""><button type="button" class="rcpt-reset-btn preview-allow" id="rfm-total-reset">↺</button><div class="rcpt-reset-tip">trở về trạng thái trống ban đầu</div></div>
            <div id="rfm-results"></div>
            ${receiptPayerFieldsHtmlRefund(b)}
            ${receiptCategoryFieldHtml('refund','rfm', selectedCategoryId)}
            <div id="rfm-advinfo"></div>
          </div>
          <div class="modal-foot" style="justify-content:space-between;">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-ghost preview-allow" id="rfm-back">Quay lại</button>
            </div>
            <button class="btn btn-primary preview-allow" id="rfm-confirm">Xác nhận trả tiền lãi thành công</button>
          </div>
        </div>`;
      wireShell();
      updateResults();
    }

    function updateResults(){
      const disp = computeInterestPaymentBoxDisplay(b);
      const maxAllowed = disp.paidTotal + disp.leftover; // = disp.totalPaid, viết tường minh theo đúng công thức
      const result = computeRefundMoneySettlement(amount, disp);
      lastResult = result; lastRefundAmount = amount; lastMaxAllowed = maxAllowed;
      const totalDisp = wrap.querySelector('#rfm-total-disp');
      if(totalDisp) totalDisp.textContent = `= ${moneySpaced(amount)}`;
      const resultsEl = wrap.querySelector('#rfm-results');
      const allShown = result.fullQuarters.concat(result.partialQuarter? [result.partialQuarter.box] : []);
      if(resultsEl) resultsEl.innerHTML = `
            ${result.leftoverPart>0? `<div class="kv-row" style="margin-top:14px;"><span style="display:flex; align-items:center; gap:4px;"><button type="button" class="qbox-info-btn" id="rfm-leftover-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button> Số tiền dư trong ví chưa thuộc về quý nào, giờ được trả lại</span><b>${moneySpaced(result.leftoverPart)}</b></div>
            <div id="rfm-leftover-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin-top:4px;">"Số tiền dư chưa thuộc về quý nào" trong "Thông tin đóng lãi" của hộ vay chính là "Số tiền dư từ đợt trước", tiền dư của hộ nào sẽ được tính vào đúng biên lai của hộ đó.</div>` : ''}
            ${allShown.length? `<p style="margin:14px 0 6px; font-weight:700;">Các quý được trả lại tiền là:</p>
            ${allShown.map(bx=>`<div class="kv-row"><span>${escapeHtml(formatTimelineQuarterLabel(bx))}</span><b>${moneySpaced(bx.interestAmount)}</b></div>`).join('')}
            <div class="kv-row" style="border-top:1px solid var(--line); margin-top:6px; padding-top:6px;"><span>Tổng tiền các quý</span><b>= ${moneySpaced(allShown.reduce((s,bx)=>s+bx.interestAmount,0))}</b></div>` : (amount>0? `<p class="sub">Chưa có Quý nào được trả lại.</p>` : '')}
            <p class="sub" style="margin-top:6px;">${escapeHtml(buildRefundMoneyExplanation(amount, result))}</p>
            <p class="sub" id="rfm-error" style="color:var(--red); font-weight:700; display:${amount>maxAllowed? 'block':'none'}; margin-top:6px;">${amount>maxAllowed? 'Số tiền này vượt quá Tổng số tiền đã đóng lãi + Số tiền còn dư chưa thuộc về quý nào của hộ vay, vui lòng điều chỉnh lại' : ''}</p>`;
      const advEl = wrap.querySelector('#rfm-advinfo');
      if(advEl) advEl.innerHTML = advancedInfoHtml(b, allShown, 'rfm', advInfoOpen);
      const confirmBtn = wrap.querySelector('#rfm-confirm');
      if(confirmBtn){ confirmBtn.disabled = (amount<=0 || amount>maxAllowed); if(!confirmBtn.disabled) delayEnableConfirmBtn(confirmBtn, openedAt); }
      wireAdvancedInfo(wrap, 'rfm', (open)=>{ advInfoOpen = open; });
      const rfmLeftoverInfoBtn = wrap.querySelector('#rfm-leftover-info');
      const rfmLeftoverTip = wrap.querySelector('#rfm-leftover-tip');
      if(rfmLeftoverInfoBtn) rfmLeftoverInfoBtn.onclick = (e)=>{ e.stopPropagation(); rfmLeftoverTip.style.display = rfmLeftoverTip.style.display==='none'?'block':'none'; };
    }

    function wireShell(){
      wrap.querySelector('#rfm-close').onclick = close;
      wrap.querySelector('#rfm-back').onclick = goBack;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wireReceiptCategoryField(wrap, 'refund', 'rfm', renderShell, (id)=>{ selectedCategoryId = id; });
      const totalInfoBtn = wrap.querySelector('#rfm-total-info');
      const totalTip = wrap.querySelector('#rfm-total-tip');
      if(totalInfoBtn) totalInfoBtn.onclick = (e)=>{ e.stopPropagation(); totalTip.style.display = totalTip.style.display==='none'?'block':'none'; };
      if(!wrap._tipCloserBound){
        wrap._tipCloserBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap)) return;
          const tt = wrap.querySelector('#rfm-total-tip');
          if(tt && tt.style.display!=='none' && !e.target.closest('#rfm-total-info') && !e.target.closest('#rfm-total-tip')) tt.style.display='none';
        });
      }
      const totalInput = wrap.querySelector('#rfm-total');
      totalInput.addEventListener('focus', ()=>{ totalInput.value=''; });
      totalInput.addEventListener('input', ()=>{
        totalInput.value = totalInput.value.replace(/[^\d]/g,'').slice(0,12);
        amount = parseInt(totalInput.value,10)||0;
        updateResults();
      });
      totalInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); totalInput.blur(); } });
      const resetBtn = wrap.querySelector('#rfm-total-reset');
      if(resetBtn) resetBtn.onclick = ()=>{ amount=0; totalInput.value=''; updateResults(); };
      const confirmBtn = wrap.querySelector('#rfm-confirm');
      if(confirmBtn) confirmBtn.addEventListener('mouseenter', ()=>{
        if(confirmBtn.dataset.locked==='1') return;
        const body = wrap.querySelector('.modal-body');
        if(body) body.scrollTo({ top: body.scrollHeight, behavior:'smooth' });
      });
      if(confirmBtn) confirmBtn.onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
        if(amount<=0 || amount>lastMaxAllowed) return;
        const payerName = (wrap.querySelector('#rcpt-refund-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#rcpt-refund-collector').value||'').trim();
        const reason = (wrap.querySelector('#rcpt-refund-reason').value||'').trim();
        if(!payerName || !collectorName){ alert('Vui lòng điền đầy đủ "Người trả lại tiền" và "Người nhận lại tiền" trước khi xác nhận.'); return; }
        if(!reason){ alert('Vui lòng điền "Lý do trả lại" trước khi xác nhận.'); return; }
        { if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return; }
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        const dispBeforeRfm = computeInterestPaymentBoxDisplay(b);
        await refundQuartersForBorrower(b, lastResult.removedKeys, lastRefundAmount);
        {
          const dispAfterRfm = computeInterestPaymentBoxDisplay(b);
          await logQuarterStatusDiff(b, dispBeforeRfm, dispAfterRfm,
            `Đã được đóng lãi trở lại do thay đổi thông tin liên quan tới khoản vay`,
            `Đã trở về trạng thái chưa đóng lãi bởi Biên lai Trả lại tiền lãi đã đóng (theo cách tính tiền cụ thể) lập ngày ${fmtDate(todayStr())}`);
        }
        { const boxByKeyRfm = {}; borrowerQuarterBoxes(b).forEach(bx=> boxByKeyRfm[bx.key]=bx);
          await pushReceiptRecord(b, 'refund_money', { amount:lastRefundAmount, sign:'-',
            quarterLines: lastResult.removedKeys.map(k=>{ const p=parseQuarterBoxKey(k); const bx=boxByKeyRfm[k]; return p? {...p, amount: bx? bx.interestAmount : 0} : null; }).filter(Boolean),
            categoryLabelId: selectedCategoryId||null, extra: { payerName, collectorName, reason, explanation: buildRefundMoneyExplanation(lastRefundAmount, lastResult) } });
        }
        await pushLog('xác nhận', `trả lại tiền lãi đã đóng (theo cách tính tiền) cho hộ vay ${b.name} (${moneySpaced(lastRefundAmount)})`);
        hideProcessingToast(); // Bước 4
        showBigToast(`Trả lãi thành công: hộ vay ${b.name}, số tiền ${groupDigitsRight(String(Math.round(lastRefundAmount)),3)}đ`);
      };
    }
    renderShell();
  }

  // "LỊCH SỬ TRẠNG THÁI CỦA CÁC QUÝ" — nhật ký các lần 1 Quý chuyển đã đóng <-> chưa đóng lãi. Sắp
  // xếp theo đúng yêu cầu: Quý MỚI lên trước, Quý CŨ hơn xuống dưới; trong cùng 1 Quý thì lần thay
  // đổi MỚI NHẤT lên trước.
  function renderQuarterStatusLogModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    function render(){
      const disp = computeInterestPaymentBoxDisplay(b); // chỉ ĐỌC, không đụng gì tới tính toán
      const allBoxes = disp.allBoxes;
      const boxOrderIndex = {}; allBoxes.forEach((bx,i)=> boxOrderIndex[bx.key]=i);
      const boxByKey = {}; allBoxes.forEach(bx=> boxByKey[bx.key]=bx);
      const logs = ((state.quarterStatusLog||{})[b.id]||[]).slice();
      // Với mỗi Quý ĐANG thật sự được coi là đã đóng lãi (theo tính toán hiện hành) mà KHÔNG tìm thấy
      // dòng log "đã đóng" nào là MỚI NHẤT cho đúng Quý đó — nghĩa là Quý này trở thành đã đóng lãi do
      // "tiền dư tự động trả cho Quý mới đến hạn theo thời gian" (không gắn với 1 hành động cụ thể nào
      // của người dùng nên không xác định được đúng thời điểm).
      // QUAN TRỌNG: LƯU VĨNH VIỄN dòng này vào lịch sử NGAY LẦN ĐẦU phát hiện ra (chỉ 1 lần duy nhất)
      // — dùng đúng thủ thuật "thời điểm mới nhất hiện có + 1 giây" để xác định đúng vị trí thời điểm
      // đó, rồi LƯU CỐ ĐỊNH mốc đó lại. Nhờ vậy, nếu SAU NÀY có thêm hành động MỚI xảy ra (đóng lãi,
      // trả lãi...) thì dòng "chưa rõ thời điểm" này vẫn nằm ĐÚNG VỊ TRÍ CŨ của nó trong dòng thời
      // gian — không bị "nhảy lên" đứng trên cả những sự kiện thật sự mới hơn diễn ra sau đó (đây
      // chính là lỗ hổng nếu tính toán lại mỗi lần thay vì lưu cố định 1 lần).
      const latestByKey = {};
      logs.forEach(l=>{ const cur=latestByKey[l.key]; if(!cur || (l.at||'')>(cur.at||'')) latestByKey[l.key]=l; });
      const needsEstimate = [];
      disp.paidKeys.forEach(key=>{
        const latest = latestByKey[key];
        if(!latest || latest.direction!=='paid'){
          const bx = boxByKey[key];
          if(bx) needsEstimate.push(bx);
        }
      });
      // Bảng này CHỈ ĐỂ XEM; việc ghi bù ở đây là thao tác nền, không phải do người dùng yêu cầu.
      // Ở môi trường tham quan thì không ghi được gì lên Firebase, nên bỏ qua hẳn thay vì gọi ghi
      // rồi nhận về một hộp thoại cảnh báo cho MỖI Quý cần ghi bù.
      if(needsEstimate.length && !wrap._estimatingInProgress && !isTourMode()){
        wrap._estimatingInProgress = true;
        // Có Quý mới cần ước tính thời điểm -> LƯU NGAY 1 LẦN (không lặp lại ở các lần vẽ sau, vì lúc
        // đó latestByKey[key] sẽ tìm thấy đúng bản ghi vừa lưu này rồi).
        needsEstimate.sort((x,y)=> (boxOrderIndex[x.key]||0)-(boxOrderIndex[y.key]||0));
        const latestRealAt = logs.reduce((max,l)=> (l.at||'') > max ? (l.at||'') : max, '');
        const baseTime = latestRealAt ? new Date(latestRealAt).getTime() : Date.now();
        (async()=>{
          for(let i=0;i<needsEstimate.length;i++){
            const overrideAt = new Date(baseTime + (i+1)*1000).toISOString();
            await pushQuarterStatusLog(b, needsEstimate[i], 'paid', null, overrideAt, true);
          }
          wrap._estimatingInProgress = false;
        })();
      }
      const allEntries = logs.slice();
      allEntries.sort((a,c)=> (c.at||'').localeCompare(a.at||'')); // Thời gian mới hơn lên trước, cũ hơn xuống dưới
      function rowHtml(l){
        const isPaid = l.direction==='paid';
        const color = isPaid? '#0d47a1' : '#b71c1c';
        const verb = isPaid? 'đã được đóng lãi thành công' : 'đã trở về trạng thái chưa đóng lãi';
        let timeLineHtml;
        if(l.estimated){
          timeLineHtml = `<div class="sub" style="margin-top:4px; color:#e65100;">Chưa rõ thời điểm cụ thể của trạng thái này, và đây là trạng thái mới hơn các trạng thái phía dưới (có thể do tiền dư tự động trả cho Quý mới đến hạn theo thời gian).</div>`;
        } else {
          const d = new Date(l.at);
          const dateLbl = isNaN(d.getTime())? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
          timeLineHtml = `${l.reason? `<div class="sub" style="margin-top:4px;">${escapeHtml(l.reason)}</div>` : ''}<div class="sub" style="margin-top:4px; text-align:right;">${dateLbl}</div>`;
        }
        return `<div style="border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:8px; background:#fff;">
          <div><b>${escapeHtml(l.label||'')}</b> <span style="color:${color}; font-weight:700;">${verb}</span></div>
          ${timeLineHtml}
        </div>`;
      }
      const scrollEl = wrap.querySelector('.modal-body');
      const prevScrollTop = scrollEl? scrollEl.scrollTop : 0;
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:700px;">
          <div class="modal-head"><h3>Lịch sử trạng thái đóng lãi của từng Quý — Hộ vay ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="qsl-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; overflow:auto;">
            <p class="sub" style="margin:0 0 12px;">Ghi lại mỗi lần Quý nào đó chuyển từ trạng thái "chưa đóng lãi" sang "đã đóng lãi" hoặc ngược lại — sắp xếp Trạng thái mới hơn lên trước, Trạng thái cũ hơn xuống dưới.</p>
            ${allEntries.length? allEntries.map(rowHtml).join('') : `<p class="sub" style="padding:10px 0;">Chưa có thay đổi trạng thái nào được ghi nhận.</p>`}
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="qsl-close2">Đóng bảng</button></div>
        </div>`;
      wrap.querySelector('#qsl-close').onclick = close;
      wrap.querySelector('#qsl-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const newScrollEl = wrap.querySelector('.modal-body');
      if(newScrollEl && prevScrollTop) newScrollEl.scrollTop = prevScrollTop;
    }
    wrap.dataset.qslModal = b.id;
    wrap._refreshQsl = render;
    render();
  }
  // Gọi lại mỗi khi state.quarterStatusLog (hoặc dữ liệu ảnh hưởng tới tính toán Quý) thay đổi qua
  // Firebase realtime — để bảng "Lịch sử trạng thái các quý" luôn cập nhật ngay lập tức, không cần
  // đóng mở lại.
  function refreshOpenQuarterStatusLogModal(){
    const w = document.querySelector('[data-qsl-modal]');
    if(w && w._refreshQsl) w._refreshQsl();
  }
  function renderQuarterBoxInfoModal(b, box, isPaid){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    const qName = formatTimelineQuarterLabel(box);
    const lvl = box.extLevel||0;
    const getPct = (field)=> lvl===0 ? getInTermColumnValue(b, field) : getExtensionLevelColumnValue(b, lvl, field);
    const centralPct = getPct('splitCentralPct'), provincePct = getPct('splitProvincePct'), wardPct = getPct('splitWardPct'), hamletPct = getPct('hamletAllocPct');
    const fmtPct = n=> String(n).replace('.',',');
    const statusWord = isPaid ? 'đã' : 'chưa';
    const lines = [];
    lines.push(`đây là ${qName} ${statusWord} đóng lãi`);
    lines.push(`Bắt đầu từ ngày ${fmtDate(box.from)} đến ngày ${fmtDate(box.to)}, tổng số ngày trong quý này là ${box.days} ngày.`);
    lines.push(`Số tiền ${statusWord} đóng trong quý này là: ${moneySpaced(box.interestAmount)}.`);
    lines.push(`Lãi suất đang được áp dụng trong quý này: ${fmtPct(box.rate)}%/năm${lvl>0? ` (lãi suất quá hạn lần ${lvl})` : ''}.`);
    if(box.short) lines.push(`Đây là quý KHÔNG đủ ngày như các quý bình thường khác (vì vậy nó có dấu * ở tên quý).`);
    if(lvl===0) lines.push(`Đây là quý đang trong thời gian chưa bị quá hạn.`);
    else lines.push(`Đây là quý đang trong thời gian gia hạn lần ${lvl} (vì vậy nó có ${'#'.repeat(lvl)} ở tên quý).`);
    wrap.innerHTML = `
      <div class="modal" style="max-width:94vw; width:520px;">
        <div class="modal-head"><h3>Thông tin chi tiết ${escapeHtml(qName)} của hộ vay ${escapeHtml(b.name)}</h3><button class="modal-close" id="qbi-close">✕</button></div>
        <div class="modal-body">
          ${lines.map(l=>`<p style="margin:0 0 8px;">${escapeHtml(l)}</p>`).join('')}
          <p style="margin:12px 0 4px; font-weight:700;">Thông tin phân bổ lãi suất (về Trung ương, cấp ${provinceLevelLabelLower()}, cấp ${adminLevelLabelLower()}) trong tổng số lãi suất ${fmtPct(box.rate)}%/năm và chia % của xã đối với cấp ${subAdminLabelLower()}:</p>
          <div class="kv-row"><span>Trung ương</span><b>${fmtPct(centralPct)}%/năm</b></div>
          <div class="kv-row"><span>Cấp ${provinceLevelLabelLower()}</span><b>${fmtPct(provincePct)}%/năm</b></div>
          <div class="kv-row"><span>Cấp ${adminLevelLabelLower()}</span><b>${fmtPct(wardPct)}%/năm</b></div>
          <div class="kv-row"><span>% tiền cấp ${adminLevelLabelLower()} phân bổ về cấp ${subAdminLabelLower()}</span><b>${fmtPct(hamletPct)}%</b></div>
        </div>
        <div class="modal-foot"><button class="btn btn-primary" id="qbi-close2">Đóng bảng</button></div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#qbi-close').onclick = close;
    wrap.querySelector('#qbi-close2').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
  }

  // Modal con "Đóng lãi" cho 1 người vay — mở từ nút "Đóng tiền lãi" ở từng dòng trong modal "Tính
  // tiền lãi và phê duyệt đóng lãi". 2 chế độ: 'select' (chọn các Quý muốn đóng) -> 'receipt' (biên
  // lai thu tiền lãi, xác nhận xong sẽ ghi vào Hộp tiền đóng lãi của người vay).
  function renderInterestPaymentApprovalModal(b, returnTo){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=>{ wrap.remove(); if(returnTo) returnTo(); };
    // "KHOÁ AN TOÀN" — chụp lại totalPaid NGAY LÚC MỞ bảng này (không đọc lại lúc sắp lưu, vì lúc đó
    // realtime binding có thể ĐÃ tự đồng bộ theo đúng thay đổi của người khác rồi, khiến so sánh luôn
    // khớp và không phát hiện được xung đột).
    const snapshotTotalPaidAtOpen = getInterestPaymentBoxRaw(b.id).totalPaid;
    let mode = 'select';
    let receiptOpenedAt = null;
    const selectedKeys = new Set();
    let receiptSurplus = 0, receiptShortfall = 0;
    let usePrevLeftover = false; // "Bổ sung: Tiền dư từ đợt trước" đang bật hay tắt
    let selectedCategoryId = '';
    let advInfoOpen = false;
    let autoLockedKey = null; // key của Quý (quá khứ+hiện tại) DUY NHẤT, tự chọn sẵn và không cho bỏ

    function renderBody(){
      if(mode==='select'){
        const disp = computeInterestPaymentBoxDisplay(b);
        const pastList = disp.unpaidLines; // đã cũ->mới
        const futureList = disp.futureUnpaidLines; // đã gần->xa
        // Nếu chỉ có đúng 1 Quý quá khứ+hiện tại -> tự động chọn sẵn, khoá không cho bỏ chọn.
        if(pastList.length===1){ autoLockedKey = pastList[0].box.key; selectedKeys.add(autoLockedKey); }
        else autoLockedKey = null;
        const pastSelectedCount = pastList.filter(x=>selectedKeys.has(x.box.key)).length;
        const futureUnlocked = pastList.length===0 || pastSelectedCount===pastList.length;
        const canSelectFuture = (idx)=> idx===0 || selectedKeys.has(futureList[idx-1].box.key);

        const renderPastGroup = ()=>{
          if(!pastList.length) return `<p class="sub">Không có Quý nào chưa đóng lãi từ quá khứ tới hiện tại.</p>`;
          const allSel = pastList.every(x=> selectedKeys.has(x.box.key));
          const showSelectAll = pastList.length>1;
          return `<div style="margin-top:6px;">
            ${pastList.map(x=>{
              const sel = selectedKeys.has(x.box.key);
              const locked = x.box.key===autoLockedKey;
              return `<span class="qbox-wrap">
                <button class="qbox-btn qbox-pulsing preview-allow ${sel?'qbox-selected':''}" data-qkey="${x.box.key}" data-group="past" ${locked?'disabled title="Quý duy nhất — luôn được chọn"':''}>${escapeHtml(x.name)}</button>
                <button class="qbox-info-btn qbox-pulsing preview-allow" data-qinfo="${x.box.key}">i</button>
              </span>`;
            }).join('')}
            ${showSelectAll? `<button class="qbox-selectall-btn preview-allow" data-selall="past">${allSel? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>` : ''}
          </div>`;
        };
        const renderFutureGroup = ()=>{
          if(!futureList.length) return `<p class="sub">Không có Quý nào chưa đóng lãi trong TƯƠNG LAI.</p>`;
          const allSel = futureList.every(x=> selectedKeys.has(x.box.key));
          return `<div style="margin-top:6px;">
            ${futureList.map((x,idx)=>{
              const sel = selectedKeys.has(x.box.key);
              const locked = !futureUnlocked;
              return `<span class="qbox-wrap">
                <button class="qbox-btn qbox-pulsing preview-allow ${sel?'qbox-selected':''} ${locked?'qbox-locked':''}" data-qkey="${x.box.key}" data-group="future" data-fidx="${idx}" ${locked?'style="opacity:.45;"':''}>${escapeHtml(x.name)}</button>
                <button class="qbox-info-btn qbox-pulsing preview-allow" data-qinfo="${x.box.key}">i</button>
              </span>`;
            }).join('')}
            <button class="qbox-selectall-btn preview-allow" data-selall="future" ${futureUnlocked?'':'disabled style="opacity:.45;"'}>${allSel? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>
          </div>`;
        };
        const selectedCount = selectedKeys.size;
        const selectedSum = pastList.concat(futureList).filter(x=>selectedKeys.has(x.box.key)).reduce((s,x)=>s+x.amount,0) - (usePrevLeftover? disp.leftover : 0);
        const canProceed = selectedCount>0 && selectedSum>=0;
        wrap.innerHTML = `
          <div class="modal" style="max-width:96vw; width:900px;">
            <div class="modal-head"><h3>Chọn quý hoặc nhập số tiền để tính tiền lãi cho hộ vay ${escapeHtml(b.name)}</h3><button class="modal-close preview-allow" id="iapay-close">✕</button></div>
            <div class="modal-body">
              <div class="divider-lbl" style="margin-top:0;">Các Quý chưa đóng lãi từ QUÁ KHỨ tới HIỆN TẠI:</div>
              ${renderPastGroup()}
              <div class="divider-lbl">Các Quý chưa đóng lãi trong TƯƠNG LAI:</div>
              ${renderFutureGroup()}
              ${disp.leftover>0? `
              <div style="margin-top:14px; display:flex; align-items:center; gap:6px;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" id="iapay-prevleftover" class="preview-allow" ${usePrevLeftover?'checked':''}>
                  <span>Bổ sung thêm: số tiền dư từ đợt trước ${moneySpaced(disp.leftover)} (Trừ vào biên lai)</span>
                </label>
                <button type="button" class="qbox-info-btn preview-allow" id="iapay-prevleftover-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button>
              </div>
              <div id="iapay-prevleftover-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin-top:6px; max-width:600px;">"Số tiền dư từ đợt trước" chính là "Số tiền còn dư chưa thuộc về quý nào" trong "Thông tin đóng lãi" của hộ vay tương ứng, tiền dư của hộ nào sẽ được tính vào đúng biên lai của hộ đó (kể cả khi lập biên lai chung).</div>` : ''}
              <div style="margin-top:16px; text-align:center;"><button class="btn btn-ghost btn-pulse-green preview-allow" id="iapay-money-mode">Hoặc đóng lãi bằng cách nhập số tiền cụ thể</button></div>
              <div class="divider-lbl">Các Quý đã đóng lãi XONG:</div>
              ${disp.paidLines.length? `<div style="margin-top:6px;">${disp.paidLines.map(x=>`<span class="qbox-wrap">
                <button class="qbox-btn" disabled style="opacity:.65; cursor:default;">${escapeHtml(x.name)}</button>
                <button class="qbox-info-btn preview-allow" data-qinfo-paid="${x.box.key}">i</button>
              </span>`).join('')}</div>` : `<p class="sub">Chưa có quý nào đóng lãi xong.</p>`}
            </div>
            <div class="modal-foot" style="justify-content:space-between;">
              <button class="btn btn-ghost preview-allow" id="iapay-cancel">Đóng bảng</button>
              <div style="display:flex; align-items:center; gap:12px;">
                ${canProceed? `<span class="sub" style="font-weight:700; color:var(--rice-dark);">Tổng ${groupDigitsRight(String(selectedSum),3)} đồng (trong ${selectedCount}-quý được chọn${usePrevLeftover?' - tiền dư':''})</span>` : ''}
                <button class="btn btn-primary preview-allow" id="iapay-start" ${canProceed?'':'disabled'}>Bắt đầu tính tiền và lập biên lai</button>
              </div>
            </div>
          </div>`;
        wireSelect(pastList, futureList, futureUnlocked, canSelectFuture);
        // Rê chuột vào nút "Bắt đầu tính tiền và lập biên lai" -> tự cuộn xuống cuối bảng.
        const iapayStartBtn = wrap.querySelector('#iapay-start');
        if(iapayStartBtn) iapayStartBtn.addEventListener('mouseenter', ()=>{
          const body = wrap.querySelector('.modal-body');
          if(body) body.scrollTo({ top: body.scrollHeight, behavior:'smooth' });
        });
        // Hiệu ứng nhấp nháy phóng to 1.1x liên tục trong 3 giây rồi tự dừng hẳn.
        setTimeout(()=>{ wrap.querySelectorAll('.qbox-pulsing').forEach(el=>el.classList.remove('qbox-pulsing')); }, 3000);
      } else {
        const disp = computeInterestPaymentBoxDisplay(b);
        const allBoxByKey = {}; disp.allBoxes.forEach(bx=> allBoxByKey[bx.key]=bx);
        const chosen = [...selectedKeys].map(k=>allBoxByKey[k]).filter(Boolean);
        const chosenSum = chosen.reduce((s,bx)=>s+bx.interestAmount, 0);
        const leftoverPrev = disp.leftover; // "Số tiền còn dư chưa thuộc về quý nào" hiện có của hộ vay này
        const rawTotal = chosenSum + receiptSurplus - receiptShortfall;
        const grandTotal = usePrevLeftover ? (rawTotal - leftoverPrev) : rawTotal; // "Tổng tất cả (số tiền thực nhận)"
        const finalAmount = grandTotal + leftoverPrev; // "Số tiền cuối cùng" — luôn = rawTotal, dùng để so sánh + xét duyệt Quý
        wrap.innerHTML = `
          <div class="modal" style="max-width:96vw; width:640px;">
            <div class="modal-head receipt-head-payment"><h3>BIÊN LAI THU TIỀN LÃI ĐỐI VỚI HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="rcpt-close">✕</button></div>
            <div class="modal-body">
              <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
              <p style="margin:0 0 6px; font-weight:700;">Các quý đóng lãi là:</p>
              ${chosen.map(bx=>`<div class="kv-row"><span>${escapeHtml(formatTimelineQuarterLabel(bx))}</span><b>${moneySpaced(bx.interestAmount)}</b></div>`).join('')}
              <div class="kv-row" style="border-top:1px solid var(--line); margin-top:6px; padding-top:6px;"><span>Tổng tiền các quý</span><b>= ${moneySpaced(chosenSum)}</b></div>
              <div class="kv-row" style="margin-top:10px;"><span>Số tiền đóng dư</span><b id="rcpt-surplus-disp">+ ${moneySpaced(receiptSurplus)}</b></div>
              <div class="rcpt-reset-wrap"><input id="rcpt-surplus" class="preview-allow" style="text-align:center;" placeholder="sửa" value=""><button type="button" class="rcpt-reset-btn preview-allow" id="rcpt-surplus-reset">↺</button><div class="rcpt-reset-tip">trở về trạng thái trống ban đầu</div></div>
              <div class="kv-row" style="margin-top:6px;"><span>Số tiền đóng thiếu</span><b id="rcpt-shortfall-disp">- ${moneySpaced(receiptShortfall)}</b></div>
              <div class="rcpt-reset-wrap"><input id="rcpt-shortfall" class="preview-allow" style="text-align:center;" placeholder="sửa" value=""><button type="button" class="rcpt-reset-btn preview-allow" id="rcpt-shortfall-reset">↺</button><div class="rcpt-reset-tip">trở về trạng thái trống ban đầu</div></div>
              <div style="display:flex; align-items:center; gap:4px; margin-top:10px;">
                <button type="button" class="btn btn-sm preview-allow" id="rcpt-prevleftover-toggle" style="${usePrevLeftover? 'background:#fb8c00; color:#fff;' : 'background:#1976d2; color:#fff;'}">${usePrevLeftover? 'Tắt bổ sung: Tiền dư đợt trước' : 'Bổ sung: Tiền dư từ đợt trước'}</button>
                <button type="button" class="qbox-info-btn" id="rcpt-prevleftover-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button>
              </div>
              <div id="rcpt-prevleftover-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:4px 0;">"Số tiền dư từ đợt trước" chính là "Số tiền còn dư chưa thuộc về quý nào" trong "Thông tin đóng lãi" của hộ vay tương ứng, tiền dư của hộ nào sẽ được tính vào đúng biên lai của hộ đó (kể cả khi lập biên lai chung).</div>
              ${usePrevLeftover? `<div class="kv-row" style="margin-top:4px;"><span>Tiền dư đợt trước (trừ vào biên lai)</span><b>- ${moneySpaced(leftoverPrev)}</b></div>` : ''}
              <div class="kv-row big-money-row" style="margin-top:10px;">
                <span style="display:flex; align-items:center; gap:4px;">Tổng tất cả (số tiền thực nhận) <button type="button" class="qbox-info-btn" id="rcpt-total-info" style="width:20px; height:20px; font-size:11px; border-radius:50%; vertical-align:middle;">i</button></span>
                <b id="rcpt-total-disp">= ${moneySpaced(grandTotal)}</b>
              </div>
              <div id="rcpt-total-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:4px 0;">Đây là số tiền nhận được thực tế từ người đóng lãi</div>
              <div class="rcpt-reset-wrap"><input id="rcpt-grandtotal" class="preview-allow" style="text-align:center;" placeholder="sửa" value=""><button type="button" class="rcpt-reset-btn preview-allow" id="rcpt-grandtotal-reset">↺</button><div class="rcpt-reset-tip">trở về trạng thái trống ban đầu</div></div>
              <p class="sub" id="rcpt-explain" style="margin-top:6px;">${escapeHtml(buildReceiptExplanation(computeReceiptSettlementPreview(b, chosen, finalAmount, disp), chosenSum, finalAmount))}</p>
              <p class="sub" id="rcpt-error" style="color:var(--red); font-weight:700; display:none; margin-top:6px;"></p>
              ${receiptPayerFieldsHtml(b)}
              ${receiptCategoryFieldHtml('payment','rcpt', selectedCategoryId)}
              <div id="rcpt-advinfo"></div>
            </div>
            <div class="modal-foot" style="justify-content:space-between;">
              <div style="display:flex; gap:8px;">
                <button class="btn btn-ghost preview-allow" id="rcpt-back">Quay lại</button>
              </div>
              <div style="display:flex; gap:8px;">
                ${sendPaymentLinkBtnHtml('rcpt')}
                <button class="btn btn-primary preview-allow" id="rcpt-confirm">Xác nhận đóng lãi thành công</button>
              </div>
            </div>
          </div>`;
        wireReceipt(chosen, chosenSum, leftoverPrev);
      }
    }

    function wireSelect(pastList, futureList, futureUnlocked, canSelectFuture){
      wrap.querySelector('#iapay-close').onclick = close;
      wrap.querySelector('#iapay-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const fullList = pastList.concat(futureList);
      const clearAllFuture = ()=>{ futureList.forEach(x=> selectedKeys.delete(x.box.key)); };
      wrap.querySelectorAll('[data-qkey]').forEach(btn=>{
        if(btn.disabled) return;
        btn.onclick = ()=>{
          const k = btn.dataset.qkey;
          const grp = btn.dataset.group;
          if(grp==='future'){
            if(!futureUnlocked){ alert('Phải chọn HẾT các Quý ở phần "QUÁ KHỨ tới HIỆN TẠI" trước khi chọn Quý tương lai (trừ khi không còn Quý nào ở phần đó).'); return; }
            const idx = parseInt(btn.dataset.fidx,10);
            const alreadySel = selectedKeys.has(k);
            if(!alreadySel){
              if(!canSelectFuture(idx)){ alert('Chỉ được chọn Quý tương lai theo đúng thứ tự — vui lòng chọn Quý tương lai GẦN NHẤT trước.'); return; }
              selectedKeys.add(k);
            } else {
              // Bỏ chọn 1 Quý tương lai gần -> tự động bỏ chọn luôn TẤT CẢ Quý tương lai xa hơn nó
              // (không cần báo lỗi, cứ tự làm cho đúng logic).
              selectedKeys.delete(k);
              for(let j=idx+1;j<futureList.length;j++) selectedKeys.delete(futureList[j].box.key);
            }
          } else {
            if(selectedKeys.has(k)){
              selectedKeys.delete(k);
              // Bỏ chọn 1 Quý "quá khứ+hiện tại" khi trước đó đã chọn hết -> mất điều kiện mở khoá
              // tương lai -> xoá sạch mọi lựa chọn tương lai đang có.
              clearAllFuture();
            } else {
              selectedKeys.add(k);
            }
          }
          renderBody();
        };
      });
      wrap.querySelectorAll('[data-qinfo]').forEach(btn=>{
        btn.onclick = (e)=>{
          e.stopPropagation();
          const bx = fullList.find(x=>x.box.key===btn.dataset.qinfo);
          if(bx) renderQuarterBoxInfoModal(b, bx.box);
        };
      });
      wrap.querySelectorAll('[data-qinfo-paid]').forEach(btn=>{
        btn.onclick = (e)=>{
          e.stopPropagation();
          const dispNow = computeInterestPaymentBoxDisplay(b);
          const x = dispNow.paidLines.find(x=>x.box.key===btn.dataset.qinfoPaid);
          if(x) renderQuarterBoxInfoModal(b, x.box, true);
        };
      });
      const prevLeftoverCb = wrap.querySelector('#iapay-prevleftover');
      if(prevLeftoverCb) prevLeftoverCb.onclick = ()=>{ usePrevLeftover = prevLeftoverCb.checked; renderBody(); };
      const prevLeftoverInfoBtn = wrap.querySelector('#iapay-prevleftover-info');
      const prevLeftoverTip = wrap.querySelector('#iapay-prevleftover-tip');
      if(prevLeftoverInfoBtn) prevLeftoverInfoBtn.onclick = (e)=>{ e.stopPropagation(); prevLeftoverTip.style.display = prevLeftoverTip.style.display==='none'?'block':'none'; };
      const pastSelAllBtn = wrap.querySelector('[data-selall="past"]');
      if(pastSelAllBtn) pastSelAllBtn.onclick = ()=>{
        const allSel = pastList.every(x=> selectedKeys.has(x.box.key));
        pastList.forEach(x=>{ if(x.box.key===autoLockedKey) return; if(allSel) selectedKeys.delete(x.box.key); else selectedKeys.add(x.box.key); });
        if(allSel) clearAllFuture(); // vừa bỏ chọn tất cả quá khứ+hiện tại -> mất điều kiện mở khoá tương lai
        renderBody();
      };
      const futureSelAllBtn = wrap.querySelector('[data-selall="future"]');
      if(futureSelAllBtn && !futureSelAllBtn.disabled) futureSelAllBtn.onclick = ()=>{
        const allSel = futureList.every(x=> selectedKeys.has(x.box.key));
        if(allSel) clearAllFuture();
        else futureList.forEach(x=> selectedKeys.add(x.box.key)); // chọn tất cả luôn hợp lệ về thứ tự vì chọn liên tục từ đầu
        renderBody();
      };
      const startBtn = wrap.querySelector('#iapay-start');
      if(startBtn) startBtn.onclick = ()=>{ if(!selectedKeys.size) return; mode='receipt'; receiptOpenedAt = Date.now(); renderBody(); };
      const moneyModeBtn = wrap.querySelector('#iapay-money-mode');
      if(moneyModeBtn) moneyModeBtn.onclick = ()=>{ close(); renderMoneyBasedReceiptModal(b); };
    }

    function wireReceipt(chosen, chosenSum, leftoverPrev){
      wrap.querySelector('#rcpt-close').onclick = close;
      const backBtn = wrap.querySelector('#rcpt-back');
      wireReceiptCategoryField(wrap, 'payment', 'rcpt', renderBody, (id)=>{ selectedCategoryId = id; });
      wireAdvancedInfo(wrap, 'rcpt');
      if(backBtn) backBtn.onclick = ()=>{ mode='select'; renderBody(); };
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const surplusInput = wrap.querySelector('#rcpt-surplus');
      const shortfallInput = wrap.querySelector('#rcpt-shortfall');
      const totalInput = wrap.querySelector('#rcpt-grandtotal');
      const errorEl = wrap.querySelector('#rcpt-error');
      const confirmBtn = wrap.querySelector('#rcpt-confirm');
      wireSendPaymentLinkBtn(wrap, 'rcpt', ()=>{
        const finalAmount = currentFinalAmount();
        const dispNow = computeInterestPaymentBoxDisplay(b);
        const result = computeReceiptSettlementPreview(b, chosen, finalAmount, dispNow);
        const quarterLines = result.paidQuarters.concat(result.extraPaidQuarters).map(bx=>({ key:bx.key, qk:bx.qk, year:bx.year, amount:bx.interestAmount }));
        const payerName = (wrap.querySelector('#rcpt-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#rcpt-collector').value||'').trim();
        return { title:'BL Thu tiền lãi (theo cách tính Quý)', amount: currentGrandTotal(), borrowerNames:[b.name], borrowerIds:[b.id], contentEl: wrap.querySelector('.modal-body'),
          replay: { applyFn:'interest', borrowerId:b.id, amount: currentGrandTotal(), quarterLines, payerName, collectorName, categoryLabelId: selectedCategoryId||null, receiptCategoryKey:'interest_quarter' } };
      }, async ()=>{
        if(!checkTotalValid()) return false;
        if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return false;
        return true;
      });
      const maxAllowed = computeInterestPaymentBoxDisplay(b).unpaidTotal + computeInterestPaymentBoxDisplay(b).futureUnpaidTotal;
      const setError = (msg)=>{
        if(errorEl){ errorEl.textContent = msg||''; errorEl.style.display = msg? 'block' : 'none'; }
        if(confirmBtn){ confirmBtn.disabled = !!msg; if(!confirmBtn.disabled && receiptOpenedAt) delayEnableConfirmBtn(confirmBtn, receiptOpenedAt); }
      };
      // "Tổng tất cả (số tiền thực nhận)" — có trừ tiền dư đợt trước nếu đang bật bổ sung.
      const currentGrandTotal = ()=>{
        const rawTotal = chosenSum + receiptSurplus - receiptShortfall;
        return usePrevLeftover ? (rawTotal - leftoverPrev) : rawTotal;
      };
      // "Số tiền cuối cùng" — luôn cộng lại đúng tiền dư đợt trước (bất kể có bật bổ sung hay
      // không) — đây mới là con số dùng để so sánh + xét duyệt Quý nào được tính là đã đóng xong.
      const currentFinalAmount = ()=> currentGrandTotal() + leftoverPrev;
      const checkTotalValid = ()=>{
        const t = currentFinalAmount();
        if(t<=0){ setError('Số tiền cuối cùng đang bị âm hoặc bằng 0 — vui lòng kiểm tra lại số tiền đóng thiếu, không thể lưu.'); return false; }
        if(t > maxAllowed){ setError('Tổng Số tiền này lớn hơn so với Tổng tiền chưa đóng lãi của hộ vay, vui lòng điều chỉnh lại'); return false; }
        setError(''); return true;
      };
      const updateExplanation = ()=>{
        const explainEl = wrap.querySelector('#rcpt-explain');
        if(!explainEl) return;
        const dispNow = computeInterestPaymentBoxDisplay(b);
        const result = computeReceiptSettlementPreview(b, chosen, currentFinalAmount(), dispNow);
        explainEl.textContent = buildReceiptExplanation(result, chosenSum, currentFinalAmount());
        const advEl = wrap.querySelector('#rcpt-advinfo');
        if(advEl) advEl.innerHTML = advancedInfoHtml(b, result.paidQuarters.concat(result.extraPaidQuarters), 'rcpt', advInfoOpen);
        wireAdvancedInfo(wrap, 'rcpt', (open)=>{ advInfoOpen = open; });
      };
      const surplusDisp = wrap.querySelector('#rcpt-surplus-disp');
      const shortfallDisp = wrap.querySelector('#rcpt-shortfall-disp');
      const totalDisp = wrap.querySelector('#rcpt-total-disp');
      const refreshDisplays = ()=>{
        if(surplusDisp) surplusDisp.textContent = `+ ${moneySpaced(receiptSurplus)}`;
        if(shortfallDisp) shortfallDisp.textContent = `- ${moneySpaced(receiptShortfall)}`;
        if(totalDisp) totalDisp.textContent = `= ${moneySpaced(currentGrandTotal())}`;
        updateExplanation();
        checkTotalValid();
      };
      // ---- Ô nhập chỉ chứa SỐ THUẦN (không dấu +/-/=, không chữ "đ", KHÔNG tự chèn dấu cách nhóm 3
      // số ngay trong lúc gõ — đây chính là nguyên nhân gốc gây lệch con trỏ khi gõ nhiều chữ số).
      // Mỗi lần gõ (sự kiện "input") đều LẬP TỨC tính toán lại và cập nhật cả 3 dòng hiển thị kết
      // quả + dòng giải thích + tính hợp lệ — không cần đợi rời khỏi ô nữa ("nhảy múa" theo thời gian thực).
      // Bấm vào BẤT KỲ ô nào trong 3 ô -> 2 ô còn lại LUÔN về trắng (bất kể đang có số gì).
      surplusInput.addEventListener('focus', ()=>{ shortfallInput.value=''; totalInput.value=''; });
      shortfallInput.addEventListener('focus', ()=>{ surplusInput.value=''; totalInput.value=''; });
      totalInput.addEventListener('focus', ()=>{ surplusInput.value=''; shortfallInput.value=''; });
      surplusInput.addEventListener('input', ()=>{
        surplusInput.value = surplusInput.value.replace(/[^\d]/g,'').slice(0,10);
        receiptSurplus = parseInt(surplusInput.value,10)||0;
        if(receiptSurplus>0) receiptShortfall = 0;
        refreshDisplays();
      });
      shortfallInput.addEventListener('input', ()=>{
        shortfallInput.value = shortfallInput.value.replace(/[^\d]/g,'').slice(0,10);
        receiptShortfall = parseInt(shortfallInput.value,10)||0;
        if(receiptShortfall>0) receiptSurplus = 0;
        refreshDisplays();
      });
      totalInput.addEventListener('input', ()=>{
        totalInput.value = totalInput.value.replace(/[^\d]/g,'').slice(0,12);
        const newGrandTotal = parseInt(totalInput.value,10)||0;
        const newRawTotal = usePrevLeftover ? (newGrandTotal + leftoverPrev) : newGrandTotal;
        const diff = newRawTotal - chosenSum;
        if(diff>0){ receiptSurplus = diff; receiptShortfall = 0; }
        else if(diff<0){ receiptShortfall = -diff; receiptSurplus = 0; }
        else { receiptSurplus = 0; receiptShortfall = 0; }
        refreshDisplays();
      });
      [surplusInput, shortfallInput, totalInput].forEach(inp=>{
        inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); inp.blur(); } });
      });

      // Nút chữ "i" cạnh "Tổng tất cả (số tiền thực nhận)"
      const totalInfoBtn = wrap.querySelector('#rcpt-total-info');
      const totalTip = wrap.querySelector('#rcpt-total-tip');
      if(totalInfoBtn) totalInfoBtn.onclick = (e)=>{ e.stopPropagation(); totalTip.style.display = totalTip.style.display==='none' ? 'block' : 'none'; };
      // Nút chữ "i" cạnh "Bổ sung: Tiền dư từ đợt trước"
      const prevInfoBtn = wrap.querySelector('#rcpt-prevleftover-info');
      const prevTip = wrap.querySelector('#rcpt-prevleftover-tip');
      if(prevInfoBtn) prevInfoBtn.onclick = (e)=>{ e.stopPropagation(); prevTip.style.display = prevTip.style.display==='none' ? 'block' : 'none'; };
      if(!wrap._tipCloserBound){
        wrap._tipCloserBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap)) return;
          const tt = wrap.querySelector('#rcpt-total-tip');
          const pt = wrap.querySelector('#rcpt-prevleftover-tip');
          if(tt && tt.style.display!=='none' && !e.target.closest('#rcpt-total-info') && !e.target.closest('#rcpt-total-tip')) tt.style.display='none';
          if(pt && pt.style.display!=='none' && !e.target.closest('#rcpt-prevleftover-info') && !e.target.closest('#rcpt-prevleftover-tip')) pt.style.display='none';
        });
      }
      // Nút "Bổ sung: Tiền dư từ đợt trước" / "Tắt bổ sung: Tiền dư đợt trước"
      const prevToggleBtn = wrap.querySelector('#rcpt-prevleftover-toggle');
      if(prevToggleBtn) prevToggleBtn.onclick = ()=>{ usePrevLeftover = !usePrevLeftover; renderBody(); };

      // ---- 3 nút reset (↺) — đưa đúng số liệu tương ứng về lại trạng thái trống/0 ban đầu.
      const surplusResetBtn = wrap.querySelector('#rcpt-surplus-reset');
      if(surplusResetBtn) surplusResetBtn.onclick = ()=>{ receiptSurplus = 0; surplusInput.value = ''; refreshDisplays(); };
      const shortfallResetBtn = wrap.querySelector('#rcpt-shortfall-reset');
      if(shortfallResetBtn) shortfallResetBtn.onclick = ()=>{ receiptShortfall = 0; shortfallInput.value = ''; refreshDisplays(); };
      const totalResetBtn = wrap.querySelector('#rcpt-grandtotal-reset');
      if(totalResetBtn) totalResetBtn.onclick = ()=>{ receiptSurplus = 0; receiptShortfall = 0; totalInput.value = ''; refreshDisplays(); };

      // Rê chuột vào nút "Xác nhận đóng lãi thành công" -> tự cuộn xuống cuối bảng để thấy hết
      // thông tin phía dưới trước khi bấm.
      if(confirmBtn) confirmBtn.addEventListener('mouseenter', ()=>{
        if(confirmBtn.dataset.locked==='1') return;
        const body = wrap.querySelector('.modal-body');
        if(body) body.scrollTo({ top: body.scrollHeight, behavior:'smooth' });
      });

      updateExplanation();
      checkTotalValid();
      wrap.querySelector('#rcpt-confirm').onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận đóng lãi thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn nên không thể xác nhận đóng lãi. Vui lòng liên hệ Chủ mã định danh.'); return; }
        if(!checkTotalValid()) return;
        const payerName = (wrap.querySelector('#rcpt-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#rcpt-collector').value||'').trim();
        if(!payerName || !collectorName){ alert('Vui lòng điền đầy đủ "Người đóng tiền" và "Người thu tiền" trước khi xác nhận.'); return; }
        if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return;
        if(!(await assertNoUnpaidReceiptLock(b.id, b.name))) return;
        close(); // Bước 1: đóng ngay bảng đang thao tác
        showProcessingToast(); // Bước 2: hiện thông báo "Hệ thống đang xử lý..."
        const raw = getInterestPaymentBoxRaw(b.id);
        const payments = Object.assign({}, raw.payments||{});
        const grandTotal = currentGrandTotal();   // tiền THỰC SỰ mới thu hôm nay (đã trừ tiền dư đợt trước nếu có dùng)
        const finalAmount = currentFinalAmount();  // tổng ngân sách để xét duyệt Quý (gồm cả tiền dư đợt trước)
        // Ghi nhận ĐÚNG theo đúng dòng "giải thích" đang hiện — chỉ đánh dấu đã đóng cho những Quý
        // thật sự đủ tiền trả (paidQuarters), cộng thêm những Quý khác được trả nhờ số dư
        // (extraPaidQuarters) — KHÔNG đánh dấu mù toàn bộ các Quý đã chọn.
        const dispNow = computeInterestPaymentBoxDisplay(b);
        const result = computeReceiptSettlementPreview(b, chosen, finalAmount, dispNow);
        result.paidQuarters.forEach(bx=>{ payments[bx.key] = bx.interestAmount; });
        result.extraPaidQuarters.forEach(bx=>{ payments[bx.key] = bx.interestAmount; });
        // CHỈ cộng đúng phần tiền MỚI thu hôm nay vào tổng — phần tiền dư đợt trước đã có sẵn
        // trong "totalPaid" từ trước rồi, dùng lại để xét duyệt Quý chứ không cộng thêm lần nữa.
        const newTotalPaid = (raw.totalPaid||0) + grandTotal;
        await cSet('interestPaymentBoxes/'+b.id, { totalPaid: newTotalPaid, payments });
        state.interestPaymentBoxes = state.interestPaymentBoxes||{};
        state.interestPaymentBoxes[b.id] = { totalPaid:newTotalPaid, payments };
        await settleInterestPaymentLeftover(b);
        {
          const dispAfter = computeInterestPaymentBoxDisplay(b);
          await logQuarterStatusDiff(b, dispNow, dispAfter,
            `Đã được đóng lãi thành công bởi Biên lai thu tiền lãi (theo cách tính quý) lập ngày ${fmtDate(todayStr())}`,
            `Đã trở về trạng thái chưa đóng lãi do thay đổi thông tin liên quan tới khoản vay`);
        }
        await pushReceiptRecord(b, 'interest_quarter', {
          amount: grandTotal, sign:'+',
          quarterLines: result.paidQuarters.concat(result.extraPaidQuarters).map(bx=>({ qk:bx.qk, year:bx.year, amount:bx.interestAmount })),
          categoryLabelId: selectedCategoryId||null, extra: { payerName, collectorName, explanation: buildReceiptExplanation(result, chosenSum, finalAmount) },
        });
        await pushLog('xác nhận', `đóng lãi cho hộ vay ${b.name} (${moneySpaced(finalAmount)})`);
        refreshOpenIAModal();
        hideProcessingToast(); // Bước 4: tắt thông báo đang xử lý
        showBigToast(`Phê duyệt thành công: hộ vay ${b.name} đóng xong tiền lãi là ${groupDigitsRight(String(Math.round(finalAmount)),3)}đ`);
      };
    }

    renderBody();
  }

