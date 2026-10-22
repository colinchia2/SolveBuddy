// Water Sort play page (Colin, 10/22): the same frame as Star Battle and Sudoku (timer, dock, hint card, saves,
// Solved! card), with glass tubes of colour. The solver in engine/watersort drives the Hint button.
import { CAP, canPour, isDone, isSolved, pour } from "../engine/watersort/rules.ts";
import { solve, tidiestMove } from "../engine/watersort/solve.ts";
import { clearSaved, fitHint, goHome, haptic, logSolve, moreMenu, saveGame, savedGame, smoothClose, solves } from "./bridge.js";
import { celebrate, openWipe, solveFacts, solvedBar } from "./celebrate.js";

const loadPack = async (f) => globalThis.SB_PACKS?.[f] ?? (await fetch(`../packs/${f}`)).json();
const PACKS = {
  easy: await loadPack("watersort-easy.json"),
  medium: await loadPack("watersort-medium.json"),
  hard: await loadPack("watersort-hard.json"),
};
const query = new URLSearchParams(location.search);
let packName = PACKS[query.get("pack")] ? query.get("pack") : "easy";
let pack = PACKS[packName];
const $ = (id) => document.getElementById(id);
// 12 colours, bright enough to tell apart at a glance.
const COLORS = { A: "#E8574F", B: "#3E86E8", C: "#F4C542", D: "#4CB86A", E: "#9B6BD6", F: "#F28C38",
  G: "#EE7BB0", H: "#2BB3B1", I: "#9C6B4E", J: "#A8D45A", K: "#2F4A8A", L: "#9AA3AD" };
const NAMES = { A: "red", B: "blue", C: "yellow", D: "green", E: "purple", F: "orange", G: "pink", H: "teal", I: "brown",
  J: "lime", K: "navy", L: "grey" };
const UNIT = 38; // px per unit of colour

const SETTINGS_KEY = "solvebuddy.settings";
const settings = { timer: true };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
} catch {}
function flipSetting(name) {
  settings[name] = !settings[name];
  try {
    const all = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...all, [name]: settings[name] }));
  } catch {}
  render();
}

// The pour on screen, if any (Colin, 10/22): the tube lifts, moves over the other and tilts, a stream runs in while
// one level drops and the other rises, then it goes back. A tap anywhere speeds it up.
let anim = null;
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const POUR_MS = 1000, FAST_MS = 150, TILT = 100; // TILT > 90°: the mouth dips below the bottom, so it pours
const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

let idx = Math.max(0, Math.min(pack.puzzles.length - 1, Number(query.get("p") || 1) - 1));
let s; // game state
const undoStack = []; // earlier tube states, one per pour

