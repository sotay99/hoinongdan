# Firebase access audit

> Cập nhật: 2026-08-31  
> Phạm vi: mã nguồn hiện tại trong `hoinongdan-source`  
> Trạng thái: tài liệu audit, chưa phải Firebase Rules đã deploy

Tài liệu này lập bản đồ các đường dẫn Realtime Database và Cloud Storage mà
ứng dụng đang sử dụng. Những phân loại `public`, `guest` và `authenticated`
dưới đây được suy ra từ route và client code. Vì repository hiện chưa có
`database.rules.json` hoặc `storage.rules`, các phân loại này **chưa chứng minh
được quyền thực tế ở server**.

## 1. Các loại phiên hiện có

| Loại phiên | Đặc điểm | Ràng buộc quan trọng |
| --- | --- | --- |
| Signed out | Chưa đăng nhập, chưa vào mã xã | Chỉ được dùng kho cá nhân local và các route công khai |
| Guest qua mã | Không có Firebase Auth; vào bằng mã xã | Không thể dùng `auth.uid` để phân quyền hoặc bảo vệ chính mã truy cập |
| Google authenticated | Có Firebase Auth UID/email | Có thể gắn kho cá nhân theo UID; email-key chỉ là dữ liệu legacy |
| Google pending | Đã đăng nhập nhưng chưa được duyệt vào mã xã | Có thể cần đọc config tối thiểu; không được đọc cây nghiệp vụ |
| Tour/demo | Dữ liệu giả lập | Không được ghi bất kỳ dữ liệu Firebase nào |
| Site/admin | Google authenticated và thuộc danh sách admin | Cần server-side claim/ACL, không được tin chỉ vào `isAdmin()` phía client |

## 2. Realtime Database

### 2.1 Dữ liệu nghiệp vụ theo mã xã

