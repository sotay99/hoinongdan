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
  function surveyQCanBranch(q){ return q.type==='radio' || q.type==='checkbox'; }
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
  async function submitPublicSurveyResponse(survey, answers){
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
    if(survey.isQuiz){
      const { score, maxScore } = computeSurveyScore(survey, answers);
      entry.score = score; entry.maxScore = maxScore;
    }
    try{
      await rtdb.ref(`survey_responses/${survey.id}/${id}`).set(entry);
      await rtdb.ref(`surveys/${survey.id}/responseCount`).transaction(cur=> (cur||0)+1);
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

  function renderSurveyListView(el){
    const isShared = state.surveySpace==='shared';
    const canEdit = surveyCanEdit();
    const canView = surveyCanView();
    const list = state.surveys.slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
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
          <div class="table-wrap" style="margin-top:14px;">
            <table>
              <thead><tr><th>Tên biểu mẫu</th><th>Ngày tạo</th><th>Số người đã trả lời</th><th></th></tr></thead>
              <tbody>
                ${list.length? list.map(s=>`
                  <tr>
                    <td><b>${escapeHtml(s.title)}</b>${s.isQuiz? ' <span class="pill pill-gray">Bài kiểm tra</span>' : ''}</td>
                    <td>${s.createdAt? fmtDate(s.createdAt.slice(0,10)) : '—'}</td>
                    <td>${s.responseCount||0}</td>
                    <td style="white-space:nowrap; display:flex; gap:6px;">
                      <button class="btn btn-ghost btn-sm" data-sv-open="${s.id}">${canEdit? 'Sửa / Xem kết quả' : 'Xem kết quả'}</button>
                      <button class="btn btn-ghost btn-sm" data-sv-copy="${s.id}">🔗 Copy link</button>
                      ${canEdit? `<button class="btn btn-ghost btn-sm" data-sv-delete="${s.id}" style="color:var(--red);">Xoá</button>` : ''}
                    </td>
                  </tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="e-ico">📝</div>Chưa có biểu mẫu nào${canEdit? ' — bấm "Tạo biểu mẫu mới" để bắt đầu' : ''}</div></td></tr>`}
              </tbody>
            </table>
          </div>`}
        </div>
      </div>`;
    const spaceSharedBtn = document.getElementById('sv-space-shared');
    if(spaceSharedBtn) spaceSharedBtn.onclick = ()=> switchSurveySpace('shared');
    const spacePersonalBtn = document.getElementById('sv-space-personal');
    if(spacePersonalBtn) spacePersonalBtn.onclick = ()=> switchSurveySpace('personal');
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
              ${canEdit? `<button type="button" class="btn btn-ghost btn-sm sv-kebab preview-allow" data-qmenu="${q.id}" data-pop-anchor title="Thêm tuỳ chọn cho câu hỏi này">⋮</button>` : ''}
            </div>
            ${showDesc? `<input class="q-desc" data-qid="${q.id}" value="${escapeHtml(q.description||'')}" placeholder="Mô tả câu hỏi (không bắt buộc)" style="width:100%; font-size:12.5px; margin-bottom:8px;" ${canEdit?'':'disabled'}>` : ''}
            ${pills.length? `<div>${pills.map(p=>`<span class="sv-pill">${p}</span>`).join('')}</div>` : ''}
            <div class="form-grid">
              <div class="field"><label>Loại câu hỏi</label>
                <select class="q-type" data-qid="${q.id}" ${canEdit?'':'disabled'}>${SURVEY_QTYPES.map(t=>`<option value="${t.key}" ${q.type===t.key?'selected':''}>${t.label}</option>`).join('')}</select>
              </div>
              <div class="field"><label>&nbsp;</label>
                <label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="q-required" data-qid="${q.id}" ${q.required?'checked':''} ${canEdit?'':'disabled'}><span>Bắt buộc trả lời</span></label>
              </div>
              ${isFreeText? `<div class="field"><label>&nbsp;</label>
                <label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="q-numeric" data-qid="${q.id}" ${q.numericOnly?'checked':''} ${canEdit?'':'disabled'}><span>🔢 Chỉ nhập số</span></label>
              </div>` : ''}
            </div>
            ${isFreeText? `<p class="sub" style="margin:4px 0;">${q.numericOnly? '🔢 Người trả lời chỉ được nhập chữ số và dấu phẩy (,) — tự động tách cụm 3 số khi gõ.' : ''}</p>` : ''}
            ${surveyQTypeHasOptions(q.type)? `
              <p class="sub" style="margin:4px 0;">${q.type==='checkbox'? '☑️ Được chọn NHIỀU phương án.' : '🔘 Chỉ được chọn 1 phương án.'}</p>
              <div class="q-options-list">
                ${(q.options||[]).map((opt,oi)=>`
                  <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;">
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
              ${canEdit? `<button class="btn btn-ghost btn-sm q-add-option" data-qid="${q.id}">➕ Thêm phương án</button>` : ''}
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
          <div class="panel" style="margin-bottom:16px; border:2px solid var(--gold);" data-section-card="${sec.id}">
            <div class="panel-head" style="background:rgba(199,154,43,.08); display:flex; align-items:center; gap:8px;">
              <h3 style="font-size:13.5px;">📑 Phần ${si+1}/${draft.sections.length}${secQuestions.length? '' : ' <span class="sub" style="font-weight:400;">(chưa có câu hỏi)</span>'}</h3>
              ${canEdit? `<button type="button" class="btn btn-ghost btn-sm sv-kebab preview-allow" data-secmenu="${sec.id}" data-pop-anchor title="Thêm tuỳ chọn cho phần này" style="margin-left:auto;">⋮</button>` : ''}
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

  function renderSurveyEditorView(el){
    const draft = state.surveyDraft;
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
            <button class="btn ${state.surveyEditorTab==='answers'?'btn-primary':'btn-ghost'} btn-sm" id="sv-tab-answers" ${!state.surveyEditingId?'disabled':''}>📊 Câu trả lời${draft.responseCount?` (${draft.responseCount})`:''}</button>
            <div class="spacer"></div>
            ${state.surveyEditingId? `<button class="btn btn-ghost btn-sm" id="sv-copylink-btn">🔗 Copy link chia sẻ</button>` : ''}
            ${canEdit && state.surveyEditorTab==='questions'? `<button class="btn btn-primary btn-sm" id="sv-save-btn">💾 Lưu biểu mẫu</button>` : ''}
          </div>
          <div id="sv-tab-content">
            ${state.surveyEditorTab==='questions'? renderSurveyQuestionsEditorHtml(draft, canEdit) : renderSurveyAnswersTabHtml(draft)}
          </div>
        </div>
      </div>`;
    wireSurveyEditor(el);
  }

  function wireSurveyEditor(el){
    const draft = state.surveyDraft;
    document.getElementById('sv-back-btn').onclick = ()=>{ state.surveyView='list'; state.surveyDraft=null; state.surveyEditingId=null; renderSurveyTab(el); };
    document.getElementById('sv-tab-questions').onclick = ()=>{ state.surveyEditorTab='questions'; renderSurveyTab(el); };
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
      const addSectionBtn = document.getElementById('sv-add-section-btn');
      if(addSectionBtn) addSectionBtn.onclick = ()=>{ draft.sections.push(emptySurveySection(draft.sections.length+1)); renderSurveyTab(el); };
      const saveBtn = document.getElementById('sv-save-btn'); if(saveBtn) saveBtn.onclick = async ()=>{ if(await saveSurveyDraft()){ showToast('Đã lưu biểu mẫu!'); renderSurveyTab(el); } };
    } else {
      const toggleBtn = document.getElementById('sv-toggle-detail');
      if(toggleBtn) toggleBtn.onclick = ()=>{ state.surveyResponseDetailOpen = !state.surveyResponseDetailOpen; renderSurveyTab(el); };
      const prevBtn = document.getElementById('sv-resp-prev'); if(prevBtn) prevBtn.onclick = ()=>{ state.surveyResponseViewIndex--; renderSurveyTab(el); };
      const nextBtn = document.getElementById('sv-resp-next'); if(nextBtn) nextBtn.onclick = ()=>{ state.surveyResponseViewIndex++; renderSurveyTab(el); };
      const exportBtn = document.getElementById('sv-export-excel-btn'); if(exportBtn) exportBtn.onclick = ()=> renderSurveyExportPreviewModal(draft, state.surveyResponses);
      const printBtn = document.getElementById('sv-print-btn'); if(printBtn) printBtn.onclick = ()=> printSurveyResponses(draft, state.surveyResponses);
    }
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
        { icon:'📥', label:'Nhập câu hỏi từ biểu mẫu khác vào phần này', onClick:()=> renderImportQuestionsModal(el, sec.id) },
        { icon:'🔗', label:'Hợp nhất với phần phía trên', disabled:i===0, onClick:()=> secMergeUp(sec) },
        'sep',
        { icon:'🗑️', label:'Xoá phần', danger:true, disabled:n<=1, onClick:()=> secDelete(sec) },
      ]);
    });
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
      else if(q.type==='dropdown') field = `<select class="ps-answer" data-qid="${q.id}" data-type="dropdown"><option value="">-- Chọn --</option>${publicOptions(q).map(o=>`<option value="${escapeHtml(o)}" ${prevVal===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select>`;
      else if(q.type==='radio') field = `<div>${publicOptions(q).map(o=>`<label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="ps-q-${q.id}" class="ps-answer" data-qid="${q.id}" data-type="radio" value="${escapeHtml(o)}" ${prevVal===o?'checked':''}><span>${escapeHtml(o)}</span></label>`).join('')}</div>`;
      else if(q.type==='checkbox') field = `<div>${publicOptions(q).map(o=>`<label class="sv-filter-item sv-opt sv-opt-full"><input type="checkbox" class="ps-answer" data-qid="${q.id}" data-type="checkbox" value="${escapeHtml(o)}" ${(Array.isArray(prevVal)&&prevVal.includes(o))?'checked':''}><span>${escapeHtml(o)}</span></label>`).join('')}</div>`;
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
      if(submitted){
        root.innerHTML = `
          <div class="center-screen"><div class="auth-card" style="max-width:520px;">
            <div class="rice-badge">✅</div>
            <h1>Đồng chí đã gửi câu trả lời thành công!</h1>
            <p class="sub">Cảm ơn đồng chí đã tham gia ${survey.isQuiz? 'bài kiểm tra':'khảo sát'} "${escapeHtml(survey.title)}".</p>
            ${survey.isQuiz? `<button class="btn btn-primary btn-block" id="ps-viewscore-btn" style="margin-top:14px;">Xem điểm số</button><div id="ps-score-area" style="margin-top:14px;"></div>` : ''}
          </div></div>`;
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
            ${survey.description? `<p class="sub" style="white-space:pre-wrap;">${escapeHtml(survey.description)}</p>` : ''}
            ${sections.length>1? `<div style="background:var(--paper-2); border-radius:8px; padding:8px 12px; margin:10px 0; font-size:12.5px;"><b>Phần ${currentSectionIdx+1}/${sections.length}</b>${sec.title? ' — '+escapeHtml(sec.title) : ''}${sec.description? `<div class="sub" style="margin-top:4px;">${escapeHtml(sec.description)}</div>` : ''}</div>` : ''}
            <div id="ps-questions">${secQuestions.map((q,qi)=> renderPublicQuestionHtml(q, qi)).join('')}</div>
            <button class="btn btn-primary btn-block" id="ps-next-btn" style="margin-top:6px;">${isLastSection? 'GỬI BÀI' : 'TIẾP'}</button>
            ${survey.wardName? `<p class="sub" style="text-align:center; margin-top:14px;">Biểu mẫu bởi Hội Nông dân ${escapeHtml(survey.wardName)}</p>` : ''}
          </div>
        </div>`;
      root.querySelectorAll('[data-numeric="1"]').forEach(inp=> attachPublicNumericMask(inp));

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
          if(branchTarget===null && (q.type==='radio'||q.type==='checkbox') && q.branchEnabled!==false && q.optionBranches && q.optionBranches.length){
            const selectedOpts = Array.isArray(val) ? val : (val? [val] : []);
            for(const so of selectedOpts){
              const oi = (q.options||[]).indexOf(so);
              if(oi>=0 && q.optionBranches[oi] && q.optionBranches[oi]!=='__next__'){ branchTarget = q.optionBranches[oi]; break; }
            }
          }
        });
        if(missingRequired){ alert('Vui lòng điền đầy đủ các câu hỏi bắt buộc (có dấu *) trước khi tiếp tục.'); return; }

        if(isLastSection || branchTarget==='__submit__'){
          const result = await submitPublicSurveyResponse(survey, collected);
          if(!result.ok){
            alert(result.reason==='missing' ? 'Vui lòng điền đầy đủ các câu hỏi bắt buộc (có dấu *) trước khi gửi.' : 'Gửi câu trả lời thất bại, vui lòng kiểm tra kết nối mạng và thử lại.');
            return;
          }
          submitted = true; lastResult = result.entry;
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
