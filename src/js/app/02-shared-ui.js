  // =====================================================================
  // 2 nút cuộn qua TRÁI/PHẢI — tự động chèn cho MỌI khung có thanh cuộn ngang trong toàn app (menu
  // module, bảng trong panel/modal...). Dùng Map THƯỜNG (không phải WeakMap) để có thể DUYỆT QUA toàn
  // bộ danh sách và dọn dẹp đúng mọi cặp mồ côi mỗi lần quét — đây là điểm mấu chốt để tránh lỗi tích
  // tụ nút không bao giờ biến mất (đã từng xảy ra ở phiên bản trước, nay thiết kế lại cẩn thận hơn).
  // =====================================================================
  window.__hScrollButtonsMap = window.__hScrollButtonsMap || new Map();
  function removeHScrollPair(pair){
    if(pair.leftBtn && pair.leftBtn.parentNode) pair.leftBtn.remove();
    if(pair.rightBtn && pair.rightBtn.parentNode) pair.rightBtn.remove();
  }
  function updateHScrollButtonPosition(el, leftBtn, rightBtn){
    const rect = el.getBoundingClientRect();
    const y = rect.bottom - 25; // gần sát đáy khung (chỗ thanh cuộn ngang), trừ nửa chiều cao nút
    const margin = 8; // cách mép phải khung 1 khoảng nhỏ
    let rightBtnLeft = rect.right - margin - 38;
    let leftBtnLeft = rightBtnLeft - 6 - 38;
    // Đảm bảo cặp nút LUÔN nằm TRỌN VẸN bên trong khung chứa mà nó thuộc về — không tràn ra ngoài mép
    // trái nếu khung quá hẹp.
    if(leftBtnLeft < rect.left) leftBtnLeft = rect.left;
    leftBtn.style.top = y + 'px';
    leftBtn.style.left = leftBtnLeft + 'px';
    rightBtn.style.top = y + 'px';
    rightBtn.style.left = rightBtnLeft + 'px';
  }
  function wireHScrollBtnDir(btn, el, dir){
    if(btn.dataset.hscrollWired) return; // chống nối dây trùng lặp — nếu lỡ bị gọi 2 lần cho cùng 1 nút thì cũng không tạo ra nhiều interval chạy song song gây xung đột/giật
    btn.dataset.hscrollWired = '1';
    let scrollTimer = null;
    let downAt = 0;
    const startContinuous = ()=>{
      if(scrollTimer) return;
      scrollTimer = setInterval(()=>{ el.scrollLeft += dir*14; }, 16); // tăng mạnh tốc độ cuộn — đảm bảo rõ rệt, dễ cảm nhận
    };
    const stopContinuous = ()=>{ if(scrollTimer){ clearInterval(scrollTimer); scrollTimer=null; } };
    btn.addEventListener('mouseenter', startContinuous);
    btn.addEventListener('mouseleave', stopContinuous);
    btn.addEventListener('mousedown', (e)=>{ e.preventDefault(); downAt = Date.now(); startContinuous(); });
    btn.addEventListener('touchstart', ()=>{ downAt = Date.now(); startContinuous(); }, {passive:true});
    document.addEventListener('mouseup', stopContinuous);
    document.addEventListener('touchend', stopContinuous);
    btn.addEventListener('click', ()=>{
      // Chỉ cuộn thêm 1 đoạn ngắn khi đây là 1 cú BẤM NHANH (không phải vừa bấm-giữ xong, lúc đó cuộn
      // liên tục đã tự làm việc rồi, cộng thêm sẽ bị dư thừa/giật).
      if(Date.now() - downAt < 260){
        const chunk = Math.min(260, Math.max(80, el.clientWidth*0.6));
        el.scrollBy({ left: dir*chunk, behavior:'smooth' });
      }
    });
  }
  function createHScrollPair(el){
    const leftBtn = document.createElement('button');
    leftBtn.type = 'button'; leftBtn.className = 'hscroll-btn preview-allow'; leftBtn.title = 'Cuộn sang trái'; leftBtn.textContent = '◀';
    const rightBtn = document.createElement('button');
    rightBtn.type = 'button'; rightBtn.className = 'hscroll-btn preview-allow'; rightBtn.title = 'Cuộn sang phải'; rightBtn.textContent = '▶';
    // QUAN TRỌNG: lớp hiển thị (z-index) phải LINH HOẠT tuỳ theo khung cuộn này đang nằm ở đâu — nếu
    // đang nằm BÊN TRONG 1 modal (VD bảng rộng trong modal-body), phải đặt cặp nút NGAY SAU modal đó
    // trong DOM (cùng z-index với modal) — nhờ vậy nó luôn hiện ĐÚNG TRÊN modal chứa nó, nhưng khi có
    // modal MỚI mở ra sau (luôn được thêm vào SAU trong DOM), modal mới đó tự động đè lên trên, không
    // còn bị cặp nút "mắc kẹt" từ trước che khuất nữa. Nếu khung cuộn KHÔNG nằm trong modal nào (VD menu
    // module chính, bảng trong panel) thì gắn ở cuối body với lớp THẤP hơn hẳn modal, đảm bảo mọi modal
    // mở sau đều tự động nằm trên.
    const containingModal = el.closest('.modal-bg');
    if(containingModal){
      leftBtn.style.zIndex = '450'; rightBtn.style.zIndex = '450';
      containingModal.insertAdjacentElement('afterend', rightBtn);
      containingModal.insertAdjacentElement('afterend', leftBtn);
    } else {
      document.body.appendChild(leftBtn);
      document.body.appendChild(rightBtn);
    }
    updateHScrollButtonPosition(el, leftBtn, rightBtn);
    wireHScrollBtnDir(leftBtn, el, -1);
    wireHScrollBtnDir(rightBtn, el, 1);
    return { leftBtn, rightBtn };
  }
  function hasHOverflow(el){ return el.isConnected && el.scrollWidth > el.clientWidth + 2; }
  // Quét lại TOÀN BỘ các khung ứng viên (menu module, bảng trong panel/modal...) — chỉ những khung THỰC
  // SỰ có thanh cuộn ngang mới được chèn nút. QUAN TRỌNG: mỗi lần quét đều DUYỆT QUA HẾT mọi cặp nút
  // ĐANG CÓ (kể cả những cặp không nằm trong danh sách ứng viên lần này — VD phần tử gốc đã bị gỡ khỏi
  // trang do vẽ lại) để dọn dẹp đúng, tránh tuyệt đối khả năng tích tụ.
  function scanForHorizontalScrollables(){
    // Lớp AN TOÀN DỰ PHÒNG: nếu vì bất kỳ lý do gì mà số cặp nút vượt quá ngưỡng hợp lý (bình thường
    // không bao giờ có quá vài khung cuộn ngang cùng lúc trên 1 màn hình) — xoá sạch toàn bộ và bắt đầu
    // lại từ đầu ngay lập tức, đảm bảo TUYỆT ĐỐI không thể xảy ra lại tình trạng "một đống mũi tên".
    if(window.__hScrollButtonsMap.size > 15){
      window.__hScrollButtonsMap.forEach(pair=> removeHScrollPair(pair));
      window.__hScrollButtonsMap.clear();
      document.querySelectorAll('.hscroll-btn').forEach(el=> el.remove()); // quét dọn luôn phần dư thừa ngoài Map (nếu có)
    }
    const candidates = document.querySelectorAll('.sidebar, .modal-body, .table-wrap, .ai-sidebar, .ai-messages');
    candidates.forEach(el=>{
      const overflow = hasHOverflow(el);
      const pair = window.__hScrollButtonsMap.get(el);
      if(overflow){
        if(pair) updateHScrollButtonPosition(el, pair.leftBtn, pair.rightBtn);
        else window.__hScrollButtonsMap.set(el, createHScrollPair(el));
      } else if(pair){
        removeHScrollPair(pair);
        window.__hScrollButtonsMap.delete(el);
      }
    });
    // Dọn dẹp mọi cặp MỒ CÔI — phần tử gốc không còn nằm trong danh sách ứng viên quét được lần này
    // (đã bị gỡ khỏi trang/thay bằng phần tử mới do vẽ lại) hoặc không còn overflow nữa.
    window.__hScrollButtonsMap.forEach((pair, el)=>{
      if(!hasHOverflow(el)){
        removeHScrollPair(pair);
        window.__hScrollButtonsMap.delete(el);
      }
    });
  }
  if(!window.__hScrollObserverWired){
    window.__hScrollObserverWired = true;
    let hScrollScanTimer = null;
    const scheduleScan = ()=>{ if(hScrollScanTimer) return; hScrollScanTimer = setTimeout(()=>{ hScrollScanTimer=null; scanForHorizontalScrollables(); }, 150); };
    new MutationObserver(scheduleScan).observe(document.body, { childList:true, subtree:true });
    window.addEventListener('resize', scheduleScan);
    // Bắt sự kiện cuộn Ở GIAI ĐOẠN CAPTURE trên toàn document — vì sự kiện "scroll" của các khung con
    // KHÔNG lan (bubble) lên cha theo mặc định, chỉ có cách bắt ở capture mới nhận được MỌI lần cuộn
    // xảy ra bất kỳ đâu trong trang (kể cả cuộn dọc của modal cha làm khung con bên trong dịch chuyển
    // vị trí trên màn hình, cần định vị lại nút ngay).
    document.addEventListener('scroll', scheduleScan, true);
    setInterval(scanForHorizontalScrollables, 900); // quét định kỳ dự phòng — bắt các trường hợp thay đổi kích thước không qua DOM mutation/scroll/resize, ĐỒNG THỜI cũng là lớp an toàn dọn dẹp định kỳ dù có bỏ sót sự kiện nào
  }
  // Cuộn lên đầu/xuống cuối modal/overlay chứa phần tử được truyền vào — dùng chung cho MỌI nơi cần kích
  // hoạt cuộn TỪ XA (không phải bấm trực tiếp vào 2 nút mũi tên), VD: bấm vào khung chat, bấm gửi, rê
  // chuột vào 1 nút khác... Hỗ trợ cả modal thường (.modal-bg + .modal-body) lẫn overlay AI toàn màn
  // hình (.ai-overlay + .ai-messages).
  function scrollNearestModalToBottom(fromEl){
    const bg = fromEl && (fromEl.closest('.modal-bg') || fromEl.closest('.ai-overlay'));
    if(!bg) return;
    const inner = bg.querySelector('.modal-body') || bg.querySelector('.ai-messages');
    const targets = inner ? [bg, inner] : [bg];
    targets.forEach(t=> t.scrollTo({ top:t.scrollHeight, behavior:'smooth' }));
  }
  function scrollNearestModalToTop(fromEl){
    const bg = fromEl && (fromEl.closest('.modal-bg') || fromEl.closest('.ai-overlay'));
    if(!bg) return;
    const inner = bg.querySelector('.modal-body') || bg.querySelector('.ai-messages');
    const targets = inner ? [bg, inner] : [bg];
    targets.forEach(t=> t.scrollTo({ top:0, behavior:'smooth' }));
  }
  function ensureModalScrollButtons(bg){
    // Loại trừ popup chào mừng (welcome-popup-bg) — nội dung quá ngắn gọn, không cần cuộn, 2 nút này
    // hoàn toàn thừa thãi ở đây.
    if(bg.classList.contains('welcome-popup-bg')) return;
    // QUAN TRỌNG: kiểm tra THỰC TẾ 2 nút có còn tồn tại làm con trực tiếp của modal-bg này không — KHÔNG
    // dựa vào cờ "đã từng thêm 1 lần" nữa (lỗi thật đã xảy ra trước đây: rất nhiều modal trong app tự vẽ
    // lại nội dung bằng wrap.innerHTML=... — thao tác này XOÁ SẠCH mọi phần tử con hiện có, bao gồm cả 2
    // nút đã chèn, nhưng KHÔNG tạo ra modal-bg MỚI nên cờ cũ vẫn còn, khiến code nghĩ "đã thêm rồi" và
    // không chèn lại — 2 nút biến mất mỗi khi modal vẽ lại, VD bấm phóng to/thu nhỏ, chuyển xem/sửa...).
    if(bg.querySelector(':scope > .modal-scroll-btn[data-scroll-dir="up"]')) return;
    const getScrollTargets = ()=>{
      const inner = bg.querySelector('.modal-body');
      return inner ? [bg, inner] : [bg];
    };
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'modal-scroll-btn preview-allow';
    upBtn.dataset.scrollDir = 'up';
    upBtn.title = 'Cuộn lên đầu';
    upBtn.textContent = '▲';
    upBtn.style.top = '35vh';
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'modal-scroll-btn preview-allow';
    downBtn.dataset.scrollDir = 'down';
    downBtn.title = 'Cuộn xuống cuối';
    downBtn.textContent = '▼';
    downBtn.style.top = 'calc(35vh + 46px)';
    const scrollToTop = ()=> getScrollTargets().forEach(t=> t.scrollTo({ top:0, behavior:'smooth' }));
    const scrollToBottom = ()=> getScrollTargets().forEach(t=> t.scrollTo({ top:t.scrollHeight, behavior:'smooth' }));
    upBtn.addEventListener('click', scrollToTop);
    upBtn.addEventListener('mouseenter', scrollToTop);
    downBtn.addEventListener('click', scrollToBottom);
    downBtn.addEventListener('mouseenter', scrollToBottom);
    bg.appendChild(upBtn);
    bg.appendChild(downBtn);
    makeGroupDraggable([
      { el: upBtn, verticalProp: 'top' },
      { el: downBtn, verticalProp: 'top' },
    ]);
  }
  if(!window.__modalScrollBtnObserver){
    window.__modalScrollBtnObserver = new MutationObserver((mutList)=>{
      mutList.forEach(mut=>{
        // Trường hợp 1: modal-bg MỚI vừa được thêm vào trang lần đầu tiên.
        mut.addedNodes.forEach(node=>{
          if(node.nodeType!==1) return;
          if(node.classList && node.classList.contains('modal-bg')) ensureModalScrollButtons(node);
          if(node.querySelectorAll) node.querySelectorAll('.modal-bg').forEach(bg=> ensureModalScrollButtons(bg));
        });
        // Trường hợp 2: nội dung BÊN TRONG 1 modal-bg đã có từ trước bị thay đổi/vẽ lại (VD bấm nút
        // phóng to/thu nhỏ, chuyển xem/sửa...) — làm mất 2 nút đã chèn, cần chèn lại ngay.
        const target = mut.target;
        if(!target || target.nodeType!==1) return;
        const bg = target.classList && target.classList.contains('modal-bg') ? target : target.closest && target.closest('.modal-bg');
        if(bg) ensureModalScrollButtons(bg);
      });
    });
    window.__modalScrollBtnObserver.observe(document.body, { childList:true, subtree:true });
  }
  // Tự động cuộn tới đúng vị trí mục VỪA BẤM trong BẤT KỲ menu bộ lọc nào (mọi bộ lọc dùng chung class
  // ".sv-filter-item") — áp dụng ĐÚNG logic đã làm tốt ở bộ lọc "Phương án vay" cho TOÀN BỘ app, không
  // cần sửa tay từng nơi. Bắt ở giai đoạn CAPTURE (chạy trước handler riêng của từng nơi) để không bị
  // chặn mất bởi e.stopPropagation() mà hầu hết các handler checkbox hiện có đang gọi.
  if(!window.__svFilterItemScrollSetup){
    window.__svFilterItemScrollSetup = true;
    document.addEventListener('click', (e)=>{
      const item = e.target.closest('.sv-filter-item');
      if(!item) return;
      const panel = item.closest('.sv-filter-panel');
      if(!panel) return;
      const allItemsBefore = Array.from(panel.querySelectorAll('.sv-filter-item'));
      const clickedIdx = allItemsBefore.indexOf(item);
      if(clickedIdx<0) return;
      // Đợi vài khung hình để handler riêng của từng nơi (chạy SAU, ở giai đoạn target/bubble) kịp cập
      // nhật state + vẽ lại xong hẳn, rồi mới tìm đúng mục ở vị trí tương ứng trong panel MỚI để cuộn.
      requestAnimationFrame(()=> requestAnimationFrame(()=>{
        const newPanel = document.querySelector('.sv-filter-panel');
        if(!newPanel) return;
        const newItems = newPanel.querySelectorAll('.sv-filter-item');
        const target = newItems[clickedIdx];
        if(target) target.scrollIntoView({ block:'center', behavior:'auto' });
      }));
    }, true);
  }
  // ---------------------------------------------------------------------------------------------
  // QUY ĐỊNH CHUNG TOÀN APP: mọi nút / checkbox / lựa chọn (label chứa input) bên TRONG bất kỳ modal
  // nào (kể cả modal xây dựng trong TƯƠNG LAI, kể cả các BẢNG CON nằm sâu bên trong modal tự vẽ lại
  // HTML riêng, VD bảng chọn lãi suất gia hạn) — khi bấm vào, màn hình tự cuộn để phần tử đó nằm ở
  // GIỮA màn hình. TRỪ những nơi ĐÃ CÓ SẴN cơ chế cuộn riêng từ trước (liệt kê rõ trong danh sách loại
  // trừ bên dưới) — những chỗ đó GIỮ NGUYÊN, không đụng vào.
  // Cách hoạt động: bắt CAPTURE (chạy trước, không bị chặn bởi stopPropagation của handler riêng từng
  // nơi) — ghi nhớ TOẠ ĐỘ MÀN HÌNH của phần tử vừa bấm TRƯỚC khi vẽ lại. Sau khi vẽ lại: nếu phần tử CŨ
  // vẫn còn nguyên trong DOM thì cuộn thẳng nó; nếu đã bị THAY THẾ bởi DOM mới (bảng con tự vẽ lại HTML
  // — rất phổ biến trong các modal nhiều bước như gia hạn nợ, tất toán...) thì dùng ĐÚNG toạ độ màn
  // hình đã ghi nhớ để tìm ra phần tử MỚI đang nằm ở cùng vị trí đó mà cuộn tới — đảm bảo hoạt động
  // đúng dù bảng con có nằm sâu tới đâu.
  if(!window.__svModalGenericScrollSetup){
    window.__svModalGenericScrollSetup = true;
    document.addEventListener('click', (e)=>{
      const modal = e.target.closest('.modal');
      if(!modal) return;
      // CHỈ loại trừ .sv-filter-item khi nó THẬT SỰ nằm trong .sv-filter-panel (đúng đúng phạm vi mà
      // cơ chế cuộn riêng dành cho bộ lọc xử lý tới) — nhiều nơi khác trong app (VD lựa chọn phân bổ
      // trong modal Gia hạn nợ) dùng CHUNG class ".sv-filter-item" để có sẵn kiểu dáng đẹp, nhưng KHÔNG
      // nằm trong bộ lọc nào cả — nếu loại trừ mù quáng theo tên class sẽ khiến những nơi này bị "lọt
      // lưới", không được cuộn bởi BẤT KỲ cơ chế nào (không phải cơ chế bộ lọc, cũng bị quy định chung
      // này bỏ qua) — đây chính là lỗi trước đó.
      const inFilterPanel = e.target.closest('.sv-filter-item') && e.target.closest('.sv-filter-panel');
      if(inFilterPanel || e.target.closest('[data-vs-toggle], [data-vs-apply], [data-proj-menu-toggle], [data-svp], [data-narrow-action-toggle], #ext-rate-zero, #ext-rate-current, #ext-rate-custom, #ext-alloc-wardOnly, #ext-alloc-wardHamlet, #ext-alloc-allTiers')) return; // đã có cơ chế cuộn riêng, không đụng vào
      const el = e.target.closest('button, .btn, [role="button"], input[type="checkbox"], input[type="radio"], label');
      if(!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
      requestAnimationFrame(()=> requestAnimationFrame(()=>{
        let target = document.contains(el) ? el : document.elementFromPoint(cx, cy);
        if(target && typeof target.scrollIntoView==='function') target.scrollIntoView({ block:'center', behavior:'auto' });
      }));
    }, true);
  }
  // Dòng chữ cảnh báo màu đỏ khi đang thao tác với bảng chọn màu (input type="color") — CHỈ hiện ở
  // màn hình hẹp (điện thoại). Không thể chèn chữ này VÀO BÊN TRONG hộp thoại chọn màu của hệ điều
  // hành/trình duyệt (đó là giao diện gốc, ngoài tầm với của JS trang web) — nhưng hiện ngay TRÊN
  // trang web, ngay phía trên/cạnh ô màu đang thao tác, để người dùng vẫn thấy được (tuỳ thiết bị, 1
  // số hộp thoại chọn màu không che kín toàn màn hình).
  if(!window.__svColorInputWarningSetup){
    window.__svColorInputWarningSetup = true;
    function showColorInputWarning(inputEl){
      if(!isNarrowScreenForSidebar()) return;
      hideColorInputWarning();
      const warn = document.createElement('div');
      warn.id = '__svColorInputWarning';
      warn.textContent = 'Hãy kéo thanh giá trị trước, rồi kéo thanh độ bão hòa, và cuối cùng là kéo thanh màu sắc';
      warn.style.cssText = 'position:fixed; left:50%; top:12px; transform:translateX(-50%); z-index:9999; background:#b71c1c; color:#fff; font-weight:800; font-size:13px; padding:10px 16px; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,.35); max-width:92vw; text-align:center;';
      document.body.appendChild(warn);
    }
    function hideColorInputWarning(){
      const el = document.getElementById('__svColorInputWarning');
      if(el) el.remove();
    }
    document.addEventListener('focusin', (e)=>{ if(e.target && e.target.tagName==='INPUT' && e.target.type==='color') showColorInputWarning(e.target); });
    document.addEventListener('focusout', (e)=>{ if(e.target && e.target.tagName==='INPUT' && e.target.type==='color') hideColorInputWarning(); });
    document.addEventListener('change', (e)=>{ if(e.target && e.target.tagName==='INPUT' && e.target.type==='color') hideColorInputWarning(); });
  }
  // ".divider-lbl" (nhãn nhỏ màu vàng khaki dùng khắp app: "Người đóng / Người thu", "Thông tin nâng
  // cao"...) — tự động bọc riêng phần CHỮ vào 1 <span class="divider-lbl-text"> ngay khi nó vừa được
  // thêm vào trang, để CSS (nền tối, chữ trắng đậm, đổ bóng từng ký tự) chỉ bám sát đúng theo chữ,
  // không lan ra khoảng trống của cả dòng (dòng còn có đường kẻ ngang ::after đi kèm).
  if(!window.__dividerLblWrapObserver){
    function wrapDividerLblText(el){
      if(el.querySelector(':scope > .divider-lbl-text')) return; // đã bọc rồi, khỏi làm lại
      const span = document.createElement('span');
      span.className = 'divider-lbl-text';
      while(el.firstChild) span.appendChild(el.firstChild);
      el.appendChild(span);
    }
    window.__dividerLblWrapObserver = new MutationObserver((mutations)=>{
      mutations.forEach(m=>{
        m.addedNodes.forEach(node=>{
          if(node.nodeType!==1) return;
          if(node.classList && node.classList.contains('divider-lbl')) wrapDividerLblText(node);
          else if(node.querySelectorAll) node.querySelectorAll('.divider-lbl').forEach(wrapDividerLblText);
        });
      });
    });
    window.__dividerLblWrapObserver.observe(document.body, { childList:true, subtree:true });
  }
  // Hiệu ứng trượt panel-body CHỈ chạy khi người dùng chủ động bấm mở 1 panel cụ thể (nhẹ, mượt) —
  // KHÔNG chạy khi cả module vừa được tải lần đầu (khi đó có rất nhiều DOM nặng dựng cùng lúc, chạy
  // animation lúc này sẽ gây giật vì luồng chính đang bận dựng layout, không liên quan gì tới việc
  // animation có dùng transform/opacity hay không). CHỤP giá trị cờ 1 LẦN cho cả lượt render (không
  // reset giữa chừng) để không bị "tiêu thụ nhầm" bởi panel đầu tiên kiểm tra khi có nhiều panel-body
  // cùng xuất hiện trong 1 lượt vẽ.
  let __panelAnimSnapshot = false;
  function capturePanelAnimFlag(){ __panelAnimSnapshot = !!state._panelJustToggled; state._panelJustToggled = false; }
  function panelBodyAnimClass(){ return __panelAnimSnapshot ? 'pb-animate' : ''; }
  function markPanelJustToggled(){ state._panelJustToggled = true; }
  // Modal xem trước kiểu Excel dùng CHUNG cho việc bấm vào tiêu đề cột (Địa phương/Họ và tên/Tên
  // phương án) — cột A,B,C... và dòng 1,2,3... luôn cố định; có thể bật/tắt cố định thêm cột A (cột
  // đầu tiên). Ở màn hình hẹp, TỰ ĐỘNG không cho cố định cột nào cả (kể cả A,B,C../1,2,3...).
  function renderColumnHeaderExcelModal(title, sections, cols){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.style.padding = '0';
    wrap.style.alignItems = 'stretch';
    document.body.appendChild(wrap);
    let frozen = false; // "Cố định xem ở cột A"
    let zoomPct = 100; // Phóng to/thu nhỏ bảng — giới hạn 50%-200%
    let hasFlashedOnce = false; // đảm bảo hiệu ứng nhấp nháy nút zoom CHỈ chạy đúng 1 lần lúc vừa mở modal, không lặp lại mỗi khi vẽ lại (bấm zoom/cố định cột...)
    const ZOOM_MIN = 50, ZOOM_MAX = 200, ZOOM_STEP = 10;
    const onResize = ()=> render();
    const close = ()=>{ window.removeEventListener('resize', onResize); wrap.remove(); };
    function colLetter(i){ let s=''; i++; while(i>0){ const r=(i-1)%26; s=String.fromCharCode(65+r)+s; i=Math.floor((i-1)/26); } return s; }
    function render(){
      const narrow = isNarrowScreenForSidebar(); // tính LẠI mỗi lần vẽ — phản ứng đúng khi thu/phóng cửa sổ ngay trong lúc modal đang mở
      const rcStickyTop = narrow? '' : 'position:sticky; top:0;';
      const rcStickyTop2 = narrow? '' : 'position:sticky; top:29px;';
      const rcStickyLeft0 = narrow? '' : 'position:sticky; left:0;';
      const rcStickyLeftA = frozen? `position:sticky; left:${narrow?0:36}px;` : '';
      wrap.innerHTML = `
        <div class="modal" style="max-width:100vw; width:100vw; height:85vh; display:flex; flex-direction:column; border-radius:0;">
          <div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="modal-close" id="cep-close">✕</button></div>
          <div class="modal-body" style="flex:1; overflow:auto; padding:0;">
            <div style="zoom:${zoomPct}%;">
            ${sections.map(sec=>{
              const secCols = sec.cols || cols;
              return `
              <p style="font-weight:800; margin:14px 14px 6px;">${escapeHtml(sec.title)} (${sec.list.length})</p>
              <table style="border-collapse:collapse; width:max-content; margin:0 14px 20px;">
                <thead>
                  <tr>
                    <th style="${rcStickyTop} ${rcStickyLeft0} z-index:3; background:#c8e6c9; border:1px solid var(--line); min-width:36px;"></th>
                    ${secCols.map((c,i)=>`<th style="${rcStickyTop} z-index:2; background:${i===0?'#1565c0':'#c8e6c9'}; color:${i===0?'#fff':'inherit'}; border:1px solid var(--line); padding:6px 10px; text-align:center; ${i===0?rcStickyLeftA+' z-index:3;':''}">${colLetter(i)}</th>`).join('')}
                  </tr>
                  <tr>
                    <th style="${rcStickyTop2} ${rcStickyLeft0} z-index:3; background:#e8f5e9; border:1px solid var(--line);"></th>
                    ${secCols.map((c,i)=>`<th style="${rcStickyTop2} z-index:2; background:#e8f5e9; border:1px solid var(--line); padding:6px 10px; ${c.headerColor?'color:'+c.headerColor+';':''} ${i===0?rcStickyLeftA+' z-index:3;':''} ${svColStyleHeader(c)}">${htmlLabel(c.label)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${sec.list.length? sec.list.map((item,ri)=>`<tr>
                    <td style="${rcStickyLeft0} z-index:1; background:#e8f5e9; border:1px solid var(--line); padding:6px 10px; text-align:center; font-weight:700;">${ri+1}</td>
                    ${secCols.map((c,ci)=>`<td class="${ci>0&&c.align==='right'?'':''}" style="border:1px solid var(--line); padding:6px 10px; ${ci===0? rcStickyLeftA+' background:#f0f0f0; z-index:1;' : ''} ${svColStyle(c)}">${c.get(item)}</td>`).join('')}
                  </tr>`).join('') : `<tr><td colspan="${secCols.length+1}" style="padding:14px; text-align:center;">Không có dữ liệu.</td></tr>`}
                </tbody>
              </table>`;
            }).join('')}
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="cep-close2">Đóng bảng</button>
            <button type="button" class="btn btn-sm preview-allow" id="cep-freeze" style="background:${frozen?'#ff8f00':'#1565c0'}; color:#fff; font-weight:700;">${frozen?'Tắt cố định cột A':'Cố định xem ở cột A'}</button>
            <div style="display:flex; align-items:center; gap:6px;">
              <button type="button" class="btn btn-ghost btn-sm preview-allow ${hasFlashedOnce?'':'zoom-btn-flash'}" id="cep-zoom-out" ${zoomPct<=ZOOM_MIN?'disabled':''} title="Thu nhỏ">➖</button>
              <span style="font-weight:700; min-width:42px; text-align:center;">${zoomPct}%</span>
              <button type="button" class="btn btn-ghost btn-sm preview-allow ${hasFlashedOnce?'':'zoom-btn-flash'}" id="cep-zoom-in" ${zoomPct>=ZOOM_MAX?'disabled':''} title="Phóng to">➕</button>
            </div>
          </div>
        </div>`;
      hasFlashedOnce = true;
      wrap.querySelector('#cep-close').onclick = close;
      wrap.querySelector('#cep-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const freezeBtn = wrap.querySelector('#cep-freeze');
      if(freezeBtn) freezeBtn.onclick = ()=>{ frozen = !frozen; render(); };
      const zoomInBtn = wrap.querySelector('#cep-zoom-in');
      if(zoomInBtn) zoomInBtn.onclick = ()=>{ zoomPct = Math.min(ZOOM_MAX, zoomPct+ZOOM_STEP); render(); };
      const zoomOutBtn = wrap.querySelector('#cep-zoom-out');
      if(zoomOutBtn) zoomOutBtn.onclick = ()=>{ zoomPct = Math.max(ZOOM_MIN, zoomPct-ZOOM_STEP); render(); };
    }
    render();
    window.addEventListener('resize', onResize);
  }
  // Đổi trạng thái thu gọn/mở khung menu bằng cách sửa TRỰC TIẾP class trên các phần tử DOM ĐANG CÓ
  // SẴN (không gọi render() vẽ lại toàn bộ trang) — vì nếu vẽ lại toàn bộ, phần tử .sidebar bị XOÁ và
  // TẠO MỚI hoàn toàn, khiến trình duyệt không còn "trạng thái cũ" để nội suy chuyển động, hiệu ứng
  // CSS transition/animation sẽ mất tác dụng (nhảy tức thì thay vì trượt mượt).
  function applySidebarCollapsedVisual(collapsed){
    const sidebarEl = document.querySelector('.sidebar');
    const mainEl = document.querySelector('.main');
    const toggleEl = document.querySelector('.sidebar-toggle-btn');
    if(sidebarEl) sidebarEl.classList.toggle('collapsed', collapsed);
    if(mainEl) mainEl.classList.toggle('sidebar-collapsed', collapsed);
    if(toggleEl){
      toggleEl.classList.toggle('collapsed', collapsed);
      toggleEl.title = collapsed? 'Mở menu' : 'Thu gọn menu';
      toggleEl.textContent = collapsed? '▤' : '▥';
    }
  }
  // Vuốt PHẢI SANG TRÁI (chuột bấm giữ kéo, hoặc ngón tay trên màn hình cảm ứng) ở BẤT KỲ đâu trong
  // app -> tự ẩn khung menu bên trái (nếu đang hiện). Dùng Pointer Events để xử lý thống nhất cả
  // chuột lẫn cảm ứng bằng cùng 1 đoạn code.
  if(!window.__sidebarSwipeDelegated){
    window.__sidebarSwipeDelegated = true;
    let swipeStartX = null, swipeStartY = null, swipeTracking = false;
    function swipeStart(x,y){
      if(state.sidebarCollapsed || !isNarrowScreenForSidebar()) return;
      swipeStartX = x; swipeStartY = y; swipeTracking = true;
    }
    function swipeEnd(x,y){
      if(!swipeTracking || swipeStartX==null) { swipeTracking = false; return; }
      const dx = x - swipeStartX;
      const dy = y - swipeStartY;
      swipeTracking = false;
      // Vuốt sang TRÁI đủ xa (>=60px) và không quá chéo lên/xuống (tránh nhầm với cuộn dọc trang)
      if(isNarrowScreenForSidebar() && dx <= -60 && Math.abs(dy) < Math.abs(dx)*0.6 && !state.sidebarCollapsed){
        state.sidebarCollapsed = true;
        applySidebarCollapsedVisual(true);
      }
      swipeStartX = null; swipeStartY = null;
    }
    // Chuột (desktop, kể cả PC bị thu hẹp bề ngang) — dùng Pointer Events.
    document.addEventListener('pointerdown', (e)=>{ if(e.pointerType==='mouse') swipeStart(e.clientX, e.clientY); });
    document.addEventListener('pointerup', (e)=>{ if(e.pointerType==='mouse') swipeEnd(e.clientX, e.clientY); });
    document.addEventListener('pointercancel', ()=>{ swipeTracking = false; swipeStartX = null; swipeStartY = null; });
    // Cảm ứng thật (điện thoại/máy tính bảng) — dùng riêng Touch Events, KHÔNG dùng Pointer Events, vì
    // trên di động trình duyệt hay tự ý chuyển động chạm thành cử chỉ cuộn/pan gốc, khiến "pointerup"
    // không bắn ra đúng toạ độ (hoặc bị thay bằng "pointercancel"), làm cử chỉ vuốt không nhận được.
    document.addEventListener('touchstart', (e)=>{
      if(!e.touches || !e.touches.length) return;
      swipeStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive:true });
    document.addEventListener('touchend', (e)=>{
      if(!e.changedTouches || !e.changedTouches.length) return;
      swipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }, { passive:true });
    document.addEventListener('touchcancel', ()=>{ swipeTracking = false; swipeStartX = null; swipeStartY = null; });
  }
  if(!window.__sidebarAutoCollapseDelegated){
    window.__sidebarAutoCollapseDelegated = true;
    // Dùng CAPTURE PHASE (tham số thứ 3 = true): chặn sự kiện TRƯỚC KHI nó lan tới đúng nút/phần tử
    // bên trong module hiện hành — nếu không dùng capture, nút đó sẽ kịp chạy xong hành động của nó
    // trước khi khung menu bên trái kịp đóng lại (vì bubble phase luôn chạy SAU khi đã "chạm" tới đích).
    document.addEventListener('click', (e)=>{
      if(!isNarrowScreenForSidebar()) return;
      if(state.sidebarCollapsed) return;
      if(e.target.closest('.sidebar-toggle-btn')) return; // nút nổi tự xử lý riêng, tránh đóng/mở trùng
      if(e.target.closest('.sidebar')) return; // bấm bên trong khung menu (kể cả đổi module) -> giữ nguyên, không tự đóng
      if(e.target.closest('.modal-bg')) return; // bấm bên trong 1 bảng/popup (VD: bảng chào mừng tham quan) -> không tính là bấm vào module hiện hành
      if(e.target.closest('.ai-overlay')) return; // bấm bên trong 1 module overlay toàn màn hình (Chat AI/Ghi chú nhanh/Tuyên truyền/Chat với Mọi người) -> module đó tự quản lý hoàn toàn tương tác của riêng nó, không để cơ chế này can thiệp (tránh "nuốt" mất click đầu tiên nhắm vào nút của module, khiến phải bấm 2 lần mới có tác dụng)
      // Ngoại lệ: bấm vào 1 trong 3 nút nổi (Chat AI / Ghi chú nhanh / Chat với Mọi người) — KHÔNG đóng
      // khung menu bên trái (giữ nguyên trạng thái đang mở), chỉ mở module tương ứng lên — để khi thoát
      // module đó ra thì quay lại vẫn thấy khung menu bên trái y như trước khi bấm, chưa từng bị đóng.
      const fabHit = e.target.closest('.fab-chat, .fab-notes-btn, .fab-people-btn');
      if(fabHit){
        e.preventDefault();
        e.stopPropagation();
        if(fabHit.classList.contains('fab-chat')) openAiChat();
        else if(fabHit.classList.contains('fab-notes-btn')) openQuickNote();
        else if(fabHit.classList.contains('fab-people-btn')) openPeopleChat();
        return;
      }
      // Đang bấm vào module hiện hành trong khi khung menu còn mở -> CHẶN HẲN hành động của nút/phần
      // tử đó lại, module chỉ hoạt động bình thường trở lại sau khi khung menu đã đóng.
      e.preventDefault();
      e.stopPropagation();
      state.sidebarCollapsed = true;
      applySidebarCollapsedVisual(true);
    }, true);
  }

  function plainLabel(label){ return String(label==null?'':label).replace(/<br>/g, ' '); }
  // Tìm 1 người vay bằng ID ở BẤT KỲ ĐÂU — không chỉ trong state.borrowers (danh sách đang hoạt động),
  // mà còn trong Thùng rác (cả người bị xoá riêng lẻ, lẫn người nằm trong 1 gói phương án vay đã bị
  // xoá cả gói). Luôn trả về đúng thuộc tính "deleted:true" nếu tìm thấy trong Thùng rác, để các nơi
  // khác (khoá độc quyền chọn tên, khung thao tác bên phải...) nhận diện đúng.
  function findBorrowerAnywhere(id){
    const inActive = state.borrowers.find(x=>x.id===id);
    if(inActive) return inActive;
    for(const item of (state.trash||[])){
      if((item._kind||'borrower')==='borrower' && item.id===id) return { ...item, deleted:true };
      if((item._kind||'borrower')==='project' && item.borrowersSnapshot){
        const found = Object.values(item.borrowersSnapshot).find(x=>x.id===id);
        if(found) return { ...found, deleted:true, _trashProjectId:item.id };
      }
    }
    return null;
  }
  // "Họ và tên" người vay — hiệu ứng nhảy múa (phóng to 1.1 lần rồi nghỉ, tuần hoàn), hover phóng to
  // 1.3 lần, bấm vào thì GIỮ phóng to 1.3 lần + đổi màu xanh dương đậm + icon ✅ (bấm lại để trở về
  // ban đầu). Dùng CHUNG cho mọi bảng trong Sổ vay vốn — TRỪ panel "Danh sách Phương án vay đang hoạt
  // động" (đó là tên phương án, không phải tên người).
  // Cặp "2 nút ở 2 cột đầu tiên" trong các modal Tính tiền lãi/Tất toán/Gia hạn nợ — màn hình rộng
  // hiện tách riêng như cũ (không đổi gì), màn hình hẹp gộp lại thành đúng 1 nút "Chọn hành động" có
  // menu thả xuống chứa cả 2 nút gốc (màu sắc/hiệu ứng/logic bên trong y nguyên, chỉ gộp vỏ ngoài).
  function narrowActionPairHtml(uniqueId, btnAHtml, btnBHtml){
    return `<span class="wide-action-pair">${btnAHtml}</span>
      <span class="narrow-action-pair" style="position:relative;">
        <button type="button" class="ext-action-btn preview-allow" data-narrow-action-toggle="${uniqueId}">Chọn</button>
        <div class="narrow-action-menu" id="narrow-menu-${uniqueId}" style="display:none; position:absolute; top:100%; left:0; z-index:50; background:#fff; border:1px solid var(--line); border-radius:8px; box-shadow:var(--shadow); padding:6px; min-width:160px;">
          <button type="button" class="preview-allow narrow-action-menu-close-x" data-narrow-action-close="${uniqueId}" style="position:absolute; top:-10px; right:-10px; z-index:999; width:24px; height:24px; border-radius:50%; border:none; background:#b71c1c; color:#fff; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,.3);">✕</button>
          <div style="margin-bottom:4px;">${btnAHtml}</div>
          <div>${btnBHtml}</div>
        </div>
      </span>`;
  }
  // Uỷ quyền sự kiện DUY NHẤT cho việc bấm mở/đóng menu thả xuống "Chọn hành động" — hoạt động cả
  // sau khi bảng được vẽ lại nhiều lần.
  if(!window.__narrowActionToggleDelegated){
    window.__narrowActionToggleDelegated = true;
    document.addEventListener('click', (e)=>{
      const closeXBtn = e.target.closest('[data-narrow-action-close]');
      if(closeXBtn){
        const menu = document.getElementById('narrow-menu-'+closeXBtn.dataset.narrowActionClose);
        if(menu) menu.style.display = 'none';
        e.stopPropagation();
        return;
      }
      const toggleBtn = e.target.closest('[data-narrow-action-toggle]');
      if(toggleBtn){
        const menu = document.getElementById('narrow-menu-'+toggleBtn.dataset.narrowActionToggle);
        if(menu){
          const wasOpen = menu.style.display!=='none';
          document.querySelectorAll('.narrow-action-menu').forEach(m=> m.style.display='none');
          if(!wasOpen){
            if(window.innerWidth<=820){
              // Màn hình hẹp: CUỘN TRƯỚC cho nút "Chọn" nằm gần giữa màn hình, rồi MỚI định vị + hiện
              // menu ra theo đúng vị trí MỚI của nút sau khi đã cuộn xong — tránh menu bị lệch khỏi nút
              // (vì cơ chế cuộn chung của app cũng cuộn tới nút này CÙNG LÚC, nếu định vị trước rồi mới
              // cuộn sau thì menu sẽ đứng yên tại chỗ cũ trong khi nút đã di chuyển tới vị trí mới).
              toggleBtn.scrollIntoView({ block:'center', behavior:'auto' });
              requestAnimationFrame(()=> requestAnimationFrame(()=>{
                const rect = toggleBtn.getBoundingClientRect();
                menu.style.position = 'fixed';
                menu.style.top = (rect.bottom+4)+'px';
                menu.style.left = rect.left+'px';
                menu.style.display = 'block';
              }));
            } else {
              menu.style.position = 'absolute';
              menu.style.top = '100%';
              menu.style.left = '0';
              menu.style.display = 'block';
            }
          }
        }
        e.stopPropagation();
        return;
      }
      // Bấm ra ngoài -> tự đóng mọi menu đang mở (trừ khi đang bấm vào chính 1 nút hành động bên
      // trong menu đó — để menu tự đóng SAU KHI nút bên trong đã xử lý xong, không chặn mất click).
      if(!e.target.closest('.narrow-action-menu')){
        document.querySelectorAll('.narrow-action-menu').forEach(m=> m.style.display='none');
      }
    });
  }
  function dancingNameHtml(b, extraStyle){
    const selected = (state.selectedBorrowerNames||[]).includes(b.id);
    return `<span class="dancing-name preview-allow${selected?' name-selected':''}" data-bname-id="${b.id}" style="${extraStyle||''}">${selected?'✅ ':''}${escapeHtml(b.name)}</span>`;
  }
  // Uỷ quyền sự kiện DUY NHẤT trên toàn trang cho việc bấm vào tên người vay — không cần gắn riêng lẻ
  // ở từng bảng, luôn hoạt động kể cả sau khi bảng được vẽ lại.
  if(!window.__dancingNameDelegated){
    window.__dancingNameDelegated = true;
    document.addEventListener('click', (e)=>{
      const el = e.target.closest('.dancing-name');
      if(!el) return;
      const id = el.dataset.bnameId;
      if(!id) return;
      if(!state.selectedBorrowerNames) state.selectedBorrowerNames = [];
      const wasSelected = state.selectedBorrowerNames.includes(id);
      if(wasSelected){
        // Bỏ chọn bình thường — không ảnh hưởng gì thêm.
        state.selectedBorrowerNames = state.selectedBorrowerNames.filter(x=>x!==id);
      } else {
        // Đang CHỌN THÊM 1 người mới. Nếu người MỚI này thuộc Thùng rác, HOẶC đã có sẵn 1 người thuộc
        // Thùng rác trong danh sách đang chọn -> KHÔNG ĐƯỢC PHÉP có từ 2 người trở lên cùng lúc: bỏ hết
        // những người khác, chỉ giữ lại đúng người vừa mới chọn.
        const bClicked = findBorrowerAnywhere(id);
        const clickedIsTrash = !!(bClicked && bClicked.deleted);
        const hasTrashAlreadySelected = state.selectedBorrowerNames.some(sid=>{ const b=findBorrowerAnywhere(sid); return b && b.deleted; });
        state.selectedBorrowerNames = (clickedIsTrash || hasTrashAlreadySelected) ? [id] : state.selectedBorrowerNames.concat([id]);
      }
      // Cập nhật lại TOÀN BỘ các tên đang hiện trên trang (không chỉ tên vừa bấm) — vì có thể có tên
      // khác vừa bị tự động bỏ chọn theo quy tắc độc quyền Thùng rác ở trên.
      document.querySelectorAll('.dancing-name').forEach(nameEl=>{
        const nid = nameEl.dataset.bnameId;
        const nowSel = state.selectedBorrowerNames.includes(nid);
        nameEl.classList.toggle('name-selected', nowSel);
        const bFound = findBorrowerAnywhere(nid);
        const nameOnly = bFound? bFound.name : nameEl.textContent.replace(/^✅\s*/,'');
        nameEl.textContent = (nowSel?'✅ ':'') + nameOnly;
      });
      renderSelectedNamesSidePanel();
    });
  }
  if(!window.__dancingHeaderDelegated){
    window.__dancingHeaderDelegated = true;
    document.addEventListener('click', (e)=>{
      const el = e.target.closest('.dancing-header');
      if(!el) return;
      const scope = el.dataset.headerScope;
      if(scope==null) return;
      if(scope==='all'){
        // Bấm "Địa phương" ở bảng Thống kê chung -> hiện cả Thống kê chung + Quá hạn + Đang hoạt động (đúng như đang hiển thị)
        const ov = state._svOverdueListCache;
        const ac = state._svActiveListCache;
        const stats = state._svStatsCache;
        const cols = (ac&&ac.visibleCols) || (ov&&ov.visibleCols) || [];
        const sections = [];
        if(stats && stats.rows.length){
          const statsCols = [{ label:'Địa phương', get:r=> escapeHtml(r.label) }].concat(stats.restCols.map(c=>({ label: c.key==='principal'? 'Tổng dư nợ' : c.label, get:r=> borrowerAggregateCellValue(c.key, r.groupList, { nameOverride: r.label }) })));
          sections.push({ title:'📊 Thống kê chung', list: stats.rows, cols: statsCols });
        }
        if(ov && ov.overdueList.length) sections.push({ title:'⚠️ Danh sách khoản vay đến hạn nhưng chưa được xử lý', list: ov.overdueList });
        if(ac && ac.list.length){
          const grouped = {};
          ac.list.forEach(b=>{ const key=(b.projectId && state.loanProjects.some(p=>p.id===b.projectId))? b.projectId : '__none__'; (grouped[key]=grouped[key]||[]).push(b); });
          const order = sortedActiveProjects(state.loanProjects||[]).map(p=>p.id).filter(pid=>grouped[pid]);
          if(grouped['__none__']) order.push('__none__');
          order.forEach(gid=>{
            const proj = state.loanProjects.find(p=>p.id===gid);
            sections.push({ title: '📋 '+(proj? proj.name : '(Không rõ phương án)'), list: sortedBorrowerGroup(grouped[gid], gid) });
          });
        }
        renderColumnHeaderExcelModal('👥 Danh sách Khoản vay đang hoạt động', sections, cols.map(c=>({...c, get:c.get})));
      } else if(scope.startsWith('riskdebt:') || scope.startsWith('settled:') || scope==='trash:individual' || scope==='projects' || scope==='explist' || scope==='expcompare'){
        // Các nhánh xử lý riêng bên dưới sẽ chặn lại bằng if-else tiếp theo — nhánh này chỉ để BỎ QUA nhánh mặc định (nhóm khoản vay đang hoạt động) phía dưới.
      } else {
        // Bấm "Họ và tên" ở 1 nhóm cụ thể -> chỉ hiện đúng nhóm đó
        const ac = state._svActiveListCache;
        if(!ac) return;
        const groupList = ac.list.filter(b=> (b.projectId && state.loanProjects.some(p=>p.id===b.projectId)? b.projectId : '__none__') === scope);
        const proj = state.loanProjects.find(p=>p.id===scope);
        renderColumnHeaderExcelModal('👥 Danh sách Khoản vay đang hoạt động', [{ title:'📋 '+(proj? proj.name : '(Không rõ phương án)'), list: sortedBorrowerGroup(groupList, scope) }], (ac.visibleCols||[]).map(c=>({...c, get:c.get})));
      }
      if(scope.startsWith('riskdebt:')){
        const [, kind, gid] = scope.split(':');
        const cache = state._svRiskDebtCache && state._svRiskDebtCache[kind];
        if(!cache) return;
        const isConfirmedList = cache.isConfirmedList;
        const groupList = cache.list.filter(b=> (b.projectId && state.loanProjects.some(p=>p.id===b.projectId)? b.projectId : '__none__') === gid);
        const proj = state.loanProjects.find(p=>p.id===gid);
        const cols = [
          { align:'right', label:'Số tiền gốc (đ)', get:b=>moneySpaced(b.principal) },
          { key:'dueDate', label:'Ngày đến hạn', get:b=>fmtDate(b.dueDate) },
          { label:'Ngày gia hạn gần nhất', get:b=>{ const e=latestBorrowerExtension(b.id); return e? fmtDate(e.to) : ''; } },
          { align:'center', label:'Số lần gia hạn', get:b=> getBorrowerExtensions(b.id).length },
        ];
        if(isConfirmedList) cols.push({ key:'dueDate', label:'Ngày xác nhận Nợ rủi ro', get:b=>fmtDate(b.riskDebtDate) }, { userInput:true, label:'Lý do', get:b=>escapeHtml(b.riskDebtReason||'') });
        renderColumnHeaderExcelModal('⚠️ Danh sách khoản vay Nợ rủi ro', [{ title:'📋 '+(proj? proj.name : '(Không rõ phương án)'), list: sortedBorrowerGroup(groupList, gid) }], cols);
      } else if(scope.startsWith('settled:')){
        const gid = scope.split(':')[1];
        const cache = state._svSettledCache;
        if(!cache) return;
        const groupList = cache.allSettled.filter(b=> (b.projectId && state.loanProjects.some(p=>p.id===b.projectId)? b.projectId : '__none__') === gid);
        const proj = state.loanProjects.find(p=>p.id===gid);
        const cols = [
          { label:'Loại', get:b=> b.settledViaRiskDebt? 'Tất toán (hết nợ rủi ro)' : (b.settledType==='final'? 'Tất toán khoản vay' : 'Trả nợ trước hạn') },
          { align:'right', label:'Số tiền gốc (đ)', get:b=>moneySpaced(b.principal) },
          { key:'dueDate', label:'Ngày tất toán / trả nợ', get:b=>fmtDate((b.settledAt||'').slice(0,10)) },
          { align:'right', label:'Tiền lãi còn nợ (nếu có) (đ)', get:b=>{ const s=computeInterestPaymentBoxDisplay(b).unpaidTotal; return s>0? moneySpaced(s) : '—'; } },
          { userInput:true, label:'Người thừa kế', get:b=> escapeHtml((state.borrowers.find(x=>x.isHeir && x.heirOfBorrowerId===b.id)||{}).name || b.heirName || '') },
        ];
        renderColumnHeaderExcelModal('✅ Danh sách đã Tất toán khoản vay hoặc Trả nợ trước hạn', [{ title:'📋 '+(proj? proj.name : '(Không rõ phương án)'), list: groupList }], cols);
      } else if(scope==='trash:individual'){
        const cache = state._svTrashCache;
        if(!cache) return;
        const cols = [
          { key:'project', userInput:true, label:'Thuộc phương án', get:b=>{ const p=state.loanProjects.find(x=>x.id===b.projectId); return escapeHtml(p? p.name : ''); } },
          { key:'hamlet', userInput:true, label:subAdminLabel(), get:b=> escapeHtml(b.hamlet||'') },
          { align:'right', label:'Số tiền gốc (đ)', get:b=> moneySpaced(b.principal) },
          { userInput:true, label:'Xoá bởi', get:b=> escapeHtml(b.deletedByName||b.deletedBy||'') },
        ];
        renderColumnHeaderExcelModal('🗑️ Thùng rác (Sổ vay vốn) — Người vay bị xoá riêng lẻ', [{ title:'Người vay bị xoá riêng lẻ', list: cache.borrowerItems }], cols);
      } else if(scope==='projects'){
        const cache = state._svProjectsCache;
        if(!cache) return;
        const cols = [
          { key:'project', label:'Tên phương án', userInput:true, get:p=> escapeHtml(p.name) },
          { align:'right', label:'Tổng vốn (đ)', get:p=> moneySpaced(p.totalCapital) },
          { align:'center', label:'Hộ tham gia', get:p=> String(projectParticipantCount(p.id)) },
          { align:'right', label:'Đã cho vay (đ)', get:p=> moneySpaced(projectDisbursedTotal(p.id)) },
          { label:'Lãi suất %', width:96, get:p=> (p.interestRate||0)+'%/năm' },
          { key:'loanDate', label:'Ngày vay', get:p=> fmtDate(p.disburseDate) },
          { key:'dueDate', label:'Đến hạn', get:p=> fmtDate(p.dueDate) },
          { label:'Nguồn vay', width:140, get:p=> escapeHtml(p.fundSourceType||'') },
          { align:'right', label:'Phân bổ Cấp Trung ương (%)', width:110, get:p=> String(parseFloat(p.splitCentral)||0).replace('.',',')+'%' },
          { align:'right', label:'Phân bổ Cấp Tỉnh (%)', width:100, get:p=> String(parseFloat(p.splitProvince)||0).replace('.',',')+'%' },
          { align:'right', label:'Phân bổ Cấp Xã (%)', width:100, get:p=> String(parseFloat(p.splitWard)||0).replace('.',',')+'%' },
          { align:'right', label:`% Xã phân bổ về ${subAdminLabelLower()}`, width:120, get:p=> String(parseFloat(p.hamletAllocPercent)||0).replace('.',',')+'%' },
          { key:'daysRemaining', label:'Thời gian còn lại', get:p=> daysRemainingLabel(p.dueDate) },
          { align:'right', label:'Số tiền còn lại không hoạt động (đ)', width:140, get:p=> moneySpaced(projectInactiveAmountRaw(p)) },
        ];
        renderColumnHeaderExcelModal('📋 Danh sách Phương án vay đang hoạt động', [{ title:'Danh sách Phương án vay', list: cache.activeProjectsOnly }], cols);
      } else if(scope==='explist'){
        const list = state.expenses.filter(e=>!e.deleted).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
        const cols = [
          { key:'date', label:'Ngày chi', userInput:true, get:e=> fmtDate(e.date) },
          { label:'Nội dung / Mục đích', get:e=> escapeHtml(e.purpose===CAT_OTHER? `${categoryLabel(CAT_OTHER)}: ${e.purposeOther||''}` : categoryLabel(e.purpose)) },
          { label:`Địa bàn (${subAdminLabel()})`, get:e=> escapeHtml(isCatHamlet(e.purpose)? (e.hamlet||'—') : '—') },
          { label:'Quý áp dụng', get:e=> (Array.isArray(e.quarters) && e.quarters.length)? e.quarters.map(q=>`${q.qk.toUpperCase()}/${q.year}`).join(', ') : '—' },
          { label:'Cách tính', get:e=> isCatHamlet(e.purpose)? (e.amountMode==='auto'?'Tự động theo công thức':'Nhập cụ thể') : '—' },
          { align:'right', label:'Số tiền (đ)', get:e=> moneySpaced(e.amount) },
          { label:'Ghi chú', get:e=> e.note? wrapTextAtSpacesHtml(e.note,28) : '—' },
        ];
        renderColumnHeaderExcelModal('💰 Danh sách khoản chi', [{ title:'Danh sách khoản chi', list, cols }], cols);
      } else if(scope==='expcompare'){
        const rows = computeHamletQuarterReconciliation();
        const cols = [
          { key:'hamlet', label:'Địa bàn', userInput:true, get:r=> escapeHtml(r.hamlet) },
          { align:'right', label:'Tổng chênh lệch (đ)', get:r=> r.totalDiff===0? 'Khớp' : (r.totalDiff>0? `Dư ${moneySpaced(r.totalDiff)}` : `Thiếu ${moneySpaced(-r.totalDiff)}`) },
          { label:'Ghi chú (chi tiết từng Quý)', get:r=>{
            const lines = [...r.deficitLines, ...r.surplusLines];
            return lines.length? lines.map(escapeHtml).join('<br>') : '—';
          } },
          { label:'Quý bị Trùng lặp (Chi nhiều lần)', get:r=> r.dupDetails.length? r.dupDetails.map(d=>`${d.label} (${d.times} lần)`).join(', ') : '—' },
        ];
        renderColumnHeaderExcelModal(`⚖️ Đối chiếu "Trích về ${subAdminLabelLower()}": Thực tế vs. Tự động`, [{ title:'Đối chiếu theo địa bàn (toàn bộ thời gian)', list: rows, cols }], cols);
      }
    });
  }
  if(!window.__dancingProjectNameDelegated){
    window.__dancingProjectNameDelegated = true;
    document.addEventListener('click', (e)=>{
      const el = e.target.closest('.dancing-project-name');
      if(!el) return;
      if(el.dataset.hamletStatRow!=null){
        const hamlets = state.config.hamlets||[];
        const wardRow = computeHamletRowDetailCols(null);
        wardRow.__isWard = true;
        const hamletRows = hamlets.map(h=> computeHamletRowDetailCols(h));
        const allRows = [wardRow, ...hamletRows];
        // Bọc màu tím đậm cho TOÀN BỘ các cột (không chỉ cột A) ở đúng dòng xã/phường.
        const wp = (r,val)=> r.__isWard? `<b style="color:#6a1b9a;">${val}</b>` : val;
        // Màu tiêu đề CỘT — mỗi NHÓM chủng loại 1 màu riêng, để dễ phân biệt giữa hàng chục cột:
        // đen (tổng quan chung) / xanh lá (liên quan tiền lãi) / xanh dương (tình trạng hạn - tất
        // toán) / cam (nợ rủi ro) / tím (đã tất toán xong).
        const COL_GENERAL = '#3e2723', COL_INTEREST = '#1b5e20', COL_DUE = '#0d47a1', COL_RISK = '#e65100', COL_SETTLED = '#6a1b9a', COL_PAID = '#00838f';
        const cols = [
          { label:'Địa phương', get:r=> wp(r, escapeHtml(r.hamletLabel)), headerColor: COL_GENERAL },
          { label:'Số Hộ vay<br>đang hoạt động', get:r=> wp(r, r.B), headerColor: COL_GENERAL },
          { align:'right', label:'Tổng dư nợ', get:r=> wp(r, moneySpaced(r.C)), headerColor: COL_GENERAL },
          { label:'Hộ đã đóng lãi<br>(Quý hiện tại)', get:r=> wp(r, r.D), headerColor: COL_INTEREST },
          { label:'Hộ chưa đóng lãi<br>(Quý hiện tại)', get:r=> wp(r, r.E), headerColor: COL_INTEREST },
          { align:'right', label:'Tiền lãi chưa đóng<br>(Quý hiện tại)', get:r=> wp(r, moneySpaced(r.F)), headerColor: COL_INTEREST },
          { label:'Hộ chưa đóng lãi<br>(quá khứ đến hiện tại)', get:r=> wp(r, r.G), headerColor: COL_INTEREST },
          { align:'right', label:'Tiền lãi chưa đóng<br>(quá khứ đến hiện tại)', get:r=> wp(r, moneySpaced(r.H)), headerColor: COL_INTEREST },
          { align:'right', label:`Tiền lãi đã đóng<br>${wardRow.qLabelN} (hiện tại)`, get:r=> wp(r, moneySpaced(r.H1)), headerColor: COL_PAID },
          { align:'right', label:`Tiền lãi đã đóng<br>${wardRow.qLabelN1} (quý trước)`, get:r=> wp(r, moneySpaced(r.H2)), headerColor: COL_PAID },
          { align:'right', label:`Tiền lãi đã đóng<br>${wardRow.qLabelN2} (trước nữa)`, get:r=> wp(r, moneySpaced(r.H3)), headerColor: COL_PAID },
          { align:'right', label:`Tiền lãi đã đóng<br>${wardRow.qLabelN3} (trước nữa)`, get:r=> wp(r, moneySpaced(r.H4)), headerColor: COL_PAID },
          { align:'right', label:`Tiền lãi đã đóng<br>Năm ${wardRow.yearN} (Hiện tại)`, get:r=> wp(r, moneySpaced(r.Y1)), headerColor: COL_PAID },
          { align:'right', label:`Tiền lãi đã đóng<br>Năm ${wardRow.yearN1} (Năm ngoái)`, get:r=> wp(r, moneySpaced(r.Y2)), headerColor: COL_PAID },
          { label:'Hộ trong hạn', get:r=> wp(r, r.I), headerColor: COL_DUE },
          { label:'Gần đến hạn<br>≤60 ngày', get:r=> wp(r, r.J), headerColor: COL_DUE },
          { label:'Hộ quá hạn', get:r=> wp(r, r.K), headerColor: COL_DUE },
          { label:'Hộ được<br>gia hạn', get:r=> wp(r, r.L), headerColor: COL_DUE },
          { label:'Số hộ nợ rủi ro<br>đang xử lý', get:r=> wp(r, r.M), headerColor: COL_RISK },
          { label:'Số hộ Không<br>thể trả nợ', get:r=> wp(r, r.N), headerColor: COL_RISK },
          { label:'Số hộ đã tất toán/<br>TNTH xong', get:r=> wp(r, r.O), headerColor: COL_SETTLED },
          { label:'Tổng Số hộ<br>từ trước tới nay', get:r=> wp(r, r.P), headerColor: COL_GENERAL },
        ];
        renderColumnHeaderExcelModal('📊 Thống kê chi tiết theo Địa phương', [{ title:'Thống kê chi tiết', list: allRows }], cols);
        return;
      }
      const pid = el.dataset.projectId;
      const proj = state.loanProjects.find(p=>p.id===pid);
      if(proj) renderLoanProjectModal(proj, null, true);
    });
  }
  // Khung thao tác trượt từ bên phải — chỉ hiện khi có ít nhất 1 người đang được chọn (Họ và tên
  // phóng to). Các nút bên trong LIÊN KẾT trực tiếp với đúng các modal Tính tiền lãi/Tất toán/Gia
  // hạn nợ/Nợ rủi ro/Kho lưu trữ đã có sẵn. Từ 2 người trở lên: chỉ "Đóng tiền lãi" và "Tất toán
  // khoản vay" còn hoạt động được (chuyển sang lập BIÊN LAI CHUNG) — và CHỈ khi tất cả cùng 1 Phương
  // án vay (điều kiện bắt buộc của biên lai chung); các nút còn lại (vốn chỉ có bản dành cho 1 người)
  // sẽ tự khoá lại.
  function renderSelectedNamesSidePanel(){
    const existing = document.getElementById('__selectedNamesSidePanel');
    if(existing) existing.remove();
    const ids = state.selectedBorrowerNames||[];
    if(!ids.length) return;
    const borrowers = ids.map(id=> findBorrowerAnywhere(id)).filter(Boolean);
    if(!borrowers.length) return;
    const isMulti = borrowers.length>1;
    const sameProject = borrowers[0].projectId && borrowers.every(b=> b.projectId===borrowers[0].projectId);
    const singleB = borrowers[0];
    const el = document.createElement('div');
    el.id = '__selectedNamesSidePanel';
    el.style.cssText = 'position:fixed; top:20px; right:0; z-index:420; background:#eef3fb; border:2px solid #0d47a1; border-right:none; border-radius:10px 0 0 10px; box-shadow:-4px 0 16px rgba(0,0,0,.22); width:210px; max-height:98vh; overflow:auto; padding:14px; animation: sideSlideIn .44s ease-out;';
    // Người đang chọn thuộc Thùng rác (đã bị xoá) — nhờ khoá độc quyền ở nơi bấm chọn, chắc chắn chỉ
    // có ĐÚNG 1 người trong trường hợp này -> hiện riêng đúng bộ 4 nút dành cho Thùng rác.
    if(singleB.deleted){
      el.innerHTML = `
        <b style="font-size:13px; color:#0d47a1; display:block; margin-bottom:10px;">Đang chọn: ${escapeHtml(singleB.name)} (trong Thùng rác)</b>
        <button type="button" class="ext-action-btn preview-allow" style="text-align:left; width:100%; margin-bottom:6px; display:block;" data-side-action="Thông tin Chi tiết">🔍 Thông tin chi tiết</button>
        <button type="button" class="ext-action-btn ext-green preview-allow" style="text-align:left; width:100%; margin-bottom:6px; display:block;" data-side-action="Khôi phục">↩ Khôi phục</button>
        ${isOwner()? `<button type="button" class="ext-action-btn ext-red-light preview-allow" style="text-align:left; width:100%; margin-bottom:6px; display:block;" data-side-action="Xoá vĩnh viễn">🗑️ Xoá vĩnh viễn</button>` : ''}
        <div style="border-top:1px solid var(--line); margin:8px 0;"></div>
        <button type="button" class="btn btn-sm preview-allow" style="text-align:left; width:100%; color:#b71c1c; font-weight:800;" data-side-action="Đóng bảng">Đóng bảng</button>`;
      document.body.appendChild(el);
      const clearSelection = ()=>{
        state.selectedBorrowerNames = [];
        document.querySelectorAll('.dancing-name.name-selected').forEach(nameEl=>{
          nameEl.classList.remove('name-selected');
          nameEl.textContent = nameEl.textContent.replace(/^✅\s*/,'');
        });
      };
      el.querySelectorAll('[data-side-action]').forEach(btn=>{
        btn.onclick = async ()=>{
          const action = btn.dataset.sideAction;
          if(action==='Đóng bảng'){ clearSelection(); renderSelectedNamesSidePanel(); return; }
          if(action==='Thông tin Chi tiết'){
            try{
              state.modal = { type:'borrower', payload: {...singleB}, forceReadOnly:true };
              render();
            }catch(err){
              console.error('Lỗi khi mở Thông tin chi tiết (Thùng rác):', err);
              alert('Có lỗi khi mở Thông tin chi tiết: '+(err&&err.message||err));
            }
            return;
          }
          if(action==='Khôi phục'){
            if(await restoreStandaloneBorrower(singleB.id)){ clearSelection(); render(); }
            return;
          }
          if(action==='Xoá vĩnh viễn'){
            if(await purgeStandaloneBorrowerForever(singleB.id)){ clearSelection(); render(); }
            return;
          }
        };
      });
      return;
    }
    function btnHtml(label, enabled, colorClass){
      return `<button type="button" class="ext-action-btn ${colorClass||''} preview-allow" ${enabled?'':'disabled'} style="text-align:left; width:100%; margin-bottom:6px; display:block; ${enabled?'':'opacity:.45; cursor:not-allowed; background:#ddd; color:#888; animation:none;'}" data-side-action="${label}">${label}</button>`;
    }
    // Các điều kiện dưới đây COPY Y HỆT từ 3 modal gốc "Tất toán khoản vay/Trả nợ trước hạn"/"Gia hạn
    // nợ"/"Nợ rủi ro" — CHỈ BỔ SUNG thêm vào điều kiện !isMulti đã có sẵn, không cắt/sửa gì cả.
    const sExts = !isMulti ? getBorrowerExtensions(singleB.id) : [];
    const sInExt = sExts.length>0;
    const sDueRef = sExts.length? sExts[sExts.length-1].to : singleB.dueDate;
    const sDLeft = !isMulti ? daysRemainingUntil(sDueRef) : null;
    const sCanEarlyRepay = !sInExt && !singleB.isHeir && (sDLeft==null || sDLeft>29);
    const sCanSettleFinal = sInExt || (sDLeft!=null && sDLeft<=60);
    const sMaxedOut = sExts.length>=MAX_LOAN_EXTENSIONS;
    const sLatestExt = sExts.length? sExts[sExts.length-1] : null;
    const sDaysToLatestExtEnd = sLatestExt? daysRemainingUntil(sLatestExt.to) : null;
    const sTooEarlyForNextExt = sExts.length>0 && sDaysToLatestExtEnd!=null && sDaysToLatestExtEnd>15;
    const sCanExtend = !sMaxedOut && !sTooEarlyForNextExt;
    const sHasExtHistory = sExts.length>0;
    const sHasRiskDebtHistory = !!(singleB && singleB.riskDebtConfirmedAt);
    const sHasBadDebtHistory = !!(singleB && singleB.badDebtDate);
    // Chỉ đủ điều kiện xác nhận Nợ rủi ro khi: đã từng được gia hạn (bất kể lần nào), HOẶC gần đến hạn
    // ≤60 ngày (kể cả đã quá hạn) — dùng ĐÚNG hàm dùng chung sẵn có, khớp tuyệt đối với modal gốc.
    const sEligibleForRiskDebt = !isMulti && borrowerEligibleForActionList(singleB) && !singleB.riskDebt;
    el.innerHTML = `
      <button type="button" class="preview-allow" ${isMulti?'disabled':''} style="width:100%; margin-bottom:10px; padding:10px 12px; background:#fff; border:2px solid #0d47a1; border-radius:8px; color:#0d47a1; font-weight:800; cursor:pointer; ${isMulti?'opacity:.45; cursor:not-allowed;':''}" data-side-action="Thông tin Chi tiết">🔍 Thông tin Chi tiết</button>
      <b style="font-size:13px; color:#0d47a1; display:block; margin-bottom:10px;">Đang chọn ${borrowers.length} hộ vay</b>
      ${btnHtml('Xem Thông tin đóng lãi', !isMulti, 'ext-green')}
      ${btnHtml('Đóng tiền lãi', !isMulti || sameProject, 'ext-green')}
      ${btnHtml('Trả nợ trước hạn', (!isMulti) && sCanEarlyRepay, 'ext-blue2')}
      ${btnHtml('Tất toán khoản vay', (!isMulti || sameProject) && (isMulti || sCanSettleFinal), 'ext-blue2')}
      ${btnHtml('Mở Hộp Biên lai', !isMulti, 'ext-purple')}
      ${btnHtml('Mở Hộp Giấy xác nhận', !isMulti, 'ext-purple')}
      ${btnHtml('Xem lịch sử gia hạn', !isMulti && sHasExtHistory, '')}
      ${btnHtml('GIA HẠN nợ', (!isMulti) && sCanExtend, '')}
      ${btnHtml('Xác nhận nợ rủi ro', sEligibleForRiskDebt, 'ext-red-light')}
      ${btnHtml('Xem Lịch sử nợ rủi ro', !isMulti && sHasRiskDebtHistory, 'ext-red-light')}
      ${btnHtml('Xem Lịch sử nợ xấu', !isMulti && sHasBadDebtHistory, 'ext-red-light')}
      <div style="border-top:1px solid var(--line); margin:8px 0;"></div>
      <button type="button" class="btn btn-sm preview-allow" style="text-align:left; width:100%; color:#b71c1c; font-weight:800;" data-side-action="Đóng bảng">Đóng bảng</button>`;
    document.body.appendChild(el);
    el.querySelectorAll('[data-side-action]').forEach(btn=>{
      btn.onclick = ()=>{
        const action = btn.dataset.sideAction;
        if(action==='Đóng bảng'){
          state.selectedBorrowerNames = [];
          document.querySelectorAll('.dancing-name.name-selected').forEach(nameEl=>{
            nameEl.classList.remove('name-selected');
            nameEl.textContent = nameEl.textContent.replace(/^✅\s*/,'');
          });
          renderSelectedNamesSidePanel();
          return;
        }
        if(isMulti){
          if(action==='Đóng tiền lãi') renderSharedInterestPaymentSelectModal(singleB.projectId, borrowers);
          else if(action==='Tất toán khoản vay') renderSharedFinalSettlementModal(singleB.projectId, borrowers);
          return;
        }
        if(action==='Thông tin Chi tiết'){ state.modal = {type:'borrower', payload: singleB, forceReadOnly: true}; render(); return; }
        if(action==='Xem Thông tin đóng lãi') renderInterestPaymentHistoryModal(singleB);
        else if(action==='Đóng tiền lãi') renderInterestPaymentApprovalModal(singleB);
        else if(action==='Trả nợ trước hạn') renderEarlyRepaymentModal(singleB);
        else if(action==='Tất toán khoản vay') renderFinalSettlementModal(singleB);
        else if(action==='Mở Hộp Biên lai') renderReceiptBoxModal(singleB);
        else if(action==='Mở Hộp Giấy xác nhận') renderConfirmationBoxModal(singleB);
        else if(action==='Xem lịch sử gia hạn') renderExtensionHistoryModal(singleB);
        else if(action==='GIA HẠN nợ') renderExtensionModal();
        else if(action==='Xác nhận nợ rủi ro') renderRiskDebtConfirmModal(singleB);
        else if(action==='Xem Lịch sử nợ rủi ro') renderRiskDebtHistoryModal(singleB);
        else if(action==='Xem Lịch sử nợ xấu') renderBadDebtHistoryModal(singleB);
      };
    });
  }

  // ---------------------------------------------------------------------
  // Ép nhập liệu số tiền/phần trăm/CCCD/SĐT cho Sổ vay vốn — theo đúng yêu cầu nghiệp vụ:
  //   • Số TIỀN (tổng vốn phương án, số tiền vay, tiền lãi/gốc đã đóng): CHỈ cho gõ chữ số (không
  //     cho dấu phẩy hay ký tự khác), TỰ ĐỘNG tách cụm 3 chữ số bằng 1 khoảng trắng NGAY TRONG LÚC
  //     gõ, tính từ PHẢI qua TRÁI (vd: gõ 87230934500 -> hiện "87 230 934 500"), tối đa 12 ký tự số.
  //   • % / LÃI SUẤT: CHỈ cho gõ chữ số và đúng 1 dấu phẩy (,) làm phần thập phân.
  //   • CCCD: chỉ chữ số, tối đa 13 ký tự, tách cụm 4 số/nhóm từ phải qua trái.
  //   • SĐT: chỉ chữ số và dấu +, tối đa 12 ký tự, tách cụm 3 số/nhóm từ phải qua trái.
  // ---------------------------------------------------------------------
  function groupDigitsRight(digits, clusterSize){
    if(!digits) return '';
    const rev = digits.split('').reverse().join('');
    const chunks = rev.match(new RegExp(`.{1,${clusterSize}}`, 'g')) || [];
    return chunks.map(c=>c.split('').reverse().join('')).reverse().join(' ');
  }
  // Hiển thị tiền dạng "87 230 934 500 đ" (khoảng trắng, KHÔNG dấu chấm) — dùng riêng cho các
  // trường tiền của Sổ vay vốn ở danh sách/xuất Excel/in, đồng bộ với cách gõ ở ô nhập liệu.
  function moneySpaced(n){
    const val = Math.round(Math.abs(n||0));
    const sign = (n||0) < 0 ? '-' : '';
    return `${sign}${groupDigitsRight(String(val), 3)} đ`;
  }
  function parseVNMoney(str){ return parseInt(String(str||'').replace(/[^\d]/g,''), 10) || 0; }
  function parseVNPercent(str){ return parseFloat(String(str||'').replace(/[^\d,]/g,'').replace(',', '.')) || 0; }
  // Hàm CHUẨN dùng cho MỌI ô nhập liệu số tiền trong toàn app (hiện tại lẫn tương lai) — khi đang gõ
  // thì hiện chữ số bình thường (không dấu cách, tránh lỗi khi đang nhập dở), khi RỜI khỏi ô (blur) thì
  // tự tách 3 số thành 1 cụm cho dễ đọc, khi BẤM VÀO LẠI (focus) để sửa thì trả về dạng số thô. Không
  // xung đột với các con số KHÁC đang đồng bộ theo ô này (những chỗ đó luôn tự đọc giá trị SỐ THẬT qua
  // parseVNMoney(), không đọc trực tiếp chuỗi hiển thị trong ô nên không bị ảnh hưởng bởi việc ô đang ở
  // dạng thô hay đã định dạng).
  function attachMoneyInputMask(input, maxDigits){
    if(!input) return;
    const limit = maxDigits || 12;
    input.addEventListener('input', ()=>{
      let digits = input.value.replace(/[^\d]/g, '');
      if(digits.length>limit) digits = digits.slice(0, limit);
      input.value = digits;
    });
    input.addEventListener('focus', ()=>{ input.value = input.value.replace(/[^\d]/g,''); });
    input.addEventListener('blur', ()=>{ const digits = input.value.replace(/[^\d]/g,''); input.value = digits? groupDigitsRight(digits,3) : ''; });
    if(input.value) input.value = groupDigitsRight(input.value.replace(/[^\d]/g,''), 3);
    input.addEventListener('keypress', (e)=>{
      if(e.key.length===1 && !/[\d]/.test(e.key)){
        e.preventDefault();
        alert('Chỉ được nhập chữ số cho ô này. Hệ thống sẽ tự động tách cụm 3 số giúp đồng chí.');
      }
    });
  }
  function attachCccdInputMask(input){
    if(!input) return;
    input.addEventListener('input', ()=>{
      let digits = input.value.replace(/[^\d]/g, '').slice(0, 13);
      input.value = groupDigitsRight(digits, 4);
    });
    input.addEventListener('keypress', (e)=>{
      if(e.key.length===1 && !/[\d]/.test(e.key)){ e.preventDefault(); alert('Số CCCD chỉ được nhập chữ số.'); }
    });
  }
  function attachPhoneInputMask(input){
    if(!input) return;
    input.addEventListener('input', ()=>{
      let raw = input.value.replace(/[^\d+]/g, '');
      const plus = raw.startsWith('+') ? '+' : '';
      let digits = raw.replace(/\+/g, '');
      const maxDigits = 12 - plus.length;
      if(digits.length>maxDigits) digits = digits.slice(0, maxDigits);
      input.value = plus + groupDigitsRight(digits, 3);
    });
    input.addEventListener('keypress', (e)=>{
      const ch = e.key; if(ch.length!==1) return;
      if(!/[\d+]/.test(ch)){ e.preventDefault(); alert('Số điện thoại chỉ được nhập chữ số và dấu +.'); }
    });
  }
  function attachPercentInputMask(input){
    if(!input) return;
    input.addEventListener('keypress', (e)=>{
      const ch = e.key;
      if(ch.length!==1) return;
      const isDigit = /[\d]/.test(ch);
      const isComma = ch===',';
      if(isComma && input.value.includes(',')){ e.preventDefault(); return; } // chỉ 1 dấu phẩy
      if(!isDigit && !isComma){
        e.preventDefault();
        alert('Chỉ được nhập chữ số và dấu phẩy (,) cho ô Lãi suất/Tỷ lệ %. Vui lòng kiểm tra lại.');
      }
    });
    input.addEventListener('input', ()=>{
      const cleaned = input.value.replace(/[^\d,]/g, '');
      const parts = cleaned.split(',');
      const fixed = parts.length>2 ? (parts[0]+','+parts.slice(1).join('')) : cleaned;
      if(fixed !== input.value) input.value = fixed;
    });
  }
  // Giới hạn số ký tự tối đa được gõ vào 1 ô input/textarea (chặn ngay lúc gõ, không phải chờ Lưu
  // mới báo lỗi) — dùng cho các trường có giới hạn ký tự trong Sổ vay vốn.
  function attachMaxLengthMask(input, maxLen){
    if(!input) return;
    input.setAttribute('maxlength', String(maxLen));
  }

  // ---------------------------------------------------------------------
  // Câu hỏi khảo sát dạng "🔢 Chỉ nhập số" — chỉ nhận chữ số + TỐI ĐA 1 dấu phẩy, tự động tách
  // cụm 3 ký tự (cách nhau bằng khoảng trắng) NGAY TRONG LÚC gõ. Phần nguyên tách từ PHẢI sang
  // trái (kiểu hàng nghìn thông thường: 34092000 -> "34 092 000"), phần thập phân (sau dấu phẩy)
  // tách từ TRÁI sang phải (34,8743 -> "34 , 874 3").
  // ---------------------------------------------------------------------
  function formatNumericGroupedLive(raw){
    const cleaned = String(raw||'').replace(/[^\d,]/g, '');
    const firstComma = cleaned.indexOf(',');
    let intPart, decPart, hasComma;
    if(firstComma===-1){ intPart = cleaned; decPart = ''; hasComma = false; }
    else { intPart = cleaned.slice(0, firstComma); decPart = cleaned.slice(firstComma+1).replace(/,/g,''); hasComma = true; }
    const groupRight = (s)=>{ if(!s) return ''; const rev = s.split('').reverse().join(''); const chunks = rev.match(/.{1,3}/g)||[]; return chunks.map(c=>c.split('').reverse().join('')).reverse().join(' '); };
    const groupLeft = (s)=>{ if(!s) return ''; return (s.match(/.{1,3}/g)||[]).join(' '); };
    const intF = groupRight(intPart);
    const decF = groupLeft(decPart);
    if(!hasComma) return intF;
    return decF ? `${intF} , ${decF}` : `${intF} ,`;
  }
  function attachPublicNumericMask(input){
    if(!input) return;
    const dispEl = input.parentElement ? input.parentElement.querySelector(`[data-numeric-disp="${input.dataset.qid}"]`) : null;
    const updateDisp = ()=>{ if(dispEl) dispEl.textContent = input.value ? `= ${formatNumericGroupedLive(input.value)}` : ''; };
    input.addEventListener('keypress', (e)=>{
      const ch = e.key;
      if(ch.length!==1) return;
      const isDigit = /\d/.test(ch);
      const isComma = ch===',';
      if(isComma && input.value.includes(',')){ e.preventDefault(); return; }
      if(!isDigit && !isComma){ e.preventDefault(); alert('Câu này chỉ được nhập chữ số và dấu phẩy (,), không được nhập ký tự khác.'); }
    });
    input.addEventListener('input', ()=>{
      // KHÔNG tự nhóm số ngay trong ô đang gõ nữa (đây là nguyên nhân gây lệch số khi gõ nhiều chữ
      // số) — chỉ lọc bỏ ký tự lạ, số đã định dạng đẹp hiện riêng ở dòng bên dưới.
      input.value = input.value.replace(/[^\d,]/g,'');
      updateDisp();
    });
    updateDisp();
  }
  const daysBetween = (a,b) => Math.round((new Date(b)-new Date(a))/86400000);

  // ---------------------------------------------------------------------
  // Chuyển Markdown CƠ BẢN (từ trả lời của AI) sang HTML an toàn — thay cho việc hiển thị thô
  // các dấu *, **, - ... Luôn escapeHtml TRƯỚC (chống XSS) rồi mới áp quy tắc Markdown lên trên
  // phần đã được thoát ký tự, nên các thẻ HTML sinh ra là do chính hàm này tạo, không phải do
  // nội dung gốc (AI/người dùng) chèn vào được.
  // Hỗ trợ: **in đậm**, *in nghiêng*, gạch đầu dòng (dòng bắt đầu bằng "- " hoặc "* "), danh sách
  // số thứ tự ("1. "), và xuống dòng thường (\n -> <br>).
  // ---------------------------------------------------------------------
  function renderMarkdownLite(raw){
    if(!raw) return '';
    function inlineMd(s){
      return s
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
    }
    let text = String(raw);
    // 1) Tách khối code ```lang\n...\n``` ra xử lý riêng TRƯỚC — để AI biên tập/viết code, người
    // dùng có khung riêng dễ đọc + nút "Sao chép" (yêu cầu: khung có chứa code dễ copy).
    const codeBlocks = [];
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code)=>{
      const idx = codeBlocks.length;
      codeBlocks.push({ lang:(lang||'').trim(), code: code.replace(/\n$/,'') });
      return `\u0000CB${idx}\u0000`;
    });
    // 2) Tách khối bảng Markdown (| cột | cột |) ra xử lý riêng — hiện thành <table> có nút "Sao
    // chép bảng" (yêu cầu: khung có chứa bảng).
    const tableBlocks = [];
    text = text.replace(/((?:^\|.*\|[ \t]*$\n?){2,})/gm, (m)=>{
      const linesArr = m.trim().split('\n').filter(l=>l.trim());
      if(linesArr.length<2 || !/^\|?[\s:|-]+\|?$/.test(linesArr[1])) return m;
      const idx = tableBlocks.length;
      tableBlocks.push(linesArr);
      return `\u0000TB${idx}\u0000`;
    });
    // 3) Escape toàn bộ phần còn lại (placeholder chỉ gồm chữ/số nên không bị ảnh hưởng)
    const esc = escapeHtml(text);
    const lines = esc.split('\n');
    let html = '';
    let listMode = null; // null | 'ul' | 'ol'
    const closeList = ()=>{ if(listMode){ html += listMode==='ul' ? '</ul>' : '</ol>'; listMode = null; } };
    lines.forEach(line=>{
      const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
      const numberMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if(bulletMatch){
        if(listMode!=='ul'){ closeList(); html += '<ul class="ai-md-list">'; listMode = 'ul'; }
        html += `<li>${inlineMd(bulletMatch[1])}</li>`;
      } else if(numberMatch){
        if(listMode!=='ol'){ closeList(); html += '<ol class="ai-md-list">'; listMode = 'ol'; }
        html += `<li>${inlineMd(numberMatch[1])}</li>`;
      } else {
        closeList();
        html += line.trim()==='' ? '<br>' : `${inlineMd(line)}<br>`;
      }
    });
    closeList();
    html = html.replace(/(<br>)+$/,''); // bỏ (các) <br> thừa ở cuối cùng
    // 4) Thay placeholder bằng khối code/bảng THẬT (escape riêng nội dung gốc từng khối) — riêng
    // các "ngôn ngữ" đặc biệt pptx/docx/xlsx/pdf sẽ hiện THẺ FILE có nút Tải xuống thật, KHÔNG hiện
    // như khối code thường (AI được huấn luyện dùng đúng cú pháp này khi tạo file thật cho người dùng).
    const FILE_KINDS = { pptx:{icon:'📊', label:'Bài trình chiếu PowerPoint (.pptx)'}, docx:{icon:'📄', label:'Văn bản Word (.docx)'}, xlsx:{icon:'📈', label:'Bảng tính Excel (.xlsx)'}, pdf:{icon:'🧾', label:'Tài liệu PDF (in/lưu PDF)'}, voice:{icon:'🔊', label:'Giọng nói AI'} };
    html = html.replace(/\u0000CB(\d+)\u0000/g, (m,i)=>{
      const cb = codeBlocks[parseInt(i,10)];
      const langKey = cb.lang.toLowerCase();
      const kind = FILE_KINDS[langKey];
      if(kind && langKey==='voice'){
        return `<div class="md-file-card" data-file-type="voice">
          <pre class="md-file-raw" style="display:none;">${escapeHtml(cb.code)}</pre>
          <div class="md-file-icon">${kind.icon}</div>
          <div class="md-file-info"><div class="md-file-title">${kind.label}</div><div class="md-file-sub">Bấm để nghe giọng đọc AI thật ngay trong trình duyệt</div></div>
          <button class="md-file-download md-voice-play">▶️ Nghe giọng đọc AI</button>
        </div>`;
      }
      if(kind){
        return `<div class="md-file-card" data-file-type="${langKey}">
          <pre class="md-file-raw" style="display:none;">${escapeHtml(cb.code)}</pre>
          <div class="md-file-icon">${kind.icon}</div>
          <div class="md-file-info"><div class="md-file-title">${kind.label}</div><div class="md-file-sub">Bấm để tạo tệp thật và tải về máy</div></div>
          <button class="md-file-download">⬇️ Tải xuống</button>
        </div>`;
      }
      return `<div class="md-code-block"><div class="md-code-head"><span>${escapeHtml(cb.lang||'code')}</span><button class="md-code-copy">📋 Sao chép</button></div><pre><code>${escapeHtml(cb.code)}</code></pre></div>`;
    });
    html = html.replace(/\u0000TB(\d+)\u0000/g, (m,i)=>{
      const linesArr = tableBlocks[parseInt(i,10)];
      const rows = linesArr.map(l=> l.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim()));
      const header = rows[0]||[]; const body = rows.slice(2);
      const thead = `<tr>${header.map(h=>`<th>${inlineMd(escapeHtml(h))}</th>`).join('')}</tr>`;
      const tbody = body.map(r=>`<tr>${r.map(c=>`<td>${inlineMd(escapeHtml(c))}</td>`).join('')}</tr>`).join('');
      return `<div class="md-table-block"><div class="md-table-head"><button class="md-table-copy">📋 Sao chép bảng</button></div><table class="md-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
    });
    return html;
  }
  // Nối sự kiện cho nút "Sao chép" trong khối code/bảng do renderMarkdownLite sinh ra — gọi lại
  // sau MỖI lần render bong bóng chat (Chat AI & Tạo bài Tuyên truyền).
  function wireMarkdownExtras(container){
    if(!container) return;
    container.querySelectorAll('.md-code-copy').forEach(btn=>{
      btn.onclick = ()=>{
        const codeEl = btn.closest('.md-code-block').querySelector('code');
        copyMessageText(codeEl? codeEl.textContent : '');
      };
    });
    container.querySelectorAll('.md-table-copy').forEach(btn=>{
      btn.onclick = ()=>{
        const table = btn.closest('.md-table-block').querySelector('table');
        if(!table) return;
        const rows = Array.from(table.querySelectorAll('tr')).map(tr=> Array.from(tr.children).map(td=>td.textContent).join('\t'));
        copyMessageText(rows.join('\n'));
      };
    });
    // Thẻ file thật (pptx/docx/xlsx/pdf) do AI tạo — bấm mới THỰC SỰ dựng file (không tốn phí nếu
    // người dùng không bấm), rồi tải về máy hoặc mở hộp thoại in/lưu PDF.
    container.querySelectorAll('.md-file-download').forEach(btn=>{
      btn.onclick = async ()=>{
        const card = btn.closest('.md-file-card');
        if(!card) return;
        const type = card.dataset.fileType;
        const rawEl = card.querySelector('.md-file-raw');
        const raw = rawEl ? rawEl.textContent : '';
        // Giọng nói AI: nút bấm để PHÁT/DỪNG (toggle) — tự quản lý nhãn nút riêng, không dùng
        // luồng disable/tải-file chung bên dưới.
        if(type==='voice'){ speakTextAsAiVoice(raw, btn); return; }
        const oldLabel = btn.textContent;
        btn.disabled = true; btn.textContent = '⏳ Đang tạo tệp...';
        try{
          if(type==='pptx') await generatePptxFromAiOutline(raw);
          else if(type==='xlsx') await generateXlsxFromAiCsv(raw);
          else if(type==='docx') generateDocxFromAiOutline(raw);
          else if(type==='pdf') generatePdfFromAiOutline(raw);
        }catch(e){
          console.error('[Tạo file thật] Lỗi:', e);
          alert('Tạo tệp thất bại: ' + e.message);
        }
        btn.disabled = false; btn.textContent = oldLabel;
      };
    });
  }

  // ---------------------------------------------------------------------
  // TẠO FILE THẬT từ nội dung có cấu trúc do AI xuất ra (không phải giả lập) — dùng cho Chat AI và
  // Tạo bài Tuyên truyền. Cú pháp AI cần tuân theo được huấn luyện trong system prompt tương ứng.
  // ---------------------------------------------------------------------
  async function generatePptxFromAiOutline(text){
    await loadOptionalLibrary('pptxgenjs');
    const pptx = new window.PptxGenJS();
    const slidesRaw = text.split(/\n\s*---\s*\n/);
    slidesRaw.forEach(block=>{
      const lines = block.split('\n').map(l=>l.trim()).filter(l=>l);
      if(!lines.length) return;
      const slide = pptx.addSlide();
      const title = lines[0].replace(/^#+\s*/,'');
      slide.addText(title, { x:0.5, y:0.3, w:9, h:1, fontSize:28, bold:true, color:'2F4A3C' });
      const bullets = lines.slice(1).map(l=> l.replace(/^[-*]\s*/,''));
      if(bullets.length){
        slide.addText(bullets.map(b=>({ text:b, options:{ bullet:true, breakLine:true } })), { x:0.6, y:1.5, w:8.8, h:5, fontSize:18, color:'333333' });
      }
    });
    await pptx.writeFile({ fileName:`Trinh-chieu_${todayStr()}.pptx` });
  }
  async function generateXlsxFromAiCsv(text){
    await loadOptionalLibrary('xlsx');
    const rows = text.trim().split('\n').filter(l=>l.trim()).map(line=> line.split(',').map(c=>c.trim()));
    if(rows.length) rows[0] = rows[0].map(h=> h.toUpperCase()); // chuyển chữ hoa dòng tiêu đề — thay thế cho việc tô màu nền không khả thi ở Excel
    const ws = XLSX.utils.aoa_to_sheet(rows);
    applyExcelCellFormatting(ws, rows, 0);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `Bang-tinh_${todayStr()}.xlsx`, {cellStyles:true});
  }
  function generateDocxFromAiOutline(text){
    const bodyHtml = renderMarkdownLite(text);
    const doc = htmlToWordDoc('Tài liệu', bodyHtml);
    downloadBlob(`Tai-lieu_${todayStr()}.doc`, doc, 'application/msword');
  }
  function generatePdfFromAiOutline(text){
    const area = document.getElementById('print-area');
    if(!area){ alert('Không tìm thấy khu vực in trên trang.'); return; }
    area.innerHTML = `<div style="padding:10mm;">${renderMarkdownLite(text)}</div>`;
    area.classList.remove('landscape');
    window.print();
  }
  // Giọng nói AI THẬT — dùng Web Speech API có sẵn của trình duyệt/thiết bị (không cần API trả
  // phí, hoạt động ngay lập tức). Bấm lần nữa để dừng đọc giữa chừng.
  let _currentSpeechUtterance = null;
  function speakTextAsAiVoice(text, btn){
    if(!window.speechSynthesis){ alert('Rất tiếc, trình duyệt của đồng chí không hỗ trợ giọng nói AI (Web Speech API). Vui lòng thử trên Chrome/Edge/Safari bản mới.'); return; }
    if(window.speechSynthesis.speaking){
      window.speechSynthesis.cancel();
      _currentSpeechUtterance = null;
      if(btn) btn.textContent = '▶️ Nghe giọng đọc AI';
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'vi-VN';
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(v=> v.lang && v.lang.toLowerCase().startsWith('vi'));
    if(viVoice) utter.voice = viVoice;
    utter.rate = 0.95;
    utter.onend = ()=>{ _currentSpeechUtterance = null; if(btn) btn.textContent = '▶️ Nghe giọng đọc AI'; };
    utter.onerror = ()=>{ _currentSpeechUtterance = null; if(btn) btn.textContent = '▶️ Nghe giọng đọc AI'; };
    window.speechSynthesis.speak(utter);
    _currentSpeechUtterance = utter;
    if(btn) btn.textContent = '⏹ Dừng đọc';
  }

