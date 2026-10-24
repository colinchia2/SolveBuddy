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
// Game over: the stack greys out from the bottom up.
const GREY = "background:#C9C2BA;border-radius:4px;box-shadow:inset 0 0 0 1.5px #A69D93,inset 0 3px 0 rgba(255,255,255,0.4)";
const GREY_EMPTY = "background:#EEEAE5";
const LOCK_MS = 500; // time to slide a landed piece before it sets
const MAX_RESETS = 15; // moves that restart the lock timer, so a piece can't be spun forever
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

// Saved scores and the half-played game share one entry: { best, bestLines, played, saved }.
const store = (patch) => { try { localStorage.setItem(BLOCKS_KEY, JSON.stringify({ ...blockScores(), ...patch })); } catch {} };

let s; // engine state
let t; // timing: { fallAt, lockAt, resets, played (ms), started, pausedAt (the clock is stopped) }
let intro = 0; // when the well last built itself (cells pop in as a wave)
let held = false; // the rules sheet is up: the piece waits
let counting = 0; // a countdown is running (its id, so pausing can cancel it)
let countIds = 0;
let ending = false; // the game-over animation is playing

// The well's 200 cells and the 8 of Next and Save, built once and restyled on each change.
const well = $("well");
well.innerHTML = Array.from({ length: W * H }, (_, i) => `<div class="b" data-i="${i}"></div>`).join("");
const cells = [...well.children];
const look = cells.map(() => ""); // what each cell shows now, so only changed cells are touched
const CELL = 27; // px, matches .well --c
$("next").innerHTML = Array.from({ length: 8 }, () => `<div class="b"></div>`).join("");
const nextCells = [...$("next").children];
$("hold").innerHTML = Array.from({ length: 8 }, () => `<div class="b"></div>`).join("");
const holdCells = [...$("hold").children];
// A number that always fits its card (Colin, 10/22: what happens past 99,999?): the text shrinks until it fits.
function fit(el, text) {
  if (el.textContent === text && el.dataset.fit) return;
  el.textContent = text;
  el.dataset.fit = "1";
  for (let px = 18; px >= 10; px--) {
    el.style.fontSize = `${px}px`;
    if (el.scrollWidth <= el.clientWidth) break;
  }
}
// A piece drawn small in a 4×2 box (Next and Save).
function mini(els, t) {
  const cells = t == null ? [] : cellsOf({ t, r: 0, x: t === 1 ? 1 : 0, y: t === 0 ? -1 : 0 });
  const on = new Set(cells.map(([x, y]) => y * 4 + x));
  els.forEach((el, i) => { el.style.cssText = on.has(i) ? blockStyle(t + 1, true) : ""; });
  // Centre the piece in its box: 3-wide pieces sit half a block in (Colin, 10/22: the saved piece looked off-centre).
  const xs = cells.map(([x]) => x), ys = cells.map(([, y]) => y);
  const midX = xs.length ? (Math.min(...xs) + Math.max(...xs) + 1) / 2 : 2, midY = ys.length ? (Math.min(...ys) + Math.max(...ys) + 1) / 2 : 1;
  els[0].parentElement.style.transform = `translate(${(2 - midX) * 15}px, ${(1 - midY) * 15}px)`; // the I piece is one row: half a row down
}

// The clock: stopped while paused, counting down, reading the rules or over.
function clockStop() {
  if (t.pausedAt) return;
  t.pausedAt = performance.now();
  t.played += t.pausedAt - t.started;
}
function clockGo() {
  t.pausedAt = null;
  t.started = performance.now();
  t.fallAt = t.started + gravityMs(s.level);
  t.lockAt = 0;
}
const playedMs = () => (t.pausedAt ? t.played : t.played + performance.now() - t.started);

