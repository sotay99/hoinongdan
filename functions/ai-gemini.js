// ============================================================================
// Cloud Function: aiGemini — MÁY CHỦ TRUNG GIAN AI DUY NHẤT của cả app
// ============================================================================
//
//   Trình duyệt (app)  ──(ID token đăng nhập)──>  aiGemini (giữ khoá)  ──>  Gemini
//
// MỌI tính năng dùng AI trong app đều phải đi qua ĐÚNG hàm này. Trình duyệt
// KHÔNG BAO GIỜ được cầm khoá Gemini. Khoá nằm ở Secret Manager (bí mật tên
// GEMINI_API_KEY), Cloud Run chỉ đưa vào biến môi trường của hàm lúc chạy.
//
// Địa chỉ gọi: https://asia-southeast1-congtachoinongdan.cloudfunctions.net/aiGemini
// (Gọi THẲNG địa chỉ này, KHÔNG qua rewrite của Firebase Hosting: Hosting cắt
// mọi yêu cầu sau 60 giây, câu trả lời dài như soạn giáo án sẽ bị đứt giữa chừng.)
//
// Chỉ một model (Flash) — không chọn model, không dự phòng sang hãng khác.
// Lỗi 429/5xx từ Google thì tự thử lại tối đa 2 lần, vẫn đúng model đó.
//
// ---------------------------------------------------------------------------
// HỢP ĐỒNG GỌI (POST, JSON)
// ---------------------------------------------------------------------------
// Header:  Authorization: Bearer <Firebase ID token>   (BẮT BUỘC — chưa đăng nhập là bị chặn)
// Thân:
//   action          chuỗi ngắn [a-z0-9_], tên tính năng gọi (chat, tuyen_truyen, khao_sat...)
//                   — chỉ để ghi log/thống kê, không đổi cách xử lý.
//   system          (tuỳ chọn) câu lệnh hệ thống (vai trò, quy tắc...).
//   contents        mảng lượt hội thoại theo đúng định dạng Gemini:
//                   [{ role:'user'|'model', parts:[ {text} | {inlineData:{mimeType,data}}
//                                                  | {functionCall,...} | {functionResponse} ] }]
//   webSearch       (tuỳ chọn) true = cho Gemini tìm kiếm Google.
//   congCu          (tuỳ chọn) mảng functionDeclarations — để Gemini tự gọi công cụ (đọc tệp...).
//   json            (tuỳ chọn) true = buộc trả về JSON.
//   suyNghi         (tuỳ chọn) 'tat' (mặc định, rẻ nhất) | 'thap' (cho việc cần lập luận).
//   maxOutputTokens (tuỳ chọn) trần độ dài câu trả lời, bị kẹp trong [256, 8192].
//   stream          (tuỳ chọn) mặc định true.
//
// Trả về khi stream=true: từng dòng JSON (application/x-ndjson):
//   {"loai":"chu","t":"<đoạn chữ mới>"}
//   {"loai":"goi_cong_cu","parts":[...]}   ← GIỮ NGUYÊN các part này (kể cả thoughtSignature)
//                                            khi gửi lại lượt sau, Gemini bắt buộc vậy.
//   {"loai":"xong","usage":{...},"nguon":[...],"lyDo":"STOP"}
//   {"loai":"loi","ma":"...","loi":"<câu tiếng Việt cho người dùng>"}
// Khi stream=false: một JSON { text, parts, usage, nguon, lyDo } hoặc { ma, loi }.
// Lỗi xảy ra TRƯỚC khi bắt đầu trả chữ luôn là JSON { ma, loi } kèm mã HTTP tương ứng.
//
// ---------------------------------------------------------------------------
// HẠN MỨC — lưu ở Firestore (KHÔNG phải Realtime Database)
// ---------------------------------------------------------------------------
// ai_usage_days/{YYYY-MM-DD}                 → tổng toàn hệ thống trong ngày
// ai_usage_days/{YYYY-MM-DD}/users/{uid}     → từng người trong ngày
// Ngày tính theo giờ Việt Nam. Firestore để luật mặc định "cấm mọi trình
// duyệt" — chỉ máy chủ (Admin SDK) đọc/ghi được, nên người dùng không thể tự
// xoá số đếm của mình. Lý do không dùng Realtime Database: luật của nó hiện
// chưa nằm trong repo và có thể đang mở rộng (xem docs/firebase-access-audit.md).
// ============================================================================