| Đường dẫn | Mục đích | Đang được đọc/ghi bởi | Ý định quyền | Rủi ro hiện tại |
| --- | --- | --- | --- | --- |
| `data/{wardId}/config` | Con trỏ cấu hình, mã truy cập, owner, grants và public permissions | `03-cloud-storage.js`, `07-core-modules.js`, `09-ai-chat-notes.js` | Guest cần đọc một phần để vào mã; owner/editor được cập nhật | Guest flow đọc config rồi tự so sánh mã ở client. Rules không thể bảo vệ mã bí mật đúng nghĩa nếu vẫn giữ flow này |
| `secretdata/{secretId}/borrowers` | Hộ vay | `03-cloud-storage.js`, module khoản vay | Guest/viewer có thể xem theo quyền app; owner/editor ghi | `secretId` không phải UID và các helper ghi không tự kiểm tra quyền |
| `secretdata/{secretId}/loanProjects` | Phương án vay | Như trên | Như trên | Như trên |
| `secretdata/{secretId}/expenses` | Thu-chi | `03-cloud-storage.js`, `14-accounting-settings-bootstrap.js` | Người có quyền module đọc; editor ghi | Cần bảo vệ cả read lẫn write; chuyển vào trash hiện không tự dọn file Storage |
| `secretdata/{secretId}/trash` | Dữ liệu đã đưa vào thùng rác | Các module nghiệp vụ và khôi phục backup | Owner/editor; admin có luồng riêng | Không nên mặc định cho guest đọc toàn bộ |
| `secretdata/{secretId}/activityLog` | Nhật ký hoạt động | Core/accounting | Read theo vai trò; append có kiểm soát | `push` ở helper không có kiểm tra server-side |
| `secretdata/{secretId}/collaborators` | Dữ liệu cộng tác legacy/compatibility | Core/cloud storage | Owner/admin | Cần xác minh còn dùng production hay chỉ còn legacy trước khi khóa |
| `secretdata/{secretId}/borrowerReceipts` | Biên lai theo hộ vay | Core/accounting | Read theo quyền mã xã; ghi theo vai trò | Dữ liệu nhạy cảm, không được suy ra quyền từ URL hoặc UI |
| `secretdata/{secretId}/borrowerConfirmations` | Xác nhận của hộ vay | Core/accounting | Read/write theo luồng xác nhận | Cần tách quyền nộp xác nhận nếu có người ngoài đăng nhập |
| `secretdata/{secretId}/sharedBorrowerReceipts` | Biên lai dùng chung | Core/accounting | Read theo module; ghi editor | Cần test hồi quy guest/viewer |
| `secretdata/{secretId}/sharedConfirmationDocuments` | Tài liệu xác nhận dùng chung | Core/accounting | Read theo module; ghi editor | Metadata có thể trỏ tới Storage URL đã cấp |
| `secretdata/{secretId}/interestApprovals` | Phê duyệt lãi | Core/accounting | Read theo module; ghi editor/approver | Không nên cho guest tự ghi trạng thái phê duyệt |
| `secretdata/{secretId}/interestApprovalColumnPrefs` | Cấu hình cột phê duyệt | Accounting | Người có quyền cấu hình | Cần tách khỏi dữ liệu nghiệp vụ nếu muốn viewer chỉ đọc |
| `secretdata/{secretId}/quarterSettingsHistory` | Lịch sử cấu hình quý | Accounting | Read theo module; ghi editor | Có thể chứa dữ liệu vận hành cần bảo vệ |
| `secretdata/{secretId}/loanExtensions` | Gia hạn khoản vay | Core/accounting | Read theo module; ghi editor | Cần kiểm soát field-level nếu có thao tác workflow |
| `secretdata/{secretId}/interestPaymentBoxes` | Trạng thái thanh toán lãi | Core/accounting | Read theo module; ghi editor | Client permission không đủ để chống ghi tùy ý |
| `secretdata/{secretId}/receiptCategoriesPayment` | Danh mục thu | Accounting | Read theo module; ghi editor | Cần giới hạn shape và kích thước |
| `secretdata/{secretId}/receiptCategoriesRefund` | Danh mục chi/hoàn | Accounting | Read theo module; ghi editor | Như trên |
| `secretdata/{secretId}/borrowerManagers` | Người quản lý hộ vay | Accounting | Read theo module; ghi editor | Như trên |
| `secretdata/{secretId}/permanentlyDeletedBorrowers` | Hộ vay đã xóa vĩnh viễn | Accounting/admin | Owner/admin | Không được coi là dữ liệu public chỉ vì cùng `secretdata` |
| `secretdata/{secretId}/columnViewSets` | Bộ cột dùng chung | Core/accounting | Read theo module; ghi editor | Cần bảo vệ khỏi sửa cấu hình của ward khác |
| `secretdata/{secretId}/columnViewSetLog` | Lịch sử bộ cột | Core/accounting | Read theo module; append editor | Cần giới hạn append |
| `secretdata/{secretId}/loanColorLog` | Màu khoản vay | Core/notes | Read theo module; ghi editor | Không nên dùng làm bằng chứng quyền |
| `secretdata/{secretId}/categoryChangeLog` | Lịch sử đổi phân loại | Core/accounting | Read theo module; append editor | Cần giới hạn append |
| `secretdata/{secretId}/quarterStatusLog` | Nhật ký trạng thái quý | Core/accounting | Read theo module; append editor | Như trên |

`secretId` có fallback về `wardId` cho dữ liệu cũ. Khi viết Rules, phải giữ
đường di trú có kiểm soát; không được mở wildcard rộng cho mọi
`secretdata/*` chỉ để hỗ trợ legacy.

### 2.2 Kho cá nhân và dữ liệu account

| Đường dẫn | Mục đích | Ý định quyền | Ghi chú |
| --- | --- | --- | --- |
| `userPersonalData/{uid}/{sub}` | Cài đặt cá nhân, bộ cột, màu, ghi chú riêng | Chỉ chính UID đó | Đây là canonical path mới |
| `userPersonalData/{emailKey}/{sub}` | Dữ liệu cá nhân legacy | Chỉ chủ email tương ứng trong thời gian di trú | `emailKey` là encoding ứng dụng, không phải identity cryptographic |
| `users/{emailKey}/wards` | Ví mã xã của account | Chính account hoặc admin | Legacy email-key, cần ràng buộc với `auth.token.email` |
| `users/{emailKey}/deletedWards` | Mã đã xóa/chờ khôi phục | Chính account hoặc admin | Không cho người dùng đổi tùy ý owner metadata |
| `users/{emailKey}/chats` | Chat AI legacy | Chính account | Cần giới hạn read/write ở email của token |
| `users/{emailKey}/notes` | Ghi chú/chat legacy | Chính account | Như trên |
| `users/{uid}/drive_resources` | Metadata kho tài liệu cá nhân mới | Chính UID đó | Storage blob phải khớp cùng UID |
| `users/{emailKey}/drive_resources` | Metadata Drive legacy | Chính account trong di trú | Không để client tùy ý đọc email-key khác |
| `users/{uid}/super_notes/tree` | Super Notes cá nhân | Chính UID đó | Shared và local có semantics khác |
| `users/{emailKey}/super_notes/tree` | Super Notes legacy | Chính account trong di trú | Phải bảo vệ cả path legacy |