// A game (new, or the saved one) set up with the clock stopped; a countdown starts it.
function setup(saved) {
  document.getElementById("won")?.remove();
  ending = false;
  s = saved?.s ?? newGame();
  s.hold ??= null; // games saved before "save piece" existed
  s.canHold ??= true;
  t = { fallAt: 0, lockAt: 0, resets: 0, played: saved?.played ?? 0, started: performance.now(), pausedAt: performance.now() };
  intro = performance.now();
  look.fill("?"); // repaint every cell
  $("time").textContent = fmt(t.played);
  render();
}

// 3, 2, 1, Go! on the well, then pieces fall (Colin, 10/22). A light tick per number, a thud on Go.
function countdown(stepMs = 600) {
  const id = (counting = ++countIds);
  well.querySelector(".count")?.remove();
  const box = document.createElement("div");
  box.className = "count";
  well.appendChild(box);
  ["3", "2", "1", "Go!"].forEach((label, i) => setTimeout(() => {
    if (counting !== id) return;
    box.innerHTML = `<span class="${i === 3 ? "go" : ""}" style="--ms:${stepMs}ms">${label}</span>`;
    haptic(i === 3 ? "thud" : "tap");
  }, i * stepMs));
  setTimeout(() => {
    if (counting !== id) return;
    counting = 0;
    box.remove();
    clockGo();
  }, 3 * stepMs + stepMs * 0.5);
}
const stopCountdown = () => { counting = 0; well.querySelector(".count")?.remove(); };

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
  fit($("score"), s.score.toLocaleString());
  fit($("lines"), s.lines.toLocaleString());
  fit($("best"), Math.max(blockScores().best ?? 0, s.score).toLocaleString());
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
const playing = () => s && !s.over && !t.pausedAt && !held && !counting && !ending && !document.getElementById("won");
const doMove = (dx) => playing() && moved(move(s, dx)) && haptic("tap");
const doTurn = (dir = 1) => playing() && moved(rotate(s, dir)) && haptic("tap");
// Save piece: swap the falling piece with the saved one, once per piece (Colin, 10/22).
function doHold() {
  if (!playing()) return;
  if (!holdPiece(s)) { haptic("tap"); return bump($("saveBtn"), "nope"); }
  haptic("pick");
  t.lockAt = 0;
  t.resets = 0;
  t.fallAt = performance.now() + gravityMs(s.level);
  render();
  if (s.over) gameOver();
}
// Restart a one-shot CSS animation on an element.
function bump(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
function doSoft() {
  if (!playing() || !softDrop(s)) return false;
  t.fallAt = performance.now() + gravityMs(s.level);
  moved(true);
  return true;
}
function doDrop() {
  if (!playing()) return;
  landed(hardDrop(s));
  bump(well, "shake");
}

// A piece set: clear-row fun (short, never in the way), level-up tick, or game over.
function landed(res) {
  t.lockAt = 0;
  t.resets = 0;
  t.fallAt = performance.now() + gravityMs(s.level);
  if (res.rows.length) cleared(res);
  else haptic("thud");
  if (res.levelUp) setTimeout(() => haptic("pick"), 250);
  render();
  if (s.over) gameOver();
}

// Rows cleared (Colin, 10/22): each row flashes and throws sparks, the points float up. Two or three rows: bigger
// points. Four at once: a "Four lines!" banner, a pulse round the well and extra buzzes. All under 0.7s, and touches
// go straight through to the game.
function cleared(res) {
  const n = res.rows.length;
  for (const y of res.rows) {
    add("flash", { top: `${y * CELL}px` });
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * (n === 4 ? 46 : 30);
      add("spark", { left: `${Math.random() * W * CELL}px`, top: `${y * CELL + CELL / 2 - 3}px`,
        background: COLORS[Math.floor(Math.random() * COLORS.length)], "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px` });
    }
  }
  const mid = res.rows.reduce((a, b) => a + b, 0) / n;
  add(n > 1 ? "pts big" : "pts", { top: `${Math.max(0, mid * CELL - 30)}px` }, `+${res.points.toLocaleString()}`);
  // Stronger than a piece landing (Colin 10/24): a medium thud, then the success buzz, then a tap per extra row.
  haptic("thud");
  setTimeout(() => haptic("success"), 80);
  if (n === 4) {
    add("banner", {}, "Four lines!");
    bump(well, "pulse");
    [200, 300, 400].forEach((ms) => setTimeout(() => haptic("tap"), ms));
  } else if (n > 1) setTimeout(() => haptic("tap"), 200);
  bump($("score"), "pop");
}
// One short-lived effect on the well; it removes itself when its animation ends.
function add(cls, style, text = "") {
  const el = document.createElement("div");
  el.className = cls;
  for (const [k, v] of Object.entries(style)) el.style.setProperty(k, v);
  el.textContent = text;
  well.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
  setTimeout(() => el.remove(), 1500); // in case the animation never ran (page hidden)
}

// The clock: gravity pulls the piece down a row at a time; a resting piece sets after the lock delay.
function tick(now) {
  requestAnimationFrame(tick);
  try {
    if (!playing()) return;
    $("time").textContent = fmt(Math.max(0, playedMs()));
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
  } catch (err) { console.error(err); } // one bad frame must never stop the game
}

// Game over (Colin, 10/22): the stack greys out from the bottom up (~0.8s), then a friendly card.
function gameOver() {
  if (ending) return;
  ending = true;
  endDrag();
  clockStop();
  const old = blockScores();
  const best = s.score > 0 && s.score > (old.best ?? 0);
  store({ best: Math.max(old.best ?? 0, s.score), bestLines: Math.max(old.bestLines ?? 0, s.lines), played: (old.played ?? 0) + 1, saved: null });
  haptic("thud");
  for (let y = H - 1; y >= 0; y--) {
    setTimeout(() => {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        cells[i].className = "b";
        cells[i].style.cssText = s.board[y][x] ? GREY : GREY_EMPTY;
        look[i] = "?";
      }
      if (y % 4 === 0) haptic("tap");
    }, (H - 1 - y) * 40);
  }
  setTimeout(() => showCard(best), H * 40 + 120);
}
function showCard(best) {
  // The Solved! card's look, with the game's own words.
  const el = document.createElement("div");
  el.id = "won";
  el.style.setProperty("--wait", "0.2s");
  const blocks = `<svg width="44" height="44" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M3.5 13h5.5v5.5H3.5z M9.25 13h5.5v5.5h-5.5z M15 13h5.5v5.5H15z M9.25 7.25h5.5v5.5h-5.5z"/></svg>`;
  el.innerHTML = `<div class="won-scrim"></div>
    <section class="won-card" role="dialog" aria-label="Game over">
      <div class="medal"><span class="ring"></span><span class="disc">${blocks}</span></div>
      <div class="won-in" style="--at:.2s"><h2>Game over</h2><p>${best ? "" : "Nice run! "}You scored <b>${s.score.toLocaleString()}</b></p></div>
      <div class="badges">
        ${best ? `<span class="badge gold" style="--at:.45s">New best!</span>` : ""}
        <span class="badge blue" style="--at:.6s">${s.lines} line${s.lines === 1 ? "" : "s"}</span>
        <span class="badge coral" style="--at:.75s">Level ${s.level}</span>
      </div>
      <button class="won-next won-in" style="--at:.8s" data-act="again">Play again<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7 M3 4v5h5"/></svg></button>
      <div class="two won-in" style="--at:.9s"><button class="ghost" data-act="view">View board</button><button class="ghost" data-act="home">Home</button></div>
    </section>
    <div class="won-bar" hidden>
      <button class="won-pill" data-act="card">Scored ${s.score.toLocaleString()}</button>
      <button class="won-go" data-act="again">Play again</button>
    </div>`;
  document.querySelector(".phone").appendChild(el);
  if (best) haptic("success");
  const show = (card) => {
    el.querySelector(".won-scrim").hidden = !card;
    el.querySelector(".won-card").hidden = !card;
    el.querySelector(".won-bar").hidden = card;
    el.classList.toggle("viewing", !card);
  };
  el.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "again") { haptic("thud"); setup(); countdown(); }
    else if (act === "home") goHome();
    else if (act === "view") { show(false); look.fill("?"); render(); } // the real board, not the grey
    else if (act === "card") { el.style.setProperty("--wait", "0s"); show(true); }
  };
}

