// Sudoku play page: the approved 9×9 design, wired to the real engine and the Easy pack.
// Imported puzzles (?import=<id>, Colin 10/22) save and log under pack "import" with p = the import's id.
import { hint as findHint, writeMarks } from "../engine/sudoku/hint.ts";
import { rulesOf } from "../engine/sudoku/variants.ts";
import { clearSaved, goHome, haptic, logSolve, moreMenu, saveFinal, saveGame, savedGame, showHintsUsed, smoothClose, solves } from "./bridge.js";
import { celebrate, openWipe, solveFacts, solvedBar } from "./celebrate.js";
import { makeZoom, second } from "./zoom.js";

// The phone app's offline page carries the packs inside it (SB_PACKS); otherwise fetch them.
const loadPack = async (f) => globalThis.SB_PACKS?.[f] ?? (await fetch(`../packs/${f}`)).json();
const PACKS = {
  easy: await loadPack("sudoku9-easy-starter.json"),
  medium: await loadPack("sudoku9-medium.json"),
  hard: await loadPack("sudoku9-hard.json"),
  expert: await loadPack("sudoku9-expert.json"),
  tricks: await loadPack("sudoku9-tricks.json"), // one test per harder trick
  killer: await loadPack("sudoku9-killer-easy.json"), // cages that add up (Colin, 10/22)
  thermo: await loadPack("sudoku9-thermo-easy.json"), // numbers climb from the bulb (Colin, 10/22)
  "killer-expert": await loadPack("sudoku9-killer-expert.json"), // the 45 rule (Colin, 10/22)
  "thermo-expert": await loadPack("sudoku9-thermo-expert.json"), // one to start (Colin, 10/22)
};
const VARIANT_NAMES = { killer: "Killer", thermo: "Thermo" };
const query = new URLSearchParams(location.search);
const importId = query.get("import");
// An import lives in this phone's storage (made here) or in the bundled imports.json (added by Claude). In the app,
// a just-made import can reach this page's copy of storage a moment late, so look again for up to 2 seconds.
const IMPORTS_KEY = "solvebuddy.imports";
async function findImport(id) {
  const bundled = (await loadPack("imports.json").catch(() => null))?.puzzles ?? [];
  for (let tries = 0; tries < 20; tries++) {
    let mine = [];
    try { mine = JSON.parse(localStorage.getItem(IMPORTS_KEY) || "[]"); } catch {}
    const item = [...mine, ...bundled].find((p) => p.id === id && p.game === "sudoku");
    if (item) return item;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
if (importId) PACKS.import = { id: "import", difficulty: "Imported", puzzles: [] };
let packName = importId ? "import" : PACKS[query.get("pack")] ? query.get("pack") : "easy";
let pack = PACKS[packName];
const STRIPES = "repeating-linear-gradient(135deg, rgba(194,78,42,0.38) 0 4px, rgba(255,255,255,0) 4px 10px)";
const $ = (id) => document.getElementById(id);
const key = (r, c) => `${r},${c}`;
// Corner marks (Colin 10/27, S10, mockup option B): every number has its own spot, laid out like a phone keypad and
// pushed to the edges: 1 2 3 along the top, 4 and 6 on the sides, 7 8 9 along the bottom, and the 5 just under the 2,
// so nothing sits in the middle (that's for Center marks). In a cell with a Killer cage sum, 1 2 3 slide right of it.
// Spot = the mark's centre, in px from the cell's top-left.
const SPOT_X = [7, 19.5, 32], SPOT_Y = [6, 19.5, 32];
function cornerSpot(d, sum) {
  if (d === 5) return [19.5, 14.5]; // always the same spot, just under the middle of the top row
  if (sum && d <= 3) return [[22, 27.5, 33][d - 1], 6]; // clear of a two-digit sum, so "18" never reads as "181"
  return [SPOT_X[(d - 1) % 3], SPOT_Y[Math.floor((d - 1) / 3)]];
}

// Two-finger zoom, the same as Star Battle's big boards (web/zoom.js), inside the board's own square: the number pad
// below stays where it is. One finger still selects.
const BOARD_PX = 3 + 9 * 39; // the board's 3px top/left frame + its cells
const zoom = makeZoom({
  view: $("zview"), ctl: $("zoomCtl"), tip: $("tip"), zmax: 2.2,
  geom: (z) => ({ ox: 0, oy: 0, visW: BOARD_PX, visH: BOARD_PX, w: BOARD_PX * z, h: BOARD_PX * z }),
  apply: ({ z, x, y }) => { $("board").style.transform = z === 1 && !x && !y ? "" : `translate(${-x}px, ${-y}px) scale(${z})`; },
  mapColors: () => Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => (valueAt(r, c) ? "#2A211B" : "#FFFDF9"))),
  onTwoFingers: () => (drag = null),
});

