// Sudoku play page: the approved 9×9 design, wired to the real engine and the Easy pack.
import { hint as findHint } from "/engine/sudoku/hint.ts";

const pack = await (await fetch("/packs/sudoku9-easy-starter.json")).json();
const $ = (id) => document.getElementById(id);
const key = (r, c) => `${r},${c}`;
// Corner marks fill the corners first, then top/bottom middle, then the sides (handoff §6).
const CORNER_POS = [
  "top:1px;left:3px", "top:1px;right:3px", "bottom:1px;left:3px", "bottom:1px;right:3px",
  "top:1px;left:0;right:0;text-align:center", "bottom:1px;left:0;right:0;text-align:center",
  "top:13px;left:3px", "top:13px;right:3px", "top:13px;left:0;right:0;text-align:center",
];

let idx = Math.max(0, Math.min(pack.puzzles.length - 1, Number(new URLSearchParams(location.search).get("p") || 1) - 1));
let s; // game state
const undoStack = []; // board snapshots for Undo

function load(i) {
  idx = i;
  undoStack.length = 0;
  const p = pack.puzzles[i];
  s = { givens: p.givens, solution: p.solution, entries: {}, corner: {}, center: {}, sel: null, mode: s?.mode || "normal",
    hint: null, started: Date.now(), elapsed: 0, solved: false, rules: false };
  $("sub").textContent = `Classic 9×9 · Easy · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", `?p=${i + 1}`);
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
function openHint() {
  if (s.solved) return;
  if (s.hint) {
    s.hint = null;
    return render();
  }
  s.hint = { data: findHint(board(), s.solution), level: 1 };
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
    // Show me: do the move (place the number, or clear the mistake).
    saveUndo();
    const [r, c] = h.data.target;
    const k = key(r, c);
    if (h.data.value) s.entries[k] = h.data.value;
    else delete s.entries[k];
    delete s.corner[k];
    delete s.center[k];
    s.sel = [r, c];
  }
  render();
}

function render() {
  const h = s.hint;
  const focus = new Set(h ? h.data.focus.map(([r, c]) => key(r, c)) : []);
  const target = h && h.level >= 2 && h.data.target ? key(...h.data.target) : null;
  const [sr, sc] = s.sel || [-1, -1];
  const selVal = s.sel ? valueAt(sr, sc) : 0;

  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const k = key(r, c);
      const g = s.givens[r][c];
      const v = valueAt(r, c);
      const isSel = !h && r === sr && c === sc;
      const peer = !h && s.sel && (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3)));
      const same = !h && selVal && v === selVal && !isSel;
      let bg = "var(--board)";
      if (peer) bg = "var(--peer)";
      if (same) bg = "var(--same)";
      if (isSel) bg = "var(--sel)";
      if (focus.has(k)) bg = "var(--accent-soft)";
      if (k === target) bg = "var(--accent-mid)";
      const ring = k === target ? "inset 0 0 0 3px var(--accent)" : isSel ? "inset 0 0 0 2px var(--sel-ring)" : "none";
      let inner = "";
      if (v) {
        const cls = g ? "v given" : k === target && h.level === 3 ? "v shown" : "v";
        inner = `<span class="${cls}">${v}</span>`;
      } else if (s.center[k]) {
        inner = `<span class="ctr">${s.center[k].join("")}</span>`;
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
    $("hintTitle").textContent = text[0];
    $("hintBody").textContent = text[1];
    $("hintBody").hidden = !text[1];
    $("hintNextLabel").textContent = stuck ? "Close" : ["Explain", "Show me", "Done"][h.level - 1];
  }

  $("rules").hidden = !s.rules;
  $("solved").hidden = !s.solved;
  if (s.solved) {
    $("solvedText").textContent = `You finished puzzle #${idx + 1} in ${fmt(s.elapsed)}.`;
    $("nextPuzzle").hidden = idx === pack.puzzles.length - 1;
  }
}

function renderPicker() {
  const p = $("picker");
  p.querySelectorAll("button").forEach((b) => b.remove());
  pack.puzzles.forEach((_, i) => {
    const b = document.createElement("button");
    b.textContent = i + 1;
    b.className = i === idx ? "on" : "";
    b.onclick = () => load(i);
    p.appendChild(b);
  });
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

// Keyboard, for playing on a computer: 1–9, arrows, Backspace, Ctrl+Z.
document.addEventListener("keydown", (e) => {
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

setInterval(() => {
  if (s && !s.solved) $("time").textContent = fmt(Date.now() - s.started);
}, 500);

load(idx);