// Pause (same as the puzzles): tap the clock, or leave the page. Coming back counts down 3, 2, 1 again.
function pause() {
  if (!s || s.over || ending || !$("paused").hidden) return;
  stopCountdown();
  endDrag();
  clockStop();
  $("pausedText").textContent = `Score ${s.score.toLocaleString()} · Level ${s.level} · ${fmt(t.played)}`;
  $("time").textContent = fmt(t.played);
  $("paused").hidden = false;
  persist();
}
function resume() {
  if ($("paused").hidden) return;
  $("paused").hidden = true;
  if (!$("startSheet").hidden) return; // still choosing Resume or New game
  countdown(450);
}
$("timer").onclick = pause;
$("resumeBtn").onclick = resume;
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

// Keep the game going across leaving and coming back (Colin: everything resumable).
function persist() {
  if (!s || ending) return;
  store({ saved: s.over ? null : { s, played: playedMs() } });
}
setInterval(persist, 500);
addEventListener("pagehide", persist);

// Touch (Colin, 10/22). The whole play area counts, not just the well (buttons and the header keep their own jobs):
//   tap (moves under 14px, lifts within 300ms) = turn
//   hold still (300ms+) = drop faster until you let go
//   swipe sideways = one column per 24px
//   slow drag down = soft drop, a row per 24px
//   swipe up = Save the piece (Colin, 10/22; same rule as the Save card: once per piece)
//   quick flick down = drop all the way
// The direction is decided once per touch (after 10px), so a sideways swipe never drops the piece.
// Input must never get stuck (Colin: after ~10 turns it stopped answering): a new touch always replaces an old one
// that never ended, and every way a touch can end (lift, cancel, lost capture, leaving the app) clears it.
const STEP = 24, TAP_PX = 14, HOLD_MS = 300, AXIS_PX = 10, SOFT_EVERY = 55;
const FLICK = 0.55; // px per ms over the last ~120ms
const pad = document.querySelector(".screen");
let drag = null, holdWait = 0, holdRep = 0;
function endDrag() {
  clearTimeout(holdWait);
  clearInterval(holdRep);
  holdWait = holdRep = 0;
  drag = null;
}
const speed = (d) => { const a = d.trail[0], b = d.trail[d.trail.length - 1]; return b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0; };
// An error in one handler mustn't leave a touch half-done.
const safe = (fn) => (e) => { try { fn(e); } catch (err) { endDrag(); console.error(err); } };

