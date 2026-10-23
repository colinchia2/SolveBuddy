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

// Home → Star Battle shows the 3 packs, as one list under "Starter" (calmer screens, Colin 10/23).
await page.goto(`${BASE}home.html`);
await page.waitForTimeout(600);
await page.click('[data-game="starbattle"]');
await page.waitForTimeout(400);
const packs = await page.evaluate(() => ({ head: [...document.querySelectorAll(".c-ghead")].map((e) => e.textContent),
  rows: [...document.querySelectorAll(".c-row .g > b")].map((e) => e.textContent), more: !!document.querySelector('.c-link[data-act="more"]') }));
check(`Star Battle shows 3 packs under ${packs.head.join(", ")} (${packs.rows.join(", ")}), Get more packs link`,
  packs.rows.join() === "Single,Double,Triple" && packs.head.join() === "Starter" && packs.more);
// One pack: the short name, solved tiles with no star badge, the key down to two.
await page.click('.c-row[data-set="0"]');
await page.waitForTimeout(400);
const one = await page.evaluate(() => ({ title: document.querySelector(".c-title h1").textContent, tiles: document.querySelectorAll(".ptile").length,
  badges: document.querySelectorAll(".ptile-star").length, key: [...document.querySelectorAll(".gp-key span")].map((e) => e.textContent) }));
check(`one pack: "${one.title}", ${one.tiles} puzzles, key ${one.key.join(" / ")}`,
  one.title === "Single" && one.tiles === 20 && one.badges === 0 && one.key.join() === "Solved, best time,In progress");

// Packs tab (Colin 10/23): one block per pack family, named once, totals from the real pack files; nothing that's
// playable is listed as coming soon (it once listed Killer and Thermo); tapping a block opens that pack.
await page.goto(`${BASE}packs.html`);
await page.waitForTimeout(800);
const tab = await page.evaluate(async () => {
  const { GAMES, loadPack } = await import("./bridge.js");
  const want = {};
  for (const [g, game] of Object.entries(GAMES)) for (const [i, s] of game.sets.entries()) {
    let n = 0;
    for (const k of s.levels) n += (await loadPack(game.packs.find(([key]) => key === k)[1])).puzzles.length;
    want[`${g}/${i}`] = n;
  }
  const got = {};
  for (const b of document.querySelectorAll(".btile[data-set]")) got[`${b.dataset.g}/${b.dataset.set}`] = Number(b.querySelector(".top .c").textContent);
  const block = (g, name) => [...document.querySelectorAll(`.btile[data-g="${g}"]`)].find((b) => b.querySelector(".n").textContent === name);
  const starter = block("sudoku", "Starter");
  return { want, got, starterN: starter && Number(starter.querySelector(".top .c").textContent),
    starterLv: starter?.querySelectorAll(".c")[1].textContent, sudokuBlocks: document.querySelectorAll('.btile[data-g="sudoku"]').length,
    ticks: document.querySelectorAll('[aria-label="On this phone"]').length, text: document.querySelector(".page").innerText };
});
check(`Packs tab: a block per pack with the real totals (${JSON.stringify(tab.got)})`, JSON.stringify(tab.got) === JSON.stringify(tab.want));
check(`Packs tab: Sudoku Starter is ONE block of ${tab.starterN} (${tab.starterLv}), ${tab.sudokuBlocks} Sudoku blocks`,
  tab.starterN === 40 && tab.starterLv === "Easy · Medium · Hard · Expert" && tab.sudokuBlocks === 4 && tab.ticks === 0);
const soon = await page.evaluate(async () => {
  const { GAMES } = await import("./bridge.js");
  return { packsSoon: /coming soon|\bsoon\b/i.test(document.querySelector(".page").innerText),
    names: [...Object.values(GAMES).map((g) => g.name), ...Object.values(GAMES).flatMap((g) => g.sets.map((s) => s.name.split(" – ").pop())), "Killer Sudoku", "Thermo Sudoku", "Block Drop"] };
});
await page.goto(`${BASE}home.html`);
await page.waitForTimeout(600);
const homeSoon = await page.$eval("#soon", (e) => e.innerText.replace(/^Coming soon\s*/, ""));
const clash = soon.names.filter((n) => homeSoon.split(" · ").includes(n));
check(`nothing playable is "coming soon" (Packs tab lists none; Library: ${homeSoon})`, !soon.packsSoon && clash.length === 0 && homeSoon.length > 0);
await page.goto(`${BASE}packs.html`);
await page.waitForTimeout(600);
await page.click('.btile[data-g="sudoku"][data-set="2"]');
await page.waitForTimeout(900);
const opened = await page.evaluate(() => ({ url: location.pathname, title: document.querySelector("#view:not([hidden]) .c-title h1")?.textContent,
  levels: [...document.querySelectorAll(".gp-level-head b")].map((e) => e.textContent) }));
