// Page smoke test in a hidden browser (no Chrome tabs; Colin 10/22: "the Chrome thing slows us down").
// Opens every page on the local test server at phone size, fails on any page error, and plays a few things through.
// Run: node web/server.ts (in another window), then node checks/pages_smoke.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:4321/web/";
const browser = await chromium.launch({ channel: "chrome" }); // the installed Chrome, run hidden (no tabs)
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };

for (const p of ["home", "packs", "stats", "import", "sudoku", "starbattle", "watersort", "blocks"]) {
  await page.goto(`${BASE}${p}.html`);
  await page.waitForTimeout(800);
  check(`${p} page opens with no errors`, !errors.some((e) => e.includes(`/${p}.html`)));
}

// Home → Star Battle shows the 3 packs.
await page.goto(`${BASE}home.html`);
await page.waitForTimeout(600);
await page.click('[data-game="starbattle"]');
await page.waitForTimeout(400);
const packs = await page.$$eval(".pack-card .pack-text > b", (els) => els.map((e) => e.textContent));
check(`Star Battle shows 3 packs (${packs.join(", ")})`, packs.length === 3 && packs.includes("Starter – Triple"));

// Triple #1 solved by Hint presses alone.
await page.goto(`${BASE}starbattle.html?pack=triple&p=1`);
await page.waitForTimeout(1200);
const solved = await page.evaluate(async () => {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !$("won"); i++) {
    if ($("hint").hidden) { $("hintBtn").click(); await wait(60); }
    for (let g = 0; g < 60 && !$("hint").hidden; g++) $("hintNext").click();
  }
  await wait(2000);
  return { won: !!$("won"), count: $("count").textContent, sub: $("sub").textContent };
});
check(`Triple #1 solved by hints (${solved.sub}, ${solved.count})`, solved.won && solved.count.startsWith("36 / 36"));

// A wrong × is not flagged on sight: the first hint is a normal step built on correct marks.
await page.goto(`${BASE}starbattle.html?pack=easy&p=1`);
await page.waitForTimeout(1000);
const wrongX = await page.evaluate(async () => {
  const $ = (id) => document.getElementById(id);
  localStorage.removeItem("solvebuddy.saved");
  const cell = document.querySelector('.cell[data-r="0"][data-c="4"]'); // easy #1's row-1 star is in column 5
  cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  $("hintBtn").click();
  await new Promise((r) => setTimeout(r, 200));
  return { chip: $("hintChip").textContent, nudge: $("hintTitle").textContent };
});
check(`a wrong × isn't flagged on sight (hint: ${wrongX.chip || "—"} / ${wrongX.nudge})`, wrongX.chip !== "Check this");

// Every game sits centred between the info row and the bottom bar, as on the phone (Colin, 10/22: "always centered,
// never too high"): app layout with the notch space, on a tall and a short phone.
for (const h of [844, 750]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: h } });
  await ctx.addInitScript(() => {
    window.SOLVEBUDDY_APP = { haptics: true, nativeBack: true, splash: false };
    const vars = () => { const d = document.documentElement; if (d) { d.style.setProperty("--tabbar", "0px"); d.style.setProperty("--safetop", "59px"); } };
    vars(); document.addEventListener("readystatechange", vars);
  });
  const p = await ctx.newPage();
  for (const [g, q] of [["starbattle", "?pack=easy&p=1"], ["starbattle", "?pack=triple&p=1"], ["sudoku", "?pack=easy&p=1"],
                        ["watersort", "?pack=easy&p=1"], ["watersort", "?pack=hard&p=1"], ["blocks", ""]]) {
    await p.goto(`${BASE}${g}.html${q}`);
    await p.waitForTimeout(1500);
    const off = await p.evaluate((g) => {
      const r = (q) => document.querySelector(q)?.getBoundingClientRect();
      const span = (els) => ({ top: Math.min(...els.map((e) => e.top)), bottom: Math.max(...els.map((e) => e.bottom)) });
      const group = g === "sudoku" ? span([r("#board"), r(".pad") ?? r("#board")])
        : g === "watersort" ? span([...document.querySelectorAll(".tube")].map((e) => e.getBoundingClientRect()))
        : g === "blocks" ? r(".stage") : r("#board");
      const top = r(".info").bottom, bottom = r(".dock")?.top ?? r(".screen").bottom - 30;
      return Math.round((group.top + group.bottom) / 2 - (top + bottom) / 2);
    }, g);
    check(`${g}${q} centred on a ${h}px-tall phone (${off}px from the middle)`, Math.abs(off) <= 40);
  }
  await ctx.close();
}