pad.addEventListener("pointerdown", safe((e) => {
  if (e.target.closest("button, header, .info")) return;
  endDrag(); // a touch that never ended doesn't block this one
  e.preventDefault();
  try { pad.setPointerCapture(e.pointerId); } catch {} // fast swipes keep reporting even past the edge of the well
  const now = performance.now();
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: now, axis: null, far: 0,
    holding: false, trail: [{ t: now, y: e.clientY }] };
  holdWait = setTimeout(() => {
    if (!drag || drag.far >= TAP_PX) return;
    drag.holding = true;
    doSoft();
    holdRep = setInterval(() => { if (!drag?.holding || !doSoft()) clearInterval(holdRep); }, SOFT_EVERY);
  }, HOLD_MS);
}));
addEventListener("pointermove", safe((e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  drag.far = Math.max(drag.far, Math.hypot(dx, dy));
  const now = performance.now();
  drag.trail.push({ t: now, y: e.clientY });
  while (drag.trail.length > 2 && now - drag.trail[0].t > 120) drag.trail.shift();
  if (!drag.axis && drag.far >= AXIS_PX) {
    drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    if (drag.axis === "x") { clearTimeout(holdWait); clearInterval(holdRep); drag.holding = false; }
  }
  if (drag.axis === "x") {
    while (e.clientX - drag.x >= STEP) { drag.x += STEP; doMove(1); }
    while (drag.x - e.clientX >= STEP) { drag.x -= STEP; doMove(-1); }
  } else if (drag.axis === "y" && !drag.holding) {
    // Creep down only while moving slowly; a fast flick is left for the drop on release.
    const v = speed(drag);
    while (e.clientY - drag.y >= STEP && v < FLICK) { drag.y += STEP; doSoft(); }
    if (e.clientY - drag.y >= STEP && v >= FLICK) drag.y = e.clientY - ((e.clientY - drag.y) % STEP);
  }
}));
function release(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  endDrag();
  if (e.type !== "pointerup" || d.holding) return;
  const dy = e.clientY - d.y0, ms = performance.now() - d.at, v = speed(d);
  if (d.far < TAP_PX && ms < HOLD_MS + 50) return doTurn();
  if (d.axis !== "y") return;
  if (dy <= -30 && (v <= -FLICK || dy <= -60)) doHold(); // swipe up = Save
  else if (dy >= 30 && v >= FLICK) doDrop(); // quick flick down
}
// On the window, so a finger lifted anywhere (even if capture was lost) still ends the touch.
addEventListener("pointerup", safe(release));
addEventListener("pointercancel", safe(release));
// Capture can be lost without a lift reaching us: if no lift follows shortly, end the touch.
pad.addEventListener("lostpointercapture", (e) => { const id = e.pointerId; setTimeout(() => { if (drag?.id === id) endDrag(); }, 120); });
addEventListener("blur", endDrag);
// No text selection, magnifier or Copy / Look Up menu anywhere on this page (Colin, 10/22).
document.addEventListener("selectstart", (e) => e.preventDefault());
document.addEventListener("contextmenu", (e) => e.preventDefault());

