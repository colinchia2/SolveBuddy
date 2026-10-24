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

for (const p of ["home", "packs", "stats", "import", "sudoku", "starbattle", "watersort", "blocks", "nonogram"]) {
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

// Hints count in thirds and the Solved card says how many (Colin, 10/22), in the same words as the line over the
// Hint button (Colin, 10/23): "You've used ⅓ of a hint" … "You've used 1⅓ hints".
await page.goto(`${BASE}sudoku.html?pack=easy&p=1`);
await page.waitForTimeout(1200);
const fmt = await page.evaluate(async () => {
  const { hintsUsedText, hintAmount } = await import("./bridge.js");
  return { line: [0, 1 / 3, 2 / 3, 1, 4 / 3, 5 / 3, 2, 13 / 3, 0.33, 1.67].map(hintsUsedText), card: [1 / 3, 1, 1.33, 4.67].map(hintAmount) };
});
check(`hints formatter: ${fmt.line.map((t) => t || "(hidden)").join(" | ")}`, JSON.stringify(fmt.line) === JSON.stringify(["",
  "You've used ⅓ of a hint", "You've used ⅔ of a hint", "You've used 1 hint", "You've used 1⅓ hints", "You've used 1⅔ hints",
  "You've used 2 hints", "You've used 4⅓ hints", "You've used ⅓ of a hint", "You've used 1⅔ hints"]));
check(`hints formatter on the Solved card: ${fmt.card.join(" | ")}`, fmt.card.join() === "⅓ of a hint,1 hint,1⅓ hints,4⅔ hints");
const used = await page.evaluate(async () => {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let last = "";
  const note = () => { const t = $("hintsUsed")?.hidden === false ? $("hintsUsed").textContent : ""; if (t) last = t; };
  for (let i = 0; i < 200 && !$("won"); i++) {
    if ($("hint").hidden) { $("hintBtn").click(); note(); await wait(30); }
    for (let g = 0; g < 10 && !$("hint").hidden; g++) { $("hintNext").click(); note(); }
  }
  await wait(2500);
  return { card: $("won")?.innerText.match(/\S+ (of a )?hints? used/)?.[0] ?? "", last };
});
check(`the Solved card says "${used.card}", the line said "${used.last}"`, /hints? used$/.test(used.card) && used.last === `You've used ${used.card.replace(/ used$/, "")}`);

// The line on every game (Colin 10/23): hidden until the first hint, ⅓ then ⅔ live, Undo keeps it (the hint was
// used), Restart clears it; it sits over the Hint button in the gap above the bar, adding no height.
async function hintLine(url) {
  await page.goto(`${BASE}${url}`);
  await page.waitForTimeout(1300);
  return page.evaluate(async () => {
    const $ = (id) => document.getElementById(id);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const line = () => ($("hintsUsed") && !$("hintsUsed").hidden ? $("hintsUsed").textContent : "");
    const restart = async () => { $("restartBtn").click(); await wait(50); document.querySelector('.scrim:not([hidden]) [data-act="yes"]').click(); await wait(400); };
    await restart();
    await wait(2200); // the number pad's opening bounce is over
    const out = { fresh: line() };
    const dockTop = document.querySelector(".dock").getBoundingClientRect().top;
    $("hintBtn").click(); await wait(80);
    out.one = line();
    $("hintNext").click(); await wait(80);
    out.two = line();
    const L = $("hintsUsed").getBoundingClientRect(), H = $("hintBtn").getBoundingClientRect();
    out.over = L.bottom <= H.top + 0.5 && Math.abs((L.left + L.right) / 2 - (H.left + H.right) / 2) < 1;
    out.sameDock = Math.abs(document.querySelector(".dock").getBoundingClientRect().top - dockTop) < 0.5;
    // Nothing on the page above the bar is under the line (the board, the number pad, a tip).
    const hit = [...document.querySelectorAll(".screen *")].filter((e) => !e.closest(".dock") && !e.closest(".hint") && e.children.length === 0)
      .map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height && r.bottom > L.top + 0.5 && r.top < L.bottom - 0.5 && r.right > L.left && r.left < L.right);
    out.clear = hit.length === 0;
    $("hintClose").click(); await wait(300);
    $("undoBtn").click(); await wait(80);
    out.undo = line();
    await restart();
    out.reset = line();
    return out;
  });
}
for (const url of ["sudoku.html?pack=easy&p=2", "sudoku.html?pack=killer&p=1", "sudoku.html?pack=thermo&p=1", "starbattle.html?pack=easy&p=2",
  "starbattle.html?pack=triple&p=2", "nonogram.html?pack=easy&p=2", "nonogram.html?pack=hard&p=1", "watersort.html?pack=easy&p=2"]) {
  const r = await hintLine(url);
  check(`${url}: hints line "${r.fresh || "(hidden)"}" → "${r.one}" → "${r.two}", after Undo "${r.undo}", after Restart "${r.reset || "(hidden)"}"; over Hint ${r.over}, no height ${r.sameDock}, covers nothing ${r.clear}`,
    r.fresh === "" && r.one === "You've used ⅓ of a hint" && r.two === "You've used ⅔ of a hint" && r.undo === r.two && r.reset === "" && r.over && r.sameDock && r.clear);
}

