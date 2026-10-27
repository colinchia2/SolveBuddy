// Nonogram play page (Colin 10/23, docs/design/zoom_nonogram_mockup.html), wired to the line-logic engine and packs.
// The clue bar (Colin 10/24, docs/design/nonogram_clues_mockup.html v2):
// - Top switch × / ■ / Clear (remembered per puzzle). Tap: × mode × → fill → clear; ■ mode fill → × → clear; Clear
//   empties. Drag copies the chosen mode along its row or column: × or ■ onto empty squares, Clear empties every one.
// - Tapping squares never changes anything at the bottom.
// - Tap a clue: a bar slides up over the bottom (a spring) with just that line's numbers, big; nothing else moves.
//   Tap a number there (or, with the bar up, the small one on the board) to slash it; again to unslash. Slash the
//   last one and the line's empty squares fill with × (one Undo). Tap the same clue again (off its numbers) or swipe
//   the bar down to close it; another clue swaps it. Clues never grey by themselves; a clue never checks the answer.
// Haptics (Colin 10/24, bridge.js levels): × and clearing L2, fill L3, a slash L2, the last slash's × fill L4, the
// win L5; opening and closing the bar is the L1 tick.
// 15×15 zooms with two fingers (web/zoom.js); clue strips stay pinned. Each puzzle is a picture: the finish shows it
// in its colour and the Solved card says its name ("A heart!"); a puzzle with no name gets the normal card.
import { hint as findHint, BLANK, FILL, CROSS, isSolved } from "../engine/nonogram/hint.ts";
import { runs, sameClue } from "../engine/nonogram/line.ts";
import { clearSaved, finalBoard, goHome, haptic, hapticLevel, loadPack, logSolve, moreMenu, saveFinal, saveGame, savedGame, showHintsUsed, smoothClose, solves } from "./bridge.js";
import { celebrate, openWipe, solveFacts, solvedBar } from "./celebrate.js";
import { makeZoom, second } from "./zoom.js";

