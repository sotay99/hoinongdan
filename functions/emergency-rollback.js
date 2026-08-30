const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

(async () => {
  const repo = path.join(__dirname, "..");
  const url = "https://raw.githubusercontent.com/sotay99/hoinongdan/6612521b7ea1052364db74b72b8368f5118e73f1/index.html";
  const response = await fetch(url);
  if (!response.ok) throw new Error("Rollback source fetch failed: " + response.status);
  const stable = await response.text();
  if (!stable.includes("function renderReportsTab") || stable.length < 2000000) throw new Error("Rollback source validation failed");
  const rootIndex = path.join(repo, "index.html");
  fs.writeFileSync(rootIndex, stable, "utf8");
  fs.mkdirSync(path.join(repo, "public"), { recursive: true });
  fs.writeFileSync(path.join(repo, "public", "index.html"), stable, "utf8");
  fs.writeFileSync(path.join(__dirname, "index.html"), stable, "utf8");

  const packagePath = path.join(__dirname, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  if (pkg.scripts) {
    delete pkg.scripts.preinstall;
    if (Object.keys(pkg.scripts).length === 0) delete pkg.scripts;
  }
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

  execFileSync("git", ["config", "user.name", "github-actions[bot]"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], { cwd: repo });
  execFileSync("git", ["add", "index.html"], { cwd: repo, stdio: "inherit" });
  execFileSync("git", ["commit", "-m", "Emergency rollback to last stable index"], { cwd: repo, stdio: "inherit" });
  execFileSync("git", ["push"], { cwd: repo, stdio: "inherit" });
  console.log("Emergency rollback committed and copied for deployment");
})().catch(error => { console.error(error); process.exit(1); });