$("saveBtn").addEventListener("pointerdown", safe((e) => { e.preventDefault(); doHold(); }));

// Keyboard in a browser: arrows, Z / X or Up to turn, Space to drop, C to save, P or Esc to pause.
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "ArrowLeft") doMove(-1);
  else if (k === "ArrowRight") doMove(1);
  else if (k === "ArrowDown") doSoft();
  else if (k === "ArrowUp" || k === "x" || k === "X") doTurn(1);
  else if (k === "z" || k === "Z") doTurn(-1);
  else if (k === " ") doDrop();
  else if (k === "c" || k === "C" || k === "Shift") doHold();
  else if (k === "p" || k === "P" || k === "Escape") ($("paused").hidden ? pause() : resume());
  else return;
  e.preventDefault();
});

$("backBtn").onclick = () => { persist(); goHome(); };
$("rulesBtn").onclick = () => { held = true; endDrag(); $("rules").hidden = false; };
document.querySelectorAll("#rules [data-close]").forEach((b) => (b.onclick = () => {
  $("rules").hidden = true;
  held = false;
  if (t) { t.fallAt = performance.now() + gravityMs(s.level); t.lockAt = 0; }
}));

// Opening (Colin, 10/22): a game you left asks "Resume or New game?"; either way 3, 2, 1, Go! before pieces fall.
smoothClose();
openWipe();
const saved = blockScores().saved;
if (saved?.s && !saved.s.over) {
  setup(saved);
  $("startFacts").innerHTML = [`Score ${saved.s.score.toLocaleString()}`, `Level ${saved.s.level}`,
    `${saved.s.lines} line${saved.s.lines === 1 ? "" : "s"}`, fmt(saved.played ?? 0)].map((f) => `<span>${f}</span>`).join("");
  setTimeout(() => { $("startSheet").hidden = false; }, 450); // after the opening wipe
  $("startResume").onclick = () => { haptic("thud"); $("startSheet").hidden = true; countdown(); };
  $("startNew").onclick = () => { haptic("thud"); store({ saved: null }); $("startSheet").hidden = true; setup(); countdown(); };
} else {
  setup();
  setTimeout(() => countdown(), 600); // let the opening wipe finish first
}
requestAnimationFrame(tick);