const PACKS = {
  easy: await loadPack("nonogram5-easy.json"),
  medium: await loadPack("nonogram10-medium.json"),
  hard: await loadPack("nonogram15-hard.json"),
};
const ZOOM_FROM = 15; // only 15×15 zooms (Colin 10/23)
const query = new URLSearchParams(location.search);
let packName = PACKS[query.get("pack")] ? query.get("pack") : "easy";
let pack = PACKS[packName];
let idx = Math.max(0, Math.min(pack.puzzles.length - 1, Number(query.get("p") || 1) - 1));
const $ = (id) => document.getElementById(id);
const key = (r, c) => `${r},${c}`;
const pid = () => idx + 1;
const fmt = (ms) => { const t = Math.floor(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const TIPS = { x: "Tap for × · again to fill · tap a clue for its numbers", fill: "Tap to fill · again for × · tap a clue for its numbers",
  clear: "Clear: tap or drag to empty squares" };

// The × / ■ / Clear switch is remembered per puzzle in its own small store, so choosing it alone doesn't make a puzzle
// "in progress" in the Library.
const MODES_KEY = "solvebuddy.nonogramMode";
const modeKey = () => `${packName}/${pid()}`;
const modes = () => { try { return JSON.parse(localStorage.getItem(MODES_KEY) || "{}"); } catch { return {}; } };
function saveMode() {
  const all = modes();
  if (s.mode !== "x") all[modeKey()] = s.mode;
  else delete all[modeKey()];
  try { localStorage.setItem(MODES_KEY, JSON.stringify(all)); } catch {}
}

const SETTINGS_KEY = "solvebuddy.settings";
const settings = { timer: true, mistakes: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch {}
function flipSetting(name) {
  settings[name] = !settings[name];
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"), [name]: settings[name] })); } catch {}
  render();
}

let P, N, s; // the puzzle, its size, the game state
// Undo steps hold the squares and the slashes together (the last slash and its × fill are one step).
const undoStack = [];
const snap = () => JSON.stringify({ marks: s.marks, slash: s.slash });
const restore = (j) => { const o = JSON.parse(j); s.marks = o.marks; s.slash = o.slash; };
const mark = (r, c) => s.marks[key(r, c)] ?? BLANK;
const boardArr = () => Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => mark(r, c)));
const lineOf = (axis, i) => Array.from({ length: N }, (_, x) => (axis === "row" ? mark(i, x) : mark(x, i)));
const isX = (r, c) => P.solution[r][c] === "X";
// A line is done when its filled squares match its clue (counted in "2 of 15 rows"; it never greys).
const lineDone = (axis, i) => sameClue(runs(lineOf(axis, i).map((m) => (m === FILL ? 1 : 0))), (axis === "row" ? P.rows : P.cols)[i]);
const rowsDone = () => P.rows.filter((_, r) => lineDone("row", r)).length;

// ---- Board geometry: everything is sized from the cell size and clue text size, so zoom can re-lay it out. ----
const VIEW_W = 358;
let G; // { fs1, cs1, W, H, cwOf(fs), chOf(fs) }
function geometry() {
  const fs1 = N <= 5 ? 17 : N <= 10 ? 12.5 : 10.5;
  const widthOf = (clue) => clue.reduce((t, n) => t + String(n).length * 0.62 + 0.45, 0); // in em, numbers + gaps
  const wMax = Math.max(...P.rows.map(widthOf)), hMax = Math.max(...P.cols.map((c) => c.length));
  const cwOf = (fs) => Math.ceil(wMax * fs + 12), chOf = (fs) => Math.ceil(hMax * fs * 1.25 + 8);
  const room = Math.max(300, Math.min(480, $("stage").clientHeight - 70));
  const cs1 = Math.min(56, (VIEW_W - cwOf(fs1) - 2) / N, (room - chOf(fs1) - 2) / N);
  G = { fs1, cs1, cwOf, chOf, W: Math.round(cwOf(fs1) + N * cs1 + 2), H: Math.round(chOf(fs1) + N * cs1 + 2) };
}
const fsAt = (z) => Math.min(G.fs1 * z, Math.max(G.fs1, 13.5)); // clue text grows a little, not as much as the squares
const geomAt = (z) => {
  const fs = fsAt(z), cw = G.cwOf(fs), ch = G.chOf(fs), size = N * G.cs1 * z + 2;
  return { ox: cw, oy: ch, visW: G.W - cw, visH: G.H - ch, w: size, h: size, fs, cw, ch };
};
let view = { z: 1, x: 0, y: 0 }, lastTip = TIPS.x;
function applyView(v) {
  view = v;
  const g = geomAt(v.z), b = $("board").style;
  b.setProperty("--cs", (G.cs1 * v.z).toFixed(3));
  b.setProperty("--fs", g.fs.toFixed(2));
  b.setProperty("--cw", g.cw);
  b.setProperty("--ch", g.ch);
  b.setProperty("--px", v.x.toFixed(2));
  b.setProperty("--py", v.y.toFixed(2));
}
const zoom = makeZoom({
  view: $("board"), area: $("stage"), reserve: 30, geom: geomAt, apply: applyView, ctl: $("zoomCtl"), tip: $("tip"), tipText: TIPS.x, zmax: 2.6,
  mapColors: () => Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (mark(r, c) === FILL ? "#2A211B" : "#FFFDF9"))),
  onTwoFingers: cancelDrag,
  onZoomed: (on) => { $("countWrap").hidden = on; },
});

