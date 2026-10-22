// Block Drop play page (Colin, 10/22): the falling-blocks game, endless, in the puzzles' look.
// The rules live in engine/blocks/game.ts; this page owns time (gravity, lock delay), touch and drawing.
import { W, H, cellsOf, ghost, gravityMs, grounded, hardDrop, holdPiece, lock, move, newGame, rotate, softDrop } from "../engine/blocks/game.ts";
import { BLOCKS_KEY, blockScores, goHome, haptic, smoothClose } from "./bridge.js";
import { openWipe } from "./celebrate.js";

const $ = (id) => document.getElementById(id);
// Piece colours: the Star Battle region pastels. I O T S Z J L.
const COLORS = ["#A6D8D0", "#FFD08A", "#D8C3EA", "#C6E2A6", "#F5C2C9", "#BFD3F2", "#FFB48A"];
// Each piece's darker edge (62% colour, 38% ink), worked out once. Cells get plain colours, not color-mix() on a
// CSS variable: iPhone Safari didn't always repaint those, which left old ghost outlines behind (Colin, 10/22).
const mix = (hex, pct) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * pct + [0x2A, 0x21, 0x1B][(i - 1) / 2] * (1 - pct))
  .toString(16).padStart(2, "0")).join("");
const EDGES = COLORS.map((c) => mix(c, 0.62));
const blockStyle = (v, small) => `background:${COLORS[v - 1]};border-radius:${small ? 3 : 4}px;box-shadow:inset 0 0 0 ${small ? 1 : 1.5}px ${EDGES[v - 1]},inset 0 ${small ? 2 : 3}px 0 rgba(255,255,255,0.55)`;
const ghostStyle = (v) => `background:transparent;border-radius:4px;box-shadow:inset 0 0 0 2px ${EDGES[v - 1]}8C`;
const LOCK_MS = 500; // time to slide a landed piece before it sets
const MAX_RESETS = 15; // moves that restart the lock timer, so a piece can't be spun forever
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

// Saved scores and the half-played game share one entry: { best, bestLines, played, saved }.
const store = (patch) => { try { localStorage.setItem(BLOCKS_KEY, JSON.stringify({ ...blockScores(), ...patch })); } catch {} };

let s; // engine state
let t; // timing: { fallAt, lockAt, resets, played (ms), started, pausedAt }
let intro = 0; // when the well last built itself (cells pop in as a wave)
let held = false; // the rules sheet is up: the piece waits

// The well's 200 cells and the 8 of Next and Save, built once and restyled on each change.
const well = $("well");
well.innerHTML = Array.from({ length: W * H }, (_, i) => `<div class="b" data-i="${i}"></div>`).join("");
const cells = [...well.children];
const look = cells.map(() => ""); // what each cell shows now, so only changed cells are touched
$("next").innerHTML = Array.from({ length: 8 }, () => `<div class="b"></div>`).join("");
const nextCells = [...$("next").children];
$("hold").innerHTML = Array.from({ length: 8 }, () => `<div class="b"></div>`).join("");
const holdCells = [...$("hold").children];
// A piece drawn small in a 4×2 box (Next and Save).
function mini(els, t) {
  const on = t == null ? new Set() : new Set(cellsOf({ t, r: 0, x: t === 1 ? 1 : 0, y: t === 0 ? -1 : 0 }).map(([x, y]) => y * 4 + x));
  els.forEach((el, i) => { el.style.cssText = on.has(i) ? blockStyle(t + 1, true) : ""; });
}

function start(saved) {
  document.getElementById("won")?.remove();
  s = saved?.s ?? newGame();
  s.hold ??= null; // games saved before "save piece" existed
  s.canHold ??= true;
  t = { fallAt: 0, lockAt: 0, resets: 0, played: saved?.played ?? 0, started: performance.now(), pausedAt: null };
  intro = performance.now();
  render();
  if (saved) pause(); // a game you left comes back paused, ready to resume
}

