// Water Sort play page (Colin, 10/22): the same frame as Star Battle and Sudoku (timer, dock, hint card, saves,
// Solved! card), with glass tubes of colour. The solver in engine/watersort drives the Hint button.
import { CAP, canPour, isDone, isSolved, pour } from "../engine/watersort/rules.ts";
import { solve, tidiestMove } from "../engine/watersort/solve.ts";
import { explain } from "../engine/watersort/explain.ts";
import { par } from "../engine/watersort/par.ts";
import { clearSaved, goHome, haptic, hintThirds, logSolve, moreMenu, saveFinal, saveGame, savedGame, showHintsUsed, smoothClose, solves } from "./bridge.js";
import { celebrate, openWipe, solveFacts, solvedBar } from "./celebrate.js";

const loadPack = async (f) => globalThis.SB_PACKS?.[f] ?? (await fetch(`../packs/${f}`)).json();
const PACKS = {
  easy: await loadPack("watersort-easy.json"),
  medium: await loadPack("watersort-medium.json"),
  hard: await loadPack("watersort-hard.json"),
};
const query = new URLSearchParams(location.search);
// Imported levels (?import=<id>, Colin 10/22) start from the tubes as they were, and save and log under pack
// "import" with p = the import's id. They live in this phone's storage (made here) or in the bundled imports.json
// (added by Claude); in the app a just-made one can reach this page a moment late, so look again for up to 2 seconds.
const importId = query.get("import");
const IMPORTS_KEY = "solvebuddy.imports";
async function findImport(id) {
  const bundled = (await loadPack("imports.json").catch(() => null))?.puzzles ?? [];
  for (let tries = 0; tries < 20; tries++) {
    let mine = [];
    try { mine = JSON.parse(localStorage.getItem(IMPORTS_KEY) || "[]"); } catch {}
    const item = [...mine, ...bundled].find((p) => p.id === id && p.game === "watersort");
    if (item) return item;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
if (importId) PACKS.import = { id: "import", difficulty: "Imported", puzzles: [] };
let packName = importId ? "import" : PACKS[query.get("pack")] ? query.get("pack") : "easy";
let pack = PACKS[packName];
const $ = (id) => document.getElementById(id);
// 12 colours, bright enough to tell apart at a glance.
const COLORS = { A: "#E8574F", B: "#3E86E8", C: "#F4C542", D: "#4CB86A", E: "#9B6BD6", F: "#F28C38",
  G: "#EE7BB0", H: "#2BB3B1", I: "#9C6B4E", J: "#A8D45A", K: "#2F4A8A", L: "#9AA3AD" };
const NAMES = { A: "red", B: "blue", C: "yellow", D: "green", E: "purple", F: "orange", G: "pink", H: "teal", I: "brown",
  J: "lime", K: "navy", L: "grey" };
// px per unit of colour: a little smaller with two rows of tubes, so the hint card never covers them.
let UNIT = 38;

// An imported puzzle's own look (Colin 10/27, S18), set in Settings › This puzzle and kept on this phone: the shade of
// each colour (to match the game in the photo) and how many tubes go in a row (7 + 7 instead of 6 + 6 + 2).
const LOOK_KEY = "solvebuddy.waterLook";
const readLooks = () => { try { return JSON.parse(localStorage.getItem(LOOK_KEY) || "{}"); } catch { return {}; } };
function saveLook() {
  const all = readLooks();
  if (s.look.perRow || Object.keys(s.look.palette ?? {}).length) all[importId] = s.look; else delete all[importId];
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(all)); } catch {}
}
const shade = (c) => s.look?.palette?.[c] ?? COLORS[c];
const defaultPerRow = (n) => (n <= 6 ? n : n <= 12 ? Math.ceil(n / 2) : 6);
// Row choices for n tubes: at most 8 in a row (narrower tubes past 6), at most 3 rows; "7 · 7", "6 · 6 · 2"…
function rowChoices(n) {
  const out = [];
  for (let p = Math.min(8, n); p >= Math.ceil(n / 3); p--) {
    const rows = Array.from({ length: Math.ceil(n / p) }, (_, r) => Math.min(p, n - r * p));
    if (!out.some((o) => o.label === rows.join(" · "))) out.push({ p, label: rows.join(" · ") });
  }
  return out;
}

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

