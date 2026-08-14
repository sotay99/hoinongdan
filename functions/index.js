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
