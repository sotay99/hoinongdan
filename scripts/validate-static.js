#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { extractDesignSystemTheme } = require("./lib/design-system");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "index.html");
const hostingRoot = path.join(root, "public");
const publicIndexPath = path.join(hostingRoot, "index.html");
const functionsIndexPath = path.join(root, "functions/index.html");
const manifestPath = path.join(root, "src/js/app/manifest.json");
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function hash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    fail("src/js/app/manifest.json is missing");
    return [];
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`App manifest is malformed JSON: ${error.message}`);
    return [];
  }
  if (!Array.isArray(manifest) || manifest.length === 0) {
    fail("App manifest must be a non-empty array");
    return [];
  }
  if (manifest.some((entry) => typeof entry !== "string" || !entry || path.basename(entry) !== entry)) {
    fail("Every app manifest entry must be a plain filename");
    return [];
  }
  if (new Set(manifest).size !== manifest.length) {
    fail("App manifest contains duplicate entries");
    return [];
  }
  return manifest;
}

if (!fs.existsSync(indexPath)) {
  fail("index.html is missing");
}

const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
const references = [];
const tagPattern = /<(link|script)\b[^>]*\b(href|src)\s*=\s*(["'])(.*?)\3[^>]*>/gi;
let match;

while ((match = tagPattern.exec(html)) !== null) {
  const url = match[4].trim();
  if (!url || /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(url) || /^(?:data:|#)/i.test(url)) {
    continue;
  }

  if (!url.startsWith("/")) {
    fail(`Local asset URL must be root-relative: ${url}`);
    continue;
  }

  const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
  const relativePath = pathname.replace(/^\/+/, "");
  const resolvedPath = path.resolve(hostingRoot, relativePath);
  if (resolvedPath !== hostingRoot && !resolvedPath.startsWith(hostingRoot + path.sep)) {
    fail(`Local asset URL escapes the Firebase Hosting public directory: ${url}`);
    continue;
  }
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    fail(`Referenced local asset does not exist: ${url}`);
  } else {
    const extension = path.extname(resolvedPath);
    if (extension === ".css" || extension === ".js") {
      const hashPrefix = hash(fs.readFileSync(resolvedPath)).slice(0, 12);
      if (!path.basename(resolvedPath).endsWith(`.${hashPrefix}${extension}`)) {
        fail(`Referenced ${extension} asset lacks its SHA-256 filename prefix: ${url}`);
      }
    }
  }
  references.push({ url, resolvedPath });
}

// build-static.js chèn design-system.css NGAY TRƯỚC base.css và chỉ khi index.html
// chưa có sẵn tham chiếu đó. Bản kiểm tra phải phản ánh ĐÚNG cùng quy tắc, nếu không
// nó sẽ báo sai mỗi khi bản build hợp lệ có đủ 5 tham chiếu.
const designSystemPattern = /^\/assets\/css\/design-system\.[a-f0-9]{12}\.css$/;
const basePattern = /^\/assets\/css\/base\.[a-f0-9]{12}\.css$/;
const appCssPattern = /^\/assets\/css\/app\.[a-f0-9]{12}\.css$/;
const firebaseJsPattern = /^\/assets\/js\/firebase-init\.[a-f0-9]{12}\.js$/;
const appJsPattern = /^\/assets\/js\/app\.[a-f0-9]{12}\.js$/;
const hasDesignSystemReference = /\/assets\/css\/design-system(?:\.[a-f0-9]{12})?\.css/.test(html);
const expectedReferencePatterns = hasDesignSystemReference
  ? [designSystemPattern, basePattern, appCssPattern, firebaseJsPattern, appJsPattern]
  : [basePattern, appCssPattern, firebaseJsPattern, appJsPattern];
const actualReferences = references.map(({ url }) => url);
if (
  actualReferences.length !== expectedReferencePatterns.length ||
  expectedReferencePatterns.some((pattern, index) => !pattern.test(actualReferences[index] || ""))
) {
  fail(`Local asset order differs from the expected classic load order: ${actualReferences.join(", ")}`);
}

const optionalLibraryUrls = [
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
  "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
];
for (const url of optionalLibraryUrls) {
  if (new RegExp(`<script\\b[^>]*\\bsrc\\s*=\\s*["']${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i").test(html)) {
    fail(`Optional library must not be loaded by initial HTML: ${url}`);
  }
}
if (html.includes("cdnjs.cloudflare.com/ajax/libs/pptxgenjs/")) {
  fail("The obsolete PptxGenJS CDN URL is present");
}

const requiredDeferredScripts = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js",
  // Tra theo MẪU chứ không theo chỉ số cứng: thêm/bớt một stylesheet sẽ làm lệch
  // chỉ số và khiến bản kiểm tra tưởng nhầm một tệp CSS là script.
  actualReferences.find((url) => firebaseJsPattern.test(url)),
  actualReferences.find((url) => appJsPattern.test(url)),
].filter(Boolean);
for (const url of requiredDeferredScripts) {
  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const scriptTag = html.match(new RegExp(`<script\\b[^>]*\\bsrc\\s*=\\s*["']${escapedUrl}["'][^>]*>`, "i"));
  if (!scriptTag || !/\bdefer(?:\s*=\s*(?:["']?defer["']?|["']?true["']?))?/i.test(scriptTag[0])) {
    fail(`Firebase/application script is not deferred: ${url}`);
  }
}
const firstScriptPosition = html.search(/<script\b/i);
const firstStylesheetPosition = html.search(/<link\b[^>]*\brel\s*=\s*["']stylesheet["']/i);
if (firstScriptPosition < 0 || firstStylesheetPosition < 0 || firstStylesheetPosition > firstScriptPosition) {
  fail("Stylesheets must be discoverable before deferred scripts");
}

for (const inlineScript of html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
  if (inlineScript[1].trim()) fail("Substantive inline <script> content remains in index.html");
}
for (const inlineStyle of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
  if (inlineStyle[1].trim()) fail("Substantive inline <style> content remains in index.html");
}

if (fs.existsSync(publicIndexPath) && !fs.readFileSync(indexPath).equals(fs.readFileSync(publicIndexPath))) {
  fail("public/index.html does not exactly match root index.html");
}
if (fs.existsSync(functionsIndexPath) && !fs.readFileSync(indexPath).equals(fs.readFileSync(functionsIndexPath))) {
  fail("functions/index.html does not exactly match root index.html");
}

const canonicalByPattern = [
  { pattern: firebaseJsPattern, source: path.join(root, "src/js/firebase-init.js"), label: "Firebase" },
  { pattern: basePattern, source: path.join(root, "src/css/base.css"), label: "base CSS" },
  { pattern: appCssPattern, source: path.join(root, "src/css/app.css"), label: "app CSS" },
];
for (const { pattern, source, label } of canonicalByPattern) {
  const reference = references.find(({ url }) => pattern.test(url));
  if (!fs.existsSync(source)) {
    fail(`Canonical ${label} source is missing: ${path.relative(root, source)}`);
  } else if (reference && fs.existsSync(reference.resolvedPath)) {
    if (!fs.readFileSync(source).equals(fs.readFileSync(reference.resolvedPath))) {
      fail(`Generated ${label} does not exactly match its canonical source`);
    }
  }
}

// design-system.css là tệp ĐƯỢC SINH RA (chỉ gồm 2 khối token :root và .dark trích
// từ nguồn), nên phải so với KẾT QUẢ TRÍCH — dùng đúng module mà build-static.js dùng.
if (hasDesignSystemReference) {
  const designSystemSource = path.join(root, "src/css/design-system.css");
  const designSystemReference = references.find(({ url }) => designSystemPattern.test(url));
  if (!fs.existsSync(designSystemSource)) {
    fail("Canonical design system source is missing: src/css/design-system.css");
  } else {
    const expected = extractDesignSystemTheme(fs.readFileSync(designSystemSource));
    if (!expected) {
      fail("Design system stylesheet is missing its :root or .dark token blocks");
    } else if (designSystemReference && fs.existsSync(designSystemReference.resolvedPath)) {
      if (!expected.equals(fs.readFileSync(designSystemReference.resolvedPath))) {
        fail("Generated design system CSS does not match the tokens extracted from its source");
      }
    }
  }
}

const manifest = readManifest();
const chunkBuffers = [];
for (const entry of manifest) {
  const chunkPath = path.join(root, "src/js/app", entry);
  if (!fs.existsSync(chunkPath) || !fs.statSync(chunkPath).isFile()) {
    fail(`Manifest app chunk is missing: ${entry}`);
  } else {
    chunkBuffers.push(fs.readFileSync(chunkPath));
  }
}
const appReference = references.find(({ url }) => appJsPattern.test(url));
if (appReference && fs.existsSync(appReference.resolvedPath) && chunkBuffers.length === manifest.length) {
  if (!Buffer.concat(chunkBuffers).equals(fs.readFileSync(appReference.resolvedPath))) {
    fail("Generated app does not equal zero-separator manifest concatenation");
  }
}
const canonicalApp = Buffer.concat(chunkBuffers).toString("utf8");
const generatedApp =
  appReference && fs.existsSync(appReference.resolvedPath) ? fs.readFileSync(appReference.resolvedPath, "utf8") : "";
for (const url of optionalLibraryUrls) {
  if (!canonicalApp.includes(url)) fail(`Canonical app is missing pinned optional-library URL: ${url}`);
  if (!generatedApp.includes(url)) fail(`Generated app is missing pinned optional-library URL: ${url}`);
}
for (const guard of [
  /function\s+loadOptionalLibrary\s*\(/,
  /optionalLibraryPromises/,
  /ready:\(\)=>!!window\.XLSX/,
  /ready:\(\)=>!!window\.mammoth/,
  /ready:\(\)=>!!window\.PptxGenJS/,
]) {
  if (!guard.test(canonicalApp)) fail(`Canonical app is missing an optional-library loader guard: ${guard}`);
  if (!guard.test(generatedApp)) fail(`Generated app is missing an optional-library loader guard: ${guard}`);
}
for (const safeguard of [
  "Không thể đọc tệp Office",
  "TỆP GỐC ĐÃ ĐƯỢC LƯU NHƯNG KHÔNG TRÍCH XUẤT ĐƯỢC NỘI DUNG",
  "tệp khi kết nối mạng ổn định",
]) {
  if (!canonicalApp.includes(safeguard)) fail(`Canonical app is missing non-lossy Office safeguard: ${safeguard}`);
  if (!generatedApp.includes(safeguard)) fail(`Generated app is missing non-lossy Office safeguard: ${safeguard}`);
}

const assetRoot = path.join(hostingRoot, "assets");
const assetFiles = fs.existsSync(assetRoot) ? walk(assetRoot) : [];
const jsFiles = assetFiles.filter((file) => path.extname(file) === ".js");
for (const jsFile of jsFiles) {
  const checked = spawnSync(process.execPath, ["--check", jsFile], { encoding: "utf8" });
  if (checked.status !== 0) {
    fail(`${path.relative(root, jsFile)} failed node --check: ${(checked.stderr || checked.stdout).trim()}`);
  }
}

const builtSource = [
  html,
  ...references
    .filter(({ resolvedPath }) => fs.existsSync(resolvedPath))
    .map(({ resolvedPath }) => fs.readFileSync(resolvedPath, "utf8")),
].join("\n");
if (!builtSource.includes("Tổng số hộ vay đang theo dõi")) {
  fail('Required text "Tổng số hộ vay đang theo dõi" is absent from the built source');
}

const removedReportsMarkers = [
  /\bfunction\s+renderReports\s*\(/,
  /\bconst\s+renderReports\s*=/,
  /\bcase\s+["']reports["']\s*:/,
  /\bdata-page\s*=\s*["']reports["']/i,
  /\bid\s*=\s*["'](?:nav-)?reports["']/i,
];
for (const marker of removedReportsMarkers) {
  if (marker.test(builtSource)) fail(`Removed reports module marker is present: ${marker}`);
}

if (failures.length) {
  console.error("Static validation failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Static validation passed: ${references.length} local references, ${jsFiles.length} JavaScript files.`);