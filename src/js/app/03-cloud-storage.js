  // =====================================================================
  // ---------- LỚP LƯU TRỮ ĐÁM MÂY (Firebase Realtime Database) ----------
  // KIẾN TRÚC "CON TRỎ / MÃ ẨN" — đúng như yêu cầu: mỗi mã định danh (wardId) luôn đi kèm
  // 1 "Mã ẩn" (secretId) CỐ ĐỊNH, không bao giờ đổi và không ai nhìn thấy được:
  //   • data/{wardId}/config  — CHỈ là "con trỏ/nhãn" nhỏ gọn, cho phép gõ đúng wardId là tìm ra
  //     Xã. wardId có thể đổi tên, bị xoá, hay được cấp lại cho người khác sau này — đây là phần
  //     DUY NHẤT bị ảnh hưởng khi đổi tên mã.
  //   • secretdata/{secretId}/{borrowers,expenses,trash,activityLog,collaborators} — TOÀN BỘ dữ
  //     liệu nghiệp vụ thật, được neo theo Mã ẩn VĨNH VIỄN. Dù wardId có đổi tên, bị xoá rồi cấp
  //     lại cho người khác (tái sử dụng chuỗi ký tự) thì dữ liệu thật ở đây KHÔNG BAO GIỜ bị đụng
  //     tới, bị mất, hay bị lẫn với dữ liệu của người khác — vì mỗi secretId là duy nhất tuyệt đối
  //     và chỉ được sinh ra đúng 1 lần khi mã được thiết lập lần đầu (xem genSecretId()). Sau này
  //     nâng cấp gói VIP/PRO cho 1 mã cụ thể cũng là gắn cờ VIP vào ĐÚNG secretId này.
  // =====================================================================
  function wardId(){ return state.identity && state.identity.wardId; }
  // "Mã ẩn" đang active — bảo lãnh toàn bộ dữ liệu thật của mã xã hiện tại. Có fallback về wardId
  // cho các mã xã kiểu CŨ (tạo trước khi có kiến trúc này) chưa có sẵn field secretId.
  function secretId(){ return (state.config && state.config.secretId) || wardId(); }
  function wref(sub){
    if(sub === 'config') return rtdb.ref(`data/${wardId()}/config`);
    return rtdb.ref(`secretdata/${secretId()}/${sub}`);
  }
  // CHỈ dùng cho sub="config" — thao tác "con trỏ" của BẤT KỲ wardId nào (không nhất thiết đang
  // active), dùng ở màn hình "Ví mã xã" (đa mã xã / multi-tenant): kiểm tra mã tồn tại chưa, xoá/
  // khôi phục con trỏ... Dữ liệu THẬT không bao giờ được truy cập qua wardId — dùng srefFor().
  function wrefFor(wid, sub){
    if(sub !== 'config') throw new Error('wrefFor() chỉ dùng cho sub="config". Dữ liệu thật phải truy cập theo Mã ẩn — dùng srefFor(secretId, sub).');
    return rtdb.ref(`data/${wid}/config`);
  }
  // Truy cập dữ liệu thật theo ĐÚNG 1 secretId đã biết trước (không phụ thuộc mã xã đang active) —
  // dùng khi cần thao tác dữ liệu của một mã KHÔNG PHẢI mã đang mở (vd: sau khi khôi phục xong).
  function srefFor(sid, sub){ return rtdb.ref(`secretdata/${sid}/${sub}`); }

  // =====================================================================
  // BỘ NHỚ DỮ LIỆU CÁ NHÂN — xuyên suốt mọi mã xã, gắn theo Firebase UID của người
  // dùng, HOÀN TOÀN TÁCH BIỆT khỏi dữ liệu "data/{wardId}" hay "secretdata/{secretId}" của bất kỳ mã
  // xã nào. Dù người dùng đăng nhập vào mã xã nào, dữ liệu cá nhân này luôn đi theo họ.
  // Dùng chung cho nhiều tính năng cá nhân sau này (Bộ xem cột, ghi chú riêng, cài đặt riêng...).
  // Nếu CHƯA đăng nhập bằng Google, dùng localStorage của trình duyệt làm nơi lưu tạm thay thế —
  // xem thêm các hàm personalGet/personalSet/personalRemove/personalFetchAll bên dưới, chúng tự động
  // chọn đúng nguồn (Firebase hay localStorage) và LUÔN GỘP CẢ 2 nguồn khi liệt kê.
  // =====================================================================
  function personalEmailKey(){
    return (state.identity && state.identity.email) ? state.identity.email.toLowerCase().trim().replace(/[.#$\[\]\/]/g,'_') : null;
  }
  function personalUidKey(){ return (state.identity && state.identity.uid) ? String(state.identity.uid) : null; }
  function personalUserKey(){ return personalUidKey() || personalEmailKey(); }
  function personalLegacyEmailRef(sub){
    const legacyKey=personalEmailKey();
    const currentKey=personalUserKey();
    return legacyKey && legacyKey!==currentKey ? rtdb.ref(`userPersonalData/${legacyKey}/${sub}`) : null;
  }
  function isPersonalStorageLinkedToGoogle(){ return !!personalUserKey(); }
  // uref(sub) — con trỏ Firebase tới đúng kho dữ liệu cá nhân của người dùng đang đăng nhập, không
  // phụ thuộc mã xã nào cả. CHỈ dùng được khi đã đăng nhập bằng Google.
  function uref(sub){
    const key = personalUserKey();
    if(!key) throw new Error('uref() chỉ dùng được khi đã đăng nhập bằng tài khoản Google.');
    return rtdb.ref(`userPersonalData/${key}/${sub}`);
  }
  function personalLocalStorageKey(sub){ return 'personalData_'+sub; }
  function personalGetLocal(sub){
    try{ return JSON.parse(localStorage.getItem(personalLocalStorageKey(sub))||'{}'); }catch(e){ return {}; }
  }
  function personalSetLocal(sub, obj){
    try{ localStorage.setItem(personalLocalStorageKey(sub), JSON.stringify(obj)); }
    catch(e){ console.warn('Không thể lưu bộ nhớ cá nhân trên thiết bị:', e); }
  }
  // Lưu 1 bản ghi cá nhân (theo id) — tự chọn Firebase (nếu đã đăng nhập Google) hoặc localStorage.
  async function personalSet(sub, id, record){
    if(isPersonalStorageLinkedToGoogle()){
      try{
        await uref(sub).child(id).set(record);
        return;
      }catch(err){
        console.error('Ghi Firebase cá nhân thất bại (có thể do luật bảo mật chưa cho phép đường dẫn userPersonalData/), tự động lưu tạm vào localStorage của trình duyệt:', err);
      }
    }
    const obj = personalGetLocal(sub); obj[id] = record; personalSetLocal(sub, obj);
  }
  // Xoá 1 bản ghi cá nhân theo id — xoá ở CẢ 2 nguồn phòng khi tồn tại ở cả 2 (vd: vừa mới đăng nhập).
  async function personalRemove(sub, id){
    if(isPersonalStorageLinkedToGoogle()){ try{ await uref(sub).child(id).remove(); }catch(e){} }
    const legacyRef=personalLegacyEmailRef(sub);
    if(legacyRef){ try{ await legacyRef.child(id).remove(); }catch(e){} }
    const obj = personalGetLocal(sub); delete obj[id]; personalSetLocal(sub, obj);
  }
  // Lấy TOÀN BỘ bản ghi cá nhân — gộp UID mới, nhánh email legacy và localStorage. Nếu trùng ID,
  // ưu tiên UID mới, sau đó tới email legacy, cuối cùng mới tới bản local.
  async function personalFetchAll(sub){
    const localObj = personalGetLocal(sub);
    const localArr = Object.keys(localObj).map(id=>({...localObj[id], id}));
    let fbArr = [], legacyArr = [];
    if(isPersonalStorageLinkedToGoogle()){
      try{ const snap = await uref(sub).once('value'); fbArr = snapToArray(snap.val()); }catch(e){ fbArr = []; }
      const legacyRef=personalLegacyEmailRef(sub);
      if(legacyRef){ try{ const snap=await legacyRef.once('value'); legacyArr=snapToArray(snap.val()); }catch(e){ legacyArr=[]; } }
    }
    const seen = new Set();
    return fbArr.concat(legacyArr,localArr).filter(item=>{
      if(seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }
  // Hợp nhất nhánh email cũ vào UID mới khi Firebase cho phép. Không xoá nhánh cũ để có thể
  // khôi phục an toàn nếu Rules hoặc mạng gặp lỗi trong quá trình rollout.
  async function migrateLegacyPersonalDataToUid(){
    const uid=personalUidKey(), legacyKey=personalEmailKey();
    if(!uid || !legacyKey || uid===legacyKey) return;
    const legacyRoot=rtdb.ref(`userPersonalData/${legacyKey}`);
    const uidRoot=rtdb.ref(`userPersonalData/${uid}`);
    try{
      const [legacySnap,uidSnap]=await Promise.all([legacyRoot.once('value'),uidRoot.once('value')]);
      if(!legacySnap.exists()) return;
      const legacy=legacySnap.val()||{}, current=uidSnap.exists() ? (uidSnap.val()||{}) : {};
      await uidRoot.set({...legacy,...current,migratedFromEmailKey:legacyKey,migratedAt:new Date().toISOString()});
    }catch(e){ console.warn('Không thể hợp nhất kho cá nhân email cũ sang UID, vẫn dùng fallback đọc legacy:',e); }
  }


  // ---------------------------------------------------------------------
  // Mục lục toàn hệ thống (chỉ Admin đọc được, dùng cho Module [CÀI ĐẶT ADMIN] — Khu vực 3):
  // mỗi khi "con trỏ" config của 1 mã xã được ghi/cập nhật, đồng bộ 1 bản ghi rút gọn vào
  // system_wards_index/{wardId} để Admin liệt kê TẤT CẢ mã xã đang hoạt động mà không cần quét
  // toàn bộ cây "data/" (vốn có thể rất lớn và bị chặn bởi luật bảo mật Firebase).
  // ---------------------------------------------------------------------
  function syncWardIndex(wid, cfg){
    if(!wid || !cfg) return;
    rtdb.ref(`system_wards_index/${wid}`).set({
      wardId: wid, wardName: cfg.wardName||'', provinceName: cfg.provinceName||'', adminLevel: cfg.adminLevel||'',
      ownerEmail: cfg.ownerEmail||'', deleted: !!cfg.deleted, secretId: cfg.secretId||'',
      createdAt: cfg.createdAt || '', updatedAt: new Date().toISOString(),
    }).catch(e=>console.error('Đồng bộ system_wards_index lỗi:', e));
  }
  function removeWardIndex(wid){
    if(!wid) return;
    rtdb.ref(`system_wards_index/${wid}`).remove().catch(()=>{});
  }
  async function loadSystemWardsIndex(){
    try{
      const snap = await rtdb.ref('system_wards_index').get();
      state.systemWardsIndex = (snap && snap.exists()) ? Object.values(snap.val()) : [];
    }catch(e){ state.systemWardsIndex = []; }
  }
  // [CÀI ĐẶT ADMIN] — Khu vực 3, nút [Xem cơ sở dữ liệu]: cho phép Admin mở CHẾ ĐỘ XEM (chỉ đọc,
  // không sửa được gì) toàn bộ dữ liệu của MỘT mã xã bất kỳ, không cần là Chủ mã/được cấp quyền.
  async function adminViewWard(wid){
    if(!isAdmin()) return;
    detachRealtime();
    state._adminViewingWard = true;
    state.identity.wardId = wid; // KHÔNG gọi setActiveWardCache — không đổi mã "của riêng Admin" đang lưu cache
    state.config = await cGetOnce('config', null);
    if(!state.config){ alert('Không tìm thấy dữ liệu cấu hình cho mã này (có thể đã bị xoá vĩnh viễn).'); state._adminViewingWard = false; return; }
    state.activeTab = 'dashboard';
    state.view = 'app';
    state._showWardWelcome = true;
    attachRealtime();
    render();
  }
  // [CÀI ĐẶT ADMIN] — Khu vực 3, nút [Xoá vào Thùng rác]: Admin chuyển bất kỳ mã xã nào vào đúng
  // Thùng rác cá nhân của Chủ mã đó (y hệt luồng ownerDeleteWard sẵn có), Chủ mã tự khôi phục sau.
  async function adminDeleteWardToTrash(wid){
    if(!isAdmin()) return;
    const cfg = await cGetOnceFor(wid, 'config', null);
    if(!cfg){ alert('Không tìm thấy mã này.'); return; }
    if(cfg.deleted){ alert('Mã này đã ở trong thùng rác từ trước.'); return; }
    if(!confirm(`[ADMIN] Xoá mã "${wid}"${cfg.wardName?` (${cfg.wardName})`:''} vào Thùng rác của Chủ mã (${cfg.ownerEmail||'không rõ'})? Bạn có chắc chắn?`)) return;
    cfg.deleted = true; cfg.deletedAt = new Date().toISOString(); cfg.deletedBy = state.identity.email;
    await wrefFor(wid, 'config').set(cfg);
    syncWardIndex(wid, cfg);
    if(cfg.ownerEmail){
      const ownerKey = emailToKey(cfg.ownerEmail);
      await rtdb.ref(`users/${ownerKey}/wards/${wid}`).remove();
      await rtdb.ref(`users/${ownerKey}/deletedWards/${wid}`).set({wardId:wid, wardName:cfg.wardName||'', deletedAt:new Date().toISOString(), deletedByAdmin: state.identity.email});
    }
    await loadSystemWardsIndex();
    const mount = document.getElementById('content');
    if(mount && state.activeTab==='adminSettings') renderAdminSettingsTab(mount);
  }
  async function cGetOnceFor(wid, sub, fallback){
    try{ const snap = await wrefFor(wid, sub).get(); return snap.exists() ? snap.val() : fallback; }
    catch(e){ console.error('Firebase đọc lỗi:', wid, sub, e); return fallback; }
  }
  // Email của Chủ trang web (superadmin) — người duy nhất có quyền thao tác
  // với "Thùng rác hệ thống" (nơi các mã xã bị Chủ mã xoá vĩnh viễn cuối cùng sẽ rơi vào).
  // Email của các Admin TỐI CAO — cố định trong code, không ai (kể cả admin khác) có quyền xoá
  // quyền admin của 2 tài khoản này. Các admin khác được thêm/xoá lẫn nhau qua Firebase (admins/...).
  const SUPER_ADMIN_EMAILS = ['lookatmevanthanhpham@gmail.com', '219thanhdeptrai@gmail.com'];
  function isSuperAdmin(){ return !!(state.identity && state.identity.email && SUPER_ADMIN_EMAILS.includes(state.identity.email)); }
  function isAdmin(){
    if(!state.identity || !state.identity.email) return false;
    if(isSuperAdmin()) return true;
    return !!(state.admins||{})[emailToKey(state.identity.email)];
  }
  // Giữ tên cũ để không phải sửa lại các chỗ gọi trước đây — nay có nghĩa "là Admin" (đã mở rộng đa Admin).
  function isSiteOwner(){ return isAdmin(); }

  function snapToArray(val){ return val ? Object.values(val) : []; }
  function byId(list){ const o={}; (list||[]).forEach(x=>{ if(x && x.id) o[x.id]=x; }); return o; }

  // Đọc 1 lần (dùng khi cần kiểm tra dữ liệu trước khi quyết định vào app/onboarding)
  async function cGetOnce(sub, fallback){
    try{ const snap = await wref(sub).get(); return snap.exists() ? snap.val() : fallback; }
    catch(e){ console.error('Firebase đọc lỗi:', sub, e); return fallback; }
  }
  // Ghi đè toàn bộ nhánh (dùng cho config, hoặc khôi phục sao lưu)
  async function cSet(sub, value){
    if(blockTourMutation('Bạn đang ở môi trường tham quan. Dữ liệu mẫu không được lưu vào Firebase.')) return;
    try{
      await wref(sub).set(value);
      if(sub === 'config') syncWardIndex(wardId(), value); // chạy nền, không cần chờ — phục vụ mục lục toàn hệ thống cho Admin
    }catch(e){ console.error('Firebase set lỗi:', sub, e); alert('Không thể lưu dữ liệu lên máy chủ. Vui lòng kiểm tra kết nối mạng / cấu hình Firebase.'); }
  }
  // Cập nhật một phần của nhánh (merge, không ghi đè các trường khác)
  async function cUpdate(sub, partial){
    if(blockTourMutation('Bạn đang ở môi trường tham quan. Dữ liệu mẫu không được lưu vào Firebase.')) return;
    try{ await wref(sub).update(partial); }catch(e){ console.error('Firebase update lỗi:', sub, e); }
  }
  // Ghi/thêm 1 bản ghi trong 1 tập hợp (borrowers/{id}, expenses/{id}, trash/{id}...)
  async function cSetRecord(sub, id, record){
    if(blockTourMutation('Bạn đang ở môi trường tham quan. Dữ liệu mẫu không được lưu vào Firebase.')) return;
    try{ await wref(sub).child(id).set(record); }catch(e){ console.error('Firebase set record lỗi:', sub, id, e); }
  }
  // Xoá 1 bản ghi khỏi 1 tập hợp
  async function cRemoveRecord(sub, id){
    if(blockTourMutation('Bạn đang ở môi trường tham quan. Dữ liệu mẫu không được lưu vào Firebase.')) return;
    try{ await wref(sub).child(id).remove(); }catch(e){ console.error('Firebase remove lỗi:', sub, id, e); }
  }
  // Thêm bản ghi mới với key tự sinh bởi Firebase (dùng cho Nhật ký hoạt động)
  async function cPush(sub, value){
    if(blockTourMutation('Bạn đang ở môi trường tham quan. Dữ liệu mẫu không được lưu vào Firebase.')) return;
    try{ const ref = wref(sub).push(); await ref.set(value); return ref.key; }
    catch(e){ console.error('Firebase push lỗi:', sub, e); }
  }

  // ---------- LẮNG NGHE REALTIME (onValue) ----------
  // Thay cho polling — mọi thay đổi từ bất kỳ thiết bị nào (Xã/Ấp) sẽ đẩy
  // xuống ngay lập tức cho tất cả các thiết bị khác đang mở ứng dụng.
  let realtimeUnsubs = [];
  let dataAttached = false; // đã bind borrowers/expenses/trash/log hay chưa (chỉ bind khi KHÔNG "chờ duyệt")
  function attachRealtime(){
    detachRealtime();
    const bind = (sub, applyFn) => {
      const ref = wref(sub);
      const cb = snap => { applyFn(snap.val()); render(); };
      ref.on('value', cb);
      realtimeUnsubs.push(()=>ref.off('value', cb));
    };
    // config luôn được lắng nghe (cần để xác định vai trò / phát hiện bị Chủ mã xoá hoặc
    // đổi mật khẩu mã — kể cả khi tài khoản đang ở trạng thái "chờ duyệt"). Từ nay việc chia
    // sẻ quyền (Loại 1 công khai / Loại 2 đích danh) đều nằm sẵn trong config.publicPerms /
    // config.grants — không cần một node "collaborators" riêng như trước nữa.
    bind('config', v => {
      const hasEmail = !!(state.identity && state.identity.email);
      const isOwnerOfIt = hasEmail && v && v.ownerEmail === state.identity.email;
      state.config = v;
      // "Khác" luôn phải có mặt (đứng đầu) trong danh sách địa danh của MỌI xã/phường — kể cả dữ
      // liệu cũ tạo từ trước khi có yêu cầu này (chưa từng lưu lại qua modal quản lý địa danh), hoặc
      // thậm chí chưa từng thiết lập địa danh nào cả.
      if(state.config){
        const curHamlets = Array.isArray(state.config.hamlets) ? state.config.hamlets : [];
        if(!curHamlets.includes('Khác')) state.config = {...state.config, hamlets: ['Khác', ...curHamlets]};
      }
      if(v && v.deleted && !isOwnerOfIt){
        if(hasEmail) kickToWallet('Mã xã này đã bị Chủ mã xoá. Vui lòng liên hệ Chủ mã để biết thêm chi tiết.');
        else kickAnonymousToLogin('Mã định danh này đã bị Chủ mã xoá hoặc thay đổi.');
        return;
      }
      if(hasEmail && !isOwnerOfIt && v){
        const mine = (state.myWards||[]).find(w=>w.wardId===wardId());
        if(mine && typeof mine.av==='number' && (v.accessVersion||0)!==mine.av){
          kickToWallet('Chủ mã đã thay đổi cấu hình, vui lòng liên hệ Chủ mã để lấy mã mới.'); return;
        }
      }
      // Khách qua mã (không đăng nhập) không có "ví" để lưu accessVersion đã tham gia, nên
      // nếu Chủ mã đổi mật khẩu, họ chỉ mất quyền ở lần tải lại trang kế tiếp — hạn chế đã biết,
      // vì hệ thống không lưu phiên cho người dùng ẩn danh.
      maybeAttachData();
    });
    maybeAttachData();
  }
  function maybeAttachData(){
    if(dataAttached) return;
    if(isPending()){ render(); return; }
    dataAttached = true;
    const bind = (sub, applyFn) => {
      const ref = wref(sub);
      const cb = snap => { applyFn(snap.val()); render(); };
      ref.on('value', cb);
      realtimeUnsubs.push(()=>ref.off('value', cb));
    };
    bind('borrowers', v => { state.borrowers = snapToArray(v); refreshOpenBorrowerModalProjectPicker(); });
    bind('loanProjects', v => { state.loanProjects = snapToArray(v); refreshOpenBorrowerModalProjectPicker(); });
    bind('borrowerColumnPrefs', v => { state.borrowerColumnPrefsShared = v || null; });
    bind('interestApprovals', v => { state.interestApprovals = v || {}; });
    bind('interestApprovalColumnPrefs', v => { state.iaColumnPrefsShared = v || null; });
    bind('quarterSettingsHistory', v => { state.quarterSettingsHistory = snapToArray(v).sort((a,b)=> new Date(b.time)-new Date(a.time)); });
    bind('loanExtensions', v => { state.loanExtensions = v || {}; });
    bind('interestPaymentBoxes', v => { state.interestPaymentBoxes = v || {}; refreshOpenQuarterStatusLogModal(); refreshOpenIAModal(); });
    bind('receiptCategoriesPayment', v => { state.receiptCategoriesPayment = snapToArray(v); });
    bind('receiptCategoriesRefund', v => { state.receiptCategoriesRefund = snapToArray(v); });
    bind('borrowerManagers', v => { state.borrowerManagers = snapToArray(v); });
    bind('expenses', v => { state.expenses = snapToArray(v); });
    bind('trash', v => { state.trash = snapToArray(v); });
    bind('permanentlyDeletedBorrowers', v => { state.permanentlyDeletedBorrowers = snapToArray(v); });
    bind('borrowerReceipts', v => {
      const result = {};
      if(v) Object.keys(v).forEach(bid=>{ result[bid] = snapToArray(v[bid]); });
      state.borrowerReceipts = result;
    });
    bind('borrowerConfirmations', v => {
      const result = {};
      if(v) Object.keys(v).forEach(bid=>{ result[bid] = snapToArray(v[bid]); });
      state.borrowerConfirmations = result;
    });
    bind('sharedConfirmationDocuments', v => { state.sharedConfirmationDocuments = snapToArray(v); });
    bind('sharedBorrowerReceipts', v => { state.sharedBorrowerReceipts = snapToArray(v); });
    bind('columnViewSets', v => { state.columnViewSets = snapToArray(v); });
    bind('columnViewSetLog', v => { state.columnViewSetLog = snapToArray(v); });
    bind('loanColorLog', v => { state.loanColorLog = snapToArray(v); });
    bind('categoryChangeLog', v => { state.categoryChangeLog = snapToArray(v); });
    bind('quarterStatusLog', v => {
      const result = {};
      if(v) Object.keys(v).forEach(bid=>{ result[bid] = snapToArray(v[bid]); });
      state.quarterStatusLog = result;
      refreshOpenQuarterStatusLogModal();
    });
    render();
  }
  function detachRealtime(){ realtimeUnsubs.forEach(off=>off()); realtimeUnsubs = []; dataAttached = false; }
  // Văng người dùng (Khách đã đăng nhập Google) về màn hình "Ví mã xã" kèm thông báo — dùng
  // khi Chủ mã xoá hoặc đổi mật khẩu mã trong lúc Khách đang xem.
  function kickToWallet(message){
    detachRealtime();
    state.identity.wardId = '';
    setActiveWardCache('');
    state.config = null; state.borrowers=[]; state.loanProjects=[]; state.borrowerColumnPrefsShared=null; state.borrowerVisibleCols=null; state.borrowerColumnOrder=null; state.filterHamlets=null; state.filterProjectIds=null; state.filterFundSources=null; state.filterManagerIds=null; state.filterQuarters=null; state.filterQuartersAdvanced=false; state.filterYears=null; state.filterYearsAdvanced=false; state.mainTimeline=null; state.openFilterDropdown=null; state.surveys=[]; state.expenses=[]; state.trash=[]; state.log=[];
    alert(message);
    loadWallet().then(()=>{ state.view = 'wallet'; render(); });
  }
  // Văng Khách qua mã KHÔNG đăng nhập (codeGuest) về màn hình đăng nhập ban đầu.
  function kickAnonymousToLogin(message){
    detachRealtime();
    alert(message);
    state.identity = null;
    state.config = null; state.borrowers=[]; state.loanProjects=[]; state.borrowerColumnPrefsShared=null; state.borrowerVisibleCols=null; state.borrowerColumnOrder=null; state.filterHamlets=null; state.filterProjectIds=null; state.filterFundSources=null; state.filterManagerIds=null; state.filterQuarters=null; state.filterQuartersAdvanced=false; state.filterYears=null; state.filterYearsAdvanced=false; state.mainTimeline=null; state.openFilterDropdown=null; state.surveys=[]; state.expenses=[]; state.trash=[]; state.log=[];
    state.view = 'login';
    render();
  }

