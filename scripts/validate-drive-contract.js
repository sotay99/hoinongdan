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
requireText(css, /\.drive-comments\s*\{/, "comment thread styles");
requireText(css, /\.drive-share-add\s*\{/, "share modal styles");
requireText(css, /\.drive-file-viewer\s*\{/, "file viewer styles");
if (!manifest.includes("15-drive-hub.js")) failures.push("Drive Hub chunk missing from app manifest");

if (failures.length) {
  console.error(`Drive contract validation failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Drive contract validation passed: routes, ACL, comments, Tour guard, private local storage, upload, and viewer.");