function render() {
  const g = ghost(s);
  const show = s.board.map((row) => [...row]);
  const ghostAt = new Set(g && !s.over ? cellsOf(g).map(([x, y]) => y * W + x) : []);
  if (s.piece) for (const [x, y] of cellsOf(s.piece)) if (y >= 0) show[y][x] = s.piece.t + 1;
  const wave = performance.now() - intro < 900;
  cells.forEach((el, i) => {
    const v = show[Math.floor(i / W)][i % W];
    const gp = !v && ghostAt.has(i) ? s.piece.t + 1 : 0;
    const intro = wave && v;
    const key = v ? `on${v}${intro ? "i" : ""}` : gp ? `g${gp}` : "";
    if (look[i] === key) return;
    look[i] = key;
    el.className = intro ? "b intro" : "b";
    el.style.cssText = (v ? blockStyle(v) : gp ? ghostStyle(gp) : "")
      + (intro ? `;--d:${((Math.floor(i / W) + (i % W)) * 0.02).toFixed(2)}s` : "");
  });
  mini(nextCells, s.next);
  mini(holdCells, s.hold);
  $("saveBtn").classList.toggle("used", !s.canHold);
  $("saveBtn").classList.toggle("empty", s.hold == null);
  $("saveBtn").setAttribute("aria-label", s.hold == null ? "Save this piece for later" : "Swap with the saved piece");
  $("score").textContent = s.score.toLocaleString();
  $("lines").textContent = s.lines;
  $("best").textContent = Math.max(blockScores().best ?? 0, s.score).toLocaleString();
  $("sub").textContent = `Level ${s.level}`;
}

// After any move or turn: if the piece is resting on something, its lock timer (re)starts.
function moved(ok) {
  if (!ok) return false;
  if (grounded(s)) {
    if (t.lockAt && t.resets < MAX_RESETS) { t.lockAt = performance.now() + LOCK_MS; t.resets++; }
  } else t.lockAt = 0;
  render();
  return true;
}
const playing = () => s && !s.over && !t.pausedAt && !held && !document.getElementById("won");
const doMove = (dx) => playing() && moved(move(s, dx)) && haptic("tap");
const doTurn = (dir = 1) => playing() && moved(rotate(s, dir)) && haptic("tap");
// Save piece: swap the falling piece with the saved one, once per piece (Colin, 10/22).
function doHold() {
  if (!playing()) return;
  if (!holdPiece(s)) { haptic("tap"); return bump($("saveBtn")); }
  haptic("pick");
  t.lockAt = 0;
  t.resets = 0;
  t.fallAt = performance.now() + gravityMs(s.level);
  render();
  if (s.over) gameOver();
}
function bump(el) {
  el.classList.remove("nope");
  void el.offsetWidth;
  el.classList.add("nope");
}
function doSoft() {
  if (!playing() || !softDrop(s)) return;
  t.fallAt = performance.now() + gravityMs(s.level);
  moved(true);
}
function doDrop() {
  if (!playing()) return;
  landed(hardDrop(s));
  well.classList.remove("shake");
  void well.offsetWidth; // restart the little bump
  well.classList.add("shake");
}

// A piece set: clear-row flash and buzzes, level-up tick, or game over.
function landed(res) {
  t.lockAt = 0;
  t.resets = 0;
  t.fallAt = performance.now() + gravityMs(s.level);
  if (res.rows.length) {
    res.rows.forEach((y) => {
      const f = document.createElement("div");
      f.className = "flash";
      f.style.top = `${y * 26}px`;
      well.appendChild(f);
      f.addEventListener("animationend", () => f.remove());
    });
    haptic("success");
    if (res.rows.length === 4) [120, 220, 320].forEach((ms) => setTimeout(() => haptic("tap"), ms)); // four at once!
    $("score").classList.remove("pop");
    void $("score").offsetWidth;
    $("score").classList.add("pop");
  } else haptic("thud");
  if (res.levelUp) setTimeout(() => haptic("pick"), 200);
  render();
  if (s.over) gameOver();
}

// The clock: gravity pulls the piece down a row at a time; a resting piece sets after the lock delay.
function tick(now) {
  requestAnimationFrame(tick);
  if (!playing()) return;
  $("time").textContent = fmt(Math.max(0, t.played + now - t.started));
  if (!t.fallAt) t.fallAt = now + gravityMs(s.level);
  if (grounded(s)) {
    if (!t.lockAt) t.lockAt = now + LOCK_MS;
    if (now >= t.lockAt) landed(lock(s));
    return;
  }
  t.lockAt = 0;
  if (now >= t.fallAt) {
    move(s, 0, 1);
    t.fallAt = now + gravityMs(s.level);
    render();
  }
}