function load(i, name = packName, first = false) {
  settle();
  packName = name;
  pack = PACKS[name];
  idx = i;
  undoStack.length = 0;
  const p = pack.puzzles[i];
  s = { tubes: p.tubes.map((t) => [...t]), picked: null, moves: 0, hint: null, started: Date.now(), elapsed: 0,
    solved: false, rules: false, settingsOpen: false };
  // Pick up where you left off.
  const saved = savedGame("watersort", name, i + 1);
  if (saved) {
    s.tubes = saved.tubes ?? s.tubes;
    s.moves = saved.moves ?? 0;
    s.started = Date.now() - (saved.ms ?? 0);
    s.hints = saved.hints ?? 0;
    undoStack.push(...(saved.undo ?? []));
  }
  $("sub").textContent = `${p.colors} colours · ${pack.difficulty} · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", `?pack=${name}&p=${i + 1}`);
  // "View solved puzzle": every colour in its own full tube, with your best time.
  if (first && query.get("view")) {
    const colours = [...new Set(p.tubes.flat())].sort();
    s.tubes = [...colours.map((c) => Array(CAP).fill(c)), ...Array(p.tubes.length - colours.length).fill(0).map(() => [])];
    const best = solves().filter((e) => e.g === "watersort" && e.pack === name && e.p === i + 1).map((e) => e.ms);
    s.solved = true;
    s.elapsed = best.length ? Math.min(...best) : 0;
    $("time").textContent = fmt(s.elapsed);
    solvedBar(s.elapsed, () => { clearSaved("watersort", packName, idx + 1); load(idx); });
  }
  s.introAt = Date.now();
  s.introWait = first ? 0.45 : 0.05;
  renderPicker();
  render();
}

// Tap a tube: pick it up, pour into it, or put it down.
function tap(i) {
  if (anim) return speedUp();
  if (s.solved || s.pausedAt) return;
  const from = s.picked;
  if (from == null) {
    if (!s.tubes[i].length || (isDone(s.tubes[i]))) return shake(i);
    haptic("tap");
    s.picked = i;
    return render();
  }
  if (from === i) {
    s.picked = null;
    return render();
  }
  if (!canPour(s.tubes, from, i)) {
    s.picked = null;
    render();
    return shake(i);
  }
  startPour(from, i);
}

// Pour `from` into `to` with the animation, then update the board. done = what the hint does after "Show me".
function startPour(from, to, done) {
  const board = $("board");
  const src = board.querySelector(`.tube[data-i="${from}"]`), dst = board.querySelector(`.tube[data-i="${to}"]`);
  const after = pour(s.tubes, from, to);
  const had = s.tubes[to].length, k = after[to].length - had;
  const c = s.tubes[from][s.tubes[from].length - 1];
  undoStack.push(s.tubes.map((t) => [...t]));
  s.picked = null;
  if (!done) { // your own pour closes an open hint
    s.hint = null;
    $("hint").hidden = true;
    $("hintBtn").classList.remove("pressed");
  }
  const lift = src.classList.contains("up") ? -16 : 0;
  src.classList.remove("up", "ring", "shake");
  dst.classList.remove("ring", "target");
  src.style.transition = "none";
  src.style.zIndex = 50;
  src.style.transform = `translateY(${lift}px)`;
  const br = board.getBoundingClientRect(), sr = src.getBoundingClientRect(), tr = dst.getBoundingClientRect();
  const cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2 - lift;
  const dir = tr.left + tr.width / 2 >= cx ? 1 : -1;
  // Tilted, the tube's mouth sits just above the middle of the other tube's mouth.
  const mx = tr.left + tr.width / 2, my = tr.top - 20, rad = (TILT * Math.PI) / 180;
  const drain = [...src.querySelectorAll(".u")].slice(-k).reverse(); // top unit first
  const liquid = dst.querySelector(".liquid");
  const fill = Array.from({ length: k }, () => {
    const u = document.createElement("span");
    u.className = "u";
    u.style.cssText = `height:0px;background-color:${COLORS[c]}`;
    liquid.appendChild(u);
    return u;
  });
  const quiet = calm.matches;
  let stream = null;
  if (!quiet) {
    stream = document.createElement("span");
    stream.className = "stream";
    stream.style.cssText = `left:${mx - br.left - 3}px;height:0px;background:${COLORS[c]}`;
    board.appendChild(stream);
  }
  const A = anim = { from, to, after, done, src, drain, fill, stream, k, had, lift, quiet, t: 0, speed: 1, last: null,
    D: quiet ? 260 : POUR_MS, tx: mx - Math.sin(rad) * dir * (sr.height / 2) - cx, ty: my + Math.cos(rad) * (sr.height / 2) - cy,
    deg: dir * TILT, base: liquid.getBoundingClientRect().bottom - br.top, my: my - br.top };
  if (quiet) haptic("thud");
  const step = (now) => {
    if (anim !== A) return;
    A.t = Math.min(1, A.t + ((now - (A.last ?? now)) / A.D) * A.speed);
    A.last = now;
    drawPour(A);
    if (A.t >= 1) finishPour();
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // If the screen stops drawing frames (the app goes to the background), finish the pour anyway.
  A.seen = performance.now();
  const guard = () => {
    if (anim !== A) return;
    if (performance.now() - (A.last ?? A.seen) > 400) settle();
    else setTimeout(guard, 400);
  };
  setTimeout(guard, 400);
}
function drawPour(A) {
  const t = A.t;
  // 0–28%: lift, move over and tilt · 30–72%: pour · 75–100%: back to its place.
  const move = A.quiet ? 0 : t < 0.75 ? ease(t / 0.28) : 1 - ease((t - 0.75) / 0.25);
  const q = A.quiet ? t : clamp((t - 0.3) / 0.42);
  A.src.style.transform = `translate(${A.tx * move}px, ${A.lift + (A.ty - A.lift) * move}px) rotate(${A.deg * move}deg)`;
  A.drain.forEach((u, j) => (u.style.height = `${UNIT * (1 - clamp(A.k * q - j))}px`));
  A.fill.forEach((u, j) => (u.style.height = `${UNIT * clamp(A.k * q - j)}px`));
  if (A.stream) {
    const surface = A.base - (A.had + A.k * q) * UNIT;
    const top = A.my + (surface - A.my) * clamp((t - 0.7) / 0.06);
    const bottom = A.my + (surface - A.my) * clamp((t - 0.27) / 0.06);
    A.stream.style.transform = `translateY(${top}px)`;
    A.stream.style.height = `${Math.max(0, bottom - top)}px`;
  }
  if (!A.thud && !A.quiet && t >= 0.28) { A.thud = true; haptic("thud"); }
}
function finishPour() {
  const A = anim;
  anim = null;
  A.stream?.remove();
  s.tubes = A.after;
  s.moves++;
  s.hint = null;
  render();
  checkSolved();
  A.done?.();
}
// A tap during a pour: finish it in FAST_MS. settle() = finish it right now (before Undo, a hint, Restart…).
function speedUp() {
  if (anim) anim.speed = Math.max(anim.speed, ((1 - anim.t) * anim.D) / FAST_MS);
}
function settle() {
  if (!anim) return;
  anim.t = 1;
  drawPour(anim);
  finishPour();
}
function shake(i) {
  haptic("tap");
  const el = document.querySelector(`.tube[data-i="${i}"]`);
  el?.classList.remove("shake");
  void el?.offsetWidth;
  el?.classList.add("shake");
}

function checkSolved() {
  if (s.solved || !isSolved(s.tubes)) return;
  s.solved = true;
  s.elapsed = Date.now() - s.started;
  s.winAt = Date.now();
  clearSaved("watersort", packName, idx + 1);
  haptic("success");
  const full = s.tubes.filter((t) => t.length).length;
  for (let k = 1; k < full; k++) setTimeout(() => haptic("tap"), k * 110); // a tick as each tube hops
  const facts = solveFacts("watersort", packName, s.elapsed, s.hints ?? 0);
  logSolve({ g: "watersort", pack: packName, p: idx + 1, ms: s.elapsed, hints: s.hints ?? 0 });
  render();
  celebrate({ title: `${pack.difficulty} #${idx + 1}`, level: pack.difficulty, facts, hasNext: idx < pack.puzzles.length - 1,
    onNext: () => load(idx + 1), delay: 1100 });
}