// ---- Loading a puzzle ----
function load(i, name = packName, first = false) {
  packName = name; pack = PACKS[name]; idx = i;
  P = pack.puzzles[i]; N = P.rows.length;
  undoStack.length = 0;
  s = { marks: {}, slash: {}, bar: null, hint: null, started: Date.now(), solved: false, rules: false, settingsOpen: false, hints: 0, mode: "x", sweep: null };
  const saved = savedGame("nonogram", name, pid());
  if (saved) { s.marks = { ...(saved.marks ?? {}) }; s.slash = { ...(saved.slash ?? {}) }; s.started = Date.now() - (saved.ms ?? 0); s.hints = saved.hints ?? 0; }
  s.mode = ["fill", "clear"].includes(modes()[modeKey()]) ? modes()[modeKey()] : "x";
  $("sub").textContent = `${pack.difficulty} · ${N}×${N} · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", `?${query.get("game") ? "game=nonogram&" : ""}pack=${name}&p=${i + 1}`);
  $("board").classList.remove("won");
  $("board").style.setProperty("--n", N);
  $("board").style.setProperty("--pic", P.color ?? "var(--ink)");
  $("board").style.width = ""; $("board").style.height = "";
  build();
  hideBar(true); // a new puzzle starts with the bar down
  geometry();
  $("board").style.width = `${G.W}px`;
  $("board").style.height = `${G.H}px`;
  // Zoom starts at fit on each new puzzle, or where you left it on this one (Colin 10/23).
  zoom.reset(N >= ZOOM_FROM, saved?.zoom);
  if (first && query.get("view")) {
    const mine = finalBoard("nonogram", name, pid());
    s.marks = mine ? { ...mine.marks } : Object.fromEntries(P.solution.flatMap((row, r) => [...row].map((v, c) => [key(r, c), v === "X" ? FILL : CROSS])));
    const best = solves().filter((e) => e.g === "nonogram" && e.pack === name && e.p === pid()).map((e) => e.ms);
    s.solved = true;
    s.elapsed = best.length ? Math.min(...best) : 0;
    $("time").textContent = fmt(s.elapsed);
    $("board").classList.add("won");
    solvedBar(s.elapsed, () => { clearSaved("nonogram", packName, pid()); load(idx); });
  }
  render();
}

// The board's pieces are built once per puzzle; render() only changes classes.
function build() {
  const cell = (r, c) => `<div class="nc${c % 5 === 4 || c === N - 1 ? " t5r" : ""}${r % 5 === 4 || r === N - 1 ? " t5b" : ""}${r === N - 1 && c === N - 1 ? " kbr" : ""}" data-r="${r}" data-c="${c}"></div>`;
  $("board").innerHTML = `<div class="ncorner"></div>
    <div class="ntop"><div class="ntop-in">${P.cols.map((cl, c) => `<div class="cc" data-c="${c}">${cl.map((n, k) => `<span class="n" data-k="${k}">${n}</span>`).join("")}</div>`).join("")}</div></div>
    <div class="nleft"><div class="nleft-in">${P.rows.map((cl, r) => `<div class="rc" data-r="${r}">${cl.map((n, k) => `<span class="n" data-k="${k}">${n}</span>`).join("")}</div>`).join("")}</div></div>
    <div class="ngwrap"><div class="ngrid">${Array.from({ length: N * N }, (_, k) => cell(Math.floor(k / N), k % N)).join("")}</div></div>`;
}

// ---- Drawing ----
function render() {
  showHintsUsed(s.solved ? 0 : s.hints); // the quiet "You've used ⅓ of a hint" line over Hint (Colin, 10/23)
  const h = s.hint, won = s.solved;
  const focus = new Set(h ? h.data.focus.map(([r, c]) => key(r, c)) : []);
  const stripeF = new Set(h && h.level === 2 ? h.data.fill.map(([r, c]) => key(r, c)) : []);
  const stripeX = new Set(h && h.level === 2 ? h.data.cross.map(([r, c]) => key(r, c)) : []);
  const ring = h && h.data.kind === "mistake" && h.level >= 2 ? key(...h.data.clear[0]) : null;
  for (const el of $("board").querySelectorAll(".nc")) {
    const r = Number(el.dataset.r), c = Number(el.dataset.c), k = key(r, c), m = mark(r, c);
    const bad = settings.mistakes && !won && ((m === FILL && !isX(r, c)) || (m === CROSS && isX(r, c)));
    el.classList.toggle("f", m === FILL);
    el.classList.toggle("bad", bad);
    const sd = s.sweep?.get(k);
    el.classList.toggle("sw", sd !== undefined);
    if (sd !== undefined) el.style.setProperty("--sd", `${sd}ms`);
    el.classList.toggle("focus", focus.has(k) && h.data.kind !== "mistake");
    el.classList.toggle("stripe", stripeF.has(k) || stripeX.has(k));
    el.classList.toggle("sx", stripeX.has(k));
    el.classList.toggle("ring", ring === k);
    el.classList.toggle("hi", !won && !!s.bar && (s.bar.axis === "row" ? s.bar.i === r : s.bar.i === c)); // the bar's line, tinted
    el.style.setProperty("--d", `${((r + c) * (0.9 / (2 * N))).toFixed(3)}s`);
    const x = m === CROSS ? `<span class="xm${bad ? " bad" : ""}">×</span>` : "";
    if (el.innerHTML !== x) el.innerHTML = x;
  }
  const hlLine = h && h.data.line && h.data.kind === "step" ? h.data.line : null;
  // Clues: only your slashes and the open bar's line show on them; they never grey by themselves (Colin 10/24).
  for (const el of $("board").querySelectorAll(".rc, .cc")) {
    const axis = el.classList.contains("rc") ? "row" : "col", i = Number(axis === "row" ? el.dataset.r : el.dataset.c);
    const cut = slashed(axis, i);
    el.classList.toggle("hl", !!hlLine && hlLine.axis === axis && hlLine.i === i);
    el.classList.toggle("open", !won && !!s.bar && s.bar.axis === axis && s.bar.i === i);
    el.querySelectorAll(".n").forEach((n) => n.classList.toggle("s", cut.includes(Number(n.dataset.k))));
  }
  $("count").textContent = `${rowsDone()} of ${N} rows`;
  document.querySelectorAll("#modeSw [data-mode]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === s.mode)));
  $("modeSw").classList.toggle("gone", won);
  if (lastTip !== TIPS[s.mode]) zoom.setTipText((lastTip = TIPS[s.mode]));
  renderBar();
  zoom.refreshMap();
  $("hintBtn").classList.toggle("pressed", !!h);
  $("hint").hidden = !h;
  if (h) {
    const d = h.data;
    $("hintStep").textContent = ["Nudge", "Explain", "Show me"][h.level - 1];
    $("hintChip").textContent = d.technique;
    $("hintChip").hidden = !d.technique || h.level === 1;
    [1, 2, 3].forEach((n) => $("d" + n).classList.toggle("on", h.level >= n));
    const text = [[d.nudge, ""], [d.nudge, d.explain], [d.showMe, d.explain]][h.level - 1];
    $("hintTitle").textContent = text[0];
    $("hintBody").textContent = text[1];
    $("hintBody").hidden = !text[1];
    $("hintNextLabel").textContent = ["Explain", "Show me", "Done"][h.level - 1];
  }
  $("rules").hidden = !s.rules;
  $("settings").hidden = !s.settingsOpen;
  document.querySelectorAll("[data-set]").forEach((b) => b.setAttribute("aria-checked", String(!!settings[b.dataset.set])));
  $("timer").classList.toggle("notime", !settings.timer);
  $("paused").hidden = !s.pausedAt;
  if (s.pausedAt) $("pausedText").textContent = `${$("sub").textContent} · ${fmt(s.pausedAt - s.started)}`;
}

// ---- Playing ----
// Set one square; one buzz each, every square a drag paints too, at its mark's strength: fill L3, × or clear L2.
function setMark(r, c, m) {
  if (mark(r, c) === m) return false;
  if (m === BLANK) delete s.marks[key(r, c)];
  else s.marks[key(r, c)] = m;
  hapticLevel(m === FILL ? 3 : 2);
  return true;
}
function tap(r, c) {
  if (s.solved) return;
  const next = nextMark(mark(r, c));
  if (next === mark(r, c)) return; // Clear on an empty square
  undoStack.push(snap());
  setMark(r, c, next);
  afterChange();
}
// × mode (the default, like Star Battle): × → fill → clear. ■ mode: fill → × → clear. Clear: empties it.
const nextMark = (m) => (s.mode === "clear" ? BLANK : (s.mode === "fill" ? { [BLANK]: FILL, [FILL]: CROSS, [CROSS]: BLANK } : { [BLANK]: CROSS, [CROSS]: FILL, [FILL]: BLANK })[m]);
function afterChange() {
  s.hint = null;
  checkSolved();
  render();
}

// Drag (Colin 10/24): it copies the chosen mode, start square included: × or ■ onto empty squares (it never covers a
// mark), Clear empties every square it passes. The first move decides row or column; it stays there.
let drag = null;
const gridCell = (x, y) => {
  const g = $("board").querySelector(".ngrid").getBoundingClientRect(), cs = G.cs1 * view.z;
  return [Math.floor((y - g.top - 2) / cs), Math.floor((x - g.left - 2) / cs)];
};
const clamp = (v) => Math.max(0, Math.min(N - 1, v));
$("board").addEventListener("pointerdown", (e) => {
  const el = e.target.closest(".nc");
  if (!el || s.solved || zoom.busy || second(e) || s.pausedAt) return;
  e.preventDefault();
  const r = Number(el.dataset.r), c = Number(el.dataset.c);
  drag = { start: [r, c], last: [r, c], axis: null, moved: false, mode: { x: CROSS, fill: FILL, clear: BLANK }[s.mode] };
});
document.addEventListener("pointermove", (e) => {
  if (!drag || second(e)) return;
  if (zoom.busy) return cancelDrag();
  const [r, c] = gridCell(e.clientX, e.clientY);
  const [r0, c0] = drag.start;
  if (!drag.moved) {
    if (clamp(r) === r0 && clamp(c) === c0) return;
    drag.moved = true;
    drag.axis = Math.abs(c - c0) >= Math.abs(r - r0) ? "row" : "col";
    undoStack.push(snap()); // one Undo for the whole drag
    paint(r0, c0);
  }
  // Locked to the line: only the position along it counts. Fill every square between, so a fast swipe skips none.
  const to = drag.axis === "row" ? [r0, clamp(c)] : [clamp(r), c0];
  const [lr, lc] = drag.last, steps = Math.max(Math.abs(to[0] - lr), Math.abs(to[1] - lc));
  for (let i = 1; i <= steps; i++) paint(lr + Math.sign(to[0] - lr) * i * (to[0] !== lr ? 1 : 0), lc + Math.sign(to[1] - lc) * i * (to[1] !== lc ? 1 : 0));
  drag.last = to;
  render();
});
document.addEventListener("pointerup", (e) => {
  if (!drag || second(e)) return;
  const d = drag;
  drag = null;
  if (zoom.busy) return;
  if (!d.moved) return tap(...d.start);
  afterChange();
});
document.addEventListener("pointercancel", () => cancelDrag());
function paint(r, c) {
  if (drag.mode === BLANK || mark(r, c) === BLANK) setMark(r, c, drag.mode);
}

// ---- The clue bar (Colin 10/24, docs/design/nonogram_clues_mockup.html) ----
// Tap a clue: the bar slides up with that line's numbers. With the bar up on that line, a tap right on one of its small
// numbers slashes it; a tap anywhere else on that clue closes the bar. Another clue swaps the bar to its line.
const lineId = (axis, i) => `${axis === "row" ? "r" : "c"}${i}`;
const clueOf = (axis, i) => (axis === "row" ? P.rows : P.cols)[i];
const slashed = (axis, i) => s.slash[lineId(axis, i)] ?? [];
let clueTap = null, sweepTimer = 0;
$("board").addEventListener("pointerdown", (e) => {
  const el = e.target.closest(".rc, .cc");
  clueTap = el && !s.solved && !zoom.busy && !second(e) && !s.pausedAt
    ? { el, k: e.target.closest(".n")?.dataset.k, x: e.clientX, y: e.clientY } : null;
});
document.addEventListener("pointerup", (e) => {
  const t = clueTap;
  clueTap = null;
  if (!t || second(e) || zoom.busy || s.solved || s.pausedAt || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 12) return;
  const axis = t.el.classList.contains("rc") ? "row" : "col", i = Number(axis === "row" ? t.el.dataset.r : t.el.dataset.c);
  const open = s.bar && s.bar.axis === axis && s.bar.i === i;
  if (!open) return showBar(axis, i);
  if (t.k !== undefined) return toggleSlash(axis, i, Number(t.k));
  hideBar();
});

function showBar(axis, i) {
  const swap = !!s.bar;
  s.bar = { axis, i };
  s.hint = null; // the bar takes the bottom of the screen
  haptic("pick");
  const bar = $("cbar");
  bar.hidden = false;
  bar.classList.remove("swapped");
  render();
  void bar.offsetWidth; // start from below the screen (or, swapping, restart the numbers' little slide)
  bar.classList.add("up");
  if (swap) bar.classList.add("swapped");
}
function hideBar(now = false) {
  const bar = $("cbar");
  if (!bar) return;
  if (s?.bar && !now) haptic("pick");
  if (s) s.bar = null;
  bar.style.transition = now ? "none" : "";
  bar.style.transform = "";
  bar.classList.remove("up", "swapped");
  if (now) { bar.hidden = true; void bar.offsetWidth; bar.style.transition = ""; }
  if (s && P && !now) render();
}
$("cbar").addEventListener("transitionend", (e) => { if (e.target === $("cbar") && !$("cbar").classList.contains("up")) $("cbar").hidden = true; });

function renderBar() {
  if (!s.bar || s.solved) return;
  const { axis, i } = s.bar, clue = clueOf(axis, i), cut = slashed(axis, i);
  $("cbarLbl").textContent = `${axis === "row" ? "Row" : "Column"} ${i + 1}`;
  const html = clue.map((n, k) => `<button class="nb${cut.includes(k) ? " s" : ""}" data-k="${k}" aria-label="${n}${cut.includes(k) ? ", slashed" : ""}">${n}</button>`).join("");
  const nums = $("cbarNums");
  if (nums.dataset.line !== lineId(axis, i) || nums.innerHTML !== html) { nums.innerHTML = html; nums.dataset.line = lineId(axis, i); }
  nums.classList.toggle("many", clue.length > 4);
}

// Slash a number (again to unslash). The last one fills the line's empty squares with × (one Undo with the slash).
function toggleSlash(axis, i, k) {
  if (s.solved) return;
  const id = lineId(axis, i), list = slashed(axis, i), on = !list.includes(k);
  undoStack.push(snap());
  s.slash = { ...s.slash, [id]: on ? [...list, k].sort((a, b) => a - b) : list.filter((x) => x !== k) };
  if (!s.slash[id].length) delete s.slash[id];
  if (on && s.slash[id].length === clueOf(axis, i).length && crossRest(axis, i)) return hapticLevel(4), afterChange();
  hapticLevel(2);
  render();
}
// × into every empty square of the line, in a quick sweep. It never looks at the answer. Returns how many.
function crossRest(axis, i) {
  const empty = Array.from({ length: N }, (_, x) => (axis === "row" ? [i, x] : [x, i])).filter(([r, c]) => mark(r, c) === BLANK);
  if (!empty.length) return 0;
  const step = Math.min(35, 300 / empty.length); // ms between squares; a long line still sweeps in about a third of a second
  s.sweep = new Map();
  empty.forEach(([r, c], n) => { s.marks[key(r, c)] = CROSS; s.sweep.set(key(r, c), Math.round(n * step)); });
  clearTimeout(sweepTimer);
  sweepTimer = setTimeout(() => { s.sweep = null; render(); }, (empty.length - 1) * step + 400);
  return empty.length;
}

// The bar's own touches: a number tap slashes; a drag follows the finger down (a little resistance upward) and on
// release closes past ~70px or a quick flick, else springs back.
{
  const bar = $("cbar");
  let g = null;
  bar.addEventListener("pointerdown", (e) => {
    if (second(e) || !s.bar) return;
    g = { y: e.clientY, t: performance.now(), dy: 0, v: 0, moved: false, k: e.target.closest(".nb")?.dataset.k, id: e.pointerId };
    try { bar.setPointerCapture(e.pointerId); } catch {} // keep the finger even when it leaves the bar
  });
  bar.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    const raw = e.clientY - g.y, now = performance.now();
    if (!g.moved && Math.abs(raw) < 6) return;
    g.moved = true;
    const dy = raw > 0 ? raw : raw / 4; // pulling up only gives a little
    g.v = (dy - g.dy) / Math.max(1, now - g.t);
    g.dy = dy; g.t = now;
    bar.style.transition = "none";
    bar.style.transform = `translateY(${dy}px)`;
  });
  const up = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const d = g;
    g = null;
    if (!d.moved) {
      if (d.k !== undefined && s.bar) toggleSlash(s.bar.axis, s.bar.i, Number(d.k));
      return;
    }
    bar.style.transition = "";
    const flick = performance.now() - d.t < 80 && d.v > 0.5; // a quick flick down, still moving at the end
    if (d.dy > 70 || flick) return hideBar();
    bar.style.transform = ""; // springs back with the bar's own ease
  };
  bar.addEventListener("pointerup", up);
  bar.addEventListener("pointercancel", (e) => { if (g && e.pointerId === g.id) { g = null; bar.style.transition = ""; bar.style.transform = ""; } });
}
// Two fingers came down: whatever one finger started doesn't count.
function cancelDrag() {
  if (!drag) return;
  if (drag.moved) restore(undoStack.pop());
  drag = null;
  render();
}

function checkSolved() {
  if (s.solved || !isSolved(P, boardArr())) return;
  s.solved = true;
  s.elapsed = Date.now() - s.started;
  s.bar = null; // the bar goes down quietly; the win has its own buzz
  hideBar();
  clearSaved("nonogram", packName, pid());
  saveFinal("nonogram", packName, pid(), { marks: { ...s.marks } });
  haptic("success");
  // The picture moment: zoom back to the whole board, then × marks and grid lines melt and the colour sweeps in.
  zoom.fit();
  setTimeout(() => $("board").classList.add("won"), 120);
  const hints = Math.round((s.hints ?? 0) * 100) / 100;
  const facts = solveFacts("nonogram", packName, s.elapsed, hints);
  logSolve({ g: "nonogram", pack: packName, p: pid(), ms: s.elapsed, hints });
  celebrate({ title: `${pack.difficulty} #${idx + 1}`, level: pack.difficulty, facts, hasNext: idx < pack.puzzles.length - 1,
    onNext: () => load(idx + 1), delay: 1600,
    heading: P.say ?? undefined, medal: P.say ? picture(P.solution, 86, P.color ?? "#2A211B") : undefined });
}
// The solved picture on its own (the medal, and pack thumbnails use the same drawing in home.js).
export function picture(sol, size, color) {
  const n = sol.length, u = size / n;
  let o = "";
  sol.forEach((row, r) => [...row].forEach((v, c) => { if (v === "X") o += `<rect x="${(c * u).toFixed(2)}" y="${(r * u).toFixed(2)}" width="${(u + 0.05).toFixed(2)}" height="${(u + 0.05).toFixed(2)}" fill="${color}"/>`; }));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" style="display:block;background:#FFFDF9">${o}</svg>`;
}

