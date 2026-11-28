# Máy chủ AI `aiGemini` — hướng dẫn chuẩn bị (Giai đoạn 0) và thử (Giai đoạn 1)

```
Trình duyệt (app)  ──(đăng nhập Google)──>  aiGemini trên Cloud Run (giữ khoá)  ──>  Gemini
```

- Khoá Gemini CHỈ nằm ở **Secret Manager** (bí mật tên `GEMINI_API_KEY`). Không
  nằm trong code, không nằm trong database, trình duyệt không bao giờ thấy.
- Hàm `aiGemini` nằm trong `functions/ai-gemini.js`, tự triển khai bằng GitHub
  Actions khi gộp vào `main`. Trên Cloud Console nó hiện là một dịch vụ Cloud Run
  tên `aigemini`, vùng Singapore (`asia-southeast1`).
- Địa chỉ: `https://asia-southeast1-congtachoinongdan.cloudfunctions.net/aiGemini`
- Bộ đếm hạn mức lưu ở **Firestore** (`ai_usage_days`), chỉ máy chủ đọc/ghi được.

Mọi bước dưới đây làm được bằng trình duyệt trên máy tính bảng. Luôn để ý góc trên
cùng của Google Cloud Console đang chọn đúng dự án **congtachoinongdan**.

---

## GIAI ĐOẠN 0 — Chuẩn bị (làm theo đúng thứ tự)

### Bước 1 — Tạo cơ sở dữ liệu Firestore (để đếm hạn mức)

1. Mở `https://console.firebase.google.com/project/congtachoinongdan/firestore`
2. **Nếu thấy nút "Tạo cơ sở dữ liệu" (Create database):**
   - Phiên bản (Edition): **Standard**.
   - Mã cơ sở dữ liệu (Database ID): để nguyên **(default)**.
   - Vị trí (Location): chọn **asia-southeast1 (Singapore)**. Chọn rồi không đổi
     được nữa, nhưng vị trí nào cũng chạy được — Singapore cho nhanh.
   - Chế độ: chọn **Chế độ sản xuất (Production mode)** — luật mặc định cấm mọi
     trình duyệt đọc/ghi. Đây CHÍNH LÀ điều ta muốn: chỉ máy chủ đếm được hạn mức,
     người dùng không tự xoá số đếm của mình được.
   - Bấm **Tạo**.
3. **Nếu Firestore đã có sẵn từ trước:** mở tab **Quy tắc (Rules)**, chụp ảnh gửi
   cho Claude. **Đừng tự sửa gì.**

### Bước 2 — Bật các API cần thiết

Mở lần lượt từng địa chỉ dưới đây. Trang nào hiện nút **Bật (Enable)** thì bấm;
hiện **Quản lý (Manage)** nghĩa là đã bật sẵn, bỏ qua.

1. Secret Manager:
   `https://console.cloud.google.com/apis/library/secretmanager.googleapis.com?project=congtachoinongdan`
2. Cloud Run Admin:
   `https://console.cloud.google.com/apis/library/run.googleapis.com?project=congtachoinongdan`
3. Eventarc:
   `https://console.cloud.google.com/apis/library/eventarc.googleapis.com?project=congtachoinongdan`
4. Cloud Build:
   `https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=congtachoinongdan`
5. Artifact Registry:
   `https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=congtachoinongdan`

(Số 4, 5 gần như chắc chắn đã bật sẵn vì các hàm cũ như biên lai đang chạy.)

### Bước 3 — Cất khoá Gemini mới vào Secret Manager

1. Mở `https://console.cloud.google.com/security/secret-manager?project=congtachoinongdan`
2. Bấm **+ Tạo bí mật (Create secret)**.
3. **Tên (Name):** gõ đúng `GEMINI_API_KEY` (chữ hoa, gạch dưới, không dấu cách).
4. **Giá trị bí mật (Secret value):** dán khoá Gemini mới (chuỗi bắt đầu bằng `AIza...`).
   Cẩn thận không dính dấu cách hay xuống dòng thừa ở đầu/cuối.
5. Các mục khác để nguyên mặc định → bấm **Tạo bí mật**.

**Không** gửi khoá cho Claude, **không** dán khoá vào màn hình "Cấu hình AI" cũ trong
app, **không** dán vào bất kỳ đâu khác.

*(Nên làm thêm, không bắt buộc)* Hạn chế khoá chỉ dùng được cho Gemini: mở
`https://console.cloud.google.com/apis/credentials` **ở đúng dự án chứa khoá** →
bấm vào khoá → **Hạn chế API (API restrictions)** → **Hạn chế khoá** → chỉ tích
**Generative Language API** → Lưu. Phần "Hạn chế ứng dụng" để **Không (None)** vì khoá
được gọi từ máy chủ, không phải từ trình duyệt.

### Bước 4 — Cấp quyền cho tài khoản triển khai của GitHub Actions

GitHub Actions đang dùng một **tài khoản dịch vụ** (service account) để triển khai.
Lần này nó cần thêm quyền: đọc bí mật `GEMINI_API_KEY` để gắn vào hàm, và mở hàm
cho app gọi được.

1. Mở `https://console.cloud.google.com/iam-admin/iam?project=congtachoinongdan`
2. Tìm dòng tài khoản dịch vụ dùng cho GitHub Actions — thường có email bắt đầu
   bằng `github-action-...@congtachoinongdan.iam.gserviceaccount.com`. Nếu không
   chắc là dòng nào: chụp ảnh danh sách (chỉ có tên và vai trò, không có khoá —
   an toàn để gửi) gửi cho Claude.
