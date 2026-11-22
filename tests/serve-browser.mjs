import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { createServer } from "node:http";

const directory = await mkdtemp(join(tmpdir(), "atlas-browser-tests-"));
await build({
  entryPoints: [
    "browser",
    "canvas",
    "inline-note-links",
    "clipboard",
    "layout",
    "model",
    "rich-text-surface",
  ].map((name) => "src/" + name + ".js"),
  outbase: ".",
  outdir: directory,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
});
await writeFile(
  join(directory, "index.html"),
  '<!doctype html><html><head><link rel="stylesheet" href="/src/browser.css"></head><body><div id="app"></div><script type="module" src="/src/browser.js"></script></body></html>',
);
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = resolve(
    directory,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (!file.startsWith(directory + "/")) {
    response.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(Number(process.argv[2]), "127.0.0.1");
async function stop() {
  server.close();
  await rm(directory, { recursive: true, force: true });
  process.exit();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