// ---- Hint: Nudge (the line) → Explain (striped squares, why) → Show me (does it). Each step counts a third. ----
function openHint() {
  if (s.solved) return;
  if (s.hint) { s.hint = null; return render(); }
  s.hints += 1 / 3;
  s.hint = { data: findHint(P, boardArr()), level: 1 };
  render();
}
function advanceHint() {
  const h = s.hint;
  if (!h) return;
  if (h.level === 3) { s.hint = null; checkSolved(); return render(); }
  h.level++;
  s.hints += 1 / 3;
  if (h.level === 3) {
    undoStack.push(snap());
    for (const [r, c] of h.data.clear) delete s.marks[key(r, c)];
    for (const [r, c] of h.data.fill) s.marks[key(r, c)] = FILL;
    for (const [r, c] of h.data.cross) s.marks[key(r, c)] = CROSS;
  }
  render();
}

$("backBtn").onclick = goHome;
$("undoBtn").onclick = () => {
  if (!undoStack.length || s.solved) return;
  haptic("tap");
  restore(undoStack.pop());
  s.hint = null;
  render();
};
const openMore = moreMenu({ settingsNote: "Timer, show mistakes", onSettings: () => { s.settingsOpen = true; render(); },
  onRestart: () => { clearSaved("nonogram", packName, pid()); load(idx); } });
