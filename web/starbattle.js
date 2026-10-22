// Star Battle play page: the approved 8×8 design, wired to the real engine and the packs.
import { hint as findHint, EMPTY, CROSS, STAR } from "../engine/starbattle/hint.ts";
import { clearSaved, fitHint, goHome, haptic, logSolve, moreMenu, saveGame, savedGame, smoothClose, solves } from "./bridge.js";
import { celebrate, openWipe, shootingStar, solveFacts, solvedBar } from "./celebrate.js";

// The phone app's offline page carries the packs inside it (SB_PACKS); otherwise fetch them.
const loadPack = async (f) => globalThis.SB_PACKS?.[f] ?? (await fetch(`../packs/${f}`)).json();
const PACKS = {
  easy: await loadPack("starbattle8-easy-starter.json"),
  expert: await loadPack("starbattle8-expert.json"),
};
const query = new URLSearchParams(location.search);
let packName = PACKS[query.get("pack")] ? query.get("pack") : "easy";
let pack = PACKS[packName];
const $ = (id) => document.getElementById(id);
const key = (r, c) => `${r},${c}`;
const N = 8;
const COLORS = { A: "#D8C3EA", B: "#FFD08A", C: "#A6D8D0", D: "#C6E2A6", E: "#F5C2C9", F: "#FFB48A", G: "#BFD3F2", H: "#E9D9B8" };
const STAR_PATH = "M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z";
const STRIPES = "repeating-linear-gradient(135deg, rgba(194,78,42,0.38) 0 4px, rgba(255,255,255,0) 4px 10px)";

// Game settings: shared with the Sudoku page and the Settings screen.
const SETTINGS_KEY = "solvebuddy.settings";
const settings = { timer: true, mistakes: false, hl: true, same: true, autoCross: false }; // auto-cross off by default (Colin, 10/20)
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

let idx = Math.max(0, Math.min(pack.puzzles.length - 1, Number(query.get("p") || 1) - 1));
let s; // game state
const undoStack = [];

