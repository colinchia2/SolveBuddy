// Star Battle play page: the approved 8×8 design, wired to the real engine and the Easy pack.
import { hint as findHint, EMPTY, CROSS, STAR } from "/engine/starbattle/hint.ts";

const pack = await (await fetch("/packs/starbattle8-easy-starter.json")).json();
const $ = (id) => document.getElementById(id);
const key = (r, c) => `${r},${c}`;
const N = 8;
const COLORS = { A: "#D8C3EA", B: "#FFD08A", C: "#A6D8D0", D: "#C6E2A6", E: "#F5C2C9", F: "#FFB48A", G: "#BFD3F2", H: "#E9D9B8" };
const STAR_PATH = "M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z";
const STRIPES = "repeating-linear-gradient(135deg, rgba(194,78,42,0.38) 0 4px, rgba(255,255,255,0) 4px 10px)";

// Game settings: shared with the Sudoku page and the Settings screen.
const SETTINGS_KEY = "solvebuddy.settings";
const settings = { timer: true, mistakes: false, hl: true, same: true, auto: true };
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

let idx = Math.max(0, Math.min(pack.puzzles.length - 1, Number(new URLSearchParams(location.search).get("p") || 1) - 1));
let s; // game state
const undoStack = [];

function load(i) {
  idx = i;
  undoStack.length = 0;
  const p = pack.puzzles[i];
  s = { regions: p.regions, solution: p.solution, marks: {}, hint: null, started: Date.now(), elapsed: 0,
    solved: false, rules: false, settingsOpen: false, hinted: new Set() };
  $("sub").textContent = `8×8 · Easy · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", `?p=${i + 1}`);
  renderPicker();
  render();
}

const stars = () => Object.keys(s.marks).filter((k) => s.marks[k] === STAR).map((k) => k.split(",").map(Number));
// Cells touching a star show a light × when "Auto-cross around stars" is on. They aren't stored,
// so removing the star removes them too.
function autoCrossed() {
  const out = new Set();
  if (!settings.auto) return out;
  for (const [r, c] of stars()) {
    for (let a = r - 1; a <= r + 1; a++) {
      for (let b = c - 1; b <= c + 1; b++) {
        if (a >= 0 && b >= 0 && a < N && b < N && !(a === r && b === c) && !s.marks[key(a, b)]) out.add(key(a, b));
      }
    }
  }
  return out;
}
function board() {
  const auto = autoCrossed();
  return Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => s.marks[key(r, c)] || (auto.has(key(r, c)) ? CROSS : EMPTY)));
}

function change(fn) {
  if (s.solved) return;
  undoStack.push(JSON.stringify(s.marks));
  fn();
  s.hint = null;
  s.hinted.clear();
  checkSolved();
  render();
}

function tap(r, c) {
  const k = key(r, c);
  change(() => {
    const next = ((s.marks[k] || EMPTY) + 1) % 3; // empty → × → star → empty
    if (next) s.marks[k] = next;
    else delete s.marks[k];
  });
}

function checkSolved() {
  const st = stars();
  if (st.length === N && st.every(([r, c]) => s.solution[r] === c)) {
    s.solved = true;
    s.elapsed = Date.now() - s.started;
  }
}

// Stars that break a rule (same row, column or region, or touching) always show red, as in the mockup.
function conflicts() {
  const bad = new Set();
  const st = stars();
  for (let i = 0; i < st.length; i++) {
    for (let j = i + 1; j < st.length; j++) {
      const [a, b] = st[i], [c, d] = st[j];
      if (a === c || b === d || s.regions[a][b] === s.regions[c][d] || (Math.abs(a - c) <= 1 && Math.abs(b - d) <= 1)) {
        bad.add(key(a, b));
        bad.add(key(c, d));
      }
    }
  }
  return bad;
}

// Hint: bulb → Nudge (focus area in full color) → Explain (striped cells / ringed cell) → Show me (does it).
function openHint() {
  if (s.solved) return;
  if (s.hint) {
    s.hint = null;
    return render();
  }
  s.hinted.clear();
  // An automatic × sitting on an answer cell comes from a wrong star; leave it out so the hint
  // points at that star (which the player can fix) rather than the × (which they can't).
  const b = board().map((row, r) => row.map((v, c) => (v === CROSS && !s.marks[key(r, c)] && s.solution[r] === c ? EMPTY : v)));
  s.hint = { data: findHint(b, s.regions, s.solution), level: 1 };
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
    undoStack.push(JSON.stringify(s.marks));
    const d = h.data;
    if (d.clear) delete s.marks[key(...d.clear)];
    if (d.star) s.marks[key(...d.star)] = STAR;
    for (const [r, c] of d.cross) {
      s.marks[key(r, c)] = CROSS;
      s.hinted.add(key(r, c));
    }
  }
  render();
}

function render() {
  const h = s.hint;
  const focus = new Set(h ? h.data.focus.map(([r, c]) => key(r, c)) : []);
  const striped = new Set(h && h.level === 2 ? h.data.cross.map(([r, c]) => key(r, c)) : []);
  const ringed = h && h.level >= 2 ? (h.data.star || h.data.clear) : null;
  const ringKey = ringed ? key(...ringed) : null;
  const bad = conflicts();
  const auto = autoCrossed();

  const cells = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = key(r, c);
      const reg = s.regions[r][c];
      const m = s.marks[k] || EMPTY;
      const isAnswer = s.solution[r] === c;
      const wrong = settings.mistakes && ((m === STAR && !isAnswer) || (m === CROSS && isAnswer));
      // Lightened region colors; the hint's focus area shows in full color.
      let bg = focus.has(k) ? COLORS[reg] : `color-mix(in srgb, ${COLORS[reg]} 48%, #FFFDF9)`;
      if (bad.has(k) || (wrong && m === STAR)) bg = "#F4A6A0";
      if (striped.has(k)) bg = `${STRIPES}, ${bg}`;
      const ring = k === ringKey ? "inset 0 0 0 3px var(--accent)" : "none";
      const br = c === N - 1 || s.regions[r][c + 1] !== reg ? "br" : "";
      const bb = r === N - 1 || s.regions[r + 1][c] !== reg ? "bb" : "";
      let inner = "";
      if (m === STAR) {
        const fill = bad.has(k) || wrong ? "var(--conflict-star)" : "var(--ink)";
        inner = `<svg width="26" height="26" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="${fill}"/></svg>`;
      } else if (m === CROSS) {
        inner = `<span class="xm${wrong ? " wrong" : s.hinted.has(k) ? " hinted" : ""}">×</span>`;
      } else if (auto.has(k)) {
        inner = `<span class="xm auto">×</span>`;
      }
      const label = `Row ${r + 1} column ${c + 1}${m === STAR ? ", star" : m === CROSS ? ", crossed" : ""}`;
      cells.push(`<button class="cell ${br} ${bb}" data-r="${r}" data-c="${c}" style="background:${bg};box-shadow:${ring}" aria-label="${label}">${inner}</button>`);
    }
  }
  $("board").innerHTML = cells.join("");
  $("count").textContent = `${stars().length} / ${N} stars`;
  $("hintBtn").classList.toggle("pressed", !!h);
  $("stage").classList.toggle("lifted", !!h);

  $("hint").hidden = !h;
  if (h) {
    const d = h.data;
    const stuck = d.kind === "stuck";
    $("hintStep").textContent = stuck ? "Hint" : ["Nudge", "Explain", "Show me"][h.level - 1];
    $("hintChip").textContent = d.technique;
    $("hintChip").hidden = !d.technique || h.level === 1;
    [1, 2, 3].forEach((n) => $("d" + n).classList.toggle("on", h.level >= n));
    const text = [[d.nudge, ""], [d.nudge, d.explain], [d.showMe, d.explain]][stuck ? 1 : h.level - 1];
    $("hintTitle").textContent = text[0];
    $("hintBody").textContent = text[1];
    $("hintBody").hidden = !text[1];
    $("hintNextLabel").textContent = stuck ? "Close" : ["Explain", "Show me", "Done"][h.level - 1];
  }

  $("rules").hidden = !s.rules;
  $("settings").hidden = !s.settingsOpen;
  document.querySelectorAll("[data-set]").forEach((b) => b.setAttribute("aria-checked", String(!!settings[b.dataset.set])));
  $("timer").style.visibility = settings.timer ? "visible" : "hidden";
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
$("board").onclick = (e) => {
  const b = e.target.closest(".cell");
  if (b) tap(Number(b.dataset.r), Number(b.dataset.c));
};
$("undoBtn").onclick = () => {
  if (!undoStack.length || s.solved) return;
  s.marks = JSON.parse(undoStack.pop());
  s.hint = null;
  s.hinted.clear();
  render();
};
$("restartBtn").onclick = () => load(idx);
$("hintBtn").onclick = openHint;
$("hintClose").onclick = () => { s.hint = null; render(); };
$("hintNext").onclick = advanceHint;
$("rulesBtn").onclick = () => { s.rules = true; render(); };
document.querySelectorAll("#rules [data-close]").forEach((b) => (b.onclick = () => { s.rules = false; render(); }));
$("settingsBtn").onclick = () => { s.settingsOpen = true; render(); };
document.querySelectorAll("#settings [data-close]").forEach((b) => (b.onclick = () => { s.settingsOpen = false; render(); }));
document.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => flipSetting(b.dataset.set)));
$("nextPuzzle").onclick = () => load(idx + 1);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z") $("undoBtn").onclick();
});

setInterval(() => {
  if (s && !s.solved) $("time").textContent = fmt(Date.now() - s.started);
}, 500);

load(idx);