// Hint: Nudge (ring the tube to pour from) → Explain (where to, and why) → Show me (pours it).
// The solver works from the board as it is now; if there's no way to finish from here, it says so.
function openHint() {
  if (s.solved) return;
  if (s.hint) {
    s.hint = null;
    return render();
  }
  s.hints = (s.hints ?? 0) + 1;
  s.picked = null;
  const sol = solve(s.tubes, 20000);
  if (sol.kind === "stuck") s.hint = { stuck: true, level: 1 };
  else {
    const move = sol.kind === "solved" ? sol.path[0] : tidiestMove(s.tubes);
    s.hint = move ? { move, left: sol.kind === "solved" ? sol.path.length : null, level: 1 } : { stuck: true, level: 1 };
  }
  render();
}
function advanceHint() {
  const h = s.hint;
  if (h.stuck) {
    s.hint = null;
    if (undoStack.length) undo();
    else render();
    return;
  }
  if (h.level === 3) {
    s.hint = null;
    return render();
  }
  if (h.level === 2) { // "Show me": the pour plays, then the card says so (unless that pour finished the level)
    const [a, b] = h.move;
    startPour(a, b, () => {
      if (s.solved) return;
      h.level = 3;
      s.hint = h;
      render();
    });
    return;
  }
  h.level++;
  render();
}
function hintText(h) {
  if (h.stuck) return ["You're stuck", "There's no way to finish from here. Undo a few moves, or restart.", "Undo a move"];
  const [a, b] = h.move;
  const c = s.hint.level === 3 ? null : s.tubes[a][s.tubes[a].length - 1];
  const to = s.tubes[b];
  if (h.level === 1) return [`Look at tube ${a + 1}.`, "", "Explain"];
  if (h.level === 2) {
    const why = !to.length ? `Pour the ${NAMES[c]} from tube ${a + 1} into the empty tube ${b + 1}, to free up what's underneath.`
      : `Pour the ${NAMES[c]} from tube ${a + 1} onto the ${NAMES[c]} in tube ${b + 1}.`;
    return [`Pour tube ${a + 1} into tube ${b + 1}.`, why + (h.left ? ` About ${h.left} moves to go.` : ""), "Show me"];
  }
  return ["Poured!", h.left > 1 ? `About ${h.left - 1} moves to go.` : "", "Done"];
}

