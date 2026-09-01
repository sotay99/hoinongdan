#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "src/js/app/15-drive-hub.js");
const cssPath = path.join(root, "src/css/app.css");
const manifestPath = path.join(root, "src/js/app/manifest.json");
const source = fs.readFileSync(sourcePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];

function requireText(text, pattern, label) {
  if (!pattern.test(text)) failures.push(label);
}

requireText(source, /function\s+driveRoute\s*\(/, "resource URL route parser");
requireText(source, /pathname\.match\([^;]*file\|folder/, "file/folder route patterns");
requireText(source, /function\s+driveLoadRouteData\s*\(/, "authorized resource loader");
requireText(source, /permission!=='none'/, "resource visibility permission guard");
requireText(source, /viewer:\{label:'Viewer/, "Viewer permission");
requireText(source, /commenter:\{label:'Commenter/, "Commenter permission");
requireText(source, /editor:\{label:'Editor/, "Editor permission");
requireText(source, /function\s+drivePermissionForNode\s*\(/, "inherited permission resolver");
requireText(source, /function\s+driveCanComment\s*\(/, "comment permission guard");
requireText(source, /function\s+driveAddComment\s*\(/, "comment writer");
requireText(source, /function\s+driveDeleteComment\s*\(/, "comment deletion guard");
requireText(source, /drive_resources.*comments/, "Firebase comment branch");
requireText(source, /blockTourMutation\(/, "Tour mutation guard");
requireText(source, /function\s+driveShareModal|function\s+renderDriveShareModal\s*\(/, "share modal");
requireText(source, /navigator\.clipboard\.writeText/, "resource URL copy action");
requireText(source, /DRIVE_LOCAL_STORAGE_KEY/, "private local browser storage");
requireText(source, /function\s+driveIsLocalPersonal\s*\(/, "local-only personal scope guard");
requireText(source, /function\s+driveMigrateLocal\s*\(/, "local-to-Firebase migration");
requireText(source, /storageScope:'local'/, "local resource scope marker");
requireText(source, /function\s+driveCreateFile\s*\(/, "file upload action");
requireText(source, /function\s+drivePopulateFileViewer\s*\(/, "read-only file viewer");
requireText(source, /function\s+driveOpenOfficeApp\s*\(/, "office placeholder action");
requireText(source, /drive-office-placeholder/, "office placeholder screen");
requireText(source, /kind==='pptx'/, "PowerPoint read-only preview");
requireText(source, /driveLoading|driveLoadError/, "Hub loading/error state");
requireText(source, /id="drive-retry"/, "Hub retry action");
requireText(source, /DRIVE_QUICK_DRAFT_KEY/, "durable Quick Note draft");
requireText(source, /driveLoadQuickDraft\s*\(/, "Quick Note draft restore");
requireText(source, /driveDescendantIds\(parentId\)/, "recursive Hub search");
requireText(source, /driveIsLocalPersonal\(\)[\s\S]*state\.driveResources\s*=\s*driveLocalTree\(\)/, "local resource hydration");
requireText(source, /route\.space==='personal'[\s\S]*return driveLocalTree\(\)/, "local resource route");
requireText(source, /const conflicts=nodes\.filter/, "migration conflict guard");
requireText(source, /Không thể lưu tài nguyên lên máy chủ/, "cloud write error message");
requireText(source, /nextSearch\.focus\(\)/, "search focus restoration");
requireText(css, /\.drive-comments\s*\{/, "comment thread styles");
requireText(css, /\.drive-share-add\s*\{/, "share modal styles");
requireText(css, /\.drive-file-viewer\s*\{/, "file viewer styles");
requireText(css, /\.drive-viewer-slides\s*\{/, "PowerPoint preview styles");
requireText(css, /\.drive-state\s*\{/, "Hub loading/error styles");
requireText(css, /\.drive-route-error\s*\{/, "resource route error styles");
requireText(css, /prefers-reduced-motion/, "reduced motion styles");
if (!manifest.includes("15-drive-hub.js")) failures.push("Drive Hub chunk missing from app manifest");

if (failures.length) {
  console.error(`Drive contract validation failed:\n- ${failures.join("\n- ")}\n\nGHI CHÚ: đây là "hợp đồng bằng regex" — nó chỉ kiểm tra sự CÓ MẶT của một đoạn mã,\nKHÔNG kiểm tra đoạn mã đó có chạy đúng hay không. Khi một mục thất bại, hãy tự hỏi:\n  • Vừa đổi tên hàm / sửa câu chữ tiếng Việt? -> cập nhật lại mẫu trong tệp kiểm tra này.\n  • Vừa xoá thật tính năng đó? -> xoá mục tương ứng và ghi rõ lý do trong commit.\nNgược lại, script này báo ĐẠT KHÔNG có nghĩa là ứng dụng chạy được: kiểm tra phạm vi\nbiến và cấu trúc bản nối nằm ở scripts/validate-bundle-scope.js.`);
  process.exit(1);
}

console.log("Drive contract validation passed: routes, ACL, comments, Tour guard, private local storage, upload, and viewer.");