// ============================================================================
// Cloud Function: receiptMeta
// Mục đích: khi ai đó mở (hoặc dán link để xem trước trên Messenger/Zalo/Facebook)
// đường link dạng https://<domain>/bienlai/<ma>, hàm này sẽ:
//   1) Đọc mã biên lai từ URL.
//   2) Truy vấn Firebase Realtime Database để lấy tiêu đề/tên hộ vay/số tiền.
//   3) Đọc file index.html gốc của app (được đóng gói kèm function này khi deploy).
//   4) Chèn đúng thẻ <title> và các thẻ <meta property="og:..."> ứng với ĐÚNG
//      biên lai đó vào phần <head>.
//   5) Trả về HTML đã chèn xong — cho CẢ người dùng thật lẫn "bot" xem trước link
//      (Messenger/Zalo/Facebook) — ai cũng nhận được đúng HTML này, sau đó trình
//      duyệt của người dùng thật sẽ tự chạy tiếp JS như app bình thường (không có
//      gì khác biệt về trải nghiệm, chỉ là <title>/meta được điền sẵn đúng nội
//      dung TRƯỚC khi JS kịp chạy).
// ============================================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

admin.initializeApp();

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Dọn tiêu đề y hệt cách app chính đang làm (bỏ tiền tố "BL", bỏ phần "(THEO CÁCH
// TÍNH...)") — để tiêu đề xem trước link khớp đúng 100% với tiêu đề hiện trong app.
function cleanTitle(rawTitle) {
  return String(rawTitle || "Biên lai")
    .replace(/^BL\b/i, "Biên lai")
    .replace(/\s*\(THEO CÁCH TÍNH[^)]*\)/i, "")
    .trim();
}

// Thư mục chứa các ảnh xem trước — GIỮ NGUYÊN đường dẫn thư mục cũ bạn đã dùng, chỉ đổi phần tên
// file ở cuối theo đúng loại biên lai. Muốn đổi ảnh nào, chỉ cần vào đúng thư mục này trên Firebase
// Storage, xoá ảnh cũ, tải ảnh mới lên với ĐÚNG tên file tương ứng bên dưới — không cần sửa code.
const OG_IMAGE_FOLDER = "https://firebasestorage.googleapis.com/v0/b/congtachoinongdan.firebasestorage.app/o/S%E1%BB%95%20tay%20H%E1%BB%99i%20N%C3%B4ng%20d%C3%A2n%20(hoinongdan.sotay.org)%2F%E1%BA%A3nh%20xem%20tr%C6%B0%E1%BB%9Bc%20link%20khi%20g%E1%BB%ADi%20qua%20zalo%20messenger%2F";

