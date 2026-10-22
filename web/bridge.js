// Shared by every SolveBuddy page: the phone-app bridge, the packs, and the solve log that Home, Packs and Stats read.
// In the app (window.SOLVEBUDDY_APP), opening a game and going back are the app's job; in a browser they're links.
export const inApp = !!globalThis.SOLVEBUDDY_APP;
export const post = (msg) => globalThis.ReactNativeWebView?.postMessage(JSON.stringify(msg));

export function openGame(game, query) {
  if (inApp) post({ type: "open", page: game, query });
  else location.href = `${game}.html${query}`;
}
export function goHome() {
  if (inApp) post({ type: "close" });
  else location.href = "home.html";
}
// Haptics (Colin, 10/21): "tap" = light, "pick" = the selection tick, "thud" = medium, "success" = solving a puzzle.
export function haptic(kind = "tap") {
  if (inApp) post({ type: "haptic", kind });
  else navigator.vibrate?.(kind === "success" ? [20, 60, 30] : kind === "thud" ? 30 : 10);
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
    ["tricks", "sudoku9-tricks.json", "Trick tests"]],
    sets: [{ name: "Starter", levels: ["easy", "medium", "hard", "expert"] }, { name: "Trick tests", levels: ["tricks"], note: "One per trick" }] },
  starbattle: { name: "Star Battle", packs: [
    ["easy", "starbattle8-easy-starter.json", "Easy"], ["expert", "starbattle8-expert.json", "Expert"],
    ["double", "starbattle10-double-expert.json", "Expert"]],
    // Single = one star per row on 8×8; Double = two per row on 10×10 (Colin, 10/22).
    sets: [{ name: "Starter – Single", levels: ["easy", "expert"] }, { name: "Starter – Double", levels: ["double"], note: "Expert" }] },
};

// Solve log: one entry per finished puzzle. Stored in this browser / on this phone only.
const LOG_KEY = "solvebuddy.solves";
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
