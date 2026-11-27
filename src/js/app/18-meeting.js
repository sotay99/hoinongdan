  // =====================================================================
  // 18-meeting.js — Module PHÒNG HỌP KHÔNG GIẤY (Giai đoạn 1).
  //
  // Mỗi cuộc họp = một bản ghi meetings/{mã} ở CẤP GỐC (giống surveys/) để đại biểu bấm link công khai
  // /phonghop/{mã} (hoặc quét mã QR) là đọc được ngay — KHÔNG cần đăng nhập, KHÔNG cần biết mã xã.
  // Bản ghi chứa thông tin cuộc họp + danh sách tài liệu ĐÃ SẮP THEO THỨ TỰ CHƯƠNG TRÌNH (mảng docs). Trong
  // mảng có cả THƯ MỤC (type:'folder', nhiều tầng qua parentId) — duyệt kiểu Google Drive: bấm thư mục là vào
  // trong, thanh địa chỉ ở trên; mỗi cuộc họp vẫn chỉ MỘT link/mã QR cho toàn bộ cây thư mục.
  // Tệp tải lên nằm ở Storage: meeting_files/{mã cuộc họp}/{mã tài liệu}_{tên an toàn}. Tài liệu chọn
  // từ Trung tâm dữ liệu chỉ được THAM CHIẾU (không chép tệp), gỡ khỏi cuộc họp thì tệp gốc vẫn còn.
  //
  // Hai không gian giống Biểu mẫu: DÙNG CHUNG theo mã xã (quyền 'meeting' ở "Cài đặt & Chia sẻ") và
  // CÁ NHÂN theo tài khoản Google. Danh sách lọc bằng orderByChild('wardId'|'ownerEmail') — nên thêm
  // ".indexOn":["wardId","ownerEmail"] cho nút meetings trong Firebase Rules.
  //
  // Khối khởi động boot() đã chuyển xuống phần cuối manifest (19-training.js).
  // =====================================================================
  const MT_MAX_FILE_MB = 30;
  // Giới hạn ký tự: tên cuộc họp/tài liệu hiện ở nhiều chỗ chật (áp phích QR, màn hình chiếu, khung xem
  // trước Zalo, thẻ dán bàn) nên giữ ở mức 150.
  const MT_TITLE_MAX = 150, MT_PLACE_MAX = 100, MT_NOTE_MAX = 1000, MT_DOC_TITLE_MAX = 150;
  // Cây thư mục tài liệu: thư mục là một mục trong mảng docs có type:'folder'; mỗi mục có parentId (null = thư
  // mục gốc "Tài liệu cuộc họp"). Thứ tự trong một thư mục = thứ tự trong mảng docs. Cuộc họp cũ không có
  // parentId nên mọi tệp nằm ở gốc, giữ nguyên thứ tự.
  const MT_MAX_FILES = 100, MT_MAX_FOLDERS = 50, MT_MAX_DEPTH = 5;
  const MT_ROOT_NAME = 'Tài liệu cuộc họp';
  const MT_ID_RE = /^[A-Za-z0-9_-]{6,128}$/;
  const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  function mtS(){
    if(!state.mt) state.mt = { space:null, view:'list', editingId:null, list:[], trash:[], loaded:false, error:'', q:'', uploading:'' };
    return state.mt;
  }
  function mtNewId(){
    const a = new Uint8Array(12);
    try{ crypto.getRandomValues(a); }catch(e){ for(let i=0;i<a.length;i++) a[i] = Math.floor(Math.random()*256); }
    return 'mt' + Array.from(a, b=> (b%36).toString(36)).join('');
  }
  function mtDocId(){ return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function mtDocs(m){
    const d = m && m.docs;
    return (Array.isArray(d) ? d : Object.values(d||{})).filter(x=> x && x.id);
  }
  function mtFind(id){ const S = mtS(); return S.list.find(m=> m.id===id) || null; }
  // ---- Cây thư mục ----
  function mtIsFolder(d){ return !!d && d.type==='folder'; }
  function mtFileCount(m){ return mtDocs(m).filter(d=> !mtIsFolder(d)).length; }
  function mtFolderCount(m){ return mtDocs(m).filter(mtIsFolder).length; }
  function mtFolderMap(m){ const map = {}; mtDocs(m).forEach(d=>{ if(mtIsFolder(d)) map[d.id] = d; }); return map; }
  // Thư mục cha hợp lệ của một mục (cha không còn tồn tại thì coi như nằm ở gốc).
  function mtParentId(d, map){ return d && d.parentId && d.parentId!==d.id && map[d.parentId] ? d.parentId : null; }
  function mtChildren(m, folderId){ const map = mtFolderMap(m); return mtDocs(m).filter(d=> mtParentId(d, map)===(folderId||null)); }
  function mtChildFiles(m, folderId){ return mtChildren(m, folderId).filter(d=> !mtIsFolder(d)); }
  // Đường dẫn từ gốc tới thư mục (không gồm gốc): [thư mục cấp 1, cấp 2, …, chính nó].
  function mtFolderPath(m, folderId){
    const map = mtFolderMap(m), out = [];
    let cur = folderId ? map[folderId] : null, guard = 0;
    while(cur && guard++ < 20){ out.unshift(cur); const pid = mtParentId(cur, map); cur = pid ? map[pid] : null; }
    return out;
  }
  function mtDescendantIds(m, folderId){
    const all = mtDocs(m), map = mtFolderMap(m), out = new Set();
    const walk = id=>{ all.forEach(d=>{ if(mtParentId(d, map)===id && !out.has(d.id)){ out.add(d.id); if(mtIsFolder(d)) walk(d.id); } }); };
    walk(folderId);
    return out;
  }
  // Số tầng thư mục của cả nhánh, tính cả chính thư mục đó (để chặn vượt MT_MAX_DEPTH khi di chuyển).
  function mtSubtreeHeight(m, folderId){
    const all = mtDocs(m), map = mtFolderMap(m); let h = 1;
    const walk = (id, depth)=>{ h = Math.max(h, depth); all.forEach(d=>{ if(mtIsFolder(d) && mtParentId(d, map)===id) walk(d.id, depth+1); }); };
    walk(folderId, 1);
    return h;
  }
  function mtCountsText(m, folderId){
    const kids = mtChildren(m, folderId), f = kids.filter(d=> !mtIsFolder(d)).length, s = kids.filter(mtIsFolder).length;
    return [f ? `${f} tệp` : '', s ? `${s} thư mục` : ''].filter(Boolean).join(' · ') || 'Thư mục trống';
  }
  // Thanh địa chỉ: gốc › … › thư mục đang mở (in đậm, không bấm). attr = tên data-* để gắn sự kiện.
  function mtCrumbsHtml(path, attr){
    const items = [{ id:'', title: MT_ROOT_NAME }].concat(path.map(f=> ({ id:f.id, title: mtDocTitle(f) })));
    // Chữ chảy liền (inline) để tên dài tự xuống hàng; dấu "›" dính liền với tên PHÍA SAU nó (&nbsp;) nên
    // không bao giờ đứng trơ trọi một mình ở cuối/đầu dòng.
    // Đang ở trong thư mục con (bất kỳ tầng nào) thì thanh địa chỉ nền đỏ nhạt, viền đỏ đậm cho dễ nhận ra —
    // áp dụng ở mọi nơi dùng hàm này: trình sửa, hộp "Di chuyển", "Xem như đại biểu", trang đại biểu.
    return `<nav class="mt-crumbs ${path.length ? 'in-sub' : ''}" aria-label="Đường dẫn thư mục">${items.map((it,i)=>{
      const label = `${i===0 ? '📁 ' : ''}${escapeHtml(it.title)}`;
      const sep = i ? '<span class="mt-crumb-sep" aria-hidden="true">›&nbsp;</span>' : '';
      return sep + (i===items.length-1
        ? `<span class="mt-crumb cur" aria-current="page">${label}</span>`
        : `<span role="button" tabindex="0" class="mt-crumb preview-allow" data-${attr}="${escapeHtml(it.id)}">${label}</span>`);
    }).join(' ')}</nav>${path.length ? mtCrumbBackHtml(path, attr) : ''}`;
  }
  // Nút "‹ Quay lại thư mục trước": sát dưới thanh địa chỉ, bên trái; chỉ có khi đang ở thư mục con. Mang cùng
  // data-* với các mục trên thanh địa chỉ (trỏ tới thư mục cha, '' = gốc) nên dùng chung luôn việc bấm, phím
  // Enter và thả kéo (thả tệp lên nút = chuyển tệp lên thư mục cha) ở mọi nơi.
  function mtCrumbBackHtml(path, attr){
    const parent = path.length >= 2 ? path[path.length-2] : null;
    const to = parent ? mtDocTitle(parent) : MT_ROOT_NAME;
    return `<div class="mt-crumb-back-row"><button type="button" class="mt-crumb-back preview-allow" data-${attr}="${escapeHtml(parent ? parent.id : '')}" title="Về “${escapeHtml(to)}”">‹ Quay lại thư mục trước</button></div>`;
  }
  // Mục trên thanh địa chỉ là <span role="button"> (thẻ <button> không ngắt dòng giữa chừng được, tên thư mục
  // dài sẽ bị đẩy cả cụm xuống dòng) — bấm Enter/Space khi đang chọn bằng bàn phím cũng như bấm chuột.
  if(!window.__mtCrumbKeys){
    window.__mtCrumbKeys = true;
    document.addEventListener('keydown', e=>{
      const t = e.target;
      if((e.key==='Enter' || e.key===' ') && t && t.matches && t.matches('.mt-crumb[role="button"]')){ e.preventDefault(); t.click(); }
    });
  }
  // Thư mục đang đứng còn tồn tại không; mất (bị xoá/chuyển đi) thì lùi về thư mục cha gần nhất còn lại trên
  // đường dẫn cũ. Trả về { id, notice }.
  function mtResolveFolder(m, wantedId, oldPathIds){
    const map = mtFolderMap(m);
    if(!wantedId || map[wantedId]) return { id: wantedId || null, notice:'' };
    const keep = (oldPathIds||[]).filter(id=> map[id]);
    const id = keep.length ? keep[keep.length-1] : null;
    return { id, notice:`Thư mục đang mở vừa bị xoá hoặc chuyển đi — đã quay về “${id ? mtDocTitle(map[id]) : MT_ROOT_NAME}”.` };
  }
  // Nhãn ô nhập: dấu * đỏ cho ô bắt buộc, chữ xám "(không bắt buộc)" cho ô tuỳ chọn.
  function mtLabel(text, required, extra){
    return `<label>${escapeHtml(text)} ${required ? '<span style="color:var(--red);">*</span>' : '<span class="mt-hint">(không bắt buộc)</span>'}${extra ? ` <span class="mt-hint">${escapeHtml(extra)}</span>` : ''}</label>`;
  }
  // Bộ đếm "45/150 ký tự" ngay dưới ô; gần chạm giới hạn thì đổi màu cam.
  function mtCounterHtml(forId, value, max){
    const n = Array.from(String(value||'')).length;
    return `<div class="mt-count ${n>=max*0.9?'near':''}" data-mt-count="${forId}">${n}/${max} ký tự</div>`;
  }
  function mtWireCounters(scope){
    scope.querySelectorAll('[data-mt-count]').forEach(c=>{
      const inp = scope.querySelector('#'+c.dataset.mtCount); if(!inp) return;
      const max = parseInt(inp.getAttribute('maxlength'),10) || 0;
      inp.addEventListener('input', ()=>{ const n = Array.from(inp.value).length; c.textContent = `${n}/${max} ký tự`; c.classList.toggle('near', n>=max*0.9); });
    });
  }
  function mtDocTitle(doc){ return String((doc && (doc.title || doc.name)) || 'Tài liệu'); }
  function mtStripExt(name){ return String(name||'').replace(/\.[a-z0-9]{1,6}$/i, '') || String(name||''); }
  function mtSafeName(name){ return String(name||'tep').replace(/[^\w.\-() ]+/g,'_').slice(-100); }
  function mtKindLabel(doc){
    return ({ pdf:'PDF', docx:'Word', xlsx:'Excel', pptx:'PowerPoint', image:'Ảnh', text:'Văn bản' })[driveFileKind(doc)] || 'Tệp';
  }

  // ---- Thời gian: startAt lưu dạng giờ địa phương "YYYY-MM-DDTHH:mm" (đúng giá trị ô datetime-local, để
  // hiển thị không lệch múi giờ); closeAt lưu ISO để so với giờ hiện tại chính xác trên mọi máy.
  const MT_WEEKDAYS = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  function mtPad(n){ return String(n).padStart(2,'0'); }
  function mtFmtStart(s){
    const m = String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if(!m) return '';
    const d = new Date(+m[1], +m[2]-1, +m[3]);
    const time = m[4] ? `${m[4]}:${m[5]}, ` : '';
    return `${time}${MT_WEEKDAYS[d.getDay()]} ${m[3]}/${m[2]}/${m[1]}`;
  }
  function mtFmtIso(iso){
    const d = new Date(iso); if(isNaN(d)) return '';
    return `${mtPad(d.getHours())}:${mtPad(d.getMinutes())} ${mtPad(d.getDate())}/${mtPad(d.getMonth()+1)}/${d.getFullYear()}`;
  }
  function mtIsoToLocalInput(iso){
    const d = new Date(iso); if(isNaN(d)) return '';
    return `${d.getFullYear()}-${mtPad(d.getMonth()+1)}-${mtPad(d.getDate())}T${mtPad(d.getHours())}:${mtPad(d.getMinutes())}`;
  }
  function mtLocalInputToIso(v){ if(!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toISOString(); }

  // Trạng thái liên kết công khai: đóng tay > hết hạn hẹn giờ > đang mở.
  function mtStatus(m){
    if(!m) return { open:false, key:'missing', label:'Không tồn tại' };
    if(m.status==='closed') return { open:false, key:'closed', label:'Đã đóng liên kết' };
    if(m.closeAt && new Date(m.closeAt).getTime() <= Date.now()) return { open:false, key:'expired', label:'Đã hết hạn' };
    return { open:true, key:'open', label: m.closeAt ? `Đang mở · tự đóng lúc ${mtFmtIso(m.closeAt)}` : 'Đang mở' };
  }

  // ---- Link công khai. Bản xem trước của nhánh phụ / máy chạy thử không có Cloud Function meetingMeta
  // (trên bản xem trước /phonghop/** còn chạy function của production) -> dùng dạng # như Biểu mẫu.
  function mtShareUrl(id){
    return surveyUsesHashLinks() ? `${location.origin}/#/phonghop/${encodeURIComponent(id)}` : `${location.origin}/phonghop/${encodeURIComponent(id)}`;
  }
  function publicMeetingRouteId(){
    const p = (window.location.pathname||'').match(/^\/phonghop\/([^/]+)\/?$/);
    if(p) return decodeURIComponent(p[1]);
    const h = (window.location.hash||'').match(/^#\/phonghop\/([^/?]+)\/?$/);
    return h ? decodeURIComponent(h[1]) : null;
  }

  // ---- Phân quyền ----
  function mtHasPersonal(){ return !!(state.identity && state.identity.email); }
  function mtCanView(){
    if(isTourMode()) return true;
    return mtS().space==='personal' ? mtHasPersonal() : (!!wardId() && canViewModule('meeting'));
  }
  // Giao diện sửa hiện cho cả môi trường tham quan (để xem thử); thao tác ghi thật bị chặn ở mtWriteOk().
  function mtCanEdit(){
    if(isTourMode()) return true;
    return mtS().space==='personal' ? mtHasPersonal() : (!!wardId() && canEditModule('meeting'));
  }
  function mtWriteOk(){
    if(isTourMode()){ alert('Đồng chí đang ở môi trường tham quan, vui lòng đăng nhập để sử dụng tính năng này.'); return false; }
    if(!mtCanEdit()){ alert(mtS().space==='personal' ? 'Phòng họp cá nhân yêu cầu đăng nhập bằng tài khoản Google.' : 'Đồng chí không có quyền sửa Phòng họp dùng chung này. Vui lòng liên hệ Chủ mã để được cấp quyền tại "Cài đặt & Chia sẻ".'); return false; }
    return true;
  }
  function mtDefaultSpace(){
    if(isTourMode()) return 'shared';
    if(wardId() && canViewModule('meeting')) return 'shared';
    return mtHasPersonal() ? 'personal' : 'shared';
  }

  // ---- Dữ liệu mẫu cho môi trường tham quan (không đọc/ghi Firebase) ----
  function mtDemoMeetings(){
    const d = new Date(); d.setDate(d.getDate()+3);
    const day = `${d.getFullYear()}-${mtPad(d.getMonth()+1)}-${mtPad(d.getDate())}`;
    const txt = (name, content)=> ({ id:mtDocId(), name, title:mtStripExt(name), mimeType:'text/plain', size:content.length, content, source:'demo', addedAt:new Date().toISOString() });
    return [{
      id:'mtdemo00000001', scope:'shared', demo:true, wardName:'(mẫu)', title:'Hội nghị sơ kết 6 tháng đầu năm (mẫu)',
      startAt:`${day}T08:00`, place:'Hội trường UBND', note:'Đề nghị đại biểu nghiên cứu trước dự thảo báo cáo và góp ý trực tiếp tại hội nghị.',
      status:'open', closeAt:'', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      docs:[
        txt('Chương trình hội nghị.txt', '1. Tuyên bố lý do, giới thiệu đại biểu\n2. Báo cáo sơ kết 6 tháng đầu năm\n3. Thảo luận\n4. Phát động thi đua 6 tháng cuối năm\n5. Bế mạc'),
        { id:'mtdemofolder1', type:'folder', parentId:null, title:'Báo cáo và phụ lục', addedAt:new Date().toISOString() },
        { ...txt('Dự thảo báo cáo sơ kết.txt', 'DỰ THẢO\n\nBÁO CÁO SƠ KẾT CÔNG TÁC HỘI 6 THÁNG ĐẦU NĂM\n\n(Nội dung mẫu trong môi trường tham quan.)'), parentId:'mtdemofolder1' },
        { ...txt('Phụ lục số liệu.txt', 'Phụ lục số liệu mẫu — môi trường tham quan.'), parentId:'mtdemofolder1' },
      ],
    }];
  }

  // ---- Lắng nghe danh sách theo không gian đang xem ----
  let mtListenerRef = null, mtListenerKey = null;
  function mtDetach(){ if(mtListenerRef){ try{ mtListenerRef.off(); }catch(e){} } mtListenerRef = null; mtListenerKey = null; }
  function mtAttach(){
    const S = mtS();
    if(!S.space) S.space = mtDefaultSpace();
    if(isTourMode()){
      if(mtListenerKey!=='tour'){ mtDetach(); mtListenerKey = 'tour'; S.list = mtDemoMeetings(); S.trash = []; S.loaded = true; S.error = ''; }
      return;
    }
    let ref = null, key = null;
    if(S.space==='personal'){
      const email = state.identity && state.identity.email;
      if(email){ key = 'personal:'+email; ref = rtdb.ref('meetings').orderByChild('ownerEmail').equalTo(email); }
    } else if(wardId() && canViewModule('meeting')){
      key = 'shared:'+wardId(); ref = rtdb.ref('meetings').orderByChild('wardId').equalTo(wardId());
    }
    if(!ref){ mtDetach(); S.list = []; S.trash = []; S.loaded = true; return; }
    if(mtListenerRef && mtListenerKey===key) return;
    mtDetach();
    S.list = []; S.trash = []; S.loaded = false; S.error = '';
    mtListenerKey = key; mtListenerRef = ref;
    ref.on('value', snap=>{
      if(mtListenerKey!==key) return;
      const all = (snap && snap.exists()) ? Object.values(snap.val()||{}) : [];
      const mine = all.filter(m=> m && m.id && (S.space==='personal' ? m.scope==='personal' : m.scope!=='personal'));
      S.list = mine.filter(m=> !m.deleted);
      S.trash = mine.filter(m=> m.deleted).sort((a,b)=> String(b.deletedAt||'').localeCompare(String(a.deletedAt||'')));
      S.loaded = true; S.error = '';
      mtRefreshFromRealtime();
    }, err=>{
      console.error('[Phòng họp] Không tải được danh sách cuộc họp (kiểm tra Firebase Rules cho nút meetings, ".indexOn":["wardId","ownerEmail"]):', err);
      S.loaded = true; S.error = 'Không tải được danh sách cuộc họp. Vui lòng kiểm tra kết nối mạng rồi tải lại trang.';
      mtRefreshFromRealtime();
    });
  }
  // Dữ liệu mới về: danh sách thì vẽ lại phần danh sách; trình sửa thì CHỈ vẽ lại khung tài liệu và khung
  // liên kết — không đụng vào các ô đang gõ để khỏi mất con trỏ.
  function mtRefreshFromRealtime(){
    if(state.view!=='app' || state.activeTab!=='meeting') return;
    const S = mtS();
    const el = document.getElementById('content'); if(!el) return;
    if(S.view==='editor'){
      if(!mtFind(S.editingId)){ S.view = 'list'; S.editingId = null; renderMeetingTab(el); return; }
      mtPaintEditorParts(el);
    } else if(el.querySelector('#mt-list')) mtPaintList(el);
    else renderMeetingTab(el);
  }
  function mtSwitchSpace(space){
    const S = mtS();
    if(S.space===space) return;
    if(space==='personal' && !mtHasPersonal() && !isTourMode()){ alert('Phòng họp cá nhân yêu cầu đăng nhập bằng tài khoản Google.'); return; }
    S.space = space; S.view = 'list'; S.editingId = null;
    if(isTourMode()){ mtListenerKey = null; }
    const el = document.getElementById('content'); if(el) renderMeetingTab(el);
  }

  // ---- Ghi dữ liệu ----
  function mtActor(){ return (state.identity && (state.identity.name || state.identity.email)) || ''; }
  async function mtCreateMeeting(fields){
    if(!mtWriteOk()) return null;
    const S = mtS(), now = new Date().toISOString(), id = mtNewId();
    const rec = {
      id, scope: S.space==='personal' ? 'personal' : 'shared',
      wardId: S.space==='personal' ? null : wardId(),
      wardName: (state.config && state.config.wardName) || '',
      ownerEmail: (state.identity && state.identity.email) || null,
      createdByName: mtActor(),
      title: fields.title, startAt: fields.startAt||'', place: fields.place||'', note:'',
      docs: [], status:'open', closeAt:'', createdAt: now, updatedAt: now, deleted:false,
    };
    await rtdb.ref(`meetings/${id}`).set(rec);
    try{ await pushLog('tạo cuộc họp không giấy', rec.title); }catch(e){}
    return rec;
  }
  async function mtUpdate(id, fields){
    if(!mtWriteOk()) return false;
    try{
      await rtdb.ref(`meetings/${id}`).update({ ...fields, updatedAt: new Date().toISOString() });
      return true;
    }catch(e){
      console.error('[Phòng họp] Lưu lỗi:', e);
      alert('Không lưu được thay đổi: ' + (e && e.message || e));
      return false;
    }
  }
  function mtSaveDocs(m, docs){ return mtUpdate(m.id, { docs: docs.map(d=> ({...d})) }); }
  // Xoá tệp trên Storage — chỉ tệp tải lên cho cuộc họp, và chỉ khi không còn bản sao nào (trong `remaining`)
  // dùng chung đường dẫn đó. Tệp chọn từ Trung tâm dữ liệu không bao giờ bị xoá ở đây.
  function mtDeleteStorage(doc, remaining){
    if(!doc || mtIsFolder(doc) || doc.source!=='upload' || !doc.storagePath || typeof storage==='undefined') return;
    if((remaining||[]).some(x=> x && x.id!==doc.id && x.storagePath===doc.storagePath)) return;
    try{ storage.ref(doc.storagePath).delete().catch(e=> console.warn('[Phòng họp] Không xoá được tệp trên Storage (bỏ qua):', e)); }catch(e){}
  }
  function mtSetUploading(text){
    mtS().uploading = text || '';
    const box = document.getElementById('mt-upload-status');
    if(box){ box.textContent = text || ''; box.style.display = text ? '' : 'none'; }
  }
  async function mtUploadOne(m, file, docId){
    const path = `meeting_files/${m.id}/${docId}_${mtSafeName(file.name)}`;
    const ref = storage.ref(path);
    const task = ref.put(file, { contentType: file.type || 'application/octet-stream' });
    if(task && task.on) task.on('state_changed', snap=>{
      if(snap && snap.totalBytes) mtSetUploading(`⏳ Đang tải "${file.name}"… ${Math.round(snap.bytesTransferred/snap.totalBytes*100)}%`);
    });
    await task;
    // GĐ2: KHÔNG lấy getDownloadURL — link tải trực tiếp của Storage không được nằm trong dữ liệu cuộc
    // họp (ai đọc được bản ghi là tải được mãi). Đại biểu nhận tệp qua Cloud Function meetingMeta.
    return { storagePath: path };
  }
  function mtPickFiles(multiple){
    return new Promise(resolve=>{
      const input = document.createElement('input');
      input.type = 'file'; input.multiple = !!multiple;
      input.onchange = ()=> resolve(Array.from(input.files||[]));
      input.click();
    });
  }
  function mtFileTooBig(file){
    if(file.size > MT_MAX_FILE_MB*1024*1024){ alert(`Tệp "${file.name}" lớn hơn ${MT_MAX_FILE_MB} MB, không tải lên được. Đồng chí có thể nén hoặc tách nhỏ tệp rồi thử lại.`); return true; }
    return false;
  }
  async function mtAddUploads(m, folderId){
    if(!mtWriteOk()) return;
    const files = await mtPickFiles(true);
    if(!files.length) return;
    const fresh = mtFind(m.id) || m;
    if(mtFileCount(fresh) + files.length > MT_MAX_FILES){ alert(`Mỗi cuộc họp có tối đa ${MT_MAX_FILES} tệp.`); return; }
    const added = [];
    for(const f of files){
      if(mtFileTooBig(f)) continue;
      const docId = mtDocId();
      try{
        const up = await mtUploadOne(fresh, f, docId);
        const now = new Date().toISOString();
        added.push({ id:docId, parentId: folderId || null, name:f.name, title:mtStripExt(f.name).slice(0, MT_DOC_TITLE_MAX), mimeType:f.type||'application/octet-stream', size:f.size, source:'upload', ...up, addedAt:now, updatedAt:now });
      }catch(e){
        console.error('[Phòng họp] Tải tệp lỗi:', e);
        alert(`Không tải lên được "${f.name}".\n\n${e && e.message ? e.message : 'Lỗi không xác định'}`);
      }
    }
    mtSetUploading('');
    if(!added.length) return;
    const latest = mtFind(m.id) || fresh;
    if(await mtSaveDocs(latest, mtDocs(latest).concat(added))) showToast(`Đã thêm ${added.length} tài liệu.`);
  }
  // Thay tệp nhưng GIỮ NGUYÊN vị trí và tên hiển thị — dùng khi sửa tài liệu phút chót.
  async function mtReplaceDoc(m, docId){
    if(!mtWriteOk()) return;
    const [f] = await mtPickFiles(false);
    if(!f || mtFileTooBig(f)) return;
    let up;
    try{ up = await mtUploadOne(m, f, mtDocId()); }
    catch(e){ mtSetUploading(''); alert(`Không tải lên được "${f.name}".\n\n${e && e.message ? e.message : ''}`); return; }
    mtSetUploading('');
    const latest = mtFind(m.id) || m;
    const docs = mtDocs(latest);
    const i = docs.findIndex(d=> d.id===docId);
    if(i<0){ alert('Tài liệu này vừa bị gỡ khỏi cuộc họp.'); return; }
    const old = docs[i];
    docs[i] = { ...old, name:f.name, mimeType:f.type||'application/octet-stream', size:f.size, source:'upload', ...up, updatedAt:new Date().toISOString(), replacedAt:new Date().toISOString() };
    delete docs[i].driveId; delete docs[i].driveSpace; delete docs[i].storageUrl;
    if(await mtSaveDocs(latest, docs)){ mtDeleteStorage(old, docs); showToast(`Đã thay tệp cho "${mtDocTitle(old)}". Đại biểu mở lại là thấy bản mới.`); }
  }
  // ---- Thao tác trên cây thư mục (đều đọc bản MỚI NHẤT trong danh sách trước khi ghi) ----
  function mtLatest(m){ return mtFind(m.id) || m; }
  function mtItem(m, id){ return mtDocs(m).find(d=> d.id===id) || null; }
  async function mtCreateFolder(m, parentId){
    if(!mtWriteOk()) return null;
    const cur = mtLatest(m);
    if(mtFolderCount(cur) >= MT_MAX_FOLDERS){ alert(`Mỗi cuộc họp có tối đa ${MT_MAX_FOLDERS} thư mục.`); return null; }
    if(mtFolderPath(cur, parentId).length + 1 > MT_MAX_DEPTH){ alert(`Chỉ tạo được tối đa ${MT_MAX_DEPTH} tầng thư mục lồng nhau.`); return null; }
    const name = await mtPromptModal('➕ Thư mục mới', 'Tên thư mục', 'Thư mục mới');
    if(!name) return null;
    const latest = mtLatest(m), now = new Date().toISOString();
    const folder = { id: mtDocId(), type:'folder', parentId: parentId || null, title: name, addedAt: now, updatedAt: now };
    return await mtSaveDocs(latest, mtDocs(latest).concat([folder])) ? folder : null;
  }
  async function mtRenameItem(m, id){
    if(!mtWriteOk()) return;
    const it = mtItem(mtLatest(m), id); if(!it) return;
    const name = await mtPromptModal(mtIsFolder(it) ? '✏️ Đổi tên thư mục' : '✏️ Đổi tên tài liệu', mtIsFolder(it) ? 'Tên thư mục' : 'Tên hiển thị cho đại biểu', mtDocTitle(it));
    if(!name || name===mtDocTitle(it)) return;
    const docs = mtDocs(mtLatest(m)), x = docs.find(d=> d.id===id); if(!x) return;
    x.title = name; x.updatedAt = new Date().toISOString();
    if(await mtSaveDocs(mtLatest(m), docs)) mtFlashSaved();
  }
  // Tạo bản sao (giống Google Drive): "Bản sao của …", nằm ngay dưới bản gốc, DÙNG CHUNG tệp đã lưu.
  async function mtDuplicateDoc(m, id){
    if(!mtWriteOk()) return;
    const latest = mtLatest(m), docs = mtDocs(latest), i = docs.findIndex(d=> d.id===id);
    if(i<0 || mtIsFolder(docs[i])) return;
    if(mtFileCount(latest) >= MT_MAX_FILES){ alert(`Mỗi cuộc họp có tối đa ${MT_MAX_FILES} tệp.`); return; }
    const now = new Date().toISOString(), copy = { ...docs[i], id: mtDocId(), title: ('Bản sao của ' + mtDocTitle(docs[i])).slice(0, MT_DOC_TITLE_MAX), addedAt: now, updatedAt: now };
    delete copy.replacedAt;
    docs.splice(i+1, 0, copy);
    if(await mtSaveDocs(latest, docs)) showToast('Đã tạo bản sao.');
  }
  async function mtDeleteItem(m, id){
    if(!mtWriteOk()) return;
    const latest = mtLatest(m), it = mtItem(latest, id); if(!it) return;
    let removeIds;
    if(mtIsFolder(it)){
      const desc = mtDescendantIds(latest, id), all = mtDocs(latest);
      const nf = all.filter(d=> desc.has(d.id) && !mtIsFolder(d)).length, ns = all.filter(d=> desc.has(d.id) && mtIsFolder(d)).length;
      const inside = desc.size ? `\n\nBên trong có ${[nf ? nf+' tệp' : '', ns ? ns+' thư mục' : ''].filter(Boolean).join(' và ')} — sẽ bị xoá cùng.` : '';
      if(!confirm(`Xoá thư mục “${mtDocTitle(it)}”${desc.size ? ` và ${desc.size} mục bên trong` : ''}?${inside}\n\nKhông khôi phục lại được. Tệp chọn từ Trung tâm dữ liệu vẫn giữ nguyên ở đó.`)) return;
      removeIds = new Set([id, ...desc]);
    } else {
      const shared = mtDocs(latest).some(d=> d.id!==id && it.storagePath && d.storagePath===it.storagePath);
      const note = it.source==='drive' ? '\n\nTệp gốc trong Trung tâm dữ liệu vẫn được giữ nguyên.' : shared ? '\n\nCác bản sao khác của tài liệu này vẫn giữ nguyên.' : '\n\nTệp đã tải lên sẽ bị xoá hẳn.';
      if(!confirm(`Xoá “${mtDocTitle(it)}” khỏi cuộc họp?${note}`)) return;
      removeIds = new Set([id]);
    }
    const now = mtLatest(m), all = mtDocs(now), removed = all.filter(d=> removeIds.has(d.id)), left = all.filter(d=> !removeIds.has(d.id));
    if(await mtSaveDocs(now, left)) removed.forEach((d,i)=> mtDeleteStorage(d, left.concat(removed.slice(i+1))));
  }
  // Kiểm tra có chuyển được `id` vào thư mục `targetId` (null = gốc) không — trả về lý do nếu không được.
  function mtMoveBlockReason(m, id, targetId){
    const it = mtItem(m, id); if(!it) return 'Mục này không còn trong cuộc họp.';
    const map = mtFolderMap(m);
    if((targetId||null)===mtParentId(it, map)) return 'Mục này đang nằm ở đây rồi.';
    if(mtIsFolder(it)){
      if(targetId===id || (targetId && mtDescendantIds(m, id).has(targetId))) return 'Không chuyển được thư mục vào chính nó hoặc thư mục con của nó.';
      if(mtFolderPath(m, targetId).length + mtSubtreeHeight(m, id) > MT_MAX_DEPTH) return `Vượt quá ${MT_MAX_DEPTH} tầng thư mục lồng nhau.`;
    }
    return '';
  }
  async function mtMoveItem(m, id, targetId){
    if(!mtWriteOk()) return false;
    const latest = mtLatest(m), why = mtMoveBlockReason(latest, id, targetId);
    if(why){ if(!/đang nằm ở đây/.test(why)) alert(why); return false; }
    const docs = mtDocs(latest), i = docs.findIndex(d=> d.id===id);
    const [x] = docs.splice(i, 1);
    x.parentId = targetId || null; x.updatedAt = new Date().toISOString();
    docs.push(x); // vào cuối thư mục đích
    if(await mtSaveDocs(latest, docs)){ showToast(`Đã chuyển vào “${targetId ? mtDocTitle(mtFolderMap(latest)[targetId]) : MT_ROOT_NAME}”.`); return true; }
    return false;
  }
  // Đổi thứ tự trong CÙNG thư mục: đặt `id` ngay trước/sau `targetId`.
  async function mtReorderItem(m, id, targetId, after){
    if(!mtWriteOk() || id===targetId) return;
    const latest = mtLatest(m), docs = mtDocs(latest), map = mtFolderMap(latest);
    const it = docs.find(d=> d.id===id), tg = docs.find(d=> d.id===targetId);
    if(!it || !tg) return;
    if(mtParentId(it, map)!==mtParentId(tg, map)){ await mtMoveItem(m, id, mtParentId(tg, map)); return; }
    docs.splice(docs.indexOf(it), 1);
    docs.splice(docs.indexOf(tg) + (after ? 1 : 0), 0, it);
    await mtSaveDocs(latest, docs);
  }
  async function mtStepItem(m, id, dir){
    const latest = mtLatest(m), it = mtItem(latest, id); if(!it) return;
    const sib = mtChildren(latest, mtParentId(it, mtFolderMap(latest))), i = sib.findIndex(d=> d.id===id), j = i + dir;
    if(j<0 || j>=sib.length) return;
    await mtReorderItem(m, id, sib[j].id, dir>0);
  }
  async function mtTrashMeeting(id){
    if(!mtWriteOk()) return;
    const m = mtFind(id); if(!m) return;
    if(!confirm(`Chuyển cuộc họp "${m.title}" vào Thùng rác?\n\nLiên kết và mã QR của cuộc họp sẽ ngừng hoạt động. Đồng chí có thể khôi phục lại trong Thùng rác.`)) return;
    try{
      await rtdb.ref(`meetings/${id}`).update({ deleted:true, deletedAt:new Date().toISOString(), deletedByName: mtActor() });
      try{ await pushLog('chuyển cuộc họp vào thùng rác', m.title); }catch(e){}
      showToast('Đã chuyển cuộc họp vào Thùng rác.');
    }catch(e){ alert('Không xoá được: ' + (e && e.message || e)); }
  }
  async function mtRestoreMeeting(id){
    if(!mtWriteOk()) return;
    const m = mtS().trash.find(x=> x.id===id); if(!m) return;
    try{ await rtdb.ref(`meetings/${id}`).update({ deleted:false, deletedAt:null, deletedByName:null }); showToast(`Đã khôi phục "${m.title}".`); }
    catch(e){ alert('Không khôi phục được: ' + (e && e.message || e)); }
  }
  async function mtPurgeMeeting(id){
    if(!mtWriteOk()) return;
    const m = mtS().trash.find(x=> x.id===id); if(!m) return;
    if(!confirm(`XOÁ VĨNH VIỄN cuộc họp "${m.title}" cùng các tệp đã tải lên?\n\nKhông khôi phục lại được. Tài liệu chọn từ Trung tâm dữ liệu vẫn giữ nguyên ở đó.`)) return;
    try{
      mtDocs(m).forEach((d,i,arr)=> mtDeleteStorage(d, arr.slice(i+1)));
      await rtdb.ref(`meetings/${id}`).remove();
      try{ await pushLog('xoá vĩnh viễn cuộc họp', m.title); }catch(e){}
      showToast('Đã xoá vĩnh viễn.');
    }catch(e){ alert('Không xoá được: ' + (e && e.message || e)); }
  }
  function mtFlashSaved(){
    const s = document.getElementById('mt-saved'); if(!s) return;
    s.textContent = '✓ Đã lưu'; s.classList.add('show');
    clearTimeout(mtFlashSaved._t); mtFlashSaved._t = setTimeout(()=> s.classList.remove('show'), 1600);
  }

  // ---- Hộp nhập tên (thư mục mới / đổi tên): có bộ đếm ký tự, Enter = Lưu, Esc = Huỷ. Trả về tên hoặc null.
  function mtPromptModal(title, label, value){
    return new Promise(resolve=>{
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg mt-font';
      wrap.innerHTML = `<div class="modal" style="max-width:460px;" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="modal-close" data-p-close aria-label="Đóng">✕</button></div>
        <div class="modal-body"><div class="field">${mtLabel(label, true)}<input id="mtp-name" maxlength="${MT_DOC_TITLE_MAX}" value="${escapeHtml(value||'')}">${mtCounterHtml('mtp-name', value, MT_DOC_TITLE_MAX)}</div></div>
        <div class="modal-foot"><button class="btn btn-ghost" data-p-close>Huỷ</button><button class="btn btn-primary" data-p-ok>Lưu</button></div>
      </div>`;
      document.body.appendChild(wrap);
      mtWireCounters(wrap);
      const inp = wrap.querySelector('#mtp-name');
      const done = v=>{ wrap.remove(); resolve(v); };
      const ok = ()=>{ const v = inp.value.trim().slice(0, MT_DOC_TITLE_MAX); if(!v){ alert('Tên không được để trống.'); inp.focus(); return; } done(v); };
      wrap.querySelectorAll('[data-p-close]').forEach(b=> b.onclick = ()=> done(null));
      wrap.querySelector('[data-p-ok]').onclick = ok;
      inp.onkeydown = e=>{ if(e.key==='Enter'){ e.preventDefault(); ok(); } else if(e.key==='Escape') done(null); };
      setTimeout(()=>{ inp.focus(); inp.select(); }, 30);
    });
  }
  // ---- Menu ⋮ / chuột phải: items = [{ icon, label, danger, onClick }]; đặt cạnh nút bấm hoặc tại con trỏ.
  function mtCloseMenu(){ document.querySelectorAll('.mt-menu').forEach(x=> x.remove()); }
  function mtOpenMenu(at, items){
    mtCloseMenu();
    const menu = document.createElement('div');
    menu.className = 'mt-menu mt-font';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map((it,i)=>`<button type="button" role="menuitem" class="mt-menu-item preview-allow ${it.danger ? 'danger' : ''}" data-mi="${i}"><span>${it.icon}</span>${escapeHtml(it.label)}</button>`).join('');
    document.body.appendChild(menu);
    let x, y;
    if(at && at.clientX!=null && at.type==='contextmenu'){ x = at.clientX; y = at.clientY; }
    else { const r = (at.currentTarget || at.target || at).getBoundingClientRect(); x = r.right - menu.offsetWidth; y = r.bottom + 4; }
    x = Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8));
    if(y + menu.offsetHeight > window.innerHeight - 8) y = Math.max(8, y - menu.offsetHeight - 40);
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    menu.querySelectorAll('[data-mi]').forEach(b=> b.onclick = e=>{ e.stopPropagation(); mtCloseMenu(); items[+b.dataset.mi].onClick(); });
    setTimeout(()=>{
      const off = e=>{ if(!menu.contains(e.target)){ mtCloseMenu(); cleanup(); } };
      const key = e=>{ if(e.key==='Escape'){ mtCloseMenu(); cleanup(); } };
      const cleanup = ()=>{ document.removeEventListener('pointerdown', off, true); document.removeEventListener('keydown', key); window.removeEventListener('scroll', scr, true); };
      const scr = ()=>{ mtCloseMenu(); cleanup(); };
      document.addEventListener('pointerdown', off, true); document.addEventListener('keydown', key); window.addEventListener('scroll', scr, true);
    }, 0);
  }
  // ---- Hộp thoại "Di chuyển" kiểu Google Drive: thanh địa chỉ, danh sách thư mục con (bấm để vào), tạo
  // thư mục mới tại chỗ, "Di chuyển đến đây". Thư mục đang di chuyển và nhánh con của nó bị làm mờ.
  function mtMoveModal(m, id){
    if(!mtWriteOk()) return;
    const start = mtItem(mtLatest(m), id); if(!start) return;
    let at = mtParentId(start, mtFolderMap(mtLatest(m)));
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg mt-font';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const paint = ()=>{
      const cur = mtLatest(m), it = mtItem(cur, id);
      if(!it){ close(); return; }
      const map = mtFolderMap(cur);
      if(at && !map[at]) at = null;
      const blocked = mtIsFolder(it) ? new Set([id, ...mtDescendantIds(cur, id)]) : new Set();
      const subs = mtChildren(cur, at).filter(mtIsFolder);
      const why = mtMoveBlockReason(cur, id, at);
      wrap.innerHTML = `<div class="modal" style="max-width:520px;" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>📂 Di chuyển “${escapeHtml(mtDocTitle(it))}”</h3><button class="modal-close" data-mv-close aria-label="Đóng">✕</button></div>
        <div class="modal-body">
          <div class="mt-hint" style="margin-bottom:6px;">Chọn thư mục đích:</div>
          ${mtCrumbsHtml(mtFolderPath(cur, at), 'mv-crumb')}
          <div class="mt-mv-list">${subs.length ? subs.map(f=>`<button type="button" class="mt-mv-row ${blocked.has(f.id) ? 'off' : ''}" data-mv-open="${escapeHtml(f.id)}" ${blocked.has(f.id) ? 'disabled' : ''}><span class="mt-fico">📁</span><span class="mt-mv-name">${escapeHtml(mtDocTitle(f))}<small>${escapeHtml(mtCountsText(cur, f.id))}</small></span><span aria-hidden="true">›</span></button>`).join('') : '<div class="mt-mv-empty">Không có thư mục con.</div>'}</div>
          <button type="button" class="btn btn-ghost btn-sm" data-mv-new>➕ Thư mục mới ở đây</button>
          ${why && !/đang nằm ở đây/.test(why) ? `<div class="mt-warn" style="margin-top:10px;">${escapeHtml(why)}</div>` : ''}
        </div>
        <div class="modal-foot"><button class="btn btn-ghost" data-mv-close>Huỷ</button><button class="btn btn-primary" data-mv-ok ${why ? 'disabled' : ''}>Di chuyển đến đây</button></div>
      </div>`;
      wrap.querySelectorAll('[data-mv-close]').forEach(b=> b.onclick = close);
      wrap.querySelectorAll('[data-mv-crumb]').forEach(b=> b.onclick = ()=>{ at = b.dataset.mvCrumb || null; paint(); });
      wrap.querySelectorAll('[data-mv-open]').forEach(b=> b.onclick = ()=>{ at = b.dataset.mvOpen; paint(); });
      wrap.querySelector('[data-mv-new]').onclick = async ()=>{ const f = await mtCreateFolder(m, at); if(f){ setTimeout(()=>{ at = f.id; paint(); }, 50); } };
      wrap.querySelector('[data-mv-ok]').onclick = async ()=>{ if(await mtMoveItem(m, id, at)) close(); };
    };
    paint();
  }

  // =====================================================================
  // MÀN HÌNH CHÍNH CỦA MODULE
  // =====================================================================
  function renderMeetingTab(el){
    if(!el) return;
    mtAttach();
    const S = mtS();
    if(S.view==='editor' && mtFind(S.editingId)) mtRenderEditor(el);
    else { S.view = 'list'; S.editingId = null; mtRenderList(el); }
  }

  function mtStatusPill(m){
    const st = mtStatus(m);
    return `<span class="mt-status mt-status-${st.key}">${st.open ? '●' : '○'} ${escapeHtml(st.key==='open' ? 'Đang mở' : st.label)}</span>`;
  }
  function mtSortKey(m){ return String(m.startAt || (m.createdAt||'').slice(0,16)); }

  function mtRenderList(el){
    const S = mtS(), isShared = S.space!=='personal';
    const canView = mtCanView(), canEdit = mtCanEdit();
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>📋 PHÒNG HỌP KHÔNG GIẤY</h3></div>
        <div class="panel-body">
          <div style="margin-bottom:14px;">${surveyTabsHtml([
            { id:'mt-space-shared', label:`🏛️ Bộ nhớ dùng chung ${adminLevelLabelLower()}`, active:isShared },
            { id:'mt-space-personal', label:'🔒 Bộ nhớ cá nhân', active:!isShared },
          ])}${spaceNoteHtml(isShared ? 'shared' : 'personal', 'cuộc họp')}</div>
          ${!canView ? `<div class="empty-state" style="padding:30px;"><div class="e-ico">🔒</div>${isShared
              ? (wardId() ? 'Đồng chí chưa được cấp quyền xem Phòng họp dùng chung. Vui lòng liên hệ Chủ mã để được cấp quyền tại "Cài đặt & Chia sẻ".' : `Phòng họp dùng chung cần vào bằng mã ${adminLevelLabelLower()}.`)
              : 'Phòng họp cá nhân yêu cầu đăng nhập bằng tài khoản Google.'}</div>` : `
          <div class="mt-toolbar">
            ${canEdit ? `<button class="btn btn-primary preview-allow" id="mt-new-btn">➕ Tạo cuộc họp mới</button>` : `<span class="mt-hint">Đồng chí chỉ có quyền xem ở đây.</span>`}
            <input id="mt-q" value="${escapeHtml(S.q)}" placeholder="🔍 Tìm theo tên cuộc họp…" autocomplete="off">
          </div>
          <div id="mt-list"></div>`}
        </div>
      </div>
      ${canView ? `<div id="mt-trash"></div>` : ''}`;
    const sh = el.querySelector('#mt-space-shared'); if(sh) sh.onclick = ()=> mtSwitchSpace('shared');
    const pe = el.querySelector('#mt-space-personal'); if(pe) pe.onclick = ()=> mtSwitchSpace('personal');
    const nb = el.querySelector('#mt-new-btn'); if(nb) nb.onclick = ()=> mtNewMeetingModal(el);
    const q = el.querySelector('#mt-q'); if(q) q.oninput = ()=>{ S.q = q.value; mtPaintList(el); };
    if(canView) mtPaintList(el);
  }
  function mtPaintList(el){
    const S = mtS(), box = el.querySelector('#mt-list'); if(!box) return;
    const canEdit = mtCanEdit();
    const term = surveyFold(String(S.q||'').trim());
    const list = S.list.filter(m=> !term || surveyFold(m.title||'').includes(term))
      .sort((a,b)=> mtSortKey(b).localeCompare(mtSortKey(a)));
    if(S.error) box.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="e-ico">⚠️</div>${escapeHtml(S.error)}</div>`;
    else if(!S.loaded) box.innerHTML = `<div class="empty-state" style="padding:24px;">Đang tải danh sách cuộc họp…</div>`;
    else if(!list.length) box.innerHTML = `<div class="empty-state" style="padding:30px;"><div class="e-ico">📋</div>${S.list.length ? 'Không có cuộc họp nào khớp với từ khoá.' : `Chưa có cuộc họp nào${canEdit ? ' — bấm "Tạo cuộc họp mới" để bắt đầu.' : '.'}`}</div>`;
    else box.innerHTML = `<div class="mt-cards">${list.map(m=>{
      const n = mtFileCount(m), nf = mtFolderCount(m);
      return `<div class="mt-card">
        <button type="button" class="mt-card-main preview-allow" data-mt-open="${escapeHtml(m.id)}">
          <span class="mt-card-title">${escapeHtml(m.title||'Cuộc họp')}</span>
          <span class="mt-card-meta">${m.startAt ? `🕗 ${escapeHtml(mtFmtStart(m.startAt))}` : ''}${m.place ? ` · 📍 ${escapeHtml(m.place)}` : ''}</span>
          <span class="mt-card-meta">📄 ${n} tài liệu${nf ? ` · 📁 ${nf} thư mục` : ''} ${mtStatusPill(m)}</span>
        </button>
        <div class="mt-card-actions">
          <button class="btn btn-ghost btn-sm preview-allow" data-mt-open="${escapeHtml(m.id)}">${canEdit ? '✏️ Mở / Sửa' : '👁 Xem'}</button>
          <button class="btn btn-ghost btn-sm preview-allow" data-mt-qr="${escapeHtml(m.id)}">📱 Mã QR</button>
          <button class="btn btn-ghost btn-sm preview-allow" data-mt-project="${escapeHtml(m.id)}" title="Chiếu mã QR thật to lên máy chiếu/TV hội trường">🖥️ Chiếu</button>
          <button class="btn btn-ghost btn-sm preview-allow" data-mt-copy="${escapeHtml(m.id)}">🔗 Sao chép link</button>
          ${canEdit ? `<button class="btn btn-ghost btn-sm preview-allow" data-mt-trash="${escapeHtml(m.id)}" style="color:var(--red);">Xoá</button>` : ''}
        </div>
      </div>`; }).join('')}</div>`;
    box.querySelectorAll('[data-mt-open]').forEach(b=> b.onclick = ()=>{ S.view = 'editor'; S.editingId = b.dataset.mtOpen; renderMeetingTab(el); window.scrollTo(0,0); });
    box.querySelectorAll('[data-mt-qr]').forEach(b=> b.onclick = ()=>{ const m = mtFind(b.dataset.mtQr); if(m) mtQrModal(m); });
    box.querySelectorAll('[data-mt-copy]').forEach(b=> b.onclick = ()=> copyMessageText(mtShareUrl(b.dataset.mtCopy)));
    box.querySelectorAll('[data-mt-project]').forEach(b=> b.onclick = ()=>{ const m = mtFind(b.dataset.mtProject); if(m) mtProjector(m); });
    box.querySelectorAll('[data-mt-trash]').forEach(b=> b.onclick = ()=> mtTrashMeeting(b.dataset.mtTrash));
    mtPaintTrash(el);
  }
  function mtPaintTrash(el){
    const S = mtS(), box = el.querySelector('#mt-trash'); if(!box) return;
    if(!S.trash.length){ box.innerHTML = ''; return; }
    const canEdit = mtCanEdit();
    box.innerHTML = `<details class="panel mt-trash"><summary>🗑️ Thùng rác (${S.trash.length})</summary>
      <div class="panel-body">${S.trash.map(m=>`<div class="mt-trash-row">
        <div><b>${escapeHtml(m.title||'Cuộc họp')}</b><div class="mt-hint">Xoá lúc ${escapeHtml(mtFmtIso(m.deletedAt))}${m.deletedByName ? ' · bởi '+escapeHtml(m.deletedByName) : ''}</div></div>
        ${canEdit ? `<div class="mt-trash-actions"><button class="btn btn-ghost btn-sm" data-mt-restore="${escapeHtml(m.id)}">↩️ Khôi phục</button><button class="btn btn-ghost btn-sm" data-mt-purge="${escapeHtml(m.id)}" style="color:var(--red);">Xoá vĩnh viễn</button></div>` : ''}
      </div>`).join('')}</div></details>`;
    box.querySelectorAll('[data-mt-restore]').forEach(b=> b.onclick = ()=> mtRestoreMeeting(b.dataset.mtRestore));
    box.querySelectorAll('[data-mt-purge]').forEach(b=> b.onclick = ()=> mtPurgeMeeting(b.dataset.mtPurge));
  }

  function mtNewMeetingModal(el){
    if(!mtWriteOk()) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg mt-font';
    wrap.innerHTML = `<div class="modal" style="max-width:520px;" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>➕ Tạo cuộc họp mới</h3><button class="modal-close" id="mtn-close" aria-label="Đóng">✕</button></div>
      <div class="modal-body">
        <div class="field">${mtLabel('Tên cuộc họp', true)}<input id="mtn-title" maxlength="${MT_TITLE_MAX}" placeholder="VD: Hội nghị sơ kết 6 tháng đầu năm">${mtCounterHtml('mtn-title', '', MT_TITLE_MAX)}</div>
        <div class="field">${mtLabel('Thời gian', false)}<input id="mtn-start" type="datetime-local"></div>
        <div class="field">${mtLabel('Địa điểm', false)}<input id="mtn-place" maxlength="${MT_PLACE_MAX}" placeholder="VD: Hội trường UBND">${mtCounterHtml('mtn-place', '', MT_PLACE_MAX)}</div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" id="mtn-cancel">Huỷ</button><button class="btn btn-primary" id="mtn-ok">Tạo và thêm tài liệu ›</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#mtn-close').onclick = close;
    wrap.querySelector('#mtn-cancel').onclick = close;
    mtWireCounters(wrap);
    const t = wrap.querySelector('#mtn-title'); setTimeout(()=> t.focus(), 30);
    const ok = wrap.querySelector('#mtn-ok');
    ok.onclick = async ()=>{
      const title = t.value.trim().slice(0, MT_TITLE_MAX);
      if(!title){ alert('Vui lòng nhập tên cuộc họp.'); t.focus(); return; }
      ok.disabled = true;
      try{
        const rec = await mtCreateMeeting({ title, startAt: wrap.querySelector('#mtn-start').value, place: wrap.querySelector('#mtn-place').value.trim().slice(0, MT_PLACE_MAX) });
        if(!rec){ ok.disabled = false; return; }
        close();
        const S = mtS();
        if(!mtFind(rec.id)) S.list = S.list.concat([rec]);
        S.view = 'editor'; S.editingId = rec.id;
        renderMeetingTab(el); window.scrollTo(0,0);
      }catch(e){
        console.error('[Phòng họp] Tạo cuộc họp lỗi:', e);
        alert('Không tạo được cuộc họp: ' + (e && e.message || e));
        ok.disabled = false;
      }
    };
  }

  // ---- Trình sửa một cuộc họp ----
  function mtRenderEditor(el){
    const S = mtS(), m = mtFind(S.editingId);
    const canEdit = mtCanEdit(), ro = canEdit ? '' : 'disabled';
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head mt-editor-head"><h3>📋 ${escapeHtml(m.title||'Cuộc họp')}</h3><span id="mt-saved" class="mt-saved"></span></div>
        <div class="panel-body">
          <div class="mt-editor-bar">
            <button class="btn btn-ghost btn-sm btn-back-list preview-allow" id="mt-back">← Danh sách cuộc họp</button>
            <div class="mt-editor-bar-right">
              <button class="btn btn-ghost btn-sm preview-allow" id="mt-preview">👁 Xem như đại biểu</button>
              <button class="btn btn-ghost btn-sm preview-allow" id="mt-qr">📱 Mã QR</button>
              <button class="btn btn-primary btn-sm preview-allow" id="mt-project">🖥️ Chiếu mã QR lên màn hình</button>
            </div>
          </div>
          ${spaceNoteHtml(S.space==='personal' ? 'personal' : 'shared', 'cuộc họp')}

          <div class="divider-lbl">1. Thông tin cuộc họp</div>
          <div class="mt-info-grid">
            <div class="field mt-span-2">${mtLabel('Tên cuộc họp', true)}<input id="mt-f-title" maxlength="${MT_TITLE_MAX}" value="${escapeHtml(m.title||'')}" ${ro}>${canEdit ? mtCounterHtml('mt-f-title', m.title, MT_TITLE_MAX) : ''}</div>
            <div class="field">${mtLabel('Thời gian', false)}<input id="mt-f-start" type="datetime-local" value="${escapeHtml(m.startAt||'')}" ${ro}></div>
            <div class="field">${mtLabel('Địa điểm', false)}<input id="mt-f-place" maxlength="${MT_PLACE_MAX}" value="${escapeHtml(m.place||'')}" ${ro}>${canEdit ? mtCounterHtml('mt-f-place', m.place, MT_PLACE_MAX) : ''}</div>
            <div class="field mt-span-2">${mtLabel('Lời nhắn cho đại biểu', false, '— hiện ở đầu trang tài liệu')}<textarea id="mt-f-note" rows="2" maxlength="${MT_NOTE_MAX}" ${ro}>${escapeHtml(m.note||'')}</textarea>${canEdit ? mtCounterHtml('mt-f-note', m.note, MT_NOTE_MAX) : ''}</div>
          </div>

          <div class="divider-lbl">2. Tài liệu — sắp theo thứ tự chương trình họp</div>
          ${canEdit ? `<div class="mt-doc-add">
            <button class="btn btn-primary btn-sm" id="mt-upload">⬆️ Tải tệp lên</button>
            <button class="btn btn-ghost btn-sm" id="mt-from-drive">🗂️ Chọn từ Trung tâm dữ liệu</button>
            <button class="btn btn-ghost btn-sm" id="mt-new-folder">➕ Thư mục mới</button>
            <span class="mt-hint">Tệp được đưa vào thư mục đang mở. PDF hiển thị đẹp nhất trên điện thoại. Mỗi tệp tối đa ${MT_MAX_FILE_MB} MB.</span>
          </div>` : ''}
          <div id="mt-upload-status" class="mt-upload-status" style="${S.uploading ? '' : 'display:none;'}">${escapeHtml(S.uploading)}</div>
          <div id="mt-docs"></div>

          <div class="divider-lbl">3. Liên kết cho đại biểu</div>
          <div id="mt-link"></div>
        </div>
      </div>`;
    el.querySelector('#mt-back').onclick = ()=>{ S.view = 'list'; S.editingId = null; renderMeetingTab(el); };
    el.querySelector('#mt-preview').onclick = ()=>{ const x = mtFind(S.editingId); if(x) mtOpenPreview(x); };
    // Mỗi lần mở một cuộc họp thì bắt đầu ở thư mục gốc.
    if(!S.folderNav) S.folderNav = {};
    if(S.folderNavFor!==m.id){ S.folderNavFor = m.id; S.folderNav[m.id] = { id:null, path:[], notice:'' }; }
    el.querySelector('#mt-qr').onclick = ()=>{ const x = mtFind(S.editingId); if(x) mtQrModal(x); };
    el.querySelector('#mt-project').onclick = ()=>{ const x = mtFind(S.editingId); if(x) mtProjector(x); };
    const bindField = (sel, key, transform)=>{
      const inp = el.querySelector(sel); if(!inp || !canEdit) return;
      inp.onchange = async ()=>{
        const cur = mtFind(S.editingId); if(!cur) return;
        let v = transform ? transform(inp.value) : inp.value;
        if(key==='title' && !v){ alert('Tên cuộc họp không được để trống.'); inp.value = cur.title||''; return; }
        if((cur[key]||'')===v) return;
        if(await mtUpdate(cur.id, { [key]: v })){
          mtFlashSaved();
          if(key==='title'){ const h = el.querySelector('.mt-editor-head h3'); if(h) h.textContent = '📋 ' + v; }
        }
      };
    };
    mtWireCounters(el);
    bindField('#mt-f-title', 'title', v=> v.trim().slice(0, MT_TITLE_MAX));
    bindField('#mt-f-start', 'startAt');
    bindField('#mt-f-place', 'place', v=> v.trim().slice(0, MT_PLACE_MAX));
    bindField('#mt-f-note', 'note', v=> v.trim().slice(0, MT_NOTE_MAX));
    const up = el.querySelector('#mt-upload'); if(up) up.onclick = ()=>{ const x = mtFind(S.editingId); if(x) mtAddUploads(x, mtEditorFolder(x).id); };
    const fd = el.querySelector('#mt-from-drive'); if(fd) fd.onclick = ()=>{ const x = mtFind(S.editingId); if(x) mtDrivePicker(x, mtEditorFolder(x).id); };
    const nf = el.querySelector('#mt-new-folder'); if(nf) nf.onclick = ()=>{ const x = mtFind(S.editingId); if(x) mtCreateFolder(x, mtEditorFolder(x).id); };
    mtPaintEditorParts(el);
  }
  function mtPaintEditorParts(el){
    const S = mtS(), m = mtFind(S.editingId); if(!m) return;
    mtPaintDocs(el, m);
    mtPaintLink(el, m);
  }
  // Thư mục đang mở trong trình sửa (tự lùi về thư mục cha gần nhất nếu thư mục đó vừa bị xoá/chuyển đi).
  function mtEditorFolder(m){
    const S = mtS();
    if(!S.folderNav) S.folderNav = {};
    const nav = S.folderNav[m.id] || (S.folderNav[m.id] = { id:null, path:[], notice:'' });
    const r = mtResolveFolder(m, nav.id, nav.path);
    if(r.id!==nav.id){ nav.id = r.id; nav.notice = r.notice; }
    nav.path = mtFolderPath(m, nav.id).map(f=> f.id);
    return nav;
  }
  function mtEditorGo(el, m, folderId){
    const nav = mtEditorFolder(m);
    nav.id = folderId || null; nav.notice = '';
    nav.path = mtFolderPath(m, nav.id).map(f=> f.id);
    mtPaintDocs(el, mtFind(m.id) || m);
  }
  function mtPaintDocs(el, m){
    const box = el.querySelector('#mt-docs'); if(!box) return;
    const canEdit = mtCanEdit(), nav = mtEditorFolder(m), fid = nav.id;
    const path = mtFolderPath(m, fid), kids = mtChildren(m, fid), map = mtFolderMap(m);
    const atDepthLimit = path.length >= MT_MAX_DEPTH;
    const nfBtn = el.querySelector('#mt-new-folder');
    if(nfBtn){ nfBtn.disabled = atDepthLimit; nfBtn.title = atDepthLimit ? `Đã tới giới hạn ${MT_MAX_DEPTH} tầng thư mục` : ''; }
    const notice = nav.notice ? `<div class="mt-warn">${escapeHtml(nav.notice)}</div>` : '';
    nav.notice = '';
    const rows = kids.map((d,i)=>{
      const id = escapeHtml(d.id);
      const step = canEdit ? `<button class="btn btn-ghost btn-sm" data-mt-up="${id}" title="Đưa lên trên" ${i===0?'disabled':''}>▲</button><button class="btn btn-ghost btn-sm" data-mt-down="${id}" title="Đưa xuống dưới" ${i===kids.length-1?'disabled':''}>▼</button>` : '';
      const more = canEdit ? `<button class="btn btn-ghost btn-sm mt-more" data-mt-more="${id}" title="Thao tác khác" aria-label="Thao tác khác">⋮</button>` : '';
      if(mtIsFolder(d)) return `<div class="mt-doc mt-folder" data-mt-item="${id}" ${canEdit ? 'draggable="true"' : ''}>
          ${canEdit ? '<span class="mt-doc-handle" title="Kéo để đổi thứ tự hoặc thả vào thư mục">⠿</span>' : ''}
          <span class="mt-doc-num">${i+1}</span><span class="mt-doc-ico mt-fico">📁</span>
          <button type="button" class="mt-doc-main mt-doc-open preview-allow" data-mt-open-folder="${id}" title="Mở thư mục"><b>${escapeHtml(mtDocTitle(d))}</b><small>${escapeHtml(mtCountsText(m, d.id))}</small></button>
          <div class="mt-doc-actions">${step}<button class="btn btn-ghost btn-sm preview-allow" data-mt-open-folder="${id}" title="Mở thư mục">Mở ›</button>${more}</div>
        </div>`;
      return `<div class="mt-doc" data-mt-item="${id}" ${canEdit ? 'draggable="true"' : ''}>
          ${canEdit ? '<span class="mt-doc-handle" title="Kéo để đổi thứ tự hoặc thả vào thư mục">⠿</span>' : ''}
          <span class="mt-doc-num">${i+1}</span>
          <span class="mt-doc-ico">${driveNodeIcon({type:'file', name:d.name, mimeType:d.mimeType})}</span>
          <button type="button" class="mt-doc-main mt-doc-open preview-allow" data-mt-view="${id}" title="Xem tài liệu"><b>${escapeHtml(mtDocTitle(d))}</b>
            <small>${escapeHtml(mtKindLabel(d))}${d.size ? ' · '+escapeHtml(driveFormatBytes(d.size)) : ''}${d.source==='drive' ? ' · từ Trung tâm dữ liệu' : ''}${d.replacedAt ? ` · <b class="mt-doc-new">đã thay bản mới lúc ${escapeHtml(mtFmtIso(d.replacedAt))}</b>` : ''}</small></button>
          <div class="mt-doc-actions">${step}<button class="btn btn-ghost btn-sm preview-allow" data-mt-view="${id}" title="Xem tài liệu">👁</button>${more}</div>
        </div>`;
    }).join('');
    box.innerHTML = `${notice}${mtCrumbsHtml(path, 'mt-crumb')}
      ${kids.length ? `<div class="mt-docs">${rows}</div>` : `<div class="empty-state" style="padding:22px;"><div class="e-ico">📂</div>${fid ? 'Thư mục này chưa có tài liệu' : 'Chưa có tài liệu nào'}${canEdit ? '. Bấm "Tải tệp lên", "Chọn từ Trung tâm dữ liệu" hoặc "Thư mục mới" để thêm.' : '.'}</div>`}`;
    const cur = ()=> mtFind(m.id) || m;
    box.querySelectorAll('[data-mt-crumb]').forEach(b=> b.onclick = ()=> mtEditorGo(el, cur(), b.dataset.mtCrumb || null));
    box.querySelectorAll('[data-mt-open-folder]').forEach(b=> b.onclick = ()=> mtEditorGo(el, cur(), b.dataset.mtOpenFolder));
    box.querySelectorAll('[data-mt-view]').forEach(b=> b.onclick = ()=> mtOpenEditorViewer(cur(), fid, b.dataset.mtView));
    box.querySelectorAll('[data-mt-up]').forEach(b=> b.onclick = ()=> mtStepItem(cur(), b.dataset.mtUp, -1));
    box.querySelectorAll('[data-mt-down]').forEach(b=> b.onclick = ()=> mtStepItem(cur(), b.dataset.mtDown, 1));
    const menuFor = (id, ev)=>{
      const it = mtItem(cur(), id); if(!it) return;
      const items = mtIsFolder(it) ? [
        { icon:'📂', label:'Mở', onClick:()=> mtEditorGo(el, cur(), id) },
        { icon:'✏️', label:'Đổi tên', onClick:()=> mtRenameItem(cur(), id) },
        { icon:'📦', label:'Di chuyển', onClick:()=> mtMoveModal(cur(), id) },
        { icon:'🗑️', label:'Xoá', danger:true, onClick:()=> mtDeleteItem(cur(), id) },
      ] : [
        { icon:'👁', label:'Xem', onClick:()=> mtOpenEditorViewer(cur(), fid, id) },
        { icon:'✏️', label:'Đổi tên', onClick:()=> mtRenameItem(cur(), id) },
        { icon:'📑', label:'Tạo bản sao', onClick:()=> mtDuplicateDoc(cur(), id) },
        { icon:'📦', label:'Di chuyển', onClick:()=> mtMoveModal(cur(), id) },
        { icon:'🔄', label:'Thay tệp (giữ nguyên vị trí)', onClick:()=> mtReplaceDoc(cur(), id) },
        { icon:'🗑️', label:'Xoá', danger:true, onClick:()=> mtDeleteItem(cur(), id) },
      ];
      mtOpenMenu(ev, items);
    };
    box.querySelectorAll('[data-mt-more]').forEach(b=> b.onclick = e=>{ e.stopPropagation(); menuFor(b.dataset.mtMore, e); });
    if(canEdit){
      box.querySelectorAll('[data-mt-item]').forEach(row=> row.addEventListener('contextmenu', e=>{ e.preventDefault(); menuFor(row.dataset.mtItem, e); }));
      mtWireDocDnD(box, cur);
    }
  }
  // Kéo thả trên máy tính: thả vào GIỮA dòng thư mục = chuyển vào thư mục đó; thả lên nửa trên/dưới một dòng
  // = đổi thứ tự (đặt trước/sau); thả lên một tên trên thanh địa chỉ = chuyển lên thư mục đó.
  function mtWireDocDnD(box, cur){
    let dragId = null;
    const clear = ()=> box.querySelectorAll('.drop-into,.drop-before,.drop-after,.dragging').forEach(x=> x.classList.remove('drop-into','drop-before','drop-after','dragging'));
    box.querySelectorAll('[data-mt-item][draggable]').forEach(row=>{
      row.addEventListener('dragstart', e=>{
        dragId = row.dataset.mtItem; row.classList.add('dragging');
        try{ e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); }catch(err){}
      });
      row.addEventListener('dragend', ()=>{ dragId = null; clear(); });
      row.addEventListener('dragover', e=>{
        if(!dragId || dragId===row.dataset.mtItem) return;
        e.preventDefault();
        const r = row.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
        const mode = row.classList.contains('mt-folder') && y>0.25 && y<0.75 ? 'into' : (y<0.5 ? 'before' : 'after');
        if(row.dataset.dropMode===mode) return;
        clear(); row.classList.add('drop-'+mode); row.dataset.dropMode = mode;
        const src = box.querySelector(`[data-mt-item="${CSS.escape(dragId)}"]`); if(src) src.classList.add('dragging');
      });
      row.addEventListener('dragleave', e=>{ if(!row.contains(e.relatedTarget)){ row.classList.remove('drop-into','drop-before','drop-after'); delete row.dataset.dropMode; } });
      row.addEventListener('drop', e=>{
        e.preventDefault();
        const id = dragId, mode = row.dataset.dropMode; dragId = null; delete row.dataset.dropMode; clear();
        if(!id || !mode || id===row.dataset.mtItem) return;
        if(mode==='into') mtMoveItem(cur(), id, row.dataset.mtItem);
        else mtReorderItem(cur(), id, row.dataset.mtItem, mode==='after');
      });
    });
    box.querySelectorAll('[data-mt-crumb]').forEach(c=>{
      c.addEventListener('dragover', e=>{ if(!dragId) return; e.preventDefault(); c.classList.add('drop-into'); });
      c.addEventListener('dragleave', ()=> c.classList.remove('drop-into'));
      c.addEventListener('drop', e=>{ e.preventDefault(); c.classList.remove('drop-into'); const id = dragId; dragId = null; clear(); if(id) mtMoveItem(cur(), id, c.dataset.mtCrumb || null); });
    });
  }
  function mtPaintLink(el, m){
    const box = el.querySelector('#mt-link'); if(!box) return;
    const canEdit = mtCanEdit(), st = mtStatus(m), url = mtShareUrl(m.id);
    box.innerHTML = `
      <div class="mt-link-box">
        <div class="mt-link-row"><span class="mt-link-url">${escapeHtml(url)}</span><button class="btn btn-ghost btn-sm preview-allow" id="mt-copy">📋 Sao chép</button><button class="btn btn-ghost btn-sm preview-allow" id="mt-link-qr">📱 Mã QR</button><button class="btn btn-ghost btn-sm preview-allow" id="mt-link-project">🖥️ Chiếu mã QR lên màn hình</button></div>
        <div class="mt-link-state">Trạng thái: ${mtStatusPill(m)} <span class="mt-hint">${escapeHtml(st.key==='open' && m.closeAt ? 'Tự đóng lúc '+mtFmtIso(m.closeAt) : st.key==='open' ? 'Ai có link hoặc quét mã QR đều xem được, không cần đăng nhập.' : 'Đại biểu mở link sẽ thấy thông báo tài liệu đã đóng.')}</span></div>
        ${canEdit ? `<div class="mt-link-actions">
          ${st.open ? `<button class="btn btn-ghost btn-sm" id="mt-close-now" style="color:var(--red);">🔒 Đóng liên kết ngay</button>` : `<button class="btn btn-primary btn-sm" id="mt-reopen">🔓 Mở lại liên kết</button>`}
          <label class="mt-closeat">⏱️ Tự đóng lúc <input type="datetime-local" id="mt-closeat" value="${escapeHtml(m.closeAt ? mtIsoToLocalInput(m.closeAt) : '')}"></label>
          ${m.closeAt ? `<button class="btn btn-ghost btn-sm" id="mt-closeat-clear">Bỏ hẹn giờ</button>` : ''}
        </div>` : ''}
        <p class="mt-hint mt-link-note">Đóng liên kết thì đại biểu không mở và không tải được tài liệu nữa, kể cả khi đã chép sẵn đường dẫn. Ai đã tải tệp về máy trước đó thì vẫn giữ bản đó.</p>
      </div>`;
    box.querySelector('#mt-copy').onclick = ()=> copyMessageText(url);
    box.querySelector('#mt-link-qr').onclick = ()=>{ const x = mtFind(m.id) || m; mtQrModal(x); };
    box.querySelector('#mt-link-project').onclick = ()=>{ const x = mtFind(m.id) || m; mtProjector(x); };
    const cn = box.querySelector('#mt-close-now');
    if(cn) cn.onclick = async ()=>{ if(confirm('Đóng liên kết ngay? Đại biểu sẽ không mở được tài liệu nữa (có thể mở lại bất cứ lúc nào).')) await mtUpdate(m.id, { status:'closed', closedAt:new Date().toISOString() }); };
    const ro = box.querySelector('#mt-reopen');
    if(ro) ro.onclick = async ()=>{
      const expired = m.closeAt && new Date(m.closeAt).getTime() <= Date.now();
      await mtUpdate(m.id, expired ? { status:'open', closeAt:'' } : { status:'open' });
    };
    const ca = box.querySelector('#mt-closeat');
    if(ca) ca.onchange = async ()=>{
      const iso = mtLocalInputToIso(ca.value);
      if(iso && new Date(iso).getTime() <= Date.now() && !confirm('Giờ này đã qua — liên kết sẽ đóng ngay. Tiếp tục?')){ ca.value = m.closeAt ? mtIsoToLocalInput(m.closeAt) : ''; return; }
      if(await mtUpdate(m.id, { closeAt: iso })) mtFlashSaved();
    };
    const cc = box.querySelector('#mt-closeat-clear');
    if(cc) cc.onclick = async ()=>{ if(await mtUpdate(m.id, { closeAt:'' })) mtFlashSaved(); };
  }

  // ---- Chọn tài liệu có sẵn trong Trung tâm dữ liệu (chỉ tệp đã lưu trên đám mây) ----
  async function mtDrivePicker(m, folderId){
    if(!mtWriteOk()) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg mt-font';
    wrap.innerHTML = `<div class="modal" style="max-width:640px;" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>🗂️ Chọn tài liệu từ Trung tâm dữ liệu</h3><button class="modal-close" id="mtd-close" aria-label="Đóng">✕</button></div>
      <div class="modal-body" id="mtd-body"><div class="empty-state" style="padding:24px;">Đang tải danh sách tệp…</div></div>
      <div class="modal-foot"><button class="btn btn-ghost" id="mtd-cancel">Huỷ</button><button class="btn btn-primary" id="mtd-ok" disabled>Thêm vào cuộc họp</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#mtd-close').onclick = close;
    wrap.querySelector('#mtd-cancel').onclick = close;
    const groups = [];
    const load = async (label, space, ref)=>{
      if(!ref) return;
      try{
        const tree = await driveTreeForUser(ref, space);
        const pathOf = n=>{ const parts = []; let p = n.parentId ? tree[n.parentId] : null, g = 0; while(p && g++<30){ parts.unshift(p.name||''); p = p.parentId ? tree[p.parentId] : null; } return parts.join(' › '); };
        const files = Object.values(tree||{}).filter(n=> n && n.type==='file' && !n.deleted && n.storagePath)
          .map(n=> ({ node:n, path:pathOf(n) })).sort((a,b)=> (a.path+'/'+a.node.name).localeCompare(b.path+'/'+b.node.name, 'vi'));
        groups.push({ label, space, files });
      }catch(e){ console.warn('[Phòng họp] Không đọc được Trung tâm dữ liệu:', e); groups.push({ label, space, files:[], error:true }); }
    };
    if(wardId()) await load(`🏛️ Kho dùng chung ${adminLevelLabelLower()}`, 'shared', rtdb.ref(`communes/${wardId()}/drive_resources`));
    if(hasAuthenticatedIdentity()) await load('🔒 Kho cá nhân', 'personal', drivePersonalRef());
    const have = new Set(mtDocs(mtFind(m.id)||m).map(d=> d.driveId).filter(Boolean));
    const picked = new Map();
    let q = '';
    const body = wrap.querySelector('#mtd-body'), ok = wrap.querySelector('#mtd-ok');
    const paint = ()=>{
      const term = surveyFold(q.trim());
      const html = groups.map(g=>{
        const files = g.files.filter(f=> !term || surveyFold(f.node.name+' '+f.path).includes(term));
        return `<div class="mtd-group"><b>${escapeHtml(g.label)}</b>${g.error ? '<div class="mt-hint">⚠️ Không đọc được kho này.</div>' : !files.length ? '<div class="mt-hint">Không có tệp nào phù hợp.</div>' : files.map(f=>{
          const id = f.node.id, done = have.has(id);
          return `<label class="mtd-row ${done?'done':''}"><input type="checkbox" data-mtd="${escapeHtml(g.space+':'+id)}" ${done?'disabled checked':''} ${picked.has(g.space+':'+id)?'checked':''}>
            <span>${driveNodeIcon(f.node)}</span><span class="mtd-name"><b>${escapeHtml(f.node.name||'Tệp')}</b><small>${escapeHtml(f.path||'(thư mục gốc)')}${f.node.size ? ' · '+escapeHtml(driveFormatBytes(f.node.size)) : ''}${done ? ' · đã có trong cuộc họp' : ''}</small></span></label>`;
        }).join('')}</div>`;
      }).join('');
      body.innerHTML = `<input id="mtd-q" placeholder="🔍 Tìm theo tên tệp…" value="${escapeHtml(q)}" autocomplete="off" style="width:100%; margin-bottom:10px;">
        ${groups.length ? html : `<div class="empty-state" style="padding:20px;">Không có kho dữ liệu nào để chọn. Kho dùng chung cần vào bằng mã ${escapeHtml(adminLevelLabelLower())}; kho cá nhân cần đăng nhập Google.</div>`}
        <p class="mt-hint" style="margin-top:10px;">Chỉ hiện các tệp đã lưu trên đám mây. Tài liệu được dùng chung với Trung tâm dữ liệu, không chép thêm bản mới.</p>`;
      const qi = body.querySelector('#mtd-q');
      qi.oninput = ()=>{ const c = qi.selectionStart; q = qi.value; paint(); const again = body.querySelector('#mtd-q'); again.focus(); try{ again.setSelectionRange(c,c); }catch(e){} };
      body.querySelectorAll('[data-mtd]').forEach(cb=> cb.onchange = ()=>{
        const key = cb.dataset.mtd;
        if(cb.checked){ const [space, ...rest] = key.split(':'); const id = rest.join(':'); const g = groups.find(x=> x.space===space); const f = g && g.files.find(x=> x.node.id===id); if(f) picked.set(key, { space, node:f.node }); }
        else picked.delete(key);
        ok.disabled = !picked.size; ok.textContent = picked.size ? `Thêm ${picked.size} tài liệu vào cuộc họp` : 'Thêm vào cuộc họp';
      });
    };
    paint();
    ok.onclick = async ()=>{
      const latest = mtFind(m.id) || m, docs = mtDocs(latest);
      if(mtFileCount(latest) + picked.size > MT_MAX_FILES){ alert(`Mỗi cuộc họp có tối đa ${MT_MAX_FILES} tệp.`); return; }
      const now = new Date().toISOString();
      picked.forEach(({space, node})=> docs.push({ id:mtDocId(), parentId: folderId || null, name:node.name||'Tệp', title:mtStripExt(node.name||'Tệp').slice(0, MT_DOC_TITLE_MAX), mimeType:node.mimeType||'application/octet-stream', size:node.size||0,
        source:'drive', driveId:node.id, driveSpace:space, storagePath:node.storagePath, addedAt:now, updatedAt:now }));
      ok.disabled = true;
      if(await mtSaveDocs(latest, docs)){ close(); showToast(`Đã thêm ${picked.size} tài liệu.`); }
      else ok.disabled = false;
    };
  }

  // =====================================================================
  // MÃ QR — xem to, tải ảnh PNG, in áp phích A4, in thẻ nhỏ dán bàn, chiếu lên màn hình hội trường
  // =====================================================================
  async function mtQrCanvas(url){
    await loadOptionalLibrary('qrcode');
    const holder = document.createElement('div');
    new window.QRCode(holder, { text:url, width:1024, height:1024, colorDark:'#000000', colorLight:'#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    const c = holder.querySelector('canvas');
    if(!c) throw new Error('Trình duyệt không vẽ được mã QR');
    return c;
  }
  function mtWhenWhere(m){ return [m.startAt ? '🕗 '+mtFmtStart(m.startAt) : '', m.place ? '📍 '+m.place : ''].filter(Boolean).join('   '); }
  function mtQrPosterCanvas(m, qrCanvas, url){
    const W = 1080, font = '"Be Vietnam Pro", Arial, sans-serif';
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = `800 50px ${font}`;
    const lines = surveyQrWrapLines(meas, m.title||'Cuộc họp', W-140).slice(0,4);
    meas.font = `400 28px ${font}`;
    const urlLines = surveyQrWrapLines(meas, url.replace(/^https?:\/\//,''), W-120).slice(0,2);
    const meta = [m.startAt ? mtFmtStart(m.startAt) : '', m.place||''].filter(Boolean).join(' · ');
    const bandH = 80 + lines.length*64 + (meta ? 50 : 0), qs = 720;
    const H = bandH + 50 + qs + 110 + urlLines.length*36 + 50;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0,0,W,H);
    x.fillStyle = '#2e7d32'; x.fillRect(0,0,W,bandH);
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'top';
    x.font = `800 50px ${font}`;
    lines.forEach((ln,i)=> x.fillText(ln, W/2, 40 + i*64));
    if(meta){ x.font = `500 30px ${font}`; x.fillText(meta, W/2, 40 + lines.length*64 + 10); }
    const qx = (W-qs)/2, qy = bandH + 50;
    x.imageSmoothingEnabled = false;
    x.drawImage(qrCanvas, qx, qy, qs, qs);
    x.fillStyle = '#1b1b1b'; x.font = `700 40px ${font}`;
    x.fillText('Quét mã để xem tài liệu cuộc họp', W/2, qy + qs + 40);
    x.fillStyle = '#555555'; x.font = `400 28px ${font}`;
    urlLines.forEach((ln,i)=> x.fillText(ln, W/2, qy + qs + 110 + i*36));
    return c;
  }
  async function mtQrModal(m){
    const url = mtShareUrl(m.id);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg mt-font';
    wrap.innerHTML = `<div class="modal" style="max-width:480px;" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>📱 Mã QR — ${escapeHtml(m.title||'Cuộc họp')}</h3><button class="modal-close preview-allow" id="mtq-close" aria-label="Đóng">✕</button></div>
      <div class="modal-body" style="text-align:center;">
        ${mtStatus(m).open ? '' : `<div class="mt-warn">⚠️ Liên kết đang ${escapeHtml(mtStatus(m).label.toLowerCase())} — đại biểu quét mã sẽ không xem được tài liệu.</div>`}
        <div id="mtq-box" class="sv-qr-box"><div class="mt-hint" style="padding:40px 0;">Đang tạo mã QR…</div></div>
        <p class="mt-hint" style="margin:10px 0 4px;">Đại biểu dùng Zalo hoặc Camera điện thoại quét mã này để xem tài liệu — không cần đăng nhập.</p>
        <div style="word-break:break-all; font-size:13px;"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a></div>
      </div>
      <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
        <button class="btn btn-primary btn-sm preview-allow" id="mtq-project">🖥️ Chiếu lên màn hình</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="mtq-png" disabled>⬇️ Tải ảnh PNG</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="mtq-print" disabled>🖨️ In áp phích A4</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="mtq-cards" disabled>🖨️ In thẻ dán bàn</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="mtq-copy">📋 Sao chép link</button>
      </div></div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#mtq-close').onclick = close;
    wrap.addEventListener('click', e=>{ if(e.target===wrap) close(); });
    wrap.querySelector('#mtq-copy').onclick = ()=> copyMessageText(url);
    wrap.querySelector('#mtq-project').onclick = ()=>{ close(); mtProjector(m); };
    const box = wrap.querySelector('#mtq-box');
    let qr;
    try{ qr = await mtQrCanvas(url); }
    catch(e){ box.innerHTML = `<div style="color:#b71c1c; padding:24px 0;">⚠️ Không tạo được mã QR. Vui lòng kiểm tra kết nối mạng rồi thử lại.<div class="mt-hint">${escapeHtml(String(e&&e.message||e))}</div></div>`; return; }
    const qrUrl = qr.toDataURL('image/png');
    box.innerHTML = `<img src="${qrUrl}" alt="Mã QR" class="sv-qr-img">`;
    const slug = surveyFileSlug(m.title||'cuoc-hop');
    const png = wrap.querySelector('#mtq-png'), pr = wrap.querySelector('#mtq-print'), cards = wrap.querySelector('#mtq-cards');
    png.disabled = pr.disabled = cards.disabled = false;
    png.onclick = ()=> mtQrPosterCanvas(m, qr, url).toBlob(b=>{ if(b) downloadBlob(`QR_phong-hop_${slug}.png`, b, 'image/png'); }, 'image/png');
    pr.onclick = ()=>{
      const area = document.getElementById('print-area'); if(!area) return;
      area.innerHTML = `<div class="sv-qr-poster" style="--ps-accent:#2e7d32;">
        <div class="sv-qr-poster-title">${escapeHtml(m.title||'Cuộc họp')}</div>
        ${mtWhenWhere(m) ? `<div class="sv-qr-poster-desc">${escapeHtml(mtWhenWhere(m))}</div>` : ''}
        <img src="${qrUrl}" alt="Mã QR" class="sv-qr-poster-img">
        <div class="sv-qr-poster-cta">📱 Quét mã QR bằng Zalo hoặc Camera điện thoại để xem tài liệu cuộc họp</div>
        <div class="sv-qr-poster-url">${escapeHtml(url)}</div>
      </div>`;
      printAreaNow(false);
    };
    // 8 thẻ nhỏ/trang A4 (2 cột × 4 hàng) — cắt ra dán lên bàn đại biểu.
    cards.onclick = ()=>{
      const area = document.getElementById('print-area'); if(!area) return;
      const card = `<div class="mt-print-card"><img src="${qrUrl}" alt="Mã QR"><div><b>${escapeHtml(m.title||'Cuộc họp')}</b><span>Quét mã để xem tài liệu cuộc họp</span></div></div>`;
      area.innerHTML = `<div class="mt-print-cards">${Array(8).fill(card).join('')}</div>`;
      printAreaNow(false);
    };
  }
  // Toàn màn hình: mã QR thật to để chiếu lên máy chiếu/TV hội trường.
  async function mtProjector(m){
    const st = mtStatus(m);
    qrProjectorOpen({ url: mtShareUrl(m.id), title: m.title||'Cuộc họp', meta: mtWhenWhere(m),
      cta:'📱 Mở Zalo hoặc Camera, quét mã để xem tài liệu',
      closedMsg: st.open ? null : `Liên kết tài liệu cuộc họp đang ở trạng thái “${st.label}”` });
  }

  // =====================================================================
  // TRANG ĐẠI BIỂU — /phonghop/{mã}: không đăng nhập, không menu. Dùng chung cho nút "Xem như đại biểu"
  // trong trình sửa (opts.preview: đọc bản đang có trong máy, không mở kết nối riêng).
  // =====================================================================
  function mtPublicHeadHtml(m){
    return `<header class="mtp-head">
        <h1>${escapeHtml(m.title||'Cuộc họp')}</h1>
        ${m.startAt ? `<div class="mtp-meta">🕗 ${escapeHtml(mtFmtStart(m.startAt))}</div>` : ''}
        ${m.place ? `<div class="mtp-meta">📍 ${escapeHtml(m.place)}</div>` : ''}
      </header>`;
  }
  // Danh sách trong MỘT thư mục: thanh địa chỉ + thư mục con và tệp xen kẽ theo thứ tự cán bộ sắp, đánh số
  // 1, 2, 3… riêng trong thư mục. Thư mục rỗng vẫn hiện và vẫn mở được.
  function mtPublicFolderHtml(m, fid, notice){
    const kids = mtChildren(m, fid), files = kids.filter(d=> !mtIsFolder(d));
    return `${notice ? `<div class="mtp-notice">${escapeHtml(notice)}</div>` : ''}
      ${!fid && m.note ? `<div class="mtp-note">${surveyLinkify(m.note)}</div>` : ''}
      ${mtCrumbsHtml(mtFolderPath(m, fid), 'mtp-crumb')}
      ${kids.length ? `<ol class="mtp-list">${kids.map((d,i)=> mtIsFolder(d)
        ? `<li><button type="button" class="mtp-doc mtp-folder preview-allow" data-mtp-folder="${escapeHtml(d.id)}">
            <span class="mtp-num">${i+1}</span><span class="mtp-fico" aria-hidden="true">📁</span>
            <span class="mtp-doc-main"><b>${escapeHtml(mtDocTitle(d))}</b><small>${escapeHtml(mtCountsText(m, d.id))}</small></span>
            <span class="mtp-go">›</span></button></li>`
        : `<li><button type="button" class="mtp-doc preview-allow" data-mtp-open="${files.indexOf(d)}">
            <span class="mtp-num">${i+1}</span>
            <span class="mtp-doc-main"><b>${escapeHtml(mtDocTitle(d))}</b><small>${escapeHtml(mtKindLabel(d))}${d.size ? ' · '+escapeHtml(driveFormatBytes(d.size)) : ''}${d.replacedAt ? ` · <em>🆕 Bản mới lúc ${escapeHtml(mtFmtIso(d.replacedAt).slice(0,5))}</em>` : ''}</small></span>
            <span class="mtp-go">›</span></button></li>`).join('')}</ol>`
        : `<div class="mtp-empty">${fid ? 'Thư mục này chưa có tài liệu.' : 'Chưa có tài liệu nào. Trang sẽ tự cập nhật khi cán bộ tổ chức đưa tài liệu lên.'}</div>`}`;
  }
  // opts: { meeting, id, preview (xem trong app, dùng quyền Storage của cán bộ), useHistory (trang thật của
  // đại biểu: nút Back của điện thoại lùi về thư mục cha / đóng tài liệu đang xem — địa chỉ trang không đổi,
  // mỗi cuộc họp vẫn chỉ một link) }.
  function mtPublicMount(container, opts){
    let meeting = opts.meeting || null, viewer = null, viewerDocId = null;
    let folderId = null, folderPath = [], notice = '';
    const useHistory = !!opts.useHistory && !!(window.history && history.pushState);
    const resolve = ()=>{
      if(!meeting) return;
      const r = mtResolveFolder(meeting, folderId, folderPath);
      if(r.id!==folderId){ folderId = r.id; notice = r.notice; }
      folderPath = mtFolderPath(meeting, folderId).map(f=> f.id);
    };
    const paint = ()=>{
      if(!meeting){ container.innerHTML = `<div class="mtp"><div class="mtp-closed"><div>🔎</div><h2>Không tìm thấy cuộc họp</h2><p>Đường link không đúng, hoặc cuộc họp đã bị xoá.</p></div></div>`; return; }
      const head = mtPublicHeadHtml(meeting);
      if(!mtStatus(meeting).open){
        container.innerHTML = `<div class="mtp">${head}<div class="mtp-closed"><div>🔒</div><h2>Tài liệu cuộc họp đã đóng</h2><p>Liên kết này không còn hiệu lực. Vui lòng liên hệ cán bộ tổ chức cuộc họp nếu cần xem lại tài liệu.</p></div><footer class="mtp-foot">Phòng họp không giấy · hoinongdan.sotay.org</footer></div>`;
        return;
      }
      resolve();
      container.innerHTML = `<div class="mtp">${head}${mtPublicFolderHtml(meeting, folderId, notice)}<footer class="mtp-foot">Phòng họp không giấy · hoinongdan.sotay.org</footer></div>`;
      notice = '';
      container.querySelectorAll('[data-mtp-open]').forEach(b=> b.onclick = ()=> openDoc(+b.dataset.mtpOpen, true));
      container.querySelectorAll('[data-mtp-folder]').forEach(b=> b.onclick = ()=> goFolder(b.dataset.mtpFolder));
      container.querySelectorAll('[data-mtp-crumb]').forEach(b=> b.onclick = ()=> goFolder(b.dataset.mtpCrumb || null));
    };
    const scrollTop = ()=>{ const sc = container.closest('.mtp-preview-body'); if(sc) sc.scrollTop = 0; else window.scrollTo(0, 0); };
    const goFolder = (id, fromHistory)=>{
      folderId = id || null; folderPath = meeting ? mtFolderPath(meeting, folderId).map(f=> f.id) : [];
      paint(); scrollTop();
      if(useHistory && !fromHistory) history.pushState({ mtp:1, folder: folderId }, '');
    };
    const closeViewer = ()=>{ if(viewer){ const v = viewer; viewer = null; viewerDocId = null; v.close(true); } };
    const openDoc = (i, fromList)=>{
      const files = mtChildFiles(meeting, folderId);
      if(!files[i] || !mtStatus(meeting).open) return;
      closeViewer();
      viewerDocId = files[i].id;
      viewer = mtOpenDocViewer(files, i, ni=> openDoc(ni, false), silent=>{
        viewer = null; viewerDocId = null;
        if(!silent && useHistory && history.state && history.state.mtpViewer) history.back();
      }, { meetingId: meeting.id || opts.id, preview: !!opts.preview });
      if(useHistory && fromList) history.pushState({ mtp:1, folder: folderId, mtpViewer:true }, '');
    };
    if(useHistory){
      history.replaceState({ mtp:1, folder:null }, '');
      window.addEventListener('popstate', e=>{
        const st = e.state || {};
        if(viewer && !st.mtpViewer) closeViewer();
        if((st.folder || null)!==folderId) goFolder(st.folder || null, true);
      });
    }
    paint();
    return {
      update(next){
        meeting = next;
        paint();
        if(!viewer) return;
        if(!meeting || !mtStatus(meeting).open){ closeViewer(); return; }
        const prev = viewer.doc && viewer.doc();
        const now = prev && mtDocs(meeting).find(d=> d.id===prev.id);
        if(!now){ viewer.notice('Tài liệu này vừa được gỡ khỏi cuộc họp.', null); return; }
        if(now.storagePath!==prev.storagePath){
          const idx = mtChildFiles(meeting, folderId).findIndex(d=> d.id===now.id);
          viewer.notice('Tài liệu này vừa được cập nhật bản mới.', idx>=0 ? ()=> openDoc(idx, false) : null);
        }
      },
      close(){ closeViewer(); },
    };
  }
  // ---- Tải tệp cho đại biểu qua Cloud Function: /phonghop/{mã}/tep/{mã tài liệu}. Mỗi lần gọi, máy chủ
  // kiểm tra cuộc họp còn mở (chưa đóng tay, chưa hết hạn, chưa xoá) rồi mới trả dữ liệu — nên "Đóng liên
  // kết" có tác dụng ngay với cả người đã chép được đường dẫn. Function thế hệ 1 giới hạn mỗi phản hồi
  // 10 MB, nên tệp được chia phần 8 MB: gọi ?info trước để biết số phần, rồi tải lần lượt ?part=0,1,…
  function mtFileEndpoint(meetingId, docId){ return `${location.origin}/phonghop/${encodeURIComponent(meetingId)}/tep/${encodeURIComponent(docId)}`; }
  function mtFileError(code){
    const msg = code==='closed' ? 'Tài liệu cuộc họp đã đóng.' : (code==='not_found' || code==='doc_not_found') ? 'Tài liệu không còn trong cuộc họp.' : 'Không tải được tài liệu. Vui lòng kiểm tra kết nối mạng rồi thử lại.';
    return Object.assign(new Error(msg), { code: code || 'network' });
  }
  async function mtFetchJson(url){
    let r;
    try{ r = await fetch(url, { cache:'no-store' }); }catch(e){ throw mtFileError('network'); }
    let data = null;
    try{ data = await r.json(); }catch(e){}
    if(!r.ok || !data || data.error) throw mtFileError(data && data.error);
    return data;
  }
  async function mtFetchDocBlob(meetingId, doc, onProgress, isClosed){
    const base = mtFileEndpoint(meetingId, doc.id);
    const info = await mtFetchJson(`${base}?info=1`);
    const parts = Math.max(1, parseInt(info.parts,10)||1), chunks = [];
    for(let i=0; i<parts; i++){
      if(isClosed && isClosed()) throw mtFileError('aborted');
      let r;
      try{ r = await fetch(`${base}?part=${i}`, { cache:'no-store' }); }catch(e){ throw mtFileError('network'); }
      if(!r.ok){ let data = null; try{ data = await r.json(); }catch(e){} throw mtFileError(data && data.error); }
      chunks.push(await r.arrayBuffer());
      if(onProgress) onProgress(Math.round((i+1)*100/parts));
    }
    return { blob: new Blob(chunks, { type: info.contentType || doc.mimeType || 'application/octet-stream' }), name: info.name || doc.name || 'tai-lieu' };
  }
  // Trình xem trong app (cán bộ bấm "Xem như đại biểu"/👁): lấy link tạm của Storage bằng quyền của chính cán
  // bộ — xem được cả khi liên kết đang đóng. Không có quyền đọc Storage (vd khách qua mã) thì đi qua function.
  async function mtPreviewUrl(meetingId, doc){
    if(doc.storageUrl) return doc.storageUrl;
    if(doc.storagePath && typeof storage!=='undefined'){
      try{ return await storage.ref(doc.storagePath).getDownloadURL(); }catch(e){ console.warn('[Phòng họp] Không lấy được link xem thử từ Storage, thử qua máy chủ:', e); }
    }
    return null;
  }
  function mtOpenDocViewer(docs, index, onGo, onClose, ctx){
    ctx = ctx || {};
    const d = docs[index];
    const wrap = document.createElement('div');
    wrap.className = 'mtp-viewer';
    wrap.innerHTML = `
      <div class="mtp-viewer-bar">
        <button type="button" class="mtp-vbtn preview-allow ${ctx.backRed ? 'is-red' : ''}" data-mtv-back>${escapeHtml(ctx.backLabel || '‹ Danh sách')}</button>
        <div class="mtp-viewer-title"><small>Tài liệu ${index+1}/${docs.length}</small><b>${escapeHtml(mtDocTitle(d))}</b></div>
        <a class="mtp-vbtn" data-mtv-dl style="visibility:hidden;">⬇ Tải về</a>
      </div>
      <div class="mtp-viewer-notice" style="display:none;"></div>
      <div class="mtp-viewer-body"><div class="mtp-viewer-loading">Đang mở tài liệu…</div></div>
      <div class="mtp-viewer-nav">
        <button type="button" class="mtp-vbtn preview-allow" data-mtv-prev ${index===0?'disabled':''}>‹ Tài liệu trước</button>
        <button type="button" class="mtp-vbtn preview-allow" data-mtv-next ${index>=docs.length-1?'disabled':''}>Tài liệu sau ›</button>
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('mtp-viewer-open');
    let closed = false;
    const objectUrls = [];
    const api = {
      index: ()=> index,
      doc: ()=> d,
      // silent = đóng do chương trình (chuyển tài liệu, cập nhật, nút Back) — không phải người dùng bấm nút.
      close(silent){
        if(closed) return; closed = true; wrap.remove();
        drivePptxSweep();
        objectUrls.forEach(u=>{ try{ URL.revokeObjectURL(u); }catch(e){} });
        if(!document.querySelector('.mtp-viewer')) document.body.classList.remove('mtp-viewer-open');
        if(onClose) onClose(!!silent);
      },
      notice(text, onReload){
        const n = wrap.querySelector('.mtp-viewer-notice');
        n.innerHTML = `<span>🆕 ${escapeHtml(text)}</span>${onReload ? '<button type="button" class="preview-allow">Mở bản mới</button>' : ''}`;
        n.style.display = '';
        const b = n.querySelector('button'); if(b) b.onclick = onReload;
      },
    };
    wrap.querySelector('[data-mtv-back]').onclick = ()=> api.close(false);
    wrap.querySelector('[data-mtv-prev]').onclick = ()=> onGo(index-1);
    wrap.querySelector('[data-mtv-next]').onclick = ()=> onGo(index+1);
    const body = wrap.querySelector('.mtp-viewer-body');
    const dl = wrap.querySelector('[data-mtv-dl]');
    const show = async ()=>{
      body.innerHTML = '<div class="mtp-viewer-loading">Đang mở tài liệu…</div>';
      // Tài liệu mẫu của môi trường tham quan: nội dung nằm sẵn trong bản ghi.
      if(d.content!=null){ drivePopulateFileViewer(body, { type:'file', name:d.name, mimeType:d.mimeType, content:d.content }); return; }
      let url = null, isBlob = false;
      try{
        if(ctx.preview) url = await mtPreviewUrl(ctx.meetingId, d);
        if(!url){
          const got = await mtFetchDocBlob(ctx.meetingId, d, pct=>{ const l = body.querySelector('.mtp-viewer-loading'); if(l && pct<100) l.textContent = `Đang tải tài liệu… ${pct}%`; }, ()=> closed);
          url = URL.createObjectURL(got.blob); objectUrls.push(url); isBlob = true;
        }
      }catch(e){
        if(closed) return;
        body.innerHTML = `<div class="mtp-closed"><div>${e.code==='closed' ? '🔒' : '⚠️'}</div><h2>${escapeHtml(e.message)}</h2>${e.code==='closed' ? '' : '<button type="button" class="mtp-vbtn mtp-retry preview-allow">↻ Thử lại</button>'}</div>`;
        const rt = body.querySelector('.mtp-retry'); if(rt) rt.onclick = show;
        return;
      }
      if(closed) return;
      dl.href = url;
      if(isBlob){ dl.setAttribute('download', d.name || mtDocTitle(d)); dl.removeAttribute('target'); }
      else { dl.target = '_blank'; dl.rel = 'noopener'; }
      dl.style.visibility = '';
      const node = { type:'file', name:d.name, mimeType:d.mimeType, storageUrl:url };
      if(driveFileKind(node)==='pdf') mtRenderPdf(body, url, ()=> closed);
      else drivePopulateFileViewer(body, node);
    };
    show();
    return api;
  }
  // PDF vẽ bằng pdf.js thành từng trang ảnh vừa khổ màn hình (khung nhúng iframe trên điện thoại
  // thường chỉ hiện trang đầu hoặc bắt tải về). Trang chỉ được vẽ khi cuộn tới gần để nhẹ máy.
  async function mtRenderPdf(el, url, isClosed){
    try{
      await loadOptionalLibrary('pdfjs');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      const pdf = await window.pdfjsLib.getDocument({ url }).promise;
      if(isClosed()) return;
      const first = await pdf.getPage(1);
      const vp1 = first.getViewport({ scale:1 });
      el.innerHTML = `<div class="mtp-pdf">${Array.from({length:pdf.numPages}, (_,i)=>`<div class="mtp-pdf-page" data-page="${i+1}" style="aspect-ratio:${vp1.width}/${vp1.height};"><span>Trang ${i+1}</span></div>`).join('')}</div>`;
      const drawn = new Set();
      const draw = async (holder)=>{
        const n = +holder.dataset.page; if(drawn.has(n)) return; drawn.add(n);
        try{
          const page = n===1 ? first : await pdf.getPage(n);
          if(isClosed()) return;
          const base = page.getViewport({ scale:1 });
          const cssW = holder.clientWidth || el.clientWidth || 360;
          const scale = Math.min(cssW * Math.min(window.devicePixelRatio||1, 2) * 1.5 / base.width, 2400 / base.width);
          const vp = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
          holder.style.aspectRatio = `${base.width}/${base.height}`;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          holder.innerHTML = ''; holder.appendChild(canvas);
        }catch(e){ console.warn('[Phòng họp] Vẽ trang PDF lỗi:', e); holder.innerHTML = `<span>⚠️ Không hiển thị được trang ${n}</span>`; }
      };
      const pages = Array.from(el.querySelectorAll('.mtp-pdf-page'));
      if('IntersectionObserver' in window){
        const io = new IntersectionObserver(entries=> entries.forEach(en=>{ if(en.isIntersecting){ io.unobserve(en.target); draw(en.target); } }), { root: el, rootMargin:'800px 0px' });
        pages.forEach(p=> io.observe(p));
      } else pages.forEach(draw);
    }catch(e){
      console.warn('[Phòng họp] pdf.js không mở được tệp, chuyển sang khung xem của trình duyệt:', e);
      if(isClosed()) return;
      el.innerHTML = `<div class="mtp-pdf-fallback"><iframe class="drive-viewer-pdf" title="Tài liệu PDF"></iframe><a class="btn btn-primary" href="${escapeHtml(url)}" target="_blank" rel="noopener">Mở tệp PDF ↗</a></div>`;
      el.querySelector('iframe').src = url;
    }
  }
  // "Xem như đại biểu" ngay trong app — dựng lại đúng giao diện trang công khai trên lớp phủ toàn màn hình,
  // luôn bắt đầu ở thư mục gốc.
  function mtOpenPreview(m){
    const wrap = document.createElement('div');
    wrap.className = 'mtp-preview';
    wrap.innerHTML = `<div class="mtp-preview-bar"><span>👁 Đang xem như đại biểu${mtStatus(m).open ? '' : ' — liên kết đang đóng'}</span><button type="button" class="btn btn-ghost btn-sm preview-allow">✕ Đóng</button></div><div class="mtp-preview-body"></div>`;
    document.body.appendChild(wrap);
    const mount = mtPublicMount(wrap.querySelector('.mtp-preview-body'), { meeting:m, preview:true });
    wrap.querySelector('.mtp-preview-bar button').onclick = ()=>{ mount.close(); wrap.remove(); };
  }
  // Nút 👁 / bấm tên tệp trong trình sửa: mở THẲNG trình xem (không qua "Xem như đại biểu"), nút "‹ Quay lại"
  // chữ đỏ đóng trình xem và trả về đúng chỗ cũ trong trình sửa. Trước/sau đi trong thư mục đang mở. Dùng quyền
  // Storage của cán bộ nên xem được cả khi liên kết đang đóng.
  function mtOpenEditorViewer(m, folderId, docId){
    const files = mtChildFiles(m, folderId);
    let i = files.findIndex(d=> d.id===docId);
    if(i<0) return;
    let viewer = null;
    const open = idx=>{
      if(viewer){ const v = viewer; viewer = null; v.close(true); }
      viewer = mtOpenDocViewer(files, idx, ni=> open(ni), ()=>{ viewer = null; }, { meetingId:m.id, preview:true, backLabel:'‹ Quay lại', backRed:true });
    };
    open(i);
  }
  function renderPublicMeetingPage(id){
    document.body.classList.add('public-meeting-mode');
    document.title = 'Phòng họp không giấy - Hoinongdan.sotay.org';
    root.innerHTML = `<div class="mtp"><div class="mtp-viewer-loading">Đang tải tài liệu cuộc họp…</div></div>`;
    if(!MT_ID_RE.test(id)){ mtPublicMount(root, { meeting:null }); return; }
    let mount = null;
    rtdb.ref(`meetings/${id}`).on('value', snap=>{
      const m = snap && snap.exists() ? snap.val() : null;
      const visible = m && !m.deleted ? m : null;
      if(visible) document.title = `${visible.title||'Cuộc họp'} - Phòng họp không giấy`;
      if(!mount) mount = mtPublicMount(root, { meeting:visible, id, useHistory:true });
      else mount.update(visible);
    }, err=>{
      console.error('[Phòng họp] Không tải được cuộc họp:', err);
      root.innerHTML = `<div class="mtp"><div class="mtp-closed"><div>⚠️</div><h2>Không tải được tài liệu</h2><p>Vui lòng kiểm tra kết nối mạng rồi tải lại trang.</p></div></div>`;
    });
  }
