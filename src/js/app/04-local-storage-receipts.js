  // =====================================================================
  // ---------- LỚP LƯU TRỮ NỘI BỘ (chỉ trên máy — KHÔNG lên đám mây) -----
  // Dùng riêng cho module "Thu – Chi nội bộ" và cho "identity" (thông tin
  // đăng nhập của riêng thiết bị này). Dùng localStorage thật của trình
  // duyệt — không bao giờ gửi lên Firebase hay bất kỳ máy chủ nào.
  // =====================================================================
  function lget(key, fallback){
    try{ const v = localStorage.getItem(key); return v!==null ? JSON.parse(v) : fallback; }
    catch(e){ return fallback; }
  }
  function lset(key, value){
    try{
      if(value===null || value===undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    }catch(e){ console.error('localStorage set lỗi', e); }
  }
  // Namespace theo wardId để nhiều Xã dùng chung 1 máy/trình duyệt không đụng dữ liệu của nhau
  function localKey(name){ return `hnd_local_${wardId()||'chung'}_${name}`; }

  // ---------- export / print / backup helpers ----------
  function downloadBlob(filename, content, mime){
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 3000);
  }

  function htmlToWordDoc(title, bodyHtml){
    return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>${title}</title>
    <style>
      /* QUAN TRỌNG: Word tính cỡ chữ theo đơn vị PT (điểm), KHÔNG PHẢI px (pixel màn hình) — phải dùng
         đúng "pt" thì khi mở file trong Word mới đúng hiển thị "cỡ chữ 14" như mong muốn. */
      body{font-family:'Times New Roman',serif; font-size:14pt; color:#111;}
      h1,h2{text-align:center;}
      table{border-collapse:collapse; width:100%; margin-bottom:10px;}
      td,th{border:1px solid #333; padding:5px 8px; font-family:'Times New Roman',serif; font-size:14pt;}
      .sign-row{width:100%; margin-top:30px;}
      .sign-col{display:inline-block; width:46%; text-align:center; vertical-align:top;}
    </style></head>
    <body>${bodyHtml}</body></html>`;
  }
  // Loại bỏ mọi phần tử TƯƠNG TÁC (nút, ô nhập, checkbox, radio, select...) khỏi 1 khối nội dung
  // trước khi đem xuất Word/in — chỉ giữ lại đúng phần thông tin thuần tuý đang hiển thị.
  function stripInteractiveElementsHtml(sourceEl){
    const clone = sourceEl.cloneNode(true);
    clone.querySelectorAll('button, input, select, textarea, .modal-close').forEach(n=> n.remove());
    // Dọn thêm các khung rỗng còn sót lại (do chỉ chứa mỗi nút vừa bị xoá)
    clone.querySelectorAll('div,span,p,label').forEach(n=>{ if(!n.textContent.trim() && !n.querySelector('img,svg,table')) n.remove(); });
    return clone.innerHTML;
  }
  // ---- ĐƯỜNG LINK CÔNG KHAI CHO BIÊN LAI — không cần đăng nhập vẫn xem được, y hệt kiến trúc của
  // "Khảo sát công khai" (rtdb.ref('surveys/{id}')) — lưu 1 bản HTML đã lập SẴN (đóng băng, không thể
  // sửa) tại đường dẫn công khai `receipts/{mã biên lai}`, đường link dạng /bienlai/{mã biên lai} (KHÔNG
  // còn dấu #, dùng path-based routing để Cloud Function server-side đọc được, phục vụ xem trước link
  // khi chia sẻ qua Messenger/Zalo). ----
  function publicReceiptLink(receiptId){
    return `${window.location.origin}/bienlai/${encodeURIComponent(receiptId)}`;
  }
  async function ensurePublicReceiptSnapshot(receiptId, title, bodyHtml, createdAt, borrowerNames, amount){
    try{
      const cfg = state.config||{};
      const wardLabel = `${adminLevelLabel()} ${(cfg.wardName||'').trim()}`.trim();
      const provType = provinceLevelLabel();
      const provinceLabel = (cfg.provinceName||'').trim() ? `${provType} ${(cfg.provinceName||'').trim()}` : '';
      // Dùng update() (GỘP thêm/ghi đè từng trường) thay vì set() (THAY THẾ TOÀN BỘ) — vì biên lai này
      // có thể đang dùng CHUNG đúng 1 mã với 1 Biên lai chưa thanh toán cũ đã chuyển trạng thái (để giữ
      // nguyên 1 đường link duy nhất cho cả 2 giai đoạn) — nếu dùng set() sẽ xoá mất status/bankInfo/...
      await rtdb.ref('receipts/'+receiptId).update({ title, html: bodyHtml, wardLabel, provinceLabel, status:'paid', borrowerNames: borrowerNames||[], amount: amount||0, createdAt: createdAt||new Date().toISOString(), savedAt: new Date().toISOString() });
    }catch(e){ console.error('Không lưu được đường link công khai cho biên lai:', e); throw e; }
  }
  // Modal nhỏ hiện đường link + nút Sao chép — dùng chung cho mọi loại biên lai.
  // Dọn dẹp nội dung trước khi lưu làm snapshot công khai (dùng chung cho cả biên lai đã thanh toán
  // lẫn chưa thanh toán): bỏ dòng "Biên lai này được lập vào..." (đã có Thời gian xuất ở đầu trang rồi)
  // và khối "Phân loại biên lai" (không cần thiết khi xem qua đường link).
  // Thành phần "Hiện/Ẩn thông tin người thừa kế" — CHỈ dùng cho Biên lai Trả nợ trước hạn. 2 lựa chọn
  // dạng radio, mỗi lựa chọn có khung bao riêng, chỉ được chọn đúng 1, không được bỏ chọn hết.
  function heirVisibilityToggleHtml(idPrefix, hideHeir){
    return `
      <div style="margin-top:12px;">
        <label style="display:flex; align-items:center; gap:8px; border:1px solid var(--line); border-radius:8px; padding:8px 10px; margin-bottom:6px; cursor:pointer;">
          <input type="radio" name="${idPrefix}-heirvis" value="show" ${!hideHeir?'checked':''}>
          <span id="${idPrefix}-heirvis-show-text">Hiện ra thông tin người thừa kế (nếu có)</span>
        </label>
        <label style="display:flex; align-items:center; gap:8px; border:1px solid var(--line); border-radius:8px; padding:8px 10px; cursor:pointer;">
          <input type="radio" name="${idPrefix}-heirvis" value="hide" ${hideHeir?'checked':''}>
          <span id="${idPrefix}-heirvis-hide-text">Ẩn đi thông tin người thừa kế (nếu có)</span>
        </label>
      </div>`;
  }
  function wireHeirVisibilityToggle(wrap, idPrefix, code){
    wrap.querySelectorAll(`input[name="${idPrefix}-heirvis"]`).forEach(radio=>{
      radio.onchange = async ()=>{
        const hide = radio.value==='hide';
        try{ await rtdb.ref('receipts/'+code).update({ hideHeirInfo: hide }); }
        catch(e){ console.error('Không lưu được lựa chọn ẩn/hiện người thừa kế:', e); }
        // Hiệu ứng nhấp nháy đúng dòng vừa được chọn: phóng to 1,2 lần rồi thu nhỏ, lặp 4 lần rồi
        // đứng im.
        const span = wrap.querySelector(`#${idPrefix}-heirvis-${hide?'hide':'show'}-text`);
        if(span){ span.classList.remove('heirvis-pulse'); void span.offsetWidth; span.classList.add('heirvis-pulse'); }
      };
    });
  }
  const UNPAID_RECEIPT_LIFETIME_MS = 7*24*60*60*1000; // 7 ngày
  // Khung viền đỏ "Thời gian còn lại để thanh toán..." — dùng CHUNG cho mọi nơi hiển thị Biên lai
  // chưa thanh toán (đường link công khai, modal đường link lúc lập/lúc xem lại trong Hộp). Tự cập
  // nhật theo thời gian thực (không đếm giây, chỉ làm tròn xuống phút) và TỰ ĐỘNG xoá vĩnh viễn Biên
  // lai khỏi đám mây (kèm luôn đường link/mã biên lai) ngay khi đếm về 0.
  function unpaidReceiptCountdownHtml(elId){
    return `<p id="${elId}" style="color:#000; margin:6px 0 14px; padding:10px 12px; border:2px solid #b71c1c; border-radius:8px;"></p>`;
  }
  function wireUnpaidReceiptCountdown(elId, createdAt, code){
    const createdMs = new Date(createdAt).getTime();
    const deadlineMs = createdMs + UNPAID_RECEIPT_LIFETIME_MS;
    let timer = null;
    function update(){
      const el = document.getElementById(elId);
      if(!el){ if(timer) clearInterval(timer); return; } // phần tử đã bị gỡ khỏi trang (đóng modal...) -> dừng hẳn
      const remainMs = deadlineMs - Date.now();
      if(remainMs<=0){
        el.textContent = 'Thời gian Tồn tại của Biên lai này chỉ còn 0 phút (nếu vẫn chưa được phê duyệt thanh toán xong)';
        if(timer) clearInterval(timer);
        // Hết hạn thật sự -> xoá vĩnh viễn Biên lai chưa thanh toán khỏi đám mây (kèm đường link/mã).
        rtdb.ref('receipts/'+code).remove().catch(e=> console.error('Không tự xoá được Biên lai hết hạn:', e));
        return;
      }
      const totalMinutes = Math.floor(remainMs/60000);
      const days = Math.floor(totalMinutes/1440);
      const hours = Math.floor((totalMinutes%1440)/60);
      const minutes = totalMinutes%60;
      const parts = [];
      if(days>0) parts.push(`${days} ngày`); // 0 ngày -> ẩn hẳn, không hiện ra
      parts.push(`${hours} giờ`);
      parts.push(`${minutes} phút`);
      el.textContent = `Thời gian Tồn tại của Biên lai này chỉ còn ${parts.join(' ')} (nếu vẫn chưa được phê duyệt thanh toán xong)`;
    }
    update();
    timer = setInterval(update, 15000); // không cần đếm giây -> cập nhật mỗi 15 giây là đủ mượt
  }
  // Khung viền xanh dương "Thời gian chờ duyệt: đã trải qua..." — đếm XUÔI (không phải đếm ngược) kể
  // từ mốc `paymentRequestedAt` (LẦN ĐẦU TIÊN bấm "Tiếp tục xác nhận"). Có đếm cả giây (khác với khung
  // đếm ngược 7 ngày ở trên) nên cập nhật mỗi giây, đếm mãi cho tới khi phần tử bị gỡ khỏi trang (biên
  // lai đã được duyệt hoặc bị xoá tự động, làm trang tự vẽ lại và khung này không còn nữa).
  function unpaidReceiptWaitingHtml(elId){
    return `<p id="${elId}" style="color:#000; margin:6px 0 14px; padding:10px 12px; border:2px solid #0d47a1; border-radius:8px;"></p>`;
  }
  function wireUnpaidReceiptWaitingTimer(elId, paymentRequestedAt){
    const startMs = new Date(paymentRequestedAt).getTime();
    let timer = null;
    function update(){
      const el = document.getElementById(elId);
      if(!el){ if(timer) clearInterval(timer); return; }
      const elapsedMs = Math.max(0, Date.now() - startMs);
      const totalSeconds = Math.floor(elapsedMs/1000);
      const hours = Math.floor(totalSeconds/3600);
      const minutes = Math.floor((totalSeconds%3600)/60);
      const seconds = totalSeconds%60;
      el.textContent = `Thời gian chờ duyệt: đã trải qua ${hours} giờ ${String(minutes).padStart(2,'0')} phút ${String(seconds).padStart(2,'0')} giây`;
    }
    update();
    timer = setInterval(update, 1000);
  }
  function cleanReceiptContentClone(sourceEl){
    const clone = sourceEl.cloneNode(true);
    clone.querySelectorAll('p').forEach(p=>{ if(/^Biên lai này được lập vào/.test((p.textContent||'').trim())) p.remove(); });
    clone.querySelectorAll('.divider-lbl').forEach(lbl=>{
      if((lbl.textContent||'').trim()==='Phân loại biên lai'){
        const next = lbl.nextElementSibling;
        if(next && next.classList.contains('kv-row')) next.remove();
        lbl.remove();
      }
    });
    // Khối radio "Trả lại cấp.../Chọn người thừa kế" (modal Trả nợ trước hạn) — sau khi loại bỏ input
    // sẽ để lại 2 dòng chữ mồ côi cùng lúc, không rõ đã chọn cái nào. Xoá hẳn khối này, chỗ gọi hàm sẽ
    // tự thêm lại đúng 1 dòng text tĩnh khớp với lựa chọn thật (dựa vào dữ liệu replay đã lưu).
    const ermRadio = clone.querySelector('input[name="erm-mode"]');
    if(ermRadio){ const wrapDiv = ermRadio.closest('div'); if(wrapDiv) wrapDiv.remove(); }
    // Các khối .field có nhãn "Người trả nợ"/"Người nhận tiền"/"Người đóng tiền"/"Người thu tiền"/
    // "Lý do trả nợ trước hạn" — sau khi loại input/textarea sẽ để lại NHÃN MỒ CÔI (không có giá trị đi
    // kèm), gây trùng lặp với khối text tĩnh (CÓ giá trị thật) đã được chèn thêm ở nơi gọi hàm này. Xoá
    // hẳn các khối .field gốc này đi, chỉ giữ lại đúng 1 bản có giá trị thật.
    const orphanLabels = ['Người trả nợ','Người nhận tiền','Người đóng tiền','Người thu tiền','Lý do trả nợ trước hạn'];
    clone.querySelectorAll('.field').forEach(field=>{
      const lbl = field.querySelector('label');
      if(lbl && orphanLabels.includes((lbl.textContent||'').trim())) field.remove();
    });
    // Nhãn "Phân loại biên lai" (dạng <label><button>i</button> Phân loại biên lai</label>, KHÔNG phải
    // .divider-lbl) — xuất hiện trong modal ĐANG LẬP biên lai (rcpt/mrcpt) lúc chọn phân loại. Sau khi
    // nút "i" và ô chọn (select) bị bóc mất (là phần tử tương tác), nhãn này trở thành mồ côi, đứng 1
    // mình không có giá trị gì kèm theo — xoá hẳn đi.
    clone.querySelectorAll('label').forEach(lbl=>{
      if((lbl.textContent||'').trim().endsWith('Phân loại biên lai')) lbl.remove();
    });
    return clone;
  }
  async function renderReceiptLinkModal(receiptId, title, contentSelectorEl, createdAt, borrowerNames, amount){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<div class="modal" style="max-width:520px;"><div class="modal-body" style="text-align:center; padding:28px 24px;"><div class="rice-badge">🔗</div><h3 style="margin:10px 0;">Đang tạo đường link…</h3></div></div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    try{
      const clone = cleanReceiptContentClone(contentSelectorEl);
      const bodyHtml = stripInteractiveElementsHtml(clone);
      await ensurePublicReceiptSnapshot(receiptId, title, bodyHtml, createdAt, borrowerNames, amount);
      const link = publicReceiptLink(receiptId);
      // Xác định đây có phải Biên lai Trả nợ trước hạn không (dựa vào tiêu đề đã truyền vào) — nếu
      // đúng thì hiện thêm thành phần "Hiện/Ẩn thông tin người thừa kế".
      const isEarlyRepayment = /Trả nợ trước hạn/i.test(title||'');
      let hideHeirInfo = false;
      if(isEarlyRepayment){
        try{ const snap2 = await rtdb.ref('receipts/'+receiptId+'/hideHeirInfo').get(); hideHeirInfo = !!(snap2 && snap2.exists() && snap2.val()); }catch(e){}
      }
      wrap.innerHTML = `
        <div class="modal" style="max-width:520px;">
          <div class="modal-head"><h3>🔗 Đường link Biên lai</h3><button class="modal-close preview-allow" id="rlm-close">✕</button></div>
          <div class="modal-body">
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="text" readonly value="${escapeHtml(link)}" id="rlm-input" style="flex:1; padding:10px 12px; border-radius:8px; border:1px solid var(--line); font-size:12.5px;">
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button type="button" class="btn btn-primary btn-sm preview-allow" id="rlm-copy" style="flex:1;">📋 Sao chép</button>
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="rlm-view" style="flex:1;">🔍 Xem đường link</button>
            </div>
            ${isEarlyRepayment? heirVisibilityToggleHtml('rlm', hideHeirInfo) : ''}
            <p class="sub" style="margin-top:12px;">Có thể sao chép và chia sẻ đường link này - để cho Hộ vay hoặc mọi người cùng xem nội dung Biên lai này (qua Messenger, Zalo hoặc các kênh chia sẻ khác). Nếu chia sẻ qua Zalo: tiến hành dán link vào khung chat rồi đợi 3 - 5 giây (để hiện bản xem trước nội dung) rồi mới bấm nút gửi đi ; Nếu chia sẻ qua Messenger (Facebook) thì cần lưu ý thêm: khuyên nên dùng điện thoại, cách dán link như cách làm chia sẻ qua Zalo</p>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="rlm-close2">Đóng bảng</button></div>
        </div>`;
      wrap.querySelector('#rlm-close').onclick = close;
      wrap.querySelector('#rlm-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wireCopyButtonWithFeedback(wrap.querySelector('#rlm-copy'), link, '📋 Sao chép');
      wrap.querySelector('#rlm-view').onclick = ()=> window.open(link, '_blank');
      wireHeirVisibilityToggle(wrap, 'rlm', receiptId);
    }catch(e){
      wrap.innerHTML = `<div class="modal" style="max-width:480px;"><div class="modal-body" style="text-align:center; padding:28px 24px;"><div class="rice-badge">⚠️</div><h3>Không tạo được đường link</h3><p class="sub">${escapeHtml(String(e&&e.message||e))}</p></div><div class="modal-foot"><button class="btn btn-ghost preview-allow" id="rlm-close3">Đóng bảng</button></div></div>`;
      wrap.querySelector('#rlm-close3').onclick = close;
    }
  }
  function publicReceiptRouteId(){
    // Dạng MỚI (path-based, để Cloud Function đọc được server-side, phục vụ xem trước link khi chia
    // sẻ qua Messenger/Zalo): https://.../bienlai/ma
    const pathMatch = (window.location.pathname||'').match(/\/bienlai\/([^/?#]+)/);
    if(pathMatch) return decodeURIComponent(pathMatch[1]);
    // Dạng CŨ (hash-based) — vẫn nhận diện để các đường link đã chia sẻ trước đây không bị hỏng.
    const hashMatch = (window.location.hash||'').match(/^#\/bienlai\/(.+)$/);
    return hashMatch ? decodeURIComponent(hashMatch[1]) : null;
  }
  function renderPublicReceiptPage(receiptId){
    document.body.classList.add('public-survey-mode');
    root.innerHTML = `<div class="center-screen">${waveTextHtmlSlow('Đang tải biên lai…')}</div>`;
    let notFoundShown = false;
    let lastAdvOpen = true; // mặc định MỞ SẴN khi vừa vào trang — người xem có thể tự ẩn/hiện tuỳ ý sau đó
    let prevPaymentRequestedAt = undefined; // để phát hiện ĐÚNG thời điểm vừa chuyển từ "chưa yêu cầu duyệt" sang "đã yêu cầu duyệt"
    function renderContent(data){
      if(!data){
        if(!notFoundShown){
          notFoundShown = true;
          root.innerHTML = `<div class="center-screen"><div class="auth-card"><div class="rice-badge">🧾</div><h1>Không tìm thấy biên lai</h1><p class="sub">Đường link này có thể không đúng hoặc chưa từng được chia sẻ. Nếu là "Biên lai CHƯA thanh toán" thì có thể nó đã hết hạn hoặc bị xóa.</p><p style="margin-top:14px;"><a href="https://hoinongdan.sotay.org" style="color:#0d47a1; text-decoration:none; font-weight:700;">https://hoinongdan.sotay.org</a></p></div></div>`;
        }
        return;
      }
      notFoundShown = false;
      const isUnpaid = data.status==='unpaid';
      const d = new Date(data.createdAt||data.savedAt);
      const exportTimeLbl = isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
      const plainTitle = String(data.title||'Biên lai')
        .replace(/^BL\b/i, 'BIÊN LAI')
        .replace(/\s*\(THEO CÁCH TÍNH[^)]*\)/i, '')
        .toUpperCase();
      const borrowerLine = (data.borrowerNames&&data.borrowerNames.length)? `Đối với hộ vay ${data.borrowerNames.map(n=>escapeHtml(n)).join(', ')}` : '';
      // Tiêu đề trang web (hiện phía trên tên tab trình duyệt, và khi xem trước đường link lúc chia sẻ
      // qua Messenger/Zalo...) — KHÁC HẲN tiêu đề trang chủ chính (chỉ mỗi "Hoinongdan.sotay.org").
      const pageTitleReceiptName = String(data.title||'Biên lai').replace(/^BL\b/i, 'Biên lai').replace(/\s*\(THEO CÁCH TÍNH[^)]*\)/i, '');
      const firstBorrowerForTitle = (data.borrowerNames&&data.borrowerNames[0]) || '';
      document.title = `${pageTitleReceiptName}${firstBorrowerForTitle? ` đối với hộ vay ${firstBorrowerForTitle}` : ''} - Hoinongdan.sotay.org`;
      root.innerHTML = `
        <div class="center-screen" style="${isUnpaid?'padding-bottom:90px;':''}">
          <div class="auth-card" style="max-width:640px; text-align:left;">
            <div style="text-align:center; border-bottom:2px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
              ${data.wardLabel? `<div style="font-weight:800; text-transform:uppercase; font-size:14px;">HỘI NÔNG DÂN<br>${escapeHtml(data.wardLabel.toUpperCase())}</div>` : ''}
              ${data.provinceLabel? `<div style="font-weight:600; font-size:13px;">${escapeHtml(data.provinceLabel)}</div>` : ''}
              <div style="font-weight:800; font-size:16px; margin-top:8px;">${escapeHtml(plainTitle)}</div>
              ${borrowerLine? `<div style="font-weight:700; font-size:17.5px; color:#6a1b9a; margin-top:4px;">${borrowerLine}</div>` : ''}
              <div style="font-size:13.5px; margin-top:4px; color:${isUnpaid?'#b71c1c':'#0d47a1'}; font-weight:700;">Thời gian xuất: ${exportTimeLbl}</div>
            </div>
            ${isUnpaid? `
            ${data.paymentRequestedAt? `
            <p id="prc-blue-box" style="color:#000; margin:6px 0 10px; padding:10px 12px; border:2px solid #0d47a1; border-radius:8px;">Biên Lai này đang chờ duyệt thanh toán bởi người tạo ra Biên lai này. Biên lai có thể tự động chuyển sang trạng thái Đã thanh toán xong một cách tức thì (ngay sau khi được duyệt) mà không cần tải lại trang web. Nhanh nhất là sau 5 giây sẽ được duyệt, chậm nhất là sau 24 giờ. Nếu quá 24h mà chưa thấy được duyệt (Biên lai chưa chuyển trạng thái), Hãy liên hệ qua Số điện thoại chủ tài khoản${(data.bankInfo&&data.bankInfo.phone)?` (${escapeHtml(data.bankInfo.phone)})`:''} HOẶC liên hệ cán bộ Hội Nông dân xã/phường.</p>
            ${unpaidReceiptWaitingHtml('prc-waiting')}
            ` : ''}
            <p style="color:#000; margin:6px 0 14px; padding:10px 12px; border:2px solid #b71c1c; border-radius:8px;">Biên lai này CHƯA được thanh toán. Biên lai này sẽ tự mất sau 7 ngày nếu chưa được duyệt (chưa chuyển trạng thái Đã thanh toán).</p>
            ${unpaidReceiptCountdownHtml('prc-countdown')}
            <p style="color:#000; margin:0 0 14px;">Mỗi năm gồm 4 quý, mỗi quý gồm 3 tháng</p>
            ` : `
            <p class="sub" style="color:#1b5e20; font-weight:700; margin:6px 0 14px;"><span style="display:inline-block; animation: bigMoneyPulseTwice 4.4s ease-in-out infinite;">Biên lai này đã được Thanh toán Thành công, Biên lai này Không thể xoá/sửa nội dung bởi bất kỳ ai, được bảo chứng bởi Hoinongdan.sotay.org</span></p>
            <p style="color:#000; margin:0 0 14px;">Mỗi năm gồm 4 quý, mỗi quý gồm 3 tháng</p>
            `}
            ${data.html||''}
            <div style="text-align:center; margin-top:14px;" id="prc-adv-wrap"></div>
            <div style="border-top:2px solid var(--line); margin-top:20px; padding-top:12px; font-size:11.8px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                <span style="color:#6a1b9a; font-weight:700;">Đường link của Biên lai: <span id="prc-self-link" style="color:#0d47a1;">${escapeHtml(publicReceiptLink(receiptId))}</span></span>
                <button type="button" class="btn btn-ghost btn-sm preview-allow" id="prc-copy-self-link">📋 Sao chép</button>
              </div>
              <p style="color:#6a1b9a; font-weight:700; margin:8px 0 0;">${isUnpaid? 'Nếu Biên lai này đã thanh toán thành công, thì đường link của Biên lai này vĩnh viễn không thể mất đi, không thể sửa hoặc thay đổi nội dung bên trong bởi bất kỳ ai.' : 'Đường link của Biên lai này vĩnh viễn không thể mất đi, không thể sửa hoặc thay đổi nội dung bên trong bởi bất kỳ ai.'}</p>
              <div style="text-align:center; margin-top:14px;">
                <a href="https://hoinongdan.sotay.org" style="color:#0d47a1; text-decoration:none; font-weight:700;">https://hoinongdan.sotay.org</a>
              </div>
            </div>
          </div>
          ${isUnpaid? `
          <div style="position:fixed; left:0; right:0; bottom:0; padding:14px; background:rgba(255,255,255,.95); box-shadow:0 -4px 12px rgba(0,0,0,.15); text-align:center; z-index:50;">
            <button type="button" class="preview-allow" id="upp-pay-btn" style="width:100%; max-width:600px; padding:16px; border:none; border-radius:10px; background:linear-gradient(90deg, #d32f2f 0%, #ff6f00 100%); color:#fff; font-weight:800; font-size:15px; cursor:pointer;"><span class="dancing-project-name upp-pay-text" style="animation-duration:1.4s;">Bấm vào đây để thanh toán Số tiền này bằng hình thức chuyển khoản</span></button>
          </div>` : ''}
        </div>`;
      // Khối "Thông tin nâng cao" đã có sẵn trong snapshot (bị ẩn theo style="display:none") — chỉ
      // cần dựng lại đúng 1 nút bấm để bật/tắt nó, y hệt cách hoạt động trong Hộp Biên lai. Tên nút
      // đổi qua lại giữa "Thông tin nâng cao" / "Ẩn thông tin nâng cao" theo đúng trạng thái. Giữ
      // nguyên trạng thái đóng/mở qua `lastAdvOpen` — vì trang này giờ có thể tự vẽ lại nhiều lần
      // (theo thời gian thực), không nên tự ý đóng lại khối người dùng đang mở xem dở.
      const advInfoEl = root.querySelector('[id$="-adv-info"]');
      const advWrap = root.querySelector('#prc-adv-wrap');
      if(advInfoEl && advWrap){
        const setAdvBtnLabel = (open)=>{ const btn = advWrap.querySelector('#prc-adv-toggle'); if(btn) btn.textContent = open? 'Ẩn thông tin nâng cao' : 'Thông tin nâng cao'; };
        advWrap.innerHTML = `<button type="button" class="btn btn-ghost btn-sm preview-allow" id="prc-adv-toggle">Thông tin nâng cao</button>`;
        // Di chuyển hẳn khối nội dung nâng cao (vốn nằm ở vị trí cũ bên trong nội dung Biên lai) ra
        // NGAY DƯỚI nút bấm này — để nó luôn hiện đúng ngay dưới nút, không lẫn vào giữa nội dung khác.
        advWrap.appendChild(advInfoEl);
        advInfoEl.style.textAlign = 'left';
        advInfoEl.style.display = lastAdvOpen? 'block' : 'none';
        setAdvBtnLabel(lastAdvOpen);
        advWrap.querySelector('#prc-adv-toggle').onclick = ()=>{
          lastAdvOpen = advInfoEl.style.display==='none';
          advInfoEl.style.display = lastAdvOpen ? 'block' : 'none';
          setAdvBtnLabel(lastAdvOpen);
          if(lastAdvOpen){
            // Cuộn nhẹ xuống thêm 1 xíu để thấy vài dòng đầu của thông tin nâng cao vừa mở ra.
            setTimeout(()=> window.scrollBy({ top:120, behavior:'smooth' }), 60);
          }
        };
      }
      const payBtn = document.getElementById('upp-pay-btn');
      if(isUnpaid) wireUnpaidReceiptCountdown('prc-countdown', data.createdAt, receiptId);
      if(isUnpaid && data.paymentRequestedAt) wireUnpaidReceiptWaitingTimer('prc-waiting', data.paymentRequestedAt);
      // Vừa mới chuyển từ "chưa yêu cầu duyệt" sang "đã yêu cầu duyệt" (mới bấm "Tiếp tục xác nhận"
      // xong) -> tự động cuộn lên đầu trang + cho khung viền xanh nhấp nháy (mất đi hiện lại 5 lần).
      if(isUnpaid && data.paymentRequestedAt && prevPaymentRequestedAt===null){
        window.scrollTo({ top:0, behavior:'smooth' });
        const blueBox = document.getElementById('prc-blue-box');
        if(blueBox){ blueBox.classList.remove('flash-blue-border'); void blueBox.offsetWidth; blueBox.classList.add('flash-blue-border'); }
      }
      prevPaymentRequestedAt = data.paymentRequestedAt || null;
      // Hiệu ứng "bấm giữ rồi thả ra cũng tính là 1 lần bấm" — dùng Pointer Events để đáng tin cậy
      // trên cả chuột lẫn cảm ứng, không phụ thuộc thời gian giữ (nhanh hay chậm đều được), miễn là
      // bấm xuống và thả ra ĐÚNG trên nút này. DÙNG DUY NHẤT pointerup (không dùng thêm onclick riêng)
      // để tránh mở modal 2 lần cho 1 lần bấm nhanh thông thường — pointerup đã xử lý đúng cả 2 trường
      // hợp (bấm nhanh lẫn giữ lâu).
      if(payBtn){
        let pressStartedOnBtn = false;
        payBtn.addEventListener('pointerdown', ()=>{ pressStartedOnBtn = true; });
        payBtn.addEventListener('pointerup', ()=>{
          if(pressStartedOnBtn){ pressStartedOnBtn = false; renderUnpaidPaymentQrModal(data, receiptId); }
        });
        payBtn.addEventListener('pointerleave', ()=>{ pressStartedOnBtn = false; });
        payBtn.addEventListener('pointercancel', ()=>{ pressStartedOnBtn = false; });
      }
      const copySelfLinkBtn = document.getElementById('prc-copy-self-link');
      wireCopyButtonWithFeedback(copySelfLinkBtn, ()=> publicReceiptLink(receiptId), '📋 Sao chép');
      // Ẩn/hiện thông tin người thừa kế theo đúng lựa chọn đã lưu (áp dụng lại mỗi lần vẽ lại nội
      // dung, vì HTML vừa được thay thế hoàn toàn).
      if(data.hideHeirInfo) root.querySelectorAll('.heir-info-block').forEach(el=>{ el.style.display = 'none'; });
      // Cập nhật TRỰC TIẾP nội dung "Lý do trả nợ trước hạn" theo dữ liệu THẬT MỚI NHẤT từ Firebase —
      // vì nội dung HTML hiển thị ở đây vốn là bản CHỤP TĨNH lúc mới tạo biên lai (data.html), không tự
      // đổi theo khi Lý do được sửa lại sau đó (qua nút "✏️ Sửa" ở Hộp biên lai chưa thanh toán).
      const reasonLiveEl = document.getElementById('prc-reason-live');
      if(reasonLiveEl && data.replay && data.replay.reason!=null) reasonLiveEl.textContent = data.replay.reason;
    }
    // Lắng nghe THỜI GIAN THỰC toàn bộ bản ghi biên lai — bất kỳ thay đổi nào (chuyển trạng thái đã
    // thanh toán, đổi lựa chọn ẩn/hiện người thừa kế...) đều tự động vẽ lại đúng ngay lập tức, không
    // cần người xem phải tải lại trang hay thoát ra vào lại.
    try{
      rtdb.ref('receipts/'+receiptId).on('value', (snap)=>{
        const data = (snap && snap.exists()) ? snap.val() : null;
        renderContent(data);
      });
    }catch(e){
      console.error('[Biên lai công khai] Không theo dõi được:', e);
      root.innerHTML = `<div class="center-screen"><div class="auth-card"><div class="rice-badge">⚠️</div><h1>Có lỗi khi tải biên lai</h1></div></div>`;
    }
  }
  // Modal "Xem trước" dùng CHUNG cho mọi nút "Xuất file Word"/"In" gắn trong các modal khác — luôn
  // kèm 4 dòng tiêu đề đầu + dòng chân trang, y hệt phong cách Xuất Excel/In ở panel chính.
  function renderExportPrintPreviewModal(title, contentHtml){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    const dateLbl = new Date().toLocaleString('vi-VN');
    const fullBodyHtml = `
      <div style="text-align:center;">
        <div style="font-weight:800; font-size:14px;">${hoiNongDanTitleHtml()}</div>
        <div style="font-size:12.5px;">${escapeHtml(provinceTitle())}</div>
      </div>
      <div class="print-title" style="margin:10px 0 4px; text-align:center;">${escapeHtml(title.toUpperCase())}</div>
      <div style="text-align:center; font-size:12px; margin-bottom:14px;">Thời gian xuất: ${dateLbl}</div>
      ${contentHtml}
      <div style="text-align:center; margin-top:18px; font-size:11px;">https://hoinongdan.sotay.org</div>`;
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:820px;">
        <div class="modal-head"><h3>👁️ Xem trước — ${escapeHtml(title)}</h3><button class="modal-close" id="epp-close">✕</button></div>
        <div class="modal-body" style="max-height:70vh; overflow:auto; background:#fff; padding:20px;">${fullBodyHtml}</div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="epp-cancel">Đóng</button>
          <button class="btn btn-primary" id="epp-word">📄 Xuất file Word</button>
          <button class="btn btn-primary" id="epp-print">🖨️ In</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#epp-close').onclick = close;
    wrap.querySelector('#epp-cancel').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#epp-word').onclick = ()=>{
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan — chỉ xem trước được, chưa thể tải file thật.'); return; }
      const safeTitle = title.replace(/[^\w\u00C0-\u1EF9 ]/g,'').trim().replace(/\s+/g,'-');
      downloadBlob(`${safeTitle}_${todayStr()}.doc`, htmlToWordDoc(title, fullBodyHtml), 'application/msword');
    };
    wrap.querySelector('#epp-print').onclick = ()=>{
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan — chỉ xem trước được, chưa thể in thật.'); return; }
      const area = document.getElementById('print-area');
      if(!area) return;
      area.classList.remove('landscape');
      area.innerHTML = fullBodyHtml;
      window.print();
    };
  }
  // Gắn 2 nút "📄 Xuất file Word" + "🖨️ In" vào 1 vị trí bất kỳ trong modal — bấm vào sẽ lấy đúng
  // nội dung hiện tại của modal (đã loại bỏ nút/ô nhập), mở bảng xem trước.
  function exportPrintButtonsHtml(idPrefix){
    return `<button type="button" class="btn btn-ghost btn-sm preview-allow" id="${idPrefix}-word">📄 Xuất file Word hoặc in</button>`;
  }
  function wireExportPrintButtons(wrap, idPrefix, contentSelector, title){
    const wordBtn = wrap.querySelector(`#${idPrefix}-word`);
    const openPreview = ()=>{
      const sourceEl = wrap.querySelector(contentSelector);
      if(!sourceEl) return;
      renderExportPrintPreviewModal(title, stripInteractiveElementsHtml(sourceEl));
    };
    if(wordBtn) wordBtn.onclick = openPreview;
  }


  // Liệt kê TẤT CẢ các "thành phần" (danh sách con) có thể xuất Excel/In trong Sổ vay vốn — bám sát
  // đúng cấu trúc các panel + các nút bên trong từng panel (Nợ rủi ro, Đã tất toán theo khung 5 năm).
  // Sắp xếp lại 1 danh sách người vay bất kỳ theo ĐÚNG thứ tự tuỳ chỉnh đã lưu (thứ tự Phương án vay
  // + thứ tự người vay trong từng phương án) — dùng cho Xuất Excel/In để luôn khớp với thứ tự đang
  // hiển thị trên các panel, KHÔNG phải thứ tự ngẫu nhiên của Firebase.
  function sortBorrowersForExport(list){
    const groups = {};
    const order = [];
    list.forEach(b=>{
      const key = (b.projectId && state.loanProjects.some(p=>p.id===b.projectId)) ? b.projectId : '__none__';
      if(!groups[key]){ groups[key] = []; order.push(key); }
      groups[key].push(b);
    });
    const projOrder = (state.config && state.config.projectOrder) || [];
    const projOrderIndex = {}; projOrder.forEach((id,i)=> projOrderIndex[id]=i);
    order.sort((a,c)=>{
      if(a==='__none__') return 1; if(c==='__none__') return -1;
      const ai = projOrderIndex[a], ci = projOrderIndex[c];
      if(ai!=null && ci!=null) return ai-ci;
      if(ai!=null) return -1; if(ci!=null) return 1;
      return 0;
    });
    return order.flatMap(key=> key!=='__none__' ? sortedBorrowerGroup(groups[key], key) : groups[key]);
  }
  // Cột riêng cho Danh sách Phương án vay (khác hẳn cột người vay) khi xuất/in — PHẢI khớp CHÍNH XÁC
  // với đúng các cột đang hiển thị ở panel "Danh sách Phương án vay" ngoài giao diện (cùng thứ tự, cùng
  // số lượng) — tránh tình trạng thiếu/thừa cột giữa xem trước, panel và file xuất/in thật.
  const PROJECT_EXPORT_COLS = [
    { label:'Tên phương án vay', get: p=> escapeHtml(p.name||''), getPlain: p=> p.name||'' },
    { label:'Tổng nguồn vốn (đ)', get: p=> moneySpaced(p.totalCapital||0), getPlain: p=> p.totalCapital||0 },
    { label:'Hộ tham gia', get: p=> String(projectParticipantCount(p.id)), getPlain: p=> projectParticipantCount(p.id) },
    { label:'Đã cho vay (đ)', get: p=> moneySpaced(projectDisbursedTotal(p.id)), getPlain: p=> projectDisbursedTotal(p.id) },
    { label:'Lãi suất (%/năm)', get: p=> String(parseFloat(p.interestRate)||0).replace('.',','), getPlain: p=> parseFloat(p.interestRate)||0 },
    { label:'Ngày vay', get: p=> fmtDate(p.disburseDate), getPlain: p=> p.disburseDate||'' },
    { label:'Ngày đến hạn', get: p=> fmtDate(p.dueDate), getPlain: p=> p.dueDate||'' },
    { label:'Nguồn vay', get: p=> escapeHtml(p.fundSourceType||''), getPlain: p=> p.fundSourceType||'' },
    { label:'Phân bổ Cấp Trung ương (%)', get: p=> String(parseFloat(p.splitCentral)||0).replace('.',','), getPlain: p=> parseFloat(p.splitCentral)||0 },
    { label:`Phân bổ Cấp ${provinceLevelLabel()} (%)`, get: p=> String(parseFloat(p.splitProvince)||0).replace('.',','), getPlain: p=> parseFloat(p.splitProvince)||0 },
    { label:`Phân bổ Cấp ${adminLevelLabel()} (%)`, get: p=> String(parseFloat(p.splitWard)||0).replace('.',','), getPlain: p=> parseFloat(p.splitWard)||0 },
    { label:`% ${adminLevelLabel()} phân bổ về cấp dưới`, get: p=> String(parseFloat(p.hamletAllocPercent)||0).replace('.',','), getPlain: p=> parseFloat(p.hamletAllocPercent)||0 },
    { label:'Thời gian còn lại', get: p=> daysRemainingLabel(p.dueDate), getPlain: p=> daysRemainingLabel(p.dueDate) },
    { label:'Số tiền còn lại không hoạt động (đ)', get: p=> moneySpaced(projectInactiveAmountRaw(p)), getPlain: p=> projectInactiveAmountRaw(p) },
  ];
  function quarterBoundariesLineHtml(){
    const q = (state.config && state.config.quarters) || DEFAULT_QUARTERS;
    const fmt = (m,d)=> `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
    const parts = ['q1','q2','q3','q4'].map((qk,i)=>{
      const info = q[qk]||{};
      return `Quý ${i+1} từ ${fmt(info.startMonth,info.startDay)} đến ${fmt(info.endMonth,info.endDay)}`;
    });
    return `<p style="margin:0 0 12px;"><b>Đang áp dụng Các mốc thời gian hàng quý:</b> ${parts.join(' ; ')}</p>`;
  }
  function buildLoanExportSections(){
    const sections = [];
    sections.push({ key:'projects', label:'📋 Danh sách Phương án vay', list: sortedActiveProjects(state.loanProjects||[]), cols: PROJECT_EXPORT_COLS });
    const baseList = state.borrowers.filter(b=>!b.deleted && !b.settled && !b.riskDebt);
    const overdueList = sortBorrowersForExport(baseList.filter(borrowerIsOverdueUnhandled));
    const activeList = sortBorrowersForExport(baseList.filter(b=>!borrowerIsOverdueUnhandled(b)));
    sections.push({ key:'active', label:'👥 Danh sách Khoản vay đang hoạt động', list: activeList });
    if(overdueList.length) sections.push({ key:'overdue', label:'⚠️ Danh sách khoản vay đến hạn nhưng chưa được xử lý', list: overdueList });
    const riskDebtProcessing = sortBorrowersForExport(state.borrowers.filter(b=>!b.deleted && !b.settled && b.riskDebt && !b.badDebt));
    const riskDebtBad = sortBorrowersForExport(state.borrowers.filter(b=>!b.deleted && !b.settled && b.riskDebt && b.badDebt));
    sections.push({ key:'riskdebt', label:'⚠️ Danh sách khoản vay Nợ rủi ro', isGroup:true, subItems:[
      { key:'riskdebt_processing', label:'Danh sách Nợ rủi ro trong diện đang xử lý', list: riskDebtProcessing },
      { key:'riskdebt_bad', label:'Các khoản vay Không có khả năng trả nợ', list: riskDebtBad },
    ]});
    const allSettled = state.borrowers.filter(b=>!b.deleted && b.settled);
    const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear()-5);
    const fiveYearsAgoStr = fiveYearsAgo.toISOString();
    const settled5y = sortBorrowersForExport(allSettled.filter(b=> (b.settledAt||'') >= fiveYearsAgoStr));
    const buckets = settledYearBuckets(allSettled);
    const settledSub = [{ key:'settled_5y', label:'Danh sách từ 5 năm trước đến thời điểm hiện tại', list: settled5y }];
    buckets.forEach(bk=> settledSub.push({ key:'settled_bucket_'+bk.idx, label:`Danh sách từ năm ${bk.fromYear} đến năm ${bk.toYear}`, list: sortBorrowersForExport(bk.list) }));
    sections.push({ key:'settled', label:'✅ Danh sách đã Tất toán khoản vay hoặc Trả nợ trước hạn', isGroup:true, subItems: settledSub });
    sections.push({ key:'trash', label:'🗑️ Thùng rác (Sổ vay vốn)', list: sortBorrowersForExport(flattenTrashBorrowers()) });
    return sections;
  }
  // Modal chọn thành phần muốn Xuất Excel/In — chọn 1 hoặc nhiều, không được bỏ chọn hết.
  function renderExportSelectorModal(visibleCols, mode){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const sections = buildLoanExportSections();
    const selected = new Set(['active']);
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:560px;">
          <div class="modal-head"><h3>${mode==='excel'?'⬇️ Xuất Excel':'🖨️ In'} — Chọn thành phần</h3><button class="modal-close preview-allow" id="exs-close">✕</button></div>
          <div class="modal-body">
            <p class="sub">Chọn 1 hoặc nhiều danh sách muốn ${mode==='excel'?'xuất ra file Excel':'in kèm theo'} (không được bỏ chọn hết):</p>
            ${sections.map(sec=>{
              if(sec.isGroup){
                return `<div style="margin-bottom:10px; border:1px solid var(--line); border-radius:8px; padding:8px 12px;">
                  <b>${sec.label}</b>
                  <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
                    ${sec.subItems.map(sub=>`<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="preview-allow exs-item" data-key="${sub.key}" ${selected.has(sub.key)?'checked':''}><span>${escapeHtml(sub.label)} (${sub.list.length})</span></label>`).join('')}
                  </div>
                </div>`;
              }
              return `<label style="display:flex; align-items:center; gap:8px; margin-bottom:8px;"><input type="checkbox" class="preview-allow exs-item" data-key="${sec.key}" ${selected.has(sec.key)?'checked':''}><span>${sec.label} (${sec.list.length})</span></label>`;
            }).join('')}
            <p class="sub" style="margin-top:12px; padding-top:10px; border-top:1px solid var(--line); line-height:1.6;">📐 Các danh sách khoản vay bên trên sẽ được ${mode==='excel'?'xuất':'in'} đúng theo bộ cột đang hiển thị hiện tại (theo "Tuỳ chỉnh cột" hoặc "Chế độ xem cột" đồng chí vừa chọn): <b>${visibleCols.map(c=>plainLabel(c.label)).join(', ')}</b>.</p>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="exs-cancel">Đóng bảng</button>
            <button class="btn btn-primary preview-allow" id="exs-confirm">Xác nhận và tiếp tục</button>
          </div>
        </div>`;
      wrap.querySelector('#exs-close').onclick = close;
      wrap.querySelector('#exs-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('.exs-item').forEach(cb=> cb.onclick = ()=>{
        const k = cb.dataset.key;
        if(cb.checked) selected.add(k); else selected.delete(k);
      });
      wrap.querySelector('#exs-confirm').onclick = ()=>{
        if(selected.size===0){ alert('Vui lòng chọn ít nhất 1 danh sách trước khi tiếp tục.'); return; }
        const chosenSections = [];
        if(selected.has('active')) chosenSections.push({ title:'', list:[], extraHtml: quarterBoundariesLineHtml(), isNote:true });
        sections.forEach(sec=>{
          if(sec.isGroup){ sec.subItems.forEach(sub=>{ if(selected.has(sub.key)) chosenSections.push({ title: sec.label+' — '+sub.label, list: sub.list, cols: sec.cols }); }); }
          else if(selected.has(sec.key)) chosenSections.push({ title: sec.label, list: sec.list, cols: sec.cols });
        });
        close();
        if(mode==='excel') renderMultiSectionExcelPreviewModal(chosenSections, visibleCols);
        else printMultiSectionBorrowersList(chosenSections, visibleCols);
      };
    }
    render();
  }

  // Xuất Excel Sổ vay vốn — CHỈ xuất đúng các cột đang hiển thị trên giao diện (visibleCols),
  // kèm 4 dòng tiêu đề đầu (Hội Nông dân xã/phường..., tỉnh/thành..., loại báo cáo, thời gian xuất)
  // được GHÉP Ô (merge) trải dài hết bề ngang bảng — không bị bó kín vào 1 ô/1 cột.
  // Excel tính ngày bắt đầu từ 1900-01-01 = ngày số 1 (có bù trừ lỗi năm nhuận giả của Excel) — công
  // thức chuẩn quy đổi ngày dương lịch thường sang "số ngày Excel" (serial date number).
  function excelDateSerial(day, month, year){
    const utcDate = Date.UTC(year, month-1, day);
    const epoch = Date.UTC(1899, 11, 30);
    return Math.round((utcDate - epoch) / 86400000);
  }
  // Quét qua 1 worksheet đã tạo (từ mảng aoa dạng text thông thường), tự nhận diện đúng cột nào là
  // TIỀN / NGÀY THÁNG (dựa vào tên cột ở dòng tiêu đề) rồi chuyển các ô đó từ dạng CHỮ sang dạng SỐ/
  // NGÀY THẬT của Excel, kèm ĐỊNH DẠNG HIỂN THỊ đúng (thuộc tính ô — cách Excel TỰ VẼ ra màn hình, chứ
  // KHÔNG chèn dấu chấm/gạch chéo thật vào nội dung ô). Dùng CHUNG cho mọi tính năng xuất Excel trong
  // toàn app — chỉ cần gọi đúng 1 hàm này sau khi đã tạo xong worksheet bằng aoa_to_sheet.
  //   ws: worksheet vừa tạo. aoa: đúng mảng 2 chiều đã dùng để tạo ws. headerRowIdx: chỉ số dòng (đếm
  //   từ 0) chứa tên các cột, ngay TRƯỚC dòng dữ liệu đầu tiên.
  function applyExcelCellFormatting(ws, aoa, headerRowIdx){
    if(!ws['!ref']) return;
    const headerRow = aoa[headerRowIdx] || [];
    const range = XLSX.utils.decode_range(ws['!ref']);
    // Font Times New Roman cho TOÀN BỘ ô trong bảng — LƯU Ý: thư viện xuất Excel miễn phí (SheetJS
    // community) có thể KHÔNG hỗ trợ ghi style khi xuất file (chỉ hỗ trợ đọc) — đoạn này an toàn để thử
    // (không gây lỗi nếu không được áp dụng), nhưng không đảm bảo chắc chắn hoạt động khi mở file thật.
    const FONT = { name:'Times New Roman' };
    for(let r=0; r<=range.e.r; r++){
      for(let c=0; c<=range.e.c; c++){
        const addr = XLSX.utils.encode_cell({r,c});
        const cell = ws[addr];
        if(!cell) continue;
        cell.s = cell.s || {};
        cell.s.font = Object.assign({}, cell.s.font, FONT);
      }
    }
    // Chữ ĐẬM cho dòng tiêu đề cột (đúng dòng headerRowIdx) — VD "TÊN PHƯƠNG ÁN VAY", "TỔNG NGUỒN VỐN (Đ)"...
    for(let c=0; c<=range.e.c; c++){
      const addr = XLSX.utils.encode_cell({r:headerRowIdx,c});
      const cell = ws[addr];
      if(cell){ cell.s = cell.s || {}; cell.s.font = Object.assign({}, cell.s.font, FONT, {bold:true}); }
    }
    for(let c=0; c<=range.e.c; c++){
      const label = String(headerRow[c]||'');
      const isMoney = /\(đ\)|Số tiền/i.test(label);
      const isDate = /ngày|Ngày|hạn/i.test(label) && !/số ngày|Số Ngày/i.test(label);
      // Căn chỉnh giá trị: Tên phương án vay/Họ và tên/Đơn vị -> căn TRÁI. Tiền/ngày tháng -> giữ
      // nguyên căn PHẢI như cũ (không đụng vào). Mọi cột còn lại -> căn GIỮA.
      const isLeftAlignCol = /^(TÊN PHƯƠNG ÁN VAY|HỌ VÀ TÊN|ĐƠN VỊ)$/i.test(label.trim());
      const align = isLeftAlignCol ? 'left' : (isMoney||isDate ? 'right' : 'center');
      for(let r=headerRowIdx+1; r<=range.e.r; r++){
        const addr = XLSX.utils.encode_cell({r,c});
        const cell = ws[addr];
        if(!cell || cell.v==null || cell.v==='') continue;
        cell.s = cell.s || {};
        cell.s.alignment = Object.assign({}, cell.s.alignment, { horizontal: align });
        const raw = String(cell.v);
        if(isMoney){
          const digits = raw.replace(/[^\d]/g,'');
          if(digits){ cell.v = parseInt(digits,10); cell.t = 'n'; cell.z = '#,##0'; }
        } else if(isDate){
          // Nhận dạng CẢ 2 định dạng có thể gặp trong dữ liệu gốc: "dd/mm/yyyy" (dấu gạch chéo, đã qua
          // fmtDate) HOẶC "yyyy-mm-dd" (dấu gạch ngang, dữ liệu ISO thô chưa qua định dạng) — trước đây
          // chỉ nhận dạng được đúng 1 kiểu, khiến các cột dùng dữ liệu ISO thô bị bỏ sót, không chuyển
          // đổi được, vẫn hiển thị nguyên dạng "năm-tháng-ngày" trong file Excel.
          let d, mo, y;
          let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if(m){ [,d,mo,y] = m; }
          else {
            m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if(m){ [,y,mo,d] = m; }
          }
          if(m){ cell.v = excelDateSerial(+d, +mo, +y); cell.t = 'n'; cell.z = 'dd/mm/yyyy'; }
        }
      }
    }
  }
  // Đánh dấu 1 hàng (dòng tiêu đề danh sách VD "DANH SÁCH PHƯƠNG ÁN VAY (N)", hoặc dòng tiêu đề file
  // VD "BÁO CÁO SỔ VAY VỐN — ...") thành chữ ĐẬM — dùng riêng cho các dòng KHÔNG phải dòng tiêu đề cột
  // (những dòng đó đã tự động đậm trong applyExcelCellFormatting ở trên).
  function boldExcelRow(ws, rowIdx){
    if(!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    if(rowIdx>range.e.r) return;
    for(let c=0; c<=range.e.c; c++){
      const addr = XLSX.utils.encode_cell({r:rowIdx,c});
      const cell = ws[addr];
      if(cell){ cell.s = cell.s || {}; cell.s.font = Object.assign({}, cell.s.font, {name:'Times New Roman'}, {bold:true}); }
    }
  }
  async function exportBorrowersExcel(list, visibleCols){
    await loadOptionalLibrary('xlsx');
    const projLabel = projectFilterLabel(activeLoanProjects());
    const hamletLabel = hamletFilterLabel(state.config.hamlets||[]);
    const headerLines = [
      ['HỘI NÔNG DÂN'],
      [wardTitleUpper()],
      [provinceTitle()],
      [`BÁO CÁO SỔ VAY VỐN — Phương án: ${projLabel} — ${subAdminLabel()}: ${hamletLabel}`],
      [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`],
      [],
    ];
    const colLabels = visibleCols.map(c=>plainLabel(c.label).toUpperCase());
    const dataRows = list.map(b=> visibleCols.map(c=> (c.getPlain||c.get)(b)));
    const aoa = [...headerLines, colLabels, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applyExcelCellFormatting(ws, aoa, headerLines.length);
    boldExcelRow(ws, 3); // dòng tiêu đề file (VD "BÁO CÁO SỔ VAY VỐN — Phương án: ... — Ấp: ...") — đã +1 do thêm dòng "HỘI NÔNG DÂN" tách riêng ở trên
    const lastCol = Math.max(0, visibleCols.length - 1);
    ws['!merges'] = headerLines.map((line,r)=> (line.length? { s:{r,c:0}, e:{r,c:lastCol} } : null)).filter(Boolean);
    ws['!cols'] = visibleCols.map(()=>({wch:20}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'So vay von');
    XLSX.writeFile(wb, `So-vay-von_${todayStr()}.xlsx`, {cellStyles:true});
  }

  // Xem trước bảng trước khi thực sự xuất Excel — phóng to/thu nhỏ, cuộn tự do mọi hướng. Chỉ khi
  // bấm "Xuất file Excel" trong khung xem trước này mới thực sự tải file về máy.
  async function exportBorrowersExcelMultiSection(sections, visibleCols){
    await loadOptionalLibrary('xlsx');
    const projLabel = projectFilterLabel(activeLoanProjects());
    const hamletLabel = hamletFilterLabel(state.config.hamlets||[]);
    const maxCols = Math.max(visibleCols.length, ...sections.map(s=> (s.cols||visibleCols).length), 1);
    const headerLines = [
      ['HỘI NÔNG DÂN'], [wardTitleUpper()], [provinceTitle()],
      [`BÁO CÁO SỔ VAY VỐN — Phương án: ${projLabel} — ${subAdminLabel()}: ${hamletLabel}`],
      [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`], [],
    ];
    let aoa = [...headerLines];
    const merges = headerLines.map((line,r)=> (line.length? { s:{r,c:0}, e:{r,c:maxCols-1} } : null)).filter(Boolean);
    const sectionHeaderRows = []; // ghi nhớ đúng chỉ số dòng tiêu đề cột của TỪNG section, để định dạng riêng
    const sectionTitleRows = []; // ghi nhớ chỉ số dòng tiêu đề danh sách (VD "DANH SÁCH PHƯƠNG ÁN VAY (N)") của TỪNG section, để tô đậm
    sections.forEach(sec=>{
      if(sec.isNote){
        merges.push({ s:{r:aoa.length,c:0}, e:{r:aoa.length,c:maxCols-1} });
        aoa.push([(sec.extraHtml||'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ')]);
        aoa.push([]);
        return;
      }
      const cols = sec.cols||visibleCols;
      merges.push({ s:{r:aoa.length,c:0}, e:{r:aoa.length,c:maxCols-1} });
      sectionTitleRows.push(aoa.length);
      aoa.push([`${sec.title} (${sec.list.length})`.toUpperCase()]);
      sectionHeaderRows.push(aoa.length);
      aoa.push(cols.map(c=>plainLabel(c.label).toUpperCase()));
      sec.list.forEach(b=> aoa.push(cols.map(c=> (c.getPlain||c.get)(b))));
      aoa.push([]);
    });
    merges.push({ s:{r:aoa.length,c:0}, e:{r:aoa.length,c:maxCols-1} });
    aoa.push(['https://hoinongdan.sotay.org']);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    sectionHeaderRows.forEach(rowIdx=> applyExcelCellFormatting(ws, aoa, rowIdx));
    sectionTitleRows.forEach(rowIdx=> boldExcelRow(ws, rowIdx));
    boldExcelRow(ws, 3); // dòng tiêu đề file (VD "BÁO CÁO SỔ VAY VỐN — Phương án: ... — Ấp: ...") — đã +1 do thêm dòng "HỘI NÔNG DÂN" tách riêng ở trên
    ws['!merges'] = merges;
    ws['!cols'] = Array.from({length:maxCols}, ()=>({wch:20}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'So vay von');
    XLSX.writeFile(wb, `So-vay-von_${todayStr()}.xlsx`, {cellStyles:true});
  }

  // Xem trước bảng trước khi thực sự xuất Excel — phóng to/thu nhỏ, cuộn tự do mọi hướng. Chỉ khi
  // bấm "Xuất file Excel" trong khung xem trước này mới thực sự tải file về máy.
  function renderBorrowersExcelPreviewModal(list, visibleCols){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:1100px;">
        <div class="modal-head"><h3>👁️ Xem trước file Excel — Sổ vay vốn</h3><button class="modal-close" id="bvx-close">✕</button></div>
        <div class="modal-body" style="padding:0;">
          <div style="display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--line); flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm zoom-btn-flash" id="bvx-zoom-out">➖ Thu nhỏ</button>
            <span class="sub" id="bvx-zoom-label">100%</span>
            <button class="btn btn-ghost btn-sm zoom-btn-flash" id="bvx-zoom-in">➕ Phóng to</button>
            <div class="spacer"></div>
            <span class="sub">${list.length} người vay — ${visibleCols.length} cột</span>
          </div>
          <div id="bvx-scroll" style="overflow:auto; max-height:65vh; padding:16px;">
            <div id="bvx-zoom-wrap" style="transform-origin:top left; transition:transform .1s; width:max-content;">
              <table style="border-collapse:collapse;">
                <thead><tr>${visibleCols.map(c=>`<th style="border:1px solid var(--line); padding:6px 10px; background:var(--paper-2); white-space:nowrap;">${htmlLabel(c.label)}</th>`).join('')}</tr></thead>
                <tbody>${list.length? list.map(b=>`<tr>${visibleCols.map(c=>`<td style="border:1px solid var(--line); padding:6px 10px; white-space:nowrap;">${escapeHtml(String((c.getPlain||c.get)(b)))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${visibleCols.length}" style="padding:10px;">Không có dữ liệu theo bộ lọc hiện tại</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="bvx-cancel">Đóng</button>
          <button class="btn btn-primary" id="bvx-confirm">⬇️ Xuất file Excel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#bvx-close').onclick = close;
    wrap.querySelector('#bvx-cancel').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    let zoom = 1;
    const zoomWrap = wrap.querySelector('#bvx-zoom-wrap');
    const zoomLabel = wrap.querySelector('#bvx-zoom-label');
    const applyZoom = ()=>{ zoomWrap.style.transform = `scale(${zoom})`; zoomLabel.textContent = Math.round(zoom*100)+'%'; };
    wrap.querySelector('#bvx-zoom-in').onclick = ()=>{ zoom = Math.min(2, Math.round((zoom+0.1)*10)/10); applyZoom(); };
    wrap.querySelector('#bvx-zoom-out').onclick = ()=>{ zoom = Math.max(0.4, Math.round((zoom-0.1)*10)/10); applyZoom(); };
    wrap.querySelector('#bvx-confirm').onclick = async ()=>{
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan — đây chỉ là bản xem trước, chưa thể tải file Excel thật. Vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng.'); return; }
      try{ await exportBorrowersExcel(list, visibleCols); close(); }
      catch(e){ console.error('[Xuất Excel Sổ vay vốn] Lỗi:', e); alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); }
    };
  }

  // Xem trước Excel gồm NHIỀU thành phần (mỗi thành phần 1 khối bảng riêng, có tiêu đề).
  function renderMultiSectionExcelPreviewModal(sections, visibleCols){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:1100px;">
        <div class="modal-head"><h3>👁️ Xem trước file Excel — Sổ vay vốn</h3><button class="modal-close" id="bvx-close">✕</button></div>
        <div class="modal-body" style="padding:16px; max-height:70vh; overflow:auto;">
          ${sections.map(sec=>{
            if(sec.isNote) return `<div style="margin:14px 0;">${sec.extraHtml||''}</div>`;
            const cols = sec.cols||visibleCols;
            return `
            <p style="font-weight:800; margin:14px 0 6px;">${escapeHtml(sec.title)} (${sec.list.length})</p>
            <table style="border-collapse:collapse; width:max-content;">
              <thead><tr>${cols.map(c=>`<th style="border:1px solid var(--line); padding:6px 10px; background:var(--paper-2); white-space:nowrap;">${htmlLabel(c.label)}</th>`).join('')}</tr></thead>
              <tbody>${sec.list.length? sec.list.map(b=>`<tr>${cols.map(c=>`<td style="border:1px solid var(--line); padding:6px 10px; white-space:nowrap;">${escapeHtml(String((c.getPlain||c.get)(b)))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" style="padding:10px;">Không có dữ liệu</td></tr>`}</tbody>
            </table>`;
          }).join('')}
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="bvx-cancel">Đóng</button>
          <button class="btn btn-primary" id="bvx-confirm">⬇️ Xuất file Excel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#bvx-close').onclick = close;
    wrap.querySelector('#bvx-cancel').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#bvx-confirm').onclick = async ()=>{
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan — đây chỉ là bản xem trước, chưa thể tải file Excel thật. Vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng.'); return; }
      try{ await exportBorrowersExcelMultiSection(sections, visibleCols); close(); }
      catch(e){ console.error('[Xuất Excel Sổ vay vốn] Lỗi:', e); alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); }
    };
  }

  // In Sổ vay vốn — TỰ ĐỘNG khổ A4 NẰM NGANG, tự co giãn cỡ chữ/khoảng cách ô theo số cột đang
  // hiển thị để luôn vừa vặn trọn 1 trang, không tràn lề/mất cột.
  function printBorrowersList(list, visibleCols){
    const ncols = visibleCols.length;
    let fontSize = 12.5, pad = '6px 8px';
    if(ncols>16){ fontSize=7; pad='2px 3px'; }
    else if(ncols>12){ fontSize=8; pad='3px 4px'; }
    else if(ncols>9){ fontSize=9.5; pad='4px 5px'; }
    else if(ncols>6){ fontSize=11; pad='5px 6px'; }
    const projLabel = projectFilterLabel(activeLoanProjects());
    const hamletLabel = hamletFilterLabel(state.config.hamlets||[]);
    const printInnerHtml = `
      <div style="text-align:center;">
        <div style="font-weight:800; font-size:14px;">${hoiNongDanTitleHtml()}</div>
        <div style="font-size:12.5px;">${escapeHtml(provinceTitle())}</div>
      </div>
      <div class="print-title" style="margin:10px 0 4px; text-align:center;">SỔ VAY VỐN</div>
      <div style="text-align:center; font-size:12px; margin-bottom:10px;">
        Phương án: ${escapeHtml(projLabel)} — ${escapeHtml(subAdminLabel())}: ${escapeHtml(hamletLabel)}<br>
        Thời gian xuất: ${new Date().toLocaleString('vi-VN')}
      </div>
      <table class="print-table" style="font-size:${fontSize}px;">
        <thead><tr>${visibleCols.map(c=>`<th style="padding:${pad};">${htmlLabel(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${list.length? list.map(b=>`<tr>${visibleCols.map(c=>`<td style="padding:${pad};">${c.get(b)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${ncols}" style="padding:${pad};">Không có dữ liệu theo bộ lọc hiện tại</td></tr>`}</tbody>
      </table>
      <div style="text-align:center; margin-top:18px; font-size:11px;">https://hoinongdan.sotay.org</div>`;
    // Chế độ tham quan: KHÔNG thể chặn hành động "In" thật bên trong hộp thoại in gốc của trình
    // duyệt sau khi đã mở (nằm ngoài khả năng can thiệp của JS) — nên thay vào đó hiện bản xem
    // trước trong 1 khung riêng, không gọi window.print() thật.
    if(state.previewMode){
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg';
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:1000px;">
          <div class="modal-head"><h3>🖨️ Xem trước bản in — Sổ vay vốn</h3><button class="modal-close" id="bvp-close">✕</button></div>
          <div class="modal-body" style="max-height:70vh; overflow:auto; background:#fff;">${printInnerHtml}</div>
          <div class="modal-foot">
            <span class="sub" style="margin-right:auto;">Đồng chí đang ở chế độ tham quan — đây chỉ là bản xem trước, không thể in thật.</span>
            <button class="btn btn-primary" id="bvp-close2">Đóng</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = ()=> wrap.remove();
      wrap.querySelector('#bvp-close').onclick = close;
      wrap.querySelector('#bvp-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      return;
    }
    const area = document.getElementById('print-area');
    if(!area) return;
    area.innerHTML = printInnerHtml;
    area.classList.add('landscape');
    window.print();
    setTimeout(()=> area.classList.remove('landscape'), 800);
  }
  // In NHIỀU thành phần cùng lúc — mỗi thành phần 1 khối bảng riêng có tiêu đề, vẫn khổ A4 NẰM NGANG.
  function printMultiSectionBorrowersList(sections, visibleCols){
    const ncols = visibleCols.length;
    let fontSize = 12.5, pad = '6px 8px';
    if(ncols>16){ fontSize=7; pad='2px 3px'; }
    else if(ncols>12){ fontSize=8; pad='3px 4px'; }
    else if(ncols>9){ fontSize=9.5; pad='4px 5px'; }
    else if(ncols>6){ fontSize=11; pad='5px 6px'; }
    const projLabel = projectFilterLabel(activeLoanProjects());
    const hamletLabel = hamletFilterLabel(state.config.hamlets||[]);
    const sectionsHtml = sections.map(sec=>{
      if(sec.isNote) return `<div style="margin:16px 0;">${sec.extraHtml||''}</div>`;
      const cols = sec.cols||visibleCols;
      return `
      <p style="font-weight:800; font-size:13px; margin:16px 0 6px;">${escapeHtml(sec.title)} (${sec.list.length})</p>
      <table class="print-table" style="font-size:${fontSize}px;">
        <thead><tr>${cols.map(c=>`<th style="padding:${pad};">${htmlLabel(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${sec.list.length? sec.list.map(b=>`<tr>${cols.map(c=>`<td style="padding:${pad};">${c.get(b)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" style="padding:${pad};">Không có dữ liệu</td></tr>`}</tbody>
      </table>`;
    }).join('');
    const printInnerHtml = `
      <div style="text-align:center;">
        <div style="font-weight:800; font-size:14px;">${hoiNongDanTitleHtml()}</div>
        <div style="font-size:12.5px;">${escapeHtml(provinceTitle())}</div>
      </div>
      <div class="print-title" style="margin:10px 0 4px; text-align:center;">SỔ VAY VỐN</div>
      <div style="text-align:center; font-size:12px; margin-bottom:10px;">
        Phương án: ${escapeHtml(projLabel)} — ${escapeHtml(subAdminLabel())}: ${escapeHtml(hamletLabel)}<br>
        Thời gian xuất: ${new Date().toLocaleString('vi-VN')}
      </div>
      ${sectionsHtml}
      <div style="text-align:center; margin-top:18px; font-size:11px;">https://hoinongdan.sotay.org</div>`;
    if(state.previewMode){
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg';
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:1000px;">
          <div class="modal-head"><h3>🖨️ Xem trước bản in — Sổ vay vốn</h3><button class="modal-close" id="bvp-close">✕</button></div>
          <div class="modal-body" style="max-height:70vh; overflow:auto; background:#fff;">${printInnerHtml}</div>
          <div class="modal-foot">
            <span class="sub" style="margin-right:auto;">Đồng chí đang ở chế độ tham quan — đây chỉ là bản xem trước, không thể in thật.</span>
            <button class="btn btn-primary" id="bvp-close2">Đóng</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = ()=> wrap.remove();
      wrap.querySelector('#bvp-close').onclick = close;
      wrap.querySelector('#bvp-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      return;
    }
    const area = document.getElementById('print-area');
    if(!area) return;
    area.innerHTML = printInnerHtml;
    area.classList.add('landscape');
    window.print();
    setTimeout(()=> area.classList.remove('landscape'), 800);
  }

  function reportPeriodTitle(){
    const {from,to} = acctPeriodRange(undefined, undefined, 'acr');
    let periodLabel;
    if(state.acctMode==='quarter') periodLabel = timelineFilterLabel('acr').toUpperCase();
    else if(state.acctMode==='ycur' || state.acctMode==='yprev' || state.acctMode==='year') periodLabel = 'CẢ NĂM';
    else periodLabel = 'TOÀN BỘ THỜI GIAN';
    const year = (to || todayStr()).slice(0,4);
    return {periodLabel, year, from, to};
  }

  function buildReportHtml(){
    const cfg = state.config;
    const ov = computeProjectOverview();
    const {from,to,quarterSet} = acctPeriodRange(undefined, undefined, 'acr');
    const acct = computeAcctTotals(from,to,quarterSet);
    const retain = cfg.retainPercent||0;
    const {periodLabel, year} = reportPeriodTitle();
    const now = new Date();
    const otherTotal = Object.entries(acct.chiByCategory).filter(([k])=>k.startsWith(CAT_OTHER+':')).reduce((s,[,v])=>s+v,0);
    return `
      <div class="print-header">
        <div class="print-header-left">
          <div><b>${cfg.wardName ? hoiNongDanTitleHtml() : `HỘI NÔNG DÂN ${adminLevelLabel().toUpperCase()} ...`}</b></div>
          <div>BAN CHẤP HÀNH</div>
        </div>
        <div class="print-header-right">
          <div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b></div>
          <div><b>Độc lập - Tự do - Hạnh phúc</b></div>
          <div class="print-divider">-----------------</div>
        </div>
      </div>
      <h2 class="print-title" style="text-align:center;">BÁO CÁO TÌNH HÌNH VAY VỐN VÀ QUYẾT TOÁN THU - CHI TÀI CHÍNH<br>${periodLabel} / NĂM ${year}</h2>

      <div class="print-sec">I. Tình hình vay vốn toàn ${adminLevelLabelLower()}</div>
      <table class="print-table">
        <tr><td>Tổng số phương án vay đang hoạt động</td><td>${ov.activeCount}</td></tr>
        <tr><td>Tổng số phương án vay đã tất toán</td><td>${ov.settledCount}</td></tr>
        <tr><td>Tổng số hộ đang dư nợ toàn ${adminLevelLabelLower()}</td><td>${ov.totalBorrowers}</td></tr>
        <tr><td>Tổng dư nợ gốc toàn ${adminLevelLabelLower()}</td><td>${money(ov.totalOutstanding)}</td></tr>
      </table>
      <table class="print-table">
        <thead><tr><th>Phương án vay</th><th>${subAdminLabel()}</th><th>Phát vay</th><th>Đã thu hồi</th><th>Dư nợ còn lại</th><th>Trạng thái</th></tr></thead>
        <tbody>${ov.list.length? ov.list.map(p=>`<tr><td>${p.name}</td><td>${p.hamlets}</td><td>${money(p.disbursed)}</td><td>${money(p.recovered)}</td><td>${money(p.outstanding)}</td><td>${p.status}</td></tr>`).join('') : '<tr><td colspan="6">Chưa có dữ liệu</td></tr>'}</tbody>
      </table>

      <div class="print-sec">II. Quyết toán Thu - Chi tài chính kỳ ${fmtDate(from)} → ${fmtDate(to)}</div>
      <table class="print-table">
        <tr><td>Tổng số tiền lãi đã thu (toàn ${adminLevelLabelLower()})</td><td>${money(acct.thu)}</td></tr>
        <tr><td>Các ${subAdminLabelLower()} giữ lại (${retain}%)</td><td>${money(acct.giuLaiAp)}</td></tr>
        <tr><td>${adminLevelLabel()} được giữ lại (${100-retain}%)</td><td>${money(acct.xaNhan)}</td></tr>
        <tr><td>Chi về cho các ${subAdminLabelLower()}</td><td>${money(acct.chiByCategory[CAT_HAMLET]||0)}</td></tr>
        <tr><td>Chi họp hành / hội nghị</td><td>${money(acct.chiByCategory[CAT_MEETING]||0)}</td></tr>
        <tr><td>Chi mua văn phòng phẩm</td><td>${money(acct.chiByCategory[CAT_SUPPLIES]||0)}</td></tr>
        <tr><td>Chi công tác tập huấn</td><td>${money(acct.chiByCategory[CAT_TRAINING]||0)}</td></tr>
        <tr><td>Chi bồi dưỡng cán bộ hoạt động quỹ</td><td>${money(acct.chiByCategory[CAT_BONUS]||0)}</td></tr>
        <tr><td>Chi khác</td><td>${money(otherTotal)}</td></tr>
        <tr><td><b>Tổng cộng đã chi</b></td><td><b>${money(acct.chiTotal)}</b></td></tr>
        <tr><td><b>Số dư tồn quỹ ${adminLevelLabel()} còn lại</b></td><td><b>${money(acct.tonQuy)}</b></td></tr>
      </table>

      <div class="print-signdate">${cfg.wardName? cfg.wardName+', ':''}ngày ${now.getDate()} tháng ${now.getMonth()+1} năm ${now.getFullYear()}</div>
      <div class="print-signblock">
        <div class="print-sign-col"><b>Người lập biểu</b><div class="print-sign-note">(Ký, ghi rõ họ tên)</div><div class="print-sign-space"></div></div>
        <div class="print-sign-col"><b>TM. BAN CHẤP HÀNH<br>CHỦ TỊCH</b><div class="print-sign-note">(Ký tên, đóng dấu)</div><div class="print-sign-space"></div></div>
      </div>`;
  }

  function printReport(){
    const area = document.getElementById('print-area');
    if(area) area.innerHTML = buildReportHtml();
    window.print();
  }

  function exportReportWord(){
    downloadBlob(`Bao-cao-tai-chinh_${todayStr()}.doc`, htmlToWordDoc('Báo cáo tài chính', buildReportHtml()), 'application/msword');
  }

  function exportBackupJSON(){
    const backup = {
      _type: 'quan-ly-tai-chinh-hoi-nong-dan-backup',
      exportedAt: new Date().toISOString(),
      config: state.config, // đã bao gồm publicPerms/grants (phân quyền Loại 1 & Loại 2)
      borrowers: state.borrowers,
      expenses: state.expenses,
      trash: state.trash,
    };
    downloadBlob(`Sao-luu-du-lieu_${todayStr()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  }

  async function importBackupJSON(file){
    if(!file) return;
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(!data || !data.config || !Array.isArray(data.borrowers)){ alert('File sao lưu không hợp lệ hoặc không đúng định dạng.'); return; }
      if(!confirm(`Khôi phục sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại của ${adminLevelLabel()} "${wardId()}" trên đám mây (hộ vay, chi tiêu, cấu hình, nhật ký, thùng rác) bằng dữ liệu trong file sao lưu. Đồng chí có chắc chắn muốn tiếp tục?`)) return;
      // "Mã ẩn" (secretId) và Chủ mã (ownerEmail) thuộc về "con trỏ" ĐANG active — TUYỆT ĐỐI không
      // để file sao lưu (vốn có thể được xuất ra từ một mã KHÁC, mang secretId khác) ghi đè mất,
      // nếu không dữ liệu vừa nhập (borrowers/expenses...) sẽ bị lưu lệch sang đúng secretId cũ chứ
      // không phải secretId của mã đang mở, gây "ông nói gà bà nói vịt" giữa con trỏ và dữ liệu thật.
      const importedCfg = { ...data.config, secretId: state.config.secretId, ownerEmail: state.config.ownerEmail };
      await cSet('config', importedCfg);
      await cSet('borrowers', byId(data.borrowers||[]));
      await cSet('expenses', byId(data.expenses||[]));
      await cSet('trash', byId(data.trash||[]));
      await cSet('collaborators', data.collaborators||{});
      await pushLog('khôi phục', 'toàn bộ dữ liệu từ file sao lưu');
      alert('Khôi phục dữ liệu thành công! Các thiết bị khác đang mở app sẽ tự động cập nhật theo.');
      // dữ liệu trên màn hình sẽ tự cập nhật qua các listener onValue (attachRealtime)
    }catch(e){
      alert('Không đọc được file sao lưu. Vui lòng kiểm tra lại file .json.');
    }
  }

