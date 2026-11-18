// 把 dist/ 的产物压成一个能双击就玩的 HTML（不依赖任何服务器）。
// 用法：node tools/make-single-html.cjs [输出文件名]
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const outName = process.argv[2] || "芝芝消消.html";
const outFile = path.join(root, outName);

const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");

const readAsset = (href) => {
  const rel = href.replace(/^\/+/, "");
  return fs.readFileSync(path.join(dist, rel), "utf8");
};

// JS 里出现 </script> 会提前闭合标签，转义掉。
const safeJs = (js) => js.replace(/<\/script/gi, "<\\/script");

let out = html;

// 1) 外链样式 → <style>
out = out.replace(
  /<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_, href) => `<style>\n${readAsset(href)}\n</style>`,
);

// 2) 外链脚本 → 内联 <script type="module">
out = out.replace(
  /<script[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_, src) => `<script type="module">\n${safeJs(readAsset(src))}\n</script>`,
);

// 3) 图片等二进制资源 → data URI。
//    vite 默认只内联 <4KB 的小图；grok 精修贴图 5~30KB 会变成外链 ./assets/*，
//    单文件 HTML 和 Pages（仓库根没有 assets 目录）都会丢图，所以这里统一内联。
const mime = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
const assetsDir = path.join(dist, "assets");
if (fs.existsSync(assetsDir)) {
  for (const f of fs.readdirSync(assetsDir)) {
    const ext = path.extname(f).toLowerCase();
    if (!mime[ext]) continue;
    const uri = `data:${mime[ext]};base64,${fs.readFileSync(path.join(assetsDir, f)).toString("base64")}`;
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(?:\\./|/)assets/${esc}`, "g"), uri);
  }
}

// 4) 顺手把还残留的 /assets/ 绝对路径改成相对（理论上第 3 步已清空）
out = out.replace(/(["'(])\/assets\//g, "$1./assets/");

fs.writeFileSync(outFile, out, "utf8");
const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log(`OK  ${outFile}  ${kb} KB`);