check(`tapping the Killer block opens that pack (${opened.title}: ${opened.levels.join(", ")})`,
  opened.url.endsWith("/home.html") && opened.title === "Killer" && opened.levels.join() === "Easy,Expert");

// In the app the tabs are separate pages: Packs leaves a note and switches tabs; Library opens the pack when it comes
// on screen (the app calls sbRefresh), with no app change.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.SOLVEBUDDY_APP = { haptics: true, nativeBack: true, splash: false };
    window.__sent = [];
    window.ReactNativeWebView = { postMessage: (m) => window.__sent.push(JSON.parse(m)) };
  });
  const p = await ctx.newPage();
  await p.goto(`${BASE}packs.html`);
  await p.waitForTimeout(800);
  await p.click('.btile[data-g="starbattle"][data-set="1"]');
  const sent = await p.evaluate(() => window.__sent.filter((m) => m.type === "tab"));
  await p.goto(`${BASE}home.html`); // same storage, as the Library tab's page
  await p.waitForTimeout(800);
  await p.evaluate(() => window.sbRefresh());
  await p.waitForTimeout(300);
  const title = await p.evaluate(() => document.querySelector("#view:not([hidden]) .c-title h1")?.textContent);
  check(`in the app, a Packs block switches to Library (${sent.map((m) => m.name)}) and opens the pack there (${title})`,
    sent.length === 1 && sent[0].name === "Library" && title === "Double");
  await ctx.close();
}

// Import tab (Colin 10/23): imports as 2-wide blocks under their day; the game filter (a small sheet) and sort still work.
await page.goto(`${BASE}import.html`);
await page.waitForTimeout(900);
const imp = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ids = () => [...document.querySelectorAll(".btiles .imp-open")].map((b) => b.dataset.open);
  const out = { tiles: ids().length, cols: getComputedStyle(document.querySelector(".btiles")).gridTemplateColumns.split(" ").length,
    days: document.querySelectorAll(".day > span").length, words: [...document.querySelectorAll(".imp .state")].map((e) => e.textContent) };
  const first = ids();
  document.querySelector('[data-act="sort"]').click(); await wait(50);
  out.sorted = ids().join() === [...first].reverse().join() || first.length < 2;
  out.sortLabel = document.querySelector('[data-act="sort"]').textContent.trim();
  document.querySelector('[data-act="sort"]').click(); await wait(50);
  document.querySelector('[data-act="filter"]').click(); await wait(50);
  out.choices = [...document.querySelectorAll("#menu [data-filter]")].map((b) => b.textContent.trim());
  document.querySelector('#menu [data-filter="sudoku"]').click(); await wait(300);
  out.sudoku = ids().length;
  out.label = document.querySelector('[data-act="filter"]').textContent.trim();
  document.querySelector('[data-act="filter"]').click(); await wait(50);
  document.querySelector('#menu [data-filter="all"]').click(); await wait(300);
  out.back = ids().length;
  return out;
});
check(`Import: ${imp.tiles} imports as ${imp.cols}-wide blocks under ${imp.days} day heading(s) (${[...new Set(imp.words)].join(", ")})`,
  imp.tiles >= 4 && imp.cols === 2 && imp.days >= 1 && imp.words.every((w) => ["New", "In progress", "Solved"].includes(w)));
check(`Import: sort flips the order (${imp.sortLabel}); filter offers ${imp.choices.join(" / ")}, Sudoku shows ${imp.sudoku} (${imp.label}), All shows ${imp.back}`,
  imp.sorted && imp.sortLabel === "Oldest" && imp.choices.join() === "All games,Star Battle,Sudoku,Water Sort" && imp.label === "Sudoku" && imp.back === imp.tiles
  && imp.sudoku < imp.tiles);

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

// Each thermometer is ONE flat shape (Colin, 10/23): bulb and tube share a group that carries the see-through,
// and neither part has its own alpha, so the tube never shows darker through the bulb.
const thermoShape = await page.evaluate(() => {
  const groups = [...document.querySelectorAll("svg.extra g.thermo")];
  const parts = [...document.querySelectorAll("svg.extra polyline, svg.extra circle")];
  const ownAlpha = (el) => ["opacity", "fill-opacity", "stroke-opacity"].some((a) => el.hasAttribute(a))
    || Number(getComputedStyle(el).opacity) < 1 || Number(getComputedStyle(el).fillOpacity) < 1 || Number(getComputedStyle(el).strokeOpacity) < 1;
  return { groups: groups.length, ok: groups.length > 0 && parts.every((p) => p.parentElement.matches("g.thermo") && !ownAlpha(p))
    && groups.every((g) => g.querySelectorAll("polyline").length === 1 && g.querySelectorAll("circle").length === 1 && Number(g.getAttribute("opacity")) < 1) };
});
check(`each thermometer is one flat shape: opaque bulb + tube in one see-through group (${thermoShape.groups})`, thermoShape.ok);

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
