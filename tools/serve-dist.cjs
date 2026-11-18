// 极简静态服务器：把 dist/ 发给局域网/隧道
// 用法：node tools/serve-dist.cjs [端口] [目录]
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.argv[2] || 8080);
const rootDir = path.resolve(process.argv[3] || path.join(__dirname, "..", "dist"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = path.join(rootDir, urlPath === "/" ? "index.html" : urlPath);
    if (!file.startsWith(rootDir)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 " + urlPath);
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-cache",
      });
      res.end(buf);
    });
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`serving ${rootDir} on http://0.0.0.0:${port}`);
  });