// first = the page just opened: the blue wipe plays first, so the board waits for it.
function load(i, name = packName, first = false) {
  packName = name;
  pack = PACKS[name];
  idx = i;
  undoStack.length = 0;
  const p = pack.puzzles[i];
  s = { regions: p.regions, solution: p.solution, marks: {}, hint: null, started: Date.now(), elapsed: 0,
    solved: false, rules: false, settingsOpen: false, hinted: new Set() };
  // Pick up where you left off (Colin, 10/21).
  const saved = savedGame("starbattle", name, i + 1);
  if (saved) {
    s.marks = saved.marks ?? {};
    s.started = Date.now() - (saved.ms ?? 0);
    s.hints = saved.hints ?? 0;
  }
  $("sub").textContent = `8×8 · ${pack.difficulty} · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", `?pack=${name}&p=${i + 1}`);
  // "View solved puzzle" from the pack's numbers: the finished board, read-only, with your best time.
  if (first && query.get("view")) {
    for (let r = 0; r < N; r++) s.marks[key(r, s.solution[r])] = STAR;
    const best = solves().filter((e) => e.g === "starbattle" && e.pack === name && e.p === i + 1).map((e) => e.ms);
    s.solved = true;
    s.elapsed = best.length ? Math.min(...best) : 0;
    $("time").textContent = fmt(s.elapsed);
    solvedBar(s.elapsed, () => { clearSaved("starbattle", packName, idx + 1); load(idx); });
  }
  // The board builds as a colour wave from the top-left corner, then a shooting star lands in the counter.
  s.introAt = Date.now();
  s.introWait = first ? 0.45 : 0.05;
  renderPicker();
  render();
  shootingStar($("board"), $("count").parentElement, s.introWait + 0.75);
}

const stars = () => Object.keys(s.marks).filter((k) => s.marks[k] === STAR).map((k) => k.split(",").map(Number));
// Cells touching a star show a light × when "Auto-cross around stars" is on. They aren't stored,
// so removing the star removes them too.
function autoCrossed() {
  const out = new Set();
  if (!settings.autoCross) return out;
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
  haptic((s.marks[k] || EMPTY) === CROSS ? "thud" : "tap"); // a firmer one when it becomes a star
  change(() => {
    const next = ((s.marks[k] || EMPTY) + 1) % 3; // empty → × → star → empty
    if (next) s.marks[k] = next;
    else delete s.marks[k];
  });
}

function checkSolved() {
  const st = stars();
  if (s.solved || st.length !== N || !st.every(([r, c]) => s.solution[r] === c)) return;
  s.solved = true;
  s.elapsed = Date.now() - s.started;
  s.winAt = Date.now(); // the stars pop row by row, then the Solved! card rises
  clearSaved("starbattle", packName, idx + 1);
  haptic("success");
  for (let r = 1; r < N; r++) setTimeout(() => haptic("tap"), r * 110); // a tick as each row's star pops
  const facts = solveFacts("starbattle", packName, s.elapsed, s.hints ?? 0);
  logSolve({ g: "starbattle", pack: packName, p: idx + 1, ms: s.elapsed, hints: s.hints ?? 0 });
  celebrate({ title: `${pack.difficulty} #${idx + 1}`, level: pack.difficulty, facts, hasNext: idx < pack.puzzles.length - 1,
    onNext: () => load(idx + 1), delay: 1100 });
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
  s.hints = (s.hints ?? 0) + 1; // for Stats: solved with or without hints
  s.hinted.clear();
  // An automatic × sitting on an answer cell comes from a wrong star; leave it out so the hint
  // points at that star (which the player can fix) rather than the × (which they can't).
  const b = board().map((row, r) => row.map((v, c) => (v === CROSS && !s.marks[key(r, c)] && s.solution[r] === c ? EMPTY : v)));
  s.hint = { data: findHint(b, s.regions, s.solution), level: 1 };
  render();
}
// What if hints (Colin, 10/20): "Show me" first plays the chain out on the board with faint pretend marks:
// play 0 = the pretend star, 1..k = each forced move, k+1 = the line that ran dry. Then the real × goes in.
function advanceHint() {
  const h = s.hint;
  const chain = h.data.chain;
  if (h.play != null) {
    if (h.play <= chain.length) h.play++;
    else {
      h.play = null;
      applyHint(h.data);
    }
    return render();
  }
  if (h.data.kind === "stuck" || h.level === 3) {
    s.hint = null;
    checkSolved();
    return render();
  }
  h.level++;
  if (h.level === 3) {
    if (chain) h.play = 0;
    else applyHint(h.data);
  }
  render();
}
function applyHint(d) {
  undoStack.push(JSON.stringify(s.marks));
  if (d.clear) delete s.marks[key(...d.clear)];
  if (d.star) s.marks[key(...d.star)] = STAR;
  for (const [r, c] of d.cross) {
    s.marks[key(r, c)] = CROSS;
    s.hinted.add(key(r, c));
  }
}

// The pretend board for the current play-through frame: real marks plus faint pretend ones.
function playFrame(h) {
  const d = h.data;
  const from = d.clear || d.cross[0]; // a wrong star in a mistake hint, or the What if cell
  const ghost = new Map([[key(...from), STAR]]);
  const crossOut = (cells) => cells.forEach((p) => !s.marks[key(...p)] && !ghost.has(key(...p)) && ghost.set(key(...p), CROSS));
  crossOut(d.pretendCross);
  let latest = [from];
  let focus = [];
  for (const step of d.chain.slice(0, h.play)) {
    if (step.star) ghost.set(key(...step.star), STAR);
    crossOut(step.cross);
    latest = step.star ? [step.star] : step.cross;
    focus = step.focus;
  }
  const dead = h.play > d.chain.length;
  if (dead) {
    latest = [];
    focus = d.dead.cells;
  }
  return { ghost, latest: new Set(latest.map((p) => key(...p))), focus, dead };
}

