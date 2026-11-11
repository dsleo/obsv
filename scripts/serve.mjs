import http from "node:http";
import path from "node:path";
import { stat, readFile } from "node:fs/promises";
const root = path.resolve("out"),
  port = Number(process.env.PORT ?? 4173),
  prefix = (process.env.BASE_PATH ?? "").replace(/\/$/, "");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
http
  .createServer(async (req, res) => {
    try {
      let requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (prefix) {
        if (!requested.startsWith(prefix + "/") && requested !== prefix) throw Error();
        requested = requested.slice(prefix.length) || "/";
      }
      let file = path.resolve(root, "." + requested);
      if (file !== root && !file.startsWith(root + path.sep)) throw Error();
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(await readFile(path.join(root, "404.html")).catch(() => "Page introuvable"));
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Static preview: http://127.0.0.1:${port}${prefix}/`),
  );
