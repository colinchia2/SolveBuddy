// Sudoku play page: the approved 9×9 design, wired to the real engine and the Easy pack.
import { hint as findHint, writeMarks } from "/engine/sudoku/hint.ts";

const PACKS = {
  easy: await (await fetch("/packs/sudoku9-easy-starter.json")).json(),
  medium: await (await fetch("/packs/sudoku9-medium.json")).json(),
  hard: await (await fetch("/packs/sudoku9-hard.json")).json(),
  expert: await (await fetch("/packs/sudoku9-expert.json")).json(),
  tricks: await (await fetch("/packs/sudoku9-tricks.json")).json(), // one test per harder trick
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

function load(i, name = packName) {
  packName = name;
  pack = PACKS[name];
  idx = i;
  undoStack.length = 0;
  const p = pack.puzzles[i];
  s = { givens: p.givens, solution: p.solution, entries: {}, corner: {}, center: {}, sel: null, mode: s?.mode || "normal",
    hint: null, started: Date.now(), elapsed: 0, solved: false, rules: false, settingsOpen: false };
  $("sub").textContent = p.label ? `Classic 9×9 · ${p.label}` : `Classic 9×9 · ${pack.difficulty} · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", `?pack=${name}&p=${i + 1}`);
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

function press(n) {
  if (!s.sel) return;
  const [r, c] = s.sel;
  if (s.givens[r][c]) return;
  const k = key(r, c);
  change(() => {
    if (s.mode === "normal") {
      s.entries[k] = n;
      delete s.corner[k];
      delete s.center[k];
    } else {
      const map = s.mode === "corner" ? s.corner : s.center;
      const marks = new Set(map[k] || []);
      marks.has(n) ? marks.delete(n) : marks.add(n);
      if (marks.size) map[k] = [...marks].sort();
      else delete map[k];
      delete s.entries[k];
    }
  });
}

function erase() {
  if (!s.sel) return;
  const [r, c] = s.sel;
  if (s.givens[r][c]) return;
  const k = key(r, c);
  change(() => {
    delete s.entries[k];
    delete s.corner[k];
    delete s.center[k];
  });
}

function checkSolved() {
  const b = board();
  if (b.every((row, r) => row.every((v, c) => v === s.solution[r][c]))) {
    s.solved = true;
    s.elapsed = Date.now() - s.started;
  }
}

// Hint: tap the bulb → Nudge; then Explain; then Show me (does the move); then Done.
// Hints only see the board: your numbers and your center pencil marks (Colin, 10/20).
function openHint() {
  if (s.solved) return;
  if (s.hint) {
    s.hint = null;
    return render();
  }
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
  s.sel = [r, c];
}

function render() {
  const h = s.hint;
  const step = h?.data;
  const shown = h && h.level >= 2;
  const focus = new Set(step ? step.focus.map(([r, c]) => key(r, c)) : []);
  const target = shown && h.data.target ? key(...h.data.target) : null;
  const striped = new Set(shown && step.remove ? step.remove.map(([r, c]) => key(r, c)) : []);
  const spots = new Set(shown && step.spots ? step.spots.map(([r, c]) => key(r, c)) : []);
  // From Explain on: the numbers that block the other cells, and the row, column or box each blocks through
  // (light red, shown over the hint's own shading so the whole line stays visible).
  const blockers = shown && step.blockers ? step.blockers : [];
  const blockerCells = new Set(blockers.map((b) => key(...b.cell)));
  const blockLines = new Set(blockers.flatMap((b) => b.line.map(([r, c]) => key(r, c))));
  const [sr, sc] = s.sel || [-1, -1];
  const selVal = s.sel ? valueAt(sr, sc) : 0;

  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const k = key(r, c);
      const g = s.givens[r][c];
      const v = valueAt(r, c);
      const isSel = !h && r === sr && c === sc;
      const peer = settings.hl && !h && s.sel && (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3)));
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
      const cls = ["cell", c % 3 === 2 ? "br" : "", r % 3 === 2 ? "bb" : ""].join(" ");
      cells.push(`<button class="${cls}" data-r="${r}" data-c="${c}" style="background:${bg};box-shadow:${ring}" aria-label="Row ${r + 1} column ${c + 1}, ${v || "empty"}">${inner}</button>`);
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
    $("hintTitle").textContent = text[0];
    $("hintBody").textContent = text[1];
    $("hintBody").hidden = !text[1];
    $("hintNextLabel").textContent = next;
  }

  $("rules").hidden = !s.rules;
  $("settings").hidden = !s.settingsOpen;
  document.querySelectorAll("[data-set]").forEach((b) => b.setAttribute("aria-checked", String(!!settings[b.dataset.set])));
  $("timer").classList.toggle("notime", !settings.timer); // the pause button stays even with the clock hidden
  $("paused").hidden = !s.pausedAt;
  if (s.pausedAt) $("pausedText").textContent = `${$("sub").textContent} · ${fmt(s.pausedAt - s.started)}`;
  $("solved").hidden = !s.solved || s.solvedClosed; // the close button keeps the finished board on screen
  if (s.solved) {
    $("solvedText").textContent = `You finished puzzle #${idx + 1} in ${fmt(s.elapsed)}.`;
    $("nextPuzzle").hidden = idx === pack.puzzles.length - 1;
  }
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
$("board").onclick = (e) => {
  const b = e.target.closest(".cell");
  if (!b) return;
  s.sel = [Number(b.dataset.r), Number(b.dataset.c)];
  render();
};
document.querySelectorAll(".seg[data-mode]").forEach((b) => (b.onclick = () => { s.mode = b.dataset.mode; render(); }));
$("eraseBtn").onclick = erase;
$("undoBtn").onclick = () => {
  if (!undoStack.length || s.solved) return;
  Object.assign(s, JSON.parse(undoStack.pop()));
  s.hint = null;
  render();
};
$("restartBtn").onclick = () => load(idx);
$("hintBtn").onclick = openHint;
$("hintClose").onclick = () => { s.hint = null; render(); };
$("hintNext").onclick = advanceHint;
$("rulesBtn").onclick = () => { s.rules = true; render(); };
document.querySelectorAll("#rules [data-close]").forEach((b) => (b.onclick = () => { s.rules = false; render(); }));
$("nextPuzzle").onclick = () => load(idx + 1);
document.querySelectorAll("#solved [data-close]").forEach((b) => (b.onclick = () => { s.solvedClosed = true; render(); }));
$("settingsBtn").onclick = () => { s.settingsOpen = true; render(); };
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
    s.sel = [(r + move[0] + 9) % 9, (c + move[1] + 9) % 9];
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

setInterval(() => {
  if (s && !s.solved && !s.pausedAt) $("time").textContent = fmt(Date.now() - s.started);
}, 500);

load(idx);
