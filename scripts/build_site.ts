// Builds the plain website GitHub Pages serves (and the phone app keeps a copy of) into _site/.
// Browsers can't run TypeScript, so engine files lose their types and become .js, and imports follow.
// Run: node scripts/build_site.ts   (GitHub runs it on every push; see .github/workflows/pages.yml)
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, relative } from "node:path";
import { build } from "esbuild";

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

// The phone app's offline pages (app/home.html … app/starbattle.html): one file each with its style, code and
// packs inside, so it needs no internet. The app saves the newest copy and opens it from the phone.
const packs = Object.fromEntries(readdirSync(join(ROOT, "packs")).map((f) => [f, JSON.parse(readFileSync(join(ROOT, "packs", f), "utf8"))]));
const noClose = (s: string) => s.replace(/<\/(script|style)/gi, "<\\/$1");
mkdirSync(join(OUT, "app"));
for (const page of ["home", "packs", "stats", "sudoku", "starbattle", "watersort", "blocks"]) {
  const code = (await build({ entryPoints: [join(ROOT, "web", `${page}.js`)], bundle: true, format: "esm", target: "es2022",
    minify: true, write: false })).outputFiles[0].text;
  const html = readFileSync(join(ROOT, "web", `${page}.html`), "utf8")
    .replace(/<link rel="stylesheet" href="(\w+\.css)">/g, (_, f) => `<style>${noClose(readFileSync(join(ROOT, "web", f), "utf8"))}</style>`)
    .replace(`<script type="module" src="${page}.js"></script>`,
      () => `<script>window.SB_PACKS=${noClose(JSON.stringify(packs))}</script><script type="module">${noClose(code)}</script>`);
  if (html.includes(`src="${page}.js"`) || /href="\w+\.css"/.test(html)) throw new Error(`app/${page}.html: couldn't inline`);
  writeFileSync(join(OUT, "app", `${page}.html`), html);
}

// The site's front door opens Home.
writeFileSync(join(OUT, "index.html"), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=web/home.html"><title>SolveBuddy</title>');
console.log(`Built ${relative(ROOT, OUT)}/`);