// The pours on screen (Colin, 10/22): the tube lifts, moves over the other and tilts, a stream runs in while one level
// drops and the other rises, then it goes back. Colin 10/23: the board changes the moment a pour starts, so you can pick
// up another tube and pour again while it plays (pours overlap; the animations are only for show). The two tubes of a
// pour can't be picked up or poured into until it ends: tapping either (or above it, in its column) speeds it up.
const anims = [];
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const POUR_MS = 1000, FAST_MS = 120, TILT = 100; // TILT > 90°: the mouth dips below the bottom, so it pours
const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

let idx = importId ? 0 : Math.max(0, Math.min(pack.puzzles.length - 1, Number(query.get("p") || 1) - 1));
// Which level this is for saves, solves and your finished board: its number in a pack, or an import's id.
const pid = () => (packName === "import" ? importId : idx + 1);
let s; // game state
const undoStack = []; // earlier tube states, one per pour

function load(i, name = packName, first = false) {
  anims.splice(0).forEach((A) => A.stream?.remove()); // a new board: drop any pour still playing
  packName = name;
  pack = PACKS[name];
  idx = i;
  undoStack.length = 0;
  const p = pack.puzzles[i];
  s = { tubes: p.tubes.map((t) => [...t]), picked: null, moves: 0, hint: null, started: Date.now(), elapsed: 0,
    solved: false, rules: false, settingsOpen: false, par: par(p.tubes), look: name === "import" ? readLooks()[importId] ?? {} : {} };
  // Pick up where you left off.
  const saved = savedGame("watersort", name, pid());
  if (saved) {
    s.tubes = saved.tubes ?? s.tubes;
    s.moves = saved.moves ?? 0;
    s.started = Date.now() - (saved.ms ?? 0);
    s.hints = saved.hints ?? 0;
    undoStack.push(...(saved.undo ?? []));
  }
  $("sub").textContent = name === "import" ? `Imported · ${p.tubes.length} tubes · ${p.colors} colours`
    : `${p.colors} colours · ${pack.difficulty} · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", name === "import" ? `?import=${encodeURIComponent(importId)}` : `?pack=${name}&p=${i + 1}`);
  // "View solved puzzle": every colour in its own full tube, with your best time.
  if (first && query.get("view")) {
    const colours = [...new Set(p.tubes.flat())].sort();
    s.tubes = [...colours.map((c) => Array(CAP).fill(c)), ...Array(p.tubes.length - colours.length).fill(0).map(() => [])];
    const best = solves().filter((e) => e.g === "watersort" && e.pack === name && e.p === pid()).map((e) => e.ms);
    s.solved = true;
    s.elapsed = best.length ? Math.min(...best) : 0;
    $("time").textContent = fmt(s.elapsed);
    solvedBar(s.elapsed, () => { clearSaved("watersort", packName, pid()); load(idx); });
  }
  s.introAt = Date.now();
  s.introWait = first ? 0.45 : 0.05;
  renderPicker();
  render();
}

// Tap a tube: pick it up, pour into it, or put it down. A tube in a pour still playing speeds that pour up instead.
const busy = (i) => anims.find((A) => A.from === i || A.to === i);
function tap(i) {
  if (s.solved || s.pausedAt) return;
  const playing = busy(i);
  if (playing) return speedUp(playing);
  const from = s.picked;
  if (from == null) {
    if (!s.tubes[i].length || (isDone(s.tubes[i]))) return shake(i);
    haptic("tap");
    s.picked = i;
    return render();
  }
  if (from === i) {
    haptic("pick"); // put it back down
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

// Pour `from` into `to`: the board changes now (so the next move works from it), then the animation plays on top.
// done = what the hint does after "Show me", once the animation ends.
function startPour(from, to, done) {
  const board = $("board");
  const src = board.querySelector(`.tube[data-i="${from}"]`), dst = board.querySelector(`.tube[data-i="${to}"]`);
  const after = pour(s.tubes, from, to);
  const had = s.tubes[to].length, k = after[to].length - had;
  const c = s.tubes[from][s.tubes[from].length - 1];
  const lift = s.picked === from ? -16 : 0;
  const br = board.getBoundingClientRect(), sr = src.getBoundingClientRect(), tr = dst.getBoundingClientRect();
  const cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2 - lift;
  // Tilted, the LOWEST corner of the tube's mouth (its lip) sits just above the middle of the other tube's opening, and
  // the stream leaves from that lip (Colin 10/23: it used to drop from the underside, partway along the tube). It tilts
  // so its body lies toward the middle of the screen, never off the edge (a tube at the side used to swing out of view).
  const pr = document.querySelector(".phone").getBoundingClientRect();
  const mx = tr.left + tr.width / 2, my = tr.top - 8, rad = (TILT * Math.PI) / 180;
  const dir = mx >= pr.left + pr.width / 2 ? 1 : -1;
  const th = dir * rad, cos = Math.cos(th), sin = Math.sin(th);
  // The mouth's two corners (a little in from the rounded rim), turned with the tube; the lower one is the lip.
  const lip = [-1, 1].map((sx) => { const x = sx * (sr.width / 2 - 4), y = -sr.height / 2 + 4; return { x: x * cos - y * sin, y: x * sin + y * cos }; })
    .sort((a, b) => b.y - a.y)[0];
  const quiet = calm.matches;
  let stream = null;
  if (!quiet) {
    stream = document.createElement("span");
    stream.className = "stream";
    stream.style.cssText = `left:${mx - br.left - 3}px;height:0px;background:${shade(c)}`;
  }
  // Inside the pouring tube the liquid stays against its closed bottom (tube space, as it sits upright): the colour being
  // poured shrinks from its top, so empty space only ever shows at the open end (Colin 10/23).
  // fills = this pour makes the other tube one colour, full: a firmer buzz when it lands (Colin 10/24).
  const A = { from, to, c, done, stream, k, had, lift, quiet, t: 0, speed: 1, last: null, fills: after[to].length > 0 && isDone(after[to]),
    D: quiet ? 260 : POUR_MS, tx: mx - lip.x - cx, ty: my - lip.y - cy,
    deg: dir * TILT, base: dst.querySelector(".liquid").getBoundingClientRect().bottom - br.top, my: my - br.top };
  undoStack.push(s.tubes.map((t) => [...t]));
  s.tubes = after;
  s.moves++;
  s.picked = null;
  if (!done) { // your own pour closes an open hint
    s.hint = null;
    $("hint").hidden = true;
    $("hintBtn").classList.remove("pressed");
  }
  anims.push(A);
  render(); // draws the new board and puts every playing pour back on it (bindPour)
  if (quiet) haptic("thud");
  const step = (now) => {
    if (!anims.includes(A)) return;
    A.t = Math.min(1, A.t + ((now - (A.last ?? now)) / A.D) * A.speed);
    A.last = now;
    drawPour(A);
    if (A.t >= 1) finishPour(A);
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // If the screen stops drawing frames (the app goes to the background), finish the pours anyway.
  A.seen = performance.now();
  const guard = () => {
    if (!anims.includes(A)) return;
    if (performance.now() - (A.last ?? A.seen) > 400) settle();
    else setTimeout(guard, 400);
  };
  setTimeout(guard, 400);
}
// render() redraws the board from the state (already after every pour), so each playing pour puts its look back: the
// pouring tube gets the poured units back on top (to drain), the other tube's new top units become the ones filling.
function bindPour(A) {
  const board = $("board");
  A.src = board.querySelector(`.tube[data-i="${A.from}"]`);
  A.dst = board.querySelector(`.tube[data-i="${A.to}"]`);
  A.src.classList.remove("up", "ring", "target", "shake", "intro", "won"); // the opening hop holds its own transform
  A.dst.classList.remove("ring", "target");
  A.src.style.transition = "none";
  A.src.style.zIndex = 50;
  const liquid = A.src.querySelector(".liquid");
  A.drain = Array.from({ length: A.k }, () => {
    const u = document.createElement("span");
    u.className = "u";
    u.style.cssText = `height:${UNIT}px;background-color:${shade(A.c)}`;
    liquid.appendChild(u);
    return u;
  }).reverse(); // top unit first
  A.fill = [...A.dst.querySelectorAll(".liquid .u")].slice(-A.k);
  if (A.stream) board.appendChild(A.stream);
  drawPour(A);
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
// One pour's animation is over: its tubes sit as the board says. The win counts once the last pour has played.
function finishPour(A) {
  const at = anims.indexOf(A);
  if (at < 0) return;
  anims.splice(at, 1);
  A.stream?.remove();
  render();
  if (!anims.length) checkSolved();
  if (A.fills && !s.solved) haptic("thud"); // a tube finished (the win has its own buzz)
  A.done?.();
}
// A tap on a pour's tubes: finish it in FAST_MS. settle() = finish every pour right now (before Undo, a hint, Restart…).
function speedUp(A) {
  A.speed = Math.max(A.speed, ((1 - A.t) * A.D) / FAST_MS);
}
function settle() {
  for (const A of [...anims]) {
    A.t = 1;
    finishPour(A);
  }
}
// A tap off the tubes during a pour: if it's in the column of a tube in a pour (above it, or its number), speed that up.
function columnPour(x, y) {
  let best = null;
  for (const w of $("board").querySelectorAll(".tube-wrap")) {
    const r = w.getBoundingClientRect();
    if (x < r.left - 6 || x > r.right + 6 || y > r.bottom) continue;
    if (!best || r.bottom < best.r.bottom) best = { w, r };
  }
  return best && busy(Number(best.w.querySelector(".tube").dataset.i));
}
function shake(i) {
  haptic("warn"); // a soft no: an empty or finished tube, or a pour that can't go there (Colin 10/24)
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
  clearSaved("watersort", packName, pid());
  saveFinal("watersort", packName, pid(), { tubes: s.tubes.map((t) => [...t]) });
  haptic("success");
  const full = s.tubes.filter((t) => t.length).length;
  for (let k = 1; k < full; k++) setTimeout(() => haptic("tap"), k * 110); // a tick as each tube hops
  const facts = solveFacts("watersort", packName, s.elapsed, Math.round((s.hints ?? 0) * 100) / 100);
  logSolve({ g: "watersort", pack: packName, p: pid(), ms: s.elapsed, hints: Math.round((s.hints ?? 0) * 100) / 100 });
  render();
  const pb = s.par == null ? "" : hintThirds(s.hints) ? `<span class="badge grey" style="--at:.6s">Par ${s.par} · not counted, hint used</span>`
    : s.moves <= s.par ? `<span class="badge gold" style="--at:.6s">On par · ${s.moves} moves</span>`
    : `<span class="badge blue" style="--at:.6s">${s.moves - s.par} over par</span>`;
  celebrate({ title: packName === "import" ? "Imported puzzle" : `${pack.difficulty} #${idx + 1}`, level: pack.difficulty, facts, extra: pb,
    hasNext: packName !== "import" && idx < pack.puzzles.length - 1,
    onNext: () => load(idx + 1), delay: 1100 });
}

