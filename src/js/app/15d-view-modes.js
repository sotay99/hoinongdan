  // =====================================================================
  // 15d-view-modes.js — CHẾ ĐỘ XEM TRÊN MÀN HÌNH HẸP cho bộ xem Word / Excel / PowerPoint (dùng chung
  // Trung tâm dữ liệu và Phòng họp không giấy).
  //
  // Chỉ áp dụng khi khung xem hẹp hơn 700px (điện thoại, máy tính bảng nhỏ cầm dọc). Màn hình rộng hơn
  // thì không có nút, không có modal: Word hiện như bản in, Excel đúng cỡ chữ, PowerPoint hiện slide.
  //   • Word: "📱 Dễ đọc trên điện thoại" (mặc định — bỏ khung trang giấy, chữ tự xuống dòng, bảng có
  //     kẻ ô thì vuốt ngang, bảng dàn trang không kẻ viền như quốc hiệu thì co vừa màn hình) và "📄 Như
  //     bản in". Mở tệp Word là hỏi chế độ (trừ khi đã "Ghi nhớ lựa chọn này"), lưu trên trình duyệt.
  //   • Excel: "📐 Xem cả bảng" (mặc định) và "🔍 Chữ cỡ thật". Không hỏi khi mở.
  //   • PowerPoint: "🖼️ Xem slide" (mặc định) và "📝 Chỉ xem chữ". Không hỏi khi mở.
  // Nằm giữa manifest nên không chứa khối boot().
  // =====================================================================
  const VM_NARROW_PX = 700;
  const VM_DOCX_MODE_KEY = 'hnd_view_docx_mode';
  const VM_DOCX_REMEMBER_KEY = 'hnd_view_docx_remember'; // '1' = đã ghi nhớ (không hỏi nữa), '0' = vẫn hỏi
  const VM_DOCX_MODES = [
    { key:'reflow', icon:'📱', label:'Dễ đọc trên điện thoại', desc:'Chữ to rõ, tự xuống dòng theo màn hình. Bảng rộng thì vuốt ngang để xem.' },
    { key:'print',  icon:'📄', label:'Như bản in', desc:'Giữ nguyên trang giấy như khi in. Chữ nhỏ, phóng to bằng hai ngón tay.' },
  ];
  const VM_XLSX_MODES = [
    { key:'fit',    icon:'📐', label:'Xem cả bảng', desc:'Thu cả bảng vừa màn hình để thấy toàn bộ. Chữ nhỏ, phóng to bằng hai ngón tay.' },
    { key:'actual', icon:'🔍', label:'Chữ cỡ thật', desc:'Chữ rõ đúng cỡ trong tệp. Vuốt ngang và dọc để xem hết bảng.' },
  ];
  const VM_PPTX_MODES = [
    { key:'slides', icon:'🖼️', label:'Xem slide', desc:'Từng slide đúng như khi trình chiếu. Xoay ngang điện thoại để xem to hơn.' },
    { key:'text',   icon:'📝', label:'Chỉ xem chữ', desc:'Chữ của từng slide hiện thành đoạn văn to rõ, dễ đọc trên điện thoại.' },
  ];
  function vmIsNarrow(el){
    const w = (el && el.clientWidth) || window.innerWidth || 1024;
    return w < VM_NARROW_PX;
  }
  // localStorage có thể bị chặn (chế độ ẩn danh, trình duyệt trong Zalo) — lỗi thì coi như chưa lưu gì.
  function vmGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function vmSet(k, v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){} }
  function vmFind(modes, key){ return modes.find(m=> m.key===key) || modes[0]; }
  function vmButtonHtml(modes, key){
    const m = vmFind(modes, key);
    return `Chế độ xem: <b>${m.icon} ${escapeHtml(m.label)}</b> <span aria-hidden="true">▾</span>`;
  }
  // Modal chọn chế độ. Bấm "Xem tài liệu" thì onPick(key, remember) — remember là true/false khi có ô ghi
  // nhớ, undefined khi không có. Đóng ngang (✕, bấm ra ngoài, phím Esc) thì giữ `current`, không đổi ghi nhớ.
  function vmModal({ modes, current, remember, onPick }){
    document.querySelectorAll('.vm-modal-bg').forEach(x=> x.remove());
    let sel = vmFind(modes, current).key;
    const wrap = document.createElement('div');
    wrap.className = 'vm-modal-bg mt-font';
    wrap.innerHTML = `<div class="vm-modal" role="dialog" aria-modal="true" aria-labelledby="vm-title">
      <div class="vm-head"><h3 id="vm-title">Chọn cách xem tài liệu</h3><button type="button" class="vm-close preview-allow" data-vm-close aria-label="Đóng">✕</button></div>
      <div class="vm-opts">${modes.map((m,i)=>`<button type="button" class="vm-opt preview-allow ${m.key===sel?'on':''}" data-vm-key="${m.key}" aria-pressed="${m.key===sel}">
          <span class="vm-ico">${m.icon}</span>
          <span class="vm-txt"><b>${escapeHtml(m.label)}</b>${i===0 ? ' <em>(mặc định)</em>' : ''}<small>${escapeHtml(m.desc)}</small></span>
          <span class="vm-radio" aria-hidden="true"></span></button>`).join('')}</div>
      ${remember!==undefined ? `<label class="vm-remember"><input type="checkbox" data-vm-remember ${remember ? 'checked' : ''}> Ghi nhớ lựa chọn này cho các tệp sau</label>` : ''}
      <button type="button" class="btn btn-primary vm-ok preview-allow" data-vm-ok>Xem tài liệu</button>
    </div>`;
    document.body.appendChild(wrap);
    const onKey = e=>{ if(e.key==='Escape') finish(null); };
    const finish = (picked)=>{
      wrap.remove();
      document.removeEventListener('keydown', onKey);
      if(picked===null) return onPick(vmFind(modes, current).key, undefined, true);
      const cb = wrap.querySelector('[data-vm-remember]');
      onPick(picked, cb ? cb.checked : undefined, false);
    };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e=>{ if(e.target===wrap) finish(null); });
    wrap.querySelector('[data-vm-close]').onclick = ()=> finish(null);
    wrap.querySelectorAll('[data-vm-key]').forEach(b=> b.onclick = ()=>{
      sel = b.dataset.vmKey;
      wrap.querySelectorAll('[data-vm-key]').forEach(x=>{ const on = x.dataset.vmKey===sel; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    });
    wrap.querySelector('[data-vm-ok]').onclick = ()=> finish(sel);
    setTimeout(()=>{ const ok = wrap.querySelector('[data-vm-ok]'); if(ok) ok.focus(); }, 30);
  }

  // =====================================================================
  // WORD
  // =====================================================================
  function vmDocxStartMode(){
    return vmGet(VM_DOCX_REMEMBER_KEY)==='1' && vmGet(VM_DOCX_MODE_KEY)==='print' ? 'print' : 'reflow';
  }
  // Đánh dấu bảng: có kẻ ô (bảng số liệu -> vuốt ngang) hay không kẻ viền (bảng dàn trang như quốc hiệu
  // -> co vừa màn hình), rồi bọc mỗi bảng ngoài cùng trong một khung cuộn riêng. Đường kẻ do docx-preview
  // gắn thẳng vào ô (inline) nên phải đọc kiểu đã tính, sau khi bảng đã nằm trong trang.
  function vmDocxMarkTables(host){
    const hasBorder = el=>{
      const cs = getComputedStyle(el);
      return ['Top','Right','Bottom','Left'].some(s=> cs['border'+s+'Style']!=='none' && cs['border'+s+'Style']!=='hidden' && parseFloat(cs['border'+s+'Width'])>0);
    };
    host.querySelectorAll('.docx-wrapper table').forEach(t=>{
      if(t.parentElement && t.parentElement.closest('td,th')) return;
      if(t.parentElement && t.parentElement.classList.contains('dv-tbl-scroll')) return;
      let bordered = hasBorder(t);
      if(!bordered){ for(const c of t.querySelectorAll('td,th')){ if(hasBorder(c)){ bordered = true; break; } } }
      t.classList.add(bordered ? 'dv-data-tbl' : 'dv-layout-tbl');
      const box = document.createElement('div');
      box.className = 'dv-tbl-scroll';
      t.parentNode.insertBefore(box, t);
      box.appendChild(t);
    });
  }
  function vmDocxApply(host){
    if(!host || !host.isConnected) return;
    const narrow = vmIsNarrow(host);
    const mode = host.dataset.vmMode || 'reflow';
    const bar = host.querySelector(':scope > .vm-bar');
    if(bar){
      bar.style.display = narrow ? '' : 'none';
      const btn = bar.querySelector('[data-vm-open]'); if(btn) btn.innerHTML = vmButtonHtml(VM_DOCX_MODES, mode);
    }
    const reflow = narrow && mode==='reflow';
    host.classList.toggle('dv-reflow', reflow);
    const wrap = host.querySelector('.docx-wrapper');
    if(reflow){ if(wrap) wrap.style.zoom = ''; }
    else driveFitDocxPages(host);
    // Bảng số liệu tràn ngang thì hiện dòng nhắc "vuốt ngang" phía trên — không có thì người đọc dễ tưởng
    // bảng bị cắt mất cột.
    host.querySelectorAll('.dv-tbl-scroll').forEach(box=>{
      box.classList.toggle('dv-overflow', reflow && box.scrollWidth > box.clientWidth + 2);
    });
  }
  function vmDocxChoose(host, key, remember){
    host.dataset.vmMode = key;
    if(remember===true){ vmSet(VM_DOCX_MODE_KEY, key); vmSet(VM_DOCX_REMEMBER_KEY, '1'); }
    else if(remember===false){ vmSet(VM_DOCX_REMEMBER_KEY, '0'); vmSet(VM_DOCX_MODE_KEY, null); }
    vmDocxApply(host);
  }
  function vmDocxOpenModal(host){
    vmModal({ modes:VM_DOCX_MODES, current:host.dataset.vmMode || 'reflow', remember: vmGet(VM_DOCX_REMEMBER_KEY)!=='0',
      onPick:(key, remember, dismissed)=>{ if(dismissed) return vmDocxApply(host); vmDocxChoose(host, key, remember); } });
  }
  // Gọi ngay sau khi docx-preview dựng xong và khung đã nằm trong trang (15-drive-hub.js).
  function vmDocxSetup(host){
    vmDocxMarkTables(host);
    const bar = document.createElement('div');
    bar.className = 'vm-bar';
    bar.innerHTML = `<button type="button" class="vm-btn preview-allow" data-vm-open></button>`;
    host.insertBefore(bar, host.firstChild);
    bar.querySelector('[data-vm-open]').onclick = ()=> vmDocxOpenModal(host);
    host.dataset.vmMode = vmDocxStartMode();
    vmDocxApply(host);
    if(vmIsNarrow(host) && vmGet(VM_DOCX_REMEMBER_KEY)!=='1') vmDocxOpenModal(host);
  }

  // =====================================================================
  // EXCEL — thay cho nút "Cỡ thật/Vừa màn hình" cũ. Màn hình rộng: luôn đúng cỡ (vuốt nếu bảng rộng).
  // =====================================================================
  function vmXlsxApply(host){
    const sheet = host.querySelector('.xv-sheet'), box = host.querySelector('.xv-scroll'), btn = host.querySelector('[data-vm-open]');
    if(!sheet || !box) return;
    sheet.style.zoom = '';
    const narrow = vmIsNarrow(host);
    const need = sheet.offsetWidth, have = box.clientWidth - 16;
    const fitsAlready = !need || !have || need <= have;
    if(btn){
      btn.style.display = narrow && !fitsAlready ? '' : 'none';
      btn.innerHTML = vmButtonHtml(VM_XLSX_MODES, host.dataset.vmMode || 'fit');
    }
    if(narrow && !fitsAlready && (host.dataset.vmMode || 'fit')==='fit') sheet.style.zoom = String(Math.max(0.3, have/need));
  }
  function vmXlsxOpenModal(host){
    vmModal({ modes:VM_XLSX_MODES, current:host.dataset.vmMode || 'fit',
      onPick:(key, remember, dismissed)=>{ if(!dismissed) host.dataset.vmMode = key; vmXlsxApply(host); } });
  }

  // =====================================================================
  // POWERPOINT — chế độ "Chỉ xem chữ": đọc chữ từng slide (theo đúng thứ tự trong bài, bỏ slide ẩn) thành
  // tiêu đề + đoạn văn + bảng; dựng một lần khi chọn lần đầu.
  // =====================================================================
  const VM_NS_DML = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const VM_NS_PML = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const VM_NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  async function vmPptxOrder(zip){
    try{
      const pres = new DOMParser().parseFromString(await zip.file('ppt/presentation.xml').async('text'), 'application/xml');
      const rels = new DOMParser().parseFromString(await zip.file('ppt/_rels/presentation.xml.rels').async('text'), 'application/xml');
      const target = {};
      Array.from(rels.getElementsByTagName('Relationship')).forEach(r=>{ target[r.getAttribute('Id')] = r.getAttribute('Target'); });
      const list = Array.from(pres.getElementsByTagNameNS(VM_NS_PML, 'sldId'))
        .map(s=> target[s.getAttributeNS(VM_NS_REL, 'id')])
        .filter(Boolean)
        .map(t=> t.startsWith('/') ? t.slice(1) : 'ppt/' + t.replace(/^\.\//, ''));
      if(list.length) return list;
    }catch(e){}
    return Object.keys(zip.files).filter(n=> /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a,b)=> parseInt(a.match(/(\d+)\.xml$/)[1],10) - parseInt(b.match(/(\d+)\.xml$/)[1],10));
  }
  function vmPptxParaText(p){
    let s = '';
    const walk = n=>{
      for(const c of n.childNodes){
        if(c.nodeType!==1) continue;
        if(c.localName==='t') s += c.textContent;
        else if(c.localName==='br') s += '\n';
        else if(c.localName==='fld' && /slidenum/i.test(c.getAttribute('type')||'')) continue;
        else walk(c);
      }
    };
    walk(p);
    return s.replace(/[ \t]+/g, ' ').trim();
  }
  async function vmPptxTextHtml(buffer){
    await loadOptionalLibrary('jszip');
    const zip = await JSZip.loadAsync(buffer);
    const files = await vmPptxOrder(zip);
    const slides = [];
    for(const f of files){
      const file = zip.file(f); if(!file) continue;
      const doc = new DOMParser().parseFromString(await file.async('text'), 'application/xml');
      if(doc.documentElement.getAttribute('show')==='0') continue;
      let title = '';
      const paras = [], tables = [];
      Array.from(doc.getElementsByTagNameNS(VM_NS_PML, 'sp')).forEach(sp=>{
        const ph = sp.getElementsByTagNameNS(VM_NS_PML, 'ph')[0];
        const type = ph ? (ph.getAttribute('type') || 'body') : '';
        if(/^(sldNum|dt|ftr)$/.test(type)) return;
        const isTitle = /^(title|ctrTitle)$/.test(type);
        Array.from(sp.getElementsByTagNameNS(VM_NS_DML, 'p')).forEach(p=>{
          const text = vmPptxParaText(p); if(!text) return;
          if(isTitle && !title){ title = text; return; }
          const pPr = p.getElementsByTagNameNS(VM_NS_DML, 'pPr')[0];
          const lvl = pPr ? (parseInt(pPr.getAttribute('lvl'),10) || 0) : 0;
          // Có gạch đầu dòng khi đoạn tự khai báo ký hiệu/đánh số, hoặc nằm trong ô nội dung của slide mẫu
          // (mặc định có gạch đầu dòng) — trừ khi đoạn ghi rõ "không gạch" (buNone).
          const has = tag=> !!p.getElementsByTagNameNS(VM_NS_DML, tag)[0];
          const bullet = !has('buNone') && (has('buChar') || has('buAutoNum') || type==='body' || type==='obj');
          paras.push({ text, lvl, bullet });
        });
      });
      Array.from(doc.getElementsByTagNameNS(VM_NS_DML, 'tbl')).forEach(tbl=>{
        const rows = Array.from(tbl.getElementsByTagNameNS(VM_NS_DML, 'tr')).map(tr=> Array.from(tr.getElementsByTagNameNS(VM_NS_DML, 'tc')).map(tc=> Array.from(tc.getElementsByTagNameNS(VM_NS_DML, 'p')).map(vmPptxParaText).filter(Boolean).join('\n')));
        if(rows.some(r=> r.some(Boolean))) tables.push(rows);
      });
      // Slide không dùng khung tiêu đề của slide mẫu (tiêu đề gõ vào khung chữ thường): lấy đoạn đầu tiên
      // không có gạch đầu dòng làm tiêu đề.
      if(!title && paras.length && !paras[0].bullet) title = paras.shift().text;
      slides.push({ title, paras, tables });
    }
    if(!slides.length) return '<div class="pv-text-empty">Bài trình bày không có chữ để hiện.</div>';
    return slides.map((s,i)=>`<article class="pv-tslide">
        <div class="pv-tnum">Slide ${i+1}/${slides.length}</div>
        ${s.title ? `<h4>${escapeHtml(s.title)}</h4>` : ''}
        ${s.paras.map(p=>`<p class="${p.bullet ? 'b' : ''}" style="margin-left:${p.lvl*18}px">${escapeHtml(p.text).replace(/\n/g,'<br>')}</p>`).join('')}
        ${s.tables.map(rows=>`<div class="pv-ttbl"><table>${rows.map((r,ri)=>`<tr>${r.map(c=> ri===0 ? `<th>${escapeHtml(c).replace(/\n/g,'<br>')}</th>` : `<td>${escapeHtml(c).replace(/\n/g,'<br>')}</td>`).join('')}</tr>`).join('')}</table></div>`).join('')}
        ${!s.title && !s.paras.length && !s.tables.length ? '<p class="pv-text-none">(Slide này chỉ có hình, không có chữ.)</p>' : ''}
      </article>`).join('');
  }
  async function vmPptxApply(host){
    if(!host || !host.isConnected) return;
    const narrow = vmIsNarrow(host);
    const mode = narrow ? (host.dataset.vmMode || 'slides') : 'slides';
    const bar = host.querySelector(':scope > .vm-bar'), stage = host.querySelector('.pv-stage'), text = host.querySelector('.pv-text'), hint = host.querySelector('.pv-hint');
    if(bar){
      bar.style.display = narrow ? '' : 'none';
      const btn = bar.querySelector('[data-vm-open]'); if(btn) btn.innerHTML = vmButtonHtml(VM_PPTX_MODES, host.dataset.vmMode || 'slides');
    }
    if(hint) hint.style.display = narrow && mode==='slides' && window.innerHeight > window.innerWidth ? '' : 'none';
    if(stage) stage.style.display = mode==='text' ? 'none' : '';
    if(text) text.style.display = mode==='text' ? '' : 'none';
    if(mode==='text' && text && !text.dataset.done){
      text.dataset.done = '1';
      text.innerHTML = '<div class="pv-text-empty">Đang lấy chữ từ các slide…</div>';
      try{ text.innerHTML = await vmPptxTextHtml(host.__pptxBuffer); }
      catch(e){ console.warn('[Xem PowerPoint] Không lấy được chữ:', e); text.innerHTML = '<div class="pv-text-empty">Không lấy được chữ của bài trình bày này.</div>'; delete text.dataset.done; }
    }
  }
  function vmPptxSetup(host, buffer){
    host.__pptxBuffer = buffer;
    const bar = document.createElement('div');
    bar.className = 'vm-bar';
    bar.innerHTML = `<button type="button" class="vm-btn preview-allow" data-vm-open></button>`;
    host.insertBefore(bar, host.firstChild);
    const hint = document.createElement('div');
    hint.className = 'pv-hint';
    hint.textContent = '📱↔ Xoay ngang điện thoại để xem slide to hơn.';
    bar.after(hint);
    const text = document.createElement('div');
    text.className = 'pv-text';
    text.style.display = 'none';
    host.appendChild(text);
    bar.querySelector('[data-vm-open]').onclick = ()=> vmModal({ modes:VM_PPTX_MODES, current:host.dataset.vmMode || 'slides',
      onPick:(key, remember, dismissed)=>{ if(!dismissed) host.dataset.vmMode = key; vmPptxApply(host); } });
    host.dataset.vmMode = 'slides';
    vmPptxApply(host);
  }

  // Đổi kích thước/xoay màn hình: chế độ hẹp/rộng tính lại cho mọi bộ xem đang mở.
  if(!window.__vmResize){
    window.__vmResize = true;
    let t = null;
    window.addEventListener('resize', ()=>{
      clearTimeout(t);
      t = setTimeout(()=>{
        document.querySelectorAll('.drive-viewer-docx-pages').forEach(vmDocxApply);
        document.querySelectorAll('.xv').forEach(vmXlsxApply);
        document.querySelectorAll('.pv').forEach(vmPptxApply);
      }, 120);
    });
  }