function gameOver() {
  const old = blockScores();
  const best = s.score > (old.best ?? 0);
  store({ best: Math.max(old.best ?? 0, s.score), bestLines: Math.max(old.bestLines ?? 0, s.lines), played: (old.played ?? 0) + 1, saved: null });
  haptic("thud");
  // The Solved! card's look, with the game's own words.
  const el = document.createElement("div");
  el.id = "won";
  el.style.setProperty("--wait", "0.5s");
  const blocks = `<svg width="44" height="44" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M3.5 13h5.5v5.5H3.5z M9.25 13h5.5v5.5h-5.5z M15 13h5.5v5.5H15z M9.25 7.25h5.5v5.5h-5.5z"/></svg>`;
  el.innerHTML = `<div class="won-scrim"></div>
    <section class="won-card" role="dialog" aria-label="Game over">
      <div class="medal"><span class="ring"></span><span class="disc">${blocks}</span></div>
      <div class="won-in" style="--at:.5s"><h2>Game over</h2><p>You scored <b>${s.score.toLocaleString()}</b></p></div>
      <div class="badges">
        ${best && s.score ? `<span class="badge gold" style="--at:.75s">New best!</span>` : ""}
        <span class="badge blue" style="--at:.9s">${s.lines} line${s.lines === 1 ? "" : "s"}</span>
        <span class="badge coral" style="--at:1.05s">Level ${s.level}</span>
      </div>
      <button class="won-next won-in" style="--at:1.1s" data-act="again">Play again<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7 M3 4v5h5"/></svg></button>
      <div class="two won-in" style="--at:1.2s"><button class="ghost" data-act="view">View board</button><button class="ghost" data-act="home">Home</button></div>
    </section>
    <div class="won-bar" hidden>
      <button class="won-pill" data-act="card">Scored ${s.score.toLocaleString()}</button>
      <button class="won-go" data-act="again">Play again</button>
    </div>`;
  document.querySelector(".phone").appendChild(el);
  const show = (card) => {
    el.querySelector(".won-scrim").hidden = !card;
    el.querySelector(".won-card").hidden = !card;
    el.querySelector(".won-bar").hidden = card;
    el.classList.toggle("viewing", !card);
  };
  el.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "again") { haptic("thud"); start(); }
    else if (act === "home") goHome();
    else if (act === "view") show(false);
    else if (act === "card") { el.style.setProperty("--wait", "0s"); show(true); }
  };
}

// Pause (same as the puzzles): tap the clock, or leave the page.
function pause() {
  if (!s || s.over || t.pausedAt) return;
  t.pausedAt = performance.now();
  t.played += t.pausedAt - t.started;
  $("pausedText").textContent = `Score ${s.score.toLocaleString()} · Level ${s.level} · ${fmt(t.played)}`;
  $("time").textContent = fmt(t.played);
  $("paused").hidden = false;
  persist();
}
function resume() {
  if (!t.pausedAt) return;
  t.pausedAt = null;
  t.started = performance.now();
  t.fallAt = t.started + gravityMs(s.level);
  t.lockAt = 0;
  $("paused").hidden = true;
  haptic("pick");
}
$("timer").onclick = pause;
$("resumeBtn").onclick = resume;
document.addEventListener("visibilitychange", () => document.hidden && pause());

// Keep the game going across leaving and coming back (Colin: everything resumable).
function persist() {
  if (!s) return;
  const played = t.pausedAt ? t.played : t.played + performance.now() - t.started;
  store({ saved: s.over ? null : { s, played } });
}
setInterval(persist, 500);
addEventListener("pagehide", persist);

