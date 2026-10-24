// Shikaku play page (Colin 10/24, docs/design/shikaku_mockup.html v2), wired to engine/shikaku and the packs.
// - Drag from a square: a patch follows the finger (a short ease, no wobble) and shows its size. Let go to place it.
// - Drag that starts on a patch grows it: it covers the patch plus every square up to the finger; it never starts
//   over. Dragging inside a patch changes nothing. Tap a patch to take it away; tap a 1 to draw it.
// - A patch with no number, two numbers or too many squares lands hatched red with one plain line why. One that holds
//   its number but is still too small has a dashed edge (hints draw those too: "partial patches").
// - Each patch has its own colour; touching patches never share one. Solved: a wave from the top-left, then every
//   patch fills solid and the Solved card shows the picture.
// Haptics (bridge.js levels): L1 for each new square while dragging, L2 when a patch lands, warn on red, L5 solved.
// The header, info row, bottom bar, hint card, settings, pause and finish are the same as Nonogram's.
import { hint as findHint, area, cluesIn, inside, isSolved, overlaps, same, sortPatches } from "../engine/shikaku/shikaku.ts";
import { clearSaved, finalBoard, goHome, haptic, hapticLevel, loadPack, logSolve, moreMenu, saveFinal, saveGame, savedGame, showHintsUsed, smoothClose, solves } from "./bridge.js";
import { celebrate, openWipe, solveFacts, solvedBar } from "./celebrate.js";
import { SHK_COLORS, shikakuColors, shikakuPicture } from "./screens.js";
import { second } from "./zoom.js";