"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// ---------------------------------------------------------------------------
// CẤU HÌNH — muốn đổi hạn mức/giá/model thì sửa ở ĐÂY rồi gộp vào main.
// (Giai đoạn 2 sẽ thêm màn hình "Hạn mức và mức dùng AI" cho Admin sửa trên app.)
// ---------------------------------------------------------------------------
const CAU_HINH = {
  model: "gemini-flash-latest",

  // Mỗi người đã đăng nhập, mỗi ngày (giờ Việt Nam).
  moiNguoi: {
    soLuot: 80,
    tokenGuiLen: 500000,
    tokenTraVe: 50000, // gồm cả token "suy nghĩ" — Google tính giá như chữ trả về
  },

  // CẦU DAO TỔNG: cả hệ thống cộng lại không vượt số USD này mỗi ngày.
  nganSachUsdMoiNgay: 2,

  // Giá ước tính (USD / 1 triệu token) — CỐ Ý lấy mức CAO trong các bảng giá
  // Flash hiện hành, để cầu dao ngắt SỚM hơn chứ không bao giờ muộn hơn thực tế.
  // Đối chiếu lại với https://ai.google.dev/pricing khi Google đổi giá.
  gia: {
    guiLen: 1.5,
    guiLenDaCache: 0.15,
    traVe: 9.0,
    moiLanTimKiemWeb: 0.035,
  },

  // Giới hạn mỗi yêu cầu (chặn một lần gọi khổng lồ đốt tiền).
  moiYeuCau: {
    kyTuChuToiDa: 300000, // tổng chữ của system + mọi lượt (~100 nghìn token)
    tepToiDa: 10,
    byteTepToiDa: 20 * 1024 * 1024, // tổng dữ liệu tệp (base64) — Cloud Run nhận tối đa 32MB/yêu cầu
    luotToiDa: 80,
    congCuToiDa: 20,
    maxOutputTokensMacDinh: 4096,
    maxOutputTokensTran: 8192,
  },
};

const MIME_CHO_PHEP = /^(image|audio)\/[a-z0-9.+-]+$|^application\/pdf$|^text\/(plain|csv|markdown|html)$/i;

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------
class LoiCoMa extends Error {
  constructor(httpStatus, ma, loi) {
    super(loi);
    this.httpStatus = httpStatus;
    this.ma = ma;
    this.loi = loi;
  }
}

const ngayVietNam = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

function soNguyen(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

// ---------------------------------------------------------------------------
// 1) Xác minh đăng nhập — ID token Firebase thật, kiểm chữ ký bằng Admin SDK.
// ---------------------------------------------------------------------------
async function xacMinhNguoiDung(req) {
  const header = req.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    throw new LoiCoMa(401, "CAN_DANG_NHAP", "Đồng chí cần đăng nhập trước khi dùng tính năng này.");
  }
  let giaiMa;
  try {
    giaiMa = await admin.auth().verifyIdToken(m[1].trim());
  } catch (e) {
    throw new LoiCoMa(401, "CAN_DANG_NHAP", "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Đồng chí vui lòng đăng nhập lại rồi thử lại.");
  }
  const nhaCungCap = giaiMa.firebase && giaiMa.firebase.sign_in_provider;
  if (!giaiMa.uid || nhaCungCap === "anonymous") {
    throw new LoiCoMa(401, "CAN_DANG_NHAP", "Đồng chí cần đăng nhập trước khi dùng tính năng này.");
  }
  return { uid: giaiMa.uid, email: giaiMa.email || "" };
}

