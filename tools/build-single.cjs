// 一键出包：换 vite 入口 → build → 压单文件 → 单文件写回 index.html（Pages 用）。
// 用法：node tools/build-single.cjs
// 背景：根 index.html 是 Pages 要发布的单文件成品，不是 vite 入口；
//       vite 入口保存在 entry.html，构建期间临时换入，构建完再换回成品。
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const node = process.execPath;

// 1) entry.html → index.html（vite 构建入口）
fs.copyFileSync(path.join(root, "entry.html"), path.join(root, "index.html"));

try {
  // 2) vite build
  execFileSync(node, [path.join(root, "node_modules", "vite", "bin", "vite.js"), "build"], {
    cwd: root,
    stdio: "inherit",
  });

  // 3) dist 压成单文件（芝芝消消.html）
  execFileSync(node, [path.join(root, "tools", "make-single-html.cjs")], {
    cwd: root,
    stdio: "inherit",
  });
} finally {
  // 4) 单文件成品 → index.html（无论成败都恢复，Pages 发布的就是它）
  const single = path.join(root, "芝芝消消.html");
  if (fs.existsSync(single)) fs.copyFileSync(single, path.join(root, "index.html"));
}
console.log("OK  index.html = 单文件成品（Pages 直接可用）");