let idx = importId ? 0 : Math.max(0, Math.min(pack.puzzles.length - 1, Number(query.get("p") || 1) - 1));
// Which puzzle this is for saves, solves and your finished board: its number in a pack, or an import's id.
const pid = () => (packName === "import" ? importId : idx + 1);
let s; // game state
const undoStack = []; // board snapshots for Undo

// Game settings: same names and defaults as the Settings screen mockup. Remembered in this browser.
const SETTINGS_KEY = "solvebuddy.settings";
const settings = { timer: true, mistakes: false, hl: true, same: true, reach: true };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
} catch {}
function flipSetting(name) {
  settings[name] = !settings[name];
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
  render();
}

// first = the page just opened: the blue wipe plays first, so the board waits for it.
function load(i, name = packName, first = false) {
  packName = name;
  pack = PACKS[name];
  idx = i;
  undoStack.length = 0;
  const p = pack.puzzles[i];
  s = { givens: p.givens, solution: p.solution, entries: {}, corner: {}, center: {}, sel: null, picked: new Set(), mode: s?.mode || "normal",
    hint: null, started: Date.now(), elapsed: 0, solved: false, rules: false, settingsOpen: false, extra: rulesOf(p) };
  $("variantRule").hidden = !s.extra;
  if (s.extra) $("variantRuleText").innerHTML = s.extra.variant === "killer"
    ? "<strong>Killer:</strong> the numbers in each dashed cage add up to its small number, and never repeat inside a cage."
    : "<strong>Thermo:</strong> along each grey thermometer, numbers climb from the round bulb to the end.";
  // Killer zooms with two fingers (Colin 10/27, S11: the cage sums are small): at fit for a new puzzle.
  const zoomOn = s.extra?.variant === "killer";
  $("zview").style.width = $("zview").style.height = zoomOn ? `${BOARD_PX}px` : "";
  zoom.reset(zoomOn);
  // Pick up where you left off (Colin, 10/21).
  // An import starts from the numbers you'd already filled in (from the photo, or made by hand).
  const saved = savedGame("sudoku", name, pid());
  if (saved) {
    Object.assign(s, { entries: saved.entries ?? {}, corner: saved.corner ?? {}, center: saved.center ?? {} });
    s.started = Date.now() - (saved.ms ?? 0);
    s.hints = saved.hints ?? 0;
  } else if (name === "import") s.entries = { ...(p.entries ?? {}) };
  $("sub").textContent = name === "import" ? "Imported · Classic 9×9"
    : p.label ? `Classic 9×9 · ${p.label}` : `${VARIANT_NAMES[p.variant] ?? "Classic 9×9"} · ${pack.difficulty} · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", name === "import" ? `?import=${encodeURIComponent(importId)}` : `?pack=${name}&p=${i + 1}`);
  // "View solved puzzle" from the pack's numbers: the finished board, read-only, with your best time.
  if (first && query.get("view")) {
    s.givens.forEach((row, r) => row.forEach((v, c) => { if (!v) s.entries[key(r, c)] = s.solution[r][c]; }));
    const best = solves().filter((e) => e.g === "sudoku" && e.pack === name && e.p === pid()).map((e) => e.ms);
    s.solved = true;
    s.elapsed = best.length ? Math.min(...best) : 0;
    $("time").textContent = fmt(s.elapsed);
    solvedBar(s.elapsed, () => { clearSaved("sudoku", packName, pid()); load(idx); });
  }
  // The clues drop in box by box, then the number pad rises key by key.
  s.introAt = Date.now();
  s.introWait = first ? 0.45 : 0.05;
  const pad = $("pad");
  pad.querySelectorAll(".key").forEach((k, n) => k.style.setProperty("--d", `${(s.introWait + 1.05 + n * 0.04).toFixed(2)}s`));
  pad.classList.remove("intro");
  void pad.offsetWidth;
  pad.classList.add("intro");
  renderPicker();
  render();
}

function saveUndo() {
  undoStack.push(JSON.stringify({ entries: s.entries, corner: s.corner, center: s.center }));
}
// The 20 cells sharing a row, column or box with (r, c).
const peersOf = (r, c) => {
  const out = [];
  for (let i = 0; i < 9; i++) {
    if (i !== c) out.push([r, i]);
    if (i !== r) out.push([i, c]);
    const a = Math.floor(r / 3) * 3 + Math.floor(i / 3), b = Math.floor(c / 3) * 3 + (i % 3);
    if (a !== r && b !== c) out.push([a, b]);
  }
  return out;
};
const valueAt = (r, c) => s.givens[r][c] || s.entries[key(r, c)] || 0;
const board = () => s.givens.map((row, r) => row.map((_, c) => valueAt(r, c)));

// Any change to the board closes an open hint; the next tap recomputes from the new board.
function change(fn) {
  if (s.solved) return;
  saveUndo();
  fn();
  s.hint = null;
  checkSolved();
  render();
}

// Selected cells you can change (drag selects several, Colin 10/21; givens are skipped).
const pickedOpen = () => [...s.picked].filter((k) => { const [r, c] = k.split(",").map(Number); return !s.givens[r][c]; });
function selectOnly(r, c) {
  s.sel = [r, c];
  s.picked = new Set([key(r, c)]);
}

// A number goes into every selected cell. A pencil mark is added to all of them, or taken off all of them if
// they all have it already.
function press(n) {
  const ks = pickedOpen();
  if (!ks.length) return;
  haptic("tap");
  change(() => {
    if (s.mode === "normal") {
      for (const k of ks) {
        s.entries[k] = n;
        delete s.corner[k];
        delete s.center[k];
      }
      return;
    }
    const map = s.mode === "corner" ? s.corner : s.center;
    const off = ks.every((k) => map[k]?.includes(n));
    for (const k of ks) {
      const marks = new Set(map[k] || []);
      off ? marks.delete(n) : marks.add(n);
      if (marks.size) map[k] = [...marks].sort();
      else delete map[k];
      delete s.entries[k];
    }
  });
}

function erase() {
  const ks = pickedOpen();
  if (!ks.length) return;
  haptic("tap");
  change(() => {
    for (const k of ks) {
      delete s.entries[k];
      delete s.corner[k];
      delete s.center[k];
    }
  });
}

function checkSolved() {
  const b = board();
  if (s.solved || !b.every((row, r) => row.every((v, c) => v === s.solution[r][c]))) return;
  s.solved = true;
  s.elapsed = Date.now() - s.started;
  s.winAt = Date.now(); // a blue flash sweeps the board corner to corner, then the Solved! card rises
  clearSaved("sudoku", packName, pid());
  saveFinal("sudoku", packName, pid(), { entries: { ...s.entries } });
  haptic("success");
  [250, 500, 750].forEach((ms) => setTimeout(() => haptic("tap"), ms)); // ticks with the blue sweep
  const facts = solveFacts("sudoku", packName, s.elapsed, Math.round((s.hints ?? 0) * 100) / 100);
  logSolve({ g: "sudoku", pack: packName, p: pid(), ms: s.elapsed, hints: Math.round((s.hints ?? 0) * 100) / 100 });
  const p = pack.puzzles[idx];
  celebrate({ title: packName === "import" ? "Imported puzzle" : p.label || `${pack.difficulty} #${idx + 1}`, level: pack.difficulty, facts,
    hasNext: packName !== "import" && idx < pack.puzzles.length - 1,
    onNext: () => load(idx + 1), delay: 1000 });
}