// Touch (Colin, 10/22: more forgiving). The whole play area counts, not just the well: the space beside and under
// it too (buttons, the header and the dock keep their own jobs).
//   tap (moves under 14px, lifts within 350ms) = turn
//   swipe sideways = one column per 24px
//   slow drag down = soft drop, a row per 24px
//   quick swipe up, or quick flick down = drop all the way
// The direction is decided once per touch (after 10px), so a sideways swipe never drops the piece.
const STEP = 24, TAP_PX = 14, TAP_MS = 350, AXIS_PX = 10;
const pad = document.querySelector(".screen");
let drag = null;
pad.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button, header, .info, .dock") || drag) return;
  e.preventDefault();
  try { pad.setPointerCapture(e.pointerId); } catch {} // fast swipes keep reporting even past the edge of the well
  const now = performance.now();
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: now, axis: null, far: 0,
    trail: [{ t: now, y: e.clientY }] };
});
pad.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  drag.far = Math.max(drag.far, Math.hypot(dx, dy));
  const now = performance.now();
  drag.trail.push({ t: now, y: e.clientY });
  while (drag.trail.length > 2 && now - drag.trail[0].t > 120) drag.trail.shift();
  if (!drag.axis && drag.far >= AXIS_PX) drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  if (drag.axis === "x") {
    while (e.clientX - drag.x >= STEP) { drag.x += STEP; doMove(1); }
    while (drag.x - e.clientX >= STEP) { drag.x -= STEP; doMove(-1); }
  } else if (drag.axis === "y") {
    // Creep down only while moving slowly; a fast flick is left for the drop on release.
    const v = speed(drag);
    while (e.clientY - drag.y >= STEP && v < FLICK) { drag.y += STEP; doSoft(); }
    if (e.clientY - drag.y >= STEP && v >= FLICK) drag.y = e.clientY - ((e.clientY - drag.y) % STEP);
  }
});
const FLICK = 0.55; // px per ms over the last ~120ms
const speed = (d) => { const a = d.trail[0], b = d.trail[d.trail.length - 1]; return b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0; };
function release(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (e.type === "pointercancel") return;
  const dy = e.clientY - d.y0, ms = performance.now() - d.at, v = speed(d);
  if (d.far < TAP_PX && ms < TAP_MS) return doTurn();
  if (d.axis !== "y") return;
  if (dy <= -30 && (v <= -FLICK || dy <= -60)) doDrop(); // swipe up
  else if (dy >= 30 && v >= FLICK) doDrop(); // quick flick down
}
pad.addEventListener("pointerup", release);
pad.addEventListener("pointercancel", release);

// Dock: Left and Right repeat while held (after a short wait), Turn and Drop act once.
function holdRepeat(btn, fn) {
  let wait, rep;
  const stop = () => { clearTimeout(wait); clearInterval(rep); };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    fn();
    stop();
    wait = setTimeout(() => (rep = setInterval(fn, 60)), 170);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, stop));
}
holdRepeat($("leftBtn"), () => doMove(-1));
holdRepeat($("rightBtn"), () => doMove(1));
$("turnBtn").onclick = () => doTurn();
$("dropBtn").onclick = doDrop;
$("saveBtn").addEventListener("pointerdown", (e) => { e.preventDefault(); doHold(); });

// Keyboard in a browser: arrows, Z / X or Up to turn, Space to drop, P or Esc to pause.
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "ArrowLeft") doMove(-1);
  else if (k === "ArrowRight") doMove(1);
  else if (k === "ArrowDown") doSoft();
  else if (k === "ArrowUp" || k === "x" || k === "X") doTurn(1);
  else if (k === "z" || k === "Z") doTurn(-1);
  else if (k === " ") doDrop();
  else if (k === "c" || k === "C" || k === "Shift") doHold();
  else if (k === "p" || k === "P" || k === "Escape") (t?.pausedAt ? resume() : pause());
  else return;
  e.preventDefault();
});

$("backBtn").onclick = () => { persist(); goHome(); };
$("rulesBtn").onclick = () => { held = true; $("rules").hidden = false; };
document.querySelectorAll("#rules [data-close]").forEach((b) => (b.onclick = () => {
  $("rules").hidden = true;
  held = false;
  t.fallAt = performance.now() + gravityMs(s.level);
  t.lockAt = 0;
}));

smoothClose();
openWipe();
const saved = blockScores().saved;
start(saved?.s && !saved.s.over ? saved : null);
if (!saved?.s) { t.started = performance.now() + 600; t.fallAt = t.started + gravityMs(1); } // let the opening wipe finish first
requestAnimationFrame(tick);
