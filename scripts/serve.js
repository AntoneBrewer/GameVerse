const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};
const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  const requested = path.resolve(root, `.${pathname}`);
  if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  const file = path.join(requested, "index.html");
  fs.stat(requested, (statError, stat) => {
    if (statError) {
      response.writeHead(404).end("Not found");
      return;
    }
    const target = stat.isDirectory() ? file : requested;
    fs.readFile(target, (readError, contents) => {
      if (readError) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(target)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(contents);
    });
  });
});

server.listen(1420, "127.0.0.1", () => {
  process.stdout.write("GameVerse desktop development server listening on http://127.0.0.1:1420\n");
});
