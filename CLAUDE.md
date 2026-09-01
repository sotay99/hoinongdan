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
```

`validate-drive-contract.js` và `validate-phase-zero.js` là "hợp đồng bằng
regex" — chúng chỉ kiểm tra một đoạn mã CÓ MẶT, không kiểm tra nó chạy đúng.
Đổi tên hàm hoặc sửa câu chữ tiếng Việt sẽ làm chúng đỏ; khi đó cập nhật lại
mẫu trong chính tệp kiểm tra, đừng xoá mục đi cho xanh.

## Quy trình làm việc — QUAN TRỌNG

### Không bao giờ hỏi về gộp nhánh và deploy

Mặc định là **CHƯA ĐƯỢC PHÉP** gộp lên `main` và deploy. Không hỏi
"có gộp không?", không đề nghị, không nhắc. Người dùng sẽ chủ động nói khi
nào muốn gộp. Chỉ gộp khi họ nói ra bằng lời, trong đúng phiên đó.

Kết thúc một tính năng thì dừng ở nhánh phụ và đưa link xem trước. Không
kèm câu hỏi về việc gộp.

### Cách bàn giao một tính năng đã xong

Làm trên nhánh phụ, đẩy lên, rồi báo ngắn gọn:

> Đây là link xem trước: https://congtachoinongdan--<tên-nhánh>-<mã>.web.app

Không cần giải thích dài dòng về cơ chế xem trước — người dùng đã hiểu rồi.

### Bản xem trước

Mỗi nhánh không phải `main` khi được đẩy lên sẽ tự sinh một Firebase Hosting
channel riêng (`.github/workflows/preview.yml`). Địa chỉ sinh ra từ tên nhánh
nên GIỮ NGUYÊN qua mọi lần đẩy của cùng nhánh đó; mỗi lần đẩy làm mới nội dung
và gia hạn thêm 7 ngày.

Mỗi nhánh chỉ chứa thay đổi của chính nó. Muốn xem nhiều tính năng cùng lúc
trên một trang thì phải tạo một nhánh gộp chứa cả chúng — nhánh đó có địa chỉ
xem trước riêng.

Trên bản xem trước không đăng nhập Google được (tên miền chưa được khai báo
trong Firebase Auth). Dùng nút "Môi trường tham quan" ở màn hình đầu để vào
xem với dữ liệu mẫu.

Bản xem trước chỉ có hosting, không có Cloud Function. Đường dẫn `/bienlai/**`
trên đó vẫn chạy function của production.

### Khi được cho phép gộp

Đẩy lên `main` là deploy thẳng ra production cho người dùng thật. Sau khi gộp,
theo dõi GitHub Actions tới khi có kết quả cuối và báo lại kết quả thật.

Nếu phát hiện lỗi sau khi deploy: `git revert` commit gộp rồi đẩy lên `main`,
Actions sẽ tự deploy lại bản cũ. Không dùng nút rollback trong Firebase Console
— nó chỉ đổi trang thật mà không đổi kho, khiến `main` và production lệch nhau.

### Các điểm khác

- Không tạo Pull Request trừ khi được yêu cầu.
- Xoá nhánh: môi trường chặn ở tầng chứng chỉ git (`git push --delete` trả về
  HTTP 403), bộ công cụ GitHub cũng không có hàm xoá nhánh. Người dùng phải tự
  xoá tại https://github.com/sotay99/hoinongdan/branches. Đừng hứa sẽ xoá.
- Không tự kiểm chứng được trang thật: proxy của môi trường chặn
  `hoinongdan.sotay.org` và cả `*.web.app`. Bằng chứng chỉ có thể lấy từ log
  Firebase; việc bấm thử phải nhờ người dùng.

## Ngôn ngữ

Người dùng trao đổi bằng tiếng Việt; trả lời bằng tiếng Việt. Chú thích mã
nguồn và thông báo giao diện đều bằng tiếng Việt — giữ nguyên quy ước đó.