// ---------------------------------------------------------------------------
// 2) Kiểm tra & chuẩn hoá thân yêu cầu.
// ---------------------------------------------------------------------------
function chuanHoaPart(p) {
  if (!p || typeof p !== "object") throw new LoiCoMa(400, "SAI_DU_LIEU", "Một phần nội dung gửi lên không hợp lệ.");
  if (typeof p.text === "string") {
    const out = { text: p.text };
    if (typeof p.thoughtSignature === "string") out.thoughtSignature = p.thoughtSignature;
    return out;
  }
  const inl = p.inlineData || p.inline_data;
  if (inl) {
    const mimeType = String(inl.mimeType || inl.mime_type || "");
    const data = inl.data;
    if (!MIME_CHO_PHEP.test(mimeType)) {
      throw new LoiCoMa(400, "TEP_KHONG_HO_TRO", `Loại tệp "${mimeType || "không rõ"}" không được hỗ trợ. Chỉ nhận ảnh, PDF, âm thanh và tệp chữ.`);
    }
    if (typeof data !== "string" || !data) throw new LoiCoMa(400, "SAI_DU_LIEU", "Tệp đính kèm bị rỗng.");
    return { inlineData: { mimeType, data } };
  }
  if (p.functionCall && typeof p.functionCall === "object") {
    const out = { functionCall: { name: String(p.functionCall.name || ""), args: p.functionCall.args || {} } };
    if (p.functionCall.id) out.functionCall.id = String(p.functionCall.id);
    if (typeof p.thoughtSignature === "string") out.thoughtSignature = p.thoughtSignature;
    return out;
  }
  if (p.functionResponse && typeof p.functionResponse === "object") {
    const fr = p.functionResponse;
    const out = { functionResponse: { name: String(fr.name || ""), response: fr.response && typeof fr.response === "object" ? fr.response : { ketQua: fr.response } } };
    if (fr.id) out.functionResponse.id = String(fr.id);
    return out;
  }
  throw new LoiCoMa(400, "SAI_DU_LIEU", "Một phần nội dung gửi lên không thuộc loại được hỗ trợ.");
}

function kiemTraYeuCau(than) {
  const gh = CAU_HINH.moiYeuCau;
  if (!than || typeof than !== "object") throw new LoiCoMa(400, "SAI_DU_LIEU", "Thiếu nội dung yêu cầu.");

  const action = String(than.action || "");
  if (!/^[a-z0-9_]{1,40}$/.test(action)) throw new LoiCoMa(400, "SAI_DU_LIEU", "Thiếu hoặc sai tên tính năng (action).");

  const system = than.system == null ? "" : String(than.system);
  if (!Array.isArray(than.contents) || !than.contents.length) {
    throw new LoiCoMa(400, "SAI_DU_LIEU", "Thiếu nội dung hội thoại (contents).");
  }
  if (than.contents.length > gh.luotToiDa) {
    throw new LoiCoMa(400, "QUA_DAI", `Cuộc trò chuyện quá dài (tối đa ${gh.luotToiDa} lượt) — đồng chí mở một đoạn chat mới nhé.`);
  }

  let tongKyTu = system.length;
  let soTep = 0;
  let byteTep = 0;
  const contents = than.contents.map((luot) => {
    if (!luot || !Array.isArray(luot.parts) || !luot.parts.length) {
      throw new LoiCoMa(400, "SAI_DU_LIEU", "Một lượt hội thoại không có nội dung.");
    }
    const role = luot.role === "model" || luot.role === "assistant" ? "model" : "user";
    const parts = luot.parts.map(chuanHoaPart);
    parts.forEach((p) => {
      if (p.text) tongKyTu += p.text.length;
      if (p.inlineData) { soTep += 1; byteTep += p.inlineData.data.length; }
      if (p.functionResponse) tongKyTu += JSON.stringify(p.functionResponse.response).length;
    });
    return { role, parts };
  });

  if (tongKyTu > gh.kyTuChuToiDa) {
    throw new LoiCoMa(400, "QUA_DAI", "Nội dung gửi cho AI quá dài. Đồng chí rút gọn bớt hoặc mở một đoạn chat mới nhé.");
  }
  if (soTep > gh.tepToiDa) throw new LoiCoMa(400, "QUA_NHIEU_TEP", `Chỉ gửi được tối đa ${gh.tepToiDa} tệp mỗi lần.`);
  if (byteTep > gh.byteTepToiDa) throw new LoiCoMa(400, "TEP_QUA_LON", "Tổng dung lượng tệp đính kèm quá lớn (tối đa khoảng 15MB). Đồng chí nén hoặc bớt tệp rồi thử lại.");

  let congCu = [];
  if (than.congCu != null) {
    if (!Array.isArray(than.congCu) || than.congCu.length > gh.congCuToiDa) {
      throw new LoiCoMa(400, "SAI_DU_LIEU", "Danh sách công cụ (congCu) không hợp lệ.");
    }
    congCu = than.congCu.map((c) => {
      if (!c || !/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(String(c.name || ""))) {
        throw new LoiCoMa(400, "SAI_DU_LIEU", "Tên công cụ không hợp lệ.");
      }
      return c;
    });
  }

  const maxOut = soNguyen(than.maxOutputTokens) || gh.maxOutputTokensMacDinh;

  return {
    action,
    system,
    contents,
    congCu,
    webSearch: than.webSearch === true,
    json: than.json === true,
    suyNghi: than.suyNghi === "thap" ? "thap" : "tat",
    maxOutputTokens: Math.min(Math.max(maxOut, 256), gh.maxOutputTokensTran),
    stream: than.stream !== false,
    // Ước lượng thô token gửi lên (để chặn trước khi gọi): chữ tiếng Việt ~3 ký tự/token.
    uocTokenGuiLen: Math.ceil(tongKyTu / 3),
  };
}

