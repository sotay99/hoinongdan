  // =====================================================================
  // 19-training.js — Module TẬP HUẤN BẰNG AI.
  //
  // Cán bộ Hội soạn MỘT bài tập huấn (đưa tài liệu vào → AI đọc và soạn giáo án + bộ câu hỏi kiểm tra
  // → cán bộ rà lại) rồi gửi MỘT đường liên kết/mã QR. Mỗi học viên bấm vào là được AI kèm riêng: AI
  // thăm dò trình độ, giảng từng phần, hỏi ngược để chắc là hiểu, cuối cùng làm bài kiểm tra trắc nghiệm.
  //
  // Lưu trữ (Realtime Database, cấp gốc giống meetings/ và surveys/ để học viên đọc được mà không cần biết
  // mã xã):
  //   trainings/{mã bài}                      — thông tin bài, tài liệu đã đọc thành chữ, giáo án, câu hỏi
  //   training_learners/{mã bài}/{mã học viên} — tiến độ của từng học viên (học viên tự ghi phần của mình;
  //                                              KHÔNG lưu nguyên văn cuộc trò chuyện — chỉ lưu tiến độ,
  //                                              điểm và "chỗ còn vướng" để cán bộ xem kết quả)
  //   Storage training_files/{mã bài}/…       — tệp gốc cán bộ tải lên (chỉ cán bộ xem; học viên không cần)
  // Danh sách lọc bằng orderByChild('wardId'|'ownerEmail') — nên thêm ".indexOn":["wardId","ownerEmail"]
  // cho nút trainings trong Firebase Rules.
  //
  // Trang học viên: /taphuan/{mã} (bản xem trước/máy chạy thử dùng dạng #/taphuan/{mã}). Không đăng nhập,
  // không menu. Cuộc trò chuyện được giữ trong bộ nhớ trình duyệt của học viên để quay lại học tiếp.
  //
  // Phần này đứng CUỐI manifest nên chứa khối khởi động boot() ở cuối tệp.
  // =====================================================================
  const TN_TITLE_MAX = 150, TN_INTRO_MAX = 1500, TN_AUDIENCE_MAX = 200;
  const TN_MAX_MATERIALS = 20, TN_MAX_FILE_MB = 15;
  // Giới hạn chữ: mỗi tài liệu 60.000 ký tự, cả bài 150.000 ký tự (~40 nghìn token) — đủ cho một bộ tài
  // liệu tập huấn dày, mà mỗi lượt trò chuyện của học viên vẫn gửi trọn tài liệu cho AI được.
  const TN_MAT_MAX_CHARS = 60000, TN_TOTAL_MAX_CHARS = 150000;
  const TN_MAX_LESSONS = 12, TN_MAX_QUIZ = 40;
  const TN_ID_RE = /^[A-Za-z0-9_-]{6,128}$/;
  const TN_HISTORY_TURNS = 30;
  const TN_CALLS = ['Bác','Chú','Cô','Anh','Chị','Ông','Bà','Em','Bạn'];
  const TN_LEVELS = { moi:'Mới làm quen', coban:'Đã biết cơ bản', kha:'Đã nắm khá' };

  function tnS(){
    if(!state.tn) state.tn = { space:null, view:'list', editingId:null, tab:'build', list:[], trash:[], loaded:false, error:'', q:'', busy:'', learners:[], learnersFor:null, learnersLoaded:false, learnersError:'' };
    return state.tn;
  }
  function tnRand(n){
    const a = new Uint8Array(n);
    try{ crypto.getRandomValues(a); }catch(e){ for(let i=0;i<a.length;i++) a[i] = Math.floor(Math.random()*256); }
    return Array.from(a, b=> (b%36).toString(36)).join('');
  }
  function tnNewId(){ return 'tn' + tnRand(12); }
  function tnItemId(p){ return (p||'i') + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function tnArr(v){ return (Array.isArray(v) ? v : Object.values(v||{})).filter(x=> x && typeof x==='object'); }
  function tnMaterials(c){ return tnArr(c && c.materials); }
  function tnLessons(c){ return tnArr(c && c.lessons).map(l=> ({ ...l, points: (Array.isArray(l.points) ? l.points : Object.values(l.points||{})).filter(Boolean) })); }
  function tnQuiz(c){
    return tnArr(c && c.quiz).map(q=> ({ ...q, options: (Array.isArray(q.options) ? q.options : Object.values(q.options||{})).map(String) }))
      .filter(q=> q.q && q.options.length>=2);
  }
  function tnFind(id){ return tnS().list.find(c=> c.id===id) || null; }
  function tnTotalChars(c){ return tnMaterials(c).reduce((s,m)=> s + String(m.text||'').length, 0); }
  function tnSettings(c){
    const s = (c && c.settings) || {};
    return { quizCount: Math.max(3, Math.min(20, parseInt(s.quizCount,10) || 5)), passPercent: Math.max(30, Math.min(100, parseInt(s.passPercent,10) || 70)) };
  }
  function tnFmtIso(iso){
    if(!iso) return '';
    const d = new Date(iso); if(isNaN(d)) return '';
    const p = n=> String(n).padStart(2,'0');
    return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`;
  }
  function tnFmtChars(n){ return (n||0).toLocaleString('vi-VN'); }
  // Bài đã đủ điều kiện cho học viên học chưa: phải có tài liệu và giáo án.
  function tnReady(c){ return tnMaterials(c).length>0 && tnLessons(c).length>0; }
  function tnStatus(c){
    if(!c) return { open:false, key:'missing', label:'Không tồn tại' };
    if(c.status==='closed') return { open:false, key:'closed', label:'Đã đóng liên kết' };
    if(c.closeAt && new Date(c.closeAt).getTime() <= Date.now()) return { open:false, key:'expired', label:'Đã hết hạn' };
    if(!tnReady(c)) return { open:false, key:'draft', label:'Chưa soạn xong' };
    return { open:true, key:'open', label: c.closeAt ? `Đang mở · tự đóng lúc ${tnFmtIso(c.closeAt)}` : 'Đang mở cho học viên' };
  }

  // ---- Link công khai. Bản xem trước của nhánh phụ / máy chạy thử dùng dạng # như Phòng họp, Biểu mẫu.
  function tnShareUrl(id){
    return surveyUsesHashLinks() ? `${location.origin}/#/taphuan/${encodeURIComponent(id)}` : `${location.origin}/taphuan/${encodeURIComponent(id)}`;
  }
  function publicTrainingRouteId(){
    const p = (window.location.pathname||'').match(/^\/taphuan\/([^/]+)\/?$/);
    if(p) return decodeURIComponent(p[1]);
    const h = (window.location.hash||'').match(/^#\/taphuan\/([^/?]+)\/?$/);
    return h ? decodeURIComponent(h[1]) : null;
  }

  // ---- Phân quyền (giống Phòng họp): bộ DÙNG CHUNG theo quyền 'training' ở "Cài đặt & Chia sẻ", bộ CÁ
  // NHÂN theo tài khoản Google. ----
  function tnHasPersonal(){ return !!(state.identity && state.identity.email); }
  function tnCanView(){
    if(isTourMode()) return true;
    return tnS().space==='personal' ? tnHasPersonal() : (!!wardId() && canViewModule('training'));
  }
  function tnCanEdit(){
    if(isTourMode()) return true;
    return tnS().space==='personal' ? tnHasPersonal() : (!!wardId() && canEditModule('training'));
  }
  function tnWriteOk(){
    if(isTourMode()){ alert('Đồng chí đang ở môi trường tham quan, vui lòng đăng nhập để sử dụng tính năng này.'); return false; }
    if(!tnCanEdit()){ alert(tnS().space==='personal' ? 'Tập huấn cá nhân yêu cầu đăng nhập bằng tài khoản Google.' : 'Đồng chí không có quyền sửa bài tập huấn dùng chung. Vui lòng liên hệ Chủ mã để được cấp quyền tại "Cài đặt & Chia sẻ".'); return false; }
    return true;
  }
  function tnDefaultSpace(){
    if(isTourMode()) return 'shared';
    if(wardId() && canViewModule('training')) return 'shared';
    return tnHasPersonal() ? 'personal' : 'shared';
  }

  // ---- Dữ liệu mẫu cho môi trường tham quan (không đọc/ghi Firebase) ----
  function tnDemoCourses(){
    const now = new Date().toISOString();
    const text = `HƯỚNG DẪN VAY VỐN QUỸ HỖ TRỢ NÔNG DÂN (tài liệu mẫu)

1. Đối tượng được vay: hội viên Hội Nông dân có hộ khẩu tại địa phương, có phương án sản xuất kinh doanh khả thi, tham gia tổ vay vốn và được tổ bình xét.

2. Mức vay và thời hạn: mỗi hộ vay tối đa theo quy định của Quỹ từng thời kỳ; thời hạn vay tối đa 36 tháng, tuỳ chu kỳ sản xuất của phương án.

3. Lãi suất: thấp hơn lãi suất ngân hàng thương mại; lãi trả hằng tháng hoặc hằng quý theo hợp đồng.

4. Hồ sơ gồm: đơn đề nghị vay vốn, phương án sản xuất kinh doanh, biên bản họp tổ vay vốn, bản sao căn cước.

5. Trách nhiệm người vay: sử dụng vốn đúng mục đích, trả lãi và gốc đúng hạn, sinh hoạt tổ đầy đủ. Sử dụng vốn sai mục đích sẽ bị thu hồi vốn trước hạn.`;
    return [{
      id:'tndemo0000001', scope:'shared', demo:true, wardName:'(mẫu)', orgTitle:'(mẫu)', groupLabel: subAdminLabel(), groups:['Ấp 1','Ấp 2','Ấp 3'],
      title:'Hướng dẫn vay vốn Quỹ Hỗ trợ Nông dân (mẫu)', audience:'Hội viên có nhu cầu vay vốn sản xuất',
      intro:'Bài tập huấn ngắn giúp bà con nắm được điều kiện, hồ sơ và trách nhiệm khi vay vốn Quỹ Hỗ trợ Nông dân. Học trên điện thoại, lúc nào rảnh thì học.',
      summary:'Tài liệu hướng dẫn đối tượng, mức vay, lãi suất, hồ sơ và trách nhiệm của hội viên khi vay vốn Quỹ Hỗ trợ Nông dân.',
      materials:[{ id:'mdemo1', name:'Hướng dẫn vay vốn (mẫu).txt', kind:'text', via:'local', text, addedAt:now }],
      lessons:[
        { id:'ldemo1', title:'Ai được vay vốn Quỹ', goal:'Biết các điều kiện để được vay.', points:['Là hội viên Hội Nông dân tại địa phương','Có phương án sản xuất kinh doanh khả thi','Tham gia tổ vay vốn và được tổ bình xét'] },
        { id:'ldemo2', title:'Mức vay, thời hạn và lãi suất', goal:'Hiểu vay được bao lâu và trả lãi thế nào.', points:['Thời hạn vay tối đa 36 tháng','Lãi suất thấp hơn ngân hàng thương mại','Trả lãi hằng tháng hoặc hằng quý'] },
        { id:'ldemo3', title:'Hồ sơ và trách nhiệm người vay', goal:'Chuẩn bị đủ hồ sơ và dùng vốn đúng mục đích.', points:['Đơn đề nghị, phương án, biên bản họp tổ, bản sao căn cước','Dùng vốn sai mục đích bị thu hồi trước hạn'] },
      ],
      quiz:[
        { id:'qdemo1', q:'Thời hạn vay tối đa của Quỹ Hỗ trợ Nông dân là bao lâu?', options:['12 tháng','24 tháng','36 tháng','60 tháng'], answer:2, explain:'Tài liệu nêu thời hạn vay tối đa 36 tháng.', lesson:2 },
        { id:'qdemo2', q:'Điều kiện nào KHÔNG bắt buộc để được vay?', options:['Là hội viên Hội Nông dân','Có phương án sản xuất khả thi','Có tài sản thế chấp là nhà đất','Được tổ vay vốn bình xét'], answer:2, explain:'Tài liệu không yêu cầu thế chấp nhà đất.', lesson:1 },
        { id:'qdemo3', q:'Dùng vốn sai mục đích thì sao?', options:['Không sao cả','Bị thu hồi vốn trước hạn','Được vay thêm','Chỉ bị nhắc nhở'], answer:1, explain:'Sử dụng vốn sai mục đích sẽ bị thu hồi vốn trước hạn.', lesson:3 },
      ],
      settings:{ quizCount:3, passPercent:70 }, status:'open', closeAt:'', createdAt:now, updatedAt:now, deleted:false,
    }];
  }
  function tnDemoLearners(){
    const t = m=> new Date(Date.now()-m*60000).toISOString();
    return [
      { id:'ld1', name:'Nguyễn Văn Ba', call:'Chú', group:'Ấp 1', level:'coban', startedAt:t(300), lastAt:t(240), lessons:{ ldemo1:'done', ldemo2:'done', ldemo3:'done' }, quiz:{ best:100, last:100, attempts:1, passed:true, at:t(240) }, completedAt:t(240), turns:14, struggles:[] },
      { id:'ld2', name:'Trần Thị Mai', call:'Chị', group:'Ấp 2', level:'moi', startedAt:t(200), lastAt:t(30), lessons:{ ldemo1:'done', ldemo2:'learning' }, turns:9, struggles:[{ lesson:'ldemo2', text:'Nhầm thời hạn vay tối đa là 12 tháng', at:t(40) },{ lesson:'ldemo2', text:'Chưa rõ trả lãi theo tháng hay theo quý', at:t(35) }] },
      { id:'ld3', name:'Lê Văn Tư', call:'Bác', group:'Ấp 3', level:'kha', startedAt:t(100), lastAt:t(60), lessons:{ ldemo1:'done', ldemo2:'done', ldemo3:'done' }, quiz:{ best:67, last:67, attempts:2, passed:false, at:t(60) }, turns:20, struggles:[{ lesson:'ldemo3', text:'Nghĩ rằng cần thế chấp nhà đất', at:t(70) }] },
    ];
  }

  // ---- Lắng nghe danh sách theo không gian đang xem ----
  let tnListenerRef = null, tnListenerKey = null;
  function tnDetach(){ if(tnListenerRef){ try{ tnListenerRef.off(); }catch(e){} } tnListenerRef = null; tnListenerKey = null; }
  function tnAttach(){
    const S = tnS();
    if(!S.space) S.space = tnDefaultSpace();
    if(isTourMode()){
      if(tnListenerKey!=='tour'){ tnDetach(); tnListenerKey = 'tour'; S.list = tnDemoCourses(); S.trash = []; S.loaded = true; S.error = ''; }
      return;
    }
    let ref = null, key = null;
    if(S.space==='personal'){
      const email = state.identity && state.identity.email;
      if(email){ key = 'personal:'+email; ref = rtdb.ref('trainings').orderByChild('ownerEmail').equalTo(email); }
    } else if(wardId() && canViewModule('training')){
      key = 'shared:'+wardId(); ref = rtdb.ref('trainings').orderByChild('wardId').equalTo(wardId());
    }
    if(!ref){ tnDetach(); S.list = []; S.trash = []; S.loaded = true; return; }
    if(tnListenerRef && tnListenerKey===key) return;
    tnDetach();
    S.list = []; S.trash = []; S.loaded = false; S.error = '';
    tnListenerKey = key; tnListenerRef = ref;
    ref.on('value', snap=>{
      if(tnListenerKey!==key) return;
      const all = (snap && snap.exists()) ? Object.values(snap.val()||{}) : [];
      const mine = all.filter(c=> c && c.id && (S.space==='personal' ? c.scope==='personal' : c.scope!=='personal'));
      S.list = mine.filter(c=> !c.deleted);
      S.trash = mine.filter(c=> c.deleted).sort((a,b)=> String(b.deletedAt||'').localeCompare(String(a.deletedAt||'')));
      S.loaded = true; S.error = '';
      tnRefreshFromRealtime();
    }, err=>{
      console.error('[Tập huấn] Không tải được danh sách bài (kiểm tra Firebase Rules cho nút trainings, ".indexOn":["wardId","ownerEmail"]):', err);
      S.loaded = true; S.error = 'Không tải được danh sách bài tập huấn. Vui lòng kiểm tra kết nối mạng rồi tải lại trang.';
      tnRefreshFromRealtime();
    });
  }
  // Dữ liệu mới về: danh sách thì vẽ lại danh sách; trình sửa thì CHỈ vẽ lại các khung động, không đụng vào
  // ô đang gõ để khỏi mất con trỏ.
  function tnRefreshFromRealtime(){
    if(state.view!=='app' || state.activeTab!=='training') return;
    const S = tnS(), el = document.getElementById('content'); if(!el) return;
    if(S.view==='editor'){
      if(!tnFind(S.editingId)){ S.view = 'list'; S.editingId = null; renderTrainingTab(el); return; }
      tnPaintEditorParts(el);
    } else if(el.querySelector('#tn-list')) tnPaintList(el);
    else renderTrainingTab(el);
  }
  function tnSwitchSpace(space){
    const S = tnS();
    if(S.space===space) return;
    if(space==='personal' && !tnHasPersonal() && !isTourMode()){ alert('Tập huấn cá nhân yêu cầu đăng nhập bằng tài khoản Google.'); return; }
    S.space = space; S.view = 'list'; S.editingId = null;
    if(isTourMode()) tnListenerKey = null;
    const el = document.getElementById('content'); if(el) renderTrainingTab(el);
  }

  // ---- Kết quả học viên của bài đang mở ----
  let tnLearnRef = null;
  function tnDetachLearners(){ if(tnLearnRef){ try{ tnLearnRef.off(); }catch(e){} } tnLearnRef = null; const S = tnS(); S.learnersFor = null; }
  function tnAttachLearners(courseId){
    const S = tnS();
    if(S.learnersFor===courseId) return;
    tnDetachLearners();
    S.learnersFor = courseId; S.learners = []; S.learnersLoaded = false; S.learnersError = '';
    if(isTourMode()){ S.learners = tnDemoLearners(); S.learnersLoaded = true; return; }
    tnLearnRef = rtdb.ref(`training_learners/${courseId}`);
    tnLearnRef.on('value', snap=>{
      if(S.learnersFor!==courseId) return;
      S.learners = (snap && snap.exists()) ? Object.values(snap.val()||{}).filter(x=> x && x.id) : [];
      S.learnersLoaded = true; S.learnersError = '';
      tnRepaintResultsBits();
    }, err=>{
      console.error('[Tập huấn] Không tải được kết quả học viên (kiểm tra Firebase Rules cho nút training_learners):', err);
      S.learnersLoaded = true; S.learnersError = 'Không tải được kết quả học viên. Vui lòng kiểm tra kết nối mạng rồi tải lại trang.';
      tnRepaintResultsBits();
    });
  }
  function tnRepaintResultsBits(){
    if(state.view!=='app' || state.activeTab!=='training') return;
    const el = document.getElementById('content'); if(!el) return;
    const S = tnS(), c = tnFind(S.editingId); if(!c) return;
    const cnt = el.querySelector('#tn-tab-results'); if(cnt) cnt.textContent = `📈 Kết quả học tập (${S.learners.length})`;
    if(S.tab==='results') tnPaintResults(el, c);
    tnPaintSteps(el, c);
  }

  // ---- Ghi dữ liệu ----
  function tnActor(){ return (state.identity && (state.identity.name || state.identity.email)) || ''; }
  // Ảnh chụp danh xưng/địa danh lúc soạn — trang học viên không có state.config nên phải mang theo.
  function tnOrgSnapshot(){
    const cfg = state.config || {};
    return { wardName: cfg.wardName || '', orgTitle: wardTitle(), groupLabel: subAdminLabel(),
      groups: (Array.isArray(cfg.hamlets) ? cfg.hamlets : []).filter(h=> typeof h==='string' && h.trim()).slice(0, 80) };
  }
  async function tnCreate(fields){
    if(!tnWriteOk()) return null;
    const S = tnS(), now = new Date().toISOString(), id = tnNewId();
    const personal = S.space==='personal';
    const rec = {
      id, scope: personal ? 'personal' : 'shared', wardId: personal ? null : wardId(),
      ...tnOrgSnapshot(),
      ownerEmail: (state.identity && state.identity.email) || null, createdByName: tnActor(),
      title: fields.title, audience: fields.audience || '', intro:'', summary:'',
      materials:[], lessons:[], quiz:[], settings:{ quizCount:5, passPercent:70 },
      status:'open', closeAt:'', createdAt: now, updatedAt: now, deleted:false,
    };
    await rtdb.ref(`trainings/${id}`).set(rec);
    try{ await pushLog('tạo bài tập huấn bằng AI', rec.title); }catch(e){}
    return rec;
  }
  async function tnUpdate(id, fields){
    if(!tnWriteOk()) return false;
    try{
      await rtdb.ref(`trainings/${id}`).update({ ...fields, ...(tnS().space==='personal' ? {} : tnOrgSnapshot()), updatedAt: new Date().toISOString() });
      return true;
    }catch(e){
      console.error('[Tập huấn] Lưu lỗi:', e);
      alert('Không lưu được thay đổi: ' + (e && e.message || e));
      return false;
    }
  }
  // Ghi đè nguyên mảng — bỏ các trường tạm (undefined) để Firebase không từ chối.
  function tnClean(arr){ return JSON.parse(JSON.stringify(arr||[])); }
  async function tnTrash(id){
    const c = tnFind(id); if(!c || !tnWriteOk()) return;
    if(!confirm(`Chuyển bài "${c.title}" vào Thùng rác?\n\nLiên kết của học viên sẽ ngừng hoạt động. Khôi phục được từ Thùng rác.`)) return;
    if(await tnUpdate(id, { deleted:true, deletedAt:new Date().toISOString(), deletedByName: tnActor() })){
      const S = tnS(); if(S.editingId===id){ S.view = 'list'; S.editingId = null; }
      showToast('Đã chuyển vào Thùng rác.');
    }
  }
  async function tnRestore(id){ if(await tnUpdate(id, { deleted:false, deletedAt:null, deletedByName:null })) showToast('Đã khôi phục bài tập huấn.'); }
  async function tnPurge(id){
    if(!tnWriteOk()) return;
    const c = tnS().trash.find(x=> x.id===id); if(!c) return;
    if(!confirm(`Xoá VĨNH VIỄN bài "${c.title}" cùng toàn bộ kết quả học tập của học viên?\n\nKhông khôi phục lại được.`)) return;
    try{
      tnMaterials(c).forEach(m=>{ if(m.storagePath && typeof storage!=='undefined'){ try{ storage.ref(m.storagePath).delete().catch(()=>{}); }catch(e){} } });
      await rtdb.ref(`training_learners/${id}`).remove().catch(e=> console.warn('[Tập huấn] Không xoá được kết quả học viên:', e));
      await rtdb.ref(`trainings/${id}`).remove();
      showToast('Đã xoá vĩnh viễn.');
    }catch(e){ alert('Không xoá được: ' + (e && e.message || e)); }
  }

  // =====================================================================
  // GỌI AI — dùng chung cấu hình "CÀI ĐẶT ADMIN → Cấu hình AI". Khác callAIWithFallback ở chỗ hàm này
  // NÉM LỖI khi mọi tầng đều hỏng (để không lưu nhầm câu xin lỗi thành giáo án/câu trả lời), và cho chọn
  // ưu tiên tốc độ (Flash trước — trò chuyện với học viên) hay chất lượng (Pro trước — soạn giáo án).
  // =====================================================================
  async function tnCallAI(messages, opts, onDelta){
    opts = opts || {};
    if(!state.aiProviders || !state.aiProviders.length) await loadAiProviders();
    const ps = (state.aiProviders || []).filter(p=> p && p.apiKey);
    const gem = ps.find(p=> aiVendorOf(p)==='gemini');
    const tries = [];
    if(gem) (opts.quality ? ['gemini-pro-latest','gemini-flash-latest'] : ['gemini-flash-latest','gemini-pro-latest'])
      .forEach(model=> tries.push(()=> callGeminiOnce(gem, model, messages, opts, onDelta)));
    // Hãng khác chỉ đọc được ẢNH đính kèm (không đọc PDF) — vẫn để làm tầng cứu nguy cho phần chữ.
    ps.filter(p=> aiVendorOf(p)!=='gemini').forEach(p=> tries.push(()=> aiVendorOf(p)==='anthropic' ? callAnthropicOnce(p, messages, opts, onDelta) : callOpenAIOnce(p, messages, opts, onDelta)));
    if(!tries.length) throw new Error('Hệ thống chưa được cấu hình AI (Admin cần thêm API Key tại "CÀI ĐẶT ADMIN → Cấu hình AI").');
    let last = null;
    for(const t of tries){
      try{ return await t(); }
      catch(e){ if(e && e.name==='AbortError') throw e; last = e; console.warn('[Tập huấn] Tầng AI lỗi, thử tầng kế tiếp:', e); if(onDelta) onDelta(''); }
    }
    throw last || new Error('AI không phản hồi.');
  }
  function tnParseJson(text){
    let s = String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
    try{ return JSON.parse(s); }catch(e){}
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if(a>=0 && b>a){ try{ return JSON.parse(s.slice(a, b+1)); }catch(e){} }
    return null;
  }
  function tnSetBusy(text){
    tnS().busy = text || '';
    const box = document.getElementById('tn-busy');
    if(box){ box.innerHTML = text ? `<span class="tn-spin" aria-hidden="true"></span>${escapeHtml(text)}` : ''; box.style.display = text ? '' : 'none'; }
  }

  // =====================================================================
  // ĐỌC TÀI LIỆU THÀNH CHỮ. Word/PowerPoint/Excel/văn bản: đọc ngay trên máy (không tốn lượt AI). PDF: đọc
  // lớp chữ bằng pdf.js; PDF scan (không có lớp chữ) và ảnh chụp: nhờ AI đọc (OCR).
  // =====================================================================
  function tnExt(name){ return (String(name||'').split('.').pop()||'').toLowerCase(); }
  function tnKindOf(name, mime){
    const e = tnExt(name);
    if(e==='pdf') return 'pdf';
    if(e==='docx') return 'docx';
    if(e==='pptx') return 'pptx';
    if(['xlsx','xls','csv'].includes(e)) return 'xlsx';
    if(['txt','md'].includes(e)) return 'text';
    if((mime||'').startsWith('image/') || ['jpg','jpeg','png','webp','heic','heif','gif','bmp'].includes(e)) return 'image';
    return 'other';
  }
  const TN_KIND_LABEL = { pdf:'PDF', docx:'Word', pptx:'PowerPoint', xlsx:'Bảng tính', text:'Văn bản', image:'Ảnh chụp', paste:'Văn bản dán vào', other:'Tệp' };
  const TN_KIND_ICON = { pdf:'📕', docx:'📘', pptx:'📙', xlsx:'📗', text:'📄', image:'🖼️', paste:'📝', other:'📎' };
  function tnCleanText(t){ return String(t||'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim(); }
  async function tnPdfText(buf){
    await loadOptionalLibrary('pdfjs');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    const out = [];
    for(let i=1; i<=pdf.numPages; i++){
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      let line = '', lastY = null;
      const lines = [];
      tc.items.forEach(it=>{
        const y = it.transform ? Math.round(it.transform[5]) : null;
        if(lastY!==null && y!==null && Math.abs(y-lastY)>2){ lines.push(line); line = ''; }
        line += it.str + (it.hasEOL ? '\n' : '');
        lastY = y;
      });
      if(line) lines.push(line);
      out.push(`--- Trang ${i} ---\n` + lines.join('\n'));
    }
    return { text: out.join('\n\n'), pages: pdf.numPages };
  }
  async function tnPptxText(buf){
    await loadOptionalLibrary('jszip');
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files).filter(n=> /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a,b)=> parseInt(a.match(/slide(\d+)/i)[1],10) - parseInt(b.match(/slide(\d+)/i)[1],10));
    const out = [];
    for(let i=0; i<slides.length; i++){
      const xml = new DOMParser().parseFromString(await zip.files[slides[i]].async('text'), 'application/xml');
      const paras = Array.from(xml.getElementsByTagNameNS('*','p')).map(p=> Array.from(p.getElementsByTagNameNS('*','t')).map(t=> t.textContent||'').join('')).filter(s=> s.trim());
      const nf = Object.keys(zip.files).find(n=> n.toLowerCase()===`ppt/notesslides/notesslide${i+1}.xml`);
      let notes = '';
      if(nf){
        const nx = new DOMParser().parseFromString(await zip.files[nf].async('text'), 'application/xml');
        notes = Array.from(nx.getElementsByTagNameNS('*','t')).map(t=> t.textContent||'').join(' ').replace(/\s+/g,' ').trim();
      }
      out.push(`--- Slide ${i+1} ---\n${paras.join('\n')}${notes ? `\n(Ghi chú người trình bày: ${notes})` : ''}`);
    }
    return out.join('\n\n');
  }
  async function tnOcr(file, signal){
    const prompt = `Đọc toàn bộ chữ trong tệp đính kèm (tài liệu tập huấn của Hội Nông dân) và chép lại thành văn bản thuần tiếng Việt có dấu.
- Giữ đúng thứ tự, tiêu đề, số thứ tự mục, số liệu, tên văn bản, ngày tháng.
- Bảng biểu: chép thành từng dòng "cột: giá trị". Hình vẽ/sơ đồ có ý nghĩa: mô tả ngắn trong ngoặc vuông.
- Không tóm tắt, không bình luận, không thêm chữ nào ngoài nội dung tệp.`;
    const mimeType = tnExt(file.name)==='pdf' ? 'application/pdf' : (file.type || 'image/jpeg');
    const r = await tnCallAI([{ role:'user', text: prompt }], { attachments:[{ mimeType, base64: await fileToBase64(file) }], signal, quality:true,
      systemPromptOverride:'Bạn là công cụ chép chữ (OCR) chính xác cho tài liệu tiếng Việt.' }, null);
    return r.text;
  }
  async function tnExtractFile(file, onStatus, signal){
    const kind = tnKindOf(file.name, file.type);
    const buf = ['pdf','docx','pptx','xlsx'].includes(kind) ? await file.arrayBuffer() : null;
    if(kind==='docx'){
      await loadOptionalLibrary('mammoth');
      return { kind, via:'local', text: (await mammoth.extractRawText({ arrayBuffer: buf })).value || '' };
    }
    if(kind==='pptx') return { kind, via:'local', text: await tnPptxText(buf) };
    if(kind==='xlsx'){
      await loadOptionalLibrary('xlsx');
      const wb = XLSX.read(buf, { type:'array' });
      return { kind, via:'local', text: wb.SheetNames.map(n=> `--- Trang tính "${n}" ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n') };
    }
    if(kind==='text') return { kind, via:'local', text: await file.text() };
    if(kind==='pdf'){
      let local = null;
      try{ local = await tnPdfText(buf); }catch(e){ console.warn('[Tập huấn] pdf.js không đọc được lớp chữ, chuyển sang AI:', e); }
      // Trung bình dưới 80 ký tự/trang = gần như chắc là bản scan -> nhờ AI đọc.
      if(local && local.text.replace(/---\s*Trang \d+\s*---/g,'').replace(/\s+/g,'').length >= Math.max(80, local.pages*80)) return { kind, via:'local', text: local.text };
      if(file.size > TN_MAX_FILE_MB*1024*1024) throw new Error(`PDF này là bản chụp (scan) và lớn hơn ${TN_MAX_FILE_MB} MB, quá lớn để AI đọc. Đồng chí tách bớt trang rồi tải lại nhé.`);
      if(onStatus) onStatus('AI đang đọc bản PDF chụp (scan)…');
      return { kind, via:'ai', text: await tnOcr(file, signal) };
    }
    if(kind==='image'){
      if(file.size > TN_MAX_FILE_MB*1024*1024) throw new Error(`Ảnh lớn hơn ${TN_MAX_FILE_MB} MB.`);
      if(onStatus) onStatus('AI đang đọc chữ trong ảnh…');
      return { kind, via:'ai', text: await tnOcr(file, signal) };
    }
    if(tnExt(file.name)==='doc' || tnExt(file.name)==='ppt') throw new Error('Đây là định dạng Office đời cũ (.doc/.ppt). Đồng chí mở bằng Word/PowerPoint, lưu lại thành .docx/.pptx (hoặc xuất PDF) rồi tải lên nhé.');
    throw new Error(`Chưa đọc được định dạng ".${tnExt(file.name)}". Dùng PDF, Word, PowerPoint, Excel, ảnh chụp hoặc tệp văn bản.`);
  }
  function tnPickFiles(){
    return new Promise(resolve=>{
      const inp = document.createElement('input');
      inp.type = 'file'; inp.multiple = true;
      inp.accept = '.pdf,.docx,.pptx,.xlsx,.xls,.csv,.txt,.md,image/*';
      inp.onchange = ()=> resolve(Array.from(inp.files||[]));
      inp.click();
    });
  }
  async function tnAddFiles(c, dropped){
    if(!tnWriteOk() || tnS().busy) return;
    const files = dropped && dropped.length ? dropped : await tnPickFiles(); if(!files.length) return;
    let mats = tnMaterials(tnFind(c.id) || c);
    const room = TN_MAX_MATERIALS - mats.length;
    if(room<=0){ alert(`Mỗi bài có tối đa ${TN_MAX_MATERIALS} tài liệu.`); return; }
    const list = files.slice(0, room), failed = [];
    let added = 0;
    for(let i=0; i<list.length; i++){
      const f = list[i], tag = list.length>1 ? ` (${i+1}/${list.length})` : '';
      tnSetBusy(`Đang đọc "${f.name}"${tag}…`);
      try{
        const r = await tnExtractFile(f, s=> tnSetBusy(`${s} "${f.name}"${tag}`));
        let text = tnCleanText(r.text);
        if(text.replace(/\s+/g,'').length < 20) throw new Error('Không đọc được chữ nào trong tệp.');
        const used = mats.reduce((s,m)=> s + String(m.text||'').length, 0);
        const cap = Math.min(TN_MAT_MAX_CHARS, TN_TOTAL_MAX_CHARS - used);
        if(cap < 200) throw new Error(`Bài đã chạm giới hạn ${tnFmtChars(TN_TOTAL_MAX_CHARS)} ký tự tài liệu.`);
        const cut = text.length > cap;
        if(cut) text = text.slice(0, cap);
        const mid = tnItemId('m');
        let storagePath = '';
        // Lưu tệp gốc để cán bộ mở lại khi cần (học viên không cần tệp này). Lỗi thì bỏ qua, phần chữ vẫn giữ.
        if(typeof storage!=='undefined'){
          try{ tnSetBusy(`Đang lưu tệp gốc "${f.name}"${tag}…`); storagePath = `training_files/${c.id}/${mid}_${mtSafeName(f.name)}`; await storage.ref(storagePath).put(f, { contentType: f.type || 'application/octet-stream' }); }
          catch(e){ console.warn('[Tập huấn] Không lưu được tệp gốc (bỏ qua):', e); storagePath = ''; }
        }
        mats = mats.concat([{ id: mid, name: f.name.slice(0,150), kind: r.kind, via: r.via, size: f.size, text, cut: cut || null, storagePath: storagePath || null, addedAt: new Date().toISOString() }]);
        if(!await tnUpdate(c.id, { materials: tnClean(mats) })) break;
        added++;
      }catch(e){
        if(e && e.name==='AbortError') break;
        console.error('[Tập huấn] Đọc tệp lỗi:', f.name, e);
        failed.push(`• ${f.name}: ${e && e.message || e}`);
      }
    }
    tnSetBusy('');
    if(files.length>room) failed.push(`• Bỏ qua ${files.length-room} tệp vì đã đủ ${TN_MAX_MATERIALS} tài liệu.`);
    if(failed.length) alert(`Có tệp chưa đọc được:\n\n${failed.join('\n')}`);
    if(added){
      showToast(`Đã đọc xong ${added} tài liệu.`);
      const cur = tnFind(c.id);
      if(cur && tnLessons(cur).length && confirm('Tài liệu đã thay đổi. Cho AI soạn lại giáo án và câu hỏi theo tài liệu mới không?\n\n(Bấm "Huỷ" để giữ nguyên giáo án hiện tại.)')) tnGeneratePlan(cur, true);
    }
  }
  function tnTextModal(opts){
    return new Promise(resolve=>{
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg tn-font';
      wrap.innerHTML = `<div class="modal" style="max-width:820px;" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${escapeHtml(opts.title)}</h3><button class="modal-close" data-x aria-label="Đóng">✕</button></div>
        <div class="modal-body">
          ${opts.withName ? `<div class="field"><label>Tên tài liệu</label><input id="tnt-name" maxlength="150" value="${escapeHtml(opts.name||'')}" ${opts.readOnly?'disabled':''}></div>` : ''}
          ${opts.hint ? `<p class="mt-hint" style="margin-top:0;">${escapeHtml(opts.hint)}</p>` : ''}
          <textarea id="tnt-text" class="tn-bigtext" maxlength="${TN_MAT_MAX_CHARS}" ${opts.readOnly?'readonly':''} placeholder="${escapeHtml(opts.placeholder||'')}">${escapeHtml(opts.text||'')}</textarea>
          <div class="mt-count" id="tnt-count"></div>
        </div>
        <div class="modal-foot">${opts.extraBtn||''}<button class="btn btn-ghost" data-x>${opts.readOnly ? 'Đóng' : 'Huỷ'}</button>${opts.readOnly ? '' : `<button class="btn btn-primary" id="tnt-ok">${escapeHtml(opts.okLabel||'Lưu')}</button>`}</div>
      </div>`;
      document.body.appendChild(wrap);
      const ta = wrap.querySelector('#tnt-text'), cnt = wrap.querySelector('#tnt-count');
      const upd = ()=>{ cnt.textContent = `${tnFmtChars(ta.value.length)}/${tnFmtChars(TN_MAT_MAX_CHARS)} ký tự`; };
      ta.oninput = upd; upd();
      const done = v=>{ wrap.remove(); resolve(v); };
      wrap.querySelectorAll('[data-x]').forEach(b=> b.onclick = ()=> done(null));
      const ok = wrap.querySelector('#tnt-ok');
      if(ok) ok.onclick = ()=>{
        const text = tnCleanText(ta.value), name = opts.withName ? (wrap.querySelector('#tnt-name').value.trim() || 'Văn bản dán vào') : '';
        if(text.replace(/\s+/g,'').length < 20){ alert('Nội dung quá ngắn.'); return; }
        done({ text, name });
      };
      if(opts.onMount) opts.onMount(wrap, done);
      setTimeout(()=> (opts.withName && !opts.name ? wrap.querySelector('#tnt-name') : ta).focus(), 30);
    });
  }
  async function tnAddPaste(c){
    if(!tnWriteOk()) return;
    const mats = tnMaterials(tnFind(c.id) || c);
    if(mats.length >= TN_MAX_MATERIALS){ alert(`Mỗi bài có tối đa ${TN_MAX_MATERIALS} tài liệu.`); return; }
    const r = await tnTextModal({ title:'📝 Dán hoặc gõ nội dung tập huấn', withName:true, okLabel:'Thêm vào tài liệu',
      hint:'Dán nguyên văn bài giảng, đề cương, văn bản hướng dẫn… AI chỉ giảng trong phạm vi nội dung này.', placeholder:'Dán nội dung vào đây…' });
    if(!r) return;
    const used = mats.reduce((s,m)=> s + String(m.text||'').length, 0);
    if(used + r.text.length > TN_TOTAL_MAX_CHARS){ alert(`Vượt giới hạn ${tnFmtChars(TN_TOTAL_MAX_CHARS)} ký tự tài liệu của một bài. Đồng chí rút gọn bớt nhé.`); return; }
    const next = mats.concat([{ id: tnItemId('m'), name: r.name.slice(0,150), kind:'paste', via:'local', text: r.text, addedAt: new Date().toISOString() }]);
    if(await tnUpdate(c.id, { materials: tnClean(next) })) showToast('Đã thêm tài liệu.');
  }
  async function tnOpenMaterial(c, mid){
    const m = tnMaterials(c).find(x=> x.id===mid); if(!m) return;
    const canEdit = tnCanEdit() && !isTourMode();
    const r = await tnTextModal({ title:`${TN_KIND_ICON[m.kind]||'📄'} ${m.name}`, withName:true, name:m.name, text:m.text, readOnly:!canEdit,
      hint: (m.via==='ai' ? 'Nội dung này do AI đọc từ ảnh/PDF chụp — đồng chí soát lại chữ số, tên riêng cho chắc. ' : '') + 'Đây là đúng những gì AI dùng để giảng cho học viên.',
      extraBtn: m.storagePath ? `<button class="btn btn-ghost" id="tnt-orig" style="margin-right:auto;">📂 Mở tệp gốc</button>` : '',
      onMount: wrap=>{
        const b = wrap.querySelector('#tnt-orig'); if(!b) return;
        b.onclick = async ()=>{
          try{ window.open(await storage.ref(m.storagePath).getDownloadURL(), '_blank', 'noopener'); }
          catch(e){ alert('Không mở được tệp gốc: ' + (e && e.message || e)); }
        };
      } });
    if(!r) return;
    const cur = tnFind(c.id); if(!cur) return;
    const mats = tnMaterials(cur).map(x=> x.id===mid ? { ...x, name: r.name.slice(0,150), text: r.text, editedAt: new Date().toISOString() } : x);
    if(mats.reduce((s,x)=> s + String(x.text||'').length, 0) > TN_TOTAL_MAX_CHARS){ alert(`Vượt giới hạn ${tnFmtChars(TN_TOTAL_MAX_CHARS)} ký tự tài liệu của một bài.`); return; }
    if(await tnUpdate(c.id, { materials: tnClean(mats) })) showToast('Đã lưu nội dung tài liệu.');
  }
  async function tnDeleteMaterial(c, mid){
    if(!tnWriteOk()) return;
    const m = tnMaterials(c).find(x=> x.id===mid); if(!m) return;
    if(!confirm(`Gỡ tài liệu "${m.name}" khỏi bài?`)) return;
    if(await tnUpdate(c.id, { materials: tnClean(tnMaterials(tnFind(c.id)||c).filter(x=> x.id!==mid)) })){
      if(m.storagePath && typeof storage!=='undefined'){ try{ storage.ref(m.storagePath).delete().catch(()=>{}); }catch(e){} }
      showToast('Đã gỡ tài liệu.');
    }
  }

  // =====================================================================
  // AI SOẠN GIÁO ÁN + CÂU HỎI KIỂM TRA từ tài liệu
  // =====================================================================
  function tnMaterialsBlock(c){
    return tnMaterials(c).map((m,i)=> `=== TÀI LIỆU ${i+1}: ${m.name} ===\n${m.text}`).join('\n\n');
  }
  function tnNormQuizItem(q, lessons){
    const options = (Array.isArray(q && q.options) ? q.options : []).map(o=> String(o||'').trim()).filter(Boolean).slice(0,4);
    const answer = parseInt(q && q.answer, 10);
    if(!q || !String(q.q||'').trim() || options.length<2 || !(answer>=0 && answer<options.length)) return null;
    const li = parseInt(q.lesson, 10);
    return { id: tnItemId('q'), q: String(q.q).trim().slice(0,400), options: options.map(o=> o.slice(0,200)), answer,
      explain: String(q.explain||'').trim().slice(0,600), lessonId: (lessons[li-1] && lessons[li-1].id) || null };
  }
  async function tnGeneratePlan(c, silentConfirm){
    if(!tnWriteOk() || tnS().busy) return;
    c = tnFind(c.id) || c;
    if(!tnMaterials(c).length){ alert('Đồng chí đưa tài liệu tập huấn vào trước (mục 1), rồi AI mới soạn được giáo án.'); return; }
    if(!silentConfirm && (tnLessons(c).length || tnQuiz(c).length) && !confirm('AI sẽ soạn lại TOÀN BỘ giáo án và bộ câu hỏi, thay cho bản hiện có (kể cả phần đồng chí đã sửa tay). Tiếp tục?')) return;
    const n = Math.min(TN_MAX_QUIZ, Math.max(tnSettings(c).quizCount * 2, 10));
    const prompt = `Dưới đây là TÀI LIỆU TẬP HUẤN do cán bộ Hội Nông dân cung cấp${c.audience ? ` cho đối tượng: ${c.audience}` : ''}. Hãy đọc thật kỹ toàn bộ và soạn:

1) "summary": tóm tắt cả bộ tài liệu trong 2–3 câu.
2) "lessons": chia nội dung thành từ 2 đến ${Math.min(8, TN_MAX_LESSONS)} phần học theo đúng mạch của tài liệu (tài liệu ngắn thì ít phần). Mỗi phần:
   - "title": tên phần ngắn gọn (tối đa 80 ký tự)
   - "goal": học xong phần này người học hiểu/làm được gì (1–2 câu)
   - "points": 3–7 ý chính cần nắm, mỗi ý một câu, GIỮ NGUYÊN số liệu, tên văn bản, mốc thời gian của tài liệu
3) "quiz": ${n} câu hỏi trắc nghiệm kiểm tra hiểu bài, rải đều các phần. Mỗi câu:
   - "q": câu hỏi rõ ràng, dễ hiểu với bà con nông dân, hỏi vào ý quan trọng chứ không đánh đố câu chữ
   - "options": đúng 4 phương án, các phương án sai phải hợp lý (không lố bịch)
   - "answer": số thứ tự phương án đúng, đếm từ 0
   - "explain": giải thích ngắn vì sao đúng, bám theo tài liệu
   - "lesson": số thứ tự phần (đếm từ 1) mà câu hỏi thuộc về

QUY TẮC: CHỈ dùng thông tin có trong tài liệu, tuyệt đối không bịa thêm quy định, số liệu. Tiếng Việt có dấu, giản dị.
CHỈ trả về đúng MỘT khối JSON hợp lệ, không thêm chữ nào khác, không dùng markdown:
{"summary":"...","lessons":[{"title":"...","goal":"...","points":["..."]}],"quiz":[{"q":"...","options":["...","...","...","..."],"answer":0,"explain":"...","lesson":1}]}

${tnMaterialsBlock(c)}`;
    tnSetBusy('🧠 AI đang đọc kỹ tài liệu và soạn giáo án, câu hỏi kiểm tra… (thường mất 20–60 giây)');
    try{
      const r = await tnCallAI([{ role:'user', text: prompt }], { quality:true, systemPromptOverride:'Bạn là chuyên gia thiết kế bài giảng tập huấn cho cán bộ, hội viên Hội Nông dân Việt Nam. Bạn luôn trả lời bằng JSON hợp lệ khi được yêu cầu.' }, null);
      const j = tnParseJson(r.text);
      if(!j || !Array.isArray(j.lessons) || !j.lessons.length) throw new Error('AI trả về không đúng định dạng giáo án. Đồng chí bấm soạn lại thử nhé.');
      const lessons = j.lessons.slice(0, TN_MAX_LESSONS).map(l=> ({ id: tnItemId('l'), title: String(l.title||'Phần học').trim().slice(0,120), goal: String(l.goal||'').trim().slice(0,400),
        points: (Array.isArray(l.points) ? l.points : []).map(p=> String(p||'').trim().slice(0,300)).filter(Boolean).slice(0,10) }));
      const quiz = (Array.isArray(j.quiz) ? j.quiz : []).map(q=> tnNormQuizItem(q, lessons)).filter(Boolean).slice(0, TN_MAX_QUIZ);
      if(await tnUpdate(c.id, { lessons: tnClean(lessons), quiz: tnClean(quiz), summary: String(j.summary||'').trim().slice(0,1000), planAt: new Date().toISOString() }))
        showToast(`AI đã soạn ${lessons.length} phần học và ${quiz.length} câu hỏi. Đồng chí rà lại nhé.`);
    }catch(e){
      console.error('[Tập huấn] Soạn giáo án lỗi:', e);
      alert('Chưa soạn được giáo án: ' + (e && e.message || e));
    }finally{ tnSetBusy(''); }
  }
  async function tnMoreQuiz(c){
    if(!tnWriteOk() || tnS().busy) return;
    c = tnFind(c.id) || c;
    const lessons = tnLessons(c), quiz = tnQuiz(c);
    if(!lessons.length){ alert('Cần có giáo án trước khi soạn thêm câu hỏi.'); return; }
    if(quiz.length >= TN_MAX_QUIZ){ alert(`Bộ câu hỏi đã đủ ${TN_MAX_QUIZ} câu.`); return; }
    const n = Math.min(5, TN_MAX_QUIZ - quiz.length);
    const prompt = `Soạn THÊM ${n} câu hỏi trắc nghiệm MỚI (không trùng ý với các câu đã có) để kiểm tra hiểu bài, dựa trên tài liệu và giáo án dưới đây. Ưu tiên các phần đang có ít câu hỏi.
Mỗi câu: "q", "options" (đúng 4 phương án), "answer" (số thứ tự phương án đúng, đếm từ 0), "explain", "lesson" (số thứ tự phần, đếm từ 1).
CHỈ trả về JSON: {"quiz":[...]}

GIÁO ÁN:
${lessons.map((l,i)=> `Phần ${i+1}: ${l.title} (đang có ${quiz.filter(q=> q.lessonId===l.id).length} câu)`).join('\n')}

CÁC CÂU ĐÃ CÓ:
${quiz.map(q=> '- '+q.q).join('\n') || '(chưa có)'}

${tnMaterialsBlock(c)}`;
    tnSetBusy('🧠 AI đang soạn thêm câu hỏi…');
    try{
      const r = await tnCallAI([{ role:'user', text: prompt }], { quality:true, systemPromptOverride:'Bạn là chuyên gia ra đề kiểm tra cho các lớp tập huấn Hội Nông dân Việt Nam. Chỉ dùng thông tin trong tài liệu được cung cấp.' }, null);
      const j = tnParseJson(r.text);
      const add = (j && Array.isArray(j.quiz) ? j.quiz : []).map(q=> tnNormQuizItem(q, lessons)).filter(Boolean).slice(0, n);
      if(!add.length) throw new Error('AI chưa trả về câu hỏi hợp lệ, đồng chí thử lại nhé.');
      if(await tnUpdate(c.id, { quiz: tnClean(quiz.concat(add)) })) showToast(`Đã thêm ${add.length} câu hỏi.`);
    }catch(e){ alert('Chưa soạn thêm được: ' + (e && e.message || e)); }
    finally{ tnSetBusy(''); }
  }

  // ---- Sửa tay giáo án ----
  function tnLessonModal(c, lessonId){
    if(!tnWriteOk()) return;
    const lessons = tnLessons(tnFind(c.id)||c);
    const isNew = !lessonId, l = isNew ? { id: tnItemId('l'), title:'', goal:'', points:[] } : lessons.find(x=> x.id===lessonId);
    if(!l) return;
    if(isNew && lessons.length >= TN_MAX_LESSONS){ alert(`Mỗi bài có tối đa ${TN_MAX_LESSONS} phần học.`); return; }
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg tn-font';
    wrap.innerHTML = `<div class="modal" style="max-width:640px;" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${isNew ? '➕ Thêm phần học' : '✏️ Sửa phần học'}</h3><button class="modal-close" data-x aria-label="Đóng">✕</button></div>
      <div class="modal-body">
        <div class="field">${mtLabel('Tên phần', true)}<input id="tnl-title" maxlength="120" value="${escapeHtml(l.title)}"></div>
        <div class="field">${mtLabel('Mục tiêu', false, '— học xong phần này người học hiểu/làm được gì')}<textarea id="tnl-goal" rows="2" maxlength="400">${escapeHtml(l.goal||'')}</textarea></div>
        <div class="field">${mtLabel('Ý chính cần nắm', false, '— mỗi dòng một ý')}<textarea id="tnl-points" rows="7" maxlength="3000">${escapeHtml((l.points||[]).join('\n'))}</textarea></div>
        <p class="mt-hint">AI bám theo các ý chính này để giảng và để chấm xem học viên đã nắm phần này chưa. Nội dung giảng vẫn lấy từ tài liệu.</p>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" data-x>Huỷ</button><button class="btn btn-primary" id="tnl-ok">Lưu</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelectorAll('[data-x]').forEach(b=> b.onclick = close);
    setTimeout(()=> wrap.querySelector('#tnl-title').focus(), 30);
    wrap.querySelector('#tnl-ok').onclick = async ()=>{
      const title = wrap.querySelector('#tnl-title').value.trim();
      if(!title){ alert('Vui lòng nhập tên phần.'); return; }
      const next = { ...l, title, goal: wrap.querySelector('#tnl-goal').value.trim(), points: wrap.querySelector('#tnl-points').value.split('\n').map(s=> s.trim().replace(/^[-•*]\s*/,'')).filter(Boolean).slice(0,12) };
      const cur = tnLessons(tnFind(c.id)||c);
      const list = isNew ? cur.concat([next]) : cur.map(x=> x.id===l.id ? next : x);
      if(await tnUpdate(c.id, { lessons: tnClean(list) })){ close(); mtFlashSaved(); }
    };
  }
  async function tnLessonDelete(c, id){
    if(!tnWriteOk()) return;
    const cur = tnFind(c.id)||c, l = tnLessons(cur).find(x=> x.id===id); if(!l) return;
    const nq = tnQuiz(cur).filter(q=> q.lessonId===id).length;
    if(!confirm(`Xoá phần "${l.title}"?${nq ? `\n\n${nq} câu hỏi của phần này vẫn được giữ lại (không gắn với phần nào).` : ''}`)) return;
    const quiz = tnQuiz(cur).map(q=> q.lessonId===id ? { ...q, lessonId:null } : q);
    if(await tnUpdate(c.id, { lessons: tnClean(tnLessons(cur).filter(x=> x.id!==id)), quiz: tnClean(quiz) })) mtFlashSaved();
  }
  async function tnLessonStep(c, id, dir){
    if(!tnWriteOk()) return;
    const list = tnLessons(tnFind(c.id)||c), i = list.findIndex(x=> x.id===id), j = i+dir;
    if(i<0 || j<0 || j>=list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    if(await tnUpdate(c.id, { lessons: tnClean(list) })) mtFlashSaved();
  }
  // ---- Sửa tay câu hỏi ----
  function tnQuizModal(c, qid){
    if(!tnWriteOk()) return;
    const cur = tnFind(c.id)||c, quiz = tnQuiz(cur), lessons = tnLessons(cur);
    const isNew = !qid, q = isNew ? { id: tnItemId('q'), q:'', options:['','','',''], answer:0, explain:'', lessonId:null } : quiz.find(x=> x.id===qid);
    if(!q) return;
    if(isNew && quiz.length >= TN_MAX_QUIZ){ alert(`Bộ câu hỏi có tối đa ${TN_MAX_QUIZ} câu.`); return; }
    const opts = q.options.concat(['','','','']).slice(0,4);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg tn-font';
    wrap.innerHTML = `<div class="modal" style="max-width:640px;" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${isNew ? '➕ Thêm câu hỏi' : '✏️ Sửa câu hỏi'}</h3><button class="modal-close" data-x aria-label="Đóng">✕</button></div>
      <div class="modal-body">
        <div class="field">${mtLabel('Câu hỏi', true)}<textarea id="tnq-q" rows="2" maxlength="400">${escapeHtml(q.q)}</textarea></div>
        <div class="field"><label>Các phương án <span class="mt-hint">— chấm tròn vào phương án ĐÚNG; để trống ô thừa nếu chỉ cần 2–3 phương án</span></label>
          ${opts.map((o,i)=>`<label class="tn-opt-row"><input type="radio" name="tnq-ans" value="${i}" ${q.answer===i?'checked':''}><span class="tn-opt-letter">${'ABCD'[i]}</span><input class="tnq-opt" maxlength="200" value="${escapeHtml(o)}" placeholder="Phương án ${'ABCD'[i]}"></label>`).join('')}
        </div>
        <div class="field">${mtLabel('Giải thích', false, '— hiện cho học viên sau khi nộp bài')}<textarea id="tnq-explain" rows="2" maxlength="600">${escapeHtml(q.explain||'')}</textarea></div>
        <div class="field"><label>Thuộc phần</label><select id="tnq-lesson"><option value="">(Không gắn với phần nào)</option>${lessons.map((l,i)=>`<option value="${escapeHtml(l.id)}" ${q.lessonId===l.id?'selected':''}>Phần ${i+1}: ${escapeHtml(l.title)}</option>`).join('')}</select></div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" data-x>Huỷ</button><button class="btn btn-primary" id="tnq-ok">Lưu</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelectorAll('[data-x]').forEach(b=> b.onclick = close);
    wrap.querySelector('#tnq-ok').onclick = async ()=>{
      const text = wrap.querySelector('#tnq-q').value.trim();
      const raw = Array.from(wrap.querySelectorAll('.tnq-opt')).map(x=> x.value.trim());
      const ansRaw = parseInt((wrap.querySelector('input[name="tnq-ans"]:checked')||{}).value, 10);
      if(!text){ alert('Vui lòng nhập câu hỏi.'); return; }
      if(!raw[ansRaw]){ alert('Phương án được chọn là đúng đang để trống.'); return; }
      const options = [], answerMap = {};
      raw.forEach((o,i)=>{ if(o){ answerMap[i] = options.length; options.push(o); } });
      if(options.length < 2){ alert('Cần ít nhất 2 phương án.'); return; }
      const next = { ...q, q:text, options, answer: answerMap[ansRaw], explain: wrap.querySelector('#tnq-explain').value.trim(), lessonId: wrap.querySelector('#tnq-lesson').value || null };
      const now = tnQuiz(tnFind(c.id)||c);
      const list = isNew ? now.concat([next]) : now.map(x=> x.id===q.id ? next : x);
      if(await tnUpdate(c.id, { quiz: tnClean(list) })){ close(); mtFlashSaved(); }
    };
  }
  async function tnQuizDelete(c, id){
    if(!tnWriteOk()) return;
    if(!confirm('Xoá câu hỏi này?')) return;
    if(await tnUpdate(c.id, { quiz: tnClean(tnQuiz(tnFind(c.id)||c).filter(x=> x.id!==id)) })) mtFlashSaved();
  }

  // =====================================================================
  // MÀN HÌNH CHÍNH CỦA MODULE
  // =====================================================================
  function renderTrainingTab(el){
    if(!el) return;
    tnAttach();
    const S = tnS();
    if(S.view==='editor' && tnFind(S.editingId)) tnRenderEditor(el);
    else { S.view = 'list'; S.editingId = null; tnDetachLearners(); tnRenderList(el); }
  }
  function tnStatusPill(c){
    const st = tnStatus(c);
    return `<span class="tn-pill tn-pill-${st.key}">${st.open ? '●' : '○'} ${escapeHtml(st.key==='open' ? 'Đang mở' : st.label)}</span>`;
  }
  function tnRenderList(el){
    const S = tnS(), isShared = S.space!=='personal';
    const canView = tnCanView(), canEdit = tnCanEdit();
    el.innerHTML = `
      <div class="tn-hero">
        <div class="tn-hero-ico" aria-hidden="true">🎓</div>
        <div class="tn-hero-txt">
          <h3>Tập huấn bằng AI</h3>
          <p>Soạn bài một lần — mỗi học viên được AI kèm riêng qua một đường liên kết.</p>
        </div>
        <ol class="tn-hero-steps" aria-label="Các bước">
          <li><b>1</b>Đưa tài liệu</li><li><b>2</b>AI soạn giáo án</li><li><b>3</b>Gửi link</li><li><b>4</b>Xem kết quả</li>
        </ol>
      </div>
      <div class="panel">
        <div class="panel-body">
          <div style="margin-bottom:14px;">${surveyTabsHtml([
            { id:'tn-space-shared', label:`🏛️ Bộ nhớ dùng chung ${adminLevelLabelLower()}`, active:isShared },
            { id:'tn-space-personal', label:'🔒 Bộ nhớ cá nhân', active:!isShared },
          ])}</div>
          ${!canView ? `<div class="empty-state" style="padding:30px;"><div class="e-ico">🔒</div>${isShared
              ? (wardId() ? 'Đồng chí chưa được cấp quyền xem Tập huấn dùng chung. Vui lòng liên hệ Chủ mã để được cấp quyền tại "Cài đặt & Chia sẻ".' : `Tập huấn dùng chung cần vào bằng mã ${adminLevelLabelLower()}.`)
              : 'Tập huấn cá nhân yêu cầu đăng nhập bằng tài khoản Google.'}</div>` : `
          <div class="mt-toolbar">
            ${canEdit ? `<button class="btn btn-primary preview-allow" id="tn-new-btn">➕ Soạn bài tập huấn mới</button>` : `<span class="mt-hint">Đồng chí chỉ có quyền xem ở đây.</span>`}
            <input id="tn-q" value="${escapeHtml(S.q)}" placeholder="🔍 Tìm theo tên bài…" autocomplete="off">
          </div>
          <div id="tn-list"></div>`}
        </div>
      </div>
      ${canView ? `<div id="tn-trash"></div>` : ''}`;
    const sh = el.querySelector('#tn-space-shared'); if(sh) sh.onclick = ()=> tnSwitchSpace('shared');
    const pe = el.querySelector('#tn-space-personal'); if(pe) pe.onclick = ()=> tnSwitchSpace('personal');
    const nb = el.querySelector('#tn-new-btn'); if(nb) nb.onclick = ()=> tnNewModal(el);
    const q = el.querySelector('#tn-q'); if(q) q.oninput = ()=>{ S.q = q.value; tnPaintList(el); };
    if(canView) tnPaintList(el);
  }
  function tnPaintList(el){
    const S = tnS(), box = el.querySelector('#tn-list'); if(!box) return;
    const canEdit = tnCanEdit(), term = surveyFold(String(S.q||'').trim());
    const list = S.list.filter(c=> !term || surveyFold(c.title||'').includes(term))
      .sort((a,b)=> String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
    if(S.error) box.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="e-ico">⚠️</div>${escapeHtml(S.error)}</div>`;
    else if(!S.loaded) box.innerHTML = `<div class="empty-state" style="padding:24px;">Đang tải danh sách bài tập huấn…</div>`;
    else if(!list.length) box.innerHTML = S.list.length ? `<div class="empty-state" style="padding:30px;"><div class="e-ico">🔎</div>Không có bài nào khớp với từ khoá.</div>` : `
      <div class="tn-empty">
        <div class="tn-empty-ico">📚</div>
        <h4>Chưa có bài tập huấn nào</h4>
        <p>${canEdit ? 'Bấm <b>“Soạn bài tập huấn mới”</b>, đưa tài liệu vào (PDF, Word, PowerPoint, ảnh chụp…) — AI sẽ đọc và soạn giáo án, câu hỏi kiểm tra để đồng chí rà lại trước khi gửi cho học viên.' : 'Khi cán bộ soạn bài, danh sách sẽ hiện ở đây.'}</p>
      </div>`;
    else box.innerHTML = `<div class="tn-cards">${list.map(c=>{
      const nl = tnLessons(c).length, nq = tnQuiz(c).length, nm = tnMaterials(c).length;
      return `<div class="tn-card">
        <button type="button" class="tn-card-main preview-allow" data-tn-open="${escapeHtml(c.id)}">
          <span class="tn-card-title">${escapeHtml(c.title||'Bài tập huấn')}</span>
          ${c.audience ? `<span class="tn-card-meta">👥 ${escapeHtml(c.audience)}</span>` : ''}
          <span class="tn-card-meta">📚 ${nm} tài liệu · 🧭 ${nl} phần học · ❓ ${nq} câu hỏi ${tnStatusPill(c)}</span>
        </button>
        <div class="tn-card-actions">
          <button class="btn btn-ghost btn-sm preview-allow" data-tn-open="${escapeHtml(c.id)}">${canEdit ? '✏️ Mở / Sửa' : '👁 Xem'}</button>
          <button class="btn btn-ghost btn-sm preview-allow" data-tn-results="${escapeHtml(c.id)}">📈 Kết quả</button>
          <button class="btn btn-ghost btn-sm preview-allow" data-tn-copy="${escapeHtml(c.id)}">🔗 Sao chép link</button>
          ${canEdit ? `<button class="btn btn-ghost btn-sm preview-allow" data-tn-trash="${escapeHtml(c.id)}" style="color:var(--red);">Xoá</button>` : ''}
        </div>
      </div>`; }).join('')}</div>`;
    const open = (id, tab)=>{ S.view = 'editor'; S.editingId = id; S.tab = tab || 'build'; renderTrainingTab(el); window.scrollTo(0,0); };
    box.querySelectorAll('[data-tn-open]').forEach(b=> b.onclick = ()=> open(b.dataset.tnOpen));
    box.querySelectorAll('[data-tn-results]').forEach(b=> b.onclick = ()=> open(b.dataset.tnResults, 'results'));
    box.querySelectorAll('[data-tn-copy]').forEach(b=> b.onclick = ()=>{ const c = tnFind(b.dataset.tnCopy); if(c && !tnStatus(c).open) showToast('Lưu ý: liên kết đang ' + tnStatus(c).label.toLowerCase() + '.'); copyMessageText(tnShareUrl(b.dataset.tnCopy)); });
    box.querySelectorAll('[data-tn-trash]').forEach(b=> b.onclick = ()=> tnTrash(b.dataset.tnTrash));
    tnPaintTrash(el);
  }
  function tnPaintTrash(el){
    const S = tnS(), box = el.querySelector('#tn-trash'); if(!box) return;
    if(!S.trash.length){ box.innerHTML = ''; return; }
    const canEdit = tnCanEdit();
    box.innerHTML = `<details class="panel mt-trash"><summary>🗑️ Thùng rác (${S.trash.length})</summary>
      <div class="panel-body">${S.trash.map(c=>`<div class="mt-trash-row">
        <div><b>${escapeHtml(c.title||'Bài tập huấn')}</b><div class="mt-hint">Xoá lúc ${escapeHtml(tnFmtIso(c.deletedAt))}${c.deletedByName ? ' · bởi '+escapeHtml(c.deletedByName) : ''}</div></div>
        ${canEdit ? `<div class="mt-trash-actions"><button class="btn btn-ghost btn-sm" data-tn-restore="${escapeHtml(c.id)}">↩️ Khôi phục</button><button class="btn btn-ghost btn-sm" data-tn-purge="${escapeHtml(c.id)}" style="color:var(--red);">Xoá vĩnh viễn</button></div>` : ''}
      </div>`).join('')}</div></details>`;
    box.querySelectorAll('[data-tn-restore]').forEach(b=> b.onclick = ()=> tnRestore(b.dataset.tnRestore));
    box.querySelectorAll('[data-tn-purge]').forEach(b=> b.onclick = ()=> tnPurge(b.dataset.tnPurge));
  }
  function tnNewModal(el){
    if(!tnWriteOk()) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg tn-font';
    wrap.innerHTML = `<div class="modal" style="max-width:540px;" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>➕ Soạn bài tập huấn mới</h3><button class="modal-close" data-x aria-label="Đóng">✕</button></div>
      <div class="modal-body">
        <div class="field">${mtLabel('Tên bài tập huấn', true)}<input id="tnn-title" maxlength="${TN_TITLE_MAX}" placeholder="VD: Kỹ thuật bón phân cân đối cho lúa">${mtCounterHtml('tnn-title', '', TN_TITLE_MAX)}</div>
        <div class="field">${mtLabel('Dành cho ai', false, '— giúp AI chọn cách giảng phù hợp')}<input id="tnn-aud" maxlength="${TN_AUDIENCE_MAX}" placeholder="VD: Hội viên trồng lúa, nhiều người lớn tuổi"></div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" data-x>Huỷ</button><button class="btn btn-primary" id="tnn-ok">Tạo và đưa tài liệu vào ›</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelectorAll('[data-x]').forEach(b=> b.onclick = close);
    mtWireCounters(wrap);
    const t = wrap.querySelector('#tnn-title'); setTimeout(()=> t.focus(), 30);
    const ok = wrap.querySelector('#tnn-ok');
    ok.onclick = async ()=>{
      const title = t.value.trim().slice(0, TN_TITLE_MAX);
      if(!title){ alert('Vui lòng nhập tên bài tập huấn.'); t.focus(); return; }
      ok.disabled = true;
      try{
        const rec = await tnCreate({ title, audience: wrap.querySelector('#tnn-aud').value.trim().slice(0, TN_AUDIENCE_MAX) });
        if(!rec){ ok.disabled = false; return; }
        close();
        const S = tnS();
        if(!tnFind(rec.id)) S.list = S.list.concat([rec]);
        S.view = 'editor'; S.editingId = rec.id; S.tab = 'build';
        renderTrainingTab(el); window.scrollTo(0,0);
      }catch(e){
        console.error('[Tập huấn] Tạo bài lỗi:', e);
        alert('Không tạo được bài tập huấn: ' + (e && e.message || e));
        ok.disabled = false;
      }
    };
  }

  // ---- Trình soạn một bài ----
  function tnRenderEditor(el){
    const S = tnS(), c = tnFind(S.editingId);
    const canEdit = tnCanEdit(), ro = canEdit ? '' : 'disabled';
    tnAttachLearners(c.id);
    el.innerHTML = `
      <div class="panel tn-editor">
        <div class="panel-head mt-editor-head"><h3>🎓 ${escapeHtml(c.title||'Bài tập huấn')}</h3><span id="mt-saved" class="mt-saved"></span></div>
        <div class="panel-body">
          <div class="mt-editor-bar">
            <button class="btn btn-ghost btn-sm btn-back-list preview-allow" id="tn-back">← Danh sách bài tập huấn</button>
            <div class="mt-editor-bar-right">
              <button class="btn btn-ghost btn-sm preview-allow" id="tn-try">🧑‍🎓 Học thử như học viên</button>
              <button class="btn btn-primary btn-sm preview-allow" id="tn-share-top">🔗 Gửi cho học viên</button>
            </div>
          </div>
          <div id="tn-steps"></div>
          <div id="tn-busy" class="tn-busy" style="${S.busy ? '' : 'display:none;'}">${S.busy ? `<span class="tn-spin" aria-hidden="true"></span>${escapeHtml(S.busy)}` : ''}</div>
          <div style="margin:6px 0 16px;">${surveyTabsHtml([
            { id:'tn-tab-build', label:'📚 Soạn bài', active:S.tab==='build' },
            { id:'tn-tab-share', label:'🔗 Chia sẻ cho học viên', active:S.tab==='share' },
            { id:'tn-tab-results', label:`📈 Kết quả học tập (${S.learners.length})`, active:S.tab==='results' },
          ])}</div>
          <div id="tn-pane-build" style="${S.tab==='build' ? '' : 'display:none;'}">
            <div class="divider-lbl">Thông tin bài</div>
            <div class="mt-info-grid">
              <div class="field mt-span-2">${mtLabel('Tên bài tập huấn', true)}<input id="tn-f-title" maxlength="${TN_TITLE_MAX}" value="${escapeHtml(c.title||'')}" ${ro}>${canEdit ? mtCounterHtml('tn-f-title', c.title, TN_TITLE_MAX) : ''}</div>
              <div class="field mt-span-2">${mtLabel('Dành cho ai', false)}<input id="tn-f-aud" maxlength="${TN_AUDIENCE_MAX}" value="${escapeHtml(c.audience||'')}" ${ro} placeholder="VD: Hội viên trồng lúa, nhiều người lớn tuổi"></div>
              <div class="field mt-span-2">${mtLabel('Lời giới thiệu cho học viên', false, '— hiện ở trang đầu khi học viên mở link')}<textarea id="tn-f-intro" rows="2" maxlength="${TN_INTRO_MAX}" ${ro}>${escapeHtml(c.intro||'')}</textarea>${canEdit ? mtCounterHtml('tn-f-intro', c.intro, TN_INTRO_MAX) : ''}</div>
            </div>
            <div class="tn-sec">
              <div class="tn-sec-head"><span class="tn-sec-num">1</span><div><h4>Tài liệu tập huấn</h4><p>Nguồn kiến thức DUY NHẤT của AI khi giảng — ngoài phạm vi này AI sẽ từ chối và gợi ý hỏi cán bộ Hội.</p></div></div>
              ${canEdit ? `<div class="mt-doc-add">
                <button class="btn btn-primary btn-sm" id="tn-add-files">⬆️ Tải tài liệu lên</button>
                <button class="btn btn-ghost btn-sm" id="tn-add-paste">📝 Dán văn bản</button>
                <span class="mt-hint">PDF, Word, PowerPoint, Excel, ảnh chụp tài liệu giấy. Mỗi bài tối đa ${TN_MAX_MATERIALS} tài liệu, ${tnFmtChars(TN_TOTAL_MAX_CHARS)} ký tự.</span>
              </div>` : ''}
              <div id="tn-mats"></div>
            </div>
            <div class="tn-sec">
              <div class="tn-sec-head"><span class="tn-sec-num">2</span><div><h4>Giáo án</h4><p>Các phần học AI sẽ giảng lần lượt. Học viên đã biết phần nào thì AI lướt nhanh, chưa biết thì giảng kỹ.</p></div></div>
              <div id="tn-lessons"></div>
            </div>
            <div class="tn-sec">
              <div class="tn-sec-head"><span class="tn-sec-num">3</span><div><h4>Bài kiểm tra cuối</h4><p>Học xong các phần, học viên làm bài trắc nghiệm. Mỗi lượt lấy ngẫu nhiên từ bộ câu hỏi, đảo thứ tự phương án.</p></div></div>
              <div id="tn-quiz"></div>
            </div>
          </div>
          <div id="tn-pane-share" style="${S.tab==='share' ? '' : 'display:none;'}"></div>
          <div id="tn-pane-results" style="${S.tab==='results' ? '' : 'display:none;'}"></div>
        </div>
      </div>`;
    el.querySelector('#tn-back').onclick = ()=>{ S.view = 'list'; S.editingId = null; renderTrainingTab(el); };
    el.querySelector('#tn-try').onclick = ()=>{ const x = tnFind(S.editingId); if(x) tnOpenPreview(x); };
    const goTab = t=>{ S.tab = t; ['build','share','results'].forEach(k=>{ el.querySelector('#tn-pane-'+k).style.display = k===t ? '' : 'none'; const b = el.querySelector('#tn-tab-'+k); b.classList.toggle('active', k===t); b.setAttribute('aria-selected', k===t ? 'true':'false'); }); tnPaintEditorParts(el); };
    el.querySelector('#tn-share-top').onclick = ()=> goTab('share');
    ['build','share','results'].forEach(k=> el.querySelector('#tn-tab-'+k).onclick = ()=> goTab(k));
    const bindField = (sel, key, max, required)=>{
      const inp = el.querySelector(sel); if(!inp || !canEdit) return;
      inp.onchange = async ()=>{
        const cur = tnFind(S.editingId); if(!cur) return;
        const v = inp.value.trim().slice(0, max);
        if(required && !v){ alert('Tên bài không được để trống.'); inp.value = cur[key]||''; return; }
        if((cur[key]||'')===v) return;
        if(await tnUpdate(cur.id, { [key]: v })){
          mtFlashSaved();
          if(key==='title'){ const h = el.querySelector('.mt-editor-head h3'); if(h) h.textContent = '🎓 ' + v; }
        }
      };
    };
    mtWireCounters(el);
    bindField('#tn-f-title', 'title', TN_TITLE_MAX, true);
    bindField('#tn-f-aud', 'audience', TN_AUDIENCE_MAX);
    bindField('#tn-f-intro', 'intro', TN_INTRO_MAX);
    const af = el.querySelector('#tn-add-files'); if(af) af.onclick = ()=>{ const x = tnFind(S.editingId); if(x) tnAddFiles(x); };
    const ap = el.querySelector('#tn-add-paste'); if(ap) ap.onclick = ()=>{ const x = tnFind(S.editingId); if(x) tnAddPaste(x); };
    tnPaintEditorParts(el);
  }
  function tnPaintEditorParts(el){
    const S = tnS(), c = tnFind(S.editingId); if(!c) return;
    tnPaintSteps(el, c);
    if(S.tab==='build'){ tnPaintMaterials(el, c); tnPaintLessons(el, c); tnPaintQuiz(el, c); }
    else if(S.tab==='share') tnPaintShare(el, c);
    else if(S.tab==='results') tnPaintResults(el, c);
  }
  // Dải 4 bước ở đầu trình soạn: nhìn là biết bài đã sẵn sàng gửi cho học viên chưa.
  function tnPaintSteps(el, c){
    const box = el.querySelector('#tn-steps'); if(!box) return;
    const nm = tnMaterials(c).length, nl = tnLessons(c).length, nq = tnQuiz(c).length, st = tnStatus(c), nLearn = tnS().learners.length;
    const steps = [
      { ok: nm>0, t:'Tài liệu', d: nm ? `${nm} tài liệu · ${tnFmtChars(tnTotalChars(c))} ký tự` : 'Chưa có tài liệu' },
      { ok: nl>0, t:'Giáo án', d: nl ? `${nl} phần học` : 'Chưa soạn' },
      { ok: nq>0, t:'Câu hỏi kiểm tra', d: nq ? `${nq} câu · mỗi lượt ${Math.min(nq, tnSettings(c).quizCount)} câu` : 'Chưa có (không bắt buộc)', optional:true },
      { ok: st.open, t:'Liên kết học viên', d: st.open ? `Đang mở · ${nLearn} người đã vào học` : st.label },
    ];
    box.innerHTML = `<ol class="tn-steps">${steps.map((s,i)=>`<li class="${s.ok ? 'ok' : (s.optional ? 'opt' : '')}"><span class="tn-step-dot">${s.ok ? '✓' : i+1}</span><span><b>${escapeHtml(s.t)}</b><small>${escapeHtml(s.d)}</small></span></li>`).join('')}</ol>`;
  }
  function tnPaintMaterials(el, c){
    const box = el.querySelector('#tn-mats'); if(!box) return;
    const canEdit = tnCanEdit(), mats = tnMaterials(c), total = tnTotalChars(c);
    if(!mats.length){
      box.innerHTML = `<div class="tn-drop ${canEdit ? '' : 'ro'}" id="tn-drop"><div class="tn-drop-ico">📥</div><b>${canEdit ? 'Kéo thả tài liệu vào đây, hoặc bấm “Tải tài liệu lên”' : 'Chưa có tài liệu.'}</b>${canEdit ? '<span>Văn bản hướng dẫn, đề cương bài giảng, slide trình chiếu, ảnh chụp tài liệu giấy… đều được.</span>' : ''}</div>`;
    } else {
      const pct = Math.min(100, Math.round(total/TN_TOTAL_MAX_CHARS*100));
      box.innerHTML = `<div class="tn-mats" id="tn-drop">${mats.map(m=>`
        <div class="tn-mat">
          <span class="tn-mat-ico" aria-hidden="true">${TN_KIND_ICON[m.kind]||'📄'}</span>
          <button type="button" class="tn-mat-main preview-allow" data-tn-mat="${escapeHtml(m.id)}">
            <b>${escapeHtml(m.name)}</b>
            <small>${escapeHtml(TN_KIND_LABEL[m.kind]||'Tệp')} · ${tnFmtChars(String(m.text||'').length)} ký tự${m.via==='ai' ? ' · <span class="tn-tag-ai">AI đọc từ ảnh/scan</span>' : ''}${m.cut ? ' · <span class="tn-tag-warn">đã cắt bớt cho vừa giới hạn</span>' : ''}</small>
          </button>
          <div class="tn-mat-act">
            <button class="btn btn-ghost btn-sm preview-allow" data-tn-mat="${escapeHtml(m.id)}">${canEdit ? '✏️ Xem / sửa chữ' : '👁 Xem'}</button>
            ${canEdit ? `<button class="btn btn-ghost btn-sm" data-tn-mat-del="${escapeHtml(m.id)}" style="color:var(--red);" title="Gỡ tài liệu">✕</button>` : ''}
          </div>
        </div>`).join('')}
        <div class="tn-meter" title="Dung lượng tài liệu đã dùng"><span style="width:${pct}%;"></span></div>
        <div class="mt-hint" style="text-align:right;">Đã dùng ${tnFmtChars(total)}/${tnFmtChars(TN_TOTAL_MAX_CHARS)} ký tự</div>
      </div>`;
    }
    box.querySelectorAll('[data-tn-mat]').forEach(b=> b.onclick = ()=> tnOpenMaterial(c, b.dataset.tnMat));
    box.querySelectorAll('[data-tn-mat-del]').forEach(b=> b.onclick = ()=> tnDeleteMaterial(c, b.dataset.tnMatDel));
    const drop = box.querySelector('#tn-drop');
    if(drop && canEdit && !isTourMode()){
      drop.ondragover = e=>{ e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = ()=> drop.classList.remove('over');
      drop.ondrop = async e=>{
        e.preventDefault(); drop.classList.remove('over');
        const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
        if(files.length) tnAddFiles(tnFind(c.id) || c, files);
      };
    }
  }
  function tnPaintLessons(el, c){
    const box = el.querySelector('#tn-lessons'); if(!box) return;
    const canEdit = tnCanEdit(), lessons = tnLessons(c), hasMats = tnMaterials(c).length>0;
    const genBtn = canEdit ? `<button class="btn ${lessons.length ? 'btn-ghost' : 'btn-primary'} btn-sm" id="tn-gen" ${hasMats ? '' : 'disabled title="Cần đưa tài liệu vào trước"'}>🧠 ${lessons.length ? 'Cho AI soạn lại giáo án' : 'Cho AI đọc tài liệu và soạn giáo án'}</button>` : '';
    box.innerHTML = `
      ${c.summary ? `<div class="tn-summary"><b>🧠 AI tóm tắt tài liệu:</b> ${escapeHtml(c.summary)}</div>` : ''}
      ${lessons.length ? `<ol class="tn-lessons">${lessons.map((l,i)=>`
        <li class="tn-lesson">
          <div class="tn-lesson-num">${i+1}</div>
          <div class="tn-lesson-main">
            <b>${escapeHtml(l.title)}</b>
            ${l.goal ? `<div class="tn-lesson-goal">🎯 ${escapeHtml(l.goal)}</div>` : ''}
            ${l.points.length ? `<ul>${l.points.map(p=>`<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
          </div>
          ${canEdit ? `<div class="tn-lesson-act">
            <button class="btn btn-ghost btn-sm" data-tn-l-up="${escapeHtml(l.id)}" ${i===0?'disabled':''} title="Lên">▲</button>
            <button class="btn btn-ghost btn-sm" data-tn-l-down="${escapeHtml(l.id)}" ${i===lessons.length-1?'disabled':''} title="Xuống">▼</button>
            <button class="btn btn-ghost btn-sm" data-tn-l-edit="${escapeHtml(l.id)}">✏️ Sửa</button>
            <button class="btn btn-ghost btn-sm" data-tn-l-del="${escapeHtml(l.id)}" style="color:var(--red);" title="Xoá phần">✕</button>
          </div>` : ''}
        </li>`).join('')}</ol>` : `<div class="tn-placeholder">${hasMats ? 'Tài liệu đã sẵn sàng. Bấm nút bên dưới để AI đọc kỹ và chia thành các phần học, kèm mục tiêu và ý chính của từng phần.' : 'Đưa tài liệu vào ở mục 1 trước, sau đó AI sẽ soạn giáo án tại đây.'}</div>`}
      ${canEdit ? `<div class="mt-doc-add" style="margin-top:10px;">${genBtn}${lessons.length ? `<button class="btn btn-ghost btn-sm" id="tn-l-add">➕ Thêm phần</button>` : ''}</div>` : ''}`;
    const g = box.querySelector('#tn-gen'); if(g) g.onclick = ()=> tnGeneratePlan(c);
    const a = box.querySelector('#tn-l-add'); if(a) a.onclick = ()=> tnLessonModal(c);
    box.querySelectorAll('[data-tn-l-edit]').forEach(b=> b.onclick = ()=> tnLessonModal(c, b.dataset.tnLEdit));
    box.querySelectorAll('[data-tn-l-del]').forEach(b=> b.onclick = ()=> tnLessonDelete(c, b.dataset.tnLDel));
    box.querySelectorAll('[data-tn-l-up]').forEach(b=> b.onclick = ()=> tnLessonStep(c, b.dataset.tnLUp, -1));
    box.querySelectorAll('[data-tn-l-down]').forEach(b=> b.onclick = ()=> tnLessonStep(c, b.dataset.tnLDown, 1));
  }
  function tnPaintQuiz(el, c){
    const box = el.querySelector('#tn-quiz'); if(!box) return;
    const canEdit = tnCanEdit(), ro = canEdit ? '' : 'disabled', quiz = tnQuiz(c), lessons = tnLessons(c), st = tnSettings(c);
    const lessonNo = id=>{ const i = lessons.findIndex(l=> l.id===id); return i>=0 ? `Phần ${i+1}` : ''; };
    box.innerHTML = `
      <div class="tn-quiz-set">
        <label>Mỗi lượt kiểm tra <input type="number" id="tn-s-count" min="3" max="20" value="${st.quizCount}" ${ro}> câu</label>
        <label>Đạt khi đúng từ <input type="number" id="tn-s-pass" min="30" max="100" step="5" value="${st.passPercent}" ${ro}> %</label>
      </div>
      ${quiz.length ? `<div class="tn-quiz-list">${quiz.map((q,i)=>`
        <details class="tn-q">
          <summary><span class="tn-q-no">${i+1}</span><span class="tn-q-text">${escapeHtml(q.q)}</span>${lessonNo(q.lessonId) ? `<span class="tn-q-les">${escapeHtml(lessonNo(q.lessonId))}</span>` : ''}</summary>
          <ol class="tn-q-opts">${q.options.map((o,k)=>`<li class="${k===q.answer?'right':''}">${'ABCD'[k]}. ${escapeHtml(o)}${k===q.answer?' ✓':''}</li>`).join('')}</ol>
          ${q.explain ? `<div class="tn-q-exp">💡 ${escapeHtml(q.explain)}</div>` : ''}
          ${canEdit ? `<div class="tn-q-act"><button class="btn btn-ghost btn-sm" data-tn-q-edit="${escapeHtml(q.id)}">✏️ Sửa</button><button class="btn btn-ghost btn-sm" data-tn-q-del="${escapeHtml(q.id)}" style="color:var(--red);">Xoá</button></div>` : ''}
        </details>`).join('')}</div>` : `<div class="tn-placeholder">${lessons.length ? 'Chưa có câu hỏi. Không có câu hỏi thì học viên học xong các phần là hoàn thành, không qua bài kiểm tra.' : 'Câu hỏi kiểm tra được AI soạn cùng lúc với giáo án.'}</div>`}
      ${canEdit && lessons.length ? `<div class="mt-doc-add" style="margin-top:10px;"><button class="btn btn-ghost btn-sm" id="tn-q-more">🧠 AI soạn thêm 5 câu</button><button class="btn btn-ghost btn-sm" id="tn-q-add">➕ Tự thêm câu hỏi</button></div>` : ''}`;
    const saveSet = async ()=>{
      const cur = tnFind(c.id); if(!cur) return;
      const next = { quizCount: Math.max(3, Math.min(20, parseInt(box.querySelector('#tn-s-count').value,10)||5)), passPercent: Math.max(30, Math.min(100, parseInt(box.querySelector('#tn-s-pass').value,10)||70)) };
      if(await tnUpdate(c.id, { settings: next })) mtFlashSaved();
    };
    if(canEdit){ box.querySelector('#tn-s-count').onchange = saveSet; box.querySelector('#tn-s-pass').onchange = saveSet; }
    const m = box.querySelector('#tn-q-more'); if(m) m.onclick = ()=> tnMoreQuiz(c);
    const a = box.querySelector('#tn-q-add'); if(a) a.onclick = ()=> tnQuizModal(c);
    box.querySelectorAll('[data-tn-q-edit]').forEach(b=> b.onclick = ()=> tnQuizModal(c, b.dataset.tnQEdit));
    box.querySelectorAll('[data-tn-q-del]').forEach(b=> b.onclick = ()=> tnQuizDelete(c, b.dataset.tnQDel));
  }

  // ---- Tab Chia sẻ ----
  function tnPaintShare(el, c){
    const box = el.querySelector('#tn-pane-share'); if(!box) return;
    const canEdit = tnCanEdit(), st = tnStatus(c), url = tnShareUrl(c.id);
    box.innerHTML = `
      ${!tnReady(c) ? `<div class="mt-warn">⚠️ Bài chưa soạn xong (cần có tài liệu và giáo án) — học viên mở link sẽ thấy thông báo “bài đang được chuẩn bị”.</div>` : ''}
      <div class="tn-share">
        <div class="tn-share-qr" id="tn-share-qr"><span class="mt-hint">Đang tạo mã QR…</span></div>
        <div class="tn-share-main">
          <div class="tn-share-status">${tnStatusPill(c)}</div>
          <div class="tn-share-url"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a></div>
          <div class="tn-share-btns">
            <button class="btn btn-primary btn-sm preview-allow" id="tn-sh-copy">📋 Sao chép link</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="tn-sh-zalo">💬 Sao chép lời mời gửi Zalo</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="tn-sh-png">⬇️ Tải áp phích mã QR</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="tn-sh-try">🧑‍🎓 Học thử</button>
          </div>
          <p class="mt-hint">Học viên bấm link (hoặc quét mã bằng Zalo/Camera) là học được ngay — không cài đặt, không lập tài khoản. Tiến độ được tự lưu trên máy của học viên để quay lại học tiếp.</p>
        </div>
      </div>
      <div class="divider-lbl">Mở / đóng liên kết</div>
      <div class="tn-share-ctl">
        <label class="tn-switch"><input type="checkbox" id="tn-sh-open" ${c.status!=='closed'?'checked':''} ${canEdit?'':'disabled'}><span></span> Cho phép học viên vào học</label>
        <label>Tự đóng lúc <input type="datetime-local" id="tn-sh-close" value="${escapeHtml(c.closeAt ? mtIsoToLocalInput(c.closeAt) : '')}" ${canEdit?'':'disabled'}></label>
        <span class="mt-hint">Đóng liên kết thì học viên đang học cũng dừng lại; kết quả đã có vẫn giữ nguyên.</span>
      </div>`;
    box.querySelector('#tn-sh-copy').onclick = ()=> copyMessageText(url);
    box.querySelector('#tn-sh-zalo').onclick = ()=> copyMessageText(`📚 Mời ${c.audience ? c.audience.toLowerCase() : 'bà con'} tham gia lớp tập huấn “${c.title}”${c.wardName ? ` của Hội Nông dân ${c.wardName}` : ''}.\nHọc ngay trên điện thoại, lúc nào rảnh thì học — có trợ giảng AI giải thích tận tình, hỏi bao nhiêu cũng được.\n👉 Bấm vào đây để học: ${url}`);
    box.querySelector('#tn-sh-try').onclick = ()=> tnOpenPreview(c);
    if(canEdit){
      box.querySelector('#tn-sh-open').onchange = async e=>{ if(!await tnUpdate(c.id, { status: e.target.checked ? 'open' : 'closed' })) e.target.checked = !e.target.checked; else mtFlashSaved(); };
      box.querySelector('#tn-sh-close').onchange = async e=>{ if(await tnUpdate(c.id, { closeAt: mtLocalInputToIso(e.target.value) })) mtFlashSaved(); };
    }
    const png = box.querySelector('#tn-sh-png');
    png.disabled = true;
    mtQrCanvas(url).then(qr=>{
      const q = box.querySelector('#tn-share-qr'); if(!q) return;
      q.innerHTML = `<img src="${qr.toDataURL('image/png')}" alt="Mã QR vào học">`;
      png.disabled = false;
      png.onclick = ()=> tnQrPoster(c, qr, url).toBlob(b=>{ if(b) downloadBlob(`QR_tap-huan_${surveyFileSlug(c.title||'tap-huan')}.png`, b, 'image/png'); }, 'image/png');
    }).catch(e=>{ const q = box.querySelector('#tn-share-qr'); if(q) q.innerHTML = `<span class="mt-hint">⚠️ Không tạo được mã QR (kiểm tra kết nối mạng).</span>`; });
  }
  function tnQrPoster(c, qrCanvas, url){
    const W = 1080, font = '"Be Vietnam Pro", Arial, sans-serif';
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = `800 52px ${font}`;
    const lines = surveyQrWrapLines(meas, c.title||'Bài tập huấn', W-140).slice(0,4);
    meas.font = `400 28px ${font}`;
    const urlLines = surveyQrWrapLines(meas, url.replace(/^https?:\/\//,''), W-120).slice(0,2);
    const bandH = 130 + lines.length*66, qs = 700;
    const H = bandH + 50 + qs + 120 + urlLines.length*36 + 60;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#fffdf6'; x.fillRect(0,0,W,H);
    const g = x.createLinearGradient(0,0,W,bandH); g.addColorStop(0,'#2F4A3C'); g.addColorStop(1,'#3f6b4f');
    x.fillStyle = g; x.fillRect(0,0,W,bandH);
    x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillStyle = '#e8c766'; x.font = `700 30px ${font}`; x.fillText('🎓 LỚP TẬP HUẤN CÓ TRỢ GIẢNG AI', W/2, 40);
    x.fillStyle = '#ffffff'; x.font = `800 52px ${font}`;
    lines.forEach((ln,i)=> x.fillText(ln, W/2, 96 + i*66));
    const qx = (W-qs)/2, qy = bandH + 50;
    x.imageSmoothingEnabled = false;
    x.drawImage(qrCanvas, qx, qy, qs, qs);
    x.fillStyle = '#1b1b1b'; x.font = `700 40px ${font}`;
    x.fillText('Quét mã để vào học ngay trên điện thoại', W/2, qy + qs + 40);
    x.fillStyle = '#555555'; x.font = `400 28px ${font}`;
    urlLines.forEach((ln,i)=> x.fillText(ln, W/2, qy + qs + 110 + i*36));
    return cv;
  }

  // ---- Tab Kết quả học tập ----
  function tnLearnerDone(c, ln){
    const ls = tnLessons(c), map = (ln && ln.lessons) || {};
    return ls.filter(l=> map[l.id]==='done').length;
  }
  function tnLearnerState(c, ln){
    if(ln.completedAt) return { key:'done', label:'Đã hoàn thành' };
    const total = tnLessons(c).length, done = tnLearnerDone(c, ln);
    if(ln.quiz && ln.quiz.attempts && !ln.quiz.passed) return { key:'retry', label:'Chưa đạt bài kiểm tra' };
    if(total && done>=total) return { key:'quiz', label:'Chờ làm bài kiểm tra' };
    return { key:'learning', label:'Đang học' };
  }
  function tnPaintResults(el, c){
    const box = el.querySelector('#tn-pane-results'); if(!box) return;
    const S = tnS();
    if(S.learnersError){ box.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="e-ico">⚠️</div>${escapeHtml(S.learnersError)}</div>`; return; }
    if(!S.learnersLoaded){ box.innerHTML = `<div class="empty-state" style="padding:24px;">Đang tải kết quả học tập…</div>`; return; }
    const ls = S.learners.slice().sort((a,b)=> String(b.lastAt||'').localeCompare(String(a.lastAt||'')));
    if(!ls.length){ box.innerHTML = `<div class="tn-empty"><div class="tn-empty-ico">📈</div><h4>Chưa có học viên nào vào học</h4><p>Gửi link ở thẻ <b>“Chia sẻ cho học viên”</b>. Khi có người học, tiến độ, điểm kiểm tra và những chỗ học viên còn vướng sẽ hiện ở đây.</p></div>`; return; }
    const lessons = tnLessons(c), total = lessons.length;
    const done = ls.filter(l=> l.completedAt).length;
    const quizzed = ls.filter(l=> l.quiz && l.quiz.attempts);
    const avg = quizzed.length ? Math.round(quizzed.reduce((s,l)=> s + (l.quiz.best||0), 0) / quizzed.length) : null;
    const passRate = quizzed.length ? Math.round(quizzed.filter(l=> l.quiz.passed).length / quizzed.length * 100) : null;
    const active7 = ls.filter(l=> l.lastAt && Date.now() - new Date(l.lastAt).getTime() < 7*864e5).length;
    const struggles = [];
    ls.forEach(l=> tnArr(l.struggles).forEach(s=> struggles.push({ ...s, who: l.name })));
    const byLesson = lessons.map((les,i)=> ({ les, i, done: ls.filter(l=> (l.lessons||{})[les.id]==='done').length, st: struggles.filter(s=> s.lesson===les.id) }));
    const loose = struggles.filter(s=> !lessons.some(l=> l.id===s.lesson));
    const grp = c.groupLabel || subAdminLabel();
    box.innerHTML = `
      <div class="tn-stats">
        <div class="tn-stat"><b>${ls.length}</b><span>người đã vào học</span></div>
        <div class="tn-stat ok"><b>${done}</b><span>đã hoàn thành</span></div>
        <div class="tn-stat"><b>${active7}</b><span>học trong 7 ngày qua</span></div>
        <div class="tn-stat"><b>${avg==null ? '—' : avg+'%'}</b><span>điểm kiểm tra trung bình</span></div>
        <div class="tn-stat"><b>${passRate==null ? '—' : passRate+'%'}</b><span>tỉ lệ đạt (trên số đã kiểm tra)</span></div>
      </div>
      <div class="divider-lbl">Tiến độ theo từng phần</div>
      <div class="tn-bars">${byLesson.map(x=>{ const p = Math.round(x.done/ls.length*100); return `<div class="tn-bar-row">
        <div class="tn-bar-lbl"><b>${x.i+1}.</b> ${escapeHtml(x.les.title)}</div>
        <div class="tn-bar"><span style="width:${p}%;"></span></div>
        <div class="tn-bar-val">${x.done}/${ls.length}${x.st.length ? ` · <span class="tn-tag-warn">${x.st.length} lần vướng</span>` : ''}</div>
      </div>`; }).join('')}</div>
      <div class="divider-lbl">Chỗ học viên hay vướng</div>
      ${struggles.length ? `<div class="tn-struggles">${byLesson.filter(x=> x.st.length).sort((a,b)=> b.st.length-a.st.length).map(x=>`
        <div class="tn-str"><div class="tn-str-head"><b>Phần ${x.i+1}: ${escapeHtml(x.les.title)}</b><span>${x.st.length} lần</span></div>
          <ul>${x.st.slice(-8).reverse().map(s=>`<li>${escapeHtml(s.text)} <span class="mt-hint">— ${escapeHtml(s.who||'')}</span></li>`).join('')}</ul></div>`).join('')}
        ${loose.length ? `<div class="tn-str"><div class="tn-str-head"><b>Chung</b><span>${loose.length} lần</span></div><ul>${loose.slice(-8).reverse().map(s=>`<li>${escapeHtml(s.text)} <span class="mt-hint">— ${escapeHtml(s.who||'')}</span></li>`).join('')}</ul></div>` : ''}
        </div>
        <div class="tn-insight">
          ${c.insight && c.insight.text ? `<div class="tn-insight-body">${renderMarkdownLite(c.insight.text)}<div class="mt-hint">AI tổng hợp lúc ${escapeHtml(tnFmtIso(c.insight.at))} từ ${c.insight.n||0} ghi nhận.</div></div>` : ''}
          <button class="btn btn-ghost btn-sm preview-allow" id="tn-insight-btn">🧠 ${c.insight && c.insight.text ? 'AI tổng hợp lại' : 'Nhờ AI tổng hợp và gợi ý bổ sung tài liệu'}</button>
        </div>` : `<div class="tn-placeholder">Chưa ghi nhận chỗ vướng nào. Khi học viên trả lời sai câu hỏi kiểm tra trong lúc học, AI sẽ ghi lại ở đây.</div>`}
      <div class="divider-lbl">Danh sách học viên</div>
      <div class="tn-table-bar"><span class="mt-hint">${ls.length} học viên · mới học gần đây xếp trên</span><button class="btn btn-ghost btn-sm preview-allow" id="tn-export">⬇️ Xuất Excel</button></div>
      <div class="table-wrap"><table class="tn-table">
        <thead><tr><th style="text-align:left;">Họ và tên</th><th>${escapeHtml(grp)}</th><th>Trình độ AI đánh giá</th><th>Tiến độ</th><th>Điểm kiểm tra</th><th>Trạng thái</th><th>Lần học gần nhất</th>${tnCanEdit() ? '<th></th>' : ''}</tr></thead>
        <tbody>${ls.map(l=>{ const d = tnLearnerDone(c, l), stt = tnLearnerState(c, l); return `<tr>
          <td style="text-align:left;"><b>${escapeHtml(l.call ? l.call+' ' : '')}${escapeHtml(l.name||'(không tên)')}</b></td>
          <td>${escapeHtml(l.group||'—')}</td>
          <td>${escapeHtml(TN_LEVELS[l.level]||'—')}</td>
          <td><div class="tn-mini-bar"><span style="width:${total ? Math.round(d/total*100) : 0}%;"></span></div>${d}/${total}</td>
          <td>${l.quiz && l.quiz.attempts ? `${l.quiz.best}% <span class="mt-hint">(${l.quiz.attempts} lần)</span>` : '—'}</td>
          <td><span class="tn-pill tn-pill-${stt.key}">${escapeHtml(stt.label)}</span></td>
          <td>${escapeHtml(tnFmtIso(l.lastAt))}</td>
          ${tnCanEdit() ? `<td><button class="btn btn-ghost btn-sm" data-tn-ln-del="${escapeHtml(l.id)}" title="Xoá kết quả của học viên này" style="color:var(--red);">✕</button></td>` : ''}
        </tr>`; }).join('')}</tbody>
      </table></div>`;
    const ib = box.querySelector('#tn-insight-btn'); if(ib) ib.onclick = ()=> tnInsight(c, struggles);
    box.querySelector('#tn-export').onclick = ()=> tnExportResults(c, ls);
    box.querySelectorAll('[data-tn-ln-del]').forEach(b=> b.onclick = async ()=>{
      if(!tnWriteOk()) return;
      const l = ls.find(x=> x.id===b.dataset.tnLnDel);
      if(!l || !confirm(`Xoá kết quả học tập của "${l.name}"?`)) return;
      try{ await rtdb.ref(`training_learners/${c.id}/${l.id}`).remove(); showToast('Đã xoá.'); }catch(e){ alert('Không xoá được: ' + (e && e.message || e)); }
    });
  }
  async function tnInsight(c, struggles){
    if(!tnWriteOk() || tnS().busy) return;
    const lessons = tnLessons(c);
    const lines = struggles.slice(-200).map(s=>{ const i = lessons.findIndex(l=> l.id===s.lesson); return `- [${i>=0 ? 'Phần '+(i+1) : 'Chung'}] ${s.text}`; }).join('\n');
    const prompt = `Đây là những chỗ học viên còn hiểu sai/chưa hiểu, do trợ giảng AI ghi lại trong lúc kèm từng người học bài tập huấn "${c.title}".

GIÁO ÁN:
${lessons.map((l,i)=> `Phần ${i+1}: ${l.title}`).join('\n')}

GHI NHẬN:
${lines}

Hãy viết cho cán bộ Hội (gọi là "đồng chí") một bản tổng hợp NGẮN (dưới 250 chữ), gồm:
1. **Những chỗ nhiều người vướng nhất** (gộp các ý giống nhau, ghi số lần).
2. **Gợi ý bổ sung tài liệu cho đợt sau** — cụ thể nên giải thích thêm ý nào, thêm ví dụ gì.
Dùng gạch đầu dòng, không dùng bảng.`;
    tnSetBusy('🧠 AI đang tổng hợp chỗ học viên hay vướng…');
    try{
      const r = await tnCallAI([{ role:'user', text: prompt }], { quality:true, systemPromptOverride:'Bạn là chuyên gia đào tạo, hỗ trợ cán bộ Hội Nông dân Việt Nam cải thiện bài tập huấn. Luôn gọi người dùng là "đồng chí".' }, null);
      if(await tnUpdate(c.id, { insight:{ text: r.text.slice(0, 4000), at: new Date().toISOString(), n: struggles.length } })) showToast('AI đã tổng hợp xong.');
    }catch(e){ alert('Chưa tổng hợp được: ' + (e && e.message || e)); }
    finally{ tnSetBusy(''); }
  }
  async function tnExportResults(c, ls){
    try{ await loadOptionalLibrary('xlsx'); }catch(e){ alert('Không tải được thư viện Excel. Vui lòng kiểm tra kết nối mạng.'); return; }
    const lessons = tnLessons(c), grp = c.groupLabel || subAdminLabel();
    const rows = ls.map((l,i)=>{
      const row = { 'STT': i+1, 'Họ và tên': l.name||'', 'Xưng hô': l.call||'', [grp]: l.group||'', 'Trình độ AI đánh giá': TN_LEVELS[l.level]||'',
        'Số phần đã xong': `${tnLearnerDone(c,l)}/${lessons.length}`, 'Điểm kiểm tra cao nhất (%)': l.quiz && l.quiz.attempts ? l.quiz.best : '',
        'Số lần kiểm tra': (l.quiz && l.quiz.attempts) || 0, 'Trạng thái': tnLearnerState(c,l).label,
        'Bắt đầu học': tnFmtIso(l.startedAt), 'Lần học gần nhất': tnFmtIso(l.lastAt), 'Hoàn thành lúc': tnFmtIso(l.completedAt),
        'Chỗ còn vướng': tnArr(l.struggles).map(s=> s.text).join('; ') };
      lessons.forEach((les,k)=>{ row[`P${k+1}. ${les.title}`.slice(0,60)] = (l.lessons||{})[les.id]==='done' ? 'Xong' : ((l.lessons||{})[les.id]==='learning' ? 'Đang học' : ''); });
      return row;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Kết quả học tập');
    XLSX.writeFile(wb, `Ket-qua-tap-huan_${surveyFileSlug(c.title||'tap-huan')}.xlsx`);
  }

  // =====================================================================
  // TRANG HỌC VIÊN — /taphuan/{mã}. Dùng chung cho nút "Học thử" trong trình soạn (opts.preview: không ghi
  // gì lên máy chủ, không lưu vào bộ nhớ trình duyệt).
  // =====================================================================
  // Cách AI tự xưng theo cách học viên muốn được gọi.
  function tnSelfCall(call){
    return ({ 'Bác':'cháu', 'Chú':'cháu', 'Cô':'cháu', 'Ông':'cháu', 'Bà':'cháu', 'Anh':'em', 'Chị':'em', 'Em':'anh/chị', 'Bạn':'mình' })[call] || 'tôi';
  }
  function tnTutorSystem(c, L){
    const lessons = tnLessons(c), me = tnSelfCall(L.call), you = `${L.call||'bạn'} ${String(L.name||'').trim().split(/\s+/).pop()||''}`.trim();
    const prog = lessons.map((l,i)=> `P${i+1}=${(L.lessons||{})[l.id]==='done' ? 'đã xong' : ((L.lessons||{})[l.id]==='learning' ? 'đang học' : 'chưa học')}`).join(', ');
    const review = (L.review||[]).length ? `\nHỌC VIÊN VỪA LÀM BÀI KIỂM TRA CUỐI VÀ CÒN SAI CÁC Ý SAU — hãy ôn lại cho học viên từng ý một, hỏi lại cho chắc rồi mời làm lại bài kiểm tra:\n${L.review.map(x=> '- '+x).join('\n')}\n` : '';
    return `Bạn là TRỢ GIẢNG AI của Hội Nông dân${c.wardName ? ' ' + c.wardName : ''}, kèm riêng MỘT học viên học bài tập huấn "${c.title}".${c.audience ? `\nĐối tượng của bài: ${c.audience}.` : ''}
HỌC VIÊN: ${L.call||''} ${L.name||''}${L.group ? ` (${tnGroupText(c, L.group)})` : ''}. Luôn gọi học viên là "${you}" hoặc "${L.call||'bạn'}", tự xưng là "${me}". Lễ phép, thân tình, kiên nhẫn.

PHẠM VI KIẾN THỨC — RẤT QUAN TRỌNG:
- CHỈ giảng dựa trên TÀI LIỆU TẬP HUẤN bên dưới. Không bịa số liệu, quy định, tên văn bản. Tài liệu không nói tới thì nói thật là tài liệu chưa đề cập và gợi ý hỏi cán bộ Hội.
- Câu hỏi ngoài phạm vi bài (chuyện khác, chính trị, y tế, pháp lý cá nhân…) → nhẹ nhàng nói đó nằm ngoài bài tập huấn, gợi ý hỏi cán bộ Hội, rồi kéo về bài đang học.

CÁCH DẠY:
1. Buổi đầu: chào ngắn, nói bài có ${lessons.length} phần, rồi hỏi 1–2 câu thăm dò (MỖI LẦN MỘT CÂU) xem học viên đã biết gì về chủ đề.
2. Sau khi thăm dò: đánh giá trình độ (thẻ TRINHDO) rồi bắt đầu phần đầu tiên chưa xong.
3. Giảng lần lượt từng phần theo GIÁO ÁN. Mỗi lượt chỉ giảng MỘT ý nhỏ, tối đa khoảng 120 chữ, câu ngắn, ví dụ gần gũi với đồng ruộng, chăn nuôi, đời sống nông thôn. Học viên đã rành → lướt nhanh, bỏ qua ý đã biết. Học viên mới → giảng chậm, kỹ, nhiều ví dụ.
4. Giảng xong các ý chính của một phần → hỏi 1 câu kiểm tra hiểu bài (câu hỏi mở hoặc cho chọn phương án). Học viên trả lời đúng và hiểu → khen ngắn, gắn thẻ XONG, sang phần sau. Sai/lơ mơ → gắn thẻ VUONG, giảng lại bằng cách khác, ví dụ khác, rồi hỏi lại.
5. Học viên hỏi bất cứ lúc nào cũng trả lời; xong thì quay về đúng chỗ đang học.
6. Khi TẤT CẢ các phần đã xong → chúc mừng và mời học viên bấm nút "📝 Làm bài kiểm tra cuối" trên màn hình.
7. Không tự ra cả bài kiểm tra trắc nghiệm dài — bài kiểm tra cuối do hệ thống đưa ra.

HÌNH THỨC: tiếng Việt có dấu, giản dị như nói chuyện. Dùng **in đậm** cho ý chính, gạch đầu dòng khi liệt kê. Không dùng bảng, không dùng tiêu đề lớn.

THẺ ĐIỀU KHIỂN — hệ thống đọc, học viên KHÔNG nhìn thấy. Đặt ở CUỐI câu trả lời, mỗi thẻ một dòng, đúng cú pháp:
<<TRINHDO:moi>> hoặc <<TRINHDO:coban>> hoặc <<TRINHDO:kha>>  — một lần, sau khi thăm dò xong.
<<DANGHOC:P2>>  — khi bắt đầu giảng phần 2.
<<XONG:P2>>  — CHỈ khi học viên đã trả lời đúng câu kiểm tra của phần 2.
<<VUONG:P2|mô tả ngắn chỗ học viên hiểu sai hoặc chưa hiểu>>  — khi học viên trả lời sai/chưa hiểu.
<<GOIY:gợi ý 1|gợi ý 2|gợi ý 3>>  — LUÔN có: 2–4 câu trả lời ngắn (dưới 10 chữ) học viên có thể bấm để trả lời nhanh. Khi hỏi chọn phương án thì đưa các phương án vào đây.

TIẾN ĐỘ HIỆN TẠI: ${prog || '(chưa có giáo án)'}. Trình độ đã đánh giá: ${TN_LEVELS[L.level] || 'chưa đánh giá'}.${review}

GIÁO ÁN:
${lessons.map((l,i)=> `Phần ${i+1} (mã P${i+1}): ${l.title}${l.goal ? `\n  Mục tiêu: ${l.goal}` : ''}${l.points.length ? `\n  Ý chính: ${l.points.join(' | ')}` : ''}`).join('\n')}

TÀI LIỆU TẬP HUẤN:
${tnMaterialsBlock(c)}`;
  }
  const TN_TAG_RE = /<<\s*(TRINHDO|DANGHOC|XONG|VUONG|GOIY)\s*:\s*([^>]*?)\s*>>/gi;
  // Bỏ thẻ điều khiển khỏi phần hiển thị; đang tuôn chữ thì giấu luôn đoạn "<<..." chưa đóng ở cuối.
  function tnStripTags(text, streaming){
    let s = String(text||'').replace(TN_TAG_RE, '');
    if(streaming){ const k = s.lastIndexOf('<<'); if(k>=0 && s.indexOf('>>', k)<0) s = s.slice(0, k); }
    return s.replace(/\n{3,}/g, '\n\n').trim();
  }
  function tnParseTags(text){
    const out = { level:null, start:[], done:[], stuck:[], chips:[] };
    String(text||'').replace(TN_TAG_RE, (m, k, v)=>{
      k = k.toUpperCase(); v = String(v||'').trim();
      if(k==='TRINHDO'){ const lv = surveyFold(v).replace(/[^a-z]/g,''); if(TN_LEVELS[lv]) out.level = lv; }
      else if(k==='DANGHOC'){ const n = parseInt(v.replace(/\D/g,''),10); if(n) out.start.push(n); }
      else if(k==='XONG'){ v.split(/[,|\s]+/).forEach(x=>{ const n = parseInt(x.replace(/\D/g,''),10); if(n) out.done.push(n); }); }
      else if(k==='VUONG'){ const [p, ...rest] = v.split('|'); const n = parseInt(String(p).replace(/\D/g,''),10); const t = rest.join('|').trim(); if(t) out.stuck.push({ n: n||0, text: t.slice(0,200) }); }
      else if(k==='GOIY'){ out.chips = v.split('|').map(x=> x.trim()).filter(Boolean).slice(0,4).map(x=> x.slice(0,80)); }
      return '';
    });
    return out;
  }
  function tnShuffle(a){ a = a.slice(); for(let i=a.length-1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
  function tnPickQuiz(c){
    const pool = tnQuiz(c), n = Math.min(pool.length, tnSettings(c).quizCount);
    return tnShuffle(pool).slice(0, n).map(q=>{
      const order = tnShuffle(q.options.map((o,i)=> i));
      return { id:q.id, q:q.q, options: order.map(i=> q.options[i]), answer: order.indexOf(q.answer), explain:q.explain||'', lessonId:q.lessonId||null };
    });
  }
  // "Ấp 2" đã mang sẵn danh xưng thì không ghép thêm "Ấp" phía trước (tránh "Ấp Ấp 2").
  function tnGroupText(c, g){
    const lbl = String((c && c.groupLabel) || '').trim(), v = String(g||'').trim();
    if(!lbl || !v || surveyFold(v).startsWith(surveyFold(lbl))) return v;
    return `${lbl} ${v}`;
  }
  function tnCertCanvas(c, L){
    const W = 1600, H = 1130, font = '"Be Vietnam Pro", Arial, sans-serif';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#fffdf6'; x.fillRect(0,0,W,H);
    x.strokeStyle = '#2F4A3C'; x.lineWidth = 14; x.strokeRect(40,40,W-80,H-80);
    x.strokeStyle = '#c9a53a'; x.lineWidth = 4; x.strokeRect(70,70,W-140,H-140);
    x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillStyle = '#2F4A3C'; x.font = `600 34px ${font}`;
    x.fillText(`HỘI NÔNG DÂN${c.wardName ? ' ' + String(c.wardName).toUpperCase() : ''}`, W/2, 130);
    x.font = `800 72px ${font}`; x.fillStyle = '#8a6d1c';
    x.fillText('XÁC NHẬN HOÀN THÀNH TẬP HUẤN', W/2, 210);
    x.fillStyle = '#333'; x.font = `400 36px ${font}`; x.fillText('Xác nhận', W/2, 340);
    x.fillStyle = '#1f2a1b'; x.font = `800 80px ${font}`; x.fillText(`${L.call ? L.call+' ' : ''}${L.name||''}`, W/2, 400);
    if(L.group){ x.font = `400 34px ${font}`; x.fillStyle = '#555'; x.fillText(tnGroupText(c, L.group), W/2, 505); }
    x.fillStyle = '#333'; x.font = `400 36px ${font}`; x.fillText('đã hoàn thành bài tập huấn', W/2, 580);
    x.fillStyle = '#2F4A3C'; x.font = `800 50px ${font}`;
    surveyQrWrapLines(x, `“${c.title||''}”`, W-300).slice(0,3).forEach((ln,i)=> x.fillText(ln, W/2, 645 + i*64));
    const d = new Date(L.completedAt || Date.now());
    x.fillStyle = '#555'; x.font = `400 32px ${font}`;
    x.fillText(`${L.quiz && L.quiz.attempts ? `Kết quả kiểm tra: ${L.quiz.best}% · ` : ''}Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()}`, W/2, 880);
    x.font = `400 24px ${font}`; x.fillStyle = '#8a9585';
    x.fillText('Học trực tuyến cùng trợ giảng AI · hoinongdan.sotay.org', W/2, 960);
    return cv;
  }

  function tnPublicMount(container, opts){
    let course = opts.course || null;
    const preview = !!opts.preview, cid = (course && course.id) || opts.id;
    const lsKey = 'hnd_tn_learner_' + cid;
    const loadLocal = ()=>{ if(preview) return null; try{ const v = JSON.parse(localStorage.getItem(lsKey)||'null'); return v && v.id ? v : null; }catch(e){ return null; } };
    let L = loadLocal();
    let screen = L ? 'chat' : 'welcome';
    let sending = false, abort = null, quizRun = null, recog = null;
    const saveLocal = ()=>{ if(preview || !L) return; try{ localStorage.setItem(lsKey, JSON.stringify({ ...L, msgs: (L.msgs||[]).slice(-80) })); }catch(e){} };
    const lessonIdx = n=> { const ls = tnLessons(course); return ls[n-1] ? ls[n-1].id : null; };
    const syncRemote = ()=>{
      if(preview || !L) return;
      const rec = { id:L.id, name:L.name, call:L.call||'', group:L.group||'', startedAt:L.startedAt, lastAt:new Date().toISOString(),
        level:L.level||null, lessons:L.lessons||{}, struggles:(L.struggles||[]).slice(-30), quiz:L.quiz||null, completedAt:L.completedAt||null, turns:L.turns||0 };
      try{ rtdb.ref(`training_learners/${cid}/${L.id}`).set(JSON.parse(JSON.stringify(rec))).catch(e=> console.warn('[Tập huấn] Không lưu được tiến độ lên máy chủ (vẫn giữ trên máy):', e)); }catch(e){}
    };
    const allDone = ()=>{ const ls = tnLessons(course); return ls.length>0 && ls.every(l=> (L.lessons||{})[l.id]==='done'); };
    const hasQuiz = ()=> tnQuiz(course).length>0;
    const markComplete = ()=>{ if(!L.completedAt){ L.completedAt = new Date().toISOString(); } };
    const headHtml = ()=> `<header class="tnp-head">
        <div class="tnp-eyebrow">🎓 Lớp tập huấn có trợ giảng AI${course.wardName ? ` · Hội Nông dân ${escapeHtml(course.wardName)}` : ''}</div>
        <h1>${escapeHtml(course.title||'Bài tập huấn')}</h1>
      </header>`;
    const foot = `<footer class="tnp-foot">Tập huấn bằng AI · hoinongdan.sotay.org</footer>`;
    const shell = inner=>{ container.innerHTML = `<div class="tnp ${preview ? 'is-preview' : ''}">${inner}</div>`; };

    function paint(){
      if(!course){ shell(`<div class="tnp-closed"><div>🔎</div><h2>Không tìm thấy bài tập huấn</h2><p>Đường link không đúng, hoặc bài đã bị xoá.</p></div>`); return; }
      const st = tnStatus(course);
      if(!st.open && !(preview && st.key!=='draft')){
        const msg = st.key==='draft' ? ['🛠️','Bài tập huấn đang được chuẩn bị','Cán bộ Hội đang soạn nội dung. Đồng chí/bà con vui lòng quay lại sau nhé.'] : ['🔒','Lớp tập huấn đã đóng','Liên kết này không còn nhận học viên. Vui lòng liên hệ cán bộ Hội nếu cần học lại.'];
        shell(`${headHtml()}<div class="tnp-closed"><div>${msg[0]}</div><h2>${msg[1]}</h2><p>${msg[2]}</p></div>${foot}`);
        return;
      }
      if(screen==='welcome') paintWelcome();
      else if(screen==='quiz') paintQuiz();
      else if(screen==='done') paintDone();
      else paintChat();
    }
    function paintWelcome(){
      const ls = tnLessons(course), nq = Math.min(tnQuiz(course).length, tnSettings(course).quizCount), groups = Array.isArray(course.groups) ? course.groups : [];
      shell(`${headHtml()}
        <section class="tnp-card">
          ${course.intro ? `<p class="tnp-intro">${surveyLinkify(course.intro)}</p>` : (course.summary ? `<p class="tnp-intro">${escapeHtml(course.summary)}</p>` : '')}
          <div class="tnp-how">
            <div><span>💬</span>Trò chuyện với trợ giảng AI — hỏi bao nhiêu cũng được</div>
            <div><span>🎯</span>AI hỏi vài câu để biết mình đã nắm gì, giảng đúng chỗ còn thiếu</div>
            <div><span>📝</span>${nq ? `Cuối bài làm ${nq} câu trắc nghiệm ngắn` : 'Học xong các phần là hoàn thành'}</div>
          </div>
          <div class="tnp-outline"><b>Bài học gồm ${ls.length} phần:</b><ol>${ls.map(l=>`<li>${escapeHtml(l.title)}</li>`).join('')}</ol></div>
        </section>
        <section class="tnp-card">
          <h2 class="tnp-h2">Trước khi bắt đầu</h2>
          <div class="tnp-field"><label for="tnp-name">Họ và tên <span class="req">*</span></label><input id="tnp-name" maxlength="60" autocomplete="name" placeholder="VD: Nguyễn Văn Ba"></div>
          <div class="tnp-field"><label>Trợ giảng nên gọi mình là</label><div class="tnp-calls">${TN_CALLS.map(k=>`<label><input type="radio" name="tnp-call" value="${k}"><span>${k}</span></label>`).join('')}</div></div>
          <div class="tnp-field"><label for="tnp-group">${escapeHtml(course.groupLabel || 'Nơi ở')} <span class="tnp-opt">(không bắt buộc)</span></label>${groups.length
            ? `<select id="tnp-group"><option value="">— Chọn —</option>${groups.map(g=>`<option>${escapeHtml(g)}</option>`).join('')}<option value="__other">Khác…</option></select><input id="tnp-group-other" maxlength="60" placeholder="Ghi rõ" style="display:none; margin-top:8px;">`
            : `<input id="tnp-group" maxlength="60">`}</div>
          <button class="tnp-btn tnp-btn-main" id="tnp-start">Bắt đầu học ›</button>
          <p class="tnp-note">Tên của mình chỉ dùng để cán bộ Hội biết ai đã học. Cuộc trò chuyện được lưu trên chính điện thoại này để lần sau học tiếp.</p>
        </section>${foot}`);
      const gs = container.querySelector('#tnp-group'), go = container.querySelector('#tnp-group-other');
      if(gs && go) gs.onchange = ()=>{ go.style.display = gs.value==='__other' ? '' : 'none'; if(gs.value==='__other') go.focus(); };
      container.querySelector('#tnp-start').onclick = ()=>{
        const name = container.querySelector('#tnp-name').value.trim().replace(/\s+/g,' ');
        if(name.length < 2){ alert('Vui lòng nhập họ và tên.'); container.querySelector('#tnp-name').focus(); return; }
        const call = (container.querySelector('input[name="tnp-call"]:checked')||{}).value || 'Bạn';
        let group = gs ? gs.value : ''; if(group==='__other') group = (go && go.value.trim()) || '';
        L = { id: 'ln' + tnRand(14), name: name.slice(0,60), call, group: group.slice(0,60), startedAt: new Date().toISOString(), lessons:{}, struggles:[], msgs:[], turns:0, level:null, quiz:null, completedAt:null, review:[] };
        saveLocal(); syncRemote();
        screen = 'chat'; paint();
        turn('(Học viên vừa vào lớp. Hãy chào và bắt đầu buổi học theo đúng cách dạy.)', true);
      };
    }
    function progressHtml(){
      const ls = tnLessons(course), map = L.lessons||{}, done = ls.filter(l=> map[l.id]==='done').length;
      return `<div class="tnp-prog">
        <div class="tnp-prog-top"><b>Tiến độ: ${done}/${ls.length} phần</b>${L.level ? `<span>${escapeHtml(TN_LEVELS[L.level])}</span>` : ''}</div>
        <div class="tnp-prog-bar"><span style="width:${ls.length ? Math.round(done/ls.length*100) : 0}%;"></span></div>
        <details class="tnp-prog-list"><summary>Xem các phần</summary><ol>${ls.map(l=>`<li class="${map[l.id]||''}">${map[l.id]==='done' ? '✅' : (map[l.id]==='learning' ? '📖' : '⬜')} ${escapeHtml(l.title)}</li>`).join('')}</ol></details>
      </div>`;
    }
    function msgHtml(m){
      if(m.hidden) return '';
      if(m.role==='user') return `<div class="tnp-msg me"><div class="tnp-bub">${escapeHtml(m.text)}</div></div>`;
      return `<div class="tnp-msg ai"><div class="tnp-ava" aria-hidden="true">🎓</div><div class="tnp-bub">${renderMarkdownLite(tnStripTags(m.text)) || '…'}</div></div>`;
    }
    function paintChat(){
      const msgs = L.msgs||[], last = msgs[msgs.length-1];
      const chips = !sending && last && last.role==='assistant' ? tnParseTags(last.text).chips : [];
      const canQuiz = allDone() && hasQuiz() && !L.completedAt;
      shell(`<div class="tnp-chat">
        <div class="tnp-chat-top">
          <div class="tnp-chat-title"><small>🎓 Lớp tập huấn</small><b>${escapeHtml(course.title||'')}</b></div>
          <button class="tnp-icon-btn" id="tnp-menu" aria-label="Tuỳ chọn">⋯</button>
        </div>
        ${progressHtml()}
        ${canQuiz ? `<button class="tnp-btn tnp-btn-quiz" id="tnp-go-quiz">📝 Làm bài kiểm tra cuối</button>` : ''}
        ${L.completedAt ? `<button class="tnp-btn tnp-btn-done" id="tnp-go-done">🏅 Đã hoàn thành — xem giấy xác nhận</button>` : ''}
        <div class="tnp-msgs" id="tnp-msgs">${msgs.map(msgHtml).join('')}${sending && (!last || last.role!=='assistant' || !last.text) ? `<div class="tnp-msg ai"><div class="tnp-ava">🎓</div><div class="tnp-bub tnp-typing"><span></span><span></span><span></span></div></div>` : ''}</div>
        ${chips.length ? `<div class="tnp-chips">${chips.map((t,i)=>`<button class="tnp-chip" data-chip="${i}">${escapeHtml(t)}</button>`).join('')}</div>` : ''}
        <div class="tnp-input">
          <textarea id="tnp-text" rows="1" maxlength="1500" placeholder="Nhập câu trả lời, câu hỏi…" ${sending?'disabled':''}></textarea>
          <button class="tnp-mic" id="tnp-mic" title="Nói thay vì gõ" ${sending?'disabled':''}>🎤</button>
          ${sending ? `<button class="tnp-send stop" id="tnp-stop" title="Dừng">■</button>` : `<button class="tnp-send" id="tnp-send" title="Gửi">➤</button>`}
        </div>
      </div>`);
      scrollMsgs();
      chips.forEach((t,i)=>{ const b = container.querySelector(`[data-chip="${i}"]`); if(b) b.onclick = ()=> turn(t); });
      const ta = container.querySelector('#tnp-text');
      const fit = ()=>{ ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
      ta.oninput = fit;
      ta.onkeydown = e=>{ if(e.key==='Enter' && !e.shiftKey && !('ontouchstart' in window)){ e.preventDefault(); send(); } };
      const send = ()=>{ const t = ta.value.trim(); if(!t || sending) return; turn(t); };
      const sb = container.querySelector('#tnp-send'); if(sb) sb.onclick = send;
      const stop = container.querySelector('#tnp-stop'); if(stop) stop.onclick = ()=>{ if(abort) abort.abort(); };
      container.querySelector('#tnp-mic').onclick = ()=> toggleMic(ta, fit);
      const gq = container.querySelector('#tnp-go-quiz'); if(gq) gq.onclick = startQuiz;
      const gd = container.querySelector('#tnp-go-done'); if(gd) gd.onclick = ()=>{ screen = 'done'; paint(); };
      container.querySelector('#tnp-menu').onclick = ()=> openMenu();
      if(!sending && !('ontouchstart' in window)) setTimeout(()=> ta.focus(), 30);
    }
    function scrollMsgs(){ const box = container.querySelector('#tnp-msgs'); if(box) box.scrollTop = box.scrollHeight; }
    function toggleMic(ta, fit){
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!SR){ alert('Điện thoại/trình duyệt này chưa hỗ trợ nói thành chữ. Mình gõ phím giúp nhé (bàn phím điện thoại thường có sẵn nút micro).'); return; }
      const btn = container.querySelector('#tnp-mic');
      if(recog){ recog.stop(); return; }
      const base = ta.value ? ta.value.trim() + ' ' : '';
      recog = new SR(); recog.lang = 'vi-VN'; recog.interimResults = true; recog.continuous = false;
      recog.onresult = e=>{ let t = ''; for(let i=0; i<e.results.length; i++) t += e.results[i][0].transcript; ta.value = base + t; fit(); };
      recog.onend = ()=>{ recog = null; if(btn) btn.classList.remove('on'); };
      recog.onerror = ()=>{ recog = null; if(btn) btn.classList.remove('on'); };
      try{ recog.start(); btn.classList.add('on'); }catch(e){ recog = null; }
    }
    function openMenu(){
      const wrap = document.createElement('div');
      wrap.className = 'tnp-sheet-bg';
      wrap.innerHTML = `<div class="tnp-sheet" role="dialog" aria-modal="true">
        <div class="tnp-sheet-who">${escapeHtml(L.call||'')} ${escapeHtml(L.name||'')}${L.group ? ` · ${escapeHtml(L.group)}` : ''}</div>
        ${hasQuiz() ? `<button data-a="quiz" ${allDone() ? '' : 'disabled'}>📝 Làm bài kiểm tra cuối${allDone() ? '' : ' (học xong các phần trước)'}</button>` : ''}
        <button data-a="restart">🔄 Học lại từ đầu</button>
        <button data-a="close" class="muted">Đóng</button>
      </div>`;
      document.body.appendChild(wrap);
      const close = ()=> wrap.remove();
      wrap.onclick = e=>{ if(e.target===wrap) close(); };
      wrap.querySelectorAll('[data-a]').forEach(b=> b.onclick = ()=>{
        const a = b.dataset.a; close();
        if(a==='quiz') startQuiz();
        if(a==='restart' && confirm('Học lại từ đầu? Cuộc trò chuyện trên máy này sẽ bắt đầu lại; kết quả đã gửi cho cán bộ Hội vẫn giữ.')){
          L.msgs = []; L.lessons = {}; L.level = null; L.review = []; saveLocal(); syncRemote(); paint();
          turn('(Học viên muốn học lại từ đầu. Hãy bắt đầu lại buổi học.)', true);
        }
      });
    }
    async function turn(text, hidden){
      if(sending) return;
      L.msgs = (L.msgs||[]).concat([{ role:'user', text, hidden: !!hidden, at: new Date().toISOString() }]);
      const ai = { role:'assistant', text:'', at: new Date().toISOString() };
      sending = true; abort = new AbortController();
      paint();
      // Lịch sử gửi cho AI: tối đa N lượt gần nhất, bắt đầu bằng lượt của học viên (Claude/OpenAI yêu cầu).
      let hist = L.msgs.slice(-TN_HISTORY_TURNS);
      while(hist.length && hist[0].role!=='user') hist = hist.slice(1);
      const apiMsgs = hist.filter(m=> !m.error).map(m=> ({ role:m.role, text:m.text }));
      L.msgs.push(ai);
      let lastPaint = 0;
      try{
        const r = await tnCallAI(apiMsgs, { signal: abort.signal, systemPromptOverride: tnTutorSystem(course, L) }, partial=>{
          ai.text = partial;
          const now = Date.now(); if(now - lastPaint < 60) return; lastPaint = now;
          const bubs = container.querySelectorAll('.tnp-msg.ai .tnp-bub');
          const b = bubs[bubs.length-1];
          if(b && partial){ b.classList.remove('tnp-typing'); b.innerHTML = renderMarkdownLite(tnStripTags(partial, true)) || '…'; scrollMsgs(); }
        });
        ai.text = r.text;
        applyTags(tnParseTags(r.text));
        L.turns = (L.turns||0) + 1;
      }catch(e){
        if(e && e.name==='AbortError'){ if(!ai.text) L.msgs.pop(); else ai.text += '\n\n_(đã dừng)_'; }
        else { console.error('[Tập huấn] AI lỗi:', e); L.msgs.pop(); L.msgs.push({ role:'assistant', text:'Xin lỗi, trợ giảng đang bận hoặc mạng chập chờn. Mình bấm gửi lại sau ít giây nhé.', at:new Date().toISOString(), error:true }); }
      }finally{
        sending = false; abort = null;
        L.msgs = L.msgs.filter(m=> !(m.error && m!==L.msgs[L.msgs.length-1]));
        saveLocal(); syncRemote(); paint();
      }
    }
    function applyTags(t){
      if(t.level) L.level = t.level;
      L.lessons = L.lessons || {};
      t.start.forEach(n=>{ const id = lessonIdx(n); if(id && L.lessons[id]!=='done') L.lessons[id] = 'learning'; });
      t.done.forEach(n=>{ const id = lessonIdx(n); if(id) L.lessons[id] = 'done'; });
      t.stuck.forEach(s=>{ L.struggles = (L.struggles||[]).concat([{ lesson: lessonIdx(s.n) || null, text: s.text, at: new Date().toISOString() }]).slice(-30); });
      if(allDone() && !hasQuiz()) markComplete();
    }
    // ---- Bài kiểm tra cuối ----
    function startQuiz(){
      if(!hasQuiz()) return;
      quizRun = { items: tnPickQuiz(course), i:0, picks:[], checked:false };
      screen = 'quiz'; paint();
    }
    function paintQuiz(){
      const q = quizRun.items[quizRun.i], n = quizRun.items.length, pick = quizRun.picks[quizRun.i];
      shell(`${headHtml()}
        <section class="tnp-card tnp-quiz">
          <div class="tnp-quiz-top"><b>Bài kiểm tra cuối</b><span>Câu ${quizRun.i+1}/${n}</span></div>
          <div class="tnp-prog-bar"><span style="width:${Math.round(quizRun.i/n*100)}%;"></span></div>
          <h2 class="tnp-quiz-q">${escapeHtml(q.q)}</h2>
          <div class="tnp-quiz-opts">${q.options.map((o,k)=>{
            const cls = quizRun.checked ? (k===q.answer ? 'right' : (k===pick ? 'wrong' : '')) : (k===pick ? 'picked' : '');
            return `<button class="tnp-qopt ${cls}" data-k="${k}" ${quizRun.checked?'disabled':''}><span>${'ABCD'[k]}</span>${escapeHtml(o)}</button>`; }).join('')}</div>
          ${quizRun.checked ? `<div class="tnp-quiz-fb ${pick===q.answer ? 'ok' : 'no'}"><b>${pick===q.answer ? '✅ Chính xác!' : '❌ Chưa đúng.'}</b>${q.explain ? ` ${escapeHtml(q.explain)}` : ''}</div>` : ''}
          <div class="tnp-quiz-nav">
            <button class="tnp-btn" id="tnp-q-exit">‹ Về lớp học</button>
            ${quizRun.checked ? `<button class="tnp-btn tnp-btn-main" id="tnp-q-next">${quizRun.i+1<n ? 'Câu tiếp theo ›' : 'Xem kết quả ›'}</button>` : `<button class="tnp-btn tnp-btn-main" id="tnp-q-check" ${pick==null?'disabled':''}>Chọn xong</button>`}
          </div>
        </section>${foot}`);
      container.querySelectorAll('.tnp-qopt').forEach(b=> b.onclick = ()=>{ quizRun.picks[quizRun.i] = +b.dataset.k; paint(); });
      container.querySelector('#tnp-q-exit').onclick = ()=>{ if(confirm('Thoát bài kiểm tra? Lần làm này sẽ không được tính.')){ quizRun = null; screen = 'chat'; paint(); } };
      const ck = container.querySelector('#tnp-q-check'); if(ck) ck.onclick = ()=>{ quizRun.checked = true; paint(); };
      const nx = container.querySelector('#tnp-q-next'); if(nx) nx.onclick = ()=>{
        if(quizRun.i+1 < n){ quizRun.i++; quizRun.checked = false; paint(); window.scrollTo(0,0); }
        else finishQuiz();
      };
    }
    function finishQuiz(){
      const items = quizRun.items, right = items.filter((q,i)=> quizRun.picks[i]===q.answer).length;
      const pct = Math.round(right/items.length*100), pass = pct >= tnSettings(course).passPercent;
      const prev = L.quiz || { best:0, attempts:0 };
      L.quiz = { best: Math.max(prev.best||0, pct), last: pct, attempts: (prev.attempts||0)+1, passed: !!(prev.passed || pass), at: new Date().toISOString() };
      const wrong = items.filter((q,i)=> quizRun.picks[i]!==q.answer);
      L.review = pass ? [] : wrong.map(q=> `${q.q} → đáp án đúng: ${q.options[q.answer]}`).slice(0,10);
      wrong.forEach(q=>{ L.struggles = (L.struggles||[]).concat([{ lesson: q.lessonId, text: `Bài kiểm tra: sai câu "${q.q.slice(0,120)}"`, at: new Date().toISOString() }]).slice(-30); });
      if(pass) markComplete();
      saveLocal(); syncRemote();
      const res = { right, n: items.length, pct, pass };
      quizRun = null;
      shell(`${headHtml()}
        <section class="tnp-card tnp-result ${pass ? 'pass' : 'fail'}">
          <div class="tnp-result-ico">${pass ? '🏅' : '💪'}</div>
          <h2>${pass ? 'Chúc mừng! Đã đạt bài kiểm tra' : 'Chưa đạt — mình ôn lại chút nhé'}</h2>
          <div class="tnp-score"><b>${res.right}/${res.n}</b> câu đúng · <b>${res.pct}%</b></div>
          <p>${pass ? `Mức đạt là ${tnSettings(course).passPercent}%. Kết quả đã được gửi tới cán bộ Hội.` : `Cần đúng từ ${tnSettings(course).passPercent}% để đạt. Trợ giảng sẽ ôn lại những câu còn sai, rồi mình làm lại.`}</p>
          ${pass ? `<button class="tnp-btn tnp-btn-main" id="tnp-r-cert">🏅 Xem giấy xác nhận</button><button class="tnp-btn" id="tnp-r-chat">💬 Về lớp học để hỏi thêm</button>`
                 : `<button class="tnp-btn tnp-btn-main" id="tnp-r-review">📖 Ôn lại cùng trợ giảng</button><button class="tnp-btn" id="tnp-r-again">🔁 Làm lại ngay</button>`}
        </section>${foot}`);
      const cert = container.querySelector('#tnp-r-cert'); if(cert) cert.onclick = ()=>{ screen = 'done'; paint(); };
      const ch = container.querySelector('#tnp-r-chat'); if(ch) ch.onclick = ()=>{ screen = 'chat'; paint(); };
      const rv = container.querySelector('#tnp-r-review'); if(rv) rv.onclick = ()=>{ screen = 'chat'; paint(); turn('Nhờ trợ giảng ôn lại giúp những câu kiểm tra mình còn làm sai.'); };
      const ag = container.querySelector('#tnp-r-again'); if(ag) ag.onclick = startQuiz;
      window.scrollTo(0,0);
    }
    function paintDone(){
      shell(`${headHtml()}
        <section class="tnp-card tnp-result pass">
          <div class="tnp-result-ico">🏅</div>
          <h2>Đã hoàn thành bài tập huấn</h2>
          <p>Cảm ơn ${escapeHtml(L.call||'')} ${escapeHtml(L.name||'')} đã dành thời gian học. Kết quả đã được gửi tới cán bộ Hội.</p>
          <div class="tnp-cert" id="tnp-cert"></div>
          <button class="tnp-btn tnp-btn-main" id="tnp-d-dl">⬇️ Tải giấy xác nhận về máy</button>
          <button class="tnp-btn" id="tnp-d-chat">💬 Về lớp học để hỏi thêm</button>
        </section>${foot}`);
      const cv = tnCertCanvas(course, L);
      const img = new Image(); img.src = cv.toDataURL('image/png'); img.alt = 'Giấy xác nhận hoàn thành';
      container.querySelector('#tnp-cert').appendChild(img);
      container.querySelector('#tnp-d-dl').onclick = ()=> cv.toBlob(b=>{ if(b) downloadBlob(`Xac-nhan-tap-huan_${surveyFileSlug(L.name||'hoc-vien')}.png`, b, 'image/png'); }, 'image/png');
      container.querySelector('#tnp-d-chat').onclick = ()=>{ screen = 'chat'; paint(); };
    }

    paint();
    // Học viên quay lại sau khi đã có lịch sử mà lượt trước chưa có câu trả lời (mất mạng giữa chừng) → hỏi lại.
    if(L && screen==='chat' && tnStatus(course).open){
      const m = L.msgs||[];
      if(!m.length) turn('(Học viên vừa vào lớp. Hãy chào và bắt đầu buổi học theo đúng cách dạy.)', true);
    }
    return {
      update(next){
        course = next;
        // Chỉ vẽ lại khi bài bị đóng/xoá hoặc đang ở màn hình chào — không cắt ngang lúc đang trò chuyện/làm bài.
        if(!course || !tnStatus(course).open || screen==='welcome') { if(!sending) paint(); }
      },
      close(){ if(abort) abort.abort(); if(recog) try{ recog.stop(); }catch(e){} },
    };
  }
  function tnOpenPreview(c){
    if(!tnReady(c)){ alert('Bài chưa soạn xong — cần có tài liệu và giáo án trước khi học thử.'); return; }
    const wrap = document.createElement('div');
    wrap.className = 'tnp-preview';
    wrap.innerHTML = `<div class="tnp-preview-bar"><span>🧑‍🎓 Đang học thử như học viên — không lưu kết quả</span><button type="button" class="btn btn-ghost btn-sm preview-allow">✕ Đóng</button></div><div class="tnp-preview-body"></div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('tnp-lock');
    // Chiều cao thanh "Đang học thử" (1 hay 2 dòng tuỳ màn hình) để khung chat vừa khít phần còn lại.
    const fitBar = ()=> wrap.style.setProperty('--tnp-bar', wrap.querySelector('.tnp-preview-bar').offsetHeight + 'px');
    fitBar(); window.addEventListener('resize', fitBar);
    const mount = tnPublicMount(wrap.querySelector('.tnp-preview-body'), { course:c, preview:true });
    wrap.querySelector('.tnp-preview-bar button').onclick = ()=>{ mount.close(); window.removeEventListener('resize', fitBar); wrap.remove(); document.body.classList.remove('tnp-lock'); };
  }
  function renderPublicTrainingPage(id){
    document.body.classList.add('public-training-mode');
    document.title = 'Tập huấn bằng AI - Hoinongdan.sotay.org';
    root.innerHTML = `<div class="tnp"><div class="tnp-loading">Đang mở lớp tập huấn…</div></div>`;
    if(!TN_ID_RE.test(id)){ tnPublicMount(root, { course:null, id }); return; }
    let mount = null;
    rtdb.ref(`trainings/${id}`).on('value', snap=>{
      const c = snap && snap.exists() ? snap.val() : null;
      const visible = c && !c.deleted ? c : null;
      if(visible) document.title = `${visible.title||'Bài tập huấn'} - Tập huấn bằng AI`;
      if(!mount) mount = tnPublicMount(root, { course:visible, id });
      else mount.update(visible);
    }, err=>{
      console.error('[Tập huấn] Không tải được bài:', err);
      root.innerHTML = `<div class="tnp"><div class="tnp-closed"><div>⚠️</div><h2>Không mở được lớp tập huấn</h2><p>Vui lòng kiểm tra kết nối mạng rồi tải lại trang.</p></div></div>`;
    });
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
