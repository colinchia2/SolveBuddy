// Shared by every SolveBuddy page: the phone-app bridge, the packs, and the solve log that Home, Packs and Stats read.
// In the app (window.SOLVEBUDDY_APP), opening a game and going back are the app's job; in a browser they're links.
import "./sync.js"; // iCloud sync (11/1): merges what the other device saved before any page reads its storage
export const inApp = !!globalThis.SOLVEBUDDY_APP;
// iPad (Colin 10/27, F1; pictures: https://claude.ai/artifact/EM1URxLzDX5jmYEExmw5h4). The app lays pages out at the
// iPad's real width and sets SOLVEBUDDY_APP.tablet (each page's head script adds html.tablet + land/port). Here: keep
// land/port right as it turns, and the sizes common.css uses: --pz = the phone layout scaled to fit (pages without
// their own iPad layout), --bz = how much a split page's board grows, --bw = its width. iPhone never gets html.tablet.
export const isTablet = !!globalThis.document?.documentElement.classList.contains("tablet"); // (the checks load this file outside a browser)
// 11/1 (Colin's iPad screenshots): on iPad, Apple draws the tab bar at the TOP (under the clock), not the bottom, so on
// the four tab pages the face and title sat under it. There: the top room = the clock + the bar (TOP_BAR, in iPad
// points), the bottom keeps only the home-bar room. --safetop is used inside the scaled phone layout, so it's divided
// by --pz to land at the same spot on screen. Game pages (no tab bar, --tabbar 0) are unchanged.
const TOP_BAR = 44; // the bar ends 40 below the clock's safe area (Colin's screenshot); the header's own 12 adds air
let safeTop0 = null, tabbed = false;
function sizeTablet() {
  const root = document.documentElement, W = innerWidth, H = innerHeight, land = W > H;
  root.classList.toggle("land", land);
  root.classList.toggle("port", !land);
  if (safeTop0 === null) {
    const css = getComputedStyle(root);
    safeTop0 = parseFloat(css.getPropertyValue("--safetop")) || 0;
    tabbed = inApp && (parseFloat(css.getPropertyValue("--tabbar")) || 0) > 0;
    if (tabbed) { root.classList.add("topbar"); root.style.setProperty("--tabbar", "24px"); }
  }
  const top = safeTop0 + (tabbed ? TOP_BAR : 0);
  const pz = Math.min(W / 390, (H - top) / 844);
  root.style.setProperty("--pz", String(pz));
  if (tabbed) root.style.setProperty("--safetop", `${Math.round(top / pz)}px`);
  const phone = document.querySelector('.phone[data-tablet="split"]');
  if (!phone) return;
  const base = parseFloat(phone.style.getPropertyValue("--base")) || 355;
  // Sideways: the board fills the left column under the title (picture: 690 on an 11" iPad). Upright: the width.
  const side = land ? Math.min(H - top - 32 - 56 - 24 - 32, W - 64 - 48 - 400) : Math.min(W - 64, (H - top) * 0.62);
  const bz = Math.max(1, side / base);
  root.style.setProperty("--bz", String(bz));
  root.style.setProperty("--bw", `${Math.round(base * bz)}px`);
}
if (isTablet) {
  sizeTablet();
  addEventListener("resize", sizeTablet);
  addEventListener("DOMContentLoaded", sizeTablet);
}
export const post = (msg) => globalThis.ReactNativeWebView?.postMessage(JSON.stringify(msg));