// Haptics (Colin, 10/23), with a stubbed app bridge that records every buzz: Sudoku (classic, Killer, Thermo) ticks
// "pick" when you select a cell (one per cell a drag adds) and "tap" when a number or note goes in; Star Battle taps
// once per x (a star stays the firmer "thud"), and once per cell a drag marks. One action = one buzz, never two.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.SOLVEBUDDY_APP = { haptics: true, nativeBack: true, splash: false };
    window.__buzz = [];
    window.ReactNativeWebView = { postMessage: (m) => { const o = JSON.parse(m); if (o.type === "haptic") window.__buzz.push(o.kind); } };
  });
  const p = await ctx.newPage();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Shared in-page helpers: centre-of-cell pointer events, and "take what buzzed since last time".
  const helpers = () => {
    window.__cell = (r, c) => document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    window.__pt = (el) => { const b = el.getBoundingClientRect(); return { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true }; };
    window.__take = () => { const o = window.__buzz; window.__buzz = []; return o; };
    // cells as [r, c], looked up fresh at each step: every render rebuilds the board
    window.__drag = (cells) => {
      const first = window.__cell(...cells[0]);
      first.dispatchEvent(new PointerEvent("pointerdown", window.__pt(first)));
      for (const rc of cells.slice(1)) document.dispatchEvent(new PointerEvent("pointermove", window.__pt(window.__cell(...rc))));
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    };
  };
  for (const v of ["easy", "killer", "thermo"]) {
    await p.goto(`${BASE}sudoku.html?pack=${v}&p=1`);
    await p.evaluate(() => localStorage.removeItem("solvebuddy.saved"));
    await p.reload();
    await p.waitForTimeout(2000); // the board's intro finishes
    await p.evaluate(helpers);
    const got = await p.evaluate(() => {
      const open = [...document.querySelectorAll(".cell")].find((el) => !/[1-9]/.test(el.textContent));
      const r = Number(open.dataset.r), c = Number(open.dataset.c), dir = c <= 5 ? 1 : -1;
      const out = {};
      window.__take();
      window.__drag([[r, c]]); out.select = window.__take();
      document.querySelector('[data-n="5"]').click(); out.place = window.__take();
      document.querySelector('.seg[data-mode="corner"]').click(); window.__take();
      document.querySelector('[data-n="3"]').click(); out.note = window.__take();
      document.querySelector('.seg[data-mode="normal"]').click(); window.__take();
      window.__drag([0, 1, 2, 3].map((i) => [r, c + i * dir])); out.drag = window.__take();
      return out;
    });
    check(`Sudoku ${v} haptics: select ${got.select}, number ${got.place}, note ${got.note}, drag over 4 cells ${got.drag}`,
      same(got.select, ["pick"]) && same(got.place, ["tap"]) && same(got.note, ["tap"]) && same(got.drag, ["pick", "pick", "pick", "pick"]));
  }
  await p.goto(`${BASE}starbattle.html?pack=easy&p=1`);
  await p.evaluate(() => localStorage.removeItem("solvebuddy.saved"));
  await p.reload();
  await p.waitForTimeout(2000);
  await p.evaluate(helpers);
  const sb = await p.evaluate(() => {
    const out = {};
    window.__take();
    window.__drag([[0, 0]]); out.cross = window.__take();
    window.__drag([[0, 0]]); out.star = window.__take();
    window.__drag([0, 1, 2, 3].map((c) => [7, c])); out.drag = window.__take();
    window.__drag([0, 1, 2, 3].map((c) => [7, c])); out.wipe = window.__take();
    return out;
  });
  check(`Star Battle haptics: x ${sb.cross}, star ${sb.star}, drag marking 4 cells ${sb.drag}, drag wiping them ${sb.wipe}`,
    same(sb.cross, ["tap"]) && same(sb.star, ["thud"]) && same(sb.drag, ["tap", "tap", "tap", "tap"]) && same(sb.wipe, ["tap", "tap", "tap", "tap"]));
  await ctx.close();
}

