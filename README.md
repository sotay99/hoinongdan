# quanlycongtachoinongdan

Nguồn chuẩn của ứng dụng tĩnh nằm trong `src/`: CSS ở `src/css/`, cấu hình
Firebase ở `src/js/firebase-init.js`, và ứng dụng chính được chia thành các
phần có thứ tự trong `src/js/app/manifest.json`.

Chỉ sửa các tệp nguồn trong `src/`; không sửa trực tiếp các tệp fingerprint đã
sinh trong `public/assets/`.

```sh
node scripts/build-static.js
node scripts/validate-static.js
```

Lệnh build ghép các phần JavaScript không thêm ký tự phân cách, tính fingerprint
SHA-256, cập nhật bốn tham chiếu local trong `index.html`, rồi sao chép HTML sang
`public/index.html` và `functions/index.html`. Firebase Hosting tự chạy build và
validation trong hook `predeploy`. Các asset fingerprint trong `public/assets/`
vẫn được theo dõi để checkout sạch có thể triển khai trước khi build.

Các thư viện xuất Excel/PowerPoint và đọc tài liệu Word được nạp theo yêu cầu khi
người dùng thực hiện chức năng tương ứng.