// Hint: tap the bulb → Nudge; then Explain; then Show me (does the move); then Done.
// Hints only see the board: your numbers and your center pencil marks (Colin, 10/20).
function openHint() {
  if (s.solved) return;
  if (s.hint) {
    s.hint = null;
    return render();
  }
  s.hints = (s.hints ?? 0) + 1 / 3; // each hint step (Nudge, Explain, Show me) counts a third (Colin, 10/22)
  s.hint = { data: findHint(board(), s.solution, s.center, s.corner, s.extra), level: 1 };
  render();
}
function advanceHint() {
  const h = s.hint;
  if (h.data.kind === "stuck" || h.level === 3) {
    s.hint = null;
    checkSolved();
    return render();
  }
  h.level++;
  s.hints = (s.hints ?? 0) + 1 / 3;
  if (h.level === 3) {
    saveUndo();
    const d = h.data;
    // Show me, a rule-out: write it into pencil marks so it's on the board for the next hint.
    if (!d.target) {
      writeMarks(d, s.center, s.corner);
      for (const { cell, marks } of d.pencil ?? []) {
        const k = key(...cell); // corner marks that the new center marks rule out go away
        if (s.corner[k]) s.corner[k] = s.corner[k].filter((n) => marks.includes(n));
        if (!s.corner[k]?.length) delete s.corner[k];
      }
      return render();
    }
    placeHint(d);
  }
  render();
}
// Show me: do the move (place the number, or clear the mistake).
function placeHint(d) {
  const [r, c] = d.target;
  const k = key(r, c);
  if (d.value) s.entries[k] = d.value;
  else delete s.entries[k];
  delete s.corner[k];
  delete s.center[k];
  selectOnly(r, c);
}