// Settings › This puzzle (imports only): tube rows as chips, and a swatch per colour that opens the phone's colour
// picker. Changes show on the board at once; Reset puts the usual colours back.
function drawLook() {
  const box = $("lookGroup");
  box.hidden = packName !== "import";
  if (box.hidden) return;
  const n = s.tubes.length, used = [...new Set(s.tubes.flat())].sort();
  const cur = s.look.perRow ?? defaultPerRow(n);
  $("lookRows").innerHTML = rowChoices(n).map((o) => `<button class="chip-btn${o.p === cur ? " on" : ""}" data-rows="${o.p}" aria-pressed="${o.p === cur}">${o.label}</button>`).join("");
  $("lookColors").innerHTML = used.map((c) => `<label class="shade" style="background:${shade(c)}" aria-label="Change ${NAMES[c]}">
    <input type="color" value="${shade(c)}" data-shade="${c}"></label>`).join("");
  $("lookReset").hidden = !Object.keys(s.look.palette ?? {}).length;
}
$("lookRows").onclick = (e) => {
  const b = e.target.closest("[data-rows]");
  if (!b) return;
  s.look = { ...s.look, perRow: Number(b.dataset.rows) };
  haptic("pick"); saveLook(); drawLook(); render();
};
$("lookColors").oninput = (e) => {
  const c = e.target.dataset.shade;
  if (!c) return;
  s.look = { ...s.look, palette: { ...(s.look.palette ?? {}), [c]: e.target.value } };
  e.target.parentElement.style.background = e.target.value;
  $("lookReset").hidden = false;
  saveLook(); render();
};
$("lookReset").onclick = () => { s.look = { ...s.look, palette: {} }; haptic("tap"); saveLook(); drawLook(); render(); };

