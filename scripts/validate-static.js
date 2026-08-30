#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "index.html");
const hostingRoot = path.join(root, "public");
const publicIndexPath = path.join(hostingRoot, "index.html");
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
      const hashPrefix = require("crypto")
        .createHash("sha256")
        .update(fs.readFileSync(resolvedPath))
        .digest("hex")
        .slice(0, 12);
      if (!path.basename(resolvedPath).endsWith(`.${hashPrefix}${extension}`)) {
        fail(`Referenced ${extension} asset lacks its SHA-256 filename prefix: ${url}`);
      }
    }
  }
  references.push({ url, resolvedPath });
}

const expectedReferences = [
  "/assets/js/firebase-init.a34a707244be.js",
  "/assets/css/base.190140e02164.css",
  "/assets/css/app.aee850a6122c.css",
  "/assets/js/app.0e4a824be53f.js",
];
const actualReferences = references.map(({ url }) => url);
if (JSON.stringify(actualReferences) !== JSON.stringify(expectedReferences)) {
  fail(`Local asset order differs from the expected classic load order: ${actualReferences.join(", ")}`);
}

const pptxScriptUrl =
  "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
if (!html.includes(`<script src="${pptxScriptUrl}"></script>`)) {
  fail("The pinned PptxGenJS browser bundle is missing or has changed");
}
if (html.includes("cdnjs.cloudflare.com/ajax/libs/pptxgenjs/")) {
  fail("The obsolete PptxGenJS CDN URL is present");
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

const assetRoot = path.join(hostingRoot, "assets");
const assetFiles = fs.existsSync(assetRoot) ? walk(assetRoot) : [];
const jsFiles = assetFiles.filter((file) => path.extname(file) === ".js");
for (const jsFile of jsFiles) {
  const checked = spawnSync(process.execPath, ["--check", jsFile], { encoding: "utf8" });
  if (checked.status !== 0) {
    fail(`${path.relative(root, jsFile)} failed node --check: ${(checked.stderr || checked.stdout).trim()}`);
  }
}

const builtSource = [html, ...assetFiles.map((file) => fs.readFileSync(file, "utf8"))].join("\n");
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

const referencedPaths = new Set(references.map(({ resolvedPath }) => resolvedPath));
for (const expected of expectedReferences) {
  const expectedPath = path.resolve(hostingRoot, expected.replace(/^\/+/, ""));
  if (!referencedPaths.has(expectedPath)) fail(`Expected asset is not referenced by index.html: ${expected}`);
}

if (failures.length) {
  console.error("Static validation failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Static validation passed: ${references.length} local references, ${jsFiles.length} JavaScript files.`);