// Tubes in one row, or two rows when there are more than 6.
function render() {
  const h = s.hint;
  const n = s.tubes.length;
  const perRow = n <= 6 ? n : Math.ceil(n / 2);
  const intro = Date.now() - s.introAt < 1500;
  const won = s.winAt && Date.now() - s.winAt < 1500;
  const ringA = h && !h.stuck ? h.move[0] : null;
  const ringB = h && !h.stuck && h.level === 2 ? h.move[1] : null;
  const rows = [];
  for (let r = 0; r * perRow < n; r++) {
    const cells = [];
    for (let i = r * perRow; i < Math.min(n, (r + 1) * perRow); i++) {
      const t = s.tubes[i];
      // One column of liquid, bottom first, a thin line between units.
      const liquid = `<span class="liquid">${t.map((c) => `<span class="u" style="height:${UNIT}px;background-color:${COLORS[c]}"></span>`).join("")}</span>`;
      const cls = [i === s.picked ? "up" : "", i === ringA && h.level < 3 ? "ring" : "", i === ringB ? "target" : "",
        intro ? "intro" : "", won && t.length ? "won" : ""].filter(Boolean).join(" ");
      const d = intro ? (s.introWait + 0.1 + i * 0.05).toFixed(2) : (i * 0.11).toFixed(2);
      const what = t.length ? t.map((c) => NAMES[c]).join(", ") : "empty";
      cells.push(`<div class="tube-wrap"><button class="tube ${cls}" style="--d:${d}s" data-i="${i}" aria-label="Tube ${i + 1}: ${what}${i === s.picked ? ", picked up" : ""}">${liquid}</button><span class="tube-num">${i + 1}</span></div>`);
    }
    rows.push(`<div class="tube-row">${cells.join("")}</div>`);
  }
  $("board").innerHTML = rows.join("");
  $("count").textContent = `${s.moves} move${s.moves === 1 ? "" : "s"}`;
  $("hintBtn").classList.toggle("pressed", !!h);

  $("hint").hidden = !h;
  if (h) {
    const [title, body, next] = hintText(h);
    $("hintStep").textContent = h.stuck ? "Hint" : ["Nudge", "Explain", "Show me"][h.level - 1];
    $("hintChip").hidden = true;
    [1, 2, 3].forEach((k) => $("d" + k).classList.toggle("on", h.level >= k));
    $("hintTitle").textContent = title;
    $("hintBody").textContent = body;
    $("hintBody").hidden = !body;
    $("hintNextLabel").textContent = next;
  }
  fitHint($("hint"), $("board"));

  $("rules").hidden = !s.rules;
  $("settings").hidden = !s.settingsOpen;
  document.querySelectorAll("[data-set]").forEach((b) => b.setAttribute("aria-checked", String(!!settings[b.dataset.set])));
  $("timer").classList.toggle("notime", !settings.timer);
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

function undo() {
  settle();
  if (!undoStack.length || s.solved) return;
  haptic("tap");
  s.tubes = undoStack.pop();
  s.moves = Math.max(0, s.moves - 1);
  s.picked = null;
  s.hint = null;
  render();
}

// While a pour plays, a tap anywhere speeds it up and does nothing else; the dock and hint buttons finish it first.
const FINISH_FIRST = "#undoBtn, #hintBtn, #hintNext, #hintClose, #restartBtn, #settingsBtn, #backBtn, #rulesBtn, #timer, #picker";
let swallow = false;
document.addEventListener("pointerdown", (e) => {
  swallow = false;
  if (!anim || e.target.closest(FINISH_FIRST)) return;
  swallow = true;
  speedUp();
}, true);
document.addEventListener("click", (e) => {
  if (e.target.closest(FINISH_FIRST)) return settle();
  if (swallow || anim) {
    swallow = false;
    e.stopPropagation();
    e.preventDefault();
  }
}, true);
$("board").addEventListener("click", (e) => {
  const b = e.target.closest(".tube");
  if (b) tap(Number(b.dataset.i));
});
$("backBtn").onclick = goHome;
$("undoBtn").onclick = undo;
const openMore = moreMenu({
  settingsNote: "Timer",
  onSettings: () => { s.settingsOpen = true; render(); },
  onRestart: () => { clearSaved("watersort", packName, idx + 1); load(idx); },
});
$("settingsBtn").onclick = () => { s.settingsOpen = true; render(); };
$("restartBtn").onclick = () => openMore("confirm");
$("hintBtn").onclick = () => { haptic("pick"); openHint(); };
$("hintClose").onclick = () => { s.hint = null; render(); };
$("hintNext").onclick = () => { haptic("pick"); advanceHint(); };
$("rulesBtn").onclick = () => { s.rules = true; render(); };
document.querySelectorAll("#rules [data-close]").forEach((b) => (b.onclick = () => { s.rules = false; render(); }));
document.querySelectorAll("#settings [data-close]").forEach((b) => (b.onclick = () => { s.settingsOpen = false; render(); }));
document.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => flipSetting(b.dataset.set)));
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !s.pausedAt) undo();
});

function pause() {
  settle();
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

// Keep the half-done level saved (twice a second), with the last 100 undo steps.
function persist() {
  if (!s || s.solved) return;
  if (!s.moves) return void (savedGame("watersort", packName, idx + 1) && clearSaved("watersort", packName, idx + 1)); // back at the start
  saveGame("watersort", packName, { p: idx + 1, tubes: s.tubes, moves: s.moves, undo: undoStack.slice(-100),
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
