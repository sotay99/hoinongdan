
(function(){
  const root = document.getElementById('root');
  const money = n => (Math.round((n||0)) ).toLocaleString('vi-VN') + ' đ';
  const fmtDate = d => { if(!d) return '—'; const x=new Date(d); return x.toLocaleDateString('vi-VN'); };
  const todayStr = () => new Date().toISOString().slice(0,10);
  const uid = () => Math.random().toString(36).slice(2,10);
  // Thoát ký tự HTML đặc biệt — dùng khi chèn văn bản người dùng/AI tự do (chat) vào innerHTML.
  // SỬA TẬN GỐC lỗi các ô nhập liệu (đặc biệt là ô tìm kiếm) bị mất focus/con trỏ sau mỗi ký tự — vì
  // renderFn() dựng lại toàn bộ innerHTML, tạo ra phần tử <input> HOÀN TOÀN MỚI, trình duyệt tự động
  // "nhả" focus khỏi phần tử cũ. Hàm này ghi nhớ đúng ô đang gõ + vị trí con trỏ TRƯỚC khi vẽ lại,
  // rồi khôi phục lại NGAY SAU khi vẽ lại xong.
  // Giữ nguyên vị trí cuộn (scrollTop) của 1 khung cuộn (thường là .modal-body) khi vẽ lại giao diện
  // — sửa lỗi bị "nhảy" lên đầu mỗi khi bấm mở/rút gọn 1 danh sách nào đó bên trong (vì renderFn()
  // dựng lại toàn bộ innerHTML của `wrap`, tạo ra phần tử cuộn HOÀN TOÀN MỚI, tự động về scrollTop=0).
  function rerenderKeepingScroll(wrap, scrollSelector, renderFn){
    const oldEl = wrap.querySelector(scrollSelector);
    const top = oldEl ? oldEl.scrollTop : 0;
    renderFn();
    const newEl = wrap.querySelector(scrollSelector);
    if(newEl) newEl.scrollTop = top;
  }
  // Giống rerenderKeepingScroll ở trên, NHƯNG giữ thêm NGUYÊN VẸN giá trị của MỌI ô nhập liệu đang có
  // trên form (input/select/textarea có id) trước khi vẽ lại, rồi khôi phục lại đầy đủ sau khi vẽ xong.
  // Dùng cho các trường hợp vẽ lại 1 PHẦN nhỏ của modal (VD: đổi Phân loại biên lai, mở/đóng dropdown)
  // nhưng modal đó còn nhiều ô nhập liệu KHÁC (số tiền, tên người trả...) chưa được lưu vào state, nếu
  // không giữ lại thủ công sẽ bị XOÁ SẠCH oan uổng mỗi khi vẽ lại.
  function rerenderKeepingScrollAndInputs(wrap, scrollSelector, renderFn){
    const savedValues = {};
    wrap.querySelectorAll('input[id], select[id], textarea[id]').forEach(el=>{ savedValues[el.id] = el.value; });
    rerenderKeepingScroll(wrap, scrollSelector, renderFn);
    Object.keys(savedValues).forEach(id=>{ const el = wrap.querySelector('#'+CSS.escape(id)); if(el) el.value = savedValues[id]; });
  }
  // Khoá nút "Xác nhận" của MỌI biên lai trong đúng 3 giây đầu tiên tính TỪ LÚC BIÊN LAI ĐƯỢC MỞ
  // (openedAt) — không bị "reset lại giờ" mỗi khi biên lai tự vẽ lại do người dùng đang thao tác các
  // trường khác bên trong. Gọi lại hàm này SAU MỖI LẦN vẽ lại biên lai đó.
  // QUAN TRỌNG: KHÔNG dùng btn.disabled=true — vì nút bị disabled sẽ chặn luôn cả sự kiện "rê chuột
  // vào thì tự cuộn xuống cuối bảng" (mouseenter không bao giờ bắn ra trên phần tử disabled). Thay
  // vào đó dùng cờ data-locked + 1 bộ lắng nghe click ở tầng BẮT (capture) toàn cục để chặn đúng lúc
  // click thật sự xảy ra, còn rê chuột vẫn hoạt động bình thường xuyên suốt (kể cả trong 3 giây khoá).
  if(!window.__confirmBtnClickGuardBound){
    window.__confirmBtnClickGuardBound = true;
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-locked="1"]');
      if(btn){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
    }, true);
  }
  function delayEnableConfirmBtn(btn, openedAt){
    if(!btn) return;
    const elapsed = Date.now() - openedAt;
    if(elapsed >= 3000){ btn.dataset.locked=''; btn.style.opacity=''; btn.style.cursor=''; return; }
    btn.dataset.locked = '1';
    btn.style.opacity = '0.45'; btn.style.cursor = 'not-allowed';
    setTimeout(()=>{ if(btn.isConnected){ btn.dataset.locked=''; btn.style.opacity=''; btn.style.cursor=''; } }, 3000-elapsed);
  }
  // Gộp chung: khoá 3 giây đầu — khoá CẢ click LẪN "rê chuột vào thì tự cuộn xuống cuối bảng" (rê
  // chuột trong 3 giây đầu thì KHÔNG có gì xảy ra cả). Sau đúng 3 giây thì cả 2 mới hoạt động lại
  // bình thường.
  function wireConfirmBtnBehavior(wrap, btn, openedAt){
    if(!btn) return;
    delayEnableConfirmBtn(btn, openedAt);
    btn.addEventListener('mouseenter', ()=>{
      if(btn.dataset.locked==='1') return; // vẫn còn trong 3 giây đầu -> không cuộn gì cả
      const body = wrap.querySelector('.modal-body');
      if(body) body.scrollTo({ top: body.scrollHeight, behavior:'smooth' });
    });
  }
  function rerenderKeepingFocus(renderFn){
    const active = document.activeElement;
    const id = active && active.id;
    const tag = active && active.tagName;
    const isTextInput = tag==='INPUT' || tag==='TEXTAREA';
    const selStart = isTextInput ? active.selectionStart : null;
    const selEnd = isTextInput ? active.selectionEnd : null;
    renderFn();
    if(id){
      const el = document.getElementById(id);
      if(el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA')){
        el.focus();
        if(selStart!=null && el.setSelectionRange){ try{ el.setSelectionRange(selStart, selEnd); }catch(e){} }
      }
    }
  }
  function escapeHtml(s){
    return String(s==null? '' : s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  // Tự động ngắt 1 đoạn văn bản dài thành nhiều dòng — CHỈ ngắt tại dấu cách (không cắt giữa từ), mỗi
  // dòng tối đa maxLen ký tự — dùng cho các cột bảng cần hiển thị văn bản dài (VD Ghi chú) mà không bị
  // tràn ngang, tự xuống dòng gọn gàng bên trong ô. Trả về HTML đã escape sẵn, nối bằng "<br>".
  function wrapTextAtSpacesHtml(text, maxLen){
    if(!text) return '';
    const words = String(text).split(' ');
    const lines = [];
    let cur = '';
    words.forEach(w=>{
      if(!cur){ cur = w; return; }
      if((cur+' '+w).length <= maxLen){ cur += ' '+w; }
      else { lines.push(cur); cur = w; }
    });
    if(cur) lines.push(cur);
    return lines.map(escapeHtml).join('<br>');
  }
  // Nhãn cột có thể chứa "<br>" (xuống dòng cho gọn) — 2 hàm dưới đây xử lý đúng cho 2 ngữ cảnh khác
  // nhau: hiển thị thật trên HTML (giữ nguyên <br> thành xuống dòng) và xuất Excel/in ấn dạng chữ
  // thô (đổi <br> thành khoảng trắng, KHÔNG được để lọt chữ "<br>" thô vào ô Excel).
  function htmlLabel(label){ return escapeHtml(label).replace(/&lt;br&gt;/g, '<br>'); }
  // Màn hình bề ngang hẹp (điện thoại, hoặc cửa sổ trình duyệt bị thu hẹp) — khung menu tự thu gọn khi
  // bấm nút nổi HOẶC bấm bất kỳ đâu trong khung nội dung module hiện hành (KHÔNG áp dụng khi bấm vào
  // chính các nút module trong khung menu — bấm đổi module thì khung menu vẫn giữ nguyên trạng thái).
  // Dùng e.target.closest(...) thay vì element.contains(e.target): sau khi render() thay mới toàn bộ
  // DOM, tham chiếu phần tử CŨ (e.target) không còn là con của phần tử MỚI truy vấn lại nữa — dùng
  // closest() để kiểm tra đúng theo cây DOM GỐC tại thời điểm bấm, không bị lệch.
  function isNarrowScreenForSidebar(){ return window.innerWidth<=820; }
  // Khung sổ xuống của bộ lọc (Địa phương/Phương án vay/Nguồn vay...) — màn hình hẹp: CSS đã ép về
  // position:fixed căn theo 2 mép trái/phải màn hình (luôn gọn trong màn hình, không tràn ra ngoài
  // nữa) — nhưng vẫn cần JS tính đúng vị trí TRÊN/DƯỚI (top) theo đúng vị trí nút bấm vừa kích hoạt nó,
  // để khung luôn hiện ngay sát dưới đúng nút đó. Dùng MutationObserver: hễ 1 khung ".sv-filter-panel"
  // vừa được thêm vào trang là tự tính lại vị trí ngay lập tức.
  if(!window.__filterPanelPositionObserver){
    function positionFilterPanel(panel){
      // Nút X đóng dropdown — giờ hiện ở MỌI kích thước màn hình (không chỉ riêng màn hình hẹp nữa).
      // Bấm vào X -> ưu tiên giả lập bấm vào lớp phủ (scrim, chỉ tồn tại ở màn hình hẹp) để tái sử dụng
      // đúng cơ chế đóng đã có; nếu không có scrim (màn hình rộng) thì tự ẩn trực tiếp qua DOM + gọi
      // render() — đảm bảo hoạt động nhất quán ở MỌI loại dropdown trong toàn app, không cần đoán riêng
      // từng biến trạng thái của từng nơi, và không phụ thuộc modal đó quản lý render kiểu gì.
      if(!panel.querySelector(':scope > .sv-filter-panel-close-x')){
        const xBtn = document.createElement('button');
        xBtn.type = 'button';
        xBtn.className = 'sv-filter-panel-close-x preview-allow';
        xBtn.textContent = '✕';
        xBtn.style.cssText = 'position:sticky; top:0; left:100%; transform:translate(6px,-6px); z-index:999; width:26px; height:26px; border-radius:50%; border:none; background:#b71c1c; color:#fff; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,.3);';
        xBtn.onclick = (e)=>{
          e.stopPropagation();
          window.__svLastOpenFilterDropdown = null;
          const scrim = document.getElementById('__svFilterPanelScrim');
          if(scrim){ scrim.click(); return; }
          state.openFilterDropdown = null;
          document.querySelectorAll('.sv-filter-panel').forEach(p=> p.style.display='none');
          render();
        };
        panel.insertBefore(xBtn, panel.firstChild);
      }
      if(!isNarrowScreenForSidebar()) return;
      const dropdown = panel.closest('.sv-filter-dropdown');
      const btn = dropdown ? dropdown.querySelector('button') : null;
      if(!btn) return;
      // Màn hình hẹp: CUỘN TRƯỚC rồi mới hiện dropdown ra — CHỈ áp dụng đúng lúc dropdown NÀY vừa mới
      // chuyển từ "đóng" sang "mở" (so sánh ID dropdown đang mở hiện tại với ID đã ghi nhớ từ lần vẽ
      // trước) — không áp dụng khi panel vẽ lại do bấm tích/bỏ tích 1 mục BÊN TRONG (ID không đổi).
      const curId = state.openFilterDropdown;
      const isFreshOpen = curId && window.__svLastOpenFilterDropdown!==curId;
      window.__svLastOpenFilterDropdown = curId; // luôn cập nhật lại, kể cả khi null (đóng) để lần mở lại sau này (kể cả mở lại ĐÚNG dropdown vừa đóng) vẫn được tính là "vừa mở"
      if(!isFreshOpen){
        const rect = btn.getBoundingClientRect();
        panel.style.top = (rect.bottom + 4) + 'px';
        const maxTop = window.innerHeight - 60;
        if(parseFloat(panel.style.top) > maxTop) panel.style.top = maxTop + 'px';
        return;
      }
      panel.style.visibility = 'hidden';
      const rectBefore = btn.getBoundingClientRect();
      const targetOffsetFromTop = 90; // gần phía trên, không sát mép trên cùng
      const scrollDelta = rectBefore.top - targetOffsetFromTop;
      if(Math.abs(scrollDelta) > 4){
        window.scrollBy({ top: scrollDelta, behavior:'auto' });
        const scrollableAncestor = (function(){
          let el = btn.parentElement;
          while(el && el!==document.body){
            const cs = getComputedStyle(el);
            if(/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight>el.clientHeight) return el;
            el = el.parentElement;
          }
          return null;
        })();
        if(scrollableAncestor) scrollableAncestor.scrollTop += scrollDelta;
      }
      requestAnimationFrame(()=>{
        const rectAfter = btn.getBoundingClientRect();
        panel.style.top = (rectAfter.bottom + 4) + 'px';
        const maxTop2 = window.innerHeight - 60;
        if(parseFloat(panel.style.top) > maxTop2) panel.style.top = maxTop2 + 'px';
        panel.style.visibility = 'visible';
      });
      const rect = btn.getBoundingClientRect();
      panel.style.top = (rect.bottom + 4) + 'px';
      const maxTop = window.innerHeight - 60;
      if(parseFloat(panel.style.top) > maxTop) panel.style.top = maxTop + 'px';
    }
    // Màn hình hẹp: khi 1 khung sổ xuống (.sv-filter-panel) đang mở, CHẶN HẲN mọi thao tác bên ngoài
    // nó (không cho bấm nút khác, không cho cuộn trang) — chỉ được thao tác với chính khung đó và nút
    // bộ lọc đã mở nó ra (để có thể đóng lại). Dùng 1 lớp phủ trong suốt phủ kín màn hình, nằm ngay
    // dưới khung sổ xuống nhưng trên mọi thứ khác, hứng trọn mọi cú bấm/cuộn ở "vùng ngoài".
    function ensureFilterPanelScrim(){
      if(!isNarrowScreenForSidebar()) return;
      if(document.getElementById('__svFilterPanelScrim')) return;
      const scrim = document.createElement('div');
      scrim.id = '__svFilterPanelScrim';
      scrim.style.cssText = 'position:fixed; inset:0; z-index:389; background:transparent;';
      // Bấm vào lớp phủ (tức đang bấm ra "vùng ngoài") -> coi như đóng dropdown đang mở, y hệt hành vi
      // đóng khi bấm ra ngoài trước đây — chỉ khác là giờ KHÔNG có bất kỳ hành động nào khác (cuộn,
      // bấm nút khác...) lọt được xuống bên dưới lớp phủ này nữa.
      scrim.addEventListener('click', ()=>{
        state.openFilterDropdown = null;
        window.__svLastOpenFilterDropdown = null;
        // Ẩn TRỰC TIẾP mọi khung sổ xuống đang có trên trang qua DOM — không chỉ đổi biến trạng thái
        // rồi gọi render() toàn cục, vì 1 số modal (Tính tiền lãi/Tất toán/Gia hạn nợ/Nợ rủi ro...) có
        // vòng lặp vẽ lại (renderBody) RIÊNG, KHÔNG nằm trong cây render chính của app — gọi render()
        // toàn cục không hề khiến các modal này biết để tự vẽ lại, panel vẫn đứng yên trên màn hình.
        document.querySelectorAll('.sv-filter-panel').forEach(p=> p.style.display='none');
        removeFilterPanelScrim(); // gỡ ngay, không chờ MutationObserver kiểm tra lại (panel bị ẩn chứ chưa xoá khỏi DOM nên kiểm tra tự động sẽ không nhận ra)
        render();
      });
      scrim.addEventListener('touchmove', (e)=> e.preventDefault(), { passive:false });
      scrim.addEventListener('wheel', (e)=> e.preventDefault(), { passive:false });
      document.body.appendChild(scrim);
      document.body.style.overflow = 'hidden';
    }
    function removeFilterPanelScrim(){
      const scrim = document.getElementById('__svFilterPanelScrim');
      if(scrim) scrim.remove();
      document.body.style.overflow = '';
    }
    window.__filterPanelPositionObserver = new MutationObserver((mutations)=>{
      mutations.forEach(m=>{
        m.addedNodes.forEach(node=>{
          if(node.nodeType!==1) return;
          if(node.classList && node.classList.contains('sv-filter-panel')){ positionFilterPanel(node); ensureFilterPanelScrim(); }
          else if(node.querySelectorAll){ const found = node.querySelectorAll('.sv-filter-panel'); if(found.length){ found.forEach(positionFilterPanel); ensureFilterPanelScrim(); } }
        });
      });
      // Sau mỗi đợt thay đổi DOM, kiểm tra lại xem còn khung sổ xuống nào đang mở trong trang không —
      // hết sạch rồi thì tự gỡ lớp phủ + mở khoá cuộn trang trở lại.
      if(!document.querySelector('.sv-filter-panel')) removeFilterPanelScrim();
    });
    window.__filterPanelPositionObserver.observe(document.body, { childList:true, subtree:true });
  }
  if(!window.__svColWrapObserver){
    window.__svColWrapObserver = new MutationObserver((mutations)=>{
      let found = false;
      mutations.forEach(m=>{
        m.addedNodes.forEach(node=>{
          if(node.nodeType!==1) return;
          if((node.classList && node.classList.contains('sv-col-wrap-check')) || (node.querySelector && node.querySelector('.sv-col-wrap-check'))) found = true;
        });
      });
      // Đợi 1 khung hình để trình duyệt tính toán xong layout thật sự (chiều cao ô) rồi mới đo — đo
      // ngay lập tức lúc DOM vừa chèn vào có thể chưa có kích thước chính xác.
      if(found) requestAnimationFrame(()=>{ applySvColWrapAlignment(document.body); applySvColAutoFit(document.body); });
    });
    window.__svColWrapObserver.observe(document.body, { childList:true, subtree:true });
  }
  // Chặn .remove() cho MỌI phần tử .modal-bg trong toàn app — để có đủ thời gian phát hiệu ứng "biến
  // mất" (thu nhỏ + trượt xuống + mờ dần) trước khi phần tử thực sự bị gỡ khỏi DOM, thay vì biến mất
  // đột ngột ngay lập tức. Ghi đè ở cấp độ Element.prototype nên áp dụng THỐNG NHẤT cho MỌI modal hiện
  // có trong app LẪN mọi modal xây dựng trong tương lai — không cần sửa bất kỳ đoạn code JS nào tạo/
  // đóng modal (dù modal đó nằm lồng sâu bên trong modal khác đến đâu).
  if(!window.__modalCloseAnimPatched){
    window.__modalCloseAnimPatched = true;
    const originalRemove = Element.prototype.remove;
    // Công khai ra ngoài để những nơi cần "đóng modal cũ, dựng modal mới THAY THẾ NGAY LẬP TỨC" (VD sau
    // khi lưu xong 1 bảng quản lý con — địa bàn dân cư/người quản lý/địa chỉ trước sáp nhập — rồi vẽ
    // lại modal cha) có thể gọi thẳng bản KHÔNG có hiệu ứng trễ này — tránh tình trạng modal CŨ vẫn còn
    // tồn tại trong DOM (đang chờ hết 450ms hiệu ứng biến mất) CÙNG LÚC với modal MỚI vừa dựng lên, dẫn
    // đến 2 modal có CÙNG ID phần tử con trùng nhau — khiến các thao tác tìm-theo-ID (VD khôi phục lại
    // dữ liệu form đang gõ dở) bị nhầm lẫn, ghi/đọc nhầm vào modal CŨ (sắp biến mất) thay vì modal MỚI.
    window.__instantRemoveModal = (el)=>{ if(el) originalRemove.call(el); };
    Element.prototype.remove = function(){
      if(this.classList && this.classList.contains('modal-bg') && !this.classList.contains('modal-bg-closing')){
        this.classList.add('modal-bg-closing');
        setTimeout(()=>{ originalRemove.call(this); }, 450); // khớp đúng thời lượng animation modalCardPopOut/modalBgFadeOut ở CSS (đã tăng gấp đôi rồi nhân thêm 1.5 lần)
        return;
      }
      originalRemove.call(this);
    };
  }
  // Đánh dấu "đã xuất hiện" cho MỌI modal-bg ngay sau khi vừa được thêm vào trang — để hiệu ứng xuất
  // hiện CHỈ chạy đúng 1 LẦN DUY NHẤT lúc mới mở, không lặp lại mỗi khi nội dung BÊN TRONG modal được
  // vẽ lại (VD bấm 1 nút nào đó bên trong khiến JS tạo lại phần tử .modal con — nếu không đánh dấu,
  // .modal mới đó sẽ lại kích hoạt animation xuất hiện, khiến màn hình "giật" mỗi lần bấm bất kỳ nút gì
  // bên trong, thay vì chỉ cuộn mượt như mong muốn).
  // Theo dõi CHÍNH XÁC theo từng modal-bg: modal-bg nào ĐÃ TỪNG hiện ra 1 khung .modal rồi thì mọi lần
  // xuất hiện .modal MỚI tiếp theo bên trong CHÍNH modal-bg đó (do vẽ lại sau khi tải xong dữ liệu, hay
  // do bấm 1 nút nào đó bên trong khiến JS dựng lại .modal mới) đều bị TẮT HẲN animation xuất hiện NGAY
  // LẬP TỨC (gán thẳng vào inline style, luôn được ưu tiên hơn CSS class nên chắc chắn có hiệu lực dù
  // xảy ra nhanh tới đâu) — chỉ có ĐÚNG LẦN ĐẦU TIÊN mới được phép chạy trọn vẹn hiệu ứng xuất hiện.
  // Đây là cách sửa dứt điểm lỗi "giật cục" (animation bị kích hoạt lại) hay gặp ở các modal có tải dữ
  // liệu bất đồng bộ (vẽ khung rỗng trước, tải Firebase xong vẽ lại lần 2 — lần 2 tạo ra .modal MỚI,
  // nếu không tắt kịp sẽ kích hoạt lại animation từ đầu, gây cảm giác "biến mất rồi hiện lại" khó chịu,
  // đặc biệt rõ trên màn hình điện thoại).
  // Cảnh báo khi người dùng cố rời khỏi trang (bấm nút quay lại của trình duyệt, đóng tab, gõ địa chỉ
  // khác, tải lại trang...) — áp dụng cho TOÀN BỘ app, bất kỳ lúc nào đang mở trang. LƯU Ý QUAN TRỌNG:
  // theo đúng quy định bảo mật của MỌI trình duyệt hiện đại (từ khoảng năm 2011 trở đi), không trang
  // web nào được phép tự đặt NỘI DUNG của dòng cảnh báo này nữa (để tránh các trang lừa đảo giả mạo
  // cảnh báo hệ thống) — trình duyệt sẽ luôn tự hiện đúng 1 dòng cảnh báo CHUNG do chính nó quy định
  // (thường có dạng "Những thay đổi bạn đã thực hiện có thể không được lưu."), không thể sửa thành
  // đúng nguyên văn "sẽ thoát khỏi hoinongdan.sotay.org" như mong muốn — đây là giới hạn kỹ thuật chung
  // của mọi trình duyệt, không phải do app này thiếu sót.
  if(!window.__beforeUnloadWarningWired){
    window.__beforeUnloadWarningWired = true;
    window.addEventListener('beforeunload', (e)=>{
      e.preventDefault();
      e.returnValue = '';
      return '';
    });
  }
  if(!window.__modalEnterMarkObserver){
    window.__modalEnterMarkObserver = new MutationObserver((mutList)=>{
      mutList.forEach(mut=>{
        mut.addedNodes.forEach(node=>{
          if(node.nodeType!==1) return;
          const modalEls = [];
          if(node.classList && node.classList.contains('modal')) modalEls.push(node);
          if(node.querySelectorAll) node.querySelectorAll('.modal').forEach(el=> modalEls.push(el));
          modalEls.forEach(modalEl=>{
            const bg = modalEl.closest('.modal-bg');
            if(!bg) return;
            if(bg.dataset.modalFirstShown){
              // modal-bg NÀY đã từng hiện .modal trước đó rồi -> đây chắc chắn là VẼ LẠI (không phải
              // lần mở đầu tiên) -> tắt animation NGAY, không cho kích hoạt lại nữa.
              modalEl.style.animation = 'none';
            } else {
              bg.dataset.modalFirstShown = '1'; // đánh dấu NGAY LẬP TỨC (đồng bộ) — không chờ bất kỳ khoảng thời gian nào cả
            }
          });
        });
      });
    });
    window.__modalEnterMarkObserver.observe(document.body, { childList:true, subtree:true });
  }
  // Tự động chèn 2 nút "cuộn lên đầu/cuộn xuống cuối" cho MỌI modal-bg xuất hiện trong toàn app — kể cả
  // modal con nằm lồng sâu bên trong modal khác, kể cả modal xây dựng trong tương lai (không cần sửa
  // bất kỳ đoạn code JS nào tạo modal, đây là cơ chế TOÀN CỤC áp dụng tự động). Mỗi modal-bg có cặp nút
  // RIÊNG của chính nó — 2 nút LUÔN thẳng hàng dọc, kéo-thả CÙNG NHAU (dùng lại đúng makeGroupDraggable
  // đã xây cho 3 nút Chat AI/Siêu ghi chú/Chat với Mọi người), độ mờ 55% giống hệt 3 nút đó.
  // Modal thường có 2 khung cuộn riêng biệt: khung NGOÀI (chính modal-bg, để thấy được tiêu đề trên
  // cùng/nút ở đáy modal khi nội dung quá dài không vừa màn hình) VÀ khung TRONG (.modal-body, nội dung
  // bên trong). Phải cuộn CẢ 2 cùng lúc thì mới thực sự "lên tới đầu"/"xuống tới cuối" đúng nghĩa.
