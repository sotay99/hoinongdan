  // ---------- expense categories (Chi tiêu xã) ----------
  // Dùng KHOÁ nội bộ ổn định (không chứa danh xưng địa phương) để lưu trữ dữ liệu;
  // nhãn hiển thị (label) được suy ra động theo danh xưng đã cấu hình.
  const CAT_HAMLET = 'CAT_HAMLET_ALLOC';
  const CAT_MEETING = 'CAT_MEETING';
  const CAT_SUPPLIES = 'CAT_SUPPLIES';
  const CAT_TRAINING = 'CAT_TRAINING';
  const CAT_BONUS = 'CAT_BONUS';
  const CAT_OTHER = 'CAT_OTHER';
  const EXPENSE_CATEGORIES = [CAT_HAMLET, CAT_MEETING, CAT_SUPPLIES, CAT_TRAINING, CAT_BONUS, CAT_OTHER];
  // Giá trị chữ Việt CŨ (bản trước khi có danh xưng động) — giữ lại để nhận diện
  // dữ liệu đã lưu từ trước, tránh mất/lệch dữ liệu cũ khi nâng cấp phần mềm.
  const LEGACY_CAT_HAMLET = 'Trích về cho các khu dân cư/Ấp';
  function isCatHamlet(purpose){ return purpose===CAT_HAMLET || purpose===LEGACY_CAT_HAMLET; }
  // Nhãn hiển thị động cho từng mục đích chi — dùng cho giao diện & file xuất
  function categoryLabel(cat){
    if(isCatHamlet(cat)) return `Trích về cho các ${subAdminLabelLower()}`;
    switch(cat){
      case CAT_MEETING: return 'Chi họp hành / Hội nghị';
      case CAT_SUPPLIES: return 'Mua văn phòng phẩm';
      case CAT_TRAINING: return 'Chi công tác tập huấn';
      case CAT_BONUS: return 'Chi bồi dưỡng cán bộ hoạt động quỹ';
      case CAT_OTHER: return 'Chi khác';
      default: return cat;
    }
  }

  // ---------- app state ----------
  let state = {
    view:'boot',
    identity:null,        // {email, name, photo, wardId} — wardId có thể rỗng (chưa chọn xã nào)
    config:null,          // shared core config (của mã xã đang active)
    borrowers:[],
    expenses:[],          // shared: khoản chi tiêu xã
    trash:[],
    log:[],
    collaborators:{},     // shared {email: {name, role}} (của mã xã đang active)
    myWards:[],           // Ví của tài khoản: [{wardId, kind:'owner'|'guest', wardName, av, live:{...}}]
    myDeletedWards:[],    // Thùng rác cấp tài khoản: các mã xã do CHÍNH mình làm Chủ và đã xoá
    sysTrash:[],          // Thùng rác hệ thống (chỉ site owner thấy) — các mã đã bị xoá vĩnh viễn
    permanentlyDeletedBorrowers:[], // Người vay đã bị xoá VĨNH VIỄN khỏi Thùng rác (Sổ vay vốn) — vẫn
                                     // được LƯU LẠI vĩnh viễn ở đây (chỉ đọc, không hiện lại được ở
                                     // đâu khác) để không làm mất dấu vết Biên lai/Giấy xác nhận/Nhật
                                     // ký của họ trong Kho lưu trữ.
    borrowerReceipts:{},            // { [borrowerId]: [ {id,categoryKey,amount,sign,...} ] } — Kho Biên lai
    borrowerConfirmations:{},       // { [borrowerId]: [ {id,kind,title,details,...} ] } — Kho Giấy xác nhận
    sharedConfirmationDocuments:[], // Kho Giấy xác nhận CHUNG (1 bản ghi, nối link vào nhiều người)
    sharedBorrowerReceipts:[],      // Kho Biên lai CHUNG (1 bản ghi, nối link vào nhiều người)
    columnViewSets:[],              // "Chế độ xem cột" — Nhóm cá nhân + Nhóm xã phường (Nhóm mẫu là hằng số, không lưu Firebase)
    columnViewSetLog:[],            // Nhật ký tạo/sửa/đổi tên/xoá Bộ xem cột
    loanColorLog:[],                 // Nhật ký tạo/sửa Bộ màu
    categoryChangeLog:[],           // Nhật ký tạo/sửa tên phân loại biên lai
    quarterStatusLog:{},            // { [borrowerId]: [ {id,key,label,direction,reason,at} ] } — Lịch sử trạng thái Quý
    activeTab:'dashboard',
    reportMode:'quarter',
    reportQuarter:'q1',
    reportFrom:'', reportTo:'',
    reportScope:'all', reportScopeVal:'',
    search:'',
    filterHamlets:null, filterProjectIds:null,           // đa chọn Ấp/Phương án vay — null = chưa khởi tạo, mặc định chọn hết
    filterQuarters:null, filterQuartersAdvanced:false,    // đa chọn Quý liền kề
    filterYears:null, filterYearsAdvanced:false,          // đa chọn Năm liền kề
    openFilterDropdown:null,                              // 'hamlet' | 'project' | 'quarter' | 'year' | null — dropdown nào đang mở
    loanProjects:[],           // Danh sách "Phương án vay" — secretdata/{secretId}/loanProjects
    selectedProjectRow:null,   // id Phương án đang được tích chọn để hiện nút "+ Thêm người vay"
    borrowerVisibleCols:null,  // mảng key cột đang hiển thị ở Sổ vay vốn (null = chưa khởi tạo, dùng mặc định)
    borrowerColumnOrder:null,  // mảng key TOÀN BỘ cột theo đúng thứ tự tự sắp xếp (kéo-thả) — null = dùng mặc định
    borrowerColumnPrefsShared:null, // {visible,order} đã lưu dùng chung của xã (tải qua realtime bind)
    borrowerColPickerDraftVisible:null, // bản NHÁP đang thao tác trong khung tuỳ chỉnh cột (chưa áp dụng vào bảng)
    borrowerColPickerDraftOrder:null,
    showColumnPicker:false,    // đang mở khu vực tick chọn cột hay không
    showLoanApprovalDetails:false, // đang mở khung "Xem thông tin chi tiết số tiền phê duyệt đóng lãi và thanh toán khoản vay"
    showInterestApprovalModal:false,   // đang mở modal "Tính tiền lãi và phê duyệt đóng lãi"
    loanExtensions:null,               // {[borrowerId]: [{from,to,rateType,ratePct,allocMode,...}]} đã lưu chung của xã
    interestPaymentBoxes:null,         // {[borrowerId]: {totalPaid, payments:{boxKey:amount}}} — "Hộp tiền đóng lãi"
    receiptCategoriesPayment:null,     // [{id,name,color}] — tên phân loại cho 2 loại biên lai THU tiền lãi
    settledExpandedRange:null,         // null | '5y' | 'older' — panel "Đã tất toán/TNTH xong" đang xem theo mốc nào
    receiptCategoriesRefund:null,      // [{id,name,color}] — tên phân loại cho 2 loại biên lai TRẢ tiền lãi
    borrowerManagers:null,             // [{id,name}] — danh sách "Người quản lý hộ vay" (mặc định Chi hội trưởng/Chi hội phó không xoá được)
    filterFundSources:null, filterManagerIds:null, // 2 bộ lọc mới: Nguồn vay / Người quản lý
    showExtensionModal:false,          // đang mở modal "Gia hạn nợ"
    interestApprovals:null,            // {[filterKey]: {[borrowerId]:true}} đã lưu chung của xã (tải qua realtime bind)
    interestApprovalDraft:null,        // Set borrowerId đang tích chọn trong modal (chưa lưu)
    interestApprovalDraftKey:null,     // filterKey mà draft hiện tại thuộc về
    iaVisibleCols:null, iaColumnOrder:null,        // cột riêng của modal phê duyệt
    iaColPickerDraftVisible:null, iaColPickerDraftOrder:null, showIAColumnPicker:false,
    iaColumnPrefsShared:null,
    hiddenColDocsOpenSystem:null, hiddenColDocsOpenCol:null, // đang mở hệ thống/cột ẩn nào ở tab Cài đặt
    showLoanTrash:false,       // mở/đóng khung Thùng rác riêng của Sổ vay vốn
    loanTrashExpandedId:null,  // id gói thùng rác Phương án vay đang mở xem danh sách người vay bên trong
    showExpenseTrash:false,    // mở/đóng khung Thùng rác riêng của Chi tiêu
    // ---- Module [Biểu mẫu / Khảo sát / Bài kiểm tra] ----
    surveys:[],                 // danh sách biểu mẫu của KHÔNG GIAN đang xem (dùng chung hoặc cá nhân)
    surveySpace:'personal',     // 'shared' | 'personal' — mặc định luôn vào Bộ cá nhân trước
    surveyView:'list',          // 'list' | 'editor'
    surveyEditingId:null,       // id biểu mẫu đang mở để sửa (null = đang tạo mới, chưa lưu lần nào)
    surveyDraft:null,           // bản nháp đang chỉnh sửa trong Editor (chưa chắc đã lưu)
    surveyEditorTab:'questions',// 'questions' | 'answers'
    surveyResponses:[],         // câu trả lời của ĐÚNG biểu mẫu đang xem Tab [Câu trả lời]
    surveyResponseViewIndex:0,  // đang xem phiếu trả lời số mấy (điều hướng Tới/Lui)
    surveyResponseDetailOpen:false, // đang mở xem chi tiết 1 phiếu hay đang xem tổng hợp
    surveyImportPickerOpen:false,
    acctMode:'year',       // kỳ hạch toán xã: 'ycur' | 'yprev' | 'quarter' | 'all'
    acctQuarter:'q1',
    expAcctFilterQuarters:['q1'], // dùng riêng cho chế độ "Chọn Quý cụ thể" — có thể chọn nhiều Quý Q1-Q4
    expAcctFilterYears:[new Date().getFullYear()], // dùng riêng cho chế độ "Chọn Quý cụ thể" — có thể chọn nhiều Năm
    expSearch:'', expFilterCat:'',
    modal:null,           // {type:'borrower'|'expense'|'onboarding'|'settings'|'trashConfirm', payload}
    bellOpen:false,
    walletTrashOpen:false,
    previewMode:false,   // môi trường tham quan (không đăng nhập, dùng dữ liệu mẫu, mọi nút bấm bị vô hiệu hoá)
    accessMode:'signed_out', // 'signed_out' | 'google' | 'ward_guest' | 'tour'
    guestSessionId:null,     // phiên khách theo tab; không phải danh tính người dùng
    admins:{},            // {emailKey: {email, addedBy, addedAt}} — danh sách Admin (ngoài 2 Admin tối cao cố định)
    aiProviders:[],       // [{id, label, model, apiKey}] — cấu hình AI do Admin thiết lập (system_config/ai_providers)
    systemWardsIndex:[],  // [{wardId, wardName, ownerEmail, deleted, secretId, updatedAt}] — mục lục toàn hệ thống (Admin)
    _adminViewingWard:false, // Admin đang "Xem cơ sở dữ liệu" (chỉ đọc) của 1 mã xã không phải của mình
    aiChats:[],            // [{id, title, messages:[{role,text,time,attachments}], updatedAt}] — lịch sử chat AI của tài khoản
    aiActiveChatId:null,
    aiSending:false,
    _aiChatOpen:false,
    aiActiveProviderId:null,   // id cấu hình AI (model) đang được chọn để làm việc
    _aiModelMenuOpen:false,    // dropdown chọn model đang mở hay không
    _aiAddMenuOpen:false,      // dropdown "THÊM THÀNH PHẦN" đang mở hay không
    aiPendingAttachments:[],   // [{name, mimeType, base64}] — tệp/ảnh đã chọn, chờ gửi kèm tin nhắn tiếp theo
    aiWebSearchOn:false,       // bật/tắt chế độ tìm kiếm web (Google Search grounding) cho các tin nhắn tiếp theo
    _aiMicListening:false,     // đang thu âm giọng nói hay không
    _aiBubbleEditingIndex:null,   // index tin nhắn người dùng đang được sửa (null = không sửa)
    // ---- Module [Tạo bài Tuyên truyền] — bản sao kiến trúc Chat AI, vai biên tập viên tuyên truyền ----
    propagandaChats:[], propagandaActiveChatId:null, propagandaSending:false,
    propagandaPendingAttachments:[], propagandaWebSearchOn:false, _propagandaMicListening:false,
    _propagandaModelMenuOpen:false, _propagandaAddMenuOpen:false, _propagandaSuggestMenuOpen:false, propagandaActiveProviderId:null,
    _propagandaBubbleEditingIndex:null,
    _propagandaChatsLoaded:false, _pgOutsideClickBound:false,
    aiAbortController:null, propagandaAbortController:null,
    _showWardWelcome:false,    // Yêu cầu 1: hiện bảng chào mừng mỗi khi bắt đầu phiên xem 1 mã định danh
    knowledgeTree:{},          // {id: node} — toàn bộ cây thư mục/tệp tri thức nền cho AI (system_knowledge/tree)
    knowledgeCurrentFolder:null, // id thư mục đang mở (null = thư mục gốc)
    knowledgeTrashOpen:false,
    knowledgeEditingId:null,   // id file văn bản đang mở trong khung soạn thảo (null = không mở)
    knowledgeUploading:false,
    _systemKnowledgeCache:null, _systemKnowledgeCacheAt:0, // bộ nhớ đệm "Bối cảnh tri thức" cho AI
    // ---- Công cụ văn phòng ----
    _officeMenuOpen:false,  // menu thả xuống "Công cụ văn phòng" ở khung menu trái đang mở hay không
    _officeAppOpen:null,    // null | 'Docs' | 'Sheets' | 'Slides' — overlay toàn màn hình đang mở
    // ---- Ghi chú nhanh (cá nhân hoá theo tài khoản) ----
    _quickNoteOpen:false,
    quickNotePendingAttachments:[], // [{name, mimeType, base64, file}] — tệp chờ AI tiêu hoá
    quickNoteProcessing:false,
    quickNoteProcessingMsg:'',
    quickNotePendingFiles:[], // [File] — tệp đã chọn, đang chờ trong ô nhập (chưa gửi xử lý)
    quickNoteAbortController:null, // dùng để Dừng lại giữa chừng khi AI đang tiêu hoá
    quickNoteJustCompleted:false,  // hiện banner "Đã xong!" — giờ KHÔNG tự ẩn nữa (do AI "nói")
    quickNoteJustCompletedMsg:'',  // nội dung banner hoàn tất (do AI nói)
    quickNoteReviewMode:false,     // đang ở bước xác nhận trước khi tiêu hoá/bỏ qua
    quickNoteReviewText:'',        // văn bản đã gộp trong lúc chờ xác nhận (dùng khi gửi thật cho AI/lưu thẳng)
    quickNoteReviewFiles:[],       // tệp đã gộp trong lúc chờ xác nhận (dùng khi gửi thật cho AI/lưu thẳng)
    quickNoteReviewTurns:[],       // TỪNG LƯỢT gửi riêng biệt {text, files} — dùng để HIỂN THỊ LẠI đầy đủ như 1 đoạn chat thật (mỗi lần gửi là 1 bong bóng riêng), không bị gộp mất cấu trúc
    quickNoteStoppedConfirm:false, // đang hỏi "có muốn đưa thẳng vào ghi chú không" sau khi Dừng
    _qnDraftText:'', _qnDraftCaptureSuppressed:false,
    _qnInFlightText:'', _qnInFlightFiles:[], _qnInFlightParentId:null,
    _quickNoteCache:null, _quickNoteCacheAt:0,
    // ---- Drive Hub (metadata của app; file Google Drive chỉ là liên kết) ----
    driveSpace:'personal',       // 'personal' | 'shared'
    driveResources:{},
    driveCurrentFolder:null,
    driveSearch:'',
    driveTrashOpen:false,
    driveListMode:'grid',
    driveSort:'name',
    driveLoading:false,
    driveLoadError:'',
  };

  // Trạng thái truy cập tường minh cho các module mới. `previewMode` vẫn được giữ để tương thích
  // với các guard cũ trong toàn bộ ứng dụng.
  const ACCESS_MODES = Object.freeze({
    SIGNED_OUT:'signed_out',
    GOOGLE:'google',
    WARD_GUEST:'ward_guest',
    TOUR:'tour',
  });
  function isTourMode(){ return state.accessMode===ACCESS_MODES.TOUR || !!state.previewMode; }
  function isGoogleAccess(){ return state.accessMode===ACCESS_MODES.GOOGLE || !!(state.identity && state.identity.email); }
  function isWardGuestAccess(){ return state.accessMode===ACCESS_MODES.WARD_GUEST || (!!state.identity && !state.identity.email && !!wardId() && !state.previewMode); }
  function hasAuthenticatedIdentity(){ return !!(state.identity && state.identity.email); }
  function accessModeLabel(){
    if(isTourMode()) return 'Môi trường tham quan';
    if(isWardGuestAccess()) return 'Khách qua mã xã/phường';
    if(isGoogleAccess()) return isOwner() ? 'Chủ mã' : 'Tài khoản Google';
    return 'Chưa đăng nhập';
  }
  function blockTourMutation(message){
    if(!isTourMode()) return false;
    alert(message || 'Đồng chí đang ở môi trường tham quan. Thao tác này không tạo dữ liệu thật.');
    return true;
  }

  // =====================================================================
  // ---------- HỆ PHÂN QUYỀN MỚI (module-based, thay cho collaborators cũ) ----
  // Mỗi mã xã có 2 lớp chia sẻ, lưu trong config:
  //   config.publicPerms = {data,members,strength,internal} -> 'none'|'view'|'edit'
  //     áp dụng cho BẤT KỲ ai vào bằng đúng Mã định danh + mật khẩu (kể cả không đăng nhập Google)
  //   config.grants = { [emailKey]: {email, data,members,strength,internal,settings} }
  //     áp dụng riêng cho MỘT tài khoản Google cụ thể (Loại 2 — chia sẻ đích danh),
  //     override lên trên publicPerms; "settings" chỉ có ở đây, không có ở publicPerms.
  // Chủ mã (config.ownerEmail đúng bằng email đang đăng nhập) luôn full quyền mọi nơi.
  // =====================================================================
  const SHARE_MODULES = [
    {key:'data', label:'Sổ vay vốn'},
    {key:'members', label:'Hồ sơ hội viên'},
    {key:'strength', label:'Thực lực Hội'},
    {key:'internal', label:'Thu – Chi nội bộ'},
    {key:'survey', label:'Biểu mẫu/Khảo sát (Bộ dùng chung)'},
  ];
  const PERM_OPTIONS = [
    {v:'none', label:'Không được xem'},
    {v:'view', label:'Được quyền xem'},
    {v:'edit', label:'Được quyền sửa'},
  ];
  function isOwner(){
    return !!(state.identity && state.identity.email && state.config && state.identity.email === state.config.ownerEmail);
  }
  // Modal "Thông tin Tài khoản nhận tiền của xã/phường" — 3 khung (Tên tài khoản/Ngân hàng/Số tài
  // khoản) sửa ĐỘC LẬP nhau, mỗi khung tự khoá/mở khi Sửa/Lưu/Huỷ riêng. Lưu vào state.config (đám
  // mây, dùng chung toàn xã) — dữ liệu này dùng để sau này tạo mã QR chuyển khoản khi chia sẻ biên lai.
  const WARD_BANK_FIELDS = [
    { key:'accountName', label:'Tên tài khoản', maxLen:30 },
    { key:'bankName', label:'Ngân hàng', maxLen:30 },
    { key:'accountNumber', label:'Số tài khoản', maxLen:30 },
    { key:'phone', label:'Số điện thoại liên hệ', maxLen:12, phoneMode:true },
  ];
  function renderWardBankInfoModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const FIELDS = WARD_BANK_FIELDS;
    let editing = { accountName:false, bankName:false, accountNumber:false };
    function currentVal(key){ return (state.config.bankInfo && state.config.bankInfo[key]) || ''; }
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:520px;">
          <div class="modal-head"><h3>💳 Thông tin Tài khoản nhận tiền của xã/phường</h3><button class="modal-close preview-allow" id="wbi-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin-top:0;">Thông tin này sẽ dùng để tạo mã QR chuyển khoản khi chia sẻ Biên lai qua đường link. Để thanh toán online tự động trong Sổ vay vốn Quỹ Hỗ trợ Nông dân.</p>
            <p class="sub" style="color:#b71c1c; font-weight:700;">Chỉ có chủ nhân của mã xã/phường này mới có quyền sửa thông tin Tài khoản của xã/phường.</p>
            <button type="button" class="btn preview-allow" id="wbi-autopay-btn" style="width:100%; margin-bottom:16px; padding:12px; background:linear-gradient(90deg, #7c4dff 0%, #4527a0 100%); color:#fff; font-weight:700; border:none; border-radius:8px;">⚙️ Cài đặt Chế độ nhận tiền tự động không cần người duyệt thủ công</button>
            ${FIELDS.map(f=>`
              <div class="field full" style="margin-bottom:14px;">
                <label>${f.label}</label>
                <div style="display:flex; gap:8px; align-items:center;">
                  <input type="text" maxlength="${f.maxLen||30}" ${f.phoneMode?'inputmode="tel"':''} id="wbi-${f.key}" value="${escapeHtml(currentVal(f.key))}" ${editing[f.key]?'':'disabled'} style="flex:1;">
                  ${editing[f.key]? `
                    <button type="button" class="btn btn-ghost btn-sm preview-allow" data-wbi-cancel="${f.key}">Huỷ</button>
                    <button type="button" class="btn btn-primary btn-sm preview-allow" data-wbi-save="${f.key}">Lưu</button>
                  ` : `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-wbi-edit="${f.key}">✏️ Sửa</button>`}
                </div>
              </div>`).join('')}
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="wbi-close2">Đóng bảng</button></div>
        </div>`;
      wrap.querySelector('#wbi-close').onclick = close;
      wrap.querySelector('#wbi-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelector('#wbi-autopay-btn').onclick = ()=> alert('🚧 "Chế độ nhận tiền tự động không cần người duyệt thủ công" đang được thiết kế, sẽ hoàn thiện ở bước sau.');
      wrap.querySelectorAll('[data-wbi-edit]').forEach(btn=> btn.onclick = ()=>{ editing[btn.dataset.wbiEdit] = true; render(); });
      wrap.querySelectorAll('[data-wbi-cancel]').forEach(btn=> btn.onclick = ()=>{ editing[btn.dataset.wbiCancel] = false; render(); });
      wrap.querySelectorAll('[data-wbi-save]').forEach(btn=> btn.onclick = async ()=>{
        const key = btn.dataset.wbiSave;
        const fdef = FIELDS.find(f=>f.key===key);
        let val = wrap.querySelector(`#wbi-${key}`).value.trim().slice(0, fdef.maxLen||30);
        if(fdef.phoneMode){
          if(val && !/^\+?\d+$/.test(val)){ alert('Số điện thoại liên hệ chỉ được chứa chữ số và tối đa 1 dấu "+" ở đầu.'); return; }
        }
        state.config.bankInfo = { ...(state.config.bankInfo||{}), [key]: val };
        await cSet('config', state.config);
        editing[key] = false;
        render();
        showToast('Đã lưu thành công!');
      });
    }
    render();
  }
  // ==== HẠ TẦNG "GỬI ĐƯỜNG LINK THANH TOÁN" — dùng cho các biên lai THU TIỀN VỀ xã/phường (thu lãi,
  // trả nợ trước hạn, tất toán, thu lãi của hộ đã tất toán còn nợ) — KHÔNG dùng cho biên lai hoàn trả
  // lại tiền cho hộ vay. ====
  function wardBankInfoReadOnlyHtml(){
    const cur = k=> (state.config.bankInfo && state.config.bankInfo[k]) || '(chưa cài đặt)';
    return `
      <p class="sub" style="margin-top:0;">Thông tin này sẽ dùng để tạo mã QR chuyển khoản khi chia sẻ Biên lai qua đường link. Để thanh toán online tự động trong Sổ vay vốn Quỹ Hỗ trợ Nông dân.</p>
      <button type="button" class="btn preview-allow" id="spl-autopay-btn" style="width:100%; margin-bottom:10px; padding:12px; background:linear-gradient(90deg, #7c4dff 0%, #4527a0 100%); color:#fff; font-weight:700; border:none; border-radius:8px;">⚙️ Cài đặt Chế độ nhận tiền tự động không cần người duyệt thủ công</button>
      <p class="sub">Nếu bấm vào "<span style="color:#0d47a1; font-weight:700;">Tiếp tục tạo mã QR</span>" thì mã QR kèm thông tin chuyển khoản sẽ được gắn vào trong Biên Lai, Biên Lai này sẽ ở trong "Hộp Biên lai chưa thanh toán", cho đến khi được Thanh toán thành công thì Biên Lai sẽ tự động chuyển trạng thái và đi vào trong hộp Biên lai của hộ vay tương ứng.</p>
      ${WARD_BANK_FIELDS.map(f=>`<div class="kv-row"><span>${f.label}</span><b>${escapeHtml(cur(f.key))}</b></div>`).join('')}
      <p class="sub" style="color:#b71c1c; font-weight:700; margin-top:10px;">Chỉ có chủ nhân của mã xã/phường này mới có quyền sửa thông tin Tài khoản của xã/phường, vào mục cài đặt và chia sẻ để sửa thông tin tài khoản này.</p>`;
  }
  // paymentCtx: { title, amount, borrowerNames:[], categoryKey } — thông tin cần cho biên lai CHƯA
  // THANH TOÁN. onCancel() được gọi khi bấm "Quay lại" (đóng modal, quay về biên lai đang lập).
  function renderSendPaymentLinkModal(paymentCtx, onCancel){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal-head"><h3>💳 Thông tin Tài khoản nhận tiền của xã/phường</h3><button class="modal-close preview-allow" id="spl-close">✕</button></div>
        <div class="modal-body">${wardBankInfoReadOnlyHtml()}</div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="spl-back">Quay lại</button>
          <button class="btn btn-primary preview-allow" id="spl-continue">Tiếp tục tạo mã QR nhận tiền</button>
        </div>
      </div>`;
    const doCancel = ()=>{ close(); if(onCancel) onCancel(); };
    wrap.querySelector('#spl-close').onclick = doCancel;
    wrap.querySelector('#spl-back').onclick = doCancel;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#spl-autopay-btn').onclick = ()=> alert('🚧 "Chế độ nhận tiền tự động không cần người duyệt thủ công" đang được thiết kế, sẽ hoàn thiện ở bước sau.');
    wrap.querySelector('#spl-continue').onclick = async ()=>{
      const bi = state.config.bankInfo || {};
      const missing = WARD_BANK_FIELDS.filter(f=> !String(bi[f.key]||'').trim()).map(f=>f.label);
      if(missing.length){ alert(`Không thể tạo mã QR vì đang thiếu thông tin: ${missing.join(', ')}. Vui lòng vào Cài đặt & Chia sẻ để thiết lập đầy đủ trước.`); return; }
      close();
      await createUnpaidReceiptAndShowLink(paymentCtx);
    };
  }
  async function createUnpaidReceiptAndShowLink(paymentCtx){
    const code = uid();
    const cfg = state.config||{};
    const wardLabel = `${adminLevelLabel()} ${(cfg.wardName||'').trim()}`.trim();
    const provType = PROVINCE_TYPE_OPTIONS.includes(cfg.provinceType) ? cfg.provinceType : 'Tỉnh/Thành phố';
    const provinceLabel = (cfg.provinceName||'').trim() ? `${provType} ${(cfg.provinceName||'').trim()}` : '';
    // Chụp lại ĐÚNG nội dung đang lập (các quý/tiền lãi/người đóng-thu...) — y hệt cách "Đường link"
    // của biên lai đã lập thành công chụp lại nội dung modal, để không bị sơ sài chỉ có tổng tiền.
    let bodyHtml = '';
    if(paymentCtx.contentEl){
      const clone = cleanReceiptContentClone(paymentCtx.contentEl);
      // Chèn thêm "Người lập biên lai/Email/Địa chỉ IP/Thiết bị" vào đúng khối "Thông tin nâng cao" —
      // vì lúc ĐANG LẬP biên lai (chưa có bản ghi thật), khối này chưa hề có sẵn 4 dòng này (khác với
      // biên lai đã lập xong, nơi đã có sẵn nhờ advancedInfoHtml nhận đúng dữ liệu từ bản ghi thật).
      const advInfoEl = clone.querySelector('[id$="-adv-info"]');
      if(advInfoEl){
        const device = await getClientDeviceInfo();
        const creatorLines = [
          `Người lập biên lai: ${(state.identity&&state.identity.name)||''}`,
          `Email: ${(state.identity&&state.identity.email)||'(không có)'}`,
          `Địa chỉ IP: ${device.ip||'(không lấy được)'}`,
          `Thiết bị: ${device.userAgent||'(không lấy được)'}`,
        ];
        creatorLines.forEach(l=>{
          const p = document.createElement('p');
          p.className = 'sub';
          p.style.margin = '0 0 6px';
          p.textContent = l;
          advInfoEl.appendChild(p);
        });
      }
      bodyHtml = stripInteractiveElementsHtml(clone);
    }
    // Nhân đôi dòng "Quý N bắt đầu từ ngày...đến ngày..." — vì nội dung chụp lại từ modal ĐANG LẬP
    // (khác hẳn modal "xem lại biên lai") không có sẵn đoạn này, cần tự chèn thêm.
    const rpQuarterLines = paymentCtx.replay && paymentCtx.replay.quarterLines;
    if(rpQuarterLines && rpQuarterLines.length){
      bodyHtml += rpQuarterLines.map(q=>{
        const qd = resolveQuarterDatesForYear(q.qk, q.year);
        return `<p class="sub" style="margin:4px 0 0;">${quarterLbl(q.qk)}/${q.year} bắt đầu từ ngày ${fmtDate(qd.from)} đến ngày ${fmtDate(qd.to)}</p>`;
      }).join('');
    }
    // "Người đóng tiền"/"Người thu tiền" (và tương tự) là các Ô NHẬP LIỆU (input) trong lúc đang lập —
    // bị loại bỏ hoàn toàn khi chụp ảnh nội dung (vì input là phần tử tương tác). Chèn thêm 1 khối
    // TEXT TĨNH hiển thị đúng 2 tên đã điền, lấy trực tiếp từ dữ liệu replay đã lưu.
    const rp = paymentCtx.replay||{};
    if(rp.payerName || rp.collectorName){
      bodyHtml += `
        <div class="divider-lbl" style="margin-top:14px;">Người đóng / Người thu</div>
        <div class="kv-row"><span>Người đóng tiền</span><b>${escapeHtml(rp.payerName||'')}</b></div>
        <div class="kv-row"><span>Người thu tiền</span><b>${escapeHtml(rp.collectorName||'')}</b></div>`;
    }
    // "Lý do trả nợ trước hạn" cũng là 1 Ô NHẬP LIỆU (input) — bị bóc mất khi chụp ảnh nội dung.
    if(rp.applyFn==='early_repayment' && rp.reason){
      bodyHtml += `<div class="kv-row"><span>Lý do trả nợ trước hạn</span><b id="prc-reason-live">${escapeHtml(rp.reason)}</b></div>`;
    }
    // Hình thức trả nợ trước hạn (radio "Trả lại cấp.../Chọn người thừa kế" đã bị xoá ở
    // cleanReceiptContentClone) — chèn lại đúng 1 dòng text tĩnh khớp với lựa chọn thật.
    if(rp.applyFn==='early_repayment' && rp.mode){
      const modeLabel = rp.mode==='heir' ? 'Chọn người thừa kế' : (rp.isLocalOrOtherFund ? 'Trả lại cho cấp quản lý vốn vay' : 'Trả lại cấp Tỉnh/Thành phố hoặc Trung ương');
      bodyHtml += `<div class="kv-row${rp.mode==='heir'?' heir-info-block':''}"><span>Hình thức</span><b>${escapeHtml(modeLabel)}</b></div>`;
    }
    // "Người thừa kế" — thông tin nhập tay trong 1 bảng con riêng, cũng bị bóc mất tương tự.
    if(rp.applyFn==='early_repayment' && rp.mode==='heir' && rp.heir){
      bodyHtml += `
        <div class="divider-lbl heir-info-block" style="margin-top:14px;">Người thừa kế</div>
        <div class="kv-row heir-info-block"><span>Họ và tên</span><b>${escapeHtml(rp.heir.name||'')}</b></div>
        ${rp.heir.cccd? `<div class="kv-row heir-info-block"><span>Số CCCD</span><b>${escapeHtml(rp.heir.cccd)}</b></div>` : ''}
        ${rp.heir.phone? `<div class="kv-row heir-info-block"><span>Số điện thoại</span><b>${escapeHtml(rp.heir.phone)}</b></div>` : ''}
        ${rp.heir.hamlet? `<div class="kv-row heir-info-block"><span>Địa phương</span><b>${escapeHtml(rp.heir.hamlet)}</b></div>` : ''}`;
    }
    const borrowerIds = {};
    (paymentCtx.borrowerIds||[]).forEach(id=> borrowerIds[id] = true);
    const record = {
      title: paymentCtx.title||'BL Biên lai', html: bodyHtml, amount: paymentCtx.amount||0, borrowerNames: paymentCtx.borrowerNames||[], borrowerIds,
      wardLabel, provinceLabel, bankInfo: cfg.bankInfo||{}, status:'unpaid', replay: paymentCtx.replay||null,
      wardId: wardId(), createdAt: new Date().toISOString(), savedAt: new Date().toISOString(),
      createdByEmail: (state.identity&&state.identity.email)||'', createdByName: (state.identity&&state.identity.name)||'',
    };
    // Khử sạch mọi giá trị "undefined" còn sót lại đâu đó bên trong (VD: 1 trường nào đó trong
    // replay.quarterLines) — Firebase có thể âm thầm từ chối ghi cả nhánh dữ liệu chứa undefined mà
    // không báo lỗi rõ ràng, khiến "replay" (thứ dùng để áp dụng giao dịch thật sau này) bị mất mà
    // không hề hay biết. JSON.stringify tự động loại bỏ mọi property "undefined" một cách an toàn.
    const safeRecord = JSON.parse(JSON.stringify(record));
    try{ await rtdb.ref('receipts/'+code).set(safeRecord); }
    catch(e){ console.error('Không tạo được Biên lai chưa thanh toán:', e); alert('Có lỗi khi tạo Biên lai chưa thanh toán: '+(e&&e.message||e)); return; }
    renderUnpaidReceiptLinkModal(code);
  }
  function unpaidReceiptLink(code){ return publicReceiptLink(code); }
  function renderUnpaidReceiptLinkModal(code, opts){
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=>{
      if(!opts.showDelete){
        // Đang trong LUỒNG TẠO BIÊN LAI MỚI (không phải xem lại từ Hộp biên lai chưa thanh toán) — bấm
        // "Đóng bảng"/X sẽ đóng hết TẤT CẢ modal trung gian (VD modal nhập thông tin thanh toán, modal
        // này...) — CHỈ GIỮ LẠI đúng modal ĐẦU TIÊN (modal gốc "Tính tiền lãi và phê duyệt đóng lãi"
        // hoặc "Tất toán khoản vay hoặc trả nợ trước hạn" — modal đã mở TRƯỚC KHI bắt đầu tạo biên lai).
        const allModals = Array.from(document.querySelectorAll('.modal-bg'));
        allModals.slice(1).forEach(el=> el.remove());
      } else {
        wrap.remove();
      }
      if(opts.onClose) opts.onClose();
    };
    const link = unpaidReceiptLink(code);
    function renderBody(isEarlyRepayment, hideHeirInfo, recordForSummary){
      // Phân loại biên lai — CHỈ hiển thị khi xem từ Hộp biên lai chưa thanh toán (opts.showDelete) VÀ
      // biên lai này CÓ phân loại (đọc từ replay.categoryLabelId, nơi lưu phân loại lúc đang lập biên
      // lai, TRƯỚC khi có bản ghi biên lai thật).
      const uplCatId = (opts.showDelete && recordForSummary && recordForSummary.replay) ? (recordForSummary.replay.categoryLabelId||null) : null;
      let uplCatName = '', uplCatColor = '#fff';
      if(uplCatId){
        const l = receiptAllLabels().find(x=>x.id===uplCatId);
        uplCatName = l? l.name : '(phân loại đã bị xoá)'; uplCatColor = l? (l.color||'#fff') : '#fff';
      }
      // Lý do trả nợ trước hạn — CHỈ hiển thị khi xem từ Hộp biên lai chưa thanh toán VÀ là biên lai
      // loại Trả nợ trước hạn (isEarlyRepayment) — đọc từ replay.reason (đã có sẵn từ lúc lập biên lai).
      const uplReason = (opts.showDelete && isEarlyRepayment && recordForSummary && recordForSummary.replay) ? (recordForSummary.replay.reason||'') : null;
      wrap.innerHTML = `
        <div class="modal" style="max-width:520px;">          <div class="modal-head"><h3>🔗 Đường link Biên lai Chưa thanh toán</h3><button class="modal-close preview-allow" id="upl-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="color:#b71c1c; font-weight:700; margin-top:0;">Biên lai chưa thanh toán này đã được tạo thành công, và sẽ ở trong Hộp Biên lai chưa thanh toán (trong Kho biên lai), các Biên lai chưa thanh toán sẽ tự xoá sau 7 ngày nếu không được thanh toán.</p>
            ${recordForSummary? unpaidReceiptRowHtml({...recordForSummary, code}, false) : ''}
            ${(recordForSummary && recordForSummary.paymentRequestedAt)? `<p style="color:#0d47a1; font-weight:700; margin:10px 0;"><span style="display:inline-block; animation: bigMoneyPulse 1.4s ease-in-out infinite;">[Có người đã bấm vào "Đã thanh toán xong"]</span></p>` : ''}
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="text" readonly value="${escapeHtml(link)}" id="upl-input" style="flex:1; padding:10px 12px; border-radius:8px; border:1px solid var(--line); font-size:12.5px;">
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button type="button" class="btn btn-primary btn-sm preview-allow" id="upl-copy" style="flex:1;">📋 Sao chép</button>
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="upl-view" style="flex:1;">🔍 Xem đường link</button>
            </div>
            ${recordForSummary? unpaidReceiptCountdownHtml('upl-countdown') : ''}
            ${isEarlyRepayment? heirVisibilityToggleHtml('upl', hideHeirInfo) : ''}
            <p class="sub" style="margin-top:12px;">Có thể sao chép và chia sẻ đường link này - để cho Hộ vay hoặc mọi người cùng xem Biên lai, và thanh toán trực tiếp qua số tài khoản hoặc mã QR (trong đường link này). có thể chia sẻ đường link qua Messenger, Zalo hoặc các kênh chia sẻ khác. Nếu chia sẻ qua Zalo: tiến hành dán link vào khung chat rồi đợi 3 - 5 giây (để hiện bản xem trước nội dung) rồi mới bấm nút gửi đi ; Nếu chia sẻ qua Messenger (Facebook) thì cần lưu ý thêm: khuyên nên dùng điện thoại, cách dán link như cách làm chia sẻ qua Zalo</p>
            ${(uplReason!=null)? `<div class="kv-row"><span>Lý do trả nợ trước hạn</span><b>${escapeHtml(uplReason||'(không có)')} <button type="button" class="btn btn-ghost btn-sm preview-allow" id="upl-edit-reason" style="padding:2px 8px;">✏️ Sửa</button></b></div>` : ''}
            ${uplCatId? `<div class="divider-lbl" style="margin-top:14px;">Phân loại biên lai</div><div class="kv-row"><span style="display:flex; align-items:center; gap:6px;">${escapeHtml(uplCatName)}<span style="display:inline-block; width:30px; height:10px; background:${uplCatColor}; border:1px solid var(--line);"></span></span><button type="button" class="btn btn-ghost btn-sm preview-allow" id="upl-edit-cat" style="padding:2px 8px;">✏️ Sửa</button></div>` : ''}
          </div>
          <div class="modal-foot">
            ${opts.showDelete? `
              <button class="btn btn-ghost preview-allow" id="upl-delete" style="color:var(--red);">🗑️ Xoá Biên lai này</button>
              <button class="btn preview-allow" id="upl-markpaid" style="background:#1b5e20; color:#fff; border:none;">✅ Xác nhận đã Thanh toán xong</button>
            ` : `
              <button class="btn btn-ghost preview-allow" id="upl-goto-box" style="color:var(--red); font-weight:700;">Xem Hộp biên lai chưa thanh toán</button>
            `}
            <button class="btn btn-ghost preview-allow" id="upl-close2" style="margin-left:auto;">Đóng bảng</button>
          </div>
        </div>`;
      wireHeirVisibilityToggle(wrap, 'upl', code);
      if(recordForSummary) wireUnpaidReceiptCountdown('upl-countdown', recordForSummary.createdAt, code);
      const editCatBtn = wrap.querySelector('#upl-edit-cat');
      if(editCatBtn) editCatBtn.onclick = ()=> renderEditReceiptCategoryDialog(uplCatId, async (newId)=>{
        try{ await rtdb.ref('receipts/'+code+'/replay/categoryLabelId').set(newId); }
        catch(e){ console.error('Không sửa được phân loại biên lai:', e); alert('Có lỗi khi sửa: '+(e&&e.message||e)); return; }
        if(recordForSummary && recordForSummary.replay) recordForSummary.replay.categoryLabelId = newId;
        renderBody(isEarlyRepayment, hideHeirInfo, recordForSummary);
        showBigToast('Đã cập nhật Phân loại biên lai.');
      });
      const editReasonBtn = wrap.querySelector('#upl-edit-reason');
      if(editReasonBtn) editReasonBtn.onclick = ()=> renderEditReceiptTextDialog(uplReason||'', 200, async (newVal)=>{
        try{ await rtdb.ref('receipts/'+code+'/replay/reason').set(newVal); }
        catch(e){ console.error('Không sửa được lý do trả nợ trước hạn:', e); alert('Có lỗi khi sửa: '+(e&&e.message||e)); return; }
        if(recordForSummary && recordForSummary.replay) recordForSummary.replay.reason = newVal;
        renderBody(isEarlyRepayment, hideHeirInfo, recordForSummary);
        showBigToast('Đã cập nhật Lý do trả nợ trước hạn.');
      });
      const gotoBoxBtn = wrap.querySelector('#upl-goto-box');
      if(gotoBoxBtn) gotoBoxBtn.onclick = ()=>{
        // Đóng TẤT CẢ modal/bảng đang mở (kể cả modal đóng lãi/tất toán... đứng phía sau modal này) —
        // quay về đúng giao diện chính của Sổ vay vốn trước khi mở tiếp Kho lưu trữ.
        document.querySelectorAll('.modal-bg').forEach(el=> el.remove());
        state.archiveTab = 'receipts';
        renderArchiveModal();
        setTimeout(()=>{
          const archiveWrap = document.querySelector('.modal-bg');
          const body = archiveWrap ? archiveWrap.querySelector('.modal-body') : null;
          if(body) body.scrollTo({ top:0, behavior:'auto' });
          const btnText = document.getElementById('arc-unpaid-receipt-btn-text');
          if(btnText){ btnText.classList.remove('text-pulse-5x'); void btnText.offsetWidth; btnText.classList.add('text-pulse-5x'); }
        }, 60);
      };
      wireRest();
    }
    renderBody(false, false, null);
    (async ()=>{
      try{
        const snap = await rtdb.ref('receipts/'+code).get();
        const record = (snap && snap.exists()) ? snap.val() : null;
        // QUAN TRỌNG: nếu biên lai này ĐÃ được phê duyệt (status==='paid') hoặc ĐÃ BỊ XOÁ (record=null)
        // thì TUYỆT ĐỐI không được hiện lại như biên lai CHƯA thanh toán nữa — nếu không, bấm lại vào
        // thông báo cũ (VD đã đọc thông báo từ trước, giờ bấm lại lần nữa) sẽ cho phép phê duyệt THÊM
        // LẦN NỮA, tạo ra 2 biên lai giống hệt nhau (lỗi thật đã xảy ra, nay chặn dứt điểm tại đây).
        if(!record || record.status==='paid'){
          close();
          alert(record? 'Biên lai này đã được phê duyệt thanh toán xong.' : 'Biên lai này đã bị xoá.');
          return;
        }
        const isEarlyRepayment = !!(record && record.replay && record.replay.applyFn==='early_repayment');
        renderBody(isEarlyRepayment, !!(record && record.hideHeirInfo), record);
      }catch(e){ console.error('Không tải được thông tin biên lai:', e); }
    })();
    function wireRest(){
      wrap.querySelector('#upl-close').onclick = close;
      wrap.querySelector('#upl-close2').onclick = close;
      const deleteBtn = wrap.querySelector('#upl-delete');
      if(deleteBtn) deleteBtn.onclick = async ()=>{
        if(!confirm('Đồng chí có CHẮC CHẮN muốn xoá Biên lai chưa thanh toán này không? Khi xoá thì đường link Biên lai sẽ MẤT LUÔN và KHÔNG THỂ khôi phục lại được.')) return;
        try{ await rtdb.ref('receipts/'+code).remove(); }
        catch(e){ console.error('Không xoá được:', e); alert('Có lỗi khi xoá: '+(e&&e.message||e)); return; }
        wrap.remove();
        if(opts.onDeleted) opts.onDeleted();
        showBigToast('Biên lai chưa thanh toán đã bị XOÁ vĩnh viễn');
      };
    const markPaidBtn = wrap.querySelector('#upl-markpaid');
    if(markPaidBtn) markPaidBtn.onclick = async ()=>{
      if(!confirm('Đồng chí có CHẮC CHẮN Biên lai này đã được Thanh toán xong không? Sau khi xác nhận, Biên lai sẽ chuyển sang trạng thái Đã thanh toán, giữ nguyên mã và đường link như cũ. Biên lai đã Thanh toán thì không thể Xoá/sửa được bởi bất kỳ ai.')) return;
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
      if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
      showProcessingToast();
      try{
        const snap = await rtdb.ref('receipts/'+code).get();
        const record = (snap && snap.exists()) ? snap.val() : null;
        if(record && record.replay) record.replay.code = code; // giữ nguyên đúng mã cũ cho biên lai thật sắp tạo
        if(record && record.replay && record.replay.applyFn==='interest'){
          // Áp dụng THẬT giao dịch đóng lãi — cộng đúng tiền vào Hộp lãi của người vay, tạo bản ghi
          // Biên lai thật trong Hộp Biên lai của người vay đó, y hệt như bấm "Xác nhận đóng lãi thành
          // công" thông thường.
          await applyUnpaidInterestPayment(record.replay);
        } else if(record && record.replay && record.replay.applyFn==='settlement_final'){
          // Áp dụng THẬT giao dịch Tất toán khoản vay.
          await applyUnpaidSettlementFinal(record.replay);
        } else if(record && record.replay && record.replay.applyFn==='early_repayment'){
          // Áp dụng THẬT giao dịch Trả nợ trước hạn (kể cả tạo hồ sơ người thừa kế nếu có).
          await applyUnpaidEarlyRepayment(record.replay);
        } else if(record && record.replay && record.replay.applyFn==='shared_interest'){
          // Áp dụng THẬT giao dịch Biên lai chung: Đóng tiền lãi cho các hộ trong phương án vay.
          await applyUnpaidSharedInterestPayment(record.replay);
        } else if(record && record.replay && record.replay.applyFn==='shared_settlement'){
          // Áp dụng THẬT giao dịch Biên lai chung: Tất toán khoản vay cho các hộ trong phương án vay.
          await applyUnpaidSharedSettlement(record.replay);
        } else {
          // KHÔNG có dữ liệu "replay" (VD: biên lai được tạo từ trước khi tính năng này tồn tại) ->
          // KHÔNG thể tự áp dụng giao dịch thật. Báo rõ cho người dùng biết, tránh hiểu lầm là mọi
          // việc đã xong trong khi thực ra Hộp lãi/Sổ vay vốn của người vay CHƯA hề được cập nhật gì.
          hideProcessingToast();
          if(!confirm('⚠️ Biên lai này KHÔNG có đủ dữ liệu để tự động áp dụng giao dịch (có thể do được tạo từ phiên bản cũ). Nếu tiếp tục, Biên lai sẽ CHỈ chuyển trạng thái hiển thị thành "Đã thanh toán" — đồng chí cần TỰ vào Sổ vay vốn để ghi nhận thủ công giao dịch này. Đồng chí có chắc chắn muốn tiếp tục không?')) return;
          showProcessingToast();
        }
        await rtdb.ref('receipts/'+code).update({ status:'paid', createdAt: new Date().toISOString() });
      }catch(e){
        hideProcessingToast();
        console.error('Không xác nhận thanh toán được:', e);
        alert('Có lỗi khi xác nhận: '+(e&&e.message||e));
        return;
      }
      hideProcessingToast();
      wrap.remove();
      if(opts.onDeleted) opts.onDeleted(); // biên lai không còn ở trạng thái "chưa thanh toán" nữa -> lược khỏi danh sách hộp chưa thanh toán y hệt như xoá
      showBigToast('Đã xác nhận Thanh toán thành công!');
    };
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wireCopyButtonWithFeedback(wrap.querySelector('#upl-copy'), link, '📋 Sao chép');
    wrap.querySelector('#upl-view').onclick = ()=> window.open(link, '_blank');
    }
  }
  // Nút "Gửi đường link thanh toán" — gắn cạnh nút xác nhận lập biên lai (chỉ cho các biên lai THU
  // TIỀN VỀ xã/phường). `getCtx()` được gọi NGAY LÚC BẤM để lấy đúng số tiền/danh sách hộ vay hiện tại.
  function sendPaymentLinkBtnHtml(idPrefix){
    return `<button type="button" class="btn btn-ghost preview-allow" id="${idPrefix}-sendlink" style="border:2px solid #e65100; color:#e65100; font-weight:700;">💳 Gửi đường link thanh toán</button>`;
  }
  function wireSendPaymentLinkBtn(wrap, idPrefix, getCtx, extraValidate){
    const btn = wrap.querySelector(`#${idPrefix}-sendlink`);
    if(btn) btn.onclick = async ()=>{
      // Các điều kiện PHỔ QUÁT — áp dụng cho MỌI loại biên lai, khớp đúng y hệt điều kiện đầu tiên
      // của nút "Xác nhận..." bên cạnh.
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể gửi đường link thanh toán thật.'); return; }
      if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn nên không thể gửi đường link thanh toán. Vui lòng liên hệ Chủ mã định danh.'); return; }
      const ctx = getCtx();
      if(!ctx || !ctx.amount || ctx.amount<=0){ alert('Chưa xác định được số tiền — vui lòng chọn đủ thông tin trước khi gửi đường link thanh toán.'); return; }
      const rp = ctx.replay||{};
      if(!rp.payerName || !rp.collectorName){ alert('Vui lòng điền đầy đủ "Người đóng tiền"/"Người trả nợ" và "Người thu tiền"/"Người nhận tiền" trước khi gửi đường link thanh toán.'); return; }
      const bid = (ctx.borrowerIds||[])[0];
      const bname = (ctx.borrowerNames||[])[0]||'';
      if(bid && !(await assertNoUnpaidReceiptLock(bid, bname))) return;
      // Các điều kiện RIÊNG của từng loại biên lai (VD: số dư còn đúng hạn hay không, đã chọn đủ Quý
      // hay chưa...) — khớp đúng y hệt các điều kiện còn lại của nút "Xác nhận..." bên cạnh.
      if(extraValidate && !(await extraValidate())) return;
      renderSendPaymentLinkModal(ctx, null);
    };
  }
  // Modal "✅ Xác nhận thanh toán xong" — bước xác nhận TRUNG GIAN trước khi thật sự gửi yêu cầu duyệt
  // tới người tạo Biên lai. `qrWrap` = modal mã QR phía sau, cần đóng luôn khi hoàn tất.
  function renderPaymentConfirmRequestModal(data, code, qrWrap){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const phone = (data.bankInfo && data.bankInfo.phone) || '';
    wrap.innerHTML = `
      <div class="modal" style="max-width:480px;">
        <div class="modal-head"><h3>✅ Xác nhận thanh toán xong</h3><button class="modal-close preview-allow" id="pcr-close">✕</button></div>
        <div class="modal-body">
          <p style="margin:0 0 10px;">Nếu bấm vào "<span style="color:#0d47a1; font-weight:700;">Tiếp tục xác nhận</span>" thì hệ thống sẽ gửi thông báo đến Người tạo Biên lai này để Duyệt thanh toán cho Biên lai này.</p>
          <p style="margin:0 0 10px;">Nếu được Duyệt thì Biên lai này sẽ trở thành Biên Lai đã thanh toán xong, và lúc ấy Biên Lai sẽ không thể bị xoá/sửa nội dung bên trong, và đường link của Biên lai vẫn sẽ như cũ (vĩnh viễn không thay đổi).</p>
          <p style="margin:0;">Biên lai có thể tự động chuyển sang trạng thái Đã thanh toán xong một cách tức thì (ngay sau khi được duyệt) mà không cần tải lại trang web</p>
          <p style="color:#b71c1c; font-weight:700; margin:14px 0 10px;">Liên hệ số điện thoại của chủ tài khoản HOẶC Liên hệ cán bộ Hội Nông dân xã/phường - nếu đã quá 24 giờ mà chưa được duyệt Biên lai (sau khi chuyển tiền thành công)</p>
          ${phone? `<div class="kv-row"><span>Số điện thoại của Chủ tài khoản</span><b>${escapeHtml(phone)} <button type="button" class="btn btn-ghost btn-sm preview-allow" id="pcr-copy-phone">Sao chép</button></b></div>` : ''}
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="pcr-back" style="flex:1;">Quay lại (Chưa xác nhận)</button>
          <button class="btn btn-primary preview-allow" id="pcr-continue" style="flex:1;">Tiếp tục xác nhận</button>
        </div>
      </div>`;
    wrap.querySelector('#pcr-close').onclick = close;
    wrap.querySelector('#pcr-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    const copyPhoneBtn = wrap.querySelector('#pcr-copy-phone');
    if(copyPhoneBtn) wireCopyButtonWithFeedback(copyPhoneBtn, phone, 'Sao chép');
    wrap.querySelector('#pcr-continue').onclick = async ()=>{
      try{
        // CHỈ ghi mốc thời gian nếu CHƯA TỪNG có — dù bấm "Tiếp tục xác nhận" nhiều lần (sau khi nút bị
        // khoá 1 phút rồi mở lại), mốc thời gian luôn giữ nguyên đúng LẦN ĐẦU TIÊN.
        const curSnap = await rtdb.ref('receipts/'+code+'/paymentRequestedAt').get();
        if(!curSnap || !curSnap.exists()){
          await rtdb.ref('receipts/'+code).update({ paymentRequestedAt: new Date().toISOString() });
        }
        // Gửi thông báo cá nhân tới ĐÚNG người đã tạo Biên lai chưa thanh toán này — không gửi cho ai
        // khác trong cùng mã xã/phường.
        if(data.createdByEmail){
          const firstBorrower = (data.borrowerNames&&data.borrowerNames[0]) || '(không rõ)';
          const notifId = uid();
          await rtdb.ref('notifications/'+emailToKey(data.createdByEmail)+'/'+notifId).set({
            text: `Có người nào đó đã bấm "Xác nhận thanh toán thành công" của Biên lai chưa thanh toán (hộ vay ${firstBorrower}). hãy kiểm tra lại tài khoản xem đã nhận tiền chưa, bấm vào đây để tiến hành xác nhận`,
            receiptCode: code, createdAt: new Date().toISOString(), read:false,
          });
        }
      }catch(e){ console.error('Không gửi được yêu cầu duyệt thanh toán:', e); alert('Có lỗi khi gửi yêu cầu: '+(e&&e.message||e)); return; }
      close();
      if(qrWrap) qrWrap.remove();
    };
  }
  function renderUnpaidPaymentQrModal(data, code){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const bi = data.bankInfo||{};
    const transferContent = `hoinongdan${(data.wardId||'').replace(/\D/g,'').slice(0,3)||'219'} ${code}`;
    const qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(bi.bankName||'')}-${encodeURIComponent(bi.accountNumber||'')}-compact2.png?amount=${Math.round(data.amount||0)}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bi.accountName||'')}`;
    const firstBorrower = (data.borrowerNames&&data.borrowerNames[0]) || '';
    const cleanTitle = String(data.title||'').replace(/^BL\s*/i,'').replace(/\s*\(THEO CÁCH TÍNH[^)]*\)/i,'').trim();
    const requestedAt = data.paymentRequestedAt ? new Date(data.paymentRequestedAt).getTime() : 0;
    const msSinceRequested = requestedAt ? (Date.now() - requestedAt) : Infinity;
    const stillLocked = msSinceRequested < 60000; // khoá trong đúng 1 phút kể từ lúc bấm "Tiếp tục xác nhận"
    wrap.innerHTML = `
      <div class="modal" style="max-width:480px;">
        <div class="modal-head" id="uqr-title-block"><h3>Thanh toán cho Biên lai ${escapeHtml(cleanTitle)}${firstBorrower? ` đối với hộ vay ${escapeHtml(firstBorrower)}` : ''}</h3><button class="modal-close preview-allow" id="uqr-close">✕</button></div>
        <div class="modal-body" id="uqr-content" style="text-align:center;">
          <p style="color:#0d47a1; font-weight:700;">Vui lòng quét mã QR này để chuyển tiền hoặc sao chép các nội dung chuyển khoản ở bên dưới</p>
          <img id="uqr-img" src="${qrUrl}" alt="Mã QR chuyển khoản" style="width:220px; height:220px; margin:10px auto; display:block; border:1px solid var(--line); border-radius:8px;">
          <button type="button" class="btn btn-ghost btn-sm preview-allow" id="uqr-download">⬇️ Tải ảnh QR về máy</button>
          <p style="color:#0d47a1; font-weight:700; margin:6px 0 14px;">Số tài khoản này Được kiểm chứng bởi người chia sẻ Biên lai (qua đường Link)</p>
          <div class="kv-row"><span>Tên tài khoản</span><b>${escapeHtml(bi.accountName||'')}</b></div>
          <div class="kv-row"><span>Ngân hàng</span><b>${escapeHtml(bi.bankName||'')} <button type="button" class="btn btn-ghost btn-sm preview-allow uqr-copy-btn" data-uqr-copy="${escapeHtml(bi.bankName||'')}">Sao chép</button></b></div>
          <div class="kv-row"><span>Số tài khoản</span><b>${escapeHtml(bi.accountNumber||'')} <button type="button" class="btn btn-ghost btn-sm preview-allow uqr-copy-btn" data-uqr-copy="${escapeHtml(bi.accountNumber||'')}">Sao chép</button></b></div>
          <div class="kv-row"><span>Số tiền</span><b style="color:#0d47a1;">${moneySpaced(data.amount)} <button type="button" class="btn btn-ghost btn-sm preview-allow uqr-copy-btn" data-uqr-copy="${Math.round(data.amount||0)}">Sao chép</button></b></div>
          <div class="kv-row"><span>Nội dung chuyển khoản</span><b>${escapeHtml(transferContent)} <button type="button" class="btn btn-ghost btn-sm preview-allow uqr-copy-btn" data-uqr-copy="${escapeHtml(transferContent)}">Sao chép</button></b></div>
          ${bi.phone? `<div class="kv-row"><span style="color:#6a1b9a; font-weight:700;">Số điện thoại liên hệ của Chủ tài khoản</span><b style="color:#6a1b9a;">${escapeHtml(bi.phone)} <button type="button" class="btn btn-ghost btn-sm preview-allow uqr-copy-btn" data-uqr-copy="${escapeHtml(bi.phone)}">Sao chép</button></b></div>` : ''}
        </div>
        <div class="modal-foot" style="flex-direction:column; gap:8px; align-items:stretch;">
          <div style="display:flex; gap:8px;">
            <button class="btn btn-ghost preview-allow" id="uqr-back" style="flex:1;">Quay lại (chưa thanh toán)</button>
            <button class="btn preview-allow" id="uqr-confirm" ${stillLocked?'disabled':''} style="flex:1; ${stillLocked?'background:#bbb; color:#666; border:none; cursor:not-allowed;':'background:#1b5e20; color:#fff; border:none;'}">✅ Xác nhận thanh toán xong</button>
          </div>
          <p class="sub" style="color:#b71c1c; margin:0;">Nếu đã thanh toán xong, vui lòng bấm vào "Xác nhận thanh toán xong" để hệ thống tự động xác nhận cho Biên lai và báo cáo về xã/phường.</p>
        </div>
      </div>`;
    wrap.querySelector('#uqr-close').onclick = close;
    wrap.querySelector('#uqr-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelectorAll('.uqr-copy-btn').forEach(btn=> wireCopyButtonWithFeedback(btn, btn.dataset.uqrCopy, 'Sao chép'));
    if(!stillLocked) wrap.querySelector('#uqr-confirm').onclick = ()=> renderPaymentConfirmRequestModal(data, code, wrap);
    wrap.querySelector('#uqr-download').onclick = async ()=>{
      // Chụp lại đúng phần tiêu đề + nội dung (không kèm nút xác nhận/sao chép/quay lại) thành 1 ảnh.
      try{
        if(typeof html2canvas==='undefined'){
          await new Promise((resolve,reject)=>{
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        const captureEl = document.createElement('div');
        captureEl.style.cssText = 'position:fixed; left:-9999px; top:0; background:#fff; padding:20px; width:440px; font-family:inherit;';
        captureEl.innerHTML = `<h3 style="margin:0 0 14px;">${wrap.querySelector('#uqr-title-block h3').textContent}</h3>` + wrap.querySelector('#uqr-content').innerHTML.replace(/<button[^>]*>.*?<\/button>/g,'');
        document.body.appendChild(captureEl);
        const canvas = await html2canvas(captureEl, { backgroundColor:'#ffffff', useCORS:true });
        const link = document.createElement('a');
        link.download = `ma-qr-thanh-toan-${code}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        captureEl.remove();
      }catch(e){ console.error(e); alert('Không tải được ảnh — vui lòng chụp màn hình thủ công.'); }
    };
  }
  function myGrant(){
    if(!state.identity || !state.identity.email || !state.config) return null;
    return (state.config.grants||{})[emailToKey(state.identity.email)] || null;
  }
  // Quyền hiệu lực của TÔI với 1 trong 4 module dữ liệu ('data'|'members'|'strength'|'internal')
  function modulePerm(m){
    if(isTourMode()) return 'edit'; // tour thấy đủ giao diện; mutation vẫn bị chặn ở handler/lớp lưu trữ
    if(isOwner()) return 'edit';
    if(state._adminViewingWard && isAdmin()) return 'view'; // Admin "Xem cơ sở dữ liệu": full quyền XEM, không được Sửa
    if(!state.config) return 'none';
    const g = myGrant();
    if(g && g[m]) return g[m];
    return (state.config.publicPerms && state.config.publicPerms[m]) || 'none';
  }
  function canViewModule(m){ return modulePerm(m)!=='none'; }
  function canEditModule(m){ return modulePerm(m)==='edit'; }
  // Quyền vào/sửa "Cài đặt của mã định danh" — CHỈ cấp được qua Loại 2 (đích danh email), không có ở Loại 1 (công khai)
  function settingsPerm(){
    if(isTourMode()) return 'edit';
    if(isOwner()) return 'edit';
    const g = myGrant();
    return (g && g.settings) || 'none';
  }
  function canEditSettings(){ return isOwner() || settingsPerm()==='edit'; }
  function hasAnyWardAccess(){
    if(isTourMode()) return true;
    if(isOwner()) return true;
    if(settingsPerm()!=='none') return true;
    return SHARE_MODULES.some(m=>modulePerm(m.key)!=='none');
  }
  // "Đang chờ duyệt" CHỈ áp dụng cho khách đã đăng nhập Google & tham gia bằng mã (Loại 2 chưa được cấp gì).
  // Khách qua mã không đăng nhập (codeGuest) hoặc môi trường tham quan dùng riêng hệ publicPerms/preview, không có khái niệm này.
  function isPending(){
    if(isTourMode()) return false;
    if(!state.identity || !state.identity.email) return false;
    if(!wardId() || !state.config) return false;
    return !hasAnyWardAccess();
  }

  // ---------- danh xưng hành chính động (Xã/Phường, Ấp/Khu phố/Thôn...) ----------
  // Mọi nơi trong giao diện, biểu mẫu, và file xuất (Excel/Word/PDF/In) đều PHẢI
  // lấy danh xưng qua các hàm dưới đây — tuyệt đối không viết chết chữ "Xã"/"Ấp".
  const ADMIN_LEVEL_OPTIONS = ['Xã', 'Phường'];
  const SUB_ADMIN_OPTIONS = ['Khu dân cư', 'Thôn', 'Khu phố', 'Ấp', 'Tổ dân phố', 'Khóm', 'Bản', 'Làng', 'Buôn', 'Sóc', 'Plei', 'Xóm', 'Đội'];
  // Loại đơn vị hành chính cấp Tỉnh (dùng ở "Thông tin cơ bản bắt buộc" — màn hình thiết lập ban đầu / Cài đặt)
  const PROVINCE_TYPE_OPTIONS = ['Tỉnh', 'Thành phố'];
  // Mốc 4 Quý mặc định — CHỈ ngày/tháng (không năm), áp dụng lặp lại cho MỌI năm quá khứ/hiện tại/
  // tương lai. Quý 1 bắt đầu từ 31/12 năm trước, nên khi "resolve" ra ngày cụ thể phải xét đúng
  // năm liền trước cho mốc bắt đầu của Quý 1.
  const DEFAULT_QUARTERS = {
    q1:{ label:'Quý 1', startMonth:12, startDay:31, endMonth:3, endDay:31 },
    q2:{ label:'Quý 2', startMonth:3, startDay:31, endMonth:6, endDay:30 },
    q3:{ label:'Quý 3', startMonth:6, startDay:30, endMonth:9, endDay:30 },
    q4:{ label:'Quý 4', startMonth:9, startDay:30, endMonth:12, endDay:31 },
  };
  // Dòng chữ "Đang áp dụng Các mốc thời gian hàng quý: Quý 1 từ .../ đến .../ ; ..." — dùng ở cuối
  // panel Danh sách người vay, tự động lấy đúng mốc hiện hành của xã/phường.
  function currentQuarterBoundariesCaptionHtml(){
    const q = (state.config && state.config.quarters) || DEFAULT_QUARTERS;
    const pad2 = n=> String(n).padStart(2,'0');
    const parts = ['q1','q2','q3','q4'].map((k,i)=>{
      const item = q[k] || DEFAULT_QUARTERS[k];
      return `Quý ${i+1} từ ${pad2(item.startDay)}/${pad2(item.startMonth)} đến ${pad2(item.endDay)}/${pad2(item.endMonth)}`;
    });
    return `<p class="sub" style="margin-top:14px;">Đang áp dụng Các mốc thời gian hàng quý: ${parts.join(' ; ')}</p>`;
  }
  // "Resolve" 1 Quý (theo mẫu ngày/tháng lặp lại) ra khoảng ngày CỤ THỂ (có năm) gần với "hôm nay"
    // nhất — dùng tạm cho các tính năng đang có (kỳ báo cáo, nhắc hạn quý) trong lúc chờ logic
  // tính lãi suất chính thức (sẽ được bổ sung sau) sử dụng đúng bộ mốc này theo cách khác nếu cần.
  function resolveQuarterDates(qKey){
    const q = (state.config && state.config.quarters && state.config.quarters[qKey]) || DEFAULT_QUARTERS[qKey];
    if(!q || q.startMonth==null || q.endMonth==null) return { from:'', to:'' };
    const pad = n=> String(n).padStart(2,'0');
    const buildRange = (endYear)=>{
      const startYear = (q.startMonth > q.endMonth) ? endYear-1 : endYear;
      return {
        start: `${startYear}-${pad(q.startMonth)}-${pad(q.startDay)}`,
        end: `${endYear}-${pad(q.endMonth)}-${pad(q.endDay)}`,
      };
    };
    const today = new Date(); today.setHours(0,0,0,0);
    const y = today.getFullYear();
    let best = null, bestDist = Infinity;
    [y-1, y, y+1].forEach(ey=>{
      const r = buildRange(ey);
      const s = new Date(r.start+'T00:00:00'), e = new Date(r.end+'T00:00:00');
      if(today>=s && today<=e){ best = r; bestDist = -1; }
      else if(bestDist!==-1){
        const dist = Math.min(Math.abs(today-s), Math.abs(today-e));
        if(dist<bestDist){ bestDist = dist; best = r; }
      }
    });
    return { from: best.start, to: best.end };
  }
  // Quý mà "hôm nay" (theo lịch hiện hành) đang nằm trong đó — dùng làm giá trị MẶC ĐỊNH ban đầu
  // cho bộ lọc Quý ở Sổ vay vốn (dự phòng q1 nếu không khớp quý nào).
  // =====================================================================
  // BỘ LỌC ẤP & PHƯƠNG ÁN VAY — đa chọn kiểu checkbox, có ô "Tất cả": chọn "Tất cả" thì tích hết,
  // bỏ "Tất cả" thì bỏ hết; nếu đang chọn hết mà bỏ 1 cái thì "Tất cả" tự bỏ (không ảnh hưởng các ô khác).
