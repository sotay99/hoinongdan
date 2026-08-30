#!/usr/bin/env node

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "src/js/app/manifest.json");
const appSourceRoot = path.dirname(manifestPath);
const publicCssRoot = path.join(root, "public/assets/css");
const publicJsRoot = path.join(root, "public/assets/js");
const indexPath = path.join(root, "index.html");

function die(message) {
  console.error(`Static build failed: ${message}`);
  process.exit(1);
}

function readFile(filePath, description) {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    die(`${description} is missing or unreadable: ${path.relative(root, filePath)} (${error.message})`);
  }
}

function fingerprint(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

function loadManifest() {
  let manifest;
  try {
    manifest = JSON.parse(readFile(manifestPath, "App manifest").toString("utf8"));
  } catch (error) {
    die(`Malformed app manifest: ${error.message}`);
  }
  if (!Array.isArray(manifest) || manifest.length === 0) {
    die("Malformed app manifest: expected a non-empty JSON array");
  }
  if (manifest.some((entry) => typeof entry !== "string" || !entry || path.basename(entry) !== entry)) {
    die("Malformed app manifest: every entry must be a plain filename");
  }
  if (new Set(manifest).size !== manifest.length) {
    die("Malformed app manifest: duplicate entries are not allowed");
  }
  return manifest;
}

function cleanGenerated(directory, pattern) {
  fs.mkdirSync(directory, { recursive: true });
  for (const name of fs.readdirSync(directory)) {
    if (pattern.test(name)) fs.rmSync(path.join(directory, name));
  }
}

function replaceExactlyOnce(html, pattern, replacement, label) {
  const matches = html.match(pattern);
  if (!matches || matches.length !== 1) {
    die(`Expected exactly one ${label} reference in index.html, found ${matches ? matches.length : 0}`);
  }
  return html.replace(pattern, replacement);
}

const manifest = loadManifest();
const chunks = manifest.map((name) => readFile(path.join(appSourceRoot, name), `App chunk ${name}`));
const app = Buffer.concat(chunks);
const firebase = readFile(path.join(root, "src/js/firebase-init.js"), "Firebase source");
const baseCss = readFile(path.join(root, "src/css/base.css"), "Base CSS source");
const appCss = readFile(path.join(root, "src/css/app.css"), "App CSS source");

const outputs = {
  app: `app.${fingerprint(app)}.js`,
  firebase: `firebase-init.${fingerprint(firebase)}.js`,
  baseCss: `base.${fingerprint(baseCss)}.css`,
  appCss: `app.${fingerprint(appCss)}.css`,
};

cleanGenerated(publicJsRoot, /^(?:app|firebase-init)\.[a-f0-9]{12}\.js$/);
cleanGenerated(publicCssRoot, /^(?:app|base)\.[a-f0-9]{12}\.css$/);
fs.writeFileSync(path.join(publicJsRoot, outputs.app), app);
fs.writeFileSync(path.join(publicJsRoot, outputs.firebase), firebase);
fs.writeFileSync(path.join(publicCssRoot, outputs.baseCss), baseCss);
fs.writeFileSync(path.join(publicCssRoot, outputs.appCss), appCss);

let html = readFile(indexPath, "Root index").toString("utf8");
const localReferences = Array.from(
  html.matchAll(/<(?:link|script)\b[^>]*\b(?:href|src)\s*=\s*(["'])(.*?)\1[^>]*>/gi),
  (match) => match[2].trim(),
).filter((url) => url.startsWith("/"));
const expectedReferencePatterns = [
  /^\/assets\/js\/firebase-init\.[a-f0-9]{12}\.js$/,
  /^\/assets\/css\/base\.[a-f0-9]{12}\.css$/,
  /^\/assets\/css\/app\.[a-f0-9]{12}\.css$/,
  /^\/assets\/js\/app\.[a-f0-9]{12}\.js$/,
];
if (
  localReferences.length !== expectedReferencePatterns.length ||
  expectedReferencePatterns.some((pattern, index) => !pattern.test(localReferences[index] || ""))
) {
  die(`Expected exactly four local asset references in classic load order, found: ${localReferences.join(", ")}`);
}
html = replaceExactlyOnce(
  html,
  /\/assets\/js\/firebase-init\.[a-f0-9]{12}\.js/g,
  `/assets/js/${outputs.firebase}`,
  "Firebase",
);
html = replaceExactlyOnce(
  html,
  /\/assets\/css\/base\.[a-f0-9]{12}\.css/g,
  `/assets/css/${outputs.baseCss}`,
  "base CSS",
);
html = replaceExactlyOnce(
  html,
  /\/assets\/css\/app\.[a-f0-9]{12}\.css/g,
  `/assets/css/${outputs.appCss}`,
  "app CSS",
);
html = replaceExactlyOnce(
  html,
  /\/assets\/js\/app\.[a-f0-9]{12}\.js/g,
  `/assets/js/${outputs.app}`,
  "app",
);

const htmlBuffer = Buffer.from(html);
fs.writeFileSync(indexPath, htmlBuffer);
fs.writeFileSync(path.join(root, "public/index.html"), htmlBuffer);
fs.writeFileSync(path.join(root, "functions/index.html"), htmlBuffer);

console.log(`Static build complete: ${outputs.baseCss}, ${outputs.appCss}, ${outputs.firebase}, ${outputs.app}`);