// Games the phone app doesn't know as pages yet ride inside one it does (the app opens only the game pages built into
// it, App.js GAMES). The app's offline starbattle page carries Nonogram too and switches on ?game=nonogram
// (scripts/build_site.ts); Shikaku rides in it the same way (?game=shikaku, Colin 10/24). Once the app lists them
// itself, drop them from here.
export const HOSTED = { nonogram: "starbattle", shikaku: "starbattle", fiveletters: "starbattle", groups: "starbattle" };
export function openGame(game, query) {
  if (inApp && HOSTED[game]) post({ type: "open", page: HOSTED[game], query: `?game=${game}${query ? `&${query.replace(/^\?/, "")}` : ""}` });
  else if (inApp) post({ type: "open", page: game, query });
  else location.href = `${game}.html${query}`;
}
// Which game this page is: ?game= (a hosted game in the app), else the page's own name.
export const pageGame = () => new URLSearchParams(location.search).get("game") ?? location.pathname.match(/(\w+)\.html$/)?.[1];
// Leaving a game saves it first: every game page saves on "pagehide", so send one before going.
export function goHome() {
  dispatchEvent(new Event("pagehide"));
  if (inApp) post({ type: "close", left: whereLeft() });
  else location.href = "home.html";
}
// The puzzle you're leaving and how you left it. Home shows this tile from it straight away, because the save itself
// can reach Home's copy of storage a moment later (Colin 10/22: a tile must never show the wrong state).
function whereLeft() {
  const g = pageGame();
  const q = new URLSearchParams(location.search), pack = q.get("pack"), p = Number(q.get("p"));
  if (!g || !pack || !p) return null;
  const saved = savedGame(g, pack, p);
  const times = solves().filter((e) => e.g === g && e.pack === pack && e.p === p).map((e) => e.ms);
  return { g, pack, p, saved, state: saved ? "progress" : times.length ? "solved" : "new", ms: times.length ? Math.min(...times) : 0, openSolve: askedSolve };
}
let askedSolve = 0; // "See your hints": the solve to open, handed over with the close (see openSolve)
// The Packs tab opens a pack on Library's pack page (calmer screens, Colin 10/23). In the app the tabs are separate
// pages sharing storage: leave a note for Library (read when it comes on screen), then switch tabs. No app change.
export const OPEN_PACK_KEY = "solvebuddy.openPack";
export function openPack(g, set) {
  if (!inApp) return void (location.href = `home.html?g=${g}&set=${set}`);
  try { localStorage.setItem(OPEN_PACK_KEY, JSON.stringify({ g, set, at: Date.now() })); } catch {}
  post({ type: "tab", name: "Library" });
}
globalThis.sbLeave = goHome; // the app's glass back button calls this
// Haptics (Colin, 10/21): "tap" = light, "pick" = the selection tick, "thud" = medium, "success" = solving a puzzle,
// "warn" = a soft no (a move that isn't allowed).
// A fast drag can ask for a buzz every few ms: light ones (tap, pick) closer than HAPTIC_GAP ms to the last buzz are
// dropped (Colin 10/24: ~every 40ms at most). Firmer ones always play. Checks set SB_HAPTIC_GAP = 0 to count each one.
// Five strengths (Colin 10/24; App.js unchanged: it plays "pick" as the selection tick, "thud" as a medium impact,
// "success" as the success notification):
//   L1 = two ticks 70ms apart · L2 = a medium thud · L3 = a thud, then a tick 70ms later · L4 = a thud, then another
//   thud 70ms later · L5 = success. (Colin 10/24, twice: "too light", so every level moved up one step; success is the
//   top until the app maps something stronger.)
// The kinds above map onto them: tap and pick = L1, thud = L2, success = L5; warn = a thud, then a tick 140ms later
// (slower than L3's 70ms, so it stays distinct).
// Games that want a stronger scale (Star Battle, Nonogram) call hapticLevel(n). The message keeps what was meant in
// "as"; a second buzz is marked "again". A second buzz is skipped when a newer one has gone out meanwhile, so a fast
// drag stays clean while each new square still gets its own first buzz.
const HAPTIC_GAP = 40;
const LEVELS = { 1: ["pick", "pick"], 2: ["thud"], 3: ["thud", "pick"], 4: ["thud", "thud"], 5: ["success"] };
const VIBRATE = { 1: [10, 60, 10], 2: 30, 3: [30, 40, 10], 4: [30, 40, 30], 5: [20, 60, 30] };
const KIND_LEVEL = { tap: 1, pick: 1, thud: 2, success: 5 };
let lastBuzz = -Infinity, buzzSeq = 0;
function buzzOut(first, second, gapMs, as, light, vib) {
  const now = performance.now();
  if (light && now - lastBuzz < (globalThis.SB_HAPTIC_GAP ?? HAPTIC_GAP)) return;
  lastBuzz = now;
  const seq = ++buzzSeq;
  if (!inApp) return void navigator.vibrate?.(vib);
  post({ type: "haptic", kind: first, as });
  if (second) setTimeout(() => { if (seq === buzzSeq) post({ type: "haptic", kind: second, as, again: true }); }, gapMs);
}
// L1 and L2 keep the 40ms throttle (they're what a drag paints); firmer ones always play.
const level = (n, as, light) => { const [a, b] = LEVELS[n] ?? LEVELS[1]; buzzOut(a, b, 70, as, light, VIBRATE[n] ?? 10); };
export const hapticLevel = (n, as = `L${n}`) => level(n, as, n <= 2);
export function haptic(kind = "tap") {
  if (kind === "warn") return buzzOut("thud", "pick", 140, kind, false, [30, 110, 10]);
  level(KIND_LEVEL[kind] ?? 1, kind, kind === "tap" || kind === "pick"); // as before 10/24: only tap and pick are throttled
}
export const buzz = (ms = 10) => haptic(ms >= 30 ? "thud" : "tap");