// Nhận diện đúng 1 trong 13 loại Biên lai để chọn đúng ảnh tương ứng — dựa vào tiêu đề GỐC của biên
// lai, và 2 cờ trạng thái: có phải "thanh toán qua đường link" hay không (viaPaymentLink/unpaid), và
// có phải biên lai CHUNG hay không (dựa vào chữ "chung" trong tiêu đề gốc).
function pickImageFileName(data) {
  const t = String(data.title || "");
  const isChung = /chung/i.test(t);
  // CHỈ tính là "biên lai trả lại tiền" khi cụm "trả lại" nằm NGAY ĐẦU câu (ngay sau "BL") — vì có
  // 1 số tiêu đề khác (VD: "Trả nợ trước hạn (trả lại cấp quản lý vốn vay)") có chứa cụm "trả lại" ở
  // GIỮA câu với nghĩa hoàn toàn khác, không phải "biên lai hoàn tiền". Nếu chỉ kiểm tra "có chứa" thì
  // sẽ bị nhầm giữa 2 loại này.
  const titleAfterBL = t.replace(/^BL\s*/i, "").trim();
  const isTraLai = /^trả lại/i.test(titleAfterBL);
  const isTatToan = /tất toán/i.test(t);
  const isTraNoTruocHan = /trả nợ trước hạn/i.test(t);
  const isThuLai = /(đóng tiền lãi|thu tiền lãi)/i.test(t);
  // "Qua link" = biên lai chưa thanh toán (đang chờ), HOẶC đã chuyển từ chưa thanh toán -> đã thanh
  // toán qua đúng luồng "Gửi đường link thanh toán" (được đánh dấu viaPaymentLink khi tạo).
  const isQuaLink = data.status === "unpaid" || !!data.viaPaymentLink;

  // (Mới thêm, KHÔNG ảnh hưởng 13 loại cũ) Biên lai xử lý tiền vượt ngưỡng — kiểm tra và trả về ngay,
  // không đi qua các nhánh khác bên dưới, tránh mọi khả năng nhầm lẫn với các loại đã hoạt động đúng.
  if (/vượt ngưỡng/i.test(t)) return "Bienlai-xulytienvuotnguong";

  if (isQuaLink) {
    if (isChung && isTatToan) return "Bienlaichung-tattoan-qualink";
    if (isChung && isThuLai) return "Bienlaichung-tienlai-qualink";
    if (isTatToan) return "Bienlai-tattoan-qualink";
    if (isTraNoTruocHan) return "Bienlai-tranotruochan-qualink";
    if (isThuLai) return "Bienlai-tienlai-qualink";
  } else {
    if (isChung && isTatToan) return "Bienlaichung-tattoan-daxong";
    if (isChung && isThuLai) return "Bienlaichung-tienlai-daxong";
    if (isTraLai && isTatToan) return "Bienlaitralai-tattoan-daxong";
    if (isTraLai && isTraNoTruocHan) return "Bienlaitralai-tranotruochan-daxong";
    if (isTraLai) return "Bienlaitralai-tienlai-daxong"; // còn lại: trả lại tiền lãi
    if (isTatToan) return "Bienlai-tattoan-daxong";
    if (isTraNoTruocHan) return "Bienlai-tranotruochan-daxong";
    if (isThuLai) return "Bienlai-tienlai-daxong";
  }
  return null; // không khớp loại nào -> không hiện ảnh
}

// Nhận diện đúng "tên hành động" ngắn gọn (dùng cho dòng mô tả ở khung xem trước Zalo/Facebook) —
// dựa vào tiêu đề GỐC (chưa qua cleanTitle) của biên lai, áp dụng chung cho cả biên lai chung lẫn
// riêng, vì cả 2 đều dùng chung 1 vài từ khoá nhận diện then chốt.
function actionLabel(rawTitle) {
  const t = String(rawTitle || "");
  if (/tất toán/i.test(t)) return "Tất toán khoản vay";
  if (/trả nợ trước hạn/i.test(t)) return "Trả nợ trước hạn";
  if (/(đóng tiền lãi|thu tiền lãi)/i.test(t)) return "Thu tiền Lãi";
  return "Số tiền";
}

