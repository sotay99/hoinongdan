  // =====================================================================
  // 15c-pptx-viewer.js — Xem PowerPoint GIỮ BỐ CỤC (dùng chung cho Trung tâm dữ liệu và Phòng họp không
  // giấy, qua drivePopulateFileViewer ở 15-drive-hub.js).
  //
  // Dùng thư viện mã nguồn mở @aiden0z/pptx-renderer (Apache-2.0): dựng từng slide đúng toạ độ như
  // PowerPoint — hình, khung chữ, ảnh, bảng, biểu đồ, SmartArt, nền, kế thừa bố cục từ slide mẫu và
  // bảng màu chủ đề. Thư viện phát hành dạng ES module (đã gói sẵn JSZip + ECharts) nên nạp bằng import()
  // thay vì thẻ <script> như các thư viện trong optionalLibraries. Đọc không được (tệp .ppt cũ, tệp hỏng,
  // mất mạng khi nạp) thì trả false để quay về bản chỉ-chữ cũ. Nằm giữa manifest nên không có khối boot().
  // =====================================================================
  const PPTX_RENDERER_URL = 'https://cdn.jsdelivr.net/npm/@aiden0z/pptx-renderer@1.4.0/dist/aiden0z-pptx-renderer.browser.es.js';
  let pptxRendererPromise = null;
  function loadPptxRenderer(){
    if(!pptxRendererPromise){
      pptxRendererPromise = import(PPTX_RENDERER_URL).then(lib=>{
        if(!lib || !lib.PptxViewer) throw new Error('thư viện không có PptxViewer');
        return lib;
      }).catch(e=>{ pptxRendererPromise = null; throw e; });
    }
    return pptxRendererPromise;
  }
  // Mỗi bộ xem giữ ResizeObserver/biểu đồ — khung chứa bị gỡ khỏi trang (đóng tài liệu, chuyển tệp) thì
  // giải phóng ở lần dọn kế tiếp để không rò bộ nhớ khi xem nhiều tệp liền nhau.
  const drivePptxViewers = new Set();
  function drivePptxSweep(){
    drivePptxViewers.forEach(item=>{
      if(item.host.isConnected) return;
      try{ item.viewer.destroy(); }catch(e){}
      drivePptxViewers.delete(item);
    });
  }
  async function driveRenderPptxSlides(el, buffer){
    drivePptxSweep();
    let host = null;
    try{
      const lib = await loadPptxRenderer();
      host = document.createElement('div');
      host.className = 'pv';
      host.innerHTML = '<div class="pv-stage"></div>';
      el.innerHTML = '';
      el.appendChild(host);
      // Khung tài liệu tự cuộn (trang đại biểu: thân trình xem; Trung tâm dữ liệu: chính khung slide, cao tối
      // đa 80vh) — báo cho thư viện để chỉ dựng các slide đang ở gần vùng nhìn thấy.
      const scrollContainer = el.closest('.mtp-viewer-body') || (el.classList.contains('drive-file-viewer') ? host : undefined);
      const viewer = await lib.PptxViewer.open(buffer, host.firstChild, {
        zipLimits: lib.RECOMMENDED_ZIP_LIMITS,
        fitMode: 'contain',
        lazyMedia: true,
        lazySlides: true,
        // Không tải ảnh/video từ địa chỉ bên ngoài tệp (riêng tư cho người xem, tránh lộ việc mở tài liệu).
        externalMedia: 'block',
        // Bản dựng EMF→PDF cần pdf.js 5+, app đang dùng 3.x cho Phòng họp — tắt, thư viện tự bỏ qua hình đó.
        pdfjs: false,
        scrollContainer,
        listOptions: { windowed: true, initialSlides: 3, batchSize: 3, showSlideLabels: true },
      });
      drivePptxViewers.add({ host, viewer });
      return true;
    }catch(e){
      console.warn('[Xem PowerPoint] Không dựng được slide, chuyển sang bản chỉ-chữ:', e);
      if(host && host.parentNode) host.remove();
      return false;
    }
  }
