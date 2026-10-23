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
const built: Record<string, { html: string; code: string }> = {};
for (const page of ["home", "packs", "stats", "sudoku", "starbattle", "watersort", "blocks", "import", "nonogram"]) {
  const code = (await build({ entryPoints: [join(ROOT, "web", `${page}.js`)], bundle: true, format: "esm", target: "es2022",
    minify: true, write: false })).outputFiles[0].text;
  const html = readFileSync(join(ROOT, "web", `${page}.html`), "utf8")
    .replace(/<link rel="stylesheet" href="(\w+\.css)">/g, (_, f) => `<style>${noClose(readFileSync(join(ROOT, "web", f), "utf8"))}</style>`)
    .replace(`<script type="module" src="${page}.js"></script>`,
      () => `<script>window.SB_PACKS=${noClose(JSON.stringify(packs))}</script><script type="module">${noClose(code)}</script>`);
  if (html.includes(`src="${page}.js"`) || /href="\w+\.css"/.test(html)) throw new Error(`app/${page}.html: couldn't inline`);
  writeFileSync(join(OUT, "app", `${page}.html`), html);
  built[page] = { html, code };
}

// A game the phone app doesn't know as a page yet rides inside one it does (bridge.js HOSTED): the app opens only the
// game pages built into it (App.js GAMES), so the app's starbattle page also carries Nonogram and becomes it when
// opened with ?game=nonogram. No app change; once the app lists "nonogram", this can go.
for (const [guest, host] of [["nonogram", "starbattle"]]) {
  const g = built[guest].html, h = built[host].html;
  const styles = (g.slice(0, g.indexOf("</head>")).match(/<style>[\s\S]*?<\/style>/g) ?? []).join("");
  const body = g.slice(g.indexOf("<body>") + 6, g.indexOf("<script>window.SB_PACKS="));
  const title = g.match(/<title>(.*?)<\/title>/)![1];
  const tail = h.indexOf("<script type=\"module\">");
  if (!styles || !body.includes('class="phone"') || tail < 0) throw new Error(`app/${host}.html: couldn't host ${guest}`);
  const asText = (id: string, code: string) => `<script type="text/plain" id="${id}">${noClose(code)}</script>`;
  const swap = `<script>(function () {
  var d = document, guest = new URLSearchParams(location.search).get("game") === "${guest}";
  var code = d.getElementById(guest ? "sbCode-${guest}" : "sbCode-${host}").textContent;
  if (guest) {
    d.querySelectorAll("head style").forEach(function (s) { s.remove(); });
    d.head.appendChild(d.getElementById("sbHostStyles").content.cloneNode(true));
    d.body.replaceChildren(d.getElementById("sbHostBody").content.cloneNode(true));
    d.title = ${JSON.stringify(title)};
  }
  var s = d.createElement("script"); s.type = "module"; s.textContent = code; d.body.appendChild(s);
})();</script>`;
  const hosted = h.slice(0, tail).replace("</head>", `<script>if (new URLSearchParams(location.search).get("game") === "${guest}") document.documentElement.classList.add("hosted")</script><style>html.hosted body { visibility: hidden; }</style></head>`)
    + `<template id="sbHostStyles">${styles}</template><template id="sbHostBody">${body}</template>`
    + asText(`sbCode-${host}`, built[host].code) + asText(`sbCode-${guest}`, built[guest].code) + swap + "\n</body>\n</html>\n";
  writeFileSync(join(OUT, "app", `${host}.html`), hosted);
}

// The site's front door opens Home.
writeFileSync(join(OUT, "index.html"), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=web/home.html"><title>SolveBuddy</title>');
console.log(`Built ${relative(ROOT, OUT)}/`);
