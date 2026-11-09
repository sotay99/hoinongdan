  // =====================================================================
  // SỔ THU – CHI NỘI BỘ (module "internal") — bản 3: sắp xếp dòng/cột, modal tiền có
  // công thức nghiêm ngặt, xuất Excel giữ công thức thật, chọn kèm/không kèm tên Cơ quan.
  // Lưu CỤC BỘ trên thiết bị (localStorage) — xem internalLedgerLoadRaw()/
  // internalLedgerSaveRaw(). Sau này muốn chuyển sang Firebase thì chỉ cần đổi bên trong
  // lớp lưu trữ này.
  //
  // Cấu trúc dữ liệu: { ledgers: [{ id, name, order, entryOrder:{thu:[ids],chi:[ids]},
  //   entries: [ {id, type:'thu'|'chi', date, content, amountMode:'manual'|'appendix',
  //   amount, person, note, appendix: null | { id, title, designatedKey,
  //   columns:[{key,label,type:'text'|'money'|'date',showTotal}], rows:[{[colKey]:raw}] } } ] }] }
  // =====================================================================
  const INTERNAL_LEDGER_LOCAL_KEY = 'hnd_internal_ledger_v2';
  const IL_MAX = { content:200, person:80, note:500, title:80, colLabel:40, cellText:200, moneyDigits:12, ledgerName:80, formula:200 };

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
  function ilEnsureEntryOrder(ledger){ if(!ledger.entryOrder) ledger.entryOrder = {thu:[],chi:[]}; if(!ledger.entryOrder.thu) ledger.entryOrder.thu=[]; if(!ledger.entryOrder.chi) ledger.entryOrder.chi=[]; return ledger.entryOrder; }

  // =====================================================================
  // LƯU TRỮ ĐÁM MÂY (bộ nhớ cá nhân) — mỗi Sổ "cloud" là 1 văn bản gốc tại
  // internal_ledgers/{id}, cùng gốc với cơ chế chia sẻ mã xã đã có (wards/{wid} +
  // users/{emailKey}/wards/{wid}) — ở đây là internal_ledgers/{id} +
  // users/{emailKey}/internal_ledgers_owned|internal_ledgers_shared/{id}. Sổ "local"
  // vẫn giữ nguyên trong mảng ilData().ledgers như trước (không đổi gì).
  // =====================================================================
  function ilMyEmail(){ return hasAuthenticatedIdentity() ? state.identity.email.toLowerCase().trim() : null; }
  function ilMyEmailKey(){ const e = ilMyEmail(); return e ? emailToKey(e) : null; }
  function ilCloudLedgerRef(id){ return rtdb.ref('internal_ledgers/'+id); }
  function ilPersistCloud(ledger){
    if(!hasAuthenticatedIdentity()) return;
    ilCloudLedgerRef(ledger.id).set(ledger).catch(err=> console.error('Lỗi lưu Sổ Thu - Chi nội bộ lên đám mây:', err));
  }
  function ilSaveLedger(ledger){ if(ledger && ledger.storage==='cloud') ilPersistCloud(ledger); else ilPersist(); }
  async function ilFetchCloudLedgersBySub(sub){
    const key = ilMyEmailKey();
    if(!key) return [];
    let ids = [];
    try{ const snap = await rtdb.ref(`users/${key}/${sub}`).once('value'); ids = snap.val()? Object.keys(snap.val()) : []; }
    catch(e){ console.error('Lỗi đọc chỉ mục Sổ đám mây:', e); return []; }
    const results = await Promise.all(ids.map(async id=>{
      try{ const snap = await ilCloudLedgerRef(id).once('value'); return snap.exists()? snap.val() : null; }
      catch(e){ return null; }
    }));
    return results.filter(Boolean);
  }
  async function ilRefreshCloudCache(){
    if(!hasAuthenticatedIdentity()){ state._ilCloudOwned = []; state._ilCloudShared = []; return; }
    const [owned, shared] = await Promise.all([ ilFetchCloudLedgersBySub('internal_ledgers_owned'), ilFetchCloudLedgersBySub('internal_ledgers_shared') ]);
    state._ilCloudOwned = owned;
    state._ilCloudShared = shared;
  }
  // Danh sách người được chia sẻ thay đổi -> cập nhật chỉ mục NGƯỢC ở TỪNG người được chia sẻ
  // (để họ chỉ cần đọc đúng 1 đường dẫn của chính mình là biết có sổ nào chia sẻ cho mình).
  async function ilSetLedgerShares(ledger, newShares){
    const oldKeys = Object.keys(ledger.shares||{}), newKeys = Object.keys(newShares||{});
    const removed = oldKeys.filter(k=>!newKeys.includes(k));
    const added = newKeys.filter(k=>!oldKeys.includes(k));
    ledger.shares = newShares||{};
    ilPersistCloud(ledger);
    await Promise.all([
      ...removed.map(k=> rtdb.ref(`users/${k}/internal_ledgers_shared/${ledger.id}`).remove().catch(()=>{})),
      ...added.map(k=> rtdb.ref(`users/${k}/internal_ledgers_shared/${ledger.id}`).set(true).catch(()=>{})),
    ]);
  }
  async function ilMoveLedgerStorage(ledger, newStorage){
    if(ledger.storage===newStorage || (!ledger.storage && newStorage==='local')) return;
    if(newStorage==='cloud'){
      const myEmail = ilMyEmail();
      if(!myEmail){ alert('Vui lòng đăng nhập Google để lưu Sổ lên bộ nhớ đám mây.'); return; }
      ledger.storage = 'cloud'; ledger.ownerEmail = myEmail; ledger.shares = ledger.shares||{};
      await ilCloudLedgerRef(ledger.id).set(ledger);
      await rtdb.ref(`users/${ilMyEmailKey()}/internal_ledgers_owned/${ledger.id}`).set(true);
      const d = ilData(); d.ledgers = d.ledgers.filter(l=>l.id!==ledger.id); ilPersist();
      state._ilCloudOwned = [...(state._ilCloudOwned||[]).filter(l=>l.id!==ledger.id), ledger];
    } else {
      ledger.storage = 'local';
      const d = ilData(); d.ledgers.push(ledger); ilPersist();
      await ilCloudLedgerRef(ledger.id).remove();
      const key = ilMyEmailKey(); if(key) await rtdb.ref(`users/${key}/internal_ledgers_owned/${ledger.id}`).remove();
      state._ilCloudOwned = (state._ilCloudOwned||[]).filter(l=>l.id!==ledger.id);
    }
  }
  function ilTrashLedger(ledger){ ledger.trashed = true; ledger.trashedAt = new Date().toISOString(); ilSaveLedger(ledger); }
  function ilRestoreLedger(ledger){ ledger.trashed = false; ledger.trashedAt = null; ilSaveLedger(ledger); }
  async function ilPermanentlyDeleteLedger(ledger){
    if(ledger.storage==='cloud'){
      await ilCloudLedgerRef(ledger.id).remove().catch(()=>{});
      const key = ilMyEmailKey();
      if(key) await rtdb.ref(`users/${key}/internal_ledgers_owned/${ledger.id}`).remove().catch(()=>{});
      Object.keys(ledger.shares||{}).forEach(k=> rtdb.ref(`users/${k}/internal_ledgers_shared/${ledger.id}`).remove().catch(()=>{}));
      state._ilCloudOwned = (state._ilCloudOwned||[]).filter(l=>l.id!==ledger.id);
    } else {
      const d = ilData(); d.ledgers = d.ledgers.filter(l=>l.id!==ledger.id); ilPersist();
    }
  }
  // Quyền sửa thật sự của NGƯỜI ĐANG XEM đối với 1 Sổ cụ thể — Sổ cục bộ vẫn theo đúng quyền
  // module chung như trước; Sổ đám mây thì chủ sổ luôn sửa được, người được chia sẻ chỉ sửa
  // được nếu quyền là "editor" (viewer chỉ xem).
  function ilCanEditLedger(ledger){
    if(!ledger) return false;
    if(ledger.storage!=='cloud') return canEditModule('internal');
    const myEmail = ilMyEmail();
    if(myEmail && ledger.ownerEmail && myEmail===ledger.ownerEmail.toLowerCase()) return canEditModule('internal');
    const key = ilMyEmailKey();
    const share = key && ledger.shares ? ledger.shares[key] : null;
    return !!(share && share.perm==='editor');
  }
  function ilIsLedgerOwner(ledger){
    if(!ledger || ledger.storage!=='cloud') return true;
    const myEmail = ilMyEmail();
    return !!(myEmail && ledger.ownerEmail && myEmail===ledger.ownerEmail.toLowerCase());
  }

  // =====================================================================
  // SỔ (ledger) — danh sách, tạo/đổi tên/xoá (chuyển vào thùng rác)/sắp xếp.
  // =====================================================================
  function ilAllLedgers(){
    return [...ilData().ledgers.filter(l=>!l.trashed), ...(state._ilCloudOwned||[]).filter(l=>!l.trashed)].sort((a,b)=>(a.order||0)-(b.order||0));
  }
  function ilSharedWithMeLedgers(){ return (state._ilCloudShared||[]).filter(l=>!l.trashed); }
  function ilTrashedLedgers(){
    return [...ilData().ledgers.filter(l=>l.trashed), ...(state._ilCloudOwned||[]).filter(l=>l.trashed)];
  }
  function ilLedgerById(id){
    return ilData().ledgers.find(l=>l.id===id)
      || (state._ilCloudOwned||[]).find(l=>l.id===id)
      || (state._ilCloudShared||[]).find(l=>l.id===id);
  }
  function ilCurrentLedger(){ return state._ilCurrentLedgerId ? ilLedgerById(state._ilCurrentLedgerId) : null; }
  function ilSuggestedLedgerNames(){
    const d = new Date();
    return [ `Sổ năm ${d.getFullYear()}`, `Sổ tháng ${d.getMonth()+1} năm ${d.getFullYear()}` ];
  }
  function ilCreateLedger(name, storage){
    const id = ilNewId('ldg');
    if(storage==='cloud'){
      const maxOrder = (state._ilCloudOwned||[]).reduce((m,l)=>Math.max(m, l.order||0), 0);
      const ledger = { id, name, order: maxOrder+1, storage:'cloud', ownerEmail: ilMyEmail(), shares:{}, entryOrder:{thu:[],chi:[]}, entries: [] };
      state._ilCloudOwned = [...(state._ilCloudOwned||[]), ledger];
      ilPersistCloud(ledger);
      const key = ilMyEmailKey(); if(key) rtdb.ref(`users/${key}/internal_ledgers_owned/${id}`).set(true).catch(()=>{});
      return ledger;
    }
    const d = ilData();
    const maxOrder = d.ledgers.reduce((m,l)=>Math.max(m, l.order||0), 0);
    const ledger = { id, name, order: maxOrder+1, storage:'local', entryOrder:{thu:[],chi:[]}, entries: [] };
    d.ledgers.push(ledger);
    ilPersist();
    return ledger;
  }
  function ilResetEntryFilters(){ state._ilSearch=''; state._ilDateFrom=''; state._ilDateTo=''; }

  function ilStorageBadge(l){ return l.storage==='cloud' ? '☁️ Đám mây' : '💾 Cục bộ'; }
  function renderInternalLedgerListScreen(el){
    if(hasAuthenticatedIdentity() && !state._ilCloudLoaded && !state._ilCloudLoading){
      state._ilCloudLoading = true;
      ilRefreshCloudCache().finally(()=>{ state._ilCloudLoading=false; state._ilCloudLoaded=true; renderInternalLedgerListScreen(el); });
    }
    const sorting = !!state._ilSortingLedgers;
    const ledgersRaw = ilAllLedgers();
    const ledgers = sorting && state._ilLedgerSortDraft
      ? state._ilLedgerSortDraft.map(id=>ledgersRaw.find(l=>l.id===id)).filter(Boolean)
      : ledgersRaw;
    if(sorting && !state._ilLedgerSortDraft) state._ilLedgerSortDraft = ledgers.map(l=>l.id);
    const sharedLedgers = ilSharedWithMeLedgers();
    const trashedLedgers = ilTrashedLedgers();
    const loadingCloud = state._ilCloudLoading;
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🔒 Thu – Chi nội bộ — Danh sách Sổ của tôi</h3><button type="button" class="btn btn-primary btn-sm preview-allow" id="il-ldg-new">➕ Tạo sổ mới</button></div>
        <div class="panel-body">
          ${loadingCloud? `<p class="sub">⏳ Đang tải danh sách Sổ trên bộ nhớ đám mây...</p>` : ''}
          ${sorting? `<div style="margin-bottom:10px;">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary btn-sm preview-allow" id="il-ldg-sort-save">💾 Lưu lại thứ tự sắp xếp</button>
              <button class="btn btn-ghost btn-sm preview-allow" id="il-ldg-sort-cancel">Huỷ (không lưu sắp xếp)</button>
            </div>
            <p class="sub drag-hint-cycle" style="margin:6px 0 0;">Bấm vào tên sổ và kéo thả để thay đổi vị trí.</p>
          </div>` : ''}
          ${ledgers.length? `<div class="table-wrap"><table>
            <thead><tr><th></th><th>Tên sổ</th><th>Nơi lưu</th><th style="text-align:center;">Số dòng Thu</th><th style="text-align:center;">Số dòng Chi</th><th></th></tr></thead>
            <tbody>${ledgers.map(l=>{
              const thuCount = l.entries.filter(e=>e.type==='thu').length;
              const chiCount = l.entries.filter(e=>e.type==='chi').length;
              const canEdit = ilCanEditLedger(l);
              return `<tr${sorting? ` draggable="true" data-drag-ledger="${l.id}"` : ''}>
                <td style="${sorting?'cursor:grab;':''}">${sorting? `<span title="Kéo để đổi vị trí">☰</span>` : (canEdit? `<button type="button" class="btn-plain-icon preview-allow" title="Sắp xếp" data-il-ldg-sortbtn="1" style="background:none; border:none; cursor:pointer;">☰</button>` : '')}</td>
                <td><b><button type="button" class="link-btn preview-allow" data-il-ldg-open="${l.id}">${escapeHtml(l.name)}</button></b></td>
                <td>${ilStorageBadge(l)}</td>
                <td style="text-align:center;">${thuCount}</td>
                <td style="text-align:center;">${chiCount}</td>
                <td style="white-space:nowrap;">${canEdit? `<button type="button" class="btn-plain-icon preview-allow" data-il-ldg-rename="${l.id}" title="Đổi tên / Đổi nơi lưu / Chia sẻ" style="background:none; border:none; cursor:pointer;">✏️</button><button type="button" class="btn-plain-icon preview-allow" data-il-ldg-trash="${l.id}" title="Chuyển vào thùng rác" style="background:none; border:none; cursor:pointer;">🗑️</button>` : ''}</td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>` : `<div class="empty-state">
            <div class="e-ico">📒</div>
            <p style="max-width:520px; margin:0 auto;">Dữ liệu của Thu – Chi nội bộ có thể lưu theo 1 trong 2 cách: <b>Bộ nhớ nội bộ</b> (chỉ trên trình duyệt của thiết bị này, riêng tư tuyệt đối, không đồng bộ giữa các thiết bị, mất nếu xoá dữ liệu web) hoặc <b>Bộ nhớ Đám mây cá nhân</b> (gắn với tài khoản Google của đồng chí, xem được ở bất kỳ thiết bị nào khi đăng nhập, và có thể chia sẻ cho người khác). Mỗi Sổ tự chọn nơi lưu riêng, đổi lại được sau.</p>
            <button type="button" class="btn btn-primary preview-allow" id="il-ldg-new-empty" style="margin-top:14px;">➕ Tạo sổ mới</button>
          </div>`}
        </div>
      </div>
      <div class="panel" style="margin-top:14px;">
        <div class="panel-head"><h3>🤝 Sổ được chia sẻ với tôi</h3></div>
        <div class="panel-body">
          ${sharedLedgers.length? `<div class="table-wrap"><table>
            <thead><tr><th>Tên sổ</th><th>Chủ sở hữu</th><th>Quyền</th><th></th></tr></thead>
            <tbody>${sharedLedgers.map(l=>{
              const key = ilMyEmailKey();
              const perm = (key && l.shares && l.shares[key] && l.shares[key].perm)||'viewer';
              return `<tr>
                <td><b>${escapeHtml(l.name)}</b></td>
                <td>${escapeHtml(l.ownerEmail||'')}</td>
                <td>${perm==='editor'? 'Được chỉnh sửa' : 'Chỉ xem'}</td>
                <td><button type="button" class="btn btn-ghost btn-sm preview-allow" data-il-ldg-open="${l.id}">Mở</button></td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>` : `<div class="empty-state"><div class="e-ico">🤝</div>Chưa có ai chia sẻ Sổ Thu - Chi nội bộ với đồng chí.</div>`}
        </div>
      </div>
      <div class="panel" style="margin-top:14px;">
        <div class="panel-head" style="cursor:pointer;" id="il-trash-toggle"><h3>🗑️ Thùng rác (${trashedLedgers.length}) ${state._ilShowTrash?'▴':'▾'}</h3></div>
        ${state._ilShowTrash? `<div class="panel-body">
          ${trashedLedgers.length? `<div class="table-wrap"><table>
            <thead><tr><th>Tên sổ</th><th>Nơi lưu</th><th></th></tr></thead>
            <tbody>${trashedLedgers.map(l=>`<tr>
              <td>${escapeHtml(l.name)}</td>
              <td>${ilStorageBadge(l)}</td>
              <td style="white-space:nowrap;"><button type="button" class="btn btn-ghost btn-sm preview-allow" data-il-ldg-restore="${l.id}">♻️ Khôi phục</button> <button type="button" class="btn btn-ghost btn-sm preview-allow" data-il-ldg-purge="${l.id}" style="color:var(--red);">🗑️ Xoá vĩnh viễn</button></td>
            </tr>`).join('')}</tbody>
          </table></div>` : `<div class="empty-state"><div class="e-ico">🗑️</div>Thùng rác đang rỗng.</div>`}
        </div>` : ''}
      </div>`;
    const newBtn = document.getElementById('il-ldg-new');
    if(newBtn) newBtn.onclick = ()=> renderLedgerNameModal(null, el);
    const newBtnEmpty = document.getElementById('il-ldg-new-empty');
    if(newBtnEmpty) newBtnEmpty.onclick = ()=> renderLedgerNameModal(null, el);
    el.querySelectorAll('[data-il-ldg-open]').forEach(btn=> btn.onclick = ()=>{
      state._ilCurrentLedgerId = btn.dataset.ilLdgOpen;
      ilResetEntryFilters();
      renderInternalLedgerMain(el);
    });
    el.querySelectorAll('[data-il-ldg-rename]').forEach(btn=> btn.onclick = ()=> renderLedgerNameModal(ilLedgerById(btn.dataset.ilLdgRename), el));
    el.querySelectorAll('[data-il-ldg-trash]').forEach(btn=> btn.onclick = ()=>{
      if(!confirm('Chuyển sổ này vào thùng rác? Có thể khôi phục lại sau ở panel "Thùng rác".')) return;
      ilTrashLedger(ilLedgerById(btn.dataset.ilLdgTrash));
      renderInternalLedgerListScreen(el);
    });
    const trashToggle = document.getElementById('il-trash-toggle');
    if(trashToggle) trashToggle.onclick = ()=>{ state._ilShowTrash = !state._ilShowTrash; renderInternalLedgerListScreen(el); };
    el.querySelectorAll('[data-il-ldg-restore]').forEach(btn=> btn.onclick = ()=>{
      ilRestoreLedger(ilLedgerById(btn.dataset.ilLdgRestore));
      renderInternalLedgerListScreen(el);
    });
    el.querySelectorAll('[data-il-ldg-purge]').forEach(btn=> btn.onclick = async ()=>{
      if(!confirm('Xoá VĨNH VIỄN sổ này? Toàn bộ dòng Thu/Chi và phụ lục bên trong sẽ mất hoàn toàn, không thể khôi phục.')) return;
      try{ await ilPermanentlyDeleteLedger(ilLedgerById(btn.dataset.ilLdgPurge)); }
      catch(e){ console.error('Lỗi xoá vĩnh viễn Sổ:', e); alert('Có lỗi khi xoá vĩnh viễn, vui lòng thử lại.'); }
      renderInternalLedgerListScreen(el);
    });
    el.querySelectorAll('[data-il-ldg-sortbtn]').forEach(btn=> btn.onclick = ()=>{ state._ilSortingLedgers = true; state._ilLedgerSortDraft = null; renderInternalLedgerListScreen(el); });
    const sortSaveBtn = document.getElementById('il-ldg-sort-save');
    if(sortSaveBtn) sortSaveBtn.onclick = ()=>{
      const order = state._ilLedgerSortDraft||[];
      order.forEach((id,i)=>{ const l = ilLedgerById(id); if(l){ l.order = i+1; ilSaveLedger(l); } });
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
    let storage = ledger? (ledger.storage||'local') : 'local';
    let sharesDraft = ledger && ledger.shares ? {...ledger.shares} : {};
    const canUseCloud = hasAuthenticatedIdentity();
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:640px;">
          <div class="modal-head"><h3>${isNew? '➕ Tạo sổ mới' : '✏️ Sửa thông tin sổ'}</h3><button class="modal-close" id="illn-close">✕</button></div>
          <div class="modal-body">
            <div class="field"><label>Tên sổ * <span class="sub">(tối đa ${IL_MAX.ledgerName} ký tự)</span></label><input type="text" id="illn-name" maxlength="${IL_MAX.ledgerName}" value="${escapeHtml(ledger? ledger.name : '')}" placeholder="Vd: Sổ năm 2026"></div>
            ${isNew? `<p class="sub" style="margin:0 0 6px;">Gợi ý:</p><div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">${suggestions.map(s=>`<button type="button" class="btn btn-ghost btn-sm preview-allow" data-illn-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div>` : ''}
            <label style="display:block; margin-bottom:6px;">Chọn nơi lưu</label>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
              <label style="display:flex; gap:10px; align-items:flex-start; border:1px solid var(--line); border-radius:8px; padding:10px; cursor:pointer; ${storage==='local'?'border-color:#4527a0; background:#f3f0ff;':''}">
                <input type="radio" name="illn-storage" value="local" ${storage==='local'?'checked':''} style="margin-top:3px;">
                <span><b>1. Lưu tại Bộ nhớ nội bộ thuộc Trình duyệt Web trên thiết bị này</b><br><span class="sub">Sổ này được lưu tại Trình duyệt Web trên thiết bị này, Riêng tư tuyệt đối, không thể truy cập Sổ này nếu bạn đổi thiết bị hoặc đổi trình duyệt, Nếu bạn xoá dữ liệu web trên trình duyệt Thì Sổ Thu chi này cũng đồng thời bị xoá vĩnh viễn.</span></span>
              </label>
              <label style="display:flex; gap:10px; align-items:flex-start; border:1px solid var(--line); border-radius:8px; padding:10px; cursor:${canUseCloud?'pointer':'not-allowed'}; opacity:${canUseCloud?1:.5}; ${storage==='cloud'?'border-color:#4527a0; background:#f3f0ff;':''}">
                <input type="radio" name="illn-storage" value="cloud" ${storage==='cloud'?'checked':''} ${canUseCloud?'':'disabled'} style="margin-top:3px;">
                <span><b>2. Lưu tại bộ nhớ Đám mây thuộc Tài khoản cá nhân của đồng chí.</b><br><span class="sub">Sổ được lưu trên Bộ nhớ Đám mây, thuộc Tài khoản cá nhân của đồng chí, có thể truy cập sổ này ở bất cứ thiết bị nào miễn có internet và chỉ khi đồng chí đăng nhập vào bằng tài khoản của mình, và chỉ có Tài khoản của Đồng chí mới có quyền truy cập vào Sổ này, vẫn đảm bảo riêng tư, vẫn cho phép chia sẻ với người được chọn.${canUseCloud?'':' (Cần đăng nhập Google mới chọn được mục này.)'}</span></span>
              </label>
            </div>
            ${storage==='cloud'? `
              <label style="display:block; margin-bottom:6px;">Chia sẻ cho người khác</label>
              <div style="display:flex; gap:8px; margin-bottom:8px;">
                <input type="email" id="illn-share-email" placeholder="email@example.com" style="flex:1;">
                <select id="illn-share-perm"><option value="viewer">Chỉ xem</option><option value="editor">Được chỉnh sửa</option></select>
                <button type="button" class="btn btn-primary btn-sm preview-allow" id="illn-share-add">Thêm</button>
              </div>
              <div id="illn-share-list">
                ${Object.values(sharesDraft).length? Object.entries(sharesDraft).map(([key,s])=>`
                  <div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--line);">
                    <span style="flex:1;">${escapeHtml(s.email)}</span>
                    <select data-illn-share-perm="${key}"><option value="viewer" ${s.perm==='viewer'?'selected':''}>Chỉ xem</option><option value="editor" ${s.perm==='editor'?'selected':''}>Được chỉnh sửa</option></select>
                    <button type="button" class="btn btn-ghost btn-sm preview-allow" data-illn-share-remove="${key}">Xoá</button>
                  </div>`).join('') : `<p class="sub">Chưa chia sẻ cho ai.</p>`}
              </div>
            ` : ''}
          </div>
          <div class="modal-foot"><button class="btn btn-ghost" id="illn-cancel">Huỷ</button><button class="btn btn-primary" id="illn-save">💾 Lưu</button></div>
        </div>`;
      const close = ()=> wrap.remove();
      wrap.querySelector('#illn-close').onclick = close;
      wrap.querySelector('#illn-cancel').onclick = close;
      wrap.querySelectorAll('[data-illn-suggest]').forEach(btn=> btn.onclick = ()=>{ wrap.querySelector('#illn-name').value = btn.dataset.illnSuggest; });
      wrap.querySelectorAll('[name="illn-storage"]').forEach(r=> r.onchange = ()=>{ if(r.checked){ storage = r.value; render(); } });
      const shareAddBtn = wrap.querySelector('#illn-share-add');
      if(shareAddBtn) shareAddBtn.onclick = ()=>{
        const input = wrap.querySelector('#illn-share-email');
        const email = (input.value||'').trim().toLowerCase();
        const perm = wrap.querySelector('#illn-share-perm').value;
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ alert('Vui lòng nhập email hợp lệ.'); return; }
        sharesDraft[emailToKey(email)] = { email, perm };
        render();
      };
      wrap.querySelectorAll('[data-illn-share-remove]').forEach(btn=> btn.onclick = ()=>{ delete sharesDraft[btn.dataset.illnShareRemove]; render(); });
      wrap.querySelectorAll('[data-illn-share-perm]').forEach(sel=> sel.onchange = ()=>{ const s = sharesDraft[sel.dataset.illnSharePerm]; if(s) s.perm = sel.value; });
      wrap.querySelector('#illn-save').onclick = async ()=>{
        const name = wrap.querySelector('#illn-name').value.trim();
        if(!name){ alert('Vui lòng đặt tên sổ.'); return; }
        if(storage==='cloud' && !canUseCloud){ alert('Vui lòng đăng nhập Google để dùng bộ nhớ đám mây.'); return; }
        const saveBtn = wrap.querySelector('#illn-save'); saveBtn.disabled = true; saveBtn.textContent = '⏳ Đang lưu...';
        try{
          if(isNew){
            const newLedger = ilCreateLedger(name, storage);
            if(storage==='cloud' && Object.keys(sharesDraft).length) await ilSetLedgerShares(newLedger, sharesDraft);
          } else {
            if((ledger.storage||'local')!==storage) await ilMoveLedgerStorage(ledger, storage);
            ledger.name = name;
            if(storage==='cloud') await ilSetLedgerShares(ledger, sharesDraft);
            else ilSaveLedger(ledger);
          }
          close();
          renderInternalLedgerListScreen(el);
        }catch(err){
          console.error('Lỗi lưu Sổ Thu - Chi nội bộ:', err);
          alert('Có lỗi khi lưu — vui lòng kiểm tra kết nối mạng rồi thử lại.');
          saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu';
        }
      };
    }
    document.body.appendChild(wrap);
    render();
  }

  // =====================================================================
  // CỔNG "CHẤP NHẬN VÀ BẮT ĐẦU MỞ SỔ" — màn giới thiệu giữ nguyên, thêm nút.
  // =====================================================================
  function renderInternalTab(el){
    const ledger = ilCurrentLedger();
    if(ledger) renderInternalLedgerMain(el);
    else renderInternalLedgerListScreen(el);
  }

  // =====================================================================
  // BÊN TRONG 1 SỔ — Sổ Thu + Sổ Chi, sắp xếp thứ tự dòng.
  // =====================================================================
  function ilEntriesOfType(ledger, type){
    ilEnsureEntryOrder(ledger);
    const list = ledger.entries.filter(e=>e.type===type);
    const orderArr = ledger.entryOrder[type]||[];
    if(!orderArr.length) return list.slice().sort((a,b)=> (a.date||'').localeCompare(b.date||''));
    const orderIndex = {}; orderArr.forEach((id,i)=> orderIndex[id]=i);
    return list.slice().sort((a,b)=>{
      const ai = orderIndex[a.id], bi = orderIndex[b.id];
      if(ai!=null && bi!=null) return ai-bi;
      if(ai!=null) return -1;
      if(bi!=null) return 1;
      return (a.date||'').localeCompare(b.date||'');
    });
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
  // "Phụ lục Thu 1 (Rút kinh phí đại hội)" — nếu tên phụ lục đã có chữ "phụ lục" (không phân biệt
  // hoa/thường) thì KHÔNG thêm tiền tố nữa, tránh lặp "Phụ lục Phụ lục ...".
  function ilAppendixDisplayTitle(entry){
    const raw = (entry.appendix && entry.appendix.title) || '';
    const hasWord = /phụ lục/i.test(raw);
    const title = hasWord ? raw : `Phụ lục ${raw}`;
    return `${title} (${entry.content||''})`;
  }

  function ilSummaryBarHtml(ledger){
    const totalThu = ilTotalOfType(ledger,'thu');
    const totalChi = ilTotalOfType(ledger,'chi');
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
  function ilEntryRowHtml(e, canEdit, sorting){
    return `<tr${sorting? ` draggable="true" data-drag-entry="${e.id}"` : ''}>
      ${sorting? `<td style="cursor:grab;"><span title="Kéo để đổi vị trí">☰</span></td>` : ''}
      <td>${fmtDate(e.date)}</td>
      <td>${escapeHtml(e.content||'')}</td>
      <td class="money"><div style="display:flex; justify-content:flex-end; align-items:center; gap:4px;">${e.amountMode==='appendix'? '<span class="sub" title="Đồng bộ theo phụ lục">🔗</span>' : ''}<span>${moneySpaced(e.amount)}</span></div></td>
      <td>${escapeHtml(e.person||'')}</td>
      <td>${escapeHtml(e.note||'')}</td>
      <td style="white-space:nowrap;">${ilAppendixBtnHtml(e)}</td>
      ${canEdit && !sorting? `<td style="white-space:nowrap;"><button type="button" class="btn-plain-icon preview-allow" data-il-edit="${e.id}" title="Sửa" style="background:none; border:none; cursor:pointer;">✏️</button><button type="button" class="btn-plain-icon preview-allow" data-il-del="${e.id}" title="Xoá" style="background:none; border:none; cursor:pointer;">🗑️</button></td>` : ''}
    </tr>`;
  }
  function ilPanelHtml(ledger, type, canEdit){
    const isThu = type==='thu';
    const showKey = isThu ? '_ilShowThu' : '_ilShowChi';
    const open = state[showKey]!==false;
    const sorting = state._ilSortingType===type;
    const rawCount = ilEntriesOfType(ledger, type).length;
    const list = sorting ? ilEntriesOfType(ledger, type) : ilFilteredEntriesOfType(ledger, type);
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
            ${sorting? `<button type="button" class="btn btn-primary btn-sm preview-allow" id="il-sort-save-${type}">💾 Lưu thứ tự</button><button type="button" class="btn btn-ghost btn-sm preview-allow" id="il-sort-cancel-${type}">Huỷ</button>` : `
              ${canEdit? `<button type="button" class="btn btn-primary btn-sm preview-allow" id="il-add-${type}">➕ Thêm dòng ${isThu?'thu':'chi'}</button>` : ''}
              ${canEdit && list.length>1? `<button type="button" class="btn btn-ghost btn-sm preview-allow" id="il-sort-start-${type}">☰ Sắp xếp thứ tự</button>` : ''}
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="il-excel-${type}">📊 Xem bảng Excel</button>
            `}
          </div>
        </div>
        ${open? `<div class="panel-body">
          ${list.length? `<div class="table-wrap"><table>
            <thead><tr>${sorting? '<th></th>' : ''}<th>Ngày</th><th>Nội dung ${isThu?'thu':'chi'}</th><th style="text-align:right;">Số tiền</th><th>${personLabel}</th><th>Ghi chú</th><th>Phụ lục</th>${canEdit && !sorting? '<th></th>' : ''}</tr></thead>
            <tbody>${list.map(e=>ilEntryRowHtml(e,canEdit,sorting)).join('')}</tbody>
          </table></div>` : `<div class="empty-state"><div class="e-ico">${isThu?'📥':'📤'}</div>${emptyMsg}</div>`}
        </div>` : ''}
      </div>`;
  }
  function renderInternalLedgerMain(el){
    const ledger = ilCurrentLedger();
    if(!ledger){ renderInternalLedgerListScreen(el); return; }
    const canEdit = ilCanEditLedger(ledger);
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin:0 0 10px; gap:10px; flex-wrap:wrap;">
        <h2 style="margin:0;">📒 ${escapeHtml(ledger.name)}</h2>
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="il-back-list" style="color:#b71c1c; font-weight:800;">← Thoát ra danh sách Sổ</button>
      </div>
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
    if(aiBtn) aiBtn.onclick = ()=> renderLedgerQuickAddModal(ledger, el);
    const overviewBtn = document.getElementById('il-overview-excel-btn');
    if(overviewBtn) overviewBtn.onclick = ()=> ilStartExport(ledger, 'all');
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
      if(excelBtn) excelBtn.onclick = (e)=>{ e.stopPropagation(); ilStartExport(ledger, type); };
      const sortStartBtn = document.getElementById('il-sort-start-'+type);
      if(sortStartBtn) sortStartBtn.onclick = (e)=>{ e.stopPropagation(); state._ilSortingType = type; renderInternalLedgerMain(el); };
      const sortSaveBtn = document.getElementById('il-sort-save-'+type);
      if(sortSaveBtn) sortSaveBtn.onclick = (e)=>{
        e.stopPropagation();
        ilEnsureEntryOrder(ledger);
        ledger.entryOrder[type] = ilEntriesOfType(ledger, type).map(x=>x.id);
        ilSaveLedger(ledger);
        state._ilSortingType = null; renderInternalLedgerMain(el);
      };
      const sortCancelBtn = document.getElementById('il-sort-cancel-'+type);
      if(sortCancelBtn) sortCancelBtn.onclick = (e)=>{ e.stopPropagation(); state._ilSortingType = null; renderInternalLedgerMain(el); };
    });
    el.querySelectorAll('[data-il-edit]').forEach(btn=> btn.onclick = ()=>{
      const entry = ilFindEntry(ledger, btn.dataset.ilEdit);
      if(entry) renderInternalEntryModal(ledger, entry.type, entry, el);
    });
    el.querySelectorAll('[data-il-del]').forEach(btn=> btn.onclick = ()=>{
      if(!confirm('Xoá dòng này? Phụ lục đi kèm (nếu có) cũng sẽ bị xoá.')) return;
      ledger.entries = ledger.entries.filter(e=>e.id!==btn.dataset.ilDel); ilSaveLedger(ledger); renderInternalLedgerMain(el);
    });
    el.querySelectorAll('[data-il-appendix]').forEach(btn=> btn.onclick = ()=>{
      const entry = ilFindEntry(ledger, btn.dataset.ilAppendix);
      if(entry) renderInternalAppendixEditorModal(ledger, entry, el);
    });
    if(state._ilSortingType){
      const type = state._ilSortingType;
      wireDragReorderWithIndicator(
        Array.from(el.querySelectorAll('[data-drag-entry]')),
        row=> row.dataset.dragEntry,
        (draggedId, targetId, before)=>{
          ilEnsureEntryOrder(ledger);
          const current = ilEntriesOfType(ledger, type).map(x=>x.id);
          const arr = current.filter(id=>id!==draggedId);
          let idx = arr.indexOf(targetId);
          if(!before) idx += 1;
          arr.splice(idx, 0, draggedId);
          ledger.entryOrder[type] = arr;
          renderInternalLedgerMain(el);
        }
      );
    }
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
              <div style="display:flex; gap:0; margin:4px 0 8px; border:1px solid var(--line); border-radius:8px; overflow:hidden;">
                <button type="button" class="btn ${amountMode==='manual'?'btn-primary':'btn-ghost'} btn-sm preview-allow" id="ilm-tab-manual" style="flex:1; border-radius:0;">Nhập số tiền cụ thể</button>
                <button type="button" class="btn ${amountMode==='appendix'?'btn-primary':'btn-ghost'} btn-sm preview-allow" id="ilm-tab-appendix" style="flex:1; border-radius:0;">Số tiền được đồng bộ theo phụ lục kèm theo của dòng này</button>
              </div>
              <p class="sub" style="margin:0 0 8px;">${amountMode==='manual'? `Tự gõ đúng số tiền của dòng ${isThu?'thu':'chi'} này.` : 'Số tiền sẽ tự tính theo cột tiền chính của phụ lục kèm theo, không gõ tay — mặc định 0 đ cho đến khi phụ lục kèm theo có dữ liệu.'}</p>
              ${amountMode==='manual'? `<label>Số tiền (đ) * <span class="sub">(tối đa ${IL_MAX.moneyDigits} số)</span> <span class="sub" id="ilm-amount-disp" style="font-weight:700; color:#b71c1c;"></span></label><input type="text" inputmode="numeric" id="ilm-amount" value="${e0.amount||''}" placeholder="Chỉ nhập số">` : `<p class="sub">Số tiền hiện tại (đồng bộ theo phụ lục): <b>${moneySpaced(e0.appendix? ilAppendixDesignatedTotal(e0.appendix) : 0)}</b></p>`}
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
      wrap.querySelector('#ilm-tab-manual').onclick = ()=>{ amountMode='manual'; render(); };
      wrap.querySelector('#ilm-tab-appendix').onclick = ()=>{ amountMode='appendix'; render(); };
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
          amount = e0.appendix ? ilAppendixDesignatedTotal(e0.appendix) : 0;
        }
        if(!date || !content){ alert('Vui lòng điền đủ Ngày và Nội dung.'); return; }
        let appendix = e0.appendix;
        if(amountMode==='appendix' && !appendix){
          appendix = { id: ilNewId('ila'), title: ilGenerateAppendixName(ledger, type), designatedKey:null, columns: ilDefaultAppendixColumns(), rows:[] };
        }
        const updated = { ...e0, date, content, amount, amountMode, person: wrap.querySelector('#ilm-person').value.trim(), note: wrap.querySelector('#ilm-note').value.trim(), appendix };
        const idx = ledger.entries.findIndex(x=>x.id===e0.id);
        if(idx>=0) ledger.entries[idx] = updated; else { ledger.entries.push(updated); ilEnsureEntryOrder(ledger); ledger.entryOrder[type].push(updated.id); }
        ilSaveLedger(ledger); close();
        renderInternalLedgerMain(el);
      };
    }
    document.body.appendChild(wrap);
    render();
  }

  // =====================================================================
  // CÔNG THỨC — tokenizer + phân tích cú pháp nghiêm ngặt (chỉ + − × ÷, tham chiếu ô
  // trong CÙNG 1 phụ lục, không phân biệt hoa/thường). Công thức sai cấu trúc bị chặn
  // lưu; ô tham chiếu không phải "Tiền" (hoặc không phải số) được mặc định 0 nếu đứng
  // sau dấu + / −, mặc định 1 nếu đứng sau dấu × / ÷.
  // =====================================================================
  function ilColLetter(i){ return String.fromCharCode(65+i); }
  function ilTokenizeFormula(body){
    const tokens = [];
    const re = /\s*(?:([A-Za-z]+\d+)|(\d+(?:\.\d+)?)|([+\-*/()]))\s*/g;
    let i = 0;
    while(i < body.length){
      re.lastIndex = i;
      const m = re.exec(body);
      if(!m || m.index!==i) return null; // ký tự lạ không khớp được token nào
      if(m[1]) tokens.push({ t:'ref', v:m[1].toUpperCase() });
      else if(m[2]) tokens.push({ t:'num', v:parseFloat(m[2]) });
      else if(m[3]) tokens.push({ t:m[3]==='('?'lparen':(m[3]===')'?'rparen':'op'), v:m[3] });
      i = re.lastIndex;
      if(i===m.index) break; // tránh vòng lặp vô hạn nếu regex không tiến lên được
    }
    return tokens;
  }
  // Phân tích cú pháp (đồng thời dùng để KIỂM TRA hợp lệ lẫn DỰNG CÂY tính toán):
  // expr := term ((+|-) term)* ; term := factor ((*|/) factor)* ; factor := ref | num | '(' expr ')'.
  // Phải tiêu thụ HẾT token thì mới hợp lệ — còn dư/thiếu token đều là công thức sai.
  function ilParseFormulaTokens(tokens){
    let pos = 0;
    function peek(){ return tokens[pos]; }
    function factor(){
      const t = peek();
      if(!t) return null;
      if(t.t==='ref'){ pos++; return { k:'ref', v:t.v }; }
      if(t.t==='num'){ pos++; return { k:'num', v:t.v }; }
      if(t.t==='lparen'){
        pos++;
        const node = expr();
        if(!node) return null;
        if(!peek() || peek().t!=='rparen') return null;
        pos++;
        return node;
      }
      return null;
    }
    function term(){
      let node = factor();
      if(!node) return null;
      for(;;){
        const t = peek();
        if(t && t.t==='op' && (t.v==='*'||t.v==='/')){
          pos++;
          const right = factor();
          if(!right) return null;
          node = { k:'bin', op:t.v, l:node, r:right };
        } else break;
      }
      return node;
    }
    function expr(){
      let node = term();
      if(!node) return null;
      for(;;){
        const t = peek();
        if(t && t.t==='op' && (t.v==='+'||t.v==='-')){
          pos++;
          const right = term();
          if(!right) return null;
          node = { k:'bin', op:t.v, l:node, r:right };
        } else break;
      }
      return node;
    }
    const ast = expr();
    if(!ast || pos!==tokens.length) return null;
    return ast;
  }
  function ilParseFormula(raw){
    const body = String(raw||'').trim().replace(/^=/,'');
    if(!body) return null;
    const tokens = ilTokenizeFormula(body);
    if(!tokens || !tokens.length) return null;
    return ilParseFormulaTokens(tokens);
  }
  function ilFormulaValid(raw){ return !!ilParseFormula(raw); }
  // resolveRef(colLetter, rowNumber) -> { numeric:true, value:N } | { numeric:false }
  function ilEvalAst(node, resolveRef){
    if(node.k==='num') return { numeric:true, value:node.v };
    if(node.k==='ref'){
      const m = node.v.match(/^([A-Z]+)(\d+)$/);
      if(!m) return { numeric:false };
      return resolveRef(m[1], parseInt(m[2],10));
    }
    // bin: toán hạng không phải số -> mặc định theo ngữ cảnh phép toán (0 cho +/-, 1 cho */)
    const defaultFor = node.op==='*'||node.op==='/' ? 1 : 0;
    const lRes = ilEvalAst(node.l, resolveRef);
    const rRes = ilEvalAst(node.r, resolveRef);
    const l = lRes.numeric? lRes.value : defaultFor;
    const r = rRes.numeric? rRes.value : defaultFor;
    let value;
    if(node.op==='+') value = l+r;
    else if(node.op==='-') value = l-r;
    else if(node.op==='*') value = l*r;
    else value = r? l/r : 0;
    return { numeric:true, value };
  }
  function ilResolveMoneyCell(ap, rowIdx, colKey, visiting){
    const cellId = rowIdx+'|'+colKey;
    if(visiting.has(cellId)) return 0;
    visiting.add(cellId);
    const raw = String((ap.rows[rowIdx]||{})[colKey] ?? '').trim();
    let result;
    if(raw.startsWith('=')){
      const ast = ilParseFormula(raw);
      if(ast){
        const resolveRef = (letter, rowNum)=>{
          const ci = letter.length===1 ? letter.charCodeAt(0)-65 : -1;
          const ri = rowNum-1;
          const col = ap.columns[ci];
          if(!col || ri<0 || ri>=ap.rows.length) return { numeric:false };
          if(col.type!=='money') return { numeric:false };
          return { numeric:true, value: ilResolveMoneyCell(ap, ri, col.key, visiting) };
        };
        result = Math.round(ilEvalAst(ast, resolveRef).value);
      } else result = 0;
    }
    else {
      // Trước đây chỉ giữ chữ số (xoá luôn dấu phẩy/chấm) — "12,5" biến thành "125" sai hẳn giá trị,
      // khiến công thức tham chiếu tới ô này nhận một số nguyên lớn gấp 10-100 lần số thật người
      // dùng gõ. Giờ đọc đúng số thập phân (nếu có) rồi LÀM TRÒN về số nguyên, đúng yêu cầu mọi ô
      // tiền trong phụ lục luôn là số nguyên, không còn số lẻ sau dấu phẩy.
      let cleaned = raw.replace(/[^\d,.-]/g,'');
      const lastComma = cleaned.lastIndexOf(','), lastDot = cleaned.lastIndexOf('.');
      if(lastComma>-1 && lastDot>-1){
        cleaned = lastComma>lastDot ? cleaned.replace(/\./g,'').replace(',', '.') : cleaned.replace(/,/g,'');
      } else if(lastComma>-1){
        cleaned = cleaned.replace(',', '.');
      }
      result = Math.round(parseFloat(cleaned)) || 0;
    }
    visiting.delete(cellId);
    return result;
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

  // =====================================================================
  // Mặt nạ ô tiền (giữ số thô khi gõ, tách nhóm khi rời ô) dùng trong các modal nhỏ.
  // =====================================================================
  function ilWireInlineMoneyDisp(input, dispEl, maxDigits){
    attachMoneyInputMask(input, maxDigits||IL_MAX.moneyDigits);
    const update = ()=>{ const digits = input.value.replace(/[^\d]/g,''); dispEl.textContent = digits? `= ${groupDigitsRight(digits,3)} đ` : ''; };
    input.addEventListener('input', update);
    update();
  }
  // Kéo di chuyển 1 panel nổi bằng thanh tiêu đề của nó — dùng cho modal nhỏ sửa ô tiền,
  // để không che khuất các ô khác của bảng phụ lục phía dưới.
  // Kéo di chuyển panel bằng thanh tiêu đề — hỗ trợ CẢ chuột lẫn ngón tay (cảm ứng). Trước đây chỉ
  // gắn mousedown/mousemove/mouseup nên trên điện thoại/tablet giữ-kéo thanh tiêu đề không có tác
  // dụng gì cả.
  function ilMakeDraggable(panel, handle){
    let sx=0, sy=0, ox=0, oy=0, dragging=false;
    function pointFromEvent(e){ return e.touches && e.touches.length? { x:e.touches[0].clientX, y:e.touches[0].clientY } : { x:e.clientX, y:e.clientY }; }
    function onDown(e){
      const p = pointFromEvent(e);
      dragging=true; sx=p.x; sy=p.y;
      const r=panel.getBoundingClientRect(); ox=r.left; oy=r.top;
      e.preventDefault();
    }
    function onMove(e){
      if(!dragging) return;
      const p = pointFromEvent(e);
      panel.style.left=(ox+p.x-sx)+'px'; panel.style.top=(oy+p.y-sy)+'px';
      if(e.cancelable) e.preventDefault(); // chặn cuộn trang khi đang kéo bằng ngón tay
    }
    function onUp(){ dragging=false; }
    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive:false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive:false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return ()=>{
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }

  // =====================================================================
  // MODAL NHỎ SỬA 1 Ô TIỀN — 2 tab "Nhập số tiền cụ thể" / "Gắn công thức", kéo di
  // chuyển được bằng thanh tiêu đề, có nút ✕. Bấm vào ô tiền khác trong bảng (khi đang
  // ở tab công thức) để chèn toạ độ ô đó.
  // =====================================================================
  function renderMoneyCellModal(ap, rowIdx, colKey, tableEl, onSaved, onClose){
    const raw = String((ap.rows[rowIdx]||{})[colKey] ?? '');
    const isFormula = raw.startsWith('=');
    let tab = isFormula ? 'formula' : 'literal';
    const panel = document.createElement('div');
    // Luôn hiện CHÍNH GIỮA màn hình lúc mở — trước đây đặt lệch theo vị trí bảng (tableRect), nhìn
    // ổn trên máy lớn nhưng méo và tràn mép trên màn hình hẹp. Dùng visibility:hidden trong 1 khung
    // hình đầu để đo đúng offsetWidth/offsetHeight THẬT (viền/đổ bóng/nội dung 2 tab khác chiều cao)
    // rồi mới tính toạ độ giữa, tránh "nhảy" vị trí ngay sau khi hiện ra.
    panel.style.cssText = 'position:fixed; z-index:10000; background:var(--white); border-radius:12px; box-shadow:0 8px 28px rgba(0,0,0,.35); width:320px; overflow:hidden; visibility:hidden;';
    document.body.appendChild(panel);
    let unbindDrag = null;
    let pickHandler = null;
    const close = ()=>{ if(unbindDrag) unbindDrag(); if(pickHandler) tableEl.removeEventListener('mousedown', pickHandler, true); panel.remove(); if(onClose) onClose(); };
    function render(){
      panel.innerHTML = `
        <div id="ilcm-handle" style="background:linear-gradient(180deg, #4527a0 0%, #311b92 100%); color:#fff; padding:8px 10px; cursor:move; display:flex; justify-content:space-between; align-items:center; font-weight:700; font-size:13px;">
          <span>💰 Ô ${ilColLetter(ap.columns.findIndex(c=>c.key===colKey))}${rowIdx+1}</span>
          <button type="button" class="preview-allow" id="ilcm-x" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer;">✕</button>
        </div>
        <div style="padding:10px;">
          <div style="display:flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; margin-bottom:10px;">
            <button type="button" class="btn ${tab==='literal'?'btn-primary':'btn-ghost'} btn-sm preview-allow" id="ilcm-tab-lit" style="flex:1; border-radius:0;">Nhập số tiền cụ thể</button>
            <button type="button" class="btn ${tab==='formula'?'btn-primary':'btn-ghost'} btn-sm preview-allow" id="ilcm-tab-f" style="flex:1; border-radius:0;">Gắn công thức</button>
          </div>
          ${tab==='literal'? `
            <label class="sub" id="ilcm-disp" style="display:block; font-weight:700; color:#b71c1c; margin-bottom:4px;"></label>
            <input type="text" inputmode="numeric" id="ilcm-lit-input" value="${escapeHtml(isFormula? '' : raw)}" placeholder="Chỉ nhập số" style="width:100%; text-align:right; padding:6px 8px; border:1px solid var(--line); border-radius:6px;">
          ` : `
            <input type="text" id="ilcm-f-input" maxlength="${IL_MAX.formula}" value="${escapeHtml(isFormula? raw : '=')}" style="width:100%; padding:6px 8px; border:1px solid var(--line); border-radius:6px; font-family:monospace;">
            <div style="display:flex; gap:6px; margin:8px 0;">
              ${['+','-','×','÷'].map(op=>`<button type="button" class="btn btn-ghost btn-sm preview-allow" data-ilcm-op="${op}">${op}</button>`).join('')}
            </div>
            <p class="sub" style="margin:0;">Vd: =A1+B2-C1/G2*D2 — bấm vào 1 ô khác trong bảng (Tiền/Chữ/Ngày tháng) để chèn toạ độ ô đó.</p>
          `}
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilcm-cancel">Huỷ</button>
            <button type="button" class="btn btn-primary btn-sm preview-allow" id="ilcm-save">Lưu</button>
          </div>
        </div>`;
      if(unbindDrag) unbindDrag();
      unbindDrag = ilMakeDraggable(panel, panel.querySelector('#ilcm-handle'));
      panel.querySelector('#ilcm-x').onclick = close;
      panel.querySelector('#ilcm-cancel').onclick = close;
      panel.querySelector('#ilcm-tab-lit').onclick = ()=>{ tab='literal'; render(); };
      panel.querySelector('#ilcm-tab-f').onclick = ()=>{ tab='formula'; render(); };
      if(tab==='literal'){
        ilWireInlineMoneyDisp(panel.querySelector('#ilcm-lit-input'), panel.querySelector('#ilcm-disp'), IL_MAX.moneyDigits);
      } else {
        const fInput = panel.querySelector('#ilcm-f-input');
        panel.querySelectorAll('[data-ilcm-op]').forEach(btn=> btn.onclick = ()=>{
          const op = btn.dataset.ilcmOp==='×'?'*':btn.dataset.ilcmOp==='÷'?'/':btn.dataset.ilcmOp;
          const pos = fInput.selectionStart||fInput.value.length;
          fInput.value = fInput.value.slice(0,pos)+op+fInput.value.slice(pos);
          fInput.focus(); fInput.setSelectionRange(pos+1,pos+1);
        });
        if(pickHandler) tableEl.removeEventListener('mousedown', pickHandler, true);
        // Trong lúc đang ở tab "Gắn công thức": bấm vào BẤT KỲ ô nào khác trong bảng (Tiền/Chữ/
        // Ngày tháng) đều KHÔNG mở modal/sửa ô đó — chỉ chèn toạ độ ô đó vào công thức.
        pickHandler = (e)=>{
          const target = e.target;
          const isPickable = target.classList && (target.classList.contains('ilae-cell-view') || target.classList.contains('ilae-cell-text') || target.classList.contains('ilae-cell-date'));
          if(isPickable && !(target.dataset.ri===String(rowIdx) && target.dataset.ck===colKey)){
            e.preventDefault(); e.stopPropagation();
            const ref = ilColLetter(ap.columns.findIndex(c=>c.key===target.dataset.ck)) + (parseInt(target.dataset.ri,10)+1);
            const pos = fInput.selectionStart||fInput.value.length;
            fInput.value = fInput.value.slice(0,pos)+ref+fInput.value.slice(pos);
            fInput.focus(); fInput.setSelectionRange(pos+ref.length,pos+ref.length);
          }
        };
        tableEl.addEventListener('mousedown', pickHandler, true);
      }
      panel.querySelector('#ilcm-save').onclick = ()=>{
        if(tab==='literal'){
          const digits = panel.querySelector('#ilcm-lit-input').value.replace(/[^\d]/g,'');
          ap.rows[rowIdx][colKey] = digits;
        } else {
          const fVal = panel.querySelector('#ilcm-f-input').value.trim();
          if(!ilFormulaValid(fVal)){ alert('Công thức không hợp lệ — chỉ cho phép toạ độ ô (vd A1), số, và các phép + − × ÷ ( ), không được thiếu/thừa dấu toán học.'); return; }
          ap.rows[rowIdx][colKey] = '='+fVal.replace(/^=/,'');
        }
        close();
        onSaved();
      };
    }
    render();
    // Đo kích thước THẬT rồi tính toạ độ giữa màn hình — làm SAU render() đầu tiên để lấy đúng
    // offsetWidth/offsetHeight (phụ thuộc nội dung tab đang mở), rồi mới hiện ra (visibility).
    panel.style.left = Math.max(8, (window.innerWidth - panel.offsetWidth)/2) + 'px';
    panel.style.top = Math.max(8, (window.innerHeight - panel.offsetHeight)/2) + 'px';
    panel.style.visibility = 'visible';
  }

  // =====================================================================
  // PHỤ LỤC — tối đa 1/dòng, cột tự do (Chữ/Tiền/Ngày tháng), 1 cột tiền quyết định số
  // tiền chung, sắp xếp cột/dòng, xoá phụ lục.
  // =====================================================================
  function ilDefaultAppendixColumns(){
    return [ { key: ilNewId('c'), label:'Nội dung', type:'text', showTotal:true }, { key: ilNewId('c'), label:'Số tiền', type:'money', showTotal:true } ];
  }
  // Sắp xếp lại cột/dòng KHÔNG được làm đổi kết quả của ô đang gắn công thức (y như Excel) — nên
  // trước khi thực sự di chuyển vị trí, phải viết lại mọi công thức theo đúng vị trí MỚI của từng
  // ô nó đang tham chiếu tới. colSortDraft/rowSortDraft là thứ tự MỚI (colSortDraft: mảng key theo
  // đúng thứ tự mới; rowSortDraft: mảng chỉ số DÒNG CŨ theo đúng thứ tự mới).
  function ilRemapFormulasForReorder(ap, colSortDraft, rowSortDraft){
    const oldColKeys = ap.columns.map(c=>c.key);
    const newLetterByOldColIdx = oldColKeys.map(key=> ilColLetter(colSortDraft.indexOf(key)));
    const newRowNumByOldRowIdx = {};
    rowSortDraft.forEach((oldIdx, newIdx)=>{ newRowNumByOldRowIdx[oldIdx] = newIdx+1; });
    ap.rows.forEach(row=>{
      ap.columns.forEach(col=>{
        if(col.type!=='money') return;
        const raw = String(row[col.key] ?? '');
        if(!raw.startsWith('=')) return;
        const newBody = raw.slice(1).replace(/([A-Za-z]+)(\d+)/g, (m,L,R)=>{
          const oldCi = L.toUpperCase().charCodeAt(0)-65;
          const oldRi = parseInt(R,10)-1;
          const newLetter = newLetterByOldColIdx[oldCi];
          const newRowNum = newRowNumByOldRowIdx[oldRi];
          return (newLetter!=null && newRowNum!=null) ? (newLetter+newRowNum) : m;
        });
        row[col.key] = '='+newBody;
      });
    });
  }
  function renderInternalAppendixEditorModal(ledger, entry, el){
    entry.appendix = entry.appendix || { id: ilNewId('ila'), title: ilGenerateAppendixName(ledger, entry.type), designatedKey:null, columns: ilDefaultAppendixColumns(), rows:[] };
    const ap = entry.appendix;
    const canEdit = ilCanEditLedger(ledger);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    let sortingLayout = false;
    let rowSortDraft = null, colSortDraft = null;
    let openMoneyModalClose = null; // chỉ cho mở 1 modal ô tiền duy nhất tại 1 thời điểm
    function syncEntryAmountIfNeeded(){
      if(entry.amountMode==='appendix') entry.amount = ilAppendixDesignatedTotal(ap);
    }
    function orderedCols(){ return (sortingLayout && colSortDraft) ? colSortDraft.map(k=>ap.columns.find(c=>c.key===k)).filter(Boolean) : ap.columns; }
    function orderedRowsIdx(){ return (sortingLayout && rowSortDraft) ? rowSortDraft : ap.rows.map((_,i)=>i); }
    function readColLabelsIntoAp(){
      wrap.querySelectorAll('.ilae-col-label').forEach(inp=>{ const col = ap.columns.find(c=>c.key===inp.dataset.ck); if(col) col.label = inp.value; });
    }
    function render(){
      const cols = orderedCols();
      const rowsIdx = orderedRowsIdx();
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
          <div class="modal-head"><h3>📎 Phụ lục — ${escapeHtml(entry.content||'')}</h3><button class="modal-close" id="ilae-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:14px;">
            <div class="field"><label>Tên phụ lục * <span class="sub">(tối đa ${IL_MAX.title} ký tự — không được trùng với phụ lục khác trong sổ này)</span></label><input type="text" id="ilae-title" maxlength="${IL_MAX.title}" value="${escapeHtml(ap.title||'')}" ${canEdit?'':'disabled'}></div>
            ${sortingLayout? `<div style="margin-bottom:10px; display:flex; gap:8px;">
              <button type="button" class="btn btn-primary btn-sm preview-allow" id="ilae-sort-save">💾 Lưu thứ tự</button>
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilae-sort-cancel">Huỷ</button>
            </div><p class="sub">Kéo biểu tượng ☰ ở hàng A/B/C (cột) hoặc ở từng dòng để đổi vị trí.</p>` : ''}
            <div class="table-wrap"><table id="ilae-table">
              <thead>
                <tr>
                  ${canEdit && !sortingLayout? `<th></th>` : ''}<th></th>
                  ${cols.map((c,ci)=>`<th data-col-key="${c.key}" style="text-align:center; ${sortingLayout?'cursor:grab;':''}" ${sortingLayout? `draggable="true" data-drag-col="${c.key}"` : ''}>${sortingLayout? '☰' : ilColLetter(ci)}</th>`).join('')}
                </tr>
                <tr>
                  ${canEdit && !sortingLayout? `<th></th>` : ''}<th></th>
                  ${cols.map(c=>`<th>
                    ${!sortingLayout? `<div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-bottom:3px;">
                      <select class="ilae-col-type" data-ck="${c.key}" ${canEdit?'':'disabled'}><option value="text" ${c.type==='text'?'selected':''}>Chữ</option><option value="money" ${c.type==='money'?'selected':''}>Tiền</option><option value="date" ${c.type==='date'?'selected':''}>Ngày tháng</option></select>
                      ${c.type==='money' && canEdit? `<button type="button" class="btn-plain-icon preview-allow ilae-col-star" data-ck="${c.key}" title="${ap.designatedKey===c.key?'Đang là cột quyết định — bấm để bỏ chọn':'Chọn làm cột quyết định số tiền chung'}" style="background:none; border:none; cursor:pointer; font-size:15px;">${ap.designatedKey===c.key?'⭐':'☆'}</button>` : ''}
                      ${canEdit? `<button type="button" class="btn-plain-icon preview-allow ilae-col-del" data-ck="${c.key}" title="Xoá cột" style="background:none; border:none; cursor:pointer;" ${ap.columns.length<=1?'disabled':''}>🗑️</button>` : ''}
                    </div>` : ''}
                    <input type="text" class="ilae-col-label" data-ck="${c.key}" maxlength="${IL_MAX.colLabel}" value="${escapeHtml(c.label)}" style="width:100%; font-weight:700; border:1px solid var(--line); border-radius:4px; padding:3px 5px;" ${canEdit && !sortingLayout?'':'disabled'}>
                  </th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${rowsIdx.map((ri,displayIdx)=>{ const r = ap.rows[ri]; return `<tr${sortingLayout? ` draggable="true" data-drag-row="${ri}"` : ''}>
                  ${canEdit && !sortingLayout? `<td style="text-align:center;"><button type="button" class="btn-plain-icon preview-allow ilae-row-del" data-ri="${ri}" title="Xoá dòng" style="background:none; border:none; cursor:pointer;">🗑️</button></td>` : ''}
                  <td style="text-align:center; font-weight:700; background:var(--paper-2); ${sortingLayout?'cursor:grab;':''}">${sortingLayout? '☰' : displayIdx+1}</td>
                  ${cols.map(c=>{
                    const raw = r[c.key]!=null? String(r[c.key]) : '';
                    if(c.type==='money'){
                      const isFormula = raw.startsWith('=');
                      const displayVal = isFormula? moneySpaced(ilCellComputed(ap, ri, c.key)) : (raw? moneySpaced(raw) : '');
                      return `<td style="text-align:right;"><span class="ilae-cell-view" data-ri="${ri}" data-ck="${c.key}" style="display:inline-block; min-width:70px; padding:4px 6px; border:1px solid var(--line); border-radius:5px; cursor:${canEdit?'pointer':'default'}; ${isFormula?'background:#ede7f6; font-style:italic;':'background:#fff;'}" title="${isFormula? 'Công thức: '+raw : ''}">${displayVal||'—'}</span></td>`;
                    }
                    if(c.type==='date') return `<td><input type="date" class="ilae-cell-date" data-ri="${ri}" data-ck="${c.key}" value="${escapeHtml(raw)}" style="width:100%;" ${canEdit?'':'disabled'}></td>`;
                    return `<td><input type="text" class="ilae-cell-text" data-ri="${ri}" data-ck="${c.key}" maxlength="${IL_MAX.cellText}" value="${escapeHtml(raw)}" style="width:100%;" ${canEdit?'':'disabled'}></td>`;
                  }).join('')}
                </tr>`; }).join('')}
                ${!sortingLayout? `<tr id="ilae-totals-row" style="font-weight:700; background:var(--paper-2);">
                  ${canEdit? `<td></td>` : ''}<td>Tổng</td>
                  ${cols.map(c=>{
                    if(c.type!=='money') return '<td></td>';
                    const isDesignated = ap.designatedKey===c.key;
                    const hidden = !isDesignated && c.showTotal===false;
                    const total = ilAppendixColumnTotal(ap, c.key);
                    return `<td style="text-align:right; cursor:${isDesignated?'default':'pointer'}; ${isDesignated? 'background:#b71c1c; color:#fff; font-weight:800;' : ''}" class="ilae-total-cell" data-ck="${c.key}">${hidden? `<span class="sub" style="font-weight:400;">(đang ẩn — bấm để hiện)</span>` : moneySpaced(total)}</td>`;
                  }).join('')}
                </tr>` : ''}
              </tbody>
            </table></div>
            ${canEdit && !sortingLayout? `<div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilae-col-add">➕ Thêm cột</button>
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilae-row-add">➕ Thêm dòng</button>
              ${(ap.columns.length>1 || ap.rows.length>1)? `<button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilae-sort-start">🔀 Sắp xếp cột và dòng</button>` : ''}
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="ilae-del-appendix" style="margin-left:auto; color:var(--red);">🗑️ Xoá phụ lục</button>
            </div>` : ''}
            <p id="ilae-designated-line" class="sub" style="margin-top:12px;">${ap.designatedKey? `Cột quyết định số tiền chung: <b><span id="ilae-dg-name">${escapeHtml((ap.columns.find(c=>c.key===ap.designatedKey)||{}).label||'')}</span></b> = <b><span id="ilae-dg-amount">${moneySpaced(ilAppendixDesignatedTotal(ap))}</span></b>${entry.amountMode==='appendix'? ' (đang đồng bộ với số tiền dòng '+(entry.type==='thu'?'thu':'chi')+')' : ''} - Bấm vào dấu ☆ ở các Cột (thuộc loại Tiền) để chọn cột quyết định số tiền chung` : 'Chưa chọn cột quyết định số tiền chung - Bấm vào dấu ☆ ở các Cột (thuộc loại Tiền) để chọn cột quyết định số tiền chung'}</p>
          </div>
          <div class="modal-foot">
            ${canEdit && sortingLayout? '' : (canEdit? `<button class="btn btn-ghost" id="ilae-cancel">Huỷ</button><button class="btn btn-primary" id="ilae-save">💾 Lưu phụ lục</button>` : `<button class="btn btn-ghost" id="ilae-cancel">Đóng</button>`)}
          </div>
        </div>`;
      const close = ()=> wrap.remove();
      wrap.querySelector('#ilae-close').onclick = close;
      const cancelBtn = wrap.querySelector('#ilae-cancel'); if(cancelBtn) cancelBtn.onclick = close;
      wrap.querySelectorAll('.ilae-cell-view').forEach(span=> span.onclick = ()=>{
        if(!canEdit || openMoneyModalClose) return; // đang có 1 modal ô tiền khác mở sẵn -> phải đóng nó trước
        openMoneyModalClose = true;
        renderMoneyCellModal(ap, +span.dataset.ri, span.dataset.ck, wrap.querySelector('#ilae-table'),
          ()=>{ syncEntryAmountIfNeeded(); render(); },
          ()=>{ openMoneyModalClose = null; });
      });
      wrap.querySelectorAll('.ilae-cell-text, .ilae-cell-date').forEach(inp=> inp.addEventListener('input', ()=>{ ap.rows[+inp.dataset.ri][inp.dataset.ck] = inp.value; }));
      wrap.querySelectorAll('.ilae-col-label').forEach(inp=> inp.addEventListener('input', ()=>{
        const col = ap.columns.find(c=>c.key===inp.dataset.ck);
        if(col) col.label = inp.value;
        if(ap.designatedKey===inp.dataset.ck){
          const nameEl = wrap.querySelector('#ilae-dg-name');
          if(nameEl) nameEl.textContent = inp.value;
        }
      }));
      wrap.querySelectorAll('.ilae-col-type').forEach(sel=> sel.onchange = ()=>{ readColLabelsIntoAp(); const col = ap.columns.find(c=>c.key===sel.dataset.ck); col.type = sel.value; if(sel.value!=='money' && ap.designatedKey===col.key){ ap.designatedKey=null; if(entry.amountMode==='appendix') entry.amount=0; } syncEntryAmountIfNeeded(); render(); });
      wrap.querySelectorAll('.ilae-col-star').forEach(btn=> btn.onclick = ()=>{
        readColLabelsIntoAp();
        const col = ap.columns.find(c=>c.key===btn.dataset.ck);
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
        readColLabelsIntoAp();
        col.showTotal = col.showTotal===false ? true : false;
        render();
      });
      if(canEdit && !sortingLayout){
        const colAddBtn = wrap.querySelector('#ilae-col-add'); if(colAddBtn) colAddBtn.onclick = ()=>{ readColLabelsIntoAp(); ap.columns.push({ key: ilNewId('c'), label:'Cột mới', type:'text', showTotal:true }); render(); };
        wrap.querySelectorAll('.ilae-col-del').forEach(btn=> btn.onclick = ()=>{
          if(ap.columns.length<=1) return;
          readColLabelsIntoAp();
          const col = ap.columns.find(c=>c.key===btn.dataset.ck);
          if(ap.designatedKey===col.key){ ap.designatedKey=null; if(entry.amountMode==='appendix') entry.amount=0; }
          ap.columns = ap.columns.filter(c=>c.key!==col.key);
          ap.rows.forEach(r=>{ delete r[col.key]; });
          render();
        });
        const rowAddBtn = wrap.querySelector('#ilae-row-add'); if(rowAddBtn) rowAddBtn.onclick = ()=>{ readColLabelsIntoAp(); ap.rows.push({}); render(); };
        wrap.querySelectorAll('.ilae-row-del').forEach(btn=> btn.onclick = ()=>{ readColLabelsIntoAp(); ap.rows.splice(+btn.dataset.ri,1); render(); });
        const sortStartBtn = wrap.querySelector('#ilae-sort-start');
        if(sortStartBtn) sortStartBtn.onclick = ()=>{ readColLabelsIntoAp(); sortingLayout = true; colSortDraft = ap.columns.map(c=>c.key); rowSortDraft = ap.rows.map((_,i)=>i); render(); };
        const delApBtn = wrap.querySelector('#ilae-del-appendix');
        if(delApBtn) delApBtn.onclick = ()=>{
          const msg = entry.amountMode==='appendix'
            ? `⚠️ Phụ lục này đang quyết định số tiền của dòng ${entry.type==='thu'?'thu':'chi'} mà nó thuộc về (hiện là ${moneySpaced(entry.amount)}). Nếu xoá, số tiền dòng này sẽ về 0 đ, cho đến khi đồng chí tạo một phụ lục mới và chọn lại cột quyết định. Đồng chí có chắc chắn muốn xoá phụ lục này không?`
            : 'Xoá phụ lục này?';
          if(!confirm(msg)) return;
          if(entry.amountMode==='appendix') entry.amount = 0;
          entry.appendix = null;
          ilSaveLedger(ledger); close();
          renderInternalLedgerMain(el);
        };
        const saveBtn = wrap.querySelector('#ilae-save');
        if(saveBtn) saveBtn.onclick = ()=>{
          readColLabelsIntoAp();
          const title = wrap.querySelector('#ilae-title').value.trim();
          if(!title){ alert('Vui lòng đặt tên cho phụ lục.'); return; }
          const dup = ledger.entries.some(e=> e.id!==entry.id && e.appendix && e.appendix.title===title);
          if(dup){ alert('Tên phụ lục này đã được dùng ở một dòng khác trong sổ — vui lòng đặt tên khác.'); return; }
          ap.title = title;
          syncEntryAmountIfNeeded();
          ilSaveLedger(ledger); close();
          renderInternalLedgerMain(el);
        };
      }
      if(sortingLayout){
        const saveSortBtn = wrap.querySelector('#ilae-sort-save');
        if(saveSortBtn) saveSortBtn.onclick = ()=>{
          ilRemapFormulasForReorder(ap, colSortDraft, rowSortDraft);
          ap.columns = colSortDraft.map(k=>ap.columns.find(c=>c.key===k)).filter(Boolean);
          const newRows = rowSortDraft.map(ri=>ap.rows[ri]);
          ap.rows = newRows;
          sortingLayout = false; colSortDraft=null; rowSortDraft=null;
          render();
        };
        const cancelSortBtn = wrap.querySelector('#ilae-sort-cancel');
        if(cancelSortBtn) cancelSortBtn.onclick = ()=>{ sortingLayout=false; colSortDraft=null; rowSortDraft=null; render(); };
        wireDragReorderHorizontalWithIndicator(
          Array.from(wrap.querySelectorAll('[data-drag-col]')),
          th=> th.dataset.dragCol,
          (draggedKey, targetKey, before)=>{
            const arr = colSortDraft.filter(k=>k!==draggedKey);
            let idx = arr.indexOf(targetKey);
            if(!before) idx += 1;
            arr.splice(idx, 0, draggedKey);
            colSortDraft = arr;
            render();
          }
        );
        wireDragReorderWithIndicator(
          Array.from(wrap.querySelectorAll('[data-drag-row]')),
          tr=> tr.dataset.dragRow,
          (draggedRi, targetRi, before)=>{
            draggedRi = +draggedRi; targetRi = +targetRi;
            const arr = rowSortDraft.filter(ri=>ri!==draggedRi);
            let idx = arr.indexOf(targetRi);
            if(!before) idx += 1;
            arr.splice(idx, 0, draggedRi);
            rowSortDraft = arr;
            render();
          }
        );
      }
    }
    document.body.appendChild(wrap);
    render();
  }
  // Biến thể NGANG của wireDragReorderWithIndicator (hàm gốc chỉ kéo-thả theo chiều dọc,
  // dùng toạ độ Y) — dùng để kéo-thả đổi vị trí các CỘT ngay trên hàng tiêu đề A/B/C.
  function getDragIndicatorLineV(){
    let line = document.getElementById('__dragIndicatorLineV');
    if(!line){
      line = document.createElement('div');
      line.id = '__dragIndicatorLineV';
      line.style.cssText = 'position:fixed; width:3px; background:#0d3b78; z-index:99999; pointer-events:none; display:none; border-radius:2px; box-shadow:0 0 5px rgba(13,59,120,.7);';
      document.body.appendChild(line);
    }
    return line;
  }
  function showDragIndicatorV(targetEl, before){
    const line = getDragIndicatorLineV();
    const rect = targetEl.getBoundingClientRect();
    line.style.top = rect.top+'px';
    line.style.height = rect.height+'px';
    line.style.left = (before? rect.left-2 : rect.right-2)+'px';
    line.style.display = 'block';
  }
  function hideDragIndicatorV(){ const line = document.getElementById('__dragIndicatorLineV'); if(line) line.style.display='none'; }
  function wireDragReorderHorizontalWithIndicator(cells, getKey, onReorder){
    let draggedEl = null, draggedKey = null;
    cells.forEach(cell=>{
      cell.addEventListener('dragstart', (e)=>{
        draggedEl = cell; draggedKey = getKey(cell); cell.style.opacity='0.4';
        if(e.dataTransfer && e.dataTransfer.setDragImage){
          const ghost = document.createElement('div');
          ghost.textContent = '⠿';
          ghost.style.cssText = 'position:fixed; top:-1000px; left:-1000px; padding:6px 10px; background:#212121; color:#fff; border:2px solid #fff; border-radius:8px; font-size:13px; font-weight:700;';
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 10, 10);
          setTimeout(()=> ghost.remove(), 0);
        }
      });
      cell.addEventListener('dragend', ()=>{ if(draggedEl) draggedEl.style.opacity=''; draggedEl=null; draggedKey=null; hideDragIndicatorV(); });
      cell.addEventListener('dragover', (e)=>{
        e.preventDefault();
        if(!draggedKey || cell===draggedEl){ hideDragIndicatorV(); return; }
        const rect = cell.getBoundingClientRect();
        const before = (e.clientX - rect.left) < rect.width/2;
        showDragIndicatorV(cell, before);
        cell.dataset.__dragBeforeV = before? '1':'0';
      });
      cell.addEventListener('drop', (e)=>{
        e.preventDefault();
        hideDragIndicatorV();
        const targetKey = getKey(cell);
        if(!draggedKey || draggedKey===targetKey) return;
        const before = cell.dataset.__dragBeforeV==='1';
        onReorder(draggedKey, targetKey, before);
      });
    });
  }

  // =====================================================================
  // XUẤT/IN — luôn hỏi "kèm/không kèm tên Cơ quan" trước (mặc định Không kèm).
  // =====================================================================
  function ilAskOrgHeaderChoice(onChoice){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:480px;">
        <div class="modal-head"><h3>In / Xuất file</h3><button class="modal-close" id="ilh-close">✕</button></div>
        <div class="modal-body">
          <p class="sub">Chọn cách hiển thị phần đầu tài liệu:</p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button type="button" class="btn btn-primary preview-allow" id="ilh-no">1. Không kèm tên Cơ quan</button>
            <button type="button" class="btn btn-ghost preview-allow" id="ilh-yes">2. Kèm theo tên Cơ quan</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#ilh-close').onclick = close;
    wrap.querySelector('#ilh-no').onclick = ()=>{ close(); onChoice(false); };
    wrap.querySelector('#ilh-yes').onclick = ()=>{ close(); onChoice(true); };
  }
  function ilStartExport(ledger, kind, appendixEntry){
    renderInternalExcelModal(ledger, kind, appendixEntry);
  }
  function ilAoaLedger(ledger, type){
    const isThu = type==='thu';
    const headers = ['Ngày','Nội dung '+(isThu?'thu':'chi'),'Số tiền','Người '+(isThu?'thu':'chi'),'Ghi chú','Phụ lục đi kèm'];
    const list = ilEntriesOfType(ledger, type);
    const dataRows = list.map(e=>[ fmtDate(e.date), e.content||'', e.amount||0, e.person||'', e.note||'', e.appendix? ilAppendixDisplayTitle(e) : '' ]);
    const totalRow = ['TỔNG', '', list.reduce((s,e)=>s+(parseInt(e.amount,10)||0),0), '', '', ''];
    return { headers, rows: [totalRow, ...dataRows], columns: [{type:'date'},{type:'text'},{type:'money'},{type:'text'},{type:'text'},{type:'text'}], moneyColIndex:2, isLedger:true, entries:list };
  }
  function ilAoaAppendix(entry){
    const ap = entry.appendix;
    const headers = ap.columns.map(c=>c.label);
    const formulaCells = [];
    const rows = ap.rows.map((r,ri)=> ap.columns.map((c,ci)=>{
      if(c.type==='money'){
        const raw = String(r[c.key]??'');
        if(raw.startsWith('=')) formulaCells.push({ ri, ci, body: raw.slice(1) });
        return ilCellComputed(ap, ri, c.key);
      }
      if(c.type==='date') return r[c.key]!=null? r[c.key] : '';
      return r[c.key]!=null? r[c.key] : '';
    }));
    // Cột tiền đang bị ẩn tổng (và không phải cột quyết định) -> để TRỐNG thật ở dòng Tổng, đồng bộ
    // với màn hình sửa phụ lục (ẩn ở đâu thì ẩn luôn ở xem trước/in/xuất Excel).
    const totalRow = ap.columns.map(c=>{
      if(c.type!=='money') return ap.columns[0]===c?'TỔNG':'';
      const hidden = ap.designatedKey!==c.key && c.showTotal===false;
      return hidden ? '' : ilAppendixColumnTotal(ap, c.key);
    });
    return { headers, rows:[...rows, totalRow], columns: ap.columns.map(c=>({type:c.type, showTotal:c.showTotal, isDesignated: ap.designatedKey===c.key})), formulaCells, isAppendix:true, title: ilAppendixDisplayTitle(entry) };
  }
  function ilRelatedAppendixSections(ledger, type){
    const types = type? [type] : ['thu','chi'];
    const sections = [];
    types.forEach(t=>{
      ilEntriesOfType(ledger, t).forEach(e=>{ if(e.appendix) sections.push({ title: e.appendix.title, ...ilAoaAppendix(e) }); });
    });
    return sections;
  }
  function ilAllSections(ledger){
    const sections = [{ title:'Tổng quan', headers:['Chỉ tiêu','Số tiền'], rows:[
      ['Tổng Thu', ilTotalOfType(ledger,'thu')], ['Tổng Chi', ilTotalOfType(ledger,'chi')], ['Còn lại', ilTotalOfType(ledger,'thu')-ilTotalOfType(ledger,'chi')],
    ], columns:[{type:'text'},{type:'money'}], isOverview:true }];
    const thuSec = ilAoaLedger(ledger,'thu'); thuSec.title='Sổ Thu'; sections.push(thuSec);
    const chiSec = ilAoaLedger(ledger,'chi'); chiSec.title='Sổ Chi'; sections.push(chiSec);
    sections.push(...ilRelatedAppendixSections(ledger, null));
    return sections;
  }
  function renderInternalExcelModal(ledger, kind, appendixEntry){
    let sections;
    if(kind==='all') sections = ilAllSections(ledger);
    else if(kind==='appendix'){ const sec = ilAoaAppendix(appendixEntry); sec.title = appendixEntry.appendix.title; sections = [sec]; }
    else {
      const sec = ilAoaLedger(ledger, kind); sec.title = kind==='thu'?'Sổ Thu':'Sổ Chi';
      sections = [sec, ...ilRelatedAppendixSections(ledger, kind)];
    }
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    function alignStyle(col){ return col && col.type==='money' ? 'text-align:right;' : ''; }
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:920px;">
        <div class="modal-head"><h3>👁️ Xem trước dạng Excel — ${escapeHtml(ledger.name)}</h3><button class="modal-close" id="ilx-close">✕</button></div>
        <div class="modal-body">
          ${sections.map(sec=>`
            <h4 style="margin:14px 0 6px;">${escapeHtml(sec.title)}</h4>
            <div class="table-wrap"><table>
              <thead><tr>${sec.headers.map(h=>`<th>${escapeHtml(String(h))}</th>`).join('')}</tr></thead>
              <tbody>${sec.rows.length? sec.rows.map(r=>`<tr>${r.map((c,ci)=>`<td style="${alignStyle(sec.columns && sec.columns[ci])}">${typeof c==='number'? escapeHtml(moneySpaced(c)) : escapeHtml(String(c))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${sec.headers.length}">Không có dữ liệu</td></tr>`}</tbody>
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
    wrap.querySelector('#ilx-print').onclick = ()=> ilAskOrgHeaderChoice((withOrg)=> ilPrintSections(ledger, sections, withOrg));
    wrap.querySelector('#ilx-export').onclick = ()=> ilAskOrgHeaderChoice(async (withOrg)=>{
      try{ await ilExportExcel(ledger, sections, withOrg); close(); }
      catch(e){ console.error('[Thu - Chi nội bộ] Lỗi xuất Excel:', e); alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); }
    });
  }
  function ilOrgHeaderLines(includeOrgHeader){
    return includeOrgHeader ? [ ['Sổ tay Công tác Hội Nông dân cấp xã/phường'], ['HỘI NÔNG DÂN'], [wardTitleUpper()], [provinceTitle()] ] : [];
  }
  async function ilExportExcel(ledger, sections, includeOrgHeader){
    await loadOptionalLibrary('xlsx');
    const wb = XLSX.utils.book_new();
    const sheetInfo = {}; // title -> { name, headerLinesLen }
    sections.forEach((sec,i)=>{
      const orgLines = ilOrgHeaderLines(includeOrgHeader);
      const headerLines = [...orgLines, [`SỔ THU – CHI NỘI BỘ: ${ledger.name} — ${sec.title}`], [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`], []];
      const aoa = [...headerLines, sec.headers, ...sec.rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      if(sec.isAppendix) ilFormatAppendixSheet(ws, sec.columns, headerLines.length);
      else applyExcelCellFormatting(ws, aoa, headerLines.length);
      boldExcelRow(ws, headerLines.length-1>=0? orgLines.length : 0);
      const lastCol = Math.max(0, sec.headers.length-1);
      ws['!merges'] = headerLines.map((line,r)=> (line.length? {s:{r,c:0}, e:{r,c:lastCol}} : null)).filter(Boolean);
      ws['!cols'] = sec.headers.map(()=>({wch:24}));
      const sheetName = (sec.title||`Sheet${i+1}`).replace(/[\\/?*[\]:]/g,' ').slice(0,31) || `Sheet${i+1}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      sheetInfo[sec.title] = { name: sheetName, headerLinesLen: headerLines.length, sec, ws };
    });
    // Ô TỔNG của Sổ Thu/Sổ Chi -> công thức SUM thật trên đúng cột Số tiền.
    sections.forEach(sec=>{
      if(!sec.isLedger) return;
      const info = sheetInfo[sec.title];
      if(!info || sec.rows.length<2) return;
      const colLetter = XLSX.utils.encode_col(sec.moneyColIndex);
      const dataFirst1 = info.headerLinesLen+3, dataLast1 = info.headerLinesLen+1+sec.rows.length;
      const totalAddr = XLSX.utils.encode_cell({ r: info.headerLinesLen+1, c: sec.moneyColIndex });
      info.ws[totalAddr] = Object.assign({}, info.ws[totalAddr], { t:'n', f: `SUM(${colLetter}${dataFirst1}:${colLetter}${dataLast1})` });
    });
    // Phụ lục: công thức ô + công thức SUM các ô tổng cột tiền.
    sections.forEach(sec=>{
      if(!sec.isAppendix) return;
      const info = sheetInfo[sec.title];
      if(!info) return;
      const dataStartRow0 = info.headerLinesLen+1; // 0-based: ngay sau dòng tiêu đề cột
      (sec.formulaCells||[]).forEach(({ri,ci,body})=>{
        const realFormula = body.replace(/([A-Za-z]+)(\d+)/g, (m,L,R)=>{
          const colIdx = L.toUpperCase().charCodeAt(0)-65;
          const rowIdx = parseInt(R,10)-1;
          return XLSX.utils.encode_cell({ r: dataStartRow0+rowIdx, c: colIdx });
        });
        const addr = XLSX.utils.encode_cell({ r: dataStartRow0+ri, c: ci });
        info.ws[addr] = Object.assign({}, info.ws[addr], { t:'n', f: realFormula });
      });
      const dataRowCount = sec.rows.length-1; // trừ dòng tổng ở cuối
      if(dataRowCount>0){
        sec.columns.forEach((c,ci)=>{
          if(c.type!=='money') return;
          if(!c.isDesignated && c.showTotal===false) return; // tổng cột đang ẩn -> để trống, không gắn công thức SUM ngầm
          const colLetter = XLSX.utils.encode_col(ci);
          const first1 = dataStartRow0+1, last1 = dataStartRow0+dataRowCount;
          const totalRow0 = dataStartRow0+dataRowCount;
          const addr = XLSX.utils.encode_cell({ r: totalRow0, c: ci });
          info.ws[addr] = Object.assign({}, info.ws[addr], { t:'n', f: `SUM(${colLetter}${first1}:${colLetter}${last1})` });
        });
      }
    });
    // Tổng quan: tham chiếu sang Sổ Thu/Sổ Chi (chỉ có khi xuất bảng tổng hợp đầy đủ).
    const overviewSec = sections.find(s=>s.isOverview);
    if(overviewSec){
      const thuInfo = sheetInfo['Sổ Thu'], chiInfo = sheetInfo['Sổ Chi'];
      const ws = sheetInfo['Tổng quan'].ws;
      const base1 = sheetInfo['Tổng quan'].headerLinesLen+2; // dòng "Tổng Thu" (1-based)
      if(thuInfo && thuInfo.sec.rows.length>=2){
        const colLetter = XLSX.utils.encode_col(thuInfo.sec.moneyColIndex);
        const f1 = thuInfo.headerLinesLen+3, l1 = thuInfo.headerLinesLen+1+thuInfo.sec.rows.length;
        const addr = XLSX.utils.encode_cell({ r: base1-1, c: 1 });
        ws[addr] = Object.assign({}, ws[addr], { t:'n', f: `SUM('${thuInfo.name}'!${colLetter}${f1}:${colLetter}${l1})` });
      }
      if(chiInfo && chiInfo.sec.rows.length>=2){
        const colLetter = XLSX.utils.encode_col(chiInfo.sec.moneyColIndex);
        const f1 = chiInfo.headerLinesLen+3, l1 = chiInfo.headerLinesLen+1+chiInfo.sec.rows.length;
        const addr = XLSX.utils.encode_cell({ r: base1, c: 1 });
        ws[addr] = Object.assign({}, ws[addr], { t:'n', f: `SUM('${chiInfo.name}'!${colLetter}${f1}:${colLetter}${l1})` });
      }
      const conLaiAddr = XLSX.utils.encode_cell({ r: base1+1, c: 1 });
      const thuAddr = XLSX.utils.encode_cell({ r: base1-1, c: 1 });
      const chiAddr = XLSX.utils.encode_cell({ r: base1, c: 1 });
      ws[conLaiAddr] = Object.assign({}, ws[conLaiAddr], { t:'n', f: `${thuAddr}-${chiAddr}` });
    }
    XLSX.writeFile(wb, `${(ledger.name||'So-thu-chi-noi-bo').replace(/[^\p{L}\p{N} ]/gu,'')}_${todayStr()}.xlsx`, {cellStyles:true});
  }
  // Định dạng 1 sheet phụ lục theo ĐÚNG loại cột đã khai báo (không dò theo tên cột như
  // applyExcelCellFormatting — vì tên cột ở đây do người dùng tự đặt tuỳ ý).
  function ilFormatAppendixSheet(ws, columns, headerRowIdx0){
    if(!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const FONT = { name:'Times New Roman' };
    for(let r=0; r<=range.e.r; r++) for(let c=0; c<=range.e.c; c++){
      const cell = ws[XLSX.utils.encode_cell({r,c})];
      if(cell){ cell.s = cell.s||{}; cell.s.font = Object.assign({}, cell.s.font, FONT); }
    }
    for(let c=0; c<=range.e.c; c++){
      const hcell = ws[XLSX.utils.encode_cell({r:headerRowIdx0,c})];
      if(hcell){ hcell.s = hcell.s||{}; hcell.s.font = Object.assign({}, hcell.s.font, FONT, {bold:true}); }
    }
    columns.forEach((col,c)=>{
      const align = col.type==='text' ? 'left' : (col.type==='money'||col.type==='date' ? 'right' : 'center');
      for(let r=headerRowIdx0+1; r<=range.e.r; r++){
        const addr = XLSX.utils.encode_cell({r,c});
        const cell = ws[addr];
        if(!cell) continue;
        cell.s = cell.s||{}; cell.s.alignment = Object.assign({}, cell.s.alignment, {horizontal:align});
        if(cell.f) continue; // ô công thức: để Excel tự tính, không ghi đè kiểu số/ngày tĩnh
        if(col.type==='money' && cell.v!=null && cell.v!==''){
          const digits = String(cell.v).replace(/[^\d]/g,'');
          if(digits){ cell.v = parseInt(digits,10); cell.t='n'; cell.z='#,##0'; }
        } else if(col.type==='date' && cell.v){
          const raw = String(cell.v);
          let d,mo,y, m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
          if(m){ [,y,mo,d] = m; cell.v = excelDateSerial(+d,+mo,+y); cell.t='n'; cell.z='dd/mm/yyyy'; }
        }
      }
    });
  }
  function ilPrintSections(ledger, sections, includeOrgHeader){
    const area = document.getElementById('print-area');
    if(!area) return;
    function alignStyle(col){ return col && col.type==='money' ? 'text-align:right;' : ''; }
    const orgHtml = includeOrgHeader ? `
      <div style="text-align:center; font-weight:800; font-size:14px;">Sổ tay Công tác Hội Nông dân cấp xã/phường</div>
      <div style="text-align:center;">
        <div style="font-weight:800; font-size:14px;">${hoiNongDanTitleHtml()}</div>
        <div style="font-size:12.5px;">${escapeHtml(provinceTitle())}</div>
      </div>` : '';
    area.innerHTML = `
      ${orgHtml}
      <div class="print-title" style="margin:10px 0 4px; text-align:center;">SỔ THU – CHI NỘI BỘ: ${escapeHtml(ledger.name)}</div>
      <div style="text-align:center; font-size:12px; margin-bottom:10px;">Thời gian in: ${new Date().toLocaleString('vi-VN')}</div>
      ${sections.map(sec=>`
        <h4 style="margin:14px 0 4px;">${escapeHtml(sec.title)}</h4>
        <table class="print-table">
          <thead><tr>${sec.headers.map(h=>`<th>${escapeHtml(String(h))}</th>`).join('')}</tr></thead>
          <tbody>${sec.rows.length? sec.rows.map(r=>`<tr>${r.map((c,ci)=>`<td style="${alignStyle(sec.columns && sec.columns[ci])}">${typeof c==='number'? escapeHtml(moneySpaced(c)) : escapeHtml(String(c))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${sec.headers.length}">Không có dữ liệu</td></tr>`}</tbody>
        </table>`).join('')}
      <div style="text-align:center; margin-top:18px; font-size:11px;">https://hoinongdan.sotay.org</div>`;
    area.classList.add('landscape');
    const prevTitle = document.title;
    if(!includeOrgHeader) document.title = '';
    window.print();
    setTimeout(()=>{ area.classList.remove('landscape'); document.title = prevTitle; }, 800);
  }

  // =====================================================================
  // THÊM NHANH BẰNG AI — khung chat toàn màn hình + "📋 Hồ sơ đang soạn" dạng bảng
  // tính nháp, đúng khung sườn Sổ vay vốn. modal-foot: Đóng bảng / Tiêu hoá / Thêm
  // vào Sổ (y hệt vị trí nút của modal chat Sổ vay vốn). Không có bộ chọn "bộ não AI".
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
  function ilCommitDraftEntries(ledger, draftEntries){
    let savedCount = 0;
    draftEntries.forEach(e=>{
      if(!e.date || !e.content || !e.amount) return;
      const type = e.type==='thu'?'thu':'chi';
      const id = ilNewId('il');
      ledger.entries.push({ id, type, date:e.date, content:e.content, amountMode:'manual', amount: parseInt(e.amount,10)||0, person: e.person||'', note: e.note||'', appendix:null });
      ilEnsureEntryOrder(ledger); ledger.entryOrder[type].push(id);
      savedCount++;
    });
    ilSaveLedger(ledger);
    return savedCount;
  }
  function renderLedgerQuickAddModal(ledger, el){
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
    function hasAnyUserContent(){ return messages.some(m=>m.role==='user') || pendingAttachments.length>0; }
    function render(){
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
                <button id="lqai-send-btn">➤</button>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="lqai-close2">Đóng bảng</button>
            <button type="button" class="btn btn-sm preview-allow" id="lqai-digest" ${(busy || !hasAnyUserContent())?'disabled':''} style="background:linear-gradient(180deg, #ffffff 0%, #7c4dff 45%, #4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700; ${(busy||!hasAnyUserContent())?'opacity:.5;':''}">${busy?'⏳ AI đang xử lý...':'🧠 Tiêu hoá tài liệu bằng AI'}</button>
            <button class="btn btn-primary preview-allow" id="lqai-add" ${!draft.entries.length?'disabled':''} style="${!draft.entries.length?'opacity:.45; cursor:not-allowed;':'display:inline-block; animation: bigMoneyPulse 1.4s ease-in-out infinite;'}">➕ Thêm vào Sổ</button>
          </div>
        </div>`;
      wrap.querySelector('#lqai-close').onclick = close;
      wrap.querySelector('#lqai-close2').onclick = close;
      wrap.querySelectorAll('[data-bubble-delete]').forEach(btn=> btn.onclick = ()=>{ messages.splice(+btn.dataset.bubbleDelete,1); render(); });
      wrap.querySelector('#lqai-view-file').onclick = ()=> renderLqaiDraftModal(draft, ()=> render(), ledger, el);
      wrap.querySelector('#lqai-add').onclick = ()=>{
        if(!draft.entries.length) return;
        const savedCount = ilCommitDraftEntries(ledger, draft.entries);
        draft.entries = [];
        closeImmediate();
        if(el) renderInternalLedgerMain(el);
        showBigToast(`Đã thêm ${savedCount} dòng vào Sổ Thu - Chi nội bộ!`);
      };
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
  // y hệt khung sườn renderQuickAddFilePreviewModal của Sổ vay vốn. Sửa/thêm dòng được
  // NGAY LẬP TỨC, không cần đã tiêu hoá tài liệu bằng AI trước.
  function renderLqaiDraftModal(draft, onClose, ledger, el){
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
                    if(k==='amount') return `<td style="${cellStyle}"><input type="text" inputmode="numeric" data-lqd-ri="${ri}" data-lqd-k="${k}" value="${escapeHtml(rawVal==='0'?'':rawVal)}" placeholder="Chỉ nhập số" style="${inputBaseStyle} text-align:right;"></td>`;
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
      wrap.querySelectorAll('[data-lqd-k="amount"]').forEach(inp=>{ attachMoneyInputMask(inp, IL_MAX.moneyDigits); ilAttachFloatingMoneyPreviewLegacy(inp); });
      const editStartBtn = wrap.querySelector('#lqd-edit-start'); if(editStartBtn) editStartBtn.onclick = ()=>{ editMode = true; render(); };
      const editCancelBtn = wrap.querySelector('#lqd-edit-cancel'); if(editCancelBtn) editCancelBtn.onclick = ()=>{ editMode = false; render(); };
      const editSaveBtn = wrap.querySelector('#lqd-edit-save'); if(editSaveBtn) editSaveBtn.onclick = ()=>{ readFormIntoDraft(); editMode = false; render(); };
      const addRowBtn = wrap.querySelector('#lqd-add-row'); if(addRowBtn) addRowBtn.onclick = ()=>{ readFormIntoDraft(); draft.entries.push({ type:'thu', date: todayStr(), content:'', amount:'', person:'', note:'' }); render(); };
      wrap.querySelectorAll('.lqd-row-del').forEach(btn=> btn.onclick = ()=>{ readFormIntoDraft(); draft.entries.splice(+btn.dataset.ri,1); render(); });
      const saveAllBtn = wrap.querySelector('#lqd-save-all');
      if(saveAllBtn) saveAllBtn.onclick = ()=>{
        readFormIntoDraft();
        const savedCount = ilCommitDraftEntries(ledger, draft.entries);
        draft.entries = [];
        close();
        if(el) renderInternalLedgerMain(el);
        showBigToast(`Đã lưu ${savedCount} dòng vào Sổ Thu - Chi nội bộ!`);
      };
    }
    render();
  }
  // Lớp nổi "= x xxx đ" sát ô tiền đang gõ — dùng cho bảng "Hồ sơ đang soạn" (không che
  // các ô khác vì bảng nháp không có bấm-chọn-ô như phụ lục).
  function ilAttachFloatingMoneyPreviewLegacy(input){
    let badge = null;
    function position(){ if(!badge) return; const r = input.getBoundingClientRect(); badge.style.left = r.left+'px'; badge.style.top = Math.max(0, r.top-26)+'px'; }
    function update(){ if(!badge) return; const digits = input.value.replace(/[^\d]/g,''); badge.textContent = digits? `= ${groupDigitsRight(digits,3)} đ` : ''; }
    function show(){ if(badge) return; badge = document.createElement('div'); badge.className = 'il-money-float-badge'; document.body.appendChild(badge); position(); update(); }
    function hide(){ if(badge){ badge.remove(); badge=null; } }
    input.addEventListener('focus', show);
    input.addEventListener('input', ()=>{ update(); position(); });
    input.addEventListener('blur', hide);
  }