const same2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Nonogram (Colin 10/23): tap cycle × → fill → clear (■ switch: fill first, remembered per puzzle), a drag paints what
// its first square shows (empty → ×, filled → fill) locked to a line with one light buzz per square, a firmer buzz when
// a row is complete and right, tapping a clue ×'s the rest of a right line (shakes otherwise), no row/column highlight, finished clues grey out, one Undo per drag, hints explain a row or column, and the finish
// names the picture ("A heart!") with the picture as the medal. App bridge stubbed to record every buzz.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.SOLVEBUDDY_APP = { haptics: true, nativeBack: true, splash: false };
    window.__buzz = [];
    window.ReactNativeWebView = { postMessage: (m) => { const o = JSON.parse(m); if (o.type === "haptic") window.__buzz.push(o.kind); } };
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  await p.goto(`${BASE}nonogram.html?pack=easy&p=1`);
  await p.waitForTimeout(1200);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(1500);
  const nn = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const cell = (r, c) => document.querySelector(`.nc[data-r="${r}"][data-c="${c}"]`);
    const at = (r, c) => { const b = cell(r, c).getBoundingClientRect(); return { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true }; };
    const take = () => { const o = window.__buzz; window.__buzz = []; return o; };
    // A drag through cells [r, c]; a "wobble" point can sit off the line.
    const drag = (cells) => {
      cell(...cells[0]).dispatchEvent(new PointerEvent("pointerdown", at(...cells[0])));
      for (const rc of cells.slice(1)) document.dispatchEvent(new PointerEvent("pointermove", at(...rc)));
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    };
    const state = (r, c) => (cell(r, c).classList.contains("f") ? "fill" : cell(r, c).querySelector(".xm") ? "x" : "blank");
    const out = {};
    take();
    out.cycle = [];
    for (let i = 0; i < 3; i++) { drag([[4, 0]]); out.cycle.push(state(4, 0)); }
    out.cycleBuzz = take();
    // No highlight: mid-drag, no row/column classes and the row-mate square looks like any other.
    cell(0, 0).dispatchEvent(new PointerEvent("pointerdown", at(0, 0)));
    const bg = (r, c) => getComputedStyle(cell(r, c)).backgroundColor;
    out.noHl = document.querySelectorAll(".lc, .cur").length === 0 && bg(0, 3) === bg(3, 3) && bg(3, 0) === bg(3, 3)
      && getComputedStyle(document.querySelector('.rc[data-r="0"]')).backgroundColor === getComputedStyle(document.querySelector('.rc[data-r="3"]')).backgroundColor;
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    document.getElementById("undoBtn").click(); take();
    // Heart row 2 (index 1) is 5: drag from an empty square (1,0) → (1,1) → a wobble into row 3 at column 2: locks to
    // row 2 and paints ×.
    drag([[1, 0], [1, 1], [2, 2]]);
    out.dragged = [state(1, 0), state(1, 1), state(1, 2), state(2, 2)];
    out.dragBuzz = take();
    document.getElementById("undoBtn").click(); take();
    out.afterUndo = [state(1, 0), state(1, 1), state(1, 2)];
    // Fill a run: tap the first square twice (filled), then drag from it: three light taps, then a firmer one as the
    // row becomes complete and right; its clue greys out.
    drag([[1, 0]]); drag([[1, 0]]); take();
    drag([[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]]);
    out.fillRow = [0, 1, 2, 3, 4].map((c) => state(1, c));
    out.rowBuzz = take();
    // A drag from an × paints × and never clears: from (4,0) (now ×) over a filled (4,2).
    drag([[4, 0]]); drag([[4, 2]]); drag([[4, 2]]); take(); // (4,0) × ; (4,2) filled
    drag([[4, 0], [4, 1], [4, 2], [4, 3]]);
    out.fromX = [0, 1, 2, 3].map((c) => state(4, c));
    document.getElementById("undoBtn").click(); document.getElementById("undoBtn").click(); document.getElementById("undoBtn").click();
    document.getElementById("undoBtn").click(); take();
    out.row4Back = [0, 1, 2, 3].map((c) => state(4, c));
    // ■ switch: a tap fills an empty square directly, a drag from an empty square paints fill (row 4 is .XXX.).
    document.querySelector('#modeSw [data-mode="fill"]').click(); take();
    out.modeOn = document.querySelector('#modeSw [data-mode="fill"]').getAttribute("aria-checked");
    drag([[3, 1]]);
    drag([[3, 2], [3, 3]]);
    out.fillMode = [0, 1, 2, 3, 4].map((c) => state(3, c));
    take();
    // Tap a clue when the line is right: × into every other empty square, a few light ticks then the firm one;
    // one Undo takes the whole fill back.
    const clue = (sel) => { const el = document.querySelector(sel), b = el.getBoundingClientRect(), pt = { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true };
      el.dispatchEvent(new PointerEvent("pointerdown", pt)); document.dispatchEvent(new PointerEvent("pointerup", pt)); };
    clue('.rc[data-r="3"]');
    out.swept = !!document.querySelector('.nc[data-r="3"][data-c="4"].sw');
    await wait(600);
    out.clueRow = [0, 1, 2, 3, 4].map((c) => state(3, c));
    out.clueBuzz = take();
    document.getElementById("undoBtn").click(); take();
    out.clueUndo = [0, 1, 2, 3, 4].map((c) => state(3, c));
    // Column 1 (index 0) is 2 (rows 2-3) but row 4 is wrong: fill (4,0), then tap the column's clue: it only shakes.
    drag([[4, 0]]); take();
    const before = JSON.stringify(window.sbNono.state().marks);
    clue('.cc[data-c="0"]');
    await wait(400);
    out.wrongShake = document.querySelector('.cc[data-c="0"]').classList.contains("shake");
    out.wrongSame = JSON.stringify(window.sbNono.state().marks) === before;
    out.wrongBuzz = take();
    document.getElementById("undoBtn").click(); take();
    out.rowGrey = document.querySelector('.rc[data-r="1"]').classList.contains("done");
    out.otherGrey = document.querySelector('.rc[data-r="2"]').classList.contains("done");
    // Hint: names a row or column, then explains why with its technique.
    document.getElementById("hintBtn").click(); await wait(50);
    out.nudge = document.getElementById("hintTitle").textContent;
    document.getElementById("hintNext").click(); await wait(50);
    out.chip = document.getElementById("hintChip").textContent;
    out.why = document.getElementById("hintBody").textContent;
    document.getElementById("hintClose").click(); await wait(50);
    // Hints alone finish it; the finish is the picture.
    // (the card slides out for a moment after closing, so go by the game's own hint state)
    for (let i = 0; i < 60 && !document.getElementById("won"); i++) {
      if (!window.sbNono.state().hint) { document.getElementById("hintBtn").click(); await wait(20); }
      for (let g = 0; g < 4 && window.sbNono.state().hint; g++) document.getElementById("hintNext").click();
    }
    await wait(2600);
    const won = document.getElementById("won");
    out.heading = won?.querySelector("h2")?.textContent;
    out.medal = !!won?.querySelector(".disc.pic svg rect");
    out.boardWon = document.getElementById("board").classList.contains("won");
    out.winBuzz = take().includes("success");
    return out;
  });
  check(`Nonogram tap cycles × → fill → clear like Star Battle (${nn.cycle.join(" → ")}), one light buzz each (${nn.cycleBuzz})`,
    same(nn.cycle, ["x", "fill", "blank"]) && same(nn.cycleBuzz, ["tap", "tap", "tap"]));
  check(`Nonogram: no blue row/column highlight while touching a square (${nn.noHl})`, nn.noHl);
  check(`Nonogram drag from an empty square paints × and locks to its row (${nn.dragged.join(", ")}), one light buzz per square (${nn.dragBuzz}), one Undo takes it all back (${nn.afterUndo})`,
    same(nn.dragged, ["x", "x", "x", "blank"]) && same(nn.dragBuzz, ["tap", "tap", "tap"]) && same(nn.afterUndo, ["blank", "blank", "blank"]));
  check(`Nonogram drag from a filled square paints fill (${nn.fillRow.join(", ")}); row complete and right: firmer buzz (${nn.rowBuzz}), its clue greys (${nn.rowGrey}, unfinished row ${nn.otherGrey})`,
    same(nn.fillRow, ["fill", "fill", "fill", "fill", "fill"]) && same(nn.rowBuzz, ["tap", "tap", "tap", "thud"]) && nn.rowGrey && !nn.otherGrey);
  check(`Nonogram drag from an × paints × and never clears a filled square (${nn.fromX.join(", ")}); Undo back (${nn.row4Back})`,
    same(nn.fromX, ["x", "x", "fill", "x"]) && same(nn.row4Back, ["blank", "blank", "blank", "blank"]));
  check(`Nonogram ■ switch (${nn.modeOn}): a tap fills, a drag from an empty square paints fill (${nn.fillMode.join(", ")})`,
    nn.modeOn === "true" && same(nn.fillMode, ["blank", "fill", "fill", "fill", "blank"]));
  check(`Nonogram tap a right line's clue: × sweeps in (${nn.clueRow.join(", ")}; sweep ${nn.swept}), light ticks then firm (${nn.clueBuzz}); one Undo restores (${nn.clueUndo.join(", ")})`,
    same(nn.clueRow, ["x", "fill", "fill", "fill", "x"]) && nn.swept && same(nn.clueBuzz, ["tap", "tap", "thud"]) && same(nn.clueUndo, ["blank", "fill", "fill", "fill", "blank"]));
  check(`Nonogram tap a wrong line's clue: it shakes (${nn.wrongShake}), nothing changes (${nn.wrongSame}), no buzz (${nn.wrongBuzz.length})`,
    nn.wrongShake && nn.wrongSame && nn.wrongBuzz.length === 0);
  check(`Nonogram hint: "${nn.nudge}" → ${nn.chip}: "${nn.why.slice(0, 60)}…"`, /^Look at (row|column) \d+/.test(nn.nudge) && nn.chip.length > 0 && nn.why.length > 20);
  check(`Nonogram solved by hints: the picture card says "${nn.heading}" with the picture as the medal, colour sweep on, win buzz`,
    nn.heading === "A heart!" && nn.medal && nn.boardWon && nn.winBuzz);
  // The ■ switch is remembered for this puzzle (and isn't on for another).
  await p.reload();
  await p.waitForTimeout(1500);
  const modeKept = await p.evaluate(() => document.querySelector('#modeSw [data-mode="fill"]').getAttribute("aria-checked"));
  await p.goto(`${BASE}nonogram.html?pack=easy&p=2`);
  await p.waitForTimeout(1500);
  const modeOther = await p.evaluate(() => document.querySelector('#modeSw [data-mode="x"]').getAttribute("aria-checked"));
  check(`Nonogram ■ switch remembered per puzzle (this one ${modeKept}, another starts on × ${modeOther})`, modeKept === "true" && modeOther === "true");
  // A puzzle with no picture name gets the usual card (future imports).
  const plainCard = await p.evaluate(async () => {
    const { celebrate } = await import("./celebrate.js");
    celebrate({ title: "Imported", level: "Easy", facts: { ms: 1000, hints: 0, best: false }, hasNext: false, onNext: () => {}, delay: 0,
      heading: undefined, medal: undefined }); // what nonogram.js passes when a puzzle has no name
    await new Promise((r) => setTimeout(r, 50));
    return { h: document.querySelector("#won h2").textContent, disc: !!document.querySelector("#won .disc:not(.pic) svg") };
  });
  check(`a puzzle with no picture name gets the usual card ("${plainCard.h}", star disc)`, plainCard.h === "Solved!" && plainCard.disc);
  await ctx.close();
}

