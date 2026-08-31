  // =====================================================================
  // [Drive Hub] — lớp điều hướng metadata của app.
  // Firebase là nơi lưu metadata canonical; Google Drive chỉ được dùng làm
  // liên kết/import/export ở các bước tích hợp sau.
  // =====================================================================
  let driveListenerRef = null;
  let driveListenerPath = '';
  let driveRouteRequest = 0;
  const DRIVE_PERMISSIONS = Object.freeze({
    viewer:{label:'Viewer — chỉ xem'},
    commenter:{label:'Commenter — xem và bình luận'},
    editor:{label:'Editor — được chỉnh sửa'},
  });

  function driveRoute(){
    const match = window.location.pathname.match(/\/(file|folder)\/([^/]+)\/?$/i);
    if(!match) return null;
    const params = new URLSearchParams(window.location.search);
    return {
      type:match[1].toLowerCase(),
      id:decodeURIComponent(match[2]),
      space:params.get('space')==='shared' ? 'shared' : 'personal',
    };
  }
  function driveResourceUrl(node, space=state.driveSpace){
    const type = node.type==='folder' ? 'folder' : 'file';
    return `/${type}/${encodeURIComponent(node.id)}?space=${space}`;
  }
  function driveGoHub(){
    history.pushState({}, '', '/');
    state.activeTab='drive';
    state.driveCurrentFolder=null;
    state.driveSearch='';
    render();
  }
  if(!window.__driveRoutePopstate){
    window.__driveRoutePopstate = true;
    window.addEventListener('popstate', ()=>{ if(state.view==='app'){ state.activeTab='drive'; render(); } });
  }

  function driveRef(){
    if(state.driveSpace==='shared'){
      const wid = wardId();
      return wid ? rtdb.ref(`communes/${wid}/drive_resources`) : null;
    }
    const key = superNotesUserKey();
    return key ? rtdb.ref(`users/${key}/drive_resources`) : null;
  }
  function driveCanEdit(node=null){
    if(isTourMode()) return false;
    if(state.driveSpace==='shared') return drivePermissionForNode(node)==='editor';
    return hasAuthenticatedIdentity();
  }
  function driveDemoTree(){
    return {
      demo_folder:{id:'demo_folder', type:'folder', name:'Tài liệu mẫu', parentId:null, demo:true},
      demo_guide:{id:'demo_guide', type:'link', name:'Hướng dẫn sử dụng app', parentId:'demo_folder', url:'https://hoinongdan.sotay.org/', description:'Liên kết minh hoạ trong môi trường tham quan.', demo:true},
      demo_note:{id:'demo_note', type:'link', name:'Mẫu ghi chú công tác', parentId:null, url:'https://hoinongdan.sotay.org/', description:'Tài nguyên demo — không lưu dữ liệu thật.', demo:true},
    };
  }
  function drivePermissionForNode(node, tree=state.driveResources, space=state.driveSpace){
    if(isTourMode()) return 'viewer';
    if(space==='personal') return hasAuthenticatedIdentity() ? 'editor' : 'none';
    if(!wardId() || !state.config || state.config.deleted) return 'none';
    if(isOwner()) return 'editor';
    const email = state.identity && state.identity.email;
    const key = email ? emailToKey(email) : null;
    let current = node;
    let guard = 0;
    while(current && guard++<30){
      if(key && current.acl && current.acl[key] && DRIVE_PERMISSIONS[current.acl[key].perm]){
        return current.acl[key].perm;
      }
      if(!key && current.guestPerm && DRIVE_PERMISSIONS[current.guestPerm]) return current.guestPerm;
      current = current.parentId ? tree[current.parentId] : null;
    }
    // Guest theo mã được xem tài nguyên chung mặc định; Chủ mã có thể thu hẹp ở từng resource
    // trong các bước ACL server-side tiếp theo.
    return 'viewer';
  }
  function driveCanShare(node){
    return !isTourMode() && state.driveSpace==='shared' && !!node && isOwner();
  }
  function driveCanComment(node, space=state.driveSpace){
    if(isTourMode() || space!=='shared' || !node) return false;
    const permission = drivePermissionForNode(node,state.driveResources,space);
    return permission==='commenter' || permission==='editor';
  }
  function driveCommentId(){
    return 'dc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }
  function driveCommentRef(resourceId){
    return wardId() ? rtdb.ref(`communes/${wardId()}/drive_resources/${resourceId}/comments`) : null;
  }
  async function driveAddComment(resourceId,text){
    const node=state.driveResources[resourceId];
    if(!driveCanComment(node)){ alert('Bạn không có quyền bình luận tài nguyên này.'); return false; }
    const value=(text||'').trim();
    if(!value){ alert('Vui lòng nhập nội dung bình luận.'); return false; }
    const ref=driveCommentRef(resourceId);
    if(!ref) return false;
    const id=driveCommentId();
    await ref.child(id).set({
      id, text:value,
      authorEmail:(state.identity&&state.identity.email)||'',
      authorName:(state.identity&&state.identity.name)||'Người dùng',
      createdAt:new Date().toISOString(),
      deleted:false,
    });
    return true;
  }
  function driveCanDeleteComment(comment){
    if(isTourMode() || !comment) return false;
    const email=state.identity&&state.identity.email;
    return isOwner() || (!!email && String(comment.authorEmail||'').toLowerCase()===String(email).toLowerCase());
  }
  async function driveDeleteComment(resourceId,commentId){
    const node=state.driveResources[resourceId];
    const comment=node && node.comments && node.comments[commentId];
    if(!driveCanDeleteComment(comment)){ alert('Bạn chỉ có thể xoá bình luận của mình.'); return false; }
    const ref=driveCommentRef(resourceId);
    if(!ref) return false;
    await ref.child(commentId).update({deleted:true,deletedAt:new Date().toISOString()});
    return true;
  }
  function driveCommentList(node){
    return Object.values((node&&node.comments)||{})
      .filter(comment=>comment && !comment.deleted)
      .sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  }
  function driveDetach(){
    if(driveListenerRef){ driveListenerRef.off(); driveListenerRef=null; driveListenerPath=''; }
  }
  function driveAttach(){
    if(isTourMode()){
      driveDetach();
      state.driveResources = driveDemoTree();
      return;
    }
    if(state.driveSpace==='personal' && !hasAuthenticatedIdentity()){
      driveDetach();
      state.driveResources = {};
      return;
    }
    const ref = driveRef();
    if(!ref){
      driveDetach();
      state.driveResources = {};
      return;
    }
    const path = ref.toString();
    if(driveListenerRef && driveListenerPath===path) return;
    driveDetach();
    driveListenerRef = ref;
    driveListenerPath = path;
    ref.on('value', snap=>{
      state.driveResources = snap && snap.exists() ? (snap.val()||{}) : {};
      if(state.activeTab==='drive') renderDriveHubTab(document.getElementById('content'));
    });
  }
  function driveNodeId(){ return 'dr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }
  function driveCurrentBreadcrumb(){
    const out = [];
    let id = state.driveCurrentFolder;
    let guard = 0;
    while(id && state.driveResources[id] && guard++<30){
      out.unshift(state.driveResources[id]);
      id = state.driveResources[id].parentId || null;
    }
    return out;
  }
  function driveChildren(){
    const parentId = state.driveCurrentFolder || null;
    const query = (state.driveSearch||'').trim().toLocaleLowerCase('vi');
    return Object.values(state.driveResources||{})
      .filter(n=> n && (state.driveTrashOpen ? n.deleted : !n.deleted) && (n.parentId||null)===parentId)
      .filter(n=> !query || `${n.name||''} ${n.description||''}`.toLocaleLowerCase('vi').includes(query))
      .sort((a,b)=>{ if(a.type!==b.type) return a.type==='folder' ? -1 : 1; return (a.name||'').localeCompare(b.name||'','vi'); });
  }
  async function driveWriteNode(id, node){
    if(blockTourMutation('Bạn đang ở môi trường tham quan. Tài nguyên demo không được lưu.')) return false;
    const parent = state.driveCurrentFolder ? state.driveResources[state.driveCurrentFolder] : null;
    if(!driveCanEdit(parent)){ alert('Bạn không có quyền tạo tài nguyên trong thư mục này.'); return false; }
    const ref = driveRef();
    if(!ref) return false;
    await ref.child(id).set(node);
    return true;
  }
  async function driveUpdateNode(id, partial){
    if(blockTourMutation('Bạn đang ở môi trường tham quan. Tài nguyên demo không được lưu.')) return false;
    const current = state.driveResources[id];
    if(!driveCanEdit(current)){ alert('Bạn không có quyền chỉnh sửa tài nguyên này.'); return false; }
    const ref = driveRef();
    if(!ref) return false;
    await ref.child(id).update(partial);
    return true;
  }
  async function driveCreateFolder(){
    if(!driveCanEdit(state.driveCurrentFolder ? state.driveResources[state.driveCurrentFolder] : null)) return;
    const name = prompt('Tên thư mục mới:');
    if(!name || !name.trim()) return;
    const now = new Date().toISOString();
    const id = driveNodeId();
    await driveWriteNode(id, {id, type:'folder', name:name.trim(), parentId:state.driveCurrentFolder||null, createdAt:now, updatedAt:now, createdBy:(state.identity&&state.identity.email)||'browser'});
    driveAttach(); renderDriveHubTab(document.getElementById('content'));
  }
  async function driveCreateLink(){
    if(!driveCanEdit(state.driveCurrentFolder ? state.driveResources[state.driveCurrentFolder] : null)) return;
    const name = prompt('Tên tài liệu/liên kết:');
    if(!name || !name.trim()) return;
    const rawUrl = prompt('Dán URL https:// của tài liệu:');
    if(!rawUrl || !/^https?:\/\//i.test(rawUrl.trim())){ alert('Chỉ chấp nhận liên kết bắt đầu bằng http:// hoặc https://.'); return; }
    const now = new Date().toISOString();
    const id = driveNodeId();
    await driveWriteNode(id, {id, type:'link', name:name.trim(), url:rawUrl.trim(), parentId:state.driveCurrentFolder||null, createdAt:now, updatedAt:now, createdBy:(state.identity&&state.identity.email)||'browser'});
    driveAttach(); renderDriveHubTab(document.getElementById('content'));
  }
  async function driveRename(id){
    const node = state.driveResources[id];
    if(!driveCanEdit(node)) return;
    const name = prompt('Đổi tên:', node ? node.name : '');
    if(name && name.trim()) await driveUpdateNode(id, {name:name.trim(), updatedAt:new Date().toISOString()});
  }
  async function driveTrash(id){
    if(!driveCanEdit(state.driveResources[id])) return;
    if(!confirm('Đưa tài nguyên này vào thùng rác?')) return;
    await driveUpdateNode(id, {deleted:true, deletedAt:new Date().toISOString(), deletedBy:(state.identity&&state.identity.email)||'browser'});
  }
  async function driveRestore(id){
    if(!driveCanEdit(state.driveResources[id])) return;
    await driveUpdateNode(id, {deleted:false, deletedAt:null, deletedBy:null, updatedAt:new Date().toISOString()});
  }
  function closeDriveShareModal(wrap){ if(wrap) wrap.remove(); }
  function renderDriveShareModal(node){
    if(!driveCanShare(node)){
      alert('Chỉ Chủ mã mới được thay đổi quyền chia sẻ tài liệu trong Kho dùng chung.');
      return;
    }
    const wrap=document.createElement('div');
    wrap.className='modal-bg';
    document.body.appendChild(wrap);
    let acl={...(node.acl||{})};
    const render=()=>{
      wrap.innerHTML=`
        <div class="modal" style="max-width:620px;">
          <div class="modal-head"><h3>🔗 Chia sẻ “${escapeHtml(node.name||'Tài nguyên')}”</h3><button class="modal-close" id="drive-share-close">✕</button></div>
          <div class="modal-body">
            <p class="sub">Quyền áp dụng cho tài nguyên này và các tài nguyên con chưa có quyền riêng. Guest qua mã xã/phường vẫn theo chính sách truy cập chung.</p>
            <div class="drive-share-add">
              <input id="drive-share-email" type="email" placeholder="email@example.com">
              <select id="drive-share-perm">${Object.entries(DRIVE_PERMISSIONS).map(([value,item])=>`<option value="${value}">${item.label}</option>`).join('')}</select>
              <button class="btn btn-primary btn-sm" id="drive-share-add-btn">Thêm</button>
            </div>
            <div class="drive-share-list">
              ${Object.values(acl).length ? Object.entries(acl).map(([key,entry])=>`
                <div class="drive-share-row"><div><b>${escapeHtml(entry.email||key)}</b><span>${escapeHtml((DRIVE_PERMISSIONS[entry.perm]||DRIVE_PERMISSIONS.viewer).label)}</span></div><button class="btn btn-ghost btn-sm" data-drive-share-remove="${key}">Xoá</button></div>`).join('') : `<div class="drive-share-empty">Chưa có người được chia sẻ đích danh.</div>`}
            </div>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost" id="drive-share-cancel">Huỷ</button><button class="btn btn-primary" id="drive-share-save">Lưu quyền chia sẻ</button></div>
        </div>`;
      wrap.querySelector('#drive-share-close').onclick=()=>closeDriveShareModal(wrap);
      wrap.querySelector('#drive-share-cancel').onclick=()=>closeDriveShareModal(wrap);
      wrap.querySelector('#drive-share-add-btn').onclick=()=>{
        const input=wrap.querySelector('#drive-share-email');
        const email=(input.value||'').trim().toLowerCase();
        const perm=wrap.querySelector('#drive-share-perm').value;
        if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){ alert('Vui lòng nhập email hợp lệ.'); return; }
        if(state.config && email===String(state.config.ownerEmail||'').toLowerCase()){ alert('Chủ mã đã có toàn quyền, không cần thêm vào danh sách.'); return; }
        acl[emailToKey(email)]={email,perm,grantedBy:(state.identity&&state.identity.email)||'',grantedAt:new Date().toISOString()};
        render();
      };
      wrap.querySelectorAll('[data-drive-share-remove]').forEach(btn=>btn.onclick=()=>{ delete acl[btn.dataset.driveShareRemove]; render(); });
      wrap.querySelector('#drive-share-save').onclick=async()=>{
        await driveUpdateNode(node.id,{acl,updatedAt:new Date().toISOString()});
        closeDriveShareModal(wrap);
        driveAttach();
        if(driveRoute()) renderDriveResourceRoute(document.getElementById('content'),driveRoute());
        else renderDriveHubTab(document.getElementById('content'));
      };
    };
    render();
  }
  function driveOpenQuickNote(){
    if(isTourMode()){
      alert('Quick Note trong môi trường tham quan chỉ được mở sau khi bạn đăng nhập hoặc tham gia bằng mã xã/phường.');
      return;
    }
    state.superNotesSpace = state.driveSpace==='shared' ? 'shared' : 'personal';
    state._superNotesOpen = true;
    attachSuperNotesRealtime();
    renderSuperNotesOverlay();
  }
  async function driveLoadRouteData(route){
    if(isTourMode()) return driveDemoTree();
    if(route.space==='personal' && !hasAuthenticatedIdentity()) return null;
    if(route.space==='shared' && (!wardId() || !state.config || state.config.deleted)) return null;
    const ref = route.space==='shared'
      ? rtdb.ref(`communes/${wardId()}/drive_resources`)
      : rtdb.ref(`users/${superNotesUserKey()}/drive_resources`);
    try{
      const snap = await ref.get();
      return snap && snap.exists() ? (snap.val()||{}) : {};
    }catch(e){
      console.warn('Không tải được resource URL:', e);
      return null;
    }
  }
  function driveRouteBackButton(){
    return `<button class="btn btn-ghost btn-sm" id="drive-route-back">← Về Trung tâm tài liệu</button>`;
  }
  async function renderDriveResourceRoute(el, route){
    const requestId = ++driveRouteRequest;
    el.innerHTML = `<div class="drive-route-card"><div class="drive-route-loading">Đang kiểm tra quyền truy cập tài nguyên…</div></div>`;
    const tree = await driveLoadRouteData(route);
    if(requestId!==driveRouteRequest) return;
    if(tree) state.driveResources=tree;
    const node = tree && tree[route.id];
    const permission = node ? drivePermissionForNode(node,tree,route.space) : 'none';
    const visible = node && !node.deleted && node.type===(route.type==='folder'?'folder':'link') && permission!=='none';
    if(!visible){
      el.innerHTML = `<div class="drive-route-card"><div class="drive-route-actions">${driveRouteBackButton()}</div><div class="drive-route-denied"><div>🔒</div><h3>Không tìm thấy tài nguyên</h3><p>Tài nguyên không tồn tại hoặc bạn không có quyền xem tài nguyên này.</p></div></div>`;
      const back=document.getElementById('drive-route-back'); if(back) back.onclick=driveGoHub;
      return;
    }
    const children = route.type==='folder'
      ? Object.values(tree).filter(n=>n && !n.deleted && n.parentId===node.id).sort((a,b)=>a.name.localeCompare(b.name,'vi'))
      : [];
    state.driveSpace = route.space;
    const routeSpace = route.space==='shared' ? 'Kho dùng chung' : 'Kho cá nhân';
    const comments = route.space==='shared' ? driveCommentList(node) : [];
    const canComment = driveCanComment(node,route.space);
    el.innerHTML = `
      <div class="drive-route-card">
        <div class="drive-route-actions">${driveRouteBackButton()}<div class="drive-route-action-group"><span class="drive-route-scope">${routeSpace} · ${escapeHtml((DRIVE_PERMISSIONS[permission]||DRIVE_PERMISSIONS.viewer).label)}</span>${driveCanShare(node)?'<button class="btn btn-ghost btn-sm" id="drive-route-share">🔗 Chia sẻ</button>':''}</div></div>
        <div class="drive-route-title"><div class="drive-route-icon">${route.type==='folder'?'📁':'🔗'}</div><div><div class="eyebrow">${route.type==='folder'?'FOLDER':'FILE'}</div><h3>${escapeHtml(node.name||'Không tên')}</h3><p class="sub">${escapeHtml(node.description||'Tài nguyên thuộc Trung tâm tài liệu.')}</p></div></div>
        ${route.type==='folder' ? `
          <div class="drive-route-section"><b>Nội dung thư mục</b>
            ${children.length ? `<div class="drive-route-children">${children.map(child=>`<button class="drive-route-child" data-drive-route-child="${child.id}"><span>${child.type==='folder'?'📁':'🔗'}</span><span>${escapeHtml(child.name||'Không tên')}</span><span>›</span></button>`).join('')}</div>` : `<div class="drive-route-empty">Thư mục này chưa có tài nguyên.</div>`}
          </div>` : `
          <div class="drive-route-section"><b>Liên kết gốc</b><a class="btn btn-primary" href="${escapeHtml(node.url)}" target="_blank" rel="noopener noreferrer">Mở tài liệu gốc ↗</a></div>`}
        ${route.space==='shared' ? `<div class="drive-route-section drive-comments"><div class="drive-comments-head"><b>💬 Bình luận (${comments.length})</b><span class="sub">Viewer có thể đọc · Commenter/Editor có thể thêm</span></div>
          ${comments.length ? `<div class="drive-comment-list">${comments.map(comment=>`<article class="drive-comment"><div class="drive-comment-head"><b>${escapeHtml(comment.authorName||comment.authorEmail||'Người dùng')}</b><time>${escapeHtml(comment.createdAt ? new Date(comment.createdAt).toLocaleString('vi-VN') : '')}</time></div><p>${escapeHtml(comment.text||'')}</p>${driveCanDeleteComment(comment)?`<button class="btn btn-ghost btn-sm" data-drive-comment-delete="${comment.id}">Xoá</button>`:''}</article>`).join('')}</div>` : `<div class="drive-route-empty">Chưa có bình luận.</div>`}
          ${canComment && !isTourMode() ? `<div class="drive-comment-compose"><textarea id="drive-comment-input" rows="3" placeholder="Viết bình luận cho tài nguyên này…"></textarea><div><button class="btn btn-primary btn-sm" id="drive-comment-send">Gửi bình luận</button></div></div>` : `<div class="drive-comment-note">${isTourMode()?'Bình luận bị tắt trong môi trường tham quan.':permission==='viewer'?'Bạn đang ở chế độ chỉ xem.':''}</div>`}
        </div>` : ''}
        <div class="drive-route-footer"><span class="sub">Resource ID: <code>${escapeHtml(node.id)}</code></span><button class="btn btn-ghost btn-sm" id="drive-copy-route">Sao chép URL</button></div>
      </div>`;
    const back=document.getElementById('drive-route-back'); if(back) back.onclick=driveGoHub;
    const routeShare=document.getElementById('drive-route-share'); if(routeShare) routeShare.onclick=()=>renderDriveShareModal(node);
    const commentSend=document.getElementById('drive-comment-send');
    if(commentSend) commentSend.onclick=async()=>{
      commentSend.disabled=true;
      const ok=await driveAddComment(node.id,document.getElementById('drive-comment-input').value);
      if(ok){ driveAttach(); renderDriveResourceRoute(el,driveRoute()); }
      else commentSend.disabled=false;
    };
    el.querySelectorAll('[data-drive-comment-delete]').forEach(btn=>btn.onclick=async()=>{
      if(await driveDeleteComment(node.id,btn.dataset.driveCommentDelete)){ driveAttach(); renderDriveResourceRoute(el,driveRoute()); }
    });
    const copy=document.getElementById('drive-copy-route');
    if(copy) copy.onclick=async ()=>{
      const url = `${window.location.origin}${driveResourceUrl(node)}`;
      try{ await navigator.clipboard.writeText(url); copy.textContent='Đã sao chép'; }catch(e){ prompt('Sao chép URL tài nguyên:', url); }
    };
    el.querySelectorAll('[data-drive-route-child]').forEach(btn=>btn.onclick=()=>{
      const child=tree[btn.dataset.driveRouteChild];
      if(child){ history.pushState({},'',driveResourceUrl({...child}, route.space)); renderDriveResourceRoute(el, driveRoute()); }
    });
  }
  function renderDriveHubTab(el){
    if(!el) return;
    const route = driveRoute();
    if(route){ renderDriveResourceRoute(el, route); return; }
    driveAttach();
    const isShared = state.driveSpace==='shared';
    const crumbs = driveCurrentBreadcrumb();
    const items = driveChildren();
    const currentFolder = state.driveCurrentFolder ? state.driveResources[state.driveCurrentFolder] : null;
    const canEdit = driveCanEdit(currentFolder);
    el.innerHTML = `
      <div class="drive-hub">
        <div class="drive-hub-head">
          <div>
            <div class="eyebrow">DRIVE HUB</div>
            <h3>${isShared ? 'Kho tài liệu dùng chung' : 'Kho tài liệu cá nhân'}</h3>
            <p class="sub">${isShared ? `Theo mã xã/phường <b class="mono">${escapeHtml(wardId()||'')}</b>` : 'Metadata của app lưu theo tài khoản; Google Drive chỉ là lớp liên kết.'}</p>
          </div>
          <div class="drive-hub-actions">
            <button class="btn btn-ghost btn-sm" id="drive-open-note">📝 Quick Note</button>
            <button class="btn btn-ghost btn-sm" id="drive-refresh">↻ Làm mới</button>
          </div>
        </div>
        <div class="drive-space-tabs">
          <button class="btn ${!isShared?'btn-primary':'btn-ghost'} btn-sm" id="drive-personal">🔒 Cá nhân</button>
          <button class="btn ${isShared?'btn-primary':'btn-ghost'} btn-sm" id="drive-shared" ${wardId()?'':'disabled'}>🏛️ Xã/phường</button>
          <button class="btn btn-ghost btn-sm" id="drive-trash">${state.driveTrashOpen?'◀ Kho tài liệu':'🗑️ Thùng rác'}</button>
        </div>
        ${isTourMode()? `<div class="drive-notice drive-notice-tour">⚠️ CHẾ ĐỘ THAM QUAN — tài liệu dưới đây là dữ liệu demo, không lưu và không chia sẻ thật.</div>` : ''}
        ${!isShared && !hasAuthenticatedIdentity() && !isTourMode()? `<div class="drive-notice drive-notice-local">🔒 Hãy đăng nhập Google để tạo và lưu tài liệu cá nhân. Guest không lưu metadata Drive trên thiết bị và không có URL chia sẻ dùng chung.</div>` : ''}
        ${isShared && !canEdit? `<div class="drive-notice">Bạn đang ở chế độ xem. Chỉ Chủ mã mới được tạo, đổi tên hoặc đưa tài liệu vào thùng rác.</div>` : ''}
        <div class="drive-toolbar">
          <div class="drive-breadcrumb"><button data-drive-folder="">⌂ Gốc</button>${crumbs.map(c=>`<span>/</span><button data-drive-folder="${c.id}">${escapeHtml(c.name)}</button>`).join('')}</div>
          <div class="drive-toolbar-right">
            <input id="drive-search" type="search" placeholder="Tìm trong thư mục..." value="${escapeHtml(state.driveSearch||'')}">
            ${canEdit && !state.driveTrashOpen ? `<button class="btn btn-primary btn-sm" id="drive-new-folder">＋ Thư mục</button><button class="btn btn-primary btn-sm" id="drive-new-link">＋ Liên kết</button>` : ''}
            <button class="btn btn-ghost btn-sm" id="drive-toggle-view">${state.driveListMode==='grid'?'☷ Danh sách':'▦ Lưới'}</button>
          </div>
        </div>
        <div class="drive-items ${state.driveListMode==='list'?'is-list':''}">
          ${items.length ? items.map(n=>{
            const itemCanEdit=driveCanEdit(n);
            const itemCanShare=driveCanShare(n);
            return `
              <article class="drive-item" data-drive-item="${n.id}">
                <div class="drive-item-icon">${n.type==='folder'?'📁':'🔗'}</div>
                <div class="drive-item-main"><b>${escapeHtml(n.name||'Không tên')}</b><span>${escapeHtml(n.description|| (n.type==='folder'?'Thư mục':'Liên kết tài liệu'))}</span></div>
                <div class="drive-item-actions">
                  <button data-drive-open-route="${n.id}" title="Mở URL tài nguyên">↗</button>
                  ${itemCanShare?`<button data-drive-share="${n.id}" title="Chia sẻ">🔗</button>`:''}
                  ${state.driveTrashOpen ? (itemCanEdit?`<button data-drive-restore="${n.id}" title="Khôi phục">♻️</button>`:'') : (itemCanEdit?`<button data-drive-rename="${n.id}" title="Đổi tên">✏️</button><button data-drive-trash="${n.id}" title="Đưa vào thùng rác">🗑️</button>`:'')}
                </div>
              </article>`;
          }).join('') : `<div class="drive-empty"><div>🗂️</div><b>${state.driveTrashOpen?'Thùng rác trống':'Chưa có tài liệu trong thư mục này'}</b><span>${canEdit&&!state.driveTrashOpen?'Tạo thư mục hoặc thêm liên kết để bắt đầu.':'Không có nội dung phù hợp.'}</span></div>`}
        </div>
      </div>`;
    const bind = (id, event, fn)=>{ const node=document.getElementById(id); if(node) node.addEventListener(event, fn); };
    bind('drive-personal','click',()=>{ state.driveSpace='personal'; state.driveCurrentFolder=null; state.driveSearch=''; state.driveTrashOpen=false; renderDriveHubTab(el); });
    bind('drive-shared','click',()=>{ if(!wardId()) return; state.driveSpace='shared'; state.driveCurrentFolder=null; state.driveSearch=''; state.driveTrashOpen=false; renderDriveHubTab(el); });
    bind('drive-trash','click',()=>{ state.driveTrashOpen=!state.driveTrashOpen; state.driveCurrentFolder=null; renderDriveHubTab(el); });
    bind('drive-refresh','click',()=>{ driveDetach(); driveAttach(); renderDriveHubTab(el); });
    bind('drive-open-note','click',driveOpenQuickNote);
    bind('drive-new-folder','click',driveCreateFolder);
    bind('drive-new-link','click',driveCreateLink);
    bind('drive-toggle-view','click',()=>{ state.driveListMode=state.driveListMode==='grid'?'list':'grid'; renderDriveHubTab(el); });
    const search=document.getElementById('drive-search');
    if(search) search.addEventListener('input', e=>{ state.driveSearch=e.target.value; renderDriveHubTab(el); });
    el.querySelectorAll('[data-drive-folder]').forEach(btn=>btn.onclick=()=>{ state.driveCurrentFolder=btn.dataset.driveFolder||null; state.driveSearch=''; renderDriveHubTab(el); });
    el.querySelectorAll('[data-drive-item]').forEach(item=>item.onclick=(e)=>{
      if(e.target.closest('button')) return;
      const n=state.driveResources[item.dataset.driveItem];
      if(!n) return;
      if(n.type==='folder'){ state.driveCurrentFolder=n.id; state.driveSearch=''; renderDriveHubTab(el); }
      else if(n.url){ history.pushState({},'',driveResourceUrl(n)); renderDriveResourceRoute(el, driveRoute()); }
    });
    el.querySelectorAll('[data-drive-open-route]').forEach(btn=>btn.onclick=async e=>{
      e.stopPropagation();
      const n=state.driveResources[btn.dataset.driveOpenRoute];
      if(n){ history.pushState({},'',driveResourceUrl(n)); renderDriveResourceRoute(el, driveRoute()); }
    });
    el.querySelectorAll('[data-drive-share]').forEach(btn=>btn.onclick=e=>{ e.stopPropagation(); renderDriveShareModal(state.driveResources[btn.dataset.driveShare]); });
    el.querySelectorAll('[data-drive-rename]').forEach(btn=>btn.onclick=async e=>{ e.stopPropagation(); await driveRename(btn.dataset.driveRename); driveAttach(); renderDriveHubTab(el); });
    el.querySelectorAll('[data-drive-trash]').forEach(btn=>btn.onclick=async e=>{ e.stopPropagation(); await driveTrash(btn.dataset.driveTrash); driveAttach(); renderDriveHubTab(el); });
    el.querySelectorAll('[data-drive-restore]').forEach(btn=>btn.onclick=async e=>{ e.stopPropagation(); await driveRestore(btn.dataset.driveRestore); driveAttach(); renderDriveHubTab(el); });
  }