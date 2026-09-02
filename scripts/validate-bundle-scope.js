#!/usr/bin/env node

"use strict";

// KIỂM TRA CẤU TRÚC BẢN NỐI — thứ mà các "hợp đồng bằng regex" (validate-drive-contract.js
// và validate-phase-zero.js) KHÔNG BAO GIỜ bắt được.
//
// Bối cảnh: cả 15 phần trong manifest.json được nối lại KHÔNG có ký tự phân cách, tạo
// thành MỘT hàm bọc (IIFE) duy nhất. Mọi phần dùng chung `state`, `render`, `escapeHtml`...
// nhờ nằm chung trong hàm bọc đó. Đã từng xảy ra sự cố: dấu đóng IIFE nằm ở cuối phần 14,
// khiến toàn bộ phần 15 (Drive Hub) rơi ra phạm vi toàn cục và ném ReferenceError ngay khi
// người dùng bấm vào 4 module. Cả hai script kiểm tra kia vẫn báo xanh, vì các hàm cần tìm
// đều "có mặt" — chỉ là chúng không chạy được. Tệp này canh đúng lớp lỗi đó.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const appSourceRoot = path.join(root, "src/js/app");
const manifestPath = path.join(appSourceRoot, "manifest.json");
const failures = [];

function fail(message) {
  failures.push(message);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const firstChunk = manifest[0];
const lastChunk = manifest[manifest.length - 1];

// ---------------------------------------------------------------------------
// 1) Ranh giới giữa các phần: vì nối KHÔNG có ký tự phân cách, một phần không
//    kết thúc bằng xuống dòng sẽ dính liền vào dòng đầu của phần kế tiếp.
// ---------------------------------------------------------------------------
const chunks = [];
manifest.forEach((name, index) => {
  const chunkPath = path.join(appSourceRoot, name);
  if (!fs.existsSync(chunkPath)) {
    fail(`Thiếu phần khai báo trong manifest: ${name}`);
    return;
  }
  const buffer = fs.readFileSync(chunkPath);
  chunks.push({ name, buffer, isLast: index === manifest.length - 1 });
  if (buffer.length && buffer[buffer.length - 1] !== 0x0a) {
    fail(
      `${name} không kết thúc bằng ký tự xuống dòng — khi nối không có dấu phân cách, ` +
        `dòng cuối của phần này sẽ dính vào dòng đầu của phần kế tiếp`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2) Bản nối phải hợp lệ về cú pháp (bắt lỗi dính dòng ở ranh giới).
// ---------------------------------------------------------------------------
const bundle = Buffer.concat(chunks.map((chunk) => chunk.buffer));
const bundleText = bundle.toString("utf8");
const bundlePath = path.join(root, "public/assets/js/.bundle-scope-check.js");
fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
fs.writeFileSync(bundlePath, bundle);
const checked = spawnSync(process.execPath, ["--check", bundlePath], { encoding: "utf8" });
fs.rmSync(bundlePath, { force: true });
if (checked.status !== 0) {
  fail(`Bản nối 15 phần không hợp lệ về cú pháp: ${(checked.stderr || checked.stdout).trim()}`);
}

// ---------------------------------------------------------------------------
// 3) Hàm bọc phải mở ở phần ĐẦU TIÊN và đóng ở phần CUỐI CÙNG của manifest.
// ---------------------------------------------------------------------------
function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

const OPEN = /^\(function\(\)\{/gm;
const CLOSE = /^\}\)\(\);?$/gm;

const opens = countMatches(bundleText, OPEN);
const closes = countMatches(bundleText, CLOSE);
if (opens !== 1) fail(`Bản nối phải có ĐÚNG 1 hàm bọc mở ở đầu dòng, đang thấy ${opens}`);
if (closes !== 1) fail(`Bản nối phải có ĐÚNG 1 dấu đóng hàm bọc ở đầu dòng, đang thấy ${closes}`);

const firstText = fs.existsSync(path.join(appSourceRoot, firstChunk))
  ? fs.readFileSync(path.join(appSourceRoot, firstChunk), "utf8")
  : "";
const lastText = fs.existsSync(path.join(appSourceRoot, lastChunk))
  ? fs.readFileSync(path.join(appSourceRoot, lastChunk), "utf8")
  : "";

if (countMatches(firstText, OPEN) !== 1) {
  fail(`Hàm bọc phải được MỞ trong phần đầu tiên của manifest (${firstChunk})`);
}
if (countMatches(lastText, CLOSE) !== 1) {
  fail(
    `Hàm bọc phải được ĐÓNG trong phần cuối cùng của manifest (${lastChunk}). ` +
      `Nếu vừa thêm một phần mới vào cuối manifest, hãy chuyển khối khởi động boot() ` +
      `cùng dấu "})();" xuống cuối phần đó — nếu không, phần mới sẽ không truy cập được ` +
      `state/render/escapeHtml và sẽ ném ReferenceError khi chạy`,
  );
}

// ---------------------------------------------------------------------------
// 4) Điểm khởi động phải nằm TRONG hàm bọc và SAU mọi khai báo của phần cuối,
//    nếu không các biến let/const của phần cuối còn trong "vùng chết tạm thời".
// ---------------------------------------------------------------------------
const bootMatches = Array.from(bundleText.matchAll(/^\s*boot\(\);/gm), (m) => m.index);
if (bootMatches.length !== 1) {
  fail(`Bản nối phải gọi boot() đúng 1 lần, đang thấy ${bootMatches.length}`);
} else {
  const openIndex = bundleText.search(/^\(function\(\)\{/m);
  const closeIndex = bundleText.search(/^\}\)\(\);?$/m);
  const bootIndex = bootMatches[0];
  if (!(openIndex < bootIndex && bootIndex < closeIndex)) {
    fail("Lời gọi boot() phải nằm bên trong hàm bọc");
  }
  const lastDeclaration = Array.from(lastText.matchAll(/^\s{0,4}(?:const|let)\s+[A-Za-z_$]/gm)).pop();
  if (lastDeclaration) {
    const lastChunkStart = bundleText.length - lastText.length;
    if (bootIndex < lastChunkStart + lastDeclaration.index) {
      fail(
        `boot() chạy TRƯỚC một khai báo let/const trong ${lastChunk} — các biến đó còn nằm ` +
          `trong vùng chết tạm thời và sẽ ném "Cannot access before initialization"`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 5) CHẠY THẬT bản nối trong một trình duyệt giả lập tối thiểu.
//    Bốn mục trên chỉ ĐỌC mã: chúng xác nhận bản nối phân tích được cú pháp và
//    boot() đứng đúng chỗ, nhưng KHÔNG phát hiện được lỗi chỉ lộ ra lúc chạy.
//    Lỗi thật đã xảy ra: một hằng ở TẦNG NGOÀI CÙNG (VD PROJECT_EXPORT_COLS ở
//    phần 04) gọi tới hàm đọc `state` — hằng tầng ngoài chạy NGAY khi nạp phần
//    04, trong khi `state` mãi phần 05 mới khai báo. Kết quả là
//    "Cannot access 'state' before initialization", hàm bọc chết ngay, trang
//    trắng xoá — mà cả 4 mục trên vẫn báo xanh.
//    Vì vậy: nạp bản nối một lần, nếu nó ném lỗi thì chặn ngay tại đây.
// ---------------------------------------------------------------------------
if (!failures.length) {
  const vm = require("vm");
  const noop = () => {};
  const chainable = new Proxy(function () {}, {
    get: (target, prop) => (prop === "then" ? undefined : chainable),
    apply: () => chainable,
    construct: () => chainable,
  });
  const el = () => ({
    style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, removeChild: noop, remove: noop, addEventListener: noop, removeEventListener: noop,
    setAttribute: noop, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [],
    insertBefore: noop, focus: noop, click: noop, closest: () => null, getBoundingClientRect: () => ({}),
    innerHTML: "", textContent: "", value: "", children: [],
  });
  const documentStub = {
    ...el(), body: el(), documentElement: el(), head: el(),
    getElementById: () => el(), createElement: el, createTextNode: el,
    addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [], scrollingElement: el(), activeElement: null,
  };
  const sandbox = {
    console: { log: noop, warn: noop, error: noop, info: noop },
    document: documentStub,
    location: { href: "https://example.test/", pathname: "/", search: "", hash: "", origin: "https://example.test" },
    history: { pushState: noop, replaceState: noop },
    navigator: { userAgent: "node", language: "vi", clipboard: {} },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop, clear: noop },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop, clear: noop },
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    fetch: () => new Promise(noop), alert: noop, confirm: () => false, prompt: () => null,
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    MutationObserver: function () { return { observe: noop, disconnect: noop, takeRecords: () => [] }; },
    ResizeObserver: function () { return { observe: noop, disconnect: noop, unobserve: noop }; },
    IntersectionObserver: function () { return { observe: noop, disconnect: noop, unobserve: noop }; },
    URL: URL, URLSearchParams: URLSearchParams, Blob: function () {}, FileReader: function () { return { readAsText: noop }; },
    Image: function () { return {}; }, Audio: function () { return { play: noop }; },
    btoa: (x) => Buffer.from(String(x), 'binary').toString('base64'),
    atob: (x) => Buffer.from(String(x), 'base64').toString('binary'),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000', getRandomValues: (a) => a },
    performance: { now: () => 0 },
    Element: Object.assign(function () {}, { prototype: { remove: noop } }), HTMLElement: function () {}, Node: function () {}, Event: function () {},
    CustomEvent: function () {}, DOMParser: function () { return { parseFromString: () => documentStub }; },
    XMLHttpRequest: function () { return { open: noop, send: noop, setRequestHeader: noop }; },
    speechSynthesis: { speak: noop, cancel: noop, getVoices: () => [] },
    innerWidth: 1280, innerHeight: 800, pageYOffset: 0, scrollTo: noop, scrollBy: noop,
    addEventListener: noop, removeEventListener: noop, getComputedStyle: () => ({}),
    // Hạ tầng do các tệp KHÁC index.html cung cấp — bản nối chỉ dùng chứ không tạo ra.
    rtdb: chainable, auth: chainable, storage: chainable, googleProvider: {},
    firebase: chainable, authPersistenceReady: Promise.resolve(),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  // boot() thường được gọi trong một microtask (authPersistenceReady.then / onAuthStateChanged)
  // nên lỗi ở đó KHÔNG rơi vào try/catch đồng bộ — phải hứng riêng.
  const asyncErrors = [];
  const onUncaught = (e) => asyncErrors.push(e);
  process.on("uncaughtException", onUncaught);
  process.on("unhandledRejection", onUncaught);
  try {
    vm.runInNewContext(bundleText, vm.createContext(sandbox), { filename: "app.bundle.js", timeout: 15000 });
  } catch (error) {
    fail(
      `Bản nối NÉM LỖI ngay khi nạp: ${error && error.message}\n` +
        `  Đây đúng là lỗi làm TRẮNG TRANG. Hay gặp nhất: một hằng ở tầng ngoài cùng ` +
        `(const/let thụt 2 dấu cách) gọi tới hàm có đọc \`state\` hoặc \`state.config\`. ` +
        `Hằng tầng ngoài chạy ngay lúc nạp phần đó, còn \`state\` mãi phần 05 mới khai báo. ` +
        `Cách sửa: đổi hằng ấy thành HÀM để nhãn được tính lúc gọi.`,
    );
  }
  setTimeout(() => {
    process.off("uncaughtException", onUncaught);
    process.off("unhandledRejection", onUncaught);
    for (const e of asyncErrors) {
      fail(`Bản nối NÉM LỖI trong lúc khởi động (boot): ${(e && e.message) || e}`);
    }
  }, 20);
}

function report() {
  if (failures.length) {
    console.error("Kiểm tra cấu trúc bản nối THẤT BẠI:");
    failures.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }
  console.log(
    `Kiểm tra cấu trúc bản nối ĐẠT: ${manifest.length} phần nằm trong 1 hàm bọc, ` +
      `mở ở ${firstChunk}, đóng ở ${lastChunk}, boot() ở đúng vị trí cuối, ` +
      `và bản nối CHẠY được tới hết boot() mà không ném lỗi.`,
  );
}
// Chờ vài nhịp cho microtask (boot chạy trong .then) rồi mới kết luận.
setTimeout(report, 50);
