  // =====================================================================
  // Bộ cột RIÊNG cho modal "Tính tiền lãi và phê duyệt đóng lãi" — tập hợp con của BORROWER_COLUMNS
  // (không có các trường thông tin cá nhân), theo đúng thứ tự/mặc định ẩn-hiện bạn cho. Vẫn tôn
  // trọng nguyên vẹn quy tắc các cặp cột hiện có (BORROWER_COL_PAIRS/BORROWER_COL_ORDER_ONLY_PAIRS).
  // =====================================================================
  const INTEREST_APPROVAL_COL_KEYS = [
    'name','hamlet','principal','quarterInterestAmount','iStatus','interestOutstanding','pStatus','overdueDebtAmount',
    'interestFromDate','interestToDate',
    'splitCentralPct','splitCentralAmt','splitProvincePct','splitProvinceAmt','splitWardPct','splitWardAmt','hamletAllocPct','hamletAllocAmt',
    'loanDate','dueDate','fundSource','rate','daysRemaining',
  ];
  const INTEREST_APPROVAL_HIDDEN_BY_DEFAULT = ['splitCentralPct','splitCentralAmt','splitProvincePct','splitProvinceAmt','splitWardPct','splitWardAmt','hamletAllocPct','hamletAllocAmt','daysRemaining'];
  function iaColumnsFull(){
    const byKey = {}; BORROWER_COLUMNS().forEach(c=>byKey[c.key]=c);
    return INTEREST_APPROVAL_COL_KEYS.map(k=>byKey[k]).filter(Boolean);
  }
  function iaDefaultVisibleCols(){ return INTEREST_APPROVAL_COL_KEYS.filter(k=>!INTEREST_APPROVAL_HIDDEN_BY_DEFAULT.includes(k)); }
  function ensureIAVisibleCols(){
    if(!state.iaVisibleCols){
      state.iaVisibleCols = (state.iaColumnPrefsShared && state.iaColumnPrefsShared.visible)
        ? state.iaColumnPrefsShared.visible.filter(k=>INTEREST_APPROVAL_COL_KEYS.includes(k)) : iaDefaultVisibleCols();
    }
    return state.iaVisibleCols;
  }
  function ensureIAColumnOrder(){
    if(!state.iaColumnOrder){
      const saved = (state.iaColumnPrefsShared && state.iaColumnPrefsShared.order) ? state.iaColumnPrefsShared.order.filter(k=>INTEREST_APPROVAL_COL_KEYS.includes(k)) : INTEREST_APPROVAL_COL_KEYS.slice();
      state.iaColumnOrder = normalizeBorrowerColumnOrder(saved);
    }
    INTEREST_APPROVAL_COL_KEYS.forEach(k=>{ if(!state.iaColumnOrder.includes(k)) state.iaColumnOrder.push(k); });
    state.iaColumnOrder = normalizeBorrowerColumnOrder(state.iaColumnOrder.filter(k=>INTEREST_APPROVAL_COL_KEYS.includes(k)));
    return state.iaColumnOrder;
  }
  function openIAColumnPicker(){
    state.iaColPickerDraftVisible = ensureIAVisibleCols().slice();
    state.iaColPickerDraftOrder = normalizeBorrowerColumnOrder(ensureIAColumnOrder().slice());
    state.showIAColumnPicker = true;
  }
  function cancelIAColumnPicker(){
    state.showIAColumnPicker = false;
    state.iaColPickerDraftVisible = null;
    state.iaColPickerDraftOrder = null;
  }
  async function commitIAColumnPicker(mode){
    const draftVisible = mode==='default' ? iaDefaultVisibleCols() : state.iaColPickerDraftVisible;
    const draftOrder = mode==='default' ? normalizeBorrowerColumnOrder(INTEREST_APPROVAL_COL_KEYS.slice()) : state.iaColPickerDraftOrder;
    state.iaVisibleCols = draftVisible.slice();
    state.iaColumnOrder = draftOrder.slice();
    if(mode==='save'){
      if(canEditModule('data') && !state.previewMode){
        await cSet('interestApprovalColumnPrefs', { visible: state.iaVisibleCols, order: state.iaColumnOrder });
        showToast('Đã lưu tuỳ chỉnh cho cả xã!');
      } else if(state.previewMode){
        showToast('Đồng chí đang ở chế độ tham quan — chỉ áp dụng cho lượt xem này, không lưu lại được.');
      } else {
        showToast('Đã áp dụng cho lượt xem này (đồng chí không có quyền Sửa nên không lưu lại được).');
      }
    } else if(mode==='view'){
      showToast('Đã áp dụng tạm thời cho lượt xem này, chưa lưu lại.');
    } else if(mode==='default'){
      showToast('Đã khôi phục cài đặt cột về mặc định (chỉ áp dụng cho lượt xem này).');
    }
    state.showIAColumnPicker = false;
    state.iaColPickerDraftVisible = null;
    state.iaColPickerDraftOrder = null;
  }

  // =====================================================================
  // Dữ liệu "đã đóng lãi" (phê duyệt đóng lãi) — lưu theo TỪNG khoảng thời gian (tổ hợp Quý+Năm cụ
  // thể đang chọn ở bộ lọc) riêng biệt, dạng secretdata/{secretId}/interestApprovals/{filterKey}.
  // =====================================================================
  function interestApprovalFilterKey(){
    ensureTimelineFilterInit('main');
    const legacy = deriveLegacyFilterFromTimeline();
    if(legacy) return legacy.filterQuarters.join('-') + '__' + legacy.filterYears.join('-');
    // Lựa chọn mới (trước đây không thể chọn được) -> dùng khoá định dạng mới, có tiền tố riêng biệt
    // để không bao giờ trùng với bất kỳ khoá định dạng cũ nào đã từng được lưu.
    return 'tl:' + state.mainTimeline.join('-');
  }
  function ensureInterestApprovalDraft(){
    const key = interestApprovalFilterKey();
    if(state.interestApprovalDraftKey !== key){
      const saved = (state.interestApprovals && state.interestApprovals[key]) || {};
      state.interestApprovalDraft = new Set(Object.keys(saved));
      state.interestApprovalDraftKey = key;
    }
    return state.interestApprovalDraft;
  }
  function toggleInterestApprovalOne(id, checked){
    const draft = ensureInterestApprovalDraft();
    if(checked) draft.add(id); else draft.delete(id);
  }
  function toggleInterestApprovalGroup(groupList, checked){
    const draft = ensureInterestApprovalDraft();
    groupList.forEach(b=>{ if(checked) draft.add(b.id); else draft.delete(b.id); });
  }
  async function saveInterestApprovalDraft(){
    if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể lưu phê duyệt thật. Vui lòng đăng nhập hoặc tham gia bằng mã định danh.'); return; }
    if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn nên không thể phê duyệt/lưu. Vui lòng liên hệ Chủ mã định danh để được cấp quyền Sửa trước.'); return; }
    const draft = ensureInterestApprovalDraft();
    const key = state.interestApprovalDraftKey;
    const obj = {}; draft.forEach(id=> obj[id]=true);
    await cSet('interestApprovals/'+key, obj);
    await pushLog('phê duyệt', `đóng lãi cho khoảng thời gian đang chọn (${key})`);
    showToast('Đã lưu phê duyệt thành công!');
    state.showInterestApprovalModal = false;
    state.interestApprovalDraft = null;
    state.interestApprovalDraftKey = null;
  }
  function cancelInterestApprovalModal(){
    state.showInterestApprovalModal = false;
    state.interestApprovalDraft = null;
    state.interestApprovalDraftKey = null;
    state.showIAColumnPicker = false;
  }

  // Yêu cầu mới: hiển thị người vay nhóm RIÊNG BIỆT theo từng Phương án vay (mỗi phương án 1 khu
  // vực/bảng riêng có tiêu đề tên phương án), thay vì gộp chung 1 bảng phẳng.
  // "X năm Y tháng Z ngày" — ẩn hẳn phần năm nếu năm=0; ẩn hẳn phần ngày nếu ngày=0; phần tháng chỉ ẩn
  // khi = 0 NHƯNG không có phần ngày theo sau (có ngày theo sau thì vẫn hiện "0 tháng" để nối liền
  // mạch, ví dụ "3 năm 0 tháng 10 ngày"). Dùng để hiện "thời hạn" của phương án vay ở tiêu đề nhóm.
  // Số tiền KHÔNG HOẠT ĐỘNG của 1 phương án vay = Tổng vốn - tổng dư nợ của các người vay ĐANG hoạt
  // động thuộc phương án đó (bao gồm cả phần chưa giải ngân, VÀ phần đã tất toán/TNTH mà không có
  // người thừa kế tiếp nhận). Trả về chuỗi rỗng nếu toàn bộ vốn đang hoạt động (không cần hiện thêm).
  function projectInactiveAmountTxt(proj){
    if(!proj) return '';
    const totalCapital = parseFloat(proj.totalCapital)||0;
    const activeSum = state.borrowers.filter(b=>!b.deleted && !b.settled && b.projectId===proj.id).reduce((s,b)=>s+(parseFloat(b.principal)||0),0);
    const inactive = Math.round((totalCapital - activeSum)*100)/100;
    if(inactive<=0) return '';
    return `, còn ${groupDigitsRight(String(Math.round(inactive)),3)} đ không hoạt động`;
  }
  // Bản THÔ (số, không định dạng chuỗi) của "Số tiền còn lại không hoạt động" — dùng cho cột riêng
  // trong bảng Danh sách Phương án vay. Y HỆT công thức trên (Tổng vốn - tổng dư nợ của người ĐANG
  // hoạt động), chỉ khác là KHÔNG cắt về 0 khi âm/bằng 0 — trả đúng số thực tế luôn.
  function projectInactiveAmountRaw(proj){
    if(!proj) return 0;
    const totalCapital = parseFloat(proj.totalCapital)||0;
    const activeSum = state.borrowers.filter(b=>!b.deleted && !b.settled && b.projectId===proj.id).reduce((s,b)=>s+(parseFloat(b.principal)||0),0);
    return Math.round((totalCapital - activeSum)*100)/100;
  }
  // Đếm số HỘ THAM GIA của 1 phương án vay — tính TẤT CẢ (đang hoạt động lẫn đã tất toán/TNTH xong),
  // riêng "người trả nợ trước hạn" + "người thừa kế của họ" được gộp lại tính là ĐÚNG 1 người.
  function projectParticipantCount(projId){
    const members = state.borrowers.filter(b=>!b.deleted && b.projectId===projId);
    const countedIds = new Set();
    let count = 0;
    members.forEach(b=>{
      if(b.isHeir && b.heirOfBorrowerId){
        if(!countedIds.has(b.heirOfBorrowerId)){ countedIds.add(b.heirOfBorrowerId); count++; }
        return;
      }
      if(countedIds.has(b.id)) return;
      countedIds.add(b.id);
      count++;
    });
    return count;
  }
  function calcLoanDuration(startStr, endStr){
    if(!startStr || !endStr) return '';
    const start = new Date(startStr+'T00:00:00');
    const end = new Date(endStr+'T00:00:00');
    if(isNaN(start.getTime()) || isNaN(end.getTime()) || end<start) return '';
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();
    if(days<0){ months -= 1; days += new Date(end.getFullYear(), end.getMonth(), 0).getDate(); }
    if(months<0){ years -= 1; months += 12; }
    const parts = [];
    if(years>0) parts.push(`${years} năm`);
    if(months>0 || days>0) parts.push(`${months} tháng`);
    if(days>0) parts.push(`${days} ngày`);
    return parts.join(' ');
  }
  // Số ngày còn lại tính từ hôm nay (theo lịch hiện hành) tới Ngày đến hạn — có thể âm nếu đã quá hạn.
  function daysRemainingUntil(dueDateStr){
    if(!dueDateStr) return null;
    const due = new Date(dueDateStr+'T00:00:00');
    if(isNaN(due.getTime())) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((due-today)/86400000);
    // Yêu cầu mới: khi về tới 0 thì DỪNG LẠI ở 0, không cho chạy tiếp thành số âm nữa.
    return Math.max(0, diff);
  }
  // Bản KHÔNG BỊ CHẶN SỐ ÂM của daysRemainingUntil — dùng cho MỌI logic cần biết chính xác đã quá
  // hạn bao nhiêu ngày (phát hiện "quá hạn chưa xử lý", tô màu nền theo dải ngày...). daysRemaining
  // Until ở trên CHỈ dùng để HIỂN THỊ "còn X ngày" cho người dùng xem (không hiện số âm khó hiểu) —
  // TUYỆT ĐỐI không được dùng hàm đó cho các phép so sánh d<0, nếu không điều kiện sẽ luôn sai.
  function rawDaysRemaining(dueDateStr){
    if(!dueDateStr) return null;
    const due = new Date(dueDateStr+'T00:00:00');
    if(isNaN(due.getTime())) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.round((due-today)/86400000);
  }
  function daysRemainingLabel(dueDateStr){
    const d = daysRemainingUntil(dueDateStr);
    return d==null ? '' : `còn ${d} ngày`;
  }
  // Màu nền cả dòng theo mức khẩn cấp của "Thời gian còn lại": 90-61 ngày xanh green nhạt, 60-31
  // ngày xanh cyan nhạt, 30-1 ngày vàng nhạt, 0 ngày (và quá hạn) đỏ nhạt.
  // Màu nền cả dòng theo mức khẩn cấp của "Thời gian còn lại" (SO VỚI NGÀY ĐẾN HẠN GỐC — không phải
  // ngày gia hạn lần N): 90-61 ngày vàng nhạt, 60-31 ngày cam nhạt, 30-0 ngày (và quá hạn) tím nhạt
  // (magenta nhạt). Người đang gia hạn lần bất kỳ luôn tô đỏ nhạt riêng (xem borrowerRowHtml).
  function daysRemainingRowColor(dueDateStr){
    const d = daysRemainingUntil(dueDateStr);
    if(d==null) return '';
    if(d<=30) return activeLoanColor('d30');
    if(d<=60) return activeLoanColor('d60');
    if(d<=90) return activeLoanColor('d90');
    if(d<=120) return activeLoanColor('d120');
    return activeLoanColor('notdue');
  }
  // Hộ vay ĐÃ QUÁ HẠN (so với Ngày đến hạn, hoặc Ngày gia hạn gần nhất nếu có) mà CHƯA được xử lý gì
  // cả (chưa tất toán, chưa gia hạn tiếp, chưa đưa vào Nợ rủi ro) — cần cảnh báo nổi bật để xã/phường
  // biết mà xử lý ngay, đẩy lên đầu danh sách trong Panel "Khoản vay đang hoạt động".
  function borrowerIsOverdueUnhandled(b){
    if(b.deleted || b.settled || b.riskDebt) return false;
    const exts = getBorrowerExtensions(b.id);
    const proj = projectOf(b);
    const dueRef = exts.length? exts[exts.length-1].to : (proj? proj.dueDate : b.dueDate);
    const d = rawDaysRemaining(dueRef);
    return d!=null && d<0;
  }
  // Các cột tiền tệ -> lấy TỔNG (SUM); các cột ngày/phương án/nguồn vay -> lấy GIÁ TRỊ GIỐNG NHAU
  // của cả nhóm (vì cùng 1 phương án thì các trường này ai cũng như ai); còn lại để trống.
  const BORROWER_TOTAL_SUM_KEYS = ['principal','quarterInterestAmount','splitCentralAmt','splitProvinceAmt','splitWardAmt','hamletAllocAmt','interestOutstanding','overdueDebtAmount'];
  const BORROWER_TOTAL_SAME_KEYS = ['project','loanDate','dueDate','fundSource','interestFromDate','interestToDate'];
  function computeBorrowerColumnSum(key, groupList){
    switch(key){
      case 'principal': return groupList.reduce((s,b)=> s+(parseFloat(b.principal)||0), 0);
      case 'quarterInterestAmount': return groupList.reduce((s,b)=> s+computeCurrentQuarterInterest(b), 0);
      case 'splitCentralAmt': return groupList.reduce((s,b)=> s+computeBorrowerAllocations(b).central, 0);
      case 'splitProvinceAmt': return groupList.reduce((s,b)=> s+computeBorrowerAllocations(b).province, 0);
      case 'splitWardAmt': return groupList.reduce((s,b)=> s+computeBorrowerAllocations(b).ward, 0);
      case 'hamletAllocAmt': return groupList.reduce((s,b)=> s+computeBorrowerAllocations(b).hamlet, 0);
      default: return 0; // interestOutstanding/overdueDebtAmount: chưa có dữ liệu thật, tổng tạm = 0
    }
  }
  function wardFullLabel(){ return `${adminLevelLabel()} ${(state.config&&state.config.wardName)||''}`.trim(); }
  // Giá trị 1 ô ở dòng tổng hợp (dòng TỔNG mỗi phương án, hoặc dòng {Thống kê chung}) — cho phép
  // ghi đè riêng cột "name"/"hamlet" theo ngữ cảnh gọi (opts.nameOverride/hamletOverride).
  function borrowerAggregateCellValue(colKey, groupList, opts){
    opts = opts || {};
    if(colKey==='name') return opts.nameOverride!=null ? opts.nameOverride : 'TỔNG';
    if(colKey==='hamlet') return opts.hamletOverride!=null ? opts.hamletOverride : wardFullLabel();
    if(BORROWER_TOTAL_SUM_KEYS.includes(colKey)) return moneySpaced(computeBorrowerColumnSum(colKey, groupList));
    if(BORROWER_TOTAL_SAME_KEYS.includes(colKey)){
      if(!groupList.length) return '';
      const col = BORROWER_COLUMNS().find(c=>c.key===colKey);
      return col ? col.get(groupList[0]) : '';
    }
    return '';
  }

  // Bảng {Thống kê chung} — KHÔNG có tiêu đề, đặt phía TRÊN bảng phương án vay đầu tiên. Tổng hợp
  // TOÀN BỘ người vay đang hiển thị (theo đúng bộ lọc hiện dùng), không phân biệt phương án. Cột
  // "Họ và tên" đổi nhãn hiển thị thành "Địa phương" (không đổi tên cột thật ở nơi khác), cột "Đơn
  // vị" bị ẨN hẳn khỏi bảng này.
  // Tính đầy đủ 16 cột thống kê chi tiết (A-P) cho 1 Địa phương cụ thể (hamletFilter = tên Ấp/Khu
  // phố) hoặc TOÀN XÃ (hamletFilter = null) — dùng cho modal Excel khi bấm vào tên địa phương trong
  // bảng Thống kê chung.
  function computeHamletRowDetailCols(hamletFilter){
    const matchHamlet = b=> hamletFilter==null || b.hamlet===hamletFilter;
    const activeList = state.borrowers.filter(b=>!b.deleted && !b.settled && !b.riskDebt && matchHamlet(b));
    const settledList = state.borrowers.filter(b=>!b.deleted && b.settled && matchHamlet(b));
    const riskProcessing = state.borrowers.filter(b=>!b.deleted && !b.settled && b.riskDebt && !b.badDebt && matchHamlet(b));
    const badDebtList = state.borrowers.filter(b=>!b.deleted && !b.settled && b.riskDebt && b.badDebt && matchHamlet(b));
    const allEverCount = activeList.length + settledList.length + riskProcessing.length + badDebtList.length;
    const B = activeList.length;
    const C = activeList.reduce((s,b)=> s+(parseFloat(b.principal)||0), 0);
    let D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0;
    // 4 Quý gần nhất: hiện tại (N), N-1, N-2, N-3 — dùng đúng chuỗi thời gian thực tế của khoản vay
    // (bx.qk/bx.year của TỪNG hộp Quý), không suy diễn cứng theo lịch dương thông thường.
    const curYear = new Date().getFullYear();
    const curQNum = parseInt(todayBasedQuarterKey().replace('q',''),10);
    function quarterGoBackLocal(qNum, year, offset){
      let q = qNum - offset, y = year;
      while(q<1){ q+=4; y-=1; }
      return { qNum:q, year:y, qk:'q'+q };
    }
    const qN = { qNum:curQNum, year:curYear, qk:'q'+curQNum };
    const qN1 = quarterGoBackLocal(curQNum, curYear, 1);
    const qN2 = quarterGoBackLocal(curQNum, curYear, 2);
    const qN3 = quarterGoBackLocal(curQNum, curYear, 3);
    let H1=0, H2=0, H3=0, H4=0; // tiền lãi ĐÃ ĐÓNG của N, N-1, N-2, N-3
    let Y1=0, Y2=0; // tiền lãi ĐÃ ĐÓNG của Năm hiện tại, Năm ngoái (cộng dồn cả 4 quý trong năm đó)
    activeList.forEach(b=>{
      const disp = computeInterestPaymentBoxDisplay(b);
      const curBox = borrowerCurrentQuarterBox(b);
      if(curBox){
        if(disp.paidKeys.has(curBox.key)) D++;
        else { E++; F += curBox.interestAmount||0; }
      }
      if(disp.unpaidLines.length>0) G++;
      H += disp.unpaidTotal||0;
      disp.allBoxes.forEach(bx=>{
        if(!disp.paidKeys.has(bx.key)) return;
        if(bx.qk===qN.qk && bx.year===qN.year) H1 += bx.interestAmount||0;
        else if(bx.qk===qN1.qk && bx.year===qN1.year) H2 += bx.interestAmount||0;
        else if(bx.qk===qN2.qk && bx.year===qN2.year) H3 += bx.interestAmount||0;
        else if(bx.qk===qN3.qk && bx.year===qN3.year) H4 += bx.interestAmount||0;
        if(bx.year===curYear) Y1 += bx.interestAmount||0;
        else if(bx.year===curYear-1) Y2 += bx.interestAmount||0;
      });
      const overdueUnhandled = borrowerIsOverdueUnhandled(b);
      const exts = getBorrowerExtensions(b.id);
      if(overdueUnhandled) K++;
      else if(exts.length>0) L++;
      else I++; // Hộ trong hạn = TOÀN BỘ hộ không quá hạn, không đang gia hạn — kể cả chỉ còn 1 ngày vẫn tính là trong hạn.
      // "Gần đến hạn ≤60 ngày" là 1 tập con THÔNG TIN THÊM (có thể trùng với "trong hạn" ở trên, không
      // phải 1 nhóm loại trừ riêng) — khớp đúng logic chuẩn dùng ở Tất toán/Gia hạn nợ/Nợ rủi ro.
      if(!overdueUnhandled && !(exts.length>0)){
        const proj = projectOf(b);
        const d = rawDaysRemaining(proj? proj.dueDate : b.dueDate);
        if(d!=null && d<=60) J++;
      }
    });
    // Nhãn Quý — nếu năm khác năm hiện tại thì thêm "-năm" vào sau, VD: "Quý 4-2025"
    const qLabel = (q)=> `Quý ${q.qNum}${q.year!==curYear? '-'+q.year : ''}`;
    return {
      hamletLabel: hamletFilter==null? wardFullLabel() : `${subAdminLabel()} ${hamletFilter}`,
      B, C, D, E, F, G, H, I, J, K, L,
      M: riskProcessing.length, N: badDebtList.length, O: settledList.length, P: allEverCount,
      H1, H2, H3, H4, qLabelN: qLabel(qN), qLabelN1: qLabel(qN1), qLabelN2: qLabel(qN2), qLabelN3: qLabel(qN3),
      Y1, Y2, yearN: curYear, yearN1: curYear-1,
    };
  }
  function renderBorrowerOverallStatsHtml(list, visibleCols, hamlets){
    const restCols = visibleCols.slice(1).filter(c=>c.key!=='hamlet'); // ẨN hẳn cột Đơn vị ở bảng này
    const nameHeaderLabel = 'Địa phương';
    ensureFilterHamletsInit(hamlets);
    const selHamlets = state.filterHamlets;
    const allSelected = selHamlets.length===0 || selHamlets.length===hamlets.length;
    const orderedHamlets = allSelected ? [] : selHamlets.filter(h=>h!=='Khác').concat(selHamlets.includes('Khác')? ['Khác'] : []);
    // "Tất cả ấp" -> gộp 1 hàng toàn xã; chọn 1 hoặc nhiều ấp cụ thể -> mỗi ấp 1 hàng riêng.
    const rows = allSelected
      ? [{ label: wardFullLabel(), groupList: list, hamletKey:'__all__' }]
      : orderedHamlets.map(h=> ({ label: `${subAdminLabel()} ${h}`, groupList: list.filter(b=>b.hamlet===h), hamletKey:h }));
    state._svStatsCache = { rows, restCols };
    const rowsHtml = rows.map(r=>{
      const cellVal = (colKey)=> borrowerAggregateCellValue(colKey, r.groupList, { nameOverride: r.label });
      return `<tr>
        <td class="sv-sticky-1" style="background:var(--white);"></td>
        <td class="sv-sticky-2" style="background:var(--white); font-weight:700;"><span class="dancing-project-name preview-allow" data-hamlet-stat-row="${escapeHtml(r.hamletKey)}">${escapeHtml(r.label)}</span></td>
        ${restCols.map(c=>`<td class="${c.align==='right'?'money':''}">${cellVal(c.key)}</td>`).join('')}
      </tr>`;
    }).join('');
    return `
      <div class="table-wrap" style="margin-bottom:18px;">
        <table>
          <thead><tr>
            <th class="sv-sticky-1 sv-group-header-th"></th>
            <th class="sv-sticky-2 sv-group-header-th"><span class="dancing-header preview-allow" style="color:#6a1b9a;" data-header-scope="all">${escapeHtml(nameHeaderLabel)}</span></th>
            ${restCols.map(c=>`<th>${htmlLabel(c.key==='principal'? 'Tổng dư nợ' : c.label)}</th>`).join('')}
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  // Hàng của 1 người vay trong bảng Danh sách người vay — DÙNG CHUNG cho cả khung "Quá hạn chưa xử
  // lý" (pinned, không kéo-thả được) lẫn khung bình thường (có thể kéo-thả khi đang Sắp xếp).
  function borrowerRowHtml(b, nameCol, restCols, sortingThis, gid, forcePinned){
    const exts = getBorrowerExtensions(b.id);
    const overdueUnhandled = borrowerIsOverdueUnhandled(b);
    const isExtended = exts.length>0; // đang được gia hạn (bất kỳ lần nào 1-5)
    const rowColor = overdueUnhandled ? activeLoanColor('overdue') : isExtended ? activeLoanColor('extended') : daysRemainingRowColor(projectOf(b)? projectOf(b).dueDate : b.dueDate);
    const textStyle = overdueUnhandled ? ' color:#b71c1c; font-weight:700;' : '';
    return `<tr${sortingThis&&!forcePinned? ` draggable="true" data-drag-borrower="${b.id}" data-drag-borrower-project="${gid}"` : ''}${rowColor? ` style="background:${rowColor};${textStyle}"` : (textStyle? ` style="${textStyle}"` : '')}>
      <td class="sv-sticky-1" style="background:var(--white); ${sortingThis&&!forcePinned?'cursor:grab;':''}">${(sortingThis&&!forcePinned)? `<span title="Kéo để đổi vị trí">☰</span>` : `<button class="btn btn-ghost btn-sm" data-view="${b.id}" title="Xem/Sửa" style="padding:4px 8px;">✏️</button>`}</td>
      <td class="sv-sticky-2 sv-col-wrap-check" style="background:var(--white);${textStyle} ${svColStyle({key:'name', label:'Họ và tên', userInput:true})}">${overdueUnhandled? '⚠️ ' : ''}${nameCol? (nameCol.key==='name' ? (b.isHeir? `<u>${dancingNameHtml(b)}</u>` : dancingNameHtml(b)) : (b.isHeir? `<u>${nameCol.get(b)}</u>` : nameCol.get(b))) : ''}</td>
      ${restCols.map(c=>`<td class="${c.align==='right'?'money':'sv-col-wrap-check'}" style="${textStyle} ${svColStyle(c)}">${c.get(b)}</td>`).join('')}
    </tr>`;
  }
  // Panel RIÊNG BIỆT "⚠️ Khoản vay quá hạn nhưng chưa được xử lý" — hoàn toàn độc lập, KHÔNG có bộ
  // lọc/tuỳ chỉnh cột riêng, dùng ĐÚNG bộ cột đang cấu hình ở Panel "Khoản vay đang hoạt động"
  // (visibleCols), nhưng danh sách bên trong KHÔNG bao giờ bị bộ lọc Ấp/Phương án/Quý/Năm/Tìm kiếm...
  // ảnh hưởng — luôn hiện đủ 100% hộ quá hạn chưa xử lý trên toàn xã. Ẩn hẳn nếu rỗng.
  function buildOverdueUnhandledPanelHtml(overdueList, visibleCols, projectsRaw){
    state._svOverdueListCache = { overdueList, visibleCols };
    if(!overdueList.length) return '';
    const projects = sortedActiveProjects(projectsRaw);
    const nameCol = visibleCols[0], restCols = visibleCols.slice(1);
    const groups = {};
    overdueList.forEach(b=>{
      const key = (b.projectId && projects.some(p=>p.id===b.projectId)) ? b.projectId : '__none__';
      (groups[key] = groups[key]||[]).push(b);
    });
    const groupOrder = projects.map(p=>p.id).filter(pid=>groups[pid]);
    if(groups['__none__']) groupOrder.push('__none__');
    return groupOrder.map(gid=>{
      const groupList = groups[gid];
      const proj = gid==='__none__' ? null : projects.find(p=>p.id===gid);
      const projName = proj ? escapeHtml(proj.name) : '(Không rõ phương án — có thể đã bị xoá)';
      return `
      <div style="margin-bottom:18px;">
        <div class="sv-group-header" style="background:linear-gradient(180deg, #ffffff 0%, rgba(211,47,47,.20) 55%, rgba(211,47,47,.42) 100%); border:2px solid #b71c1c; display:flex; align-items:center; gap:6px;"><span style="color:#b71c1c; font-weight:800;">⚠️ Quá hạn chưa được xử lý —</span><span style="color:#b71c1c; font-weight:800;">📋 ${projName} (${groupList.length} người vay)</span></div>
        <div class="table-wrap" style="border-color:#2e7d32; border-width:2px;">
          <table>
            <thead><tr>
              <th class="sv-sticky-1"></th>
              <th class="sv-sticky-2">${nameCol? escapeHtml(nameCol.label) : ''}</th>
              ${restCols.map(c=>`<th>${htmlLabel(c.label)}</th>`).join('')}
            </tr></thead>
            <tbody>${groupList.map(b=> borrowerRowHtml(b, nameCol, restCols, false, gid, true)).join('')}</tbody>
          </table>
        </div>
      </div>`;
    }).join('');
  }
  function renderBorrowerGroupedTablesHtml(list, visibleCols, projectsRaw, canEdit){
    state._svActiveListCache = { list, visibleCols };
    if(!list.length) return `<div class="empty-state"><div class="e-ico">🌾</div>Chưa có người vay nào theo bộ lọc hiện tại</div>`;
    const projects = sortedActiveProjects(projectsRaw); // đồng bộ đúng thứ tự tuỳ chỉnh với panel Phương án vay
    const groups = {};
    list.forEach(b=>{
      const key = (b.projectId && projects.some(p=>p.id===b.projectId)) ? b.projectId : '__none__';
      (groups[key] = groups[key]||[]).push(b);
    });
    const groupOrder = projects.map(p=>p.id).filter(pid=>groups[pid]);
    if(groups['__none__']) groupOrder.push('__none__');
    const statsHtml = renderBorrowerOverallStatsHtml(list, visibleCols, state.config.hamlets||[]);
    const groupsHtml = groupOrder.map(gid=>{
      const rawGroupList = groups[gid];
      const proj = gid==='__none__' ? null : projects.find(p=>p.id===gid);
      const projName = proj ? escapeHtml(proj.name) : '(Không rõ phương án — có thể đã bị xoá)';
      const duration = proj ? calcLoanDuration(proj.disburseDate, proj.dueDate) : '';
      const capitalTxt = proj ? `, ${groupDigitsRight(String(Math.round(proj.totalCapital||0)),3)} đồng` : '';
      const durationTxt = duration ? `, ${duration}` : '';
      const inactiveTxt = proj ? projectInactiveAmountTxt(proj) : '';
      const nameCol = visibleCols[0]; // luôn là cột "Họ và tên" vì đã khoá cứng đứng đầu tiên
      const restCols = visibleCols.slice(1);
      const sortingThis = state.sortingBorrowersProjectId===gid;
      const groupList = sortingThis && state._borrowerSortDraft
        ? state._borrowerSortDraft.map(id=>rawGroupList.find(b=>b.id===id)).filter(Boolean)
        : sortedBorrowerGroup(rawGroupList, gid);
      if(sortingThis && !state._borrowerSortDraft) state._borrowerSortDraft = groupList.map(b=>b.id);
      return `
      <div style="margin-bottom:18px;">
        <div class="sv-group-header" style="background:${projectGroupHeaderBg(gid)}; display:flex; align-items:center; gap:6px;">${(canEdit && gid!=='__none__')? `<button type="button" class="btn-plain-icon preview-allow" data-borrower-sort-toggle="${gid}" title="Sắp xếp danh sách" style="font-size:15px; cursor:pointer; background:none; border:none;">☰</button>` : ''}<span>📋 ${projName} (${rawGroupList.length} người vay)${capitalTxt}${durationTxt}${inactiveTxt}</span></div>
        ${sortingThis? `<div style="margin:8px 0;">
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary btn-sm preview-allow" data-borrower-sort-save="${gid}">💾 Lưu lại thứ tự sắp xếp</button>
            <button class="btn btn-ghost btn-sm preview-allow" data-borrower-sort-cancel="${gid}">Huỷ (không lưu sắp xếp)</button>
          </div>
          <p class="sub drag-hint-cycle" style="margin:6px 0 0;">Bấm vào các tên phía dưới và kéo thả để thay đổi vị trí trong danh sách.</p>
        </div>` : ''}
        <div class="table-wrap" style="border-color:#2e7d32; border-width:2px;">
          <table>
            <thead><tr>
              <th class="sv-sticky-1"></th>
              <th class="sv-sticky-2" style="${svColStyleHeader({key:'name', label:'Họ và tên', userInput:true})}">${nameCol? `<span class="dancing-header preview-allow" data-header-scope="${gid}">${escapeHtml(nameCol.label)}</span>` : ''}</th>
              ${restCols.map(c=>`<th style="${svColStyleHeader(c)}">${htmlLabel(c.label)}</th>`).join('')}
            </tr></thead>
            <tbody>${groupList.map(b=> borrowerRowHtml(b, nameCol, restCols, sortingThis, gid, false)).join('')}
            <tr style="background:var(--paper-2); font-weight:700;">
              <td class="sv-sticky-1" style="background:var(--paper-2);"></td>
              <td class="sv-sticky-2" style="background:var(--paper-2);">${borrowerAggregateCellValue('name', rawGroupList)}</td>
              ${restCols.map(c=>`<td class="${c.align==='right'?'money':''}">${borrowerAggregateCellValue(c.key, rawGroupList)}</td>`).join('')}
            </tr>
            </tbody>
          </table>
        </div>
      </div>`;
    }).join('');
    return statsHtml + groupsHtml;
  }

  // Bảng nhóm dành riêng cho modal "Tính tiền lãi và phê duyệt đóng lãi" — cột đầu là checkbox "Đã
  // đóng lãi" (không phải icon bút). Dòng TỔNG mỗi phương án cũng có checkbox chọn/bỏ chọn CẢ NHÓM,
  // đồng bộ 2 chiều giống hệt kiểu "Tất cả" đã dùng ở các bộ lọc khác.
  // Bảng {thống kê chung} riêng cho modal "Tính tiền lãi và phê duyệt đóng lãi" — các con số là TỔNG
  // của đúng những gì đang hiển thị ở danh sách người vay phía dưới.
  function renderIAOverallStatsHtml(list, hamlets){
    ensureFilterHamletsInit(hamlets);
    const selHamlets = state.filterHamlets;
    const allSelected = selHamlets.length===0 || selHamlets.length===hamlets.length;
    // "Khác" luôn đứng CUỐI danh sách của bảng {thống kê chung} khi không chọn tất cả địa phương.
    const orderedHamlets = allSelected ? [] : selHamlets.filter(h=>h!=='Khác').concat(selHamlets.includes('Khác')? ['Khác'] : []);
    const rows = allSelected
      ? [{ label: wardFullLabel(), groupList: list }]
      : orderedHamlets.map(h=> ({ label:`${subAdminLabel()} ${h}`, groupList: list.filter(b=>b.hamlet===h) }));
    const curQNum = todayBasedQuarterKey().replace('q','');
    const rowsHtml = rows.map(r=>{
      let curUnpaidCount=0, curUnpaidAmt=0, curPaidCount=0, pastUnpaidHouseholds=0, pastUnpaidAmt=0, principalSum=0;
      r.groupList.forEach(b=>{
        principalSum += parseFloat(b.principal)||0;
        const curBox = borrowerCurrentQuarterBox(b);
        const disp = computeInterestPaymentBoxDisplay(b);
        if(curBox){
          if(disp.paidKeys.has(curBox.key)) curPaidCount++;
          else { curUnpaidCount++; curUnpaidAmt += curBox.interestAmount; }
        }
        if(disp.unpaidLines.length>0){ pastUnpaidHouseholds++; pastUnpaidAmt += disp.unpaidTotal; }
      });
      return `<tr>
        <td class="frz-stat1" style="font-weight:700; background:var(--white);">${escapeHtml(r.label)}</td>
        <td>${curPaidCount} hộ</td>
        <td>${curUnpaidCount} hộ</td>
        <td class="money">${moneySpaced(curUnpaidAmt)}</td>
        <td>${pastUnpaidHouseholds} hộ</td>
        <td class="money">${moneySpaced(pastUnpaidAmt)}</td>
        <td class="money">${moneySpaced(principalSum)}</td>
      </tr>`;
    }).join('');
    return `
      <div class="table-wrap" style="margin-bottom:18px;">
        <table>
          <thead><tr>
            <th class="sv-group-header-th frz-stat1">Địa phương</th>
            <th class="sv-group-header-th">Số hộ đã đóng<br>(Quý ${curQNum} hiện tại)</th>
            <th class="sv-group-header-th">Số hộ chưa đóng<br>(Quý ${curQNum} hiện tại)</th>
            <th class="sv-group-header-th">Tiền lãi chưa đóng<br>(Quý ${curQNum} hiện tại)</th>
            <th class="sv-group-header-th">Số hộ chưa đóng<br>(quá khứ đến hiện tại)</th>
            <th class="sv-group-header-th">Tiền lãi chưa đóng<br>(quá khứ đến hiện tại)</th>
            <th class="sv-group-header-th">Tổng dư nợ</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }
  // Bảng nhóm theo phương án cho modal "Tính tiền lãi và phê duyệt đóng lãi" — ĐÚNG 10 cột cố định,
  // không còn tuỳ chỉnh cột nữa: Thông tin đóng lãi | Quyết định | Họ và tên | Đơn vị | Tiền lãi
  // (Quý X hiện tại) | Các quý chưa đóng (quá khứ đến hiện tại) | Tiền lãi chưa đóng (quá khứ đến
  // hiện tại) | Tiền đã đóng dư chưa thuộc về quý nào | Số tiền vay gốc | Lãi suất (%/năm).
  function renderIAGroupedTablesHtml(list, projectsRaw){
    if(!list.length) return `<div class="empty-state"><div class="e-ico">🌾</div>Chưa có người vay nào theo bộ lọc hiện tại</div>`;
    const projects = sortedActiveProjects(projectsRaw);
    const curQNum = todayBasedQuarterKey().replace('q','');
    const statsHtml = renderIAOverallStatsHtml(list, state.config.hamlets||[]);
    function renderOneGroup(gid, groupListRaw, isOverdueBox){
      const groupList = isOverdueBox ? groupListRaw : sortedBorrowerGroup(groupListRaw, gid);
      const proj = gid==='__none__' ? null : projects.find(p=>p.id===gid);
      const projName = proj ? escapeHtml(proj.name) : '(Không rõ phương án — có thể đã bị xoá)';
      const duration = proj ? calcLoanDuration(proj.disburseDate, proj.dueDate) : '';
      const capitalTxt = proj ? `, ${groupDigitsRight(String(Math.round(proj.totalCapital||0)),3)} đồng` : '';
      const durationTxt = duration ? `, ${duration}` : '';
      const inactiveTxt = proj ? projectInactiveAmountTxt(proj) : '';
      const headerHtml = isOverdueBox
        ? `<span style="color:#b71c1c; font-weight:800;">⚠️ Quá hạn chưa được xử lý —</span><span>📋 ${projName} (${groupList.length} người vay)</span>`
        : `📋 ${projName} (${groupList.length} người vay)${capitalTxt}${durationTxt}${inactiveTxt}`;
      const headerBg = isOverdueBox ? rgbaToGradient('rgba(211,47,47,.16)') : projectGroupHeaderBg(gid);
      return `
      <div style="margin-bottom:18px;">
        <div class="sv-group-header" style="background:${headerBg}; display:flex; align-items:center; gap:6px;">${headerHtml}</div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th class="frz-col1" style="background:var(--paper-2); min-width:110px;"><span class="wide-action-pair">Thông tin đóng lãi</span><span class="narrow-action-pair"></span></th>
              <th class="frz-col2 narrow-action-pair-col2" style="background:var(--paper-2); min-width:110px;">Quyết định</th>
              <th class="frz-col3" style="background:var(--paper-2); ${svColStyleHeader({key:'name',label:'Họ và tên', userInput:true})}">Họ và tên</th>
              <th style="${svColStyleHeader({key:'hamlet',label:'Đơn vị', userInput:true})}">Đơn vị</th>
              <th style="${svColStyleHeader({align:'right',label:`Tiền lãi (Quý ${curQNum} hiện tại) (đ)`})}">Tiền lãi<br>(Quý ${curQNum} hiện tại)</th>
              <th style="${svColStyleHeader({label:'Các quý chưa đóng (quá khứ đến hiện tại)', isQuarter:true})}">Các quý chưa đóng<br>(quá khứ đến hiện tại)</th>
              <th style="${svColStyleHeader({align:'right',label:'Tiền lãi chưa đóng (quá khứ đến hiện tại) (đ)'})}">Tiền lãi chưa đóng<br>(quá khứ đến hiện tại)</th>
              <th style="${svColStyleHeader({align:'right',label:'Tiền đã đóng dư chưa thuộc về quý nào (đ)'})}">Tiền đã đóng dư<br>chưa thuộc về quý nào</th>
              <th style="${svColStyleHeader({align:'right',label:'Số tiền vay gốc (đ)'})}">Số tiền vay gốc</th>
              <th style="${svColStyleHeader({label:'Lãi suất (%/năm)'})}">Lãi suất (%/năm)</th>
            </tr></thead>
            <tbody>${groupList.map(b=>{
              const dueRef = proj? proj.dueDate : b.dueDate;
              const exts = getBorrowerExtensions(b.id);
              const overdueUnhandled = borrowerIsOverdueUnhandled(b);
              const rowColor = overdueUnhandled ? activeLoanColor('overdue') : exts.length>0 ? activeLoanColor('extended') : daysRemainingRowColor(dueRef);
              const textStyle = overdueUnhandled ? 'color:#b71c1c; font-weight:700;' : '';
              const rowBg = rowColor || 'var(--white)';
              const dispB = computeInterestPaymentBoxDisplay(b);
              const paidCount = dispB.paidLines.length;
              const theoreticalTotalB = dispB.allBoxes.reduce((s,bx)=> s+bx.interestAmount, 0);
              const fullyPaidB = dispB.totalPaid >= theoreticalTotalB;
              const curBox = borrowerCurrentQuarterBox(b);
              const unpaidNames = dispB.unpaidLines.map(x=>x.name).join(', ');
              return `<tr${rowColor? ` style="background:${rowColor};${textStyle}"` : (textStyle?` style="${textStyle}"`:'')}>
                <td class="frz-col1" style="background:${rowBg};${textStyle}">${narrowActionPairHtml('ia-'+b.id,
                  `<button class="ext-action-btn ext-green preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-ia-hist="${b.id}"><span class="btn-full-label">Xem (${paidCount})</span><span class="btn-narrow-label">Thông tin đóng lãi (${paidCount})</span></button>`,
                  fullyPaidB? `<button class="ext-action-btn" disabled title="Hộ vay này đã đóng hết lãi, không còn nợ lãi">Đóng tiền lãi</button>` : `<button class="ext-action-btn ext-green preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-ia-pay="${b.id}">Đóng tiền lãi</button>`
                )}</td>
                <td class="frz-col2 narrow-action-pair-col2" style="background:${rowBg};${textStyle}">${fullyPaidB? `<button class="ext-action-btn" disabled title="Hộ vay này đã đóng hết lãi, không còn nợ lãi">Đóng tiền lãi</button>` : `<button class="ext-action-btn ext-green preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-ia-pay="${b.id}">Đóng tiền lãi</button>`}</td>
                <td class="frz-col3 sv-col-wrap-check" style="background:${rowBg};${textStyle}${b.isHeir? ' text-decoration:underline;' : ''} ${svColStyle({key:'name',label:'Họ và tên', userInput:true})}">${overdueUnhandled?'⚠️ ':''}${escapeHtml(b.name)}</td>
                <td class="sv-col-wrap-check" style="${svColStyle({key:'hamlet',label:'Đơn vị', userInput:true})}">${escapeHtml(b.hamlet||'')}</td>
                <td class="money" style="${svColStyle({align:'right',label:`Tiền lãi (Quý ${curQNum} hiện tại) (đ)`})}">${curBox? moneySpaced(curBox.interestAmount) : '—'}</td>
                <td class="sv-col-wrap-check" style="${svColStyle({label:'Các quý chưa đóng (quá khứ đến hiện tại)', isQuarter:true})}">${escapeHtml(unpaidNames)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Tiền lãi chưa đóng (quá khứ đến hiện tại) (đ)'})}">${moneySpaced(dispB.unpaidTotal)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Tiền đã đóng dư chưa thuộc về quý nào (đ)'})}">${moneySpaced(dispB.leftover)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Số tiền vay gốc (đ)'})}">${moneySpaced(b.principal)}</td>
                <td class="money" style="${svColStyle({label:'Lãi suất (%/năm)'})}">${formatRateWithOverdueHtml(b,'rate','%/năm')}</td>
              </tr>`;
            }).join('')}
            <tr style="background:var(--paper-2); font-weight:700;">
              <td class="frz-col1" style="background:var(--paper-2);">${narrowActionPairHtml('ia-total-'+gid, '', `<button class="ext-action-btn ext-green preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-shared-interest-payment="${gid}" data-shared-interest-payment-ids="${groupList.map(b=>b.id).join(',')}">Đóng tiền lãi</button>`)}</td>
              <td class="frz-col2 narrow-action-pair-col2" style="background:var(--paper-2);"><button class="ext-action-btn ext-green preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-shared-interest-payment="${gid}" data-shared-interest-payment-ids="${groupList.map(b=>b.id).join(',')}">Đóng tiền lãi</button></td>
              <td class="frz-col3" style="background:var(--paper-2);">TỔNG</td>
              <td></td>
              <td class="money">${moneySpaced(groupList.reduce((s,b)=>{ const cb=borrowerCurrentQuarterBox(b); return s+(cb?cb.interestAmount:0); },0))}</td>
              <td></td>
              <td class="money">${moneySpaced(groupList.reduce((s,b)=> s+computeInterestPaymentBoxDisplay(b).unpaidTotal, 0))}</td>
              <td class="money">${moneySpaced(groupList.reduce((s,b)=> s+computeInterestPaymentBoxDisplay(b).leftover, 0))}</td>
              <td class="money">${moneySpaced(groupList.reduce((s,b)=>s+(parseFloat(b.principal)||0),0))}</td>
              <td></td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>`;
    }
    const overdueList = list.filter(borrowerIsOverdueUnhandled);
    const normalList = list.filter(b=>!borrowerIsOverdueUnhandled(b));
    const overdueGroups = {};
    overdueList.forEach(b=>{ const key=(b.projectId && projects.some(p=>p.id===b.projectId))?b.projectId:'__none__'; (overdueGroups[key]=overdueGroups[key]||[]).push(b); });
    const overdueGroupOrder = projects.map(p=>p.id).filter(pid=>overdueGroups[pid]);
    if(overdueGroups['__none__']) overdueGroupOrder.push('__none__');
    const overdueHtml = overdueGroupOrder.map(gid=> renderOneGroup(gid, overdueGroups[gid], true)).join('');

    const groups = {};
    normalList.forEach(b=>{
      const key = (b.projectId && projects.some(p=>p.id===b.projectId)) ? b.projectId : '__none__';
      (groups[key] = groups[key]||[]).push(b);
    });
    const groupOrder = projects.map(p=>p.id).filter(pid=>groups[pid]);
    if(groups['__none__']) groupOrder.push('__none__');
    const normalHtml = groupOrder.map(gid=> renderOneGroup(gid, groups[gid], false)).join('');
    // Danh sách hộ ĐÃ tất toán/trả nợ trước hạn nhưng CÒN NỢ tiền lãi — luôn đứng ngay sau thống kê
    // chung + (nếu có) khung "quá hạn chưa xử lý", trước danh sách chính. Tự ẩn nếu không có ai.
    const settledUnpaidList = state.borrowers.filter(b=>!b.deleted && b.settled && computeInterestPaymentBoxDisplay(b).unpaidTotal>0);
    const settledUnpaidGroups = {};
    settledUnpaidList.forEach(b=>{ const key = b.projectId||'__none__'; (settledUnpaidGroups[key]=settledUnpaidGroups[key]||[]).push(b); });
    const settledUnpaidHtml = settledUnpaidList.length? `
      <div style="margin-bottom:18px;">
        <div class="sv-group-header" style="background:linear-gradient(180deg, #ffffff 0%, rgba(211,47,47,.16) 55%, rgba(211,47,47,.35) 100%);"><span style="color:#b71c1c; font-weight:800;">⚠️ Đã tất toán/trả nợ trước hạn nhưng CÒN NỢ tiền lãi (${settledUnpaidList.length} hộ)</span></div>
        ${Object.keys(settledUnpaidGroups).map(gid=>{
          const groupList = settledUnpaidGroups[gid];
          const proj = gid==='__none__'? null : projects.find(p=>p.id===gid);
          const projName = proj? escapeHtml(proj.name) : '(Không rõ phương án — có thể đã bị xoá)';
          return `
          <p style="margin:10px 0 4px; font-weight:700;">📋 ${projName}</p>
          <div class="table-wrap"><table>
            <thead><tr><th class="frz-col1" style="background:var(--paper-2); min-width:110px;"><span class="wide-action-pair">Thông tin đóng lãi</span><span class="narrow-action-pair"></span></th><th class="frz-col2 narrow-action-pair-col2" style="background:var(--paper-2); min-width:110px;">Đóng tiền lãi</th><th class="frz-col3" style="background:var(--paper-2); min-width:140px;">Họ và tên</th><th>Loại</th><th>Tiền lãi chưa đóng</th></tr></thead>
            <tbody>${groupList.map(b=>{
              const stillOwed = computeInterestPaymentBoxDisplay(b).unpaidTotal;
              const paidCount = computeInterestPaymentBoxDisplay(b).paidLines.length;
              return `<tr style="background:rgba(239,83,80,.12);">
                <td class="frz-col1">${narrowActionPairHtml('ia-settled-'+b.id,
                  `<button class="ext-action-btn ext-green preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-ia-hist="${b.id}"><span class="btn-full-label">Xem (${paidCount})</span><span class="btn-narrow-label">Thông tin đóng lãi (${paidCount})</span></button>`,
                  `<button class="ext-action-btn ext-green preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-ia-pay="${b.id}">Đóng tiền lãi</button>`
                )}</td>
                <td class="frz-col2 narrow-action-pair-col2"><button class="ext-action-btn ext-green preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-ia-pay="${b.id}">Đóng tiền lãi</button></td>
                <td class="frz-col3"${b.isHeir?' style="text-decoration:underline;"':''}>${escapeHtml(b.name)}</td>
                <td>${b.settledViaRiskDebt? 'Tất toán (hết nợ rủi ro)' : (b.settledType==='final'? 'Tất toán khoản vay' : 'Trả nợ trước hạn')}</td>
                <td class="money" style="color:var(--red); font-weight:700;">${moneySpaced(stillOwed)}</td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>`;
        }).join('')}
      </div>` : '';
    return statsHtml + overdueHtml + settledUnpaidHtml + normalHtml;
  }

  // =====================================================================
  // Modal "Tính tiền lãi và phê duyệt đóng lãi" — cấu trúc y hệt panel "Danh sách người vay" (tìm
  // kiếm, 4 bộ lọc dùng CHUNG state với panel chính, tuỳ chỉnh cột riêng) nhưng KHÔNG có nút Xuất
  // Excel/In/Thêm người vay; cột đầu mỗi bảng là checkbox "Đã đóng lãi" thay cho icon sửa.
  // =====================================================================
  // =====================================================================
  // Modal con "GIA HẠN" — mở khi bấm nút GIA HẠN của 1 người vay (hoặc dòng TỔNG cho cả nhóm).
  // targets: mảng người vay (1 phần tử nếu bấm từng dòng, nhiều phần tử nếu bấm dòng TỔNG).
  // =====================================================================
  const EXTENSION_DURATION_OPTIONS = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,6,7,8,9,10,11,12];
  function renderExtensionApprovalModal(targets, reopenParent){
    if(!targets.length) return;
    const isGroup = targets.length>1;
    const extLevel = getBorrowerExtensions(targets[0].id).length + 1; // Lần thứ mấy (đã kiểm tra đồng nhất trước khi mở)
    const lockedFrom = latestBorrowerExtension(targets[0].id) ? latestBorrowerExtension(targets[0].id).to : targets[0].dueDate;
    const sampleRate = parseFloat(targets[0].rate)||0;
    const draft = {
      to:'', duration:'other', rateType:'zero', ratePct:0, customRateInput:'',
      allocMode:'wardOnly', hamletAllocPercent:45, splitCentral:0, splitProvince:4.32, splitWard:2.28, allTiersHamletPercent:45,
    };
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    // QUAN TRỌNG: closeOnly() chỉ đóng bảng NGAY LẬP TỨC, KHÔNG kèm vẽ lại bảng cha — vì bảng cha cần
    // vẽ lại SAU KHI dữ liệu gia hạn đã thực sự lưu xong (await cSet(...) hoàn tất), không phải ngay
    // lúc vừa bấm Lưu (lúc đó dữ liệu MỚI CHƯA kịp ghi vào, vẽ lại lúc này vẫn thấy dữ liệu CŨ — đây
    // chính là lỗi khiến nút "Xem"/"GIA HẠN" không tự cập nhật mà phải đóng mở lại cả modal mới thấy).
    const closeOnly = ()=> wrap.remove();
    const close = ()=>{ closeOnly(); if(reopenParent) reopenParent(); };

    function personLabel(){ return isGroup ? 'các hộ vay này trong phương án vay' : `hộ vay ${escapeHtml(targets[0].name)}`; }
    function hoLabel(){ return isGroup ? 'Các hộ' : 'Hộ'; }

    function renderBody(){
      const pastLines = getBorrowerExtensions(targets[0].id).map((e,i)=> `${hoLabel()} này đã được gia hạn LẦN ${i+1} với ngày kết thúc là ${fmtDate(e.to)}.`).join('<br>');
      const projName = isGroup ? (activeLoanProjects().find(p=>p.id===targets[0].projectId)||{}).name || '' : '';
      const introTitle = isGroup
        ? `Gia hạn nợ gốc LẦN ${extLevel} cho các hộ vay này trong phương án vay ${escapeHtml(projName)}`
        : `Gia hạn nợ gốc LẦN ${extLevel} cho hộ vay ${escapeHtml(targets[0].name)}`;
      const introBody = isGroup
        ? `Đang thiết lập gia hạn LẦN ${extLevel} chung cho toàn bộ ${targets.length} hộ vay đang hiển thị theo bộ lọc.<br>${pastLines? pastLines+'<br>' : ''}Hãy quyết định xem các hộ này sẽ được gia hạn trả nợ gốc trong bao lâu nữa:`
        : `${hoLabel()} này được vay với số tiền gốc ${moneySpaced(targets[0].principal)}, từ ngày ${fmtDate(targets[0].loanDate)} Đến ngày ${fmtDate(targets[0].dueDate)},<br>${pastLines? pastLines+'<br>' : ''}hãy quyết định xem ${isGroup?'các hộ':'họ'} được sẽ được gia hạn trả nợ gốc trong bao lâu nữa:`;

      const rateLabel2 = `${String(sampleRate).replace('.',',')}%/năm`;
      const showAlloc = draft.rateType==='current' || (draft.rateType==='custom' && draft.ratePct>0);

      let summaryLine = '';
      if(draft.to){
        const dur = calcLoanDuration(lockedFrom, draft.to);
        summaryLine = `${hoLabel()} này sẽ được gia hạn trả nợ gốc (LẦN ${extLevel}) từ ngày ${fmtDate(lockedFrom)} đến ngày ${fmtDate(draft.to)}${dur? ' ('+dur+')':''}. với lãi suất trong thời gian gia hạn là ${String(draft.ratePct).replace('.',',')}%/năm`;
      }

      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:760px;">
          <div class="modal-head"><h3>Gia hạn nợ</h3><button class="modal-close preview-allow" id="ext-close">✕</button></div>
          <div class="modal-body">
            <div style="background:rgba(255,183,77,.28); color:#000; font-weight:800; padding:10px 14px; border-radius:8px; margin-bottom:10px;">${introTitle}</div>
            <p class="sub" style="line-height:1.6;">${introBody}</p>

            <div class="form-grid">
              <div class="field"><label>Gia hạn từ ngày</label><input value="${fmtDate(lockedFrom)}" disabled></div>
              <div class="field">
                <label>Khoảng thời gian <span class="sub">(chỉ để tính nhanh)</span></label>
                <select id="ext-duration" class="preview-allow">
                  <option value="other">Khác</option>
                  ${EXTENSION_DURATION_OPTIONS.map(m=>`<option value="${m}" ${draft.duration==String(m)?'selected':''}>${String(m).replace('.',',')} tháng</option>`).join('')}
                </select>
              </div>
              <div class="field"><label>Gia hạn đến ngày *</label><input type="date" id="ext-to" class="preview-allow" value="${draft.to}" min="${lockedFrom}"></div>
            </div>

            <div class="divider-lbl">Chọn lãi suất trong thời gian gia hạn (lãi suất quá hạn) %/năm:</div>
            <div style="display:flex; gap:0;">
              <button class="btn btn-sm preview-allow" id="ext-rate-zero" style="border:1px solid #000; border-radius:8px 0 0 8px; ${draft.rateType==='zero'?'background:var(--gold); color:#fff;':'background:var(--white);'}">0% / năm</button>
              <button class="btn btn-sm preview-allow" id="ext-rate-current" style="border:1px solid #000; border-left:none; ${draft.rateType==='current'?'background:var(--gold); color:#fff;':'background:var(--white);'}">${rateLabel2}</button>
              <button class="btn btn-sm preview-allow" id="ext-rate-custom" style="border:1px solid #000; border-left:none; border-radius:0 8px 8px 0; ${draft.rateType==='custom'?'background:var(--gold); color:#fff;':'background:var(--white);'}">Lãi suất khác</button>
            </div>
            ${draft.rateType==='custom'? `<div class="field" style="margin-top:8px; max-width:200px;"><label>Nhập lãi suất khác (%/năm)</label><input id="ext-rate-custom-input" class="preview-allow" value="${draft.customRateInput}" maxlength="5" placeholder="Vd: 3,3"></div>` : ''}

            ${showAlloc? `
            <div class="divider-lbl">Chọn phương án phân bổ lãi</div>
            <p class="sub" style="margin-top:-4px;">Số tiền lãi thu về trong đợt gia hạn này được phân bổ về đâu?</p>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <label class="sv-filter-item" style="border:1px solid var(--line); border-radius:8px;"><input type="radio" name="ext-alloc" class="preview-allow" id="ext-alloc-wardOnly" ${draft.allocMode==='wardOnly'?'checked':''}> Phân bổ hết 100% về cấp xã</label>
              <label class="sv-filter-item" style="border:1px solid var(--line); border-radius:8px;"><input type="radio" name="ext-alloc" class="preview-allow" id="ext-alloc-wardHamlet" ${draft.allocMode==='wardHamlet'?'checked':''}> Phân bổ về cấp xã và cấp ${subAdminLabelLower()}</label>
              ${draft.allocMode==='wardHamlet'? `<div class="field" style="margin-left:24px; max-width:260px;"><label>Cấp xã phân bổ tiền lãi xuống cấp ${subAdminLabelLower()} với tỷ lệ:</label><input id="ext-hamlet-pct" class="preview-allow" value="${String(draft.hamletAllocPercent).replace('.',',')}" maxlength="5"></div>` : ''}
              <label class="sv-filter-item" style="border:1px solid var(--line); border-radius:8px;"><input type="radio" name="ext-alloc" class="preview-allow" id="ext-alloc-allTiers" ${draft.allocMode==='allTiers'?'checked':''}> Phân bổ về Tất cả các cấp (trung ương, tỉnh, xã, ${subAdminLabelLower()})</label>
              ${draft.allocMode==='allTiers'? `
                <div style="margin-left:24px;">
                  <p class="sub">Lãi suất của tất cả các cấp cộng lại (Trung ương, tỉnh, xã) phải luôn bằng ${String(draft.ratePct).replace('.',',')}%/năm</p>
                  <div class="form-grid">
                    <div class="field"><label>Cấp trung ương (%)</label><input id="ext-central" class="preview-allow" value="${String(draft.splitCentral).replace('.',',')}" maxlength="5"></div>
                    <div class="field"><label>Cấp tỉnh/thành phố (%)</label><input id="ext-province" class="preview-allow" value="${String(draft.splitProvince).replace('.',',')}" maxlength="5"></div>
                    <div class="field"><label>Cấp xã/phường (%)</label><input id="ext-ward" class="preview-allow" value="${String(draft.splitWard).replace('.',',')}" maxlength="5"></div>
                  </div>
                  <p class="sub">Tổng số tiền lãi cấp xã/phường nhận được, tiếp tục phân bổ số tiền đó về cấp ${subAdminLabelLower()} là (tỷ lệ %, không nhập quá 100):</p>
                  <div class="field" style="max-width:200px;"><input id="ext-alltiers-hamlet-pct" class="preview-allow" value="${String(draft.allTiersHamletPercent).replace('.',',')}" maxlength="5"></div>
                </div>` : ''}
            </div>` : ''}

            ${summaryLine? `<div style="background:var(--paper-2); border-radius:10px; padding:10px 14px; margin-top:14px; font-size:12.5px; font-weight:700;">${escapeHtml(summaryLine)}</div>` : ''}
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="ext-cancel">Đóng bảng (không phê duyệt)</button>
            <button class="btn btn-primary preview-allow" id="ext-save">Lưu (phê duyệt gia hạn)</button>
          </div>
        </div>`;
      wire();
    }

    function wire(){
      wrap.querySelector('#ext-close').onclick = close;
      wrap.querySelector('#ext-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)

      wrap.querySelector('#ext-duration').onchange = (e)=>{
        draft.duration = e.target.value;
        if(draft.duration!=='other') draft.to = addMonthsToDateStr(lockedFrom, parseFloat(draft.duration));
        renderBody();
      };
      wrap.querySelector('#ext-to').onchange = (e)=>{
        const v = e.target.value;
        if(v && v<=lockedFrom){ alert('Chỉ được chọn ngày SAU Ngày đến hạn/gia hạn hiện tại. Vui lòng chọn lại.'); e.target.value = draft.to; return; }
        draft.to = v; draft.duration = 'other';
        renderBody();
      };
      // Cuộn tới ĐÚNG phần tử vừa bấm (tìm lại theo ID sau khi vẽ lại, vì renderBody() thay thế toàn bộ
      // phần tử cũ bằng phần tử mới) — logic RIÊNG cho modal này, đảm bảo hoạt động chắc chắn dù bấm
      // bao nhiêu lần liên tiếp vào CÙNG 1 nút, không phụ thuộc cơ chế cuộn chung của toàn app.
      function scrollToIdAfterRender(id){
        requestAnimationFrame(()=> requestAnimationFrame(()=>{
          const el = wrap.querySelector('#'+id);
          if(el) el.scrollIntoView({ block:'center', behavior:'auto' });
        }));
      }
      wrap.querySelector('#ext-rate-zero').onclick = ()=>{ draft.rateType='zero'; draft.ratePct=0; renderBody(); scrollToIdAfterRender('ext-rate-zero'); };
      wrap.querySelector('#ext-rate-current').onclick = ()=>{ draft.rateType='current'; draft.ratePct=sampleRate; renderBody(); scrollToIdAfterRender('ext-rate-current'); };
      wrap.querySelector('#ext-rate-custom').onclick = ()=>{ draft.rateType='custom'; renderBody(); scrollToIdAfterRender('ext-rate-custom'); };
      const customInput = wrap.querySelector('#ext-rate-custom-input');
      if(customInput){
        customInput.addEventListener('keypress', (e)=>{
          const ch=e.key; if(ch.length!==1) return;
          if(!/[\d,]/.test(ch) || (ch===',' && customInput.value.includes(','))){ e.preventDefault(); }
        });
        const commitCustomRate = ()=>{
          const val = parseFloat(customInput.value.replace(',','.'));
          if(!val || val<=0 || val>50){ alert('Lãi suất khác phải lớn hơn 0 và không vượt quá 50%. Hệ thống sẽ tạm áp dụng 0%/năm.'); draft.rateType='zero'; draft.ratePct=0; }
          else { draft.customRateInput = customInput.value; draft.ratePct = val; }
          renderBody();
        };
        customInput.addEventListener('blur', commitCustomRate);
        // Yêu cầu mới: bấm Enter cũng ghi nhận số vừa nhập (nếu hợp lệ) và sổ khung phân bổ lãi
        // xuống ngay, y hệt hành vi khi bấm ra ngoài (blur) — không cần phải click ra ngoài nữa.
        customInput.addEventListener('keydown', (e)=>{
          if(e.key==='Enter'){ e.preventDefault(); commitCustomRate(); }
        });
      }
      ['ext-alloc-wardOnly','ext-alloc-wardHamlet','ext-alloc-allTiers'].forEach(id=>{
        const el = wrap.querySelector('#'+id); if(!el) return;
        el.onchange = ()=>{ draft.allocMode = id.replace('ext-alloc-',''); renderBody(); scrollToIdAfterRender(id); };
      });
      const bindEnterTriggersBlur = (el)=>{
        if(!el) return;
        el.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); el.blur(); } });
      };
      const hamletPctInput = wrap.querySelector('#ext-hamlet-pct');
      if(hamletPctInput) hamletPctInput.onblur = ()=>{
        const v = parseFloat(hamletPctInput.value.replace(',','.'));
        if(!v || v<=0 || v>100){ alert(`Tỷ lệ phân bổ về ${subAdminLabelLower()} phải lớn hơn 0 và không vượt quá 100%.`); hamletPctInput.value = String(draft.hamletAllocPercent).replace('.',','); return; }
        draft.hamletAllocPercent = v;
      };
      bindEnterTriggersBlur(hamletPctInput);
      ['ext-central','ext-province','ext-ward'].forEach(id=>{
        const el = wrap.querySelector('#'+id); if(!el) return;
        el.onblur = ()=>{
          const v = parseFloat(el.value.replace(',','.'))||0;
          if(id==='ext-central') draft.splitCentral=v; if(id==='ext-province') draft.splitProvince=v; if(id==='ext-ward') draft.splitWard=v;
        };
        bindEnterTriggersBlur(el);
      });
      const allTiersHamletInput = wrap.querySelector('#ext-alltiers-hamlet-pct');
      if(allTiersHamletInput) allTiersHamletInput.onblur = ()=>{
        const v = parseFloat(allTiersHamletInput.value.replace(',','.'));
        if(!v || v<=0 || v>100){ alert(`Tỷ lệ phân bổ về ${subAdminLabelLower()} phải lớn hơn 0 và không vượt quá 100%.`); allTiersHamletInput.value = String(draft.allTiersHamletPercent).replace('.',','); return; }
        draft.allTiersHamletPercent = v;
      };
      bindEnterTriggersBlur(allTiersHamletInput);

      wrap.querySelector('#ext-save').onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể lưu phê duyệt gia hạn thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn nên không thể phê duyệt gia hạn. Vui lòng liên hệ Chủ mã định danh.'); return; }
        if(extLevel > MAX_LOAN_EXTENSIONS){ alert(`Không thể lưu! Hệ thống chỉ cho phép gia hạn tối đa ${MAX_LOAN_EXTENSIONS} lần cho 1 khoản vay.`); return; }
        if(!draft.to){ alert('Vui lòng chọn "Gia hạn đến ngày".'); return; }
        if(draft.allocMode==='allTiers'){
          const sum = Math.round((draft.splitCentral+draft.splitProvince+draft.splitWard)*100)/100;
          if(Math.abs(sum-draft.ratePct)>0.01){ alert(`Tổng 3 cấp (${sum}%) phải bằng đúng lãi suất gia hạn (${draft.ratePct}%). Vui lòng kiểm tra lại.`); return; }
        }
        closeOnly(); // Bước 1: chỉ đóng bảng đang thao tác — CHƯA vẽ lại bảng cha vội (dữ liệu mới chưa kịp lưu xong)
        showProcessingToast(); // Bước 2
        const record = {
          from: lockedFrom, to: draft.to, rateType: draft.rateType, ratePct: draft.ratePct, allocMode: draft.allocMode,
          hamletAllocPercent: draft.allocMode==='wardHamlet' ? draft.hamletAllocPercent : (draft.allocMode==='allTiers' ? draft.allTiersHamletPercent : null),
          splitCentral: draft.allocMode==='allTiers' ? draft.splitCentral : null,
          splitProvince: draft.allocMode==='allTiers' ? draft.splitProvince : null,
          splitWard: draft.allocMode==='allTiers' ? draft.splitWard : null,
          savedAt: new Date().toISOString(), savedBy: state.identity.email||'', savedByName: state.identity.name||'',
        };
        for(const b of targets){
          const arr = getBorrowerExtensions(b.id).slice();
          arr.push(record);
          await cSet('loanExtensions/'+b.id, arr);
          // Cập nhật NGAY state cục bộ (không chờ lắng nghe Firebase echo về — có độ trễ mạng) — đảm
          // bảo khi vẽ lại bảng cha ở bước cuối, dữ liệu chắc chắn đã đúng, không còn thấy dữ liệu CŨ.
          state.loanExtensions = state.loanExtensions || {};
          state.loanExtensions[b.id] = arr;
          const allocLabel = record.allocMode==='allTiers'
            ? `Chia 4 cấp — Trung ương ${record.splitCentral}%, Tỉnh ${record.splitProvince}%, Xã ${record.splitWard}%, ${subAdminLabel()} ${record.hamletAllocPercent}%`
            : record.allocMode==='wardHamlet' ? `Trích ${record.hamletAllocPercent}% xuống ${subAdminLabelLower()}, còn lại giữ ở cấp xã` : `Phân bổ hết 100% về cấp xã`;
          await pushConfirmationDocument('extension_confirm', `Giấy xác nhận Gia hạn lần ${extLevel} đối với hộ vay "${b.name}"`,
            [
              `Hộ vay "${b.name}" đã được phê duyệt gia hạn nợ lần ${extLevel} vào ngày ${fmtDate(todayStr())}.`,
              `Số tiền vay gốc: ${money(b.principal)}`,
              `Gia hạn từ ngày ${fmtDate(record.from)} đến ngày ${fmtDate(record.to)}`,
              `Lãi suất trong thời gian gia hạn: ${record.rateType==='zero'?'0%/năm (không tính lãi)':`${String(record.ratePct).replace('.',',')}%/năm`}`,
              `Cách phân bổ: ${allocLabel}`,
            ].join('\n'), b);
        }
        await pushLog('phê duyệt', `gia hạn nợ gốc LẦN ${extLevel} cho ${isGroup? targets.length+' hộ vay' : targets[0].name}`);
        hideProcessingToast(); // Bước 4
        showBigToast(`Đã gia hạn thành công lần ${extLevel}`);
        if(reopenParent) reopenParent(); // Bước 5: vẽ lại bảng cha SAU CÙNG, khi dữ liệu đã chắc chắn lưu xong — nút "Xem"/"GIA HẠN" tự cập nhật ngay, không cần đóng mở lại cả modal nữa
      };
    }
    renderBody();
  }

  // Bảng {Thống kê chung} riêng cho modal "Gia hạn nợ" — 5 cột: Địa phương, Tổng dư nợ, Hộ trong
  // hạn, Hộ quá hạn, Hộ được gia hạn.
  function renderExtensionStatsHtml(list, hamlets, fullList){
    // Dùng THẲNG đúng hàm thống kê chuẩn của "Tất toán khoản vay/Trả nợ trước hạn" — đảm bảo tuyệt
    // đối giống nhau ở cả 3 nút (Tất toán/Trả nợ trước hạn, Gia hạn nợ, Quản lý Nợ rủi ro).
    return renderSettlementStatsHtml(fullList||list, hamlets);
  }
  // Bảng nhóm theo phương án cho modal "Gia hạn nợ" — cột: Quyết định (nút GIA HẠN) | Lịch sử gia
  // hạn (nút Xem) | Họ và tên | Số tiền gốc | Ngày đến hạn | Ngày gia hạn gần nhất.
  function renderExtensionGroupedTablesHtml(list, projectsRaw){
    if(!list.length) return `<div class="empty-state"><div class="e-ico">🌾</div>Chưa có người vay nào theo bộ lọc hiện tại, hoặc không có khoản vay nào hợp lý về thời điểm để gia hạn nợ</div>`;
    const projects = sortedActiveProjects(projectsRaw);
    // Hàm dựng 1 khung phương án — dùng CHUNG cho cả khung "Quá hạn chưa xử lý" (isOverdueBox=true,
    // luôn tô đỏ, không cần sắp xếp) lẫn khung bình thường.
    function renderOneGroup(gid, groupListRaw, isOverdueBox){
      const groupList = isOverdueBox ? groupListRaw : sortedBorrowerGroup(groupListRaw, gid);
      const proj = gid==='__none__' ? null : projects.find(p=>p.id===gid);
      const projName = proj ? escapeHtml(proj.name) : '(Không rõ phương án — có thể đã bị xoá)';
      const duration = proj ? calcLoanDuration(proj.disburseDate, proj.dueDate) : '';
      const capitalTxt = proj ? `, ${groupDigitsRight(String(Math.round(proj.totalCapital||0)),3)} đồng` : '';
      const durationTxt = duration ? `, ${duration}` : '';
      const inactiveTxt = proj ? projectInactiveAmountTxt(proj) : '';
      const extCounts = groupList.map(b=>getBorrowerExtensions(b.id).length);
      const allSame = extCounts.length>0 && extCounts.every(c=>c===extCounts[0]);
      const commonLevel = allSame ? extCounts[0] : null;
      const groupMaxedOut = allSame && commonLevel>=MAX_LOAN_EXTENSIONS;
      const totalXemLabel = allSame ? (commonLevel>0? `Xem (gH ${commonLevel} lần)` : 'Xem (0)') : 'Xem';
      const headerHtml = isOverdueBox
        ? `<span style="color:#b71c1c; font-weight:800;">⚠️ Quá hạn chưa được xử lý —</span><span>📋 ${projName} (${groupList.length} người vay)</span>`
        : `📋 ${projName} (${groupList.length} người vay)${capitalTxt}${durationTxt}${inactiveTxt}`;
      const headerBg = isOverdueBox ? rgbaToGradient('rgba(211,47,47,.16)') : projectGroupHeaderBg(gid);
      return `
      <div style="margin-bottom:18px;">
        <div class="sv-group-header" style="background:${headerBg}; display:flex; align-items:center; gap:6px;">${headerHtml}</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th class="frz-col1" style="background:var(--paper-2); min-width:110px;"><span class="wide-action-pair">Lịch sử gia hạn</span><span class="narrow-action-pair"></span></th><th class="frz-col2 narrow-action-pair-col2" style="background:var(--paper-2); min-width:110px;">Quyết định</th><th class="frz-col3" style="background:var(--paper-2); ${svColStyleHeader({key:'name',label:'Họ và tên', userInput:true})}">Họ và tên</th><th style="${svColStyleHeader({align:'right',label:'Số tiền gốc (đ)'})}">Số tiền gốc</th><th style="${svColStyleHeader({key:'dueDate',label:'Ngày đến hạn'})}">Ngày đến hạn</th><th style="${svColStyleHeader({label:'Ngày gia hạn gần nhất'})}">Ngày gia hạn gần nhất</th></tr></thead>
            <tbody>${groupList.map(b=>{
              const exts = getBorrowerExtensions(b.id);
              const xemLabel = exts.length ? `Xem (gH ${exts.length} lần)` : 'Xem (0)';
              const overdueUnhandled = borrowerIsOverdueUnhandled(b);
              const rowColor = overdueUnhandled ? activeLoanColor('overdue') : exts.length>0 ? activeLoanColor('extended') : daysRemainingRowColor(b.dueDate);
              const textStyle = overdueUnhandled ? 'color:#b71c1c; font-weight:700;' : '';
              const maxedOut = exts.length>=MAX_LOAN_EXTENSIONS;
              // Khoá riêng khi CHUẨN BỊ gia hạn LẦN TIẾP THEO (lần 2 trở đi) — chỉ mở khoá khi ngày
              // hiện tại còn ≤15 ngày nữa mới tới "Ngày gia hạn gần nhất", hoặc đã bằng/vượt qua ngày
              // đó rồi. Nếu còn quá xa (>15 ngày) thì khoá lại, không cho gia hạn tiếp quá sớm.
              const latestExt = exts.length? exts[exts.length-1] : null;
              const daysToLatestExtEnd = latestExt? daysRemainingUntil(latestExt.to) : null;
              const tooEarlyForNextExtension = exts.length>0 && daysToLatestExtEnd!=null && daysToLatestExtEnd>15;
              const rowBg = rowColor || 'var(--white)';
              return `<tr${rowColor? ` style="background:${rowColor};${textStyle}"` : (textStyle?` style="${textStyle}"`:'')}>
                <td class="frz-col1" style="background:${rowBg};${textStyle}">${narrowActionPairHtml('ext-'+b.id,
                  `<button class="ext-action-btn preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-ext-history="${b.id}">${xemLabel}</button>`,
                  maxedOut? `<button class="ext-action-btn" disabled title="Đã đạt tối đa 5 lần gia hạn">GIA HẠN</button>`
                    : tooEarlyForNextExtension? `<button class="ext-action-btn" disabled title="Chưa đến thời điểm được gia hạn lần tiếp theo — Ngày gia hạn gần nhất còn ${daysToLatestExtEnd} ngày nữa mới tới, chỉ được gia hạn tiếp khi còn ≤15 ngày hoặc đã tới/qua ngày đó.">GIA HẠN</button>`
                    : `<button class="ext-action-btn preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-ext-single="${b.id}">GIA HẠN</button>`
                )}</td>
                <td class="frz-col2 narrow-action-pair-col2" style="background:${rowBg};${textStyle}">${maxedOut? `<button class="ext-action-btn" disabled title="Đã đạt tối đa 5 lần gia hạn">GIA HẠN</button>`
                  : tooEarlyForNextExtension? `<button class="ext-action-btn" disabled title="Chưa đến thời điểm được gia hạn lần tiếp theo — Ngày gia hạn gần nhất còn ${daysToLatestExtEnd} ngày nữa mới tới, chỉ được gia hạn tiếp khi còn ≤15 ngày hoặc đã tới/qua ngày đó.">GIA HẠN</button>`
                  : `<button class="ext-action-btn preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-ext-single="${b.id}">GIA HẠN</button>`}</td>
                <td class="frz-col3 sv-col-wrap-check" style="background:${rowBg};${textStyle}${b.isHeir? ' text-decoration:underline;' : ''} ${svColStyle({key:'name',label:'Họ và tên', userInput:true})}">${overdueUnhandled?'⚠️ ':''}${escapeHtml(b.name)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Số tiền gốc (đ)'})}">${moneySpaced(b.principal)}</td>
                <td style="${svColStyle({key:'dueDate',label:'Ngày đến hạn'})}">${fmtDate(b.dueDate)}</td>
                <td class="sv-col-wrap-check" style="${svColStyle({label:'Ngày gia hạn gần nhất'})}">${exts.length? 'hạn '+fmtDate(exts[exts.length-1].to) : ''}</td>
              </tr>`;
            }).join('')}
            <tr style="background:var(--paper-2); font-weight:700;">
              <td class="frz-col1" style="background:var(--paper-2);"></td>
              <td class="frz-col2" style="background:var(--paper-2);"></td>
              <td class="frz-col3" style="background:var(--paper-2);">TỔNG</td>
              <td class="money">${moneySpaced(groupList.reduce((s,b)=>s+(parseFloat(b.principal)||0),0))}</td>
              <td></td>
              <td></td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>`;
    }
    const overdueList = list.filter(borrowerIsOverdueUnhandled);
    const normalList = list.filter(b=>!borrowerIsOverdueUnhandled(b));
    const overdueGroups = {};
    overdueList.forEach(b=>{ const key=(b.projectId && projects.some(p=>p.id===b.projectId))?b.projectId:'__none__'; (overdueGroups[key]=overdueGroups[key]||[]).push(b); });
    const overdueGroupOrder = projects.map(p=>p.id).filter(pid=>overdueGroups[pid]);
    if(overdueGroups['__none__']) overdueGroupOrder.push('__none__');
    const overdueHtml = overdueGroupOrder.map(gid=> renderOneGroup(gid, overdueGroups[gid], true)).join('');

    const groups = {};
    normalList.forEach(b=>{
      const key = (b.projectId && projects.some(p=>p.id===b.projectId)) ? b.projectId : '__none__';
      (groups[key] = groups[key]||[]).push(b);
    });
    const groupOrder = projects.map(p=>p.id).filter(pid=>groups[pid]);
    if(groups['__none__']) groupOrder.push('__none__');
    const normalHtml = groupOrder.map(gid=> renderOneGroup(gid, groups[gid], false)).join('');
    return overdueHtml + normalHtml;
  }
  function formatUnderlinedDMY(dateStr){
    if(!dateStr) return '<u>ngày …</u> <u>tháng …</u> <u>năm …</u>';
    const d = new Date(dateStr+'T00:00:00');
    return `<u>ngày ${d.getDate()}</u> <u>tháng ${d.getMonth()+1}</u> <u>năm ${d.getFullYear()}</u>`;
  }

  // =====================================================================
  // Modal chính "Gia hạn nợ" — thiết kế y hệt modal "Tính tiền lãi và phê duyệt đóng lãi" (tìm
  // kiếm, 4 bộ lọc dùng CHUNG state, khôi phục bộ lọc gốc) nhưng KHÔNG có nút Tuỳ chỉnh cột / Lưu /
  // Huỷ ở đầu-cuối — chỉ có "Đóng bảng".
  // =====================================================================
  function renderExtensionModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=>{ state.showExtensionModal = false; wrap.remove(); };

    function renderBody(){
      const hamlets = state.config.hamlets||[];
      const projects = activeLoanProjects();
      ensureFilterHamletsInit(hamlets);
      ensureFilterProjectsInit(projects);
      let list = state.borrowers.filter(b=>!b.deleted && !b.settled);
      if(state.search) list = list.filter(b=> (b.name+b.cccd+b.phone).toLowerCase().includes(state.search.toLowerCase()));
      if(state.filterHamlets.length < hamlets.length) list = list.filter(b=>state.filterHamlets.includes(b.hamlet));
      if(state.filterProjectIds.length < projects.length) list = list.filter(b=>state.filterProjectIds.includes(b.projectId));
      { const fs=fundSourcesInUse(); ensureFilterFundSourcesInit(fs); if(state.filterFundSources.length < fs.length) list = list.filter(b=>state.filterFundSources.includes((b.fundSource||'').trim())); }
      { const mgrs=ensureDefaultManagers(); ensureFilterManagersInit(mgrs); if(state.filterManagerIds.length < mgrs.length) list = list.filter(b=>state.filterManagerIds.includes(b.managerId||'chihoitruong')); }
      // Chỉ hiện đúng những hộ ĐỦ ĐIỀU KIỆN gia hạn: đã từng được gia hạn (bất kể lần nào), HOẶC gần
      // đến hạn ≤60 ngày (kể cả đã quá hạn).
      const fullList = list; // giữ lại bản đầy đủ (giống hệt danh sách bên Tất toán) để tính "Hộ trong hạn" cho đồng bộ
      list = list.filter(borrowerEligibleForActionList);
      const statsHtml = renderExtensionStatsHtml(list, hamlets, fullList);
      const tablesHtml = renderExtensionGroupedTablesHtml(list, projects);

      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1300px; border:6px solid #e65100;">
          <div class="modal-head" style="background:linear-gradient(180deg, #ffb74d 0%, #fb8c00 50%, #e65100 100%);"><h3 style="color:#000;">${waveTextHtmlSlow('📅 Gia hạn nợ')}</h3><button class="modal-close preview-allow" id="extm-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; overflow:auto;">
            <div class="toolbar" style="flex-wrap:wrap;">
              <input id="extm-search" class="preview-allow" placeholder="🔎 Tìm theo tên, CCCD, SĐT..." value="${state.search}" style="min-width:200px;${(state.search!=='' && state.search!==' ')? "border:2px solid #b71c1c;" : ""}">
              ${buildHamletFilterDropdownHtml(hamlets)}
              ${buildProjectFilterDropdownHtml(projects)}
              ${buildFundSourceFilterDropdownHtml()}
              ${buildManagerFilterDropdownHtml()}
              <button class="btn btn-ghost btn-sm preview-allow ${resetFilterBtnClass(hamlets, projects)}" id="extm-reset-all-btn">↺ Khôi phục bộ lọc gốc</button>
            </div>
            <p class="sub" style="margin:10px 0;">Chỉ cho phép gia hạn nợ (hoặc cho phép nợ rủi ro) đối với những hộ có ngày Gần đến hạn ≤60 ngày, đã quá hạn hoặc đang trong thời gian gia hạn nợ.</p>
            ${statsHtml}
            ${tablesHtml}
            <div style="display:flex; gap:8px; margin-top:16px;">
              <button class="btn btn-ghost preview-allow" id="extm-close-bottom">Đóng bảng</button>
            </div>
          </div>
        </div>`;
      wire(hamlets, projects, list, projects);
    }

    function wire(hamlets, projects, list, allProjects){
      wrap.querySelector('#extm-close').onclick = close;
      wrap.querySelector('#extm-close-bottom').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)

      wrap.querySelector('#extm-search').oninput = (e)=>{ state.search = e.target.value; rerenderKeepingFocus(renderBody); };
      const toggleDropdown = (kind)=>{ state.openFilterDropdown = state.openFilterDropdown===kind ? null : kind; renderBody(); };
      const hb = wrap.querySelector('#f-hamlet-btn'); if(hb) hb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('hamlet'); };
      const pb = wrap.querySelector('#f-project-btn'); if(pb) pb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('project'); };
      const qb = wrap.querySelector('#f-quarter-btn'); if(qb) qb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('quarter'); };
      const yb = wrap.querySelector('#f-year-btn'); if(yb) yb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('year'); };
      const hAll = wrap.querySelector('#f-hamlet-all'); if(hAll) hAll.onclick=(e)=>{ e.stopPropagation(); toggleHamletAll(hamlets, hAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-hamlet-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleHamletOne(hamlets, cb.dataset.name, cb.checked); renderBody(); });
      const pAll = wrap.querySelector('#f-project-all'); if(pAll) pAll.onclick=(e)=>{ e.stopPropagation(); toggleProjectAll(projects, pAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-project-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleProjectOne(projects, cb.dataset.id, cb.checked); renderBody(); });
      const fsb = wrap.querySelector('#f-fundsource-btn'); if(fsb) fsb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('fundsource'); };
      const mb = wrap.querySelector('#f-manager-btn'); if(mb) mb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('manager'); };
      const fsAll = wrap.querySelector('#f-fundsource-all'); if(fsAll) fsAll.onclick=(e)=>{ e.stopPropagation(); toggleFundSourceAll(fundSourcesInUse(), fsAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-fundsource-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleFundSourceOne(fundSourcesInUse(), cb.dataset.name, cb.checked); renderBody(); });
      const mAll = wrap.querySelector('#f-manager-all'); if(mAll) mAll.onclick=(e)=>{ e.stopPropagation(); toggleManagerAll(ensureDefaultManagers(), mAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-manager-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleManagerOne(ensureDefaultManagers(), cb.dataset.id, cb.checked); renderBody(); });
      wrap.querySelectorAll('.f-quarter-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleQuarterFilter(cb.dataset.key, cb.checked); renderBody(); });
      wrap.querySelectorAll('.f-year-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleYearFilter(parseInt(cb.dataset.year,10), cb.checked); renderBody(); });
      const yearPanel = wrap.querySelector('#f-year-panel'); if(yearPanel){ const sel = yearPanel.querySelector('[data-selected-year]'); if(sel) sel.scrollIntoView({block:'center'}); }
      const quarterPanel = wrap.querySelector('#f-quarter-panel'); if(quarterPanel){ const selQ = quarterPanel.querySelector('[data-selected-quarter]'); if(selQ) selQ.scrollIntoView({block:'center'}); }
      const resetAllBtn = wrap.querySelector('#extm-reset-all-btn'); if(resetAllBtn) resetAllBtn.onclick=()=>{ resetAllBorrowerFilters(hamlets, projects); renderBody(); };

      wrap.querySelectorAll('[data-ext-single]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.extSingle);
          if(b) renderExtensionApprovalModal([b], renderBody);
        };
      });
      wrap.querySelectorAll('[data-ext-group]').forEach(btn=>{
        btn.onclick = ()=>{
          const gid = btn.dataset.extGroup;
          const groupList = list.filter(b=> (b.projectId && allProjects.some(p=>p.id===b.projectId)) ? b.projectId===gid : gid==='__none__');
          if(groupList.length) renderExtensionApprovalModal(groupList, renderBody);
        };
      });
      wrap.querySelectorAll('[data-ext-history]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.extHistory);
          if(!b) return;
          const exts = getBorrowerExtensions(b.id);
          if(!exts.length){ alert('Người này chưa được gia hạn lần nào.'); return; }
          renderExtensionHistoryModal(b, ()=> renderBody());
        };
      });
      wrap.querySelectorAll('[data-ext-group-history]').forEach(btn=>{
        btn.onclick = ()=> alert('Tính năng "Xem lịch sử gia hạn" cho cả nhóm cùng lúc đang được phát triển, sẽ sớm ra mắt. Vui lòng bấm "Xem" ở từng dòng người vay riêng lẻ.');
      });

      if(!wrap._outsideClickBound){
        wrap._outsideClickBound = true;
        document.addEventListener('click', (e)=>{
          if(!state.showExtensionModal || !state.openFilterDropdown) return;
          if(e.target.closest('.sv-filter-dropdown')) return;
          state.openFilterDropdown = null;
          if(document.body.contains(wrap)) renderBody();
        });
      }
    }

    state.showExtensionModal = true;
    renderBody();
  }

  // Bảng {thống kê chung} cho modal "Tất toán khoản vay/ Trả nợ trước hạn" — y hệt bảng của "Gia hạn
  // nợ" nhưng chen thêm 1 cột ở giữa "Hộ trong hạn" và "Hộ quá hạn": "Gần đến hạn ≤60 ngày".
  // "Xem (gH N lần)" — hiện đầy đủ thông tin lần gia hạn GẦN NHẤT, có nút "Thu hồi lại quyết định
  // gia hạn lần N do phê duyệt nhầm".
  function renderExtensionHistoryModal(b, onChanged){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    function render(){
      const exts = getBorrowerExtensions(b.id);
      if(!exts.length){ close(); return; }
      const N = exts.length;
      const e = exts[N-1];
      const hamletLbl = subAdminLabel();
      const allocLabel = e.allocMode==='allTiers'
        ? `Chia 4 cấp — Trung ương ${String(e.splitCentral||0).replace('.',',')}%, Cấp Tỉnh ${String(e.splitProvince||0).replace('.',',')}%, Cấp Xã ${String(e.splitWard||0).replace('.',',')}%, Cấp ${hamletLbl} ${String(e.allTiersHamletPercent||e.hamletAllocPercent||0).replace('.',',')}%`
        : e.allocMode==='wardHamlet'
          ? `Phân bổ về cấp xã và cấp ${hamletLbl} — trích ${String(e.hamletAllocPercent||0).replace('.',',')}% xuống cấp ${hamletLbl}, phần còn lại giữ ở cấp xã`
          : `Phân bổ hết 100% về cấp xã (không trích về cấp ${hamletLbl})`;
      const approverLabel = e.savedByName ? `${escapeHtml(e.savedByName)} (${escapeHtml(e.savedBy||'')})` : escapeHtml(e.savedBy||'');
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:560px;">
          <div class="modal-head"><h3>Lịch sử gia hạn lần ${N} của hộ vay ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close" id="exh-close">✕</button></div>
          <div class="modal-body">
            <button type="button" class="btn preview-allow" style="background:#ffcdd2; color:#b71c1c; font-weight:700; width:100%; margin-bottom:14px;" id="exh-revoke">Thu hồi lại quyết định gia hạn lần ${N} do phê duyệt nhầm</button>
            <div class="kv-row"><span>Gia hạn từ ngày</span><b>${fmtDate(e.from)}</b></div>
            <div class="kv-row"><span>Gia hạn đến ngày</span><b>${fmtDate(e.to)}</b></div>
            <div class="kv-row"><span>Lãi suất gia hạn lần ${N}</span><b>${e.rateType==='zero'?'0%/năm (không tính lãi)':`${String(e.ratePct).replace('.',',')}%/năm`}</b></div>
            <div class="kv-row"><span>Cách phân bổ tiền lãi</span><b>${allocLabel}</b></div>
            <div class="kv-row"><span>Ngày phê duyệt</span><b>${e.savedAt? fmtDate(e.savedAt.slice(0,10)) : ''}</b></div>
            <div class="kv-row"><span>Người phê duyệt</span><b>${approverLabel}</b></div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="exh-close2">Đóng bảng</button>
          </div>
        </div>`;
      wrap.querySelector('#exh-close').onclick = close;
      wrap.querySelector('#exh-close2').onclick = close;
      wrap.onclick = (ev)=>{ if(ev.target===wrap) close(); };
      wrap.querySelector('#exh-revoke').onclick = ()=> renderExtensionRevokeConfirmModal(b, N, ()=>{ render(); if(onChanged) onChanged(); });
    }
    render();
  }
  // Bảng phụ xác nhận "Thu hồi lại quyết định gia hạn lần N do phê duyệt nhầm" — có double-confirm.
  function renderExtensionRevokeConfirmModal(b, N, onRevoked){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:520px;">
        <div class="modal-head receipt-head-refund"><h3>Thu hồi quyết định gia hạn lần ${N}</h3><button class="modal-close" id="exr-close">✕</button></div>
        <div class="modal-body">
          <p class="sub" style="line-height:1.7;">Nếu chấp nhận thu hồi, hệ thống sẽ tự động lập 1 <b>Giấy xác nhận thu hồi quyết định gia hạn</b>, giấy này sẽ được lưu vào kho Giấy xác nhận (xem lại được sau này) để làm bằng chứng đã có quyết định thu hồi. Sau khi thu hồi, hộ vay này sẽ quay về đúng trạng thái trước khi được gia hạn lần ${N}.</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="exr-back">Quay lại (không thu hồi)</button>
          <button class="btn btn-primary" id="exr-confirm">Xác nhận (chấp nhận thu hồi)</button>
        </div>
      </div>`;
    wrap.querySelector('#exr-close').onclick = close;
    wrap.querySelector('#exr-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#exr-confirm').onclick = async ()=>{
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
      if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
      if(!confirm(`Đồng chí có CHẮC CHẮN muốn thu hồi quyết định gia hạn lần ${N} của hộ vay "${b.name}" không? Hành động này không thể hoàn tác.`)) return;
      close(); // Bước 1
      showProcessingToast(); // Bước 2
      const arr = getBorrowerExtensions(b.id).slice();
      arr.pop();
      await cSet('loanExtensions/'+b.id, arr);
      state.loanExtensions = state.loanExtensions||{};
      state.loanExtensions[b.id] = arr;
      await pushLog('xác nhận', `thu hồi quyết định gia hạn lần ${N} do phê duyệt nhầm đối với hộ vay ${b.name}`);
      await pushConfirmationDocument('extension_revoke', `Giấy xác nhận thu hồi quyết định Gia hạn lần ${N} đối với hộ vay "${b.name}"`,
        `Quyết định gia hạn nợ lần ${N} đối với hộ vay "${b.name}" đã bị thu hồi do phê duyệt nhầm vào ngày ${fmtDate(todayStr())}.`, b);
      hideProcessingToast(); // Bước 4
      showBigToast(`Đã thu hồi thành công quyết định gia hạn lần ${N} của hộ vay ${b.name}`);
      if(onRevoked) onRevoked();
    };
  }

  function renderSettlementStatsHtml(list, hamlets){
    ensureFilterHamletsInit(hamlets);
    const selHamlets = state.filterHamlets;
    const allSelected = selHamlets.length===0 || selHamlets.length===hamlets.length;
    const orderedHamlets = allSelected ? [] : selHamlets.filter(h=>h!=='Khác').concat(selHamlets.includes('Khác')? ['Khác'] : []);
    const rows = allSelected
      ? [{ label: wardFullLabel(), groupList: list }]
      : orderedHamlets.map(h=> ({ label:`${subAdminLabel()} ${h}`, groupList: list.filter(b=>b.hamlet===h) }));
    const rowsHtml = rows.map(r=>{
      const principalSum = r.groupList.reduce((s,b)=> s+(parseFloat(b.principal)||0), 0);
      const counts = computeExtensionStatusCounts(r.groupList);
      const nearDue = r.groupList.filter(borrowerIsNearDue60).length;
      return `<tr>
        <td class="frz-stat1" style="font-weight:700; background:var(--white);">${escapeHtml(r.label)}</td>
        <td class="money">${moneySpaced(principalSum)}</td>
        <td>${counts.inTerm} hộ</td>
        <td>${nearDue} hộ</td>
        <td>${counts.overdue} hộ</td>
        <td>${counts.extended} hộ</td>
      </tr>`;
    }).join('');
    return `
      <div class="table-wrap" style="margin-bottom:18px;">
        <table>
          <thead><tr>
            <th class="sv-group-header-th frz-stat1" style="background:var(--paper-2);">Địa phương</th>
            <th class="sv-group-header-th">Tổng dư nợ</th>
            <th class="sv-group-header-th">Hộ trong hạn</th>
            <th class="sv-group-header-th">Gần đến hạn ≤60 ngày</th>
            <th class="sv-group-header-th">Hộ quá hạn</th>
            <th class="sv-group-header-th">Hộ được gia hạn</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }
  // Bảng nhóm theo phương án cho modal "Tất toán khoản vay/ Trả nợ trước hạn" — cột: Trả nợ trước
  // hạn (nút) | Tất toán khoản vay (nút) | Họ và tên | Số tiền gốc | Tiền lãi chưa đóng (tính đến
  // Quý hiện tại) | Tiền lãi chưa đóng (tính đến Ngày hiện tại) | Ngày đến hạn | Ngày gia hạn gần nhất.
  function renderSettlementGroupedTablesHtml(list, projectsRaw){
    if(!list.length) return `<div class="empty-state"><div class="e-ico">🌾</div>Chưa có người vay nào theo bộ lọc hiện tại</div>`;
    const projects = sortedActiveProjects(projectsRaw);
    function renderOneGroup(gid, groupListRaw, isOverdueBox){
      const groupList = isOverdueBox ? groupListRaw : sortedBorrowerGroup(groupListRaw, gid);
      const proj = gid==='__none__' ? null : projects.find(p=>p.id===gid);
      const projName = proj ? escapeHtml(proj.name) : '(Không rõ phương án — có thể đã bị xoá)';
      const duration = proj ? calcLoanDuration(proj.disburseDate, proj.dueDate) : '';
      const capitalTxt = proj ? `, ${groupDigitsRight(String(Math.round(proj.totalCapital||0)),3)} đồng` : '';
      const durationTxt = duration ? `, ${duration}` : '';
      const inactiveTxt = proj ? projectInactiveAmountTxt(proj) : '';
      const headerHtml = isOverdueBox
        ? `<span style="color:#b71c1c; font-weight:800;">⚠️ Quá hạn chưa được xử lý —</span><span>📋 ${projName} (${groupList.length} người vay)</span>`
        : `📋 ${projName} (${groupList.length} người vay)${capitalTxt}${durationTxt}${inactiveTxt}`;
      const headerBg = isOverdueBox ? rgbaToGradient('rgba(211,47,47,.16)') : projectGroupHeaderBg(gid);
      // Bổ sung: tính trước xem TOÀN BỘ nhóm có đủ điều kiện Tất toán khoản vay không (dùng đúng công
      // thức từng dòng bên dưới) — nếu có dù chỉ 1 người KHÔNG đủ điều kiện thì khoá TRỰC QUAN luôn nút
      // "Tất toán khoản vay" ở dòng TỔNG (không chỉ chặn khi bấm vào như trước).
      const groupSettleFinalOk = groupList.every(b=>{
        const exts0 = getBorrowerExtensions(b.id);
        const inExt0 = exts0.length>0;
        const dueRef0 = exts0.length? exts0[exts0.length-1].to : b.dueDate;
        const dLeft0 = daysRemainingUntil(dueRef0);
        return inExt0 || (dLeft0!=null && dLeft0<=60);
      });
      return `
      <div style="margin-bottom:18px;">
        <div class="sv-group-header" style="background:${headerBg}; display:flex; align-items:center; gap:6px;">${headerHtml}</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th class="frz-col1" style="background:var(--paper-2); min-width:110px;"><span class="wide-action-pair">Trả nợ trước hạn</span><span class="narrow-action-pair"></span></th><th class="frz-col2 narrow-action-pair-col2" style="background:var(--paper-2); min-width:110px;">Tất toán khoản vay</th><th class="frz-col3" style="background:var(--paper-2); ${svColStyleHeader({key:'name',label:'Họ và tên', userInput:true})}">Họ và tên</th><th style="${svColStyleHeader({align:'right',label:'Số tiền gốc (đ)'})}">Số tiền gốc</th><th style="${svColStyleHeader({align:'right',label:'Tiền lãi chưa đóng (Tính đến QUÝ Hiện Tại) (đ)'})}">Tiền lãi chưa đóng<br>(Tính đến QUÝ Hiện Tại)</th><th style="${svColStyleHeader({align:'right',label:'Tiền lãi chưa đóng (Tính đến Ngày Hiện Tại) (đ)'})}">Tiền lãi chưa đóng<br>(Tính đến Ngày Hiện Tại)</th><th style="${svColStyleHeader({key:'dueDate',label:'Ngày đến hạn'})}">Ngày đến hạn</th><th style="${svColStyleHeader({label:'Ngày gia hạn gần nhất'})}">Ngày gia hạn gần nhất</th></tr></thead>
            <tbody>${groupList.map(b=>{
              const exts = getBorrowerExtensions(b.id);
              const overdueUnhandled = borrowerIsOverdueUnhandled(b);
              const rowColor = overdueUnhandled ? activeLoanColor('overdue') : exts.length>0 ? activeLoanColor('extended') : daysRemainingRowColor(b.dueDate);
              const textStyle = overdueUnhandled ? 'color:#b71c1c; font-weight:700;' : '';
              const rowBg = rowColor || 'var(--white)';
              const disp = computeInterestPaymentBoxDisplay(b);
              const upToTodayAmt = borrowerUnpaidInterestUpToToday(b).total;
              const dueRef = exts.length? exts[exts.length-1].to : b.dueDate;
              const dLeft = daysRemainingUntil(dueRef);
              const inExt = exts.length>0; // ĐÃ TỪNG được gia hạn (bất kể lần, bất kể còn trong khoảng ngày gia hạn hay đã qua) -> luôn cho Tất toán, khoá Trả nợ trước hạn
              const canSettleFinal = inExt || (dLeft!=null && dLeft<=60); // trong thời gian gia hạn -> luôn cho, ngoài ra <=60 ngày kể cả 0/âm
              const canEarlyRepay = !inExt && !b.isHeir && (dLeft==null || dLeft>29); // đang gia hạn hoặc <=29 ngày hoặc là người thừa kế -> khoá
              let earlyRepayReason = '';
              if(b.isHeir) earlyRepayReason = 'Người thừa kế khoản vay chỉ được phép Tất toán khoản vay, không được Trả nợ trước hạn.';
              else if(inExt) earlyRepayReason = 'Hộ vay đang trong thời gian gia hạn nợ nên chỉ được phép Tất toán khoản vay, không được Trả nợ trước hạn.';
              else if(dLeft!=null && dLeft<=29) earlyRepayReason = `Hộ vay chỉ còn ${dLeft} ngày là đến hạn (≤29 ngày) nên không được Trả nợ trước hạn nữa, vui lòng chọn "Tất toán khoản vay".`;
              return `<tr${rowColor? ` style="background:${rowColor};${textStyle}"` : (textStyle?` style="${textStyle}"`:'')}>
                <td class="frz-col1" style="background:${rowBg};${textStyle}">${narrowActionPairHtml('settle-'+b.id,
                  `<button class="ext-action-btn ext-blue preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-settle-early="${b.id}" data-settle-early-ok="${canEarlyRepay?'1':'0'}" data-settle-early-reason="${escapeHtml(earlyRepayReason)}">Trả nợ trước hạn</button>`,
                  `<button class="ext-action-btn ext-blue preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-settle-final="${b.id}" data-settle-final-ok="${canSettleFinal?'1':'0'}">Tất toán khoản vay</button>`
                )}</td>
                <td class="frz-col2 narrow-action-pair-col2" style="background:${rowBg};${textStyle}"><button class="ext-action-btn ext-blue preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-settle-final="${b.id}" data-settle-final-ok="${canSettleFinal?'1':'0'}">Tất toán khoản vay</button></td>
                <td class="frz-col3 sv-col-wrap-check" style="background:${rowBg};${textStyle}${b.isHeir? ' text-decoration:underline;' : ''} ${svColStyle({key:'name',label:'Họ và tên', userInput:true})}">${overdueUnhandled?'⚠️ ':''}${escapeHtml(b.name)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Số tiền gốc (đ)'})}">${moneySpaced(b.principal)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Tiền lãi chưa đóng (Tính đến QUÝ Hiện Tại) (đ)'})}">${moneySpaced(disp.unpaidTotal)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Tiền lãi chưa đóng (Tính đến Ngày Hiện Tại) (đ)'})}">${moneySpaced(upToTodayAmt)}</td>
                <td style="${svColStyle({key:'dueDate',label:'Ngày đến hạn'})}">${fmtDate(b.dueDate)}</td>
                <td class="sv-col-wrap-check" style="${svColStyle({label:'Ngày gia hạn gần nhất'})}">${exts.length? 'hạn '+fmtDate(exts[exts.length-1].to) : ''}</td>
              </tr>`;
            }).join('')}
            <tr style="background:var(--paper-2); font-weight:700;">
              <td class="frz-col1" style="background:var(--paper-2);">${narrowActionPairHtml('settle-total-'+gid, '', groupSettleFinalOk
                ? `<button class="ext-action-btn ext-blue preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-shared-early-repay="${gid}" data-shared-early-repay-ids="${groupList.map(b=>b.id).join(',')}">Tất toán khoản vay</button>`
                : `<button class="ext-action-btn ext-blue preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-shared-early-repay="${gid}" data-shared-early-repay-ids="${groupList.map(b=>b.id).join(',')}" title="Có ít nhất 1 hộ trong nhóm chưa đủ điều kiện Tất toán khoản vay — bấm vào để xem chi tiết.">Tất toán khoản vay 🔒</button>`)}</td>
              <td class="frz-col2 narrow-action-pair-col2" style="background:var(--paper-2);">${groupSettleFinalOk
                ? `<button class="ext-action-btn ext-blue preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-shared-early-repay="${gid}" data-shared-early-repay-ids="${groupList.map(b=>b.id).join(',')}">Tất toán khoản vay</button>`
                : `<button class="ext-action-btn ext-blue preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-shared-early-repay="${gid}" data-shared-early-repay-ids="${groupList.map(b=>b.id).join(',')}" title="Có ít nhất 1 hộ trong nhóm chưa đủ điều kiện Tất toán khoản vay — bấm vào để xem chi tiết.">Tất toán khoản vay 🔒</button>`}</td>
              <td class="frz-col3" style="background:var(--paper-2);">TỔNG</td>
              <td class="money">${moneySpaced(groupList.reduce((s,b)=>s+(parseFloat(b.principal)||0),0))}</td>
              <td class="money">${moneySpaced(groupList.reduce((s,b)=>{ const d=computeInterestPaymentBoxDisplay(b); return s+d.unpaidTotal; },0))}</td>
              <td class="money">${moneySpaced(groupList.reduce((s,b)=> s+borrowerUnpaidInterestUpToToday(b).total, 0))}</td>
              <td></td>
              <td></td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>`;
    }
    const overdueList = list.filter(borrowerIsOverdueUnhandled);
    const normalList = list.filter(b=>!borrowerIsOverdueUnhandled(b));
    const overdueGroups = {};
    overdueList.forEach(b=>{ const key=(b.projectId && projects.some(p=>p.id===b.projectId))?b.projectId:'__none__'; (overdueGroups[key]=overdueGroups[key]||[]).push(b); });
    const overdueGroupOrder = projects.map(p=>p.id).filter(pid=>overdueGroups[pid]);
    if(overdueGroups['__none__']) overdueGroupOrder.push('__none__');
    const overdueHtml = overdueGroupOrder.map(gid=> renderOneGroup(gid, overdueGroups[gid], true)).join('');

    const groups = {};
    normalList.forEach(b=>{
      const key = (b.projectId && projects.some(p=>p.id===b.projectId)) ? b.projectId : '__none__';
      (groups[key] = groups[key]||[]).push(b);
    });
    const groupOrder = projects.map(p=>p.id).filter(pid=>groups[pid]);
    if(groups['__none__']) groupOrder.push('__none__');
    const normalHtml = groupOrder.map(gid=> renderOneGroup(gid, groups[gid], false)).join('');
    return overdueHtml + normalHtml;
  }

  // =====================================================================
  // Modal chính "Tất toán khoản vay/ Trả nợ trước hạn" — thiết kế Y HỆT modal "Gia hạn nợ" (cùng bộ
  // lọc, cùng bố cục), chỉ khác 2 cột thao tác + có thêm 1 cột thống kê "Gần đến hạn ≤60 ngày".
  // =====================================================================
  // =====================================================================
  // "QUẢN LÝ NỢ RỦI RO" — thiết kế lại gần giống hệt "Tất toán khoản vay/Trả nợ trước hạn", chỉ khác
  // cột thao tác và không đóng băng hộp chứa Quý (Nợ rủi ro vẫn là khoản vay ĐANG HOẠT ĐỘNG).
  // =====================================================================
  function renderRiskDebtStatsHtml(list, hamlets, fullList){
    // Dùng THẲNG đúng hàm thống kê chuẩn của "Tất toán khoản vay/Trả nợ trước hạn" — không còn logic
    // riêng nào nữa, đảm bảo tuyệt đối giống nhau ở cả 3 nút. Dùng fullList (toàn bộ người vay đang
    // hoạt động, không giới hạn theo điều kiện đủ điều kiện Nợ rủi ro) để các cột luôn phản ánh đúng
    // thực tế, y hệt cách "Tất toán" luôn hiển thị trên TOÀN BỘ danh sách.
    return renderSettlementStatsHtml(fullList||list, hamlets);
  }
  // Dùng CHUNG cho cả 2 danh sách: "đang xét" (nút "Nợ rủi ro") và "đã xác nhận" (nút "Lịch sử Nợ
  // rủi ro" + cột ngày xác nhận/lý do), tuỳ tham số isConfirmedList.
  function renderRiskDebtTablesHtml(list, projectsRaw, isConfirmedList){
    state._svRiskDebtCache = state._svRiskDebtCache || {};
    state._svRiskDebtCache[isConfirmedList?'confirmed':'candidates'] = { list, isConfirmedList };
    if(!list.length) return `<div class="empty-state"><div class="e-ico">🌾</div>${isConfirmedList? 'Chưa có hộ vay nào trong Danh sách Nợ rủi ro.' : 'Chưa có người vay nào theo bộ lọc hiện tại, hoặc không có khoản vay nào hợp lý về thời điểm để chuyển thành Nợ rủi ro, <b style="color:#b71c1c;">đồng chí có thể lướt xuống dưới để xem danh sách các hộ đang trong diện nợ rủi ro (nếu có)</b>'}</div>`;
    const projects = sortedActiveProjects(projectsRaw);
    function renderOneGroup(gid, groupListRaw, isOverdueBox){
      const groupList = isOverdueBox ? groupListRaw : sortedBorrowerGroup(groupListRaw, gid);
      const proj = gid==='__none__' ? null : projects.find(p=>p.id===gid);
      const projName = proj ? escapeHtml(proj.name) : '(Không rõ phương án — có thể đã bị xoá)';
      const capitalTxt = proj ? `, ${groupDigitsRight(String(Math.round(proj.totalCapital||0)),3)} đồng` : '';
      const headerHtml = isOverdueBox
        ? `<span style="color:#b71c1c; font-weight:800;">⚠️ Quá hạn chưa được xử lý —</span><span>📋 ${projName} (${groupList.length} người vay)</span>`
        : `📋 ${projName} (${groupList.length} người vay)${capitalTxt}`;
      const headerBg = isOverdueBox ? rgbaToGradient('rgba(211,47,47,.16)') : projectGroupHeaderBg(gid);
      return `
      <div style="margin-bottom:18px;">
        <div class="sv-group-header" style="background:${headerBg}; display:flex; align-items:center; gap:6px;">${headerHtml}</div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th class="frz-col1" style="background:var(--paper-2); min-width:110px;">${isConfirmedList? 'Xem lịch sử' : 'Xác nhận'}</th>
              <th class="frz-col2" style="background:var(--paper-2); ${svColStyleHeader({key:'name',label:'Họ và tên', userInput:true})}"><span class="dancing-header preview-allow" data-header-scope="riskdebt:${isConfirmedList?'confirmed':'candidates'}:${gid}">Họ và tên</span></th>
              <th style="${svColStyleHeader({align:'right',label:'Số tiền gốc (đ)'})}">Số tiền gốc</th>
              <th style="${svColStyleHeader({key:'dueDate',label:'Ngày đến hạn'})}">Ngày đến hạn</th>
              <th style="${svColStyleHeader({label:'Ngày gia hạn gần nhất'})}">Ngày gia hạn gần nhất</th>
              <th style="${svColStyleHeader({align:'center',label:'Số lần gia hạn'})}">Số lần gia hạn</th>
              ${isConfirmedList? `<th style="${svColStyleHeader({label:'Ngày xác nhận Nợ rủi ro'})}">Ngày xác nhận<br>Nợ rủi ro</th><th style="${svColStyleHeader({label:'Lý do'})}">Lý do</th>` : ''}
            </tr></thead>
            <tbody>${groupList.map(b=>{
              const exts = getBorrowerExtensions(b.id);
              const overdueUnhandled = borrowerIsOverdueUnhandled(b);
              const rowColor = isConfirmedList
                ? (b.badDebt ? activeLoanColor('baddebt') : activeLoanColor('riskdebt'))
                : (overdueUnhandled ? activeLoanColor('overdue') : exts.length>0 ? activeLoanColor('extended') : daysRemainingRowColor(b.dueDate));
              const textStyle = overdueUnhandled ? 'color:#b71c1c; font-weight:700;' : '';
              const rowBg = rowColor || 'var(--white)';
              return `<tr${rowColor? ` style="background:${rowColor};${textStyle}"` : (textStyle?` style="${textStyle}"`:'')}>
                <td class="frz-col1" style="background:${rowBg};${textStyle}">${isConfirmedList
                  ? (b.badDebt
                      ? `<button class="ext-action-btn ext-red-light preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-baddebt-history="${b.id}"><span class="btn-full-label">Lịch sử Nợ xấu</span><span class="btn-narrow-label">Xem LS</span></button>`
                      : `<button class="ext-action-btn ext-red-light preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-riskdebt-history="${b.id}"><span class="btn-full-label">Lịch sử Nợ rủi ro</span><span class="btn-narrow-label">Xem LS</span></button>`)
                  : `<button class="ext-action-btn ext-red-light preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-riskdebt-confirm="${b.id}">Nợ rủi ro</button>`}</td>
                <td class="frz-col2 sv-col-wrap-check" style="background:${rowBg};${textStyle}${b.isHeir? ' text-decoration:underline;' : ''} ${svColStyle({key:'name',label:'Họ và tên', userInput:true})}">${overdueUnhandled?'⚠️ ':''}${escapeHtml(b.name)}</td>
                <td class="money" style="${svColStyle({align:'right',label:'Số tiền gốc (đ)'})}">${moneySpaced(b.principal)}</td>
                <td style="${svColStyle({key:'dueDate',label:'Ngày đến hạn'})}">${fmtDate(b.dueDate)}</td>
                <td class="sv-col-wrap-check" style="${svColStyle({label:'Ngày gia hạn gần nhất'})}">${exts.length? 'hạn '+fmtDate(exts[exts.length-1].to) : ''}</td>
                <td style="${svColStyle({align:'center',label:'Số lần gia hạn'})}">${exts.length} lần</td>
                ${isConfirmedList? `<td style="${svColStyle({key:'dueDate',label:'Ngày xác nhận Nợ rủi ro'})}">${b.riskDebtDate? fmtDate(b.riskDebtDate) : ''}</td><td class="sv-col-wrap-check" style="${svColStyle({label:'Lý do'})}">${b.riskDebtReason? escapeHtml(b.riskDebtReason) : ''}</td>` : ''}
              </tr>`;
            }).join('')}
            <tr style="background:var(--paper-2); font-weight:700;">
              <td class="frz-col1" style="background:var(--paper-2);"></td>
              <td class="frz-col2" style="background:var(--paper-2);">TỔNG</td>
              <td class="money">${moneySpaced(groupList.reduce((s,b)=>s+(parseFloat(b.principal)||0),0))}</td>
              <td></td><td></td><td></td>
              ${isConfirmedList? `<td></td><td></td>` : ''}
            </tr>
            </tbody>
          </table>
        </div>
      </div>`;
    }
    // Nợ rủi ro (đã xác nhận) không bao giờ được coi là "Quá hạn chưa xử lý" (đã có xử lý rồi) nên
    // chỉ cần tách khung khi đang xét danh sách "chưa xác nhận".
    const overdueList = isConfirmedList ? [] : list.filter(borrowerIsOverdueUnhandled);
    const normalList = isConfirmedList ? list : list.filter(b=>!borrowerIsOverdueUnhandled(b));
    const overdueGroups = {};
    overdueList.forEach(b=>{ const key=(b.projectId && projects.some(p=>p.id===b.projectId))?b.projectId:'__none__'; (overdueGroups[key]=overdueGroups[key]||[]).push(b); });
    const overdueGroupOrder = projects.map(p=>p.id).filter(pid=>overdueGroups[pid]);
    if(overdueGroups['__none__']) overdueGroupOrder.push('__none__');
    const overdueHtml = overdueGroupOrder.map(gid=> renderOneGroup(gid, overdueGroups[gid], true)).join('');

    const groups = {};
    normalList.forEach(b=>{
      const key = (b.projectId && projects.some(p=>p.id===b.projectId)) ? b.projectId : '__none__';
      (groups[key] = groups[key]||[]).push(b);
    });
    const groupOrder = projects.map(p=>p.id).filter(pid=>groups[pid]);
    if(groups['__none__']) groupOrder.push('__none__');
    const normalHtml = groupOrder.map(gid=> renderOneGroup(gid, groups[gid], false)).join('');
    return overdueHtml + normalHtml;
  }
  // Panel/bảng "Danh sách khoản vay Nợ rủi ro" — dùng CHUNG cho cả panel độc lập ở Sổ vay vốn lẫn
  // phần cuối modal "Thêm, xoá, quản lý Nợ rủi ro". Mặc định chỉ hiện "Đang xử lý" (loại trừ Nợ xấu);
  // bấm nút cuối danh sách để xem "Các khoản vay Không có khả năng trả nợ".
  function buildRiskDebtListPanelHtml(preFiltered, idPrefix){
    idPrefix = idPrefix || 'rdp';
    const showBad = !!state.showRiskDebtBadList;
    const base = preFiltered || state.borrowers.filter(b=>!b.deleted && !b.settled && b.riskDebt);
    const list = base.filter(b=> showBad ? !!b.badDebt : !b.badDebt);
    const tableHtml = renderRiskDebtTablesHtml(list, state.loanProjects||[], true);
    const badDebtCount = base.filter(b=>!!b.badDebt).length;
    const processingCount = base.filter(b=>!b.badDebt).length;
    const toggleBtn = `<div style="text-align:center; margin-top:14px;"><button type="button" class="btn btn-ghost btn-sm preview-allow" data-riskdebt-toggle-bad="1" data-riskdebt-idprefix="${idPrefix}" style="${!showBad?'color:#b71c1c; font-weight:700;':''}">${showBad? `Xem Danh sách Nợ rủi ro trong diện đang xử lý (${processingCount})` : `Xem Các khoản vay Không có khả năng trả nợ (${badDebtCount})`}</button></div>`;
    const title = showBad? `<div class="divider-lbl">🚫 Các khoản vay Không có khả năng trả nợ</div>` : `<div class="divider-lbl">⚠️ Danh sách Nợ rủi ro trong diện đang xử lý</div>`;
    return title + tableHtml + toggleBtn;
  }
  // Số lượng khoản vay đang trong diện "Nợ rủi ro đang xử lý" (KHÔNG tính các khoản đã bị đánh dấu
  // "Không có khả năng trả nợ") — dùng cho tiêu đề panel/modal.
  function countRiskDebtProcessing(){
    return state.borrowers.filter(b=>!b.deleted && !b.settled && b.riskDebt && !b.badDebt).length;
  }

  function renderRiskDebtModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();

    function renderBody(){
      const hamlets = state.config.hamlets||[];
      const projects = activeLoanProjects();
      ensureFilterHamletsInit(hamlets);
      ensureFilterProjectsInit(projects);
      // Quần thể dùng cho BẢNG THỐNG KÊ CHUNG — PHẢI giống hệt quần thể của "Tất toán khoản vay/Trả
      // nợ trước hạn" (không loại trừ hộ đang là Nợ rủi ro), để 3 bảng thống kê luôn khớp nhau tuyệt
      // đối. Đây là biến số HOÀN TOÀN TÁCH BIỆT khỏi danh sách "đủ điều kiện xác nhận Nợ rủi ro" dùng
      // cho bảng danh sách bên dưới.
      let statsFullList = state.borrowers.filter(b=>!b.deleted && !b.settled);
      if(state.search) statsFullList = statsFullList.filter(b=> (b.name+b.cccd+b.phone).toLowerCase().includes(state.search.toLowerCase()));
      if(state.filterHamlets.length < hamlets.length) statsFullList = statsFullList.filter(b=>state.filterHamlets.includes(b.hamlet));
      if(state.filterProjectIds.length < projects.length) statsFullList = statsFullList.filter(b=>state.filterProjectIds.includes(b.projectId));
      { const fs=fundSourcesInUse(); ensureFilterFundSourcesInit(fs); if(state.filterFundSources.length < fs.length) statsFullList = statsFullList.filter(b=>state.filterFundSources.includes((b.fundSource||'').trim())); }
      { const mgrs=ensureDefaultManagers(); ensureFilterManagersInit(mgrs); if(state.filterManagerIds.length < mgrs.length) statsFullList = statsFullList.filter(b=>state.filterManagerIds.includes(b.managerId||'chihoitruong')); }

      let list = state.borrowers.filter(b=>!b.deleted && !b.settled && !b.riskDebt);
      if(state.search) list = list.filter(b=> (b.name+b.cccd+b.phone).toLowerCase().includes(state.search.toLowerCase()));
      if(state.filterHamlets.length < hamlets.length) list = list.filter(b=>state.filterHamlets.includes(b.hamlet));
      if(state.filterProjectIds.length < projects.length) list = list.filter(b=>state.filterProjectIds.includes(b.projectId));
      { const fs=fundSourcesInUse(); ensureFilterFundSourcesInit(fs); if(state.filterFundSources.length < fs.length) list = list.filter(b=>state.filterFundSources.includes((b.fundSource||'').trim())); }
      { const mgrs=ensureDefaultManagers(); ensureFilterManagersInit(mgrs); if(state.filterManagerIds.length < mgrs.length) list = list.filter(b=>state.filterManagerIds.includes(b.managerId||'chihoitruong')); }
      // Chỉ cho phép xác nhận Nợ rủi ro với những hộ ĐỦ ĐIỀU KIỆN: đã từng được gia hạn (bất kể lần
      // nào), HOẶC gần đến hạn ≤60 ngày (kể cả đã quá hạn).
      list = list.filter(borrowerEligibleForActionList);
      const statsHtml = renderSettlementStatsHtml(statsFullList, hamlets);
      const tablesHtml = renderRiskDebtTablesHtml(list, projects, false);

      let riskList = state.borrowers.filter(b=>!b.deleted && !b.settled && b.riskDebt);
      if(state.search) riskList = riskList.filter(b=> (b.name+b.cccd+b.phone).toLowerCase().includes(state.search.toLowerCase()));
      if(state.filterHamlets.length < hamlets.length) riskList = riskList.filter(b=>state.filterHamlets.includes(b.hamlet));
      if(state.filterProjectIds.length < projects.length) riskList = riskList.filter(b=>state.filterProjectIds.includes(b.projectId));
      const riskHtml = buildRiskDebtListPanelHtml(riskList);

      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1300px; border:6px solid #ef9a9a;">
          <div class="modal-head" style="background:linear-gradient(180deg, #ffffff 0%, #ffcdd2 50%, #ef9a9a 100%);"><h3 style="color:#7a1f1f;">${waveTextHtmlSlow('⚠️ Thêm, xoá, quản lý Nợ rủi ro')}</h3><button class="modal-close preview-allow" id="rdm-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; overflow:auto;">
            <div class="toolbar" style="flex-wrap:wrap;">
              <input id="rdm-search" class="preview-allow" placeholder="🔎 Tìm theo tên, CCCD, SĐT..." value="${state.search}" style="min-width:200px;${(state.search!=='' && state.search!==' ')? "border:2px solid #b71c1c;" : ""}">
              ${buildHamletFilterDropdownHtml(hamlets)}
              ${buildProjectFilterDropdownHtml(projects)}
              ${buildFundSourceFilterDropdownHtml()}
              ${buildManagerFilterDropdownHtml()}
              <button class="btn btn-ghost btn-sm preview-allow ${resetFilterBtnClass(hamlets, projects)}" id="rdm-reset-all-btn">↺ Khôi phục bộ lọc gốc</button>
            </div>
            <div class="divider-lbl" style="margin-top:14px;">📋 Danh sách khoản vay đang hoạt động</div>
            <p class="sub" style="margin:10px 0;">Chỉ cho phép gia hạn nợ (hoặc cho phép nợ rủi ro) đối với những hộ có ngày Gần đến hạn ≤60 ngày, đã quá hạn hoặc đang trong thời gian gia hạn nợ.</p>
            ${statsHtml}
            ${tablesHtml}
            <div class="divider-lbl" style="margin-top:24px;">⚠️ Danh sách Nợ rủi ro</div>
            <div id="rdm-risk-area">${riskHtml}</div>
            <div style="display:flex; gap:8px; margin-top:16px;">
              <button class="btn btn-ghost preview-allow" id="rdm-close-bottom">Đóng bảng</button>
            </div>
          </div>
        </div>`;
      wire(hamlets, projects);
    }

    function wire(hamlets, projects){
      wrap.querySelector('#rdm-close').onclick = close;
      wrap.querySelector('#rdm-close-bottom').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const riskArea = wrap.querySelector('#rdm-risk-area');
      if(riskArea) riskArea.addEventListener('click', (e)=>{
        if(!e.target.closest('button')) return;
        setTimeout(()=>{ const body = wrap.querySelector('.modal-body'); if(body) body.scrollTop = body.scrollHeight; }, 0);
      });
      wrap.querySelector('#rdm-search').oninput = (e)=>{ state.search = e.target.value; rerenderKeepingFocus(renderBody); };
      const toggleDropdown = (kind)=>{ state.openFilterDropdown = state.openFilterDropdown===kind ? null : kind; renderBody(); };
      const hb = wrap.querySelector('#f-hamlet-btn'); if(hb) hb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('hamlet'); };
      const pb = wrap.querySelector('#f-project-btn'); if(pb) pb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('project'); };
      const hAll = wrap.querySelector('#f-hamlet-all'); if(hAll) hAll.onclick=(e)=>{ e.stopPropagation(); toggleHamletAll(hamlets, hAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-hamlet-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleHamletOne(hamlets, cb.dataset.name, cb.checked); renderBody(); });
      const pAll = wrap.querySelector('#f-project-all'); if(pAll) pAll.onclick=(e)=>{ e.stopPropagation(); toggleProjectAll(projects, pAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-project-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleProjectOne(projects, cb.dataset.id, cb.checked); renderBody(); });
      const fsb = wrap.querySelector('#f-fundsource-btn'); if(fsb) fsb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('fundsource'); };
      const mb = wrap.querySelector('#f-manager-btn'); if(mb) mb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('manager'); };
      const fsAll = wrap.querySelector('#f-fundsource-all'); if(fsAll) fsAll.onclick=(e)=>{ e.stopPropagation(); toggleFundSourceAll(fundSourcesInUse(), fsAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-fundsource-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleFundSourceOne(fundSourcesInUse(), cb.dataset.name, cb.checked); renderBody(); });
      const mAll = wrap.querySelector('#f-manager-all'); if(mAll) mAll.onclick=(e)=>{ e.stopPropagation(); toggleManagerAll(ensureDefaultManagers(), mAll.checked); renderBody(); };
      wrap.querySelectorAll('.f-manager-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleManagerOne(ensureDefaultManagers(), cb.dataset.id, cb.checked); renderBody(); });
      const resetAllBtn = wrap.querySelector('#rdm-reset-all-btn'); if(resetAllBtn) resetAllBtn.onclick=()=>{ resetAllBorrowerFilters(hamlets, projects); renderBody(); };

      wrap.querySelectorAll('[data-riskdebt-confirm]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.riskdebtConfirm);
          if(b) renderRiskDebtConfirmModal(b);
        };
      });
      wrap.querySelectorAll('[data-riskdebt-history]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.riskdebtHistory);
          if(b) renderRiskDebtHistoryModal(b);
        };
      });
      wrap.querySelectorAll('[data-baddebt-history]').forEach(btn=>{
        btn.onclick = ()=>{
          const b = state.borrowers.find(x=>x.id===btn.dataset.baddebtHistory);
          if(b) renderBadDebtHistoryModal(b);
        };
      });
      wrap.querySelectorAll('[data-riskdebt-toggle-bad]').forEach(btn=>{
        btn.onclick = ()=>{ state.showRiskDebtBadList = !state.showRiskDebtBadList; renderBody(); };
      });

      if(!wrap._outsideClickBound){
        wrap._outsideClickBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
          if(e.target.closest('.sv-filter-dropdown')) return;
          state.openFilterDropdown = null;
          if(document.body.contains(wrap)) renderBody();
        });
      }
    }

    wrap.dataset.riskdebtModal = '1';
    wrap._refreshRiskDebt = renderBody;
    renderBody();
  }
  function refreshOpenRiskDebtModal(){
    const w = document.querySelector('[data-riskdebt-modal]');
    if(w && w._refreshRiskDebt) w._refreshRiskDebt();
  }

  // "GIẤY XÁC NHẬN LÀ NỢ RỦI RO ĐỐI VỚI HỘ VAY ..."
  // Tiền lãi CHƯA ĐÓNG trong TƯƠNG LAI tính từ 1 MỐC NGÀY BẤT KỲ trở đi (VD: "Ngày xác nhận được nêu
  // trong hồ sơ thực tế" của Nợ rủi ro) — hộp chứa Quý đang "ôm" đúng mốc đó chỉ tính phần còn lại.
  function borrowerFutureInterestFrom(b, fromDateStr){
    const disp = computeInterestPaymentBoxDisplay(b);
    const principal = parseFloat(b.principal)||0;
    let total = 0; const lines = [];
    disp.allBoxes.forEach(bx=>{
      if(disp.paidKeys.has(bx.key)) return; // đã đóng rồi -> bỏ qua
      if(bx.to<=fromDateStr) return; // đã kết thúc trước/đúng mốc -> bỏ qua hoàn toàn
      if(bx.from<fromDateStr && bx.to>fromDateStr){
        // Hộp đang "ôm" đúng mốc ngày -> chỉ tính phần còn lại từ mốc đó tới hết hộp
        const days = Math.max(0, daysBetween(fromDateStr, bx.to));
        const cycleDays = annualCycleDaysForYear(bx.year, b.frozenQuarterConfig);
        const amt = Math.round(principal * ((bx.rate||0)/100/cycleDays) * days);
        total += amt; lines.push({ name: formatTimelineQuarterLabel(bx), amount: amt, box: bx });
      } else {
        // Hộp bắt đầu SAU hoặc ĐÚNG mốc -> tính trọn vẹn
        total += bx.interestAmount; lines.push({ name: formatTimelineQuarterLabel(bx), amount: bx.interestAmount, box: bx });
      }
    });
    return { total, lines };
  }
  function renderRiskDebtConfirmModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const exts = getBorrowerExtensions(b.id);
    const proj = projectOf(b);
    const dueRef = exts.length? exts[exts.length-1].to : (proj? proj.dueDate : b.dueDate);
    const dayAfterDue = (()=>{ const d = new Date(dueRef+'T00:00:00'); d.setDate(d.getDate()+1); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; })();
    const defaultDate = (rawDaysRemaining(todayStr())===null || (rawDaysRemaining(dueRef)!=null && rawDaysRemaining(dueRef)<0)) ? todayStr() : dayAfterDue;
    const maxDate = (()=>{ const d = new Date(); d.setDate(d.getDate()+60); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; })();
    function render(){
      const chosenDate = wrap.querySelector('#rdc-date') ? wrap.querySelector('#rdc-date').value : defaultDate;
      const futureInfo = borrowerFutureInterestFrom(b, chosenDate||defaultDate);
      wrap.innerHTML = `
        <div class="modal" style="max-width:96vw; width:600px;">
          <div class="modal-head receipt-head-refund"><h3>GIẤY XÁC NHẬN LÀ NỢ RỦI RO ĐỐI VỚI HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="rdc-close">✕</button></div>
          <div class="modal-body">
            <p class="sub" style="margin:0 0 10px;">Ngày lập giấy xác nhận trên hệ thống bộ nhớ đám mây là: ${fmtDate(todayStr())}</p>
            <p class="sub" style="line-height:1.7;">Nếu xác nhận hộ vay này là <b>Nợ rủi ro</b> — tức là có khả năng không thể trả được nợ gốc — thì khoản vay này cần được khoanh nợ. Hệ thống sẽ ghi nhận hộ vay này vào bộ nhớ đám mây; tuy nhiên cấp xã/phường vẫn <b>bắt buộc phải lập hồ sơ xử lý nợ rủi ro</b> theo đúng quy định của các Văn bản Quỹ Hỗ trợ Nông dân hiện hành. Khi nào xử lý xong, hãy quay lại đây, vào Danh sách Nợ rủi ro và bấm nút "Đã xử lý nợ rủi ro xong".</p>
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; margin:10px 0; padding:10px; border:1px solid var(--line); border-radius:8px; background:var(--paper-2);">
              <input type="checkbox" id="rdc-keep-interest" class="preview-allow" style="margin-top:3px;">
              <span>Tính tiền lãi cho hộ này trong thời gian xử lý nợ rủi ro (${moneySpaced(futureInfo.total)}) <span class="sub">(có lãi: tick chọn; không lãi: bỏ chọn)</span></span>
            </label>
            <p class="sub" style="margin:-4px 0 10px;">Nếu bỏ chọn, hệ thống sẽ tự động khoá các Quý tương lai của hộ này tính từ "Ngày xác nhận được nêu trong hồ sơ thực tế" (bên dưới) trở đi, không còn tính tiền lãi nữa cho tới khi hộ này được khôi phục hoặc tất toán.</p>
            <div class="field"><label>Lý do hộ này là Nợ rủi ro *</label><textarea id="rdc-reason" rows="3" maxlength="300" class="preview-allow" placeholder="Nhập lý do (bắt buộc)...">${wrap.querySelector('#rdc-reason')?wrap.querySelector('#rdc-reason').value:''}</textarea></div>
            <div class="field"><label>Ngày xác nhận được nêu trong hồ sơ thực tế *</label><input id="rdc-date" type="date" class="preview-allow" min="${dayAfterDue}" max="${maxDate}" value="${chosenDate||defaultDate}"></div>
            <p class="sub" style="margin:-4px 0 0;">Ngày này phải SAU "Ngày đến hạn" (hoặc "Ngày gia hạn gần nhất" nếu có) là ${fmtDate(dueRef)} — không được trùng hoặc trước ngày đó, và không được vượt quá 60 ngày trong tương lai so với hôm nay.</p>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="rdc-cancel">Đóng bảng quay lại</button>
            <button class="btn btn-primary preview-allow" id="rdc-confirm">Xác nhận hộ này là Nợ rủi ro</button>
          </div>
        </div>`;
      wrap.querySelector('#rdc-close').onclick = close;
      wrap.querySelector('#rdc-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelector('#rdc-date').addEventListener('change', render);
      wrap.querySelector('#rdc-confirm').onclick = async ()=>{
        if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
        if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
        const reason = (wrap.querySelector('#rdc-reason').value||'').trim();
        if(!reason){ alert('Vui lòng điền lý do trước khi xác nhận.'); return; }
        const date = wrap.querySelector('#rdc-date').value;
        if(!date){ alert('Vui lòng chọn Ngày xác nhận được nêu trong hồ sơ thực tế.'); return; }
        if(date <= dueRef){ alert(`Ngày xác nhận phải SAU ngày ${fmtDate(dueRef)} (Ngày đến hạn hoặc Ngày gia hạn gần nhất) — không được trùng hoặc trước ngày đó.`); return; }
        if(date > maxDate){ alert(`Ngày xác nhận không được vượt quá 60 ngày trong tương lai so với hôm nay (chậm nhất là ${fmtDate(maxDate)}).`); return; }
        const keepInterest = wrap.querySelector('#rdc-keep-interest').checked;
        if(!confirm(`Đồng chí có CHẮC CHẮN muốn xác nhận hộ vay "${b.name}" là Nợ rủi ro không?`)) return;
        close(); // Bước 1
        showProcessingToast(); // Bước 2
        try{
          await markBorrowerRiskDebt(b, reason, date, keepInterest);
          await pushLog('xác nhận', `hộ vay ${b.name} là Nợ rủi ro (lý do: ${reason})`);
          await pushConfirmationDocument('riskdebt_confirm', `Giấy xác nhận là Nợ rủi ro đối với hộ vay "${b.name}"`,
            [
              `Hộ vay "${b.name}" đã được xác nhận là Nợ rủi ro vào ngày ${fmtDate(todayStr())}.`,
              `Ngày xác nhận được nêu trong hồ sơ thực tế: ${fmtDate(date)}`,
              `Lý do: ${reason}`,
              `Số tiền vay gốc: ${money(b.principal)}`,
              `Lãi suất: ${String(parseFloat(b.rate)||0).replace('.',',')}%/năm`,
              `Ngày vay: ${fmtDate(b.loanDate)}`,
              `Ngày đến hạn (hoặc gia hạn gần nhất): ${fmtDate(dueRef)}`,
              `Tính tiền lãi trong thời gian xử lý: ${keepInterest?'Có tiếp tục tính lãi':'Không tính lãi kể từ ngày '+fmtDate(date)+' trở đi (đã khoá Quý tương lai)'}`,
            ].join('\n'), b);
          refreshOpenRiskDebtModal();
          const contentEl = document.getElementById('content');
          if(contentEl && state.activeTab==='data') renderDataTab(contentEl);
        }catch(err){
          console.error('Lỗi khi xác nhận Nợ rủi ro:', err);
          alert(`Đã xác nhận thành công nhưng có lỗi nhỏ xảy ra khi làm mới giao diện: ${err && err.message ? err.message : err}. Vui lòng tải lại trang để xem kết quả mới nhất.`);
        }
        hideProcessingToast(); // Bước 4
        showBigToast(`Đã xác nhận: hộ vay ${b.name} là Nợ rủi ro`);
      };
    }
    render();
  }

  // "Lịch sử Nợ rủi ro" — xem lại thông tin đã xác nhận, có nút xử lý xong / khôi phục (thiết kế sau).
  function renderRiskDebtHistoryModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const interestLine = b.riskDebtKeepInterest
      ? 'Tiếp tục tính tiền lãi cho hộ này trong thời gian xử lý nợ rủi ro'
      : `KHÔNG tính tiền lãi cho hộ này kể từ "Ngày xác nhận được nêu trong hồ sơ thực tế" (${fmtDate(b.riskDebtDate)}) trở đi (các Quý tương lai đã bị khoá)`;
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:600px;">
        <div class="modal-head receipt-head-refund"><h3>LỊCH SỬ NỢ RỦI RO CỦA HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="rdh-close">✕</button></div>
        <div class="modal-body">
          <p class="sub" style="margin:0 0 10px;">Ngày lập giấy xác nhận trên hệ thống bộ nhớ đám mây là: ${b.riskDebtConfirmedAt? fmtDate(b.riskDebtConfirmedAt.slice(0,10)) : ''}</p>
          <div class="kv-row"><span>Ngày xác nhận được nêu trong hồ sơ thực tế</span><b>${fmtDate(b.riskDebtDate)}</b></div>
          <div class="kv-row"><span>Lý do</span><b>${escapeHtml(b.riskDebtReason||'')}</b></div>
          <div class="kv-row"><span>Tính tiền lãi trong thời gian xử lý</span><b>${interestLine}</b></div>
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:16px;">
            <button type="button" class="btn btn-primary preview-allow" id="rdh-processed">Tất toán khoản vay này</button>
            <button type="button" class="btn preview-allow" style="background:#fff3e0; color:#e65100;" id="rdh-baddebt">Không thể tất toán khoản vay</button>
            <button type="button" class="btn preview-allow" style="background:#ffcdd2; color:#b71c1c;" id="rdh-restore">↩️ Khôi phục về trạng thái ban đầu cho khoản vay do nhầm lẫn</button>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="rdh-close2">Đóng bảng</button>
        </div>
      </div>`;
    wrap.querySelector('#rdh-close').onclick = close;
    wrap.querySelector('#rdh-close2').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    // "Tất toán khoản vay này" -> chính là Biên lai Tất toán khoản vay thật (đầy đủ bổ sung tiền
    // lãi chưa đóng), chỉ khác "Quay lại" ở đây trả về đúng bảng Lịch sử Nợ rủi ro này.
    wrap.querySelector('#rdh-processed').onclick = ()=>{
      close();
      renderFinalSettlementModal(b, ()=>{ renderRiskDebtHistoryModal(b); }, true);
    };
    wrap.querySelector('#rdh-baddebt').onclick = ()=>{ close(); renderBadDebtConfirmModal(b); };
    wrap.querySelector('#rdh-restore').onclick = ()=>{ close(); renderRiskDebtRestoreModal(b); };
  }

  // "Không thể tất toán khoản vay" — GIẤY XÁC NHẬN KHÔNG CÓ KHẢ NĂNG TRẢ NỢ.
  function renderBadDebtConfirmModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    // Chỉ hiện lựa chọn "Không thể trả luôn cả tiền lãi chưa đóng" khi hộ này ĐANG được tính lãi
    // trong thời gian xử lý Nợ rủi ro VÀ thực sự còn nợ tiền lãi chưa đóng (nếu đã đóng lãi hết rồi
    // thì lựa chọn này không còn ý nghĩa gì nữa, tự động biến mất).
    const stillOwesInterest = computeInterestPaymentBoxDisplay(b).unpaidTotal > 0;
    const showInterestChoice = !!b.riskDebtKeepInterest && stillOwesInterest;
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:600px;">
        <div class="modal-head receipt-head-refund"><h3>GIẤY XÁC NHẬN KHÔNG CÓ KHẢ NĂNG TRẢ NỢ ĐỐI VỚI HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="bdc-close">✕</button></div>
        <div class="modal-body">
          <p class="sub" style="margin:0 0 10px;">Giấy này được lập vào ngày ${fmtDate(todayStr())}</p>
          <p class="sub" style="line-height:1.7;">Hệ thống sẽ tự động lập giấy xác nhận cho hộ vay này là <b>KHÔNG CÓ KHẢ NĂNG TRẢ NỢ</b> — tức là không có khả năng trả nợ gốc và tiền lãi chưa đóng (nếu có). Cấp xã/phường vẫn <b>bắt buộc phải lập hồ sơ hoàn thiện</b> cho hộ này theo đúng quy định trong các Văn bản Quỹ Hỗ trợ Nông dân hiện hành, và nộp hồ sơ lên cấp trên. Chỉ sau khi cấp trên phê duyệt hộ này không có khả năng trả nợ, mới được bấm nút "Xác nhận" bên dưới.</p>
          ${showInterestChoice? `
          <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; margin:10px 0; padding:10px; border:1px solid var(--line); border-radius:8px; background:var(--paper-2);">
            <input type="checkbox" id="bdc-no-interest-too" class="preview-allow" checked style="margin-top:3px;">
            <span>Không thể trả luôn cả tiền lãi chưa đóng</span>
          </label>` : ''}
          <div class="field"><label>Lý do không thể tất toán khoản vay *</label><textarea id="bdc-reason" rows="3" maxlength="200" class="preview-allow" placeholder="Nhập lý do (bắt buộc, tối đa 200 ký tự)..."></textarea></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="bdc-back">Quay lại (không phê duyệt)</button>
          <button class="btn btn-primary preview-allow" id="bdc-confirm">Xác nhận (Phê duyệt cho hộ này)</button>
        </div>
      </div>`;
    wrap.querySelector('#bdc-close').onclick = close;
    wrap.querySelector('#bdc-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#bdc-confirm').onclick = async ()=>{
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
      if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
      const reason = (wrap.querySelector('#bdc-reason').value||'').trim();
      if(!reason){ alert('Vui lòng điền lý do trước khi xác nhận.'); return; }
      const noInterestTooEl = wrap.querySelector('#bdc-no-interest-too');
      const noInterestToo = noInterestTooEl ? noInterestTooEl.checked : true;
      // Nếu BỎ CHỌN "Không thể trả luôn cả tiền lãi chưa đóng" (tức là hộ này VẪN trả được tiền lãi,
      // chỉ không trả được tiền gốc) -> KHÔNG xác nhận Nợ xấu ngay, mà mở Biên lai thu tiền lãi THẬT
      // để thu khoản lãi đó trước. Dù đóng lãi xong hay bấm "Quay lại" (chưa đóng xong), đều quay về
      // đúng bảng LỊCH SỬ NỢ RỦI RO như cũ — KHÔNG xác nhận Nợ xấu trong cả 2 trường hợp.
      if(noInterestTooEl && !noInterestToo){
        close();
        const backToHistory = ()=>{
          document.querySelectorAll('.modal-bg').forEach(el=>{ if(!el.dataset.riskdebtModal) el.remove(); });
          renderRiskDebtHistoryModal(b);
        };
        renderMoneyBasedReceiptModal(b, backToHistory, backToHistory);
        return;
      }
      if(!confirm(`Đồng chí có CHẮC CHẮN muốn phê duyệt hộ vay "${b.name}" là KHÔNG CÓ KHẢ NĂNG TRẢ NỢ không?`)) return;
      close(); // Bước 1
      showProcessingToast(); // Bước 2
      try{
        await markBorrowerBadDebt(b, reason, noInterestToo);
        await pushLog('xác nhận', `hộ vay ${b.name} không có khả năng trả nợ (lý do: ${reason})`);
        await pushConfirmationDocument('bad_debt', `Giấy xác nhận không có khả năng trả nợ đối với hộ vay "${b.name}"`,
          [
            `Hộ vay "${b.name}" đã được phê duyệt là không có khả năng trả nợ vào ngày ${fmtDate(todayStr())}.`,
            `Lý do: ${reason}`,
            `Số tiền vay gốc: ${money(b.principal)}`,
            `Không thể trả luôn cả tiền lãi chưa đóng: ${noInterestToo?'Có':'Không (vẫn trả được tiền lãi)'}`,
            `Trạng thái Nợ rủi ro trước đó (ngày xác nhận trong hồ sơ thực tế): ${fmtDate(b.riskDebtDate)}`,
            `Lý do Nợ rủi ro trước đó: ${b.riskDebtReason||''}`,
          ].join('\n'), b);
        refreshOpenRiskDebtModal();
      }catch(err){
        console.error('Lỗi khi xác nhận Nợ xấu:', err);
        alert(`Đã xác nhận thành công nhưng có lỗi nhỏ xảy ra khi làm mới giao diện: ${err && err.message ? err.message : err}. Vui lòng tải lại trang để xem kết quả mới nhất.`);
      }
      hideProcessingToast(); // Bước 4
      showBigToast(`Đã xác nhận: hộ vay ${b.name} không có khả năng trả nợ`);
    };
  }

  // "Lịch sử Nợ xấu" — ghi đủ nội dung 2 giấy xác nhận (Nợ rủi ro đang xử lý + Không có khả năng trả
  // nợ), có nút "Khôi phục lại trạng thái trước đó do phê duyệt nhầm" ngay dưới tiêu đề.
  function renderBadDebtHistoryModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:600px;">
        <div class="modal-head receipt-head-refund"><h3>LỊCH SỬ NỢ XẤU CỦA HỘ VAY ${escapeHtml(b.name).toUpperCase()}</h3><button class="modal-close preview-allow" id="bdh-close">✕</button></div>
        <div class="modal-body">
          <button type="button" class="btn preview-allow" style="background:#ffcdd2; color:#b71c1c; font-weight:700; width:100%; margin-bottom:14px;" id="bdh-restore">↩️ Khôi phục lại trạng thái trước đó do phê duyệt nhầm</button>
          <div class="divider-lbl">Giấy xác nhận không có khả năng trả nợ</div>
          <div class="kv-row"><span>Ngày lập giấy xác nhận trên hệ thống</span><b>${fmtDate(b.badDebtDate)}</b></div>
          <div class="kv-row"><span>Lý do</span><b>${escapeHtml(b.badDebtReason||'')}</b></div>
          ${b.riskDebtKeepInterest? `<div class="kv-row"><span>Không thể trả luôn cả tiền lãi chưa đóng</span><b>${b.badDebtNoInterestToo? 'Có' : 'Không'}</b></div>` : ''}
          <div class="divider-lbl" style="margin-top:14px;">Giấy xác nhận Nợ rủi ro (đang xử lý) trước đó</div>
          <div class="kv-row"><span>Ngày lập giấy xác nhận trên hệ thống</span><b>${b.riskDebtConfirmedAt? fmtDate(b.riskDebtConfirmedAt.slice(0,10)) : ''}</b></div>
          <div class="kv-row"><span>Ngày xác nhận được nêu trong hồ sơ thực tế</span><b>${fmtDate(b.riskDebtDate)}</b></div>
          <div class="kv-row"><span>Lý do</span><b>${escapeHtml(b.riskDebtReason||'')}</b></div>
          <div class="kv-row"><span>Tính tiền lãi trong thời gian xử lý</span><b>${b.riskDebtKeepInterest? 'Có tiếp tục tính lãi' : `Không tính lãi kể từ ${fmtDate(b.riskDebtDate)} (đã khoá Quý tương lai)`}</b></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="bdh-close2">Đóng bảng</button>
        </div>
      </div>`;
    wrap.querySelector('#bdh-close').onclick = close;
    wrap.querySelector('#bdh-close2').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#bdh-restore').onclick = ()=>{ close(); renderBadDebtRestoreModal(b); };
  }
  // Bảng phụ xác nhận "Khôi phục lại trạng thái trước đó do phê duyệt nhầm" (từ Nợ xấu về lại Đang
  // xử lý Nợ rủi ro).
  function renderBadDebtRestoreModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:520px;">
        <div class="modal-head receipt-head-refund"><h3>Khôi phục lại trạng thái trước đó</h3><button class="modal-close preview-allow" id="bdr-close">✕</button></div>
        <div class="modal-body">
          <p class="sub" style="line-height:1.7;">Nếu xác nhận khôi phục, hộ vay "${escapeHtml(b.name)}" sẽ quay lại đúng danh sách "Đang xử lý Nợ rủi ro" như trước đó. Hệ thống sẽ tự động lập 1 Giấy xác nhận mới cho hành động này và lưu vào kho Giấy xác nhận.</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="bdr-back">Quay lại</button>
          <button class="btn btn-primary preview-allow" id="bdr-confirm">Xác nhận khôi phục</button>
        </div>
      </div>`;
    wrap.querySelector('#bdr-close').onclick = close;
    wrap.querySelector('#bdr-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#bdr-confirm').onclick = async ()=>{
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
      if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
      if(!confirm(`Đồng chí có CHẮC CHẮN muốn khôi phục hộ vay "${b.name}" về lại trạng thái Đang xử lý Nợ rủi ro không?`)) return;
      close(); // Bước 1
      showProcessingToast(); // Bước 2
      await restoreBorrowerFromBadDebt(b);
      await pushLog('xác nhận', `khôi phục hộ vay ${b.name} về lại trạng thái Đang xử lý Nợ rủi ro do phê duyệt nhầm`);
      await pushConfirmationDocument('bad_debt_revoke', `Giấy xác nhận khôi phục trạng thái đối với hộ vay "${b.name}"`,
        `Hộ vay "${b.name}" đã được khôi phục từ "Không có khả năng trả nợ" về lại "Đang xử lý Nợ rủi ro" vào ngày ${fmtDate(todayStr())} do phê duyệt nhầm.`, b);
      refreshOpenRiskDebtModal();
      hideProcessingToast(); // Bước 4
      showBigToast(`Đã khôi phục thành công: hộ vay ${b.name} quay lại danh sách Đang xử lý Nợ rủi ro`);
    };
  }

  // "↩️ Khôi phục về trạng thái ban đầu cho khoản vay do nhầm lẫn" — bảng phụ xác nhận thu hồi quyết
  // định Nợ rủi ro, có double-confirm, tự lập Giấy xác nhận thu hồi.
  function renderRiskDebtRestoreModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:520px;">
        <div class="modal-head receipt-head-refund"><h3>Thu hồi quyết định Nợ rủi ro</h3><button class="modal-close preview-allow" id="rdrs-close">✕</button></div>
        <div class="modal-body">
          <p class="sub" style="line-height:1.7;">Nếu xác nhận thu hồi quyết định Nợ rủi ro và khôi phục về trạng thái ban đầu cho khoản vay do nhầm lẫn, hệ thống sẽ lập 1 <b>Giấy xác nhận thu hồi quyết định Nợ rủi ro đối với hộ vay "${escapeHtml(b.name)}" do phê duyệt nhầm</b> và lưu vào kho Giấy xác nhận. Hộ vay sẽ trở về đúng trạng thái ĐANG HOẠT ĐỘNG bình thường như trước khi bị xác nhận Nợ rủi ro (nếu trước đó đã khoá tính lãi tương lai, sẽ được mở lại đầy đủ).</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="rdrs-back">Đóng bảng</button>
          <button class="btn btn-primary preview-allow" id="rdrs-confirm">Xác nhận (thu hồi quyết định nợ rủi ro)</button>
        </div>
      </div>`;
    wrap.querySelector('#rdrs-close').onclick = close;
    wrap.querySelector('#rdrs-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#rdrs-confirm').onclick = async ()=>{
      if(state.previewMode){ alert('Đồng chí đang ở chế độ tham quan, không thể xác nhận thật.'); return; }
      if(!canEditModule('data')){ alert('Đồng chí không có quyền Sửa ở Sổ vay vốn.'); return; }
      if(!confirm(`Đồng chí có CHẮC CHẮN muốn thu hồi quyết định Nợ rủi ro của hộ vay "${b.name}" không?`)) return;
      // Đóng HẾT mọi bảng đang mở (bảng "Lịch sử Nợ rủi ro" phía sau, bảng xác nhận này...), CHỈ
      // CHỪA LẠI đúng modal "⚠️ Thêm, xoá, quản lý Nợ rủi ro" — tránh người dùng lỡ tay bấm tiếp vào
      // các bảng phụ đã hết tác dụng. (Bước 1)
      document.querySelectorAll('.modal-bg').forEach(el=>{ if(!el.dataset.riskdebtModal) el.remove(); });
      showProcessingToast(); // Bước 2
      await restoreBorrowerFromRiskDebt(b);
      await pushLog('xác nhận', `thu hồi quyết định Nợ rủi ro do phê duyệt nhầm đối với hộ vay ${b.name}`);
      await pushConfirmationDocument('riskdebt_revoke', `Giấy xác nhận thu hồi quyết định Nợ rủi ro đối với hộ vay "${b.name}"`,
        `Quyết định Nợ rủi ro đối với hộ vay "${b.name}" đã bị thu hồi do phê duyệt nhầm vào ngày ${fmtDate(todayStr())}. Khoản vay đã được khôi phục về trạng thái đang hoạt động bình thường.`, b);
      refreshOpenRiskDebtModal();
      hideProcessingToast(); // Bước 4
      showBigToast(`Đã thu hồi thành công quyết định Nợ rủi ro của hộ vay ${b.name}`);
    };
  }

  // =====================================================================
  // "Kho lưu trữ các Biên lai, Giấy xác nhận, dòng nhật ký" — khung 3 tab dùng chung. Nội dung cụ
  // thể của từng kho sẽ được thiết kế dần ở các lượt sau (làm từng bước cho chắc).
  // =====================================================================
  // =====================================================================
  // NỘI DUNG "KHO BIÊN LAI" — hiển thị lại đầy đủ 6 danh sách y hệt module Sổ vay vốn (đồng bộ thời
  // gian thực), nhưng LUÔN có thêm cột "Mở Hộp biên lai" đứng đầu tiên (cố định cùng cột Họ và tên),
  // và bộ cột riêng cho từng danh sách theo đúng yêu cầu.
  // =====================================================================
  // Nút "Hộp Biên lai" — xuất hiện ở MỌI dòng của MỌI danh sách trong Kho lưu trữ (kể cả dòng TỔNG,
  // nhưng dòng TỔNG tạm thời khoá vì chưa thiết kế logic).
  function receiptBoxButtonHtml(b, locked, mode){
    const isConf = mode==='confirmations';
    const cls = isConf ? 'ext-blue2' : 'ext-indigo';
    const label = isConf ? 'Hộp giấy xác nhận' : 'Hộp Biên lai';
    const shortLabel = isConf ? 'Hộp GXN' : 'Hộp BL';
    const labelHtml = `<span class="btn-full-label">${label}</span><span class="btn-narrow-label">${shortLabel}</span>`;
    if(locked) return `<button class="ext-action-btn ${cls}" disabled>${labelHtml}</button>`;
    return `<button class="ext-action-btn ${cls} preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-open-receipt-box="${b.id}" data-open-receipt-mode="${mode||'receipts'}">${labelHtml}</button>`;
  }
  // 6 Hạng mục biên lai (gộp từ 13 hạng mục chi tiết) — dùng cho Bộ lọc Hạng mục biên lai.
  const RECEIPT_HANG_MUC_LIST = [
    ['thu_lai','Biên lai Thu lãi'],
    ['tra_lai','Biên lai trả lại tiền lãi'],
    ['tat_toan','Biên lai Tất toán khoản vay'],
    ['tra_no_truoc_han','Biên lai trả nợ trước hạn'],
    ['hoan_tra_tat_toan','Biên lai trả lại tiền "tất toán khoản vay"'],
    ['hoan_tra_no_truoc_han','Biên lai trả lại tiền "trả nợ trước hạn"'],
    ['qua_link','Biên lai Thanh toán qua đường link'],
  ];
  function receiptAllLabels(){
    const payment = (state.receiptCategoriesPayment||[]).map(c=>({...c, kind:'payment'}));
    const refund = (state.receiptCategoriesRefund||[]).map(c=>({...c, kind:'refund'}));
    return payment.concat(refund);
  }
  // "Hộp biên lai của hộ vay ..." — xem lại toàn bộ lịch sử Biên lai (quá khứ -> hiện tại) của 1
  // người vay, có 4 bộ lọc, sắp xếp mới nhất lên đầu.
  function renderReceiptBoxModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();

    if(!state.rcBoxFilterHangMuc) state.rcBoxFilterHangMuc = RECEIPT_HANG_MUC_LIST.map(x=>x[0]); // mặc định TẤT CẢ
    if(state.rcBoxSpecificTime===undefined) state.rcBoxSpecificTime = false; // mặc định "Tất cả thời điểm"
    if(!state.rcBoxFilterPhanLoai) state.rcBoxFilterPhanLoai = receiptAllLabels().map(l=>l.id).concat(['__none__']); // mặc định TẤT CẢ

    function allReceipts(){ return (state.borrowerReceipts && state.borrowerReceipts[b.id]) || []; }
    // Kiểm tra 1 dòng Quý của biên lai (r.quarterLines) có rơi vào đúng khoảng bộ lọc Quý/Năm hiện
    // hành hay không — dùng ĐÚNG cơ chế "selectedQuarterYearRange()" y hệt Panel Danh sách người vay.
    function receiptMatchesQuarterFilter(r){
      if(!state.rcBoxSpecificTime) return true; // "Tất cả thời điểm" -> không lọc gì cả
      const range = selectedQuarterYearRange();
      if(!range.from || !range.to) return true;
      const createdDate = (r.createdAt||'').slice(0,10);
      if(!createdDate) return false;
      // Lọc theo đúng NGÀY LẬP BIÊN LAI (không phải Quý mà biên lai đó thanh toán cho) — vì khi duyệt
      // Hộp biên lai theo thời gian, người dùng mong muốn xem "biên lai nào được lập vào lúc đó",
      // không phải "biên lai đó thanh toán cho Quý nào" (2 khái niệm khác nhau).
      return createdDate < range.to && createdDate >= range.from;
    }
    function filteredReceipts(){
      let list = allReceipts();
      if(state.rcBoxFilterHangMuc.length < RECEIPT_HANG_MUC_LIST.length) list = list.filter(r=> (r.viaPaymentLink && state.rcBoxFilterHangMuc.includes('qua_link')) || state.rcBoxFilterHangMuc.includes(r.groupKey));
      list = list.filter(receiptMatchesQuarterFilter);
      const allLabels = receiptAllLabels();
      if(state.rcBoxFilterPhanLoai.length < allLabels.length+1){
        list = list.filter(r=>{
          if(!['thu_lai','tra_lai'].includes(r.groupKey)) return true;
          return state.rcBoxFilterPhanLoai.includes(r.receiptCategoryId || '__none__');
        });
      }
      return list.slice().sort((a,c)=> (c.createdAt||'').localeCompare(a.createdAt||''));
    }

    function toggleDropdown(kind){ state.openFilterDropdown = state.openFilterDropdown===kind? null : kind; render(); }

    function hangMucDropdownHtml(){
      const allSel = state.rcBoxFilterHangMuc.length===RECEIPT_HANG_MUC_LIST.length;
      return `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="rcb-hangmuc-btn" style="${!allSel?'border:2px solid #b71c1c;':''}">📂 Hạng mục biên lai (${state.rcBoxFilterHangMuc.length})</button>
        ${state.openFilterDropdown==='rcb-hangmuc'? `<div class="sv-filter-panel">
          <label class="sv-filter-item"><input type="checkbox" id="rcb-hangmuc-all" class="preview-allow" ${allSel?'checked':''}><span><b>Tất cả hạng mục biên lai</b></span></label>
          ${RECEIPT_HANG_MUC_LIST.map(([key,label])=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow rcb-hangmuc-item" data-key="${key}" ${state.rcBoxFilterHangMuc.includes(key)?'checked':''}><span>${escapeHtml(label)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
    }
    function phanLoaiDropdownHtml(){
      const allLabels = receiptAllLabels();
      const totalCount = allLabels.length+1;
      const allSel = state.rcBoxFilterPhanLoai.length===totalCount;
      const paymentLabels = allLabels.filter(l=>l.kind==='payment');
      const refundLabels = allLabels.filter(l=>l.kind==='refund');
      const swatch = (color)=> `<span style="display:inline-block; width:24px; height:8px; background:${color||'#fff'}; border:1px solid var(--line); vertical-align:middle; margin-right:4px;"></span>`;
      return `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="rcb-phanloai-btn" style="${!allSel?'border:2px solid #b71c1c;':''}">🏷️ Phân loại biên lai (${state.rcBoxFilterPhanLoai.length})</button>
        ${state.openFilterDropdown==='rcb-phanloai'? `<div class="sv-filter-panel" style="min-width:280px;">
          <label class="sv-filter-item"><input type="checkbox" id="rcb-phanloai-all" class="preview-allow" ${allSel?'checked':''}><span><b>Tất cả tên phân loại</b></span></label>
          ${!allLabels.length? `<p class="sub" style="padding:4px;">Chưa có tên phân loại nào trong bộ nhớ ${subAdminLabelLower()}.</p>` : ''}
          ${paymentLabels.length? `<div class="sub" style="padding:4px 4px 0; color:#1b5e20; font-weight:700;">Thuộc Biên lai Thu lãi</div>` : ''}
          ${paymentLabels.map(l=>`<label class="sv-filter-item" style="color:#1b5e20;">${swatch(l.color)}<input type="checkbox" class="preview-allow rcb-phanloai-item" data-id="${l.id}" ${state.rcBoxFilterPhanLoai.includes(l.id)?'checked':''}><span>${escapeHtml(l.name)}</span></label>`).join('')}
          ${refundLabels.length? `<div class="sub" style="padding:4px 4px 0; color:#b71c1c; font-weight:700;">Thuộc Biên lai trả lại tiền lãi</div>` : ''}
          ${refundLabels.map(l=>`<label class="sv-filter-item" style="color:#b71c1c;">${swatch(l.color)}<input type="checkbox" class="preview-allow rcb-phanloai-item" data-id="${l.id}" ${state.rcBoxFilterPhanLoai.includes(l.id)?'checked':''}><span>${escapeHtml(l.name)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
    }

    function receiptRowHtml(r){
      const sign = r.sign==='-' ? '-' : '+';
      const signColor = sign==='+' ? '#0d47a1' : '#b71c1c';
      const d = new Date(r.createdAt);
      const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      const hasLabel = ['thu_lai','tra_lai'].includes(r.groupKey);
      let labelName = '', labelColor = '#fff';
      if(hasLabel){
        if(r.receiptCategoryId){
          const l = receiptAllLabels().find(x=>x.id===r.receiptCategoryId);
          labelName = l? l.name : '(phân loại đã bị xoá)'; labelColor = l? (l.color||'#fff') : '#fff';
        } else { labelName = 'Không phân loại'; labelColor = '#fff'; }
      }
      return `<div class="preview-allow" data-receipt-view="${r.id}" style="border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:8px; cursor:pointer; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-weight:700;">📋 ${RECEIPT_TITLE_HTML[r.categoryKey]||escapeHtml(r.displayTitle||'')}</span>
          <span style="display:flex; align-items:center; gap:8px; margin-left:auto;">
            ${hasLabel? `<span style="display:flex; align-items:center; gap:6px;"><span class="sub">${escapeHtml(labelName)}</span><span style="display:inline-block; width:30px; height:10px; background:${labelColor}; border:1px solid var(--line);"></span></span>` : ''}
            ${r.viaPaymentLink? `<span style="color:#0d47a1; font-weight:700; white-space:nowrap;">Thanh toán qua đường link</span>` : ''}
          </span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:4px; flex-wrap:wrap; gap:8px;">
          <span style="color:${signColor}; font-weight:800; text-decoration:underline;">${sign} ${moneySpaced(r.amount)} đ</span>
          <span class="sub" style="margin-left:auto;">${dateLbl}</span>
        </div>
      </div>`;
    }

    function render(){
      const list = filteredReceipts();
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1300px;">
          <div class="modal-head" style="background:#311b92;"><h3 style="color:#fff;">Hộp biên lai của hộ vay ${escapeHtml(b.name)}</h3><button class="modal-close preview-allow" id="rcb-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; min-height:60vh; overflow:auto;">
            <div class="toolbar" style="flex-wrap:wrap; gap:8px;">
              ${hangMucDropdownHtml()}
              ${state.rcBoxSpecificTime? buildTimelineFilterDropdownHtml('main') : ''}
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="rcb-specifictime-btn">${state.rcBoxSpecificTime? 'Tất cả thời điểm' : 'Chọn thời điểm cụ thể'}</button>
              ${phanLoaiDropdownHtml()}
              <button class="btn btn-ghost btn-sm preview-allow ${(state.rcBoxFilterHangMuc.length<RECEIPT_HANG_MUC_LIST.length || state.rcBoxSpecificTime || state.rcBoxFilterPhanLoai.length<(receiptAllLabels().length+1))?'reset-filter-active':''}" id="rcb-reset">↺ Khôi phục bộ lọc gốc</button>
            </div>
            <div style="margin-top:14px;">
              ${list.length? list.map(receiptRowHtml).join('') : (allReceipts().length===0
                ? `<p class="sub" style="padding:10px 0;">Hộ vay này chưa từng được lập Biên lai nào cả.</p>`
                : `<p class="sub" style="padding:10px 0;">Không có biên lai nào theo bộ lọc hiện tại.</p>`)}
            </div>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="rcb-close2">Đóng hộp biên lai</button></div>
        </div>`;
      wrap.querySelector('#rcb-close').onclick = close;
      wrap.querySelector('#rcb-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const hb = wrap.querySelector('#rcb-hangmuc-btn'); if(hb) hb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('rcb-hangmuc'); };
      const qb = wrap.querySelector('#f-quarter-btn'); if(qb) qb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('quarter'); };
      const yb = wrap.querySelector('#f-year-btn'); if(yb) yb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('year'); };
      wireTimelineFilterDropdown('main', render, wrap);
      const stb = wrap.querySelector('#rcb-specifictime-btn'); if(stb) stb.onclick=()=>{
        state.rcBoxSpecificTime = !state.rcBoxSpecificTime;
        if(state.rcBoxSpecificTime){ resetTimelineFilter('main'); }
        render();
      };
      const pb = wrap.querySelector('#rcb-phanloai-btn'); if(pb) pb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('rcb-phanloai'); };
      const hAll = wrap.querySelector('#rcb-hangmuc-all'); if(hAll) hAll.onclick=(e)=>{ e.stopPropagation(); state.rcBoxFilterHangMuc = hAll.checked? RECEIPT_HANG_MUC_LIST.map(x=>x[0]) : []; render(); };
      wrap.querySelectorAll('.rcb-hangmuc-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const k=cb.dataset.key; state.rcBoxFilterHangMuc = cb.checked? state.rcBoxFilterHangMuc.concat([k]) : state.rcBoxFilterHangMuc.filter(x=>x!==k); render(); });
      wrap.querySelectorAll('.f-quarter-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleQuarterFilter(cb.dataset.key, cb.checked); render(); });
      wrap.querySelectorAll('.f-year-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleYearFilter(parseInt(cb.dataset.year,10), cb.checked); render(); });
      { const yp = wrap.querySelector('#f-year-panel'); if(yp){ const sel = yp.querySelector('[data-selected-year]'); if(sel) sel.scrollIntoView({block:'center'}); }
        const qp = wrap.querySelector('#f-quarter-panel'); if(qp){ const selQ = qp.querySelector('[data-selected-quarter]'); if(selQ) selQ.scrollIntoView({block:'center'}); } }
      const pAll = wrap.querySelector('#rcb-phanloai-all'); if(pAll) pAll.onclick=(e)=>{ e.stopPropagation(); const allIds = receiptAllLabels().map(l=>l.id).concat(['__none__']); state.rcBoxFilterPhanLoai = pAll.checked? allIds : []; render(); };
      wrap.querySelectorAll('.rcb-phanloai-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const id=cb.dataset.id; state.rcBoxFilterPhanLoai = cb.checked? state.rcBoxFilterPhanLoai.concat([id]) : state.rcBoxFilterPhanLoai.filter(x=>x!==id); render(); });
      const resetBtn = wrap.querySelector('#rcb-reset'); if(resetBtn) resetBtn.onclick=()=>{
        state.rcBoxFilterHangMuc = RECEIPT_HANG_MUC_LIST.map(x=>x[0]);
        state.rcBoxSpecificTime = false; resetTimelineFilter('main');
        state.rcBoxFilterPhanLoai = receiptAllLabels().map(l=>l.id).concat(['__none__']);
        render();
      };
      wrap.querySelectorAll('[data-receipt-view]').forEach(el=>{
        el.onclick = ()=>{
          const r = allReceipts().find(x=>x.id===el.dataset.receiptView);
          if(state.openFilterDropdown){ state.openFilterDropdown = null; render(); }
          if(!r) return;
          if(r.isSharedLink){
            const full = (state.sharedBorrowerReceipts||[]).find(x=>x.id===r.id);
            if(full) renderSharedReceiptDetailModal(full);
          } else {
            renderReceiptDetailModal(b, r);
          }
        };
      });
      if(!wrap._outsideClickBound){
        wrap._outsideClickBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
          if(e.target.closest('.sv-filter-dropdown')) return; // click bên trong khu vực bộ lọc (kể cả nhãn/checkbox) -> KHÔNG đóng
          state.openFilterDropdown = null;
          if(document.body.contains(wrap)) render();
        });
      }
    }
    render();
  }
  // Xem lại 1 biên lai cụ thể (chiếu lại lịch sử — chỉ xem, không sửa được gì).
  // 12 loại Giấy xác nhận hiện có trong module Sổ vay vốn — dùng cho Bộ lọc "Loại giấy xác nhận".
  const CONFIRMATION_KIND_LIST = [
    ['borrower_create','Tạo khoản vay thành công'],
    ['borrower_edit','Sửa thông tin hộ vay'],
    ['project_edit','Sửa thông tin hộ vay do thay đổi Phương án vay'],
    ['borrower_delete','Xoá hộ vay'],
    ['borrower_purge','Xoá vĩnh viễn hộ vay khỏi Thùng rác'],
    ['project_delete','Xoá hộ vay do xoá cả Phương án vay'],
    ['riskdebt_confirm','Là Nợ rủi ro'],
    ['bad_debt','Không có khả năng trả nợ'],
    ['bad_debt_revoke','Khôi phục trạng thái (từ Nợ xấu)'],
    ['riskdebt_revoke','Thu hồi quyết định Nợ rủi ro'],
    ['extension_confirm','Gia hạn lần N'],
    ['extension_revoke','Thu hồi quyết định Gia hạn lần N'],
    ['quarter_config_change','Thay đổi mốc thời gian hàng quý'],
    ['project_edit_bulk','GXN Chung: Sửa thông tin do thay đổi Phương án vay'],
    ['project_delete_bulk','GXN Chung: Xoá các hộ vay do xoá cả Phương án vay'],
    ['quarter_config_change_bulk','GXN Chung: Thay đổi mốc thời gian hàng quý'],
  ];
  const CONFIRMATION_KIND_LABEL = {}; CONFIRMATION_KIND_LIST.forEach(([k,l])=> CONFIRMATION_KIND_LABEL[k]=l);
  // Màu chữ tên Giấy xác nhận theo từng nhóm loại — dùng cho cả dòng tên trong danh sách lẫn tiêu đề
  // khi mở xem chi tiết.
  const CONFIRMATION_KIND_COLOR = {
    borrower_create:'#000000',
    borrower_edit:'#1b5e20', project_edit:'#1b5e20', project_edit_bulk:'#1b5e20',
    bad_debt_revoke:'#1565c0', riskdebt_revoke:'#1565c0', extension_revoke:'#1565c0',
    borrower_delete:'#c62828', project_delete:'#c62828', borrower_purge:'#c62828', project_delete_bulk:'#c62828',
    riskdebt_confirm:'#e65100', bad_debt:'#e65100', extension_confirm:'#e65100',
    quarter_config_change:'#4a148c', quarter_config_change_bulk:'#4a148c',
  };
  // "Hộp giấy xác nhận của hộ vay ..." — mô phỏng ĐÚNG Hộp biên lai, chỉ khác: bộ lọc Hạng mục biên
  // lai -> Bộ lọc Loại giấy xác nhận, và KHÔNG có bộ lọc Phân loại (không hợp với Giấy xác nhận).
  function renderConfirmationBoxModal(b){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();

    if(!state.cfBoxFilterKind) state.cfBoxFilterKind = CONFIRMATION_KIND_LIST.map(x=>x[0]); // mặc định TẤT CẢ
    if(state.cfBoxSpecificTime===undefined) state.cfBoxSpecificTime = false; // mặc định "Tất cả thời điểm"

    function allConfirmations(){ return (state.borrowerConfirmations && state.borrowerConfirmations[b.id]) || []; }
    function confMatchesQuarterFilter(c){
      if(!state.cfBoxSpecificTime) return true;
      const range = selectedQuarterYearRange();
      if(!range.from || !range.to) return true;
      const createdDate = (c.createdAt||'').slice(0,10);
      if(!createdDate) return false;
      return createdDate < range.to && createdDate >= range.from;
    }
    function filteredConfirmations(){
      let list = allConfirmations();
      if(state.cfBoxFilterKind.length < CONFIRMATION_KIND_LIST.length) list = list.filter(c=> state.cfBoxFilterKind.includes(c.kind));
      list = list.filter(confMatchesQuarterFilter);
      return list.slice().sort((a,c)=> (c.createdAt||'').localeCompare(a.createdAt||''));
    }
    function toggleDropdown(kind){ state.openFilterDropdown = state.openFilterDropdown===kind? null : kind; render(); }
    function kindDropdownHtml(){
      const allSel = state.cfBoxFilterKind.length===CONFIRMATION_KIND_LIST.length;
      return `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="cfb-kind-btn" style="${!allSel?'border:2px solid #b71c1c;':''}">📂 Loại giấy xác nhận (${state.cfBoxFilterKind.length})</button>
        ${state.openFilterDropdown==='cfb-kind'? `<div class="sv-filter-panel" style="min-width:300px;">
          <label class="sv-filter-item"><input type="checkbox" id="cfb-kind-all" class="preview-allow" ${allSel?'checked':''}><span><b>Tất cả loại giấy xác nhận</b></span></label>
          ${CONFIRMATION_KIND_LIST.map(([key,label])=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow cfb-kind-item" data-key="${key}" ${state.cfBoxFilterKind.includes(key)?'checked':''}><span>${escapeHtml(label)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
    }
    function confRowHtml(c){
      const d = new Date(c.createdAt);
      const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      const kindColor = CONFIRMATION_KIND_COLOR[c.kind] || '#000000';
      return `<div class="preview-allow" data-conf-view="${c.id}" style="border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:8px; cursor:pointer; background:#fff;">
        <div style="font-weight:700; color:${kindColor};">📝 GXN ${escapeHtml((c.title||'').replace(/^Giấy xác nhận\s*/i,''))}</div>
        <div class="sub" style="margin-top:4px; text-align:right;">${dateLbl}</div>
      </div>`;
    }
    function render(){
      const list = filteredConfirmations();
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1300px;">
          <div class="modal-head" style="background:#1565c0;"><h3 style="color:#fff;">Hộp giấy xác nhận của hộ vay ${escapeHtml(b.name)}</h3><button class="modal-close preview-allow" id="cfb-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; min-height:60vh; overflow:auto;">
            <div class="toolbar" style="flex-wrap:wrap; gap:8px;">
              ${kindDropdownHtml()}
              ${state.cfBoxSpecificTime? buildTimelineFilterDropdownHtml('main') : ''}
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="cfb-specifictime-btn">${state.cfBoxSpecificTime? 'Tất cả thời điểm' : 'Chọn thời điểm cụ thể'}</button>
              <button class="btn btn-ghost btn-sm preview-allow ${(state.cfBoxFilterKind.length<CONFIRMATION_KIND_LIST.length || state.cfBoxSpecificTime)?'reset-filter-active':''}" id="cfb-reset">↺ Khôi phục bộ lọc gốc</button>
            </div>
            <div style="margin-top:14px;">
              ${list.length? list.map(confRowHtml).join('') : (allConfirmations().length===0
                ? `<p class="sub" style="padding:10px 0;">Hộ vay này chưa từng được lập Giấy xác nhận nào cả.</p>`
                : `<p class="sub" style="padding:10px 0;">Không có giấy xác nhận nào theo bộ lọc hiện tại.</p>`)}
            </div>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="cfb-close2">Đóng hộp giấy xác nhận</button></div>
        </div>`;
      wrap.querySelector('#cfb-close').onclick = close;
      wrap.querySelector('#cfb-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const kb = wrap.querySelector('#cfb-kind-btn'); if(kb) kb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('cfb-kind'); };
      const qb = wrap.querySelector('#f-quarter-btn'); if(qb) qb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('quarter'); };
      const yb = wrap.querySelector('#f-year-btn'); if(yb) yb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('year'); };
      wireTimelineFilterDropdown('main', render, wrap);
      const stb = wrap.querySelector('#cfb-specifictime-btn'); if(stb) stb.onclick=()=>{
        state.cfBoxSpecificTime = !state.cfBoxSpecificTime;
        if(state.cfBoxSpecificTime){ resetTimelineFilter('main'); }
        render();
      };
      const kAll = wrap.querySelector('#cfb-kind-all'); if(kAll) kAll.onclick=(e)=>{ e.stopPropagation(); state.cfBoxFilterKind = kAll.checked? CONFIRMATION_KIND_LIST.map(x=>x[0]) : []; render(); };
      wrap.querySelectorAll('.cfb-kind-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const k=cb.dataset.key; state.cfBoxFilterKind = cb.checked? state.cfBoxFilterKind.concat([k]) : state.cfBoxFilterKind.filter(x=>x!==k); render(); });
      wrap.querySelectorAll('.f-quarter-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleQuarterFilter(cb.dataset.key, cb.checked); render(); });
      wrap.querySelectorAll('.f-year-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleYearFilter(parseInt(cb.dataset.year,10), cb.checked); render(); });
      { const yp = wrap.querySelector('#f-year-panel'); if(yp){ const sel = yp.querySelector('[data-selected-year]'); if(sel) sel.scrollIntoView({block:'center'}); }
        const qp = wrap.querySelector('#f-quarter-panel'); if(qp){ const selQ = qp.querySelector('[data-selected-quarter]'); if(selQ) selQ.scrollIntoView({block:'center'}); } }
      const resetBtn = wrap.querySelector('#cfb-reset'); if(resetBtn) resetBtn.onclick=()=>{
        state.cfBoxFilterKind = CONFIRMATION_KIND_LIST.map(x=>x[0]);
        state.cfBoxSpecificTime = false; resetTimelineFilter('main');
        render();
      };
      wrap.querySelectorAll('[data-conf-view]').forEach(el=>{
        el.onclick = ()=>{
          const c = allConfirmations().find(x=>x.id===el.dataset.confView);
          if(state.openFilterDropdown){ state.openFilterDropdown = null; render(); }
          if(!c) return;
          if(c.isSharedLink){
            const full = (state.sharedConfirmationDocuments||[]).find(x=>x.id===c.id);
            if(full) renderConfirmationDetailModal(full);
          } else {
            renderConfirmationDetailModal(c);
          }
        };
      });
      if(!wrap._outsideClickBound){
        wrap._outsideClickBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
          if(e.target.closest('.sv-filter-dropdown')) return;
          state.openFilterDropdown = null;
          if(document.body.contains(wrap)) render();
        });
      }
    }
    render();
  }
  // Chỉ đúng 3 loại Giấy xác nhận CHUNG hiện có, dùng riêng cho bộ lọc của "Hộp giấy xác nhận dùng
  // Chung" (không lẫn với 13 loại của Hộp giấy xác nhận từng người).
  const SHARED_CONFIRMATION_KIND_LIST = [
    ['project_edit_bulk','GXN Chung: Sửa thông tin do thay đổi Phương án vay'],
    ['project_delete_bulk','GXN Chung: Xoá các hộ vay do xoá cả Phương án vay'],
    ['quarter_config_change_bulk','GXN Chung: Thay đổi mốc thời gian hàng quý'],
  ];
  // "Hộp giấy xác nhận dùng Chung" — chứa các Giấy xác nhận được lập CHUNG cho nhiều người trong
  // cùng 1 phương án vay hoặc tất cả mọi người trong Sổ vay vốn. Mô phỏng ĐÚNG cấu trúc Hộp giấy xác
  // nhận từng người, chỉ khác nguồn dữ liệu và danh sách loại lọc (chỉ còn 3 loại).
  function renderSharedConfirmationBoxModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();

    if(!state.scfBoxFilterKind) state.scfBoxFilterKind = SHARED_CONFIRMATION_KIND_LIST.map(x=>x[0]);
    if(state.scfBoxSpecificTime===undefined) state.scfBoxSpecificTime = false;

    function allShared(){ return state.sharedConfirmationDocuments||[]; }
    function matchesQuarterFilter(c){
      if(!state.scfBoxSpecificTime) return true;
      const range = selectedQuarterYearRange();
      if(!range.from || !range.to) return true;
      const createdDate = (c.createdAt||'').slice(0,10);
      if(!createdDate) return false;
      return createdDate < range.to && createdDate >= range.from;
    }
    function filteredShared(){
      let list = allShared();
      if(state.scfBoxFilterKind.length < SHARED_CONFIRMATION_KIND_LIST.length) list = list.filter(c=> state.scfBoxFilterKind.includes(c.kind));
      list = list.filter(matchesQuarterFilter);
      return list.slice().sort((a,c)=> (c.createdAt||'').localeCompare(a.createdAt||''));
    }
    function toggleDropdown(kind){ state.openFilterDropdown = state.openFilterDropdown===kind? null : kind; render(); }
    function kindDropdownHtml(){
      const allSel = state.scfBoxFilterKind.length===SHARED_CONFIRMATION_KIND_LIST.length;
      return `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="scfb-kind-btn" style="${!allSel?'border:2px solid #b71c1c;':''}">📂 Loại giấy xác nhận (${state.scfBoxFilterKind.length})</button>
        ${state.openFilterDropdown==='scfb-kind'? `<div class="sv-filter-panel" style="min-width:320px;">
          <label class="sv-filter-item"><input type="checkbox" id="scfb-kind-all" class="preview-allow" ${allSel?'checked':''}><span><b>Tất cả loại giấy xác nhận</b></span></label>
          ${SHARED_CONFIRMATION_KIND_LIST.map(([key,label])=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow scfb-kind-item" data-key="${key}" ${state.scfBoxFilterKind.includes(key)?'checked':''}><span>${escapeHtml(label)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
    }
    function rowHtml(c){
      const d = new Date(c.createdAt);
      const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      const kindColor = CONFIRMATION_KIND_COLOR[c.kind] || '#000000';
      return `<div class="preview-allow" data-shared-conf-view="${c.id}" style="border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:8px; cursor:pointer; background:#fff;">
        <div style="font-weight:700; color:${kindColor};">📝 ${escapeHtml((c.title||'').replace(/^GXN Chung:\s*/i,'GXN Chung: '))}</div>
        <div class="sub" style="margin-top:4px; text-align:right;">${dateLbl}</div>
      </div>`;
    }
    function render(){
      const list = filteredShared();
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1300px;">
          <div class="modal-head" style="background:#1565c0;"><h3 style="color:#fff;">Hộp giấy xác nhận dùng Chung</h3><button class="modal-close preview-allow" id="scfb-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; min-height:60vh; overflow:auto;">
            <p class="sub" style="margin:0 0 14px;">Đây là nơi chứa các giấy xác nhận được lập Chung cho nhiều người trong cùng một phương án vay hoặc tất cả mọi người trong sổ vay vốn.</p>
            <div class="toolbar" style="flex-wrap:wrap; gap:8px;">
              ${kindDropdownHtml()}
              ${state.scfBoxSpecificTime? buildTimelineFilterDropdownHtml('main') : ''}
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="scfb-specifictime-btn">${state.scfBoxSpecificTime? 'Tất cả thời điểm' : 'Chọn thời điểm cụ thể'}</button>
              <button class="btn btn-ghost btn-sm preview-allow ${(state.scfBoxFilterKind.length<SHARED_CONFIRMATION_KIND_LIST.length || state.scfBoxSpecificTime)?'reset-filter-active':''}" id="scfb-reset">↺ Khôi phục bộ lọc gốc</button>
            </div>
            <div style="margin-top:14px;">
              ${list.length? list.map(rowHtml).join('') : (allShared().length===0
                ? `<p class="sub" style="padding:10px 0;">Chưa từng có Giấy xác nhận chung nào được lập cả.</p>`
                : `<p class="sub" style="padding:10px 0;">Không có giấy xác nhận nào theo bộ lọc hiện tại.</p>`)}
            </div>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="scfb-close2">Đóng bảng</button></div>
        </div>`;
      wrap.querySelector('#scfb-close').onclick = close;
      wrap.querySelector('#scfb-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const kb = wrap.querySelector('#scfb-kind-btn'); if(kb) kb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('scfb-kind'); };
      const qb = wrap.querySelector('#f-quarter-btn'); if(qb) qb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('quarter'); };
      const yb = wrap.querySelector('#f-year-btn'); if(yb) yb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('year'); };
      wireTimelineFilterDropdown('main', render, wrap);
      const stb = wrap.querySelector('#scfb-specifictime-btn'); if(stb) stb.onclick=()=>{
        state.scfBoxSpecificTime = !state.scfBoxSpecificTime;
        if(state.scfBoxSpecificTime){ resetTimelineFilter('main'); }
        render();
      };
      const kAll = wrap.querySelector('#scfb-kind-all'); if(kAll) kAll.onclick=(e)=>{ e.stopPropagation(); state.scfBoxFilterKind = kAll.checked? SHARED_CONFIRMATION_KIND_LIST.map(x=>x[0]) : []; render(); };
      wrap.querySelectorAll('.scfb-kind-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const k=cb.dataset.key; state.scfBoxFilterKind = cb.checked? state.scfBoxFilterKind.concat([k]) : state.scfBoxFilterKind.filter(x=>x!==k); render(); });
      wrap.querySelectorAll('.f-quarter-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleQuarterFilter(cb.dataset.key, cb.checked); render(); });
      wrap.querySelectorAll('.f-year-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleYearFilter(parseInt(cb.dataset.year,10), cb.checked); render(); });
      { const yp = wrap.querySelector('#f-year-panel'); if(yp){ const sel = yp.querySelector('[data-selected-year]'); if(sel) sel.scrollIntoView({block:'center'}); }
        const qp = wrap.querySelector('#f-quarter-panel'); if(qp){ const selQ = qp.querySelector('[data-selected-quarter]'); if(selQ) selQ.scrollIntoView({block:'center'}); } }
      const resetBtn = wrap.querySelector('#scfb-reset'); if(resetBtn) resetBtn.onclick=()=>{
        state.scfBoxFilterKind = SHARED_CONFIRMATION_KIND_LIST.map(x=>x[0]);
        state.scfBoxSpecificTime = false; resetTimelineFilter('main');
        render();
      };
      wrap.querySelectorAll('[data-shared-conf-view]').forEach(el=>{
        el.onclick = ()=>{
          const c = allShared().find(x=>x.id===el.dataset.sharedConfView);
          if(state.openFilterDropdown){ state.openFilterDropdown = null; render(); }
          if(c) renderConfirmationDetailModal(c);
        };
      });
      if(!wrap._outsideClickBound){
        wrap._outsideClickBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
          if(e.target.closest('.sv-filter-dropdown')) return;
          state.openFilterDropdown = null;
          if(document.body.contains(wrap)) render();
        });
      }
    }
    render();
  }
  const SHARED_RECEIPT_HANG_MUC_LIST = [
    ['shared_final_settlement','BL chung: Tất toán khoản vay cho các hộ trong phương án vay'],
    ['shared_interest_payment','BL chung: Đóng tiền lãi cho các hộ trong phương án vay'],
    ['qua_link','Biên lai Thanh toán qua đường link'],
  ];
  // Tô màu tiêu đề Biên lai chung — dùng ĐÚNG bảng màu RC đã quy định cho Biên lai cá nhân, để đồng
  // bộ tuyệt đối (không tự bịa màu mới).
  function styleSharedReceiptTitle(title){
    return escapeHtml(title||'')
      .replace(/(Tất toán)/, `<span style="color:${RC.verbGreen};">$1</span>`)
      .replace(/(Trả nợ)/, `<span style="color:${RC.verbGreen};">$1</span>`)
      .replace(/(Đóng tiền lãi)/, `<span style="color:${RC.verbGreen};">$1</span>`);
  }
  // "Hộp Biên lai dùng Chung" — chứa các Biên lai được lập CHUNG cho nhiều người trong cùng 1 phương
  // án vay. Mô phỏng ĐÚNG cấu trúc Hộp Biên lai từng người, chỉ khác nguồn dữ liệu và danh sách hạng
  // mục lọc (chỉ còn 2 loại) — bộ lọc Phân loại chỉ áp dụng cho "BL chung: Đóng tiền lãi".
  // Dựng HTML 1 "thẻ" biên lai chưa thanh toán (3 dòng: tiêu đề+số tiền, thời gian, tên người vay) —
  // dùng chung cho cả "Hộp biên lai chưa thanh toán" lẫn modal "Đường link" (xem lại y hệt, không bấm
  // được nếu `clickable=false`).
  function unpaidReceiptRowHtml(r, clickable){
    const d = new Date(r.createdAt);
    const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    return `<div class="${clickable?'preview-allow':''}" ${clickable?`data-unpaid-view="${r.code}"`:''} style="border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:8px; ${clickable?'cursor:pointer;':''} background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="font-weight:700;">📋 ${escapeHtml(r.title||'')}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:4px; flex-wrap:wrap; gap:8px;">
        <span style="color:#e65100; font-weight:800; text-decoration:underline;">${moneySpaced(r.amount)} đ</span>
        <span class="sub" style="margin-left:auto;">${dateLbl}</span>
      </div>
      ${(r.borrowerNames&&r.borrowerNames.length)? `<div style="color:#b71c1c; font-weight:700; text-align:center; margin-top:6px;">${r.borrowerNames.map(n=>escapeHtml(n)).join(', ')}</div>` : ''}
    </div>`;
  }
  function renderUnpaidReceiptBoxModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    let list = null;
    let searchTerm = '';
    function rowHtml(r){ return unpaidReceiptRowHtml(r, true); }
    function render(){
      const filteredList = (list||[]).filter(r=>{
        const term = searchTerm.trim().toLowerCase();
        if(!term) return true;
        return (r.borrowerNames||[]).some(n=> (n||'').toLowerCase().includes(term));
      });
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1000px;">
          <div class="modal-head" style="background:#e65100;"><h3 style="color:#fff;">Hộp biên lai chưa thanh toán</h3><button class="modal-close preview-allow" id="upb-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; min-height:60vh; overflow:auto;">
            <p class="sub" style="margin-top:0;">Các Biên lai chưa thanh toán sẽ tự mất sau 7 ngày nếu chưa được thanh toán</p>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
              <input id="upb-search" class="preview-allow" placeholder="🔎 Tìm theo tên..." value="${escapeHtml(searchTerm)}" style="min-width:200px; flex:1;${(searchTerm!=='' && searchTerm!==' ')? "border:2px solid #b71c1c;" : ""}">
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="upb-search-reset">Khôi phục lại ban đầu</button>
            </div>
            ${list===null? `<p class="sub" style="text-align:center; padding:20px;">Đang tải…</p>`
              : filteredList.length? filteredList.map(rowHtml).join('') : `<p class="sub" style="text-align:center; padding:20px;">${list.length? 'Không tìm thấy Biên lai nào khớp với tên đã nhập.' : 'Chưa có Biên lai chưa thanh toán nào.'}</p>`}
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="upb-close2">Đóng bảng</button></div>
        </div>`;
      wrap.querySelector('#upb-close').onclick = close;
      wrap.querySelector('#upb-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      wrap.querySelector('#upb-search').oninput = (e)=>{ searchTerm = e.target.value; rerenderKeepingFocus(render); };
      wrap.querySelector('#upb-search-reset').onclick = ()=>{ searchTerm = ''; render(); };
      wrap.querySelectorAll('[data-unpaid-view]').forEach(el=> el.onclick = ()=>{
        const code = el.dataset.unpaidView;
        renderUnpaidReceiptLinkModal(code, {
          showDelete: true,
          onDeleted: ()=>{ list = (list||[]).filter(r=>r.code!==code); render(); },
        });
      });
    }
    render();
    (async ()=>{
      try{
        // KHÔNG dùng orderByChild('wardId').equalTo(...) nữa — truy vấn kiểu này CẦN khai báo chỉ mục
        // (.indexOn) ở Firebase Rules mới chắc chắn hoạt động đúng, nếu thiếu có thể trả về rỗng một
        // cách âm thầm. Tải TOÀN BỘ node "receipts" rồi tự lọc phía trình duyệt cho chắc chắn.
        const snap = await rtdb.ref('receipts').get();
        const val = (snap && snap.exists()) ? snap.val() : {};
        const myWardId = wardId();
        const allUnpaidOfWard = Object.entries(val)
          .filter(([,r])=> r.status==='unpaid' && r.wardId===myWardId)
          .map(([code,r])=>({ ...r, code }));
        // Ngay khi mở Hộp này -> tiện thể "kích hoạt" luôn việc dọn dẹp các Biên lai chưa thanh toán
        // đã quá hạn 7 ngày (dù trước đó chưa có ai mở lại để tự xoá) — xoá thật khỏi đám mây, không
        // hiện ra trong danh sách nữa.
        const expired = allUnpaidOfWard.filter(r=> (Date.now() - new Date(r.createdAt).getTime()) >= UNPAID_RECEIPT_LIFETIME_MS);
        if(expired.length){
          Promise.all(expired.map(r=> rtdb.ref('receipts/'+r.code).remove().catch(e=>console.error('Không tự xoá được Biên lai quá hạn:', r.code, e))));
        }
        list = allUnpaidOfWard.filter(r=> (Date.now() - new Date(r.createdAt).getTime()) < UNPAID_RECEIPT_LIFETIME_MS)
          .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
      }catch(e){ console.error('Không tải được Hộp biên lai chưa thanh toán:', e); list = []; }
      render();
    })();
  }
  function renderSharedReceiptBoxModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    if(!state.srBoxFilterHangMuc) state.srBoxFilterHangMuc = SHARED_RECEIPT_HANG_MUC_LIST.map(x=>x[0]);
    if(state.srBoxSpecificTime===undefined) state.srBoxSpecificTime = false;
    function allShared(){ return state.sharedBorrowerReceipts||[]; }
    function matchesQuarterFilter(r){
      if(!state.srBoxSpecificTime) return true;
      const range = selectedQuarterYearRange();
      if(!range.from || !range.to) return true;
      const createdDate = (r.createdAt||'').slice(0,10);
      if(!createdDate) return false;
      return createdDate < range.to && createdDate >= range.from;
    }
    function filteredShared(){
      let list = allShared();
      if(state.srBoxFilterHangMuc.length < SHARED_RECEIPT_HANG_MUC_LIST.length) list = list.filter(r=> (r.viaPaymentLink && state.srBoxFilterHangMuc.includes('qua_link')) || state.srBoxFilterHangMuc.includes(r.kind));
      list = list.filter(matchesQuarterFilter);
      return list.slice().sort((a,c)=> (c.createdAt||'').localeCompare(a.createdAt||''));
    }
    function toggleDropdown(kind){ state.openFilterDropdown = state.openFilterDropdown===kind? null : kind; render(); }
    function kindDropdownHtml(){
      const allSel = state.srBoxFilterHangMuc.length===SHARED_RECEIPT_HANG_MUC_LIST.length;
      return `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="srb-kind-btn" style="${!allSel?'border:2px solid #b71c1c;':''}">📂 Hạng mục biên lai (${state.srBoxFilterHangMuc.length})</button>
        ${state.openFilterDropdown==='srb-kind'? `<div class="sv-filter-panel" style="min-width:320px;">
          <label class="sv-filter-item"><input type="checkbox" id="srb-kind-all" class="preview-allow" ${allSel?'checked':''}><span><b>Tất cả hạng mục biên lai</b></span></label>
          ${SHARED_RECEIPT_HANG_MUC_LIST.map(([key,label])=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow srb-kind-item" data-key="${key}" ${state.srBoxFilterHangMuc.includes(key)?'checked':''}><span>${escapeHtml(label)}</span></label>`).join('')}
        </div>` : ''}
      </div>`;
    }
    function rowHtml(r){
      const sign = r.sign==='-' ? '-' : '+';
      const signColor = sign==='+' ? '#0d47a1' : '#b71c1c';
      const d = new Date(r.createdAt);
      const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      const hasLabel = r.kind==='shared_interest_payment';
      let labelName = '', labelColor = '#fff';
      if(hasLabel){
        if(r.receiptCategoryId){ const l = receiptAllLabels().find(x=>x.id===r.receiptCategoryId); labelName = l? l.name : '(phân loại đã bị xoá)'; labelColor = l? (l.color||'#fff') : '#fff'; }
        else { labelName = 'Không phân loại'; labelColor = '#fff'; }
      }
      return `<div class="preview-allow" data-shared-receipt-view="${r.id}" style="border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:8px; cursor:pointer; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-weight:700;">📋 ${styleSharedReceiptTitle(r.title)}</span>
          <span style="display:flex; align-items:center; gap:8px; margin-left:auto;">
            ${hasLabel? `<span style="display:flex; align-items:center; gap:6px;"><span class="sub">${escapeHtml(labelName)}</span><span style="display:inline-block; width:30px; height:10px; background:${labelColor}; border:1px solid var(--line);"></span></span>` : ''}
            ${r.viaPaymentLink? `<span style="color:#0d47a1; font-weight:700; white-space:nowrap;">Thanh toán qua đường link</span>` : ''}
          </span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:4px; flex-wrap:wrap; gap:8px;">
          <span style="color:${signColor}; font-weight:800; text-decoration:underline;">${sign} ${moneySpaced(r.amount)} đ</span>
          <span class="sub" style="margin-left:auto;">${dateLbl}</span>
        </div>
      </div>`;
    }
    function render(){
      const list = filteredShared();
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:1300px;">
          <div class="modal-head" style="background:#311b92;"><h3 style="color:#fff;">Hộp Biên lai dùng Chung</h3><button class="modal-close preview-allow" id="srb-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; min-height:60vh; overflow:auto;">
            <p class="sub" style="margin:0 0 14px;">Đây là nơi chứa các biên lai được lập Chung cho nhiều người trong cùng một phương án vay.</p>
            <div class="toolbar" style="flex-wrap:wrap; gap:8px;">
              ${kindDropdownHtml()}
              ${state.srBoxSpecificTime? buildTimelineFilterDropdownHtml('main') : ''}
              <button type="button" class="btn btn-ghost btn-sm preview-allow" id="srb-specifictime-btn">${state.srBoxSpecificTime? 'Tất cả thời điểm' : 'Chọn thời điểm cụ thể'}</button>
              <button class="btn btn-ghost btn-sm preview-allow ${(state.srBoxFilterHangMuc.length<SHARED_RECEIPT_HANG_MUC_LIST.length || state.srBoxSpecificTime)?'reset-filter-active':''}" id="srb-reset">↺ Khôi phục bộ lọc gốc</button>
            </div>
            <div style="margin-top:14px;">
              ${list.length? list.map(rowHtml).join('') : (allShared().length===0
                ? `<p class="sub" style="padding:10px 0;">Chưa từng có Biên lai chung nào được lập cả.</p>`
                : `<p class="sub" style="padding:10px 0;">Không có biên lai nào theo bộ lọc hiện tại.</p>`)}
            </div>
          </div>
          <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="srb-close2">Đóng bảng</button></div>
        </div>`;
      wrap.querySelector('#srb-close').onclick = close;
      wrap.querySelector('#srb-close2').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      const kb = wrap.querySelector('#srb-kind-btn'); if(kb) kb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('srb-kind'); };
      const qb = wrap.querySelector('#f-quarter-btn'); if(qb) qb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('quarter'); };
      const yb = wrap.querySelector('#f-year-btn'); if(yb) yb.onclick=(e)=>{ e.stopPropagation(); toggleDropdown('year'); };
      wireTimelineFilterDropdown('main', render, wrap);
      const stb = wrap.querySelector('#srb-specifictime-btn'); if(stb) stb.onclick=()=>{
        state.srBoxSpecificTime = !state.srBoxSpecificTime;
        if(state.srBoxSpecificTime){ resetTimelineFilter('main'); }
        render();
      };
      const kAll = wrap.querySelector('#srb-kind-all'); if(kAll) kAll.onclick=(e)=>{ e.stopPropagation(); state.srBoxFilterHangMuc = kAll.checked? SHARED_RECEIPT_HANG_MUC_LIST.map(x=>x[0]) : []; render(); };
      wrap.querySelectorAll('.srb-kind-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const k=cb.dataset.key; state.srBoxFilterHangMuc = cb.checked? state.srBoxFilterHangMuc.concat([k]) : state.srBoxFilterHangMuc.filter(x=>x!==k); render(); });
      wrap.querySelectorAll('.f-quarter-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleQuarterFilter(cb.dataset.key, cb.checked); render(); });
      wrap.querySelectorAll('.f-year-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); toggleYearFilter(parseInt(cb.dataset.year,10), cb.checked); render(); });
      { const yp = wrap.querySelector('#f-year-panel'); if(yp){ const sel = yp.querySelector('[data-selected-year]'); if(sel) sel.scrollIntoView({block:'center'}); }
        const qp = wrap.querySelector('#f-quarter-panel'); if(qp){ const selQ = qp.querySelector('[data-selected-quarter]'); if(selQ) selQ.scrollIntoView({block:'center'}); } }
      const resetBtn = wrap.querySelector('#srb-reset'); if(resetBtn) resetBtn.onclick=()=>{
        state.srBoxFilterHangMuc = SHARED_RECEIPT_HANG_MUC_LIST.map(x=>x[0]);
        state.srBoxSpecificTime = false; resetTimelineFilter('main');
        render();
      };
      wrap.querySelectorAll('[data-shared-receipt-view]').forEach(el=>{
        el.onclick = ()=>{
          const r = allShared().find(x=>x.id===el.dataset.sharedReceiptView);
          if(state.openFilterDropdown){ state.openFilterDropdown = null; render(); }
          if(r) renderSharedReceiptDetailModal(r);
        };
      });
      if(!wrap._outsideClickBound){
        wrap._outsideClickBound = true;
        document.addEventListener('click', (e)=>{
          if(!document.body.contains(wrap) || !state.openFilterDropdown) return;
          if(e.target.closest('.sv-filter-dropdown')) return;
          state.openFilterDropdown = null;
          if(document.body.contains(wrap)) render();
        });
      }
    }
    render();
  }
  // Xem chi tiết 1 Giấy xác nhận — tiêu đề đầy đủ "Giấy xác nhận..." (không viết tắt GXN).
  const LOG_FILTER_KIND_LIST = [
    ['bienlai_cong','Biên lai cộng tiền'],
    ['bienlai_tru','Biên lai trừ tiền'],
    ['bienlai_chung','Biên lai chung'],
    ['bienlai_rieng','Biên lai riêng'],
    ['bienlai_qua_link','Biên lai Thanh toán qua đường link'],
    ['gxn_chung','Giấy xác nhận chung'],
    ['gxn_rieng','Giấy xác nhận riêng'],
    ['ten_phan_loai','Tên phân loại biên lai'],
    ['bo_xem_cot','Bộ xem cột'],
    ['bo_mau','Bộ màu'],
  ];
  // Hợp nhất TOÀN BỘ Biên lai (riêng + chung) và Giấy xác nhận (riêng + chung) thành 1 dòng thời gian
  // duy nhất — dùng cho Kho dòng nhật ký. CHỈ ĐỌC dữ liệu sẵn có, không tạo thêm bản ghi nào mới.
  function buildActivityLogEntries(){
    const entries = [];
    Object.keys(state.borrowerReceipts||{}).forEach(bid=>{
      (state.borrowerReceipts[bid]||[]).forEach(r=>{
        if(r.isSharedLink) return;
        const b = state.borrowers.find(x=>x.id===bid);
        entries.push({
          type:'receipt', scope:'rieng', sign: r.sign==='-'?'-':'+', viaPaymentLink: !!r.viaPaymentLink,
          titleHtml: `📋 ${RECEIPT_TITLE_HTML[r.categoryKey]||escapeHtml(r.displayTitle||'')}`,
          affectedNames: b? [b.name] : [r.borrowerName||'(hộ vay đã bị xoá)'],
          createdAt: r.createdAt, createdByName: r.createdByName, createdBy: r.createdBy, createdByIp: r.createdByIp, createdByDevice: r.createdByDevice,
          openFn: ()=>{ if(b) renderReceiptDetailModal(b, r); },
        });
      });
    });
    (state.sharedBorrowerReceipts||[]).forEach(r=>{
      entries.push({
        type:'receipt', scope:'chung', sign: r.sign==='-'?'-':'+', viaPaymentLink: !!r.viaPaymentLink,
        titleHtml: `📋 ${styleSharedReceiptTitle(r.title)}`,
        affectedNames: (r.affectedBorrowerIds||[]).map(id=>{ const b=state.borrowers.find(x=>x.id===id); return b? b.name : id; }),
        createdAt: r.createdAt, createdByName: r.createdByName, createdBy: r.createdBy, createdByIp: r.createdByIp, createdByDevice: r.createdByDevice,
        openFn: ()=> renderSharedReceiptDetailModal(r),
      });
    });
    Object.keys(state.borrowerConfirmations||{}).forEach(bid=>{
      (state.borrowerConfirmations[bid]||[]).forEach(c=>{
        if(c.isSharedLink) return;
        const b = state.borrowers.find(x=>x.id===bid);
        const kindColor = CONFIRMATION_KIND_COLOR[c.kind]||'#000';
        entries.push({
          type:'confirmation', scope:'rieng',
          titleHtml: `📝 <span style="color:${kindColor};">${escapeHtml((c.title||'').replace(/^Giấy xác nhận\s*/i,''))}</span>`,
          affectedNames: b? [b.name] : [c.borrowerName||'(hộ vay đã bị xoá)'],
          createdAt: c.createdAt, createdByName: c.createdByName, createdBy: c.createdBy, createdByIp: c.createdByIp, createdByDevice: c.createdByDevice,
          openFn: ()=> renderConfirmationDetailModal(c),
        });
      });
    });
    (state.sharedConfirmationDocuments||[]).forEach(c=>{
      const kindColor = CONFIRMATION_KIND_COLOR[c.kind]||'#000';
      entries.push({
        type:'confirmation', scope:'chung', kind:c.kind,
        titleHtml: `📝 <span style="color:${kindColor};">${escapeHtml((c.title||'').replace(/^GXN Chung:\s*/i,'GXN Chung: '))}</span>`,
        affectedNames: c.kind==='quarter_config_change_bulk' ? ['Tất cả khoản vay trong sổ vay vốn'] : (c.affectedBorrowerIds||[]).map(id=>{ const b=state.borrowers.find(x=>x.id===id); return b? b.name : id; }),
        createdAt: c.createdAt, createdByName: c.createdByName, createdBy: c.createdBy, createdByIp: c.createdByIp, createdByDevice: c.createdByDevice,
        openFn: ()=> renderConfirmationDetailModal(c),
      });
    });
    (state.categoryChangeLog||[]).forEach(l=>{
      const swatch = (c)=> `<span style="display:inline-block; width:22px; height:14px; background:${c||'#fff'}; border:1px solid var(--line); vertical-align:middle; margin:0 3px;"></span>`;
      let titleHtml;
      if(l.action==='created') titleHtml = `🏷️ Tên phân loại được tạo: "${escapeHtml(l.name)}" màu ${swatch(l.color)} thuộc ${escapeHtml(l.kindLabel)}`;
      else if(l.action==='renamed') titleHtml = `🏷️ Tên phân loại được sửa từ "${escapeHtml(l.oldName)}" thành "${escapeHtml(l.name)}" thuộc ${escapeHtml(l.kindLabel)}`;
      else if(l.action==='recolored') titleHtml = `🏷️ Tên phân loại "${escapeHtml(l.name)}" đổi màu từ ${swatch(l.oldColor)} thành ${swatch(l.color)} thuộc ${escapeHtml(l.kindLabel)}`;
      else titleHtml = `🏷️ Tên phân loại được sửa từ "${escapeHtml(l.oldName)}" (màu ${swatch(l.oldColor)}) thành "${escapeHtml(l.name)}" (màu ${swatch(l.color)}) thuộc ${escapeHtml(l.kindLabel)}`;
      entries.push({
        type:'category', scope:'ten_phan_loai',
        titleHtml,
        affectedNames: [],
        createdAt: l.at, createdByName: l.createdByName, createdBy: l.createdBy, createdByIp: l.createdByIp, createdByDevice: l.createdByDevice,
        openFn: ()=> renderReceiptCategoryManagerModal(l.kind, ()=>{}),
      });
    });
    (state.columnViewSetLog||[]).forEach(l=>{
      let titleHtml;
      if(l.action==='created') titleHtml = `📐 Bộ xem cột được tạo: "${escapeHtml(l.name)}"${l.detail?` (${escapeHtml(l.detail)})`:''}`;
      else if(l.action==='renamed') titleHtml = `📐 Bộ xem cột được ${escapeHtml(l.detail||('đổi tên thành "'+l.name+'"'))}`;
      else if(l.action==='edited') titleHtml = `📐 Bộ xem cột "${escapeHtml(l.name)}" đã được chỉnh sửa nội dung cột bên trong`;
      else if(l.action==='deleted') titleHtml = `📐 Bộ xem cột "${escapeHtml(l.name)}" đã bị xoá`;
      else titleHtml = `📐 Bộ xem cột "${escapeHtml(l.name)}" có thay đổi`;
      entries.push({
        type:'colviewset', scope:'bo_xem_cot',
        titleHtml, affectedNames: [],
        createdAt: l.at, createdByName: l.createdByName, createdBy: l.createdBy, createdByIp: l.createdByIp, createdByDevice: l.createdByDevice,
        openFn: ()=> renderColumnViewSetModal(),
      });
    });
    (state.loanColorLog||[]).forEach(l=>{
      const groupLabel = l.group==='canhan' ? 'Bộ màu cá nhân' : 'Bộ màu xã phường';
      const titleHtml = `🎨 ${escapeHtml(groupLabel)} đã được ${l.action==='created'?'tạo mới':'chỉnh sửa'}`;
      entries.push({
        type:'loancolor', scope:'bo_mau',
        titleHtml, affectedNames: [],
        createdAt: l.at, createdByName: l.createdByName, createdBy: l.createdBy, createdByIp: l.createdByIp, createdByDevice: l.createdByDevice,
        openFn: ()=> renderLoanColorModal(),
      });
    });
    return entries;
  }
  function logEntryMatchesKindFilter(e){
    const sel = state.logFilterKind||[];
    if(e.type==='colviewset') return sel.includes('bo_xem_cot');
    if(e.type==='loancolor') return sel.includes('bo_mau');
    if(e.type==='category') return sel.includes('ten_phan_loai');
    if(e.type==='receipt'){
      // "Biên lai Thanh toán qua đường link" là 1 ĐẶC TÍNH bổ sung (không thay thế Chung/Riêng) — nếu
      // đang được chọn thì các biên lai qua đường link LUÔN hiện ra, kể cả khi không lựa chọn nào khác
      // khớp.
      if(e.viaPaymentLink && sel.includes('bienlai_qua_link')) return true;
      const scopeOk = e.scope==='chung'? sel.includes('bienlai_chung') : sel.includes('bienlai_rieng');
      const signOk = e.sign==='+'? sel.includes('bienlai_cong') : sel.includes('bienlai_tru');
      return scopeOk && signOk;
    }
    return e.scope==='chung'? sel.includes('gxn_chung') : sel.includes('gxn_rieng');
  }
  function logEntryMatchesQuarterFilter(e){
    if(!state.logSpecificTime) return true;
    const range = selectedQuarterYearRange();
    if(!range.from || !range.to) return true;
    const d = (e.createdAt||'').slice(0,10);
    if(!d) return false;
    return d < range.to && d >= range.from;
  }
  function activityLogRowHtml(e){
    const d = new Date(e.createdAt);
    const dateLbl = isNaN(d.getTime()) ? '' : `Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()} vào lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    return `<div class="preview-allow" data-log-entry-idx="${e.__idx}" style="border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:8px; cursor:pointer; background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; flex-wrap:wrap;">
        <div style="font-weight:700;">${e.titleHtml}</div>
        ${e.viaPaymentLink? `<span style="color:#0d47a1; font-weight:700; white-space:nowrap;">Thanh toán qua đường link</span>` : ''}
      </div>
      ${e.affectedNames.length? `<div class="sub" style="margin-top:4px;">${escapeHtml(e.affectedNames.join(', '))}</div>` : ''}
      <div class="sub" style="margin-top:4px; text-align:right;">${dateLbl}</div>
      <div class="sub" style="margin-top:4px; text-align:right;">${escapeHtml(e.createdByName||'')} — ${escapeHtml(e.createdBy||'(không có email)')} — IP: ${escapeHtml(e.createdByIp||'(không lấy được)')}</div>
    </div>`;
  }