$("settingsBtn").onclick = () => { s.settingsOpen = true; render(); };
$("restartBtn").onclick = () => openMore("confirm");
$("hintBtn").onclick = () => { haptic("pick"); openHint(); };
$("hintClose").onclick = () => { s.hint = null; render(); };
$("hintNext").onclick = () => { haptic("pick"); advanceHint(); };
$("rulesBtn").onclick = () => { s.rules = true; render(); };
document.querySelectorAll("#rules [data-close]").forEach((b) => (b.onclick = () => { s.rules = false; render(); }));
document.querySelectorAll("#settings [data-close]").forEach((b) => (b.onclick = () => { s.settingsOpen = false; render(); }));
document.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => flipSetting(b.dataset.set)));
document.querySelectorAll("#modeSw [data-mode]").forEach((b) => (b.onclick = () => {
  if (s.solved || s.mode === b.dataset.mode) return;
  haptic("pick");
  s.mode = b.dataset.mode;
  saveMode();
  render();
}));
document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "z" && !s.pausedAt) $("undoBtn").onclick(); });

function pause() { if (s.solved || s.pausedAt) return; s.pausedAt = Date.now(); render(); }
function resume() { if (!s.pausedAt) return; s.started += Date.now() - s.pausedAt; s.pausedAt = null; render(); }
$("timer").onclick = pause;
$("resumeBtn").onclick = resume;
document.addEventListener("visibilitychange", () => document.hidden && pause());

