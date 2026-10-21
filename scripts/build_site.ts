// Builds the plain website GitHub Pages serves (and the phone app keeps a copy of) into _site/.
// Browsers can't run TypeScript, so engine files lose their types and become .js, and imports follow.
// Run: node scripts/build_site.ts   (GitHub runs it on every push; see .github/workflows/pages.yml)
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "_site");
const toJs = (code: string) => code.replace(/(from\s+"[^"]+)\.ts"/g, '$1.js"');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

// Pages and styles, with imports pointed at the .js engine files.
for (const f of readdirSync(join(ROOT, "web"))) {
  if (f === "server.ts") continue;
  const text = readFileSync(join(ROOT, "web", f), "utf8");
  mkdirSync(join(OUT, "web"), { recursive: true });
  writeFileSync(join(OUT, "web", f), f.endsWith(".js") ? toJs(text) : text);
}

// The engine, types stripped.
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
for (const file of walk(join(ROOT, "engine")).filter((f) => f.endsWith(".ts"))) {
  const dest = join(OUT, relative(ROOT, file)).replace(/\.ts$/, ".js");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, toJs(stripTypeScriptTypes(readFileSync(file, "utf8"))));
}

cpSync(join(ROOT, "packs"), join(OUT, "packs"), { recursive: true });

// The site's front door opens Sudoku.
writeFileSync(join(OUT, "index.html"), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=web/sudoku.html"><title>SolveBuddy</title>');
console.log(`Built ${relative(ROOT, OUT)}/`);