exports.receiptMeta = functions.https.onRequest(async (req, res) => {
  try {
    // req.path sẽ là "/bienlai/<ma>" (Firebase Hosting rewrite đã lược bỏ phần domain)
    const parts = req.path.split("/").filter(Boolean); // ["bienlai", "<ma>"]
    const code = parts[1] || "";

    // Log chẩn đoán — giúp xác nhận hàm CÓ THỰC SỰ được gọi tới hay không, và request đến có header
    // "range" hay không (xem trong Cloud Functions Logs nếu vẫn còn gặp lỗi 206 sau bản sửa này).
    console.log("[receiptMeta] Nhận request:", req.method, req.originalUrl, "| range header:", req.headers.range || "(không có)");

    // Xoá hẳn header "Range" (nếu có) khỏi YÊU CẦU ĐẾN — phòng trường hợp có tầng trung gian nào đó
    // (CDN/hạ tầng Cloud Run) tự động áp dụng phục vụ nội dung theo khoảng (206 Partial Content) chỉ
    // vì thấy yêu cầu có header này, bất kể phản hồi của ta khai báo gì.
    delete req.headers.range;
    delete req.headers["if-range"];

    let pageTitle = "Biên lai - Hoinongdan.sotay.org"; // dùng cho tab trình duyệt (<title>)
    let ogTitle = "Biên lai"; // dùng cho khung xem trước Zalo/Facebook/Messenger (og:title) — ngắn gọn hơn
    let description = "Xem chi tiết Biên lai tại Sổ vay vốn Quỹ Hỗ trợ Nông dân.";
    let ogImageUrl = null;

    if (code) {
      const snap = await admin.database().ref("receipts/" + code).once("value");
      if (snap.exists()) {
        const data = snap.val();
        const title = cleanTitle(data.title);
        const firstBorrower = (data.borrowerNames && data.borrowerNames[0]) || "";
        const withBorrower = `${title}${firstBorrower ? ` đối với hộ vay ${firstBorrower}` : ""}`;
        pageTitle = `${withBorrower} - Hoinongdan.sotay.org`; // tiêu đề tab trình duyệt — giữ nguyên đầy đủ như cũ

        // Khung xem trước (Zalo/Facebook/Messenger) — RÚT GỌN theo yêu cầu riêng:
        //   Dòng 1 (og:title): "Biên Lai: [tên người vay 1], [tên người vay 2]..."
        //   Dòng 2 (og:description): "[Tên hành động] [Số tiền thực nhận] đ" — KHÔNG còn trạng thái
        //   thanh toán nữa.
        // LƯU Ý: Messenger/Facebook (khác với Zalo) chỉ hiện đúng DÒNG 1 (og:title) trong khung xem
        // trước, ẨN HẲN dòng mô tả (og:description) — nên NHÂN ĐÔI nội dung dòng 2 vào cuối dòng 1
        // luôn, đảm bảo dù xem ở Messenger hay Zalo đều luôn thấy đủ số tiền.
        const names = (data.borrowerNames || []).join(", ");
        const amountStr = Number(data.amount || 0).toLocaleString("vi-VN");
        description = `${actionLabel(data.title)}: ${amountStr} đ`;
        ogTitle = `Biên Lai: ${names || "(không rõ hộ vay)"} - ${description}`;

        // Chọn đúng 1 trong 13 ảnh xem trước theo đúng loại biên lai.
        const imgFileName = pickImageFileName(data);
        if (imgFileName) ogImageUrl = `${OG_IMAGE_FOLDER}${imgFileName}.jpg?alt=media`;
      }
      // Nếu không tìm thấy (biên lai hết hạn/bị xoá/không đúng mã) -> vẫn dùng tiêu đề
      // mặc định ở trên, không báo lỗi — để app JS tự xử lý màn hình "Không tìm thấy".
    }

    // Đọc file index.html GỐC của app — file này được copy vào cùng thư mục functions/ lúc build/
    // deploy. (Đã THỬ cách "tự tải lại từ chính Hosting" để đỡ phải copy 2 nơi, nhưng cách đó gây
    // treo/timeout không ổn định trong môi trường Cloud Functions — nên đã bỏ, quay lại cách đọc file
    // đóng gói sẵn này, tuy cần copy 2 nơi mỗi lần cập nhật nhưng CHẮC CHẮN hoạt động ổn định.)
    const indexPath = path.join(__dirname, "index.html");
    let html = fs.readFileSync(indexPath, "utf8");

    const metaBlock = `
    <title>${escapeHtml(pageTitle)}</title>
    <meta property="og:title" content="${escapeHtml(ogTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtml("https://hoinongdan.sotay.org" + req.originalUrl)}">
    ${ogImageUrl ? `<meta property="og:image" content="${escapeHtml(ogImageUrl)}">` : ""}
    <meta name="twitter:card" content="${ogImageUrl ? "summary_large_image" : "summary"}">
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    ${ogImageUrl ? `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">` : ""}
    `;

    // QUAN TRỌNG: file index.html rất lớn (>1.5MB), bên trong có RẤT NHIỀU đoạn code JS chứa các
    // chuỗi text VÔ TÌNH giống hệt "<title>" hoặc "</head>" (ví dụ 1 đoạn code JS dùng để xuất file
    // Word có xây dựng sẵn 1 chuỗi HTML mẫu bên trong nó). Nếu chỉ dùng .replace() tìm chuỗi đơn giản
    // trên TOÀN BỘ file, có nguy cơ nhầm lẫn với các đoạn text đó thay vì đúng thẻ HTML thật ở đầu
    // file. Để an toàn tuyệt đối, ta CHỈ thao tác trong phạm vi 2000 KÝ TỰ ĐẦU TIÊN của file — chắc
    // chắn thẻ <head>/<title> thật luôn nằm trong phạm vi này, và tuyệt đối không đụng gì tới các
    // đoạn code JS nằm ở phía sau.
    const HEAD_SCAN_LIMIT = 3000;
    const headPart = html.slice(0, HEAD_SCAN_LIMIT);
    const restPart = html.slice(HEAD_SCAN_LIMIT);

    let newHeadPart = headPart.replace(/<title>[\s\S]*?<\/title>/i, "");
    const headOpenIdx = newHeadPart.search(/<head[^>]*>/i);
    if (headOpenIdx !== -1) {
      const insertAt = newHeadPart.indexOf(">", headOpenIdx) + 1;
      newHeadPart = newHeadPart.slice(0, insertAt) + metaBlock + newHeadPart.slice(insertAt);
    } else {
      // Phòng hờ nếu không tìm thấy <head> trong phạm vi quét -> chèn ngay đầu file.
      newHeadPart = metaBlock + newHeadPart;
    }

    html = newHeadPart + restPart;

    // Gửi phản hồi theo cách "thô" nhất có thể (dùng .end() thay vì .send()) — tránh mọi xử lý tự
    // động ẩn của Express/nền tảng phía dưới (ETag, Range, Conditional GET...) có thể vô tình khiến
    // phản hồi bị cắt thành nhiều phần (206 Partial Content).
    const bodyBuffer = Buffer.from(html, "utf8");
    res.status(200);
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Content-Length", String(bodyBuffer.length));
    res.set("Cache-Control", "no-store");
    res.removeHeader("ETag");
    res.end(bodyBuffer);
  } catch (err) {
    console.error("[receiptMeta] Lỗi:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ============================================================================
// Cloud Function: surveyMeta
// Giống receiptMeta nhưng cho link Biểu mẫu: https://<domain>/khaosat/<mã>[/ketqua/<phiếu>/<mã bí mật>]
// Chèn <title> + og:title/og:description/og:image đúng biểu mẫu đó để Zalo/Messenger/Facebook hiện
// khung xem trước. Ảnh xem trước là ảnh CỐ ĐỊNH theo "loại biểu mẫu" (formKind), nằm ở
// /og/khaosat-<loại>.png (build chép từ src/og/). Bảng loại dưới đây PHẢI khớp SURVEY_FORM_KINDS
// trong src/js/app/14c-survey.js. Trang kết quả bài làm KHÔNG để lộ điểm trong khung xem trước.
// ============================================================================
const SITE_ORIGIN = "https://hoinongdan.sotay.org";
// desc: câu mô tả dùng khi biểu mẫu KHÔNG có mô tả riêng (dòng chữ dưới tiêu đề trong khung xem trước).
const SURVEY_KINDS = {
  kiemtra: { label: "Bài kiểm tra", alias: ["bài kiểm tra", "kiểm tra"], desc: "Mời bạn làm bài kiểm tra trực tuyến, làm và nộp bài ngay trên điện thoại." },
  cuocthi: { label: "Cuộc thi", alias: ["bài cuộc thi", "cuộc thi"], desc: "Mời bạn tham gia cuộc thi trực tuyến, trả lời câu hỏi và nộp bài dự thi ngay trên điện thoại." },
  khaosat: { label: "Khảo sát", alias: ["bài khảo sát", "khảo sát"], desc: "Mời bạn tham gia khảo sát trực tuyến. Ý kiến của bạn giúp chúng tôi nắm bắt tình hình và phục vụ tốt hơn." },
  layykien: { label: "Khảo sát lấy ý kiến", alias: ["khảo sát lấy ý kiến", "lấy ý kiến"], desc: "Mời bạn đóng góp ý kiến. Mọi ý kiến đều được ghi nhận và tổng hợp đầy đủ." },
  thuthap: { label: "Khảo sát thu thập thông tin", alias: ["khảo sát thu thập thông tin", "thu thập thông tin"], desc: "Mời bạn cung cấp thông tin theo mẫu, điền trực tiếp trên điện thoại chỉ trong vài phút." },
  trinhbao: { label: "Thu thập đơn trình báo", alias: ["thu thập đơn trình báo", "đơn trình báo"], desc: "Gửi đơn trình báo trực tuyến: điền thông tin và gửi ngay trên điện thoại, không cần đến trực tiếp." },
};
const SURVEY_DEFAULT_DESC = "Mời bạn dành ít phút điền phiếu khảo sát trực tuyến ngay trên điện thoại.";
// Cắt gọn mô tả ~160 ký tự ở ranh giới từ, thêm "…".
function svShortDesc(t) {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  if (s.length <= 160) return s;
  const cut = s.slice(0, 160), sp = cut.lastIndexOf(" ");
  return (sp > 100 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–—-]+$/, "") + "…";
}

function svFoldChar(c) {
  return (c.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().charAt(0)) || c;
}
function svFold(s) { return Array.from(String(s || "")).map(svFoldChar).join(""); }
function svPrefixLen(t, p) {
  const ch = Array.from(t), fp = svFold(p), n = Array.from(fp).length;
  if (ch.length < n || svFold(ch.slice(0, n).join("")) !== fp) return -1;
  if (ch.length > n && !/[\s:.,;\-–—(]/.test(ch[n])) return -1;
  return n;
}
// Tên đầy đủ — cùng quy tắc với surveyFullName() trong app.
function surveyFullName(s) {
  const t = String((s && s.title) || "").trim() || "Biểu mẫu không có tiêu đề";
  const k = s && SURVEY_KINDS[s.formKind];
  if (!k) return svPrefixLen(t, "biểu mẫu") >= 0 ? t : "Biểu mẫu khảo sát: " + t;
  const aliases = k.alias.slice().sort((a, b) => b.length - a.length);
  for (const a of aliases) {
    const n = svPrefixLen(t, a);
    if (n >= 0) {
      const rest = Array.from(t).slice(n).join("").replace(/^[\s:.,;\-–—]+/, "");
      return "Biểu mẫu: " + k.label + (rest ? " " + rest : "");
    }
  }
  return "Biểu mẫu: " + k.label + " " + t;
}
function svFmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}
function svAcceptStatus(s) {
  if (s.acceptResponses === false) return "Đã đóng, ngừng nhận câu trả lời";
  if (s.closeAt && new Date(s.closeAt).getTime() <= Date.now()) return "Đã hết hạn nộp";
  const max = parseInt(s.maxResponses, 10) || 0;
  if (max > 0 && (s.responseCount || 0) >= max) return "Đã nhận đủ số phiếu";
  if (s.closeAt) return "Hạn nộp: " + svFmtDateTime(s.closeAt);
  return "";
}

exports.surveyMeta = functions.https.onRequest(async (req, res) => {
  try {
    // req.path: "/khaosat/<mã>" hoặc "/khaosat/<mã>/ketqua/<phiếu>/<mã bí mật>"
    const parts = req.path.split("/").filter(Boolean);
    const code = decodeURIComponent(parts[1] || "");
    const isResult = parts[2] === "ketqua";
    console.log("[surveyMeta] Nhận request:", req.method, req.originalUrl);
    delete req.headers.range;
    delete req.headers["if-range"];

    let pageTitle = "Biểu mẫu - Hoinongdan.sotay.org";
    let ogTitle = "Biểu mẫu khảo sát";
    let description = SURVEY_DEFAULT_DESC;
    let ogImageUrl = `${SITE_ORIGIN}/og/khaosat-macdinh.png`;

    // Mã biểu mẫu do app sinh chỉ gồm chữ/số/gạch — chặn ký tự lạ trước khi đọc Database.
    if (code && /^[A-Za-z0-9_-]{1,128}$/.test(code)) {
      const snap = await admin.database().ref("surveys/" + code).once("value");
      if (snap.exists() && !snap.val().deleted) {
        const s = snap.val();
        const kindKey = SURVEY_KINDS[s.formKind] ? s.formKind : "";
        const name = surveyFullName(s);
        ogImageUrl = `${SITE_ORIGIN}/og/khaosat-${kindKey || "macdinh"}.png`;
        if (isResult) {
          // KHÔNG đọc phiếu trả lời, KHÔNG hiện điểm — chỉ báo đây là link xem lại bài làm.
          ogTitle = `Kết quả bài làm — ${name}`;
          description = "Link xem lại bài làm và điểm của bạn.";
        } else {
          const status = svAcceptStatus(s);
          ogTitle = status ? `${name} (${status})` : name;
          description = svShortDesc(s.description) || (kindKey ? SURVEY_KINDS[kindKey].desc : SURVEY_DEFAULT_DESC);
        }
        pageTitle = `${isResult ? "Kết quả bài làm — " : ""}${name} - Hoinongdan.sotay.org`;
      }
      // Không thấy / đã vào Thùng rác -> giữ tiêu đề mặc định; app tự hiện màn hình "Không tìm thấy".
    }

    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    const metaBlock = `
    <title>${escapeHtml(pageTitle)}</title>
    <meta property="og:title" content="${escapeHtml(ogTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(SITE_ORIGIN + req.originalUrl)}">
    <meta property="og:site_name" content="Sổ tay Công tác Hội Nông dân cấp xã/phường">
    <meta property="og:locale" content="vi_VN">
    <meta property="og:url" content="${escapeHtml(SITE_ORIGIN + req.originalUrl)}">
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
    `;
    // Chỉ thao tác trong phần <head> thật (index.html nay đã mỏng, JS nằm ở tệp riêng nên </head> đầu
    // tiên chính là thẻ thật); phòng hờ không thấy thì quay về 3000 ký tự đầu như receiptMeta.
    const headEnd = html.search(/<\/head>/i);
    const HEAD_SCAN_LIMIT = headEnd > 0 && headEnd < 20000 ? headEnd : 3000;
    let headPart = html.slice(0, HEAD_SCAN_LIMIT).replace(/<title>[\s\S]*?<\/title>/i, "");
    // Bỏ các thẻ mô tả mặc định của app trong index.html (og:, twitter:, name="description", canonical)
    // — Zalo đọc thẻ name="description" chứ không chỉ og:description, nên phải thay cả thẻ đó.
    // (Chạy TRƯỚC khi chèn khối thẻ riêng nên không xoá nhầm thẻ của biểu mẫu.)
    headPart = headPart.replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>\s*/gi, "");
    headPart = headPart.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");
    const headOpenIdx = headPart.search(/<head[^>]*>/i);
    if (headOpenIdx !== -1) {
      const insertAt = headPart.indexOf(">", headOpenIdx) + 1;
      headPart = headPart.slice(0, insertAt) + metaBlock + headPart.slice(insertAt);
    } else {
      headPart = metaBlock + headPart;
    }
    const bodyBuffer = Buffer.from(headPart + html.slice(HEAD_SCAN_LIMIT), "utf8");
    res.status(200);
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Content-Length", String(bodyBuffer.length));
    res.set("Cache-Control", "no-store");
    res.removeHeader("ETag");
    res.end(bodyBuffer);
  } catch (err) {
    console.error("[surveyMeta] Lỗi:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ============================================================================
// Cloud Function: meetingMeta
// (1) /phonghop/<mã>/tep/<mã tài liệu>: phát tệp tài liệu cho đại biểu, có kiểm tra cuộc họp còn mở —
//     xem serveMeetingFile() bên dưới.
// (2) Link trang tài liệu cuộc họp: https://<domain>/phonghop/<mã>. Chèn <title> + og:* đúng cuộc họp đó để
// Zalo/Messenger hiện khung xem trước (tên cuộc họp, thời gian, địa điểm). Ảnh xem trước cố định
// /og/phonghop.png (build chép từ src/og/). Dữ liệu ở meetings/<mã> — xem src/js/app/18-meeting.js.
// ============================================================================
const MEETING_WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
// startAt lưu dạng giờ địa phương "YYYY-MM-DDTHH:mm" — định dạng y hệt mtFmtStart() trong app.
function mtFmtStart(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${m[4] ? `${m[4]}:${m[5]}, ` : ""}${MEETING_WEEKDAYS[d.getUTCDay()]} ${m[3]}/${m[2]}/${m[1]}`;
}
function mtIsOpen(m) {
  if (m.status === "closed") return false;
  if (m.closeAt && new Date(m.closeAt).getTime() <= Date.now()) return false;
  return true;
}

// ---- GĐ2: phát tệp tài liệu cho đại biểu: /phonghop/<mã>/tep/<mã tài liệu>[?info=1 | ?part=N] ----
// Dữ liệu cuộc họp KHÔNG chứa link tải trực tiếp của Storage; đại biểu chỉ lấy được tệp qua đây, và mỗi
// lần gọi đều kiểm tra cuộc họp còn mở -> "Đóng liên kết"/hẹn giờ đóng/xoá có tác dụng ngay. Function thế
// hệ 1 giới hạn phản hồi 10 MB nên tệp chia phần 8 MB (app ghép lại trên máy đại biểu).
const MEETING_BUCKET = "congtachoinongdan.firebasestorage.app";
const MEETING_PART_BYTES = 8 * 1024 * 1024;
// Giống emailToKey() trong app — khoá email dùng làm tên thư mục Storage của kho cá nhân bản cũ.
function mtEmailKey(email) {
  return String(email || "").replace(/[.#$[\]]/g, (c) => ({ ".": ",", "#": "~h~", "$": "~d~", "[": "~lb~", "]": "~rb~" })[c]);
}
// Chỉ phát tệp nằm trong đúng phạm vi của cuộc họp: tệp tải lên cho chính cuộc họp này, hoặc tệp chọn từ
// Trung tâm dữ liệu của CHÍNH mã xã (họp dùng chung) / CHÍNH chủ cuộc họp (họp cá nhân). Đường dẫn do
// trình duyệt ghi vào Database nên không được tin — chặn việc trỏ sang tệp của nơi khác.
async function mtAllowedPath(code, m, doc) {
  const p = String(doc.storagePath || "");
  if (!p || p.includes("..") || p.includes("//")) return false;
  if (p.startsWith(`meeting_files/${code}/`)) return true;
  if (doc.source !== "drive" || !p.startsWith("drive-resources/")) return false;
  if (m.scope !== "personal") return !!m.wardId && p.startsWith(`drive-resources/ward_${m.wardId}/`);
  if (!m.ownerEmail) return false;
  if (p.startsWith(`drive-resources/user_${mtEmailKey(m.ownerEmail)}/`)) return true;
  try {
    const u = await admin.auth().getUserByEmail(m.ownerEmail);
    return p.startsWith(`drive-resources/user_${u.uid}/`);
  } catch (e) {
    return false;
  }
}
async function serveMeetingFile(req, res, code, docId) {
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  const deny = (status, error) => res.status(status).json({ error });
  if (req.method !== "GET") return deny(405, "method");
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(code) || !/^[A-Za-z0-9_-]{1,64}$/.test(docId)) return deny(404, "not_found");
  const snap = await admin.database().ref("meetings/" + code).once("value");
  const m = snap.exists() ? snap.val() : null;
  if (!m || m.deleted) return deny(404, "not_found");
  if (!mtIsOpen(m)) return deny(403, "closed");
  const docs = Array.isArray(m.docs) ? m.docs : Object.values(m.docs || {});
  const doc = docs.find((d) => d && d.id === docId);
  if (!doc) return deny(404, "doc_not_found");
  if (!(await mtAllowedPath(code, m, doc))) {
    console.warn("[meetingMeta] Từ chối đường dẫn ngoài phạm vi:", code, docId, doc.storagePath);
    return deny(403, "forbidden");
  }
  const file = admin.storage().bucket(MEETING_BUCKET).file(doc.storagePath);
  let meta;
  try {
    [meta] = await file.getMetadata();
  } catch (e) {
    return deny(404, "doc_not_found");
  }
  const size = Number(meta.size) || 0;
  const parts = Math.max(1, Math.ceil(size / MEETING_PART_BYTES));
  if (req.query.part === undefined) {
    return res.status(200).json({
      size, parts, partBytes: MEETING_PART_BYTES,
      contentType: meta.contentType || doc.mimeType || "application/octet-stream",
      name: String(doc.name || "tai-lieu"),
    });
  }
  const i = Number(req.query.part);
  if (!Number.isInteger(i) || i < 0 || i >= parts) return deny(416, "bad_part");
  let buf = Buffer.alloc(0);
  if (size > 0) {
    const start = i * MEETING_PART_BYTES;
    const end = Math.min(size, start + MEETING_PART_BYTES) - 1;
    [buf] = await file.download({ start, end, validation: false });
  }
  res.status(200);
  res.set("Content-Type", "application/octet-stream");
  res.set("Content-Length", String(buf.length));
  return res.end(buf);
}

exports.meetingMeta = functions.https.onRequest(async (req, res) => {
  try {
    const parts = req.path.split("/").filter(Boolean);
    const code = decodeURIComponent(parts[1] || "");
    if (parts[2] === "tep") return await serveMeetingFile(req, res, code, decodeURIComponent(parts[3] || ""));
    console.log("[meetingMeta] Nhận request:", req.method, req.originalUrl);
    delete req.headers.range;
    delete req.headers["if-range"];

    let pageTitle = "Phòng họp không giấy - Hoinongdan.sotay.org";
    let ogTitle = "Tài liệu cuộc họp";
    let description = "Bấm vào để xem tài liệu cuộc họp ngay trên điện thoại — không cần cài phần mềm, không cần đăng nhập.";
    const ogImageUrl = `${SITE_ORIGIN}/og/phonghop.png`;

    // Mã cuộc họp do app sinh chỉ gồm chữ/số — chặn ký tự lạ trước khi đọc Database.
    if (code && /^[A-Za-z0-9_-]{6,128}$/.test(code)) {
      const snap = await admin.database().ref("meetings/" + code).once("value");
      if (snap.exists() && !snap.val().deleted) {
        const m = snap.val();
        const name = String(m.title || "Cuộc họp").trim();
        const n = Array.isArray(m.docs) ? m.docs.filter(Boolean).length : Object.keys(m.docs || {}).length;
        ogTitle = mtIsOpen(m) ? `Tài liệu: ${name}` : `${name} (tài liệu đã đóng)`;
        const when = [mtFmtStart(m.startAt), m.place ? String(m.place) : ""].filter(Boolean).join(" · ");
        description = mtIsOpen(m)
          ? `${when ? when + ". " : ""}${n} tài liệu — bấm vào để xem ngay trên điện thoại, không cần đăng nhập.`
          : `${when ? when + ". " : ""}Liên kết tài liệu của cuộc họp này đã đóng.`;
        pageTitle = `${name} - Phòng họp không giấy`;
      }
    }

    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    const metaBlock = `
    <title>${escapeHtml(pageTitle)}</title>
    <meta property="og:title" content="${escapeHtml(ogTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(SITE_ORIGIN + req.originalUrl)}">
    <meta property="og:site_name" content="Sổ tay Công tác Hội Nông dân cấp xã/phường">
    <meta property="og:locale" content="vi_VN">
    <meta property="og:url" content="${escapeHtml(SITE_ORIGIN + req.originalUrl)}">
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
    `;
    const headEnd = html.search(/<\/head>/i);
    const HEAD_SCAN_LIMIT = headEnd > 0 && headEnd < 20000 ? headEnd : 3000;
    let headPart = html.slice(0, HEAD_SCAN_LIMIT).replace(/<title>[\s\S]*?<\/title>/i, "");
    headPart = headPart.replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>\s*/gi, "");
    headPart = headPart.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");
    const headOpenIdx = headPart.search(/<head[^>]*>/i);
    if (headOpenIdx !== -1) {
      const insertAt = headPart.indexOf(">", headOpenIdx) + 1;
      headPart = headPart.slice(0, insertAt) + metaBlock + headPart.slice(insertAt);
    } else {
      headPart = metaBlock + headPart;
    }
    const bodyBuffer = Buffer.from(headPart + html.slice(HEAD_SCAN_LIMIT), "utf8");
    res.status(200);
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Content-Length", String(bodyBuffer.length));
    res.set("Cache-Control", "no-store");
    res.removeHeader("ETag");
    res.end(bodyBuffer);
  } catch (err) {
    console.error("[meetingMeta] Lỗi:", err);
    res.status(500).send("Internal Server Error");
  }
});
