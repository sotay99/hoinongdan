  // =====================================================================
  // 15b-xlsx-viewer.js — Xem Excel GIỮ BỐ CỤC (dùng chung cho Trung tâm dữ liệu và Phòng họp không giấy,
  // qua drivePopulateFileViewer ở 15-drive-hub.js).
  //
  // SheetJS bản miễn phí không đọc định dạng ô, nên phần đọc tệp dùng ExcelJS (phông, màu chữ, màu nền,
  // đường kẻ, gộp ô, độ rộng cột, chiều cao dòng, ẩn dòng/cột, ảnh chèn trong trang tính); phần hiện số theo
  // đúng định dạng (#,##0 / 0.0% / dd/mm/yyyy…) dùng bộ định dạng SSF có sẵn trong SheetJS. Ô công thức hiện
  // KẾT QUẢ Excel đã lưu trong tệp (không tính lại). Đọc không được (tệp .xls cũ, tệp hỏng) thì trả false để
  // quay về bảng đơn giản của SheetJS như trước. Nằm giữa manifest nên không chứa khối boot().
  // =====================================================================
  const XV_MAX_ROWS = 1500, XV_MAX_COLS = 80;
  // Bảng màu chủ đề Office mặc định — dùng khi tệp không kèm theme. Thứ tự theo CHỈ SỐ theme của Excel
  // (0 = lt1 nền trắng, 1 = dk1 chữ đen, 2 = lt2, 3 = dk2, 4..9 = accent1..6, 10 = hlink, 11 = folHlink).
  const XV_OFFICE_THEME = ['FFFFFF','000000','E7E6E6','44546A','4472C4','ED7D31','A5A5A5','FFC000','5B9BD5','70AD47','0563C1','954F72'];
  const XV_INDEXED = [
    '000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF',
    '800000','008000','000080','808000','800080','008080','C0C0C0','808080','9999FF','993366','FFFFCC','CCFFFF','660066','FF8080','0066CC','CCCCFF',
    '000080','FF00FF','FFFF00','00FFFF','800080','800000','008080','0000FF','00CCFF','CCFFFF','CCFFCC','FFFF99','99CCFF','FF99CC','CC99FF','FFCC99',
    '3366FF','33CCCC','99CC00','FFCC00','FF9900','FF6600','666699','969696','003366','339966','003300','333300','993300','993366','333399','333333',
    '000000','FFFFFF',
  ];
  const XV_BORDER = { thin:'1px solid', hair:'1px solid', dotted:'1px dotted', dashed:'1px dashed', dashDot:'1px dashed', dashDotDot:'1px dotted',
    medium:'2px solid', mediumDashed:'2px dashed', mediumDashDot:'2px dashed', mediumDashDotDot:'2px dotted', slantDashDot:'2px dashed', thick:'3px solid', double:'3px double' };

  // Bảng màu chủ đề lấy từ chính tệp (xl/theme/theme1.xml) nếu có — thứ tự trong tệp là dk1, lt1, dk2, lt2,
  // accent1..6, hlink, folHlink; Excel đánh chỉ số đảo cặp sáng/tối đầu tiên nên phải đổi chỗ.
  function xvThemePalette(wb){
    try{
      const xml = wb && wb._themes && (wb._themes.theme1 || Object.values(wb._themes)[0]);
      if(!xml) return XV_OFFICE_THEME;
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const scheme = doc.getElementsByTagNameNS('*', 'clrScheme')[0];
      if(!scheme) return XV_OFFICE_THEME;
      const pick = name=>{
        const el = scheme.getElementsByTagNameNS('*', name)[0]; if(!el) return null;
        const c = el.firstElementChild; if(!c) return null;
        return (c.getAttribute('val') && c.localName==='srgbClr') ? c.getAttribute('val') : (c.getAttribute('lastClr') || null);
      };
      const names = ['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'];
      return names.map((n,i)=> pick(n) || XV_OFFICE_THEME[i]);
    }catch(e){ return XV_OFFICE_THEME; }
  }
  // "Tint" của Excel: làm sáng (tint > 0) hoặc tối (tint < 0) màu gốc theo độ sáng HSL.
  function xvTint(hex, tint){
    if(!tint) return hex;
    let r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h = 0, s = 0, l = (max+min)/2;
    if(max!==min){
      const d = max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      h = max===r ? (g-b)/d + (g<b?6:0) : max===g ? (b-r)/d + 2 : (r-g)/d + 4;
      h /= 6;
    }
    l = tint<0 ? l*(1+tint) : l*(1-tint) + tint;
    const hue = (p,q,t)=>{ if(t<0) t+=1; if(t>1) t-=1; if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3-t)*6; return p; };
    if(s===0){ r = g = b = l; }
    else { const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q; r = hue(p,q,h+1/3); g = hue(p,q,h); b = hue(p,q,h-1/3); }
    return [r,g,b].map(x=> Math.round(Math.min(1,Math.max(0,x))*255).toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function xvColor(c, theme){
    if(!c) return null;
    let hex = null;
    if(c.argb && /^[0-9A-Fa-f]{6,8}$/.test(c.argb)) hex = c.argb.slice(-6);
    else if(c.theme!=null && theme[c.theme]) hex = theme[c.theme];
    else if(c.indexed!=null && XV_INDEXED[c.indexed]) hex = XV_INDEXED[c.indexed];
    if(!hex) return null;
    return '#' + xvTint(hex.toUpperCase(), c.tint||0);
  }
  function xvFontCss(f, theme){
    if(!f) return '';
    const out = [];
    if(f.name){
      const n = String(f.name).replace(/["'\\;<>]/g,'');
      const fb = /^calibri/i.test(n) ? '"Carlito", Arial, sans-serif' : /times|cambria|georgia/i.test(n) ? 'serif' : 'Arial, sans-serif';
      out.push(`font-family:"${n}", ${fb}`);
    }
    if(f.size) out.push(`font-size:${Number(f.size)||11}pt`);
    if(f.bold) out.push('font-weight:700');
    if(f.italic) out.push('font-style:italic');
    const deco = [f.underline ? 'underline' : '', f.strike ? 'line-through' : ''].filter(Boolean).join(' ');
    if(deco) out.push(`text-decoration:${deco}`);
    const col = xvColor(f.color, theme); if(col) out.push(`color:${col}`);
    if(f.vertAlign==='superscript') out.push('vertical-align:super');
    if(f.vertAlign==='subscript') out.push('vertical-align:sub');
    return out.join(';');
  }
  // Ngày trong ExcelJS là Date theo giờ UTC -> đổi về số sê-ri Excel để SSF định dạng đúng mẫu của ô.
  function xvDateSerial(d, date1904){ return (d.getTime() - Date.UTC(1899,11,30))/86400000 - (date1904 ? 1462 : 0); }
  // Số hiện theo kiểu Việt Nam (4.000 / 125,0%) cho thống nhất với cả app (money(), vi-VN) — SSF luôn ra kiểu
  // Mỹ. Chỉ đổi với định dạng SỐ; định dạng ngày giờ (dd/mm/yyyy hh:mm...) giữ nguyên.
  function xvViNumber(fmt, text){
    try{ if(window.XLSX && XLSX.SSF && XLSX.SSF.is_date(fmt || 'General')) return text; }catch(e){}
    return String(text).replace(/[.,]/g, ch=> ch==='.' ? ',' : '.');
  }
  function xvFormat(fmt, v){
    try{ return window.XLSX && XLSX.SSF ? XLSX.SSF.format(fmt || 'General', v) : String(v); }catch(e){ return String(v); }
  }
  // Nội dung hiện ra của một ô: { html, kind: 'num'|'bool'|'text'|'err' }.
  function xvCellContent(cell, theme, date1904){
    let v = cell.value;
    if(v==null) return { html:'', kind:'text' };
    if(typeof v==='object' && !(v instanceof Date)){
      if(Array.isArray(v.richText)) return { html: v.richText.map(rt=>{ const css = xvFontCss(rt.font, theme); return css ? `<span style='${css}'>${escapeHtml(rt.text||'')}</span>` : escapeHtml(rt.text||''); }).join(''), kind:'text' };
      if(v.formula!==undefined || v.sharedFormula!==undefined) v = v.result;
      else if(v.hyperlink!==undefined) return { html: escapeHtml(typeof v.text==='object' && v.text && v.text.richText ? v.text.richText.map(x=> x.text).join('') : String(v.text!=null ? v.text : v.hyperlink)), kind:'text', link:true };
      else if(v.error) return { html: escapeHtml(v.error), kind:'err' };
    }
    if(v==null) return { html:'', kind:'text' };
    if(typeof v==='object' && !(v instanceof Date)){
      if(v.error) return { html: escapeHtml(v.error), kind:'err' };
      return { html: escapeHtml(String(v.text || '')), kind:'text' };
    }
    if(v instanceof Date){
      const fmt = cell.numFmt && cell.numFmt!=='General' ? cell.numFmt : 'dd/mm/yyyy';
      return { html: escapeHtml(xvFormat(fmt, xvDateSerial(v, date1904))), kind:'num' };
    }
    if(typeof v==='number') return { html: escapeHtml(xvViNumber(cell.numFmt, xvFormat(cell.numFmt, v))), kind:'num' };
    if(typeof v==='boolean') return { html: v ? 'TRUE' : 'FALSE', kind:'bool' };
    return { html: escapeHtml(String(v)), kind:'text' };
  }
  function xvParseRef(ref){
    const m = String(ref||'').toUpperCase().match(/^\$?([A-Z]{1,3})\$?(\d+)$/); if(!m) return null;
    let col = 0; for(const ch of m[1]) col = col*26 + (ch.charCodeAt(0)-64);
    return { row: parseInt(m[2],10), col };
  }
  function xvMerges(ws){
    const list = (ws.model && ws.model.merges) || [];
    return list.map(r=>{ const [a,b] = String(r).split(':'); const s = xvParseRef(a), e = xvParseRef(b||a); return s && e ? { top:Math.min(s.row,e.row), left:Math.min(s.col,e.col), bottom:Math.max(s.row,e.row), right:Math.max(s.col,e.col) } : null; }).filter(Boolean);
  }
  function xvCellCss(cell, kind, theme, grid){
    const st = cell.style || {}, out = [];
    const fc = xvFontCss(st.font, theme); if(fc) out.push(fc);
    const fill = st.fill;
    if(fill){
      const col = fill.type==='gradient' ? xvColor(fill.stops && fill.stops[0] && fill.stops[0].color, theme)
        : (fill.pattern && fill.pattern!=='none') ? xvColor(fill.fgColor, theme) || xvColor(fill.bgColor, theme) : null;
      if(col) out.push(`background:${col}`);
    }
    const bd = st.border || {};
    ['top','right','bottom','left'].forEach(side=>{
      const b = bd[side];
      if(b && b.style && XV_BORDER[b.style]) out.push(`border-${side}:${XV_BORDER[b.style]} ${xvColor(b.color, theme) || (b.style==='hair' ? '#9e9e9e' : '#000')}`);
      else if(grid) out.push(`border-${side}:1px solid #e2e2e2`);
    });
    const al = st.alignment || {};
    const h = al.horizontal && al.horizontal!=='general' ? al.horizontal : (kind==='num' ? 'right' : kind==='bool' || kind==='err' ? 'center' : 'left');
    out.push(`text-align:${h==='centerContinuous' ? 'center' : h==='distributed' ? 'justify' : h==='fill' ? 'left' : h}`);
    out.push(`vertical-align:${al.vertical==='middle' || al.vertical==='center' ? 'middle' : al.vertical==='top' ? 'top' : 'bottom'}`);
    out.push(al.wrapText ? 'white-space:pre-wrap; overflow-wrap:anywhere' : 'white-space:pre');
    if(al.indent) out.push(`padding-left:${3 + al.indent*9}px`);
    return out.join(';');
  }
  // Vẽ một trang tính thành bảng HTML giữ độ rộng cột/chiều cao dòng; trả về { html, truncated }.
  function xvSheetHtml(wb, ws, theme){
    const date1904 = !!(wb.properties && wb.properties.date1904);
    const dims = ws.dimensions && ws.dimensions.model ? ws.dimensions.model : (ws.dimensions || null);
    const merges = xvMerges(ws);
    let bottom = Math.max(dims && dims.bottom || 0, ws.rowCount || 0), right = Math.max(dims && dims.right || 0, ws.columnCount || 0);
    merges.forEach(m=>{ bottom = Math.max(bottom, m.bottom); right = Math.max(right, m.right); });
    const images = typeof ws.getImages==='function' ? ws.getImages() : [];
    images.forEach(im=>{ const r = im.range || {}; const br = r.br || r.tl; if(br){ bottom = Math.max(bottom, Math.ceil((br.nativeRow!=null ? br.nativeRow : br.row||0)+1)); right = Math.max(right, Math.ceil((br.nativeCol!=null ? br.nativeCol : br.col||0)+1)); } });
    if(!bottom || !right) return { html:'<div class="xv-empty">Trang tính này không có dữ liệu.</div>', truncated:false };
    const truncated = bottom > XV_MAX_ROWS || right > XV_MAX_COLS;
    bottom = Math.min(bottom, XV_MAX_ROWS); right = Math.min(right, XV_MAX_COLS);
    const view = (ws.views && ws.views[0]) || {};
    const grid = view.showGridLines !== false;
    const defW = (ws.properties && ws.properties.defaultColWidth) || 8.43;
    const defH = (ws.properties && ws.properties.defaultRowHeight) || 15;
    const colPx = [], colHidden = [];
    for(let c=1; c<=right; c++){
      const col = ws.getColumn(c);
      colHidden[c] = !!col.hidden;
      colPx[c] = Math.round((col.width || defW) * 7 + 5);
    }
    const rowPx = [], rowHidden = [];
    for(let r=1; r<=bottom; r++){
      const row = ws.getRow(r);
      rowHidden[r] = !!row.hidden;
      rowPx[r] = Math.round((row.height || defH) * 4 / 3);
    }
    // Ô gộp: ô đầu nhận colspan/rowspan (chỉ đếm dòng/cột đang hiện), các ô còn lại bị bỏ qua.
    const covered = new Set(), master = new Map();
    merges.forEach(m=>{
      let cs = 0, rs = 0;
      for(let c=m.left; c<=Math.min(m.right,right); c++) if(!colHidden[c]) cs++;
      for(let r=m.top; r<=Math.min(m.bottom,bottom); r++) if(!rowHidden[r]) rs++;
      master.set(m.top+':'+m.left, { cs:Math.max(1,cs), rs:Math.max(1,rs) });
      for(let r=m.top; r<=m.bottom; r++) for(let c=m.left; c<=m.right; c++) if(r!==m.top || c!==m.left) covered.add(r+':'+c);
    });
    let width = 0;
    const cols = [];
    for(let c=1; c<=right; c++) if(!colHidden[c]){ cols.push(`<col style="width:${colPx[c]}px">`); width += colPx[c]; }
    const body = [];
    for(let r=1; r<=bottom; r++){
      if(rowHidden[r]) continue;
      const row = ws.getRow(r), tds = [];
      for(let c=1; c<=right; c++){
        if(colHidden[c] || covered.has(r+':'+c)) continue;
        const cell = row.getCell(c);
        const content = xvCellContent(cell, theme, date1904);
        const span = master.get(r+':'+c);
        tds.push(`<td${span && span.cs>1 ? ` colspan="${span.cs}"` : ''}${span && span.rs>1 ? ` rowspan="${span.rs}"` : ''} style='${xvCellCss(cell, content.kind, theme, grid)}'>${content.html}</td>`);
      }
      body.push(`<tr style="height:${rowPx[r]}px">${tds.join('')}</tr>`);
    }
    // Ảnh chèn trong trang tính: đặt tuyệt đối theo ô neo (đơn vị EMU: 9525 = 1px).
    const leftOf = c=>{ let x = 0; for(let i=1; i<=c && i<=right; i++) if(!colHidden[i]) x += colPx[i]; return x; };
    const topOf = r=>{ let y = 0; for(let i=1; i<=r && i<=bottom; i++) if(!rowHidden[i]) y += rowPx[i]; return y; };
    let imgRight = 0;
    const imgs = images.map(im=>{
      try{
        const media = wb.getImage(im.imageId); if(!media) return '';
        const tl = im.range && im.range.tl; if(!tl) return '';
        const tc = tl.nativeCol!=null ? tl.nativeCol : Math.floor(tl.col||0), tr = tl.nativeRow!=null ? tl.nativeRow : Math.floor(tl.row||0);
        const x = leftOf(tc) + (tl.nativeColOff||0)/9525, y = topOf(tr) + (tl.nativeRowOff||0)/9525;
        let w = 0, h = 0;
        if(im.range.ext && im.range.ext.width){ w = im.range.ext.width; h = im.range.ext.height; }
        else if(im.range.br){ const br = im.range.br; const bc = br.nativeCol!=null ? br.nativeCol : Math.floor(br.col||0), brr = br.nativeRow!=null ? br.nativeRow : Math.floor(br.row||0);
          w = leftOf(bc) + (br.nativeColOff||0)/9525 - x; h = topOf(brr) + (br.nativeRowOff||0)/9525 - y; }
        if(!(w>0 && h>0)) return '';
        const ext = String(media.extension||'png').toLowerCase().replace('jpg','jpeg');
        const b64 = media.base64 ? String(media.base64).replace(/^data:[^,]*,/,'') : (media.buffer ? xvToBase64(media.buffer) : '');
        if(!b64 || !/^(png|jpeg|gif|bmp|webp)$/.test(ext)) return '';
        imgRight = Math.max(imgRight, Math.ceil(x + w));
        return `<img class="xv-img" alt="" src="data:image/${ext};base64,${b64}" style="left:${Math.round(x)}px; top:${Math.round(y)}px; width:${Math.round(w)}px; height:${Math.round(h)}px;">`;
      }catch(e){ return ''; }
    }).join('');
    // Khung trang tính rộng đủ chứa cả ảnh nhô ra ngoài cột cuối, để "Vừa màn hình" tính đúng.
    return { html:`<div class="xv-sheet" style="width:${Math.max(width, imgRight)}px"><table class="xv-table" style="width:${width}px"><colgroup>${cols.join('')}</colgroup><tbody>${body.join('')}</tbody></table>${imgs}</div>`, truncated };
  }
  function xvToBase64(buf){
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf.buffer || buf);
    let s = ''; for(let i=0; i<bytes.length; i+=0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000));
    return btoa(s);
  }
  // Bảng rộng hơn khung (điện thoại): mặc định thu nhỏ cả bảng cho vừa chiều ngang (vẫn phóng to bằng hai ngón
  // được); nút "Cỡ thật" trả về cỡ gốc để vuốt ngang. Bảng vừa khung sẵn thì không hiện nút.
  function xvFit(host){
    const sheet = host.querySelector('.xv-sheet'), box = host.querySelector('.xv-scroll'), btn = host.querySelector('[data-xv-fit]');
    if(!sheet || !box || !btn) return;
    sheet.style.zoom = '';
    const need = sheet.offsetWidth, have = box.clientWidth - 16;
    if(!need || !have || need <= have){ btn.style.display = 'none'; return; }
    const fit = host.dataset.xvFit !== '0';
    btn.style.display = '';
    btn.textContent = fit ? '🔍 Cỡ thật' : '↔ Vừa màn hình';
    if(fit) sheet.style.zoom = String(Math.max(0.3, have/need));
  }
  async function driveRenderXlsxStyled(el, buffer){
    try{
      await loadOptionalLibrary('xlsx');
      await loadOptionalLibrary('exceljs');
      const wb = new window.ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const sheets = wb.worksheets.filter(ws=> ws && ws.state!=='hidden' && ws.state!=='veryHidden');
      if(!sheets.length) return false;
      const theme = xvThemePalette(wb);
      const active = Math.min(Math.max(0, (wb.views && wb.views[0] && wb.views[0].activeTab) || 0), wb.worksheets.length-1);
      let idx = Math.max(0, sheets.indexOf(wb.worksheets[active]));
      const host = document.createElement('div');
      host.className = 'xv';
      const paint = ()=>{
        const out = xvSheetHtml(wb, sheets[idx], theme);
        host.innerHTML = `<div class="xv-bar">${sheets.length>1 ? `<div class="xv-tabs" role="tablist">${sheets.map((s,i)=>`<button type="button" class="xv-tab preview-allow ${i===idx?'active':''}" data-xv-tab="${i}">${escapeHtml(s.name||('Trang '+(i+1)))}</button>`).join('')}</div>` : '<div class="xv-tabs"></div>'}
            <button type="button" class="xv-fit preview-allow" data-xv-fit style="display:none;"></button></div>
          ${out.truncated ? `<div class="xv-note">Trang tính lớn — chỉ hiện ${XV_MAX_ROWS} dòng và ${XV_MAX_COLS} cột đầu. Tải tệp về để xem đầy đủ.</div>` : ''}
          <div class="xv-scroll">${out.html}</div>`;
        host.querySelectorAll('[data-xv-tab]').forEach(b=> b.onclick = ()=>{ idx = +b.dataset.xvTab; paint(); });
        host.querySelector('[data-xv-fit]').onclick = ()=>{ host.dataset.xvFit = host.dataset.xvFit==='0' ? '1' : '0'; xvFit(host); };
        xvFit(host);
      };
      paint();
      el.innerHTML = '';
      el.appendChild(host);
      xvFit(host);
      if(!window.__xvResize){
        window.__xvResize = true;
        window.addEventListener('resize', ()=> document.querySelectorAll('.xv').forEach(xvFit));
      }
      return true;
    }catch(e){
      console.warn('[Xem Excel] ExcelJS không đọc được tệp, chuyển sang bảng đơn giản:', e);
      return false;
    }
  }
