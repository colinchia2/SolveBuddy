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

// Killer and Thermo Sudoku (10/22): the cages / thermometers draw, the first hint is a variant one, and Killer #1
// and Thermo #1 are solved by Hint presses alone, to the Solved! card.
for (const v of ["killer", "thermo"]) {
  await page.goto(`${BASE}sudoku.html?pack=${v}&p=1`);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async (v) => {
    const $ = (id) => document.getElementById(id);
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    localStorage.removeItem("solvebuddy.saved");
    const drawn = document.querySelectorAll(v === "killer" ? "svg.extra .sum" : "svg.extra circle").length;
    $("hintBtn").click(); await wait(80);
    $("hintNext").click(); await wait(30);
    const chip = $("hintChip").textContent;
    $("hintClose").click();
    for (let i = 0; i < 300 && !$("won"); i++) {
      if ($("hint").hidden) { $("hintBtn").click(); await wait(20); }
      for (let g = 0; g < 10 && !$("hint").hidden; g++) $("hintNext").click();
    }
    await wait(2000);
    return { drawn, chip, won: !!$("won"), sub: $("sub").textContent };
  }, v);
  check(`${v} #1: drawn (${r.drawn}), first hint "${r.chip}", solved by hints (${r.sub})`,
    r.drawn > 0 && ["Last cell in cage", "Cage sum", "Cage digits", "Thermo order"].includes(r.chip) && r.won);
}

check("no page errors anywhere", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
await browser.close();
process.exit(failed ? 1 : 0);