const PACKS = {
  easy: await loadPack("shikaku8-easy.json"),
  medium: await loadPack("shikaku10-medium.json"),
  hard: await loadPack("shikaku12-hard.json"),
};
const query = new URLSearchParams(location.search);
let packName = PACKS[query.get("pack")] ? query.get("pack") : "easy";
let pack = PACKS[packName];
let idx = Math.max(0, Math.min(pack.puzzles.length - 1, Number(query.get("p") || 1) - 1));
const $ = (id) => document.getElementById(id);
const pid = () => idx + 1;
const fmt = (ms) => { const t = Math.floor(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const TIP = "Drag to draw a patch · drag from a patch to grow it";

const SETTINGS_KEY = "solvebuddy.settings";
const settings = { timer: true, mistakes: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch {}
function flipSetting(name) {
  settings[name] = !settings[name];
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"), [name]: settings[name] })); } catch {}
  render();
}

let P, N, s; // the puzzle, its size, the game state (s.patches = [{ r, c, w, h, k }], k = colour)
const undoStack = [];
const snap = () => JSON.stringify(s.patches);
const restore = (j) => { s.patches = JSON.parse(j); };
const rects = () => s.patches.map(({ r, c, w, h }) => ({ r, c, w, h }));
const num = (i) => P.clues[i][2];
// What a patch is: "ok" (one number, the right size), "part" (one number, too small) or "err" (and why).
function status(R) {
  const k = cluesIn(P, R);
  if (k.length === 0) return { kind: "err", why: "Each patch needs one number. This one has none." };
  if (k.length > 1) return { kind: "err", why: `This patch has ${k.length} numbers. A patch holds just one.` };
  const n = num(k[0]), a = area(R);
  if (a > n) return { kind: "err", why: `The ${n} needs ${n} square${n === 1 ? "" : "s"}. This patch has ${a}.` };
  if (a < n) return { kind: "part", why: `The ${n} needs ${n - a} more square${n - a === 1 ? "" : "s"}.` };
  return { kind: "ok", why: "" };
}
const touches = (a, b) => a.r <= b.r + b.h && b.r <= a.r + a.h && a.c <= b.c + b.w && b.c <= a.c + a.w
  && !((a.r + a.h === b.r || b.r + b.h === a.r) && (a.c + a.w === b.c || b.c + b.w === a.c)); // corners don't count
// A colour no touching patch has (keep `keep` if it's still free).
function colorFor(R, keep = -1, others = s.patches) {
  const used = new Set(others.filter((Q) => touches(Q, R)).map((Q) => Q.k));
  if (keep >= 0 && !used.has(keep)) return keep;
  const start = (R.r * 7 + R.c * 3) % SHK_COLORS.length;
  for (let t = 0; t < SHK_COLORS.length; t++) { const k = (start + t) % SHK_COLORS.length; if (!used.has(k)) return k; }
  return start;
}

// ---- Loading a puzzle ----
let cs = 30; // square size in px
function load(i, name = packName, first = false) {
  packName = name; pack = PACKS[name]; idx = i;
  P = pack.puzzles[i]; N = P.size;
  undoStack.length = 0;
  s = { patches: [], hint: null, started: Date.now(), solved: false, rules: false, settingsOpen: false, hints: 0, msg: null, landed: null };
  const saved = savedGame("shikaku", name, pid());
  if (saved) { s.patches = (saved.patches ?? []).map((Q) => ({ ...Q })); s.started = Date.now() - (saved.ms ?? 0); s.hints = saved.hints ?? 0; }
  $("sub").textContent = `${pack.difficulty} · ${N}×${N} · #${i + 1}`;
  $("time").textContent = "0:00";
  history.replaceState(null, "", `?${query.get("game") ? "game=shikaku&" : ""}pack=${name}&p=${i + 1}`);
  const b = $("board");
  b.classList.remove("won", "wave");
  b.style.setProperty("--n", N);
  const room = Math.max(280, Math.min(358, $("stage").clientHeight - 60));
  cs = Math.floor(room / N);
  b.style.width = b.style.height = `${cs * N}px`;
  b.style.setProperty("--fs", `${N >= 12 ? 13 : N >= 10 ? 15 : 17}px`);
  $("cells").innerHTML = Array.from({ length: N * N }, () => "<i></i>").join("");
  const at = new Map(P.clues.map(([r, c, n]) => [r * N + c, n]));
  $("nums").innerHTML = Array.from({ length: N * N }, (_, x) => `<span>${at.get(x) ?? ""}</span>`).join("");
  $("patches").innerHTML = "";
  if (first && query.get("view")) {
    const mine = finalBoard("shikaku", name, pid());
    s.patches = mine?.patches ?? shikakuColors(P.solution);
    const best = solves().filter((e) => e.g === "shikaku" && e.pack === name && e.p === pid()).map((e) => e.ms);
    s.solved = true;
    s.elapsed = best.length ? Math.min(...best) : 0;
    $("time").textContent = fmt(s.elapsed);
    b.classList.add("won");
    solvedBar(s.elapsed, () => { clearSaved("shikaku", packName, pid()); load(idx); });
  }
  render();
}

// ---- Drawing ----
const pct = (v) => `${(v / N) * 100}%`;
function place(el, R) {
  el.style.left = pct(R.c); el.style.top = pct(R.r);
  el.style.width = `calc(${pct(R.w)} - 4px)`; el.style.height = `calc(${pct(R.h)} - 4px)`;
}
function render() {
  showHintsUsed(s.solved ? 0 : s.hints);
  const h = s.hint, won = s.solved;
  const wrong = settings.mistakes && !won ? new Set(sortPatches(P, rects()).wrong.map((R) => `${R.r},${R.c},${R.w},${R.h}`)) : new Set();
  // Patches: rebuilt each time (a few dozen at most); the drag preview lives on its own.
  $("patches").querySelectorAll(".patch:not(.preview)").forEach((e) => e.remove());
  const frag = document.createDocumentFragment();
  for (const Q of s.patches) {
    const st = status(Q), el = document.createElement("div");
    const bad = st.kind === "err" || wrong.has(`${Q.r},${Q.c},${Q.w},${Q.h}`);
    el.className = `patch${bad ? " err" : st.kind === "part" ? " part" : ""}${Q === s.landed ? " land" : ""}`;
    el.style.setProperty("--pf", SHK_COLORS[Q.k % SHK_COLORS.length][0]);
    el.style.setProperty("--pc", SHK_COLORS[Q.k % SHK_COLORS.length][1]);
    el.style.setProperty("--d", `${(Q.r + Q.c) * 45}ms`);
    if (h?.data.kind === "mistake" && h.data.remove && same(h.data.remove, Q)) el.classList.add("ringed");
    place(el, Q);
    frag.appendChild(el);
  }
  $("patches").prepend(frag);
  // Hint: Nudge rings the number (or the wrong patch); Explain stripes its squares; Show me draws it.
  const ringAt = h && h.data.clue >= 0 && h.data.kind !== "mistake" ? P.clues[h.data.clue][0] * N + P.clues[h.data.clue][1] : -1;
  const stripe = new Set(h && h.level >= 2 && h.data.kind !== "mistake" ? h.data.focus.map(([r, c]) => r * N + c) : []);
  $("nums").querySelectorAll("span").forEach((el, x) => el.classList.toggle("ring", x === ringAt));
  $("cells").querySelectorAll("i").forEach((el, x) => el.classList.toggle("stripe", stripe.has(x)));
  const done = s.patches.filter((Q) => status(Q).kind === "ok").length;
  $("count").textContent = `${done} of ${P.clues.length} patches`;
  $("tip").textContent = won ? "" : s.msg?.text ?? TIP;
  $("tip").classList.toggle("bad", !won && s.msg?.bad === true);
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
// A drag: from an empty square it draws a new patch; from a patch it grows that patch (Colin 10/24: "always adds to
// the shape"). The preview follows the finger; one buzz per new shape.
let drag = null;
const cellAt = (x, y) => {
  const b = $("board").getBoundingClientRect();
  return [Math.max(0, Math.min(N - 1, Math.floor(((y - b.top) / b.height) * N))), Math.max(0, Math.min(N - 1, Math.floor(((x - b.left) / b.width) * N)))];
};
const span = (a, b) => ({ r: Math.min(a[0], b[0]), c: Math.min(a[1], b[1]), h: Math.abs(a[0] - b[0]) + 1, w: Math.abs(a[1] - b[1]) + 1 });
function shape(d) {
  const R = span(d.a, d.b);
  if (!d.base) return R;
  const B = d.base, r = Math.min(R.r, B.r), c = Math.min(R.c, B.c);
  return { r, c, h: Math.max(R.r + R.h, B.r + B.h) - r, w: Math.max(R.c + R.w, B.c + B.w) - c };
}
function showPreview(R) {
  let el = $("patches").querySelector(".preview");
  if (!el) { el = document.createElement("div"); el.className = "patch preview"; el.innerHTML = '<span class="size"></span>'; $("patches").appendChild(el); }
  place(el, R);
  el.querySelector(".size").textContent = area(R) === 1 ? "1" : `${R.h}×${R.w} = ${area(R)}`;
}
const dropPreview = () => $("patches").querySelector(".preview")?.remove();
$("board").addEventListener("pointerdown", (e) => {
  if (s.solved || s.pausedAt || second(e)) return;
  e.preventDefault();
  const a = cellAt(e.clientX, e.clientY);
  drag = { a, b: a, moved: false, base: s.patches.find((Q) => inside(Q, a[0], a[1])) ?? null };
  if (!drag.base) showPreview(shape(drag));
});
document.addEventListener("pointermove", (e) => {
  if (!drag || second(e)) return;
  const b = cellAt(e.clientX, e.clientY);
  if (b[0] === drag.b[0] && b[1] === drag.b[1]) return;
  const before = shape(drag);
  drag.b = b; drag.moved = true;
  const now = shape(drag);
  if (drag.base && same(now, drag.base)) return dropPreview(); // back inside the patch: nothing to show
  showPreview(now);
  if (!same(before, now)) hapticLevel(1);
});
document.addEventListener("pointerup", (e) => {
  if (!drag || second(e)) return;
  const d = drag;
  drag = null;
  dropPreview();
  finish(d);
});
document.addEventListener("pointercancel", () => { drag = null; dropPreview(); });

function finish(d) {
  const R = shape(d);
  if (!d.moved) {
    if (d.base) { // a tap on a patch takes it away
      undoStack.push(snap());
      s.patches = s.patches.filter((Q) => Q !== d.base);
      hapticLevel(1);
      return afterChange(null);
    }
    if (cluesIn(P, R).length !== 1 || num(cluesIn(P, R)[0]) !== 1) return; // a tap only draws on a 1
  }
  if (d.base && same(R, d.base)) return; // dragged within the patch: no change
  undoStack.push(snap());
  const rest = s.patches.filter((Q) => Q !== d.base && !overlaps(Q, R));
  const Q = { ...R, k: colorFor(R, d.base ? d.base.k : -1, rest) };
  s.patches = [...rest, Q];
  const st = status(Q);
  if (st.kind === "err") haptic("warn");
  else hapticLevel(2);
  afterChange(Q, st.why ? { text: st.why, bad: st.kind === "err" } : null);
}
function afterChange(landed, msg = null) {
  s.hint = null;
  s.landed = landed;
  s.msg = msg;
  checkSolved();
  render();
}

function checkSolved() {
  if (s.solved || !isSolved(P, rects())) return;
  s.solved = true;
  s.elapsed = Date.now() - s.started;
  s.msg = null;
  clearSaved("shikaku", packName, pid());
  saveFinal("shikaku", packName, pid(), { patches: s.patches.map((Q) => ({ ...Q })), done: true });
  haptic("success");
  // The picture moment: the patches dip and pop in a wave from the top-left, then fill in solid.
  const b = $("board");
  requestAnimationFrame(() => b.classList.add("wave"));
  setTimeout(() => b.classList.add("won"), 250);
  const hints = Math.round((s.hints ?? 0) * 100) / 100;
  const facts = solveFacts("shikaku", packName, s.elapsed, hints);
  logSolve({ g: "shikaku", pack: packName, p: pid(), ms: s.elapsed, hints });
  celebrate({ title: `${pack.difficulty} #${idx + 1}`, level: pack.difficulty, facts, hasNext: idx < pack.puzzles.length - 1,
    onNext: () => load(idx + 1), delay: 1600, medal: shikakuPicture(N, s.patches, 86) });
}

// ---- Hint: Nudge (rings the number) → Explain (stripes the squares, why) → Show me (draws it). A third each. ----
function openHint() {
  if (s.solved) return;
  if (s.hint) { s.hint = null; return render(); }
  s.hints += 1 / 3;
  s.msg = null;
  s.hint = { data: findHint(P, rects()), level: 1 };
  render();
}
function advanceHint() {
  const h = s.hint;
  if (!h) return;
  if (h.level === 3) { s.hint = null; checkSolved(); return render(); }
  h.level++;
  s.hints += 1 / 3;
  if (h.level === 3) {
    undoStack.push(snap());
    const d = h.data;
    if (d.remove) s.patches = s.patches.filter((Q) => !same(Q, d.remove));
    else if (d.rect) {
      // Same as the engine's applyHint; the patch keeps its colour when it grows from one already there.
      const was = s.patches.find((Q) => overlaps(Q, d.rect) && cluesIn(P, Q).includes(d.clue));
      const rest = s.patches.filter((Q) => !overlaps(Q, d.rect));
      const Q = { ...d.rect, k: colorFor(d.rect, was ? was.k : -1, rest) };
      s.patches = [...rest, Q];
      s.landed = Q;
      hapticLevel(2);
    }
  }
  render();
}

$("backBtn").onclick = goHome;
$("undoBtn").onclick = () => {
  if (!undoStack.length || s.solved) return;
  haptic("tap");
  restore(undoStack.pop());
  s.hint = null; s.msg = null; s.landed = null;
  render();
};
const openMore = moreMenu({ settingsNote: "Timer, show mistakes", onSettings: () => { s.settingsOpen = true; render(); },
  onRestart: () => { clearSaved("shikaku", packName, pid()); load(idx); } });
$("settingsBtn").onclick = () => { s.settingsOpen = true; render(); };
$("restartBtn").onclick = () => openMore("confirm");
$("hintBtn").onclick = () => { haptic("pick"); openHint(); };
$("hintClose").onclick = () => { s.hint = null; render(); };
$("hintNext").onclick = () => { haptic("pick"); advanceHint(); };
$("rulesBtn").onclick = () => { s.rules = true; render(); };
document.querySelectorAll("#rules [data-close]").forEach((b) => (b.onclick = () => { s.rules = false; render(); }));
document.querySelectorAll("#settings [data-close]").forEach((b) => (b.onclick = () => { s.settingsOpen = false; render(); }));
document.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => flipSetting(b.dataset.set)));
document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "z" && !s.pausedAt) $("undoBtn").onclick(); });

function pause() { if (s.solved || s.pausedAt) return; s.pausedAt = Date.now(); render(); }
function resume() { if (!s.pausedAt) return; s.started += Date.now() - s.pausedAt; s.pausedAt = null; render(); }
$("timer").onclick = pause;
$("resumeBtn").onclick = resume;
document.addEventListener("visibilitychange", () => document.hidden && pause());

function persist() {
  if (!s || s.solved || !s.patches.length) return;
  saveGame("shikaku", packName, { p: pid(), patches: s.patches, ms: (s.pausedAt ?? Date.now()) - s.started, hints: s.hints ?? 0 });
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
globalThis.sbShik = { load, state: () => s, puzzle: () => P }; // for the page test
smoothClose();
openWipe();
renderPicker();
load(idx, packName, true);