// The phone app's offline pages carry the packs inside them (SB_PACKS); otherwise fetch them.
export const loadPack = async (f) => globalThis.SB_PACKS?.[f] ?? (await fetch(`../packs/${f}`)).json();

// Every pack file on the phone, per game: [key in the game page's ?pack=, file, level label].
// sets = the named packs you pick from (Colin, 10/21): each holds one or more levels (pack keys above), e.g. a future
// Halloween pack = { name: "Halloween", levels: ["halloween-easy", "halloween-hard"] }. note = a section name that
// isn't a level (Trick tests: "One per trick").
export const GAMES = {
  sudoku: { name: "Sudoku", packs: [
    ["easy", "sudoku9-easy-starter.json", "Easy"], ["medium", "sudoku9-medium.json", "Medium"],
    ["hard", "sudoku9-hard.json", "Hard"], ["expert", "sudoku9-expert.json", "Expert"],
    ["tricks", "sudoku9-tricks.json", "Trick tests"],
    ["killer", "sudoku9-killer-easy.json", "Easy"], ["thermo", "sudoku9-thermo-easy.json", "Easy"], // variants (Colin, 10/22)
    ["killer-expert", "sudoku9-killer-expert.json", "Expert"], ["thermo-expert", "sudoku9-thermo-expert.json", "Expert"]],
    sets: [{ name: "Starter", levels: ["easy", "medium", "hard", "expert"] }, { name: "Trick tests", levels: ["tricks"], note: "One per trick" },
      { name: "Killer", levels: ["killer", "killer-expert"] }, { name: "Thermo", levels: ["thermo", "thermo-expert"] }] },
  starbattle: { name: "Star Battle", packs: [
    ["easy", "starbattle8-easy-starter.json", "Easy"], ["expert", "starbattle8-expert.json", "Expert"],
    ["double", "starbattle10-double-expert.json", "Expert"], ["triple", "starbattle12-triple-expert.json", "Hard"]],
    // Single = one star per row on 8×8; Double = two per row on 10×10 (Colin, 10/22).
    sets: [{ name: "Starter – Single", levels: ["easy", "expert"] }, { name: "Starter – Double", levels: ["double"], note: "Expert" },
      { name: "Starter – Triple", levels: ["triple"], note: "Hard" }] }, // 12×12, 3 stars (Colin, 10/22)
  // Water Sort (Colin, 10/22): pour the colours until every tube holds one colour.
  watersort: { name: "Water Sort", packs: [
    ["easy", "watersort-easy.json", "Easy"], ["medium", "watersort-medium.json", "Medium"], ["hard", "watersort-hard.json", "Hard"]],
    sets: [{ name: "Starter", levels: ["easy", "medium", "hard"] }] },
  // Nonogram (Colin 10/23): size is the level; every puzzle is a picture. 15×15 zooms.
  nonogram: { name: "Nonogram", packs: [
    ["easy", "nonogram5-easy.json", "Easy"], ["medium", "nonogram10-medium.json", "Medium"], ["hard", "nonogram15-hard.json", "Hard"]],
    sets: [{ name: "5×5", levels: ["easy"] }, { name: "10×10", levels: ["medium"] }, { name: "15×15", levels: ["hard"] }] },
  // Shikaku (Colin 10/24): size is the level, 10 each.
  shikaku: { name: "Shikaku", packs: [
    ["easy", "shikaku8-easy.json", "Easy"], ["medium", "shikaku10-medium.json", "Medium"], ["hard", "shikaku12-hard.json", "Hard"]],
    // (The Patches 8×8 pack was taken out 10/27: Colin doesn't want LinkedIn's look as a pack. Shape clues stay for imports.)
    sets: [{ name: "8×8", levels: ["easy"] }, { name: "10×10", levels: ["medium"] }, { name: "12×12", levels: ["hard"] }] },
};
// Block Drop (Colin, 10/22) is endless, with no packs: its tile opens the game, and it keeps its own best scores.
export const BLOCKS_KEY = "solvebuddy.blocks";
export function blockScores() {
  try { return JSON.parse(localStorage.getItem(BLOCKS_KEY) || "{}"); } catch { return {}; }
}