// Par beside the move count (Colin 10/27, S17): "Par 18" while you're within it, "+3" past it; once a hint is used it
// still shows, greyed: "Par 18 · hint used". No par when the search couldn't finish (a huge import).
function parTag() {
  if (s.par == null) return null;
  if (hintThirds(s.hints)) return { text: `Par ${s.par} · hint used`, cls: "off" };
  return s.moves <= s.par ? { text: `Par ${s.par}`, cls: "" } : { text: `+${s.moves - s.par}`, cls: "over" };
}

// Hint: Nudge (ring the tube to pour from) → Explain (where to, and why) → Show me (pours it).
// The solver works from the board as it is now; if there's no way to finish from here, it says so.
function openHint() {
  if (s.solved) return;
  if (s.hint) {
    s.hint = null;
    return render();
  }
  s.hints = (s.hints ?? 0) + 1 / 3; // each hint step (Nudge, Explain, Show me) counts a third (Colin, 10/22)
  s.picked = null;
  // Right after a "Show me", carry on with the same plan, so the next hint matches what the last one said would come next.
  const kept = s.nextPlan?.key === JSON.stringify(s.tubes) && s.nextPlan.plan.length ? s.nextPlan.plan : null;
  s.nextPlan = null;
  const sol = kept ? { kind: "solved", path: kept } : solve(s.tubes, 20000);
  if (sol.kind === "stuck") s.hint = { stuck: true, level: 1 };
  else {
    // The solver's plan from here; if it gave up, just the tidiest pour (and no look-ahead).
    const plan = sol.kind === "solved" ? sol.path : [tidiestMove(s.tubes)].filter(Boolean);
    s.hint = plan.length ? { move: plan[0], plan, why: explain(s.tubes, plan, (c) => NAMES[c]), level: 1 } : { stuck: true, level: 1 };
  }
  render();
}
function advanceHint() {
  const h = s.hint;
  if (!h) return; // a second tap on Done while the card slides away
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
    s.hints = (s.hints ?? 0) + 1 / 3;
    const [a, b] = h.move;
    let key = null; // the board right after this pour (it changes as the pour starts)
    startPour(a, b, () => {
      if (s.solved || isSolved(s.tubes) || s.hint !== h) return; // a pour of your own since then closed the card
      s.nextPlan = { key, plan: h.plan.slice(1) };
      h.level = 3;
      s.hint = h;
      render();
    });
    key = JSON.stringify(s.tubes);
    return;
  }
  h.level++;
  s.hints = (s.hints ?? 0) + 1 / 3;
  render();
}
function hintText(h) {
  if (h.stuck) return ["You're stuck", "There's no way to finish from here. Undo a few moves, or restart.", "Undo a move"];
  // Says why, a step or two ahead (engine/watersort/explain.ts), never the whole solution.
  if (h.level === 1) return [`Look at tube ${h.move[0] + 1}.`, h.why.nudge, "Explain"];
  if (h.level === 2) return [h.why.title, h.why.body, "Show me"];
  return ["Poured!", h.why.after, "Done"];
}

