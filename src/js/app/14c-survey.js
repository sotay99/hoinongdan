  // =====================================================================
  // 14c-survey.js — Module BIỂU MẪU / KHẢO SÁT / BÀI KIỂM TRA (tách ra từ
  // 14-accounting-settings-bootstrap.js). Nằm GIỮA bản nối (không phải phần cuối)
  // nên KHÔNG chứa khối boot(); mọi hàm khai báo ở đây dùng chung phạm vi IIFE.
  // =====================================================================
  // =====================================================================
  // Module [BIỂU MẪU / KHẢO SÁT / BÀI KIỂM TRA] — kiểu Google Forms.
  // Lưu trữ: surveys/{surveyId} (metadata + câu hỏi, KHÔNG lồng theo wardId để khách bấm link chia
  // sẻ đọc được trực tiếp mà không cần biết wardId) và survey_responses/{surveyId}/{responseId}
  // (câu trả lời — Ai cũng GHI được (nộp bài ẩn danh qua link công khai), nhưng chỉ Chủ mã/Admin
  // mới ĐỌC được để xem kết quả). Danh sách biểu mẫu của 1 mã xã được lọc qua query
  // orderByChild('wardId').equalTo(wardId) — cần thêm ".indexOn":["wardId"] trong Firebase Rules.
  // =====================================================================
  function emptySurveySection(idx){
    return { id: 'sec_'+uid(), title:`Phần ${idx||1}`, description:'' };
  }
  function emptySurveyQuestion(sectionId){
    return { id: 'q_'+uid(), text:'', type:'short', required:false, options:['Phương án 1'], correctAnswers:[], points:0,
      numericOnly:false, optionBranches:['__next__'], sectionId: sectionId||null };
  }
  function emptySurveyDraft(){
    const sec = emptySurveySection(1);
    return { id:null, wardId: wardId(), wardName:(state.config&&state.config.wardName)||'',
      scope: state.surveySpace, ownerEmail: (state.identity&&state.identity.email) || null,
      title:'Biểu mẫu không có tiêu đề', description:'',
      isQuiz:false, sections:[sec], questions:[emptySurveyQuestion(sec.id)], createdAt:null, updatedAt:null, deleted:false, responseCount:0 };
  }
  // Thứ tự câu hỏi trong mảng luôn khớp thứ tự hiển thị (theo thứ tự Phần) — để số thứ tự câu,
  // di chuyển lên/xuống và xuất kết quả đều đúng sau khi di chuyển/nhân bản phần.
  function surveyNormalizeOrder(draft){
    draft.questions = draft.sections.flatMap(sec=> draft.questions.filter(q=> q.sectionId===sec.id));
  }
  function surveyQCanBranch(q){ return q.type==='radio' || q.type==='checkbox' || q.type==='dropdown'; }
  // ---- Chú thích loại câu hỏi (1 dòng ngắn dưới ô "Loại câu hỏi") + bản giải thích đầy đủ khi bấm nút "i"
  // (cùng kiểu nút tròn qbox-info-btn của Sổ vay vốn: bấm hiện khung giải thích ngay bên dưới, bấm lại ẩn).
  const SURVEY_TYPE_HINT = {
    radio:'🔘 Hiện sẵn mọi phương án, người trả lời chỉ chọn được 1.',
    checkbox:'☑️ Hiện sẵn mọi phương án, người trả lời chọn được nhiều.',
    dropdown:'🔽 Thu gọn trong 1 ô, bấm vào mới hiện danh sách để chọn 1.',
  };
  const SURVEY_TYPE_HELP = {
    radio:{ title:'🔘 Trắc nghiệm', items:[
      '<b>Người trả lời thấy:</b> mọi phương án hiện sẵn, mỗi phương án 1 dòng có vòng tròn ◯. Bấm chọn 1 phương án; chọn cái khác thì cái trước tự bỏ.',
      '<b>Nên dùng khi:</b> muốn người trả lời <i>nhìn hết các phương án để cân nhắc</i>. Ví dụ: mức độ hài lòng, có/không, câu đố.',
      'Câu có từ 6 phương án thì có ô tìm nhanh phương án. Chuyển phần theo câu trả lời được. Bài kiểm tra: đặt 1 đáp án đúng.' ] },
    checkbox:{ title:'☑️ Hộp kiểm', items:[
      '<b>Người trả lời thấy:</b> mọi phương án hiện sẵn, mỗi phương án có ô vuông ☐. Tick được <b>nhiều</b> ô, bấm lại để bỏ tick.',
      '<b>Nên dùng khi:</b> câu kiểu <i>"chọn tất cả những gì phù hợp"</i>. Ví dụ: các loại cây đang trồng, các nguồn vốn đã vay.',
      'Câu có từ 6 phương án thì có ô tìm nhanh phương án. Bài kiểm tra: phải chọn <b>đúng và đủ</b> các đáp án đúng, không chọn thừa, mới được điểm.' ] },
    dropdown:{ title:'🔽 Menu thả xuống', items:[
      '<b>Người trả lời thấy:</b> chỉ 1 ô "-- Chọn --". Bấm vào mới hiện danh sách phương án, chọn 1 phương án thì danh sách tự thu gọn lại.',
      '<b>Nên dùng khi:</b> danh sách <b>dài</b>, người trả lời <i>đã biết sẵn</i> đáp án của mình, muốn trang gọn. Ví dụ: chọn ấp, năm sinh, dân tộc.',
      'Câu có từ 6 phương án thì trong danh sách có ô tìm nhanh phương án. Chuyển phần theo câu trả lời được. Bài kiểm tra: đặt 1 đáp án đúng.' ] },
  };
  const surveyTypeTipOpen = {}; // khung giải thích của câu nào đang mở — giữ nguyên qua các lần vẽ lại
  function surveyTypeHelpHtml(type){
    const h = SURVEY_TYPE_HELP[type]; if(!h) return '';
    return `<b>${h.title}</b><ul style="margin:4px 0 6px; padding-left:18px;">${h.items.map(x=>`<li style="margin-bottom:3px;">${x}</li>`).join('')}</ul>
      <div style="border-top:1px dashed var(--line); padding-top:5px;"><b>So sánh nhanh 3 loại:</b> 🔘 Trắc nghiệm: hiện sẵn, chọn <b>1</b> · ☑️ Hộp kiểm: hiện sẵn, chọn <b>nhiều</b> · 🔽 Menu thả xuống: <b>thu gọn</b>, chọn <b>1</b></div>`;
  }
  function hasSurveyPersonalAccount(){ return !!(state.identity && state.identity.email); }
  // Đảm bảo biểu mẫu (kể cả biểu mẫu cũ tạo trước khi có tính năng "Phần") luôn có sections hợp lệ
  // và mỗi câu hỏi có đủ optionBranches/numericOnly — tránh lỗi khi mở sửa/điền phiếu.
  function ensureSurveySections(draft){
    if(!Array.isArray(draft.questions)) draft.questions = draft.questions? Object.values(draft.questions) : [];
    if(!draft.sections || !draft.sections.length){
      const sec = emptySurveySection(1);
      draft.sections = [sec];
      (draft.questions||[]).forEach(q=>{ q.sectionId = sec.id; });
    } else {
      const validIds = draft.sections.map(s=>s.id);
      const firstId = draft.sections[0].id;
      (draft.questions||[]).forEach(q=>{ if(!q.sectionId || !validIds.includes(q.sectionId)) q.sectionId = firstId; });
    }
    (draft.questions||[]).forEach(q=>{
      if(q.numericOnly==null) q.numericOnly = false;
      if(!q.optionBranches || q.optionBranches.length!==(q.options||[]).length) q.optionBranches = (q.options||[]).map(()=>'__next__');
      // Biểu mẫu cũ đã cài rẽ nhánh thì tự bật "Chuyển đến phần dựa trên câu trả lời" — không mất cài đặt.
      if(q.branchEnabled==null) q.branchEnabled = (q.optionBranches||[]).some(b=> b && b!=='__next__');
      if(q.description==null) q.description = '';
    });
    surveyNormalizeOrder(draft);
    return draft;
  }
  // ---- Phân quyền: Bộ DÙNG CHUNG theo publicPerms/grants['survey'] (Cài đặt & Chia sẻ); Bộ CÁ
  // NHÂN chỉ chính chủ tài khoản Google mới xem/sửa/xoá được, không ai khác kể cả Admin. ----
  function surveyCanView(){ return state.surveySpace==='personal' ? hasSurveyPersonalAccount() : canViewModule('survey'); }
  function surveyCanEdit(){ return state.surveySpace==='personal' ? hasSurveyPersonalAccount() : canEditModule('survey'); }

  let surveysListenerRef = null;
  let surveysListenerKey = null; // "shared:{wardId}" hoặc "personal:{email}" — tự gắn lại khi đổi không gian/đổi mã
  function attachSurveysRealtime(){
    let ref, key;
    if(state.surveySpace==='personal'){
      const email = state.identity && state.identity.email;
      if(!email){ state.surveys = []; detachSurveysRealtime(); return; }
      key = 'personal:'+email;
      ref = rtdb.ref('surveys').orderByChild('ownerEmail').equalTo(email);
    } else {
      const wid = wardId();
      if(!wid) return;
      key = 'shared:'+wid;
      ref = rtdb.ref('surveys').orderByChild('wardId').equalTo(wid);
    }
    if(surveysListenerRef && surveysListenerKey===key) return; // đã đúng không gian rồi, khỏi gắn lại
    detachSurveysRealtime();
    surveysListenerKey = key;
    surveysListenerRef = ref;
    surveysListenerRef.on('value', snap=>{
      const all = (snap && snap.exists()) ? Object.values(snap.val()) : [];
      state.surveys = all.filter(s=> !s.deleted && ((state.surveySpace==='personal') ? s.scope==='personal' : s.scope!=='personal'));
      if(state.activeTab==='survey'){ const c = document.getElementById('content'); if(c) renderSurveyTab(c); }
    }, err=> console.error('[Khảo sát] Không tải được danh sách biểu mẫu (kiểm tra Firebase Rules ".indexOn":["wardId","ownerEmail"]):', err));
  }
  function detachSurveysRealtime(){ if(surveysListenerRef){ surveysListenerRef.off(); surveysListenerRef = null; surveysListenerKey = null; } }
  function switchSurveySpace(space){
    if(state.surveySpace===space) return;
    if(space==='personal' && !hasSurveyPersonalAccount()){ alert('Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.'); return; }
    state.surveySpace = space;
    state.surveyView='list'; state.surveyDraft=null; state.surveyEditingId=null;
    attachSurveysRealtime();
    const c = document.getElementById('content'); if(c) renderSurveyTab(c);
  }

  async function saveSurveyDraft(){
    if(!surveyCanEdit()){ alert(state.surveySpace==='personal' ? 'Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.' : 'Đồng chí không có quyền sửa Biểu mẫu dùng chung này.'); return false; }
    const d = state.surveyDraft;
    if(!d.title || !d.title.trim()){ alert('Vui lòng nhập tiêu đề biểu mẫu.'); return false; }
    if(!d.questions.length){ alert('Vui lòng thêm ít nhất 1 câu hỏi.'); return false; }
    for(const q of d.questions){
      if(!q.text || !q.text.trim()){ alert('Có câu hỏi chưa nhập nội dung. Vui lòng kiểm tra lại.'); return false; }
      if(surveyQTypeHasOptions(q.type) && (!q.options || q.options.filter(o=>o.trim()).length<1)){ alert(`Câu hỏi "${q.text}" cần ít nhất 1 phương án.`); return false; }
    }
    const id = d.id || uid();
    const toSave = { ...d, id, wardId: wardId(), wardName:(state.config&&state.config.wardName)||'',
      updatedAt:new Date().toISOString(), createdAt: d.createdAt || new Date().toISOString(),
      responseCount: d.responseCount||0, deleted:false };
    await rtdb.ref(`surveys/${id}`).set(toSave);
    await pushLog(d.id? 'sửa biểu mẫu':'tạo biểu mẫu', toSave.title);
    state.surveyDraft = toSave;
    state.surveyEditingId = id;
    return true;
  }
  async function deleteSurvey(id){
    if(!surveyCanEdit()){ alert(state.surveySpace==='personal' ? 'Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.' : 'Đồng chí không có quyền xoá Biểu mẫu dùng chung này.'); return; }
    const s = state.surveys.find(x=>x.id===id);
    if(!s) return;
    if(!confirm(`Xoá biểu mẫu "${s.title}"? Toàn bộ câu trả lời đã thu thập cũng sẽ bị xoá theo và KHÔNG THỂ khôi phục. Đồng chí có chắc chắn?`)) return;
    await rtdb.ref(`surveys/${id}`).remove();
    await rtdb.ref(`survey_responses/${id}`).remove();
    await pushLog('xoá biểu mẫu', s.title);
    if(state.surveyEditingId===id){ state.surveyView='list'; state.surveyEditingId=null; state.surveyDraft=null; }
    render();
  }
  function surveyShareUrl(surveyId){
    return `${location.origin}${location.pathname}#/khaosat/${surveyId}`;
  }
  async function loadSurveyResponses(surveyId){
    try{
      const snap = await rtdb.ref(`survey_responses/${surveyId}`).get();
      state.surveyResponses = (snap && snap.exists()) ? Object.values(snap.val()).sort((a,b)=> (a.submittedAt||'').localeCompare(b.submittedAt||'')) : [];
    }catch(e){ console.error('[Khảo sát] Không tải được câu trả lời:', e); state.surveyResponses = []; }
    state.surveyResponseViewIndex = 0;
  }
  // Thống kê 1 câu hỏi trên toàn bộ câu trả lời hiện có — trắc nghiệm/hộp kiểm/dropdown ra % theo
  // từng phương án; tự luận (ngắn/đoạn văn) ra danh sách câu trả lời dạng chữ.
  function computeQuestionStats(question, responses){
    if(surveyQTypeHasOptions(question.type)){
      const counts = {}; (question.options||[]).forEach(o=> counts[o]=0);
      responses.forEach(r=>{
        const ans = r.answers && r.answers[question.id];
        if(ans==null || ans==='') return;
        const arr = Array.isArray(ans) ? ans : [ans];
        arr.forEach(a=>{ counts[a] = (counts[a]||0) + 1; });
      });
      const total = responses.length || 1;
      return Object.entries(counts).map(([opt,cnt])=>({ opt, cnt, pct: Math.round((cnt/total)*100) }));
    }
    return responses.map(r=> (r.answers && r.answers[question.id]) || '').filter(s=>s);
  }
  function computeSurveyScore(survey, answers){
    let score = 0, maxScore = 0;
    (survey.questions||[]).forEach(q=>{
      if(!surveyQTypeHasOptions(q.type)) return;
      maxScore += parseFloat(q.points)||0;
      const correct = q.correctAnswers||[];
      if(!correct.length) return;
      const given = answers[q.id];
      if(q.type==='checkbox'){
        const givenArr = Array.isArray(given) ? given : [];
        const isCorrect = correct.length===givenArr.length && correct.every(c=>givenArr.includes(c));
        if(isCorrect) score += parseFloat(q.points)||0;
      } else if(given!=null && correct.includes(given)){
        score += parseFloat(q.points)||0;
      }
    });
    return { score: Math.round(score*100)/100, maxScore: Math.round(maxScore*100)/100 };
  }
  // Nộp bài từ giao diện CÔNG KHAI (không cần đăng nhập) — ghi vào survey_responses/{id} (Rules
  // cho phép ai cũng GHI được ở đây) và tăng bộ đếm responseCount bằng transaction (an toàn với
  // nhiều người nộp cùng lúc).
  // ---- GĐ4: Kiểm soát nhận phiếu ----
  // acceptResponses (mặc định true) · closeAt (ISO, '' = không hạn) · maxResponses (0 = không giới hạn)
  // closedMessage · identifyMode 'none'|'browser'|'google' · perPersonLimit 0 (không giới hạn)|1|2|3
  // LƯU Ý: các giới hạn này chặn ở phía trang web; luật Firebase đang mở nên chưa chặn tuyệt đối.
  function surveyAcceptState(s, now){
    if(!s) return { open:false, reason:'closed' };
    if(s.acceptResponses===false) return { open:false, reason:'closed' };
    if(s.closeAt && new Date(s.closeAt).getTime() <= (now||Date.now())) return { open:false, reason:'expired' };
    const max = parseInt(s.maxResponses,10)||0;
    if(max>0 && (s.responseCount||0) >= max) return { open:false, reason:'full' };
    return { open:true, reason:null };
  }
  function surveyAcceptLabel(st){
    return st.open? '🟢 Đang nhận phiếu' : ({ closed:'🔴 Đã đóng', expired:'⏰ Đã hết hạn nộp', full:'🈵 Đã đủ số phiếu' }[st.reason] || '🔴 Đã đóng');
  }
  function surveyFmtDateTime(iso){ if(!iso) return ''; const d = new Date(iso); return isNaN(d)? '' : d.toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' }); }
  function surveyIsoToLocalInput(iso){ if(!iso) return ''; const d = new Date(iso); if(isNaN(d)) return ''; const p = n=> String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
  function surveyBrowserId(){
    try{ let id = localStorage.getItem('hnd_sv_bid'); if(!id){ id = 'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,10); localStorage.setItem('hnd_sv_bid', id); } return id; }
    catch(e){ return null; }
  }
  // Khoá định danh người trả lời theo chế độ của biểu mẫu (null = không nhận biết).
  function surveyRespondentKey(survey, user){
    if(survey.identifyMode==='google') return (user && user.email)? 'g_'+emailToKey(user.email.toLowerCase().trim()) : null;
    if(survey.identifyMode==='browser'){ const b = surveyBrowserId(); return b? 'b_'+b : null; }
    return null;
  }
  async function surveyRespondentCount(surveyId, key){
    if(!key) return 0;
    try{ const snap = await rtdb.ref(`survey_respondents/${surveyId}/${key}`).get(); return (snap && snap.exists())? (parseInt(snap.val(),10)||0) : 0; }
    catch(e){ console.warn('[Khảo sát] Không đọc được số lần đã trả lời:', e); return 0; }
  }
  async function submitPublicSurveyResponse(survey, answers, meta){
    // Chỉ kiểm tra bắt buộc với câu hỏi CÓ mặt trong answers (tức thuộc Phần người dùng đã thực sự
    // đi qua) — câu hỏi ở Phần bị bỏ qua do phân nhánh sẽ không có key trong answers nên bỏ qua.
    const missing = (survey.questions||[]).some(q=>{
      if(!q.required) return false;
      if(!(q.id in answers)) return false;
      const v = answers[q.id];
      return v==null || v==='' || (Array.isArray(v) && v.length===0);
    });
    if(missing) return { ok:false, reason:'missing' };
    const id = 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    const entry = { id, submittedAt:new Date().toISOString(), answers };
    if(meta && meta.respondentKey){ entry.respondentKey = meta.respondentKey; entry.attempt = meta.attempt||1; }
    if(meta && meta.email) entry.respondentEmail = meta.email;
    if(survey.isQuiz){
      const { score, maxScore } = computeSurveyScore(survey, answers);
      entry.score = score; entry.maxScore = maxScore;
    }
    try{
      await rtdb.ref(`survey_responses/${survey.id}/${id}`).set(entry);
      await rtdb.ref(`surveys/${survey.id}/responseCount`).transaction(cur=> (cur||0)+1);
      if(meta && meta.respondentKey) await rtdb.ref(`survey_respondents/${survey.id}/${meta.respondentKey}`).transaction(cur=> (parseInt(cur,10)||0)+1);
      return { ok:true, entry };
    }catch(e){
      console.error('[Khảo sát] Gửi câu trả lời lỗi:', e);
      return { ok:false, reason:'error' };
    }
  }

  function renderSurveyTab(el){
    attachSurveysRealtime();
    if(state.surveyView==='editor' && state.surveyDraft){
      renderSurveyEditorView(el);
    } else {
      renderSurveyListView(el);
    }
  }

  // ---- Danh sách biểu mẫu: tìm theo tên (không cần dấu), lọc loại, sắp xếp; giữ lại trong phiên làm việc ----
  const SURVEY_LIST_SORTS = [
    ['created_desc','Mới tạo nhất'], ['created_asc','Cũ nhất'], ['updated_desc','Mới sửa gần nhất'],
    ['name_asc','Tên A → Z'], ['name_desc','Tên Z → A'], ['resp_desc','Nhiều người trả lời nhất'], ['resp_asc','Ít người trả lời nhất'],
  ];
  function surveyListFilter(){ return state.surveyListFilter || (state.surveyListFilter = { q:'', type:'all', sort:'created_desc' }); }
  function surveyListFilterLabels(F){
    const out = [];
    if(F.q.trim()) out.push(`Tên có chứa "${F.q.trim()}"`);
    if(F.type!=='all') out.push(F.type==='quiz'? 'Chỉ Bài kiểm tra' : 'Chỉ Khảo sát');
    return out;
  }
  function surveyApplyListFilter(list, F){
    const term = surveyFold(F.q.trim());
    let out = list.filter(s=> (!term || surveyFold(s.title||'').includes(term)) && (F.type==='all' || (F.type==='quiz')===!!s.isQuiz));
    const by = {
      created_desc:(a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''),
      created_asc:(a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''),
      updated_desc:(a,b)=> (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''),
      name_asc:(a,b)=> (a.title||'').localeCompare(b.title||'', 'vi', {sensitivity:'base'}),
      name_desc:(a,b)=> (b.title||'').localeCompare(a.title||'', 'vi', {sensitivity:'base'}),
      resp_desc:(a,b)=> (b.responseCount||0)-(a.responseCount||0),
      resp_asc:(a,b)=> (a.responseCount||0)-(b.responseCount||0),
    }[F.sort] || ((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    return out.sort(by);
  }
  // Tô vàng phần tên khớp chữ đang tìm (so khớp không dấu, tô trên chữ gốc).
  function surveyHighlight(text, q){
    const t = String(text||''), term = surveyFold(String(q||'').trim());
    const pos = term? surveyFold(t).indexOf(term) : -1;
    if(pos<0) return escapeHtml(t);
    const ch = Array.from(t), n = Array.from(term).length;
    return escapeHtml(ch.slice(0,pos).join('')) + '<mark style="background:#fff176; padding:0 1px;">' + escapeHtml(ch.slice(pos,pos+n).join('')) + '</mark>' + escapeHtml(ch.slice(pos+n).join(''));
  }
  // Nhân bản 1 biểu mẫu: chép toàn bộ phần + câu hỏi + cài đặt sang biểu mẫu MỚI (không chép câu trả lời),
  // lưu ngay rồi mở trình soạn của bản sao.
  async function duplicateSurvey(id, el){
    if(!surveyCanEdit()){ alert('Đồng chí không có quyền tạo biểu mẫu ở đây.'); return; }
    const src = state.surveys.find(x=>x.id===id); if(!src) return;
    const now = new Date().toISOString();
    const copy = JSON.parse(JSON.stringify(src));
    Object.assign(copy, { id: uid(), title: `Bản sao của ${src.title||'biểu mẫu'}`.slice(0,300), createdAt: now, updatedAt: now, responseCount: 0, deleted: false,
      scope: state.surveySpace, ownerEmail: (state.identity&&state.identity.email) || src.ownerEmail || null, wardId: wardId(), wardName: (state.config&&state.config.wardName)||'' });
    try{
      await rtdb.ref(`surveys/${copy.id}`).set(copy);
      await pushLog('nhân bản biểu mẫu', `${src.title} -> ${copy.title}`);
    }catch(e){ console.error('[Khảo sát] Nhân bản lỗi:', e); alert('Không nhân bản được biểu mẫu: '+(e&&e.message||e)); return; }
    showToast('Đã nhân bản biểu mẫu — đang mở bản sao để chỉnh sửa.');
    state.surveyDraft = ensureSurveySections(JSON.parse(JSON.stringify(copy)));
    state.surveyEditingId = copy.id;
    state.surveyEditorTab = 'questions';
    state.surveyView = 'editor';
    renderSurveyTab(el);
  }
  function renderSurveyListView(el){
    const isShared = state.surveySpace==='shared';
    const canEdit = surveyCanEdit();
    const canView = surveyCanView();
    const F = surveyListFilter();
    const all = state.surveys.slice();
    const list = surveyApplyListFilter(all, F);
    const active = surveyListFilterLabels(F);
    const red = 'border:2px solid #d32f2f;';
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>BIỂU MẪU/KHẢO SÁT/BÀI KIỂM TRA</h3></div>
        <div class="panel-body">
          <p class="sub" style="margin-top:0;">Giúp tạo các biểu mẫu để KHẢO SÁT hội viên, nhân dân, thu thập thông tin mọi người, hoặc lấy ý kiến và lắng nghe trình báo từ người khác, hoặc tạo bài kiểm tra cho mọi người, tạo cuộc thi trực tuyến và chấm điểm tự động, ... người tham gia khảo sát (hoặc làm bài kiểm tra) sẽ được tham gia khảo sát / làm bài kiểm tra bằng đường link do đồng chí cung cấp!</p>
          <div class="toolbar" style="margin-bottom:14px;">
            <button class="btn ${isShared?'btn-primary':'btn-ghost'} btn-sm" id="sv-space-shared">🏛️ Biểu mẫu dùng chung xã/phường</button>
            <button class="btn ${!isShared?'btn-primary':'btn-ghost'} btn-sm" id="sv-space-personal">🔒 Biểu mẫu cá nhân</button>
          </div>
          ${!canView? `<div class="empty-state" style="padding:30px;"><div class="e-ico">🔒</div>${isShared? 'Đồng chí không có quyền xem Biểu mẫu dùng chung của mã xã này. Vui lòng liên hệ Chủ mã để được cấp quyền tại "Cài đặt & Chia sẻ".' : 'Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.'}</div>` : `
          ${canEdit? `<button class="btn btn-primary" id="sv-new-btn">➕ Tạo biểu mẫu mới</button>` : `<p class="sub">Đồng chí chỉ có quyền xem ở ${isShared?'Biểu mẫu dùng chung này':'đây'}.</p>`}
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-top:14px;">
            <input id="sv-f-q" value="${escapeHtml(F.q)}" placeholder="🔍 Tìm theo tên biểu mẫu (không cần gõ dấu)…" autocomplete="off" style="flex:1 1 240px; min-width:0; ${F.q.trim()? red : ''}">
            <select id="sv-f-type" title="Lọc theo loại" style="${F.type!=='all'? red : ''}">
              <option value="all" ${F.type==='all'?'selected':''}>Tất cả loại</option>
              <option value="survey" ${F.type==='survey'?'selected':''}>📝 Khảo sát</option>
              <option value="quiz" ${F.type==='quiz'?'selected':''}>📋 Bài kiểm tra</option>
            </select>
            <select id="sv-f-sort" title="Sắp xếp">${SURVEY_LIST_SORTS.map(([k,l])=>`<option value="${k}" ${F.sort===k?'selected':''}>${l}</option>`).join('')}</select>
            ${active.length? `<button class="btn btn-ghost btn-sm preview-allow reset-filter-active" id="sv-f-reset">↺ Bỏ lọc</button>` : ''}
          </div>
          ${active.length? `<p style="color:#b71c1c; font-weight:800; margin:8px 0 0;">Đang áp dụng lọc kết quả: ${active.map(escapeHtml).join(', ')}</p>` : ''}
          <p class="sub" style="margin:6px 0 0;">Đang hiện ${list.length}/${all.length} biểu mẫu.</p>
          <div class="table-wrap" style="margin-top:8px;">
            <table>
              <thead><tr><th>Tên biểu mẫu</th><th>Ngày tạo</th><th>Số người đã trả lời</th><th></th></tr></thead>
              <tbody>
                ${list.length? list.map(s=>`
                  <tr>
                    <td><b>${surveyHighlight(s.title, F.q)}</b>${s.isQuiz? ' <span class="pill pill-gray">Bài kiểm tra</span>' : ''}<div class="sub" style="margin-top:2px;">${surveyAcceptLabel(surveyAcceptState(s))}${s.closeAt? ' · hạn '+escapeHtml(surveyFmtDateTime(s.closeAt)) : ''}</div></td>
                    <td>${s.createdAt? fmtDate(s.createdAt.slice(0,10)) : '—'}</td>
                    <td>${s.responseCount||0}</td>
                    <td style="white-space:nowrap; display:flex; gap:6px;">
                      <button class="btn btn-ghost btn-sm" data-sv-open="${s.id}">${canEdit? 'Sửa / Xem kết quả' : 'Xem kết quả'}</button>
                      <button class="btn btn-ghost btn-sm" data-sv-copy="${s.id}">🔗 Copy link</button>
                      ${canEdit? `<button class="btn btn-ghost btn-sm preview-allow" data-sv-dup="${s.id}" title="Tạo 1 biểu mẫu mới giống hệt (không chép câu trả lời)">📑 Nhân bản</button>` : ''}
                      ${canEdit? `<button class="btn btn-ghost btn-sm" data-sv-delete="${s.id}" style="color:var(--red);">Xoá</button>` : ''}
                    </td>
                  </tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="e-ico">📝</div>${all.length? 'Không có biểu mẫu nào khớp bộ lọc.' : `Chưa có biểu mẫu nào${canEdit? ' — bấm "Tạo biểu mẫu mới" để bắt đầu' : ''}`}</div></td></tr>`}
              </tbody>
            </table>
          </div>`}
        </div>
      </div>`;
    const spaceSharedBtn = document.getElementById('sv-space-shared');
    if(spaceSharedBtn) spaceSharedBtn.onclick = ()=> switchSurveySpace('shared');
    const spacePersonalBtn = document.getElementById('sv-space-personal');
    if(spacePersonalBtn) spacePersonalBtn.onclick = ()=> switchSurveySpace('personal');
    const fq = document.getElementById('sv-f-q');
    if(fq) fq.oninput = ()=>{ const caret = fq.selectionStart; F.q = fq.value; renderSurveyListView(el); const again = document.getElementById('sv-f-q'); if(again){ again.focus(); try{ again.setSelectionRange(caret, caret); }catch(e){} } };
    const ft = document.getElementById('sv-f-type'); if(ft) ft.onchange = ()=>{ F.type = ft.value; renderSurveyListView(el); };
    const fs = document.getElementById('sv-f-sort'); if(fs) fs.onchange = ()=>{ F.sort = fs.value; renderSurveyListView(el); };
    const fr = document.getElementById('sv-f-reset'); if(fr) fr.onclick = ()=>{ F.q = ''; F.type = 'all'; renderSurveyListView(el); };
    document.querySelectorAll('[data-sv-dup]').forEach(btn=> btn.onclick = ()=> duplicateSurvey(btn.dataset.svDup, el));
    const newBtn = document.getElementById('sv-new-btn');
    if(newBtn) newBtn.onclick = ()=>{
      state.surveyDraft = emptySurveyDraft();
      state.surveyEditingId = null;
      state.surveyEditorTab = 'questions';
      state.surveyView = 'editor';
      renderSurveyTab(el);
    };
    document.querySelectorAll('[data-sv-open]').forEach(btn=>{
      btn.onclick = ()=>{
        const s = state.surveys.find(x=>x.id===btn.dataset.svOpen);
        if(!s) return;
        state.surveyDraft = ensureSurveySections(JSON.parse(JSON.stringify(s)));
        state.surveyEditingId = s.id;
        state.surveyEditorTab = 'questions';
        state.surveyResponseDetailOpen = false;
        state.surveyResponseViewIndex = 0;
        state.surveyView = 'editor';
        renderSurveyTab(el);
      };
    });
    document.querySelectorAll('[data-sv-copy]').forEach(btn=>{
      btn.onclick = ()=> copyMessageText(surveyShareUrl(btn.dataset.svCopy));
    });
    document.querySelectorAll('[data-sv-delete]').forEach(btn=>{
      btn.onclick = ()=> deleteSurvey(btn.dataset.svDelete);
    });
  }

  function renderSurveyQuestionCardHtml(q, idx, isQuiz, canEdit, sections){
    const isFreeText = (q.type==='short' || q.type==='paragraph');
    const branchOn = surveyQCanBranch(q) && sections && sections.length>1 && q.branchEnabled;
    const showDesc = q.showDesc || !!q.description;
    const pills = [
      branchOn? '🔀 Chuyển phần theo câu trả lời' : '',
      (surveyQTypeHasOptions(q.type) && q.shuffleOptions)? '🔀 Xáo trộn thứ tự phương án' : '',
    ].filter(Boolean);
    return `
    <div class="panel" style="margin-bottom:10px; border:1px solid var(--line);" data-qcard="${q.id}">
      <div class="panel-body">
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <b style="padding-top:10px;">${idx+1}.</b>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; gap:8px; align-items:flex-start; margin-bottom:8px;">
              <input class="q-text" data-qid="${q.id}" value="${escapeHtml(q.text)}" placeholder="Nội dung câu hỏi..." style="flex:1; min-width:0; font-weight:700;" ${canEdit?'':'disabled'}>
              ${canEdit? `<button type="button" class="btn btn-sm sv-kebab sv-kebab-q preview-allow" data-qmenu="${q.id}" data-pop-anchor title="Tuỳ chọn cho câu hỏi này">☰</button>` : ''}
            </div>
            ${showDesc? `<input class="q-desc" data-qid="${q.id}" value="${escapeHtml(q.description||'')}" placeholder="Mô tả câu hỏi (không bắt buộc)" style="width:100%; font-size:12.5px; margin-bottom:8px;" ${canEdit?'':'disabled'}>` : ''}
            ${pills.length? `<div>${pills.map(p=>`<span class="sv-pill">${p}</span>`).join('')}</div>` : ''}
            <div class="form-grid">
              <div class="field"><label>Loại câu hỏi</label>
                <select class="q-type" data-qid="${q.id}" ${canEdit?'':'disabled'}>${SURVEY_QTYPES.map(t=>`<option value="${t.key}" ${q.type===t.key?'selected':''}>${t.label}</option>`).join('')}</select>
                ${SURVEY_TYPE_HINT[q.type]? `<div class="sv-type-hint"><span>${SURVEY_TYPE_HINT[q.type]}</span><button type="button" class="qbox-info-btn preview-allow" data-qtype-info="${q.id}" title="Xem giải thích đầy đủ" style="width:20px; height:20px; font-size:11px; border-radius:50%; flex-shrink:0;">i</button></div>` : ''}
              </div>
              <div class="field"><label>&nbsp;</label>
                <label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="q-required" data-qid="${q.id}" ${q.required?'checked':''} ${canEdit?'':'disabled'}><span>Bắt buộc trả lời</span></label>
              </div>
              ${isFreeText? `<div class="field"><label>&nbsp;</label>
                <label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="q-numeric" data-qid="${q.id}" ${q.numericOnly?'checked':''} ${canEdit?'':'disabled'}><span>🔢 Chỉ nhập số</span></label>
              </div>` : ''}
            </div>
            ${SURVEY_TYPE_HELP[q.type]? `<div class="sv-type-tip" data-qtype-tip="${q.id}" style="display:${surveyTypeTipOpen[q.id]? 'block' : 'none'};">${surveyTypeHelpHtml(q.type)}</div>` : ''}
            ${isFreeText? `<p class="sub" style="margin:4px 0;">${q.numericOnly? '🔢 Người trả lời chỉ được nhập chữ số và dấu phẩy (,) — tự động tách cụm 3 số khi gõ.' : ''}</p>` : ''}
            ${surveyQTypeHasOptions(q.type)? `
              ${(q.options||[]).length>=SURVEY_OPT_SEARCH_MIN? `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:4px 0 8px;"><input class="q-opt-search" data-qid="${q.id}" value="${escapeHtml(surveyEditorOptSearch[q.id]||'')}" placeholder="🔍 Tìm phương án trong câu này (không cần gõ dấu)…" autocomplete="off" style="flex:1 1 220px; min-width:0;"><span class="sub q-opt-found" data-qid="${q.id}"></span></div>` : ''}
              <div class="q-options-list" data-qid="${q.id}">
                ${(q.options||[]).slice(0, surveyOptLimit(q)).map((opt,oi)=>`
                  <div class="q-opt-row" data-opt-norm="${escapeHtml(surveyFold(opt))}" style="display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;">
                    ${isQuiz? `<label class="sv-filter-item sv-opt sv-opt-fit sv-opt-correct" title="Đánh dấu là đáp án đúng"><input type="checkbox" class="q-correct" data-qid="${q.id}" data-oi="${oi}" ${(q.correctAnswers||[]).includes(opt)?'checked':''} ${canEdit?'':'disabled'}><span>Đúng</span></label>` : ''}
                    <input class="q-option-text" data-qid="${q.id}" data-oi="${oi}" value="${escapeHtml(opt)}" style="flex:1; min-width:120px;" placeholder="Phương án ${oi+1}" ${canEdit?'':'disabled'}>
                    ${branchOn? `<select class="q-option-branch" data-qid="${q.id}" data-oi="${oi}" style="font-size:11.5px;" ${canEdit?'':'disabled'}>
                      <option value="__next__" ${(q.optionBranches&&q.optionBranches[oi])==='__next__'||!q.optionBranches?'selected':''}>→ Tiếp tục sang phần tiếp theo</option>
                      ${sections.map(s=>`<option value="${s.id}" ${(q.optionBranches&&q.optionBranches[oi])===s.id?'selected':''}>→ Chuyển đến "${escapeHtml(s.title)}"</option>`).join('')}
                      <option value="__submit__" ${(q.optionBranches&&q.optionBranches[oi])==='__submit__'?'selected':''}>→ Gửi biểu mẫu</option>
                    </select>` : ''}
                    ${canEdit? `<button class="btn btn-ghost btn-sm q-option-remove" data-qid="${q.id}" data-oi="${oi}">✕</button>` : ''}
                  </div>`).join('')}
              </div>
              ${(q.options||[]).length>surveyOptLimit(q)? `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:2px 0 8px;"><span class="sub">Đang hiện ${surveyOptLimit(q)}/${q.options.length} phương án.</span><button type="button" class="btn btn-ghost btn-sm q-opt-more preview-allow" data-qid="${q.id}">Hiện thêm ${Math.min(SURVEY_EDITOR_OPT_PAGE, q.options.length-surveyOptLimit(q))}</button><button type="button" class="btn btn-ghost btn-sm q-opt-all preview-allow" data-qid="${q.id}">Hiện tất cả ${q.options.length} phương án</button></div>` : ''}
              ${canEdit? `<div style="display:flex; flex-wrap:wrap; gap:6px;"><button class="btn btn-ghost btn-sm q-add-option" data-qid="${q.id}">➕ Thêm phương án</button><button class="btn btn-ghost btn-sm q-paste-options preview-allow" data-qid="${q.id}">📋 Dán nhiều phương án</button><span class="sub" style="align-self:center;">${(q.options||[]).length} phương án</span></div>` : ''}
              ${isQuiz? `<div class="field" style="max-width:180px; margin-top:8px;"><label>Số điểm câu này</label><input type="number" class="q-points" data-qid="${q.id}" value="${q.points||0}" ${canEdit?'':'disabled'}></div>` : ''}
            ` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderSurveyQuestionsEditorHtml(draft, canEdit){
    ensureSurveySections(draft);
    return `
      <div class="form-grid">
        <div class="field full"><label>Tiêu đề biểu mẫu *</label><input id="sv-title" value="${escapeHtml(draft.title)}" ${canEdit?'':'disabled'}></div>
        <div class="field full"><label>Mô tả biểu mẫu</label><textarea id="sv-desc" rows="2" ${canEdit?'':'disabled'}>${escapeHtml(draft.description)}</textarea></div>
      </div>
      <div style="margin:10px 0;"><label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" id="sv-isquiz" ${draft.isQuiz?'checked':''} ${canEdit?'':'disabled'}><span>📋 Đặt làm bài kiểm tra (cho phép chấm điểm đáp án đúng)</span></label></div>
      <div id="sv-sections-list">
        ${draft.sections.map((sec, si)=>{
          const secQuestions = draft.questions.filter(q=>q.sectionId===sec.id);
          return `
          <div class="panel" style="margin-bottom:16px; border:2px solid #1565c0;" data-section-card="${sec.id}">
            <div class="panel-head sv-sec-head" style="display:flex; align-items:center; gap:8px;">
              <h3>📑 Phần ${si+1}/${draft.sections.length}${(sec.title||'').trim()? ' — '+escapeHtml(sec.title.trim()) : ''}${secQuestions.length? '' : ' <span style="font-weight:400; opacity:.85;">(chưa có câu hỏi)</span>'}</h3>
              ${canEdit? `<button type="button" class="btn btn-sm sv-kebab sv-kebab-sec preview-allow" data-secmenu="${sec.id}" data-pop-anchor title="Tuỳ chọn cho phần này" style="margin-left:auto;">☰</button>` : ''}
            </div>
            <div class="panel-body">
              <div class="form-grid">
                <div class="field full"><label>Tiêu đề phần</label><input class="sec-title" data-secid="${sec.id}" value="${escapeHtml(sec.title)}" ${canEdit?'':'disabled'}></div>
                <div class="field full"><label>Mô tả phần (không bắt buộc)</label><input class="sec-desc" data-secid="${sec.id}" value="${escapeHtml(sec.description||'')}" ${canEdit?'':'disabled'}></div>
              </div>
              ${secQuestions.map((q)=> renderSurveyQuestionCardHtml(q, draft.questions.indexOf(q), draft.isQuiz, canEdit, draft.sections)).join('')}
              ${canEdit? `<button class="btn btn-ghost btn-sm sec-add-question" data-secid="${sec.id}">➕ Thêm câu hỏi vào phần này</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
      ${canEdit? `<div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" id="sv-add-section-btn">➕ Thêm phần</button>
        <button class="btn btn-primary btn-sm sv-save-action" id="sv-save-btn-bottom" style="margin-left:auto;">💾 Lưu biểu mẫu</button>
      </div>` : ''}`;
  }

  function renderSurveySummaryHtml(draft, responses){
    return draft.questions.map((q,qi)=>{
      const stats = computeQuestionStats(q, responses);
      let body;
      if(surveyQTypeHasOptions(q.type)){
        body = `<div style="display:flex; flex-direction:column; gap:8px;">${stats.map(s=>`
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px;"><span>${escapeHtml(s.opt)}</span><span>${s.cnt} (${s.pct}%)</span></div>
            <div style="background:var(--paper-2); border-radius:6px; height:8px; overflow:hidden;"><div style="width:${s.pct}%; height:100%; background:var(--gold);"></div></div>
          </div>`).join('')}</div>`;
      } else {
        body = stats.length? `<div style="display:flex; flex-direction:column; gap:6px; max-height:220px; overflow:auto;">${stats.map(a=>`<div class="kv-row" style="border:1px solid var(--line); border-radius:8px; padding:8px 10px;">${escapeHtml(a)}</div>`).join('')}</div>` : '<div class="sub">Chưa có câu trả lời nào cho câu này.</div>';
      }
      return `<div class="panel" style="margin-bottom:10px;"><div class="panel-head"><h3 style="font-size:14px;">${qi+1}. ${escapeHtml(q.text)}</h3></div><div class="panel-body">${body}</div></div>`;
    }).join('');
  }
  function renderSurveyResponseDetailHtml(draft, responses){
    const idx = Math.min(Math.max(0,state.surveyResponseViewIndex), responses.length-1);
    const r = responses[idx];
    return `
      <div class="toolbar" style="justify-content:center;">
        <button class="btn btn-ghost btn-sm" id="sv-resp-prev" ${idx<=0?'disabled':''}>◀ Trước</button>
        <b>Phiếu số ${idx+1} / ${responses.length}</b>
        <button class="btn btn-ghost btn-sm" id="sv-resp-next" ${idx>=responses.length-1?'disabled':''}>Sau ▶</button>
      </div>
      <p class="sub" style="text-align:center;">Nộp lúc: ${new Date(r.submittedAt).toLocaleString('vi-VN')}${draft.isQuiz? ` — Điểm: <b>${r.score||0}/${r.maxScore||0}</b>` : ''}</p>
      <div class="panel"><div class="panel-body">
        ${draft.questions.map((q,qi)=>{
          const ans = r.answers ? r.answers[q.id] : null;
          const ansText = Array.isArray(ans)? ans.join(', ') : (ans||'(không trả lời)');
          return `<div class="kv-row"><span>${qi+1}. ${escapeHtml(q.text)}</span><b>${escapeHtml(String(ansText))}</b></div>`;
        }).join('')}
      </div></div>`;
  }
  function renderSurveyAnswersTabHtml(draft){
    const responses = state.surveyResponses;
    return `
      <div class="toolbar" style="flex-wrap:wrap;">
        <b>Tổng số lượt trả lời: ${responses.length}</b>
        <div class="spacer"></div>
        ${responses.length? `<button class="btn btn-ghost btn-sm" id="sv-toggle-detail">${state.surveyResponseDetailOpen? '📊 Xem tổng hợp' : '👤 Xem từng phiếu'}</button>
        <button class="btn btn-ghost btn-sm" id="sv-export-excel-btn">⬇️ Xuất Excel</button>
        <button class="btn btn-ghost btn-sm" id="sv-print-btn">🖨️ In</button>` : ''}
      </div>
      ${responses.length? (state.surveyResponseDetailOpen? renderSurveyResponseDetailHtml(draft, responses) : renderSurveySummaryHtml(draft, responses))
        : `<div class="empty-state" style="padding:30px;"><div class="e-ico">📊</div>Chưa có ai trả lời biểu mẫu này.</div>`}`;
  }

  // ---- Phát hiện "đang soạn dở chưa lưu": chụp bản gốc lúc mở trình soạn (và sau mỗi lần lưu),
  // khi rời đi thì so với bản đang soạn. Chụp trên BẢN SAO đã chuẩn hoá để các trường tự bổ sung khi
  // vẽ (branchEnabled, description...) không bị tính nhầm là thay đổi.
  const surveyBaselines = new WeakMap();
  function surveyDraftSig(d){ return JSON.stringify(ensureSurveySections(JSON.parse(JSON.stringify(d)))); }
  function surveyIsDirty(d){ return !!d && surveyBaselines.has(d) && surveyBaselines.get(d)!==surveyDraftSig(d); }
  function surveyEditorDirtyNow(){ return state.activeTab==='survey' && state.surveyView==='editor' && surveyIsDirty(state.surveyDraft); }
  // Gọi proceed() ngay nếu không có gì chưa lưu; nếu có thì hỏi bằng modal 3 nút. Trả về true khi
  // đã CHẶN lại để hỏi (nơi gọi dừng thao tác của mình, proceed sẽ được gọi sau nếu người dùng đồng ý).
  function surveyConfirmLeave(proceed){
    if(!surveyEditorDirtyNow()){ proceed(); return false; }
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:500px;">
        <div class="modal-head"><h3>⚠️ Biểu mẫu chưa được lưu</h3><button class="modal-close preview-allow" id="svlv-close">✕</button></div>
        <div class="modal-body"><p style="margin:0;">Biểu mẫu đang soạn có thay đổi <b>CHƯA được lưu</b>. Nếu rời đi bây giờ, các thay đổi này sẽ <b>mất hết</b>.</p></div>
        <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
          <button class="btn btn-ghost preview-allow" id="svlv-stay">Ở lại soạn tiếp</button>
          <button class="btn btn-primary preview-allow" id="svlv-save">💾 Lưu rồi rời đi</button>
          <button class="btn btn-ghost preview-allow" id="svlv-drop" style="color:var(--red); font-weight:700;">Rời đi, bỏ thay đổi</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#svlv-close').onclick = close;
    wrap.querySelector('#svlv-stay').onclick = close;
    wrap.querySelector('#svlv-drop').onclick = ()=>{ close(); surveyBaselines.delete(state.surveyDraft); state.surveyView='list'; state.surveyDraft=null; state.surveyEditingId=null; proceed(); };
    wrap.querySelector('#svlv-save').onclick = async ()=>{ close(); if(await saveSurveyDraft()){ showToast('Đã lưu biểu mẫu!'); proceed(); } };
    return true;
  }
  // Tải lại trang / đóng tab khi đang soạn dở -> trình duyệt hiện hộp cảnh báo mặc định của nó.
  window.addEventListener('beforeunload', (e)=>{ if(surveyEditorDirtyNow()){ e.preventDefault(); e.returnValue = ''; } });

  function renderSurveySettingsHtml(d, canEdit){
    const dis = canEdit? '' : 'disabled';
    const st = surveyAcceptState(d);
    const mode = d.identifyMode || 'none';
    const lim = parseInt(d.perPersonLimit,10)||0;
    return `
      <div class="sv-set-status ${st.open? 'open' : 'shut'}">Trạng thái hiện tại: <b>${surveyAcceptLabel(st)}</b>${d.closeAt? ` · Hạn nộp: <b>${escapeHtml(surveyFmtDateTime(d.closeAt))}</b>` : ''}${(parseInt(d.maxResponses,10)||0)>0? ` · Đã nhận <b>${d.responseCount||0}/${parseInt(d.maxResponses,10)}</b> phiếu` : ''}</div>
      <div class="panel sv-set-card"><div class="panel-head sv-sec-head"><h3>📬 Nhận câu trả lời</h3></div><div class="panel-body">
        <label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" id="svs-accept" ${d.acceptResponses!==false?'checked':''} ${dis}><span><b>Đang nhận câu trả lời</b> — bỏ tick để đóng biểu mẫu ngay, người mở link sẽ thấy thông báo đã ngừng nhận.</span></label>
        <div class="form-grid" style="margin-top:8px;">
          <div class="field"><label>⏰ Hạn nộp (tự đóng khi tới giờ)</label>
            <div style="display:flex; gap:6px;"><input type="datetime-local" id="svs-closeat" value="${surveyIsoToLocalInput(d.closeAt)}" ${dis} style="flex:1; min-width:0;">${canEdit && d.closeAt? `<button type="button" class="btn btn-ghost btn-sm preview-allow" id="svs-closeat-clear" title="Bỏ hạn nộp">✕ Bỏ hạn</button>` : ''}</div>
            <div class="sub" style="margin-top:4px;">Để trống = không có hạn nộp.</div></div>
          <div class="field"><label>🈵 Giới hạn tổng số phiếu</label>
            <input type="number" id="svs-max" min="0" step="1" value="${(parseInt(d.maxResponses,10)||0) || ''}" placeholder="Không giới hạn" ${dis}>
            <div class="sub" style="margin-top:4px;">Đủ số phiếu thì tự đóng. Để trống hoặc 0 = không giới hạn.</div></div>
          <div class="field full"><label>💬 Lời nhắn hiện ra khi biểu mẫu đã đóng (không bắt buộc)</label>
            <textarea id="svs-closedmsg" rows="2" placeholder="VD: Đợt khảo sát đã kết thúc, cảm ơn đồng chí đã quan tâm." ${dis}>${escapeHtml(d.closedMessage||'')}</textarea></div>
        </div>
      </div></div>
      <div class="panel sv-set-card"><div class="panel-head sv-sec-head"><h3>👤 Người trả lời</h3></div><div class="panel-body">
        <p style="margin:0 0 6px; font-weight:700;">Cách nhận biết người trả lời</p>
        <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="svs-mode" value="none" ${mode==='none'?'checked':''} ${dis}><span><b>Không nhận biết</b> — ai có link cũng điền được, không giới hạn số lần.</span></label>
        <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="svs-mode" value="browser" ${mode==='browser'?'checked':''} ${dis}><span><b>Theo trình duyệt</b> — dễ dùng, không cần đăng nhập. Người cố tình đổi trình duyệt hoặc dùng chế độ ẩn danh vẫn lách được.</span></label>
        <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="svs-mode" value="google" ${mode==='google'?'checked':''} ${dis}><span><b>Theo tài khoản Google</b> — phải đăng nhập Google mới điền được, chặn chắc chắn, phiếu có ghi email người nộp. Người không có tài khoản Google sẽ không điền được.</span></label>
        <div class="field" style="max-width:320px; margin-top:8px;"><label>Số lần mỗi người được trả lời</label>
          <select id="svs-limit" ${(mode==='none'||!canEdit)?'disabled':''}>
            ${[[1,'Giới hạn 1 lần'],[2,'Giới hạn 2 lần'],[3,'Giới hạn 3 lần'],[0,'Không giới hạn']].map(([v,l])=>`<option value="${v}" ${(mode==='none'? 0 : lim)===v?'selected':''}>${l}</option>`).join('')}
          </select>
          ${mode==='none'? '<div class="sub" style="margin-top:4px;">Chọn cách nhận biết người trả lời ở trên thì mới giới hạn số lần được.</div>' : ''}
        </div>
      </div></div>
      <p class="sub" style="margin:4px 0 10px;">⚠️ Các giới hạn trên được kiểm tra trên trang điền phiếu. Vì luật bảo mật Firebase hiện đang mở, người rành kỹ thuật vẫn có thể ghi thẳng vào cơ sở dữ liệu; muốn chặn tuyệt đối cần siết luật Firebase.</p>
      ${canEdit? `<div style="display:flex; justify-content:flex-end;"><button class="btn btn-primary btn-sm sv-save-action" id="sv-save-btn-bottom">💾 Lưu biểu mẫu</button></div>` : ''}`;
  }
  function wireSurveySettings(el, d){
    const rerender = ()=> renderSurveyTab(el);
    const g = id=> document.getElementById(id);
    if(g('svs-accept')) g('svs-accept').onchange = ()=>{ d.acceptResponses = g('svs-accept').checked; rerender(); };
    if(g('svs-closeat')) g('svs-closeat').onchange = ()=>{ const v = g('svs-closeat').value; d.closeAt = v? new Date(v).toISOString() : ''; rerender(); };
    if(g('svs-closeat-clear')) g('svs-closeat-clear').onclick = ()=>{ d.closeAt = ''; rerender(); };
    if(g('svs-max')) g('svs-max').onchange = ()=>{ d.maxResponses = Math.max(0, parseInt(g('svs-max').value,10)||0); rerender(); };
    if(g('svs-closedmsg')) g('svs-closedmsg').oninput = ()=>{ d.closedMessage = g('svs-closedmsg').value; };
    document.querySelectorAll('input[name="svs-mode"]').forEach(r=> r.onchange = ()=>{
      d.identifyMode = r.value;
      if(r.value==='none') d.perPersonLimit = 0; else if(!(parseInt(d.perPersonLimit,10)>0)) d.perPersonLimit = 1;
      rerender();
    });
    if(g('svs-limit')) g('svs-limit').onchange = ()=>{ d.perPersonLimit = parseInt(g('svs-limit').value,10)||0; };
    el.querySelectorAll('.sv-save-action').forEach(btn=> btn.onclick = async ()=>{ if(await saveSurveyDraft()){ showToast('Đã lưu biểu mẫu!'); rerender(); } });
  }

  function renderSurveyEditorView(el){
    const draft = state.surveyDraft;
    if(!surveyBaselines.has(draft)) surveyBaselines.set(draft, surveyDraftSig(draft));
    const canEdit = surveyCanEdit();
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" id="sv-back-btn">◀ Danh sách</button>
          <h3 style="margin:0;">${state.surveyEditingId? 'Sửa biểu mẫu' : 'Tạo biểu mẫu mới'}</h3>
        </div>
        <div class="panel-body">
          <div class="toolbar" style="margin-bottom:14px; flex-wrap:wrap;">
            <button class="btn ${state.surveyEditorTab==='questions'?'btn-primary':'btn-ghost'} btn-sm" id="sv-tab-questions">📝 Câu hỏi</button>
            <button class="btn ${state.surveyEditorTab==='settings'?'btn-primary':'btn-ghost'} btn-sm" id="sv-tab-settings">⚙️ Cài đặt nhận phiếu</button>
            <button class="btn ${state.surveyEditorTab==='answers'?'btn-primary':'btn-ghost'} btn-sm" id="sv-tab-answers" ${!state.surveyEditingId?'disabled':''}>📊 Câu trả lời${draft.responseCount?` (${draft.responseCount})`:''}</button>
            <div class="spacer"></div>
            ${state.surveyEditingId? `<button class="btn btn-ghost btn-sm" id="sv-copylink-btn">🔗 Copy link chia sẻ</button>` : ''}
            ${canEdit && state.surveyEditorTab!=='answers'? `<button class="btn btn-primary btn-sm sv-save-action" id="sv-save-btn">💾 Lưu biểu mẫu</button>` : ''}
          </div>
          <div id="sv-tab-content">
            ${state.surveyEditorTab==='questions'? renderSurveyQuestionsEditorHtml(draft, canEdit) : state.surveyEditorTab==='settings'? renderSurveySettingsHtml(draft, canEdit) : renderSurveyAnswersTabHtml(draft)}
          </div>
        </div>
      </div>`;
    wireSurveyEditor(el);
  }

  function wireSurveyEditor(el){
    const draft = state.surveyDraft;
    document.getElementById('sv-back-btn').onclick = ()=> surveyConfirmLeave(()=>{ state.surveyView='list'; state.surveyDraft=null; state.surveyEditingId=null; renderSurveyTab(el); });
    document.getElementById('sv-tab-questions').onclick = ()=>{ state.surveyEditorTab='questions'; renderSurveyTab(el); };
    document.getElementById('sv-tab-settings').onclick = ()=>{ state.surveyEditorTab='settings'; renderSurveyTab(el); };
    if(state.surveyEditorTab==='settings') wireSurveySettings(el, draft);
    const tabAnswersBtn = document.getElementById('sv-tab-answers');
    if(tabAnswersBtn) tabAnswersBtn.onclick = async ()=>{
      if(!state.surveyEditingId) return;
      state.surveyEditorTab='answers';
      await loadSurveyResponses(state.surveyEditingId);
      renderSurveyTab(el);
    };
    const copyBtn = document.getElementById('sv-copylink-btn');
    if(copyBtn) copyBtn.onclick = ()=> copyMessageText(surveyShareUrl(state.surveyEditingId));

    if(state.surveyEditorTab==='questions'){
      const titleInput = document.getElementById('sv-title'); if(titleInput) titleInput.oninput = e=> draft.title = e.target.value;
      const descInput = document.getElementById('sv-desc'); if(descInput) descInput.oninput = e=> draft.description = e.target.value;
      const quizToggle = document.getElementById('sv-isquiz'); if(quizToggle) quizToggle.onchange = e=>{ draft.isQuiz = e.target.checked; renderSurveyTab(el); };

      el.querySelectorAll('.q-text').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q.text = inp.value; });
      el.querySelectorAll('.q-desc').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q.description = inp.value; });
      el.querySelectorAll('.q-type').forEach(sel=> sel.onchange = ()=>{
        const q=draft.questions.find(x=>x.id===sel.dataset.qid);
        if(q){
          q.type = sel.value;
          if(surveyQTypeHasOptions(q.type) && (!q.options||!q.options.length)) q.options=['Phương án 1'];
          if(!surveyQTypeHasOptions(q.type)) q.numericOnly = q.numericOnly||false;
          q.optionBranches = (q.options||[]).map((_,i)=> (q.optionBranches&&q.optionBranches[i]) || '__next__');
        }
        renderSurveyTab(el);
      });
      el.querySelectorAll('.q-required').forEach(cb=> cb.onchange = ()=>{ const q=draft.questions.find(x=>x.id===cb.dataset.qid); if(q) q.required = cb.checked; });
      el.querySelectorAll('.q-numeric').forEach(cb=> cb.onchange = ()=>{ const q=draft.questions.find(x=>x.id===cb.dataset.qid); if(q) q.numericOnly = cb.checked; renderSurveyTab(el); });
      el.querySelectorAll('.q-option-text').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q.options[parseInt(inp.dataset.oi,10)] = inp.value; });
      el.querySelectorAll('.q-option-branch').forEach(sel=> sel.onchange = ()=>{
        const q=draft.questions.find(x=>x.id===sel.dataset.qid); if(!q) return;
        q.optionBranches = q.optionBranches||[];
        q.optionBranches[parseInt(sel.dataset.oi,10)] = sel.value;
      });
      el.querySelectorAll('.q-correct').forEach(cb=> cb.onchange = ()=>{
        const q=draft.questions.find(x=>x.id===cb.dataset.qid); if(!q) return;
        const opt = q.options[parseInt(cb.dataset.oi,10)];
        q.correctAnswers = q.correctAnswers||[];
        if(q.type==='radio' || q.type==='dropdown'){ q.correctAnswers = cb.checked? [opt] : []; renderSurveyTab(el); }
        else { if(cb.checked){ if(!q.correctAnswers.includes(opt)) q.correctAnswers.push(opt); } else { q.correctAnswers = q.correctAnswers.filter(a=>a!==opt); } }
      });
      el.querySelectorAll('.q-points').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q.points = parseFloat(inp.value)||0; });
      el.querySelectorAll('.q-add-option').forEach(btn=> btn.onclick = ()=>{
        const q=draft.questions.find(x=>x.id===btn.dataset.qid);
        if(q){ q.options = q.options||[]; q.options.push(`Phương án ${q.options.length+1}`); q.optionBranches = q.optionBranches||[]; q.optionBranches.push('__next__'); }
        renderSurveyTab(el);
      });
      el.querySelectorAll('.q-option-remove').forEach(btn=> btn.onclick = ()=>{
        const q=draft.questions.find(x=>x.id===btn.dataset.qid); if(!q) return;
        const oi = parseInt(btn.dataset.oi,10);
        const removedOpt = q.options[oi];
        q.options.splice(oi,1);
        if(q.optionBranches) q.optionBranches.splice(oi,1);
        q.correctAnswers = (q.correctAnswers||[]).filter(a=>a!==removedOpt);
        renderSurveyTab(el);
      });
      // ---- Quản lý Phần (Section) — giống Google Forms: nhiều phần, mỗi phần nhiều câu hỏi ----
      el.querySelectorAll('.sec-title').forEach(inp=> inp.oninput = ()=>{ const s=draft.sections.find(x=>x.id===inp.dataset.secid); if(s) s.title = inp.value; });
      el.querySelectorAll('.sec-desc').forEach(inp=> inp.oninput = ()=>{ const s=draft.sections.find(x=>x.id===inp.dataset.secid); if(s) s.description = inp.value; });
      el.querySelectorAll('.sec-add-question').forEach(btn=> btn.onclick = ()=>{ draft.questions.push(emptySurveyQuestion(btn.dataset.secid)); renderSurveyTab(el); });
      wireSurveyStructureMenus(el, draft);
      el.querySelectorAll('[data-qtype-info]').forEach(btn=> btn.onclick = (e)=>{
        e.stopPropagation(); const id = btn.dataset.qtypeInfo;
        const tip = el.querySelector(`[data-qtype-tip="${id}"]`); if(!tip) return;
        surveyTypeTipOpen[id] = tip.style.display==='none';
        tip.style.display = surveyTypeTipOpen[id]? 'block' : 'none';
      });
      el.querySelectorAll('.q-paste-options').forEach(btn=> btn.onclick = ()=>{ const q = draft.questions.find(x=>x.id===btn.dataset.qid); if(q) renderSurveyPasteOptionsModal(q, ()=> renderSurveyTab(el)); });
      el.querySelectorAll('.q-opt-more').forEach(btn=> btn.onclick = ()=>{ const q = draft.questions.find(x=>x.id===btn.dataset.qid); if(!q) return; surveyEditorOptLimit[q.id] = surveyOptLimit(q) + SURVEY_EDITOR_OPT_PAGE; renderSurveyTab(el); });
      el.querySelectorAll('.q-opt-all').forEach(btn=> btn.onclick = ()=>{ surveyEditorOptLimit[btn.dataset.qid] = Infinity; renderSurveyTab(el); });
      el.querySelectorAll('.q-opt-search').forEach(inp=>{
        const apply = ()=>{
          const qid = inp.dataset.qid, term = surveyFold(inp.value.trim()); surveyEditorOptSearch[qid] = inp.value;
          const q = draft.questions.find(x=>x.id===qid);
          const drawn = el.querySelectorAll(`.q-options-list[data-qid="${qid}"] .q-opt-row`).length;
          if(term && q && drawn < (q.options||[]).length){
            // Đang thu gọn mà bắt đầu tìm -> vẽ lại đủ toàn bộ phương án rồi đưa con trỏ về ô tìm.
            const caret = inp.selectionStart; renderSurveyTab(el);
            const again = document.querySelector(`.q-opt-search[data-qid="${qid}"]`); if(again){ again.focus(); try{ again.setSelectionRange(caret, caret); }catch(e){} }
            return;
          }
          const rows = el.querySelectorAll(`.q-options-list[data-qid="${qid}"] .q-opt-row`); let hit = 0;
          rows.forEach(r=>{ const ok = !term || r.dataset.optNorm.includes(term); r.style.display = ok? '' : 'none'; if(ok) hit++; });
          const f = el.querySelector(`.q-opt-found[data-qid="${qid}"]`); if(f) f.textContent = term? `Tìm thấy ${hit}/${rows.length} phương án` : '';
        };
        inp.oninput = apply; apply();
      });
      const addSectionBtn = document.getElementById('sv-add-section-btn');
      if(addSectionBtn) addSectionBtn.onclick = ()=>{ draft.sections.push(emptySurveySection(draft.sections.length+1)); renderSurveyTab(el); };
      // 2 nút "Lưu biểu mẫu" (trên cùng + cuối khung soạn) dùng chung 1 hành động.
      el.querySelectorAll('.sv-save-action').forEach(btn=> btn.onclick = async ()=>{ if(await saveSurveyDraft()){ showToast('Đã lưu biểu mẫu!'); renderSurveyTab(el); } });
    } else {
      const toggleBtn = document.getElementById('sv-toggle-detail');
      if(toggleBtn) toggleBtn.onclick = ()=>{ state.surveyResponseDetailOpen = !state.surveyResponseDetailOpen; renderSurveyTab(el); };
      const prevBtn = document.getElementById('sv-resp-prev'); if(prevBtn) prevBtn.onclick = ()=>{ state.surveyResponseViewIndex--; renderSurveyTab(el); };
      const nextBtn = document.getElementById('sv-resp-next'); if(nextBtn) nextBtn.onclick = ()=>{ state.surveyResponseViewIndex++; renderSurveyTab(el); };
      const exportBtn = document.getElementById('sv-export-excel-btn'); if(exportBtn) exportBtn.onclick = ()=> renderSurveyExportPreviewModal(draft, state.surveyResponses);
      const printBtn = document.getElementById('sv-print-btn'); if(printBtn) printBtn.onclick = ()=> printSurveyResponses(draft, state.surveyResponses);
    }
  }

  // Câu có từ ngần này phương án trở lên thì có ô tìm nhanh phương án (trang điền phiếu + trình soạn).
  const SURVEY_OPT_SEARCH_MIN = 6;
  const surveyEditorOptSearch = {}; // chữ đang tìm trong trình soạn, giữ lại qua các lần vẽ lại
  // Câu có quá nhiều phương án: trình soạn chỉ vẽ trước 150 phương án đầu (vẽ hàng ngàn ô nhập làm
  // máy chậm). Ô tìm phương án vẫn tìm trên TOÀN BỘ (tự mở hết khi đang tìm).
  const SURVEY_EDITOR_OPT_PAGE = 150;
  const surveyEditorOptLimit = {};
  function surveyOptLimit(q){
    if((surveyEditorOptSearch[q.id]||'').trim()) return Infinity;
    return surveyEditorOptLimit[q.id] || SURVEY_EDITOR_OPT_PAGE;
  }
  // Bỏ dấu tiếng Việt + chữ thường, giữ nguyên số ký tự (mỗi ký tự gốc -> đúng 1 ký tự) để tô sáng
  // đúng vị trí trên chữ gốc. Gõ "nong dan" vẫn khớp "Nông dân".
  function surveyFoldChar(c){ return c.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'d').toLowerCase().charAt(0) || c; }
  function surveyFold(s){ return Array.from(String(s||'')).map(surveyFoldChar).join(''); }
  function renderSurveyPasteOptionsModal(q, onDone){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:1000px;">
        <div class="modal-head"><h3>📋 Thêm nhiều phương án cùng lúc</h3><button class="modal-close preview-allow" id="svpo-close">✕</button></div>
        <div class="modal-body">
          <p style="margin:0 0 6px;">✍️ <b>Mỗi lần xuống hàng (phím Enter) là xong 1 phương án.</b> Ví dụ muốn 10 phương án thì nhập thành 10 dòng. Có thể gõ trực tiếp hoặc dán từ Word, Excel, Zalo… (dán 1 cột từ Excel thì mỗi ô tự thành 1 dòng).</p>
          <p class="sub" style="margin:0 0 8px;">Dòng trống, hoặc dòng chỉ toàn dấu cách, sẽ tự bỏ qua. Phương án trùng nhau hoặc trùng với phương án đã có cũng tự bỏ qua.</p>
          <div class="svpo-editor"><pre class="svpo-gutter" id="svpo-gutter">1</pre><textarea id="svpo-text" wrap="off" spellcheck="false" placeholder="Phương án 1&#10;Phương án 2&#10;Phương án 3"></textarea></div>
          <p id="svpo-count" style="margin:8px 0 10px; font-weight:700; color:#1b5e20;">Chưa có phương án nào</p>
          <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="svpo-mode" value="append" checked><span>Thêm vào sau ${(q.options||[]).length} phương án hiện có</span></label>
          <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="svpo-mode" value="replace"><span>Thay thế toàn bộ phương án hiện có</span></label>
        </div>
        <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="svpo-cancel">Huỷ</button><button class="btn btn-primary preview-allow" id="svpo-ok">➕ Thêm vào danh sách phương án</button></div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const ta = wrap.querySelector('#svpo-text'), gutter = wrap.querySelector('#svpo-gutter'), countEl = wrap.querySelector('#svpo-count');
    const mode = ()=> wrap.querySelector('input[name="svpo-mode"]:checked').value;
    // Tách dòng: bỏ dòng trống/toàn dấu cách (kể cả dấu cách đặc biệt, ký tự vô hình), bỏ trùng.
    const parse = ()=>{
      const raw = ta.value.split(/\r\n|\r|\n/);
      const existing = mode()==='replace'? [] : (q.options||[]).map(o=> String(o).trim()).filter(Boolean);
      const seen = new Set(existing); let blank = 0, dup = 0; const list = [];
      raw.forEach(line=>{
        const t = line.replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\t+/g,' ').trim();
        if(!t){ blank++; return; }
        if(seen.has(t)){ dup++; return; }
        seen.add(t); list.push(t);
      });
      if(raw.length && !raw[raw.length-1].trim()) blank = Math.max(0, blank-1); // dòng trống cuối cùng do Enter thừa thì không tính
      return { list, blank, dup };
    };
    const refresh = ()=>{
      const n = ta.value.split(/\r\n|\r|\n/).length;
      gutter.textContent = Array.from({length:n}, (_,i)=> i+1).join('\n');
      gutter.scrollTop = ta.scrollTop;
      const r = parse();
      countEl.textContent = r.list.length? `Sẽ thêm ${r.list.length} phương án${r.blank? ` · bỏ qua ${r.blank} dòng trống` : ''}${r.dup? ` · bỏ qua ${r.dup} phương án trùng` : ''}` : (ta.value.trim()? 'Không có phương án hợp lệ nào để thêm' : 'Chưa có phương án nào');
      countEl.style.color = r.list.length? '#1b5e20' : '#9e9e9e';
    };
    ta.addEventListener('input', refresh);
    ta.addEventListener('scroll', ()=>{ gutter.scrollTop = ta.scrollTop; });
    wrap.querySelectorAll('input[name="svpo-mode"]').forEach(r=> r.onchange = refresh);
    wrap.querySelector('#svpo-close').onclick = close;
    wrap.querySelector('#svpo-cancel').onclick = close;
    wrap.querySelector('#svpo-ok').onclick = ()=>{
      const { list } = parse(); if(!list.length){ alert('Chưa có phương án hợp lệ nào. Hãy nhập hoặc dán danh sách, mỗi dòng 1 phương án.'); return; }
      const replace = mode()==='replace';
      if(replace && (q.options||[]).length && !confirm(`Thay thế toàn bộ ${(q.options||[]).length} phương án hiện có bằng ${list.length} phương án mới?`)) return;
      const keepIdx = replace? [] : (q.options||[]).map((o,i)=> String(o).trim()? i : -1).filter(i=> i>=0);
      q.options = keepIdx.map(i=> q.options[i]).concat(list);
      q.optionBranches = keepIdx.map(i=> (q.optionBranches||[])[i] || '__next__').concat(list.map(()=>'__next__'));
      q.correctAnswers = (q.correctAnswers||[]).filter(a=> q.options.includes(a));
      close();
      showToast(`Đã thêm ${list.length} phương án vào câu hỏi.`);
      if(onDone) onDone();
    };
    refresh();
    setTimeout(()=> ta.focus(), 0);
  }
  // ---- Menu "⋮" của từng câu hỏi và từng phần (kiểu Google Biểu mẫu) ----
  function wireSurveyStructureMenus(el, draft){
    const rerender = ()=> renderSurveyTab(el);
    const stillEditing = ()=> state.activeTab==='survey' && state.surveyView==='editor' && state.surveyDraft===draft;
    const rerenderIfOpen = ()=>{ if(stillEditing()){ const c = document.getElementById('content'); if(c) renderSurveyTab(c); } };
    const clone = x=> JSON.parse(JSON.stringify(x));
    const secIdx = id=> draft.sections.findIndex(s=>s.id===id);
    const qsOf = secId=> draft.questions.filter(q=>q.sectionId===secId);
    // Chụp lại cấu trúc để Hoàn tác các thao tác cấp Phần (xoá/hợp nhất).
    const snapshot = ()=> ({ sections: clone(draft.sections), questions: clone(draft.questions) });
    const restore = (snap)=>{ draft.sections = snap.sections; draft.questions = snap.questions; rerenderIfOpen(); };

    // ===== Câu hỏi =====
    function qMove(q, dir){
      surveyNormalizeOrder(draft);
      const list = draft.questions, i = list.indexOf(q), si = secIdx(q.sectionId);
      const nb = list[i+dir];
      if(nb && nb.sectionId===q.sectionId){ list[i] = nb; list[i+dir] = q; }
      else {
        const target = draft.sections[si+dir]; if(!target) return;
        q.sectionId = target.id;
        // Lên: thành câu cuối của phần trên. Xuống: thành câu đầu của phần dưới.
        list.splice(i,1);
        const others = list.filter(x=>x.sectionId===target.id);
        if(dir<0) list.splice(others.length? list.indexOf(others[others.length-1])+1 : list.length, 0, q);
        else list.splice(others.length? list.indexOf(others[0]) : list.length, 0, q);
      }
      surveyNormalizeOrder(draft); rerender();
    }
    function qDelete(q){
      if(draft.questions.length<=1){ alert('Biểu mẫu cần có ít nhất 1 câu hỏi.'); return; }
      const idx = draft.questions.indexOf(q), secId = q.sectionId;
      draft.questions.splice(idx,1);
      rerender();
      showUndoToast('Đã xoá câu hỏi', ()=>{
        if(!draft.sections.some(s=>s.id===secId)) q.sectionId = draft.sections[0].id;
        draft.questions.splice(Math.min(idx, draft.questions.length), 0, q);
        surveyNormalizeOrder(draft); rerenderIfOpen();
      });
    }
    el.querySelectorAll('[data-qmenu]').forEach(btn=> btn.onclick = (e)=>{
      e.stopPropagation();
      const q = draft.questions.find(x=>x.id===btn.dataset.qmenu); if(!q) return;
      surveyNormalizeOrder(draft);
      const si = secIdx(q.sectionId), inSec = qsOf(q.sectionId), pos = inSec.indexOf(q);
      const canUp = pos>0 || si>0, canDown = pos<inSec.length-1 || si<draft.sections.length-1;
      const items = [
        { icon:'📋', label:'Nhân bản câu hỏi', onClick:()=>{ const c = clone(q); c.id = 'q_'+uid(); draft.questions.splice(draft.questions.indexOf(q)+1, 0, c); rerender(); } },
        { icon:'➕', label:'Chèn câu hỏi mới ngay bên dưới', onClick:()=>{ draft.questions.splice(draft.questions.indexOf(q)+1, 0, emptySurveyQuestion(q.sectionId)); rerender(); } },
        { icon:'⬆️', label: (pos===0 && si>0)? 'Di chuyển lên (sang phần phía trên)' : 'Di chuyển lên', disabled:!canUp, onClick:()=> qMove(q,-1) },
        { icon:'⬇️', label: (pos===inSec.length-1 && si<draft.sections.length-1)? 'Di chuyển xuống (sang phần phía dưới)' : 'Di chuyển xuống', disabled:!canDown, onClick:()=> qMove(q,1) },
      ];
      items.push({ icon:'🔀', label:'Thay đổi vị trí (kéo thả)…', onClick:()=> renderSurveyReorderModal(draft, rerender, 'Q|'+q.id) });
      if(draft.sections.length>1) items.push({ icon:'📑', label:'Chuyển sang phần khác…', onClick:()=>{
        openPopMenu(btn, draft.sections.map((s,k)=>({ icon:'→', label:`Phần ${k+1}: ${s.title||'(chưa đặt tên)'}`, disabled: s.id===q.sectionId, onClick:()=>{
          draft.questions.splice(draft.questions.indexOf(q),1); q.sectionId = s.id; draft.questions.push(q); surveyNormalizeOrder(draft); rerender();
          showToast(`Đã chuyển câu hỏi sang Phần ${k+1}.`);
        } })));
      } });
      items.push('sep');
      const descOn = !!(q.showDesc || q.description);
      items.push({ label:'Mô tả câu hỏi', checked:descOn, onClick:()=>{ if(descOn){ q.showDesc = false; q.description = ''; } else q.showDesc = true; rerender();
        if(!descOn) setTimeout(()=>{ const d = document.querySelector(`.q-desc[data-qid="${q.id}"]`); if(d) d.focus(); }, 0); } });
      if(surveyQCanBranch(q) && draft.sections.length>1) items.push({ label:'Chuyển đến phần dựa trên câu trả lời', checked:!!q.branchEnabled, onClick:()=>{
        q.branchEnabled = !q.branchEnabled; if(!q.branchEnabled) q.optionBranches = (q.options||[]).map(()=>'__next__'); rerender(); } });
      if(surveyQTypeHasOptions(q.type)) items.push({ label:'Xáo trộn thứ tự phương án khi người khác điền', checked:!!q.shuffleOptions, onClick:()=>{ q.shuffleOptions = !q.shuffleOptions; rerender(); } });
      items.push('sep');
      items.push({ icon:'🗑️', label:'Xoá câu hỏi', danger:true, onClick:()=> qDelete(q) });
      openPopMenu(btn, items);
    });

    // ===== Phần =====
    function secMove(sec, dir){
      const i = secIdx(sec.id), j = i+dir; if(j<0 || j>=draft.sections.length) return;
      const arr = draft.sections; [arr[i], arr[j]] = [arr[j], arr[i]];
      surveyNormalizeOrder(draft); rerender();
    }
    function secDuplicate(sec){
      const i = secIdx(sec.id);
      const ns = { ...clone(sec), id:'sec_'+uid(), title: (sec.title||'Phần')+' (bản sao)' };
      draft.sections.splice(i+1, 0, ns);
      qsOf(sec.id).forEach(q=>{ const c = clone(q); c.id = 'q_'+uid(); c.sectionId = ns.id; draft.questions.push(c); });
      surveyNormalizeOrder(draft); rerender();
    }
    function secMergeUp(sec){
      const i = secIdx(sec.id); if(i<=0) return;
      const snap = snapshot(), prev = draft.sections[i-1];
      draft.questions.forEach(q=>{
        if(q.sectionId===sec.id) q.sectionId = prev.id;
        if(q.optionBranches) q.optionBranches = q.optionBranches.map(b=> b===sec.id? prev.id : b);
      });
      draft.sections.splice(i,1);
      surveyNormalizeOrder(draft); rerender();
      showUndoToast(`Đã hợp nhất với Phần ${i}`, ()=> restore(snap));
    }
    function secDelete(sec){
      if(draft.sections.length<=1){ alert('Biểu mẫu cần có ít nhất 1 phần.'); return; }
      const i = secIdx(sec.id), inSec = qsOf(sec.id);
      const doDelete = (mode)=>{
        if(mode==='drop' && inSec.length>=draft.questions.length){ alert('Không thể xoá luôn các câu hỏi: biểu mẫu cần còn lại ít nhất 1 câu hỏi. Hãy chọn chuyển câu hỏi sang phần khác.'); return; }
        const snap = snapshot();
        const fallback = draft.sections[i>0? i-1 : 1];
        if(mode==='drop') draft.questions = draft.questions.filter(q=>q.sectionId!==sec.id);
        else draft.questions.forEach(q=>{ if(q.sectionId===sec.id) q.sectionId = fallback.id; });
        // Phân nhánh đang trỏ tới phần bị xoá -> về "Tiếp tục sang phần tiếp theo"
        draft.questions.forEach(q=>{ if(q.optionBranches) q.optionBranches = q.optionBranches.map(b=> b===sec.id? '__next__' : b); });
        draft.sections.splice(i,1);
        surveyNormalizeOrder(draft); rerender();
        showUndoToast(mode==='drop'? `Đã xoá phần và ${inSec.length} câu hỏi` : 'Đã xoá phần', ()=> restore(snap));
      };
      if(!inSec.length){ doDelete('move'); return; }
      const where = i>0? 'phần phía trên' : 'phần phía dưới';
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg';
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:480px;">
          <div class="modal-head"><h3>🗑️ Xoá Phần ${i+1}</h3><button class="modal-close preview-allow" id="svsd-close">✕</button></div>
          <div class="modal-body"><p style="margin:0;">Phần này đang có <b>${inSec.length} câu hỏi</b>. Đồng chí muốn xử lý các câu hỏi đó thế nào?</p></div>
          <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
            <button class="btn btn-ghost preview-allow" id="svsd-cancel">Huỷ</button>
            <button class="btn btn-primary preview-allow" id="svsd-move">Chuyển câu hỏi sang ${where}</button>
            <button class="btn btn-danger preview-allow" id="svsd-drop">Xoá luôn ${inSec.length} câu hỏi</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = ()=> wrap.remove();
      wrap.querySelector('#svsd-close').onclick = close;
      wrap.querySelector('#svsd-cancel').onclick = close;
      wrap.querySelector('#svsd-move').onclick = ()=>{ close(); doDelete('move'); };
      wrap.querySelector('#svsd-drop').onclick = ()=>{ close(); doDelete('drop'); };
    }
    el.querySelectorAll('[data-secmenu]').forEach(btn=> btn.onclick = (e)=>{
      e.stopPropagation();
      const sec = draft.sections.find(x=>x.id===btn.dataset.secmenu); if(!sec) return;
      const i = secIdx(sec.id), n = draft.sections.length;
      openPopMenu(btn, [
        { icon:'📋', label:'Nhân bản phần (kèm các câu hỏi)', onClick:()=> secDuplicate(sec) },
        { icon:'➕', label:'Chèn phần mới ngay sau phần này', onClick:()=>{ draft.sections.splice(i+1, 0, emptySurveySection(n+1)); rerender(); } },
        { icon:'⬆️', label:'Di chuyển phần lên', disabled:i===0, onClick:()=> secMove(sec,-1) },
        { icon:'⬇️', label:'Di chuyển phần xuống', disabled:i===n-1, onClick:()=> secMove(sec,1) },
        { icon:'🔀', label:'Thay đổi vị trí (kéo thả)…', onClick:()=> renderSurveyReorderModal(draft, rerender, 'S|'+sec.id) },
        { icon:'📥', label:'Nhập câu hỏi từ biểu mẫu khác vào phần này', onClick:()=> renderImportQuestionsModal(el, sec.id) },
        { icon:'🔗', label:'Hợp nhất với phần phía trên', disabled:i===0, onClick:()=> secMergeUp(sec) },
        'sep',
        { icon:'🗑️', label:'Xoá phần', danger:true, disabled:n<=1, onClick:()=> secDelete(sec) },
      ]);
    });
  }

  // ---- Modal "Thay đổi vị trí": kéo thả phần và câu hỏi (cùng cơ chế với "Tuỳ chỉnh cột" ở Sổ vay vốn
  // / Hồ sơ hội viên: đường kẻ xanh chạy theo chuột, thả xong thì tên mục vừa đổi chỗ phóng to thu nhỏ).
  // Kéo PHẦN thì cả khối (phần + câu hỏi của nó) đi theo; kéo CÂU HỎI thì đặt được vào phần bất kỳ.
  // Mọi thay đổi chỉ trên bản nháp riêng của modal — bấm "Áp dụng" mới đưa vào biểu mẫu đang soạn.
  function renderSurveyReorderModal(draft, onApplied, focusKey){
    const initSecs = draft.sections.map(s=>({ id:s.id, title:s.title }));
    const initQs = draft.questions.map(q=>({ id:q.id, text:q.text, sectionId:q.sectionId }));
    let secs = initSecs.map(x=>({...x})), qs = initQs.map(x=>({...x}));
    const isSec = k=> k.startsWith('S|'), idOf = k=> k.slice(2);
    const flat = ()=> secs.flatMap(s=> ['S|'+s.id, ...qs.filter(q=>q.sectionId===s.id).map(q=>'Q|'+q.id)]);
    function applyFlat(list){
      const ns = [], nq = [], lead = []; let cur = null;
      list.forEach(k=>{
        if(isSec(k)){ cur = secs.find(s=>s.id===idOf(k)); ns.push(cur); }
        else { const q = qs.find(x=>x.id===idOf(k)); if(cur){ q.sectionId = cur.id; nq.push(q); } else lead.push(q); }
      });
      lead.forEach(q=>{ q.sectionId = ns[0].id; });
      secs = ns; qs = ns.flatMap(s=> lead.concat(nq).filter(q=>q.sectionId===s.id));
    }
    function reorder(dragged, target, before){
      let list = flat();
      if(!isSec(dragged)){
        list = list.filter(k=>k!==dragged);
        const i = list.indexOf(target); if(i<0) return;
        list.splice(before? i : i+1, 0, dragged);
      } else {
        const tgtSecKey = isSec(target)? target : 'S|'+(qs.find(q=>q.id===idOf(target))||{}).sectionId;
        if(tgtSecKey===dragged) return;
        const block = ['S|'+idOf(dragged), ...qs.filter(q=>q.sectionId===idOf(dragged)).map(q=>'Q|'+q.id)];
        list = list.filter(k=>!block.includes(k));
        const start = list.indexOf(tgtSecKey); if(start<0) return;
        let end = start+1; while(end<list.length && !isSec(list[end])) end++;
        list.splice(before? start : end, 0, ...block);
      }
      applyFlat(list);
    }
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const pulse = (key)=> setTimeout(()=>{ const l = wrap.querySelector(`[data-col-name-label="${key}"]`); if(l){ l.classList.remove('col-name-pulse'); void l.offsetWidth; l.classList.add('col-name-pulse'); } }, 70);
    function render(){
      let qn = 0;
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:620px;">
          <div class="modal-head"><h3>🔀 Thay đổi vị trí phần và câu hỏi</h3><button class="modal-close preview-allow" id="svro-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 8px;">💡 Nhấn giữ vào biểu tượng ⠿ ở đầu mỗi dòng, kéo lên/xuống rồi thả vào đúng chỗ. Kéo <b>phần</b> thì các câu hỏi của phần đó đi theo; kéo <b>câu hỏi</b> sang dưới tiêu đề phần khác để chuyển câu hỏi sang phần đó.</p>
            <div style="display:flex; flex-direction:column; gap:5px;">
              ${secs.map((s,si)=>{
                const inSec = qs.filter(q=>q.sectionId===s.id);
                return `<div class="sv-ro-row sec col-pick-row" draggable="true" data-col-key="S|${s.id}"><span class="sv-ro-grip">⠿</span><span class="sv-ro-txt"><span data-col-name-label="S|${s.id}">📑 Phần ${si+1}: ${escapeHtml(s.title||'(chưa đặt tên)')} <span class="sub" style="font-weight:400;">(${inSec.length} câu)</span></span></span></div>`
                  + inSec.map(q=>{ qn++; return `<div class="sv-ro-row q col-pick-row" draggable="true" data-col-key="Q|${q.id}"><span class="sv-ro-grip">⠿</span><span class="sv-ro-txt" title="${escapeHtml(q.text||'')}"><span data-col-name-label="Q|${q.id}">Câu ${qn}. ${escapeHtml((q.text||'').trim()||'(chưa nhập nội dung)')}</span></span></div>`; }).join('');
              }).join('')}
            </div>
          </div>
          <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
            <button class="btn btn-ghost preview-allow" id="svro-reset" style="margin-right:auto;">↺ Về như ban đầu</button>
            <button class="btn btn-ghost preview-allow" id="svro-cancel">Đóng (không lưu)</button>
            <button class="btn btn-primary preview-allow" id="svro-apply">✅ Áp dụng vị trí mới</button>
          </div>
        </div>`;
      wrap.querySelector('#svro-close').onclick = close;
      wrap.querySelector('#svro-cancel').onclick = close;
      wrap.querySelector('#svro-reset').onclick = ()=>{ secs = initSecs.map(x=>({...x})); qs = initQs.map(x=>({...x})); render(); };
      wrap.querySelector('#svro-apply').onclick = ()=>{
        const secById = {}; draft.sections.forEach(s=>{ secById[s.id] = s; });
        const qById = {}; draft.questions.forEach(q=>{ qById[q.id] = q; });
        draft.sections = secs.map(s=> secById[s.id]).filter(Boolean);
        draft.questions = qs.map(x=>{ const q = qById[x.id]; if(q) q.sectionId = x.sectionId; return q; }).filter(Boolean);
        surveyNormalizeOrder(draft);
        close(); if(onApplied) onApplied();
        showToast('Đã áp dụng vị trí mới cho phần và câu hỏi.');
      };
      wireDragReorderWithIndicator(Array.from(wrap.querySelectorAll('.sv-ro-row')), row=> row.dataset.colKey, (dragged, target, before)=>{
        reorder(dragged, target, before); render(); pulse(dragged);
      });
    }
    render();
    if(focusKey){ setTimeout(()=>{ const r = wrap.querySelector(`[data-col-key="${focusKey}"]`); if(r) r.scrollIntoView({block:'center'}); }, 0); pulse(focusKey); }
  }

  function renderImportQuestionsModal(el, targetSectionId){
    const others = state.surveys.filter(s=> s.id !== state.surveyEditingId);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>📥 Nhập câu hỏi từ biểu mẫu khác</h3><button class="modal-close" id="svi-close">✕</button></div>
        <div class="modal-body">
          ${others.length? others.map(s=>`
            <div class="divider-lbl">${escapeHtml(s.title)}</div>
            ${(s.questions||[]).map(q=>`
              <label class="sv-filter-item sv-opt sv-opt-full">
                <input type="checkbox" class="svi-check" data-sid="${s.id}" data-qid="${q.id}">
                <span>${escapeHtml(q.text)} <span class="sub">(${surveyQTypeLabel(q.type)})</span></span>
              </label>`).join('')}
          `).join('') : `<div class="empty-state">Chưa có biểu mẫu nào khác để nhập câu hỏi.</div>`}
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="svi-cancel">Đóng</button>
          ${others.length? `<button class="btn btn-primary" id="svi-import">Nhập câu hỏi đã chọn</button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#svi-close').onclick = close;
    wrap.querySelector('#svi-cancel').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    const importBtn = wrap.querySelector('#svi-import');
    if(importBtn) importBtn.onclick = ()=>{
      const checks = wrap.querySelectorAll('.svi-check:checked');
      if(!checks.length){ alert('Vui lòng chọn ít nhất 1 câu hỏi để nhập.'); return; }
      checks.forEach(cb=>{
        const survey = others.find(s=>s.id===cb.dataset.sid);
        const q = survey && (survey.questions||[]).find(x=>x.id===cb.dataset.qid);
        if(q){
          const copy = JSON.parse(JSON.stringify(q));
          copy.id = 'q_'+uid();
          ensureSurveySections(state.surveyDraft);
          const secs = state.surveyDraft.sections;
          copy.sectionId = (targetSectionId && secs.some(x=>x.id===targetSectionId))? targetSectionId : secs[secs.length-1].id; // đúng phần đã chọn ở menu ⋮
          copy.branchEnabled = false;
          copy.optionBranches = (copy.options||[]).map(()=>'__next__'); // reset phân nhánh (phần của biểu mẫu gốc không tồn tại ở đây)
          state.surveyDraft.questions.push(copy);
        }
      });
      close();
      renderSurveyTab(el);
    };
  }

  function surveyExportRows(draft, responses){
    const headers = ['STT','Thời gian nộp', ...draft.questions.map(q=>q.text)];
    if(draft.isQuiz) headers.push('Điểm');
    const rows = responses.map((r,i)=>{
      const row = [i+1, new Date(r.submittedAt).toLocaleString('vi-VN')];
      draft.questions.forEach(q=>{
        const ans = r.answers? r.answers[q.id] : '';
        row.push(Array.isArray(ans)? ans.join(', ') : (ans||''));
      });
      if(draft.isQuiz) row.push(`${r.score||0}/${r.maxScore||0}`);
      return row;
    });
    return { headers, rows };
  }
  function renderSurveyExportPreviewModal(draft, responses){
    const { headers, rows } = surveyExportRows(draft, responses);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:920px;">
        <div class="modal-head"><h3>👁️ Xem trước file Excel</h3><button class="modal-close" id="svx-close">✕</button></div>
        <div class="modal-body">
          <div class="table-wrap"><table>
            <thead><tr>${headers.map(h=>`<th>${escapeHtml(String(h))}</th>`).join('')}</tr></thead>
            <tbody>${rows.length? rows.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">Không có dữ liệu</td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="svx-cancel">Đóng</button>
          <button class="btn btn-primary" id="svx-confirm">⬇️ Xuất file Excel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#svx-close').onclick = close;
    wrap.querySelector('#svx-cancel').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#svx-confirm').onclick = async ()=>{
      try{ await exportSurveyExcel(draft, headers, rows); close(); }
      catch(e){ console.error('[Xuất kết quả khảo sát] Lỗi:', e); alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); }
    };
  }
  async function exportSurveyExcel(draft, headers, rows){
    await loadOptionalLibrary('xlsx');
    const headerLines = [ ['HỘI NÔNG DÂN'], [wardTitleUpper()], [provinceTitle()], [`KẾT QUẢ KHẢO SÁT: ${draft.title}`], [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`], [] ];
    const aoa = [...headerLines, headers.map(h=>String(h).toUpperCase()), ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applyExcelCellFormatting(ws, aoa, headerLines.length);
    boldExcelRow(ws, 3); // dòng tiêu đề file (VD "KẾT QUẢ KHẢO SÁT: ...") — đã +1 do thêm dòng "HỘI NÔNG DÂN" tách riêng ở trên
    const lastCol = Math.max(0, headers.length-1);
    ws['!merges'] = headerLines.map((line,r)=> (line.length? {s:{r,c:0}, e:{r,c:lastCol}} : null)).filter(Boolean);
    ws['!cols'] = headers.map(()=>({wch:22}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ket qua khao sat');
    XLSX.writeFile(wb, `Khao-sat_${todayStr()}.xlsx`, {cellStyles:true});
  }
  function printSurveyResponses(draft, responses){
    const area = document.getElementById('print-area');
    if(!area) return;
    const { headers, rows } = surveyExportRows(draft, responses);
    const ncols = headers.length;
    let fontSize=12.5, pad='6px 8px';
    if(ncols>16){ fontSize=7; pad='2px 3px'; } else if(ncols>12){ fontSize=8; pad='3px 4px'; } else if(ncols>9){ fontSize=9.5; pad='4px 5px'; } else if(ncols>6){ fontSize=11; pad='5px 6px'; }
    area.innerHTML = `
      <div style="text-align:center;">
        <div style="font-weight:800; font-size:14px;">${hoiNongDanTitleHtml()}</div>
        <div style="font-size:12.5px;">${escapeHtml(provinceTitle())}</div>
      </div>
      <div class="print-title" style="margin:10px 0 4px; text-align:center;">KẾT QUẢ KHẢO SÁT: ${escapeHtml(draft.title)}</div>
      <div style="text-align:center; font-size:12px; margin-bottom:10px;">Thời gian xuất: ${new Date().toLocaleString('vi-VN')}</div>
      <table class="print-table" style="font-size:${fontSize}px;">
        <thead><tr>${headers.map(h=>`<th style="padding:${pad};">${escapeHtml(String(h))}</th>`).join('')}</tr></thead>
        <tbody>${rows.length? rows.map(r=>`<tr>${r.map(c=>`<td style="padding:${pad};">${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${ncols}" style="padding:${pad};">Không có dữ liệu</td></tr>`}</tbody>
      </table>
      <div style="text-align:center; margin-top:18px; font-size:11px;">https://hoinongdan.sotay.org</div>`;
    area.classList.add('landscape');
    printAreaNow(true);
    setTimeout(()=> area.classList.remove('landscape'), 800);
  }

  // =====================================================================
  // GIAO DIỆN CÔNG KHAI ĐIỀN PHIẾU — truy cập qua link chia sẻ dạng
  // https://.../#/khaosat/{surveyId}, KHÔNG cần đăng nhập, KHÔNG hiện menu/nút Admin.
  // =====================================================================
  function publicSurveyRouteId(){
    const m = (window.location.hash||'').match(/^#\/khaosat\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function renderPublicSurveyPage(surveyId){
    document.body.classList.add('public-survey-mode');
    root.innerHTML = '<div class="center-screen">Đang tải biểu mẫu…</div>';
    let survey = null, submitted = false, lastResult = null;
    let surveyLoadState = 'loading';
    let surveyLoadError = '';
    let closedReason = null;
    let respondent = { key:null, email:null, count:0, limit:0 };
    function surveyCurrentUser(){
      return new Promise(res=>{
        if(typeof auth==='undefined' || !auth) return res(null);
        if(auth.currentUser) return res(auth.currentUser);
        let done = false;
        const un = auth.onAuthStateChanged(u=>{ if(done) return; done = true; if(typeof un==='function') un(); res(u||null); });
        setTimeout(()=>{ if(!done){ done = true; res(auth.currentUser||null); } }, 4000);
      });
    }
    // Kiểm tra biểu mẫu còn nhận phiếu không, có cần đăng nhập Google không, người này còn lượt không.
    async function prepareAccess(){
      const st = surveyAcceptState(survey);
      if(!st.open){ surveyLoadState = 'closed'; closedReason = st.reason; return; }
      const mode = survey.identifyMode || 'none';
      respondent = { key:null, email:null, count:0, limit: mode==='none'? 0 : (parseInt(survey.perPersonLimit,10)||0) };
      if(mode==='google'){
        const user = await surveyCurrentUser();
        if(!user || !user.email){ surveyLoadState = 'needLogin'; return; }
        respondent.email = user.email;
      }
      respondent.key = surveyRespondentKey(survey, respondent.email? { email:respondent.email } : null);
      if(mode!=='none') respondent.count = await surveyRespondentCount(survey.id, respondent.key);
      if(respondent.limit>0 && respondent.key && respondent.count>=respondent.limit){ surveyLoadState = 'limit'; return; }
    }
    function resetForAnotherResponse(){
      submitted = false; lastResult = null; currentSectionIdx = 0;
      Object.keys(collected).forEach(k=> delete collected[k]);
      loadSurvey();
    }
    let currentSectionIdx = 0;
    const collected = {}; // câu trả lời đã thu thập được, giữ lại xuyên suốt các Phần
    const shuffledOrder = {}; // thứ tự phương án đã xáo trộn — cố định suốt 1 lượt điền phiếu
    function publicOptions(q){
      const opts = q.options||[];
      if(!q.shuffleOptions) return opts;
      if(!shuffledOrder[q.id]){
        const a = opts.slice();
        for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; }
        shuffledOrder[q.id] = a;
      }
      return shuffledOrder[q.id];
    }

    function renderPublicQuestionHtml(q, qi){
      const label = `${qi+1}. ${escapeHtml(q.text)}${q.required? ' <span style="color:var(--red);">*</span>' : ''}`;
      const isNumeric = (q.type==='short' || q.type==='paragraph') && q.numericOnly;
      const prevVal = collected[q.id];
      let field = '';
      if(q.type==='short') field = `<input class="ps-answer" data-qid="${q.id}" data-type="short" ${isNumeric?'data-numeric="1" inputmode="decimal"':''} value="${escapeHtml(prevVal||'')}">${isNumeric? `<div class="sub" data-numeric-disp="${q.id}" style="text-align:right; font-weight:700; margin-top:4px;"></div>` : ''}`;
      else if(q.type==='paragraph') field = `<textarea class="ps-answer" data-qid="${q.id}" data-type="paragraph" rows="3" ${isNumeric?'data-numeric="1" inputmode="decimal"':''}>${escapeHtml(prevVal||'')}</textarea>${isNumeric? `<div class="sub" data-numeric-disp="${q.id}" style="text-align:right; font-weight:700; margin-top:4px;"></div>` : ''}`;
      else if(q.type==='dropdown'){
        const opts = publicOptions(q), cur = (prevVal && opts.includes(prevVal))? prevVal : '';
        field = `<div class="ps-dd" data-qid="${q.id}">
          <input type="hidden" class="ps-answer" data-qid="${q.id}" data-type="dropdown" value="${escapeHtml(cur)}">
          <button type="button" class="ps-dd-box" data-qid="${q.id}" aria-haspopup="listbox"><span class="ps-dd-val${cur? '' : ' empty'}">${cur? escapeHtml(cur) : '-- Chọn --'}</span><span class="ps-dd-caret">▾</span></button>
          <div class="ps-dd-panel" data-qid="${q.id}" style="display:none;">
            ${opts.length>=SURVEY_OPT_SEARCH_MIN? `<div class="ps-opt-search-wrap" style="margin:0 0 6px;"><input class="ps-opt-search ps-dd-search" data-qid="${q.id}" placeholder="🔍 Gõ để tìm phương án…" autocomplete="off"><button type="button" class="ps-opt-clear" data-qid="${q.id}" title="Xoá chữ tìm">✕</button></div><div class="ps-opt-found" data-qid="${q.id}"></div>` : ''}
            <div class="ps-dd-list" data-qid="${q.id}" role="listbox">
              <button type="button" class="ps-dd-item ps-dd-clearpick" data-val="" style="${cur? '' : 'display:none;'}">✕ Bỏ chọn</button>
              ${opts.map((o,oi)=>`<button type="button" class="ps-dd-item ps-opt${o===cur? ' on' : ''}" role="option" data-idx="${oi}" data-norm="${escapeHtml(surveyFold(o))}" data-val="${escapeHtml(o)}"><span class="ps-opt-txt">${escapeHtml(o)}</span></button>`).join('')}
            </div>
          </div>
        </div>`;
      }
      else if(q.type==='radio' || q.type==='checkbox'){
        const opts = publicOptions(q), many = opts.length>=SURVEY_OPT_SEARCH_MIN;
        const isChk = q.type==='checkbox';
        const isOn = o=> isChk? (Array.isArray(prevVal)&&prevVal.includes(o)) : prevVal===o;
        const status = `<span class="ps-opt-status" data-qid="${q.id}"></span>`;
        field = `<div class="ps-opt-tools">${many? `<div class="ps-opt-search-wrap"><input class="ps-opt-search" data-qid="${q.id}" placeholder="🔍 Gõ để tìm phương án…" autocomplete="off"><button type="button" class="ps-opt-clear" data-qid="${q.id}" title="Xoá chữ tìm">✕</button></div>` : ''}${status}</div>
          ${many? `<div class="ps-opt-found" data-qid="${q.id}"></div>` : ''}
          <div class="ps-opt-list${opts.length>8? ' scroll' : ''}" data-qid="${q.id}">${opts.map((o,oi)=>`<label class="sv-filter-item sv-opt sv-opt-full ps-opt" data-idx="${oi}" data-norm="${escapeHtml(surveyFold(o))}"><input type="${isChk?'checkbox':'radio'}" ${isChk? '' : `name="ps-q-${q.id}"`} class="ps-answer" data-qid="${q.id}" data-type="${q.type}" value="${escapeHtml(o)}" ${isOn(o)?'checked':''}><span class="ps-opt-txt">${escapeHtml(o)}</span></label>`).join('')}</div>`;
      }
      const desc = q.description? `<div class="sub" style="margin:-2px 0 8px; font-size:12.5px; white-space:pre-wrap;">${escapeHtml(q.description)}</div>` : '';
      return `<div class="field full" style="margin-bottom:18px;"><label>${label}</label>${desc}${field}</div>`;
    }

    function renderFillForm(){
      if(surveyLoadState==='loading'){
        root.innerHTML = `<div class="center-screen"><div class="auth-card"><div class="rice-badge">📝</div><h1>Đang tải biểu mẫu…</h1><p class="sub">Vui lòng chờ trong giây lát.</p></div></div>`;
        return;
      }
      if(surveyLoadState==='error'){
        root.innerHTML = `<div class="center-screen"><div class="auth-card"><div class="rice-badge">⚠️</div><h1>Không tải được biểu mẫu</h1><p class="sub">Có thể kết nối mạng đang gặp sự cố hoặc biểu mẫu tạm thời không thể truy cập. Vui lòng thử lại.</p><button class="btn btn-primary btn-block" id="ps-retry-btn" style="margin-top:14px;">↻ Thử lại</button></div></div>`;
        const retryBtn = document.getElementById('ps-retry-btn');
        if(retryBtn) retryBtn.onclick = loadSurvey;
        return;
      }
      if(surveyLoadState==='notFound' || !survey){
        root.innerHTML = `<div class="center-screen"><div class="auth-card"><div class="rice-badge">📝</div><h1>Không tìm thấy biểu mẫu</h1><p class="sub">Đường link này có thể đã bị xoá hoặc không tồn tại.</p></div></div>`;
        return;
      }
      if(surveyLoadState==='closed'){
        const why = { expired:`Biểu mẫu đã hết hạn nộp${survey.closeAt? ' (hạn: '+escapeHtml(surveyFmtDateTime(survey.closeAt))+')' : ''}.`, full:'Biểu mẫu đã nhận đủ số phiếu tối đa.' }[closedReason] || 'Người tạo biểu mẫu đã ngừng nhận câu trả lời.';
        root.innerHTML = `<div class="center-screen"><div class="auth-card" style="max-width:520px;"><div class="rice-badge">⛔</div><h1>${escapeHtml(survey.title)}</h1><p style="font-weight:700; color:#b71c1c;">Biểu mẫu này đã ngừng nhận câu trả lời.</p><p class="sub">${why}</p>${survey.closedMessage? `<p style="white-space:pre-wrap; margin-top:10px;">${escapeHtml(survey.closedMessage)}</p>` : ''}</div></div>`;
        return;
      }
      if(surveyLoadState==='needLogin'){
        root.innerHTML = `<div class="center-screen"><div class="auth-card" style="max-width:520px;"><div class="rice-badge">🔒</div><h1>${escapeHtml(survey.title)}</h1><p class="sub">Biểu mẫu này yêu cầu đăng nhập bằng tài khoản Google để điền phiếu (mỗi tài khoản được trả lời ${(parseInt(survey.perPersonLimit,10)||0)>0? 'tối đa '+parseInt(survey.perPersonLimit,10)+' lần' : 'nhiều lần'}).</p><button class="btn btn-primary btn-block" id="ps-login-btn" style="margin-top:14px;">🔒 Đăng nhập Google để điền phiếu</button></div></div>`;
        document.getElementById('ps-login-btn').onclick = async ()=>{
          const b = document.getElementById('ps-login-btn'); b.disabled = true; b.textContent = 'Đang mở cửa sổ đăng nhập Google…';
          try{ await auth.signInWithPopup(googleProvider); loadSurvey(); }
          catch(e){ console.error('[Khảo sát công khai] Đăng nhập lỗi:', e); if(!(e && e.code==='auth/popup-closed-by-user')) alert('Đăng nhập Google thất bại. Vui lòng thử lại.'); b.disabled = false; b.textContent = '🔒 Đăng nhập Google để điền phiếu'; }
        };
        return;
      }
      if(surveyLoadState==='limit'){
        root.innerHTML = `<div class="center-screen"><div class="auth-card" style="max-width:520px;"><div class="rice-badge">✋</div><h1>${escapeHtml(survey.title)}</h1><p style="font-weight:700;">Đồng chí đã trả lời ${respondent.count}/${respondent.limit} lần cho biểu mẫu này, không thể gửi thêm.</p>${respondent.email? `<p class="sub">Tài khoản: ${escapeHtml(respondent.email)}</p>` : ''}<p class="sub">Cảm ơn đồng chí đã tham gia.</p></div></div>`;
        return;
      }
      if(submitted){
        const left = respondent.limit>0? respondent.limit - respondent.count : Infinity;
        const canMore = left>0 && surveyAcceptState(survey).open;
        root.innerHTML = `
          <div class="center-screen"><div class="auth-card" style="max-width:520px;">
            <div class="rice-badge">✅</div>
            <h1>Đồng chí đã gửi câu trả lời thành công!</h1>
            <p class="sub">Cảm ơn đồng chí đã tham gia ${survey.isQuiz? 'bài kiểm tra':'khảo sát'} "${escapeHtml(survey.title)}".</p>
            ${survey.isQuiz? `<button class="btn btn-primary btn-block" id="ps-viewscore-btn" style="margin-top:14px;">Xem điểm số</button><div id="ps-score-area" style="margin-top:14px;"></div>` : ''}
            ${canMore? `<button class="btn btn-ghost btn-block" id="ps-another-btn" style="margin-top:10px;">📝 Gửi thêm câu trả lời khác${left!==Infinity? ` (còn ${left} lượt)` : ''}</button>` : ''}
          </div></div>`;
        const anotherBtn = document.getElementById('ps-another-btn'); if(anotherBtn) anotherBtn.onclick = resetForAnotherResponse;
        const scoreBtn = document.getElementById('ps-viewscore-btn');
        if(scoreBtn) scoreBtn.onclick = ()=>{
          document.getElementById('ps-score-area').innerHTML = `<div class="kv-row"><span>Điểm số của đồng chí</span><b>${lastResult.score||0} / ${lastResult.maxScore||0}</b></div>`;
          scoreBtn.remove();
        };
        return;
      }
      const sections = survey.sections;
      const sec = sections[currentSectionIdx] || sections[0];
      const secQuestions = (survey.questions||[]).filter(q=>q.sectionId===sec.id);
      const isLastSection = currentSectionIdx >= sections.length-1;
      root.innerHTML = `
        <div class="center-screen">
          <div class="auth-card" style="max-width:640px; text-align:left;">
            <h1>${escapeHtml(survey.title)}</h1>
            ${(survey.closeAt || respondent.limit>0 || respondent.email)? `<div class="ps-meta">${survey.closeAt? `<div>⏰ Hạn nộp: <b>${escapeHtml(surveyFmtDateTime(survey.closeAt))}</b></div>` : ''}${respondent.limit>0? `<div>📝 Đây là lần trả lời thứ <b>${respondent.count+1}/${respondent.limit}</b> của đồng chí.</div>` : ''}${respondent.email? `<div>👤 Đang điền với tài khoản <b>${escapeHtml(respondent.email)}</b> · <a href="#" id="ps-switch-acc">Đổi tài khoản</a></div>` : ''}</div>` : ''}
            ${survey.description? `<p class="sub" style="white-space:pre-wrap;">${escapeHtml(survey.description)}</p>` : ''}
            ${sections.length>1? `<div style="background:var(--paper-2); border-radius:8px; padding:8px 12px; margin:10px 0; font-size:12.5px;"><b>Phần ${currentSectionIdx+1}/${sections.length}</b>${sec.title? ' — '+escapeHtml(sec.title) : ''}${sec.description? `<div class="sub" style="margin-top:4px;">${escapeHtml(sec.description)}</div>` : ''}</div>` : ''}
            <div id="ps-questions">${secQuestions.map((q,qi)=> renderPublicQuestionHtml(q, qi)).join('')}</div>
            <button class="btn btn-primary btn-block" id="ps-next-btn" style="margin-top:6px;">${isLastSection? 'GỬI BÀI' : 'TIẾP'}</button>
            ${survey.wardName? `<p class="sub" style="text-align:center; margin-top:14px;">Biểu mẫu bởi Hội Nông dân ${escapeHtml(survey.wardName)}</p>` : ''}
          </div>
        </div>`;
      root.querySelectorAll('[data-numeric="1"]').forEach(inp=> attachPublicNumericMask(inp));
      wirePublicOptionTools(root, secQuestions);
      wirePublicDropdowns(root, secQuestions);
      const sw = document.getElementById('ps-switch-acc');
      if(sw) sw.onclick = async (e)=>{ e.preventDefault(); try{ await auth.signOut(); }catch(err){} loadSurvey(); };

      document.getElementById('ps-next-btn').onclick = async ()=>{
        let missingRequired = false;
        let branchTarget = null; // '__next__' | '__submit__' | sectionId | null (không có phân nhánh)
        secQuestions.forEach(q=>{
          const isNumeric = (q.type==='short' || q.type==='paragraph') && q.numericOnly;
          let val;
          if(q.type==='checkbox'){ val = Array.from(document.querySelectorAll(`.ps-answer[data-qid="${q.id}"]:checked`)).map(x=>x.value); }
          else if(q.type==='radio'){ const x=document.querySelector(`.ps-answer[data-qid="${q.id}"]:checked`); val = x? x.value : ''; }
          else { const x=document.querySelector(`.ps-answer[data-qid="${q.id}"]`); val = x? x.value.trim() : ''; if(isNumeric) val = val.replace(/\s/g,''); }
          collected[q.id] = val;
          if(q.required && (val==null || val==='' || (Array.isArray(val)&&val.length===0))) missingRequired = true;
          if(branchTarget===null && (q.type==='radio'||q.type==='checkbox'||q.type==='dropdown') && q.branchEnabled!==false && q.optionBranches && q.optionBranches.length){
            const selectedOpts = Array.isArray(val) ? val : (val? [val] : []);
            for(const so of selectedOpts){
              const oi = (q.options||[]).indexOf(so);
              if(oi>=0 && q.optionBranches[oi] && q.optionBranches[oi]!=='__next__'){ branchTarget = q.optionBranches[oi]; break; }
            }
          }
        });
        if(missingRequired){ alert('Vui lòng điền đầy đủ các câu hỏi bắt buộc (có dấu *) trước khi tiếp tục.'); return; }

        if(isLastSection || branchTarget==='__submit__'){
          // Kiểm tra lại NGAY LÚC GỬI: biểu mẫu có thể vừa bị đóng / hết hạn / đủ phiếu trong lúc đang điền,
          // hoặc người này vừa dùng hết lượt ở tab khác.
          try{
            const fresh = await rtdb.ref(`surveys/${survey.id}`).get();
            const fv = (fresh && fresh.exists())? fresh.val() : null;
            if(fv){ ['acceptResponses','closeAt','maxResponses','responseCount','closedMessage'].forEach(k=>{ survey[k] = fv[k]; }); }
          }catch(e){ console.warn('[Khảo sát công khai] Không kiểm tra lại được trạng thái biểu mẫu:', e); }
          const st = surveyAcceptState(survey);
          if(!st.open){ surveyLoadState = 'closed'; closedReason = st.reason; renderFillForm(); alert('Rất tiếc, biểu mẫu vừa ngừng nhận câu trả lời nên phiếu của đồng chí chưa được gửi.'); return; }
          if(respondent.key && respondent.limit>0){
            respondent.count = await surveyRespondentCount(survey.id, respondent.key);
            if(respondent.count>=respondent.limit){ surveyLoadState = 'limit'; renderFillForm(); return; }
          }
          const result = await submitPublicSurveyResponse(survey, collected, { respondentKey: respondent.key, attempt: respondent.count+1, email: respondent.email });
          if(!result.ok){
            alert(result.reason==='missing' ? 'Vui lòng điền đầy đủ các câu hỏi bắt buộc (có dấu *) trước khi gửi.' : 'Gửi câu trả lời thất bại, vui lòng kiểm tra kết nối mạng và thử lại.');
            return;
          }
          submitted = true; lastResult = result.entry;
          if(respondent.key) respondent.count += 1;
          survey.responseCount = (survey.responseCount||0) + 1;
          renderFillForm();
          return;
        }
        if(branchTarget && branchTarget!=='__next__'){
          const idx = sections.findIndex(s=>s.id===branchTarget);
          currentSectionIdx = idx>=0 ? idx : currentSectionIdx+1;
        } else {
          currentSectionIdx = currentSectionIdx+1;
        }
        renderFillForm();
      };
    }

    // Menu thả xuống: ô gọn bấm vào bung danh sách (có ô tìm khi nhiều phương án), chọn xong tự thu gọn.
    function wirePublicDropdowns(root, qs){
      qs.filter(q=> q.type==='dropdown').forEach(q=>{
        const dd = root.querySelector(`.ps-dd[data-qid="${q.id}"]`); if(!dd) return;
        const box = dd.querySelector('.ps-dd-box'), panel = dd.querySelector('.ps-dd-panel'), list = dd.querySelector('.ps-dd-list');
        const hidden = dd.querySelector('input[type="hidden"]'), valEl = dd.querySelector('.ps-dd-val');
        const search = dd.querySelector('.ps-dd-search'), found = dd.querySelector('.ps-opt-found'), clearBtn = dd.querySelector('.ps-opt-clear');
        const items = Array.from(list.querySelectorAll('.ps-opt'));
        const clearPick = list.querySelector('.ps-dd-clearpick');
        const paint = (it, term)=>{
          const txt = it.dataset.val, span = it.querySelector('.ps-opt-txt'), pos = term? it.dataset.norm.indexOf(term) : -1, n = Array.from(term||'').length, ch = Array.from(txt);
          span.innerHTML = pos<0? escapeHtml(txt) : escapeHtml(ch.slice(0,pos).join('')) + '<mark>' + escapeHtml(ch.slice(pos,pos+n).join('')) + '</mark>' + escapeHtml(ch.slice(pos+n).join(''));
          return pos>=0;
        };
        const apply = ()=>{
          if(!search) return;
          const term = surveyFold(search.value.trim());
          search.parentElement.classList.toggle('has-text', !!search.value);
          const byIdx = (a,b)=> (+a.dataset.idx) - (+b.dataset.idx);
          const sorted = items.slice().sort(byIdx);
          if(!term){ sorted.forEach(it=>{ paint(it,''); list.appendChild(it); }); found.textContent = ''; return; }
          const hit = [], miss = []; sorted.forEach(it=> (paint(it,term)? hit : miss).push(it));
          hit.concat(miss).forEach(it=> list.appendChild(it));
          found.textContent = `Tìm thấy ${hit.length}/${items.length} phương án`;
          list.scrollTop = 0;
        };
        const close = ()=>{ panel.style.display = 'none'; dd.classList.remove('open'); };
        const open = ()=>{
          root.querySelectorAll('.ps-dd.open').forEach(o=>{ if(o!==dd){ o.classList.remove('open'); o.querySelector('.ps-dd-panel').style.display = 'none'; } });
          panel.style.display = 'block'; dd.classList.add('open');
          if(search){ search.focus(); } else { const on = list.querySelector('.ps-opt.on'); if(on) on.scrollIntoView({block:'nearest'}); }
        };
        const pick = (v)=>{
          hidden.value = v;
          valEl.textContent = v || '-- Chọn --'; valEl.classList.toggle('empty', !v);
          items.forEach(it=> it.classList.toggle('on', it.dataset.val===v));
          if(clearPick) clearPick.style.display = v? '' : 'none';
          close(); box.focus();
        };
        box.onclick = (e)=>{ e.preventDefault(); dd.classList.contains('open')? close() : open(); };
        list.addEventListener('click', (e)=>{ const it = e.target.closest('.ps-dd-item'); if(it){ e.preventDefault(); pick(it.dataset.val); } });
        if(search){
          search.addEventListener('input', apply);
          search.addEventListener('keydown', (e)=>{
            if(e.key==='Enter'){ e.preventDefault(); const first = Array.from(list.querySelectorAll('.ps-opt')).find(it=> it.querySelector('mark')); if(first) pick(first.dataset.val); }
            else if(e.key==='Escape'){ close(); box.focus(); }
          });
          clearBtn.onclick = ()=>{ search.value = ''; apply(); search.focus(); };
        }
        document.addEventListener('mousedown', (e)=>{ if(dd.isConnected && dd.classList.contains('open') && !dd.contains(e.target)) close(); });
      });
    }
    // Ô tìm nhanh phương án + dòng "Đã chọn…" cho câu trắc nghiệm / hộp kiểm.
    function wirePublicOptionTools(root, qs){
      qs.filter(q=> q.type==='radio' || q.type==='checkbox').forEach(q=>{
        const list = root.querySelector(`.ps-opt-list[data-qid="${q.id}"]`); if(!list) return;
        const status = root.querySelector(`.ps-opt-status[data-qid="${q.id}"]`);
        const labels = Array.from(list.querySelectorAll('.ps-opt'));
        const updStatus = ()=>{
          const on = labels.filter(l=> l.querySelector('input').checked);
          if(!on.length){ status.className = 'ps-opt-status none'; status.textContent = 'Chưa chọn phương án nào'; status.removeAttribute('title'); return; }
          status.className = 'ps-opt-status';
          if(q.type==='checkbox'){ status.innerHTML = `☑ Đã chọn <b>${on.length}</b> phương án`; status.removeAttribute('title'); }
          else { const t = on[0].querySelector('input').value; status.innerHTML = `◉ Đã chọn: <b>${escapeHtml(t.length>60? t.slice(0,60)+'…' : t)}</b>`; status.title = t; }
        };
        list.addEventListener('change', updStatus); updStatus();
        const search = root.querySelector(`.ps-opt-search[data-qid="${q.id}"]`); if(!search) return;
        const found = root.querySelector(`.ps-opt-found[data-qid="${q.id}"]`);
        const clearBtn = root.querySelector(`.ps-opt-clear[data-qid="${q.id}"]`);
        const paint = (label, term)=>{
          const txt = label.querySelector('input').value, span = label.querySelector('.ps-opt-txt');
          const pos = term? label.dataset.norm.indexOf(term) : -1;
          span.innerHTML = pos<0? escapeHtml(txt) : (()=>{ const ch = Array.from(txt); return escapeHtml(ch.slice(0,pos).join('')) + '<mark>' + escapeHtml(ch.slice(pos, pos+Array.from(term).length).join('')) + '</mark>' + escapeHtml(ch.slice(pos+Array.from(term).length).join('')); })();
          return pos>=0;
        };
        const apply = ()=>{
          const term = surveyFold(search.value.trim());
          search.parentElement.classList.toggle('has-text', !!search.value);
          const byIdx = (a,b)=> (+a.dataset.idx) - (+b.dataset.idx);
          if(!term){ labels.slice().sort(byIdx).forEach(l=>{ paint(l,''); list.appendChild(l); }); found.textContent = ''; return; }
          const hit = [], miss = [];
          labels.slice().sort(byIdx).forEach(l=>{ (paint(l, term)? hit : miss).push(l); });
          const pinned = q.type==='checkbox'? labels.filter(l=> l.querySelector('input').checked).sort(byIdx) : [];
          const order = pinned.concat(hit.filter(l=>!pinned.includes(l)), miss.filter(l=>!pinned.includes(l)));
          order.forEach(l=> list.appendChild(l));
          found.textContent = `Tìm thấy ${hit.length}/${labels.length} phương án`;
          list.scrollTop = 0;
        };
        search.addEventListener('input', apply);
        clearBtn.onclick = ()=>{ search.value = ''; apply(); search.focus(); };
      });
    }

    async function loadSurvey(){
      surveyLoadState = 'loading';
      surveyLoadError = '';
      survey = null;
      renderFillForm();
      try{
        const snap = await rtdb.ref(`surveys/${surveyId}`).get();
        const nextSurvey = (snap && snap.exists()) ? snap.val() : null;
        if(!nextSurvey || nextSurvey.deleted){
          surveyLoadState = 'notFound';
          survey = null;
        }else{
          ensureSurveySections(nextSurvey);
          survey = nextSurvey;
          surveyLoadState = 'ready';
          await prepareAccess();
        }
      }catch(e){
        console.error('[Khảo sát công khai] Không tải được biểu mẫu:', e);
        surveyLoadError = String(e && e.code || 'load_failed');
        surveyLoadState = 'error';
        survey = null;
      }
      renderFillForm();
    }
    loadSurvey();
  }