// Solve log: one entry per finished puzzle. Stored in this browser / on this phone only.
const LOG_KEY = "solvebuddy.solves";
// Your finished board for "View solved puzzle" (Colin 10/22: show the board as you left it, × marks too).
// "starbattle/easy/3" → { marks }. The newest solve wins.
const FINALS_KEY = "solvebuddy.finals";
export function finalBoard(game, pack, p) {
  try { return JSON.parse(localStorage.getItem(FINALS_KEY) || "{}")[`${game}/${pack}/${p}`] ?? null; } catch { return null; }
}
export function saveFinal(game, pack, p, data) {
  if (REPLAY) return;
  try {
    const all = JSON.parse(localStorage.getItem(FINALS_KEY) || "{}");
    localStorage.setItem(FINALS_KEY, JSON.stringify({ ...all, [`${game}/${pack}/${p}`]: data }));
  } catch {}
}
// Start fresh (Colin 11/2, done once; how-to in docs/START_FRESH.md): solves from before FRESH_AT stay stored and
// synced but are hidden everywhere (solved ticks, finished boards, Stats) except the weekly streak, which reads
// allSolves(). Half-done games from before it are dropped. Block Drop, settings and imports are untouched.
export const FRESH_AT = globalThis.SB_FRESH_AT ?? 1793655720685; // 2026-11-02 (the checks set SB_FRESH_AT)
export function allSolves() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; }
}
export const solves = () => allSolves().filter((e) => (e?.at ?? 0) >= FRESH_AT);
// Hint detail for Stats (Colin 11/1): s.hd = { steps: [asked, reached Explain, reached Show me], tricks: { name: times } }.
// It rides along in the saved game and the solve log; s.hints (the thirds count) stays the one the screens show.
// Hint history (Colin 11/1): d.log = each hint in order, { t: ms into the puzzle, k: its trick, n: how far it went
// (1 Nudge, 2 Explain, 3 Show me) }. Every game times a puzzle as (pausedAt ?? now) - started.
export function hintStep(s, step, trick) {
  const d = (s.hd ??= { steps: [0, 0, 0], tricks: {} });
  d.steps[step - 1]++;
  if (trick) d.tricks[trick] = (d.tricks[trick] ?? 0) + 1;
  const log = (d.log ??= []), t = Math.max(0, Math.round((s.pausedAt ?? Date.now()) - (s.started ?? Date.now())));
  if (step === 1 || !log.length) {
    const h = { t, k: trick || "", n: step };
    if (frameOf) { h.r = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; keepFrame(h.r); }
    log.push(h);
  } else log.at(-1).n = Math.max(log.at(-1).n, step);
}
// Hint replay (Colin 11/1, mockup https://claude.ai/artifact/XLb4R3AJPcqALtAwC2obDP): each hint also keeps a "frame",
// the board and the hint card the moment you asked, so Stats can open the game as it was. Frames stay on this device
// (a board per hint is too much for iCloud), the newest MAX_FRAMES. A game says how to take one with replaySource().
// The frame is taken a moment later, because some games set s.hint just after hintStep.
export const REPLAY_KEY = "solvebuddy.replays";
const MAX_FRAMES = 400;
let frameOf = null;
export const replaySource = (fn) => { frameOf = fn; };
export function frames() { try { return JSON.parse(localStorage.getItem(REPLAY_KEY) || "{}"); } catch { return {}; } }
function keepFrame(id) {
  Promise.resolve().then(() => {
    let f; try { f = JSON.parse(JSON.stringify(frameOf())); } catch { return; }
    const all = frames(); all[id] = { ...f, at: Date.now() };
    const ids = Object.keys(all);
    if (ids.length > MAX_FRAMES) ids.sort((a, b) => all[a].at - all[b].at).slice(0, ids.length - MAX_FRAMES).forEach((k) => delete all[k]);
    try { localStorage.setItem(REPLAY_KEY, JSON.stringify(all)); } catch {}
  });
}
// A game page opened as a replay (?replay=<the solve's time>&i=<which hint>) never saves anything.
const RQ = new URLSearchParams(globalThis.location?.search ?? "");
export const REPLAY = RQ.has("replay") ? { at: Number(RQ.get("replay")), i: Number(RQ.get("i") || 0) } : null;
if (REPLAY) globalThis.document?.documentElement.classList.add("replaying");
// "See your hints" on the Solved card: Stats opens that puzzle's hints. A game page can't switch tabs in the app
// (Colin 11/1: the button did nothing), so it closes and hands the solve over with the close ("left"); the tab page it
// lands on passes it on as a note and switches to Stats (hopToStats), and Stats opens the puzzle. Not through storage
// alone: each page's copy of storage catches up a moment late (Colin 11/2: it landed on Library and stayed there), so
// each step also keeps looking for a couple of seconds.
export const OPEN_SOLVE_KEY = "solvebuddy.openSolve";
export function openSolve(at) {
  try { localStorage.setItem(OPEN_SOLVE_KEY, JSON.stringify({ at, when: Date.now() })); } catch {}
  askedSolve = at;
  if (inApp) goHome();
  else location.href = "stats.html";
}
export function hopToStats(left) {
  if (!inApp) return false;
  if (left?.openSolve) {
    try { localStorage.setItem(OPEN_SOLVE_KEY, JSON.stringify({ at: left.openSolve, when: Date.now() })); } catch {}
    post({ type: "tab", name: "Stats" });
    return true;
  }
  let n = null;
  try { n = JSON.parse(localStorage.getItem(OPEN_SOLVE_KEY) || "null"); } catch {}
  if (!n?.at || Date.now() - n.when > 60000) return false;
  post({ type: "tab", name: "Stats" });
  return true;
}
export function logSolve(entry) {
  if (REPLAY) return;
  try { localStorage.setItem(LOG_KEY, JSON.stringify([...allSolves(), { ...entry, at: Date.now() }])); } catch {}
}
// Every game left half-done, each puzzle its own (Colin, 10/21: starting another must never lose the first).
// "sudoku/easy/3" → { p, ms, hints, ...the game's own marks }. Older saves were one per pack ("sudoku/easy"); they
// move to their puzzle's key on read.
const SAVE_KEY = "solvebuddy.saved";
function allSaved() {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); } catch {}
  for (const [k, v] of Object.entries(all)) if (k.split("/").length === 2 && v?.p) { all[`${k}/${v.p}`] ??= v; delete all[k]; }
  for (const [k, v] of Object.entries(all)) if ((v?.at ?? 0) < FRESH_AT) delete all[k]; // started before Start fresh
  return all;
}
export const savedGame = (game, pack, p) => allSaved()[`${game}/${pack}/${p}`] ?? null;
export function saveGame(game, pack, data) {
  if (REPLAY) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...allSaved(), [`${game}/${pack}/${data.p}`]: { ...data, at: Date.now() } })); } catch {}
}
export function clearSaved(game, pack, p) {
  if (REPLAY) return;
  const all = allSaved();
  delete all[`${game}/${pack}/${p}`];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(all)); } catch {}
}