// Two-finger zoom (Colin 10/23), with real touches (Chrome's touch input, as a finger would): only on Star Battle
// 10×10+ and Nonogram 15×15; pinch zooms, two fingers move, one finger still marks while zoomed; past fit it springs
// back; Fit and two-finger double-tap go back to fit; the tips say what to do; the page never scrolls under the board.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript(() => {
    window.SOLVEBUDDY_APP = { haptics: true, nativeBack: true, splash: false };
    window.ReactNativeWebView = { postMessage: () => {} };
    window.__moves = [];
    document.addEventListener("touchmove", (e) => window.__moves.push(e.defaultPrevented), { passive: true });
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`));
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  // Two fingers from a/b to a2/b2 in steps.
  const two = async (a, b, a2, b2, steps = 8) => {
    await touch("touchStart", [a, b]);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, l = (u, v) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
      await touch("touchMove", [l(a, a2), l(b, b2)]);
    }
    await touch("touchEnd", []);
  };
  const zoomable = async (url) => {
    await p.goto(`${BASE}${url}`);
    await p.waitForTimeout(1200);
    return p.evaluate(() => !!document.querySelector(".zoomable"));
  };
  await p.goto(`${BASE}home.html`);
  await p.waitForTimeout(800);
  await p.evaluate(() => localStorage.clear());
  const where = {};
  for (const u of ["nonogram.html?pack=easy&p=1", "nonogram.html?pack=medium&p=1", "nonogram.html?pack=hard&p=1",
    "starbattle.html?pack=easy&p=1", "starbattle.html?pack=double&p=1", "starbattle.html?pack=triple&p=1", "sudoku.html?pack=easy&p=1"]) where[u] = await zoomable(u);
  const want = [false, false, true, false, true, true, false];
  check(`zoom only on Star Battle 10×10+ and Nonogram 15×15 (${Object.values(where).map((v) => (v ? "zoom" : "-")).join(" ")})`, same2(Object.values(where), want));

  // Nonogram 15×15: the pinch tip at fit, then pinch out.
  await p.goto(`${BASE}nonogram.html?pack=hard&p=1`);
  await p.waitForTimeout(1200);
  await p.evaluate(() => { localStorage.removeItem("solvebuddy.zoomTips"); localStorage.removeItem("solvebuddy.saved"); });
  await p.reload();
  await p.waitForTimeout(1500);
  const box = await p.evaluate(() => { const r = document.querySelector(".ngwrap").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const mid = [box.x + box.w / 2, box.y + box.h / 2];
  const fitTip = await p.evaluate(() => ({ tip: document.getElementById("tip").textContent, ctl: !document.getElementById("zoomCtl").hidden }));
  // The board's window vs the free space (Colin 10/23): between the hint line under Fit and the dock, 16px gutters.
  const win = (sel) => p.evaluate((sel) => { const w = document.querySelector(sel).getBoundingClientRect(), d = document.querySelector(".dock").getBoundingClientRect(),
    c = document.querySelector(".zcap").getBoundingClientRect(), s = document.querySelector(".screen").getBoundingClientRect();
    return { h: Math.round(w.height), w: Math.round(w.width), free: Math.round(d.top - c.bottom), gl: Math.round(w.left - s.left), gr: Math.round(s.right - w.right),
      tipClear: document.getElementById("tip").getBoundingClientRect().top >= w.bottom - 1 }; }, sel);
  const fitWin = await win("#board");
  check(`Nonogram 15×15 at fit fills the width (${fitWin.w}px, gutters ${fitWin.gl}/${fitWin.gr}), centred, tip line clear of it (${fitWin.tipClear})`,
    Math.abs(fitWin.gl - 16) <= 3 && Math.abs(fitWin.gr - 16) <= 3 && fitWin.tipClear);
  const scroll0 = await p.evaluate(() => [scrollY, document.querySelector(".screen").scrollTop]);
  await two([mid[0] - 30, mid[1] - 30], [mid[0] + 30, mid[1] + 30], [mid[0] - 80, mid[1] - 80], [mid[0] + 80, mid[1] + 80]);
  await p.waitForTimeout(500);
  const z1 = await p.evaluate(() => ({ ...window.sbNono.view(), ctl: !document.getElementById("zoomCtl").hidden, cap: document.querySelector(".zcap").innerText,
    capShown: !document.querySelector(".zcap").hidden, tipHidden: document.getElementById("tip").hidden, fits: [...document.querySelectorAll(".nc.f")].length }));
  check(`15×15 at fit says "${fitTip.tip}" with no Fit control (${!fitTip.ctl})`, fitTip.tip === "Pinch with two fingers to zoom" && !fitTip.ctl);
  const zWin = await win("#board");
  check(`Nonogram zoomed (${z1.z.toFixed(2)}×): the window fills the free space, ${zWin.h}px tall of ${zWin.free}px between the hint line and the dock, ${zWin.w}px wide (gutters ${zWin.gl}/${zWin.gr})`,
    Math.abs(zWin.h - zWin.free) <= 8 && Math.abs(zWin.gl - 16) <= 1 && Math.abs(zWin.gr - 16) <= 1);
  check(`two-finger pinch zooms (${z1.z.toFixed(2)}×) without marking (${z1.fits} filled); Fit control + "${z1.cap}" shown`,
    z1.z > 1.6 && z1.fits === 0 && z1.ctl && z1.capShown && z1.cap === "Two fingers to move · pinch to zoom out" && z1.tipHidden);
  // Two fingers slide: the board moves, the zoom stays.
  await two([mid[0] - 40, mid[1]], [mid[0] + 40, mid[1]], [mid[0] - 100, mid[1] - 70], [mid[0] - 20, mid[1] - 70]);
  await p.waitForTimeout(500);
  const z2 = await p.evaluate(() => window.sbNono.view());
  check(`two-finger slide moves the board (x ${z1.x.toFixed(0)} → ${z2.x.toFixed(0)}, y ${z1.y.toFixed(0)} → ${z2.y.toFixed(0)}) at the same zoom`,
    z2.x > z1.x + 30 && z2.y > z1.y + 30 && Math.abs(z2.z - z1.z) < 0.05);
  // Zoomed in, one finger still plays: tap a square, then drag along a row.
  const cellAt = (r, c) => p.evaluate(([r, c]) => { const b = document.querySelector(`.nc[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, [r, c]);
  const vis = await p.evaluate(() => { const w = document.querySelector(".ngwrap").getBoundingClientRect();
    const ok = [...document.querySelectorAll(".nc")].filter((e) => { const b = e.getBoundingClientRect(); return b.left > w.left + 4 && b.right < w.right - 4 && b.top > w.top + 4 && b.bottom < w.bottom - 4; });
    return ok.map((e) => [Number(e.dataset.r), Number(e.dataset.c)]); });
  const [r0, c0] = vis[0];
  const tapAt = await cellAt(r0, c0);
  await touch("touchStart", [tapAt]); await touch("touchEnd", []);
  await p.waitForTimeout(150);
  const a = await cellAt(r0 + 1, c0), b2 = await cellAt(r0 + 1, c0 + 2);
  await touch("touchStart", [a]);
  for (let i = 1; i <= 6; i++) await touch("touchMove", [[a[0] + ((b2[0] - a[0]) * i) / 6, a[1] + 3]]);
  await touch("touchEnd", []);
  await p.waitForTimeout(150);
  const marked = await p.evaluate(([r, c]) => ({ tap: !!document.querySelector(`.nc[data-r="${r}"][data-c="${c}"] .xm`),
    row: [0, 1, 2].map((i) => !!document.querySelector(`.nc[data-r="${r + 1}"][data-c="${c + i}"] .xm`)), z: window.sbNono.view().z }), [r0, c0]);
  check(`zoomed in (${marked.z.toFixed(1)}×), one finger still marks: tap marks × (${marked.tap}), drag marks a row (${marked.row})`, marked.tap && marked.row.every(Boolean) && marked.z > 1.5);
  // A one-finger drag that a second finger joins doesn't count.
  const before = await p.evaluate(() => document.querySelectorAll(".nc.f, .nc .xm").length);
  const d0 = await cellAt(r0 + 2, c0), d1 = await cellAt(r0 + 2, c0 + 2);
  await touch("touchStart", [d0]);
  for (let i = 1; i <= 4; i++) await touch("touchMove", [[d0[0] + ((d1[0] - d0[0]) * i) / 4, d0[1]]]);
  await touch("touchMove", [d1, [d1[0] + 60, d1[1] + 60]]);
  await touch("touchEnd", []);
  await p.waitForTimeout(500);
  const after = await p.evaluate(() => document.querySelectorAll(".nc.f, .nc .xm").length);
  check(`a second finger cancels the first finger's drag (${before} marked before, ${after} after)`, after === before);
  // Fit button.
  await p.click(".zfit");
  await p.waitForTimeout(600);
  const zf = await p.evaluate(() => ({ ...window.sbNono.view(), ctl: !document.getElementById("zoomCtl").hidden }));
  check(`Fit goes back to the whole board (${zf.z.toFixed(2)}×, x ${zf.x.toFixed(0)}, control hidden ${!zf.ctl})`, Math.abs(zf.z - 1) < 0.01 && Math.abs(zf.x) < 1 && !zf.ctl);
  // Pinch in past fit: smaller than fit while the fingers are down, springs back to fit after.
  await touch("touchStart", [[mid[0] - 90, mid[1] - 90], [mid[0] + 90, mid[1] + 90]]);
  for (let i = 1; i <= 8; i++) { const d = 90 - i * 9; await touch("touchMove", [[mid[0] - d, mid[1] - d], [mid[0] + d, mid[1] + d]]); }
  const squeezed = await p.evaluate(() => window.sbNono.view().z);
  await touch("touchEnd", []);
  await p.waitForTimeout(600);
  const back = await p.evaluate(() => window.sbNono.view().z);
  check(`pinching past fit gives a little (${squeezed.toFixed(2)}×) and springs back to fit (${back.toFixed(2)}×)`, squeezed < 0.97 && Math.abs(back - 1) < 0.01);
  // Two-finger double-tap = fit.
  await two([mid[0] - 30, mid[1] - 30], [mid[0] + 30, mid[1] + 30], [mid[0] - 80, mid[1] - 80], [mid[0] + 80, mid[1] + 80]);
  await p.waitForTimeout(500);
  const zin = await p.evaluate(() => window.sbNono.view().z);
  for (let i = 0; i < 2; i++) { await touch("touchStart", [[mid[0] - 30, mid[1]], [mid[0] + 30, mid[1]]]); await touch("touchEnd", []); await p.waitForTimeout(80); }
  await p.waitForTimeout(600);
  const zdt = await p.evaluate(() => window.sbNono.view().z);
  check(`two-finger double-tap goes back to fit (${zin.toFixed(2)}× → ${zdt.toFixed(2)}×)`, zin > 1.5 && Math.abs(zdt - 1) < 0.01);
  const sc = await p.evaluate(() => ({ s: [scrollY, document.querySelector(".screen").scrollTop], moves: window.__moves }));
  check(`no page scroll while touching the board (scroll ${scroll0} → ${sc.s}; ${sc.moves.filter(Boolean).length} of ${sc.moves.length} touch moves held by the board)`,
    same2(scroll0, sc.s) && sc.moves.length > 20 && sc.moves.every(Boolean));
  // The zoom is remembered for this puzzle (saved with it) and a new puzzle starts at fit.
  await two([mid[0] - 30, mid[1] - 30], [mid[0] + 30, mid[1] + 30], [mid[0] - 80, mid[1] - 80], [mid[0] + 80, mid[1] + 80]);
  await p.waitForTimeout(800);
  await p.reload();
  await p.waitForTimeout(1500);
  const kept = await p.evaluate(() => window.sbNono.view().z);
  await p.goto(`${BASE}nonogram.html?pack=hard&p=2`);
  await p.waitForTimeout(1500);
  const fresh = await p.evaluate(() => window.sbNono.view().z);
  check(`zoom remembered on this puzzle (${kept.toFixed(2)}×), a new puzzle starts at fit (${fresh.toFixed(2)}×)`, kept > 1.5 && Math.abs(fresh - 1) < 0.01);

  // Star Battle 12×12: pinch zooms (the board's transform), and one finger still marks × while zoomed.
  await p.goto(`${BASE}starbattle.html?pack=triple&p=1`);
  await p.waitForTimeout(1500);
  await p.evaluate(() => localStorage.removeItem("solvebuddy.saved"));
  await p.reload();
  await p.waitForTimeout(2000);
  const sb = await p.evaluate(() => { const r = document.getElementById("zview").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await two([sb[0] - 30, sb[1] - 30], [sb[0] + 30, sb[1] + 30], [sb[0] - 90, sb[1] - 90], [sb[0] + 90, sb[1] + 90]);
  await p.waitForTimeout(500);
  const sbz = await p.evaluate(() => ({ t: document.getElementById("board").style.transform, ctl: !document.getElementById("zoomCtl").hidden,
    count: document.getElementById("zcount").textContent, marks: document.querySelectorAll(".cell .xm, .cell svg").length }));
  const sbWin = await p.evaluate(() => { const w = document.getElementById("zview").getBoundingClientRect(), d = document.querySelector(".dock").getBoundingClientRect(),
    c = document.querySelector(".zcap").getBoundingClientRect(), s = document.querySelector(".screen").getBoundingClientRect(), n = document.getElementById("zcount").getBoundingClientRect();
    return { h: Math.round(w.height), free: Math.round(d.top - c.bottom), gl: Math.round(w.left - s.left), gr: Math.round(s.right - w.right), countAbove: n.bottom <= w.top + 1 && n.height > 0 }; });
  check(`Star Battle 12×12 zoomed: the window fills the free space, ${sbWin.h}px tall of ${sbWin.free}px, gutters ${sbWin.gl}/${sbWin.gr}; star count sits above it (${sbWin.countAbove})`,
    Math.abs(sbWin.h - sbWin.free) <= 8 && Math.abs(sbWin.gl - 16) <= 1 && Math.abs(sbWin.gr - 16) <= 1 && sbWin.countAbove);
  const sbCell = await p.evaluate(() => { const w = document.getElementById("zview").getBoundingClientRect();
    const c = [...document.querySelectorAll(".cell")].find((e) => { const b = e.getBoundingClientRect(); return b.left > w.left + 5 && b.top > w.top + 5 && b.right < w.right - 5 && b.bottom < w.bottom - 5; });
    const b = c.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: c.dataset.r, c: c.dataset.c }; });
  await touch("touchStart", [[sbCell.x, sbCell.y]]); await touch("touchEnd", []);
  await p.waitForTimeout(150);
  const sbMarked = await p.evaluate(({ r, c }) => !!document.querySelector(`.cell[data-r="${r}"][data-c="${c}"] .xm`), sbCell);
  check(`Star Battle 12×12: pinch zooms (${sbz.t}), Fit control shows, count moves to the hint line ("${sbz.count}"), no marks from the pinch (${sbz.marks}), one finger marks × (${sbMarked})`,
    /scale\((1\.[5-9]|2)/.test(sbz.t) && sbz.ctl && sbz.count.endsWith("stars") && sbz.marks === 0 && sbMarked);
  await ctx.close();
}

// In the phone app, Nonogram opens inside the app's own Star Battle page (the app opens only pages it knows): the
// built app/starbattle.html becomes Nonogram with ?game=nonogram, and is still Star Battle without it.
{
  const { pathToFileURL } = await import("node:url");
  const { join } = await import("node:path");
  const file = pathToFileURL(join(import.meta.dirname, "..", "_site", "app", "starbattle.html")).href;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const sent = [];
  await ctx.addInitScript(() => {
    window.SOLVEBUDDY_APP = { haptics: true, nativeBack: true, splash: false };
    window.__sent = [];
    window.ReactNativeWebView = { postMessage: (m) => window.__sent.push(JSON.parse(m)) };
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${file}?game=nonogram&pack=hard&p=1`);
  await p.waitForTimeout(1500);
  const asNono = await p.evaluate(() => ({ title: document.querySelector(".title b")?.textContent, cells: document.querySelectorAll(".nc").length, url: location.search }));
  await p.goto(`${file}?pack=easy&p=1`);
  await p.waitForTimeout(1500);
  const asSb = await p.evaluate(() => ({ title: document.querySelector(".title b")?.textContent, cells: document.querySelectorAll(".cell").length }));
  // Library in the app asks to open the hosted page.
  await p.goto(`${BASE}home.html`);
  await p.waitForTimeout(800);
  const open = await p.evaluate(async () => { const { openGame } = await import("./bridge.js"); openGame("nonogram", "?pack=easy&p=2"); return window.__sent.at(-1); });
  check(`app: starbattle page becomes Nonogram with ?game=nonogram (${asNono.title}, ${asNono.cells} squares, ${asNono.url}), stays Star Battle without (${asSb.title}, ${asSb.cells}); Library opens ${open.page}${open.query}; no errors (${errs.length})`,
    asNono.title === "Nonogram" && asNono.cells === 225 && asNono.url.includes("game=nonogram") && asSb.title === "Star Battle" && asSb.cells === 64
    && open.page === "starbattle" && open.query === "?game=nonogram&pack=easy&p=2" && errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await ctx.close();
}

// Library: Nonogram is a fifth tile with "New" (7 days from first seen); its pack page lists 5×5 / 10×10 / 15×15 with
// a picture thumb each and "zoom" only on 15×15; the Packs tab has its block; Stats lists it.
{
  await page.goto(`${BASE}home.html`);
  await page.waitForTimeout(800);
  await page.evaluate(() => localStorage.removeItem("solvebuddy.firstSeen"));
  await page.reload();
  await page.waitForTimeout(700);
  const lib = await page.evaluate(async () => {
    const tiles = [...document.querySelectorAll(".tile")].map((t) => t.dataset.game);
    const isNewNow = !!document.querySelector('.tile[data-game="nonogram"] .newdot');
    const { isNew } = await import("./screens.js");
    const later = isNew("nonogram", 7, Date.now() + 8 * 86400000);
    document.querySelector('.tile[data-game="nonogram"]').click();
    await new Promise((r) => setTimeout(r, 400));
    const rows = [...document.querySelectorAll(".c-row")].map((r) => ({ name: r.querySelector(".g b").textContent, thumb: !!r.querySelector(".nthumb svg"), zoom: !!r.querySelector(".zchip") }));
    return { tiles, isNewNow, later, rows };
  });
  check(`Library: Nonogram is tile 5 of ${lib.tiles.length} (${lib.tiles.join(", ")}), "New" now (${lib.isNewNow}) and gone after 7 days (${!lib.later})`,
    lib.tiles[4] === "nonogram" && lib.isNewNow && !lib.later);
  check(`Nonogram packs: ${lib.rows.map((r) => `${r.name}${r.zoom ? " (zoom)" : ""}`).join(", ")}, each with a thumb`,
    lib.rows.map((r) => r.name).join() === "5×5,10×10,15×15" && lib.rows.every((r) => r.thumb) && lib.rows.map((r) => r.zoom).join() === "false,false,true");
  await page.goto(`${BASE}packs.html`);
  await page.waitForTimeout(700);
  const blk = await page.evaluate(() => [...document.querySelectorAll('.btile[data-g="nonogram"]')].map((b) => `${b.querySelector(".n").textContent}: ${b.querySelectorAll(".c")[1].textContent}`));
  await page.goto(`${BASE}stats.html`);
  await page.waitForTimeout(500);
  const stat = await page.evaluate(() => document.getElementById("games").innerText.includes("Nonogram"));
  check(`Packs tab Nonogram block (${blk.join(" / ")}); Stats lists Nonogram (${stat})`, blk.length === 3 && blk[0] === "5×5: Easy" && stat);
}

// Water Sort pour (Colin 10/23 screenshot): the stream leaves from the lip of the mouth (its lowest corner) and falls
// into the other tube's opening; inside the pouring tube the liquid stays against the closed bottom and the poured
// colour shrinks from its top (empty space only at the open end); the other tube fills upward to meet the stream.
{
  await page.goto(`${BASE}watersort.html?pack=easy&p=1`);
  await page.waitForTimeout(1200);
  await page.evaluate(() => localStorage.removeItem("solvebuddy.saved"));
  await page.reload();
  await page.waitForTimeout(1800);
  const pour = await page.evaluate(async () => {
    const { canPour, pour: doPour } = await import("../engine/watersort/rules.ts");
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const state = (await (await fetch("../packs/watersort-easy.json")).json()).puzzles[0].tubes;
    // A pour from a tube with colours left under the poured one.
    let from = -1, to = -1;
    for (let a = 0; a < state.length && from < 0; a++) for (let b = 0; b < state.length; b++) {
      if (a === b || !canPour(state, a, b)) continue;
      const k = doPour(state, a, b)[b].length - state[b].length;
      if (state[a].length - k >= 1) { from = a; to = b; break; }
    }
    const tube = (i) => document.querySelector(`.tube[data-i="${i}"]`); // picking a tube redraws them all
    const k = doPour(state, from, to)[to].length - state[to].length;
    tube(from).click(); await wait(60); tube(to).click();
    const src = tube(from), dst = tube(to);
    // The pouring tube's mouth corners on screen: its untransformed box turned by its transform about its centre.
    const corners = () => {
      const m = new DOMMatrix(getComputedStyle(src).transform);
      const b = src.offsetParent.getBoundingClientRect(), w = src.offsetWidth, h = src.offsetHeight;
      const cx = b.left + src.offsetLeft + w / 2, cy = b.top + src.offsetTop + h / 2;
      return [-1, 1].map((sx) => { const p = m.transformPoint(new DOMPoint(sx * w / 2, -h / 2)); return { x: cx + p.x, y: cy + p.y }; });
    };
    const sample = () => {
      const units = [...src.querySelectorAll(".liquid .u")], fill = [...dst.querySelectorAll(".liquid .u")];
      const liq = src.querySelector(".liquid");
      const st = document.querySelector(".stream")?.getBoundingClientRect();
      return { top: units.at(-1).offsetHeight, lower: units.slice(0, units.length - k).map((u) => u.offsetHeight),
        moved: units.some((u) => u.style.transform && u.style.transform !== "none"),
        anchored: Math.abs(liq.offsetTop + liq.offsetHeight - (src.clientHeight - 6)) <= 2 && Math.abs(liq.offsetHeight - units.reduce((t, u) => t + u.offsetHeight, 0)) <= 1,
        fill: fill.slice(-k).reduce((t, u) => t + u.offsetHeight, 0), stream: st && { x: st.left + st.width / 2, top: st.top, bottom: st.bottom }, corners: corners() };
    };
    await wait(470); const a = sample();
    await wait(130); const b = sample();
    const t = dst.getBoundingClientRect();
    await wait(800);
    const lip = a.corners.sort((p, q) => q.y - p.y)[0];
    return { from, to, a, b, lip, target: { left: t.left, right: t.right, top: t.top } };
  });
  const { a, b, lip, target } = pour;
  const dLip = a.stream ? Math.hypot(a.stream.x - lip.x, a.stream.top - lip.y) : 999;
  check(`Water Sort pour: the stream leaves from the mouth's lip (${dLip.toFixed(1)}px away) and falls into tube ${pour.to + 1}'s opening`,
    dLip <= 8 && a.stream.x > target.left + 8 && a.stream.x < target.right - 8 && a.stream.bottom > target.top + 10);
  check(`Water Sort pour: the poured colour shrinks from its top (${a.top} → ${b.top}px) while the colours under it stay (${a.lower} → ${b.lower}), against the closed bottom (${a.anchored && b.anchored}, nothing slides to the mouth: ${!a.moved && !b.moved})`,
    b.top < a.top && JSON.stringify(a.lower) === JSON.stringify(b.lower) && a.lower.length > 0 && a.anchored && b.anchored && !a.moved && !b.moved);
  check(`Water Sort pour: the other tube fills upward to meet the stream (${a.fill} → ${b.fill}px)`, b.fill > a.fill);
}

// Water Sort overlapping pours (Colin 10/23): the board changes as a pour starts, so a third tube can be picked up and
// poured mid-pour (both animations play at once, the end board is right); the pour's own tubes can't be picked up,
// and tapping the tube being poured into (or above it) speeds the pour up; Undo mid-pour is clean.
{
  const fresh = async () => { // the page saves the board as it closes, so clear the save after that too
    await page.evaluate(() => { localStorage.removeItem("solvebuddy.saved"); addEventListener("pagehide", () => localStorage.removeItem("solvebuddy.saved")); });
    await page.reload();
    await page.waitForTimeout(1800);
  };
  await page.goto(`${BASE}watersort.html?pack=easy&p=1`);
  await page.waitForTimeout(800);
  await fresh();
  // Shared in-page helpers: two pours with no tube in common, and the board as unit counts + colours.
  const setup = `(async () => {
    const { canPour, pour } = await import("../engine/watersort/rules.ts");
    const state = (await (await fetch("../packs/watersort-easy.json")).json()).puzzles[0].tubes;
    const moves = (st) => st.flatMap((_, a) => st.map((_, b) => [a, b])).filter(([a, b]) => a !== b && canPour(st, a, b));
    let p1, p2;
    for (const m of moves(state)) {
      const next = pour(state, m[0], m[1]);
      const m2 = moves(next).find(([a, b]) => ![a, b].some((x) => m.includes(x)));
      if (m2) { p1 = m; p2 = m2; break; }
    }
    const end = pour(pour(state, ...p1), ...p2);
    window.__ws = { state, p1, p2, end,
      tube: (i) => document.querySelector('.tube[data-i="' + i + '"]'),
      board: () => [...document.querySelectorAll(".tube")].map((t) => [...t.querySelectorAll(".u")].map((u) => u.style.backgroundColor).join("|")),
      want: (st) => { const el = document.createElement("span"); return st.map((t) => t.map((c) => { el.style.backgroundColor = ({ A: "#E8574F", B: "#3E86E8", C: "#F4C542", D: "#4CB86A", E: "#9B6BD6", F: "#F28C38", G: "#EE7BB0", H: "#2BB3B1", I: "#9C6B4E", J: "#A8D45A", K: "#2F4A8A", L: "#9AA3AD" })[c]; return el.style.backgroundColor; }).join("|")); },
      pouring: () => document.querySelectorAll('.tube[style*="z-index"]').length,
      wait: (ms) => new Promise((r) => setTimeout(r, ms)) };
  })()`;
  await page.evaluate(setup);
  const lap = await page.evaluate(async () => {
    const { p1, p2, end, tube, board, want, pouring, wait } = window.__ws;
    tube(p1[0]).click(); await wait(60); tube(p1[1]).click();
    await wait(200);
    tube(p2[0]).click(); await wait(30);
    const picked = tube(p2[0]).classList.contains("up"), firstStill = pouring() === 1;
    tube(p2[1]).click(); await wait(80);
    const both = pouring();
    tube(p1[0]).click(); await wait(30); // the pouring tube can't be picked up (it speeds its pour instead)
    const busyPicked = !!document.querySelector(".tube.up");
    await wait(1400);
    return { busyPicked, picked, firstStill, both, after: pouring(), streams: document.querySelectorAll(".stream").length,
      right: JSON.stringify(board()) === JSON.stringify(want(end)), moves: document.getElementById("count").textContent };
  });
  check(`Water Sort mid-pour: the pouring tube can't be picked up (${!lap.busyPicked}); a third tube picks up (${lap.picked}) while the first pour plays (${lap.firstStill}), and its pour plays alongside (${lap.both} at once)`,
    !lap.busyPicked && lap.picked && lap.firstStill && lap.both === 2);
  check(`Water Sort overlapping pours end right: board as the rules say (${lap.right}), ${lap.moves}, nothing left playing (${lap.after} tubes, ${lap.streams} streams)`,
    lap.right && lap.moves === "2 moves" && lap.after === 0 && lap.streams === 0);

  // Tapping the tube being poured into, or the space above it, finishes the pour quickly.
  await fresh();
  await page.evaluate(setup);
  const fast = await page.evaluate(async () => {
    const { p1, end, state, tube, pouring, wait } = window.__ws;
    const timed = async (speed) => {
      tube(p1[0]).click(); await wait(60);
      const t0 = performance.now();
      tube(p1[1]).click();
      await wait(150);
      speed();
      while (pouring() && performance.now() - t0 < 3000) await wait(10);
      return Math.round(performance.now() - t0);
    };
    const onTube = await timed(() => tube(p1[1]).click());
    document.getElementById("undoBtn").click(); await wait(100);
    const above = await timed(() => {
      const r = tube(p1[1]).closest(".tube-wrap").getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top - 30;
      document.elementFromPoint(x, y).dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
    });
    document.getElementById("undoBtn").click(); await wait(100);
    const slow = await timed(() => {});
    return { onTube, above, slow };
  });
  check(`Water Sort: tapping the tube being poured into speeds the pour up (${fast.onTube}ms, above it ${fast.above}ms, untouched ${fast.slow}ms)`,
    fast.onTube < 450 && fast.above < 450 && fast.slow > 850);

  // Undo mid-pour: the animation stops cleanly and the board goes back to the start.
  await fresh();
  await page.evaluate(setup);
  const un = await page.evaluate(async () => {
    const { p1, state, tube, board, want, pouring, wait } = window.__ws;
    tube(p1[0]).click(); await wait(60); tube(p1[1]).click();
    await wait(400);
    document.getElementById("undoBtn").click(); await wait(30);
    const now = { right: JSON.stringify(board()) === JSON.stringify(want(state)), playing: pouring(), streams: document.querySelectorAll(".stream").length,
      moves: document.getElementById("count").textContent, moved: [...document.querySelectorAll(".tube")].some((t) => t.style.transform) };
    await wait(1200);
    return { ...now, later: JSON.stringify(board()) === JSON.stringify(want(state)) && !pouring() };
  });
  check(`Water Sort Undo mid-pour: back to the start (${un.right}, still ${un.later} a second later), ${un.moves}, nothing playing (${un.playing} tubes, ${un.streams} streams, moved ${un.moved})`,
    un.right && un.later && un.moves === "0 moves" && !un.playing && !un.streams && !un.moved);
}

check("no page errors anywhere", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
await browser.close();
process.exit(failed ? 1 : 0);
