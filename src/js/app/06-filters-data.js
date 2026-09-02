  // =====================================================================
  function ensureFilterHamletsInit(hamlets){
    if(!state.filterHamlets) state.filterHamlets = hamlets.slice();
  }
  function hamletFilterLabel(hamlets){
    ensureFilterHamletsInit(hamlets);
    const sel = state.filterHamlets;
    if(sel.length===hamlets.length && hamlets.length>0) return `Tất cả địa phương`;
    if(sel.length===0) return `0 địa phương`;
    if(sel.length===1) return `${subAdminLabel()} ${sel[0]}`;
    return `${sel.length} địa phương được chọn`;
  }
  function toggleHamletAll(hamlets, checked){ state.filterHamlets = checked ? hamlets.slice() : []; }
  function toggleHamletOne(hamlets, name, checked){
    const set = new Set(state.filterHamlets||[]);
    if(checked) set.add(name); else set.delete(name);
    state.filterHamlets = hamlets.filter(h=>set.has(h));
  }
  function ensureFilterProjectsInit(projects){
    if(!state.filterProjectIds) state.filterProjectIds = projects.map(p=>p.id);
  }
  function projectFilterLabel(projects){
    ensureFilterProjectsInit(projects);
    const sel = state.filterProjectIds;
    if(sel.length===projects.length && projects.length>0) return 'Tất cả phương án vay';
    if(sel.length===0) return '0 phương án';
    if(sel.length===1){ const p = projects.find(x=>x.id===sel[0]); return p ? escapeHtml(p.name) : '1 lựa chọn'; }
    return `${sel.length} phương án được chọn`;
  }
  function toggleProjectAll(projects, checked){ state.filterProjectIds = checked ? projects.map(p=>p.id) : []; }
  function toggleProjectOne(projects, id, checked){
    const set = new Set(state.filterProjectIds||[]);
    if(checked) set.add(id); else set.delete(id);
    state.filterProjectIds = projects.map(p=>p.id).filter(pid=>set.has(pid));
  }
  // ---- Bộ lọc "Nguồn vay" (đọc từ giá trị tự do người dùng đã nhập ở từng người vay) ----
  // Toàn bộ phương án vay CHƯA bị xoá (kể cả đang hoạt động/đã tất toán/bị ẩn), sắp xếp theo đúng yêu
  // cầu: đang hoạt động lên TRÊN (xanh dương) -> còn lại xếp DƯỚI, mới hơn (ngày vay gần đây) lên trên
  // trước, cũ hơn xuống dưới (tím). Dùng chung cho cả 2 modal thống kê cần bộ lọc "Phương án vay".
  function svAllProjectsForFilterSorted(){
    const projects = (state.loanProjects||[]).filter(p=>!p.deleted);
    const activeProjectIds = new Set(state.borrowers.filter(b=>!b.deleted && !b.settled && b.projectId).map(b=>b.projectId));
    const active = projects.filter(p=> activeProjectIds.has(p.id));
    const rest = projects.filter(p=> !activeProjectIds.has(p.id))
      .sort((a,c)=> String(c.disburseDate||'').localeCompare(String(a.disburseDate||''))); // mới hơn lên trên
    return active.concat(rest).map(p=> ({ ...p, _svColor: activeProjectIds.has(p.id) ? '#0d47a1' : '#b8860b' }));
  }
  // Dựng HTML khung dropdown bộ lọc "Phương án vay" — dùng chung cho mọi modal cần tới.
  function svProjectFilterDropdownHtml(idPrefix, selectedIds, allProjects){
    const allSel = selectedIds.length===allProjects.length;
    return `<div class="sv-filter-dropdown">
      <button type="button" class="btn btn-ghost btn-sm preview-allow" id="${idPrefix}-project-btn" style="${!allSel?'border:2px solid #b71c1c;':''}">📋 Phương án vay (${selectedIds.length})</button>
      ${state.openFilterDropdown===idPrefix+'-project'? `<div class="sv-filter-panel">
        <label class="sv-filter-item"><input type="checkbox" id="${idPrefix}-project-all" class="preview-allow" ${allSel?'checked':''}><span><b>Tất cả phương án vay</b></span></label>
        ${allProjects.map(p=>`<label class="sv-filter-item" data-svp="${p.id}"><input type="checkbox" class="preview-allow ${idPrefix}-project-item" data-p="${p.id}" ${selectedIds.includes(p.id)?'checked':''}><span style="color:${p._svColor}; font-weight:600;">${escapeHtml(p.name)}</span></label>`).join('')}
      </div>` : ''}
    </div>`;
  }
  // Dựng HTML khung dropdown bộ lọc "Nguồn vay" — dùng chung cho mọi modal cần tới (logic checkbox
  // BÌNH THƯỜNG, không có hành vi đặc biệt như Phương án vay).
  function svFundSourceFilterDropdownHtml(idPrefix, selectedList, allFundSources){
    const allSel = selectedList.length===allFundSources.length;
    return `<div class="sv-filter-dropdown">
      <button type="button" class="btn btn-ghost btn-sm preview-allow" id="${idPrefix}-fundsource-btn" style="${!allSel?'border:2px solid #b71c1c;':''}">💰 Nguồn vay (${selectedList.length})</button>
      ${state.openFilterDropdown===idPrefix+'-fundsource'? `<div class="sv-filter-panel">
        <label class="sv-filter-item"><input type="checkbox" id="${idPrefix}-fundsource-all" class="preview-allow" ${allSel?'checked':''}><span><b>Tất cả nguồn vay</b></span></label>
        ${allFundSources.map(fs=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow ${idPrefix}-fundsource-item" data-fs="${escapeHtml(fs)}" ${selectedList.includes(fs)?'checked':''}><span>${escapeHtml(fundSourceDisplay(fs))}</span></label>`).join('')}
      </div>` : ''}
    </div>`;
  }
  // Nối wiring cho cả 2 bộ lọc — QUAN TRỌNG: "Phương án vay" có hành vi ĐẶC BIỆT khác hẳn checkbox
  // thông thường — bấm vào BẤT KỲ 1 phương án nào (kể cả đang được tích) đều làm BỎ CHỌN HẾT TẤT CẢ
  // (kể cả chính nó vừa bấm), sau đó tự cuộn màn hình tới đúng vị trí phương án vừa bấm (căn giữa màn
  // hình nếu có thể, gần đầu/cuối danh sách nếu nó nằm ở đầu/cuối). "Nguồn vay" thì vẫn hoạt động bình
  // thường như checkbox thông thường (tích/bỏ tích độc lập từng cái).
  function wireSvProjectAndFundSourceFilters(container, idPrefix, stateKeyProject, stateKeyFundSource, allProjects, allFundSources, renderFn){
    const pb = container.querySelector('#'+idPrefix+'-project-btn');
    if(pb) pb.onclick=(e)=>{ e.stopPropagation(); state.openFilterDropdown = state.openFilterDropdown===idPrefix+'-project'?null:idPrefix+'-project'; renderFn(); };
    const pAll = container.querySelector('#'+idPrefix+'-project-all');
    if(pAll) pAll.onclick=(e)=>{ e.stopPropagation(); state[stateKeyProject] = pAll.checked? allProjects.map(p=>p.id) : []; renderFn(); };
    container.querySelectorAll('.'+idPrefix+'-project-item').forEach(cb=> cb.onclick=(e)=>{
      e.stopPropagation();
      const pid = cb.dataset.p;
      const wasAllSelected = state[stateKeyProject].length===allProjects.length;
      if(wasAllSelected){
        // CHỈ áp dụng hành vi đặc biệt khi TRƯỚC ĐÓ đang chọn tất cả — bấm vào bất kỳ phương án nào
        // đều làm bỏ chọn HẾT (kể cả cái vừa bấm), rồi tự cuộn tới đúng vị trí phương án đó.
        state[stateKeyProject] = [];
      } else {
        // Đang KHÔNG chọn tất cả (có sẵn 1 vài cái bị bỏ chọn rồi) -> hoạt động như checkbox bình
        // thường, chỉ thêm/bớt đúng 1 phương án vừa bấm, không đụng gì tới các phương án khác.
        state[stateKeyProject] = cb.checked? state[stateKeyProject].concat([pid]) : state[stateKeyProject].filter(x=>x!==pid);
      }
      renderFn();
      // Luôn tự cuộn tới đúng vị trí phương án VỪA BẤM (bất kể đang ở nhánh nào ở trên) — không phụ
      // thuộc vào bất kỳ cơ chế "giữ nguyên vị trí cuộn cũ" nào khác, đảm bảo luôn đúng vị trí thật.
      requestAnimationFrame(()=>{
        const el = document.querySelector(`[data-svp="${pid}"]`);
        if(el) el.scrollIntoView({ block:'center', behavior:'auto' });
      });
    });
    const fb = container.querySelector('#'+idPrefix+'-fundsource-btn');
    if(fb) fb.onclick=(e)=>{ e.stopPropagation(); state.openFilterDropdown = state.openFilterDropdown===idPrefix+'-fundsource'?null:idPrefix+'-fundsource'; renderFn(); };
    const fAll = container.querySelector('#'+idPrefix+'-fundsource-all');
    if(fAll) fAll.onclick=(e)=>{ e.stopPropagation(); state[stateKeyFundSource] = fAll.checked? allFundSources.slice() : []; renderFn(); };
    container.querySelectorAll('.'+idPrefix+'-fundsource-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const fs=cb.dataset.fs; state[stateKeyFundSource] = cb.checked? state[stateKeyFundSource].concat([fs]) : state[stateKeyFundSource].filter(x=>x!==fs); renderFn(); });
  }
  // Dòng chữ đỏ tóm tắt cho "Phương án vay" + "Nguồn vay" — dùng chung.
  function svProjectFundSourceSummaryText(selectedProjectIds, allProjects, selectedFundSources, allFundSources){
    const pAllSel = selectedProjectIds.length===allProjects.length;
    const fAllSel = selectedFundSources.length===allFundSources.length;
    const pText = pAllSel? 'Đang chọn tất cả phương án vay' : (selectedProjectIds.length? `Đang chọn ${selectedProjectIds.length} phương án vay: ${selectedProjectIds.map(id=>{ const p=allProjects.find(x=>x.id===id); return escapeHtml(p?p.name:id); }).join(', ')}` : 'Đang KHÔNG chọn phương án vay nào cả (0 phương án)');
    const fText = fAllSel? 'Đang chọn tất cả nguồn vay' : (selectedFundSources.length? `Đang chọn ${selectedFundSources.length} nguồn vay: ${selectedFundSources.map(escapeHtml).join(', ')}` : 'Đang KHÔNG chọn nguồn vay nào cả (0 nguồn)');
    // Mỗi LOẠI bộ lọc luôn giữ ĐÚNG 1 màu riêng cố định, KHÔNG đổi màu dù bộ lọc thay đổi nội dung như
    // thế nào (từ "tất cả" sang "chỉ chọn vài cái cụ thể") — chỉ có CHỮ thay đổi, màu luôn đồng bộ.
    return ` — <span style="color:#2e7d32;">${pText}</span> — <span style="color:#ad1457;">${fText}</span>`;
  }
  function fundSourcesInUse(){
    return [...new Set((state.borrowers||[]).map(b=>(b.fundSource||'').trim()).filter(Boolean))].sort();
  }
  function ensureFilterFundSourcesInit(sources){
    if(!state.filterFundSources) state.filterFundSources = sources.slice();
  }
  function fundSourceFilterLabel(sources){
    ensureFilterFundSourcesInit(sources);
    const sel = state.filterFundSources;
    if(sel.length===sources.length && sources.length>0) return 'Tất cả nguồn vay';
    if(sel.length===0) return '0 nguồn vay';
    if(sel.length===1) return fundSourceDisplay(sel[0]);
    return `${sel.length} nguồn vay`;
  }
  function toggleFundSourceAll(sources, checked){ state.filterFundSources = checked ? sources.slice() : []; }
  function toggleFundSourceOne(sources, name, checked){
    const set = new Set(state.filterFundSources||[]);
    if(checked) set.add(name); else set.delete(name);
    state.filterFundSources = sources.filter(s=>set.has(s));
  }
  // ---- Bộ lọc "Người quản lý" ----
  function ensureFilterManagersInit(managers){
    if(!state.filterManagerIds) state.filterManagerIds = managers.map(m=>m.id);
  }
  function managerFilterLabel(managers){
    ensureFilterManagersInit(managers);
    const sel = state.filterManagerIds;
    if(sel.length===managers.length && managers.length>0) return 'Tất cả người quản lý';
    if(sel.length===0) return '0 người quản lý';
    if(sel.length===1){ const m=managers.find(x=>x.id===sel[0]); return m? m.name : '1 lựa chọn'; }
    return `${sel.length} người quản lý`;
  }
  function toggleManagerAll(managers, checked){ state.filterManagerIds = checked ? managers.map(m=>m.id) : []; }
  function toggleManagerOne(managers, id, checked){
    const set = new Set(state.filterManagerIds||[]);
    if(checked) set.add(id); else set.delete(id);
    state.filterManagerIds = managers.map(m=>m.id).filter(mid=>set.has(mid));
  }

  // ---- Dựng HTML cho 4 khung dropdown bộ lọc (Ấp/Phương án vay/Quý/Năm) ----
  function buildHamletFilterDropdownHtml(hamlets){
    ensureFilterHamletsInit(hamlets);
    const sel = state.filterHamlets;
    const allChecked = hamlets.length>0 && sel.length===hamlets.length;
    const open = state.openFilterDropdown==='hamlet';
    return `<div class="sv-filter-dropdown">
      <button class="btn btn-ghost btn-sm preview-allow" id="f-hamlet-btn" style="${!allChecked?'border:2px solid #b71c1c;':''}">${escapeHtml(hamletFilterLabel(hamlets))} ▾</button>
      ${open? `<div class="sv-filter-panel">
        <label class="sv-filter-item"><input type="checkbox" class="preview-allow" id="f-hamlet-all" ${allChecked?'checked':''}><span><b>Tất cả địa phương</b></span></label>
        <div class="sv-filter-divider"></div>
        ${hamlets.map(h=>`<label class="sv-filter-item"><input type="checkbox" class="f-hamlet-item preview-allow" data-name="${escapeHtml(h)}" ${sel.includes(h)?'checked':''}><span>${escapeHtml(h)}</span></label>`).join('')}
      </div>` : ''}
    </div>`;
  }
  function buildProjectFilterDropdownHtml(projects){
    ensureFilterProjectsInit(projects);
    const sel = state.filterProjectIds;
    const allChecked = projects.length>0 && sel.length===projects.length;
    const open = state.openFilterDropdown==='project';
    return `<div class="sv-filter-dropdown">
      <button class="btn btn-ghost btn-sm preview-allow" id="f-project-btn" style="${!allChecked?'border:2px solid #b71c1c;':''}">${projectFilterLabel(projects)} ▾</button>
      ${open? `<div class="sv-filter-panel">
        <label class="sv-filter-item"><input type="checkbox" class="preview-allow" id="f-project-all" ${allChecked?'checked':''}><span><b>Tất cả phương án vay</b></span></label>
        <div class="sv-filter-divider"></div>
        ${projects.map(p=>`<label class="sv-filter-item"><input type="checkbox" class="f-project-item preview-allow" data-id="${p.id}" ${sel.includes(p.id)?'checked':''}><span>${escapeHtml(p.name)}</span></label>`).join('')}
      </div>` : ''}
    </div>`;
  }
  function buildFundSourceFilterDropdownHtml(){
    const sources = fundSourcesInUse();
    ensureFilterFundSourcesInit(sources);
    const sel = state.filterFundSources;
    const allChecked = sources.length>0 && sel.length===sources.length;
    const open = state.openFilterDropdown==='fundsource';
    return `<div class="sv-filter-dropdown">
      <button class="btn btn-ghost btn-sm preview-allow" id="f-fundsource-btn" style="${!allChecked?'border:2px solid #b71c1c;':''}">${escapeHtml(fundSourceFilterLabel(sources))} ▾</button>
      ${open? `<div class="sv-filter-panel">
        ${sources.length? `
        <label class="sv-filter-item"><input type="checkbox" class="preview-allow" id="f-fundsource-all" ${allChecked?'checked':''}><span><b>Tất cả nguồn vay</b></span></label>
        <div class="sv-filter-divider"></div>
        ${sources.map(s=>`<label class="sv-filter-item"><input type="checkbox" class="f-fundsource-item preview-allow" data-name="${escapeHtml(s)}" ${sel.includes(s)?'checked':''}><span>${escapeHtml(fundSourceDisplay(s))}</span></label>`).join('')}
        ` : `<div class="sub" style="padding:6px 10px;">Chưa có Nguồn vay nào được nhập.</div>`}
      </div>` : ''}
    </div>`;
  }
  function buildManagerFilterDropdownHtml(){
    const managers = ensureDefaultManagers();
    ensureFilterManagersInit(managers);
    const sel = state.filterManagerIds;
    const allChecked = managers.length>0 && sel.length===managers.length;
    const open = state.openFilterDropdown==='manager';
    return `<div class="sv-filter-dropdown">
      <button class="btn btn-ghost btn-sm preview-allow" id="f-manager-btn" style="${!allChecked?'border:2px solid #b71c1c;':''}">${escapeHtml(managerFilterLabel(managers))} ▾</button>
      ${open? `<div class="sv-filter-panel">
        <label class="sv-filter-item"><input type="checkbox" class="preview-allow" id="f-manager-all" ${allChecked?'checked':''}><span><b>Tất cả người quản lý</b></span></label>
        <div class="sv-filter-divider"></div>
        ${managers.map(m=>`<label class="sv-filter-item"><input type="checkbox" class="f-manager-item preview-allow" data-id="${m.id}" ${sel.includes(m.id)?'checked':''}><span>${escapeHtml(m.name)}</span></label>`).join('')}
      </div>` : ''}
    </div>`;
  }
  function buildQuarterFilterDropdownHtml(){
    ensureFilterQuartersInit();
    const sel = state.filterQuarters;
    const open = state.openFilterDropdown==='quarter';
    const isDefaultQ = sel.length===1 && sel[0]===todayBasedQuarterKey();
    return `<div class="sv-filter-dropdown">
      <button class="btn btn-ghost btn-sm preview-allow" id="f-quarter-btn" title="Áp dụng cho cặp cột Tính lãi từ ngày / đến ngày" style="${!isDefaultQ?'border:2px solid #b71c1c;':''}">${escapeHtml(quarterFilterLabel())} ▾</button>
      ${open? `<div class="sv-filter-panel" id="f-quarter-panel">
        ${QUARTER_FILTER_SEQUENCE.map(key=>{
          const checked = sel.includes(key);
          const isNormalQuarter = ['q1','q2','q3','q4'].includes(key);
          const feasible = isNormalQuarter ? true : quarterCheckboxFeasible(key);
          return `<label class="sv-filter-item ${feasible?'':'disabled'}" ${checked?'data-selected-quarter="1"':''}><input type="checkbox" class="f-quarter-item preview-allow" data-key="${key}" ${checked?'checked':''} ${feasible?'':'disabled'}><span>${QUARTER_FILTER_LABELS[key]}</span></label>`;
        }).join('')}
      </div>` : ''}
    </div>`;
  }
  function buildYearFilterDropdownHtml(){
    ensureFilterYearsInit();
    const sel = state.filterYears;
    const open = state.openFilterDropdown==='year';
    const cy = new Date().getFullYear();
    let itemsHtml = '';
    for(let y=cy-50; y<=cy+50; y++){
      const checked = sel.includes(y);
      itemsHtml += `<label class="sv-filter-item" ${checked?'data-selected-year="1"':''}><input type="checkbox" class="f-year-item preview-allow" data-year="${y}" ${checked?'checked':''}><span>${y}</span></label>`;
    }
    const isDefaultY = sel.length===1 && sel[0]===cy;
    return `<div class="sv-filter-dropdown">
      <button class="btn btn-ghost btn-sm preview-allow" id="f-year-btn" title="Áp dụng cho cặp cột Tính lãi từ ngày / đến ngày" style="${!isDefaultY?'border:2px solid #b71c1c;':''}">${escapeHtml(yearFilterLabel())} ▾</button>
      ${open? `<div class="sv-filter-panel" id="f-year-panel">${itemsHtml}</div>` : ''}
    </div>`;
  }

  function todayBasedQuarterKey(){
    const today = new Date(); today.setHours(0,0,0,0);
    for(const qk of ['q1','q2','q3','q4']){
      const r = resolveQuarterDates(qk);
      if(!r.from || !r.to) continue;
      const s = new Date(r.from+'T00:00:00'), e = new Date(r.to+'T00:00:00');
      if(today>=s && today<=e) return qk;
    }
    return 'q1';
  }
  // Nhãn hiển thị của 1 mã Quý ("q1"->"Quý 1"...) — hàm TOÀN CỤC dùng chung ở nhiều nơi (trước đây có
  // 1 bản khai báo CỤC BỘ bên trong renderReceiptDetailModal, gây lỗi "không định nghĩa" khi các chỗ
  // khác cố gọi tới nó — đây chính là nguyên nhân khiến việc lập Biên lai Thu lãi chưa thanh toán bị
  // crash âm thầm ở bước "Tiếp tục tạo mã QR").
  const quarterLbl = (qk)=> ({q1:'Quý 1',q2:'Quý 2',q3:'Quý 3',q4:'Quý 4'}[qk] || qk);
  function resolveQuarterDatesForYear(qKey, year, overrideQuarters){
    const q = (overrideQuarters && overrideQuarters[qKey]) || (state.config && state.config.quarters && state.config.quarters[qKey]) || DEFAULT_QUARTERS[qKey];
    if(!q || q.startMonth==null || q.endMonth==null) return { from:'', to:'' };
    const pad = n=> String(n).padStart(2,'0');
    const startYear = (q.startMonth > q.endMonth) ? year-1 : year;
    return { from:`${startYear}-${pad(q.startMonth)}-${pad(q.startDay)}`, to:`${year}-${pad(q.endMonth)}-${pad(q.endDay)}` };
  }

  // =====================================================================
  // BỘ LỌC QUÝ/NĂM THỐNG NHẤT (dùng chung cho TOÀN APP) — thay thế hẳn 2 thiết kế cũ tách rời (Quý
  // riêng, Năm riêng rồi ghép lại) — vốn có LỖ HỔNG: ghép 2 bộ lọc độc lập có thể tạo ra "khoảng trống"
  // không mong muốn (VD chọn Quý 1,2,3 × Năm 2025,2026 thì Quý 4/2025 bị bỏ sót mà không ai hay biết).
  // Giải pháp: GỘP VỀ ĐÚNG 1 DANH SÁCH DUY NHẤT, liệt kê TUẦN TỰ theo đúng dòng thời gian thật (Quý
  // 1..4 của từng năm, nối tiếp năm này qua năm khác) — về mặt toán học KHÔNG THỂ tạo ra khoảng trống,
  // vì bản chất chỉ là chọn 1 ĐOẠN LIÊN TỤC trong 1 danh sách đã sắp đúng thứ tự.
  //   • Chọn 2 mốc (bấm 1 mốc, rồi bấm mốc khác) -> tự động chọn HẾT đoạn ở giữa (không hỏi han gì).
  //   • Bỏ chọn ở 2 đầu đoạn -> chỉ bỏ đúng 1 mình mốc đó.
  //   • Bỏ chọn ở GIỮA đoạn -> cắt bỏ luôn toàn bộ phần từ đó về sau (giữ lại phần "quá khứ").
  //   • Bỏ hết sạch -> tự động quay về mặc định (đúng Quý+Năm hiện tại).
  // =====================================================================
  const TIMELINE_SPAN_YEARS_BACK = 25, TIMELINE_SPAN_YEARS_FWD = 10;
  const TIMELINE_SEQ = (()=>{
    const cy = new Date().getFullYear();
    const out = [];
    for(let y=cy-TIMELINE_SPAN_YEARS_BACK; y<=cy+TIMELINE_SPAN_YEARS_FWD; y++){
      ['q1','q2','q3','q4'].forEach(qk=> out.push({ key:`${qk}_${y}`, qk, year:y, label:`${({q1:'Quý 1',q2:'Quý 2',q3:'Quý 3',q4:'Quý 4'})[qk]}/${y}` }));
    }
    return out;
  })();
  const TIMELINE_INDEX_BY_KEY = (()=>{ const m={}; TIMELINE_SEQ.forEach((t,i)=> m[t.key]=i); return m; })();
  function timelineSeqIndex(key){ return TIMELINE_INDEX_BY_KEY[key]; }
  function timelineDefaultKey(){ return `${todayBasedQuarterKey()}_${new Date().getFullYear()}`; }
  function ensureTimelineFilterInit(prefix){
    const sk = prefix+'Timeline';
    if(!state[sk] || !state[sk].length) state[sk] = [timelineDefaultKey()];
  }
  function timelineFilterIsDefault(prefix){
    ensureTimelineFilterInit(prefix);
    const sel = state[prefix+'Timeline'];
    return sel.length===1 && sel[0]===timelineDefaultKey();
  }
  function resetTimelineFilter(prefix){ state[prefix+'Timeline'] = [timelineDefaultKey()]; }
  function toggleTimelineFilter(prefix, key, checked){
    ensureTimelineFilterInit(prefix);
    const sk = prefix+'Timeline';
    const sel = state[sk];
    if(checked){
      if(sel.includes(key)) return false;
      // Mở rộng đoạn đang chọn để BAO TRỌN luôn cả mốc vừa bấm — tự động lấp đầy mọi khoảng trống ở
      // giữa (nếu có), đảm bảo kết quả LUÔN là 1 đoạn liên tục theo đúng dòng thời gian thật.
      const idxs = sel.map(timelineSeqIndex);
      const keyIdx = timelineSeqIndex(key);
      const newMin = Math.min(...idxs, keyIdx), newMax = Math.max(...idxs, keyIdx);
      state[sk] = TIMELINE_SEQ.slice(newMin, newMax+1).map(t=>t.key);
      return true;
    } else {
      if(sel.length<=1) return false;
      const keyIdx = timelineSeqIndex(key);
      const idxs = sel.map(timelineSeqIndex);
      const minIdx = Math.min(...idxs), maxIdx = Math.max(...idxs);
      let newSel;
      if(keyIdx===minIdx || keyIdx===maxIdx){
        newSel = sel.filter(k=>k!==key);
      } else {
        newSel = sel.filter(k=> timelineSeqIndex(k) < keyIdx);
      }
      if(!newSel.length){ resetTimelineFilter(prefix); return true; }
      state[sk] = newSel;
      return true;
    }
  }
  function timelineFilterLabel(prefix){
    ensureTimelineFilterInit(prefix);
    const sel = state[prefix+'Timeline'];
    if(sel.length===1) return TIMELINE_SEQ[timelineSeqIndex(sel[0])].label;
    const idxs = sel.map(timelineSeqIndex).sort((a,b)=>a-b);
    return `${TIMELINE_SEQ[idxs[0]].label} → ${TIMELINE_SEQ[idxs[idxs.length-1]].label}`;
  }
  // Chuyển bộ lọc đã chọn thành tập hợp {qk,year} cụ thể — dùng cho các nơi cần tính theo tỷ lệ phân
  // bổ riêng từng khoản vay (VD Sổ Thu Chi Lãi Quỹ, báo cáo theo kỳ).
  function timelineFilterToQuarterSet(prefix){
    ensureTimelineFilterInit(prefix);
    return state[prefix+'Timeline'].map(k=>{ const t = TIMELINE_SEQ[timelineSeqIndex(k)]; return { qk:t.qk, year:t.year }; });
  }
  // Chuyển bộ lọc đã chọn thành khoảng ngày bao trọn (from/to) — dùng cho các nơi chỉ cần lọc đơn giản
  // theo khoảng ngày (VD Hộp biên lai, Nhật ký hoạt động, panel Danh sách khoản vay).
  function timelineFilterToDateRange(prefix){
    const qs = timelineFilterToQuarterSet(prefix);
    let from=null, to=null;
    qs.forEach(({qk,year})=>{
      const r = resolveQuarterDatesForYear(qk, year);
      if(!r.from || !r.to) return;
      if(from===null || r.from<from) from = r.from;
      if(to===null || r.to>to) to = r.to;
    });
    return { from: from||todayStr(), to: to||todayStr() };
  }
  function buildTimelineFilterDropdownHtml(prefix){
    ensureTimelineFilterInit(prefix);
    const sel = state[prefix+'Timeline'];
    const open = state.openFilterDropdown===(prefix+'Timeline');
    return `<div class="sv-filter-dropdown">
      <button type="button" class="btn btn-ghost btn-sm preview-allow" id="${prefix}-timeline-btn" style="${!timelineFilterIsDefault(prefix)?'border:2px solid #b71c1c;':''}">${escapeHtml(timelineFilterLabel(prefix))} ▾</button>
      ${open? `<div class="sv-filter-panel" id="${prefix}-timeline-panel-outer" style="position:relative; display:flex; padding-right:44px; max-height:280px;">
        <div id="${prefix}-timeline-panel" style="overflow-y:auto; flex:1;">
          ${TIMELINE_SEQ.map(t=>{ const checked = sel.includes(t.key); return `<label class="sv-filter-item" ${checked?`data-selected-timeline="1"`:''}><input type="checkbox" class="${prefix}-timeline-item preview-allow" data-key="${t.key}" ${checked?'checked':''}><span>${t.label}</span></label>`; }).join('')}
        </div>
        <div style="position:absolute; right:6px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:8px;">
          <button type="button" class="pg-suggest-scroll-btn preview-allow" id="${prefix}-timeline-up-btn" title="Cuộn lên">▲</button>
          <button type="button" class="pg-suggest-scroll-btn preview-allow" id="${prefix}-timeline-down-btn" title="Cuộn xuống">▼</button>
        </div>
      </div>` : ''}
    </div>`;
  }
  // container: phần tử gốc để TÌM KIẾM giới hạn bên trong (thường là "wrap" của modal, hoặc "el" của
  // panel chính) — QUAN TRỌNG: nếu tìm kiếm trên toàn document (getElementById), khi 1 modal đang mở
  // ĐÈ LÊN panel chính (panel chính vẫn còn nguyên trong trang, không hề bị gỡ đi), sẽ dễ tìm NHẦM
  // phải phần tử của panel chính (ẩn phía sau) thay vì phần tử THẬT SỰ đang hiển thị trong modal —
  // đây chính là lỗi đã xảy ra trước đây, nay khắc phục bằng cách luôn giới hạn tìm kiếm đúng container.
  function wireTimelineFilterDropdown(prefix, onChange, container){
    const root = container || document;
    const btn = root.querySelector(`#${prefix}-timeline-btn`);
    if(btn) btn.onclick = (e)=>{ e.stopPropagation(); state.openFilterDropdown = state.openFilterDropdown===(prefix+'Timeline')?null:(prefix+'Timeline'); onChange(); };
    root.querySelectorAll(`.${prefix}-timeline-item`).forEach(cb=> cb.onclick = (e)=>{
      e.stopPropagation();
      toggleTimelineFilter(prefix, cb.dataset.key, cb.checked);
      onChange();
    });
    // Mở dropdown -> tự cuộn tới đúng mốc đang chọn cho đỡ phải kéo tay
    const panel = root.querySelector(`#${prefix}-timeline-panel`);
    if(panel){
      const selEl = panel.querySelector('[data-selected-timeline]');
      if(selEl) selEl.scrollIntoView({ block:'center' });
      // 2 nút cuộn mũi tên lên/xuống — y hệt cơ chế "Gợi ý tạo bài": rê chuột vào/bấm giữ -> cuộn liên
      // tục; bấm nhanh 1 cái -> cuộn 1 đoạn ngắn.
      const wireScrollBtn = (btn2, dir)=>{
        if(!btn2) return;
        let timer=null, downAt=0;
        const start=()=>{ if(timer) return; timer=setInterval(()=>{ panel.scrollTop += dir*3; }, 16); };
        const stop=()=>{ if(timer){ clearInterval(timer); timer=null; } };
        btn2.addEventListener('mouseenter', start);
        btn2.addEventListener('mouseleave', stop);
        btn2.addEventListener('mousedown', (e)=>{ e.preventDefault(); e.stopPropagation(); downAt=Date.now(); start(); });
        btn2.addEventListener('touchstart', (e)=>{ e.stopPropagation(); downAt=Date.now(); start(); }, {passive:true});
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchend', stop);
        btn2.addEventListener('click', (e)=>{ e.stopPropagation(); if(Date.now()-downAt<260) panel.scrollBy({ top: dir*140, behavior:'smooth' }); });
      };
      wireScrollBtn(root.querySelector(`#${prefix}-timeline-up-btn`), -1);
      wireScrollBtn(root.querySelector(`#${prefix}-timeline-down-btn`), 1);
    }
    // Callback "onChange" MỚI NHẤT luôn được ghi đè vào đây — vì listener bấm-ra-ngoài bên dưới chỉ
    // được gắn 1 LẦN DUY NHẤT cho toàn app (tránh chồng chất nhiều listener), nó cần luôn gọi đúng
    // callback của ngữ cảnh (modal/panel) đang hiển thị GẦN NHẤT, không phải ngữ cảnh đầu tiên từng gọi.
    state._timelineFilterOnChange = onChange;
    if(!state._timelineFilterOutsideClickBound){
      state._timelineFilterOutsideClickBound = true;
      document.addEventListener('click', (e)=>{
        if(!state.openFilterDropdown || !String(state.openFilterDropdown).endsWith('Timeline')) return;
        if(e.target.closest('.sv-filter-dropdown')) return;
        state.openFilterDropdown = null;
        if(state._timelineFilterOnChange) state._timelineFilterOnChange();
      });
    }
  }

  // =====================================================================
  // BỘ LỌC QUÝ — đa chọn nhưng CHỈ được liền kề nhau, theo đúng thứ tự cố định:
  // Quý 2(trước) → Quý 3(trước) → Quý 4(trước) → Quý 1 → Quý 2 → Quý 3 → Quý 4 → Quý 1(sau) →
  // Quý 2(sau) → Quý 3(sau).
  // Mặc định ban đầu: đúng 1 Quý hiện tại (theo hôm nay), CHƯA ở "chế độ nâng cao".
  //   • Nếu Quý hiện tại là Quý 1 và người dùng bấm thêm "Quý 4 (năm trước)" — ĐẶC BIỆT: Quý 1
  //     KHÔNG bị mất tích chọn, kết quả là {Quý 4(trước), Quý 1} cùng được chọn.
  //   • Tương tự nếu Quý hiện tại là Quý 4 và bấm thêm "Quý 1 (năm sau)" — giữ nguyên Quý 4, kết
  //     quả {Quý 4, Quý 1(sau)}.
  //   • Mọi trường hợp khác: bấm 1 Quý thường khác sẽ THAY THẾ hẳn mốc mặc định (mốc cũ mất tích
  //     chọn) và bật "chế độ nâng cao" — từ đó mọi thao tác thêm/bớt đều phải giữ đúng liền kề.
  // =====================================================================
  const QUARTER_FILTER_SEQUENCE = ['q2prev','q3prev','q4prev','q1','q2','q3','q4','q1next','q2next','q3next'];
  const QUARTER_FILTER_LABELS = {
    q2prev:'Quý 2 (năm trước)', q3prev:'Quý 3 (năm trước)', q4prev:'Quý 4 (năm trước)',
    q1:'Quý 1', q2:'Quý 2', q3:'Quý 3', q4:'Quý 4',
    q1next:'Quý 1 (năm sau)', q2next:'Quý 2 (năm sau)', q3next:'Quý 3 (năm sau)',
  };
  const QUARTER_FILTER_SPECIAL_KEYS = ['q2prev','q3prev','q4prev','q1next','q2next','q3next'];
  function quarterSeqIndex(key){ return QUARTER_FILTER_SEQUENCE.indexOf(key); }
  function isContiguousIdxList(indices){
    const sorted = indices.slice().sort((a,b)=>a-b);
    for(let i=1;i<sorted.length;i++) if(sorted[i]!==sorted[i-1]+1) return false;
    return true;
  }
  function ensureFilterQuartersInit(){
    if(!state.filterQuarters){ state.filterQuarters = [todayBasedQuarterKey()]; state.filterQuartersAdvanced = false; }
  }
  function quarterFilterLabel(){
    ensureFilterQuartersInit();
    const sel = state.filterQuarters;
    if(sel.length===1) return QUARTER_FILTER_LABELS[sel[0]];
    return `${sel.length}-quý`;
  }
  function quarterCheckboxFeasible(key){
    ensureFilterQuartersInit();
    const sel = state.filterQuarters;
    if(sel.includes(key)) return true;
    if(!state.filterQuartersAdvanced && sel.length===1){
      const current = sel[0];
      if((current==='q1' && key==='q4prev') || (current==='q4' && key==='q1next')) return true;
      return !QUARTER_FILTER_SPECIAL_KEYS.includes(key);
    }
    const idxs = sel.map(quarterSeqIndex);
    const minI = Math.min(...idxs), maxI = Math.max(...idxs);
    const keyIdx = quarterSeqIndex(key);
    // Yêu cầu mới: cho phép TẤT CẢ 10 lựa chọn (kể cả trộn "năm trước" và "năm sau") cùng chung 1
    // bộ lọc, miễn là vẫn liền kề nhau và đã có ít nhất 1 Quý thường (Q1-4) làm nền trước đó.
    return keyIdx===minI-1 || keyIdx===maxI+1;
  }
  function toggleQuarterFilter(key, checked){
    ensureFilterQuartersInit();
    const sel = state.filterQuarters;
    if(!state.filterQuartersAdvanced && sel.length===1){
      const current = sel[0];
      if(checked){
        // Trường hợp đặc biệt: Quý 1 + Quý 4(trước) hoặc Quý 4 + Quý 1(sau) -> GIỮ NGUYÊN mốc mặc định
        if(current==='q1' && key==='q4prev'){ state.filterQuarters = ['q4prev','q1']; state.filterQuartersAdvanced = true; return true; }
        if(current==='q4' && key==='q1next'){ state.filterQuarters = ['q4','q1next']; state.filterQuartersAdvanced = true; return true; }
        if(QUARTER_FILTER_SPECIAL_KEYS.includes(key)){
          alert('Vui lòng chọn các Quý liền kề (Quý 1, 2, 3, 4) trước khi chọn Quý đặc biệt (năm trước)/(năm sau).');
          return false;
        }
        if(key===current) return false;
        // Mọi Quý thường khác -> THAY THẾ hẳn mốc mặc định
        state.filterQuarters = [key];
        state.filterQuartersAdvanced = true;
        return true;
      }
      return false; // không cho bỏ chọn mốc mặc định duy nhất
    }
    if(checked){
      if(sel.includes(key)) return false;
      const isNormalQuarter = ['q1','q2','q3','q4'].includes(key);
      const newSel = sel.concat([key]);
      if(!isContiguousIdxList(newSel.map(quarterSeqIndex))){
        if(isNormalQuarter){
          // Yêu cầu mới: 4 Quý thường LUÔN cho chọn được — nếu vi phạm liền kề thì reset lại, chỉ
          // còn giữ đúng Quý vừa bấm (các tích chọn khác biến mất), quay về như mốc mặc định mới.
          state.filterQuarters = [key];
          state.filterQuartersAdvanced = false;
          return true;
        }
        alert('Chỉ được chọn các Quý LIỀN KỀ nhau. Vui lòng chọn đúng thứ tự liên tiếp.');
        return false;
      }
      state.filterQuarters = newSel.sort((a,b)=>quarterSeqIndex(a)-quarterSeqIndex(b));
      return true;
    } else {
      if(sel.length<=1) return false;
      const keyIdx = quarterSeqIndex(key);
      const selIndices = sel.map(quarterSeqIndex);
      const minIdx = Math.min(...selIndices), maxIdx = Math.max(...selIndices);
      let newSel;
      if(keyIdx===minIdx || keyIdx===maxIdx){
        // Bỏ chọn ở 1 trong 2 ĐẦU dãy (cũ nhất hoặc mới nhất) -> chỉ bỏ đúng 1 mình nó, phần còn
        // lại vẫn liên tục nên giữ nguyên toàn bộ, không cần xoá dây chuyền.
        newSel = sel.filter(k=>k!==key);
      } else {
        // Bỏ chọn ở GIỮA dãy -> giữ lại phần "quá khứ" (nhỏ hơn), bỏ hết phần từ đó trở về sau (yêu
        // cầu cũ) — vì bỏ 1 Quý ở giữa sẽ làm gãy tính liên tục của dãy.
        newSel = sel.filter(k=> quarterSeqIndex(k) < keyIdx);
      }
      const hasNormal = newSel.some(k=>['q1','q2','q3','q4'].includes(k));
      if(!hasNormal) newSel = []; // còn lại toàn Quý đặc biệt (không được đứng 1 mình) -> dọn sạch
      if(!newSel.length){
        state.filterQuarters = [todayBasedQuarterKey()];
        state.filterQuartersAdvanced = false;
        return true;
      }
      state.filterQuarters = newSel;
      return true;
    }
  }

  // =====================================================================
  // BỘ LỌC NĂM — đa chọn nhưng CHỈ được liền kề nhau, tối đa 25 năm liên tiếp, KHÔNG có "chọn tất
  // cả". Cùng cơ chế mặc định/nâng cao như bộ lọc Quý ở trên.
  // =====================================================================
  const YEAR_FILTER_MAX_SPAN = 25;
  function ensureFilterYearsInit(){
    if(!state.filterYears){ state.filterYears = [new Date().getFullYear()]; state.filterYearsAdvanced = false; }
  }
  function yearFilterLabel(){
    ensureFilterYearsInit();
    const sel = state.filterYears;
    if(sel.length===1) return `Năm ${sel[0]}`;
    return `${sel.length}-năm`;
  }
  function yearCheckboxFeasible(year){
    ensureFilterYearsInit();
    const sel = state.filterYears;
    if(sel.includes(year)) return true;
    if(!state.filterYearsAdvanced && sel.length===1) return true;
    const minY = sel[0], maxY = sel[sel.length-1];
    if(year===minY-1 || year===maxY+1) return sel.length+1 <= YEAR_FILTER_MAX_SPAN;
    return false;
  }
  // Khôi phục CẢ 4 bộ lọc (Ấp/Phương án vay/Quý/Năm) về đúng trạng thái mặc định ban đầu.
  // Trả về đúng 4 Quý liên tiếp: Quý hiện tại + 3 Quý liền TRƯỚC đó (dùng làm mặc định cho các
  // modal Gia hạn nợ / Tất toán-Trả nợ trước hạn / Tính tiền lãi và phê duyệt đóng lãi).
  function rollingQuarterFilterDefault(){
    const cur = todayBasedQuarterKey();
    const idx = quarterSeqIndex(cur);
    return QUARTER_FILTER_SEQUENCE.slice(Math.max(0,idx-3), idx+1);
  }
  // Panel "Danh sách người vay" LUÔN mặc định đúng 1 Quý hiện tại (khác 3 modal Gia hạn/Tất toán/
  // Tính tiền lãi dùng cuộn 4 Quý) — vì state.filterQuarters là biến DÙNG CHUNG, nên mỗi khi ĐÓNG 1
  // trong 3 modal đó, phải chủ động trả bộ lọc về lại 1-Quý-hiện-tại để Panel không bị "lây" theo.
  function restoreSingleQuarterFilterForPanel(){
    state.filterQuarters = [todayBasedQuarterKey()];
    state.filterQuartersAdvanced = false;
    resetTimelineFilter('main');
  }
  // Làm mới NGAY modal "Phê duyệt tất toán khoản vay hoặc trả nợ trước hạn" (nếu đang mở phía sau 1
  // biên lai con vừa đóng) — để người vay vừa xử lý xong CHUYỂN NGAY sang đúng danh sách tương ứng,
  // không cần tắt mở lại cả modal mới thấy.
  function refreshOpenSettlementModal(){
    const w = document.querySelector('[data-settlement-modal]');
    if(w && w._refreshSettlement) w._refreshSettlement();
  }
  // Kiểm tra xem có BẤT KỲ bộ lọc (hoặc khung tìm kiếm) nào đang khác mặc định hay không — dùng để
  // quyết định nút "Khôi phục bộ lọc gốc" có cần sáng lên (chuyển màu chậm) hay không.
  function anyBorrowerFilterActive(hamlets, projects){
    if(state.search!=='' && state.search!==' ') return true;
    if(state.filterHamlets.length < hamlets.length) return true;
    if(state.filterProjectIds.length < projects.length) return true;
    const fs = fundSourcesInUse();
    if(state.filterFundSources.length < fs.length) return true;
    const mgrs = ensureDefaultManagers();
    if(state.filterManagerIds.length < mgrs.length) return true;
    if(!(state.filterQuarters && state.filterQuarters.length===1 && state.filterQuarters[0]===todayBasedQuarterKey())) return true;
    if(!(state.filterYears && state.filterYears.length===1 && state.filterYears[0]===new Date().getFullYear())) return true;
    return false;
  }
  function resetFilterBtnClass(hamlets, projects){ return anyBorrowerFilterActive(hamlets, projects) ? 'reset-filter-active' : ''; }
  function resetAllBorrowerFilters(hamlets, projects, rollingQuarters){
    state.search = '';
    state.filterHamlets = hamlets.slice();
    state.filterProjectIds = projects.map(p=>p.id);
    state.filterFundSources = fundSourcesInUse();
    state.filterManagerIds = ensureDefaultManagers().map(m=>m.id);
    if(rollingQuarters){
      state.filterQuarters = rollingQuarterFilterDefault();
      state.filterQuartersAdvanced = true;
      const curIdx = timelineSeqIndex(timelineDefaultKey());
      state.mainTimeline = TIMELINE_SEQ.slice(Math.max(0,curIdx-3), curIdx+1).map(t=>t.key);
    } else {
      state.filterQuarters = [todayBasedQuarterKey()];
      state.filterQuartersAdvanced = false;
      resetTimelineFilter('main');
    }
    state.filterYears = [new Date().getFullYear()];
    state.filterYearsAdvanced = false;
    state.openFilterDropdown = null;
  }
  function toggleYearFilter(year, checked){
    ensureFilterYearsInit();
    const sel = state.filterYears;
    if(!state.filterYearsAdvanced && sel.length===1){
      if(checked){
        if(year===sel[0]) return false;
        state.filterYears = [year];
        state.filterYearsAdvanced = true;
        return true;
      }
      return false;
    }
    if(checked){
      if(sel.includes(year)) return false;
      const newSel = sel.concat([year]).sort((a,b)=>a-b);
      const contiguousOk = newSel[newSel.length-1]-newSel[0]+1 === newSel.length;
      const withinMax = newSel.length <= YEAR_FILTER_MAX_SPAN;
      if(!contiguousOk || !withinMax){
        // Yêu cầu mới: Năm LUÔN cho chọn được — nếu vi phạm liền kề (hoặc vượt tối đa) thì reset
        // lại, chỉ còn giữ đúng Năm vừa bấm (các tích chọn khác biến mất).
        state.filterYears = [year];
        state.filterYearsAdvanced = true;
        return true;
      }
      state.filterYears = newSel;
      return true;
    } else {
      if(sel.length<=1) return false;
      const minY = Math.min(...sel), maxY = Math.max(...sel);
      let newSel;
      if(year===minY || year===maxY){
        // Bỏ chọn ở 1 trong 2 ĐẦU dãy (năm cũ nhất hoặc mới nhất) -> chỉ bỏ đúng 1 mình nó.
        newSel = sel.filter(y=>y!==year);
      } else {
        // Bỏ chọn ở GIỮA dãy -> giữ lại phần "quá khứ" (nhỏ hơn), bỏ hết phần từ đó trở về sau.
        newSel = sel.filter(y=> y < year);
      }
      if(!newSel.length){
        state.filterYears = [new Date().getFullYear()];
        state.filterYearsAdvanced = false;
        return true;
      }
      state.filterYears = newSel;
      return true;
    }
  }

  // Ghép bộ lọc Quý + Năm lại thành 1 khoảng ngày LIÊN TỤC duy nhất — Quý đầu tiên (theo thứ tự
  // liền kề) neo vào Năm nhỏ nhất, Quý cuối cùng neo vào Năm lớn nhất; các Quý đặc biệt tự lùi 1
  // năm (nhóm "...prev") hoặc tiến 1 năm (nhóm "...next") so với năm neo.
  function selectedQuarterYearRange(){
    return timelineFilterToDateRange('main');
  }
  // Suy ra dạng "Quý tương đối" (q2prev...q3next) + Năm CŨ — CHỈ khi lựa chọn hiện tại nằm gọn trong
  // phạm vi biểu diễn được của thiết kế CŨ (quanh năm hiện tại, tối đa lùi/tiến 1 năm theo đúng dãy 10
  // mục cũ) — dùng để GIỮ NGUYÊN khả năng đọc được dữ liệu "đã phê duyệt đóng lãi" đã lưu TRƯỚC ĐÂY
  // (khoá lưu theo định dạng cũ). Nếu lựa chọn vượt ra ngoài phạm vi này (khả năng MỚI, trước đây
  // không thể chọn được) thì trả về null — lúc đó dùng thẳng khoá theo định dạng mới, an toàn tuyệt
  // đối vì KHÔNG THỂ có dữ liệu cũ nào được lưu dưới tổ hợp chưa từng chọn được trước đây.
  function deriveLegacyFilterFromTimeline(){
    const sel = state.mainTimeline||[];
    if(!sel.length) return null;
    const cy = new Date().getFullYear();
    const legacyQ = [], legacyY = new Set();
    for(const key of sel){
      const t = TIMELINE_SEQ[timelineSeqIndex(key)];
      if(!t) return null;
      let qKey;
      if(t.year===cy) qKey = t.qk;
      else if(t.year===cy-1 && t.qk!=='q1') qKey = t.qk+'prev';
      else if(t.year===cy+1 && t.qk!=='q4') qKey = t.qk+'next';
      else return null; // vượt ngoài phạm vi biểu diễn được của thiết kế cũ
      legacyQ.push(qKey);
      legacyY.add(t.year);
    }
    return { filterQuarters: legacyQ, filterYears: Array.from(legacyY) };
  }
  // Dòng chú thích "Đang được tính từ ngày...đến ngày... (X ngày) theo bộ lọc quý và năm" — dùng
  // chung cho Danh sách người vay, Tính tiền lãi và phê duyệt đóng lãi, Gia hạn nợ.
  function quarterYearFilterCaptionHtml(){
    const r = selectedQuarterYearRange();
    if(!r.from || !r.to) return '';
    const days = Math.max(0, daysBetween(r.from, r.to));
    return `<p class="sub" style="margin:6px 0 0;">Đang được tính từ ngày ${fmtDate(r.from)} đến ngày ${fmtDate(r.to)} (${days} ngày) theo bộ lọc quý và năm</p>`;
  }
  // Yêu cầu mới: cặp cột "Tính lãi từ ngày"/"đến ngày" LUÔN hiển thị đúng Quý HIỆN TẠI THẬT (theo
  // hôm nay) — KHÔNG còn bị ảnh hưởng bởi bộ lọc Quý/Năm nữa (bộ lọc giờ chỉ dùng để ẩn/hiện theo
  // khoảng Ngày vay -> Ngày đến hạn, xem selectedQuarterYearRangeForFilter()).
  // Tổng số ngày của TRỌN 1 chu kỳ năm (Quý 1.Bắt đầu -> Quý 4.Kết thúc) của NĂM cụ thể — dùng
  // chung cho mọi công thức tính lãi (365 ngày năm thường, 366 ngày năm nhuận).
  function annualCycleDaysForYear(Y, overrideQuarters){
    const cfgQ = overrideQuarters || (state.config && state.config.quarters) || DEFAULT_QUARTERS;
    const q1 = cfgQ.q1 || DEFAULT_QUARTERS.q1, q4 = cfgQ.q4 || DEFAULT_QUARTERS.q4;
    const pad = n=> String(n).padStart(2,'0');
    // QUAN TRỌNG: Quý 1.Bắt đầu LUÔN đúng bằng Quý 4.Kết thúc (do cơ chế đồng bộ mốc liền kề) — nên
    // so sánh CHỈ bằng "tháng bắt đầu > tháng kết thúc" bị sai khi 2 tháng đó TRÙNG NHAU (ví dụ mặc
    // định đều là tháng 12) mà không xét thêm ngày, khiến hệ thống hiểu nhầm là "không vắt năm" và
    // tính ra tổng chu kỳ chỉ 0-1 ngày thay vì 365/366. Phải so sánh đủ cả tháng LẪN ngày.
    const q1AfterQ4 = (q1.startMonth > q4.endMonth) || (q1.startMonth===q4.endMonth && q1.startDay >= q4.endDay);
    const cycleStartYear = q1AfterQ4 ? Y-1 : Y;
    const start = new Date(`${cycleStartYear}-${pad(q1.startMonth)}-${pad(q1.startDay)}T00:00:00`);
    const end = new Date(`${Y}-${pad(q4.endMonth)}-${pad(q4.endDay)}T00:00:00`);
    return Math.max(1, Math.round((end-start)/86400000));
  }
  // Ngày kết thúc chu kỳ năm Y (= Quý 4 kết thúc năm Y) — dùng làm ranh giới để TÁCH ĐOẠN khi 1
  // khoảng thời gian (vd 1 đợt gia hạn) vắt qua nhiều năm dương lịch khác nhau.
  function annualCycleBoundaryDateForYear(Y){
    const cfgQ = (state.config && state.config.quarters) || DEFAULT_QUARTERS;
    const q4 = cfgQ.q4 || DEFAULT_QUARTERS.q4;
    const pad = n=> String(n).padStart(2,'0');
    return new Date(`${Y}-${pad(q4.endMonth)}-${pad(q4.endDay)}T00:00:00`);
  }
  function currentQuarterRange(){
    const qk = todayBasedQuarterKey();
    const r = resolveQuarterDatesForYear(qk, new Date().getFullYear());
    return { qk, from:r.from, to:r.to };
  }
  // Tổng số ngày của TRỌN 1 chu kỳ năm (Quý 1.Bắt đầu -> Quý 4.Kết thúc) của NĂM HIỆN TẠI THẬT.
  function currentAnnualCycleDays(){ return annualCycleDaysForYear(new Date().getFullYear()); }
  // Tính tiền lãi cho 1 khoảng ngày [from,to] BẤT KỲ theo đúng công thức chuẩn: Gốc × (Lãi suất ÷
  // tổng ngày chu kỳ năm) × số ngày — nhưng nếu khoảng đó VẮT QUA NHIỀU NĂM DƯƠNG LỊCH khác nhau
  // (có năm nhuận có năm không), sẽ tự động TÁCH ĐOẠN tại từng ranh giới năm rồi cộng dồn riêng
  // từng đoạn theo đúng tổng số ngày của NĂM đó — đảm bảo không lấy sai 365/366 khi vắt năm.
  function computeInterestAmountAcrossYears(principal, ratePct, fromStr, toStr){
    if(!fromStr || !toStr || !ratePct) return 0;
    const from = new Date(fromStr+'T00:00:00'), to = new Date(toStr+'T00:00:00');
    if(isNaN(from.getTime()) || isNaN(to.getTime()) || to<=from) return 0;
    let amount = 0, segStart = from, guard = 0;
    while(segStart < to && guard++ < 50){
      let boundary = annualCycleBoundaryDateForYear(segStart.getFullYear());
      if(boundary <= segStart) boundary = annualCycleBoundaryDateForYear(segStart.getFullYear()+1);
      const segEnd = boundary < to ? boundary : to;
      const days = Math.round((segEnd - segStart)/86400000);
      const cycleDays = annualCycleDaysForYear(boundary.getFullYear());
      amount += principal * ((ratePct||0)/100/cycleDays) * days;
      segStart = segEnd;
    }
    return Math.round(amount);
  }
  // Danh sách "hộp chứa" của 1 người vay ĐANG THOẢ MÃN bộ lọc Quý/Năm hiện hành — tức là hộp đó có
  // GIAO THẬT SỰ với khoảng ngày bộ lọc đang chọn (chạm đúng 1 điểm KHÔNG tính là giao nhau, giống
  // hệt quy ước "không trùng" đã dùng khi validate mốc 4 Quý).
  function borrowerMatchingQuarterBoxes(b){
    const range = selectedQuarterYearRange();
    if(!range.from || !range.to) return [];
    const rFrom = new Date(range.from+'T00:00:00'), rTo = new Date(range.to+'T00:00:00');
    return borrowerQuarterBoxes(b).filter(box=>{
      const bf = new Date(box.from+'T00:00:00'), bt = new Date(box.to+'T00:00:00');
      return bf < rTo && bt > rFrom;
    });
  }
  // Yêu cầu mới: bộ lọc Quý/Năm ẩn/hiện Phương án vay (kèm người vay bên trong) dựa theo "hệ thống
  // hộp chứa Quý" — người vay chỉ hiển thị nếu có ÍT NHẤT 1 hộp chứa (trong hạn hoặc bất kỳ lần gia
  // hạn nào) giao thật sự với khoảng bộ lọc đang chọn.
  function borrowerLoanRangeMatchesFilter(b){
    if(!b.loanDate || !b.dueDate) return true;
    return borrowerMatchingQuarterBoxes(b).length > 0;
  }
  // Yêu cầu mới: cặp cột "Tính lãi từ ngày"/"đến ngày" giờ lấy NGÀY SỚM NHẤT trong số các hộp chứa
  // đang khớp bộ lọc làm "Tính lãi từ ngày", và NGÀY MUỘN NHẤT làm "đến ngày" (so sánh chuỗi ISO
  // yyyy-mm-dd là đủ chính xác vì đúng thứ tự thời gian).
  function borrowerCurrentQuarterRange(b){
    const boxes = borrowerMatchingQuarterBoxes(b);
    if(!boxes.length) return { from:'', to:'' };
    let minFrom = boxes[0].from, maxTo = boxes[0].to;
    boxes.forEach(bx=>{ if(bx.from<minFrom) minFrom=bx.from; if(bx.to>maxTo) maxTo=bx.to; });
    return { from:minFrom, to:maxTo };
  }
  function borrowerCurrentQuarterDays(b){
    const { from, to } = borrowerCurrentQuarterRange(b);
    if(!from || !to) return 0;
    return Math.max(0, daysBetween(from, to));
  }
  // Tổng số ngày của các hộp chứa ĐANG KHỚP BỘ LỌC mà thuộc đúng 1 cấp cụ thể — level=0 là "trong
  // hạn" (extLevel gốc), level=1..5 là "gia hạn lần N". Không có hộp nào khớp -> trả về 0.
  function matchingBoxesDaysForLevel(b, level){
    return borrowerMatchingQuarterBoxes(b).filter(bx=>bx.extLevel===level).reduce((s,bx)=>s+bx.days, 0);
  }
  // Số tiền lãi (của đúng 1 cấp: trong hạn hoặc gia hạn lần N) — cộng dồn TỪNG HỘP CHỨA khớp bộ lọc
  // riêng lẻ (mỗi hộp dùng đúng tổng số ngày trong NĂM mà nó thuộc về — annualCycleDaysForYear(box.year)
  // — nên tự động đúng năm nhuận/không nhuận dù các hộp nằm ở nhiều năm khác nhau).
  function matchingBoxesInterestAmountForLevel(b, level, ratePct){
    const principal = parseFloat(b.principal)||0;
    const amount = borrowerMatchingQuarterBoxes(b).filter(bx=>bx.extLevel===level).reduce((sum,bx)=>{
      const cycleDays = annualCycleDaysForYear(bx.year, b.frozenQuarterConfig);
      return sum + principal * ((ratePct||0)/100/cycleDays) * bx.days;
    }, 0);
    return Math.round(amount);
  }

  // =====================================================================
  // DỮ LIỆU GIA HẠN NỢ — lưu tại secretdata/{secretId}/loanExtensions/{borrowerId} = mảng các lần
  // gia hạn theo đúng thứ tự (Lần 1 = phần tử 0, Lần 2 = phần tử 1,...). Mỗi lần gồm:
  // { from, to, rateType:'zero'|'current'|'custom', ratePct, allocMode:'wardOnly'|'wardHamlet'|'allTiers',
  //   hamletAllocPercent, splitCentral, splitProvince, splitWard, savedAt, savedBy }
  // =====================================================================
  function getBorrowerExtensions(borrowerId){ return (state.loanExtensions && state.loanExtensions[borrowerId]) || []; }
  // Trả về lần gia hạn GẦN NHẤT nếu hôm nay đang nằm TRONG đúng khoảng [from, to] của lần đó (tức
  // là người vay đang ở trong thời gian gia hạn nợ lần N), ngược lại trả về null.
  function currentActiveExtension(borrowerId){
    const exts = getBorrowerExtensions(borrowerId);
    if(!exts.length) return null;
    const latest = exts[exts.length-1];
    const today = todayStr();
    if(latest.from && latest.to && today>=latest.from && today<=latest.to) return latest;
    return null;
  }
  function latestBorrowerExtension(borrowerId){ const arr = getBorrowerExtensions(borrowerId); return arr.length? arr[arr.length-1] : null; }
  // Điều kiện ĐỦ TIÊU CHUẨN để xuất hiện trong bảng "Gia hạn nợ" / "Quản lý Nợ rủi ro": hộ đã TỪNG
  // được gia hạn (bất kể lần); HOẶC "Ngày đến hạn" (ưu tiên lấy đúng ngày gia hạn gần nhất nếu có)
  // còn ≤60 ngày (kể cả đã quá hạn, tức là số âm).
  // Hàm CHUẨN DUY NHẤT xác định "Gần đến hạn ≤60 ngày" — dùng chung cho cả 3 nút Tất toán/Trả nợ
  // trước hạn, Gia hạn nợ, Quản lý Nợ rủi ro để LUÔN đồng bộ tuyệt đối. Luôn so sánh với ngày kết
  // thúc của LẦN GIA HẠN GẦN NHẤT (exts[exts.length-1], không phải lần gia hạn đầu tiên).
  function borrowerIsNearDue60(b){
    const exts = getBorrowerExtensions(b.id);
    const proj = projectOf(b);
    const dueRef = exts.length? exts[exts.length-1].to : (proj? proj.dueDate : b.dueDate);
    const d = rawDaysRemaining(dueRef);
    return d!=null && d<=60;
  }
  function borrowerEligibleForActionList(b){
    const exts = getBorrowerExtensions(b.id);
    if(exts.length>0) return true; // đã từng được gia hạn -> luôn đủ điều kiện, không cần đúng trong khoảng ngày
    const proj = projectOf(b);
    const dueRef = proj? proj.dueDate : b.dueDate;
    const dLeft = daysRemainingUntil(dueRef);
    return dLeft!=null && dLeft<=60;
  }
  // Chuỗi đoạn thời gian LIÊN TIẾP của 1 người vay: đoạn gốc (extLevel 0) rồi tới từng lần gia hạn
  // (extLevel 1,2,3... = số dấu #). Đoạn sau LUÔN bắt đầu đúng ngày đoạn trước kết thúc.
  function borrowerTimelineSegments(b){
    const segs = [{ from:b.loanDate, to:b.dueDate, extLevel:0 }];
    getBorrowerExtensions(b.id).forEach((e,i)=> segs.push({ from:e.from, to:e.to, extLevel:i+1 }));
    return segs;
  }

  // =====================================================================
  // "HỆ THỐNG CỘT CHO LẦN GIA HẠN LẦN 1" đến "LẦN 5" — lưu trữ & tính toán ĐẦY ĐỦ tương đương các
  // cột lãi suất/phân bổ đang hiển thị công khai, nhưng cho TỪNG lần gia hạn riêng biệt, và KHÔNG
  // hiển thị ra bất kỳ bảng/khung tuỳ chỉnh cột nào (chờ quyết định cách hiển thị ở lượt sau). Toàn
  // bộ thông tin người dùng thiết lập trong modal "GIA HẠN" đều được đổ đủ vào đây khi lưu, không
  // sót trường nào: Lãi suất (%/năm), lãi tính từ ngày/đến ngày, Phân bổ+Số tiền Trung ương/Tỉnh/
  // Xã, % Xã phân bổ Ấp + Số tiền về Ấp.
  // =====================================================================
  const MAX_LOAN_EXTENSIONS = 5;

  // =====================================================================
  // "SỔ TAY" TÀI LIỆU HOÁ TOÀN BỘ CỘT ẨN — nguồn dữ liệu DUY NHẤT cho khung "Hệ thống cột ẩn đang
  // hoạt động" ở tab Cài đặt & Chia sẻ. Mỗi khi về sau có thêm/bớt cột ẩn ở bất kỳ hệ thống nào
  // (trong hạn, gia hạn lần N, hoặc cột ẩn độc lập), CHỈ CẦN sửa đúng danh sách trong hàm này —
  // trang Cài đặt sẽ tự động hiện đúng, không cần sửa gì thêm ở nơi khác.
  // =====================================================================
  function hiddenColumnSystemsDocs(){
    const systems = [
      {
        title: 'Cấu trúc dữ liệu nền tảng (không phải cột, nhưng là gốc rễ của toàn bộ hệ thống cột ẩn bên dưới)',
        columns: [
          { name:'Các Hộp chứa Quý (borrowerQuarterBoxes)', desc:'Mỗi người vay có 1 chuỗi "hộp chứa Quý" — mỗi hộp là 1 Quý (hoặc 1 mảnh Quý bị cắt bởi ranh giới vay gốc/gia hạn) mà người vay có nghĩa vụ đóng lãi, gồm: tên hộp (vd "Quý 3#* -2026"), ngày bắt đầu/kết thúc, tổng số ngày, lãi suất áp dụng, số tiền lãi của riêng hộp đó. Tính lại HOÀN TOÀN mỗi lần gọi (không lưu trữ cứng) dựa trên Ngày vay + Ngày đến hạn + toàn bộ lịch sử gia hạn + mốc 4 Quý hiện hành — nên luôn tự động đúng theo mọi thay đổi. Là nền tảng của "Tất cả quý của món vay", "Quý chưa/đã đóng lãi", và mọi công thức số ngày/số tiền ở các hệ thống cột ẩn bên dưới.' },
          { name:'Hộp tiền đóng lãi (interestPaymentBoxes)', desc:'Mỗi người vay có đúng 1 hộp, sinh ra ngay khi thêm vào danh sách (mặc định 0đ). Lưu tại secretdata/interestPaymentBoxes/{borrowerId} = { totalPaid: tổng tất cả tiền đã "Xác nhận đóng lãi thành công", payments: {boxKey: số tiền đã gán cụ thể cho từng hộp chứa Quý} }. "Số tiền còn thừa lại" = totalPaid trừ tổng các khoản đã gán. Có cơ chế tự động dàn xếp số dư vào Quý nào đủ khả năng trả (ưu tiên Quý cũ nhất, ưu tiên nhóm "quá khứ+hiện tại" trước, chỉ xét tới nhóm "tương lai" khi nhóm kia đã hết). Là nguồn dữ liệu cho nút "Xem" (Lịch sử đóng lãi) và 2 cột công khai "Quý chưa/đã đóng lãi".' },
        ],
      },
      {
        title: 'Cột ẩn độc lập (không thuộc bộ nào)',
        columns: [
          { name:'Phương án vay', desc:'Tên phương án vay của người này — logic y hệt cột "Phương án vay" công khai cũ trước đây, chỉ khác là không còn hiện trong khung "Tuỳ chỉnh cột" nữa.' },
          { name:'Tất cả quý của món vay', desc:'Liệt kê TOÀN BỘ tên các "hộp chứa Quý" của người vay này (vay gốc + mọi lần gia hạn đã phê duyệt), KHÔNG giới hạn bởi hôm nay hay bộ lọc — kể cả hộp chứa của tương lai nếu đã gia hạn xa tới đó. Là nguồn gốc dữ liệu cho 2 cột công khai "Quý chưa đóng lãi" (lọc còn quá khứ+hiện tại, chưa phê duyệt) và "Quý đã đóng lãi" (lọc trong TOÀN BỘ danh sách này, đã phê duyệt).' },
        ],
      },
      {
        title: 'Hệ thống cột "Trong hạn" (ứng với khoản vay gốc, chưa gia hạn lần nào)',
        columns: [
          { name:'Lãi suất (%/năm) (trong hạn)', desc:'Lấy y hệt cột "Lãi suất (%/năm)" công khai (b.rate), không tính toán gì thêm.' },
          { name:'Số ngày tính lãi (trong hạn)', desc:'Tổng số ngày của các "hộp chứa Quý" thuộc đoạn vay gốc (extLevel=0) đang KHỚP với bộ lọc Quý/Năm hiện hành (khớp = có giao thật sự, chạm 1 điểm không tính).' },
          { name:'Số tiền lãi (trong hạn)', desc:'Cộng dồn qua từng hộp chứa khớp bộ lọc: Gốc × Lãi suất (trong hạn) ÷ Tổng số ngày trong năm CỦA CHÍNH NĂM hộp đó thuộc về × Số ngày của hộp đó.' },
          { name:`Phân bổ Trung ương/${provinceLevelLabel()}/${adminLevelLabel()} (%) (trong hạn)`, desc:'Lấy y hệt 3 cột phân bổ %/năm công khai (b.splitCentral / b.splitProvince / b.splitWard) — luôn cộng lại đúng bằng Lãi suất (trong hạn).' },
          { name:`Số tiền về Trung ương/${provinceLevelLabel()}/${adminLevelLabel()} (đ) (trong hạn)`, desc:'Công thức y hệt "Số tiền lãi (trong hạn)" nhưng thay Lãi suất bằng đúng tỷ lệ % của cấp đó.' },
          { name:`% ${adminLevelLabel()} phân bổ về ${subAdminLabel()} (trong hạn)`, desc:`Lấy y hệt cột "% ${adminLevelLabel()} phân bổ về ${subAdminLabel()}" công khai (b.hamletAllocPercent).` },
          { name:`Số tiền về ${subAdminLabel()} (đ) (trong hạn)`, desc:`= Số tiền về Cấp ${adminLevelLabel()} (trong hạn) × % ${adminLevelLabel()} phân bổ về ${subAdminLabel()} (trong hạn).` },
        ],
      },
    ];
    for(let lvl=1; lvl<=MAX_LOAN_EXTENSIONS; lvl++){
      systems.push({
        title: `Hệ thống cột "Gia hạn lần ${lvl}"`,
        columns: [
          { name:`Ngày bắt đầu gia hạn (gia hạn lần ${lvl})`, desc:`"Gia hạn từ ngày" đã lưu khi phê duyệt Lần ${lvl} (= ngày kết thúc của đợt liền trước đó). Để trống nếu người vay chưa từng gia hạn tới lần ${lvl}.` },
          { name:`Ngày kết thúc gia hạn (gia hạn lần ${lvl})`, desc:`"Gia hạn đến ngày" đã lưu khi phê duyệt Lần ${lvl}. Để trống nếu chưa có.` },
          { name:`Lãi suất (%/năm) (gia hạn lần ${lvl})`, desc:`Mức lãi suất quá hạn đã chọn khi phê duyệt Lần ${lvl} (0%, mức lãi suất trong hạn hiện tại, hoặc lãi suất khác tự nhập). Mặc định là số 0 nếu chưa gia hạn tới lần này.` },
          { name:`Số ngày tính lãi (gia hạn lần ${lvl})`, desc:`Tổng số ngày của các "hộp chứa Quý" mang đúng ${lvl} dấu "#" đang khớp bộ lọc Quý/Năm hiện hành.` },
          { name:`Số tiền lãi (gia hạn lần ${lvl})`, desc:`Cộng dồn qua từng hộp chứa khớp bộ lọc: Gốc × Lãi suất (lần ${lvl}) ÷ Tổng số ngày trong năm của từng hộp × Số ngày của hộp đó.` },
          { name:`Phân bổ Trung ương/${provinceLevelLabel()}/${adminLevelLabel()} (%) (gia hạn lần ${lvl})`, desc:`Là THÀNH PHẦN lãi suất (không phải tỷ lệ chia trên 100%): nếu chọn "100% về Xã" hoặc "Xã + Ấp" thì Xã = TRỌN lãi suất Lần ${lvl}, Trung ương/Tỉnh = 0; nếu chọn "Tất cả các cấp" thì lấy đúng 3 số người dùng đã nhập (luôn cộng lại = Lãi suất Lần ${lvl}).` },
          { name:`Số tiền về Trung ương/${provinceLevelLabel()}/${adminLevelLabel()} (đ) (gia hạn lần ${lvl})`, desc:`Công thức y hệt "Số tiền lãi (lần ${lvl})" nhưng thay Lãi suất bằng đúng tỷ lệ % của cấp đó.` },
          { name:`% ${adminLevelLabel()} phân bổ về ${subAdminLabel()} (gia hạn lần ${lvl})`, desc:`Tỷ lệ % đã chọn khi phê duyệt Lần ${lvl} (áp dụng khi chọn phương án "Xã + Ấp" hoặc "Tất cả các cấp").` },
          { name:`Số tiền về ${subAdminLabel()} (đ) (gia hạn lần ${lvl})`, desc:`= Số tiền về Cấp ${adminLevelLabel()} (lần ${lvl}) × % ${adminLevelLabel()} phân bổ về ${subAdminLabel()} (lần ${lvl}).` },
        ],
      });
    }
    return systems;
  }

  // đặt. Nếu lần gia hạn N CHƯA tồn tại (chưa được phê duyệt) thì: các trường NGÀY trả về rỗng,
  // còn TẤT CẢ các trường số (lãi suất/tỷ lệ %/số tiền) LUÔN mặc định là số 0 tròn trĩnh.
  // Yêu cầu mới: "Số ngày tính lãi (lần N)" và mọi cột SỐ TIỀN của lần N giờ được tính dựa trên
  // TỔNG các "hộp chứa Quý" (thuộc đúng lần gia hạn N) đang KHỚP với bộ lọc Quý/Năm hiện hành —
  // không còn dùng nguyên khối [from,to] của cả đợt gia hạn nữa.
  function getExtensionLevelColumnValue(b, level, field){
    const e = getBorrowerExtensions(b.id)[level-1];
    switch(field){
      // Ngày / tỷ lệ % / lãi suất: đây là DỮ LIỆU NHẬP, chưa có lần gia hạn N thì mặc định thẳng
      // rỗng (ngày) hoặc số 0 (tỷ lệ %, lãi suất) — không có gì để tính.
      case 'extendFrom': return e ? (e.from||'') : ''; // "Ngày bắt đầu gia hạn" — lấy đúng giá trị "Gia hạn từ ngày" đã lưu
      case 'extendTo': return e ? (e.to||'') : '';     // "Ngày kết thúc gia hạn" — lấy đúng giá trị "Gia hạn đến ngày" đã lưu
      case 'rate': return e ? (e.ratePct||0) : 0;
      // LƯU Ý QUAN TRỌNG: các trường "phân bổ ... (%)" là THÀNH PHẦN LÃI SUẤT (%/năm), y hệt bản
      // chất cột "Phân bổ Cấp ... (%)" đang hiển thị công khai (splitCentral+splitProvince+splitWard
      // luôn = Lãi suất chung) — KHÔNG PHẢI tỷ lệ chia trên tổng 100%.
      //   • wardOnly/wardHamlet: Trung ương=0, Tỉnh=0, Xã = TRỌN lãi suất gia hạn (vì 100% lãi đổ về Xã).
      //   • allTiers: lấy ĐÚNG 3 con số người dùng đã nhập (tự đảm bảo cộng lại = lãi suất gia hạn).
      case 'splitCentralPct': return e ? (e.allocMode==='allTiers' ? (e.splitCentral||0) : 0) : 0;
      case 'splitProvincePct': return e ? (e.allocMode==='allTiers' ? (e.splitProvince||0) : 0) : 0;
      case 'splitWardPct': return e ? (e.allocMode==='allTiers' ? (e.splitWard||0) : ((e.allocMode==='wardOnly'||e.allocMode==='wardHamlet') ? (e.ratePct||0) : 0)) : 0;
      case 'hamletAllocPct': return e ? (e.hamletAllocPercent||0) : 0;
      // Số ngày tính lãi / Số tiền lãi / Số tiền phân bổ 4 cấp: KẾT QUẢ CÔNG THỨC, dựa trên tổng
      // các hộp chứa (thuộc đúng lần gia hạn N) đang khớp bộ lọc Quý/Năm — tự ra đúng 0 khi không
      // có hộp chứa nào khớp (kể cả khi chưa có lần gia hạn N).
      case 'interestDays': return matchingBoxesDaysForLevel(b, level);
      case 'interestAmount': return e ? matchingBoxesInterestAmountForLevel(b, level, e.ratePct||0) : 0;
      case 'splitCentralAmt': return e ? matchingBoxesInterestAmountForLevel(b, level, getExtensionLevelColumnValue(b, level, 'splitCentralPct')) : 0;
      case 'splitProvinceAmt': return e ? matchingBoxesInterestAmountForLevel(b, level, getExtensionLevelColumnValue(b, level, 'splitProvincePct')) : 0;
      case 'splitWardAmt': return e ? matchingBoxesInterestAmountForLevel(b, level, getExtensionLevelColumnValue(b, level, 'splitWardPct')) : 0;
      case 'hamletAllocAmt': {
        if(!e) return 0;
        const wardAmt = getExtensionLevelColumnValue(b, level, 'splitWardAmt');
        return Math.round(wardAmt * ((e.hamletAllocPercent||0)/100));
      }
      default: return 0;
    }
  }

  // =====================================================================
  // "HỆ THỐNG CỘT TRONG HẠN" — song song với "hệ thống cột cho lần gia hạn" ở trên, nhưng đại diện
  // cho ĐÚNG khoảng vay gốc (chưa gia hạn lần nào, extLevel=0). KHÔNG hiển thị ra bất kỳ bảng/khung
  // tuỳ chỉnh cột nào (ẩn hoàn toàn, chỉ tồn tại nội bộ — lý do sẽ được giải thích sau).
  // Yêu cầu mới: "Số ngày tính lãi (trong hạn)" và các cột SỐ TIỀN đều dựa trên TỔNG các "hộp chứa
  // Quý" (extLevel=0) đang KHỚP với bộ lọc Quý/Năm hiện hành.
  // =====================================================================
  function getInTermColumnValue(b, field){
    switch(field){
      case 'rate': return parseFloat(b.rate)||0;
      case 'interestDays': return matchingBoxesDaysForLevel(b, 0);
      case 'interestAmount': return matchingBoxesInterestAmountForLevel(b, 0, parseFloat(b.rate)||0);
      case 'splitCentralPct': return parseFloat(b.splitCentral)||0;
      case 'splitCentralAmt': return matchingBoxesInterestAmountForLevel(b, 0, parseFloat(b.splitCentral)||0);
      case 'splitProvincePct': return parseFloat(b.splitProvince)||0;
      case 'splitProvinceAmt': return matchingBoxesInterestAmountForLevel(b, 0, parseFloat(b.splitProvince)||0);
      case 'splitWardPct': return parseFloat(b.splitWard)||0;
      case 'splitWardAmt': return matchingBoxesInterestAmountForLevel(b, 0, parseFloat(b.splitWard)||0);
      case 'hamletAllocPct': return parseFloat(b.hamletAllocPercent)||0;
      case 'hamletAllocAmt': {
        const wardAmt = matchingBoxesInterestAmountForLevel(b, 0, parseFloat(b.splitWard)||0);
        return Math.round(wardAmt * ((parseFloat(b.hamletAllocPercent)||0)/100));
      }
      default: return 0;
    }
  }

  function findQuarterContaining(dateStr){
    if(!dateStr) return null;
    const d = new Date(dateStr+'T00:00:00');
    if(isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    for(const testYear of [y-1, y, y+1]){
      for(const qk of ['q1','q2','q3','q4']){
        const r = resolveQuarterDatesForYear(qk, testYear);
        if(!r.from || !r.to) continue;
        const s = new Date(r.from+'T00:00:00'), e = new Date(r.to+'T00:00:00');
        if(d>=s && d<=e) return { qk, year:testYear };
      }
    }
    return null;
  }
  function nextQuarterCycle(qk, year){
    const order = ['q1','q2','q3','q4'];
    const idx = order.indexOf(qk);
    return idx===3 ? { qk:'q1', year:year+1 } : { qk:order[idx+1], year };
  }
  // Toàn bộ chuỗi Quý (kèm cờ "short": bị cắt ngắn do đầu/cuối đoạn; "extLevel": số dấu # = số lần
  // gia hạn, 0 = đoạn vay gốc) — đi qua LẦN LƯỢT từng đoạn (gốc rồi tới từng lần gia hạn theo thứ
  // tự), dừng lại khi đoạn kế tiếp còn nằm trong tương lai (chưa tới hôm nay).
  // =====================================================================
  // "HỆ THỐNG CÁC HỘP CHỨA THÔNG TIN TỪNG QUÝ CỦA TỪNG NGƯỜI VAY" — mỗi "hộp chứa" đại diện đúng 1
  // Quý (hoặc 1 mảnh Quý bị chia đôi bởi ranh giới giữa vay gốc/gia hạn) mà người vay này có nghĩa
  // vụ đóng lãi, gồm: tên hộp (vd "Quý 3#* -2026"), ngày bắt đầu, ngày kết thúc, tổng số ngày.
  // Tính TOÀN BỘ theo đúng cấu trúc vay gốc + tất cả các lần gia hạn ĐÃ LƯU — KHÔNG bị giới hạn bởi
  // "hôm nay" (kể cả hộp chứa của tương lai, nếu đã có lần gia hạn kéo dài tới đó, vẫn được tính đủ).
  // LUÔN tính động theo đúng cấu hình 4 Quý hiện hành (state.config.quarters) — hễ Chủ mã bấm
  // "Chỉnh thời gian tính lãi suất hàng quý" và đổi mốc, mọi hộp chứa của MỌI người vay sẽ tự động
  // đổi tên/đổi ranh giới theo ngay lập tức (vì được tính lại mỗi lần gọi, không lưu trữ cứng).
  // =====================================================================
  function borrowerQuarterBoxes(b){
    if(!b.loanDate || !b.dueDate) return [];
    const principal = parseFloat(b.principal)||0;
    const segments = borrowerTimelineSegments(b);
    const boxes = [];
    for(const seg of segments){
      if(!seg.from || !seg.to) continue; // đoạn gia hạn chưa lưu đủ ngày (không nên xảy ra) -> bỏ qua
      const segFrom = new Date(seg.from+'T00:00:00'), segTo = new Date(seg.to+'T00:00:00');
      if(isNaN(segFrom.getTime()) || isNaN(segTo.getTime()) || segTo<=segFrom) continue;
      const startInfo = findQuarterContaining(seg.from);
      const endInfo = findQuarterContaining(seg.to);
      if(!startInfo) continue;
      const realEndInfo = endInfo || startInfo;
      let cur = { qk:startInfo.qk, year:startInfo.year };
      let guard = 0;
      // Lãi suất (%/năm) áp dụng cho TOÀN BỘ hộp chứa thuộc đoạn này — lấy y hệt cột ẩn "Lãi suất
      // (%/năm) (trong hạn)" nếu extLevel=0, hoặc "...(gia hạn lần N)" tương ứng nếu extLevel>0.
      const segRatePct = seg.extLevel===0 ? getInTermColumnValue(b,'rate') : getExtensionLevelColumnValue(b, seg.extLevel, 'rate');
      while(guard++ < 400){
        const range = resolveQuarterDatesForYear(cur.qk, cur.year, b.frozenQuarterConfig);
        const isStartQ = (cur.qk===startInfo.qk && cur.year===startInfo.year);
        const isEndQ = (cur.qk===realEndInfo.qk && cur.year===realEndInfo.year);
        let boxFrom = range.from, boxTo = range.to, short = false;
        if(isStartQ && seg.from > range.from){ boxFrom = seg.from; short = true; }
        if(isEndQ && seg.to < range.to){ boxTo = seg.to; short = true; }
        const days = Math.max(0, daysBetween(boxFrom, boxTo));
        const cycleDays = annualCycleDaysForYear(cur.year, b.frozenQuarterConfig);
        const interestAmount = Math.round(principal * ((segRatePct||0)/100/cycleDays) * days);
        boxes.push({
          key: `${cur.qk}-${cur.year}-${seg.extLevel}`, // định danh ỔN ĐỊNH (không đổi dù tên hiển thị * / # có đổi)
          qk:cur.qk, year:cur.year, short, extLevel:seg.extLevel, from:boxFrom, to:boxTo, days,
          rate: segRatePct||0, interestAmount,
        });
        if(isEndQ) break;
        cur = nextQuarterCycle(cur.qk, cur.year);
      }
    }
    // ---- Lọc "rìa ngoài" theo frozenAsOf — CHỈ áp dụng cho người vay đã Tất toán/Trả nợ trước hạn
    // (frozenAsOf được gán lúc đó). Với >99% người vay bình thường (frozenAsOf rỗng), dòng dưới đây
    // không làm gì cả, trả về nguyên vẹn y hệt boxes như trước — TUYỆT ĐỐI không đổi hành vi cũ.
    if(b.frozenAsOf){
      return boxes.filter(bx=>bx.from<=b.frozenAsOf).map(bx=>{
        if(bx.to<=b.frozenAsOf) return bx; // hộp đã kết thúc trước/đúng ngày đóng băng -> giữ nguyên
        // Hộp đang "ôm" đúng ngày đóng băng -> cắt ngắn lại đúng tới ngày đó, tính lại đúng tiền lãi
        // thực tế của phần ngày còn hợp lệ (KHÔNG đụng gì tới các hộp khác).
        const days = Math.max(0, daysBetween(bx.from, b.frozenAsOf));
        const cycleDays = annualCycleDaysForYear(bx.year, b.frozenQuarterConfig);
        const interestAmount = Math.round(principal * ((bx.rate||0)/100/cycleDays) * days);
        return { ...bx, to:b.frozenAsOf, short:true, days, interestAmount };
      });
    }
    return boxes;
  }
  function quarterOrdinal1to4(qk){ return {q1:1,q2:2,q3:3,q4:4}[qk] || 0; }
  function formatTimelineQuarterLabel(item){
    const hashes = '#'.repeat(item.extLevel||0);
    const star = item.short ? '*' : '';
    return `Quý ${quarterOrdinal1to4(item.qk)}${hashes}${star} -${item.year}`;
  }
  // Dò trong "Tất cả quý của món vay" (TOÀN BỘ hộp chứa, không giới hạn hôm nay) xem có hộp nào
  // mang dấu "#" không — trả về số dấu # NHIỀU NHẤT đang xuất hiện (0 nếu không có hộp nào có #).
  function borrowerHighestActiveExtLevel(b){
    let maxLevel = 0;
    borrowerQuarterBoxes(b).forEach(bx=>{ if((bx.extLevel||0) > maxLevel) maxLevel = bx.extLevel||0; });
    return maxLevel;
  }
  // Hiển thị các cột công khai liên quan lãi suất/phân bổ theo yêu cầu: nếu món vay đang có bất kỳ
  // Quý nào rơi vào diện gia hạn (có dấu #) thì hiện thêm "(lãi suất/tỷ lệ của đúng lần gia hạn
  // NHIỀU DẤU # NHẤT)" tô đỏ, đứng TRƯỚC con số bình thường (trong hạn); nếu không có Quý nào có #
  // thì chỉ hiện đúng con số trong hạn như cũ, không đổi.
  function formatRateWithOverdueHtml(b, field, suffix){
    const normalVal = getInTermColumnValue(b, field);
    const normalStr = String(normalVal).replace('.',',');
    const maxLevel = borrowerHighestActiveExtLevel(b);
    if(maxLevel===0) return `${escapeHtml(normalStr)}${suffix}`;
    const overdueVal = getExtensionLevelColumnValue(b, maxLevel, field);
    const overdueStr = String(overdueVal).replace('.',',');
    return `<span style="color:var(--red); font-weight:700;">(${escapeHtml(overdueStr)})</span> ${escapeHtml(normalStr)}${suffix}`;
  }
  // Bản văn bản THUẦN (không HTML) của hàm trên — dùng cho Xuất Excel / In, nơi không hiển thị được thẻ HTML.
  function formatRateWithOverduePlain(b, field, suffix){
    const normalVal = getInTermColumnValue(b, field);
    const normalStr = String(normalVal).replace('.',',');
    const maxLevel = borrowerHighestActiveExtLevel(b);
    if(maxLevel===0) return `${normalStr}${suffix}`;
    const overdueVal = getExtensionLevelColumnValue(b, maxLevel, field);
    const overdueStr = String(overdueVal).replace('.',',');
    return `(${overdueStr}) ${normalStr}${suffix}`;
  }
  // "Quý chưa/đã đóng lãi" chỉ xét những hộp chứa ĐÃ BẮT ĐẦU tính đến hôm nay (theo lịch hiện hành)
  // — hộp chứa nào còn ở tương lai (chưa bắt đầu) thì CHƯA xuất hiện ở cả 2 cột, đúng như thiết kế:
  // "chỉ tính đến thời điểm hiện tại của lịch hiện tại".
  function borrowerQuarterTimeline(b){
    const today = new Date(); today.setHours(0,0,0,0);
    return borrowerQuarterBoxes(b).filter(box=>{
      const f = new Date(box.from+'T00:00:00');
      return !isNaN(f.getTime()) && f<=today;
    });
  }
  // =====================================================================
  // "HỘP TIỀN ĐÃ ĐÓNG LÃI" — mỗi người vay có đúng 1 hộp, sinh ra ngay khi thêm người vay (mặc định
  // 0đ). Lưu tại secretdata/{secretId}/interestPaymentBoxes/{borrowerId} = {
  //   totalPaid: tổng tất cả số tiền đã từng được "Xác nhận đóng lãi thành công" (kể cả phần dư),
  //   payments: { [boxKey]: amount } — số tiền đã GÁN CỤ THỂ cho từng "hộp chứa Quý" (boxKey =
  //             "qk-year-extLevel", một định danh ỔN ĐỊNH không đổi dù tên hiển thị */# có đổi).
  // }
  // "Số tiền còn thừa lại chưa thuộc về quý nào" = totalPaid − tổng các khoản đã gán cụ thể.
  // =====================================================================
  function getInterestPaymentBoxRaw(borrowerId){
    return (state.interestPaymentBoxes && state.interestPaymentBoxes[borrowerId]) || { totalPaid:0, payments:{} };
  }
  // "KHOÁ AN TOÀN" chống lập biên lai chồng chéo — ngay TRƯỚC KHI ghi biên lai liên quan tới tiền lãi
  // của 1 hộ vay, đọc lại TRỰC TIẾP từ Firebase (không dùng bản đã cache trong state, vì có thể đã cũ)
  // để phát hiện xem có ai khác VỪA lập 1 biên lai liên quan (làm đổi totalPaid) hay chưa. Nếu có, từ
  // chối lưu — người dùng phải thoát ra lập lại biên lai mới với số liệu mới nhất.
  async function assertInterestBoxStillFresh(b, expectedTotalPaid){
    try{
      const snap = await wref('interestPaymentBoxes/'+b.id).once('value');
      const fresh = snap.val() || { totalPaid:0 };
      if((fresh.totalPaid||0) !== (expectedTotalPaid||0)){
        alert(`⚠️ Không thể lưu biên lai này — đã có người khác VỪA lập một biên lai liên quan đến tiền lãi của hộ vay "${b.name}" cùng lúc với đồng chí, khiến số liệu đồng chí đang xem đã bị lỗi thời.\n\nVui lòng thoát bảng này ra và lập lại 1 biên lai MỚI (hệ thống sẽ tự cập nhật đúng số liệu mới nhất), hoặc vào Kho biên lai để xem biên lai mới nhất vừa được lập.`);
        return false;
      }
      return true;
    }catch(e){ console.error('Lỗi kiểm tra khoá an toàn:', e); return true; } // lỗi mạng -> không chặn, best-effort
  }
  // "Khoá an toàn" cho các biên lai CÓ THỂ tạo Biên lai chưa thanh toán (thu lãi theo Quý/theo tiền,
  // tất toán, trả nợ trước hạn, thu lãi hộ đã tất toán còn nợ...) — nếu ĐÃ tồn tại 1 Biên lai chưa
  // thanh toán liên quan tới CÙNG người vay này, thì chặn không cho "Gửi đường link thanh toán" hay
  // "Xác nhận..." nữa, vì số liệu đang xem có thể đã lỗi thời (biên lai kia có thể sắp/vừa được thanh
  // toán). Khoá chỉ hết tác dụng khi Biên lai chưa thanh toán đó không còn trong bộ nhớ đám mây nữa
  // (xoá thủ công hoặc hệ thống tự xoá sau 7 ngày, hoặc sau này chuyển trạng thái thành đã thanh toán).
  // Áp dụng THẬT sự giao dịch đóng lãi (dùng chung cho cả "theo cách tính Quý" lẫn "theo cách tính
  // tiền cụ thể") khi 1 Biên lai chưa thanh toán được xác nhận đã Thanh toán xong — tái dùng ĐÚNG các
  // hàm gốc dùng bởi nút "Xác nhận đóng lãi thành công" thông thường, để tuyệt đối không lệch số liệu.
  async function applyUnpaidInterestPayment(replay){
    const b = state.borrowers.find(x=>x.id===replay.borrowerId);
    if(!b) throw new Error('Không tìm thấy người vay tương ứng (có thể đã bị xoá).');
    const dispBefore = computeInterestPaymentBoxDisplay(b);
    const raw = getInterestPaymentBoxRaw(b.id);
    const payments = Object.assign({}, raw.payments||{});
    (replay.quarterLines||[]).forEach(q=>{ if(q.key) payments[q.key] = q.amount; });
    const newTotalPaid = (raw.totalPaid||0) + (replay.amount||0);
    await cSet('interestPaymentBoxes/'+b.id, { totalPaid:newTotalPaid, payments });
    state.interestPaymentBoxes = state.interestPaymentBoxes||{};
    state.interestPaymentBoxes[b.id] = { totalPaid:newTotalPaid, payments };
    await settleInterestPaymentLeftover(b);
    const dispAfter = computeInterestPaymentBoxDisplay(b);
    await logQuarterStatusDiff(b, dispBefore, dispAfter,
      `Đã được đóng lãi thành công bởi Biên lai thanh toán qua đường link (xác nhận ngày ${fmtDate(todayStr())})`,
      `Đã trở về trạng thái chưa đóng lãi do thay đổi thông tin liên quan tới khoản vay`);
    await pushReceiptRecord(b, replay.receiptCategoryKey||'interest_quarter', {
      amount: replay.amount||0, sign:'+',
      quarterLines: (replay.quarterLines||[]).map(q=>({ qk:q.qk, year:q.year, amount:q.amount })),
      categoryLabelId: replay.categoryLabelId||null, extra: { payerName: replay.payerName||'', collectorName: replay.collectorName||'' },
      forceId: replay.code||null, viaPaymentLink: true,
    });
    await pushLog('xác nhận', `đóng lãi cho hộ vay ${b.name} qua đường link thanh toán (${moneySpaced(replay.amount||0)})`);
  }
  // Áp dụng THẬT sự giao dịch Tất toán khoản vay khi 1 Biên lai chưa thanh toán được xác nhận đã
  // Thanh toán xong — tái dùng ĐÚNG các hàm gốc (settleInterestForClosure/markBorrowerSettled/
  // pushReceiptRecord) y hệt nút "Xác nhận tất toán thành công" thông thường. Có thêm 1 lớp an toàn
  // riêng: nếu người vay đã được tất toán từ trước (VD: nhân viên khác lỡ tất toán thủ công trong lúc
  // chờ khách chuyển khoản) thì CHẶN LẠI, không tất toán chồng lần 2.
  async function applyUnpaidSettlementFinal(replay){
    const b = state.borrowers.find(x=>x.id===replay.borrowerId);
    if(!b) throw new Error('Không tìm thấy người vay tương ứng (có thể đã bị xoá).');
    if(b.settled) throw new Error(`Hộ vay "${b.name}" đã được Tất toán từ trước (có thể do thao tác khác trong lúc chờ thanh toán) — không thể tất toán lại lần nữa. Vui lòng kiểm tra lại trong Sổ vay vốn.`);
    const interestInfo = replay.includeInterest ? await settleInterestForClosure(b, false) : null;
    await markBorrowerSettled(b, 'final', { settledInterestIncluded: replay.includeInterest? interestInfo.total : 0, settledUpToToday:false, settledGrandTotal: replay.grandTotal,
      settledSnapshot: buildSettlementSnapshot(b, interestInfo, false, null),
      ...(replay.viaRiskDebt? { settledViaRiskDebt:true, riskDebt:false } : {}) });
    await pushReceiptRecord(b, replay.includeInterest? 'settlement_with_interest' : 'settlement_no_interest', {
      amount: replay.grandTotal, sign:'+',
      quarterLines: replay.includeInterest? (interestInfo.lines||[]).map(x=>({ qk:x.box.qk, year:x.box.year, amount:x.amount })) : [],
      extra: { principal: replay.principal, interestIncluded: replay.includeInterest? interestInfo.total : 0, grandTotal: replay.grandTotal, payerName: replay.payerName||'', collectorName: replay.collectorName||'' },
      forceId: replay.code||null, viaPaymentLink: true,
    });
    await pushLog('xác nhận', `tất toán khoản vay cho hộ vay ${b.name} qua đường link thanh toán (gốc ${moneySpaced(replay.principal)}${replay.includeInterest?` + lãi`:''})`);
  }
  // Áp dụng THẬT sự giao dịch Trả nợ trước hạn khi 1 Biên lai chưa thanh toán được xác nhận đã Thanh
  // toán xong — bao gồm cả trường hợp có Người thừa kế (tạo hồ sơ mới). Tái dùng ĐÚNG các hàm gốc y
  // hệt nút "Xác nhận trả nợ trước hạn thành công" thông thường. Cũng có lớp an toàn chống trả nợ
  // trước hạn chồng lần 2 nếu người vay đã được tất toán/trả nợ trước hạn từ trước.
  async function applyUnpaidEarlyRepayment(replay){
    const b = state.borrowers.find(x=>x.id===replay.borrowerId);
    if(!b) throw new Error('Không tìm thấy người vay tương ứng (có thể đã bị xoá).');
    if(b.settled) throw new Error(`Hộ vay "${b.name}" đã được Tất toán/Trả nợ trước hạn từ trước (có thể do thao tác khác trong lúc chờ thanh toán) — không thể xử lý lại lần nữa. Vui lòng kiểm tra lại trong Sổ vay vốn.`);
    const interestInfo = replay.includeInterest ? await settleInterestForClosure(b, replay.upToToday) : null;
    await markBorrowerSettled(b, 'early', { settledReason: replay.reason||'', heirName: replay.heir? replay.heir.name : '',
      settledInterestIncluded: (replay.includeInterest? interestInfo.total : 0), settledUpToToday: replay.upToToday,
      settledGrandTotal: replay.principal + (replay.includeInterest? interestInfo.total : 0), settledMode: replay.mode,
      settledSnapshot: buildSettlementSnapshot(b, replay.includeInterest? interestInfo : null, replay.upToToday, replay.mode==='heir'? replay.heir : null) });
    if(replay.mode==='heir' && replay.heir){
      const heirRecord = { ...emptyBorrowerForProject(projectOf(b)), ...replay.heir, id: uid(), projectId: b.projectId, hamlet: replay.heir.hamlet||b.hamlet, isHeir:true, heirOfBorrowerId: b.id, managerId: b.managerId };
      await cSetRecord('borrowers', heirRecord.id, heirRecord);
    }
    const catKey = replay.mode==='heir'
      ? (replay.includeInterest? 'early_heir_with_interest' : 'early_heir_no_interest')
      : (replay.includeInterest? 'early_province_with_interest' : 'early_province_no_interest');
    await pushReceiptRecord(b, catKey, {
      amount: replay.principal + (replay.includeInterest? interestInfo.total : 0), sign:'+',
      quarterLines: replay.includeInterest? (interestInfo.lines||[]).map(x=>({ qk:x.box.qk, year:x.box.year, amount:x.amount })) : [],
      extra: { principal: replay.principal, interestIncluded: replay.includeInterest? interestInfo.total : 0, heirName: replay.heir? replay.heir.name : '', payerName: replay.payerName||'', collectorName: replay.collectorName||'', mode: replay.mode, isLocalOrOtherFund: replay.isLocalOrOtherFund, reason: replay.reason||'' },
      forceId: replay.code||null, viaPaymentLink: true,
    });
    await pushLog('xác nhận', `trả nợ trước hạn cho hộ vay ${b.name} qua đường link thanh toán (gốc ${moneySpaced(replay.principal)}${replay.includeInterest?` + lãi`:''})${replay.heir?`, người thừa kế: ${replay.heir.name}`:''}`);
  }
  // Áp dụng THẬT sự "Biên lai chung: Đóng tiền lãi cho các hộ trong phương án vay" khi 1 Biên lai
  // chưa thanh toán được xác nhận đã Thanh toán xong — tái dùng ĐÚNG các hàm gốc y hệt nút "Xác nhận
  // đóng lãi thành công" (chung) thông thường.
  async function applyUnpaidSharedInterestPayment(replay){
    const perBorrower = (replay.perBorrower||[]).map(pb=>({ ...pb, b: state.borrowers.find(x=>x.id===pb.borrowerId) })).filter(pb=>pb.b);
    if(!perBorrower.length) throw new Error('Không tìm thấy người vay nào trong nhóm (có thể đã bị xoá).');
    const groupList = perBorrower.map(pb=>pb.b);
    for(const pb of perBorrower){
      const b = pb.b;
      const dispBefore = computeInterestPaymentBoxDisplay(b);
      const raw = getInterestPaymentBoxRaw(b.id);
      const newTotalPaid = (raw.totalPaid||0) + pb.amount;
      await cSet('interestPaymentBoxes/'+b.id, { totalPaid:newTotalPaid, payments: raw.payments||{} });
      state.interestPaymentBoxes = state.interestPaymentBoxes||{};
      state.interestPaymentBoxes[b.id] = { totalPaid:newTotalPaid, payments: raw.payments||{} };
      const dispAfter = computeInterestPaymentBoxDisplay(b);
      await logQuarterStatusDiff(b, dispBefore, dispAfter,
        `Đã được đóng lãi thành công bởi Biên lai chung Đóng tiền lãi cho các hộ trong Phương án vay "${replay.projName}" (thanh toán qua đường link, xác nhận ngày ${fmtDate(todayStr())})`,
        `Đã trở về trạng thái chưa đóng lãi do thay đổi thông tin liên quan tới khoản vay`);
    }
    const namesStr = groupList.map(b=>b.name).join(', ');
    const detailLines = [
      `Biên lai chung Đóng tiền lãi cho các hộ trong Phương án vay "${replay.projName}" đã được lập vào ngày ${fmtDate(todayStr())}.`,
      `Tổng ${groupList.length} hộ vay: ${namesStr}`,
      ...(replay.chosenQuarters||[]).map(q=> `${q.name} (${moneySpaced(q.amount)} x ${groupList.length} hộ) = ${moneySpaced(q.amount*groupList.length)}`),
      `Tổng tiền các quý = ${moneySpaced(replay.quarterTotal)}`,
      (replay.leftoverTotal<=0)
        ? `Các hộ này không có hộ nào có tiền dư từ đợt trước`
        : [...perBorrower.filter(pb=>pb.leftover>0).map(pb=> `Tiền dư đợt trước ${pb.b.name}: - ${moneySpaced(pb.leftover)}`), `Tổng tiền dư đợt trước của ${groupList.length} hộ = - ${moneySpaced(replay.leftoverTotal)}`].join('\n'),
      `Tổng tất cả (số tiền thực nhận) = ${moneySpaced(replay.grandTotal)}`,
      // Dòng chi tiết THEO TỪNG HỘ — bắt buộc cần có để sau này tính năng "Xem Biên lai đã tác động vào
      // Tiền đã đóng lãi" của TỪNG hộ vay có thể tách đúng phần tiền lãi của riêng họ trong Biên lai
      // chung này (trước đây bị thiếu, chỉ có tổng theo Quý, không tách được theo từng hộ).
      ...perBorrower.map(pb=> `Tiền lãi đóng kèm theo ${pb.b.name}: ${moneySpaced(pb.amount)}`),
      ...(replay.chosenQuarters||[]).map(q=> `${q.name} tính từ ngày ${fmtDate(q.from)} đến ngày ${fmtDate(q.to)}`),
      `Người đóng tiền: ${replay.payerName||''}`,
      `Người thu tiền: ${replay.collectorName||''}`,
      `--- Thông tin nâng cao ---`,
      `Phương án vay: ${replay.projName}`,
      ...groupList.map(b=> `${b.name} — số tiền vay gốc ${moneySpaced(b.principal)}, lãi suất ${String(parseFloat(b.rate)||0).replace('.',',')}%/năm`),
      ...(replay.chosenQuarters||[]).map(q=> `${q.name} tính từ ngày ${fmtDate(q.from)} đến ngày ${fmtDate(q.to)}`),
    ];
    await pushSharedReceiptRecord('shared_interest_payment', `BL chung: Đóng tiền lãi cho các hộ trong phương án vay ${replay.projName}`,
      detailLines.join('\n'), replay.grandTotal, '+', groupList.map(b=>b.id), replay.categoryLabelId||null, replay.code||null, true);
    await pushLog('xác nhận', `đóng lãi chung cho ${groupList.length} hộ vay trong phương án ${replay.projName} qua đường link thanh toán`);
  }
  // Áp dụng THẬT sự "Biên lai chung: Tất toán khoản vay cho các hộ trong phương án vay".
  async function applyUnpaidSharedSettlement(replay){
    const rows = (replay.rows||[]).map(r=>({ ...r, b: state.borrowers.find(x=>x.id===r.borrowerId) })).filter(r=>r.b);
    if(!rows.length) throw new Error('Không tìm thấy người vay nào trong nhóm (có thể đã bị xoá).');
    const alreadySettled = rows.find(r=>r.principalChecked && r.b.settled);
    if(alreadySettled) throw new Error(`Hộ vay "${alreadySettled.b.name}" đã được Tất toán từ trước (có thể do thao tác khác trong lúc chờ thanh toán) — không thể tất toán lại lần nữa. Vui lòng kiểm tra lại trong Sổ vay vốn.`);
    const settledIds = [];
    for(const r of rows){
      if(!r.principalChecked) continue;
      if(r.interestChecked && r.interestAmt>0) await settleInterestForClosure(r.b, false);
      await markBorrowerSettled(r.b, 'final', { settledReason:'Tất toán khoản vay chung theo Phương án vay', heirName:'',
        settledInterestIncluded: r.interestChecked? r.interestAmt : 0, settledUpToToday:false,
        settledGrandTotal: r.principal + (r.interestChecked? r.interestAmt : 0), settledMode:'province',
        settledSnapshot: buildSettlementSnapshot(r.b, r.interestChecked? { lines: computeInterestPaymentBoxDisplay(r.b).unpaidLines, total: r.interestAmt } : null, false, null) });
      settledIds.push(r.b.id);
    }
    const groupList = rows.map(r=>r.b);
    const principalCount = rows.filter(r=>r.principalChecked).length;
    const interestCount = rows.filter(r=>r.interestChecked).length;
    const totalPrincipal = rows.filter(r=>r.principalChecked).reduce((s,r)=>s+r.principal,0);
    const totalInterest = rows.filter(r=>r.interestChecked).reduce((s,r)=>s+r.interestAmt,0);
    const allSameLoanDate = groupList.every(b=>b.loanDate===groupList[0].loanDate);
    const allSameHamlet = groupList.every(b=>b.hamlet===groupList[0].hamlet);
    const allSameDue = groupList.every(b=>b.dueDate===groupList[0].dueDate);
    const detailLines = [
      `Biên lai chung Tất toán khoản vay cho các hộ trong Phương án vay "${replay.projName}" đã được lập vào ngày ${fmtDate(todayStr())}.`,
      ...rows.filter(r=>r.principalChecked).map(r=> `Tiền vay gốc ${r.b.name}: ${moneySpaced(r.principal)}`),
      `Tổng tiền vay gốc ${principalCount} hộ vay = ${moneySpaced(totalPrincipal)}`,
      (totalInterest<=0 && rows.every(r=>r.interestAmt<=0))
        ? `Các hộ trên đều không có Lãi tồn chưa đóng`
        : [...rows.filter(r=>r.interestChecked).map(r=> `Tiền lãi đóng kèm theo ${r.b.name}: ${moneySpaced(r.interestAmt)}`), `Tổng tiền lãi đóng kèm theo của ${interestCount} hộ vay = ${moneySpaced(totalInterest)}`].join('\n'),
      `Số tiền thực tế nhận được = ${moneySpaced(replay.grandTotal)}`,
      `Người trả nợ: ${replay.payerName||''}`,
      `Người nhận tiền: ${replay.collectorName||''}`,
      `--- Thông tin nâng cao ---`,
      `Phương án vay: ${replay.projName}`,
      `Địa chỉ: ${allSameHamlet? (groupList[0].hamlet||'') : rows.map(r=>`${r.b.name}: ${r.b.hamlet||''}`).join('; ')}`,
      `Ngày vay chung: ${allSameLoanDate? fmtDate(groupList[0].loanDate) : rows.map(r=>`${r.b.name}${r.b.isHeir?' (người thừa kế)':''}: ${fmtDate(r.b.loanDate)}`).join('; ')}`,
      `Ngày đến hạn: ${allSameDue? fmtDate(groupList[0].dueDate) : rows.map(r=>`${r.b.name}: ${fmtDate(r.b.dueDate)}`).join('; ')}`,
    ];
    await pushSharedReceiptRecord('shared_final_settlement', `BL chung: Tất toán khoản vay cho các hộ trong phương án vay ${replay.projName}`,
      detailLines.join('\n'), replay.grandTotal, '+', settledIds, null, replay.code||null, true);
    await pushLog('xác nhận', `tất toán khoản vay chung cho ${settledIds.length} hộ vay trong phương án ${replay.projName} qua đường link thanh toán`);
  }
  async function assertNoUnpaidReceiptLock(borrowerId, borrowerName){
    try{
      const snap = await rtdb.ref('receipts').get();
      const val = (snap && snap.exists()) ? snap.val() : {};
      const myWardId = wardId();
      // Biên lai chưa thanh toán đã QUÁ 7 NGÀY (dù chưa bị xoá vật lý khỏi đám mây, vì cơ chế tự xoá
      // chỉ kích hoạt khi có người mở lại) -> coi như KHÔNG CÒN kích hoạt khoá an toàn nữa, y hệt như
      // đã bị xoá hoặc đã được duyệt.
      const conflict = Object.values(val).some(r=> r.status==='unpaid' && r.wardId===myWardId && r.borrowerIds && r.borrowerIds[borrowerId]
        && (Date.now() - new Date(r.createdAt).getTime()) < UNPAID_RECEIPT_LIFETIME_MS);
      if(conflict){
        alert(`⚠️ Không thể lưu biên lai này — đã có 1 Biên lai CHƯA THANH TOÁN liên quan đến tiền lãi của hộ vay "${borrowerName}", khiến số liệu đồng chí đang xem có thể đã lỗi thời.\n\nVui lòng vào "Hộp Biên lai chưa thanh toán" (trong Kho biên lai) để xem Biên lai đó, hoặc xoá Biên lai đó đi (nếu không còn cần dùng) để có thể tiếp tục lập biên lai mới cho hộ vay này.`);
        return false;
      }
      return true;
    }catch(e){ console.error('Lỗi kiểm tra khoá an toàn (biên lai chưa thanh toán):', e); return true; } // lỗi mạng -> không chặn, best-effort
  }
  // Tính TOÀN BỘ trạng thái hiện hành của Hộp tiền — luôn tính động từ dữ liệu thô + "hộp chứa Quý"
  // hiện tại, nên tự động đúng theo mọi thay đổi (mốc Quý, lãi suất, gia hạn...).
  function computeInterestPaymentBoxState(b){
    const raw = getInterestPaymentBoxRaw(b.id);
    const totalPaid = raw.totalPaid||0;
    const payments = raw.payments||{};
    const allBoxes = borrowerQuarterBoxes(b); // đã đúng thứ tự thời gian (cũ -> mới)