// Killer cages (dashed outline, sum in the top-left corner) and Thermo lines (grey bulb and line), drawn over the cell
// backgrounds but under the numbers. Cells are 39px apart (their lines are inside them), after the board's 3px frame.
const CELL = 39;
const edgeAt = (i) => 3 + i * CELL; // left (or top) of cell i, from the board's outer corner
const lineIn = (i) => (i % 3 === 2 ? 3 : 1); // the grid line inside cell i's right (or bottom) edge
function extraLayer() {
  const x = s.extra;
  if (!x) return "";
  const parts = [];
  const mid = (i) => edgeAt(i) + CELL / 2;
  for (const line of x.thermos ?? []) {
    const pts = line.map(([r, c]) => `${mid(c)},${mid(r)}`).join(" ");
    // Bulb and tube are opaque inside one group, and the see-through is on the group: the thermometer reads as ONE
    // flat shape, with no darker patch where the tube runs into the bulb (Colin, 10/23).
    const [br, bc] = line[0];
    parts.push(`<g class="thermo" opacity="0.55"><polyline points="${pts}" fill="none" stroke="#BDB6AD" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<circle cx="${mid(bc)}" cy="${mid(br)}" r="15" fill="#BDB6AD"/></g>`);
  }
  for (const cage of x.cages ?? []) {
    const inCage = (r, c) => cage.cells.some(([a, b]) => a === r && b === c);
    const pad = 3;
    for (const [r, c] of cage.cells) {
      // A cell's own grid line sits inside its right and bottom (1px, or 3px at a box edge), so those sides measure from
      // that line: the dashes sit the same distance in on all four sides (Colin 10/27, S4: the bottom sat too low).
      const bx = lineIn(c), by = lineIn(r);
      const x0 = edgeAt(c) + pad, y0 = edgeAt(r) + pad, x1 = edgeAt(c) + CELL - bx - pad, y1 = edgeAt(r) + CELL - by - pad;
      // Each side with no cage neighbour gets a dashed edge; sides shared inside the cage stay open (extended to meet).
      const L = inCage(r, c - 1), R = inCage(r, c + 1), U = inCage(r - 1, c), D = inCage(r + 1, c);
      const ext = pad + 1, extR = pad + bx + 1, extD = pad + by + 1;
      if (!U) parts.push(`<line x1="${x0 - (L ? ext : 0)}" y1="${y0}" x2="${x1 + (R ? extR : 0)}" y2="${y0}"/>`);
      if (!D) parts.push(`<line x1="${x0 - (L ? ext : 0)}" y1="${y1}" x2="${x1 + (R ? extR : 0)}" y2="${y1}"/>`);
      if (!L) parts.push(`<line x1="${x0}" y1="${y0 - (U ? ext : 0)}" x2="${x0}" y2="${y1 + (D ? extD : 0)}"/>`);
      if (!R) parts.push(`<line x1="${x1}" y1="${y0 - (U ? ext : 0)}" x2="${x1}" y2="${y1 + (D ? extD : 0)}"/>`);
    }
    const [r, c] = cage.cells[0];
    parts.push(`<text x="${edgeAt(c) + 4}" y="${edgeAt(r) + 11}" class="sum">${cage.sum}</text>`);
  }
  return `<svg class="extra" width="${edgeAt(9)}" height="${edgeAt(9)}" aria-hidden="true">${parts.join("")}</svg>`;
}

