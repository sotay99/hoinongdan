  // =====================================================================
  // MODULE "HỒ SƠ HỘI VIÊN" + "THỰC LỰC HỘI" — bản triển khai thật, thay cho trang giới thiệu
  // cũ (xem lịch sử ở cuối 14-accounting-settings-bootstrap.js). Thiết kế bám theo file Excel
  // "DS_HOI_VIEN" mà các cơ sở Hội đang dùng: 1 "bảng gốc" đầy đủ cột (ở đây là state.members),
  // các bảng "để in" (chỉ cột cơ bản) và "thực lực" (thống kê công thức) đều tính ra từ đó.
  // Lưu trữ: secretdata/{secretId}/members (hồ sơ hội viên) và secretdata/{secretId}/
  // strengthSnapshots (các kỳ chốt số thủ công của Thực lực Hội) — xem wref()/cSetRecord() ở
  // 03-cloud-storage.js. Tận dụng tối đa code đã chạy ổn định ở Sổ vay vốn: danh mục địa bàn dân
  // cư dùng chung (renderHamletManagerModal), khung modal Excel xem trước (renderColumnHeaderExcelModal),
  // khung chat "Thêm nhanh bằng AI" (nhân bản từ renderQuickAddByAiModal), bộ lọc đa chọn kiểu
  // sv-filter-dropdown (viền đỏ khi khác mặc định).
  // =====================================================================

  // ---------- DANH MỤC ----------
  // "Chức vụ hiện nay": 10 chức vụ cố định KHÔNG được xoá/sửa — chỉ cho thêm chức vụ tuỳ chỉnh
  // (lưu ở state.config.memberPositionsCustom), đúng yêu cầu của Hội.
  const MEMBER_POSITION_FIXED = ['Hội viên','Chi hội trưởng','Chi hội Phó','Uỷ viên BCH Chi hội','Tổ trưởng','Tổ phó','UV BCH HND xã','UV BTV HND xã','Chủ tịch Hội','Phó Chủ tịch Hội'];
  const MEMBER_ETHNICITY_DEFAULT = ['Kinh',"S'tiêng","K'ho",'Lào','Chăm','Dao','Ê đê','Châu ro','Hoa','Nùng','Mường','Mán','Gia rai','Tày','Sán dìu','Châu mạ','Thái','Thổ','Khơ me'];
  const MEMBER_RELIGION_DEFAULT = ['Không','Công giáo','Phật giáo','Tin lành','Hoà hảo','Cao đài','Hồi giáo'];
  function memberGenderOptions(){ return (state.config && state.config.memberGenders) || ['Nam','Nữ']; }
  function memberEthnicityOptions(){ return (state.config && state.config.memberEthnicities) || MEMBER_ETHNICITY_DEFAULT; }
  function memberReligionOptions(){ return (state.config && state.config.memberReligions) || MEMBER_RELIGION_DEFAULT; }
  function memberPositionOptions(){ return MEMBER_POSITION_FIXED.concat((state.config && state.config.memberPositionsCustom)||[]); }
  function memberOldHamletOptions(){ return (state.config && state.config.hamletsLegacyHidden) || []; }

  function memberCatalogMeta(kind){
    return {
      gender:{ title:'Danh sách Giới tính', field:'memberGenders', def:['Nam','Nữ'], max:10, maxLen:15 },
      ethnicity:{ title:'Danh sách Dân tộc', field:'memberEthnicities', def:MEMBER_ETHNICITY_DEFAULT, max:60, maxLen:24 },
      religion:{ title:'Danh sách Tôn giáo', field:'memberReligions', def:MEMBER_RELIGION_DEFAULT, max:30, maxLen:24 },
    }[kind];
  }
  // Modal quản lý danh mục tự do (Giới tính/Dân tộc/Tôn giáo) — cùng khung với renderHamletManagerModal
  // ở 07-core-modules.js nhưng không có mục "Khác" khoá cứng, vì 3 danh mục này không cần mục đó.
  function renderMemberListCatalogModal(kind){
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
      };
    }
    render();
  }
  // Modal quản lý "Chức vụ hiện nay" — cùng khung với renderFundSourceManagerModal: 10 chức vụ cố
  // định chỉ xem, phần tuỳ chỉnh phía dưới mới cho thêm/sửa/xoá.
  function renderMemberPositionManagerModal(){
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
      };
    }
    render();
  }
  function renderMemberCatalogsHubModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:420px;">
        <div class="modal-head"><h3>⚙️ Quản lý danh mục hội viên</h3><button class="modal-close preview-allow" id="mch-close">✕</button></div>
        <div class="modal-body">
          <button type="button" class="btn btn-ghost preview-allow" style="width:100%; margin-bottom:8px; text-align:left;" id="mch-gender">⚧ Danh sách Giới tính</button>
          <button type="button" class="btn btn-ghost preview-allow" style="width:100%; margin-bottom:8px; text-align:left;" id="mch-ethnicity">🌾 Danh sách Dân tộc</button>
          <button type="button" class="btn btn-ghost preview-allow" style="width:100%; margin-bottom:8px; text-align:left;" id="mch-religion">🙏 Danh sách Tôn giáo</button>
          <button type="button" class="btn btn-ghost preview-allow" style="width:100%; text-align:left;" id="mch-position">🎖️ Danh sách Chức vụ hiện nay</button>
        </div>
        <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="mch-cancel">Đóng bảng</button></div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#mch-close').onclick = close;
    wrap.querySelector('#mch-cancel').onclick = close;
    wrap.querySelector('#mch-gender').onclick = ()=> renderMemberListCatalogModal('gender');
    wrap.querySelector('#mch-ethnicity').onclick = ()=> renderMemberListCatalogModal('ethnicity');
    wrap.querySelector('#mch-religion').onclick = ()=> renderMemberListCatalogModal('religion');
    wrap.querySelector('#mch-position').onclick = ()=> renderMemberPositionManagerModal();
  }

  // ---------- DỮ LIỆU HỘI VIÊN (secretdata/{secretId}/members) ----------
  function emptyMember(){
    const now = new Date().toISOString();
    return {
      id: 'mb_'+uid(),
      fullName:'', birthYear:'', gender:'', ethnicity:'', religion:'', cccd:'', educationLevel:'',
      joinYear:'', cardYear:'', currentHamlet:'', oldHamlet:'', isCore:false, position: memberPositionOptions()[0]||'Hội viên',
      partyMember:'Không', removedDate:'', removedReason:'', phone:'', note:'',
      area:'', mainIndustry:'', avgIncome:'', laborCount:'', coopGroup:'', productionType:'', mainCrop:'', scale:'', techLevel:'Chưa áp dụng',
      product:'', salesChannel:'', goodFarmerTitle:'Không', activityLevel:'Thường xuyên', advantage:'', difficulty:'', proposal:'',
      chiHoiComment:'', proposalToWard:'',
      needsVerify:false, needsVerifyNote:'',
      deleted:false, createdAt: now, updatedAt: now,
    };
  }
  async function saveMember(m){ m.updatedAt = new Date().toISOString(); await cSetRecord('members', m.id, m); }
  async function softDeleteMember(id){ const m=(state.members||[]).find(x=>x.id===id); if(!m) return; await cSetRecord('members', id, {...m, deleted:true, deletedAt:new Date().toISOString()}); }
  async function restoreMember(id){ const m=(state.members||[]).find(x=>x.id===id); if(!m) return; await cSetRecord('members', id, {...m, deleted:false}); }

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

  // ---------- BỘ LỌC (giống hệt kiểu sv-filter-dropdown của Sổ vay vốn — viền đỏ khi khác mặc định) ----------
  function memberFilterDefs(){ return [
    { key:'currentHamlet', label:`${subAdminLabel()}`, icon:'📍', opts:(state.config.hamlets||[]) },
    { key:'oldHamlet', label:'Nơi ở trước sáp nhập', icon:'🏘️', opts:memberOldHamletOptions() },
    { key:'gender', label:'Giới tính', icon:'⚧', opts:memberGenderOptions() },
    { key:'ethnicity', label:'Dân tộc', icon:'🌾', opts:memberEthnicityOptions() },
    { key:'religion', label:'Tôn giáo', icon:'🙏', opts:memberReligionOptions() },
    { key:'partyMember', label:'Đảng viên', icon:'🚩', opts:['Có','Không'] },
    { key:'position', label:'Chức vụ hiện nay', icon:'🎖️', opts:memberPositionOptions() },
    { key:'birthYear', label:'Năm sinh', icon:'🎂', opts: Array.from({length:2040-1930+1}, (_,i)=>String(1930+i)) },
  ]; }
  function ensureMemberFilters(){
    if(!state.memberFilters) state.memberFilters = {};
    memberFilterDefs().forEach(d=>{ if(!state.memberFilters[d.key]) state.memberFilters[d.key] = d.opts.slice(); });
    if(state.memberSearch==null) state.memberSearch = '';
  }
  function resetMemberFilters(){ state.memberFilters = {}; ensureMemberFilters(); state.memberSearch = ''; state.openFilterDropdown = null; }
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
    container.querySelectorAll('[data-mf-item]').forEach(cb=> cb.onclick=(e)=>{
      e.stopPropagation();
      const k = cb.dataset.mfItem, v = cb.dataset.mfVal, arr = state.memberFilters[k];
      state.memberFilters[k] = cb.checked? arr.concat([v]) : arr.filter(x=>x!==v);
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
  function buildMembersViewSections(){
    const basicCols = memberBasicCols();
    const fullCols = basicCols.concat(memberAdvancedCols());
    const active = (state.members||[]).filter(m=>!m.deleted);
    const sortFn = (a,b)=> (a.currentHamlet||'').localeCompare(b.currentHamlet||'','vi') || (a.fullName||'').localeCompare(b.fullName||'','vi');
    const all = active.slice().sort(sortFn);
    const sections = [
      { title:`Toàn ${adminLevelLabelLower()} (để in)`, list: all, cols: basicCols },
      { title:`Toàn ${adminLevelLabelLower()} (toàn cảnh)`, list: all, cols: fullCols },
    ];
    (state.config.hamlets||[]).filter(h=>h!=='Khác').forEach(h=>{
      const list = all.filter(m=>m.currentHamlet===h);
      sections.push({ title:`${subAdminLabel()} ${h} (để in)`, list, cols: basicCols });
      sections.push({ title:`${subAdminLabel()} ${h} (toàn cảnh)`, list, cols: fullCols });
    });
    return sections;
  }
  function renderMembersExcelViewModal(){ renderColumnHeaderExcelModal('📊 Bảng Hồ sơ hội viên', buildMembersViewSections(), memberBasicCols()); }
  function renderMembersExportSelectorModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const sections = buildMembersViewSections();
    const selected = new Set([0,1]);
    function render(){
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:560px;">
          <div class="modal-head"><h3>📄 Xuất file/In — Chọn danh sách</h3><button class="modal-close preview-allow" id="mes-close">✕</button></div>
          <div class="modal-body">
            <p class="sub">Chọn 1 hoặc nhiều danh sách muốn xuất/in (không được bỏ chọn hết):</p>
            ${sections.map((sec,i)=>`<label style="display:flex; align-items:center; gap:8px; margin-bottom:8px;"><input type="checkbox" class="preview-allow mes-item" data-i="${i}" ${selected.has(i)?'checked':''}><span>${escapeHtml(sec.title)} (${sec.list.length})</span></label>`).join('')}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="mes-cancel">Đóng bảng</button>
            <button class="btn btn-ghost preview-allow" id="mes-print">🖨️ In</button>
            <button class="btn btn-primary preview-allow" id="mes-excel">⬇️ Xuất Excel</button>
          </div>
        </div>`;
      wrap.querySelector('#mes-close').onclick = close;
      wrap.querySelector('#mes-cancel').onclick = close;
      wrap.querySelectorAll('.mes-item').forEach(cb=> cb.onclick=()=>{ const i=parseInt(cb.dataset.i,10); if(cb.checked) selected.add(i); else selected.delete(i); });
      wrap.querySelector('#mes-print').onclick = ()=>{
        if(!selected.size){ alert('Vui lòng chọn ít nhất 1 danh sách.'); return; }
        const chosen = sections.filter((_,i)=> selected.has(i));
        close(); printSections('Hồ sơ hội viên', chosen);
      };
      wrap.querySelector('#mes-excel').onclick = ()=>{
        if(!selected.size){ alert('Vui lòng chọn ít nhất 1 danh sách.'); return; }
        const chosen = sections.filter((_,i)=> selected.has(i));
        close(); exportSectionsToExcel('Ho-so-hoi-vien', 'BÁO CÁO HỒ SƠ HỘI VIÊN', chosen);
      };
    }
    render();
  }

  // ---------- MODAL THÊM/SỬA HỒ SƠ (thủ công) ----------
  function renderMemberFormModal(existing, onSaved){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const isNew = !existing;
    let m = existing? {...existing} : emptyMember();
    let tab = 'basic';
    const close = ()=> wrap.remove();
    function fieldSelect(id,label,value,options,required){
      return `<div class="field"><label>${escapeHtml(label)}${required?' *':''}</label><select id="${id}">${required?'':'<option value="">(Chưa rõ)</option>'}${options.map(o=>`<option value="${escapeHtml(o)}" ${value===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select></div>`;
    }
    function fieldText(id,label,value,opts){
      opts = opts||{};
      return `<div class="field"><label>${escapeHtml(label)}${opts.required?' *':''}</label><input type="${opts.type||'text'}" id="${id}" value="${escapeHtml(value==null?'':String(value))}" placeholder="${escapeHtml(opts.placeholder||'')}"></div>`;
    }
    function fieldTextarea(id,label,value){
      return `<div class="field" style="grid-column:1/-1;"><label>${escapeHtml(label)}</label><textarea id="${id}" rows="2">${escapeHtml(value||'')}</textarea></div>`;
    }
    function render(){
      const basicHtml = `<div class="form-grid">
        ${fieldText('mf-fullName','Họ và tên', m.fullName, {required:true})}
        ${fieldText('mf-birthYear','Năm sinh', m.birthYear, {placeholder:'VD: 1972'})}
        ${fieldSelect('mf-gender','Giới tính', m.gender, memberGenderOptions())}
        ${fieldSelect('mf-ethnicity','Dân tộc', m.ethnicity, memberEthnicityOptions())}
        ${fieldSelect('mf-religion','Tôn giáo', m.religion, memberReligionOptions())}
        ${fieldText('mf-cccd','Số CCCD', m.cccd)}
        ${fieldText('mf-educationLevel','Trình độ văn hoá', m.educationLevel, {placeholder:'VD: 9/12'})}
        ${fieldText('mf-joinYear','Năm vào hội', m.joinYear)}
        ${fieldText('mf-cardYear','Năm cấp thẻ hội viên', m.cardYear)}
        ${fieldSelect('mf-currentHamlet','Nơi ở hiện nay', m.currentHamlet, (state.config.hamlets||[]), true)}
        ${fieldSelect('mf-oldHamlet','Nơi ở trước sáp nhập', m.oldHamlet, (state.config.hamletsLegacyHidden||[]))}
        ${fieldSelect('mf-position','Chức vụ hiện nay', m.position, memberPositionOptions())}
        ${fieldSelect('mf-partyMember','Đảng viên', m.partyMember, ['Có','Không'])}
        ${fieldText('mf-phone','Số điện thoại', m.phone)}
        ${fieldText('mf-removedDate','Ngày xoá tên', m.removedDate, {type:'date'})}
        ${fieldText('mf-removedReason','Lý do xoá tên', m.removedReason)}
        <div class="field"><label>&nbsp;</label><label style="display:flex; align-items:center; gap:8px; font-weight:400;"><input type="checkbox" id="mf-isCore" ${m.isCore?'checked':''}> Hội viên nòng cốt</label></div>
        ${fieldTextarea('mf-note','Ghi chú', m.note)}
        <div class="field" style="grid-column:1/-1; border-top:1px solid var(--line); padding-top:10px;">
          <label style="display:flex; align-items:center; gap:8px; font-weight:400;"><input type="checkbox" id="mf-needsVerify" ${m.needsVerify?'checked':''}> 🚩 Đánh dấu hồ sơ này cần xác minh thêm</label>
          <input type="text" id="mf-needsVerifyNote" value="${escapeHtml(m.needsVerifyNote||'')}" placeholder="Ghi chú cần xác minh gì (VD: chưa chắc năm sinh)" style="margin-top:6px;">
        </div>
      </div>`;
      const advancedHtml = `<div class="form-grid">
        ${fieldText('mf-area','Diện tích sản xuất (ha)', m.area)}
        ${fieldText('mf-mainIndustry','Ngành nghề SXKD chính', m.mainIndustry)}
        ${fieldText('mf-avgIncome','Mức thu nhập bình quân/năm (triệu đồng)', m.avgIncome)}
        ${fieldText('mf-laborCount','Lao động tham gia SX', m.laborCount)}
        ${fieldText('mf-coopGroup','Tham gia tổ hợp tác/HTX', m.coopGroup)}
        ${fieldText('mf-productionType','Loại hình sản xuất', m.productionType)}
        ${fieldText('mf-mainCrop','Cây trồng, vật nuôi chính', m.mainCrop)}
        ${fieldText('mf-scale','Quy mô sản xuất', m.scale)}
        ${fieldSelect('mf-techLevel','Mức độ ứng dụng KH-KT', m.techLevel, ['Chưa áp dụng','Thấp','Trung bình','Cao'])}
        ${fieldText('mf-product','Sản phẩm tiêu biểu', m.product)}
        ${fieldText('mf-salesChannel','Kênh tiêu thụ sản phẩm', m.salesChannel)}
        ${fieldSelect('mf-goodFarmerTitle','Đăng ký danh hiệu NDSXKD giỏi', m.goodFarmerTitle, ['Không','Cấp xã','Cấp tỉnh/TP','Cấp TW'])}
        ${fieldSelect('mf-activityLevel','Mức độ tham gia sinh hoạt Hội', m.activityLevel, ['Thường xuyên','Không thường xuyên','Hầu như không'])}
        ${fieldTextarea('mf-advantage','Thuận lợi', m.advantage)}
        ${fieldTextarea('mf-difficulty','Khó khăn', m.difficulty)}
        ${fieldTextarea('mf-proposal','Kiến nghị, đề xuất', m.proposal)}
        ${fieldTextarea('mf-chiHoiComment','Nhận xét của Chi hội trưởng', m.chiHoiComment)}
        ${fieldTextarea('mf-proposalToWard','Đề xuất với Hội Nông dân xã', m.proposalToWard)}
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
            <button class="btn btn-ghost preview-allow" id="mf-cancel">Đóng bảng quay lại</button>
            <button class="btn btn-primary preview-allow" id="mf-save">💾 Lưu hồ sơ</button>
          </div>
        </div>`;
      wire();
    }
    function readFormIntoM(){
      const g = id => { const e = wrap.querySelector('#'+id); return e? e.value : undefined; };
      if(tab==='basic'){
        m.fullName=g('mf-fullName'); m.birthYear=g('mf-birthYear'); m.gender=g('mf-gender'); m.ethnicity=g('mf-ethnicity'); m.religion=g('mf-religion');
        m.cccd=g('mf-cccd'); m.educationLevel=g('mf-educationLevel'); m.joinYear=g('mf-joinYear'); m.cardYear=g('mf-cardYear');
        m.currentHamlet=g('mf-currentHamlet'); m.oldHamlet=g('mf-oldHamlet'); m.position=g('mf-position'); m.partyMember=g('mf-partyMember');
        m.phone=g('mf-phone'); m.removedDate=g('mf-removedDate'); m.removedReason=g('mf-removedReason'); m.note=g('mf-note');
        const coreEl=wrap.querySelector('#mf-isCore'); if(coreEl) m.isCore = coreEl.checked;
        const nvEl=wrap.querySelector('#mf-needsVerify'); if(nvEl) m.needsVerify = nvEl.checked;
        m.needsVerifyNote=g('mf-needsVerifyNote');
      } else {
        m.area=g('mf-area'); m.mainIndustry=g('mf-mainIndustry'); m.avgIncome=g('mf-avgIncome'); m.laborCount=g('mf-laborCount');
        m.coopGroup=g('mf-coopGroup'); m.productionType=g('mf-productionType'); m.mainCrop=g('mf-mainCrop'); m.scale=g('mf-scale');
        m.techLevel=g('mf-techLevel'); m.product=g('mf-product'); m.salesChannel=g('mf-salesChannel'); m.goodFarmerTitle=g('mf-goodFarmerTitle');
        m.activityLevel=g('mf-activityLevel'); m.advantage=g('mf-advantage'); m.difficulty=g('mf-difficulty'); m.proposal=g('mf-proposal');
        m.chiHoiComment=g('mf-chiHoiComment'); m.proposalToWard=g('mf-proposalToWard');
      }
    }
    function wire(){
      wrap.querySelector('#mf-close').onclick = close;
      wrap.querySelector('#mf-cancel').onclick = close;
      wrap.querySelector('#mf-tab-basic').onclick = ()=>{ readFormIntoM(); tab='basic'; render(); };
      wrap.querySelector('#mf-tab-advanced').onclick = ()=>{ readFormIntoM(); tab='advanced'; render(); };
      wrap.querySelector('#mf-save').onclick = async ()=>{
        readFormIntoM();
        if(!m.fullName || !m.fullName.trim()){ alert('Vui lòng nhập Họ và tên.'); return; }
        if(!m.currentHamlet){ alert(`Vui lòng chọn Nơi ở hiện nay (${subAdminLabel()}).`); return; }
        await saveMember(m);
        if(window.__instantRemoveModal) window.__instantRemoveModal(wrap); else close();
        if(onSaved) onSaved();
      };
    }
    render();
  }

  // ---------- "THÊM NHANH BẰNG AI" (nhân bản khung chat của Sổ vay vốn — xem renderQuickAddByAiModal
  // ở 09-ai-chat-notes.js — chỉ khác hồ sơ đang soạn là 1 mảng hội viên đơn, không có khái niệm
  // "Phương án vay" nên không cần phần đối chiếu/ràng buộc toán học của loans). ----------
  const MEMBER_QUICKADD_COLS = [
    ['fullName','Họ và tên'], ['currentHamlet','Nơi ở hiện nay'], ['oldHamlet','Nơi ở trước sáp nhập'],
    ['birthYear','Năm sinh'], ['gender','Giới tính'], ['ethnicity','Dân tộc'], ['religion','Tôn giáo'],
    ['cccd','Số CCCD'], ['educationLevel','Trình độ văn hoá'], ['joinYear','Năm vào hội'], ['cardYear','Năm cấp thẻ'],
    ['isCore','Hội viên nòng cốt'], ['position','Chức vụ hiện nay'], ['partyMember','Đảng viên'], ['phone','Số điện thoại'], ['note','Ghi chú'],
  ];
  const MEMBER_QUICKADD_REQUIRED = [['fullName','Họ và tên'], ['currentHamlet','Nơi ở hiện nay']];
  function memberQuickAddSystemPrompt(){
    const hamlets = (state.config.hamlets||[]).join(', ') || '(chưa có)';
    const hamletsOld = (state.config.hamletsLegacyHidden||[]).map(h=> h.endsWith(' (cũ)')? h.slice(0,-5) : h).join(', ') || '(chưa có)';
    const genders = memberGenderOptions().join(', ');
    const ethnicities = memberEthnicityOptions().join(', ');
    const religions = memberReligionOptions().join(', ');
    const positions = memberPositionOptions().join(', ');
    const subAdminUnit = subAdminLabel();
    return `Bạn là trợ lý AI giúp NHẬP NHANH hồ sơ hội viên vào module "Hồ sơ hội viên" của Hội Nông dân. LUÔN gọi người dùng là "đồng chí", tuyệt đối không gọi là "bạn" hay "anh/chị". Đọc tin nhắn văn bản + tài liệu đính kèm (ảnh CCCD, đơn xin vào Hội, sổ ghi chép tay, danh sách in sẵn...) người dùng cung cấp qua nhiều lượt trò chuyện, trích xuất đúng thông tin để THÊM MỚI hội viên vào "Hồ sơ đang soạn".
CÁCH LÀM VIỆC CỐT LÕI — "1 HỒ SƠ DUY NHẤT": người dùng luôn có sẵn 1 "Hồ sơ đang soạn" duy nhất (ban đầu RỖNG) — đây là hồ sơ DUY NHẤT bạn và người dùng cùng làm việc trên đó. Ở CUỐI mỗi tin nhắn của người dùng, bạn LUÔN được cung cấp đúng nội dung Hồ sơ đang soạn HIỆN TẠI — PHẢI đọc kỹ TRƯỚC khi trả lời, rồi CHỈNH SỬA TRỰC TIẾP lên đúng hồ sơ đó (thêm/sửa/xoá hội viên tuỳ theo yêu cầu), LUÔN trả về ĐẦY ĐỦ toàn bộ hồ sơ đã cập nhật trong khối \`\`\`memberadd-result\`\`\` mỗi khi có điều gì thay đổi.
QUY TẮC BẮT BUỘC:
1) CHỈ ĐƯỢC PHÉP THÊM MỚI — không được sửa hội viên nào đã có sẵn trong hệ thống.
2) Trường BẮT BUỘC không được để trống: Họ và tên, Nơi ở hiện nay (${subAdminUnit}). Nếu thiếu, PHẢI hỏi lại người dùng, đừng tự bịa.
3) VỀ ĐỊA CHỈ: "currentHamlet" CHỈ chứa tên ${subAdminUnit} HIỆN NAY (không kèm chữ "${subAdminUnit}" phía trước), danh sách đã có sẵn: ${hamlets}. "oldHamlet" là tên ${subAdminUnit} TRƯỚC SÁP NHẬP, danh sách đã có: ${hamletsOld} (hệ thống tự thêm "(cũ)" khi hiển thị, không cần tự thêm). Nếu người dùng nói 1 tên không khớp danh sách nào, hỏi lại đây là hiện nay hay trước sáp nhập; nếu xác nhận là MỚI thì thêm vào "newHamlets" (hiện nay) hoặc "newHamletsOld" (trước sáp nhập, không kèm "(cũ)").
4) "gender" ưu tiên 1 trong: ${genders}. "ethnicity" ưu tiên 1 trong: ${ethnicities} (nếu là dân tộc mới hoàn toàn chưa có, thêm vào "newEthnicities"). "religion" ưu tiên 1 trong: ${religions} (tôn giáo mới -> "newReligions"). "position" ưu tiên 1 trong: ${positions}. "partyMember" CHỈ là "Có" hoặc "Không" — để "Không" nếu người dùng không nói rõ là Đảng viên.
5) "isCore" là true/false (hội viên nòng cốt) — mặc định false nếu không rõ.
6) Năm sinh/năm vào hội/năm cấp thẻ là số (VD 1972) — không bịa năm nếu chưa có thông tin.
7) KHÔNG BỎ SÓT dữ liệu đã cung cấp; thông tin không xếp được vào trường nào thì cho vào "note".
8) CÁCH TRẢ LỜI: luôn trả lời trò chuyện tự nhiên trước (không bọc JSON). Nếu đã trích xuất được ít nhất 1 hội viên, thêm NGAY CUỐI câu trả lời khối mã sau, ĐÚNG định dạng:
\`\`\`memberadd-result
{"members":[{"fullName":"","currentHamlet":"","oldHamlet":"","birthYear":"","gender":"","ethnicity":"","religion":"","cccd":"","educationLevel":"","joinYear":"","cardYear":"","isCore":false,"position":"","partyMember":"Không","phone":"","note":""}],"newHamlets":[],"newHamletsOld":[],"newEthnicities":[],"newReligions":[]}
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
        Object.assign(m, {
          fullName:b.fullName||'', birthYear:b.birthYear||'', gender:b.gender||'', ethnicity:b.ethnicity||'', religion:b.religion||'',
          cccd:b.cccd||'', educationLevel:b.educationLevel||'', joinYear:b.joinYear||'', cardYear:b.cardYear||'',
          currentHamlet:b.currentHamlet||'', oldHamlet: b.oldHamlet? (b.oldHamlet.endsWith(' (cũ)')?b.oldHamlet:`${b.oldHamlet} (cũ)`) : '',
          isCore: !!b.isCore, position: b.position||memberPositionOptions()[0], partyMember: b.partyMember==='Có'?'Có':'Không',
          phone:b.phone||'', note:b.note||'',
        });
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
    function render(){
      const list = result.members||[];
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:90vh; max-height:90vh; display:flex; flex-direction:column; border-radius:0;">
          <div class="modal-head"><h3>📋 Hồ sơ đang soạn — ${list.length} hội viên</h3><button class="modal-close preview-allow" id="mqfp-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:0;">
            <div class="table-wrap"><table>
              <thead><tr><th></th>${MEMBER_QUICKADD_COLS.map(([,label])=>`<th>${escapeHtml(label)}</th>`).join('')}<th></th></tr></thead>
              <tbody>${list.length? list.map((b,i)=>`<tr>
                <td>${i+1}</td>
                ${MEMBER_QUICKADD_COLS.map(([k])=> k==='isCore'
                  ? `<td style="text-align:center;"><input type="checkbox" class="preview-allow qfp-cell" data-idx="${i}" data-key="${k}" ${b[k]?'checked':''}></td>`
                  : `<td><input type="text" class="preview-allow qfp-cell" data-idx="${i}" data-key="${k}" value="${escapeHtml(b[k]==null?'':String(b[k]))}" style="width:100%; min-width:90px; border:1px solid transparent; background:transparent;"></td>`
                ).join('')}
                <td><button type="button" class="btn btn-ghost btn-sm preview-allow" data-mqfp-del="${i}">🗑️</button></td>
              </tr>`).join('') : `<tr><td colspan="${MEMBER_QUICKADD_COLS.length+2}" style="text-align:center; padding:14px;">Chưa có hội viên nào trong hồ sơ đang soạn.</td></tr>`}</tbody>
            </table></div>
          </div>
          <div class="modal-foot"><button class="btn btn-primary preview-allow" id="mqfp-close2">Đóng bảng</button></div>
        </div>`;
      wrap.querySelector('#mqfp-close').onclick = close;
      wrap.querySelector('#mqfp-close2').onclick = close;
      wrap.querySelectorAll('.qfp-cell').forEach(inp=>{
        const idx = parseInt(inp.dataset.idx,10), key = inp.dataset.key;
        if(inp.type==='checkbox') inp.onchange = ()=>{ list[idx][key] = inp.checked; };
        else inp.oninput = ()=>{ list[idx][key] = inp.value; };
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
            ${messages.length? messages.map(bubbleHtml).join('') : `<p class="sub" style="text-align:center; margin:auto;">Hãy nhắn tin hoặc đính kèm tài liệu (ảnh CCCD, đơn xin vào Hội, sổ ghi chép cũ...) — AI sẽ đợi đến khi đồng chí bấm "🧠 Tiêu hoá tài liệu bằng AI" mới bắt đầu đọc.</p>`}
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
          if((resObj.newHamlets||[]).length || (resObj.newHamletsOld||[]).length || (resObj.newEthnicities||[]).length || (resObj.newReligions||[]).length) cSet('config', state.config);
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
  function renderMembersTab(el){
    ensureMemberFilters();
    const notDeleted = (state.members||[]).filter(m=>!m.deleted);
    const showDeleted = !!state._memberShowDeleted;
    const baseList = showDeleted ? (state.members||[]).filter(m=>m.deleted) : notDeleted;
    const filtered = baseList.filter(memberMatchesFilters);
    const sorted = filtered.slice().sort((a,b)=> (a.currentHamlet||'').localeCompare(b.currentHamlet||'','vi') || (a.fullName||'').localeCompare(b.fullName||'','vi'));
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🪪 Hồ sơ hội viên (${notDeleted.length})</h3></div>
        <div class="panel-body">
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <input type="text" id="mb-search" placeholder="🔎 Tìm theo họ tên, CCCD, số điện thoại..." value="${escapeHtml(state.memberSearch||'')}" style="flex:1; min-width:220px;">
            ${memberFilterDropdownsHtml('mf')}
            <button type="button" class="btn btn-ghost btn-sm preview-allow ${anyMemberFilterActive()?'reset-filter-active':''}" id="mb-reset-filters">↺ Khôi phục bộ lọc gốc</button>
          </div>
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:14px;">
            <button type="button" class="btn btn-primary btn-sm preview-allow" id="mb-add-manual">➕ Thêm hội viên</button>
            <button type="button" class="btn btn-sm preview-allow" id="mb-add-ai" style="background:linear-gradient(180deg,#fff 0%,#7c4dff 45%,#4527a0 100%); color:#fff; font-weight:700;">✨ Thêm nhanh bằng AI</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mb-view-excel">📊 Xem bảng Excel</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mb-print-export">📄 Xuất file/In</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mb-catalogs">⚙️ Quản lý danh mục</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="mb-toggle-trash">${showDeleted? '↩️ Xem danh sách đang hoạt động' : `🗑️ Xem đã xoá (${(state.members||[]).filter(m=>m.deleted).length})`}</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Họ và tên</th><th>${subAdminLabel()}</th><th>Năm sinh</th><th>Giới tính</th><th>Chức vụ</th><th>Đảng viên</th><th>SĐT</th><th></th></tr></thead>
              <tbody>
                ${sorted.length? sorted.map(m=>`<tr>
                  <td>${escapeHtml(m.fullName||'')}${m.needsVerify?' <span title="Cần xác minh" style="color:#b71c1c;">🚩</span>':''}</td>
                  <td>${escapeHtml(m.currentHamlet||'')}</td>
                  <td>${escapeHtml(String(m.birthYear||''))}</td>
                  <td>${escapeHtml(m.gender||'')}</td>
                  <td>${escapeHtml(m.position||'')}</td>
                  <td>${escapeHtml(m.partyMember||'')}</td>
                  <td>${escapeHtml(m.phone||'')}</td>
                  <td style="white-space:nowrap;">
                    ${showDeleted?
                      `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-mb-restore="${m.id}">↩️ Khôi phục</button>`
                      : `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-mb-edit="${m.id}">✏️</button><button type="button" class="btn btn-ghost btn-sm preview-allow" data-mb-del="${m.id}">🗑️</button>`}
                  </td>
                </tr>`).join('') : `<tr><td colspan="8" style="text-align:center; padding:14px;">Không có hội viên theo bộ lọc hiện tại.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    wireMembersTab(el);
  }
  function wireMembersTab(el){
    const searchEl = el.querySelector('#mb-search');
    if(searchEl) searchEl.oninput = ()=>{ state.memberSearch = searchEl.value; rerenderKeepingFocus(()=>renderMembersTab(el)); };
    wireMemberFilterDropdowns(el, 'mf', ()=>renderMembersTab(el));
    const resetBtn = el.querySelector('#mb-reset-filters'); if(resetBtn) resetBtn.onclick = ()=>{ resetMemberFilters(); renderMembersTab(el); };
    const addBtn = el.querySelector('#mb-add-manual'); if(addBtn) addBtn.onclick = ()=> renderMemberFormModal(null, ()=>renderMembersTab(el));
    const aiBtn = el.querySelector('#mb-add-ai'); if(aiBtn) aiBtn.onclick = ()=> renderMemberQuickAddByAiModal();
    const excelBtn = el.querySelector('#mb-view-excel'); if(excelBtn) excelBtn.onclick = ()=> renderMembersExcelViewModal();
    const epBtn = el.querySelector('#mb-print-export'); if(epBtn) epBtn.onclick = ()=> renderMembersExportSelectorModal();
    const catBtn = el.querySelector('#mb-catalogs'); if(catBtn) catBtn.onclick = ()=> renderMemberCatalogsHubModal();
    const trashBtn = el.querySelector('#mb-toggle-trash'); if(trashBtn) trashBtn.onclick = ()=>{ state._memberShowDeleted = !state._memberShowDeleted; renderMembersTab(el); };
    el.querySelectorAll('[data-mb-edit]').forEach(b=> b.onclick=()=>{ const m=(state.members||[]).find(x=>x.id===b.dataset.mbEdit); if(m) renderMemberFormModal(m, ()=>renderMembersTab(el)); });
    el.querySelectorAll('[data-mb-del]').forEach(b=> b.onclick=()=>{ if(!confirm('Chuyển hội viên này vào thùng rác?')) return; softDeleteMember(b.dataset.mbDel).then(()=>renderMembersTab(el)); });
    el.querySelectorAll('[data-mb-restore]').forEach(b=> b.onclick=()=>{ restoreMember(b.dataset.mbRestore).then(()=>renderMembersTab(el)); });
  }

  // ---------- THỐNG KÊ CHO "THỰC LỰC HỘI" ----------
  function currentPeriodLabel(){ const d=new Date(); const q=Math.floor(d.getMonth()/3)+1; return `Quý ${q}/${d.getFullYear()}`; }
  function emptyManualNumbers(){ return { households:'', farmHouseholds:'', farmHouseholdsWithMember:'', laborAbove18:'', residentialGroupsCount:'', residentialTeamsCount:'', professionalGroupsCount:'', professionalGroupsNames:'', professionalTeamsCount:'', professionalTeamsNames:'' }; }
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
      goodFarmer: { ward: count(m=>m.goodFarmerTitle==='Cấp xã'), province: count(m=>m.goodFarmerTitle==='Cấp tỉnh/TP'), central: count(m=>m.goodFarmerTitle==='Cấp TW') },
      pct,
    };
  }
  async function saveStrengthSnapshot(scope, stats){
    const id = 'ss_'+uid();
    const period = state.strengthPeriod || currentPeriodLabel();
    const manual = state._strengthManualDraft || emptyManualNumbers();
    const rec = {
      id, hamlet: scope, period, manualNumbers: {...manual},
      computedSnapshot: { total:stats.total, active:stats.active, core:stats.core, party:stats.party, carded:stats.carded, female:stats.female, male:stats.male, ethnicMinorityTotal:stats.ethnicMinorityTotal, religionTotal:stats.religionTotal, goodFarmer:{...stats.goodFarmer} },
      createdAt: new Date().toISOString(), updatedBy: (state.identity&&state.identity.email)||'',
    };
    await cSetRecord('strengthSnapshots', id, rec);
  }
  function latestManualFor(hamletKey){
    const snaps = (state.strengthSnapshots||[]).filter(s=>s.hamlet===hamletKey).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    return snaps[0] && snaps[0].manualNumbers;
  }
  // Dựng đúng 4 khối bảng Thực lực kiểu Excel — MỖI DÒNG là 1 đơn vị (toàn xã + từng ấp), dùng
  // CHUNG cho cả modal xem Excel lẫn xuất file/in.
  function buildStrengthSections(){
    const activeMembers = (state.members||[]).filter(m=>!m.deleted);
    const hamlets = (state.config.hamlets||[]).filter(h=>h!=='Khác');
    const scopes = [{ key:'__all__', label:`Toàn ${adminLevelLabelLower()}` }].concat(hamlets.map(h=>({ key:h, label:`${subAdminLabel()} ${h}` })));
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
    return [
      { title:'I. Tổng hợp rà soát số lượng hội viên', list: rows, cols: colsI },
      { title:'II. Hội viên là đồng bào dân tộc thiểu số', list: rows, cols: colsII },
      { title:'III. Hội viên là người có đạo', list: rows, cols: colsIII },
      { title:'IV. Thống kê Nông dân sản xuất kinh doanh giỏi', list: rows, cols: colsIV },
    ];
  }
  function renderStrengthExcelViewModal(){ const sections = buildStrengthSections(); renderColumnHeaderExcelModal('📊 Bảng Thực lực Hội', sections, sections[0].cols); }
  function renderStrengthExportModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:420px;">
        <div class="modal-head"><h3>📄 Xuất file/In — Thực lực Hội</h3><button class="modal-close preview-allow" id="sge-close">✕</button></div>
        <div class="modal-body"><p class="sub">Xuất/in đầy đủ cả 4 bảng thực lực (toàn ${adminLevelLabelLower()} và từng ${subAdminLabelLower()}).</p></div>
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
    wrap.querySelector('#sge-print').onclick = ()=>{ close(); printSections('Thực lực Hội', buildStrengthSections()); };
    wrap.querySelector('#sge-excel').onclick = ()=>{ close(); exportSectionsToExcel('Thuc-luc-Hoi', 'BÁO CÁO THỰC LỰC HỘI', buildStrengthSections()); };
  }
  function renderStrengthHistoryModal(scope){
    const list = (state.strengthSnapshots||[]).filter(s=>s.hamlet===scope).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    const cols = [
      { label:'Kỳ báo cáo', get:s=>escapeHtml(s.period||'') },
      { label:'Thời điểm chốt', get:s=>escapeHtml(s.createdAt? new Date(s.createdAt).toLocaleString('vi-VN') : '') },
      { label:'Tổng hội viên', get:s=>String((s.computedSnapshot||{}).total||0) },
      { label:'Sinh hoạt thường xuyên', get:s=>String((s.computedSnapshot||{}).active||0) },
      { label:'Nòng cốt', get:s=>String((s.computedSnapshot||{}).core||0) },
      { label:'Đảng viên', get:s=>String((s.computedSnapshot||{}).party||0) },
      { label:'Đã cấp thẻ', get:s=>String((s.computedSnapshot||{}).carded||0) },
      { label:'Nữ', get:s=>String((s.computedSnapshot||{}).female||0) },
      { label:'Nam', get:s=>String((s.computedSnapshot||{}).male||0) },
    ];
    renderColumnHeaderExcelModal(`🕓 Lịch sử chốt số — ${scope==='__all__'? `Toàn ${adminLevelLabelLower()}` : scope}`, [{ title:'Các kỳ đã chốt', list, cols }], cols);
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
  function strengthManualFormHtml(manual){
    const fields = [
      ['households','Số hộ dân cư'], ['farmHouseholds','Số hộ nông dân'], ['farmHouseholdsWithMember','Số hộ nông dân có hội viên'],
      ['laborAbove18','Số lao động nông nghiệp trên 18 tuổi'],
      ['residentialGroupsCount','Số chi hội khu dân cư'], ['residentialTeamsCount','Số tổ hội khu dân cư'],
      ['professionalGroupsCount','Số chi hội nghề nghiệp'], ['professionalGroupsNames','Tên Chi hội nghề nghiệp cụ thể'],
      ['professionalTeamsCount','Số tổ hội nghề nghiệp'], ['professionalTeamsNames','Tên Tổ hội nghề nghiệp cụ thể'],
    ];
    return `<div class="divider-lbl">Số liệu nhập tay (không suy ra được từ hồ sơ hội viên)</div>
      <div class="form-grid" style="margin-bottom:14px;">
        ${fields.map(([k,lbl])=>`<div class="field"><label>${escapeHtml(lbl)}</label><input type="text" data-sg-manual="${k}" value="${escapeHtml(manual[k]||'')}"></div>`).join('')}
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

  // ---------- TAB "THỰC LỰC HỘI" ----------
  function renderStrengthTab(el){
    const scope = state.strengthHamlet || '__all__';
    const activeMembers = (state.members||[]).filter(m=>!m.deleted);
    const scopedList = scope==='__all__'? activeMembers : activeMembers.filter(m=>m.currentHamlet===scope);
    const stats = computeMemberStats(scopedList);
    const snapshots = (state.strengthSnapshots||[]).filter(s=>s.hamlet===scope).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    if(!state._strengthManualDraft){
      const latest = snapshots[0];
      state._strengthManualDraft = latest? {...emptyManualNumbers(), ...latest.manualNumbers} : emptyManualNumbers();
    }
    const manual = state._strengthManualDraft;
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>💪 Thực lực Hội</h3></div>
        <div class="panel-body">
          <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:14px;">
            <select id="sg-scope">
              <option value="__all__" ${scope==='__all__'?'selected':''}>Toàn ${adminLevelLabelLower()}</option>
              ${(state.config.hamlets||[]).filter(h=>h!=='Khác').map(h=>`<option value="${escapeHtml(h)}" ${scope===h?'selected':''}>${subAdminLabel()} ${escapeHtml(h)}</option>`).join('')}
            </select>
            <input type="text" id="sg-period" value="${escapeHtml(state.strengthPeriod||currentPeriodLabel())}" style="width:160px;" placeholder="Kỳ báo cáo, VD: Quý 4/2026">
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sg-view-excel">📊 Xem bảng Excel</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sg-print-export">📄 Xuất file/In</button>
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="sg-history">🕓 Lịch sử các kỳ (${snapshots.length})</button>
          </div>
          ${strengthBlockIHtml(stats)}
          ${strengthManualFormHtml(manual)}
          ${strengthBlockIIHtml(stats)}
          ${strengthBlockIIIHtml(stats)}
          ${strengthBlockIVHtml(stats)}
          <div style="text-align:right; margin-top:10px;">
            <button type="button" class="btn btn-primary preview-allow" id="sg-save-snapshot">💾 Chốt số kỳ này</button>
          </div>
        </div>
      </div>`;
    wireStrengthTab(el, stats, scope);
  }
  function wireStrengthTab(el, stats, scope){
    const scopeSel = el.querySelector('#sg-scope'); if(scopeSel) scopeSel.onchange = ()=>{ state.strengthHamlet = scopeSel.value; state._strengthManualDraft = null; renderStrengthTab(el); };
    const periodInput = el.querySelector('#sg-period'); if(periodInput) periodInput.oninput = ()=>{ state.strengthPeriod = periodInput.value; };
    el.querySelectorAll('[data-sg-manual]').forEach(inp=> inp.oninput = ()=>{ state._strengthManualDraft[inp.dataset.sgManual] = inp.value; });
    const excelBtn = el.querySelector('#sg-view-excel'); if(excelBtn) excelBtn.onclick = ()=> renderStrengthExcelViewModal();
    const epBtn = el.querySelector('#sg-print-export'); if(epBtn) epBtn.onclick = ()=> renderStrengthExportModal();
    const histBtn = el.querySelector('#sg-history'); if(histBtn) histBtn.onclick = ()=> renderStrengthHistoryModal(scope);
    const saveBtn = el.querySelector('#sg-save-snapshot'); if(saveBtn) saveBtn.onclick = ()=> saveStrengthSnapshot(scope, stats).then(()=>{ showToast('Đã chốt số kỳ này!'); renderStrengthTab(el); });
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
