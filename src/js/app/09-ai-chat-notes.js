  // =====================================================================
  // Không gian [Ghi chú nhanh] — tên nội bộ vẫn là quickNote*/sn-* trong mã.
  //
  // Trước đây module này có cây thư mục và hai không gian lưu trữ riêng, trùng
  // hoàn toàn với Trung tâm dữ liệu. Nay nó chỉ còn ĐÚNG MỘT việc: soạn nội
  // dung (gõ chữ, nói, hoặc tải ảnh/PDF/tài liệu để AI tiêu hoá) rồi lưu kết
  // quả vào Trung tâm dữ liệu — Bộ cá nhân, qua modal chọn thư mục.
  //
  // Khung bên trái vì thế rất tối giản: chỉ còn lối thoát và lối sang Chat AI.
  // Chỗ trống bên dưới dành cho các nâng cấp sau này.
  // =====================================================================
  function renderQuickNoteOverlay(){
    const draftInput = document.getElementById('qn-input');
    if(draftInput && !state._qnDraftCaptureSuppressed) state._qnDraftText = draftInput.value;
    let overlay = document.getElementById('quick-note-overlay');
    let firstCreate = false;
    if(!overlay){
      overlay = document.createElement('div'); overlay.id = 'quick-note-overlay'; overlay.className = 'ai-overlay';
      document.body.appendChild(overlay);
      firstCreate = true;
    }
    const provider = getActiveAiProvider();

    overlay.innerHTML = `
      <div class="ai-sidebar ${state._qnSidebarCollapsed?'collapsed':''}" id="qn-sidebar" style="display:flex; flex-direction:column;">
        <div class="ai-side-title">${waveTextHtmlSlow('Ghi chú nhanh')}</div>
        <button class="ai-exit-btn" id="qn-exit-btn">✕ THOÁT</button>
        <button class="ai-newchat-btn" id="qn-goto-chat-btn">💬 Chat với AI Chàng Nông dân Thông minh</button>
        <button class="ai-newchat-btn" id="qn-goto-drive-btn">🗂️ Mở Trung tâm dữ liệu</button>
        <div class="qn-side-note">
          <b>Ghi chú nhanh</b>
          <span>Soạn nội dung ở khung bên phải. Xong, đồng chí chọn thư mục trong Trung tâm dữ liệu để lưu.</span>
        </div>
      </div>
      <button class="ai-sidebar-toggle-btn preview-allow ${state._qnSidebarCollapsed?'collapsed':''}" id="qn-sidebar-toggle-btn" title="${state._qnSidebarCollapsed?'Mở khung thao tác':'Đóng khung thao tác'}">${state._qnSidebarCollapsed?'▶':'◀'}</button>
      <div class="ai-sidebar-scrim ${!state._qnSidebarCollapsed?'show':''}" id="qn-sidebar-scrim"></div>
      <button class="ai-close-fab preview-allow" id="qn-close-fab" title="Đóng Ghi chú nhanh">✕</button>
      <div class="ai-main ${state._qnSidebarCollapsed?'ai-sidebar-collapsed':''}" id="qn-main-panel">
        <div class="ai-header">🗒️ Ghi chú nhanh</div>
        ${state.previewMode? `<div class="admin-view-banner" style="background:#7a5b00; color:#fff3cd;">⚠️ Đồng chí đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.</div>` : ''}
        <div class="ai-messages" id="qn-content-area" style="align-items:stretch;">
          <div class="ai-bubble assistant">Chào đồng chí! Đây là <b>Ghi chú nhanh</b> 📓 — gõ chữ, nói, hoặc tải ảnh/PDF/tài liệu vào khung bên dưới, AI sẽ đọc và biên tập sạch sẽ thành một ghi chú.<br><br>
          Ghi chú tạo xong được lưu vào <b>Trung tâm dữ liệu</b> (Bộ cá nhân) — đồng chí chọn thư mục lúc lưu, hoặc bấm lưu nhanh vào thư mục “Ghi chú nhanh”.</div>
          ${state.quickNoteJustCompletedMsg? `<div class="kn-done-banner">✅ ${escapeHtml(state.quickNoteJustCompletedMsg)}</div>` : ''}
          ${state.quickNoteReviewMode? `
            ${(state.quickNoteReviewTurns||[]).map(t=>`
              <div class="ai-bubble-wrap user">
                <div class="ai-bubble user">${t.text? escapeHtml(t.text) : ''}${t.files&&t.files.length? `<div class="ai-bubble-attach">${t.files.map(f=>`<span class="ai-attach-chip">📎 ${escapeHtml(f.name)}</span>`).join('')}</div>` : ''}</div>
              </div>`).join('')}
            <div class="ai-bubble assistant">Tôi đã xem tài liệu và ghi chú của đồng chí, bây giờ đồng chí hãy tiếp tục bổ sung thêm những thành phần tiếp theo ở khung chat bên dưới để hoàn thiện tệp ghi chú này. Nếu đồng chí không muốn bổ sung gì nữa, hãy chọn các phương án dưới đây:
              <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
                <button class="btn btn-primary btn-sm" id="qn-review-digest">✅ Hãy tiêu hoá tài liệu bằng AI và tạo ghi chú thành công</button>
                <button class="btn btn-ghost btn-sm" id="qn-review-skip">⏭️ Bỏ qua bước tiêu hoá tài liệu bằng AI và tạo ghi chú thành công luôn!</button>
              </div>
            </div>` : ''}
          ${state.quickNoteStoppedConfirm? `
            <div class="ai-bubble assistant">Đồng chí đã bắt AI dừng tiêu hoá ghi chú và tài liệu của đồng chí, đồng chí có muốn đưa thẳng mọi thứ vào ghi chú mà không cần tiêu hoá không?
              <div style="display:flex; gap:8px; margin-top:12px;">
                <button class="btn btn-primary btn-sm" id="qn-stopped-yes">Có</button>
                <button class="btn btn-ghost btn-sm" id="qn-stopped-no">Không</button>
              </div>
            </div>` : ''}
          ${state.quickNoteProcessing? `
            <div class="ai-bubble assistant thinking" style="display:flex; align-items:center; gap:12px; justify-content:space-between;">
              <span>⏳ ${waveTextHtml(state.quickNoteProcessingMsg||'Đang xử lý')}</span>
              <button class="btn btn-ghost btn-sm" id="qn-stop-btn" style="flex-shrink:0; white-space:nowrap;">⏹ Dừng lại</button>
            </div>` : ''}
        </div>

        <div class="ai-model-bar">
          <div class="ai-model-select" id="qn-model-select">
            <span>${provider? `🧠 ${escapeHtml(provider.label||provider.model)}` : '⚠️ Chưa cấu hình AI'}</span><span class="ai-model-caret">▾</span>
            ${state._aiModelMenuOpen? `<div class="ai-model-dropdown">
              ${state.aiProviders.length? state.aiProviders.map(p=>`
                <div class="ai-model-opt ${provider&&p.id===provider.id?'active':''}" data-qn-select-provider="${p.id}">
                  ${escapeHtml(p.label||p.model)}<span class="sub">${escapeHtml(p.model)}</span>
                </div>`).join('') : `<div class="ai-model-opt sub">Chưa có cấu hình AI nào — vào "CÀI ĐẶT ADMIN" để thêm.</div>`}
            </div>` : ''}
          </div>
          <span class="ai-model-select" style="margin-left:8px; background:rgba(199,154,43,.1); cursor:default;">💡 Ưu tiên dùng Gemini để đọc ảnh/PDF chính xác nhất</span>
        </div>

        ${state.quickNotePendingFiles.length? `<div class="ai-attach-row">
          ${state.quickNotePendingFiles.map((f,i)=>`<span class="ai-attach-chip">📎 ${escapeHtml(f.name)} <button data-qn-pending-remove="${i}" ${state.quickNoteProcessing?'disabled':''}>✕</button></span>`).join('')}
        </div>` : ''}

        <div class="ai-inputbar">
          <div class="ai-add-btn" id="qn-add-btn" role="button" tabindex="0">➕<span class="ai-add-label"> Tải tài liệu lên</span>
            ${state._aiAddMenuOpen? `<div class="ai-add-menu">
              <div class="ai-add-opt" data-qn-add="file">📄 Tải tài liệu lên (ảnh/PDF/Word/Excel...)</div>
              <div class="ai-add-opt" data-qn-add="folder">🗂️ Thêm thư mục (nhiều tệp cùng lúc)</div>
              <div class="ai-add-opt${state._qnMic2Listening?' ai-add-opt-disabled':''}" data-qn-add="mic">🎤 ${state._qnMicListening? '✅ Đang nghe — bấm để dừng' : 'Vừa nói vừa ra chữ'}</div>
              <div class="ai-add-opt${state._qnMicListening?' ai-add-opt-disabled':''}" data-qn-add="mic2">🎙️ ${state._qnMic2Listening? '✅ Đang nghe — bấm để dừng' : 'Nói xong mới ra chữ'}</div>
            </div>` : ''}
          </div>
          <textarea id="qn-input" rows="1" placeholder="Gõ nội dung, hoặc tải ảnh/PDF/tài liệu để AI tự tạo ghi chú... (Enter xuống dòng, Ctrl+Enter gửi)" ${state.quickNoteProcessing?'disabled':''}>${escapeHtml(state._qnDraftText||'')}</textarea>
          <div class="ai-send-wrap">
            <span class="ai-send-tooltip">Bấm Ctrl+Enter để gửi nhanh</span>
            <button id="qn-send-btn" ${state.quickNoteProcessing?'disabled':''}>➤</button>
          </div>
        </div>
      </div>`;

    const contentArea = document.getElementById('qn-content-area');
    if(contentArea) contentArea.scrollTop = contentArea.scrollHeight;

    document.getElementById('qn-exit-btn').onclick = closeQuickNote;
    const snCloseFab = document.getElementById('qn-close-fab');
    if(snCloseFab) snCloseFab.onclick = closeQuickNote;
    // Đóng/mở khung danh sách ghi chú bên trái — hiệu ứng, cách hoạt động y hệt module Chat AI.
    const blurQnInputIfAny = ()=>{ const inp = document.getElementById('qn-input'); if(inp && document.activeElement===inp) inp.blur(); };
    const snSidebarToggleBtn = document.getElementById('qn-sidebar-toggle-btn');
    if(snSidebarToggleBtn) snSidebarToggleBtn.onclick = (e)=>{
      e.stopPropagation();
      state._qnSidebarCollapsed = !state._qnSidebarCollapsed;
      renderQuickNoteOverlay();
      requestAnimationFrame(blurQnInputIfAny);
    };
    const snSidebarScrim = document.getElementById('qn-sidebar-scrim');
    if(snSidebarScrim) snSidebarScrim.onclick = ()=>{ state._qnSidebarCollapsed = true; renderQuickNoteOverlay(); requestAnimationFrame(blurQnInputIfAny); };
    const snMainPanel = document.getElementById('qn-main-panel');
    if(snMainPanel) snMainPanel.addEventListener('click', (e)=>{
      if(!isNarrowScreenForSidebar()) return;
      if(state._qnSidebarCollapsed) return;
      e.preventDefault();
      e.stopPropagation();
      state._qnSidebarCollapsed = true;
      renderQuickNoteOverlay();
      requestAnimationFrame(blurQnInputIfAny);
    }, true);
    document.getElementById('qn-goto-chat-btn').onclick = ()=>{ closeQuickNote(); openAiChat(); };
    const gotoDriveBtn = document.getElementById('qn-goto-drive-btn');
    if(gotoDriveBtn) gotoDriveBtn.onclick = ()=>{ closeQuickNote(); switchTab('drive'); };

    // ---- thanh chọn model AI (dùng chung logic với Chat AI) ----
    const modelSelectEl = document.getElementById('qn-model-select');
    if(modelSelectEl) modelSelectEl.addEventListener('click', (e)=>{ e.stopPropagation(); toggleAiModelMenu(); });
    overlay.querySelectorAll('[data-qn-select-provider]').forEach(elx=>{
      elx.addEventListener('click', (e)=>{ e.stopPropagation(); selectAiProvider(elx.dataset.qnSelectProvider); renderQuickNoteOverlay(); });
    });

    // ---- nút "Tải tài liệu lên" (đổi tên từ "THÊM THÀNH PHẦN") — chỉ THÊM vào danh sách chờ,
    // KHÔNG xử lý ngay, để người dùng xem lại/gỡ bớt trước khi tự bấm Gửi ----
    const addBtn = document.getElementById('qn-add-btn');
    if(addBtn) addBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      state._aiAddMenuOpen = !state._aiAddMenuOpen;
      // Ô nhập liệu <textarea id="qn-input"> KHÔNG hề gắn với biến trạng thái nào (chỉ là DOM thao tác
      // tay thuần tuý) — nên mỗi lần vẽ lại TOÀN BỘ khung, ô này sẽ bị dựng lại RỖNG, xoá sạch chữ đang
      // gõ dở. Lưu lại giá trị TRƯỚC khi vẽ lại, rồi khôi phục lại NGAY SAU đó.
      const inputEl = document.getElementById('qn-input');
      const savedValue = inputEl ? inputEl.value : '';
      renderQuickNoteOverlay();
      const inputElAfter = document.getElementById('qn-input');
      if(inputElAfter && savedValue) inputElAfter.value = savedValue;
      if(inputElAfter) autoResizeTextarea(inputElAfter);
    });
    overlay.querySelectorAll('[data-qn-add]').forEach(elx=>{
      elx.addEventListener('click', (e)=>{
        e.stopPropagation();
        state._aiAddMenuOpen = false;
        if(elx.dataset.qnAdd==='mic' || elx.dataset.qnAdd==='mic2'){
          // Đóng NGAY menu bằng thao tác DOM trực tiếp — 2 hàm mic bên dưới không được phép vẽ lại toàn
          // bộ khung (sẽ làm mất chữ đang gõ dở), nên chỉ đặt state không đủ để menu biến mất trên màn
          // hình, phải tự tay gỡ khung menu khỏi trang ngay tại đây.
          const menuEl = document.querySelector('#qn-add-btn .ai-add-menu');
          if(menuEl) menuEl.remove();
          if(elx.dataset.qnAdd==='mic') toggleNotesMic(); else toggleNotesMic2();
          return;
        }
        const input = document.createElement('input');
        input.type = 'file'; input.multiple = true;
        if(elx.dataset.qnAdd==='folder') input.webkitdirectory = true;
        input.onchange = ()=>{
          state.quickNotePendingFiles = state.quickNotePendingFiles.concat(Array.from(input.files||[]));
          renderQuickNoteOverlay();
        };
        input.click();
      });
    });
    overlay.querySelectorAll('[data-qn-pending-remove]').forEach(btn=>{
      btn.onclick = ()=>{
        state.quickNotePendingFiles.splice(parseInt(btn.dataset.qnPendingRemove,10), 1);
        renderQuickNoteOverlay();
      };
    });

    // ---- Dừng lại giữa chừng khi AI đang tiêu hoá — huỷ request đang chạy, GIỮ NGUYÊN nội dung/tệp ----
    const stopBtn = document.getElementById('qn-stop-btn');
    if(stopBtn) stopBtn.onclick = ()=>{ if(state.quickNoteAbortController) state.quickNoteAbortController.abort(); };

    // ---- Xác nhận trước khi tiêu hoá (2 nút) ----
    const reviewDigestBtn = document.getElementById('qn-review-digest');
    if(reviewDigestBtn) reviewDigestBtn.onclick = ()=> finalizeQuickNoteReview(true);
    const reviewSkipBtn = document.getElementById('qn-review-skip');
    if(reviewSkipBtn) reviewSkipBtn.onclick = ()=> finalizeQuickNoteReview(false);

    // ---- Xác nhận sau khi bấm Dừng (Có/Không đưa thẳng vào ghi chú) ----
    const stoppedYesBtn = document.getElementById('qn-stopped-yes');
    if(stoppedYesBtn) stoppedYesBtn.onclick = ()=> resolveQuickNoteStoppedConfirm(true);
    const stoppedNoBtn = document.getElementById('qn-stopped-no');
    if(stoppedNoBtn) stoppedNoBtn.onclick = ()=> resolveQuickNoteStoppedConfirm(false);

    // Bấm ra ngoài thì đóng dropdown "THÊM/model" (gắn 1 lần duy nhất lúc tạo overlay)
    if(firstCreate){
      qnOutsideClickHandler = ()=>{
        if(state._aiModelMenuOpen || state._aiAddMenuOpen){
          state._aiModelMenuOpen = false; state._aiAddMenuOpen = false;
          if(document.getElementById('quick-note-overlay')) renderQuickNoteOverlay();
        }
      };
      document.addEventListener('click', qnOutsideClickHandler);
    }

    // ---- gửi nội dung gõ tay + tệp đang chờ -> ĐƯA VÀO BƯỚC XÁC NHẬN trước khi tiêu hoá ----
    const sendBtn = document.getElementById('qn-send-btn');
    const inputEl = document.getElementById('qn-input');
    const doSend = ()=>{
      const v = inputEl.value;
      if(!v.trim() && !state.quickNotePendingFiles.length) return;
      const files = state.quickNotePendingFiles.slice();
      // Chuyển gói vừa gửi khỏi draft đang hiển thị. queueQuickNoteForReview() sẽ vẽ lại overlay,
      // nên tạm ngăn render bắt lại nội dung cũ từ textarea trước khi nó bị xoá.
      state._qnDraftText = '';
      state._qnDraftCaptureSuppressed = true;
      try{
        queueQuickNoteForReview(v, files);
        inputEl.value = '';
        state.quickNotePendingFiles = [];
        renderQuickNoteOverlay();
      }finally{
        state._qnDraftCaptureSuppressed = false;
      }
    };
    if(sendBtn) sendBtn.onclick = doSend;
    wireAutoResizeTextarea('qn-input');
    if(inputEl){
      inputEl.addEventListener('keydown', (e)=>{
        if(e.key==='Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); doSend(); }
      });
    }
  }

  function renderLogin(){
    root.innerHTML = `
      <div class="center-screen">
        <div class="auth-card">
          <div class="auth-brand">hoinongdan.sotay.org</div>
          <div class="rice-badge">🌾</div>
          <h1>Sổ tay Công tác<br>Hội Nông dân cấp xã/phường</h1>
          <p class="sub">Đăng nhập để quản lý công tác hội, thực lực hội, hội viên, quỹ hỗ trợ nông dân, thu chi nội bộ, vốn vay, lãi suất và báo cáo địa phương</p>
          <button class="btn btn-gold btn-block" id="li-btn">🔒 Đăng nhập bằng Google</button>
          <button class="btn btn-ghost btn-block" id="li-preview" style="margin-top:8px;">👀 Tham quan mà không cần đăng nhập</button>

          <div class="divider-lbl">Hoặc tham gia bằng mã định danh có sẵn</div>
          <div class="field" style="text-align:left;"><label>Mã định danh</label><input id="li-wardid" placeholder="vd: xabinhminh" style="text-transform:lowercase;"></div>
          <div class="field" style="text-align:left;"><label>Mật khẩu</label><input id="li-pass" type="text" placeholder="Để trống nếu không có"></div>
          <button class="btn btn-primary btn-block" id="li-joincode">Tham gia bằng mã này</button>
        </div>
      </div>`;
    document.getElementById('li-btn').onclick = async ()=>{
      const btn = document.getElementById('li-btn');
      btn.disabled = true; btn.textContent = 'Đang mở cửa sổ đăng nhập Google…';
      try{
        await auth.signInWithPopup(googleProvider);
        // Kết quả đăng nhập sẽ được xử lý tự động trong auth.onAuthStateChanged (boot()).
      }catch(e){
        console.error('Đăng nhập Google lỗi:', e);
        if(!(e && e.code==='auth/popup-closed-by-user')){
          alert('Đăng nhập Google thất bại. Vui lòng kiểm tra kết nối mạng, hoặc liên hệ quản trị viên để bật "Google" trong Firebase Console > Authentication > Sign-in method.');
        }
        btn.disabled = false; btn.textContent = '🔒 Đăng nhập bằng Google';
      }
    };
    document.getElementById('li-preview').onclick = enterPreviewMode;
    document.getElementById('li-joincode').onclick = ()=>{
      joinWardAsCodeGuest(document.getElementById('li-wardid').value, document.getElementById('li-pass').value);
    };
  }

  // Hiện đúng 1 lần cho tài khoản Google hoàn toàn mới (chưa có mã xã nào trong Ví).
  // Theo đúng yêu cầu 4: thu thập Họ tên/Chức vụ, rồi 3 lựa chọn RIÊNG BIỆT — Tạo mã mới,
  // Tham gia bằng mã có sẵn, hoặc Bỏ qua (chỉ dùng Thu–Chi nội bộ lưu trên máy).
  function renderWelcome(){
    const idn = state.identity;
    root.innerHTML = `
      <div class="center-screen">
        <div class="auth-card">
          <div class="rice-badge">🌾</div>
          <h1>Xin chào, ${idn.name||idn.email}</h1>
          <p class="sub">Đã xác thực Google: <b>${idn.email}</b></p>
          <div class="field" style="text-align:left;"><label>Họ và tên *</label><input id="wc-name" value="${idn.name||''}"></div>
          <div class="field" style="text-align:left;"><label>Chức vụ của đồng chí là gì <span class="sub">(có thể để trống)</span></label><input id="wc-title" placeholder="Chủ tịch Hội, Chi hội trưởng,..." value="${idn.officerTitle||''}"></div>

          <div class="divider-lbl">Kết nối với mã định danh cấp xã</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="btn btn-primary btn-block" id="wc-mode-new">➕ Tạo mã định danh cấp xã mới</button>
            <button class="btn btn-gold btn-block" id="wc-mode-join">🔑 Tham gia bằng mã định danh cấp xã</button>
            <button class="btn btn-ghost btn-block" id="wc-mode-random">🎲 Làm việc mà không cần mã (mã tạo ngẫu nhiên)</button>
          </div>
          <p class="sub" style="margin-top:10px; font-size:11.5px; text-align:left;">
            Mã định danh cấp xã/phường là "chìa khoá" để kết nối dữ liệu chung của một địa phương. Nếu đồng chí <b>tạo mã mới</b>
            (mã chưa từng tồn tại), đồng chí sẽ là <b>CHỦ MÃ</b> — người duy nhất có quyền cấu hình và cấp quyền cho người khác.
            Nếu đồng chí <b>tham gia bằng mã đã có</b>, đồng chí sẽ là <b>KHÁCH</b> — chỉ thao tác được trong phạm vi Chủ mã cho phép.
            Nếu chưa muốn nghĩ tên mã, hệ thống có thể <b>tự động cấp ngay một mã ngẫu nhiên 4 ký tự</b> để đồng chí có nơi lưu dữ
            liệu ngay lập tức — đồng chí vẫn có toàn quyền sử dụng mọi công cụ như Chủ mã, và có thể đổi sang tên dễ nhớ hơn bất
            cứ lúc nào sau này trong mục "Cài đặt &amp; Chia sẻ".
          </p>

          <div id="wc-subarea" style="margin-top:6px;"></div>
          <button class="btn btn-ghost btn-block" id="wc-logout" style="margin-top:16px;">Đăng xuất tài khoản này</button>
        </div>
      </div>`;

    // Họ và tên là thông tin BẮT BUỘC (yêu cầu 3) — trả về false và báo lỗi nếu còn trống.
    const saveNameTitle = ()=>{
      const nameVal = document.getElementById('wc-name').value.trim();
      if(!nameVal){ alert('Vui lòng nhập Họ và tên trước khi tiếp tục.'); document.getElementById('wc-name').focus(); return false; }
      state.identity.name = nameVal;
      state.identity.officerTitle = (document.getElementById('wc-title').value||'').trim();
      lset(IDENTITY_KEY, state.identity);
      lset(seenWelcomeKey(idn.email), true);
      return true;
    };

    // Yêu cầu 1: đã BỎ HOÀN TOÀN khái niệm "mã rỗng bị hạn chế module" — bấm nút này sẽ được
    // TỰ ĐỘNG CẤP một Mã định danh ngẫu nhiên 4 ký tự (không trùng lặp) rồi vào thẳng màn hình
    // thiết lập thông tin cơ bản cho mã đó, hoàn toàn full quyền như mọi Chủ mã khác.
    document.getElementById('wc-mode-random').onclick = async ()=>{
      if(!saveNameTitle()) return;
      state._onboardingReturnView = 'welcome';
      await createRandomWardAndOnboard();
    };
    document.getElementById('wc-mode-new').onclick = ()=>{
      const area = document.getElementById('wc-subarea');
      area.innerHTML = `
        <div class="divider-lbl">Tạo mã định danh cấp xã mới</div>
        <div class="form-grid">
          <div class="field"><label>Mã định danh mới *</label><input id="wc-new-id" placeholder="vd: xabinhminh" style="text-transform:lowercase;"></div>
          <div class="field"><label>Mật khẩu (không bắt buộc)</label><input id="wc-new-pass" type="password"></div>
        </div>
        <button class="btn btn-primary btn-block" id="wc-new-confirm">Xác nhận tạo mã</button>`;
      area.scrollIntoView({behavior:'smooth', block:'start'});
      document.getElementById('wc-new-confirm').onclick = async ()=>{
        if(!saveNameTitle()) return;
        state._onboardingReturnView = 'welcome';
        await createWardStrict(document.getElementById('wc-new-id').value, document.getElementById('wc-new-pass').value);
      };
    };
    document.getElementById('wc-mode-join').onclick = ()=>{
      const area = document.getElementById('wc-subarea');
      area.innerHTML = `
        <div class="divider-lbl">Tham gia bằng mã định danh đã có</div>
        <div class="form-grid">
          <div class="field"><label>Mã định danh *</label><input id="wc-join-id" placeholder="vd: xabinhminh" style="text-transform:lowercase;"></div>
          <div class="field"><label>Mật khẩu (nếu có)</label><input id="wc-join-pass" type="password"></div>
        </div>
        <button class="btn btn-primary btn-block" id="wc-join-confirm">Tham gia bằng mã này</button>`;
      area.scrollIntoView({behavior:'smooth', block:'start'});
      document.getElementById('wc-join-confirm').onclick = async ()=>{
        if(!saveNameTitle()) return;
        await joinWardStrict(document.getElementById('wc-join-id').value, document.getElementById('wc-join-pass').value);
      };
    };
    document.getElementById('wc-logout').onclick = async ()=>{ await auth.signOut(); };
  }

  // "Ví mã xã" — màn hình toàn trang, hiện khi chưa chọn mã xã nào để làm việc
  // (sau khi đăng xuất mã xã, hoặc mã đang xem bị Chủ mã xoá/đổi mật khẩu).
  function renderWallet(){
    root.innerHTML = `
      <div class="center-screen" style="align-items:flex-start; padding:40px 16px;">
        <div class="auth-card" style="max-width:640px; text-align:left;">
          <div class="rice-badge" style="margin:0 0 14px;">🗂️</div>
          <h1 style="text-align:left;">Ví mã định danh cấp Xã/Phường</h1>
          <p class="sub" style="text-align:left;">${state.identity.name} · ${state.identity.email}</p>
          <div id="wallet-panel-mount"></div>
          <button class="btn btn-ghost btn-block" id="wallet-logout" style="margin-top:18px;">Đăng xuất tài khoản Google</button>
        </div>
      </div>`;
    renderWardWalletPanel(document.getElementById('wallet-panel-mount'), {embedded:false});
    document.getElementById('wallet-logout').onclick = async ()=>{ await auth.signOut(); };
  }

  // Màn hình chờ duyệt — hiện khi tài khoản là KHÁCH của mã xã đang chọn nhưng Chủ mã
  // chưa cấp quyền Xem/Sửa (và mã xã cũng không bật "Cho phép xem tự do").
  function renderPendingScreen(){
    root.innerHTML = `
      <div class="center-screen">
        <div class="auth-card">
          <div class="rice-badge">⏳</div>
          <h1>Quyền truy cập đang chờ duyệt</h1>
          <p class="sub">Đồng chí đã tham gia mã xã <b>${wardId()}</b>${state.config&&state.config.wardName?` (${wardTitle()})`:''} với vai trò KHÁCH,
            nhưng Chủ mã chưa cấp quyền Xem/Sửa cho tài khoản <b>${state.identity.email}</b>.</p>
          <p class="sub">Vui lòng liên hệ Chủ mã để được cấp quyền tại mục "Cài đặt &amp; Chia sẻ" của họ.</p>
          <button class="btn btn-primary btn-block" id="pd-wallet">↩ Quay lại Ví mã xã</button>
          <button class="btn btn-ghost btn-block" id="pd-remove" style="margin-top:8px;">Xoá mã này khỏi tài khoản</button>
        </div>
      </div>`;
    document.getElementById('pd-wallet').onclick = exitToWallet;
    document.getElementById('pd-remove').onclick = ()=> guestRemoveWard(wardId());
  }

  // ---------------------------------------------------------------------
  // Khối HTML/sự kiện dùng CHUNG cho "Ví mã xã" — tái sử dụng ở cả màn hình
  // toàn trang (renderWallet) lẫn nhúng trong tab "Cài đặt & Chia sẻ".
  // ---------------------------------------------------------------------
  function renderWardWalletPanel(mountEl, opts){
    const embedded = !!(opts && opts.embedded);
    const rows = state.myWards.slice().sort((a,b)=> (a.wardName||a.wardId).localeCompare(b.wardName||b.wardId));
    const rowHtml = w=>{
      const active = wardId()===w.wardId;
      const deleted = w.live && w.live.deleted;
      const needsReauth = w.kind==='guest' && w.live && (w.live.accessVersion||0) !== (w.av||0) && !deleted;
      return `
        <div class="ward-row ${active?'active':''}" data-ward="${w.wardId}" style="display:flex; align-items:center; gap:10px; padding:11px 12px; border:1px solid var(--line); border-radius:10px; margin-bottom:8px; cursor:pointer; ${active?'background:rgba(47,74,60,.08); border-color:var(--rice-dark);':''}">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${w.wardName || `(chưa đặt tên) — ${w.wardId}`}</div>
            <div class="sub" style="font-size:11.5px;">Mã: <span class="mono">${w.wardId}</span>${deleted?' · <span style="color:var(--red);">Đã bị Chủ mã xoá</span>':''}${needsReauth?' · <span style="color:var(--orange);">Cần nhập lại mật khẩu mới</span>':''}</div>
          </div>
          <span class="tag-role" style="background:${w.kind==='owner'?'#1f8a4c':'#1f6fa8'}; color:#fff; font-size:11px; padding:3px 9px; border-radius:20px; font-weight:700;">${w.kind==='owner'?'CHỦ MÃ':'KHÁCH'}</span>
          <button class="btn btn-ghost btn-sm" data-ward-remove="${w.wardId}" title="${w.kind==='owner'?'Xoá mã này':'Xoá khỏi tài khoản'}">🗑️</button>
        </div>`;
    };
    mountEl.innerHTML = `
      <div class="divider-lbl">Các mã xã của tôi (${rows.length})</div>
      ${rows.length? rows.map(rowHtml).join('') : '<div class="empty-state" style="padding:14px 0;">Đồng chí chưa sở hữu hoặc tham gia mã xã nào.</div>'}

      <button class="btn btn-gold ${embedded?'':'btn-block'}" id="ww-random" style="margin-top:4px;">🎲 Làm việc mà không cần mã (mã tạo ngẫu nhiên)</button>

      <div class="divider-lbl">Tạo mã mới / Tham gia bằng mã đã có</div>
      <div class="form-grid">
        <div class="field"><label>Mã định danh cấp Xã/Phường</label><input id="ww-wardid" placeholder="vd: xabinhminh" style="text-transform:lowercase;"></div>
        <div class="field"><label>Mật khẩu mã xã (nếu có)</label><input id="ww-pass" type="password" placeholder="Để trống nếu không có"></div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn-primary" id="ww-create" style="flex:1; min-width:160px;">➕ Tạo mã mới</button>
        <button class="btn" style="flex:1; min-width:160px; background:#0d3b78; color:#fff;" id="ww-joinbtn">🔑 Tham gia bằng mã này</button>
      </div>

      <div style="background:rgba(47,74,60,.06); border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-top:14px;">
        <b style="font-size:13px; color:var(--rice-dark);">💡 Mã định danh cấp Xã/Phường là gì?</b>
        <p class="sub" style="margin:6px 0 0; font-size:11.5px; line-height:1.6;">
          Đây là "chìa khoá" để kết nối dữ liệu chung của một địa phương trên đám mây. Ai <b>tạo mã mới</b> (mã chưa từng tồn tại)
          sẽ trở thành <b>CHỦ MÃ</b> — người duy nhất có toàn quyền cấu hình và cấp quyền Xem/Sửa cho người khác. Ai
          <b>tham gia bằng mã đã có</b> (đúng mã + mật khẩu, nếu có) sẽ là <b>KHÁCH</b> — chỉ thao tác trong phạm vi được Chủ mã cho phép.
          Một tài khoản Google có thể sở hữu/tham gia <b>nhiều mã</b> cùng lúc và chuyển qua lại thoải mái ở Ví mã xã này.
          Nếu chưa muốn nghĩ tên mã, hãy dùng nút <b>"🎲 Làm việc mà không cần mã"</b> ở trên — hệ thống sẽ tự cấp ngay một mã
          ngẫu nhiên để đồng chí có nơi lưu dữ liệu ngay lập tức, và có thể đổi sang tên dễ nhớ hơn bất cứ lúc nào sau này trong Cài đặt.
        </p>
      </div>

      <div class="divider-lbl" id="ww-trash-toggle" style="cursor:pointer; user-select:none;">🗑️ Mã xã đã xoá của tôi (${state.myDeletedWards.length}) ${state.walletTrashOpen?'▴':'▾'}</div>
      <div id="ww-trash-body" style="${state.walletTrashOpen?'':'display:none;'}">
        ${state.myDeletedWards.length? state.myDeletedWards.map(d=>`
          <div class="kv-row"><span>${d.wardName||'(chưa đặt tên)'} <span class="sub">(${d.wardId})</span></span>
            <span style="display:flex; gap:8px;">
              <button class="btn btn-ghost btn-sm" data-restore-ward="${d.wardId}">Khôi phục</button>
              <button class="btn btn-ghost btn-sm" data-purge-ward="${d.wardId}" style="color:var(--red);">Xoá vĩnh viễn</button>
            </span>
          </div>`).join('') : '<div class="sub" style="padding:6px 0 14px;">Trống.</div>'}
        <p class="sub" style="margin:6px 0 0; font-size:11.5px;">💬 Để khôi phục lại mã định danh đã bị xoá vĩnh viễn, vui lòng liên hệ với chủ website này!</p>
      </div>

      ${isSiteOwner() ? `
        <div class="divider-lbl">🛡️ Thùng rác hệ thống (Quản trị viên trang web)</div>
        ${state.sysTrash.length? state.sysTrash.map(d=>`
          <div class="kv-row"><span>${d.wardName||'(chưa đặt tên)'} <span class="sub">(${d.wardId} — chủ cũ: ${d.ownerEmail})</span></span>
            <span style="display:flex; gap:8px;">
              <button class="btn btn-ghost btn-sm" data-super-restore="${d.wardId}">Khôi phục cho chủ</button>
              <button class="btn btn-ghost btn-sm" data-super-purge="${d.wardId}" style="color:var(--red);">Xoá vĩnh viễn</button>
            </span>
          </div>`).join('') : '<div class="sub" style="padding:6px 0 14px;">Trống.</div>'}
      ` : ''}
    `;

    mountEl.querySelectorAll('.ward-row').forEach(rowEl=>{
      rowEl.addEventListener('click', async (e)=>{
        if(e.target.closest('[data-ward-remove]')) return;
        const wid = rowEl.dataset.ward;
        const w = state.myWards.find(x=>x.wardId===wid);
        if(!w) return;
        if(w.live && w.live.deleted){ alert('Mã xã này đã bị Chủ mã xoá.'); return; }
        const needsReauth = w.kind==='guest' && w.live && (w.live.accessVersion||0) !== (w.av||0);
        if(needsReauth){
          const pass = prompt('Chủ mã đã đổi mật khẩu mã xã. Vui lòng nhập mật khẩu MỚI để tiếp tục:');
          if(pass===null) return;
          await joinOrCreateWard(wid, pass);
          return;
        }
        await renderWardInfoModal(wid);
      });
    });
    mountEl.querySelectorAll('[data-ward-remove]').forEach(btn=>{
      btn.onclick = async (e)=>{
        e.stopPropagation();
        const wid = btn.dataset.wardRemove;
        const w = state.myWards.find(x=>x.wardId===wid);
        if(w && w.kind==='owner') await ownerDeleteWard(wid);
        else await guestRemoveWard(wid);
        if(embedded){ /* renderSettingsTab tự render lại thông qua các hàm trên khi cần */ }
      };
    });
    mountEl.querySelector('#ww-random').onclick = async ()=>{ state._onboardingReturnView = 'wallet'; await createRandomWardAndOnboard(); };
    // Yêu cầu 4: tách riêng "Tạo mã mới" và "Tham gia bằng mã này" — mỗi nút có logic RIÊNG,
    // dùng chung hàm createWardStrict/joinWardStrict (đã có cảnh báo lỗi tương ứng khi thất bại).
    mountEl.querySelector('#ww-create').onclick = async ()=>{
      const wid = mountEl.querySelector('#ww-wardid').value;
      const pass = mountEl.querySelector('#ww-pass').value;
      if(!wid.trim()){ alert('Vui lòng nhập mã xã.'); return; }
      state._onboardingReturnView = 'wallet';
      await createWardStrict(wid, pass);
    };
    mountEl.querySelector('#ww-joinbtn').onclick = async ()=>{
      const wid = mountEl.querySelector('#ww-wardid').value;
      const pass = mountEl.querySelector('#ww-pass').value;
      if(!wid.trim()){ alert('Vui lòng nhập mã xã.'); return; }
      await joinWardStrict(wid, pass);
    };
    mountEl.querySelector('#ww-trash-toggle').onclick = ()=>{ state.walletTrashOpen = !state.walletTrashOpen; render(); };
    mountEl.querySelectorAll('[data-restore-ward]').forEach(btn=> btn.onclick = ()=> restoreDeletedWard(btn.dataset.restoreWard));
    mountEl.querySelectorAll('[data-purge-ward]').forEach(btn=> btn.onclick = ()=> purgeDeletedWardToSuperadmin(btn.dataset.purgeWard));
    mountEl.querySelectorAll('[data-super-restore]').forEach(btn=> btn.onclick = ()=> superRestoreWard(btn.dataset.superRestore));
    mountEl.querySelectorAll('[data-super-purge]').forEach(btn=> btn.onclick = ()=> superPurgeForever(btn.dataset.superPurge));
  }

  // Nhãn "Danh sách các ..." dùng ngay tại màn hình thiết lập lần đầu (trước khi state.config tồn tại)
  function subAdminListLabelLocal(subType, customVal){
    const t = SUB_ADMIN_OPTIONS.includes(subType) ? subType : 'Khu dân cư';
    const label = t==='Khác' ? ((customVal||'').trim()||'Đơn vị') : t;
    return `Danh sách các ${label.toLowerCase()}`;
  }

  // Màn hình "Thiết lập ban đầu" — dùng cho MỌI trường hợp một mã định danh CHƯA từng thiết lập
  // (state.config === null) dù là: vừa tạo mã tự chọn, vừa được cấp mã ngẫu nhiên, hay chọn vào một
  // mã đã tạo trước đó nhưng chưa từng hoàn tất thiết lập (yêu cầu 6). Luôn có sẵn 1 Mã định danh
  // thật (wardId) — không còn khái niệm "mã rỗng" nữa (yêu cầu 1).
  // Yêu cầu 3 & 4: tách rõ "Thông tin cơ bản (bắt buộc)" và "Thiết lập nâng cao (có thể bỏ qua)";
  // cả 2 nút ở khối nâng cao đều dẫn tới cùng 1 kết quả — lưu dữ liệu bắt buộc + dữ liệu nâng cao (đã gõ
  // hoặc mặc định nếu bỏ trống) rồi vào thẳng giao diện chính.
  function renderOnboarding(){
    const cfg = state.config || { hamlets:[], projects:[], quarters: JSON.parse(JSON.stringify(DEFAULT_QUARTERS)),
      retainPercent:30, wardName:'', adminLevel:'', subAdminType:'', provinceType:'', provinceName:'',
      ownerEmail: state.identity.email, officerTitle:'' };
    const curLevel = ADMIN_LEVEL_OPTIONS.includes(cfg.adminLevel) ? cfg.adminLevel : '';
    const curSub = SUB_ADMIN_OPTIONS.includes(cfg.subAdminType) ? cfg.subAdminType : '';
    const curProvinceType = PROVINCE_TYPE_OPTIONS.includes(cfg.provinceType) ? cfg.provinceType : '';
    // "state.config" chưa tồn tại khi đang thiết lập lần đầu -> danh sách địa danh nháp dùng tạm
    // biến toàn cục ở state để khung dropdown + modal quản lý địa danh dùng chung được với nhau.
    if(!state.config) state._obDraftHamlets = state._obDraftHamlets || (cfg.hamlets||[]).slice();
    const obHamlets = state.config ? (state.config.hamlets||[]) : (state._obDraftHamlets||[]);
    root.innerHTML = `
      <div class="center-screen">
        <div class="auth-card" style="max-width:640px; text-align:left;">
          <div class="rice-badge" style="margin:0 0 14px;">⚙️</div>
          <h1 style="text-align:left;">Thiết lập cơ sở dữ liệu lõi</h1>
          <p class="sub" style="text-align:left;">Thiết lập lần đầu cho địa phương — có thể chỉnh sửa lại sau trong mục Cài đặt.</p>

          <div class="divider-lbl" id="ob-required-anchor">📌 Thông tin cơ bản (bắt buộc)</div>
          <div class="form-grid">
            <div class="field"><label>Loại xã/phường *</label>
              <select id="ob-adminlevel"><option value="" ${!curLevel?'selected':''}>-- Chưa chọn --</option>${ADMIN_LEVEL_OPTIONS.map(o=>`<option value="${o}" ${curLevel===o?'selected':''}>${o}</option>`).join('')}</select>
            </div>
            <div class="field"><label id="ob-ward-label">Tên riêng ${curLevel? `(${curLevel}) ` : ''}*</label><input id="ob-ward" placeholder="Ví dụ: Hưng Phước, Bình Minh..." value="${cfg.wardName||''}"></div>
            <div class="field"><label>Loại tỉnh/thành phố *</label>
              <select id="ob-provincetype"><option value="" ${!curProvinceType?'selected':''}>-- Chưa chọn --</option>${PROVINCE_TYPE_OPTIONS.map(o=>`<option value="${o}" ${curProvinceType===o?'selected':''}>${o}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Tên tỉnh/thành phố *</label><input id="ob-provincename" placeholder="Ví dụ: Bình Phước, Cần Thơ..." value="${cfg.provinceName||''}"></div>
            <div class="field"><label>Loại khu dân cư cấp dưới *</label>
              <select id="ob-subadmin"><option value="" ${!curSub?'selected':''}>-- Chưa chọn --</option>${SUB_ADMIN_OPTIONS.map(o=>`<option value="${o}" ${curSub===o?'selected':''}>${o}</option>`).join('')}</select>
            </div>
          </div>

          <div class="field full" style="margin-top:4px;">
            <label>Mã định danh cấp Xã/Phường (bản nháp — chưa chính thức tạo)</label>
            <input value="${state.identity.wardId||''}" disabled style="text-transform:lowercase; opacity:.75;">
            <p class="sub" style="margin:4px 0 0; font-size:11.5px;">
              Mã này <b>chưa được tạo thật</b> — chỉ khi bấm "Lưu và tiếp tục" bên dưới thành công thì mã định danh mới chính thức được tạo trên Firebase tại <span class="mono">data/${state.identity.wardId||'...'}/...</span>. Nếu bấm "Quay lại trang trước", mã nháp này sẽ biến mất hoàn toàn, không để lại dấu vết gì. Hãy cung cấp đúng mã này (và mật khẩu, nếu đồng chí đặt) cho các cán bộ khác để họ tham gia chung dữ liệu sau khi tạo xong. Đồng chí có thể đổi sang tên khác bất cứ lúc nào trong mục Cài đặt.
            </p>
          </div>

          <div style="border:1px dashed var(--gold); border-radius:12px; padding:14px 16px; margin-top:20px; background:rgba(199,154,43,.06);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:2px;">
              <b style="font-size:13.5px; color:var(--rice-dark);" id="ob-hamlets-divider">📋 Danh sách tên địa danh các khu dân cư trực thuộc</b>
            </div>
            <p class="sub" style="margin:0 0 12px; font-size:11.5px;">💡 Có thể bỏ qua và thiết lập sau trong phần Cài đặt. Các mục dưới đây có thể để trống hoặc để mặc định.</p>

            <div style="border:1px solid var(--line); border-radius:8px; padding:8px 12px; min-height:38px; background:var(--white);">
              ${obHamlets.length? escapeHtml(obHamlets.join(', ')) : `<span class="sub">Chưa có địa danh nào.</span>`}
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="ob-hamlets-manage-btn" style="margin-top:6px;">+ Thêm địa danh</button>

            <div style="display:flex; gap:10px; margin-top:14px;">
              <button class="btn btn-ghost" id="ob-skip" style="flex:1;">Quay lại trang trước</button>
              <button class="btn btn-primary" id="ob-save" style="flex:1;">Lưu và tiếp tục</button>
            </div>
          </div>
        </div>
      </div>`;

    // Ép trình duyệt cuộn xuống phần "Thông tin cơ bản (bắt buộc)" ngay khi vào màn hình này
    // (chỉ đến được đây sau khi bấm [Tạo mã định danh mới] / [Làm việc không cần mã] / chọn vào
    // một mã chưa từng thiết lập — yêu cầu 3 & 6).
    const anchorEl = document.getElementById('ob-required-anchor');
    if(anchorEl) setTimeout(()=> anchorEl.scrollIntoView({behavior:'smooth', block:'start'}), 60);

    // ---- cập nhật động các nhãn khi người dùng đổi cấu hình danh xưng ----
    function refreshAdminLabels(){
      const level = document.getElementById('ob-adminlevel').value;
      document.getElementById('ob-ward-label').textContent = `Tên riêng ${level? `(${level}) ` : ''}*`;
    }
    document.getElementById('ob-adminlevel').onchange = refreshAdminLabels;
    const obHamletsManageBtn = document.getElementById('ob-hamlets-manage-btn');
    if(obHamletsManageBtn) obHamletsManageBtn.onclick = ()=>{
      renderHamletManagerModal((newList)=>{
        state._obDraftHamlets = newList;
        renderOnboarding();
      }, state._obDraftHamlets||[]);
    };

    // ---- Yêu cầu 3: kiểm tra đầy đủ "Thông tin cơ bản bắt buộc" trước khi được đi tiếp ----
    function validateRequired(){
      const adminLevel = document.getElementById('ob-adminlevel').value;
      const provinceType = document.getElementById('ob-provincetype').value;
      const subAdminType = document.getElementById('ob-subadmin').value;
      const wardNameVal = document.getElementById('ob-ward').value.trim();
      const provinceNameVal = document.getElementById('ob-provincename').value.trim();
      if(!adminLevel){ alert('Vui lòng chọn Loại xã/phường.'); return null; }
      if(!provinceType){ alert('Vui lòng chọn Loại tỉnh/thành phố.'); return null; }
      if(!subAdminType){ alert('Vui lòng chọn Loại khu dân cư cấp dưới.'); return null; }
      if(!wardNameVal){ alert(`Vui lòng nhập Tên riêng (${adminLevel}).`); document.getElementById('ob-ward').focus(); return null; }
      if(!provinceNameVal){ alert(`Vui lòng nhập Tên ${provinceType.toLowerCase()}.`); document.getElementById('ob-provincename').focus(); return null; }
      return { wardNameVal, provinceNameVal, subAdminType };
    }

    // ---- Yêu cầu 4: cả 2 nút cùng chung 1 kết quả — lưu dữ liệu bắt buộc + dữ liệu nâng cao
    // (đã gõ hoặc mặc định nếu để trống), rồi vào ngay giao diện chính ----
    async function finishOnboarding(){
      const req = validateRequired();
      if(!req) return;
      const baseFields = {
        wardName: req.wardNameVal,
        adminLevel: document.getElementById('ob-adminlevel').value,
        provinceType: document.getElementById('ob-provincetype').value,
        provinceName: req.provinceNameVal,
        subAdminType: req.subAdminType,
        officerTitle: (state.identity.officerTitle||'').trim(),
        hamlets: state._obDraftHamlets || [],
        projects: [], // Yêu cầu mới: bỏ hẳn danh sách phương án vay tự do — dùng hệ thống Phương án vay có cấu trúc ở Sổ vay vốn
        quarters: (state.config && state.config.quarters) ? state.config.quarters : JSON.parse(JSON.stringify(DEFAULT_QUARTERS)), // Yêu cầu mới: bỏ hẳn khối chỉnh 4 Quý ở màn thiết lập ban đầu — đã dời sang nút "Chỉnh thời gian tính lãi suất hàng quý" trong Sổ vay vốn
        retainPercent: (state.config && state.config.retainPercent!=null) ? state.config.retainPercent : 30, // không còn ô nhập — giữ mặc định để không ảnh hưởng công thức Báo cáo hiện có
      };

      const newCfg = {
        ...baseFields,
        ownerEmail: cfg.ownerEmail,
        // ---- đa mã xã: mật khẩu mã (không bắt buộc) + trạng thái xoá ----
        accessCode: state._pendingAccessCode || '',
        accessVersion: 0,
        deleted: false,
        // ---- phân quyền chia sẻ (Loại 1 công khai / Loại 2 đích danh) — mặc định chưa chia sẻ gì ----
        publicPerms: {data:'none', members:'none', strength:'none', internal:'none'},
        grants: {},
        // ---- "Mã ẩn" cố định, không đổi dù đổi tên/mã định danh sau này — phục vụ quản lý VIP/PRO ----
        secretId: state._pendingSecretId || genSecretId(),
        // Thời điểm tạo mã LẦN ĐẦU — cố định vĩnh viễn, không đổi dù sau này đổi tên mã hay sửa cấu hình.
        createdAt: new Date().toISOString(),
      };
      state.config = newCfg;
      await cSet('config', newCfg); // ghi lên data/{wardId}/config trên Firebase
      // Ghi "con trỏ ngược" secretId -> wardId hiện tại vào nhánh RIÊNG BIỆT secret_ward_map/ —
      // CẦN THIẾT để Firebase Rules bảo mật tra ngược từ secretdata/{secretId} về đúng
      // data/{wardId}/config để kiểm tra quyền (chủ mã / publicPerms / grants), mà không phải mở
      // toang secretdata cho mọi người xác thực. Để RIÊNG NHÁNH (không lồng trong secretdata/)
      // nhằm tránh bị "cuốn theo" quyền ghi rộng hơn mà các Khách có quyền Sửa trong secretdata
      // có thể vô tình có được do cơ chế cascade quyền của Firebase Rules.
      await rtdb.ref(`secret_ward_map/${newCfg.secretId}`).set(wardId());
      delete state._pendingAccessCode;
      delete state._pendingSecretId;
      delete state._obDraftHamlets;
      delete state._onboardingReturnView;
      // Cập nhật lại tên hiển thị của mã này trong Ví mã xã của Chủ mã — ĐÂY mới là lúc mã định
      // danh THẬT SỰ được tạo xong (trước đó chỉ là bản nháp cục bộ, chưa từng ghi lên Firebase).
      await rtdb.ref(`users/${emailToKey(state.identity.email)}/wards/${wardId()}`).set({kind:'owner', wardName:req.wardNameVal, addedAt:new Date().toISOString(), ...(state._pendingIsRandom? {autoRandom:true} : {})});
      delete state._pendingIsRandom;
      resetTabScrollMemory(); // phiên mới: bỏ trí nhớ cuộn của phiên trước
      state.view = 'app';
      state._showWardWelcome = true;
      attachRealtime();
      render();
    }

    // "Quay lại trang trước" — HUỶ BỎ hẳn mã định danh đang thiết lập dang dở (chưa từng lưu config
    // thật lên Firebase nên không cần xoá gì trên đó), quay lại đúng màn hình nhập Họ và tên/tạo
    // hoặc tham gia mã định danh, để người dùng có thể đổi ý.
    async function cancelOnboarding(){
      detachRealtime();
      state.identity.wardId = '';
      setActiveWardCache('');
      lset(IDENTITY_KEY, state.identity);
      state.config = null;
      delete state._pendingAccessCode;
      delete state._pendingSecretId;
      delete state._obDraftHamlets;
      delete state._pendingIsRandom;
      state.view = state._onboardingReturnView || 'welcome';
      delete state._onboardingReturnView;
      render();
    }

    document.getElementById('ob-save').onclick = finishOnboarding;
    document.getElementById('ob-skip').onclick = cancelOnboarding;
  }

  function navItems(){
    const items = [];
    if(canViewModule('data')){
      items.push({id:'dashboard', ico:'📊', label:'Tổng quan'});
      items.push({id:'data', ico:'📋', label:'Sổ vay vốn'});
      items.push({id:'expenses', ico:'💰', label:`Sổ Thu Chi Lãi Quỹ`});
    }
    if(canViewModule('internal')) items.push({id:'internal', ico:'🔒', label:'Thu – Chi nội bộ'});
    items.push({id:'propaganda', ico:'📣', label:'Tạo bài Tuyên truyền'});
    if(canViewModule('members')) items.push({id:'members', ico:'🪪', label:'Hồ sơ hội viên'});
    if(canViewModule('strength')) items.push({id:'strength', ico:'💪', label:'Thực lực Hội'});
    items.push({id:'drive', ico:'🗂️', label:'Trung tâm dữ liệu'});
    // Ba công cụ văn phòng gom vào MỘT mục có menu thả xuống, đứng đúng vị trí cũ của
    // mục "Tài liệu". Bấm từng công cụ sẽ mở overlay TOÀN MÀN HÌNH (che cả khung menu),
    // giống module Tạo bài Tuyên truyền — nên chúng không phải là tab nội dung.
    items.push({id:'office', ico:'🧰', label:'Công cụ văn phòng', children:[
      {id:'docs',   ico:'📄', label:'Tài liệu'},
      {id:'sheets', ico:'📊', label:'Trang tính'},
      {id:'slides', ico:'📽️', label:'Trình bày'},
    ]});
    items.push({id:'schedule', ico:'📅', label:'Lịch Công tác'});
    items.push({id:'tasks',    ico:'✅', label:'Danh sách Công việc'});
    items.push({id:'training', ico:'🎓', label:'Tập huấn bằng AI'});
    items.push({id:'meeting',  ico:'📋', label:'Phòng họp không giấy'});
    items.push({id:'fanpage',  ico:'📣', label:'Quản lý Fanpage'});
    items.push({id:'carecare', ico:'💚', label:'Chăm sóc Hội viên'});
    items.push({id:'branch',   ico:'🌾', label:'Công tác Chi hội'});
    // "Ghi chú nhanh" KHÔNG có mục riêng trong menu trái: lối vào duy nhất là nút nổi 🗒️ ở góc
    // phải màn hình (fab-notes-btn, dựng trong 07-core-modules.js). Trước đây có cả hai lối vào
    // cùng mở đúng một overlay nên bị trùng lặp; nay gom về một.
    // Yêu cầu 7: Module mới "Biểu mẫu khảo sát" — nằm ngay phía trên "Cài đặt & Chia sẻ"
    items.push({id:'survey', ico:'📝', label:'Biểu mẫu khảo sát'});
    if(isOwner() || settingsPerm()!=='none') items.push({id:'settings', ico:'⚙️', label:'Cài đặt & Chia sẻ'});
    items.push({id:'guide', ico:'📖', label:'Hướng dẫn sử dụng'});
    items.push({id:'about', ico:'ℹ️', label:'Thông tin phần mềm'});
    // Chỉ Admin (2 Admin tối cao + Admin được thêm vào) mới nhìn thấy mục này — luôn ở cuối cùng.
    if(isAdmin()) items.push({id:'knowledgeBase', ico:'🧠', label:'Huấn luyện AI (Admin)'});
    if(isAdmin()) items.push({id:'adminSettings', ico:'🛠️', label:'CÀI ĐẶT ADMIN'});
    return items;
  }

  function describeAccess(){
    if(isTourMode()) return 'Môi trường tham quan';
    if(!wardId()) return 'Chưa chọn mã xã';
    if(isWardGuestAccess()) return 'Khách qua mã (không đăng nhập)';
    if(isOwner()) return 'Chủ mã (CHỦ MÃ)';
    if(isPending()) return 'Đang chờ Chủ mã duyệt';
    return 'Khách — đã được cấp quyền';
  }

  // Cuộn mục menu vừa bấm vào GIỮA khung menu và cho tên module nhảy múa vài nhịp rồi đứng
  // im — dùng lại đúng hiệu ứng nameDance sẵn có của app (phóng to 1,1 lần), chỉ khác là chạy
  // hữu hạn 3 nhịp thay vì lặp vô hạn. Gọi sau render() vì render() dựng lại toàn bộ DOM menu.
  // =====================================================================
  // GHI NHỚ VỊ TRÍ CUỘN CỦA TỪNG MODULE
  // Rời một module thì ghi lại đang cuộn tới đâu; quay lại module đó thì cuộn
  // về đúng chỗ cũ. Module chưa từng cuộn thì mở ra ở đầu trang.
  //
  // LƯU Ý: trang cuộn bằng CHÍNH CỬA SỔ (.app-shell chỉ có min-height:100vh,
  // #content không tự cuộn riêng) nên phải đọc/ghi window chứ không phải
  // scrollTop của #content.
  // =====================================================================
  function currentScrollTop(){
    return window.pageYOffset || (document.scrollingElement || document.documentElement).scrollTop || 0;
  }
  function rememberTabScroll(){
    if(!state._tabScroll) state._tabScroll = {};
    if(state.activeTab) state._tabScroll[state.activeTab] = currentScrollTop();
  }
  // Xoá sạch trí nhớ cuộn — gọi khi đổi sang mã định danh khác hoặc bắt đầu
  // phiên mới, để không cuộn theo vị trí của dữ liệu phiên trước.
  function resetTabScrollMemory(){ state._tabScroll = {}; }
  function scrollWindowTo(top){
    window.scrollTo(0, top);
    // Ngay sau khi dựng lại giao diện, trang có thể còn NGẮN hơn vị trí cần tới
    // (ảnh/phông chữ chưa xong) nên lệnh cuộn ở trên bị trình duyệt kẹp lại ở đáy.
    // Đặt lại một lần nữa ở nhịp vẽ kế tiếp, và một lần nữa sau focusNavItem()
    // (hàm đó chạy trong setTimeout 0 nên phải xếp hàng sau nó mới chắc ăn).
    // Chỉ đặt lại khi vị trí đã lệch, để không giật khi người dùng vừa cuộn tay.
    const reassert = ()=>{ if(Math.abs(currentScrollTop() - top) > 2) window.scrollTo(0, top); };
    requestAnimationFrame(reassert);
    setTimeout(reassert, 0);
  }
  function restoreTabScroll(tabId){
    scrollWindowTo((state._tabScroll && state._tabScroll[tabId]) || 0);
  }
  // Đổi module: ghi nhớ chỗ đang đứng ở module cũ rồi cuộn tới chỗ cũ của module mới.
  function switchTab(tabId){
    if(!tabId) return;
    // Bấm lại đúng module ĐANG xem thì giữ nguyên chỗ đang đứng — không kéo người
    // dùng về vị trí đã ghi nhớ từ lần rời module đó trước đây.
    const sameTab = state.activeTab === tabId;
    const keepTop = sameTab ? currentScrollTop() : null;
    if(!sameTab) rememberTabScroll();
    state.activeTab = tabId;
    state.bellOpen = false;
    render();
    if(sameTab) scrollWindowTo(keepTop);
    else restoreTabScroll(tabId);
  }

  // =====================================================================
  // THANH "TÌM HIỂU THÊM VỀ MODULE NÀY" — nằm ngay dưới tiêu đề module, áp dụng cho MỌI module
  // vẽ trong khung nội dung. Đặt ở đây (giữa .topbar và #content) nên chỉ cần dựng MỘT lần là
  // module nào cũng có, không phải sửa từng hàm render riêng.
  // Menu thả xuống mở bằng cách bấm HOẶC rê chuột vào; đóng khi rê ra ngoài, bấm ra ngoài, hoặc
  // bấm nút ✕ ở góc.
  // =====================================================================
  const MODULE_LEARN_OPTS = [
    ['overview', '📊', 'Đánh giá tổng quan về dữ liệu trong module'],
    ['guide',    '💬', 'Hướng dẫn sử dụng module'],
    ['intro',    '📖', 'Đọc Bản giới thiệu về module'],
  ];
  function moduleLearnBarHtml(moduleTitle){
    const name = escapeHtml(moduleTitle || 'này');
    const tail = { overview:'này.', guide:'này bằng cách chat với AI.', intro:'này.' };
    return `
      <div class="module-learn-bar">
        <div class="module-learn" id="module-learn">
          <button type="button" class="module-learn-btn preview-allow" id="module-learn-btn">💡 Tìm hiểu thêm về module này</button>
          <div class="module-learn-menu" id="module-learn-menu">
            <button type="button" class="module-learn-close preview-allow" data-learn-close title="Đóng">✕</button>
            ${MODULE_LEARN_OPTS.map(([key,ico,text])=>`
              <button type="button" class="module-learn-opt preview-allow" data-learn-opt="${key}">${ico} ${text} "${name}" ${tail[key]}</button>`).join('')}
          </div>
        </div>
      </div>`;
  }
  function closeModuleLearnMenu(){
    const box = document.getElementById('module-learn');
    if(box) box.classList.remove('open');
  }
  function wireModuleLearnBar(){
    const box = document.getElementById('module-learn');
    if(!box) return;
    const btn = document.getElementById('module-learn-btn');
    if(btn) btn.onclick = (e)=>{ e.stopPropagation(); box.classList.toggle('open'); };
    // Rê chuột vào thì mở, rê ra ngoài thì đóng. Thiết bị cảm ứng không có "rê chuột" nên vẫn
    // dùng cách bấm ở trên — hai cách cùng tồn tại, không xung đột.
    box.addEventListener('mouseenter', ()=> box.classList.add('open'));
    box.addEventListener('mouseleave', ()=> box.classList.remove('open'));
    const closeBtn = box.querySelector('[data-learn-close]');
    if(closeBtn) closeBtn.onclick = (e)=>{ e.stopPropagation(); closeModuleLearnMenu(); };
    box.querySelectorAll('[data-learn-opt]').forEach(opt=> opt.onclick = (e)=>{
      e.stopPropagation();
      closeModuleLearnMenu();
      showBigToast('Tính năng này đang được thiết kế, sẽ sớm ra mắt.');
    });
  }
  // Bấm ra ngoài thì đóng — uỷ quyền MỘT lần cho cả app, không gắn lại sau mỗi lần vẽ.
  if(!window.__moduleLearnOutsideDelegated){
    window.__moduleLearnOutsideDelegated = true;
    document.addEventListener('click', (e)=>{ if(!e.target.closest('#module-learn')) closeModuleLearnMenu(); });
  }

  function focusNavItem(selector){
    setTimeout(()=>{
      const el = document.querySelector(selector);
      if(!el) return;
      try{ el.scrollIntoView({behavior:'smooth', block:'center'}); }
      catch(e){ el.scrollIntoView(); } // trình duyệt cũ không nhận tham số dạng object
      const label = el.querySelector('.nav-label');
      if(!label) return;
      label.classList.remove('nav-label-dance');
      void label.offsetWidth; // ép trình duyệt tính lại, nếu không animation sẽ không chạy lại
      label.classList.add('nav-label-dance');
    }, 0);
  }

  function renderApp(){
    if(typeof driveRoute==='function' && driveRoute()) state.activeTab = 'drive';
    const nav = navItems();
    // Mục có children (Công cụ văn phòng) chỉ là nhóm menu, không phải tab nội dung —
    // loại nó ra khi chọn tab mặc định, nếu không sẽ rơi vào tab không có gì để vẽ.
    const navTabs = nav.filter(n=> !n.children);
    if(!navTabs.some(n=>n.id===state.activeTab)) state.activeTab = navTabs.length? navTabs[0].id : 'guide';
    const roleLabel = describeAccess();
    const alerts = wardId() ? computeAlerts() : [];
    const hasIdentityEmail = !!(state.identity && state.identity.email);
    // Lắng nghe thông báo cá nhân (VD: yêu cầu duyệt thanh toán Biên lai) — chỉ gắn ĐÚNG 1 LẦN cho
    // đúng email hiện tại, tránh gắn lặp lại mỗi lần render.
    if(hasIdentityEmail && window.__notifListenerEmail !== state.identity.email){
      window.__notifListenerEmail = state.identity.email;
      try{
        rtdb.ref('notifications/'+emailToKey(state.identity.email)).on('value', (snap)=>{
          const val = (snap && snap.exists()) ? snap.val() : {};
          state._persistentNotifs = Object.entries(val).map(([id,n])=>({...n, id})).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
          render();
        });
      }catch(e){ console.error('Không lắng nghe được thông báo cá nhân:', e); }
    }
    // Tên module đang xem — dùng chung cho tiêu đề trên cùng và cho menu "Tìm hiểu thêm".
    const moduleTitle = state.activeTab==='data'
      ? 'Sổ vay vốn Quỹ Hỗ trợ Nông dân'
      : ((navTabs.find(n=>n.id===state.activeTab)||{label:''}).label || '');
    root.innerHTML = `
      <div class="app-title-banner"><span>Sổ tay Công tác Hội Nông dân cấp xã/phường</span></div>
      ${isTourMode()? `
      <div class="preview-banner">
        ⚠️ Đồng chí đang ở môi trường tham quan. Hãy chọn <button class="link-btn" id="pv-login">Đăng nhập hoặc Tham gia bằng mã</button> để sử dụng;
        hoặc <button class="link-btn" id="pv-guide">Xem hướng dẫn sử dụng website</button>.
      </div>` : ''}
      ${isWardGuestAccess()? `
      <div class="access-mode-banner access-mode-banner-guest">
        <span>👤 Đồng chí đang dùng app bằng mã xã/phường, chưa đăng nhập Google. Bộ nhớ riêng chỉ lưu trên thiết bị này; muốn đồng bộ, chia sẻ và lưu lâu dài hãy đăng nhập.</span>
        <button class="link-btn" id="guest-login">Đăng nhập Google</button>
      </div>` : ''}
      ${state._adminViewingWard? `
      <div class="admin-view-banner">🛡️ ADMIN đang XEM THỬ (chỉ đọc, không sửa được) dữ liệu của mã "${wardId()}". Bấm "Thoát khỏi mã định danh" để quay về mã của đồng chí.</div>` : ''}
      <div class="app-shell">
        <button type="button" class="sidebar-toggle-btn ${state.sidebarCollapsed?'collapsed':''}" id="sidebar-toggle-btn" title="${state.sidebarCollapsed?'Mở menu':'Thu gọn menu'}">${state.sidebarCollapsed?'▤':'▥'}</button>
        <div class="sidebar ${state.sidebarCollapsed?'collapsed':''}">
          <div class="brand"><div class="ico">🌾</div><div class="txt">${wardProvinceHeaderLine()||'Chưa chọn mã xã'}<small>Mã ${wardId()||''}</small></div></div>
          ${nav.map(n=> n.children? `
            <button class="nav-item nav-item-group ${state._officeMenuOpen?'expanded':''}" data-navgroup="${n.id}">
              <span>${n.ico}</span><span class="nav-label">${n.label}</span>
              <span class="nav-caret">${state._officeMenuOpen?'▾':'▸'}</span>
            </button>
            ${state._officeMenuOpen? n.children.map(c=>`
              <button class="nav-item nav-subitem" data-navchild="${c.id}">
                <span>${c.ico}</span><span>${c.label}</span>
              </button>`).join('') : ''}` : `
            <button class="nav-item ${state.activeTab===n.id?'active':''}" data-tab="${n.id}">
              <span>${n.ico}</span><span class="nav-label">${n.label}</span>
              ${n.badge?`<span class="badge">${n.badge}</span>`:''}
            </button>`).join('')}
          <div class="foot">${state.identity.email?`Đăng nhập: ${state.identity.email}`:'Chưa đăng nhập Google'}<br>Vai trò: ${roleLabel}
            <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
              ${state.previewMode? '' : hasIdentityEmail
                ? (wardId()? `<button class="btn btn-ghost btn-sm" id="ward-logout-btn" style="color:#fff; border-color:rgba(255,255,255,.3);">🔁 Thoát khỏi mã định danh</button>` : `<button class="btn btn-ghost btn-sm" id="ward-goto-wallet" style="color:#fff; border-color:rgba(255,255,255,.3);">🗂️ Chọn / thêm mã xã</button>`)
                : `<button class="btn btn-ghost btn-sm" id="codeguest-logout-btn" style="color:#fff; border-color:rgba(255,255,255,.3);">↩ Rời mã xã này</button>`}
              ${state.previewMode
                ? `<button class="btn btn-ghost btn-sm" id="logout-btn" style="color:#fff; border-color:rgba(255,255,255,.3);">Thoát môi trường tham quan</button>`
                : hasIdentityEmail? `<button class="btn btn-ghost btn-sm" id="logout-btn" style="color:#fff; border-color:rgba(255,255,255,.3);">Đăng xuất tài khoản Google</button>` : ''}
            </div>
          </div>
          <div class="sidebar-legal">
            <button class="sidebar-legal-link" data-legal="terms">Điều khoản sử dụng</button>
            <button class="sidebar-legal-link" data-legal="privacy">Chính sách bảo mật và quyền riêng tư</button>
            <div class="sidebar-copyright">
              <span class="sidebar-copyright-brand">sotay.org</span>
              <span>© ${new Date().getFullYear()} Sổ tay Công tác Hội Nông dân</span>
              <span>Sản phẩm thuộc bản quyền của sotay.org</span>
            </div>
          </div>
        </div>
        <div class="main ${state.sidebarCollapsed?'sidebar-collapsed':''}">
          <div class="topbar">
            <div><h2>${escapeHtml(moduleTitle)}</h2></div>
            <div class="top-actions">
              <button class="bell-btn" id="bell-btn">🔔${alerts.length?`<span class="bell-dot"></span>`:''}</button>
              <div class="avatar" ${state.identity.photo?`style="background-image:url('${state.identity.photo}'); background-size:cover; background-position:center;"`:''}>${state.identity.photo?'':(state.identity.name||'?')[0].toUpperCase()}</div>
              ${state.bellOpen? renderBellPanel() : ''}
            </div>
          </div>
          ${moduleLearnBarHtml(moduleTitle)}
          <div class="content" id="content"></div>
        </div>
      </div>`;
    wireModuleLearnBar();
    document.querySelectorAll('.nav-item').forEach(el=>{
      el.onclick = ()=>{
        // Mục nhóm "Công cụ văn phòng": chỉ đóng/mở menu thả xuống, không đổi tab.
        if(el.dataset.navgroup){
          const gid = el.dataset.navgroup;
          state._officeMenuOpen = !state._officeMenuOpen;
          render();
          focusNavItem(`.nav-item[data-navgroup="${gid}"]`);
          return;
        }
        // Một trong ba công cụ văn phòng: mở overlay TOÀN MÀN HÌNH, giữ nguyên tab đang xem
        // để khi thoát ra người dùng quay lại đúng chỗ cũ. KHÔNG cuộn/nhảy múa ở mục menu vì
        // overlay che kín màn hình, người dùng không nhìn thấy khung menu nữa.
        if(el.dataset.navchild){
          openOfficeModule({docs:'Docs', sheets:'Sheets', slides:'Slides'}[el.dataset.navchild]);
          state.bellOpen=false;
          return;
        }
        const clickedTab = el.dataset.tab;
        // "Tạo bài Tuyên truyền" giờ là overlay toàn màn hình (y hệt Chat AI/Ghi chú nhanh) — KHÔNG đổi
        // state.activeTab, chỉ mở overlay lên; khi thoát ra vẫn ở đúng module trước đó, không bị chuyển tab.
        // Cũng không cuộn/nhảy múa, vì lý do như ba công cụ văn phòng ở trên.
        if(clickedTab==='propaganda'){ openPropagandaModule(); state.bellOpen=false; render(); return; }
        switchTab(clickedTab);
        focusNavItem(`.nav-item[data-tab="${clickedTab}"]`);
      };
    });
    document.querySelectorAll('[data-legal]').forEach(btn=>{
      btn.onclick = ()=>{
        const label = btn.dataset.legal==='terms' ? 'Điều khoản sử dụng' : 'Chính sách bảo mật và quyền riêng tư';
        showBigToast(`${label} sẽ sớm ra mắt`);
      };
    });
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    if(sidebarToggleBtn){
      sidebarToggleBtn.onclick = ()=>{ state.sidebarCollapsed = !state.sidebarCollapsed; applySidebarCollapsedVisual(state.sidebarCollapsed); };
      makeVerticallyDraggable(sidebarToggleBtn, 'top', 'sidebarToggle');
    }
    document.getElementById('bell-btn').onclick = (e)=>{ e.stopPropagation(); state.bellOpen = !state.bellOpen; render(); };
    const pvLogin = document.getElementById('pv-login');
    if(pvLogin) pvLogin.onclick = exitPreviewMode;
    const pvGuide = document.getElementById('pv-guide');
    if(pvGuide) pvGuide.onclick = ()=>{ switchTab('guide'); };
    const guestLogin = document.getElementById('guest-login');
    if(guestLogin) guestLogin.onclick = ()=>{
      detachRealtime();
      clearWardGuestSession();
      state.identity = null;
      state.accessMode = ACCESS_MODES.SIGNED_OUT;
      state.config = null;
      state.view = 'login';
      render();
    };
    const wardLogoutBtn = document.getElementById('ward-logout-btn');
    if(wardLogoutBtn) wardLogoutBtn.onclick = exitToWallet;
    const gotoWalletBtn = document.getElementById('ward-goto-wallet');
    if(gotoWalletBtn) gotoWalletBtn.onclick = async ()=>{ await loadWallet(); state.view='wallet'; render(); };
    const codeGuestLogoutBtn = document.getElementById('codeguest-logout-btn');
    if(codeGuestLogoutBtn) codeGuestLogoutBtn.onclick = ()=>{
      detachRealtime();
      state.identity = null;
      state.accessMode = ACCESS_MODES.SIGNED_OUT;
      clearWardGuestSession();
      state.config=null; state.borrowers=[]; state.loanProjects=[]; state.borrowerColumnPrefsShared=null; state.borrowerVisibleCols=null; state.borrowerColumnOrder=null; state.filterHamlets=null; state.filterProjectIds=null; state.filterFundSources=null; state.filterManagerIds=null; state.filterQuarters=null; state.filterQuartersAdvanced=false; state.filterYears=null; state.filterYearsAdvanced=false; state.mainTimeline=null; state.openFilterDropdown=null; state.surveys=[]; state.expenses=[]; state.trash=[]; state.log=[];
      state.view = 'login'; render();
    };
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) logoutBtn.onclick = async ()=>{
      if(state.previewMode){ exitPreviewMode(); return; }
      detachRealtime();
      state.config = null; state.borrowers=[]; state.loanProjects=[]; state.borrowerColumnPrefsShared=null; state.borrowerVisibleCols=null; state.borrowerColumnOrder=null; state.filterHamlets=null; state.filterProjectIds=null; state.filterFundSources=null; state.filterManagerIds=null; state.filterQuarters=null; state.filterQuartersAdvanced=false; state.filterYears=null; state.filterYearsAdvanced=false; state.mainTimeline=null; state.openFilterDropdown=null; state.surveys=[]; state.expenses=[]; state.trash=[]; state.log=[];
      await auth.signOut(); // auth.onAuthStateChanged (trong boot()) sẽ tự dọn identity & chuyển về màn hình đăng nhập
    };
    document.addEventListener('click', ()=>{ if(state.bellOpen){ state.bellOpen=false; render(); } }, {once:true});

    const content = document.getElementById('content');
    if(state.activeTab==='dashboard') renderDashboard(content, alerts);
    else if(state.activeTab==='data') renderDataTab(content);
    else if(state.activeTab==='expenses') renderExpensesTab(content);
    else if(state.activeTab==='internal') renderInternalTab(content);
    else if(state.activeTab==='members') renderMembersTab(content);
    else if(state.activeTab==='strength') renderStrengthTab(content);
    else if(state.activeTab==='drive') renderDriveHubTab(content);
    // docs/sheets/slides KHÔNG còn là tab: chúng mở overlay toàn màn hình từ menu thả xuống.
    else if(upcomingModules()[state.activeTab]) renderUpcomingModule(content, upcomingModules()[state.activeTab]);
    else if(state.activeTab==='survey') renderSurveyTab(content);
    else if(state.activeTab==='settings') renderSettingsTab(content);
    else if(state.activeTab==='guide') renderGuideTab(content);
    else if(state.activeTab==='about') renderAboutTab(content);
    else if(state.activeTab==='knowledgeBase') renderAdminKnowledgeTab(content);
    else if(state.activeTab==='adminSettings') renderAdminSettingsTab(content);

    // Chỉ dựng modal khi chưa có modal nào đang mở trên màn hình — tránh bị
    // dựng chồng nhiều lớp modal mỗi khi có dữ liệu mới đẩy về qua realtime.
    if(state.modal && !document.querySelector('.modal-bg') && (!state.previewMode || state.modal.type==='expense')){
      if(state.modal.type==='expense') renderExpenseModal();
      else renderModal();
    }

    // Môi trường THAM QUAN: mọi nút bấm/ô nhập bên trong nội dung module đều bị vô hiệu hoá —
    // người xem được phép chuyển tab thoải mái nhưng chỉ xem giao diện mẫu, không sửa được gì.
    // Ngoại lệ: phần tử có class "preview-allow" (vd panel Tính lãi suất/phê duyệt/tất toán) vẫn
    // bấm/xem được bình thường để khách tham quan "vào xem thử", nhưng KẾT QUẢ thao tác (lưu/ghi
    // dữ liệu thật) vẫn bị chặn riêng ở từng handler tương ứng.
    if(state.previewMode){
      content.querySelectorAll('button, input, select, textarea').forEach(elx=>{
        if(elx.classList.contains('preview-allow')) return;
        elx.disabled = true;
      });
    }

    // Yêu cầu 5: bảng phụ chào mừng khi vào môi trường tham quan (chỉ hiện 1 lần ngay khi vào)
    if(state.previewMode && state._showPreviewWelcome && !document.querySelector('.modal-bg')){
      renderPreviewWelcomePopup();
    }
    // Yêu cầu 1 (tài liệu mới): bảng chào mừng mỗi khi BẮT ĐẦU 1 PHIÊN LÀM VIỆC với 1 mã định danh
    // (đăng nhập xong, tự khôi phục phiên đã lưu, tham gia bằng mã không cần đăng nhập, hoặc
    // chuyển/đổi sang xem mã định danh khác) — không áp dụng cho môi trường tham quan (đã có popup
    // chào mừng riêng ở trên).
    if(!state.previewMode && state._showWardWelcome && !document.querySelector('.modal-bg')){
      renderWardWelcomePopup();
    }
  }

  // Yêu cầu 5: Popup chào mừng môi trường tham quan — 2 nút [Xem hướng dẫn] / [Bỏ qua]
  function renderPreviewWelcomePopup(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg welcome-popup-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:640px;">
        <div class="modal-body" style="text-align:center; padding:28px 24px;">
          <div class="rice-badge" style="margin:0 auto 12px;">🌾</div>
          <h3 class="welcome-float-title" style="margin:0 0 16px;">Chúc đồng chí một ngày làm việc vui vẻ!</h3>
          <p class="sub" style="margin:0 0 24px; font-size:clamp(22px, 6vw, 40px); line-height:1.35; color:var(--ink);">Đây là môi trường tham quan, đồng chí có muốn xem hướng dẫn cụ thể không?</p>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-ghost" id="pw-skip" style="flex:1;">Bỏ qua</button>
            <button class="btn btn-primary" id="pw-guide" style="flex:1;">Xem hướng dẫn</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=>{ state._showPreviewWelcome = false; state.sidebarCollapsed = false; wrap.remove(); applySidebarCollapsedVisual(false); };
    wrap.querySelector('#pw-skip').onclick = close;
    // App còn đang xây dựng nên chưa có hướng dẫn cụ thể — chỉ báo nhanh bằng toast
    // (dùng đúng cơ chế showToast sẵn có: hiện vài giây rồi tự biến mất).
    wrap.querySelector('#pw-guide').onclick = ()=>{
      close();
      // Dùng showBigToast (nhảy sổ ra GIỮA màn hình rồi tự mờ đi) chứ không phải showToast
      // vốn hiện ở góc — thông báo này cần đập vào mắt ngay giữa màn hình.
      showBigToast('Xin lỗi! App đang xây dựng nên chưa có hướng dẫn cụ thể');
    };
  }

  // Bảng chào mừng mỗi lần bắt đầu phiên làm việc tại giao diện chính của 1 mã định danh bất kỳ —
  // nội dung tự động lấy đúng thông tin xã/phường - tỉnh/thành phố - mã định danh đang truy cập.
  function renderWardWelcomePopup(){
    const cfg = state.config || {};
    const wardName = (cfg.wardName||'').trim();
    const adminLower = adminLevelLabelLower(); // "xã"/"phường"/"thị trấn"
    const provType = provinceLevelLabelLower();
    const provName = (cfg.provinceName||'').trim();
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg welcome-popup-bg welcome-popup-bottom';
    wrap.innerHTML = `
      <div class="modal" style="max-width:680px;">
        <div class="modal-body" style="text-align:center; padding:28px 24px;">
          <div class="rice-badge" style="margin:0 auto 12px;">🌾</div>
          <p style="margin:0 0 10px; font-size:clamp(16px, 4.2vw, 24px); line-height:1.4; color:#0d47a1; font-weight:700;">
            Xin chào ${adminLower} <span style="color:#b71c1c;">${wardName? escapeHtml(wardName) : '(chưa đặt tên)'}</span>${provName? `, ${provType} <span style="color:#b71c1c;">${escapeHtml(provName)}</span>` : ''}, mã định danh: <span style="color:#b71c1c;">${escapeHtml(wardId()||'')}</span>
          </p>
          <h3 class="welcome-float-title" style="margin:0; color:#e65100;">Chúc Đồng chí một ngày làm việc Vui vẻ!</h3>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('welcome-popup-active'); // đẩy tạm 3 nút nổi lên tránh bị popup che
    wrap.style.pointerEvents = 'none'; // không chặn thao tác của người dùng trong lúc bảng đang tự hiện/tự ẩn
    // Hiện Ở ĐÁY màn hình ngay từ đầu (không phải giữa) — dùng CSS @keyframes animation duy nhất, do
    // chính trình duyệt điều khiển toàn bộ thời gian (đáng tin cậy trên mọi thiết bị, kể cả di động):
    // nảy vào mắt người dùng (0 -> 0.5s) -> đứng im 3.5 giây -> trôi xuống + mờ dần biến mất (0.9s cuối).
    wrap.style.animation = 'wardWelcomeBottomSequence 4.4s ease-in forwards';
    // QUAN TRỌNG: sự kiện "animationend" LAN LÊN (bubble) từ phần tử con — khung .modal bên trong có
    // hiệu ứng xuất hiện RIÊNG của nó (cơ chế chung áp dụng cho MỌI modal trong toàn app, ~0.66 giây),
    // nếu không kiểm tra rõ ràng thì sự kiện animationend CỦA PHẦN TỬ CON đó sẽ bị nhầm là animation
    // CỦA wrap đã xong, khiến bảng bị xoá quá sớm (đúng là lỗi thật đã xảy ra — mất sau ~1 giây thay vì
    // đủ 4.9 giây như thiết kế). Chỉ xử lý khi animationName khớp ĐÚNG và event.target CHÍNH LÀ wrap.
    wrap.addEventListener('animationend', (e)=>{
      if(e.target!==wrap || e.animationName!=='wardWelcomeBottomSequence') return;
      state._showWardWelcome = false;
      wrap.remove();
      // Gắn TẠM class transition mượt cho lần "chạy về" này — chỉ tồn tại đúng khoảng thời gian chuyển
      // động (450ms) rồi tự gỡ ra ngay, để không ảnh hưởng tới độ mượt tức thì khi kéo thả về sau.
      const fabEls = [document.getElementById('fab-chat-btn'), document.getElementById('fab-notes-wrap'), document.getElementById('fab-people-btn')].filter(Boolean);
      fabEls.forEach(el=> el.classList.add('fab-position-transition'));
      document.body.classList.remove('welcome-popup-active'); // popup mất hẳn -> 3 nút nổi lập tức chạy về vị trí mặc định
      setTimeout(()=>{
        fabEls.forEach(el=> el.classList.remove('fab-position-transition'));
        // Đúng lúc này 3 nút đã về hẳn vị trí mặc định — bắt đầu nhảy động 5 giây để thu hút sự chú ý.
        const chatBtn = document.getElementById('fab-chat-btn');
        const notesBtn = document.getElementById('fab-notes-btn');
        const peopleBtnEl = document.getElementById('fab-people-btn');
        [chatBtn, notesBtn, peopleBtnEl].filter(Boolean).forEach(el=>{
          el.classList.remove('fab-pre-popup');
          el.classList.add('fab-intro');
        });
        setTimeout(()=>{
          [chatBtn, notesBtn, peopleBtnEl].filter(Boolean).forEach(el=> el.classList.remove('fab-intro'));
        }, 5000);
      }, 450);
    });
  }

  function renderBellPanel(){
    const items = bellItems();
    return `<div class="bell-panel" onclick="event.stopPropagation()">
      <div class="bp-head">Thông báo & Cảnh báo</div>
      ${items.length? items.map(it=>`
        <div class="bell-item${it.type==='personal'?' preview-allow':''}" ${it.type==='personal'?`data-notif-receipt-code="${it.receiptCode}" style="cursor:pointer;"`:''}>
          <span class="dotc" style="background:${it.color==='gray'?'#C9C4AE':it.color==='red'?'var(--red)':it.color==='orange'?'var(--orange)':it.color==='yellow'?'var(--yellow)':'var(--moss)'}"></span>
          <div>${it.text}${it.time?`<div style="color:#9A9580; font-size:11px; margin-top:2px;">${new Date(it.time).toLocaleString('vi-VN')}</div>`:''}</div>
        </div>`).join('') : `<div class="bell-empty">Không có thông báo nào</div>`}
    </div>`;
  }
  // Bấm vào 1 mục thông báo cá nhân (yêu cầu duyệt thanh toán) -> mở đúng modal Đường link của Biên
  // lai chưa thanh toán tương ứng.
  if(!window.__notifBellClickDelegated){
    window.__notifBellClickDelegated = true;
    document.addEventListener('click', (e)=>{
      const el = e.target.closest('[data-notif-receipt-code]');
      if(!el) return;
      const code = el.dataset.notifReceiptCode;
      if(!code) return;
      renderUnpaidReceiptLinkModal(code, { showDelete:true });
    }, true); // QUAN TRỌNG: bắt ở giai đoạn CAPTURE — bảng thông báo tự gọi event.stopPropagation() để
              // không bị đóng khi bấm bên trong, việc này vô tình chặn luôn sự kiện lan tới document ở
              // giai đoạn bubble (mặc định), khiến handler này không bao giờ được kích hoạt. Capture
              // chạy TRƯỚC bubble nên không bị ảnh hưởng bởi stopPropagation xảy ra sau đó.
  }

  function renderDashboard(el, alerts){
    const counts = dashboardCounts(alerts);
    const active = state.borrowers.filter(b=>!b.deleted && !b.settled);
    const totalPrincipal = active.reduce((s,b)=>s+ (parseFloat(b.principal)||0),0);
    el.innerHTML = `
      <div class="dashboard-wip-notice">App đang xây dựng nên ở đây chỉ thống kê Quỹ Hỗ trợ Nông dân. Sau này khi app hoàn thiện, phần Tổng quan sẽ thống kê đầy đủ mọi dữ liệu có trong app cùng các dữ liệu liên quan tới công tác Hội và cán bộ Hội.</div>
      <div class="grid3">
        <div class="stat-card stat-yellow"><div class="num mono">${counts.yellow}</div><div class="lbl">🟡 Sắp đến hạn (≤60 ngày)</div><div class="sub">Cảnh báo sớm — cần chuẩn bị thu hồi vốn</div></div>
        <div class="stat-card stat-orange"><div class="num mono">${counts.orange}</div><div class="lbl">🟠 Cận hạn (≤30 ngày)</div><div class="sub">Cần liên hệ hộ vay đôn đốc</div></div>
        <div class="stat-card stat-red"><div class="num mono">${counts.red}</div><div class="lbl">🔴 Khẩn cấp (≤15 ngày)</div><div class="sub">Ưu tiên xử lý ngay</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Tổng quan vốn vay</h3></div>
        <div class="panel-body">
          <div class="kv-row"><span>Tổng số hộ vay đang theo dõi</span><b>${active.length}</b></div>
          <div class="kv-row"><span>Tổng dư nợ gốc</span><b>${money(totalPrincipal)}</b></div>
          <div class="kv-row"><span>Số ${subAdminLabelLower()}</span><b>${(state.config.hamlets||[]).length}</b></div>
          <div class="kv-row"><span>Số phương án vay vốn</span><b>${activeLoanProjects().length}</b></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Danh sách cảnh báo hiện tại</h3></div>
        <div class="panel-body">
          ${alerts.length? alerts.map(a=>`<div class="kv-row"><span>${a.text}</span><span class="pill ${a.color==='red'?'pill-red':a.color==='orange'?'pill-orange':'pill-gray'}">${a.color==='yellow'?'Vàng':a.color==='orange'?'Cam':'Đỏ'}</span></div>`).join('') : `<div class="empty-state"><div class="e-ico">✅</div>Không có cảnh báo nào vào lúc này</div>`}
        </div>
      </div>`;
  }

  function borrowerRowStatus(b){
    const {from,to} = periodRange();
    const calc = calcInterest(b, from, to);
    return {calc, iStatus: interestStatus(b, calc.due), pStatus: principalStatus(b)};
  }

  // ---------------------------------------------------------------------
  // "PHƯƠNG ÁN VAY" — Admin tạo trước (tên, tổng vốn, ngày vay/đến hạn, lãi suất, tỷ lệ trích chia
  // theo cấp), sau đó thêm từng người vay VÀO phương án. Người vay TỰ ĐỘNG kế thừa các thiết lập
  // này ngay lúc thêm (sao chép 1 lần vào hồ sơ của họ — xem emptyBorrowerForProject()), nên toàn
  // bộ hàm tính lãi/báo cáo/in ấn sẵn có (calcInterest, computeProjectOverview...) không cần sửa gì
  // vì vẫn đọc đúng các trường quen thuộc (b.rate, b.loanDate, b.dueDate...) trên hồ sơ người vay.
  // ---------------------------------------------------------------------
  function activeLoanProjects(){ return (state.loanProjects||[]).filter(p=>!p.deleted); }
  // Danh sách phương án vay HỢP LỆ để gán người vay MỚI vào — gồm "đang hoạt động" (có người vay đang
  // hoạt động, hoặc hoàn toàn chưa có ai) + "bị ẩn" (từng có người vay nhưng hiện không còn ai đang
  // hoạt động — đã tất toán/trả nợ trước hạn/bị xoá hết) — về mặt kỹ thuật, 2 nhóm này CỘNG LẠI đúng
  // bằng activeLoanProjects() (mọi phương án CHƯA BỊ XOÁ), nên dùng thẳng hàm đó là đủ, không cần lọc
  // thêm gì khác. Dùng CHUNG cho: modal AI "Đổi phương án vay"/"Thêm phương án vay", form "Thêm người
  // vay mới" ngoài panel, và system prompt của AI.
  function eligibleProjectsForBorrowerAssignment(){ return activeLoanProjects(); }
  // Cập nhật TRỰC TIẾP danh sách <option> của dropdown "Chọn phương án vay" trong modal "Thêm người
  // vay mới" NẾU modal đó đang mở VÀ đang ở đúng trạng thái hiện dropdown (chưa chọn phương án) — chạy
  // mỗi khi dữ liệu Firebase (borrowers/loanProjects) đổi, để danh sách LUÔN đúng theo thời gian thực
  // mà KHÔNG cần đóng mở lại modal, và KHÔNG đụng tới bất kỳ trường nào khác người dùng đang gõ dở.
  function refreshOpenBorrowerModalProjectPicker(){
    const sel = document.getElementById('m-project-picker');
    if(!sel) return; // modal không mở, hoặc đang ở trạng thái đã chọn xong (hiện khung thông tin, không phải dropdown)
    const curVal = sel.value;
    const projects = eligibleProjectsForBorrowerAssignment();
    const options = ['<option value="">-- Chọn phương án vay --</option>']
      .concat(projects.map(pr=>`<option value="${pr.id}" ${pr.id===curVal?'selected':''}>${escapeHtml(pr.name)}</option>`))
      .concat(['<option value="__add__">+ Thêm phương án vay...</option>']);
    sel.innerHTML = options.join('');
    // Nếu phương án đang chọn KHÔNG còn hợp lệ nữa (VD vừa bị tất toán hết ngay trong lúc modal đang
    // mở) -> tự reset về rỗng, không giữ lại giá trị cũ đã mất hiệu lực.
    if(curVal && !projects.some(pr=>pr.id===curVal)) sel.value = '';
  }
  function projectOf(b){ return (state.loanProjects||[]).find(p=>p.id===b.projectId) || null; }
  // Màu nền khung tiêu đề phương án vay — theo LOẠI người vay chiếm ĐA SỐ trong TOÀN BỘ phương án
  // đó (không phụ thuộc bộ lọc đang xem): xanh lá=đang hoạt động bình thường, xanh dương nhạt=đã tất
  // toán/trả nợ trước hạn xong, cam nhạt=đang gia hạn nợ, đỏ nhạt=nợ rủi ro. Bằng nhau -> ưu tiên đỏ
  // > cam > xanh dương > xanh lá.
  // Sắp xếp danh sách Phương án vay theo đúng thứ tự tuỳ chỉnh đã lưu (state.config.projectOrder).
  // Phương án nào CHƯA có trong thứ tự đã lưu (mới tạo sau) thì tự động xếp NGAY SAU những phương án
  // đã có thứ tự, giữ nguyên thứ tự tương đối gốc giữa các phương án chưa xếp.
  // =====================================================================
  // Hạ tầng dùng CHUNG cho MỌI tính năng kéo-thả trong toàn bộ ứng dụng (Sắp xếp Phương án vay, Sắp
  // xếp Người vay trong phương án, Tuỳ chỉnh cột...) — khi đang kéo giữ 1 phần tử, luôn hiện 1 đường
  // kẻ ngang màu xanh đậm ngay đúng khoảng giữa 2 phần tử mà phần tử đang kéo sẽ được chèn vào nếu
  // nhả chuột tại đó, đường kẻ này di chuyển liên tục theo con chuột.
  // =====================================================================
  function getDragIndicatorLine(){
    let line = document.getElementById('__dragIndicatorLine');
    if(!line){
      line = document.createElement('div');
      line.id = '__dragIndicatorLine';
      line.style.cssText = 'position:fixed; height:3px; background:#0d3b78; z-index:99999; pointer-events:none; display:none; border-radius:2px; box-shadow:0 0 5px rgba(13,59,120,.7);';
      document.body.appendChild(line);
    }
    return line;
  }
  function showDragIndicator(targetEl, before, blocked){
    const line = getDragIndicatorLine();
    const rect = targetEl.getBoundingClientRect();
    line.style.left = rect.left+'px';
    line.style.width = rect.width+'px';
    line.style.top = (before? rect.top-2 : rect.bottom-2)+'px';
    line.style.background = blocked? '#c62828' : '#0d3b78';
    line.style.boxShadow = blocked? '0 0 5px rgba(198,40,40,.7)' : '0 0 5px rgba(13,59,120,.7)';
    line.style.display = 'block';
  }
  function hideDragIndicator(){
    const line = document.getElementById('__dragIndicatorLine');
    if(line) line.style.display = 'none';
  }
  // Gắn đầy đủ hành vi kéo-thả (dragstart/dragover/drop/dragend) + đường kẻ chỉ vị trí cho 1 nhóm
  // phần tử. `onReorder(draggedKey, targetKey, insertBefore)` tự quyết định cách sắp xếp lại mảng.
  function wireDragReorderWithIndicator(rows, getKey, onReorder, isForcedPair){
    let draggedEl = null, draggedKey = null;
    let scrollContainer = null, autoScrollRAF = null, autoScrollDir = 0;
    function findScrollContainer(el){
      let p = el.parentElement;
      while(p){
        const style = getComputedStyle(p);
        if((style.overflowY==='auto' || style.overflowY==='scroll') && p.scrollHeight>p.clientHeight) return p;
        p = p.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    }
    function autoScrollStep(){
      if(!scrollContainer || autoScrollDir===0){ autoScrollRAF = null; return; }
      scrollContainer.scrollTop += autoScrollDir * 14;
      autoScrollRAF = requestAnimationFrame(autoScrollStep);
    }
    function stopAutoScroll(){ autoScrollDir = 0; if(autoScrollRAF){ cancelAnimationFrame(autoScrollRAF); autoScrollRAF=null; } scrollContainer = null; }
    // Kiểm tra: nếu thả vào vị trí này (trước/sau `row`) thì có bị "chen vào giữa" 1 cặp cột bắt buộc
    // đi liền nhau hay không — dựa vào cột NGAY SÁT vị trí thả (không tính chính phần tử đang kéo).
    function isGapBlocked(row, before){
      if(!isForcedPair) return false;
      const idx = rows.indexOf(row);
      const others = rows.filter(r=> r!==draggedEl);
      const otherIdx = others.indexOf(row);
      const neighborRow = before ? others[otherIdx-1] : others[otherIdx+1];
      if(!neighborRow) return false;
      return isForcedPair(getKey(neighborRow), getKey(row));
    }
    rows.forEach(row=>{
      row.addEventListener('dragstart', (e)=>{
        draggedEl = row; draggedKey = getKey(row); row.style.opacity='0.4'; scrollContainer = findScrollContainer(row);
        // Ảnh kéo tuỳ chỉnh — nền tối + viền trắng dày, dễ nhìn thấy trên mọi nền màu (thay vì icon
        // bàn tay mặc định của trình duyệt, thường màu trắng, dễ bị chìm vào nền trắng của modal).
        if(e.dataTransfer && e.dataTransfer.setDragImage){
          const ghost = document.createElement('div');
          ghost.textContent = '⠿ ' + (row.textContent||'').trim().slice(0,30);
          ghost.style.cssText = 'position:fixed; top:-1000px; left:-1000px; padding:6px 14px; background:#212121; color:#fff; border:2px solid #fff; border-radius:8px; font-size:13px; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,.5); white-space:nowrap;';
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 14, 14);
          setTimeout(()=> ghost.remove(), 0);
        }
      });
      row.addEventListener('dragend', ()=>{ if(draggedEl) draggedEl.style.opacity=''; draggedEl=null; draggedKey=null; hideDragIndicator(); stopAutoScroll(); });
      row.addEventListener('dragover', (e)=>{
        e.preventDefault();
        if(!draggedKey || row===draggedEl) { hideDragIndicator(); return; }
        const rect = row.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height/2;
        const blocked = isGapBlocked(row, before);
        showDragIndicator(row, before, blocked);
        row.dataset.__dragBefore = before ? '1' : '0';
        row.dataset.__dragBlocked = blocked ? '1' : '0';
        // Tự động cuộn nhẹ khi con trỏ đang kéo tới gần mép trên/dưới của khung cuộn (modal-body...)
        if(scrollContainer){
          const cRect = scrollContainer.getBoundingClientRect();
          const EDGE = 50;
          if(e.clientY > cRect.bottom - EDGE) autoScrollDir = 1;
          else if(e.clientY < cRect.top + EDGE) autoScrollDir = -1;
          else autoScrollDir = 0;
          if(autoScrollDir!==0 && !autoScrollRAF) autoScrollRAF = requestAnimationFrame(autoScrollStep);
        }
      });
      row.addEventListener('dragleave', ()=>{ /* giữ nguyên đường kẻ tới khi hover phần tử khác, tránh nhấp nháy */ });
      row.addEventListener('drop', (e)=>{
        e.preventDefault();
        hideDragIndicator();
        stopAutoScroll();
        const targetKey = getKey(row);
        if(!draggedKey || draggedKey===targetKey) return;
        if(row.dataset.__dragBlocked==='1') return; // vị trí này chen vào giữa 1 cặp cột bắt buộc -> không cho thả
        const before = row.dataset.__dragBefore === '1';
        const droppedKey = draggedKey; // CHỤP LẠI ngay — vì sự kiện "dragend" chạy NGAY SAU "drop" sẽ xoá draggedKey về null, nếu không chụp lại thì setTimeout bên dưới sẽ bị hụt mất giá trị.
        onReorder(draggedKey, targetKey, before);
        // Sau khi thả — cuộn tới ĐÚNG vị trí vừa thả (làm trung tâm khung), KHÔNG để tự nhảy lên đầu
        // (vì onReorder thường gọi render() vẽ lại toàn bộ danh sách, làm mất vị trí cuộn cũ).
        setTimeout(()=>{
          const target = document.querySelector(`[data-col-key="${droppedKey}"]`);
          if(target) target.scrollIntoView({behavior:'smooth', block:'center'});
        }, 60);
      });
    });
  }
  function sortedActiveProjects(activeProjectsOnly){
    const order = (state.config && state.config.projectOrder) || [];
    const orderIndex = {}; order.forEach((id,i)=> orderIndex[id]=i);
    return activeProjectsOnly.slice().sort((a,b)=>{
      const ai = orderIndex[a.id], bi = orderIndex[b.id];
      if(ai!=null && bi!=null) return ai-bi;
      if(ai!=null) return -1;
      if(bi!=null) return 1;
      return 0;
    });
  }
  // Sắp xếp danh sách người vay TRONG 1 phương án theo đúng thứ tự tuỳ chỉnh đã lưu
  // (state.config.borrowerOrderByProject[projectId]) — cùng nguyên tắc như trên.
  function sortedBorrowerGroup(groupList, projectId){
    const orderMap = ((state.config && state.config.borrowerOrderByProject) || {})[projectId] || [];
    const orderIndex = {}; orderMap.forEach((id,i)=> orderIndex[id]=i);
    return groupList.slice().sort((a,b)=>{
      const ai = orderIndex[a.id], bi = orderIndex[b.id];
      if(ai!=null && bi!=null) return ai-bi;
      if(ai!=null) return -1;
      if(bi!=null) return 1;
      return 0;
    });
  }
  // Màu nền khung tiêu đề phương án vay — ĐỒNG BỘ TUYỆT ĐỐI với hệ thống màu đã quy định cho TỪNG
  // DÒNG người vay (Panel "Khoản vay đang hoạt động"): quá hạn chưa xử lý > đang gia hạn (bất kỳ lần
  // nào) > còn 30-0 ngày > còn 60-31 ngày > còn 90-61 ngày > còn 120-91 ngày. Phương án nào có loại
  // người vay nào CHIẾM ĐA SỐ thì lấy đúng màu của loại đó; bằng nhau thì ưu tiên đúng theo thứ tự
  // liệt kê ở trên. Không khớp loại nào cả (hoặc rỗng) -> màu xanh lá mặc định.
  // Biến 1 màu rgba(...) sẵn có thành gradient 3D (trắng tinh -> màu gốc -> màu đậm hơn), KHÔNG đổi
  // logic chọn màu, chỉ đổi CÁCH TÔ MÀU.
  function rgbaToGradient(rgbaStr){
    const m = String(rgbaStr).match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if(!m) return rgbaStr;
    const [, r, g, b, a] = m;
    const alpha = parseFloat(a);
    const darker = `rgba(${r},${g},${b},${Math.min(1, alpha*2.2).toFixed(3)})`;
    return `linear-gradient(180deg, #ffffff 0%, ${rgbaStr} 55%, ${darker} 100%)`;
  }
  function projectGroupHeaderBg(projectId){
    const all = state.borrowers.filter(b=>!b.deleted && b.projectId===projectId);
    if(!all.length) return rgbaToGradient('rgba(76,175,80,.10)');
    let overdueCount=0, extendedCount=0, riskDebtCount=0, d30=0, d60=0, d90=0, d120=0, notDueCount=0;
    all.forEach(b=>{
      if(b.riskDebt && !b.badDebt){ riskDebtCount++; return; }
      if(borrowerIsOverdueUnhandled(b)){ overdueCount++; return; }
      if(getBorrowerExtensions(b.id).length>0){ extendedCount++; return; }
      const proj = projectOf(b);
      const dueRef = proj? proj.dueDate : b.dueDate;
      const d = rawDaysRemaining(dueRef);
      if(d!=null){
        if(d<=30){ d30++; return; }
        if(d<=60){ d60++; return; }
        if(d<=90){ d90++; return; }
        if(d<=120){ d120++; return; }
        notDueCount++; return;
      }
    });
    // Thứ tự trong mảng này CHÍNH LÀ thứ tự ưu tiên khi hoà nhau — đừng đổi thứ tự.
    const counts = [
      { n:overdueCount, color:activeLoanColor('overdue') },
      { n:extendedCount, color:activeLoanColor('extended') },
      { n:riskDebtCount, color:activeLoanColor('riskdebt') },
      { n:d30, color:activeLoanColor('d30') },
      { n:d60, color:activeLoanColor('d60') },
      { n:d90, color:activeLoanColor('d90') },
      { n:d120, color:activeLoanColor('d120') },
      { n:notDueCount, color:activeLoanColor('notdue') },
    ];
    const max = Math.max(...counts.map(c=>c.n));
    if(max===0) return rgbaToGradient('rgba(76,175,80,.10)');
    return rgbaToGradient(counts.find(c=>c.n===max).color);
  }
  function borrowerProjectName(b){
    const p = projectOf(b);
    if(p) return p.name;
    return b.project || '(không rõ phương án)'; // tương thích ngược cho hồ sơ cũ (nếu có) chỉ có tên tự do
  }
  // Tổng số tiền đã cho vay (chưa xoá) trong 1 phương án — dùng để chặn không cho vượt tổng vốn.
  function projectDisbursedTotal(projectId, excludeBorrowerId){
    return state.borrowers.filter(b=>!b.deleted && !b.settled && b.projectId===projectId && b.id!==excludeBorrowerId)
      .reduce((s,b)=> s + (parseFloat(b.principal)||0), 0);
  }

  // ---------------------------------------------------------------------
  // MÔ HÌNH MỚI: Phương án vay là "hộp chứa" toàn bộ người vay bên trong nó.
  //   • Xoá phương án vay -> TOÀN BỘ người vay đang thuộc phương án đó bị cuốn theo vào thùng rác
  //     NGAY LẬP TỨC, đóng gói CHUNG vào đúng 1 dòng thùng rác của phương án (borrowersSnapshot).
  //   • Thùng rác của Sổ vay vốn CHỈ hiển thị các Phương án vay đã xoá (không còn hiện riêng lẻ
  //     từng người vay nữa).
  //   • KHÔNG khôi phục được riêng lẻ từng người vay — chỉ khôi phục được CẢ phương án (kèm toàn
  //     bộ người vay còn lại trong đó). Bấm vào tên phương án trong thùng rác sẽ xem được danh
  //     sách người vay bên trong, kèm nút "Xoá vĩnh viễn" cho từng người (xoá thẳng người đó ra
  //     khỏi gói, không ảnh hưởng phần còn lại / không thể hoàn tác).
  // ---------------------------------------------------------------------
  async function deleteLoanProjectCascade(p, closeFn){
    const activeMembers = state.borrowers.filter(b=>!b.deleted && !b.settled && b.projectId===p.id);
    const msg = activeMembers.length>0
      ? `Xoá phương án "${p.name}" sẽ chuyển vào Thùng rác CẢ phương án LẪN toàn bộ ${activeMembers.length} người vay đang ở trong đó (không tách riêng được). Sau này chỉ có thể khôi phục lại NGUYÊN CẢ phương án kèm những người vay này, không khôi phục được từng người riêng lẻ. Đồng chí có chắc chắn muốn xoá?`
      : `Xoá phương án "${p.name}" vào thùng rác?`;
    if(!confirm(msg)) return;
    if(closeFn) closeFn(); // Bước 1: đóng ngay bảng đang thao tác
    showProcessingToast(); // Bước 2
    const borrowersSnapshot = {};
    activeMembers.forEach(b=>{ borrowersSnapshot[b.id] = b; });
    // Dọn khỏi dữ liệu đang hoạt động
    state.borrowers = state.borrowers.filter(b=> !borrowersSnapshot[b.id]);
    state.loanProjects = state.loanProjects.filter(x=>x.id!==p.id);
    for(const bid of Object.keys(borrowersSnapshot)) await cRemoveRecord('borrowers', bid);
    await cRemoveRecord('loanProjects', p.id);
    const trashed = {
      ...p, _kind:'project', deleted:true, deletedAt:new Date().toISOString(),
      deletedBy: state.identity.email, deletedByName: state.identity.name,
      borrowersSnapshot,
    };
    state.trash.push(trashed);
    await cSetRecord('trash', trashed.id, trashed);
    await pushLog('xoá phương án vay', `${p.name} (kèm ${activeMembers.length} người vay)`);
    await pushSharedConfirmationDocument('project_delete_bulk', `GXN Chung: Xoá các hộ vay do xoá cả Phương án vay "${p.name}"`,
      [
        `Phương án vay "${p.name}" đã bị xoá vào ngày ${fmtDate(todayStr())}.`,
        `Các hộ vay bị tác động (${activeMembers.length} người, đều đã bị chuyển vào Thùng rác): ${activeMembers.map(b=>b.name).join(', ')}`,
      ].join('\n'), activeMembers.map(b=>b.id));
    if(state.selectedProjectRow===p.id) state.selectedProjectRow = null;
    hideProcessingToast(); // Bước 4
    showToast('Đã xoá phương án vay thành công!');
  }
  async function restoreLoanProjectCascade(trashId){
    const idx = state.trash.findIndex(x=>x.id===trashId);
    const item = state.trash[idx];
    if(!item) return;
    const membersToRestore = Object.values(item.borrowersSnapshot||{});
    const restoredProject = {...item};
    delete restoredProject._kind; delete restoredProject.deleted; delete restoredProject.deletedAt;
    delete restoredProject.deletedBy; delete restoredProject.deletedByName; delete restoredProject.borrowersSnapshot;
    state.loanProjects.push(restoredProject);
    await cSetRecord('loanProjects', restoredProject.id, restoredProject);
    for(const b of membersToRestore){
      await cSetRecord('borrowers', b.id, b);
      // KHÔNG push thủ công — realtime binding sẽ tự nhận đúng bản ghi mới, tránh hiển thị trùng lặp.
    }
    state.trash.splice(idx,1);
    await cRemoveRecord('trash', trashId);
    await pushLog('khôi phục phương án vay', `${restoredProject.name} (kèm ${membersToRestore.length} người vay)`);
  }
  async function purgeLoanProjectTrashForever(trashId){
    const item = state.trash.find(x=>x.id===trashId);
    if(!item) return;
    if(!confirm(`XOÁ VĨNH VIỄN phương án "${item.name}" cùng toàn bộ ${Object.keys(item.borrowersSnapshot||{}).length} người vay bên trong? Không thể khôi phục. Hồ sơ từng người vay vẫn được lưu lại trong Kho lưu trữ để không mất dấu vết Biên lai/Giấy xác nhận.`)) return false;
    showProcessingToast();
    for(const bRecord of Object.values(item.borrowersSnapshot||{})){
      await archiveBorrowerBeforePurge(bRecord);
    }
    state.trash = state.trash.filter(x=>x.id!==trashId);
    await cRemoveRecord('trash', trashId);
    await pushLog('xoá vĩnh viễn phương án vay', item.name);
    hideProcessingToast();
    showToast('Đã xoá vĩnh viễn thành công!');
    return true;
  }
  // Lưu lại VĨNH VIỄN 1 bản chụp người vay TRƯỚC KHI xoá thật khỏi Thùng rác — để không làm mất dấu
  // vết Biên lai/Giấy xác nhận/Nhật ký của họ trong Kho lưu trữ. Bản lưu này CHỈ ĐỌC, không thể khôi
  // phục lại thành người vay đang hoạt động được nữa.
  async function archiveBorrowerBeforePurge(borrowerRecord){
    const archived = { ...borrowerRecord, purgedAt:new Date().toISOString(), purgedBy: state.identity.email, purgedByName: state.identity.name };
    await cSetRecord('permanentlyDeletedBorrowers', archived.id, archived);
    state.permanentlyDeletedBorrowers = (state.permanentlyDeletedBorrowers||[]).filter(x=>x.id!==archived.id);
    state.permanentlyDeletedBorrowers.push(archived);
    await pushConfirmationDocument('borrower_purge', `Giấy xác nhận xoá vĩnh viễn hộ vay "${archived.name}"`,
      `Hộ vay "${archived.name}" đã bị xoá vĩnh viễn khỏi Thùng rác vào ngày ${fmtDate(todayStr())}, không thể khôi phục.`, archived);
  }
  // Xoá vĩnh viễn 1 người vay CỤ THỂ ngay trong gói thùng rác của phương án — không ảnh hưởng
  // tới phần còn lại của gói, và KHÔNG thể khôi phục lại riêng người này nữa.
  async function purgeSingleBorrowerInProjectTrash(trashId, borrowerId){
    const item = state.trash.find(x=>x.id===trashId);
    if(!item || !item.borrowersSnapshot || !item.borrowersSnapshot[borrowerId]) return;
    const bRecord = item.borrowersSnapshot[borrowerId];
    const bName = bRecord.name;
    if(!confirm(`Xoá vĩnh viễn người vay "${bName}" khỏi gói thùng rác này? Không thể khôi phục lại riêng người này nữa (phần còn lại của phương án vẫn giữ nguyên). Hồ sơ vẫn được lưu lại trong Kho lưu trữ để không mất dấu vết Biên lai/Giấy xác nhận.`)) return;
    showProcessingToast();
    await archiveBorrowerBeforePurge(bRecord);
    delete item.borrowersSnapshot[borrowerId];
    await cRemoveRecord(`trash/${trashId}/borrowersSnapshot`, borrowerId);
    await pushLog('xoá vĩnh viễn người vay (trong thùng rác)', bName);
    hideProcessingToast();
    showToast('Đã xoá vĩnh viễn thành công!');
  }
  // Người vay bị xoá RIÊNG LẺ (không xoá cả phương án) vẫn nằm trong Thùng rác dưới dạng 1 dòng
  // độc lập, KHÔNG bao giờ đứng ngoài phương án — khôi phục lại sẽ tự động chui về đúng phương án
  // cũ, kèm kiểm tra không vượt tổng vốn (nếu vượt thì tự động đưa số tiền vay về 0 kèm cảnh báo).
  async function restoreStandaloneBorrower(trashId){
    const idx = state.trash.findIndex(x=>x.id===trashId);
    const item = state.trash[idx];
    if(!item) return false;
    if(!confirm(`Đồng chí có CHẮC CHẮN muốn khôi phục hộ vay "${item.name}" khỏi Thùng rác không? Hộ vay này sẽ trở lại danh sách khoản vay đang hoạt động.`)) return false;
    const restored = {...item};
    delete restored._kind; delete restored.deleted; delete restored.deletedAt; delete restored.deletedBy; delete restored.deletedByName;
    const proj = state.loanProjects.find(p=>p.id===restored.projectId);
    if(proj){
      const disbursedNow = projectDisbursedTotal(proj.id); // restored chưa nằm trong state.borrowers nên không cần loại trừ
      const wouldBeTotal = disbursedNow + (parseFloat(restored.principal)||0);
      if(wouldBeTotal > (parseFloat(proj.totalCapital)||0)){
        restored.principal = 0;
        alert('Hộ vay đã được khôi phục về phương án cũ, nhưng Số tiền vay đã tự động chuyển về 0 vì tổng nguồn vốn của phương án này đã được phân bổ hết hoặc không đủ để đáp ứng số tiền vay cũ.');
      }
    }
    await cSetRecord('borrowers', restored.id, restored);
    // KHÔNG push thủ công — realtime binding sẽ tự nhận đúng bản ghi mới, tránh hiển thị trùng lặp.
    state.trash.splice(idx,1);
    await cRemoveRecord('trash', trashId);
    await pushLog('khôi phục', `hộ ${restored.name}`);
    return true;
  }
  async function purgeStandaloneBorrowerForever(trashId){
    const item = state.trash.find(x=>x.id===trashId);
    if(!item) return false;
    if(!confirm(`XOÁ VĨNH VIỄN người vay "${item.name}"? Không thể khôi phục. Hồ sơ vẫn được lưu lại trong Kho lưu trữ để không mất dấu vết Biên lai/Giấy xác nhận.`)) return false;
    showProcessingToast();
    await archiveBorrowerBeforePurge(item);
    state.trash = state.trash.filter(x=>x.id!==trashId);
    await cRemoveRecord('trash', trashId);
    await pushLog('xoá vĩnh viễn', `hộ ${item.name}`);
    hideProcessingToast();
    showToast('Đã xoá vĩnh viễn thành công!');
    return true;
  }
  function emptyLoanProject(){
    return { id:uid(), name:'', totalCapital:0, disburseDate:todayStr(), dueDate:'',
      fundSourceType: FUND_SOURCE_OPTIONS[0], fundSourceOther:'',
      interestRate:8.4, splitCentral:3.5, splitProvince:2, splitWard:2.9, hamletAllocPercent:45,
      createdAt:new Date().toISOString(), deleted:false };
  }
  // Hồ sơ người vay MỚI, kế thừa toàn bộ thiết lập của phương án đã chọn — Admin chỉ cần bổ sung
  // Họ tên / Địa bàn / Số tiền vay thực tế (+ Thông tin nâng cao không bắt buộc).
  function emptyBorrowerForProject(project){
    return { id: uid(), name:'', birthYear:'', cccd:'', phone:'', address:'', preMergerAddress:'', industry:'', repayAbility:'', guarantor:'',
      projectId: project? project.id : '', hamlet:(state.config.hamlets||[])[0]||'', principal:0,
      rate: project? (parseFloat(project.interestRate)||0) : 6.6,
      loanDate: project? project.disburseDate : todayStr(),
      dueDate: project? project.dueDate : '',
      fundSource: project? projectFundSourceLabel(project) : '',
      splitCentral: project?project.splitCentral:0, splitProvince: project?project.splitProvince:0,
      splitWard: project?project.splitWard:0, hamletAllocPercent: project?project.hamletAllocPercent:45,
      checked:false, note:'', prevBalance:0, interestPaid:0, principalPaid:0, isExtended:false, extensionDueDate:'' };
  }

  // Định nghĩa TOÀN BỘ cột có thể hiển thị/in/xuất Excel của Sổ vay vốn — dùng CHUNG 1 nguồn cho
  // bảng trên màn hình, in ấn, và xuất Excel để không bao giờ bị lệch nhau.
  // Tính số tiền lãi được phân bổ về từng cấp cho 1 người vay, dựa trên lãi thực tính được trong
      // kỳ đang chọn và tỷ lệ % đã kế thừa từ phương án lúc thêm người vay.
  // Số tiền phân bổ về từng cấp của Quý HIỆN TẠI — dùng ĐÚNG công thức như cột "Số tiền lãi":
  // Gốc × (tỷ lệ %/năm của cấp đó ÷ tổng số ngày chu kỳ năm) × số ngày tính lãi thực tế trong Quý
  // (đã xét Ngày vay/Ngày đến hạn nếu rơi giữa quý). Riêng cấp Ấp/Thôn lấy từ số tiền Cấp Xã nhân
  // với "% Xã phân bổ về Ấp" (không tính lại từ gốc).
  // Yêu cầu mới: 4 cột phân bổ Trung ương/Tỉnh/Xã/Ấp công khai giờ là TỔNG DỒN của đúng cột cùng
  // tên trong "hệ thống cột trong hạn" + "hệ thống cột gia hạn lần 1..5" (mỗi thành phần đã tự
  // tính đúng theo các hộp chứa Quý đang khớp bộ lọc Quý/Năm hiện hành).
  function computeBorrowerAllocations(b){
    const sumField = (field)=>{
      let total = getInTermColumnValue(b, field);
      for(let lvl=1; lvl<=MAX_LOAN_EXTENSIONS; lvl++) total += getExtensionLevelColumnValue(b, lvl, field);
      return Math.round(total);
    };
    return {
      central: sumField('splitCentralAmt'),
      province: sumField('splitProvinceAmt'),
      ward: sumField('splitWardAmt'),
      hamlet: sumField('hamletAllocAmt'),
    };
  }
  // Độ rộng CỐ ĐỊNH cho từng LOẠI cột (px) — dùng chung cho mọi bảng danh sách trong toàn module Sổ
  // vay vốn (panel, modal, cả modal Excel). Cột nào tiêu đề dài (VD "Tiền đã đóng dư chưa thuộc về
  // quý nào") thì GIỮ rộng theo đúng độ dài tiêu đề, không ép hẹp. Cột tên/địa phương quan trọng thì
  // nới rộng hơn 1 chút cho dễ đọc, nhưng vẫn có giới hạn — không rộng tràn lan, đặc biệt trên điện
  // thoại. Nội dung quá dài trong ô sẽ TỰ XUỐNG DÒNG (ở dấu cách), không làm cột rộng thêm.
  function svColWidth(col){
    if(col.width) return col.width; // ghi đè trực tiếp — ưu tiên cao nhất, dùng khi cần chỉnh tay riêng 1 cột cụ thể
    const key = col.key||'';
    const label = String(col.label||'').replace(/<br>/g,' ');
    // Cột chứa TÊN QUÝ (VD "Các quý chưa đóng lãi": "Quý 3-2026, Quý 4*-2026,...") — đủ rộng chứa
    // liền ít nhất 3 tên Quý (kể cả có dấu */#) không cần xuống dòng.
    if(col.isQuarter) return 300;
    // Cột CCCD — đủ 14 chữ số. Cột SỐ ĐIỆN THOẠI — đủ 12 chữ số.
    if(key==='cccd' || /CCCD|Căn cước/i.test(label)) return 150;
    if(key==='phone' || /điện thoại/i.test(label)) return 130;
    // Cột "Thời gian còn lại" — đủ chứa "còn XXXXX ngày" (dài nhất có thể gặp).
    if(key==='daysRemaining' || /Thời gian còn lại/i.test(label)) return 130;
    // Cột TIỀN — đủ rộng chứa "10.000.000.000 đ" (10 tỷ đồng, dãy số dài nhất thực tế có thể gặp)
    // trên 1 dòng, không cần xuống hàng.
    if(col.align==='right' || /Amount$/.test(key) || /\(đ\)|Số tiền/i.test(label)) return 155;
    if(key==='name' || key==='project' || /^(Họ và tên|Tên phương án)$/i.test(label)) return 150;
    if(key==='hamlet' || key==='address' || key==='preMergerAddress' || /Đơn vị|Địa chỉ|Địa phương/i.test(label)) return 120;
    if(/ngày|date/i.test(key) && !/số ngày|days[Cc]ount/i.test(key+label)) return 88;
    if(/%/.test(label)) return 80;
    if(label.length>22) return 145;
    if(label.length>14) return 120;
    return 100;
  }
  // Kiểu dáng cho TIÊU ĐỀ CỘT (th) — LUÔN CĂN GIỮA (kể cả tiêu đề 1 dòng hay nhiều dòng), dùng chung
  // cho mọi bảng, mọi modal (kể cả modal Excel).
  function svColStyleHeader(col){
    const w = svColWidth(col);
    return `width:${w}px; min-width:${w}px; max-width:${w}px; white-space:normal; overflow-wrap:break-word; word-break:normal; text-align:center;`;
  }
  // Kiểu dáng cho Ô DỮ LIỆU (td) — độ rộng CỐ ĐỊNH CHÍNH XÁC (width=min-width=max-width) — QUAN TRỌNG:
  // phải có min-width bằng đúng max-width, nếu không trình duyệt sẽ tự ý CO HẸP ĐỒNG LOẠT mọi cột theo
  // tỷ lệ khi tổng độ rộng các cột vượt quá khung nhìn (hành vi mặc định table-layout:auto khi thiếu
  // min-width) — đây chính là nguyên nhân gây ra hàng loạt lỗi trước đó (tiền xuống hàng, sai độ rộng,
  // căn lề sai do bị xuống dòng ngoài ý muốn). Bảng nhiều cột sẽ tự cuộn ngang thay vì co bóp lại.
  // Chữ tự xuống dòng ở dấu cách khi vượt quá độ rộng. CĂN LỀ:
  //   - col.isQuarter (chứa tên Quý)      -> luôn căn TRÁI
  //   - col.align==='right' (tiền)         -> luôn căn PHẢI
  //   - col.userInput (do NGƯỜI DÙNG nhập) -> luôn căn TRÁI
  //   - còn lại (do HỆ THỐNG tự tính ra)   -> luôn căn GIỮA
  // (riêng khi ô THẬT SỰ xuống dòng 2+ dòng thì dòng cuối sẽ tự đổi thành căn phải, đo bằng JS ở dưới)
  function svColStyle(col){
    const w = svColWidth(col);
    const isMoney = col.align==='right';
    const alignCss = col.isQuarter? 'text-align:left;' : (isMoney? 'text-align:right;' : (col.userInput? 'text-align:left;' : 'text-align:center;'));
    return `width:${w}px; min-width:${w}px; max-width:${w}px; white-space:normal; overflow-wrap:break-word; word-break:normal; ${alignCss}`;
  }
  // Sau khi 1 bảng có cột độ-rộng-cố-định được vẽ xong, gọi hàm này (truyền vào phần tử cha chứa bảng)
  // để ĐO chiều cao thực tế từng ô — ô nào cao hơn 1 dòng (đã tự xuống dòng thật) mới áp dụng "dòng đầu
  // căn trái, dòng cuối căn phải"; ô không xuống dòng thì KHÔNG đụng gì, giữ nguyên căn lề cũ.
  // ĐÃ BỎ tính năng "dòng đầu căn trái, dòng cuối căn phải" (gây ra nhiều lỗi khó kiểm soát) — giờ hàm
  // này không làm gì cả, giữ lại rỗng để KHÔNG PHẢI sửa lại mọi nơi đang gọi tới nó. Căn lề giờ HOÀN
  // TOÀN đơn giản, đồng nhất (trái/giữa/phải) theo đúng loại cột, cố định sẵn trong CSS của svColStyle,
  // không còn phụ thuộc vào việc đo đạc JS phức tạp (nguồn gốc gây lỗi trước đây) nữa.
  function applySvColWrapAlignment(container){ /* không làm gì — đã bỏ tính năng "dòng đầu trái, dòng cuối phải" */ }
  // ---------------------------------------------------------------------------------------------
  // TỰ ĐỘNG CO HẸP CỘT THEO NỘI DUNG (làm lại bằng JS đo lường thật, đáng tin cậy hơn hẳn so với dựa
  // vào hành vi mặc định của trình duyệt trước đây — nguồn gốc gây ra hàng loạt lỗi căn lề/độ rộng).
  // Cách hoạt động: với MỖI bảng có cột độ-rộng-cố-định, đo độ rộng THẬT SỰ cần thiết của nội dung dài
  // nhất trong TỪNG CỘT (gộp cả tiêu đề lẫn mọi dòng dữ liệu) bằng Canvas (nhanh, không cần thao tác
  // DOM/gây giật layout) — rồi co cột đó lại đúng bằng độ rộng cần thiết ấy, nhưng KHÔNG BAO GIỜ vượt
  // quá độ rộng tối đa đã thiết kế sẵn (nếu nội dung dài hơn mức tối đa thì vẫn xuống dòng như cũ).
  // ---------------------------------------------------------------------------------------------
  let __svMeasureCanvas = null;
  function svMeasureTextWidth(text, font){
    if(!__svMeasureCanvas) __svMeasureCanvas = document.createElement('canvas');
    const ctx = __svMeasureCanvas.getContext('2d');
    ctx.font = font;
    return ctx.measureText(text).width;
  }
  // Độ rộng nội dung THẬT SỰ cần thiết của 1 ô — tách theo từng dòng (ngăn cách bởi <br>), đo TỪNG
  // DÒNG riêng rồi lấy dòng RỘNG NHẤT (vì tiêu đề nhiều cột có <br> chủ đích xuống dòng, không nên gộp
  // chung các dòng lại đo 1 lần, sẽ RA SAI kết quả).
  function svCellContentWidth(cell, font){
    const html = cell.innerHTML || '';
    const lines = html.split(/<br\s*\/?>/i);
    let maxW = 0;
    lines.forEach(line=>{
      const tmp = document.createElement('div');
      tmp.innerHTML = line;
      const text = (tmp.textContent||'').trim();
      if(!text) return;
      const w = svMeasureTextWidth(text, font);
      if(w>maxW) maxW = w;
    });
    return maxW;
  }
  function applySvColAutoFit(container){
    if(!container) return;
    container.querySelectorAll('table').forEach(table=>{
      if(table.dataset.svAutoFitDone) return; // mỗi bảng chỉ đo 1 lần lúc vừa vẽ xong — bảng mới vẽ lại (DOM mới) sẽ tự đo lại
      const rows = Array.from(table.rows);
      if(!rows.length) return;
      let hasAnyFixed = false;
      rows.forEach(r=> Array.from(r.cells).forEach(c=>{ if(parseFloat(c.style.maxWidth)) hasAnyFixed = true; }));
      if(!hasAnyFixed) return; // bảng này không dùng hệ thống độ rộng cố định của tôi -> bỏ qua, không đụng vào
      table.dataset.svAutoFitDone = '1';
      let maxCols = 0;
      rows.forEach(r=> maxCols = Math.max(maxCols, r.cells.length));
      const naturalW = new Array(maxCols).fill(0);
      const designatedMax = new Array(maxCols).fill(0);
      const hasFixed = new Array(maxCols).fill(false);
      rows.forEach(r=>{
        Array.from(r.cells).forEach((cell, ci)=>{
          const mw = parseFloat(cell.style.maxWidth);
          if(!mw) return;
          hasFixed[ci] = true;
          designatedMax[ci] = Math.max(designatedMax[ci], mw);
          const cs = getComputedStyle(cell);
          const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const padH = (parseFloat(cs.paddingLeft)||0) + (parseFloat(cs.paddingRight)||0);
          const w = svCellContentWidth(cell, font) + padH + 2; // +2px đệm an toàn tránh sát mép
          if(w>naturalW[ci]) naturalW[ci] = w;
        });
      });
      rows.forEach(r=>{
        Array.from(r.cells).forEach((cell, ci)=>{
          if(!hasFixed[ci]) return;
          const finalW = Math.max(30, Math.min(naturalW[ci], designatedMax[ci])); // tối thiểu 30px để không co quá đà
          cell.style.width = finalW+'px';
          cell.style.minWidth = finalW+'px';
          // Giữ nguyên max-width đúng bằng mức tối đa đã thiết kế — để nếu sau này nội dung dài hơn dự
          // kiến (dữ liệu khác) vẫn tự xuống dòng đúng như thiết kế, không bao giờ phá vỡ giới hạn.
        });
      });
    });
  }
  function BORROWER_COLUMNS(){
    return [
      { key:'name', label:'Họ và tên', advanced:false, userInput:true, get:b=> b.name||'' },
      { key:'hamlet', label:'Đơn vị', advanced:false, userInput:true, get:b=> b.hamlet||'' },
      { key:'project', label:'Phương án vay', advanced:true, hidden:true, get:b=> borrowerProjectName(b) },
      { key:'principal', label:'Số tiền gốc (đ)', advanced:false, align:'right', get:b=> moneySpaced(b.principal) },
      { key:'loanDate', label:'Ngày vay', advanced:false, get:b=> fmtDate(b.loanDate) },
      { key:'dueDate', label:'Ngày đến hạn', advanced:false, get:b=> fmtDate(b.dueDate) },
      { key:'fundSource', label:'Nguồn vay', advanced:false, userInput:true, get:b=> fundSourceDisplay(b.fundSource) },
      { key:'rate', label:'Lãi suất (%/năm)', advanced:false, align:'right', get:b=> formatRateWithOverdueHtml(b,'rate','%/năm'), getPlain:b=> formatRateWithOverduePlain(b,'rate','%/năm') },
      { key:'interestFromDate', label:'Tính lãi từ ngày', advanced:false, get:b=> fmtDate(borrowerCurrentQuarterRange(b).from) },
      { key:'interestToDate', label:'đến ngày', advanced:false, get:b=> fmtDate(borrowerCurrentQuarterRange(b).to) },
      { key:'interestDaysCount', label:'Số ngày tính lãi', advanced:true, get:b=>{ const r = borrowerCurrentQuarterRange(b); return (r.from&&r.to) ? Math.max(0, daysBetween(r.from, r.to)) + ' ngày' : ''; } },
      { key:'quarterInterestAmount', label:'Số tiền lãi', advanced:false, align:'right', get:b=> moneySpaced(computeCurrentQuarterInterest(b)) },
      { key:'quartersUnpaid', label:'Quý chưa đóng lãi', advanced:true, isQuarter:true, get:b=> borrowerQuarterPaymentLabels(b).unpaidText },
      { key:'unpaidInterestPastToNow', label:'Tiền lãi chưa đóng<br>(quá khứ đến hiện tại)', advanced:true, align:'right', get:b=> moneySpaced(computeInterestPaymentBoxDisplay(b).unpaidTotal) },
      { key:'quartersPaid', label:'Quý đã đóng lãi', advanced:true, isQuarter:true, get:b=> borrowerQuarterPaymentLabels(b).paidText },
      { key:'leftoverUnassigned', label:'Tiền đã đóng dư<br>chưa thuộc về quý nào', advanced:true, align:'right', get:b=> moneySpaced(computeInterestPaymentBoxDisplay(b).leftover) },
      { key:'allQuartersDue', label:'Tất cả quý của món vay', advanced:true, hidden:true, get:b=> borrowerQuarterBoxes(b).map(formatTimelineQuarterLabel).join(', ') },
      { key:'splitCentralPct', label:'Phân bổ Trung ương (%)', advanced:true, get:b=> formatRateWithOverdueHtml(b,'splitCentralPct','%'), getPlain:b=> formatRateWithOverduePlain(b,'splitCentralPct','%') },
      { key:'splitCentralAmt', label:'Số tiền về<br>Trung ương (đ)', advanced:true, align:'right', get:b=> moneySpaced(computeBorrowerAllocations(b).central) },
      { key:'splitProvincePct', label:`Phân bổ Cấp ${provinceLevelLabel()} (%)`, advanced:false, get:b=> formatRateWithOverdueHtml(b,'splitProvincePct','%'), getPlain:b=> formatRateWithOverduePlain(b,'splitProvincePct','%') },
      { key:'splitProvinceAmt', label:`Số tiền về<br>Cấp ${provinceLevelLabel()} (đ)`, advanced:false, align:'right', get:b=> moneySpaced(computeBorrowerAllocations(b).province) },
      { key:'splitWardPct', label:`Phân bổ Cấp ${adminLevelLabel()} (%)`, advanced:false, get:b=> formatRateWithOverdueHtml(b,'splitWardPct','%'), getPlain:b=> formatRateWithOverduePlain(b,'splitWardPct','%') },
      { key:'splitWardAmt', label:`Số tiền về<br>Cấp ${adminLevelLabel()} (đ)`, advanced:false, align:'right', get:b=> moneySpaced(computeBorrowerAllocations(b).ward) },
      { key:'hamletAllocPct', label:`% ${adminLevelLabel()} phân bổ<br>về ${subAdminLabel()}`, advanced:false, get:b=> formatRateWithOverdueHtml(b,'hamletAllocPct','%'), getPlain:b=> formatRateWithOverduePlain(b,'hamletAllocPct','%') },
      { key:'hamletAllocAmt', label:`Số tiền về<br>${subAdminLabel()} (đ)`, advanced:false, align:'right', get:b=> moneySpaced(computeBorrowerAllocations(b).hamlet) },
      { key:'extensionHistory', label:'Các lần gia hạn', advanced:true, get:b=> getBorrowerExtensions(b.id).map((e,i)=>`Lần ${i+1} (hạn ${fmtDate(e.to)})`).join(', ') },
      { key:'overdueRateApplied', label:'Lãi suất quá hạn<br>đang áp dụng', advanced:true, get:b=>{ const e = latestBorrowerExtension(b.id); return e? `${String(e.ratePct).replace('.',',')}%/năm` : ''; } },
      { key:'latestExtensionDueDate', label:'Ngày gia hạn<br>gần nhất', advanced:true, get:b=>{ const e = latestBorrowerExtension(b.id); return e? 'hạn '+fmtDate(e.to) : ''; } },
      { key:'daysRemaining', label:'Thời gian còn lại', advanced:true, get:b=>{
        const exts = getBorrowerExtensions(b.id);
        const proj = projectOf(b);
        const dueRef = exts.length? exts[exts.length-1].to : (proj? proj.dueDate : b.dueDate);
        const lbl = daysRemainingLabel(dueRef);
        return exts.length? `<span style="color:#b71c1c; font-weight:700;">${lbl}</span>` : lbl;
      }, getPlain:b=>{
        const exts = getBorrowerExtensions(b.id);
        const proj = projectOf(b);
        const dueRef = exts.length? exts[exts.length-1].to : (proj? proj.dueDate : b.dueDate);
        return daysRemainingLabel(dueRef);
      } },
      { key:'birthYear', label:'Năm sinh', advanced:true, userInput:true, get:b=> b.birthYear||'' },
      { key:'cccd', label:'Số CCCD', advanced:true, userInput:true, get:b=> b.cccd? groupDigitsRight(String(b.cccd),4) : '' },
      { key:'phone', label:'Số điện thoại', advanced:true, userInput:true, get:b=> b.phone? groupDigitsRight(String(b.phone).replace(/[^\d]/g,''),3) : '' },
      { key:'managerName', label:'Người quản lý', advanced:true, userInput:true, get:b=> { const m=ensureDefaultManagers().find(x=>x.id===(b.managerId||'chihoitruong')); return m? m.name : ''; } },
      { key:'address', label:'Địa chỉ cụ thể', advanced:true, userInput:true, get:b=> b.address||'' },
      { key:'preMergerAddress', label:'Địa chỉ trước sáp nhập', advanced:true, userInput:true, get:b=> b.preMergerAddress||'' },
      { key:'industry', label:'Ngành nghề SXKD', advanced:true, userInput:true, get:b=> b.industry||'' },
      { key:'repayAbility', label:'Khả năng trả nợ', advanced:true, userInput:true, get:b=> b.repayAbility||'' },
      { key:'guarantor', label:'Người bảo lãnh', advanced:true, userInput:true, get:b=> b.guarantor||'' },
      { key:'note', label:'Ghi chú thêm', advanced:true, userInput:true, get:b=> b.note||'' },
      ...hiddenInTermAndExtensionColumns(),
    ];
  }
  // Sinh đầy đủ các cột ẨN (hidden:true) của "Hệ thống cột Trong hạn" + "Hệ thống cột Gia hạn lần
  // 1..5" — khớp ĐÚNG với tài liệu hoá ở hiddenColumnSystemsDocs() (Cài đặt Admin). Các cột này
  // KHÔNG hiện trong "Tuỳ chỉnh cột" thường, chỉ dùng được qua "Bộ xem cột ẩn (Không công khai)".
  function hiddenInTermAndExtensionColumns(){
    const money = v=> moneySpaced(v);
    const pct = v=> String(v).replace('.',',')+'%';
    const inTerm = [
      { key:'inTerm_rate', label:'Lãi suất (%/năm)<br>(trong hạn)', advanced:true, hidden:true, align:'right', get:b=> pct(getInTermColumnValue(b,'rate')) },
      { key:'inTerm_days', label:'Số ngày tính lãi<br>(trong hạn)', advanced:true, hidden:true, get:b=> getInTermColumnValue(b,'interestDays')+' ngày' },
      { key:'inTerm_amount', label:'Số tiền lãi<br>(trong hạn)', advanced:true, hidden:true, align:'right', get:b=> money(getInTermColumnValue(b,'interestAmount')) },
      { key:'inTerm_splitCentralPct', label:'Phân bổ Trung ương (%)<br>(trong hạn)', advanced:true, hidden:true, align:'right', get:b=> pct(getInTermColumnValue(b,'splitCentralPct')) },
      { key:'inTerm_splitCentralAmt', label:'Số tiền về Trung ương (đ)<br>(trong hạn)', advanced:true, hidden:true, align:'right', get:b=> money(getInTermColumnValue(b,'splitCentralAmt')) },
      { key:'inTerm_splitProvincePct', label:`Phân bổ Cấp ${provinceLevelLabel()} (%)<br>(trong hạn)`, advanced:true, hidden:true, align:'right', get:b=> pct(getInTermColumnValue(b,'splitProvincePct')) },
      { key:'inTerm_splitProvinceAmt', label:`Số tiền về Cấp ${provinceLevelLabel()} (đ)<br>(trong hạn)`, advanced:true, hidden:true, align:'right', get:b=> money(getInTermColumnValue(b,'splitProvinceAmt')) },
      { key:'inTerm_splitWardPct', label:`Phân bổ Cấp ${adminLevelLabel()} (%)<br>(trong hạn)`, advanced:true, hidden:true, align:'right', get:b=> pct(getInTermColumnValue(b,'splitWardPct')) },
      { key:'inTerm_splitWardAmt', label:`Số tiền về Cấp ${adminLevelLabel()} (đ)<br>(trong hạn)`, advanced:true, hidden:true, align:'right', get:b=> money(getInTermColumnValue(b,'splitWardAmt')) },
      { key:'inTerm_hamletPct', label:`% ${adminLevelLabel()} phân bổ về ${subAdminLabel()}<br>(trong hạn)`, advanced:true, hidden:true, align:'right', get:b=> pct(getInTermColumnValue(b,'hamletAllocPct')) },
      { key:'inTerm_hamletAmt', label:`Số tiền về ${subAdminLabel()} (đ)<br>(trong hạn)`, advanced:true, hidden:true, align:'right', get:b=> money(getInTermColumnValue(b,'hamletAllocAmt')) },
    ];
    const extLevels = [];
    for(let lvl=1; lvl<=MAX_LOAN_EXTENSIONS; lvl++){
      extLevels.push(
        { key:`ext${lvl}_from`, label:`Ngày bắt đầu gia hạn<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, get:b=>{ const v=getExtensionLevelColumnValue(b,lvl,'extendFrom'); return v? fmtDate(v) : ''; } },
        { key:`ext${lvl}_to`, label:`Ngày kết thúc gia hạn<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, get:b=>{ const v=getExtensionLevelColumnValue(b,lvl,'extendTo'); return v? fmtDate(v) : ''; } },
        { key:`ext${lvl}_rate`, label:`Lãi suất (%/năm)<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> pct(getExtensionLevelColumnValue(b,lvl,'rate')) },
        { key:`ext${lvl}_days`, label:`Số ngày tính lãi<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, get:b=> getExtensionLevelColumnValue(b,lvl,'interestDays')+' ngày' },
        { key:`ext${lvl}_amount`, label:`Số tiền lãi<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> money(getExtensionLevelColumnValue(b,lvl,'interestAmount')) },
        { key:`ext${lvl}_splitCentralPct`, label:`Phân bổ Trung ương (%)<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> pct(getExtensionLevelColumnValue(b,lvl,'splitCentralPct')) },
        { key:`ext${lvl}_splitCentralAmt`, label:`Số tiền về Trung ương (đ)<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> money(getExtensionLevelColumnValue(b,lvl,'splitCentralAmt')) },
        { key:`ext${lvl}_splitProvincePct`, label:`Phân bổ Cấp ${provinceLevelLabel()} (%)<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> pct(getExtensionLevelColumnValue(b,lvl,'splitProvincePct')) },
        { key:`ext${lvl}_splitProvinceAmt`, label:`Số tiền về Cấp ${provinceLevelLabel()} (đ)<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> money(getExtensionLevelColumnValue(b,lvl,'splitProvinceAmt')) },
        { key:`ext${lvl}_splitWardPct`, label:`Phân bổ Cấp ${adminLevelLabel()} (%)<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> pct(getExtensionLevelColumnValue(b,lvl,'splitWardPct')) },
        { key:`ext${lvl}_splitWardAmt`, label:`Số tiền về Cấp ${adminLevelLabel()} (đ)<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> money(getExtensionLevelColumnValue(b,lvl,'splitWardAmt')) },
        { key:`ext${lvl}_hamletPct`, label:`% ${adminLevelLabel()} phân bổ về ${subAdminLabel()}<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> pct(getExtensionLevelColumnValue(b,lvl,'hamletAllocPct')) },
        { key:`ext${lvl}_hamletAmt`, label:`Số tiền về ${subAdminLabel()} (đ)<br>(gia hạn lần ${lvl})`, advanced:true, hidden:true, align:'right', get:b=> money(getExtensionLevelColumnValue(b,lvl,'hamletAllocAmt')) },
      );
    }
    return inTerm.concat(extLevels);
  }
  // "advanced:false" = mặc định HIỆN, "advanced:true" = mặc định ẨN (theo đúng bảng mặc định mới).
  // Các cột "Tính lãi từ ngày / đến ngày / Số lãi tồn / Số nợ quá hạn" là trường ĐẶC BIỆT sẽ
  // bổ sung dữ liệu sau — hiện để trống theo đúng yêu cầu.
  function defaultVisibleBorrowerCols(){ return BORROWER_COLUMNS().filter(c=>!c.advanced && !c.hidden).map(c=>c.key); }

  // Các cặp cột LUÔN đi cùng vị trí VÀ cùng ẩn/hiện với nhau.
  const BORROWER_COL_PAIRS = [['loanDate','dueDate'], ['interestFromDate','interestToDate']];
  // Các cặp cột LUÔN đi cùng VỊ TRÍ (kéo 1 đứa thì đứa kia theo), nhưng ẨN/HIỆN thì ĐỘC LẬP —
  // người dùng có thể hiện 1 cột và ẩn cột còn lại trong cùng 1 cặp thoải mái.
  const BORROWER_COL_ORDER_ONLY_PAIRS = [
    ['splitCentralPct','splitCentralAmt'],
    ['splitProvincePct','splitProvinceAmt'],
    ['splitWardPct','splitWardAmt'],
    ['hamletAllocPct','hamletAllocAmt'],
    ['quartersUnpaid','quartersPaid'],
    ['extensionHistory','overdueRateApplied'],
  ];
  const BORROWER_COL_ALL_ORDER_PAIRS = BORROWER_COL_PAIRS.concat(BORROWER_COL_ORDER_ONLY_PAIRS);
  // Mỗi cặp cột 1 màu CƠ BẢN riêng biệt (không trùng nhau) — để người dùng dễ nhận ra cặp nào ra cặp
  // nào trong bảng "Tuỳ chỉnh cột". Thứ tự khớp đúng với BORROWER_COL_ALL_ORDER_PAIRS ở trên.
  const BORROWER_COL_PAIR_COLORS = ['#ad1457','#1565c0','#2e7d32','#e65100','#6d4c41','#6a1b9a','#00695c','#283593'];
  function borrowerColPairColor(key){
    const idx = BORROWER_COL_ALL_ORDER_PAIRS.findIndex(p=>p.includes(key));
    return idx>=0 ? BORROWER_COL_PAIR_COLORS[idx % BORROWER_COL_PAIR_COLORS.length] : '#555';
  }
  // Chuẩn hoá thứ tự cột: "Họ và tên" LUÔN đứng đầu tiên; mỗi cặp (kể cả cặp chỉ liên kết vị trí)
  // LUÔN đứng liền kề nhau đúng thứ tự (a ngay trước b), bất kể trước đó bị kéo đi đâu.
  function normalizeBorrowerColumnOrder(order){
    let arr = order.filter(k=>k!=='name');
    arr.unshift('name');
    BORROWER_COL_ALL_ORDER_PAIRS.forEach(([a,b])=>{
      const ia = arr.indexOf(a), ib = arr.indexOf(b);
      if(ia===-1 || ib===-1) return;
      arr = arr.filter(k=>k!==b);
      arr.splice(arr.indexOf(a)+1, 0, b);
    });
    return arr;
  }
  // Bật/tắt hiển thị 1 cột — CHỈ các cặp trong BORROWER_COL_PAIRS mới bắt buộc ẩn/hiện cùng nhau;
  // các cặp "chỉ liên kết vị trí" thì ẩn/hiện độc lập bình thường.
  function toggleBorrowerColumnVisibility(visibleArr, key){
    const pair = BORROWER_COL_PAIRS.find(p=>p.includes(key));
    const keys = pair || [key];
    const isVisible = visibleArr.includes(key);
    if(isVisible) return visibleArr.filter(k=>!keys.includes(k));
    const set = new Set(visibleArr); keys.forEach(k=>set.add(k));
    return BORROWER_COLUMNS().map(c=>c.key).filter(k=>set.has(k));
  }
  // Kéo-thả 1 cột tới vị trí của 1 cột khác — nếu cột đang kéo thuộc bất kỳ cặp liên kết vị trí
  // nào (kể cả cặp chỉ liên kết vị trí) thì di chuyển CẢ CẶP cùng lúc; không cho thả trước "Họ và
  // tên" (luôn cố định đầu tiên).
  function moveBorrowerColumnGroup(order, draggedKey, targetKey, insertAfter){
    if(draggedKey==='name' || targetKey==='name') return order;
    const pair = BORROWER_COL_ALL_ORDER_PAIRS.find(p=>p.includes(draggedKey));
    const moving = pair || [draggedKey];
    if(moving.includes(targetKey)) return order;
    let arr = order.filter(k=>!moving.includes(k));
    let idx = arr.indexOf(targetKey);
    if(idx<0) idx = arr.length;
    else if(insertAfter) idx += 1;
    const movingSorted = moving.slice().sort((x,y)=> order.indexOf(x)-order.indexOf(y));
    arr.splice(idx, 0, ...movingSorted);
    return normalizeBorrowerColumnOrder(arr);
  }

  function ensureBorrowerVisibleCols(){
    if(!state.borrowerVisibleCols){
      state.borrowerVisibleCols = (state.borrowerColumnPrefsShared && state.borrowerColumnPrefsShared.visible)
        ? state.borrowerColumnPrefsShared.visible.slice() : defaultVisibleBorrowerCols();
    }
    // Đang CHỦ ĐỘNG áp dụng "Bộ xem cột ẩn (Không công khai)" -> KHÔNG lọc bỏ cột hidden, để hiện đủ.
    if(state._appliedColumnViewSetId==='__hiddencols__') return state.borrowerVisibleCols;
    const hiddenKeys = new Set(BORROWER_COLUMNS().filter(c=>c.hidden).map(c=>c.key));
    if(state.borrowerVisibleCols.some(k=>hiddenKeys.has(k))) state.borrowerVisibleCols = state.borrowerVisibleCols.filter(k=>!hiddenKeys.has(k));
    return state.borrowerVisibleCols;
  }
  // Thứ tự cột hiển thị/in/xuất Excel — người dùng kéo-thả để tự sắp xếp lại (xem col-picker).
  function ensureBorrowerColumnOrder(){
    const allKeys = (state._appliedColumnViewSetId==='__hiddencols__' ? BORROWER_COLUMNS() : BORROWER_COLUMNS().filter(c=>!c.hidden)).map(c=>c.key);
    if(!state.borrowerColumnOrder){
      state.borrowerColumnOrder = (state.borrowerColumnPrefsShared && state.borrowerColumnPrefsShared.order)
        ? state.borrowerColumnPrefsShared.order.slice() : allKeys.slice();
    }
    allKeys.forEach(k=>{ if(!state.borrowerColumnOrder.includes(k)) state.borrowerColumnOrder.push(k); });
    state.borrowerColumnOrder = normalizeBorrowerColumnOrder(state.borrowerColumnOrder.filter(k=>allKeys.includes(k)));
    return state.borrowerColumnOrder;
  }

  // ---------------------------------------------------------------------
  // Yêu cầu mới: khung "🧩 Tuỳ chỉnh cột" thao tác trên 1 bản NHÁP riêng (không đụng vào bảng thật
  // đang hiển thị) — CHỈ khi bấm 1 trong 4 nút hành động (Lưu tuỳ chỉnh / Chỉ để xem / Khôi phục
  // cài đặt gốc / Huỷ) thì trạng thái hiển thị mới thực sự thay đổi trên bảng danh sách.
  // ---------------------------------------------------------------------
  function openBorrowerColumnPicker(){
    state.borrowerColPickerDraftVisible = ensureBorrowerVisibleCols().slice();
    state.borrowerColPickerDraftOrder = normalizeBorrowerColumnOrder(ensureBorrowerColumnOrder().slice());
    state.showColumnPicker = true;
  }
  function cancelBorrowerColumnPicker(){
    state.showColumnPicker = false;
    state.borrowerColPickerDraftVisible = null;
    state.borrowerColPickerDraftOrder = null;
  }
  // Modal "🧩 Tuỳ chỉnh cột" — độc lập, không còn sổ xuống inline trong panel nữa. Dùng chung cho cả
  // 2 ngữ cảnh: (1) tự bấm nút "Tuỳ chỉnh cột" ở panel chính — có đủ 4 nút gốc; (2) bấm "Chỉnh sửa"
  // 1 Bộ xem cột từ modal "Chế độ xem cột" — đổi thành bộ nút Lưu/Xoá/Quay lại.
  function renderColumnPickerModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const canEdit = canEditModule('data');
    const colsByKey = {}; BORROWER_COLUMNS().forEach(c=> colsByKey[c.key]=c);
    const close = ()=>{ cancelBorrowerColumnPicker(); state.colViewSetEditingPreset = null; wrap.remove(); };
    function render(){
      const editingPreset = state.colViewSetEditingPreset;
      const pickerOrder = state.borrowerColPickerDraftOrder || ensureBorrowerColumnOrder();
      const pickerVisible = state.borrowerColPickerDraftVisible || ensureBorrowerVisibleCols();
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:600px;">
          <div class="modal-head"><h3>🧩 Tuỳ chỉnh cột</h3><button class="modal-close preview-allow" id="cpm-close">✕</button></div>
          <div class="modal-body">
            <b style="font-size:12.5px; color:var(--rice-dark);">🧩 Tích chọn các cột muốn hiển thị / in / xuất Excel (mặc định ẩn nhóm "nâng cao"):</b>
            ${editingPreset? `<p class="sub" style="color:#0d47a1; font-weight:700;">${waveTextHtmlSlow(`✏️ Đang chỉnh sửa Bộ xem cột "${editingPreset.name}"`)}</p>` : ''}
            <p class="sub" style="margin-top:10px;">💡 Để thay đổi vị trí cột: nhấn giữ vào biểu tượng ⠿ ở đầu mỗi dòng, kéo lên/xuống rồi thả vào đúng vị trí mong muốn.</p>
            ${!canEdit? `<p class="sub">Đồng chí không có quyền Sửa ở Sổ vay vốn — "Lưu tuỳ chỉnh" chỉ áp dụng cho lượt xem của riêng đồng chí, không lưu lại.</p>` : ''}
            <div id="col-picker-list" style="display:flex; flex-direction:column; gap:6px; margin-top:10px;">
              ${pickerOrder.map(key=>{
                const c = colsByKey[key]; if(!c || c.hidden) return '';
                const isFullPaired = BORROWER_COL_PAIRS.some(p=>p.includes(key));
                const isOrderOnlyPaired = !isFullPaired && BORROWER_COL_ORDER_ONLY_PAIRS.some(p=>p.includes(key));
                const isFixed = key==='name';
                const pairColor = (isFullPaired||isOrderOnlyPaired) ? borrowerColPairColor(key) : null;
                return `<label class="col-pick-row" draggable="${isFixed?'false':'true'}" data-col-key="${key}" style="display:flex; align-items:center; gap:8px; padding:7px 10px; border:1px solid var(--line); border-radius:8px; background:${isFixed?'var(--paper-2)':'var(--white)'}; cursor:${isFixed?'default':'move'}; font-size:12.5px;">
                  <span style="opacity:.5;">${isFixed?'📌':'⠿'}</span>
                  <input type="checkbox" class="preview-allow" data-col-toggle="${key}" ${pickerVisible.includes(key)?'checked':''} ${isFixed?'disabled':''}>
                  <span data-col-name-label="${key}">${escapeHtml(c.label)}${c.advanced?' <span class="sub">(nâng cao)</span>':''}${isFullPaired?` <span style="color:${pairColor}; font-weight:700;">🔗 luôn đi cùng cột liền kề (vị trí + ẩn/hiện)</span>`:''}${isOrderOnlyPaired?` <span style="color:${pairColor}; font-weight:700;">🔗 luôn đi cùng cột liền kề (chỉ vị trí, ẩn/hiện riêng)</span>`:''}${isFixed?' <span class="sub">(luôn đứng đầu)</span>':''}</span>
                </label>`;
              }).join('')}
            </div>
          </div>
          <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
            ${editingPreset? `
              <button class="btn btn-ghost btn-sm preview-allow" id="cpm-back" style="color:var(--red);">↩️ Quay lại (không chỉnh sửa)</button>
              <button class="btn btn-ghost btn-sm preview-allow" id="cpm-delete-preset" style="color:var(--red);">🗑️ Xoá bộ xem này</button>
              <button class="btn btn-sm preview-allow" id="cpm-save" style="background:rgba(77,208,225,.32); color:#0d47a1; font-weight:700;">💾 Lưu tuỳ chỉnh</button>
            ` : `
              <button class="btn btn-ghost btn-sm preview-allow" id="cpm-cancel">✕ Đóng bảng</button>
              <button class="btn btn-ghost btn-sm preview-allow" id="cpm-default">↺ Khôi phục cài đặt gốc</button>
              <button class="btn btn-sm preview-allow" id="cpm-view" style="background:rgba(77,208,225,.32); color:#00695c; font-weight:700;">👁️ Chỉ để xem (không lưu)</button>
              <button class="btn btn-sm preview-allow" id="cpm-save" style="background:rgba(77,208,225,.32); color:#0d47a1; font-weight:700;">💾 Lưu tuỳ chỉnh</button>
            `}
          </div>
        </div>`;
      wrap.querySelector('#cpm-close').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const cancelBtn = wrap.querySelector('#cpm-cancel'); if(cancelBtn) cancelBtn.onclick = close;
      const backBtn = wrap.querySelector('#cpm-back');
      if(backBtn) backBtn.onclick = ()=>{ state.colViewSetEditingPreset = null; cancelBorrowerColumnPicker(); wrap.remove(); renderColumnViewSetModal(); };
      const viewBtn = wrap.querySelector('#cpm-view');
      if(viewBtn) viewBtn.onclick = async ()=>{ state._appliedColumnViewSetId = null; await commitBorrowerColumnPicker('view'); close(); const el=document.getElementById('content'); if(el && state.activeTab==='data') renderDataTab(el); };
      const defaultBtn = wrap.querySelector('#cpm-default');
      if(defaultBtn) defaultBtn.onclick = async ()=>{
        state.borrowerColPickerDraftVisible = defaultVisibleBorrowerCols();
        state.borrowerColPickerDraftOrder = normalizeBorrowerColumnOrder(BORROWER_COLUMNS().map(c=>c.key));
        render();
      };
      const saveBtn = wrap.querySelector('#cpm-save');
      if(saveBtn) saveBtn.onclick = async ()=>{
        const draftVisible = (state.borrowerColPickerDraftVisible||ensureBorrowerVisibleCols()).slice();
        const draftOrder = (state.borrowerColPickerDraftOrder||ensureBorrowerColumnOrder()).slice();
        state.borrowerVisibleCols = draftVisible.slice();
        state.borrowerColumnOrder = draftOrder.slice();
        state._appliedColumnViewSetId = null;
        const el = document.getElementById('content'); if(el && state.activeTab==='data') renderDataTab(el);
        if(editingPreset){
          wrap.remove();
          state.colViewSetEditingPreset = null;
          state.borrowerColPickerDraftVisible = null; state.borrowerColPickerDraftOrder = null;
          await updateColumnViewSet(editingPreset.id, editingPreset.name, editingPreset.group, draftVisible, draftOrder);
          showBigToast(`Đã lưu thành công Bộ xem cột "${editingPreset.name}"!`);
        } else {
          renderSaveColumnViewSetDialog(draftVisible, draftOrder, ()=>{
            state.borrowerColPickerDraftVisible = null; state.borrowerColPickerDraftOrder = null;
            wrap.remove();
          });
        }
      };
      const deletePresetBtn = wrap.querySelector('#cpm-delete-preset');
      if(deletePresetBtn) deletePresetBtn.onclick = async ()=>{
        const preset = state.colViewSetEditingPreset;
        if(!preset) return;
        if(!confirm(`Đồng chí có CHẮC CHẮN muốn xoá vĩnh viễn Bộ xem cột "${preset.name}" không? Không thể khôi phục.`)) return;
        try{ await deleteColumnViewSetEntry(preset); }
        catch(err){ console.error('Lỗi khi xoá Bộ xem cột:', err); alert(`Có lỗi khi xoá Bộ xem cột "${preset.name}": ${err && err.message ? err.message : err}`); return; }
        state.colViewSetEditingPreset = null;
        cancelBorrowerColumnPicker();
        wrap.remove();
        showBigToast(`Đã xoá thành công Bộ xem cột "${preset.name}"!`);
      };
      wrap.querySelectorAll('[data-col-toggle]').forEach(cb=>{
        cb.onchange = ()=>{
          const key = cb.dataset.colToggle;
          if(key==='name') { cb.checked = true; return; }
          state.borrowerColPickerDraftVisible = toggleBorrowerColumnVisibility(state.borrowerColPickerDraftVisible || ensureBorrowerVisibleCols(), key);
          render();
          setTimeout(()=>{
            const target = wrap.querySelector(`[data-col-key="${key}"]`);
            if(target) target.scrollIntoView({behavior:'auto', block:'center'});
            const nameLabel = wrap.querySelector(`[data-col-name-label="${key}"]`);
            if(nameLabel){ nameLabel.classList.remove('col-name-pulse'); void nameLabel.offsetWidth; nameLabel.classList.add('col-name-pulse'); }
          }, 0);
        };
      });
      wireDragReorderWithIndicator(
        Array.from(wrap.querySelectorAll('.col-pick-row')).filter(row=>row.dataset.colKey!=='name'),
        row=> row.dataset.colKey,
        (draggedKey, targetKey, before)=>{
          const order = state.borrowerColPickerDraftOrder || ensureBorrowerColumnOrder();
          state.borrowerColPickerDraftOrder = moveBorrowerColumnGroup(order, draggedKey, targetKey, !before);
          render();
          setTimeout(()=>{
            const nameLabel = wrap.querySelector(`[data-col-name-label="${draggedKey}"]`);
            if(nameLabel){ nameLabel.classList.remove('col-name-pulse'); void nameLabel.offsetWidth; nameLabel.classList.add('col-name-pulse'); }
          }, 70);
        },
        (keyA, keyB)=> BORROWER_COL_PAIRS.some(p=>p.includes(keyA)&&p.includes(keyB)) || BORROWER_COL_ORDER_ONLY_PAIRS.some(p=>p.includes(keyA)&&p.includes(keyB))
      );
    }
    if(!state.colViewSetEditingPreset) openBorrowerColumnPicker();
    else state.showColumnPicker = true;
    render();
  }
  // --- Lưu trữ CÁ NHÂN cho Bộ xem cột — dùng đúng hạ tầng "Bộ nhớ dữ liệu cá nhân" dùng chung (xem
  // phía trên: personalGet/personalSet/personalRemove/personalFetchAll) — xuyên suốt MỌI mã xã, gắn
  // theo tài khoản Google (hoặc localStorage nếu chưa đăng nhập), LUÔN gộp cả 2 nguồn khi hiển thị.
  async function fetchPersonalColViewSetsFirebase(){ return personalFetchAll('columnViewSets'); }
  async function savePersonalColViewSet(entry){ await personalSet('columnViewSets', entry.id, entry); }
  async function deletePersonalColViewSet(id){ await personalRemove('columnViewSets', id); }
  // Ghi log cho mọi hành động tạo/sửa/đổi tên/xoá Bộ xem cột — hiện trong Kho dòng nhật ký.
  async function pushColumnViewSetLog(action, name, detail){
    const device = await getClientDeviceInfo();
    const entry = { id:uid(), action, name, detail: detail||'', at:new Date().toISOString(),
      createdByName: state.identity.name, createdBy: state.identity.email, createdByIp: device.ip, createdByDevice: device.userAgent };
    await cPush('columnViewSetLog', entry);
  }
  async function pushColumnViewSet(name, group, visible, order){
    const entry = { id:uid(), name, group, visible, order, createdBy: state.identity.email, createdByName: state.identity.name, createdAt: new Date().toISOString() };
    if(group==='xaphuong') await cSetRecord('columnViewSets', entry.id, entry);
    else await savePersonalColViewSet(entry);
    await pushColumnViewSetLog('created', name, `Nhóm: ${group==='xaphuong'?'Xã phường':'Cá nhân'}`);
    return entry;
  }
  async function updateColumnViewSet(id, name, group, visible, order){
    const entry = { id, name, group, visible, order, createdBy: state.identity.email, createdByName: state.identity.name, createdAt: new Date().toISOString() };
    if(group==='xaphuong') await cSetRecord('columnViewSets', id, entry);
    else await savePersonalColViewSet(entry);
    await pushColumnViewSetLog('edited', name, 'Đã chỉnh sửa nội dung cột bên trong');
    return entry;
  }
  async function renameColumnViewSetEntry(vs, newName){
    const entry = {...vs, name:newName};
    if(vs.group==='xaphuong') await cSetRecord('columnViewSets', vs.id, entry);
    else await savePersonalColViewSet(entry);
    await pushColumnViewSetLog('renamed', newName, `Đổi tên từ "${vs.name}" thành "${newName}"`);
  }
  async function deleteColumnViewSetEntry(vs){
    if(vs.group==='xaphuong') await cRemoveRecord('columnViewSets', vs.id);
    else await deletePersonalColViewSet(vs.id);
    await pushColumnViewSetLog('deleted', vs.name);
  }
  // Toàn bộ các Bộ xem cột MẪU có sẵn trong app (hằng số, không lưu Firebase) — dùng để tra cứu lại
  // theo id khi cần khôi phục "bộ xem cột áp dụng gần nhất" thuộc Nhóm mẫu.
  function allSampleColumnViewSets(){
    return [getDefaultColumnViewSet(), getBasicLoanInfoColumnViewSet(), getBasicInterestColumnViewSet(), getInterestPaidUnpaidColumnViewSet(), getDetailedInterestColumnViewSet(), getBorrowerInfoColumnViewSet(), getAllPublicColumnsViewSet(), getHiddenColumnsViewSet()];
  }
  // Lưu lại "bộ xem cột áp dụng GẦN NHẤT" (bất kể thuộc Nhóm mẫu/Nhóm cá nhân/Nhóm xã phường) — ưu
  // tiên lưu vào kho cá nhân đám mây (nếu đã đăng nhập Google), ngược lại lưu vào bộ nhớ trình duyệt.
  async function saveLastAppliedColumnView(setId, group, visible, order){
    const record = { setId, group, visible, order, appliedAt: new Date().toISOString() };
    if(isPersonalStorageLinkedToGoogle()){
      try{ await uref('lastColumnView').child('current').set(record); return; }catch(e){ console.error('Lưu bộ xem cột gần nhất lên đám mây thất bại, tự lưu tạm vào trình duyệt:', e); }
    }
    try{ localStorage.setItem('personalData_lastColumnViewLocal', JSON.stringify(record)); }catch(e){}
  }
  // Đọc lại "bộ xem cột áp dụng gần nhất" — ưu tiên đám mây cá nhân trước, KHÔNG có mới đọc bộ nhớ
  // trình duyệt, KHÔNG có nốt thì trả về null (lúc đó hệ thống dùng mặc định của Nhóm mẫu như cũ).
  async function fetchLastAppliedColumnView(){
    if(isPersonalStorageLinkedToGoogle()){
      try{ const snap = await uref('lastColumnView').child('current').once('value'); if(snap.exists()) return snap.val(); }catch(e){}
    }
    try{ const raw = localStorage.getItem('personalData_lastColumnViewLocal'); if(raw) return JSON.parse(raw); }catch(e){}
    return null;
  }
  // Áp dụng lại đúng "bộ xem cột gần nhất" ngay khi vừa mở app (chỉ chạy đúng 1 lần cho mỗi phiên) —
  // với Nhóm mẫu thì tra cứu lại theo id (vì đây là hằng số, không lưu ở đâu cả); với Nhóm cá nhân/xã
  // phường thì dùng THẲNG visible/order đã lưu kèm theo (phòng khi bộ xem cột gốc đã bị xoá/đổi tên).
  async function applyLastColumnViewOnLoad(){
    if(window.__lastColumnViewApplyAttempted) return;
    window.__lastColumnViewApplyAttempted = true;
    try{
      const rec = await fetchLastAppliedColumnView();
      if(!rec || !rec.setId) return;
      if(rec.group==='mau'){
        const found = allSampleColumnViewSets().find(vs=>vs.id===rec.setId);
        if(found){ state.borrowerVisibleCols = found.visible.slice(); state.borrowerColumnOrder = found.order.slice(); state._appliedColumnViewSetId = found.id; }
      } else if(rec.visible && rec.order){
        state.borrowerVisibleCols = rec.visible.slice(); state.borrowerColumnOrder = rec.order.slice(); state._appliedColumnViewSetId = rec.setId;
      }
      const el = document.getElementById('content');
      if(el && state.activeTab==='data') renderDataTab(el);
    }catch(e){ console.error('Khôi phục bộ xem cột gần nhất thất bại:', e); }
  }
  function getDefaultColumnViewSet(){
    return { id:'__default__', name:'Bộ xem cột Mặc định', group:'mau',
      visible: defaultVisibleBorrowerCols(), order: normalizeBorrowerColumnOrder(BORROWER_COLUMNS().map(c=>c.key)) };
  }
  // Bộ xem cột mẫu — hiện HẾT tất cả các cột công khai (không ẩn cột nào, trừ các cột nội bộ đã đánh
  // dấu hidden:true — những cột đó không bao giờ công khai với người dùng).
  function getAllPublicColumnsViewSet(){
    const allPublicKeys = BORROWER_COLUMNS().filter(c=>!c.hidden).map(c=>c.key);
    return { id:'__allpublic__', name:'Bộ xem cột Tất cả các cột công khai', group:'mau',
      visible: allPublicKeys, order: normalizeBorrowerColumnOrder(BORROWER_COLUMNS().map(c=>c.key)) };
  }
  // Hàm dùng CHUNG để dựng 1 Bộ xem cột MẪU theo đúng danh sách cột + thứ tự đã chỉ định — các cột
  // KHÔNG được liệt kê sẽ tự động xếp vào cuối theo đúng thứ tự mặc định của hệ thống (không mất cột).
  function buildPresetColumnViewSet(id, name, orderedKeys){
    const allKeys = BORROWER_COLUMNS().map(c=>c.key);
    const fullOrder = orderedKeys.concat(allKeys.filter(k=>!orderedKeys.includes(k)));
    return { id, name, group:'mau', visible: orderedKeys.slice(), order: normalizeBorrowerColumnOrder(fullOrder) };
  }
  function getBasicLoanInfoColumnViewSet(){
    return buildPresetColumnViewSet('__basicloan__', 'Bộ xem cột Thông tin cơ bản khoản vay', [
      'name','hamlet','principal','loanDate','dueDate','fundSource','rate',
      'splitCentralPct','splitProvincePct','splitWardPct','hamletAllocPct',
      'extensionHistory','overdueRateApplied','latestExtensionDueDate','daysRemaining','managerName',
    ]);
  }
  function getBasicInterestColumnViewSet(){
    return buildPresetColumnViewSet('__basicinterest__', 'Bộ xem cột Tính tiền lãi Cơ bản', [
      'name','hamlet','principal','rate','interestFromDate','interestToDate','interestDaysCount','quarterInterestAmount',
      'splitCentralPct','splitCentralAmt','splitProvincePct','splitProvinceAmt','splitWardPct','splitWardAmt',
      'hamletAllocPct','hamletAllocAmt',
    ]);
  }
  function getInterestPaidUnpaidColumnViewSet(){
    return buildPresetColumnViewSet('__interestpaidunpaid__', 'Bộ xem cột Xem tiền lãi đã đóng, chưa đóng', [
      'name','hamlet','quartersUnpaid','quartersPaid','unpaidInterestPastToNow','leftoverUnassigned',
    ]);
  }
  function getDetailedInterestColumnViewSet(){
    return buildPresetColumnViewSet('__detailinterest__', 'Bộ xem cột Tính tiền lãi Chi tiết', [
      'name','hamlet','principal','rate','interestFromDate','interestToDate','interestDaysCount','quarterInterestAmount',
      'quartersUnpaid','quartersPaid','unpaidInterestPastToNow','leftoverUnassigned',
      'splitCentralPct','splitCentralAmt','splitProvincePct','splitProvinceAmt','splitWardPct','splitWardAmt',
      'hamletAllocPct','hamletAllocAmt',
    ]);
  }
  function getBorrowerInfoColumnViewSet(){
    return buildPresetColumnViewSet('__borrowerinfo__', 'Bộ xem cột Thông tin của Người vay', [
      'name','hamlet','principal','loanDate','dueDate','daysRemaining',
      'birthYear','cccd','phone','managerName','address','preMergerAddress','industry','repayAbility','guarantor','note',
    ]);
  }
  // "Bộ xem cột ẩn (Không công khai)" — CHỈ gồm Họ và tên/Đơn vị + TOÀN BỘ các cột đã đánh dấu
  // hidden:true (không công khai với người dùng thường trong Tuỳ chỉnh cột). Khi đang áp dụng bộ này,
  // nút "Tuỳ chỉnh cột" sẽ bị khoá lại (xem wiring #col-picker-btn).
  function getHiddenColumnsViewSet(){
    const allHidden = BORROWER_COLUMNS().filter(c=>c.hidden && c.key!=='name' && c.key!=='hamlet');
    const independent = allHidden.filter(c=> c.key==='project' || c.key==='allQuartersDue').map(c=>c.key); // luôn đưa xuống CUỐI CÙNG
    const rest = allHidden.filter(c=> c.key!=='project' && c.key!=='allQuartersDue').map(c=>c.key); // hệ thống Trong hạn + Gia hạn lần 1-5
    return buildPresetColumnViewSet('__hiddencols__', 'Bộ xem cột ẩn (Không công khai)', ['name','hamlet', ...rest, ...independent]);
  }
  // Bảng nhỏ đặt tên + chọn Nhóm khi bấm "Lưu tuỳ chỉnh" — lưu thành 1 Bộ xem cột tái sử dụng được.
  function renderSaveColumnViewSetDialog(visible, order, onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:440px;">
        <div class="modal-head"><h3>💾 Lưu Bộ xem cột</h3><button class="modal-close preview-allow" id="svs-close">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Đặt tên cho Bộ xem cột này (không cần ghi chữ "Bộ xem cột")</label><input id="svs-name" maxlength="30" class="preview-allow" placeholder="VD: Theo dõi phân bổ lãi suất..."></div>
          <p class="sub">Đồng chí muốn lưu bộ tuỳ chỉnh cột này vào Nhóm nào?</p>
        </div>
        <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
          <button class="btn btn-ghost preview-allow" id="svs-back">Quay lại</button>
          <button class="btn preview-allow" id="svs-personal" style="background:#c8e6c9; color:#1b5e20; font-weight:700;">Nhóm cá nhân</button>
          <button class="btn preview-allow" id="svs-ward" style="background:#bbdefb; color:#0d47a1; font-weight:700;">Nhóm xã phường</button>
        </div>
      </div>`;
    wrap.querySelector('#svs-close').onclick = close;
    wrap.querySelector('#svs-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    async function doSave(group){
      const name = (wrap.querySelector('#svs-name').value||'').trim();
      if(!name){ alert('Vui lòng đặt tên cho Bộ xem cột này trước khi lưu.'); return; }
      const groupLabel = group==='canhan'?'Nhóm cá nhân':'Nhóm xã phường';
      const existingCount = group==='canhan' ? (await fetchPersonalColViewSetsFirebase()).length : (state.columnViewSets||[]).filter(x=>x.group==='xaphuong').length;
      if(existingCount>=20){
        alert(`${groupLabel} đã đạt tối đa 20 Bộ xem cột rồi, không thể lưu thêm. Vui lòng xoá bớt Bộ xem cột cũ, hoặc lưu vào nhóm khác, hoặc sửa lại 1 Bộ xem cột đang có sẵn.`);
        return;
      }
      close();
      try{
        await pushColumnViewSet(name, group, visible, order);
        showBigToast(`Đã lưu thành công Bộ xem cột "${name}" vào ${groupLabel}!`);
        if(onSaved) onSaved();
      }catch(err){
        console.error('Lỗi khi lưu Bộ xem cột:', err);
        alert(`Có lỗi khi lưu Bộ xem cột "${name}": ${err && err.message ? err.message : err}`);
      }
    }
    wrap.querySelector('#svs-personal').onclick = ()=> doSave('canhan');
    wrap.querySelector('#svs-ward').onclick = ()=> doSave('xaphuong');
  }
  // Bảng nhỏ đổi tên 1 Bộ xem cột — có xác nhận trước khi lưu.
  function renderRenameColumnViewSetDialog(vs, onDone){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:420px;">
        <div class="modal-head"><h3>✏️ Đổi tên Bộ xem cột</h3><button class="modal-close preview-allow" id="rvs-close">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Tên mới (tối đa 30 ký tự)</label><input id="rvs-name" maxlength="30" class="preview-allow" value="${escapeHtml(vs.name)}"></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="rvs-back">Quay lại</button>
          <button class="btn btn-primary preview-allow" id="rvs-save">Lưu</button>
        </div>
      </div>`;
    wrap.querySelector('#rvs-close').onclick = close;
    wrap.querySelector('#rvs-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#rvs-save').onclick = async ()=>{
      const newName = (wrap.querySelector('#rvs-name').value||'').trim();
      if(!newName){ alert('Vui lòng nhập tên mới trước khi lưu.'); return; }
      if(!confirm(`Đồng chí có CHẮC CHẮN muốn đổi tên Bộ xem cột "${vs.name}" thành "${newName}" không?`)) return;
      close();
      await renameColumnViewSetEntry(vs, newName);
      showBigToast(`Đã đổi tên thành công thành "${newName}"!`);
      if(onDone) onDone();
    };
  }
  // "👁️ Chế độ xem cột" — modal 3 nhóm (Mẫu/Cá nhân/Xã phường), y hệt phong cách Kho lưu trữ.
  // =====================================================================
  // "TUỲ CHỈNH MÀU NỀN CHO KHOẢN VAY VÀ PHƯƠNG ÁN VAY" — 7 mục màu áp dụng cho từng DÒNG khoản vay;
  // khung tiêu đề Phương án vay vẫn suy ra theo màu nào chiếm đa số bên trong (giữ nguyên + gradient).
  // =====================================================================
  const LOAN_COLOR_KEYS = [
    ['notdue','Khoản vay trong thời gian chưa gần đến hạn'],
    ['d120','Khoản vay sắp đến hạn chỉ còn 120 ngày đến chỉ còn 91 ngày'],
    ['d90','Khoản vay sắp đến hạn chỉ còn 90 ngày đến chỉ còn 61 ngày'],
    ['d60','Khoản vay sắp đến hạn chỉ còn 60 ngày đến chỉ còn 31 ngày'],
    ['d30','Khoản vay sắp đến hạn chỉ còn 30 ngày đến chỉ còn 1 ngày'],
    ['overdue','Khoản vay đã đến hạn nhưng chưa được xã/phường xử lý'],
    ['extended','Khoản vay trong thời gian được gia hạn lần N'],
    ['riskdebt','Khoản vay trong diện Nợ rủi ro đang xử lý'],
  ];
  const DEFAULT_LOAN_COLORS = {
    notdue:'rgba(255,255,255,0)',
    d120:'rgba(255,235,59,.30)', d90:'rgba(255,235,59,.30)', d60:'rgba(255,152,0,.20)', d30:'rgba(216,27,96,.16)',
    overdue:'rgba(239,83,80,.24)', extended:'rgba(239,83,80,.24)', riskdebt:'rgba(255,193,7,.28)',
    baddebt:'rgba(211,47,47,.30)', // Nợ xấu / không có khả năng trả nợ — tách riêng khỏi Nợ rủi ro đang xử lý, TẠM THỜI chưa đưa vào modal Tuỳ chỉnh màu (chờ thiết kế sau), nhưng đã tách dữ liệu sẵn.
  };
  // Ưu tiên: bộ màu CÁ NHÂN (tài khoản Google nếu có lưu, không thì thiết bị) > bộ màu XÃ PHƯỜNG >
  // mặc định hệ thống.
  async function fetchPersonalLoanColors(){
    if(isPersonalStorageLinkedToGoogle()){
      try{ const snap = await uref('loanColors').once('value'); const v = snap.val(); if(v) return v; }catch(e){ console.error('Lỗi tải bộ màu cá nhân (tài khoản):', e); }
    }
    try{ const v = JSON.parse(localStorage.getItem('personalLoanColors')||'null'); if(v) return v; }catch(e){}
    return null;
  }
  async function savePersonalLoanColors(colors){
    if(isPersonalStorageLinkedToGoogle()){
      try{ await uref('loanColors').set(colors); }catch(e){ console.error('Ghi bộ màu cá nhân (tài khoản) thất bại, lưu tạm vào thiết bị:', e); try{ localStorage.setItem('personalLoanColors', JSON.stringify(colors)); }catch(e2){} }
    } else {
      try{ localStorage.setItem('personalLoanColors', JSON.stringify(colors)); }catch(e){}
    }
  }
  async function fetchWardLoanColors(){
    try{ const snap = await wref('loanColorsWard').once('value'); return snap.val() || null; }catch(e){ return null; }
  }
  async function saveWardLoanColors(colors){ await cSet('loanColorsWard', colors); }
  // Ghi nhớ LỰA CHỌN của người dùng — đang áp dụng bộ màu "cá nhân" hay "xã phường" — để lần sau vào
  // lại vẫn đúng ý đã chọn, KHÔNG tự động luôn ưu tiên bộ cá nhân như trước.
  async function fetchPersonalLoanColorSource(){
    if(isPersonalStorageLinkedToGoogle()){
      try{ const snap = await uref('loanColorSource').once('value'); const v = snap.val(); if(v) return v; }catch(e){}
    }
    try{ return localStorage.getItem('personalLoanColorSource') || null; }catch(e){ return null; }
  }
  async function savePersonalLoanColorSource(source){
    if(isPersonalStorageLinkedToGoogle()){
      try{ await uref('loanColorSource').set(source); }catch(e){ try{ localStorage.setItem('personalLoanColorSource', source); }catch(e2){} }
    } else {
      try{ localStorage.setItem('personalLoanColorSource', source); }catch(e){}
    }
  }
  // Ghi log khi ai đó tạo mới hoặc sửa Bộ màu (cá nhân/xã phường) — hiện trong Kho dòng nhật ký.
  async function pushLoanColorLog(group, action){
    const device = await getClientDeviceInfo();
    const entry = { id:uid(), group, action, at:new Date().toISOString(),
      createdByName: state.identity.name, createdBy: state.identity.email, createdByIp: device.ip, createdByDevice: device.userAgent };
    await cPush('loanColorLog', entry);
  }
  // Nạp và giải quyết bộ màu ĐANG ÁP DỤNG (gọi 1 lần khi vào module Sổ vay vốn, cache lại trong
  // state.activeLoanColors — mọi hàm tô màu dòng khoản vay đều đọc từ đây, có fallback mặc định).
  async function loadActiveLoanColors(){
    const personal = await fetchPersonalLoanColors();
    const ward = await fetchWardLoanColors();
    const source = await fetchPersonalLoanColorSource(); // 'personal' | 'ward' | null (chưa từng chọn)
    let chosen;
    if(source==='ward' && ward) chosen = ward;
    else if(source==='personal' && personal) chosen = personal;
    else if(personal) chosen = personal; // CHƯA từng lưu lựa chọn rõ ràng (dữ liệu cũ trước khi có cơ chế này) — giữ hành vi cũ để không đổi đột ngột
    else if(ward) chosen = ward;
    state.activeLoanColors = Object.assign({}, DEFAULT_LOAN_COLORS, chosen||{});
  }
  function activeLoanColor(key){ return (state.activeLoanColors && state.activeLoanColors[key]) || DEFAULT_LOAN_COLORS[key]; }
  function rgbaToHex(rgba){
    const m = String(rgba).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if(!m) return '#ffffff';
    return '#'+[1,2,3].map(i=>parseInt(m[i],10).toString(16).padStart(2,'0')).join('');
  }
  function hexToRgba(hex, alpha){
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function rgbaAlpha(rgba){
    const m = String(rgba).match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
    return m ? parseFloat(m[1]) : 0.3;
  }
  // "🎨 Tuỳ chỉnh màu nền cho khoản vay và phương án vay" — 2 nhóm (Cá nhân/Xã phường), y hệt phong
  // cách Chế độ xem cột.
  async function renderLoanColorModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    if(!state.colorTabModal) state.colorTabModal = 'canhan';
    const personalSaved = await fetchPersonalLoanColors();
    const wardSaved = await fetchWardLoanColors();
    let draftPersonal = Object.assign({}, DEFAULT_LOAN_COLORS, personalSaved||{});
    let draftWard = Object.assign({}, DEFAULT_LOAN_COLORS, wardSaved||{});
    const TAB_COLORS3 = { canhan:'#2e7d32', xaphuong:'#1565c0' };
    const TAB_LABELS3 = { canhan:'Bộ màu cá nhân', xaphuong:'Bộ màu xã phường' };
    let lastToastTab = null;
    function currentDraft(){ return state.colorTabModal==='canhan' ? draftPersonal : draftWard; }
    function tabBtnsHtml(){
      return Object.keys(TAB_LABELS3).map(key=>{
        const active = state.colorTabModal===key;
        const color = TAB_COLORS3[key];
        return `<button type="button" class="archive-tab-btn preview-allow ${active?'active':''}" data-color-tab="${key}" style="${active?`background:${color}; border-color:${color}; color:#fff;`:''}">${TAB_LABELS3[key]}</button>`;
      }).join('');
    }
    function render(){
      const tab = state.colorTabModal;
      if(tab!==lastToastTab){ lastToastTab = tab; showTabSwitchToast(TAB_LABELS3[tab]||''); }
      const draft = currentDraft();
      const color = TAB_COLORS3[tab];
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1300px; border:6px solid ${color};">
          <div class="modal-head modal-head-stack-narrow" style="background:linear-gradient(135deg, #8e24aa 0%, #6a1b9a 40%, #1565c0 100%); display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <h3 style="color:#fff;">${waveTextHtmlSlow('🎨 Tuỳ chỉnh màu nền cho khoản vay và phương án vay')}</h3>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="display:flex; border:2px solid #fbc02d; padding:2px;">${tabBtnsHtml()}</div>
              <button class="modal-close preview-allow" id="lc-close">✕</button>
            </div>
          </div>
          <div class="modal-body" style="max-height:70vh; overflow:auto;">
            <div style="background:${color}; color:#fff; font-weight:800; padding:8px 14px; border-radius:8px; margin-bottom:12px;">${TAB_LABELS3[tab].toUpperCase()}</div>
            <div style="text-align:center; margin-bottom:14px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" id="lc-restore-default">↺ Khôi phục bộ màu mặc định</button></div>
            <div id="lc-swatches">
              ${LOAN_COLOR_KEYS.map(([key,label])=>`
                <div class="kv-row" style="align-items:center;">
                  <span style="display:flex; align-items:center; gap:10px;">
                    <input type="color" class="preview-allow lc-swatch" data-key="${key}" value="${rgbaToHex(draft[key])}" style="width:44px; height:32px; border:1px solid var(--line); border-radius:6px; cursor:pointer;">
                    <span>${escapeHtml(label)}</span>
                  </span>
                </div>`).join('')}
            </div>
            <p class="sub" style="margin-top:10px; line-height:1.7;">Đây là màu áp dụng cho các dòng chứa thông tin của khoản vay. Riêng màu nền của khung tiêu đề Phương án vay sẽ KHÔNG chọn trực tiếp được — nó luôn tự động lấy theo đúng màu đang chiếm SỐ ĐÔNG trong số các khoản vay đang nằm bên trong phương án đó.</p>
            ${tab==='canhan'? `<p style="color:#b71c1c; line-height:1.7; margin-top:8px;">"Bộ màu cá nhân" chỉ áp dụng cho lượt xem CỦA RIÊNG BẠN — không ảnh hưởng tới người khác. Nếu đồng chí đã đăng nhập bằng tài khoản Google, bộ màu này được lưu theo tài khoản của đồng chí (dùng lại được ở bất kỳ thiết bị hay mã xã nào). Nếu chưa đăng nhập, bộ màu chỉ được lưu tạm trên chính trình duyệt đang dùng.</p>`
              : `<p style="color:#b71c1c; line-height:1.7; margin-top:8px;">"Bộ màu xã phường" áp dụng cho TẤT CẢ mọi người đang xem mã xã này. Chỉ người có quyền Sửa ở Sổ vay vốn mới lưu và áp dụng được bộ màu này cho cả xã.</p>`}
          </div>
          <div class="modal-foot" style="flex-wrap:wrap; gap:8px; justify-content:space-between;">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-ghost preview-allow" id="lc-close2">Đóng bảng (không lưu)</button>
              <button class="btn btn-sm preview-allow" id="lc-view-only" style="background:rgba(77,208,225,.32); color:#00695c; font-weight:700;">👁️ Chỉ xem (không lưu)</button>
              <button class="btn btn-primary preview-allow" id="lc-save-apply">💾 Lưu và áp dụng</button>
            </div>
            <div class="modal-foot-tabs" style="display:flex; border:2px solid #fbc02d; padding:2px;">${tabBtnsHtml()}</div>
          </div>
        </div>`;
      wrap.querySelector('#lc-close').onclick = close;
      wrap.querySelector('#lc-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('[data-color-tab]').forEach(btn=> btn.onclick = ()=>{ state.colorTabModal = btn.dataset.colorTab; render(); });
      wrap.querySelectorAll('.lc-swatch').forEach(inp=> inp.oninput = ()=>{
        const key = inp.dataset.key;
        draft[key] = hexToRgba(inp.value, rgbaAlpha(draft[key]));
      });
      const restoreBtn = wrap.querySelector('#lc-restore-default');
      if(restoreBtn) restoreBtn.onclick = ()=>{
        Object.assign(draft, DEFAULT_LOAN_COLORS);
        render();
        setTimeout(()=>{
          const swatches = wrap.querySelectorAll('.lc-swatch');
          swatches.forEach(el=> el.classList.add('lc-pulse'));
          setTimeout(()=> swatches.forEach(el=> el.classList.remove('lc-pulse')), 950);
        }, 30);
      };
      const viewOnlyBtn = wrap.querySelector('#lc-view-only');
      if(viewOnlyBtn) viewOnlyBtn.onclick = ()=>{
        state.activeLoanColors = Object.assign({}, DEFAULT_LOAN_COLORS, draft);
        close();
        const el = document.getElementById('content');
        if(el) renderDataTab(el);
        showToast('Đã áp dụng tạm thời cho lượt xem này, chưa lưu lại.');
      };
      const saveApplyBtn = wrap.querySelector('#lc-save-apply');
      if(saveApplyBtn) saveApplyBtn.onclick = async ()=>{
        if(tab==='xaphuong' && !canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn nên không thể lưu Bộ màu xã phường.'); return; }
        if(!confirm(`Đồng chí có CHẮC CHẮN muốn lưu và áp dụng ${TAB_LABELS3[tab]} này không?`)) return;
        close();
        const hadSavedBefore = tab==='canhan' ? !!personalSaved : !!wardSaved;
        if(tab==='canhan') await savePersonalLoanColors(draft);
        else await saveWardLoanColors(draft);
        await savePersonalLoanColorSource(tab==='canhan' ? 'personal' : 'ward');
        await pushLoanColorLog(tab, hadSavedBefore? 'edited' : 'created');
        await loadActiveLoanColors();
        const el = document.getElementById('content');
        if(el) renderDataTab(el);
        showBigToast(`Đã áp dụng thành công ${TAB_LABELS3[tab]}!`);
      };
    }
    render();
  }

  // "✨ Thêm nhanh bằng AI" — khung sườn modal (nội dung bên trong để trống, thiết kế sau).
  // Cột xem trước dữ liệu AI trích xuất — dùng đúng nhãn như panel Danh sách khoản vay, nhưng chỉ
  // gồm các trường THÔ trực tiếp trích xuất được (không tính toán/suy ra, vì đây là dữ liệu NHÁP
  // chưa lưu vào hệ thống).
  const QUICKADD_PREVIEW_COLS = [
    ['name','Họ và tên'], ['hamletDisplay','Đơn vị'], ['projectName','Phương án vay'],
    ['principal','Số tiền gốc (đ)'], ['loanDate','Ngày vay'], ['dueDate','Ngày đến hạn'],
    ['fundSource','Nguồn vay'], ['rate','Lãi suất (%/năm)'], ['birthYear','Năm sinh'], ['managerId','Người quản lý'],
    ['cccd','CCCD'], ['phone','Số điện thoại'], ['address','Địa chỉ cụ thể'], ['hamletOld','Đơn vị trước sáp nhập'],
    ['industry','Ngành nghề SXKD'], ['repayAbility','Khả năng trả nợ'], ['guarantor','Người bảo lãnh'], ['note','Ghi chú thêm'],
  ];
  const QUICKADD_REQUIRED_BORROWER = [['name','Họ và tên'], ['projectName','Phương án vay'], ['hamletDisplay','Địa bàn dân cư (Ấp/Khu phố)']];
  const QUICKADD_REQUIRED_PROJECT = [['name','Tên phương án vay'], ['disburseDate','Ngày giải ngân (ngày vay)'], ['dueDate','Ngày đến hạn trả'], ['interestRate','Lãi suất chung']];
  // TOÀN BỘ các trường BẮT BUỘC dùng CHUNG của 1 Phương án vay — đúng theo yêu cầu: mọi người vay
  // trong CÙNG phương án đều phải giống hệt nhau ở các trường này. Hiện thành 1 DÒNG RIÊNG (không lặp
  // lại ở từng dòng người vay nữa) ngay phía trên bảng danh sách người vay của phương án đó.
  // LƯU Ý: phải là HÀM, không được là hằng ở tầng ngoài cùng. Nhãn bên trong gọi tới
  // danh xưng động (đọc state.config), mà hằng tầng ngoài chạy NGAY lúc nạp tệp — lúc đó
  // `state` chưa khởi tạo, sẽ ném ReferenceError và làm trắng cả trang.
  function quickAddProjectFields(){ return [
    ['name','Tên phương án'], ['totalCapital','Tổng số tiền nguồn vốn (đ)'], ['disburseDate','Ngày giải ngân (ngày vay)'], ['dueDate','Ngày đến hạn trả'],
    ['fundSourceType','Nguồn vay'], ['interestRate','Lãi suất (%/năm)'], ['splitCentral','Phân bổ Cấp TW (%)'], ['splitProvince',`Phân bổ Cấp ${provinceLevelLabel()} (%)`],
    ['splitWard',`Phân bổ Cấp ${adminLevelLabel()} (%)`], ['hamletAllocPercent',`% ${adminLevelLabel()} chia ${subAdminLabel()}`],
  ]; }
  // Các cột (trong QUICKADD_PREVIEW_COLS) mà giá trị của nó ĐÃ được thể hiện ở dòng Phương án vay riêng
  // rồi (projectName/loanDate/dueDate/fundSource/rate) — KHÔNG hiện lặp lại ở từng dòng người vay nữa.
  const QUICKADD_PROJECT_LEVEL_BORROWER_KEYS = new Set(['projectName','loanDate','dueDate','fundSource','rate']);

  function quickAddSystemPrompt(){
    const hamlets = (state.config.hamlets||[]).join(', ') || '(chưa có)';
    // Đọc đúng danh sách địa chỉ trước sáp nhập THẬT từ state.config.hamletsLegacyHidden (nơi form
    // "Thêm người vay mới" thật cũng đọc từ đó) — tự bỏ hậu tố " (cũ)" khi liệt kê cho AI xem (hệ thống
    // tự thêm lại hậu tố này khi lưu, AI không cần tự thêm).
    const hamletsOld = (state.config.hamletsLegacyHidden||[]).map(h=> h.endsWith(' (cũ)')? h.slice(0,-5) : h).join(', ') || '(chưa có)';
    // QUAN TRỌNG: cung cấp ĐẦY ĐỦ chi tiết từng phương án vay đã có (không chỉ mỗi TÊN như trước đây)
    // — để AI có dữ liệu THẬT mà đối chiếu, biết chính xác giá trị gốc của từng trường bắt buộc, từ đó
    // mới có thể LUÔN tôn trọng đúng thông tin đã có sẵn trong hệ thống (không bịa, không để người
    // dùng "ép" đổi thông tin phương án vay đã tồn tại).
    const existingProjectsDetail = eligibleProjectsForBorrowerAssignment().map(p=>
      `- "${p.name}": Tổng vốn=${p.totalCapital||0}đ, Ngày giải ngân=${p.disburseDate||''}, Ngày đến hạn=${p.dueDate||''}, Nguồn vay=${p.fundSourceType||''}, Lãi suất=${p.interestRate||0}%/năm, Phân bổ TW=${p.splitCentral||0}%, Phân bổ ${provinceLevelLabel()}=${p.splitProvince||0}%, Phân bổ ${adminLevelLabel()}=${p.splitWard||0}%, %${adminLevelLabel()} chia ${subAdminLabel()}=${p.hamletAllocPercent||0}%`
    ).join('\n') || '(chưa có phương án vay nào trong hệ thống)';
    const colLettersInfo = QUICKADD_PREVIEW_COLS.map(([,label],i)=> `${String.fromCharCode(65+i)}=${label}`).join(', ');
    const subAdminUnit = subAdminLabel(); // "Ấp"/"Khu phố"/"Thôn"/...
    const adminUnit = adminLevelLabel(); // "Xã"/"Phường"/"Thị trấn"
    const provinceUnit = provinceLevelLabel(); // "Tỉnh"/"Thành phố" — địa danh động của đúng mã xã này
    return `Bạn là trợ lý AI giúp NHẬP NHANH dữ liệu vào "Sổ vay vốn" của Hội Nông dân xã/phường. LUÔN gọi người dùng là "đồng chí", tuyệt đối không gọi là "bạn" hay "anh/chị". Đọc tin nhắn văn bản + tài liệu đính kèm (ảnh CCCD, đơn xin vay, sổ ghi chép tay, ảnh scan...) người dùng cung cấp qua nhiều lượt trò chuyện, trích xuất đúng thông tin để THÊM MỚI Người vay (và Phương án vay nếu cần) vào Sổ vay vốn.
CÁCH LÀM VIỆC CỐT LÕI — "1 HỒ SƠ DUY NHẤT": người dùng luôn có sẵn 1 "Hồ sơ đang soạn" duy nhất (ban đầu RỖNG, chưa có gì cả) — đây là hồ sơ DUY NHẤT bạn và người dùng cùng làm việc trên đó, KHÔNG có hồ sơ/file nào khác. Ở CUỐI mỗi tin nhắn của người dùng, bạn LUÔN được cung cấp đúng nội dung Hồ sơ đang soạn HIỆN TẠI (xem phần cuối cuộc trò chuyện) — bạn PHẢI đọc kỹ hồ sơ đó TRƯỚC khi trả lời hoặc bắt đầu làm việc, rồi CHỈNH SỬA TRỰC TIẾP lên đúng hồ sơ đó (thêm/sửa/xoá Phương án vay hoặc Người vay tuỳ theo yêu cầu của người dùng lượt này) — LUÔN trả về ĐẦY ĐỦ toàn bộ hồ sơ đã cập nhật (không chỉ phần vừa thay đổi) trong khối \`\`\`quickadd-result\`\`\` mỗi khi có điều gì thay đổi.

QUY TẮC BẮT BUỘC — PHẢI TUÂN THỦ TUYỆT ĐỐI:
1) CHỈ ĐƯỢC PHÉP THÊM MỚI — không được đề xuất sửa bất kỳ Phương án vay hay Người vay NÀO đã có sẵn trong hệ thống.
1b) KHÁI NIỆM CỐT LÕI — "THÔNG TIN DÙNG CHUNG CỦA PHƯƠNG ÁN VAY": mỗi Phương án vay (dù đã có sẵn trong hệ thống hay sắp được tạo mới) đều có 1 bộ các trường BẮT BUỘC dùng CHUNG cho TẤT CẢ người vay thuộc phương án đó — không thể có người vay nào trong CÙNG 1 phương án lại có giá trị KHÁC NHAU ở các trường này. Các trường đó gồm: Tên phương án, Tổng số tiền nguồn vốn, Ngày giải ngân (ngày vay), Ngày đến hạn trả, Nguồn vay, Lãi suất (%/năm), Phân bổ Cấp Trung ương (%), Phân bổ Cấp Tỉnh (%), Phân bổ Cấp Xã (%), % Xã chia cho cấp ${subAdminUnit}.
   DANH SÁCH ĐẦY ĐỦ các Phương án vay ĐÃ CÓ SẴN trong hệ thống mà bạn ĐƯỢC PHÉP xếp người vay MỚI vào (danh sách này đã được lọc đúng: CHỈ gồm phương án đang hoạt động + phương án bị ẩn (từng có người vay nhưng hiện không còn ai đang hoạt động) — KHÔNG bao gồm phương án đã tất toán/trả nợ trước hạn xong hoàn toàn hoặc đã bị xoá, vì những phương án đó không còn phù hợp để thêm người vay mới vào nữa), kèm giá trị THẬT của từng trường bắt buộc (đây là DỮ LIỆU GỐC, KHÔNG THỂ THAY ĐỔI qua công cụ này):
${existingProjectsDetail}
   QUY TẮC XỬ LÝ KHI NGƯỜI DÙNG THÊM NGƯỜI VAY VÀO 1 PHƯƠNG ÁN ĐÃ CÓ SẴN: LUÔN LUÔN dùng ĐÚNG giá trị đã liệt kê ở trên cho các trường bắt buộc — TUYỆT ĐỐI KHÔNG được lấy theo lời người dùng nếu nó KHÁC với giá trị gốc đã có, DÙ người dùng có nói/khẳng định/yêu cầu thay đổi thế nào đi nữa. Nếu phát hiện người dùng cung cấp thông tin MÂU THUẪN với dữ liệu gốc của phương án đã có (VD: người dùng nói lãi suất là 7%/năm nhưng phương án đó trong hệ thống đang là 8.4%/năm), PHẢI:
     a. Giải thích RÕ RÀNG, LỊCH SỰ cho người dùng biết: nêu rõ giá trị hệ thống đang có VÀ giá trị người dùng vừa cung cấp, giải thích rằng thông tin phương án vay đã tồn tại không thể sửa qua đây.
     b. TỰ ĐỘNG dùng ĐÚNG giá trị gốc của hệ thống cho trường đó (loại bỏ thông tin vô lý người dùng vừa cung cấp), không hỏi lại thêm, không chờ xác nhận — vì đây là quy tắc CỨNG không có ngoại lệ.
   QUY TẮC KHI TẠO PHƯƠNG ÁN VAY MỚI: các trường bắt buộc nêu trên PHẢI GIỐNG HỆT NHAU cho MỌI người vay bạn xếp vào phương án mới đó trong CÙNG 1 lượt trích xuất — nếu người dùng vô tình cung cấp giá trị khác nhau cho từng người (VD: người này nói lãi suất 8%, người kia lại nói 8.5%, dù cả 2 cùng 1 phương án mới), PHẢI dừng lại HỎI RÕ người dùng đâu mới là giá trị ĐÚNG cho cả phương án (không tự đoán, không tự chọn 1 trong 2 mà không hỏi), rồi mới thống nhất áp dụng chung.
2) VỀ ĐỊA CHỈ — có 3 loại trường tách biệt, PHẢI phân biệt và điền đúng:
   - "hamletDisplay" — CHỈ chứa tên ${subAdminUnit} HIỆN NAY (không kèm địa chỉ chi tiết, không kèm chữ "${subAdminUnit}"/"${adminUnit}" phía trước vì đó là mặc định của cả xã này rồi, không cần lặp lại). Danh sách ${subAdminUnit} hiện nay đã có sẵn trong hệ thống: ${hamlets}.
   - "hamletOld" — tên ${subAdminUnit} TRƯỚC SÁP NHẬP (địa chỉ cũ). Danh sách đã có sẵn: ${hamletsOld}. Hệ thống sẽ TỰ ĐỘNG thêm chữ "(cũ)" vào cuối khi hiển thị, BẠN KHÔNG CẦN tự thêm chữ "(cũ)" vào giá trị bạn điền.
   - "address" — địa chỉ CHI TIẾT hơn ${subAdminUnit} (số nhà, tên đường, tên xóm nhỏ...), KHÔNG lặp lại tên ${subAdminUnit} đã điền ở trên.
   CÁCH XỬ LÝ:
   a. Nếu người dùng cho 1 địa chỉ ĐẦY ĐỦ dạng "[chi tiết], [tên ${subAdminUnit}]" (VD: "57, ấp Bù Tam" hoặc "Số 12 Bù Tam"), PHẢI tự động TÁCH ra: phần chi tiết (VD: "57") điền vào "address", phần tên ${subAdminUnit} (VD: "Bù Tam" — bỏ chữ "ấp"/"thôn"/"khu phố" phía trước vì đã là mặc định) điền vào "hamletDisplay" hoặc "hamletOld" tuỳ trường hợp.
   b. Nếu người dùng CHỈ cho tên ${subAdminUnit} và tên đó KHÔNG khớp với cả 2 danh sách trên, BẮT BUỘC hỏi lại: "Đây là ${subAdminUnit} hiện nay (chưa có trong hệ thống) hay là ${subAdminUnit} trước sáp nhập vậy đồng chí?" trước khi xếp vào đúng trường.
   c. Nếu người dùng xác nhận đây là ${subAdminUnit} MỚI (chưa từng có), chủ động thêm vào "newHamlets" (nếu là hiện nay) hoặc "newHamletsOld" (nếu là trước sáp nhập, không kèm chữ "(cũ)") để hệ thống lưu lại cho lần sau.
   d. TUYỆT ĐỐI không được để trống "address" nếu người dùng đã cung cấp địa chỉ chi tiết — cũng không được nhét cả cụm địa chỉ dài vào "hamletDisplay" (chỉ chứa đúng tên ${subAdminUnit} ngắn gọn).
3) Nếu người vay chưa rõ thuộc Phương án vay nào, hãy gợi ý 1 phương án PHÙ HỢP trong danh sách đã liệt kê ở mục 1b (nếu hợp lý dựa theo nguồn vay/thời gian), hoặc hỏi người dùng có muốn tạo Phương án vay MỚI hay không (nếu muốn tạo mới, thu thập đủ: tên phương án, ngày giải ngân, ngày đến hạn, lãi suất chung, tỷ lệ phân bổ Trung ương/Tỉnh/Xã sao cho tổng bằng đúng lãi suất chung).
3b) QUY TẮC VỀ LÃI SUẤT VÀ TỶ LỆ PHÂN BỔ khi tạo Phương án vay MỚI (CHỈ áp dụng cho phương án MỚI — với phương án ĐÃ CÓ SẴN trong hệ thống thì LUÔN dùng đúng số liệu gốc đã liệt kê ở mục 1b, KHÔNG áp dụng các quy tắc dưới đây):
   - "fundSourceType" (Nguồn vay): nếu người dùng KHÔNG nói rõ nguồn vay là gì, mặc định chọn "Cấp tỉnh/thành phố" (không tự hỏi lại, không để trống).
   - RÀNG BUỘC TOÁN HỌC BẮT BUỘC — TUYỆT ĐỐI KHÔNG ĐƯỢC VI PHẠM, DÙ NGƯỜI DÙNG CÓ YÊU CẦU THẾ NÀO:
     a. Phân bổ Trung ương (splitCentral) + Phân bổ ${provinceUnit} (splitProvince) + Phân bổ ${adminUnit} (splitWard) LUÔN LUÔN PHẢI BẰNG ĐÚNG lãi suất chung (interestRate). VD: lãi suất 8.4% thì TW 3.5% + ${provinceUnit} 2% + ${adminUnit} 2.9% = 8.4% (đúng); TW 3% + ${provinceUnit} 2% + ${adminUnit} 2.9% = 7.9% (SAI, không khớp 8.4%).
     b. % ${adminUnit} chia ${subAdminUnit} (hamletAllocPercent) KHÔNG ĐƯỢC vượt quá 100.
     Nếu người dùng cung cấp số liệu VI PHẠM 1 trong 2 ràng buộc trên (VD: tự đưa ra 3 tỷ lệ phân bổ mà cộng lại không khớp lãi suất chung, hoặc yêu cầu % ${subAdminUnit} là 150%), bạn PHẢI:
       - TỪ CHỐI điền đúng như yêu cầu sai đó — KHÔNG được điền số liệu vô lý vào kết quả.
       - Giải thích RÕ RÀNG, LỊCH SỰ cho người dùng biết vì sao số liệu đó vô lý (nêu rõ phép tính, chỉ ra chỗ sai).
       - Hỏi lại người dùng số liệu ĐÚNG là gì, HOẶC nếu người dùng không có ý kiến gì thêm, để TRỐNG các trường liên quan (không tự bịa số cho khớp).
   - QUY TẮC ĐIỀN/ĐỂ TRỐNG (áp dụng cho nhóm 5 trường: lãi suất chung, Phân bổ TW, Phân bổ ${provinceUnit}, Phân bổ ${adminUnit}, % ${adminUnit} chia ${subAdminUnit}):
     a. Nếu người dùng CHỈ cung cấp MỘT VÀI (không phải tất cả) trong 5 trường này, bạn CHỈ điền đúng đúng những gì người dùng đã cung cấp — các trường CÒN LẠI (người dùng KHÔNG nhắc tới) PHẢI ĐỂ TRỐNG (không tự động điền mặc định, không tự bịa số cho "khớp" phép tính ở trên — trừ khi người dùng đã cung cấp ĐỦ dữ liệu để tự suy ra được 1 trường còn thiếu duy nhất, VD: đã biết lãi suất chung + Phân bổ TW + Phân bổ ${provinceUnit} thì CÓ THỂ tự tính ra Phân bổ ${adminUnit} còn thiếu bằng phép trừ, hãy làm vậy thay vì để trống một cách máy móc).
     b. Điều kiện để áp dụng bộ mặc định đầy đủ: người dùng KHÔNG cung cấp BẤT KỲ trường nào trong 4 TRƯỜNG CỐT LÕI (lãi suất chung, Phân bổ TW, Phân bổ ${provinceUnit}, Phân bổ ${adminUnit}) — hoàn toàn không nhắc tới lãi suất/phân bổ 3 cấp. Điều kiện này CHỈ phụ thuộc vào 4 trường cốt lõi này, KHÔNG phụ thuộc vào việc "% ${adminUnit} chia ${subAdminUnit}" có được người dùng nhắc tới hay không (dù người dùng CÓ nói tới "% ${adminUnit} chia ${subAdminUnit}" cụ thể hay KHÔNG nói gì tới nó, chỉ cần 4 trường cốt lõi kia đều trống thì vẫn áp dụng mặc định đầy đủ cho CẢ 5 trường theo đúng bộ số bên dưới — nếu người dùng CÓ tự nói rõ "% ${adminUnit} chia ${subAdminUnit}" là bao nhiêu thì vẫn ưu tiên dùng đúng số đó thay vì mặc định 45).
        Khi đủ điều kiện, áp dụng bộ mặc định đầy đủ theo đúng "fundSourceType" đã xác định:
        * Nguồn vay là "Cấp trung ương": lãi suất (interestRate) = 8.4, Phân bổ Trung ương (splitCentral) = 3.5, Phân bổ ${provinceUnit} (splitProvince) = 2, Phân bổ ${adminUnit} (splitWard) = 2.9, % ${adminUnit} chia ${subAdminUnit} (hamletAllocPercent) = 45.
        * Nguồn vay KHÁC "Cấp trung ương": lãi suất (interestRate) = 6.6, Phân bổ Trung ương (splitCentral) = 0, Phân bổ ${provinceUnit} (splitProvince) = 4.32, Phân bổ ${adminUnit} (splitWard) = 2.28, % ${adminUnit} chia ${subAdminUnit} (hamletAllocPercent) = 45.
        Đây CHÍNH LÀ bộ mặc định giống hệt khi người dùng tự bấm "Tạo phương án vay mới" ngoài giao diện — người dùng vẫn có thể tự sửa lại các số này sau khi xem kết quả.
3c) RÀNG BUỘC BẮT BUỘC VỀ NGÀY THÁNG khi tạo Phương án vay MỚI (CHỈ áp dụng cho phương án MỚI — phương án ĐÃ CÓ SẴN thì luôn tôn trọng ngày tháng gốc đã liệt kê ở mục 1b, KHÔNG áp dụng ràng buộc này):
   a. "Ngày giải ngân" (disburseDate) KHÔNG ĐƯỢC là ngày trong TƯƠNG LAI so với ngày hiện tại thật (hôm nay).
   b. "Ngày đến hạn" (dueDate) trừ đi "Ngày giải ngân" (disburseDate) PHẢI LỚN HƠN 15 ngày — TUYỆT ĐỐI KHÔNG ĐƯỢC bằng 15 ngày, nhỏ hơn 15 ngày, bằng 0, hay là số âm (Ngày đến hạn không được đứng trước hoặc trùng Ngày giải ngân).
   Nếu người dùng cung cấp/yêu cầu ngày tháng VI PHẠM 1 trong 2 ràng buộc trên (dù người dùng có cố tình yêu cầu thế nào), bạn PHẢI:
     - TỪ CHỐI điền đúng như yêu cầu sai đó — KHÔNG được điền ngày tháng vô lý vào kết quả.
     - Giải thích RÕ RÀNG, LỊCH SỰ cho người dùng biết vì sao ngày đó vô lý.
     - Hỏi lại người dùng ngày ĐÚNG là gì, HOẶC nếu người dùng không có ý kiến gì thêm, để TRỐNG các trường ngày tháng liên quan (không tự bịa ngày cho "khớp" ràng buộc).
   Khi trả về file kết quả (khối \`\`\`quickadd-result\`\`\`), file đó TUYỆT ĐỐI KHÔNG được vi phạm 2 ràng buộc trên ở bất kỳ Phương án vay MỚI nào.
3d) RÀNG BUỘC BẮT BUỘC VỀ TỔNG TIỀN VAY (áp dụng cho CẢ phương án đã có sẵn LẪN phương án mới): TỔNG số tiền vay ("principal") của TẤT CẢ người vay thuộc CÙNG 1 Phương án vay TUYỆT ĐỐI KHÔNG ĐƯỢC VƯỢT QUÁ "Tổng số tiền nguồn vốn" (totalCapital) của phương án đó — chỉ được BẰNG hoặc NHỎ HƠN, không có ngoại lệ, dù người dùng có cố tình yêu cầu thế nào.
   a. VỚI PHƯƠNG ÁN VAY ĐÃ CÓ SẴN: bạn đã biết đúng "Tổng số tiền nguồn vốn" thật của phương án đó (xem mục 1b) — trước khi xếp thêm người vay mới vào phương án này, PHẢI tự cộng nhẩm: (tổng tiền đã vay của những người vay MỚI bạn định thêm vào phương án này trong lượt này) so với (Tổng vốn của phương án). Nếu VƯỢT QUÁ, bạn PHẢI:
      - KHÔNG được cố xếp hết vào phương án cũ đó — thay vào đó, giải thích rõ cho người dùng biết là phương án "X" hiện không còn đủ vốn để nhận thêm những người này (nêu rõ số vốn còn lại, nếu có).
      - Đề xuất PHƯƠNG ÁN THAY THẾ: tạo 1 Phương án vay MỚI, có tên GẦN GIỐNG nhưng KHÁC BIỆT rõ ràng với tên cũ (VD: đổi số thứ tự cuối tên, hoặc thêm hậu tố như "đợt 2"/"2026"...), rồi xếp những người vay này vào phương án MỚI đó thay vì phương án cũ — để tổng tiền vay không còn vô lý nữa. Luôn hỏi lại/xác nhận với người dùng về tên phương án mới này nếu chưa rõ ràng.
   b. VỚI PHƯƠNG ÁN VAY MỚI (sẽ được tạo trong lượt này): nếu người dùng có cho biết "Tổng số tiền nguồn vốn" cụ thể, kiểm tra tổng tiền vay của các người vay bạn xếp vào có vượt quá số đó không — nếu vượt, giải thích rõ và hỏi lại người dùng (tăng vốn lên hay bớt bớt người/giảm số tiền vay của ai đó).
      - NẾU người dùng KHÔNG hề cung cấp "Tổng số tiền nguồn vốn" cho phương án MỚI này (chỉ nói tới số tiền vay của TỪNG người), bạn PHẢI tự động SUY LUẬN "Tổng số tiền nguồn vốn" (totalCapital) = TỔNG CỘNG số tiền vay của TẤT CẢ người vay đang được xếp vào phương án MỚI đó — điền số này vào "totalCapital", để ràng buộc trên luôn đúng ngay từ đầu (bằng nhau vừa khít, không dư không thiếu).
4) Các trường BẮT BUỘC không được để trống đối với NGƯỜI VAY: Họ và tên, Phương án vay, Địa bàn dân cư (${subAdminUnit}).
   Các trường BẮT BUỘC không được để trống đối với PHƯƠNG ÁN VAY MỚI (nếu cần tạo thêm): Tên phương án vay, Ngày giải ngân, Ngày đến hạn, Lãi suất chung.
   Nếu còn thiếu trường bắt buộc nào, PHẢI chủ động hỏi lại người dùng, đừng tự bịa.
5) VỀ LÃI SUẤT VÀ CÁC CỘT NỘI BỘ (KHÔNG công khai với người dùng cuối) — hệ thống Sổ vay vốn có 2 "hệ thống dữ liệu" tách biệt cho lãi suất, PHẢI hiểu đúng để định tuyến chính xác:
   a. "TRONG HẠN" — là mức lãi suất/phân bổ ÁP DỤNG NGAY TỪ ĐẦU, khi khoản vay CÒN NGUYÊN VẸN (chưa từng gia hạn). Đây CHÍNH LÀ trường công khai "rate" (người vay) / "interestRate" (phương án) mà bạn đang điền — KHÔNG cần và KHÔNG có trường JSON nào khác riêng cho "trong hạn" cả, vì nó dùng CHUNG 1 giá trị với trường công khai.
   b. "GIA HẠN LẦN N" (N=1..5) — là các mức lãi suất/phân bổ RIÊNG BIỆT, chỉ phát sinh khi khoản vay đã QUÁ HẠN và được phê duyệt gia hạn thêm 1 khoảng thời gian mới, có "ngày bắt đầu", "ngày kết thúc", "lãi suất áp dụng", "tỷ lệ phân bổ Trung ương/Tỉnh/Xã/Ấp" RIÊNG cho từng lần — HOÀN TOÀN TÁCH BIỆT với lãi suất trong hạn ban đầu.
   QUY TẮC ĐỊNH TUYẾN: khi người dùng chỉ nói "lãi suất chung"/"lãi suất" mà KHÔNG nhắc gì tới việc quá hạn/gia hạn, LUÔN LUÔN hiểu đó là lãi suất TRONG HẠN (điền vào "rate" của người vay hoặc "interestRate" của phương án) — TUYỆT ĐỐI KHÔNG được tự ý coi đó là lãi suất của 1 lần "gia hạn" nào. CHỈ khi người dùng nói RÕ RÀNG đây là thông tin của 1 lần gia hạn cụ thể (VD: "gia hạn lần 2", "sau khi gia hạn thì lãi suất là...", "hạn mới đến ngày...") thì mới điền vào mảng "extensions" của người vay đó (xem cấu trúc JSON bên dưới) — và PHẢI xác định đúng đây là lần gia hạn thứ MẤY (dựa vào thứ tự người dùng kể, hoặc hỏi lại nếu không rõ).
   Nếu người vay có lịch sử gia hạn (VD: đang số hoá lại 1 hồ sơ giấy cũ đã từng gia hạn trước đó), mỗi lần gia hạn cần đủ: ngày bắt đầu, ngày kết thúc (hạn mới), lãi suất áp dụng lần đó — nếu thiếu thông tin nào, hỏi lại người dùng, đừng tự bịa.
6) ĐỒNG NHẤT DỮ LIỆU CẤP PHƯƠNG ÁN: khi bạn đã biết các thông tin thuộc về CẤP PHƯƠNG ÁN VAY (xem đầy đủ danh sách trường ở mục 1b) — các thông tin này PHẢI được áp dụng GIỐNG HỆT NHAU cho TẤT CẢ người vay thuộc cùng 1 Phương án vay đó trong "borrowers", tuyệt đối KHÔNG được để người vay này có mà người vay khác trong CÙNG phương án lại thiếu, và KHÔNG được để giá trị khác nhau giữa các người vay trong CÙNG 1 phương án.
7) KHÔNG BỎ SÓT DỮ LIỆU: trước khi trả lời, rà soát lại TOÀN BỘ nội dung người dùng đã cung cấp (kể cả các lượt nhắn tin trước đó và trong tài liệu đính kèm) — nếu 1 thông tin ĐÃ được cung cấp rõ ràng, BẮT BUỘC phải điền vào đúng trường tương ứng trong kết quả, TUYỆT ĐỐI không được để trống trường đó chỉ vì sơ suất. Chỉ để trống khi thông tin đó THỰC SỰ chưa từng được cung cấp.
8) THÔNG TIN KHÔNG XẾP ĐƯỢC VÀO CỘT NÀO: nếu người dùng cung cấp 1 thông tin hợp lý về người vay nhưng KHÔNG có trường nào trong cấu trúc kết quả phù hợp để chứa nó, hãy đưa thông tin đó vào trường "note" (ghi chú thêm) của người vay đó — không được bỏ qua, không được cố nhét vào 1 trường không liên quan.
9) Ngày tháng trong kết quả JSON luôn ở định dạng "YYYY-MM-DD". Số tiền là số nguyên (đơn vị: đồng), không có dấu chấm/phẩy phân cách.
9b) QUAN TRỌNG — PHÂN BIỆT RÕ SỐ 0 VÀ "CHƯA CÓ DỮ LIỆU": với MỌI trường kiểu số (principal, rate, interestRate, splitCentral, splitProvince, splitWard, hamletAllocPercent, totalCapital, birthYear, ratePct...), TUYỆT ĐỐI KHÔNG được tự ý điền số 0 khi người dùng CHƯA cung cấp thông tin đó — hãy để CHUỖI RỖNG "" (y hệt cách xử lý với trường chữ). CHỈ điền đúng số 0 khi người dùng THỰC SỰ nói rõ giá trị đó là 0 (VD: "không tính lãi", "0 đồng", "miễn phí"). Nhầm lẫn giữa "0" và "chưa biết" sẽ khiến số liệu sai lệch nghiêm trọng khi đưa vào Sổ vay vốn — TUYỆT ĐỐI KHÔNG được nhầm lẫn 2 khái niệm này.
10) HIỂU VỊ TRÍ Ô KIỂU BẢNG TÍNH: bảng "file" kết quả có các cột được đặt tên A,B,C... theo đúng thứ tự sau: ${colLettersInfo}; các dòng đánh số 1,2,3... theo từng người vay (dòng 1 = người vay đầu tiên). Khi người dùng nhắc tới 1 vị trí kiểu "ô K2", "cột K dòng 2", "hàng 3 cột D"... bạn PHẢI hiểu đúng và ánh xạ về đúng trường dữ liệu + đúng người vay tương ứng để sửa/bổ sung.
11) CÁCH TRẢ LỜI: Luôn trả lời bằng văn bản trò chuyện TỰ NHIÊN trước (không bọc trong JSON, viết như đang nói chuyện bình thường, có thể dùng **in đậm** khi cần nhấn mạnh). Nếu tại thời điểm này đã trích xuất được ít nhất 1 người vay hoặc 1 phương án vay mới, hãy thêm vào NGAY CUỐI CÙNG câu trả lời (sau phần trò chuyện) một khối mã như sau, ĐÚNG định dạng, không thêm chữ gì khác bên trong khối:
\`\`\`quickadd-result
{"projects":[{"name":"","fundSourceType":"","interestRate":"","splitCentral":"","splitProvince":"","splitWard":"","hamletAllocPercent":"","disburseDate":"","dueDate":"","totalCapital":""}],"borrowers":[{"name":"","hamletDisplay":"","hamletOld":"","projectName":"","principal":"","loanDate":"","dueDate":"","fundSource":"","rate":"","birthYear":"","managerId":"","cccd":"","phone":"","address":"","industry":"","repayAbility":"","guarantor":"","note":"","extensions":[{"level":1,"from":"","to":"","ratePct":""}]}],"newHamlets":[],"newHamletsOld":[]}
\`\`\`
Trường "fundSourceType" LUÔN điền TÊN NGUỒN VAY TRỰC TIẾP (không có trường phụ nào khác nữa) — CÁC NGUỒN VAY ĐÃ CÓ SẴN để chọn gồm: "Cấp trung ương", "Cấp tỉnh/thành phố", "Nguồn 841", "Nguồn địa phương"${(state.config.customFundSources||[]).length? ', '+state.config.customFundSources.map(s=>`"${s}"`).join(', ') : ''} — LUÔN ưu tiên dùng ĐÚNG một trong các tên có sẵn này nếu phù hợp (kể cả khi người dùng gõ không dấu/viết tắt/gần đúng); CHỈ điền 1 tên MỚI (chưa có trong danh sách trên) khi người dùng nói rõ ràng đây là 1 nguồn vay HOÀN TOÀN KHÁC, chưa từng có trong danh sách. Trường "managerId" là "chihoitruong" (mặc định) nếu người dùng không nói rõ ai là người quản lý hộ vay này — nếu người dùng CÓ nhắc tên người quản lý cụ thể mà bạn không chắc đúng mã định danh, hãy điền TÊN người đó vào thẳng trường này (hệ thống sẽ tự đối chiếu). "birthYear"/"industry"/"repayAbility"/"guarantor" chỉ điền khi người dùng CÓ cung cấp thông tin tương ứng (năm sinh / ngành nghề sản xuất kinh doanh / khả năng trả nợ / người bảo lãnh), không tự bịa.
Trường "extensions" là MẢNG RỖNG [] nếu người vay chưa từng gia hạn (đa số trường hợp) — CHỈ điền khi người dùng có nói rõ về lịch sử gia hạn của người vay đó. "level" = 1,2,3... theo đúng thứ tự lần gia hạn (level 1 = lần gia hạn đầu tiên).
Nếu chưa có đủ dữ liệu để trích xuất, KHÔNG thêm khối mã này, chỉ cần trò chuyện/hỏi lại bình thường.`;
  }

  function renderQuickAddByAiModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const closeImmediate = ()=>{ state._qaiAddMenuOpen = false; wrap.remove(); };
    // Đóng modal — nếu "Hồ sơ đang soạn" ĐANG RỖNG thì đóng thoải mái không cần hỏi. Nếu đã có dữ liệu
    // (do AI trích xuất hoặc người dùng tự thêm/sửa) mà CHƯA được lưu vào Sổ vay vốn, cảnh báo rõ ràng
    // trước khi đóng, tránh mất công sức đã bỏ ra mà không hay biết.
    const close = ()=>{
      if(resultIsEmpty()){ closeImmediate(); return; }
      const totalCount = (latestResult.projects||[]).length + (latestResult.borrowers||[]).length;
      if(confirm(`⚠️ Dữ liệu tại "Hồ sơ đang soạn" (${totalCount} mục) hiện CHƯA được lưu và thêm vào Sổ vay vốn.\n\nNếu đóng bảng bây giờ, toàn bộ dữ liệu tại hồ sơ này sẽ BIẾN MẤT VĨNH VIỄN, không thể khôi phục lại.\n\nBấm "Có" để tiếp tục đóng bảng (mất dữ liệu), hoặc bấm "Huỷ" để quay lại.`)){
        closeImmediate();
      }
    };
    const messages = []; // { role:'user'|'ai', text, attachments:[{name,mimeType,base64}], isFileCard, result, streaming }
    let pendingAttachments = [];
    let hasDigestedOnce = false;
    // "Hồ sơ đang soạn" — LUÔN tồn tại ngay từ khi mở modal (khởi tạo RỖNG, không phải null) — đây là
    // file DUY NHẤT mà cả người dùng lẫn AI cùng thao tác, không có file nào khác. AI luôn đọc + chỉnh
    // sửa TRỰC TIẾP lên đúng object này qua từng lượt trò chuyện (xem cách gửi kèm trong aiMessages).
    let latestResult = { projects:[], borrowers:[] };
    function resultIsEmpty(){ return !(latestResult.projects||[]).length && !(latestResult.borrowers||[]).length; }
    let busy = false;
    let editingIndex = null;

    function fmtAttachChip(a){ return `<span class="ai-attach-chip">📎 ${escapeHtml(a.name)}</span>`; }

    function bubbleHtml(m, idx){
      const isUser = m.role==='user';
      const align = isUser? 'flex-end' : 'flex-start';
      if(m.streaming){
        return `<div style="display:flex; justify-content:flex-start; margin-bottom:10px;">
          <div id="qai-streaming-bubble" style="max-width:75%; background:#e3f2fd; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${m.text? renderMarkdownLite(m.text) : waveTextHtml('Chàng đang suy nghĩ…')}</div>
        </div>`;
      }
      if(editingIndex===idx){
        return `<div style="margin-bottom:10px;">
          <textarea id="qai-edit-textarea" rows="3" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid var(--line);">${escapeHtml(m.text)}</textarea>
          <div style="text-align:right; margin-top:6px; display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn btn-ghost btn-sm preview-allow" id="qai-edit-cancel">Huỷ bỏ</button>
            <button class="btn btn-primary btn-sm preview-allow" id="qai-edit-resend">Gửi lại</button>
          </div>
        </div>`;
      }
      let inner;
      if(m.isFileCard){
        const totalCount = (m.result.borrowers||[]).length + (m.result.projects||[]).length;
        inner = `<button type="button" class="btn btn-sm preview-allow" data-file-card="${idx}" style="background:#fff9c4; border:1px solid #fbc02d; color:#5a4300; font-weight:700;">📄 Bản tổng hợp — ${totalCount} mục (bấm để xem chi tiết)</button>`;
      } else {
        inner = isUser? escapeHtml(m.text||'') : renderMarkdownLite(m.text||'');
      }
      if(m.attachments && m.attachments.length) inner += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${m.attachments.map(fmtAttachChip).join('')}</div>`;
      return `<div style="display:flex; flex-direction:column; align-items:${isUser?'flex-end':'flex-start'}; margin-bottom:10px;">
        <div style="max-width:75%; background:${isUser?'#dcedc8':'#e3f2fd'}; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${inner}</div>
        ${!m.isFileCard? `<div style="display:flex; gap:4px; margin-top:3px;">
          ${isUser? `<button class="btn-plain-icon preview-allow" data-bubble-edit="${idx}" title="Sửa" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">✏️</button>` : ''}
          <button class="btn-plain-icon preview-allow" data-bubble-copy="${idx}" title="Sao chép" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">📋</button>
          <button class="btn-plain-icon preview-allow" data-bubble-delete="${idx}" title="Xoá tin nhắn này" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">🗑️</button>
        </div>` : ''}
      </div>`;
    }

    function render(){
      const hasAnyUserContent = messages.some(m=>m.role==='user') || pendingAttachments.length>0;
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
          <div class="modal-head"><h3>✨ Thêm nhanh Người vay (Phương án vay) bằng chat với AI</h3><button class="modal-close preview-allow" id="qai-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column;" id="qai-thread">
            ${messages.length? messages.map(bubbleHtml).join('') : `<p class="sub" style="text-align:center; margin:auto;">Hãy nhắn tin hoặc đính kèm tài liệu (ảnh CCCD, đơn xin vay, sổ ghi chép cũ...) — AI sẽ đợi đến khi đồng chí bấm "🧠 Tiêu hoá tài liệu bằng AI" mới bắt đầu đọc.</p>`}
          </div>
          <div style="padding:8px 16px 0; background:var(--paper-2);">
            <div style="text-align:center; margin-bottom:8px;">
              <button type="button" class="btn btn-sm preview-allow" id="qai-view-file" style="background:#fff9c4; border:1px solid #fbc02d; color:#5a4300; font-weight:700;">📋 Hồ sơ đang soạn — ${(latestResult.borrowers||[]).length + (latestResult.projects||[]).length} mục (bấm để xem/sửa)</button>
            </div>
            <p class="sub" style="margin:0 0 8px;">${hasDigestedOnce? 'Hệ thống đã đọc được nội dung bên trên. Nếu muốn bổ sung/sửa gì thì nhắn tiếp, AI sẽ tự cập nhật lại Hồ sơ đang soạn.' : 'Chưa tiêu hoá tài liệu nào — nhắn/đính kèm xong thì bấm nút bên dưới.'}</p>
            ${pendingAttachments.length? `<div class="ai-attach-row" style="padding:0 0 8px;">${pendingAttachments.map((a,i)=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)} <button type="button" class="preview-allow" data-remove-att="${i}">✕</button></span>`).join('')}</div>` : ''}
            <input type="file" id="qai-file-input" multiple accept="*/*" style="display:none;">
            <div class="ai-inputbar">
              <div class="ai-add-btn" id="qai-add-btn" role="button" tabindex="0">➕<span class="ai-add-label"> THÊM THÀNH PHẦN</span>
                ${state._qaiAddMenuOpen? `<div class="ai-add-menu">
                  <div class="ai-add-opt" data-qai-add="image">🖼️ Tải ảnh lên</div>
                  <div class="ai-add-opt" data-qai-add="doc">📄 Tải tài liệu lên</div>
                  <div class="ai-add-opt${state._qaiMic2Listening?' ai-add-opt-disabled':''}" data-qai-add="mic">🎤 ${state._qaiMicListening? '✅ Đang nghe — bấm để dừng' : 'Vừa nói vừa ra chữ'}</div>
                  <div class="ai-add-opt${state._qaiMicListening?' ai-add-opt-disabled':''}" data-qai-add="mic2">🎙️ ${state._qaiMic2Listening? '✅ Đang nghe — bấm để dừng' : 'Nói xong mới ra chữ'}</div>
                </div>` : ''}
              </div>
              <textarea id="qai-input" rows="1" placeholder="Nhắn tin cho AI... (Enter để xuống dòng, Ctrl+Enter để gửi)"></textarea>
              <div class="ai-send-wrap">
                <button id="qai-send-btn">➤</button>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="qai-close2">Đóng bảng</button>
            <button type="button" class="btn btn-sm preview-allow" id="qai-digest" ${(busy || !hasAnyUserContent)?'disabled':''} style="background:linear-gradient(180deg, #ffffff 0%, #7c4dff 45%, #4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700; ${(busy||!hasAnyUserContent)?'opacity:.5;':''}">${busy?'⏳ AI đang xử lý...':'🧠 Tiêu hoá tài liệu bằng AI'}</button>
            <button class="btn btn-primary preview-allow" id="qai-add" ${resultIsEmpty()?'disabled':''} style="${resultIsEmpty()?'opacity:.45; cursor:not-allowed;':'display:inline-block; animation: bigMoneyPulse 1.4s ease-in-out infinite;'}">➕ Thêm vào Sổ vay vốn</button>
          </div>
        </div>`;
      wrap.querySelector('#qai-close').onclick = close;
      wrap.querySelector('#qai-close2').onclick = close;
      wrap.onclick = (e)=>{
        // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được)
        if(state._qaiAddMenuOpen && !e.target.closest('#qai-add-btn')) { state._qaiAddMenuOpen = false; render(); }
      };
      const threadEl = wrap.querySelector('#qai-thread');
      if(threadEl) threadEl.scrollTop = threadEl.scrollHeight;
      wrap.querySelectorAll('[data-file-card]').forEach(btn=> btn.onclick = ()=>{
        const m = messages[parseInt(btn.dataset.fileCard,10)];
        if(m && m.result) renderQuickAddFilePreviewModal(m.result);
      });
      const viewFileBtn = wrap.querySelector('#qai-view-file');
      if(viewFileBtn) viewFileBtn.onclick = ()=> renderQuickAddFilePreviewModal(latestResult, render);
      wrap.querySelectorAll('[data-remove-att]').forEach(btn=> btn.onclick = ()=>{
        pendingAttachments.splice(parseInt(btn.dataset.removeAtt,10),1); render();
      });
      wrap.querySelectorAll('[data-bubble-delete]').forEach(btn=> btn.onclick = ()=>{
        if(!confirm('Xoá tin nhắn này khỏi cuộc trò chuyện?')) return;
        messages.splice(parseInt(btn.dataset.bubbleDelete,10),1); render();
      });
      wrap.querySelectorAll('[data-bubble-copy]').forEach(btn=> btn.onclick = ()=>{
        const m = messages[parseInt(btn.dataset.bubbleCopy,10)];
        if(m) writeClipboardSilent(m.text||'');
        showToast('Đã sao chép!');
      });
      wrap.querySelectorAll('[data-bubble-edit]').forEach(btn=> btn.onclick = ()=>{
        editingIndex = parseInt(btn.dataset.bubbleEdit,10); render();
      });
      const editCancelBtn = wrap.querySelector('#qai-edit-cancel');
      if(editCancelBtn) editCancelBtn.onclick = ()=>{ editingIndex = null; render(); };
      const editResendBtn = wrap.querySelector('#qai-edit-resend');
      if(editResendBtn) editResendBtn.onclick = ()=>{
        const ta = wrap.querySelector('#qai-edit-textarea');
        const newText = (ta.value||'').trim();
        messages[editingIndex].text = newText;
        messages.length = editingIndex+1; // bỏ hết các tin nhắn SAU tin vừa sửa (như đang hỏi lại từ điểm này)
        editingIndex = null;
        if(hasDigestedOnce){ render(); runAiTurn(); } else render();
      };
      const addMenuBtn = wrap.querySelector('#qai-add-btn');
      if(addMenuBtn) addMenuBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        state._qaiAddMenuOpen = !state._qaiAddMenuOpen;
        // Ô nhập liệu <textarea id="qai-input"> KHÔNG hề gắn với biến trạng thái nào (chỉ là DOM thao
        // tác tay thuần tuý) — nên mỗi lần vẽ lại TOÀN BỘ khung, ô này sẽ bị dựng lại RỖNG, xoá sạch
        // chữ đang gõ dở. Lưu lại giá trị TRƯỚC khi vẽ lại, rồi khôi phục lại NGAY SAU đó.
        const inputEl = wrap.querySelector('#qai-input');
        const savedValue = inputEl ? inputEl.value : '';
        render();
        const inputElAfter = wrap.querySelector('#qai-input');
        if(inputElAfter && savedValue) inputElAfter.value = savedValue;
        if(inputElAfter) autoResizeTextarea(inputElAfter);
      });
      wrap.querySelectorAll('[data-qai-add]').forEach(elx=> elx.addEventListener('click', (e)=>{
        e.stopPropagation();
        state._qaiAddMenuOpen = false;
        if(elx.dataset.qaiAdd==='mic'){ wrap.querySelector('#qai-add-btn .ai-add-menu')?.remove(); toggleQaiMic(render); return; }
        if(elx.dataset.qaiAdd==='mic2'){ wrap.querySelector('#qai-add-btn .ai-add-menu')?.remove(); toggleQaiMic2(render); return; }
        wrap.querySelector('#qai-file-input').click();
      }));
      wrap.querySelector('#qai-file-input').onchange = async (e)=>{
        const files = Array.from(e.target.files||[]);
        for(const f of files){
          const base64 = await fileToBase64(f);
          pendingAttachments.push({ name:f.name, mimeType:f.type||'application/octet-stream', base64 });
        }
        render();
      };
      wrap.querySelector('#qai-send-btn').onclick = ()=>{ doSend(); scrollNearestModalToBottom(wrap); };
      wireAutoResizeTextarea('qai-input');
      // Không tự động focus — đồng bộ với các module AI khác (Chat AI/Ghi chú nhanh/Tuyên truyền): mặc
      // định KHÔNG có con trỏ văn bản, chỉ khi người dùng TỰ bấm vào khung chat mới có con trỏ để nhập.
      wrap.querySelector('#qai-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter' && e.ctrlKey){ e.preventDefault(); doSend(); } });
      // Bấm vào khung chat (có con trỏ văn bản) -> cũng cuộn xuống cuối luôn, y hệt hiệu ứng nút mũi tên xuống.
      wrap.querySelector('#qai-input').addEventListener('focus', ()=> scrollNearestModalToBottom(wrap));
      wrap.querySelector('#qai-digest').onclick = ()=> runAiTurn();
      const addBtn = wrap.querySelector('#qai-add');
      if(addBtn) addBtn.onclick = confirmAndAdd;
    }

    function doSend(){
      const inputEl = wrap.querySelector('#qai-input');
      const text = (inputEl.value||'').trim();
      if(!text && !pendingAttachments.length) return;
      messages.push({ role:'user', text, attachments: pendingAttachments });
      pendingAttachments = [];
      inputEl.value = '';
      if(hasDigestedOnce){ render(); runAiTurn(); }
      else render(); // TRƯỚC lần tiêu hoá đầu tiên: AI im lặng, chỉ ghi nhận tin nhắn
    }

    async function runAiTurn(){
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
      if(busy) return;
      busy = true;
      const streamMsg = { role:'ai', text:'', streaming:true };
      messages.push(streamMsg);
      render();
      try{
        const aiMessages = [{ role:'user', text: quickAddSystemPrompt() }, { role:'assistant', text:'Đã hiểu, tôi sẽ tuân thủ đúng định dạng trả lời yêu cầu.' }];
        messages.forEach(m=>{
          if(m===streamMsg) return;
          if(m.isFileCard) return; // thẻ file không phải là 1 lượt hội thoại thật, bỏ qua ở đây — sẽ chèn riêng bản MỚI NHẤT bên dưới
          let t = m.text||'';
          if(m.attachments && m.attachments.length) t += ` (kèm ${m.attachments.length} tài liệu đính kèm)`;
          aiMessages.push({ role: m.role==='user'?'user':'assistant', text: t || '(tệp đính kèm)' });
        });
        // Luôn chèn đúng "Hồ sơ đang soạn" hiện tại làm "sự thật hiện tại" — kể cả khi đang RỖNG (là hồ
        // sơ khởi đầu, chưa có gì cả) — bao gồm cả trường hợp người dùng đã tự sửa thủ công 1 hoặc
        // nhiều ô, để AI hiểu đúng và không ghi đè ngược lại những gì người dùng vừa chỉnh sửa. AI PHẢI
        // luôn đọc đúng hồ sơ NÀY trước khi trả lời, và chỉnh sửa TRỰC TIẾP lên đúng hồ sơ này — không
        // có hồ sơ/file nào khác.
        aiMessages.push({ role:'user', text: `[Đây là "Hồ sơ đang soạn" ĐANG CÓ hiện tại (${resultIsEmpty()? 'hiện đang RỖNG, chưa có thông tin gì cả — đây là hồ sơ khởi đầu' : (latestResult._manuallyEdited? 'người dùng đã TỰ SỬA THỦ CÔNG 1 số ô, hãy coi đây là sự thật mới nhất, đừng ghi đè lại theo suy đoán cũ của đồng chí' : 'do đồng chí trích xuất ở lượt trước')}), đây là hồ sơ DUY NHẤT — đồng chí PHẢI đọc kỹ hồ sơ này trước khi trả lời, và luôn chỉnh sửa TRỰC TIẾP lên đúng hồ sơ này (thêm/sửa/xoá tuỳ theo yêu cầu người dùng), không tạo ra 1 bản riêng biệt nào khác]:\n${JSON.stringify(latestResult)}` });
        aiMessages.push({ role:'assistant', text:'Đã ghi nhận Hồ sơ đang soạn hiện tại, tôi sẽ dựa vào đây để tiếp tục thêm/sửa/xoá theo đúng yêu cầu.' });
        const allAttachments = messages.filter(m=>m.role==='user').flatMap(m=>m.attachments||[]);
        const opts = allAttachments.length? { attachments: allAttachments } : {};
        const result = await callAIWithFallback(aiMessages, opts, (partial)=>{
          streamMsg.text = partial;
          const bubbleEl = document.getElementById('qai-streaming-bubble');
          if(bubbleEl){
            bubbleEl.innerHTML = partial? renderMarkdownLite(partial) : waveTextHtml('Chàng đang suy nghĩ…');
            const threadEl = wrap.querySelector('#qai-thread');
            if(threadEl) threadEl.scrollTop = threadEl.scrollHeight;
          }
        });
        const fullText = result.text || '';
        // Tách khối kết quả ```quickadd-result ... ``` (nếu có) ra khỏi phần trò chuyện hiển thị
        const m = fullText.match(/```quickadd-result\s*([\s\S]*?)```/);
        let replyText = fullText, resObj = null;
        if(m){
          replyText = (fullText.slice(0,m.index) + fullText.slice(m.index+m[0].length)).trim();
          try{ resObj = JSON.parse(m[1].trim()); }catch(e){ resObj = null; }
        }
        messages.pop(); // bỏ tin nhắn streaming tạm
        if((resObj && resObj.newHamlets && resObj.newHamlets.length) || (resObj && resObj.newHamletsOld && resObj.newHamletsOld.length)){
          if(resObj.newHamlets && resObj.newHamlets.length) state.config.hamlets = Array.from(new Set([...(state.config.hamlets||[]), ...resObj.newHamlets]));
          if(resObj.newHamletsOld && resObj.newHamletsOld.length){
            // QUAN TRỌNG: form "Thêm người vay mới" thật đọc danh sách địa chỉ trước sáp nhập từ
            // state.config.hamletsLegacyHidden (kèm hậu tố "(cũ)"), KHÔNG PHẢI state.config.hamletsOld
            // — trước đây bị ghi nhầm vào biến không ai đọc tới, khiến địa danh AI tạo ra không bao giờ
            // xuất hiện lại được ở nơi khác trong app.
            const withSuffix = resObj.newHamletsOld.map(h=> h.endsWith(' (cũ)')? h : `${h} (cũ)`);
            state.config.hamletsLegacyHidden = Array.from(new Set([...(state.config.hamletsLegacyHidden||[]), ...withSuffix]));
          }
          cSet('config', state.config);
        }
        if(replyText) messages.push({ role:'ai', text: replyText });
        // Cập nhật ĐÚNG "Hồ sơ đang soạn" duy nhất — chấp nhận CẢ kết quả RỖNG mà AI chủ động trả về
        // (VD người dùng yêu cầu xoá sạch toàn bộ), không chỉ khi có dữ liệu — vì theo đúng quy tắc đã
        // dạy AI, nó CHỈ đính kèm khối quickadd-result khi thật sự có điều gì đó cần phản ánh, nên hễ
        // resObj tồn tại là phải tin tưởng dùng luôn, không cần thêm nữa thẻ file riêng theo từng lượt.
        if(resObj) latestResult = resObj;
        hasDigestedOnce = true;
      }catch(err){
        messages.pop(); // bỏ tin nhắn streaming tạm nếu có lỗi
        console.error('Lỗi khi tiêu hoá tài liệu bằng AI:', err);
        messages.push({ role:'ai', text:`Xin lỗi, có lỗi xảy ra khi xử lý: ${err && err.message ? err.message : err}. Đồng chí thử lại nhé.` });
      }
      busy = false; render();
    }

    // Kiểm tra 1 giá trị NGÀY THÁNG có "vô lý" hay không (tháng >12/=0, năm không đúng 4 chữ số, có chữ
    // cái hoặc ký tự lạ như dấu chấm/phẩy) — áp dụng cho định dạng dd/mm/yyyy người dùng nhìn thấy.
    function isDateValueInvalid(ddmmyyyy){
      if(!ddmmyyyy) return false; // rỗng không tính là "vô lý" ở đây (việc thiếu bắt buộc được kiểm tra riêng)
      const m = String(ddmmyyyy).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,})$/);
      if(!m) return true; // không đúng cấu trúc dd/mm/yyyy (có chữ, dấu chấm/phẩy, thiếu phần...) -> vô lý
      const [,d,mo,y] = m;
      if(y.length!==4) return true; // năm phải đúng 4 chữ số (không phải 3 hoặc 5 chữ số)
      const dn=+d, mn=+mo;
      if(mn<1 || mn>12) return true;
      if(dn<1 || dn>31) return true;
      return false;
    }
    function isPhoneInvalid(phone){ return phone && /[a-zA-ZÀ-ỹ]/.test(String(phone)); }
    function isMoneyInvalid(val){ return val!=null && val!=='' && /[a-zA-ZÀ-ỹ]/.test(String(val)); }
    // Lớp KHOÁ kiểm tra dữ liệu vô lý — chạy NGAY SAU khi người dùng đã xác nhận "Có" muốn thêm, trước
    // khi thực sự ghi vào Sổ vay vốn. Phân loại: nếu TẤT CẢ trường vô lý đều KHÔNG bắt buộc -> cảnh báo
    // + cho phép tiếp tục (loại bỏ trường đó). Nếu có ÍT NHẤT 1 trường vô lý THUỘC trường bắt buộc ->
    // chặn hẳn, bắt sửa lại. Trả về false nếu bị chặn (không được tiếp tục).
    function runSanityCheckLock(){
      const requiredBorrowerKeys = new Set(QUICKADD_REQUIRED_BORROWER.map(([k])=>k));
      const requiredProjectKeys = new Set(QUICKADD_REQUIRED_PROJECT.map(([k])=>k));
      const invalidRequired = []; // các mô tả lỗi thuộc trường BẮT BUỘC -> chặn
      const invalidOptional = []; // các mô tả lỗi thuộc trường KHÔNG bắt buộc -> cảnh báo, cho qua (loại bỏ trường)
      const clearFns = []; // các hàm sẽ chạy để LOẠI BỎ trường vô lý (không bắt buộc) nếu người dùng chọn tiếp tục
      (latestResult.projects||[]).forEach((p,i)=>{
        [['disburseDate','Ngày giải ngân'],['dueDate','Ngày đến hạn']].forEach(([k,label])=>{
          if(isDateValueInvalid(fmtDate(p[k]))){
            const msg = `Phương án vay #${i+1} "${p.name||''}": trường "${label}" có giá trị vô lý ("${p[k]}")`;
            if(requiredProjectKeys.has(k)) invalidRequired.push(msg); else { invalidOptional.push(msg); clearFns.push(()=> p[k]=''); }
          }
        });
        if(isMoneyInvalid(p.totalCapital)){ invalidOptional.push(`Phương án vay #${i+1} "${p.name||''}": trường "Tổng vốn" có ký tự chữ vô lý ("${p.totalCapital}")`); clearFns.push(()=> p.totalCapital=0); }
        // Ràng buộc BẮT BUỘC: Phân bổ TW + Tỉnh + Xã phải bằng ĐÚNG lãi suất chung, và % Xã chia Ấp
        // không được vượt quá 100 — nếu vi phạm thì CHẶN HẲN (coi như trường bắt buộc bị vô lý), không
        // cho lưu, bắt quay lại sửa (chỉ kiểm tra khi phương án này CÓ đủ số liệu để so sánh — không ép
        // buộc phải kiểm tra khi các trường đang cố ý để trống theo đúng quy tắc "chỉ điền phần đã biết").
        const hasAllSplitData = p.interestRate!=null && p.interestRate!=='' && p.splitCentral!=null && p.splitCentral!=='' && p.splitProvince!=null && p.splitProvince!=='' && p.splitWard!=null && p.splitWard!=='';
        if(hasAllSplitData){
          const sum = (parseFloat(String(p.splitCentral).replace(',','.'))||0) + (parseFloat(String(p.splitProvince).replace(',','.'))||0) + (parseFloat(String(p.splitWard).replace(',','.'))||0);
          const rate = parseFloat(String(p.interestRate).replace(',','.'))||0;
          if(Math.abs(sum-rate) > 0.01){
            invalidRequired.push(`Phương án vay #${i+1} "${p.name||''}": Phân bổ TW (${p.splitCentral}) + ${provinceLevelLabel()} (${p.splitProvince}) + ${adminLevelLabel()} (${p.splitWard}) = ${sum} — KHÔNG khớp với Lãi suất chung (${p.interestRate}). Tổng 3 cấp phải bằng đúng lãi suất chung.`);
          }
        }
        const hamletAllocNum = parseFloat(String(p.hamletAllocPercent).replace(',','.'));
        if(!isNaN(hamletAllocNum) && hamletAllocNum > 100){
          invalidRequired.push(`Phương án vay #${i+1} "${p.name||''}": "% ${adminLevelLabel()} chia ${subAdminLabel()}" = ${p.hamletAllocPercent} — KHÔNG được vượt quá 100.`);
        }
        // Ràng buộc BẮT BUỘC về ngày tháng: Ngày giải ngân không được ở tương lai, và Ngày đến hạn trừ
        // Ngày giải ngân phải LỚN HƠN 15 ngày (không được bằng 15, nhỏ hơn 15, bằng 0, hay âm).
        if(p.disburseDate && !isDateValueInvalid(fmtDate(p.disburseDate))){
          if(p.disburseDate > todayStr()){
            invalidRequired.push(`Phương án vay #${i+1} "${p.name||''}": "Ngày giải ngân" (${fmtDate(p.disburseDate)}) đang ở TƯƠNG LAI so với ngày hôm nay — không hợp lệ.`);
          }
        }
        if(p.disburseDate && p.dueDate && !isDateValueInvalid(fmtDate(p.disburseDate)) && !isDateValueInvalid(fmtDate(p.dueDate))){
          const diffDays = Math.round((new Date(p.dueDate+'T00:00:00') - new Date(p.disburseDate+'T00:00:00')) / 86400000);
          if(diffDays <= 15){
            invalidRequired.push(`Phương án vay #${i+1} "${p.name||''}": "Ngày đến hạn" (${fmtDate(p.dueDate)}) trừ "Ngày giải ngân" (${fmtDate(p.disburseDate)}) chỉ = ${diffDays} ngày — PHẢI lớn hơn 15 ngày mới hợp lệ.`);
          }
        }
      });
      (latestResult.borrowers||[]).forEach((b,i)=>{
        [['loanDate','Ngày vay'],['dueDate','Ngày đến hạn']].forEach(([k,label])=>{
          if(isDateValueInvalid(fmtDate(b[k]))){
            const msg = `Người vay #${i+1} (${b.name||'chưa có tên'}): trường "${label}" có giá trị vô lý ("${b[k]}")`;
            // Với NGƯỜI VAY, loanDate/dueDate không nằm trong QUICKADD_REQUIRED_BORROWER -> luôn coi là không bắt buộc ở đây
            invalidOptional.push(msg); clearFns.push(()=> b[k]='');
          }
        });
        if(isPhoneInvalid(b.phone)){ invalidOptional.push(`Người vay #${i+1} (${b.name||'chưa có tên'}): trường "Số điện thoại" có chữ cái vô lý ("${b.phone}")`); clearFns.push(()=> b.phone=''); }
        if(isMoneyInvalid(b.principal)){ invalidOptional.push(`Người vay #${i+1} (${b.name||'chưa có tên'}): trường "Số tiền gốc" có ký tự chữ vô lý ("${b.principal}")`); clearFns.push(()=> b.principal=0); }
      });
      if(invalidRequired.length){
        alert(`❌ KHÔNG THỂ tiếp tục — có ${invalidRequired.length} trường BẮT BUỘC đang chứa dữ liệu vô lý, phải sửa lại trước:\n\n${invalidRequired.join('\n')}\n\nVui lòng bấm "✏️ Sửa thủ công" để chỉnh lại (hoặc chat tiếp với AI để nó tự sửa), rồi thử lại.`);
        return false;
      }
      if(invalidOptional.length){
        const ok = confirm(`⚠️ Phát hiện ${invalidOptional.length} trường KHÔNG bắt buộc đang chứa dữ liệu vô lý:\n\n${invalidOptional.join('\n')}\n\nNếu bấm "Có", hệ thống sẽ THÊM bình thường nhưng LOẠI BỎ (để trống) các trường vô lý này. Bấm "Huỷ" nếu đồng chí muốn quay lại sửa trước.`);
        if(!ok) return false;
        clearFns.forEach(fn=> fn());
      }
      return true;
    }
    // (Đã gộp logic "bỏ qua người vay thiếu bắt buộc" trực tiếp vào confirmAndAdd() — xử lý thống nhất
    // cả trường hợp thiếu 1 phần lẫn thiếu hết, không cần hàm riêng nữa.)
    async function confirmAndAdd(){
      if(resultIsEmpty()) return;
      // BƯỚC 1: PHƯƠNG ÁN VAY thiếu bất kỳ trường bắt buộc nào -> CHẶN HẲN toàn bộ, bắt sửa lại trước
      // (không thể "bỏ qua" 1 phương án vay như cách xử lý người vay được, vì người vay khác có thể
      // đang phụ thuộc vào đúng phương án đó).
      const missingProject = [];
      (latestResult.projects||[]).forEach((p,i)=>{
        QUICKADD_REQUIRED_PROJECT.forEach(([k,label])=>{ if(!p[k]) missingProject.push(`Phương án vay #${i+1} "${p.name||'(chưa có tên)'}": thiếu "${label}"`); });
      });
      if(missingProject.length){
        alert(`Chưa thể thêm vào Sổ vay vốn — có Phương án vay đang thiếu thông tin bắt buộc:\n\n${missingProject.join('\n')}\n\nVui lòng chat tiếp với AI để bổ sung đầy đủ (hoặc tự sửa thủ công), rồi thử lại.`);
        return;
      }
      // BƯỚC 2: NGƯỜI VAY nào thiếu BẤT KỲ trường bắt buộc nào (dù thiếu 1 phần hay thiếu hết) -> chỉ
      // CẢNH BÁO rõ và tự động BỎ QUA đúng những người đó, KHÔNG chặn cả lô — vẫn thêm bình thường
      // những người đã đủ điều kiện.
      const skippedBorrowers = [];
      latestResult.borrowers = (latestResult.borrowers||[]).filter((b,i)=>{
        const missingFields = QUICKADD_REQUIRED_BORROWER.filter(([k])=> !b[k]).map(([,label])=>label);
        if(missingFields.length){
          skippedBorrowers.push(`Người vay #${i+1} (${b.name||'chưa có tên'}): thiếu "${missingFields.join('", "')}"`);
          return false;
        }
        return true;
      });
      if(skippedBorrowers.length){
        const ok = confirm(`⚠️ Có ${skippedBorrowers.length} người vay đang thiếu thông tin bắt buộc:\n\n${skippedBorrowers.join('\n')}\n\nNếu bấm "Có", hệ thống sẽ LƯU BÌNH THƯỜNG nhưng BỎ QUA những người này (không thêm vào Sổ vay vốn), chỉ thêm những người đã đủ điều kiện. Bấm "Huỷ" để quay lại bổ sung thông tin cho họ trước.`);
        if(!ok) return;
      }
      // BƯỚC MỚI: kiểm tra lại NGAY TẠI THỜI ĐIỂM bấm nút này — các Phương án vay ĐÃ CÓ SẴN mà người
      // vay đang tham chiếu tới có còn HỢP LỆ hay không (đang hoạt động/bị ẩn). Phòng trường hợp có ai
      // đó (thao tác cùng lúc, hoặc chính người dùng ở tab khác) vừa tất toán/xoá/thay đổi phương án đó
      // trong lúc đang sửa file AI này — không dùng dữ liệu CŨ (existingProjectNames tính từ lúc mở
      // modal), mà tính lại HOÀN TOÀN MỚI ngay lúc này để đảm bảo chính xác tuyệt đối.
      const eligibleNamesNow = new Set(eligibleProjectsForBorrowerAssignment().map(p=>p.name));
      const draftProjectNamesNow = new Set((latestResult.projects||[]).map(p=>p.name));
      const invalidProjectRefs = [];
      latestResult.borrowers = (latestResult.borrowers||[]).filter((b,i)=>{
        if(draftProjectNamesNow.has(b.projectName)) return true; // phương án MỚI (sắp được tạo trong lần này) -> luôn hợp lệ
        if(eligibleNamesNow.has(b.projectName)) return true; // vẫn đang hoạt động/bị ẩn -> hợp lệ, giữ nguyên
        invalidProjectRefs.push(`Người vay #${i+1} (${b.name||'chưa có tên'}): Phương án vay "${b.projectName}" hiện KHÔNG còn hợp lệ nữa`);
        return false;
      });
      if(invalidProjectRefs.length){
        const ok = confirm(`⚠️ Có ai đó đã thao tác làm thay đổi trạng thái của 1 số Phương án vay đang được tham chiếu tới trong file này (có thể đã tất toán/trả nợ trước hạn xong/bị xoá):\n\n${invalidProjectRefs.join('\n')}\n\nVui lòng kiểm tra lại, hoặc bấm "Có" để hệ thống BỎ QUA những người vay thuộc các phương án không còn hợp lệ này, chỉ thêm những người còn lại. Bấm "Huỷ" để dừng lại kiểm tra kỹ hơn.`);
        if(!ok) return;
      }
      if(!confirm(`Đồng chí có CHẮC CHẮN muốn thêm ${(latestResult.projects||[]).length} Phương án vay mới và ${(latestResult.borrowers||[]).length} Người vay mới này vào Sổ vay vốn không?`)) return;
      // BƯỚC MỚI: kiểm tra TỔNG tiền vay của người vay trong CÙNG 1 phương án không được vượt quá Tổng
      // vốn của phương án đó — với phương án ĐÃ CÓ SẴN thì phải cộng thêm số tiền ĐÃ giải ngân sẵn có
      // (những người vay cũ đang có trong Sổ vay vốn), không chỉ tính riêng người vay MỚI trong file này.
      const capacityErrors = [];
      const newSumsByProject = {};
      (latestResult.borrowers||[]).forEach(b=>{ newSumsByProject[b.projectName] = (newSumsByProject[b.projectName]||0) + (parseFloat(b.principal)||0); });
      Object.keys(newSumsByProject).forEach(projName=>{
        const draftProj = (latestResult.projects||[]).find(p=>p.name===projName);
        if(draftProj){
          const cap = parseFloat(draftProj.totalCapital)||0;
          if(newSumsByProject[projName] > cap + 0.5){
            capacityErrors.push(`Phương án vay MỚI "${projName}": tổng tiền vay của các người vay (${moneySpaced(newSumsByProject[projName])}đ) VƯỢT QUÁ Tổng vốn của phương án (${moneySpaced(cap)}đ).`);
          }
        } else {
          const existingProj = (state.loanProjects||[]).find(p=>p.name===projName);
          if(existingProj){
            const alreadyDisbursed = projectDisbursedTotal(existingProj.id);
            const cap = parseFloat(existingProj.totalCapital)||0;
            const totalAfter = alreadyDisbursed + newSumsByProject[projName];
            if(totalAfter > cap + 0.5){
              capacityErrors.push(`Phương án vay "${projName}" (đã có sẵn): đã giải ngân ${moneySpaced(alreadyDisbursed)}đ + tổng tiền vay MỚI ${moneySpaced(newSumsByProject[projName])}đ = ${moneySpaced(totalAfter)}đ — VƯỢT QUÁ Tổng vốn của phương án (${moneySpaced(cap)}đ).`);
            }
          }
        }
      });
      if(capacityErrors.length){
        alert(`❌ KHÔNG THỂ tiếp tục — Tổng tiền vay của người vay trong 1 số Phương án vay đang VƯỢT QUÁ Tổng vốn:\n\n${capacityErrors.join('\n')}\n\nVui lòng sửa lại số tiền vay của từng người, hoặc tăng Tổng vốn của phương án, hoặc chuyển bớt người vay sang phương án khác, rồi thử lại.`);
        return;
      }
      // BƯỚC 3: LỚP KHOÁ cuối cùng — kiểm tra dữ liệu VÔ LÝ (ký tự sai định dạng) trước khi thực sự ghi
      // vào Sổ vay vốn. Phải vượt qua được lớp khoá này mới đi tiếp.
      if(!runSanityCheckLock()) return;
      closeImmediate(); // đã xác nhận lưu thành công qua hộp thoại phía trên rồi -> đóng ngay, không cần hỏi lại cảnh báo mất dữ liệu nữa
      showProcessingToast();
      try{
        const projectIdByName = {};
        for(const p of (latestResult.projects||[])){
          const existing = (state.loanProjects||[]).find(x=>!x.deleted && x.name.trim().toLowerCase()===p.name.trim().toLowerCase());
          if(existing){ projectIdByName[p.name] = existing.id; continue; }
          const newProj = { ...emptyLoanProject(), name:p.name, fundSourceType:p.fundSourceType||FUND_SOURCE_OPTIONS[0], fundSourceOther:p.fundSourceOther||'',
            interestRate:parseFloat(p.interestRate)||0, splitCentral:parseFloat(p.splitCentral)||0, splitProvince:parseFloat(p.splitProvince)||0,
            splitWard:parseFloat(p.splitWard)||0, hamletAllocPercent:p.hamletAllocPercent!=null?parseFloat(p.hamletAllocPercent):45,
            disburseDate:p.disburseDate||todayStr(), dueDate:p.dueDate||'', totalCapital:parseFloat(p.totalCapital)||0 };
          await cSetRecord('loanProjects', newProj.id, newProj);
          state.loanProjects.push(newProj);
          projectIdByName[p.name] = newProj.id;
        }
        for(const b of (latestResult.borrowers||[])){
          let projId = projectIdByName[b.projectName];
          if(!projId){ const existing = (state.loanProjects||[]).find(x=>!x.deleted && x.name.trim().toLowerCase()===(b.projectName||'').trim().toLowerCase()); if(existing) projId = existing.id; }
          const proj = state.loanProjects.find(x=>x.id===projId);
          const mgrList = ensureDefaultManagers();
          const resolvedManagerId = mgrList.find(m=>m.id===b.managerId)
            ? b.managerId
            : (mgrList.find(m=> b.managerId && m.name.toLowerCase().includes(String(b.managerId).toLowerCase())) || {}).id || 'chihoitruong';
          const newB = { ...emptyBorrowerForProject(proj), name:b.name, hamlet:b.hamletDisplay||'', principal:parseFloat(b.principal)||0,
            loanDate:b.loanDate||(proj?proj.disburseDate:todayStr()), dueDate:b.dueDate||(proj?proj.dueDate:''),
            cccd:b.cccd||'', phone:b.phone||'', address:b.address||'', note:b.note||'',
            birthYear:b.birthYear||'', managerId:resolvedManagerId, industry:b.industry||'', repayAbility:b.repayAbility||'', guarantor:b.guarantor||'',
            // QUAN TRỌNG: thêm đúng hậu tố "(cũ)" khớp với định dạng LƯU TRỮ THẬT của hệ thống (xem
            // state.config.hamletsLegacyHidden) — trước đây trường này bị BỎ SÓT HOÀN TOÀN, dù AI có
            // trích xuất đúng cũng không bao giờ được lưu vào Sổ vay vốn.
            preMergerAddress: b.hamletOld? (b.hamletOld.endsWith(' (cũ)')? b.hamletOld : `${b.hamletOld} (cũ)`) : '',
            // Ưu tiên số liệu của PHƯƠNG ÁN (đã kế thừa sẵn qua emptyBorrowerForProject, đảm bảo đồng
            // nhất giữa mọi người vay cùng phương án) — nhưng nếu không xác định được phương án nào,
            // vẫn PHẢI dùng đúng số liệu AI đã trích xuất riêng cho người vay này, không để rơi về mặc
            // định cứng (6,6%/0/0/0/45%) làm mất dữ liệu AI đã công phu trích xuất được.
            rate: proj? (parseFloat(proj.interestRate)||0) : (parseFloat(b.rate)||6.6),
            splitCentral: proj? (parseFloat(proj.splitCentral)||0) : 0,
            splitProvince: proj? (parseFloat(proj.splitProvince)||0) : 0,
            splitWard: proj? (parseFloat(proj.splitWard)||0) : (parseFloat(b.rate)||0),
            hamletAllocPercent: proj? (proj.hamletAllocPercent!=null?parseFloat(proj.hamletAllocPercent):45) : 45,
            fundSource: proj? projectFundSourceLabel(proj) : (b.fundSource||''),
          };
          await cSetRecord('borrowers', newB.id, newB);
          // Nếu AI đã trích xuất được lịch sử gia hạn (VD: đang số hoá lại hồ sơ giấy cũ) -> tạo thật
          // các bản ghi gia hạn tương ứng, đúng thứ tự "level".
          const extList = (b.extensions||[]).filter(e=>e && e.to).slice().sort((x,y)=>(x.level||0)-(y.level||0));
          if(extList.length){
            const arr = extList.map(e=> ({
              from: e.from||'', to: e.to, rateType:'custom', ratePct: parseFloat(e.ratePct)||0, allocMode:'wardHamlet',
              hamletAllocPercent: 45, splitCentral:null, splitProvince:null, splitWard:null,
              savedAt: new Date().toISOString(), savedBy: state.identity.email||'', savedByName: state.identity.name||'',
            }));
            await cSet('loanExtensions/'+newB.id, arr);
          }
        }
        hideProcessingToast();
        showBigToast(`Đã thêm thành công vào Sổ vay vốn!`);
        const el = document.getElementById('content');
        if(el) renderDataTab(el);
      }catch(err){
        hideProcessingToast();
        console.error('Lỗi khi thêm vào Sổ vay vốn:', err);
        alert(`Có lỗi khi thêm vào Sổ vay vốn: ${err && err.message ? err.message : err}`);
      }
    }
    render();
  }
  // Bảng xem trước 1 "file" AI trả về — kiểu bảng tính (cột A,B,C.../dòng 1,2,3... cố định, cột Họ và
  // tên cũng cố định), dùng đúng nhãn cột như Danh sách khoản vay để dễ trò chuyện với AI về ô/cột/dòng.
  function renderQuickAddFilePreviewModal(result, onClose){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const close = ()=>{ wrap.remove(); if(onClose) onClose(); };
    const colLetters = QUICKADD_PREVIEW_COLS.map((_,i)=> String.fromCharCode(65+i));
    let editMode = false;
    let zoomPct = 100;
    let hasFlashedOnce = false;
    let openProjMenu = null; // key của menu "+" (Thêm người vay/Xoá phương án) đang mở, null nếu không mở cái nào
    function render(){
    const existingProjectNames = new Set((state.loanProjects||[]).filter(p=>!p.deleted).map(p=>p.name));
    const newProjectNames = new Set((result.projects||[]).map(p=>p.name));
    // Đánh số THỨ TỰ TOÀN CỤC (data-b-idx) trên mảng result.borrowers gốc — dùng để ghi lại đúng
    // đối tượng khi lưu sau khi sửa thủ công, bất kể đang hiển thị theo nhóm phương án nào.
    const groups = {};
    const groupOrder = [];
    (result.borrowers||[]).forEach((b,gi)=>{
      const key = b.projectName || '(Chưa rõ phương án vay)';
      if(!groups[key]){ groups[key] = []; groupOrder.push(key); }
      groups[key].push({ b, idx: gi });
    });
    // Các phương án vay MỚI chưa có người vay nào (VD vừa bấm "Thêm phương án vay") vẫn cần hiển thị ra
    // (với danh sách người vay rỗng) để người dùng thấy dòng thông tin phương án + có thể thêm người.
    (result.projects||[]).forEach(p=>{
      if(p.name && !groups[p.name]){ groups[p.name] = []; groupOrder.push(p.name); }
    });
    // Các phương án ĐÃ CÓ SẴN được "ghim" thủ công (chọn từ modal "Thêm phương án vay" dù chưa có người
    // vay nào được gán vào) — cũng cần hiển thị ra tương tự.
    (result._pinnedExistingProjectNames||[]).forEach(nm=>{
      if(nm && !groups[nm]){ groups[nm] = []; groupOrder.push(nm); }
    });
    // Tính "X năm Y tháng Z ngày" giữa 2 ngày (kiểu YYYY-MM-DD) — dùng phép trừ theo LỊCH THẬT (không
    // chia đơn giản cho 365) để ra đúng số năm/tháng/ngày như cách con người vẫn tính.
    function formatYMD(fromStr, toStr){
      if(!fromStr || !toStr) return '';
      const from = new Date(fromStr+'T00:00:00');
      const to = new Date(toStr+'T00:00:00');
      if(isNaN(from.getTime()) || isNaN(to.getTime()) || to<from) return '';
      let y = to.getFullYear()-from.getFullYear();
      let m = to.getMonth()-from.getMonth();
      let d = to.getDate()-from.getDate();
      if(d<0){ m--; const prevMonthLastDay = new Date(to.getFullYear(), to.getMonth(), 0).getDate(); d += prevMonthLastDay; }
      if(m<0){ y--; m += 12; }
      return `${y} năm ${m} tháng ${d} ngày`;
    }
    function groupTitle(name){
      if(name==='(Chưa rõ phương án vay)') return `⚠️ ${name}`;
      if(existingProjectNames.has(name)) return `📋 ${escapeHtml(name)} (phương án đã có sẵn)`;
      if(newProjectNames.has(name)) return `✨ ${escapeHtml(name)} (phương án MỚI sẽ được tạo)`;
      return `📋 ${escapeHtml(name)}`;
    }
    function projPlusMenuHtml(name, isExisting, projIdx){
      if(!editMode) return '';
      const menuKey = `proj-${projIdx}-${name}`;
      return `<button type="button" id="proj-plus-btn-${escapeHtml(menuKey)}" class="preview-allow" data-proj-menu-toggle="${escapeHtml(menuKey)}" data-proj-menu-name="${escapeHtml(name)}" data-proj-menu-idx="${projIdx}" data-proj-menu-existing="${isExisting?'1':'0'}" style="width:24px; height:24px; border-radius:6px; border:none; background:#1565c0; color:#fff; font-weight:800; cursor:pointer; font-size:14px; line-height:1; margin-left:8px; vertical-align:middle;">+</button>`;
    }
    function projectInfoRowHtml(name, isExisting, projIdx){
      let src;
      if(isExisting) src = (state.loanProjects||[]).find(p=>p.name===name) || {};
      else src = (result.projects||[])[projIdx] || {};
      // Cột ĐẦU TIÊN ("Tên phương án") luôn CỐ ĐỊNH khi cuộn ngang — tiêu đề nền xanh dương riêng biệt,
      // ô dữ liệu nền xám nhẹ riêng biệt, phân biệt rõ với các cột còn lại.
      const stickyHeaderStyle = 'position:sticky; left:0; z-index:3; background:#1565c0; color:#fff;';
      const stickyCellStyle = 'position:sticky; left:0; z-index:1; background:#eeeeee;';
      return `<table style="border-collapse:collapse; width:max-content; margin-bottom:6px;">
        <thead><tr><th colspan="${quickAddProjectFields().length}" style="background:${isExisting?'#e0e0e0':'#ffe0b2'}; border:1px solid var(--line); padding:4px 8px; font-size:11px; text-align:left; font-weight:800;">${isExisting? '🔒 Thông tin Phương án vay (đã có sẵn — chỉ xem, không thể sửa)' : '✏️ Thông tin Phương án vay (mới — có thể sửa)'}</th></tr>
        <tr>${quickAddProjectFields().map(([k,label],ci)=>`<th style="${ci===0?stickyHeaderStyle:`background:${isExisting?'#eeeeee':'#fff3e0'};`} border:1px solid var(--line); padding:5px 8px; font-size:11px; white-space:nowrap;">${htmlLabel(label)}</th>`).join('')}</tr></thead>
        <tbody><tr>
          ${quickAddProjectFields().map(([k],ci)=>{
            const isDateField = k==='disburseDate' || k==='dueDate';
            const rawVal = src[k]!=null? String(src[k]) : '';
            const displayVal = isDateField ? (rawVal? fmtDate(rawVal) : '') : rawVal;
            const stickyPart = ci===0? stickyCellStyle : '';
            if(isExisting || !editMode){
              return `<td data-proj-existing-name="${escapeHtml(name)}" style="${stickyPart} border:1px solid var(--line); padding:5px 8px; ${ci===0?'':`background:${isExisting?'#f5f5f5':'#fff'};`} color:${isExisting?'#888':'#000'}; white-space:nowrap; font-size:12px;">${escapeHtml(displayVal)}</td>`;
            }
            const cellStyle = `${stickyPart} border:1px solid var(--line); padding:2px; ${ci===0?'':'background:#fff3e0;'}`;
            const inputBaseStyle = 'width:100%; min-width:80px; border:1px solid #ff8f00; border-radius:4px; padding:4px 6px; font-size:12px;';
            // Sao chép ĐÚNG loại nhập liệu từ form "Tạo phương án vay mới" thật: ngày dùng bộ chọn ngày
            // gốc của trình duyệt, nguồn vay dùng dropdown, số thập phân dùng dấu phẩy kiểu Việt Nam.
            if(isDateField){
              const otherKey = k==='disburseDate' ? 'dueDate' : 'disburseDate';
              const otherVal = src[otherKey]!=null? String(src[otherKey]) : '';
              let minAttr = '', maxAttr = '';
              if(k==='disburseDate'){
                maxAttr = todayStr(); // không cho chọn ngày giải ngân trong tương lai
                if(otherVal){
                  const d = new Date(otherVal+'T00:00:00'); d.setDate(d.getDate()-16);
                  const limitStr = d.toISOString().slice(0,10);
                  if(limitStr < maxAttr) maxAttr = limitStr; // còn phải cách Ngày đến hạn hơn 15 ngày
                }
              } else {
                if(otherVal){
                  const d = new Date(otherVal+'T00:00:00'); d.setDate(d.getDate()+16);
                  minAttr = d.toISOString().slice(0,10); // Ngày đến hạn phải cách Ngày giải ngân hơn 15 ngày
                }
              }
              return `<td style="${cellStyle}"><input type="date" id="qfp-proj-${k}-${projIdx}" data-proj-edit-idx="${projIdx}" data-proj-edit-k="${k}" data-proj-edit-date="1" value="${escapeHtml(rawVal)}" ${minAttr?`min="${minAttr}"`:''} ${maxAttr?`max="${maxAttr}"`:''} style="${inputBaseStyle}"></td>`;
            }
            if(k==='name') return `<td style="${cellStyle}"><input type="text" maxlength="60" data-proj-edit-idx="${projIdx}" data-proj-edit-k="${k}" value="${escapeHtml(rawVal)}" style="${inputBaseStyle}"></td>`;
            if(k==='totalCapital') return `<td style="${cellStyle}"><input type="text" inputmode="numeric" data-proj-edit-idx="${projIdx}" data-proj-edit-k="${k}" data-proj-edit-money="1" value="${escapeHtml(rawVal)}" placeholder="Chỉ nhập số" style="${inputBaseStyle}"></td>`;
            if(k==='fundSourceType'){
              return `<td style="${cellStyle}"><select id="qfp-proj-fundSourceType-${projIdx}" data-proj-edit-idx="${projIdx}" data-proj-edit-k="${k}" style="${inputBaseStyle}">${fundSourceSelectOptionsHtml(rawVal)}</select></td>`;
            }
            // interestRate/splitCentral/splitProvince/splitWard/hamletAllocPercent: số thập phân kiểu VN (dấu phẩy)
            return `<td style="${cellStyle}"><input type="text" inputmode="decimal" data-proj-edit-idx="${projIdx}" data-proj-edit-k="${k}" data-proj-edit-decimal="1" value="${escapeHtml(rawVal.replace('.',','))}" style="${inputBaseStyle}"></td>`;
          }).join('')}
        </tr></tbody>
      </table>`;
    }
    function tableHtml(list, projIdx, projName){
      const visibleCols = QUICKADD_PREVIEW_COLS.filter(([k])=> !QUICKADD_PROJECT_LEVEL_BORROWER_KEYS.has(k));
      const visibleColLetters = QUICKADD_PREVIEW_COLS.map((c,i)=>({c,i})).filter(({c})=> !QUICKADD_PROJECT_LEVEL_BORROWER_KEYS.has(c[0])).map(({i})=> colLetters[i]);
      // Nút "+" thêm người vay ĐẦU TIÊN — CHỈ hiện khi phương án này (mới HOẶC đã có sẵn được ghim vào
      // hồ sơ) CHƯA có bất kỳ người vay nào cả — có người vay rồi thì ẩn hẳn (đã có nút "+" ở dòng tiêu
      // đề phương án lo việc thêm người vay tiếp theo rồi, nút này chỉ dành riêng cho trường hợp "chưa
      // có ai" mà thôi). Dùng TÊN phương án (không chỉ dựa vào projIdx) — vì phương án ĐÃ CÓ SẴN được
      // ghim vào hồ sơ không có mặt trong result.projects nên projIdx sẽ là -1, trước đây khiến nút này
      // không hiện ra được cho trường hợp đó (lỗi thật đã xảy ra, nay sửa).
      const showFirstAddBtn = editMode && list.length===0 && !!projName;
      return `
      <table style="border-collapse:collapse; width:max-content; margin-bottom:20px;">
        <thead>
          <tr>
            ${editMode? `<th style="position:sticky; top:0; left:0; z-index:3; background:#c8e6c9; border:1px solid var(--line); padding:6px 10px; min-width:30px;"></th>` : ''}
            <th style="position:sticky; top:0; left:${editMode?'30px':'0'}; z-index:3; background:#c8e6c9; border:1px solid var(--line); padding:6px 10px; min-width:36px;"></th>
            ${visibleColLetters.map((L,i)=> `<th style="position:sticky; top:0; z-index:2; background:${i===0?'#1565c0':'#c8e6c9'}; color:${i===0?'#fff':'inherit'}; border:1px solid var(--line); padding:6px 10px; ${i===0?`left:${editMode?66:36}px; z-index:3;`:''}">${L}</th>`).join('')}
          </tr>
          <tr>
            ${editMode? `<th style="position:sticky; top:29px; left:0; z-index:3; background:#e8f5e9; border:1px solid var(--line); padding:6px 10px;"></th>` : ''}
            <th style="position:sticky; top:29px; left:${editMode?'30px':'0'}; z-index:3; background:#e8f5e9; border:1px solid var(--line); padding:6px 10px; text-align:center;">${showFirstAddBtn? `<button type="button" class="preview-allow" data-proj-add-borrower="${escapeHtml(projName)}" style="width:22px; height:22px; border-radius:6px; border:none; background:#1565c0; color:#fff; font-weight:800; cursor:pointer; font-size:13px; line-height:1;">+</button>` : ''}</th>
            ${visibleCols.map(([k,label],i)=> `<th style="position:sticky; top:29px; z-index:2; background:#e8f5e9; border:1px solid var(--line); padding:6px 10px; white-space:nowrap; ${i===0?`left:${editMode?66:36}px; z-index:3;`:''}">${htmlLabel(label)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${list.length? list.map(({b,idx},ri)=>`<tr>
            ${editMode? `<td style="position:sticky; left:0; z-index:1; background:#fff; border:1px solid var(--line); padding:2px; text-align:center;"><button type="button" class="preview-allow" data-borrower-options="${idx}" style="width:24px; height:24px; border-radius:6px; border:none; background:#5e35b1; color:#fff; cursor:pointer; font-size:13px;">⚙️</button></td>` : ''}
            <td style="position:sticky; left:${editMode?'30px':'0'}; z-index:1; background:#e8f5e9; border:1px solid var(--line); padding:6px 10px; text-align:center; font-weight:700;">${ri+1}</td>
            ${visibleCols.map(([k],ci)=>{
              const rawVal = b[k]!=null? String(b[k]) : '';
              if(!editMode){
                const displayVal = k==='managerId' ? ((ensureDefaultManagers().find(m=>m.id===(rawVal||'chihoitruong'))||{}).name || rawVal) : rawVal;
                return `<td style="border:1px solid var(--line); padding:6px 10px; white-space:nowrap; ${ci===0?'position:sticky; left:36px; background:#eeeeee; font-weight:700; z-index:1;':''}">${escapeHtml(displayVal)}</td>`;
              }
              const cellStyle = `border:1px solid var(--line); padding:2px; ${ci===0?'position:sticky; left:66px; background:#e3f2fd; z-index:1;':'background:#fff9c4;'}`;
              const inputBaseStyle = 'width:100%; min-width:90px; border:1px solid #fbc02d; border-radius:4px; padding:4px 6px; font-size:12.5px;';
              // Sao chép ĐÚNG loại nhập liệu + giới hạn ký tự + mặt nạ nhập từ form "Thêm người vay mới"
              // thật (không tự bịa ra kiểu khác) — để trải nghiệm nhập liệu giống hệt nhau ở mọi nơi.
              if(k==='name') return `<td style="${cellStyle}"><input type="text" data-edit-b="${idx}" data-edit-k="${k}" maxlength="30" value="${escapeHtml(rawVal)}" style="${inputBaseStyle}"></td>`;
              if(k==='principal') return `<td style="${cellStyle}"><input type="text" inputmode="numeric" data-edit-b="${idx}" data-edit-k="${k}" data-edit-money="1" value="${escapeHtml(rawVal)}" placeholder="Chỉ nhập số" style="${inputBaseStyle}"></td>`;
              if(k==='cccd') return `<td style="${cellStyle}"><input type="text" inputmode="numeric" data-edit-b="${idx}" data-edit-k="${k}" data-edit-cccd="1" value="${escapeHtml(rawVal.replace(/\D/g,''))}" style="${inputBaseStyle}"></td>`;
              if(k==='phone') return `<td style="${cellStyle}"><input type="text" inputmode="tel" data-edit-b="${idx}" data-edit-k="${k}" data-edit-phone="1" value="${escapeHtml(rawVal.replace(/[^\d+]/g,''))}" style="${inputBaseStyle}"></td>`;
              if(k==='note') return `<td style="${cellStyle}"><input type="text" maxlength="200" data-edit-b="${idx}" data-edit-k="${k}" value="${escapeHtml(rawVal)}" style="${inputBaseStyle}"></td>`;
              if(k==='birthYear') return `<td style="${cellStyle}"><input type="text" inputmode="numeric" maxlength="4" data-edit-b="${idx}" data-edit-k="${k}" value="${escapeHtml(rawVal)}" placeholder="Vd: 1985" style="${inputBaseStyle}"></td>`;
              if(k==='industry' || k==='repayAbility' || k==='guarantor') return `<td style="${cellStyle}"><input type="text" maxlength="100" data-edit-b="${idx}" data-edit-k="${k}" value="${escapeHtml(rawVal)}" style="${inputBaseStyle}"></td>`;
              if(k==='managerId'){
                const mgrs = ensureDefaultManagers();
                const curMgr = mgrs.find(m=>m.id===rawVal) || mgrs.find(m=>m.id==='chihoitruong');
                return `<td style="${cellStyle}"><select data-edit-b="${idx}" data-edit-k="${k}" data-edit-manager-select="1" style="${inputBaseStyle}">
                  ${mgrs.map(m=>`<option value="${escapeHtml(m.id)}" ${curMgr&&curMgr.id===m.id?'selected':''}>${escapeHtml(m.name)}</option>`).join('')}
                  <option value="__add__">+ Thêm người quản lý...</option>
                </select></td>`;
              }
              // Đơn vị (hamletDisplay) / Đơn vị trước sáp nhập (hamletOld): dropdown Y HỆT form "Thêm
              // người vay mới" thật (cùng danh sách, cùng nút "+Thêm..." mở đúng bảng quản lý).
              if(k==='hamletDisplay'){
                const hamlets = state.config.hamlets||[];
                return `<td style="${cellStyle}"><select data-edit-b="${idx}" data-edit-k="${k}" data-edit-hamlet-select="1" style="${inputBaseStyle}">
                  <option value="">-- Chọn --</option>
                  ${hamlets.map(h=>`<option value="${escapeHtml(h)}" ${rawVal===h?'selected':''}>${escapeHtml(h)}</option>`).join('')}
                  ${(rawVal && !hamlets.includes(rawVal))? `<option value="${escapeHtml(rawVal)}" selected>${escapeHtml(rawVal)} (chưa có trong danh sách chung)</option>` : ''}
                  <option value="__add__">+ Thêm địa bàn dân cư...</option>
                </select></td>`;
              }
              if(k==='hamletOld'){
                const legacy = state.config.hamletsLegacyHidden||[];
                const matchVal = rawVal && !rawVal.endsWith(' (cũ)') ? `${rawVal} (cũ)` : rawVal;
                return `<td style="${cellStyle}"><select data-edit-b="${idx}" data-edit-k="${k}" data-edit-legacy-select="1" style="${inputBaseStyle}">
                  <option value="">-- Không chọn --</option>
                  ${legacy.map(h=>`<option value="${escapeHtml(h)}" ${matchVal===h?'selected':''}>${escapeHtml(h)}</option>`).join('')}
                  <option value="__add__">+ Thêm địa chỉ trước sáp nhập...</option>
                </select></td>`;
              }
              // address / các trường còn lại: chữ tự do, không giới hạn (giống form thật)
              return `<td style="${cellStyle}"><input type="text" data-edit-b="${idx}" data-edit-k="${k}" value="${escapeHtml(rawVal)}" style="${inputBaseStyle}"></td>`;
            }).join('')}
          </tr>`).join('') : `<tr><td colspan="${visibleCols.length+1+(editMode?1:0)}" style="padding:14px; text-align:center;">Không có dữ liệu.</td></tr>`}
        </tbody>
      </table>`;
    }
    wrap.innerHTML = `
      <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column; border:6px solid ${editMode?'#c62828':'#fbc02d'};">
        <div class="modal-head" style="${editMode? 'background:linear-gradient(180deg, #ef5350 0%, #c62828 50%, #7f0000 100%);' : ''}"><h3 style="${editMode?'color:#fff;':''}">${editMode? waveTextHtmlSlow('📋 Hồ sơ đang soạn — Đang sửa thủ công') : '📋 Hồ sơ đang soạn'}</h3><button class="modal-close preview-allow" id="qfp-close">✕</button></div>
        ${editMode? `<p class="sub" style="margin:8px 14px 0; color:#5a4300;">💡 Bấm vào từng ô để sửa trực tiếp, xong thì bấm "💾 Lưu thay đổi".</p>` : ''}
        <div class="modal-body" id="qfp-modal-body" style="flex:1; overflow:auto; padding:14px; ${editMode?'background:#fff0f0;':''}">
          <div id="qfp-zoom-wrap" style="transform:scale(${zoomPct/100}); transform-origin:top left; width:${zoomPct}%;">
          ${groupOrder.length? (function(){
            // Đánh số thứ tự "Chưa có tên (N)" cho các phương án MỚI đang bị trùng tên rỗng — tính 1
            // lần trước vòng lặp để đánh số đúng theo thứ tự xuất hiện.
            let emptyNameCounter = 0;
            const emptyNameNumberByProjIdx = {};
            (result.projects||[]).forEach((p,i)=>{ if(!p.name){ emptyNameCounter++; emptyNameNumberByProjIdx[i] = emptyNameCounter; } });
            return groupOrder.map(name=>{
            const isExisting = existingProjectNames.has(name);
            const projIdx = (result.projects||[]).findIndex(p=>p.name===name);
            const showProjectInfoRow = name!=='(Chưa rõ phương án vay)' && (isExisting || projIdx>=0);
            const isEditableProject = editMode && !isExisting && projIdx>=0;
            const proj = projIdx>=0 ? result.projects[projIdx] : null;
            const titleTextHtml = isEditableProject
              ? `<span id="qfp-title-text-${projIdx}" data-empty-fallback="Chưa có tên (${emptyNameNumberByProjIdx[projIdx]})">📋 ${proj.name? escapeHtml(proj.name) : `Chưa có tên (${emptyNameNumberByProjIdx[projIdx]})`}</span>`
              : groupTitle(name);
            // Dòng tổng hợp "X đ, ...năm...tháng...ngày" — LUÔN hiện cho MỌI phương án (cả đã có sẵn/bị
            // khoá lẫn phương án mới), cả lúc ĐANG XEM lẫn ĐANG SỬA — không chỉ riêng lúc sửa phương án
            // mới như trước đây nữa. Với phương án đã có sẵn, đọc số liệu từ state.loanProjects (nguồn
            // gốc thật) thay vì result.projects (chỉ chứa phương án MỚI).
            const summarySrc = isExisting ? (state.loanProjects||[]).find(p=>p.name===name) : proj;
            const summaryLineHtml = (showProjectInfoRow && summarySrc) ? `
              <p id="${isEditableProject?`qfp-summary-${projIdx}`:''}" style="margin:0 0 6px;"><span id="${isEditableProject?`qfp-summary-money-${projIdx}`:''}" style="color:#b71c1c; font-weight:800;">${moneySpaced(summarySrc.totalCapital||0)}</span>, <span id="${isEditableProject?`qfp-summary-duration-${projIdx}`:''}">${formatYMD(summarySrc.disburseDate,summarySrc.dueDate) || '(chưa đủ ngày tháng để tính)'}</span></p>` : '';
            return `
            <p style="font-weight:800; margin:10px 0 6px;">${titleTextHtml} (${groups[name].length} người vay)${showProjectInfoRow? projPlusMenuHtml(name, isExisting, projIdx) : ''}</p>
            ${summaryLineHtml}
            ${showProjectInfoRow? projectInfoRowHtml(name, isExisting, projIdx) : ''}
            ${tableHtml(groups[name], projIdx, name)}
          `;
          }).join('');
          })() : `<div style="text-align:center; padding:30px 16px;">
            <p style="font-size:15px; font-weight:700; margin-bottom:8px;">📋 Hồ sơ này hiện đang RỖNG</p>
            <p class="sub" style="max-width:420px; margin:0 auto;">Hãy tiếp tục trò chuyện với AI ở khung chat để AI tự động điền thông tin đầy đủ vào đây, hoặc bấm nút "✏️ Sửa thủ công" bên dưới để tự thêm Phương án vay/Người vay theo ý đồng chí.</p>
          </div>`}
          ${editMode? `<div style="text-align:center; margin-top:6px;"><button type="button" class="btn btn-primary preview-allow" id="qfp-add-project">➕ Thêm phương án vay</button></div>` : ''}
          </div>
        </div>
        <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
          ${editMode? `
            <button class="btn btn-ghost preview-allow" id="qfp-edit-cancel">↩️ Huỷ sửa</button>
            <button class="btn btn-primary preview-allow" id="qfp-edit-save">💾 Lưu thay đổi</button>
          ` : `
            <button class="btn btn-ghost preview-allow" id="qfp-close2">Đóng bảng</button>
            <button class="btn btn-sm preview-allow" id="qfp-edit-start" style="background:linear-gradient(180deg, #ffffff 0%, #ffca28 45%, #ff8f00 100%); color:#5a3d00; border-color:#ff8f00; font-weight:700;">✏️ Sửa thủ công</button>
          `}
          <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
            <button type="button" class="btn btn-ghost btn-sm preview-allow ${hasFlashedOnce?'':'zoom-btn-flash'}" id="qfp-zoom-out" ${zoomPct<=50?'disabled':''} title="Thu nhỏ">➖</button>
            <span style="font-weight:700; min-width:42px; text-align:center;">${zoomPct}%</span>
            <button type="button" class="btn btn-ghost btn-sm preview-allow ${hasFlashedOnce?'':'zoom-btn-flash'}" id="qfp-zoom-in" ${zoomPct>=200?'disabled':''} title="Phóng to">➕</button>
          </div>
        </div>
      </div>`;
    hasFlashedOnce = true;
    wrap.querySelector('#qfp-close').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    const close2 = wrap.querySelector('#qfp-close2'); if(close2) close2.onclick = close;
    const zoomInBtn2 = wrap.querySelector('#qfp-zoom-in');
    if(zoomInBtn2) zoomInBtn2.onclick = ()=>{ zoomPct = Math.min(200, zoomPct+10); render(); };
    const zoomOutBtn2 = wrap.querySelector('#qfp-zoom-out');
    if(zoomOutBtn2) zoomOutBtn2.onclick = ()=>{ zoomPct = Math.max(50, zoomPct-10); render(); };
    // Lọc ký tự TRỰC TIẾP khi đang gõ cho các ô tiền/CCCD/SĐT — sao chép ĐÚNG hành vi từ form "Thêm
    // người vay mới"/"Tạo phương án vay mới" thật (giới hạn số ký tự, chỉ cho phép đúng loại ký tự).
    wrap.querySelectorAll('[data-edit-money], [data-proj-edit-money]').forEach(inp=> inp.addEventListener('input', ()=>{ inp.value = inp.value.replace(/[^\d]/g,'').slice(0,12); }));
    wrap.querySelectorAll('[data-edit-cccd]').forEach(inp=> inp.addEventListener('input', ()=>{ inp.value = inp.value.replace(/[^\d]/g,'').slice(0,13); }));
    wrap.querySelectorAll('[data-edit-phone]').forEach(inp=> inp.addEventListener('input', ()=>{
      let raw = inp.value.replace(/[^\d+]/g,'');
      const plus = raw.startsWith('+') ? '+' : '';
      let digits = raw.replace(/\+/g,'').slice(0, 12-plus.length);
      inp.value = plus + digits;
    }));
    wrap.querySelectorAll('[data-proj-edit-decimal]').forEach(inp=> inp.addEventListener('input', ()=>{ inp.value = inp.value.replace(/[^\d,]/g,''); }));
    // Nút "+Thêm..." trong dropdown Đơn vị / Đơn vị trước sáp nhập — mở ĐÚNG bảng quản lý thật (y hệt
    // form "Thêm người vay mới" ngoài panel). Lưu + khôi phục toàn bộ giá trị mọi ô trong bảng AI trước/
    // sau khi mở bảng quản lý, tránh lặp lại lỗi "vẽ lại làm mất hết dữ liệu đang sửa dở" đã gặp trước đây.
    wrap.querySelectorAll('[data-edit-hamlet-select]').forEach(sel=> sel.addEventListener('change', ()=>{
      if(sel.value!=='__add__') return;
      const prevVal = sel.dataset.prev || '';
      const savedValues = {};
      wrap.querySelectorAll('input[id], select[id], textarea[id], select[data-edit-b], select[data-proj-edit-idx]').forEach(el=>{ if(el.id) savedValues[el.id]=el.value; });
      const savedByKey = [];
      wrap.querySelectorAll('[data-edit-b]').forEach(el=> savedByKey.push([el.dataset.editB, el.dataset.editK, el.value]));
      const savedScrollBody1 = wrap.querySelector('#qfp-modal-body');
      const savedScroll1 = savedScrollBody1 ? savedScrollBody1.scrollTop : null;
      const savedWinScroll1 = window.scrollY;
      renderHamletManagerModal(()=>{
        render();
        savedByKey.forEach(([b2,k2,v2])=>{ const el=wrap.querySelector(`[data-edit-b="${b2}"][data-edit-k="${k2}"]`); if(el && !(b2===sel.dataset.editB && k2==='hamletDisplay')) el.value=v2; });
        const newBody1 = wrap.querySelector('#qfp-modal-body');
        if(newBody1 && savedScroll1!=null) newBody1.scrollTop = savedScroll1;
        window.scrollTo({ top: savedWinScroll1, behavior:'auto' });
        const newSel1 = wrap.querySelector(`[data-edit-b="${sel.dataset.editB}"][data-edit-k="hamletDisplay"]`);
        if(newSel1){
          newSel1.classList.add('field-border-flash');
          // Tự động chọn lựa chọn CUỐI CÙNG trong danh sách — LƯU Ý: option cuối cùng thật sự luôn là
          // "+ Thêm..." (tuỳ chọn để mở lại modal quản lý), nên phải lấy đúng option ÁP CHÓT (index -2)
          // mới đúng là lựa chọn THẬT cuối cùng trong danh sách.
          if(newSel1.tagName==='SELECT' && newSel1.options.length>1) newSel1.value = newSel1.options[newSel1.options.length-2].value;
        }
      });
      sel.value = prevVal;
    }));
    wrap.querySelectorAll('[data-edit-legacy-select]').forEach(sel=> sel.addEventListener('change', ()=>{
      if(sel.value!=='__add__') return;
      const prevVal = sel.dataset.prev || '';
      const savedByKey = [];
      wrap.querySelectorAll('[data-edit-b]').forEach(el=> savedByKey.push([el.dataset.editB, el.dataset.editK, el.value]));
      const savedScrollBody2 = wrap.querySelector('#qfp-modal-body');
      const savedScroll2 = savedScrollBody2 ? savedScrollBody2.scrollTop : null;
      const savedWinScroll2 = window.scrollY;
      renderLegacyAddressManagerModal(()=>{
        render();
        savedByKey.forEach(([b2,k2,v2])=>{ const el=wrap.querySelector(`[data-edit-b="${b2}"][data-edit-k="${k2}"]`); if(el && !(b2===sel.dataset.editB && k2==='hamletOld')) el.value=v2; });
        const newBody2 = wrap.querySelector('#qfp-modal-body');
        if(newBody2 && savedScroll2!=null) newBody2.scrollTop = savedScroll2;
        window.scrollTo({ top: savedWinScroll2, behavior:'auto' });
        const newSel2 = wrap.querySelector(`[data-edit-b="${sel.dataset.editB}"][data-edit-k="hamletOld"]`);
        if(newSel2){
          newSel2.classList.add('field-border-flash');
          if(newSel2.tagName==='SELECT' && newSel2.options.length>1) newSel2.value = newSel2.options[newSel2.options.length-2].value;
        }
      });
      sel.value = prevVal;
    }));
    wrap.querySelectorAll('[data-edit-hamlet-select], [data-edit-legacy-select], [data-edit-manager-select]').forEach(sel=>{ if(sel.value!=='__add__') sel.dataset.prev = sel.value; sel.addEventListener('change', ()=>{ if(sel.value!=='__add__') sel.dataset.prev = sel.value; }); });
    // Đồng bộ TRỰC TIẾP, KHÔNG ĐỘ TRỄ giữa Ngày giải ngân <-> Ngày đến hạn của MỖI phương án vay — đổi
    // 1 trong 2 ngày thì lập tức khoá lại (min/max) các lựa chọn vô lý ở ngày còn lại (không cho chọn
    // ngày làm vi phạm khoảng cách >15 ngày, không cho Ngày giải ngân ở tương lai).
    (result.projects||[]).forEach((p,pi)=>{
      const disburseInput = wrap.querySelector(`#qfp-proj-disburseDate-${pi}`);
      const dueInput = wrap.querySelector(`#qfp-proj-dueDate-${pi}`);
      if(!disburseInput || !dueInput) return;
      const syncFromDisburse = ()=>{
        if(disburseInput.value){
          const d = new Date(disburseInput.value+'T00:00:00'); d.setDate(d.getDate()+16);
          dueInput.min = d.toISOString().slice(0,10);
        } else dueInput.removeAttribute('min');
      };
      const syncFromDue = ()=>{
        let maxV = todayStr();
        if(dueInput.value){
          const d = new Date(dueInput.value+'T00:00:00'); d.setDate(d.getDate()-16);
          const limitStr = d.toISOString().slice(0,10);
          if(limitStr < maxV) maxV = limitStr;
        }
        disburseInput.max = maxV;
      };
      disburseInput.addEventListener('input', syncFromDisburse);
      dueInput.addEventListener('input', syncFromDue);
      // Chọn "+ Thêm nguồn khác" thì mở modal quản lý Nguồn vay — lưu/khôi phục toàn bộ giá trị form
      // trước/sau, đúng mẫu đã áp dụng cho các cột địa bàn/người quản lý/địa chỉ trước sáp nhập khác.
      const fundTypeSelect = wrap.querySelector(`#qfp-proj-fundSourceType-${pi}`);
      if(fundTypeSelect){
        fundTypeSelect.dataset.prev = fundTypeSelect.value;
        fundTypeSelect.addEventListener('change', ()=>{
          if(fundTypeSelect.value!=='__add_fundsource__'){ fundTypeSelect.dataset.prev = fundTypeSelect.value; return; }
          const prevVal = fundTypeSelect.dataset.prev;
          const savedByKey = [];
          const savedProjByKey = [];
          wrap.querySelectorAll('[data-edit-b]').forEach(el=> savedByKey.push([el.dataset.editB, el.dataset.editK, el.value]));
          wrap.querySelectorAll('[data-proj-edit-idx]').forEach(el=> savedProjByKey.push([el.dataset.projEditIdx, el.dataset.projEditK, el.value]));
          renderFundSourceManagerModal((newList)=>{
            state.config.customFundSources = newList;
            render();
            savedByKey.forEach(([b2,k2,v2])=>{ const el=wrap.querySelector(`[data-edit-b="${b2}"][data-edit-k="${k2}"]`); if(el) el.value=v2; });
            savedProjByKey.forEach(([p2,k2,v2])=>{ const el=wrap.querySelector(`[data-proj-edit-idx="${p2}"][data-proj-edit-k="${k2}"]`); if(el && !(p2===String(pi) && k2==='fundSourceType')) el.value=v2; });
            const newFundSel = wrap.querySelector(`#qfp-proj-fundSourceType-${pi}`);
            if(newFundSel){
              newFundSel.classList.add('field-border-flash');
              if(newFundSel.options.length>1) newFundSel.value = newFundSel.options[newFundSel.options.length-2].value;
            }
          });
          fundTypeSelect.value = prevVal;
        });
      }
    });
    wrap.querySelectorAll('[data-edit-manager-select]').forEach(sel=> sel.addEventListener('change', ()=>{
      if(sel.value!=='__add__') return;
      const prevVal = sel.dataset.prev || 'chihoitruong';
      const savedByKey = [];
      wrap.querySelectorAll('[data-edit-b]').forEach(el=> savedByKey.push([el.dataset.editB, el.dataset.editK, el.value]));
      const savedScrollBody3 = wrap.querySelector('#qfp-modal-body');
      const savedScroll3 = savedScrollBody3 ? savedScrollBody3.scrollTop : null;
      const savedWinScroll3 = window.scrollY;
      renderBorrowerManagerModal(()=>{
        render();
        savedByKey.forEach(([b2,k2,v2])=>{ const el=wrap.querySelector(`[data-edit-b="${b2}"][data-edit-k="${k2}"]`); if(el && !(b2===sel.dataset.editB && k2==='managerId')) el.value=v2; });
        const newBody3 = wrap.querySelector('#qfp-modal-body');
        if(newBody3 && savedScroll3!=null) newBody3.scrollTop = savedScroll3;
        window.scrollTo({ top: savedWinScroll3, behavior:'auto' });
        const newSel3 = wrap.querySelector(`[data-edit-b="${sel.dataset.editB}"][data-edit-k="managerId"]`);
        if(newSel3){
          newSel3.classList.add('field-border-flash');
          if(newSel3.options.length>1) newSel3.value = newSel3.options[newSel3.options.length-2].value;
        }
      });
      sel.value = prevVal;
    }));
    // Tất cả ô TIỀN: khi rời khỏi ô (blur) -> tự tách 3 số thành 1 cụm để dễ đọc (VD "25000" -> "25 000").
    // Khi bấm vào lại (focus) -> trở về số thô để nhập liệu không bị vướng dấu cách. Tránh xung đột với
    // dòng "X đ" đồng bộ trực tiếp phía trên (dòng đó luôn tự đọc giá trị số THẬT từ result, không đọc
    // trực tiếp từ input đang hiển thị, nên không bị ảnh hưởng bởi việc input đang ở dạng thô hay đã
    // định dạng).
    wrap.querySelectorAll('[data-edit-money], [data-proj-edit-money]').forEach(inp=>{
      inp.addEventListener('focus', ()=>{ inp.value = inp.value.replace(/[^\d]/g,''); });
      inp.addEventListener('blur', ()=>{ const digits = inp.value.replace(/[^\d]/g,''); inp.value = digits? groupDigitsRight(digits,3) : ''; });
      if(inp.value) inp.value = groupDigitsRight(inp.value.replace(/[^\d]/g,''),3); // định dạng sẵn ngay từ lúc vừa vẽ ra
    });
    // Đồng bộ TRỰC TIẾP (không qua render lại, không độ trễ) — tiêu đề phương án theo ô "Tên phương
    // án", dòng "X đ, ...năm ...tháng ...ngày" theo ô "Tổng vốn"/"Ngày giải ngân"/"Ngày đến hạn".
    (result.projects||[]).forEach((p,pi)=>{
      if(!p || existingProjectNames.has(p.name)) return; // phương án đã có sẵn -> không có ô nào để sửa, bỏ qua
      const nameInput = wrap.querySelector(`[data-proj-edit-idx="${pi}"][data-proj-edit-k="name"]`);
      const titleSpan = wrap.querySelector(`#qfp-title-text-${pi}`);
      if(nameInput && titleSpan){
        nameInput.addEventListener('input', ()=>{
          const v = nameInput.value.trim();
          titleSpan.textContent = `📋 ${v || titleSpan.dataset.emptyFallback}`;
          // Nếu modal "Tuỳ chọn cho: ..." (đổi phương án vay) đang mở, đồng bộ luôn tên hiển thị ở đó —
          // không cần đóng mở lại modal mới thấy tên mới.
          const boptSpan = document.getElementById(`bopt-name-new-${pi}`);
          if(boptSpan){
            boptSpan.textContent = v || '(chưa có tên)';
            const radio = boptSpan.previousElementSibling;
            if(radio && radio.type==='radio') radio.value = v;
          }
        });
      }
      const capInput = wrap.querySelector(`[data-proj-edit-idx="${pi}"][data-proj-edit-k="totalCapital"]`);
      const moneySpan = wrap.querySelector(`#qfp-summary-money-${pi}`);
      if(capInput && moneySpan){
        capInput.addEventListener('input', ()=>{ moneySpan.textContent = moneySpaced(parseVNMoney(capInput.value)); });
      }
      const disburseInput = wrap.querySelector(`[data-proj-edit-idx="${pi}"][data-proj-edit-k="disburseDate"]`);
      const dueInput = wrap.querySelector(`[data-proj-edit-idx="${pi}"][data-proj-edit-k="dueDate"]`);
      const durationSpan = wrap.querySelector(`#qfp-summary-duration-${pi}`);
      if(disburseInput && dueInput && durationSpan){
        const updateDuration = ()=>{ durationSpan.textContent = formatYMD(disburseInput.value, dueInput.value) || '(chưa đủ ngày tháng để tính)'; };
        disburseInput.addEventListener('input', updateDuration);
        dueInput.addEventListener('input', updateDuration);
      }
    });
    const editStartBtn = wrap.querySelector('#qfp-edit-start');
    if(editStartBtn) editStartBtn.onclick = ()=>{ editMode = true; render(); };
    wrap.querySelectorAll('[data-proj-menu-toggle]').forEach(btn=> btn.onclick = (e)=>{
      e.stopPropagation();
      // Gỡ bỏ menu nổi cũ (nếu có) trước khi mở menu mới — chỉ cho phép mở 1 menu tại 1 thời điểm.
      const oldMenu = document.getElementById('proj-plus-floating-menu');
      if(oldMenu) oldMenu.remove();
      const name = btn.dataset.projMenuName;
      const projIdx = btn.dataset.projMenuIdx;
      const isExisting = btn.dataset.projMenuExisting==='1';
      // CUỘN TRƯỚC cho nút "+" nằm gần giữa màn hình, rồi MỚI định vị + hiện menu ra theo đúng vị trí
      // MỚI của nút sau khi đã cuộn xong — để menu luôn đi liền với đúng nút + mà nó thuộc về.
      btn.scrollIntoView({ block:'center', behavior:'auto' });
      requestAnimationFrame(()=> requestAnimationFrame(()=>{
        const rect = btn.getBoundingClientRect();
        const menu = document.createElement('div');
        menu.id = 'proj-plus-floating-menu';
        // position:fixed + gắn thẳng vào document.body — tránh bị kẹt trong lớp transform:scale (khung
        // phóng to/thu nhỏ) của modal, đảm bảo menu LUÔN hiện đúng vị trí thật trên màn hình và đè lên
        // được MỌI THỨ trong modal, không bị cắt xén bởi bất kỳ khung cuộn/transform nào.
        menu.style.cssText = `position:fixed; top:${rect.bottom+4}px; left:${rect.left}px; z-index:9999; background:#fff; border:1px solid var(--line); border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.3); padding:10px 6px 6px; min-width:200px; text-align:left; font-weight:400;`;
        menu.innerHTML = `
          <button type="button" class="preview-allow" id="proj-plus-floating-close" style="position:absolute; top:-10px; right:-10px; width:24px; height:24px; border-radius:50%; border:none; background:#b71c1c; color:#fff; font-weight:800; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,.3);">✕</button>
          <button type="button" class="preview-allow" data-proj-add-borrower="${escapeHtml(name)}" style="display:block; width:100%; text-align:left; padding:8px 10px; border:none; background:none; cursor:pointer; font-size:12.5px; border-radius:6px;">➕ Thêm người vay</button>
          <button type="button" class="preview-allow" data-proj-delete="${projIdx}" data-proj-delete-name="${escapeHtml(name)}" ${isExisting?'disabled':''} style="display:block; width:100%; text-align:left; padding:8px 10px; border:none; background:none; cursor:${isExisting?'not-allowed':'pointer'}; font-size:12.5px; border-radius:6px; color:${isExisting?'#aaa':'#b71c1c'};">🗑️ Xoá phương án vay này${isExisting?' (không thể — đã có sẵn)':''}</button>`;
        document.body.appendChild(menu);
        // Nếu menu tràn ra ngoài mép phải màn hình thì tự căn lại cho vừa khung nhìn.
        const menuRect = menu.getBoundingClientRect();
        if(menuRect.right > window.innerWidth) menu.style.left = Math.max(4, window.innerWidth - menuRect.width - 4) + 'px';
        const closeMenu = ()=> menu.remove();
        menu.querySelector('#proj-plus-floating-close').onclick = (ev)=>{ ev.stopPropagation(); closeMenu(); };
        menu.querySelectorAll('[data-proj-add-borrower], [data-proj-delete]').forEach(mbtn=> mbtn.addEventListener('click', ()=> closeMenu()));
        // Bấm ra ngoài menu thì tự đóng.
        setTimeout(()=>{
          document.addEventListener('click', function outsideClick(ev){
            if(!menu.contains(ev.target)){ closeMenu(); document.removeEventListener('click', outsideClick); }
          });
        }, 0);
      }));
    });
    if(!window.__qfpProjMenuActionsWired){
      window.__qfpProjMenuActionsWired = true;
      document.addEventListener('click', (e)=>{
        const addBtn = e.target.closest('[data-proj-add-borrower]');
        if(addBtn){
          e.stopPropagation();
          let projName = addBtn.dataset.projAddBorrower;
          const firstM = projName.match(/^__first__(\d+)$/);
          if(firstM){
            const p = window.__qfpCurrentResult && window.__qfpCurrentResult.projects[parseInt(firstM[1],10)];
            projName = p ? p.name : '';
          }
          const blank = { name:'', hamletDisplay:'', hamletOld:'', projectName:projName, principal:'', loanDate:'', dueDate:'', fundSource:'', rate:'', cccd:'', phone:'', address:'', note:'', extensions:[] };
          if(window.__qfpCurrentResult){
            window.__qfpCurrentResult.borrowers = window.__qfpCurrentResult.borrowers || [];
            // Lưu lại toàn bộ giá trị đang có trên form TRƯỚC khi vẽ lại — tránh mất các ký tự người
            // dùng đang gõ dở ở thông tin phương án vay phía trên (lỗi kinh điển: vẽ lại toàn bộ HTML
            // sẽ xoá sạch giá trị của các ô KHÔNG được lưu vào state trước đó).
            const savedByKey = [];
            const savedProjByKey = [];
            if(window.__qfpCurrentWrap){
              window.__qfpCurrentWrap.querySelectorAll('[data-edit-b]').forEach(el=> savedByKey.push([el.dataset.editB, el.dataset.editK, el.value]));
              window.__qfpCurrentWrap.querySelectorAll('[data-proj-edit-idx]').forEach(el=> savedProjByKey.push([el.dataset.projEditIdx, el.dataset.projEditK, el.value]));
            }
            window.__qfpCurrentResult.borrowers.push(blank);
            window.__qfpCurrentResult._manuallyEdited = true;
            const newBorrowerIdx = window.__qfpCurrentResult.borrowers.length - 1;
            if(window.__qfpCurrentRender) window.__qfpCurrentRender();
            const wrapNow = window.__qfpCurrentWrap;
            if(wrapNow){
              savedByKey.forEach(([b2,k2,v2])=>{ const el=wrapNow.querySelector(`[data-edit-b="${b2}"][data-edit-k="${k2}"]`); if(el) el.value=v2; });
              savedProjByKey.forEach(([p2,k2,v2])=>{ const el=wrapNow.querySelector(`[data-proj-edit-idx="${p2}"][data-proj-edit-k="${k2}"]`); if(el) el.value=v2; });
              // Cuộn tới đúng dòng người vay MỚI vừa được thêm vào (dòng cuối cùng trong danh sách).
              requestAnimationFrame(()=>{
                const rows = wrapNow.querySelectorAll('[data-edit-b][data-edit-k="name"]');
                const lastRow = rows[rows.length-1];
                if(lastRow) lastRow.closest('tr').scrollIntoView({ block:'center', behavior:'auto' });
                // Nhấp nháy màu nền cho TẤT CẢ ô nhập liệu của đúng dòng người vay vừa được thêm mới.
                wrapNow.querySelectorAll(`[data-edit-b="${newBorrowerIdx}"]`).forEach(fieldEl=> fieldEl.classList.add('new-field-flash'));
              });
            }
          }
          return;
        }
        const delBtn = e.target.closest('[data-proj-delete]');
        if(delBtn){
          e.stopPropagation();
          if(delBtn.disabled) return;
          const projIdx = parseInt(delBtn.dataset.projDelete,10);
          const projName = delBtn.dataset.projDeleteName;
          if(!window.__qfpCurrentResult) return;
          const membersCount = (window.__qfpCurrentResult.borrowers||[]).filter(b=> b.projectName===projName).length;
          if(membersCount>0){
            alert(`Không thể xoá Phương án vay "${projName}" vì hiện vẫn còn ${membersCount} người vay đang thuộc phương án này. Hãy xoá hết người vay (hoặc chuyển họ sang phương án khác) trước, rồi mới xoá được phương án vay.`);
            return;
          }
          window.__qfpCurrentResult.projects = (window.__qfpCurrentResult.projects||[]).filter((p,i)=> i!==projIdx);
          window.__qfpCurrentResult._manuallyEdited = true;
          // Giữ nguyên đúng vị trí cuộn hiện tại (cả khung cuộn nội bộ #qfp-modal-body lẫn cửa sổ trình
          // duyệt) — để sau khi xoá, màn hình đứng yên tại đúng chỗ vừa xoá (hiện ra đúng nội dung nằm
          // NGAY SAU phương án vừa bị xoá), không bị nhảy lên đầu trang.
          const scrollBody = window.__qfpCurrentWrap ? window.__qfpCurrentWrap.querySelector('#qfp-modal-body') : null;
          const savedBodyScroll = scrollBody ? scrollBody.scrollTop : null;
          const savedWinScroll = window.scrollY;
          if(window.__qfpCurrentRender) window.__qfpCurrentRender();
          requestAnimationFrame(()=>{
            const newBody = window.__qfpCurrentWrap ? window.__qfpCurrentWrap.querySelector('#qfp-modal-body') : null;
            if(newBody && savedBodyScroll!=null) newBody.scrollTop = savedBodyScroll;
            window.scrollTo({ top: savedWinScroll, behavior:'auto' });
          });
          showBigToast(`Đã xoá Phương án vay "${projName}" khỏi bản nháp.`);
        }
      });
    }
    window.__qfpCurrentResult = result;
    window.__qfpCurrentWrap = wrap;
    window.__qfpCurrentRender = render;
    const addProjectBtn = wrap.querySelector('#qfp-add-project');
    if(addProjectBtn) addProjectBtn.onclick = ()=> renderAddProjectPickerModal();
    function renderAddProjectPickerModal(){
      const pw = document.createElement('div');
      pw.className = 'modal-bg';
      document.body.appendChild(pw);
      const pClose = ()=> pw.remove();
      function pRender(){
        // Danh sách phương án vay HỢP LỆ để thêm vào file đang sửa — chỉ gồm đang hoạt động + bị ẩn
        // (KHÔNG gồm đã tất toán/trả nợ trước hạn/đã xoá). Phương án nào ĐÃ hiện trong file (đang sửa)
        // rồi thì làm MỜ, không cho chọn lại (đã có rồi, không cần thêm nữa).
        const shownNames = new Set([...(result.borrowers||[]).map(b=>b.projectName), ...(result._pinnedExistingProjectNames||[]), ...(result.projects||[]).map(p=>p.name)]);
        const eligible = eligibleProjectsForBorrowerAssignment();
        pw.innerHTML = `
          <div class="modal" style="max-width:94vw; width:460px;">
            <div class="modal-head"><h3>➕ Thêm phương án vay</h3><button class="modal-close preview-allow" id="apk-close">✕</button></div>
            <div class="modal-body">
              <button type="button" class="btn btn-primary preview-allow" id="apk-new" style="width:100%; margin-bottom:16px;">✨ Thêm phương án vay mới</button>
              <p style="font-weight:700; margin:0 0 8px;">Hoặc chọn 1 phương án đã có sẵn:</p>
              ${eligible.length? eligible.map(p=>{
                const already = shownNames.has(p.name);
                return `<button type="button" class="preview-allow apk-pick" data-name="${escapeHtml(p.name)}" ${already?'disabled':''} style="display:block; width:100%; text-align:left; padding:9px 12px; margin-bottom:4px; border:1px solid var(--line); border-radius:8px; background:${already?'#f5f5f5':'#fff'}; color:${already?'#aaa':'#000'}; cursor:${already?'not-allowed':'pointer'}; font-size:13px;">${escapeHtml(p.name)}${already?' (đã có trong file này)':''}</button>`;
              }).join('') : `<p class="sub">Chưa có phương án vay nào trong hệ thống.</p>`}
            </div>
            <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="apk-close2">Đóng bảng</button></div>
          </div>`;
        pw.querySelector('#apk-close').onclick = pClose;
        pw.querySelector('#apk-close2').onclick = pClose;
        pw.querySelector('#apk-new').onclick = ()=>{
          pClose();
          // Tự sinh tên tạm không trùng với bất kỳ phương án nào (đã có sẵn hoặc đang trong bản nháp) —
          // người dùng có thể sửa lại ngay trong dòng thông tin phương án vừa hiện ra.
          const existingAndDraftNames = new Set([...existingProjectNames, ...(result.projects||[]).map(p=>p.name)]);
          let n = 1; let tempName = `Phương án mới ${n}`;
          while(existingAndDraftNames.has(tempName)){ n++; tempName = `Phương án mới ${n}`; }
          result.projects = result.projects || [];
          result.projects.push({ name:tempName, fundSourceType:'', interestRate:'', splitCentral:'', splitProvince:'', splitWard:'', hamletAllocPercent:'', disburseDate:'', dueDate:'', totalCapital:'' });
          result._manuallyEdited = true;
          // Lưu lại toàn bộ giá trị đang có trên form TRƯỚC khi vẽ lại — tránh mất các ký tự người dùng
          // đang gõ dở (lỗi kinh điển: vẽ lại toàn bộ HTML sẽ xoá sạch giá trị của các ô KHÔNG được lưu
          // vào state trước đó).
          const savedByKey = [];
          const savedProjByKey = [];
          wrap.querySelectorAll('[data-edit-b]').forEach(el=> savedByKey.push([el.dataset.editB, el.dataset.editK, el.value]));
          wrap.querySelectorAll('[data-proj-edit-idx]').forEach(el=> savedProjByKey.push([el.dataset.projEditIdx, el.dataset.projEditK, el.value]));
          render();
          savedByKey.forEach(([b2,k2,v2])=>{ const el=wrap.querySelector(`[data-edit-b="${b2}"][data-edit-k="${k2}"]`); if(el) el.value=v2; });
          savedProjByKey.forEach(([p2,k2,v2])=>{ const el=wrap.querySelector(`[data-proj-edit-idx="${p2}"][data-proj-edit-k="${k2}"]`); if(el) el.value=v2; });
          const newProjIdx = result.projects.length - 1;
          requestAnimationFrame(()=>{
            const el = wrap.querySelector(`input[data-proj-edit-k="name"][value="${tempName}"]`);
            if(el) el.scrollIntoView({ block:'center', behavior:'smooth' });
            // Nhấp nháy màu nền cho TẤT CẢ ô nhập liệu của đúng dòng phương án vay vừa được thêm mới.
            wrap.querySelectorAll(`[data-proj-edit-idx="${newProjIdx}"]`).forEach(fieldEl=> fieldEl.classList.add('new-field-flash'));
            // Nhảy múa (phóng to/thu nhỏ 10 lần) cho tiêu đề phương án vay vừa được thêm mới.
            const titles = wrap.querySelectorAll('p[style*="font-weight:800"]');
            for(const t of titles){ if(t.textContent.includes(tempName)){ t.classList.add('project-title-dance'); break; } }
          });
        };
        pw.querySelectorAll('.apk-pick').forEach(btn=> btn.onclick = ()=>{
          if(btn.disabled) return;
          const name = btn.dataset.name;
          result._pinnedExistingProjectNames = result._pinnedExistingProjectNames || [];
          if(!result._pinnedExistingProjectNames.includes(name)) result._pinnedExistingProjectNames.push(name);
          result._manuallyEdited = true;
          pClose();
          const savedByKey = [];
          const savedProjByKey = [];
          wrap.querySelectorAll('[data-edit-b]').forEach(el=> savedByKey.push([el.dataset.editB, el.dataset.editK, el.value]));
          wrap.querySelectorAll('[data-proj-edit-idx]').forEach(el=> savedProjByKey.push([el.dataset.projEditIdx, el.dataset.projEditK, el.value]));
          render();
          savedByKey.forEach(([b2,k2,v2])=>{ const el=wrap.querySelector(`[data-edit-b="${b2}"][data-edit-k="${k2}"]`); if(el) el.value=v2; });
          savedProjByKey.forEach(([p2,k2,v2])=>{ const el=wrap.querySelector(`[data-proj-edit-idx="${p2}"][data-proj-edit-k="${k2}"]`); if(el) el.value=v2; });
          // Cuộn tới đúng vị trí phương án vay đã có sẵn vừa được hiện ra trong file đang sửa.
          requestAnimationFrame(()=>{
            const titles = wrap.querySelectorAll('p[style*="font-weight:800"]');
            for(const t of titles){ if(t.textContent.includes(name)){ t.scrollIntoView({ block:'center', behavior:'auto' }); t.classList.add('project-title-dance'); break; } }
            // Nhấp nháy màu nền cho TẤT CẢ ô (xám, chỉ xem) của đúng dòng phương án vay đã có sẵn vừa
            // được ghim vào hồ sơ.
            wrap.querySelectorAll(`[data-proj-existing-name="${CSS.escape(name)}"]`).forEach(fieldEl=> fieldEl.classList.add('new-field-flash'));
          });
          showBigToast(`Đã thêm Phương án vay "${name}" vào file đang sửa.`);
        });
      }
      pRender();
    }
    wrap.querySelectorAll('[data-borrower-options]').forEach(btn=> btn.onclick = (e)=>{
      e.stopPropagation();
      const bIdx = parseInt(btn.dataset.borrowerOptions,10);
      renderBorrowerOptionsModal(bIdx);
    });
    function renderBorrowerOptionsModal(bIdx){
      const b = result.borrowers[bIdx];
      if(!b) return;
      const ow = document.createElement('div');
      ow.className = 'modal-bg';
      document.body.appendChild(ow);
      const oClose = ()=> ow.remove();
      function oRender(){
        // Danh sách phương án vay LUÔN cập nhật theo thời gian thực — gồm phương án ĐÃ CÓ SẴN (đang
        // hoạt động + bị ẩn, KHÔNG gồm đã tất toán/trả nợ trước hạn/đã xoá) LẪN phương án MỚI đang có
        // trong bản nháp này, không trùng lặp tên. Mỗi tên đều có ID riêng (theo nguồn gốc + index) để
        // có thể đồng bộ TRỰC TIẾP, KHÔNG ĐỘ TRỄ khi người dùng đang gõ sửa tên phương án ở nơi khác.
        const items = []; // { id, name }
        eligibleProjectsForBorrowerAssignment().forEach(p=> items.push({ id:`ex-${p.id}`, name:p.name }));
        (result.projects||[]).forEach((p,pi)=>{ if(p.name && !items.some(it=>it.name===p.name)) items.push({ id:`new-${pi}`, name:p.name }); });
        ow.innerHTML = `
          <div class="modal" style="max-width:94vw; width:420px;">
            <div class="modal-head"><h3>Tuỳ chọn cho: ${escapeHtml(b.name||'(chưa có tên)')}</h3><button class="modal-close preview-allow" id="bopt-close">✕</button></div>
            <div class="modal-body">
              <button type="button" class="btn btn-danger preview-allow" id="bopt-delete" style="width:100%; margin-bottom:16px;">🗑️ Xoá người vay này</button>
              <p style="font-weight:700; margin:0 0 8px;">Đổi người này sang phương án vay khác:</p>
              ${items.length? items.map(it=>`
                <label class="sv-filter-item" style="cursor:pointer;">
                  <input type="radio" name="bopt-project" value="${escapeHtml(it.name)}" ${b.projectName===it.name?'checked':''}>
                  <span id="bopt-name-${it.id}">${escapeHtml(it.name)}</span>
                </label>
              `).join('') : `<p class="sub">Chưa có phương án vay nào trong bản nháp.</p>`}
            </div>
            <div class="modal-foot">
              <button class="btn btn-ghost preview-allow" id="bopt-close2">Đóng bảng</button>
              <button class="btn btn-primary preview-allow" id="bopt-save">💾 Lưu thay đổi</button>
            </div>
          </div>`;
        ow.querySelector('#bopt-close').onclick = oClose;
        ow.querySelector('#bopt-close2').onclick = oClose;
        // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
        ow.querySelector('#bopt-delete').onclick = ()=>{
          const deletedProjName = b.projectName; // lưu lại TRƯỚC khi xoá, dùng để tìm đúng tiêu đề phương án cần nhảy múa
          result.borrowers = result.borrowers.filter((x,i)=> i!==bIdx);
          result._manuallyEdited = true;
          oClose();
          // Giữ nguyên đúng vị trí cuộn hiện tại — để sau khi xoá, màn hình đứng yên tại đúng chỗ vừa
          // xoá (hiện ra đúng nội dung nằm NGAY SAU người vay vừa bị xoá), không bị nhảy lên đầu trang.
          const scrollBody = wrap.querySelector('#qfp-modal-body');
          const savedBodyScroll = scrollBody ? scrollBody.scrollTop : null;
          const savedWinScroll = window.scrollY;
          render();
          requestAnimationFrame(()=>{
            const newBody = wrap.querySelector('#qfp-modal-body');
            if(newBody && savedBodyScroll!=null) newBody.scrollTop = savedBodyScroll;
            window.scrollTo({ top: savedWinScroll, behavior:'auto' });
            // Nhảy múa (phóng to/thu nhỏ 5 lần) cho tiêu đề phương án vay chứa người vừa bị xoá.
            if(deletedProjName){
              const titles = wrap.querySelectorAll('p[style*="font-weight:800"]');
              for(const t of titles){ if(t.textContent.includes(deletedProjName)){ t.classList.add('project-title-dance'); break; } }
            }
          });
          showBigToast(`Đã xoá người vay "${b.name||'(chưa có tên)'}" khỏi bản nháp.`);
        };
        ow.querySelector('#bopt-save').onclick = ()=>{
          const picked = ow.querySelector('input[name="bopt-project"]:checked');
          if(picked && picked.value!==b.projectName){
            b.projectName = picked.value;
            result._manuallyEdited = true;
            showBigToast(`Đã chuyển "${b.name||'(chưa có tên)'}" sang phương án vay "${picked.value}".`);
          }
          oClose();
          render();
          // Cuộn tới đúng dòng người vay này ở vị trí MỚI (sau khi đã chuyển sang phương án vay khác) —
          // tìm lại theo đúng chỉ số bIdx (không đổi khi chuyển phương án, chỉ đổi nhóm hiển thị).
          requestAnimationFrame(()=>{
            const el = wrap.querySelector(`[data-edit-b="${bIdx}"][data-edit-k="name"]`);
            if(el) el.closest('tr').scrollIntoView({ block:'center', behavior:'auto' });
          });
        };
      }
      oRender();
    }
    const editCancelBtn = wrap.querySelector('#qfp-edit-cancel');
    if(editCancelBtn) editCancelBtn.onclick = ()=>{ editMode = false; render(); };
    const editSaveBtn = wrap.querySelector('#qfp-edit-save');
    if(editSaveBtn) editSaveBtn.onclick = ()=>{
      // Lưu các trường thông tin PHƯƠNG ÁN VAY (chỉ áp dụng cho phương án MỚI, vì phương án đã có sẵn
      // luôn ở dạng chỉ-xem, không có input nào để sửa) — ghi nhớ tên CŨ trước khi ghi đè, để nếu tên
      // bị đổi thì đồng bộ lại "projectName" cho MỌI người vay đang thuộc phương án đó.
      const projRenameMap = {}; // tên cũ -> tên mới
      wrap.querySelectorAll('[data-proj-edit-idx]').forEach(input=>{
        const pIdx = parseInt(input.dataset.projEditIdx,10);
        const key = input.dataset.projEditK;
        const p = (result.projects||[])[pIdx];
        if(!p) return;
        const raw = input.value.trim();
        const oldName = p.name;
        // Sao chép ĐÚNG cách lưu từ form "Tạo phương án vay mới" thật:
        if(key==='disburseDate' || key==='dueDate') p[key] = raw; // input type="date" đã tự trả về đúng chuẩn YYYY-MM-DD sẵn, không cần tự chuyển đổi nữa
        else if(key==='totalCapital') p[key] = parseVNMoney(raw);
        else if(['interestRate','splitCentral','splitProvince','splitWard','hamletAllocPercent'].includes(key)) p[key] = parseVNPercent(raw);
        else p[key] = raw;
        if(key==='name' && oldName && raw && oldName!==raw) projRenameMap[oldName] = raw;
      });
      // Đồng bộ tên phương án vay MỚI cho mọi người vay đang thuộc phương án bị đổi tên — để dòng tiêu
      // đề phía trên VÀ cột "Phương án vay" của từng người vay luôn khớp đúng với tên mới nhất.
      if(Object.keys(projRenameMap).length){
        (result.borrowers||[]).forEach(b=>{ if(projRenameMap[b.projectName]) b.projectName = projRenameMap[b.projectName]; });
      }
      wrap.querySelectorAll('[data-edit-b]').forEach(input=>{
        const bIdx = parseInt(input.dataset.editB,10);
        const key = input.dataset.editK;
        const b = result.borrowers[bIdx];
        if(!b) return;
        const raw = input.value.trim();
        // Sao chép đúng cách lưu từ form "Thêm người vay mới" thật: tiền dùng parseVNMoney chuẩn của
        // app, còn CCCD/SĐT thì lưu nguyên chuỗi số (đã tự lọc sạch ký tự thừa ngay lúc đang gõ rồi).
        if(key==='principal') b[key] = parseVNMoney(raw);
        else b[key] = raw;
      });
      result._manuallyEdited = true;
      editMode = false;
      render();
      showBigToast('Đã lưu thành công các thay đổi thủ công!');
    };
    }
    render();
  }
  async function renderColumnViewSetModal(){

    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    if(!state.colViewSetTab) state.colViewSetTab = 'mau';
    if(!state.colViewSetExpanded) state.colViewSetExpanded = [];
    state._personalColViewSetsFirebase = await fetchPersonalColViewSetsFirebase();
    const TAB_COLORS2 = { mau:'#8d6e63', canhan:'#2e7d32', xaphuong:'#1565c0' };
    const TAB_LABELS2 = { mau:'Nhóm mẫu', canhan:'Nhóm cá nhân', xaphuong:'Nhóm xã phường' };
    const VS_TAB_EXPLAIN = {
      mau: `"Chế độ xem cột" là nơi lưu lại sẵn nhiều "Bộ xem cột" khác nhau — mỗi Bộ xem cột gồm 1 danh sách các cột đang hiển thị và đúng thứ tự của chúng. Thay vì phải vào "Tuỳ chỉnh cột" chỉnh lại từng cột mỗi lần, đồng chí chỉ cần bấm "Áp dụng" là bảng danh sách đổi ngay theo đúng bộ đã lưu. "Nhóm mẫu" chứa các Bộ xem cột có sẵn của hệ thống, không thể chỉnh sửa hay xoá.`,
      canhan: `"Nhóm cá nhân" chứa các Bộ xem cột do CHÍNH BẠN tạo ra, chỉ riêng đồng chí nhìn thấy và sử dụng được (người khác xem cùng mã xã sẽ không thấy các bộ này). Nếu đồng chí đã đăng nhập bằng tài khoản Google, các bộ này được lưu theo tài khoản của đồng chí — dù đăng nhập ở thiết bị nào hay vào mã xã nào khác cũng thấy lại được. Nếu chưa đăng nhập, các bộ này chỉ được lưu tạm trên chính trình duyệt đang dùng.`,
      xaphuong: `"Nhóm xã phường" chứa các Bộ xem cột dùng CHUNG cho TẤT CẢ mọi người đang xem mã xã này — ai cũng thấy và áp dụng được, nhưng chỉ người có quyền Sửa ở Sổ vay vốn mới được tạo mới, chỉnh sửa, đổi tên hay xoá.`,
    };
    let lastToastTab = null;
    function tabBtnsHtml(){
      return Object.keys(TAB_LABELS2).map(key=>{
        const active = state.colViewSetTab===key;
        const color = TAB_COLORS2[key];
        return `<button type="button" class="archive-tab-btn preview-allow ${active?'active':''}" data-vs-tab="${key}" style="${active?`background:${color}; border-color:${color}; color:#fff;`:''}">${TAB_LABELS2[key]}</button>`;
      }).join('');
    }
    function listForTab(tab){
      if(tab==='mau') return [getDefaultColumnViewSet(), getBasicLoanInfoColumnViewSet(), getBasicInterestColumnViewSet(), getInterestPaidUnpaidColumnViewSet(), getDetailedInterestColumnViewSet(), getBorrowerInfoColumnViewSet(), getAllPublicColumnsViewSet(), getHiddenColumnsViewSet()];
      if(tab==='canhan') return (state._personalColViewSetsFirebase||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
      return (state.columnViewSets||[]).filter(x=>x.group==='xaphuong').sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    }
    function fullVsName(vs){ const base = vs.group==='mau' ? vs.name : `Bộ xem cột ${vs.name}`; return `${base} (${(vs.visible||[]).length})`; }
    function presetRowHtml(vs){
      const expanded = state.colViewSetExpanded.includes(vs.id);
      const cols = BORROWER_COLUMNS();
      const labels = vs.order.filter(k=>vs.visible.includes(k)).map(k=>{ const c=cols.find(x=>x.key===k); return c? c.label.replace(/<br\s*\/?>/g,' ') : k; });
      const canEditThis = vs.group==='xaphuong' ? canEditModule('data') : true;
      return `<div style="border:1px solid var(--line); border-radius:8px; margin-bottom:8px; overflow:hidden;">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" data-vs-toggle="${vs.id}" style="width:100%; text-align:left; border:none; border-radius:0;">📐 ${escapeHtml(fullVsName(vs))} ${expanded?'▴':'▾'}</button>
        ${expanded? `<div style="padding:10px 14px; border-top:1px solid var(--line);">
          <p class="sub" style="line-height:1.6;">${labels.map(escapeHtml).join(' | ')}</p>
          <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-sm preview-allow" data-vs-apply="${vs.id}">Áp dụng</button>
            ${vs.group!=='mau' && canEditThis? `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-vs-edit="${vs.id}">Chỉnh sửa</button>` : ''}
            ${vs.group!=='mau' && canEditThis? `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-vs-rename="${vs.id}">✏️ Đổi tên</button>` : ''}
            ${vs.group!=='mau' && !canEditThis? `<span class="sub">Cần có quyền Sửa ở Sổ vay vốn mới được chỉnh sửa/đổi tên Bộ xem cột thuộc Nhóm xã phường.</span>` : ''}
          </div>
        </div>` : ''}
      </div>`;
    }
    function render(){
      const tab = state.colViewSetTab;
      if(tab!==lastToastTab){ lastToastTab = tab; showTabSwitchToast(TAB_LABELS2[tab]||''); }
      const list = listForTab(tab);
      const color = TAB_COLORS2[tab];
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:700px; border:6px solid ${color};">
          <div class="modal-head modal-head-stack-narrow" style="background:linear-gradient(180deg, #ffe082 0%, #ffca28 50%, #ff8f00 100%); display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <h3 style="color:#000;">${waveTextHtmlSlow('👁️ Chế độ xem cột')}</h3>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="display:flex; border:2px solid #fbc02d; padding:2px;">${tabBtnsHtml()}</div>
              <button class="modal-close preview-allow" id="vs-close">✕</button>
            </div>
          </div>
          <div class="modal-body" style="max-height:70vh; overflow:auto;">
            <p class="sub" style="line-height:1.7; margin-bottom:10px;">${VS_TAB_EXPLAIN[tab]}</p>
            <div style="background:${color}; color:#fff; font-weight:800; padding:8px 14px; border-radius:8px; margin-bottom:12px;">${TAB_LABELS2[tab].toUpperCase()}</div>
            ${list.length? list.map(presetRowHtml).join('') : `<p class="sub">Chưa có Bộ xem cột nào trong nhóm này.</p>`}
          </div>
          <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
            <button class="btn btn-ghost preview-allow" id="vs-close2">Đóng bảng</button>
            <div class="modal-foot-tabs" style="display:flex; border:2px solid #fbc02d; padding:2px;">${tabBtnsHtml()}</div>
          </div>
        </div>`;
      wrap.querySelector('#vs-close').onclick = close;
      wrap.querySelector('#vs-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelectorAll('[data-vs-tab]').forEach(btn=> btn.onclick = ()=>{ state.colViewSetTab = btn.dataset.vsTab; render(); });
      wrap.querySelectorAll('[data-vs-toggle]').forEach(btn=> btn.onclick = ()=>{
        const id = btn.dataset.vsToggle;
        const opening = !state.colViewSetExpanded.includes(id);
        state.colViewSetExpanded = state.colViewSetExpanded.includes(id) ? state.colViewSetExpanded.filter(x=>x!==id) : state.colViewSetExpanded.concat([id]);
        render();
        if(opening) setTimeout(()=>{
          const applyBtn = wrap.querySelector(`[data-vs-apply="${id}"]`);
          if(applyBtn) applyBtn.scrollIntoView({behavior:'smooth', block:'center'});
          else { const h = wrap.querySelector(`[data-vs-toggle="${id}"]`); if(h) h.scrollIntoView({behavior:'smooth', block:'start'}); }
        }, 50);
      });
      wrap.querySelectorAll('[data-vs-apply]').forEach(btn=> btn.onclick = ()=>{
        const vs = list.find(x=>x.id===btn.dataset.vsApply);
        if(!vs) return;
        state.borrowerVisibleCols = vs.visible.slice();
        state.borrowerColumnOrder = vs.order.slice();
        state._appliedColumnViewSetId = vs.id;
        saveLastAppliedColumnView(vs.id, vs.group, vs.visible, vs.order); // ghi nhớ đây là bộ xem cột ÁP DỤNG GẦN NHẤT (bất kể thuộc nhóm nào) — để lần sau vào lại app tự động hiện đúng bộ này
        close();
        const el = document.getElementById('content');
        if(el) renderDataTab(el);
        showBigToast(`Đã áp dụng Bộ xem cột "${vs.name}"`);
      });
      wrap.querySelectorAll('[data-vs-edit]').forEach(btn=> btn.onclick = ()=>{
        const vs = list.find(x=>x.id===btn.dataset.vsEdit);
        if(!vs) return;
        close();
        state.borrowerColPickerDraftVisible = vs.visible.slice();
        state.borrowerColPickerDraftOrder = vs.order.slice();
        state.colViewSetEditingPreset = { id: vs.id, name: vs.name, group: vs.group };
        renderColumnPickerModal();
      });
      wrap.querySelectorAll('[data-vs-rename]').forEach(btn=> btn.onclick = ()=>{
        const vs = list.find(x=>x.id===btn.dataset.vsRename);
        if(!vs) return;
        renderRenameColumnViewSetDialog(vs, ()=> render());
      });
    }
    render();
  }
  async function commitBorrowerColumnPicker(mode){
    // mode: 'save' (áp dụng ngay cho bảng, việc lưu thành Bộ xem cột do bảng đặt tên xử lý tiếp theo)
    // | 'view' (chỉ xem, không lưu) | 'default' (khôi phục gốc)
    const draftVisible = mode==='default' ? defaultVisibleBorrowerCols() : state.borrowerColPickerDraftVisible;
    const draftOrder = mode==='default' ? normalizeBorrowerColumnOrder(BORROWER_COLUMNS().map(c=>c.key)) : state.borrowerColPickerDraftOrder;
    state.borrowerVisibleCols = draftVisible.slice();
    state.borrowerColumnOrder = draftOrder.slice();
    if(mode==='view'){
      showToast('Đã áp dụng tạm thời cho lượt xem này, chưa lưu lại.');
    } else if(mode==='default'){
      showToast('Đã khôi phục cài đặt cột về mặc định (chỉ áp dụng cho lượt xem này).');
    }
    state.showColumnPicker = false;
    state.borrowerColPickerDraftVisible = null;
    state.borrowerColPickerDraftOrder = null;
  }

