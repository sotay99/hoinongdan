  // =====================================================================
  // MODULE "LỊCH CÔNG TÁC" — AI đọc lịch chung của cơ quan (Word/Excel/PDF/ảnh), tách riêng phần việc
  // của từng người dùng theo CHỨC VỤ đã khai báo, dựng bảng lịch riêng, báo trùng lịch, thống kê.
  //
  // Dữ liệu RIÊNG TƯ theo tài khoản Google: users/{emailKey}/schedule/{people|events|types|training|prefs}
  // (cùng gốc `users/{emailKey}` với Sổ Thu-Chi nội bộ). Chưa đăng nhập Google thì không dùng được.
  //
  // Phân vai: AI chỉ BÓC TÁCH sự kiện + KẾT LUẬN "có/không rõ/không" kèm lý do; TRÙNG LỊCH do code tính
  // từ giờ đã bóc tách (không nhờ AI tô màu vì AI hay sai).
  // =====================================================================
  const SCHED_MAX_NAME_LEN = 60, SCHED_MAX_POSITIONS = 40, SCHED_MAX_POS_LEN = 200;
  const SCHED_MAX_TRAIN = 30, SCHED_MAX_TRAIN_LEN = 500;
  const SCHED_MAX_TYPES = 20, SCHED_MAX_TYPE_LEN = 40;
  const SCHED_OTHER_TYPE_ID = 'khac';
  const SCHED_SESSION_LABEL = { sang:'Sáng', chieu:'Chiều', toi:'Tối', cangay:'Cả ngày' };
  const SCHED_STATUS_LABEL = { normal:'Bình thường', added:'BỔ SUNG', postponed:'HOÃN', cancelled:'HỦY' };
  const SCHED_WEEKDAYS = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  const SCHED_XLSX_STYLE_URL = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';

  function schedDefaultTypes(){
    return [
      {id:'hop', name:'Cuộc họp'}, {id:'hoinghi', name:'Hội nghị'}, {id:'taphuan', name:'Tập huấn/Hội thảo'},
      {id:'tcd', name:'Tiếp công dân'}, {id:'cososkhaosat', name:'Đi cơ sở/Khảo sát'}, {id:'lesukien', name:'Lễ/Sự kiện'},
      {id:'truc', name:'Trực'}, {id:SCHED_OTHER_TYPE_ID, name:'Khác', fixed:true},
    ];
  }
  function schedUid(prefix){ return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); }
  function schedKey(){ return hasAuthenticatedIdentity()? emailToKey(state.identity.email.toLowerCase().trim()) : null; }
  function schedState(){
    if(!state._sched) state._sched = { key:null, loaded:false, loading:false, people:[], events:[], types:schedDefaultTypes(), training:[], prefs:{cols:{}} };
    return state._sched;
  }
  function schedContentEl(){ return document.getElementById('content'); }
  function schedRerender(){ const el = schedContentEl(); if(el && state.activeTab==='schedule') renderScheduleTab(el); }

  // ---------- Tải/lưu Firebase ----------
  async function schedLoad(){
    const S = schedState(); const key = schedKey();
    if(!key) return;
    if(S.key!==key){ Object.assign(S, { key, loaded:false, people:[], events:[], types:schedDefaultTypes(), training:[], prefs:{cols:{}} }); }
    if(S.loaded || S.loading) return;
    S.loading = true;
    try{
      const snap = await rtdb.ref(`users/${key}/schedule`).once('value');
      const v = snap.val() || {};
      S.people = Object.values(v.people||{}).filter(Boolean);
      S.events = Object.values(v.events||{}).filter(Boolean);
      const types = Array.isArray(v.types)? v.types.filter(Boolean) : [];
      S.types = types.length? types : schedDefaultTypes();
      if(!S.types.some(t=>t.id===SCHED_OTHER_TYPE_ID)) S.types.push({id:SCHED_OTHER_TYPE_ID, name:'Khác', fixed:true});
      S.types.forEach(t=>{ if(t.id===SCHED_OTHER_TYPE_ID){ t.fixed = true; t.name = 'Khác'; } });
      S.training = Array.isArray(v.training)? v.training.filter(x=>typeof x==='string') : [];
      S.prefs = v.prefs || {cols:{}}; if(!S.prefs.cols) S.prefs.cols = {};
      S.loaded = true;
    }catch(err){
      console.error('[Lịch công tác] Lỗi tải dữ liệu:', err);
      alert('Không tải được dữ liệu Lịch công tác: '+(err&&err.message||err)+'\nNếu lỗi báo "permission denied", cần kiểm tra luật bảo mật Firebase cho đường dẫn users/{email}/schedule.');
    }
    S.loading = false;
  }
  async function schedSave(sub){
    const S = schedState(); const key = schedKey(); if(!key) return;
    let v;
    if(sub==='people'){ v = {}; S.people.forEach(x=>{ v[x.id] = x; }); }
    else if(sub==='events'){ v = {}; S.events.forEach(x=>{ v[x.id] = x; }); }
    else if(sub==='types') v = S.types;
    else if(sub==='training') v = S.training;
    else v = S.prefs;
    const empty = Array.isArray(v)? !v.length : !Object.keys(v).length;
    try{ await rtdb.ref(`users/${key}/schedule/${sub}`).set(empty? null : v); }
    catch(err){ console.error('[Lịch công tác] Lỗi lưu', sub, err); alert('Không lưu được lên đám mây: '+(err&&err.message||err)); }
  }

  // ---------- Ngày/giờ ----------
  function schedIsoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function schedParseIso(iso){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); return m? new Date(+m[1], +m[2]-1, +m[3]) : null; }
  function schedFmtDate(iso){ const d = schedParseIso(iso); return d? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : (iso||''); }
  function schedWeekday(iso){ const d = schedParseIso(iso); return d? SCHED_WEEKDAYS[d.getDay()] : ''; }
  function schedMondayOf(iso){ const d = schedParseIso(iso) || new Date(); const wd = (d.getDay()+6)%7; d.setDate(d.getDate()-wd); return schedIsoDate(d); }
  function schedAddDays(iso, n){ const d = schedParseIso(iso); d.setDate(d.getDate()+n); return schedIsoDate(d); }
  function schedMin(t){ const m = /^(\d{1,2}):(\d{2})$/.exec(t||''); return m? (+m[1])*60+(+m[2]) : null; }
  function schedNormTime(t){ const m = /^(\d{1,2})[:hH](\d{2})?/.exec(String(t||'').trim()); if(!m) return ''; const h = +m[1], mi = m[2]? +m[2] : 0; return (h>23||mi>59)? '' : `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`; }
  function schedNorm(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
  function schedSortEvents(list){
    const order = { sang:1, chieu:2, toi:3, cangay:0 };
    return list.slice().sort((a,b)=> (a.date||'').localeCompare(b.date||'') || ((schedMin(a.start)??(order[a.session]!=null? 600+order[a.session]*5 : 9999)) - (schedMin(b.start)??(order[b.session]!=null? 600+order[b.session]*5 : 9999))));
  }
  function schedTypeName(id){ const t = schedState().types.find(x=>x.id===id); return t? t.name : 'Khác'; }

  // ---------- Trùng lịch (do code tính) ----------
  function schedInterval(e){
    const s = schedMin(e.start); if(s==null) return null;
    let en = schedMin(e.end); if(en==null || en<=s) en = s+120;
    return [s, en];
  }
  function schedConflicts(list){
    const act = list.filter(e=> e.verdict!=='unclear' && (!e.status || e.status==='normal' || e.status==='added'));
    const res = {};
    const label = e=> `${e.start? e.start+' ' : (SCHED_SESSION_LABEL[e.session]? SCHED_SESSION_LABEL[e.session]+' ' : '')}${(e.content||'').slice(0,60)}`;
    const add = (a,b,level)=>{ const r = res[a.id] || (res[a.id] = {level:'near', with:[]}); if(level==='overlap') r.level = 'overlap'; r.with.push(label(b)); };
    const byDate = {}; act.forEach(e=>{ (byDate[e.date] = byDate[e.date] || []).push(e); });
    Object.values(byDate).forEach(day=>{
      for(let i=0;i<day.length;i++) for(let j=i+1;j<day.length;j++){
        const a = day[i], b = day[j];
        if(a.session==='cangay' || b.session==='cangay'){ add(a,b,'overlap'); add(b,a,'overlap'); continue; }
        const ia = schedInterval(a), ib = schedInterval(b);
        if(!ia || !ib) continue;
        if(ia[0]<ib[1] && ib[0]<ia[1]){ add(a,b,'overlap'); add(b,a,'overlap'); continue; }
        const gap = ia[1]<=ib[0]? ib[0]-ia[1] : ia[0]-ib[1];
        if(gap<30 && a.place && b.place && schedNorm(a.place)!==schedNorm(b.place)){ add(a,b,'near'); add(b,a,'near'); }
      }
    });
    return res;
  }

  // ---------- Cột bảng (dùng chung cho bảng trên trang, bảng Excel xem trước, in, xuất file) ----------
  const SCHED_COLS_META = [
    ['when','Ngày giờ',true], ['place','Địa điểm',false], ['content','Nội dung công việc',true], ['participants','Thành phần tham gia',false],
    ['type','Loại sự kiện',false], ['note','Ghi chú',false], ['fullText','Nguyên văn đầy đủ',false],
  ];
  function schedWhenPlain(e){
    const t = e.start? (e.start + (e.end? '-'+e.end : '')) : (SCHED_SESSION_LABEL[e.session]||'');
    return `${schedWeekday(e.date)} ${schedFmtDate(e.date)}${t? ' '+t : ''}`;
  }
  function schedNoteParts(e, conf){
    const parts = [];
    if(conf && conf.level==='overlap') parts.push({ strong:true, color:'#b71c1c', text:`⚠ TRÙNG GIỜ với: ${conf.with.join(' | ')}` });
    else if(conf && conf.level==='near') parts.push({ strong:true, color:'#e65100', text:`⚠ SÁT GIỜ, KHÁC NƠI với: ${conf.with.join(' | ')}` });
    if(e.reason) parts.push({ text:e.reason });
    if(e.note) parts.push({ text:e.note });
    return parts;
  }
  function schedColDefs(prefs, conflicts){
    const showFull = !prefs || !prefs.cols || prefs.cols.fullText!==false;
    const defs = {
      when: { label:'Ngày giờ', align:'center', get:e=> `<b>${escapeHtml(schedWeekday(e.date))}</b><br>${escapeHtml(schedFmtDate(e.date))}<br>${escapeHtml(e.start? e.start+(e.end? '–'+e.end : '') : (SCHED_SESSION_LABEL[e.session]||''))}`, getPlain:schedWhenPlain },
      place: { label:'Địa điểm', align:'center', get:e=> escapeHtml(e.place||''), getPlain:e=> e.place||'' },
      content: { label:'Nội dung công việc', align:'left',
        get:e=>{ const tag = (e.status && e.status!=='normal')? `<b style="color:${e.status==='added'?'#0d47a1':'#757575'};">[${SCHED_STATUS_LABEL[e.status]||''}]</b> ` : ''; const body = escapeHtml(e.content||''); return tag + ((e.status==='postponed'||e.status==='cancelled')? `<s>${body}</s>` : body); },
        getPlain:e=> ((e.status && e.status!=='normal')? `[${SCHED_STATUS_LABEL[e.status]}] ` : '') + (e.content||'') },
      participants: { label:'Thành phần tham gia', align:'left', get:e=> escapeHtml(e.participants||''), getPlain:e=> e.participants||'' },
      type: { label:'Loại sự kiện', align:'center', get:e=> escapeHtml(schedTypeName(e.typeId)), getPlain:e=> schedTypeName(e.typeId) },
      note: { label:'Ghi chú', align:'left',
        get:e=> schedNoteParts(e, (conflicts||{})[e.id]).map(p=> p.strong? `<u><b style="color:${p.color};">${escapeHtml(p.text)}</b></u>` : `<span style="font-size:.92em;">${escapeHtml(p.text)}</span>`).join('<br>'),
        getPlain:e=> schedNoteParts(e, (conflicts||{})[e.id]).map(p=>p.text).join('\n') },
      fullText: { label:'Nguyên văn đầy đủ', align:'left', wrap:true, get:e=> escapeHtml(e.fullText||''), getPlain:e=> e.fullText||'' },
    };
    return SCHED_COLS_META.filter(([k,,fixed])=> fixed || (k==='fullText'? showFull : (!prefs || !prefs.cols || prefs.cols[k]!==false))).map(([k])=> ({ key:k, ...defs[k] }));
  }
  function schedRowBg(conf){ return conf? (conf.level==='overlap'? 'background:#ffcdd2;' : 'background:#fff3e0;') : ''; }
  function schedCellStyle(c){ return `text-align:${c.align}; vertical-align:top; ${c.wrap? 'white-space:normal; word-break:break-word; min-width:240px; max-width:360px;' : (c.key==='content'||c.key==='participants'||c.key==='note'? 'white-space:normal; min-width:200px; max-width:320px;' : 'white-space:nowrap;')}`; }
  function schedTableHtml(cols, list, conflicts, rowActionsFn){
    return `<div class="table-wrap"><table>
      <thead><tr>${rowActionsFn? '<th></th>' : ''}${cols.map(c=>`<th style="text-align:${c.align==='left'?'left':'center'};">${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${list.length? list.map(e=>`<tr style="${schedRowBg(conflicts[e.id])}">${rowActionsFn? `<td style="white-space:nowrap; vertical-align:top;">${rowActionsFn(e)}</td>` : ''}${cols.map(c=>`<td style="${schedCellStyle(c)}">${c.get(e)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length+(rowActionsFn?1:0)}" style="text-align:center; padding:14px;">Không có dữ liệu.</td></tr>`}</tbody>
    </table></div>`;
  }

  // ---------- Đọc tệp đính kèm ----------
  async function schedReadFile(file){
    const ext = (file.name.split('.').pop()||'').toLowerCase();
    const mime = file.type || '';
    if(ext==='docx'){
      await loadOptionalLibrary('mammoth');
      const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return { name:file.name, mimeType:'text/plain', text:(r.value||'').trim() };
    }
    if(ext==='xlsx' || ext==='xls' || ext==='csv'){
      await loadOptionalLibrary('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type:'array' });
      const text = wb.SheetNames.map(n=> `--- Trang tính "${n}" ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n');
      return { name:file.name, mimeType:'text/plain', text };
    }
    if(ext==='txt') return { name:file.name, mimeType:'text/plain', text:(await file.text()).trim() };
    if(ext==='doc'){ alert(`Tệp "${file.name}" là Word đời cũ (.doc), chưa đọc được. Đồng chí mở bằng Word rồi lưu lại thành .docx (hoặc xuất PDF) rồi tải lên nhé.`); return null; }
    if(ext==='pdf' || mime.startsWith('image/')){
      if(file.size > 12*1024*1024){ alert(`Tệp "${file.name}" lớn hơn 12MB, quá lớn để gửi cho AI. Đồng chí nén nhỏ hoặc tách bớt trang rồi tải lại.`); return null; }
      return { name:file.name, mimeType: ext==='pdf'? 'application/pdf' : mime, base64: await fileToBase64(file) };
    }
    alert(`Chưa hỗ trợ định dạng tệp ".${ext}". Dùng Word (.docx), Excel, PDF hoặc ảnh.`);
    return null;
  }

  // ---------- Lệnh hệ thống cho AI ----------
  function schedPersonLine(p){ return `- id="${p.id}" | ${p.name} | chức vụ: ${(p.positions||[]).join('; ')}`; }
  function schedSystemPrompt(people){
    const S = schedState();
    const today = schedIsoDate(new Date());
    const training = (S.training||[]).map(x=>x.trim()).filter(Boolean);
    const saved = schedSortEvents(S.events.filter(e=> people.some(p=>p.id===e.personId))).slice(-120)
      .map(e=> `  ${e.id} | ${e.personId} | ${e.date} ${e.start||''} | ${(e.content||'').slice(0,70)}`).join('\n');
    return `Bạn là trợ lý AI đọc LỊCH CÔNG TÁC của cơ quan nhà nước/cơ quan Đảng/tổ chức chính trị - xã hội cấp xã/phường để lập lịch RIÊNG cho từng người. LUÔN gọi người dùng là "đồng chí". Hôm nay là ${today} (dùng để suy ra năm khi lịch không ghi năm).
NHIỆM VỤ: (1) bóc tách MỌI sự kiện trong tệp/tin nhắn người dùng cung cấp; (2) với từng sự kiện, kết luận từng người trong danh sách bên dưới có tham gia hay không.
DANH SÁCH NGƯỜI CẦN LẬP LỊCH (mỗi người có nhiều chức vụ, thành viên của các ban/hội đồng):
${people.map(schedPersonLine).join('\n')}
QUY TẮC KẾT LUẬN "v" cho từng người:
- "yes" (chắc chắn tham gia): tên đích danh người đó ("Đ/c <tên>"), HOẶC thành phần ghi chức danh/ban/hội đồng/tổ chức/cơ quan khớp RÕ RÀNG với ít nhất 1 chức vụ khai báo (chấp nhận cách viết khác nhau: Đảng ủy = Đảng bộ, BCH = Ban chấp hành, BTV = Ban thường vụ, TT = Thường trực, UBMTTQ = Ủy ban Mặt trận Tổ quốc, "các tổ chức chính trị - xã hội/hội đoàn thể" gồm Hội Nông dân, Hội Phụ nữ, Đoàn Thanh niên, Hội Cựu chiến binh...). "reason" phải nêu rõ khớp với chức vụ nào.
- "unclear" (không rõ): thành phần chỉ viện dẫn văn bản ("theo Quyết định/Công văn/Thông báo số..."), hoặc nêu ban/hội đồng/tổ/ban chỉ đạo KHÔNG có trong danh sách chức vụ nhưng có thể có người đó, hoặc "giao ... mời". "reason" nêu vì sao không chắc.
- "no": thành phần RÕ RÀNG không gồm người đó (chỉ lãnh đạo khác đích danh, "làm việc tại trụ sở" của người khác, ủy quyền cho đơn vị/người khác). Khi lãnh đạo "ủy quyền" cho đơn vị/người khác thì chỉ người được ủy quyền mới tham dự.
- KHÔNG ĐƯỢC bịa giờ, địa điểm, thành phần không có trong tài liệu. Có nghi ngờ thì chọn "unclear" chứ không chọn "yes".
TRƯỜNG DỮ LIỆU MỖI SỰ KIỆN:
- "date" dạng YYYY-MM-DD (năm lấy từ tiêu đề lịch; nếu thứ và ngày trong tệp mâu thuẫn nhau, GIỮ NGÀY ghi trong tệp và nêu mâu thuẫn trong "note").
- "start","end" dạng HH:MM 24 giờ; thiếu thì để "". Nếu chỉ ghi Sáng/Chiều/Tối không có giờ: để start rỗng và đặt "session" ("sang"|"chieu"|"toi"); "cả ngày" -> "session":"cangay". Có giờ thì "session" vẫn điền theo buổi.
- "place": địa điểm đúng như tệp; "content": TÓM TẮT gọn 1-3 dòng, giữ nguyên số hiệu văn bản/tên cuộc họp; "fullText": nguyên văn đoạn liên quan trong tệp (tối đa khoảng 1500 ký tự); "participants": thành phần tham gia NGUYÊN VĂN theo tệp (để "" nếu tệp không ghi); "note": link họp trực tuyến/ID/mật khẩu/nội dung cần chuẩn bị/lưu ý.
- "typeId": CHỈ chọn 1 trong các loại hiện có của người dùng (id | tên):
${schedState().types.map(t=>`  ${t.id} | ${t.name}`).join('\n')}
  Không khớp loại nào thì dùng "${SCHED_OTHER_TYPE_ID}".
- "status": "normal"|"added" (bổ sung)|"postponed" (hoãn)|"cancelled" (hủy). Tệp điều chỉnh/bổ sung/hoãn: gắn đúng trạng thái. Nếu một sự kiện mới thay thế/dời một sự kiện đã lưu trong danh sách "LỊCH ĐÃ LƯU" bên dưới thì điền "replaces" bằng id của sự kiện đã lưu đó (nếu không có thì "").
LỊCH ĐÃ LƯU CỦA NHỮNG NGƯỜI NÀY (id | personId | ngày giờ | nội dung):
${saved || '  (chưa có)'}
${training.length? `HUẤN LUYỆN RIÊNG CỦA NGƯỜI DÙNG (đọc kỹ, ĐƯỢC PHÉP chỉnh cách kết luận "có/không rõ/không" theo các điều này, nhưng KHÔNG được đổi định dạng kết quả, không được bịa dữ liệu không có trong tài liệu):\n${training.map((t,i)=>`${i+1}. ${t}`).join('\n')}` : ''}
CÁCH LÀM VIỆC: người dùng luôn có sẵn 1 "Hồ sơ đang soạn" (bảng sự kiện, có thể đã tự sửa tay). Cuối mỗi tin nhắn bạn nhận đúng nội dung Hồ sơ đang soạn hiện tại — hãy chỉnh sửa trực tiếp lên đó, LUÔN trả về ĐẦY ĐỦ toàn bộ hồ sơ trong khối \`\`\`schedule-result\`\`\`.
CÁCH TRẢ LỜI: trò chuyện tự nhiên trước (không bọc JSON), nêu ngắn gọn số sự kiện đã tách, số mục "không rõ" và mâu thuẫn/lỗi trong tệp nếu có. Nếu đã tách được ít nhất 1 sự kiện, thêm NGAY CUỐI câu trả lời khối mã sau (LUÔN đủ các trường):
\`\`\`schedule-result
{"events":[{"date":"","start":"","end":"","session":"","place":"","content":"","fullText":"","participants":"","typeId":"","status":"normal","replaces":"","note":"","verdicts":{"<personId>":{"v":"yes","reason":""}}}]}
\`\`\`
Chưa đủ dữ liệu thì KHÔNG thêm khối này, chỉ trò chuyện/hỏi lại.`;
  }
  function schedNormalizeEvents(arr, people){
    const S = schedState();
    const typeIds = S.types.map(t=>t.id);
    return (Array.isArray(arr)? arr : []).filter(x=>x && typeof x==='object').map(x=>{
      const verdicts = {};
      people.forEach(p=>{
        const v = (x.verdicts||{})[p.id] || {};
        verdicts[p.id] = { v: ['yes','unclear','no'].includes(v.v)? v.v : 'no', reason: String(v.reason||'') };
      });
      return {
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(x.date||''))? x.date : '', start: schedNormTime(x.start), end: schedNormTime(x.end),
        session: SCHED_SESSION_LABEL[x.session]? x.session : '', place: String(x.place||''), content: String(x.content||''), fullText: String(x.fullText||''),
        participants: String(x.participants||''), typeId: typeIds.includes(x.typeId)? x.typeId : SCHED_OTHER_TYPE_ID,
        status: SCHED_STATUS_LABEL[x.status]? x.status : 'normal', replaces: String(x.replaces||''), note: String(x.note||''), verdicts,
      };
    });
  }
  function schedEmptyDraftEvent(people){
    const verdicts = {}; people.forEach(p=>{ verdicts[p.id] = {v:'yes', reason:''}; });
    return { date:'', start:'', end:'', session:'', place:'', content:'', fullText:'', participants:'', typeId:SCHED_OTHER_TYPE_ID, status:'normal', replaces:'', note:'', verdicts };
  }
  async function schedCommitDraft(draft, people){
    const S = schedState();
    const bad = []; draft.events.forEach((e,i)=>{ if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date||'') || !(e.content||'').trim()) bad.push(i+1); });
    if(bad.length && !confirm(`Có ${bad.length} sự kiện (dòng ${bad.join(', ')}) thiếu Ngày hoặc Nội dung sẽ bị BỎ QUA. Bấm "OK" để lưu những sự kiện còn lại, "Huỷ" để quay lại sửa.`)) return false;
    const keyOf = (pid,e)=> `${pid}|${e.date}|${e.start||''}|${schedNorm(e.content).slice(0,60)}`;
    const existing = {}; S.events.forEach(x=>{ existing[keyOf(x.personId,x)] = x; });
    let count = 0;
    draft.events.forEach((e,i)=>{
      if(bad.includes(i+1)) return;
      people.forEach(p=>{
        const v = (e.verdicts||{})[p.id] || {};
        if(v.v!=='yes' && v.v!=='unclear') return;
        const rec = { id:schedUid('ev'), personId:p.id, date:e.date, start:e.start||'', end:e.end||'', session:e.session||'', place:e.place||'', content:e.content.trim(),
          fullText:e.fullText||'', participants:e.participants||'', typeId:e.typeId||SCHED_OTHER_TYPE_ID, status:e.status||'normal', verdict:v.v, reason:v.reason||'', note:e.note||'', createdAt:new Date().toISOString() };
        const k = keyOf(p.id, rec);
        if(existing[k]){ rec.id = existing[k].id; S.events = S.events.map(x=> x.id===rec.id? rec : x); } else { S.events.push(rec); }
        existing[k] = rec; count++;
        if(e.replaces){ const old = S.events.find(x=> x.id===e.replaces && x.personId===p.id); if(old && old.id!==rec.id && old.status!=='cancelled') old.status = 'postponed'; }
      });
    });
    await schedSave('events');
    showToast(`Đã lưu ${count} mục vào lịch công tác.`);
    return true;
  }

  // ---------- Modal Người dùng ----------
  function schedPersonModal(person, onDone){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let name = person? person.name : '';
    let pos = person? (person.positions||[]).slice() : [''];
    if(!pos.length) pos = [''];
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:640px;">
          <div class="modal-head"><h3>${person? '✏️ Sửa người dùng' : '➕ Thêm người dùng'}</h3><button class="modal-close preview-allow" id="spp-close">✕</button></div>
          <div class="modal-body">
            <div class="field"><label>Họ và tên * <span class="sub">(tối đa ${SCHED_MAX_NAME_LEN} ký tự)</span></label><input id="spp-name" maxlength="${SCHED_MAX_NAME_LEN}" value="${escapeHtml(name)}" placeholder="Vd: Nguyễn Văn A"></div>
            <div class="divider-lbl">Chức vụ được giao, thành viên các ban/hội đồng (${pos.length}/${SCHED_MAX_POSITIONS})</div>
            <p class="sub" style="margin:0 0 8px;">Mỗi ô là 1 chức vụ (tối đa ${SCHED_MAX_POS_LEN} ký tự), cần ít nhất 1 chức vụ. Ghi càng đúng như cách lịch công tác gọi tên càng tốt, VD: "Ủy viên Ban Chấp hành Đảng bộ xã", "Thành viên Hội đồng nghĩa vụ quân sự".</p>
            ${pos.map((v,i)=>`<div style="display:flex; gap:6px; margin-bottom:6px;"><input data-pi="${i}" maxlength="${SCHED_MAX_POS_LEN}" value="${escapeHtml(v)}" placeholder="Chức vụ ${i+1}" style="flex:1;"><button type="button" class="btn btn-ghost btn-sm preview-allow" data-pdel="${i}" title="Xoá chức vụ này">🗑️</button></div>`).join('')}
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="spp-add" ${pos.length>=SCHED_MAX_POSITIONS?'disabled':''}>➕ Thêm chức vụ</button>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="spp-cancel">Đóng (không lưu)</button><button class="btn btn-primary preview-allow" id="spp-save">💾 Lưu</button></div>
        </div>`;
      wrap.querySelector('#spp-close').onclick = close;
      wrap.querySelector('#spp-cancel').onclick = close;
      wrap.querySelector('#spp-name').oninput = (e)=>{ name = e.target.value; };
      wrap.querySelectorAll('[data-pi]').forEach(inp=> inp.oninput = ()=>{ pos[+inp.dataset.pi] = inp.value; });
      wrap.querySelectorAll('[data-pdel]').forEach(b=> b.onclick = ()=>{ const i = +b.dataset.pdel; if(pos.length===1) pos[0] = ''; else pos.splice(i,1); render(); });
      wrap.querySelector('#spp-add').onclick = ()=>{ if(pos.length<SCHED_MAX_POSITIONS){ pos.push(''); render(); const ins = wrap.querySelectorAll('[data-pi]'); if(ins.length) ins[ins.length-1].focus(); } };
      wrap.querySelector('#spp-save').onclick = async ()=>{
        const n = name.trim(); const ps = pos.map(x=>x.trim()).filter(Boolean);
        if(!n){ alert('Vui lòng nhập Họ và tên.'); return; }
        if(!ps.length){ alert('Cần ít nhất 1 chức vụ mới lưu được.'); return; }
        const S = schedState();
        if(person){ person.name = n; person.positions = ps; } else { S.people.push({ id:schedUid('p'), name:n, positions:ps, createdAt:new Date().toISOString() }); }
        await schedSave('people'); close(); if(onDone) onDone();
      };
    }
    render();
  }

  // ---------- Modal Loại sự kiện ----------
  function schedTypesModal(onDone){
    const S = schedState();
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let types = S.types.map(t=>({...t}));
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:560px;">
          <div class="modal-head"><h3>🏷️ Loại sự kiện (${types.length}/${SCHED_MAX_TYPES})</h3><button class="modal-close preview-allow" id="spt-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 8px;">AI chỉ được xếp sự kiện vào các loại ở đây, và Thống kê cũng tính theo danh sách này. Loại "Khác" luôn có sẵn, không sửa/xoá được. Xoá 1 loại thì các sự kiện thuộc loại đó chuyển về "Khác".</p>
            ${types.map((t,i)=>`<div style="display:flex; gap:6px; margin-bottom:6px;"><input data-ti="${i}" maxlength="${SCHED_MAX_TYPE_LEN}" value="${escapeHtml(t.name)}" ${t.fixed?'disabled':''} style="flex:1;">${t.fixed? '<span class="sub" style="align-self:center; width:34px; text-align:center;">🔒</span>' : `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-tdel="${i}" title="Xoá loại này">🗑️</button>`}</div>`).join('')}
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="spt-add" ${types.length>=SCHED_MAX_TYPES?'disabled':''}>➕ Thêm loại</button>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="spt-cancel">Đóng (không lưu)</button><button class="btn btn-primary preview-allow" id="spt-save">💾 Lưu</button></div>
        </div>`;
      wrap.querySelector('#spt-close').onclick = close;
      wrap.querySelector('#spt-cancel').onclick = close;
      wrap.querySelectorAll('[data-ti]').forEach(inp=> inp.oninput = ()=>{ types[+inp.dataset.ti].name = inp.value; });
      wrap.querySelectorAll('[data-tdel]').forEach(b=> b.onclick = ()=>{ types.splice(+b.dataset.tdel,1); render(); });
      wrap.querySelector('#spt-add').onclick = ()=>{ if(types.length<SCHED_MAX_TYPES){ types.splice(types.length-1, 0, { id:schedUid('t'), name:'' }); render(); } };
      wrap.querySelector('#spt-save').onclick = async ()=>{
        const clean = types.map(t=> ({...t, name: t.fixed? 'Khác' : t.name.trim()}));
        if(clean.some(t=>!t.name)){ alert('Tên loại sự kiện không được để trống.'); return; }
        const names = clean.map(t=>schedNorm(t.name));
        if(new Set(names).size!==names.length){ alert('Có 2 loại trùng tên nhau. Vui lòng đổi lại.'); return; }
        const keptIds = new Set(clean.map(t=>t.id));
        const orphans = S.events.filter(e=> !keptIds.has(e.typeId));
        if(orphans.length && !confirm(`Có ${orphans.length} sự kiện thuộc loại bị xoá, sẽ chuyển về loại "Khác". Tiếp tục?`)) return;
        orphans.forEach(e=>{ e.typeId = SCHED_OTHER_TYPE_ID; });
        S.types = clean;
        await schedSave('types'); if(orphans.length) await schedSave('events');
        close(); if(onDone) onDone();
      };
    }
    render();
  }

  // ---------- Modal Huấn luyện AI ----------
  function schedTrainingModal(onDone){
    const S = schedState();
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.zIndex = '99998';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let lines = (S.training||[]).slice(); if(!lines.length) lines = [''];
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:680px;">
          <div class="modal-head"><h3>🧠 Huấn luyện AI (${lines.length}/${SCHED_MAX_TRAIN})</h3><button class="modal-close preview-allow" id="spl-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 8px;">Mỗi ô là 1 câu lệnh riêng của đồng chí (tối đa ${SCHED_MAX_TRAIN_LEN} ký tự, tối đa ${SCHED_MAX_TRAIN} ô). AI đọc toàn bộ trước khi làm việc. Ví dụ: "Ban chỉ đạo 24 có đồng chí Nguyễn Văn A nên luôn tính là tham gia". Áp dụng chung cho mọi người trong danh sách.</p>
            ${lines.map((v,i)=>`<div style="margin-bottom:8px;"><div style="display:flex; gap:6px;"><textarea data-li="${i}" rows="2" maxlength="${SCHED_MAX_TRAIN_LEN}" style="flex:1;" placeholder="Câu lệnh ${i+1}">${escapeHtml(v)}</textarea><button type="button" class="btn btn-ghost btn-sm preview-allow" data-ldel="${i}" title="Xoá ô này">🗑️</button></div><div class="sub" style="text-align:right;" id="spl-cnt-${i}">${v.length}/${SCHED_MAX_TRAIN_LEN}</div></div>`).join('')}
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="spl-add" ${lines.length>=SCHED_MAX_TRAIN?'disabled':''}>➕ Thêm câu lệnh</button>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="spl-cancel">Đóng (không lưu)</button><button class="btn btn-primary preview-allow" id="spl-save">💾 Lưu</button></div>
        </div>`;
      wrap.querySelector('#spl-close').onclick = close;
      wrap.querySelector('#spl-cancel').onclick = close;
      wrap.querySelectorAll('[data-li]').forEach(t=> t.oninput = ()=>{ const i = +t.dataset.li; lines[i] = t.value; const c = wrap.querySelector('#spl-cnt-'+i); if(c) c.textContent = `${t.value.length}/${SCHED_MAX_TRAIN_LEN}`; });
      wrap.querySelectorAll('[data-ldel]').forEach(b=> b.onclick = ()=>{ const i = +b.dataset.ldel; if(lines.length===1) lines[0] = ''; else lines.splice(i,1); render(); });
      wrap.querySelector('#spl-add').onclick = ()=>{ if(lines.length<SCHED_MAX_TRAIN){ lines.push(''); render(); const ts = wrap.querySelectorAll('[data-li]'); if(ts.length) ts[ts.length-1].focus(); } };
      wrap.querySelector('#spl-save').onclick = async ()=>{
        S.training = lines.map(x=>x.trim()).filter(Boolean);
        await schedSave('training'); showToast('Đã lưu huấn luyện AI.'); close(); if(onDone) onDone();
      };
    }
    render();
  }
  async function schedAddTrainingLine(text){
    const S = schedState();
    const t = text.slice(0, SCHED_MAX_TRAIN_LEN);
    if((S.training||[]).length>=SCHED_MAX_TRAIN){ alert(`Đã đủ ${SCHED_MAX_TRAIN} câu lệnh huấn luyện, không thêm được nữa. Vào "Huấn luyện AI" xoá bớt nhé.`); return false; }
    S.training = (S.training||[]).concat([t]);
    await schedSave('training');
    return true;
  }

  // ---------- Modal sửa 1 sự kiện đã lưu ----------
  function schedEventModal(ev, personId, onDone){
    const S = schedState();
    const isNew = !ev;
    const e = ev? {...ev} : { id:schedUid('ev'), personId, date:state._schedWeek||schedIsoDate(new Date()), start:'', end:'', session:'', place:'', content:'', fullText:'', participants:'', typeId:SCHED_OTHER_TYPE_ID, status:'normal', verdict:'yes', reason:'', note:'', createdAt:new Date().toISOString() };
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const opt = (map, cur)=> Object.entries(map).map(([k,v])=>`<option value="${k}" ${cur===k?'selected':''}>${escapeHtml(v)}</option>`).join('');
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:680px;">
        <div class="modal-head"><h3>${isNew? '➕ Thêm sự kiện' : '✏️ Sửa sự kiện'}</h3><button class="modal-close preview-allow" id="sev-close">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field"><label>Ngày *</label><input type="date" id="sev-date" value="${escapeHtml(e.date||'')}"></div>
            <div class="field"><label>Buổi</label><select id="sev-session"><option value="">—</option>${opt(SCHED_SESSION_LABEL, e.session)}</select></div>
            <div class="field"><label>Giờ bắt đầu</label><input type="time" id="sev-start" value="${escapeHtml(e.start||'')}"></div>
            <div class="field"><label>Giờ kết thúc</label><input type="time" id="sev-end" value="${escapeHtml(e.end||'')}"></div>
            <div class="field full"><label>Địa điểm</label><input id="sev-place" value="${escapeHtml(e.place||'')}"></div>
            <div class="field full"><label>Nội dung công việc *</label><textarea id="sev-content" rows="2">${escapeHtml(e.content||'')}</textarea></div>
            <div class="field full"><label>Thành phần tham gia</label><textarea id="sev-part" rows="2">${escapeHtml(e.participants||'')}</textarea></div>
            <div class="field"><label>Loại sự kiện</label><select id="sev-type">${S.types.map(t=>`<option value="${t.id}" ${e.typeId===t.id?'selected':''}>${escapeHtml(t.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Trạng thái</label><select id="sev-status">${opt(SCHED_STATUS_LABEL, e.status||'normal')}</select></div>
            <div class="field"><label>Có tham gia không</label><select id="sev-verdict"><option value="yes" ${e.verdict!=='unclear'?'selected':''}>Chắc chắn tham gia</option><option value="unclear" ${e.verdict==='unclear'?'selected':''}>Không rõ</option></select></div>
            <div class="field full"><label>Ghi chú</label><textarea id="sev-note" rows="2">${escapeHtml(e.note||'')}</textarea></div>
            <div class="field full"><label>Nguyên văn đầy đủ</label><textarea id="sev-full" rows="3">${escapeHtml(e.fullText||'')}</textarea></div>
          </div>
        </div>
        <div class="modal-foot">${!isNew? `<button class="btn btn-danger preview-allow" id="sev-del" style="margin-right:auto;">Xoá</button>` : ''}<button class="btn btn-ghost preview-allow" id="sev-cancel">Đóng (không lưu)</button><button class="btn btn-primary preview-allow" id="sev-save">💾 Lưu</button></div>
      </div>`;
    wrap.querySelector('#sev-close').onclick = close;
    wrap.querySelector('#sev-cancel').onclick = close;
    const delBtn = wrap.querySelector('#sev-del');
    if(delBtn) delBtn.onclick = async ()=>{ if(!confirm('Xoá sự kiện này khỏi lịch?')) return; S.events = S.events.filter(x=>x.id!==e.id); await schedSave('events'); close(); if(onDone) onDone(); };
    wrap.querySelector('#sev-save').onclick = async ()=>{
      const v = id=> wrap.querySelector('#'+id).value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(v('sev-date'))){ alert('Vui lòng chọn Ngày.'); return; }
      if(!v('sev-content').trim()){ alert('Vui lòng nhập Nội dung công việc.'); return; }
      Object.assign(e, { date:v('sev-date'), session:v('sev-session'), start:schedNormTime(v('sev-start')), end:schedNormTime(v('sev-end')), place:v('sev-place').trim(), content:v('sev-content').trim(),
        participants:v('sev-part').trim(), typeId:v('sev-type'), status:v('sev-status'), verdict:v('sev-verdict'), note:v('sev-note').trim(), fullText:v('sev-full').trim() });
      if(isNew) S.events.push(e); else S.events = S.events.map(x=> x.id===e.id? e : x);
      await schedSave('events'); close(); if(onDone) onDone();
    };
  }

  // ---------- Bảng Excel xem trước (zoom/cố định cột/in/xuất) ----------
  function schedExcelViewModal(title, subtitle, sections, prefs){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let zoomPct = 100;
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:90vh; max-height:90vh; display:flex; flex-direction:column; border-radius:0;">
          <div class="modal-head"><h3>📊 Bảng lịch công tác — ${escapeHtml(title)}</h3><button class="modal-close preview-allow" id="sxm-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:10px;">
            <p style="font-weight:800; color:#b71c1c; margin:0 0 6px;">${escapeHtml(subtitle)}</p>
            <div style="zoom:${zoomPct}%;">
              ${sections.map(sec=>`<p style="font-weight:800; margin:10px 0 4px;">${escapeHtml(sec.title)} (${sec.list.length})</p>${schedTableHtml(sec.cols, sec.list, sec.conflicts, null)}`).join('')}
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="sxm-print">🖨️ In</button>
            <button class="btn btn-ghost preview-allow" id="sxm-excel">⬇️ Xuất Excel</button>
            <div style="display:flex; align-items:center; gap:6px;">
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sxm-zout" ${zoomPct<=50?'disabled':''}>➖</button>
              <span style="font-weight:700; min-width:42px; text-align:center;">${zoomPct}%</span>
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sxm-zin" ${zoomPct>=200?'disabled':''}>➕</button>
            </div>
            <button class="btn btn-primary preview-allow" id="sxm-close2">Đóng bảng</button>
          </div>
        </div>`;
      wrap.querySelector('#sxm-close').onclick = close;
      wrap.querySelector('#sxm-close2').onclick = close;
      wrap.querySelector('#sxm-zin').onclick = ()=>{ zoomPct = Math.min(200, zoomPct+10); render(); };
      wrap.querySelector('#sxm-zout').onclick = ()=>{ zoomPct = Math.max(50, zoomPct-10); render(); };
      wrap.querySelector('#sxm-print').onclick = ()=> schedPrint(title, subtitle, sections);
      wrap.querySelector('#sxm-excel').onclick = ()=> schedExportExcel(title, subtitle, sections);
    }
    render();
  }
  function schedPrint(title, subtitle, sections){
    const prepared = sections.map(sec=>({ title:sec.title, list:sec.list, cols: sec.cols.map(c=>({ label:c.label, align:c.align, get: e=> (sec.conflicts[e.id]? `<span style="background:${sec.conflicts[e.id].level==='overlap'?'#ffcdd2':'#ffe0b2'}; padding:1px 3px;">${c.get(e)}</span>` : c.get(e)) })) }));
    printSections(title, prepared, '', { titleOnly:true, subtitle });
  }
  async function schedLoadXlsxStyle(){
    if(window.XLSX_STYLE) return window.XLSX_STYLE;
    return new Promise((resolve, reject)=>{
      const prev = window.XLSX;
      const s = document.createElement('script');
      s.src = SCHED_XLSX_STYLE_URL;
      s.onload = ()=>{ window.XLSX_STYLE = window.XLSX; window.XLSX = prev; resolve(window.XLSX_STYLE); };
      s.onerror = ()=>{ reject(new Error('Không tải được thư viện Excel hỗ trợ định dạng')); };
      document.head.appendChild(s);
    });
  }
  async function schedExportExcel(title, subtitle, sections){
    let X = null, styled = false;
    try{ X = await schedLoadXlsxStyle(); styled = true; }
    catch(err){
      console.warn('[Lịch công tác] Thư viện định dạng không tải được, dùng bản không định dạng:', err);
      try{ await loadOptionalLibrary('xlsx'); X = window.XLSX; }catch(e2){ alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); return; }
    }
    const maxCols = Math.max(1, ...sections.map(s=>s.cols.length));
    const aoa = [[title.toUpperCase()], [subtitle], [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`], []];
    const merges = [0,1,2].map(r=>({ s:{r,c:0}, e:{r,c:maxCols-1} }));
    const styles = []; // {r,c,s}
    sections.forEach(sec=>{
      merges.push({ s:{r:aoa.length,c:0}, e:{r:aoa.length,c:maxCols-1} });
      styles.push({ r:aoa.length, c:0, s:{ font:{bold:true} } });
      aoa.push([`${sec.title} (${sec.list.length})`.toUpperCase()]);
      const hr = aoa.length;
      aoa.push(sec.cols.map(c=>c.label.toUpperCase()));
      sec.cols.forEach((c,ci)=> styles.push({ r:hr, c:ci, s:{ font:{bold:true}, alignment:{horizontal:'center', vertical:'center', wrapText:true}, fill:{fgColor:{rgb:'E8F5E9'}} } }));
      sec.list.forEach(e=>{
        const r = aoa.length;
        const conf = sec.conflicts[e.id];
        aoa.push(sec.cols.map(c=> c.getPlain(e)));
        sec.cols.forEach((c,ci)=>{
          const isNote = c.key==='note' && conf;
          styles.push({ r, c:ci, s:{ alignment:{ horizontal: c.align==='left'? 'left' : 'center', vertical:'top', wrapText:true },
            ...(isNote? { font:{ bold:true, underline:true, color:{rgb: conf.level==='overlap'? 'B71C1C' : 'E65100'} } } : {}),
            ...(conf && conf.level==='overlap'? { fill:{fgColor:{rgb:'FFCDD2'}} } : (conf? { fill:{fgColor:{rgb:'FFF3E0'}} } : {})) } });
        });
      });
      aoa.push([]);
    });
    const ws = X.utils.aoa_to_sheet(aoa);
    if(styled){ styles.forEach(({r,c,s})=>{ const a = X.utils.encode_cell({r,c}); if(ws[a]) ws[a].s = Object.assign({}, ws[a].s, s); }); }
    const widthOf = { when:20, place:26, content:44, participants:38, type:16, note:46, fullText:60 };
    const first = sections[0];
    ws['!cols'] = (first? first.cols : []).map(c=>({ wch: widthOf[c.key]||24 }));
    ws['!merges'] = merges;
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'Lich cong tac');
    const safe = title.replace(/[^\wÀ-ỹ ]/g,'').trim().replace(/\s+/g,'-') || 'Lich-cong-tac';
    X.writeFile(wb, `Lich-cong-tac_${safe}_${todayStr()}.xlsx`, {cellStyles:true});
    if(!styled) showToast('Đã xuất Excel (không gạch chân/tô màu được do không tải được thư viện định dạng).');
  }

  // ---------- Modal chọn người ----------
  function schedPickPeopleModal(preselected, onPick){
    const S = schedState();
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.zIndex = '99998';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const sel = new Set(preselected);
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:520px;">
          <div class="modal-head"><h3>👥 Chọn người cần lập lịch</h3><button class="modal-close preview-allow" id="spk-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 8px;">Chọn bao nhiêu người thì AI trả về lịch công tác riêng cho từng người đó.</p>
            <label class="sv-filter-item" style="display:flex; cursor:pointer; font-weight:800;"><input type="checkbox" id="spk-all" ${sel.size===S.people.length?'checked':''}><span>Chọn tất cả (${S.people.length})</span></label>
            ${S.people.map(p=>`<label class="sv-filter-item" style="display:flex; cursor:pointer;"><input type="checkbox" data-pk="${p.id}" ${sel.has(p.id)?'checked':''}><span><b>${escapeHtml(p.name)}</b> <span class="sub">(${(p.positions||[]).length} chức vụ)</span></span></label>`).join('')}
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="spk-cancel">Huỷ</button><button class="btn btn-primary preview-allow" id="spk-ok">Tiếp tục</button></div>
        </div>`;
      wrap.querySelector('#spk-close').onclick = close;
      wrap.querySelector('#spk-cancel').onclick = close;
      wrap.querySelector('#spk-all').onchange = (e)=>{ if(e.target.checked) S.people.forEach(p=>sel.add(p.id)); else sel.clear(); render(); };
      wrap.querySelectorAll('[data-pk]').forEach(cb=> cb.onchange = ()=>{ if(cb.checked) sel.add(cb.dataset.pk); else sel.delete(cb.dataset.pk); render(); });
      wrap.querySelector('#spk-ok').onclick = ()=>{ if(!sel.size){ alert('Vui lòng chọn ít nhất 1 người.'); return; } close(); onPick(S.people.filter(p=>sel.has(p.id))); };
    }
    render();
  }

  // ---------- Hồ sơ đang soạn (bảng sửa tay) ----------
  function schedDraftModal(draft, getPeople){
    const S = schedState();
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch; z-index:99997;';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let zoomPct = 100;
    const opt = (map, cur)=> Object.entries(map).map(([k,v])=>`<option value="${k}" ${cur===k?'selected':''}>${escapeHtml(v)}</option>`).join('');
    function render(){
      const people = getPeople();
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:90vh; max-height:90vh; display:flex; flex-direction:column; border-radius:0;">
          <div class="modal-head"><h3>📋 Hồ sơ đang soạn — ${draft.events.length} sự kiện</h3><button class="modal-close preview-allow" id="sdr-close">✕</button></div>
          <div style="padding:8px 14px; border-bottom:1px solid var(--line);"><button type="button" class="btn btn-primary btn-sm preview-allow" id="sdr-add">➕ Thêm sự kiện (nhập tay, không cần chat với AI)</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:0;">
            <div style="zoom:${zoomPct}%;"><div class="table-wrap"><table>
              <thead><tr><th></th><th>#</th><th>Ngày</th><th>Bắt đầu</th><th>Kết thúc</th><th>Buổi</th><th>Địa điểm</th><th>Nội dung (tóm tắt)</th><th>Thành phần tham gia</th><th>Loại</th><th>Trạng thái</th><th>Ghi chú</th><th>Nguyên văn</th>${people.map(p=>`<th style="background:#e3f2fd;">${escapeHtml(p.name)}<br><span class="sub">có tham gia?</span></th>`).join('')}</tr></thead>
              <tbody>${draft.events.length? draft.events.map((e,i)=>`<tr>
                <td><button type="button" class="btn btn-ghost btn-sm preview-allow" data-del="${i}">🗑️</button></td><td>${i+1}</td>
                <td><input type="date" data-i="${i}" data-f="date" value="${escapeHtml(e.date)}"></td>
                <td><input type="time" data-i="${i}" data-f="start" value="${escapeHtml(e.start)}"></td>
                <td><input type="time" data-i="${i}" data-f="end" value="${escapeHtml(e.end)}"></td>
                <td><select data-i="${i}" data-f="session"><option value="">—</option>${opt(SCHED_SESSION_LABEL, e.session)}</select></td>
                <td><input data-i="${i}" data-f="place" value="${escapeHtml(e.place)}" style="min-width:140px;"></td>
                <td><textarea data-i="${i}" data-f="content" rows="3" style="min-width:220px;">${escapeHtml(e.content)}</textarea></td>
                <td><textarea data-i="${i}" data-f="participants" rows="3" style="min-width:200px;">${escapeHtml(e.participants)}</textarea></td>
                <td><select data-i="${i}" data-f="typeId">${S.types.map(t=>`<option value="${t.id}" ${e.typeId===t.id?'selected':''}>${escapeHtml(t.name)}</option>`).join('')}</select></td>
                <td><select data-i="${i}" data-f="status">${opt(SCHED_STATUS_LABEL, e.status)}</select></td>
                <td><textarea data-i="${i}" data-f="note" rows="3" style="min-width:160px;">${escapeHtml(e.note)}</textarea></td>
                <td><textarea data-i="${i}" data-f="fullText" rows="3" style="min-width:220px;">${escapeHtml(e.fullText)}</textarea></td>
                ${people.map(p=>{ const v = (e.verdicts&&e.verdicts[p.id])||{v:'no',reason:''}; return `<td style="background:#f3f9ff; min-width:150px;"><select data-i="${i}" data-p="${p.id}"><option value="yes" ${v.v==='yes'?'selected':''}>Có</option><option value="unclear" ${v.v==='unclear'?'selected':''}>Không rõ</option><option value="no" ${v.v==='no'?'selected':''}>Không</option></select><div class="sub" style="font-size:11px; max-width:200px;">${escapeHtml(v.reason||'')}</div></td>`; }).join('')}
              </tr>`).join('') : `<tr><td colspan="${13+people.length}" style="text-align:center; padding:14px;">Chưa có sự kiện nào — bấm "➕ Thêm sự kiện" hoặc chat với AI.</td></tr>`}</tbody>
            </table></div></div>
          </div>
          <div class="modal-foot">
            <div style="display:flex; align-items:center; gap:6px; margin-right:auto;">
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sdr-zout" ${zoomPct<=50?'disabled':''}>➖</button><span style="font-weight:700; min-width:42px; text-align:center;">${zoomPct}%</span><button type="button" class="btn btn-ghost btn-sm preview-allow" id="sdr-zin" ${zoomPct>=200?'disabled':''}>➕</button>
            </div>
            <button class="btn btn-primary preview-allow" id="sdr-close2">Đóng bảng</button>
          </div>
        </div>`;
      wrap.querySelector('#sdr-close').onclick = close;
      wrap.querySelector('#sdr-close2').onclick = close;
      wrap.querySelector('#sdr-zin').onclick = ()=>{ zoomPct = Math.min(200, zoomPct+10); render(); };
      wrap.querySelector('#sdr-zout').onclick = ()=>{ zoomPct = Math.max(50, zoomPct-10); render(); };
      wrap.querySelector('#sdr-add').onclick = ()=>{ draft.events.push(schedEmptyDraftEvent(getPeople())); render(); };
      wrap.querySelectorAll('[data-del]').forEach(b=> b.onclick = ()=>{ if(!confirm('Xoá sự kiện này khỏi hồ sơ đang soạn?')) return; draft.events.splice(+b.dataset.del,1); render(); });
    }
    const onEdit = (ev)=>{
      const t = ev.target; if(t.dataset.i==null) return;
      const e = draft.events[+t.dataset.i]; if(!e) return;
      if(t.dataset.f) e[t.dataset.f] = t.value;
      else if(t.dataset.p){ e.verdicts = e.verdicts || {}; e.verdicts[t.dataset.p] = Object.assign({}, e.verdicts[t.dataset.p], { v:t.value }); }
    };
    wrap.addEventListener('input', onEdit);
    wrap.addEventListener('change', onEdit);
    render();
  }

  // ---------- Khung chat AI ----------
  function schedAiModal(initialPeople){
    const S = schedState();
    let people = initialPeople.slice();
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const draft = { events:[] };
    const messages = [];
    let pending = [];
    let busy = false, digested = false;
    const closeImmediate = ()=> wrap.remove();
    const close = ()=>{
      if(!draft.events.length){ closeImmediate(); return; }
      if(confirm(`⚠️ "Hồ sơ đang soạn" (${draft.events.length} sự kiện) hiện CHƯA được lưu.\n\nNếu đóng bảng bây giờ, dữ liệu này sẽ BIẾN MẤT VĨNH VIỄN.\n\nBấm "OK" để đóng (mất dữ liệu), hoặc "Huỷ" để quay lại.`)) closeImmediate();
    };
    function bubble(m, idx){
      const isUser = m.role==='user';
      const attach = (m.attachments&&m.attachments.length)? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${m.attachments.map(a=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)}</span>`).join('')}</div>` : '';
      if(m.streaming) return `<div style="display:flex; margin-bottom:10px;"><div id="sai-streaming" style="max-width:75%; background:#e3f2fd; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${m.text? renderMarkdownLite(m.text) : waveTextHtml('Chàng đang suy nghĩ…')}</div></div>`;
      return `<div style="display:flex; flex-direction:column; align-items:${isUser?'flex-end':'flex-start'}; margin-bottom:10px;"><div style="max-width:75%; background:${isUser?'#dcedc8':'#e3f2fd'}; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${isUser? escapeHtml(m.text||'') : renderMarkdownLite(m.text||'')}${attach}</div></div>`;
    }
    function render(){
      const hasContent = messages.some(m=>m.role==='user') || pending.length>0;
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
          <div class="modal-head"><h3>✨ Thêm nhanh Lịch công tác bằng chat với AI</h3><button class="modal-close preview-allow" id="sai-close">✕</button></div>
          <div style="padding:8px 16px; background:var(--paper-2); border-bottom:1px solid var(--line); display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
            <span style="font-weight:700;">Đang lập lịch cho:</span><span style="color:#b71c1c; font-weight:800;">${people.map(p=>escapeHtml(p.name)).join(', ')}</span>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sai-change">Đổi người</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sai-train">🧠 Huấn luyện AI</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sai-types">🏷️ Loại sự kiện</button>
          </div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column;" id="sai-thread">
            ${messages.length? messages.map(bubble).join('') : `<p class="sub" style="text-align:center; margin:auto;">Hãy đính kèm lịch công tác (PDF, Word, Excel, ảnh chụp) và/hoặc nhắn tin — AI chỉ bắt đầu đọc khi đồng chí bấm "🧠 Tiêu hoá tài liệu bằng AI". Đồng chí cũng có thể tự thêm/sửa sự kiện ngay trong "Hồ sơ đang soạn" bên dưới mà không cần chat với AI.</p>`}
          </div>
          <div style="padding:8px 16px 0; background:var(--paper-2);">
            <div style="text-align:center; margin-bottom:8px;"><button type="button" class="btn btn-sm preview-allow" id="sai-view" style="background:#fff9c4; border:1px solid #fbc02d; color:#5a4300; font-weight:700;">📋 Hồ sơ đang soạn — ${draft.events.length} sự kiện (bấm để xem/sửa)</button></div>
            <p class="sub" style="margin:0 0 8px;">${digested? 'AI đã đọc xong. Muốn bổ sung/sửa gì thì nhắn tiếp, AI sẽ cập nhật lại Hồ sơ đang soạn.' : 'Chưa tiêu hoá tài liệu nào — đính kèm/nhắn xong thì bấm nút bên dưới.'}</p>
            ${pending.length? `<div class="ai-attach-row" style="padding:0 0 8px;">${pending.map((a,i)=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)} <button type="button" class="preview-allow" data-rm="${i}">✕</button></span>`).join('')}</div>` : ''}
            <input type="file" id="sai-file" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,image/*" style="display:none;">
            <div style="display:flex; gap:8px; align-items:flex-end; padding-bottom:8px;">
              <button type="button" class="btn btn-ghost preview-allow" id="sai-attach" title="Đính kèm tệp">📎 Đính kèm</button>
              <textarea id="sai-input" rows="2" placeholder="Nhắn tin cho AI... (Ctrl+Enter để gửi)" style="flex:1;"></textarea>
              <button type="button" class="btn btn-primary preview-allow" id="sai-send">➤</button>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="sai-close2">Đóng bảng</button>
            <button type="button" class="btn btn-sm preview-allow" id="sai-digest" ${(busy||!hasContent)?'disabled':''} style="background:linear-gradient(180deg,#fff 0%,#7c4dff 45%,#4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700; ${(busy||!hasContent)?'opacity:.5;':''}">${busy? '⏳ AI đang xử lý...' : '🧠 Tiêu hoá tài liệu bằng AI'}</button>
            <button class="btn btn-primary preview-allow" id="sai-save" ${draft.events.length?'':'disabled'} style="${draft.events.length?'':'opacity:.45;'}">💾 Lưu vào lịch của từng người</button>
          </div>
        </div>`;
      const th = wrap.querySelector('#sai-thread'); if(th) th.scrollTop = th.scrollHeight;
      wrap.querySelector('#sai-close').onclick = close;
      wrap.querySelector('#sai-close2').onclick = close;
      wrap.querySelector('#sai-change').onclick = ()=> schedPickPeopleModal(people.map(p=>p.id), (ps)=>{ people = ps; draft.events.forEach(e=>{ const v = {}; people.forEach(p=>{ v[p.id] = (e.verdicts&&e.verdicts[p.id]) || {v:'no',reason:''}; }); e.verdicts = v; }); render(); });
      wrap.querySelector('#sai-train').onclick = ()=> schedTrainingModal();
      wrap.querySelector('#sai-types').onclick = ()=> schedTypesModal(()=>{});
      wrap.querySelector('#sai-view').onclick = ()=> schedDraftModal(draft, ()=>people);
      wrap.querySelector('#sai-attach').onclick = ()=> wrap.querySelector('#sai-file').click();
      wrap.querySelectorAll('[data-rm]').forEach(b=> b.onclick = ()=>{ pending.splice(+b.dataset.rm,1); render(); });
      wrap.querySelector('#sai-file').onchange = async (e)=>{
        for(const f of Array.from(e.target.files||[])){
          try{ const a = await schedReadFile(f); if(a) pending.push(a); }catch(err){ console.error(err); alert(`Không đọc được tệp "${f.name}": ${err&&err.message||err}`); }
        }
        render();
      };
      wrap.querySelector('#sai-send').onclick = doSend;
      wrap.querySelector('#sai-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter' && e.ctrlKey){ e.preventDefault(); doSend(); } });
      wrap.querySelector('#sai-digest').onclick = ()=> runAi();
      const saveBtn = wrap.querySelector('#sai-save');
      if(saveBtn) saveBtn.onclick = async ()=>{
        if(!draft.events.length) return;
        if(!await schedCommitDraft(draft, people)) return;
        closeImmediate();
        const el = schedContentEl(); if(el && state.activeTab==='schedule'){ state._schedPersonId = people[0].id; const firstDated = schedSortEvents(draft.events.filter(e=>e.date))[0]; if(firstDated) state._schedWeek = schedMondayOf(firstDated.date); renderScheduleTab(el); }
      };
    }
    function doSend(){
      const inp = wrap.querySelector('#sai-input'); const text = (inp.value||'').trim();
      if(!text && !pending.length) return;
      messages.push({ role:'user', text, attachments:pending.map(a=>({name:a.name, mimeType:a.mimeType})), files:pending });
      pending = []; inp.value = '';
      if(digested){ render(); runAi(); } else render();
    }
    async function runAi(){
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, vui lòng đăng nhập để sử dụng tính năng này.'); return; }
      if(busy) return;
      // gộp tệp chưa gửi (nếu bấm "Tiêu hoá" mà chưa bấm gửi)
      if(pending.length){ messages.push({ role:'user', text:'', attachments:pending.map(a=>({name:a.name, mimeType:a.mimeType})), files:pending }); pending = []; }
      const allFiles = messages.filter(m=>m.role==='user').flatMap(m=>m.files||[]);
      const binary = allFiles.filter(a=>a.base64);
      const prov = (typeof getActiveAiProvider==='function')? getActiveAiProvider() : null;
      if(binary.some(a=>a.mimeType==='application/pdf') && prov && aiVendorOf(prov)!=='gemini'){
        alert('Model AI đang chọn không đọc được tệp PDF. Đồng chí đổi sang model Gemini ở thanh chọn model rồi thử lại, hoặc dùng tệp Word/Excel/ảnh chụp.');
        render(); return;
      }
      busy = true;
      const stream = { role:'ai', text:'', streaming:true };
      messages.push(stream); render();
      try{
        const aiMessages = [{ role:'user', text:schedSystemPrompt(people) }, { role:'assistant', text:'Đã hiểu, tôi sẽ tuân thủ đúng quy tắc và định dạng trả lời yêu cầu.' }];
        messages.forEach(m=>{
          if(m===stream) return;
          let t = m.text||'';
          (m.files||[]).filter(a=>a.text).forEach(a=>{ t += `\n\n[Nội dung tệp "${a.name}"]\n${a.text}`; });
          (m.files||[]).filter(a=>a.base64).forEach(a=>{ t += `\n(kèm tệp "${a.name}")`; });
          aiMessages.push({ role: m.role==='user'? 'user':'assistant', text: t || '(tệp đính kèm)' });
        });
        aiMessages.push({ role:'user', text:`[Hồ sơ đang soạn HIỆN TẠI${draft.events.length? '' : ' (đang RỖNG)'}]:\n${JSON.stringify({events:draft.events})}` });
        aiMessages.push({ role:'assistant', text:'Đã ghi nhận Hồ sơ đang soạn hiện tại, tôi sẽ dựa vào đó để cập nhật.' });
        const result = await callAIWithFallback(aiMessages, binary.length? { attachments:binary.map(a=>({ name:a.name, mimeType:a.mimeType, base64:a.base64 })) } : {}, (partial)=>{
          stream.text = partial;
          const b = document.getElementById('sai-streaming');
          if(b){ b.innerHTML = partial? renderMarkdownLite(partial) : waveTextHtml('Chàng đang suy nghĩ…'); const th = wrap.querySelector('#sai-thread'); if(th) th.scrollTop = th.scrollHeight; }
        });
        const full = result.text || '';
        const mm = full.match(/```schedule-result\s*([\s\S]*?)```/);
        let reply = full, parsed = null;
        if(mm){ reply = (full.slice(0,mm.index)+full.slice(mm.index+mm[0].length)).trim(); try{ parsed = JSON.parse(mm[1].trim()); }catch(e){ parsed = null; } }
        messages.pop();
        if(parsed){ draft.events = schedNormalizeEvents(parsed.events, people); }
        if(mm && !parsed) reply += '\n\n(Lưu ý: không đọc được khối kết quả của AI, đồng chí bấm "Tiêu hoá" lại giúp.)';
        if(reply) messages.push({ role:'ai', text:reply });
        digested = true;
      }catch(err){
        messages.pop();
        console.error('[Lịch công tác] Lỗi AI:', err);
        messages.push({ role:'ai', text:`Xin lỗi, có lỗi khi xử lý: ${err&&err.message? err.message : err}. Đồng chí thử lại nhé.` });
      }
      busy = false; render();
    }
    render();
  }

  // ---------- Giao diện tab ----------
  function schedPanelHead(id, title, extra){
    const S = state._schedShow || (state._schedShow = {});
    const open = S[id]!==false;
    return `<div class="panel-head" style="cursor:pointer;" id="sch-toggle-${id}"><h3>${title} ${open?'▴':'▾'}</h3>${extra||''}</div>`;
  }
  function schedStats(person, mode, anchorIso){
    const S = schedState();
    let from, to;
    if(mode==='month'){ const d = schedParseIso(anchorIso)||new Date(); from = schedIsoDate(new Date(d.getFullYear(), d.getMonth(), 1)); to = schedIsoDate(new Date(d.getFullYear(), d.getMonth()+1, 0)); }
    else { from = schedMondayOf(anchorIso); to = schedAddDays(from, 6); }
    const mine = S.events.filter(e=> e.personId===person.id && e.date>=from && e.date<=to);
    const yes = mine.filter(e=> e.verdict!=='unclear');
    const counted = yes.filter(e=> !e.status || e.status==='normal' || e.status==='added');
    const conf = schedConflicts(yes);
    const byType = {}; S.types.forEach(t=>{ byType[t.id] = 0; });
    counted.forEach(e=>{ const id = byType[e.typeId]!=null? e.typeId : SCHED_OTHER_TYPE_ID; byType[id]++; });
    return { from, to, total:counted.length, byType, unclear:mine.filter(e=>e.verdict==='unclear').length, postponed:yes.filter(e=>e.status==='postponed'||e.status==='cancelled').length, overlap:Object.values(conf).filter(c=>c.level==='overlap').length, near:Object.values(conf).filter(c=>c.level==='near').length };
  }
  function renderScheduleTab(el){
    if(!el) return;
    if(!hasAuthenticatedIdentity()){
      el.innerHTML = `<div class="panel"><div class="panel-head"><h3>📅 Lịch Công tác</h3></div><div class="panel-body"><div class="empty-state"><div class="e-ico">🔒</div>Module này lưu dữ liệu RIÊNG TƯ theo tài khoản Google — đồng chí cần đăng nhập bằng Google để sử dụng${state.previewMode? ' (môi trường tham quan không dùng được)' : ''}.</div></div></div>`;
      return;
    }
    const S = schedState();
    if(!S.loaded || S.key!==schedKey()){
      el.innerHTML = `<div class="panel"><div class="panel-head"><h3>📅 Lịch Công tác</h3></div><div class="panel-body"><p class="sub">Đang tải dữ liệu...</p></div></div>`;
      schedLoad().then(()=>{ if(state.activeTab==='schedule' && S.loaded) renderScheduleTab(el); });
      return;
    }
    capturePanelAnimFlag();
    const shows = state._schedShow || (state._schedShow = {});
    const open = id=> shows[id]!==false;
    if(!state._schedPersonId || !S.people.some(p=>p.id===state._schedPersonId)) state._schedPersonId = S.people[0]? S.people[0].id : null;
    if(!state._schedWeek) state._schedWeek = schedMondayOf(schedIsoDate(new Date()));
    if(!state._schedStatMode) state._schedStatMode = 'week';
    if(!state._schedStatDate) state._schedStatDate = schedIsoDate(new Date());
    const person = S.people.find(p=>p.id===state._schedPersonId) || null;
    const weekFrom = state._schedWeek, weekTo = schedAddDays(weekFrom, 6);
    let mainList = [], unclearList = [], conflicts = {};
    if(person){
      const mine = schedSortEvents(S.events.filter(e=> e.personId===person.id && e.date>=weekFrom && e.date<=weekTo));
      mainList = mine.filter(e=> e.verdict!=='unclear'); unclearList = mine.filter(e=> e.verdict==='unclear');
      conflicts = schedConflicts(mainList);
    }
    const prefs = S.prefs;
    const cols = schedColDefs(prefs, conflicts);
    const colsUnclear = schedColDefs(prefs, {});
    const statPerson = S.people.find(p=>p.id===(state._schedStatPersonId||state._schedPersonId)) || person;
    const st = statPerson? schedStats(statPerson, state._schedStatMode, state._schedStatDate) : null;
    const maxType = st? Math.max(1, ...Object.values(st.byType)) : 1;
    const personOpts = S.people.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    el.innerHTML = `
      <div class="panel">
        ${schedPanelHead('people', `👥 Danh sách người dùng (${S.people.length})`, `<button class="btn btn-primary btn-sm preview-allow" id="sch-add-person">➕ Thêm người</button>`)}
        ${open('people')? `<div class="panel-body ${panelBodyAnimClass()}">${S.people.length? `<div class="table-wrap"><table>
          <thead><tr><th></th><th style="text-align:left;">Họ và tên</th><th>Số chức vụ</th><th style="text-align:left;">Chức vụ</th></tr></thead>
          <tbody>${S.people.map(p=>`<tr><td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm preview-allow" data-pedit="${p.id}" title="Sửa">✏️</button><button class="btn btn-ghost btn-sm preview-allow" data-pdel="${p.id}" title="Xoá">🗑️</button></td><td style="text-align:left;"><b>${escapeHtml(p.name)}</b></td><td style="text-align:center;">${(p.positions||[]).length}</td><td style="text-align:left; white-space:normal; max-width:520px;">${escapeHtml((p.positions||[]).join('; '))}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-state"><div class="e-ico">👥</div>Chưa có người dùng nào — bấm "➕ Thêm người" và khai báo họ tên + các chức vụ.</div>`}</div>` : ''}
      </div>
      <div class="panel">
        ${schedPanelHead('ai', '✨ Thêm nhanh bằng AI')}
        ${open('ai')? `<div class="panel-body ${panelBodyAnimClass()}"><div class="toolbar" style="flex-wrap:wrap; gap:8px;">
          <button class="btn btn-sm preview-allow" id="sch-ai-open" style="background:linear-gradient(180deg,#fff 0%,#7c4dff 45%,#4527a0 100%); color:#fff; font-weight:700;">✨ Thêm nhanh bằng AI (đọc lịch công tác)</button>
          <button class="btn btn-ghost btn-sm preview-allow" id="sch-train-open">🧠 Huấn luyện AI${(S.training||[]).length? ` (${S.training.length})` : ''}</button>
          <button class="btn btn-ghost btn-sm preview-allow" id="sch-types-open">🏷️ Loại sự kiện</button>
        </div><p class="sub" style="margin-top:8px;">Chọn người cần lập lịch, đính kèm lịch công tác của cơ quan (PDF, Word, Excel, ảnh chụp) — AI tách ra những việc liên quan tới từng người dựa trên chức vụ đã khai báo.</p></div>` : ''}
      </div>
      <div class="panel">
        ${schedPanelHead('view', '📅 Lịch công tác của từng người')}
        ${open('view')? `<div class="panel-body ${panelBodyAnimClass()}">${person? `
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <select id="sch-person">${personOpts}</select>
            <button class="btn btn-ghost btn-sm preview-allow" id="sch-prev">◀ Tuần trước</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="sch-this">Tuần này</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="sch-next">Tuần sau ▶</button>
            <input type="date" id="sch-jump" value="${weekFrom}" title="Chọn 1 ngày bất kỳ để nhảy tới tuần chứa ngày đó">
            <div class="spacer"></div>
            <button class="btn btn-ghost btn-sm preview-allow" id="sch-cols">🧩 Tuỳ chỉnh cột</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="sch-addev">➕ Thêm sự kiện</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="sch-xview">📊 Xem bảng Excel</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="sch-print">🖨️ In</button>
            <button class="btn btn-ghost btn-sm preview-allow" id="sch-xexp">⬇️ Xuất file</button>
          </div>
          <p style="font-weight:800; color:#b71c1c; margin:0 0 6px;">${escapeHtml(person.name)} — Tuần từ ${schedFmtDate(weekFrom)} đến ${schedFmtDate(weekTo)}</p>
          <div class="divider-lbl">Công việc chắc chắn tham gia (${mainList.length})</div>
          ${schedTableHtml(cols, mainList, conflicts, e=>`<button class="btn btn-ghost btn-sm preview-allow" data-eedit="${e.id}" title="Sửa">✏️</button>`)}
          <div class="divider-lbl">Không rõ có tham gia không (${unclearList.length})</div>
          <p class="sub" style="margin:0 0 6px;">Những nội dung dưới đây AI không chắc ${escapeHtml(person.name)} có thuộc thành phần tham dự hay không. Bấm "Có"/"Không" để chốt — app tự ghi nhớ vào mục Huấn luyện AI cho lần sau.</p>
          ${schedTableHtml(colsUnclear, unclearList, {}, e=>`<button class="btn btn-ghost btn-sm preview-allow" data-eedit="${e.id}" title="Sửa">✏️</button><br><button class="btn btn-primary btn-sm preview-allow" data-teach-yes="${e.id}" style="margin-top:4px;">Có</button><button class="btn btn-ghost btn-sm preview-allow" data-teach-no="${e.id}" style="margin-top:4px;">Không</button>`)}
        ` : `<div class="empty-state"><div class="e-ico">📅</div>Hãy thêm ít nhất 1 người dùng ở panel đầu tiên.</div>`}</div>` : ''}
      </div>
      <div class="panel">
        ${schedPanelHead('stats', '📈 Thống kê')}
        ${open('stats')? `<div class="panel-body ${panelBodyAnimClass()}">${statPerson? `
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <select id="sch-stat-person">${personOpts}</select>
            <select id="sch-stat-mode"><option value="week" ${state._schedStatMode==='week'?'selected':''}>Theo tuần</option><option value="month" ${state._schedStatMode==='month'?'selected':''}>Theo tháng</option></select>
            <input type="date" id="sch-stat-date" value="${state._schedStatDate}">
            <div class="spacer"></div>
            <button class="btn btn-ghost btn-sm preview-allow" id="sch-types-open2">🏷️ Loại sự kiện</button>
          </div>
          <p style="font-weight:800; color:#b71c1c; margin:0 0 8px;">${escapeHtml(statPerson.name)} — từ ${schedFmtDate(st.from)} đến ${schedFmtDate(st.to)}</p>
          <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; margin-bottom:12px;">
            ${[['Tổng số công việc', st.total, ''], ['Lần trùng giờ', st.overlap, st.overlap? 'color:#b71c1c;' : ''], ['Sát giờ, khác nơi', st.near, st.near? 'color:#e65100;' : ''], ['Chưa rõ có tham gia', st.unclear, ''], ['Đã hoãn/hủy', st.postponed, '']].map(([l,v,sty])=>`<div style="border:1px solid var(--line); border-radius:8px; padding:8px 12px;"><div class="sub">${l}</div><div style="font-weight:800; font-size:18px; ${sty}">${v}</div></div>`).join('')}
          </div>
          <div class="table-wrap"><table><thead><tr><th style="text-align:left;">Loại sự kiện</th><th>Số lượng</th><th style="text-align:left; min-width:200px;"></th></tr></thead><tbody>
            ${S.types.map(t=>`<tr><td style="text-align:left;">${escapeHtml(t.name)}</td><td style="text-align:center; font-weight:700;">${st.byType[t.id]||0}</td><td><div style="background:#a5d6a7; height:12px; border-radius:6px; width:${Math.round(((st.byType[t.id]||0)/maxType)*100)}%; min-width:${(st.byType[t.id]||0)? 6 : 0}px;"></div></td></tr>`).join('')}
          </tbody></table></div>` : `<div class="empty-state"><div class="e-ico">📈</div>Chưa có người dùng nào để thống kê.</div>`}</div>` : ''}
      </div>`;
    ['sch-person'].forEach(id=>{ const s = el.querySelector('#'+id); if(s) s.value = state._schedPersonId; });
    const sp = el.querySelector('#sch-stat-person'); if(sp) sp.value = statPerson? statPerson.id : '';
    wireScheduleTab(el, { person, weekFrom, weekTo, mainList, unclearList, conflicts, cols, colsUnclear });
  }
  function wireScheduleTab(el, ctx){
    const S = schedState();
    const again = ()=> renderScheduleTab(el);
    ['people','ai','view','stats'].forEach(id=>{
      const h = el.querySelector('#sch-toggle-'+id);
      if(h) h.onclick = ()=>{ const shows = state._schedShow; shows[id] = shows[id]===false? true : false; markPanelJustToggled(); again(); };
    });
    const addP = el.querySelector('#sch-add-person'); if(addP) addP.onclick = (e)=>{ e.stopPropagation(); schedPersonModal(null, again); };
    el.querySelectorAll('[data-pedit]').forEach(b=> b.onclick = ()=>{ const p = S.people.find(x=>x.id===b.dataset.pedit); if(p) schedPersonModal(p, again); });
    el.querySelectorAll('[data-pdel]').forEach(b=> b.onclick = async ()=>{
      const p = S.people.find(x=>x.id===b.dataset.pdel); if(!p) return;
      const n = S.events.filter(e=>e.personId===p.id).length;
      if(!confirm(`Xoá người dùng "${p.name}"${n? ` và ${n} sự kiện trong lịch của người này` : ''}? Không khôi phục lại được.`)) return;
      S.people = S.people.filter(x=>x.id!==p.id); S.events = S.events.filter(e=>e.personId!==p.id);
      await schedSave('people'); await schedSave('events'); again();
    });
    const aiOpen = el.querySelector('#sch-ai-open');
    if(aiOpen) aiOpen.onclick = ()=>{
      if(!S.people.length){ alert('Hãy thêm ít nhất 1 người dùng ở panel "Danh sách người dùng" trước.'); return; }
      schedPickPeopleModal(state._schedPersonId? [state._schedPersonId] : [], (ps)=> schedAiModal(ps));
    };
    const tr = el.querySelector('#sch-train-open'); if(tr) tr.onclick = ()=> schedTrainingModal(again);
    ['sch-types-open','sch-types-open2'].forEach(id=>{ const b = el.querySelector('#'+id); if(b) b.onclick = ()=> schedTypesModal(again); });
    const personSel = el.querySelector('#sch-person'); if(personSel) personSel.onchange = ()=>{ state._schedPersonId = personSel.value; again(); };
    const go = (iso)=>{ state._schedWeek = schedMondayOf(iso); again(); };
    const prev = el.querySelector('#sch-prev'); if(prev) prev.onclick = ()=> go(schedAddDays(ctx.weekFrom,-7));
    const next = el.querySelector('#sch-next'); if(next) next.onclick = ()=> go(schedAddDays(ctx.weekFrom,7));
    const thisW = el.querySelector('#sch-this'); if(thisW) thisW.onclick = ()=> go(schedIsoDate(new Date()));
    const jump = el.querySelector('#sch-jump'); if(jump) jump.onchange = ()=>{ if(jump.value) go(jump.value); };
    const colsBtn = el.querySelector('#sch-cols'); if(colsBtn) colsBtn.onclick = ()=> schedColsModal(again);
    const addEv = el.querySelector('#sch-addev'); if(addEv) addEv.onclick = ()=> schedEventModal(null, ctx.person.id, again);
    el.querySelectorAll('[data-eedit]').forEach(b=> b.onclick = ()=>{ const e = S.events.find(x=>x.id===b.dataset.eedit); if(e) schedEventModal(e, e.personId, again); });
    const teach = async (id, yes)=>{
      const e = S.events.find(x=>x.id===id); if(!e || !ctx.person) return;
      const part = (e.participants||e.content||'').replace(/\s+/g,' ').slice(0,260);
      const line = `Thành phần "${part}" ${yes? 'CÓ' : 'KHÔNG'} gồm đồng chí ${ctx.person.name}.`;
      if(!confirm(`${yes? 'Chốt CÓ tham gia' : 'Chốt KHÔNG tham gia và xoá sự kiện này khỏi lịch'}, đồng thời ghi nhớ cho AI lần sau:\n\n${line}\n\nTiếp tục?`)) return;
      if(!await schedAddTrainingLine(line)) return;
      if(yes){ e.verdict = 'yes'; e.reason = 'Người dùng đã xác nhận có tham gia.'; } else { S.events = S.events.filter(x=>x.id!==id); }
      await schedSave('events'); again();
    };
    el.querySelectorAll('[data-teach-yes]').forEach(b=> b.onclick = ()=> teach(b.dataset.teachYes, true));
    el.querySelectorAll('[data-teach-no]').forEach(b=> b.onclick = ()=> teach(b.dataset.teachNo, false));
    const sections = ()=> [
      { title:'Công việc chắc chắn tham gia', list:ctx.mainList, cols:ctx.cols, conflicts:ctx.conflicts },
      { title:'Không rõ có tham gia không', list:ctx.unclearList, cols:ctx.colsUnclear, conflicts:{} },
    ];
    const subtitle = ()=> `Tuần từ ${schedFmtDate(ctx.weekFrom)} đến ${schedFmtDate(ctx.weekTo)}`;
    const xv = el.querySelector('#sch-xview'); if(xv) xv.onclick = ()=> schedExcelViewModal(ctx.person.name, subtitle(), sections(), S.prefs);
    const pr = el.querySelector('#sch-print'); if(pr) pr.onclick = ()=> schedPrint(ctx.person.name, subtitle(), sections());
    const xe = el.querySelector('#sch-xexp'); if(xe) xe.onclick = ()=> schedExportExcel(ctx.person.name, subtitle(), sections());
    const sPerson = el.querySelector('#sch-stat-person'); if(sPerson) sPerson.onchange = ()=>{ state._schedStatPersonId = sPerson.value; again(); };
    const sMode = el.querySelector('#sch-stat-mode'); if(sMode) sMode.onchange = ()=>{ state._schedStatMode = sMode.value; again(); };
    const sDate = el.querySelector('#sch-stat-date'); if(sDate) sDate.onchange = ()=>{ if(sDate.value){ state._schedStatDate = sDate.value; again(); } };
  }
  function schedColsModal(onDone){
    const S = schedState();
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:420px;">
        <div class="modal-head"><h3>🧩 Tuỳ chỉnh cột</h3><button class="modal-close preview-allow" id="scm-close">✕</button></div>
        <div class="modal-body">
          <p class="sub" style="margin:0 0 8px;">"Ngày giờ" và "Nội dung công việc" luôn hiện. Các cột còn lại tuỳ ý ẩn/hiện (áp dụng cả khi xem bảng Excel, in và xuất file).</p>
          ${SCHED_COLS_META.filter(([,,fixed])=>!fixed).map(([k,label])=>`<label class="sv-filter-item" style="display:flex; cursor:pointer;"><input type="checkbox" data-ck="${k}" ${S.prefs.cols[k]!==false?'checked':''}><span>${escapeHtml(label)}</span></label>`).join('')}
        </div>
        <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="scm-cancel">Đóng</button><button class="btn btn-primary preview-allow" id="scm-save">💾 Lưu</button></div>
      </div>`;
    wrap.querySelector('#scm-close').onclick = close;
    wrap.querySelector('#scm-cancel').onclick = close;
    wrap.querySelector('#scm-save').onclick = async ()=>{
      wrap.querySelectorAll('[data-ck]').forEach(cb=>{ S.prefs.cols[cb.dataset.ck] = cb.checked; });
      await schedSave('prefs'); close(); if(onDone) onDone();
    };
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
  if(_publicReceiptId){
    renderPublicReceiptPage(_publicReceiptId);
  } else if(_publicSurveyId){
    renderPublicSurveyPage(_publicSurveyId);
  } else {
    boot();
  }
})();
