// Sudoku play page: the approved 9×9 design, wired to the real engine and the Easy pack.
import { hint as findHint, writeMarks } from "../engine/sudoku/hint.ts";
import { clearSaved, fitHint, goHome, haptic, logSolve, moreMenu, saveGame, savedGame, smoothClose, solves } from "./bridge.js";
import { celebrate, openWipe, solveFacts, solvedBar } from "./celebrate.js";

// The phone app's offline page carries the packs inside it (SB_PACKS); otherwise fetch them.
const loadPack = async (f) => globalThis.SB_PACKS?.[f] ?? (await fetch(`../packs/${f}`)).json();
const PACKS = {
  easy: await loadPack("sudoku9-easy-starter.json"),
  medium: await loadPack("sudoku9-medium.json"),
  hard: await loadPack("sudoku9-hard.json"),
  expert: await loadPack("sudoku9-expert.json"),
  tricks: await loadPack("sudoku9-tricks.json"), // one test per harder trick
};
const query = new URLSearchParams(location.search);
let packName = PACKS[query.get("pack")] ? query.get("pack") : "easy";
let pack = PACKS[packName];
const STRIPES = "repeating-linear-gradient(135deg, rgba(194,78,42,0.38) 0 4px, rgba(255,255,255,0) 4px 10px)";
const $ = (id) => document.getElementById(id);
const key = (r, c) => `${r},${c}`;
// Corner marks fill the corners first, then top/bottom middle, then the sides (handoff §6).
const CORNER_POS = [
  "top:1px;left:3px", "top:1px;right:3px", "bottom:1px;left:3px", "bottom:1px;right:3px",
  "top:1px;left:0;right:0;text-align:center", "bottom:1px;left:0;right:0;text-align:center",
  "top:13px;left:3px", "top:13px;right:3px", "top:13px;left:0;right:0;text-align:center",
];

let idx = Math.max(0, Math.min(pack.puzzles.length - 1, Number(query.get("p") || 1) - 1));
let s; // game state
const undoStack = []; // board snapshots for Undo

// Game settings: same names and defaults as the Settings screen mockup. Remembered in this browser.
const SETTINGS_KEY = "solvebuddy.settings";
const settings = { timer: true, mistakes: false, hl: true, same: true };
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
    hint: null, started: Date.now(), elapsed: 0, solved: false, rules: false, settingsOpen: false };
  // Pick up where you left off (Colin, 10/21).
  const saved = savedGame("sudoku", name, i + 1);
  if (saved) {
    Object.assign(s, { entries: saved.entries ?? {}, corner: saved.corner ?? {}, center: saved.center ?? {} });
    s.started = Date.now() - (saved.ms ?? 0);
    s.hints = saved.hints ?? 0;
  }
  $("sub").textContent = p.label ? `Classic 9×9 · ${p.label}` : `Classic 9×9 · ${pack.difficulty} · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", `?pack=${name}&p=${i + 1}`);
  // "View solved puzzle" from the pack's numbers: the finished board, read-only, with your best time.
  if (first && query.get("view")) {
    s.givens.forEach((row, r) => row.forEach((v, c) => { if (!v) s.entries[key(r, c)] = s.solution[r][c]; }));
    const best = solves().filter((e) => e.g === "sudoku" && e.pack === name && e.p === i + 1).map((e) => e.ms);
    s.solved = true;
    s.elapsed = best.length ? Math.min(...best) : 0;
    $("time").textContent = fmt(s.elapsed);
    solvedBar(s.elapsed, () => { clearSaved("sudoku", packName, idx + 1); load(idx); });
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
  clearSaved("sudoku", packName, idx + 1);
  haptic("success");
  [250, 500, 750].forEach((ms) => setTimeout(() => haptic("tap"), ms)); // ticks with the blue sweep
  const facts = solveFacts("sudoku", packName, s.elapsed, s.hints ?? 0);
  logSolve({ g: "sudoku", pack: packName, p: idx + 1, ms: s.elapsed, hints: s.hints ?? 0 });
  const p = pack.puzzles[idx];
  celebrate({ title: p.label || `${pack.difficulty} #${idx + 1}`, level: pack.difficulty, facts, hasNext: idx < pack.puzzles.length - 1,
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
  s.hints = (s.hints ?? 0) + 1; // for Stats: solved with or without hints
  s.hint = { data: findHint(board(), s.solution, s.center, s.corner), level: 1 };
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