Luồng di trú hiện đọc UID + email-key + local rồi hợp nhất về UID nhưng chưa
xóa nhánh legacy. Rules rollout phải cho phép giai đoạn đọc legacy có giới hạn,
sau đó mới có thể đóng write hoặc xóa legacy sau khi xác minh production.

### 2.3 Public và system paths

| Đường dẫn | Mục đích | Ý định quyền | Rủi ro/điều kiện |
| --- | --- | --- | --- |
| `receipts/{receiptId}` | Snapshot biên lai public | Public read; public client chỉ được thực hiện thao tác thanh toán được giới hạn | Không cho guest overwrite toàn bộ, đổi status, đổi nội dung hoặc xóa tùy ý |
| `notifications/{emailKey}/{notificationId}` | Thông báo chủ biên lai | Chủ account đọc; public flow có thể tạo một notification hợp lệ | Email-key đích phải được ràng buộc với biên lai, field phải whitelist |
| `surveys/{surveyId}` | Khảo sát cá nhân/chung | Public đọc nếu khảo sát được công khai; owner/ward đọc và ghi theo ACL | Query `ownerEmail`/`wardId` không thay thế Rules |
| `survey_responses/{surveyId}/{responseId}` | Câu trả lời khảo sát | Public submit theo schema | Chỉ cho tạo response hợp lệ; không cho sửa/xóa response hoặc tăng counter tùy ý |
| `system_knowledge/tree` | Cây tri thức AI | Admin/system knowledge | Full-tree read hiện chưa có bằng chứng auth server-side trong source |
| `system_config/ai_providers` | Cấu hình provider AI | Admin write; read tối thiểu cần xác minh | Không lưu/cho đọc secret API key trên client nếu không cần |
| `admins` | Danh sách admin | Admin/super-admin quản lý | Không tin danh sách do client tự đọc để tự cấp quyền |
| `system_wards_index/{wardId}` | Mục lục ward cho admin | Admin only | Hàm đồng bộ chạy async và không có guard server-side trong helper |
| `secret_ward_map/{secretId}` | Ánh xạ mã ẩn | Admin/owner workflow rất hạn chế | Đây là metadata nhạy cảm, không public |
| `superadmin/trashWards` | Thùng rác hệ thống | Super-admin only | Phải có server-side role/claim |

## 3. Cloud Storage

| Prefix | Nội dung | Ý định quyền | Vấn đề cần xử lý |
| --- | --- | --- | --- |
| `expense_attachments/{wardId}/{expenseId}/{generatedId}_{name}` | File đính kèm thu-chi | Thành viên ward có quyền module; editor upload/delete | Tên file gốc còn nằm trong path; xóa expense/trash không tự dọn blob |
| `system_knowledge_files/{generatedId}_{name}` | File tri thức AI | Admin upload/read/delete | Cần giới hạn admin, MIME, kích thước và path; soft-delete metadata chưa xóa blob |
| `super_notes_files/{uid-or-ward}/{generatedId}_{name}` | File gốc Super Notes | Chủ UID hoặc ward ACL tương ứng | Có fallback ward và path tên file gốc; upload lỗi hiện có thể chỉ làm mất URL |
| `drive-resources/ward_{wardId}/{id}-{safeName}` | File Drive dùng chung | Guest viewer nếu được vào ward; owner/editor ghi | Storage không biết ACL RTDB; ai có download URL có thể tải độc lập |
| `drive-resources/user_{uid-or-key}/{id}-{safeName}` | File Drive cá nhân | Chính UID; legacy migration có thể dùng key cũ | Cần ngăn path `account` hoặc key tùy ý |

Các luồng upload đang gọi `getDownloadURL()` rồi lưu URL vào RTDB. URL này có
thể tiếp tục dùng được sau khi quyền ứng dụng bị thu hồi. Vì vậy:

1. Storage Rules vẫn cần chặn các request mới.
2. Xóa/quyền thu hồi phải cân nhắc xóa object hoặc xoay download token.
3. Không nên coi `storageUrl` là URL có thể kiểm soát bằng ACL RTDB.
4. Nên dùng object ID sinh riêng làm path; tên hiển thị lưu trong metadata,
   thay vì ghép tên file gốc vào path.

## 4. Các kết luận kiến trúc

### 4.1 Guest qua mã không thể được bảo vệ đầy đủ chỉ bằng Rules

Guest không đăng nhập Firebase Auth nhưng hiện phải đọc
`data/{wardId}/config` để client so sánh `accessCode`. Nếu Rules cho phép đọc
config trước khi xác thực, mã truy cập có thể bị đọc bởi client độc hại. Nếu
Rules không cho đọc config, flow guest hiện tại không thể hoạt động.

Muốn bảo vệ mã thật sự cần một trong các hướng sau:

- xác thực guest ở backend/Callable Function rồi cấp token hoặc session ngắn
  hạn;
- chuyển phần xác thực mã sang backend và chỉ trả về dữ liệu tối thiểu;
- hoặc chấp nhận mã xã là một access link không bí mật, đồng thời giảm dữ liệu
  guest được phép đọc.

Không nên cố giải quyết mâu thuẫn này bằng wildcard Rules hoặc bằng cách che
`accessCode` ở client.

### 4.2 ACL ward cần một nguồn server-side có thể kiểm tra

`config.publicPerms`, `config.grants`, `ownerEmail`, `acl` và `isAdmin()` hiện
được dùng để render UI. Chúng không tự tạo ra authorization server-side.
Rules chỉ có thể an toàn nếu quyền được biểu diễn bằng dữ liệu mà Rules kiểm
tra được, chẳng hạn:

- Firebase Auth custom claims cho vai trò hệ thống;
- membership/role được lưu theo UID ở một path ổn định;
- hoặc backend kiểm tra ACL rồi thực hiện thao tác thay client.

Email-key chỉ nên giữ cho đọc/migrate legacy, không nên là cơ chế identity mới.

### 4.3 Public receipts và survey responses phải là ngoại lệ hẹp

Hai flow public là ngoại lệ có chủ ý, nhưng nên được thiết kế theo kiểu
append/field-limited:

- public receipt: chỉ read snapshot đã đóng băng và một update rất hẹp cho
  payment request/hide option theo trạng thái hợp lệ;
- survey response: chỉ create response schema hợp lệ và counter được backend
  tính hoặc transaction có điều kiện.

Không nên mở write toàn bộ node public để làm cho UI hiện tại chạy được.

## 5. Thứ tự triển khai an toàn

1. **Xác nhận Rules hiện đang chạy trong Firebase Console.** Export hoặc ghi
   lại bản hiện tại trước khi thay đổi; repository chưa có bản chuẩn để so sánh.
2. **Đo production shape.** Kiểm tra các nhánh legacy còn được dùng, đặc biệt
   `secretdata` fallback, email-key, `collaborators`, receipts và survey.
3. **Tạo Rules versioned và emulator tests.** Bắt đầu với deny-by-default cho
   system/admin và UID personal; chưa khóa guest ward data cho đến khi chốt
   backend auth.
4. **Tách public config khỏi private config** hoặc dựng endpoint backend cho
   guest code. Đây là điều kiện trước khi tuyên bố access code được bảo mật.
5. **Thêm Storage Rules path-scoped.** Enforce UID/ward membership, read/write
   tách biệt, MIME/size, object path và delete policy.
6. **Chạy regression matrix.** Tối thiểu gồm signed-out, guest, pending,
   owner, editor, viewer, admin và super-admin cho từng path group.
7. **Chỉ deploy Rules sau khi staging test pass** và đã có phương án rollback.

## 6. Chưa được phép kết luận từ audit này

- Chưa thể khẳng định Rules production hiện đang mở hay khóa ở mức nào.
- Chưa thể viết một bộ Rules hoàn chỉnh mà không biết cấu trúc ACL/membership
  thực tế trong dữ liệu production.
- Chưa thể coi guest code là password bảo mật.
- Chưa thể đảm bảo revoke quyền sẽ thu hồi các Storage URL đã phát hành.