function render() {
  showHintsUsed(s.solved ? 0 : s.hints); // the quiet "You've used ⅓ of a hint" line over Hint (Colin, 10/23)
  const h = s.hint;
  const step = h?.data;
  const shown = h && h.level >= 2;
  const focus = new Set(step ? step.focus.map(([r, c]) => key(r, c)) : []);
  const target = shown && h.data.target ? key(...h.data.target) : null;
  // Striped = ruled out by a trick or your marks; a plain red shade = there's already that number in the line.
  const striped = new Set(shown ? [...(step.remove ?? []), ...(step.inferred ?? [])].map(([r, c]) => key(r, c)) : []);
  const spots = new Set(shown && step.spots ? step.spots.map(([r, c]) => key(r, c)) : []);
  // From Explain on: the numbers that block the other cells, and the row, column or box each blocks through
  // (light red, shown over the hint's own shading so the whole line stays visible).
  const blockers = shown && step.blockers ? step.blockers : [];
  const blockerCells = new Set(blockers.map((b) => key(...b.cell)));
  const blockLines = new Set(blockers.flatMap((b) => b.line.map(([r, c]) => key(r, c))));
  const [sr, sc] = s.sel || [-1, -1];
  const selVal = s.sel ? valueAt(sr, sc) : 0;
  const intro = Date.now() - s.introAt < 1500;
  const won = s.winAt && Date.now() - s.winAt < 1500;

  // Tap a placed number: the row, column and box of every copy of it light up, so the open cells left show where it
  // can still go (Colin 10/27, S7; a setting). An empty cell, or several picked, highlight as before.
  // "Show mistakes as I play" also reds a pencil mark when that number is already in the cell's row, column or box
  // (Colin 10/27, S8). Only clashes you can see: checking marks against the answer would give the answer away.
  const bad = (r, c, d) => settings.mistakes && !s.solved && peersOf(r, c).some(([a, b]) => valueAt(a, b) === d);
  // Several selected cells get ONE outline round the group: a side is drawn only where the next cell isn't selected
  // (Colin 10/27, S9). A lone cell keeps its full ring.
  const groupRing = (r, c) => {
    const on = (a, b) => !h && s.picked.has(key(a, b));
    const sides = [!on(r - 1, c) && "0 2px", !on(r + 1, c) && "0 -2px", !on(r, c - 1) && "2px 0", !on(r, c + 1) && "-2px 0"].filter(Boolean);
    return sides.length ? sides.map((xy) => `inset ${xy} 0 0 var(--sel-ring)`).join(", ") : "none";
  };
  const sumCells = new Set((s.extra?.cages ?? []).map((g) => key(...g.cells[0]))); // where a cage's sum is written
  const reach = new Set();
  if (settings.reach && !h && selVal && s.picked.size === 1) {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (valueAt(r, c) !== selVal) continue;
      for (let i = 0; i < 9; i++) {
        reach.add(key(r, i)).add(key(i, c));
        reach.add(key(Math.floor(r / 3) * 3 + Math.floor(i / 3), Math.floor(c / 3) * 3 + (i % 3)));
      }
    }
  }
  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const k = key(r, c);
      const g = s.givens[r][c];
      const v = valueAt(r, c);
      const isSel = !h && s.picked.has(k);
      const peer = (settings.hl && !h && s.sel && s.picked.size === 1 && (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3))))
        || reach.has(k);
      const same = settings.same && !h && selVal && v === selVal && !isSel;
      const wrong = settings.mistakes && !g && v && v !== s.solution[r][c];
      let bg = "var(--board)";
      if (peer) bg = "var(--peer)";
      if (same) bg = "var(--same)";
      if (wrong) bg = "var(--conflict-cell)";
      if (isSel) bg = "var(--sel)";
      // Colin, 10/21: blue = the hint's area and where the number can go (outlined) or goes; red = can't go
      // (the lines blocking numbers cast, striped cells).
      if (focus.has(k)) bg = "color-mix(in srgb, var(--same) 80%, var(--board))";
      if (blockLines.has(k)) bg = "var(--accent-soft)";
      if (blockerCells.has(k)) bg = "color-mix(in srgb, var(--accent-mid) 70%, var(--board))";
      if (k === target) bg = "var(--sel)";
      if (striped.has(k)) bg = `${STRIPES}, ${bg}`;
      const ring = k === target || spots.has(k) ? "inset 0 0 0 3px var(--sel-ring)" : blockerCells.has(k) ? "inset 0 0 0 2px var(--accent-dark)" : isSel ? groupRing(r, c) : "none";
      let inner = "";
      if (v) {
        const cls = g ? "v given" : wrong ? "v wrong" : k === target && h.level === 3 ? "v shown" : "v";
        inner += `<span class="${cls}">${v}</span>`;
      } else if (s.center[k]) {
        inner += `<span class="ctr">${s.center[k].map((d) => (bad(r, c, d) ? `<b>${d}</b>` : d)).join("")}</span>`;
      }
      if (!v && s.corner[k]) inner += s.corner[k].map((d) => {
        const [x, y] = cornerSpot(d, sumCells.has(k));
        return `<span class="cn${bad(r, c, d) ? " bad" : ""}" style="left:${x}px;top:${y}px">${d}</span>`;
      }).join("");
      const cls = ["cell", c % 3 === 2 ? "br" : "", r % 3 === 2 ? "bb" : "", intro ? "drop" : "", won ? "won wave" : ""].join(" ");
      const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const d = intro ? s.introWait + 0.15 + box * 0.09 + ((r % 3) * 3 + (c % 3)) * 0.025 : (r + c) * 0.03;
      cells.push(`<button class="${cls}" data-r="${r}" data-c="${c}" style="--d:${d.toFixed(3)}s;background:${bg};box-shadow:${ring}" aria-label="Row ${r + 1} column ${c + 1}, ${v || "empty"}">${inner}</button>`);
    }
  }
  $("board").innerHTML = cells.join("") + extraLayer();

  document.querySelectorAll(".seg[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === s.mode));
  $("pad").classList.toggle("pencil", s.mode !== "normal");
  $("hintBtn").classList.toggle("pressed", !!h);

  $("hint").hidden = !h;
  if (h) {
    const d = h.data;
    const stuck = d.kind === "stuck";
    $("hintStep").textContent = stuck ? "Hint" : ["Nudge", "Explain", "Show me"][h.level - 1];
    $("hintChip").textContent = d.technique;
    $("hintChip").hidden = !d.technique || h.level === 1;
    [1, 2, 3].forEach((n) => $("d" + n).classList.toggle("on", h.level >= n));
    const text = [
      [d.nudge, ""],
      [d.nudge, d.explain],
      [d.showMe, d.explain],
    ][stuck ? 1 : h.level - 1];
    const next = stuck ? "Close" : ["Explain", "Show me", "Done"][h.level - 1];
    // Cell names match the board from Explain on (Colin, 10/21): blue = the trick's cells, red = ruled out.
    const blue = new Set([...(d.spots ?? []), ...(d.target ? [d.target] : [])].map(([r, c]) => `R${r + 1}C${c + 1}`));
    const red = new Set((d.remove ?? []).map(([r, c]) => `R${r + 1}C${c + 1}`));
    const paint = (t) => t.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch])
      .replace(/R\dC\d/g, (n) => (h.level < 2 ? n : blue.has(n) ? `<b class="cn blue">${n}</b>` : red.has(n) ? `<b class="cn red">${n}</b>` : n));
    $("hintTitle").innerHTML = paint(text[0]);
    $("hintBody").innerHTML = paint(text[1]);
    $("hintBody").hidden = !text[1];
    $("hintNextLabel").textContent = next;
  }

  $("rules").hidden = !s.rules;
  $("settings").hidden = !s.settingsOpen;
  document.querySelectorAll("[data-set]").forEach((b) => b.setAttribute("aria-checked", String(!!settings[b.dataset.set])));
  $("timer").classList.toggle("notime", !settings.timer); // the pause button stays even with the clock hidden
  $("paused").hidden = !s.pausedAt;
  if (s.pausedAt) $("pausedText").textContent = `${$("sub").textContent} · ${fmt(s.pausedAt - s.started)}`;
}

