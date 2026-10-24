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
    window.SB_HAPTIC_GAP = 0; // count every buzz (the 40ms throttle has its own check)
    window.__buzz = [];
    window.ReactNativeWebView = { postMessage: (m) => { const o = JSON.parse(m); if (o.type === "haptic") { (window.__raw ??= []).push({ ...o, t: performance.now() }); if (!o.again) window.__buzz.push(o.as ?? o.kind); } } }; // what the game meant (the app gets ticks, checked below)
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
    same(sb.cross, ["L2"]) && same(sb.star, ["L3"]) && same(sb.drag, ["L2", "L2", "L2", "L2"]) && same(sb.wipe, ["L2", "L2", "L2", "L2"])); // strengths, Colin 10/24
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
// Nonogram with the clue bar (Colin 10/24, docs/design/nonogram_clues_mockup.html v2), on the heart (rows 1 1 · 5 · 5 ·
// 3 · 1): (1) the × / ■ / Clear switch, drags copy the chosen mode; (2) square taps never touch the bottom; (3) a clue
// tap slides the bar up over the bottom with that line's numbers, the board doesn't move; (4) a number in the bar or on
// the board gets a slash, again to unslash; (5) the last slash ×'s the line's empty squares, one Undo; (6) the same clue
// again or a swipe down closes it, another clue swaps it, a drag follows the finger and springs back; (7) clues never
// grey and a clue never checks the line. Then hints (not swayed by slashes) solve it and the finish is the picture.
// App bridge stubbed to record every buzz.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.SOLVEBUDDY_APP = { haptics: true, nativeBack: true, splash: false };
    window.SB_HAPTIC_GAP = 0; // count every buzz (the 40ms throttle has its own check)
    window.__buzz = [];
    window.ReactNativeWebView = { postMessage: (m) => { const o = JSON.parse(m); if (o.type === "haptic") { (window.__raw ??= []).push({ ...o, t: performance.now() }); if (!o.again) window.__buzz.push(o.as ?? o.kind); } } }; // what the game meant (the app gets ticks, checked below)
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
    const ptOf = (el, dx = 0.5, dy = 0.5) => { const b = el.getBoundingClientRect(); return { clientX: b.left + b.width * dx, clientY: b.top + b.height * dy, bubbles: true, pointerId: 1 }; };
    const take = () => { const o = window.__buzz; window.__buzz = []; return o; };
    const drag = (cells) => {
      cell(...cells[0]).dispatchEvent(new PointerEvent("pointerdown", ptOf(cell(...cells[0]))));
      for (const rc of cells.slice(1)) document.dispatchEvent(new PointerEvent("pointermove", ptOf(cell(...rc))));
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    };
    const tapEl = (el, dx, dy) => { const pt = ptOf(el, dx, dy); el.dispatchEvent(new PointerEvent("pointerdown", pt)); document.dispatchEvent(new PointerEvent("pointerup", pt)); };
    const mode = (m) => document.querySelector(`#modeSw [data-mode="${m}"]`).click();
    const state = (r, c) => (cell(r, c).classList.contains("f") ? "fill" : cell(r, c).querySelector(".xm") ? "x" : "blank");
    const row = (r) => [0, 1, 2, 3, 4].map((c) => state(r, c));
    const undo = () => document.getElementById("undoBtn").click();
    const bar = document.getElementById("cbar");
    const barUp = () => !bar.hidden && bar.classList.contains("up");
    const rect = (el) => JSON.stringify(el.getBoundingClientRect());
    const rc = (r) => document.querySelector(`.rc[data-r="${r}"]`), cc = (c) => document.querySelector(`.cc[data-c="${c}"]`);
    const out = {};
    take();
    // (1) The switch: three choices; × mode cycles × → fill → clear.
    out.modes = [...document.querySelectorAll("#modeSw [data-mode]")].map((b) => b.dataset.mode);
    out.cycle = [];
    for (let i = 0; i < 3; i++) { drag([[4, 0]]); out.cycle.push(state(4, 0)); }
    out.cycleBuzz = take();
    // × drag: × onto empty squares, locked to its row (a wobble into the next row doesn't count); one Undo.
    drag([[1, 0], [1, 1], [2, 2]]);
    out.xDrag = [...row(1).slice(0, 3), state(2, 2)];
    out.xDragBuzz = take();
    undo(); take();
    out.xUndo = row(1);
    // × drag never covers a filled square: fill (4,2) (two taps), then drag × along row 5.
    drag([[4, 2]]); drag([[4, 2]]);
    drag([[4, 0], [4, 1], [4, 2], [4, 3]]);
    out.xOverFill = row(4).slice(0, 4);
    undo(); undo(); undo(); take();
    // ■ mode: a tap fills; a drag fills the run (row 2 is 5: the last square makes it right, the firm buzz).
    mode("fill"); take();
    drag([[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]]);
    out.fillDrag = row(1);
    out.fillDragBuzz = take();
    drag([[3, 1]]);
    out.fillTap = state(3, 1);
    // Clear mode: a tap empties, a tap on an empty square does nothing, a drag empties fills and × alike.
    mode("clear"); take();
    drag([[3, 1]]); out.clearTap = state(3, 1); take();
    drag([[3, 1]]); out.clearBlankBuzz = take().length;
    mode("x"); drag([[1, 0]]); drag([[1, 0]]); // (1,0) was filled: fill → blank → ×, so row 2 holds × and fills
    out.beforeClear = row(1);
    mode("clear"); take();
    drag([[1, 4], [1, 3], [1, 2], [1, 1], [1, 0]]);
    out.clearDrag = row(1);
    out.clearDragBuzz = take().length;
    undo(); take();
    // (2) Squares never open anything at the bottom.
    out.barAfterSquares = bar.hidden;
    // (3) Tap a row clue: the bar slides up with just its numbers; the board and the buttons don't move.
    const boardBefore = rect(document.getElementById("board")), dockBefore = rect(document.querySelector(".dock"));
    tapEl(rc(0));
    await wait(60);
    out.midSlide = new DOMMatrix(getComputedStyle(bar).transform).m42;
    await wait(700);
    out.openBuzz = take();
    out.barLbl = document.getElementById("cbarLbl").textContent;
    out.barNums = [...bar.querySelectorAll(".nb")].map((b) => b.textContent);
    out.settled = new DOMMatrix(getComputedStyle(bar).transform).m42;
    out.stillBoard = rect(document.getElementById("board")) === boardBefore && rect(document.querySelector(".dock")) === dockBefore;
    const br = bar.getBoundingClientRect(), dr = document.querySelector(".dock").getBoundingClientRect();
    out.coversDock = br.top <= dr.top && br.bottom >= dr.bottom && Number(getComputedStyle(bar).zIndex) > 0;
    out.clueOpen = rc(0).classList.contains("open") && !rc(1).classList.contains("open");
    out.lineTint = [0, 1, 2, 3, 4].every((c) => cell(0, c).classList.contains("hi")) && !cell(1, 0).classList.contains("hi");
    // (4) Tap a number in the bar: it gets the slash, on the board too; again: off. The board's own small number too.
    const nb = (k) => bar.querySelectorAll(".nb")[k];
    const barTap = (el) => { const pt = ptOf(el); el.dispatchEvent(new PointerEvent("pointerdown", pt)); el.dispatchEvent(new PointerEvent("pointerup", pt)); };
    barTap(nb(0));
    out.slashBar = [nb(0).classList.contains("s"), nb(1).classList.contains("s"), rc(0).querySelector('.n[data-k="0"]').classList.contains("s")];
    barTap(nb(0));
    out.unslash = [nb(0).classList.contains("s"), rc(0).querySelector('.n[data-k="0"]').classList.contains("s")];
    const small = rc(0).querySelector('.n[data-k="0"]');
    tapEl(small);
    out.slashBoard = [small.classList.contains("s"), nb(0).classList.contains("s"), barUp()];
    out.slashBuzz = take();
    out.rowZeroBefore = row(0);
    // (5) The last number slashed: × into every empty square of that line (it doesn't check the answer); one Undo.
    barTap(nb(1));
    out.autoX = row(0);
    out.autoBuzz = take();
    undo(); take();
    out.autoUndo = { row: row(0), slashes: [nb(0).classList.contains("s"), nb(1).classList.contains("s")] };
    // (6) Swipe: a short drag follows the finger and springs back; a longer one closes.
    const y0 = bar.getBoundingClientRect().top, x0 = bar.getBoundingClientRect().left + 100;
    const at = (dy) => ({ clientX: x0, clientY: y0 + 10 + dy, bubbles: true, pointerId: 7 }); // where the finger is, fixed to the screen
    bar.dispatchEvent(new PointerEvent("pointerdown", at(0)));
    bar.dispatchEvent(new PointerEvent("pointermove", at(20)));
    await wait(100); // a slow pull, not a flick
    bar.dispatchEvent(new PointerEvent("pointermove", at(40)));
    out.follows = Math.round(bar.getBoundingClientRect().top - y0);
    await wait(30);
    bar.dispatchEvent(new PointerEvent("pointerup", at(40)));
    await wait(700);
    out.springBack = [barUp(), Math.round(bar.getBoundingClientRect().top - y0)];
    bar.dispatchEvent(new PointerEvent("pointerdown", at(0)));
    for (const dy of [30, 60, 90, 120]) { await wait(16); bar.dispatchEvent(new PointerEvent("pointermove", at(dy))); }
    bar.dispatchEvent(new PointerEvent("pointerup", at(120)));
    await wait(500);
    out.swipedShut = [bar.hidden, rc(0).classList.contains("open")];
    // Another clue swaps; the same clue again (off its numbers) closes.
    tapEl(rc(0)); await wait(600);
    tapEl(cc(2)); await wait(300);
    out.swap = [barUp(), document.getElementById("cbarLbl").textContent, cc(2).classList.contains("open"), rc(0).classList.contains("open")];
    tapEl(cc(2), 0.5, 0.06); // the top of column 3's clue: above its numbers
    await wait(500);
    out.sameClose = [bar.hidden, cc(2).classList.contains("open")];
    take();
    // (7) Clues never grey: row 2 filled right (in ■ mode) looks like any other clue; a clue tap on a wrong line changes
    // nothing (no shake, no marks, no buzz beyond the bar's own tick).
    mode("clear"); drag([[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]]);
    mode("fill"); drag([[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]]); take(); // row 2 complete and right
    out.noGrey = !document.querySelector(".rc.done, .cc.done") && getComputedStyle(rc(1)).color === getComputedStyle(rc(2)).color;
    drag([[4, 0]]); take(); // column 1 now wrong
    const marksBefore = JSON.stringify(window.sbNono.state().marks);
    tapEl(cc(0)); await wait(400);
    out.noCheck = [JSON.stringify(window.sbNono.state().marks) === marksBefore, !document.querySelector(".shake"), take()];
    tapEl(cc(0), 0.5, 0.06); await wait(450);
    // Hints aren't swayed by slashes: slash every number of row 4 and column 5 (× fills), then hints still finish it.
    undo(); // the (5,1) fill
    document.getElementById("hintBtn").click(); await wait(50);
    out.nudge = document.getElementById("hintTitle").textContent;
    document.getElementById("hintNext").click(); await wait(50);
    out.chip = document.getElementById("hintChip").textContent;
    out.why = document.getElementById("hintBody").textContent;
    document.getElementById("hintClose").click(); await wait(50);
    tapEl(rc(4)); await wait(100); barTap(nb(0)); await wait(100);
    tapEl(rc(4), 0.04, 0.5); await wait(450); // close (left of the numbers)
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
    out.barDownAtWin = bar.hidden || !bar.classList.contains("up");
    return out;
  });
  check(`Nonogram switch: ${nn.modes.join(" / ")}; × taps cycle ${nn.cycle.join(" → ")}, one light buzz each (${nn.cycleBuzz})`,
    same(nn.modes, ["x", "fill", "clear"]) && same(nn.cycle, ["x", "fill", "blank"]) && same(nn.cycleBuzz, ["L2", "L3", "L2"])); // × L2, fill L3, clear L2 (Colin 10/24)
  check(`Nonogram × drag: × along its row (${nn.xDrag}), a light buzz per square (${nn.xDragBuzz}), one Undo (${nn.xUndo}); never covers a fill (${nn.xOverFill})`,
    same(nn.xDrag, ["x", "x", "x", "blank"]) && same(nn.xDragBuzz, ["L2", "L2", "L2"]) && nn.xUndo.every((m) => m === "blank") && same(nn.xOverFill, ["x", "x", "fill", "x"]));
  check(`Nonogram ■: drag fills the run (${nn.fillDrag}), each square a fill's buzz (${nn.fillDragBuzz}); a tap fills (${nn.fillTap})`,
    nn.fillDrag.every((m) => m === "fill") && same(nn.fillDragBuzz, ["L3", "L3", "L3", "L3", "L3"]) && nn.fillTap === "fill");
  check(`Nonogram Clear: a tap empties (${nn.clearTap}), an empty square stays quiet (${nn.clearBlankBuzz} buzz); a drag empties fills and × alike (${nn.beforeClear} → ${nn.clearDrag}, ${nn.clearDragBuzz} buzzes)`,
    nn.clearTap === "blank" && nn.clearBlankBuzz === 0 && nn.beforeClear.includes("x") && nn.beforeClear.includes("fill") && nn.clearDrag.every((m) => m === "blank") && nn.clearDragBuzz === 5);
  check(`Nonogram: tapping and dragging squares never brings up the bar (${nn.barAfterSquares})`, nn.barAfterSquares);
  check(`Nonogram clue tap: the bar slides up (${Math.round(nn.midSlide)}px below at 60ms, ${Math.round(nn.settled)} settled) with "${nn.barLbl}": ${nn.barNums.join(" ")}; the board and buttons don't move (${nn.stillBoard}); it covers the buttons (${nn.coversDock}); clue and line marked (${nn.clueOpen}, ${nn.lineTint}); tick (${nn.openBuzz})`,
    nn.midSlide > 20 && Math.abs(nn.settled) < 1 && nn.barLbl === "Row 1" && same(nn.barNums, ["1", "1"]) && nn.stillBoard && nn.coversDock && nn.clueOpen && nn.lineTint && same(nn.openBuzz, ["pick"]));
  check(`Nonogram slash: in the bar (${nn.slashBar}), again to unslash (${nn.unslash}), the board's small number too (${nn.slashBoard}); a tick each (${nn.slashBuzz})`,
    same(nn.slashBar, [true, false, true]) && same(nn.unslash, [false, false]) && same(nn.slashBoard, [true, true, true]) && same(nn.slashBuzz, ["L2", "L2", "L2"]));
  check(`Nonogram last slash: × into the line's empty squares (${nn.rowZeroBefore} → ${nn.autoX}), a firm buzz (${nn.autoBuzz}); one Undo takes the × and that slash back (${nn.autoUndo.row}; slashes ${nn.autoUndo.slashes})`,
    nn.rowZeroBefore.every((m) => m === "blank") && nn.autoX.every((m) => m === "x") && same(nn.autoBuzz, ["L4"]) && nn.autoUndo.row.every((m) => m === "blank") && same(nn.autoUndo.slashes, [true, false]));
  check(`Nonogram bar: a drag follows the finger (${nn.follows}px for 40) and springs back (${nn.springBack}); a swipe down closes it (${nn.swipedShut}); another clue swaps it (${nn.swap}); the same clue again closes it (${nn.sameClose})`,
    Math.abs(nn.follows - 40) <= 2 && nn.springBack[0] && Math.abs(nn.springBack[1]) <= 1 && same(nn.swipedShut, [true, false])
    && same(nn.swap, [true, "Column 3", true, false]) && same(nn.sameClose, [true, false]));
  check(`Nonogram clues never grey by themselves (${nn.noGrey}); a clue tap never checks the line (marks same ${nn.noCheck[0]}, no shake ${nn.noCheck[1]}, buzz ${nn.noCheck[2]})`,
    nn.noGrey && nn.noCheck[0] && nn.noCheck[1] && same(nn.noCheck[2], ["pick"]));
  check(`Nonogram hint: "${nn.nudge}" → ${nn.chip}: "${nn.why.slice(0, 60)}…"`, /^Look at (row|column) \d+/.test(nn.nudge) && nn.chip.length > 0 && nn.why.length > 20);
  check(`Nonogram solved by hints with slashes about: the picture card says "${nn.heading}" with the picture as the medal, colour sweep on, win buzz, bar down (${nn.barDownAtWin})`,
    nn.heading === "A heart!" && nn.medal && nn.boardWon && nn.winBuzz && nn.barDownAtWin);
  // The switch is remembered for this puzzle (Clear here) and another starts on ×.
  await p.goto(`${BASE}nonogram.html?pack=easy&p=2`);
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('#modeSw [data-mode="clear"]').click());
  await p.reload();
  await p.waitForTimeout(1500);
  const modeKept = await p.evaluate(() => ({ on: document.querySelector('#modeSw [aria-checked="true"]').dataset.mode, tip: document.getElementById("tip").textContent }));
  await p.goto(`${BASE}nonogram.html?pack=easy&p=3`);
  await p.waitForTimeout(1500);
  const modeOther = await p.evaluate(() => document.querySelector('#modeSw [aria-checked="true"]').dataset.mode);
  check(`Nonogram switch remembered per puzzle (this one ${modeKept.on}: "${modeKept.tip}"; another starts on ${modeOther})`,
    modeKept.on === "clear" && /Clear/.test(modeKept.tip) && modeOther === "x");
  // (8) 15×15 zoomed: the same bar comes up over the bottom; the board, its zoom and the pinned clue strips stay put.
  await p.evaluate(() => localStorage.setItem("solvebuddy.saved", JSON.stringify({ "nonogram/hard/1": { p: 1, marks: { "0,0": 2 }, ms: 1000, hints: 0, zoom: { z: 2.2, x: 300, y: 300 } } })));
  await p.goto(`${BASE}nonogram.html?pack=hard&p=1`);
  await p.waitForTimeout(1800);
  const zb = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const rect = (sel) => JSON.stringify(document.querySelector(sel).getBoundingClientRect());
    const top = document.querySelector(".ntop").getBoundingClientRect();
    const col = [...document.querySelectorAll(".cc")].find((el) => { const b = el.getBoundingClientRect(); return b.left >= top.left && b.right <= top.right; });
    const before = { board: rect("#board"), ntop: rect(".ntop"), nleft: rect(".nleft"), z: window.sbNono.view().z };
    const b = col.getBoundingClientRect(), pt = { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true };
    col.dispatchEvent(new PointerEvent("pointerdown", pt)); document.dispatchEvent(new PointerEvent("pointerup", pt));
    await wait(700);
    const bar = document.getElementById("cbar");
    return { z: before.z, up: !bar.hidden && bar.classList.contains("up"), lbl: document.getElementById("cbarLbl").textContent,
      want: `Column ${Number(col.dataset.c) + 1}`, nums: bar.querySelectorAll(".nb").length, clue: col.querySelectorAll(".n").length,
      still: rect("#board") === before.board && rect(".ntop") === before.ntop && rect(".nleft") === before.nleft && window.sbNono.view().z === before.z,
      fits: bar.getBoundingClientRect().right <= document.querySelector(".phone").getBoundingClientRect().right };
  });
  check(`Nonogram 15×15 zoomed ${zb.z.toFixed(1)}×: a clue tap brings up the same bar ("${zb.lbl}", ${zb.nums} numbers), the board, zoom and pinned clue strips stay put (${zb.still})`,
    zb.z > 1.5 && zb.up && zb.lbl === zb.want && zb.nums === zb.clue && zb.still && zb.fits);
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

