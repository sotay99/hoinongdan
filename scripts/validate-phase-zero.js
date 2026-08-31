#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src");
const files = [
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
  ["personal/shared memory selector", /function\s+usingLocalNotes\s*\(/],
  ["local Super Notes migration", /function\s+migrateLocalSuperNotesToCloud\s*\(/],
  ["Drive Hub navigation", /function\s+renderDriveHubTab\s*\(/],
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
  ["Super Notes folder restore", /const ids = node\.type==='folder' \? \[id, \.\.\.snDescendantsOf\(id\)\] : \[id\]/],
];
const failures = checks.filter(([, pattern]) => !pattern.test(source)).map(([label]) => label);

if (/Báo cáo lãi/i.test(source)) failures.push('removed "Báo cáo lãi" phrase');
if (failures.length) {
  console.error(`Phase 0 readiness failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Phase 0 readiness passed: ${checks.length} foundation checks and legacy report removal.`);