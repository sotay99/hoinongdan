  // =====================================================================
  // [Trung tâm dữ liệu] — lớp điều hướng metadata của app (tên nội bộ: drive*).
  // Firebase là nơi lưu metadata canonical; Google Drive chỉ được dùng làm
  // liên kết/import/export ở các bước tích hợp sau.
  // =====================================================================
  let driveListenerRef = null;
  let driveListenerPath = '';
  let driveLegacyTreePromise = null;
  let driveLegacyTreePath = '';
  let driveRouteRequest = 0;
  const DRIVE_LOCAL_STORAGE_KEY = 'hnd_drive_resources_local_v1';
  const DRIVE_LOCAL_FILE_LIMIT = 8 * 1024 * 1024;
  const DRIVE_PERMISSIONS = Object.freeze({
    viewer:{label:'Viewer — chỉ xem'},
    commenter:{label:'Commenter — xem và bình luận'},
    editor:{label:'Editor — được chỉnh sửa'},
  });
  function drivePersonalAccessAllowed(){
    return hasAuthenticatedIdentity() || state.accessMode===ACCESS_MODES.SIGNED_OUT;
  }
  // Bộ cá nhân của người chưa đăng nhập Google nằm ở localStorage của chính trình duyệt.
  // Tách riêng khỏi driveIsLocalPersonal() vì Ghi chú nhanh LUÔN lưu vào Bộ cá nhân, bất kể
  // giao diện Trung tâm dữ liệu đang mở bộ nào.
  function drivePersonalIsLocal(){
    return !hasAuthenticatedIdentity() && state.accessMode===ACCESS_MODES.SIGNED_OUT && !isTourMode();
  }
  function driveIsLocalPersonal(){
    return state.driveSpace==='personal' && drivePersonalIsLocal();
  }
  // Con trỏ tới Bộ cá nhân trên Firebase, không phụ thuộc state.driveSpace.
  function drivePersonalRef(){
    const key = driveUserKey();
    return key ? rtdb.ref(`users/${key}/drive_resources`) : null;
  }
  function driveLocalTree(){
    try{
      const value = JSON.parse(localStorage.getItem(DRIVE_LOCAL_STORAGE_KEY)||'{}');
      return value && typeof value==='object' ? value : {};
    }catch(e){ return {}; }
  }
  function driveSaveLocalTree(tree){
    try{ localStorage.setItem(DRIVE_LOCAL_STORAGE_KEY, JSON.stringify(tree||{})); return true; }
    catch(e){ console.warn('Không thể lưu kho dữ liệu local:', e); return false; }
  }
  function driveHasLocalResources(){
    return Object.values(driveLocalTree()).some(node=>node && node.id);
  }
  function driveFormatBytes(value){
    const bytes=Number(value)||0;
    if(bytes<1024) return `${bytes} B`;
    if(bytes<1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024/1024).toFixed(1)} MB`;
  }
  function driveNodeDescription(node){
    if(node.description) return node.description;
    if(node.type==='folder') return 'Thư mục';
    if(node.type==='link') return 'Liên kết tài liệu';
    return `${node.mimeType||'Tệp'} · ${driveFormatBytes(node.size)}`;
  }
  function driveNodeIcon(node){
    if(node.type==='folder') return '📁';
    if(node.type==='link') return '🔗';
    const mime = String(node.mimeType||'').toLowerCase();
    if(mime.startsWith('image/')) return '🖼️';
    if(mime==='application/pdf') return '📕';
    if(mime.includes('spreadsheet') || /\.xlsx?$/i.test(node.name||'')) return '📊';
    if(mime.includes('presentation') || /\.pptx?$/i.test(node.name||'')) return '📽️';
    if(mime.includes('word') || /\.docx?$/i.test(node.name||'')) return '📄';
    if(mime.startsWith('text/') || /\.(csv|json|md|txt)$/i.test(node.name||'')) return '📝';
    return '📎';
  }
  function driveFileKind(node){
    const mime = String(node.mimeType||'').toLowerCase();
    const name = String(node.name||'').toLowerCase();
    if(mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)) return 'image';
    if(mime==='application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
    if(mime.startsWith('text/') || /^(csv|json|markdown)$/.test(mime) || /\.(txt|csv|json|md|log)$/i.test(name)) return 'text';
    if(mime.includes('spreadsheet') || /\.(xlsx|xls)$/i.test(name)) return 'xlsx';
    if(mime.includes('word') || /\.(docx|doc)$/i.test(name)) return 'docx';
    if(mime.includes('presentation') || /\.(pptx|ppt)$/i.test(name)) return 'pptx';
    return 'other';
  }
  function driveFileSource(node){
    if(!node) return '';
    if(node.localDataUrl || node.storageUrl || node.url) return node.localDataUrl || node.storageUrl || node.url;
    return node.content!=null ? `data:text/plain;charset=utf-8,${encodeURIComponent(String(node.content))}` : '';
  }
  function driveOpenOfficeApp(appName){
    const labels={Docs:'Google Docs',Sheets:'Google Sheets',Slides:'Google Slides'};
    const label=labels[appName]||appName;
    const wrap=document.createElement('div');
    wrap.className='modal-bg drive-office-placeholder-bg';
    wrap.innerHTML=`
      <div class="modal drive-office-placeholder" role="dialog" aria-modal="true" aria-labelledby="drive-office-placeholder-title">
        <div class="modal-head"><h3 id="drive-office-placeholder-title">🛠️ ${escapeHtml(label)}</h3><button class="modal-close" id="drive-office-placeholder-close" aria-label="Đóng">✕</button></div>
        <div class="modal-body">
          <div class="drive-office-placeholder-icon">${appName==='Docs'?'📄':appName==='Sheets'?'📊':'📽️'}</div>
          <h4>Màn hình ${escapeHtml(label)} đang được thiết kế</h4>
          <p class="sub">Tính năng tạo và chỉnh sửa ${escapeHtml(label)} sẽ được phát triển trong giai đoạn sau. Trong MVP này, Trung tâm dữ liệu chỉ chuẩn bị sẵn vị trí và luồng điều hướng.</p>
          <div class="drive-office-placeholder-note">Chưa kết nối Google Drive và chưa mở trình chỉnh sửa văn phòng bên ngoài.</div>
        </div>
        <div class="modal-foot"><button class="btn btn-primary" id="drive-office-placeholder-ok">Đã hiểu</button></div>
      </div>`;
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    wrap.querySelector('#drive-office-placeholder-close').onclick=close;
    wrap.querySelector('#drive-office-placeholder-ok').onclick=close;
  }
  // =====================================================================
  // BỘ CÔNG CỤ VĂN PHÒNG — Tài liệu / Trang tính / Trình bày
  // Ba module này hiển thị TOÀN MÀN HÌNH (overlay riêng, che cả khung menu trái) giống
  // module Tạo bài Tuyên truyền, vì sau này chúng là trình soạn thảo thực thụ cần trọn
  // không gian làm việc. Hiện tại mới có trang giới thiệu.
  // =====================================================================
  const OFFICE_APPS = {
    Docs: {
      icon:'📄', label:'Tài liệu', eyebrow:'SOẠN THẢO VĂN BẢN',
      tagline:'Một trình soạn thảo văn bản đầy đủ ngay trong Sổ tay — làm được mọi việc như Word, cộng thêm một trợ lý AI ngồi cạnh đồng chí suốt quá trình soạn thảo.',
      blocks:[
        ['✍️','Soạn thảo đầy đủ như phần mềm Word thật',
         'Định dạng chữ, căn lề, giãn dòng, đánh số trang, chèn bảng biểu, chèn ảnh, tạo mục lục tự động, đánh số đề mục nhiều cấp, chèn chú thích chân trang, header và footer. Hỗ trợ đúng thể thức văn bản hành chính Việt Nam: quốc hiệu tiêu ngữ, số ký hiệu, nơi nhận, chữ ký và dấu.'],
        ['🤖','Trợ lý AI ngồi ngay trong trang soạn thảo',
         'Bôi đen một đoạn rồi bảo AI viết lại cho gọn, đổi giọng văn cho trang trọng hơn, tóm tắt thành vài gạch đầu dòng, hay mở rộng một ý thành đoạn hoàn chỉnh. Đồng chí cũng có thể mô tả bằng lời — "soạn giúp tôi báo cáo tổng kết công tác Hội quý III" — và AI dựng sẵn khung văn bản đúng thể thức để đồng chí chỉnh sửa tiếp.'],
        ['🗂️','Lấy dữ liệu thẳng từ Trung tâm dữ liệu',
         'AI đọc được các tệp đồng chí đã lưu trong Trung tâm dữ liệu, nên khi soạn báo cáo nó có thể trích số liệu từ chính tài liệu của xã/phường mình thay vì bịa ra. Văn bản soạn xong cũng lưu ngược lại vào đúng thư mục đồng chí chọn.'],
        ['📋','Kho mẫu văn bản dùng sẵn',
         'Nghị quyết, kế hoạch, báo cáo tháng/quý/năm, tờ trình, giấy mời họp, biên bản, thông báo, quyết định... chọn mẫu là có ngay khung sườn, chỉ việc điền nội dung của địa phương mình.'],
        ['👥','Nhiều người cùng làm trên một văn bản',
         'Chia sẻ cho đồng nghiệp theo quyền Xem, Góp ý hoặc Sửa; ai sửa gì đều có dấu vết. Góp ý được ghi ngay bên lề đoạn văn liên quan, không phải gửi qua lại nhiều bản.'],
        ['📤','Xuất ra định dạng quen thuộc',
         'Tải về dưới dạng .docx hoặc PDF để in, ký và đóng dấu, hoặc gửi đi qua hệ thống văn bản của cấp trên.'],
      ],
    },
    Sheets: {
      icon:'📊', label:'Trang tính', eyebrow:'BẢNG TÍNH VÀ SỐ LIỆU',
      tagline:'Bảng tính làm được mọi việc như Excel, nhưng đồng chí có thể ra lệnh bằng tiếng Việt thay vì phải nhớ công thức.',
      blocks:[
        ['🧮','Bảng tính đầy đủ như Excel',
         'Công thức, hàm tính toán, định dạng theo điều kiện, lọc và sắp xếp, gộp ô, cố định dòng tiêu đề, nhiều trang tính trong một tệp, bảng tổng hợp. Nhập được tệp .xlsx sẵn có và xuất ra đúng định dạng đó.'],
        ['🗣️','Ra lệnh bằng tiếng Việt, AI viết công thức thay đồng chí',
         'Không cần nhớ cú pháp hàm. Chỉ cần gõ "tính tổng số hội viên từng ấp rồi sắp xếp giảm dần" hoặc "tô đỏ những dòng quá hạn đóng lãi" — AI hiểu và làm ngay trên bảng của đồng chí, đồng thời giải thích nó vừa làm gì để đồng chí kiểm tra lại.'],
        ['🧹','AI dọn dữ liệu lộn xộn',
         'Danh sách gõ tay thường sai chính tả tên, lệch định dạng ngày tháng, trùng lặp dòng, họ tên viết hoa không đồng nhất. AI rà soát, chỉ ra chỗ nghi ngờ và đề xuất cách sửa hàng loạt — việc trước đây phải ngồi sửa tay cả buổi.'],
        ['📈','Dựng biểu đồ và bảng tổng hợp trong một câu',
         'Mô tả điều đồng chí muốn thấy, AI chọn giúp loại biểu đồ phù hợp và dựng luôn. Thích hợp cho báo cáo thực lực Hội, tiến độ thu lãi, cơ cấu hội viên theo độ tuổi hay ngành nghề.'],
        ['🔗','Nối với số liệu sẵn có trong app',
         'Kéo thẳng số liệu từ Sổ vay vốn, Sổ Thu Chi Lãi Quỹ hay Hồ sơ hội viên sang bảng tính để tự tổng hợp, khỏi phải chép tay và khỏi sai sót.'],
        ['📤','Xuất và chia sẻ',
         'Tải về .xlsx hoặc PDF, hoặc chia sẻ cho đồng nghiệp cùng làm với phân quyền rõ ràng.'],
      ],
    },
    Slides: {
      icon:'📽️', label:'Trình bày', eyebrow:'BÀI TRÌNH CHIẾU',
      tagline:'Dựng bài trình chiếu như PowerPoint, và để AI biến một bản báo cáo dài thành bộ slide gọn gàng chỉ trong ít phút.',
      blocks:[
        ['🎬','Đầy đủ như PowerPoint',
         'Bố cục slide, chèn ảnh và biểu đồ, hiệu ứng chuyển slide, ghi chú cho người trình bày, chế độ trình chiếu toàn màn hình, đánh số slide. Mở được tệp .pptx sẵn có và xuất ra đúng định dạng đó.'],
        ['⚡','Từ báo cáo dài thành bộ slide trong ít phút',
         'Đưa cho AI một bản báo cáo Word hoặc một tệp trong Trung tâm dữ liệu, nói rõ trình bày trong bao nhiêu phút và cho ai nghe — AI rút ra các ý chính, chia thành từng slide hợp lý, viết tiêu đề gãy gọn và soạn sẵn cả lời dẫn cho người trình bày.'],
        ['🎨','Giao diện thống nhất, đúng phong cách của Hội',
         'Bộ màu và kiểu chữ đồng bộ cho cả bài, không còn cảnh mỗi slide một kiểu. Có sẵn các mẫu phù hợp với hội nghị, sơ kết, tổng kết, tập huấn và tuyên truyền.'],
        ['🗣️','Luyện trước khi lên trình bày',
         'AI ước lượng thời lượng từng slide, cảnh báo chỗ quá nhiều chữ, và gợi ý những câu hỏi mà người nghe nhiều khả năng sẽ hỏi để đồng chí chuẩn bị trước.'],
        ['🗂️','Nối với Trung tâm dữ liệu',
         'Lấy ảnh, biểu đồ và số liệu thẳng từ kho tài liệu của xã/phường; bài trình chiếu làm xong lưu lại đúng thư mục đồng chí chọn.'],
        ['📤','Trình chiếu và chia sẻ',
         'Chiếu trực tiếp trong app, tải về .pptx hoặc PDF, hoặc gửi liên kết cho người khác xem trước.'],
      ],
    },
  };

  function openOfficeModule(appName){
    if(!OFFICE_APPS[appName]) return;
    if(typeof closeAiChat==='function') closeAiChat();
    if(typeof closeQuickNote==='function') closeQuickNote();
    state._officeAppOpen = appName;
    renderOfficeOverlay();
    requestAnimationFrame(()=>{
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
  }
  function closeOfficeModule(){
    state._officeAppOpen = null;
    const overlay = document.getElementById('office-overlay');
    if(overlay) overlay.remove();
    // Thoát module ra thì LUÔN hiện lại khung menu chính, giống module Tuyên truyền.
    state.sidebarCollapsed = false;
    applySidebarCollapsedVisual(false);
  }
  function renderOfficeOverlay(){
    const appName = state._officeAppOpen;
    const cfg = OFFICE_APPS[appName];
    if(!cfg) return;
    let overlay = document.getElementById('office-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'office-overlay';
      overlay.className = 'ai-overlay office-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="office-doc">
        <div class="office-doc-head">
          <div>
            <div class="eyebrow">${escapeHtml(cfg.eyebrow)}</div>
            <h2>${cfg.icon} ${escapeHtml(cfg.label)}</h2>
          </div>
          <button class="btn btn-ghost btn-sm" id="office-exit">✕ Thoát</button>
        </div>
        <div class="office-doc-body">
          <div class="office-badge">🚧 Đang xây dựng — sẽ sớm ra mắt</div>
          <p class="office-lead">${escapeHtml(cfg.tagline)}</p>
          <div class="office-grid">
            ${cfg.blocks.map(([ico,h,p])=>`
              <div class="office-feature">
                <div class="office-feature-ico">${ico}</div>
                <div>
                  <h4>${escapeHtml(h)}</h4>
                  <p>${escapeHtml(p)}</p>
                </div>
              </div>`).join('')}
          </div>
          <div class="office-foot-note">
            <b>Vì sao gắn liền với Trung tâm dữ liệu?</b>
            <span>Mọi tệp đồng chí tạo ra ở đây đều nằm trong Trung tâm dữ liệu — cùng một kho, cùng một cách phân quyền, cùng một chỗ tìm kiếm. Không còn cảnh mỗi tài liệu một nơi, cũng không phải nhớ mình đã lưu ở đâu.</span>
          </div>
          <div class="office-doc-actions">
            <button class="btn btn-primary" id="office-goto-drive">🗂️ Mở Trung tâm dữ liệu</button>
            <button class="btn btn-ghost" id="office-back">← Quay lại</button>
          </div>
        </div>
      </div>`;
    const exitBtn = document.getElementById('office-exit');
    if(exitBtn) exitBtn.onclick = closeOfficeModule;
    const backBtn = document.getElementById('office-back');
    if(backBtn) backBtn.onclick = closeOfficeModule;
    const driveBtn = document.getElementById('office-goto-drive');
    if(driveBtn) driveBtn.onclick = ()=>{ closeOfficeModule(); switchTab('drive'); };
  }
  function driveDecodeDataUrl(dataUrl){
    const comma = String(dataUrl||'').indexOf(',');
    if(comma<0) return '';
    const meta = String(dataUrl).slice(0,comma);
    const body = String(dataUrl).slice(comma+1);
    try{
      if(/;base64/i.test(meta)){
        const binary = atob(body);
        const bytes = new Uint8Array(binary.length);
        for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
      }
      return decodeURIComponent(body);
    }catch(e){ return ''; }
  }
  function driveDataUrlToArrayBuffer(dataUrl){
    const comma = String(dataUrl||'').indexOf(',');
    if(comma<0) throw new Error('Tệp local không hợp lệ');
    const meta = String(dataUrl).slice(0,comma);
    const body = String(dataUrl).slice(comma+1);
    if(!/;base64/i.test(meta)) return new TextEncoder().encode(decodeURIComponent(body)).buffer;
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return bytes.buffer;
  }
  function driveReadFileAsDataUrl(file){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = ()=>resolve(String(reader.result||''));
      reader.onerror = ()=>reject(reader.error||new Error('Không đọc được tệp'));
      reader.readAsDataURL(file);
    });
  }
  function driveSafeFileName(name){ return String(name||'file').replace(/[^\w.\-() ]+/g,'_').slice(0,120); }
  function driveDownloadButton(el, node, source){
    el.innerHTML = `<div class="drive-viewer-fallback"><div class="drive-viewer-icon">${driveNodeIcon(node)}</div><h4>${escapeHtml(node.name||'Tệp')}</h4><p>Trình duyệt hiện chưa đọc được định dạng này trong chế độ xem trước.</p><a class="btn btn-primary" id="drive-file-download" download="${escapeHtml(node.name||'tai-lieu')}">⬇️ Tải tệp xuống</a></div>`;
    const link = el.querySelector('#drive-file-download');
    if(link) link.href = source;
  }
  async function drivePopulateFileViewer(el, node){
    const source = driveFileSource(node);
    const kind = driveFileKind(node);
    if(!source){ driveDownloadButton(el,node,'#'); return; }
    if(kind==='image'){
      el.innerHTML = `<div class="drive-viewer-image-wrap"><img id="drive-file-image" alt="${escapeHtml(node.name||'Ảnh tài liệu')}"></div>`;
      const img=el.querySelector('#drive-file-image'); if(img) img.src=source;
      return;
    }
    if(kind==='pdf'){
      el.innerHTML = `<iframe id="drive-file-pdf" class="drive-viewer-pdf" title="${escapeHtml(node.name||'Tài liệu PDF')}"></iframe>`;
      const frame=el.querySelector('#drive-file-pdf'); if(frame) frame.src=source;
      return;
    }
    if(kind==='text'){
      try{
        const response = node.localDataUrl ? null : await fetch(source);
        if(response && !response.ok) throw new Error(`HTTP ${response.status}`);
        const text = node.content!=null ? String(node.content) : (node.localDataUrl ? driveDecodeDataUrl(node.localDataUrl) : await response.text());
        el.innerHTML = `<pre class="drive-viewer-text">${escapeHtml(text.slice(0,250000))}</pre>`;
      }catch(e){ driveDownloadButton(el,node,source); }
      return;
    }
    try{
      const response = node.localDataUrl ? null : await fetch(source);
      if(response && !response.ok) throw new Error(`HTTP ${response.status}`);
      let buffer = node.localDataUrl ? driveDataUrlToArrayBuffer(node.localDataUrl) : await response.arrayBuffer();
      if(kind==='xlsx'){
        await loadOptionalLibrary('xlsx');
        const workbook = XLSX.read(buffer,{type:'array'});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        el.innerHTML = `<div class="drive-viewer-table">${sheet ? XLSX.utils.sheet_to_html(sheet,{editable:false}) : '<p>Không có sheet để xem.</p>'}</div>`;
        return;
      }
      if(kind==='docx'){
        await loadOptionalLibrary('mammoth');
        const result = await mammoth.convertToHtml({arrayBuffer:buffer});
        el.innerHTML = `<article class="drive-viewer-docx">${result.value||'<p>Không có nội dung để xem.</p>'}</article>`;
        return;
      }
      if(kind==='pptx'){
        await loadOptionalLibrary('jszip');
        const zip=await JSZip.loadAsync(buffer);
        const slideFiles=Object.keys(zip.files)
          .filter(name=>/^ppt\/slides\/slide\d+\.xml$/i.test(name))
          .sort((a,b)=>parseInt(a.match(/slide(\d+)/i)[1],10)-parseInt(b.match(/slide(\d+)/i)[1],10));
        if(!slideFiles.length) throw new Error('Không tìm thấy nội dung slide');
        const slides=[];
        for(let i=0;i<slideFiles.length;i++){
          const xmlText=await zip.files[slideFiles[i]].async('text');
          const xml=new DOMParser().parseFromString(xmlText,'application/xml');
          const textNodes=Array.from(xml.getElementsByTagNameNS('*','t'));
          const text=textNodes.map(node=>node.textContent||'').join(' ').replace(/\s+/g,' ').trim();
          slides.push(`<article class="drive-viewer-slide"><div class="drive-viewer-slide-number">Slide ${i+1}</div><div>${escapeHtml(text||'Slide này không có phần văn bản để hiển thị.')}</div></article>`);
        }
        el.innerHTML=`<div class="drive-viewer-slides"><div class="drive-viewer-slide-note">Bản xem trước PowerPoint dạng đọc-only — hiển thị văn bản trong từng slide.</div>${slides.join('')}</div>`;
        return;
      }
    }catch(e){
      console.warn('Không thể tạo preview tệp:', e);
    }
    driveDownloadButton(el,node,source);
  }

  function driveRoute(){
    const match = window.location.pathname.match(/\/(file|folder)\/([^/]+)\/?$/i);
    if(!match) return null;
    const params = new URLSearchParams(window.location.search);
    return {
      type:match[1].toLowerCase(),
      id:decodeURIComponent(match[2]),
      space:params.get('space')==='shared' ? 'shared' : 'personal',
      kind:params.get('kind')==='file' ? 'file' : (match[1].toLowerCase()==='folder' ? 'folder' : 'link'),
    };
  }
  function driveResourceUrl(node, space=state.driveSpace){
    const type = node.type==='folder' ? 'folder' : 'file';
    const kind = node.type==='file' ? 'file' : (node.type==='folder' ? 'folder' : 'link');
    return `/${type}/${encodeURIComponent(node.id)}?space=${space}&kind=${kind}`;
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
    const key = driveUserKey();
    return key ? rtdb.ref(`users/${key}/drive_resources`) : null;
  }
  function driveUserKey(){
    return state.identity && (state.identity.uid || accountStorageKey()) ? String(state.identity.uid || accountStorageKey()) : null;
  }
  function driveLegacyRef(){
    const emailKey=state.identity&&state.identity.email ? emailToKey(state.identity.email) : null;
    const current=driveUserKey();
    return emailKey && current && emailKey!==current ? rtdb.ref(`users/${emailKey}/drive_resources`) : null;
  }
  function driveLegacyTree(){
    const legacyRef=driveLegacyRef();
    if(!legacyRef) return Promise.resolve({});
    const path=legacyRef.toString();
    if(!driveLegacyTreePromise || driveLegacyTreePath!==path){
      driveLegacyTreePath=path;
      driveLegacyTreePromise=legacyRef.once('value').then(snap=>snap&&snap.exists() ? (snap.val()||{}) : {}).catch(()=>({}));
    }
    return driveLegacyTreePromise;
  }
  async function driveTreeForUser(ref, space=state.driveSpace){
    const snap=await ref.get();
    const canonical=snap&&snap.exists() ? (snap.val()||{}) : {};
    const legacy=space==='personal' ? await driveLegacyTree() : {};
    return {...legacy,...canonical};
  }
  function driveCanEdit(node=null){
    if(isTourMode()) return false;
    if(state.driveSpace==='shared') return drivePermissionForNode(node)==='editor';
    return drivePersonalAccessAllowed();
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
    if(space==='personal') return drivePersonalAccessAllowed() ? 'editor' : 'none';
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
    if(!driveCanComment(node)){ alert('Đồng chí không có quyền bình luận tài nguyên này.'); return false; }
    const value=(text||'').trim();
    if(!value){ alert('Vui lòng nhập nội dung bình luận.'); return false; }
    const ref=driveCommentRef(resourceId);
    if(!ref) return false;
    const id=driveCommentId();
    try{
      await ref.child(id).set({
        id, text:value,
        authorEmail:(state.identity&&state.identity.email)||'',
        authorName:(state.identity&&state.identity.name)||'Người dùng',
        createdAt:new Date().toISOString(),
        deleted:false,
      });
      return true;
    }catch(error){
      console.error('Ghi bình luận lỗi:',error);
      alert('Không thể gửi bình luận. Vui lòng kiểm tra kết nối rồi thử lại.');
      return false;
    }
  }
  function driveCanDeleteComment(comment){
    if(isTourMode() || !comment) return false;
    const email=state.identity&&state.identity.email;
    return isOwner() || (!!email && String(comment.authorEmail||'').toLowerCase()===String(email).toLowerCase());
  }
  async function driveDeleteComment(resourceId,commentId){
    const node=state.driveResources[resourceId];
    const comment=node && node.comments && node.comments[commentId];
    if(!driveCanDeleteComment(comment)){ alert('Đồng chí chỉ có thể xoá bình luận của mình.'); return false; }
    const ref=driveCommentRef(resourceId);
    if(!ref) return false;
    try{
      await ref.child(commentId).update({deleted:true,deletedAt:new Date().toISOString()});
      return true;
    }catch(error){
      console.error('Xoá bình luận lỗi:',error);
      alert('Không thể xoá bình luận. Vui lòng kiểm tra kết nối rồi thử lại.');
      return false;
    }
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
      state.driveLoading=false;
      state.driveLoadError='';
      return;
    }
    if(driveIsLocalPersonal()){
      driveDetach();
      state.driveResources = driveLocalTree();
      state.driveLoading=false;
      state.driveLoadError='';
      return;
    }
    if(state.driveSpace==='personal' && !drivePersonalAccessAllowed()){
      driveDetach();
      state.driveResources = {};
      state.driveLoading=false;
      state.driveLoadError='';
      return;
    }
    const ref = driveRef();
    if(!ref){
      driveDetach();
      state.driveResources = {};
      state.driveLoading=false;
      state.driveLoadError='';
      return;
    }
    const path = ref.toString();
    if(driveListenerRef && driveListenerPath===path) return;
    driveDetach();
    state.driveLoading=true;
    state.driveLoadError='';
    driveLegacyTreePromise=null;
    driveLegacyTreePath='';
    driveListenerRef = ref;
    driveListenerPath = path;
    ref.on('value', snap=>{
      driveTreeForUser(ref,state.driveSpace).then(tree=>{
        if(driveListenerRef!==ref) return;
        state.driveResources = tree;
        state.driveLoading=false;
        state.driveLoadError='';
        if(state.activeTab==='drive') renderDriveHubTab(document.getElementById('content'));
      }).catch(error=>{
        if(driveListenerRef!==ref) return;
        state.driveLoading=false;
        state.driveLoadError='Không thể tải kho dữ liệu. Vui lòng kiểm tra kết nối rồi thử lại.';
        console.warn('Không tải được kho dữ liệu:',error);
        if(state.activeTab==='drive') renderDriveHubTab(document.getElementById('content'));
      });
    }, error=>{
      if(driveListenerRef!==ref) return;
      state.driveLoading=false;
      state.driveLoadError='Không thể kết nối tới kho dữ liệu. Vui lòng thử lại.';
      console.warn('Realtime Drive Hub lỗi:',error);
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
    const searchScope = query && parentId ? new Set(driveDescendantIds(parentId)) : null;
    const items = Object.values(state.driveResources||{})
      .filter(n=> n && (state.driveTrashOpen ? n.deleted : !n.deleted))
      .filter(n=> (n.parentId||null)===parentId || (query && (!searchScope || searchScope.has(n.id))))
      .filter(n=> !query || `${n.name||''} ${n.description||''}`.toLocaleLowerCase('vi').includes(query))
    const sort=state.driveSort||'name';
    return items.sort((a,b)=>{
      if(sort==='newest' || sort==='oldest'){
        const diff=(new Date(a.updatedAt||a.createdAt||0).getTime()||0)-(new Date(b.updatedAt||b.createdAt||0).getTime()||0);
        return sort==='newest' ? -diff : diff;
      }
      if(sort==='type' && a.type!==b.type) return a.type==='folder' ? -1 : 1;
      return (a.name||'').localeCompare(b.name||'','vi');
    });
  }
  async function driveWriteNode(id, node){
    if(blockTourMutation('Đồng chí đang ở môi trường tham quan. Tài nguyên demo không được lưu.')) return false;
    const parent = state.driveCurrentFolder ? state.driveResources[state.driveCurrentFolder] : null;
    if(!driveCanEdit(parent)){ alert('Đồng chí không có quyền tạo tài nguyên trong thư mục này.'); return false; }
    if(driveIsLocalPersonal()){
      const tree = driveLocalTree();
      tree[id] = {...node, storageScope:'local'};
      if(!driveSaveLocalTree(tree)){ alert('Không thể lưu tài nguyên trên thiết bị này. Có thể bộ nhớ trình duyệt đã đầy.'); return false; }
      state.driveResources = tree;
      return true;
    }
    const ref = driveRef();
    if(!ref) return false;
    try{
      await ref.child(id).set(node);
      return true;
    }catch(error){
      console.error('Ghi tài nguyên lên Firebase lỗi:',error);
      alert('Không thể lưu tài nguyên lên máy chủ. Dữ liệu chưa được ghi; vui lòng thử lại.');
      return false;
    }
  }
  // ---------------------------------------------------------------------
  // CẦU NỐI TỪ MODULE [GHI CHÚ NHANH]
  // Ghi chú do Ghi chú nhanh tạo ra được lưu vào ĐÂY — Trung tâm dữ liệu, Bộ cá nhân.
  // Không dùng driveWriteNode() vì hàm đó bám theo thư mục và không gian mà giao diện
  // Trung tâm dữ liệu đang mở; ghi chú thì luôn phải vào Bộ cá nhân, vào đúng thư mục
  // người dùng chọn trong modal lưu.
  // ---------------------------------------------------------------------
  async function drivePersonalTree(){
    if(drivePersonalIsLocal()) return driveLocalTree();
    const ref = drivePersonalRef();
    if(!ref) return {};
    try{
      const snap = await ref.get();
      return (snap && snap.exists()) ? (snap.val()||{}) : {};
    }catch(error){
      console.error('Không đọc được Bộ cá nhân của Trung tâm dữ liệu:', error);
      throw error;
    }
  }
  const QUICK_NOTE_FOLDER_NAME = 'Ghi chú nhanh';
  // Tìm thư mục "Ghi chú nhanh" ở gốc Bộ cá nhân; chưa có thì tạo. Trả về id thư mục.
  async function driveEnsureQuickNoteFolder(){
    const tree = await drivePersonalTree();
    const found = Object.values(tree).find(n=>
      n && n.type==='folder' && !n.deleted && !n.parentId && n.name===QUICK_NOTE_FOLDER_NAME);
    if(found) return found.id;
    const id = driveNodeId();
    const now = new Date().toISOString();
    const ok = await drivePersonalWriteNode(id, {
      id, type:'folder', name:QUICK_NOTE_FOLDER_NAME, parentId:null,
      createdAt:now, updatedAt:now, createdBy:(state.identity&&state.identity.email)||'browser',
    });
    return ok ? id : null;
  }
  async function drivePersonalWriteNode(id, node){
    if(drivePersonalIsLocal()){
      const tree = driveLocalTree();
      tree[id] = {...node, storageScope:'local'};
      if(!driveSaveLocalTree(tree)){ alert('Không thể lưu trên thiết bị này. Có thể bộ nhớ trình duyệt đã đầy.'); return false; }
      state.driveResources = tree;
      return true;
    }
    const ref = drivePersonalRef();
    if(!ref){ alert('Không xác định được Bộ cá nhân. Vui lòng đăng nhập lại.'); return false; }
    try{
      await ref.child(id).set(node);
      return true;
    }catch(error){
      console.error('Ghi ghi chú vào Trung tâm dữ liệu lỗi:', error);
      alert('Không thể lưu ghi chú lên máy chủ. Nội dung chưa được ghi; vui lòng thử lại.');
      return false;
    }
  }
  // Lưu MỘT ghi chú vào Bộ cá nhân. parentId = null nghĩa là để ở gốc.
  async function driveSaveQuickNote({ name, content, parentId=null, storagePath='', storageUrl='' }){
    if(blockTourMutation('Đồng chí đang ở môi trường tham quan, ghi chú không được lưu lại.')) return null;
    const id = driveNodeId();
    const now = new Date().toISOString();
    const ok = await drivePersonalWriteNode(id, {
      id, type:'file', fileKind:'text', mimeType:'text/plain',
      name: (name||'Ghi chú mới').slice(0,80),
      parentId: parentId || null,
      content: content || '',
      size: new Blob([content||'']).size,
      storagePath, storageUrl,
      createdAt:now, updatedAt:now, deleted:false,
      createdBy:(state.identity&&state.identity.email)||'browser',
      source:'quick-note',
    });
    return ok ? id : null;
  }

  // Modal "Lưu ghi chú vào Trung tâm dữ liệu" — hiện cây thư mục Bộ cá nhân để người dùng chọn
  // nơi lưu, kèm một nút lưu nhanh vào thư mục "Ghi chú nhanh" (tự tạo nếu chưa có).
  // Trả về Promise: { parentId } khi người dùng chốt, hoặc null khi họ huỷ.
  function renderQuickNoteSaveTargetModal(){
    return new Promise(async (resolve)=>{
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg';
      document.body.appendChild(wrap);
      let selectedId = null;   // null = lưu ở gốc
      let tree = {};
      let loadError = '';
      try{ tree = await drivePersonalTree(); }
      catch(e){ loadError = 'Không đọc được danh sách thư mục. Đồng chí vẫn có thể lưu vào gốc.'; }

      const close = (result)=>{ wrap.remove(); resolve(result); };

      function folderRowsHtml(parentId, depth){
        return Object.values(tree)
          .filter(n=> n && n.type==='folder' && !n.deleted && (n.parentId||null)===(parentId||null))
          .sort((a,b)=>(a.name||'').localeCompare(b.name||'','vi'))
          .map(n=>`
            <div class="qn-target-row ${selectedId===n.id?'selected':''}" data-qn-target="${n.id}" style="padding-left:${12+depth*18}px">
              <span>📁</span><span class="qn-target-name">${escapeHtml(n.name)}</span>
            </div>
            ${folderRowsHtml(n.id, depth+1)}`).join('');
      }

      function draw(){
        wrap.innerHTML = `
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="qn-target-title">
            <div class="modal-head">
              <h3 id="qn-target-title">💾 Lưu ghi chú vào Trung tâm dữ liệu</h3>
              <button class="modal-close" id="qn-target-close" aria-label="Đóng">✕</button>
            </div>
            <div class="modal-body">
              <p class="sub" style="margin-top:0;">Ghi chú sẽ được lưu vào <b>Bộ cá nhân</b> của Trung tâm dữ liệu.</p>
              <button class="btn btn-primary btn-block" id="qn-target-quick">⚡ Lưu nhanh vào thư mục “${escapeHtml(QUICK_NOTE_FOLDER_NAME)}”</button>
              <div class="divider-lbl">hoặc chọn thư mục</div>
              ${loadError? `<div class="qn-target-error">⚠️ ${escapeHtml(loadError)}</div>` : ''}
              <div class="qn-target-tree">
                <div class="qn-target-row ${selectedId===null?'selected':''}" data-qn-target="">
                  <span>🗂️</span><span class="qn-target-name"><b>(Thư mục gốc)</b></span>
                </div>
                ${folderRowsHtml(null, 1)}
              </div>
            </div>
            <div class="modal-foot">
              <button class="btn btn-ghost" id="qn-target-cancel">Huỷ</button>
              <button class="btn btn-primary" id="qn-target-save">Lưu vào thư mục đã chọn</button>
            </div>
          </div>`;
        wrap.querySelector('#qn-target-close').onclick = ()=> close(null);
        wrap.querySelector('#qn-target-cancel').onclick = ()=> close(null);
        wrap.querySelector('#qn-target-save').onclick = ()=> close({ parentId: selectedId });
        wrap.querySelector('#qn-target-quick').onclick = async (e)=>{
          const btn = e.currentTarget;
          btn.disabled = true; btn.textContent = '⏳ Đang chuẩn bị thư mục…';
          const folderId = await driveEnsureQuickNoteFolder();
          if(folderId===null){
            btn.disabled = false; btn.textContent = `⚡ Lưu nhanh vào thư mục “${QUICK_NOTE_FOLDER_NAME}”`;
            return; // driveEnsureQuickNoteFolder đã báo lỗi cụ thể rồi
          }
          close({ parentId: folderId });
        };
        wrap.querySelectorAll('[data-qn-target]').forEach(row=>{
          row.onclick = ()=>{ selectedId = row.dataset.qnTarget || null; draw(); };
        });
      }
      draw();
    });
  }

  async function driveUpdateNode(id, partial){
    if(blockTourMutation('Đồng chí đang ở môi trường tham quan. Tài nguyên demo không được lưu.')) return false;
    const current = state.driveResources[id];
    if(!driveCanEdit(current)){ alert('Đồng chí không có quyền chỉnh sửa tài nguyên này.'); return false; }
    if(driveIsLocalPersonal()){
      const tree = driveLocalTree();
      tree[id] = {...(tree[id]||current||{}), ...partial};
      if(!driveSaveLocalTree(tree)){ alert('Không thể cập nhật tài nguyên trên thiết bị này.'); return false; }
      state.driveResources = tree;
      return true;
    }
    const ref = driveRef();
    if(!ref) return false;
    try{
      await ref.child(id).update(partial);
      return true;
    }catch(error){
      console.error('Cập nhật tài nguyên trên Firebase lỗi:',error);
      alert('Không thể cập nhật tài nguyên trên máy chủ. Thay đổi chưa được lưu; vui lòng thử lại.');
      return false;
    }
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
  async function driveCreateFile(){
    if(!driveCanEdit(state.driveCurrentFolder ? state.driveResources[state.driveCurrentFolder] : null)) return;
    const input=document.createElement('input');
    input.type='file'; input.multiple=true; input.accept='*/*';
    input.onchange=async()=>{
      const files=Array.from(input.files||[]);
      if(!files.length) return;
      let saved=0;
      for(const file of files){
        if(driveIsLocalPersonal() && file.size>DRIVE_LOCAL_FILE_LIMIT){
          alert(`Tệp "${file.name}" vượt giới hạn ${Math.round(DRIVE_LOCAL_FILE_LIMIT/1024/1024)} MB của kho trên trình duyệt và chưa được lưu.`);
          continue;
        }
        const id=driveNodeId(), now=new Date().toISOString();
        const node={id,type:'file',name:file.name,parentId:state.driveCurrentFolder||null,mimeType:file.type||'application/octet-stream',size:file.size,createdAt:now,updatedAt:now,createdBy:(state.identity&&state.identity.email)||'browser'};
        try{
          if(driveIsLocalPersonal()){
            node.localDataUrl=await driveReadFileAsDataUrl(file);
            if(await driveWriteNode(id,node)) saved++;
          }else{
            const scope=state.driveSpace==='shared' ? `ward_${wardId()}` : `user_${accountStorageKey()||'account'}`;
            const storagePath=`drive-resources/${scope}/${id}-${driveSafeFileName(file.name)}`;
            const upload=storage.ref(storagePath);
            await upload.put(file);
            node.storagePath=storagePath;
            node.storageUrl=await upload.getDownloadURL();
            if(await driveWriteNode(id,node)) saved++;
          }
        }catch(e){
          console.error('Lưu tệp vào kho dữ liệu lỗi:',e);
          alert(`Không thể lưu "${file.name}". Tệp vẫn còn nguyên trên thiết bị của đồng chí.\n\n${e&&e.message?e.message:'Lỗi không xác định'}`);
        }
      }
      driveAttach(); renderDriveHubTab(document.getElementById('content'));
      if(saved) showToast(`Đã thêm ${saved} tệp vào kho dữ liệu.`);
    };
    input.click();
  }
  async function driveMigrateLocal(){
    if(!hasAuthenticatedIdentity() || state.driveSpace!=='personal') return;
    const local=driveLocalTree();
    const nodes=Object.values(local).filter(node=>node && node.id);
    if(!nodes.length){ alert('Không có tài nguyên local nào cần chuyển.'); return; }
    if(!confirm(`Chuyển ${nodes.length} tài nguyên từ trình duyệt lên kho cá nhân Firebase?\n\nDữ liệu cloud hiện có sẽ được giữ nguyên. Sau khi chuyển thành công, bản local trên thiết bị này sẽ được xoá.`)) return;
    const ref=driveRef();
    if(!ref){ alert('Chưa xác định được kho Firebase của tài khoản.'); return; }
    const updates={};
    try{
      const remoteSnap=await ref.get();
      const remote=remoteSnap&&remoteSnap.exists() ? (remoteSnap.val()||{}) : {};
      const conflicts=nodes.filter(node=>remote[node.id]);
      if(conflicts.length){
        alert(`Không thể chuyển tự động vì ${conflicts.length} tài nguyên local bị trùng ID với kho Firebase (${conflicts.slice(0,3).map(node=>node.name||node.id).join(', ')}${conflicts.length>3?'…':''}). Dữ liệu local vẫn được giữ nguyên để xử lý an toàn.`);
        return;
      }
      for(const sourceNode of nodes){
        const node={...sourceNode};
        delete node.storageScope;
        if(node.localDataUrl && node.type==='file'){
          const blob=await (await fetch(node.localDataUrl)).blob();
          const storagePath=`drive-resources/user_${accountStorageKey()||'account'}/${node.id}-${driveSafeFileName(node.name)}`;
          const upload=storage.ref(storagePath);
          await upload.put(blob);
          node.storagePath=storagePath;
          node.storageUrl=await upload.getDownloadURL();
          delete node.localDataUrl;
        }
        updates[node.id]=node;
      }
      await ref.update(updates);
      localStorage.removeItem(DRIVE_LOCAL_STORAGE_KEY);
      driveAttach();
      renderDriveHubTab(document.getElementById('content'));
      showToast(`Đã chuyển ${nodes.length} tài nguyên lên Firebase.`);
    }catch(e){
      console.error('Chuyển kho dữ liệu local lên Firebase lỗi:',e);
      alert(`Không thể chuyển kho dữ liệu lên Firebase. Dữ liệu local vẫn được giữ nguyên để thử lại.\n\n${e&&e.message?e.message:'Lỗi không xác định'}`);
    }
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
  function driveDescendantIds(id){
    const found=[];
    const queue=[id];
    while(queue.length){
      const parent=queue.shift();
      Object.values(state.driveResources||{}).forEach(node=>{
        if(node && node.parentId===parent){ found.push(node.id); queue.push(node.id); }
      });
    }
    return found;
  }
  async function driveMoveNode(id){
    const node=state.driveResources[id];
    if(!node || !driveCanEdit(node)) return;
    const blocked=new Set([id,...driveDescendantIds(id)]);
    const folders=Object.values(state.driveResources||{}).filter(folder=>folder && folder.type==='folder' && !folder.deleted && !blocked.has(folder.id)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','vi'));
    const wrap=document.createElement('div');
    wrap.className='modal-bg';
    document.body.appendChild(wrap);
    wrap.innerHTML=`
      <div class="modal drive-move-modal" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>↔️ Di chuyển tài nguyên</h3><button class="modal-close" id="drive-move-close" aria-label="Đóng">✕</button></div>
        <div class="modal-body"><p class="sub">Chọn thư mục đích cho “${escapeHtml(node.name||'Tài nguyên')}”.</p><label class="field-label" for="drive-move-target">Thư mục</label><select class="text-input" id="drive-move-target"><option value="">⌂ Gốc</option>${folders.map(folder=>`<option value="${escapeHtml(folder.id)}">${escapeHtml(folder.name||'Không tên')}</option>`).join('')}</select></div>
        <div class="modal-foot"><button class="btn btn-ghost" id="drive-move-cancel">Huỷ</button><button class="btn btn-primary" id="drive-move-save">Di chuyển</button></div>
      </div>`;
    const close=()=>wrap.remove();
    wrap.querySelector('#drive-move-close').onclick=close;
    wrap.querySelector('#drive-move-cancel').onclick=close;
    wrap.querySelector('#drive-move-save').onclick=async()=>{
      const parentId=wrap.querySelector('#drive-move-target').value||null;
      if(parentId===node.parentId){ close(); return; }
      const ok=await driveUpdateNode(id,{parentId,updatedAt:new Date().toISOString()});
      if(ok){ close(); driveAttach(); renderDriveHubTab(document.getElementById('content')); }
    };
  }
  function closeDriveContextMenu(){
    const menu=document.getElementById('drive-context-menu');
    if(menu) menu.remove();
  }
  function openDriveContextMenu(event,id){
    event.preventDefault();
    event.stopPropagation();
    const node=state.driveResources[id];
    if(!node) return;
    closeDriveContextMenu();
    const menu=document.createElement('div');
    menu.id='drive-context-menu';
    menu.className='drive-context-menu';
    const edit=driveCanEdit(node);
    menu.innerHTML=`<button data-context-open>↗ Mở</button>${edit?'<button data-context-move>↔️ Di chuyển</button><button data-context-rename>✏️ Đổi tên</button><button data-context-trash>🗑️ Thùng rác</button>':''}${driveCanShare(node)?'<button data-context-share>🔗 Chia sẻ</button>':''}`;
    document.body.appendChild(menu);
    menu.style.left=`${Math.min(event.clientX,window.innerWidth-190)}px`;
    menu.style.top=`${Math.min(event.clientY,window.innerHeight-menu.offsetHeight-12)}px`;
    menu.querySelector('[data-context-open]').onclick=()=>{ closeDriveContextMenu(); if(node.type==='folder'){ state.driveCurrentFolder=node.id; renderDriveHubTab(document.getElementById('content')); } else { history.pushState({},'',driveResourceUrl(node)); renderDriveResourceRoute(document.getElementById('content'),driveRoute()); } };
    const move=menu.querySelector('[data-context-move]'); if(move) move.onclick=()=>{ closeDriveContextMenu(); driveMoveNode(id); };
    const rename=menu.querySelector('[data-context-rename]'); if(rename) rename.onclick=async()=>{ closeDriveContextMenu(); await driveRename(id); driveAttach(); renderDriveHubTab(document.getElementById('content')); };
    const trash=menu.querySelector('[data-context-trash]'); if(trash) trash.onclick=async()=>{ closeDriveContextMenu(); await driveTrash(id); driveAttach(); renderDriveHubTab(document.getElementById('content')); };
    const share=menu.querySelector('[data-context-share]'); if(share) share.onclick=()=>{ closeDriveContextMenu(); renderDriveShareModal(node); };
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
  // Nút "Ghi chú nhanh" trong Trung tâm dữ liệu chỉ là ĐƯỜNG DẪN sang module Ghi chú nhanh.
  // Trước đây nó mở một modal soạn thảo riêng, trùng việc với module kia; nay bỏ hẳn, mọi
  // việc soạn ghi chú đều diễn ra ở một nơi duy nhất.
  function driveOpenQuickNote(){
    openQuickNote();
  }
  async function driveLoadRouteData(route){
    if(isTourMode()) return driveDemoTree();
    if(route.space==='personal' && !drivePersonalAccessAllowed()) return null;
    if(route.space==='shared' && (!wardId() || !state.config || state.config.deleted)) return null;
    if(route.space==='personal' && !hasAuthenticatedIdentity() && state.accessMode===ACCESS_MODES.SIGNED_OUT) return driveLocalTree();
    const ref = route.space==='shared'
      ? rtdb.ref(`communes/${wardId()}/drive_resources`)
      : rtdb.ref(`users/${driveUserKey()}/drive_resources`);
    try{
      return await driveTreeForUser(ref,route.space);
    }catch(e){
      console.warn('Không tải được resource URL:', e);
      throw e;
    }
  }
  function driveRouteBackButton(){
    return `<button class="btn btn-ghost btn-sm" id="drive-route-back">← Về Trung tâm dữ liệu</button>`;
  }
  async function renderDriveResourceRoute(el, route){
    const requestId = ++driveRouteRequest;
    el.innerHTML = `<div class="drive-route-card"><div class="drive-route-loading">Đang kiểm tra quyền truy cập tài nguyên…</div></div>`;
    let tree;
    try{
      tree = await driveLoadRouteData(route);
    }catch(e){
      if(requestId!==driveRouteRequest) return;
      el.innerHTML = `<div class="drive-route-card"><div class="drive-route-actions">${driveRouteBackButton()}</div><div class="drive-route-error"><div>⚠️</div><h3>Không thể tải tài nguyên</h3><p>Kiểm tra kết nối mạng rồi thử lại.</p><button class="btn btn-primary btn-sm" id="drive-route-retry">↻ Thử lại</button></div></div>`;
      const back=document.getElementById('drive-route-back'); if(back) back.onclick=driveGoHub;
      const retry=document.getElementById('drive-route-retry'); if(retry) retry.onclick=()=>renderDriveResourceRoute(el,route);
      return;
    }
    if(requestId!==driveRouteRequest) return;
    if(tree) state.driveResources=tree;
    const node = tree && tree[route.id];
    const permission = node ? drivePermissionForNode(node,tree,route.space) : 'none';
    const visible = node && !node.deleted && node.type===route.kind && permission!=='none';
    if(!visible){
      el.innerHTML = `<div class="drive-route-card"><div class="drive-route-actions">${driveRouteBackButton()}</div><div class="drive-route-denied"><div>🔒</div><h3>Không tìm thấy tài nguyên</h3><p>Tài nguyên không tồn tại hoặc đồng chí không có quyền xem tài nguyên này.</p></div></div>`;
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
         <div class="drive-route-title"><div class="drive-route-icon">${driveNodeIcon(node)}</div><div><div class="eyebrow">${route.kind==='folder'?'FOLDER':'FILE'}</div><h3>${escapeHtml(node.name||'Không tên')}</h3><p class="sub">${escapeHtml(driveNodeDescription(node))}</p></div></div>
         ${route.kind==='folder' ? `
          <div class="drive-route-section"><b>Nội dung thư mục</b>
             ${children.length ? `<div class="drive-route-children">${children.map(child=>`<button class="drive-route-child" data-drive-route-child="${child.id}"><span>${driveNodeIcon(child)}</span><span>${escapeHtml(child.name||'Không tên')}</span><span>›</span></button>`).join('')}</div>` : `<div class="drive-route-empty">Thư mục này chưa có tài nguyên.</div>`}
           </div>` : route.kind==='file' ? `
           <div class="drive-route-section"><b>Xem trước tệp</b><div id="drive-file-viewer" class="drive-file-viewer"><div class="drive-route-loading">Đang mở tệp…</div></div></div>` : `
          <div class="drive-route-section"><b>Liên kết gốc</b><a class="btn btn-primary" href="${escapeHtml(node.url)}" target="_blank" rel="noopener noreferrer">Mở tài liệu gốc ↗</a></div>`}
        ${route.space==='shared' ? `<div class="drive-route-section drive-comments"><div class="drive-comments-head"><b>💬 Bình luận (${comments.length})</b><span class="sub">Viewer có thể đọc · Commenter/Editor có thể thêm</span></div>
          ${comments.length ? `<div class="drive-comment-list">${comments.map(comment=>`<article class="drive-comment"><div class="drive-comment-head"><b>${escapeHtml(comment.authorName||comment.authorEmail||'Người dùng')}</b><time>${escapeHtml(comment.createdAt ? new Date(comment.createdAt).toLocaleString('vi-VN') : '')}</time></div><p>${escapeHtml(comment.text||'')}</p>${driveCanDeleteComment(comment)?`<button class="btn btn-ghost btn-sm" data-drive-comment-delete="${comment.id}">Xoá</button>`:''}</article>`).join('')}</div>` : `<div class="drive-route-empty">Chưa có bình luận.</div>`}
          ${canComment && !isTourMode() ? `<div class="drive-comment-compose"><textarea id="drive-comment-input" rows="3" placeholder="Viết bình luận cho tài nguyên này…"></textarea><div><button class="btn btn-primary btn-sm" id="drive-comment-send">Gửi bình luận</button></div></div>` : `<div class="drive-comment-note">${isTourMode()?'Bình luận bị tắt trong môi trường tham quan.':permission==='viewer'?'Đồng chí đang ở chế độ chỉ xem.':''}</div>`}
        </div>` : ''}
         <div class="drive-route-footer"><span class="sub">Resource ID: <code>${escapeHtml(node.id)}</code>${node.storageScope==='local'?' · Chỉ lưu trên thiết bị này':''}</span>${node.storageScope==='local'?'':'<button class="btn btn-ghost btn-sm" id="drive-copy-route">Sao chép URL</button>'}</div>
      </div>`;
    const fileViewer=document.getElementById('drive-file-viewer');
    if(fileViewer) drivePopulateFileViewer(fileViewer,node);
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
            <div class="eyebrow">TRUNG TÂM DỮ LIỆU</div>
            <h3>${isShared ? 'Kho dữ liệu dùng chung' : 'Kho dữ liệu cá nhân'}</h3>
            <p class="sub">${isShared ? `Theo mã xã/phường <b class="mono">${escapeHtml(wardId()||'')}</b>` : (driveIsLocalPersonal() ? 'Đang lưu trên trình duyệt này; đăng nhập Google để đồng bộ lên Firebase.' : 'Metadata của app lưu theo tài khoản; Google Drive chỉ là lớp liên kết.')}</p>
          </div>
          <div class="drive-hub-actions">
            <button class="btn btn-ghost btn-sm" id="drive-open-note">🗒️ Ghi chú nhanh</button>
            <button class="btn btn-ghost btn-sm" id="drive-refresh">↻ Làm mới</button>
          </div>
        </div>
        <div class="drive-space-tabs">
          <button class="btn ${!isShared?'btn-primary':'btn-ghost'} btn-sm" id="drive-personal">🔒 Cá nhân</button>
          <button class="btn ${isShared?'btn-primary':'btn-ghost'} btn-sm" id="drive-shared" ${wardId()?'':'disabled'}>🏛️ Xã/phường</button>
          <button class="btn btn-ghost btn-sm" id="drive-trash">${state.driveTrashOpen?'◀ Kho dữ liệu':'🗑️ Thùng rác'}</button>
        </div>
        ${isTourMode()? `<div class="drive-notice drive-notice-tour">⚠️ CHẾ ĐỘ THAM QUAN — tài liệu dưới đây là dữ liệu demo, không lưu và không chia sẻ thật.</div>` : ''}
        ${driveIsLocalPersonal()? `<div class="drive-notice drive-notice-local">💾 Kho cá nhân đang lưu trên thiết bị này. Đồng chí có thể tạo thư mục, ghi chú và tải tệp; đăng nhập Google sau đó để đồng bộ sang Firebase. Tài nguyên local không tạo URL chia sẻ dùng chung.</div>` : ''}
        ${!isShared && hasAuthenticatedIdentity() && driveHasLocalResources()? `<div class="drive-notice drive-notice-migration">📦 Phát hiện tài nguyên đang chờ chuyển từ trình duyệt lên kho cá nhân Firebase. <button class="btn btn-ghost btn-sm" id="drive-migrate-local">Chuyển lên Firebase</button></div>` : ''}
        ${isShared && !canEdit? `<div class="drive-notice">Đồng chí đang ở chế độ xem. Chỉ Chủ mã mới được tạo, đổi tên hoặc đưa tài liệu vào thùng rác.</div>` : ''}
        <div class="drive-office-grid" aria-label="Ứng dụng văn phòng">
          <button class="drive-office-card" data-drive-office="Docs" title="Xem trạng thái Docs"><span>📄</span><b>Docs</b><small>Đang thiết kế — sẽ sớm ra mắt</small></button>
          <button class="drive-office-card" data-drive-office="Sheets" title="Xem trạng thái Sheets"><span>📊</span><b>Sheets</b><small>Đang thiết kế — sẽ sớm ra mắt</small></button>
          <button class="drive-office-card" data-drive-office="Slides" title="Xem trạng thái Slides"><span>📽️</span><b>Slides</b><small>Đang thiết kế — sẽ sớm ra mắt</small></button>
        </div>
        <div class="drive-toolbar">
          <div class="drive-breadcrumb"><button data-drive-folder="">⌂ Gốc</button>${crumbs.map(c=>`<span>/</span><button data-drive-folder="${c.id}">${escapeHtml(c.name)}</button>`).join('')}</div>
          <div class="drive-toolbar-right">
             <input id="drive-search" type="search" placeholder="Tìm trong thư mục..." value="${escapeHtml(state.driveSearch||'')}">
             <select id="drive-sort" aria-label="Sắp xếp tài nguyên"><option value="name" ${state.driveSort==='name'?'selected':''}>Tên A–Z</option><option value="newest" ${state.driveSort==='newest'?'selected':''}>Mới cập nhật</option><option value="oldest" ${state.driveSort==='oldest'?'selected':''}>Cũ nhất</option><option value="type" ${state.driveSort==='type'?'selected':''}>Theo loại</option></select>
            ${canEdit && !state.driveTrashOpen ? `<button class="btn btn-primary btn-sm" id="drive-new-folder">＋ Thư mục</button><button class="btn btn-primary btn-sm" id="drive-new-file">＋ Tệp</button><button class="btn btn-primary btn-sm" id="drive-new-link">＋ Liên kết</button>` : ''}
            <button class="btn btn-ghost btn-sm" id="drive-toggle-view">${state.driveListMode==='grid'?'☷ Danh sách':'▦ Lưới'}</button>
          </div>
        </div>
        <div class="drive-items ${state.driveListMode==='list'?'is-list':''}">
           ${state.driveLoading ? `<div class="drive-state"><div class="drive-state-icon">⏳</div><b>Đang tải kho dữ liệu…</b><span>Đang đồng bộ dữ liệu, vui lòng chờ một chút.</span></div>` :
            state.driveLoadError ? `<div class="drive-state drive-state-error"><div class="drive-state-icon">⚠️</div><b>Không thể tải kho dữ liệu</b><span>${escapeHtml(state.driveLoadError)}</span><button class="btn btn-primary btn-sm" id="drive-retry">↻ Thử lại</button></div>` :
          items.length ? items.map(n=>{
            const itemCanEdit=driveCanEdit(n);
            const itemCanShare=driveCanShare(n);
            return `
              <article class="drive-item" data-drive-item="${n.id}">
                 <div class="drive-item-icon">${driveNodeIcon(n)}</div>
                 <div class="drive-item-main"><b>${escapeHtml(n.name||'Không tên')}</b><span>${escapeHtml(driveNodeDescription(n))}</span></div>
                <div class="drive-item-actions">
                  <button data-drive-open-route="${n.id}" title="Mở URL tài nguyên">↗</button>
                  ${itemCanShare?`<button data-drive-share="${n.id}" title="Chia sẻ">🔗</button>`:''}
                  ${state.driveTrashOpen ? (itemCanEdit?`<button data-drive-restore="${n.id}" title="Khôi phục">♻️</button>`:'') : (itemCanEdit?`<button data-drive-move="${n.id}" title="Di chuyển">↔️</button><button data-drive-rename="${n.id}" title="Đổi tên">✏️</button><button data-drive-trash="${n.id}" title="Đưa vào thùng rác">🗑️</button>`:'')}
                </div>
              </article>`;
           }).join('') : `<div class="drive-empty"><div>🗂️</div><b>${state.driveTrashOpen?'Thùng rác trống':state.driveSearch?'Không tìm thấy tài liệu phù hợp':'Kho dữ liệu đã sẵn sàng'}</b><span>${state.driveTrashOpen?'Các tài liệu đã xoá sẽ xuất hiện ở đây.':state.driveSearch?'Thử từ khoá khác hoặc xoá bộ lọc tìm kiếm.':'Chưa có tài liệu trong thư mục này. Hãy tạo mục đầu tiên để bắt đầu.'}</span>${canEdit&&!state.driveTrashOpen&&!state.driveSearch?`<div class="drive-empty-actions"><button class="btn btn-primary btn-sm" id="drive-empty-new-folder">＋ Tạo thư mục</button><button class="btn btn-primary btn-sm" id="drive-empty-new-file">＋ Tải tệp</button><button class="btn btn-primary btn-sm" id="drive-empty-new-link">＋ Thêm liên kết</button></div>`:''}</div>`}
        </div>
      </div>`;
    const bind = (id, event, fn)=>{ const node=document.getElementById(id); if(node) node.addEventListener(event, fn); };
    bind('drive-personal','click',()=>{ state.driveSpace='personal'; state.driveCurrentFolder=null; state.driveSearch=''; state.driveTrashOpen=false; renderDriveHubTab(el); });
    bind('drive-shared','click',()=>{ if(!wardId()) return; state.driveSpace='shared'; state.driveCurrentFolder=null; state.driveSearch=''; state.driveTrashOpen=false; renderDriveHubTab(el); });
    bind('drive-trash','click',()=>{ state.driveTrashOpen=!state.driveTrashOpen; state.driveCurrentFolder=null; renderDriveHubTab(el); });
    bind('drive-refresh','click',()=>{ driveDetach(); driveAttach(); renderDriveHubTab(el); });
     bind('drive-retry','click',()=>{ driveDetach(); driveAttach(); renderDriveHubTab(el); });
    bind('drive-open-note','click',driveOpenQuickNote);
    bind('drive-new-folder','click',driveCreateFolder);
     bind('drive-new-file','click',driveCreateFile);
    bind('drive-new-link','click',driveCreateLink);
     bind('drive-empty-new-folder','click',driveCreateFolder);
     bind('drive-empty-new-file','click',driveCreateFile);
     bind('drive-empty-new-link','click',driveCreateLink);
    bind('drive-toggle-view','click',()=>{ state.driveListMode=state.driveListMode==='grid'?'list':'grid'; renderDriveHubTab(el); });
    const search=document.getElementById('drive-search');
    if(search) search.addEventListener('input', e=>{
      state.driveSearch=e.target.value;
      const selectionStart=e.target.selectionStart;
      const selectionEnd=e.target.selectionEnd;
      renderDriveHubTab(el);
      const nextSearch=document.getElementById('drive-search');
      if(nextSearch){
        nextSearch.focus();
        if(selectionStart!=null && nextSearch.setSelectionRange) nextSearch.setSelectionRange(selectionStart,selectionEnd==null?selectionStart:selectionEnd);
      }
    });
     const sort=document.getElementById('drive-sort');
     if(sort) sort.addEventListener('change', e=>{ state.driveSort=e.target.value; renderDriveHubTab(el); });
     bind('drive-migrate-local','click',driveMigrateLocal);
      el.querySelectorAll('[data-drive-office]').forEach(btn=>btn.onclick=()=>driveOpenOfficeApp(btn.dataset.driveOffice));
    el.querySelectorAll('[data-drive-folder]').forEach(btn=>btn.onclick=()=>{ state.driveCurrentFolder=btn.dataset.driveFolder||null; state.driveSearch=''; renderDriveHubTab(el); });
    el.querySelectorAll('[data-drive-item]').forEach(item=>item.onclick=(e)=>{
      if(e.target.closest('button')) return;
      const n=state.driveResources[item.dataset.driveItem];
      if(!n) return;
      if(n.type==='folder'){ state.driveCurrentFolder=n.id; state.driveSearch=''; renderDriveHubTab(el); }
       else if(n.type==='file' || n.url){ history.pushState({},'',driveResourceUrl(n)); renderDriveResourceRoute(el, driveRoute()); }
    });
    el.querySelectorAll('[data-drive-open-route]').forEach(btn=>btn.onclick=async e=>{
      e.stopPropagation();
      const n=state.driveResources[btn.dataset.driveOpenRoute];
      if(n){ history.pushState({},'',driveResourceUrl(n)); renderDriveResourceRoute(el, driveRoute()); }
    });
    el.querySelectorAll('[data-drive-share]').forEach(btn=>btn.onclick=e=>{ e.stopPropagation(); renderDriveShareModal(state.driveResources[btn.dataset.driveShare]); });
    el.querySelectorAll('[data-drive-move]').forEach(btn=>btn.onclick=e=>{ e.stopPropagation(); driveMoveNode(btn.dataset.driveMove); });
    el.querySelectorAll('[data-drive-rename]').forEach(btn=>btn.onclick=async e=>{ e.stopPropagation(); await driveRename(btn.dataset.driveRename); driveAttach(); renderDriveHubTab(el); });
    el.querySelectorAll('[data-drive-trash]').forEach(btn=>btn.onclick=async e=>{ e.stopPropagation(); await driveTrash(btn.dataset.driveTrash); driveAttach(); renderDriveHubTab(el); });
    el.querySelectorAll('[data-drive-restore]').forEach(btn=>btn.onclick=async e=>{ e.stopPropagation(); await driveRestore(btn.dataset.driveRestore); driveAttach(); renderDriveHubTab(el); });
    el.querySelectorAll('[data-drive-item]').forEach(item=>item.addEventListener('contextmenu',e=>openDriveContextMenu(e,item.dataset.driveItem)));
    document.addEventListener('click',closeDriveContextMenu,{once:true});
  }

  // =====================================================================
  // BẢY MODULE ĐANG NÂNG CẤP — Lịch công tác, Danh sách công việc, Tập huấn bằng AI,
  // Phòng họp không giấy, Quản lý Fanpage, Chăm sóc hội viên, Công tác Chi hội.
  // Hiện mới có trang giới thiệu; dùng chung một hàm dựng để khỏi lặp mã.
  // =====================================================================
  function renderUpcomingModule(el, cfg){
    if(!el) return;
    el.innerHTML = `
      <div class="upcoming-page">
        <div class="upcoming-card">
          <div class="upcoming-head">
            <div class="upcoming-ico">${cfg.icon}</div>
            <div>
              <div class="eyebrow">${escapeHtml(cfg.eyebrow)}</div>
              <h3>${escapeHtml(cfg.title)}</h3>
            </div>
          </div>
          <div class="upcoming-badge">🚧 Tính năng đang nâng cấp — sẽ sớm ra mắt</div>
          <p class="upcoming-lead">${escapeHtml(cfg.lead)}</p>
          <div class="upcoming-grid">
            ${cfg.blocks.map(([ico,h,p])=>`
              <div class="upcoming-feature">
                <div class="upcoming-feature-ico">${ico}</div>
                <div><h4>${escapeHtml(h)}</h4><p>${escapeHtml(p)}</p></div>
              </div>`).join('')}
          </div>
          ${cfg.note? `<div class="upcoming-note"><b>${escapeHtml(cfg.note[0])}</b><span>${escapeHtml(cfg.note[1])}</span></div>` : ''}
        </div>
      </div>`;
  }

  const UPCOMING_MODULES = {
    schedule: {
      icon:'📅', eyebrow:'QUẢN LÝ THỜI GIAN', title:'Lịch Công tác',
      lead:'Lịch công tác của xã/phường thường phát ra dưới dạng một tệp chung cho tất cả cán bộ, mỗi người phải tự dò xem dòng nào là của mình. Module này để AI làm việc dò ấy thay đồng chí.',
      blocks:[
        ['📤','Tải tệp lịch chung lên là xong',
         'Nhận tệp Word, Excel, PDF hay kể cả ảnh chụp bảng lịch dán ở cơ quan. AI đọc hiểu nội dung, không cần đồng chí phải nhập lại từng dòng.'],
        ['🔍','AI tách riêng phần việc của đồng chí',
         'Từ lịch chung của cả cơ quan, AI lọc ra đúng những buổi có tên đồng chí hoặc thuộc mảng đồng chí phụ trách, rồi ghi vào lịch riêng: làm việc gì, ở đâu, lúc mấy giờ, đi cùng ai, cần chuẩn bị gì.'],
        ['🔔','Nhắc hẹn như Lịch Google',
         'Báo trước theo mốc đồng chí đặt — một ngày trước, một giờ trước, mười lăm phút trước. Nhắc qua thông báo trên điện thoại và máy tính, hoặc gửi email cho những việc quan trọng.'],
        ['🗓️','Nhìn được cả tuần, cả tháng, cả quý',
         'Xem theo ngày, tuần, tháng hoặc dạng danh sách. Thấy ngay chỗ trùng lịch, chỗ hai cuộc họp sát nhau không kịp di chuyển, hay tuần nào đang quá tải.'],
        ['🤝','Chia sẻ lịch trong cơ quan',
         'Cho phép đồng nghiệp xem lịch của đồng chí khi cần xếp họp, hoặc xem lịch chung của cả Ban Thường vụ để chọn khung giờ mọi người đều rảnh.'],
        ['🔗','Nối với các phần khác của Sổ tay',
         'Buổi họp có tài liệu kèm theo thì mở thẳng từ Trung tâm dữ liệu; việc phát sinh sau cuộc họp đẩy sang Danh sách công việc.'],
      ],
      note:['Vì sao cần AI ở đây?','Vì lịch công tác mỗi nơi trình bày một kiểu, có nơi làm bảng, có nơi gạch đầu dòng, có nơi viết thành đoạn văn. Nếu bắt phần mềm đọc theo khuôn cứng thì chỉ cần đổi mẫu là hỏng. AI đọc hiểu được nội dung nên mẫu nào cũng dùng được.'],
    },
    tasks: {
      icon:'✅', eyebrow:'THEO DÕI TIẾN ĐỘ', title:'Danh sách Công việc',
      lead:'Nơi tập hợp tất cả đầu việc của đồng chí — dù nó đến từ một văn bản chỉ đạo, một cuộc họp, hay chỉ là câu dặn dò trong nhóm chat — rồi theo dõi đến khi xong.',
      blocks:[
        ['🧠','AI đọc mọi thứ đồng chí đưa vào và tự rút ra đầu việc',
         'Dán một đoạn tin nhắn, tải lên một công văn, hay đưa biên bản cuộc họp — AI nhặt ra các việc cần làm, đoán thời hạn từ nội dung, xếp mức độ ưu tiên và hỏi lại đồng chí những chỗ chưa rõ.'],
        ['🗺️','Bản đồ công việc theo tuần, tháng, năm',
         'Nhìn thấy toàn cảnh chặng đường: việc nào phải xong trước để việc sau chạy được, giai đoạn nào dồn việc, mốc nào là hạn cuối không lùi được.'],
        ['📊','Theo dõi tiến độ và chấm KPI',
         'Mỗi đầu việc có phần trăm hoàn thành, hạn chót và trạng thái. Hệ thống tự tổng hợp thành điểm KPI theo kỳ, không phải ngồi cộng tay cuối quý.'],
        ['📎','Đính kèm bằng chứng cho từng việc',
         'Gắn tệp, ảnh chụp hoặc liên kết làm minh chứng cho việc đã hoàn thành — lúc chấm KPI hay bị hỏi lại thì có ngay, khỏi đi tìm.'],
        ['📝','AI soạn báo cáo tiến độ để nộp cấp trên',
         'Đến kỳ báo cáo, AI tổng hợp những việc đã làm trong kỳ, kết quả đạt được, việc còn dở và lý do, rồi dựng thành bản báo cáo đúng thể thức để đồng chí rà lại và nộp.'],
        ['👥','Giao việc và theo dõi người khác',
         'Cán bộ phụ trách giao việc cho từng người, thấy được ai đang làm đến đâu, việc nào sắp trễ hạn để nhắc trước khi muộn.'],
      ],
      note:['Điều khác biệt','Phần mềm quản lý công việc thông thường bắt đồng chí ngồi nhập từng đầu việc — mà chính việc nhập ấy đã đủ mất công để người ta bỏ dùng. Ở đây đồng chí chỉ cần ném nguyên tài liệu hoặc đoạn chat vào, phần bóc tách để AI lo.'],
    },
    training: {
      icon:'🎓', eyebrow:'ĐÀO TẠO', title:'Tập huấn bằng AI',
      lead:'Thay vì tập trung hàng trăm hội viên vào hội trường rồi giảng một lượt cho tất cả, đồng chí soạn bài giảng một lần và mỗi người được AI kèm riêng, đúng trình độ và đúng lúc họ rảnh.',
      blocks:[
        ['📚','Soạn bài giảng rồi cho AI tiêu hoá',
         'Đưa vào tài liệu tập huấn dưới bất kỳ dạng nào — văn bản, slide, PDF, ảnh chụp tài liệu giấy. AI đọc kỹ, nắm chắc nội dung và ghi nhớ để làm nguồn kiến thức duy nhất khi giảng, không nói ra ngoài phạm vi bài.'],
        ['🔗','Gửi bài giảng bằng một đường liên kết',
         'Hội viên bấm vào liên kết là học được ngay, không cần cài phần mềm, không cần lập tài khoản. Gửi qua Zalo, tin nhắn hay dán vào nhóm đều được.'],
        ['💬','Học bằng cách trò chuyện, không phải đọc suông',
         'Người học hỏi, AI trả lời, giải thích lại chỗ chưa hiểu, cho ví dụ gần gũi với công việc nhà nông. Hỏi bao nhiêu lần cũng được, không ngại như giơ tay giữa hội trường đông người.'],
        ['🎯','AI tự dò xem người học đang ở đâu',
         'Qua vài câu trao đổi đầu, AI nhận ra người này đã biết gì và chưa biết gì, rồi bỏ qua phần họ đã nắm, đi sâu vào phần họ còn yếu. Người đã rành thì học nhanh, người mới thì được giảng kỹ.'],
        ['🧪','Kiểm tra hiểu bài ngay trong lúc học',
         'AI đặt câu hỏi ngược lại để chắc rằng người học thật sự hiểu chứ không phải gật cho xong, và quay lại giảng thêm chỗ nào còn lệch.'],
        ['📈','Cán bộ Hội thấy được kết quả',
         'Bao nhiêu người đã học, học đến đâu, chỗ nào nhiều người vướng nhất — từ đó biết cần bổ sung gì vào tài liệu cho đợt sau.'],
      ],
      note:['Bài toán thực tế','Tập huấn tập trung tốn thời gian đi lại của cả trăm người, mà mỗi người lại có trình độ và nhu cầu khác nhau. Cách này giữ được nội dung do chính cán bộ Hội biên soạn, nhưng cách truyền đạt thì tuỳ theo từng người nghe.'],
    },
    meeting: {
      icon:'📋', eyebrow:'HỘI HỌP', title:'Phòng họp không giấy',
      lead:'Mỗi cuộc họp là một thư mục tài liệu có đường liên kết riêng. Đại biểu quét mã là xem được toàn bộ tài liệu trên điện thoại — không in, không phát, không thừa giấy.',
      blocks:[
        ['📁','Mỗi cuộc họp một thư mục',
         'Gom chương trình họp, báo cáo, tờ trình, dự thảo nghị quyết, phụ lục số liệu vào một chỗ, sắp theo đúng thứ tự chương trình để đại biểu dễ theo dõi.'],
        ['🔗','Chia sẻ bằng liên kết chỉ xem',
         'Người nhận chỉ xem được, không sửa và không xoá được gì. Tài liệu gốc của đồng chí an toàn tuyệt đối.'],
        ['📱','Tự sinh mã QR để quét',
         'Chiếu mã QR lên màn hình hội trường hoặc in nhỏ dán trên bàn, đại biểu đưa điện thoại lên quét là vào ngay — khỏi phải đọc địa chỉ dài cho cả phòng chép lại.'],
        ['🔄','Sửa tài liệu phút chót vẫn kịp',
         'Cập nhật tệp trong thư mục là mọi người mở lên đã thấy bản mới nhất. Không còn cảnh phát nhầm bản cũ rồi phải đính chính giữa cuộc họp.'],
        ['⏱️','Đặt hạn cho liên kết',
         'Hẹn ngày liên kết hết hiệu lực, hoặc đóng ngay sau khi họp xong, để tài liệu nội bộ không lưu hành mãi ngoài ý muốn.'],
        ['🌱','Tiết kiệm thật sự',
         'Một cuộc họp năm chục đại biểu, mỗi bộ tài liệu vài chục trang — mỗi năm vài chục cuộc họp là con số giấy mực và thời gian photo không hề nhỏ.'],
      ],
      note:['Đơn giản là điểm mạnh','Không cần đại biểu cài phần mềm, không cần đăng nhập, không cần tập huấn cách dùng. Ai biết quét mã QR là dùng được — kể cả các bác lớn tuổi.'],
    },
    fanpage: {
      icon:'📣', eyebrow:'TRUYỀN THÔNG', title:'Quản lý Fanpage',
      lead:'Hầu hết Hội Nông dân đều có trang Facebook, nhưng thường bỏ bẵng vì không ai có thời gian trực. Module này gom việc quản trị trang về một chỗ và để AI đỡ phần việc lặp đi lặp lại.',
      blocks:[
        ['📝','Đăng bài ngay trong Sổ tay',
         'Soạn bài, chèn ảnh, hẹn giờ đăng — không phải chuyển qua lại giữa app và Facebook. Bài viết từ module Tạo bài Tuyên truyền đẩy thẳng sang đây được.'],
        ['💬','Trả lời bình luận và tin nhắn dưới danh nghĩa Trang',
         'Toàn bộ bình luận và tin nhắn của Trang hiện về một hộp chung, trả lời tại chỗ, không sót câu hỏi nào của bà con.'],
        ['🤖','Giao bớt cho AI khi đồng chí cho phép',
         'Đồng chí quyết định mức độ: AI chỉ soạn sẵn câu trả lời chờ đồng chí duyệt, hay được tự trả lời những câu hỏi thường gặp. Quyền cấp tới đâu AI làm tới đó, rút lại lúc nào cũng được.'],
        ['📅','Lên lịch nội dung cả tháng',
         'Dựng trước kế hoạch bài đăng theo tuần hoặc tháng, AI gợi ý chủ đề bám theo mùa vụ, ngày lễ và các đợt phát động phong trào của Hội.'],
        ['📊','Xem bài nào bà con quan tâm',
         'Thống kê lượt xem, lượt tương tác, khung giờ nhiều người đọc nhất — để lần sau đăng đúng lúc và đúng thứ bà con cần.'],
        ['🛡️','Giữ chuẩn mực của trang chính thống',
         'AI cảnh báo trước những nội dung nhạy cảm hoặc câu chữ chưa phù hợp với một trang của tổ chức chính trị - xã hội, trước khi bài được đăng ra.'],
      ],
      note:['Về quyền truy cập','Module chỉ hoạt động sau khi đồng chí chủ động kết nối và cấp quyền cho Trang của mình. Quyền cấp bao nhiêu dùng bấy nhiêu, và đồng chí thu hồi được bất cứ lúc nào.'],
    },
    carecare: {
      icon:'💚', eyebrow:'CÔNG TÁC HỘI VIÊN', title:'Chăm sóc Hội viên',
      lead:'Giữ liên lạc thường xuyên với hàng trăm hội viên là việc quá sức nếu nhắn tay từng người. Module này để AI nhắn thay, nhưng vẫn ra chất riêng cho từng người chứ không phải tin nhắn hàng loạt vô hồn.',
      blocks:[
        ['✉️','Nhắn hàng loạt mà vẫn như nhắn riêng',
         'Gửi cho cả Hội, cho một chi hội, một tổ hội, hay một nhóm theo tiêu chí bất kỳ. AI điều chỉnh cách xưng hô và nội dung theo từng người, không phải một mẫu chung dán cho tất cả.'],
        ['🎂','Tự động hỏi thăm đúng dịp',
         'Chúc mừng sinh nhật, thăm hỏi lúc ốm đau hiếu hỉ, nhắc đến hạn đóng hội phí, báo lịch sinh hoạt chi hội — đặt một lần rồi chạy đều, khỏi lo quên ai.'],
        ['📋','Lấy ý kiến hội viên',
         'Gửi phiếu khảo sát hoặc chỉ vài câu hỏi mở, hội viên trả lời ngay trong tin nhắn. Không cần phát phiếu giấy rồi đi thu lại từng nhà.'],
        ['🧾','AI tổng hợp khó khăn và đề xuất',
         'Hàng trăm câu trả lời rời rạc được AI gom thành các nhóm vấn đề, chỉ ra điều gì nhiều người cùng nêu, điều gì chỉ cá biệt — thành bản tổng hợp dùng được ngay cho báo cáo hoặc kiến nghị lên cấp trên.'],
        ['💙','Kết nối Zalo',
         'Phần lớn bà con dùng Zalo hằng ngày, nên chăm sóc qua Zalo được gói gọn ngay trong module này, không phải mở thêm ứng dụng nào khác.'],
        ['📇','Lịch sử liên lạc từng người',
         'Xem lại đã trao đổi gì với hội viên nào, họ từng nêu khó khăn gì, đã được hỗ trợ ra sao — để lần sau tiếp xúc không hỏi lại từ đầu.'],
      ],
      note:['Giữ cái tình trong công việc','Công nghệ ở đây chỉ để cán bộ Hội có thời gian dành cho những cuộc gặp thật sự cần gặp. Những việc lặp đi lặp lại thì máy làm, còn thăm hỏi lúc bà con khó khăn vẫn phải là con người.'],
    },
    branch: {
      icon:'🌾', eyebrow:'CẤP CHI HỘI', title:'Công tác Chi hội',
      lead:'Chi hội khu dân cư và chi hội nghề nghiệp là cấp gần hội viên nhất, nhưng lại thiếu công cụ nhất — thường chỉ có cuốn sổ tay và vài tờ giấy. Module này dành riêng cho cán bộ chi hội.',
      blocks:[
        ['👥','Quản lý hội viên của chi hội mình',
         'Danh sách hội viên trong chi hội, tổ hội trực thuộc, thông tin liên lạc, ngành nghề, hoàn cảnh cần lưu ý. Chi hội trưởng chỉ thấy phần của chi hội mình, không lẫn sang nơi khác.'],
        ['📄','Kho mẫu văn bản của chi hội',
         'Biên bản sinh hoạt chi hội, danh sách điểm danh, báo cáo tháng gửi lên Hội xã, đơn xin vào Hội, biên bản bình xét thi đua — có sẵn mẫu, chỉ việc điền.'],
        ['📊','Thống kê tự động',
         'Số hội viên tăng giảm trong kỳ, tỷ lệ tham gia sinh hoạt, tình hình đóng hội phí, kết quả các phong trào — tự tổng hợp thành số liệu để báo cáo, khỏi ngồi đếm tay.'],
        ['🏡','Theo dõi tổ hội',
         'Chi hội có nhiều tổ hội thì quản lý được từng tổ: ai làm tổ trưởng, bao nhiêu hội viên, sinh hoạt đến đâu.'],
        ['💬','Chăm sóc hội viên trong chi hội',
         'Nhắn tin, thông báo lịch sinh hoạt, hỏi thăm — dùng chung cơ chế với module Chăm sóc hội viên nhưng gói gọn trong phạm vi chi hội mình phụ trách.'],
        ['🔄','Nối liền với Hội cấp xã',
         'Số liệu chi hội báo lên tự động cộng vào số liệu chung của Hội xã/phường; chỉ đạo từ Hội xã cũng chuyển thẳng xuống chi hội, không còn tam sao thất bản qua nhiều khâu.'],
      ],
      note:['Vì sao tách riêng?','Cán bộ chi hội phần lớn kiêm nhiệm, làm ngoài giờ và không được đào tạo về phần mềm. Nên module này cố tình làm gọn, chỉ giữ đúng những việc chi hội thật sự cần, không bắt học cả hệ thống lớn.'],
    },
  };

  // =====================================================================
  // ĐIỂM KHỞI ĐỘNG ỨNG DỤNG — PHẢI LUÔN NẰM Ở CUỐI PHẦN CUỐI CÙNG trong
  // manifest.json. Toàn bộ 15 phần được nối lại thành MỘT hàm bọc (IIFE)
  // duy nhất mở ở 01-foundation.js và đóng ngay bên dưới, nhờ vậy mọi phần
  // dùng chung được `state`, `render`, `escapeHtml`... Nếu sau này thêm
  // phần 16, hãy CHUYỂN nguyên khối này xuống cuối phần đó — để mọi khai
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