// The hint card sits over the bottom of the page and never covers the board (Colin, 10/21): it's capped at the room
// below the board, and its text scrolls inside it on a short phone.
export function fitHint(card, board) {
  if (card.hidden) return;
  const room = card.offsetParent.getBoundingClientRect().bottom - board.getBoundingClientRect().bottom - 16 - 12;
  card.style.maxHeight = room >= 150 ? `${room}px` : "";
}

// Hints count in thirds: each hint step (Nudge, Explain, Show me) is ⅓ (Colin, 10/22). One wording everywhere, so the
// line over the Hint button and the Solved card always agree (Colin, 10/23): "⅓ of a hint", "1 hint", "1⅔ hints".
export const hintThirds = (h) => Math.max(0, Math.round((h ?? 0) * 3));
export function hintAmount(h) {
  const t = hintThirds(h), whole = Math.floor(t / 3), part = ["", "⅓", "⅔"][t % 3];
  if (t === 0) return "0 hints";
  if (whole === 0) return `${part} of a hint`;
  return `${whole}${part} hint${t === 3 ? "" : "s"}`;
}
export const hintsUsedText = (h) => (hintThirds(h) ? `You've used ${hintAmount(h)}` : "");
// Just the number, for the tag on the Hint button: "⅓", "1", "1⅔".
export const hintShort = (h) => { const t = hintThirds(h), whole = Math.floor(t / 3); return `${whole || ""}${["", "⅓", "⅔"][t % 3]}` || "0"; };
// A small number on the Hint button's corner, hidden until the first hint (Colin 10/27, S13: the old line sat too
// close to the button). Tapping it opens "Hints used"; the list of each hint comes later with the puzzle review.
// The full sentence rides along in data-full and the label. Games call it from render().
export function showHintsUsed(h) {
  const dock = document.querySelector(".dock");
  if (!dock) return;
  let el = document.getElementById("hintsUsed");
  if (!el) {
    el = document.createElement("button");
    el.id = "hintsUsed";
    el.className = "hints-badge";
    el.onclick = () => hintsSheet(el.dataset.full);
    dock.appendChild(el);
  }
  const text = hintsUsedText(h);
  if (el.dataset.full !== text) {
    el.dataset.full = text;
    el.textContent = hintShort(h);
    el.setAttribute("aria-label", `${text}. Show hints used`);
  }
  el.hidden = !text;
}
function hintsSheet(text) {
  let el = document.getElementById("hintsSheet");
  if (!el) {
    el = document.createElement("div");
    el.className = "scrim";
    el.id = "hintsSheet";
    el.innerHTML = `<section class="sheet" role="dialog" aria-label="Hints used">
      <h2>Hints used</h2><p data-text></p>
      <p>Each step of a hint counts a third: Nudge, Explain, Show me.</p>
      <p class="soon">Coming later: see each hint again, right where you used it.</p>
      <button class="dark" data-close>Done</button></section>`;
    el.onclick = (e) => { if (e.target === el || e.target.closest("[data-close]")) el.hidden = true; };
    document.querySelector(".phone").appendChild(el);
  }
  el.querySelector("[data-text]").textContent = `${text} on this puzzle.`;
  el.hidden = false;
}