3. Xem cột **Vai trò (Role)** của dòng đó:
   - Nếu có **Chủ sở hữu (Owner)** → không cần làm gì thêm, sang Bước 5.
   - Nếu không: bấm biểu tượng **bút chì** ở dòng đó → **+ Thêm vai trò khác** và
     thêm từng vai trò còn thiếu trong 3 vai trò sau, rồi bấm **Lưu**:
     - **Quản trị viên Trình quản lý bí mật** (Secret Manager Admin)
     - **Quản trị viên Cloud Run** (Cloud Run Admin)
     - **Người dùng tài khoản dịch vụ** (Service Account User) — thường đã có sẵn

### Bước 5 — Bật cảnh báo ngân sách (email báo khi tiêu nhiều)

Tiền Gemini tính vào **dự án chứa khoá Gemini** (dự án anh/chị lấy khoá trong Google
AI Studio) — có thể khác dự án `congtachoinongdan`.

1. Mở `https://console.cloud.google.com/billing` → chọn tài khoản thanh toán đang
   trả tiền cho khoá Gemini.
2. **Ngân sách và cảnh báo (Budgets & alerts)** → **Tạo ngân sách (Create budget)**.
3. Phạm vi (Scope): chọn đúng dự án chứa khoá Gemini.
4. Số tiền: ví dụ **20 USD/tháng**.
5. Ngưỡng cảnh báo: 50%, 90%, 100% → nhận email.
6. Lưu.

Lưu ý: cảnh báo ngân sách **chỉ gửi email**, không tự cắt chi tiêu. Lớp chặn thật
là **cầu dao tổng 2 USD/ngày** trong máy chủ `aiGemini`.

### Bước 6 — CHƯA đụng vào khoá cũ

Giữ nguyên khoá cũ và màn hình "Cấu hình AI" cũ — app hiện tại vẫn đang dùng chúng.
Chỉ xoá ở Giai đoạn 5, khi app mới đã chạy ổn.

**Xong Giai đoạn 0 → báo Claude**, kèm bất cứ điều gì khác với mô tả ở trên.

---

## GIAI ĐOẠN 1 — Thử máy chủ sau khi gộp

Gộp nhánh chứa `functions/ai-gemini.js` vào `main` thì GitHub Actions tự triển khai
(mất khoảng 3–6 phút). Lúc này app CHƯA gọi tới máy chủ mới — app vẫn chạy y như cũ.

### Thử 1 — Máy chủ đã chạy chưa

Mở bằng trình duyệt:
`https://asia-southeast1-congtachoinongdan.cloudfunctions.net/aiGemini`

Đúng thì thấy:
```json
{"ma":"CHI_NHAN_POST","loi":"Máy chủ AI đang chạy. Địa chỉ này chỉ nhận yêu cầu POST từ app."}
```

### Thử 2 — Người chưa đăng nhập có bị chặn không

1. Mở **hoppscotch.io**.
2. Chọn **POST**, dán địa chỉ ở Thử 1 vào ô URL.
3. Tab **Body** → chọn kiểu **application/json** → dán:
   ```json
   {"action":"thu","contents":[{"role":"user","parts":[{"text":"Xin chào"}]}]}
   ```
4. **Không** thêm header Authorization nào. Bấm **Send**.

Đúng thì thấy mã **401** và:
```json
{"ma":"CAN_DANG_NHAP","loi":"Đồng chí cần đăng nhập trước khi dùng tính năng này."}
```

Thấy đúng hai kết quả trên là máy chủ đã chạy và đã chặn người chưa đăng nhập. Phép
thử có đăng nhập thật (gọi được Gemini) làm ở Giai đoạn 2, ngay trong app.

---

## Hạn mức hiện tại (sửa ở `CAU_HINH` đầu tệp `functions/ai-gemini.js`)

| Hạn mức | Giá trị |
|---|---|
| Mỗi người đã đăng nhập / ngày | 80 lượt, 500.000 token gửi lên, 50.000 token trả về |
| Cầu dao tổng cả hệ thống / ngày | 2 USD (tính theo giá ước tính, cố ý lấy mức cao) |
| Model | `gemini-flash-latest`, tắt "suy nghĩ" mặc định |

Ngày tính theo giờ Việt Nam. Giai đoạn 2 sẽ thêm màn hình "Hạn mức và mức dùng AI"
trong Cài đặt Admin để sửa ngay trên app.

## Khi có lỗi

- Hàm báo "Máy chủ AI chưa sẵn sàng (chưa đọc được bộ đếm hạn mức)" → chưa tạo
  Firestore (Bước 1).
- Hàm báo "Máy chủ AI đang gặp sự cố cấu hình" → khoá trong `GEMINI_API_KEY` sai,
  bị thu hồi, hoặc dự án chứa khoá hết tiền/chưa bật thanh toán.
- Xem nhật ký: `https://console.cloud.google.com/run?project=congtachoinongdan` →
  dịch vụ `aigemini` → tab **Nhật ký (Logs)**. Mỗi lượt gọi có một dòng
  `[aiGemini] <uid> <tính năng> gửi=... trả=... usd=...` — không ghi nội dung trò chuyện.
