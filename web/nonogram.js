// Nonogram play page (Colin 10/23, docs/design/zoom_nonogram_mockup.html), wired to the line-logic engine and packs.
// Tap (Colin 10/23, like Star Battle): × → fill → clear. The quiet "× · ■" switch above the board flips it to fill → × →
// clear (remembered per puzzle). Drag: paints what the first square shows after its tap (empty → × or, in ■ mode,
// fill; filled → fill; × → ×), only onto empty squares (a drag never clears), locked to its row or column.
// Tap a row's or column's clue: if its filled squares are exactly right, × sweeps into the rest; if not, the clue shakes.
// Haptics: a light tap per square, a firmer one when a row or column becomes complete and correct, the win buzz.
// 15×15 zooms with two fingers (web/zoom.js); clue strips stay pinned. Each puzzle is a picture: the finish shows it
// in its colour and the Solved card says its name ("A heart!"); a puzzle with no name gets the normal card.
import { hint as findHint, BLANK, FILL, CROSS, isSolved } from "../engine/nonogram/hint.ts";
import { runs, sameClue } from "../engine/nonogram/line.ts";
import { clearSaved, finalBoard, goHome, haptic, loadPack, logSolve, moreMenu, saveFinal, saveGame, savedGame, smoothClose, solves } from "./bridge.js";
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
const TAP_TIP = "Tap for × · again to fill · tap a clue to finish its line";

// The "× · ■" switch is remembered per puzzle in its own small store, so choosing it alone doesn't make a puzzle
// "in progress" in the Library.
const MODES_KEY = "solvebuddy.nonogramMode";
const modeKey = () => `${packName}/${pid()}`;
const modes = () => { try { return JSON.parse(localStorage.getItem(MODES_KEY) || "{}"); } catch { return {}; } };
function saveMode() {
  const all = modes();
  if (s.mode === "fill") all[modeKey()] = "fill";
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
const undoStack = [];
const mark = (r, c) => s.marks[key(r, c)] ?? BLANK;
const boardArr = () => Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => mark(r, c)));
const lineOf = (axis, i) => Array.from({ length: N }, (_, x) => (axis === "row" ? mark(i, x) : mark(x, i)));
const isX = (r, c) => P.solution[r][c] === "X";
// A line is done when its filled squares match its clue (it greys out); "right" when they match the picture.
const lineDone = (axis, i) => sameClue(runs(lineOf(axis, i).map((m) => (m === FILL ? 1 : 0))), (axis === "row" ? P.rows : P.cols)[i]);
const lineRight = (axis, i) => lineOf(axis, i).every((m, x) => (m === FILL) === (axis === "row" ? isX(i, x) : isX(x, i)));
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
let view = { z: 1, x: 0, y: 0 };
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
  view: $("board"), area: $("stage"), reserve: 30, geom: geomAt, apply: applyView, ctl: $("zoomCtl"), tip: $("tip"), tipText: TAP_TIP, zmax: 2.6,
  mapColors: () => Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (mark(r, c) === FILL ? "#2A211B" : "#FFFDF9"))),
  onTwoFingers: cancelDrag,
  onZoomed: (on) => { $("countWrap").hidden = on; },
});