// The More menu behind the bottom bar's ⋯ (Colin, 10/21): Game settings, and Restart, which asks before clearing.
const GEAR = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3 M12 19v3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M2 12h3 M19 12h3 M4.9 19.1L7 17 M17 7l2.1-2.1"/></svg>`;
const RESTART = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B3261E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7 M3 4v5h5"/></svg>`;
export function moreMenu({ settingsNote, onSettings, onRestart }) {
  const el = document.createElement("div");
  el.className = "scrim";
  el.hidden = true;
  el.innerHTML = `<section class="sheet" role="dialog" aria-label="More">
    <div data-view="list" class="card">
      <button class="menu-row" data-act="settings">${GEAR}<span><b>Game settings</b><small>${settingsNote}</small></span></button>
      <button class="menu-row danger" data-act="restart">${RESTART}<span><b>Restart puzzle</b><small>Asks before clearing</small></span></button>
    </div>
    <button class="dark" data-view="list" data-act="close">Done</button>
    <h2 data-view="confirm">Start over?</h2>
    <p data-view="confirm">Your marks and time on this puzzle will be cleared.</p>
    <div class="two" data-view="confirm"><button class="ghost" data-act="close">Keep playing</button><button class="danger-btn" data-act="yes">Start over</button></div>
  </section>`;
  document.querySelector(".phone").appendChild(el);
  const view = (v) => el.querySelectorAll("[data-view]").forEach((n) => (n.hidden = n.dataset.view !== v));
  const close = () => (el.hidden = true);
  el.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (e.target === el || act === "close") close();
    else if (act === "settings") { close(); onSettings(); }
    else if (act === "restart") view("confirm");
    else if (act === "yes") { close(); onRestart(); }
  };
  return (v = "list") => { view(v); el.hidden = false; };
}

// The "TasteBuddy slide" on the way out (Colin, 10/21): pages just set `hidden` on a pop-up; this catches that, plays
// the closing animation (CSS .closing), then really hides it.
export function smoothClose() {
  const SEL = ".scrim, .hint";
  const settle = new WeakSet();
  new MutationObserver((list) => {
    for (const { target: el, oldValue } of list) {
      if (settle.has(el)) { settle.delete(el); continue; }
      if (!el.matches?.(SEL) || !el.hidden || oldValue !== null || el.classList.contains("closing")) continue;
      el.hidden = false;
      el.classList.add("closing");
      setTimeout(() => {
        el.classList.remove("closing");
        settle.add(el);
        el.hidden = true;
      }, 230);
    }
  }).observe(document.body, { attributes: true, attributeFilter: ["hidden"], attributeOldValue: true, subtree: true });
}

// Puzzle numbers (1-based) already solved in one pack.
export const solvedIn = (game, pack) => new Set(solves().filter((e) => e.g === game && e.pack === pack).map((e) => e.p));
