  // =====================================================================
  // "BIÊN LAI THEO CÁCH TÍNH TIỀN" — khác với biên lai theo cách tính Quý (chọn Quý trước, tính
  // tiền sau), ở đây người dùng nhập số tiền TRƯỚC, hệ thống tự động xác định Quý nào được trả.
  // =====================================================================
  function renderMoneyBasedReceiptModal(b, goBackOverride, onSuccessExtra){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const openedAt = Date.now();
    const close = ()=> wrap.remove();
    const goBack = goBackOverride || (()=>{ close(); renderInterestPaymentApprovalModal(b); });
    // Khi mở từ luồng "Không thể tất toán khoản vay" (bỏ chọn "Không thể trả luôn cả tiền lãi") — số
    // tiền thực nhận PHẢI đúng bằng số tiền lãi đang chưa đóng, không cho sửa.
    const lockedAmount = onSuccessExtra ? computeInterestPaymentBoxDisplay(b).unpaidTotal : null;
    let receiptSurplus = 0, receiptShortfall = 0;
    let usePrevLeftover = false;
    let advInfoOpen = false;
    let selectedCategoryId = '';
    let lastFinalAmountForPayment = 0;

    // ---- KHUNG VỎ (chứa ô nhập "Tổng tất cả") — CHỈ dựng đúng 1 lần khi mở modal, hoặc khi bấm nút
    // reset/bổ sung tiền dư (không dựng lại khi đang gõ) — để tuyệt đối không đụng vào input đang
    // gõ dở (đây chính là nguyên nhân lỗi trước đó: gọi vẽ lại toàn bộ modal ngay trong sự kiện
    // "input" làm input bị thay bằng 1 phần tử MỚI hoàn toàn, mất focus/con trỏ ngay lập tức).
    function renderShell(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head receipt-head-payment"><h3>BIÊN LAI THU TIỀN LÃI ĐỐI VỚI HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="mrcpt-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Biên lai này được lập vào ngày ${fmtDate(todayStr())}</p>
            <div class="kv-row big-money-row" style="margin-top:0;">
              <span style="display:flex; align-items:center; gap:4px;">Tổng tất cả (số tiền thực nhận) <button type="button" class="qbox-info-btn" id="mrcpt-total-info" style="width:20px; height:20px; font-size:11px; border-radius:50%; vertical-align:middle;">i</button></span>
              <b id="mrcpt-total-disp"></b>
            </div>
            <div id="mrcpt-total-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:4px 0;">Đây là số tiền nhận được thực tế từ người đóng lãi</div>
            <div class="rcpt-reset-wrap"><input id="mrcpt-total" class="preview-allow" style="text-align:center;" placeholder="sửa" value="${lockedAmount!=null? moneySpaced(lockedAmount) : ''}" ${lockedAmount!=null?'disabled':''}>${lockedAmount==null? `<button type="button" class="rcpt-reset-btn preview-allow" id="mrcpt-total-reset">↺</button><div class="rcpt-reset-tip">trở về trạng thái trống ban đầu</div>` : ''}</div>
            ${lockedAmount!=null? `<p class="sub" style="margin:-4px 0 10px; color:#b71c1c;">Số tiền này là đúng số tiền lãi hộ vay đang chưa đóng (theo Lịch sử Nợ rủi ro) — KHÔNG thể chỉnh sửa.</p>` : ''}
            <div style="display:flex; align-items:center; gap:4px; margin-top:10px;">
              <button type="button" class="btn btn-sm preview-allow" id="mrcpt-prevleftover-toggle"></button>
              <button type="button" class="qbox-info-btn" id="mrcpt-prevleftover-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button>
            </div>
            <div id="mrcpt-prevleftover-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:4px 0;">"Số tiền dư từ đợt trước" chính là "Số tiền còn dư chưa thuộc về quý nào" trong "Thông tin đóng lãi" của hộ vay tương ứng, tiền dư của hộ nào sẽ được tính vào đúng biên lai của hộ đó (kể cả khi lập biên lai chung).</div>
            <div id="mrcpt-prevleftover-line"></div>
            <div id="mrcpt-results"></div>
            ${receiptPayerFieldsHtml(b)}
            ${receiptCategoryFieldHtml('payment','mrcpt', selectedCategoryId)}
            <div id="mrcpt-advinfo"></div>
          </div>
          <div class="modal-foot" style="justify-content:space-between;">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-ghost preview-allow" id="mrcpt-back">Quay lại</button>
            </div>
            <div style="display:flex; gap:8px;">
              ${sendPaymentLinkBtnHtml('mrcpt')}
              <button class="btn btn-primary preview-allow" id="mrcpt-confirm">Xác nhận đóng lãi thành công</button>
            </div>
          </div>
        </div>`;
      wireShell();
      updateResults();
    }

    // ---- Cập nhật KẾT QUẢ — gọi liên tục mỗi lần gõ (mỗi keystroke), CHỈ đụng tới các phần tử hiển
    // thị kết quả (#mrcpt-results, #mrcpt-total-disp, nút xác nhận...), TUYỆT ĐỐI không đụng tới ô
    // input đang gõ.
    let lastSettlement = null, lastGrandTotal = 0, lastFinalAmount = 0, lastMaxAllowed = 0;
    function updateResults(){
      const disp = computeInterestPaymentBoxDisplay(b);
      const leftoverPrev = disp.leftover;
      const rawTotal = receiptSurplus - receiptShortfall;
      const grandTotal = usePrevLeftover ? (rawTotal - leftoverPrev) : rawTotal;
      const finalAmount = grandTotal + leftoverPrev; // luôn = rawTotal
      lastFinalAmountForPayment = finalAmount;
      const settlement = computeMoneyBasedSettlement(finalAmount, disp);
      const chosenSum = settlement.paidQuarters.reduce((s,bx)=>s+bx.interestAmount,0);
      const maxAllowed = disp.unpaidTotal + disp.futureUnpaidTotal;
      lastSettlement = settlement; lastGrandTotal = grandTotal; lastFinalAmount = finalAmount; lastMaxAllowed = maxAllowed;

      const totalDisp = wrap.querySelector('#mrcpt-total-disp');
      if(totalDisp) totalDisp.textContent = `= ${moneySpaced(grandTotal)}`;
      const toggleBtn = wrap.querySelector('#mrcpt-prevleftover-toggle');
      if(toggleBtn){
        toggleBtn.textContent = usePrevLeftover? 'Tắt bổ sung: Tiền dư đợt trước' : 'Bổ sung: Tiền dư từ đợt trước';
        toggleBtn.style.background = usePrevLeftover? '#fb8c00' : '#1976d2';
        toggleBtn.style.color = '#fff';
      }
      const prevLine = wrap.querySelector('#mrcpt-prevleftover-line');
      if(prevLine) prevLine.innerHTML = usePrevLeftover? `<div class="kv-row" style="margin-top:4px;"><span>Tiền dư đợt trước (trừ vào biên lai)</span><b>- ${moneySpaced(leftoverPrev)}</b></div>` : '';
      const resultsEl = wrap.querySelector('#mrcpt-results');
      if(resultsEl) resultsEl.innerHTML = `
            <p style="margin:14px 0 6px; font-weight:700;">Các quý đóng lãi là:</p>
            ${settlement.paidQuarters.length? settlement.paidQuarters.map(bx=>`<div class="kv-row"><span>${escapeHtml(formatTimelineQuarterLabel(bx))}</span><b>${moneySpaced(bx.interestAmount)}</b></div>`).join('') : `<p class="sub">Chưa có Quý nào được trả (số tiền chưa đủ).</p>`}
            <div class="kv-row" style="border-top:1px solid var(--line); margin-top:6px; padding-top:6px;"><span>Tổng tiền các quý</span><b>= ${moneySpaced(chosenSum)}</b></div>
            <div class="kv-row" style="margin-top:6px;"><span>Số tiền còn dư chưa thuộc về quý nào</span><b>${moneySpaced(settlement.leftoverAmount)}</b></div>
            <p class="sub" style="margin-top:6px;">${escapeHtml(buildMoneyBasedExplanation(settlement.paidQuarters, settlement.leftoverAmount))}</p>
            <p class="sub" id="mrcpt-error" style="color:var(--red); font-weight:700; display:${finalAmount>maxAllowed? 'block':'none'}; margin-top:6px;">${finalAmount>maxAllowed? 'Tổng Số tiền này lớn hơn so với Tổng tiền chưa đóng lãi của hộ vay, vui lòng điều chỉnh lại' : ''}</p>`;
      const advEl = wrap.querySelector('#mrcpt-advinfo');
      if(advEl) advEl.innerHTML = advancedInfoHtml(b, settlement.paidQuarters, 'mrcpt', advInfoOpen);
      const confirmBtn = wrap.querySelector('#mrcpt-confirm');
      if(confirmBtn){ confirmBtn.disabled = (finalAmount<=0 || finalAmount>maxAllowed); if(!confirmBtn.disabled) delayEnableConfirmBtn(confirmBtn, openedAt); }
      wireAdvancedInfo(wrap, 'mrcpt', (open)=>{ advInfoOpen = open; });
    }

    function wireShell(){
      wrap.querySelector('#mrcpt-close').onclick = close;
      wrap.querySelector('#mrcpt-back').onclick = goBack;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wireReceiptCategoryField(wrap, 'payment', 'mrcpt', renderShell, (id)=>{ selectedCategoryId = id; });
      const totalInput = wrap.querySelector('#mrcpt-total');
      totalInput.addEventListener('focus', ()=>{ totalInput.value=''; });
      totalInput.addEventListener('input', ()=>{
        totalInput.value = totalInput.value.replace(/[^\d]/g,'').slice(0,12);
        receiptSurplus = parseInt(totalInput.value,10)||0;
        receiptShortfall = 0;
        updateResults();
      });
      totalInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); totalInput.blur(); } });
      const totalResetBtn = wrap.querySelector('#mrcpt-total-reset');
      if(totalResetBtn) totalResetBtn.onclick = ()=>{ receiptSurplus=0; receiptShortfall=0; totalInput.value=''; updateResults(); };

      const totalInfoBtn = wrap.querySelector('#mrcpt-total-info');
      const totalTip = wrap.querySelector('#mrcpt-total-tip');
      if(totalInfoBtn) totalInfoBtn.onclick = (e)=>{ e.stopPropagation(); totalTip.style.display = totalTip.style.display==='none' ? 'block' : 'none'; };
      const prevInfoBtn = wrap.querySelector('#mrcpt-prevleftover-info');
      const prevTip = wrap.querySelector('#mrcpt-prevleftover-tip');
      if(prevInfoBtn) prevInfoBtn.onclick = (e)=>{ e.stopPropagation(); prevTip.style.display = prevTip.style.display==='none' ? 'block' : 'none'; };
      if(!wrap._tipCloserBound){
        wrap._tipCloserBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap)) return;
          const tt = wrap.querySelector('#mrcpt-total-tip');
          const pt = wrap.querySelector('#mrcpt-prevleftover-tip');
          if(tt && tt.style.display!=='none' && !e.target.closest('#mrcpt-total-info') && !e.target.closest('#mrcpt-total-tip')) tt.style.display='none';
          if(pt && pt.style.display!=='none' && !e.target.closest('#mrcpt-prevleftover-info') && !e.target.closest('#mrcpt-prevleftover-tip')) pt.style.display='none';
        });
      }
      const prevToggleBtn = wrap.querySelector('#mrcpt-prevleftover-toggle');
      if(prevToggleBtn) prevToggleBtn.onclick = ()=>{ usePrevLeftover = !usePrevLeftover; updateResults(); };

      const confirmBtn = wrap.querySelector('#mrcpt-confirm');
      wireSendPaymentLinkBtn(wrap, 'mrcpt', ()=>{
        const quarterLines = (lastSettlement.paidQuarters||[]).map(bx=>({ key:bx.key, qk:bx.qk, year:bx.year, amount:bx.interestAmount }));
        const payerName = (wrap.querySelector('#rcpt-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#rcpt-collector').value||'').trim();
        return { title:'BL Thu tiền lãi (theo cách tính tiền cụ thể)', amount: lastFinalAmountForPayment, borrowerNames:[b.name], borrowerIds:[b.id], contentEl: wrap.querySelector('.modal-body'),
          replay: { applyFn:'interest', borrowerId:b.id, amount: lastGrandTotal, quarterLines, payerName, collectorName, categoryLabelId: selectedCategoryId||null, receiptCategoryKey:'interest_money' } };
      }, async ()=>{
        if(lastFinalAmount<=0 || lastFinalAmount>lastMaxAllowed){ alert('Số tiền chưa hợp lệ — vui lòng kiểm tra lại số dư đóng dư/thiếu trước khi gửi đường link thanh toán.'); return false; }
        if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return false;
        return true;
      });
      if(confirmBtn) confirmBtn.addEventListener('mouseenter', ()=>{
        if(confirmBtn.dataset.locked==='1') return;
        const body = wrap.querySelector('.modal-body');
        if(body) body.scrollTo({ top: body.scrollHeight, behavior:'smooth' });
      });
      if(confirmBtn) confirmBtn.onclick = async ()=>{
        if(state.previewMode){ alert('Bạn đang ở chế độ tham quan, không thể xác nhận đóng lãi thật.'); return; }
        if(!canEditModule('data')){ alert('Bạn không có quyền Sửa ở Sổ vay vốn nên không thể xác nhận đóng lãi. Vui lòng liên hệ Chủ mã định danh.'); return; }
        if(lastFinalAmount<=0 || lastFinalAmount>lastMaxAllowed) return;
        const payerName = (wrap.querySelector('#rcpt-payer').value||'').trim();
        const collectorName = (wrap.querySelector('#rcpt-collector').value||'').trim();
        if(!payerName || !collectorName){ alert('Vui lòng điền đầy đủ "Người đóng tiền" và "Người thu tiền" trước khi xác nhận.'); return; }
        if(!(await assertInterestBoxStillFresh(b, snapshotTotalPaidAtOpen))) return;
        if(!(await assertNoUnpaidReceiptLock(b.id, b.name))) return;
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        const raw = getInterestPaymentBoxRaw(b.id);
        const dispBeforeMrcpt = computeInterestPaymentBoxDisplay(b);
        const payments = Object.assign({}, raw.payments||{});
        lastSettlement.paidQuarters.forEach(bx=>{ payments[bx.key] = bx.interestAmount; });
        const newTotalPaid = (raw.totalPaid||0) + lastGrandTotal;
        await cSet('interestPaymentBoxes/'+b.id, { totalPaid: newTotalPaid, payments });
        state.interestPaymentBoxes = state.interestPaymentBoxes||{};
        state.interestPaymentBoxes[b.id] = { totalPaid:newTotalPaid, payments };
        await settleInterestPaymentLeftover(b);
        {
          const dispAfterMrcpt = computeInterestPaymentBoxDisplay(b);
          const catLabel = onSuccessExtra? 'Biên lai thu tiền lãi (theo cách tính tiền cụ thể) đối với hộ nợ rủi ro' : 'Biên lai thu tiền lãi (theo cách tính tiền cụ thể)';
          await logQuarterStatusDiff(b, dispBeforeMrcpt, dispAfterMrcpt,
            `Đã được đóng lãi thành công bởi ${catLabel} lập ngày ${fmtDate(todayStr())}`,
            `Đã trở về trạng thái chưa đóng lãi do thay đổi thông tin liên quan tới khoản vay`);
        }
        await pushReceiptRecord(b, onSuccessExtra? 'interest_money_riskdebt' : 'interest_money', {
          amount: lastFinalAmount, sign:'+',
          quarterLines: lastSettlement.paidQuarters.map(bx=>({ qk:bx.qk, year:bx.year, amount:bx.interestAmount })),
          categoryLabelId: selectedCategoryId||null, extra: { payerName, collectorName, explanation: buildMoneyBasedExplanation(lastSettlement.paidQuarters, lastSettlement.leftoverAmount) },
        });
        await pushLog('xác nhận', `đóng lãi (theo cách tính tiền) cho hộ vay ${b.name} (${moneySpaced(lastFinalAmount)})`);
        if(onSuccessExtra) onSuccessExtra(); else refreshOpenIAModal();
        hideProcessingToast(); // Bước 4
        showBigToast(`Phê duyệt thành công: hộ vay ${b.name} đóng xong tiền lãi là ${groupDigitsRight(String(Math.round(lastFinalAmount)),3)}đ`);
      };
    }

    renderShell();
  }

  function renderInterestApprovalModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=>{ cancelInterestApprovalModal(); wrap.remove(); };

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

      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1400px; border:6px solid #1b5e20;">
          <div class="modal-head" style="background:linear-gradient(180deg, #81c784 0%, #43a047 50%, #1b5e20 100%);"><h3 style="color:#fff;">${waveTextHtmlSlow('💰 Tính tiền lãi và phê duyệt đóng lãi')}</h3><button class="modal-close preview-allow" id="ia-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; overflow:auto;">
            <div class="toolbar" style="flex-wrap:wrap;">
              <input id="ia-search" class="preview-allow" placeholder="🔎 Tìm theo tên, CCCD, SĐT..." value="${state.search}" style="min-width:200px;${(state.search!=='' && state.search!==' ')? "border:2px solid #b71c1c;" : ""}">
              ${buildHamletFilterDropdownHtml(hamlets)}
              ${buildProjectFilterDropdownHtml(projects)}
              ${buildFundSourceFilterDropdownHtml()}
              ${buildManagerFilterDropdownHtml()}
              <button class="btn btn-ghost btn-sm preview-allow ${resetFilterBtnClass(hamlets, projects)}" id="ia-reset-all-btn" title="Đưa bộ lọc về đúng mặc định ban đầu">↺ Khôi phục bộ lọc gốc</button>
            </div>
            <div id="ia-table-area">${renderIAGroupedTablesHtml(list, projects)}</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:16px;">
              <button class="btn btn-ghost preview-allow" id="ia-cancel-btn-bottom">Đóng bảng</button>
            </div>
          </div>
        </div>`;
      wire(hamlets, projects, list);
    }

    function wire(hamlets, projects, list){
      wrap.querySelector('#ia-close').onclick = close;
      wrap.querySelector('#ia-cancel-btn-bottom').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)

      wrap.querySelector('#ia-search').oninput = (e)=>{ state.search = e.target.value; rerenderKeepingFocus(renderBody); };
      const toggleDropdown = (kind)=>{ state.openFilterDropdown = state.openFilterDropdown===kind ? null : kind; renderBody(); };
      const hb = wrap.querySelector('#f-hamlet-btn'); if(hb) hb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('hamlet'); };
      const pb = wrap.querySelector('#f-project-btn'); if(pb) pb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('project'); };
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
      const resetAllBtn = wrap.querySelector('#ia-reset-all-btn'); if(resetAllBtn) resetAllBtn.onclick=()=>{ resetAllBorrowerFilters(hamlets, projects); renderBody(); };

      // ---- Cột "Thông tin đóng lãi" (Xem) và "Quyết định" (Đóng tiền lãi) ----
      // Nút "Xem"/"Đóng tiền lãi" ở dòng TỔNG vẫn tạm khoá (báo đang nâng cấp). Nút "Xem" và "Đóng
      // tiền lãi" ở TỪNG DÒNG người vay đều đã hoạt động thật.
      wrap.querySelectorAll('[data-ia-hist]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.iaHist);
          if(b) renderInterestPaymentHistoryModal(b);
        };
      });
      wrap.querySelectorAll('[data-ia-hist-locked]').forEach(btn=>{
        btn.onclick = ()=> alert('Tính năng "Xem lịch sử đóng lãi" cho cả nhóm đang được nâng cấp, sẽ sớm ra mắt.');
      });
      wrap.querySelectorAll('[data-shared-interest-payment]').forEach(btn=>{
        btn.onclick = ()=>{
          const gid = btn.dataset.sharedInterestPayment;
          const ids = (btn.dataset.sharedInterestPaymentIds||'').split(',').filter(Boolean);
          const groupList = ids.map(id=> state.borrowers.find(b=>b.id===id)).filter(Boolean);
          if(!groupList.length){ alert('Không tìm thấy người vay nào trong danh sách này.'); return; }
          if(groupList.length<2){ alert('Chức năng "Đóng tiền lãi" ở dòng Tổng chỉ có tác dụng khi trong danh sách có từ 2 người trở lên.'); return; }
          renderSharedInterestPaymentSelectModal(gid, groupList);
        };
      });
      wrap.querySelectorAll('[data-ia-pay]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.iaPay);
          if(b) renderInterestPaymentApprovalModal(b);
        };
      });

      if(!wrap._outsideClickBound){
        wrap._outsideClickBound = true;
        document.addEventListener('click', (e)=>{
          if(!state.showInterestApprovalModal || !state.openFilterDropdown) return;
          if(e.target.closest('.sv-filter-dropdown')) return;
          state.openFilterDropdown = null;
          if(document.body.contains(wrap)) renderBody();
        });
      }
    }

    state.showInterestApprovalModal = true;
    wrap.dataset.iaModal = '1';
    wrap._refreshIA = renderBody;
    renderBody();
  }
  function refreshOpenIAModal(){
    const w = document.querySelector('[data-ia-modal]');
    if(w && w._refreshIA) w._refreshIA();
  }

  function renderDataTab(el){
    capturePanelAnimFlag();
    applyLastColumnViewOnLoad(); // khôi phục "bộ xem cột áp dụng gần nhất" (đám mây cá nhân > trình duyệt > mặc định) — tự có cờ chống chạy lặp lại nhiều lần
    // Màn hình hẹp: LẦN ĐẦU TIÊN vào module Sổ vay vốn trong phiên làm việc này, tự động rút gọn HẾT
    // mọi panel (không panel nào mở sẵn) — người dùng sau đó có thể tự do đóng/mở tuỳ ý, KHÔNG bị ép
    // rút gọn lại ở những lần vào sau (chỉ áp dụng đúng 1 lần lúc mới vào). Màn hình rộng không đổi gì.
    if(isNarrowScreenForSidebar() && !window.__loanTabNarrowAutoCollapsed){
      window.__loanTabNarrowAutoCollapsed = true;
      state.showProjectsList = false;
      state.showBorrowersList = false;
      state.showRiskDebtList = false;
      state.showSettledList = false;
      state.showLoanTrash = false;
      state.showManagePanel = false;
    }
    if(!state.activeLoanColors && !state._loanColorsLoading){
      state._loanColorsLoading = true;
      loadActiveLoanColors().then(()=>{ state._loanColorsLoading = false; if(state.activeTab==='data') renderDataTab(el); }).catch((err)=>{
        // QUAN TRỌNG: nếu KHÔNG bắt lỗi ở đây, cờ "_loanColorsLoading" sẽ bị KẸT ở true MÃI MÃI khi có
        // lỗi mạng/Firebase — khiến các lần render() sau đó bị vướng vào nhánh gọi lại hàm này liên tục
        // (do !state._loanColorsLoading luôn false), và nếu có chỗ nào khác trong app giả định
        // state.activeLoanColors LUÔN có giá trị (không kiểm tra undefined) thì có thể gây lỗi ngầm làm
        // gãy cả quá trình vẽ lại trang — đây là nghi vấn hàng đầu cho hiện tượng "nút bị liệt bất
        // thường, tải lại trang mới hết" mà người dùng từng báo cáo.
        console.error('[renderDataTab] Lỗi khi tải màu khoản vay đang hoạt động:', err);
        state._loanColorsLoading = false;
        state.activeLoanColors = state.activeLoanColors || {}; // đảm bảo LUÔN có giá trị (object rỗng), tránh chỗ khác trong app đọc phải undefined
      });
    }
    const hamlets = state.config.hamlets||[];
    const canEdit = canEditModule('data');
    const projects = activeLoanProjects();
    const allCols = state._appliedColumnViewSetId==='__hiddencols__' ? BORROWER_COLUMNS() : BORROWER_COLUMNS().filter(c=>!c.hidden);
    const colOrder = ensureBorrowerColumnOrder();
    const visibleKeys = ensureBorrowerVisibleCols();
    const colsByKey = {}; allCols.forEach(c=> colsByKey[c.key]=c);
    const visibleCols = colOrder.filter(k=>visibleKeys.includes(k)).map(k=>colsByKey[k]);

    let list = state.borrowers.filter(b=>!b.deleted && !b.settled && !b.riskDebt);
    // Hộ quá hạn CHƯA XỬ LÝ luôn phải hiện ra (tách thành Panel riêng), TUYỆT ĐỐI KHÔNG bị BẤT KỲ bộ
    // lọc nào ảnh hưởng (tìm kiếm/địa phương/phương án/nguồn vay/người quản lý/Quý/Năm) — kể cả khi
    // các bộ lọc kia đang chọn 0 lựa chọn nào cả. Tính từ dữ liệu GỐC, không đi qua bước lọc nào.
    const overdueList = list.filter(borrowerIsOverdueUnhandled);
    list = list.filter(b=>!borrowerIsOverdueUnhandled(b));
    // Tổng số THỰC SỰ thuộc panel "Khoản vay đang hoạt động" — lấy TRƯỚC khi áp dụng bất kỳ bộ lọc
    // tìm kiếm/địa bàn/phương án/nguồn vay/người quản lý/Quý/Năm nào, để tiêu đề panel luôn hiện đúng
    // tổng số thật, không đổi theo bộ lọc.
    const totalActiveBorrowersCount = list.length;
    if(state.search) list = list.filter(b=> (b.name+b.cccd+b.phone).toLowerCase().includes(state.search.toLowerCase()));
    ensureFilterHamletsInit(hamlets);
    ensureFilterProjectsInit(projects);
    if(state.filterHamlets.length < hamlets.length) list = list.filter(b=>state.filterHamlets.includes(b.hamlet));
    if(state.filterProjectIds.length < projects.length) list = list.filter(b=>state.filterProjectIds.includes(b.projectId));
    { const fs=fundSourcesInUse(); ensureFilterFundSourcesInit(fs); if(state.filterFundSources.length < fs.length) list = list.filter(b=>state.filterFundSources.includes((b.fundSource||'').trim())); }
    { const mgrs=ensureDefaultManagers(); ensureFilterManagersInit(mgrs); if(state.filterManagerIds.length < mgrs.length) list = list.filter(b=>state.filterManagerIds.includes(b.managerId||'chihoitruong')); }
    list = list.filter(borrowerLoanRangeMatchesFilter);

    // "Danh sách Phương án vay đang hoạt động" — hiện đúng những phương án có ít nhất 1 người vay đang
    // nằm trong "Danh sách Khoản vay đang hoạt động" (list + overdueList) phía dưới, HOẶC những phương
    // án hoàn toàn CHƯA có người vay nào (mới tạo, đang chờ thêm người) — mặc định nằm cuối danh sách,
    // có thể kéo-thả đổi vị trí như bình thường. Chỉ những phương án CÓ người vay nhưng KHÔNG còn ai
    // nằm trong danh sách đang hoạt động (VD: tất cả đã tất toán/bị xoá hết) mới bị coi là "ẩn".
    const activeProjectIds = new Set(list.concat(overdueList).map(b=>b.projectId).filter(Boolean));
    const projectHasAnyBorrowerEver = new Set(state.borrowers.filter(b=>!b.deleted && b.projectId).map(b=>b.projectId));
    const activeProjectsOnlyRaw = projects.filter(p=> activeProjectIds.has(p.id) || !projectHasAnyBorrowerEver.has(p.id));
    const hiddenProjects = projects.filter(p=> !activeProjectIds.has(p.id) && projectHasAnyBorrowerEver.has(p.id));
    const sortingProjects = !!state.sortingProjects;
    const activeProjectsOnly = sortingProjects && state._projectSortDraft
      ? state._projectSortDraft.map(id=>activeProjectsOnlyRaw.find(p=>p.id===id)).filter(Boolean)
      : sortedActiveProjects(activeProjectsOnlyRaw);
    if(sortingProjects && !state._projectSortDraft) state._projectSortDraft = activeProjectsOnly.map(p=>p.id);
    state._svProjectsCache = { activeProjectsOnly };
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head" style="cursor:pointer;" id="lp-projects-toggle"><h3>${(canEdit && state.showProjectsList && activeProjectsOnly.length>0)? `<button type="button" class="btn-plain-icon preview-allow sort-btn-popin" id="lp-projects-sort-btn" title="Sắp xếp danh sách" style="margin-right:6px; font-size:15px; cursor:pointer; background:none; border:none;">☰</button>` : ''}📋 Danh sách Phương án vay đang hoạt động (${activeProjectsOnly.length} PA) ${state.showProjectsList?'▴':'▾'}</h3>${canEdit? `<button class="btn btn-primary btn-sm" id="lp-new-btn">➕ Tạo phương án vay mới</button>` : ''}</div>
        ${state.showProjectsList? `<div class="panel-body ${panelBodyAnimClass()}">
          ${sortingProjects? `<div style="margin-bottom:10px;">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary btn-sm preview-allow" id="lp-sort-save">💾 Lưu lại thứ tự sắp xếp</button>
              <button class="btn btn-ghost btn-sm preview-allow" id="lp-sort-cancel">Huỷ (không lưu sắp xếp)</button>
            </div>
            <p class="sub drag-hint-cycle" style="margin:6px 0 0;">Bấm vào các tên phía dưới và kéo thả để thay đổi vị trí trong danh sách.</p>
          </div>` : ''}
          ${activeProjectsOnly.length? `<div class="table-wrap"><table>
            <thead><tr><th class="sv-sticky-1"></th><th class="sv-sticky-2" style="${svColStyleHeader({key:'project',label:'Tên phương án', userInput:true})}"><span class="dancing-header preview-allow" data-header-scope="projects">Tên phương án</span></th><th style="${svColStyleHeader({align:'right',label:'Tổng vốn (đ)'})}">Tổng vốn</th><th style="${svColStyleHeader({align:'center',label:'Hộ tham gia'})}">Hộ tham gia</th><th style="${svColStyleHeader({align:'right',label:'Đã cho vay (đ)'})}">Đã cho vay</th><th style="${svColStyleHeader({label:'Lãi suất %', width:96})}">Lãi suất</th><th style="${svColStyleHeader({key:'loanDate',label:'Ngày vay'})}">Ngày vay</th><th style="${svColStyleHeader({key:'dueDate',label:'Đến hạn'})}">Đến hạn</th><th style="${svColStyleHeader({label:'Nguồn vay', width:140})}">Nguồn vay</th><th style="${svColStyleHeader({align:'right',label:'Phân bổ Cấp Trung ương (%)', width:110})}">Phân bổ<br>Cấp TW</th><th style="${svColStyleHeader({align:'right',label:'Phân bổ Cấp Tỉnh (%)', width:100})}">Phân bổ<br>Cấp Tỉnh</th><th style="${svColStyleHeader({align:'right',label:'Phân bổ Cấp Xã (%)', width:100})}">Phân bổ<br>Cấp Xã</th><th style="${svColStyleHeader({align:'right',label:`% Xã phân bổ về ${subAdminLabelLower()}`, width:120})}">% Xã phân bổ<br>về ${subAdminLabelLower()}</th><th style="${svColStyleHeader({label:'Thời gian còn lại'})}">Thời gian còn lại</th><th style="${svColStyleHeader({align:'right',label:'Số tiền còn lại không hoạt động (đ)', width:140})}">Số tiền còn lại<br>không hoạt động</th></tr></thead>
            <tbody>${activeProjectsOnly.map(p=>{
              const disbursed = projectDisbursedTotal(p.id);
              const rowColor = daysRemainingRowColor(p.dueDate);
              return `<tr${sortingProjects? ` draggable="true" data-drag-project="${p.id}"` : ''}${rowColor? ` style="background:${rowColor};"` : ''}>
                <td class="sv-sticky-1" style="background:var(--white); ${sortingProjects?'cursor:grab;':''}">${sortingProjects? `<span title="Kéo để đổi vị trí">☰</span>` : (canEdit? `<button class="btn btn-ghost btn-sm" data-lp-edit="${p.id}" title="Sửa" style="padding:4px 8px;">✏️</button>` : '')}</td>
                <td class="sv-sticky-2 sv-col-wrap-check" style="background:var(--white); ${svColStyle({key:'project',label:'Tên phương án', userInput:true})}"><b><span class="dancing-project-name preview-allow" data-project-id="${p.id}">${escapeHtml(p.name)}</span></b></td>
                <td class="money" style="${svColStyle({align:'right',label:'Tổng vốn (đ)'})}">${moneySpaced(p.totalCapital)}</td>
                <td style="${svColStyle({align:'center',label:'Hộ tham gia'})}">${projectParticipantCount(p.id)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Đã cho vay (đ)'})}">${moneySpaced(disbursed)}</td>
                <td style="${svColStyle({label:'Lãi suất %', width:96})}">${p.interestRate||0}%/năm</td>
                <td style="${svColStyle({key:'loanDate',label:'Ngày vay'})}">${fmtDate(p.disburseDate)}</td>
                <td style="${svColStyle({key:'dueDate',label:'Đến hạn'})}">${fmtDate(p.dueDate)}</td>
                <td class="sv-col-wrap-check" style="${svColStyle({label:'Nguồn vay', width:140})}">${escapeHtml(p.fundSourceType||'')}</td>
                <td style="${svColStyle({align:'right',label:'Phân bổ Cấp Trung ương (%)', width:110})}">${String(parseFloat(p.splitCentral)||0).replace('.',',')}%</td>
                <td style="${svColStyle({align:'right',label:'Phân bổ Cấp Tỉnh (%)', width:100})}">${String(parseFloat(p.splitProvince)||0).replace('.',',')}%</td>
                <td style="${svColStyle({align:'right',label:'Phân bổ Cấp Xã (%)', width:100})}">${String(parseFloat(p.splitWard)||0).replace('.',',')}%</td>
                <td style="${svColStyle({align:'right',label:`% Xã phân bổ về ${subAdminLabelLower()}`, width:120})}">${String(parseFloat(p.hamletAllocPercent)||0).replace('.',',')}%</td>
                <td class="sv-col-wrap-check" style="${svColStyle({label:'Thời gian còn lại'})}">${daysRemainingLabel(p.dueDate)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Số tiền còn lại không hoạt động (đ)', width:140})}">${moneySpaced(projectInactiveAmountRaw(p))}</td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>` : `<div class="empty-state"><div class="e-ico">🌾</div>Chưa có Phương án vay nào — bấm "Tạo phương án vay mới" để bắt đầu</div>`}
          <div style="text-align:center; margin-top:14px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" id="lp-hidden-projects-toggle">${state.showHiddenProjects? '▴' : '▾'} Xem phương án vay bị ẩn${hiddenProjects.length? ` (${hiddenProjects.length})` : ''}</button></div>
          ${state.showHiddenProjects? `
          <p class="sub" style="margin-top:8px;">Đây là các Phương án vay không xuất hiện ở bất kỳ danh sách nào khác trong module này (thường do dữ liệu ngày tháng bất thường, hoặc chưa/không còn hộ vay nào hợp lệ bên trong).</p>
          ${hiddenProjects.length? `<div class="table-wrap"><table>
            <thead><tr><th class="sv-sticky-1"></th><th class="sv-sticky-2">Tên phương án</th><th>Tổng vốn</th><th>Lãi suất</th><th>Ngày vay</th><th>Đến hạn</th></tr></thead>
            <tbody>${hiddenProjects.map(p=>`<tr>
              <td class="sv-sticky-1" style="background:var(--white);">${canEdit? `<button class="btn btn-ghost btn-sm" data-lp-edit="${p.id}" title="Sửa" style="padding:4px 8px;">✏️</button>` : ''}</td>
              <td class="sv-sticky-2" style="background:var(--white);"><b><span class="dancing-project-name preview-allow" data-project-id="${p.id}">${escapeHtml(p.name)}</span></b></td>
              <td class="money">${moneySpaced(p.totalCapital)}</td>
              <td>${p.interestRate||0}%/năm</td>
              <td>${fmtDate(p.disburseDate)}</td>
              <td>${fmtDate(p.dueDate)}</td>
            </tr>`).join('')}</tbody>
          </table></div>` : `<p class="sub">Không có phương án vay nào bị ẩn.</p>`}
          ` : ''}
        </div>` : ''}
      </div>

      <div class="panel">
        <div class="panel-head" style="cursor:pointer;" id="loan-manage-panel-toggle"><h3 style="color:#0d47a1;">💰 Quản lý, thống kê và phê duyệt hành động khoản vay ${state.showManagePanel===false?'▾':'▴'}</h3><button type="button" class="btn btn-ghost btn-sm preview-allow" id="collapse-all-panels-btn">Rút gọn mọi thứ</button></div>
        ${state.showManagePanel===false? '' : `<div class="panel-body ${panelBodyAnimClass()}">
          <div class="toolbar" style="flex-wrap:wrap;">
            <button class="btn btn-sm preview-allow" id="loan-calc-interest-btn" style="background:linear-gradient(180deg, #ffffff 0%, #43a047 45%, #1b5e20 100%); color:#fff; border-color:#1b5e20; text-shadow:0 1px 2px rgba(0,0,0,.35);">Tính tiền lãi và phê duyệt đóng lãi</button>
            <button class="btn btn-sm preview-allow" id="loan-approve-settlement-btn" style="background:linear-gradient(180deg, #ffffff 0%, #1e6fd9 45%, #0d47a1 100%); color:#fff; border-color:#0d47a1; text-shadow:0 1px 2px rgba(0,0,0,.35);">Tất toán khoản vay/Trả nợ trước hạn</button>
            <button class="btn btn-sm preview-allow" id="loan-extend-debt-btn" style="background:linear-gradient(180deg, #ffffff 0%, #fb8c00 45%, #e65100 100%); color:#000; border-color:#e65100; font-weight:700;">Gia hạn nợ</button>
            <button class="btn btn-sm preview-allow" id="loan-risk-debt-btn" style="background:linear-gradient(180deg, #ffffff 0%, #ffcdd2 50%, #ef9a9a 100%); color:#7a1f1f; border-color:#ef9a9a;">Quản lý Nợ rủi ro</button>
            <button class="btn btn-sm preview-allow" id="loan-archive-btn" style="background:linear-gradient(180deg, #ffffff 0%, #7b1fa2 45%, #4a148c 100%); color:#fff; border-color:#4a148c; text-shadow:0 1px 2px rgba(0,0,0,.35);">Kho biên lai/giấy xác nhận/dòng nhật ký</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="loan-quarter-settings-btn">📅 Chỉnh mốc thời gian tính lãi hàng Quý</button>
            <button class="btn btn-sm preview-allow" id="loan-approval-details-toggle" style="background:linear-gradient(180deg, #ffffff 0%, #fff9c4 50%, #fbc02d 100%); color:var(--rice-dark); border-color:#fbc02d; font-weight:700;">🔍 Bảng Đối chiếu &amp; Kiểm định Số liệu Sổ vay vốn</button>
            <button class="btn btn-sm preview-allow" id="loan-level-allocation-btn" style="background:linear-gradient(180deg, #ffffff 0%, #26c6da 45%, #00838f 100%); color:#000; border-color:#00acc1; font-weight:700;">📊 Thống kê phân bổ tiền lãi các cấp</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="exp-excel-btn">⬇️ Xuất Excel</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="print-btn">🖨️ In</button>
          </div>
        </div>`}
      </div>

      ${overdueList.length? `
      <div class="panel">
        <div class="panel-head"><h3 style="color:#b71c1c;">⚠️ Khoản vay quá hạn nhưng chưa được xử lý (${overdueList.length} hộ vay)</h3></div>
        <div class="panel-body">
          <p class="sub" style="margin:0 0 10px;">Danh sách này LUÔN hiển thị đầy đủ, KHÔNG bị ảnh hưởng bởi bất kỳ bộ lọc nào (kể cả bộ lọc Quý/Năm) ở Panel "Danh sách Khoản vay đang hoạt động" phía dưới — chỉ tự động biến mất khi hộ vay được xử lý xong (tất toán, gia hạn tiếp, hoặc đưa vào Nợ rủi ro).</p>
          ${buildOverdueUnhandledPanelHtml(overdueList, visibleCols, projects)}
        </div>
      </div>` : ''}

      <div class="panel">
        <div class="panel-head" style="cursor:pointer;" id="lp-borrowers-toggle"><h3 style="color:#1b5e20;">👥 Danh sách Khoản vay đang hoạt động (${totalActiveBorrowersCount}) ${state.showBorrowersList===false?'▾':'▴'}</h3>${canEdit? `<div style="display:flex; gap:8px;"><button class="btn btn-primary btn-sm" id="lp-add-borrower-any-btn">➕ Thêm người vay</button><button class="btn btn-sm preview-allow" id="lp-quickadd-ai-btn-2" style="background:linear-gradient(180deg, #ffffff 0%, #7c4dff 45%, #4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700;">✨ Thêm nhanh bằng AI</button></div>` : ''}</div>
        ${state.showBorrowersList===false? '' : `<div class="panel-body ${panelBodyAnimClass()}">
          <div class="toolbar" style="flex-wrap:wrap;">
            <input id="f-search" class="preview-allow" placeholder="🔎 Tìm theo tên, CCCD, SĐT..." value="${state.search}" style="min-width:200px;${(state.search!=='' && state.search!==' ')? "border:2px solid #b71c1c;" : ""}">
            ${buildHamletFilterDropdownHtml(hamlets)}
            ${buildProjectFilterDropdownHtml(projects)}
            ${buildFundSourceFilterDropdownHtml()}
            ${buildManagerFilterDropdownHtml()}
            ${buildTimelineFilterDropdownHtml('main')}
            <button class="btn btn-ghost btn-sm preview-allow ${resetFilterBtnClass(hamlets, projects)}" id="f-reset-all-btn" title="Đưa cả 4 bộ lọc (Ấp/Phương án vay/Quý/Năm) về đúng mặc định ban đầu">↺ Khôi phục bộ lọc gốc</button>
            <div class="spacer"></div>
            <button class="btn btn-ghost btn-sm preview-allow" id="col-viewset-btn" style="background:linear-gradient(180deg, #ffffff 0%, #ffca28 45%, #ff8f00 100%); color:#5a3d00; border-color:#ff8f00; font-weight:700;">👁️ Chế độ xem cột</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="col-picker-btn">🧩 Tuỳ chỉnh cột (${visibleKeys.length}/${allCols.length})</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="color-picker-btn">🎨 Tuỳ chỉnh màu</button>
          </div>
          ${quarterYearFilterCaptionHtml()}

          <div id="borrower-table-area">${renderBorrowerGroupedTablesHtml(list, visibleCols, projects, canEdit, overdueList)}</div>
          ${currentQuarterBoundariesCaptionHtml()}
          <div style="text-align:center; margin-top:14px;"><button class="btn btn-ghost btn-sm preview-allow" id="lp-borrowers-collapse-all" style="color:#b71c1c; font-weight:700;">Rút gọn toàn bộ danh sách</button></div>
        </div>`}
      </div>

      <div class="panel">
        <div class="panel-head" style="cursor:pointer;" id="loan-riskdebt-toggle"><h3 style="color:#f57f17;">⚠️ Danh sách khoản vay Nợ rủi ro (${countRiskDebtProcessing()}) ${state.showRiskDebtList?'▴':'▾'}</h3></div>
        ${state.showRiskDebtList? `<div class="panel-body ${panelBodyAnimClass()}">${buildRiskDebtListPanelHtml()}</div>` : ''}
      </div>

      <div class="panel">
        <div class="panel-head" style="cursor:pointer;" id="loan-settled-toggle"><h3 style="color:#6a1b9a;">✅ Danh sách đã Tất toán khoản vay hoặc Trả nợ trước hạn ${state.borrowers.filter(b=>!b.deleted&&b.settled).length? `<span class="sub">(${state.borrowers.filter(b=>!b.deleted&&b.settled).length})</span>` : ''} ${state.showSettledList?'▴':'▾'}</h3></div>
        ${state.showSettledList? `<div class="panel-body ${panelBodyAnimClass()}">${buildSettledBorrowersPanelHtml()}</div>` : ''}
      </div>

      <div class="panel">
        <div class="panel-head" style="cursor:pointer;" id="loan-trash-toggle"><h3>🗑️ Thùng rác (Sổ vay vốn) ${state.trash.filter(x=>['project','borrower'].includes(x._kind||'borrower')).length? `<span class="sub">(${state.trash.filter(x=>['project','borrower'].includes(x._kind||'borrower')).length})</span>` : ''} ${state.showLoanTrash?'▴':'▾'}</h3></div>
        ${state.showLoanTrash? `<div class="panel-body ${panelBodyAnimClass()}">${buildLoanTrashPanelHtml()}</div>` : ''}
      </div>`;

    const loanRiskDebtToggle = document.getElementById('loan-riskdebt-toggle');
    if(loanRiskDebtToggle) loanRiskDebtToggle.onclick = ()=>{ state.showRiskDebtList = !state.showRiskDebtList; if(state.showRiskDebtList) showOpeningListToast('Nợ rủi ro'); markPanelJustToggled(); renderDataTab(el); };
    if(state.showRiskDebtList){
      el.querySelectorAll('[data-riskdebt-history]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.riskdebtHistory);
          if(b) renderRiskDebtHistoryModal(b);
        };
      });
      el.querySelectorAll('[data-baddebt-history]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.baddebtHistory);
          if(b) renderBadDebtHistoryModal(b);
        };
      });
      el.querySelectorAll('[data-riskdebt-toggle-bad]').forEach(btn=>{
        btn.onclick = ()=>{ state.showRiskDebtBadList = !state.showRiskDebtBadList; renderDataTab(el); };
      });
    }
    const loanSettledToggle = document.getElementById('loan-settled-toggle');
    if(loanSettledToggle) loanSettledToggle.onclick = ()=>{ state.showSettledList = !state.showSettledList; if(state.showSettledList) showOpeningListToast('đã Tất toán/Trả nợ trước hạn'); markPanelJustToggled(); renderDataTab(el); };
    if(state.showSettledList){
      el.querySelectorAll('[data-settle-history]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.settleHistory);
          if(b) renderSettlementHistoryModal(b);
        };
      });
      wireSettledRangeButtons(el, ()=> renderDataTab(el));
    }
    const loanTrashToggle = document.getElementById('loan-trash-toggle');
    if(loanTrashToggle) loanTrashToggle.onclick = ()=>{ state.showLoanTrash = !state.showLoanTrash; if(state.showLoanTrash) showOpeningListToast('Thùng rác (Sổ vay vốn)'); markPanelJustToggled(); renderDataTab(el); };
    if(state.showLoanTrash) wireLoanTrashPanel(el, ()=> renderDataTab(el));

    // ---- Phương án vay ----
    const lpProjectsToggle = document.getElementById('lp-projects-toggle');
    const lpHiddenProjectsToggle = document.getElementById('lp-hidden-projects-toggle');
    if(lpHiddenProjectsToggle) lpHiddenProjectsToggle.onclick = (e)=>{ e.stopPropagation(); state.showHiddenProjects = !state.showHiddenProjects; renderDataTab(el); };
    if(lpProjectsToggle) lpProjectsToggle.onclick = ()=>{ state.showProjectsList = !state.showProjectsList; if(state.showProjectsList) showOpeningListToast('Phương án vay'); markPanelJustToggled(); renderDataTab(el); };
    const lpProjectsSortBtn = document.getElementById('lp-projects-sort-btn');
    if(lpProjectsSortBtn) lpProjectsSortBtn.onclick = (e)=>{
      e.stopPropagation();
      state.sortingProjects = true;
      state.showProjectsList = true;
      state._projectSortDraft = null; // để renderDataTab tự tính lại đúng thứ tự hiện hành làm điểm bắt đầu
      renderDataTab(el);
    };
    const lpSortSaveBtn = document.getElementById('lp-sort-save');
    if(lpSortSaveBtn) lpSortSaveBtn.onclick = async ()=>{
      const draftOrder = state._projectSortDraft||[];
      // QUAN TRỌNG: tắt trạng thái "đang sắp xếp" NGAY LẬP TỨC (trước khi ghi Firebase) — vì việc ghi
      // Firebase sẽ tự kích hoạt vẽ lại toàn trang qua bộ lắng nghe thời gian thực (bind('config',...)
      // luôn gọi render() sau mỗi lần cập nhật), nếu để việc tắt trạng thái xảy ra SAU khi ghi thì
      // lần vẽ lại đó sẽ "chụp" ngay đúng lúc còn đang bật sắp xếp, làm giao diện bị kẹt vĩnh viễn.
      state.sortingProjects = false;
      state._projectSortDraft = null;
      const newCfg = {...state.config, projectOrder: draftOrder};
      await cSet('config', newCfg);
      state.config = newCfg;
      render();
    };
    const lpSortCancelBtn = document.getElementById('lp-sort-cancel');
    if(lpSortCancelBtn) lpSortCancelBtn.onclick = ()=>{
      state.sortingProjects = false;
      state._projectSortDraft = null;
      renderDataTab(el);
    };
    wireDragReorderWithIndicator(
      Array.from(el.querySelectorAll('[data-drag-project]')),
      row=> row.dataset.dragProject,
      (draggedId, targetId, before)=>{
        if(!state._projectSortDraft) return;
        const arr = state._projectSortDraft.filter(id=>id!==draggedId);
        let idx = arr.indexOf(targetId);
        if(!before) idx += 1;
        arr.splice(idx, 0, draggedId);
        state._projectSortDraft = arr;
        renderDataTab(el);
      }
    );
    const lpBorrowersToggle = document.getElementById('lp-borrowers-toggle');
    if(lpBorrowersToggle) lpBorrowersToggle.onclick = ()=>{ state.showBorrowersList = state.showBorrowersList===false ? true : false; if(state.showBorrowersList!==false) showOpeningListToast('Khoản vay đang hoạt động'); markPanelJustToggled(); renderDataTab(el); };
    const loanManagePanelToggle = document.getElementById('loan-manage-panel-toggle');
    if(loanManagePanelToggle) loanManagePanelToggle.onclick = ()=>{ state.showManagePanel = state.showManagePanel===false ? true : false; if(state.showManagePanel!==false) showOpeningListToast('Quản lý, thống kê và phê duyệt hành động'); markPanelJustToggled(); renderDataTab(el); };
    const lpBorrowersCollapseAll = document.getElementById('lp-borrowers-collapse-all');
    if(lpBorrowersCollapseAll) lpBorrowersCollapseAll.onclick = ()=>{ state.showBorrowersList = false; renderDataTab(el); };
    const lpNewBtn = document.getElementById('lp-new-btn');
    if(lpNewBtn) lpNewBtn.onclick = (e)=>{ e.stopPropagation(); renderLoanProjectModal(null); };
    const lpAddBorrowerAnyBtn = document.getElementById('lp-add-borrower-any-btn');
    if(lpAddBorrowerAnyBtn) lpAddBorrowerAnyBtn.onclick = (e)=>{
      e.stopPropagation();
      state.modal = {type:'borrower', payload:null, projectId:null}; render();
      const el = document.createElement('div');
      el.className = 'big-toast';
      el.style.background = '#b71c1c';
      el.textContent = 'Hãy chọn phương án vay trước';
      document.body.appendChild(el);
      setTimeout(()=>{
        el.classList.add('big-toast-fading');
        setTimeout(()=>{ if(el.parentNode) el.remove(); }, 1200); // khớp đúng thời lượng animation trôi xuống mới (1.2s)
      }, 3000);
    };
    const lpQuickAddAiBtn2 = document.getElementById('lp-quickadd-ai-btn-2');
    if(lpQuickAddAiBtn2) lpQuickAddAiBtn2.onclick = (e)=>{ e.stopPropagation(); renderQuickAddByAiModal(); };
    document.querySelectorAll('[data-lp-edit]').forEach(btn=>{
      btn.onclick = ()=> renderLoanProjectModal(state.loanProjects.find(p=>p.id===btn.dataset.lpEdit));
    });

    // ---- Tính lãi suất, phê duyệt đóng lãi và tất toán khoản vay (khung placeholder, bổ sung sau) ----
    const loanCalcInterestBtn = document.getElementById('loan-calc-interest-btn');
    if(loanCalcInterestBtn) loanCalcInterestBtn.onclick = ()=> renderInterestApprovalModal();
    const loanQuarterSettingsBtn = document.getElementById('loan-quarter-settings-btn');
    if(loanQuarterSettingsBtn) loanQuarterSettingsBtn.onclick = ()=> renderQuarterIntervalModal();
    const loanApproveSettlementBtn = document.getElementById('loan-approve-settlement-btn');
    if(loanApproveSettlementBtn) loanApproveSettlementBtn.onclick = ()=> renderSettlementModal();
    const loanExtendDebtBtn = document.getElementById('loan-extend-debt-btn');
    if(loanExtendDebtBtn) loanExtendDebtBtn.onclick = ()=> renderExtensionModal();
    const loanRiskDebtBtn = document.getElementById('loan-risk-debt-btn');
    if(loanRiskDebtBtn) loanRiskDebtBtn.onclick = ()=> renderRiskDebtModal();
    const loanArchiveBtn = document.getElementById('loan-archive-btn');
    if(loanArchiveBtn) loanArchiveBtn.onclick = ()=> renderArchiveModal();
    const loanApprovalDetailsToggle = document.getElementById('loan-approval-details-toggle');
    if(loanApprovalDetailsToggle) loanApprovalDetailsToggle.onclick = ()=> renderAuditStatsModal();
    const loanLevelAllocationBtn = document.getElementById('loan-level-allocation-btn');
    if(loanLevelAllocationBtn) loanLevelAllocationBtn.onclick = ()=> renderLevelAllocationModal();

    // ---- Bộ lọc đa chọn (Ấp / Phương án vay / Quý / Năm) ----
    { const searchInput = document.getElementById('f-search'); if(searchInput) searchInput.oninput = e=>{ state.search=e.target.value; rerenderKeepingFocus(()=>renderDataTab(el)); }; }
    const resetAllBtn = document.getElementById('f-reset-all-btn');
    if(resetAllBtn) resetAllBtn.onclick = ()=>{ resetAllBorrowerFilters(hamlets, projects); renderDataTab(el); };

    const toggleDropdown = (kind)=>{ state.openFilterDropdown = state.openFilterDropdown===kind ? null : kind; renderDataTab(el); };
    const hamletBtn = document.getElementById('f-hamlet-btn'); if(hamletBtn) hamletBtn.onclick = (e)=>{ e.stopPropagation(); toggleDropdown('hamlet'); };
    const projectBtn = document.getElementById('f-project-btn'); if(projectBtn) projectBtn.onclick = (e)=>{ e.stopPropagation(); toggleDropdown('project'); };
    const fundsourceBtn = document.getElementById('f-fundsource-btn'); if(fundsourceBtn) fundsourceBtn.onclick = (e)=>{ e.stopPropagation(); toggleDropdown('fundsource'); };
    const managerBtn = document.getElementById('f-manager-btn'); if(managerBtn) managerBtn.onclick = (e)=>{ e.stopPropagation(); toggleDropdown('manager'); };
    const quarterBtn = document.getElementById('f-quarter-btn'); if(quarterBtn) quarterBtn.onclick = (e)=>{ e.stopPropagation(); toggleDropdown('quarter'); };
    const yearBtn = document.getElementById('f-year-btn'); if(yearBtn) yearBtn.onclick = (e)=>{ e.stopPropagation(); toggleDropdown('year'); };
    wireTimelineFilterDropdown('main', ()=>renderDataTab(el), el);

    const hamletAllCb = document.getElementById('f-hamlet-all');
    if(hamletAllCb) hamletAllCb.onclick = (e)=>{ e.stopPropagation(); toggleHamletAll(hamlets, hamletAllCb.checked); renderDataTab(el); };
    el.querySelectorAll('.f-hamlet-item').forEach(cb=>{
      cb.onclick = (e)=>{ e.stopPropagation(); toggleHamletOne(hamlets, cb.dataset.name, cb.checked); renderDataTab(el); };
    });
    const projectAllCb = document.getElementById('f-project-all');
    if(projectAllCb) projectAllCb.onclick = (e)=>{ e.stopPropagation(); toggleProjectAll(projects, projectAllCb.checked); renderDataTab(el); };
    el.querySelectorAll('.f-project-item').forEach(cb=>{
      cb.onclick = (e)=>{ e.stopPropagation(); toggleProjectOne(projects, cb.dataset.id, cb.checked); renderDataTab(el); };
    });
    const fundsourceAllCb = document.getElementById('f-fundsource-all');
    if(fundsourceAllCb) fundsourceAllCb.onclick = (e)=>{ e.stopPropagation(); toggleFundSourceAll(fundSourcesInUse(), fundsourceAllCb.checked); renderDataTab(el); };
    el.querySelectorAll('.f-fundsource-item').forEach(cb=>{
      cb.onclick = (e)=>{ e.stopPropagation(); toggleFundSourceOne(fundSourcesInUse(), cb.dataset.name, cb.checked); renderDataTab(el); };
    });
    const managerAllCb = document.getElementById('f-manager-all');
    if(managerAllCb) managerAllCb.onclick = (e)=>{ e.stopPropagation(); toggleManagerAll(ensureDefaultManagers(), managerAllCb.checked); renderDataTab(el); };
    el.querySelectorAll('.f-manager-item').forEach(cb=>{
      cb.onclick = (e)=>{ e.stopPropagation(); toggleManagerOne(ensureDefaultManagers(), cb.dataset.id, cb.checked); renderDataTab(el); };
    });
    el.querySelectorAll('.f-quarter-item').forEach(cb=>{
      cb.onclick = (e)=>{ e.stopPropagation(); const applied = toggleQuarterFilter(cb.dataset.key, cb.checked); renderDataTab(el); };
    });
    el.querySelectorAll('.f-year-item').forEach(cb=>{
      cb.onclick = (e)=>{ e.stopPropagation(); const applied = toggleYearFilter(parseInt(cb.dataset.year,10), cb.checked); renderDataTab(el); };
    });
    // Mở dropdown Năm -> tự cuộn tới năm đang chọn cho đỡ phải kéo tay qua 50 năm
    const yearPanel = document.getElementById('f-year-panel');
    if(yearPanel){
      const sel = yearPanel.querySelector('[data-selected-year]');
      if(sel) sel.scrollIntoView({ block:'center' });
    }
    // Mở dropdown Quý -> tự cuộn tới đúng Quý đang chọn (tương tự Năm)
    const quarterPanel = document.getElementById('f-quarter-panel');
    if(quarterPanel){
      const selQ = quarterPanel.querySelector('[data-selected-quarter]');
      if(selQ) selQ.scrollIntoView({ block:'center' });
    }
    // Bấm ra ngoài thì tự đóng dropdown đang mở (gắn 1 lần duy nhất)
    if(!state._svFilterOutsideClickBound){
      state._svFilterOutsideClickBound = true;
      document.addEventListener('click', (e)=>{
        if(state.activeTab!=='data' || !state.openFilterDropdown) return;
        if(e.target.closest('.sv-filter-dropdown')) return;
        state.openFilterDropdown = null;
        const c = document.getElementById('content'); if(c && state.activeTab==='data') renderDataTab(c);
      });
    }

    // ---- Tuỳ chỉnh cột (nay là 1 modal riêng biệt, không còn sổ xuống inline trong panel nữa) ----
    const colViewSetBtn = document.getElementById('col-viewset-btn');
    if(colViewSetBtn) colViewSetBtn.onclick = ()=> renderColumnViewSetModal();
    const colorPickerBtn = document.getElementById('color-picker-btn');
    if(colorPickerBtn) colorPickerBtn.onclick = ()=> renderLoanColorModal();
    const colPickerBtn = document.getElementById('col-picker-btn');
    if(colPickerBtn) colPickerBtn.onclick = ()=>{
      if(state._appliedColumnViewSetId==='__hiddencols__'){
        alert('🔒 Đang xem "Bộ xem cột ẩn (Không công khai)" nên không thể tuỳ chỉnh cột lúc này.\n\nVui lòng vào "👁️ Chế độ xem cột" để đổi sang 1 Bộ xem cột khác, sau đó mới có thể tiếp tục tuỳ chỉnh cột.');
        return;
      }
      renderColumnPickerModal();
    };

    // ---- Xuất Excel / In ----
    // QUAN TRỌNG: 2 nút này KHÔNG PHẢI lúc nào cũng có mặt trong DOM (chỉ hiện khi panel liên quan
    // đang mở) — nếu gọi thẳng .onclick mà không kiểm tra null, gặp lúc panel đang thu gọn sẽ crash
    // NGAY TẠI ĐÂY, khiến TOÀN BỘ phần wiring các nút CÒN LẠI phía sau (mở/đóng mọi panel khác) không
    // bao giờ được thực thi — đây chính là nguyên nhân gốc rễ gây ra lỗi "mọi panel đều không mở được"
    // sau khi xoá vĩnh viễn 1 người vay trong thùng rác (hoặc bất kỳ thao tác nào khác vô tình khiến
    // panel bị thu gọn đúng lúc renderDataTab chạy lại).
    const expExcelBtn = document.getElementById('exp-excel-btn');
    if(expExcelBtn) expExcelBtn.onclick = ()=> renderExportSelectorModal(visibleCols, 'excel');
    const printBtnEl = document.getElementById('print-btn');
    if(printBtnEl) printBtnEl.onclick = ()=> renderExportSelectorModal(visibleCols, 'print');
    const collapseAllPanelsBtn = document.getElementById('collapse-all-panels-btn');
    if(collapseAllPanelsBtn) collapseAllPanelsBtn.onclick = (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      state.showProjectsList = false;
      state.showBorrowersList = false;
      state.showRiskDebtList = false;
      state.showSettledList = false;
      state.showLoanTrash = false;
      // Luôn ép về ĐÚNG trạng thái "đã rút gọn" (false) — không dùng kiểu đảo ngược (toggle) — nên dù
      // bấm bao nhiêu lần liên tiếp, panel này KHÔNG BAO GIỜ tự sổ ra được, luôn giữ nguyên rút gọn.
      state.showManagePanel = false;
      renderDataTab(el);
      return false;
    };

    // ---- Người vay ----
    document.querySelectorAll('[data-view]').forEach(b=>{
      b.onclick = ()=>{ state.modal={type:'borrower', payload: state.borrowers.find(x=>x.id===b.dataset.view)}; render(); };
    });
    document.querySelectorAll('[data-borrower-sort-toggle]').forEach(btn=>{
      btn.onclick = (e)=>{
        e.stopPropagation();
        state.sortingBorrowersProjectId = btn.dataset.borrowerSortToggle;
        state._borrowerSortDraft = null;
        renderDataTab(el);
      };
    });
    document.querySelectorAll('[data-borrower-sort-save]').forEach(btn=>{
      btn.onclick = async ()=>{
        const gid = btn.dataset.borrowerSortSave;
        const draftOrder = state._borrowerSortDraft||[];
        // Tắt trạng thái sắp xếp NGAY trước khi ghi Firebase — xem giải thích chi tiết ở nút Lưu sắp
        // xếp Phương án vay phía trên (tránh bị "kẹt" giao diện do render() tự kích hoạt lại).
        state.sortingBorrowersProjectId = null;
        state._borrowerSortDraft = null;
        const cfg = state.config;
        const newOrderMap = {...(cfg.borrowerOrderByProject||{}), [gid]: draftOrder};
        const newCfg = {...cfg, borrowerOrderByProject: newOrderMap};
        await cSet('config', newCfg);
        state.config = newCfg;
        render();
      };
    });
    document.querySelectorAll('[data-borrower-sort-cancel]').forEach(btn=>{
      btn.onclick = ()=>{
        state.sortingBorrowersProjectId = null;
        state._borrowerSortDraft = null;
        renderDataTab(el);
      };
    });
    wireDragReorderWithIndicator(
      Array.from(document.querySelectorAll('[data-drag-borrower]')),
      row=> row.dataset.dragBorrower,
      (draggedId, targetId, before)=>{
        if(!state._borrowerSortDraft) return;
        const arr = state._borrowerSortDraft.filter(id=>id!==draggedId);
        let idx = arr.indexOf(targetId);
        if(!before) idx += 1;
        arr.splice(idx, 0, draggedId);
        state._borrowerSortDraft = arr;
        renderDataTab(el);
      }
    );
  }

