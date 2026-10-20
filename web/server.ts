// Local test server: serves the play pages, the engine and the packs.
// Run: node web/server.ts   then open http://localhost:4321
// TypeScript files are sent to the browser with their types stripped, so the page runs the real engine.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { extname, join, normalize } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const PORT = 4321;
const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".ts": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
};
const ALLOWED = ["web", "engine", "packs"];

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const rel = normalize(path === "/" ? "web/sudoku.html" : path.slice(1));
  if (!ALLOWED.includes(rel.split(/[\\/]/)[0])) return void res.writeHead(404).end("Not found");
  try {
    let body: string | Buffer = await readFile(join(ROOT, rel));
    if (rel.endsWith(".ts")) body = stripTypeScriptTypes(body.toString());
    res.writeHead(200, { "Content-Type": TYPES[extname(rel)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => console.log(`SolveBuddy test pages: http://localhost:${PORT}`));
