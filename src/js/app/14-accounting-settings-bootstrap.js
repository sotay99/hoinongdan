  // =====================================================================
  // Bộ lọc Quý (Q1-Q4)/Năm riêng cho "Chọn Quý cụ thể" ở Sổ Thu Chi Lãi Quỹ — mô phỏng CHÍNH XÁC cùng
  // cơ chế với bộ lọc Quý/Năm ở panel "Danh sách khoản vay đang hoạt động": mặc định 1 Quý/1 Năm hiện
  // tại, chỉ được chọn thêm các Quý/Năm LIỀN KỀ nhau, bỏ chọn ở giữa dãy thì cắt bỏ luôn phần sau đó,
  // bấm 1 Quý/Năm không liền kề thì reset lại chỉ còn đúng 1 mục vừa bấm.
  // =====================================================================
  const EXP_ACCT_QUARTER_SEQ = ['q1','q2','q3','q4'];
  function expAcctQuarterSeqIndex(key){ return EXP_ACCT_QUARTER_SEQ.indexOf(key); }
  function ensureExpAcctFiltersInit(){
    if(!state.expAcctFilterQuarters){ state.expAcctFilterQuarters = [todayBasedQuarterKey()]; state.expAcctFilterQuartersAdvanced = false; }
    if(!state.expAcctFilterYears){ state.expAcctFilterYears = [new Date().getFullYear()]; state.expAcctFilterYearsAdvanced = false; }
  }
  function toggleExpAcctQuarterFilter(key, checked){
    ensureExpAcctFiltersInit();
    const sel = state.expAcctFilterQuarters;
    if(!state.expAcctFilterQuartersAdvanced && sel.length===1){
      if(checked){
        if(key===sel[0]) return false;
        state.expAcctFilterQuarters = [key];
        state.expAcctFilterQuartersAdvanced = true;
        return true;
      }
      return false; // không cho bỏ chọn mốc mặc định duy nhất
    }
    if(checked){
      if(sel.includes(key)) return false;
      const newSel = sel.concat([key]);
      if(!isContiguousIdxList(newSel.map(expAcctQuarterSeqIndex))){
        state.expAcctFilterQuarters = [key];
        state.expAcctFilterQuartersAdvanced = true;
        return true;
      }
      state.expAcctFilterQuarters = newSel.sort((a,b)=>expAcctQuarterSeqIndex(a)-expAcctQuarterSeqIndex(b));
      return true;
    } else {
      if(sel.length<=1) return false;
      const keyIdx = expAcctQuarterSeqIndex(key);
      const idxs = sel.map(expAcctQuarterSeqIndex);
      const minIdx = Math.min(...idxs), maxIdx = Math.max(...idxs);
      let newSel;
      if(keyIdx===minIdx || keyIdx===maxIdx) newSel = sel.filter(k=>k!==key);
      else newSel = sel.filter(k=> expAcctQuarterSeqIndex(k) < keyIdx);
      if(!newSel.length){
        state.expAcctFilterQuarters = [todayBasedQuarterKey()];
        state.expAcctFilterQuartersAdvanced = false;
        return true;
      }
      state.expAcctFilterQuarters = newSel;
      return true;
    }
  }
  const EXP_ACCT_YEAR_MAX_SPAN = 25;
  function toggleExpAcctYearFilter(year, checked){
    ensureExpAcctFiltersInit();
    const sel = state.expAcctFilterYears;
    if(!state.expAcctFilterYearsAdvanced && sel.length===1){
      if(checked){
        if(year===sel[0]) return false;
        state.expAcctFilterYears = [year];
        state.expAcctFilterYearsAdvanced = true;
        return true;
      }
      return false;
    }
    if(checked){
      if(sel.includes(year)) return false;
      const newSel = sel.concat([year]).sort((a,b)=>a-b);
      const contiguousOk = newSel[newSel.length-1]-newSel[0]+1 === newSel.length;
      const withinMax = newSel.length <= EXP_ACCT_YEAR_MAX_SPAN;
      if(!contiguousOk || !withinMax){
        state.expAcctFilterYears = [year];
        state.expAcctFilterYearsAdvanced = true;
        return true;
      }
      state.expAcctFilterYears = newSel;
      return true;
    } else {
      if(sel.length<=1) return false;
      const minY = Math.min(...sel), maxY = Math.max(...sel);
      let newSel;
      if(year===minY || year===maxY) newSel = sel.filter(y=>y!==year);
      else newSel = sel.filter(y=> y < year);
      if(!newSel.length){
        state.expAcctFilterYears = [new Date().getFullYear()];
        state.expAcctFilterYearsAdvanced = false;
        return true;
      }
      state.expAcctFilterYears = newSel;
      return true;
    }
  }
  function expAcctQuarterFilterLabel(){
    ensureExpAcctFiltersInit();
    const sel = state.expAcctFilterQuarters;
    if(sel.length===1) return {q1:'Quý 1',q2:'Quý 2',q3:'Quý 3',q4:'Quý 4'}[sel[0]];
    return `${sel.length}-quý`;
  }
  function expAcctYearFilterLabel(){
    ensureExpAcctFiltersInit();
    const sel = state.expAcctFilterYears;
    if(sel.length===1) return `Năm ${sel[0]}`;
    return `${sel.length}-năm`;
  }
  function expAcctFilterIsDefault(){
    ensureExpAcctFiltersInit();
    return state.expAcctFilterQuarters.length===1 && state.expAcctFilterQuarters[0]===todayBasedQuarterKey()
      && state.expAcctFilterYears.length===1 && state.expAcctFilterYears[0]===new Date().getFullYear();
  }
  function acctPeriodSelectorHtml(prefix){
    const cy = new Date().getFullYear();
    const isQuarterMode = state.acctMode==='quarter';
    if(isQuarterMode) ensureTimelineFilterInit(prefix);
    return `
      <select id="${prefix}-mode" class="preview-allow">
        <option value="ycur" ${state.acctMode==='ycur'||state.acctMode==='year'?'selected':''}>Cả năm ${cy} (Quý 1 → Quý 4)</option>
        <option value="yprev" ${state.acctMode==='yprev'?'selected':''}>Cả năm ${cy-1} (Quý 1 → Quý 4)</option>
        <option value="quarter" ${isQuarterMode?'selected':''}>Chọn Quý cụ thể</option>
        <option value="all" ${state.acctMode==='all'?'selected':''}>Toàn bộ từ trước đến nay</option>
      </select>
      ${isQuarterMode ? `${buildTimelineFilterDropdownHtml(prefix)}
      <button type="button" class="btn btn-ghost btn-sm preview-allow ${!timelineFilterIsDefault(prefix)?'reset-filter-active':''}" id="${prefix}-timeline-reset-btn2" title="Đưa bộ lọc Quý/Năm về đúng mặc định ban đầu (Quý hiện tại/Năm hiện tại)">↺ Khôi phục bộ lọc gốc</button>` : ''}
    `;
  }
  function bindAcctPeriodSelector(prefix, onChange, container){
    document.getElementById(`${prefix}-mode`).onchange = e=>{
      state.acctMode = e.target.value;
      // Vào chế độ "Chọn Quý cụ thể" -> mặc định LUÔN là Quý hiện tại + Năm hiện tại (đúng yêu cầu).
      if(e.target.value==='quarter') resetTimelineFilter(prefix);
      onChange();
    };
    if(state.acctMode==='quarter'){
      wireTimelineFilterDropdown(prefix, onChange, container);
      const root = container || document;
      const resetBtn2 = root.querySelector(`#${prefix}-timeline-reset-btn2`);
      if(resetBtn2) resetBtn2.onclick = (e)=>{ e.stopPropagation(); resetTimelineFilter(prefix); state.openFilterDropdown = null; onChange(); };
    }
  }

  function emptyExpense(){
    return { id: uid(), date: todayStr(), purpose: CAT_MEETING, purposeOther:'', hamlet:(state.config.hamlets||[])[0]||'', amount:0, note:'', quarters:[], amountMode:'auto', attachments:[] };
  }

  function renderAccountingStatInfoModal(kind, acct, from, to){
    const level = adminLevelLabel();
    const amountMap = {
      income: acct.xaNhan,
      expense: acct.chiTotal,
      balance: acct.tonQuy,
    };
    const amount = amountMap[kind] ?? 0;
    const moneyLabel = money(amount);
    const colorMap = {
      income: '#8b5e00',
      expense: '#8b3210',
      balance: acct.tonQuy>=0 ? '#1b5e20' : '#8b1e1e',
    };
    const categoryRows = Object.entries(acct.chiByCategory||{})
      .sort(([,a],[,b])=>b-a)
      .map(([label,value])=>`<tr><td>${escapeHtml(label)}</td><td class="money">${money(value)}</td></tr>`)
      .join('');
    const periodHtml = `<b>${fmtDate(from)} → ${fmtDate(to)}</b>`;
    const content = {
      income: {
        title: `💰 Tổng thu ${level}: số tiền lãi được nhận`,
        lead: `Số tiền đang hiển thị là <b>${moneyLabel}</b>. Đây là tổng phần tiền lãi được phân bổ về ${level} trong đúng kỳ hạch toán đang xem.`,
        sections: `
          <p>Khoản này được hệ thống tính từ các khoản vay trong <b>Sổ vay vốn Quỹ Hỗ trợ Nông dân</b>. Với mỗi khoản vay, hệ thống chỉ lấy những Quý đã thực sự đóng lãi và đã được ghi nhận/phê duyệt, sau đó phân bổ phần tiền lãi thuộc về ${level} theo tỷ lệ phân bổ riêng của khoản vay đó.</p>
          <p>Nói cách khác, đây là số tiền lãi ${level} <b>được nhận theo số liệu đã phát sinh</b>, không phải số tiền dự kiến, không phải tiền gốc đã giải ngân, cũng không phải toàn bộ số tiền người vay còn phải trả trong tương lai.</p>
          <div class="acct-info-box"><b>Công thức hiểu đơn giản</b><br>Tiền lãi đã đóng của từng khoản vay × tỷ lệ phân bổ về ${level} → cộng tất cả khoản trong ${periodHtml}.</div>
          <p>Nếu bạn đổi bộ lọc <b>Quý/Năm</b> ở phía trên module rồi mở lại modal, số tiền sẽ được tính lại theo kỳ mới. Các khoản lãi chưa đóng, chưa được phê duyệt hoặc nằm ngoài kỳ đang xem sẽ không được cộng vào con số này.</p>
          <p>Ý nghĩa quản lý của chỉ tiêu này là cho biết trong kỳ, ${level} có bao nhiêu nguồn thu từ phần lãi được phân bổ để làm căn cứ đối chiếu với các khoản đã chi và tính số tồn quỹ.</p>`,
      },
      expense: {
        title: `📤 Tổng số tiền ${level} đã chi`,
        lead: `Số tiền đang hiển thị là <b>${moneyLabel}</b>. Đây là tổng tất cả khoản chi hợp lệ của ${level} trong kỳ hạch toán đang xem.`,
        sections: `
          <p>Khoản này được cộng từ các bản ghi trong <b>Sổ Thu Chi Lãi Quỹ</b> có ngày chi nằm trong ${periodHtml}. Những khoản đã bị đưa vào thùng rác hoặc không thuộc kỳ đang xem sẽ không được tính.</p>
          <p>Mỗi khoản chi có thể thuộc một mục đích khác nhau, chẳng hạn như chi hoạt động họp, chi bồi dưỡng cán bộ hoạt động quỹ, chi trích về khu dân cư/ấp hoặc mục đích khác. Hệ thống cộng số tiền thực tế đã nhập của từng bản ghi để tạo thành tổng này.</p>
          <div class="acct-info-box"><b>Số bản ghi đang được cộng</b><br>${acct.expenses.length ? `<b>${acct.expenses.length}</b> khoản chi hợp lệ trong kỳ.` : 'Chưa có khoản chi hợp lệ nào trong kỳ.'}</div>
          ${categoryRows ? `<p style="margin-bottom:6px;"><b>Phân bổ theo nội dung chi</b></p><div class="table-wrap acct-info-table"><table><thead><tr><th>Nội dung</th><th>Số tiền</th></tr></thead><tbody>${categoryRows}</tbody></table></div>` : ''}
          <p>Ý nghĩa của chỉ tiêu này là cho biết nguồn thu của ${level} đã được sử dụng bao nhiêu trong kỳ. Muốn kiểm tra chi tiết, bạn có thể xem từng dòng ở bảng <b>Danh sách khoản chi</b> bên dưới.</p>`,
      },
      balance: {
        title: `⚖️ Tồn quỹ ${level}: số dư sau thu và chi`,
        lead: `Số tiền đang hiển thị là <b>${moneyLabel}</b>. Đây là số còn lại theo dữ liệu Thu − Chi trong kỳ đang xem.`,
        sections: `
          <p>Tồn quỹ được tính bằng cách lấy <b>Tổng thu ${level}</b> trừ đi <b>Tổng số tiền ${level} đã chi</b>. Với số liệu hiện tại, phép tính là:</p>
          <div class="acct-info-equation"><span>${money(acct.xaNhan)}</span><b>−</b><span>${money(acct.chiTotal)}</span><b>=</b><strong>${money(acct.tonQuy)}</strong></div>
          <p>Nếu số tiền dương, dữ liệu đang cho thấy thu lớn hơn chi và còn số dư theo sổ. Nếu số tiền bằng 0, thu và chi cân bằng. Nếu số tiền âm, tổng chi đang lớn hơn tổng thu được ghi nhận trong kỳ; đây là tín hiệu cần kiểm tra lại các khoản chi, kỳ hạch toán hoặc số liệu phân bổ.</p>
          <p>Chỉ tiêu này là <b>số dư được tính trên sổ theo kỳ đang chọn</b>. Nó không tự động khẳng định số tiền mặt hoặc số dư tài khoản ngân hàng thực tế nếu còn khoản thu/chi chưa nhập, nhập sai kỳ, hoặc khoản đang chờ được ghi nhận.</p>
          <p>Để giải thích rõ con số này, hãy đối chiếu đồng thời ba khung: Tổng thu cho biết nguồn vào, Tổng đã chi cho biết nguồn ra, còn Tồn quỹ cho biết phần chênh lệch còn lại sau phép trừ.</p>`,
      },
    }[kind];
    if(!content) return;

    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal accounting-info-modal" style="max-width:820px;">
        <div class="modal-head" style="background:linear-gradient(180deg, #fff 0%, ${colorMap[kind]} 100%);">
          <h3>${content.title}</h3>
          <button class="modal-close preview-allow" id="acct-info-close" aria-label="Đóng">✕</button>
        </div>
        <div class="modal-body">
          <div class="acct-info-amount" style="color:${colorMap[kind]};">${moneyLabel}</div>
          <p class="acct-info-lead">${content.lead}</p>
          <div class="acct-info-period">Kỳ hạch toán đang xem: ${periodHtml}</div>
          <div class="acct-info-copy">${content.sections}</div>
        </div>
        <div class="modal-foot"><button class="btn btn-ghost preview-allow" id="acct-info-close2">Đóng bảng</button></div>
      </div>`;
    wrap.querySelector('#acct-info-close').onclick = close;
    wrap.querySelector('#acct-info-close2').onclick = close;
    wrap.onclick = e=>{ if(e.target===wrap) close(); };
  }

  function renderExpensesTab(el){
    const {from,to,quarterSet} = acctPeriodRange();
    const acct = computeAcctTotals(from,to,quarterSet);
    let list = state.expenses.filter(e=>!e.deleted);
    if(state.expSearch) list = list.filter(e => (e.note+e.purposeOther+e.hamlet).toLowerCase().includes(state.expSearch.toLowerCase()));
    if(state.expFilterCat) list = list.filter(e=>e.purpose===state.expFilterCat);
    list = [...list].sort((a,b)=> (b.date||'').localeCompare(a.date||''));

    el.innerHTML = `
      <div class="panel"><div class="panel-head"><h3>Kỳ hạch toán đang xem</h3></div>
        <div class="panel-body"><div class="toolbar" style="margin:0;">${acctPeriodSelectorHtml('exp')}
            <div class="spacer"></div>
            <button class="btn btn-sm preview-allow" id="exp-level-allocation-btn" style="background:linear-gradient(180deg, #ffffff 0%, #26c6da 45%, #00838f 100%); color:#000; border-color:#00acc1; font-weight:700;">📊 Thống kê phân bổ tiền lãi các cấp</button>
            <button class="btn btn-sm preview-allow" id="exp-stats-btn" style="background:linear-gradient(180deg, #ffffff 0%, #ba68c8 45%, #6a1b9a 100%); color:#000; border-color:#6a1b9a; font-weight:700;">📈 Thống kê Thu Chi chi tiết</button>
          </div>
          <div class="sub" style="margin-top:8px;">Khoảng áp dụng: <b>${fmtDate(from)} → ${fmtDate(to)}</b></div>
        </div>
      </div>

      <div class="grid3">
        <div class="stat-card accounting-stat-card" role="button" tabindex="0" data-accounting-stat-info="income" aria-label="Xem giải thích Tổng thu" style="background:linear-gradient(135deg,var(--rice),var(--rice-dark));">
          <div class="num mono accounting-money-pulse">${money(acct.xaNhan)}</div>
          <div class="lbl">TỔNG THU: Tổng lãi trích về cho ${adminLevelLabel()}</div>
          <div class="sub">Tính theo đúng tỷ lệ % phân bổ riêng của từng khoản vay (khớp Sổ vay vốn), chỉ tính lãi ĐÃ đóng</div>
        </div>
        <div class="stat-card accounting-stat-card" role="button" tabindex="0" data-accounting-stat-info="expense" aria-label="Xem giải thích Tổng số tiền đã chi" style="background:linear-gradient(135deg,var(--clay),#7d3813);">
          <div class="num mono accounting-money-pulse">${money(acct.chiTotal)}</div>
          <div class="lbl">Tổng số tiền ${adminLevelLabel()} đã chi</div>
          <div class="sub">Cộng dồn từ các khoản chi trong kỳ</div>
        </div>
        <div class="stat-card accounting-stat-card" role="button" tabindex="0" data-accounting-stat-info="balance" aria-label="Xem giải thích Tồn quỹ" style="background:linear-gradient(135deg,${acct.tonQuy>=0?'var(--green)':'var(--red)'},${acct.tonQuy>=0?'#2f4f34':'#7a231d'});">
          <div class="num mono accounting-money-pulse">${money(acct.tonQuy)}</div>
          <div class="lbl">Tồn quỹ ${adminLevelLabel()}</div>
          <div class="sub">= Tổng nhận về − Tổng đã chi</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>📋 Danh sách khoản chi</h3></div>
        <div class="panel-body">
          <div class="toolbar" style="margin:0 0 12px;">
            <input id="e-search" class="preview-allow" placeholder="🔎 Tìm theo ghi chú, ${subAdminLabelLower()}..." value="${state.expSearch}" style="min-width:220px;">
            <select id="e-cat" class="preview-allow"><option value="">Tất cả mục đích chi</option>${EXPENSE_CATEGORIES.map(c=>`<option value="${c}" ${state.expFilterCat===c?'selected':''}>${categoryLabel(c)}</option>`).join('')}</select>
            <div class="spacer"></div>
            ${canEditModule('data')? `<button class="btn btn-primary preview-allow" id="add-exp-btn">+ Thêm khoản chi mới</button>` : ''}
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th><span class="dancing-header preview-allow" data-header-scope="explist">Ngày chi</span></th><th>Nội dung / Mục đích</th><th>Địa bàn (${subAdminLabel()})</th><th>Số tiền</th><th>Ghi chú</th><th></th></tr></thead>
              <tbody>
                ${list.length? list.map(e=>`
                  <tr>
                    <td>${fmtDate(e.date)}</td>
                    <td>${e.purpose===CAT_OTHER? `${categoryLabel(CAT_OTHER)}: ${e.purposeOther||''}` : categoryLabel(e.purpose)}</td>
                    <td>${isCatHamlet(e.purpose)? (e.hamlet||'—') : '—'}</td>
                    <td class="money">${money(e.amount)}</td>
                    <td>${e.note? wrapTextAtSpacesHtml(e.note,28) : '—'}</td>
                    <td><button class="btn btn-ghost btn-sm preview-allow" data-view-exp="${e.id}">Xem/Sửa</button></td>
                  </tr>`).join('') : `<tr><td colspan="6"><div class="empty-state"><div class="e-ico">💰</div>Chưa có khoản chi nào trong kỳ này</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>⚖️ Đối chiếu "Trích về ${subAdminLabelLower()}": Thực tế vs. Tự động (theo Sổ vay vốn)</h3></div>
        <div class="panel-body">
          <p class="sub" style="margin:0 0 10px;">So sánh số tiền ĐÃ THỰC SỰ chi "Trích về ${subAdminLabelLower()}" với số tự động tính theo đúng công thức phân bổ của Sổ vay vốn — luôn tính TOÀN BỘ thời gian từ trước đến nay cho MỌI địa bàn, không phụ thuộc kỳ hạch toán đang xem ở panel phía trên. Phát hiện cả trường hợp bị ghi trùng lặp (nhiều bản ghi cùng 1 Quý của 1 địa bàn).</p>
          ${(()=>{
            const rows = computeHamletQuarterReconciliation();
            if(!rows.length) return `<div class="empty-state"><div class="e-ico">⚖️</div>Chưa có địa bàn nào để đối chiếu</div>`;
            let totalDup=0, totalDupOcc=0, totalDiffAll=0;
            const rowsHtml = rows.map(r=>{
              totalDup += r.dupQuarterCount; totalDupOcc += r.dupTotalOccurrences; totalDiffAll += r.totalDiff;
              const diffColor = r.totalDiff===0? 'var(--rice-dark)' : (r.totalDiff>0? '#b8860b' : 'var(--red)');
              const diffLabel = r.totalDiff===0? 'Khớp' : (r.totalDiff>0? `Dư ${money(r.totalDiff)}` : `Thiếu ${money(-r.totalDiff)}`);
              const noteLines = [...r.deficitLines, ...r.surplusLines];
              const noteHtml = noteLines.length? noteLines.map(l=>{
                const isDeficit = r.deficitLines.includes(l);
                return `<span style="color:${isDeficit?'var(--red)':'#b8860b'};">${escapeHtml(l)}</span>`;
              }).join('<br>') : '—';
              const dupHtml = r.dupDetails.length? r.dupDetails.map(d=>`${d.label} (${d.times} lần)`).join(', ') : '—';
              return `<tr>
                <td>${escapeHtml(r.hamlet)}</td>
                <td style="color:${diffColor}; font-weight:700;">${diffLabel}</td>
                <td style="font-size:12px;">${noteHtml}</td>
                <td style="font-size:12px;">${dupHtml}</td>
              </tr>`;
            }).join('');
            const totalDiffColor = totalDiffAll===0? 'var(--rice-dark)' : (totalDiffAll>0? '#b8860b' : 'var(--red)');
            const totalDiffLabel = totalDiffAll===0? 'Khớp' : (totalDiffAll>0? `Dư ${money(totalDiffAll)}` : `Thiếu ${money(-totalDiffAll)}`);
            return `<div class="table-wrap"><table>
              <thead><tr><th><span class="dancing-header preview-allow" data-header-scope="expcompare">Địa bàn</span></th><th>Tổng chênh lệch</th><th>Ghi chú (chi tiết từng Quý)</th><th>Quý bị Trùng lặp (Chi nhiều lần)</th></tr></thead>
              <tbody>${rowsHtml}
                <tr style="font-weight:800; background:var(--paper-2);"><td>TỔNG</td><td style="color:${totalDiffColor};">${totalDiffLabel}</td><td>—</td><td style="text-align:center;">${totalDupOcc||'—'}</td></tr>
              </tbody>
            </table></div>`;
          })()}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head" style="cursor:pointer;" id="exp-trash-toggle"><h3>🗑️ Thùng rác (Chi tiêu) ${state.trash.filter(x=>(x._kind||'borrower')==='expense').length? `<span class="sub">(${state.trash.filter(x=>(x._kind||'borrower')==='expense').length})</span>` : ''} ${state.showExpenseTrash?'▴':'▾'}</h3></div>
        ${state.showExpenseTrash? `<div class="panel-body">${buildTrashPanelHtml(['expense'])}</div>` : ''}
      </div>`;

    const expTrashToggle = document.getElementById('exp-trash-toggle');
    if(expTrashToggle) expTrashToggle.onclick = ()=>{ state.showExpenseTrash = !state.showExpenseTrash; renderExpensesTab(el); };
    if(state.showExpenseTrash) wireTrashPanel(el, ()=> renderExpensesTab(el));

    document.querySelectorAll('[data-accounting-stat-info]').forEach(card=>{
      const openInfo = ()=> renderAccountingStatInfoModal(card.dataset.accountingStatInfo, acct, from, to);
      card.onclick = openInfo;
      card.onkeydown = e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openInfo(); } };
    });
    bindAcctPeriodSelector('exp', ()=>renderExpensesTab(el), el);
    const expLevelAllocationBtn = document.getElementById('exp-level-allocation-btn');
    if(expLevelAllocationBtn) expLevelAllocationBtn.onclick = ()=> renderLevelAllocationModal();
    const expStatsBtn = document.getElementById('exp-stats-btn');
    if(expStatsBtn) expStatsBtn.onclick = ()=> renderExpenseStatsModal();
    document.getElementById('e-search').oninput = e=>{ state.expSearch=e.target.value; renderExpensesTab(el); };
    document.getElementById('e-cat').onchange = e=>{ state.expFilterCat=e.target.value; renderExpensesTab(el); };
    const addBtn = document.getElementById('add-exp-btn');
    if(addBtn) addBtn.onclick = ()=>{ state.modal={type:'expense', payload:null}; render(); };
    document.querySelectorAll('[data-view-exp]').forEach(b=>{
      b.onclick = ()=>{ state.modal={type:'expense', payload: state.expenses.find(x=>x.id===b.dataset.viewExp)}; render(); };
    });
  }

  function renderExpenseModal(){
    const isNew = !state.modal.payload;
    const e0 = state.modal.payload ? {...state.modal.payload} : emptyExpense();
    if(isCatHamlet(e0.purpose)) e0.purpose = CAT_HAMLET; // chuẩn hoá dữ liệu cũ (chữ Việt) về khoá nội bộ mới
    const hamlets = state.config.hamlets||[];
    const readonly = !canEditModule('data');
    // Trạng thái đang chọn (chỉ có ý nghĩa với hạng mục CAT_HAMLET) — khi SỬA 1 khoản chi đã có sẵn thì
    // chỉ đúng 1 địa bàn của bản ghi đó được chọn sẵn (không cho đổi sang nhiều địa bàn khi đang sửa,
    // tránh nhầm lẫn với các bản ghi khác đã tồn tại) — khi TẠO MỚI thì mặc định chưa chọn địa bàn nào.
    let selHamlets = isNew ? [] : [e0.hamlet].filter(Boolean);
    let selQuarters = (Array.isArray(e0.quarters) && e0.quarters.length) ? e0.quarters.slice() : [{ qk: todayBasedQuarterKey(), year: new Date().getFullYear() }];
    let amountMode = e0.amountMode==='manual' ? 'manual' : 'auto';
    let currentPurpose = e0.purpose; // giá trị purpose ĐANG được chọn thật sự (khác e0.purpose cố định từ lúc mở modal) — cập nhật mỗi khi người dùng đổi lựa chọn ở dropdown "Nội dung công việc/Mục đích chi"
    let attachments = Array.isArray(e0.attachments) ? e0.attachments.slice() : []; // {name, storagePath, storageUrl, mimeType, size} — ảnh/tệp tin đính kèm, áp dụng chung cho MỌI hạng mục chi
    let attachUploading = false;
    const MAX_ATTACH = 20;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    const sortedHamlets = hamlets.slice().sort((a,b)=>{
      const aOther = String(a).trim()==='Khác', bOther = String(b).trim()==='Khác';
      if(aOther && !bOther) return 1;
      if(!aOther && bOther) return -1;
      return 0; // giữ nguyên thứ tự tương đối ban đầu giữa các Ấp còn lại
    });
    function hamletChecksHtml(){
      return sortedHamlets.map(h=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow em-hamlet-cb" data-h="${escapeHtml(h)}" ${selHamlets.includes(h)?'checked':''} ${(!isNew||readonly)?'disabled':''}><span>${escapeHtml(h)}</span></label>`).join('');
    }
    function selectedHamletsCaptionHtml(){
      if(!selHamlets.length) return `<p class="sub" style="color:var(--red); margin:4px 0 0;">Chưa chọn ${subAdminLabelLower()} nào.</p>`;
      if(selHamlets.length===hamlets.length) return `<p class="sub" style="color:var(--red); margin:4px 0 0;">Đang chọn tất cả các ${subAdminLabelLower()}</p>`;
      return `<p class="sub" style="color:var(--red); margin:4px 0 0;">Đang chọn ${selHamlets.length} ${subAdminLabelLower()}: ${selHamlets.map(escapeHtml).join(', ')}</p>`;
    }
    let quarterDropdownOpen = false;
    function isDefaultSelQuarters(){
      return selQuarters.length===1 && selQuarters[0].qk===todayBasedQuarterKey() && selQuarters[0].year===new Date().getFullYear();
    }
    function quarterDropdownHtml(){
      return `<div class="sv-filter-dropdown">
        <button type="button" class="btn btn-ghost btn-sm preview-allow" id="em-quarter-dd-btn" style="${!isDefaultSelQuarters()?'border:2px solid #b71c1c;':''}">${selQuarters.length} Quý đã chọn ▾</button>
        ${quarterDropdownOpen? `<div class="sv-filter-panel" id="em-quarter-dd-panel-outer" style="position:relative; display:flex; padding-right:44px; max-height:280px;">
          <div id="em-quarter-dd-panel" style="overflow-y:auto; flex:1;">
            ${TIMELINE_SEQ.map(t=>{ const checked = selQuarters.some(x=>x.qk===t.qk && x.year===t.year); return `<label class="sv-filter-item" ${checked?'data-selected-timeline="1"':''}><input type="checkbox" class="preview-allow em-quarter-dd-item" data-qk="${t.qk}" data-year="${t.year}" ${checked?'checked':''} ${readonly?'disabled':''}><span>${t.label}</span></label>`; }).join('')}
          </div>
          <div style="position:absolute; right:6px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:8px;">
            <button type="button" class="pg-suggest-scroll-btn preview-allow" id="em-quarter-dd-up-btn" title="Cuộn lên">▲</button>
            <button type="button" class="pg-suggest-scroll-btn preview-allow" id="em-quarter-dd-down-btn" title="Cuộn xuống">▼</button>
          </div>
        </div>` : ''}
      </div>
      <button type="button" class="btn btn-ghost btn-sm preview-allow ${!isDefaultSelQuarters()?'reset-filter-active':''}" id="em-quarter-dd-reset-btn" title="Đưa về đúng mặc định ban đầu (Quý hiện tại/Năm hiện tại)">↺ Khôi phục mặc định</button>`;
    }
    function selectedQuartersCaptionHtml(){
      if(!selQuarters.length) return `<p class="sub" style="color:var(--red); margin:4px 0 0;">Chưa chọn Quý nào.</p>`;
      const labels = selQuarters.map(x=> TIMELINE_SEQ[timelineSeqIndex(`${x.qk}_${x.year}`)]).filter(Boolean).sort((a,b)=>timelineSeqIndex(a.key)-timelineSeqIndex(b.key)).map(t=>t.label);
      return `<p class="sub" style="color:var(--red); margin:4px 0 0;">Đang chọn ${selQuarters.length}-quý: ${labels.join(', ')}</p>`;
    }
    // Phát hiện trùng lặp — với mỗi cặp (Ấp, Quý) đang chọn, kiểm tra trong sổ đã có khoản chi "Trích
    // về" nào khác (không tính chính bản ghi đang sửa, nếu có) từng ghi nhận ĐÚNG cặp Ấp+Quý đó chưa.
    // Trả về { tênẤp: [ {qLabel, amount}, ... ] } — gộp theo từng Ấp để diễn giải xuống dòng riêng biệt.
    function detectDuplicates(){
      const dupByHamlet = {};
      selHamlets.forEach(h=>{
        selQuarters.forEach(q=>{
          const matches = state.expenses.filter(e=> !e.deleted && isCatHamlet(e.purpose) && e.hamlet===h && e.id!==e0.id &&
            Array.isArray(e.quarters) && e.quarters.some(x=>x.qk===q.qk && x.year===q.year));
          if(matches.length){
            const totalAmt = matches.reduce((s,m)=>s+(parseFloat(m.amount)||0),0);
            const t = TIMELINE_SEQ[timelineSeqIndex(`${q.qk}_${q.year}`)];
            if(!dupByHamlet[h]) dupByHamlet[h] = [];
            dupByHamlet[h].push({ qLabel: t? t.label : `${q.qk}/${q.year}`, amount: totalAmt });
          }
        });
      });
      return dupByHamlet;
    }
    // Soạn nội dung cảnh báo trùng lặp dạng văn bản THUẦN (dùng chung cho cả hiển thị màu đỏ lẫn hộp
    // thoại xác nhận khi bấm Lưu) — mỗi Ấp 1 dòng riêng, phân cách bằng xuống dòng cho dễ đọc.
    function duplicateWarningText(){
      const dup = detectDuplicates();
      const hamletNames = Object.keys(dup);
      if(!hamletNames.length) return '';
      const detail = hamletNames.map(h=>{
        const items = dup[h].map(x=> `${x.qLabel} với số tiền là ${money(x.amount)}`).join(', ');
        return `Trong sổ đã chi "Trích về" cho ${subAdminLabel()} ${h} tại ${items}.`;
      }).join('\n');
      return `PHÁT HIỆN TRÙNG LẶP TRONG SỔ CHI\n${detail}`;
    }
    function duplicateWarningHtml(){
      const text = duplicateWarningText();
      if(!text) return '';
      return `<p class="em-dup-warning" style="color:var(--red); font-weight:700; margin:8px 0 0; white-space:pre-line;">⚠️ ${escapeHtml(text)}</p>`;
    }
    function computeAutoAmountFor(hamletName){
      if(!selQuarters.length) return 0;
      return computeInterestIncomeStats([hamletName], selQuarters).hamletTotal;
    }
    function autoPreviewHtml(){
      if(!selHamlets.length || !selQuarters.length) return `<p class="sub" style="color:var(--red);">Vui lòng chọn ít nhất 1 ${subAdminLabelLower()} và ít nhất 1 Quý để hệ thống tính số tiền tự động.</p>`;
      const rows = selHamlets.map(h=> `<div class="kv-row"><span>${escapeHtml(h)}</span><b>${money(computeAutoAmountFor(h))}</b></div>`).join('');
      const total = selHamlets.reduce((s,h)=> s+computeAutoAmountFor(h), 0);
      return `<div style="border:1px solid var(--line); border-radius:8px; padding:8px 12px; background:var(--paper-2);">${rows}${selHamlets.length>1? `<div class="kv-row" style="border-top:1px solid var(--line); margin-top:4px; padding-top:6px;"><span><b>Tổng cộng</b></span><b>${money(total)}</b></div>`:''}</div>`;
    }
    function manualTableHtml(){
      if(selHamlets.length<=1) return ''; // 1 địa bàn (hoặc 0) thì dùng thẳng ô "Số tiền chi" chung, không cần bảng riêng
      return `<div style="border:1px solid var(--line); border-radius:8px; padding:8px 12px;">
        <p class="sub" style="margin:0 0 6px;">Nhập riêng số tiền cho từng ${subAdminLabelLower()} (không tự chia đều, tránh sai lệch):</p>
        ${selHamlets.map((h,hi)=>`<div class="field" style="margin-bottom:6px;"><label>${escapeHtml(h)} <span class="sub" id="em-hamlet-manual-disp-${hi}" style="font-weight:700; color:#b71c1c;"></span></label><input type="text" inputmode="numeric" class="em-hamlet-manual-amt" data-h="${escapeHtml(h)}" data-idx="${hi}" value="" placeholder="Chỉ nhập số" ${readonly?'disabled':''}></div>`).join('')}
      </div>`;
    }
    function attachmentSectionHtml(){
      const chips = attachments.map((a,i)=> a.storageUrl
        ? `<a href="${a.storageUrl}" target="_blank" rel="noopener" class="ai-attach-chip" style="text-decoration:none;">📎 ${escapeHtml(a.name)}${!readonly? ` <button type="button" class="preview-allow" data-em-attach-remove="${i}" style="background:none; border:none; cursor:pointer; color:var(--red); font-weight:800;" onclick="event.stopPropagation();">✕</button>` : ''}</a>`
        : `<span class="ai-attach-chip">⏳ ${escapeHtml(a.name)} (đang tải lên...) <button type="button" class="preview-allow" data-em-attach-cancel="${i}" title="Huỷ tải lên" style="background:none; border:none; cursor:pointer; color:var(--red); font-weight:800;" onclick="event.stopPropagation();">✕</button></span>`
      ).join('');
      return `
        <div class="field full">
          <label>Ảnh/Tệp tin đính kèm <span class="sub">(tối đa ${MAX_ATTACH} tệp — bấm vào tên tệp để xem/tải về)</span></label>
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">${chips}</div>
          ${!readonly? `
            <input type="file" id="em-attach-input" multiple accept="*/*" style="display:none;">
            <button type="button" class="btn btn-ghost btn-sm preview-allow" id="em-attach-add-btn" ${attachments.length>=MAX_ATTACH?'disabled':''}>➕ Thêm ảnh/tệp tin</button>
            ${attachments.length>=MAX_ATTACH? `<span class="sub" style="color:var(--red); margin-left:8px;">Đã đạt tối đa ${MAX_ATTACH} tệp.</span>` : ''}
          ` : ''}
        </div>`;
    }
    function renderHamletSection(){
      return `
        <div class="field full" id="em-hamlet-wrap" style="${currentPurpose===CAT_HAMLET?'':'display:none;'}">
          <label>Trích về cho ${subAdminLabelLower()} nào * ${isNew? `<button type="button" class="btn btn-ghost btn-sm preview-allow" id="em-hamlet-all-btn" style="margin-left:8px;">Chọn tất cả</button>` : ''}</label>
          ${selectedHamletsCaptionHtml()}
          <div style="border:1px solid var(--line); border-radius:8px; padding:8px 12px; max-height:180px; overflow:auto;">${hamletChecksHtml()}</div>
          ${!isNew? `<p class="sub" style="margin:4px 0 0;">Đang sửa 1 khoản chi đã có sẵn — chỉ áp dụng cho đúng 1 ${subAdminLabelLower()} này. Muốn chi cho nhiều ${subAdminLabelLower()} khác, hãy tạo khoản chi mới.</p>` : ''}
        </div>
        <div class="field full" id="em-quarter-wrap" style="${currentPurpose===CAT_HAMLET?'':'display:none;'}">
          <label>Áp dụng cho Quý nào * <span class="sub">(có thể chọn nhiều Quý bất kỳ, không cần liền kề nhau)</span></label>
          ${selectedQuartersCaptionHtml()}
          ${quarterDropdownHtml()}
          ${duplicateWarningHtml()}
        </div>
        <div class="field full" id="em-amountmode-wrap" style="${currentPurpose===CAT_HAMLET?'':'display:none;'}">
          <label>Cách tính số tiền *</label>
          <div style="display:flex; gap:16px; margin-bottom:8px;">
            <label><input type="radio" name="em-amountmode" value="auto" ${amountMode==='auto'?'checked':''} ${readonly?'disabled':''}> Dùng đúng số tự động theo công thức (khớp Sổ vay vốn)</label>
            <label><input type="radio" name="em-amountmode" value="manual" ${amountMode==='manual'?'checked':''} ${readonly?'disabled':''}> Nhập số cụ thể khác</label>
          </div>
          <div id="em-auto-preview">${amountMode==='auto'? autoPreviewHtml() : ''}</div>
          <div id="em-manual-table">${amountMode==='manual'? manualTableHtml() : ''}</div>
        </div>`;
    }
    wrap.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>${isNew?'Thêm khoản chi mới':'Chi tiết khoản chi'}</h3><button class="modal-close" id="em-close">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field"><label>Ngày chi *</label><input type="date" id="em-date" value="${e0.date}" ${readonly?'disabled':''}></div>
            <div class="field" id="em-amount-wrap" style="${e0.purpose===CAT_HAMLET?'display:none;':''}"><label>Số tiền chi (đ) * <span class="sub">(tối đa 12 số)</span> <span class="sub" id="em-amount-disp" style="font-weight:700; color:#b71c1c;"></span></label><input type="text" inputmode="numeric" id="em-amount" value="${e0.amount||''}" placeholder="Chỉ nhập số, vd: 5000000" ${readonly?'disabled':''}></div>
            <div class="field full"><label>Nội dung công việc / Mục đích chi *</label>
              <select id="em-purpose" ${readonly?'disabled':''}>${EXPENSE_CATEGORIES.map(c=>`<option value="${c}" ${e0.purpose===c?'selected':''}>${categoryLabel(c)}</option>`).join('')}</select>
            </div>
            <div id="em-hamlet-section">${renderHamletSection()}</div>
            <div class="field full" id="em-other-wrap" style="${e0.purpose===CAT_OTHER?'':'display:none;'}">
              <label>Nội dung mục chi khác (ghi rõ) *</label>
              <input id="em-other" value="${e0.purposeOther||''}" placeholder="Ví dụ: Sửa chữa trụ sở..." ${readonly?'disabled':''}>
            </div>
            <div class="field full"><label>Ghi chú chi tiết (người nhận tiền, số hoá đơn/biên nhận...)</label><textarea id="em-note" rows="2" ${readonly?'disabled':''}>${e0.note||''}</textarea></div>
            <div id="em-attach-section">${attachmentSectionHtml()}</div>
          </div>
        </div>
        <div class="modal-foot">
          ${(!isNew && canEditModule('data')) ? `<button class="btn btn-danger" id="em-delete" style="margin-right:auto;">Xoá (chuyển vào thùng rác)</button>` : ''}
          <button class="btn btn-ghost" id="em-cancel">Đóng</button>
          ${canEditModule('data') ? `<button class="btn btn-primary" id="em-save">${isNew?'Thêm khoản chi':'Lưu thay đổi'}</button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=>{ wrap.remove(); state.modal=null; };
    wrap.querySelector('#em-close').onclick = close;
    wrap.querySelector('#em-cancel').onclick = close;
    wrap.onclick = (ev)=>{ if(ev.target===wrap) close(); };

    function refreshHamletSection(){
      wrap.querySelector('#em-hamlet-section').innerHTML = renderHamletSection();
      wireHamletSection();
    }
    function wireManualTable(){
      wrap.querySelectorAll('.em-hamlet-manual-amt').forEach(inp=>{
        attachMoneyInputMask(inp, 12);
        const idx = inp.dataset.idx;
        const dispEl = wrap.querySelector(`#em-hamlet-manual-disp-${idx}`);
        const update = ()=>{ const digits = inp.value.replace(/[^\d]/g,''); if(dispEl) dispEl.textContent = digits? `= ${groupDigitsRight(digits,3)} đ` : ''; };
        inp.addEventListener('input', update);
        update();
      });
    }
    function refreshAttachSection(){
      wrap.querySelector('#em-attach-section').innerHTML = attachmentSectionHtml();
      wireAttachSection();
    }
    function wireAttachSection(){
      const addBtn = wrap.querySelector('#em-attach-add-btn');
      const fileInput = wrap.querySelector('#em-attach-input');
      if(addBtn && fileInput) addBtn.onclick = ()=> fileInput.click();
      if(fileInput) fileInput.onchange = async ()=>{
        const files = Array.from(fileInput.files||[]);
        fileInput.value = '';
        if(!files.length) return;
        const room = MAX_ATTACH - attachments.length;
        if(room<=0){ alert(`Đã đạt tối đa ${MAX_ATTACH} tệp đính kèm.`); return; }
        const toUpload = files.slice(0, room);
        if(files.length>room) alert(`Chỉ còn chỗ cho ${room} tệp nữa (giới hạn ${MAX_ATTACH} tệp) — ${files.length-room} tệp cuối đã bị bỏ qua.`);
        // Hiện NGAY các chip "đang tải lên..." (chưa có storageUrl) để người dùng thấy phản hồi tức thì,
        // rồi tải LẦN LƯỢT từng tệp lên Storage chung của xã/phường — xong tệp nào thì cập nhật chip đó
        // ngay, không cần chờ tất cả xong mới hiện. Mỗi placeholder giữ tham chiếu tới UploadTask THẬT
        // của Firebase (hỗ trợ .cancel() giữa chừng) để nút X có thể huỷ đang tải, không chỉ ẩn đi.
        const placeholders = toUpload.map(f=> ({ name:f.name, storagePath:'', storageUrl:'', mimeType:f.type||'', size:f.size, uploadTask:null, cancelled:false }));
        attachments = attachments.concat(placeholders);
        refreshAttachSection();
        for(let i=0;i<toUpload.length;i++){
          const f = toUpload[i];
          const placeholderIdx = attachments.length - toUpload.length + i;
          const ph = attachments[placeholderIdx];
          if(ph.cancelled) continue; // đã bị bấm huỷ trước khi kịp bắt đầu tải tệp này
          try{
            const fid = uid();
            const storagePath = `expense_attachments/${wardId()}/${e0.id}/${fid}_${f.name}`;
            const stRef = storage.ref(storagePath);
            const uploadTask = stRef.put(f);
            ph.uploadTask = uploadTask; ph.storagePath = storagePath;
            await uploadTask;
            if(ph.cancelled) continue; // vừa bị huỷ đúng lúc tải xong — không thêm vào danh sách nữa (đã tự xoá trên Storage ở nút huỷ)
            const storageUrl = await stRef.getDownloadURL();
            const curIdx = attachments.indexOf(ph);
            if(curIdx>=0 && !ph.cancelled) attachments[curIdx] = { name:f.name, storagePath, storageUrl, mimeType:f.type||'', size:f.size };
          }catch(err){
            const curIdx = attachments.indexOf(ph);
            if(curIdx>=0) attachments.splice(curIdx, 1);
            // Bị huỷ chủ động (bấm nút X) -> im lặng, không phải lỗi thật, khỏi báo.
            if(!(err && (err.code==='storage/canceled' || ph.cancelled))){
              console.error('Tải tệp đính kèm lỗi:', err);
              alert(`Tải tệp "${f.name}" lên thất bại: ${err&&err.message||err}`);
            }
          }
          refreshAttachSection();
        }
      };
      wrap.querySelectorAll('[data-em-attach-remove]').forEach(btn=> btn.onclick = async (ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        const idx = parseInt(btn.dataset.emAttachRemove,10);
        const a = attachments[idx];
        if(!confirm(`Xoá tệp đính kèm "${a.name}"?`)) return;
        if(a.storagePath){ try{ await storage.ref(a.storagePath).delete(); }catch(e){ console.warn('Xoá tệp trên Storage lỗi (bỏ qua):', e); } }
        attachments = attachments.filter((x,i)=>i!==idx);
        refreshAttachSection();
      });
      // Nút X huỷ tệp ĐANG TẢI LÊN dở dang — dừng hẳn UploadTask + xoá luôn phần dữ liệu dở dang (nếu
      // có) trên Storage chung của xã/phường, không để lại rác.
      wrap.querySelectorAll('[data-em-attach-cancel]').forEach(btn=> btn.onclick = async (ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        const idx = parseInt(btn.dataset.emAttachCancel,10);
        const ph = attachments[idx];
        if(!ph) return;
        ph.cancelled = true;
        if(ph.uploadTask){ try{ ph.uploadTask.cancel(); }catch(e){} }
        if(ph.storagePath){ try{ await storage.ref(ph.storagePath).delete(); }catch(e){ /* chưa kịp có gì trên Storage, bỏ qua */ } }
        const curIdx = attachments.indexOf(ph);
        if(curIdx>=0) attachments.splice(curIdx, 1);
        refreshAttachSection();
      });
    }
    wireAttachSection();
    function wireHamletSection(){
      const allBtn = wrap.querySelector('#em-hamlet-all-btn');
      if(allBtn) allBtn.onclick = ()=>{ selHamlets = hamlets.slice(); refreshHamletSection(); };
      wrap.querySelectorAll('.em-hamlet-cb').forEach(cb=> cb.onchange = ()=>{
        const h = cb.dataset.h;
        selHamlets = cb.checked ? selHamlets.concat([h]) : selHamlets.filter(x=>x!==h);
        refreshHamletSection();
      });
      // Menu thả xuống chọn Quý — TỰ DO, không ràng buộc liền kề: chọn/bỏ chọn đơn giản từng mục, có thể
      // chọn nhiều Quý cách xa nhau tuỳ ý.
      const qddBtn = wrap.querySelector('#em-quarter-dd-btn');
      if(qddBtn) qddBtn.onclick = (e)=>{ e.stopPropagation(); quarterDropdownOpen = !quarterDropdownOpen; refreshHamletSection(); };
      wrap.querySelectorAll('.em-quarter-dd-item').forEach(cb=> cb.onclick = (e)=>{
        e.stopPropagation();
        const qk = cb.dataset.qk, year = parseInt(cb.dataset.year,10);
        if(cb.checked) selQuarters = selQuarters.concat([{qk,year}]);
        else selQuarters = selQuarters.filter(x=> !(x.qk===qk && x.year===year));
        refreshHamletSection();
      });
      const qddResetBtn = wrap.querySelector('#em-quarter-dd-reset-btn');
      if(qddResetBtn) qddResetBtn.onclick = (e)=>{ e.stopPropagation(); selQuarters = [{ qk: todayBasedQuarterKey(), year: new Date().getFullYear() }]; refreshHamletSection(); };
      // Mở dropdown -> tự cuộn tới đúng mốc đang chọn, kèm 2 nút cuộn mũi tên (y hệt cơ chế dùng chung
      // toàn app: rê chuột vào/bấm giữ -> cuộn liên tục; bấm nhanh 1 cái -> cuộn 1 đoạn ngắn).
      const qddPanel = wrap.querySelector('#em-quarter-dd-panel');
      if(qddPanel){
        const selEl = qddPanel.querySelector('[data-selected-timeline]');
        if(selEl) selEl.scrollIntoView({ block:'center' });
        const wireScrollBtn = (btn2, dir)=>{
          if(!btn2) return;
          let timer=null, downAt=0;
          const start=()=>{ if(timer) return; timer=setInterval(()=>{ qddPanel.scrollTop += dir*3; }, 16); };
          const stop=()=>{ if(timer){ clearInterval(timer); timer=null; } };
          btn2.addEventListener('mouseenter', start);
          btn2.addEventListener('mouseleave', stop);
          btn2.addEventListener('mousedown', (e)=>{ e.preventDefault(); e.stopPropagation(); downAt=Date.now(); start(); });
          btn2.addEventListener('touchstart', (e)=>{ e.stopPropagation(); downAt=Date.now(); start(); }, {passive:true});
          document.addEventListener('mouseup', stop);
          document.addEventListener('touchend', stop);
          btn2.addEventListener('click', (e)=>{ e.stopPropagation(); if(Date.now()-downAt<260) qddPanel.scrollBy({ top: dir*140, behavior:'smooth' }); });
        };
        wireScrollBtn(wrap.querySelector('#em-quarter-dd-up-btn'), -1);
        wireScrollBtn(wrap.querySelector('#em-quarter-dd-down-btn'), 1);
      }
      wrap.querySelectorAll('input[name="em-amountmode"]').forEach(r=> r.onchange = ()=>{
        amountMode = r.value;
        wrap.querySelector('#em-auto-preview').innerHTML = amountMode==='auto'? autoPreviewHtml() : '';
        wrap.querySelector('#em-manual-table').innerHTML = amountMode==='manual'? manualTableHtml() : '';
        if(amountMode==='manual') wireManualTable();
      });
      wireManualTable();
      // Bấm ra ngoài dropdown Quý -> tự đóng lại (gắn 1 lần duy nhất cho cả modal này).
      if(!wrap._emQuarterDdOutsideClickBound){
        wrap._emQuarterDdOutsideClickBound = true;
        wrap.addEventListener('click', (e)=>{
          if(!quarterDropdownOpen) return;
          if(e.target.closest('.sv-filter-dropdown')) return;
          quarterDropdownOpen = false;
          refreshHamletSection();
        });
      }
    }
    wireHamletSection();

    // "Số tiền chi (đ)" — y hệt trường "Tổng vốn" ở Sổ vay vốn: nhãn "= X đ" màu đỏ đậm đồng bộ thời
    // gian thực ngay bên cạnh nhãn trường, ô nhập chỉ nhận chữ số, tối đa 12 số, tự tách cụm 3 số khi
    // rời khỏi ô (blur), trả về dạng thô khi bấm vào lại (focus) để dễ sửa.
    (function(){
      const amtInput = wrap.querySelector('#em-amount');
      const amtDisp = wrap.querySelector('#em-amount-disp');
      attachMoneyInputMask(amtInput, 12);
      const updateAmtDisp = ()=>{
        const digits = amtInput.value.replace(/[^\d]/g,'');
        if(amtDisp) amtDisp.textContent = digits ? `= ${groupDigitsRight(digits,3)} đ` : '';
      };
      amtInput.addEventListener('input', updateAmtDisp);
      updateAmtDisp();
    })();

    const purposeSel = wrap.querySelector('#em-purpose');
    purposeSel.onchange = ()=>{
      currentPurpose = purposeSel.value; // đồng bộ giá trị ĐANG chọn thật sự — để renderHamletSection() sau này (khi tích chọn ấp/quý) đọc đúng, không bị "tự đóng lại" do đọc nhầm giá trị cũ e0.purpose
      const isHam = isCatHamlet(purposeSel.value);
      wrap.querySelector('#em-hamlet-wrap').style.display = isHam ? '' : 'none';
      wrap.querySelector('#em-quarter-wrap').style.display = isHam ? '' : 'none';
      wrap.querySelector('#em-amountmode-wrap').style.display = isHam ? '' : 'none';
      wrap.querySelector('#em-amount-wrap').style.display = isHam ? 'none' : '';
      wrap.querySelector('#em-other-wrap').style.display = purposeSel.value===CAT_OTHER ? '' : 'none';
    };

    const delBtn = wrap.querySelector('#em-delete');
    if(delBtn) delBtn.onclick = async ()=>{
      if(state.previewMode){ alert('Bạn đang ở chế độ tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
      if(!confirm('Chuyển khoản chi này vào thùng rác?')) return;
      state.expenses = state.expenses.filter(x=>x.id!==e0.id);
      const trashed = {...e0, _kind:'expense', deleted:true, deletedAt:new Date().toISOString(), deletedBy: state.identity.email, deletedByName: state.identity.name};
      state.trash.push(trashed);
      await cRemoveRecord('expenses', e0.id);
      await cSetRecord('trash', trashed.id, trashed);
      await pushLog('xoá khoản chi', `${money(e0.amount)} — ${categoryLabel(e0.purpose)}`);
      close(); render();
    };

    const saveBtn = wrap.querySelector('#em-save');
    if(saveBtn) saveBtn.onclick = async ()=>{
      if(state.previewMode){ alert('Bạn đang ở chế độ tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
      const date = wrap.querySelector('#em-date').value;
      const purpose = wrap.querySelector('#em-purpose').value;
      const purposeOther = wrap.querySelector('#em-other').value.trim();
      const note = wrap.querySelector('#em-note').value.trim();
      if(!date){ alert('Vui lòng chọn ngày chi.'); return; }
      if(purpose===CAT_OTHER && !purposeOther){ alert('Vui lòng ghi rõ nội dung mục chi khác.'); return; }

      if(isCatHamlet(purpose)){
        // ---- Hạng mục "Trích về Khu dân cư/Ấp" — có thể tạo ra NHIỀU khoản chi cùng lúc (1 dòng riêng
        // cho mỗi địa bàn đã chọn), để sau này đối chiếu rõ ràng từng địa bàn một. ----
        if(!selHamlets.length){ alert(`Vui lòng chọn ít nhất 1 ${subAdminLabelLower()} nhận tiền.`); return; }
        if(!selQuarters.length){ alert('Vui lòng chọn ít nhất 1 Quý áp dụng.'); return; }
        const dupText = duplicateWarningText();
        if(dupText){
          const ok = confirm(`⚠️ ${dupText}\n\nBạn có chắc chắn vẫn muốn tiếp tục thêm khoản chi này không? Nếu tiếp tục, sổ sách sẽ ghi nhận trùng lặp cho ${selHamlets.length>1?'các':'1'} ${subAdminLabelLower()}/Quý nêu trên (bấm OK để vẫn lưu, bấm Huỷ để quay lại chỉnh sửa).`);
          if(!ok) return;
        }
        const perHamletAmount = {};
        if(amountMode==='auto'){
          selHamlets.forEach(h=> perHamletAmount[h] = Math.round(computeAutoAmountFor(h)));
        } else {
          let ok = true;
          selHamlets.forEach(h=>{
            const inp = wrap.querySelector(`.em-hamlet-manual-amt[data-h="${CSS.escape(h)}"]`);
            const v = inp? parseVNMoney(inp.value) : parseVNMoney(wrap.querySelector('#em-amount')?.value);
            if(v<=0) ok = false;
            perHamletAmount[h] = v;
          });
          if(!ok){ alert('Vui lòng nhập số tiền hợp lệ (lớn hơn 0) cho tất cả các địa bàn đã chọn.'); return; }
        }
        if(attachments.some(a=>!a.storageUrl)){ alert('Có ảnh hoặc tệp tin đang tải lên, vui lòng đợi quá trình tải lên hoàn tất, hoặc xoá ảnh/tệp tin đang tải lên đó, rồi mới bấm Lưu.'); return; }
        if(isNew){
          for(const h of selHamlets){
            const rec = { id: uid(), date, purpose: CAT_HAMLET, purposeOther:'', hamlet:h, quarters: selQuarters.slice(), amountMode, amount: perHamletAmount[h], note, attachments };
            state.expenses.push(rec);
            await cSetRecord('expenses', rec.id, rec);
          }
          await pushLog('thêm khoản chi', `Trích về ${subAdminLabelLower()} — ${selHamlets.length} địa bàn`);
          showBigToast('✅ Đã thêm khoản chi mới thành công!');
        } else {
          const h = selHamlets[0];
          const updated = { ...e0, date, purpose: CAT_HAMLET, purposeOther:'', hamlet:h, quarters: selQuarters.slice(), amountMode, amount: perHamletAmount[h], note, attachments };
          state.expenses = state.expenses.map(x=>x.id===updated.id? updated : x);
          await cSetRecord('expenses', updated.id, updated);
          await pushLog('chỉnh sửa khoản chi', `${money(updated.amount)} — Trích về ${h}`);
          showBigToast('✅ Đã lưu thay đổi thành công!');
        }
        close(); render();
        return;
      }

      // ---- Các hạng mục chi khác — giữ nguyên logic cũ ----
      const amount = parseVNMoney(wrap.querySelector('#em-amount').value);
      if(!amount || amount<=0){ alert('Vui lòng nhập số tiền chi hợp lệ.'); return; }
      if(attachments.some(a=>!a.storageUrl)){ alert('Có ảnh hoặc tệp tin đang tải lên, vui lòng đợi quá trình tải lên hoàn tất, hoặc xoá ảnh/tệp tin đang tải lên đó, rồi mới bấm Lưu.'); return; }
      const updated = { ...e0, date, amount, purpose, hamlet:'', quarters:[], amountMode:'manual', purposeOther: purpose===CAT_OTHER?purposeOther:'', note, attachments };
      if(isNew){ state.expenses.push(updated); }
      else { state.expenses = state.expenses.map(x=>x.id===updated.id? updated : x); }
      await cSetRecord('expenses', updated.id, updated);
      await pushLog(isNew?'thêm khoản chi':'chỉnh sửa khoản chi', `${money(updated.amount)} — ${categoryLabel(updated.purpose)}`);
      showBigToast(isNew? '✅ Đã thêm khoản chi mới thành công!' : '✅ Đã lưu thay đổi thành công!');
      close(); render();
    };
  }

  // =====================================================================
  // Modal "📈 Thống kê Thu Chi chi tiết" — cho phép chọn NHIỀU kỳ (Quý/Năm) để so sánh CẠNH NHAU, có
  // bộ lọc Địa phương riêng cho hạng mục "Trích về Khu dân cư/Ấp" (ảnh hưởng cả cột Thu lẫn cột Chi
  // tương ứng, để xem đúng phạm vi 1 hoặc vài địa phương cụ thể nếu cần).
  // =====================================================================
  function expenseStatsPeriodChoices(){
    const curYear = new Date().getFullYear();
    const out = [
      { key:'all', label:'Từ trước đến nay', from:'2000-01-01', to: todayStr() },
    ];
    [curYear, curYear-1].forEach(y=>{
      const q4r = resolveQuarterDates('q4'), q1r = resolveQuarterDates('q1');
      out.push({ key:'y'+y, label:`Cả năm ${y}`, from: `${y}-01-01`, to: `${y}-12-31` });
      ['q1','q2','q3','q4'].forEach(qk=>{
        // Ước lượng khoảng ngày của Quý qk năm y — dùng đúng công thức đã sửa ở acctPeriodRange.
        const item = (state.config.quarters && state.config.quarters[qk]) || DEFAULT_QUARTERS[qk];
        const pad = n=> String(n).padStart(2,'0');
        const startYear = (item.startMonth > item.endMonth) ? y-1 : y;
        out.push({ key:qk+'_'+y, label:`${qk.toUpperCase()}/${y}`, from:`${startYear}-${pad(item.startMonth)}-${pad(item.startDay)}`, to:`${y}-${pad(item.endMonth)}-${pad(item.endDay)}` });
      });
    });
    return out;
  }
  function renderExpenseStatsModal(){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    const periodChoices = expenseStatsPeriodChoices();
    if(!state.expStatsSelectedPeriods || !state.expStatsSelectedPeriods.length) state.expStatsSelectedPeriods = ['y'+new Date().getFullYear()];
    const hamlets = state.config.hamlets||[];
    if(!state.expStatsFilterHamlets) state.expStatsFilterHamlets = hamlets.slice();
    const hamletAllSel = state.expStatsFilterHamlets.length===hamlets.length;
    function render(){
      const selPeriods = periodChoices.filter(p=> state.expStatsSelectedPeriods.includes(p.key));
      const hamletFilter = hamletAllSel? null : state.expStatsFilterHamlets;
      const periodStats = selPeriods.map(p=>{
        const acct = computeAcctTotals(p.from, p.to);
        // Nếu có lọc địa phương -> tính lại riêng "Thu" theo đúng phạm vi địa phương đã chọn (Chi các
        // hạng mục KHÔNG phải "Trích về Khu dân cư/Ấp" thì giữ nguyên, vì các hạng mục đó vốn không
        // gắn với 1 địa phương cụ thể nào).
        let xaNhan = acct.xaNhan, chiTotal = acct.chiTotal, chiByCategory = acct.chiByCategory;
        if(hamletFilter){
          const quarterSet = quarterSetFromDateRange(p.from, p.to);
          const stats = computeInterestIncomeStats(hamletFilter, quarterSet);
          xaNhan = Math.round(stats.ward);
          const filteredHamletChi = Object.entries(acct.chiByHamlet||{}).filter(([h])=>hamletFilter.includes(h)).reduce((s,[,v])=>s+v,0);
          chiByCategory = {...acct.chiByCategory, [CAT_HAMLET]: filteredHamletChi};
          chiTotal = Object.entries(acct.chiByCategory).reduce((s,[k,v])=> s + (k===CAT_HAMLET? filteredHamletChi : v), 0);
        }
        return { p, xaNhan, chiTotal, chiByCategory, tonQuy: xaNhan - chiTotal };
      });
      const catList = EXPENSE_CATEGORIES.filter(c=>c!==CAT_OTHER);
      const otherKeysAcrossPeriods = Array.from(new Set(periodStats.flatMap(ps=> Object.keys(ps.chiByCategory).filter(k=>k.startsWith(CAT_OTHER+':')))));
      const rowsHtml = [
        `<tr style="background:var(--paper-2); font-weight:800;"><td>💰 Thu (${adminLevelLabel()} nhận)</td>${periodStats.map(ps=>`<td class="money">${money(ps.xaNhan)}</td>`).join('')}</tr>`,
        ...catList.map(c=> `<tr><td>↳ Chi: ${categoryLabel(c)}</td>${periodStats.map(ps=>{ const v=ps.chiByCategory[c]||0; const pct = ps.chiTotal>0? (v/ps.chiTotal*100).toFixed(1) : '0'; return `<td class="money">${money(v)} <span class="sub">(${pct}%)</span></td>`; }).join('')}</tr>`),
        ...otherKeysAcrossPeriods.map(k=> `<tr><td>↳ Chi: ${escapeHtml(k.replace(CAT_OTHER+':',categoryLabel(CAT_OTHER)+': '))}</td>${periodStats.map(ps=>{ const v=ps.chiByCategory[k]||0; const pct = ps.chiTotal>0? (v/ps.chiTotal*100).toFixed(1) : '0'; return `<td class="money">${money(v)} <span class="sub">(${pct}%)</span></td>`; }).join('')}</tr>`),
        `<tr style="background:var(--paper-2); font-weight:800;"><td>📤 Tổng Chi</td>${periodStats.map(ps=>`<td class="money">${money(ps.chiTotal)}</td>`).join('')}</tr>`,
        `<tr style="font-weight:800;"><td>⚖️ Tồn quỹ (Thu − Chi)</td>${periodStats.map(ps=>`<td class="money" style="color:${ps.tonQuy>=0?'var(--green)':'var(--red)'};">${money(ps.tonQuy)}</td>`).join('')}</tr>`,
      ].join('');
      const bodyHtml = `
        <p class="sub" style="margin:0 0 10px;">Chọn 1 hoặc nhiều kỳ (Quý/Năm) để xem và so sánh cạnh nhau — mỗi kỳ hiển thị đúng số liệu Thu/Chi/Tồn quỹ riêng của kỳ đó.</p>
        <div style="display:flex; flex-wrap:wrap; gap:4px 16px; border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-bottom:10px;">
          ${periodChoices.map(p=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow exps-period-cb" data-key="${p.key}" ${state.expStatsSelectedPeriods.includes(p.key)?'checked':''}><span>${p.label}</span></label>`).join('')}
        </div>
        <div class="sv-filter-dropdown" style="margin-bottom:10px;">
          <button type="button" class="btn btn-ghost btn-sm preview-allow" id="exps-hamlet-btn" style="${!hamletAllSel?'border:2px solid #b71c1c;':''}">📍 Địa phương (${state.expStatsFilterHamlets.length}) — chỉ ảnh hưởng "Trích về ${subAdminLabelLower()}"</button>
          ${state.openFilterDropdown==='exps-hamlet'? `<div class="sv-filter-panel">
            <label class="sv-filter-item"><input type="checkbox" id="exps-hamlet-all" class="preview-allow" ${hamletAllSel?'checked':''}><span><b>Tất cả địa phương</b></span></label>
            ${hamlets.map(h=>`<label class="sv-filter-item"><input type="checkbox" class="preview-allow exps-hamlet-item" data-h="${escapeHtml(h)}" ${state.expStatsFilterHamlets.includes(h)?'checked':''}><span>${escapeHtml(h)}</span></label>`).join('')}
          </div>` : ''}
        </div>
        ${!selPeriods.length? `<div class="empty-state"><div class="e-ico">📈</div>Vui lòng chọn ít nhất 1 kỳ để xem thống kê</div>` : `
        <div class="table-wrap"><table>
          <thead><tr><th>Hạng mục</th>${periodStats.map(ps=>`<th>${escapeHtml(ps.p.label)}</th>`).join('')}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table></div>`}
      `;
      const bodyEl = wrap.querySelector('#exps-body-inner');
      if(bodyEl){ bodyEl.innerHTML = bodyHtml; wire(); return; }
      wrap.innerHTML = `
        <div class="modal" style="max-width:98vw; width:900px; border:6px solid #6a1b9a;">
          <div class="modal-head" style="background:linear-gradient(180deg, #ba68c8 0%, #6a1b9a 50%, #4a148c 100%);"><h3 style="color:#fff;">${waveTextHtmlSlow('📈 Thống kê Thu Chi chi tiết')}</h3><button class="modal-close preview-allow" id="exps-close">✕</button></div>
          <div class="modal-body" style="max-height:78vh; overflow:auto;" id="exps-body-inner">${bodyHtml}</div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="exps-close2">Đóng bảng</button>
            ${exportPrintButtonsHtml('exps-ep')}
          </div>
        </div>`;
      wrap.querySelector('#exps-close').onclick = close;
      wrap.querySelector('#exps-close2').onclick = close;
      wire();
    }
    function wire(){
      wrap.querySelectorAll('.exps-period-cb').forEach(cb=> cb.onchange = ()=>{
        const k = cb.dataset.key;
        state.expStatsSelectedPeriods = cb.checked? state.expStatsSelectedPeriods.concat([k]) : state.expStatsSelectedPeriods.filter(x=>x!==k);
        render();
      });
      const hb = wrap.querySelector('#exps-hamlet-btn'); if(hb) hb.onclick=(e)=>{ e.stopPropagation(); state.openFilterDropdown = state.openFilterDropdown==='exps-hamlet'?null:'exps-hamlet'; render(); };
      const hAll = wrap.querySelector('#exps-hamlet-all'); if(hAll) hAll.onclick=(e)=>{ e.stopPropagation(); state.expStatsFilterHamlets = hAll.checked? hamlets.slice() : []; render(); };
      wrap.querySelectorAll('.exps-hamlet-item').forEach(cb=> cb.onclick=(e)=>{ e.stopPropagation(); const h=cb.dataset.h; state.expStatsFilterHamlets = cb.checked? state.expStatsFilterHamlets.concat([h]) : state.expStatsFilterHamlets.filter(x=>x!==h); render(); });
      wireExportPrintButtons(wrap, 'exps-ep', '#exps-body-inner', 'Thống kê Thu Chi chi tiết');
      if(!wrap._expsOutsideClickBound){
        wrap._expsOutsideClickBound = true;
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

  function renderInternalTab(el){
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🔒 Thu – Chi nội bộ</h3></div>
        <div class="panel-body">
          <div class="empty-state">
            <div class="e-ico">🚧</div>
            <p style="max-width:480px; margin:0 auto;">Dữ liệu của Thu – Chi nội bộ được lưu <b>chỉ trên máy tính này</b> (bằng bộ nhớ cục bộ của trình duyệt), <b>không</b> đưa lên cơ sở dữ liệu đám mây Firebase như các mục còn lại của phần mềm, đảm bảo tính riêng tư tuyệt đối và không đồng bộ giữa các thiết bị.</p>
            <p style="font-weight:700; color:var(--rice-dark); margin-top:14px; letter-spacing:.02em;">TÍNH NĂNG NÀY ĐANG ĐƯỢC NÂNG CẤP</p>
          </div>
        </div>
      </div>`;
  }

  function buildPropagandaHtml(chat, provider){
    const welcomeHtml = `<div class="ai-bubble assistant">Chào bạn! Chàng là "Chàng Nông dân Thông minh" 📣 — hôm nay Chàng đóng vai <b>Biên tập viên Tuyên truyền</b>, sẵn sàng giúp bạn tạo:
      <br>📱 Bài viết tuyên truyền mạng xã hội &nbsp; 💬 Tin nhắn Zalo/Messenger &nbsp; 🖼️ Hình ảnh & Poster &nbsp; 🎬 Video tuyên truyền
      <br>🪧 Banner &nbsp; 📢 Kịch bản loa truyền thanh &nbsp; 🖥️ Slide trình chiếu &nbsp; 💡 Khẩu hiệu/Slogan &nbsp; ❓ Hỏi-Đáp tuyên truyền
      <br><br>Bấm nhanh 1 trong các nút bên dưới, hoặc cứ gõ thẳng ý bạn muốn tuyên truyền điều gì nhé!</div>`;
    const messagesHtml = (!chat || !chat.messages.length) ? welcomeHtml : chat.messages.map((m, idx)=> buildPropagandaBubbleHtml(m, idx)).join('');
    const historyHtml = state.propagandaChats.length ? state.propagandaChats.map(c=>`
        <div class="ai-hist-item ${c.id===state.propagandaActiveChatId?'active':''}" data-pg-hist="${c.id}">
          <span class="ai-hist-title">${escapeHtml(c.title||'Bài tuyên truyền mới')}</span>
          <button class="ai-hist-del" data-pg-hist-rename="${c.id}" title="Đổi tên">✏️</button>
          <button class="ai-hist-del" data-pg-hist-del="${c.id}" title="Xoá">🗑️</button>
        </div>`).join('') : '<div class="sub" style="color:rgba(255,255,255,.6); padding:6px 10px;">Chưa có đoạn hội thoại nào.</div>';
    // Lặp lại danh sách lựa chọn NHIỀU LẦN để tạo cảm giác cuộn VÔ HẠN (cuộn hết vòng thì lại vòng tiếp
    // theo giống hệt, không có điểm dừng) — xem cơ chế "nhảy tức thì" ở phần wiring bên dưới. Lựa chọn
    // ĐẦU TIÊN của MỖI khối lặp được đánh dấu riêng (nền khác biệt) để người dùng dễ nhận biết đã cuộn
    // qua bao nhiêu vòng lặp.
    const PG_SUGGEST_REPEAT = 8;
    const oneRoleBlockHtml = PROPAGANDA_ROLES.map((r,i)=>`<button type="button" class="pg-role-btn${i===0?' pg-role-btn-first':''}" data-pg-role="${r.key}">${r.icon} ${escapeHtml(r.label)}</button>`).join('');
    const suggestMenuHtml = state._propagandaSuggestMenuOpen ? `<div class="pg-suggest-menu" id="pg-suggest-menu">
        <div class="pg-suggest-list" id="pg-suggest-list">${Array(PG_SUGGEST_REPEAT).fill(oneRoleBlockHtml).join('')}</div>
        <div class="pg-suggest-scrollbtns">
          <button type="button" class="pg-suggest-scroll-btn preview-allow" id="pg-suggest-up-btn" title="Cuộn lên">▲</button>
          <button type="button" class="pg-suggest-scroll-btn preview-allow" id="pg-suggest-down-btn" title="Cuộn xuống">▼</button>
        </div>
      </div>` : '';
    const rolesHtml = `<div class="pg-suggest-wrap" id="pg-suggest-wrap">
        <button type="button" class="pg-role-btn" id="pg-suggest-toggle-btn">💡 Gợi ý tạo bài</button>
        ${suggestMenuHtml}
      </div>
      <button class="pg-role-btn pg-confirm-btn" id="pg-confirm-create-btn" ${(!chat || !chat.messages || !chat.messages.length)?'disabled style="opacity:.45; cursor:not-allowed;"':''}>🚀 Tạo bài Tuyên truyền ngay!</button>`;
    const modelDropdownHtml = state._propagandaModelMenuOpen ? `<div class="ai-model-dropdown">
        ${state.aiProviders.length ? state.aiProviders.map(p=>`
          <div class="ai-model-opt ${provider&&p.id===provider.id?'active':''}" data-pg-select-provider="${p.id}">
            ${escapeHtml(p.label||p.model)}<span class="sub">${escapeHtml(p.model)}</span>
          </div>`).join('') : `<div class="ai-model-opt sub">Chưa có cấu hình AI nào — vào "CÀI ĐẶT ADMIN" để thêm.</div>`}
      </div>` : '';
    const addMenuHtml = state._propagandaAddMenuOpen ? `<div class="ai-add-menu">
        <div class="ai-add-opt" data-pg-add="image">🖼️ Tải ảnh lên</div>
        <div class="ai-add-opt" data-pg-add="file">📄 Tải tài liệu lên</div>
        <div class="ai-add-opt${state._pgMic2Listening?' ai-add-opt-disabled':''}" data-pg-add="mic">🎤 ${state._pgMicListening? '✅ Đang nghe — bấm để dừng' : 'Vừa nói vừa ra chữ'}</div>
        <div class="ai-add-opt${state._pgMicListening?' ai-add-opt-disabled':''}" data-pg-add="mic2">🎙️ ${state._pgMic2Listening? '✅ Đang nghe — bấm để dừng' : 'Nói xong mới ra chữ'}</div>
      </div>` : '';
    const attachRowHtml = state.propagandaPendingAttachments.length ? `<div class="ai-attach-row">
        ${state.propagandaPendingAttachments.map((a,i)=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)} <button data-pg-attach-remove="${i}">✕</button></span>`).join('')}
      </div>` : '';
    return `
      <div class="ai-sidebar ${state._pgSidebarCollapsed?'collapsed':''}" id="pg-sidebar">
        <button class="ai-exit-btn" id="pg-exit-btn">✕ THOÁT</button>
        <button class="ai-newchat-btn" id="pg-newchat-btn">➕ Đoạn hội thoại mới</button>
        <div class="ai-hist-label">Lịch sử tuyên truyền</div>
        <div class="ai-hist-list">${historyHtml}</div>
        ${!state.identity || !state.identity.email? '<div class="sub" style="color:rgba(255,255,255,.6); padding:8px 10px; font-size:11px;">Bạn đang dùng khách/tham quan — lịch sử chỉ lưu tạm trong phiên này.</div>' : ''}
      </div>
      <button class="ai-sidebar-toggle-btn preview-allow ${state._pgSidebarCollapsed?'collapsed':''}" id="pg-sidebar-toggle-btn" title="${state._pgSidebarCollapsed?'Mở khung lịch sử tuyên truyền':'Đóng khung lịch sử tuyên truyền'}">${state._pgSidebarCollapsed?'▶':'◀'}</button>
      <div class="ai-sidebar-scrim ${!state._pgSidebarCollapsed?'show':''}" id="pg-sidebar-scrim"></div>
      <button class="ai-close-fab preview-allow" id="pg-close-fab" title="Đóng Tạo bài Tuyên truyền">✕</button>
      <div class="ai-main ${state._pgSidebarCollapsed?'ai-sidebar-collapsed':''}" id="pg-main-panel">
        <div class="ai-header">📣 Biên tập viên Tuyên truyền - Chàng Nông dân Thông minh</div>
        ${state.previewMode? `<div class="admin-view-banner" style="background:#7a5b00; color:#fff3cd;">⚠️ Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.</div>` : ''}
        <div class="ai-messages" id="pg-messages">${messagesHtml}</div>
        ${chat && chat.hasVideoRole? `<div style="background:#7a1414; color:#fff; text-align:center; font-weight:800; font-size:13px; padding:10px 14px; margin:0 10% 8px; border-radius:10px; letter-spacing:.2px;">⚠️ CHỨC NĂNG TẠO VIDEO AI LÀ MỘT CHỨC NĂNG CAO CẤP. CHỨC NĂNG NÀY ĐANG ĐƯỢC NÂNG CẤP TRONG TƯƠNG LAI. NÊN HIỆN TẠI CÓ THỂ SẼ CÓ LỖI KHI TẠO VIDEO AI.</div>` : ''}
        <div class="pg-roles" style="padding:8px 10% 0;">${rolesHtml}</div>
        <div class="ai-model-bar">
          <div class="ai-model-select" id="pg-model-select">
            <span>${provider? `🧠 ${escapeHtml(provider.label||provider.model)}` : '⚠️ Chưa cấu hình AI'}</span><span class="ai-model-caret">▾</span>
            ${modelDropdownHtml}
          </div>
        </div>
        ${attachRowHtml}
        <div class="ai-inputbar">
          <div class="ai-add-btn" id="pg-add-btn" role="button" tabindex="0">➕<span class="ai-add-label"> Thêm tài liệu/ảnh</span>${addMenuHtml}</div>
          <textarea id="pg-input" rows="1" placeholder="Gõ nội dung cần tuyên truyền, hoặc bấm 1 nút gợi ý ở trên... (Enter xuống dòng, Ctrl+Enter gửi)"></textarea>
          <div class="ai-send-wrap">
            <span class="ai-send-tooltip">${state.propagandaSending? 'Chỉ bấm nút để dừng — Enter sẽ không có tác dụng' : 'Bấm Ctrl+Enter để gửi nhanh'}</span>
            ${state.propagandaSending? `<button id="pg-stop-btn" class="ai-stop-btn" title="Dừng câu trả lời">⏹</button>` : `<button id="pg-send-btn">➤</button>`}
          </div>
        </div>
      </div>`;
  }

  function buildPropagandaBubbleHtml(m, idx){
    if(m.streaming){
      return `<div class="ai-bubble assistant ${m.text? '' : 'thinking'}" id="pg-streaming-bubble">${m.text? escapeHtml(m.text) : waveTextHtml('Chàng đang biên tập…')}</div>`;
    }
    if(state._propagandaBubbleEditingIndex === idx){
      return `<div class="ai-bubble-wrap ${m.role}">
        <div class="ai-edit-box">
          <textarea id="pg-edit-textarea-${idx}" rows="3">${escapeHtml(m.text)}</textarea>
          <div class="ai-edit-box-actions">
            <button class="btn btn-ghost btn-sm" data-pg-edit-cancel="${idx}">Huỷ bỏ</button>
            <button class="btn btn-primary btn-sm" data-pg-edit-resend="${idx}">Gửi lại</button>
          </div>
        </div>
      </div>`;
    }
    const attachHtml = m.attachments && m.attachments.length? `<div class="ai-bubble-attach">${m.attachments.map(a=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)}</span>`).join('')}</div>` : '';
    const bodyHtml = m.role==='assistant' ? renderMarkdownLite(m.text) : escapeHtml(m.text);
    return `<div class="ai-bubble-wrap ${m.role}">
      <div class="ai-bubble ${m.role}">${bodyHtml}${attachHtml}</div>
      <div class="ai-bubble-actions">
        ${m.role==='user'? `<button class="ai-bubble-act" data-pg-edit="${idx}" title="Sửa">✏️</button>` : ''}
        <button class="ai-bubble-act" data-pg-copy="${idx}" title="Sao chép">📋</button>
        <button class="ai-bubble-act" data-pg-delete="${idx}" title="Xoá tin nhắn này">🗑️</button>
      </div>
    </div>`;
  }

  function wirePropagandaTab(el, chat){
    wireMarkdownExtras(el);
    document.getElementById('pg-newchat-btn').onclick = newPropagandaChat;
    const pgExitBtn = document.getElementById('pg-exit-btn');
    if(pgExitBtn) pgExitBtn.onclick = closePropagandaModule;
    const pgCloseFab = document.getElementById('pg-close-fab');
    if(pgCloseFab) pgCloseFab.onclick = closePropagandaModule;
    // Đóng/mở khung lịch sử tuyên truyền bên trái — hiệu ứng, cách hoạt động y hệt module Chat AI.
    const blurPgInputIfAny = ()=>{ const inp = document.getElementById('pg-input'); if(inp && document.activeElement===inp) inp.blur(); };
    const pgSidebarToggleBtn = document.getElementById('pg-sidebar-toggle-btn');
    if(pgSidebarToggleBtn) pgSidebarToggleBtn.onclick = (e)=>{
      e.stopPropagation();
      state._pgSidebarCollapsed = !state._pgSidebarCollapsed;
      renderPropagandaOverlay();
      requestAnimationFrame(blurPgInputIfAny);
    };
    const pgSidebarScrim = document.getElementById('pg-sidebar-scrim');
    if(pgSidebarScrim) pgSidebarScrim.onclick = ()=>{ state._pgSidebarCollapsed = true; renderPropagandaOverlay(); requestAnimationFrame(blurPgInputIfAny); };
    const pgMainPanel = document.getElementById('pg-main-panel');
    if(pgMainPanel) pgMainPanel.addEventListener('click', (e)=>{
      if(!isNarrowScreenForSidebar()) return;
      if(state._pgSidebarCollapsed) return;
      e.preventDefault();
      e.stopPropagation();
      state._pgSidebarCollapsed = true;
      renderPropagandaOverlay();
      requestAnimationFrame(blurPgInputIfAny);
    }, true);
    el.querySelectorAll('[data-pg-hist]').forEach(item=>{
      item.addEventListener('click', (e)=>{
        if(e.target.closest('[data-pg-hist-rename],[data-pg-hist-del]')) return;
        state.propagandaActiveChatId = item.dataset.pgHist;
        state._propagandaBubbleEditingIndex = null;
        renderPropagandaOverlay();
      });
    });
    el.querySelectorAll('[data-pg-hist-rename]').forEach(btn=> btn.onclick = (e)=>{ e.stopPropagation(); renamePropagandaChat(btn.dataset.pgHistRename); });
    el.querySelectorAll('[data-pg-hist-del]').forEach(btn=> btn.onclick = (e)=>{ e.stopPropagation(); deletePropagandaChatById(btn.dataset.pgHistDel); });

    el.querySelectorAll('[data-pg-role]').forEach(btn=>{
      btn.onclick = ()=>{
        if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
        const role = PROPAGANDA_ROLES.find(r=>r.key===btn.dataset.pgRole);
        state._propagandaSuggestMenuOpen = false; // đóng menu gợi ý ngay sau khi đã chọn xong 1 lựa chọn
        if(role) sendPropagandaMessage(role.prompt, role.key==='video');
      };
    });
    // Nút "💡 Gợi ý tạo bài" — rê chuột vào MỞ, rê chuột ra ĐÓNG (dành cho thiết bị có chuột); bấm 1 lần
    // MỞ, bấm thêm lần nữa ĐÓNG (áp dụng cho mọi thiết bị, kể cả cảm ứng không có chuột).
    const suggestWrap = document.getElementById('pg-suggest-wrap');
    const suggestToggleBtn = document.getElementById('pg-suggest-toggle-btn');
    if(suggestWrap && suggestToggleBtn){
      // QUAN TRỌNG: menu dùng position:absolute nên KHÔNG tự động mở rộng vùng hover của khung bọc —
      // phải tự gắn listener RIÊNG cho cả nút LẪN menu (nếu đang mở), dùng độ trễ nhỏ (100ms) trước khi
      // thực sự ẩn đi, để con trỏ có đủ thời gian di chuyển từ nút sang menu (hoặc ngược lại) mà không
      // bị "nhấp nháy" ẩn đi giữa chừng.
      let suggestCloseTimer = null;
      const cancelSuggestClose = ()=>{ if(suggestCloseTimer){ clearTimeout(suggestCloseTimer); suggestCloseTimer = null; } };
      const scheduleSuggestClose = ()=>{
        cancelSuggestClose();
        suggestCloseTimer = setTimeout(()=>{
          if(state._propagandaSuggestMenuOpen){ state._propagandaSuggestMenuOpen = false; renderPropagandaOverlay(); }
        }, 100);
      };
      const openSuggestNow = ()=>{
        cancelSuggestClose();
        // QUAN TRỌNG: lưu mốc thời gian vào STATE (không phải biến cục bộ) — vì renderPropagandaOverlay()
        // gọi ngay sau đây sẽ vẽ lại TOÀN BỘ giao diện, khiến đoạn code nối dây này chạy lại từ đầu, MỌI
        // biến cục bộ khai báo trong hàm sẽ bị tạo mới hoàn toàn (mất giá trị cũ) — nếu lưu vào biến cục
        // bộ thì tới lúc sự kiện click "giả" xảy ra sẽ đọc nhầm phải giá trị vừa mới khởi tạo lại (bằng
        // 0), khiến việc kiểm tra "vừa mở cách đây bao lâu" luôn sai (đây chính là lỗi thật đã xảy ra ở
        // lần sửa trước, nay khắc phục bằng cách lưu vào state để giữ nguyên được giá trị qua các lần
        // vẽ lại giao diện).
        state._pgSuggestLastHoverOpenAt = Date.now();
        if(!state._propagandaSuggestMenuOpen){ state._propagandaSuggestMenuOpen = true; renderPropagandaOverlay(); }
      };
      suggestToggleBtn.addEventListener('mouseenter', openSuggestNow);
      suggestToggleBtn.addEventListener('mouseleave', scheduleSuggestClose);
      const suggestMenuEl = document.getElementById('pg-suggest-menu');
      if(suggestMenuEl){
        suggestMenuEl.addEventListener('mouseenter', cancelSuggestClose);
        suggestMenuEl.addEventListener('mouseleave', scheduleSuggestClose);
      }
      // Cơ chế cuộn VÔ HẠN — danh sách đã được lặp lại nhiều lần (PG_SUGGEST_REPEAT khối) khi vẽ ra.
      // Đặt vị trí cuộn ban đầu ở NGAY GIỮA (không phải đầu/cuối) để cuộn được cả 2 chiều ngay từ đầu.
      // Mỗi khi cuộn gần chạm biên trên/dưới (còn cách chưa tới 1 khối) thì NHẢY TỨC THÌ (không hiệu
      // ứng, không ai nhận ra) sang đúng vị trí tương đương ở 1 khối khác nằm giữa danh sách — vì nội
      // dung các khối giống hệt nhau nên người dùng có cảm giác cuộn liên tục không bao giờ hết.
      const suggestListEl = document.getElementById('pg-suggest-list');
      if(suggestListEl){
        const N_REPEAT = 8; // PHẢI khớp đúng với PG_SUGGEST_REPEAT lúc vẽ HTML ở trên
        const midBlockIndex = Math.floor(N_REPEAT/2);
        requestAnimationFrame(()=>{
          const blockH = suggestListEl.scrollHeight / N_REPEAT;
          if(suggestListEl.scrollTop < 1) suggestListEl.scrollTop = blockH * midBlockIndex; // chỉ đặt lại vị trí giữa nếu ĐANG ở vị trí gốc (mới mở menu lần đầu) — tránh giật vị trí đang cuộn dở nếu vẽ lại vì lý do khác
        });
        suggestListEl.addEventListener('scroll', ()=>{
          const total = suggestListEl.scrollHeight;
          const blockH = total / N_REPEAT;
          if(suggestListEl.scrollTop < blockH) suggestListEl.scrollTop += blockH * midBlockIndex;
          else if(suggestListEl.scrollTop > total - blockH*2) suggestListEl.scrollTop -= blockH * midBlockIndex;
        });
        // 2 nút cuộn lên/xuống — rê chuột vào HOẶC bấm giữ (cảm ứng) -> cuộn liên tục; bấm nhanh 1 cái ->
        // cuộn 1 đoạn ngắn.
        const wireSuggestScrollBtn = (btn, dir)=>{
          if(!btn) return;
          let timer = null, downAt = 0;
          const start = ()=>{ if(timer) return; timer = setInterval(()=>{ suggestListEl.scrollTop += dir*3; }, 16); };
          const stop = ()=>{ if(timer){ clearInterval(timer); timer=null; } };
          btn.addEventListener('mouseenter', start);
          btn.addEventListener('mouseleave', stop);
          btn.addEventListener('mousedown', (e)=>{ e.preventDefault(); e.stopPropagation(); downAt=Date.now(); start(); });
          btn.addEventListener('touchstart', (e)=>{ e.stopPropagation(); downAt=Date.now(); start(); }, {passive:true});
          document.addEventListener('mouseup', stop);
          document.addEventListener('touchend', stop);
          btn.addEventListener('click', (e)=>{
            e.stopPropagation();
            if(Date.now() - downAt < 260) suggestListEl.scrollBy({ top: dir*140, behavior:'smooth' });
          });
        };
        wireSuggestScrollBtn(document.getElementById('pg-suggest-up-btn'), -1);
        wireSuggestScrollBtn(document.getElementById('pg-suggest-down-btn'), 1);
      }
      suggestToggleBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        cancelSuggestClose();
        // QUAN TRỌNG: trên thiết bị cảm ứng (chạm ngón tay), trình duyệt tự phát sinh CẢ "mouseenter"
        // (đã mở menu qua openSuggestNow) LẪN "click" (đảo trạng thái) chỉ trong tích tắc — nếu không
        // kiểm tra, click sẽ ĐẢO NGƯỢC lại trạng thái vừa mở, đóng ngay lập tức, khiến người dùng chạm
        // vào không thấy menu hiện ra (lỗi thật đã xảy ra, nay chặn bằng mốc thời gian bảo vệ). Nếu vừa
        // mở qua mouseenter cách đây CHƯA TỚI 400ms thì đây chắc chắn là sự kiện "click giả" đi kèm chạm
        // cảm ứng — bỏ qua việc đảo trạng thái, chỉ đảm bảo menu vẫn đang mở.
        if(Date.now() - (state._pgSuggestLastHoverOpenAt||0) < 400){
          if(!state._propagandaSuggestMenuOpen){ state._propagandaSuggestMenuOpen = true; renderPropagandaOverlay(); }
          return;
        }
        state._propagandaSuggestMenuOpen = !state._propagandaSuggestMenuOpen;
        renderPropagandaOverlay();
      });
    }
    const confirmCreateBtn = document.getElementById('pg-confirm-create-btn');
    if(confirmCreateBtn) confirmCreateBtn.onclick = ()=>{
      if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
      sendPropagandaMessage('Tôi không cần bổ sung gì thêm, hãy tạo bài tuyên truyền ngay theo đúng phương án Chàng vừa đề xuất!');
    };

    el.querySelectorAll('[data-pg-edit]').forEach(btn=> btn.onclick = ()=> startEditPropagandaMessage(parseInt(btn.dataset.pgEdit,10)));
    el.querySelectorAll('[data-pg-copy]').forEach(btn=> btn.onclick = ()=>{
      const idx = parseInt(btn.dataset.pgCopy,10);
      const m = chat && chat.messages[idx];
      if(m) copyMessageText(m.text||'');
    });
    el.querySelectorAll('[data-pg-delete]').forEach(btn=> btn.onclick = ()=> deletePropagandaMessageAt(parseInt(btn.dataset.pgDelete,10)));
    el.querySelectorAll('[data-pg-edit-cancel]').forEach(btn=> btn.onclick = cancelEditPropagandaMessage);
    el.querySelectorAll('[data-pg-edit-resend]').forEach(btn=> btn.onclick = ()=>{
      const idx = parseInt(btn.dataset.pgEditResend,10);
      const ta = document.getElementById(`pg-edit-textarea-${idx}`);
      resendEditedPropagandaMessage(idx, ta? ta.value : '');
    });

    const modelSelectEl = document.getElementById('pg-model-select');
    if(modelSelectEl) modelSelectEl.addEventListener('click', (e)=>{ e.stopPropagation(); state._propagandaModelMenuOpen = !state._propagandaModelMenuOpen; renderPropagandaOverlay(); });
    el.querySelectorAll('[data-pg-select-provider]').forEach(elx=>{
      elx.addEventListener('click', (e)=>{ e.stopPropagation(); selectPropagandaProvider(elx.dataset.pgSelectProvider); });
    });

    const addBtn = document.getElementById('pg-add-btn');
    if(addBtn) addBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      state._propagandaAddMenuOpen = !state._propagandaAddMenuOpen;
      // Ô nhập liệu <textarea id="pg-input"> KHÔNG hề gắn với biến trạng thái nào (chỉ là DOM thao tác
      // tay thuần tuý) — nên mỗi lần vẽ lại TOÀN BỘ khung, ô này sẽ bị dựng lại RỖNG, xoá sạch chữ đang
      // gõ dở. Lưu lại giá trị TRƯỚC khi vẽ lại, rồi khôi phục lại NGAY SAU đó.
      const inputEl = document.getElementById('pg-input');
      const savedValue = inputEl ? inputEl.value : '';
      renderPropagandaOverlay();
      const inputElAfter = document.getElementById('pg-input');
      if(inputElAfter && savedValue) inputElAfter.value = savedValue;
      if(inputElAfter) autoResizeTextarea(inputElAfter);
    });
    el.querySelectorAll('[data-pg-add]').forEach(elx=>{
      elx.addEventListener('click', (e)=>{
        e.stopPropagation();
        if(elx.dataset.pgAdd==='mic'){ state._propagandaAddMenuOpen = false; document.querySelector('#pg-add-btn .ai-add-menu')?.remove(); togglePgMic(); return; }
        if(elx.dataset.pgAdd==='mic2'){ state._propagandaAddMenuOpen = false; document.querySelector('#pg-add-btn .ai-add-menu')?.remove(); togglePgMic2(); return; }
        triggerPropagandaFileInput(elx.dataset.pgAdd);
      });
    });
    el.querySelectorAll('[data-pg-attach-remove]').forEach(btn=> btn.onclick = ()=> removePropagandaAttachment(parseInt(btn.dataset.pgAttachRemove,10)));

    const sendBtn = document.getElementById('pg-send-btn');
    const stopBtn = document.getElementById('pg-stop-btn');
    if(stopBtn) stopBtn.onclick = ()=>{ if(state.propagandaAbortController) state.propagandaAbortController.abort(); };
    const inputEl = document.getElementById('pg-input');
    const doSend = ()=>{
      if(state.propagandaSending) return;
      const v = inputEl.value; inputEl.value = '';
      if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
      sendPropagandaMessage(v);
    };
    if(sendBtn) sendBtn.onclick = doSend;
    wireAutoResizeTextarea('pg-input');
    if(inputEl){
      inputEl.addEventListener('keydown', (e)=>{
        if(e.key==='Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); doSend(); }
      });
    }
    if(!state._pgOutsideClickBound){
      state._pgOutsideClickBound = true;
      document.addEventListener('click', ()=>{
        if(!state._propagandaOpen) return;
        if(state._propagandaModelMenuOpen || state._propagandaAddMenuOpen || state._propagandaSuggestMenuOpen){
          state._propagandaModelMenuOpen = false; state._propagandaAddMenuOpen = false; state._propagandaSuggestMenuOpen = false;
          if(state._propagandaOpen) renderPropagandaOverlay();
        }
      });
    }
  }

  function renderPropagandaOverlay(){
    let overlay = document.getElementById('propaganda-overlay');
    if(!overlay){
      overlay = document.createElement('div'); overlay.id = 'propaganda-overlay'; overlay.className = 'ai-overlay';
      document.body.appendChild(overlay);
    }
    if(!state._propagandaChatsLoaded){ state._propagandaChatsLoaded = true; loadPropagandaChats().then(()=>{ if(state._propagandaOpen) renderPropagandaOverlay(); }); }
    const chat = state.propagandaChats.find(c=>c.id===state.propagandaActiveChatId);
    const provider = getActivePropagandaProvider();
    const prevMsgBox = document.getElementById('pg-messages');
    const wasNearBottom = prevMsgBox ? (prevMsgBox.scrollHeight - prevMsgBox.scrollTop - prevMsgBox.clientHeight < 80) : true;
    const prevScrollTop = prevMsgBox ? prevMsgBox.scrollTop : 0;
    overlay.innerHTML = buildPropagandaHtml(chat, provider);
    wirePropagandaTab(overlay, chat);
    const msgBox = document.getElementById('pg-messages');
    if(msgBox) msgBox.scrollTop = wasNearBottom ? msgBox.scrollHeight : prevScrollTop;
  }
  // Mở/đóng module "Tạo bài Tuyên truyền" — dạng overlay toàn màn hình, y hệt module Chat AI/Siêu ghi
  // chú (không còn là 1 tab thông thường trong #content nữa).
  async function openPropagandaModule(){
    closeAiChat(); closeSuperNotes();
    state._propagandaOpen = true;
    renderPropagandaOverlay();
    // Đảm bảo KHÔNG có con trỏ văn bản (và do đó KHÔNG có bàn phím ảo tự bật lên trên điện thoại) ngay
    // lúc vừa mở module — chỉ khi người dùng TỰ bấm vào khung nhập thì mới có con trỏ để nhập liệu.
    requestAnimationFrame(()=>{
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
  }
  function closePropagandaModule(){
    state._propagandaOpen = false;
    const overlay = document.getElementById('propaganda-overlay');
    if(overlay) overlay.remove();
    // Thoát module ra thì LUÔN hiện khung menu chính (bất kể trước đây đang đóng hay mở).
    state.sidebarCollapsed = false;
    applySidebarCollapsedVisual(false);
  }

  function renderMembersTab(el){
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🪪 Hồ sơ hội viên</h3></div>
        <div class="panel-body">
          <div class="empty-state">
            <div class="e-ico">🚧</div>
            <p style="font-weight:700; color:var(--rice-dark); letter-spacing:.02em;">TÍNH NĂNG NÀY ĐANG ĐƯỢC NÂNG CẤP</p>
          </div>
        </div>
      </div>`;
  }

  function renderStrengthTab(el){
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>💪 Thực lực Hội</h3></div>
        <div class="panel-body">
          <div class="empty-state">
            <div class="e-ico">🚧</div>
            <p style="font-weight:700; color:var(--rice-dark); letter-spacing:.02em;">TÍNH NĂNG NÀY ĐANG ĐƯỢC NÂNG CẤP</p>
          </div>
        </div>
      </div>`;
  }

  // =====================================================================
  // Module [BIỂU MẪU / KHẢO SÁT / BÀI KIỂM TRA] — kiểu Google Forms.
  // Lưu trữ: surveys/{surveyId} (metadata + câu hỏi, KHÔNG lồng theo wardId để khách bấm link chia
  // sẻ đọc được trực tiếp mà không cần biết wardId) và survey_responses/{surveyId}/{responseId}
  // (câu trả lời — Ai cũng GHI được (nộp bài ẩn danh qua link công khai), nhưng chỉ Chủ mã/Admin
  // mới ĐỌC được để xem kết quả). Danh sách biểu mẫu của 1 mã xã được lọc qua query
  // orderByChild('wardId').equalTo(wardId) — cần thêm ".indexOn":["wardId"] trong Firebase Rules.
  // =====================================================================
  function emptySurveySection(idx){
    return { id: 'sec_'+uid(), title:`Phần ${idx||1}`, description:'' };
  }
  function emptySurveyQuestion(sectionId){
    return { id: 'q_'+uid(), text:'', type:'short', required:false, options:['Phương án 1'], correctAnswers:[], points:0,
      numericOnly:false, optionBranches:['__next__'], sectionId: sectionId||null };
  }
  function emptySurveyDraft(){
    const sec = emptySurveySection(1);
    return { id:null, wardId: wardId(), wardName:(state.config&&state.config.wardName)||'',
      scope: state.surveySpace, ownerEmail: (state.identity&&state.identity.email) || null,
      title:'Biểu mẫu không có tiêu đề', description:'',
      isQuiz:false, sections:[sec], questions:[emptySurveyQuestion(sec.id)], createdAt:null, updatedAt:null, deleted:false, responseCount:0 };
  }
  function hasSurveyPersonalAccount(){ return !!(state.identity && state.identity.email); }
  // Đảm bảo biểu mẫu (kể cả biểu mẫu cũ tạo trước khi có tính năng "Phần") luôn có sections hợp lệ
  // và mỗi câu hỏi có đủ optionBranches/numericOnly — tránh lỗi khi mở sửa/điền phiếu.
  function ensureSurveySections(draft){
    if(!draft.sections || !draft.sections.length){
      const sec = emptySurveySection(1);
      draft.sections = [sec];
      (draft.questions||[]).forEach(q=>{ q.sectionId = sec.id; });
    } else {
      const validIds = draft.sections.map(s=>s.id);
      const firstId = draft.sections[0].id;
      (draft.questions||[]).forEach(q=>{ if(!q.sectionId || !validIds.includes(q.sectionId)) q.sectionId = firstId; });
    }
    (draft.questions||[]).forEach(q=>{
      if(q.numericOnly==null) q.numericOnly = false;
      if(!q.optionBranches || q.optionBranches.length!==(q.options||[]).length) q.optionBranches = (q.options||[]).map(()=>'__next__');
    });
    return draft;
  }
  // ---- Phân quyền: Bộ DÙNG CHUNG theo publicPerms/grants['survey'] (Cài đặt & Chia sẻ); Bộ CÁ
  // NHÂN chỉ chính chủ tài khoản Google mới xem/sửa/xoá được, không ai khác kể cả Admin. ----
  function surveyCanView(){ return state.surveySpace==='personal' ? hasSurveyPersonalAccount() : canViewModule('survey'); }
  function surveyCanEdit(){ return state.surveySpace==='personal' ? hasSurveyPersonalAccount() : canEditModule('survey'); }

  let surveysListenerRef = null;
  let surveysListenerKey = null; // "shared:{wardId}" hoặc "personal:{email}" — tự gắn lại khi đổi không gian/đổi mã
  function attachSurveysRealtime(){
    let ref, key;
    if(state.surveySpace==='personal'){
      const email = state.identity && state.identity.email;
      if(!email){ state.surveys = []; detachSurveysRealtime(); return; }
      key = 'personal:'+email;
      ref = rtdb.ref('surveys').orderByChild('ownerEmail').equalTo(email);
    } else {
      const wid = wardId();
      if(!wid) return;
      key = 'shared:'+wid;
      ref = rtdb.ref('surveys').orderByChild('wardId').equalTo(wid);
    }
    if(surveysListenerRef && surveysListenerKey===key) return; // đã đúng không gian rồi, khỏi gắn lại
    detachSurveysRealtime();
    surveysListenerKey = key;
    surveysListenerRef = ref;
    surveysListenerRef.on('value', snap=>{
      const all = (snap && snap.exists()) ? Object.values(snap.val()) : [];
      state.surveys = all.filter(s=> !s.deleted && ((state.surveySpace==='personal') ? s.scope==='personal' : s.scope!=='personal'));
      if(state.activeTab==='survey'){ const c = document.getElementById('content'); if(c) renderSurveyTab(c); }
    }, err=> console.error('[Khảo sát] Không tải được danh sách biểu mẫu (kiểm tra Firebase Rules ".indexOn":["wardId","ownerEmail"]):', err));
  }
  function detachSurveysRealtime(){ if(surveysListenerRef){ surveysListenerRef.off(); surveysListenerRef = null; surveysListenerKey = null; } }
  function switchSurveySpace(space){
    if(state.surveySpace===space) return;
    if(space==='personal' && !hasSurveyPersonalAccount()){ alert('Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.'); return; }
    state.surveySpace = space;
    state.surveyView='list'; state.surveyDraft=null; state.surveyEditingId=null;
    attachSurveysRealtime();
    const c = document.getElementById('content'); if(c) renderSurveyTab(c);
  }

  async function saveSurveyDraft(){
    if(!surveyCanEdit()){ alert(state.surveySpace==='personal' ? 'Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.' : 'Bạn không có quyền sửa Biểu mẫu dùng chung này.'); return false; }
    const d = state.surveyDraft;
    if(!d.title || !d.title.trim()){ alert('Vui lòng nhập tiêu đề biểu mẫu.'); return false; }
    if(!d.questions.length){ alert('Vui lòng thêm ít nhất 1 câu hỏi.'); return false; }
    for(const q of d.questions){
      if(!q.text || !q.text.trim()){ alert('Có câu hỏi chưa nhập nội dung. Vui lòng kiểm tra lại.'); return false; }
      if(surveyQTypeHasOptions(q.type) && (!q.options || q.options.filter(o=>o.trim()).length<1)){ alert(`Câu hỏi "${q.text}" cần ít nhất 1 phương án.`); return false; }
    }
    const id = d.id || uid();
    const toSave = { ...d, id, wardId: wardId(), wardName:(state.config&&state.config.wardName)||'',
      updatedAt:new Date().toISOString(), createdAt: d.createdAt || new Date().toISOString(),
      responseCount: d.responseCount||0, deleted:false };
    await rtdb.ref(`surveys/${id}`).set(toSave);
    await pushLog(d.id? 'sửa biểu mẫu':'tạo biểu mẫu', toSave.title);
    state.surveyDraft = toSave;
    state.surveyEditingId = id;
    return true;
  }
  async function deleteSurvey(id){
    if(!surveyCanEdit()){ alert(state.surveySpace==='personal' ? 'Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.' : 'Bạn không có quyền xoá Biểu mẫu dùng chung này.'); return; }
    const s = state.surveys.find(x=>x.id===id);
    if(!s) return;
    if(!confirm(`Xoá biểu mẫu "${s.title}"? Toàn bộ câu trả lời đã thu thập cũng sẽ bị xoá theo và KHÔNG THỂ khôi phục. Bạn có chắc chắn?`)) return;
    await rtdb.ref(`surveys/${id}`).remove();
    await rtdb.ref(`survey_responses/${id}`).remove();
    await pushLog('xoá biểu mẫu', s.title);
    if(state.surveyEditingId===id){ state.surveyView='list'; state.surveyEditingId=null; state.surveyDraft=null; }
    render();
  }
  function surveyShareUrl(surveyId){
    return `${location.origin}${location.pathname}#/khaosat/${surveyId}`;
  }
  async function loadSurveyResponses(surveyId){
    try{
      const snap = await rtdb.ref(`survey_responses/${surveyId}`).get();
      state.surveyResponses = (snap && snap.exists()) ? Object.values(snap.val()).sort((a,b)=> (a.submittedAt||'').localeCompare(b.submittedAt||'')) : [];
    }catch(e){ console.error('[Khảo sát] Không tải được câu trả lời:', e); state.surveyResponses = []; }
    state.surveyResponseViewIndex = 0;
  }
  // Thống kê 1 câu hỏi trên toàn bộ câu trả lời hiện có — trắc nghiệm/hộp kiểm/dropdown ra % theo
  // từng phương án; tự luận (ngắn/đoạn văn) ra danh sách câu trả lời dạng chữ.
  function computeQuestionStats(question, responses){
    if(surveyQTypeHasOptions(question.type)){
      const counts = {}; (question.options||[]).forEach(o=> counts[o]=0);
      responses.forEach(r=>{
        const ans = r.answers && r.answers[question.id];
        if(ans==null || ans==='') return;
        const arr = Array.isArray(ans) ? ans : [ans];
        arr.forEach(a=>{ counts[a] = (counts[a]||0) + 1; });
      });
      const total = responses.length || 1;
      return Object.entries(counts).map(([opt,cnt])=>({ opt, cnt, pct: Math.round((cnt/total)*100) }));
    }
    return responses.map(r=> (r.answers && r.answers[question.id]) || '').filter(s=>s);
  }
  function computeSurveyScore(survey, answers){
    let score = 0, maxScore = 0;
    (survey.questions||[]).forEach(q=>{
      if(!surveyQTypeHasOptions(q.type)) return;
      maxScore += parseFloat(q.points)||0;
      const correct = q.correctAnswers||[];
      if(!correct.length) return;
      const given = answers[q.id];
      if(q.type==='checkbox'){
        const givenArr = Array.isArray(given) ? given : [];
        const isCorrect = correct.length===givenArr.length && correct.every(c=>givenArr.includes(c));
        if(isCorrect) score += parseFloat(q.points)||0;
      } else if(given!=null && correct.includes(given)){
        score += parseFloat(q.points)||0;
      }
    });
    return { score: Math.round(score*100)/100, maxScore: Math.round(maxScore*100)/100 };
  }
  // Nộp bài từ giao diện CÔNG KHAI (không cần đăng nhập) — ghi vào survey_responses/{id} (Rules
  // cho phép ai cũng GHI được ở đây) và tăng bộ đếm responseCount bằng transaction (an toàn với
  // nhiều người nộp cùng lúc).
  async function submitPublicSurveyResponse(survey, answers){
    // Chỉ kiểm tra bắt buộc với câu hỏi CÓ mặt trong answers (tức thuộc Phần người dùng đã thực sự
    // đi qua) — câu hỏi ở Phần bị bỏ qua do phân nhánh sẽ không có key trong answers nên bỏ qua.
    const missing = (survey.questions||[]).some(q=>{
      if(!q.required) return false;
      if(!(q.id in answers)) return false;
      const v = answers[q.id];
      return v==null || v==='' || (Array.isArray(v) && v.length===0);
    });
    if(missing) return { ok:false, reason:'missing' };
    const id = 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    const entry = { id, submittedAt:new Date().toISOString(), answers };
    if(survey.isQuiz){
      const { score, maxScore } = computeSurveyScore(survey, answers);
      entry.score = score; entry.maxScore = maxScore;
    }
    try{
      await rtdb.ref(`survey_responses/${survey.id}/${id}`).set(entry);
      await rtdb.ref(`surveys/${survey.id}/responseCount`).transaction(cur=> (cur||0)+1);
      return { ok:true, entry };
    }catch(e){
      console.error('[Khảo sát] Gửi câu trả lời lỗi:', e);
      return { ok:false, reason:'error' };
    }
  }

  function renderSurveyTab(el){
    attachSurveysRealtime();
    if(state.surveyView==='editor' && state.surveyDraft){
      renderSurveyEditorView(el);
    } else {
      renderSurveyListView(el);
    }
  }

  function renderSurveyListView(el){
    const isShared = state.surveySpace==='shared';
    const canEdit = surveyCanEdit();
    const canView = surveyCanView();
    const list = state.surveys.slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>BIỂU MẪU/KHẢO SÁT/BÀI KIỂM TRA</h3></div>
        <div class="panel-body">
          <p class="sub" style="margin-top:0;">Giúp tạo các biểu mẫu để KHẢO SÁT hội viên, nhân dân, thu thập thông tin mọi người, hoặc lấy ý kiến và lắng nghe trình báo từ người khác, hoặc tạo bài kiểm tra cho mọi người... người tham gia khảo sát (hoặc làm bài kiểm tra) sẽ được tham gia khảo sát / làm bài kiểm tra bằng đường link do bạn cung cấp!</p>
          <div class="toolbar" style="margin-bottom:14px;">
            <button class="btn ${isShared?'btn-primary':'btn-ghost'} btn-sm" id="sv-space-shared">🏛️ Biểu mẫu dùng chung xã/phường</button>
            <button class="btn ${!isShared?'btn-primary':'btn-ghost'} btn-sm" id="sv-space-personal">🔒 Biểu mẫu cá nhân</button>
          </div>
          ${!canView? `<div class="empty-state" style="padding:30px;"><div class="e-ico">🔒</div>${isShared? 'Bạn không có quyền xem Biểu mẫu dùng chung của mã xã này. Vui lòng liên hệ Chủ mã để được cấp quyền tại "Cài đặt & Chia sẻ".' : 'Biểu mẫu cá nhân yêu cầu đăng nhập bằng tài khoản Google.'}</div>` : `
          ${canEdit? `<button class="btn btn-primary" id="sv-new-btn">➕ Tạo biểu mẫu mới</button>` : `<p class="sub">Bạn chỉ có quyền xem ở ${isShared?'Biểu mẫu dùng chung này':'đây'}.</p>`}
          <div class="table-wrap" style="margin-top:14px;">
            <table>
              <thead><tr><th>Tên biểu mẫu</th><th>Ngày tạo</th><th>Số người đã trả lời</th><th></th></tr></thead>
              <tbody>
                ${list.length? list.map(s=>`
                  <tr>
                    <td><b>${escapeHtml(s.title)}</b>${s.isQuiz? ' <span class="pill pill-gray">Bài kiểm tra</span>' : ''}</td>
                    <td>${s.createdAt? fmtDate(s.createdAt.slice(0,10)) : '—'}</td>
                    <td>${s.responseCount||0}</td>
                    <td style="white-space:nowrap; display:flex; gap:6px;">
                      <button class="btn btn-ghost btn-sm" data-sv-open="${s.id}">${canEdit? 'Sửa / Xem kết quả' : 'Xem kết quả'}</button>
                      <button class="btn btn-ghost btn-sm" data-sv-copy="${s.id}">🔗 Copy link</button>
                      ${canEdit? `<button class="btn btn-ghost btn-sm" data-sv-delete="${s.id}" style="color:var(--red);">Xoá</button>` : ''}
                    </td>
                  </tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="e-ico">📝</div>Chưa có biểu mẫu nào${canEdit? ' — bấm "Tạo biểu mẫu mới" để bắt đầu' : ''}</div></td></tr>`}
              </tbody>
            </table>
          </div>`}
        </div>
      </div>`;
    const spaceSharedBtn = document.getElementById('sv-space-shared');
    if(spaceSharedBtn) spaceSharedBtn.onclick = ()=> switchSurveySpace('shared');
    const spacePersonalBtn = document.getElementById('sv-space-personal');
    if(spacePersonalBtn) spacePersonalBtn.onclick = ()=> switchSurveySpace('personal');
    const newBtn = document.getElementById('sv-new-btn');
    if(newBtn) newBtn.onclick = ()=>{
      state.surveyDraft = emptySurveyDraft();
      state.surveyEditingId = null;
      state.surveyEditorTab = 'questions';
      state.surveyView = 'editor';
      renderSurveyTab(el);
    };
    document.querySelectorAll('[data-sv-open]').forEach(btn=>{
      btn.onclick = ()=>{
        const s = state.surveys.find(x=>x.id===btn.dataset.svOpen);
        if(!s) return;
        state.surveyDraft = ensureSurveySections(JSON.parse(JSON.stringify(s)));
        state.surveyEditingId = s.id;
        state.surveyEditorTab = 'questions';
        state.surveyResponseDetailOpen = false;
        state.surveyResponseViewIndex = 0;
        state.surveyView = 'editor';
        renderSurveyTab(el);
      };
    });
    document.querySelectorAll('[data-sv-copy]').forEach(btn=>{
      btn.onclick = ()=> copyMessageText(surveyShareUrl(btn.dataset.svCopy));
    });
    document.querySelectorAll('[data-sv-delete]').forEach(btn=>{
      btn.onclick = ()=> deleteSurvey(btn.dataset.svDelete);
    });
  }

  function renderSurveyQuestionCardHtml(q, idx, isQuiz, canEdit, sections){
    const isFreeText = (q.type==='short' || q.type==='paragraph');
    const hasBranch = surveyQTypeHasOptions(q.type) && q.type!=='dropdown' && sections && sections.length>1;
    return `
    <div class="panel" style="margin-bottom:10px; border:1px solid var(--line);">
      <div class="panel-body">
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <b style="padding-top:10px;">${idx+1}.</b>
          <div style="flex:1; min-width:0;">
            <input class="q-text" data-qid="${q.id}" value="${escapeHtml(q.text)}" placeholder="Nội dung câu hỏi..." style="width:100%; font-weight:700; margin-bottom:8px;" ${canEdit?'':'disabled'}>
            <div class="form-grid">
              <div class="field"><label>Loại câu hỏi</label>
                <select class="q-type" data-qid="${q.id}" ${canEdit?'':'disabled'}>${SURVEY_QTYPES.map(t=>`<option value="${t.key}" ${q.type===t.key?'selected':''}>${t.label}</option>`).join('')}</select>
              </div>
              <div class="field"><label>&nbsp;</label>
                <div class="checkbox-row"><input type="checkbox" class="q-required" data-qid="${q.id}" ${q.required?'checked':''} ${canEdit?'':'disabled'}> <label style="margin:0;">Bắt buộc trả lời</label></div>
              </div>
              ${isFreeText? `<div class="field"><label>&nbsp;</label>
                <div class="checkbox-row"><input type="checkbox" class="q-numeric" data-qid="${q.id}" ${q.numericOnly?'checked':''} ${canEdit?'':'disabled'}> <label style="margin:0;">🔢 Chỉ nhập số</label></div>
              </div>` : ''}
            </div>
            ${isFreeText? `<p class="sub" style="margin:4px 0;">${q.numericOnly? '🔢 Người trả lời chỉ được nhập chữ số và dấu phẩy (,) — tự động tách cụm 3 số khi gõ.' : ''}</p>` : ''}
            ${surveyQTypeHasOptions(q.type)? `
              <p class="sub" style="margin:4px 0;">${q.type==='checkbox'? '☑️ Được chọn NHIỀU phương án.' : '🔘 Chỉ được chọn 1 phương án.'}</p>
              <div class="q-options-list">
                ${(q.options||[]).map((opt,oi)=>`
                  <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;">
                    ${isQuiz? `<input type="checkbox" class="q-correct" data-qid="${q.id}" data-oi="${oi}" ${(q.correctAnswers||[]).includes(opt)?'checked':''} title="Đánh dấu là đáp án đúng" ${canEdit?'':'disabled'}>` : ''}
                    <input class="q-option-text" data-qid="${q.id}" data-oi="${oi}" value="${escapeHtml(opt)}" style="flex:1; min-width:120px;" placeholder="Phương án ${oi+1}" ${canEdit?'':'disabled'}>
                    ${hasBranch? `<select class="q-option-branch" data-qid="${q.id}" data-oi="${oi}" style="font-size:11.5px;" ${canEdit?'':'disabled'}>
                      <option value="__next__" ${(q.optionBranches&&q.optionBranches[oi])==='__next__'||!q.optionBranches?'selected':''}>→ Tiếp tục sang phần tiếp theo</option>
                      ${sections.map(s=>`<option value="${s.id}" ${(q.optionBranches&&q.optionBranches[oi])===s.id?'selected':''}>→ Chuyển đến "${escapeHtml(s.title)}"</option>`).join('')}
                      <option value="__submit__" ${(q.optionBranches&&q.optionBranches[oi])==='__submit__'?'selected':''}>→ Gửi biểu mẫu</option>
                    </select>` : ''}
                    ${canEdit? `<button class="btn btn-ghost btn-sm q-option-remove" data-qid="${q.id}" data-oi="${oi}">✕</button>` : ''}
                  </div>`).join('')}
              </div>
              ${canEdit? `<button class="btn btn-ghost btn-sm q-add-option" data-qid="${q.id}">➕ Thêm phương án</button>` : ''}
              ${isQuiz? `<div class="field" style="max-width:180px; margin-top:8px;"><label>Số điểm câu này</label><input type="number" class="q-points" data-qid="${q.id}" value="${q.points||0}" ${canEdit?'':'disabled'}></div>` : ''}
            ` : ''}
          </div>
          ${canEdit? `<div style="display:flex; flex-direction:column; gap:6px;">
            <button class="btn btn-ghost btn-sm q-duplicate" data-qid="${q.id}" title="Sao chép câu hỏi">📋</button>
            <button class="btn btn-ghost btn-sm q-delete" data-qid="${q.id}" title="Xoá câu hỏi" style="color:var(--red);">🗑️</button>
          </div>` : ''}
        </div>
      </div>
    </div>`;
  }

  function renderSurveyQuestionsEditorHtml(draft, canEdit){
    ensureSurveySections(draft);
    return `
      <div class="form-grid">
        <div class="field full"><label>Tiêu đề biểu mẫu *</label><input id="sv-title" value="${escapeHtml(draft.title)}" ${canEdit?'':'disabled'}></div>
        <div class="field full"><label>Mô tả biểu mẫu</label><textarea id="sv-desc" rows="2" ${canEdit?'':'disabled'}>${escapeHtml(draft.description)}</textarea></div>
      </div>
      <div class="checkbox-row" style="margin:10px 0;"><input type="checkbox" id="sv-isquiz" ${draft.isQuiz?'checked':''} ${canEdit?'':'disabled'}> <label style="margin:0;">📋 Đặt làm bài kiểm tra (cho phép chấm điểm đáp án đúng)</label></div>
      <div id="sv-sections-list">
        ${draft.sections.map((sec, si)=>{
          const secQuestions = draft.questions.filter(q=>q.sectionId===sec.id);
          return `
          <div class="panel" style="margin-bottom:16px; border:2px solid var(--gold);" data-section-card="${sec.id}">
            <div class="panel-head" style="background:rgba(199,154,43,.08);">
              <h3 style="font-size:13.5px;">📑 Phần ${si+1}/${draft.sections.length}</h3>
              ${canEdit && draft.sections.length>1? `<button class="btn btn-ghost btn-sm sec-delete" data-secid="${sec.id}" style="margin-left:auto; color:var(--red);">Xoá phần này</button>` : ''}
            </div>
            <div class="panel-body">
              <div class="form-grid">
                <div class="field full"><label>Tiêu đề phần</label><input class="sec-title" data-secid="${sec.id}" value="${escapeHtml(sec.title)}" ${canEdit?'':'disabled'}></div>
                <div class="field full"><label>Mô tả phần (không bắt buộc)</label><input class="sec-desc" data-secid="${sec.id}" value="${escapeHtml(sec.description||'')}" ${canEdit?'':'disabled'}></div>
              </div>
              ${secQuestions.map((q)=> renderSurveyQuestionCardHtml(q, draft.questions.indexOf(q), draft.isQuiz, canEdit, draft.sections)).join('')}
              ${canEdit? `<button class="btn btn-ghost btn-sm sec-add-question" data-secid="${sec.id}">➕ Thêm câu hỏi vào phần này</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
      ${canEdit? `<div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" id="sv-add-section-btn">➕ Thêm phần</button>
        <button class="btn btn-ghost" id="sv-import-question-btn">📥 Nhập câu hỏi từ biểu mẫu khác</button>
      </div>` : ''}`;
  }

  function renderSurveySummaryHtml(draft, responses){
    return draft.questions.map((q,qi)=>{
      const stats = computeQuestionStats(q, responses);
      let body;
      if(surveyQTypeHasOptions(q.type)){
        body = `<div style="display:flex; flex-direction:column; gap:8px;">${stats.map(s=>`
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px;"><span>${escapeHtml(s.opt)}</span><span>${s.cnt} (${s.pct}%)</span></div>
            <div style="background:var(--paper-2); border-radius:6px; height:8px; overflow:hidden;"><div style="width:${s.pct}%; height:100%; background:var(--gold);"></div></div>
          </div>`).join('')}</div>`;
      } else {
        body = stats.length? `<div style="display:flex; flex-direction:column; gap:6px; max-height:220px; overflow:auto;">${stats.map(a=>`<div class="kv-row" style="border:1px solid var(--line); border-radius:8px; padding:8px 10px;">${escapeHtml(a)}</div>`).join('')}</div>` : '<div class="sub">Chưa có câu trả lời nào cho câu này.</div>';
      }
      return `<div class="panel" style="margin-bottom:10px;"><div class="panel-head"><h3 style="font-size:14px;">${qi+1}. ${escapeHtml(q.text)}</h3></div><div class="panel-body">${body}</div></div>`;
    }).join('');
  }
  function renderSurveyResponseDetailHtml(draft, responses){
    const idx = Math.min(Math.max(0,state.surveyResponseViewIndex), responses.length-1);
    const r = responses[idx];
    return `
      <div class="toolbar" style="justify-content:center;">
        <button class="btn btn-ghost btn-sm" id="sv-resp-prev" ${idx<=0?'disabled':''}>◀ Trước</button>
        <b>Phiếu số ${idx+1} / ${responses.length}</b>
        <button class="btn btn-ghost btn-sm" id="sv-resp-next" ${idx>=responses.length-1?'disabled':''}>Sau ▶</button>
      </div>
      <p class="sub" style="text-align:center;">Nộp lúc: ${new Date(r.submittedAt).toLocaleString('vi-VN')}${draft.isQuiz? ` — Điểm: <b>${r.score||0}/${r.maxScore||0}</b>` : ''}</p>
      <div class="panel"><div class="panel-body">
        ${draft.questions.map((q,qi)=>{
          const ans = r.answers ? r.answers[q.id] : null;
          const ansText = Array.isArray(ans)? ans.join(', ') : (ans||'(không trả lời)');
          return `<div class="kv-row"><span>${qi+1}. ${escapeHtml(q.text)}</span><b>${escapeHtml(String(ansText))}</b></div>`;
        }).join('')}
      </div></div>`;
  }
  function renderSurveyAnswersTabHtml(draft){
    const responses = state.surveyResponses;
    return `
      <div class="toolbar" style="flex-wrap:wrap;">
        <b>Tổng số lượt trả lời: ${responses.length}</b>
        <div class="spacer"></div>
        ${responses.length? `<button class="btn btn-ghost btn-sm" id="sv-toggle-detail">${state.surveyResponseDetailOpen? '📊 Xem tổng hợp' : '👤 Xem từng phiếu'}</button>
        <button class="btn btn-ghost btn-sm" id="sv-export-excel-btn">⬇️ Xuất Excel</button>
        <button class="btn btn-ghost btn-sm" id="sv-print-btn">🖨️ In</button>` : ''}
      </div>
      ${responses.length? (state.surveyResponseDetailOpen? renderSurveyResponseDetailHtml(draft, responses) : renderSurveySummaryHtml(draft, responses))
        : `<div class="empty-state" style="padding:30px;"><div class="e-ico">📊</div>Chưa có ai trả lời biểu mẫu này.</div>`}`;
  }

  function renderSurveyEditorView(el){
    const draft = state.surveyDraft;
    const canEdit = surveyCanEdit();
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" id="sv-back-btn">◀ Danh sách</button>
          <h3 style="margin:0;">${state.surveyEditingId? 'Sửa biểu mẫu' : 'Tạo biểu mẫu mới'}</h3>
        </div>
        <div class="panel-body">
          <div class="toolbar" style="margin-bottom:14px; flex-wrap:wrap;">
            <button class="btn ${state.surveyEditorTab==='questions'?'btn-primary':'btn-ghost'} btn-sm" id="sv-tab-questions">📝 Câu hỏi</button>
            <button class="btn ${state.surveyEditorTab==='answers'?'btn-primary':'btn-ghost'} btn-sm" id="sv-tab-answers" ${!state.surveyEditingId?'disabled':''}>📊 Câu trả lời${draft.responseCount?` (${draft.responseCount})`:''}</button>
            <div class="spacer"></div>
            ${state.surveyEditingId? `<button class="btn btn-ghost btn-sm" id="sv-copylink-btn">🔗 Copy link chia sẻ</button>` : ''}
            ${canEdit && state.surveyEditorTab==='questions'? `<button class="btn btn-primary btn-sm" id="sv-save-btn">💾 Lưu biểu mẫu</button>` : ''}
          </div>
          <div id="sv-tab-content">
            ${state.surveyEditorTab==='questions'? renderSurveyQuestionsEditorHtml(draft, canEdit) : renderSurveyAnswersTabHtml(draft)}
          </div>
        </div>
      </div>`;
    wireSurveyEditor(el);
  }

  function wireSurveyEditor(el){
    const draft = state.surveyDraft;
    document.getElementById('sv-back-btn').onclick = ()=>{ state.surveyView='list'; state.surveyDraft=null; state.surveyEditingId=null; renderSurveyTab(el); };
    document.getElementById('sv-tab-questions').onclick = ()=>{ state.surveyEditorTab='questions'; renderSurveyTab(el); };
    const tabAnswersBtn = document.getElementById('sv-tab-answers');
    if(tabAnswersBtn) tabAnswersBtn.onclick = async ()=>{
      if(!state.surveyEditingId) return;
      state.surveyEditorTab='answers';
      await loadSurveyResponses(state.surveyEditingId);
      renderSurveyTab(el);
    };
    const copyBtn = document.getElementById('sv-copylink-btn');
    if(copyBtn) copyBtn.onclick = ()=> copyMessageText(surveyShareUrl(state.surveyEditingId));

    if(state.surveyEditorTab==='questions'){
      const titleInput = document.getElementById('sv-title'); if(titleInput) titleInput.oninput = e=> draft.title = e.target.value;
      const descInput = document.getElementById('sv-desc'); if(descInput) descInput.oninput = e=> draft.description = e.target.value;
      const quizToggle = document.getElementById('sv-isquiz'); if(quizToggle) quizToggle.onchange = e=>{ draft.isQuiz = e.target.checked; renderSurveyTab(el); };

      el.querySelectorAll('.q-text').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q.text = inp.value; });
      el.querySelectorAll('.q-type').forEach(sel=> sel.onchange = ()=>{
        const q=draft.questions.find(x=>x.id===sel.dataset.qid);
        if(q){
          q.type = sel.value;
          if(surveyQTypeHasOptions(q.type) && (!q.options||!q.options.length)) q.options=['Phương án 1'];
          if(!surveyQTypeHasOptions(q.type)) q.numericOnly = q.numericOnly||false;
          q.optionBranches = (q.options||[]).map((_,i)=> (q.optionBranches&&q.optionBranches[i]) || '__next__');
        }
        renderSurveyTab(el);
      });
      el.querySelectorAll('.q-required').forEach(cb=> cb.onchange = ()=>{ const q=draft.questions.find(x=>x.id===cb.dataset.qid); if(q) q.required = cb.checked; });
      el.querySelectorAll('.q-numeric').forEach(cb=> cb.onchange = ()=>{ const q=draft.questions.find(x=>x.id===cb.dataset.qid); if(q) q.numericOnly = cb.checked; renderSurveyTab(el); });
      el.querySelectorAll('.q-option-text').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q.options[parseInt(inp.dataset.oi,10)] = inp.value; });
      el.querySelectorAll('.q-option-branch').forEach(sel=> sel.onchange = ()=>{
        const q=draft.questions.find(x=>x.id===sel.dataset.qid); if(!q) return;
        q.optionBranches = q.optionBranches||[];
        q.optionBranches[parseInt(sel.dataset.oi,10)] = sel.value;
      });
      el.querySelectorAll('.q-correct').forEach(cb=> cb.onchange = ()=>{
        const q=draft.questions.find(x=>x.id===cb.dataset.qid); if(!q) return;
        const opt = q.options[parseInt(cb.dataset.oi,10)];
        q.correctAnswers = q.correctAnswers||[];
        if(q.type==='radio' || q.type==='dropdown'){ q.correctAnswers = cb.checked? [opt] : []; renderSurveyTab(el); }
        else { if(cb.checked){ if(!q.correctAnswers.includes(opt)) q.correctAnswers.push(opt); } else { q.correctAnswers = q.correctAnswers.filter(a=>a!==opt); } }
      });
      el.querySelectorAll('.q-points').forEach(inp=> inp.oninput = ()=>{ const q=draft.questions.find(x=>x.id===inp.dataset.qid); if(q) q.points = parseFloat(inp.value)||0; });
      el.querySelectorAll('.q-add-option').forEach(btn=> btn.onclick = ()=>{
        const q=draft.questions.find(x=>x.id===btn.dataset.qid);
        if(q){ q.options = q.options||[]; q.options.push(`Phương án ${q.options.length+1}`); q.optionBranches = q.optionBranches||[]; q.optionBranches.push('__next__'); }
        renderSurveyTab(el);
      });
      el.querySelectorAll('.q-option-remove').forEach(btn=> btn.onclick = ()=>{
        const q=draft.questions.find(x=>x.id===btn.dataset.qid); if(!q) return;
        const oi = parseInt(btn.dataset.oi,10);
        const removedOpt = q.options[oi];
        q.options.splice(oi,1);
        if(q.optionBranches) q.optionBranches.splice(oi,1);
        q.correctAnswers = (q.correctAnswers||[]).filter(a=>a!==removedOpt);
        renderSurveyTab(el);
      });
      el.querySelectorAll('.q-duplicate').forEach(btn=> btn.onclick = ()=>{
        const idx = draft.questions.findIndex(x=>x.id===btn.dataset.qid);
        if(idx<0) return;
        const copy = JSON.parse(JSON.stringify(draft.questions[idx]));
        copy.id = 'q_'+uid();
        draft.questions.splice(idx+1,0,copy);
        renderSurveyTab(el);
      });
      el.querySelectorAll('.q-delete').forEach(btn=> btn.onclick = ()=>{
        if(draft.questions.length<=1){ alert('Biểu mẫu cần có ít nhất 1 câu hỏi.'); return; }
        draft.questions = draft.questions.filter(x=>x.id!==btn.dataset.qid);
        renderSurveyTab(el);
      });
      // ---- Quản lý Phần (Section) — giống Google Forms: nhiều phần, mỗi phần nhiều câu hỏi ----
      el.querySelectorAll('.sec-title').forEach(inp=> inp.oninput = ()=>{ const s=draft.sections.find(x=>x.id===inp.dataset.secid); if(s) s.title = inp.value; });
      el.querySelectorAll('.sec-desc').forEach(inp=> inp.oninput = ()=>{ const s=draft.sections.find(x=>x.id===inp.dataset.secid); if(s) s.description = inp.value; });
      el.querySelectorAll('.sec-add-question').forEach(btn=> btn.onclick = ()=>{ draft.questions.push(emptySurveyQuestion(btn.dataset.secid)); renderSurveyTab(el); });
      el.querySelectorAll('.sec-delete').forEach(btn=> btn.onclick = ()=>{
        if(draft.sections.length<=1){ alert('Biểu mẫu cần có ít nhất 1 phần.'); return; }
        const secIdx = draft.sections.findIndex(s=>s.id===btn.dataset.secid);
        if(secIdx<0) return;
        if(!confirm('Xoá phần này? Các câu hỏi trong phần sẽ được chuyển sang phần liền trước (hoặc phần đầu tiên).')) return;
        const fallbackSec = draft.sections[secIdx>0? secIdx-1 : 1];
        draft.questions.forEach(q=>{ if(q.sectionId===btn.dataset.secid) q.sectionId = fallbackSec.id; });
        // Mọi phân nhánh đang trỏ tới phần bị xoá -> chuyển về "Tiếp tục sang phần tiếp theo"
        draft.questions.forEach(q=>{ if(q.optionBranches) q.optionBranches = q.optionBranches.map(b=> b===btn.dataset.secid? '__next__' : b); });
        draft.sections.splice(secIdx,1);
        renderSurveyTab(el);
      });
      const addSectionBtn = document.getElementById('sv-add-section-btn');
      if(addSectionBtn) addSectionBtn.onclick = ()=>{ draft.sections.push(emptySurveySection(draft.sections.length+1)); renderSurveyTab(el); };
      const importBtn = document.getElementById('sv-import-question-btn'); if(importBtn) importBtn.onclick = ()=> renderImportQuestionsModal(el);
      const saveBtn = document.getElementById('sv-save-btn'); if(saveBtn) saveBtn.onclick = async ()=>{ if(await saveSurveyDraft()){ showToast('Đã lưu biểu mẫu!'); renderSurveyTab(el); } };
    } else {
      const toggleBtn = document.getElementById('sv-toggle-detail');
      if(toggleBtn) toggleBtn.onclick = ()=>{ state.surveyResponseDetailOpen = !state.surveyResponseDetailOpen; renderSurveyTab(el); };
      const prevBtn = document.getElementById('sv-resp-prev'); if(prevBtn) prevBtn.onclick = ()=>{ state.surveyResponseViewIndex--; renderSurveyTab(el); };
      const nextBtn = document.getElementById('sv-resp-next'); if(nextBtn) nextBtn.onclick = ()=>{ state.surveyResponseViewIndex++; renderSurveyTab(el); };
      const exportBtn = document.getElementById('sv-export-excel-btn'); if(exportBtn) exportBtn.onclick = ()=> renderSurveyExportPreviewModal(draft, state.surveyResponses);
      const printBtn = document.getElementById('sv-print-btn'); if(printBtn) printBtn.onclick = ()=> printSurveyResponses(draft, state.surveyResponses);
    }
  }

  function renderImportQuestionsModal(el){
    const others = state.surveys.filter(s=> s.id !== state.surveyEditingId);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>📥 Nhập câu hỏi từ biểu mẫu khác</h3><button class="modal-close" id="svi-close">✕</button></div>
        <div class="modal-body">
          ${others.length? others.map(s=>`
            <div class="divider-lbl">${escapeHtml(s.title)}</div>
            ${(s.questions||[]).map(q=>`
              <label class="checkbox-row" style="display:flex; align-items:flex-start; gap:8px; margin-bottom:6px;">
                <input type="checkbox" class="svi-check" data-sid="${s.id}" data-qid="${q.id}">
                <span>${escapeHtml(q.text)} <span class="sub">(${surveyQTypeLabel(q.type)})</span></span>
              </label>`).join('')}
          `).join('') : `<div class="empty-state">Chưa có biểu mẫu nào khác để nhập câu hỏi.</div>`}
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="svi-cancel">Đóng</button>
          ${others.length? `<button class="btn btn-primary" id="svi-import">Nhập câu hỏi đã chọn</button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#svi-close').onclick = close;
    wrap.querySelector('#svi-cancel').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    const importBtn = wrap.querySelector('#svi-import');
    if(importBtn) importBtn.onclick = ()=>{
      const checks = wrap.querySelectorAll('.svi-check:checked');
      if(!checks.length){ alert('Vui lòng chọn ít nhất 1 câu hỏi để nhập.'); return; }
      checks.forEach(cb=>{
        const survey = others.find(s=>s.id===cb.dataset.sid);
        const q = survey && (survey.questions||[]).find(x=>x.id===cb.dataset.qid);
        if(q){
          const copy = JSON.parse(JSON.stringify(q));
          copy.id = 'q_'+uid();
          ensureSurveySections(state.surveyDraft);
          copy.sectionId = state.surveyDraft.sections[state.surveyDraft.sections.length-1].id; // thêm vào phần cuối cùng
          copy.optionBranches = (copy.options||[]).map(()=>'__next__'); // reset phân nhánh (phần của biểu mẫu gốc không tồn tại ở đây)
          state.surveyDraft.questions.push(copy);
        }
      });
      close();
      renderSurveyTab(el);
    };
  }

  function surveyExportRows(draft, responses){
    const headers = ['STT','Thời gian nộp', ...draft.questions.map(q=>q.text)];
    if(draft.isQuiz) headers.push('Điểm');
    const rows = responses.map((r,i)=>{
      const row = [i+1, new Date(r.submittedAt).toLocaleString('vi-VN')];
      draft.questions.forEach(q=>{
        const ans = r.answers? r.answers[q.id] : '';
        row.push(Array.isArray(ans)? ans.join(', ') : (ans||''));
      });
      if(draft.isQuiz) row.push(`${r.score||0}/${r.maxScore||0}`);
      return row;
    });
    return { headers, rows };
  }
  function renderSurveyExportPreviewModal(draft, responses){
    const { headers, rows } = surveyExportRows(draft, responses);
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:920px;">
        <div class="modal-head"><h3>👁️ Xem trước file Excel</h3><button class="modal-close" id="svx-close">✕</button></div>
        <div class="modal-body">
          <div class="table-wrap"><table>
            <thead><tr>${headers.map(h=>`<th>${escapeHtml(String(h))}</th>`).join('')}</tr></thead>
            <tbody>${rows.length? rows.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">Không có dữ liệu</td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="svx-cancel">Đóng</button>
          <button class="btn btn-primary" id="svx-confirm">⬇️ Xuất file Excel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#svx-close').onclick = close;
    wrap.querySelector('#svx-cancel').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#svx-confirm').onclick = async ()=>{
      try{ await exportSurveyExcel(draft, headers, rows); close(); }
      catch(e){ console.error('[Xuất kết quả khảo sát] Lỗi:', e); alert('Không thể tải thư viện xuất Excel. Vui lòng kiểm tra kết nối mạng rồi thử lại.'); }
    };
  }
  async function exportSurveyExcel(draft, headers, rows){
    await loadOptionalLibrary('xlsx');
    const headerLines = [ ['HỘI NÔNG DÂN'], [wardTitleUpper()], [provinceTitle()], [`KẾT QUẢ KHẢO SÁT: ${draft.title}`], [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`], [] ];
    const aoa = [...headerLines, headers.map(h=>String(h).toUpperCase()), ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applyExcelCellFormatting(ws, aoa, headerLines.length);
    boldExcelRow(ws, 3); // dòng tiêu đề file (VD "KẾT QUẢ KHẢO SÁT: ...") — đã +1 do thêm dòng "HỘI NÔNG DÂN" tách riêng ở trên
    const lastCol = Math.max(0, headers.length-1);
    ws['!merges'] = headerLines.map((line,r)=> (line.length? {s:{r,c:0}, e:{r,c:lastCol}} : null)).filter(Boolean);
    ws['!cols'] = headers.map(()=>({wch:22}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ket qua khao sat');
    XLSX.writeFile(wb, `Khao-sat_${todayStr()}.xlsx`, {cellStyles:true});
  }
  function printSurveyResponses(draft, responses){
    const area = document.getElementById('print-area');
    if(!area) return;
    const { headers, rows } = surveyExportRows(draft, responses);
    const ncols = headers.length;
    let fontSize=12.5, pad='6px 8px';
    if(ncols>16){ fontSize=7; pad='2px 3px'; } else if(ncols>12){ fontSize=8; pad='3px 4px'; } else if(ncols>9){ fontSize=9.5; pad='4px 5px'; } else if(ncols>6){ fontSize=11; pad='5px 6px'; }
    area.innerHTML = `
      <div style="text-align:center;">
        <div style="font-weight:800; font-size:14px;">${hoiNongDanTitleHtml()}</div>
        <div style="font-size:12.5px;">${escapeHtml(provinceTitle())}</div>
      </div>
      <div class="print-title" style="margin:10px 0 4px; text-align:center;">KẾT QUẢ KHẢO SÁT: ${escapeHtml(draft.title)}</div>
      <div style="text-align:center; font-size:12px; margin-bottom:10px;">Thời gian xuất: ${new Date().toLocaleString('vi-VN')}</div>
      <table class="print-table" style="font-size:${fontSize}px;">
        <thead><tr>${headers.map(h=>`<th style="padding:${pad};">${escapeHtml(String(h))}</th>`).join('')}</tr></thead>
        <tbody>${rows.length? rows.map(r=>`<tr>${r.map(c=>`<td style="padding:${pad};">${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${ncols}" style="padding:${pad};">Không có dữ liệu</td></tr>`}</tbody>
      </table>
      <div style="text-align:center; margin-top:18px; font-size:11px;">https://hoinongdan.sotay.org</div>`;
    area.classList.add('landscape');
    window.print();
    setTimeout(()=> area.classList.remove('landscape'), 800);
  }

  // =====================================================================
  // GIAO DIỆN CÔNG KHAI ĐIỀN PHIẾU — truy cập qua link chia sẻ dạng
  // https://.../#/khaosat/{surveyId}, KHÔNG cần đăng nhập, KHÔNG hiện menu/nút Admin.
  // =====================================================================
  function publicSurveyRouteId(){
    const m = (window.location.hash||'').match(/^#\/khaosat\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function renderPublicSurveyPage(surveyId){
    document.body.classList.add('public-survey-mode');
    root.innerHTML = '<div class="center-screen">Đang tải biểu mẫu…</div>';
    let survey = null, submitted = false, lastResult = null;
    let surveyLoadState = 'loading';
    let surveyLoadError = '';
    let currentSectionIdx = 0;
    const collected = {}; // câu trả lời đã thu thập được, giữ lại xuyên suốt các Phần

    function renderPublicQuestionHtml(q, qi){
      const label = `${qi+1}. ${escapeHtml(q.text)}${q.required? ' <span style="color:var(--red);">*</span>' : ''}`;
      const isNumeric = (q.type==='short' || q.type==='paragraph') && q.numericOnly;
      const prevVal = collected[q.id];
      let field = '';
      if(q.type==='short') field = `<input class="ps-answer" data-qid="${q.id}" data-type="short" ${isNumeric?'data-numeric="1" inputmode="decimal"':''} value="${escapeHtml(prevVal||'')}">${isNumeric? `<div class="sub" data-numeric-disp="${q.id}" style="text-align:right; font-weight:700; margin-top:4px;"></div>` : ''}`;
      else if(q.type==='paragraph') field = `<textarea class="ps-answer" data-qid="${q.id}" data-type="paragraph" rows="3" ${isNumeric?'data-numeric="1" inputmode="decimal"':''}>${escapeHtml(prevVal||'')}</textarea>${isNumeric? `<div class="sub" data-numeric-disp="${q.id}" style="text-align:right; font-weight:700; margin-top:4px;"></div>` : ''}`;
      else if(q.type==='dropdown') field = `<select class="ps-answer" data-qid="${q.id}" data-type="dropdown"><option value="">-- Chọn --</option>${(q.options||[]).map(o=>`<option value="${escapeHtml(o)}" ${prevVal===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select>`;
      else if(q.type==='radio') field = `<div>${(q.options||[]).map(o=>`<label class="checkbox-row" style="display:flex; gap:8px; margin-bottom:4px; font-weight:400;"><input type="radio" name="ps-q-${q.id}" class="ps-answer" data-qid="${q.id}" data-type="radio" value="${escapeHtml(o)}" ${prevVal===o?'checked':''}> ${escapeHtml(o)}</label>`).join('')}</div>`;
      else if(q.type==='checkbox') field = `<div>${(q.options||[]).map(o=>`<label class="checkbox-row" style="display:flex; gap:8px; margin-bottom:4px; font-weight:400;"><input type="checkbox" class="ps-answer" data-qid="${q.id}" data-type="checkbox" value="${escapeHtml(o)}" ${(Array.isArray(prevVal)&&prevVal.includes(o))?'checked':''}> ${escapeHtml(o)}</label>`).join('')}</div>`;
      return `<div class="field full" style="margin-bottom:18px;"><label>${label}</label>${field}</div>`;
    }

    function renderFillForm(){
      if(surveyLoadState==='loading'){
        root.innerHTML = `<div class="center-screen"><div class="auth-card"><div class="rice-badge">📝</div><h1>Đang tải biểu mẫu…</h1><p class="sub">Vui lòng chờ trong giây lát.</p></div></div>`;
        return;
      }
      if(surveyLoadState==='error'){
        root.innerHTML = `<div class="center-screen"><div class="auth-card"><div class="rice-badge">⚠️</div><h1>Không tải được biểu mẫu</h1><p class="sub">Có thể kết nối mạng đang gặp sự cố hoặc biểu mẫu tạm thời không thể truy cập. Vui lòng thử lại.</p><button class="btn btn-primary btn-block" id="ps-retry-btn" style="margin-top:14px;">↻ Thử lại</button></div></div>`;
        const retryBtn = document.getElementById('ps-retry-btn');
        if(retryBtn) retryBtn.onclick = loadSurvey;
        return;
      }
      if(surveyLoadState==='notFound' || !survey){
        root.innerHTML = `<div class="center-screen"><div class="auth-card"><div class="rice-badge">📝</div><h1>Không tìm thấy biểu mẫu</h1><p class="sub">Đường link này có thể đã bị xoá hoặc không tồn tại.</p></div></div>`;
        return;
      }
      if(submitted){
        root.innerHTML = `
          <div class="center-screen"><div class="auth-card" style="max-width:520px;">
            <div class="rice-badge">✅</div>
            <h1>Bạn đã gửi câu trả lời thành công!</h1>
            <p class="sub">Cảm ơn bạn đã tham gia ${survey.isQuiz? 'bài kiểm tra':'khảo sát'} "${escapeHtml(survey.title)}".</p>
            ${survey.isQuiz? `<button class="btn btn-primary btn-block" id="ps-viewscore-btn" style="margin-top:14px;">Xem điểm số</button><div id="ps-score-area" style="margin-top:14px;"></div>` : ''}
          </div></div>`;
        const scoreBtn = document.getElementById('ps-viewscore-btn');
        if(scoreBtn) scoreBtn.onclick = ()=>{
          document.getElementById('ps-score-area').innerHTML = `<div class="kv-row"><span>Điểm số của bạn</span><b>${lastResult.score||0} / ${lastResult.maxScore||0}</b></div>`;
          scoreBtn.remove();
        };
        return;
      }
      const sections = survey.sections;
      const sec = sections[currentSectionIdx] || sections[0];
      const secQuestions = (survey.questions||[]).filter(q=>q.sectionId===sec.id);
      const isLastSection = currentSectionIdx >= sections.length-1;
      root.innerHTML = `
        <div class="center-screen">
          <div class="auth-card" style="max-width:640px; text-align:left;">
            <h1>${escapeHtml(survey.title)}</h1>
            ${survey.description? `<p class="sub" style="white-space:pre-wrap;">${escapeHtml(survey.description)}</p>` : ''}
            ${sections.length>1? `<div style="background:var(--paper-2); border-radius:8px; padding:8px 12px; margin:10px 0; font-size:12.5px;"><b>Phần ${currentSectionIdx+1}/${sections.length}</b>${sec.title? ' — '+escapeHtml(sec.title) : ''}${sec.description? `<div class="sub" style="margin-top:4px;">${escapeHtml(sec.description)}</div>` : ''}</div>` : ''}
            <div id="ps-questions">${secQuestions.map((q,qi)=> renderPublicQuestionHtml(q, qi)).join('')}</div>
            <button class="btn btn-primary btn-block" id="ps-next-btn" style="margin-top:6px;">${isLastSection? 'GỬI BÀI' : 'TIẾP'}</button>
            ${survey.wardName? `<p class="sub" style="text-align:center; margin-top:14px;">Biểu mẫu bởi Hội Nông dân ${escapeHtml(survey.wardName)}</p>` : ''}
          </div>
        </div>`;
      root.querySelectorAll('[data-numeric="1"]').forEach(inp=> attachPublicNumericMask(inp));

      document.getElementById('ps-next-btn').onclick = async ()=>{
        let missingRequired = false;
        let branchTarget = null; // '__next__' | '__submit__' | sectionId | null (không có phân nhánh)
        secQuestions.forEach(q=>{
          const isNumeric = (q.type==='short' || q.type==='paragraph') && q.numericOnly;
          let val;
          if(q.type==='checkbox'){ val = Array.from(document.querySelectorAll(`.ps-answer[data-qid="${q.id}"]:checked`)).map(x=>x.value); }
          else if(q.type==='radio'){ const x=document.querySelector(`.ps-answer[data-qid="${q.id}"]:checked`); val = x? x.value : ''; }
          else { const x=document.querySelector(`.ps-answer[data-qid="${q.id}"]`); val = x? x.value.trim() : ''; if(isNumeric) val = val.replace(/\s/g,''); }
          collected[q.id] = val;
          if(q.required && (val==null || val==='' || (Array.isArray(val)&&val.length===0))) missingRequired = true;
          if(branchTarget===null && (q.type==='radio'||q.type==='checkbox') && q.optionBranches && q.optionBranches.length){
            const selectedOpts = Array.isArray(val) ? val : (val? [val] : []);
            for(const so of selectedOpts){
              const oi = (q.options||[]).indexOf(so);
              if(oi>=0 && q.optionBranches[oi] && q.optionBranches[oi]!=='__next__'){ branchTarget = q.optionBranches[oi]; break; }
            }
          }
        });
        if(missingRequired){ alert('Vui lòng điền đầy đủ các câu hỏi bắt buộc (có dấu *) trước khi tiếp tục.'); return; }

        if(isLastSection || branchTarget==='__submit__'){
          const result = await submitPublicSurveyResponse(survey, collected);
          if(!result.ok){
            alert(result.reason==='missing' ? 'Vui lòng điền đầy đủ các câu hỏi bắt buộc (có dấu *) trước khi gửi.' : 'Gửi câu trả lời thất bại, vui lòng kiểm tra kết nối mạng và thử lại.');
            return;
          }
          submitted = true; lastResult = result.entry;
          renderFillForm();
          return;
        }
        if(branchTarget && branchTarget!=='__next__'){
          const idx = sections.findIndex(s=>s.id===branchTarget);
          currentSectionIdx = idx>=0 ? idx : currentSectionIdx+1;
        } else {
          currentSectionIdx = currentSectionIdx+1;
        }
        renderFillForm();
      };
    }

    async function loadSurvey(){
      surveyLoadState = 'loading';
      surveyLoadError = '';
      survey = null;
      renderFillForm();
      try{
        const snap = await rtdb.ref(`surveys/${surveyId}`).get();
        const nextSurvey = (snap && snap.exists()) ? snap.val() : null;
        if(!nextSurvey || nextSurvey.deleted){
          surveyLoadState = 'notFound';
          survey = null;
        }else{
          ensureSurveySections(nextSurvey);
          survey = nextSurvey;
          surveyLoadState = 'ready';
        }
      }catch(e){
        console.error('[Khảo sát công khai] Không tải được biểu mẫu:', e);
        surveyLoadError = String(e && e.code || 'load_failed');
        surveyLoadState = 'error';
        survey = null;
      }
      renderFillForm();
    }
    loadSurvey();
  }


  // =====================================================================
  // Module [CÀI ĐẶT ADMIN] — chỉ hiển thị & truy cập được với isAdmin()===true.
  // 3 khu vực: (1) Quản lý Admin, (2) Cấu hình AI (Gemini...), (3) Quản lý toàn bộ hệ thống.
  // =====================================================================
  // =====================================================================
  // Module [Huấn luyện AI (Admin)] — "Bàn làm việc" dạng cây thư mục để Admin nạp tri thức nền
  // dùng CHUNG cho mọi mô hình AI (Gemini/ChatGPT/Claude ở mọi tầng dự phòng). Lưu trữ:
  //   • system_knowledge/tree/{id} — metadata cây thư mục/tệp (Realtime Database, đồng bộ realtime)
  //   • system_knowledge_files/{id}_{tên tệp} — file GỐC (.docx/.xlsx/ảnh) trên Firebase Storage
  // (Ghi chú: hệ thống hiện tại dùng Firebase Realtime Database cho toàn bộ dữ liệu — nên module
  // này cũng dùng Realtime Database thay vì Firestore để đồng bộ kiến trúc, cộng thêm Firebase
  // Storage đúng như yêu cầu để lưu file nhị phân gốc.)
  // =====================================================================
  let knowledgeListenerRef = null;
  function attachKnowledgeRealtime(){
    if(knowledgeListenerRef) return; // đã lắng nghe rồi, không gắn trùng
    knowledgeListenerRef = rtdb.ref('system_knowledge/tree');
    knowledgeListenerRef.on('value', snap=>{
      state.knowledgeTree = (snap && snap.exists()) ? snap.val() : {};
      state._systemKnowledgeCache = null; // dữ liệu vừa đổi -> làm mới bộ nhớ đệm ở lượt chat AI kế tiếp
      if(state.activeTab==='knowledgeBase'){
        const mount = document.getElementById('content');
        if(mount) renderAdminKnowledgeTab(mount);
      }
    });
  }
  function detachKnowledgeRealtime(){
    if(knowledgeListenerRef){ knowledgeListenerRef.off(); knowledgeListenerRef = null; }
  }
  function uidKn(){ return 'kn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }

  async function knCreateFolder(name, parentId){
    if(!isAdmin()) return;
    const nm = (name||'').trim();
    if(!nm){ alert('Vui lòng nhập tên thư mục.'); return; }
    const id = uidKn();
    await rtdb.ref(`system_knowledge/tree/${id}`).set({
      id, type:'folder', parentId: parentId||null, name:nm,
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), deleted:false,
    });
  }
  async function knCreateTextFile(name, parentId){
    if(!isAdmin()) return null;
    const id = uidKn();
    await rtdb.ref(`system_knowledge/tree/${id}`).set({
      id, type:'file', fileKind:'text', parentId: parentId||null, name:(name||'').trim() || 'Tài liệu mới', content:'',
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), deleted:false,
    });
    return id;
  }
  async function knSaveTextFile(id, content){
    if(!isAdmin()) return;
    await rtdb.ref(`system_knowledge/tree/${id}`).update({ content: content||'', updatedAt:new Date().toISOString() });
  }
  async function knRenameNode(id, newName){
    if(!isAdmin()) return;
    const nm = (newName||'').trim();
    if(!nm) return;
    await rtdb.ref(`system_knowledge/tree/${id}`).update({ name:nm, updatedAt:new Date().toISOString() });
  }
  // Quét ra toàn bộ hậu duệ (con, cháu...) của 1 thư mục — phục vụ xoá/khôi phục theo lô.
  function knDescendantsOf(id){
    const out = []; const stack = [id];
    while(stack.length){
      const cur = stack.pop();
      Object.values(state.knowledgeTree||{}).forEach(n=>{ if(n && n.parentId===cur){ out.push(n.id); stack.push(n.id); } });
    }
    return out;
  }
  async function knSoftDeleteNode(id){
    if(!isAdmin()) return;
    const node = state.knowledgeTree[id];
    if(!node) return;
    if(!confirm(`Xoá "${node.name}" vào thùng rác${node.type==='folder'?' (cùng toàn bộ nội dung bên trong thư mục)':''}? Có thể khôi phục lại sau.`)) return;
    const ids = node.type==='folder' ? [id, ...knDescendantsOf(id)] : [id];
    const updates = {};
    ids.forEach(nid=>{ updates[`${nid}/deleted`] = true; updates[`${nid}/deletedAt`] = new Date().toISOString(); });
    await rtdb.ref('system_knowledge/tree').update(updates);
  }
  async function knRestoreNode(id){
    if(!isAdmin()) return;
    await rtdb.ref(`system_knowledge/tree/${id}`).update({ deleted:false, deletedAt:null });
  }
  async function knPurgeNode(id){
    if(!isAdmin()) return;
    const node = state.knowledgeTree[id];
    if(!node) return;
    if(!confirm(`XOÁ VĨNH VIỄN "${node.name}"? Không thể khôi phục lại được nữa.`)) return;
    const ids = node.type==='folder' ? [id, ...knDescendantsOf(id)] : [id];
    for(const nid of ids){
      const n = state.knowledgeTree[nid];
      if(n && n.storagePath){ try{ await storage.ref(n.storagePath).delete(); }catch(e){ console.warn('Xoá tệp trên Storage lỗi (bỏ qua):', e); } }
    }
    const updates = {};
    ids.forEach(nid=> updates[nid] = null);
    await rtdb.ref('system_knowledge/tree').update(updates);
  }
  // Tải file .docx/.xlsx/ảnh lên Firebase Storage, đồng thời trích xuất nội dung văn bản (nếu có
  // thể) để nạp vào "Bối cảnh tri thức" dùng chung cho AI.
  async function knUploadFile(file, parentId, kind){
    if(!isAdmin() || !file) return;
    const MAX_MB = 20;
    if(file.size > MAX_MB*1024*1024){ alert(`Tệp "${file.name}" vượt quá ${MAX_MB}MB, vui lòng chọn tệp nhỏ hơn.`); return; }
    state.knowledgeUploading = true;
    const mountBefore = document.getElementById('content');
    if(mountBefore && state.activeTab==='knowledgeBase') renderAdminKnowledgeTab(mountBefore);
    const id = uidKn();
    try{
      const storagePath = `system_knowledge_files/${id}_${file.name}`;
      const stRef = storage.ref(storagePath);
      await stRef.put(file);
      const storageUrl = await stRef.getDownloadURL();
      let content = '';
      let extractionFailure = '';
      if(kind==='docx'){
        try{
          await loadOptionalLibrary('mammoth');
          const buf = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer: buf });
          content = (result && result.value) || '';
        }catch(e){
          console.error('Trích xuất nội dung Word lỗi:', e);
          extractionFailure = `Không thể trích xuất nội dung Word: ${e && e.message ? e.message : e}`;
        }
      } else if(kind==='xlsx' || kind==='xls'){
        try{
          await loadOptionalLibrary('xlsx');
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type:'array' });
          content = wb.SheetNames.map(sn=> `--- Trang tính: ${sn} ---\n` + XLSX.utils.sheet_to_csv(wb.Sheets[sn])).join('\n\n');
        }catch(e){
          console.error('Trích xuất nội dung Excel lỗi:', e);
          extractionFailure = `Không thể trích xuất nội dung Excel: ${e && e.message ? e.message : e}`;
        }
      } else if(kind==='image'){
        content = prompt(`Mô tả ngắn gọn nội dung ảnh "${file.name}" (để AI hiểu ý nghĩa của ảnh, vd: "Sơ đồ quy trình xét duyệt hồ sơ vay vốn gồm 5 bước: ...")`, '') || '';
      }
      if(extractionFailure){
        content = `[TỆP GỐC ĐÃ ĐƯỢC LƯU NHƯNG KHÔNG TRÍCH XUẤT ĐƯỢC NỘI DUNG]\n${extractionFailure}\n\nVui lòng thử lại hoặc tải lại tệp khi kết nối mạng ổn định.`;
      }
      await rtdb.ref(`system_knowledge/tree/${id}`).set({
        id, type:'file', fileKind:kind, parentId: parentId||null, name:file.name,
        content, storagePath, storageUrl, mimeType:file.type||'', sizeBytes:file.size,
        createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), deleted:false,
      });
      if(extractionFailure){
        alert(`Tệp "${file.name}" đã được lưu trên Firebase Storage nhưng không thể trích xuất nội dung. Vui lòng thử lại hoặc tải lại tệp khi kết nối mạng ổn định.`);
      }
    }catch(e){
      console.error('Tải tệp lên Firebase Storage lỗi:', e);
      alert(`Không thể tải tệp "${file.name}" lên. Vui lòng kiểm tra kết nối mạng hoặc cấu hình Firebase Storage (bucket/CORS/luật bảo mật).`);
    }finally{
      state.knowledgeUploading = false;
      const mountAfter = document.getElementById('content');
      if(mountAfter && state.activeTab==='knowledgeBase') renderAdminKnowledgeTab(mountAfter);
    }
  }

  // ---------------------------------------------------------------------
  // Hàm bổ trợ NGẦM dùng CHUNG cho mọi model AI (mọi tầng dự phòng): quét toàn bộ file văn bản/
  // Word/Excel/mô tả ảnh đang có trong kho tri thức system_knowledge/ và gộp thành 1 chuỗi lớn
  // ("Bối cảnh tri thức") để nạp kèm System Instruction khi AI trả lời.
  // ---------------------------------------------------------------------
  async function getSystemKnowledge(){
    try{
      const snap = await rtdb.ref('system_knowledge/tree').get();
      if(!snap || !snap.exists()) return '';
      const nodes = snap.val();
      function pathOf(n){
        const parts = [n.name]; let p = n.parentId; let guard = 0;
        while(p && nodes[p] && guard++ < 20){ parts.unshift(nodes[p].name); p = nodes[p].parentId; }
        return parts.join(' / ');
      }
      const files = Object.values(nodes).filter(n=> n && n.type==='file' && !n.deleted && (n.content||'').trim());
      if(!files.length) return '';
      const MAX_CHARS = 60000; // giới hạn an toàn để không làm prompt quá dài/tốn phí
      let combined = '';
      for(const f of files){
        const block = `\n\n===== [${pathOf(f)}] =====\n${f.content.trim()}`;
        if((combined.length + block.length) > MAX_CHARS) break;
        combined += block;
      }
      return combined.trim();
    }catch(e){ console.error('Không tải được kho tri thức hệ thống (system_knowledge):', e); return ''; }
  }
  // Bản có bộ nhớ đệm (2 phút, hoặc làm mới ngay khi Admin vừa chỉnh sửa qua realtime listener ở
  // trên) — tránh phải quét lại toàn bộ Firebase mỗi lần người dùng gửi 1 tin nhắn chat AI.
  async function getSystemKnowledgeCached(){
    const now = Date.now();
    if(state._systemKnowledgeCache!=null && (now - state._systemKnowledgeCacheAt) < 120000){
      return state._systemKnowledgeCache;
    }
    const text = await getSystemKnowledge();
    state._systemKnowledgeCache = text;
    state._systemKnowledgeCacheAt = now;
    return text;
  }

  function knChildrenOf(parentId){
    return Object.values(state.knowledgeTree||{})
      .filter(n=> n && !n.deleted && (n.parentId||null) === (parentId||null))
      .sort((a,b)=>{ if(a.type!==b.type) return a.type==='folder'? -1 : 1; return (a.name||'').localeCompare(b.name||''); });
  }
  function knBreadcrumb(folderId){
    const path = []; let cur = folderId; let guard = 0;
    while(cur && state.knowledgeTree[cur] && guard++ < 20){ path.unshift(state.knowledgeTree[cur]); cur = state.knowledgeTree[cur].parentId; }
    return path;
  }
  function knFileIcon(node){
    if(node.type==='folder') return '📁';
    if(node.fileKind==='docx') return '📄';
    if(node.fileKind==='xlsx') return '📊';
    if(node.fileKind==='image') return '🖼️';
    return '📝';
  }
  function knFileKindLabel(kind){ return {text:'Văn bản', docx:'Word', xlsx:'Excel', image:'Ảnh'}[kind] || ''; }

  // Khung soạn thảo/xem nội dung 1 file tri thức — dùng chung cho cả file gõ tay lẫn nội dung đã
  // trích xuất từ Word/Excel/mô tả ảnh (Admin có thể chỉnh sửa lại cho chính xác hơn rồi Lưu).
  function knOpenFileEditor(id){
    const node = state.knowledgeTree[id];
    if(!node) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `
      <div class="modal" style="max-width:760px;">
        <div class="modal-body">
          <h3 style="margin-top:0;">${knFileIcon(node)} ${escapeHtml(node.name)}</h3>
          ${node.fileKind==='image' && node.storageUrl? `<img src="${node.storageUrl}" style="max-width:100%; max-height:240px; border-radius:10px; margin-bottom:10px; display:block;">` : ''}
          ${node.storageUrl && node.fileKind!=='image'? `<p class="sub"><a href="${node.storageUrl}" target="_blank" rel="noopener">📎 Xem/tải file gốc</a></p>` : ''}
          <p class="sub" style="margin-top:0;">${node.fileKind==='text'? 'Nội dung này sẽ được AI đọc trực tiếp làm tri thức nền.' : 'Nội dung trích xuất bên dưới sẽ được AI đọc làm tri thức nền — bạn có thể chỉnh sửa lại cho chính xác/gọn gàng hơn nếu cần.'}</p>
          <textarea id="kn-editor-textarea" rows="16" style="width:100%; font-family:inherit; font-size:13.5px; padding:12px; border:1px solid var(--line); border-radius:10px; resize:vertical;">${escapeHtml(node.content||'')}</textarea>
          <div style="display:flex; gap:10px; margin-top:14px;">
            <button class="btn btn-ghost" id="kn-editor-close" style="flex:1;">Đóng</button>
            <button class="btn btn-primary" id="kn-editor-save" style="flex:1;">💾 Lưu</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.querySelector('#kn-editor-close').onclick = close;
    wrap.querySelector('#kn-editor-save').onclick = async ()=>{
      await knSaveTextFile(id, wrap.querySelector('#kn-editor-textarea').value);
      close();
    };
  }

  // =====================================================================
  // Module [Huấn luyện AI (Admin)] — "Bàn làm việc" dạng cây thư mục
  // =====================================================================
  function renderAdminKnowledgeTab(el){
    if(!isAdmin()){ el.innerHTML = '<div class="empty-state">Bạn không có quyền truy cập mục này.</div>'; return; }
    attachKnowledgeRealtime();
    const curId = state.knowledgeCurrentFolder;
    const crumbs = knBreadcrumb(curId);
    const items = state.knowledgeTrashOpen
      ? Object.values(state.knowledgeTree||{}).filter(n=> n && n.deleted).sort((a,b)=>(b.deletedAt||'').localeCompare(a.deletedAt||''))
      : knChildrenOf(curId);

    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🧠 Huấn luyện AI — Kho tri thức nền dùng chung</h3></div>
        <div class="panel-body">
          <p class="sub" style="margin-top:0;">Toàn bộ nội dung văn bản / Word / Excel / mô tả ảnh trong kho này sẽ được <b>tự động nạp kèm</b> vào mọi cuộc trò chuyện của "Chàng Nông dân Thông minh" — dùng chung cho mọi model AI (Gemini, ChatGPT, Claude...) ở mọi tầng dự phòng.</p>

          ${!state.knowledgeTrashOpen? `
          <div class="toolbar" style="flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="kn-new-folder">📁 Tạo thư mục mới</button>
            <button class="btn btn-primary btn-sm" id="kn-new-text">📝 Tạo file văn bản mới</button>
            <button class="btn btn-ghost btn-sm" id="kn-upload-docx">⬆️ Tải Word (.docx)</button>
            <button class="btn btn-ghost btn-sm" id="kn-upload-xlsx">⬆️ Tải Excel (.xlsx)</button>
            <button class="btn btn-ghost btn-sm" id="kn-upload-image">🖼️ Tải ảnh</button>
            <button class="btn btn-ghost btn-sm" id="kn-open-trash" style="margin-left:auto;">🗑️ Thùng rác</button>
          </div>
          <div style="margin:12px 0; font-size:13px;">
            <span class="link-btn" data-kn-goto="">🏠 Gốc</span>${crumbs.map(c=>` / <span class="link-btn" data-kn-goto="${c.id}">${escapeHtml(c.name)}</span>`).join('')}
          </div>` : `
          <div class="toolbar">
            <button class="btn btn-ghost btn-sm" id="kn-close-trash">◀ Quay lại kho tri thức</button>
          </div>
          <div class="divider-lbl">🗑️ Thùng rác (kho tri thức)</div>
          `}

          ${state.knowledgeUploading? `<div class="empty-state" style="padding:10px; text-align:left;">⏳ Đang tải tệp lên Firebase Storage, vui lòng đợi...</div>` : ''}

          <div id="kn-dropzone" style="border:2px dashed var(--line); border-radius:12px; min-height:120px; padding:8px; transition:border-color .15s;">
            ${items.length? `<div class="table-wrap"><table>
              <thead><tr><th></th><th>Tên</th><th>Loại</th><th>Cập nhật</th><th></th></tr></thead>
              <tbody>${items.map(n=>`
                <tr>
                  <td style="width:30px; text-align:center; font-size:18px;">${knFileIcon(n)}</td>
                  <td>${n.type==='folder' && !state.knowledgeTrashOpen? `<span class="link-btn" data-kn-open-folder="${n.id}">${escapeHtml(n.name)}</span>`
                      : (n.type==='file' && !state.knowledgeTrashOpen? `<span class="link-btn" data-kn-open-file="${n.id}">${escapeHtml(n.name)}</span>` : escapeHtml(n.name))}
                    ${n.storageUrl? ` <a href="${n.storageUrl}" target="_blank" rel="noopener" class="sub" style="font-size:11px;">(tệp gốc)</a>` : ''}
                  </td>
                  <td class="sub">${n.type==='folder'? 'Thư mục' : knFileKindLabel(n.fileKind)}</td>
                  <td class="sub" style="white-space:nowrap;">${n.updatedAt? new Date(n.updatedAt).toLocaleString('vi-VN') : ''}</td>
                  <td style="white-space:nowrap; display:flex; gap:6px;">
                    ${state.knowledgeTrashOpen? `
                      <button class="btn btn-ghost btn-sm" data-kn-restore="${n.id}">Khôi phục</button>
                      <button class="btn btn-ghost btn-sm" data-kn-purge="${n.id}" style="color:var(--red);">Xoá vĩnh viễn</button>
                    ` : `
                      <button class="btn btn-ghost btn-sm" data-kn-rename="${n.id}">Đổi tên</button>
                      <button class="btn btn-ghost btn-sm" data-kn-delete="${n.id}" style="color:var(--red);">Xoá vào thùng rác</button>
                    `}
                  </td>
                </tr>`).join('')}
              </tbody>
            </table></div>` : `<div class="empty-state" style="padding:24px;">${state.knowledgeTrashOpen? 'Thùng rác trống.' : 'Thư mục này đang trống. Tạo thư mục/file mới, tải tệp lên bằng nút phía trên, hoặc kéo-thả file trực tiếp vào khung này.'}</div>`}
          </div>
        </div>
      </div>`;

    // ---- điều hướng ----
    el.querySelectorAll('[data-kn-goto]').forEach(elx=> elx.onclick = ()=>{ state.knowledgeCurrentFolder = elx.dataset.knGoto || null; renderAdminKnowledgeTab(el); });
    el.querySelectorAll('[data-kn-open-folder]').forEach(elx=> elx.onclick = ()=>{ state.knowledgeCurrentFolder = elx.dataset.knOpenFolder; renderAdminKnowledgeTab(el); });
    el.querySelectorAll('[data-kn-open-file]').forEach(elx=> elx.onclick = ()=> knOpenFileEditor(elx.dataset.knOpenFile));

    // ---- tạo mới ----
    const newFolderBtn = document.getElementById('kn-new-folder');
    if(newFolderBtn) newFolderBtn.onclick = async ()=>{ const name = prompt('Tên thư mục mới:'); if(name && name.trim()) await knCreateFolder(name, curId); };
    const newTextBtn = document.getElementById('kn-new-text');
    if(newTextBtn) newTextBtn.onclick = async ()=>{
      const name = prompt('Tên file văn bản mới:', 'Tài liệu mới');
      if(name===null) return;
      const id = await knCreateTextFile(name, curId);
      if(id) knOpenFileEditor(id);
    };

    // ---- tải tệp lên (Word/Excel/Ảnh) ----
    function triggerUpload(kind, accept){
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept; input.multiple = true;
      input.onchange = ()=>{ Array.from(input.files||[]).forEach(f=> knUploadFile(f, curId, kind)); };
      input.click();
    }
    const docxBtn = document.getElementById('kn-upload-docx');
    if(docxBtn) docxBtn.onclick = ()=> triggerUpload('docx', '.docx');
    const xlsxBtn = document.getElementById('kn-upload-xlsx');
    if(xlsxBtn) xlsxBtn.onclick = ()=> triggerUpload('xlsx', '.xlsx,.xls');
    const imgBtn = document.getElementById('kn-upload-image');
    if(imgBtn) imgBtn.onclick = ()=> triggerUpload('image', 'image/*');

    // ---- kéo-thả file trực tiếp vào khung ----
    const dropzone = document.getElementById('kn-dropzone');
    if(dropzone && !state.knowledgeTrashOpen){
      ['dragover','dragenter'].forEach(evt=> dropzone.addEventListener(evt, e=>{ e.preventDefault(); dropzone.style.borderColor = 'var(--gold)'; }));
      ['dragleave','drop'].forEach(evt=> dropzone.addEventListener(evt, e=>{ e.preventDefault(); dropzone.style.borderColor = 'var(--line)'; }));
      dropzone.addEventListener('drop', e=>{
        e.preventDefault();
        Array.from((e.dataTransfer && e.dataTransfer.files) || []).forEach(f=>{
          const ext = (f.name.split('.').pop()||'').toLowerCase();
          let kind = null;
          if(ext==='docx') kind = 'docx';
          else if(ext==='xlsx' || ext==='xls') kind = 'xlsx';
          else if((f.type||'').startsWith('image/')) kind = 'image';
          if(!kind){ alert(`Định dạng ".${ext}" chưa được hỗ trợ kéo-thả trực tiếp. Vui lòng dùng đúng nút tải tệp (.docx/.xlsx/ảnh), hoặc "Tạo file văn bản mới" để gõ tay.`); return; }
          knUploadFile(f, curId, kind);
        });
      });
    }

    // ---- đổi tên / xoá / khôi phục / xoá vĩnh viễn ----
    el.querySelectorAll('[data-kn-rename]').forEach(btn=> btn.onclick = async ()=>{
      const node = state.knowledgeTree[btn.dataset.knRename];
      const name = prompt('Đổi tên thành:', node? node.name : '');
      if(name && name.trim()) await knRenameNode(btn.dataset.knRename, name);
    });
    el.querySelectorAll('[data-kn-delete]').forEach(btn=> btn.onclick = ()=> knSoftDeleteNode(btn.dataset.knDelete));
    el.querySelectorAll('[data-kn-restore]').forEach(btn=> btn.onclick = ()=> knRestoreNode(btn.dataset.knRestore));
    el.querySelectorAll('[data-kn-purge]').forEach(btn=> btn.onclick = ()=> knPurgeNode(btn.dataset.knPurge));

    // ---- thùng rác ----
    const openTrashBtn = document.getElementById('kn-open-trash');
    if(openTrashBtn) openTrashBtn.onclick = ()=>{ state.knowledgeTrashOpen = true; renderAdminKnowledgeTab(el); };
    const closeTrashBtn = document.getElementById('kn-close-trash');
    if(closeTrashBtn) closeTrashBtn.onclick = ()=>{ state.knowledgeTrashOpen = false; renderAdminKnowledgeTab(el); };
  }

  // =====================================================================
  // Module [Siêu ghi chú] — NAY TÁCH 2 KHÔNG GIAN LƯU TRỮ:
  //   • 'personal' (Bộ cá nhân, bảo mật): users/{uid}/super_notes/tree/{id} — nếu có tài
  //     khoản Google. Nếu KHÔNG có tài khoản (Khách qua mã không đăng nhập) thì lưu tạm vào
  //     localStorage của trình duyệt (KHÔNG đẩy lên Firebase), theo đúng yêu cầu.
  //   • 'shared' (Bộ dùng chung của Xã/Phường): communes/{wardId}/shared_notes/tree/{id} — mọi
  //     người có chung mã định danh của xã đó đều truy cập được, theo đúng phân quyền Chủ mã cấu
  //     hình tại "⚙️ Cài đặt & Chia sẻ" (mặc định "Cho phép xem" cho người mới, Chủ mã luôn toàn quyền).
  // (Ghi chú kiến trúc: hệ thống dùng Realtime Database thay Firestore để đồng bộ toàn ứng dụng —
  // xem thêm ghi chú ở đầu module Huấn luyện AI. Firebase Storage vẫn dùng cho file gốc, best-effort.)
  // =====================================================================
  const LOCAL_NOTES_KEY = 'hnd_local_notes_tree_v1';
  function superNotesUserKey(){ return (state.identity && (state.identity.uid || state.identity.email)) ? String(state.identity.uid || emailToKey(state.identity.email)) : null; }
  function superNotesLegacyUserKey(){
    const email=state.identity&&state.identity.email;
    const current=superNotesUserKey();
    const legacy=email ? emailToKey(email) : null;
    return legacy && legacy!==current ? legacy : null;
  }
  function hasSuperNotesAccount(){ return !!superNotesUserKey(); }
  // Bộ cá nhân của Khách qua mã (không đăng nhập Google) không có nơi lưu trên đám mây -> dùng
  // localStorage của chính máy/trình duyệt họ đang dùng.
  function usingLocalNotes(){ return state.superNotesSpace==='personal' && !hasSuperNotesAccount(); }
  function getLocalSuperNotesTree(){
    const tree = lget(LOCAL_NOTES_KEY, {});
    return tree && typeof tree==='object' ? tree : {};
  }
  function hasLocalSuperNotes(){
    return Object.values(getLocalSuperNotesTree()).some(n=> n && !n.deleted);
  }
  // Chuyển dữ liệu local lên đúng kho cá nhân của tài khoản đang đăng nhập. Luôn tạo ID mới để
  // không va chạm với cây Firebase hiện có, giữ nguyên quan hệ cha/con và không ghi đè dữ liệu cloud.
  async function migrateLocalSuperNotesToCloud(){
    if(!hasSuperNotesAccount()){ alert('Vui lòng đăng nhập Google trước khi chuyển ghi chú lên Firebase.'); return; }
    const localTree = getLocalSuperNotesTree();
    const localNodes = Object.values(localTree).filter(n=> n && n.id);
    if(!localNodes.length){ alert('Không có ghi chú local nào cần chuyển.'); return; }
    if(!confirm(`Chuyển ${localNodes.length} ghi chú/thư mục từ trình duyệt lên Bộ cá nhân Firebase?\n\nDữ liệu cloud hiện có sẽ được giữ nguyên, không ghi đè. Sau khi chuyển thành công, bản local sẽ được xoá khỏi thiết bị này.`)) return;
    const ref = currentNotesTreeRef();
    if(!ref || state.superNotesSpace!=='personal'){ alert('Chỉ có thể chuyển vào Bộ cá nhân.'); return; }
    const idMap = {};
    localNodes.forEach(node=>{ idMap[node.id] = uidKn(); });
    const updates = {};
    localNodes.forEach(node=>{
      const newId = idMap[node.id];
      updates[newId] = {
        ...node,
        id:newId,
        parentId: node.parentId ? (idMap[node.parentId] || null) : null,
        migratedFrom:'browser',
        migratedAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
      };
    });
    try{
      await ref.update(updates);
      localStorage.removeItem(LOCAL_NOTES_KEY);
      state.superNotesTree = {};
      state._superNotesCache = null;
      alert(`Đã chuyển ${localNodes.length} ghi chú/thư mục lên Bộ cá nhân Firebase. Dữ liệu giờ có thể đồng bộ và chia sẻ theo quyền của tài khoản.`);
      attachSuperNotesRealtime();
      renderSuperNotesOverlay();
    }catch(e){
      console.error('Chuyển ghi chú local lên Firebase lỗi:', e);
      alert('Không thể chuyển ghi chú lên Firebase. Dữ liệu local vẫn được giữ nguyên trên thiết bị để thử lại.');
    }
  }
  function currentNotesTreeRef(){
    if(state.superNotesSpace==='shared'){
      const wid = wardId();
      return wid ? rtdb.ref(`communes/${wid}/shared_notes/tree`) : null;
    }
    const key = superNotesUserKey();
    return key ? rtdb.ref(`users/${key}/super_notes/tree`) : null; // null -> dùng local (usingLocalNotes())
  }
  function legacyNotesTreeRef(){
    const key=superNotesLegacyUserKey();
    return key ? rtdb.ref(`users/${key}/super_notes/tree`) : null;
  }
  function snAfterLocalWrite(){ state._superNotesCache = null; if(state._superNotesOpen) renderSuperNotesOverlay(); }

  // ---- Phân quyền Bộ ghi chú DÙNG CHUNG (Yêu cầu 4) ----
  function sharedNotesPerm(){
    if(isOwner()) return 'edit'; // Chủ mã luôn toàn quyền với bộ chung của chính mình
    const cfg = state.sharedNotesConfig || {};
    const email = state.identity && state.identity.email;
    if(email){
      const g = (cfg.grants||{})[emailToKey(email)];
      if(g && g.perm) return g.perm;
    }
    return cfg.defaultPerm || 'view';
  }
  // Cá nhân: luôn toàn quyền với đúng dữ liệu của chính mình (kể cả lưu local). Chung: theo phân quyền.
  function snCanEdit(){ return state.superNotesSpace==='personal' ? true : sharedNotesPerm()==='edit'; }
  function snCanView(){ return state.superNotesSpace==='personal' ? true : sharedNotesPerm()!=='none'; }
  async function loadSharedNotesConfig(){
    const wid = wardId();
    if(!wid){ state.sharedNotesConfig = {defaultPerm:'view', grants:{}}; return; }
    try{
      const snap = await rtdb.ref(`communes/${wid}/shared_notes/config`).get();
      state.sharedNotesConfig = (snap && snap.exists()) ? snap.val() : {defaultPerm:'view', grants:{}};
    }catch(e){ state.sharedNotesConfig = {defaultPerm:'view', grants:{}}; }
  }
  async function saveSharedNotesConfig(cfg){
    const wid = wardId();
    if(!wid || !isOwner()) return;
    await rtdb.ref(`communes/${wid}/shared_notes/config`).set(cfg);
    state.sharedNotesConfig = cfg;
  }

  let superNotesListenerRef = null;
  let superNotesListenerKey = null; // đánh dấu đang lắng nghe đúng path nào (tránh gắn trùng khi đổi không gian/đổi mã)
  function attachSuperNotesRealtime(){
    if(usingLocalNotes()){
      detachSuperNotesRealtime();
      state.superNotesTree = getLocalSuperNotesTree();
      state.superNotesLoading = false;
      state.superNotesLoadError = '';
      return;
    }
    const ref = currentNotesTreeRef();
    if(!ref){
      state.superNotesTree = {};
      state.superNotesLoading = false;
      state.superNotesLoadError = state.superNotesSpace==='shared' ? 'Chưa chọn mã xã/phường để mở Bộ ghi chú dùng chung.' : 'Chưa có tài khoản để mở Bộ ghi chú cá nhân.';
      return;
    }
    const pathKey = ref.toString();
    if(superNotesListenerRef && superNotesListenerKey === pathKey) return; // đã đúng path rồi, khỏi gắn lại
    detachSuperNotesRealtime();
    state.superNotesTree = {};
    state.superNotesLoading = true;
    state.superNotesLoadError = '';
    superNotesListenerRef = ref;
    superNotesListenerKey = pathKey;
    ref.on('value', async snap=>{
      const canonical=(snap && snap.exists()) ? (snap.val()||{}) : {};
      const legacyRef=legacyNotesTreeRef();
      let legacy={};
      if(legacyRef){
        try{ const legacySnap=await legacyRef.once('value'); legacy=legacySnap&&legacySnap.exists() ? (legacySnap.val()||{}) : {}; }catch(e){}
      }
      state.superNotesTree = {...legacy,...canonical};
      state._superNotesCache = null; // dữ liệu vừa đổi -> làm mới bộ nhớ đệm ở lượt chat AI kế tiếp
      if(state._superNotesOpen) renderSuperNotesOverlay();
    });
  }
  function detachSuperNotesRealtime(){
    if(superNotesListenerRef){ superNotesListenerRef.off(); superNotesListenerRef = null; superNotesListenerKey = null; }
  }
  // Chuyển đổi giữa 2 không gian (Yêu cầu 2) — tải/lắng nghe lại đúng nguồn dữ liệu tương ứng.
  async function switchNotesSpace(space){
    if(state.superNotesSpace === space) return;
    state.superNotesSpace = space;
    state.superNotesCurrentFolder = null;
    state.superNotesEditingId = null;
    state.superNotesTrashOpen = false;
    if(space==='shared') await loadSharedNotesConfig();
    attachSuperNotesRealtime();
    renderSuperNotesOverlay();
  }
  function snChildrenOf(parentId){
    return Object.values(state.superNotesTree||{})
      .filter(n=> n && !n.deleted && (n.parentId||null) === (parentId||null))
      .sort((a,b)=>{ if(a.type!==b.type) return a.type==='folder'? -1 : 1; return (a.name||'').localeCompare(b.name||''); });
  }
  function snBreadcrumb(folderId){
    const path = []; let cur = folderId; let guard = 0;
    while(cur && state.superNotesTree[cur] && guard++ < 20){ path.unshift(state.superNotesTree[cur]); cur = state.superNotesTree[cur].parentId; }
    return path;
  }
  function snDescendantsOf(id){
    const out = []; const stack = [id];
    while(stack.length){
      const cur = stack.pop();
      Object.values(state.superNotesTree||{}).forEach(n=>{ if(n && n.parentId===cur){ out.push(n.id); stack.push(n.id); } });
    }
    return out;
  }
  // ---- Các nguyên tố ghi dữ liệu DÙNG CHUNG cho cả 3 kiểu backend (Firebase cá nhân/chung, local) ----
  async function snWriteNode(id, node){
    if(usingLocalNotes()){
      const tree = getLocalSuperNotesTree();
      tree[id] = node;
      lset(LOCAL_NOTES_KEY, tree);
      state.superNotesTree = tree;
      snAfterLocalWrite();
      return;
    }
    const ref = currentNotesTreeRef();
    if(!ref) return;
    await ref.child(id).set(node);
  }
  async function snUpdateNode(id, partial){
    if(usingLocalNotes()){
      const tree = getLocalSuperNotesTree();
      tree[id] = { ...(tree[id]||{}), ...partial };
      lset(LOCAL_NOTES_KEY, tree);
      state.superNotesTree = tree;
      snAfterLocalWrite();
      return;
    }
    const ref = currentNotesTreeRef();
    if(!ref) return;
    await ref.child(id).update(partial);
  }
  // updatesObj dạng {"id/field": value, ...} (multi-path update, giống Firebase .update()) hoặc
  // {"id": null} để xoá hẳn 1 node — dùng cho xoá mềm theo lô / xoá vĩnh viễn theo lô.
  async function snBatchUpdate(updatesObj){
    if(usingLocalNotes()){
      const tree = getLocalSuperNotesTree();
      Object.entries(updatesObj).forEach(([path, val])=>{
        const slash = path.indexOf('/');
        if(slash===-1){
          if(val===null) delete tree[path]; else tree[path] = val;
        } else {
          const id = path.slice(0,slash), field = path.slice(slash+1);
          tree[id] = tree[id] || {};
          if(val===null) delete tree[id][field]; else tree[id][field] = val;
        }
      });
      lset(LOCAL_NOTES_KEY, tree);
      state.superNotesTree = tree;
      snAfterLocalWrite();
      return;
    }
    const ref = currentNotesTreeRef();
    if(!ref) return;
    await ref.update(updatesObj);
  }
  async function snCreateFolder(name, parentId){
    if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
    if(!snCanEdit()){ alert('Bạn không có quyền tạo thư mục ở Bộ ghi chú dùng chung này.'); return; }
    const nm = (name||'').trim();
    if(!nm){ alert('Vui lòng nhập tên thư mục.'); return; }
    const id = uidKn();
    await snWriteNode(id, { id, type:'folder', parentId: parentId||null, name:nm, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), deleted:false });
  }
  async function snCreateTextFile(name, parentId, content){
    if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return null; }
    if(!snCanEdit()){ alert('Bạn không có quyền tạo ghi chú ở Bộ ghi chú dùng chung này.'); return null; }
    const id = uidKn();
    await snWriteNode(id, {
      id, type:'file', fileKind:'text', parentId: parentId||null, name:(name||'').trim() || 'Ghi chú mới', content: content||'',
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), deleted:false,
    });
    return id;
  }
  async function snSaveTextFile(id, content){
    if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
    if(!snCanEdit()){ alert('Bạn chỉ được XEM, không có quyền sửa ở Bộ ghi chú dùng chung này.'); return; }
    await snUpdateNode(id, { content: content||'', updatedAt:new Date().toISOString() });
  }
  async function snRenameNode(id, newName){
    if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
    if(!snCanEdit()){ alert('Bạn không có quyền đổi tên ở Bộ ghi chú dùng chung này.'); return; }
    const nm = (newName||'').trim();
    if(!nm) return;
    await snUpdateNode(id, { name:nm, updatedAt:new Date().toISOString() });
  }
  async function snSoftDeleteNode(id){
    if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
    if(!snCanEdit()){ alert('Bạn không có quyền xoá ở Bộ ghi chú dùng chung này.'); return; }
    const node = state.superNotesTree[id];
    if(!node) return;
    if(!confirm(`Xoá "${node.name}" vào thùng rác${node.type==='folder'?' (cùng toàn bộ nội dung bên trong)':''}? Có thể khôi phục lại sau.`)) return;
    const ids = node.type==='folder' ? [id, ...snDescendantsOf(id)] : [id];
    const updates = {};
    ids.forEach(nid=>{ updates[`${nid}/deleted`] = true; updates[`${nid}/deletedAt`] = new Date().toISOString(); });
    await snBatchUpdate(updates);
  }
  async function snRestoreNode(id){
    if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
    if(!snCanEdit()){ alert('Bạn không có quyền khôi phục ở Bộ ghi chú dùng chung này.'); return; }
    const node = state.superNotesTree[id];
    if(!node) return;
    const ids = node.type==='folder' ? [id, ...snDescendantsOf(id)] : [id];
    const now = new Date().toISOString();
    const updates = {};
    ids.forEach(nid=>{
      updates[`${nid}/deleted`] = false;
      updates[`${nid}/deletedAt`] = null;
      updates[`${nid}/updatedAt`] = now;
    });
    await snBatchUpdate(updates);
  }
  async function snPurgeNode(id){
    if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
    if(!snCanEdit()){ alert('Bạn không có quyền xoá vĩnh viễn ở Bộ ghi chú dùng chung này.'); return; }
    const node = state.superNotesTree[id];
    if(!node) return;
    if(!confirm(`XOÁ VĨNH VIỄN "${node.name}"? Không thể khôi phục lại được nữa.`)) return;
    const ids = node.type==='folder' ? [id, ...snDescendantsOf(id)] : [id];
    if(!usingLocalNotes()){
      for(const nid of ids){
        const n = state.superNotesTree[nid];
        if(n && n.storagePath){ try{ await storage.ref(n.storagePath).delete(); }catch(e){ console.warn('Xoá tệp gốc trên Storage lỗi (bỏ qua):', e); } }
      }
    }
    const updates = {};
    ids.forEach(nid=> updates[nid] = null);
    await snBatchUpdate(updates);
  }

  // ---- Nguồn 2 cho "bộ não" AI: toàn bộ nội dung Siêu ghi chú CÁ NHÂN của CHÍNH người đang chat ----
  // Gộp các node văn bản của 1 cây ghi chú thành 1 chuỗi tri thức — dùng chung cho cả nguồn
  // Firebase (tài khoản Google) lẫn localStorage (Khách qua mã chưa đăng nhập).
  function combineNotesNodesToText(nodes, labelPrefix){
    function pathOf(n){
      const parts=[n.name]; let p=n.parentId; let guard=0;
      while(p && nodes[p] && guard++<20){ parts.unshift(nodes[p].name); p=nodes[p].parentId; }
      return parts.join(' / ');
    }
    const files = Object.values(nodes||{}).filter(n=> n && n.type==='file' && !n.deleted && (n.content||'').trim());
    if(!files.length) return '';
    const MAX_CHARS = 40000;
    let combined = '';
    for(const f of files){
      const block = `\n\n----- [${labelPrefix}: ${pathOf(f)}] -----\n${f.content.trim()}`;
      if((combined.length + block.length) > MAX_CHARS) break;
      combined += block;
    }
    return combined.trim();
  }
  async function getUserSuperNotesKnowledge(){
    // Yêu cầu mới: Khách qua mã (chưa đăng nhập Google) lưu Siêu ghi chú cá nhân tạm ở localStorage
    // của chính máy họ — vẫn phải "bốc" đúng nguồn đó để nạp bối cảnh cho AI, không chỉ riêng
    // tài khoản Google mới có Nguồn 2.
    const key = superNotesUserKey();
    if(!key){
      try{ return combineNotesNodesToText(getLocalSuperNotesTree(), 'Siêu ghi chú cá nhân (lưu tạm trên máy)'); }
      catch(e){ console.error('Không đọc được Siêu ghi chú cá nhân (local):', e); return ''; }
    }
    try{
      const snap = await rtdb.ref(`users/${key}/super_notes/tree`).get();
      if(!snap || !snap.exists()) return '';
      return combineNotesNodesToText(snap.val(), 'Siêu ghi chú cá nhân');
    }catch(e){ console.error('Không tải được Siêu ghi chú cá nhân:', e); return ''; }
  }
  async function getUserSuperNotesKnowledgeCached(){
    const now = Date.now();
    if(state._superNotesCache!=null && (now - state._superNotesCacheAt) < 120000) return state._superNotesCache;
    const text = await getUserSuperNotesKnowledge();
    state._superNotesCache = text;
    state._superNotesCacheAt = now;
    return text;
  }

  // ---------------------------------------------------------------------
  // Pipeline "AI TIÊU HOÁ TRI THỨC" cho Siêu ghi chú: gõ chữ / nói / tải ảnh-PDF / tải cả thư mục
  // đều đi qua ĐÚNG 1 hàm này — luôn ưu tiên Gemini (Pro rồi tới Flash) vì cần khả năng đọc file
  // (ảnh/PDF) mạnh, trả về đúng cấu trúc JSON {fileName, rawText, digestedText}.
  // ---------------------------------------------------------------------
  async function digestNoteInput({ text, attachment, signal }){
    const provider = (state.aiProviders||[]).find(p=> p.apiKey && aiVendorOf(p)==='gemini');
    if(!provider){ throw new Error('Chưa có API Key Gemini nào được Admin cấu hình trong "CÀI ĐẶT ADMIN" — không thể xử lý AI tiêu hoá tri thức (cần model đọc file mạnh).'); }
    const instruction = `Bạn là một trợ lý biên tập tri thức cho hệ thống ghi chú cá nhân. Nhiệm vụ:
1) Nếu đầu vào có tệp ảnh/PDF đính kèm: hãy OCR toàn bộ nội dung (chữ, bảng biểu, mô tả sơ đồ nếu có) thành văn bản thuần, cố gắng giữ đúng bố cục/thứ tự gốc — gán vào "rawText".
   Nếu đầu vào CHỈ là văn bản gõ tay/nói (không có tệp đính kèm): "rawText" chính là NGUYÊN VĂN văn bản người dùng đã nhập, giữ nguyên không sửa gì.
2) Từ rawText, biên tập lại thành "digestedText": sửa lỗi chính tả/ngữ pháp, sắp xếp mạch lạc rõ ràng, có thể suy luận/bổ sung giải thích thêm cho dễ hiểu hơn — nhưng KHÔNG bịa thông tin trái với nội dung gốc.
3) Đặt 1 tên file ngắn gọn (dưới 60 ký tự, không chứa / \\ : * ? " < > |) tóm tắt đúng nội dung, gán vào "fileName" (không cần đuôi .txt).
CHỈ trả lời bằng ĐÚNG 1 khối JSON hợp lệ, không thêm bất kỳ chữ nào khác, không dùng markdown code fence, đúng cấu trúc:
{"fileName":"...", "rawText":"...", "digestedText":"..."}`;
    const userText = instruction + (text? `\n\nVĂN BẢN NGƯỜI DÙNG NHẬP:\n${text}` : '\n\n(Người dùng không nhập thêm văn bản, chỉ có tệp đính kèm — hãy OCR toàn bộ tệp.)');
    const messages = [{ role:'user', text:userText }];
    const opts = attachment ? { attachments:[attachment], signal } : { signal };
    let result;
    try{
      result = await callGeminiOnce(provider, 'gemini-pro-latest', messages, opts, null);
    }catch(e1){
      if(e1 && e1.name==='AbortError') throw e1; // đã bị dừng chủ động -> không dò tầng dự phòng nữa
      console.warn('[Siêu ghi chú] Gemini Pro lỗi, tự động chuyển Flash:', e1);
      result = await callGeminiOnce(provider, 'gemini-flash-latest', messages, opts, null);
    }
    const cleaned = result.text.trim().replace(/^```json/i,'').replace(/^```/,'').replace(/```$/,'').trim();
    try{
      const parsed = JSON.parse(cleaned);
      return {
        fileName: (parsed.fileName||'').trim() || `Ghi chú ${new Date().toLocaleString('vi-VN')}`,
        rawText: parsed.rawText || text || '',
        digestedText: parsed.digestedText || cleaned,
      };
    }catch(e){
      // AI lỡ trả lời không đúng JSON -> vẫn không để mất dữ liệu, dùng cả câu trả lời làm phần đã tiêu hoá
      return { fileName:`Ghi chú ${new Date().toLocaleString('vi-VN')}`, rawText: text || '(tệp đính kèm)', digestedText: cleaned };
    }
  }
  function fileToBase64(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  // Giới hạn dung lượng AI được phép tiêu hoá (OCR ảnh/PDF hoặc biên tập text) — chọn mức 15MB để
  // có khoảng đệm an toàn dưới giới hạn ~20MB cho dữ liệu đính kèm trực tiếp (inline) của Gemini.
  const MAX_AI_DIGEST_BYTES = 15 * 1024 * 1024;
  // Các định dạng ĐÃ LÀ văn bản thuần — không cần AI biên tập lại (theo đúng yêu cầu: file
  // text/Word/csv... bản thân nó đã là chữ rồi, tiêu hoá thêm là thừa).
  const TEXT_NATIVE_EXTS = ['txt','csv','docx'];

  // Xử lý 1 tệp GỐC (File thô) hoặc 1 đoạn văn bản gõ tay -> tạo ra đúng 1 file ghi chú mới.
  // .docx/.xlsx/.txt/.csv: trích xuất văn bản trước bằng mammoth/XLSX. Ảnh/PDF/định dạng khác: gửi
  // cho Gemini OCR trực tiếp — TRỪ KHI vượt giới hạn dung lượng hoặc skipAI=true, khi đó bỏ qua
  // hẳn bước gọi AI, đưa thẳng vào cây thư mục.
  async function processSingleSuperNoteInput(rawFile, userText, parentId, signal, skipAI){
    if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
    if(!snCanEdit()){ alert('Bạn không có quyền thêm ghi chú ở Bộ ghi chú dùng chung này.'); return; }
    let storagePath = '', storageUrl = '';
    if(rawFile && !usingLocalNotes()){
      try{
        const ownerTag = superNotesUserKey() || `ward_${wardId()||'x'}`;
        const rid = 'raw_' + uidKn();
        storagePath = `super_notes_files/${ownerTag}/${rid}_${rawFile.name}`;
        const stRef = storage.ref(storagePath);
        await stRef.put(rawFile);
        storageUrl = await stRef.getDownloadURL();
      }catch(e){
        console.warn('[Siêu ghi chú] Tải file gốc lên Storage lỗi (bỏ qua, vẫn tiếp tục xử lý):', e);
        storagePath = ''; storageUrl = '';
      }
    }
    if(signal && signal.aborted) throw new DOMException('Đã dừng theo yêu cầu người dùng', 'AbortError');

    const ext = rawFile ? (rawFile.name.split('.').pop()||'').toLowerCase() : '';
    const isTextNative = rawFile && TEXT_NATIVE_EXTS.includes(ext);
    const overSizeLimit = rawFile && rawFile.size > MAX_AI_DIGEST_BYTES && !isTextNative;

    // Yêu cầu mới: file/thư mục quá nặng -> KHÔNG cho AI tiêu hoá, đưa thẳng vào cây thư mục kèm
    // thông báo rõ ràng, không qua bước nào khác.
    if(overSizeLimit){
      const id = uidKn();
      const sizeMb = (rawFile.size/1024/1024).toFixed(1);
      await snWriteNode(id, {
        id, type:'file', fileKind:'text', parentId: parentId||null,
        name: rawFile.name.slice(0,80),
        content: `[TỆP GỐC ĐÍNH KÈM — VƯỢT GIỚI HẠN DUNG LƯỢNG ĐỂ AI TIÊU HOÁ]\nTên tệp: ${rawFile.name}\nDung lượng: ${sizeMb} MB (giới hạn cho phép AI tiêu hoá là ${(MAX_AI_DIGEST_BYTES/1024/1024).toFixed(0)}MB)\n\nFile/thư mục/ghi chú của bạn vượt quá giới hạn dung lượng để AI có thể tiêu hoá nên là tài liệu này sẽ được đưa thẳng vào cây thư mục mà không trải qua bước nào cả. Bạn có thể mở tệp gốc bên dưới để xem nội dung.`,
        storagePath, storageUrl,
        createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), deleted:false,
      });
      alert(`"${rawFile.name}" vượt quá giới hạn dung lượng để AI có thể tiêu hoá nên tài liệu này sẽ được đưa thẳng vào cây thư mục mà không trải qua bước nào cả.`);
      return;
    }

    const digestInput = { text: userText || '', signal };
    let nativeExtractedText = null; // dùng riêng cho trường hợp bỏ qua AI (txt/csv/docx/xlsx)
    if(rawFile){
      try{
        if(ext==='docx'){
          await loadOptionalLibrary('mammoth');
          const buf = await rawFile.arrayBuffer();
          const r = await mammoth.extractRawText({ arrayBuffer: buf });
          nativeExtractedText = r.value || '';
        } else if(ext==='xlsx' || ext==='xls'){
          await loadOptionalLibrary('xlsx');
          const buf = await rawFile.arrayBuffer();
          const wb = XLSX.read(buf, { type:'array' });
          nativeExtractedText = wb.SheetNames.map(sn=> `--- Trang tính: ${sn} ---\n` + XLSX.utils.sheet_to_csv(wb.Sheets[sn])).join('\n\n');
        } else if(ext==='txt' || ext==='csv'){
          nativeExtractedText = await rawFile.text();
        } else if(!skipAI){
          // Ảnh / PDF / định dạng khác -> gửi thẳng cho Gemini OCR qua inline_data (chỉ khi KHÔNG bỏ qua AI)
          const base64 = await fileToBase64(rawFile);
          digestInput.attachment = { mimeType: rawFile.type || 'application/octet-stream', base64 };
        }
        if(nativeExtractedText!=null) digestInput.text = (digestInput.text? digestInput.text+'\n\n' : '') + nativeExtractedText;
      }catch(e){
        if(ext==='docx' || ext==='xlsx' || ext==='xls'){
          throw new Error(`Không thể đọc tệp Office "${rawFile.name}". Vui lòng kiểm tra kết nối mạng rồi thử lại.`);
        }
        console.error('[Siêu ghi chú] Trích xuất nội dung tệp lỗi, sẽ thử gửi thẳng cho AI OCR:', e);
        if(!skipAI){ try{ digestInput.attachment = { mimeType: rawFile.type || 'application/octet-stream', base64: await fileToBase64(rawFile) }; }catch(e2){} }
      }
    }

    let parsed;
    // Yêu cầu mới: file ĐÃ LÀ văn bản thuần (txt/csv/docx) không cần AI biên tập lại — dùng thẳng
    // nội dung đã trích xuất. Cũng bỏ qua thẳng nếu người dùng chọn "Bỏ qua bước tiêu hoá AI".
    if(skipAI || isTextNative){
      const rawT = digestInput.text || (digestInput.attachment? '(Tệp đính kèm — chưa qua OCR do bỏ qua bước tiêu hoá AI)' : '');
      parsed = {
        fileName: (rawFile? rawFile.name.replace(/\.[^.]+$/,'') : `Ghi chú ${new Date().toLocaleString('vi-VN')}`).slice(0,80) || `Ghi chú ${new Date().toLocaleString('vi-VN')}`,
        rawText: rawT,
        digestedText: rawT,
      };
    } else {
      parsed = await digestNoteInput(digestInput);
    }
    const content = `[NGUYÊN VĂN NGƯỜI DÙNG NHẬP VÀO]\n${parsed.rawText}\n\n[NỘI DUNG ĐÃ ĐƯỢC AI TIÊU HOÁ]\n${parsed.digestedText}`;
    const id = uidKn();
    await snWriteNode(id, {
      id, type:'file', fileKind:'text', parentId: parentId||null,
      name: parsed.fileName.slice(0,80), content, storagePath, storageUrl,
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), deleted:false,
    });
  }
  // Điều phối: 1 đoạn text và/hoặc NHIỀU tệp gốc (kể cả "Thêm thư mục" chọn nhiều tệp cùng lúc)
  // -> xử lý TUẦN TỰ, mỗi tệp ra đúng 1 file ghi chú riêng (văn bản gõ tay chỉ gắn vào tệp đầu).
  // CHỈ xoá nội dung ô nhập/danh sách tệp khi xử lý THÀNH CÔNG — nếu bị dừng giữa chừng hoặc lỗi,
  // giữ nguyên để người dùng sửa lại hoặc tự xoá.
  async function processSuperNoteInput(text, files, parentId, skipAI){
    if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để sử dụng tính năng này.'); return; }
    if(!snCanEdit()){ alert('Bạn không có quyền thêm ghi chú ở Bộ ghi chú dùng chung này.'); return; }
    if((!files || !files.length) && (!text || !text.trim())) return;
    state.superNotesAbortController = new AbortController();
    const signal = state.superNotesAbortController.signal;
    state.superNotesProcessing = true;
    state.superNotesJustCompleted = false;
    state.superNotesJustCompletedMsg = '';
    // Lưu lại đúng nội dung/tệp đang xử lý — nếu bị Dừng giữa chừng hoặc lỗi, khôi phục đúng gói
    // này để người dùng có thể sửa và thử lại. Ghi cả trường hợp bỏ qua AI.
    state._snInFlightText = text || '';
    state._snInFlightFiles = (files||[]).slice();
    state._snInFlightParentId = parentId;
    try{
      if(files && files.length){
        for(let i=0;i<files.length;i++){
          state.superNotesProcessingMsg = skipAI? `Đang lưu tệp ${i+1}/${files.length}: ${files[i].name}` : `Đang tiêu hoá tệp ${i+1}/${files.length}: ${files[i].name}`;
          renderSuperNotesOverlay();
          await processSingleSuperNoteInput(files[i], i===0? text : '', parentId, signal, skipAI);
        }
      } else {
        state.superNotesProcessingMsg = skipAI? 'Đang lưu nội dung' : 'Đang tiêu hoá nội dung';
        renderSuperNotesOverlay();
        await processSingleSuperNoteInput(null, text, parentId, signal, skipAI);
      }
      state.superNotesPendingFiles = [];
      state._snDraftText = '';
      state._snInFlightText = '';
      state._snInFlightFiles = [];
      state._snInFlightParentId = null;
      state.superNotesJustCompleted = true;
      // Yêu cầu mới: dòng thông báo hoàn tất là do "AI nói" nên KHÔNG tự động biến mất nữa.
      state.superNotesJustCompletedMsg = 'Chàng đã tiêu hoá xong tài liệu và đã đưa vào cây thư mục, bạn hãy vào cây thư mục để xem tài liệu.';
    }catch(e){
      if(e && e.name==='AbortError'){
        // Yêu cầu mới: hỏi người dùng có muốn đưa thẳng vào ghi chú mà không tiêu hoá không.
        state.superNotesStoppedConfirm = true;
      } else {
        console.error('[Siêu ghi chú] Xử lý AI tiêu hoá lỗi:', e);
        state._snDraftText = state._snInFlightText || '';
        state.superNotesPendingFiles = (state._snInFlightFiles||[]).slice();
        state._snInFlightText = '';
        state._snInFlightFiles = [];
        state._snInFlightParentId = null;
        alert('Xử lý AI tiêu hoá thất bại: ' + e.message + '\n\nNội dung/tệp bạn đã nhập vẫn được giữ nguyên để bạn thử lại hoặc chỉnh sửa.');
      }
    }finally{
      state.superNotesProcessing = false;
      state.superNotesProcessingMsg = '';
      state.superNotesAbortController = null;
      renderSuperNotesOverlay();
    }
  }

  // ---------------------------------------------------------------------
  // Yêu cầu mới: trước khi thực sự tiêu hoá, luôn dừng lại hỏi xác nhận — người dùng có thể tiếp
  // tục bổ sung thêm nội dung/tệp (gộp dần), hoặc chọn 1 trong 2 nút để chốt lại.
  // ---------------------------------------------------------------------
  function queueSuperNoteForReview(text, files){
    if((!text || !text.trim()) && (!files || !files.length)) return;
    state.superNotesReviewMode = true;
    if(text && text.trim()) state.superNotesReviewText = (state.superNotesReviewText? state.superNotesReviewText+'\n\n' : '') + text.trim();
    if(files && files.length) state.superNotesReviewFiles = (state.superNotesReviewFiles||[]).concat(files);
    // Lưu lại ĐÚNG NGUYÊN 1 lượt gửi này (text + files kèm theo) — để hiển thị lại đầy đủ như 1 đoạn
    // chat thật (mỗi lần gửi là 1 bong bóng riêng), không bị mất cấu trúc khi gộp chung vào 1 khối.
    state.superNotesReviewTurns = (state.superNotesReviewTurns||[]).concat([{ text: text&&text.trim()? text.trim() : '', files: files&&files.length? files.slice() : [] }]);
    renderSuperNotesOverlay();
  }
  async function finalizeSuperNoteReview(useAI){
    const text = state.superNotesReviewText;
    const files = (state.superNotesReviewFiles||[]).slice();
    const parentId = state.superNotesCurrentFolder;
    state.superNotesReviewMode = false;
    state.superNotesReviewText = '';
    state.superNotesReviewFiles = [];
    state.superNotesReviewTurns = [];
    await processSuperNoteInput(text, files, parentId, !useAI);
  }
  // Sau khi bấm Dừng giữa lúc AI đang tiêu hoá — hỏi có muốn đưa thẳng gói nội dung/tệp đang dở
  // vào ghi chú mà KHÔNG cần tiêu hoá nữa không.
  async function resolveSuperNoteStoppedConfirm(useAI){
    const text = state._snInFlightText;
    const files = (state._snInFlightFiles||[]).slice();
    const parentId = state._snInFlightParentId;
    state.superNotesStoppedConfirm = false;
    if(useAI){
      await processSuperNoteInput(text, files, parentId, true); // đưa thẳng vào ghi chú, bỏ qua AI
    } else {
      // Không muốn đưa thẳng vào -> khôi phục lại y nguyên nội dung/tệp vào ô nhập để sửa/gửi lại
      state.superNotesPendingFiles = files;
      state._snDraftText = text || '';
      state._snInFlightText = '';
      state._snInFlightFiles = [];
      state._snInFlightParentId = null;
      state._snDraftCaptureSuppressed = true;
      try{ renderSuperNotesOverlay(); }finally{ state._snDraftCaptureSuppressed = false; }
    }
  }

  function renderAdminSettingsTab(el){
    if(!isAdmin()){ el.innerHTML = '<div class="empty-state">Bạn không có quyền truy cập mục này.</div>'; return; }
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>👑 Quản lý Admin</h3></div>
        <div class="panel-body">
          <p class="sub" style="margin-top:0;">2 Admin tối cao (cố định, không ai gỡ được): <b>${SUPER_ADMIN_EMAILS.join(', ')}</b>. ${isSuperAdmin()? 'Chỉ Admin tối cao mới có quyền thêm/gỡ các Admin khác.' : 'Chỉ Admin tối cao mới có quyền thêm/gỡ Admin — bạn chỉ xem được danh sách bên dưới.'}</p>
          ${isSuperAdmin()? `
          <div class="toolbar">
            <input id="adm-new-email" placeholder="email@gmail.com" style="min-width:260px;">
            <button class="btn btn-primary btn-sm" id="adm-add-btn">➕ Thêm Admin mới</button>
          </div>` : ''}
          <div style="margin-top:12px;">
            ${SUPER_ADMIN_EMAILS.map(e=>`
              <div class="kv-row"><span>👑 ${e} <span class="tag-role" style="background:var(--gold); color:#3A2C05; font-size:10.5px; padding:2px 8px; border-radius:20px; font-weight:700; margin-left:6px;">Admin tối cao</span></span><span></span></div>`).join('')}
            ${Object.values(state.admins||{}).map(a=>`
              <div class="kv-row"><span>${a.email}</span>${isSuperAdmin()? `<button class="btn btn-ghost btn-sm" data-adm-remove="${a.email}">Gỡ quyền Admin</button>` : ''}</div>`).join('')}
            ${Object.values(state.admins||{}).length===0? '<div class="sub" style="padding:6px 0;">Chưa có Admin nào được thêm ngoài 2 Admin tối cao.</div>' : ''}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>🤖 Cấu hình AI ("Chàng Nông dân Thông minh")</h3></div>
        <div class="panel-body">
          <p class="sub" style="margin-top:0;">API Key được lưu bảo mật trên Firebase (system_config/ai_providers), ứng dụng tự kéo về chạy ngầm khi người dùng chat — không hiển thị lại API Key sau khi lưu.</p>
          <div id="adm-ai-list"></div>
          <button class="btn btn-ghost btn-sm" id="adm-ai-add-row" style="margin-top:8px;">➕ Thêm cấu hình AI khác</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>🗂️ Danh sách mã định danh của toàn bộ hệ thống</h3></div>
        <div class="panel-body">
          <div id="adm-wards-list"><div class="sub">Đang tải danh sách toàn bộ mã xã…</div></div>
        </div>
      </div>

      <div class="panel"><div class="panel-head"><h3>🧬 Hệ thống cột ẩn (không công khai với mọi người) đang hoạt động ở module Sổ vay vốn</h3></div>
        <div class="panel-body">
          <p class="sub" style="margin:0 0 10px;">Đây là các cột dữ liệu/công thức tồn tại ngầm bên trong hệ thống, không hiển thị ở bất kỳ bảng hay khung "Tuỳ chỉnh cột" nào — chỉ liệt kê ở đây để tra cứu lại khi cần. Bấm vào tên 1 hệ thống để xem danh sách cột, bấm vào tên 1 cột để xem mô tả ngắn gọn.</p>
          ${hiddenColumnSystemsDocs().map((sys,si)=>{
            const sysOpen = state.hiddenColDocsOpenSystem===si;
            return `
            <div style="border:1px solid var(--line); border-radius:8px; margin-bottom:8px; overflow:hidden;">
              <button class="btn btn-ghost btn-sm hcd-sys-toggle" data-sys="${si}" style="width:100%; text-align:left; border:none; border-radius:0; font-weight:700;">${sysOpen?'▾':'▸'} ${escapeHtml(sys.title)} <span class="sub">(${sys.columns.length} cột)</span></button>
              ${sysOpen? `
                <div style="padding:4px 10px 10px 22px;">
                  ${sys.columns.map((col,ci)=>{
                    const colKey = `${si}-${ci}`;
                    const colOpen = state.hiddenColDocsOpenCol===colKey;
                    return `
                    <div style="border-top:1px solid var(--line); padding-top:6px; margin-top:6px;">
                      <button class="btn btn-ghost btn-sm hcd-col-toggle" data-col="${colKey}" style="width:100%; text-align:left; border:none; padding:4px 6px; font-size:12.5px;">${colOpen?'▾':'▸'} ${escapeHtml(col.name)}</button>
                      ${colOpen? `<p class="sub" style="margin:4px 0 6px 20px;">${escapeHtml(col.desc)}</p>` : ''}
                    </div>`;
                  }).join('')}
                </div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;

    // ---- Khu vực 1: Quản lý Admin (chỉ Admin tối cao mới có nút bấm) ----
    const admAddBtn = document.getElementById('adm-add-btn');
    if(admAddBtn) admAddBtn.onclick = async ()=>{
      const val = document.getElementById('adm-new-email').value;
      if(await addAdminEmail(val)) renderAdminSettingsTab(el);
    };
    el.querySelectorAll('[data-adm-remove]').forEach(btn=>{
      btn.onclick = async ()=>{ await removeAdminEmail(btn.dataset.admRemove); renderAdminSettingsTab(el); };
    });
    // ---- Khung "Hệ thống cột ẩn" — accordion 2 tầng (hệ thống -> cột) ----
    el.querySelectorAll('.hcd-sys-toggle').forEach(btn=>{
      btn.onclick = ()=>{
        const si = parseInt(btn.dataset.sys,10);
        state.hiddenColDocsOpenSystem = state.hiddenColDocsOpenSystem===si ? null : si;
        state.hiddenColDocsOpenCol = null;
        renderAdminSettingsTab(el);
      };
    });
    el.querySelectorAll('.hcd-col-toggle').forEach(btn=>{
      btn.onclick = ()=>{
        const key = btn.dataset.col;
        state.hiddenColDocsOpenCol = state.hiddenColDocsOpenCol===key ? null : key;
        renderAdminSettingsTab(el);
      };
    });

    // ---- Khu vực 2: Cấu hình AI ----
    function renderAiRows(){
      const listEl = document.getElementById('adm-ai-list');
      if(!listEl) return;
      const rows = state.aiProviders||[];
      listEl.innerHTML = rows.length? rows.map(p=>`
        <div class="form-grid" data-ai-row="${p.id}" style="border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin-bottom:10px;">
          <div class="field"><label>Tên gợi nhớ</label><input class="ai-f-label" value="${p.label||''}" placeholder="vd: Gemini chính"></div>
          <div class="field"><label>Tên model</label><input class="ai-f-model" value="${p.model||''}" placeholder="vd: gemini-2.5-flash"></div>
          <div class="field full"><label>API Key</label><input class="ai-f-key" type="password" value="${p.apiKey||''}" placeholder="Dán API Key vào đây"></div>
          <div class="field full" style="display:flex; gap:8px;">
            <button class="btn btn-primary btn-sm ai-f-save">💾 Lưu cấu hình AI</button>
            <button class="btn btn-ghost btn-sm ai-f-del" style="color:var(--red);">Xoá</button>
          </div>
        </div>`).join('') : '<div class="empty-state" style="padding:14px 0;">Chưa có cấu hình AI nào. Bấm "➕ Thêm cấu hình AI khác" bên dưới để bắt đầu.</div>';
      listEl.querySelectorAll('[data-ai-row]').forEach(row=>{
        const id = row.dataset.aiRow;
        row.querySelector('.ai-f-save').onclick = async ()=>{
          const label = row.querySelector('.ai-f-label').value.trim();
          const model = row.querySelector('.ai-f-model').value.trim() || 'gemini-2.5-flash';
          const apiKey = row.querySelector('.ai-f-key').value.trim();
          if(!apiKey){ alert('Vui lòng nhập API Key.'); return; }
          await saveAiProvider(id, { label: label||model, model, apiKey });
          alert('Đã lưu cấu hình AI.');
          renderAiRows();
        };
        row.querySelector('.ai-f-del').onclick = async ()=>{ await deleteAiProvider(id); renderAiRows(); };
      });
    }
    loadAiProviders().then(renderAiRows);
    document.getElementById('adm-ai-add-row').onclick = ()=>{
      state.aiProviders = state.aiProviders||[];
      state.aiProviders.push({ id:'p_'+uid(), label:'', model:'gemini-2.5-flash', apiKey:'' });
      renderAiRows();
    };

    // ---- Khu vực 3: Danh sách mã định danh của toàn bộ hệ thống ----
    function renderWardsList(){
      const listEl = document.getElementById('adm-wards-list');
      if(!listEl) return;
      // Mới tạo lên đầu, cũ hơn xếp sau, đã xoá (thùng rác) luôn xếp cuối cùng.
      const rows = (state.systemWardsIndex||[]).slice().sort((a,b)=>{
        if(!!a.deleted !== !!b.deleted) return a.deleted ? 1 : -1;
        return (b.createdAt||'').localeCompare(a.createdAt||'');
      });
      const expanded = state._admExpandedWard;
      listEl.innerHTML = rows.length? `<div class="table-wrap"><table>
        <thead><tr><th>Mã định danh</th><th>Tên xã/phường</th><th>Tên Tỉnh/thành phố</th><th>Chủ mã</th><th>Trạng thái</th><th>Mã ẩn cố định bên trong</th></tr></thead>
        <tbody>${rows.map(w=>{
          const isExp = expanded===w.wardId;
          return `
          <tr>
            <td class="mono" style="position:relative;">
              <span class="adm-wid-name" data-adm-toggle="${w.wardId}" style="cursor:pointer; display:inline-block; transition:transform .15s ease;">${w.wardId}</span>
              ${isExp? `<span style="display:inline-flex; gap:6px; margin-left:8px; background:var(--white); position:relative; z-index:5;">
                <button class="btn btn-ghost btn-sm" data-adm-view="${w.wardId}">👁️ Xem cơ sở dữ liệu</button>
                ${!w.deleted? `<button class="btn btn-ghost btn-sm" data-adm-trash="${w.wardId}" style="color:var(--red);">🗑️ Xoá vào Thùng rác</button>` : ''}
              </span>` : ''}
            </td>
            <td>${w.wardName||'(chưa đặt tên)'}</td>
            <td>${w.provinceName||'—'}</td>
            <td>${w.ownerEmail||'—'}</td>
            <td>${w.deleted? '<span style="color:var(--red);">Đã xoá</span>' : '<span style="color:var(--green,#2f6b3a);">Đang hoạt động</span>'}</td>
            <td class="mono">${w.secretId||'—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : '<div class="empty-state" style="padding:14px 0;">Chưa có mã xã nào được ghi nhận.</div>';
      listEl.querySelectorAll('[data-adm-toggle]').forEach(el=>{
        const wid = el.dataset.admToggle;
        el.addEventListener('mouseenter', ()=>{ el.style.transform = 'scale(1.3)'; });
        el.addEventListener('mouseleave', ()=>{ el.style.transform = 'scale(1)'; });
        el.onclick = ()=>{ state._admExpandedWard = (state._admExpandedWard===wid) ? null : wid; renderWardsList(); };
      });
      listEl.querySelectorAll('[data-adm-view]').forEach(btn=> btn.onclick = (e)=>{ e.stopPropagation(); adminViewWard(btn.dataset.admView); });
      listEl.querySelectorAll('[data-adm-trash]').forEach(btn=> btn.onclick = (e)=>{ e.stopPropagation(); adminDeleteWardToTrash(btn.dataset.admTrash); });
    }
    loadSystemWardsIndex().then(renderWardsList);
  }

  function renderGuideTab(el){
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>📖 Hướng dẫn sử dụng</h3></div>
        <div class="panel-body">
          <div class="empty-state">
            <div class="e-ico">📖</div>
            <p>rỗng để sau này nâng cấp thêm</p>
          </div>
        </div>
      </div>`;
  }

  function renderAboutTab(el){
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>ℹ️ Thông tin phần mềm</h3></div>
        <div class="panel-body">
          <div class="empty-state">
            <div class="e-ico">ℹ️</div>
            <p>rỗng để sau này nâng cấp thêm</p>
          </div>
        </div>
      </div>`;
  }

  function trashLabel(item){
    const kind = item._kind || 'borrower'; // dữ liệu cũ chưa có _kind mặc định là hộ vay
    if(kind==='expense') return `${money(item.amount)} — ${item.purpose===CAT_OTHER? (item.purposeOther||categoryLabel(CAT_OTHER)) : categoryLabel(item.purpose)}`;
    if(kind==='project') return item.name;
    return `${item.name} (${item.hamlet||'—'})`;
  }
  // ---------------------------------------------------------------------
  // Thùng rác DÙNG CHUNG 1 nhánh Firebase (secretdata/{secretId}/trash) nhưng hiển thị TÁCH RIÊNG
  // theo từng module (mỗi loại dữ liệu có khu vực Thùng rác của riêng nó, thay cho 1 Module Thùng
  // rác chung trước đây): Sổ vay vốn hiện "hộ vay"+"phương án vay", Chi tiêu hiện "khoản chi".
  // ---------------------------------------------------------------------
  // Thùng rác CHUYÊN DỤNG của Sổ vay vốn — theo mô hình "hộp chứa": chỉ hiện các Phương án vay đã
  // xoá; bấm vào tên phương án để xem/đóng danh sách người vay đã bị cuốn theo bên trong, kèm nút
  // Xoá vĩnh viễn riêng cho từng người (không ảnh hưởng phần còn lại của gói).
  // Panel "Danh sách đã Tất toán khoản vay hoặc Trả nợ trước hạn" — nhóm theo phương án vay, trong
  // mỗi nhóm: hộ nào CÒN NỢ tiền lãi (tính đến Quý/Ngày hiện tại) luôn xếp lên đầu tiên; hết nợ lãi
  // thì về lại thứ tự mặc định (mới tất toán trước, cũ sau). Dòng người thừa kế được gạch chân.
  // Tính các "khung 5 năm" (khung 2 trở lên, khung 1 = "5 năm trước đến hiện tại" tính riêng) đang
  // THẬT SỰ có ít nhất 1 người vay — không trùng đầu mút giữa các khung với nhau.
  function settledYearBuckets(allSettled){
    const curYear = new Date().getFullYear();
    const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(curYear-5);
    const fiveYearsAgoStr = fiveYearsAgo.toISOString();
    const older = allSettled.filter(b=> (b.settledAt||'') < fiveYearsAgoStr);
    const buckets = {};
    older.forEach(b=>{
      const settledDate = new Date(b.settledAt || b.dueDate || new Date());
      const yearsAgo = curYear - settledDate.getFullYear();
      let idx = Math.floor(yearsAgo/5)+1;
      if(idx<2) idx=2;
      (buckets[idx]=buckets[idx]||[]).push(b);
    });
    return Object.keys(buckets).map(Number).sort((a,c)=>a-c).map(idx=>({
      idx, fromYear: curYear-5*idx, toYear: curYear-5*(idx-1), list: buckets[idx],
    }));
  }
  function buildSettledBorrowersPanelHtml(preFiltered, idPrefix){
    idPrefix = idPrefix || 'ssp';
    const allSettled = preFiltered || state.borrowers.filter(b=>!b.deleted && b.settled);
    state._svSettledCache = { allSettled };
    if(!allSettled.length) return `<p class="sub" style="padding:10px 0;">Chưa có hộ vay nào tất toán hoặc trả nợ trước hạn.</p>`;
    const mode = state.settledExpandedRange; // null (mặc định) | '5y' | số (chỉ số khung 5 năm, >=2)
    const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear()-5);
    const fiveYearsAgoStr = fiveYearsAgo.toISOString();
    const buckets = settledYearBuckets(allSettled);
    const fiveYearCount = allSettled.filter(b=> (b.settledAt||'') >= fiveYearsAgoStr).length;
    let settled, sectionTitle;
    if(!mode){
      // Mặc định: CHỈ hiện những người CHƯA đóng lãi xong (tính đến Quý/Ngày hiện tại)
      settled = allSettled.filter(b=> computeInterestPaymentBoxDisplay(b).unpaidTotal>0);
      sectionTitle = null;
    } else if(mode==='5y'){
      settled = allSettled.filter(b=> (b.settledAt||'') >= fiveYearsAgoStr);
      sectionTitle = 'Danh sách từ 5 năm trước đến thời điểm hiện tại';
    } else {
      const bucket = buckets.find(bk=>bk.idx===mode);
      settled = bucket? bucket.list : [];
      sectionTitle = bucket? `Danh sách từ năm ${bucket.fromYear} đến năm ${bucket.toYear}` : '';
    }
    if(!settled.length && !mode) return `<p class="sub" style="padding:10px 0;">Không có hộ vay nào đã tất toán/trả nợ trước hạn mà còn nợ tiền lãi.</p>${settledRangeButtonsHtml(idPrefix, buckets, fiveYearCount)}`;
    if(!settled.length) return `<p class="sub" style="padding:10px 0;">${escapeHtml(sectionTitle)}: không có hộ vay nào.</p>${settledCollapseButtonHtml(idPrefix)}`;
    const projects = sortedActiveProjects(state.loanProjects||[]);
    const groups = {};
    settled.forEach(b=>{
      const key = (b.projectId && projects.some(p=>p.id===b.projectId)) ? b.projectId : '__none__';
      (groups[key]=groups[key]||[]).push(b);
    });
    const groupOrder = projects.map(p=>p.id).filter(pid=>groups[pid]);
    if(groups['__none__']) groupOrder.push('__none__');
    const tablesHtml = groupOrder.map(gid=>{
      const proj = gid==='__none__'? null : projects.find(p=>p.id===gid);
      const projName = proj? escapeHtml(proj.name) : '(Không rõ phương án — có thể đã bị xoá)';
      const groupList = groups[gid].slice().sort((a,b2)=>{
        if(!mode){
          const aOwed = computeInterestPaymentBoxDisplay(a).unpaidTotal>0;
          const bOwed = computeInterestPaymentBoxDisplay(b2).unpaidTotal>0;
          if(aOwed !== bOwed) return aOwed? -1 : 1; // còn nợ lãi -> lên đầu
        }
        return (b2.settledAt||'').localeCompare(a.settledAt||''); // mới tất toán trước, cũ sau
      });
      return `
      <div style="margin-bottom:18px;">
        <div class="sv-group-header" style="position:relative; padding-right:190px; background:${projectGroupHeaderBg(gid)};">📋 ${projName} (${groupList.length} hộ)
          ${mode? `<span style="position:absolute; right:0; top:50%; transform:translateY(-50%);">${settledCollapseButtonHtml(idPrefix)}</span>` : ''}
        </div>
        <div class="table-wrap" style="border-color:#0d47a1; border-width:2px;">
          <table>
            <thead><tr><th>Xem lịch sử</th><th><span class="dancing-header preview-allow" data-header-scope="settled:${gid}">Họ và tên</span></th><th>Loại</th><th>Số tiền gốc</th><th>Ngày tất toán / trả nợ</th><th>Tiền lãi còn nợ (nếu có)</th><th>Người thừa kế</th></tr></thead>
            <tbody>${groupList.map(b=>{
              const stillOwed = computeInterestPaymentBoxDisplay(b).unpaidTotal;
              const isHeirRow = !!b.isHeir;
              const rowStyle = isHeirRow? ' style="text-decoration:underline;"' : '';
              const histLabel = b.settledType==='final' ? 'Xem lịch sử tất toán' : 'Xem lịch sử TNTH';
              return `<tr${rowStyle}>
                <td><button class="ext-action-btn ext-red-light preview-allow" style="animation-delay:${(Math.random()*3.5).toFixed(2)}s;" data-settle-history="${b.id}"><span class="btn-full-label">${histLabel}</span><span class="btn-narrow-label">Xem LS</span></button></td>
                <td>${dancingNameHtml(b)}</td>
                <td>${b.settledViaRiskDebt? 'Tất toán (hết nợ rủi ro)' : (b.settledType==='final'? 'Tất toán khoản vay' : 'Trả nợ trước hạn')}</td>
                <td class="money">${moneySpaced(b.principal)}</td>
                <td>${fmtDate((b.settledAt||'').slice(0,10) || b.dueDate)}</td>
                <td class="money" style="${stillOwed>0? 'color:var(--red); font-weight:700;' : ''}">${stillOwed>0? moneySpaced(stillOwed) : '—'}</td>
                <td>${b.heirName? escapeHtml((state.borrowers.find(x=>x.isHeir && x.heirOfBorrowerId===b.id)||{}).name || b.heirName) : ''}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
    }).join('');
    return `${mode? `<div class="divider-lbl">${escapeHtml(sectionTitle)}</div>` : `<div class="divider-lbl">Danh sách khoản vay đã tất toán hoặc trả nợ xong Nhưng chưa hoàn tất việc đóng lãi</div>`}${tablesHtml}${!mode? settledRangeButtonsHtml(idPrefix, buckets, fiveYearCount) : ''}`;
  }
  function settledRangeButtonsHtml(idPrefix, buckets, fiveYearCount){
    buckets = buckets || [];
    return `<div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
      <button type="button" class="btn btn-ghost btn-sm preview-allow" data-settled-range="5y" data-settled-idprefix="${idPrefix}">Danh sách từ 5 năm trước đến thời điểm hiện tại${fiveYearCount!=null? ` (${fiveYearCount})` : ''}</button>
      ${buckets.map(bk=>`<button type="button" class="btn btn-ghost btn-sm preview-allow" data-settled-range="${bk.idx}" data-settled-idprefix="${idPrefix}">Danh sách từ năm ${bk.fromYear} đến năm ${bk.toYear} (${(bk.list||[]).length})</button>`).join('')}
    </div>`;
  }
  function settledCollapseButtonHtml(idPrefix){
    return `<button type="button" class="btn btn-ghost btn-sm preview-allow" data-settled-collapse="1" data-settled-idprefix="${idPrefix}" style="color:#b71c1c; font-weight:700;">Rút gọn toàn bộ danh sách</button>`;
  }
  // Nối sự kiện dùng CHUNG cho 2 nút "Danh sách từ 5 năm..." / "Danh sách cũ hơn 5 năm..." và nút
  // "Rút gọn toàn bộ danh sách" — dùng ở cả panel gốc lẫn bên trong modal Tất toán/Trả nợ trước hạn.
  function wireSettledRangeButtons(container, rerenderFn){
    container.querySelectorAll('[data-settled-range]').forEach(btn=>{
      btn.onclick = ()=>{
        const v = btn.dataset.settledRange;
        state.settledExpandedRange = v==='5y' ? '5y' : parseInt(v,10);
        rerenderFn();
      };
    });
    container.querySelectorAll('[data-settled-collapse]').forEach(btn=>{
      btn.onclick = ()=>{ state.settledExpandedRange = null; rerenderFn(); };
    });
  }

  function buildLoanTrashPanelHtml(){
    const projectItems = state.trash.filter(x=> (x._kind||'borrower')==='project').sort((a,b)=>(b.deletedAt||'').localeCompare(a.deletedAt||''));
    const borrowerItems = state.trash.filter(x=> (x._kind||'borrower')==='borrower').sort((a,b)=>(b.deletedAt||'').localeCompare(a.deletedAt||''));
    state._svTrashCache = { borrowerItems };
    if(!projectItems.length && !borrowerItems.length) return `<div class="empty-state"><div class="e-ico">🗑️</div>Thùng rác trống.</div>`;
    const projectsHtml = projectItems.map(item=>{
      const members = Object.values(item.borrowersSnapshot||{});
      const expanded = state.loanTrashExpandedId===item.id;
      return `
      <div class="panel" style="margin-bottom:10px; border:1px solid var(--line);">
        <div class="panel-body">
          <div class="sv-group-header" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:${expanded?'12px':'0'}; background:${projectGroupHeaderBg(item.id)};">
            <button class="btn btn-ghost btn-sm loan-trash-expand" data-trashid="${item.id}" style="text-align:left; background:transparent; color:#000;">
              📋 <b>${escapeHtml(item.name)}</b> <span class="sub" style="color:#000;">(${members.length} người vay — xoá bởi ${escapeHtml(item.deletedByName||item.deletedBy||'')} lúc ${item.deletedAt? new Date(item.deletedAt).toLocaleString('vi-VN') : ''})</span> ${expanded?'▴':'▾'}
            </button>
            <div class="spacer"></div>
            <button class="btn btn-ghost btn-sm loan-trash-restore" data-trashid="${item.id}">↩ Khôi phục cả phương án</button>
            ${isOwner()? `<button class="btn btn-danger btn-sm loan-trash-purge" data-trashid="${item.id}">Xoá vĩnh viễn cả gói</button>` : ''}
          </div>
          ${expanded? `
            <div class="table-wrap" style="margin-top:12px; border-color:#4a148c; border-width:2px;">
              <table>
                <thead><tr><th style="${svColStyleHeader({key:'name',label:'Họ và tên', userInput:true})}">Họ và tên</th><th style="${svColStyleHeader({key:'hamlet',label:subAdminLabel(), userInput:true})}">${subAdminLabel()}</th><th style="${svColStyleHeader({align:'right',label:'Số tiền gốc (đ)'})}">Số tiền gốc</th><th></th></tr></thead>
                <tbody>
                  ${members.length? members.map(b=>`
                    <tr>
                      <td class="sv-col-wrap-check" style="${svColStyle({key:'name',label:'Họ và tên', userInput:true})}">${dancingNameHtml(b)}</td>
                      <td class="sv-col-wrap-check" style="${svColStyle({key:'hamlet',label:subAdminLabel(), userInput:true})}">${escapeHtml(b.hamlet||'—')}</td>
                      <td class="money" style="${svColStyle({align:'right',label:'Số tiền gốc (đ)'})}">${moneySpaced(b.principal)}</td>
                      <td><button class="btn btn-ghost btn-sm loan-trash-purge-member" data-trashid="${item.id}" data-borrowerid="${b.id}" style="color:var(--red);">Xoá vĩnh viễn</button></td>
                    </tr>`).join('') : `<tr><td colspan="4"><div class="sub" style="padding:10px;">Gói này không còn người vay nào (đã bị xoá vĩnh viễn từng người hết).</div></td></tr>`}
                </tbody>
              </table>
            </div>` : ''}
        </div>
      </div>`;
    }).join('');
    // Người vay bị xoá RIÊNG LẺ (không xoá cả phương án) — luôn thuộc về đúng 1 phương án, hiển thị
    // rõ tên phương án đó để không hiểu lầm là đứng độc lập.
    const borrowersHtml = borrowerItems.length? `
      <div class="divider-lbl" style="margin-top:${projectItems.length?'16px':'0'};">Người vay bị xoá riêng lẻ</div>
      <div class="table-wrap" style="border-color:#4a148c; border-width:2px;">
        <table>
          <thead><tr><th style="${svColStyleHeader({key:'name',label:'Họ và tên', userInput:true})}"><span class="dancing-header preview-allow" data-header-scope="trash:individual">Họ và tên</span></th><th style="${svColStyleHeader({key:'project',label:'Thuộc phương án', userInput:true})}">Thuộc phương án</th><th style="${svColStyleHeader({key:'hamlet',label:subAdminLabel(), userInput:true})}">${subAdminLabel()}</th><th style="${svColStyleHeader({align:'right',label:'Số tiền gốc (đ)'})}">Số tiền gốc</th><th style="${svColStyleHeader({label:'Xoá bởi'})}">Xoá bởi</th><th></th></tr></thead>
          <tbody>${borrowerItems.map(b=>`
            <tr>
              <td class="sv-col-wrap-check" style="${svColStyle({key:'name',label:'Họ và tên', userInput:true})}">${dancingNameHtml(b)}</td>
              <td class="sv-col-wrap-check" style="${svColStyle({key:'project',label:'Thuộc phương án', userInput:true})}">${escapeHtml(borrowerProjectName(b))}</td>
              <td class="sv-col-wrap-check" style="${svColStyle({key:'hamlet',label:subAdminLabel(), userInput:true})}">${escapeHtml(b.hamlet||'—')}</td>
              <td class="money" style="${svColStyle({align:'right',label:'Số tiền gốc (đ)'})}">${moneySpaced(b.principal)}</td>
              <td class="sub sv-col-wrap-check" style="${svColStyle({label:'Xoá bởi'})}">${escapeHtml(b.deletedByName||b.deletedBy||'')}</td>
              <td style="white-space:nowrap; display:flex; gap:6px;">
                <button class="btn btn-ghost btn-sm borrower-trash-restore" data-trashid="${b.id}">↩ Khôi phục</button>
                ${isOwner()? `<button class="btn btn-danger btn-sm borrower-trash-purge" data-trashid="${b.id}">Xoá vĩnh viễn</button>` : ''}
              </td>
            </tr>`).join('')}</tbody>
        </table>
      </div>` : '';
    return projectsHtml + borrowersHtml;
  }
  function wireLoanTrashPanel(container, rerenderFn){
    container.querySelectorAll('.loan-trash-expand').forEach(btn=>{
      btn.onclick = ()=>{ state.loanTrashExpandedId = (state.loanTrashExpandedId===btn.dataset.trashid) ? null : btn.dataset.trashid; rerenderFn(); };
    });
    container.querySelectorAll('.loan-trash-restore').forEach(btn=>{
      btn.onclick = async ()=>{ await restoreLoanProjectCascade(btn.dataset.trashid); rerenderFn(); };
    });
    container.querySelectorAll('.loan-trash-purge').forEach(btn=>{
      btn.onclick = async ()=>{ if(await purgeLoanProjectTrashForever(btn.dataset.trashid)) rerenderFn(); };
    });
    container.querySelectorAll('.loan-trash-purge-member').forEach(btn=>{
      btn.onclick = async ()=>{ await purgeSingleBorrowerInProjectTrash(btn.dataset.trashid, btn.dataset.borrowerid); rerenderFn(); };
    });
    container.querySelectorAll('.borrower-trash-restore').forEach(btn=>{
      btn.onclick = async ()=>{ if(await restoreStandaloneBorrower(btn.dataset.trashid)) rerenderFn(); };
    });
    container.querySelectorAll('.borrower-trash-purge').forEach(btn=>{
      btn.onclick = async ()=>{ if(await purgeStandaloneBorrowerForever(btn.dataset.trashid)) rerenderFn(); };
    });
  }

  function buildTrashPanelHtml(kinds){
    const items = state.trash.filter(x=> kinds.includes(x._kind || 'borrower'));
    const kindLabel = k=> ({expense:'Khoản chi', borrower:'Người vay', project:'Phương án vay'}[k] || k);
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>Loại</th><th>Nội dung</th><th>Người xoá</th><th>Thời điểm xoá</th><th></th></tr></thead>
        <tbody>
          ${items.length? items.map(item=>{
            const kind = item._kind || 'borrower';
            return `
            <tr>
              <td><span class="pill ${kind==='expense'?'pill-orange':kind==='project'?'pill-gray':'pill-gray'}">${kindLabel(kind)}</span></td>
              <td>${trashLabel(item)}</td>
              <td>${item.deletedByName||item.deletedBy}</td><td>${new Date(item.deletedAt).toLocaleString('vi-VN')}</td>
              <td style="display:flex; gap:6px;">
                ${(isOwner() || canEditModule('data') || item.deletedBy===state.identity.email) ? `<button class="btn btn-ghost btn-sm" data-restore="${item.id}" data-kind="${kind}">↩ Khôi phục</button>`:''}
                ${isOwner() ? `<button class="btn btn-danger btn-sm" data-purge="${item.id}" data-kind="${kind}">Xoá vĩnh viễn</button>`:''}
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="5"><div class="empty-state"><div class="e-ico">🗑️</div>Thùng rác trống</div></td></tr>`}
        </tbody>
      </table></div>`;
  }
  function wireTrashPanel(container, rerenderFn){
    container.querySelectorAll('[data-restore]').forEach(btn=>{
      btn.onclick = async ()=>{
        const id = btn.dataset.restore;
        const kind = btn.dataset.kind;
        const idx = state.trash.findIndex(x=>x.id===id);
        const item = state.trash[idx];
        delete item.deleted; delete item.deletedAt; delete item.deletedBy; delete item.deletedByName; delete item._kind;
        state.trash.splice(idx,1);
        await cRemoveRecord('trash', id);
        if(kind==='expense'){
          state.expenses.push(item);
          await cSetRecord('expenses', item.id, item);
          await pushLog('khôi phục khoản chi', trashLabel({...item, _kind:'expense'}));
        } else if(kind==='project'){
          state.loanProjects.push(item);
          await cSetRecord('loanProjects', item.id, item);
          await pushLog('khôi phục phương án vay', item.name);
        } else {
          // Yêu cầu 3: khôi phục người vay — kiểm tra phương án cũ còn đủ vốn không, nếu vượt thì
          // vẫn cho khôi phục về đúng phương án nhưng tự động đưa số tiền vay về 0 kèm cảnh báo rõ.
          const proj = (state.loanProjects||[]).find(p=>p.id===item.projectId);
          if(proj){
            const disbursedNow = projectDisbursedTotal(proj.id); // item chưa nằm trong state.borrowers nên không cần loại trừ
            const wouldBeTotal = disbursedNow + (parseFloat(item.principal)||0);
            if(wouldBeTotal > (parseFloat(proj.totalCapital)||0)){
              item.principal = 0;
              alert('Hộ vay đã được khôi phục về phương án cũ, nhưng Số tiền vay đã tự động chuyển về 0 vì tổng nguồn vốn của phương án này đã được phân bổ hết hoặc không đủ để đáp ứng số tiền vay cũ.');
            }
          }
          await cSetRecord('borrowers', item.id, item);
          // KHÔNG push thủ công — realtime binding sẽ tự nhận đúng bản ghi mới, tránh hiển thị trùng lặp.
          await pushLog('khôi phục', `hộ ${item.name}`);
        }
        rerenderFn();
      };
    });
    container.querySelectorAll('[data-purge]').forEach(btn=>{
      btn.onclick = async ()=>{
        if(!confirm('Xoá vĩnh viễn dữ liệu này? Hành động không thể hoàn tác.')) return;
        const id = btn.dataset.purge;
        const kind = btn.dataset.kind;
        const item = state.trash.find(x=>x.id===id);
        state.trash = state.trash.filter(x=>x.id!==id);
        await cRemoveRecord('trash', id);
        await pushLog(kind==='expense'?'xoá vĩnh viễn khoản chi': kind==='project'?'xoá vĩnh viễn phương án vay':'xoá vĩnh viễn', kind==='project'? item.name : trashLabel(item));
        rerenderFn();
      };
    });
  }

  // Firebase Realtime Database không cho phép '.', '#', '$', '[', ']' trong key
  // -> mã hoá email thành key an toàn, và lưu email gốc trong chính bản ghi.
  function emailToKey(email){ return (email||'').replace(/[.#$\[\]]/g, c => ({'.':',', '#':'~h~', '$':'~d~', '[':'~lb~', ']':'~rb~'})[c]); }

  function renderSettingsTab(el){
    const cfg = state.config;
    const canEditCore = canEditSettings();
    el.innerHTML = `
      ${state.identity.email? `
      <div class="panel"><div class="panel-head"><h3>🗂️ Ví mã định danh cấp Xã/Phường của tôi</h3></div>
        <div class="panel-body">
          <div id="st-wards-list" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
            ${(state.myWards||[]).map(w=>{
              const active = w.wardId===wardId();
              return `<button class="btn ${active?'btn-primary':'btn-ghost'} btn-sm preview-allow" data-st-view-ward="${w.wardId}" title="${w.kind==='owner'?'Chủ mã':'Khách'}">${w.kind==='owner'?'👑':'👤'} ${escapeHtml(w.wardName||w.wardId)} <span class="mono" style="opacity:.75;">(${escapeHtml(w.wardId)})</span>${active?' — đang dùng':''}</button>`;
            }).join('')}
          </div>
          <button class="btn btn-primary" id="st-goto-wallet-btn">🗂️ Tạo mới, sửa, xoá, quản lý mã định danh</button>
          <div style="background:rgba(47,74,60,.06); border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-top:14px;">
            <b style="font-size:13px; color:var(--rice-dark);">💡 Mã định danh cấp Xã/Phường là gì?</b>
            <p class="sub" style="margin:6px 0 0; font-size:11.5px; line-height:1.6;">
              Đây là "chìa khoá" để kết nối dữ liệu chung của một địa phương trên đám mây. Ai <b>tạo mã mới</b> (mã chưa từng tồn tại)
              sẽ trở thành <b>CHỦ MÃ</b> — người duy nhất có toàn quyền cấu hình và cấp quyền Xem/Sửa cho người khác. Ai
              <b>tham gia bằng mã đã có</b> (đúng mã + mật khẩu, nếu có) sẽ là <b>KHÁCH</b> — chỉ thao tác trong phạm vi được Chủ mã cho phép.
              Một tài khoản Google có thể sở hữu/tham gia <b>nhiều mã</b> cùng lúc và chuyển qua lại thoải mái ở Ví mã xã này.
            </p>
          </div>
        </div>
      </div>` : ''}

      <div class="panel"><div class="panel-head"><h3>Thông tin địa phương</h3></div>
        <div class="panel-body">
          <div class="divider-lbl">Loại hình hành chính</div>
          <div class="form-grid">
            <div class="field"><label>Cấp quản lý *</label>
              <select id="st-adminlevel" ${canEditCore?'':'disabled'}>${ADMIN_LEVEL_OPTIONS.map(o=>`<option value="${o}" ${adminLevelLabel()===o?'selected':''}>${o}</option>`).join('')}</select>
            </div>
            <div class="field"><label id="st-ward-label">Tên riêng (${adminLevelLabel()})</label><input id="st-ward" value="${cfg.wardName||''}" ${canEditCore?'':'disabled'}></div>
            <div class="field"><label>Loại tỉnh/thành phố *</label>
              <select id="st-provincetype" ${canEditCore?'':'disabled'}>${PROVINCE_TYPE_OPTIONS.map(o=>`<option value="${o}" ${(PROVINCE_TYPE_OPTIONS.includes(cfg.provinceType)?cfg.provinceType:'Tỉnh')===o?'selected':''}>${o}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Tên tỉnh/thành phố *</label><input id="st-provincename" value="${cfg.provinceName||''}" ${canEditCore?'':'disabled'}></div>
            <div class="field"><label>Loại hình khu dân cư trực thuộc *</label>
              <select id="st-subadmin" ${canEditCore?'':'disabled'}>${SUB_ADMIN_OPTIONS.map(o=>`<option value="${o}" ${(SUB_ADMIN_OPTIONS.includes(cfg.subAdminType)?cfg.subAdminType:'Khu dân cư')===o?'selected':''}>${o}</option>`).join('')}</select>
            </div>
          </div>
          <div class="divider-lbl">Thông tin chung</div>
          <div class="form-grid">
            <div class="field full"><label id="st-hamlets-label">${subAdminListLabel()}</label>
              <div style="border:1px solid var(--line); border-radius:8px; padding:8px 12px; min-height:38px; background:var(--white);">
                ${(cfg.hamlets||[]).length? escapeHtml((cfg.hamlets||[]).join(', ')) : `<span class="sub">Chưa có địa danh nào.</span>`}
              </div>
              <button type="button" class="btn btn-ghost btn-sm" id="st-hamlets-manage-btn" style="margin-top:6px;">+ Thêm địa danh</button>
            </div>
          </div>
          ${canEditCore? `<button class="btn btn-primary" id="st-save" style="margin-top:16px;">Lưu thay đổi</button>` : `<p class="sub" style="margin-top:12px;">Bạn chỉ được cấp quyền XEM cấu hình này — chỉ Chủ mã (hoặc người được Chủ mã cấp quyền Sửa "Cài đặt của mã định danh") mới lưu được thay đổi.</p>`}
        </div>
      </div>

      <button type="button" class="btn preview-allow" id="st-bankinfo-btn" style="width:100%; margin-bottom:18px; padding:14px; background:linear-gradient(90deg, #ff8f00 0%, #e65100 50%, #b71c1c 100%); color:#fff; font-weight:800; font-size:14px; border:none; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,.2);">💳 Thông tin Tài khoản nhận tiền của xã/phường</button>

      ${isOwner() ? `
      <div class="panel"><div class="panel-head"><h3>🔗 Chia sẻ quyền truy cập</h3></div>
        <div class="panel-body">
          <div class="divider-lbl">Loại 1 — Chia sẻ chung theo Mã định danh (công khai)</div>
          <p class="sub" style="margin-top:-4px;">Áp dụng cho BẤT KỲ ai vào bằng đúng Mã định danh + mật khẩu này — kể cả chưa đăng nhập Google (khách qua mã ở màn hình đăng nhập).</p>
          <div class="table-wrap"><table>
            <thead><tr><th>Mục dữ liệu</th><th>Quyền</th></tr></thead>
            <tbody>
              ${SHARE_MODULES.map(m=>`
                <tr><td>${m.label}</td><td>
                  <select data-public-perm="${m.key}">${PERM_OPTIONS.map(p=>`<option value="${p.v}" ${(cfg.publicPerms&&cfg.publicPerms[m.key]||'none')===p.v?'selected':''}>${p.label}</option>`).join('')}</select>
                </td></tr>`).join('')}
            </tbody>
          </table></div>

          <div class="divider-lbl">Loại 2 — Chia sẻ đích danh theo tài khoản (Email)</div>
          <p class="sub" style="margin-top:-4px;">Cấp quyền RIÊNG cho một tài khoản Google cụ thể — có thể cao hơn hoặc thấp hơn Loại 1 công khai.</p>
          ${Object.values(cfg.grants||{}).length? Object.values(cfg.grants||{}).map(g=>{
              const isPendingGrant = !!g.autoAdded && SHARE_MODULES.every(m=>(g[m.key]||'none')==='none') && (g.settings||'none')==='none';
              return `
            <div style="border:1px solid ${isPendingGrant?'var(--gold)':'var(--line)'}; border-radius:10px; padding:12px; margin-bottom:10px; ${isPendingGrant?'background:rgba(199,154,43,.06);':''}">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                <div>
                  <b style="font-size:13.5px;">${g.name? `${g.name} ` : ''}<span class="sub" style="font-weight:400;">${g.email}</span></b><br>
                  ${isPendingGrant? `<span class="tag-role" style="background:var(--gold); color:#3A2C05; font-size:10.5px; padding:2px 8px; border-radius:20px; font-weight:700;">🆕 Mới tham gia bằng mã — bấm chọn quyền bên dưới</span>` : (g.autoAdded? `<span class="sub" style="font-size:11px;">Tự động thêm khi tham gia bằng mã định danh</span>` : '')}
                </div>
                <button class="btn btn-ghost btn-sm" data-grant-remove="${emailToKey(g.email)}">Gỡ hoàn toàn</button>
              </div>
              <div class="table-wrap"><table>
                <thead><tr><th>Mục dữ liệu</th><th>Quyền</th></tr></thead>
                <tbody>
                  ${SHARE_MODULES.map(m=>`
                    <tr><td>${m.label}</td><td>
                      <select data-grant-perm="${emailToKey(g.email)}" data-grant-module="${m.key}">${PERM_OPTIONS.map(p=>`<option value="${p.v}" ${(g[m.key]||'none')===p.v?'selected':''}>${p.label}</option>`).join('')}</select>
                    </td></tr>`).join('')}
                  <tr><td>Cài đặt của mã định danh</td><td>
                    <select data-grant-perm="${emailToKey(g.email)}" data-grant-module="settings">
                      <option value="none" ${(g.settings||'none')==='none'?'selected':''}>Không được xem</option>
                      <option value="view" ${(g.settings||'none')==='view'?'selected':''}>Được quyền xem</option>
                      <option value="edit" ${(g.settings||'none')==='edit'?'selected':''}>Được quyền sửa</option>
                    </select>
                  </td></tr>
                </tbody>
              </table></div>
            </div>`; }).join('') : '<div class="empty-state" style="padding:10px 0;">Chưa chia sẻ riêng cho tài khoản nào.</div>'}

          <div class="divider-lbl">Thêm chia sẻ đích danh mới</div>
          <div class="toolbar"><input id="grant-new-email" placeholder="email@gmail.com" style="min-width:240px;"></div>
          <div class="table-wrap" style="margin-top:8px;"><table>
            <thead><tr><th>Mục dữ liệu</th><th>Quyền</th></tr></thead>
            <tbody>
              ${SHARE_MODULES.map(m=>`
                <tr><td>${m.label}</td><td><select data-new-grant-perm="${m.key}">${PERM_OPTIONS.map(p=>`<option value="${p.v}">${p.label}</option>`).join('')}</select></td></tr>`).join('')}
              <tr><td>Cài đặt của mã định danh</td><td>
                <select data-new-grant-perm="settings">
                  <option value="none">Không được xem</option>
                  <option value="view">Được quyền xem</option>
                  <option value="edit">Được quyền sửa</option>
                </select>
              </td></tr>
            </tbody>
          </table></div>
          <button class="btn btn-primary btn-sm" id="grant-add-btn" style="margin-top:10px;">+ Chia sẻ cho tài khoản này</button>
        </div>
      </div>` : ''}

      ${isOwner() ? `
      <div class="panel"><div class="panel-head"><h3>🔐 Bảo mật mã xã</h3></div>
        <div class="panel-body">
          <div class="divider-lbl" style="margin-top:0;">Tên Mã định danh</div>
          <div class="kv-row"><span>Mã định danh hiện tại</span><b class="mono">${wardId()}</b></div>
          <div class="toolbar">
            <input id="sec-wid" placeholder="Mã định danh mới (vd: xabinhminh)" style="min-width:240px; text-transform:lowercase;">
            <button class="btn btn-primary btn-sm" id="sec-wid-save">Đổi tên mã</button>
          </div>
          <p class="sub" style="margin:6px 0 14px;">Ví dụ đang dùng mã ngẫu nhiên (4 ký tự) do hệ thống cấp, bạn có thể đổi sang tên mã dễ nhớ hơn bất cứ lúc nào. Sau khi đổi, hãy cung cấp lại mã mới cho các Khách đang tham gia để họ tiếp tục truy cập.</p>

          <div class="divider-lbl">Mật khẩu Mã định danh</div>
          <div class="kv-row"><span>Mật khẩu mã xã hiện tại</span><b>${cfg.accessCode? '•••••• (đã đặt)' : 'Chưa đặt (ai biết mã cũng nhập được)'}</b></div>
          <div class="toolbar">
            <input id="sec-pass" type="password" placeholder="Mật khẩu mới (để trống = bỏ mật khẩu)" style="min-width:240px;">
            <button class="btn btn-primary btn-sm" id="sec-pass-save">Cập nhật mật khẩu</button>
          </div>
          <p class="sub" style="margin:6px 0 14px;">Đổi mật khẩu sẽ <b>văng toàn bộ Khách đã đăng nhập đang sài ké</b> ra ngoài; họ cần nhập đúng mật khẩu mới để tham gia lại.</p>
        </div>
      </div>` : ''}

      ${isOwner() ? `
      <div class="panel"><div class="panel-head"><h3>🛡️ Bảo hiểm &amp; An toàn Dữ liệu</h3></div>
        <div class="panel-body">
          <p class="sub" style="margin:0 0 4px;">Sao lưu định kỳ để phòng trường hợp mất dữ liệu, đổi máy tính, hoặc xoá cache trình duyệt.</p>
          <div class="backup-actions">
            <button class="btn btn-gold" id="bk-export-btn">⬇️ Tải file sao lưu dữ liệu (.json)</button>
            <button class="btn btn-ghost" id="bk-import-btn">⬆️ Nhập dữ liệu từ file sao lưu</button>
            <input type="file" id="bk-import-file" accept="application/json,.json" style="display:none;">
          </div>
          <p class="sub" style="margin-top:10px;">Lưu ý: nhập dữ liệu từ file sao lưu sẽ <b>ghi đè toàn bộ</b> dữ liệu hiện tại (hộ vay, chi tiêu, cấu hình, nhật ký, thùng rác) về đúng trạng thái đã lưu trong file.</p>
        </div>
      </div>` : ''}`;

    const gotoWalletBtn2 = document.getElementById('st-goto-wallet-btn');
    if(gotoWalletBtn2) gotoWalletBtn2.onclick = exitToWallet;
    function wireWardListButtons(){
      el.querySelectorAll('[data-st-view-ward]').forEach(btn=>{
        btn.onclick = ()=> renderWardInfoModal(btn.dataset.stViewWard, false);
      });
    }
    wireWardListButtons();
    if(state.identity.email){
      // Luôn làm mới danh sách mã định danh (chủ/khách) mỗi khi mở tab Cài đặt — CHỈ cập nhật đúng
      // phần danh sách này (không vẽ lại cả tab) để tránh gọi loadWallet() lặp vô hạn.
      loadWallet().then(()=>{
        const listEl = document.getElementById('st-wards-list');
        if(!listEl || state.activeTab!=='settings') return;
        listEl.innerHTML = (state.myWards||[]).map(w=>{
          const active = w.wardId===wardId();
          return `<button class="btn ${active?'btn-primary':'btn-ghost'} btn-sm preview-allow" data-st-view-ward="${w.wardId}" title="${w.kind==='owner'?'Chủ mã':'Khách'}">${w.kind==='owner'?'👑':'👤'} ${escapeHtml(w.wardName||w.wardId)} <span class="mono" style="opacity:.75;">(${escapeHtml(w.wardId)})</span>${active?' — đang dùng':''}</button>`;
        }).join('');
        wireWardListButtons();
      });
    }

    {
      const exportBtn = document.getElementById('bk-export-btn');
      if(exportBtn) exportBtn.onclick = exportBackupJSON;
      const importBtn = document.getElementById('bk-import-btn');
      if(importBtn) importBtn.onclick = ()=> document.getElementById('bk-import-file').click();
      const importFile = document.getElementById('bk-import-file');
      if(importFile) importFile.onchange = (e)=> importBackupJSON(e.target.files[0]);
      const widBtn = document.getElementById('sec-wid-save');
      if(widBtn) widBtn.onclick = async ()=>{
        const val = document.getElementById('sec-wid').value;
        if(!val.trim()){ alert('Vui lòng nhập Mã định danh mới.'); return; }
        await renameOwnWardId(val);
      };
      const passBtn = document.getElementById('sec-pass-save');
      if(passBtn) passBtn.onclick = async ()=>{
        const newPass = document.getElementById('sec-pass').value;
        cfg.accessCode = newPass || '';
        cfg.accessVersion = (cfg.accessVersion||0) + 1; // bump để văng toàn bộ Khách đang sài ké mã cũ
        await cSet('config', cfg);
        await pushLog('đổi mật khẩu mã xã', wardId());
        alert('Đã cập nhật mật khẩu mã xã. Các Khách đã đăng nhập đang sài ké sẽ được yêu cầu nhập lại mật khẩu mới.');
        renderSettingsTab(el);
      };
    }

    // ---- cập nhật động các nhãn khi đổi cấu hình danh xưng (chưa lưu) ----
    function currentSubLabelSt(){
      return document.getElementById('st-subadmin').value;
    }
    function refreshAdminLabelsSt(){
      const level = document.getElementById('st-adminlevel').value;
      const sub = currentSubLabelSt();
      document.getElementById('st-ward-label').textContent = `Tên riêng (${level})`;
      document.getElementById('st-hamlets-label').textContent = `Danh sách các ${sub.toLowerCase()}`;
    }
    document.getElementById('st-adminlevel').onchange = refreshAdminLabelsSt;
    document.getElementById('st-subadmin').onchange = refreshAdminLabelsSt;
    const stHamletsManageBtn = document.getElementById('st-hamlets-manage-btn');
    if(stHamletsManageBtn) stHamletsManageBtn.onclick = ()=> renderHamletManagerModal(()=> renderSettingsTab(el));

    const stBankInfoBtn = document.getElementById('st-bankinfo-btn');
    if(stBankInfoBtn) stBankInfoBtn.onclick = ()=>{
      if(!isOwner()){ alert('Chỉ có Chủ nhân của mã định danh xã/phường này mới có quyền thiết lập thông tin Tài khoản nhận tiền của xã/phường'); return; }
      renderWardBankInfoModal();
    };
    const stSaveBtn = document.getElementById('st-save');
    if(stSaveBtn) stSaveBtn.onclick = async ()=>{
      const subAdminType = document.getElementById('st-subadmin').value;
      const wardNameVal = document.getElementById('st-ward').value.trim();
      const provinceNameVal = document.getElementById('st-provincename').value.trim();
      if(!wardNameVal){ alert(`Vui lòng nhập Tên riêng (${document.getElementById('st-adminlevel').value}).`); return; }
      if(!provinceNameVal){ alert('Vui lòng nhập Tên tỉnh/thành phố.'); return; }
      if(!confirm('Bạn có chắc chắn muốn lưu thay đổi Thông tin địa phương / Loại hình hành chính không? Việc này sẽ ảnh hưởng tới toàn bộ dữ liệu đang có của xã/phường (cách tính lãi, tên gọi hiển thị...). Bạn có chắc chắn?')) return;
      cfg.wardName = wardNameVal;
      cfg.adminLevel = document.getElementById('st-adminlevel').value;
      cfg.provinceType = document.getElementById('st-provincetype').value;
      cfg.provinceName = provinceNameVal;
      cfg.subAdminType = subAdminType;
      await cSet('config', cfg);
      await pushLog('cập nhật', 'cấu hình hệ thống');
      renderSettingsTab(el);
    };

    // ---- Loại 1: chia sẻ chung theo Mã định danh (công khai) ----
    el.querySelectorAll('[data-public-perm]').forEach(sel=>{
      sel.onchange = async ()=>{
        cfg.publicPerms = cfg.publicPerms || {};
        cfg.publicPerms[sel.dataset.publicPerm] = sel.value;
        await cSet('config', cfg);
        await pushLog('cập nhật chia sẻ công khai', `${sel.dataset.publicPerm}: ${sel.value}`);
      };
    });
    // ---- Loại 2: chia sẻ đích danh theo email (đã có) ----
    el.querySelectorAll('[data-grant-perm]').forEach(sel=>{
      sel.onchange = async ()=>{
        const key = sel.dataset.grantPerm, mod = sel.dataset.grantModule;
        cfg.grants = cfg.grants || {};
        if(!cfg.grants[key]) return;
        cfg.grants[key][mod] = sel.value;
        await cSet('config', cfg);
        await pushLog('cập nhật chia sẻ đích danh', `${cfg.grants[key].email} — ${mod}: ${sel.value}`);
      };
    });
    el.querySelectorAll('[data-grant-remove]').forEach(btn=>{
      btn.onclick = async ()=>{
        const key = btn.dataset.grantRemove;
        const email = (cfg.grants && cfg.grants[key] && cfg.grants[key].email) || key;
        if(!confirm(`Gỡ hoàn toàn quyền chia sẻ đích danh cho "${email}"?`)) return;
        delete cfg.grants[key];
        await cSet('config', cfg);
        await pushLog('gỡ chia sẻ đích danh', email);
        renderSettingsTab(el);
      };
    });
    // ---- Loại 2: thêm chia sẻ đích danh mới ----
    const grantAddBtn = document.getElementById('grant-add-btn');
    if(grantAddBtn) grantAddBtn.onclick = async ()=>{
      const email = document.getElementById('grant-new-email').value.trim().toLowerCase();
      if(!email){ alert('Vui lòng nhập email tài khoản Google cần chia sẻ.'); return; }
      const key = emailToKey(email);
      const grant = {email};
      el.querySelectorAll('[data-new-grant-perm]').forEach(sel=>{ grant[sel.dataset.newGrantPerm] = sel.value; });
      cfg.grants = cfg.grants || {};
      cfg.grants[key] = grant;
      await cSet('config', cfg);
      await pushLog('thêm chia sẻ đích danh', email);
      renderSettingsTab(el);
    };
  }

  // ---------- borrower modal ----------
  function renderModal(){
    const isNew = !state.modal.payload;
    if(!isNew && !state.modal.projectId){
      const legacyProject = (state.loanProjects||[]).find(p=>p.name && p.name===state.modal.payload.project);
      state.modal.projectId = state.modal.payload.projectId || (legacyProject && legacyProject.id) || null;
    }
    const project = (state.loanProjects||[]).find(p=>p.id===state.modal.projectId) || (!isNew ? projectOf(state.modal.payload) : null);
    const b = state.modal.payload ? {...state.modal.payload} : emptyBorrowerForProject(project);
    const hamlets = state.config.hamlets||[];
    // Danh sách phương án cho ô "Chọn phương án vay" khi thêm người vay mới — CHỈ hiện những phương
    // án CHƯA hoàn tất toàn bộ (loại trừ phương án mà TẤT CẢ người vay bên trong đã tất toán/trả nợ
    // trước hạn xong hết — phương án mới tạo, chưa có ai, vẫn được hiện bình thường).
    const projects = eligibleProjectsForBorrowerAssignment();
    // Khi sửa một hồ sơ cũ, giữ phương án hiện tại trong danh sách kể cả khi phương án đó vừa bị
    // ẩn khỏi danh sách gán mới; nếu không dropdown sẽ hiển thị rỗng dù hồ sơ vẫn thuộc phương án đó.
    if(!isNew && project && !projects.some(pr=>pr.id===project.id)) projects.unshift(project);
    // Đơn giản hoá: chỉ còn phụ thuộc vào việc ĐÃ chọn phương án vay hay chưa (isNew && !project) — bỏ
    // hẳn khái niệm "needsProjectPicker"/chuyển đổi qua lại giữa 2 chế độ hiển thị, vì giờ khung chọn
    // phương án vay và khung thông tin cụ thể LUÔN hiện CÙNG LÚC, không cần vẽ lại cả modal khi đổi
    // lựa chọn nữa (tránh mất dữ liệu người dùng đang gõ dở — đây là lỗi thật đã xảy ra trước đây).
    // Đơn giản hoá: các trường KHÔNG còn bị khoá theo việc đã chọn phương án vay hay chưa nữa — vì
    // khung chọn phương án vay giờ LUÔN hiện sẵn (không vẽ lại modal khi đổi lựa chọn), nên KHÔNG có
    // thời điểm nào để "mở khoá" các trường khác bằng cách vẽ lại. Thay vào đó, người dùng có thể nhập
    // liệu thoải mái mọi lúc, chỉ kiểm tra BẮT BUỘC đã chọn phương án vay ở bước LƯU (xem cuối hàm).
    const readonly = !canEditModule('data') || !!state.modal.forceReadOnly;
    const forceReadOnly = !!state.modal.forceReadOnly;
    const inheritedReadonly = true; // Yêu cầu mới: các trường kế thừa từ phương án KHOÁ CỨNG, không sửa được nữa, chỉ xem
    const remainBeforeThis = project ? Math.max(0, (parseFloat(project.totalCapital)||0) - projectDisbursedTotal(project.id, b.id)) : null;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    if(forceReadOnly) wrap.style.zIndex = '99998';
    wrap.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>${isNew? 'Thêm người vay mới':'Chi tiết người vay'}</h3><div style="display:flex; align-items:center; gap:8px; margin-left:auto;">${isNew? `<button class="btn btn-sm preview-allow" id="md-quickadd-ai-btn" style="background:linear-gradient(180deg, #ffffff 0%, #7c4dff 45%, #4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700;">✨ Thêm nhanh bằng AI</button>` : ''}<button class="modal-close" id="md-close">✕</button></div></div>
        <div class="modal-body">
          <div class="field full" style="margin-bottom:6px;">
            <label>Chọn phương án vay *</label>
            <select id="m-project-picker">
              <option value="">-- Chọn phương án vay --</option>
              ${projects.map(pr=>`<option value="${pr.id}" ${state.modal.projectId===pr.id?'selected':''}>${escapeHtml(pr.name)}</option>`).join('')}
              <option value="__add__">+ Thêm phương án vay...</option>
            </select>
          </div>
          <div id="m-project-info-box" style="background:var(--paper-2); border:1px solid var(--line); border-radius:10px; padding:10px 14px; margin-bottom:14px;">
            ${project? `<b style="font-size:13px; color:var(--rice-dark);">📋 Phương án vay: ${escapeHtml(project.name)}</b>
              <div class="sub" style="margin-top:4px; font-size:11.5px;">Còn có thể cho vay thêm tối đa: <b>${moneySpaced(remainBeforeThis)}</b> / Tổng vốn ${moneySpaced(project.totalCapital)}</div>`
              : `<b style="color:#b71c1c; font-size:13px;">⚠️ Vui lòng chọn Phương án vay trước</b>`}
          </div>

          <div class="divider-lbl">Thông tin bắt buộc</div>
          <div class="form-grid">
            <div class="field"><label>Họ và tên *</label><input id="m-name" maxlength="30" value="${escapeHtml(b.name)}" ${readonly?'disabled':''}></div>
            <div class="field"><label>Địa bàn dân cư (${subAdminLabel()}) *</label>
              <select id="m-hamlet" ${readonly?'disabled':''}>
                ${hamlets.map(h=>`<option value="${escapeHtml(h)}" ${b.hamlet===h?'selected':''}>${escapeHtml(h)}</option>`).join('')}
                ${(b.hamlet && !hamlets.includes(b.hamlet))? `<option value="${escapeHtml(b.hamlet)}" selected>${escapeHtml(b.hamlet)} (cũ, không còn trong danh sách chung)</option>` : ''}
                <option value="__add__">+ Thêm địa bàn dân cư...</option>
              </select>
            </div>
            <div class="field"><label>Số tiền thực tế vay (đ) * <span class="sub">(tối đa 12 số)</span> <span class="sub" id="m-principal-disp" style="font-weight:700; color:#b71c1c;"></span></label><input type="text" inputmode="numeric" id="m-principal" value="${b.principal||''}" placeholder="Chỉ nhập số" ${readonly?'disabled':''}></div>
            <div class="field"><label style="display:flex; align-items:center; gap:4px;"><button type="button" class="qbox-info-btn" id="m-manager-info" style="width:20px; height:20px; font-size:11px; border-radius:50%;">i</button> Người quản lý hộ vay</label>
              <div id="m-manager-tip" style="display:none; background:var(--paper-2); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:12px; margin:4px 0;">Đây là danh sách những người thuộc hệ thống chi hội Ấp (hoặc đại diện Xã/Phường) phụ trách quản lý các hộ vay. Việc thiết lập sẵn danh sách này giúp sau này dễ dàng tra cứu người quản lý của từng hộ, cũng như tự động tính đúng số tiền lãi được phân bổ về cho từng người quản lý.</div>
              <select id="m-manager" ${readonly?'disabled':''}>
              ${ensureDefaultManagers().map(m=>`<option value="${m.id}" ${(b.managerId||'chihoitruong')===m.id?'selected':''}>${escapeHtml(m.name)}</option>`).join('')}
              <option value="__add__">+ Thêm người quản lý...</option>
            </select></div>
          </div>

          <div class="divider-lbl">Điều khoản vay (đã kế thừa từ phương án — KHOÁ, chỉ xem) chỉ có thể thay đổi ở thông tin phương án vay</div>
          <div class="form-grid">
            <div class="field"><label>Lãi suất (%/năm)</label><input value="${b.rate}%/năm" disabled></div>
            <div class="field"><label>Ngày vay</label><input value="${fmtDate(b.loanDate)}" disabled></div>
            <div class="field"><label>Ngày đến hạn (gốc)</label><input value="${fmtDate(b.dueDate)}" disabled></div>
            <div class="field"><label>Nguồn vay</label><input value="${escapeHtml(b.fundSource||'')}" disabled></div>
          </div>

          <div class="divider-lbl" id="m-adv-toggle" style="cursor:pointer; user-select:none;">🔽 Thông tin nâng cao (không bắt buộc — có thể để trống)</div>
          <div id="m-adv-body">
            <p class="sub" style="margin:-4px 0 10px;">💡 Toàn bộ các trường bên dưới đều KHÔNG bắt buộc phải điền.</p>
            <div class="form-grid">
              <div class="field"><label>Năm sinh</label><input maxlength="4" inputmode="numeric" id="m-birthYear" value="${escapeHtml(b.birthYear||'')}" placeholder="Vd: 1985" ${readonly?'disabled':''}></div>
              <div class="field"><label>Số CCCD <span class="sub">(tối đa 13 số)</span> <span class="sub" id="m-cccd-disp" style="font-weight:700; color:#b71c1c;"></span></label><input id="m-cccd" value="${b.cccd? String(b.cccd).replace(/\D/g,'') : ''}" ${readonly?'disabled':''}></div>
              <div class="field"><label>Số điện thoại <span class="sub">(tối đa 12 ký tự)</span> <span class="sub" id="m-phone-disp" style="font-weight:700; color:#b71c1c;"></span></label><input id="m-phone" value="${b.phone? String(b.phone).replace(/[^\d+]/g,'') : ''}" ${readonly?'disabled':''}></div>
              <div class="field full"><label>Địa chỉ cụ thể</label><input id="m-address" value="${escapeHtml(b.address||'')}" ${readonly?'disabled':''}></div>
              <div class="field full">
                <label>Địa chỉ trước sáp nhập</label>
                <select id="m-legacy-address" ${readonly?'disabled':''}>
                  <option value="">-- Không chọn --</option>
                  ${(state.config.hamletsLegacyHidden||[]).map(h=>`<option value="${escapeHtml(h)}" ${b.preMergerAddress===h?'selected':''}>${escapeHtml(h)}</option>`).join('')}
                  <option value="__add__">+ Thêm địa chỉ trước sáp nhập...</option>
                </select>
              </div>
              <div class="field"><label>Ngành nghề sản xuất kinh doanh</label><input maxlength="100" id="m-industry" value="${escapeHtml(b.industry||'')}" ${readonly?'disabled':''}></div>
              <div class="field"><label>Khả năng trả nợ</label><input maxlength="100" id="m-repayAbility" value="${escapeHtml(b.repayAbility||'')}" ${readonly?'disabled':''}></div>
              <div class="field"><label>Người bảo lãnh</label><input maxlength="100" id="m-guarantor" value="${escapeHtml(b.guarantor||'')}" ${readonly?'disabled':''}></div>
            </div>
            <div class="field full"><label>Ghi chú thêm</label><textarea maxlength="200" id="m-note" rows="2" ${readonly?'disabled':''}>${escapeHtml(b.note||'')}</textarea></div>
          </div>

        </div>
        <div class="modal-foot">
          ${forceReadOnly? `
            <button class="btn btn-ghost" id="m-cancel">Đóng bảng</button>
            ${canEditModule('data')? `<button class="btn btn-primary" id="m-goto-edit">✏️ Sửa thông tin</button>` : ''}
          ` : `
          ${(!isNew && canEditModule('data')) ? `<button class="btn btn-danger" id="m-delete" style="margin-right:auto;">Xoá (chuyển vào thùng rác)</button>` : ''}
          <button class="btn btn-ghost" id="m-cancel">Đóng</button>
          ${canEditModule('data') ? `<button class="btn btn-primary" id="m-save">${isNew?'Thêm người vay':'Lưu thay đổi'}</button>` : ''}
          `}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=>{ wrap.remove(); state.modal=null; };
    wrap.querySelector('#md-close').onclick = close;
    const mdQuickAddBtn = wrap.querySelector('#md-quickadd-ai-btn');
    if(mdQuickAddBtn) mdQuickAddBtn.onclick = ()=> renderQuickAddByAiModal();
    wrap.querySelector('#m-cancel').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    const gotoEditBtn = wrap.querySelector('#m-goto-edit');
    if(gotoEditBtn) gotoEditBtn.onclick = ()=>{ window.__instantRemoveModal(wrap); state.modal.forceReadOnly = false; renderModal(); };
    wrap.querySelector('#m-adv-toggle').onclick = ()=>{
      const body = wrap.querySelector('#m-adv-body');
      body.style.display = body.style.display==='none' ? '' : 'none';
    };
    wrap.querySelector('#m-hamlet').onchange = (e)=>{
      if(e.target.value==='__add__'){
        const prev = e.target.dataset.prev || b.hamlet || (state.config.hamlets||[])[0] || '';
        // QUAN TRỌNG: renderModal() vẽ lại TOÀN BỘ form từ đầu (dùng dữ liệu GỐC của "b", KHÔNG phải
        // những gì người dùng vừa gõ dở trên màn hình) — nếu không lưu/khôi phục thủ công, mọi ký tự
        // đang gõ dở (tên, số tiền, CCCD...) sẽ bị MẤT SẠCH ngay khi đóng bảng quản lý địa bàn dân cư.
        const savedValues = {};
        wrap.querySelectorAll('input[id], select[id], textarea[id]').forEach(el=>{ savedValues[el.id] = el.value; });
        const savedModalBody = wrap.querySelector('.modal-body');
        const savedScroll = savedModalBody ? savedModalBody.scrollTop : null;
        renderHamletManagerModal(()=>{
          window.__instantRemoveModal(wrap);
          renderModal();
          Object.keys(savedValues).forEach(id=>{ const el = document.getElementById(id); if(el && id!=='m-hamlet') el.value = savedValues[id]; });
          const newModalBody = document.querySelector('.modal-bg .modal-body');
          if(newModalBody && savedScroll!=null) newModalBody.scrollTop = savedScroll;
          const newHamletSel = document.getElementById('m-hamlet');
          if(newHamletSel){
            newHamletSel.classList.add('field-border-flash');
            if(newHamletSel.options.length>1) newHamletSel.value = newHamletSel.options[newHamletSel.options.length-2].value;
          }
        });
        e.target.value = prev;
        return;
      }
      e.target.dataset.prev = e.target.value;
    };
    const projectPicker = wrap.querySelector('#m-project-picker');
    if(projectPicker) projectPicker.onchange = ()=>{
      const selId = projectPicker.value;
      if(selId==='__add__'){
        // Trường hợp DUY NHẤT còn cần điều hướng sang màn hình khác (tạo phương án vay mới hoàn toàn)
        // — lưu lại toàn bộ giá trị đang gõ dở trước khi rời đi, khôi phục lại đầy đủ khi quay về.
        const savedValues = {};
        wrap.querySelectorAll('input[id], select[id], textarea[id]').forEach(el=>{ if(el.id!=='m-project-picker') savedValues[el.id] = el.value; });
        renderLoanProjectModal(null, (newId)=>{
          if(newId) state.modal.projectId = newId;
          window.__instantRemoveModal(wrap);
          renderModal();
          requestAnimationFrame(()=>{
            Object.keys(savedValues).forEach(id=>{ const el = document.getElementById(id); if(el) el.value = savedValues[id]; });
          });
        });
        projectPicker.value = state.modal.projectId || '';
        return;
      }
      // Trường hợp bình thường: chỉ đổi LỰA CHỌN phương án vay — cập nhật khung thông tin cụ thể ngay
      // bằng JS TRỰC TIẾP, KHÔNG vẽ lại cả modal — để KHÔNG BAO GIỜ làm mất bất kỳ ký tự nào người dùng
      // đang gõ dở ở các trường khác (tên, số tiền, CCCD...). Đây chính là cách sửa dứt điểm lỗi cũ.
      state.modal.projectId = selId || null;
      const newProject = selId ? (state.loanProjects||[]).find(p=>p.id===selId) : null;
      const infoBox = wrap.querySelector('#m-project-info-box');
      if(infoBox){
        if(newProject){
          const remain = Math.max(0, (parseFloat(newProject.totalCapital)||0) - projectDisbursedTotal(newProject.id, b.id));
          infoBox.innerHTML = `<b style="font-size:13px; color:var(--rice-dark);">📋 Phương án vay: ${escapeHtml(newProject.name)}</b>
            <div class="sub" style="margin-top:4px; font-size:11.5px;">Còn có thể cho vay thêm tối đa: <b>${moneySpaced(remain)}</b> / Tổng vốn ${moneySpaced(newProject.totalCapital)}</div>`;
        } else {
          infoBox.innerHTML = `<b style="color:#b71c1c; font-size:13px;">⚠️ Vui lòng chọn Phương án vay trước</b>`;
        }
      }
    };
    (function(){
      const pInput = wrap.querySelector('#m-principal');
      const pDisp = wrap.querySelector('#m-principal-disp');
      attachMoneyInputMask(pInput, 12);
      const updatePDisp = ()=>{
        const digits = pInput.value.replace(/[^\d]/g,'');
        if(pDisp) pDisp.textContent = digits ? `= ${groupDigitsRight(digits,3)} đ` : '';
      };
      pInput.addEventListener('input', updatePDisp);
      updatePDisp();
    })();
    (function(){
      const mgrInfoBtn = wrap.querySelector('#m-manager-info');
      const mgrTip = wrap.querySelector('#m-manager-tip');
      if(mgrInfoBtn) mgrInfoBtn.onclick = (e)=>{ e.stopPropagation(); mgrTip.style.display = mgrTip.style.display==='none'?'block':'none'; };
      const mgrSel = wrap.querySelector('#m-manager');
      if(mgrSel) mgrSel.onchange = ()=>{
        if(mgrSel.value==='__add__'){
          const prev = mgrSel.dataset.prev || b.managerId || 'chihoitruong';
          const savedValues = {};
          wrap.querySelectorAll('input[id], select[id], textarea[id]').forEach(el=>{ savedValues[el.id] = el.value; });
          const savedModalBody = wrap.querySelector('.modal-body');
          const savedScroll = savedModalBody ? savedModalBody.scrollTop : null;
          renderBorrowerManagerModal(()=>{
            window.__instantRemoveModal(wrap);
            renderModal();
            Object.keys(savedValues).forEach(id=>{ const el = document.getElementById(id); if(el && id!=='m-manager') el.value = savedValues[id]; });
            const newModalBody = document.querySelector('.modal-bg .modal-body');
            if(newModalBody && savedScroll!=null) newModalBody.scrollTop = savedScroll;
            const newMgrSel = document.getElementById('m-manager');
            if(newMgrSel){
              newMgrSel.classList.add('field-border-flash');
              if(newMgrSel.options.length>1) newMgrSel.value = newMgrSel.options[newMgrSel.options.length-2].value;
            }
          });
          mgrSel.value = prev;
          return;
        }
        mgrSel.dataset.prev = mgrSel.value;
      };
    })();
    (function(){
      const cccdInput = wrap.querySelector('#m-cccd');
      const cccdDisp = wrap.querySelector('#m-cccd-disp');
      const updateCccdDisp = ()=>{
        const digits = cccdInput.value.replace(/[^\d]/g,'');
        if(cccdDisp) cccdDisp.textContent = digits ? `= ${groupDigitsRight(digits,4)}` : '';
      };
      cccdInput.addEventListener('input', ()=>{
        cccdInput.value = cccdInput.value.replace(/[^\d]/g,'').slice(0,13);
        updateCccdDisp();
      });
      updateCccdDisp();
      const phoneInput = wrap.querySelector('#m-phone');
      const phoneDisp = wrap.querySelector('#m-phone-disp');
      const updatePhoneDisp = ()=>{
        const raw = phoneInput.value.replace(/[^\d+]/g,'');
        const plus = raw.startsWith('+') ? '+' : '';
        const digits = raw.replace(/\+/g,'');
        if(phoneDisp) phoneDisp.textContent = digits ? `= ${plus}${groupDigitsRight(digits,3)}` : '';
      };
      phoneInput.addEventListener('input', ()=>{
        let raw = phoneInput.value.replace(/[^\d+]/g,'');
        const plus = raw.startsWith('+') ? '+' : '';
        let digits = raw.replace(/\+/g,'').slice(0, 12-plus.length);
        phoneInput.value = plus + digits;
        updatePhoneDisp();
      });
      updatePhoneDisp();
    })();
    const legacySelect = wrap.querySelector('#m-legacy-address');
    if(legacySelect) legacySelect.addEventListener('change', ()=>{
      if(legacySelect.value !== '__add__') return;
      const prev = b.preMergerAddress || '';
      const savedValues = {};
      wrap.querySelectorAll('input[id], select[id], textarea[id]').forEach(el=>{ savedValues[el.id] = el.value; });
      const savedModalBody = wrap.querySelector('.modal-body');
      const savedScroll = savedModalBody ? savedModalBody.scrollTop : null;
      renderLegacyAddressManagerModal(()=>{
        window.__instantRemoveModal(wrap);
        renderModal();
        Object.keys(savedValues).forEach(id=>{ const el = document.getElementById(id); if(el && id!=='m-legacy-address') el.value = savedValues[id]; });
        const newModalBody = document.querySelector('.modal-bg .modal-body');
        if(newModalBody && savedScroll!=null) newModalBody.scrollTop = savedScroll;
        const newLegacySel = document.getElementById('m-legacy-address');
        if(newLegacySel){
          newLegacySel.classList.add('field-border-flash');
          if(newLegacySel.options.length>1) newLegacySel.value = newLegacySel.options[newLegacySel.options.length-2].value;
        }
      });
      legacySelect.value = prev;
    });

    const delBtn = wrap.querySelector('#m-delete');
    if(delBtn) delBtn.onclick = async ()=>{
      // Xoá riêng 1 người vay -> chuyển vào Thùng rác (Sổ vay vốn), khôi phục lại được sau này
      // (sẽ chui về đúng phương án cũ, kèm kiểm tra vượt vốn — xem restoreStandaloneBorrower()).
      if(!confirm(`Xoá người vay "${b.name}" vào thùng rác? Có thể khôi phục lại sau (sẽ quay về đúng phương án vay này). Hệ thống sẽ tự động lập 1 Giấy xác nhận cho hành động này và lưu vào kho Giấy xác nhận.`)) return;
      close(); // Bước 1
      showProcessingToast(); // Bước 2
      state.borrowers = state.borrowers.filter(x=>x.id!==b.id);
      const trashed = {...b, _kind:'borrower', deleted:true, deletedAt:new Date().toISOString(), deletedBy: state.identity.email, deletedByName: state.identity.name};
      state.trash.push(trashed);
      await cRemoveRecord('borrowers', b.id);
      await cSetRecord('trash', trashed.id, trashed);
      await pushLog('xoá', `hộ ${b.name}`);
      await pushConfirmationDocument('borrower_delete', `Giấy xác nhận xoá hộ vay "${b.name}"`,
        `Hộ vay "${b.name}" đã được chuyển vào Thùng rác vào ngày ${fmtDate(todayStr())}.`, b);
      hideProcessingToast(); // Bước 4
      render();
      showToast('Đã xoá hộ vay thành công!');
    };

    const saveBtn = wrap.querySelector('#m-save');
    if(saveBtn) saveBtn.onclick = async ()=>{
      const name = wrap.querySelector('#m-name').value.trim();
      if(!name){ alert('Vui lòng nhập họ và tên.'); return; }
      const selectedProjectId = state.modal.projectId || (!isNew ? b.projectId : '');
      if(!selectedProjectId){ alert('Vui lòng chọn phương án vay trước khi lưu.'); return; }
      // QUAN TRỌNG: tính lại "project" MỚI NHẤT tại đây (không dùng biến "project" ở ngoài — biến đó
      // chỉ đúng tại THỜI ĐIỂM modal vừa mở, có thể đã LỖI THỜI nếu người dùng vừa đổi lựa chọn ở
      // dropdown sau đó, vì giờ đây đổi lựa chọn không còn vẽ lại cả modal nữa).
      const curProject = (state.loanProjects||[]).find(p=>p.id===selectedProjectId);
      if(!curProject){ alert('Không tìm thấy phương án vay đã chọn. Vui lòng đóng bảng và mở lại để cập nhật danh sách.'); return; }
      const hamlet = wrap.querySelector('#m-hamlet').value;
      if(!hamlet){ alert('Vui lòng chọn Địa bàn dân cư.'); return; }
      const principal = parseVNMoney(wrap.querySelector('#m-principal').value);
      // Yêu cầu 2: tổng tiền vay của mọi người vay trong 1 phương án không được vượt tổng vốn của phương án đó.
      if(curProject){
        const remain = Math.max(0, (parseFloat(curProject.totalCapital)||0) - projectDisbursedTotal(curProject.id, b.id));
        if(principal > remain){
          alert(`Không thể lưu! Số tiền vay của hộ này làm vượt quá giới hạn tổng nguồn vốn còn lại của phương án vay (chỉ còn ${moneySpaced(remain)} / Tổng vốn ${moneySpaced(curProject.totalCapital)}).`);
          return;
        }
      }
      const updated = {
        ...b,
        name,
        hamlet,
        principal,
        // Khi thêm mới hoặc chuyển sang phương án khác, kế thừa điều khoản từ phương án đích. Nếu
        // vẫn ở phương án cũ thì giữ ngày vay riêng của Người thừa kế (nếu có).
        projectId: curProject.id,
        ...((isNew || b.projectId!==curProject.id) ? { rate: curProject.interestRate, loanDate: curProject.disburseDate, dueDate: curProject.dueDate, fundSource: curProject.fundSourceType } : {}),
        birthYear: wrap.querySelector('#m-birthYear').value.trim(),
        managerId: (wrap.querySelector('#m-manager')?.value) || b.managerId || 'chihoitruong',
        cccd: wrap.querySelector('#m-cccd').value.replace(/\D/g,''),
        phone: wrap.querySelector('#m-phone').value.replace(/\s/g,'').trim(),
        address: wrap.querySelector('#m-address').value.trim(),
        preMergerAddress: wrap.querySelector('#m-legacy-address').value,
        industry: wrap.querySelector('#m-industry').value.trim(),
        repayAbility: wrap.querySelector('#m-repayAbility').value.trim(),
        guarantor: wrap.querySelector('#m-guarantor').value.trim(),
        note: wrap.querySelector('#m-note').value.trim(),
      };

      // Phát hiện có thay đổi THẬT SỰ hay không (so với dữ liệu gốc trước khi sửa).
      const compareKeysB = ['projectId','name','hamlet','principal','birthYear','managerId','cccd','phone','address','preMergerAddress','industry','repayAbility','guarantor','note'];
      const hasChangedB = !isNew && compareKeysB.some(k=> String(b[k]??'') !== String(updated[k]??''));
      if(hasChangedB){
        if(!confirm(`Bạn có chắc chắn muốn lưu thay đổi thông tin hộ vay "${name}" không? Hệ thống sẽ tự động lập 1 Giấy xác nhận cho hành động này và lưu vào kho Giấy xác nhận.`)) return;
      }
      close(); // Bước 1
      showProcessingToast(); // Bước 2

      if (isNew) {
        // KHÔNG push thủ công — realtime binding (bên dưới, sau cSetRecord) sẽ tự nhận đúng bản ghi
        // mới này, tránh hiển thị trùng lặp tạm thời.
      } else {
        state.borrowers = state.borrowers.map(x => x.id === updated.id ? updated : x);
      }

      await cSetRecord('borrowers', updated.id, updated);
      // Yêu cầu mới: nếu là địa bàn hoàn toàn mới (gõ tay/chọn "Khác") -> tự động đăng ký vào danh
      // sách ấp của mã xã (hiện ở Cài đặt & Chia sẻ) + cập nhật danh sách ẩn "(cũ)" tương ứng.
      await registerHamletIfNew(hamlet);
      await pushLog(isNew ? 'thêm người vay' : 'chỉnh sửa người vay', `${updated.name} — gốc ${money(updated.principal)}${curProject? ' — PA: '+curProject.name : ''}`);
      if(hasChangedB){
        // Tiền gốc (hoặc thông tin khác) vừa đổi có thể làm 1 số Quý "văng ra"/"quay lại" trạng thái
        // đã đóng lãi — ghi log lại đúng lý do "do thay đổi thông tin người vay".
        try{
          const dispBeforeEdit = computeInterestPaymentBoxDisplay(b);
          const dispAfterEdit = computeInterestPaymentBoxDisplay(updated);
          await logQuarterStatusDiff(updated, dispBeforeEdit, dispAfterEdit,
            `Đã được đóng lãi trở lại do thay đổi thông tin hộ vay (Tổng tiền lãi cần đóng của Quý này đã giảm xuống)`,
            `Đã trở về trạng thái chưa đóng lãi do thay đổi thông tin hộ vay (Tổng tiền lãi cần đóng của Quý này đã tăng lên)`);
        }catch(err){ console.error('Lỗi khi ghi log trạng thái Quý:', err); }
      }
      if(isNew){
        await pushConfirmationDocument('borrower_create', `Giấy xác nhận Tạo khoản vay thành công đối với hộ vay "${updated.name}"`,
          `Hộ vay "${updated.name}" đã được thêm mới thành công vào ngày ${fmtDate(todayStr())}. Số tiền vay gốc: ${money(updated.principal)}${curProject? `, thuộc phương án "${curProject.name}"` : ''}. Địa bàn: ${escapeHtml(updated.hamlet||'')}.`, updated);
      } else if(hasChangedB){
        const FIELD_LABELS_B = { projectId:'Phương án vay', name:'Họ và tên', hamlet:`Địa bàn dân cư (${subAdminLabel()})`, principal:'Số tiền vay gốc', birthYear:'Năm sinh', managerId:'Người quản lý', cccd:'Số CCCD', phone:'Số điện thoại', address:'Địa chỉ hiện tại', preMergerAddress:'Địa chỉ trước sáp nhập', industry:'Ngành nghề', repayAbility:'Khả năng trả nợ', guarantor:'Người bảo lãnh', note:'Ghi chú' };
        const changedLines = compareKeysB.filter(k=> String(b[k]??'') !== String(updated[k]??'')).map(k=>{
          const oldV = k==='principal'? money(b[k]||0) : (b[k]||'(để trống)');
          const newV = k==='principal'? money(updated[k]||0) : (updated[k]||'(để trống)');
          const mgrName = (id)=>{ const m=ensureDefaultManagers().find(x=>x.id===id); return m? m.name : id; };
          const projectName = (id, fallback)=>{
            const p=(state.loanProjects||[]).find(x=>x.id===id);
            return p ? p.name : (fallback || id || '(để trống)');
          };
          const oldDisp = k==='managerId' ? mgrName(b[k]) : (k==='projectId' ? projectName(b[k], b.project) : oldV);
          const newDisp = k==='managerId' ? mgrName(updated[k]) : (k==='projectId' ? projectName(updated[k], '') : newV);
          return `${FIELD_LABELS_B[k]||k} được sửa từ "${oldDisp}" thành "${newDisp}"`;
        });
        await pushConfirmationDocument('borrower_edit', `Giấy xác nhận sửa thông tin hộ vay "${name}"`,
          `Hộ vay "${name}" đã được sửa thông tin vào ngày ${fmtDate(todayStr())}:\n${changedLines.map(l=>'- '+l).join('\n')}`, updated);
      }
      hideProcessingToast(); // Bước 4
      render();
      showToast(isNew? 'Đã thêm hộ vay thành công!' : 'Đã lưu thay đổi thành công!');
    };
  }

  // ---------- loan project (Phương án vay) modal ----------
  // Các mốc "Khoảng thời gian" giúp tự động tính nhanh Ngày đến hạn từ Ngày giải ngân — đây CHỈ là
  // công cụ hỗ trợ nhập liệu, KHÔNG được lưu trữ hay hiển thị ở bất kỳ đâu khác (không vào dữ liệu
  // phương án/người vay, không lên bảng/cột, không xuất Excel/in).
  const LOAN_DURATION_OPTIONS = [
    {key:'other', label:'Khác', years:null},
    {key:'0.5', label:'0,5 năm', years:0.5}, {key:'1', label:'1 năm', years:1}, {key:'1.5', label:'1,5 năm', years:1.5},
    {key:'2', label:'2 năm', years:2}, {key:'2.5', label:'2,5 năm', years:2.5}, {key:'3', label:'3 năm', years:3},
    {key:'3.5', label:'3,5 năm', years:3.5}, {key:'4', label:'4 năm', years:4}, {key:'4.5', label:'4,5 năm', years:4.5},
    {key:'5', label:'5 năm', years:5}, {key:'6', label:'6 năm', years:6}, {key:'7', label:'7 năm', years:7},
    {key:'8', label:'8 năm', years:8}, {key:'9', label:'9 năm', years:9}, {key:'10', label:'10 năm', years:10},
  ];
  // Cộng thêm N năm (có thể lẻ .5 = 6 tháng) vào 1 ngày yyyy-mm-dd, GIỮ NGUYÊN số ngày trong tháng.
  function addYearsToDateStr(dateStr, years){
    if(!dateStr) return '';
    const d = new Date(dateStr+'T00:00:00');
    if(isNaN(d.getTime())) return '';
    const wholeYears = Math.floor(years);
    const extraMonths = Math.round((years - wholeYears) * 12); // 0.5 năm -> 6 tháng
    const newD = new Date(d.getFullYear()+wholeYears, d.getMonth()+extraMonths, d.getDate());
    const yyyy = newD.getFullYear(), mm = String(newD.getMonth()+1).padStart(2,'0'), dd = String(newD.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ---------------------------------------------------------------------
  // Modal "Chỉnh thời gian tính lãi suất hàng quý" — chọn mốc bắt đầu/kết thúc từng Quý CHỈ theo
  // ngày/tháng (không năm), áp dụng lặp lại cho mọi năm. Danh sách 14 "tháng" trượt từ Tháng 12
  // năm trước tới Tháng 1 năm sau giúp người dùng dễ hình dung các mốc vắt qua năm (như Quý 1).
  // ---------------------------------------------------------------------
  const QUARTER_MONTH_PICKER_ITEMS = [
    {month:12, label:'Tháng 12 (năm trước)'}, {month:1, label:'Tháng 1'}, {month:2, label:'Tháng 2'}, {month:3, label:'Tháng 3'},
    {month:4, label:'Tháng 4'}, {month:5, label:'Tháng 5'}, {month:6, label:'Tháng 6'}, {month:7, label:'Tháng 7'},
    {month:8, label:'Tháng 8'}, {month:9, label:'Tháng 9'}, {month:10, label:'Tháng 10'}, {month:11, label:'Tháng 11'},
    {month:12, label:'Tháng 12 (hiện tại)'}, {month:1, label:'Tháng 1 (năm sau)'},
  ];
  // Khoảng CHỈ SỐ (0-based, theo đúng thứ tự QUARTER_MONTH_PICKER_ITEMS ở trên) được phép chọn cho
  // từng mốc Bắt đầu/Kết thúc của từng Quý — ngoài khoảng này vẫn HIỂN THỊ nhưng bị làm NHẠT, khoá
  // không cho bấm (không xoá hẳn khỏi danh sách) để người dùng vẫn hình dung được toàn cảnh 14 tháng.
  const QUARTER_MONTH_ALLOWED_RANGE = {
    'q1-start':[0,6],  'q1-end':[1,6],
    'q2-start':[2,9],  'q2-end':[2,9],
    'q3-start':[4,11], 'q3-end':[4,11],
    'q4-start':[6,13], 'q4-end':[6,13],
  };
  function daysInMonthGeneric(month){ return {1:31,2:29,3:31,4:30,5:31,6:30,7:31,8:31,9:30,10:31,11:30,12:31}[month] || 31; }
  // Đo số ngày của 1 Quý theo mẫu ngày/tháng (không năm). Thử tính THẲNG trong cùng 1 năm trước;
  // nếu ra số âm (Kết thúc "sớm hơn" Bắt đầu trong cùng năm) thì thử giả định vắt qua năm sau như
  // Quý 1 mặc định — nhưng CHỈ chấp nhận cách hiểu vắt năm này nếu kết quả ra một khoảng thời gian
  // HỢP LÝ (dưới 180 ngày, ~nửa năm). Nếu vắt năm cũng cho ra khoảng phi lý (gần cả năm) thì đây rõ
  // ràng là người dùng đặt lộn ngược Bắt đầu/Kết thúc — GIỮ NGUYÊN số âm để bị bắt lỗi "ít hơn 15
  // ngày" thay vì âm thầm chấp nhận thành 1 khoảng thời gian khổng lồ vô lý.
  function quarterSpanDaysDraft(q){
    if(q.startMonth==null || q.endMonth==null) return null;
    const pad = n=> String(n).padStart(2,'0');
    const start = new Date(`2002-${pad(q.startMonth)}-${pad(q.startDay)}T00:00:00`);
    const end = new Date(`2002-${pad(q.endMonth)}-${pad(q.endDay)}T00:00:00`);
    const straightDiff = Math.round((end-start)/86400000);
    if(straightDiff>=0) return straightDiff;
    const wrappedDiff = straightDiff + 365;
    return wrappedDiff<=180 ? wrappedDiff : straightDiff;
  }
  // "Ngày thứ mấy trong năm" (1-365, năm tham chiếu không nhuận cố định) của 1 mốc ngày/tháng.
  function dayOfYearOrdinal(month, day){
    const dt = new Date(2001, month-1, Math.min(day, daysInMonthGeneric(month)));
    const start = new Date(2001,0,1);
    return Math.round((dt-start)/86400000)+1;
  }
  // Bản đồ mốc LIỀN KỀ giữa các Quý — mỗi khi sửa 1 đầu mút, đầu mút liền kề tương ứng sẽ tự động
  // được đồng bộ theo CÙNG 1 giá trị. Nhờ vậy cấu trúc luôn đảm bảo KHÔNG trùng nhau, KHÔNG có ngày
  // nào "mồ côi" ngoài mọi Quý — không cần kiểm tra riêng nữa.
  const QUARTER_NEIGHBOR = {
    'q1-start':{qk:'q4', part:'end'}, 'q1-end':{qk:'q2', part:'start'},
    'q2-start':{qk:'q1', part:'end'}, 'q2-end':{qk:'q3', part:'start'},
    'q3-start':{qk:'q2', part:'end'}, 'q3-end':{qk:'q4', part:'start'},
    'q4-start':{qk:'q3', part:'end'}, 'q4-end':{qk:'q1', part:'start'},
  };
  // Tổng hợp thông tin ở khung tính toán: tổng số ngày 4 Quý (chỉ để hiển thị, không còn tô màu
  // theo điều kiện), và danh sách các Quý đang bị ít hơn 15 ngày (0 hoặc âm cũng tính).
  function computeQuartersSummary(draft){
    const order = ['q1','q2','q3','q4'];
    let total = 0, missing = false;
    const shortQuarters = [];
    order.forEach((qk,i)=>{
      const d = quarterSpanDaysDraft(draft[qk]);
      if(d==null) missing = true;
      else{ total += d; if(d<15) shortQuarters.push(i+1); }
    });
    return { total, missing, shortQuarters };
  }
  // Lưu 1 dòng lịch sử (bản CŨ sắp bị thay thế) rồi dọn dẹp — chỉ giữ tối đa 10 dòng gần nhất, dòng
  // cũ nhất tự động bị xoá khi vượt quá.
  // Đổi mốc thời gian hàng quý ẢNH HƯỞNG tới TẤT CẢ người vay — cần cảnh báo 2 lớp + lập hàng loạt
  // Giấy xác nhận (mỗi người 1 giấy, không thể xoá/sửa) trước khi thực sự lưu.
  function renderQuarterChangeWarningModal(draft, oldQuarters, closeParentModal){
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    wrap.innerHTML = `
      <div class="modal" style="max-width:96vw; width:600px;">
        <div class="modal-head"><h3>⚠️ Xác nhận đổi mốc thời gian hàng quý</h3><button class="modal-close preview-allow" id="qcw-close">✕</button></div>
        <div class="modal-body">
          <p class="sub" style="line-height:1.7;">Việc chỉnh lại thời gian tính lãi suất hàng quý sẽ thay đổi toàn bộ các Quý của <b>tất cả người vay</b>, đồng thời ảnh hưởng tới cách tính tiền lãi mỗi Quý của từng người kể từ bây giờ (riêng <b>tiền lãi đã đóng sẽ không bao giờ bị thay đổi</b>).</p>
          <p class="sub" style="line-height:1.7;">Hệ thống sẽ tự động lập hàng loạt <b>Giấy xác nhận thay đổi mốc thời gian hàng quý</b> — mỗi người vay 1 giấy riêng, lưu vào Kho Giấy xác nhận. Giấy này <b>không thể xoá, không thể sửa thông tin bên trong</b>; mỗi lần đổi mốc thời gian hàng quý sẽ tạo ra 1 loạt giấy xác nhận hoàn toàn mới cho từng người vay.</p>
          <p class="sub" style="line-height:1.7;">Mốc thời gian hàng quý này sẽ không thể tác động đối với các khoản vay đã tất toán hoặc trả nợ trước hạn xong, trừ khi các khoản vay đó trở về trạng thái đang hoạt động.</p>
          <p class="sub" style="line-height:1.7; font-weight:700;">Bạn có chắc chắn muốn đổi mốc thời gian hàng quý cho tất cả người vay hay không?</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="qcw-back">Quay lại (không xác nhận)</button>
          <button class="btn btn-primary preview-allow" id="qcw-confirm">Xác nhận thay đổi</button>
        </div>
      </div>`;
    wrap.querySelector('#qcw-close').onclick = close;
    wrap.querySelector('#qcw-back').onclick = close;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap.querySelector('#qcw-confirm').onclick = async ()=>{
      if(!isOwner()){
        const ownerName = (state.collaborators && state.collaborators[state.config.ownerEmail] && state.collaborators[state.config.ownerEmail].name) || '(chưa rõ họ tên)';
        alert(`Chỉ có Chủ mã định danh xã/phường này mới có QUYỀN thay đổi Mốc thời gian hàng quý, vui lòng liên hệ chủ mã: ${ownerName} — ${state.config.ownerEmail||'(chưa rõ email)'}`);
        return;
      }
      if(!confirm('Bạn có THẬT SỰ chắc chắn muốn đổi mốc thời gian hàng quý cho TẤT CẢ người vay không? Mỗi lần đổi sẽ tạo ra hàng loạt giấy xác nhận thay đổi thông tin cho từng người vay.')){
        // Bấm "Không" -> tắt HẾT mọi bảng đang hiển thị, kể cả bảng "Chỉnh thời gian tính lãi suất
        // hàng quý" phía sau.
        close();
        if(closeParentModal) closeParentModal();
        return;
      }
      if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để lưu thay đổi.'); return; }
      close(); // Bước 1
      if(closeParentModal) closeParentModal();
      showProcessingToast(); // Bước 2
      const oldQ = oldQuarters || DEFAULT_QUARTERS;
      if(oldQuarters) await appendQuarterHistoryAndTrim(oldQuarters);
      state.config.quarters = draft;
      await cSet('config', state.config);
      const allActive = state.borrowers.filter(b=>!b.deleted);
      const fmtQ = (q)=> `từ ${q.startDay}/${q.startMonth} đến ${q.endDay}/${q.endMonth}`;
      const qLines = ['q1','q2','q3','q4'].map(qk=>{
        const before = oldQ[qk], after = draft[qk];
        const changed = before.startMonth!==after.startMonth || before.startDay!==after.startDay || before.endMonth!==after.endMonth || before.endDay!==after.endDay;
        return changed
          ? `${after.label||qk}: ĐÃ THAY ĐỔI — trước đây ${fmtQ(before)}, nay đổi thành ${fmtQ(after)}`
          : `${after.label||qk}: không thay đổi — vẫn giữ nguyên ${fmtQ(after)}`;
      });
      await pushSharedConfirmationDocument('quarter_config_change_bulk', `GXN Chung: Thay đổi mốc thời gian hàng quý`,
        [
          `Mốc thời gian tính lãi suất hàng quý đã được thay đổi vào ngày ${fmtDate(todayStr())}, áp dụng đồng loạt cho tất cả người vay đang hoạt động.`,
          ...qLines,
          `Tiền lãi đã đóng của mọi hộ vay đều KHÔNG bị thay đổi.`,
          `Số người vay bị áp dụng: ${allActive.length} người.`,
        ].join('\n'), allActive.map(b=>b.id));
      await pushLog('cập nhật', 'mốc 4 Quý tính lãi suất (áp dụng cho tất cả người vay)');
      hideProcessingToast(); // Bước 4
      showBigToast(`Đã đổi xong mốc thời gian hàng quý cho tất cả ${allActive.length} người vay!`);
    };
  }
  async function appendQuarterHistoryAndTrim(oldQuarters){
    try{
      const device = await getClientDeviceInfo();
      const id = uid();
      await cSetRecord('quarterSettingsHistory', id, { id, time:new Date().toISOString(), quarters:oldQuarters, byName: state.identity.name||'', byEmail: state.identity.email||'', byIp: device.ip||'', byDevice: device.userAgent||'' });
      const snap = await wref('quarterSettingsHistory').once('value');
      const all = snapToArray(snap.val()).filter(rec=> rec && rec.id).sort((a,b)=> new Date(b.time)-new Date(a.time));
      if(all.length>10){
        for(const rec of all.slice(10)) await cRemoveRecord('quarterSettingsHistory', rec.id);
      }
    }catch(e){ console.error('Lưu lịch sử mốc Quý lỗi:', e); }
  }
  // "Xem lịch sử chỉnh sửa" — mở bảng con hiện chi tiết 1 mốc lịch sử. "Xem Nội dung cụ thể" sẽ đóng
  // bảng con này lại và áp dụng (chỉ ở bản nháp) các mốc Quý của lịch sử này vào khung nội dung chính,
  // gọi applyFn() để làm việc đó (KHÔNG tự lưu thật — vẫn cần bấm "Lưu thay đổi" ở bảng chính).
  function renderQuarterHistoryDetailModal(h, applyFn){
    const wrap2 = document.createElement('div');
    wrap2.className = 'modal-bg';
    document.body.appendChild(wrap2);
    const close2 = ()=> wrap2.remove();
    const d = new Date(h.time);
    const timeLbl = isNaN(d.getTime())? '' : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')} ngày ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    wrap2.innerHTML = `
      <div class="modal" style="max-width:96vw; width:520px;">
        <div class="modal-head"><h3>🕘 Chi tiết lịch sử chỉnh mốc hàng quý</h3><button class="modal-close preview-allow" id="qhd-close">✕</button></div>
        <div class="modal-body">
          <p style="line-height:1.8;">Đây là lịch sử chỉnh mốc hằng quý được thiết lập vào lúc <b>${timeLbl}</b> bởi <b>${escapeHtml(h.byName||'(không rõ)')}</b>, email: <b>${escapeHtml(h.byEmail||'(không có)')}</b>, địa chỉ IP: <b>${escapeHtml(h.byIp||'(không lấy được)')}</b>.</p>
          <p class="sub">Nếu bấm "Xem Nội dung cụ thể" bên dưới, các mốc Quý của lịch sử này sẽ được hiện ra ở khung nội dung chính — bạn vẫn cần bấm tiếp nút "Lưu thay đổi" để thực sự áp dụng. Nếu chỉ xem thì không cần bấm gì thêm, cứ bấm "Quay lại".</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost preview-allow" id="qhd-back">Quay lại</button>
          <button class="btn btn-primary preview-allow" id="qhd-apply">Xem Nội dung cụ thể</button>
        </div>
      </div>`;
    wrap2.querySelector('#qhd-close').onclick = close2;
    wrap2.querySelector('#qhd-back').onclick = close2;
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
    wrap2.querySelector('#qhd-apply').onclick = ()=>{ close2(); applyFn(); };
  }
  function renderQuarterIntervalModal(){
    const draft = JSON.parse(JSON.stringify((state.config && state.config.quarters) ? state.config.quarters : DEFAULT_QUARTERS));
    let view = { mode:'main', editKey:null, month:null }; // mode: 'main' | 'month' | 'day'
    let flashTargets = []; // [{qk,part}, ...] — 2 mốc vừa được đồng bộ, cần chớp xanh lá
    let historyOpen = false;
    let expandedHistoryId = null;
    let scrollToHistoryOnRender = false;
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();

    function boundaryLabel(qKey, part){
      const q = draft[qKey];
      const m = part==='start' ? q.startMonth : q.endMonth;
      const d = part==='start' ? q.startDay : q.endDay;
      if(m==null) return '(chưa đặt)';
      return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
    }

    function renderBody(){
      let bodyHtml;
      if(view.mode==='main'){
        const summary = computeQuartersSummary(draft);
        const totalLine = summary.missing ? 'Chưa đủ mốc để tính tổng số ngày 4 Quý.' : `Tổng 4 quý đang là ${summary.total} ngày`;
        const shortLine = summary.shortQuarters.length ? `${summary.shortQuarters.map(n=>`Quý ${n}`).join(', ')} đang bị ít hơn 15 ngày` : '';
        const history = (state.quarterSettingsHistory||[]).filter(h=>h && h.id);
        bodyHtml = `
          <p class="sub" style="margin-top:0;">Mốc 4 Quý CHỈ tính theo ngày/tháng (không năm), áp dụng lặp lại cho mọi năm quá khứ, hiện tại, tương lai. Bấm vào từng mốc để chọn ngày/tháng mới — sửa xong 1 đầu mút, đầu mút liền kề của Quý bên cạnh sẽ TỰ ĐỘNG đồng bộ theo (chớp xanh lá báo hiệu), đảm bảo luôn không trùng nhau, không có ngày nào bị bỏ sót.</p>
          ${['q1','q2','q3','q4'].map(qk=>`
            <div style="border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin-bottom:10px; background:var(--white);">
              <label style="font-size:12.5px; font-weight:700; color:var(--rice-dark);">${draft[qk].label || qk.toUpperCase()}</label>
              <div style="display:flex; gap:8px; margin-top:8px; align-items:center; flex-wrap:wrap;">
                <button class="btn btn-ghost btn-sm preview-allow" data-qedit="${qk}" data-part="start" data-boundary="${qk}-start">Bắt đầu: ${boundaryLabel(qk,'start')}</button>
                <span class="sub">→</span>
                <button class="btn btn-ghost btn-sm preview-allow" data-qedit="${qk}" data-part="end" data-boundary="${qk}-end">Kết thúc: ${boundaryLabel(qk,'end')}</button>
              </div>
            </div>`).join('')}
          <div style="border-radius:10px; overflow:hidden; margin-top:4px;">
            <div style="padding:10px 14px; font-size:12.5px; font-weight:700; background:var(--paper-2); color:var(--rice-dark);">${escapeHtml(totalLine)}</div>
            ${shortLine? `<div style="padding:10px 14px; font-size:12.5px; font-weight:700; background:rgba(239,83,80,.20); color:var(--rice-dark); margin-top:2px;">${escapeHtml(shortLine)}</div>` : ''}
          </div>
          ${historyOpen? `
          <div style="margin-top:14px; border:1px solid var(--line); border-radius:10px; padding:10px 12px;">
            <b style="font-size:12.5px; color:var(--rice-dark);">🕘 Lịch sử chỉnh sửa (không thể xoá/ẩn được thủ công)</b>
            ${!history.length? `<p class="sub" style="margin:8px 0 0;">Chưa có lịch sử chỉnh sửa nào.</p>` : `
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
              ${history.map(h=>`
                <button type="button" class="btn btn-ghost btn-sm preview-allow" data-hist-view="${h.id}" style="width:100%; text-align:left;">🕘 ${new Date(h.time).toLocaleString('vi-VN')}${h.byName? ' — '+escapeHtml(h.byName) : ''}</button>`).join('')}
            </div>`}
          </div>` : ''}`;
      } else if(view.mode==='month'){
        const range = QUARTER_MONTH_ALLOWED_RANGE[`${view.editKey}-${view.part}`] || [0,13];
        bodyHtml = `
          <button class="btn btn-ghost btn-sm preview-allow" id="qim-back-main">← Quay lại</button>
          <p class="sub">Chọn tháng cho mốc <b>${view.part==='start'?'Bắt đầu':'Kết thúc'}</b> của <b>${draft[view.editKey].label}</b>. Các tháng bị làm nhạt là không hợp lý cho mốc này nên không chọn được:</p>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${QUARTER_MONTH_PICKER_ITEMS.map((it,idx)=>{
              const allowed = idx>=range[0] && idx<=range[1];
              return `<button class="btn btn-ghost btn-sm ${allowed?'preview-allow':''}" data-qmonth="${idx}" ${allowed?'':'disabled'} style="${allowed? '' : 'opacity:.35; cursor:not-allowed;'}">${it.label}</button>`;
            }).join('')}
          </div>`;
      } else { // 'day'
        const daysN = daysInMonthGeneric(view.month);
        bodyHtml = `
          <button class="btn btn-ghost btn-sm preview-allow" id="qim-back-month">← Chọn lại tháng</button>
          <p class="sub">Chọn ngày trong Tháng ${view.month}:</p>
          <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:6px; max-width:360px;">
            ${Array.from({length:daysN}, (_,i)=>i+1).filter(d=> !(view.month===12 && d===29) && !(view.month===2 && d===29)).map(d=>`<button class="btn btn-ghost btn-sm preview-allow" data-qday="${d}" style="padding:6px 0;">${d}</button>`).join('')}
          </div>`;
      }
      wrap.innerHTML = `
        <div class="modal">
          <div class="modal-head"><h3>${waveTextHtmlSlow('📅 Chỉnh mốc thời gian tính lãi hàng Quý')}</h3><button class="modal-close preview-allow" id="qim-close">✕</button></div>
          <div class="modal-body">${bodyHtml}</div>
          <div class="modal-foot">
            <button class="btn btn-ghost preview-allow" id="qim-cancel">Đóng</button>
            ${view.mode==='main'? `<button class="btn btn-ghost preview-allow" id="qim-restore-default">Khôi phục cài đặt gốc</button>` : ''}
            ${view.mode==='main'? `<button class="btn btn-ghost preview-allow" id="qim-history-toggle">🕘 Xem lịch sử chỉnh sửa</button>` : ''}
            ${view.mode==='main'? `<button class="btn btn-primary preview-allow" id="qim-save">Lưu thay đổi</button>` : ''}
          </div>
        </div>`;
      wire();
      // Chớp xanh lá nhẹ nhàng 2,5 giây cho đúng 2 mốc vừa được đồng bộ (nếu có)
      if(flashTargets.length){
        flashTargets.forEach(t=>{
          const btn = wrap.querySelector(`[data-boundary="${t.qk}-${t.part}"]`);
          if(btn) btn.classList.add('qim-flash');
        });
        setTimeout(()=>{ wrap.querySelectorAll('.qim-flash').forEach(el=>el.classList.remove('qim-flash')); }, 2600);
        flashTargets = [];
      }
      // Vừa mở khung "Xem lịch sử chỉnh sửa" -> tự cuộn xuống cuối để thấy ngay danh sách lịch sử
      if(scrollToHistoryOnRender){
        const bodyEl = wrap.querySelector('.modal-body');
        if(bodyEl) bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior:'smooth' });
        scrollToHistoryOnRender = false;
      }
    }
    function wire(){
      wrap.querySelector('#qim-close').onclick = close;
      wrap.querySelector('#qim-cancel').onclick = close;
      // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được, theo quy định chung toàn app)
      if(view.mode==='main'){
        wrap.querySelectorAll('[data-qedit]').forEach(btn=>{
          btn.onclick = ()=>{ view = { mode:'month', editKey:btn.dataset.qedit, part:btn.dataset.part }; renderBody(); };
        });
        const saveBtn = wrap.querySelector('#qim-save');
        if(saveBtn) saveBtn.onclick = async ()=>{
          if(state.previewMode){ alert('Bạn đang ở trạng thái tham quan, vui lòng đăng nhập hoặc tham gia bằng mã định danh để lưu thay đổi.'); return; }
          if(!state.config) return;
          const summary = computeQuartersSummary(draft);
          if(summary.shortQuarters.length){
            alert(`Không thể lưu! ${summary.shortQuarters.map(n=>`Quý ${n}`).join(', ')} đang bị ít hơn 15 ngày — mỗi Quý phải có thời lượng TỐI THIỂU 15 ngày. Vui lòng kiểm tra lại mốc Bắt đầu/Kết thúc.`);
            return;
          }
          const oldQuarters = state.config.quarters;
          const changed = JSON.stringify(oldQuarters) !== JSON.stringify(draft);
          if(!changed){
            // Không có gì khác biệt thật sự -> cho lưu thoải mái, không cần cảnh báo gì cả.
            state.config.quarters = draft;
            await cSet('config', state.config);
            await pushLog('cập nhật', 'mốc 4 Quý tính lãi suất');
            showToast('Đã lưu mốc 4 Quý!');
            close();
            return;
          }
          renderQuarterChangeWarningModal(draft, oldQuarters, close);
        };
        const restoreBtn = wrap.querySelector('#qim-restore-default');
        if(restoreBtn) restoreBtn.onclick = ()=>{
          if(!confirm('Khôi phục tất cả thời gian 4 Quý về đúng mặc định ban đầu? (Chưa lưu ngay — bạn vẫn cần bấm "Lưu thay đổi" để áp dụng thật.)')) return;
          Object.keys(DEFAULT_QUARTERS).forEach(qk=>{ draft[qk] = JSON.parse(JSON.stringify(DEFAULT_QUARTERS[qk])); });
          flashTargets = ['q1','q2','q3','q4'].flatMap(qk=>[{qk,part:'start'},{qk,part:'end'}]);
          renderBody();
        };
        const histToggleBtn = wrap.querySelector('#qim-history-toggle');
        if(histToggleBtn) histToggleBtn.onclick = ()=>{
          historyOpen = !historyOpen;
          if(historyOpen) scrollToHistoryOnRender = true;
          renderBody();
        };
        // Nút từng dòng "Xem lịch sử" — gắn sự kiện qua UỶ QUYỀN (event delegation) trên `wrap` NGOÀI
        // CÙNG (chỉ tạo đúng 1 lần, không bao giờ bị thay thế) — khác với các nút BÊN TRONG innerHTML
        // sẽ bị dựng lại mới hoàn toàn mỗi lần renderBody() chạy, nên gắn trực tiếp .onclick có thể bị
        // trượt mất trong một số trường hợp. Nhờ uỷ quyền, nút này LUÔN nhận được click.
        if(!wrap._histViewDelegated){
          wrap._histViewDelegated = true;
          wrap.addEventListener('click', (e)=>{
            const btn = e.target.closest('[data-hist-view]');
            if(!btn) return;
            const h = (state.quarterSettingsHistory||[]).find(x=>x.id===btn.dataset.histView);
            if(!h) return;
            renderQuarterHistoryDetailModal(h, ()=>{
              Object.keys(DEFAULT_QUARTERS).forEach(qk=>{ if(h.quarters[qk]) draft[qk] = JSON.parse(JSON.stringify(h.quarters[qk])); });
              flashTargets = ['q1','q2','q3','q4'].flatMap(qk=>[{qk,part:'start'},{qk,part:'end'}]);
              renderBody();
            });
    }, error=>{
      if(superNotesListenerRef!==ref) return;
      state.superNotesLoading = false;
      state.superNotesLoadError = 'Firebase không cho phép đọc kho ghi chú này hoặc kết nối đã bị gián đoạn.';
      state.superNotesTree = {};
      console.warn('Realtime Siêu ghi chú lỗi:',error);
      if(state._superNotesOpen) renderSuperNotesOverlay();
    });
        }
      } else if(view.mode==='month'){
        wrap.querySelector('#qim-back-main').onclick = ()=>{ view = {mode:'main'}; renderBody(); };
        wrap.querySelectorAll('[data-qmonth]:not([disabled])').forEach(btn=>{
          btn.onclick = ()=>{
            const it = QUARTER_MONTH_PICKER_ITEMS[parseInt(btn.dataset.qmonth,10)];
            view = { mode:'day', editKey:view.editKey, part:view.part, month:it.month };
            renderBody();
          };
        });
      } else {
        wrap.querySelector('#qim-back-month').onclick = ()=>{ view = { mode:'month', editKey:view.editKey, part:view.part }; renderBody(); };
        wrap.querySelectorAll('[data-qday]').forEach(btn=>{
          btn.onclick = ()=>{
            const day = parseInt(btn.dataset.qday,10);
            const editKey = view.editKey, part = view.part, month = view.month;
            const q = draft[editKey];
            if(part==='start'){ q.startMonth = month; q.startDay = day; } else { q.endMonth = month; q.endDay = day; }
            // Đồng bộ mốc liền kề của Quý bên cạnh theo ĐÚNG giá trị vừa chọn.
            const neighbor = QUARTER_NEIGHBOR[`${editKey}-${part}`];
            if(neighbor){
              const nq = draft[neighbor.qk];
              if(neighbor.part==='start'){ nq.startMonth = month; nq.startDay = day; } else { nq.endMonth = month; nq.endDay = day; }
              flashTargets = [{qk:editKey, part}, {qk:neighbor.qk, part:neighbor.part}];
            }
            view = { mode:'main' };
            renderBody();
          };
        });
      }
    }
    renderBody();
  }

  function renderLoanProjectModal(payload, onDone, forceReadOnly){
    const isNew = !payload;
    const p = payload ? {...payload} : emptyLoanProject();
    const curSubLower = subAdminLabelLower();
    const cancelLabel = forceReadOnly ? 'Đóng bảng' : (onDone ? 'Đóng (không lưu)' : 'Đóng');
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    if(forceReadOnly) wrap.style.zIndex = '99998';
    wrap.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>${forceReadOnly? 'Chi tiết phương án vay' : (isNew? 'Tạo phương án vay mới' : 'Sửa phương án vay')}</h3><div style="display:flex; align-items:center; gap:8px; margin-left:auto;">${(isNew && !forceReadOnly)? `<button class="btn btn-sm preview-allow" id="lpm-quickadd-ai-btn" style="background:linear-gradient(180deg, #ffffff 0%, #7c4dff 45%, #4527a0 100%); color:#fff; border-color:#4527a0; font-weight:700;">✨ Thêm nhanh bằng AI</button>` : ''}<button class="modal-close" id="lpm-close">✕</button></div></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field full"><label>Tên phương án vay * <span class="sub">(tối đa 40 ký tự)</span></label><input id="lpm-name" maxlength="40" value="${escapeHtml(p.name)}" placeholder="Vd: Chăn nuôi Dê, Trồng cây sầu riêng..."></div>
            <div class="field"><label>Tổng số tiền nguồn vốn (đ) * <span class="sub">(tối đa 12 số)</span> <span class="sub" id="lpm-capital-disp" style="font-weight:700; color:#b71c1c;"></span></label><input type="text" inputmode="numeric" id="lpm-capital" value="${p.totalCapital||''}" placeholder="Chỉ nhập số, vd: 200000000"></div>
            <div class="field"><label>Ngày giải ngân (ngày vay) *</label><input type="date" id="lpm-disburse" max="${todayStr()}" value="${p.disburseDate||''}"></div>
            <div class="field"><label>Khoảng thời gian <span class="sub">(chỉ để tính nhanh)</span></label>
              <select id="lpm-duration">${LOAN_DURATION_OPTIONS.map(o=>`<option value="${o.key}">${o.label}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Ngày đến hạn trả *</label><input type="date" id="lpm-due" value="${p.dueDate||''}"></div>
            <div class="field"><label>Nguồn vay *</label>
              <select id="lpm-fundsource-type">${fundSourceSelectOptionsHtml(p.fundSourceType)}</select>
            </div>
            <div class="field"><label>Lãi suất người vay phải trả (%/năm) *</label><input type="text" inputmode="decimal" id="lpm-rate" value="${String(p.interestRate||0).replace('.',',')}" placeholder="Vd: 6,6"></div>
          </div>
          <div class="divider-lbl">Tỷ lệ cấu hình trích chia lãi suất theo cấp (%) — cắt khúc dòng tiền</div>
          <div class="form-grid">
            <div class="field"><label>Trung ương</label><input type="text" inputmode="decimal" id="lpm-central" value="${String(p.splitCentral||0).replace('.',',')}"></div>
            <div class="field"><label>Cấp Tỉnh</label><input type="text" inputmode="decimal" id="lpm-province" value="${String(p.splitProvince||0).replace('.',',')}"></div>
            <div class="field"><label>Cấp Xã</label><input type="text" inputmode="decimal" id="lpm-ward" value="${String(p.splitWard||0).replace('.',',')}"></div>
          </div>
          <p class="sub" style="margin-top:-4px;">⚠️ Tổng 3 tỷ lệ Trung ương + Cấp Tỉnh + Cấp Xã phải LUÔN BẰNG đúng "Lãi suất người vay phải trả" ở trên (vd: 0% + 4,32% + 2,28% = 6,6%).</p>

          <div class="divider-lbl">% của ${adminLevelLabelLower()} phân bổ về ${curSubLower}</div>
          <div class="form-grid">
            <div class="field"><label>% của ${adminLevelLabelLower()} phân bổ về ${curSubLower}</label><input type="text" inputmode="decimal" id="lpm-hamlet-alloc" value="${String(p.hamletAllocPercent!=null? p.hamletAllocPercent : 45).replace('.',',')}"></div>
          </div>
          <p class="sub" style="margin-top:-4px;">💡 Đây KHÔNG phải là tỷ lệ trích trực tiếp từ tổng lãi suất, mà là tỷ lệ mà ${adminLevelLabelLower()} tiếp tục PHÂN BỔ XUỐNG cho ${curSubLower} TỪ chính phần tiền lãi mà ${adminLevelLabelLower()} đã nhận được (theo tỷ lệ "Cấp Xã" ở trên). Ví dụ: nếu 1 người vay đóng lãi và phần về ${adminLevelLabelLower()} là 100.000đ, với tỷ lệ mặc định 45% thì ${curSubLower} nơi người đó cư trú sẽ được phân bổ 45.000đ trong số đó. (Không được vượt quá 100%.)</p>

          <p class="sub">Có thể để trống/0 nếu chưa cấu hình. Người vay được thêm vào phương án này sẽ TỰ ĐỘNG kế thừa toàn bộ thiết lập trên — không cần nhập lại cho từng người.</p>
          ${(forceReadOnly && !isNew)? (function(){
            const members = state.borrowers.filter(b=>!b.deleted && b.projectId===p.id);
            const visibleCols = ensureBorrowerVisibleCols().map(k=>BORROWER_COLUMNS().find(c=>c.key===k)).filter(Boolean);
            return `
            <div class="divider-lbl" style="margin-top:16px;">Danh sách người vay trong phương án này (${members.length})</div>
            <div class="table-wrap"><table>
              <thead><tr>${visibleCols.map(c=>`<th>${htmlLabel(c.label)}</th>`).join('')}</tr></thead>
              <tbody>${members.length? members.map(b=>`<tr>${visibleCols.map(c=>`<td class="${c.align==='right'?'money':''}">${c.key==='name'?dancingNameHtml(b):c.get(b)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${visibleCols.length}" style="padding:10px;">Chưa có người vay nào trong phương án này.</td></tr>`}</tbody>
            </table></div>`;
          })() : ''}
        </div>
        <div class="modal-foot">
          ${forceReadOnly? `
            <button class="btn btn-ghost" id="lpm-cancel">${cancelLabel}</button>
            ${canEditModule('data')? `<button class="btn btn-primary" id="lpm-goto-edit">✏️ Sửa thông tin</button>` : ''}
          ` : `
          ${!isNew? `<button class="btn btn-danger" id="lpm-delete" style="margin-right:auto;">Xoá phương án</button>` : ''}
          <button class="btn btn-ghost" id="lpm-cancel">${cancelLabel}</button>
          <button class="btn btn-primary" id="lpm-save">${isNew?'Tạo phương án':'Lưu thay đổi'}</button>
          `}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=> wrap.remove();
    if(forceReadOnly){
      wrap.querySelectorAll('input,select,textarea').forEach(el=> el.disabled = true);
      const goEdit = wrap.querySelector('#lpm-goto-edit');
      if(goEdit) goEdit.onclick = ()=>{ close(); renderLoanProjectModal(payload, onDone, false); };
    }
    wrap.querySelector('#lpm-close').onclick = ()=>{ close(); if(onDone) onDone(null); };
    const lpmQuickAddBtn = wrap.querySelector('#lpm-quickadd-ai-btn');
    if(lpmQuickAddBtn) lpmQuickAddBtn.onclick = ()=> renderQuickAddByAiModal();
    wrap.querySelector('#lpm-cancel').onclick = ()=>{ close(); if(onDone) onDone(null); };
    // (ĐÃ BỎ: bấm ra ngoài modal không còn đóng bảng nữa — chỉ nút X/Đóng bảng mới đóng được)
    wrap.querySelector('#lpm-fundsource-type').onchange = (e)=>{
      if(e.target.value==='__add_fundsource__'){
        const savedValues = {};
        wrap.querySelectorAll('input[id], select[id], textarea[id]').forEach(el=>{ if(el.id!=='lpm-fundsource-type') savedValues[el.id] = el.value; });
        const prevVal = p.fundSourceType || FUND_SOURCE_OPTIONS[0];
        renderFundSourceManagerModal((newList)=>{
          state.config.customFundSources = newList;
          window.__instantRemoveModal(wrap);
          p.fundSourceType = prevVal;
          renderLoanProjectModal(p, onDone, forceReadOnly);
          requestAnimationFrame(()=>{
            Object.keys(savedValues).forEach(id=>{ const el = document.getElementById(id); if(el) el.value = savedValues[id]; });
            const newFundSel = document.getElementById('lpm-fundsource-type');
            if(newFundSel){
              newFundSel.classList.add('field-border-flash');
              if(newFundSel.options.length>1) newFundSel.value = newFundSel.options[newFundSel.options.length-2].value;
            }
          });
        });
        e.target.value = prevVal;
        return;
      }
      // Nguồn vay "Cấp trung ương" có bộ mặc định riêng (khác các nguồn vay khác) — tự điền sẵn, người
      // dùng vẫn có thể tự sửa lại theo ý mình sau đó.
      if(e.target.value==='Cấp trung ương'){
        wrap.querySelector('#lpm-rate').value = '8,4';
        wrap.querySelector('#lpm-central').value = '3,5';
        wrap.querySelector('#lpm-province').value = '2';
        wrap.querySelector('#lpm-ward').value = '2,9';
        wrap.querySelector('#lpm-hamlet-alloc').value = '45';
      } else {
        // Các nguồn vay KHÁC Trung ương — về đúng bộ mặc định chung cũ (vẫn có thể tự sửa lại sau đó).
        wrap.querySelector('#lpm-rate').value = '6,6';
        wrap.querySelector('#lpm-central').value = '0';
        wrap.querySelector('#lpm-province').value = '4,32';
        wrap.querySelector('#lpm-ward').value = '2,28';
        wrap.querySelector('#lpm-hamlet-alloc').value = '45';
      }
    };
    // ---- THỬ NGHIỆM: ô nhập chỉ chứa số thuần khi gõ (không tự chèn dấu cách nhóm 3 số ngay
    // trong lúc gõ — đây chính là nguyên nhân gây lỗi lệch con trỏ khi gõ nhiều chữ số). Số đã
    // định dạng đẹp (nhóm 3 số) được hiện RIÊNG ở 1 dòng bên cạnh nhãn, chỉ để xem, không ảnh hưởng
    // tới ô đang gõ.
    (function(){
      const capInput = wrap.querySelector('#lpm-capital');
      const capDisp = wrap.querySelector('#lpm-capital-disp');
      attachMoneyInputMask(capInput, 12);
      const updateCapDisp = ()=>{
        const digits = capInput.value.replace(/[^\d]/g,'');
        if(capDisp) capDisp.textContent = digits ? `= ${groupDigitsRight(digits,3)} đ` : '';
      };
      capInput.addEventListener('input', updateCapDisp);
      updateCapDisp();
    })();
    ['#lpm-rate','#lpm-central','#lpm-province','#lpm-ward','#lpm-hamlet-alloc'].forEach(sel=> attachPercentInputMask(wrap.querySelector(sel)));

    // "Khoảng thời gian" — chỉ là công cụ tính nhanh Ngày đến hạn, mặc định "Khác", tự nhảy về
    // "Khác" nếu người dùng tự tay sửa Ngày đến hạn khác đi.
    const durationSelect = wrap.querySelector('#lpm-duration');
    const disburseInput = wrap.querySelector('#lpm-disburse');
    const dueInput = wrap.querySelector('#lpm-due');
    durationSelect.onchange = ()=>{
      const opt = LOAN_DURATION_OPTIONS.find(o=>o.key===durationSelect.value);
      if(!opt || opt.years==null) return;
      if(!disburseInput.value){ alert('Vui lòng chọn Ngày giải ngân (ngày vay) trước.'); durationSelect.value = 'other'; return; }
      dueInput.value = addYearsToDateStr(disburseInput.value, opt.years);
    };
    dueInput.addEventListener('input', ()=>{ durationSelect.value = 'other'; });

    const delBtn = wrap.querySelector('#lpm-delete');
    if(delBtn) delBtn.onclick = async ()=>{
      await deleteLoanProjectCascade(p, close);
      render();
    };

    wrap.querySelector('#lpm-save').onclick = async ()=>{
      const name = wrap.querySelector('#lpm-name').value.trim();
      if(!name){ alert('Vui lòng nhập tên phương án vay.'); return; }
      const totalCapital = parseVNMoney(wrap.querySelector('#lpm-capital').value);
      // Ràng buộc: giảm tổng vốn xuống thấp hơn tổng số tiền các thành viên đang thực vay -> chặn lưu.
      const disbursedNow = projectDisbursedTotal(p.id);
      if(totalCapital < disbursedNow){
        alert(`Không thể lưu! Tổng vốn mới (${moneySpaced(totalCapital)}) thấp hơn tổng số tiền các hộ trong phương án đang thực vay (${moneySpaced(disbursedNow)}). Vui lòng điều chỉnh lại số tiền vay của các hộ trước, hoặc tăng tổng vốn lên.`);
        return;
      }
      const disburseDate = wrap.querySelector('#lpm-disburse').value;
      const dueDate = wrap.querySelector('#lpm-due').value;
      if(!disburseDate){ alert('Vui lòng chọn Ngày giải ngân (ngày vay).'); return; }
      if(!dueDate){ alert('Vui lòng chọn Ngày đến hạn trả.'); return; }
      if(disburseDate > todayStr()){ alert('Không thể lưu! "Ngày giải ngân (ngày vay)" không được ở trong tương lai so với ngày hiện tại.'); return; }
      const diffDays = Math.round((new Date(dueDate+'T00:00:00') - new Date(disburseDate+'T00:00:00')) / 86400000);
      if(diffDays < 30){
        alert(`Không thể lưu! Thời hạn vay (Ngày đến hạn trừ Ngày vay = ${diffDays} ngày) phải từ 30 ngày trở lên. Vui lòng kiểm tra lại Ngày giải ngân/Ngày đến hạn.`);
        return;
      }
      // Ràng buộc: nếu phương án này có Người thừa kế (do Trả nợ trước hạn sinh ra), Ngày đến hạn
      // của CẢ phương án không được sát/trùng/trước Ngày vay của người thừa kế (phải cách ít nhất 2
      // ngày) — để hộp chứa Quý của người thừa kế luôn có ít nhất 1 ngày hợp lệ để tính lãi.
      if(!isNew){
        const heirsInProject = state.borrowers.filter(b=>!b.deleted && b.isHeir && b.projectId===p.id);
        for(const heir of heirsInProject){
          const gap = daysBetween(heir.loanDate, dueDate);
          if(gap < 2){
            alert(`Không thể lưu! Phương án này đang có người thừa kế "${heir.name}" với Ngày vay là ${fmtDate(heir.loanDate)}. Ngày đến hạn của phương án phải cách Ngày vay của người thừa kế ít nhất 2 ngày (hiện chỉ cách ${gap} ngày). Vui lòng điều chỉnh lại Ngày đến hạn, hoặc chỉ có thể sửa tự do khi người thừa kế này không còn thuộc phương án nữa.`);
            return;
          }
        }
      }
      const interestRate = parseVNPercent(wrap.querySelector('#lpm-rate').value);
      const splitCentral = parseVNPercent(wrap.querySelector('#lpm-central').value);
      const splitProvince = parseVNPercent(wrap.querySelector('#lpm-province').value);
      const splitWard = parseVNPercent(wrap.querySelector('#lpm-ward').value);
      const sumSplit = splitCentral + splitProvince + splitWard;
      // Yêu cầu: Trung ương + Cấp Tỉnh + Cấp Xã LUÔN phải bằng đúng lãi suất chung của phương án.
      if(Math.abs(sumSplit - interestRate) > 0.01){
        alert(`Tổng tỷ lệ trích chia (Trung ương ${splitCentral}% + Cấp Tỉnh ${splitProvince}% + Cấp Xã ${splitWard}% = ${sumSplit.toFixed(2)}%) KHÔNG bằng với Lãi suất chung của phương án (${interestRate}%). Vui lòng kiểm tra lại cho đúng công thức: Trung ương + Cấp Tỉnh + Cấp Xã = Lãi suất chung.`);
        return;
      }
      const hamletAllocPercent = parseVNPercent(wrap.querySelector('#lpm-hamlet-alloc').value);
      if(hamletAllocPercent > 100){
        alert(`Không thể lưu! "% của ${adminLevelLabelLower()} phân bổ về ${curSubLower}" đang là ${hamletAllocPercent}% — không được vượt quá 100%. Vui lòng kiểm tra lại.`);
        return;
      }
      const fundSourceType = wrap.querySelector('#lpm-fundsource-type').value;
      const updated = {
        ...p, name,
        totalCapital,
        interestRate,
        disburseDate, dueDate,
        fundSourceType,
        splitCentral, splitProvince, splitWard,
        hamletAllocPercent,
        updatedAt: new Date().toISOString(), deleted:false,
      };
      // Phát hiện có thay đổi THẬT SỰ hay không (so với dữ liệu gốc trước khi sửa) — chỉ khi có thay
      // đổi mới cần cảnh báo + lập giấy xác nhận + lan truyền xuống người vay bên trong.
      const compareKeys = ['name','totalCapital','interestRate','disburseDate','dueDate','fundSourceType','splitCentral','splitProvince','splitWard','hamletAllocPercent'];
      const hasChanged = !isNew && compareKeys.some(k=> String(p[k]??'') !== String(updated[k]??''));
      if(hasChanged){
        const memberCount = state.borrowers.filter(b=>!b.deleted && b.projectId===p.id).length;
        if(!confirm(`Bạn có chắc chắn muốn lưu thay đổi thông tin phương án vay "${name}" không? Toàn bộ ${memberCount} người vay bên trong phương án này sẽ tự động được cập nhật theo đúng điều khoản mới (trừ Ngày vay của Người thừa kế, nếu có, sẽ không đổi). Hệ thống sẽ tự động lập 1 Giấy xác nhận cho hành động này và lưu vào kho Giấy xác nhận.`)) return;
      }
      close(); // Bước 1
      showProcessingToast(); // Bước 2
      await cSetRecord('loanProjects', updated.id, updated);
      if(hasChanged){
        const affectedMembers = state.borrowers.filter(b=>!b.deleted && b.projectId===p.id).map(b=>({...b}));
        await propagateProjectChangesToBorrowers(updated);
        for(const b of affectedMembers){
          try{
            const bAfter = state.borrowers.find(x=>x.id===b.id) || b;
            const dispBeforeProj = computeInterestPaymentBoxDisplay(b);
            const dispAfterProj = computeInterestPaymentBoxDisplay(bAfter);
            await logQuarterStatusDiff(bAfter, dispBeforeProj, dispAfterProj,
              `Đã được đóng lãi trở lại do thay đổi thông tin Phương án vay "${name}"`,
              `Đã trở về trạng thái chưa đóng lãi do thay đổi thông tin Phương án vay "${name}"`);
          }catch(err){ console.error('Lỗi khi ghi log trạng thái Quý (sửa phương án vay):', err); }
        }
        // GIẤY XÁC NHẬN CHUNG — chỉ lập đúng 1 bản ghi duy nhất cho cả phương án, nối link vào Hộp
        // giấy xác nhận của TẤT CẢ người vay bị ảnh hưởng (thay vì lập hàng loạt giấy trùng lặp).
        const FIELD_LABELS_P = { name:'Tên phương án', totalCapital:'Tổng vốn', interestRate:'Lãi suất', disburseDate:'Ngày giải ngân', dueDate:'Ngày đến hạn', fundSourceType:'Nguồn vay', splitCentral:'Tỷ lệ phân bổ Trung ương', splitProvince:'Tỷ lệ phân bổ Tỉnh', splitWard:'Tỷ lệ phân bổ Xã', hamletAllocPercent:`Tỷ lệ phân bổ ${subAdminLabel()}` };
        const changedFieldKeys = compareKeys.filter(k=> String(p[k]??'') !== String(updated[k]??''));
        const MONEY_FIELDS_P = ['totalCapital'];
        const changedFieldLines = changedFieldKeys.map(k=>{
          const oldV = MONEY_FIELDS_P.includes(k) ? money(p[k]||0) : (p[k]||'(để trống)');
          const newV = MONEY_FIELDS_P.includes(k) ? money(updated[k]||0) : (updated[k]||'(để trống)');
          return `${FIELD_LABELS_P[k]||k} được sửa từ "${oldV}" thành "${newV}"`;
        });
        await pushSharedConfirmationDocument('project_edit_bulk', `GXN Chung: Sửa thông tin các hộ vay do thay đổi thông tin Phương án vay "${name}"`,
          [
            `Phương án vay "${name}" đã được sửa thông tin vào ngày ${fmtDate(todayStr())}.`,
            `Các thông tin bị thay đổi:\n${changedFieldLines.map(l=>'- '+l).join('\n')}`,
            `Các hộ vay bị tác động (${affectedMembers.length} người): ${affectedMembers.map(b=>b.name).join(', ')}`,
          ].join('\n'), affectedMembers.map(b=>b.id));
      }
      await pushLog(isNew?'tạo phương án vay':'sửa phương án vay', name);
      hideProcessingToast(); // Bước 4
      if(onDone) onDone(updated.id); else render();
      showToast(isNew? 'Đã tạo phương án vay thành công!' : 'Đã lưu thay đổi thành công!');
    };
  }

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