// ---------------------------------------------------------------------------
// 3) Hạn mức — đọc trước khi gọi, cộng dồn sau khi có số token thật.
// ---------------------------------------------------------------------------
function refHanMuc(uid) {
  const db = admin.firestore();
  const ngay = ngayVietNam();
  const docNgay = db.collection("ai_usage_days").doc(ngay);
  return { docNgay, docNguoi: docNgay.collection("users").doc(uid) };
}

async function kiemTraHanMuc(uid, uocTokenGuiLen) {
  const { docNgay, docNguoi } = refHanMuc(uid);
  let snapNgay, snapNguoi;
  try {
    [snapNgay, snapNguoi] = await Promise.all([docNgay.get(), docNguoi.get()]);
  } catch (e) {
    console.error("[aiGemini] Không đọc được Firestore (đã tạo cơ sở dữ liệu Firestore chưa?):", e);
    throw new LoiCoMa(500, "MAY_CHU_CHUA_SAN_SANG", "Máy chủ AI chưa sẵn sàng (chưa đọc được bộ đếm hạn mức). Đồng chí báo Admin kiểm tra giúp.");
  }
  const tong = snapNgay.exists ? snapNgay.data() : {};
  const nguoi = snapNguoi.exists ? snapNguoi.data() : {};

  if ((tong.usd || 0) >= CAU_HINH.nganSachUsdMoiNgay) {
    throw new LoiCoMa(429, "HET_NGAN_SACH_CHUNG", "Hệ thống AI đã dùng hết ngân sách chung của hôm nay. Đồng chí vui lòng quay lại vào ngày mai.");
  }
  const hm = CAU_HINH.moiNguoi;
  const daGui = nguoi.tokenGuiLen || 0;
  if ((nguoi.soLuot || 0) >= hm.soLuot || daGui >= hm.tokenGuiLen || (nguoi.tokenTraVe || 0) >= hm.tokenTraVe) {
    throw new LoiCoMa(429, "HET_HAN_MUC", "Đồng chí đã dùng hết hạn mức AI hôm nay. Vui lòng quay lại vào ngày mai.");
  }
  if (daGui + uocTokenGuiLen > hm.tokenGuiLen) {
    throw new LoiCoMa(429, "HET_HAN_MUC", "Nội dung lần này dài hơn phần hạn mức AI còn lại của đồng chí hôm nay. Đồng chí rút gọn bớt, hoặc quay lại vào ngày mai.");
  }
}

function tinhChiPhi(usage, soLanTimKiem) {
  const g = CAU_HINH.gia;
  const guiLen = usage.tokenGuiLen;
  const daCache = Math.min(usage.tokenDaCache, guiLen);
  return (
    ((guiLen - daCache) * g.guiLen + daCache * g.guiLenDaCache + usage.tokenTraVe * g.traVe) / 1e6 +
    soLanTimKiem * g.moiLanTimKiemWeb
  );
}

async function ghiHanMuc(nguoiDung, action, usage, usd) {
  const { docNgay, docNguoi } = refHanMuc(nguoiDung.uid);
  const inc = admin.firestore.FieldValue.increment;
  const congDon = {
    soLuot: inc(1),
    tokenGuiLen: inc(usage.tokenGuiLen),
    tokenDaCache: inc(usage.tokenDaCache),
    tokenTraVe: inc(usage.tokenTraVe),
    usd: inc(usd),
    capNhatLuc: admin.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await Promise.all([
      docNgay.set(congDon, { merge: true }),
      docNguoi.set({ ...congDon, email: nguoiDung.email, theoTinhNang: { [action]: inc(1) } }, { merge: true }),
    ]);
  } catch (e) {
    console.error("[aiGemini] Không ghi được bộ đếm hạn mức:", e);
  }
}

