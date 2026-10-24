// Shared by every SolveBuddy page: the phone-app bridge, the packs, and the solve log that Home, Packs and Stats read.
// In the app (window.SOLVEBUDDY_APP), opening a game and going back are the app's job; in a browser they're links.
export const inApp = !!globalThis.SOLVEBUDDY_APP;
export const post = (msg) => globalThis.ReactNativeWebView?.postMessage(JSON.stringify(msg));

// Games the phone app doesn't know as pages yet ride inside one it does (the app opens only the game pages built into
// it, App.js GAMES). The app's offline starbattle page carries Nonogram too and switches on ?game=nonogram
// (scripts/build_site.ts). Once the app lists "nonogram" itself, drop it from here.
export const HOSTED = { nonogram: "starbattle" };
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
  return { g, pack, p, saved, state: saved ? "progress" : times.length ? "solved" : "new", ms: times.length ? Math.min(...times) : 0 };
}
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
// "warn" = a soft no (a move that isn't allowed; an app that doesn't know it yet plays it as a light tap).
// A fast drag can ask for a buzz every few ms: light ones (tap, pick) closer than HAPTIC_GAP ms to the last buzz are
// dropped (Colin 10/24: ~every 40ms at most). Firmer ones always play. Checks set SB_HAPTIC_GAP = 0 to count each one.
const HAPTIC_GAP = 40;
let lastBuzz = -Infinity;
export function haptic(kind = "tap") {
  const now = performance.now(), light = kind === "tap" || kind === "pick";
  if (light && now - lastBuzz < (globalThis.SB_HAPTIC_GAP ?? HAPTIC_GAP)) return;
  lastBuzz = now;
  if (inApp) post({ type: "haptic", kind });
  else navigator.vibrate?.(kind === "success" ? [20, 60, 30] : kind === "thud" ? 30 : kind === "warn" ? [8, 50, 8] : 10);
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
  try {
    const all = JSON.parse(localStorage.getItem(FINALS_KEY) || "{}");
    localStorage.setItem(FINALS_KEY, JSON.stringify({ ...all, [`${game}/${pack}/${p}`]: data }));
  } catch {}
}
export function solves() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; }
}
export function logSolve(entry) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify([...solves(), { ...entry, at: Date.now() }])); } catch {}
}
// Every game left half-done, each puzzle its own (Colin, 10/21: starting another must never lose the first).
// "sudoku/easy/3" → { p, ms, hints, ...the game's own marks }. Older saves were one per pack ("sudoku/easy"); they
// move to their puzzle's key on read.
const SAVE_KEY = "solvebuddy.saved";
function allSaved() {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); } catch {}
  for (const [k, v] of Object.entries(all)) if (k.split("/").length === 2 && v?.p) { all[`${k}/${v.p}`] ??= v; delete all[k]; }
  return all;
}
export const savedGame = (game, pack, p) => allSaved()[`${game}/${pack}/${p}`] ?? null;
export function saveGame(game, pack, data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...allSaved(), [`${game}/${pack}/${data.p}`]: { ...data, at: Date.now() } })); } catch {}
}
export function clearSaved(game, pack, p) {
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
// The quiet line just above the Hint button, hidden until the first hint. It floats over the gap above the bottom
// bar, so it adds no height (a zoomable board's area makes room for it, common.css). Games call it from render().
export function showHintsUsed(h) {
  const dock = document.querySelector(".dock");
  if (!dock) return;
  let el = document.getElementById("hintsUsed");
  if (!el) {
    el = document.createElement("p");
    el.id = "hintsUsed";
    el.className = "hints-used";
    el.setAttribute("aria-live", "polite");
    dock.prepend(el);
  }
  const text = hintsUsedText(h);
  if (el.textContent !== text) el.textContent = text;
  if (el.hidden !== !text) {
    el.hidden = !text;
    dispatchEvent(new Event("resize")); // a zoomable board re-measures its area (web/zoom.js)
  }
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
