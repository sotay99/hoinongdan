const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repo = path.join(__dirname, "..");
const indexPath = path.join(repo, "index.html");
let source = fs.readFileSync(indexPath, "utf8");
const before = source;

source = source.replace(/^[ \t]*items\.push\(\{id:'reports'.*?\r?\n?/m, "");
source = source.replace(/^[ \t]*else if\(state\.activeTab==='reports'\) renderReportsTab\(content\);.*?\r?\n?/m, "");
source = source.replace("Sổ Thu Chi Lãi Quỹ, Báo cáo lãi, Thùng rác", "Sổ Thu Chi Lãi Quỹ, Thùng rác");

const startMarker = "function renderReportsTab";
const endMarker = "function renderInternalTab";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start >= 0 && end > start) source = source.slice(0, start) + source.slice(end);

const subtitle = "            <div><h2>" + "${state.activeTab==='data'? 'Sổ vay vốn Quỹ Hỗ trợ Nông dân' : nav.find(n=>n.id===state.activeTab).label}" + "</h2></div>\n";
source = source.replace(/^[^\r\n]*wardTitle\(\)[^\r\n]*hộ vay đang theo dõi[^\r\n]*(?:\r?\n|$)/m, subtitle);

fs.writeFileSync(indexPath, source, "utf8");
fs.copyFileSync(indexPath, path.join(__dirname, "index.html"));
const publicDir = path.join(repo, "public");
fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(indexPath, path.join(publicDir, "index.html"));

if (source !== before) {
  execFileSync("git", ["config", "user.name", "github-actions[bot]"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], { cwd: repo });
  execFileSync("git", ["add", "index.html"], { cwd: repo, stdio: "inherit" });
  execFileSync("git", ["commit", "-m", "Remove redundant subtitle and interest report module"], { cwd: repo, stdio: "inherit" });
  execFileSync("git", ["push"], { cwd: repo, stdio: "inherit" });
  console.log("Applied index cleanup and pushed commit");
} else {
  console.log("Index cleanup already applied");
}