// ---- Loading a puzzle ----
function load(i, name = packName, first = false) {
  packName = name; pack = PACKS[name]; idx = i;
  P = pack.puzzles[i]; N = P.rows.length;
  undoStack.length = 0;
  s = { marks: {}, hint: null, started: Date.now(), solved: false, rules: false, settingsOpen: false, hints: 0, mode: "x", sweep: null };
  const saved = savedGame("nonogram", name, pid());
  if (saved) { s.marks = { ...(saved.marks ?? {}) }; s.started = Date.now() - (saved.ms ?? 0); s.hints = saved.hints ?? 0; }
  s.mode = modes()[modeKey()] === "fill" ? "fill" : "x";
  $("sub").textContent = `${pack.difficulty} · ${N}×${N} · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", `?${query.get("game") ? "game=nonogram&" : ""}pack=${name}&p=${i + 1}`);
  $("board").classList.remove("won");
  $("board").style.setProperty("--n", N);
  $("board").style.setProperty("--pic", P.color ?? "var(--ink)");
  $("board").style.width = ""; $("board").style.height = "";
  build();
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
  const cell = (r, c) => `<div class="nc${c % 5 === 4 || c === N - 1 ? " t5r" : ""}${r % 5 === 4 || r === N - 1 ? " t5b" : ""}" data-r="${r}" data-c="${c}"></div>`;
  $("board").innerHTML = `<div class="ncorner"></div>
    <div class="ntop"><div class="ntop-in">${P.cols.map((cl, c) => `<div class="cc" data-c="${c}">${cl.map((n) => `<span>${n}</span>`).join("")}</div>`).join("")}</div></div>
    <div class="nleft"><div class="nleft-in">${P.rows.map((cl, r) => `<div class="rc" data-r="${r}">${cl.map((n) => `<span>${n}</span>`).join("")}</div>`).join("")}</div></div>
    <div class="ngwrap"><div class="ngrid">${Array.from({ length: N * N }, (_, k) => cell(Math.floor(k / N), k % N)).join("")}</div></div>`;
}

// ---- Drawing ----
function render() {
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
    el.style.setProperty("--d", `${((r + c) * (0.9 / (2 * N))).toFixed(3)}s`);
    const x = m === CROSS ? `<span class="xm${bad ? " bad" : ""}">×</span>` : "";
    if (el.innerHTML !== x) el.innerHTML = x;
  }
  const hlLine = h && h.data.line && h.data.kind === "step" ? h.data.line : null;
  for (const el of $("board").querySelectorAll(".rc")) {
    const r = Number(el.dataset.r);
    el.classList.toggle("done", lineDone("row", r));
    el.classList.toggle("hl", !!hlLine && hlLine.axis === "row" && hlLine.i === r);
  }
  for (const el of $("board").querySelectorAll(".cc")) {
    const c = Number(el.dataset.c);
    el.classList.toggle("done", lineDone("col", c));
    el.classList.toggle("hl", !!hlLine && hlLine.axis === "col" && hlLine.i === c);
  }
  $("count").textContent = `${rowsDone()} of ${N} rows`;
  document.querySelectorAll("#modeSw [data-mode]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === s.mode)));
  $("modeSw").classList.toggle("gone", won);
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
// Set one square; the buzz is light, or firmer when it finishes a row or column correctly (Colin 10/23).
function setMark(r, c, m) {
  const was = mark(r, c);
  if (was === m) return false;
  const before = [lineDone("row", r) && lineRight("row", r), lineDone("col", c) && lineRight("col", c)];
  if (m === BLANK) delete s.marks[key(r, c)];
  else s.marks[key(r, c)] = m;
  const after = [lineDone("row", r) && lineRight("row", r), lineDone("col", c) && lineRight("col", c)];
  haptic((after[0] && !before[0]) || (after[1] && !before[1]) ? "thud" : "tap");
  return true;
}
function tap(r, c) {
  if (s.solved) return;
  undoStack.push(JSON.stringify(s.marks));
  setMark(r, c, nextMark(mark(r, c)));
  afterChange();
}
// × mode (the default, like Star Battle): × → fill → clear. ■ mode: fill → × → clear.
const nextMark = (m) => (s.mode === "fill" ? { [BLANK]: FILL, [FILL]: CROSS, [CROSS]: BLANK } : { [BLANK]: CROSS, [CROSS]: FILL, [FILL]: BLANK })[m];
function afterChange() {
  s.hint = null;
  checkSolved();
  render();
}

// Drag (Colin 10/23): it paints what the first square shows after its tap (empty → × or, in ■ mode, fill; filled →
// fill; × → ×), onto empty squares only, so a drag never clears. The first move decides row or column; it stays there.
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
  const r = Number(el.dataset.r), c = Number(el.dataset.c), m = mark(r, c);
  drag = { start: [r, c], last: [r, c], axis: null, moved: false, mode: m === BLANK ? nextMark(BLANK) : m };
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
    undoStack.push(JSON.stringify(s.marks)); // one Undo for the whole drag
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
  if (mark(r, c) === BLANK) setMark(r, c, drag.mode);
}

// Tap a clue (Colin 10/23): when the line's filled squares are exactly the picture's, × sweeps along the rest of it
// (a few light ticks, then the firm "line done" one); one Undo takes it back. Otherwise the clue just shakes; it
// never says what's wrong.
let clueTap = null, sweepTimer = 0;
$("board").addEventListener("pointerdown", (e) => {
  const el = e.target.closest(".rc, .cc");
  clueTap = el && !s.solved && !zoom.busy && !second(e) && !s.pausedAt ? { el, x: e.clientX, y: e.clientY } : null;
});
document.addEventListener("pointerup", (e) => {
  const t = clueTap;
  clueTap = null;
  if (!t || second(e) || zoom.busy || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 12) return;
  const row = t.el.classList.contains("rc");
  finishLine(row ? "row" : "col", Number(row ? t.el.dataset.r : t.el.dataset.c), t.el);
});
function finishLine(axis, i, el) {
  if (s.solved || s.pausedAt) return;
  if (!lineRight(axis, i)) {
    el.classList.remove("shake");
    void el.offsetWidth; // restart the shake if it's tapped again
    el.classList.add("shake");
    return;
  }
  const empty = Array.from({ length: N }, (_, x) => (axis === "row" ? [i, x] : [x, i])).filter(([r, c]) => mark(r, c) === BLANK);
  if (!empty.length) return;
  undoStack.push(JSON.stringify(s.marks));
  const step = Math.min(35, 300 / empty.length); // ms between squares; a long line still sweeps in about a third of a second
  s.sweep = new Map();
  empty.forEach(([r, c], n) => { s.marks[key(r, c)] = CROSS; s.sweep.set(key(r, c), Math.round(n * step)); });
  const last = (empty.length - 1) * step, ticks = Math.min(empty.length, 4);
  for (let t = 0; t < ticks; t++) setTimeout(() => haptic("tap"), Math.round(ticks > 1 ? (t * last) / (ticks - 1) : 0));
  setTimeout(() => { if (!s.solved) haptic("thud"); }, last + 90);
  clearTimeout(sweepTimer);
  sweepTimer = setTimeout(() => { s.sweep = null; render(); }, last + 400);
  afterChange();
}
// Two fingers came down: whatever one finger started doesn't count.
function cancelDrag() {
  if (!drag) return;
  if (drag.moved) s.marks = JSON.parse(undoStack.pop());
  drag = null;
  render();
}

function checkSolved() {
  if (s.solved || !isSolved(P, boardArr())) return;
  s.solved = true;
  s.elapsed = Date.now() - s.started;
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
    undoStack.push(JSON.stringify(s.marks));
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
  s.marks = JSON.parse(undoStack.pop());
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
  saveGame("nonogram", packName, { p: pid(), marks: s.marks, ms: (s.pausedAt ?? Date.now()) - s.started, hints: s.hints ?? 0,
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