// Tubes in one row, two rows when there are more than 6, three rows of 6 past 12 (imports go up to 18).
function render() {
  showHintsUsed(s.solved ? 0 : s.hints); // the quiet "You've used ⅓ of a hint" line over Hint (Colin, 10/23)
  const h = s.hint;
  const n = s.tubes.length;
  const perRow = s.look.perRow && rowChoices(n).some((o) => o.p === s.look.perRow) ? s.look.perRow : defaultPerRow(n);
  const nRows = Math.ceil(n / perRow);
  UNIT = nRows > 2 ? 26 : nRows > 1 ? 34 : 38;
  $("stage").classList.toggle("two", nRows > 1);
  $("stage").classList.toggle("seven", perRow === 7);
  $("stage").classList.toggle("eight", perRow === 8);
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
      const liquid = `<span class="liquid">${t.map((c) => `<span class="u" style="height:${UNIT}px;background-color:${shade(c)}"></span>`).join("")}</span>`;
      const cls = [i === s.picked ? "up" : "", i === ringA && h.level < 3 ? "ring" : "", i === ringB ? "target" : "",
        intro ? "intro" : "", won && t.length ? "won" : ""].filter(Boolean).join(" ");
      const d = intro ? (s.introWait + 0.1 + i * 0.05).toFixed(2) : (i * 0.11).toFixed(2);
      const what = t.length ? t.map((c) => NAMES[c]).join(", ") : "empty";
      cells.push(`<div class="tube-wrap"><button class="tube ${cls}" style="--d:${d}s;height:${CAP * UNIT + 16}px" data-i="${i}" aria-label="Tube ${i + 1}: ${what}${i === s.picked ? ", picked up" : ""}">${liquid}</button><span class="tube-num">${i + 1}</span></div>`);
    }
    rows.push(`<div class="tube-row">${cells.join("")}</div>`);
  }
  $("board").innerHTML = rows.join("");
  anims.forEach(bindPour);
  $("count").textContent = `${s.moves} move${s.moves === 1 ? "" : "s"}`;
  const pt = parTag();
  $("par").hidden = !pt;
  if (pt) { $("par").textContent = pt.text; $("par").className = `par ${pt.cls}`; }
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

  $("rules").hidden = !s.rules;
  if (s.settingsOpen && $("settings").hidden) drawLook(); // built as the sheet opens, so a colour picker stays put
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
    if (name === "import") continue;
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