// ---------------------------------------------------------------------------
// 4) Gọi Gemini (stream SSE) — có thử lại khi Google quá tải.
// ---------------------------------------------------------------------------
// Một số đời model không nhận kiểu cấu hình "suy nghĩ" này hay kiểu kia
// (2.5 dùng thinkingBudget, 3.x dùng thinkingLevel). Gặp lỗi 400 nói về
// "thinking" thì bỏ hẳn cấu hình đó cho các lần gọi sau của instance này.
let boCauHinhSuyNghi = false;

function cauHinhSuyNghi(model, suyNghi) {
  if (boCauHinhSuyNghi) return null;
  if (/2\.5/.test(model)) return { thinkingBudget: suyNghi === "thap" ? 1024 : 0 };
  return { thinkingLevel: suyNghi === "thap" ? "low" : "minimal" };
}

function taoThanGemini(yc) {
  const generationConfig = { maxOutputTokens: yc.maxOutputTokens };
  const suyNghi = cauHinhSuyNghi(CAU_HINH.model, yc.suyNghi);
  if (suyNghi) generationConfig.thinkingConfig = suyNghi;
  if (yc.json) generationConfig.responseMimeType = "application/json";

  const body = { contents: yc.contents, generationConfig };
  if (yc.system) body.systemInstruction = { parts: [{ text: yc.system }] };
  const tools = [];
  if (yc.webSearch) tools.push({ googleSearch: {} });
  if (yc.congCu.length) tools.push({ functionDeclarations: yc.congCu });
  if (tools.length) body.tools = tools;
  return body;
}

const LOI_THU_LAI = new Set([429, 500, 502, 503, 504]);

