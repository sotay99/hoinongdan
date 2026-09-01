# Quy ước làm việc

## Kiến trúc — đọc trước khi sửa

Toàn bộ mã ứng dụng nằm trong MỘT hàm bọc (IIFE): mở ở `01-foundation.js`,
đóng ở cuối phần CUỐI CÙNG trong `src/js/app/manifest.json`. Khi thêm phần
mới vào cuối manifest, phải chuyển khối khởi động `boot()` cùng dấu `})();`
xuống cuối phần đó. Bỏ qua bước này thì phần mới không truy cập được
`state`, `render`, `escapeHtml` và sẽ ném ReferenceError khi chạy.
`scripts/validate-bundle-scope.js` canh lỗi này.

Thư mục `public/` do build sinh ra, không được theo dõi trong git.

## Trước khi đẩy code

Chạy đủ và phải xanh hết:

```sh
node scripts/build-static.js
node scripts/validate-bundle-scope.js
node scripts/validate-static.js
node scripts/validate-drive-contract.js
node scripts/validate-phase-zero.js
