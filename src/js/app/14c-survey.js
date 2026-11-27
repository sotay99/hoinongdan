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
    return { id: 'q_'+uid(), text:'', type:'short', required:false, options:['Phương án 1'], correctAnswers:[], points:null,
      numericOnly:false, optionBranches:['__next__'], sectionId: sectionId||null };
  }
  function emptySurveyDraft(){
    const sec = emptySurveySection(1);
    return { id:null, wardId: wardId(), wardName:(state.config&&state.config.wardName)||'',
      scope: state.surveySpace, ownerEmail: (state.identity&&state.identity.email) || null,
      title:'Biểu mẫu không có tiêu đề', description:'',
      isQuiz:false, sections:[sec], questions:[emptySurveyQuestion(sec.id)], createdAt:null, updatedAt:null, deleted:false, responseCount:0 };
  }
  // ---- "Biểu mẫu này được gọi là gì?" (draft.formKind) — CHỈ là cách gọi tên, độc lập với isQuiz
  // (chấm điểm). Tên đầy đủ hiện ở mọi nơi: "Biểu mẫu: <Loại> <tiêu đề>", hoặc "Biểu mẫu khảo sát:
  // <tiêu đề>" khi chưa chọn. Slug (og) trùng tên ảnh xem trước public/og/khaosat-<og>.png và trùng
  // bảng loại trong functions/index.js (surveyMeta) — đổi một nơi phải đổi cả hai. ----
  const SURVEY_FORM_KINDS = [
    { k:'kiemtra',  opt:'Đây là Bài kiểm tra', label:'Bài kiểm tra', alias:['bài kiểm tra','kiểm tra'], act:'làm bài kiểm tra', done:'nộp bài', btn:'NỘP BÀI', icon:'📝' },
    { k:'cuocthi',  opt:'Đây là Bài Cuộc thi', label:'Cuộc thi', alias:['bài cuộc thi','cuộc thi'], act:'tham gia cuộc thi', done:'nộp bài dự thi', btn:'NỘP BÀI DỰ THI', icon:'🏆' },
    { k:'khaosat',  opt:'Đây là Bài Khảo sát', label:'Khảo sát', alias:['bài khảo sát','khảo sát'], act:'tham gia khảo sát', done:'gửi câu trả lời', btn:'GỬI BÀI', icon:'📊' },
    { k:'layykien', opt:'Đây là Bài Khảo sát lấy ý kiến', label:'Khảo sát lấy ý kiến', alias:['khảo sát lấy ý kiến','lấy ý kiến'], act:'góp ý kiến', done:'gửi ý kiến', btn:'GỬI Ý KIẾN', icon:'💬' },
    { k:'thuthap',  opt:'Đây là Bài Khảo sát thu thập thông tin', label:'Khảo sát thu thập thông tin', alias:['khảo sát thu thập thông tin','thu thập thông tin'], act:'cung cấp thông tin', done:'gửi thông tin', btn:'GỬI THÔNG TIN', icon:'🗂️' },
    { k:'trinhbao', opt:'Đây là Bài Thu thập đơn trình báo', label:'Thu thập đơn trình báo', alias:['thu thập đơn trình báo','đơn trình báo'], act:'gửi đơn trình báo', done:'gửi đơn trình báo', btn:'GỬI ĐƠN', icon:'📨' },
  ];
  function surveyKindInfo(s){ const k = s && s.formKind; return (k && SURVEY_FORM_KINDS.find(x=> x.k===k)) || null; }
  // Số ký tự đầu của t khớp (không dấu, không hoa thường) với cụm p, và ngay sau đó là hết chuỗi hoặc
  // dấu cách/dấu câu — tránh "Cuộc thi" khớp nhầm "Cuộc thiết kế". Trả -1 nếu không khớp.
  function surveyPrefixLen(t, p){
    const ch = Array.from(t), fp = surveyFold(p), n = Array.from(fp).length;
    if(ch.length < n || surveyFold(ch.slice(0,n).join('')) !== fp) return -1;
    if(ch.length > n && !/[\s:.,;\-–—(]/.test(ch[n])) return -1;
    return n;
  }
  function surveyFullName(s){
    const t = String((s && s.title) || '').trim() || 'Biểu mẫu không có tiêu đề';
    const k = surveyKindInfo(s);
    if(!k) return surveyPrefixLen(t, 'biểu mẫu') >= 0 ? t : 'Biểu mẫu khảo sát: ' + t;
    // Tiêu đề đã mở đầu bằng tên loại (hoặc cách gọi ngắn) -> chuẩn hoá chữ hoa theo tên loại, không lặp.
    const aliases = k.alias.slice().sort((a,b)=> b.length-a.length);
    for(const a of aliases){
      const n = surveyPrefixLen(t, a);
      if(n >= 0){ const rest = Array.from(t).slice(n).join('').replace(/^[\s:.,;\-–—]+/, ''); return 'Biểu mẫu: ' + k.label + (rest? ' ' + rest : ''); }
    }
    return 'Biểu mẫu: ' + k.label + ' ' + t;
  }
  // Cụm động từ dùng trong lời cảm ơn/lời mời ("Cảm ơn bạn đã ___").
  function surveyKindAct(s){ const k = surveyKindInfo(s); return k? k.act : (s && s.isQuiz? 'tham gia bài kiểm tra' : 'tham gia khảo sát'); }
  function surveyKindDone(s){ const k = surveyKindInfo(s); return k? k.done : 'gửi câu trả lời'; }
  function surveyKindBtn(s){ const k = surveyKindInfo(s); return k? k.btn : 'GỬI BÀI'; }
  function surveyKindOg(s){ const k = surveyKindInfo(s); return k? k.k : 'macdinh'; }
  // Thứ tự câu hỏi trong mảng luôn khớp thứ tự hiển thị (theo thứ tự Phần) — để số thứ tự câu,
  // di chuyển lên/xuống và xuất kết quả đều đúng sau khi di chuyển/nhân bản phần.
  function surveyNormalizeOrder(draft){
    draft.questions = draft.sections.flatMap(sec=> draft.questions.filter(q=> q.sectionId===sec.id));
  }
  // ---- GĐ6: loại câu hỏi mới — thang điểm, lưới trắc nghiệm, lưới hộp kiểm, ngày, giờ, tải tệp ----
  // Lưới: q.rows (các hàng/ý cần đánh giá) × q.cols (các mức lựa chọn); câu trả lời là MẢNG theo thứ tự
  // hàng (lưới trắc nghiệm: chuỗi; lưới hộp kiểm: mảng chuỗi). "Bắt buộc" ở câu lưới = phải chọn MỌI hàng.
  // Tải tệp: tệp lưu ở Firebase Storage survey_uploads/{biểu mẫu}/…; câu trả lời là mảng {name,url,size,path}.
  const SURVEY_FILE_KINDS = { any:{label:'Mọi loại tệp', accept:''}, image:{label:'Chỉ ảnh', accept:'image/*'},
    pdf:{label:'Chỉ PDF', accept:'.pdf,application/pdf'}, doc:{label:'Tài liệu (PDF, Word, Excel)', accept:'.pdf,.doc,.docx,.xls,.xlsx'} };
  function surveyIsGrid(q){ return q && (q.type==='grid_radio' || q.type==='grid_checkbox'); }
  function surveyEnsureTypeDefaults(q){
    if(q.type==='scale'){ if(q.scaleMin==null) q.scaleMin = 1; if(q.scaleMax==null) q.scaleMax = 5; if(q.scaleMinLabel==null) q.scaleMinLabel = ''; if(q.scaleMaxLabel==null) q.scaleMaxLabel = ''; }
    if(surveyIsGrid(q)){ if(!Array.isArray(q.rows) || !q.rows.length) q.rows = ['Hàng 1']; if(!Array.isArray(q.cols) || !q.cols.length) q.cols = ['Cột 1']; }
    if(q.type==='file'){ if(!q.maxFiles) q.maxFiles = 1; if(!q.maxSizeMb) q.maxSizeMb = 10; if(!q.fileKind) q.fileKind = 'any'; }
  }
  function surveyScaleValues(q){ const a = [], lo = parseInt(q.scaleMin,10)||0, hi = parseInt(q.scaleMax,10)||5; for(let v=lo; v<=hi; v++) a.push(String(v)); return a; }
  function surveyGridCell(v, i){ if(v==null) return undefined; const c = v[i]; return c===undefined? v[String(i)] : c; }
  function surveyFileList(v){ return (Array.isArray(v)? v : (v && typeof v==='object'? Object.values(v) : [])).filter(f=> f && f.name); }
  function surveyIsImageFile(f){ return !!f && ((f.type||'').startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(f.name||'')); }
  // Nhóm ảnh cho khung xem ảnh phóng to — đăng ký lại mỗi lần vẽ tab Câu trả lời.
  let surveyLbGroups = {};
  function surveyLbRegister(files){ const id = 'g'+Object.keys(surveyLbGroups).length; surveyLbGroups[id] = files; return id; }
  // Ô hiển thị tệp: ảnh -> ảnh thu nhỏ bấm để phóng to; tệp khác -> link mở.
  function surveyFilesHtml(files, size){
    if(!files.length) return '';
    const imgs = files.filter(surveyIsImageFile), others = files.filter(f=> !surveyIsImageFile(f));
    const g = imgs.length? surveyLbRegister(imgs) : null;
    return `${imgs.length? `<div class="sv-thumbs">${imgs.map((f,i)=>`<button type="button" class="sv-thumb-btn preview-allow" data-lb="${g}" data-lb-i="${i}" title="${escapeHtml(f.name)} — bấm để phóng to"><img class="sv-thumb ${size||''}" src="${escapeHtml(f.url)}" alt="${escapeHtml(f.name)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🖼️',className:'sv-thumb-broken'}))"></button>`).join('')}</div>` : ''}${others.map(f=>`<div><a href="${escapeHtml(f.url)}" target="_blank" rel="noopener">📎 ${escapeHtml(f.name)}</a></div>`).join('')}`;
  }
  function surveyWireLightbox(scope){
    scope.querySelectorAll('[data-lb]').forEach(b=> b.onclick = (e)=>{ e.preventDefault(); const files = surveyLbGroups[b.dataset.lb]; if(files) surveyOpenLightbox(files, parseInt(b.dataset.lbI,10)||0); });
  }
  function surveyOpenLightbox(files, start){
    let i = start;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg sv-lightbox';
    document.body.appendChild(wrap);
    const close = ()=>{ document.removeEventListener('keydown', onKey); wrap.remove(); };
    const onKey = (e)=>{ if(e.key==='Escape') close(); else if(e.key==='ArrowRight' && i<files.length-1){ i++; render(); } else if(e.key==='ArrowLeft' && i>0){ i--; render(); } };
    document.addEventListener('keydown', onKey);
    function render(){
      const f = files[i];
      wrap.innerHTML = `<div class="sv-lb-box">
        <div class="sv-lb-head"><b>${escapeHtml(f.name)}</b><span class="sub">${i+1}/${files.length}</span><a href="${escapeHtml(f.url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">⬇️ Mở ảnh gốc</a><button type="button" class="modal-close preview-allow" id="svlb-close">✕</button></div>
        <div class="sv-lb-body"><button type="button" class="sv-lb-nav preview-allow" id="svlb-prev" ${i<=0?'disabled':''}>‹</button><img src="${escapeHtml(f.url)}" alt="${escapeHtml(f.name)}"><button type="button" class="sv-lb-nav preview-allow" id="svlb-next" ${i>=files.length-1?'disabled':''}>›</button></div>
      </div>`;
      wrap.querySelector('#svlb-close').onclick = close;
      wrap.querySelector('#svlb-prev').onclick = ()=>{ if(i>0){ i--; render(); } };
      wrap.querySelector('#svlb-next').onclick = ()=>{ if(i<files.length-1){ i++; render(); } };
    }
    wrap.addEventListener('click', (e)=>{ if(e.target===wrap) close(); });
    render();
  }
  // Tải TẤT CẢ tệp của 1 câu (theo bộ lọc đang áp dụng) thành 1 tệp .zip — mỗi tệp đặt tên theo số
  // thứ tự phiếu + người nộp. Cần bucket Storage cho phép trình duyệt tải nội dung tệp (CORS).
  async function surveyDownloadFilesZip(draft, q, list, btn){
    const items = []; list.forEach((r,i)=> surveyFileList(r.answers && r.answers[q.id]).forEach(f=> items.push({ f, stt:i+1, who: surveyWhoText(r) })));
    if(!items.length){ alert('Câu này chưa có tệp nào.'); return; }
    try{ await loadOptionalLibrary('jszip'); }catch(e){ alert('Không tải được thư viện nén tệp (JSZip). Vui lòng kiểm tra kết nối mạng rồi thử lại.'); return; }
    const old = btn? btn.textContent : '';
    const zip = new JSZip(), used = new Set(); let ok = 0; const failed = [];
    const clean = t=> String(t||'').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim();
    for(let k=0; k<items.length; k++){
      const { f, stt, who } = items[k];
      if(btn){ btn.disabled = true; btn.textContent = `⏳ Đang gom tệp ${k+1}/${items.length}…`; }
      let name = clean(`${String(stt).padStart(3,'0')}${who? '_'+who.split(' · ')[0] : ''}_${f.name}`).slice(0,150);
      while(used.has(name)) name = name.replace(/(\.[^.]*)?$/, m=> '_'+(used.size)+m);
      used.add(name);
      try{ const res = await fetch(f.url); if(!res.ok) throw new Error('HTTP '+res.status); zip.file(name, await res.blob()); ok++; }
      catch(e){ console.warn('[Khảo sát] Không tải được tệp để nén:', f.name, e); failed.push(f.name); }
    }
    if(btn){ btn.textContent = '⏳ Đang nén…'; }
    try{
      if(ok){
        const blob = await zip.generateAsync({ type:'blob' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `Tep_${surveyFold(q.text||'cau-hoi').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40) || 'cau-hoi'}_${todayStr()}.zip`; // tên không dấu cho chắc chắn mọi trình duyệt giữ đúng tên
        document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }
    }finally{ if(btn){ btn.disabled = false; btn.textContent = old; } }
    if(failed.length) alert(`Đã nén được ${ok}/${items.length} tệp.${ok? '' : ' Không tải được tệp nào.'}\n\nKhông tải được ${failed.length} tệp. Nguyên nhân thường gặp: kho lưu trữ Firebase Storage chưa cho phép trình duyệt tải nội dung tệp (cần cấu hình CORS cho bucket). Đồng chí vẫn mở được từng tệp bằng link ở bảng câu trả lời.`);
    else showToast(`Đã nén ${ok} tệp thành 1 tệp .zip.`);
  }
  function surveyHasAnswer(q, v){
    if(v==null) return false;
    if(surveyIsGrid(q)) return (q.rows||[]).some((_,i)=>{ const c = surveyGridCell(v,i); return Array.isArray(c)? c.length>0 : (c!=null && c!==''); });
    if(q.type==='file') return surveyFileList(v).length>0;
    if(Array.isArray(v)) return v.length>0;
    return v!=='';
  }
  function surveyQCanBranch(q){ return q.type==='radio' || q.type==='checkbox' || q.type==='dropdown'; }
  // ---- Chú thích loại câu hỏi (1 dòng ngắn dưới ô "Loại câu hỏi") + bản giải thích đầy đủ khi bấm nút "i"
  // (cùng kiểu nút tròn qbox-info-btn của Sổ vay vốn: bấm hiện khung giải thích ngay bên dưới, bấm lại ẩn).
  const SURVEY_TYPE_HINT = {
    radio:'🔘 Hiện sẵn mọi phương án, người trả lời chỉ chọn được 1.',
    checkbox:'☑️ Hiện sẵn mọi phương án, người trả lời chọn được nhiều.',
    dropdown:'🔽 Thu gọn trong 1 ô, bấm vào mới hiện danh sách để chọn 1.',
    scale:'⭐ Một dãy số liền nhau (VD 1 → 5), người trả lời chọn 1 mức.',
    grid_radio:'🔲 Bảng nhiều hàng × nhiều cột, MỖI HÀNG chọn đúng 1 cột.',
    grid_checkbox:'☑️ Bảng nhiều hàng × nhiều cột, mỗi hàng chọn được NHIỀU cột.',
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
  Object.assign(SURVEY_TYPE_HELP, {
    scale:{ title:'⭐ Thang điểm', items:[
      '<b>Người trả lời thấy:</b> một hàng các con số (VD 1 2 3 4 5), hai đầu có nhãn (VD "Rất không hài lòng" … "Rất hài lòng"). Bấm chọn 1 số.',
      '<b>Nên dùng khi:</b> đo <i>mức độ</i> — hài lòng, đồng ý, quan tâm, chất lượng… Phần thống kê tự tính <b>điểm trung bình</b>.',
      'Đặt mức thấp nhất (0 hoặc 1), mức cao nhất (2 đến 10) và nhãn cho 2 đầu ở ngay bên dưới.' ] },
    grid_radio:{ title:'🔲 Lưới trắc nghiệm', items:[
      '<b>Người trả lời thấy:</b> một bảng — mỗi <b>hàng</b> là 1 ý cần đánh giá, mỗi <b>cột</b> là 1 mức. Ở MỖI hàng chọn đúng 1 ô.',
      '<b>Nên dùng khi:</b> nhiều ý cùng dùng chung 1 thang. Ví dụ: đánh giá "Thủ tục vay", "Thái độ cán bộ", "Thời gian giải ngân" theo các mức "Tốt / Khá / Trung bình / Kém".',
      'Bật "Bắt buộc trả lời" thì người trả lời phải chọn ở <b>mọi hàng</b>.' ] },
    grid_checkbox:{ title:'☑️ Lưới hộp kiểm', items:[
      '<b>Người trả lời thấy:</b> một bảng như lưới trắc nghiệm, nhưng ở mỗi hàng tick được <b>nhiều</b> ô.',
      '<b>Nên dùng khi:</b> mỗi ý có thể ứng với nhiều lựa chọn. Ví dụ: hàng là các loại cây trồng, cột là các mùa vụ "Đông Xuân / Hè Thu / Thu Đông".',
      'Bật "Bắt buộc trả lời" thì người trả lời phải tick ít nhất 1 ô ở <b>mọi hàng</b>.' ] },
  });
  const surveyTypeTipOpen = {}; // khung giải thích của câu nào đang mở — giữ nguyên qua các lần vẽ lại
  function surveyTypeHelpHtml(type){
    const h = SURVEY_TYPE_HELP[type]; if(!h) return '';
    return `<b>${h.title}</b><ul style="margin:4px 0 6px; padding-left:18px;">${h.items.map(x=>`<li style="margin-bottom:3px;">${x}</li>`).join('')}</ul>
      ${surveyIsGrid({type}) ? `<div style="border-top:1px dashed var(--line); padding-top:5px;"><b>So sánh nhanh:</b> 🔲 Lưới trắc nghiệm: mỗi hàng chọn <b>1</b> · ☑️ Lưới hộp kiểm: mỗi hàng chọn <b>nhiều</b></div>` : type==='scale'? '' : `<div style="border-top:1px dashed var(--line); padding-top:5px;"><b>So sánh nhanh 3 loại:</b> 🔘 Trắc nghiệm: hiện sẵn, chọn <b>1</b> · ☑️ Hộp kiểm: hiện sẵn, chọn <b>nhiều</b> · 🔽 Menu thả xuống: <b>thu gọn</b>, chọn <b>1</b></div>`}`;
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
      surveyEnsureTypeDefaults(q);
      if(q.points==null) q.points = draft.isQuiz? (parseFloat(draft.quizDefaultPoints)>=0? parseFloat(draft.quizDefaultPoints) : 1) : 0;
      if(surveyIsGrid(q) && !Array.isArray(q.gridAnswers)) q.gridAnswers = (q.rows||[]).map(()=> q.type==='grid_checkbox'? [] : '');
    });
    if(draft.quizRelease==null) draft.quizRelease = 'immediate';
    ['quizShowMissed','quizShowCorrect','quizShowPoints'].forEach(k=>{ if(draft[k]==null) draft[k] = true; });
    if(draft.quizDefaultPoints==null) draft.quizDefaultPoints = 1;
    if(draft.collectName==null) draft.collectName = false;
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
      const mine = all.filter(s=> (state.surveySpace==='personal') ? s.scope==='personal' : s.scope!=='personal');
      state.surveys = mine.filter(s=> !s.deleted);
      state.surveyTrash = mine.filter(s=> s.deleted).sort((a,b)=> (b.deletedAt||'').localeCompare(a.deletedAt||''));
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
      if(surveyIsGrid(q) && (!(q.rows||[]).some(x=>String(x).trim()) || !(q.cols||[]).some(x=>String(x).trim()))){ alert(`Câu hỏi lưới "${q.text}" cần ít nhất 1 hàng và 1 cột có nội dung.`); return false; }
      if(q.type==='scale' && (parseInt(q.scaleMin,10)||0) >= (parseInt(q.scaleMax,10)||0)){ alert(`Câu hỏi thang điểm "${q.text}": mức cao nhất phải lớn hơn mức thấp nhất.`); return false; }
      if(surveyQTypeHasOptions(q.type) && (!q.options || q.options.filter(o=>o.trim()).length<1)){ alert(`Câu hỏi "${q.text}" cần ít nhất 1 phương án.`); return false; }
    }
    const id = d.id || uid();
    const toSave = { ...d, id, wardId: wardId(), wardName:(state.config&&state.config.wardName)||'',
      updatedAt:new Date().toISOString(), createdAt: d.createdAt || new Date().toISOString(),
      responseCount: d.responseCount||0, deleted:false };
    // Số phiếu có thể đã tăng (người khác vừa nộp) trong lúc đang soạn -> lấy số MỚI NHẤT trên máy chủ,
    // không ghi đè bằng con số cũ trong bản nháp.
    if(d.id){ try{ const c = await rtdb.ref(`surveys/${id}/responseCount`).get(); if(c && c.exists()) toSave.responseCount = parseInt(c.val(),10)||0; }catch(e){} }
    await rtdb.ref(`surveys/${id}`).set(toSave);
    await pushLog(d.id? 'sửa biểu mẫu':'tạo biểu mẫu', surveyFullName(toSave));
    state.surveyDraft = toSave;
    state.surveyEditingId = id;
    return true;
  }
  // Xoá = chuyển vào Thùng rác (deleted:true): GIỮ NGUYÊN câu trả lời, link công khai ngừng nhận phiếu.
  // Chỉ "Xoá vĩnh viễn" trong Thùng rác mới xoá hẳn biểu mẫu + câu trả lời + bộ đếm người trả lời.
  function surveyNoEditAlert(verb){ alert(state.surveySpace==='personal' ? 'Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.' : `Đồng chí không có quyền ${verb} Biểu mẫu dùng chung này.`); }
  async function deleteSurvey(id){
    if(!surveyCanEdit()){ surveyNoEditAlert('xoá'); return; }
    const s = state.surveys.find(x=>x.id===id);
    if(!s) return;
    const name = surveyFullName(s);
    if(!confirm(`Chuyển "${name}" vào Thùng rác?\n\nCâu trả lời đã thu thập vẫn được giữ nguyên; link chia sẻ sẽ ngừng nhận phiếu. Đồng chí có thể khôi phục lại trong mục "Thùng rác" ở cuối danh sách.`)) return;
    try{
      await rtdb.ref(`surveys/${id}`).update({ deleted:true, deletedAt:new Date().toISOString(),
        deletedByName: (state.identity && (state.identity.name || state.identity.email)) || '' });
      await pushLog('chuyển biểu mẫu vào thùng rác', name);
    }catch(e){ console.error('[Khảo sát] Xoá lỗi:', e); alert('Không xoá được biểu mẫu: '+(e&&e.message||e)); return; }
    if(state.surveyEditingId===id){ state.surveyView='list'; state.surveyEditingId=null; state.surveyDraft=null; }
    showToast('Đã chuyển biểu mẫu vào Thùng rác.');
    render();
  }
  async function restoreSurvey(id){
    if(!surveyCanEdit()){ surveyNoEditAlert('khôi phục'); return; }
    const s = (state.surveyTrash||[]).find(x=> x.id===id); if(!s) return;
    try{
      await rtdb.ref(`surveys/${id}`).update({ deleted:false, deletedAt:null, deletedByName:null });
      await pushLog('khôi phục biểu mẫu', surveyFullName(s));
    }catch(e){ alert('Không khôi phục được: '+(e&&e.message||e)); return; }
    showToast(`Đã khôi phục "${surveyFullName(s)}".`);
  }
  async function purgeSurvey(id){
    if(!surveyCanEdit()){ surveyNoEditAlert('xoá'); return; }
    const s = (state.surveyTrash||[]).find(x=> x.id===id); if(!s) return;
    const n = s.responseCount||0;
    if(!confirm(`XOÁ VĨNH VIỄN "${surveyFullName(s)}"${n? ` cùng ${n} câu trả lời đã thu thập` : ''}?\n\nKhông khôi phục lại được.`)) return;
    try{
      await rtdb.ref(`survey_responses/${id}`).remove();
      try{ await rtdb.ref(`survey_respondents/${id}`).remove(); }catch(e){ console.warn('[Khảo sát] Không xoá được bộ đếm người trả lời:', e); }
      await rtdb.ref(`surveys/${id}`).remove();
      await pushLog('xoá vĩnh viễn biểu mẫu', surveyFullName(s));
    }catch(e){ console.error('[Khảo sát] Xoá vĩnh viễn lỗi:', e); alert('Không xoá được: '+(e&&e.message||e)); return; }
    showToast('Đã xoá vĩnh viễn.');
  }
  // Link chia sẻ dạng ĐƯỜNG DẪN (không có #): https://hoinongdan.sotay.org/khaosat/{mã}. Máy chủ chuyển
  // /khaosat/** qua Cloud Function surveyMeta để Zalo/Messenger đọc được tiêu đề + ảnh xem trước.
  // Bản xem trước của nhánh phụ (tên miền có "--") và máy chạy thử cục bộ KHÔNG có function đó (trên
  // bản xem trước, /khaosat/** còn chạy function của production) -> ở đó vẫn tạo link dạng # cũ.
  function surveyUsesHashLinks(){ const h = location.hostname||''; return h.includes('--') || h==='localhost' || h==='127.0.0.1' || location.protocol==='file:'; }
  function surveyLinkBase(){ return surveyUsesHashLinks()? `${location.origin}/#/khaosat/` : `${location.origin}/khaosat/`; }
  function surveyShareUrl(surveyId){
    return surveyLinkBase() + encodeURIComponent(surveyId);
  }
  // ---- Mã QR của link chia sẻ: xem to, tải ảnh PNG (có tên biểu mẫu + link), in áp phích A4. ----
  function surveyFileSlug(t){ return surveyFold(t).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'bieu-mau'; }
  function surveyQrWrapLines(ctx, text, maxW){
    const words = String(text).split(/\s+/), lines = []; let cur = '';
    words.forEach(w=>{ const t = cur? cur+' '+w : w; if(ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if(cur) lines.push(cur);
    return lines;
  }
  // Ảnh PNG ngang 1080 (cao tự co theo nội dung): dải màu + tên đầy đủ, mã QR lớn, lời mời quét mã, đường link.
  function surveyQrPosterCanvas(survey, qrCanvas, url){
    const W = 1080, font = '"Be Vietnam Pro", Arial, sans-serif', accent = surveyAccent(survey);
    const m = document.createElement('canvas').getContext('2d'); m.font = `800 50px ${font}`;
    const lines = surveyQrWrapLines(m, surveyFullName(survey), W-140).slice(0,4);
    m.font = `400 28px ${font}`;
    const urlLines = surveyQrWrapLines(m, url.replace(/^https?:\/\//,''), W-120).slice(0,2);
    const bandH = 90 + lines.length*64, qs = 760;
    const H = bandH + 50 + qs + 110 + urlLines.length*36 + 50;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0,0,W,H);
    x.font = `800 50px ${font}`;
    x.fillStyle = accent; x.fillRect(0,0,W,bandH);
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'top';
    lines.forEach((ln,i)=> x.fillText(ln, W/2, 45 + i*64));
    const qx = (W-qs)/2, qy = bandH + 50;
    x.imageSmoothingEnabled = false;
    x.drawImage(qrCanvas, qx, qy, qs, qs);
    x.fillStyle = '#1b1b1b'; x.font = `700 40px ${font}`;
    x.fillText(`Quét mã để ${surveyKindAct(survey)}`, W/2, qy + qs + 40);
    x.fillStyle = '#555555'; x.font = `400 28px ${font}`;
    urlLines.forEach((ln,i)=> x.fillText(ln, W/2, qy + qs + 110 + i*36));
    return c;
  }
  // =====================================================================
  // MÀN HÌNH CHIẾU MÃ QR DÙNG CHUNG — Phòng họp, Biểu mẫu, Tập huấn bằng AI. Toàn màn hình, mã QR thật to để
  // chiếu lên máy chiếu/TV hội trường; Esc hoặc nút "✕ Đóng" để thoát.
  // opts: { url, title, eyebrow?, meta?, sampleNote?, cta,
  //         closedMsg?  — có giá trị khi link đang đóng/hết hạn: HỎI LẠI trước khi chiếu (không in cảnh báo lên
  //                        màn chiếu vì cả hội trường cùng nhìn thấy),
  //         counter?    — { ref, count(snap)->số, label(số)->chữ }: con số chạy trực tiếp ở góc màn chiếu }
  // =====================================================================
  async function qrProjectorOpen(opts){
    if(opts.closedMsg && !confirm(`${opts.closedMsg} — người quét mã sẽ không vào được.\n\nVẫn chiếu mã QR lên màn hình?`)) return;
    const url = opts.url;
    const wrap = document.createElement('div');
    wrap.className = 'mt-projector';
    wrap.innerHTML = `<button class="mt-projector-close" aria-label="Đóng">✕ Đóng</button>
      <div class="mt-projector-inner">
        ${opts.eyebrow ? `<div class="mt-projector-eyebrow">${escapeHtml(opts.eyebrow)}</div>` : ''}
        <h1 class="${Array.from(opts.title||'').length>80 ? 'long' : ''}">${escapeHtml(opts.title||'')}</h1>
        ${opts.meta ? `<div class="mt-projector-meta">${escapeHtml(opts.meta)}</div>` : ''}
        ${opts.sampleNote ? `<div class="mt-projector-sample">${escapeHtml(opts.sampleNote)}</div>` : ''}
        <div class="mt-projector-qr" id="mtp-qr"><span>Đang tạo mã QR…</span></div>
        <div class="mt-projector-cta">${escapeHtml(opts.cta||'📱 Mở Zalo hoặc Camera, quét mã')}</div>
        <div class="mt-projector-url">${escapeHtml(url.replace(/^https?:\/\//,''))}</div>
      </div>
      ${opts.counter ? `<div class="mt-projector-count" id="mtp-count" hidden></div>` : ''}`;
    document.body.appendChild(wrap);
    let counterOff = null;
    const close = ()=>{
      try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(e){}
      if(counterOff) counterOff();
      wrap.remove(); document.removeEventListener('keydown', onKey);
    };
    const onKey = e=>{ if(e.key==='Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.querySelector('.mt-projector-close').onclick = close;
    try{ if(wrap.requestFullscreen) wrap.requestFullscreen().catch(()=>{}); }catch(e){}
    if(opts.counter && opts.counter.ref){
      const box = wrap.querySelector('#mtp-count'), ref = opts.counter.ref;
      const cb = snap=>{ const n = opts.counter.count(snap); box.hidden = false; box.textContent = opts.counter.label(n); };
      try{ ref.on('value', cb, err=> console.warn('[Chiếu mã QR] Không đếm được số người tham gia:', err)); counterOff = ()=>{ try{ ref.off('value', cb); }catch(e){} }; }catch(e){}
    }
    try{
      const qr = await mtQrCanvas(url);
      wrap.querySelector('#mtp-qr').innerHTML = `<img src="${qr.toDataURL('image/png')}" alt="Mã QR">`;
    }catch(e){ wrap.querySelector('#mtp-qr').innerHTML = `<span>⚠️ Không tạo được mã QR — kiểm tra kết nối mạng.</span>`; }
  }
  // Chiếu mã QR của MỘT biểu mẫu — câu kêu gọi theo đúng loại biểu mẫu ("quét mã để làm bài kiểm tra"...).
  function surveyProjector(s){
    if(!s || !s.id) return;
    const k = surveyKindInfo(s), st = surveyAcceptState(s);
    qrProjectorOpen({
      url: surveyShareUrl(s.id), title: String(s.title||'').trim() || surveyFullName(s),
      eyebrow: k ? `${k.icon} ${k.label}` : (s.isQuiz ? '📝 Bài kiểm tra' : '📝 Biểu mẫu khảo sát'),
      cta: `📱 Mở Zalo hoặc Camera, quét mã để ${surveyKindAct(s)}`,
      closedMsg: st.open ? null : `Biểu mẫu đang ở trạng thái “${surveyAcceptLabel(st).replace(/^\S+\s/,'')}”`,
      counter: isTourMode() ? null : { ref: rtdb.ref(`surveys/${s.id}/responseCount`), count: snap=> parseInt(snap && snap.val(),10)||0, label: n=> `📝 Đã có ${n} phiếu gửi về` },
    });
  }
  async function surveyQrModal(survey){
    if(!survey || !survey.id) return;
    const url = surveyShareUrl(survey.id), name = surveyFullName(survey);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<div class="modal" style="max-width:460px;">
      <div class="modal-head"><h3>📱 Mã QR — ${escapeHtml(name)}</h3><button class="modal-close preview-allow" id="svqr-close">✕</button></div>
      <div class="modal-body" style="text-align:center;">
        <div id="svqr-box" class="sv-qr-box"><div class="sub" style="padding:40px 0;">Đang tạo mã QR…</div></div>
        <p class="sub" style="margin:10px 0 4px;">Mọi người dùng Zalo hoặc Camera điện thoại quét mã này để mở biểu mẫu.</p>
        <div style="word-break:break-all; font-size:13px;"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a></div>
      </div>
      <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
        <button class="btn btn-primary btn-sm preview-allow" id="svqr-project">🖥️ Chiếu lên màn hình</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="svqr-png" disabled>⬇️ Tải ảnh PNG</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="svqr-print" disabled>🖨️ In áp phích A4</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="svqr-copy">📋 Sao chép link</button>
      </div></div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#svqr-close').onclick = close;
    wrap.addEventListener('click', e=>{ if(e.target===wrap) close(); });
    wrap.querySelector('#svqr-copy').onclick = ()=> copyMessageText(url);
    wrap.querySelector('#svqr-project').onclick = ()=>{ close(); surveyProjector(survey); };
    const box = wrap.querySelector('#svqr-box');
    try{ await loadOptionalLibrary('qrcode'); }
    catch(e){ box.innerHTML = `<div style="color:#b71c1c; padding:24px 0;">⚠️ Không tải được bộ tạo mã QR. Vui lòng kiểm tra kết nối mạng rồi thử lại.<div class="sub">${escapeHtml(String(e&&e.message||e))}</div></div>`; return; }
    const holder = document.createElement('div');
    new window.QRCode(holder, { text:url, width:1024, height:1024, colorDark:'#000000', colorLight:'#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    const qrCanvas = holder.querySelector('canvas');
    if(!qrCanvas){ box.innerHTML = '<div style="color:#b71c1c; padding:24px 0;">⚠️ Trình duyệt không vẽ được mã QR.</div>'; return; }
    const qrUrl = qrCanvas.toDataURL('image/png');
    box.innerHTML = `<img src="${qrUrl}" alt="Mã QR" class="sv-qr-img">`;
    const png = wrap.querySelector('#svqr-png'), pr = wrap.querySelector('#svqr-print');
    png.disabled = false; pr.disabled = false;
    png.onclick = ()=>{
      const c = surveyQrPosterCanvas(survey, qrCanvas, url);
      c.toBlob(b=>{ if(b) downloadBlob(`QR_${surveyFileSlug(name)}.png`, b, 'image/png'); }, 'image/png');
    };
    pr.onclick = ()=>{
      const area = document.getElementById('print-area'); if(!area) return;
      area.innerHTML = `<div class="sv-qr-poster" style="--ps-accent:${surveyAccent(survey)};">
        <div class="sv-qr-poster-title">${escapeHtml(name)}</div>
        ${survey.description? `<div class="sv-qr-poster-desc">${escapeHtml(String(survey.description).slice(0,300))}</div>` : ''}
        <img src="${qrUrl}" alt="Mã QR" class="sv-qr-poster-img">
        <div class="sv-qr-poster-cta">📱 Quét mã QR bằng Zalo hoặc Camera điện thoại để ${escapeHtml(surveyKindAct(survey))}</div>
        <div class="sv-qr-poster-url">${escapeHtml(url)}</div>
      </div>`;
      printAreaNow(false);
    };
  }
  async function loadSurveyResponses(surveyId){
    try{
      const snap = await rtdb.ref(`survey_responses/${surveyId}`).get();
      state.surveyResponses = (snap && snap.exists()) ? Object.values(snap.val()).sort((a,b)=> (a.submittedAt||'').localeCompare(b.submittedAt||'')) : [];
    }catch(e){ console.error('[Khảo sát] Không tải được câu trả lời:', e); state.surveyResponses = []; }
    state.surveyResponseViewIndex = 0;
  }
  // =====================================================================
  // GĐ7 — CHẤM ĐIỂM KIỂU GOOGLE BIỂU MẪU. Quy tắc theo từng loại câu:
  //  • Trắc nghiệm / Menu thả xuống / Thang điểm: đúng 1 đáp án -> đủ điểm, sai/bỏ trống -> 0.
  //  • Hộp kiểm: chọn ĐÚNG VÀ ĐỦ, không thừa -> đủ điểm; còn lại 0 (không có điểm từng phần).
  //  • Trả lời ngắn: khớp 1 đáp án được chấp nhận (không phân biệt hoa thường, bỏ khoảng trắng thừa)
  //    -> đủ điểm; không khớp: nếu bật "mọi câu khác là sai" -> 0, nếu không -> CHỜ CHẤM TAY.
  //  • Lưới: đáp án theo từng hàng, điểm chia đều cho các hàng đúng.
  //  • Đoạn văn / Ngày / Giờ / Tải tệp, hoặc câu chưa đặt đáp án: CHẤM TAY.
  // Điểm chấm tay (r.grading[qid].points) luôn đè lên điểm máy chấm. Câu có 0 điểm thì không tính.
  // =====================================================================
  function surveyNormText(t){ return String(t==null? '' : t).trim().replace(/\s+/g,' ').toLowerCase(); }
  function surveyIsManualType(q){ return ['paragraph','date','time','file'].includes(q.type); }
  function surveyQPoints(q){ const p = parseFloat(q.points); return isNaN(p)? 0 : Math.max(0, p); }
  function surveyFmtNum(n){ return String(Math.round((+n||0)*100)/100).replace('.',','); }
  function surveyHasKey(q){
    if(surveyIsManualType(q)) return false;
    if(surveyIsGrid(q)) return Array.isArray(q.gridAnswers) && q.gridAnswers.some(x=> Array.isArray(x)? x.length : !!x);
    if(q.type==='short') return (q.correctAnswers||[]).some(a=> String(a).trim());
    return (q.correctAnswers||[]).length>0;
  }
  function surveyAutoGrade(q, v){
    const max = surveyQPoints(q);
    if(max<=0) return { max:0, points:0, status:'none' };
    const answered = surveyHasAnswer(q, v);
    if(surveyIsManualType(q) || !surveyHasKey(q)) return answered? { max, points:0, status:'pending' } : { max, points:0, status:'wrong' };
    if(!answered) return { max, points:0, status:'wrong' };
    if(q.type==='checkbox'){
      const key = q.correctAnswers||[], g = Array.isArray(v)? v : [];
      const ok = key.length===g.length && key.every(k=> g.includes(k));
      return { max, points: ok? max : 0, status: ok? 'correct' : 'wrong' };
    }
    if(q.type==='short'){
      const g = surveyNormText(v);
      if((q.correctAnswers||[]).some(a=> String(a).trim() && surveyNormText(a)===g)) return { max, points:max, status:'correct' };
      return q.markOthersWrong? { max, points:0, status:'wrong' } : { max, points:0, status:'pending' };
    }
    if(surveyIsGrid(q)){
      const rows = q.rows||[]; let ok = 0;
      rows.forEach((_,i)=>{
        const key = (q.gridAnswers||[])[i], g = surveyGridCell(v, i);
        if(q.type==='grid_checkbox'){ const k = Array.isArray(key)? key : [], gg = Array.isArray(g)? g : []; if(k.length && k.length===gg.length && k.every(x=> gg.includes(x))) ok++; }
        else if(key && g===key) ok++;
      });
      return { max, points: Math.round(max*ok/(rows.length||1)*100)/100, status: ok===rows.length? 'correct' : ok? 'partial' : 'wrong' };
    }
    const ok = (q.correctAnswers||[]).map(String).includes(String(v));
    return { max, points: ok? max : 0, status: ok? 'correct' : 'wrong' };
  }
  // Điểm cả bài = máy chấm + điểm chấm tay đè lên. pending = số câu còn chờ chấm tay.
  function surveyGradeResponse(survey, r){
    let score = 0, max = 0, pending = 0; const per = {};
    (survey.questions||[]).forEach(q=>{
      const a = surveyAutoGrade(q, r.answers && r.answers[q.id]);
      const man = r.grading && r.grading[q.id];
      const g = Object.assign({}, a, { manual:false, feedback: (man && man.feedback) || '' });
      if(man && man.points!=null && man.points!=='' && a.max>0){
        const pt = Math.max(0, Math.min(a.max, parseFloat(man.points)||0));
        Object.assign(g, { points:pt, manual:true, status: pt>=a.max? 'correct' : pt>0? 'partial' : 'wrong' });
      }
      if(g.status==='pending') pending++;
      if(g.status!=='none'){ score += g.points; max += g.max; }
      per[q.id] = g;
    });
    return { score: Math.round(score*100)/100, max: Math.round(max*100)/100, pending, per };
  }
  function computeSurveyScore(survey, answers){ const g = surveyGradeResponse(survey, { answers }); return { score:g.score, maxScore:g.max, pending:g.pending }; }
  // Mô tả đáp án đúng của 1 câu (để hiện cho người làm bài / người chấm).
  function surveyKeyText(q){
    if(surveyIsManualType(q)) return '';
    if(surveyIsGrid(q)) return (q.rows||[]).map((rw,i)=>{ const k = (q.gridAnswers||[])[i]; const t = Array.isArray(k)? k.join(', ') : (k||''); return t? `${rw}: ${t}` : ''; }).filter(Boolean).join('; ');
    if(q.type==='short') return (q.correctAnswers||[]).filter(a=> String(a).trim()).join(' / ');
    return (q.correctAnswers||[]).join(', ');
  }
  const SURVEY_GRADE_ICON = { correct:'✅', wrong:'❌', partial:'◐', pending:'⏳', none:'' };
  const SURVEY_GRADE_LABEL = { correct:'Đúng', wrong:'Sai', partial:'Đúng một phần', pending:'Chờ chấm tay', none:'' };
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
    if(meta && meta.name) entry.respondentName = meta.name;
    // Mã bí mật để người làm bài mở lại link "xem lại bài làm và điểm".
    entry.resultToken = Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10);
    if(survey.isQuiz){
      const { score, maxScore } = computeSurveyScore(survey, answers);
      entry.score = score; entry.maxScore = maxScore; entry.needsGrading = computeSurveyScore(survey, answers).pending>0;
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
    introIfBothSpacesEmpty({ flag:'_svIntroChecked', node:'surveys', perm:'survey', tab:'survey', intro:'survey' });
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
    if(F.type!=='all'){ const k = SURVEY_FORM_KINDS.find(x=> 'k:'+x.k===F.type); out.push(k? 'Loại: '+k.label : F.type==='k:'? 'Loại: Chưa chọn' : F.type==='quiz'? 'Chỉ biểu mẫu có chấm điểm' : 'Chỉ biểu mẫu không chấm điểm'); }
    return out;
  }
  function surveyApplyListFilter(list, F){
    const term = surveyFold(F.q.trim());
    const typeOk = s=> F.type==='all' || (F.type.startsWith('k:')? (s.formKind||'')===F.type.slice(2) : (F.type==='quiz')===!!s.isQuiz);
    let out = list.filter(s=> (!term || surveyFold(surveyFullName(s)).includes(term)) && typeOk(s));
    const by = {
      created_desc:(a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''),
      created_asc:(a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''),
      updated_desc:(a,b)=> (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''),
      name_asc:(a,b)=> surveyFullName(a).localeCompare(surveyFullName(b), 'vi', {sensitivity:'base'}),
      name_desc:(a,b)=> surveyFullName(b).localeCompare(surveyFullName(a), 'vi', {sensitivity:'base'}),
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
          <div style="margin-bottom:14px;">${surveyTabsHtml([
            { id:'sv-space-shared', label:`🏛️ Biểu mẫu dùng chung ${adminLevelLabelLower()}`, active:isShared },
            { id:'sv-space-personal', label:'🔒 Biểu mẫu cá nhân', active:!isShared },
          ])}${spaceNoteHtml(isShared ? 'shared' : 'personal', 'biểu mẫu')}</div>
          ${!canView? `<div class="empty-state" style="padding:30px;"><div class="e-ico">🔒</div>${isShared? 'Đồng chí không có quyền xem Biểu mẫu dùng chung của mã xã này. Vui lòng liên hệ Chủ mã để được cấp quyền tại "Cài đặt & Chia sẻ".' : 'Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.'}</div>` : `
          ${canEdit? `<div style="display:flex; flex-wrap:wrap; gap:8px;"><button class="btn btn-primary" id="sv-new-btn">➕ Tạo biểu mẫu mới</button><button class="btn preview-allow" id="sv-ai-new-btn" style="background:linear-gradient(180deg,#fff 0%,#7c4dff 45%,#4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700;">✨ Tạo nhanh biểu mẫu bằng AI</button></div>` : `<p class="sub">Đồng chí chỉ có quyền xem ở ${isShared?'Biểu mẫu dùng chung này':'đây'}.</p>`}
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-top:14px;">
            <input id="sv-f-q" value="${escapeHtml(F.q)}" placeholder="🔍 Tìm theo tên biểu mẫu (không cần gõ dấu)…" autocomplete="off" style="flex:1 1 240px; min-width:0; ${F.q.trim()? red : ''}">
            <select id="sv-f-type" title="Lọc theo loại" style="${F.type!=='all'? red : ''}">
              <option value="all" ${F.type==='all'?'selected':''}>Tất cả loại</option>
              <optgroup label="Theo cách gọi tên">
                ${SURVEY_FORM_KINDS.map(k=>`<option value="k:${k.k}" ${F.type==='k:'+k.k?'selected':''}>${k.icon} ${escapeHtml(k.label)}</option>`).join('')}
                <option value="k:" ${F.type==='k:'?'selected':''}>📋 Chưa chọn cách gọi</option>
              </optgroup>
              <optgroup label="Theo chấm điểm">
                <option value="quiz" ${F.type==='quiz'?'selected':''}>✅ Có chấm điểm (đặt làm bài kiểm tra)</option>
                <option value="survey" ${F.type==='survey'?'selected':''}>📝 Không chấm điểm</option>
              </optgroup>
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
                    <td><b>${surveyHighlight(surveyFullName(s), F.q)}</b>${s.isQuiz? ' <span class="pill pill-gray">Có chấm điểm</span>' : ''}<div class="sub" style="margin-top:2px;">${surveyAcceptLabel(surveyAcceptState(s))}${s.closeAt? ' · hạn '+escapeHtml(surveyFmtDateTime(s.closeAt)) : ''}</div></td>
                    <td>${s.createdAt? fmtDate(s.createdAt.slice(0,10)) : '—'}</td>
                    <td>${s.responseCount||0}</td>
                    <td style="white-space:nowrap; display:flex; gap:6px;">
                      <button class="btn btn-ghost btn-sm" data-sv-open="${s.id}">${canEdit? 'Sửa / Xem kết quả' : 'Xem kết quả'}</button>
                      <button class="btn btn-ghost btn-sm" data-sv-copy="${s.id}">🔗 Copy link</button>
                      <button class="btn btn-ghost btn-sm preview-allow" data-sv-qr="${s.id}" title="Mã QR để in dán hoặc gửi ảnh cho mọi người quét">📱 Mã QR</button>
                      <button class="btn btn-ghost btn-sm preview-allow" data-sv-project="${s.id}" title="Chiếu mã QR thật to lên máy chiếu/TV hội trường">🖥️ Chiếu</button>
                      ${canEdit? `<button class="btn btn-ghost btn-sm preview-allow" data-sv-dup="${s.id}" title="Tạo 1 biểu mẫu mới giống hệt (không chép câu trả lời)">📑 Nhân bản</button>` : ''}
                      ${canEdit? `<button class="btn btn-ghost btn-sm" data-sv-delete="${s.id}" style="color:var(--red);">Xoá</button>` : ''}
                    </td>
                  </tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="e-ico">📝</div>${all.length? 'Không có biểu mẫu nào khớp bộ lọc.' : `Chưa có biểu mẫu nào${canEdit? ' — bấm "Tạo biểu mẫu mới" để bắt đầu' : ''}`}</div></td></tr>`}
              </tbody>
            </table>
          </div>`}
        </div>
      </div>
      ${canView? surveyTrashPanelHtml() : ''}`;
    surveyWireTrashPanel(el);
    document.querySelectorAll('[data-sv-qr]').forEach(btn=> btn.onclick = ()=>{ const s = state.surveys.find(x=> x.id===btn.dataset.svQr); if(s) surveyQrModal(s); });
    document.querySelectorAll('[data-sv-project]').forEach(btn=> btn.onclick = ()=>{ const s = state.surveys.find(x=> x.id===btn.dataset.svProject); if(s) surveyProjector(s); });
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
    const aiNewBtn = document.getElementById('sv-ai-new-btn'); if(aiNewBtn) aiNewBtn.onclick = ()=> renderSurveyQuickAddByAiModal({ mode:'new', el });
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
        state.surveyRespView = 'summary';
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

  // Dải tab liền nhau (kiểu tab ở Kho biên lai): luôn MỘT hàng ngang, màn hình hẹp thì trải hết chiều
  // ngang và chia đều, chữ dài xuống dòng NGAY TRONG nút chứ không đẩy nút xuống hàng dưới.
  function surveyTabsHtml(items, extraCls){
    return `<div class="sv-tabs ${extraCls||''}" role="tablist">${items.map(it=>`<button type="button" role="tab" aria-selected="${it.active?'true':'false'}" class="sv-tab preview-allow ${it.active?'active':''}" ${it.id? `id="${it.id}"` : ''} ${it.attrs||''} ${it.disabled?'disabled':''}>${escapeHtml(it.label)}</button>`).join('')}</div>`;
  }
  // Bản giới thiệu tự hiện khi CHƯA CÓ GÌ ở cả hai bộ nhớ (Biểu mẫu: surveys/, Phòng họp: meetings/) — mỗi lần
  // VÀO module một lần (cờ đặt lại trong switchTab), đóng được. Không tính mục trong Thùng rác. Lỗi đọc (mạng,
  // quyền) thì coi như không rõ -> không hiện. Tập huấn bằng AI có cơ chế riêng (tnProbeEntry, kèm tab mẫu).
  async function introIfBothSpacesEmpty(o){
    if(state[o.flag]) return;
    state[o.flag] = true;
    // Môi trường tham quan không đọc Firebase: module có dữ liệu mẫu (Phòng họp) thì báo qua o.tourHasItems.
    let total = isTourMode() && o.tourHasItems ? 1 : 0, unknown = false;
    if(!isTourMode()){
      const count = async (ref, wantPersonal)=>{
        try{ const snap = await ref.once('value'); return Object.values((snap && snap.val()) || {}).filter(x=> x && x.id && !x.deleted && ((x.scope==='personal')===wantPersonal)).length; }
        catch(e){ console.warn('[Bản giới thiệu] Không đếm được:', e); unknown = true; return 0; }
      };
      const email = state.identity && state.identity.email, jobs = [];
      if(wardId() && canViewModule(o.perm)) jobs.push(count(rtdb.ref(o.node).orderByChild('wardId').equalTo(wardId()), false).then(n=> total += n));
      if(email) jobs.push(count(rtdb.ref(o.node).orderByChild('ownerEmail').equalTo(email), true).then(n=> total += n));
      await Promise.all(jobs);
    }
    if(unknown || total) return;
    if(state.view!=='app' || state.activeTab!==o.tab) return;
    if(MODULE_INTRO_CONTENT && MODULE_INTRO_CONTENT[o.intro] && !document.querySelector('.modal-bg')) openModuleIntroModal(MODULE_INTRO_CONTENT[o.intro]);
  }
  // Dòng chữ ĐỎ ngay dưới dải tab chọn bộ nhớ (Biểu mẫu, Phòng họp, Tập huấn bằng AI): nói rõ đồng chí đang
  // làm việc ở bộ nhớ nào để khỏi soạn nhầm chỗ. space: 'shared' | 'personal' | 'sample'.
  // noun: tên đồ vật của module ('biểu mẫu', 'cuộc họp', 'bài tập huấn'). Danh xưng xã/phường lấy động.
  function spaceNoteHtml(space, noun){
    let t;
    if(space==='sample'){
      t = `📍 Đồng chí đang xem <b>Các ${noun} mẫu</b> do phần mềm soạn sẵn — chỉ để tham khảo, không sửa được. Muốn soạn ${noun} thật, chọn Bộ nhớ dùng chung hoặc Bộ nhớ cá nhân ở trên.`;
    } else if(space==='personal'){
      const email = state.identity && state.identity.email;
      t = email ? `📍 Đồng chí đang ở <b>Bộ nhớ cá nhân</b> (tài khoản Google riêng: ${escapeHtml(email)}) — chỉ riêng đồng chí thấy các ${noun} ở đây.`
                : `📍 Đồng chí đang ở <b>Bộ nhớ cá nhân</b> — cần đăng nhập bằng tài khoản Google để dùng.`;
    } else {
      const name = ((state.config && state.config.wardName) || '').trim();
      t = `📍 Đồng chí đang ở <b>Bộ nhớ dùng chung của ${escapeHtml(adminLevelLabelLower() + (name ? ' ' + name : ''))}</b> — các ${noun} ở đây dùng chung cho những người được Chủ mã cấp quyền.`;
    }
    return `<div class="space-note">${t}</div>`;
  }
  // Thùng rác riêng của Biểu mẫu (theo không gian đang xem: dùng chung / cá nhân) — cùng kiểu với
  // Thùng rác Hội viên: nút "⋮ Thao tác" mở menu nổi Khôi phục / Xoá vĩnh viễn.
  function surveyTrashPanelHtml(){
    const trash = state.surveyTrash || [];
    return `<div class="panel">
        <div class="panel-head" style="cursor:pointer;" id="sv-trash-toggle"><h3>🗑️ Thùng rác (Biểu mẫu) ${trash.length? `<span class="sub">(${trash.length})</span>` : ''} ${state._svShowTrash?'▴':'▾'}</h3></div>
        ${state._svShowTrash? `<div class="panel-body ${panelBodyAnimClass()}">${trash.length? `<p class="sub" style="margin-top:0;">Biểu mẫu trong Thùng rác vẫn giữ nguyên câu trả lời đã thu thập nhưng link chia sẻ ngừng nhận phiếu.</p><div class="table-wrap"><table>
          <thead><tr><th></th><th style="text-align:left;">Tên biểu mẫu</th><th style="text-align:center;">Số người đã trả lời</th><th style="text-align:center;">Xoá bởi</th><th style="text-align:center;">Thời điểm xoá</th></tr></thead>
          <tbody>${trash.map(s=>`<tr>
            <td><button type="button" class="btn btn-ghost btn-sm preview-allow sv-trash-menu-btn" data-floating-menu-trigger data-id="${s.id}">⋮ Thao tác</button></td>
            <td style="text-align:left;">${escapeHtml(surveyFullName(s))}</td>
            <td style="text-align:center;">${s.responseCount||0}</td>
            <td style="text-align:center;">${escapeHtml(s.deletedByName||'')}</td>
            <td class="sub" style="text-align:center;">${s.deletedAt? new Date(s.deletedAt).toLocaleString('vi-VN') : ''}</td>
          </tr>`).join('')}</tbody></table></div>` : `<div class="empty-state"><div class="e-ico">🗑️</div>Thùng rác trống.</div>`}</div>` : ''}
      </div>`;
  }
  function surveyWireTrashPanel(el){
    const t = document.getElementById('sv-trash-toggle');
    if(t) t.onclick = ()=>{ state._svShowTrash = !state._svShowTrash; markPanelJustToggled(); renderSurveyListView(el); };
    document.querySelectorAll('.sv-trash-menu-btn').forEach(btn=> btn.onclick = (e)=>{
      e.stopPropagation();
      if(!surveyCanEdit()){ surveyNoEditAlert('thao tác trên'); return; }
      const id = btn.dataset.id;
      openFloatingActionMenu(btn, [
        { label:'↩ Khôi phục', onClick: ()=> restoreSurvey(id) },
        { label:'Xoá vĩnh viễn', danger:true, onClick: ()=> purgeSurvey(id) },
      ]);
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

            ` : ''}
            ${surveyNewTypeEditorHtml(q, canEdit)}
            ${isQuiz? surveyKeyBarHtml(q, canEdit) : ''}
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---- Thanh "✅ Đáp án (N điểm)" ở góc dưới thẻ câu hỏi + khung đặt đáp án (kiểu Google) ----
  const surveyKeyOpen = {};
  function surveyKeyBarHtml(q, canEdit){
    const pts = surveyQPoints(q), dis = canEdit? '' : 'disabled';
    const summary = surveyIsManualType(q)? '✍️ Loại câu này chấm tay trong phần Câu trả lời'
      : surveyHasKey(q)? `Đáp án: <b>${escapeHtml(surveyKeyText(q).slice(0,120))}</b>`
      : '<span style="color:#e65100;">⚠️ Chưa đặt đáp án — câu này sẽ phải chấm tay</span>';
    let html = `<div class="sv-key-bar"><button type="button" class="btn btn-sm sv-key-btn preview-allow" data-key-toggle="${q.id}">✅ Đáp án (${surveyFmtNum(pts)} điểm)</button><span class="sub">${summary}</span></div>`;
    if(!surveyKeyOpen[q.id]) return html;
    const opt = (type, name, val, on, label, cls)=> `<label class="sv-filter-item sv-opt sv-opt-full sv-opt-correct"><input type="${type}" ${name? `name="${name}"` : ''} class="${cls}" data-qid="${q.id}" value="${escapeHtml(val)}" ${on?'checked':''} ${dis}><span>${escapeHtml(label)}</span></label>`;
    let keyHtml = '';
    if(q.type==='radio' || q.type==='dropdown') keyHtml = `<p class="sv-key-h">Chọn <b>1</b> đáp án đúng:</p>${(q.options||[]).map(o=> opt('radio', 'qk-'+q.id, o, (q.correctAnswers||[]).includes(o), o, 'qk-single')).join('')}`;
    else if(q.type==='scale') keyHtml = `<p class="sv-key-h">Chọn mức đúng:</p><div style="display:flex; flex-wrap:wrap; gap:6px;">${surveyScaleValues(q).map(v=> opt('radio', 'qk-'+q.id, v, (q.correctAnswers||[]).map(String).includes(v), v, 'qk-single').replace('sv-opt-full','sv-opt-fit')).join('')}</div>`;
    else if(q.type==='checkbox') keyHtml = `<p class="sv-key-h">Tick <b>tất cả</b> đáp án đúng (người làm bài phải chọn đúng và đủ, không thừa mới được điểm):</p>${(q.options||[]).map(o=> opt('checkbox', '', o, (q.correctAnswers||[]).includes(o), o, 'qk-multi')).join('')}`;
    else if(q.type==='short'){
      const list = (q.correctAnswers||[]).length? q.correctAnswers : [''];
      keyHtml = `<p class="sv-key-h">Các câu trả lời được chấp nhận là đúng (không phân biệt chữ hoa/thường, bỏ khoảng trắng thừa):</p>
        ${list.map((a,i)=>`<div style="display:flex; gap:6px; margin-bottom:6px;"><input class="qk-ans" data-qid="${q.id}" data-i="${i}" value="${escapeHtml(a)}" placeholder="Đáp án ${i+1}" style="flex:1; min-width:0;" ${dis}>${canEdit? `<button type="button" class="btn btn-ghost btn-sm qk-ans-del preview-allow" data-qid="${q.id}" data-i="${i}">✕</button>` : ''}</div>`).join('')}
        ${canEdit? `<button type="button" class="btn btn-ghost btn-sm qk-ans-add preview-allow" data-qid="${q.id}">➕ Thêm đáp án được chấp nhận</button>` : ''}
        <div style="margin-top:6px;"><label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="qk-others" data-qid="${q.id}" ${q.markOthersWrong?'checked':''} ${dis}><span>Đánh dấu mọi câu trả lời khác là <b>sai</b> (không bật thì câu trả lời không khớp sẽ chờ chấm tay)</span></label></div>`;
    }
    else if(surveyIsGrid(q)){
      const isChk = q.type==='grid_checkbox';
      keyHtml = `<p class="sv-key-h">Đáp án đúng ở <b>từng hàng</b>${isChk? ' (tick tất cả ô đúng của mỗi hàng)' : ''} — điểm chia đều cho các hàng làm đúng:</p>
        <div class="ps-grid-wrap"><table class="ps-grid"><thead><tr><th></th>${(q.cols||[]).map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${(q.rows||[]).map((rw,i)=>`<tr><th>${escapeHtml(rw)}</th>${(q.cols||[]).map(c=>{ const k = (q.gridAnswers||[])[i]; const on = isChk? (Array.isArray(k) && k.includes(c)) : k===c; return `<td><label class="ps-grid-cell"><input type="${isChk?'checkbox':'radio'}" ${isChk? '' : `name="qkg-${q.id}-${i}"`} class="qk-grid" data-qid="${q.id}" data-row="${i}" value="${escapeHtml(c)}" ${on?'checked':''} ${dis}></label></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    else keyHtml = `<p class="sv-key-h">✍️ Loại câu này không chấm tự động được — người tạo chấm tay từng bài trong phần <b>Câu trả lời</b> (có thể chấm 1 lần cho nhiều bài giống nhau).</p>`;
    const fb = surveyIsManualType(q)
      ? `<div class="field full"><label>💬 Phản hồi chung (hiện cho người làm bài sau khi chấm, không bắt buộc)</label><textarea class="qk-fb" data-qid="${q.id}" data-f="feedbackGeneral" rows="2" ${dis}>${escapeHtml(q.feedbackGeneral||'')}</textarea></div>`
      : `<div class="field"><label>💬 Phản hồi khi trả lời ĐÚNG (không bắt buộc)</label><textarea class="qk-fb" data-qid="${q.id}" data-f="feedbackCorrect" rows="2" placeholder="VD: Chính xác!" ${dis}>${escapeHtml(q.feedbackCorrect||'')}</textarea></div>
         <div class="field"><label>💬 Phản hồi khi trả lời SAI (có thể dán link tài liệu ôn tập)</label><textarea class="qk-fb" data-qid="${q.id}" data-f="feedbackWrong" rows="2" placeholder="VD: Xem lại Điều 5 Điều lệ Hội: https://…" ${dis}>${escapeHtml(q.feedbackWrong||'')}</textarea></div>`;
    return html + `<div class="sv-key-box">
        <div class="field" style="max-width:170px;"><label>Số điểm câu này</label><input type="number" min="0" step="0.5" class="qk-points" data-qid="${q.id}" value="${surveyQPoints(q)}" ${dis}></div>
        ${keyHtml}
        <div class="form-grid" style="margin-top:8px;">${fb}</div>
        <div style="text-align:right;"><button type="button" class="btn btn-primary btn-sm preview-allow" data-key-toggle="${q.id}">✔ Xong</button></div>
      </div>`;
  }
  function surveyQuizSettingsHtml(d, canEdit){
    const dis = canEdit? '' : 'disabled';
    return `<div class="sv-quiz-set">
      <p style="margin:0 0 6px; font-weight:800;">⚙️ Cài đặt bài kiểm tra</p>
      <p style="margin:0 0 4px; font-weight:700;">Công bố điểm</p>
      <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="sv-qz-release" value="immediate" ${d.quizRelease!=='manual'?'checked':''} ${dis}><span><b>Ngay sau khi nộp bài</b> — người làm bài thấy điểm ngay (câu còn chờ chấm tay sẽ ghi rõ "điểm có thể thay đổi").</span></label>
      <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="sv-qz-release" value="manual" ${d.quizRelease==='manual'?'checked':''} ${dis}><span><b>Sau khi tôi xem xét và chấm tay</b> — người làm bài nhận link xem lại bài; chỉ thấy điểm khi đồng chí bấm "📢 Công bố điểm".</span></label>
      <p style="margin:8px 0 4px; font-weight:700;">Người làm bài được xem</p>
      <label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="sv-qz" data-f="quizShowMissed" ${d.quizShowMissed!==false?'checked':''} ${dis}><span>Câu trả lời bị sai</span></label>
      <label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="sv-qz" data-f="quizShowCorrect" ${d.quizShowCorrect!==false?'checked':''} ${dis}><span>Đáp án đúng</span></label>
      <label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="sv-qz" data-f="quizShowPoints" ${d.quizShowPoints!==false?'checked':''} ${dis}><span>Điểm của từng câu</span></label>
      <div class="field" style="max-width:240px; margin-top:6px;"><label>Điểm mặc định cho câu hỏi mới</label><input type="number" min="0" step="0.5" id="sv-qz-defpts" value="${parseFloat(d.quizDefaultPoints)>=0? parseFloat(d.quizDefaultPoints) : 1}" ${dis}></div>
      <p class="sub" style="margin:4px 0 0;">Muốn biết bài nào của ai: bật "Thu thập họ tên người trả lời" ở tab ⚙️ Cài đặt nhận phiếu. Đặt đáp án và điểm ở nút <b>✅ Đáp án</b> dưới mỗi câu hỏi.</p>
    </div>`;
  }
  function surveyNewTypeEditorHtml(q, canEdit){
    const dis = canEdit? '' : 'disabled';
    if(q.type==='scale'){
      const lo = parseInt(q.scaleMin,10)||0, hi = parseInt(q.scaleMax,10)||5;
      return `<div class="form-grid" style="margin-top:4px;">
          <div class="field"><label>Mức thấp nhất</label><select class="q-scale" data-qid="${q.id}" data-f="scaleMin" ${dis}>${[0,1].map(v=>`<option value="${v}" ${lo===v?'selected':''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>Mức cao nhất</label><select class="q-scale" data-qid="${q.id}" data-f="scaleMax" ${dis}>${[2,3,4,5,6,7,8,9,10].map(v=>`<option value="${v}" ${hi===v?'selected':''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>Nhãn ở mức ${lo} (không bắt buộc)</label><input class="q-scale-lbl" data-qid="${q.id}" data-f="scaleMinLabel" value="${escapeHtml(q.scaleMinLabel||'')}" placeholder="VD: Rất không hài lòng" ${dis}></div>
          <div class="field"><label>Nhãn ở mức ${hi} (không bắt buộc)</label><input class="q-scale-lbl" data-qid="${q.id}" data-f="scaleMaxLabel" value="${escapeHtml(q.scaleMaxLabel||'')}" placeholder="VD: Rất hài lòng" ${dis}></div>
        </div>
        <div class="sub" style="margin:2px 0 8px;">Người trả lời sẽ thấy: ${escapeHtml(q.scaleMinLabel||'')} ${surveyScaleValues(q).map(v=>`<span class="sv-scale-pv">${v}</span>`).join('')} ${escapeHtml(q.scaleMaxLabel||'')}</div>`;
    }
    if(surveyIsGrid(q)){
      const list = (kind, title, ph)=> `<div><p style="margin:0 0 6px; font-weight:700;">${title}</p>
        ${(q[kind]||[]).map((v,i)=>`<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;"><span class="sub" style="min-width:20px;">${i+1}.</span><input class="q-grid-item" data-qid="${q.id}" data-kind="${kind}" data-i="${i}" value="${escapeHtml(v)}" placeholder="${ph} ${i+1}" style="flex:1; min-width:0;" ${dis}>${canEdit? `<button type="button" class="btn btn-ghost btn-sm q-grid-del preview-allow" data-qid="${q.id}" data-kind="${kind}" data-i="${i}" title="Xoá">✕</button>` : ''}</div>`).join('')}
        ${canEdit? `<button type="button" class="btn btn-ghost btn-sm q-grid-add preview-allow" data-qid="${q.id}" data-kind="${kind}">➕ Thêm ${kind==='rows'? 'hàng' : 'cột'}</button>` : ''}</div>`;
      return `<div class="sv-grid-edit">${list('rows','Hàng — các ý cần đánh giá','Hàng')}${list('cols','Cột — các mức lựa chọn','Cột')}</div>
        <p class="sub" style="margin:4px 0 8px;">Bật "Bắt buộc trả lời" thì người trả lời phải chọn ở <b>mọi hàng</b>.</p>`;
    }
    if(q.type==='file'){
      return `<div class="form-grid" style="margin-top:4px;">
          <div class="field"><label>Số tệp tối đa</label><select class="q-file" data-qid="${q.id}" data-f="maxFiles" ${dis}>${[1,2,3,5,10].map(v=>`<option value="${v}" ${(+q.maxFiles||1)===v?'selected':''}>${v} tệp</option>`).join('')}</select></div>
          <div class="field"><label>Dung lượng tối đa mỗi tệp</label><select class="q-file" data-qid="${q.id}" data-f="maxSizeMb" ${dis}>${[1,5,10,20].map(v=>`<option value="${v}" ${(+q.maxSizeMb||10)===v?'selected':''}>${v} MB</option>`).join('')}</select></div>
          <div class="field"><label>Loại tệp cho phép</label><select class="q-file" data-qid="${q.id}" data-f="fileKind" ${dis}>${Object.entries(SURVEY_FILE_KINDS).map(([k,v])=>`<option value="${k}" ${(q.fileKind||'any')===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
        </div>
        ${q.fileKind==='image'? `<label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="q-file-camera" data-qid="${q.id}" ${q.cameraOnly?'checked':''} ${dis}><span>📷 Chỉ cho chụp trực tiếp bằng camera (điện thoại mở thẳng camera, không chọn ảnh có sẵn) — hợp với ảnh thực địa</span></label>` : ''}
        <p class="sub" style="margin:2px 0 8px;">⚠️ Tệp được lưu trên Firebase Storage (thư mục survey_uploads). Nếu luật Storage chưa cho phép người ngoài tải tệp lên thư mục này, người trả lời sẽ thấy báo lỗi khi tải tệp.</p>`;
    }
    return '';
  }
  function renderSurveyQuestionsEditorHtml(draft, canEdit){
    ensureSurveySections(draft);
    return `
      <div class="form-grid">
        <div class="field full"><label>Tiêu đề biểu mẫu *</label><input id="sv-title" value="${escapeHtml(draft.title)}" ${canEdit?'':'disabled'}></div>
        <div class="field full"><label>Mô tả biểu mẫu</label><textarea id="sv-desc" rows="2" ${canEdit?'':'disabled'}>${escapeHtml(draft.description)}</textarea></div>
      </div>
      <div class="field" style="margin:10px 0 0; max-width:460px;"><label>Biểu mẫu này được gọi là gì?</label>
        <select id="sv-formkind" ${canEdit?'':'disabled'}><option value="">Chưa chọn</option>${SURVEY_FORM_KINDS.map(k=>`<option value="${k.k}" ${draft.formKind===k.k?'selected':''}>${k.icon} ${escapeHtml(k.opt)}</option>`).join('')}</select></div>
      <p class="sub" style="margin:4px 0 0;">Tên đầy đủ hiển thị cho mọi người: <b id="sv-fullname">${escapeHtml(surveyFullName(draft))}</b></p>
      <div style="margin:10px 0;"><label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" id="sv-isquiz" ${draft.isQuiz?'checked':''} ${canEdit?'':'disabled'}><span>📋 Đặt làm bài kiểm tra (cho phép chấm điểm đáp án đúng)</span></label></div>
      ${draft.isQuiz? surveyQuizSettingsHtml(draft, canEdit) : ''}
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
        <button class="btn btn-sm preview-allow" id="sv-ai-append-btn" style="background:linear-gradient(180deg,#fff 0%,#7c4dff 45%,#4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700;">✨ Soạn thêm câu hỏi bằng AI</button>
        <button class="btn btn-primary btn-sm sv-save-action" id="sv-save-btn-bottom" style="margin-left:auto;">💾 Lưu biểu mẫu</button>
      </div>` : ''}`;
  }

  // =====================================================================
  // GĐ5 — TAB "CÂU TRẢ LỜI": 3 chế độ xem (📊 Tổng hợp có biểu đồ · 📋 Bảng · 👤 Từng phiếu), bộ lọc
  // DÙNG CHUNG cho cả 3 (tìm chữ, khoảng ngày nộp, theo phương án của 1 câu), xoá từng phiếu, tuỳ chỉnh
  // cột (ẩn/hiện + kéo đổi thứ tự, nhớ theo trình duyệt), xuất Excel / in đúng theo bộ lọc và cột.
  // Biểu đồ: thanh ngang (mỗi phương án 1 thanh + số + %) — dễ so sánh hơn biểu đồ tròn; câu chọn 1 có
  // ≤ 6 phương án có thêm 1 thanh phân đoạn thể hiện tỉ lệ cả câu. Bảng màu phân loại đã kiểm định,
  // thứ tự cố định theo thứ tự phương án (màu đi theo phương án, không theo thứ hạng).
  // =====================================================================
  const SURVEY_CHART_COLORS = ['#257de0','#f47230','#00b894','#f2a600','#ee7fac','#008a17'];
  const SURVEY_QTYPE_COLW = { short:200, paragraph:280, radio:180, dropdown:180, checkbox:230, scale:90, grid_radio:280, grid_checkbox:300, date:120, time:90, file:220 };
  function surveyRespFilter(){
    const id = state.surveyEditingId;
    if(!state.surveyRespFilter || state.surveyRespFilter.forId!==id) state.surveyRespFilter = { forId:id, q:'', from:'', to:'', qid:'', opt:'' };
    return state.surveyRespFilter;
  }
  function surveyAnswerText(v, q){
    if(v==null) return '';
    if(surveyIsGrid(q)) return (q.rows||[]).map((row,i)=>{ const c = surveyGridCell(v,i); const t = Array.isArray(c)? c.join(', ') : (c||''); return t? `${row}: ${t}` : ''; }).filter(Boolean).join('; ');
    if(q && q.type==='file') return surveyFileList(v).map(f=> f.name).join(', ');
    if(q && q.type==='date' && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) return fmtDate(String(v));
    return Array.isArray(v)? v.join(', ') : String(v);
  }
  function surveyLocalDay(iso){ const d = new Date(iso); if(isNaN(d)) return ''; const p = n=> String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
  function surveyWhoText(r){
    const lan = r.attempt? ` · Lần ${r.attempt}` : '';
    if(r.respondentName) return r.respondentName + (r.respondentEmail? ` (${r.respondentEmail})` : '') + lan;
    if(r.respondentEmail) return r.respondentEmail + lan;
    if(r.respondentKey && String(r.respondentKey).startsWith('b_')) return `Trình duyệt ${String(r.respondentKey).slice(2,8)}` + lan;
    return '';
  }
  function surveyRespFilterLabels(draft, F){
    const out = [];
    if(F.q.trim()) out.push(`Có chứa "${F.q.trim()}"`);
    if(F.from || F.to) out.push(`Nộp ${F.from? 'từ '+fmtDate(F.from) : ''}${F.from && F.to? ' ' : ''}${F.to? 'đến '+fmtDate(F.to) : ''}`);
    if(F.qid && F.opt){ const q = draft.questions.find(x=>x.id===F.qid); if(q) out.push(`Câu "${(q.text||'').slice(0,40)}" chọn "${F.opt}"`); }
    return out;
  }
  function surveyFilterResponses(draft, responses, F){
    const term = surveyFold(F.q.trim());
    return responses.filter(r=>{
      const day = surveyLocalDay(r.submittedAt);
      if(F.from && day < F.from) return false;
      if(F.to && day > F.to) return false;
      if(F.qid && F.opt){ const v = r.answers && r.answers[F.qid]; const arr = Array.isArray(v)? v : (v? [v] : []); if(!arr.includes(F.opt)) return false; }
      if(term){ const hay = surveyFold([surveyWhoText(r), ...draft.questions.map(q=> surveyAnswerText(r.answers && r.answers[q.id], q))].join(' ')); if(!hay.includes(term)) return false; }
      return true;
    });
  }
  // ---- Cột bảng câu trả lời (dùng chung cho bảng, xuất Excel, in) ----
  function surveyRespAllCols(draft, responses){
    const cols = [
      { key:'stt', label:'STT', w:50, align:'center', fixed:true, get:(r,i)=> String(i+1) },
      { key:'time', label:'Thời gian nộp', w:140, align:'center', get:r=> new Date(r.submittedAt).toLocaleString('vi-VN') },
    ];
    if(responses.some(r=> r.respondentKey || r.respondentEmail || r.respondentName)) cols.push({ key:'who', label:'Người nộp', w:190, align:'left', get:r=> surveyWhoText(r) });
    draft.questions.forEach((q,qi)=>{
      const col = { key:'q:'+q.id, label:`${qi+1}. ${q.text||''}`, w:SURVEY_QTYPE_COLW[q.type]||200, align:'left', get:r=> surveyAnswerText(r.answers && r.answers[q.id], q) };
      if(q.type==='file'){
        col.html = r=> surveyFilesHtml(surveyFileList(r.answers && r.answers[q.id]), 'sm');
        // Excel: tên tệp kèm đường link (mỗi tệp 1 dòng); phiếu chỉ có 1 tệp thì ô bấm mở thẳng tệp.
        col.excel = r=> surveyFileList(r.answers && r.answers[q.id]).map(f=> `${f.name} — ${f.url}`).join('\n');
        col.link = r=>{ const fs = surveyFileList(r.answers && r.answers[q.id]); return fs.length===1? fs[0].url : null; };
      }
      cols.push(col);
    });
    if(draft.isQuiz) cols.push({ key:'score', label:'Điểm', w:130, align:'center', get:r=>{ const g = surveyGradeResponse(draft, r); return (g.pending? `⏳ Cần chấm ${g.pending} câu · ` : '') + `${surveyFmtNum(g.score)}/${surveyFmtNum(g.max)}` + (draft.quizRelease==='manual'? (r.released? ' · 📢 Đã công bố' : ' · Chưa công bố') : ''); } });
    return cols;
  }
  function surveyColPrefs(sid){ try{ return JSON.parse(localStorage.getItem('hnd_sv_cols_'+sid)) || {}; }catch(e){ return {}; } }
  function surveySaveColPrefs(sid, p){ try{ localStorage.setItem('hnd_sv_cols_'+sid, JSON.stringify(p)); }catch(e){} }
  function surveyOrderedCols(all, P){
    const keys = all.map(c=>c.key), ord = (P.order||[]).filter(k=> keys.includes(k));
    keys.forEach(k=>{ if(!ord.includes(k)) ord.push(k); });
    return ord.map(k=> all.find(c=>c.key===k));
  }
  function surveyRespCols(draft, responses){
    const P = surveyColPrefs(state.surveyEditingId), hidden = new Set(P.hidden||[]);
    return surveyOrderedCols(surveyRespAllCols(draft, responses), P).filter(c=> c.fixed || !hidden.has(c.key));
  }
  function surveyCellStyle(c){ return `text-align:${c.align}; vertical-align:top; white-space:normal; word-break:break-word; overflow-wrap:anywhere; width:${c.w}px; min-width:${c.w}px; max-width:${c.w}px;`; }

  // ---- 📊 Tổng hợp ----
  function surveyQuestionStatsHtml(q, qi, list){
    const answered = list.filter(r=> surveyHasAnswer(q, r.answers && r.answers[q.id]));
    let body;
    const meterRows = (pairs, base)=> pairs.map(([o,c])=>{ const pct = Math.round(c/(base||1)*100);
      return `<div class="sv-meter-row" title="${escapeHtml(o)}: ${c} (${pct}%)"><div class="sv-meter-name"><span>${escapeHtml(o)}</span></div><div class="sv-meter-track"><div class="sv-meter-fill" style="width:${pct}%;"></div></div><div class="sv-meter-val"><b>${c}</b> <span class="sub">(${pct}%)</span></div></div>`; }).join('');
    if(q.type==='scale'){
      const vals = surveyScaleValues(q), counts = new Map(vals.map(v=>[v,0])); let sum = 0;
      answered.forEach(r=>{ const v = String(r.answers[q.id]); counts.set(v, (counts.get(v)||0)+1); sum += parseFloat(v)||0; });
      const avg = answered.length? (sum/answered.length) : 0;
      body = `<p style="margin:0 0 10px;">Điểm trung bình: <b style="font-size:18px;">${answered.length? avg.toFixed(2).replace('.',',') : '—'}</b> / ${escapeHtml(String(q.scaleMax))}${q.scaleMinLabel||q.scaleMaxLabel? ` <span class="sub">(${escapeHtml(q.scaleMin+' = '+(q.scaleMinLabel||''))} · ${escapeHtml(q.scaleMax+' = '+(q.scaleMaxLabel||''))})</span>` : ''}</p><div class="sv-meters">${meterRows(Array.from(counts.entries()).map(([v,c])=>[`Mức ${v}`, c]), answered.length)}</div>`;
    } else if(surveyIsGrid(q)){
      const rows = q.rows||[], cols = q.cols||[];
      const cnt = rows.map((_,i)=> cols.map(c=> answered.filter(r=>{ const x = surveyGridCell(r.answers[q.id], i); return Array.isArray(x)? x.includes(c) : x===c; }).length));
      const mx = Math.max(1, ...cnt.flat());
      body = `<div class="table-wrap"><table class="sv-matrix"><thead><tr><th></th>${cols.map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((rw,i)=>`<tr><th>${escapeHtml(rw)}</th>${cols.map((c,j)=>{ const n = cnt[i][j]; return `<td title="${escapeHtml(rw)} · ${escapeHtml(c)}: ${n}" style="background:rgba(37,125,224,${(n/mx*0.55).toFixed(3)});"><b>${n}</b>${answered.length? ` <span class="sub">(${Math.round(n/answered.length*100)}%)</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="sub" style="margin:6px 0 0;">Ô càng đậm màu thì càng nhiều người chọn.</p>`;
    } else if(q.type==='date' || q.type==='time'){
      const counts = new Map(); answered.forEach(r=>{ const v = String(r.answers[q.id]); counts.set(v, (counts.get(v)||0)+1); });
      const pairs = Array.from(counts.entries()).sort((a,b)=> a[0].localeCompare(b[0])).map(([v,c])=> [q.type==='date'? fmtDate(v) : v, c]);
      body = `<div class="sv-meters${pairs.length>15? ' scroll' : ''}">${meterRows(pairs, answered.length)}</div>`;
    } else if(q.type==='file'){
      const files = answered.flatMap(r=> surveyFileList(r.answers[q.id]));
      body = files.length? `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:8px;"><span class="sub">${files.length} tệp (${files.filter(surveyIsImageFile).length} ảnh)</span><button type="button" class="btn btn-ghost btn-sm preview-allow" data-zip-q="${q.id}">⬇️ Tải tất cả ${files.length} tệp (.zip)</button></div><div style="max-height:420px; overflow:auto;">${surveyFilesHtml(files)}</div>` : '<p class="sub" style="margin:0;">Chưa có tệp nào.</p>';
    } else if(surveyQTypeHasOptions(q.type)){
      const opts = q.options||[];
      const counts = new Map(opts.map(o=>[o,0]));
      answered.forEach(r=>{ const v = r.answers[q.id]; (Array.isArray(v)? v : [v]).forEach(a=> counts.set(a, (counts.get(a)||0)+1)); });
      const base = answered.length || 1;
      const rows = Array.from(counts.entries());
      const segOn = q.type!=='checkbox' && opts.length<=SURVEY_CHART_COLORS.length && answered.length>0;
      const colorOf = o=> SURVEY_CHART_COLORS[opts.indexOf(o)] || '#9e9e9e';
      const seg = segOn? `<div class="sv-segbar" role="img" aria-label="Tỉ lệ các phương án">${rows.filter(([,c])=>c>0).map(([o,c])=>{ const pct = c/base*100; return `<div class="sv-seg" style="width:${pct}%; background:${colorOf(o)};" title="${escapeHtml(o)}: ${c} (${Math.round(pct)}%)">${pct>=12? Math.round(pct)+'%' : ''}</div>`; }).join('')}</div>` : '';
      const meters = rows.map(([o,c])=>{ const pct = Math.round(c/base*100);
        return `<div class="sv-meter-row" title="${escapeHtml(o)}: ${c} người (${pct}%)"><div class="sv-meter-name">${segOn? `<span class="sv-swatch" style="background:${colorOf(o)};"></span>` : ''}<span>${escapeHtml(o)}</span></div><div class="sv-meter-track"><div class="sv-meter-fill" style="width:${pct}%;"></div></div><div class="sv-meter-val"><b>${c}</b> <span class="sub">(${pct}%)</span></div></div>`; }).join('');
      body = `${seg}<div class="sv-meters${rows.length>15? ' scroll' : ''}">${meters}</div>${q.type==='checkbox'? '<p class="sub" style="margin:6px 0 0;">Mỗi người chọn được nhiều phương án nên tổng các % có thể vượt 100%.</p>' : ''}`;
    } else {
      const texts = answered.map(r=> surveyAnswerText(r.answers[q.id], q));
      body = texts.length? `<div style="display:flex; flex-direction:column; gap:6px; max-height:260px; overflow:auto;">${texts.map(t=>`<div class="kv-row" style="border:1px solid var(--line); border-radius:6px; padding:6px 10px; white-space:pre-wrap;">${escapeHtml(t)}</div>`).join('')}</div>` : '<p class="sub" style="margin:0;">Chưa có câu trả lời.</p>';
    }
    return `<div class="panel" style="margin-bottom:10px;"><div class="panel-head"><h3 style="font-size:14px;">${qi+1}. ${escapeHtml(q.text)}</h3><span class="sub">${answered.length}/${list.length} người trả lời</span></div><div class="panel-body">${body}</div></div>`;
  }
  // ---- 📋 Bảng ----
  function surveyRespTableHtml(cols, list, canDel){
    return `<div class="table-wrap"><table>
      <thead><tr><th></th>${cols.map(c=>`<th style="text-align:${c.align==='left'?'left':'center'}; min-width:${c.w}px; white-space:normal;">${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${list.map((r,i)=>`<tr><td style="white-space:nowrap; vertical-align:top;"><button type="button" class="btn btn-ghost btn-sm preview-allow" data-resp-open="${i}" title="Xem phiếu này">👁️</button>${canDel? `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-resp-del="${escapeHtml(r.id)}" title="Xoá phiếu này" style="color:var(--red);">🗑️</button>` : ''}</td>${cols.map(c=>`<td style="${surveyCellStyle(c)}">${c.html? c.html(r,i) : escapeHtml(c.get(r,i))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }
  // ---- 👤 Từng phiếu ----
  function surveyRespDetailHtml(draft, list, canDel){
    const idx = Math.min(Math.max(0, state.surveyResponseViewIndex||0), list.length-1);
    state.surveyResponseViewIndex = idx;
    const r = list[idx], who = surveyWhoText(r);
    const G = draft.isQuiz? surveyGradeResponse(draft, r) : null;
    const answerHtml = (q, v)=> q.type==='file'? (surveyFileList(v).length? surveyFilesHtml(surveyFileList(v)) : '<b>(không trả lời)</b>') : `<b style="white-space:pre-wrap;">${escapeHtml(surveyAnswerText(v, q)||'(không trả lời)')}</b>`;
    return `
      <div class="toolbar" style="justify-content:center; flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" id="sv-resp-prev" ${idx<=0?'disabled':''}>◀ Trước</button>
        <b>Phiếu số ${idx+1} / ${list.length}</b>
        <button class="btn btn-ghost btn-sm" id="sv-resp-next" ${idx>=list.length-1?'disabled':''}>Sau ▶</button>
        ${canDel? `<button class="btn btn-ghost btn-sm preview-allow" data-resp-del="${escapeHtml(r.id)}" style="color:var(--red);">🗑️ Xoá phiếu này</button>` : ''}
      </div>
      <p class="sub" style="text-align:center;">Nộp lúc: ${new Date(r.submittedAt).toLocaleString('vi-VN')}${who? ` — ${escapeHtml(who)}` : ''}</p>
      ${G? `<div class="sv-set-status ${G.pending? 'shut' : 'open'}" style="text-align:center;">Điểm: <b style="font-size:18px;">${surveyFmtNum(G.score)} / ${surveyFmtNum(G.max)}</b>${G.pending? ` · ⏳ Còn <b>${G.pending}</b> câu chờ chấm tay` : ' · Đã chấm xong'}${draft.quizRelease==='manual'? (r.released? ` · 📢 Đã công bố${r.releasedAt? ' lúc '+escapeHtml(new Date(r.releasedAt).toLocaleString('vi-VN')) : ''}` : ' · Chưa công bố điểm') : ' · Người làm bài thấy điểm ngay khi nộp'}</div>` : ''}
      <div class="panel"><div class="panel-body">
        ${draft.questions.map((q,qi)=>{ const v = r.answers? r.answers[q.id] : null;
          if(!G) return `<div class="kv-row"><span>${qi+1}. ${escapeHtml(q.text)}</span><div style="text-align:right;">${answerHtml(q, v)}</div></div>`;
          const g = G.per[q.id], man = (r.grading||{})[q.id]||{};
          const key = surveyKeyText(q);
          return `<div class="sv-gq-row">
            <div><div style="font-weight:700;">${qi+1}. ${escapeHtml(q.text)} ${g.status!=='none'? `<span class="sv-grade-chip ${g.status}">${SURVEY_GRADE_ICON[g.status]} ${SURVEY_GRADE_LABEL[g.status]}${g.manual? ' (chấm tay)' : ''}</span>` : '<span class="sub">(không tính điểm)</span>'}</div>
              <div style="margin:4px 0;">${answerHtml(q, v)}</div>
              ${key? `<div class="sub">Đáp án: ${escapeHtml(key)}</div>` : ''}</div>
            ${g.status!=='none' && canDel? `<div style="min-width:180px;">
              <label class="sub">Điểm (tối đa ${surveyFmtNum(g.max)})</label>
              <input type="number" min="0" max="${g.max}" step="0.25" class="svg-pts" data-qid="${q.id}" value="${man.points!=null && man.points!==''? man.points : ''}" placeholder="${g.status==='pending'? 'Chưa chấm' : surveyFmtNum(g.points)+' (máy chấm)'}" style="width:100%;">
              <textarea class="svg-fb" data-qid="${q.id}" rows="2" placeholder="Nhận xét riêng cho bài này (không bắt buộc)" style="width:100%; margin-top:4px;">${escapeHtml(man.feedback||'')}</textarea>
            </div>` : (g.status!=='none'? `<div><b>${surveyFmtNum(g.points)}/${surveyFmtNum(g.max)}</b></div>` : '')}
          </div>`; }).join('')}
      </div></div>
      ${G && canDel? `<div class="toolbar" style="justify-content:flex-end; flex-wrap:wrap; gap:8px;">
        <span class="sub">Để trống ô điểm = dùng điểm máy chấm.</span>
        <button class="btn btn-primary btn-sm preview-allow" id="svg-save" data-rid="${escapeHtml(r.id)}">💾 Lưu điểm bài này</button>
        ${draft.quizRelease==='manual'? (r.released? `<button class="btn btn-ghost btn-sm preview-allow" id="svg-unrelease" data-rid="${escapeHtml(r.id)}">↩️ Thu hồi công bố</button>` : `<button class="btn btn-sm preview-allow" id="svg-release" data-rid="${escapeHtml(r.id)}" style="background:#2e7d32; color:#fff; border-color:#1b5e20;">📢 Lưu & công bố điểm bài này</button>`) : ''}
      </div>` : ''}`;
  }
  // ---- Thống kê bài kiểm tra (đầu phần Tổng hợp) ----
  function surveyPickAttempts(draft, list){
    const mode = state.surveyAttemptMode || 'best';
    const groups = new Map(), singles = [];
    list.forEach(r=>{ const k = r.respondentKey || (r.respondentName? 'n_'+surveyNormText(r.respondentName) : null); if(!k) singles.push(r); else { if(!groups.has(k)) groups.set(k, []); groups.get(k).push(r); } });
    const pick = arr=>{
      if(mode==='latest') return arr.slice().sort((a,b)=> (b.submittedAt||'').localeCompare(a.submittedAt||''))[0];
      if(mode==='first') return arr.slice().sort((a,b)=> (a.submittedAt||'').localeCompare(b.submittedAt||''))[0];
      return arr.slice().sort((a,b)=> surveyGradeResponse(draft,b).score - surveyGradeResponse(draft,a).score)[0];
    };
    return { chosen: singles.concat(Array.from(groups.values()).map(pick)), multi: Array.from(groups.values()).some(a=> a.length>1) };
  }
  function surveyQuizStatsHtml(draft, list){
    const { chosen, multi } = surveyPickAttempts(draft, list);
    const grades = chosen.map(r=> surveyGradeResponse(draft, r));
    const scores = grades.map(g=> g.score).sort((a,b)=> a-b);
    const max = grades.length? grades[0].max : draft.questions.reduce((a,q)=> a+surveyQPoints(q), 0);
    const avg = scores.length? scores.reduce((a,b)=> a+b, 0)/scores.length : 0;
    const med = scores.length? (scores.length%2? scores[(scores.length-1)/2] : (scores[scores.length/2-1]+scores[scores.length/2])/2) : 0;
    const pending = grades.filter(g=> g.pending).length, released = chosen.filter(r=> r.released).length;
    // Câu hay bị làm sai nhất: tỉ lệ đúng thấp nhất (chỉ tính câu có điểm, đã chấm)
    const qStats = draft.questions.map((q,qi)=>{ let done = 0, right = 0; grades.forEach(g=>{ const x = g.per[q.id]; if(!x || x.status==='none' || x.status==='pending') return; done++; if(x.status==='correct') right++; }); return { q, qi, done, rate: done? right/done : null }; })
      .filter(x=> x.done).sort((a,b)=> a.rate-b.rate).slice(0,5);
    const tile = (l,v,extra)=> `<div class="sv-quiz-stat"><span class="sub">${l}</span><b>${v}</b>${extra||''}</div>`;
    return `<div class="panel" style="margin-bottom:10px; border:2px solid #2e7d32;"><div class="panel-head" style="background:#e8f5e9;"><h3 style="font-size:14px;">📋 Thống kê điểm bài kiểm tra</h3>
        ${multi? `<select id="sv-attempt-mode" title="Người làm nhiều lần thì tính lần nào"><option value="best" ${(state.surveyAttemptMode||'best')==='best'?'selected':''}>Tính lần có điểm cao nhất</option><option value="latest" ${state.surveyAttemptMode==='latest'?'selected':''}>Tính lần gần nhất</option><option value="first" ${state.surveyAttemptMode==='first'?'selected':''}>Tính lần đầu tiên</option></select>` : ''}</div>
      <div class="panel-body">
        <div class="sv-quiz-stats">
          ${tile('Số bài tính điểm', chosen.length)}
          ${tile('Điểm trung bình', scores.length? `${surveyFmtNum(avg)}/${surveyFmtNum(max)}` : '—')}
          ${tile('Trung vị', scores.length? surveyFmtNum(med) : '—')}
          ${tile('Thấp nhất – Cao nhất', scores.length? `${surveyFmtNum(scores[0])} – ${surveyFmtNum(scores[scores.length-1])}` : '—')}
          ${tile('Bài còn chờ chấm tay', pending, pending? '<span class="sub">vào ✍️ Chấm theo câu để chấm</span>' : '')}
          ${draft.quizRelease==='manual'? tile('Đã công bố điểm', `${released}/${chosen.length}`) : ''}
        </div>
        ${qStats.length? `<p style="margin:4px 0 6px; font-weight:700;">Câu hay bị làm sai nhất</p><div class="sv-meters">${qStats.map(x=>{ const pct = Math.round(x.rate*100); return `<div class="sv-meter-row" title="${pct}% làm đúng"><div class="sv-meter-name"><span>${x.qi+1}. ${escapeHtml((x.q.text||'').slice(0,70))}</span></div><div class="sv-meter-track"><div class="sv-meter-fill" style="width:${pct}%;"></div></div><div class="sv-meter-val"><b>${pct}%</b> <span class="sub">làm đúng</span></div></div>`; }).join('')}</div>` : ''}
      </div></div>`;
  }
  // ---- ✍️ Chấm theo câu: gom các bài có câu trả lời giống hệt nhau để chấm 1 lần ----
  function surveyGradeByQuestionHtml(draft, list, canEdit){
    const qs = draft.questions.filter(q=> surveyQPoints(q)>0);
    if(!qs.length) return `<div class="empty-state" style="padding:30px;">Chưa có câu nào được đặt điểm. Đặt điểm ở nút ✅ Đáp án dưới mỗi câu hỏi.</div>`;
    const pendingOf = q=> list.filter(r=> surveyGradeResponse(draft, r).per[q.id].status==='pending').length;
    let qid = state.surveyGradeQid;
    if(!qs.some(q=> q.id===qid)) qid = (qs.find(q=> pendingOf(q)) || qs[0]).id;
    state.surveyGradeQid = qid;
    const q = qs.find(x=> x.id===qid), max = surveyQPoints(q);
    const groups = new Map();
    list.forEach(r=>{
      const v = r.answers && r.answers[q.id];
      const key = q.type==='file'? 'r:'+r.id : surveyNormText(surveyAnswerText(v, q));
      if(!groups.has(key)) groups.set(key, { v, rs:[] }); groups.get(key).rs.push(r);
    });
    const rows = Array.from(groups.entries()).map(([key,gp])=>{
      const gs = gp.rs.map(r=> surveyGradeResponse(draft, r).per[q.id]);
      const pend = gs.filter(g=> g.status==='pending').length;
      const pts = new Set(gs.map(g=> g.status==='pending'? 'x' : g.points));
      return { key, gp, pend, cur: pts.size===1 && !pts.has('x')? [...pts][0] : '', status: gs[0].status };
    }).sort((a,b)=> b.pend-a.pend || b.gp.rs.length-a.gp.rs.length);
    return `
      <div class="toolbar" style="flex-wrap:wrap; gap:8px;">
        <select id="svgq-q" style="max-width:100%;">${qs.map(x=>{ const n = pendingOf(x); return `<option value="${x.id}" ${x.id===qid?'selected':''}>${draft.questions.indexOf(x)+1}. ${escapeHtml((x.text||'').slice(0,60))} — ${surveyFmtNum(surveyQPoints(x))} điểm${n? ` · ⏳ ${n} bài chờ chấm` : ''}</option>`; }).join('')}</select>
      </div>
      <p class="sub" style="margin:6px 0 10px;">Mỗi dòng là 1 câu trả lời (các bài trả lời giống hệt nhau được gom chung). Nhập điểm rồi bấm "Áp dụng" để chấm cho tất cả các bài trong dòng đó. Tối đa ${surveyFmtNum(max)} điểm. ${surveyKeyText(q)? 'Đáp án: <b>'+escapeHtml(surveyKeyText(q))+'</b>' : ''}</p>
      ${rows.map((x,i)=>`<div class="sv-gq-row">
        <div>${q.type==='file'? surveyFilesHtml(surveyFileList(x.gp.v)) : `<b style="white-space:pre-wrap;">${escapeHtml(surveyAnswerText(x.gp.v, q)||'(không trả lời)')}</b>`}
          <div class="sub" style="margin-top:4px;">${x.gp.rs.length} bài${x.pend? ` · <span class="sv-grade-chip pending">⏳ ${x.pend} chờ chấm</span>` : ` · <span class="sv-grade-chip ${x.status}">${SURVEY_GRADE_ICON[x.status]} ${SURVEY_GRADE_LABEL[x.status]}</span>`}${x.gp.rs.length<=3? ' · '+x.gp.rs.map(r=> escapeHtml(surveyWhoText(r)||new Date(r.submittedAt).toLocaleString('vi-VN'))).join('; ') : ''}</div></div>
        ${canEdit? `<div style="min-width:190px;"><div style="display:flex; gap:6px;"><input type="number" min="0" max="${max}" step="0.25" class="svgq-pts" data-g="${i}" value="${x.cur!==''? x.cur : ''}" placeholder="Điểm" style="flex:1; min-width:0;"><button type="button" class="btn btn-ghost btn-sm preview-allow" data-gq-full="${i}" title="Cho điểm tối đa">Tối đa</button></div>
          <textarea class="svgq-fb" data-g="${i}" rows="1" placeholder="Nhận xét (không bắt buộc)" style="width:100%; margin-top:4px;"></textarea>
          <button type="button" class="btn btn-primary btn-sm preview-allow" data-gq-apply="${i}" style="margin-top:4px; width:100%;">✔ Áp dụng cho ${x.gp.rs.length} bài</button></div>` : ''}
      </div>`).join('')}`;
  }
  // Ghi điểm chấm tay của 1 bài lên máy chủ (kèm điểm tổng mới để xem nhanh).
  async function surveySaveGrading(draft, r, patch){
    r.grading = Object.assign({}, r.grading||{}, patch.grading||{});
    Object.keys(r.grading).forEach(k=>{ const g = r.grading[k]; if(g && (g.points==null || g.points==='') && !g.feedback) delete r.grading[k]; });
    const G = surveyGradeResponse(draft, r);
    const upd = { grading: r.grading, score: G.score, maxScore: G.max, needsGrading: G.pending>0 };
    if(patch.released!=null){ upd.released = patch.released; upd.releasedAt = patch.released? new Date().toISOString() : null; r.released = patch.released; r.releasedAt = upd.releasedAt; }
    Object.assign(r, { score:G.score, maxScore:G.max, needsGrading:G.pending>0 });
    await rtdb.ref(`survey_responses/${state.surveyEditingId}/${r.id}`).update(upd);
  }
  function renderSurveyAnswersTabHtml(draft){
    surveyLbGroups = {};
    const all = state.surveyResponses||[], F = surveyRespFilter(), list = surveyFilterResponses(draft, all, F);
    const view = state.surveyRespView || 'summary', canDel = surveyCanEdit();
    const labels = surveyRespFilterLabels(draft, F), red = 'border:2px solid #d32f2f;';
    const optQs = draft.questions.filter(q=> surveyQTypeHasOptions(q.type));
    const fq = optQs.find(q=> q.id===F.qid);
    let content;
    if(!all.length) content = `<div class="empty-state" style="padding:30px;"><div class="e-ico">📊</div>Chưa có ai trả lời biểu mẫu này.</div>`;
    else if(!list.length) content = `<div class="empty-state" style="padding:30px;"><div class="e-ico">🔍</div>Không có phiếu nào khớp bộ lọc.</div>`;
    else if(view==='table') content = surveyRespTableHtml(surveyRespCols(draft, all), list, canDel);
    else if(view==='detail') content = surveyRespDetailHtml(draft, list, canDel);
    else if(view==='grade' && draft.isQuiz) content = surveyGradeByQuestionHtml(draft, list, canDel);
    else content = (draft.isQuiz? surveyQuizStatsHtml(draft, list) : '') + draft.questions.map((q,qi)=> surveyQuestionStatsHtml(q, qi, list)).join('');
    return `
      <div style="margin-bottom:10px;">${surveyTabsHtml([['summary','📊 Tổng hợp'],['table','📋 Bảng'],['detail','👤 Từng phiếu']].concat(draft.isQuiz? [['grade','✍️ Chấm theo câu']] : []).map(([k,l])=>({ label:l, active: view===k, attrs:`data-resp-viewmode="${k}"` })), 'sv-tabs-sm')}</div>
      <div class="toolbar" style="flex-wrap:wrap; gap:8px;">
        <b>Tổng số phiếu: ${all.length}</b>
        <div class="spacer"></div>
        ${view==='table' && all.length? `<button class="btn btn-ghost btn-sm preview-allow" id="sv-resp-cols">🧩 Tuỳ chỉnh cột</button>` : ''}
        <button class="btn btn-ghost btn-sm preview-allow" id="sv-export-excel-btn" ${list.length?'':'disabled'}>⬇️ Xuất Excel</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="sv-print-btn" ${list.length?'':'disabled'}>🖨️ In</button>
        <button class="btn btn-ghost btn-sm preview-allow" id="sv-resp-reload" title="Tải lại phiếu mới nhất">↻ Tải lại</button>
        <button class="btn btn-sm preview-allow" id="sv-ai-summary" ${list.length?'':'disabled'} style="background:linear-gradient(180deg,#fff 0%,#7c4dff 45%,#4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700;">🧠 AI tóm tắt kết quả</button>
        ${draft.isQuiz && draft.quizRelease==='manual' && canDel? (()=>{ const n = all.filter(r=> !r.released && !surveyGradeResponse(draft, r).pending).length; return `<button class="btn btn-sm preview-allow" id="sv-release-all" ${n?'':'disabled'} style="background:#2e7d32; color:#fff; border-color:#1b5e20;">📢 Công bố điểm các bài đã chấm xong (${n})</button>`; })() : ''}
      </div>
      ${all.length? `
        <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-top:8px;">
          <input id="svr-q" value="${escapeHtml(F.q)}" placeholder="🔍 Tìm trong câu trả lời (không cần gõ dấu)…" autocomplete="off" style="flex:1 1 220px; min-width:0; ${F.q.trim()? red : ''}">
          <label class="sub" style="display:flex; align-items:center; gap:4px;">Từ <input type="date" id="svr-from" value="${F.from}" style="${F.from? red : ''}"></label>
          <label class="sub" style="display:flex; align-items:center; gap:4px;">Đến <input type="date" id="svr-to" value="${F.to}" style="${F.to? red : ''}"></label>
          ${optQs.length? `<select id="svr-qid" style="max-width:240px; ${F.qid && F.opt? red : ''}"><option value="">Lọc theo phương án của câu…</option>${optQs.map(q=>`<option value="${q.id}" ${F.qid===q.id?'selected':''}>${escapeHtml(`${draft.questions.indexOf(q)+1}. ${(q.text||'').slice(0,50)}`)}</option>`).join('')}</select>` : ''}
          ${fq? `<select id="svr-opt" style="max-width:220px; ${F.opt? red : ''}"><option value="">— chọn phương án —</option>${(fq.options||[]).map(o=>`<option value="${escapeHtml(o)}" ${F.opt===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select>` : ''}
          ${labels.length? `<button class="btn btn-ghost btn-sm preview-allow reset-filter-active" id="svr-reset">↺ Bỏ lọc</button>` : ''}
        </div>
        ${labels.length? `<p style="color:#b71c1c; font-weight:800; margin:8px 0 0;">Đang áp dụng lọc kết quả: ${labels.map(escapeHtml).join(', ')}</p>` : ''}
        <p class="sub" style="margin:6px 0 10px;">Đang hiện ${list.length}/${all.length} phiếu${labels.length? ' (thống kê, bảng, xuất Excel và in đều tính theo bộ lọc này)' : ''}.</p>` : ''}
      ${content}`;
  }
  function wireSurveyAnswers(el, draft){
    const F = surveyRespFilter(), rer = ()=> renderSurveyTab(el), g = id=> document.getElementById(id);
    const list = ()=> surveyFilterResponses(draft, state.surveyResponses||[], F);
    el.querySelectorAll('[data-resp-viewmode]').forEach(b=> b.onclick = ()=>{ state.surveyRespView = b.dataset.respViewmode; rer(); });
    if(g('svr-q')) g('svr-q').oninput = ()=>{ const inp = g('svr-q'), caret = inp.selectionStart; F.q = inp.value; state.surveyResponseViewIndex = 0; rer(); const a = g('svr-q'); if(a){ a.focus(); try{ a.setSelectionRange(caret, caret); }catch(e){} } };
    if(g('svr-from')) g('svr-from').onchange = ()=>{ F.from = g('svr-from').value; state.surveyResponseViewIndex = 0; rer(); };
    if(g('svr-to')) g('svr-to').onchange = ()=>{ F.to = g('svr-to').value; state.surveyResponseViewIndex = 0; rer(); };
    if(g('svr-qid')) g('svr-qid').onchange = ()=>{ F.qid = g('svr-qid').value; F.opt = ''; rer(); };
    if(g('svr-opt')) g('svr-opt').onchange = ()=>{ F.opt = g('svr-opt').value; state.surveyResponseViewIndex = 0; rer(); };
    if(g('svr-reset')) g('svr-reset').onclick = ()=>{ Object.assign(F, { q:'', from:'', to:'', qid:'', opt:'' }); rer(); };
    if(g('sv-resp-reload')) g('sv-resp-reload').onclick = async ()=>{ await loadSurveyResponses(state.surveyEditingId); showToast('Đã tải lại phiếu trả lời mới nhất.'); rer(); };
    if(g('sv-resp-prev')) g('sv-resp-prev').onclick = ()=>{ state.surveyResponseViewIndex--; rer(); };
    if(g('sv-resp-next')) g('sv-resp-next').onclick = ()=>{ state.surveyResponseViewIndex++; rer(); };
    if(g('sv-ai-summary')) g('sv-ai-summary').onclick = ()=> surveyAiSummaryModal(draft, list(), surveyRespFilterLabels(draft, F).join(', '));
    if(g('sv-attempt-mode')) g('sv-attempt-mode').onchange = ()=>{ state.surveyAttemptMode = g('sv-attempt-mode').value; rer(); };
    const findR = id=> (state.surveyResponses||[]).find(x=> x.id===id);
    const collect = ()=>{ const gr = {}; el.querySelectorAll('.svg-pts').forEach(inp=>{ const fb = el.querySelector(`.svg-fb[data-qid="${inp.dataset.qid}"]`); gr[inp.dataset.qid] = { points: inp.value==='' ? null : Math.max(0, parseFloat(inp.value)||0), feedback: fb? fb.value.trim() : '' }; }); return gr; };
    const doSave = async (btn, released)=>{
      const r = findR(btn.dataset.rid); if(!r) return;
      try{ await surveySaveGrading(draft, r, { grading: collect(), released }); showToast(released===true? 'Đã lưu và công bố điểm bài này.' : released===false? 'Đã thu hồi công bố điểm.' : 'Đã lưu điểm bài này.'); }
      catch(e){ console.error('[Khảo sát] Lưu điểm lỗi:', e); alert('Không lưu được điểm: '+(e&&e.message||e)); }
      rer();
    };
    if(g('svg-save')) g('svg-save').onclick = ()=> doSave(g('svg-save'));
    if(g('svg-release')) g('svg-release').onclick = ()=>{ const r = findR(g('svg-release').dataset.rid); const tmp = Object.assign({}, r, { grading: Object.assign({}, r.grading, collect()) }); const pend = surveyGradeResponse(draft, tmp).pending; if(pend && !confirm(`Bài này còn ${pend} câu chưa chấm (đang tính 0 điểm). Vẫn công bố?`)) return; doSave(g('svg-release'), true); };
    if(g('svg-unrelease')) g('svg-unrelease').onclick = ()=>{ if(confirm('Thu hồi công bố điểm bài này? Người làm bài sẽ không xem được điểm cho tới khi công bố lại.')) doSave(g('svg-unrelease'), false); };
    if(g('sv-release-all')) g('sv-release-all').onclick = async ()=>{
      const ready = (state.surveyResponses||[]).filter(r=> !r.released && !surveyGradeResponse(draft, r).pending);
      if(!ready.length || !confirm(`Công bố điểm cho ${ready.length} bài đã chấm xong? Người làm bài mở link xem lại bài sẽ thấy điểm.`)) return;
      try{ for(const r of ready) await surveySaveGrading(draft, r, { released:true }); showToast(`Đã công bố điểm ${ready.length} bài.`); }
      catch(e){ alert('Công bố điểm bị lỗi giữa chừng: '+(e&&e.message||e)); }
      rer();
    };
    if(g('svgq-q')) g('svgq-q').onchange = ()=>{ state.surveyGradeQid = g('svgq-q').value; rer(); };
    el.querySelectorAll('[data-gq-full]').forEach(b=> b.onclick = ()=>{ const q = draft.questions.find(x=> x.id===state.surveyGradeQid); const inp = el.querySelector(`.svgq-pts[data-g="${b.dataset.gqFull}"]`); if(q && inp) inp.value = surveyQPoints(q); });
    el.querySelectorAll('[data-gq-apply]').forEach(b=> b.onclick = async ()=>{
      const q = draft.questions.find(x=> x.id===state.surveyGradeQid); if(!q) return;
      const i = b.dataset.gqApply, inp = el.querySelector(`.svgq-pts[data-g="${i}"]`), fb = el.querySelector(`.svgq-fb[data-g="${i}"]`);
      if(inp.value===''){ alert('Vui lòng nhập điểm trước khi áp dụng.'); return; }
      const pts = Math.max(0, Math.min(surveyQPoints(q), parseFloat(inp.value)||0));
      // dựng lại đúng nhóm như lúc vẽ
      const groups = new Map(); list().forEach(r=>{ const v = r.answers && r.answers[q.id]; const key = q.type==='file'? 'r:'+r.id : surveyNormText(surveyAnswerText(v, q)); if(!groups.has(key)) groups.set(key, []); groups.get(key).push(r); });
      const ordered = Array.from(groups.values()).map(rs=>({ rs, pend: rs.filter(r=> surveyGradeResponse(draft, r).per[q.id].status==='pending').length })).sort((a,b)=> b.pend-a.pend || b.rs.length-a.rs.length);
      const target = ordered[+i]; if(!target) return;
      b.disabled = true; b.textContent = '⏳ Đang lưu…';
      try{ for(const r of target.rs) await surveySaveGrading(draft, r, { grading: { [q.id]: { points: pts, feedback: (fb && fb.value.trim()) || ((r.grading||{})[q.id]||{}).feedback || '' } } }); showToast(`Đã chấm ${surveyFmtNum(pts)} điểm cho ${target.rs.length} bài.`); }
      catch(e){ alert('Lưu điểm bị lỗi: '+(e&&e.message||e)); }
      rer();
    });
    el.querySelectorAll('[data-resp-open]').forEach(b=> b.onclick = ()=>{ state.surveyRespView = 'detail'; state.surveyResponseViewIndex = parseInt(b.dataset.respOpen,10)||0; rer(); });
    el.querySelectorAll('[data-resp-del]').forEach(b=> b.onclick = ()=>{ const r = (state.surveyResponses||[]).find(x=> x.id===b.dataset.respDel); if(r) deleteSurveyResponse(draft, r, el); });
    if(g('sv-resp-cols')) g('sv-resp-cols').onclick = ()=> surveyRespColsModal(draft, rer);
    surveyWireLightbox(el);
    el.querySelectorAll('[data-zip-q]').forEach(b=> b.onclick = ()=>{ const q = draft.questions.find(x=> x.id===b.dataset.zipQ); if(q) surveyDownloadFilesZip(draft, q, list(), b); });
    if(g('sv-export-excel-btn')) g('sv-export-excel-btn').onclick = ()=> exportSurveyResponsesExcel(draft, surveyRespCols(draft, state.surveyResponses||[]), list(), surveyRespFilterLabels(draft, F).join(', '));
    if(g('sv-print-btn')) g('sv-print-btn').onclick = ()=> printSurveyResponses(draft, surveyRespCols(draft, state.surveyResponses||[]), list(), surveyRespFilterLabels(draft, F).join(', '));
  }
  async function deleteSurveyResponse(draft, r, el){
    if(!surveyCanEdit()){ alert('Đồng chí không có quyền xoá phiếu trả lời ở đây.'); return; }
    const sid = state.surveyEditingId, who = surveyWhoText(r);
    if(!confirm(`⚠️ Xoá VĨNH VIỄN phiếu nộp lúc ${new Date(r.submittedAt).toLocaleString('vi-VN')}${who? ' ('+who+')' : ''}?\n\nPhiếu sẽ bị xoá khỏi cơ sở dữ liệu và KHÔNG khôi phục được. Số phiếu đã nhận giảm đi 1${r.respondentKey? '; người này được trả lời thêm 1 lần' : ''}.`)) return;
    try{
      await rtdb.ref(`survey_responses/${sid}/${r.id}`).remove();
      draft.questions.filter(q=> q.type==='file').forEach(q=> surveyFileList(r.answers && r.answers[q.id]).forEach(f=>{ if(f.path && typeof storage!=='undefined'){ try{ storage.ref(f.path).delete().catch(()=>{}); }catch(e){} } }));
      await rtdb.ref(`surveys/${sid}/responseCount`).transaction(c=> Math.max(0, (parseInt(c,10)||0)-1));
      if(r.respondentKey) await rtdb.ref(`survey_respondents/${sid}/${r.respondentKey}`).transaction(c=> Math.max(0, (parseInt(c,10)||0)-1));
      await pushLog('xoá 1 phiếu trả lời', surveyFullName(draft));
    }catch(e){ console.error('[Khảo sát] Xoá phiếu lỗi:', e); alert('Không xoá được phiếu: '+(e&&e.message||e)); return; }
    state.surveyResponses = (state.surveyResponses||[]).filter(x=> x.id!==r.id);
    draft.responseCount = Math.max(0, (draft.responseCount||0)-1);
    showToast('Đã xoá phiếu trả lời.');
    renderSurveyTab(el);
  }
  // ---- Tuỳ chỉnh cột bảng câu trả lời: ẩn/hiện + kéo thả đổi thứ tự (nhớ theo trình duyệt) ----
  function surveyRespColsModal(draft, onDone){
    const sid = state.surveyEditingId, all = surveyRespAllCols(draft, state.surveyResponses||[]);
    const P = surveyColPrefs(sid);
    let order = surveyOrderedCols(all, P).map(c=>c.key);
    const vis = {}; all.forEach(c=>{ vis[c.key] = c.fixed || !(P.hidden||[]).includes(c.key); });
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:520px;">
          <div class="modal-head"><h3>🧩 Tuỳ chỉnh cột</h3><button class="modal-close preview-allow" id="svrc-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 8px;">Bỏ tick để ẩn cột. 💡 Đổi vị trí: nhấn giữ ⠿ ở đầu dòng, kéo lên/xuống rồi thả. Áp dụng cho bảng, xuất Excel và in (ghi nhớ trên trình duyệt này).</p>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${order.map(k=>{ const c = all.find(x=>x.key===k); return `<label class="col-pick-row sv-filter-item sv-opt sv-opt-full" draggable="true" data-col-key="${escapeHtml(k)}" style="cursor:move; margin:0;"><span style="opacity:.5;">${c.fixed? '📌' : '⠿'}</span><input type="checkbox" data-rc="${escapeHtml(k)}" ${vis[k]?'checked':''} ${c.fixed?'disabled':''}><span data-col-name-label="${escapeHtml(k)}">${escapeHtml(c.label)}</span></label>`; }).join('')}
            </div>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="svrc-default" style="margin-right:auto;">↺ Khôi phục mặc định</button><button class="btn btn-ghost preview-allow" id="svrc-cancel">Đóng</button><button class="btn btn-primary preview-allow" id="svrc-save">💾 Lưu</button></div>
        </div>`;
      wrap.querySelector('#svrc-close').onclick = close;
      wrap.querySelector('#svrc-cancel').onclick = close;
      wrap.querySelector('#svrc-default').onclick = ()=>{ order = all.map(c=>c.key); all.forEach(c=>{ vis[c.key] = true; }); render(); };
      wrap.querySelectorAll('[data-rc]').forEach(cb=> cb.onchange = ()=>{ vis[cb.dataset.rc] = cb.checked; });
      wireDragReorderWithIndicator(Array.from(wrap.querySelectorAll('.col-pick-row')), row=> row.dataset.colKey, (dragged, target, before)=>{
        order = order.filter(k=> k!==dragged); const ti = order.indexOf(target); order.splice(before? ti : ti+1, 0, dragged); render();
        setTimeout(()=>{ const l = wrap.querySelector(`[data-col-name-label="${dragged}"]`); if(l){ l.classList.remove('col-name-pulse'); void l.offsetWidth; l.classList.add('col-name-pulse'); } }, 70);
      });
      wrap.querySelector('#svrc-save').onclick = ()=>{ surveySaveColPrefs(sid, { order, hidden: all.filter(c=> !c.fixed && !vis[c.key]).map(c=>c.key) }); close(); if(onDone) onDone(); };
    }
    render();
  }
  // ---- Xuất Excel / In theo đúng bộ lọc + cột đang hiện (cột rộng cố định, chữ tự xuống dòng) ----
  async function exportSurveyResponsesExcel(draft, cols, list, banner){
    let X = null, styled = false;
    try{ X = await schedLoadXlsxStyle(); styled = true; }
    catch(e){ try{ await loadOptionalLibrary('xlsx'); X = window.XLSX; }catch(e2){ alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); return; } }
    const head = [['HỘI NÔNG DÂN'], [wardTitleUpper()], [provinceTitle()], [`KẾT QUẢ — ${surveyFullName(draft)}`], [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`]];
    if(banner) head.push([`Đang áp dụng lọc kết quả: ${banner}`]);
    head.push([]);
    const hr = head.length;
    const aoa = [...head, cols.map(c=> c.label.toUpperCase()), ...list.map((r,i)=> cols.map(c=> c.excel? c.excel(r,i) : c.get(r,i)))];
    const ws = X.utils.aoa_to_sheet(aoa);
    // Ô tệp: gắn liên kết bấm mở được trong Excel (phiếu có đúng 1 tệp)
    list.forEach((r,ri)=> cols.forEach((c,ci)=>{ if(!c.link) return; const url = c.link(r,ri); if(!url) return; const a = X.utils.encode_cell({ r:hr+1+ri, c:ci }); if(ws[a]) ws[a].l = { Target:url, Tooltip:'Bấm để mở tệp' }; }));
    const last = Math.max(0, cols.length-1);
    ws['!merges'] = head.map((line,r)=> line.length? { s:{r,c:0}, e:{r,c:last} } : null).filter(Boolean);
    ws['!cols'] = cols.map(c=> ({ wch: Math.max(6, Math.round(c.w/6.5)) }));
    if(styled){
      const st = (r,c,s)=>{ const a = X.utils.encode_cell({r,c}); if(ws[a]) ws[a].s = Object.assign({}, ws[a].s, s); };
      [0,3].forEach(r=> st(r,0,{ font:{bold:true}, alignment:{horizontal:'center'} }));
      if(banner) st(5,0,{ font:{bold:true, color:{rgb:'B71C1C'}} });
      cols.forEach((c,ci)=> st(hr,ci,{ font:{bold:true}, alignment:{horizontal:'center', vertical:'center', wrapText:true}, fill:{fgColor:{rgb:'E8F5E9'}} }));
      list.forEach((r,ri)=> cols.forEach((c,ci)=> st(hr+1+ri, ci, Object.assign({ alignment:{ horizontal: c.align==='left'? 'left' : 'center', vertical:'top', wrapText:true } }, (c.link && c.link(r,ri))? { font:{ color:{rgb:'1155CC'}, underline:true } } : {}))));
    }
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'Ket qua khao sat');
    X.writeFile(wb, `Khao-sat_${todayStr()}.xlsx`, { cellStyles:true });
  }
  function printSurveyResponses(draft, cols, list, banner){
    const tot = cols.reduce((a,c)=> a+c.w, 0) || 1;
    const items = list.map((r,i)=> ({ r, i }));
    const pcols = cols.map(c=> ({ label:c.label, align:c.align, widthPct: Math.round(c.w/tot*1000)/10, get: it=> escapeHtml(c.get(it.r, it.i)) }));
    printSections(`KẾT QUẢ — ${surveyFullName(draft)}`, [{ title:'Danh sách phiếu trả lời', list:items, cols:pcols }], banner||'');
  }


  // ---- Phát hiện "đang soạn dở chưa lưu": chụp bản gốc lúc mở trình soạn (và sau mỗi lần lưu),
  // khi rời đi thì so với bản đang soạn. Chụp trên BẢN SAO đã chuẩn hoá để các trường tự bổ sung khi
  // vẽ (branchEnabled, description...) không bị tính nhầm là thay đổi.
  const surveyBaselines = new WeakMap();
  function surveyDraftSig(d){ const c = ensureSurveySections(JSON.parse(JSON.stringify(d))); delete c.responseCount; delete c.updatedAt; return JSON.stringify(c); }
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

  function surveyOpenPreview(draft){
    if(!(draft.questions||[]).length){ alert('Biểu mẫu chưa có câu hỏi nào để xem thử.'); return; }
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch; z-index:99998;'; // trên cả khung "Hồ sơ đang soạn" của AI (99995)
    wrap.innerHTML = `<div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
      <div class="modal-head"><h3>👁️ Xem thử biểu mẫu</h3><div style="display:flex; gap:6px; margin-left:auto;"><button class="btn btn-ghost btn-sm preview-allow" id="svpv-phone">📱 Khổ điện thoại</button><button class="modal-close preview-allow" id="svpv-close">✕</button></div></div>
      <div class="modal-body" style="flex:1; overflow:auto; padding:0; background:var(--paper);"><div id="svpv-frame" class="svpv-frame"></div></div></div>`;
    document.body.appendChild(wrap);
    const frame = wrap.querySelector('#svpv-frame');
    wrap.querySelector('#svpv-close').onclick = ()=> wrap.remove();
    wrap.querySelector('#svpv-phone').onclick = (e)=>{ frame.classList.toggle('phone'); e.target.textContent = frame.classList.contains('phone')? '🖥️ Khổ máy tính' : '📱 Khổ điện thoại'; };
    renderPublicSurveyPage(draft.id||'xem-thu', { preview:true, survey:draft, container:frame });
  }
  function surveyThemeCardHtml(d, canEdit){
    const dis = canEdit? '' : 'disabled';
    const cover = d.cover||'none';
    return `<div class="panel sv-set-card"><div class="panel-head sv-sec-head"><h3>🎨 Giao diện trang điền phiếu</h3></div><div class="panel-body">
      <p style="margin:0 0 6px; font-weight:700;">Ảnh bìa</p>
      <div class="sv-cover-picks">${Object.entries(SURVEY_COVERS).map(([k,v])=>`<button type="button" class="sv-cover-pick preview-allow ${cover===k?'on':''}" data-cover="${k}" ${dis} style="${v.bg? `background:${v.bg};` : ''}"><span>${v.bg? v.icon : '∅'}</span><em>${escapeHtml(v.label)}</em></button>`).join('')}
        <button type="button" class="sv-cover-pick preview-allow ${cover==='custom'?'on':''}" id="svs-cover-upload" ${dis} style="${d.coverUrl? `background-image:url('${escapeHtml(d.coverUrl)}'); background-size:cover;` : ''}"><span>📷</span><em>${d.coverUrl? 'Ảnh của tôi (bấm để đổi)' : 'Tải ảnh của tôi lên'}</em></button>
        <input type="file" id="svs-cover-file" accept="image/*" style="display:none;"></div>
      <p style="margin:12px 0 6px; font-weight:700;">Màu chủ đạo</p>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">${SURVEY_COLORS.map(([c,l])=>`<button type="button" class="sv-color-pick preview-allow ${surveyAccent(d)===c?'on':''}" data-color="${c}" title="${l}" ${dis} style="background:${c};">${surveyAccent(d)===c? '✓' : ''}</button>`).join('')}</div>
      <div class="form-grid" style="margin-top:12px;">
        <div class="field"><label>Cách xưng hô với người trả lời</label><select id="svs-address" ${dis}>${SURVEY_ADDRESS_TERMS.map(t=>`<option value="${t}" ${surveyAddress(d)===t?'selected':''}>${t}</option>`).join('')}</select>
          <div class="sub" style="margin-top:4px;">VD: "Cảm ơn <b>${escapeHtml(surveyAddress(d))}</b> đã tham gia khảo sát".</div></div>
        <div class="field full"><label>💬 Lời cảm ơn sau khi gửi (không bắt buộc — để trống thì dùng lời cảm ơn mặc định)</label><textarea id="svs-thanks" rows="2" placeholder="VD: Cảm ơn ${escapeHtml(surveyAddress(d))} đã dành thời gian! Kết quả khảo sát sẽ được công bố tại Hội nghị ngày …" ${dis}>${escapeHtml(d.thanksMessage||'')}</textarea></div>
      </div>
      <label class="sv-filter-item sv-opt sv-opt-full"><input type="checkbox" id="svs-another" ${d.allowAnother!==false?'checked':''} ${dis}><span>Hiện nút <b>"Gửi thêm câu trả lời khác"</b> sau khi gửi (vẫn theo giới hạn số lần ở trên)</span></label>
      <p class="sub" style="margin:6px 0 0;">Bấm <b>👁️ Xem thử</b> ở thanh trên cùng để xem đúng như người trả lời sẽ thấy.</p>
    </div></div>`;
  }
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
            <textarea id="svs-closedmsg" rows="2" placeholder="VD: Đợt khảo sát đã kết thúc, cảm ơn bạn đã quan tâm." ${dis}>${escapeHtml(d.closedMessage||'')}</textarea></div>
        </div>
      </div></div>
      <div class="panel sv-set-card"><div class="panel-head sv-sec-head"><h3>👤 Người trả lời</h3></div><div class="panel-body">
        <p style="margin:0 0 6px; font-weight:700;">Cách nhận biết người trả lời</p>
        <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="svs-mode" value="none" ${mode==='none'?'checked':''} ${dis}><span><b>Không nhận biết</b> — ai có link cũng điền được, không giới hạn số lần.</span></label>
        <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="svs-mode" value="browser" ${mode==='browser'?'checked':''} ${dis}><span><b>Theo trình duyệt</b> — dễ dùng, không cần đăng nhập. Người cố tình đổi trình duyệt hoặc dùng chế độ ẩn danh vẫn lách được.</span></label>
        <label class="sv-filter-item sv-opt sv-opt-full"><input type="radio" name="svs-mode" value="google" ${mode==='google'?'checked':''} ${dis}><span><b>Theo tài khoản Google</b> — phải đăng nhập Google mới điền được, chặn chắc chắn, phiếu có ghi email người nộp. Người không có tài khoản Google sẽ không điền được.</span></label>
        <label class="sv-filter-item sv-opt sv-opt-full" style="margin-top:8px;"><input type="checkbox" id="svs-collectname" ${d.collectName?'checked':''} ${dis}><span><b>Thu thập họ tên người trả lời</b> — đầu phiếu có ô "Họ và tên" bắt buộc; bảng câu trả lời có cột Người nộp (rất nên bật với bài kiểm tra).</span></label>
        <div class="field" style="max-width:320px; margin-top:8px;"><label>Số lần mỗi người được trả lời</label>
          <select id="svs-limit" ${(mode==='none'||!canEdit)?'disabled':''}>
            ${[[1,'Giới hạn 1 lần'],[2,'Giới hạn 2 lần'],[3,'Giới hạn 3 lần'],[0,'Không giới hạn']].map(([v,l])=>`<option value="${v}" ${(mode==='none'? 0 : lim)===v?'selected':''}>${l}</option>`).join('')}
          </select>
          ${mode==='none'? '<div class="sub" style="margin-top:4px;">Chọn cách nhận biết người trả lời ở trên thì mới giới hạn số lần được.</div>' : ''}
        </div>
      </div></div>
      ${surveyThemeCardHtml(d, canEdit)}
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
    document.querySelectorAll('[data-cover]').forEach(b=> b.onclick = ()=>{ d.cover = b.dataset.cover; rerender(); });
    document.querySelectorAll('[data-color]').forEach(b=> b.onclick = ()=>{ d.themeColor = b.dataset.color; rerender(); });
    if(g('svs-address')) g('svs-address').onchange = ()=>{ d.addressTerm = g('svs-address').value; rerender(); };
    if(g('svs-thanks')) g('svs-thanks').oninput = ()=>{ d.thanksMessage = g('svs-thanks').value; };
    if(g('svs-another')) g('svs-another').onchange = ()=>{ d.allowAnother = g('svs-another').checked; };
    if(g('svs-cover-upload')) g('svs-cover-upload').onclick = ()=>{ if(d.coverUrl && d.cover!=='custom'){ d.cover = 'custom'; rerender(); return; } g('svs-cover-file').click(); };
    if(g('svs-cover-file')) g('svs-cover-file').onchange = async ()=>{
      const f = (g('svs-cover-file').files||[])[0]; if(!f) return;
      if(!(f.type||'').startsWith('image/')){ alert('Vui lòng chọn tệp ảnh.'); return; }
      if(f.size > 5*1024*1024){ alert('Ảnh bìa không được lớn hơn 5 MB.'); return; }
      const btn = g('svs-cover-upload'); btn.disabled = true; btn.querySelector('em').textContent = '⏳ Đang tải ảnh…';
      try{
        const path = `survey_covers/${d.id||'moi'}_${Date.now().toString(36)}_${(f.name||'anh').replace(/[^\w.\-]/g,'_').slice(-60)}`;
        const ref = storage.ref(path); await ref.put(f);
        d.coverUrl = await ref.getDownloadURL(); d.coverPath = path; d.cover = 'custom';
        showToast('Đã tải ảnh bìa lên. Nhớ bấm Lưu biểu mẫu.');
      }catch(e){ console.error('[Khảo sát] Tải ảnh bìa lỗi:', e); alert('Không tải được ảnh bìa: '+(e&&e.message||e)); }
      rerender();
    };
    if(g('svs-collectname')) g('svs-collectname').onchange = ()=>{ d.collectName = g('svs-collectname').checked; };
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
          <button class="btn btn-ghost btn-sm btn-back-list" id="sv-back-btn">← Danh sách biểu mẫu</button>
          <h3 style="margin:0;">${state.surveyEditingId? 'Sửa biểu mẫu' : 'Tạo biểu mẫu mới'}${state.surveyEditingId? ` — <span style="font-weight:600;">${escapeHtml(surveyFullName(draft))}</span>` : ''}</h3>
        </div>
        <div class="panel-body">
          ${spaceNoteHtml(state.surveySpace==='personal' ? 'personal' : 'shared', 'biểu mẫu')}
          ${surveyTabsHtml([
            { id:'sv-tab-questions', label:'📝 Câu hỏi', active: state.surveyEditorTab==='questions' },
            { id:'sv-tab-settings', label:'⚙️ Cài đặt nhận phiếu', active: state.surveyEditorTab==='settings' },
            { id:'sv-tab-answers', label:`📊 Câu trả lời${draft.responseCount?` (${draft.responseCount})`:''}`, active: state.surveyEditorTab==='answers', disabled: !state.surveyEditingId },
          ])}
          <div class="toolbar" style="margin:10px 0 14px; flex-wrap:wrap; gap:8px; justify-content:flex-end;">
            <button class="btn btn-ghost btn-sm preview-allow" id="sv-preview-btn" title="Xem đúng như người trả lời sẽ thấy, không gửi phiếu">👁️ Xem thử</button>
            ${state.surveyEditingId? `<button class="btn btn-ghost btn-sm" id="sv-copylink-btn">🔗 Copy link chia sẻ</button><button class="btn btn-ghost btn-sm preview-allow" id="sv-qr-btn" title="Mã QR để in dán hoặc gửi ảnh cho mọi người quét">📱 Mã QR</button><button class="btn btn-ghost btn-sm preview-allow" id="sv-project-btn" title="Chiếu mã QR thật to lên máy chiếu/TV hội trường">🖥️ Chiếu mã QR lên màn hình</button>` : ''}
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
    const pvBtn = document.getElementById('sv-preview-btn'); if(pvBtn) pvBtn.onclick = ()=> surveyOpenPreview(draft);
    const copyBtn = document.getElementById('sv-copylink-btn');
    if(copyBtn) copyBtn.onclick = ()=> copyMessageText(surveyShareUrl(state.surveyEditingId));
    const qrBtn = document.getElementById('sv-qr-btn');
    if(qrBtn) qrBtn.onclick = ()=> surveyQrModal(draft);
    const prjBtn = document.getElementById('sv-project-btn');
    if(prjBtn) prjBtn.onclick = ()=> surveyProjector(draft);

    if(state.surveyEditorTab==='questions'){
      const fullNameEl = ()=> document.getElementById('sv-fullname');
      const titleInput = document.getElementById('sv-title'); if(titleInput) titleInput.oninput = e=>{ draft.title = e.target.value; const f = fullNameEl(); if(f) f.textContent = surveyFullName(draft); };
      const kindSel = document.getElementById('sv-formkind'); if(kindSel) kindSel.onchange = ()=>{ draft.formKind = kindSel.value || null; const f = fullNameEl(); if(f) f.textContent = surveyFullName(draft); };
      const descInput = document.getElementById('sv-desc'); if(descInput) descInput.oninput = e=> draft.description = e.target.value;
      const quizToggle = document.getElementById('sv-isquiz'); if(quizToggle) quizToggle.onchange = e=>{
        draft.isQuiz = e.target.checked;
        // Vừa bật bài kiểm tra: câu đang 0 điểm và chưa có đáp án -> gán điểm mặc định
        if(draft.isQuiz){ const dp = parseFloat(draft.quizDefaultPoints)>=0? parseFloat(draft.quizDefaultPoints) : 1; draft.questions.forEach(q=>{ if(!surveyQPoints(q) && !surveyHasKey(q)) q.points = dp; }); }
        renderSurveyTab(el);
      };
      el.querySelectorAll('input[name="sv-qz-release"]').forEach(r=> r.onchange = ()=>{ draft.quizRelease = r.value; });
      el.querySelectorAll('.sv-qz').forEach(cb=> cb.onchange = ()=>{ draft[cb.dataset.f] = cb.checked; });
      const defPts = document.getElementById('sv-qz-defpts'); if(defPts) defPts.oninput = ()=>{ draft.quizDefaultPoints = Math.max(0, parseFloat(defPts.value)||0); };
      const qOf = node=> draft.questions.find(x=> x.id===node.dataset.qid);
      el.querySelectorAll('[data-key-toggle]').forEach(b=> b.onclick = ()=>{ surveyKeyOpen[b.dataset.keyToggle] = !surveyKeyOpen[b.dataset.keyToggle]; renderSurveyTab(el); });
      el.querySelectorAll('.qk-points').forEach(inp=> inp.oninput = ()=>{ const q = qOf(inp); if(!q) return; q.points = Math.max(0, parseFloat(inp.value)||0); const b = el.querySelector(`.sv-key-btn[data-key-toggle="${q.id}"]`); if(b) b.textContent = `✅ Đáp án (${surveyFmtNum(q.points)} điểm)`; });
      el.querySelectorAll('.qk-single').forEach(r=> r.onchange = ()=>{ const q = qOf(r); if(q){ q.correctAnswers = [r.value]; } });
      el.querySelectorAll('.qk-multi').forEach(cb=> cb.onchange = ()=>{ const q = qOf(cb); if(!q) return; const set = new Set(q.correctAnswers||[]); cb.checked? set.add(cb.value) : set.delete(cb.value); q.correctAnswers = (q.options||[]).filter(o=> set.has(o)); });
      el.querySelectorAll('.qk-ans').forEach(inp=> inp.oninput = ()=>{ const q = qOf(inp); if(!q) return; q.correctAnswers = (q.correctAnswers||[]).length? q.correctAnswers : ['']; q.correctAnswers[+inp.dataset.i] = inp.value; });
      el.querySelectorAll('.qk-ans-add').forEach(b=> b.onclick = ()=>{ const q = qOf(b); if(!q) return; q.correctAnswers = (q.correctAnswers||[]).length? q.correctAnswers : ['']; q.correctAnswers.push(''); renderSurveyTab(el); });
      el.querySelectorAll('.qk-ans-del').forEach(b=> b.onclick = ()=>{ const q = qOf(b); if(!q) return; (q.correctAnswers||[]).splice(+b.dataset.i,1); renderSurveyTab(el); });
      el.querySelectorAll('.qk-others').forEach(cb=> cb.onchange = ()=>{ const q = qOf(cb); if(q) q.markOthersWrong = cb.checked; });
      el.querySelectorAll('.qk-grid').forEach(inp=> inp.onchange = ()=>{
        const q = qOf(inp); if(!q) return; const i = +inp.dataset.row;
        q.gridAnswers = (q.rows||[]).map((_,k)=> (q.gridAnswers||[])[k] ?? (q.type==='grid_checkbox'? [] : ''));
        if(q.type==='grid_checkbox'){ const set = new Set(Array.isArray(q.gridAnswers[i])? q.gridAnswers[i] : []); inp.checked? set.add(inp.value) : set.delete(inp.value); q.gridAnswers[i] = (q.cols||[]).filter(c=> set.has(c)); }
        else q.gridAnswers[i] = inp.value;
      });
      el.querySelectorAll('.qk-fb').forEach(t=> t.oninput = ()=>{ const q = qOf(t); if(q) q[t.dataset.f] = t.value; });

      el.querySelectorAll('.q-text').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q.text = inp.value; });
      el.querySelectorAll('.q-desc').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q.description = inp.value; });
      el.querySelectorAll('.q-type').forEach(sel=> sel.onchange = ()=>{
        const q=draft.questions.find(x=>x.id===sel.dataset.qid);
        if(q){
          q.type = sel.value;
          surveyEnsureTypeDefaults(q);
          if(surveyQTypeHasOptions(q.type) && (!q.options||!q.options.length)) q.options=['Phương án 1'];
          if(!surveyQTypeHasOptions(q.type)) q.numericOnly = q.numericOnly||false;
          q.optionBranches = (q.options||[]).map((_,i)=> (q.optionBranches&&q.optionBranches[i]) || '__next__');
        }
        renderSurveyTab(el);
      });
      el.querySelectorAll('.q-scale').forEach(sel=> sel.onchange = ()=>{ const q = draft.questions.find(x=>x.id===sel.dataset.qid); if(!q) return; q[sel.dataset.f] = parseInt(sel.value,10); renderSurveyTab(el); });
      el.querySelectorAll('.q-scale-lbl').forEach(inp=> inp.oninput = ()=>{ const q = draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q[inp.dataset.f] = inp.value; });
      el.querySelectorAll('.q-grid-item').forEach(inp=> inp.oninput = ()=>{ const q = draft.questions.find(x=>x.id===inp.dataset.qid); if(!q) return; const k = inp.dataset.kind, i = +inp.dataset.i, old = q[k][i]; q[k][i] = inp.value;
        if(k==='cols' && Array.isArray(q.gridAnswers)) q.gridAnswers = q.gridAnswers.map(a=> Array.isArray(a)? a.map(x=> x===old? inp.value : x) : (a===old? inp.value : a)); });
      el.querySelectorAll('.q-grid-add').forEach(btn=> btn.onclick = ()=>{ const q = draft.questions.find(x=>x.id===btn.dataset.qid); if(!q) return; const k = btn.dataset.kind; q[k] = q[k]||[]; q[k].push(`${k==='rows'? 'Hàng' : 'Cột'} ${q[k].length+1}`); renderSurveyTab(el); });
      el.querySelectorAll('.q-grid-del').forEach(btn=> btn.onclick = ()=>{ const q = draft.questions.find(x=>x.id===btn.dataset.qid); if(!q) return; const k = btn.dataset.kind; if((q[k]||[]).length<=1){ alert(`Câu hỏi lưới cần ít nhất 1 ${k==='rows'? 'hàng' : 'cột'}.`); return; } const i = +btn.dataset.i, old = q[k][i]; q[k].splice(i,1);
        if(Array.isArray(q.gridAnswers)){ if(k==='rows') q.gridAnswers.splice(i,1); else q.gridAnswers = q.gridAnswers.map(a=> Array.isArray(a)? a.filter(x=> x!==old) : (a===old? '' : a)); }
        renderSurveyTab(el); });
      el.querySelectorAll('.q-file').forEach(sel=> sel.onchange = ()=>{ const q = draft.questions.find(x=>x.id===sel.dataset.qid); if(!q) return; q[sel.dataset.f] = sel.dataset.f==='fileKind'? sel.value : parseInt(sel.value,10); if(sel.dataset.f==='fileKind'){ if(q.fileKind!=='image') q.cameraOnly = false; renderSurveyTab(el); } });
      el.querySelectorAll('.q-file-camera').forEach(cb=> cb.onchange = ()=>{ const q = draft.questions.find(x=>x.id===cb.dataset.qid); if(q) q.cameraOnly = cb.checked; });
      el.querySelectorAll('.q-required').forEach(cb=> cb.onchange = ()=>{ const q=draft.questions.find(x=>x.id===cb.dataset.qid); if(q) q.required = cb.checked; });
      el.querySelectorAll('.q-numeric').forEach(cb=> cb.onchange = ()=>{ const q=draft.questions.find(x=>x.id===cb.dataset.qid); if(q) q.numericOnly = cb.checked; renderSurveyTab(el); });
      el.querySelectorAll('.q-option-text').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(!q) return; const oi = parseInt(inp.dataset.oi,10), old = q.options[oi]; q.options[oi] = inp.value; if((q.correctAnswers||[]).includes(old)) q.correctAnswers = q.correctAnswers.map(a=> a===old? inp.value : a); });
      el.querySelectorAll('.q-option-branch').forEach(sel=> sel.onchange = ()=>{
        const q=draft.questions.find(x=>x.id===sel.dataset.qid); if(!q) return;
        q.optionBranches = q.optionBranches||[];
        q.optionBranches[parseInt(sel.dataset.oi,10)] = sel.value;
      });
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
      const aiAppendBtn = document.getElementById('sv-ai-append-btn'); if(aiAppendBtn) aiAppendBtn.onclick = ()=> renderSurveyQuickAddByAiModal({ mode:'append', el, draft });
      const addSectionBtn = document.getElementById('sv-add-section-btn');
      if(addSectionBtn) addSectionBtn.onclick = ()=>{ draft.sections.push(emptySurveySection(draft.sections.length+1)); renderSurveyTab(el); };
      // 2 nút "Lưu biểu mẫu" (trên cùng + cuối khung soạn) dùng chung 1 hành động.
      el.querySelectorAll('.sv-save-action').forEach(btn=> btn.onclick = async ()=>{ if(await saveSurveyDraft()){ showToast('Đã lưu biểu mẫu!'); renderSurveyTab(el); } });
    } else {
      wireSurveyAnswers(el, draft);
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

  // =====================================================================
  // GĐ9 — AI CHO BIỂU MẪU
  //  (1) "✨ Tạo nhanh biểu mẫu bằng AI": khung chat theo đúng mẫu "Thêm nhanh bằng AI" của Hồ sơ hội viên /
  //      Sổ vay vốn (dòng nhắc trước khi tiêu hoá, nút Tiêu hoá chỉ bấm 1 lần, "Hồ sơ đang soạn" nhấp nháy,
  //      menu "Thêm thành phần" có ảnh/tài liệu/micro, sửa–chép–xoá tin nhắn). Ở đây "Hồ sơ đang soạn" là
  //      BẢN PHÁC THẢO BIỂU MẪU (các phần + câu hỏi + đáp án nếu là bài kiểm tra). Xong thì đưa vào trình
  //      soạn để duyệt lại rồi mới lưu (chế độ 'new' tạo biểu mẫu mới, 'append' thêm vào biểu mẫu đang soạn).
  //  (2) "🧠 AI tóm tắt kết quả": AI đọc số liệu tổng hợp + câu trả lời tự luận (theo bộ lọc) và viết nhận xét.
  // =====================================================================
  const SURVEY_AI_TYPE_GUIDE = `short (trả lời ngắn), paragraph (đoạn văn dài), radio (trắc nghiệm chọn 1, hiện sẵn mọi phương án), checkbox (hộp kiểm chọn nhiều), dropdown (menu thả xuống chọn 1 — hợp danh sách dài như ấp, năm sinh), scale (thang điểm, VD 1–5 đo mức độ hài lòng), grid_radio (lưới: nhiều hàng cùng 1 thang, mỗi hàng chọn 1), grid_checkbox (lưới: mỗi hàng chọn nhiều), date (ngày), time (giờ), file (tải tệp/ảnh lên)`;
  function surveyAiSystemPrompt(mode, cur){
    const existing = mode==='append' && cur? `\nBIỂU MẪU ĐANG SOẠN (người dùng muốn THÊM câu hỏi vào đây — KHÔNG lặp lại các câu đã có): "${cur.title}"\n${(cur.questions||[]).map((q,i)=>`  ${i+1}. [${q.type}] ${q.text}`).join('\n')||'  (chưa có câu nào)'}` : '';
    return `Bạn là trợ lý AI giúp cán bộ Hội Nông dân cấp xã SOẠN NHANH BIỂU MẪU khảo sát / phiếu lấy ý kiến / bài kiểm tra (giống Google Biểu mẫu). LUÔN gọi người dùng (cán bộ) là "đồng chí". Nhưng NỘI DUNG CÂU HỎI là để người dân, hội viên, học sinh... trả lời: viết câu hỏi ngắn gọn, dễ hiểu, lịch sự, KHÔNG dùng từ "đồng chí" trong câu hỏi (nếu cần xưng hô thì dùng "bạn"/"anh/chị").
NHIỆM VỤ: ${mode==='append'? 'soạn THÊM câu hỏi cho biểu mẫu đang có (trả về CHỈ các phần/câu hỏi MỚI cần thêm).' : 'soạn trọn vẹn 1 biểu mẫu mới.'} Người dùng có thể: mô tả mục đích; hoặc đính kèm phiếu giấy/ảnh chụp/Word/PDF có sẵn -> khi đó SỐ HOÁ ĐÚNG NGUYÊN VĂN các câu hỏi và phương án trong tài liệu, không tự thêm bớt; chỉ chọn loại câu phù hợp nhất.${existing}
CÁC LOẠI CÂU HỎI (trường "type"): ${SURVEY_AI_TYPE_GUIDE}.
QUY TẮC:
1) Chia "sections" (phần) khi biểu mẫu dài/nhiều chủ đề; biểu mẫu ngắn để 1 phần.
2) Câu chọn phương án phải có "options" đầy đủ, không trùng; câu thang điểm có "scaleMin" (0/1), "scaleMax" (2–10), nhãn 2 đầu; câu lưới có "rows" và "cols".
3) "required": true với câu quan trọng.
4) Nếu là BÀI KIỂM TRA ("isQuiz": true): mỗi câu có "points"; câu chọn phương án/thang điểm có "correctAnswers" (giá trị đúng y như trong options); câu trả lời ngắn có "correctAnswers" là các đáp án chấp nhận; câu lưới có "gridAnswers" (đáp án theo từng hàng); có thể thêm "feedbackCorrect"/"feedbackWrong". Câu tự luận (paragraph) không có đáp án (chấm tay).
4b) "formKind" là CÁCH GỌI TÊN biểu mẫu (độc lập với isQuiz), chọn 1 trong: ${SURVEY_FORM_KINDS.map(k=> `"${k.k}" (${k.label})`).join(', ')}; để "" nếu không rõ. "title" KHÔNG cần lặp lại tên loại.
5) Thiếu thông tin quan trọng (mục đích, đối tượng, số câu mong muốn...) thì HỎI LẠI ngắn gọn thay vì tự bịa; nhưng nếu người dùng đã mô tả đủ thì soạn luôn.
CÁCH LÀM VIỆC: luôn có 1 "Hồ sơ đang soạn" (bản phác thảo biểu mẫu, người dùng có thể đã tự sửa). Cuối mỗi lượt bạn nhận đúng bản phác thảo hiện tại — hãy chỉnh sửa TRỰC TIẾP lên đó và LUÔN trả về TOÀN BỘ bản phác thảo.
CÁCH TRẢ LỜI: trò chuyện tự nhiên trước (không bọc JSON), nói ngắn gọn đã soạn bao nhiêu phần/câu và gợi ý điều cần đồng chí kiểm tra. Nếu đã có ít nhất 1 câu hỏi, thêm NGAY CUỐI câu trả lời khối sau (đúng định dạng):
\`\`\`survey-result
{"title":"","description":"","formKind":"","isQuiz":false,"sections":[{"title":"","description":"","questions":[{"text":"","description":"","type":"radio","required":false,"options":[],"scaleMin":1,"scaleMax":5,"scaleMinLabel":"","scaleMaxLabel":"","rows":[],"cols":[],"points":0,"correctAnswers":[],"gridAnswers":[],"markOthersWrong":false,"feedbackCorrect":"","feedbackWrong":"","fileKind":"any"}]}]}
\`\`\`
Chưa đủ dữ liệu thì KHÔNG thêm khối này, chỉ trò chuyện/hỏi lại.
${AI_DRAFT_REMINDER_RULE}`;
  }
  // Chuẩn hoá kết quả AI -> đúng cấu trúc biểu mẫu của app (id mới, đủ trường, loại câu hợp lệ).
  function surveyAiNormalize(obj){
    const arr = x=> Array.isArray(x)? x.map(v=> String(v==null? '' : v).trim()).filter(Boolean) : [];
    const uniq = a=> Array.from(new Set(a));
    const types = SURVEY_QTYPES.map(t=> t.key);
    const rawSecs = Array.isArray(obj && obj.sections) && obj.sections.length? obj.sections : [{ title:'Phần 1', questions: (obj && obj.questions)||[] }];
    const sections = [], questions = [];
    rawSecs.forEach((sec, si)=>{
      const s = emptySurveySection(si+1); s.title = String((sec && sec.title) || `Phần ${si+1}`).trim(); s.description = String((sec && sec.description)||'');
      sections.push(s);
      ((sec && sec.questions)||[]).forEach(x=>{
        if(!x) return;
        const q = emptySurveyQuestion(s.id);
        q.text = String(x.text||'').trim(); q.description = String(x.description||''); q.showDesc = !!q.description;
        q.type = types.includes(x.type)? x.type : 'short';
        q.required = !!x.required;
        q.options = surveyQTypeHasOptions(q.type)? (uniq(arr(x.options)).length? uniq(arr(x.options)) : ['Phương án 1']) : ['Phương án 1'];
        q.optionBranches = q.options.map(()=> '__next__'); q.branchEnabled = false;
        if(q.type==='scale'){ q.scaleMin = parseInt(x.scaleMin,10)===0? 0 : 1; q.scaleMax = Math.min(10, Math.max(2, parseInt(x.scaleMax,10)||5)); q.scaleMinLabel = String(x.scaleMinLabel||''); q.scaleMaxLabel = String(x.scaleMaxLabel||''); }
        if(q.type==='grid_radio' || q.type==='grid_checkbox'){ q.rows = uniq(arr(x.rows)); q.cols = uniq(arr(x.cols)); if(!q.rows.length) q.rows = ['Hàng 1']; if(!q.cols.length) q.cols = ['Cột 1'];
          const ga = Array.isArray(x.gridAnswers)? x.gridAnswers : [];
          q.gridAnswers = q.rows.map((_,i)=>{ const k = ga[i]; return q.type==='grid_checkbox'? arr(Array.isArray(k)? k : (k? [k] : [])).filter(c=> q.cols.includes(c)) : (q.cols.includes(String(k||'').trim())? String(k).trim() : ''); }); }
        if(q.type==='file'){ q.fileKind = SURVEY_FILE_KINDS[x.fileKind]? x.fileKind : 'any'; q.maxFiles = 1; q.maxSizeMb = 10; }
        q.points = Math.max(0, parseFloat(x.points)||0);
        const ca = arr(x.correctAnswers);
        if(surveyQTypeHasOptions(q.type)) q.correctAnswers = ca.filter(a=> q.options.includes(a));
        else if(q.type==='scale') q.correctAnswers = ca.filter(a=> surveyScaleValues(q).includes(a)).slice(0,1);
        else if(q.type==='short') q.correctAnswers = ca;
        else q.correctAnswers = [];
        if((q.type==='radio' || q.type==='dropdown') && q.correctAnswers.length>1) q.correctAnswers = q.correctAnswers.slice(0,1);
        q.markOthersWrong = !!x.markOthersWrong;
        ['feedbackCorrect','feedbackWrong','feedbackGeneral'].forEach(k=>{ if(x[k]) q[k] = String(x[k]); });
        surveyEnsureTypeDefaults(q);
        if(q.text) questions.push(q);
      });
    });
    const fk = String((obj && obj.formKind)||'').trim();
    return { title: String((obj && obj.title)||'').trim(), description: String((obj && obj.description)||''), formKind: SURVEY_FORM_KINDS.some(k=> k.k===fk)? fk : '', isQuiz: !!(obj && obj.isQuiz), sections, questions };
  }
  // Rút gọn bản phác thảo để gửi lại cho AI (bỏ id, bỏ trường rỗng)
  function surveyAiCompact(res){
    return { title:res.title, description:res.description, formKind:res.formKind||'', isQuiz:res.isQuiz, sections: res.sections.map(s=>({ title:s.title, description:s.description, questions: res.questions.filter(q=> q.sectionId===s.id).map(q=>{
      const o = { text:q.text, type:q.type, required:!!q.required };
      if(q.description) o.description = q.description;
      if(surveyQTypeHasOptions(q.type)) o.options = q.options;
      if(q.type==='scale') Object.assign(o, { scaleMin:q.scaleMin, scaleMax:q.scaleMax, scaleMinLabel:q.scaleMinLabel, scaleMaxLabel:q.scaleMaxLabel });
      if(surveyIsGrid(q)) Object.assign(o, { rows:q.rows, cols:q.cols, gridAnswers:q.gridAnswers });
      if(q.type==='file') o.fileKind = q.fileKind;
      if(res.isQuiz){ o.points = q.points; if((q.correctAnswers||[]).length) o.correctAnswers = q.correctAnswers; if(q.markOthersWrong) o.markOthersWrong = true; ['feedbackCorrect','feedbackWrong','feedbackGeneral'].forEach(k=>{ if(q[k]) o[k] = q[k]; }); }
      return o; }) })) };
  }
  // "📋 Hồ sơ đang soạn" của khung chat AI — SỬA ĐẦY ĐỦ BẰNG TAY như bảng "Hồ sơ đang soạn" của Hồ sơ hội viên:
  // thêm câu/phần bằng tay (không cần chat với AI), sửa nội dung, loại câu, bắt buộc, phương án, thang điểm,
  // lưới, loại tệp, điểm + đáp án (bài kiểm tra), chuyển câu sang phần khác, xoá (có Hoàn tác), thu nhỏ/phóng to,
  // xem thử. Mọi sửa đổi ghi thẳng vào bản phác thảo — lần nhắn tiếp theo AI nhận đúng bản đã sửa.
  function renderSurveyAiDraftModal(res, onClose){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch; z-index:99995;';
    document.body.appendChild(wrap);
    const close = ()=>{ wrap.remove(); if(onClose) onClose(); };
    let zoomPct = 100;
    const ZOOM_MIN = 50, ZOOM_MAX = 200, ZOOM_STEP = 10;
    const lines = t=> Array.from(new Set(String(t||'').split(/\r\n|\r|\n/).map(x=> x.replace(/[​-‍﻿]/g,'').trim()).filter(Boolean)));
    const normOrder = ()=>{ res.questions = res.sections.flatMap(sec=> res.questions.filter(q=> q.sectionId===sec.id)); };
    const clone = x=> JSON.parse(JSON.stringify(x));
    const qById = id=> res.questions.find(x=> x.id===id);
    function qEditorHtml(q, n){
      const id = q.id, tl = SURVEY_QTYPES.map(t=>`<option value="${t.key}" ${q.type===t.key?'selected':''}>${escapeHtml(t.label)}</option>`).join('');
      let body = '';
      if(surveyQTypeHasOptions(q.type)){
        body += `<div class="field full"><label>Phương án (mỗi dòng 1 phương án)</label><textarea class="sfd-opts" data-qid="${id}" rows="${Math.min(8, Math.max(2,(q.options||[]).length))}">${escapeHtml((q.options||[]).join('\n'))}</textarea></div>`;
        if(res.isQuiz){
          const single = q.type!=='checkbox';
          body += `<div class="field full"><label>✅ Đáp án đúng ${single? '(chọn 1)' : '(tick tất cả đáp án đúng)'}</label><div>${(q.options||[]).map(o=>`<label class="sv-filter-item sv-opt sv-opt-fit sv-opt-correct"><input type="${single?'radio':'checkbox'}" ${single? `name="sfd-k-${id}"` : ''} class="sfd-key" data-qid="${id}" value="${escapeHtml(o)}" ${(q.correctAnswers||[]).includes(o)?'checked':''}><span>${escapeHtml(o)}</span></label>`).join('')}</div></div>`;
        }
      } else if(q.type==='scale'){
        body += `<div class="field"><label>Mức thấp nhất</label><select class="sfd-num" data-qid="${id}" data-f="scaleMin">${[0,1].map(v=>`<option ${+q.scaleMin===v?'selected':''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>Mức cao nhất</label><select class="sfd-num" data-qid="${id}" data-f="scaleMax">${[2,3,4,5,6,7,8,9,10].map(v=>`<option ${+q.scaleMax===v?'selected':''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>Nhãn mức thấp</label><input class="sfd-str" data-qid="${id}" data-f="scaleMinLabel" value="${escapeHtml(q.scaleMinLabel||'')}" placeholder="VD: Rất không hài lòng"></div>
          <div class="field"><label>Nhãn mức cao</label><input class="sfd-str" data-qid="${id}" data-f="scaleMaxLabel" value="${escapeHtml(q.scaleMaxLabel||'')}" placeholder="VD: Rất hài lòng"></div>`;
        if(res.isQuiz) body += `<div class="field"><label>✅ Mức đúng</label><select class="sfd-key-sel" data-qid="${id}"><option value="">— chưa đặt —</option>${surveyScaleValues(q).map(v=>`<option ${(q.correctAnswers||[]).map(String).includes(v)?'selected':''}>${v}</option>`).join('')}</select></div>`;
      } else if(surveyIsGrid(q)){
        body += `<div class="field"><label>Hàng — các ý cần đánh giá (mỗi dòng 1 hàng)</label><textarea class="sfd-list" data-qid="${id}" data-f="rows" rows="${Math.min(8, Math.max(2,(q.rows||[]).length))}">${escapeHtml((q.rows||[]).join('\n'))}</textarea></div>
          <div class="field"><label>Cột — các mức lựa chọn (mỗi dòng 1 cột)</label><textarea class="sfd-list" data-qid="${id}" data-f="cols" rows="${Math.min(8, Math.max(2,(q.cols||[]).length))}">${escapeHtml((q.cols||[]).join('\n'))}</textarea></div>`;
        if(res.isQuiz){
          if(q.type==='grid_radio') body += `<div class="field full"><label>✅ Đáp án đúng từng hàng</label><div style="display:flex; flex-wrap:wrap; gap:8px;">${(q.rows||[]).map((rw,ri)=>`<label class="sub" style="display:flex; align-items:center; gap:4px;">${escapeHtml(rw)}: <select class="sfd-gkey" data-qid="${id}" data-row="${ri}"><option value="">—</option>${(q.cols||[]).map(c=>`<option ${((q.gridAnswers||[])[ri]===c)?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></label>`).join('')}</div></div>`;
          else body += `<p class="sub" style="margin:0;">Đáp án lưới hộp kiểm: đặt ở nút ✅ Đáp án trong trình soạn sau khi đưa vào.</p>`;
        }
      } else if(q.type==='short' && res.isQuiz){
        body += `<div class="field full"><label>✅ Các câu trả lời được chấp nhận là đúng (mỗi dòng 1)</label><textarea class="sfd-shortkey" data-qid="${id}" rows="2">${escapeHtml((q.correctAnswers||[]).join('\n'))}</textarea></div>`;
      } else if(q.type==='file'){
        body += `<div class="field"><label>Loại tệp cho phép</label><select class="sfd-str" data-qid="${id}" data-f="fileKind">${Object.entries(SURVEY_FILE_KINDS).map(([k,v])=>`<option value="${k}" ${(q.fileKind||'any')===k?'selected':''}>${escapeHtml(v.label)}</option>`).join('')}</select></div>`;
      }
      return `<div class="sfd-q" data-qcard="${id}">
        <div style="display:flex; gap:8px; align-items:flex-start;">
          <b style="padding-top:9px;">${n}.</b>
          <div style="flex:1; min-width:0;">
            <input class="sfd-str" data-qid="${id}" data-f="text" value="${escapeHtml(q.text)}" placeholder="Nội dung câu hỏi..." style="width:100%; font-weight:700;">
            <div class="form-grid" style="margin-top:6px;">
              <div class="field"><label>Loại câu hỏi</label><select class="sfd-type" data-qid="${id}">${tl}</select></div>
              <div class="field"><label>Thuộc phần</label><select class="sfd-sec" data-qid="${id}">${res.sections.map((sc,si)=>`<option value="${sc.id}" ${q.sectionId===sc.id?'selected':''}>Phần ${si+1}: ${escapeHtml((sc.title||'').slice(0,30))}</option>`).join('')}</select></div>
              ${res.isQuiz? `<div class="field"><label>Số điểm</label><input type="number" min="0" step="0.5" class="sfd-pts" data-qid="${id}" value="${surveyQPoints(q)}"></div>` : ''}
              <div class="field"><label>&nbsp;</label><label class="sv-filter-item sv-opt sv-opt-fit"><input type="checkbox" class="sfd-req" data-qid="${id}" ${q.required?'checked':''}><span>Bắt buộc trả lời</span></label></div>
              ${body}
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm preview-allow" data-sfd-del="${id}" title="Xoá câu này" style="color:var(--red);">🗑️</button>
        </div>
      </div>`;
    }
    function render(){
      const bodyEl = wrap.querySelector('.modal-body'); const keepScroll = bodyEl? bodyEl.scrollTop : 0;
      normOrder();
      let n = 0;
      wrap.innerHTML = `<div class="modal" style="max-width:100vw; width:100vw; height:92vh; max-height:92vh; display:flex; flex-direction:column; border-radius:0;">
        <div class="modal-head"><h3>📋 Hồ sơ đang soạn — ${res.sections.length} phần, ${res.questions.length} câu hỏi${res.isQuiz? ' · Bài kiểm tra' : ''}</h3><button class="modal-close preview-allow" id="sfd-close">✕</button></div>
        <div style="padding:8px 14px; border-bottom:1px solid var(--line); display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <button type="button" class="btn btn-primary btn-sm preview-allow" id="sfd-add-q">➕ Thêm câu hỏi (nhập tay, không cần chat với AI)</button>
          <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sfd-add-sec">➕ Thêm phần</button>
          <label class="sv-filter-item sv-opt sv-opt-fit" style="margin:0;"><input type="checkbox" id="sfd-quiz" ${res.isQuiz?'checked':''}><span>📋 Đây là bài kiểm tra (có điểm và đáp án)</span></label>
        </div>
        <div class="modal-body" style="flex:1; overflow:auto;">
          <div style="zoom:${zoomPct}%;">
          <div class="form-grid"><div class="field full"><label>Tiêu đề biểu mẫu</label><input id="sfd-title" value="${escapeHtml(res.title)}"></div><div class="field full"><label>Biểu mẫu này được gọi là gì?</label><select id="sfd-kind"><option value="">Chưa chọn</option>${SURVEY_FORM_KINDS.map(k=>`<option value="${k.k}" ${res.formKind===k.k?'selected':''}>${k.icon} ${escapeHtml(k.opt)}</option>`).join('')}</select></div><div class="field full"><label>Mô tả</label><textarea id="sfd-desc" rows="2">${escapeHtml(res.description)}</textarea></div></div>
          ${res.sections.map((sc,si)=>{ const qs = res.questions.filter(q=> q.sectionId===sc.id);
            return `<div class="panel" style="margin-bottom:12px; border:2px solid #1565c0;"><div class="panel-head sv-sec-head" style="gap:8px;"><h3 style="white-space:nowrap;">📑 Phần ${si+1}/${res.sections.length}</h3>
                <input class="sfd-sectitle" data-sid="${sc.id}" value="${escapeHtml(sc.title||'')}" placeholder="Tiêu đề phần" style="flex:1; min-width:0;">
                ${res.sections.length>1? `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-sfd-delsec="${sc.id}" title="Xoá phần này" style="color:#fff;">🗑️</button>` : ''}</div>
              <div class="panel-body">
                ${qs.map(q=> qEditorHtml(q, ++n)).join('') || '<p class="sub" style="margin:0 0 8px;">Phần này chưa có câu hỏi.</p>'}
                <button type="button" class="btn btn-ghost btn-sm preview-allow" data-sfd-addq-sec="${sc.id}">➕ Thêm câu hỏi vào phần này</button>
              </div></div>`; }).join('')}
          </div>
        </div>
        <div class="modal-foot">
          <div style="display:flex; align-items:center; gap:6px; margin-right:auto;">
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sfd-zout" ${zoomPct<=ZOOM_MIN?'disabled':''} title="Thu nhỏ">➖</button>
            <span style="font-weight:700; min-width:42px; text-align:center;">${zoomPct}%</span>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sfd-zin" ${zoomPct>=ZOOM_MAX?'disabled':''} title="Phóng to">➕</button>
          </div>
          <button class="btn btn-ghost preview-allow" id="sfd-preview" ${res.questions.length?'':'disabled'}>👁️ Xem thử như người trả lời</button>
          <button class="btn btn-primary preview-allow" id="sfd-close2">Đóng bảng</button>
        </div>
      </div>`;
      const nb = wrap.querySelector('.modal-body'); if(nb) nb.scrollTop = keepScroll;
      wire();
    }
    function addQuestion(secId){
      const q = emptySurveyQuestion(secId || res.sections[res.sections.length-1].id);
      q.type = 'radio'; q.options = ['Phương án 1','Phương án 2']; q.optionBranches = ['__next__','__next__']; q.branchEnabled = false;
      q.points = res.isQuiz? 1 : 0; q.correctAnswers = []; q.description = '';
      res.questions.push(q); render();
      setTimeout(()=>{ const inp = wrap.querySelector(`.sfd-str[data-qid="${q.id}"][data-f="text"]`); if(inp){ inp.scrollIntoView({block:'center'}); inp.focus(); } }, 0);
    }
    function wire(){
      const $ = sel=> wrap.querySelector(sel), $$ = sel=> wrap.querySelectorAll(sel);
      $('#sfd-close').onclick = close; $('#sfd-close2').onclick = close;
      $('#sfd-zin').onclick = ()=>{ zoomPct = Math.min(ZOOM_MAX, zoomPct+ZOOM_STEP); render(); };
      $('#sfd-zout').onclick = ()=>{ zoomPct = Math.max(ZOOM_MIN, zoomPct-ZOOM_STEP); render(); };
      $('#sfd-title').oninput = e=>{ res.title = e.target.value; };
      $('#sfd-kind').onchange = e=>{ res.formKind = e.target.value; };
      $('#sfd-desc').oninput = e=>{ res.description = e.target.value; };
      $('#sfd-quiz').onchange = e=>{ res.isQuiz = e.target.checked; if(res.isQuiz) res.questions.forEach(q=>{ if(!surveyQPoints(q)) q.points = 1; }); render(); };
      $('#sfd-add-q').onclick = ()=> addQuestion(null);
      $$('[data-sfd-addq-sec]').forEach(b=> b.onclick = ()=> addQuestion(b.dataset.sfdAddqSec));
      $('#sfd-add-sec').onclick = ()=>{ const sc = emptySurveySection(res.sections.length+1); res.sections.push(sc); render(); };
      $$('.sfd-sectitle').forEach(inp=> inp.oninput = ()=>{ const sc = res.sections.find(x=> x.id===inp.dataset.sid); if(sc) sc.title = inp.value; });
      $$('[data-sfd-delsec]').forEach(b=> b.onclick = ()=>{
        const sid = b.dataset.sfdDelsec, cnt = res.questions.filter(q=> q.sectionId===sid).length;
        const snap = { sections: clone(res.sections), questions: clone(res.questions) };
        res.sections = res.sections.filter(x=> x.id!==sid); res.questions = res.questions.filter(q=> q.sectionId!==sid); render();
        showUndoToast(`Đã xoá phần${cnt? ` và ${cnt} câu hỏi` : ''}`, ()=>{ res.sections = snap.sections; res.questions = snap.questions; render(); });
      });
      $$('.sfd-str').forEach(inp=>{ const ev = inp.tagName==='SELECT'? 'onchange' : 'oninput'; inp[ev] = ()=>{ const q = qById(inp.dataset.qid); if(q) q[inp.dataset.f] = inp.value; }; });
      $$('.sfd-num').forEach(sel=> sel.onchange = ()=>{ const q = qById(sel.dataset.qid); if(!q) return; q[sel.dataset.f] = parseInt(sel.value,10); if(q.scaleMin>=q.scaleMax) q.scaleMax = Math.max(2, q.scaleMin+1); q.correctAnswers = (q.correctAnswers||[]).filter(v=> surveyScaleValues(q).includes(String(v))); render(); });
      $$('.sfd-req').forEach(cb=> cb.onchange = ()=>{ const q = qById(cb.dataset.qid); if(q) q.required = cb.checked; });
      $$('.sfd-pts').forEach(inp=> inp.oninput = ()=>{ const q = qById(inp.dataset.qid); if(q) q.points = Math.max(0, parseFloat(inp.value)||0); });
      $$('.sfd-type').forEach(sel=> sel.onchange = ()=>{
        const q = qById(sel.dataset.qid); if(!q) return;
        q.type = sel.value;
        if(surveyQTypeHasOptions(q.type) && !(q.options||[]).filter(Boolean).length) q.options = ['Phương án 1','Phương án 2'];
        q.optionBranches = (q.options||[]).map(()=> '__next__');
        q.correctAnswers = []; q.gridAnswers = undefined;
        surveyEnsureTypeDefaults(q);
        if(surveyIsGrid(q)) q.gridAnswers = (q.rows||[]).map(()=> q.type==='grid_checkbox'? [] : '');
        render();
      });
      $$('.sfd-sec').forEach(sel=> sel.onchange = ()=>{ const q = qById(sel.dataset.qid); if(!q) return; res.questions = res.questions.filter(x=> x!==q); q.sectionId = sel.value; res.questions.push(q); render(); showToast('Đã chuyển câu hỏi sang phần khác.'); });
      // Phương án / hàng / cột: cập nhật khi rời ô (không vẽ lại lúc đang gõ để khỏi mất con trỏ)
      $$('.sfd-opts').forEach(t=> t.onchange = ()=>{ const q = qById(t.dataset.qid); if(!q) return; const opts = lines(t.value); q.options = opts.length? opts : ['Phương án 1']; q.optionBranches = q.options.map(()=> '__next__'); q.correctAnswers = (q.correctAnswers||[]).filter(a=> q.options.includes(a)); render(); });
      $$('.sfd-list').forEach(t=> t.onchange = ()=>{ const q = qById(t.dataset.qid); if(!q) return; const v = lines(t.value); q[t.dataset.f] = v.length? v : [t.dataset.f==='rows'? 'Hàng 1' : 'Cột 1'];
        q.gridAnswers = (q.rows||[]).map((_,i)=>{ const k = (q.gridAnswers||[])[i]; return q.type==='grid_checkbox'? (Array.isArray(k)? k.filter(c=> q.cols.includes(c)) : []) : (q.cols.includes(k)? k : ''); }); render(); });
      $$('.sfd-key').forEach(inp=> inp.onchange = ()=>{ const q = qById(inp.dataset.qid); if(!q) return;
        if(inp.type==='radio') q.correctAnswers = [inp.value];
        else { const set = new Set(q.correctAnswers||[]); inp.checked? set.add(inp.value) : set.delete(inp.value); q.correctAnswers = (q.options||[]).filter(o=> set.has(o)); } });
      $$('.sfd-key-sel').forEach(sel=> sel.onchange = ()=>{ const q = qById(sel.dataset.qid); if(q) q.correctAnswers = sel.value? [sel.value] : []; });
      $$('.sfd-gkey').forEach(sel=> sel.onchange = ()=>{ const q = qById(sel.dataset.qid); if(!q) return; q.gridAnswers = (q.rows||[]).map((_,i)=> (q.gridAnswers||[])[i] || ''); q.gridAnswers[+sel.dataset.row] = sel.value; });
      $$('.sfd-shortkey').forEach(t=> t.oninput = ()=>{ const q = qById(t.dataset.qid); if(q) q.correctAnswers = lines(t.value); });
      $$('[data-sfd-del]').forEach(b=> b.onclick = ()=>{ const i = res.questions.findIndex(x=> x.id===b.dataset.sfdDel); if(i<0) return; const [rm] = res.questions.splice(i,1); render(); showUndoToast('Đã xoá câu hỏi khỏi Hồ sơ đang soạn', ()=>{ if(!res.sections.some(x=> x.id===rm.sectionId)) rm.sectionId = res.sections[0].id; res.questions.splice(Math.min(i, res.questions.length), 0, rm); render(); }); });
      $('#sfd-preview').onclick = ()=> surveyOpenPreview(Object.assign(emptySurveyDraft(), { title: res.title||'Biểu mẫu', description: res.description, formKind: res.formKind||null, isQuiz: res.isQuiz, sections: clone(res.sections), questions: clone(res.questions) }));
    }
    render();
  }
  // Đưa bản phác thảo vào trình soạn
  function surveyAiApply(res, mode, el, targetDraft){
    if(mode==='append' && targetDraft){
      const keepSecs = res.sections.filter(s=> res.questions.some(q=> q.sectionId===s.id));
      const secMap = {};
      if(keepSecs.length===1){ const last = targetDraft.sections[targetDraft.sections.length-1]; secMap[keepSecs[0].id] = last.id; }
      else keepSecs.forEach(s=>{ const ns = Object.assign({}, s, { id:'sec_'+uid() }); targetDraft.sections.push(ns); secMap[s.id] = ns.id; });
      res.questions.forEach(q=>{ const c = JSON.parse(JSON.stringify(q)); c.id = 'q_'+uid(); c.sectionId = secMap[q.sectionId] || targetDraft.sections[targetDraft.sections.length-1].id; targetDraft.questions.push(c); });
      if(res.isQuiz && !targetDraft.isQuiz){ targetDraft.isQuiz = true; showToast('Các câu mới có đáp án nên biểu mẫu được chuyển thành Bài kiểm tra.'); }
      ensureSurveySections(targetDraft);
      state.surveyEditorTab = 'questions';
      renderSurveyTab(el);
      showBigToast(`Đã thêm ${res.questions.length} câu hỏi vào biểu mẫu — nhớ bấm 💾 Lưu biểu mẫu.`);
      return;
    }
    const d = emptySurveyDraft();
    Object.assign(d, { title: res.title || 'Biểu mẫu không có tiêu đề', description: res.description||'', formKind: res.formKind || d.formKind || null, isQuiz: !!res.isQuiz, sections: res.sections.filter(s=> res.questions.some(q=> q.sectionId===s.id)), questions: res.questions });
    if(!d.sections.length) d.sections = [emptySurveySection(1)];
    ensureSurveySections(d);
    surveyBaselines.set(d, '__ai_chua_luu__'); // bản mới do AI soạn: tính là "chưa lưu" để rời trình soạn sẽ được cảnh báo
    state.surveyDraft = d; state.surveyEditingId = null; state.surveyEditorTab = 'questions'; state.surveyView = 'editor';
    renderSurveyTab(el);
    showBigToast('Đã đưa biểu mẫu AI soạn vào trình soạn — đồng chí kiểm tra lại rồi bấm 💾 Lưu biểu mẫu.');
  }
  function renderSurveyQuickAddByAiModal(opts){
    const mode = opts.mode || 'new', el = opts.el, target = opts.draft || null;
    if(!surveyCanEdit()){ alert('Đồng chí không có quyền tạo/sửa biểu mẫu ở đây.'); return; }
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const closeImmediate = ()=>{ state._sfaiAddMenuOpen = false; wrap.remove(); };
    const close = ()=>{
      if(resultIsEmpty()){ closeImmediate(); return; }
      if(confirm(`⚠️ "Hồ sơ đang soạn" (${latest.questions.length} câu hỏi) hiện CHƯA được đưa vào biểu mẫu.\n\nNếu đóng bảng bây giờ, bản phác thảo này sẽ BIẾN MẤT.\n\nBấm "OK" để đóng (mất dữ liệu), hoặc "Huỷ" để quay lại.`)) closeImmediate();
    };
    const messages = [];
    let pendingAttachments = [];
    let hasDigestedOnce = false;
    const draftFlash = {};
    let latest = { title:'', description:'', isQuiz:false, sections:[emptySurveySection(1)], questions:[] };
    const resultIsEmpty = ()=> !latest.questions.length;
    let busy = false, editingIndex = null;
    const what = mode==='append'? 'về các câu hỏi cần thêm' : 'về biểu mẫu cần soạn';
    function bubbleHtml(mm, idx){
      const isUser = mm.role==='user';
      if(mm.streaming) return `<div style="display:flex; justify-content:flex-start; margin-bottom:10px;"><div id="sfai-streaming-bubble" style="max-width:75%; background:#e3f2fd; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${mm.text? renderMarkdownLite(mm.text) : waveTextHtml('Chàng đang suy nghĩ…')}</div></div>`;
      if(editingIndex===idx) return `<div style="margin-bottom:10px;"><textarea id="sfai-edit-textarea" rows="3" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid var(--line);">${escapeHtml(mm.text)}</textarea>
          <div style="text-align:right; margin-top:6px; display:flex; gap:8px; justify-content:flex-end;"><button class="btn btn-ghost btn-sm preview-allow" id="sfai-edit-cancel">Huỷ bỏ</button><button class="btn btn-primary btn-sm preview-allow" id="sfai-edit-resend">Gửi lại</button></div></div>`;
      let inner = isUser? escapeHtml(mm.text||'') : renderMarkdownLite(mm.text||'');
      if(mm.attachments && mm.attachments.length) inner += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${mm.attachments.map(a=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)}</span>`).join('')}</div>`;
      return `<div style="display:flex; flex-direction:column; align-items:${isUser?'flex-end':'flex-start'}; margin-bottom:10px;">
        <div style="max-width:75%; background:${isUser?'#dcedc8':'#e3f2fd'}; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${inner}</div>
        <div style="display:flex; gap:4px; margin-top:3px;">${isUser? `<button class="btn-plain-icon preview-allow" data-bubble-edit="${idx}" title="Sửa" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">✏️</button>` : ''}
          <button class="btn-plain-icon preview-allow" data-bubble-copy="${idx}" title="Sao chép" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">📋</button>
          <button class="btn-plain-icon preview-allow" data-bubble-delete="${idx}" title="Xoá tin nhắn này" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">🗑️</button></div>
      </div>`;
    }
    function render(){
      const hasAnyUserContent = messages.some(mm=> mm.role==='user') || pendingAttachments.length>0;
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
          <div class="modal-head"><h3>✨ ${mode==='append'? `Soạn thêm câu hỏi bằng AI — "${escapeHtml(target? target.title : '')}"` : 'Tạo nhanh biểu mẫu bằng chat với AI'}</h3><button class="modal-close preview-allow" id="sfai-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column;" id="sfai-thread">
            ${messages.length? messages.map(bubbleHtml).join('')+(!hasDigestedOnce && messages.some(m=> m.role==='user')? aiPreDigestHintHtml(what) : '') : `<div class="sub" style="text-align:center; margin:auto; max-width:620px; line-height:1.7;">Hãy nhắn cho AI <b>mục đích</b> ${mode==='append'? 'các câu hỏi cần thêm' : 'của biểu mẫu'} — VD: <i>"Phiếu khảo sát nhu cầu vay vốn của hội viên, khoảng 10 câu"</i>, <i>"Bài kiểm tra 15 câu về Điều lệ Hội, mỗi câu 1 điểm"</i>. Hoặc đính kèm <b>phiếu giấy chụp ảnh / file Word / PDF có sẵn</b> để AI số hoá đúng nguyên văn.<br>AI sẽ đợi tới khi đồng chí bấm "🧠 Tiêu hoá tài liệu bằng AI" mới bắt đầu soạn.</div>`}
          </div>
          <div style="padding:8px 16px 0; background:var(--paper-2);">
            <div style="text-align:center; margin-bottom:8px;"><button type="button" class="btn btn-sm preview-allow" id="sfai-view-file" style="background:#fff9c4; border:1px solid #fbc02d; color:#5a4300; font-weight:700;">📋 Hồ sơ đang soạn — ${latest.questions.length} câu hỏi (bấm để xem/sửa/xem thử)</button></div>
            <p class="sub" style="margin:0 0 8px;">${hasDigestedOnce? 'AI đã đọc xong. Đồng chí cứ nhắn tiếp hoặc đính kèm thêm (VD: "thêm 3 câu về giống cây trồng", "đổi câu 5 thành thang điểm 1–5") — AI tự cập nhật lại Hồ sơ đang soạn, không cần bấm nút nào nữa.' : 'Chưa tiêu hoá tài liệu nào — nhắn/đính kèm xong thì bấm nút bên dưới.'}</p>
            ${pendingAttachments.length? `<div class="ai-attach-row" style="padding:0 0 8px;">${pendingAttachments.map((a,i)=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)} <button type="button" class="preview-allow" data-remove-att="${i}">✕</button></span>`).join('')}</div>` : ''}
            <input type="file" id="sfai-file-input" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,image/*" style="display:none;">
            <div class="ai-inputbar">
              <div class="ai-add-btn" id="sfai-add-btn" role="button" tabindex="0">➕<span class="ai-add-label"> THÊM THÀNH PHẦN</span>
                ${state._sfaiAddMenuOpen? `<div class="ai-add-menu">
                  <div class="ai-add-opt" data-sfai-add="image">🖼️ Tải ảnh phiếu giấy lên</div>
                  <div class="ai-add-opt" data-sfai-add="doc">📄 Tải tài liệu lên (Word, PDF, Excel)</div>
                  <div class="ai-add-opt${state._sfaiMic2Listening?' ai-add-opt-disabled':''}" data-sfai-add="mic">🎤 ${state._sfaiMicListening? '✅ Đang nghe — bấm để dừng' : 'Vừa nói vừa ra chữ'}</div>
                  <div class="ai-add-opt${state._sfaiMicListening?' ai-add-opt-disabled':''}" data-sfai-add="mic2">🎙️ ${state._sfaiMic2Listening? '✅ Đang nghe — bấm để dừng' : 'Nói xong mới ra chữ'}</div>
                </div>` : ''}
              </div>
              <textarea id="sfai-input" rows="1" placeholder="Nhắn tin cho AI... (Enter để xuống dòng, Ctrl+Enter để gửi)"></textarea>
              <div class="ai-send-wrap"><button id="sfai-send-btn">➤</button></div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="sfai-close2">Đóng bảng</button>
            ${hasDigestedOnce? '' : `<button type="button" class="btn btn-sm preview-allow" id="sfai-digest" ${(busy||!hasAnyUserContent)?'disabled':''} style="background:linear-gradient(180deg, #ffffff 0%, #7c4dff 45%, #4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700; ${(busy||!hasAnyUserContent)?'opacity:.5;':''}">${busy?'⏳ AI đang xử lý...':'🧠 Tiêu hoá tài liệu bằng AI'}</button>`}
            <button class="btn btn-primary preview-allow" id="sfai-add" ${resultIsEmpty()?'disabled':''} style="${resultIsEmpty()?'opacity:.45; cursor:not-allowed;':'display:inline-block; animation: bigMoneyPulse 1.4s ease-in-out infinite;'}">${mode==='append'? '➕ Thêm vào biểu mẫu đang soạn' : '➕ Đưa vào trình soạn biểu mẫu'}</button>
          </div>
        </div>`;
      const $ = sel=> wrap.querySelector(sel);
      $('#sfai-close').onclick = close; $('#sfai-close2').onclick = close;
      wrap.onclick = (e)=>{ if(state._sfaiAddMenuOpen && !e.target.closest('#sfai-add-btn')){ state._sfaiAddMenuOpen = false; render(); } };
      const th = $('#sfai-thread'); if(th) th.scrollTop = th.scrollHeight;
      $('#sfai-view-file').onclick = ()=> renderSurveyAiDraftModal(latest, render);
      wrap.querySelectorAll('[data-remove-att]').forEach(b=> b.onclick = ()=>{ pendingAttachments.splice(parseInt(b.dataset.removeAtt,10),1); render(); });
      wrap.querySelectorAll('[data-bubble-delete]').forEach(b=> b.onclick = ()=>{ if(!confirm('Xoá tin nhắn này khỏi cuộc trò chuyện?')) return; messages.splice(parseInt(b.dataset.bubbleDelete,10),1); render(); });
      wrap.querySelectorAll('[data-bubble-copy]').forEach(b=> b.onclick = ()=>{ const mm = messages[parseInt(b.dataset.bubbleCopy,10)]; if(mm) writeClipboardSilent(mm.text||''); showToast('Đã sao chép!'); });
      wrap.querySelectorAll('[data-bubble-edit]').forEach(b=> b.onclick = ()=>{ editingIndex = parseInt(b.dataset.bubbleEdit,10); render(); });
      if($('#sfai-edit-cancel')) $('#sfai-edit-cancel').onclick = ()=>{ editingIndex = null; render(); };
      if($('#sfai-edit-resend')) $('#sfai-edit-resend').onclick = ()=>{ messages[editingIndex].text = ($('#sfai-edit-textarea').value||'').trim(); messages.length = editingIndex+1; editingIndex = null; if(hasDigestedOnce){ render(); runAiTurn(); } else render(); };
      $('#sfai-add-btn').addEventListener('click', (e)=>{
        e.stopPropagation(); state._sfaiAddMenuOpen = !state._sfaiAddMenuOpen;
        const saved = ($('#sfai-input')||{}).value || ''; render();
        const after = wrap.querySelector('#sfai-input'); if(after && saved) after.value = saved; if(after) autoResizeTextarea(after);
      });
      wrap.querySelectorAll('[data-sfai-add]').forEach(x=> x.addEventListener('click', (e)=>{
        e.stopPropagation(); state._sfaiAddMenuOpen = false;
        if(x.dataset.sfaiAdd==='mic'){ wrap.querySelector('#sfai-add-btn .ai-add-menu')?.remove(); toggleMicGeneric('sfai', render); return; }
        if(x.dataset.sfaiAdd==='mic2'){ wrap.querySelector('#sfai-add-btn .ai-add-menu')?.remove(); toggleMic2Generic('sfai', render); return; }
        const fi = $('#sfai-file-input'); fi.accept = x.dataset.sfaiAdd==='image'? 'image/*' : '.pdf,.docx,.xlsx,.xls,.csv,.txt'; fi.click();
      }));
      $('#sfai-file-input').onchange = async (e)=>{
        for(const f of Array.from(e.target.files||[])){
          try{ const a = await schedReadFile(f); if(a) pendingAttachments.push(a); }catch(err){ console.error(err); alert(`Không đọc được tệp "${f.name}": ${err&&err.message||err}`); }
        }
        if(hasDigestedOnce) doSend(); else render();
      };
      $('#sfai-send-btn').onclick = ()=>{ doSend(); scrollNearestModalToBottom(wrap); };
      wireAutoResizeTextarea('sfai-input');
      flashDraftButtonIfChanged(draftFlash, $('#sfai-view-file'), JSON.stringify(surveyAiCompact(latest)));
      $('#sfai-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter' && e.ctrlKey){ e.preventDefault(); doSend(); } });
      $('#sfai-input').addEventListener('focus', ()=> scrollNearestModalToBottom(wrap));
      if($('#sfai-digest')) $('#sfai-digest').onclick = ()=> runAiTurn();
      const addBtn = $('#sfai-add'); if(addBtn) addBtn.onclick = ()=>{
        if(resultIsEmpty()) return;
        const empties = latest.questions.filter(q=> !String(q.text||'').trim()).length;
        if(empties){ alert(`Có ${empties} câu hỏi chưa có nội dung. Vào "📋 Hồ sơ đang soạn" để sửa hoặc xoá.`); return; }
        if(!confirm(mode==='append'? `Thêm ${latest.questions.length} câu hỏi vào biểu mẫu đang soạn?` : `Đưa biểu mẫu ${latest.questions.length} câu hỏi vào trình soạn? Đồng chí sẽ kiểm tra lại rồi bấm Lưu biểu mẫu.`)) return;
        closeImmediate(); surveyAiApply(latest, mode, el, target);
      };
    }
    function doSend(){
      const inp = wrap.querySelector('#sfai-input'); const text = (inp.value||'').trim();
      if(!text && !pendingAttachments.length) return;
      messages.push({ role:'user', text, attachments: pendingAttachments });
      pendingAttachments = []; inp.value = '';
      if(hasDigestedOnce){ render(); runAiTurn(); } else render();
    }
    async function runAiTurn(){
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, vui lòng đăng nhập để sử dụng tính năng này.'); return; }
      if(busy) return;
      if(pendingAttachments.length){ messages.push({ role:'user', text:'', attachments: pendingAttachments }); pendingAttachments = []; }
      const binary = messages.filter(m=> m.role==='user').flatMap(m=> m.attachments||[]).filter(a=> a.base64);
      const prov = (typeof getActiveAiProvider==='function')? getActiveAiProvider() : null;
      if(binary.some(a=> a.mimeType==='application/pdf') && prov && aiVendorOf(prov)!=='gemini'){ alert('Model AI đang chọn không đọc được tệp PDF. Đồng chí đổi sang model Gemini, hoặc dùng tệp Word/ảnh chụp.'); render(); return; }
      busy = true;
      const stream = { role:'ai', text:'', streaming:true };
      messages.push(stream); render();
      try{
        const aiMessages = [{ role:'user', text: surveyAiSystemPrompt(mode, target) }, { role:'assistant', text:'Đã hiểu, tôi sẽ tuân thủ đúng quy tắc và định dạng trả lời.' }];
        messages.forEach(mm=>{
          if(mm===stream) return;
          let t = mm.text||'';
          (mm.attachments||[]).filter(a=> a.text).forEach(a=>{ t += `\n\n[Nội dung tệp "${a.name}"]\n${a.text}`; });
          (mm.attachments||[]).filter(a=> a.base64).forEach(a=>{ t += `\n(kèm tệp "${a.name}")`; });
          aiMessages.push({ role: mm.role==='user'? 'user' : 'assistant', text: t || '(tệp đính kèm)' });
        });
        aiMessages.push({ role:'user', text:`[Hồ sơ đang soạn HIỆN TẠI${resultIsEmpty()? ' (đang RỖNG)' : ' (có thể người dùng đã tự sửa)'}]:\n${JSON.stringify(surveyAiCompact(latest))}` });
        aiMessages.push({ role:'assistant', text:'Đã ghi nhận Hồ sơ đang soạn hiện tại, tôi sẽ dựa vào đó để cập nhật.' });
        const result = await callAIWithFallback(aiMessages, binary.length? { attachments: binary.map(a=>({ name:a.name, mimeType:a.mimeType, base64:a.base64 })) } : {}, (partial)=>{
          stream.text = partial;
          const b = document.getElementById('sfai-streaming-bubble');
          if(b){ b.innerHTML = partial? renderMarkdownLite(partial) : waveTextHtml('Chàng đang suy nghĩ…'); const th = wrap.querySelector('#sfai-thread'); if(th) th.scrollTop = th.scrollHeight; }
        });
        const full = result.text || '';
        const mm = full.match(/```survey-result\s*([\s\S]*?)```/);
        let reply = full, parsed = null;
        if(mm){ reply = (full.slice(0,mm.index)+full.slice(mm.index+mm[0].length)).trim(); try{ parsed = JSON.parse(mm[1].trim()); }catch(e){ parsed = null; } }
        messages.pop();
        if(parsed){ latest = surveyAiNormalize(parsed); }
        if(mm && !parsed) reply += '\n\n(Lưu ý: không đọc được khối kết quả của AI, đồng chí nhắn "soạn lại" giúp.)';
        if(reply) messages.push({ role:'ai', text: reply });
        hasDigestedOnce = true;
      }catch(err){
        messages.pop();
        console.error('[Khảo sát] Lỗi AI soạn biểu mẫu:', err);
        messages.push({ role:'ai', text:`Xin lỗi, có lỗi xảy ra khi xử lý: ${err && err.message? err.message : err}. Đồng chí thử lại nhé.` });
      }
      busy = false; render();
    }
    render();
  }

  // ---- (2) AI tóm tắt kết quả ----
  function surveyAiSummaryData(draft, list){
    const out = [`TÊN BIỂU MẪU: "${surveyFullName(draft)}"${draft.description? ' — '+draft.description : ''}`, `SỐ PHIẾU ĐƯỢC PHÂN TÍCH: ${list.length}`];
    if(draft.isQuiz){
      const g = list.map(r=> surveyGradeResponse(draft, r)), sc = g.map(x=> x.score).sort((a,b)=> a-b);
      if(sc.length) out.push(`ĐIỂM BÀI KIỂM TRA: trung bình ${surveyFmtNum(sc.reduce((a,b)=>a+b,0)/sc.length)}/${surveyFmtNum(g[0].max)}, thấp nhất ${surveyFmtNum(sc[0])}, cao nhất ${surveyFmtNum(sc[sc.length-1])}, ${g.filter(x=> x.pending).length} bài còn chờ chấm tay.`);
    }
    draft.questions.forEach((q,qi)=>{
      const vals = list.map(r=> r.answers && r.answers[q.id]).filter(v=> surveyHasAnswer(q, v));
      const head = `\nCÂU ${qi+1} [${(SURVEY_QTYPES.find(t=> t.key===q.type)||{}).label||q.type}] "${q.text}" — ${vals.length}/${list.length} người trả lời`;
      if(surveyQTypeHasOptions(q.type)){
        const c = new Map((q.options||[]).map(o=> [o,0])); vals.forEach(v=> (Array.isArray(v)? v : [v]).forEach(a=> c.set(a, (c.get(a)||0)+1)));
        out.push(head + '\n' + Array.from(c.entries()).map(([o,n])=> `  - ${o}: ${n} (${vals.length? Math.round(n/vals.length*100) : 0}%)`).join('\n'));
      } else if(q.type==='scale'){
        const c = {}; let sum = 0; vals.forEach(v=>{ c[v] = (c[v]||0)+1; sum += parseFloat(v)||0; });
        out.push(head + `\n  Trung bình ${vals.length? (sum/vals.length).toFixed(2) : '—'} trên thang ${q.scaleMin}(${q.scaleMinLabel||''})–${q.scaleMax}(${q.scaleMaxLabel||''}); phân bố: ${surveyScaleValues(q).map(v=> `${v}:${c[v]||0}`).join(', ')}`);
      } else if(surveyIsGrid(q)){
        out.push(head + '\n' + (q.rows||[]).map((rw,i)=> `  - ${rw}: ` + (q.cols||[]).map(cn=> `${cn} ${vals.filter(v=>{ const x = surveyGridCell(v,i); return Array.isArray(x)? x.includes(cn) : x===cn; }).length}`).join(', ')).join('\n'));
      } else if(q.type==='file'){
        out.push(head + ` — ${vals.reduce((a,v)=> a+surveyFileList(v).length, 0)} tệp đã nộp (không phân tích nội dung tệp).`);
      } else {
        const texts = vals.map(v=> surveyAnswerText(v, q).replace(/\s+/g,' ').slice(0,300));
        out.push(head + '\n' + texts.slice(0,80).map(t=> `  • ${t}`).join('\n') + (texts.length>80? `\n  … và ${texts.length-80} câu trả lời khác` : ''));
      }
    });
    return out.join('\n');
  }
  // Bộ hiển thị markdown của app chưa đọc tiêu đề "## …" -> đổi thành dòng chữ đậm.
  function surveyMd(t){ return renderMarkdownLite(String(t||'').replace(/^\s*#{1,6}\s*(.+?)\s*#*\s*$/gm, '**$1**')); }
  function surveyAiSummaryModal(draft, list, filterText){
    if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, vui lòng đăng nhập để sử dụng tính năng này.'); return; }
    if(!list.length){ alert('Chưa có phiếu nào để tóm tắt.'); return; }
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const data = surveyAiSummaryData(draft, list);
    const sys = `Bạn là chuyên viên phân tích số liệu giúp cán bộ Hội Nông dân cấp xã đọc kết quả khảo sát. LUÔN gọi người dùng là "đồng chí". Viết bằng tiếng Việt, dạng Markdown, ngắn gọn, dễ hiểu, có số liệu cụ thể, gồm các mục:
## 1. Tổng quan
## 2. Kết quả nổi bật (theo từng câu quan trọng, nêu số liệu và %)
## 3. Ý kiến tự luận đáng chú ý (gom theo chủ đề, trích dẫn ngắn nguyên văn)
## 4. Vấn đề cần lưu ý
## 5. Đề xuất cho Hội
TUYỆT ĐỐI không bịa số liệu: chỉ dùng số liệu được cung cấp bên dưới. Không nêu tên/email cá nhân người trả lời.`;
    const convo = [{ role:'user', text: sys + `\n\nSỐ LIỆU${filterText? ' (đang lọc: '+filterText+')' : ''}:\n` + data }, { role:'assistant', text:'Đã nhận số liệu, tôi sẽ viết bản tóm tắt.' }, { role:'user', text:'Hãy viết bản tóm tắt kết quả.' }];
    const turns = []; // [{q, a}]
    let busy = false;
    function render(){
      wrap.innerHTML = `<div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
        <div class="modal-head"><h3>🧠 AI tóm tắt kết quả — ${escapeHtml(surveyFullName(draft))} (${list.length} phiếu${filterText? ', đang lọc' : ''})</h3><button class="modal-close preview-allow" id="sas-close">✕</button></div>
        <div class="modal-body" style="flex:1; overflow:auto; padding:16px;" id="sas-body">
          ${turns.map((t,i)=>`${i? `<div style="display:flex; justify-content:flex-end; margin:10px 0;"><div style="max-width:75%; background:#dcedc8; border-radius:12px; padding:8px 12px;">${escapeHtml(t.q)}</div></div>` : ''}<div class="sas-answer" ${t.streaming? 'id="sas-stream"' : ''}>${t.a? surveyMd(t.a) : waveTextHtml('Chàng đang đọc số liệu và viết tóm tắt…')}</div>`).join('')}
        </div>
        <div style="padding:8px 16px; background:var(--paper-2); display:flex; gap:8px; align-items:flex-end;">
          <textarea id="sas-input" rows="1" placeholder="Hỏi thêm AI về kết quả này… (VD: Nhóm nào chưa hài lòng nhất?) — Ctrl+Enter để gửi" style="flex:1; resize:none; max-height:30vh;" ${busy?'disabled':''}></textarea>
          <button class="btn btn-primary preview-allow" id="sas-send" ${busy?'disabled':''}>➤</button>
        </div>
        <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
          <button class="btn btn-ghost preview-allow" id="sas-copy" ${busy||!turns[0]||!turns[0].a?'disabled':''}>📋 Sao chép</button>
          <button class="btn btn-ghost preview-allow" id="sas-word" ${busy||!turns[0]||!turns[0].a?'disabled':''}>⬇️ Tải file Word</button>
          <button class="btn btn-ghost preview-allow" id="sas-print" ${busy||!turns[0]||!turns[0].a?'disabled':''}>🖨️ In</button>
          <button class="btn btn-ghost preview-allow" id="sas-redo" ${busy?'disabled':''}>↻ Viết lại</button>
          <button class="btn btn-primary preview-allow" id="sas-close2">Đóng</button>
        </div></div>`;
      const $ = s=> wrap.querySelector(s);
      $('#sas-close').onclick = ()=> wrap.remove(); $('#sas-close2').onclick = ()=> wrap.remove();
      const body = $('#sas-body'); body.scrollTop = body.scrollHeight;
      const allText = ()=> turns.map((t,i)=> (i? `\n\n### Hỏi thêm: ${t.q}\n\n` : '') + (t.a||'')).join('');
      const allHtml = ()=> turns.map((t,i)=> (i? `<h3>Hỏi thêm: ${escapeHtml(t.q)}</h3>` : '') + surveyMd(t.a||'')).join('');
      $('#sas-copy').onclick = ()=>{ writeClipboardSilent(allText()); showToast('Đã sao chép bản tóm tắt.'); };
      $('#sas-word').onclick = ()=> downloadBlob(`Tom-tat-khao-sat_${todayStr()}.doc`, htmlToWordDoc(`Tóm tắt kết quả: ${surveyFullName(draft)}`, `<h2>TÓM TẮT KẾT QUẢ — ${escapeHtml(surveyFullName(draft))}</h2><p><i>${list.length} phiếu${filterText? ' — đang lọc: '+escapeHtml(filterText) : ''} · ${new Date().toLocaleString('vi-VN')}</i></p>${allHtml()}`), 'application/msword');
      $('#sas-print').onclick = ()=>{ const area = document.getElementById('print-area'); if(!area) return; area.innerHTML = `<div class="print-title" style="text-align:center;">TÓM TẮT KẾT QUẢ — ${escapeHtml(surveyFullName(draft).toUpperCase())}</div><div style="text-align:center; font-size:12px; margin-bottom:10px;">${list.length} phiếu${filterText? ' — đang lọc: '+escapeHtml(filterText) : ''} · ${new Date().toLocaleString('vi-VN')}</div>${allHtml()}`; printAreaNow(false); };
      $('#sas-redo').onclick = ()=>{ turns.length = 0; convo.length = 3; ask(null); };
      const send = ()=>{ const t = ($('#sas-input').value||'').trim(); if(!t || busy) return; ask(t); };
      $('#sas-send').onclick = send;
      $('#sas-input').addEventListener('keydown', e=>{ if(e.key==='Enter' && e.ctrlKey){ e.preventDefault(); send(); } });
    }
    async function ask(question){
      busy = true;
      if(question) convo.push({ role:'user', text: question });
      const t = { q: question||'', a:'', streaming:true }; turns.push(t); render();
      try{
        const res = await callAIWithFallback(convo.slice(), {}, (partial)=>{ t.a = partial; const b = document.getElementById('sas-stream'); if(b){ b.innerHTML = surveyMd(partial); const body = wrap.querySelector('#sas-body'); if(body) body.scrollTop = body.scrollHeight; } });
        t.a = res.text || '(AI không trả lời)';
        convo.push({ role:'assistant', text: t.a });
      }catch(e){ console.error('[Khảo sát] AI tóm tắt lỗi:', e); t.a = `Xin lỗi, có lỗi khi gọi AI: ${e && e.message? e.message : e}. Đồng chí bấm "↻ Viết lại" để thử lại.`; if(question) convo.pop(); }
      t.streaming = false; busy = false; render();
    }
    ask(null);
  }

  // =====================================================================
  // GIAO DIỆN CÔNG KHAI ĐIỀN PHIẾU — truy cập qua link chia sẻ dạng
  // https://.../#/khaosat/{surveyId}, KHÔNG cần đăng nhập, KHÔNG hiện menu/nút Admin.
  // =====================================================================
  function publicSurveyRouteId(){
    // Dạng MỚI: /khaosat/{mã}[/ketqua/{phiếu}/{mã bí mật}] — Dạng CŨ #/khaosat/... vẫn chạy.
    const p = (window.location.pathname||'').match(/^\/khaosat\/(.+?)\/?$/);
    if(p) return decodeURIComponent(p[1]);
    const m = (window.location.hash||'').match(/^#\/khaosat\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  // ---- Xưng hô & giao diện trang điền phiếu (GĐ8). Người trả lời là người dân, học sinh, mọi tầng
  // lớp — KHÔNG gọi là "đồng chí". Người tạo chọn cách xưng hô; mặc định "bạn".
  const SURVEY_ADDRESS_TERMS = ['bạn','anh/chị','quý vị','ông/bà','em'];
  function surveyAddress(survey, cap){ const t = (survey && SURVEY_ADDRESS_TERMS.includes(survey.addressTerm))? survey.addressTerm : 'bạn'; return cap? t.charAt(0).toUpperCase()+t.slice(1) : t; }
  const SURVEY_COLORS = [['#2e7d32','Xanh lá'],['#1565c0','Xanh dương'],['#c62828','Đỏ'],['#ef6c00','Cam'],['#6a1b9a','Tím'],['#00838f','Xanh ngọc'],['#5d4037','Nâu']];
  const SURVEY_COVERS = {
    none:{ label:'Không có ảnh bìa' },
    lua:{ label:'🌾 Cánh đồng lúa', bg:'linear-gradient(135deg,#9ccc65 0%,#558b2f 55%,#33691e 100%)', icon:'🌾🌾🌾' },
    hoi:{ label:'⭐ Hội Nông dân', bg:'linear-gradient(135deg,#e53935 0%,#b71c1c 60%,#7f0000 100%)', icon:'⭐' },
    xanh:{ label:'📋 Khảo sát', bg:'linear-gradient(135deg,#42a5f5 0%,#1565c0 60%,#0d47a1 100%)', icon:'📋' },
    hoc:{ label:'📚 Học tập – kiểm tra', bg:'linear-gradient(135deg,#ab47bc 0%,#6a1b9a 60%,#4a148c 100%)', icon:'📚✏️' },
    nong:{ label:'🚜 Nông nghiệp', bg:'linear-gradient(135deg,#ffb74d 0%,#ef6c00 60%,#bf360c 100%)', icon:'🚜🌱' },
  };
  function surveyAccent(survey){ const c = survey && survey.themeColor; return SURVEY_COLORS.some(x=> x[0]===c)? c : '#2e7d32'; }
  function surveyCoverHtml(survey){
    const c = survey && survey.cover;
    if(c==='custom' && survey.coverUrl) return `<div class="ps-cover" style="background-image:url('${escapeHtml(survey.coverUrl)}');"></div>`;
    const p = SURVEY_COVERS[c]; if(!p || !p.bg) return '';
    return `<div class="ps-cover" style="background:${p.bg};"><span>${p.icon}</span></div>`;
  }
  function surveyAppRoot(){ return root; }
  function surveyResultUrl(sid, rid, token){ return `${surveyLinkBase()}${encodeURIComponent(sid)}/ketqua/${encodeURIComponent(rid)}/${encodeURIComponent(token)}`; }
  function surveyLinkify(t){ return escapeHtml(t||'').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br>'); }
  function surveyRememberResult(survey, entry){
    try{ const k = 'hnd_sv_results'; const arr = JSON.parse(localStorage.getItem(k)||'[]'); arr.unshift({ sid:survey.id, title:surveyFullName(survey), rid:entry.id, token:entry.resultToken, at:entry.submittedAt }); localStorage.setItem(k, JSON.stringify(arr.slice(0,50))); }catch(e){}
  }
  // Kết quả bài làm cho NGƯỜI LÀM BÀI — hiện theo đúng cài đặt "Người làm bài được xem" của biểu mẫu.
  function surveyResultHtml(survey, r){
    const G = surveyGradeResponse(survey, r);
    const showMissed = survey.quizShowMissed!==false, showCorrect = survey.quizShowCorrect!==false, showPts = survey.quizShowPoints!==false;
    const detail = (survey.questions||[]).map((q,qi)=>{
      const g = G.per[q.id], v = r.answers? r.answers[q.id] : null, key = surveyKeyText(q);
      const ans = q.type==='file'? (surveyFileList(v).map(f=> escapeHtml(f.name)).join(', ') || '(không trả lời)') : escapeHtml(surveyAnswerText(v, q) || '(không trả lời)');
      const graded = g.status!=='none';
      const fbQ = !graded? '' : g.status==='correct'? q.feedbackCorrect : g.status==='pending'? '' : (surveyIsManualType(q)? q.feedbackGeneral : q.feedbackWrong);
      const cls = graded && showMissed && g.status!=='pending'? g.status : '';
      return `<div class="sv-result-q ${cls}">
        <div style="display:flex; justify-content:space-between; gap:8px; font-weight:700;"><span>${qi+1}. ${escapeHtml(q.text)}</span>${graded && showPts? `<span style="white-space:nowrap;">${g.status==='pending'? '⏳' : surveyFmtNum(g.points)}/${surveyFmtNum(g.max)} điểm</span>` : ''}</div>
        <div style="margin:4px 0;">Câu trả lời của ${surveyAddress(survey)}: <b>${ans}</b> ${graded && showMissed? `<span class="sv-grade-chip ${g.status}">${SURVEY_GRADE_ICON[g.status]} ${SURVEY_GRADE_LABEL[g.status]}</span>` : ''}</div>
        ${graded && showCorrect && key && g.status!=='correct'? `<div class="sub">Đáp án đúng: <b>${escapeHtml(key)}</b></div>` : ''}
        ${fbQ? `<div class="sub" style="margin-top:4px;">💬 ${surveyLinkify(fbQ)}</div>` : ''}
        ${g.feedback? `<div class="sub" style="margin-top:4px;">✍️ Nhận xét của người chấm: ${surveyLinkify(g.feedback)}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="sv-result">
      <div style="text-align:center; margin:6px 0 12px;"><div class="sub">Điểm của ${surveyAddress(survey)}</div><div style="font-size:34px; font-weight:800; color:#1b5e20;">${surveyFmtNum(G.score)} / ${surveyFmtNum(G.max)}</div>
        ${G.pending? `<div class="sub" style="color:#0d47a1;">⏳ Còn ${G.pending} câu đang chờ chấm tay — điểm có thể thay đổi.</div>` : ''}</div>
      ${(showMissed || showCorrect || showPts)? detail : ''}
    </div>`;
  }
  // Trang "Xem lại bài làm và điểm": #/khaosat/{biểu mẫu}/ketqua/{phiếu}/{mã bí mật}
  async function renderSurveyResultPage(sid, rid, token){
    document.body.classList.add('public-survey-mode');
    const card = (inner, w)=> `<div class="center-screen"><div class="auth-card" style="max-width:${w||560}px; text-align:left;">${inner}</div></div>`;
    root.innerHTML = card('<h1>Đang tải bài làm…</h1>');
    let survey = null, r = null;
    try{
      const [s1, s2] = await Promise.all([ rtdb.ref(`surveys/${sid}`).get(), rtdb.ref(`survey_responses/${sid}/${rid}`).get() ]);
      survey = s1 && s1.exists()? s1.val() : null; r = s2 && s2.exists()? s2.val() : null;
    }catch(e){ console.error('[Khảo sát] Không tải được bài làm:', e); root.innerHTML = card('<div class="rice-badge">⚠️</div><h1>Không tải được bài làm</h1><p class="sub">Vui lòng kiểm tra kết nối mạng rồi tải lại trang.</p>'); return; }
    if(!survey || survey.deleted || !r || !r.resultToken || r.resultToken!==token){ root.innerHTML = card('<div class="rice-badge">🔎</div><h1>Không tìm thấy bài làm</h1><p class="sub">Đường link không đúng, hoặc bài làm đã bị xoá.</p>'); return; }
    ensureSurveySections(survey);
    try{ document.title = surveyFullName(survey); }catch(e){}
    const head = `<h1>${escapeHtml(surveyFullName(survey))}</h1><p class="sub">Nộp lúc ${escapeHtml(new Date(r.submittedAt).toLocaleString('vi-VN'))}${r.respondentName? ' — '+escapeHtml(r.respondentName) : ''}</p>`;
    if(!survey.isQuiz){ root.innerHTML = card(head + `<div class="panel"><div class="panel-body">${(survey.questions||[]).map((q,qi)=>`<div class="kv-row"><span>${qi+1}. ${escapeHtml(q.text)}</span><b>${escapeHtml(surveyAnswerText(r.answers && r.answers[q.id], q)||'(không trả lời)')}</b></div>`).join('')}</div></div>`); return; }
    if(survey.quizRelease==='manual' && !r.released){ root.innerHTML = card(head + '<div class="rice-badge">⏳</div><p style="font-weight:700;">Bài làm của '+surveyAddress(survey)+' đang chờ chấm.</p><p class="sub">Khi người tạo bài kiểm tra công bố điểm, '+surveyAddress(survey)+' mở lại đúng đường link này để xem điểm.</p>'); return; }
    root.innerHTML = card(head + surveyResultHtml(survey, r), 680);
  }
  function renderPublicSurveyPage(surveyId, opts){
    // opts.preview = true: "Xem thử" ngay trong trình soạn — dùng bản nháp, KHÔNG đọc/ghi máy chủ, vẽ vào opts.container.
    const PREVIEW = !!(opts && opts.preview);
    const root = (opts && opts.container) || surveyAppRoot();
    const rm = PREVIEW? null : String(surveyId||'').match(/^([^/]+)\/ketqua\/([^/]+)\/([^/]+)$/);
    if(rm) return renderSurveyResultPage(decodeURIComponent(rm[1]), decodeURIComponent(rm[2]), decodeURIComponent(rm[3]));
    if(!PREVIEW) document.body.classList.add('public-survey-mode');
    root.innerHTML = '<div class="center-screen">Đang tải biểu mẫu…</div>';
    let survey = null, submitted = false, lastResult = null;
    let sectionHistory = []; // các phần đã đi qua — để nút "◀ Quay lại" về đúng phần trước (kể cả khi có rẽ nhánh)
    let surveyLoadState = 'loading';
    let surveyLoadError = '';
    let closedReason = null;
    let respondentName = '';
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
      submitted = false; lastResult = null; currentSectionIdx = 0; sectionHistory = [];
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
      else if(q.type==='date') field = `<input type="date" class="ps-answer" data-qid="${q.id}" data-type="date" value="${escapeHtml(prevVal||'')}" style="max-width:230px;">`;
      else if(q.type==='time') field = `<input type="time" class="ps-answer" data-qid="${q.id}" data-type="time" value="${escapeHtml(prevVal||'')}" style="max-width:170px;">`;
      else if(q.type==='scale'){
        field = `<div class="ps-scale">${q.scaleMinLabel? `<div class="ps-scale-end">${escapeHtml(q.scaleMinLabel)}</div>` : ''}<div class="ps-scale-opts">${surveyScaleValues(q).map(v=>`<label class="ps-scale-opt"><span>${v}</span><input type="radio" name="ps-q-${q.id}" class="ps-answer" data-qid="${q.id}" data-type="scale" value="${v}" ${String(prevVal)===v?'checked':''}></label>`).join('')}</div>${q.scaleMaxLabel? `<div class="ps-scale-end">${escapeHtml(q.scaleMaxLabel)}</div>` : ''}</div>`;
      }
      else if(surveyIsGrid(q)){
        const isChk = q.type==='grid_checkbox';
        field = `<div class="ps-grid-wrap"><table class="ps-grid"><thead><tr><th></th>${(q.cols||[]).map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${(q.rows||[]).map((rw,i)=>`<tr><th>${escapeHtml(rw)}</th>${(q.cols||[]).map(c=>{ const cur = surveyGridCell(prevVal, i); const on = isChk? (Array.isArray(cur) && cur.includes(c)) : cur===c; return `<td><label class="ps-grid-cell" title="${escapeHtml(rw)} · ${escapeHtml(c)}"><input type="${isChk?'checkbox':'radio'}" ${isChk? '' : `name="ps-g-${q.id}-${i}"`} class="ps-grid-in" data-qid="${q.id}" data-row="${i}" value="${escapeHtml(c)}" ${on?'checked':''}></label></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>${isChk? '' : ''}`;
      }
      else if(q.type==='file'){
        const kind = SURVEY_FILE_KINDS[q.fileKind] || SURVEY_FILE_KINDS.any;
        const cam = q.fileKind==='image' && q.cameraOnly;
        field = `<div class="ps-file" data-qid="${q.id}"><input type="file" class="ps-file-in" data-qid="${q.id}" ${(+q.maxFiles||1)>1 && !cam? 'multiple' : ''} ${kind.accept? `accept="${kind.accept}"` : ''} ${cam? 'capture="environment"' : ''} style="display:none;">
          <button type="button" class="btn btn-ghost ps-file-btn" data-qid="${q.id}">${cam? '📷 Chụp ảnh' : '📎 Chọn tệp để tải lên'}</button>
          <div class="sub" style="margin-top:4px;">Tối đa ${+q.maxFiles||1} ${cam? 'ảnh' : 'tệp'}, mỗi ${cam? 'ảnh' : 'tệp'} không quá ${+q.maxSizeMb||10} MB${q.fileKind && q.fileKind!=='any'? ' · '+kind.label : ''}${cam? ' · chụp trực tiếp bằng camera' : ''}.</div>
          <div class="ps-file-list" data-qid="${q.id}"></div></div>`;
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
        root.innerHTML = `<div class="center-screen"><div class="auth-card" style="max-width:520px;"><div class="rice-badge">⛔</div><h1>${escapeHtml(surveyFullName(survey))}</h1><p style="font-weight:700; color:#b71c1c;">Biểu mẫu này đã ngừng nhận câu trả lời.</p><p class="sub">${why}</p>${survey.closedMessage? `<p style="white-space:pre-wrap; margin-top:10px;">${escapeHtml(survey.closedMessage)}</p>` : ''}</div></div>`;
        return;
      }
      if(surveyLoadState==='needLogin'){
        root.innerHTML = `<div class="center-screen"><div class="auth-card" style="max-width:520px;"><div class="rice-badge">🔒</div><h1>${escapeHtml(surveyFullName(survey))}</h1><p class="sub">Biểu mẫu này yêu cầu đăng nhập bằng tài khoản Google để điền phiếu (mỗi tài khoản được trả lời ${(parseInt(survey.perPersonLimit,10)||0)>0? 'tối đa '+parseInt(survey.perPersonLimit,10)+' lần' : 'nhiều lần'}).</p><button class="btn btn-primary btn-block" id="ps-login-btn" style="margin-top:14px;">🔒 Đăng nhập Google để điền phiếu</button></div></div>`;
        document.getElementById('ps-login-btn').onclick = async ()=>{
          const b = document.getElementById('ps-login-btn'); b.disabled = true; b.textContent = 'Đang mở cửa sổ đăng nhập Google…';
          try{ await auth.signInWithPopup(googleProvider); loadSurvey(); }
          catch(e){ console.error('[Khảo sát công khai] Đăng nhập lỗi:', e); if(!(e && e.code==='auth/popup-closed-by-user')) alert('Đăng nhập Google thất bại. Vui lòng thử lại.'); b.disabled = false; b.textContent = '🔒 Đăng nhập Google để điền phiếu'; }
        };
        return;
      }
      if(surveyLoadState==='limit'){
        root.innerHTML = `<div class="center-screen"><div class="auth-card" style="max-width:520px;"><div class="rice-badge">✋</div><h1>${escapeHtml(surveyFullName(survey))}</h1><p style="font-weight:700;">${surveyAddress(survey,true)} đã trả lời ${respondent.count}/${respondent.limit} lần cho biểu mẫu này, không thể gửi thêm.</p>${respondent.email? `<p class="sub">Tài khoản: ${escapeHtml(respondent.email)}</p>` : ''}<p class="sub">Cảm ơn ${surveyAddress(survey)} đã ${surveyKindAct(survey)}.</p></div></div>`;
        return;
      }
      if(submitted){
        const left = respondent.limit>0? respondent.limit - respondent.count : Infinity;
        const canMore = left>0 && (PREVIEW || surveyAcceptState(survey).open) && survey.allowAnother!==false;
        root.innerHTML = `
          <div class="center-screen"><div class="auth-card ps-card" style="max-width:${survey.isQuiz? 680 : 520}px; --ps-accent:${surveyAccent(survey)};">
            ${surveyCoverHtml(survey)}
            <div class="rice-badge">✅</div>
            <h1>${surveyAddress(survey,true)} đã ${surveyKindDone(survey)} thành công!</h1>
            ${survey.thanksMessage? `<p style="white-space:pre-wrap;">${surveyLinkify(survey.thanksMessage)}</p>` : `<p class="sub">Cảm ơn ${surveyAddress(survey)} đã ${surveyKindAct(survey)} — <b>${escapeHtml(surveyFullName(survey))}</b>.</p>`}
            ${PREVIEW? '<p class="ps-preview-note">👁️ Đây là bản xem thử — phiếu KHÔNG được gửi đi.</p>' : ''}
            ${survey.isQuiz? (()=>{ if(PREVIEW) return surveyResultHtml(survey, lastResult); const url = surveyResultUrl(survey.id, lastResult.id, lastResult.resultToken);
              const linkBox = `<div class="ps-meta" style="margin-top:12px;"><div>🔖 Mã bài làm: <b>${escapeHtml(lastResult.id)}</b></div><div style="word-break:break-all;">🔗 <a href="${escapeHtml(url)}" target="_blank" rel="noopener">Link xem lại bài làm và điểm</a></div><button type="button" class="btn btn-ghost btn-sm" id="ps-copy-result" style="margin-top:6px;">📋 Sao chép link</button><div class="sub" style="margin-top:4px;">${surveyAddress(survey,true)} nên lưu lại link này${survey.quizRelease==='manual'? ' — khi người tạo công bố điểm, mở link để xem điểm' : ''}.</div></div>`;
              return survey.quizRelease==='manual'? `<p style="font-weight:700; margin-top:12px;">⏳ Bài làm đang chờ chấm. ${surveyAddress(survey,true)} sẽ xem được điểm sau khi người tạo công bố.</p>${linkBox}` : `${surveyResultHtml(survey, lastResult)}${linkBox}`; })() : ''}
            ${canMore? `<button class="btn btn-ghost btn-block" id="ps-another-btn" style="margin-top:10px;">📝 Gửi thêm câu trả lời khác${left!==Infinity? ` (còn ${left} lượt)` : ''}</button>` : ''}
          </div></div>`;
        const anotherBtn = document.getElementById('ps-another-btn'); if(anotherBtn) anotherBtn.onclick = resetForAnotherResponse;
        const cp = document.getElementById('ps-copy-result'); if(cp) cp.onclick = ()=> copyMessageText(surveyResultUrl(survey.id, lastResult.id, lastResult.resultToken));
        return;
      }
      const sections = survey.sections;
      const sec = sections[currentSectionIdx] || sections[0];
      const secQuestions = (survey.questions||[]).filter(q=>q.sectionId===sec.id);
      const isLastSection = currentSectionIdx >= sections.length-1;
      const progress = sections.length>1? Math.round((currentSectionIdx+1)/sections.length*100) : 0;
      root.innerHTML = `
        <div class="center-screen">
          <div class="auth-card ps-card" style="max-width:640px; text-align:left; --ps-accent:${surveyAccent(survey)};">
            ${surveyCoverHtml(survey)}
            ${PREVIEW? '<p class="ps-preview-note">👁️ Bản xem thử — đúng như người trả lời sẽ thấy; phiếu điền ở đây KHÔNG được gửi đi.</p>' : ''}
            <h1>${escapeHtml(surveyFullName(survey))}</h1>
            ${(survey.closeAt || respondent.limit>0 || respondent.email)? `<div class="ps-meta">${survey.closeAt? `<div>⏰ Hạn nộp: <b>${escapeHtml(surveyFmtDateTime(survey.closeAt))}</b></div>` : ''}${respondent.limit>0? `<div>📝 Đây là lần trả lời thứ <b>${respondent.count+1}/${respondent.limit}</b> của ${surveyAddress(survey)}.</div>` : ''}${respondent.email? `<div>👤 Đang điền với tài khoản <b>${escapeHtml(respondent.email)}</b> · <a href="#" id="ps-switch-acc">Đổi tài khoản</a></div>` : ''}</div>` : ''}
            ${survey.description? `<p class="sub" style="white-space:pre-wrap;">${escapeHtml(survey.description)}</p>` : ''}
            ${sections.length>1? `<div class="ps-progress"><div class="ps-progress-top"><b>Phần ${currentSectionIdx+1}/${sections.length}</b>${sec.title? ' — '+escapeHtml(sec.title) : ''}<span>${progress}%</span></div><div class="ps-progress-track"><div class="ps-progress-fill" style="width:${progress}%;"></div></div>${sec.description? `<div class="sub" style="margin-top:6px; white-space:pre-wrap;">${escapeHtml(sec.description)}</div>` : ''}</div>` : ''}
            ${survey.collectName && currentSectionIdx===0? `<div class="field full" style="margin-bottom:18px;"><label>Họ và tên <span style="color:var(--red);">*</span></label><input id="ps-name" value="${escapeHtml(respondentName)}" placeholder="Nhập đầy đủ họ và tên" autocomplete="name"></div>` : ''}
            <div id="ps-questions">${secQuestions.map((q,qi)=> renderPublicQuestionHtml(q, qi)).join('')}</div>
            <div class="ps-nav">${sectionHistory.length? '<button class="btn btn-ghost" id="ps-back-btn" type="button">◀ Quay lại</button>' : ''}<button class="btn btn-primary" id="ps-next-btn" style="flex:1;">${isLastSection? surveyKindBtn(survey) : 'TIẾP ▶'}</button></div>
            ${survey.wardName? `<p class="sub" style="text-align:center; margin-top:14px;">Biểu mẫu bởi Hội Nông dân ${escapeHtml(survey.wardName)}</p>` : ''}
          </div>
        </div>`;
      root.querySelectorAll('[data-numeric="1"]').forEach(inp=> attachPublicNumericMask(inp));
      wirePublicOptionTools(root, secQuestions);
      wirePublicDropdowns(root, secQuestions);
      wirePublicFiles(root, secQuestions);
      const back = document.getElementById('ps-back-btn');
      if(back) back.onclick = ()=>{
        // ghi tạm câu trả lời của phần đang điền (không kiểm tra bắt buộc) rồi quay về phần trước
        secQuestions.forEach(q=>{ const v = readPublicAnswer(q); if(v!==undefined) collected[q.id] = v; });
        currentSectionIdx = sectionHistory.pop(); renderFillForm(); window.scrollTo(0,0);
      };
      const sw = document.getElementById('ps-switch-acc');
      if(sw) sw.onclick = async (e)=>{ e.preventDefault(); try{ await auth.signOut(); }catch(err){} loadSurvey(); };

      document.getElementById('ps-next-btn').onclick = async ()=>{
        let missingRequired = false;
        let branchTarget = null; // '__next__' | '__submit__' | sectionId | null (không có phân nhánh)
        secQuestions.forEach(q=>{
          const isNumeric = (q.type==='short' || q.type==='paragraph') && q.numericOnly;
          let val = readPublicAnswer(q);
          if(val===undefined) val = '';
          collected[q.id] = val;
          if(q.required){
            if(surveyIsGrid(q)){ if((q.rows||[]).some((_,i)=>{ const c = val[i]; return Array.isArray(c)? !c.length : !c; })) missingRequired = true; }
            else if(!surveyHasAnswer(q, val)) missingRequired = true;
          }
          if(branchTarget===null && (q.type==='radio'||q.type==='checkbox'||q.type==='dropdown') && q.branchEnabled!==false && q.optionBranches && q.optionBranches.length){
            const selectedOpts = Array.isArray(val) ? val : (val? [val] : []);
            for(const so of selectedOpts){
              const oi = (q.options||[]).indexOf(so);
              if(oi>=0 && q.optionBranches[oi] && q.optionBranches[oi]!=='__next__'){ branchTarget = q.optionBranches[oi]; break; }
            }
          }
        });
        const nameInp = document.getElementById('ps-name');
        if(nameInp){ respondentName = nameInp.value.trim().replace(/\s+/g,' '); if(!respondentName){ alert('Vui lòng nhập Họ và tên.'); nameInp.focus(); return; } }
        if(uploadingNow>0){ alert('Tệp đang được tải lên, vui lòng chờ tải xong rồi bấm lại.'); return; }
        if(missingRequired){ alert('Vui lòng điền đầy đủ các câu hỏi bắt buộc (có dấu *) trước khi tiếp tục.'); return; }

        if((isLastSection || branchTarget==='__submit__') && PREVIEW){
          const entry = { id:'xem-thu', submittedAt:new Date().toISOString(), answers: JSON.parse(JSON.stringify(collected)), resultToken:'' };
          submitted = true; lastResult = entry; renderFillForm(); return;
        }
        if(isLastSection || branchTarget==='__submit__'){
          // Kiểm tra lại NGAY LÚC GỬI: biểu mẫu có thể vừa bị đóng / hết hạn / đủ phiếu trong lúc đang điền,
          // hoặc người này vừa dùng hết lượt ở tab khác.
          try{
            const fresh = await rtdb.ref(`surveys/${survey.id}`).get();
            const fv = (fresh && fresh.exists())? fresh.val() : null;
            if(fv){ ['acceptResponses','closeAt','maxResponses','responseCount','closedMessage'].forEach(k=>{ survey[k] = fv[k]; }); }
          }catch(e){ console.warn('[Khảo sát công khai] Không kiểm tra lại được trạng thái biểu mẫu:', e); }
          const st = surveyAcceptState(survey);
          if(!st.open){ surveyLoadState = 'closed'; closedReason = st.reason; renderFillForm(); alert('Rất tiếc, biểu mẫu vừa ngừng nhận câu trả lời nên phiếu của '+surveyAddress(survey)+' chưa được gửi.'); return; }
          if(respondent.key && respondent.limit>0){
            respondent.count = await surveyRespondentCount(survey.id, respondent.key);
            if(respondent.count>=respondent.limit){ surveyLoadState = 'limit'; renderFillForm(); return; }
          }
          const result = await submitPublicSurveyResponse(survey, collected, { respondentKey: respondent.key, attempt: respondent.count+1, email: respondent.email, name: survey.collectName? respondentName : '' });
          if(!result.ok){
            alert(result.reason==='missing' ? 'Vui lòng điền đầy đủ các câu hỏi bắt buộc (có dấu *) trước khi gửi.' : 'Gửi câu trả lời thất bại, vui lòng kiểm tra kết nối mạng và thử lại.');
            return;
          }
          submitted = true; lastResult = result.entry;
          surveyRememberResult(survey, result.entry);
          if(respondent.key) respondent.count += 1;
          survey.responseCount = (survey.responseCount||0) + 1;
          renderFillForm();
          return;
        }
        sectionHistory.push(currentSectionIdx);
        window.scrollTo(0,0);
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
    function readPublicAnswer(q){
      const isNumeric = (q.type==='short' || q.type==='paragraph') && q.numericOnly;
      if(q.type==='checkbox') return Array.from(root.querySelectorAll(`.ps-answer[data-qid="${q.id}"]:checked`)).map(x=>x.value);
      if(q.type==='radio' || q.type==='scale'){ const x = root.querySelector(`.ps-answer[data-qid="${q.id}"]:checked`); return x? x.value : ''; }
      if(surveyIsGrid(q)) return (q.rows||[]).map((_,i)=> q.type==='grid_checkbox'? Array.from(root.querySelectorAll(`.ps-grid-in[data-qid="${q.id}"][data-row="${i}"]:checked`)).map(x=>x.value) : ((root.querySelector(`.ps-grid-in[data-qid="${q.id}"][data-row="${i}"]:checked`)||{}).value||''));
      if(q.type==='file') return surveyFileList(collected[q.id]);
      const x = root.querySelector(`.ps-answer[data-qid="${q.id}"]`); if(!x) return undefined;
      let v = x.value.trim(); if(isNumeric) v = v.replace(/\s/g,''); return v;
    }
    // Câu "Tải tệp lên": chọn tệp -> kiểm tra số lượng/dung lượng/loại -> tải ngay lên Firebase Storage
    // (có % tiến độ) -> lưu {name,url,size,path} vào câu trả lời; có nút ✕ để bỏ tệp đã tải.
    let uploadingNow = 0;
    function wirePublicFiles(root, qs){
      qs.filter(q=> q.type==='file').forEach(q=>{
        const box = root.querySelector(`.ps-file[data-qid="${q.id}"]`); if(!box) return;
        const input = box.querySelector('.ps-file-in'), btn = box.querySelector('.ps-file-btn'), listEl = box.querySelector('.ps-file-list');
        const maxFiles = +q.maxFiles||1, maxBytes = (+q.maxSizeMb||10)*1024*1024;
        const kind = q.fileKind||'any';
        const okKind = f=>{ const n = (f.name||'').toLowerCase(), t = f.type||'';
          if(kind==='image') return t.startsWith('image/');
          if(kind==='pdf') return t==='application/pdf' || n.endsWith('.pdf');
          if(kind==='doc') return /\.(pdf|docx?|xlsx?)$/.test(n);
          return true; };
        const paint = ()=>{
          const files = surveyFileList(collected[q.id]);
          listEl.innerHTML = files.map((f,i)=>`<div class="ps-file-item">${surveyIsImageFile(f)? `<img class="sv-thumb sm" src="${escapeHtml(f.url)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}<a href="${escapeHtml(f.url)}" target="_blank" rel="noopener">📎 ${escapeHtml(f.name)}</a> <span class="sub">(${f.size>=1048576? (f.size/1048576).toFixed(1).replace('.',',')+' MB' : Math.max(1, Math.round(f.size/1024))+' KB'})</span><button type="button" class="ps-file-rm" data-i="${i}" title="Bỏ tệp này">✕</button></div>`).join('') + (box.__progress? `<div class="sub">${box.__progress}</div>` : '');
          btn.disabled = files.length>=maxFiles || uploadingNow>0;
          btn.textContent = files.length>=maxFiles? `Đã đủ ${maxFiles} tệp` : (q.fileKind==='image' && q.cameraOnly? '📷 Chụp ảnh' : '📎 Chọn tệp để tải lên');
          listEl.querySelectorAll('.ps-file-rm').forEach(b=> b.onclick = ()=>{
            const arr = surveyFileList(collected[q.id]); const [rm] = arr.splice(+b.dataset.i, 1); collected[q.id] = arr;
            if(rm && rm.path && typeof storage!=='undefined'){ try{ storage.ref(rm.path).delete().catch(()=>{}); }catch(e){} }
            paint();
          });
        };
        btn.onclick = ()=> input.click();
        input.onchange = async ()=>{
          const picked = Array.from(input.files||[]); input.value = '';
          if(PREVIEW){ alert('Bản xem thử không tải tệp lên thật. Người trả lời sẽ chọn tệp ở đây.'); return; }
          const have = surveyFileList(collected[q.id]);
          if(have.length + picked.length > maxFiles){ alert(`Câu này chỉ nhận tối đa ${maxFiles} tệp.`); return; }
          const bad = picked.find(f=> !okKind(f)); if(bad){ alert(`Tệp "${bad.name}" không đúng loại cho phép (${(SURVEY_FILE_KINDS[kind]||SURVEY_FILE_KINDS.any).label}).`); return; }
          const big = picked.find(f=> f.size > maxBytes); if(big){ alert(`Tệp "${big.name}" lớn hơn ${+q.maxSizeMb||10} MB, không tải lên được.`); return; }
          for(const f of picked){
            uploadingNow++;
            const safe = (f.name||'tep').replace(/[^\w.\-À-ỹ ]/g,'_').slice(-80);
            const path = `survey_uploads/${survey.id}/${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}_${safe}`;
            try{
              const ref = storage.ref(path);
              const task = ref.put(f);
              if(task && task.on) task.on('state_changed', snap=>{ if(snap && snap.totalBytes){ box.__progress = `⏳ Đang tải "${f.name}"… ${Math.round(snap.bytesTransferred/snap.totalBytes*100)}%`; paint(); } });
              await task;
              const url = await ref.getDownloadURL();
              collected[q.id] = surveyFileList(collected[q.id]).concat([{ name:f.name, size:f.size, type:f.type||'', path, url }]);
            }catch(e){
              console.error('[Khảo sát công khai] Tải tệp lỗi:', e);
              alert(`Không tải được tệp "${f.name}".` + (e && /unauthorized|permission/i.test(String(e.code||e.message))? ' Máy chủ chưa cho phép tải tệp lên biểu mẫu này — vui lòng báo cho người tạo biểu mẫu.' : ' Vui lòng kiểm tra kết nối mạng rồi thử lại.'));
            }
            uploadingNow--; box.__progress = ''; paint();
          }
        };
        paint();
      });
    }
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
      if(PREVIEW){
        survey = ensureSurveySections(JSON.parse(JSON.stringify(opts.survey)));
        respondent = { key:null, email:null, count:0, limit:0 };
        surveyLoadState = 'ready'; renderFillForm(); return;
      }
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
          try{ document.title = surveyFullName(survey); }catch(e){}
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
