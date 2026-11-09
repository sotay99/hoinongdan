  // =====================================================================
  // MODULE "HỒ SƠ HỘI VIÊN" + "THỰC LỰC HỘI" — bản triển khai thật, thay cho trang giới thiệu
  // cũ. Thiết kế bám theo file Excel "DS_HOI_VIEN" mà các cơ sở Hội đang dùng: 1 "bảng gốc" đầy
  // đủ cột (state.members), bảng "để in" (chỉ cột cơ bản) và bảng "thực lực" (thống kê công thức)
  // đều tính ra từ đó. Lưu trữ: secretdata/{secretId}/members và secretdata/{secretId}/
  // strengthSnapshots — xem wref()/cSetRecord() ở 03-cloud-storage.js. Tận dụng tối đa code đã
  // chạy ổn định ở Sổ vay vốn: danh mục địa bàn dân cư dùng chung (renderHamletManagerModal),
  // luồng "+ Thêm..." trong <select> (y hệt ô "Địa bàn dân cư" khi thêm người vay), modal bảng
  // Excel xem trước (renderColumnHeaderExcelModal), khung chat "Thêm nhanh bằng AI", bộ lọc đa
  // chọn kiểu sv-filter-dropdown (viền đỏ khi khác mặc định), các mask nhập liệu dùng chung
  // (attachMoneyInputMask/attachPhoneInputMask/attachCccdInputMask ở 02-shared-ui.js).
  // =====================================================================

  // ---------- MASK NHẬP LIỆU RIÊNG CỦA 2 MODULE NÀY (phần chưa có sẵn ở 02-shared-ui.js) ----------
  // Chỉ cho nhập chữ số, tối đa maxLen ký tự — dùng cho năm sinh/năm vào hội/năm cấp thẻ (4 ký tự)
  // và các ô số của Thực lực Hội (6 hoặc 3 ký tự).
  function attachDigitsMaxLenMask(input, maxLen){
    if(!input) return;
    input.addEventListener('input', ()=>{
      let digits = input.value.replace(/[^\d]/g,'');
      if(digits.length>maxLen) digits = digits.slice(0,maxLen);
      input.value = digits;
    });
    input.addEventListener('keypress', (e)=>{
      if(e.key.length===1 && !/[\d]/.test(e.key)){ e.preventDefault(); alert('Chỉ được nhập chữ số cho ô này.'); }
    });
  }
  // "Trình độ văn hoá" — chỉ chữ số và ĐÚNG 1 dấu "/", tối đa 5 ký tự (VD "9/12").
  function attachEducationLevelMask(input){
    if(!input) return;
    const maxLen = 5;
    input.addEventListener('input', ()=>{
      let v = input.value.replace(/[^\d/]/g,'');
      const firstSlash = v.indexOf('/');
      if(firstSlash!==-1) v = v.slice(0,firstSlash+1) + v.slice(firstSlash+1).replace(/\//g,'');
      if(v.length>maxLen) v = v.slice(0,maxLen);
      input.value = v;
    });
    input.addEventListener('keypress', (e)=>{
      const ch = e.key; if(ch.length!==1) return;
      if(!/[\d/]/.test(ch)){ e.preventDefault(); alert('Trình độ văn hoá chỉ được nhập chữ số và dấu "/".'); }
    });
  }

  // ---------- DANH MỤC ----------
  // "Chức vụ hiện nay": 10 chức vụ cố định KHÔNG được xoá/sửa — chỉ cho thêm chức vụ tuỳ chỉnh
  // (lưu ở state.config.memberPositionsCustom), đúng yêu cầu của Hội.
  const MEMBER_POSITION_FIXED = ['Hội viên','Chi hội trưởng','Chi hội Phó','Uỷ viên BCH Chi hội','Tổ trưởng','Tổ phó','UV BCH HND xã/phường','UV BTV HND xã/phường','Chủ tịch Hội','Phó Chủ tịch Hội'];
  const MEMBER_ETHNICITY_DEFAULT = ['Kinh',"S'tiêng","K'ho",'Lào','Chăm','Dao','Ê đê','Châu ro','Hoa','Nùng','Mường','Mán','Gia rai','Tày','Sán dìu','Châu mạ','Thái','Thổ','Khơ me'];
  const MEMBER_RELIGION_DEFAULT = ['Không','Công giáo','Phật giáo','Tin lành','Hoà hảo','Cao đài','Hồi giáo'];
  function memberGenderOptions(){ return (state.config && state.config.memberGenders) || ['Nam','Nữ']; }
  function memberEthnicityOptions(){ return (state.config && state.config.memberEthnicities) || MEMBER_ETHNICITY_DEFAULT; }
  function memberReligionOptions(){ return (state.config && state.config.memberReligions) || MEMBER_RELIGION_DEFAULT; }
  function memberPositionOptions(){ return MEMBER_POSITION_FIXED.concat((state.config && state.config.memberPositionsCustom)||[]); }

  function memberCatalogMeta(kind){
    return {
      gender:{ title:'Danh sách Giới tính', field:'memberGenders', def:['Nam','Nữ'], max:10, maxLen:15 },
      ethnicity:{ title:'Danh sách Dân tộc', field:'memberEthnicities', def:MEMBER_ETHNICITY_DEFAULT, max:60, maxLen:24 },
      religion:{ title:'Danh sách Tôn giáo', field:'memberReligions', def:MEMBER_RELIGION_DEFAULT, max:30, maxLen:24 },
    }[kind];
  }
  // Modal quản lý danh mục tự do (Giới tính/Dân tộc/Tôn giáo) — cùng khung với renderHamletManagerModal
  // ở 07-core-modules.js. Nhận onSaved(clean) để báo cho ô <select> đang mở biết vừa lưu xong — y hệt
  // luồng "+ Thêm địa bàn dân cư..." ở modal "Thêm người vay" (Sổ vay vốn).
  function renderMemberListCatalogModal(kind, onSaved){
    const meta = memberCatalogMeta(kind);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let items = (state.config[meta.field]!=null ? state.config[meta.field] : meta.def).slice();
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:460px;">
          <div class="modal-head"><h3>${escapeHtml(meta.title)}</h3><button class="modal-close preview-allow" id="mcl-close">✕</button></div>
          <div class="modal-body">
            ${items.map((name,i)=>`
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <button type="button" data-mcl-del="${i}" class="preview-allow" style="border:1px solid var(--line); border-radius:50%; width:24px; height:24px; color:#c00; background:#fff; cursor:pointer;">✕</button>
                <input data-mcl-name="${i}" maxlength="${meta.maxLen}" value="${escapeHtml(name)}" class="preview-allow" style="flex:1;">
              </div>`).join('')}
            <button class="btn btn-ghost btn-sm preview-allow" id="mcl-add" ${items.length>=meta.max?'disabled':''}>Thêm +</button>
            ${items.length>=meta.max? `<p class="sub" style="color:var(--red);">Đã đạt tối đa ${meta.max} mục.</p>` : ''}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="mcl-cancel">Đóng bảng quay lại</button>
            <button class="btn btn-primary preview-allow" id="mcl-save">Lưu vào bộ nhớ chung</button>
          </div>
        </div>`;
      wire();
    }
    function wire(){
      wrap.querySelector('#mcl-close').onclick = close;
      wrap.querySelector('#mcl-cancel').onclick = close;
      wrap.querySelectorAll('[data-mcl-name]').forEach(inp=>{ inp.oninput = ()=>{ items[parseInt(inp.dataset.mclName,10)] = inp.value; }; });
      wrap.querySelectorAll('[data-mcl-del]').forEach(btn=>{
        btn.onclick = ()=>{
          const idx = parseInt(btn.dataset.mclDel,10); const name = items[idx];
          if(name && name.trim() && !confirm(`Xoá "${name}" khỏi danh mục?`)) return;
          items.splice(idx,1); render();
        };
      });
      const addBtn = wrap.querySelector('#mcl-add');
      if(addBtn) addBtn.onclick = ()=>{
        if(items.length>=meta.max) return;
        if(items.length && !items[items.length-1].trim()){ alert('Vui lòng nhập tên cho ô vừa thêm trước khi thêm ô mới.'); return; }
        items.push(''); render();
      };
      wrap.querySelector('#mcl-save').onclick = async ()=>{
        if(items.some(n=>!n||!n.trim())){ alert('Không thể lưu khi còn ô để trống — vui lòng điền đầy đủ hoặc xoá ô trống đó.'); return; }
        const clean = items.map(n=>n.trim());
        const newCfg = {...state.config, [meta.field]: clean};
        await cSet('config', newCfg);
        state.config = newCfg;
        close();
        if(onSaved) onSaved(clean);
      };
    }
    render();
  }
  // Modal quản lý "Chức vụ hiện nay" — cùng khung với renderFundSourceManagerModal: 10 chức vụ cố
  // định chỉ xem, phần tuỳ chỉnh phía dưới mới cho thêm/sửa/xoá.
  function renderMemberPositionManagerModal(onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let items = (state.config.memberPositionsCustom||[]).slice();
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:480px;">
          <div class="modal-head"><h3>Danh sách Chức vụ hiện nay</h3><button class="modal-close preview-allow" id="mpm-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 12px;">${MEMBER_POSITION_FIXED.length} chức vụ cố định bên dưới luôn có sẵn cho mọi xã/phường, không sửa/xoá được. Nếu cần chức vụ khác, thêm vào danh sách tuỳ chỉnh phía dưới.</p>
            <div class="divider-lbl">Chức vụ cố định (chỉ xem)</div>
            ${MEMBER_POSITION_FIXED.map(name=>`<div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;"><input value="${escapeHtml(name)}" disabled style="flex:1; opacity:.7;"></div>`).join('')}
            <div class="divider-lbl" style="margin-top:14px;">Chức vụ tuỳ chỉnh</div>
            ${items.map((name,i)=>`
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <button type="button" data-mpm-del="${i}" class="preview-allow" style="border:1px solid var(--line); border-radius:50%; width:24px; height:24px; color:#c00; background:#fff; cursor:pointer;">✕</button>
                <input data-mpm-name="${i}" maxlength="24" value="${escapeHtml(name)}" class="preview-allow" style="flex:1;">
              </div>`).join('')}
            <button class="btn btn-ghost btn-sm preview-allow" id="mpm-add" ${items.length>=30?'disabled':''}>Thêm +</button>
            ${items.length>=30? `<p class="sub" style="color:var(--red);">Đã đạt tối đa 30 chức vụ tuỳ chỉnh.</p>` : ''}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="mpm-cancel">Đóng bảng quay lại</button>
            <button class="btn btn-primary preview-allow" id="mpm-save">Lưu vào bộ nhớ chung</button>
          </div>
        </div>`;
      wire();
    }
    function wire(){
      wrap.querySelector('#mpm-close').onclick = close;
      wrap.querySelector('#mpm-cancel').onclick = close;
      wrap.querySelectorAll('[data-mpm-name]').forEach(inp=>{ inp.oninput = ()=>{ items[parseInt(inp.dataset.mpmName,10)] = inp.value; }; });
      wrap.querySelectorAll('[data-mpm-del]').forEach(btn=>{
        btn.onclick = ()=>{
          const idx = parseInt(btn.dataset.mpmDel,10); const name = items[idx];
          if(name && name.trim() && !confirm(`Xoá chức vụ tuỳ chỉnh "${name}"?`)) return;
          items.splice(idx,1); render();
        };
      });
      const addBtn = wrap.querySelector('#mpm-add');
      if(addBtn) addBtn.onclick = ()=>{
        if(items.length>=30) return;
        if(items.length && !items[items.length-1].trim()){ alert('Vui lòng nhập tên cho ô vừa thêm trước khi thêm ô mới.'); return; }
        items.push(''); render();
      };
      wrap.querySelector('#mpm-save').onclick = async ()=>{
        if(items.some(n=>!n||!n.trim())){ alert('Không thể lưu khi còn ô để trống.'); return; }
        const clean = items.map(n=>n.trim());
        const newCfg = {...state.config, memberPositionsCustom: clean};
        await cSet('config', newCfg);
        state.config = newCfg;
        close();
        if(onSaved) onSaved(clean);
      };
    }
    render();
  }

  // ---------- "ĐĂNG KÝ KIỂU TRƯỜNG" — 1 nơi duy nhất mô tả từng trường của hồ sơ hội viên nên hiện
  // kiểu kiểm soát gì (select/mask/giới hạn ký tự) — dùng CHUNG cho modal thêm/sửa tay VÀ bảng
  // "Hồ sơ đang soạn" của AI, để 2 nơi luôn khớp nhau tuyệt đối.
  function memberFieldTypeRegistry(){ return {
    fullName:{ type:'text', maxLen:30 },
    birthYear:{ type:'yeardigits' },
    gender:{ type:'select-catalog', optionsFn:memberGenderOptions },
    ethnicity:{ type:'select-catalog', optionsFn:memberEthnicityOptions },
    religion:{ type:'select-catalog', optionsFn:memberReligionOptions },
    cccd:{ type:'cccd' },
    educationLevel:{ type:'education' },
    joinYear:{ type:'yeardigits' },
    cardYear:{ type:'yeardigits' },
    currentHamlet:{ type:'select-hamlet' },
    oldHamlet:{ type:'select-hamlet-old' },
    isCore:{ type:'checkbox' },
    position:{ type:'select-catalog', optionsFn:memberPositionOptions },
    partyMember:{ type:'select-fixed', options:['Có','Không'], defaultBlank:true },
    removedDate:{ type:'date' },
    removedReason:{ type:'text', maxLen:80 },
    needsVerifyNote:{ type:'text', maxLen:120 },
    phone:{ type:'phone' },
    note:{ type:'textarea', maxLen:300 },
    area:{ type:'text', maxLen:12 },
    mainIndustry:{ type:'text', maxLen:60 },
    avgIncome:{ type:'money', maxDigits:9 },
    laborCount:{ type:'digits', maxLen:4 },
    coopGroup:{ type:'text', maxLen:60 },
    productionType:{ type:'text', maxLen:40 },
    mainCrop:{ type:'text', maxLen:60 },
    scale:{ type:'text', maxLen:40 },
    techLevel:{ type:'select-fixed', options:['Chưa áp dụng','Thấp','Trung bình','Cao'], defaultBlank:true },
    product:{ type:'text', maxLen:60 },
    salesChannel:{ type:'text', maxLen:60 },
    goodFarmerTitle:{ type:'select-fixed', options:['Không','Cấp xã/phường','Cấp tỉnh/TP','Cấp TW'], defaultBlank:true },
    activityLevel:{ type:'select-fixed', options:['Thường xuyên','Thỉnh thoảng','Không thường xuyên','Hầu như không'], defaultBlank:true },
    advantage:{ type:'textarea', maxLen:300 },
    difficulty:{ type:'textarea', maxLen:300 },
    proposal:{ type:'textarea', maxLen:300 },
    chiHoiComment:{ type:'textarea', maxLen:300 },
    proposalToWard:{ type:'textarea', maxLen:300 },
  }; }
  function memberFieldControlHtml(key, id, value){
    const reg = memberFieldTypeRegistry()[key];
    if(!reg) return `<input type="text" id="${id}" value="${escapeHtml(value==null?'':String(value))}">`;
    switch(reg.type){
      case 'checkbox':
        return `<input type="checkbox" id="${id}" ${value?'checked':''}>`;
      case 'select-catalog': {
        const opts = reg.optionsFn();
        return `<select id="${id}">
          <option value="">(Chưa rõ)</option>
          ${opts.map(o=>`<option value="${escapeHtml(o)}" ${value===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}
          <option value="__add__">+ Thêm...</option>
        </select>`;
      }
      case 'select-hamlet': {
        const opts = state.config.hamlets||[];
        return `<select id="${id}">
          <option value="">(Chưa rõ)</option>
          ${opts.map(o=>`<option value="${escapeHtml(o)}" ${value===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}
          <option value="__add__">+ Thêm địa bàn dân cư...</option>
        </select>`;
      }
      case 'select-hamlet-old': {
        const opts = state.config.hamletsLegacyHidden||[];
        return `<select id="${id}">
          <option value="">(Chưa rõ)</option>
          ${opts.map(o=>`<option value="${escapeHtml(o)}" ${value===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}
          <option value="__add__">+ Thêm địa chỉ trước sáp nhập...</option>
        </select>`;
      }
      case 'select-fixed': {
        return `<select id="${id}">
          ${reg.defaultBlank? `<option value="">(Chưa rõ)</option>` : ''}
          ${reg.options.map(o=>`<option value="${escapeHtml(o)}" ${value===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}
        </select>`;
      }
      case 'date':
        return `<input type="date" id="${id}" value="${escapeHtml(value||'')}">`;
      case 'textarea':
        return `<textarea id="${id}" maxlength="${reg.maxLen||300}">${escapeHtml(value||'')}</textarea>`;
      default:
        return `<input type="text" id="${id}" value="${escapeHtml(value==null?'':String(value))}" ${reg.maxLen?`maxlength="${reg.maxLen}"`:''}>`;
    }
  }
  function memberFieldAttachMask(key, wrap, id){
    const reg = memberFieldTypeRegistry()[key];
    if(!reg) return;
    const el = wrap.querySelector('#'+id);
    if(!el) return;
    if(reg.type==='yeardigits') attachDigitsMaxLenMask(el, 4);
    else if(reg.type==='digits') attachDigitsMaxLenMask(el, reg.maxLen||6);
    else if(reg.type==='cccd') attachCccdInputMask(el);
    else if(reg.type==='phone') attachPhoneInputMask(el);
    else if(reg.type==='education') attachEducationLevelMask(el);
    else if(reg.type==='money') attachMoneyInputMask(el, reg.maxDigits||9);
  }
  function memberFieldLatestOptionValue(key){
    if(key==='currentHamlet'){ const a=state.config.hamlets||[]; return a[a.length-1]||''; }
    if(key==='oldHamlet'){ const a=state.config.hamletsLegacyHidden||[]; return a[a.length-1]||''; }
    const reg = memberFieldTypeRegistry()[key];
    if(reg && reg.optionsFn){ const a=reg.optionsFn(); return a[a.length-1]||''; }
    return '';
  }
  function memberFieldAddManagerModal(key, onSaved){
    if(key==='currentHamlet') return renderHamletManagerModal(onSaved);
    if(key==='oldHamlet') return renderLegacyAddressManagerModal(onSaved);
    if(key==='gender') return renderMemberListCatalogModal('gender', onSaved);
    if(key==='ethnicity') return renderMemberListCatalogModal('ethnicity', onSaved);
    if(key==='religion') return renderMemberListCatalogModal('religion', onSaved);
    if(key==='position') return renderMemberPositionManagerModal(onSaved);
  }
  // Gắn mask + luồng "+ Thêm..." cho 1 ô (select hoặc input/textarea) đã có trong `wrap` — dùng
  // CHUNG cho modal thêm/sửa tay VÀ bảng "Hồ sơ đang soạn" của AI. `onAfterAddSaved()` do nơi gọi
  // quyết định cách vẽ lại (modal tay: đọc DOM vào biến rồi render lại; bảng AI: chỉ cần render lại
  // vì giá trị các ô khác đã được ghi thẳng vào mảng nháp qua `onValueChange` từ trước).
  // `onValueChange(newValue)` — gọi mỗi khi người dùng CHỌN/GÕ xong 1 giá trị thật (không gọi khi
  // đang mở modal quản lý danh mục) — để nơi gọi tự quyết định lưu giá trị đó vào đâu.
  function wireMemberFieldControl(wrap, key, id, onAfterAddSaved, onValueChange){
    memberFieldAttachMask(key, wrap, id);
    const el = wrap.querySelector('#'+id);
    if(!el) return;
    if(el.tagName==='SELECT'){
      el.dataset.prev = el.value;
      el.onchange = ()=>{
        if(el.value==='__add__'){
          el.value = el.dataset.prev||'';
          memberFieldAddManagerModal(key, ()=>{
            if(onAfterAddSaved) onAfterAddSaved();
            const newEl = document.getElementById(id);
            if(newEl){
              const v = memberFieldLatestOptionValue(key);
              if(v) newEl.value = v;
              newEl.classList.add('field-border-flash');
              if(onValueChange) onValueChange(newEl.value);
            }
          });
          return;
        }
        el.dataset.prev = el.value;
        if(onValueChange) onValueChange(el.value);
      };
    } else if(el.type==='checkbox'){
      if(onValueChange) el.onchange = ()=> onValueChange(el.checked);
    } else if(onValueChange){
      el.addEventListener('input', ()=> onValueChange(el.value));
    }
  }

  // ---------- DỮ LIỆU HỘI VIÊN (secretdata/{secretId}/members) ----------
  function emptyMember(){
    const now = new Date().toISOString();
    return {
      id: 'mb_'+uid(),
      fullName:'', birthYear:'', gender:'', ethnicity:'', religion:'', cccd:'', educationLevel:'',
      joinYear:'', cardYear:'', currentHamlet:'', oldHamlet:'', isCore:false, position: memberPositionOptions()[0]||'Hội viên',
      partyMember:'', removedDate:'', removedReason:'', phone:'', note:'',
      area:'', mainIndustry:'', avgIncome:'', laborCount:'', coopGroup:'', productionType:'', mainCrop:'', scale:'', techLevel:'',
      product:'', salesChannel:'', goodFarmerTitle:'', activityLevel:'', advantage:'', difficulty:'', proposal:'',
      chiHoiComment:'', proposalToWard:'',
      needsVerify:false, needsVerifyNote:'',
      deleted:false, createdAt: now, updatedAt: now, order: Date.now(),
    };
  }
  async function saveMember(m){ m.updatedAt = new Date().toISOString(); await cSetRecord('members', m.id, m); }
  async function softDeleteMember(id){
    const m=(state.members||[]).find(x=>x.id===id); if(!m) return;
    await cSetRecord('members', id, {...m, deleted:true, deletedAt:new Date().toISOString(), deletedBy:(state.identity&&state.identity.email)||'', deletedByName:(state.identity&&state.identity.name)||''});
  }
  async function restoreMember(id){ const m=(state.members||[]).find(x=>x.id===id); if(!m) return; await cSetRecord('members', id, {...m, deleted:false}); }
  async function purgeMemberForever(id){ await cRemoveRecord('members', id); }

  // ---------- THỨ TỰ HIỂN THỊ (ấp theo thứ tự tuỳ chỉnh, hội viên theo thứ tự tuỳ chỉnh TRONG
  // từng ấp) — thay cho sắp xếp theo thứ tự chữ cái. Lưu ở state.config.memberHamletOrder (danh
  // sách tên ấp) + field `order` (số) của từng hội viên. Dùng CHUNG cho bảng danh sách, Excel và
  // xuất/in — đồng bộ thời gian thực vì đọc trực tiếp state hiện tại mỗi lần gọi. ----------
  function orderedHamletsList(){
    const all = (state.config.hamlets||[]).filter(h=>h!=='Khác');
    const custom = (state.config.memberHamletOrder||[]).filter(h=> all.includes(h));
    const rest = all.filter(h=> !custom.includes(h));
    return custom.concat(rest);
  }
  function sortedMembersForDisplay(list){
    const hamletIndex = {}; orderedHamletsList().forEach((h,i)=>{ hamletIndex[h]=i; });
    return list.slice().sort((a,b)=>{
      const ia = hamletIndex[a.currentHamlet]; const ib = hamletIndex[b.currentHamlet];
      const ga = ia==null? 9999 : ia, gb = ib==null? 9999 : ib;
      if(ga!==gb) return ga-gb;
      return (a.order||0) - (b.order||0);
    });
  }
  // Modal kéo-thả sắp xếp lại THỨ TỰ các ấp — dùng đúng hạ tầng wireDragReorderWithIndicator đã
  // chạy cho "☰ Sắp xếp thứ tự" ở Thu-Chi nội bộ (09-ai-chat-notes.js:1535), có đường kẻ xanh khi
  // kéo, nút Lưu/Huỷ.
  function renderMemberHamletOrderModal(onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let draft = orderedHamletsList();
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:420px;">
          <div class="modal-head"><h3>☰ Sắp xếp thứ tự khu dân cư</h3><button class="modal-close preview-allow" id="mho-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Kéo-thả để đổi thứ tự. Danh sách hội viên sẽ hiện theo đúng thứ tự này.</p>
            <div class="table-wrap"><table><tbody>
              ${draft.map(h=>`<tr draggable="true" data-drag-hamlet="${escapeHtml(h)}" style="cursor:grab;"><td style="width:28px;">☰</td><td>${escapeHtml(h)}</td></tr>`).join('')}
            </tbody></table></div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="mho-cancel">Huỷ</button>
            <button class="btn btn-primary preview-allow" id="mho-save">💾 Lưu sắp xếp</button>
          </div>
        </div>`;
      wrap.querySelector('#mho-close').onclick = close;
      wrap.querySelector('#mho-cancel').onclick = close;
      wrap.querySelector('#mho-save').onclick = async ()=>{
        const newCfg = {...state.config, memberHamletOrder: draft.slice()};
        await cSet('config', newCfg);
        state.config = newCfg;
        close();
        if(onSaved) onSaved();
      };
      wireDragReorderWithIndicator(
        Array.from(wrap.querySelectorAll('[data-drag-hamlet]')),
        row=> row.dataset.dragHamlet,
        (draggedKey, targetKey, before)=>{
          const arr = draft.filter(h=> h!==draggedKey);
          let idx = arr.indexOf(targetKey);
          if(!before) idx += 1;
          arr.splice(idx, 0, draggedKey);
          draft = arr;
          render();
        }
      );
    }
    render();
  }

  // ---------- CỘT HIỂN THỊ (cơ bản = "để in" trong Excel, nâng cao = phần sản xuất) ----------
  function memberBasicCols(){ return [
    { label:'Họ và tên', get:m=>escapeHtml(m.fullName||''), getPlain:m=>m.fullName||'' },
    { label:'Năm sinh', get:m=>escapeHtml(String(m.birthYear||'')), getPlain:m=>m.birthYear||'' },
    { label:'Giới tính', get:m=>escapeHtml(m.gender||''), getPlain:m=>m.gender||'' },
    { label:'Dân tộc', get:m=>escapeHtml(m.ethnicity||''), getPlain:m=>m.ethnicity||'' },
    { label:'Tôn giáo', get:m=>escapeHtml(m.religion||''), getPlain:m=>m.religion||'' },
    { label:'Số CCCD', get:m=>escapeHtml(m.cccd||''), getPlain:m=>m.cccd||'' },
    { label:'Trình độ văn hoá', get:m=>escapeHtml(m.educationLevel||''), getPlain:m=>m.educationLevel||'' },
    { label:'Năm vào hội', get:m=>escapeHtml(String(m.joinYear||'')), getPlain:m=>m.joinYear||'' },
    { label:'Năm cấp thẻ hội viên', get:m=>escapeHtml(String(m.cardYear||'')), getPlain:m=>m.cardYear||'' },
    { label:'Nơi ở hiện nay', get:m=>escapeHtml(m.currentHamlet||''), getPlain:m=>m.currentHamlet||'' },
    { label:'Nơi ở trước sáp nhập', get:m=>escapeHtml(m.oldHamlet||''), getPlain:m=>m.oldHamlet||'' },
    { label:'Hội viên nòng cốt', get:m=>m.isCore?'X':'', getPlain:m=>m.isCore?'X':'' },
    { label:'Chức vụ hiện nay', get:m=>escapeHtml(m.position||''), getPlain:m=>m.position||'' },
    { label:'Đảng viên', get:m=>escapeHtml(m.partyMember||''), getPlain:m=>m.partyMember||'' },
    { label:'Ngày và lý do xoá tên', get:m=>escapeHtml([m.removedDate?fmtDate(m.removedDate):'', m.removedReason||''].filter(Boolean).join(' — ')), getPlain:m=>[m.removedDate||'', m.removedReason||''].filter(Boolean).join(' — ') },
    { label:'Số điện thoại', get:m=>escapeHtml(m.phone||''), getPlain:m=>m.phone||'' },
    { label:'Ghi chú', get:m=>escapeHtml(m.note||''), getPlain:m=>m.note||'' },
  ]; }
  function memberAdvancedCols(){ return [
    { label:'Diện tích sản xuất (ha)', get:m=>escapeHtml(String(m.area||'')), getPlain:m=>m.area||'' },
    { label:'Ngành nghề SXKD chính', get:m=>escapeHtml(m.mainIndustry||''), getPlain:m=>m.mainIndustry||'' },
    { label:'Mức thu nhập bình quân/năm (triệu đồng)', get:m=>escapeHtml(String(m.avgIncome||'')), getPlain:m=>m.avgIncome||'' },
    { label:'Lao động tham gia SX', get:m=>escapeHtml(String(m.laborCount||'')), getPlain:m=>m.laborCount||'' },
    { label:'Tham gia tổ hợp tác/HTX', get:m=>escapeHtml(m.coopGroup||''), getPlain:m=>m.coopGroup||'' },
    { label:'Loại hình sản xuất', get:m=>escapeHtml(m.productionType||''), getPlain:m=>m.productionType||'' },
    { label:'Cây trồng, vật nuôi chính', get:m=>escapeHtml(m.mainCrop||''), getPlain:m=>m.mainCrop||'' },
    { label:'Quy mô sản xuất', get:m=>escapeHtml(m.scale||''), getPlain:m=>m.scale||'' },
    { label:'Mức độ ứng dụng KH-KT', get:m=>escapeHtml(m.techLevel||''), getPlain:m=>m.techLevel||'' },
    { label:'Sản phẩm tiêu biểu', get:m=>escapeHtml(m.product||''), getPlain:m=>m.product||'' },
    { label:'Kênh tiêu thụ sản phẩm', get:m=>escapeHtml(m.salesChannel||''), getPlain:m=>m.salesChannel||'' },
    { label:'Đăng ký danh hiệu NDSXKD giỏi', get:m=>escapeHtml(m.goodFarmerTitle||''), getPlain:m=>m.goodFarmerTitle||'' },
    { label:'Mức độ tham gia sinh hoạt Hội', get:m=>escapeHtml(m.activityLevel||''), getPlain:m=>m.activityLevel||'' },
    { label:'Thuận lợi', get:m=>escapeHtml(m.advantage||''), getPlain:m=>m.advantage||'' },
    { label:'Khó khăn', get:m=>escapeHtml(m.difficulty||''), getPlain:m=>m.difficulty||'' },
    { label:'Kiến nghị, đề xuất', get:m=>escapeHtml(m.proposal||''), getPlain:m=>m.proposal||'' },
    { label:'Nhận xét của Chi hội trưởng', get:m=>escapeHtml(m.chiHoiComment||''), getPlain:m=>m.chiHoiComment||'' },
    { label:'Đề xuất với Hội Nông dân xã', get:m=>escapeHtml(m.proposalToWard||''), getPlain:m=>m.proposalToWard||'' },
  ]; }

  // ---------- BỘ LỌC (giống hệt kiểu sv-filter-dropdown của Sổ vay vốn — viền đỏ khi khác mặc định).
  // "Nơi ở hiện nay"/"Nơi ở trước sáp nhập"/"Giới tính"/"Đảng viên" LUÔN hiện đủ danh mục chung —
  // không phụ thuộc hồ sơ hiện có. "Dân tộc"/"Tôn giáo"/"Chức vụ"/"Năm sinh" CHỈ hiện đúng những giá
  // trị THỰC SỰ đang có trong hồ sơ (đồng bộ thời gian thực theo state.members). ----------
  function memberDistinctValues(field){
    const set = new Set();
    (state.members||[]).filter(m=>!m.deleted).forEach(m=>{
      const raw = field==='birthYear' ? (m.birthYear? String(m.birthYear) : '') : (m[field]||'');
      if(raw) set.add(raw);
    });
    const arr = Array.from(set);
    if(field==='birthYear') return arr.sort((a,b)=> parseInt(a,10)-parseInt(b,10));
    return arr.sort((a,b)=> a.localeCompare(b,'vi'));
  }
  function memberFilterDefs(){ return [
    { key:'currentHamlet', label:'Nơi ở hiện nay', icon:'📍', opts:(state.config.hamlets||[]) },
    { key:'gender', label:'Giới tính', icon:'⚧', opts:memberGenderOptions() },
    { key:'ethnicity', label:'Dân tộc', icon:'🌾', opts:memberDistinctValues('ethnicity') },
    { key:'religion', label:'Tôn giáo', icon:'🙏', opts:memberDistinctValues('religion') },
    { key:'partyMember', label:'Đảng viên', icon:'🚩', opts:['Có','Không'] },
    { key:'position', label:'Chức vụ hiện nay', icon:'🎖️', opts:memberDistinctValues('position') },
    { key:'birthYear', label:'Năm sinh', icon:'🎂', opts: memberDistinctValues('birthYear') },
    { key:'oldHamlet', label:'Nơi ở trước sáp nhập', icon:'🏘️', opts:(state.config.hamletsLegacyHidden||[]) },
  ]; }
  // Khởi tạo + ĐỒNG BỘ danh sách bộ lọc theo dữ liệu hiện có: nếu 1 bộ lọc đang ở trạng thái
  // "chọn tất cả" theo danh sách CŨ, khi danh sách MỚI xuất hiện thêm giá trị (VD vừa có hội viên
  // dân tộc chưa từng có trước đó), tự mở rộng theo để không vô tình ẩn mất hội viên đó.
  function ensureMemberFilters(){
    if(!state.memberFilters) state.memberFilters = {};
    if(!state._memberFilterPrevOpts) state._memberFilterPrevOpts = {};
    memberFilterDefs().forEach(d=>{
      const prevOpts = state._memberFilterPrevOpts[d.key];
      if(!state.memberFilters[d.key]){
        state.memberFilters[d.key] = d.opts.slice();
      } else if(prevOpts){
        const hadAll = prevOpts.every(o=> state.memberFilters[d.key].includes(o)) && state.memberFilters[d.key].length>=prevOpts.length;
        if(hadAll) state.memberFilters[d.key] = d.opts.slice();
      }
      state._memberFilterPrevOpts[d.key] = d.opts.slice();
    });
    if(state.memberSearch==null) state.memberSearch = '';
  }
  function resetMemberFilters(){ state.memberFilters = {}; state._memberFilterPrevOpts = {}; ensureMemberFilters(); state.memberSearch = ''; state.openFilterDropdown = null; }
  function anyMemberFilterActive(){
    if((state.memberSearch||'').trim()!=='') return true;
    return memberFilterDefs().some(d=> state.memberFilters[d.key].length < d.opts.length);
  }
  function memberFieldFilterPass(filterArr, value){ if(!value) return true; return filterArr.includes(value); }
  function memberMatchesFilters(m){
    const f = state.memberFilters;
    if(!memberFieldFilterPass(f.currentHamlet, m.currentHamlet)) return false;
    if(!memberFieldFilterPass(f.oldHamlet, m.oldHamlet)) return false;
    if(!memberFieldFilterPass(f.gender, m.gender)) return false;
    if(!memberFieldFilterPass(f.ethnicity, m.ethnicity)) return false;
    if(!memberFieldFilterPass(f.religion, m.religion)) return false;
    if(!memberFieldFilterPass(f.partyMember, m.partyMember)) return false;
    if(!memberFieldFilterPass(f.position, m.position)) return false;
    if(!memberFieldFilterPass(f.birthYear, m.birthYear? String(m.birthYear) : '')) return false;
    const q = (state.memberSearch||'').trim().toLowerCase();
    if(q){
      const hay = `${m.fullName||''} ${m.cccd||''} ${m.phone||''}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }
  function memberFilterDropdownsHtml(prefix){
    ensureMemberFilters();
    return memberFilterDefs().map(d=>{
      const sel = state.memberFilters[d.key];
      const allSel = sel.length>=d.opts.length;
      const ddKey = prefix+'-'+d.key;
      return `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" data-mf-btn="${d.key}" style="${!allSel?'border:2px solid #b71c1c;':''}">${d.icon} ${escapeHtml(d.label)} (${sel.length})</button>
        ${state.openFilterDropdown===ddKey? `<div class="sv-filter-panel">
          <label class="sv-filter-item"><input type="checkbox" class="preview-allow" data-mf-all="${d.key}" ${allSel?'checked':''}><span><b>Tất cả</b></span></label>
          ${d.opts.map(o=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow" data-mf-item="${d.key}" data-mf-val="${escapeHtml(o)}" ${sel.includes(o)?'checked':''}><span>${escapeHtml(o)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
    }).join('');
  }
  function wireMemberFilterDropdowns(container, prefix, rerender){
    container.querySelectorAll('[data-mf-btn]').forEach(btn=> btn.onclick=(e)=>{
      e.stopPropagation();
      const k = btn.dataset.mfBtn, ddKey = prefix+'-'+k;
      state.openFilterDropdown = state.openFilterDropdown===ddKey ? null : ddKey;
      rerender();
    });
    container.querySelectorAll('[data-mf-all]').forEach(cb=> cb.onclick=(e)=>{
      e.stopPropagation();
      const k = cb.dataset.mfAll, def = memberFilterDefs().find(d=>d.key===k);
      state.memberFilters[k] = cb.checked? def.opts.slice() : [];
      rerender();
    });
    // Riêng "Năm sinh": nếu đang ở trạng thái "chọn tất cả" mà bấm tích 1 năm cụ thể, bỏ chọn hết
    // các năm khác, chỉ giữ đúng năm vừa bấm — CHỈ áp dụng đúng 1 lần khi đang chọn tất cả.
    container.querySelectorAll('[data-mf-item]').forEach(cb=> cb.onclick=(e)=>{
      e.stopPropagation();
      const k = cb.dataset.mfItem, v = cb.dataset.mfVal;
      const def = memberFilterDefs().find(d=>d.key===k);
      const wasAll = state.memberFilters[k].length >= def.opts.length;
      // Bấm vào 1 năm BẤT KỲ khi đang "chọn tất cả" luôn thu về đúng 1 năm đó, bất kể lúc này
      // checkbox đang hiện checked hay chưa — vì khi đang thuộc "tất cả", chuột bấm vào ô ĐANG được
      // tích sẵn sẽ tự nhảy về chưa tích (hành vi gốc của trình duyệt) TRƯỚC khi code này chạy, nên
      // không thể dựa vào cb.checked để biết ý định của người dùng trong đúng trường hợp này.
      if(k==='birthYear' && wasAll){
        state.memberFilters[k] = [v];
      } else {
        const arr = state.memberFilters[k];
        state.memberFilters[k] = cb.checked? arr.concat([v]) : arr.filter(x=>x!==v);
      }
      rerender();
    });
    if(!container._mfOutsideBound){
      container._mfOutsideBound = true;
      document.addEventListener('click', (e)=>{
        if(!document.body.contains(container) || !state.openFilterDropdown) return;
        if(e.target.closest('.sv-filter-dropdown')) return;
        state.openFilterDropdown = null;
        if(document.body.contains(container)) rerender();
      });
    }
  }

  // ---------- XUẤT EXCEL / IN — DÙNG CHUNG CHO MEMBERS VÀ STRENGTH ----------
  function exportSectionsToExcel(filenameBase, reportTitle, sections){
    loadOptionalLibrary('xlsx').then(()=>{
      const maxCols = Math.max(1, ...sections.map(s=> s.cols.length));
      const headerLines = [['HỘI NÔNG DÂN'], [wardTitleUpper()], [provinceTitle()], [reportTitle], [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`], []];
      let aoa = [...headerLines];
      const merges = headerLines.map((line,r)=> line.length? {s:{r,c:0},e:{r,c:maxCols-1}} : null).filter(Boolean);
      const headerRows = [], titleRows = [];
      sections.forEach(sec=>{
        merges.push({ s:{r:aoa.length,c:0}, e:{r:aoa.length,c:maxCols-1} });
        titleRows.push(aoa.length);
        aoa.push([`${sec.title} (${sec.list.length})`.toUpperCase()]);
        headerRows.push(aoa.length);
        aoa.push(sec.cols.map(c=> plainLabel(c.label).toUpperCase()));
        sec.list.forEach(item=> aoa.push(sec.cols.map(c=> (c.getPlain||c.get)(item))));
        aoa.push([]);
      });
      merges.push({ s:{r:aoa.length,c:0}, e:{r:aoa.length,c:maxCols-1} });
      aoa.push(['https://hoinongdan.sotay.org']);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      headerRows.forEach(r=> applyExcelCellFormatting(ws, aoa, r));
      titleRows.forEach(r=> boldExcelRow(ws, r));
      boldExcelRow(ws, 3);
      ws['!merges'] = merges;
      ws['!cols'] = Array.from({length:maxCols}, ()=>({wch:18}));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, filenameBase.slice(0,28));
      XLSX.writeFile(wb, `${filenameBase}_${todayStr()}.xlsx`, {cellStyles:true});
    }).catch(e=>{ console.error('[Xuất Excel]', e); alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); });
  }
  function printSections(reportTitle, sections){
    const ncols = Math.max(1, ...sections.map(s=>s.cols.length));
    let fontSize = 12.5, pad = '6px 8px';
    if(ncols>16){ fontSize=7; pad='2px 3px'; }
    else if(ncols>12){ fontSize=8; pad='3px 4px'; }
    else if(ncols>9){ fontSize=9.5; pad='4px 5px'; }
    else if(ncols>6){ fontSize=11; pad='5px 6px'; }
    const sectionsHtml = sections.map(sec=>`
      <p style="font-weight:800; font-size:13px; margin:16px 0 6px;">${escapeHtml(sec.title)} (${sec.list.length})</p>
      <table class="print-table" style="font-size:${fontSize}px;">
        <thead><tr>${sec.cols.map(c=>`<th style="padding:${pad};">${htmlLabel(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${sec.list.length? sec.list.map(item=>`<tr>${sec.cols.map(c=>`<td style="padding:${pad};">${c.get(item)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${sec.cols.length}" style="padding:${pad};">Không có dữ liệu</td></tr>`}</tbody>
      </table>`).join('');
    const printInnerHtml = `
      <div style="text-align:center;">
        <div style="font-weight:800; font-size:14px;">${hoiNongDanTitleHtml()}</div>
        <div style="font-size:12.5px;">${escapeHtml(provinceTitle())}</div>
      </div>
      <div class="print-title" style="margin:10px 0 4px; text-align:center;">${escapeHtml(reportTitle.toUpperCase())}</div>
      <div style="text-align:center; font-size:12px; margin-bottom:10px;">Thời gian xuất: ${new Date().toLocaleString('vi-VN')}</div>
      ${sectionsHtml}
      <div style="text-align:center; margin-top:18px; font-size:11px;">https://hoinongdan.sotay.org</div>`;
    if(state.previewMode){
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg';
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:1000px;">
          <div class="modal-head"><h3>🖨️ Xem trước bản in</h3><button class="modal-close preview-allow" id="mbp-close">✕</button></div>
          <div class="modal-body" style="max-height:70vh; overflow:auto; background:#fff;">${printInnerHtml}</div>
          <div class="modal-foot">
            <span class="sub" style="margin-right:auto;">Đồng chí đang ở chế độ tham quan — đây chỉ là bản xem trước, không thể in thật.</span>
            <button class="btn btn-primary preview-allow" id="mbp-close2">Đóng</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = ()=> wrap.remove();
      wrap.querySelector('#mbp-close').onclick = close;
      wrap.querySelector('#mbp-close2').onclick = close;
      return;
    }
    const area = document.getElementById('print-area');
    if(!area) return;
    area.innerHTML = printInnerHtml;
    area.classList.add('landscape');
    window.print();
    setTimeout(()=> area.classList.remove('landscape'), 800);
  }

  // ---------- HỒ SƠ HỘI VIÊN — BẢNG EXCEL XEM TRƯỚC + CHỌN XUẤT/IN ----------
  // Dựng ĐÚNG 1 bảng theo đúng lựa chọn của người dùng — địa phương + mức độ thông tin — không còn
  // dựng cả chục bảng cùng lúc như trước. `scopeKey`: "__all__" hoặc tên 1 ấp cụ thể. `mode`:
  // "full" (Toàn bộ thông tin) hoặc "basic" (Thông tin cơ bản).
  function buildMembersViewSection(scopeKey, mode){
    const cols = mode==='full'? memberBasicCols().concat(memberAdvancedCols()) : memberBasicCols();
    const active = (state.members||[]).filter(m=>!m.deleted);
    const scoped = (!scopeKey || scopeKey==='__all__')? active : active.filter(m=>m.currentHamlet===scopeKey);
    const list = sortedMembersForDisplay(scoped);
    const scopeLbl = (!scopeKey || scopeKey==='__all__')? `Toàn ${adminLevelLabelLower()}` : `${subAdminLabel()} ${scopeKey}`;
    const modeLbl = mode==='full'? 'toàn bộ thông tin' : 'thông tin cơ bản';
    return { title: `${scopeLbl} (${modeLbl})`, list, cols };
  }
  // Modal chọn địa phương + mức độ thông tin — dùng CHUNG khung cho cả "Xem bảng Excel" (mặc định
  // Toàn bộ thông tin) và "Xuất file/In" (mặc định Thông tin cơ bản), chỉ khác mặc định ban đầu.
  function renderMembersViewOptionsModal(defaultMode, onConfirm){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let scopeKey = '__all__', mode = defaultMode;
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:440px;">
          <div class="modal-head"><h3>Chọn địa phương &amp; mức độ thông tin</h3><button class="modal-close preview-allow" id="mvo-close">✕</button></div>
          <div class="modal-body">
            <div class="field"><label>Địa phương</label>
              <select id="mvo-scope">
                <option value="__all__" ${scopeKey==='__all__'?'selected':''}>Toàn ${adminLevelLabelLower()}</option>
                ${orderedHamletsList().map(h=>`<option value="${escapeHtml(h)}" ${scopeKey===h?'selected':''}>${subAdminLabel()} ${escapeHtml(h)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Mức độ thông tin</label>
              <div class="toolbar">
                <button type="button" class="btn btn-sm preview-allow ${mode==='full'?'btn-primary':'btn-ghost'}" id="mvo-mode-full">Toàn bộ thông tin hội viên</button>
                <button type="button" class="btn btn-sm preview-allow ${mode==='basic'?'btn-primary':'btn-ghost'}" id="mvo-mode-basic">Thông tin cơ bản</button>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="mvo-cancel">Đóng bảng</button>
            <button class="btn btn-primary preview-allow" id="mvo-confirm">Tiếp tục</button>
          </div>
        </div>`;
      wrap.querySelector('#mvo-close').onclick = close;
      wrap.querySelector('#mvo-cancel').onclick = close;
      wrap.querySelector('#mvo-scope').onchange = (e)=>{ scopeKey = e.target.value; };
      wrap.querySelector('#mvo-mode-full').onclick = ()=>{ mode='full'; render(); };
      wrap.querySelector('#mvo-mode-basic').onclick = ()=>{ mode='basic'; render(); };
      wrap.querySelector('#mvo-confirm').onclick = ()=>{ close(); onConfirm(scopeKey, mode); };
    }
    render();
  }
  function renderMembersExcelViewModal(){
    renderMembersViewOptionsModal('full', (scopeKey, mode)=>{
      const section = buildMembersViewSection(scopeKey, mode);
      renderColumnHeaderExcelModal(`📊 Bảng Hồ sơ hội viên — ${section.title}`, [section], section.cols);
    });
  }
  function renderMembersExportSelectorModal(){
    renderMembersViewOptionsModal('basic', (scopeKey, mode)=>{
      const section = buildMembersViewSection(scopeKey, mode);
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg';
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:440px;">
          <div class="modal-head"><h3>📄 Xuất file/In — Hồ sơ hội viên</h3><button class="modal-close preview-allow" id="mes-close">✕</button></div>
          <div class="modal-body"><p class="sub">Xuất/in: <b>${escapeHtml(section.title)}</b> (${section.list.length} hội viên).</p></div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="mes-cancel">Đóng bảng</button>
            <button class="btn btn-ghost preview-allow" id="mes-print">🖨️ In</button>
            <button class="btn btn-primary preview-allow" id="mes-excel">⬇️ Xuất Excel</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = ()=> wrap.remove();
      wrap.querySelector('#mes-close').onclick = close;
      wrap.querySelector('#mes-cancel').onclick = close;
      wrap.querySelector('#mes-print').onclick = ()=>{ close(); printSections(`Hồ sơ hội viên — ${section.title}`, [section]); };
      wrap.querySelector('#mes-excel').onclick = ()=>{ close(); exportSectionsToExcel('Ho-so-hoi-vien', `BÁO CÁO HỒ SƠ HỘI VIÊN — ${section.title.toUpperCase()}`, [section]); };
    });
  }

  // ---------- MODAL THÊM/SỬA HỒ SƠ (thủ công) ----------
  const MEMBER_BASIC_FIELD_ROWS = [
    ['fullName','Họ và tên',true], ['birthYear','Năm sinh',false], ['gender','Giới tính',false], ['ethnicity','Dân tộc',false], ['religion','Tôn giáo',false],
    ['cccd','Số CCCD',false], ['educationLevel','Trình độ văn hoá',false], ['joinYear','Năm vào hội',false], ['cardYear','Năm cấp thẻ hội viên',false],
    ['currentHamlet','Nơi ở hiện nay',true], ['oldHamlet','Nơi ở trước sáp nhập',false], ['position','Chức vụ hiện nay',false], ['partyMember','Đảng viên',false],
    ['phone','Số điện thoại',false], ['removedDate','Ngày xoá tên',false], ['removedReason','Lý do xoá tên',false],
  ];
  const MEMBER_ADVANCED_FIELD_ROWS = [
    ['area','Diện tích sản xuất (ha)'], ['mainIndustry','Ngành nghề SXKD chính'], ['avgIncome','Mức thu nhập bình quân/năm (triệu đồng)'], ['laborCount','Lao động tham gia SX'],
    ['coopGroup','Tham gia tổ hợp tác/HTX'], ['productionType','Loại hình sản xuất'], ['mainCrop','Cây trồng, vật nuôi chính'], ['scale','Quy mô sản xuất'],
    ['techLevel','Mức độ ứng dụng KH-KT'], ['product','Sản phẩm tiêu biểu'], ['salesChannel','Kênh tiêu thụ sản phẩm'],
    ['goodFarmerTitle','Đăng ký danh hiệu NDSXKD giỏi'], ['activityLevel','Mức độ tham gia sinh hoạt Hội'],
  ];
  const MEMBER_ADVANCED_TEXTAREA_ROWS = [
    ['advantage','Thuận lợi'], ['difficulty','Khó khăn'], ['proposal','Kiến nghị, đề xuất'], ['chiHoiComment','Nhận xét của Chi hội trưởng'], ['proposalToWard','Đề xuất với Hội Nông dân xã'],
  ];
  function memberFieldRowHtml(key, label, value, opts){
    opts = opts||{};
    const control = memberFieldControlHtml(key, 'mf-'+key, value);
    const liveSpan = opts.live? ` <span class="sub" id="mf-${key}-disp" style="font-weight:700; color:#b71c1c;"></span>` : '';
    return `<div class="field" style="${opts.full?'grid-column:1/-1;':''}"><label>${escapeHtml(label)}${opts.required?' *':''}${liveSpan}</label>${control}</div>`;
  }
  function renderMemberFormModal(existing, onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const isNew = !existing;
    let m = existing? {...existing} : emptyMember();
    let tab = 'basic';
    const close = ()=> wrap.remove();
    function render(){
      const basicHtml = `<div class="form-grid">
        ${MEMBER_BASIC_FIELD_ROWS.map(([key,label,required])=> memberFieldRowHtml(key,label,m[key],{required})).join('')}
        <div style="grid-column:1/-1;"><label class="sv-filter-item" style="display:inline-flex; cursor:pointer;"><input type="checkbox" id="mf-isCore" ${m.isCore?'checked':''}><span>Hội viên nòng cốt</span></label></div>
        ${memberFieldRowHtml('note','Ghi chú', m.note, {full:true})}
        <div style="grid-column:1/-1; border-top:1px solid var(--line); padding-top:10px;">
          <label class="sv-filter-item" style="display:inline-flex; cursor:pointer;"><input type="checkbox" id="mf-needsVerify" ${m.needsVerify?'checked':''}><span>🚩 Đánh dấu hồ sơ này cần xác minh thêm</span></label>
        </div>
        ${m.needsVerify? memberFieldRowHtml('needsVerifyNote','Ghi chú cần xác minh gì', m.needsVerifyNote, {full:true}) : ''}
      </div>`;
      const advancedHtml = `<div class="form-grid">
        ${MEMBER_ADVANCED_FIELD_ROWS.map(([key,label])=> memberFieldRowHtml(key,label,m[key],{live:key==='avgIncome'})).join('')}
        ${MEMBER_ADVANCED_TEXTAREA_ROWS.map(([key,label])=> memberFieldRowHtml(key,label,m[key],{full:true})).join('')}
      </div>`;
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:760px;">
          <div class="modal-head"><h3>${isNew?'➕ Thêm hội viên':'✏️ Sửa hồ sơ hội viên'}</h3><button class="modal-close preview-allow" id="mf-close">✕</button></div>
          <div class="modal-body">
            <div class="toolbar" style="margin-bottom:12px;">
              <button type="button" class="btn btn-sm preview-allow ${tab==='basic'?'btn-primary':'btn-ghost'}" id="mf-tab-basic">Thông tin cơ bản</button>
              <button type="button" class="btn btn-sm preview-allow ${tab==='advanced'?'btn-primary':'btn-ghost'}" id="mf-tab-advanced">Thông tin sản xuất — nâng cao</button>
            </div>
            ${tab==='basic'? basicHtml : advancedHtml}
          </div>
          <div class="modal-foot">
            ${!isNew? `<button class="btn btn-danger preview-allow" id="mf-delete" style="margin-right:auto;">Xoá (chuyển vào thùng rác)</button>` : ''}
            <button class="btn btn-ghost preview-allow" id="mf-cancel">Đóng bảng quay lại</button>
            <button class="btn btn-primary preview-allow" id="mf-save">💾 Lưu hồ sơ</button>
          </div>
        </div>`;
      wire();
    }
    function readFormIntoM(){
      Object.keys(memberFieldTypeRegistry()).forEach(key=>{
        const el = wrap.querySelector('#mf-'+key);
        if(!el) return;
        m[key] = el.type==='checkbox' ? el.checked : el.value;
      });
      const nvEl = wrap.querySelector('#mf-needsVerify'); if(nvEl) m.needsVerify = nvEl.checked;
      const coreEl = wrap.querySelector('#mf-isCore'); if(coreEl) m.isCore = coreEl.checked;
    }
    function wire(){
      wrap.querySelector('#mf-close').onclick = close;
      wrap.querySelector('#mf-cancel').onclick = close;
      wrap.querySelector('#mf-tab-basic').onclick = ()=>{ readFormIntoM(); tab='basic'; render(); };
      wrap.querySelector('#mf-tab-advanced').onclick = ()=>{ readFormIntoM(); tab='advanced'; render(); };
      Object.keys(memberFieldTypeRegistry()).forEach(key=>{
        wireMemberFieldControl(wrap, key, 'mf-'+key, ()=>{ readFormIntoM(); render(); });
      });
      const needsVerifyEl = wrap.querySelector('#mf-needsVerify');
      if(needsVerifyEl) needsVerifyEl.onchange = ()=>{ readFormIntoM(); render(); };
      // Hiển thị sống "= xx xxx đ" cho Mức thu nhập bình quân/năm — y hệt ô "Số tiền thực tế vay".
      const incomeInput = wrap.querySelector('#mf-avgIncome');
      const incomeDisp = wrap.querySelector('#mf-avgIncome-disp');
      if(incomeInput && incomeDisp){
        const updateIncomeDisp = ()=>{ const digits = incomeInput.value.replace(/[^\d]/g,''); incomeDisp.textContent = digits? `= ${groupDigitsRight(digits,3)} triệu đồng` : ''; };
        incomeInput.addEventListener('input', updateIncomeDisp);
        updateIncomeDisp();
      }
      wrap.querySelector('#mf-save').onclick = async ()=>{
        readFormIntoM();
        if(!m.fullName || !m.fullName.trim()){ alert('Vui lòng nhập Họ và tên.'); return; }
        if(!m.currentHamlet){ alert('Vui lòng chọn Nơi ở hiện nay — chưa thể lưu khi còn để "(Chưa rõ)".'); return; }
        await saveMember(m);
        if(window.__instantRemoveModal) window.__instantRemoveModal(wrap); else close();
        if(onSaved) onSaved();
      };
      const deleteBtn = wrap.querySelector('#mf-delete');
      if(deleteBtn) deleteBtn.onclick = async ()=>{
        if(!confirm('Chuyển hội viên này vào thùng rác?')) return;
        await softDeleteMember(m.id);
        if(window.__instantRemoveModal) window.__instantRemoveModal(wrap); else close();
        showToast('Đã đưa vào thùng rác.');
        if(onSaved) onSaved();
      };
    }
    render();
  }

  // ---------- "THÊM NHANH BẰNG AI" (nhân bản khung chat của Sổ vay vốn — xem renderQuickAddByAiModal
  // ở 09-ai-chat-notes.js — chỉ khác hồ sơ đang soạn là 1 mảng hội viên đơn). "Hồ sơ đang soạn" cho
  // sửa tay THOẢI MÁI kể cả khi chưa chat với AI — mỗi lượt AI làm việc đều đọc lại đúng hồ sơ này. ----------
  const MEMBER_QUICKADD_COLS = [
    ['fullName','Họ và tên'], ['currentHamlet','Nơi ở hiện nay'], ['oldHamlet','Nơi ở trước sáp nhập'],
    ['birthYear','Năm sinh'], ['gender','Giới tính'], ['ethnicity','Dân tộc'], ['religion','Tôn giáo'],
    ['cccd','Số CCCD'], ['educationLevel','Trình độ văn hoá'], ['joinYear','Năm vào hội'], ['cardYear','Năm cấp thẻ'],
    ['isCore','Hội viên nòng cốt'], ['position','Chức vụ hiện nay'], ['partyMember','Đảng viên'],
    ['removedDate','Ngày xoá tên'], ['removedReason','Lý do xoá tên'], ['phone','Số điện thoại'], ['note','Ghi chú'],
    ['area','Diện tích SX (ha)'], ['mainIndustry','Ngành nghề SXKD'], ['avgIncome','Thu nhập BQ/năm (tr.đ)'], ['laborCount','LĐ tham gia SX'],
    ['coopGroup','THT/HTX'], ['productionType','Loại hình SX'], ['mainCrop','Cây trồng/vật nuôi'], ['scale','Quy mô SX'],
    ['techLevel','Mức ứng dụng KH-KT'], ['product','Sản phẩm tiêu biểu'], ['salesChannel','Kênh tiêu thụ'], ['goodFarmerTitle','Danh hiệu NDSXKD giỏi'],
    ['activityLevel','Mức sinh hoạt Hội'], ['advantage','Thuận lợi'], ['difficulty','Khó khăn'], ['proposal','Kiến nghị'],
    ['chiHoiComment','NX Chi hội trưởng'], ['proposalToWard','Đề xuất với Hội xã'],
  ];
  const MEMBER_QUICKADD_REQUIRED = [['fullName','Họ và tên'], ['currentHamlet','Nơi ở hiện nay']];
  function emptyMemberQuickAddRow(){
    const o = {}; MEMBER_QUICKADD_COLS.forEach(([k])=>{ o[k] = k==='isCore'? false : ''; }); return o;
  }
  function memberQuickAddSystemPrompt(){
    const hamlets = (state.config.hamlets||[]).join(', ') || '(chưa có)';
    const hamletsOld = (state.config.hamletsLegacyHidden||[]).map(h=> h.endsWith(' (cũ)')? h.slice(0,-5) : h).join(', ') || '(chưa có)';
    const genders = memberGenderOptions().join(', ');
    const ethnicities = memberEthnicityOptions().join(', ');
    const religions = memberReligionOptions().join(', ');
    const positions = memberPositionOptions().join(', ');
    const subAdminUnit = subAdminLabel();
    return `Bạn là trợ lý AI giúp NHẬP NHANH hồ sơ hội viên vào module "Hồ sơ hội viên" của Hội Nông dân. LUÔN gọi người dùng là "đồng chí", tuyệt đối không gọi là "bạn" hay "anh/chị". Đọc tin nhắn văn bản + tài liệu đính kèm (ảnh CCCD, đơn xin vào Hội, sổ ghi chép tay, danh sách in sẵn...) người dùng cung cấp qua nhiều lượt trò chuyện, trích xuất đúng thông tin để THÊM MỚI hội viên vào "Hồ sơ đang soạn".
CÁCH LÀM VIỆC CỐT LÕI — "1 HỒ SƠ DUY NHẤT": người dùng luôn có sẵn 1 "Hồ sơ đang soạn" duy nhất (có thể người dùng đã TỰ TAY thêm/sửa sẵn vài hội viên trước khi chat với bạn, hoặc vẫn đang RỖNG) — đây là hồ sơ DUY NHẤT bạn và người dùng cùng làm việc trên đó. Ở CUỐI mỗi tin nhắn của người dùng, bạn LUÔN được cung cấp đúng nội dung Hồ sơ đang soạn HIỆN TẠI — PHẢI đọc kỹ TRƯỚC khi trả lời, rồi CHỈNH SỬA TRỰC TIẾP lên đúng hồ sơ đó (thêm/sửa/xoá hội viên tuỳ theo yêu cầu), LUÔN trả về ĐẦY ĐỦ toàn bộ hồ sơ đã cập nhật trong khối \`\`\`memberadd-result\`\`\` mỗi khi có điều gì thay đổi.
QUY TẮC BẮT BUỘC:
1) CHỈ ĐƯỢC PHÉP THÊM MỚI — không được sửa hội viên nào đã có sẵn trong hệ thống (khác với hội viên đang nằm trong Hồ sơ đang soạn, vốn chưa được lưu nên vẫn sửa được thoải mái).
2) Trường BẮT BUỘC không được để trống: Họ và tên, Nơi ở hiện nay (${subAdminUnit}). Nếu thiếu, PHẢI hỏi lại người dùng, đừng tự bịa.
3) VỀ ĐỊA CHỈ: "currentHamlet" CHỈ chứa tên ${subAdminUnit} HIỆN NAY (không kèm chữ "${subAdminUnit}" phía trước), danh sách đã có sẵn: ${hamlets}. "oldHamlet" là tên ${subAdminUnit} TRƯỚC SÁP NHẬP, danh sách đã có: ${hamletsOld} (hệ thống tự thêm "(cũ)" khi hiển thị, không cần tự thêm). Nếu người dùng nói 1 tên không khớp danh sách nào, hỏi lại đây là hiện nay hay trước sáp nhập; nếu xác nhận là MỚI thì thêm vào "newHamlets" (hiện nay) hoặc "newHamletsOld" (trước sáp nhập, không kèm "(cũ)").
4) "gender" ưu tiên 1 trong: ${genders}. "ethnicity" ưu tiên 1 trong: ${ethnicities} (dân tộc mới hoàn toàn chưa có -> "newEthnicities"). "religion" ưu tiên 1 trong: ${religions} (tôn giáo mới -> "newReligions"). "position" ưu tiên 1 trong: ${positions} (chức vụ mới -> "newPositions", CHỈ dùng khi rõ ràng không khớp bất kỳ chức vụ nào đã có). "partyMember" là "Có", "Không" hoặc để trống "" nếu người dùng không nói gì tới việc là Đảng viên hay không (KHÔNG tự suy đoán là "Không" khi chưa rõ).
5) "isCore" là true/false (hội viên nòng cốt) — mặc định false nếu không rõ.
6) Năm sinh/năm vào hội/năm cấp thẻ là số (VD 1972) — không bịa năm nếu chưa có thông tin. "avgIncome"/"laborCount"/"area" chỉ điền số khi người dùng có cung cấp, không tự bịa.
7) "goodFarmerTitle" ưu tiên 1 trong: "Không","Cấp xã/phường","Cấp tỉnh/TP","Cấp TW" — để trống nếu chưa rõ. "activityLevel" ưu tiên 1 trong: "Thường xuyên","Thỉnh thoảng","Không thường xuyên","Hầu như không" — để trống nếu chưa rõ.
8) KHÔNG BỎ SÓT dữ liệu đã cung cấp; thông tin không xếp được vào trường nào thì cho vào "note".
9) CÁCH TRẢ LỜI: luôn trả lời trò chuyện tự nhiên trước (không bọc JSON). Nếu đã trích xuất được ít nhất 1 hội viên, thêm NGAY CUỐI câu trả lời khối mã sau, ĐÚNG định dạng, LUÔN gồm đủ các trường (để trống "" những trường chưa có thông tin):
\`\`\`memberadd-result
{"members":[{"fullName":"","currentHamlet":"","oldHamlet":"","birthYear":"","gender":"","ethnicity":"","religion":"","cccd":"","educationLevel":"","joinYear":"","cardYear":"","isCore":false,"position":"","partyMember":"","removedDate":"","removedReason":"","phone":"","note":"","area":"","mainIndustry":"","avgIncome":"","laborCount":"","coopGroup":"","productionType":"","mainCrop":"","scale":"","techLevel":"","product":"","salesChannel":"","goodFarmerTitle":"","activityLevel":"","advantage":"","difficulty":"","proposal":"","chiHoiComment":"","proposalToWard":""}],"newHamlets":[],"newHamletsOld":[],"newEthnicities":[],"newReligions":[],"newPositions":[]}
\`\`\`
Nếu chưa đủ dữ liệu để trích xuất, KHÔNG thêm khối này, chỉ trò chuyện/hỏi lại bình thường.`;
  }
  async function mqaiConfirmAndAdd(latestResult, closeFn){
    if(!(latestResult.members||[]).length) return;
    const skipped = [];
    const toAdd = (latestResult.members||[]).filter((b,i)=>{
      const missing = MEMBER_QUICKADD_REQUIRED.filter(([k])=>!b[k]).map(([,l])=>l);
      if(missing.length){ skipped.push(`Hội viên #${i+1} (${b.fullName||'chưa có tên'}): thiếu "${missing.join('", "')}"`); return false; }
      return true;
    });
    if(skipped.length){
      const ok = confirm(`⚠️ Có ${skipped.length} hội viên thiếu thông tin bắt buộc:\n\n${skipped.join('\n')}\n\nBấm "Có" để lưu những hội viên còn lại, bỏ qua các hội viên này. Bấm "Huỷ" để quay lại bổ sung.`);
      if(!ok) return;
    }
    if(!toAdd.length){ alert('Không có hội viên hợp lệ nào để thêm.'); return; }
    if(!confirm(`Đồng chí có CHẮC CHẮN muốn thêm ${toAdd.length} hội viên mới vào Hồ sơ hội viên không?`)) return;
    closeFn();
    showProcessingToast();
    try{
      for(const b of toAdd){
        const m = emptyMember();
        MEMBER_QUICKADD_COLS.forEach(([k])=>{ if(k in b) m[k] = b[k]; });
        m.fullName = b.fullName||''; m.currentHamlet = b.currentHamlet||'';
        m.oldHamlet = b.oldHamlet? (b.oldHamlet.endsWith(' (cũ)')?b.oldHamlet:`${b.oldHamlet} (cũ)`) : '';
        m.isCore = !!b.isCore; m.position = b.position||memberPositionOptions()[0]; m.partyMember = (b.partyMember==='Có'||b.partyMember==='Không')? b.partyMember : '';
        await cSetRecord('members', m.id, m);
      }
      hideProcessingToast();
      showBigToast('Đã thêm thành công vào Hồ sơ hội viên!');
      const el = document.getElementById('content'); if(el) renderMembersTab(el);
    }catch(err){
      hideProcessingToast();
      console.error('Lỗi khi thêm hội viên:', err);
      alert('Có lỗi khi thêm hội viên: '+(err&&err.message||err));
    }
  }
  function renderMemberQuickAddFilePreviewModal(result, onClose){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const close = ()=>{ wrap.remove(); if(onClose) onClose(); };
    let zoomPct = 100;
    const ZOOM_MIN = 50, ZOOM_MAX = 200, ZOOM_STEP = 10;
    function render(){
      const list = result.members||[];
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:90vh; max-height:90vh; display:flex; flex-direction:column; border-radius:0;">
          <div class="modal-head"><h3>📋 Hồ sơ đang soạn — ${list.length} hội viên</h3><button class="modal-close preview-allow" id="mqfp-close">✕</button></div>
          <div style="padding:8px 14px; border-bottom:1px solid var(--line);">
            <button type="button" class="btn btn-primary btn-sm preview-allow" id="mqfp-add-row">➕ Thêm hội viên (nhập tay, không cần chat với AI)</button>
          </div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:0;">
            <div style="zoom:${zoomPct}%;">
            <div class="table-wrap"><table>
              <thead><tr><th></th><th></th>${MEMBER_QUICKADD_COLS.map(([,label])=>`<th>${escapeHtml(label)}</th>`).join('')}</tr></thead>
              <tbody>${list.length? list.map((b,i)=>`<tr>
                <td><button type="button" class="btn btn-ghost btn-sm preview-allow" data-mqfp-del="${i}">🗑️</button></td>
                <td>${i+1}</td>
                ${MEMBER_QUICKADD_COLS.map(([k])=> `<td style="min-width:90px;">${memberFieldControlHtml(k, `mqfp-${i}-${k}`, b[k])}</td>`).join('')}
              </tr>`).join('') : `<tr><td colspan="${MEMBER_QUICKADD_COLS.length+2}" style="text-align:center; padding:14px;">Chưa có hội viên nào trong hồ sơ đang soạn — bấm "➕ Thêm hội viên" bên trên hoặc chat với AI.</td></tr>`}</tbody>
            </table></div>
            </div>
          </div>
          <div class="modal-foot">
            <div style="display:flex; align-items:center; gap:6px; margin-right:auto;">
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mqfp-zoom-out" ${zoomPct<=ZOOM_MIN?'disabled':''}>➖</button>
              <span style="font-weight:700; min-width:42px; text-align:center;">${zoomPct}%</span>
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mqfp-zoom-in" ${zoomPct>=ZOOM_MAX?'disabled':''}>➕</button>
            </div>
            <button class="btn btn-primary preview-allow" id="mqfp-close2">Đóng bảng</button>
          </div>
        </div>`;
      wrap.querySelector('#mqfp-close').onclick = close;
      wrap.querySelector('#mqfp-close2').onclick = close;
      wrap.querySelector('#mqfp-zoom-in').onclick = ()=>{ zoomPct = Math.min(ZOOM_MAX, zoomPct+ZOOM_STEP); render(); };
      wrap.querySelector('#mqfp-zoom-out').onclick = ()=>{ zoomPct = Math.max(ZOOM_MIN, zoomPct-ZOOM_STEP); render(); };
      wrap.querySelector('#mqfp-add-row').onclick = ()=>{ list.push(emptyMemberQuickAddRow()); render(); };
      list.forEach((b,i)=>{
        MEMBER_QUICKADD_COLS.forEach(([k])=>{
          wireMemberFieldControl(wrap, k, `mqfp-${i}-${k}`, ()=> render(), (v)=>{ b[k] = v; });
        });
      });
      wrap.querySelectorAll('[data-mqfp-del]').forEach(btn=> btn.onclick = ()=>{
        if(!confirm('Xoá hội viên này khỏi hồ sơ đang soạn?')) return;
        list.splice(parseInt(btn.dataset.mqfpDel,10),1); render();
      });
    }
    render();
  }
  function renderMemberQuickAddByAiModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const closeImmediate = ()=>{ state._mqaiAddMenuOpen = false; wrap.remove(); };
    const close = ()=>{
      if(resultIsEmpty()){ closeImmediate(); return; }
      const n = (latestResult.members||[]).length;
      if(confirm(`⚠️ "Hồ sơ đang soạn" (${n} hội viên) hiện CHƯA được lưu.\n\nNếu đóng bảng bây giờ, dữ liệu này sẽ BIẾN MẤT VĨNH VIỄN.\n\nBấm "Có" để tiếp tục đóng (mất dữ liệu), hoặc "Huỷ" để quay lại.`)){ closeImmediate(); }
    };
    const messages = [];
    let pendingAttachments = [];
    let hasDigestedOnce = false;
    let latestResult = { members:[] };
    function resultIsEmpty(){ return !(latestResult.members||[]).length; }
    let busy = false;
    let editingIndex = null;

    function fmtAttachChip(a){ return `<span class="ai-attach-chip">📎 ${escapeHtml(a.name)}</span>`; }
    function bubbleHtml(mm, idx){
      const isUser = mm.role==='user';
      if(mm.streaming){
        return `<div style="display:flex; justify-content:flex-start; margin-bottom:10px;">
          <div id="mqai-streaming-bubble" style="max-width:75%; background:#e3f2fd; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${mm.text? renderMarkdownLite(mm.text) : waveTextHtml('Chàng đang suy nghĩ…')}</div>
        </div>`;
      }
      if(editingIndex===idx){
        return `<div style="margin-bottom:10px;">
          <textarea id="mqai-edit-textarea" rows="3" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid var(--line);">${escapeHtml(mm.text)}</textarea>
          <div style="text-align:right; margin-top:6px; display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn btn-ghost btn-sm preview-allow" id="mqai-edit-cancel">Huỷ bỏ</button>
            <button class="btn btn-primary btn-sm preview-allow" id="mqai-edit-resend">Gửi lại</button>
          </div>
        </div>`;
      }
      let inner;
      if(mm.isFileCard){
        const totalCount = (mm.result.members||[]).length;
        inner = `<button type="button" class="btn btn-sm preview-allow" data-file-card="${idx}" style="background:#fff9c4; border:1px solid #fbc02d; color:#5a4300; font-weight:700;">📄 Bản tổng hợp — ${totalCount} hội viên (bấm để xem chi tiết)</button>`;
      } else {
        inner = isUser? escapeHtml(mm.text||'') : renderMarkdownLite(mm.text||'');
      }
      if(mm.attachments && mm.attachments.length) inner += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${mm.attachments.map(fmtAttachChip).join('')}</div>`;
      return `<div style="display:flex; flex-direction:column; align-items:${isUser?'flex-end':'flex-start'}; margin-bottom:10px;">
        <div style="max-width:75%; background:${isUser?'#dcedc8':'#e3f2fd'}; border-radius:12px; padding:10px 14px; font-size:13.5px; line-height:1.6;">${inner}</div>
        ${!mm.isFileCard? `<div style="display:flex; gap:4px; margin-top:3px;">
          ${isUser? `<button class="btn-plain-icon preview-allow" data-bubble-edit="${idx}" title="Sửa" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">✏️</button>` : ''}
          <button class="btn-plain-icon preview-allow" data-bubble-copy="${idx}" title="Sao chép" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">📋</button>
          <button class="btn-plain-icon preview-allow" data-bubble-delete="${idx}" title="Xoá tin nhắn này" style="font-size:12px; background:none; border:none; cursor:pointer; opacity:.6;">🗑️</button>
        </div>` : ''}
      </div>`;
    }

    function render(){
      const hasAnyUserContent = messages.some(mm=>mm.role==='user') || pendingAttachments.length>0;
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:100vh; max-height:100vh; border-radius:0; display:flex; flex-direction:column;">
          <div class="modal-head"><h3>✨ Thêm nhanh Hội viên bằng chat với AI</h3><button class="modal-close preview-allow" id="mqai-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column;" id="mqai-thread">
            ${messages.length? messages.map(bubbleHtml).join('') : `<p class="sub" style="text-align:center; margin:auto;">Hãy nhắn tin hoặc đính kèm tài liệu (ảnh CCCD, đơn xin vào Hội, sổ ghi chép cũ...) — AI sẽ đợi đến khi đồng chí bấm "🧠 Tiêu hoá tài liệu bằng AI" mới bắt đầu đọc. Đồng chí cũng có thể tự thêm/sửa hội viên bằng tay ngay trong "Hồ sơ đang soạn" bên dưới, không cần chờ chat với AI.</p>`}
          </div>
          <div style="padding:8px 16px 0; background:var(--paper-2);">
            <div style="text-align:center; margin-bottom:8px;">
              <button type="button" class="btn btn-sm preview-allow" id="mqai-view-file" style="background:#fff9c4; border:1px solid #fbc02d; color:#5a4300; font-weight:700;">📋 Hồ sơ đang soạn — ${(latestResult.members||[]).length} hội viên (bấm để xem/sửa)</button>
            </div>
            <p class="sub" style="margin:0 0 8px;">${hasDigestedOnce? 'Hệ thống đã đọc được nội dung bên trên. Nếu muốn bổ sung/sửa gì thì nhắn tiếp, AI sẽ tự cập nhật lại Hồ sơ đang soạn.' : 'Chưa tiêu hoá tài liệu nào — nhắn/đính kèm xong thì bấm nút bên dưới.'}</p>
            ${pendingAttachments.length? `<div class="ai-attach-row" style="padding:0 0 8px;">${pendingAttachments.map((a,i)=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)} <button type="button" class="preview-allow" data-remove-att="${i}">✕</button></span>`).join('')}</div>` : ''}
            <input type="file" id="mqai-file-input" multiple accept="*/*" style="display:none;">
            <div class="ai-inputbar">
              <div class="ai-add-btn" id="mqai-add-btn" role="button" tabindex="0">➕<span class="ai-add-label"> THÊM THÀNH PHẦN</span>
                ${state._mqaiAddMenuOpen? `<div class="ai-add-menu">
                  <div class="ai-add-opt" data-mqai-add="image">🖼️ Tải ảnh lên</div>
                  <div class="ai-add-opt" data-mqai-add="doc">📄 Tải tài liệu lên</div>
                  <div class="ai-add-opt${state._mqaiMic2Listening?' ai-add-opt-disabled':''}" data-mqai-add="mic">🎤 ${state._mqaiMicListening? '✅ Đang nghe — bấm để dừng' : 'Vừa nói vừa ra chữ'}</div>
                  <div class="ai-add-opt${state._mqaiMicListening?' ai-add-opt-disabled':''}" data-mqai-add="mic2">🎙️ ${state._mqaiMic2Listening? '✅ Đang nghe — bấm để dừng' : 'Nói xong mới ra chữ'}</div>
                </div>` : ''}
              </div>
              <textarea id="mqai-input" rows="1" placeholder="Nhắn tin cho AI... (Enter để xuống dòng, Ctrl+Enter để gửi)"></textarea>
              <div class="ai-send-wrap"><button id="mqai-send-btn">➤</button></div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="mqai-close2">Đóng bảng</button>
            <button type="button" class="btn btn-sm preview-allow" id="mqai-digest" ${(busy||!hasAnyUserContent)?'disabled':''} style="background:linear-gradient(180deg, #ffffff 0%, #7c4dff 45%, #4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700; ${(busy||!hasAnyUserContent)?'opacity:.5;':''}">${busy?'⏳ AI đang xử lý...':'🧠 Tiêu hoá tài liệu bằng AI'}</button>
            <button class="btn btn-primary preview-allow" id="mqai-add" ${resultIsEmpty()?'disabled':''} style="${resultIsEmpty()?'opacity:.45; cursor:not-allowed;':'display:inline-block; animation: bigMoneyPulse 1.4s ease-in-out infinite;'}">➕ Thêm vào Hồ sơ hội viên</button>
          </div>
        </div>`;
      wrap.querySelector('#mqai-close').onclick = close;
      wrap.querySelector('#mqai-close2').onclick = close;
      wrap.onclick = (e)=>{ if(state._mqaiAddMenuOpen && !e.target.closest('#mqai-add-btn')){ state._mqaiAddMenuOpen=false; render(); } };
      const threadEl = wrap.querySelector('#mqai-thread'); if(threadEl) threadEl.scrollTop = threadEl.scrollHeight;
      wrap.querySelectorAll('[data-file-card]').forEach(btn=> btn.onclick = ()=>{ const mm=messages[parseInt(btn.dataset.fileCard,10)]; if(mm&&mm.result) renderMemberQuickAddFilePreviewModal(mm.result); });
      const viewFileBtn = wrap.querySelector('#mqai-view-file'); if(viewFileBtn) viewFileBtn.onclick = ()=> renderMemberQuickAddFilePreviewModal(latestResult, render);
      wrap.querySelectorAll('[data-remove-att]').forEach(btn=> btn.onclick = ()=>{ pendingAttachments.splice(parseInt(btn.dataset.removeAtt,10),1); render(); });
      wrap.querySelectorAll('[data-bubble-delete]').forEach(btn=> btn.onclick = ()=>{ if(!confirm('Xoá tin nhắn này khỏi cuộc trò chuyện?')) return; messages.splice(parseInt(btn.dataset.bubbleDelete,10),1); render(); });
      wrap.querySelectorAll('[data-bubble-copy]').forEach(btn=> btn.onclick = ()=>{ const mm=messages[parseInt(btn.dataset.bubbleCopy,10)]; if(mm) writeClipboardSilent(mm.text||''); showToast('Đã sao chép!'); });
      wrap.querySelectorAll('[data-bubble-edit]').forEach(btn=> btn.onclick = ()=>{ editingIndex=parseInt(btn.dataset.bubbleEdit,10); render(); });
      const editCancelBtn = wrap.querySelector('#mqai-edit-cancel'); if(editCancelBtn) editCancelBtn.onclick = ()=>{ editingIndex=null; render(); };
      const editResendBtn = wrap.querySelector('#mqai-edit-resend'); if(editResendBtn) editResendBtn.onclick = ()=>{
        const ta = wrap.querySelector('#mqai-edit-textarea'); const newText = (ta.value||'').trim();
        messages[editingIndex].text = newText; messages.length = editingIndex+1; editingIndex = null;
        if(hasDigestedOnce){ render(); runAiTurn(); } else render();
      };
      const addMenuBtn = wrap.querySelector('#mqai-add-btn');
      if(addMenuBtn) addMenuBtn.addEventListener('click', (e)=>{
        e.stopPropagation(); state._mqaiAddMenuOpen = !state._mqaiAddMenuOpen;
        const inputEl = wrap.querySelector('#mqai-input'); const savedValue = inputEl? inputEl.value : '';
        render();
        const inputElAfter = wrap.querySelector('#mqai-input'); if(inputElAfter && savedValue) inputElAfter.value = savedValue;
        if(inputElAfter) autoResizeTextarea(inputElAfter);
      });
      wrap.querySelectorAll('[data-mqai-add]').forEach(elx=> elx.addEventListener('click', (e)=>{
        e.stopPropagation(); state._mqaiAddMenuOpen = false;
        if(elx.dataset.mqaiAdd==='mic'){ wrap.querySelector('#mqai-add-btn .ai-add-menu')?.remove(); toggleMicGeneric('mqai', render); return; }
        if(elx.dataset.mqaiAdd==='mic2'){ wrap.querySelector('#mqai-add-btn .ai-add-menu')?.remove(); toggleMic2Generic('mqai', render); return; }
        wrap.querySelector('#mqai-file-input').click();
      }));
      wrap.querySelector('#mqai-file-input').onchange = async (e)=>{
        const files = Array.from(e.target.files||[]);
        for(const f of files){ const base64 = await fileToBase64(f); pendingAttachments.push({ name:f.name, mimeType:f.type||'application/octet-stream', base64 }); }
        render();
      };
      wrap.querySelector('#mqai-send-btn').onclick = ()=>{ doSend(); scrollNearestModalToBottom(wrap); };
      wireAutoResizeTextarea('mqai-input');
      wrap.querySelector('#mqai-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter' && e.ctrlKey){ e.preventDefault(); doSend(); } });
      wrap.querySelector('#mqai-input').addEventListener('focus', ()=> scrollNearestModalToBottom(wrap));
      wrap.querySelector('#mqai-digest').onclick = ()=> runAiTurn();
      const addBtn = wrap.querySelector('#mqai-add'); if(addBtn) addBtn.onclick = ()=> mqaiConfirmAndAdd(latestResult, closeImmediate);
    }

    function doSend(){
      const inputEl = wrap.querySelector('#mqai-input'); const text = (inputEl.value||'').trim();
      if(!text && !pendingAttachments.length) return;
      messages.push({ role:'user', text, attachments: pendingAttachments });
      pendingAttachments = []; inputEl.value = '';
      if(hasDigestedOnce){ render(); runAiTurn(); } else render();
    }

    async function runAiTurn(){
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
      if(busy) return;
      busy = true;
      const streamMsg = { role:'ai', text:'', streaming:true };
      messages.push(streamMsg); render();
      try{
        const aiMessages = [{ role:'user', text: memberQuickAddSystemPrompt() }, { role:'assistant', text:'Đã hiểu, tôi sẽ tuân thủ đúng định dạng trả lời yêu cầu.' }];
        messages.forEach(mm=>{
          if(mm===streamMsg) return;
          if(mm.isFileCard) return;
          let t = mm.text||'';
          if(mm.attachments && mm.attachments.length) t += ` (kèm ${mm.attachments.length} tài liệu đính kèm)`;
          aiMessages.push({ role: mm.role==='user'?'user':'assistant', text: t || '(tệp đính kèm)' });
        });
        aiMessages.push({ role:'user', text:`[Đây là "Hồ sơ đang soạn" ĐANG CÓ hiện tại (${resultIsEmpty()? 'hiện đang RỖNG, chưa có thông tin gì cả' : 'do đồng chí trích xuất ở lượt trước, hoặc người dùng đã tự sửa thủ công'})]:\n${JSON.stringify(latestResult)}` });
        aiMessages.push({ role:'assistant', text:'Đã ghi nhận Hồ sơ đang soạn hiện tại, tôi sẽ dựa vào đây để tiếp tục thêm/sửa/xoá theo đúng yêu cầu.' });
        const allAttachments = messages.filter(mm=>mm.role==='user').flatMap(mm=>mm.attachments||[]);
        const opts = allAttachments.length? { attachments: allAttachments } : {};
        const result = await callAIWithFallback(aiMessages, opts, (partial)=>{
          streamMsg.text = partial;
          const bubbleEl = document.getElementById('mqai-streaming-bubble');
          if(bubbleEl){ bubbleEl.innerHTML = partial? renderMarkdownLite(partial) : waveTextHtml('Chàng đang suy nghĩ…'); const threadEl = wrap.querySelector('#mqai-thread'); if(threadEl) threadEl.scrollTop = threadEl.scrollHeight; }
        });
        const fullText = result.text || '';
        const mMatch = fullText.match(/```memberadd-result\s*([\s\S]*?)```/);
        let replyText = fullText, resObj = null;
        if(mMatch){
          replyText = (fullText.slice(0,mMatch.index) + fullText.slice(mMatch.index+mMatch[0].length)).trim();
          try{ resObj = JSON.parse(mMatch[1].trim()); }catch(e){ resObj = null; }
        }
        messages.pop();
        if(resObj){
          if((resObj.newHamlets||[]).length) state.config.hamlets = Array.from(new Set([...(state.config.hamlets||[]), ...resObj.newHamlets]));
          if((resObj.newHamletsOld||[]).length){
            const withSuffix = resObj.newHamletsOld.map(h=> h.endsWith(' (cũ)')? h : `${h} (cũ)`);
            state.config.hamletsLegacyHidden = Array.from(new Set([...(state.config.hamletsLegacyHidden||[]), ...withSuffix]));
          }
          if((resObj.newEthnicities||[]).length) state.config.memberEthnicities = Array.from(new Set([...memberEthnicityOptions(), ...resObj.newEthnicities]));
          if((resObj.newReligions||[]).length) state.config.memberReligions = Array.from(new Set([...memberReligionOptions(), ...resObj.newReligions]));
          if((resObj.newPositions||[]).length) state.config.memberPositionsCustom = Array.from(new Set([...((state.config.memberPositionsCustom)||[]), ...resObj.newPositions]));
          if((resObj.newHamlets||[]).length || (resObj.newHamletsOld||[]).length || (resObj.newEthnicities||[]).length || (resObj.newReligions||[]).length || (resObj.newPositions||[]).length) cSet('config', state.config);
        }
        if(replyText) messages.push({ role:'ai', text: replyText });
        if(resObj) latestResult = resObj;
        hasDigestedOnce = true;
      }catch(err){
        messages.pop();
        console.error('Lỗi khi tiêu hoá tài liệu bằng AI (hội viên):', err);
        messages.push({ role:'ai', text:`Xin lỗi, có lỗi xảy ra khi xử lý: ${err && err.message ? err.message : err}. Đồng chí thử lại nhé.` });
      }
      busy = false; render();
    }
    render();
  }

  // ---------- TAB "HỒ SƠ HỘI VIÊN" ----------
  // Thùng rác: 1 nút menu duy nhất ở ĐẦU mỗi dòng (mép trái) gộp cả "Khôi phục" và "Xoá vĩnh viễn"
  // — bấm ra là hiện 2 lựa chọn, thay cho 2 nút riêng như trước.
  function buildMembersTrashPanelHtml(){
    const items = (state.members||[]).filter(m=>m.deleted).sort((a,b)=> (b.deletedAt||'').localeCompare(a.deletedAt||''));
    if(!items.length) return `<div class="empty-state"><div class="e-ico">🗑️</div>Thùng rác trống.</div>`;
    return `<div class="table-wrap"><table>
      <thead><tr><th></th><th>Họ và tên</th><th>${subAdminLabel()}</th><th>SĐT</th><th>Xoá bởi</th><th>Thời điểm xoá</th></tr></thead>
      <tbody>${items.map(m=>`<tr>
        <td style="position:relative;">
          <button type="button" class="btn btn-ghost btn-sm preview-allow member-trash-menu-btn" data-id="${m.id}">⋮ Thao tác</button>
          ${state._memberTrashMenuOpen===m.id? `<div class="sv-filter-panel" style="min-width:160px;">
            <button type="button" class="btn btn-ghost btn-sm preview-allow member-trash-restore" data-id="${m.id}" style="width:100%; text-align:left; margin-bottom:4px;">↩ Khôi phục</button>
            <button type="button" class="btn btn-danger btn-sm preview-allow member-trash-purge" data-id="${m.id}" style="width:100%; text-align:left;">Xoá vĩnh viễn</button>
          </div>` : ''}
        </td>
        <td>${escapeHtml(m.fullName||'')}</td>
        <td>${escapeHtml(m.currentHamlet||'—')}</td>
        <td>${escapeHtml(m.phone||'')}</td>
        <td class="sub">${escapeHtml(m.deletedByName||m.deletedBy||'')}</td>
        <td class="sub">${m.deletedAt? new Date(m.deletedAt).toLocaleString('vi-VN') : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }
  function wireMembersTrashPanel(container, rerenderFn){
    container.querySelectorAll('.member-trash-menu-btn').forEach(btn=> btn.onclick = (e)=>{
      e.stopPropagation();
      state._memberTrashMenuOpen = state._memberTrashMenuOpen===btn.dataset.id ? null : btn.dataset.id;
      rerenderFn();
    });
    container.querySelectorAll('.member-trash-restore').forEach(btn=> btn.onclick = ()=>{ state._memberTrashMenuOpen=null; restoreMember(btn.dataset.id).then(rerenderFn); });
    container.querySelectorAll('.member-trash-purge').forEach(btn=> btn.onclick = ()=>{
      if(!confirm('Xoá VĨNH VIỄN hội viên này — không thể khôi phục lại. Đồng chí có chắc chắn không?')) return;
      state._memberTrashMenuOpen=null;
      purgeMemberForever(btn.dataset.id).then(rerenderFn);
    });
    if(!container._mtOutsideBound){
      container._mtOutsideBound = true;
      document.addEventListener('click', (e)=>{
        if(!document.body.contains(container) || !state._memberTrashMenuOpen) return;
        if(e.target.closest('.member-trash-menu-btn') || e.target.closest('.sv-filter-panel')) return;
        state._memberTrashMenuOpen = null;
        if(document.body.contains(container)) rerenderFn();
      });
    }
  }
  function renderMembersTab(el){
    ensureMemberFilters();
    const notDeleted = (state.members||[]).filter(m=>!m.deleted);
    const filtered = notDeleted.filter(memberMatchesFilters);
    const rowSorting = !!state._memberRowSorting;
    let sorted;
    if(rowSorting && state._memberRowSortDraft){
      const byId = {}; notDeleted.forEach(m=> byId[m.id]=m);
      sorted = state._memberRowSortDraft.map(id=> byId[id]).filter(Boolean);
    } else {
      sorted = sortedMembersForDisplay(filtered);
      state._memberRowSortDraft = sorted.map(m=>m.id);
    }
    const trashCount = (state.members||[]).filter(m=>m.deleted).length;
    const searchActive = (state.memberSearch||'')!=='' && (state.memberSearch||'')!==' ';
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🪪 Hồ sơ hội viên (${notDeleted.length})</h3></div>
        <div class="panel-body">
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <input type="text" id="mb-search" placeholder="🔎 Tìm theo họ tên, CCCD, số điện thoại..." value="${escapeHtml(state.memberSearch||'')}" style="flex:1; min-width:220px; ${searchActive?'border:2px solid #b71c1c;':''}">
            ${memberFilterDropdownsHtml('mf')}
            <button type="button" class="btn btn-ghost btn-sm preview-allow ${anyMemberFilterActive()?'reset-filter-active':''}" id="mb-reset-filters">↺ Khôi phục bộ lọc gốc</button>
          </div>
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:14px;">
            <button type="button" class="btn btn-primary btn-sm preview-allow" id="mb-add-manual">➕ Thêm hội viên</button>
            <button type="button" class="btn btn-sm preview-allow" id="mb-add-ai" style="background:linear-gradient(180deg,#fff 0%,#7c4dff 45%,#4527a0 100%); color:#fff; font-weight:700;">✨ Thêm nhanh bằng AI</button>
            <div class="sv-filter-dropdown">
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mb-sort-menu-btn">☰ Sắp xếp danh sách</button>
              ${state._memberSortMenuOpen? `<div class="sv-filter-panel" style="min-width:260px;">
                <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mb-sort-hamlets" style="width:100%; text-align:left; margin-bottom:4px;">1. Sắp xếp thứ tự khu dân cư trong danh sách</button>
                <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mb-sort-rows" style="width:100%; text-align:left;">2. Sắp xếp từng dòng trong danh sách</button>
              </div>` : ''}
            </div>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mb-view-excel">📊 Xem bảng Excel</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mb-print-export">📄 Xuất file/In</button>
          </div>
          ${rowSorting? `<p class="sub" style="margin:0 0 10px;">🖐️ Kéo-thả từng dòng để sắp xếp lại thứ tự — chỉ sắp xếp được trong phạm vi cùng 1 khu dân cư.</p>` : ''}
          <div class="table-wrap">
            <table>
              <thead><tr><th></th><th>Họ và tên</th><th>Nơi ở hiện nay</th><th>Năm sinh</th><th>Giới tính</th><th>Chức vụ</th><th>Đảng viên</th><th>SĐT</th></tr></thead>
              <tbody>
                ${sorted.length? sorted.map(m=>`<tr${rowSorting? ` draggable="true" data-drag-member="${m.id}" style="cursor:grab;"` : ''}>
                  <td>${rowSorting? '☰' : `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-mb-edit="${m.id}">✏️</button>`}</td>
                  <td>${escapeHtml(m.fullName||'')}${m.needsVerify?' <span title="Cần xác minh" style="color:#b71c1c;">🚩</span>':''}</td>
                  <td>${escapeHtml(m.currentHamlet||'')}</td>
                  <td>${escapeHtml(String(m.birthYear||''))}</td>
                  <td>${escapeHtml(m.gender||'')}</td>
                  <td>${escapeHtml(m.position||'')}</td>
                  <td>${escapeHtml(m.partyMember||'')}</td>
                  <td>${escapeHtml(m.phone||'')}</td>
                </tr>`).join('') : `<tr><td colspan="8" style="text-align:center; padding:14px;">Không có hội viên theo bộ lọc hiện tại.</td></tr>`}
              </tbody>
            </table>
          </div>
          ${rowSorting? `<div style="text-align:right; margin-top:10px;">
            <button type="button" class="btn btn-ghost preview-allow" id="mb-sort-rows-cancel">Huỷ</button>
            <button type="button" class="btn btn-primary preview-allow" id="mb-sort-rows-save">💾 Lưu thứ tự</button>
          </div>` : ''}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head" style="cursor:pointer;" id="mb-trash-toggle"><h3>🗑️ Thùng rác (Hồ sơ hội viên) ${trashCount? `<span class="sub">(${trashCount})</span>` : ''} ${state.showMembersTrash?'▴':'▾'}</h3></div>
        ${state.showMembersTrash? `<div class="panel-body ${panelBodyAnimClass()}">${buildMembersTrashPanelHtml()}</div>` : ''}
      </div>`;
    wireMembersTab(el, sorted, rowSorting);
  }
  function wireMembersTab(el, sorted, rowSorting){
    const searchEl = el.querySelector('#mb-search');
    if(searchEl) searchEl.oninput = ()=>{ state.memberSearch = searchEl.value; rerenderKeepingFocus(()=>renderMembersTab(el)); };
    wireMemberFilterDropdowns(el, 'mf', ()=>renderMembersTab(el));
    const resetBtn = el.querySelector('#mb-reset-filters'); if(resetBtn) resetBtn.onclick = ()=>{ resetMemberFilters(); renderMembersTab(el); };
    const addBtn = el.querySelector('#mb-add-manual'); if(addBtn) addBtn.onclick = ()=> renderMemberFormModal(null, ()=>renderMembersTab(el));
    const aiBtn = el.querySelector('#mb-add-ai'); if(aiBtn) aiBtn.onclick = ()=> renderMemberQuickAddByAiModal();
    const sortMenuBtn = el.querySelector('#mb-sort-menu-btn'); if(sortMenuBtn) sortMenuBtn.onclick = (e)=>{ e.stopPropagation(); state._memberSortMenuOpen = !state._memberSortMenuOpen; renderMembersTab(el); };
    const sortHamletsBtn = el.querySelector('#mb-sort-hamlets'); if(sortHamletsBtn) sortHamletsBtn.onclick = ()=>{ state._memberSortMenuOpen=false; renderMemberHamletOrderModal(()=> renderMembersTab(el)); };
    const sortRowsBtn = el.querySelector('#mb-sort-rows'); if(sortRowsBtn) sortRowsBtn.onclick = ()=>{ state._memberSortMenuOpen=false; state._memberRowSorting=true; state._memberRowSortDraft=null; renderMembersTab(el); };
    const excelBtn = el.querySelector('#mb-view-excel'); if(excelBtn) excelBtn.onclick = ()=> renderMembersExcelViewModal();
    const epBtn = el.querySelector('#mb-print-export'); if(epBtn) epBtn.onclick = ()=> renderMembersExportSelectorModal();
    el.querySelectorAll('[data-mb-edit]').forEach(b=> b.onclick=()=>{ const m=(state.members||[]).find(x=>x.id===b.dataset.mbEdit); if(m) renderMemberFormModal(m, ()=>renderMembersTab(el)); });
    const trashToggle = el.querySelector('#mb-trash-toggle');
    if(trashToggle) trashToggle.onclick = ()=>{ state.showMembersTrash = !state.showMembersTrash; markPanelJustToggled(); renderMembersTab(el); };
    if(state.showMembersTrash) wireMembersTrashPanel(el, ()=>renderMembersTab(el));
    if(!el._mbOutsideSortBound){
      el._mbOutsideSortBound = true;
      document.addEventListener('click', (e)=>{
        if(!document.body.contains(el) || !state._memberSortMenuOpen) return;
        if(e.target.closest('#mb-sort-menu-btn') || e.target.closest('.sv-filter-panel')) return;
        state._memberSortMenuOpen = null;
        if(document.body.contains(el)) renderMembersTab(el);
      });
    }
    if(rowSorting){
      const cancelBtn = el.querySelector('#mb-sort-rows-cancel'); if(cancelBtn) cancelBtn.onclick = ()=>{ state._memberRowSorting=false; state._memberRowSortDraft=null; renderMembersTab(el); };
      const saveBtn = el.querySelector('#mb-sort-rows-save'); if(saveBtn) saveBtn.onclick = async ()=>{
        const hamletOf = {}; sorted.forEach(m=>{ hamletOf[m.id]=m.currentHamlet||''; });
        const counters = {};
        for(const m of sorted){
          const h = hamletOf[m.id];
          counters[h] = (counters[h]||0) + 1;
          const newOrder = counters[h];
          if(m.order !== newOrder) await cSetRecord('members', m.id, {...m, order:newOrder});
        }
        state._memberRowSorting=false; state._memberRowSortDraft=null;
        showToast('Đã lưu thứ tự!');
        renderMembersTab(el);
      };
      const hamletOfId = {}; sorted.forEach(m=>{ hamletOfId[m.id]=m.currentHamlet||''; });
      wireDragReorderWithIndicator(
        Array.from(el.querySelectorAll('[data-drag-member]')),
        row=> row.dataset.dragMember,
        (draggedId, targetId, before)=>{
          const arr = state._memberRowSortDraft.filter(id=> id!==draggedId);
          let idx = arr.indexOf(targetId);
          if(!before) idx += 1;
          arr.splice(idx, 0, draggedId);
          state._memberRowSortDraft = arr;
          renderMembersTab(el);
        },
        (idA, idB)=> hamletOfId[idA] !== hamletOfId[idB]
      );
    }
  }

  // ---------- THỐNG KÊ CHO "THỰC LỰC HỘI" ----------
  function currentPeriodLabel(){ const d=new Date(); const q=Math.floor(d.getMonth()/3)+1; return `Quý ${q}/${d.getFullYear()}`; }
  function emptyManualNumbers(){ return { households:'', farmHouseholds:'', farmHouseholdsWithMember:'', laborAbove18:'', residentialGroupsCount:'', residentialTeamsCount:'', professionalGroupsCount:'', professionalGroupsNames:'', professionalTeamsCount:'', professionalTeamsNames:'' }; }
  const STRENGTH_MANUAL_DIGIT_FIELDS_3 = ['residentialGroupsCount','residentialTeamsCount','professionalGroupsCount','professionalTeamsCount'];
  function computeMemberStats(list){
    const total = list.length;
    const count = pred => list.filter(pred).length;
    const pct = (n,d)=> d>0 ? Math.round(n/d*1000)/10 : 0;
    const ethnicityBreakdown = {};
    list.forEach(m=>{ if(m.ethnicity && m.ethnicity!=='Kinh') ethnicityBreakdown[m.ethnicity] = (ethnicityBreakdown[m.ethnicity]||0)+1; });
    const religionBreakdown = {};
    list.forEach(m=>{ if(m.religion && m.religion!=='Không') religionBreakdown[m.religion] = (religionBreakdown[m.religion]||0)+1; });
    return {
      total,
      active: count(m=>m.activityLevel==='Thường xuyên'),
      core: count(m=>m.isCore),
      party: count(m=>m.partyMember==='Có'),
      carded: count(m=>!!m.cardYear),
      female: count(m=>m.gender==='Nữ'),
      male: count(m=>m.gender==='Nam'),
      ethnicMinorityTotal: Object.values(ethnicityBreakdown).reduce((a,b)=>a+b,0),
      ethnicityBreakdown,
      religionTotal: Object.values(religionBreakdown).reduce((a,b)=>a+b,0),
      religionBreakdown,
      goodFarmer: { ward: count(m=>m.goodFarmerTitle==='Cấp xã/phường'), province: count(m=>m.goodFarmerTitle==='Cấp tỉnh/TP'), central: count(m=>m.goodFarmerTitle==='Cấp TW') },
      pct,
    };
  }
  async function saveStrengthSnapshot(scope, stats){
    const id = 'ss_'+uid();
    const period = state.strengthPeriod || currentPeriodLabel();
    const manual = state._strengthManualDraft || emptyManualNumbers();
    const rec = {
      id, hamlet: scope, period, manualNumbers: {...manual},
      computedSnapshot: {
        total:stats.total, active:stats.active, core:stats.core, party:stats.party, carded:stats.carded, female:stats.female, male:stats.male,
        ethnicMinorityTotal:stats.ethnicMinorityTotal, ethnicityBreakdown:{...stats.ethnicityBreakdown},
        religionTotal:stats.religionTotal, religionBreakdown:{...stats.religionBreakdown},
        goodFarmer:{...stats.goodFarmer},
      },
      createdAt: new Date().toISOString(), updatedBy: (state.identity&&state.identity.email)||'',
    };
    await cSetRecord('strengthSnapshots', id, rec);
  }
  async function deleteStrengthSnapshot(id){ await cRemoveRecord('strengthSnapshots', id); }
  // Sắp mới nhất lên trên — so bằng mốc thời gian THẬT (number), không so chuỗi, để chắc chắn khỏi
  // lệ thuộc định dạng chuỗi ISO khi so sánh.
  function sortSnapshotsNewestFirst(list){
    return list.slice().sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
  }
  function latestManualFor(hamletKey){
    const snaps = sortSnapshotsNewestFirst((state.strengthSnapshots||[]).filter(s=>s.hamlet===hamletKey));
    return snaps[0] && snaps[0].manualNumbers;
  }
  function strengthScopeLabel(scope){ return scope==='__all__'? `Toàn ${adminLevelLabelLower()}` : `${subAdminLabel()} ${scope}`; }
  // Dựng đúng các khối bảng Thực lực kiểu Excel — MỖI DÒNG là 1 đơn vị (toàn xã + từng ấp), dùng
  // CHUNG cho cả modal xem Excel lẫn xuất file/in. `scopeFilter` khác "__all__" thì CHỈ còn 1 dòng
  // đúng đơn vị đang được chọn ở bộ lọc địa phương — đúng dữ liệu đang xem, không lẫn đơn vị khác.
  function buildStrengthSections(scopeFilter){
    const activeMembers = (state.members||[]).filter(m=>!m.deleted);
    const hamlets = (state.config.hamlets||[]).filter(h=>h!=='Khác');
    let scopes = [{ key:'__all__', label:`Toàn ${adminLevelLabelLower()}` }].concat(hamlets.map(h=>({ key:h, label:`${subAdminLabel()} ${h}` })));
    if(scopeFilter && scopeFilter!=='__all__') scopes = scopes.filter(sc=> sc.key===scopeFilter);
    const rows = scopes.map(sc=>{
      const list = sc.key==='__all__'? activeMembers : activeMembers.filter(m=>m.currentHamlet===sc.key);
      return { scopeLabel: sc.label, stats: computeMemberStats(list), manual: latestManualFor(sc.key) || emptyManualNumbers() };
    });
    const colsI = [
      { label:'Đơn vị', get:r=>escapeHtml(r.scopeLabel) },
      { label:'Số hộ dân cư (*)', get:r=>escapeHtml(String(r.manual.households||'')) },
      { label:'Số hộ nông dân (*)', get:r=>escapeHtml(String(r.manual.farmHouseholds||'')) },
      { label:'Số hộ ND có hội viên (*)', get:r=>escapeHtml(String(r.manual.farmHouseholdsWithMember||'')) },
      { label:'Số LĐ nông nghiệp >18t (*)', get:r=>escapeHtml(String(r.manual.laborAbove18||'')) },
      { label:'Số hội viên hiện có', get:r=>String(r.stats.total) },
      { label:'HV sinh hoạt thường xuyên', get:r=>String(r.stats.active) },
      { label:'HV nòng cốt', get:r=>String(r.stats.core) },
      { label:'HV là Đảng viên', get:r=>String(r.stats.party) },
      { label:'HV được cấp thẻ', get:r=>String(r.stats.carded) },
      { label:'HV là nữ', get:r=>String(r.stats.female) },
      { label:'HV là nam', get:r=>String(r.stats.male) },
    ];
    const ethnicityNames = Array.from(new Set(rows.flatMap(r=>Object.keys(r.stats.ethnicityBreakdown))));
    const colsII = [{ label:'Đơn vị', get:r=>escapeHtml(r.scopeLabel) }, { label:'Tổng số', get:r=>String(r.stats.ethnicMinorityTotal) }]
      .concat(ethnicityNames.map(name=>({ label:name, get:r=>String(r.stats.ethnicityBreakdown[name]||0) })));
    const religionNames = Array.from(new Set(rows.flatMap(r=>Object.keys(r.stats.religionBreakdown))));
    const colsIII = [{ label:'Đơn vị', get:r=>escapeHtml(r.scopeLabel) }, { label:'Tổng số', get:r=>String(r.stats.religionTotal) }]
      .concat(religionNames.map(name=>({ label:name, get:r=>String(r.stats.religionBreakdown[name]||0) })));
    const colsIV = [
      { label:'Đơn vị', get:r=>escapeHtml(r.scopeLabel) },
      { label:'Tổng số đạt danh hiệu', get:r=>String(r.stats.goodFarmer.ward+r.stats.goodFarmer.province+r.stats.goodFarmer.central) },
      { label:`Cấp ${adminLevelLabelLower()}`, get:r=>String(r.stats.goodFarmer.ward) },
      { label:`Cấp ${provinceLevelLabelLower()}`, get:r=>String(r.stats.goodFarmer.province) },
      { label:'Cấp Trung ương', get:r=>String(r.stats.goodFarmer.central) },
    ];
    const colsV = [
      { label:'Đơn vị', get:r=>escapeHtml(r.scopeLabel) },
      { label:'Số chi hội khu dân cư', get:r=>escapeHtml(String(r.manual.residentialGroupsCount||'')) },
      { label:'Số tổ hội khu dân cư', get:r=>escapeHtml(String(r.manual.residentialTeamsCount||'')) },
      { label:'Số chi hội nghề nghiệp', get:r=>escapeHtml(String(r.manual.professionalGroupsCount||'')) },
      { label:'Số tổ hội nghề nghiệp', get:r=>escapeHtml(String(r.manual.professionalTeamsCount||'')) },
      { label:'Tên các Chi hội nghề nghiệp cụ thể', get:r=>escapeHtml(r.manual.professionalGroupsNames||'') },
      { label:'Tên các Tổ hội nghề nghiệp cụ thể', get:r=>escapeHtml(r.manual.professionalTeamsNames||'') },
    ];
    return [
      { title:'I. Tổng hợp rà soát số lượng hội viên', list: rows, cols: colsI },
      { title:'II. Hội viên là đồng bào dân tộc thiểu số', list: rows, cols: colsII },
      { title:'III. Hội viên là người có đạo', list: rows, cols: colsIII },
      { title:'IV. Thống kê Nông dân sản xuất kinh doanh giỏi', list: rows, cols: colsIV },
      { title:'V. Chi hội khu dân cư — Chi/Tổ hội nghề nghiệp', list: rows, cols: colsV },
    ];
  }
  function renderStrengthExcelViewModal(scope){
    const filtered = scope && scope!=='__all__';
    const sections = buildStrengthSections(scope);
    const title = filtered? `📊 Bảng Thực lực Hội — ⚠️ Đang lọc theo địa bàn: ${strengthScopeLabel(scope)}` : '📊 Bảng Thực lực Hội';
    if(filtered) showToast(`Đang xem đúng địa bàn ${strengthScopeLabel(scope)}.`);
    renderColumnHeaderExcelModal(title, sections, sections[0].cols);
  }
  function renderStrengthExportModal(scope){
    const filtered = scope && scope!=='__all__';
    const scopeLbl = strengthScopeLabel(scope);
    const bodyText = filtered
      ? `Xuất/in đầy đủ cả 5 bảng thực lực, nhưng CHỈ cho đúng địa bàn <b>${escapeHtml(scopeLbl)}</b> đang được chọn ở bộ lọc địa phương phía trên.`
      : `Xuất/in đầy đủ cả 5 bảng thực lực (toàn ${adminLevelLabelLower()} và từng ${subAdminLabelLower()}).`;
    const reportTitle = filtered? `Thực lực Hội — ${scopeLbl}` : 'Thực lực Hội';
    const filenameBase = filtered? `Thuc-luc-Hoi-${scopeLbl.replace(/\s+/g,'-')}` : 'Thuc-luc-Hoi';
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:440px;">
        <div class="modal-head"><h3>📄 Xuất file/In — Thực lực Hội</h3><button class="modal-close preview-allow" id="sge-close">✕</button></div>
        <div class="modal-body"><p class="sub">${bodyText}</p></div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="sge-cancel">Đóng bảng</button>
          <button class="btn btn-ghost preview-allow" id="sge-print">🖨️ In</button>
          <button class="btn btn-primary preview-allow" id="sge-excel">⬇️ Xuất Excel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#sge-close').onclick = close;
    wrap.querySelector('#sge-cancel').onclick = close;
    wrap.querySelector('#sge-print').onclick = ()=>{ close(); printSections(reportTitle, buildStrengthSections(scope)); };
    wrap.querySelector('#sge-excel').onclick = ()=>{ close(); exportSectionsToExcel(filenameBase, `BÁO CÁO ${reportTitle.toUpperCase()}`, buildStrengthSections(scope)); };
  }
  // Modal "Lịch sử các kỳ" — bảng riêng (không dùng renderColumnHeaderExcelModal vì cần nút xoá
  // từng dòng ở CỘT ĐẦU + cần in/xuất), hiện ĐẦY ĐỦ mọi thông tin của cả 5 khối. Cột "Xoá" ở sát
  // mép trái, kế đó "Thời điểm chốt" rồi "Kỳ báo cáo"; 2 cột tên chi/tổ hội nghề nghiệp đặt CUỐI
  // bảng để không chen vào giữa dãy số liệu đang so sánh. Mới nhất LUÔN lên trên.
  function renderStrengthHistoryModal(scope){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.cssText = 'padding:0; align-items:stretch;';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let frozen = false, zoomPct = 100;
    const ZOOM_MIN = 50, ZOOM_MAX = 200, ZOOM_STEP = 10;
    function buildDataCols(list){
      const ethnicityNames = Array.from(new Set(list.flatMap(s=>Object.keys((s.computedSnapshot||{}).ethnicityBreakdown||{}))));
      const religionNames = Array.from(new Set(list.flatMap(s=>Object.keys((s.computedSnapshot||{}).religionBreakdown||{}))));
      return [
        { label:'Thời điểm chốt', get:s=>escapeHtml(s.createdAt? new Date(s.createdAt).toLocaleString('vi-VN') : ''), getPlain:s=>s.createdAt? new Date(s.createdAt).toLocaleString('vi-VN') : '' },
        { label:'Kỳ báo cáo', get:s=>escapeHtml(s.period||''), getPlain:s=>s.period||'' },
        { label:'Số hộ dân cư', get:s=>escapeHtml(String((s.manualNumbers||{}).households||'')) },
        { label:'Số hộ nông dân', get:s=>escapeHtml(String((s.manualNumbers||{}).farmHouseholds||'')) },
        { label:'Số hộ ND có hội viên', get:s=>escapeHtml(String((s.manualNumbers||{}).farmHouseholdsWithMember||'')) },
        { label:'Số LĐ nông nghiệp >18t', get:s=>escapeHtml(String((s.manualNumbers||{}).laborAbove18||'')) },
        { label:'Số chi hội khu dân cư', get:s=>escapeHtml(String((s.manualNumbers||{}).residentialGroupsCount||'')) },
        { label:'Số tổ hội khu dân cư', get:s=>escapeHtml(String((s.manualNumbers||{}).residentialTeamsCount||'')) },
        { label:'Số chi hội nghề nghiệp', get:s=>escapeHtml(String((s.manualNumbers||{}).professionalGroupsCount||'')) },
        { label:'Số tổ hội nghề nghiệp', get:s=>escapeHtml(String((s.manualNumbers||{}).professionalTeamsCount||'')) },
        { label:'Tổng hội viên', get:s=>String((s.computedSnapshot||{}).total||0) },
        { label:'Sinh hoạt thường xuyên', get:s=>String((s.computedSnapshot||{}).active||0) },
        { label:'Nòng cốt', get:s=>String((s.computedSnapshot||{}).core||0) },
        { label:'Đảng viên', get:s=>String((s.computedSnapshot||{}).party||0) },
        { label:'Đã cấp thẻ', get:s=>String((s.computedSnapshot||{}).carded||0) },
        { label:'Nữ', get:s=>String((s.computedSnapshot||{}).female||0) },
        { label:'Nam', get:s=>String((s.computedSnapshot||{}).male||0) },
        { label:'Tổng DTTS', get:s=>String((s.computedSnapshot||{}).ethnicMinorityTotal||0) },
        ...ethnicityNames.map(name=>({ label:'DT: '+name, get:s=>String(((s.computedSnapshot||{}).ethnicityBreakdown||{})[name]||0) })),
        { label:'Tổng người có đạo', get:s=>String((s.computedSnapshot||{}).religionTotal||0) },
        ...religionNames.map(name=>({ label:'TG: '+name, get:s=>String(((s.computedSnapshot||{}).religionBreakdown||{})[name]||0) })),
        { label:`NDSXKD giỏi cấp ${adminLevelLabelLower()}`, get:s=>String(((s.computedSnapshot||{}).goodFarmer||{}).ward||0) },
        { label:`NDSXKD giỏi cấp ${provinceLevelLabelLower()}`, get:s=>String(((s.computedSnapshot||{}).goodFarmer||{}).province||0) },
        { label:'NDSXKD giỏi cấp TW', get:s=>String(((s.computedSnapshot||{}).goodFarmer||{}).central||0) },
        { label:'Tên các Chi hội nghề nghiệp cụ thể', get:s=>escapeHtml((s.manualNumbers||{}).professionalGroupsNames||'') },
        { label:'Tên các Tổ hội nghề nghiệp cụ thể', get:s=>escapeHtml((s.manualNumbers||{}).professionalTeamsNames||'') },
      ];
    }
    function render(){
      const narrow = isNarrowScreenForSidebar();
      const list = sortSnapshotsNewestFirst((state.strengthSnapshots||[]).filter(s=>s.hamlet===scope));
      const dataCols = buildDataCols(list);
      const stickyTop = narrow? '' : 'position:sticky; top:0;';
      const stickyLeft0 = narrow? '' : 'position:sticky; left:0;';
      const stickyLeftA = (!narrow && frozen)? 'position:sticky; left:64px;' : '';
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:90vh; max-height:90vh; display:flex; flex-direction:column; border-radius:0;">
          <div class="modal-head"><h3>🕓 Lịch sử chốt số — ${escapeHtml(strengthScopeLabel(scope))}</h3><button class="modal-close preview-allow" id="sgh-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:0;">
            <div style="zoom:${zoomPct}%;">
            <div class="table-wrap"><table>
              <thead><tr>
                <th style="${stickyTop} ${stickyLeft0} z-index:3; background:#ffebee; min-width:64px;">Xoá</th>
                ${dataCols.map((c,i)=>`<th style="${stickyTop} z-index:2; background:var(--paper-2); ${i===0?stickyLeftA+' z-index:3;':''} white-space:nowrap;">${htmlLabel(c.label)}</th>`).join('')}
              </tr></thead>
              <tbody>${list.length? list.map(s=>`<tr>
                <td style="${stickyLeft0} z-index:1; background:#ffebee;"><button type="button" class="btn btn-danger btn-sm preview-allow" data-sgh-del="${s.id}">Xoá</button></td>
                ${dataCols.map((c,i)=>`<td style="${i===0? stickyLeftA+' background:#fff; z-index:1;' : ''} white-space:nowrap;">${c.get(s)}</td>`).join('')}
              </tr>`).join('') : `<tr><td colspan="${dataCols.length+1}" style="text-align:center; padding:14px;">Chưa có kỳ nào được chốt.</td></tr>`}</tbody>
            </table></div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="sgh-print">🖨️ In</button>
            <button class="btn btn-ghost preview-allow" id="sgh-excel">⬇️ Xuất Excel</button>
            <button type="button" class="btn btn-sm preview-allow" id="sgh-freeze" style="background:${frozen?'#ff8f00':'#1565c0'}; color:#fff; font-weight:700;">${frozen?'Tắt cố định cột':'Cố định xem cột đầu'}</button>
            <div style="display:flex; align-items:center; gap:6px;">
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sgh-zoom-out" ${zoomPct<=ZOOM_MIN?'disabled':''}>➖</button>
              <span style="font-weight:700; min-width:42px; text-align:center;">${zoomPct}%</span>
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sgh-zoom-in" ${zoomPct>=ZOOM_MAX?'disabled':''}>➕</button>
            </div>
            <button class="btn btn-primary preview-allow" id="sgh-close2">Đóng bảng</button>
          </div>
        </div>`;
      wrap.querySelector('#sgh-close').onclick = close;
      wrap.querySelector('#sgh-close2').onclick = close;
      wrap.querySelector('#sgh-freeze').onclick = ()=>{ frozen = !frozen; render(); };
      wrap.querySelector('#sgh-zoom-in').onclick = ()=>{ zoomPct = Math.min(ZOOM_MAX, zoomPct+ZOOM_STEP); render(); };
      wrap.querySelector('#sgh-zoom-out').onclick = ()=>{ zoomPct = Math.max(ZOOM_MIN, zoomPct-ZOOM_STEP); render(); };
      wrap.querySelector('#sgh-print').onclick = ()=> printSections(`Lịch sử chốt số — ${strengthScopeLabel(scope)}`, [{ title:'Các kỳ đã chốt', list, cols: dataCols }]);
      wrap.querySelector('#sgh-excel').onclick = ()=> exportSectionsToExcel('Lich-su-chot-so', `BÁO CÁO LỊCH SỬ CHỐT SỐ — ${strengthScopeLabel(scope).toUpperCase()}`, [{ title:'Các kỳ đã chốt', list, cols: dataCols }]);
      wrap.querySelectorAll('[data-sgh-del]').forEach(btn=> btn.onclick = async ()=>{
        if(!confirm('Xoá kỳ báo cáo này — đây là XOÁ VĨNH VIỄN, không thể khôi phục lại. Đồng chí có chắc chắn muốn xoá không?')) return;
        await deleteStrengthSnapshot(btn.dataset.sghDel);
        render();
      });
    }
    render();
  }
  function strengthBlockIHtml(stats){
    const pctActive = stats.pct(stats.active, stats.total);
    const pctCore = stats.pct(stats.core, stats.total);
    const manual = state._strengthManualDraft || emptyManualNumbers();
    const farmHouseholds = parseFloat(manual.farmHouseholds)||0;
    const farmWithMember = parseFloat(manual.farmHouseholdsWithMember)||0;
    const pctFarmHasMember = stats.pct(farmWithMember, farmHouseholds);
    const rows = [
      ['Số hội viên hiện có', String(stats.total)],
      ['Hội viên sinh hoạt thường xuyên', `${stats.active} (${pctActive}%)`],
      ['Hội viên nòng cốt', `${stats.core} (${pctCore}%)`],
      ['Hội viên là Đảng viên', String(stats.party)],
      ['Hội viên được cấp thẻ', String(stats.carded)],
      ['Hội viên là nữ', String(stats.female)],
      ['Hội viên là nam', String(stats.male)],
      ['Số hộ ND có hội viên / Số hộ nông dân', `${farmWithMember}/${farmHouseholds} (${pctFarmHasMember}%)`],
    ];
    return `<div class="divider-lbl">I. Tổng hợp rà soát số lượng hội viên</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; margin-bottom:14px;">
        ${rows.map(([lbl,val])=>`<div style="border:1px solid var(--line); border-radius:8px; padding:8px 12px;"><div class="sub">${escapeHtml(lbl)}</div><div style="font-weight:800; font-size:15px;">${escapeHtml(val)}</div></div>`).join('')}
      </div>`;
  }
  // Các trường ĐẾM (hộ/lao động) được gắn mask tiền (nhóm 3 số khi rời ô, chữ số thường khi vào ô
  // sửa) + dòng "= xx xxx" sống phía trên nhãn — y hệt ô "Số tiền thực tế vay". KHÔNG áp dụng cho
  // 4 ô đếm chi/tổ hội (khu dân cư/nghề nghiệp) và 2 ô tên cụ thể (free text, tối đa 500 ký tự).
  const STRENGTH_MANUAL_MONEY_FIELDS = ['households','farmHouseholds','farmHouseholdsWithMember','laborAbove18'];
  function strengthManualFormHtml(manual){
    const fields = [
      ['households','Số hộ dân cư'], ['farmHouseholds','Số hộ nông dân'], ['farmHouseholdsWithMember','Số hộ nông dân có hội viên'],
      ['laborAbove18','Số lao động nông nghiệp trên 18 tuổi'],
      ['residentialGroupsCount','Số chi hội khu dân cư'], ['residentialTeamsCount','Số tổ hội khu dân cư'],
      ['professionalGroupsCount','Số chi hội nghề nghiệp'], ['professionalGroupsNames','Tên các Chi hội nghề nghiệp cụ thể'],
      ['professionalTeamsCount','Số tổ hội nghề nghiệp'], ['professionalTeamsNames','Tên các Tổ hội nghề nghiệp cụ thể'],
    ];
    return `<div class="divider-lbl">Số liệu nhập tay (không suy ra được từ hồ sơ hội viên)</div>
      <div class="form-grid">
        ${fields.map(([k,lbl])=>{
          const isMoney = STRENGTH_MANUAL_MONEY_FIELDS.includes(k);
          const isName = k==='professionalGroupsNames' || k==='professionalTeamsNames';
          const liveSpan = isMoney? ` <span class="sub" id="sg-manual-${k}-disp" style="font-weight:700; color:#b71c1c;"></span>` : '';
          return `<div class="field"><label>${escapeHtml(lbl)}${liveSpan}</label><input type="text" maxlength="${isName?500:6}" id="sg-manual-${k}" data-sg-manual="${k}" value="${escapeHtml(manual[k]||'')}"></div>`;
        }).join('')}
      </div>
      <div style="text-align:right; margin:10px 0 14px;">
        <button type="button" class="btn btn-primary preview-allow" id="sg-save-snapshot">💾 Chốt số kỳ này</button>
      </div>`;
  }
  function strengthBlockIIHtml(stats){
    const rows = Object.keys(stats.ethnicityBreakdown).sort((a,b)=> stats.ethnicityBreakdown[b]-stats.ethnicityBreakdown[a]);
    return `<div class="divider-lbl">II. Hội viên là đồng bào dân tộc thiểu số (Tổng: ${stats.ethnicMinorityTotal})</div>
      <div class="table-wrap" style="margin-bottom:14px;"><table>
        <thead><tr><th>Dân tộc</th><th>Số hội viên</th></tr></thead>
        <tbody>${rows.length? rows.map(k=>`<tr><td>${escapeHtml(k)}</td><td>${stats.ethnicityBreakdown[k]}</td></tr>`).join('') : `<tr><td colspan="2" style="text-align:center;">Chưa có dữ liệu</td></tr>`}</tbody>
      </table></div>`;
  }
  function strengthBlockIIIHtml(stats){
    const rows = Object.keys(stats.religionBreakdown).sort((a,b)=> stats.religionBreakdown[b]-stats.religionBreakdown[a]);
    return `<div class="divider-lbl">III. Hội viên là người có đạo (Tổng: ${stats.religionTotal})</div>
      <div class="table-wrap" style="margin-bottom:14px;"><table>
        <thead><tr><th>Tôn giáo</th><th>Số hội viên</th></tr></thead>
        <tbody>${rows.length? rows.map(k=>`<tr><td>${escapeHtml(k)}</td><td>${stats.religionBreakdown[k]}</td></tr>`).join('') : `<tr><td colspan="2" style="text-align:center;">Chưa có dữ liệu</td></tr>`}</tbody>
      </table></div>`;
  }
  function strengthBlockIVHtml(stats){
    return `<div class="divider-lbl">IV. Thống kê Nông dân sản xuất kinh doanh giỏi (Tổng: ${stats.goodFarmer.ward+stats.goodFarmer.province+stats.goodFarmer.central})</div>
      <div class="table-wrap" style="margin-bottom:14px;"><table>
        <thead><tr><th>Cấp ${adminLevelLabelLower()}</th><th>Cấp ${provinceLevelLabelLower()}</th><th>Cấp Trung ương</th></tr></thead>
        <tbody><tr><td>${stats.goodFarmer.ward}</td><td>${stats.goodFarmer.province}</td><td>${stats.goodFarmer.central}</td></tr></tbody>
      </table></div>`;
  }

  // Thông báo to gấp 5 lần toast nhỏ (hnd-toast: 13.5px -> ~68px) ở GIỮA màn hình, đứng lâu gấp đôi
  // (toast nhỏ hiện ~1.8s+0.3s mờ dần ~ 2.1s -> bản to này ~3.6s+0.8s mờ dần ~ 4.4s).
  function showGiantCenterToast(msg){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) scale(0.7); z-index:99999; background:#1b7a3d; color:#fff; font-weight:800; font-size:68px; line-height:1.2; padding:36px 56px; border-radius:24px; box-shadow:0 10px 50px rgba(0,0,0,.45); text-align:center; max-width:92vw; opacity:0; transition:opacity .3s ease, transform .3s ease; pointer-events:none;';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translate(-50%,-50%) scale(1)'; });
    setTimeout(()=>{
      el.style.opacity='0'; el.style.transform='translate(-50%,-50%) scale(0.85)';
      setTimeout(()=>{ if(el.parentNode) el.remove(); }, 800);
    }, 3600);
  }

  // ---------- TAB "THỰC LỰC HỘI" ----------
  function renderStrengthTab(el){
    const scope = state.strengthHamlet || '__all__';
    const activeMembers = (state.members||[]).filter(m=>!m.deleted);
    const scopedList = scope==='__all__'? activeMembers : activeMembers.filter(m=>m.currentHamlet===scope);
    const stats = computeMemberStats(scopedList);
    const snapshots = sortSnapshotsNewestFirst((state.strengthSnapshots||[]).filter(s=>s.hamlet===scope));
    if(!state._strengthManualDraft){
      const latest = snapshots[0];
      state._strengthManualDraft = latest? {...emptyManualNumbers(), ...latest.manualNumbers} : emptyManualNumbers();
    }
    const manual = state._strengthManualDraft;
    const cooldownLeftMs = (state._sgSaveCooldownUntil||0) - Date.now();
    const onCooldown = cooldownLeftMs > 0;
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>💪 Thực lực Hội</h3></div>
        <div class="panel-body">
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:14px;">
            <select id="sg-scope" style="${scope!=='__all__'?'border:2px solid #b71c1c;':''}">
              <option value="__all__" ${scope==='__all__'?'selected':''}>Toàn ${adminLevelLabelLower()}</option>
              ${(state.config.hamlets||[]).filter(h=>h!=='Khác').map(h=>`<option value="${escapeHtml(h)}" ${scope===h?'selected':''}>${subAdminLabel()} ${escapeHtml(h)}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sg-view-excel">📊 Xem bảng Excel</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sg-print-export">📄 Xuất file/In</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sg-history">🕓 Lịch sử các kỳ (${snapshots.length})</button>
          </div>
          ${strengthBlockIHtml(stats)}
          ${strengthManualFormHtml(manual)}
          ${strengthBlockIIHtml(stats)}
          ${strengthBlockIIIHtml(stats)}
          ${strengthBlockIVHtml(stats)}
        </div>
      </div>`;
    wireStrengthTab(el, stats, scope, onCooldown);
    if(onCooldown) setTimeout(()=>{ if(document.body.contains(el)) renderStrengthTab(el); }, cooldownLeftMs+50);
  }
  function wireStrengthTab(el, stats, scope, onCooldown){
    const scopeSel = el.querySelector('#sg-scope'); if(scopeSel) scopeSel.onchange = ()=>{ state.strengthHamlet = scopeSel.value; state._strengthManualDraft = null; renderStrengthTab(el); };
    el.querySelectorAll('[data-sg-manual]').forEach(inp=>{
      const key = inp.dataset.sgManual;
      if(STRENGTH_MANUAL_MONEY_FIELDS.includes(key)){
        attachMoneyInputMask(inp, 6);
        const disp = el.querySelector('#sg-manual-'+key+'-disp');
        const updateDisp = ()=>{ if(disp){ const digits = inp.value.replace(/[^\d]/g,''); disp.textContent = digits? `= ${groupDigitsRight(digits,3)}` : ''; } };
        inp.addEventListener('input', updateDisp);
        updateDisp();
      } else if(STRENGTH_MANUAL_DIGIT_FIELDS_3.includes(key)){
        attachDigitsMaxLenMask(inp, 3);
      }
      inp.addEventListener('input', ()=>{
        state._strengthManualDraft[key] = inp.value;
        rerenderKeepingFocus(()=> renderStrengthTab(el));
      });
    });
    const excelBtn = el.querySelector('#sg-view-excel'); if(excelBtn) excelBtn.onclick = ()=> renderStrengthExcelViewModal(scope);
    const epBtn = el.querySelector('#sg-print-export'); if(epBtn) epBtn.onclick = ()=> renderStrengthExportModal(scope);
    const histBtn = el.querySelector('#sg-history'); if(histBtn) histBtn.onclick = ()=> renderStrengthHistoryModal(scope);
    const saveBtn = el.querySelector('#sg-save-snapshot');
    if(saveBtn){
      if(onCooldown){ saveBtn.disabled = true; saveBtn.style.opacity = '.5'; saveBtn.style.cursor = 'not-allowed'; }
      saveBtn.onclick = ()=>{
        const suggested = currentPeriodLabel();
        const period = prompt('Đặt tên cho kỳ báo cáo này (VD: Quý 4/2026):', suggested);
        if(period==null) return; // bấm Huỷ -> không chốt
        state.strengthPeriod = period.trim() || suggested;
        saveStrengthSnapshot(scope, stats).then(()=>{
          state._sgSaveCooldownUntil = Date.now() + 10000;
          showGiantCenterToast('Đã chốt số kỳ này!');
          renderStrengthTab(el);
        });
      };
    }
  }

  // =====================================================================
  // ĐIỂM KHỞI ĐỘNG ỨNG DỤNG — PHẢI LUÔN NẰM Ở CUỐI PHẦN CUỐI CÙNG trong
  // manifest.json. Toàn bộ 16 phần được nối lại thành MỘT hàm bọc (IIFE)
  // duy nhất mở ở 01-foundation.js và đóng ngay bên dưới, nhờ vậy mọi phần
  // dùng chung được `state`, `render`, `escapeHtml`... Nếu sau này thêm
  // phần 17, hãy CHUYỂN nguyên khối này xuống cuối phần đó — để mọi khai
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