function renderPicker() {
  const p = $("picker");
  p.querySelectorAll("button, .lbl").forEach((b) => b.remove());
  for (const [name, pk] of Object.entries(PACKS)) {
    if (name === "import") continue;
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = `${pk.variant ? `${VARIANT_NAMES[pk.variant]} ` : ""}${pk.difficulty}:`;
    lbl.style.marginLeft = "6px";
    p.appendChild(lbl);
    pk.puzzles.forEach((_, i) => {
      const b = document.createElement("button");
      b.textContent = i + 1;
      b.className = name === packName && i === idx ? "on" : "";
      b.onclick = () => load(i, name);
      p.appendChild(b);
    });
  }
}

const fmt = (ms) => {
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

// Wiring
$("pad").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-n="${d}" aria-label="Enter ${d}">${d}</button>`).join("");
$("pad").onclick = (e) => {
  const b = e.target.closest("[data-n]");
  if (b) press(Number(b.dataset.n));
};
// Tap a cell to select it. Press and drag to select every cell you pass (Ctrl or Shift adds to the selection),
// then type a number, a pencil mark or Erase to change them all at once. Works for mouse and finger alike.
let drag = null; // { last: [r, c] }
const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest?.(".cell");
$("board").addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".cell");
  if (!b || zoom.busy || second(e)) return; // two fingers zoom; only the first finger selects
  e.preventDefault();
  const r = Number(b.dataset.r), c = Number(b.dataset.c);
  if (e.ctrlKey || e.metaKey || e.shiftKey) s.picked.add(key(r, c)), (s.sel = [r, c]);
  else selectOnly(r, c);
  haptic("pick"); // selecting = the lightest tick; placing a number is the firmer "tap" (Colin, 10/23)
  drag = { last: [r, c] };
  render();
});
document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (zoom.busy) return (drag = null);
  const b = cellAt(e.clientX, e.clientY);
  if (!b) return;
  const r = Number(b.dataset.r), c = Number(b.dataset.c);
  const [r0, c0] = drag.last;
  if (r === r0 && c === c0) return;
  // A fast swipe can skip cells between two moves, so pick every cell on the straight line in between.
  const steps = Math.max(Math.abs(r - r0), Math.abs(c - c0));
  for (let i = 1; i <= steps; i++) {
    const k = key(Math.round(r0 + ((r - r0) * i) / steps), Math.round(c0 + ((c - c0) * i) / steps));
    if (!s.picked.has(k)) haptic("pick"); // a tick for each cell the drag adds
    s.picked.add(k);
  }
  drag.last = [r, c];
  s.sel = [r, c];
  render();
});
document.addEventListener("pointerup", () => (drag = null));
// A tap on empty space (off the board and every button) lets go of the selected cells (Colin 10/27, S5).
document.addEventListener("pointerdown", (e) => {
  if (!s.sel || e.target.closest("button, .board, .pad, .modes, .hint, .scrim, .sheet, .paused")) return;
  s.sel = null;
  s.picked = new Set();
  render();
});
document.querySelectorAll(".seg[data-mode]").forEach((b) => (b.onclick = () => { s.mode = b.dataset.mode; render(); }));
$("eraseBtn").onclick = erase;
$("backBtn").onclick = goHome;
$("undoBtn").onclick = () => {
  if (!undoStack.length || s.solved) return;
  haptic("tap");
  Object.assign(s, JSON.parse(undoStack.pop()));
  s.hint = null;
  render();
};
const openMore = moreMenu({
  settingsNote: "Timer, show mistakes, highlights",
  onSettings: () => { s.settingsOpen = true; render(); },
  onRestart: () => { clearSaved("sudoku", packName, pid()); load(idx); },
});
$("settingsBtn").onclick = () => { s.settingsOpen = true; render(); };
$("restartBtn").onclick = () => openMore("confirm"); // asks "Start over?" first
$("hintBtn").onclick = () => { haptic("pick"); openHint(); };
$("hintClose").onclick = () => { s.hint = null; render(); };
$("hintNext").onclick = () => { haptic("pick"); advanceHint(); };
$("rulesBtn").onclick = () => { s.rules = true; render(); };
document.querySelectorAll("#rules [data-close]").forEach((b) => (b.onclick = () => { s.rules = false; render(); }));
document.querySelectorAll("#settings [data-close]").forEach((b) => (b.onclick = () => { s.settingsOpen = false; render(); }));
document.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => flipSetting(b.dataset.set)));

// Keyboard, for playing on a computer: 1–9, arrows, Backspace, Ctrl+Z.
document.addEventListener("keydown", (e) => {
  if (s.rules || s.settingsOpen || s.pausedAt) return;
  if ((e.ctrlKey || e.metaKey) && e.key === "z") return $("undoBtn").onclick();
  if (/^[1-9]$/.test(e.key)) return press(Number(e.key));
  if (e.key === "Backspace" || e.key === "Delete") return erase();
  const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (move) {
    e.preventDefault();
    const [r, c] = s.sel || [0, 0];
    selectOnly((r + move[0] + 9) % 9, (c + move[1] + 9) % 9);
    render();
  }
});

// Pause (Colin, 10/20): tap the timer to stop the clock and cover the puzzle. Leaving the tab pauses too.
function pause() {
  if (s.solved || s.pausedAt) return;
  s.pausedAt = Date.now();
  render();
}
function resume() {
  if (!s.pausedAt) return;
  s.started += Date.now() - s.pausedAt;
  s.pausedAt = null;
  render();
}
$("timer").onclick = pause;
$("resumeBtn").onclick = resume;
document.addEventListener("visibilitychange", () => document.hidden && pause());

// Keep the half-done game saved (twice a second, so backing out never loses more than a moment).
function persist() {
  if (!s || s.solved || ![s.entries, s.corner, s.center].some((m) => Object.keys(m).length)) return;
  saveGame("sudoku", packName, { p: pid(), entries: s.entries, corner: s.corner, center: s.center,
    ms: (s.pausedAt ?? Date.now()) - s.started, hints: s.hints ?? 0 });
}
setInterval(() => {
  if (s && !s.solved && !s.pausedAt) $("time").textContent = fmt(Date.now() - s.started);
  persist();
}, 500);
addEventListener("pagehide", persist);

smoothClose();
openWipe();
if (!importId) load(idx, packName, true);
else {
  const item = await findImport(importId);
  if (item) {
    PACKS.import.puzzles = [item];
    load(0, "import", true);
  } else {
    // Never found (deleted, or not on this phone yet): say so kindly, with a way back.
    $("board").innerHTML = `<div class="missing"><b>Couldn't find this import</b><span>It may have been deleted, or not reached this phone yet.</span>
      <button class="dark" id="missingBack">Back</button></div>`;
    $("missingBack").onclick = goHome;
  }
}
