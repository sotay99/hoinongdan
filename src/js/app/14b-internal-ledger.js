  // =====================================================================
  // SỔ THU – CHI NỘI BỘ (module "internal") — bản 2: nhiều Sổ, phụ lục có công thức.
  // Lưu CỤC BỘ trên thiết bị (localStorage) — xem internalLedgerLoadRaw()/
  // internalLedgerSaveRaw(). Sau này muốn chuyển sang Firebase (cá nhân hoặc theo mã
  // xã, nhiều người cùng sửa) thì chỉ cần đổi bên trong lớp lưu trữ này.
  //
  // Cấu trúc dữ liệu: { ledgers: [{ id, name, order, entries: [ {id, type:'thu'|'chi',
  //   date, content, amountMode:'manual'|'appendix', amount, person, note,
  //   appendix: null | { id, title, designatedKey, columns:[{key,label,type,showTotal}],
  //   rows: [{ [colKey]: raw }] } } ] }] }
  // =====================================================================
  const INTERNAL_LEDGER_LOCAL_KEY = 'hnd_internal_ledger_v2';
  const INTERNAL_LEDGER_ACCEPT_KEY = 'hnd_internal_ledger_accepted_v1';
  const IL_MAX = { content:200, person:80, note:500, title:80, colLabel:40, cellText:200, moneyDigits:12, ledgerName:80 };

  function internalLedgerAccepted(){
    try{ return localStorage.getItem(INTERNAL_LEDGER_ACCEPT_KEY)==='1'; }catch(e){ return false; }
  }
  function internalLedgerAccept(){
    try{ localStorage.setItem(INTERNAL_LEDGER_ACCEPT_KEY, '1'); }catch(e){ console.warn('Không thể ghi cờ chấp nhận Sổ Thu - Chi nội bộ:', e); }
  }
  function internalLedgerLoadRaw(){
    try{
      const raw = JSON.parse(localStorage.getItem(INTERNAL_LEDGER_LOCAL_KEY)||'{}');
      return { ledgers: Array.isArray(raw.ledgers) ? raw.ledgers : [] };
    }catch(e){ return { ledgers: [] }; }
  }
  function internalLedgerSaveRaw(data){
    try{ localStorage.setItem(INTERNAL_LEDGER_LOCAL_KEY, JSON.stringify(data||{ledgers:[]})); }
    catch(e){ console.warn('Không thể lưu Sổ Thu - Chi nội bộ:', e); }
  }
  function ilData(){
    if(!state._ilData) state._ilData = internalLedgerLoadRaw();
    return state._ilData;
  }
  function ilPersist(){ internalLedgerSaveRaw(ilData()); }
  function ilNewId(prefix){ return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }

  // =====================================================================
  // SỔ (ledger) — danh sách, tạo/đổi tên/xoá/sắp xếp.
  // =====================================================================
  function ilAllLedgers(){ return ilData().ledgers.slice().sort((a,b)=>(a.order||0)-(b.order||0)); }
  function ilLedgerById(id){ return ilData().ledgers.find(l=>l.id===id); }
  function ilCurrentLedger(){ return state._ilCurrentLedgerId ? ilLedgerById(state._ilCurrentLedgerId) : null; }
  function ilSuggestedLedgerNames(){
    const d = new Date();
    return [ `Sổ năm ${d.getFullYear()}`, `Sổ tháng ${d.getMonth()+1} năm ${d.getFullYear()}` ];
  }
  function ilCreateLedger(name){
    const d = ilData();
    const maxOrder = d.ledgers.reduce((m,l)=>Math.max(m, l.order||0), 0);
    const ledger = { id: ilNewId('ldg'), name, order: maxOrder+1, entries: [] };
    d.ledgers.push(ledger);
    ilPersist();
    return ledger;
  }
  function ilResetEntryFilters(){ state._ilSearch=''; state._ilDateFrom=''; state._ilDateTo=''; }

  function renderInternalLedgerListScreen(el){
    const canEdit = canEditModule('internal');
    const sorting = !!state._ilSortingLedgers;
    const ledgersRaw = ilAllLedgers();
    const ledgers = sorting && state._ilLedgerSortDraft
      ? state._ilLedgerSortDraft.map(id=>ledgersRaw.find(l=>l.id===id)).filter(Boolean)
      : ledgersRaw;
    if(sorting && !state._ilLedgerSortDraft) state._ilLedgerSortDraft = ledgers.map(l=>l.id);
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🔒 Thu – Chi nội bộ — Danh sách Sổ</h3>${canEdit? `<button type="button" class="btn btn-primary btn-sm preview-allow" id="il-ldg-new">➕ Tạo sổ mới</button>` : ''}</div>
        <div class="panel-body">
          ${sorting? `<div style="margin-bottom:10px;">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary btn-sm preview-allow" id="il-ldg-sort-save">💾 Lưu lại thứ tự sắp xếp</button>
              <button class="btn btn-ghost btn-sm preview-allow" id="il-ldg-sort-cancel">Huỷ (không lưu sắp xếp)</button>
            </div>
            <p class="sub drag-hint-cycle" style="margin:6px 0 0;">Bấm vào tên sổ và kéo thả để thay đổi vị trí.</p>
          </div>` : ''}
          ${ledgers.length? `<div class="table-wrap"><table>
            <thead><tr><th></th><th>Tên sổ</th><th style="text-align:center;">Số dòng Thu</th><th style="text-align:center;">Số dòng Chi</th><th></th></tr></thead>
            <tbody>${ledgers.map(l=>{
              const thuCount = l.entries.filter(e=>e.type==='thu').length;
              const chiCount = l.entries.filter(e=>e.type==='chi').length;
              return `<tr${sorting? ` draggable="true" data-drag-ledger="${l.id}"` : ''}>
                <td style="${sorting?'cursor:grab;':''}">${sorting? `<span title="Kéo để đổi vị trí">☰</span>` : (canEdit? `<button type="button" class="btn-plain-icon preview-allow" title="Sắp xếp" data-il-ldg-sortbtn="1" style="background:none; border:none; cursor:pointer;">☰</button>` : '')}</td>
                <td><b><button type="button" class="link-btn preview-allow" data-il-ldg-open="${l.id}">${escapeHtml(l.name)}</button></b></td>
                <td style="text-align:center;">${thuCount}</td>
                <td style="text-align:center;">${chiCount}</td>
                <td style="white-space:nowrap;">${canEdit? `<button type="button" class="btn-plain-icon preview-allow" data-il-ldg-rename="${l.id}" title="Đổi tên" style="background:none; border:none; cursor:pointer;">✏️</button><button type="button" class="btn-plain-icon preview-allow" data-il-ldg-del="${l.id}" title="Xoá" style="background:none; border:none; cursor:pointer;">🗑️</button>` : ''}</td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>` : `<div class="empty-state"><div class="e-ico">📒</div>Chưa có Sổ Thu - Chi nội bộ nào${canEdit? ' — bấm "➕ Tạo sổ mới" để bắt đầu' : ''}</div>`}
        </div>
      </div>`;
    const newBtn = document.getElementById('il-ldg-new');
    if(newBtn) newBtn.onclick = ()=> renderLedgerNameModal(null, el);
    el.querySelectorAll('[data-il-ldg-open]').forEach(btn=> btn.onclick = ()=>{
      state._ilCurrentLedgerId = btn.dataset.ilLdgOpen;
      ilResetEntryFilters();
      renderInternalLedgerMain(el);
    });
    el.querySelectorAll('[data-il-ldg-rename]').forEach(btn=> btn.onclick = ()=> renderLedgerNameModal(ilLedgerById(btn.dataset.ilLdgRename), el));
    el.querySelectorAll('[data-il-ldg-del]').forEach(btn=> btn.onclick = ()=>{
      if(!confirm('Xoá sổ này? Toàn bộ dòng Thu/Chi và phụ lục bên trong sẽ bị xoá vĩnh viễn.')) return;
      const d = ilData(); d.ledgers = d.ledgers.filter(l=>l.id!==btn.dataset.ilLdgDel); ilPersist();
      renderInternalLedgerListScreen(el);
    });
    el.querySelectorAll('[data-il-ldg-sortbtn]').forEach(btn=> btn.onclick = ()=>{ state._ilSortingLedgers = true; state._ilLedgerSortDraft = null; renderInternalLedgerListScreen(el); });
    const sortSaveBtn = document.getElementById('il-ldg-sort-save');
    if(sortSaveBtn) sortSaveBtn.onclick = ()=>{
      const order = state._ilLedgerSortDraft||[];
      const d = ilData();
      order.forEach((id,i)=>{ const l = d.ledgers.find(x=>x.id===id); if(l) l.order = i+1; });
      ilPersist();
      state._ilSortingLedgers = false; state._ilLedgerSortDraft = null;
      renderInternalLedgerListScreen(el);
    };
    const sortCancelBtn = document.getElementById('il-ldg-sort-cancel');
    if(sortCancelBtn) sortCancelBtn.onclick = ()=>{ state._ilSortingLedgers = false; state._ilLedgerSortDraft = null; renderInternalLedgerListScreen(el); };
    if(sorting){
      wireDragReorderWithIndicator(
        Array.from(el.querySelectorAll('[data-drag-ledger]')),
        row=> row.dataset.dragLedger,
        (draggedId, targetId, before)=>{
          const arr = (state._ilLedgerSortDraft||[]).filter(id=>id!==draggedId);
          let idx = arr.indexOf(targetId);
          if(!before) idx += 1;
          arr.splice(idx, 0, draggedId);
          state._ilLedgerSortDraft = arr;
          renderInternalLedgerListScreen(el);
        }
      );
    }
  }
  function renderLedgerNameModal(ledger, el){
    const isNew = !ledger;
    const suggestions = ilSuggestedLedgerNames();
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>${isNew? '➕ Tạo sổ mới' : '✏️ Đổi tên sổ'}</h3><button class="modal-close" id="illn-close">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Tên sổ * <span class="sub">(tối đa ${IL_MAX.ledgerName} ký tự)</span></label><input type="text" id="illn-name" maxlength="${IL_MAX.ledgerName}" value="${escapeHtml(ledger? ledger.name : '')}" placeholder="Vd: Sổ năm 2026"></div>
          ${isNew? `<p class="sub" style="margin:0 0 6px;">Gợi ý:</p><div style="display:flex; gap:8px; flex-wrap:wrap;">${suggestions.map(s=>`<button type="button" class="btn btn-ghost btn-sm preview-allow" data-illn-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div>` : ''}
        </div>
        <div class="modal-foot"><button class="btn btn-ghost" id="illn-cancel">Huỷ</button><button class="btn btn-primary" id="illn-save">💾 Lưu</button></div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#illn-close').onclick = close;
    wrap.querySelector('#illn-cancel').onclick = close;
    wrap.querySelectorAll('[data-illn-suggest]').forEach(btn=> btn.onclick = ()=>{ wrap.querySelector('#illn-name').value = btn.dataset.illnSuggest; });
    wrap.querySelector('#illn-save').onclick = ()=>{
      const name = wrap.querySelector('#illn-name').value.trim();
      if(!name){ alert('Vui lòng đặt tên sổ.'); return; }
      if(isNew){ ilCreateLedger(name); } else { ledger.name = name; ilPersist(); }
      close();
      renderInternalLedgerListScreen(el);
    };
  }

  // =====================================================================
  // CỔNG "CHẤP NHẬN VÀ BẮT ĐẦU MỞ SỔ" — màn giới thiệu giữ nguyên, thêm nút.
  // =====================================================================
  function renderInternalTab(el){
    if(!internalLedgerAccepted()){ renderInternalLedgerGate(el); return; }
    const ledger = ilCurrentLedger();
    if(ledger) renderInternalLedgerMain(el);
    else renderInternalLedgerListScreen(el);
  }
  function renderInternalLedgerGate(el){
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🔒 Thu – Chi nội bộ</h3></div>
        <div class="panel-body">
          <div class="empty-state">
            <div class="e-ico">🚧</div>
            <p style="max-width:480px; margin:0 auto;">Dữ liệu của Thu – Chi nội bộ được lưu <b>chỉ trên máy tính này</b> (bằng bộ nhớ cục bộ của trình duyệt), <b>không</b> đưa lên cơ sở dữ liệu đám mây Firebase như các mục còn lại của phần mềm, đảm bảo tính riêng tư tuyệt đối và không đồng bộ giữa các thiết bị.</p>
            <button type="button" class="btn btn-primary" id="il-accept-btn" style="margin-top:18px;">✅ Chấp nhận và Bắt đầu mở sổ Thu - Chi nội bộ</button>
          </div>
        </div>
      </div>`;
    const btn = document.getElementById('il-accept-btn');
    if(btn) btn.onclick = ()=>{ internalLedgerAccept(); renderInternalTab(el); };
  }

  // =====================================================================
  // BÊN TRONG 1 SỔ — Sổ Thu + Sổ Chi.
  // =====================================================================
  function ilEntriesOfType(ledger, type){
    return ledger.entries.filter(e=>e.type===type).sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  }
  function ilFilteredEntriesOfType(ledger, type){
    let list = ilEntriesOfType(ledger, type);
    const q = (state._ilSearch||'').trim().toLowerCase();
    if(q) list = list.filter(e=> ((e.content||'')+' '+(e.person||'')+' '+(e.note||'')).toLowerCase().includes(q));
    if(state._ilDateFrom) list = list.filter(e=> !e.date || e.date >= state._ilDateFrom);
    if(state._ilDateTo) list = list.filter(e=> !e.date || e.date <= state._ilDateTo);
    return list;
  }
  function ilTotalOfType(ledger, type){ return ilEntriesOfType(ledger, type).reduce((s,e)=> s+(parseInt(e.amount,10)||0), 0); }
  function ilFindEntry(ledger, id){ return ledger.entries.find(e=>e.id===id); }
  function ilAllAppendixTitles(ledger){ return ledger.entries.filter(e=>e.appendix).map(e=>e.appendix.title); }
  function ilGenerateAppendixName(ledger, type){
    const used = new Set(ilAllAppendixTitles(ledger));
    let n=1;
    while(used.has(`Phụ lục ${type==='thu'?'Thu':'Chi'} ${n}`)) n++;
    return `Phụ lục ${type==='thu'?'Thu':'Chi'} ${n}`;
  }

  function ilSummaryBarHtml(ledger){
    const totalThu = ilTotalOfType(ledger,'thu');
    const totalChi = ilTotalOfType(ledger,'chi');
    return `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-body" style="display:flex; flex-wrap:wrap; gap:18px; align-items:center;">
          <button type="button" class="btn btn-ghost btn-sm preview-allow" id="il-back-list">← Thoát ra danh sách Sổ</button>
          <div><span class="sub">Tổng Thu</span><br><b style="color:#1b5e20; font-size:17px;">${moneySpaced(totalThu)}</b></div>
          <div><span class="sub">Tổng Chi</span><br><b style="color:#b71c1c; font-size:17px;">${moneySpaced(totalChi)}</b></div>
          <div><span class="sub">Còn lại</span><br><b style="font-size:17px;">${moneySpaced(totalThu-totalChi)}</b></div>
          <div style="margin-left:auto; display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-sm preview-allow" id="il-ai-btn" style="background:linear-gradient(180deg, #ffffff 0%, #7c4dff 45%, #4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700;">✨ Thêm nhanh bằng AI</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="il-overview-excel-btn">📊 Xem bảng tổng hợp</button>
          </div>
        </div>
      </div>`;
  }
  function ilFilterBarHtml(){
    const redIf = v=> v? 'border:2px solid #b71c1c;' : '';
    return `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-body" style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
          <div class="field" style="flex:1; min-width:180px; margin:0;"><label>Tìm nội dung/người</label><input type="text" id="il-search" maxlength="${IL_MAX.content}" value="${escapeHtml(state._ilSearch||'')}" placeholder="Gõ để tìm..." style="${redIf(state._ilSearch)}"></div>
          <div class="field" style="margin:0;"><label>Từ ngày</label><input type="date" id="il-date-from" value="${state._ilDateFrom||''}" style="${redIf(state._ilDateFrom)}"></div>
          <div class="field" style="margin:0;"><label>Đến ngày</label><input type="date" id="il-date-to" value="${state._ilDateTo||''}" style="${redIf(state._ilDateTo)}"></div>
          <button type="button" class="btn btn-ghost btn-sm" id="il-filter-clear">Xoá lọc</button>
        </div>
      </div>`;
  }
  function ilAppendixBtnHtml(e){
    if(e.appendix) return `<button type="button" class="btn btn-sm preview-allow" data-il-appendix="${e.id}" title="${escapeHtml(e.appendix.title)}" style="background:#c8e6c9; border-color:#2e7d32; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block;">📎 ${escapeHtml(e.appendix.title)}</button>`;
    return `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-il-appendix="${e.id}">+ Thêm phụ lục</button>`;
  }
  function ilEntryRowHtml(e, canEdit){
    return `<tr>
      <td>${fmtDate(e.date)}</td>
      <td>${escapeHtml(e.content||'')}</td>
      <td class="money" style="text-align:right;">${moneySpaced(e.amount)}${e.amountMode==='appendix'? ' <span class="sub" title="Đồng bộ theo phụ lục">🔗</span>' : ''}</td>
      <td>${escapeHtml(e.person||'')}</td>
      <td>${escapeHtml(e.note||'')}</td>
      <td style="white-space:nowrap;">${ilAppendixBtnHtml(e)}</td>
      ${canEdit? `<td style="white-space:nowrap;"><button type="button" class="btn-plain-icon preview-allow" data-il-edit="${e.id}" title="Sửa" style="background:none; border:none; cursor:pointer;">✏️</button><button type="button" class="btn-plain-icon preview-allow" data-il-del="${e.id}" title="Xoá" style="background:none; border:none; cursor:pointer;">🗑️</button></td>` : ''}
    </tr>`;
  }
  function ilPanelHtml(ledger, type, canEdit){
    const isThu = type==='thu';
    const showKey = isThu ? '_ilShowThu' : '_ilShowChi';
    const open = state[showKey]!==false;
    const rawCount = ilEntriesOfType(ledger, type).length;
    const list = ilFilteredEntriesOfType(ledger, type);
    const label = isThu? 'Sổ Thu' : 'Sổ Chi';
    const personLabel = isThu? 'Người thu' : 'Người chi';
    const isFiltering = !!(state._ilSearch || state._ilDateFrom || state._ilDateTo);
    const emptyMsg = rawCount===0
      ? `Chưa có dòng ${isThu?'thu':'chi'} nào${canEdit? ` — bấm "➕ Thêm dòng ${isThu?'thu':'chi'}" để bắt đầu` : ''}`
      : `Không có nội dung nào phù hợp với nội dung tìm kiếm và bộ lọc phía trên.`;
    return `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-head" style="cursor:pointer;" id="il-toggle-${type}"><h3>${isThu?'📥':'📤'} ${label} (${list.length}${isFiltering && rawCount!==list.length? `/${rawCount}` : ''}) ${open?'▴':'▾'}</h3>
          <div style="display:flex; gap:8px;">
            ${canEdit? `<button type="button" class="btn btn-primary btn-sm preview-allow" id="il-add-${type}">➕ Thêm dòng ${isThu?'thu':'chi'}</button>` : ''}
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="il-excel-${type}">📊 Xem bảng Excel</button>
          </div>
        </div>
        ${open? `<div class="panel-body">
          ${list.length? `<div class="table-wrap"><table>
            <thead><tr><th>Ngày</th><th>Nội dung ${isThu?'thu':'chi'}</th><th style="text-align:right;">Số tiền</th><th>${personLabel}</th><th>Ghi chú</th><th>Phụ lục</th>${canEdit? '<th></th>' : ''}</tr></thead>
            <tbody>${list.map(e=>ilEntryRowHtml(e,canEdit)).join('')}</tbody>
          </table></div>` : `<div class="empty-state"><div class="e-ico">${isThu?'📥':'📤'}</div>${emptyMsg}</div>`}
        </div>` : ''}
      </div>`;
  }
  function renderInternalLedgerMain(el){
    const ledger = ilCurrentLedger();
    if(!ledger){ renderInternalLedgerListScreen(el); return; }
    const canEdit = canEditModule('internal');
    el.innerHTML = `
      <h2 style="margin:0 0 10px;">📒 ${escapeHtml(ledger.name)}</h2>
      ${ilSummaryBarHtml(ledger)}
      ${ilFilterBarHtml()}
      ${ilPanelHtml(ledger,'thu', canEdit)}
      ${ilPanelHtml(ledger,'chi', canEdit)}
    `;
    wireInternalLedgerMain(el);
  }
  function wireInternalLedgerMain(el){
    const ledger = ilCurrentLedger();
    if(!ledger) return;
    const backBtn = document.getElementById('il-back-list');
    if(backBtn) backBtn.onclick = ()=>{ state._ilCurrentLedgerId = null; renderInternalLedgerListScreen(el); };
    const aiBtn = document.getElementById('il-ai-btn');
    if(aiBtn) aiBtn.onclick = ()=> renderLedgerQuickAddModal(ledger);
    const overviewBtn = document.getElementById('il-overview-excel-btn');
    if(overviewBtn) overviewBtn.onclick = ()=> renderInternalExcelModal(ledger, 'all');
    const searchInput = document.getElementById('il-search');
    if(searchInput) searchInput.oninput = ()=>{ state._ilSearch = searchInput.value; rerenderKeepingFocus(()=>renderInternalLedgerMain(el)); };
    const fromInput = document.getElementById('il-date-from');
    if(fromInput) fromInput.onchange = ()=>{ state._ilDateFrom = fromInput.value; renderInternalLedgerMain(el); };
    const toInput = document.getElementById('il-date-to');
    if(toInput) toInput.onchange = ()=>{ state._ilDateTo = toInput.value; renderInternalLedgerMain(el); };
    const clearBtn = document.getElementById('il-filter-clear');
    if(clearBtn) clearBtn.onclick = ()=>{ ilResetEntryFilters(); renderInternalLedgerMain(el); };
    ['thu','chi'].forEach(type=>{
      const toggle = document.getElementById('il-toggle-'+type);
      if(toggle) toggle.onclick = ()=>{ const k = type==='thu'?'_ilShowThu':'_ilShowChi'; state[k] = !(state[k]!==false); renderInternalLedgerMain(el); };
      const addBtn = document.getElementById('il-add-'+type);
      if(addBtn) addBtn.onclick = (e)=>{ e.stopPropagation(); renderInternalEntryModal(ledger, type, null, el); };
      const excelBtn = document.getElementById('il-excel-'+type);
      if(excelBtn) excelBtn.onclick = (e)=>{ e.stopPropagation(); renderInternalExcelModal(ledger, type); };
    });
    el.querySelectorAll('[data-il-edit]').forEach(btn=> btn.onclick = ()=>{
      const entry = ilFindEntry(ledger, btn.dataset.ilEdit);
      if(entry) renderInternalEntryModal(ledger, entry.type, entry, el);
    });
    el.querySelectorAll('[data-il-del]').forEach(btn=> btn.onclick = ()=>{
      if(!confirm('Xoá dòng này? Phụ lục đi kèm (nếu có) cũng sẽ bị xoá.')) return;
      ledger.entries = ledger.entries.filter(e=>e.id!==btn.dataset.ilDel); ilPersist(); renderInternalLedgerMain(el);
    });
    el.querySelectorAll('[data-il-appendix]').forEach(btn=> btn.onclick = ()=>{
      const entry = ilFindEntry(ledger, btn.dataset.ilAppendix);
      if(entry) renderInternalAppendixEditorModal(ledger, entry, el);
    });
  }

  // =====================================================================
  // MODAL THÊM/SỬA 1 DÒNG THU HOẶC CHI.
  // =====================================================================
  function renderInternalEntryModal(ledger, type, entry, el){
    const isNew = !entry;
    const e0 = entry || { id: ilNewId('il'), type, date: todayStr(), content:'', amountMode:'manual', amount:0, person:'', note:'', appendix:null };
    const isThu = type==='thu';
    let amountMode = e0.amountMode||'manual';
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    function render(){
      wrap.innerHTML = `
        <div class="modal">
          <div class="modal-head"><h3>${isNew? `Thêm dòng ${isThu?'thu':'chi'} mới` : `Sửa dòng ${isThu?'thu':'chi'}`}</h3><button class="modal-close" id="ilm-close">✕</button></div>
          <div class="modal-body">
            <div class="field"><label>Ngày *</label><input type="date" id="ilm-date" value="${e0.date||''}"></div>
            <div class="field"><label>Nội dung ${isThu?'thu':'chi'} * <span class="sub">(tối đa ${IL_MAX.content} ký tự)</span></label><input type="text" id="ilm-content" maxlength="${IL_MAX.content}" value="${escapeHtml(e0.content||'')}"></div>
            <div class="field">
              <label>Số tiền</label>
              <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
                <label style="display:flex; gap:8px; align-items:flex-start; font-weight:400;"><input type="radio" name="ilm-amount-mode" value="manual" ${amountMode==='manual'?'checked':''} style="margin-top:3px;"><span>Nhập số tiền cụ thể<br><span class="sub">Tự gõ đúng số tiền của dòng ${isThu?'thu':'chi'} này.</span></span></label>
                <label style="display:flex; gap:8px; align-items:flex-start; font-weight:400;"><input type="radio" name="ilm-amount-mode" value="appendix" ${amountMode==='appendix'?'checked':''} style="margin-top:3px;"><span>Số tiền được đồng bộ theo phụ lục kèm theo của dòng này<br><span class="sub">Số tiền sẽ tự tính theo cột tiền chính của phụ lục, không gõ tay — mặc định 0 đ cho đến khi phụ lục có dữ liệu.</span></span></label>
              </div>
              ${amountMode==='manual'? `<label>Số tiền (đ) * <span class="sub">(tối đa ${IL_MAX.moneyDigits} số)</span> <span class="sub" id="ilm-amount-disp" style="font-weight:700; color:#b71c1c;"></span></label><input type="text" inputmode="numeric" id="ilm-amount" value="${e0.amount||''}" placeholder="Chỉ nhập số">` : `<p class="sub">Số tiền hiện tại (đồng bộ theo phụ lục): <b>${moneySpaced(e0.amountMode==='appendix'? e0.amount : 0)}</b></p>`}
            </div>
            <div class="field"><label>Người ${isThu?'thu':'chi'} <span class="sub">(tối đa ${IL_MAX.person} ký tự)</span></label><input type="text" id="ilm-person" maxlength="${IL_MAX.person}" value="${escapeHtml(e0.person||'')}"></div>
            <div class="field"><label>Ghi chú <span class="sub">(tối đa ${IL_MAX.note} ký tự)</span></label><textarea id="ilm-note" rows="3" maxlength="${IL_MAX.note}">${escapeHtml(e0.note||'')}</textarea></div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="ilm-cancel">Huỷ</button>
            <button class="btn btn-primary" id="ilm-save">💾 Lưu</button>
          </div>
        </div>`;
      const close = ()=> wrap.remove();
      wrap.querySelector('#ilm-close').onclick = close;
      wrap.querySelector('#ilm-cancel').onclick = close;
      wrap.querySelectorAll('[name="ilm-amount-mode"]').forEach(r=> r.onchange = ()=>{ amountMode = r.value; render(); });
      let amountInput = wrap.querySelector('#ilm-amount');
      if(amountInput){
        const amountDisp = wrap.querySelector('#ilm-amount-disp');
        attachMoneyInputMask(amountInput, IL_MAX.moneyDigits);
        const updateAmountDisp = ()=>{ const digits = amountInput.value.replace(/[^\d]/g,''); amountDisp.textContent = digits? `= ${groupDigitsRight(digits,3)} đ` : ''; };
        amountInput.addEventListener('input', updateAmountDisp);
        updateAmountDisp();
      }
      wrap.querySelector('#ilm-save').onclick = ()=>{
        const date = wrap.querySelector('#ilm-date').value;
        const content = wrap.querySelector('#ilm-content').value.trim();
        let amount = e0.amount||0;
        if(amountMode==='manual'){
          amount = parseVNMoney(wrap.querySelector('#ilm-amount').value);
          if(!amount){ alert('Vui lòng điền Số tiền.'); return; }
        } else {
          amount = e0.amountMode==='appendix' ? (e0.amount||0) : 0;
        }
        if(!date || !content){ alert('Vui lòng điền đủ Ngày và Nội dung.'); return; }
        let appendix = e0.appendix;
        if(amountMode==='appendix' && !appendix){
          appendix = { id: ilNewId('ila'), title: ilGenerateAppendixName(ledger, type), designatedKey:null, columns: ilDefaultAppendixColumns(), rows:[] };
        }
        const updated = { ...e0, date, content, amount, amountMode, person: wrap.querySelector('#ilm-person').value.trim(), note: wrap.querySelector('#ilm-note').value.trim(), appendix };
        const idx = ledger.entries.findIndex(x=>x.id===e0.id);
        if(idx>=0) ledger.entries[idx] = updated; else ledger.entries.push(updated);
        ilPersist(); close();
        renderInternalLedgerMain(el);
      };
    }
    document.body.appendChild(wrap);
    render();
  }

  // =====================================================================
  // CÔNG THỨC (chỉ cộng/trừ/nhân/chia, tham chiếu ô trong CÙNG 1 phụ lục).
  // =====================================================================
  function ilColLetter(i){ return String.fromCharCode(65+i); }
  function ilSafeEvalArithmetic(str){
    let i = 0;
    function skipWs(){ while(str[i]===' ') i++; }
    function parseNumber(){ skipWs(); let neg=false; if(str[i]==='-'){ neg=true; i++; } let start=i; while(/[\d.]/.test(str[i]||'')) i++; const v = parseFloat(str.slice(start,i))||0; return neg? -v : v; }
    function parseFactor(){ skipWs(); if(str[i]==='('){ i++; const v=parseExpr(); skipWs(); if(str[i]===')') i++; return v; } return parseNumber(); }
    function parseTerm(){ let v=parseFactor(); for(;;){ skipWs(); const op=str[i]; if(op==='*'||op==='/'){ i++; const r=parseFactor(); v = op==='*'? v*r : (r? v/r : 0); } else break; } return v; }
    function parseExpr(){ let v=parseTerm(); for(;;){ skipWs(); const op=str[i]; if(op==='+'||op==='-'){ i++; const r=parseTerm(); v = op==='+'? v+r : v-r; } else break; } return v; }
    return parseExpr();
  }
  function ilResolveMoneyCell(ap, rowIdx, colKey, visiting){
    const cellId = rowIdx+'|'+colKey;
    if(visiting.has(cellId)) return 0;
    visiting.add(cellId);
    const raw = String((ap.rows[rowIdx]||{})[colKey] ?? '').trim();
    let result;
    if(raw.startsWith('=')) result = ilEvalFormula(ap, raw.slice(1), visiting);
    else result = parseInt(raw.replace(/[^\d-]/g,''),10) || 0;
    visiting.delete(cellId);
    return result;
  }
  function ilEvalFormula(ap, expr, visiting){
    const substituted = expr.replace(/([A-Za-z])(\d+)/g, (m, L, R)=>{
      const ci = L.toUpperCase().charCodeAt(0)-65;
      const ri = parseInt(R,10)-1;
      const col = ap.columns[ci];
      if(!col || ri<0 || ri>=ap.rows.length) return '0';
      return String(ilResolveMoneyCell(ap, ri, col.key, visiting));
    });
    if(!/^[\d+\-*/().\s]+$/.test(substituted)) return 0;
    try{ return Math.round(ilSafeEvalArithmetic(substituted)); }catch(e){ return 0; }
  }
  function ilCellComputed(ap, rowIdx, colKey){
    const col = ap.columns.find(c=>c.key===colKey);
    const raw = (ap.rows[rowIdx]||{})[colKey];
    if(!col || col.type!=='money') return raw||'';
    return ilResolveMoneyCell(ap, rowIdx, colKey, new Set());
  }
  function ilAppendixColumnTotal(ap, colKey){
    return ap.rows.reduce((s,_,ri)=> s + (parseInt(ilCellComputed(ap, ri, colKey),10)||0), 0);
  }
  function ilAppendixDesignatedTotal(ap){ return ap.designatedKey ? ilAppendixColumnTotal(ap, ap.designatedKey) : 0; }
  function ilFormulaValid(expr){
    const body = expr.trim().replace(/^=/,'');
    return /^[A-Za-z0-9+\-*/().\s]+$/.test(body) && body.length>0;
  }
  function renderFormulaEditorModal(anchorInput, currentRaw, onSave){
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed; z-index:10000; background:var(--white); border:2px solid #4527a0; border-radius:10px; padding:10px; box-shadow:0 6px 20px rgba(0,0,0,.3); width:300px;';
    const r = anchorInput.getBoundingClientRect();
    wrap.style.left = Math.min(r.left, window.innerWidth-320)+'px';
    wrap.style.top = (r.bottom+6)+'px';
    wrap.innerHTML = `
      <div style="font-weight:700; margin-bottom:6px;">ƒ Công thức (chỉ + − × ÷)</div>
      <input type="text" id="ilf-input" value="${escapeHtml(currentRaw && currentRaw.startsWith('=')? currentRaw : '=')}" style="width:100%; padding:6px 8px; border:1px solid var(--line); border-radius:6px; font-family:monospace;">
      <div style="display:flex; gap:6px; margin:8px 0;">
        ${['+','-','×','÷'].map(op=>`<button type="button" class="btn btn-ghost btn-sm preview-allow" data-ilf-op="${op}">${op}</button>`).join('')}
      </div>
      <p class="sub" style="margin:0 0 8px;">Vd: =A1+B2-C1/G2*D2 — bấm vào 1 ô tiền khác trong bảng để chèn toạ độ ô đó vào đây.</p>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilf-cancel">Huỷ</button>
        <button type="button" class="btn btn-primary btn-sm preview-allow" id="ilf-save">Lưu công thức</button>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const input = wrap.querySelector('#ilf-input');
    wrap.querySelectorAll('[data-ilf-op]').forEach(btn=> btn.onclick = ()=>{
      const op = btn.dataset.ilfOp==='×'?'*':btn.dataset.ilfOp==='÷'?'/':btn.dataset.ilfOp;
      const pos = input.selectionStart||input.value.length;
      input.value = input.value.slice(0,pos)+op+input.value.slice(pos);
      input.focus(); input.setSelectionRange(pos+1,pos+1);
    });
    wrap.querySelector('#ilf-cancel').onclick = close;
    wrap.querySelector('#ilf-save').onclick = ()=>{
      if(!ilFormulaValid(input.value)){ alert('Công thức không hợp lệ — chỉ cho phép toạ độ ô (vd A1), số, và các phép + − × ÷ ( ).'); return; }
      onSave(input.value.trim());
      close();
    };
    return { wrap, insertRef: (ref)=>{ const pos = input.selectionStart||input.value.length; input.value = input.value.slice(0,pos)+ref+input.value.slice(pos); input.focus(); input.setSelectionRange(pos+ref.length,pos+ref.length); } };
  }

  // =====================================================================
  // Ô TIỀN — mặt nạ nhập (giữ số thô khi đang gõ, tách nhóm khi rời ô) + lớp
  // nổi "= x đ" đồng bộ theo thời gian thực, sát ngay ô đang gõ.
  // =====================================================================
  function ilAttachFloatingMoneyPreview(input){
    let badge = null;
    function position(){ if(!badge) return; const r = input.getBoundingClientRect(); badge.style.left = r.left+'px'; badge.style.top = Math.max(0, r.top-26)+'px'; }
    function update(){ if(!badge) return; const digits = input.value.replace(/[^\d]/g,''); badge.textContent = digits? `= ${groupDigitsRight(digits,3)} đ` : ''; }
    function show(){ if(badge) return; badge = document.createElement('div'); badge.className = 'il-money-float-badge'; document.body.appendChild(badge); position(); update(); }
    function hide(){ if(badge){ badge.remove(); badge=null; } }
    input.addEventListener('focus', show);
    input.addEventListener('input', ()=>{ update(); position(); });
    input.addEventListener('blur', hide);
  }

  // =====================================================================
  // PHỤ LỤC — tối đa 1/dòng, cột tự do (Chữ hoặc Tiền), đánh số A/B/C.../1/2/3,
  // 1 cột tiền được chọn làm "cột quyết định số tiền chung", công thức, ẩn/hiện tổng.
  // =====================================================================
  function ilDefaultAppendixColumns(){
    return [ { key: ilNewId('c'), label:'Nội dung', type:'text', showTotal:true }, { key: ilNewId('c'), label:'Số tiền', type:'money', showTotal:true } ];
  }
  function renderInternalAppendixEditorModal(ledger, entry, el){
    entry.appendix = entry.appendix || { id: ilNewId('ila'), title: ilGenerateAppendixName(ledger, entry.type), designatedKey:null, columns: ilDefaultAppendixColumns(), rows:[] };
    const ap = entry.appendix;
    const canEdit = canEditModule('internal');
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    function syncEntryAmountIfNeeded(){
      if(entry.amountMode==='appendix') entry.amount = ilAppendixDesignatedTotal(ap);
    }
    function readFormIntoAp(){
      wrap.querySelectorAll('.ilae-col-label').forEach(inp=>{ ap.columns[+inp.dataset.ci].label = inp.value; });
      wrap.querySelectorAll('.ilae-cell-text').forEach(inp=>{ ap.rows[+inp.dataset.ri][inp.dataset.ck] = inp.value; });
      wrap.querySelectorAll('.ilae-cell-money').forEach(inp=>{ if(!String(ap.rows[+inp.dataset.ri][inp.dataset.ck]||'').startsWith('=')) ap.rows[+inp.dataset.ri][inp.dataset.ck] = inp.value.replace(/[^\d]/g,''); });
    }
    function render(){
      const titleDupOk = (()=>{
        const others = ledger.entries.filter(e=>e.id!==entry.id && e.appendix).map(e=>e.appendix.title);
        return !others.includes((document.getElementById('ilae-title')? document.getElementById('ilae-title').value : ap.title).trim());
      })();
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
          <div class="modal-head"><h3>📎 Phụ lục — ${escapeHtml(entry.content||'')}</h3><button class="modal-close" id="ilae-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:14px;">
            <div class="field"><label>Tên phụ lục * <span class="sub">(tối đa ${IL_MAX.title} ký tự — không được trùng với phụ lục khác trong sổ này)</span></label><input type="text" id="ilae-title" maxlength="${IL_MAX.title}" value="${escapeHtml(ap.title||'')}" ${canEdit?'':'disabled'}></div>
            <p class="sub" style="margin:10px 0 4px;"><b>Cột của bảng</b> — bấm ⭐ ở cột Tiền để chọn làm cột quyết định số tiền chung của dòng ${entry.type==='thu'?'thu':'chi'} này.</p>
            <div class="table-wrap"><table id="ilae-table">
              <thead>
                <tr>
                  ${canEdit? `<th></th>` : ''}<th></th>
                  ${ap.columns.map((c,ci)=>`<th style="text-align:center;">${ilColLetter(ci)}</th>`).join('')}
                </tr>
                <tr>
                  ${canEdit? `<th></th>` : ''}<th></th>
                  ${ap.columns.map((c,ci)=>`<th>
                    <input type="text" class="ilae-col-label" data-ci="${ci}" maxlength="${IL_MAX.colLabel}" value="${escapeHtml(c.label)}" style="width:100%; font-weight:700; border:1px solid var(--line); border-radius:4px; padding:3px 5px;" ${canEdit?'':'disabled'}>
                    <div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-top:3px;">
                      <select class="ilae-col-type" data-ci="${ci}" ${canEdit?'':'disabled'}><option value="text" ${c.type==='text'?'selected':''}>Chữ</option><option value="money" ${c.type==='money'?'selected':''}>Tiền</option></select>
                      ${c.type==='money' && canEdit? `<button type="button" class="btn-plain-icon preview-allow ilae-col-star" data-ci="${ci}" title="${ap.designatedKey===c.key?'Đang là cột quyết định — bấm để bỏ chọn':'Chọn làm cột quyết định số tiền chung'}" style="background:none; border:none; cursor:pointer; font-size:15px;">${ap.designatedKey===c.key?'⭐':'☆'}</button>` : ''}
                      ${canEdit? `<button type="button" class="btn-plain-icon preview-allow ilae-col-del" data-ci="${ci}" title="Xoá cột" style="background:none; border:none; cursor:pointer;" ${ap.columns.length<=1?'disabled':''}>🗑️</button>` : ''}
                    </div>
                  </th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${ap.rows.map((r,ri)=>`<tr>
                  ${canEdit? `<td style="text-align:center;"><button type="button" class="btn-plain-icon preview-allow ilae-row-del" data-ri="${ri}" title="Xoá dòng" style="background:none; border:none; cursor:pointer;">🗑️</button></td>` : ''}
                  <td style="text-align:center; font-weight:700; background:var(--paper-2);">${ri+1}</td>
                  ${ap.columns.map(c=>{
                    const raw = r[c.key]!=null? String(r[c.key]) : '';
                    if(c.type==='money'){
                      const isFormula = raw.startsWith('=');
                      const displayVal = isFormula? ilCellComputed(ap, ri, c.key) : raw;
                      return `<td style="position:relative;">
                        <input type="text" inputmode="numeric" class="ilae-cell-money" data-ri="${ri}" data-ck="${c.key}" value="${escapeHtml(String(displayVal||''))}" placeholder="Chỉ nhập số" style="text-align:right; width:100%; ${isFormula?'background:#ede7f6; font-style:italic;':''}" ${canEdit?'':'disabled'} title="${isFormula? 'Công thức: '+raw : ''}">
                        ${canEdit? `<button type="button" class="btn-plain-icon preview-allow ilae-cell-fx" data-ri="${ri}" data-ck="${c.key}" title="Thêm công thức" style="position:absolute; right:-18px; top:2px; background:none; border:none; cursor:pointer; font-size:12px;">ƒ</button>` : ''}
                      </td>`;
                    }
                    return `<td><input type="text" class="ilae-cell-text" data-ri="${ri}" data-ck="${c.key}" maxlength="${IL_MAX.cellText}" value="${escapeHtml(raw)}" style="width:100%;" ${canEdit?'':'disabled'}></td>`;
                  }).join('')}
                </tr>`).join('')}
                <tr id="ilae-totals-row" style="font-weight:700; background:var(--paper-2);">
                  ${canEdit? `<td></td>` : ''}<td>Tổng</td>
                  ${ap.columns.map(c=>{
                    if(c.type!=='money') return '<td></td>';
                    const isDesignated = ap.designatedKey===c.key;
                    const hidden = !isDesignated && c.showTotal===false;
                    const total = ilAppendixColumnTotal(ap, c.key);
                    return `<td style="text-align:right; cursor:${isDesignated?'default':'pointer'}; ${isDesignated? 'background:#b71c1c; color:#fff; font-weight:800;' : ''}" class="ilae-total-cell" data-ck="${c.key}">${hidden? `<span class="sub" style="font-weight:400;">(đang ẩn — bấm để hiện)</span>` : moneySpaced(total)}</td>`;
                  }).join('')}
                </tr>
              </tbody>
            </table></div>
            ${canEdit? `<button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilae-col-add" style="margin-top:8px;">➕ Thêm cột</button> <button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilae-row-add" style="margin-top:8px;">➕ Thêm dòng</button>` : ''}
            <p class="sub" style="margin-top:12px;">${ap.designatedKey? `Cột quyết định số tiền chung: <b>${escapeHtml((ap.columns.find(c=>c.key===ap.designatedKey)||{}).label||'')}</b> = <b>${moneySpaced(ilAppendixDesignatedTotal(ap))}</b>${entry.amountMode==='appendix'? ' (đang đồng bộ với số tiền dòng '+(entry.type==='thu'?'thu':'chi')+')' : ''}` : 'Chưa chọn cột quyết định số tiền chung.'}</p>
          </div>
          <div class="modal-foot">
            ${canEdit? `<button class="btn btn-ghost" id="ilae-cancel">Huỷ</button><button class="btn btn-primary" id="ilae-save">💾 Lưu phụ lục</button>` : `<button class="btn btn-ghost" id="ilae-cancel">Đóng</button>`}
          </div>
        </div>`;
      const close = ()=> wrap.remove();
      wrap.querySelector('#ilae-close').onclick = close;
      wrap.querySelector('#ilae-cancel').onclick = close;
      wrap.querySelectorAll('.ilae-cell-money').forEach(inp=> ilAttachFloatingMoneyPreview(inp));
      wrap.querySelectorAll('.ilae-cell-money').forEach(inp=> inp.addEventListener('input', ()=>{
        if(String(ap.rows[+inp.dataset.ri][inp.dataset.ck]||'').startsWith('=')) return; // công thức: không cho gõ tay đè lên, phải xoá công thức trước
        inp.value = inp.value.replace(/[^\d]/g,'').slice(0, IL_MAX.moneyDigits);
        ap.rows[+inp.dataset.ri][inp.dataset.ck] = inp.value;
        const totalsRow = wrap.querySelector('#ilae-totals-row');
        if(totalsRow){
          const cell = totalsRow.querySelector(`[data-ck="${inp.dataset.ck}"]`);
          const col = ap.columns.find(c=>c.key===inp.dataset.ck);
          if(cell && !(col.showTotal===false && ap.designatedKey!==col.key)) cell.textContent = moneySpaced(ilAppendixColumnTotal(ap, inp.dataset.ck));
        }
      }));
      wrap.querySelectorAll('.ilae-cell-fx').forEach(btn=> btn.onclick = ()=>{
        const input = wrap.querySelector(`.ilae-cell-money[data-ri="${btn.dataset.ri}"][data-ck="${btn.dataset.ck}"]`);
        const current = ap.rows[+btn.dataset.ri][btn.dataset.ck];
        let picker = renderFormulaEditorModal(input, current, (formula)=>{
          ap.rows[+btn.dataset.ri][btn.dataset.ck] = '='+formula.replace(/^=/,'');
          readFormIntoAp(); render();
          const content2 = document.getElementById('content'); if(content2 && document.getElementById('il-overview-excel-btn')) {}
        });
        function pickHandler(e){
          const target = e.target;
          if(target.classList && target.classList.contains('ilae-cell-money') && target!==input){
            e.preventDefault(); e.stopPropagation();
            picker.insertRef(ilColLetter(ap.columns.findIndex(c=>c.key===target.dataset.ck)) + (parseInt(target.dataset.ri,10)+1));
          }
        }
        wrap.querySelector('#ilae-table').addEventListener('mousedown', pickHandler, true);
      });
      wrap.querySelectorAll('.ilae-col-label').forEach(inp=> inp.addEventListener('input', ()=>{
        ap.columns[+inp.dataset.ci].label = inp.value;
      }));
      wrap.querySelectorAll('.ilae-col-type').forEach(sel=> sel.onchange = ()=>{ readFormIntoAp(); ap.columns[+sel.dataset.ci].type = sel.value; if(sel.value!=='money' && ap.designatedKey===ap.columns[+sel.dataset.ci].key) ap.designatedKey=null; render(); });
      wrap.querySelectorAll('.ilae-col-star').forEach(btn=> btn.onclick = ()=>{
        readFormIntoAp();
        const col = ap.columns[+btn.dataset.ci];
        if(ap.designatedKey===col.key){ ap.designatedKey=null; if(entry.amountMode==='appendix') entry.amount=0; render(); return; }
        const newTotal = ilAppendixColumnTotal(ap, col.key);
        const proceed = ()=>{ ap.designatedKey = col.key; col.showTotal = true; syncEntryAmountIfNeeded(); render(); };
        if(entry.amountMode==='appendix'){
          if(confirm(`Bạn có chắc chắn muốn chọn cột "${col.label}" làm cột quyết định số tiền chung của phụ lục này?\n\nDòng ${entry.type==='thu'?'thu':'chi'} mà phụ lục này thuộc về đang là ${moneySpaced(entry.amount)}. Nếu bấm Đồng ý, số tiền này sẽ đổi thành ${moneySpaced(newTotal)} để đồng bộ theo tổng cột "${col.label}", và từ nay sẽ luôn tự cập nhật theo tổng cột đó.`)) proceed();
        } else proceed();
      });
      wrap.querySelectorAll('.ilae-total-cell').forEach(td=> td.onclick = ()=>{
        const col = ap.columns.find(c=>c.key===td.dataset.ck);
        if(!col || ap.designatedKey===col.key) return;
        readFormIntoAp();
        col.showTotal = col.showTotal===false ? true : false;
        render();
      });
      if(canEdit){
        wrap.querySelector('#ilae-col-add').onclick = ()=>{ readFormIntoAp(); ap.columns.push({ key: ilNewId('c'), label:'Cột mới', type:'text', showTotal:true }); render(); };
        wrap.querySelectorAll('.ilae-col-del').forEach(btn=> btn.onclick = ()=>{
          if(ap.columns.length<=1) return;
          readFormIntoAp();
          const col = ap.columns[+btn.dataset.ci];
          if(ap.designatedKey===col.key){ ap.designatedKey=null; if(entry.amountMode==='appendix') entry.amount=0; }
          ap.columns.splice(+btn.dataset.ci,1);
          ap.rows.forEach(r=>{ delete r[col.key]; });
          render();
        });
        wrap.querySelector('#ilae-row-add').onclick = ()=>{ readFormIntoAp(); ap.rows.push({}); render(); };
        wrap.querySelectorAll('.ilae-row-del').forEach(btn=> btn.onclick = ()=>{ readFormIntoAp(); ap.rows.splice(+btn.dataset.ri,1); render(); });
        wrap.querySelector('#ilae-save').onclick = ()=>{
          readFormIntoAp();
          const title = wrap.querySelector('#ilae-title').value.trim();
          if(!title){ alert('Vui lòng đặt tên cho phụ lục.'); return; }
          const dup = ledger.entries.some(e=> e.id!==entry.id && e.appendix && e.appendix.title===title);
          if(dup){ alert('Tên phụ lục này đã được dùng ở một dòng khác trong sổ — vui lòng đặt tên khác.'); return; }
          ap.title = title;
          syncEntryAmountIfNeeded();
          ilPersist(); close();
          renderInternalLedgerMain(el);
        };
      }
    }
    document.body.appendChild(wrap);
    render();
  }

  // =====================================================================
  // XEM BẢNG EXCEL / TẢI / IN — kind: 'thu' | 'chi' | 'appendix' | 'all'.
  // =====================================================================
  function ilAoaLedger(ledger, type){
    const isThu = type==='thu';
    const headers = ['Ngày','Nội dung '+(isThu?'thu':'chi'),'Số tiền','Người '+(isThu?'thu':'chi'),'Ghi chú','Phụ lục đi kèm'];
    const list = ilEntriesOfType(ledger, type);
    const rows = list.map(e=>[ fmtDate(e.date), e.content||'', e.amount||0, e.person||'', e.note||'', e.appendix? e.appendix.title : '' ]);
    rows.push(['','TỔNG', list.reduce((s,e)=>s+(parseInt(e.amount,10)||0),0), '', '', '']);
    return { headers, rows };
  }
  function ilAoaAppendix(ap){
    const headers = ap.columns.map(c=>c.label);
    const rows = ap.rows.map((r,ri)=> ap.columns.map(c=> c.type==='money' ? ilCellComputed(ap,ri,c.key) : (r[c.key]!=null? r[c.key] : '')));
    rows.push(ap.columns.map(c=> c.type==='money' ? ilAppendixColumnTotal(ap, c.key) : (ap.columns[0]===c?'TỔNG':'')));
    return { headers, rows };
  }
  function ilAllSections(ledger){
    const sections = [{ title:'Tổng quan', headers:['Chỉ tiêu','Số tiền'], rows:[
      ['Tổng Thu', ilTotalOfType(ledger,'thu')], ['Tổng Chi', ilTotalOfType(ledger,'chi')], ['Còn lại', ilTotalOfType(ledger,'thu')-ilTotalOfType(ledger,'chi')],
    ] }];
    sections.push({ title:'Sổ Thu', ...ilAoaLedger(ledger,'thu') });
    sections.push({ title:'Sổ Chi', ...ilAoaLedger(ledger,'chi') });
    ledger.entries.forEach(e=>{ if(e.appendix) sections.push({ title:`Phụ lục — ${e.content||''} — ${e.appendix.title||''}`, ...ilAoaAppendix(e.appendix) }); });
    return sections;
  }
  function renderInternalExcelModal(ledger, kind, appendixEntry){
    let sections;
    if(kind==='all') sections = ilAllSections(ledger);
    else if(kind==='appendix') sections = [{ title:`Phụ lục — ${appendixEntry.appendix.title||''}`, ...ilAoaAppendix(appendixEntry.appendix) }];
    else sections = [{ title: kind==='thu'?'Sổ Thu':'Sổ Chi', ...ilAoaLedger(ledger, kind) }];
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:920px;">
        <div class="modal-head"><h3>👁️ Xem trước dạng Excel — ${escapeHtml(ledger.name)}</h3><button class="modal-close" id="ilx-close">✕</button></div>
        <div class="modal-body">
          ${sections.map(sec=>`
            <h4 style="margin:14px 0 6px;">${escapeHtml(sec.title)}</h4>
            <div class="table-wrap"><table>
              <thead><tr>${sec.headers.map(h=>`<th>${escapeHtml(String(h))}</th>`).join('')}</tr></thead>
              <tbody>${sec.rows.length? sec.rows.map(r=>`<tr>${r.map(c=>`<td>${typeof c==='number'? escapeHtml(moneySpaced(c)) : escapeHtml(String(c))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${sec.headers.length}">Không có dữ liệu</td></tr>`}</tbody>
            </table></div>`).join('')}
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="ilx-print">🖨️ In</button>
          <button class="btn btn-primary" id="ilx-export">⬇️ Tải file Excel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#ilx-close').onclick = close;
    wrap.querySelector('#ilx-print').onclick = ()=> ilPrintSections(ledger, sections);
    wrap.querySelector('#ilx-export').onclick = async ()=>{
      try{ await ilExportExcel(ledger, sections); close(); }
      catch(e){ console.error('[Thu - Chi nội bộ] Lỗi xuất Excel:', e); alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); }
    };
  }
  async function ilExportExcel(ledger, sections){
    await loadOptionalLibrary('xlsx');
    const wb = XLSX.utils.book_new();
    sections.forEach((sec,i)=>{
      const headerLines = [ ['HỘI NÔNG DÂN'], [wardTitleUpper()], [provinceTitle()], [`SỔ THU – CHI NỘI BỘ: ${ledger.name} — ${sec.title}`], [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`], [] ];
      const aoa = [...headerLines, sec.headers, ...sec.rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      applyExcelCellFormatting(ws, aoa, headerLines.length);
      boldExcelRow(ws, 3);
      const lastCol = Math.max(0, sec.headers.length-1);
      ws['!merges'] = headerLines.map((line,r)=> (line.length? {s:{r,c:0}, e:{r,c:lastCol}} : null)).filter(Boolean);
      ws['!cols'] = sec.headers.map(()=>({wch:24}));
      const sheetName = (sec.title||`Sheet${i+1}`).replace(/[\\/?*[\]:]/g,' ').slice(0,31) || `Sheet${i+1}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    XLSX.writeFile(wb, `${(ledger.name||'So-thu-chi-noi-bo').replace(/[^\p{L}\p{N} ]/gu,'')}_${todayStr()}.xlsx`, {cellStyles:true});
  }
  function ilPrintSections(ledger, sections){
    const area = document.getElementById('print-area');
    if(!area) return;
    area.innerHTML = `
      <div style="text-align:center;">
        <div style="font-weight:800; font-size:14px;">${hoiNongDanTitleHtml()}</div>
        <div style="font-size:12.5px;">${escapeHtml(provinceTitle())}</div>
      </div>
      <div class="print-title" style="margin:10px 0 4px; text-align:center;">SỔ THU – CHI NỘI BỘ: ${escapeHtml(ledger.name)}</div>
      <div style="text-align:center; font-size:12px; margin-bottom:10px;">Thời gian in: ${new Date().toLocaleString('vi-VN')}</div>
      ${sections.map(sec=>`
        <h4 style="margin:14px 0 4px;">${escapeHtml(sec.title)}</h4>
        <table class="print-table">
          <thead><tr>${sec.headers.map(h=>`<th>${escapeHtml(String(h))}</th>`).join('')}</tr></thead>
          <tbody>${sec.rows.length? sec.rows.map(r=>`<tr>${r.map(c=>`<td>${typeof c==='number'? escapeHtml(moneySpaced(c)) : escapeHtml(String(c))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${sec.headers.length}">Không có dữ liệu</td></tr>`}</tbody>
        </table>`).join('')}
      <div style="text-align:center; margin-top:18px; font-size:11px;">https://hoinongdan.sotay.org</div>`;
    area.classList.add('landscape');
    window.print();
    setTimeout(()=> area.classList.remove('landscape'), 800);
  }

  // =====================================================================
  // THÊM NHANH BẰNG AI — khung chat toàn màn hình + "📋 Hồ sơ đang soạn" dạng
  // bảng tính (cột A/B/C, dòng 1/2/3, chế độ "✏️ Sửa thủ công", zoom), đúng khung
  // sườn renderQuickAddByAiModal/renderQuickAddFilePreviewModal của Sổ vay vốn —
  // nhưng KHÔNG có bộ chọn "bộ não AI". Có thể sửa/thêm dòng thủ công ngay cả khi
  // CHƯA chat gì với AI (nút "Hồ sơ đang soạn" luôn bấm được, không bị khoá).
  // =====================================================================
  const LQAI_COLS = [['type','Loại'],['date','Ngày'],['content','Nội dung'],['amount','Số tiền'],['person','Người thu/chi'],['note','Ghi chú']];
  function ilQuickAddSystemPrompt(){
    return `Đồng chí là trợ lý giúp cán bộ Hội Nông dân xã nhập liệu Sổ Thu – Chi nội bộ từ tin nhắn/ảnh/tài liệu người dùng cung cấp (hoá đơn, sổ ghi chép tay, danh sách...).
Mỗi dòng Thu hoặc Chi gồm các trường: date (yyyy-mm-dd), content (nội dung thu/chi), amount (số tiền, chỉ số nguyên), person (người thu/chi), note (ghi chú, có thể rỗng), type ('thu' hoặc 'chi').
LUÔN duy trì và trả lại "Hồ sơ đang soạn" dưới dạng {"entries":[{...}]} — đây là NHÁP, CHƯA lưu vào hệ thống, người dùng sẽ tự duyệt và bấm lưu sau.
Khi người dùng cung cấp thêm thông tin hoặc yêu cầu sửa/xoá, hãy chỉnh sửa TRỰC TIẾP lên "Hồ sơ đang soạn" hiện tại (không tạo bản mới), rồi trả lại TOÀN BỘ hồ sơ.
Chỉ đính kèm khối kết quả khi thực sự có điều gì cần phản ánh vào hồ sơ, theo đúng khuôn:
\`\`\`quickadd-result
{"entries":[{"type":"thu","date":"2025-01-20","content":"...","amount":500000,"person":"...","note":"..."}]}
\`\`\`
Nếu thiếu trường bắt buộc (date, content, amount) hoặc có chỗ mâu thuẫn, hãy hỏi lại người dùng bằng lời thường, ĐỪNG tự bịa số liệu.`;
  }
  function renderLedgerQuickAddModal(ledger){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const closeImmediate = ()=>{ state._lqaiAddMenuOpen = false; wrap.remove(); };
    const close = ()=>{
      if(!draft.entries.length){ closeImmediate(); return; }
      if(confirm(`⚠️ "Hồ sơ đang soạn" hiện có ${draft.entries.length} dòng CHƯA được lưu vào Sổ Thu - Chi nội bộ.\n\nĐóng bảng bây giờ sẽ MẤT VĨNH VIỄN dữ liệu này.\n\nBấm "Có" để đóng, hoặc "Huỷ" để quay lại.`)) closeImmediate();
    };
    const messages = [];
    let pendingAttachments = [];
    let hasDigestedOnce = false;
    const draft = { entries: [] };
    let busy = false;

    function fmtAttachChip(a){ return `<span class="ai-attach-chip">📎 ${escapeHtml(a.name)}</span>`; }
    function bubbleHtml(m, idx){
      const isUser = m.role==='user';
      if(m.streaming){
        return `<div style="display:flex; justify-content:flex-start; margin-bottom:10px;">
          <div id="lqai-streaming-bubble" style="max-width:75%; background:#e3f2fd; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${m.text? renderMarkdownLite(m.text) : waveTextHtml('Chàng đang suy nghĩ…')}</div>
        </div>`;
      }
      let inner = isUser? escapeHtml(m.text||'') : renderMarkdownLite(m.text||'');
      if(m.attachments && m.attachments.length) inner += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${m.attachments.map(fmtAttachChip).join('')}</div>`;
      return `<div style="display:flex; flex-direction:column; align-items:${isUser?'flex-end':'flex-start'}; margin-bottom:10px;">
        <div style="max-width:75%; background:${isUser?'#dcedc8':'#e3f2fd'}; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${inner}</div>
        <div style="display:flex; gap:4px; margin-top:3px;"><button class="btn-plain-icon preview-allow" data-bubble-delete="${idx}" title="Xoá tin nhắn này" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">🗑️</button></div>
      </div>`;
    }
    function render(){
      const hasAnyUserContent = messages.some(m=>m.role==='user') || pendingAttachments.length>0;
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
          <div class="modal-head"><h3>✨ Thêm nhanh dòng Thu/Chi bằng chat với AI</h3><button class="modal-close preview-allow" id="lqai-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column;" id="lqai-thread">
            ${messages.length? messages.map(bubbleHtml).join('') : `<p class="sub" style="text-align:center; margin:auto;">Hãy nhắn tin hoặc đính kèm tài liệu (ảnh hoá đơn, sổ ghi chép tay...) — AI sẽ đợi đến khi đồng chí bấm "🧠 Tiêu hoá tài liệu bằng AI" mới bắt đầu đọc. Hoặc bấm thẳng "📋 Hồ sơ đang soạn" bên dưới để tự thêm dòng bằng tay, không cần chat.</p>`}
          </div>
          <div style="padding:8px 16px 0; background:var(--paper-2);">
            <div style="text-align:center; margin-bottom:8px;">
              <button type="button" class="btn btn-sm preview-allow" id="lqai-view-file" style="background:#fff9c4; border:1px solid #fbc02d; color:#5a4300; font-weight:700;">📋 Hồ sơ đang soạn — ${draft.entries.length} dòng (bấm để xem/sửa)</button>
            </div>
            <p class="sub" style="margin:0 0 8px;">${hasDigestedOnce? 'Hệ thống đã đọc được nội dung bên trên. Nhắn tiếp nếu muốn bổ sung/sửa.' : 'Chưa tiêu hoá tài liệu nào — nhắn/đính kèm xong thì bấm nút bên dưới.'}</p>
            ${pendingAttachments.length? `<div class="ai-attach-row" style="padding:0 0 8px;">${pendingAttachments.map((a,i)=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)} <button type="button" class="preview-allow" data-remove-att="${i}">✕</button></span>`).join('')}</div>` : ''}
            <input type="file" id="lqai-file-input" multiple accept="*/*" style="display:none;">
            <div class="ai-inputbar">
              <div class="ai-add-btn" id="lqai-add-btn" role="button" tabindex="0">➕<span class="ai-add-label"> THÊM THÀNH PHẦN</span>
                ${state._lqaiAddMenuOpen? `<div class="ai-add-menu">
                  <div class="ai-add-opt" data-lqai-add="image">🖼️ Tải ảnh lên</div>
                  <div class="ai-add-opt" data-lqai-add="doc">📄 Tải tài liệu lên</div>
                  <div class="ai-add-opt${state._lqaiMicListening?' ai-add-opt-disabled':''}" data-lqai-add="mic">🎤 ${state._lqaiMicListening? '✅ Đang nghe — bấm để dừng' : 'Vừa nói vừa ra chữ'}</div>
                  <div class="ai-add-opt${state._lqaiMicListening?' ai-add-opt-disabled':''}" data-lqai-add="mic2">🎙️ ${state._lqaiMic2Listening? '✅ Đang nghe — bấm để dừng' : 'Nói xong mới ra chữ'}</div>
                </div>` : ''}
              </div>
              <textarea id="lqai-input" rows="1" placeholder="Nhắn tin cho AI... (Enter để xuống dòng, Ctrl+Enter để gửi)"></textarea>
              <div class="ai-send-wrap">
                <button type="button" class="btn btn-sm preview-allow" id="lqai-digest" ${(busy || !hasAnyUserContent)?'disabled':''} style="background:linear-gradient(180deg, #ffffff 0%, #7c4dff 45%, #4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700; ${(busy||!hasAnyUserContent)?'opacity:.5;':''}">${busy?'⏳ AI đang xử lý...':'🧠 Tiêu hoá tài liệu bằng AI'}</button>
                <button type="button" class="btn btn-ghost btn-sm preview-allow" id="lqai-send-btn">Gửi</button>
              </div>
            </div>
          </div>
        </div>`;
      wrap.querySelector('#lqai-close').onclick = close;
      wrap.querySelectorAll('[data-bubble-delete]').forEach(btn=> btn.onclick = ()=>{ messages.splice(+btn.dataset.bubbleDelete,1); render(); });
      wrap.querySelector('#lqai-view-file').onclick = ()=> renderLqaiDraftModal(draft, ()=> render(), ledger);
      const addMenuBtn = wrap.querySelector('#lqai-add-btn');
      if(addMenuBtn) addMenuBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        state._lqaiAddMenuOpen = !state._lqaiAddMenuOpen;
        const inputEl = wrap.querySelector('#lqai-input');
        const savedValue = inputEl? inputEl.value : '';
        render();
        const inputElAfter = wrap.querySelector('#lqai-input');
        if(inputElAfter && savedValue) inputElAfter.value = savedValue;
        if(inputElAfter) autoResizeTextarea(inputElAfter);
      });
      wrap.querySelectorAll('[data-lqai-add]').forEach(elx=> elx.addEventListener('click', (e)=>{
        e.stopPropagation();
        state._lqaiAddMenuOpen = false;
        if(elx.dataset.lqaiAdd==='mic'){ wrap.querySelector('#lqai-add-btn .ai-add-menu')?.remove(); toggleMicGeneric('lqai', render); return; }
        if(elx.dataset.lqaiAdd==='mic2'){ wrap.querySelector('#lqai-add-btn .ai-add-menu')?.remove(); toggleMic2Generic('lqai', render); return; }
        wrap.querySelector('#lqai-file-input').click();
      }));
      wrap.querySelector('#lqai-file-input').onchange = async (e)=>{
        const files = Array.from(e.target.files||[]);
        for(const f of files){
          const base64 = await fileToBase64(f);
          pendingAttachments.push({ name:f.name, mimeType:f.type||'application/octet-stream', base64 });
        }
        render();
      };
      wrap.querySelectorAll('[data-remove-att]').forEach(btn=> btn.onclick = ()=>{ pendingAttachments.splice(+btn.dataset.removeAtt,1); render(); });
      wrap.querySelector('#lqai-send-btn').onclick = ()=>{ doSend(); scrollNearestModalToBottom(wrap); };
      wireAutoResizeTextarea('lqai-input');
      wrap.querySelector('#lqai-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter' && e.ctrlKey){ e.preventDefault(); doSend(); } });
      wrap.querySelector('#lqai-input').addEventListener('focus', ()=> scrollNearestModalToBottom(wrap));
      wrap.querySelector('#lqai-digest').onclick = ()=> runAiTurn();
    }
    function doSend(){
      const inputEl = wrap.querySelector('#lqai-input');
      const text = (inputEl.value||'').trim();
      if(!text && !pendingAttachments.length) return;
      messages.push({ role:'user', text, attachments: pendingAttachments });
      pendingAttachments = [];
      inputEl.value = '';
      if(hasDigestedOnce){ render(); runAiTurn(); } else render();
    }
    async function runAiTurn(){
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
      if(busy) return;
      busy = true;
      const streamMsg = { role:'ai', text:'', streaming:true };
      messages.push(streamMsg);
      render();
      try{
        const aiMessages = [{ role:'user', text: ilQuickAddSystemPrompt() }, { role:'assistant', text:'Đã hiểu, tôi sẽ tuân thủ đúng định dạng trả lời yêu cầu.' }];
        messages.forEach(m=>{
          if(m===streamMsg) return;
          let t = m.text||'';
          if(m.attachments && m.attachments.length) t += ` (kèm ${m.attachments.length} tài liệu đính kèm)`;
          aiMessages.push({ role: m.role==='user'?'user':'assistant', text: t || '(tệp đính kèm)' });
        });
        aiMessages.push({ role:'user', text: `[Đây là "Hồ sơ đang soạn" ĐANG CÓ hiện tại (${draft.entries.length? 'do đồng chí trích xuất ở lượt trước, hoặc người dùng tự sửa' : 'hiện đang RỖNG, chưa có thông tin gì cả'}), hãy đọc kỹ rồi chỉnh sửa TRỰC TIẾP lên đúng hồ sơ này]:\n${JSON.stringify(draft)}` });
        aiMessages.push({ role:'assistant', text:'Đã ghi nhận Hồ sơ đang soạn hiện tại.' });
        const allAttachments = messages.filter(m=>m.role==='user').flatMap(m=>m.attachments||[]);
        const opts = allAttachments.length? { attachments: allAttachments } : {};
        const result = await callAIWithFallback(aiMessages, opts, (partial)=>{
          streamMsg.text = partial;
          const bubbleEl = document.getElementById('lqai-streaming-bubble');
          if(bubbleEl){
            bubbleEl.innerHTML = partial? renderMarkdownLite(partial) : waveTextHtml('Chàng đang suy nghĩ…');
            const threadEl = wrap.querySelector('#lqai-thread');
            if(threadEl) threadEl.scrollTop = threadEl.scrollHeight;
          }
        });
        const fullText = result.text || '';
        const m = fullText.match(/```quickadd-result\s*([\s\S]*?)```/);
        let replyText = fullText, resObj = null;
        if(m){
          replyText = (fullText.slice(0,m.index) + fullText.slice(m.index+m[0].length)).trim();
          try{ resObj = JSON.parse(m[1].trim()); }catch(e){ resObj = null; }
        }
        messages.pop();
        if(replyText) messages.push({ role:'ai', text: replyText });
        if(resObj && Array.isArray(resObj.entries)) draft.entries = resObj.entries;
        hasDigestedOnce = true;
      }catch(err){
        messages.pop();
        console.error('Lỗi khi tiêu hoá tài liệu bằng AI:', err);
        messages.push({ role:'ai', text:`Xin lỗi, có lỗi xảy ra khi xử lý: ${err && err.message ? err.message : err}. Đồng chí thử lại nhé.` });
      }
      busy = false; render();
    }
    render();
  }

  // "📋 Hồ sơ đang soạn" — bảng tính nháp (A/B/C.../1/2/3, "✏️ Sửa thủ công", zoom),
  // y hệt khung sườn renderQuickAddFilePreviewModal của Sổ vay vốn. Sửa/thêm dòng
  // được NGAY LẬP TỨC, không cần đã tiêu hoá tài liệu bằng AI trước.
  function renderLqaiDraftModal(draft, onClose, ledger){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    let editMode = false;
    let zoomPct = 100;
    const close = ()=>{ wrap.remove(); if(onClose) onClose(); };
    function readFormIntoDraft(){
      wrap.querySelectorAll('[data-lqd-k]').forEach(elx=>{
        const ri = +elx.dataset.lqdRi, k = elx.dataset.lqdK;
        draft.entries[ri][k] = k==='amount' ? parseVNMoney(elx.value) : elx.value;
      });
    }
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column; border:6px solid ${editMode?'#c62828':'#fbc02d'};">
          <div class="modal-head" style="${editMode? 'background:linear-gradient(180deg, #ef5350 0%, #c62828 50%, #7f0000 100%);' : ''}"><h3 style="${editMode?'color:#fff;':''}">${editMode? '📋 Hồ sơ đang soạn — Đang sửa thủ công' : '📋 Hồ sơ đang soạn'}</h3><button class="modal-close preview-allow" id="lqd-close">✕</button></div>
          ${editMode? `<p class="sub" style="margin:8px 14px 0; color:#5a4300;">💡 Bấm vào từng ô để sửa trực tiếp, xong thì bấm "💾 Lưu thay đổi".</p>` : ''}
          <div class="modal-body" style="flex:1; overflow:auto; padding:14px; ${editMode?'background:#fff0f0;':''}">
            <div style="transform:scale(${zoomPct/100}); transform-origin:top left; width:${zoomPct}%;">
            ${draft.entries.length || editMode ? `<table style="border-collapse:collapse; width:max-content;">
              <thead>
                <tr>${editMode? `<th style="background:#c8e6c9; border:1px solid var(--line); padding:6px 10px;"></th>` : ''}<th style="background:#c8e6c9; border:1px solid var(--line); padding:6px 10px;"></th>
                  ${LQAI_COLS.map((_,i)=>`<th style="background:#c8e6c9; border:1px solid var(--line); padding:6px 10px; text-align:center;">${ilColLetter(i)}</th>`).join('')}</tr>
                <tr>${editMode? `<th style="background:#e8f5e9; border:1px solid var(--line); padding:6px 10px;"></th>` : ''}<th style="background:#e8f5e9; border:1px solid var(--line); padding:6px 10px;"></th>
                  ${LQAI_COLS.map(([k,label])=>`<th style="background:#e8f5e9; border:1px solid var(--line); padding:6px 10px; white-space:nowrap;">${escapeHtml(label)}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${draft.entries.map((e,ri)=>`<tr>
                  ${editMode? `<td style="border:1px solid var(--line); padding:2px; text-align:center;"><button type="button" class="btn-plain-icon preview-allow lqd-row-del" data-ri="${ri}" style="background:none; border:none; cursor:pointer;">🗑️</button></td>` : ''}
                  <td style="border:1px solid var(--line); padding:6px 10px; text-align:center; font-weight:700; background:#e8f5e9;">${ri+1}</td>
                  ${LQAI_COLS.map(([k])=>{
                    const rawVal = e[k]!=null? String(e[k]) : '';
                    if(!editMode){
                      const displayVal = k==='type'? (rawVal==='thu'?'📥 Thu':'📤 Chi') : (k==='amount'? moneySpaced(rawVal) : rawVal);
                      return `<td style="border:1px solid var(--line); padding:6px 10px; white-space:nowrap; ${k==='amount'?'text-align:right;':''}">${k==='type'||k==='amount'? displayVal : escapeHtml(displayVal)}</td>`;
                    }
                    const cellStyle = 'border:1px solid var(--line); padding:2px; background:#fff9c4;';
                    const inputBaseStyle = 'width:100%; min-width:90px; border:1px solid #fbc02d; border-radius:4px; padding:4px 6px; font-size:12.5px;';
                    if(k==='type') return `<td style="${cellStyle}"><select data-lqd-ri="${ri}" data-lqd-k="${k}" style="${inputBaseStyle}"><option value="thu" ${rawVal==='thu'?'selected':''}>Thu</option><option value="chi" ${rawVal==='chi'?'selected':''}>Chi</option></select></td>`;
                    if(k==='date') return `<td style="${cellStyle}"><input type="date" data-lqd-ri="${ri}" data-lqd-k="${k}" value="${escapeHtml(rawVal)}" style="${inputBaseStyle}"></td>`;
                    if(k==='amount') return `<td style="${cellStyle}"><input type="text" inputmode="numeric" data-lqd-ri="${ri}" data-lqd-k="${k}" value="${escapeHtml(rawVal)}" placeholder="Chỉ nhập số" style="${inputBaseStyle} text-align:right;"></td>`;
                    const maxlen = k==='content'?IL_MAX.content:(k==='person'?IL_MAX.person:IL_MAX.note);
                    return `<td style="${cellStyle}"><input type="text" maxlength="${maxlen}" data-lqd-ri="${ri}" data-lqd-k="${k}" value="${escapeHtml(rawVal)}" style="${inputBaseStyle}"></td>`;
                  }).join('')}
                </tr>`).join('')}
              </tbody>
            </table>` : `<div style="text-align:center; padding:30px 16px;">
              <p style="font-size:15px; font-weight:700; margin-bottom:8px;">📋 Hồ sơ này hiện đang RỖNG</p>
              <p class="sub" style="max-width:420px; margin:0 auto;">Hãy tiếp tục trò chuyện với AI, hoặc bấm "✏️ Sửa thủ công" bên dưới để tự thêm dòng theo ý đồng chí.</p>
            </div>`}
            ${editMode? `<div style="text-align:center; margin-top:10px;"><button type="button" class="btn btn-primary preview-allow" id="lqd-add-row">➕ Thêm dòng</button></div>` : ''}
            </div>
          </div>
          <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
            ${editMode? `
              <button class="btn btn-ghost preview-allow" id="lqd-edit-cancel">↩️ Huỷ sửa</button>
              <button class="btn btn-primary preview-allow" id="lqd-edit-save">💾 Lưu thay đổi</button>
            ` : `
              <button class="btn btn-ghost preview-allow" id="lqd-close2">Đóng bảng</button>
              <button class="btn btn-sm preview-allow" id="lqd-edit-start" style="background:linear-gradient(180deg, #ffffff 0%, #ffca28 45%, #ff8f00 100%); color:#5a3d00; border-color:#ff8f00; font-weight:700;">✏️ Sửa thủ công</button>
              <button class="btn btn-primary btn-sm preview-allow" id="lqd-save-all" ${!draft.entries.length?'disabled':''}>💾 Lưu tất cả vào Sổ</button>
            `}
            <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="lqd-zoom-out" ${zoomPct<=50?'disabled':''} title="Thu nhỏ">➖</button>
              <span style="font-weight:700; min-width:42px; text-align:center;">${zoomPct}%</span>
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="lqd-zoom-in" ${zoomPct>=200?'disabled':''} title="Phóng to">➕</button>
            </div>
          </div>
        </div>`;
      wrap.querySelector('#lqd-close').onclick = close;
      const close2 = wrap.querySelector('#lqd-close2'); if(close2) close2.onclick = close;
      const zIn = wrap.querySelector('#lqd-zoom-in'); if(zIn) zIn.onclick = ()=>{ zoomPct = Math.min(200, zoomPct+10); render(); };
      const zOut = wrap.querySelector('#lqd-zoom-out'); if(zOut) zOut.onclick = ()=>{ zoomPct = Math.max(50, zoomPct-10); render(); };
      wrap.querySelectorAll('[data-lqd-k="amount"]').forEach(inp=>{ attachMoneyInputMask(inp, IL_MAX.moneyDigits); ilAttachFloatingMoneyPreview(inp); });
      const editStartBtn = wrap.querySelector('#lqd-edit-start'); if(editStartBtn) editStartBtn.onclick = ()=>{ editMode = true; render(); };
      const editCancelBtn = wrap.querySelector('#lqd-edit-cancel'); if(editCancelBtn) editCancelBtn.onclick = ()=>{ editMode = false; render(); };
      const editSaveBtn = wrap.querySelector('#lqd-edit-save'); if(editSaveBtn) editSaveBtn.onclick = ()=>{ readFormIntoDraft(); editMode = false; render(); };
      const addRowBtn = wrap.querySelector('#lqd-add-row'); if(addRowBtn) addRowBtn.onclick = ()=>{ readFormIntoDraft(); draft.entries.push({ type:'thu', date: todayStr(), content:'', amount:0, person:'', note:'' }); render(); };
      wrap.querySelectorAll('.lqd-row-del').forEach(btn=> btn.onclick = ()=>{ readFormIntoDraft(); draft.entries.splice(+btn.dataset.ri,1); render(); });
      const saveAllBtn = wrap.querySelector('#lqd-save-all');
      if(saveAllBtn) saveAllBtn.onclick = ()=>{
        readFormIntoDraft();
        let savedCount = 0;
        draft.entries.forEach(e=>{
          if(!e.date || !e.content || !e.amount) return;
          ledger.entries.push({ id: ilNewId('il'), type: e.type==='thu'?'thu':'chi', date:e.date, content:e.content, amountMode:'manual', amount: parseInt(e.amount,10)||0, person: e.person||'', note: e.note||'', appendix:null });
          savedCount++;
        });
        ilPersist();
        draft.entries = [];
        close();
        const content2 = document.getElementById('content');
        if(content2) renderInternalLedgerMain(content2);
        showBigToast(`Đã lưu ${savedCount} dòng vào Sổ Thu - Chi nội bộ!`);
      };
    }
    render();
  }
