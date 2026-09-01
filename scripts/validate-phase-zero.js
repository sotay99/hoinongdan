#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src");
const files = [
  "js/app/03-cloud-storage.js",
  "js/app/05-state-permissions.js",
  "js/app/07-core-modules.js",
  "js/app/09-ai-chat-notes.js",
  "js/app/14-accounting-settings-bootstrap.js",
  "js/app/15-drive-hub.js",
];
const source = files.map((file) => fs.readFileSync(path.join(sourceRoot, file), "utf8")).join("\n");
const checks = [
  ["explicit access modes", /const\s+ACCESS_MODES\s*=\s*Object\.freeze/],
  ["Tour mutation guard", /function\s+blockTourMutation\s*\(/],
  ["Drive Hub navigation", /function\s+renderDriveHubTab\s*\(/],
  // Ba mục dưới đây thay cho "personal/shared memory selector", "local Super Notes migration"
  // và "Super Notes folder restore" đã bị gỡ: Ghi chú nhanh không còn cây thư mục lẫn hai
  // không gian lưu trữ riêng, nên những tính năng ấy không còn tồn tại để mà kiểm tra.
  // Thay vào đó ghim đúng hành vi mới: ghi chú được lưu vào Trung tâm dữ liệu, Bộ cá nhân.
  ["Ghi chú nhanh lưu vào Trung tâm dữ liệu", /async function\s+driveSaveQuickNote\s*\(/],
  ["tự tạo thư mục Ghi chú nhanh", /async function\s+driveEnsureQuickNoteFolder\s*\(/],
  ["khoá tài khoản dùng chung cho kho cá nhân", /function\s+accountStorageKey\s*\(/],
  ["Quick Note bridge", /function\s+driveOpenQuickNote\s*\(/],
  ["resource URLs", /function\s+driveRoute\s*\(/],
  ["resource ACL", /function\s+drivePermissionForNode\s*\(/],
  ["sharing modal", /function\s+renderDriveShareModal\s*\(/],
  ["comment thread", /function\s+driveAddComment\s*\(/],
  ["kept loan-house statistic", /Tổng số hộ vay đang theo dõi/],
  ["public survey load states", /surveyLoadState\s*=\s*'loading'/],
  ["public survey retry action", /id="ps-retry-btn"/],
  ["public survey reload helper", /async function\s+loadSurvey\s*\(/],
  ["borrower edit project selection", /if\(!isNew && !state\.modal\.projectId\)/],
  ["borrower project reassignment persistence", /projectId:\s*curProject\.id/],
  ["borrower project change audit", /compareKeysB\s*=\s*\['projectId'/],
  ["Super Notes draft capture", /state\._snDraftText\s*=\s*draftInput\.value/],
  ["Super Notes draft restore", /id="sn-input"[\s\S]*state\._snDraftText/],
  ["Super Notes failed-input restore", /state\.superNotesPendingFiles\s*=\s*\(state\._snInFlightFiles\|\|\[\]\)\.slice\(\)/],
];
const failures = checks.filter(([, pattern]) => !pattern.test(source)).map(([label]) => label);

if (/Báo cáo lãi/i.test(source)) failures.push('removed "Báo cáo lãi" phrase');
if (failures.length) {
  console.error(`Phase 0 readiness failed:\n- ${failures.join("\n- ")}\n\nGHI CHÚ: đây là "hợp đồng bằng regex" — nó chỉ kiểm tra sự CÓ MẶT của một đoạn mã,\nKHÔNG kiểm tra đoạn mã đó có chạy đúng hay không. Khi một mục thất bại, hãy tự hỏi:\n  • Vừa đổi tên hàm / sửa câu chữ tiếng Việt? -> cập nhật lại mẫu trong tệp kiểm tra này.\n  • Vừa xoá thật tính năng đó? -> xoá mục tương ứng và ghi rõ lý do trong commit.\nNgược lại, script này báo ĐẠT KHÔNG có nghĩa là ứng dụng chạy được: kiểm tra phạm vi\nbiến và cấu trúc bản nối nằm ở scripts/validate-bundle-scope.js.`);
  process.exit(1);
}

console.log(`Phase 0 readiness passed: ${checks.length} foundation checks and legacy report removal.`);