// While pours play, the other tubes work as usual (tap() speeds up a pour's own tubes); the dock and hint buttons
// finish every pour first; a tap in a playing pour's column, above its tube or on its number, speeds that pour up.
const FINISH_FIRST = "#undoBtn, #hintBtn, #hintNext, #hintClose, #restartBtn, #settingsBtn, #backBtn, #rulesBtn, #timer, #picker";
document.addEventListener("click", (e) => {
  if (!anims.length) return;
  if (e.target.closest(FINISH_FIRST)) return settle();
  if (e.target.closest(".tube, button, #hint, #rules, #settings, #paused")) return;
  const A = columnPour(e.clientX, e.clientY);
  if (A) speedUp(A);
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
  onRestart: () => { clearSaved("watersort", packName, pid()); load(idx); },
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
  if (!s.moves) return void (savedGame("watersort", packName, pid()) && clearSaved("watersort", packName, pid())); // back at the start
  saveGame("watersort", packName, { p: pid(), tubes: s.tubes, moves: s.moves, undo: undoStack.slice(-100),
    ms: (s.pausedAt ?? Date.now()) - s.started, hints: s.hints ?? 0 });
}
setInterval(() => {
  if (s && !s.solved && !s.pausedAt) $("time").textContent = fmt(Date.now() - s.started);
  persist();
}, 500);
addEventListener("pagehide", persist);

smoothClose();
openWipe();
if (!importId) load(idx, packName, true);
else {
  const item = await findImport(importId);
  if (item) {
    PACKS.import.puzzles = [{ ...item, colors: item.colors ?? new Set(item.tubes.flat()).size }];
    load(0, "import", true);
  } else {
    // Never found (deleted, or not on this phone yet): say so kindly, with a way back.
    $("board").innerHTML = `<div class="missing"><b>Couldn't find this import</b><span>It may have been deleted, or not reached this phone yet.</span>
      <button class="dark" id="missingBack">Back</button></div>`;
    $("missingBack").onclick = goHome;
  }
}
