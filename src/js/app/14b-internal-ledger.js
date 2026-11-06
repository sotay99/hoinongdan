  // =====================================================================
  // SỔ THU – CHI NỘI BỘ (module "internal") — bản đầu tiên.
  // Lưu CỤC BỘ trên thiết bị (localStorage), KHÔNG lên Firebase — xem lớp lưu trữ
  // internalLedgerLoadRaw()/internalLedgerSaveRaw() ngay dưới đây. Sau này muốn
  // chuyển sang lưu Firebase (cá nhân hoặc theo mã xã, nhiều người cùng sửa) thì
  // chỉ cần đổi bên trong lớp này — KHÔNG phải sửa lại UI/modal đã viết.
  // =====================================================================
  const INTERNAL_LEDGER_LOCAL_KEY = 'hnd_internal_ledger_v1';
  const INTERNAL_LEDGER_ACCEPT_KEY = 'hnd_internal_ledger_accepted_v1';
  const IL_MAX = { content:200, person:80, note:500, title:80, colLabel:40, cellText:200, moneyDigits:12 };

  function internalLedgerAccepted(){
    try{ return localStorage.getItem(INTERNAL_LEDGER_ACCEPT_KEY)==='1'; }catch(e){ return false; }
  }
  function internalLedgerAccept(){
    try{ localStorage.setItem(INTERNAL_LEDGER_ACCEPT_KEY, '1'); }catch(e){ console.warn('Không thể ghi cờ chấp nhận Sổ Thu - Chi nội bộ:', e); }
  }
  function internalLedgerLoadRaw(){
    try{
      const raw = JSON.parse(localStorage.getItem(INTERNAL_LEDGER_LOCAL_KEY)||'{}');
      return { entries: Array.isArray(raw.entries) ? raw.entries : [] };
    }catch(e){ return { entries: [] }; }
  }
  function internalLedgerSaveRaw(data){
    try{ localStorage.setItem(INTERNAL_LEDGER_LOCAL_KEY, JSON.stringify(data||{entries:[]})); }
    catch(e){ console.warn('Không thể lưu Sổ Thu - Chi nội bộ:', e); }
  }
  function ilData(){
    if(!state._ilData) state._ilData = internalLedgerLoadRaw();
    return state._ilData;
  }
  function ilPersist(){ internalLedgerSaveRaw(ilData()); }
  function ilNewId(prefix){ return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }

  function ilEntriesOfType(type){
    return ilData().entries.filter(e=>e.type===type).sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  }
  function ilFilteredEntriesOfType(type){
    let list = ilEntriesOfType(type);
    const q = (state._ilSearch||'').trim().toLowerCase();
    if(q) list = list.filter(e=> ((e.content||'')+' '+(e.person||'')+' '+(e.note||'')).toLowerCase().includes(q));
    if(state._ilDateFrom) list = list.filter(e=> !e.date || e.date >= state._ilDateFrom);
    if(state._ilDateTo) list = list.filter(e=> !e.date || e.date <= state._ilDateTo);
    return list;
  }
  function ilTotalOfType(type){ return ilEntriesOfType(type).reduce((s,e)=> s+(parseInt(e.amount,10)||0), 0); }
  function ilFindEntry(id){ return ilData().entries.find(e=>e.id===id); }

  function ilAppendixMoneyTotal(ap){
    const moneyKeys = (ap.columns||[]).filter(c=>c.type==='money').map(c=>c.key);
    return (ap.rows||[]).reduce((s,r)=> s + moneyKeys.reduce((s2,k)=> s2 + (parseInt(r[k],10)||0), 0), 0);
  }

  // =====================================================================
  // CỔNG "CHẤP NHẬN VÀ BẮT ĐẦU MỞ SỔ" — màn giới thiệu giữ nguyên như cũ, chỉ thêm
  // 1 nút ở dưới cùng. Thiết bị nào đã bấm nút này thì internalLedgerAccepted() sẽ
  // trả về true ngay từ lần vào sau, bỏ qua màn này.
  // =====================================================================
  function renderInternalTab(el){
    if(!internalLedgerAccepted()){ renderInternalLedgerGate(el); return; }
    renderInternalLedgerMain(el);
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
  // MÀN HÌNH CHÍNH — Sổ Thu + Sổ Chi, mỗi sổ 1 panel thu gọn/mở được.
  // =====================================================================
  function ilSummaryBarHtml(){
    const totalThu = ilTotalOfType('thu');
    const totalChi = ilTotalOfType('chi');
    return `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-body" style="display:flex; flex-wrap:wrap; gap:18px; align-items:center;">
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
    return `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-body" style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
          <div class="field" style="flex:1; min-width:180px; margin:0;"><label>Tìm nội dung/người</label><input type="text" id="il-search" maxlength="${IL_MAX.content}" value="${escapeHtml(state._ilSearch||'')}" placeholder="Gõ để tìm..."></div>
          <div class="field" style="margin:0;"><label>Từ ngày</label><input type="date" id="il-date-from" value="${state._ilDateFrom||''}"></div>
          <div class="field" style="margin:0;"><label>Đến ngày</label><input type="date" id="il-date-to" value="${state._ilDateTo||''}"></div>
          <button type="button" class="btn btn-ghost btn-sm" id="il-filter-clear">Xoá lọc</button>
        </div>
      </div>`;
  }
  function ilEntryRowHtml(e, canEdit){
    const apCount = (e.appendices||[]).length;
    return `<tr>
      <td>${fmtDate(e.date)}</td>
      <td>${escapeHtml(e.content||'')}</td>
      <td class="money" style="text-align:right;">${moneySpaced(e.amount)}</td>
      <td>${escapeHtml(e.person||'')}</td>
      <td>${escapeHtml(e.note||'')}</td>
      <td style="white-space:nowrap;"><button type="button" class="btn btn-ghost btn-sm preview-allow" data-il-appendix="${e.id}">📎 Phụ lục${apCount? ` (${apCount})` : ''}</button></td>
      ${canEdit? `<td style="white-space:nowrap;"><button type="button" class="btn-plain-icon preview-allow" data-il-edit="${e.id}" title="Sửa" style="background:none; border:none; cursor:pointer;">✏️</button><button type="button" class="btn-plain-icon preview-allow" data-il-del="${e.id}" title="Xoá" style="background:none; border:none; cursor:pointer;">🗑️</button></td>` : ''}
    </tr>`;
  }
  function ilPanelHtml(type, canEdit){
    const isThu = type==='thu';
    const showKey = isThu ? '_ilShowThu' : '_ilShowChi';
    const open = state[showKey]!==false;
    const list = ilFilteredEntriesOfType(type);
    const label = isThu? 'Sổ Thu' : 'Sổ Chi';
    const personLabel = isThu? 'Người thu' : 'Người chi';
    return `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-head" style="cursor:pointer;" id="il-toggle-${type}"><h3>${isThu?'📥':'📤'} ${label} (${list.length}) ${open?'▴':'▾'}</h3>
          <div style="display:flex; gap:8px;">
            ${canEdit? `<button type="button" class="btn btn-primary btn-sm preview-allow" id="il-add-${type}">➕ Thêm dòng ${isThu?'thu':'chi'}</button>` : ''}
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="il-excel-${type}">📊 Xem bảng Excel</button>
          </div>
        </div>
        ${open? `<div class="panel-body">
          ${list.length? `<div class="table-wrap"><table>
            <thead><tr><th>Ngày</th><th>Nội dung ${isThu?'thu':'chi'}</th><th style="text-align:right;">Số tiền</th><th>${personLabel}</th><th>Ghi chú</th><th>Phụ lục</th>${canEdit? '<th></th>' : ''}</tr></thead>
            <tbody>${list.map(e=>ilEntryRowHtml(e,canEdit)).join('')}</tbody>
          </table></div>` : `<div class="empty-state"><div class="e-ico">${isThu?'📥':'📤'}</div>Chưa có dòng ${isThu?'thu':'chi'} nào${canEdit? ` — bấm "➕ Thêm dòng ${isThu?'thu':'chi'}" để bắt đầu` : ''}</div>`}
        </div>` : ''}
      </div>`;
  }
  function renderInternalLedgerMain(el){
    const canEdit = canEditModule('internal');
    el.innerHTML = `
      ${ilSummaryBarHtml()}
      ${ilFilterBarHtml()}
      ${ilPanelHtml('thu', canEdit)}
      ${ilPanelHtml('chi', canEdit)}
    `;
    wireInternalLedgerMain(el);
  }
  function wireInternalLedgerMain(el){
    const canEdit = canEditModule('internal');
    document.getElementById('il-ai-btn') && (document.getElementById('il-ai-btn').onclick = ()=> renderLedgerQuickAddModal());
    document.getElementById('il-overview-excel-btn') && (document.getElementById('il-overview-excel-btn').onclick = ()=> renderInternalExcelModal('all'));
    const searchInput = document.getElementById('il-search');
    if(searchInput) searchInput.oninput = ()=>{ state._ilSearch = searchInput.value; renderInternalLedgerMain(el); };
    const fromInput = document.getElementById('il-date-from');
    if(fromInput) fromInput.onchange = ()=>{ state._ilDateFrom = fromInput.value; renderInternalLedgerMain(el); };
    const toInput = document.getElementById('il-date-to');
    if(toInput) toInput.onchange = ()=>{ state._ilDateTo = toInput.value; renderInternalLedgerMain(el); };
    const clearBtn = document.getElementById('il-filter-clear');
    if(clearBtn) clearBtn.onclick = ()=>{ state._ilSearch=''; state._ilDateFrom=''; state._ilDateTo=''; renderInternalLedgerMain(el); };
    ['thu','chi'].forEach(type=>{
      const toggle = document.getElementById('il-toggle-'+type);
      if(toggle) toggle.onclick = ()=>{ const k = type==='thu'?'_ilShowThu':'_ilShowChi'; state[k] = !(state[k]!==false); renderInternalLedgerMain(el); };
      const addBtn = document.getElementById('il-add-'+type);
      if(addBtn) addBtn.onclick = (e)=>{ e.stopPropagation(); renderInternalEntryModal(type, null); };
      const excelBtn = document.getElementById('il-excel-'+type);
      if(excelBtn) excelBtn.onclick = (e)=>{ e.stopPropagation(); renderInternalExcelModal(type); };
    });
    el.querySelectorAll('[data-il-edit]').forEach(btn=> btn.onclick = ()=>{
      const entry = ilFindEntry(btn.dataset.ilEdit);
      if(entry) renderInternalEntryModal(entry.type, entry);
    });
    el.querySelectorAll('[data-il-del]').forEach(btn=> btn.onclick = ()=>{
      if(!confirm('Xoá dòng này? Mọi phụ lục đi kèm cũng sẽ bị xoá.')) return;
      const d = ilData(); d.entries = d.entries.filter(e=>e.id!==btn.dataset.ilDel); ilPersist(); renderInternalLedgerMain(el);
    });
    el.querySelectorAll('[data-il-appendix]').forEach(btn=> btn.onclick = ()=> renderInternalAppendixListModal(btn.dataset.ilAppendix));
  }

  // =====================================================================
  // MODAL THÊM/SỬA 1 DÒNG THU HOẶC CHI.
  // =====================================================================
  function renderInternalEntryModal(type, entry){
    const isNew = !entry;
    const e0 = entry || { id: ilNewId('il'), type, date: todayStr(), content:'', amount:0, person:'', note:'', appendices:[] };
    const isThu = type==='thu';
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>${isNew? `Thêm dòng ${isThu?'thu':'chi'} mới` : `Sửa dòng ${isThu?'thu':'chi'}`}</h3><button class="modal-close" id="ilm-close">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Ngày *</label><input type="date" id="ilm-date" value="${e0.date||''}"></div>
          <div class="field"><label>Nội dung ${isThu?'thu':'chi'} * <span class="sub">(tối đa ${IL_MAX.content} ký tự)</span></label><input type="text" id="ilm-content" maxlength="${IL_MAX.content}" value="${escapeHtml(e0.content||'')}"></div>
          <div class="field"><label>Số tiền (đ) * <span class="sub">(tối đa ${IL_MAX.moneyDigits} số)</span> <span class="sub" id="ilm-amount-disp" style="font-weight:700; color:#b71c1c;"></span></label><input type="text" inputmode="numeric" id="ilm-amount" value="${e0.amount||''}" placeholder="Chỉ nhập số"></div>
          <div class="field"><label>Người ${isThu?'thu':'chi'} <span class="sub">(tối đa ${IL_MAX.person} ký tự)</span></label><input type="text" id="ilm-person" maxlength="${IL_MAX.person}" value="${escapeHtml(e0.person||'')}"></div>
          <div class="field"><label>Ghi chú <span class="sub">(tối đa ${IL_MAX.note} ký tự)</span></label><textarea id="ilm-note" rows="3" maxlength="${IL_MAX.note}">${escapeHtml(e0.note||'')}</textarea></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="ilm-cancel">Huỷ</button>
          <button class="btn btn-primary" id="ilm-save">💾 Lưu</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#ilm-close').onclick = close;
    wrap.querySelector('#ilm-cancel').onclick = close;
    const amountInput = wrap.querySelector('#ilm-amount');
    const amountDisp = wrap.querySelector('#ilm-amount-disp');
    attachMoneyInputMask(amountInput, IL_MAX.moneyDigits);
    const updateAmountDisp = ()=>{ const digits = amountInput.value.replace(/[^\d]/g,''); amountDisp.textContent = digits? `= ${groupDigitsRight(digits,3)} đ` : ''; };
    amountInput.addEventListener('input', updateAmountDisp);
    updateAmountDisp();
    wrap.querySelector('#ilm-save').onclick = ()=>{
      const date = wrap.querySelector('#ilm-date').value;
      const content = wrap.querySelector('#ilm-content').value.trim();
      const amount = parseVNMoney(amountInput.value);
      if(!date || !content || !amount){ alert('Vui lòng điền đủ Ngày, Nội dung và Số tiền.'); return; }
      const d = ilData();
      const updated = { ...e0, date, content, amount, person: wrap.querySelector('#ilm-person').value.trim(), note: wrap.querySelector('#ilm-note').value.trim() };
      const idx = d.entries.findIndex(x=>x.id===e0.id);
      if(idx>=0) d.entries[idx] = updated; else d.entries.push(updated);
      ilPersist(); close();
      const content2 = document.getElementById('content');
      if(content2) renderInternalLedgerMain(content2);
    };
  }

  // =====================================================================
  // PHỤ LỤC — bảng con tự do cột, gắn với 1 dòng Thu hoặc Chi.
  // =====================================================================
  function renderInternalAppendixListModal(entryId){
    const entry = ilFindEntry(entryId);
    if(!entry) return;
    const canEdit = canEditModule('internal');
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    function render(){
      const list = entry.appendices||[];
      wrap.innerHTML = `
        <div class="modal" style="max-width:640px;">
          <div class="modal-head"><h3>📎 Phụ lục — ${escapeHtml(entry.content||'')}</h3><button class="modal-close" id="ilap-close">✕</button></div>
          <div class="modal-body">
            ${list.length? `<div class="table-wrap"><table>
              <thead><tr><th>Tên phụ lục</th><th style="text-align:right;">Tổng tiền</th><th></th></tr></thead>
              <tbody>${list.map(ap=>`<tr>
                <td>${escapeHtml(ap.title||'(chưa đặt tên)')}</td>
                <td class="money" style="text-align:right;">${moneySpaced(ilAppendixMoneyTotal(ap))}</td>
                <td style="white-space:nowrap;">
                  <button type="button" class="btn btn-ghost btn-sm preview-allow" data-ilap-excel="${ap.id}">📊</button>
                  ${canEdit? `<button type="button" class="btn-plain-icon preview-allow" data-ilap-edit="${ap.id}" title="Sửa" style="background:none; border:none; cursor:pointer;">✏️</button><button type="button" class="btn-plain-icon preview-allow" data-ilap-del="${ap.id}" title="Xoá" style="background:none; border:none; cursor:pointer;">🗑️</button>` : ''}
                </td>
              </tr>`).join('')}</tbody>
            </table></div>` : `<div class="empty-state"><div class="e-ico">📎</div>Chưa có phụ lục nào.</div>`}
            ${canEdit? `<button type="button" class="btn btn-primary btn-sm preview-allow" id="ilap-new" style="margin-top:12px;">➕ Thêm phụ lục mới</button>` : ''}
          </div>
          <div class="modal-foot"><button class="btn btn-ghost" id="ilap-close2">Đóng</button></div>
        </div>`;
      const close = ()=> wrap.remove();
      wrap.querySelector('#ilap-close').onclick = close;
      wrap.querySelector('#ilap-close2').onclick = close;
      const newBtn = wrap.querySelector('#ilap-new');
      if(newBtn) newBtn.onclick = ()=> renderInternalAppendixEditorModal(entry.id, null, render);
      wrap.querySelectorAll('[data-ilap-edit]').forEach(btn=> btn.onclick = ()=> renderInternalAppendixEditorModal(entry.id, btn.dataset.ilapEdit, render));
      wrap.querySelectorAll('[data-ilap-excel]').forEach(btn=> btn.onclick = ()=>{
        const ap = (entry.appendices||[]).find(a=>a.id===btn.dataset.ilapExcel);
        if(ap) renderInternalExcelModal('appendix', ap);
      });
      wrap.querySelectorAll('[data-ilap-del]').forEach(btn=> btn.onclick = ()=>{
        if(!confirm('Xoá phụ lục này?')) return;
        entry.appendices = (entry.appendices||[]).filter(a=>a.id!==btn.dataset.ilapDel);
        ilPersist(); render();
        const content2 = document.getElementById('content');
        if(content2) renderInternalLedgerMain(content2);
      });
    }
    document.body.appendChild(wrap);
    render();
  }
  function ilDefaultAppendixColumns(){
    return [ { key: ilNewId('c'), label:'Nội dung', type:'text' }, { key: ilNewId('c'), label:'Số tiền', type:'money' } ];
  }
  function renderInternalAppendixEditorModal(entryId, appendixId, onDone){
    const entry = ilFindEntry(entryId);
    if(!entry) return;
    entry.appendices = entry.appendices||[];
    const isNew = !appendixId;
    let ap = isNew
      ? { id: ilNewId('ila'), title:'', columns: ilDefaultAppendixColumns(), rows:[] }
      : JSON.parse(JSON.stringify(entry.appendices.find(a=>a.id===appendixId)));
    if(!ap) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    function totalsRowHtml(){
      return ap.columns.map(c=>{
        if(c.type!=='money') return '';
        const total = ap.rows.reduce((s,r)=> s+(parseInt(r[c.key],10)||0), 0);
        return moneySpaced(total);
      });
    }
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:860px;">
          <div class="modal-head"><h3>${isNew? '➕ Thêm phụ lục mới' : '✏️ Sửa phụ lục'}</h3><button class="modal-close" id="ilae-close">✕</button></div>
          <div class="modal-body">
            <div class="field"><label>Tên phụ lục * <span class="sub">(tối đa ${IL_MAX.title} ký tự)</span></label><input type="text" id="ilae-title" maxlength="${IL_MAX.title}" value="${escapeHtml(ap.title||'')}"></div>
            <p class="sub" style="margin:10px 0 4px;"><b>Cột của bảng</b> — tự đặt tên cột và chọn loại (Chữ hoặc Tiền):</p>
            <div id="ilae-cols">
              ${ap.columns.map((c,ci)=>`<div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                <input type="text" class="ilae-col-label" data-ci="${ci}" maxlength="${IL_MAX.colLabel}" value="${escapeHtml(c.label)}" style="flex:1;" placeholder="Tên cột">
                <select class="ilae-col-type" data-ci="${ci}">
                  <option value="text" ${c.type==='text'?'selected':''}>Chữ</option>
                  <option value="money" ${c.type==='money'?'selected':''}>Tiền</option>
                </select>
                <button type="button" class="btn-plain-icon preview-allow ilae-col-del" data-ci="${ci}" title="Xoá cột" style="background:none; border:none; cursor:pointer;" ${ap.columns.length<=1?'disabled style="opacity:.3;"':''}>🗑️</button>
              </div>`).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilae-col-add">➕ Thêm cột</button>
            <p class="sub" style="margin:14px 0 4px;"><b>Các dòng</b>:</p>
            <div class="table-wrap"><table id="ilae-table">
              <thead><tr>${ap.columns.map(c=>`<th>${escapeHtml(c.label)}</th>`).join('')}<th></th></tr></thead>
              <tbody>${ap.rows.map((r,ri)=>`<tr data-ri="${ri}">${ap.columns.map(c=> c.type==='money'
                ? `<td><input type="text" inputmode="numeric" class="ilae-cell-money" data-ri="${ri}" data-ck="${c.key}" value="${r[c.key]||''}" placeholder="Chỉ nhập số"></td>`
                : `<td><input type="text" class="ilae-cell-text" data-ri="${ri}" data-ck="${c.key}" maxlength="${IL_MAX.cellText}" value="${escapeHtml(r[c.key]||'')}"></td>`
              ).join('')}<td><button type="button" class="btn-plain-icon preview-allow ilae-row-del" data-ri="${ri}" title="Xoá dòng" style="background:none; border:none; cursor:pointer;">🗑️</button></td></tr>`).join('')}
              <tr id="ilae-totals-row" style="font-weight:700; background:var(--paper-2);">${totalsRowHtml().map(t=>`<td style="text-align:right;">${t}</td>`).join('')}<td></td></tr>
              </tbody>
            </table></div>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilae-row-add" style="margin-top:8px;">➕ Thêm dòng</button>
            <p class="sub" style="margin-top:12px;">Tổng tiền phụ lục (cộng tất cả cột Tiền): <b>${moneySpaced(ilAppendixMoneyTotal(ap))}</b></p>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="ilae-cancel">Huỷ</button>
            <button class="btn btn-primary" id="ilae-save">💾 Lưu phụ lục</button>
          </div>
        </div>`;
      const close = ()=> wrap.remove();
      wrap.querySelector('#ilae-close').onclick = close;
      wrap.querySelector('#ilae-cancel').onclick = close;
      wrap.querySelectorAll('.ilae-cell-money').forEach(inp=> attachMoneyInputMask(inp, IL_MAX.moneyDigits));
      // Cập nhật tức thì các ô tiền đang gõ -> gom lại vào biến `ap` TRƯỚC khi render lại toàn bộ,
      // để không mất dữ liệu các ô khác đang gõ dở khi người dùng thêm/xoá cột/dòng.
      function readFormIntoAp(){
        ap.title = wrap.querySelector('#ilae-title').value.trim();
        wrap.querySelectorAll('.ilae-col-label').forEach(inp=>{ ap.columns[+inp.dataset.ci].label = inp.value; });
        wrap.querySelectorAll('.ilae-col-type').forEach(sel=>{ ap.columns[+sel.dataset.ci].type = sel.value; });
        wrap.querySelectorAll('.ilae-cell-text').forEach(inp=>{ ap.rows[+inp.dataset.ri][inp.dataset.ck] = inp.value; });
        wrap.querySelectorAll('.ilae-cell-money').forEach(inp=>{ ap.rows[+inp.dataset.ri][inp.dataset.ck] = parseVNMoney(inp.value); });
      }
      wrap.querySelectorAll('.ilae-cell-money').forEach(inp=> inp.addEventListener('input', ()=>{
        const totalsRow = wrap.querySelector('#ilae-totals-row');
        if(!totalsRow) return;
        ap.rows[+inp.dataset.ri][inp.dataset.ck] = parseVNMoney(inp.value);
        const cells = totalsRow.querySelectorAll('td');
        ap.columns.forEach((c,ci)=>{ if(c.type==='money' && cells[ci]) cells[ci].textContent = moneySpaced(ap.columns.filter((x,xi)=>xi===ci)[0] ? ap.rows.reduce((s,r)=>s+(parseInt(r[c.key],10)||0),0) : 0); });
      }));
      wrap.querySelector('#ilae-col-add').onclick = ()=>{ readFormIntoAp(); ap.columns.push({ key: ilNewId('c'), label:'Cột mới', type:'text' }); ap.rows.forEach(r=>{}); render(); };
      wrap.querySelectorAll('.ilae-col-del').forEach(btn=> btn.onclick = ()=>{
        if(ap.columns.length<=1) return;
        readFormIntoAp();
        const key = ap.columns[+btn.dataset.ci].key;
        ap.columns.splice(+btn.dataset.ci,1);
        ap.rows.forEach(r=>{ delete r[key]; });
        render();
      });
      wrap.querySelector('#ilae-row-add').onclick = ()=>{ readFormIntoAp(); ap.rows.push({}); render(); };
      wrap.querySelectorAll('.ilae-row-del').forEach(btn=> btn.onclick = ()=>{ readFormIntoAp(); ap.rows.splice(+btn.dataset.ri,1); render(); });
      wrap.querySelector('#ilae-save').onclick = ()=>{
        readFormIntoAp();
        if(!ap.title){ alert('Vui lòng đặt tên cho phụ lục.'); return; }
        const idx = entry.appendices.findIndex(a=>a.id===ap.id);
        if(idx>=0) entry.appendices[idx] = ap; else entry.appendices.push(ap);
        ilPersist(); close();
        const content2 = document.getElementById('content');
        if(content2) renderInternalLedgerMain(content2);
        if(onDone) onDone();
      };
    }
    document.body.appendChild(wrap);
    render();
  }

  // =====================================================================
  // XEM BẢNG EXCEL / TẢI / IN — kind: 'thu' | 'chi' | 'appendix' | 'all'.
  // =====================================================================
  function ilAoaLedger(type){
    const isThu = type==='thu';
    const headers = ['Ngày','Nội dung '+(isThu?'thu':'chi'),'Số tiền','Người '+(isThu?'thu':'chi'),'Ghi chú','Phụ lục đi kèm'];
    const list = ilEntriesOfType(type);
    const rows = list.map(e=>[ fmtDate(e.date), e.content||'', e.amount||0, e.person||'', e.note||'', (e.appendices||[]).map(a=>a.title).join('; ') ]);
    rows.push(['','TỔNG', list.reduce((s,e)=>s+(parseInt(e.amount,10)||0),0), '', '', '']);
    return { headers, rows };
  }
  function ilAoaAppendix(ap){
    const headers = ap.columns.map(c=>c.label);
    const rows = (ap.rows||[]).map(r=> ap.columns.map(c=> r[c.key]!=null ? r[c.key] : ''));
    rows.push(ap.columns.map(c=> c.type==='money' ? (ap.rows||[]).reduce((s,r)=>s+(parseInt(r[c.key],10)||0),0) : (ap.columns[0]===c?'TỔNG':'')));
    return { headers, rows };
  }
  function ilAllSections(){
    const sections = [{ title:'Tổng quan', headers:['Chỉ tiêu','Số tiền'], rows:[
      ['Tổng Thu', ilTotalOfType('thu')], ['Tổng Chi', ilTotalOfType('chi')], ['Còn lại', ilTotalOfType('thu')-ilTotalOfType('chi')],
    ] }];
    sections.push({ title:'Sổ Thu', ...ilAoaLedger('thu') });
    sections.push({ title:'Sổ Chi', ...ilAoaLedger('chi') });
    ilData().entries.forEach(e=>(e.appendices||[]).forEach(ap=> sections.push({ title:`Phụ lục — ${e.content||''} — ${ap.title||''}`, ...ilAoaAppendix(ap) })));
    return sections;
  }
  function renderInternalExcelModal(kind, appendix){
    let sections;
    if(kind==='all') sections = ilAllSections();
    else if(kind==='appendix') sections = [{ title:`Phụ lục — ${appendix.title||''}`, ...ilAoaAppendix(appendix) }];
    else sections = [{ title: kind==='thu'?'Sổ Thu':'Sổ Chi', ...ilAoaLedger(kind) }];
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:920px;">
        <div class="modal-head"><h3>👁️ Xem trước dạng Excel</h3><button class="modal-close" id="ilx-close">✕</button></div>
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
    wrap.querySelector('#ilx-print').onclick = ()=> ilPrintSections(sections);
    wrap.querySelector('#ilx-export').onclick = async ()=>{
      try{ await ilExportExcel(sections); close(); }
      catch(e){ console.error('[Thu - Chi nội bộ] Lỗi xuất Excel:', e); alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); }
    };
  }
  async function ilExportExcel(sections){
    await loadOptionalLibrary('xlsx');
    const wb = XLSX.utils.book_new();
    sections.forEach((sec,i)=>{
      const headerLines = [ ['HỘI NÔNG DÂN'], [wardTitleUpper()], [provinceTitle()], [`SỔ THU – CHI NỘI BỘ: ${sec.title}`], [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`], [] ];
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
    XLSX.writeFile(wb, `Thu-chi-noi-bo_${todayStr()}.xlsx`, {cellStyles:true});
  }
  function ilPrintSections(sections){
    const area = document.getElementById('print-area');
    if(!area) return;
    area.innerHTML = `
      <div style="text-align:center;">
        <div style="font-weight:800; font-size:14px;">${hoiNongDanTitleHtml()}</div>
        <div style="font-size:12.5px;">${escapeHtml(provinceTitle())}</div>
      </div>
      <div class="print-title" style="margin:10px 0 4px; text-align:center;">SỔ THU – CHI NỘI BỘ</div>
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
  // THÊM NHANH BẰNG AI — khung chat toàn màn hình, theo đúng khung sườn đã dùng
  // cho Sổ vay vốn (renderQuickAddByAiModal ở 09-ai-chat-notes.js), nhưng tách
  // riêng vì "Hồ sơ đang soạn" ở đây có cấu trúc khác (entries Thu/Chi, không
  // phải người vay/phương án vay). Dùng chung các hàm lõi: callAIWithFallback,
  // toggleMicGeneric/toggleMic2Generic (prefix riêng "lqai"), fileToBase64...
  // =====================================================================
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
  function renderLedgerQuickAddModal(){
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
    function draftTableHtml(){
      if(!draft.entries.length) return '<p class="sub">Chưa có dòng nào trong hồ sơ đang soạn.</p>';
      return `<div class="table-wrap"><table>
        <thead><tr><th>Loại</th><th>Ngày</th><th>Nội dung</th><th style="text-align:right;">Số tiền</th><th>Người thu/chi</th><th>Ghi chú</th><th></th></tr></thead>
        <tbody>${draft.entries.map((e,i)=>`<tr>
          <td>${e.type==='thu'?'📥 Thu':'📤 Chi'}</td><td>${escapeHtml(e.date||'')}</td><td>${escapeHtml(e.content||'')}</td>
          <td class="money" style="text-align:right;">${moneySpaced(e.amount)}</td><td>${escapeHtml(e.person||'')}</td><td>${escapeHtml(e.note||'')}</td>
          <td><button type="button" class="btn-plain-icon preview-allow" data-lqai-row-del="${i}" style="background:none; border:none; cursor:pointer;">🗑️</button></td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    }
    function render(){
      const hasAnyUserContent = messages.some(m=>m.role==='user') || pendingAttachments.length>0;
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
          <div class="modal-head"><h3>✨ Thêm nhanh dòng Thu/Chi bằng chat với AI</h3><button class="modal-close preview-allow" id="lqai-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column;" id="lqai-thread">
            ${messages.length? messages.map(bubbleHtml).join('') : `<p class="sub" style="text-align:center; margin:auto;">Hãy nhắn tin hoặc đính kèm tài liệu (ảnh hoá đơn, sổ ghi chép tay...) — AI sẽ đợi đến khi đồng chí bấm "🧠 Tiêu hoá tài liệu bằng AI" mới bắt đầu đọc.</p>`}
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
      wrap.querySelector('#lqai-view-file').onclick = ()=> renderLqaiDraftModal();
      function renderLqaiDraftModal(){
        const dwrap = document.createElement('div');
        dwrap.className = 'modal-bg';
        dwrap.innerHTML = `<div class="modal" style="max-width:96vw; width:860px;">
          <div class="modal-head"><h3>📋 Hồ sơ đang soạn</h3><button class="modal-close" id="lqaid-close">✕</button></div>
          <div class="modal-body">${draftTableHtml()}</div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="lqaid-close2">Đóng</button>
            <button class="btn btn-primary" id="lqaid-add-all" ${!draft.entries.length?'disabled':''}>💾 Lưu tất cả vào Sổ Thu - Chi nội bộ</button>
          </div>
        </div>`;
        document.body.appendChild(dwrap);
        const dclose = ()=> dwrap.remove();
        dwrap.querySelector('#lqaid-close').onclick = dclose;
        dwrap.querySelector('#lqaid-close2').onclick = dclose;
        dwrap.querySelectorAll('[data-lqai-row-del]').forEach(btn=> btn.onclick = ()=>{ draft.entries.splice(+btn.dataset.lqaiRowDel,1); dclose(); renderLqaiDraftModal(); render(); });
        dwrap.querySelector('#lqaid-add-all').onclick = ()=>{
          const d = ilData();
          draft.entries.forEach(e=>{
            if(!e.date || !e.content || !e.amount) return;
            d.entries.push({ id: ilNewId('il'), type: e.type==='thu'?'thu':'chi', date:e.date, content:e.content, amount: parseInt(e.amount,10)||0, person: e.person||'', note: e.note||'', appendices:[] });
          });
          ilPersist();
          draft.entries = [];
          dclose(); closeImmediate();
          const content2 = document.getElementById('content');
          if(content2) renderInternalLedgerMain(content2);
          showBigToast('Đã lưu các dòng vào Sổ Thu - Chi nội bộ!');
        };
      }
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