function render() {
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

  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const k = key(r, c);
      const g = s.givens[r][c];
      const v = valueAt(r, c);
      const isSel = !h && s.picked.has(k);
      const peer = settings.hl && !h && s.sel && s.picked.size === 1 && (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3)));
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
      const ring = k === target || spots.has(k) ? "inset 0 0 0 3px var(--sel-ring)" : blockerCells.has(k) ? "inset 0 0 0 2px var(--accent-dark)" : isSel ? "inset 0 0 0 2px var(--sel-ring)" : "none";
      let inner = "";
      if (v) {
        const cls = g ? "v given" : wrong ? "v wrong" : k === target && h.level === 3 ? "v shown" : "v";
        inner += `<span class="${cls}">${v}</span>`;
      } else if (s.center[k]) {
        inner += `<span class="ctr">${s.center[k].join("")}</span>`;
      }
      if (!v && s.corner[k]) inner += s.corner[k].map((d, i) => `<span class="cn" style="${CORNER_POS[i]}">${d}</span>`).join("");
      const cls = ["cell", c % 3 === 2 ? "br" : "", r % 3 === 2 ? "bb" : "", intro ? "drop" : "", won ? "won wave" : ""].join(" ");
      const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const d = intro ? s.introWait + 0.15 + box * 0.09 + ((r % 3) * 3 + (c % 3)) * 0.025 : (r + c) * 0.03;
      cells.push(`<button class="${cls}" data-r="${r}" data-c="${c}" style="--d:${d.toFixed(3)}s;background:${bg};box-shadow:${ring}" aria-label="Row ${r + 1} column ${c + 1}, ${v || "empty"}">${inner}</button>`);
    }
  }
  $("board").innerHTML = cells.join("");

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
  fitHint($("hint"), $("board"));

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
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = `${pk.difficulty}:`;
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
  if (!b) return;
  e.preventDefault();
  const r = Number(b.dataset.r), c = Number(b.dataset.c);
  if (e.ctrlKey || e.metaKey || e.shiftKey) s.picked.add(key(r, c)), (s.sel = [r, c]);
  else selectOnly(r, c);
  drag = { last: [r, c] };
  render();
});
document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const b = cellAt(e.clientX, e.clientY);
  if (!b) return;
  const r = Number(b.dataset.r), c = Number(b.dataset.c);
  const [r0, c0] = drag.last;
  if (r === r0 && c === c0) return;
  // A fast swipe can skip cells between two moves, so pick every cell on the straight line in between.
  const steps = Math.max(Math.abs(r - r0), Math.abs(c - c0));
  for (let i = 1; i <= steps; i++) s.picked.add(key(Math.round(r0 + ((r - r0) * i) / steps), Math.round(c0 + ((c - c0) * i) / steps)));
  drag.last = [r, c];
  s.sel = [r, c];
  render();
});
document.addEventListener("pointerup", () => (drag = null));
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
  onRestart: () => { clearSaved("sudoku", packName, idx + 1); load(idx); },
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
  saveGame("sudoku", packName, { p: idx + 1, entries: s.entries, corner: s.corner, center: s.center,
    ms: (s.pausedAt ?? Date.now()) - s.started, hints: s.hints ?? 0 });
}
setInterval(() => {
  if (s && !s.solved && !s.pausedAt) $("time").textContent = fmt(Date.now() - s.started);
  persist();
}, 500);
addEventListener("pagehide", persist);

smoothClose();
openWipe();
load(idx, packName, true);