function render() {
  const h = s.hint;
  const frame = h && h.play != null ? playFrame(h) : null;
  // What if (Colin, 10/20): the Nudge rings the cell to imagine a star in, and doesn't light up the
  // line where the chain ends (that gave the ending away and didn't point at the cell).
  const pretend = h?.data.chain && h.data.kind === "step" && !frame && h.level < 3 ? h.data.cross[0] : null;
  const focus = new Set((frame ? frame.focus : pretend && h.level === 1 ? [] : h ? h.data.focus : []).map(([r, c]) => key(r, c)));
  const striped = new Set(h && h.level === 2 ? h.data.cross.map(([r, c]) => key(r, c)) : []);
  const ringed = pretend || (h && h.level >= 2 && !frame ? (h.data.star || h.data.clear) : null);
  const ringKey = ringed ? key(...ringed) : null;
  const bad = conflicts();
  const auto = autoCrossed();
  const intro = Date.now() - s.introAt < 1500;
  const won = s.winAt && Date.now() - s.winAt < 1500;

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
      if (frame?.dead && focus.has(k)) bg = "#F4A6A0";
      if (striped.has(k)) bg = `${STRIPES}, ${bg}`;
      const ring = k === ringKey || frame?.latest.has(k) ? "inset 0 0 0 3px var(--accent)" : "none";
      const g = frame?.ghost.get(k);
      const br = c === N - 1 || s.regions[r][c + 1] !== reg ? "br" : "";
      const bb = r === N - 1 || s.regions[r + 1][c] !== reg ? "bb" : "";
      let inner = "";
      if (m === STAR) {
        const fill = bad.has(k) || wrong ? "var(--conflict-star)" : "var(--ink)";
        inner = `<svg width="26" height="26" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="${fill}"/></svg>`;
      } else if (m === CROSS) {
        inner = `<span class="xm${wrong ? " wrong" : s.hinted.has(k) ? " hinted" : ""}">×</span>`;
      } else if (g === STAR) {
        inner = `<svg class="ghost" width="26" height="26" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="var(--accent)"/></svg>`;
      } else if (g === CROSS) {
        inner = `<span class="xm ghost">×</span>`;
      } else if (auto.has(k)) {
        inner = `<span class="xm auto">×</span>`;
      }
      const label = `Row ${r + 1} column ${c + 1}${m === STAR ? ", star" : m === CROSS ? ", crossed" : ""}`;
      const fx = intro ? ` intro" style="--d:${(s.introWait + 0.15 + (r + c) * 0.035).toFixed(3)}s;` : won && m === STAR ? ` won" style="--d:${(r * 0.11).toFixed(2)}s;` : `" style="`;
      cells.push(`<button class="cell ${br} ${bb}${fx}background:${bg};box-shadow:${ring}" data-r="${r}" data-c="${c}" aria-label="${label}">${inner}</button>`);
    }
  }
  $("board").innerHTML = cells.join("");
  $("count").textContent = `${stars().length} / ${N} stars`;
  $("hintBtn").classList.toggle("pressed", !!h);

  $("hint").hidden = !h;
  if (h) {
    const d = h.data;
    const stuck = d.kind === "stuck";
    $("hintStep").textContent = stuck ? "Hint" : ["Nudge", "Explain", "Show me"][h.level - 1];
    $("hintChip").textContent = d.technique;
    $("hintChip").hidden = !d.technique || h.level === 1;
    [1, 2, 3].forEach((n) => $("d" + n).classList.toggle("on", h.level >= n));
    let text = [[d.nudge, ""], [d.nudge, d.explain], [d.showMe, d.explain]][stuck ? 1 : h.level - 1];
    let next = stuck ? "Close" : ["Explain", "Show me", "Done"][h.level - 1];
    if (frame) {
      const mistake = d.kind === "mistake";
      const [r, c] = d.clear || d.cross[0];
      const k = d.chain.length;
      const cap = (t) => t[0].toUpperCase() + t.slice(1);
      if (h.play === 0) {
        text = [mistake ? `Start from your star at row ${r + 1}, column ${c + 1}.` : `Pretend row ${r + 1}, column ${c + 1} has a star.`,
          `It rules out its row, column, region and neighbors. Faint marks are pretend. Tap Next to see what it forces.`];
      } else if (!frame.dead) {
        const st = d.chain[h.play - 1];
        text = [`Forced move ${h.play} of ${k}`, st.star ? `${st.why} It rules out its neighbors too.` : st.why];
      } else {
        text = [`${cap(d.dead.label)} has nowhere left for its star.`, mistake
          ? `So your star at row ${r + 1}, column ${c + 1} can't be right.`
          : `So the pretend star can't be right: row ${r + 1}, column ${c + 1} gets an ×.`];
      }
      next = !frame.dead ? "Next" : mistake ? "Take it off" : "Cross it out";
    }
    $("hintTitle").textContent = text[0];
    $("hintBody").textContent = text[1];
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

// Tap = cycle empty → × → star. Press and drag across cells = paint × on every empty cell you pass
// (or, if you started on an ×, wipe the × marks you pass). Works for mouse and finger alike.
let drag = null; // { start: [r, c], cells: Set, mode: "paint" | "wipe" }
const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest?.(".cell");
$("board").addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".cell");
  if (!b || s.solved) return;
  e.preventDefault();
  const r = Number(b.dataset.r), c = Number(b.dataset.c);
  drag = { start: [r, c], cells: new Set(), mode: s.marks[key(r, c)] === CROSS ? "wipe" : "paint", moved: false };
});
document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const b = cellAt(e.clientX, e.clientY);
  if (!b) return;
  const r = Number(b.dataset.r), c = Number(b.dataset.c);
  if (!drag.moved) {
    if (r === drag.start[0] && c === drag.start[1]) return;
    drag.moved = true;
    undoStack.push(JSON.stringify(s.marks)); // one Undo for the whole drag
    drag.last = drag.start;
    paint(...drag.start);
  }
  // A fast swipe can skip cells between two moves, so mark every cell on the straight line in between.
  const [r0, c0] = drag.last;
  const steps = Math.max(Math.abs(r - r0), Math.abs(c - c0));
  for (let i = 1; i <= steps; i++) paint(Math.round(r0 + ((r - r0) * i) / steps), Math.round(c0 + ((c - c0) * i) / steps));
  drag.last = [r, c];
});
document.addEventListener("pointerup", () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.moved) return tap(...d.start);
  s.hint = null;
  s.hinted.clear();
  checkSolved();
  render();
});
function paint(r, c) {
  const k = key(r, c);
  if (drag.cells.has(k)) return;
  drag.cells.add(k);
  if (drag.mode === "paint" && !s.marks[k]) s.marks[k] = CROSS;
  if (drag.mode === "wipe" && s.marks[k] === CROSS) delete s.marks[k];
  s.hint = null;
  render();
}
$("backBtn").onclick = goHome;
$("undoBtn").onclick = () => {
  if (!undoStack.length || s.solved) return;
  haptic("tap");
  s.marks = JSON.parse(undoStack.pop());
  s.hint = null;
  s.hinted.clear();
  render();
};
const openMore = moreMenu({
  settingsNote: "Timer, show mistakes, auto-cross",
  onSettings: () => { s.settingsOpen = true; render(); },
  onRestart: () => { clearSaved("starbattle", packName, idx + 1); load(idx); },
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
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !s.pausedAt) $("undoBtn").onclick();
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
  if (!s || s.solved || !Object.keys(s.marks).length) return;
  saveGame("starbattle", packName, { p: idx + 1, marks: s.marks, ms: (s.pausedAt ?? Date.now()) - s.started, hints: s.hints ?? 0 });
}
setInterval(() => {
  if (s && !s.solved && !s.pausedAt) $("time").textContent = fmt(Date.now() - s.started);
  persist();
}, 500);
addEventListener("pagehide", persist);

smoothClose();
openWipe();
load(idx, packName, true);