// Killer and Thermo Sudoku (10/22): the cages / thermometers draw, the first hint is a variant one, and Killer #1
// and Thermo #1 are solved by Hint presses alone, to the Solved! card.
// Expert (10/22): Killer Expert #1 too, where the 45 rule shows up.
for (const v of ["killer", "thermo", "killer-expert", "thermo-expert"]) {
  await page.goto(`${BASE}sudoku.html?pack=${v}&p=1`);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async (v) => {
    const $ = (id) => document.getElementById(id);
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    localStorage.removeItem("solvebuddy.saved");
    const drawn = document.querySelectorAll(v.startsWith("killer") ? "svg.extra .sum" : "svg.extra circle").length;
    $("hintBtn").click(); await wait(80);
    $("hintNext").click(); await wait(30);
    const chip = $("hintChip").textContent;
    $("hintClose").click();
    const chips = new Set();
    for (let i = 0; i < 400 && !$("won"); i++) {
      if ($("hint").hidden) { $("hintBtn").click(); await wait(20); }
      $("hintNext").click(); chips.add($("hintChip").textContent);
      for (let g = 0; g < 10 && !$("hint").hidden; g++) $("hintNext").click();
    }
    await wait(2000);
    return { drawn, chip, won: !!$("won"), sub: $("sub").textContent, rule45: chips.has("45 rule") };
  }, v);
  check(`${v} #1: drawn (${r.drawn}), first hint "${r.chip}", solved by hints (${r.sub})${v === "killer-expert" ? `, 45 rule shown: ${r.rule45}` : ""}`,
    r.drawn > 0 && ["Last cell in cage", "Cage sum", "Cage digits", "Thermo order", "45 rule", "Cage squeeze", "Thermo squeeze"].includes(r.chip) && r.won
    && (v !== "killer-expert" || r.rule45));
}

// The rules sheet sits above everything on the board (Thermo's lines once showed through it, 10/22).
await page.goto(`${BASE}sudoku.html?pack=thermo&p=1`);
await page.waitForTimeout(1200);
await page.click("#rulesBtn");
await page.waitForTimeout(400);
const onTop = await page.evaluate(() => {
  // Whatever is on top over the board's middle must be the pop-up, not a thermometer or number.
  const board = document.getElementById("board").getBoundingClientRect();
  return !!document.elementFromPoint(board.left + board.width / 2, board.top + board.height / 2)?.closest("#rules");
});
check("the rules sheet covers the Thermo board", onTop);

// Hints count in thirds and the Solved card says how many (Colin, 10/22).
await page.goto(`${BASE}sudoku.html?pack=easy&p=1`);
await page.waitForTimeout(1200);
const used = await page.evaluate(async () => {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 200 && !$("won"); i++) {
    if ($("hint").hidden) { $("hintBtn").click(); await wait(30); }
    for (let g = 0; g < 10 && !$("hint").hidden; g++) $("hintNext").click();
  }
  await wait(2500);
  return $("won")?.innerText.match(/[\d.]+ hints? used/)?.[0] ?? "";
});
check(`the Solved card shows hints used (${used})`, /^\d+(\.\d+)? hints? used$/.test(used));

check("no page errors anywhere", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
await browser.close();
process.exit(failed ? 1 : 0);