function persist() {
  if (!s || s.solved || !Object.keys(s.marks).length) return;
  saveGame("nonogram", packName, { p: pid(), marks: s.marks, slash: s.slash, ms: (s.pausedAt ?? Date.now()) - s.started, hints: s.hints ?? 0,
    zoom: zoom.isOn() ? zoom.state() : null });
}
setInterval(() => {
  if (s && !s.solved && !s.pausedAt) $("time").textContent = fmt(Date.now() - s.started);
  persist();
}, 500);
addEventListener("pagehide", persist);

// The browser-only test strip: every puzzle.
function renderPicker() {
  const p = $("picker");
  for (const [name, pk] of Object.entries(PACKS)) {
    const lbl = document.createElement("span");
    lbl.textContent = `${pk.difficulty}:`;
    lbl.style.marginLeft = "6px";
    p.appendChild(lbl);
    pk.puzzles.forEach((_, i) => {
      const b = document.createElement("button");
      b.textContent = i + 1;
      b.onclick = () => { p.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); load(i, name); };
      if (name === packName && i === idx) b.classList.add("on");
      p.appendChild(b);
    });
  }
}
globalThis.sbNono = { load, state: () => s, view: () => view, zoom }; // for the page test
smoothClose();
openWipe();
renderPicker();
load(idx, packName, true);
