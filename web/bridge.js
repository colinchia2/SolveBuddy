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
export const buzz = (ms = 10) => navigator.vibrate?.(ms);

// The phone app's offline pages carry the packs inside them (SB_PACKS); otherwise fetch them.
export const loadPack = async (f) => globalThis.SB_PACKS?.[f] ?? (await fetch(`../packs/${f}`)).json();

// Every pack on the phone, per game: [key in the game page's ?pack=, file, label].
export const GAMES = {
  sudoku: { name: "Sudoku", packs: [
    ["easy", "sudoku9-easy-starter.json", "Easy"], ["medium", "sudoku9-medium.json", "Medium"],
    ["hard", "sudoku9-hard.json", "Hard"], ["expert", "sudoku9-expert.json", "Expert"],
    ["tricks", "sudoku9-tricks.json", "Trick tests"]] },
  starbattle: { name: "Star Battle", packs: [
    ["easy", "starbattle8-easy-starter.json", "Easy"], ["expert", "starbattle8-expert.json", "Expert"]] },
};

// Solve log: one entry per finished puzzle. Stored in this browser / on this phone only.
const LOG_KEY = "solvebuddy.solves";
export function solves() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; }
}
export function logSolve(entry) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify([...solves(), { ...entry, at: Date.now() }])); } catch {}
}
// A game left half-done, one per pack (Colin, 10/21: backing out by accident mustn't lose it).
// "sudoku/easy" → { p, ms, hints, ...the game's own marks }.
const SAVE_KEY = "solvebuddy.saved";
const allSaved = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); } catch { return {}; } };
export const savedGame = (game, pack) => allSaved()[`${game}/${pack}`] ?? null;
export function saveGame(game, pack, data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...allSaved(), [`${game}/${pack}`]: { ...data, at: Date.now() } })); } catch {}
}
export function clearSaved(game, pack) {
  const all = allSaved();
  delete all[`${game}/${pack}`];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(all)); } catch {}
}

// The hint card sits over the bottom of the page and never covers the board (Colin, 10/21): it's capped at the room
// below the board, and its text scrolls inside it on a short phone.
export function fitHint(card, board) {
  if (card.hidden) return;
  const room = card.offsetParent.getBoundingClientRect().bottom - board.getBoundingClientRect().bottom - 16 - 12;
  card.style.maxHeight = room >= 150 ? `${room}px` : "";
}

// Puzzle numbers (1-based) already solved in one pack.
export const solvedIn = (game, pack) => new Set(solves().filter((e) => e.g === game && e.pack === pack).map((e) => e.p));