async function moLuongGemini(yc, apiKey, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CAU_HINH.model}:streamGenerateContent?alt=sse`;
  const choDoi = [0, 1500, 3500];
  let loiCuoi = null;
  for (let lan = 0; lan < choDoi.length; lan++) {
    if (choDoi[lan]) await ngu(choDoi[lan]);
    if (signal.aborted) throw new LoiCoMa(499, "DA_HUY", "Đã huỷ.");
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(taoThanGemini(yc)),
        signal,
      });
    } catch (e) {
      if (signal.aborted) throw new LoiCoMa(499, "DA_HUY", "Đã huỷ.");
      loiCuoi = new LoiCoMa(502, "LOI_KET_NOI", "Không kết nối được tới Google AI. Đồng chí thử lại sau ít phút.");
      continue;
    }
    if (res.ok) return res;

    let thongDiep = `HTTP ${res.status}`;
    try {
      const d = await res.json();
      const e = Array.isArray(d) ? d[0] && d[0].error : d && d.error;
      if (e && e.message) thongDiep = e.message;
    } catch (_) { /* thân lỗi không phải JSON */ }
    console.warn(`[aiGemini] Gemini trả ${res.status} (lần ${lan + 1}): ${thongDiep}`);

    if (res.status === 400 && /thinking/i.test(thongDiep) && !boCauHinhSuyNghi) {
      boCauHinhSuyNghi = true;
      lan -= 1; // thử lại ngay, không tính vào số lần thử
      continue;
    }
    if (LOI_THU_LAI.has(res.status)) {
      loiCuoi = new LoiCoMa(503, "AI_QUA_TAI", "Hệ thống AI của Google đang quá tải. Đồng chí thử lại sau ít phút nhé.");
      continue;
    }
    if (res.status === 400) throw new LoiCoMa(400, "AI_TU_CHOI", `AI không xử lý được yêu cầu này: ${thongDiep}`);
    if (res.status === 401 || res.status === 403) {
      console.error("[aiGemini] Khoá Gemini bị từ chối — kiểm tra bí mật GEMINI_API_KEY và thanh toán của khoá.");
      throw new LoiCoMa(502, "KHOA_AI_LOI", "Máy chủ AI đang gặp sự cố cấu hình. Đồng chí báo Admin kiểm tra giúp.");
    }
    throw new LoiCoMa(502, "AI_LOI", `AI gặp lỗi (${res.status}). Đồng chí thử lại sau ít phút.`);
  }
  throw loiCuoi || new LoiCoMa(503, "AI_QUA_TAI", "Hệ thống AI của Google đang quá tải. Đồng chí thử lại sau ít phút nhé.");
}

// Đọc luồng SSE của Gemini, gọi onChu(đoạn chữ) mỗi khi có chữ mới.
async function docLuongGemini(res, onChu) {
  const ketQua = { text: "", goiCongCu: [], usageGoc: null, lyDo: "", nguon: [], soLanTimKiem: 0, biChan: "" };
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let dem = "";
  const xuLyObj = (obj) => {
    if (obj.error) throw new LoiCoMa(502, "AI_LOI", `AI gặp lỗi: ${obj.error.message || "không rõ"}`);
    if (obj.promptFeedback && obj.promptFeedback.blockReason) ketQua.biChan = obj.promptFeedback.blockReason;
    if (obj.usageMetadata) ketQua.usageGoc = obj.usageMetadata;
    const c = obj.candidates && obj.candidates[0];
    if (!c) return;
    if (c.finishReason) ketQua.lyDo = c.finishReason;
    const parts = (c.content && c.content.parts) || [];
    for (const p of parts) {
      if (p.thought) continue; // không bao giờ chuyển phần "suy nghĩ" cho người dùng
      if (p.functionCall) { ketQua.goiCongCu.push(p); continue; }
      if (typeof p.text === "string" && p.text) { ketQua.text += p.text; onChu(p.text); }
    }
    const gm = c.groundingMetadata;
    if (gm) {
      if (Array.isArray(gm.webSearchQueries)) ketQua.soLanTimKiem = Math.max(ketQua.soLanTimKiem, gm.webSearchQueries.length ? 1 : 0);
      (gm.groundingChunks || []).forEach((g) => {
        if (g.web && g.web.uri && !ketQua.nguon.some((n) => n.uri === g.web.uri)) {
          ketQua.nguon.push({ uri: g.web.uri, title: g.web.title || "" });
        }
      });
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    dem += decoder.decode(value, { stream: true });
    const dong = dem.split("\n");
    dem = dong.pop();
    for (const d of dong) {
      const t = d.trim();
      if (!t.startsWith("data:")) continue;
      const json = t.slice(5).trim();
      if (!json) continue;
      let obj;
      try { obj = JSON.parse(json); } catch (_) { continue; }
      xuLyObj(obj);
    }
  }
  const cuoi = dem.trim();
  if (cuoi.startsWith("data:")) {
    try { xuLyObj(JSON.parse(cuoi.slice(5).trim())); } catch (e) { if (e instanceof LoiCoMa) throw e; }
  }
  return ketQua;
}

function usageTuGoc(u) {
  u = u || {};
  return {
    tokenGuiLen: soNguyen(u.promptTokenCount) + soNguyen(u.toolUsePromptTokenCount),
    tokenDaCache: soNguyen(u.cachedContentTokenCount),
    tokenTraVe: soNguyen(u.candidatesTokenCount) + soNguyen(u.thoughtsTokenCount),
  };
}

// ---------------------------------------------------------------------------
// 5) Điểm vào
// ---------------------------------------------------------------------------
async function xuLy(req, res) {
  // CORS mở cho mọi nguồn: an toàn vì xác thực bằng ID token trong header
  // Authorization (không dùng cookie) — trang lạ không lấy được token của người dùng.
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "authorization, content-type");
  res.set("Access-Control-Max-Age", "3600");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") {
    res.status(405).json({ ma: "CHI_NHAN_POST", loi: "Máy chủ AI đang chạy. Địa chỉ này chỉ nhận yêu cầu POST từ app." });
    return;
  }

  const huy = new AbortController();
  res.on("close", () => { if (!res.writableEnded) huy.abort(); });

  let nguoiDung = null;
  let yc = null;
  let daBatDauTra = false;
  const ghi = (obj) => { res.write(JSON.stringify(obj) + "\n"); };

  try {
    nguoiDung = await xacMinhNguoiDung(req);
    yc = kiemTraYeuCau(req.body);
    await kiemTraHanMuc(nguoiDung.uid, yc.uocTokenGuiLen);

    const luong = await moLuongGemini(yc, GEMINI_API_KEY.value(), huy.signal);

    if (yc.stream) {
      res.status(200);
      res.set("Content-Type", "application/x-ndjson; charset=utf-8");
      res.set("Cache-Control", "no-cache, no-transform");
      res.set("X-Accel-Buffering", "no");
      daBatDauTra = true;
    }

    let kq;
    try {
      kq = await docLuongGemini(luong, (t) => { if (yc.stream) ghi({ loai: "chu", t }); });
    } catch (e) {
      // Đứt giữa chừng: vẫn tính phí theo ước lượng để không ai lách hạn mức bằng cách huỷ giữa chừng.
      await ghiHanMuc(nguoiDung, yc.action, { tokenGuiLen: yc.uocTokenGuiLen, tokenDaCache: 0, tokenTraVe: 0 },
        tinhChiPhi({ tokenGuiLen: yc.uocTokenGuiLen, tokenDaCache: 0, tokenTraVe: 0 }, 0));
      throw huy.signal.aborted ? new LoiCoMa(499, "DA_HUY", "Đã huỷ.") : e;
    }

    const usage = kq.usageGoc ? usageTuGoc(kq.usageGoc) : { tokenGuiLen: yc.uocTokenGuiLen, tokenDaCache: 0, tokenTraVe: Math.ceil(kq.text.length / 3) };
    const usd = tinhChiPhi(usage, kq.soLanTimKiem);
    await ghiHanMuc(nguoiDung, yc.action, usage, usd);
    console.log(`[aiGemini] ${nguoiDung.uid} ${yc.action} gửi=${usage.tokenGuiLen} cache=${usage.tokenDaCache} trả=${usage.tokenTraVe} usd=${usd.toFixed(5)} lý do=${kq.lyDo || "-"}`);

    if (!kq.text.trim() && !kq.goiCongCu.length) {
      const biChan = kq.biChan || kq.lyDo === "SAFETY" || kq.lyDo === "PROHIBITED_CONTENT";
      throw new LoiCoMa(502, biChan ? "AI_TU_CHOI" : "AI_KHONG_TRA_LOI",
        biChan ? "AI từ chối trả lời nội dung này. Đồng chí thử diễn đạt lại nhé." : "AI không trả về nội dung nào. Đồng chí thử lại nhé.");
    }

    const dongXong = { usage, nguon: kq.nguon, lyDo: kq.lyDo };
    if (yc.stream) {
      if (kq.goiCongCu.length) ghi({ loai: "goi_cong_cu", parts: kq.goiCongCu });
      ghi({ loai: "xong", ...dongXong });
      res.end();
    } else {
      res.status(200).json({ text: kq.text.trim(), parts: kq.goiCongCu, ...dongXong });
    }
  } catch (e) {
    const loi = e instanceof LoiCoMa ? e : new LoiCoMa(500, "LOI_MAY_CHU", "Máy chủ AI gặp lỗi không mong muốn. Đồng chí thử lại sau ít phút.");
    if (!(e instanceof LoiCoMa)) console.error("[aiGemini] Lỗi không mong muốn:", e);
    if (loi.ma === "DA_HUY" && res.writableEnded) return;
    if (daBatDauTra) {
      if (!res.writableEnded) { ghi({ loai: "loi", ma: loi.ma, loi: loi.loi }); res.end(); }
    } else if (!res.headersSent) {
      res.status(loi.httpStatus).json({ ma: loi.ma, loi: loi.loi });
    }
  }
}

exports.aiGemini = onRequest(
  {
    region: "asia-southeast1",
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory: "512MiB",
    cpu: 1,
    concurrency: 40,
    maxInstances: 5, // chặn trần chi phí Cloud Run nếu bị gọi dồn dập
    invoker: "public", // ai cũng GỌI được địa chỉ, nhưng không có ID token hợp lệ thì bị từ chối ngay
    // Dùng chung tài khoản dịch vụ với các hàm cũ (receiptMeta...) — tài khoản này
    // đã có sẵn quyền đọc/ghi dữ liệu của dự án, khỏi phải cấp quyền mới.
    serviceAccount: "congtachoinongdan@appspot.gserviceaccount.com",
  },
  xuLy
);

// Chỉ để kiểm thử cục bộ — index.js CHỈ xuất lại `aiGemini`, nên Firebase không thấy phần này.
exports._kiemThu = { xuLy, kiemTraYeuCau, tinhChiPhi, usageTuGoc, CAU_HINH };