// Library: Nonogram is a fifth tile, with no "New" tag (Colin 10/24); its pack page lists 5×5 / 10×10 / 15×15 with
// a picture thumb each and no "zoom" label (Colin 10/24), nor on any other game's pack list; the Packs tab has its
// block; Stats lists it.
{
  await page.goto(`${BASE}home.html`);
  await page.waitForTimeout(800);
  const lib = await page.evaluate(async () => {
    const tiles = [...document.querySelectorAll(".tile")].map((t) => t.dataset.game);
    const tagged = !!document.querySelector(".newdot, .tile.new") || [...document.querySelectorAll(".tile")].some((t) => /new/i.test(t.innerText));
    document.querySelector('.tile[data-game="nonogram"]').click();
    await new Promise((r) => setTimeout(r, 400));
    const rows = [...document.querySelectorAll(".c-row")].map((r) => ({ name: r.querySelector(".g b").textContent, thumb: !!r.querySelector(".nthumb svg"), zoom: /zoom/i.test(r.innerText) || !!r.querySelector(".zchip") }));
    // every other game's pack list: no "zoom" either
    const others = [];
    for (const g of ["sudoku", "starbattle", "watersort"]) {
      document.querySelector('[data-act="back"]')?.click();
      await new Promise((r) => setTimeout(r, 300));
      document.querySelector(`.tile[data-game="${g}"]`).click();
      await new Promise((r) => setTimeout(r, 400));
      const v = document.querySelector("#view:not([hidden])") ?? document.body;
      if (/zoom/i.test(v.innerText) || v.querySelector(".zchip")) others.push(g);
    }
    return { tiles, tagged, rows, others };
  });
  // Tapping the Library tab again (the app calls sbHome) goes straight home from a pack, two screens deep (Colin 10/24).
  const home = await page.evaluate(async () => {
    document.querySelector('.tile[data-game="nonogram"]').click();
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector(".c-row")?.click();
    await new Promise((r) => setTimeout(r, 300));
    const deep = !document.querySelector("#view").hidden;
    window.sbHome();
    await new Promise((r) => setTimeout(r, 300));
    return { deep, home: document.querySelector("#view").hidden && !document.querySelector(".home-main").hidden };
  });
  check(`Library tab tapped again: from a pack (${home.deep}) straight to the Library's first screen (${home.home})`, home.deep && home.home);
  check(`Library: Nonogram is tile 5 of ${lib.tiles.length} (${lib.tiles.join(", ")}), no "New" tag (${!lib.tagged})`,
    lib.tiles[4] === "nonogram" && !lib.tagged);
  check(`Nonogram packs: ${lib.rows.map((r) => `${r.name}${r.zoom ? " (zoom)" : ""}`).join(", ")}, each with a thumb, no "zoom" label here or on other games' packs (${lib.others.join(", ") || "none"})`,
    lib.rows.map((r) => r.name).join() === "5×5,10×10,15×15" && lib.rows.every((r) => r.thumb) && lib.rows.every((r) => !r.zoom) && lib.others.length === 0);
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

// Haptics on every game (Colin 10/24: he felt none in Nonogram, Water Sort, Star Battle, Block Drop). First: each built
// app page (the file the phone runs, Nonogram inside app/starbattle.html too) sends the app a haptic on a first move.
// Then, with every buzz counted (SB_HAPTIC_GAP = 0) (Nonogram's slash buzzes are in its own block): Star Battle's finished
// region = medium; Water Sort pick up / put down / soft no / pour / tube done / win; and the throttle: a fast drag
// buzzes at most every ~40ms.
{
  const { pathToFileURL } = await import("node:url");
  const { join } = await import("node:path");
  const app = (f) => { const [page, q = ""] = f.split("?"); return `${pathToFileURL(join(import.meta.dirname, "..", "_site", "app", page)).href}${q && `?${q}`}`; };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => {
    window.SOLVEBUDDY_APP = { haptics: true, nativeBack: true, splash: false };
    window.SB_HAPTIC_GAP = 0; // count every buzz (the 40ms throttle has its own check)
    window.__buzz = [];
    window.ReactNativeWebView = { postMessage: (m) => { const o = JSON.parse(m); if (o.type === "haptic") { (window.__raw ??= []).push({ ...o, t: performance.now() }); if (!o.again) window.__buzz.push(o.as ?? o.kind); } } }; // what the game meant (the app gets ticks, checked below)
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`));
  const wired = {};
  for (const [name, file, sel] of [["sudoku", "sudoku.html?pack=easy&p=1", ".cell"], ["starbattle", "starbattle.html?pack=easy&p=1", ".cell"],
    ["nonogram", "starbattle.html?game=nonogram&pack=easy&p=1", ".nc"], ["watersort", "watersort.html?pack=easy&p=1", ".tube"], ["blocks", "blocks.html", null]]) {
    await p.goto(app(file));
    await p.waitForTimeout(2600); // Block Drop's 3-2-1 countdown buzzes on its own
    if (sel) {
      await p.evaluate((sel) => {
        window.__buzz = [];
        const el = document.querySelector(sel), b = el.getBoundingClientRect(), pt = { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true };
        el.dispatchEvent(new PointerEvent("pointerdown", pt)); document.dispatchEvent(new PointerEvent("pointerup", pt)); el.click();
      }, sel);
      await p.waitForTimeout(100);
    }
    wired[name] = await p.evaluate(() => window.__buzz.length);
  }
  check(`every game's app page sends the app a haptic (${Object.entries(wired).map(([g, n]) => `${g} ${n}`).join(", ")})`,
    Object.values(wired).every((n) => n > 0));

  // The rest on the test pages, every buzz counted.
  await ctx.addInitScript(() => { window.SB_HAPTIC_GAP = 0; });
  const fresh = async (url) => {
    await p.goto(`${BASE}${url}`);
    await p.waitForTimeout(1000); // let the page finish loading before the reload
    await p.evaluate(() => { localStorage.removeItem("solvebuddy.saved"); localStorage.removeItem("solvebuddy.nonogramMode"); });
    await p.reload();
    await p.waitForTimeout(2200);
  };
  const tapAt = (sel) => p.evaluate((sel) => {
    const el = document.querySelector(sel), b = el.getBoundingClientRect(), pt = { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true };
    el.dispatchEvent(new PointerEvent("pointerdown", pt)); document.dispatchEvent(new PointerEvent("pointerup", pt));
  }, sel);
  const take = () => p.evaluate(() => { const o = window.__buzz; window.__buzz = []; return o; });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Star Battle easy #1: region D's star is 4th row, 3rd column. Star first, then × the rest: the last × finishes it.
  await fresh("starbattle.html?pack=easy&p=1");
  await take();
  for (const [r, c] of [[3, 2], [3, 2], [1, 2], [2, 2], [0, 0], [0, 1], [0, 2], [3, 3]]) await tapAt(`.cell[data-r="${r}"][data-c="${c}"]`);
  const region = await take();
  check(`Star Battle: ×, star, then × on the region's other squares; the last one finishes the region with a firmer buzz (${region})`,
    same(region, ["L2", "L3", "L2", "L2", "L2", "L2", "L2", "L4"]));
  // Throttle: a drag across 6 squares in one instant buzzes once; the same drag at a finger's pace (50ms a square), 5
  // (the first move marks the start square and the next one together, so one of those two is inside 40ms).
  const dragRow = (r, pace) => p.evaluate(async ([r, pace]) => {
    window.SB_HAPTIC_GAP = undefined;
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    await wait(200); // past any earlier buzz (a firm one's second tick lands 70ms later)
    window.__buzz = [];
    const at = (c) => { const b = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect(); return { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true }; };
    document.querySelector(`.cell[data-r="${r}"][data-c="0"]`).dispatchEvent(new PointerEvent("pointerdown", at(0)));
    for (let c = 1; c < 6; c++) { if (pace) await wait(pace); document.dispatchEvent(new PointerEvent("pointermove", at(c))); }
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    const n = window.__buzz.length;
    window.SB_HAPTIC_GAP = 0;
    return n;
  }, [r, pace]);
  const fast = await dragRow(7, 0), paced = await dragRow(6, 50);
  check(`haptics throttle: a 6-square drag in one instant buzzes ${fast} time(s); at 50ms a square, ${paced}`, fast === 1 && paced === 5);

  // Water Sort easy #1 (reduced motion: pours are quick): an empty tube = the soft no; pick up = tap; put down = tick;
  // then the solver's moves: each pour thuds, a pour that finishes a tube thuds again as it lands, the last one wins.
  await fresh("watersort.html?pack=easy&p=1");
  const ws = await p.evaluate(async () => {
    const { solve } = await import("../engine/watersort/solve.ts");
    const { pour, isDone } = await import("../engine/watersort/rules.ts");
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const take = () => { const o = window.__buzz; window.__buzz = []; return o; };
    const tube = (i) => document.querySelector(`.tube[data-i="${i}"]`);
    let state = (await (await fetch("../packs/watersort-easy.json")).json()).puzzles[0].tubes;
    const out = {};
    take();
    tube(state.findIndex((t) => !t.length)).click(); out.empty = take();
    tube(0).click(); out.up = take();
    tube(0).click(); out.down = take();
    out.moves = [];
    for (const [a, b] of solve(state).path) {
      const after = pour(state, a, b), fills = after[b].length > 0 && isDone(after[b]);
      tube(a).click(); await wait(30); tube(b).click(); await wait(400);
      out.moves.push({ fills, buzz: take() });
      state = after;
    }
    return out;
  });
  const fillMoves = ws.moves.slice(0, -1).filter((m) => m.fills), plain = ws.moves.filter((m) => !m.fills), last = ws.moves.at(-1);
  check(`Water Sort: empty tube ${ws.empty}, pick up ${ws.up}, put down ${ws.down}; ${plain.length} pours "tap,thud", ${fillMoves.length} that finish a tube (${fillMoves.map((m) => m.buzz).join(" / ")}), last pour ${last.buzz}`,
    same(ws.empty, ["warn"]) && same(ws.up, ["tap"]) && same(ws.down, ["pick"]) && plain.every((m) => same(m.buzz, ["tap", "thud"]))
    && fillMoves.length > 0 && fillMoves.every((m) => same(m.buzz, ["tap", "thud", "thud"])) && last.buzz.includes("success") && !last.buzz.slice(2).includes("thud"));
  const sentKinds = await p.evaluate(() => [...new Set(window.__raw.map((o) => o.kind))]);
  // What the app actually gets (Colin 10/24, one step up): L1 two ticks ~70ms apart, L2 the app's medium thud, L3 thud
  // + a tick ~70ms later, L4 thud + thud ~70ms later, L5 success. Kinds: tap = L1, thud = L2, success = L5, warn = a
  // thud + a tick ~140ms later. A newer buzz cancels a pending second one (fast drags).
  await fresh("stats.html"); // a quiet page, so nothing else buzzes meanwhile (the Solved card does)
  const wire = await p.evaluate(async () => {
    const { haptic, hapticLevel } = await import("./bridge.js");
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const out = {};
    for (const k of ["tap", "thud", "warn", "success"]) {
      await wait(200);
      window.__raw = [];
      haptic(k);
      await wait(250);
      out[k] = { kinds: window.__raw.map((o) => o.kind), gap: window.__raw.length > 1 ? Math.round(window.__raw[1].t - window.__raw[0].t) : 0 };
    }
    for (const n of [1, 2, 3, 4, 5]) {
      await wait(200);
      window.__raw = [];
      hapticLevel(n);
      await wait(250);
      out[`L${n}`] = window.__raw.map((o) => o.kind).join("+");
    }
    // L1, then another L1 30ms later (SB_HAPTIC_GAP is 0 here): the first one's second tick is dropped.
    await wait(200);
    window.__raw = [];
    hapticLevel(1); await wait(30); hapticLevel(1); await wait(250);
    out.overlap = window.__raw.map((o) => o.kind + (o.again ? "'" : "")).join("+");
    return out;
  });
  check(`levels: ${[1, 2, 3, 4, 5].map((n) => `L${n} ${wire[`L${n}`]}`).join(", ")}; L1 then L1 30ms later: ${wire.overlap}`,
    wire.L1 === "pick+pick" && wire.L2 === "thud" && wire.L3 === "thud+pick" && wire.L4 === "thud+thud" && wire.L5 === "success" && wire.overlap === "pick+pick+pick'");
  check(`kinds: tap ${wire.tap.kinds} (${wire.tap.gap}ms), thud ${wire.thud.kinds}, warn ${wire.warn.kinds} (${wire.warn.gap}ms), success ${wire.success.kinds}; Water Sort play sent ${sentKinds.join(", ")}`,
    sentKinds.every((k) => ["pick", "thud", "success"].includes(k)) && same(wire.tap.kinds, ["pick", "pick"]) && wire.tap.gap >= 55 && wire.tap.gap <= 120
    && same(wire.thud.kinds, ["thud"]) && same(wire.warn.kinds, ["thud", "pick"]) && wire.warn.gap >= 120 && same(wire.success.kinds, ["success"]));
  await ctx.close();
}

check("no page errors anywhere", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
await browser.close();
process.exit(failed ? 1 : 0);
