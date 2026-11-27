  // =====================================================================
  // 20-branch-templates.js — Module CÔNG TÁC CHI HỘI, tính năng đầu tiên: KHO MẪU VĂN BẢN CỦA CHI HỘI.
  //
  // Ba lối vào:
  //   • Trang module (tab 'branch'): phần giới thiệu, thẻ Kho mẫu (nút Mở kho + nút Đóng góp), rồi các tính
  //     năng "sẽ sớm ra mắt".
  //   • Xem kho: duyệt thư mục/tệp y như trang tài liệu của Phòng họp không giấy (thanh địa chỉ, trình xem
  //     tệp có trước/sau, tải về). Ai vào được app đều xem và tải được, kể cả khách qua mã.
  //   • Ngăn đóng góp: cần đăng nhập Google. Tệp tải lên ở trạng thái 📝 Nháp, bấm "📨 Gửi đóng góp" thì
  //     chuyển sang 🕓 Chờ xem xét. Admin duyệt: ✅ đưa vào kho chung (CHÉP tệp sang kho) hoặc ↩️ chưa sử
  //     dụng (kèm lý do). Có kết quả thì tệp gốc trong ngăn bị xoá khỏi Storage, chỉ giữ dòng ghi nhận.
  //   • CÀI ĐẶT ADMIN → "Cài đặt module Công tác Chi hội (Kho tài liệu mẫu)": kho chính thức, đóng góp của
  //     mọi người, thùng rác kho.
  //
  // Lưu trữ (Realtime Database — CẤP GỐC, dùng chung toàn hệ thống, không theo mã xã):
  //   branch_templates/library                  — { docs:[…] } kho chính thức. Cùng cấu trúc mảng docs với
  //                                               cuộc họp (thư mục type:'folder' + parentId) để dùng lại các
  //                                               hàm cây thư mục / thanh địa chỉ / trình xem của 18-meeting.js.
  //                                               Mục đã xoá vẫn nằm trong mảng với deleted:true (thùng rác).
  //   branch_templates/contributions/{uid}      — ngăn đóng góp của từng tài khoản Google: tên hiển thị, có
  //                                               đồng ý ghi tên không, hạn mức trong ngày, docs:[…].
  //   branch_templates/stats/contribBytes       — tổng dung lượng tệp đóng góp đang lưu (nháp + chờ duyệt),
  //                                               để chặn khi cả hệ thống vượt ngưỡng. Admin mở màn duyệt là
  //                                               tự tính lại cho khớp.
  //   Storage branch_templates/library/…        — tệp kho chính thức. Bản ghi lưu sẵn link tải (storageUrl)
  //                                               vì mẫu văn bản là thứ công khai: ai cũng mở được mà không
  //                                               cần đăng nhập, không cần Cloud Function.
  //   Storage branch_templates/contrib/{uid}/…  — tệp đóng góp (KHÔNG lưu link; chỉ người góp và Admin mở).
  //
  // Mọi ghi vào một bản ghi đều qua transaction (đọc bản mới nhất rồi mới ghi) để hai người cùng sửa không
  // đè mất thay đổi của nhau.
  //
  // Phần này đứng CUỐI manifest nên chứa khối khởi động boot() ở cuối tệp.
  // =====================================================================

  // ---- GIỚI HẠN CỐ ĐỊNH (muốn đổi thì sửa ở đây) ----
  const BT_C_FILE_MB = 10;        // người đóng góp: mỗi tệp tối đa 10 MB
  const BT_C_DAY_FILES = 10;      // … mỗi ngày (giờ Việt Nam) tối đa 10 tệp
  const BT_C_DAY_MB = 25;         // … và 25 MB
  const BT_C_OPEN_FILES = 25;     // … trong ngăn tối đa 25 tệp CHƯA có kết quả (nháp + chờ duyệt)
  const BT_C_OPEN_MB = 75;        // … và 75 MB
  const BT_C_FOLDERS = 10, BT_C_DEPTH = 3;
  const BT_C_GLOBAL_MB = 1024;    // cả hệ thống: tệp đóng góp đang lưu vượt 1 GB thì tạm ngừng nhận
  const BT_L_FILE_MB = 30;        // Admin (kho chính thức): mỗi tệp tối đa 30 MB
  const BT_L_FILES = 300, BT_L_FOLDERS = 100, BT_L_DEPTH = 5; // tính cả mục trong thùng rác
  const BT_L_MB = 2048;           // kho tối đa 2 GB (tính cả thùng rác), cảnh báo từ 80%
  const BT_TITLE_MAX = 150, BT_NAME_MAX = 80, BT_REASON_MAX = 300;
  const BT_ALLOWED_RE = /\.(docx?|xlsx?|pptx?|pdf|odt|ods|odp|rtf|txt|png|jpe?g|webp|gif)$/i;
  const BT_ALLOWED_TEXT = 'Word, Excel, PowerPoint, PDF, ảnh (PNG/JPG) hoặc .txt';
  const BT_LIB_ROOT = 'Kho mẫu văn bản';
  const BT_C_ROOT = 'Ngăn đóng góp của tôi';
  const BT_TOUR_MSG = 'Đồng chí đang ở môi trường tham quan, vui lòng đăng nhập để sử dụng tính năng này.';
  const BT_LOGIN_MSG = 'Để đóng góp vào Kho mẫu văn bản, đồng chí vui lòng đăng nhập bằng tài khoản Google.';
  const BT_DECLINE_REASONS = ['Trùng với mẫu đã có trong kho', 'Còn thông tin cá nhân của hội viên', 'Chưa đúng thể thức văn bản', 'Lý do khác'];

  function btS(){
    if(!state.bt) state.bt = {
      view:'home', lib:null, libLoaded:false, libError:'', mine:null, mineLoaded:false, all:null, allLoaded:false, stats:null,
      libNav:{ id:null, path:[], notice:'' }, cNav:{ id:null, path:[], notice:'' }, q:'', showHidden:false, uploading:'',
      adminOpen:false, adminTab:'library', adminUid:null, aLibNav:{ id:null, path:[], notice:'' }, aCNav:{ id:null, path:[], notice:'' }, aStatus:'',
    };
    return state.bt;
  }
  function btUid(){ return (state.identity && state.identity.email && (state.identity.uid || (auth.currentUser && auth.currentUser.uid))) || ''; }
  function btNow(){ return new Date().toISOString(); }
  // Ngày theo giờ Việt Nam (UTC+7) — mốc tính hạn mức "mỗi ngày".
  function btVnDay(){ return new Date(Date.now() + 7*3600*1000).toISOString().slice(0,10); }
  function btBytes(n){ return driveFormatBytes(Math.max(0, n||0)); }
  function btActor(){ return (state.identity && (state.identity.name || state.identity.email)) || ''; }
  function btClean(o){ return JSON.parse(JSON.stringify(o)); } // bỏ mọi giá trị undefined (Firebase từ chối)
  function btFmtDay(iso){ const d = new Date(iso); return isNaN(d) ? '' : `${mtPad(d.getDate())}/${mtPad(d.getMonth()+1)}/${d.getFullYear()}`; }
  function btPlace(){
    const cfg = state.config || {};
    if(!wardId() || !(cfg.wardName||'').trim()) return '';
    const ward = `${adminLevelLabel()} ${(cfg.wardName||'').trim()}`;
    return (cfg.provinceName||'').trim() ? `${ward}, ${provinceLevelLabel()} ${(cfg.provinceName||'').trim()}` : ward;
  }
  function btCreditText(c){ return c && c.name ? `Đóng góp: đ/c ${c.name}${c.place ? ' — ' + c.place : ''}` : ''; }
  function btDlName(d){
    const ext = (String(d.name||'').match(/\.[a-z0-9]{1,6}$/i) || [''])[0];
    const t = mtDocTitle(d);
    return ext && !t.toLowerCase().endsWith(ext.toLowerCase()) ? t + ext : (t || d.name || 'mau-van-ban');
  }
  function btSeedFolders(){ return ['1. Biên bản sinh hoạt chi hội', '2. Danh sách điểm danh', `3. Báo cáo tháng gửi Hội cấp ${adminLevelLabelLower()}`, '4. Đơn xin vào Hội', '5. Biên bản bình xét thi đua', '6. Mẫu khác']; }
  function btWriteOk(kind){
    if(isTourMode()){ alert(BT_TOUR_MSG); return false; }
    if(kind==='lib' || kind==='admin'){ if(!isAdmin()){ alert('Chỉ Admin mới thao tác được ở đây.'); return false; } return true; }
    if(!btUid()){ alert(BT_LOGIN_MSG); return false; }
    return true;
  }

  // ---- Xem cây theo từng ngữ cảnh. Mọi hàm cây thư mục của Phòng họp nhận một đối tượng {docs}. ----
  function btAll(rec){ return mtDocs(rec); }
  function btLibLive(){ return { docs: btAll(btS().lib).filter(d=> !d.deleted) }; }
  function btLibFiles(){ return btAll(btS().lib).filter(d=> !mtIsFolder(d)); }
  function btLibBytes(){
    const seen = new Set(); let n = 0;
    btLibFiles().forEach(d=>{ const k = d.storagePath || d.id; if(!seen.has(k)){ seen.add(k); n += d.size||0; } });
    return n;
  }
  function btMineView(){
    const S = btS();
    return { docs: btAll(S.mine).filter(d=> mtIsFolder(d) || S.showHidden || !d.hidden) };
  }
  function btIsOpen(d){ return !mtIsFolder(d) && (d.status==='draft' || d.status==='pending' || !d.status); }
  function btOpenStats(rec){ const f = btAll(rec).filter(btIsOpen); return { files: f.length, bytes: f.reduce((a,d)=> a + (d.size||0), 0) }; }
  function btQuota(rec){ const q = (rec && rec.quota) || {}; return q.day===btVnDay() ? { files:q.files||0, bytes:q.bytes||0 } : { files:0, bytes:0 }; }
  // Admin chỉ thấy phần ĐÃ GỬI (không thấy nháp): tệp khác nháp + các thư mục có chứa chúng.
  function btAdminContribView(rec){
    const all = btAll(rec), map = mtFolderMap({ docs:all }), keep = new Set();
    all.forEach(d=>{
      if(mtIsFolder(d) || d.status==='draft' || !d.status) return;
      keep.add(d.id);
      let p = mtParentId(d, map), g = 0;
      while(p && g++ < 20){ keep.add(p); p = mtParentId(map[p], map); }
    });
    return { docs: all.filter(d=> keep.has(d.id)) };
  }
  function btPendingCount(rec){ return btAll(rec).filter(d=> !mtIsFolder(d) && d.status==='pending').length; }
  function btAdminPendingTotal(){ return Object.values(btS().all||{}).reduce((a,r)=> a + btPendingCount(r), 0); }
  function btNewResults(rec){ const seen = (rec && rec.seenResultsAt) || ''; return btAll(rec).filter(d=> (d.status==='accepted' || d.status==='declined') && (d.reviewedAt||'') > seen).length; }

  // ---- Dữ liệu mẫu cho môi trường tham quan (không đọc/ghi Firebase) ----
  function btDemoLib(){
    const now = btNow(), docs = [];
    const txt = (id, parentId, name, content, credit)=> ({ id, parentId, name, title: mtStripExt(name), mimeType:'text/plain', size: content.length, content, addedAt:now, updatedAt:now, credit });
    btSeedFolders().forEach((t,i)=> docs.push({ id:'btdemof'+i, type:'folder', parentId:null, title:t, addedAt:now }));
    docs.push(txt('btdemo1', 'btdemof0', 'Biên bản sinh hoạt chi hội định kỳ (mẫu).txt', 'HỘI NÔNG DÂN …\nCHI HỘI …\n\nBIÊN BẢN SINH HOẠT CHI HỘI\nTháng … năm …\n\nI. Thời gian, địa điểm, thành phần\n- Thời gian: … giờ … ngày …/…/…\n- Địa điểm: …\n- Chủ trì: …          Thư ký: …\n- Hội viên có mặt: …/… (vắng có lý do: …, không lý do: …)\n\nII. Nội dung\n1. Đánh giá kết quả hoạt động tháng trước: …\n2. Phổ biến chủ trương, nhiệm vụ của Hội cấp trên: …\n3. Ý kiến của hội viên: …\n4. Nhiệm vụ tháng tới: …\n\nBuổi sinh hoạt kết thúc lúc … giờ … cùng ngày.\n\nTHƯ KÝ                    CHI HỘI TRƯỞNG\n(ký, ghi rõ họ tên)        (ký, ghi rõ họ tên)', { name:'Nguyễn Văn A', place:'Xã Mẫu, Tỉnh Mẫu' }));
    docs.push(txt('btdemo2', 'btdemof1', 'Danh sách điểm danh sinh hoạt chi hội (mẫu).txt', 'DANH SÁCH ĐIỂM DANH HỘI VIÊN\nBuổi sinh hoạt ngày …/…/…\n\nSTT | Họ và tên | Tổ hội | Có mặt | Vắng (lý do) | Ký tên\n1   | …         | …      |        |              |\n2   | …         | …      |        |              |\n3   | …         | …      |        |              |'));
    docs.push(txt('btdemo3', 'btdemof3', 'Đơn xin vào Hội Nông dân Việt Nam (mẫu).txt', 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nĐƠN XIN VÀO HỘI NÔNG DÂN VIỆT NAM\n\nKính gửi: Ban Chấp hành Chi hội …\n\nTôi tên là: …        Sinh năm: …\nNơi cư trú: …\nNghề nghiệp: …\n\nSau khi được tìm hiểu Điều lệ Hội Nông dân Việt Nam, tôi tự nguyện làm đơn xin vào Hội …'));
    docs.push(txt('btdemo4', null, 'Hướng dẫn sử dụng kho mẫu.txt', 'Bấm vào thư mục để xem các mẫu bên trong. Bấm vào tên mẫu để xem trước, bấm ⬇ để tải về máy rồi điền bằng Word/Excel.\n\n(Đây là dữ liệu mẫu của môi trường tham quan.)'));
    return { docs, updatedAt: now };
  }
  function btDemoMine(){
    const now = btNow(), old = new Date(Date.now() - 2*86400000).toISOString();
    const f = (id, parentId, name, extra)=> ({ id, parentId, name, title: mtStripExt(name), mimeType:'text/plain', size: 2048, content:'(Tệp mẫu của môi trường tham quan.)', addedAt: old, updatedAt: old, ...extra });
    return {
      displayName:'Khách tham quan', credit:true, quota:{ day: btVnDay(), files:2, bytes: 4096 },
      docs:[
        { id:'btdc_f1', type:'folder', parentId:null, title:'Mẫu của chi hội tôi', addedAt: old },
        f('btdc1', 'btdc_f1', 'Biên bản bình xét hội viên xuất sắc.txt', { status:'draft' }),
        f('btdc2', 'btdc_f1', 'Báo cáo tháng chi hội.txt', { status:'pending', submittedAt: old }),
        f('btdc3', null, 'Danh sách hộ đăng ký sản xuất giỏi.txt', { status:'accepted', submittedAt: old, reviewedAt: now, acceptedTo: `${BT_LIB_ROOT} › 6. Mẫu khác`, storagePath:null, content:null }),
        f('btdc4', null, 'Ảnh chụp sổ tay.txt', { status:'declined', submittedAt: old, reviewedAt: now, declineReason:'Còn thông tin cá nhân của hội viên', content:null }),
      ],
    };
  }

  // ---- Lắng nghe dữ liệu ----
  let btLibRef = null, btLibKey = null, btMineRef = null, btMineKey = null, btAllRef = null, btStatsRef = null;
  function btAttachLib(){
    const S = btS();
    const key = isTourMode() ? 'tour' : 'live';
    if(btLibKey===key) return;
    if(btLibRef){ try{ btLibRef.off(); }catch(e){} btLibRef = null; }
    btLibKey = key;
    if(key==='tour'){ S.lib = btDemoLib(); S.libLoaded = true; S.libError = ''; return; }
    S.lib = null; S.libLoaded = false;
    btLibRef = rtdb.ref('branch_templates/library');
    btLibRef.on('value', snap=>{ S.lib = (snap && snap.val()) || { docs:[] }; S.libLoaded = true; S.libError = ''; btOnData(); },
      err=>{ console.error('[Kho mẫu] Không tải được kho:', err); S.libLoaded = true; S.libError = 'Không tải được Kho mẫu văn bản. Vui lòng kiểm tra kết nối mạng rồi tải lại trang.'; btOnData(); });
  }
  function btAttachMine(){
    const S = btS();
    const key = isTourMode() ? 'tour' : (btUid() || 'none');
    if(btMineKey===key) return;
    if(btMineRef){ try{ btMineRef.off(); }catch(e){} btMineRef = null; }
    btMineKey = key;
    if(key==='tour'){ S.mine = btDemoMine(); S.mineLoaded = true; return; }
    S.mine = null; S.mineLoaded = key==='none';
    if(key==='none') return;
    btMineRef = rtdb.ref(`branch_templates/contributions/${key}`);
    btMineRef.on('value', snap=>{ S.mine = (snap && snap.val()) || null; S.mineLoaded = true; btOnData(); },
      err=>{ console.error('[Kho mẫu] Không tải được ngăn đóng góp:', err); S.mineLoaded = true; btOnData(); });
  }
  function btAttachAll(){
    const S = btS();
    if(isTourMode() || !isAdmin()){
      if(btAllRef){ try{ btAllRef.off(); }catch(e){} btAllRef = null; S.all = null; S.allLoaded = false; }
      return;
    }
    if(btAllRef) return;
    btAllRef = rtdb.ref('branch_templates/contributions');
    btAllRef.on('value', snap=>{ S.all = (snap && snap.val()) || {}; S.allLoaded = true; btFixStats(); btOnData(); },
      err=>{ console.error('[Kho mẫu] Admin không tải được danh sách đóng góp:', err); S.all = {}; S.allLoaded = true; btOnData(); });
  }
  function btAttachStats(){
    if(btStatsRef || isTourMode()) return;
    btStatsRef = rtdb.ref('branch_templates/stats');
    btStatsRef.on('value', snap=>{ btS().stats = (snap && snap.val()) || {}; }, ()=>{});
  }
  // Admin vừa tải danh sách đóng góp: tính lại tổng dung lượng tệp đóng góp đang lưu, lệch thì sửa cho khớp.
  function btFixStats(){
    const S = btS(); if(!S.all || isTourMode()) return;
    let n = 0;
    Object.values(S.all).forEach(r=> btAll(r).forEach(d=>{ if(!mtIsFolder(d) && d.storagePath) n += d.size||0; }));
    const cur = S.stats && S.stats.contribBytes;
    if(cur!==n){ rtdb.ref('branch_templates/stats/contribBytes').set(n).catch(()=>{}); }
  }
  function btStatAdd(delta){
    if(!delta || isTourMode()) return;
    rtdb.ref('branch_templates/stats/contribBytes').transaction(v=> Math.max(0, (Number(v)||0) + delta)).catch(()=>{});
  }
  let btPaintQueued = false;
  function btOnData(){
    if(btPaintQueued) return;
    btPaintQueued = true;
    requestAnimationFrame(()=>{
      btPaintQueued = false;
      btUpdateNavBadge();
      if(state.view!=='app') return;
      const el = document.getElementById('content'); if(!el) return;
      const S = btS();
      if(state.activeTab==='branch'){
        if(S.view==='library' && el.querySelector('#bt-lib-box')) btPaintLibrary(el);
        else if(S.view==='contrib' && el.querySelector('#bt-c-tree')) btPaintContrib(el);
        else if(S.view==='home' && el.querySelector('.bt-page')) btRenderHome(el);
      } else if(state.activeTab==='adminSettings' && S.adminOpen && el.querySelector('#bt-a-body')) btPaintAdmin(el);
    });
  }
  // Số đóng góp đang chờ duyệt cho chấm đỏ ở mục CÀI ĐẶT ADMIN trên menu trái (gọi từ navItems()).
  function btAdminPendingBadge(){
    if(isTourMode() || !isAdmin()) return '';
    btAttachAll();
    const n = btAdminPendingTotal();
    return n ? String(n) : '';
  }
  function btUpdateNavBadge(){
    const btn = document.querySelector('.nav-item[data-tab="adminSettings"]'); if(!btn) return;
    const n = btAdminPendingBadge();
    let b = btn.querySelector('.badge');
    if(!n){ if(b) b.remove(); return; }
    if(!b){ b = document.createElement('span'); b.className = 'badge'; btn.appendChild(b); }
    b.textContent = n;
  }

  // ---- Ghi: mọi thay đổi một bản ghi đều qua transaction. mutate(docs, rec) sửa trực tiếp mảng docs.
  // KHÔNG huỷ transaction khi không tìm thấy mục (lượt chạy đầu có thể dùng bộ nhớ đệm cũ) — chỉ bỏ qua.
  function btRef(t){ return t.kind==='lib' ? rtdb.ref('branch_templates/library') : rtdb.ref(`branch_templates/contributions/${t.uid}`); }
  function btRec(t){
    const S = btS();
    if(t.kind==='lib') return S.lib;
    if(t.uid===btUid() && S.mine) return S.mine;
    return (S.all||{})[t.uid] || null;
  }
  async function btTx(t, mutate){
    try{
      const r = await btRef(t).transaction(cur=>{
        const rec = cur ? { ...cur } : {};
        const docs = mtDocs(rec).map(d=> ({ ...d }));
        mutate(docs, rec);
        rec.docs = docs; rec.updatedAt = btNow();
        return btClean(rec);
      });
      return !!(r && r.committed);
    }catch(e){
      console.error('[Kho mẫu] Lưu lỗi:', e);
      alert('Không lưu được thay đổi: ' + (e && e.message || e));
      return false;
    }
  }
  function btDeleteStorage(path){
    if(!path || typeof storage==='undefined') return;
    try{ storage.ref(path).delete().catch(e=> console.warn('[Kho mẫu] Không xoá được tệp trên Storage (bỏ qua):', e)); }catch(e){}
  }
  function btPickFiles(multiple){
    return new Promise(resolve=>{
      const input = document.createElement('input');
      input.type = 'file'; input.multiple = !!multiple;
      input.accept = '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.odt,.ods,.odp,.rtf,.txt,.png,.jpg,.jpeg,.webp,.gif';
      input.onchange = ()=> resolve(Array.from(input.files||[]));
      input.click();
    });
  }
  function btSetStatus(id, text){
    const box = document.getElementById(id);
    if(box){ box.textContent = text || ''; box.style.display = text ? '' : 'none'; }
  }
  async function btUploadOne(t, file, docId, statusId){
    const path = t.kind==='lib' ? `branch_templates/library/${docId}_${mtSafeName(file.name)}` : `branch_templates/contrib/${t.uid}/${docId}_${mtSafeName(file.name)}`;
    const ref = storage.ref(path);
    const task = ref.put(file, { contentType: file.type || 'application/octet-stream' });
    if(task && task.on) task.on('state_changed', snap=>{
      if(snap && snap.totalBytes) btSetStatus(statusId, `⏳ Đang tải "${file.name}"… ${Math.round(snap.bytesTransferred/snap.totalBytes*100)}%`);
    });
    await task;
    const out = { storagePath: path };
    if(t.kind==='lib'){ try{ out.storageUrl = await ref.getDownloadURL(); }catch(e){ console.warn('[Kho mẫu] Không lấy được link tải:', e); } }
    return out;
  }
  function btFlashSaved(){
    const s = document.getElementById('bt-saved'); if(!s) return;
    s.textContent = '✓ Đã lưu'; s.classList.add('show');
    clearTimeout(btFlashSaved._t); btFlashSaved._t = setTimeout(()=> s.classList.remove('show'), 1600);
  }
  function btMoveBlockReason(view, id, targetId, maxDepth){
    const it = view.docs.find(d=> d.id===id); if(!it) return 'Mục này không còn nữa.';
    const map = mtFolderMap(view);
    if((targetId||null)===mtParentId(it, map)) return 'Mục này đang nằm ở đây rồi.';
    if(mtIsFolder(it)){
      if(targetId===id || (targetId && mtDescendantIds(view, id).has(targetId))) return 'Không chuyển được thư mục vào chính nó hoặc thư mục con của nó.';
      if(mtFolderPath(view, targetId).length + mtSubtreeHeight(view, id) > maxDepth) return `Vượt quá ${maxDepth} tầng thư mục lồng nhau.`;
    }
    return '';
  }

  // ---- Thao tác chung trên cây (kho chính thức / ngăn đóng góp). cx = { t, view(), maxDepth, maxFolders,
  // folderCount(), rootName } ----
  async function btCreateFolder(cx, parentId){
    if(!btWriteOk(cx.t.kind==='lib' ? 'lib' : 'contrib')) return null;
    if(cx.folderCount() >= cx.maxFolders){ alert(`Tối đa ${cx.maxFolders} thư mục.`); return null; }
    if(mtFolderPath(cx.view(), parentId).length + 1 > cx.maxDepth){ alert(`Chỉ tạo được tối đa ${cx.maxDepth} tầng thư mục lồng nhau.`); return null; }
    const name = await mtPromptModal('➕ Thư mục mới', 'Tên thư mục', 'Thư mục mới');
    if(!name) return null;
    const folder = { id: mtDocId(), type:'folder', parentId: parentId || null, title: name, addedAt: btNow(), updatedAt: btNow() };
    return await btTx(cx.t, docs=>{ docs.push(folder); }) ? folder : null;
  }
  async function btRename(cx, id){
    if(!btWriteOk(cx.t.kind==='lib' ? 'lib' : (cx.t.uid===btUid() ? 'contrib' : 'admin'))) return;
    const it = cx.view().docs.find(d=> d.id===id); if(!it) return;
    const name = await mtPromptModal(mtIsFolder(it) ? '✏️ Đổi tên thư mục' : '✏️ Đổi tên tài liệu', mtIsFolder(it) ? 'Tên thư mục' : 'Tên hiển thị', mtDocTitle(it));
    if(!name || name===mtDocTitle(it)) return;
    if(await btTx(cx.t, docs=>{ const x = docs.find(d=> d.id===id); if(x){ x.title = name; x.updatedAt = btNow(); } })) btFlashSaved();
  }
  async function btMove(cx, id, targetId){
    if(!btWriteOk(cx.t.kind==='lib' ? 'lib' : 'contrib')) return false;
    const why = btMoveBlockReason(cx.view(), id, targetId, cx.maxDepth);
    if(why){ if(!/đang nằm ở đây/.test(why)) alert(why); return false; }
    const ok = await btTx(cx.t, docs=>{
      const i = docs.findIndex(d=> d.id===id); if(i<0) return;
      const [x] = docs.splice(i, 1); x.parentId = targetId || null; x.updatedAt = btNow(); docs.push(x);
    });
    if(ok){ const f = targetId && mtFolderMap(cx.view())[targetId]; showToast(`Đã chuyển vào “${f ? mtDocTitle(f) : cx.rootName}”.`); }
    return ok;
  }
  async function btReorder(cx, id, targetId, after){
    if(id===targetId || !btWriteOk(cx.t.kind==='lib' ? 'lib' : 'contrib')) return;
    const view = cx.view(), map = mtFolderMap(view);
    const it = view.docs.find(d=> d.id===id), tg = view.docs.find(d=> d.id===targetId);
    if(!it || !tg) return;
    if(mtParentId(it, map)!==mtParentId(tg, map)){ await btMove(cx, id, mtParentId(tg, map)); return; }
    await btTx(cx.t, docs=>{
      const a = docs.findIndex(d=> d.id===id); if(a<0) return;
      const [x] = docs.splice(a, 1);
      const b = docs.findIndex(d=> d.id===targetId);
      docs.splice(b<0 ? docs.length : b + (after ? 1 : 0), 0, x);
    });
  }
  async function btStep(cx, id, dir){
    const view = cx.view(), it = view.docs.find(d=> d.id===id); if(!it) return;
    const sib = mtChildren(view, mtParentId(it, mtFolderMap(view))), i = sib.findIndex(d=> d.id===id), j = i + dir;
    if(j<0 || j>=sib.length) return;
    await btReorder(cx, id, sib[j].id, dir>0);
  }
  // Hộp chọn thư mục kiểu Google Drive (dùng cho "Di chuyển" và "Đưa vào kho chung").
  // o = { view(), rootName, title, okLabel, startAt, blocked:Set, reason(at), extraHtml, newFolder(at)→Promise<folder> }
  function btFolderPicker(o){
    return new Promise(resolve=>{
      let at = o.startAt || null;
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg mt-font';
      document.body.appendChild(wrap);
      const done = v=>{ wrap.remove(); resolve(v); };
      let extraVals = null;
      const paint = ()=>{
        const view = o.view(), map = mtFolderMap(view);
        if(at && !map[at]) at = null;
        const blocked = o.blocked || new Set();
        const subs = mtChildren(view, at).filter(mtIsFolder);
        const why = o.reason ? o.reason(at) : '';
        const keepExtra = wrap.querySelector('[data-bt-extra]');
        if(keepExtra) extraVals = Array.from(keepExtra.querySelectorAll('input,textarea')).map(x=> x.type==='checkbox' ? x.checked : x.value);
        wrap.innerHTML = `<div class="modal" style="max-width:540px;" role="dialog" aria-modal="true">
          <div class="modal-head"><h3>${escapeHtml(o.title)}</h3><button class="modal-close" data-pk-close aria-label="Đóng">✕</button></div>
          <div class="modal-body">
            ${o.extraHtml ? `<div data-bt-extra>${o.extraHtml}</div>` : ''}
            <div class="mt-hint" style="margin-bottom:6px;">Chọn thư mục đích:</div>
            ${mtCrumbsHtml(mtFolderPath(view, at), 'pk-crumb', o.rootName)}
            <div class="mt-mv-list">${subs.length ? subs.map(f=>`<button type="button" class="mt-mv-row ${blocked.has(f.id) ? 'off' : ''}" data-pk-open="${escapeHtml(f.id)}" ${blocked.has(f.id) ? 'disabled' : ''}><span class="mt-fico">📁</span><span class="mt-mv-name">${escapeHtml(mtDocTitle(f))}<small>${escapeHtml(mtCountsText(view, f.id))}</small></span><span aria-hidden="true">›</span></button>`).join('') : '<div class="mt-mv-empty">Không có thư mục con.</div>'}</div>
            ${o.newFolder ? '<button type="button" class="btn btn-ghost btn-sm" data-pk-new>➕ Thư mục mới ở đây</button>' : ''}
            ${why && !/đang nằm ở đây/.test(why) ? `<div class="mt-warn" style="margin-top:10px;">${escapeHtml(why)}</div>` : ''}
          </div>
          <div class="modal-foot"><button class="btn btn-ghost" data-pk-close>Huỷ</button><button class="btn btn-primary" data-pk-ok ${why ? 'disabled' : ''}>${escapeHtml(o.okLabel)}</button></div>
        </div>`;
        const ex = wrap.querySelector('[data-bt-extra]');
        if(ex && extraVals) Array.from(ex.querySelectorAll('input,textarea')).forEach((x,i)=>{ if(x.type==='checkbox') x.checked = !!extraVals[i]; else x.value = extraVals[i]; });
        if(ex) mtWireCounters(ex);
        wrap.querySelectorAll('[data-pk-close]').forEach(b=> b.onclick = ()=> done(null));
        wrap.querySelectorAll('[data-pk-crumb]').forEach(b=> b.onclick = ()=>{ at = b.dataset.pkCrumb || null; paint(); });
        wrap.querySelectorAll('[data-pk-open]').forEach(b=> b.onclick = ()=>{ at = b.dataset.pkOpen; paint(); });
        const nb = wrap.querySelector('[data-pk-new]');
        if(nb) nb.onclick = async ()=>{ const f = await o.newFolder(at); if(f) setTimeout(()=>{ at = f.id; paint(); }, 80); };
        wrap.querySelector('[data-pk-ok]').onclick = ()=>{
          const exNow = wrap.querySelector('[data-bt-extra]');
          done({ at, extra: exNow });
        };
      };
      paint();
    });
  }
  async function btMoveModal(cx, id){
    if(!btWriteOk(cx.t.kind==='lib' ? 'lib' : 'contrib')) return;
    const it = cx.view().docs.find(d=> d.id===id); if(!it) return;
    const r = await btFolderPicker({
      view: cx.view, rootName: cx.rootName, title:`📂 Di chuyển “${mtDocTitle(it)}”`, okLabel:'Di chuyển đến đây',
      startAt: mtParentId(it, mtFolderMap(cx.view())),
      blocked: mtIsFolder(it) ? new Set([id, ...mtDescendantIds(cx.view(), id)]) : new Set(),
      reason: at=> btMoveBlockReason(cx.view(), id, at, cx.maxDepth),
      newFolder: at=> btCreateFolder(cx, at),
    });
    if(r) await btMove(cx, id, r.at);
  }

  // ---- Vẽ một thư mục kiểu trình sửa của Phòng họp: thanh địa chỉ, dòng đánh số, ▲▼, ⋮, kéo thả.
  // cfg = { view, nav, rootName, canEdit, draggable(d), meta(d), menu(d), rowButtons(d), go(id), openFile(id),
  //         cx (cho kéo thả / ▲▼), empty } ----
  function btResolveNav(view, nav, rootName){
    const r = mtResolveFolder(view, nav.id, nav.path, rootName);
    if(r.id!==nav.id){ nav.id = r.id; nav.notice = r.notice; }
    nav.path = mtFolderPath(view, nav.id).map(f=> f.id);
    return nav;
  }
  function btPaintTree(box, cfg){
    const view = cfg.view, nav = btResolveNav(view, cfg.nav, cfg.rootName), fid = nav.id;
    const path = mtFolderPath(view, fid), kids = mtChildren(view, fid);
    const notice = nav.notice ? `<div class="mt-warn">${escapeHtml(nav.notice)}</div>` : '';
    nav.notice = '';
    const rows = kids.map((d,i)=>{
      const id = escapeHtml(d.id), drag = cfg.canEdit && cfg.draggable(d);
      const step = drag ? `<button class="btn btn-ghost btn-sm preview-allow" data-bt-up="${id}" title="Đưa lên trên" ${i===0?'disabled':''}>▲</button><button class="btn btn-ghost btn-sm preview-allow" data-bt-down="${id}" title="Đưa xuống dưới" ${i===kids.length-1?'disabled':''}>▼</button>` : '';
      const more = cfg.menu(d).length ? `<button class="btn btn-ghost btn-sm mt-more preview-allow" data-bt-more="${id}" title="Thao tác khác" aria-label="Thao tác khác">⋮</button>` : '';
      const extra = cfg.rowButtons ? cfg.rowButtons(d) : '';
      if(mtIsFolder(d)) return `<div class="mt-doc mt-folder" data-bt-item="${id}" ${drag ? 'draggable="true"' : ''}>
          ${drag ? '<span class="mt-doc-handle" title="Kéo để đổi thứ tự hoặc thả vào thư mục">⠿</span>' : ''}
          <span class="mt-doc-num">${i+1}</span><span class="mt-doc-ico mt-fico">📁</span>
          <button type="button" class="mt-doc-main mt-doc-open preview-allow" data-bt-open-folder="${id}" title="Mở thư mục"><b>${escapeHtml(mtDocTitle(d))}</b><small>${escapeHtml(mtCountsText(view, d.id))}</small></button>
          <div class="mt-doc-actions">${extra}${step}<button class="btn btn-ghost btn-sm preview-allow" data-bt-open-folder="${id}" title="Mở thư mục">Mở ›</button>${more}</div>
        </div>`;
      return `<div class="mt-doc" data-bt-item="${id}" ${drag ? 'draggable="true"' : ''}>
          ${drag ? '<span class="mt-doc-handle" title="Kéo để đổi thứ tự hoặc thả vào thư mục">⠿</span>' : ''}
          <span class="mt-doc-num">${i+1}</span>
          <span class="mt-doc-ico">${driveNodeIcon({type:'file', name:d.name, mimeType:d.mimeType})}</span>
          <button type="button" class="mt-doc-main mt-doc-open preview-allow" data-bt-view="${id}" title="Xem tài liệu"><b>${escapeHtml(mtDocTitle(d))}</b><small>${cfg.meta(d)}</small></button>
          <div class="mt-doc-actions">${extra}${step}${d.storagePath || d.content!=null ? `<button class="btn btn-ghost btn-sm preview-allow" data-bt-view="${id}" title="Xem tài liệu">👁</button>` : ''}${more}</div>
        </div>`;
    }).join('');
    box.innerHTML = `${notice}${mtCrumbsHtml(path, 'bt-crumb', cfg.rootName)}
      ${kids.length ? `<div class="mt-docs">${rows}</div>` : `<div class="empty-state" style="padding:22px;"><div class="e-ico">📂</div>${escapeHtml(fid ? 'Thư mục này chưa có tài liệu.' : cfg.empty)}</div>`}`;
    box.querySelectorAll('[data-bt-crumb]').forEach(b=> b.onclick = ()=> cfg.go(b.dataset.btCrumb || null));
    box.querySelectorAll('[data-bt-open-folder]').forEach(b=> b.onclick = ()=> cfg.go(b.dataset.btOpenFolder));
    box.querySelectorAll('[data-bt-view]').forEach(b=> b.onclick = ()=> cfg.openFile(b.dataset.btView));
    if(cfg.cx){
      box.querySelectorAll('[data-bt-up]').forEach(b=> b.onclick = ()=> btStep(cfg.cx, b.dataset.btUp, -1));
      box.querySelectorAll('[data-bt-down]').forEach(b=> b.onclick = ()=> btStep(cfg.cx, b.dataset.btDown, 1));
    }
    const menuFor = (id, ev)=>{ const it = view.docs.find(d=> d.id===id); if(!it) return; const items = cfg.menu(it); if(items.length) mtOpenMenu(ev, items); };
    box.querySelectorAll('[data-bt-more]').forEach(b=> b.onclick = e=>{ e.stopPropagation(); menuFor(b.dataset.btMore, e); });
    box.querySelectorAll('[data-bt-item]').forEach(row=> row.addEventListener('contextmenu', e=>{ const it = view.docs.find(d=> d.id===row.dataset.btItem); if(it && cfg.menu(it).length){ e.preventDefault(); menuFor(row.dataset.btItem, e); } }));
    if(cfg.wire) cfg.wire(box);
    if(cfg.canEdit && cfg.cx) btWireDnD(box, cfg.cx);
  }
  // Kéo thả trên máy tính — y như Phòng họp: thả vào GIỮA dòng thư mục = chuyển vào; nửa trên/dưới = đổi thứ
  // tự; thả lên thanh địa chỉ = chuyển lên thư mục đó.
  function btWireDnD(box, cx){
    let dragId = null;
    const clear = ()=> box.querySelectorAll('.drop-into,.drop-before,.drop-after,.dragging').forEach(x=> x.classList.remove('drop-into','drop-before','drop-after','dragging'));
    box.querySelectorAll('[data-bt-item][draggable]').forEach(row=>{
      row.addEventListener('dragstart', e=>{ dragId = row.dataset.btItem; row.classList.add('dragging'); try{ e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); }catch(err){} });
      row.addEventListener('dragend', ()=>{ dragId = null; clear(); });
      row.addEventListener('dragover', e=>{
        if(!dragId || dragId===row.dataset.btItem) return;
        e.preventDefault();
        const r = row.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
        const mode = row.classList.contains('mt-folder') && y>0.25 && y<0.75 ? 'into' : (y<0.5 ? 'before' : 'after');
        if(row.dataset.dropMode===mode) return;
        clear(); row.classList.add('drop-'+mode); row.dataset.dropMode = mode;
      });
      row.addEventListener('dragleave', e=>{ if(!row.contains(e.relatedTarget)){ row.classList.remove('drop-into','drop-before','drop-after'); delete row.dataset.dropMode; } });
      row.addEventListener('drop', e=>{
        e.preventDefault();
        const id = dragId, mode = row.dataset.dropMode; dragId = null; delete row.dataset.dropMode; clear();
        if(!id || !mode || id===row.dataset.btItem) return;
        if(mode==='into') btMove(cx, id, row.dataset.btItem);
        else btReorder(cx, id, row.dataset.btItem, mode==='after');
      });
    });
    box.querySelectorAll('[data-bt-crumb]').forEach(c=>{
      c.addEventListener('dragover', e=>{ if(!dragId) return; e.preventDefault(); c.classList.add('drop-into'); });
      c.addEventListener('dragleave', ()=> c.classList.remove('drop-into'));
      c.addEventListener('drop', e=>{ e.preventDefault(); c.classList.remove('drop-into'); const id = dragId; dragId = null; clear(); if(id) btMove(cx, id, c.dataset.btCrumb || null); });
    });
  }

  // ---- Xem / tải tệp ----
  // Trình xem của Phòng họp (mtOpenDocViewer) lấy link tạm từ doc.storageUrl; tệp đóng góp không lưu link
  // nên lấy link bằng quyền của người đang xem ngay trước khi mở.
  function btOpenViewer(files, index){
    const list = files.map(d=> ({ ...d }));
    let viewer = null;
    const open = async idx=>{
      const d = list[idx]; if(!d) return;
      if(d.content==null && !d.storageUrl && d.storagePath){
        try{ d.storageUrl = await storage.ref(d.storagePath).getDownloadURL(); }
        catch(e){ console.warn('[Kho mẫu] Không lấy được link xem:', e); alert('Không mở được tài liệu. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); return; }
      }
      if(viewer){ const v = viewer; viewer = null; v.close(true); }
      viewer = mtOpenDocViewer(list, idx, ni=> open(ni), ()=>{ viewer = null; }, { preview:true, backLabel:'‹ Quay lại', backRed:true });
    };
    open(index);
  }
  async function btDownload(d){
    let url = '';
    try{
      let blob;
      if(d.content!=null) blob = new Blob([d.content], { type:'text/plain;charset=utf-8' });
      else {
        url = d.storageUrl || (d.storagePath ? await storage.ref(d.storagePath).getDownloadURL() : '');
        if(!url) throw new Error('Không có tệp');
        const r = await fetch(url);
        if(!r.ok) throw new Error('HTTP ' + r.status);
        blob = await r.blob();
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = btDlName(d);
      document.body.appendChild(a); a.click();
      setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); }catch(e){} a.remove(); }, 5000);
      showToast(`Đang tải về “${btDlName(d)}”.`);
    }catch(e){
      console.warn('[Kho mẫu] Tải về lỗi:', e);
      if(url) window.open(url, '_blank', 'noopener');
      else alert('Không tải được tài liệu. Vui lòng kiểm tra kết nối mạng rồi thử lại.');
    }
  }

  // =====================================================================
  // TRANG MODULE
  // =====================================================================
  function btSoonCards(){
    return [
      ['👥','Quản lý hội viên của chi hội mình',
       'Danh sách hội viên trong chi hội, tổ hội trực thuộc, thông tin liên lạc, ngành nghề, hoàn cảnh cần lưu ý. Chi hội trưởng chỉ thấy phần của chi hội mình, không lẫn sang nơi khác.'],
      ['📊','Thống kê tự động',
       'Số hội viên tăng giảm trong kỳ, tỷ lệ tham gia sinh hoạt, tình hình đóng hội phí, kết quả các phong trào — tự tổng hợp thành số liệu để báo cáo, khỏi ngồi đếm tay.'],
      ['🏡','Theo dõi tổ hội',
       'Chi hội có nhiều tổ hội thì quản lý được từng tổ: ai làm tổ trưởng, bao nhiêu hội viên, sinh hoạt đến đâu.'],
      ['💬','Chăm sóc hội viên trong chi hội',
       'Nhắn tin, thông báo lịch sinh hoạt, hỏi thăm — dùng chung cơ chế với module Chăm sóc hội viên nhưng gói gọn trong phạm vi chi hội mình phụ trách.'],
      ['🔄',`Nối liền với Hội cấp ${adminLevelLabelLower()}`,
       `Số liệu chi hội báo lên tự động cộng vào số liệu chung của Hội ${adminLevelLabelLower()}; chỉ đạo từ Hội ${adminLevelLabelLower()} cũng chuyển thẳng xuống chi hội, không còn tam sao thất bản qua nhiều khâu.`],
    ];
  }
  function renderBranchTab(el){
    if(!el) return;
    btAttachLib(); btAttachMine(); btAttachStats();
    const S = btS();
    if(S.view==='library') btRenderLibrary(el);
    else if(S.view==='contrib' && (btUid() || isTourMode())) btRenderContrib(el);
    else { S.view = 'home'; btRenderHome(el); }
  }
  function btGo(view){
    const S = btS(); S.view = view;
    const el = document.getElementById('content');
    if(el) renderBranchTab(el);
    window.scrollTo(0, 0);
  }
  function btRenderHome(el){
    const S = btS(), live = btLibLive();
    const nFiles = live.docs.filter(d=> !mtIsFolder(d)).length, nFolders = live.docs.filter(mtIsFolder).length;
    const updated = S.lib && S.lib.updatedAt ? btFmtDay(S.lib.updatedAt) : '';
    const stats = !S.libLoaded ? 'Đang tải kho…' : S.libError ? '⚠️ ' + S.libError
      : (nFiles || nFolders) ? [nFolders ? `📁 ${nFolders} thư mục` : '', `📄 ${nFiles} mẫu văn bản`, updated ? `🕗 Cập nhật ${updated}` : ''].filter(Boolean).join(' · ')
      : '📭 Kho đang được Ban quản trị chuẩn bị — mời đồng chí đóng góp những mẫu đang dùng ở chi hội mình.';
    const fresh = btNewResults(S.mine);
    el.innerHTML = `
      <div class="upcoming-page bt-page">
        <div class="upcoming-card bt-hero">
          <div class="upcoming-head">
            <div class="upcoming-ico">🌾</div>
            <div><div class="eyebrow">CẤP CHI HỘI</div><h3>Công tác Chi hội</h3></div>
          </div>
          <p class="upcoming-lead">Chi hội khu dân cư và chi hội nghề nghiệp là cấp gần hội viên nhất, nhưng lại thiếu công cụ nhất — thường chỉ có cuốn sổ tay và vài tờ giấy. Module này dành riêng cho cán bộ chi hội.</p>
        </div>

        <section class="bt-feature" aria-labelledby="bt-feature-title">
          <div class="bt-feature-head">
            <div class="bt-feature-ico">📄</div>
            <div>
              <span class="bt-feature-tag">✅ Đã sử dụng được</span>
              <h3 id="bt-feature-title">Kho mẫu văn bản của chi hội</h3>
            </div>
          </div>
          <p class="bt-feature-lead">Biên bản sinh hoạt chi hội, danh sách điểm danh, báo cáo tháng gửi lên Hội ${escapeHtml(adminLevelLabelLower())}, đơn xin vào Hội, biên bản bình xét thi đua — có sẵn mẫu, chỉ việc điền.</p>
          <div class="bt-feature-stats">${escapeHtml(stats)}</div>
          <button type="button" class="bt-open-btn preview-allow" id="bt-open-lib">
            <span class="bt-open-ico" aria-hidden="true">📂</span>
            <span class="bt-open-text"><b>Mở Kho mẫu văn bản</b><small>Xem các thư mục, mẫu văn bản và tải về để điền</small></span>
            <span class="bt-open-go" aria-hidden="true">›</span>
          </button>
          <button type="button" class="bt-contrib-btn preview-allow" id="bt-open-contrib">
            <span aria-hidden="true">🤝</span>
            <span>Mời đồng chí đóng góp thêm vào Kho mẫu văn bản của Chi hội</span>
            ${fresh ? `<span class="bt-fresh">🎉 ${fresh} tài liệu của đồng chí vừa có kết quả</span>` : ''}
          </button>
        </section>

        <h2 class="bt-soon-title">Các tính năng còn đang nâng cấp – sẽ sớm ra mắt:</h2>
        <div class="upcoming-grid">
          ${btSoonCards().map(([ico,h,p])=>`
            <div class="upcoming-feature">
              <div class="upcoming-feature-ico">${ico}</div>
              <div><h4>${escapeHtml(h)}</h4><p>${escapeHtml(p)}</p></div>
            </div>`).join('')}
        </div>
      </div>`;
    el.querySelector('#bt-open-lib').onclick = ()=> btGo('library');
    el.querySelector('#bt-open-contrib').onclick = ()=> btStartContribute();
  }

  // =====================================================================
  // XEM KHO (mọi người)
  // =====================================================================
  function btRenderLibrary(el){
    const S = btS();
    el.innerHTML = `
      <div class="panel bt-lib-panel">
        <div class="panel-head"><h3>📄 Kho mẫu văn bản của chi hội</h3></div>
        <div class="panel-body">
          <div class="mt-editor-bar">
            <button class="btn btn-ghost btn-sm btn-back-list preview-allow" id="bt-back">← Công tác Chi hội</button>
            <div class="mt-editor-bar-right"><button class="btn btn-ghost btn-sm preview-allow" id="bt-lib-contrib">🤝 Đóng góp thêm mẫu</button></div>
          </div>
          <div class="mt-toolbar"><input id="bt-q" class="preview-allow" value="${escapeHtml(S.q)}" placeholder="🔍 Tìm mẫu theo tên… (gõ không dấu cũng được)" autocomplete="off"></div>
          <div id="bt-lib-box" class="bt-mtp"></div>
          <p class="mt-hint bt-lib-foot">Bấm vào tên mẫu để xem trước, bấm ⬇ để tải về máy rồi điền bằng Word/Excel. Mẫu do Ban quản trị chọn lọc từ đóng góp của cán bộ Hội khắp nơi.</p>
        </div>
      </div>`;
    el.querySelector('#bt-back').onclick = ()=> btGo('home');
    el.querySelector('#bt-lib-contrib').onclick = ()=> btStartContribute();
    const q = el.querySelector('#bt-q');
    q.oninput = ()=>{ S.q = q.value; btPaintLibrary(el); };
    btPaintLibrary(el);
  }
  function btLibRowHtml(d, i, view, attrOpen){
    if(mtIsFolder(d)) return `<li><button type="button" class="mtp-doc mtp-folder preview-allow" data-btl-folder="${escapeHtml(d.id)}">
        <span class="mtp-num">${i+1}</span><span class="mtp-fico" aria-hidden="true">📁</span>
        <span class="mtp-doc-main"><b>${escapeHtml(mtDocTitle(d))}</b><small>${escapeHtml(mtCountsText(view, d.id))}</small></span>
        <span class="mtp-go">›</span></button></li>`;
    const credit = btCreditText(d.credit);
    return `<li class="bt-li"><button type="button" class="mtp-doc preview-allow" ${attrOpen}>
        <span class="mtp-num">${i+1}</span><span class="bt-kind" aria-hidden="true">${driveNodeIcon({type:'file', name:d.name, mimeType:d.mimeType})}</span>
        <span class="mtp-doc-main"><b>${escapeHtml(mtDocTitle(d))}</b><small>${escapeHtml(mtKindLabel(d))}${d.size ? ' · '+escapeHtml(driveFormatBytes(d.size)) : ''}${d.pathText ? ' · 📁 '+escapeHtml(d.pathText) : ''}</small>${credit ? `<small class="bt-credit">🤝 ${escapeHtml(credit)}</small>` : ''}</span>
      </button><button type="button" class="bt-dl preview-allow" data-btl-dl="${escapeHtml(d.id)}" title="Tải về máy" aria-label="Tải về “${escapeHtml(mtDocTitle(d))}”">⬇<span>Tải về</span></button></li>`;
  }
  function btPaintLibrary(el){
    const S = btS(), box = el.querySelector('#bt-lib-box'); if(!box) return;
    if(!S.libLoaded){ box.innerHTML = '<div class="mtp-empty">Đang tải Kho mẫu văn bản…</div>'; return; }
    if(S.libError){ box.innerHTML = `<div class="mtp-empty">⚠️ ${escapeHtml(S.libError)}</div>`; return; }
    const view = btLibLive();
    const term = surveyFold(String(S.q||'').trim());
    let files;
    if(term){
      files = view.docs.filter(d=> !mtIsFolder(d) && surveyFold(mtDocTitle(d)+' '+(d.name||'')).includes(term))
        .map(d=> ({ ...d, pathText: mtFolderPath(view, mtParentId(d, mtFolderMap(view))).map(mtDocTitle).join(' › ') || BT_LIB_ROOT }));
      box.innerHTML = `<div class="bt-search-head">🔍 ${files.length ? `Tìm thấy <b>${files.length}</b> mẫu khớp với “${escapeHtml(S.q.trim())}”` : `Không có mẫu nào khớp với “${escapeHtml(S.q.trim())}”.`}</div>
        ${files.length ? `<ol class="mtp-list">${files.map((d,i)=> btLibRowHtml(d, i, view, `data-btl-open="${i}"`)).join('')}</ol>` : ''}`;
    } else {
      const nav = btResolveNav(view, S.libNav, BT_LIB_ROOT), fid = nav.id;
      const kids = mtChildren(view, fid);
      files = kids.filter(d=> !mtIsFolder(d));
      const notice = nav.notice; nav.notice = '';
      box.innerHTML = `${notice ? `<div class="mtp-notice">${escapeHtml(notice)}</div>` : ''}
        ${mtCrumbsHtml(mtFolderPath(view, fid), 'btl-crumb', BT_LIB_ROOT)}
        ${kids.length ? `<ol class="mtp-list">${kids.map((d,i)=> btLibRowHtml(d, i, view, `data-btl-open="${files.indexOf(d)}"`)).join('')}</ol>`
          : `<div class="mtp-empty">${fid ? 'Thư mục này chưa có mẫu nào.' : 'Kho chưa có mẫu nào. Ban quản trị đang chuẩn bị — đồng chí có thể đóng góp những mẫu đang dùng ở chi hội mình.'}</div>`}`;
    }
    const go = id=>{ S.libNav.id = id || null; S.libNav.notice = ''; S.libNav.path = mtFolderPath(view, S.libNav.id).map(f=> f.id); btPaintLibrary(el); };
    box.querySelectorAll('[data-btl-crumb]').forEach(b=> b.onclick = ()=> go(b.dataset.btlCrumb || null));
    box.querySelectorAll('[data-btl-folder]').forEach(b=> b.onclick = ()=> go(b.dataset.btlFolder));
    box.querySelectorAll('[data-btl-open]').forEach(b=> b.onclick = ()=> btOpenViewer(files, +b.dataset.btlOpen));
    box.querySelectorAll('[data-btl-dl]').forEach(b=> b.onclick = ()=>{ const d = view.docs.find(x=> x.id===b.dataset.btlDl); if(d) btDownload(d); });
  }

  // =====================================================================
  // ĐÓNG GÓP — thư cảm ơn, ngăn đóng góp, gửi đóng góp
  // =====================================================================
  function btStartContribute(){
    if(!isTourMode() && !btUid()){ alert(BT_LOGIN_MSG); return; }
    btAttachMine();
    btLetterBefore();
  }
  function btLetterShell(inner){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg mt-font';
    wrap.innerHTML = `<div class="modal bt-letter" role="dialog" aria-modal="true" aria-labelledby="bt-letter-title">${inner}</div>`;
    document.body.appendChild(wrap);
    return wrap;
  }
  function btLetterBefore(){
    const S = btS(), rec = S.mine || {};
    const name = String(rec.displayName || (state.identity && state.identity.name) || '').slice(0, BT_NAME_MAX);
    const place = btPlace() || rec.place || '';
    const wrap = btLetterShell(`
      <div class="bt-letter-band" aria-hidden="true">💌</div>
      <button class="modal-close bt-letter-close" data-bl-close aria-label="Đóng">✕</button>
      <div class="modal-body bt-letter-body">
        <h3 id="bt-letter-title">Thư gửi đồng chí</h3>
        <p>Kính gửi đồng chí <b>${escapeHtml(name || 'cán bộ Hội')}</b>,</p>
        <p>Mỗi biên bản, mỗi mẫu báo cáo đồng chí chia sẻ hôm nay có thể giúp hàng trăm cán bộ chi hội ở khắp nơi bớt đi một buổi tối ngồi soạn lại từ đầu. Ban quản trị trân trọng cảm ơn tấm lòng của đồng chí.</p>
        <p>Trước khi gửi, xin đồng chí lưu ý giúp:</p>
        <ul>
          <li><b>Xoá hoặc thay bằng dấu “…” mọi thông tin cá nhân thật</b> (họ tên, số CCCD, số điện thoại, địa chỉ của hội viên).</li>
          <li>Mỗi tệp tối đa ${BT_C_FILE_MB} MB (${escapeHtml(BT_ALLOWED_TEXT)}); mỗi ngày gửi tối đa ${BT_C_DAY_FILES} tệp.</li>
          <li>Trong ngăn có tối đa ${BT_C_OPEN_FILES} tài liệu chưa được duyệt; Ban quản trị duyệt xong thì đồng chí gửi tiếp được.</li>
          <li>Ban quản trị sẽ xem từng tài liệu rồi mới đưa vào kho dùng chung.</li>
        </ul>
        <div class="bt-letter-credit">
          <label class="bt-check"><input type="checkbox" id="bl-credit" ${rec.credit ? 'checked' : ''}> Ghi tên tôi là người đóng góp bên dưới mẫu khi được đưa vào kho</label>
          <div class="field" id="bl-name-box" style="${rec.credit ? '' : 'display:none;'}">
            <label>Tên hiển thị <span class="mt-hint">— sửa lại cho đúng nếu tên tài khoản Google là biệt danh hoặc không dấu</span></label>
            <input id="bl-name" maxlength="${BT_NAME_MAX}" value="${escapeHtml(name)}" placeholder="VD: Nguyễn Văn A">
            ${mtCounterHtml('bl-name', name, BT_NAME_MAX)}
            <div class="mt-hint" id="bl-preview"></div>
          </div>
        </div>
        <div class="bt-letter-sign">Ban quản trị</div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" data-bl-close>Để sau</button><button class="btn btn-primary" id="bl-start">🤝 Bắt đầu đóng góp</button></div>`);
    mtWireCounters(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelectorAll('[data-bl-close]').forEach(b=> b.onclick = close);
    wrap.addEventListener('click', e=>{ if(e.target===wrap) close(); });
    const cb = wrap.querySelector('#bl-credit'), nameBox = wrap.querySelector('#bl-name-box'), inp = wrap.querySelector('#bl-name'), pv = wrap.querySelector('#bl-preview');
    const paintPv = ()=>{ const n = inp.value.trim(); pv.textContent = n ? `Sẽ hiện: “${btCreditText({ name:n, place })}”` : ''; };
    cb.onchange = ()=>{ nameBox.style.display = cb.checked ? '' : 'none'; if(cb.checked) setTimeout(()=> inp.focus(), 30); };
    inp.addEventListener('input', paintPv); paintPv();
    wrap.querySelector('#bl-start').onclick = async ()=>{
      const credit = cb.checked, dn = inp.value.trim().slice(0, BT_NAME_MAX);
      if(credit && !dn){ alert('Vui lòng nhập tên hiển thị, hoặc bỏ chọn ô ghi tên.'); inp.focus(); return; }
      if(!isTourMode()){
        const uid = btUid(); if(!uid){ alert(BT_LOGIN_MSG); return; }
        try{
          await rtdb.ref(`branch_templates/contributions/${uid}`).update(btClean({
            uid, email: state.identity.email, name: state.identity.name || '', displayName: dn || (state.identity.name || ''), credit,
            place, wardId: wardId() || null, updatedAt: btNow(),
          }));
        }catch(e){ console.error('[Kho mẫu] Lưu thông tin người góp lỗi:', e); alert('Không lưu được: ' + (e && e.message || e)); return; }
      }
      close();
      btGo('contrib');
    };
  }
  function btLetterAfter(nFiles, nFolders){
    const wrap = btLetterShell(`
      <div class="bt-letter-band" aria-hidden="true">🌾</div>
      <button class="modal-close bt-letter-close" data-bl-close aria-label="Đóng">✕</button>
      <div class="modal-body bt-letter-body">
        <h3 id="bt-letter-title">Cảm ơn đồng chí!</h3>
        <p>Ban quản trị đã nhận <b>${nFiles} tài liệu</b>${nFolders ? ` trong <b>${nFolders} thư mục</b>` : ''} đồng chí gửi. Chúng tôi sẽ sớm xem xét. Kết quả sẽ hiện ngay trong ngăn đóng góp của đồng chí: ✅ đã đưa vào kho, hoặc ↩️ kèm lời nhắn nếu chưa dùng được.</p>
        <p>Chính những người như đồng chí làm nên kho mẫu này. Kính chúc đồng chí sức khoẻ và công tác tốt!</p>
        <div class="bt-letter-sign">Ban quản trị</div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" data-bl-close>Đóng</button><button class="btn btn-primary" id="bl-lib">📂 Xem Kho mẫu văn bản</button></div>`);
    const close = ()=> wrap.remove();
    wrap.querySelectorAll('[data-bl-close]').forEach(b=> b.onclick = close);
    wrap.addEventListener('click', e=>{ if(e.target===wrap) close(); });
    wrap.querySelector('#bl-lib').onclick = ()=>{ close(); btGo('library'); };
  }

  function btMineCx(){
    const uid = btUid();
    return {
      t:{ kind:'contrib', uid }, rootName: BT_C_ROOT, maxDepth: BT_C_DEPTH, maxFolders: BT_C_FOLDERS,
      view: ()=> ({ docs: btAll(btS().mine) }),
      folderCount: ()=> btAll(btS().mine).filter(mtIsFolder).length,
    };
  }
  function btChip(d){
    if(d.status==='pending') return '<span class="bt-chip pending">🕓 Chờ xem xét</span>';
    if(d.status==='accepted') return '<span class="bt-chip accepted">✅ Đã đưa vào kho chung</span>';
    if(d.status==='declined') return '<span class="bt-chip declined">↩️ Chưa sử dụng</span>';
    return '<span class="bt-chip draft">📝 Nháp</span>';
  }
  function btContribMeta(d){
    const base = `${btChip(d)} ${escapeHtml(mtKindLabel(d))}${d.size ? ' · '+escapeHtml(driveFormatBytes(d.size)) : ''}`;
    if(d.status==='accepted') return `${base}<br>${escapeHtml(d.acceptedTo ? 'Vào: ' + d.acceptedTo : '')}${d.reviewedAt ? ' · ' + escapeHtml(btFmtDay(d.reviewedAt)) : ''}`;
    if(d.status==='declined') return `${base}<br>Lý do: ${escapeHtml(d.declineReason || '—')}${d.reviewedAt ? ' · ' + escapeHtml(btFmtDay(d.reviewedAt)) : ''}`;
    if(d.status==='pending' && d.submittedAt) return `${base} · gửi ${escapeHtml(btFmtDay(d.submittedAt))}`;
    return base;
  }
  function btRenderContrib(el){
    const S = btS();
    if(!S.cNavFor || S.cNavFor!==btMineKey){ S.cNavFor = btMineKey; S.cNav = { id:null, path:[], notice:'' }; }
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head mt-editor-head"><h3>🤝 Ngăn đóng góp của đồng chí</h3><span id="bt-saved" class="mt-saved"></span></div>
        <div class="panel-body">
          <div class="mt-editor-bar">
            <button class="btn btn-ghost btn-sm btn-back-list preview-allow" id="bt-back">← Công tác Chi hội</button>
            <div class="mt-editor-bar-right">
              <button class="btn btn-ghost btn-sm preview-allow" id="bt-c-letter">💌 Đọc lại thư · đổi tên hiển thị</button>
              <button class="btn btn-ghost btn-sm preview-allow" id="bt-c-lib">📂 Xem Kho mẫu</button>
            </div>
          </div>
          <ol class="bt-steps">
            <li><b>1</b><span>Tải tệp lên — tệp nằm ở trạng thái 📝 Nháp, chỉ riêng đồng chí thấy.</span></li>
            <li><b>2</b><span>Sắp xếp, đặt tên, gom vào thư mục cho gọn.</span></li>
            <li><b>3</b><span>Bấm “📨 Gửi đóng góp” để gửi Ban quản trị xem xét.</span></li>
          </ol>
          <div id="bt-c-quota"></div>
          <div class="mt-doc-add">
            <button class="btn btn-primary btn-sm preview-allow" id="bt-c-upload">⬆️ Tải tệp lên</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="bt-c-folder">➕ Thư mục mới</button>
            <span class="mt-hint">Tệp được đưa vào thư mục đang mở. ${escapeHtml(BT_ALLOWED_TEXT)}, tối đa ${BT_C_FILE_MB} MB mỗi tệp.</span>
          </div>
          <div id="bt-c-status" class="mt-upload-status" style="display:none;"></div>
          <div id="bt-c-tree"></div>
          <div id="bt-c-submit"></div>
        </div>
      </div>`;
    el.querySelector('#bt-back').onclick = ()=> btGo('home');
    el.querySelector('#bt-c-lib').onclick = ()=> btGo('library');
    el.querySelector('#bt-c-letter').onclick = ()=> btLetterBefore();
    el.querySelector('#bt-c-upload').onclick = ()=> btContribUpload();
    el.querySelector('#bt-c-folder').onclick = ()=> btCreateFolder(btMineCx(), btResolveNav({ docs: btAll(btS().mine) }, S.cNav, BT_C_ROOT).id);
    btPaintContrib(el);
    // Đã mở ngăn = đã thấy các kết quả mới -> tắt dòng "🎉 … vừa có kết quả" ở trang module.
    if(isTourMode() && S.mine) S.mine.seenResultsAt = btNow();
    else if(btUid() && S.mine && btNewResults(S.mine)) rtdb.ref(`branch_templates/contributions/${btUid()}/seenResultsAt`).set(btNow()).catch(()=>{});
  }
  function btPaintContrib(el){
    const S = btS(), rec = S.mine;
    const qBox = el.querySelector('#bt-c-quota'), tree = el.querySelector('#bt-c-tree'), sub = el.querySelector('#bt-c-submit');
    if(!tree) return;
    if(!S.mineLoaded){ tree.innerHTML = '<div class="empty-state" style="padding:22px;">Đang tải ngăn đóng góp…</div>'; return; }
    const q = btQuota(rec), open = btOpenStats(rec);
    const meter = (label, used, max, fmt)=>{ const pct = Math.min(100, Math.round(used*100/max)); return `<div class="bt-meter ${pct>=100 ? 'full' : pct>=80 ? 'near' : ''}"><div class="bt-meter-top"><span>${label}</span><b>${fmt(used)}/${fmt(max)}</b></div><div class="bt-meter-bar"><i style="width:${pct}%"></i></div></div>`; };
    if(qBox) qBox.innerHTML = `<div class="bt-meters">
        ${meter('Hôm nay đã tải', q.files, BT_C_DAY_FILES, n=> n + ' tệp')}
        ${meter('Dung lượng hôm nay', q.bytes, BT_C_DAY_MB*1048576, n=> n>=BT_C_DAY_MB*1048576 ? BT_C_DAY_MB+' MB' : btBytes(n))}
        ${meter('Chưa có kết quả trong ngăn', open.files, BT_C_OPEN_FILES, n=> n + ' tệp')}
      </div>`;
    const cx = btMineCx(), view = btMineView();
    const go = id=>{ S.cNav.id = id || null; S.cNav.notice = ''; btPaintContrib(el); };
    btPaintTree(tree, {
      view, nav: S.cNav, rootName: BT_C_ROOT, canEdit:true, cx,
      empty:'Ngăn đóng góp còn trống. Bấm “⬆️ Tải tệp lên” để thêm mẫu văn bản đồng chí muốn chia sẻ.',
      draggable: d=> mtIsFolder(d) || d.status==='draft' || !d.status,
      meta: btContribMeta,
      go,
      openFile: id=>{
        const d = view.docs.find(x=> x.id===id); if(!d) return;
        if(!d.storagePath && d.content==null){ showToast(d.status==='accepted' ? 'Tài liệu này đã được chép vào kho chung — mở Kho mẫu để xem.' : 'Tệp gốc đã được xoá sau khi duyệt.'); return; }
        const files = mtChildFiles(view, S.cNav.id).filter(x=> x.storagePath || x.content!=null);
        btOpenViewer(files, Math.max(0, files.findIndex(x=> x.id===id)));
      },
      menu: d=>{
        if(mtIsFolder(d)) return [
          { icon:'📂', label:'Mở', onClick:()=> go(d.id) },
          { icon:'✏️', label:'Đổi tên', onClick:()=> btRename(cx, d.id) },
          { icon:'📦', label:'Di chuyển', onClick:()=> btMoveModal(cx, d.id) },
          { icon:'🗑️', label:'Xoá thư mục', danger:true, onClick:()=> btContribDelete(d.id) },
        ];
        if(d.status==='pending') return [
          { icon:'👁', label:'Xem', onClick:()=> btOpenViewer([d], 0) },
          { icon:'↩️', label:'Rút lại (xoá khỏi ngăn)', danger:true, onClick:()=> btContribDelete(d.id) },
        ];
        if(d.status==='accepted' || d.status==='declined') return [
          d.hidden ? { icon:'👁', label:'Hiện lại dòng này', onClick:()=> btTx(cx.t, docs=>{ const x = docs.find(y=> y.id===d.id); if(x) delete x.hidden; }) }
                   : { icon:'🙈', label:'Ẩn dòng này cho gọn ngăn', onClick:()=> btTx(cx.t, docs=>{ const x = docs.find(y=> y.id===d.id); if(x) x.hidden = true; }) },
        ];
        return [
          { icon:'👁', label:'Xem', onClick:()=> btOpenViewer([d], 0) },
          { icon:'✏️', label:'Đổi tên', onClick:()=> btRename(cx, d.id) },
          { icon:'📦', label:'Di chuyển', onClick:()=> btMoveModal(cx, d.id) },
          { icon:'🗑️', label:'Xoá', danger:true, onClick:()=> btContribDelete(d.id) },
        ];
      },
    });
    const all = btAll(rec), drafts = all.filter(d=> !mtIsFolder(d) && (d.status==='draft' || !d.status));
    const hiddenN = all.filter(d=> d.hidden).length;
    if(sub) sub.innerHTML = `<div class="bt-submit-bar">
        <button class="btn btn-primary bt-submit preview-allow" id="bt-c-send" ${drafts.length ? '' : 'disabled'}>📨 Gửi đóng góp${drafts.length ? ` (${drafts.length} tài liệu nháp)` : ''}</button>
        <span class="mt-hint">${drafts.length ? 'Gửi xong thì tài liệu chuyển sang 🕓 Chờ xem xét. Đồng chí vẫn tải thêm và gửi đợt mới được.' : 'Chưa có tài liệu nháp nào để gửi.'}</span>
      </div>
      ${hiddenN ? `<label class="bt-check bt-hidden-toggle"><input type="checkbox" class="preview-allow" id="bt-c-hidden" ${S.showHidden ? 'checked' : ''}> Hiện cả ${hiddenN} dòng đã ẩn</label>` : ''}`;
    const send = el.querySelector('#bt-c-send'); if(send) send.onclick = ()=> btContribSubmit();
    const hid = el.querySelector('#bt-c-hidden'); if(hid) hid.onchange = ()=>{ S.showHidden = hid.checked; btPaintContrib(el); };
  }
  async function btContribUpload(){
    if(!btWriteOk('contrib')) return;
    const S = btS(), uid = btUid();
    const files = await btPickFiles(true);
    if(!files.length) return;
    const bad = files.filter(f=> !BT_ALLOWED_RE.test(f.name||''));
    if(bad.length){ alert(`Không nhận loại tệp này: ${bad.map(f=> '“'+f.name+'”').join(', ')}.\n\nKho chỉ nhận ${BT_ALLOWED_TEXT}.`); return; }
    const big = files.filter(f=> f.size > BT_C_FILE_MB*1048576);
    if(big.length){ alert(`Tệp lớn hơn ${BT_C_FILE_MB} MB: ${big.map(f=> '“'+f.name+'”').join(', ')}.\n\nĐồng chí có thể nén, tách nhỏ hoặc xuất sang PDF rồi thử lại.`); return; }
    const rec = S.mine || {}, q = btQuota(rec), open = btOpenStats(rec);
    const sum = files.reduce((a,f)=> a + f.size, 0);
    if(q.files + files.length > BT_C_DAY_FILES){ const left = Math.max(0, BT_C_DAY_FILES - q.files); alert(left ? `Hôm nay đồng chí chỉ còn gửi được ${left} tệp nữa (tối đa ${BT_C_DAY_FILES} tệp mỗi ngày). Vui lòng chọn bớt tệp.` : `Hôm nay đồng chí đã gửi ${BT_C_DAY_FILES}/${BT_C_DAY_FILES} tệp. Mời đồng chí quay lại vào ngày mai.`); return; }
    if(q.bytes + sum > BT_C_DAY_MB*1048576){ alert(`Hôm nay đồng chí còn ${btBytes(BT_C_DAY_MB*1048576 - q.bytes)} (tối đa ${BT_C_DAY_MB} MB mỗi ngày). Vui lòng chọn bớt tệp hoặc quay lại vào ngày mai.`); return; }
    if(open.files + files.length > BT_C_OPEN_FILES){ alert(`Ngăn của đồng chí đang có ${open.files} tài liệu chưa được duyệt (gồm cả bản nháp), tối đa ${BT_C_OPEN_FILES}. Mời đồng chí chờ Ban quản trị duyệt bớt rồi gửi tiếp.`); return; }
    if(open.bytes + sum > BT_C_OPEN_MB*1048576){ alert(`Ngăn của đồng chí đã dùng ${btBytes(open.bytes)} cho tài liệu chưa được duyệt (tối đa ${BT_C_OPEN_MB} MB). Mời đồng chí chờ Ban quản trị duyệt bớt rồi gửi tiếp.`); return; }
    try{
      const snap = await rtdb.ref('branch_templates/stats/contribBytes').once('value');
      if((Number(snap.val())||0) + sum > BT_C_GLOBAL_MB*1048576){ alert('Kho đóng góp đang tạm đầy, Ban quản trị đang duyệt bớt. Mời đồng chí quay lại sau ít ngày. Xin cảm ơn đồng chí!'); return; }
    }catch(e){ console.warn('[Kho mẫu] Không đọc được tổng dung lượng đóng góp (bỏ qua):', e); }
    const dup = files.filter(f=> btAll(rec).some(d=> !mtIsFolder(d) && d.name===f.name && d.size===f.size && btIsOpen(d)));
    if(dup.length && !confirm(`Trong ngăn đã có tệp giống hệt: ${dup.map(f=> '“'+f.name+'”').join(', ')}.\n\nVẫn tải lên?`)) return;
    const folderId = btResolveNav({ docs: btAll(rec) }, S.cNav, BT_C_ROOT).id;
    const t = { kind:'contrib', uid };
    let added = 0;
    for(const f of files){
      const docId = mtDocId();
      try{
        const up = await btUploadOne(t, f, docId, 'bt-c-status');
        const now = btNow(), day = btVnDay();
        const doc = { id:docId, parentId: folderId || null, name:f.name, title: mtStripExt(f.name).slice(0, BT_TITLE_MAX), mimeType: f.type || 'application/octet-stream', size: f.size, status:'draft', ...up, addedAt: now, updatedAt: now };
        const ok = await btTx(t, (docs, r)=>{
          docs.push(doc);
          const qq = r.quota && r.quota.day===day ? r.quota : { day, files:0, bytes:0 };
          r.quota = { day, files:(qq.files||0) + 1, bytes:(qq.bytes||0) + f.size };
          if(!r.uid){ r.uid = uid; r.email = state.identity.email; r.name = state.identity.name || ''; }
        });
        if(ok){ added++; btStatAdd(f.size); } else btDeleteStorage(up.storagePath);
      }catch(e){
        console.error('[Kho mẫu] Tải tệp lỗi:', e);
        alert(`Không tải lên được "${f.name}".\n\n${e && e.message ? e.message : 'Lỗi không xác định'}`);
      }
    }
    btSetStatus('bt-c-status', '');
    if(added) showToast(`Đã thêm ${added} tài liệu vào ngăn (📝 Nháp). Sắp xếp xong thì bấm “📨 Gửi đóng góp”.`);
  }
  async function btContribDelete(id){
    if(!btWriteOk('contrib')) return;
    const cx = btMineCx(), all = btAll(btS().mine), it = all.find(d=> d.id===id); if(!it) return;
    const ids = mtIsFolder(it) ? new Set([id, ...mtDescendantIds({ docs: all }, id)]) : new Set([id]);
    const victims = all.filter(d=> ids.has(d.id) && !mtIsFolder(d));
    const pend = victims.filter(d=> d.status==='pending').length;
    const msg = mtIsFolder(it)
      ? `Xoá thư mục “${mtDocTitle(it)}”${victims.length ? ` cùng ${victims.length} tài liệu bên trong` : ''}?${pend ? `\n\n${pend} tài liệu đang chờ xem xét sẽ được rút lại.` : ''}\n\nKhông khôi phục lại được.`
      : it.status==='pending' ? `Rút lại “${mtDocTitle(it)}”? Ban quản trị sẽ không xem tài liệu này nữa và tệp bị xoá khỏi ngăn.` : `Xoá “${mtDocTitle(it)}” khỏi ngăn? Không khôi phục lại được.`;
    if(!confirm(msg)) return;
    if(await btTx(cx.t, docs=>{ for(let i=docs.length-1; i>=0; i--) if(ids.has(docs[i].id)) docs.splice(i, 1); })){
      let freed = 0;
      victims.forEach(d=>{ if(d.storagePath){ btDeleteStorage(d.storagePath); freed += d.size||0; } });
      btStatAdd(-freed);
      showToast('Đã xoá.');
    }
  }
  async function btContribSubmit(){
    if(!btWriteOk('contrib')) return;
    const all = btAll(btS().mine), drafts = all.filter(d=> !mtIsFolder(d) && (d.status==='draft' || !d.status));
    if(!drafts.length) return;
    const map = mtFolderMap({ docs: all }), folders = new Set();
    drafts.forEach(d=>{ let p = mtParentId(d, map), g = 0; while(p && g++<20){ folders.add(p); p = mtParentId(map[p], map); } });
    const ids = new Set(drafts.map(d=> d.id)), now = btNow();
    const ok = await btTx({ kind:'contrib', uid: btUid() }, (docs, r)=>{
      docs.forEach(d=>{ if(ids.has(d.id) && (d.status==='draft' || !d.status)){ d.status = 'pending'; d.submittedAt = now; } });
      r.lastSubmittedAt = now;
    });
    if(ok) btLetterAfter(drafts.length, folders.size);
  }

  // =====================================================================
  // CÀI ĐẶT ADMIN → "Cài đặt module Công tác Chi hội (Kho tài liệu mẫu)"
  // =====================================================================
  function btAdminIsOpen(){ return !!(state.bt && state.bt.adminOpen) && isAdmin(); }
  function btAdminEntryPanelHtml(){
    btAttachAll(); btAttachLib();
    const n = btAdminPendingTotal();
    return `<div class="panel bt-admin-entry">
      <div class="panel-body">
        <button type="button" class="bt-open-btn" id="bt-admin-open">
          <span class="bt-open-ico" aria-hidden="true">🌾</span>
          <span class="bt-open-text"><b>Cài đặt module Công tác Chi hội (Kho tài liệu mẫu)</b><small>Quản lý kho mẫu văn bản dùng chung · duyệt đóng góp của mọi người</small></span>
          ${n ? `<span class="bt-pending-pill">🔴 ${n} chờ duyệt</span>` : ''}
          <span class="bt-open-go" aria-hidden="true">›</span>
        </button>
      </div>
    </div>`;
  }
  function btWireAdminEntry(el){
    const b = el.querySelector('#bt-admin-open');
    if(b) b.onclick = ()=>{ btS().adminOpen = true; renderAdminSettingsTab(el); window.scrollTo(0, 0); };
  }
  function btLibCx(){
    return {
      t:{ kind:'lib' }, rootName: BT_LIB_ROOT, maxDepth: BT_L_DEPTH, maxFolders: BT_L_FOLDERS,
      view: btLibLive,
      folderCount: ()=> btAll(btS().lib).filter(mtIsFolder).length,
    };
  }
  function renderBranchTemplatesAdmin(el){
    btAttachAll(); btAttachLib(); btAttachStats();
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head mt-editor-head"><h3>🌾 Cài đặt module Công tác Chi hội (Kho tài liệu mẫu)</h3><span id="bt-saved" class="mt-saved"></span></div>
        <div class="panel-body">
          <div class="mt-editor-bar"><button class="btn btn-ghost btn-sm btn-back-list" id="bt-a-back">← CÀI ĐẶT ADMIN</button></div>
          <div id="bt-a-tabs" style="margin-bottom:12px;"></div>
          <div id="bt-a-status" class="mt-upload-status" style="display:none;"></div>
          <div id="bt-a-body"></div>
        </div>
      </div>`;
    el.querySelector('#bt-a-back').onclick = ()=>{ const S = btS(); S.adminOpen = false; S.adminUid = null; renderAdminSettingsTab(el); window.scrollTo(0, 0); };
    btPaintAdmin(el);
  }
  function btPaintAdmin(el){
    const S = btS(), tabs = el.querySelector('#bt-a-tabs'), body = el.querySelector('#bt-a-body'); if(!body) return;
    const trashN = btAll(S.lib).filter(d=> d.deleted && d.trashTop).length;
    const pend = btAdminPendingTotal();
    tabs.innerHTML = surveyTabsHtml([
      { id:'bt-at-lib', label:'📚 Kho chính thức', active: S.adminTab==='library' },
      { id:'bt-at-contrib', label:`📥 Đóng góp của mọi người${pend ? ` (${pend} chờ duyệt)` : ''}`, active: S.adminTab==='contrib' },
      { id:'bt-at-trash', label:`🗑️ Thùng rác kho${trashN ? ` (${trashN})` : ''}`, active: S.adminTab==='trash' },
    ]);
    tabs.querySelector('#bt-at-lib').onclick = ()=>{ S.adminTab = 'library'; btPaintAdmin(el); };
    tabs.querySelector('#bt-at-contrib').onclick = ()=>{ S.adminTab = 'contrib'; btPaintAdmin(el); };
    tabs.querySelector('#bt-at-trash').onclick = ()=>{ S.adminTab = 'trash'; btPaintAdmin(el); };
    if(!S.libLoaded){ body.innerHTML = '<div class="empty-state" style="padding:22px;">Đang tải kho…</div>'; return; }
    if(S.adminTab==='contrib') btPaintAdminContrib(el, body);
    else if(S.adminTab==='trash') btPaintAdminTrash(el, body);
    else btPaintAdminLib(el, body);
  }
  // ---- Kho chính thức ----
  function btPaintAdminLib(el, body){
    const S = btS(), cx = btLibCx(), view = btLibLive();
    const used = btLibBytes(), pct = Math.min(100, Math.round(used*100/(BT_L_MB*1048576)));
    const nFiles = btLibFiles().length, nFolders = btAll(S.lib).filter(mtIsFolder).length;
    const trashBytes = (()=>{ let n = 0; btLibFiles().filter(d=> d.deleted).forEach(d=> n += d.size||0); return n; })();
    const seedMissing = btSeedFolders().filter(t=> !view.docs.some(d=> mtIsFolder(d) && !mtParentId(d, mtFolderMap(view)) && mtDocTitle(d)===t));
    body.innerHTML = `
      <div class="bt-meter ${pct>=100 ? 'full' : pct>=80 ? 'near' : ''} bt-cap">
        <div class="bt-meter-top"><span>Dung lượng kho${trashBytes ? ` (gồm ${escapeHtml(btBytes(trashBytes))} trong thùng rác)` : ''}</span><b>${escapeHtml(btBytes(used))} / ${BT_L_MB/1024} GB · ${nFiles}/${BT_L_FILES} tệp · ${nFolders}/${BT_L_FOLDERS} thư mục</b></div>
        <div class="bt-meter-bar"><i style="width:${pct}%"></i></div>
        ${pct>=80 ? `<div class="mt-warn" style="margin:8px 0 0;">${pct>=100 ? '⛔ Kho đã đầy — không tải thêm được. Hãy xoá vĩnh viễn bớt mục trong thùng rác hoặc gỡ bớt mẫu ít dùng.' : '⚠️ Kho đã dùng trên 80% dung lượng.'}</div>` : ''}
      </div>
      <div class="mt-doc-add">
        <button class="btn btn-primary btn-sm" id="bt-a-upload">⬆️ Tải tệp lên</button>
        <button class="btn btn-ghost btn-sm" id="bt-a-folder">➕ Thư mục mới</button>
        ${seedMissing.length ? `<button class="btn btn-ghost btn-sm" id="bt-a-seed" title="${escapeHtml(seedMissing.join(' · '))}">🧩 Tạo sẵn bộ thư mục gợi ý (${seedMissing.length})</button>` : ''}
        <button class="btn btn-ghost btn-sm" id="bt-a-asuser">👁 Xem như mọi người</button>
        <span class="mt-hint">Tệp được đưa vào thư mục đang mở. Thứ tự Admin sắp là thứ tự mọi người nhìn thấy. Tối đa ${BT_L_FILE_MB} MB mỗi tệp.</span>
      </div>
      <div id="bt-a-tree"></div>`;
    const go = id=>{ S.aLibNav.id = id || null; S.aLibNav.notice = ''; btPaintAdmin(el); };
    btPaintTree(body.querySelector('#bt-a-tree'), {
      view, nav: S.aLibNav, rootName: BT_LIB_ROOT, canEdit:true, cx,
      empty:'Kho chưa có gì. Bấm “🧩 Tạo sẵn bộ thư mục gợi ý” hoặc “⬆️ Tải tệp lên” để bắt đầu.',
      draggable: ()=> true,
      meta: d=>{ const c = btCreditText(d.credit); return `${escapeHtml(mtKindLabel(d))}${d.size ? ' · '+escapeHtml(driveFormatBytes(d.size)) : ''}${d.replacedAt ? ` · <b class="mt-doc-new">đã thay bản mới ${escapeHtml(btFmtDay(d.replacedAt))}</b>` : ''}${c ? '<br>🤝 '+escapeHtml(c) : ''}`; },
      go,
      openFile: id=>{ const files = mtChildFiles(view, S.aLibNav.id); btOpenViewer(files, Math.max(0, files.findIndex(x=> x.id===id))); },
      menu: d=> mtIsFolder(d) ? [
        { icon:'📂', label:'Mở', onClick:()=> go(d.id) },
        { icon:'✏️', label:'Đổi tên', onClick:()=> btRename(cx, d.id) },
        { icon:'📦', label:'Di chuyển', onClick:()=> btMoveModal(cx, d.id) },
        { icon:'🗑️', label:'Xoá (vào thùng rác)', danger:true, onClick:()=> btLibTrash(d.id) },
      ] : [
        { icon:'👁', label:'Xem', onClick:()=> btOpenViewer([d], 0) },
        { icon:'⬇', label:'Tải về', onClick:()=> btDownload(d) },
        { icon:'✏️', label:'Đổi tên', onClick:()=> btRename(cx, d.id) },
        { icon:'📑', label:'Tạo bản sao', onClick:()=> btLibDuplicate(d.id) },
        { icon:'📦', label:'Di chuyển', onClick:()=> btMoveModal(cx, d.id) },
        { icon:'🔄', label:'Thay tệp (giữ nguyên vị trí)', onClick:()=> btLibReplace(d.id) },
        d.credit ? { icon:'🙈', label:'Bỏ dòng ghi tên người đóng góp', onClick:()=> btTx(cx.t, docs=>{ const x = docs.find(y=> y.id===d.id); if(x) delete x.credit; }) } : null,
        { icon:'🗑️', label:'Xoá (vào thùng rác)', danger:true, onClick:()=> btLibTrash(d.id) },
      ].filter(Boolean),
    });
    body.querySelector('#bt-a-upload').onclick = ()=> btLibUpload(btResolveNav(btLibLive(), S.aLibNav, BT_LIB_ROOT).id);
    body.querySelector('#bt-a-folder').onclick = ()=> btCreateFolder(cx, btResolveNav(btLibLive(), S.aLibNav, BT_LIB_ROOT).id);
    body.querySelector('#bt-a-asuser').onclick = ()=>{ btS().view = 'library'; switchTab('branch'); };
    const seed = body.querySelector('#bt-a-seed');
    if(seed) seed.onclick = async ()=>{
      if(!btWriteOk('lib')) return;
      const miss = btSeedFolders().filter(t=> !btLibLive().docs.some(d=> mtIsFolder(d) && !mtParentId(d, mtFolderMap(btLibLive())) && mtDocTitle(d)===t));
      if(!miss.length) return;
      if(btAll(S.lib).filter(mtIsFolder).length + miss.length > BT_L_FOLDERS){ alert(`Kho tối đa ${BT_L_FOLDERS} thư mục.`); return; }
      const now = btNow();
      if(await btTx(cx.t, docs=>{ miss.forEach(t=>{ if(!docs.some(d=> mtIsFolder(d) && !d.deleted && !d.parentId && mtDocTitle(d)===t)) docs.push({ id: mtDocId(), type:'folder', parentId:null, title:t, addedAt:now, updatedAt:now }); }); })) showToast(`Đã tạo ${miss.length} thư mục gợi ý.`);
    };
  }
  function btLibCheckRoom(files){
    const nFiles = btLibFiles().length, used = btLibBytes(), sum = files.reduce((a,f)=> a + (f.size||0), 0);
    if(nFiles + files.length > BT_L_FILES){ alert(`Kho tối đa ${BT_L_FILES} tệp (tính cả thùng rác). Hiện có ${nFiles} tệp.`); return false; }
    if(used + sum > BT_L_MB*1048576){ alert(`Kho tối đa ${BT_L_MB/1024} GB (tính cả thùng rác). Hiện đã dùng ${btBytes(used)}. Hãy xoá vĩnh viễn bớt mục trong thùng rác.`); return false; }
    return true;
  }
  async function btLibUpload(folderId){
    if(!btWriteOk('lib')) return;
    const files = await btPickFiles(true);
    if(!files.length) return;
    const bad = files.filter(f=> !BT_ALLOWED_RE.test(f.name||''));
    if(bad.length){ alert(`Không nhận loại tệp này: ${bad.map(f=> '“'+f.name+'”').join(', ')}.\n\nKho chỉ nhận ${BT_ALLOWED_TEXT}.`); return; }
    const big = files.filter(f=> f.size > BT_L_FILE_MB*1048576);
    if(big.length){ alert(`Tệp lớn hơn ${BT_L_FILE_MB} MB: ${big.map(f=> '“'+f.name+'”').join(', ')}.`); return; }
    if(!btLibCheckRoom(files)) return;
    const t = { kind:'lib' }, added = [];
    for(const f of files){
      const docId = mtDocId();
      try{
        const up = await btUploadOne(t, f, docId, 'bt-a-status');
        const now = btNow();
        added.push({ id:docId, parentId: folderId || null, name:f.name, title: mtStripExt(f.name).slice(0, BT_TITLE_MAX), mimeType: f.type || 'application/octet-stream', size: f.size, ...up, addedAt: now, updatedAt: now, addedByName: btActor() });
      }catch(e){ console.error('[Kho mẫu] Tải tệp lỗi:', e); alert(`Không tải lên được "${f.name}".\n\n${e && e.message ? e.message : ''}`); }
    }
    btSetStatus('bt-a-status', '');
    if(!added.length) return;
    if(await btTx(t, docs=>{ added.forEach(d=> docs.push(d)); })) showToast(`Đã thêm ${added.length} mẫu vào kho.`);
    else added.forEach(d=> btDeleteStorage(d.storagePath));
  }
  async function btLibReplace(id){
    if(!btWriteOk('lib')) return;
    const [f] = await btPickFiles(false);
    if(!f) return;
    if(!BT_ALLOWED_RE.test(f.name||'')){ alert(`Kho chỉ nhận ${BT_ALLOWED_TEXT}.`); return; }
    if(f.size > BT_L_FILE_MB*1048576){ alert(`Tệp lớn hơn ${BT_L_FILE_MB} MB.`); return; }
    if(!btLibCheckRoom([f])) return;
    let up;
    try{ up = await btUploadOne({ kind:'lib' }, f, mtDocId(), 'bt-a-status'); }
    catch(e){ btSetStatus('bt-a-status', ''); alert(`Không tải lên được "${f.name}".\n\n${e && e.message ? e.message : ''}`); return; }
    btSetStatus('bt-a-status', '');
    const old = btAll(btS().lib).find(d=> d.id===id);
    if(!old){ btDeleteStorage(up.storagePath); alert('Mẫu này vừa bị gỡ khỏi kho.'); return; }
    const now = btNow();
    const ok = await btTx({ kind:'lib' }, docs=>{
      const x = docs.find(d=> d.id===id); if(!x) return;
      Object.assign(x, { name:f.name, mimeType: f.type || 'application/octet-stream', size: f.size, ...up, updatedAt: now, replacedAt: now });
      if(!up.storageUrl) delete x.storageUrl;
    });
    if(ok){
      if(old.storagePath && !btAll(btS().lib).some(d=> d.storagePath===old.storagePath && d.id!==id)) btDeleteStorage(old.storagePath);
      showToast(`Đã thay tệp cho “${mtDocTitle(old)}”.`);
    } else btDeleteStorage(up.storagePath);
  }
  async function btLibDuplicate(id){
    if(!btWriteOk('lib')) return;
    if(btLibFiles().length >= BT_L_FILES){ alert(`Kho tối đa ${BT_L_FILES} tệp.`); return; }
    const now = btNow();
    if(await btTx({ kind:'lib' }, docs=>{
      const i = docs.findIndex(d=> d.id===id); if(i<0 || mtIsFolder(docs[i])) return;
      const copy = { ...docs[i], id: mtDocId(), title: ('Bản sao của ' + mtDocTitle(docs[i])).slice(0, BT_TITLE_MAX), addedAt: now, updatedAt: now };
      delete copy.replacedAt;
      docs.splice(i+1, 0, copy);
    })) showToast('Đã tạo bản sao.');
  }
  // Xoá = chuyển vào thùng rác: đánh dấu cả mục và các mục con (cùng một mã đợt xoá trashId).
  async function btLibTrash(id){
    if(!btWriteOk('lib')) return;
    const view = btLibLive(), it = view.docs.find(d=> d.id===id); if(!it) return;
    const desc = mtIsFolder(it) ? mtDescendantIds(view, id) : new Set();
    if(!confirm(`Chuyển “${mtDocTitle(it)}”${desc.size ? ` và ${desc.size} mục bên trong` : ''} vào Thùng rác kho?\n\nMọi người sẽ không thấy nữa. Khôi phục được trong thẻ “🗑️ Thùng rác kho”.`)) return;
    const ids = new Set([id, ...desc]), now = btNow(), who = btActor();
    if(await btTx({ kind:'lib' }, docs=>{
      docs.forEach(d=>{ if(ids.has(d.id) && !d.deleted){ d.deleted = true; d.trashId = id; d.deletedAt = now; d.deletedByName = who; if(d.id===id) d.trashTop = true; } });
    })) showToast('Đã chuyển vào Thùng rác kho.');
  }
  // ---- Thùng rác kho ----
  function btPaintAdminTrash(el, body){
    const S = btS(), all = btAll(S.lib);
    const tops = all.filter(d=> d.deleted && d.trashTop).sort((a,b)=> String(b.deletedAt||'').localeCompare(String(a.deletedAt||'')));
    body.innerHTML = !tops.length ? '<div class="empty-state" style="padding:26px;"><div class="e-ico">🗑️</div>Thùng rác kho đang trống.</div>' : `
      <div class="mt-toolbar"><span class="mt-hint">Mục trong thùng rác vẫn tính vào dung lượng kho. Xoá vĩnh viễn thì tệp bị xoá hẳn khỏi đám mây.</span><button class="btn btn-ghost btn-sm" id="bt-tr-all" style="color:var(--red); margin-left:auto;">Dọn sạch thùng rác</button></div>
      ${tops.map(d=>{
        const inside = all.filter(x=> x.trashId===d.id && x.id!==d.id), nf = inside.filter(x=> !mtIsFolder(x)).length;
        return `<div class="mt-trash-row">
          <div><b>${mtIsFolder(d) ? '📁' : driveNodeIcon({type:'file', name:d.name, mimeType:d.mimeType})} ${escapeHtml(mtDocTitle(d))}</b>
            <div class="mt-hint">${mtIsFolder(d) ? `Thư mục${inside.length ? ` · ${inside.length} mục bên trong (${nf} tệp)` : ' trống'}` : escapeHtml(mtKindLabel(d) + (d.size ? ' · ' + driveFormatBytes(d.size) : ''))} · xoá lúc ${escapeHtml(mtFmtIso(d.deletedAt))}${d.deletedByName ? ' · bởi ' + escapeHtml(d.deletedByName) : ''}</div></div>
          <div class="mt-trash-actions"><button class="btn btn-ghost btn-sm" data-bt-restore="${escapeHtml(d.id)}">↩️ Khôi phục</button><button class="btn btn-ghost btn-sm" data-bt-purge="${escapeHtml(d.id)}" style="color:var(--red);">Xoá vĩnh viễn</button></div>
        </div>`; }).join('')}`;
    body.querySelectorAll('[data-bt-restore]').forEach(b=> b.onclick = ()=> btLibRestore(b.dataset.btRestore));
    body.querySelectorAll('[data-bt-purge]').forEach(b=> b.onclick = ()=> btLibPurge([b.dataset.btPurge]));
    const allBtn = body.querySelector('#bt-tr-all'); if(allBtn) allBtn.onclick = ()=> btLibPurge(tops.map(d=> d.id));
  }
  async function btLibRestore(trashId){
    if(!btWriteOk('lib')) return;
    if(await btTx({ kind:'lib' }, docs=>{
      const live = new Set(docs.filter(d=> mtIsFolder(d) && !d.deleted).map(d=> d.id));
      docs.forEach(d=>{
        if(d.trashId!==trashId) return;
        delete d.deleted; delete d.trashId; delete d.deletedAt; delete d.deletedByName;
        if(d.trashTop){ delete d.trashTop; if(d.parentId && !live.has(d.parentId)) d.parentId = null; }
      });
    })) showToast('Đã khôi phục.');
  }
  async function btLibPurge(trashIds){
    if(!btWriteOk('lib') || !trashIds.length) return;
    const set = new Set(trashIds), all = btAll(btS().lib), gone = all.filter(d=> d.deleted && set.has(d.trashId));
    if(!confirm(`XOÁ VĨNH VIỄN ${trashIds.length>1 ? `toàn bộ ${trashIds.length} mục trong thùng rác` : `“${mtDocTitle(all.find(d=> d.id===trashIds[0]))}”`}${gone.length>trashIds.length ? ` (cùng ${gone.length - trashIds.length} mục bên trong)` : ''}?\n\nTệp bị xoá hẳn khỏi đám mây, không khôi phục lại được.`)) return;
    const ok = await btTx({ kind:'lib' }, docs=>{ for(let i=docs.length-1; i>=0; i--) if(docs[i].deleted && set.has(docs[i].trashId)) docs.splice(i, 1); });
    if(ok){
      const left = btAll(btS().lib).filter(d=> !(d.deleted && set.has(d.trashId)));
      gone.forEach(d=>{ if(!mtIsFolder(d) && d.storagePath && !left.some(x=> x.storagePath===d.storagePath)) btDeleteStorage(d.storagePath); });
      showToast('Đã xoá vĩnh viễn.');
    }
  }
  // ---- Đóng góp của mọi người ----
  function btPaintAdminContrib(el, body){
    const S = btS();
    if(!S.allLoaded){ body.innerHTML = '<div class="empty-state" style="padding:22px;">Đang tải danh sách đóng góp…</div>'; return; }
    if(S.adminUid && (S.all||{})[S.adminUid]){ btPaintAdminContributor(el, body, S.adminUid); return; }
    S.adminUid = null;
    const rows = Object.entries(S.all||{}).map(([uid, r])=>{
      const files = btAll(r).filter(d=> !mtIsFolder(d)), pend = files.filter(d=> d.status==='pending');
      return { uid, r, pend: pend.length, oldest: pend.map(d=> d.submittedAt||'').sort()[0] || '', acc: files.filter(d=> d.status==='accepted').length, dec: files.filter(d=> d.status==='declined').length, drafts: files.filter(d=> d.status==='draft' || !d.status).length };
    }).filter(x=> x.pend || x.acc || x.dec || x.drafts || btAll(x.r).length)
      .sort((a,b)=> (b.pend>0) - (a.pend>0) || (a.pend ? a.oldest.localeCompare(b.oldest) : String(b.r.updatedAt||'').localeCompare(String(a.r.updatedAt||''))));
    body.innerHTML = !rows.length ? '<div class="empty-state" style="padding:26px;"><div class="e-ico">📥</div>Chưa có ai đóng góp.</div>' : `
      <p class="mt-hint" style="margin:0 0 10px;">Người có tài liệu chờ duyệt xếp trên, ai gửi sớm hơn đứng trước. Tài liệu 📝 nháp người góp chưa gửi thì Ban quản trị chưa xem được.</p>
      <div class="mt-cards">${rows.map(x=>`
        <div class="mt-card">
          <button type="button" class="mt-card-main" data-bt-user="${escapeHtml(x.uid)}">
            <span class="mt-card-title">${escapeHtml(x.r.displayName || x.r.name || x.r.email || 'Người đóng góp')} ${x.pend ? `<span class="bt-chip pending">🕓 ${x.pend} chờ duyệt</span>` : ''}</span>
            <span class="mt-card-meta">${escapeHtml(x.r.email || '')}${x.r.place ? ' · 📍 ' + escapeHtml(x.r.place) : ''}</span>
            <span class="mt-card-meta">${x.acc ? `✅ ${x.acc} đã đưa vào kho` : ''}${x.dec ? ` · ↩️ ${x.dec} chưa sử dụng` : ''}${x.drafts ? ` · 📝 ${x.drafts} nháp chưa gửi` : ''}${x.r.lastSubmittedAt ? ` · gửi gần nhất ${escapeHtml(mtFmtIso(x.r.lastSubmittedAt))}` : ''}</span>
          </button>
          <div class="mt-card-actions"><button class="btn btn-ghost btn-sm" data-bt-user="${escapeHtml(x.uid)}">Mở ›</button></div>
        </div>`).join('')}</div>`;
    body.querySelectorAll('[data-bt-user]').forEach(b=> b.onclick = ()=>{ S.adminUid = b.dataset.btUser; S.aCNav = { id:null, path:[], notice:'' }; btPaintAdmin(el); window.scrollTo(0, 0); });
  }
  function btPaintAdminContributor(el, body, uid){
    const S = btS(), r = S.all[uid], view = btAdminContribView(r);
    const t = { kind:'contrib', uid };
    const cx = { t, rootName:'Ngăn đóng góp', maxDepth: BT_C_DEPTH, maxFolders: 999, view: ()=> btAdminContribView((btS().all||{})[uid]), folderCount: ()=> 0 };
    const drafts = btAll(r).filter(d=> !mtIsFolder(d) && (d.status==='draft' || !d.status)).length;
    const pend = btPendingCount(r);
    body.innerHTML = `
      <div class="mt-editor-bar"><button class="btn btn-ghost btn-sm btn-back-list" id="bt-u-back">← Danh sách người đóng góp</button>
        ${pend ? `<div class="mt-editor-bar-right"><button class="btn btn-primary btn-sm" id="bt-u-accept-all">➡️ Đưa tất cả ${pend} tài liệu chờ duyệt vào kho…</button></div>` : ''}</div>
      <div class="bt-user-card">
        <b>${escapeHtml(r.displayName || r.name || 'Người đóng góp')}</b>${r.name && r.displayName && r.name!==r.displayName ? ` <span class="mt-hint">(tên Google: ${escapeHtml(r.name)})</span>` : ''}
        <div class="mt-hint">${escapeHtml(r.email || '')}${r.place ? ' · 📍 ' + escapeHtml(r.place) : ''}</div>
        <div class="mt-hint">${r.credit ? '✍️ Đồng ý ghi tên dưới mẫu: “' + escapeHtml(btCreditText({ name: r.displayName || r.name, place: r.place })) + '”' : '🙈 Không muốn ghi tên dưới mẫu'}${drafts ? ` · 📝 còn ${drafts} tài liệu nháp chưa gửi` : ''}</div>
      </div>
      <div id="bt-u-tree"></div>`;
    body.querySelector('#bt-u-back').onclick = ()=>{ S.adminUid = null; btPaintAdmin(el); };
    const aa = body.querySelector('#bt-u-accept-all'); if(aa) aa.onclick = ()=> btAcceptModal(uid, null);
    const go = id=>{ S.aCNav.id = id || null; S.aCNav.notice = ''; btPaintAdmin(el); };
    const hasPend = id=>{ const v = cx.view(); return mtDescendantIds(v, id).size && v.docs.some(d=> d.status==='pending' && mtDescendantIds(v, id).has(d.id)); };
    btPaintTree(body.querySelector('#bt-u-tree'), {
      view, nav: S.aCNav, rootName:'Ngăn đóng góp', canEdit:false, cx:null,
      empty:'Người này chưa gửi tài liệu nào (có thể còn tài liệu nháp chưa gửi).',
      draggable: ()=> false,
      meta: btContribMeta,
      go,
      openFile: id=>{
        const d = view.docs.find(x=> x.id===id); if(!d) return;
        if(!d.storagePath){ showToast('Tệp gốc đã được xoá sau khi duyệt.'); return; }
        const files = mtChildFiles(view, S.aCNav.id).filter(x=> x.storagePath);
        btOpenViewer(files, Math.max(0, files.findIndex(x=> x.id===id)));
      },
      rowButtons: d=> (!mtIsFolder(d) && d.status==='pending') || (mtIsFolder(d) && hasPend(d.id))
        ? `<button class="btn btn-primary btn-sm" data-bt-acc="${escapeHtml(d.id)}" title="Đưa vào kho chung">➡️ Đưa vào kho</button><button class="btn btn-ghost btn-sm" data-bt-dec="${escapeHtml(d.id)}" title="Chưa sử dụng">↩️</button>` : '',
      menu: d=>{
        const pendHere = mtIsFolder(d) ? hasPend(d.id) : d.status==='pending';
        return [
          mtIsFolder(d) ? { icon:'📂', label:'Mở', onClick:()=> go(d.id) } : (d.storagePath ? { icon:'👁', label:'Xem', onClick:()=> btOpenViewer([d], 0) } : null),
          !mtIsFolder(d) && d.storagePath ? { icon:'⬇', label:'Tải về', onClick:()=> btDownload(d) } : null,
          pendHere ? { icon:'➡️', label: mtIsFolder(d) ? 'Đưa cả thư mục vào kho chung…' : 'Đưa vào kho chung…', onClick:()=> btAcceptModal(uid, d.id) } : null,
          pendHere ? { icon:'↩️', label: mtIsFolder(d) ? 'Không sử dụng cả thư mục…' : 'Không sử dụng…', onClick:()=> btDeclineModal(uid, d.id) } : null,
          { icon:'✏️', label:'Đổi tên', onClick:()=> btRename(cx, d.id) },
          { icon:'🗑️', label:'Xoá khỏi ngăn của người gửi', danger:true, onClick:()=> btAdminDeleteContrib(uid, d.id) },
        ].filter(Boolean);
      },
      wire: box=>{
        box.querySelectorAll('[data-bt-acc]').forEach(b=> b.onclick = e=>{ e.stopPropagation(); btAcceptModal(uid, b.dataset.btAcc); });
        box.querySelectorAll('[data-bt-dec]').forEach(b=> b.onclick = e=>{ e.stopPropagation(); btDeclineModal(uid, b.dataset.btDec); });
      },
    });
  }
  // Các tệp CHỜ DUYỆT thuộc rootId (một tệp, một thư mục, hoặc null = cả ngăn) + các thư mục cần dựng lại.
  function btPlan(rec, rootId){
    const all = btAll(rec), v = { docs: all }, map = mtFolderMap(v);
    const root = rootId ? all.find(d=> d.id===rootId) : null;
    if(root && !mtIsFolder(root)) return { rec, root, files: root.status==='pending' ? [root] : [], folders: [] };
    const scope = rootId ? mtDescendantIds(v, rootId) : new Set(all.map(d=> d.id));
    const files = all.filter(d=> scope.has(d.id) && !mtIsFolder(d) && d.status==='pending');
    const need = new Set(rootId ? [rootId] : []);
    files.forEach(d=>{ let p = mtParentId(d, map), g = 0; while(p && p!==rootId && g++<20){ need.add(p); p = mtParentId(map[p], map); } });
    return { rec, root, files, folders: all.filter(d=> need.has(d.id)) };
  }
  // Chuỗi thư mục (thuộc kế hoạch chép) từ trên xuống, kết thúc ở thư mục `id`.
  function btPlanChain(plan, id){
    const v = { docs: btAll(plan.rec) }, map = mtFolderMap(v), inPlan = new Set(plan.folders.map(f=> f.id)), out = [];
    let p = id, g = 0;
    while(p && inPlan.has(p) && g++<20){ out.unshift(map[p]); p = mtParentId(map[p], map); }
    return out;
  }
  async function btAcceptModal(uid, rootId){
    if(!btWriteOk('admin')) return;
    const rec = (btS().all||{})[uid]; if(!rec) return;
    const plan = btPlan(rec, rootId);
    if(!plan.files.length){ alert('Không có tài liệu nào đang chờ duyệt ở đây.'); return; }
    const credit = rec.credit ? { name: rec.displayName || rec.name || '', place: rec.place || '' } : null;
    const single = plan.root && !mtIsFolder(plan.root), titleVal = plan.root ? mtDocTitle(plan.root) : '';
    const extraHtml = `
      <div class="bt-acc-sum">Sẽ chép <b>${plan.files.length} tài liệu</b>${plan.folders.length ? ` cùng <b>${plan.folders.length} thư mục</b> (giữ nguyên cấu trúc)` : ''} vào kho chung.</div>
      ${plan.root ? `<div class="field">${mtLabel(single ? 'Tên hiển thị trong kho' : 'Tên thư mục trong kho', true)}<input id="bt-acc-title" maxlength="${BT_TITLE_MAX}" value="${escapeHtml(titleVal)}">${mtCounterHtml('bt-acc-title', titleVal, BT_TITLE_MAX)}</div>` : ''}
      ${credit ? `<label class="bt-check"><input type="checkbox" id="bt-acc-credit" checked> Ghi dòng “${escapeHtml(btCreditText(credit))}” dưới mẫu</label>` : '<div class="mt-hint" style="margin-bottom:8px;">🙈 Người gửi không chọn ghi tên dưới mẫu.</div>'}`;
    const view = btLibLive;
    const height = plan.folders.reduce((h, f)=> Math.max(h, btPlanChain(plan, f.id).length), 0);
    const r = await btFolderPicker({
      view, rootName: BT_LIB_ROOT, title:'➡️ Đưa vào kho chung', okLabel:'Chép vào thư mục này', extraHtml,
      reason: at=> mtFolderPath(view(), at).length + height > BT_L_DEPTH ? `Vượt quá ${BT_L_DEPTH} tầng thư mục lồng nhau — hãy chọn thư mục nông hơn.` : '',
      newFolder: at=> btCreateFolder(btLibCx(), at),
    });
    if(!r) return;
    const ti = r.extra && r.extra.querySelector('#bt-acc-title'), ci = r.extra && r.extra.querySelector('#bt-acc-credit');
    const newTitle = ti ? (ti.value.trim().slice(0, BT_TITLE_MAX) || titleVal) : '';
    await btAccept(uid, plan, r.at, { title: newTitle, credit: ci && ci.checked ? credit : null });
  }
  async function btAccept(uid, plan, targetId, opt){
    if(!btWriteOk('admin')) return;
    if(btAll(btS().lib).filter(mtIsFolder).length + plan.folders.length > BT_L_FOLDERS){ alert(`Kho tối đa ${BT_L_FOLDERS} thư mục.`); return; }
    if(!btLibCheckRoom(plan.files)) return;
    const idMap = {}; plan.folders.forEach(f=> idMap[f.id] = mtDocId());
    const rootId = plan.root ? plan.root.id : null;
    const parentFor = d=>{ if(rootId && d.id===rootId) return targetId || null; return d.parentId && idMap[d.parentId] ? idMap[d.parentId] : (targetId || null); };
    const now = btNow(), who = btActor();
    const targetPath = [BT_LIB_ROOT].concat(mtFolderPath(btLibLive(), targetId).map(mtDocTitle)).join(' › ');
    const copied = [], newDocs = [];
    for(let i=0; i<plan.files.length; i++){
      const f = plan.files[i];
      btSetStatus('bt-a-status', `⏳ Đang chép vào kho ${i+1}/${plan.files.length}: “${mtDocTitle(f)}”…`);
      try{
        const url = await storage.ref(f.storagePath).getDownloadURL();
        const resp = await fetch(url); if(!resp.ok) throw new Error('HTTP ' + resp.status);
        const blob = await resp.blob();
        const id = mtDocId(), path = `branch_templates/library/${id}_${mtSafeName(f.name)}`;
        await storage.ref(path).put(blob, { contentType: f.mimeType || blob.type || 'application/octet-stream' });
        let storageUrl = ''; try{ storageUrl = await storage.ref(path).getDownloadURL(); }catch(e){}
        newDocs.push(btClean({ id, parentId: parentFor(f), name: f.name, title: (rootId===f.id && opt.title) ? opt.title : mtDocTitle(f), mimeType: f.mimeType, size: f.size,
          storagePath: path, storageUrl: storageUrl || undefined, credit: opt.credit || undefined, fromUid: uid, acceptedAt: now, acceptedByName: who, addedAt: now, updatedAt: now }));
        copied.push(f);
      }catch(e){ console.error('[Kho mẫu] Chép tệp đóng góp lỗi:', e); alert(`Không chép được “${mtDocTitle(f)}”.\n\n${e && e.message ? e.message : ''}`); }
    }
    btSetStatus('bt-a-status', '');
    if(!copied.length) return;
    const folderDocs = plan.folders.map(f=> ({ id: idMap[f.id], type:'folder', parentId: parentFor(f), title: (rootId===f.id && opt.title) ? opt.title : mtDocTitle(f), addedAt: now, updatedAt: now }));
    const order = btAll(plan.rec).map(d=> d.id);
    const byOld = {}; plan.folders.forEach((f,i)=> byOld[f.id] = folderDocs[i]); copied.forEach((f,i)=> byOld[f.id] = newDocs[i]);
    const toAdd = order.filter(id=> byOld[id]).map(id=> byOld[id]);
    const okLib = await btTx({ kind:'lib' }, docs=>{ toAdd.forEach(d=> docs.push(d)); });
    if(!okLib){ newDocs.forEach(d=> btDeleteStorage(d.storagePath)); return; }
    // Ghi kết quả vào ngăn người góp: tệp gốc xoá khỏi Storage, chỉ giữ dòng ghi nhận.
    const ids = new Set(copied.map(f=> f.id));
    const pmap = mtFolderMap({ docs: btAll(plan.rec) });
    const pathOf = f=> [targetPath].concat(btPlanChain(plan, mtParentId(f, pmap)).map(x=> x.id===rootId && opt.title ? opt.title : mtDocTitle(x))).join(' › ');
    const dest = {}; copied.forEach(f=> dest[f.id] = pathOf(f));
    await btTx({ kind:'contrib', uid }, docs=>{
      docs.forEach(d=>{ if(ids.has(d.id)){ d.status = 'accepted'; d.reviewedAt = now; d.reviewedByName = who; d.acceptedTo = dest[d.id]; delete d.storagePath; } });
    });
    let freed = 0; copied.forEach(f=>{ btDeleteStorage(f.storagePath); freed += f.size||0; });
    btStatAdd(-freed);
    showToast(`Đã đưa ${copied.length} tài liệu vào kho chung.`);
  }
  async function btDeclineModal(uid, rootId){
    if(!btWriteOk('admin')) return;
    const rec = (btS().all||{})[uid]; if(!rec) return;
    const plan = btPlan(rec, rootId);
    if(!plan.files.length){ alert('Không có tài liệu nào đang chờ duyệt ở đây.'); return; }
    const reason = await new Promise(resolve=>{
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg mt-font';
      wrap.innerHTML = `<div class="modal" style="max-width:500px;" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>↩️ Chưa sử dụng ${plan.files.length>1 ? plan.files.length + ' tài liệu' : '“' + escapeHtml(mtDocTitle(plan.files[0])) + '”'}</h3><button class="modal-close" data-dc-close aria-label="Đóng">✕</button></div>
        <div class="modal-body">
          <div class="mt-hint" style="margin-bottom:8px;">Người gửi sẽ thấy lý do này trong ngăn đóng góp. Tệp gốc sẽ bị xoá khỏi đám mây.</div>
          ${BT_DECLINE_REASONS.map((t,i)=>`<label class="bt-check"><input type="radio" name="bt-dc" value="${i}" ${i===0?'checked':''}> ${escapeHtml(t)}</label>`).join('')}
          <div class="field" style="margin-top:8px;">${mtLabel('Ghi thêm cho người gửi', false)}<textarea id="bt-dc-note" rows="2" maxlength="${BT_REASON_MAX}"></textarea>${mtCounterHtml('bt-dc-note', '', BT_REASON_MAX)}</div>
        </div>
        <div class="modal-foot"><button class="btn btn-ghost" data-dc-close>Huỷ</button><button class="btn btn-primary" data-dc-ok>Xác nhận chưa sử dụng</button></div>
      </div>`;
      document.body.appendChild(wrap);
      mtWireCounters(wrap);
      const done = v=>{ wrap.remove(); resolve(v); };
      wrap.querySelectorAll('[data-dc-close]').forEach(b=> b.onclick = ()=> done(null));
      wrap.querySelector('[data-dc-ok]').onclick = ()=>{
        const i = +((wrap.querySelector('input[name="bt-dc"]:checked')||{}).value || 0);
        const note = wrap.querySelector('#bt-dc-note').value.trim().slice(0, BT_REASON_MAX);
        const base = BT_DECLINE_REASONS[i];
        if(i===BT_DECLINE_REASONS.length-1 && !note){ alert('Vui lòng ghi rõ lý do.'); return; }
        done(i===BT_DECLINE_REASONS.length-1 ? note : (note ? `${base}. ${note}` : base));
      };
    });
    if(!reason) return;
    const ids = new Set(plan.files.map(f=> f.id)), now = btNow(), who = btActor();
    if(await btTx({ kind:'contrib', uid }, docs=>{
      docs.forEach(d=>{ if(ids.has(d.id) && d.status==='pending'){ d.status = 'declined'; d.declineReason = reason; d.reviewedAt = now; d.reviewedByName = who; delete d.storagePath; } });
    })){
      let freed = 0; plan.files.forEach(f=>{ btDeleteStorage(f.storagePath); freed += f.size||0; });
      btStatAdd(-freed);
      showToast(`Đã ghi “chưa sử dụng” cho ${plan.files.length} tài liệu.`);
    }
  }
  async function btAdminDeleteContrib(uid, id){
    if(!btWriteOk('admin')) return;
    const all = btAll((btS().all||{})[uid]), it = all.find(d=> d.id===id); if(!it) return;
    const ids = mtIsFolder(it) ? new Set([id, ...mtDescendantIds({ docs: all }, id)]) : new Set([id]);
    const victims = all.filter(d=> ids.has(d.id) && !mtIsFolder(d));
    if(!confirm(`Xoá “${mtDocTitle(it)}”${victims.length>1 ? ` cùng ${victims.length} tài liệu bên trong` : ''} khỏi ngăn của người gửi?\n\nNgười gửi sẽ không thấy dòng này nữa (không có lời nhắn). Muốn báo lý do thì dùng “↩️ Không sử dụng”. Không khôi phục lại được.`)) return;
    if(await btTx({ kind:'contrib', uid }, docs=>{ for(let i=docs.length-1; i>=0; i--) if(ids.has(docs[i].id)) docs.splice(i, 1); })){
      let freed = 0; victims.forEach(d=>{ if(d.storagePath){ btDeleteStorage(d.storagePath); freed += d.size||0; } });
      btStatAdd(-freed);
      showToast('Đã xoá.');
    }
  }

  // =====================================================================
  // ĐIỂM KHỞI ĐỘNG ỨNG DỤNG — PHẢI LUÔN NẰM Ở CUỐI PHẦN CUỐI CÙNG trong
  // manifest.json. Toàn bộ các phần được nối lại thành MỘT hàm bọc (IIFE)
  // duy nhất mở ở 01-foundation.js và đóng ngay bên dưới, nhờ vậy mọi phần
  // dùng chung được `state`, `render`, `escapeHtml`... Nếu sau này thêm
  // phần mới, hãy CHUYỂN nguyên khối này xuống cuối phần đó — để mọi khai
  // báo `let/const` đều đã khởi tạo xong trước khi boot() chạy (tránh lỗi
  // "Cannot access before initialization").
  // =====================================================================
  const _publicReceiptId = publicReceiptRouteId();
  const _publicSurveyId = publicSurveyRouteId();
  const _publicMeetingId = publicMeetingRouteId();
  const _publicTrainingId = publicTrainingRouteId();
  if(_publicReceiptId){
    renderPublicReceiptPage(_publicReceiptId);
  } else if(_publicSurveyId){
    renderPublicSurveyPage(_publicSurveyId);
  } else if(_publicMeetingId){
    renderPublicMeetingPage(_publicMeetingId);
  } else if(_publicTrainingId){
    renderPublicTrainingPage(_publicTrainingId);
  } else {
    boot();
  }
})();
