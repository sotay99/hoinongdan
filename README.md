# quanlycongtachoinongdan

Nguồn chuẩn của ứng dụng tĩnh nằm trong `src/`: CSS ở `src/css/`, cấu hình
Firebase ở `src/js/firebase-init.js`, và ứng dụng chính được chia thành các
phần có thứ tự trong `src/js/app/manifest.json`.

Chỉ sửa các tệp nguồn trong `src/`; không sửa trực tiếp các tệp fingerprint đã
sinh trong `public/assets/`.

```sh
node scripts/build-static.js
node scripts/validate-bundle-scope.js
node scripts/validate-static.js
node scripts/validate-drive-contract.js
node scripts/validate-phase-zero.js
```

Lệnh build ghép các phần JavaScript không thêm ký tự phân cách, tính fingerprint
SHA-256, cập nhật năm tham chiếu local trong `index.html`, rồi sao chép HTML sang
`public/index.html` và `functions/index.html`. Firebase Hosting tự chạy build và
toàn bộ validation trong hook `predeploy`.

Thư mục `public/` KHÔNG được theo dõi trong git — nó hoàn toàn do build sinh ra.
Vì vậy phải chạy `node scripts/build-static.js` trước khi phục vụ tệp tĩnh tại
máy; khi deploy thì hook `predeploy` đã tự lo việc này.

Toàn bộ mã ứng dụng nằm trong MỘT hàm bọc (IIFE) duy nhất: mở ở
`01-foundation.js` và đóng ở cuối phần cuối cùng trong `manifest.json`. Khi thêm
một phần mới vào cuối manifest, phải chuyển khối khởi động (`boot()`) cùng dấu
đóng IIFE xuống cuối phần đó, nếu không phần mới sẽ không truy cập được `state`
và các hàm dùng chung. `scripts/validate-bundle-scope.js` canh đúng lỗi này.

Lưu ý về các script kiểm tra: `validate-drive-contract.js` và
`validate-phase-zero.js` là "hợp đồng bằng regex" — chúng chỉ xác nhận một đoạn
mã CÓ MẶT, không xác nhận nó chạy đúng. Đổi tên hàm hoặc sửa câu chữ tiếng Việt
sẽ làm chúng đỏ; khi đó hãy cập nhật lại mẫu trong chính tệp kiểm tra. Việc kiểm
tra cấu trúc và phạm vi biến thuộc về `validate-bundle-scope.js`.

Các thư viện xuất Excel/PowerPoint và đọc tài liệu Word được nạp theo yêu cầu khi
người dùng thực hiện chức năng tương ứng.
