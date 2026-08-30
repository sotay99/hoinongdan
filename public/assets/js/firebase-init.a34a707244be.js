
  /* =====================================================================
     CẤU HÌNH FIREBASE — THAY CÁC GIÁ TRỊ BÊN DƯỚI BẰNG THÔNG SỐ DỰ ÁN
     FIREBASE THẬT CỦA ĐỒNG CHÍ (lấy tại Firebase Console > Project settings
     > General > Your apps > SDK setup and configuration).
     Sau khi thay xong, toàn bộ dữ liệu "Sổ vay vốn / Chi tiêu Xã / Nhật ký /
     Thùng rác / Cộng tác viên" sẽ tự động lưu & đồng bộ realtime trên
     Firebase Realtime Database. Dữ liệu module "Thu – Chi nội bộ" KHÔNG
     dùng cấu hình này — xem phần LOCAL-ONLY STORAGE bên dưới.

     ĐỂ BẬT ĐĂNG NHẬP GOOGLE THẬT (bắt buộc cho phần Auth bên dưới hoạt động):
     1) Vào Firebase Console > Authentication > Sign-in method > bật "Google".
     2) Vào Authentication > Settings > Authorized domains > thêm đúng tên
        miền (domain) nơi đồng chí sẽ host file HTML này (vd: tên miền
        Netlify/GitHub Pages/website riêng). Thiếu bước này Google sẽ báo lỗi
        "auth/unauthorized-domain" khi bấm đăng nhập.
     3) Vai trò (Owner/Editor/Viewer) KHÔNG cấu hình ở đây — Owner là người
        dùng email Google đăng nhập đầu tiên để "Thiết lập cơ sở dữ liệu lõi"
        (thường là Chủ tịch Hội), còn Editor/Viewer do Owner tự thêm bằng
        đúng email Google của cấp dưới tại mục "Cài đặt & Chia sẻ" trong app.
  ===================================================================== */
  const firebaseConfig = {
    apiKey: "AIzaSyAzt664dL14cJJnvCx7WdRD7WuZtUkdZs0",
    authDomain: "congtachoinongdan.firebaseapp.com",
    databaseURL: "https://congtachoinongdan-default-rtdb.firebaseio.com",
    projectId: "congtachoinongdan",
    storageBucket: "congtachoinongdan.firebasestorage.app",
    messagingSenderId: "98189524222",
    appId: "1:98189524222:web:930e6897cced900b1a79af"
  };
  firebase.initializeApp(firebaseConfig);
  const rtdb = firebase.database();
  const auth = firebase.auth();
  const storage = firebase.storage(); // dùng cho Module "Huấn luyện AI" — lưu file gốc .docx/.xlsx/ảnh
  // Ép luôn hiện màn hình chọn tài khoản Google (tránh tự động đăng nhập lại
  // tài khoản Google gần nhất khi máy có nhiều tài khoản Google khác nhau).
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  // GHI NHỚ ĐĂNG NHẬP VĨNH VIỄN trên thiết bị (Local Persistence) — mặc định Firebase Auth JS SDK
  // đã dùng chế độ này, nhưng ta khai báo TƯỜNG MINH để chắc chắn tuyệt đối: chỉ cần đăng nhập
  // đúng 1 lần, tắt hẳn trình duyệt hay khởi động lại máy vẫn giữ nguyên phiên đăng nhập (lưu ở
  // IndexedDB/localStorage của trình duyệt) cho tới khi người dùng CHỦ ĐỘNG bấm "Đăng xuất".
  const authPersistenceReady = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(e => console.error('Không thiết lập được Local Persistence cho Firebase Auth (sẽ dùng mặc định của trình duyệt):', e));
