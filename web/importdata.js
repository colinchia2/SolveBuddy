// Imported puzzles (Colin, 10/22): the ones you build by hand on this phone, plus the ones Claude adds from your
// screenshots (packs/imports.json, until the app reads photos itself). Plain logic, no page, so the checks can test it.
//
// One import (all: id, game, name, addedAt (ms or an ISO date), source: "hand" | "claude"):
//   Star Battle: { game: "starbattle", size, stars, regions: ["AABB…", …], marks: { "r,c": 1 (×) | 2 (★) },
//     solution: [[cols of row 0's stars], …] }
//   Sudoku: { game: "sudoku", size: 9, givens: 9×9 numbers (0 = empty), entries: { "r,c": n } (numbers you'd filled in),
//     solution: 9×9 } — Classic rules only for now; variant rules (a rules photo) come later.
//   Water Sort: { game: "watersort", tubes: [["A","B",…] bottom → top, …] as they are now, colors: n }

export const IMPORTS_KEY = "solvebuddy.imports";
export const LETTERS = "ABCDEFGHIJKL";
// Region colours: the game's ten (layout A–J) plus two more for 11×11 and 12×12 boards.
export const REGION_COLORS = ["#D8C3EA", "#FFD08A", "#A6D8D0", "#C6E2A6", "#F5C2C9", "#FFB48A", "#BFD3F2", "#E9D9B8", "#E2EA98", "#D3D0C8", "#F2C6E8", "#BDE6F0"];
export const MIN_SIZE = 5, MAX_SIZE = 12;

// Most stars per row a board can hold in practice: 1 up to 7×7, 2 on 8×8 and 9×9, 3 from 10×10.
export const maxStars = (size) => (size >= 10 ? 3 : size >= 8 ? 2 : 1);

// Water Sort: 4 to 18 tubes (3 rows of 6 at most), 4 units each, the game's 12 colours.
export const MIN_TUBES = 4, MAX_TUBES = 18, TUBE_CAP = 4;
export const WATER_COLORS = { A: "#E8574F", B: "#3E86E8", C: "#F4C542", D: "#4CB86A", E: "#9B6BD6", F: "#F28C38",
  G: "#EE7BB0", H: "#2BB3B1", I: "#9C6B4E", J: "#A8D45A", K: "#2F4A8A", L: "#9AA3AD" };
export const WATER_NAMES = { A: "red", B: "blue", C: "yellow", D: "green", E: "purple", F: "orange", G: "pink", H: "teal", I: "brown",
  J: "lime", K: "navy", L: "grey" };

export function handImports() {
  try {
    const all = JSON.parse(localStorage.getItem(IMPORTS_KEY) || "[]");
    return Array.isArray(all) ? all : [];
  } catch { return []; }
}
export function saveHandImports(list) {
  try { localStorage.setItem(IMPORTS_KEY, JSON.stringify(list)); } catch {}
}
export const addImport = (item) => saveHandImports([...handImports().filter((x) => x.id !== item.id), item]);
export const deleteImport = (id) => saveHandImports(handImports().filter((x) => x.id !== id));

// Everything to list: Claude's (bundled) and yours, newest first; a broken item is left out rather than breaking the page.
export function allImports(bundled = [], mine = handImports()) {
  const seen = new Set();
  return [...mine, ...bundled.map((x) => ({ ...x, source: x.source ?? "claude" }))]
    .filter((x) => validImport(x) && !seen.has(x.id) && seen.add(x.id))
    .map((x) => ({ ...x, at: toMs(x.addedAt) }));
}
export const toMs = (t) => (typeof t === "number" ? t : Date.parse(t) || 0);

export function validImport(x) {
  if (!x || typeof x.id !== "string") return false;
  if (x.game === "sudoku") return validSudoku(x);
  if (x.game === "watersort") return validWater(x);
  if (x.game === "shikaku") return validShikaku(x);
  if (x.game !== "starbattle") return false;
  const n = x.size;
  if (!Number.isInteger(n) || n < MIN_SIZE || n > MAX_SIZE || !Number.isInteger(x.stars) || x.stars < 1 || x.stars > maxStars(n)) return false;
  if (!Array.isArray(x.regions) || x.regions.length !== n || x.regions.some((r) => typeof r !== "string" || r.length !== n)) return false;
  if (new Set(x.regions.join("")).size !== n) return false;
  return Array.isArray(x.solution) && x.solution.length === n && x.solution.every((r) => Array.isArray(r) && r.length === x.stars);
}

const isGrid9 = (g, lo) => Array.isArray(g) && g.length === 9 && g.every((r) => Array.isArray(r) && r.length === 9 && r.every((v) => Number.isInteger(v) && v >= lo && v <= 9));
function validSudoku(x) {
  if (x.size !== 9 || !isGrid9(x.givens, 0) || !isGrid9(x.solution, 1)) return false;
  return Object.entries(x.entries ?? {}).every(([k, v]) => /^[0-8],[0-8]$/.test(k) && Number.isInteger(v) && v >= 1 && v <= 9);
}
// Shikaku (Claude adds these from a screenshot, Colin 10/24): clues [row, col, number (0 = none), shape?] and the
// answer, one rectangle per clue.
function validShikaku(x) {
  const n = x.size, inB = (v) => Number.isInteger(v) && v >= 0 && v < n;
  if (!Number.isInteger(n) || n < 4 || n > 15 || !Array.isArray(x.clues) || !x.clues.length) return false;
  if (!x.clues.every((k) => Array.isArray(k) && inB(k[0]) && inB(k[1]) && Number.isInteger(k[2]) && k[2] >= 0 && (k[3] === undefined || "stwa".includes(k[3])))) return false;
  return Array.isArray(x.solution) && x.solution.length === x.clues.length
    && x.solution.every((R) => R && inB(R.r) && inB(R.c) && R.w >= 1 && R.h >= 1 && R.r + R.h <= n && R.c + R.w <= n);
}
function validWater(x) {
  const t = x.tubes;
  if (!Array.isArray(t) || t.length < MIN_TUBES || t.length > MAX_TUBES) return false;
  if (!t.every((tube) => Array.isArray(tube) && tube.length <= TUBE_CAP && tube.every((c) => c in WATER_COLORS))) return false;
  return waterProblem(t) === null;
}

// Sudoku: cells whose number appears twice in a row, column or box. board = 9×9 numbers (0 = empty).
export function sudokuClashes(board) {
  const out = new Set();
  const groups = [];
  for (let i = 0; i < 9; i++) {
    groups.push([...Array(9).keys()].map((c) => [i, c]), [...Array(9).keys()].map((r) => [r, i]));
    const r0 = Math.floor(i / 3) * 3, c0 = (i % 3) * 3;
    groups.push([...Array(9).keys()].map((k) => [r0 + Math.floor(k / 3), c0 + (k % 3)]));
  }
  for (const g of groups) {
    const seen = {};
    for (const [r, c] of g) { const v = board[r][c]; if (v) (seen[v] ??= []).push(`${r},${c}`); }
    for (const cells of Object.values(seen)) if (cells.length > 1) cells.forEach((k) => out.add(k));
  }
  return [...out];
}
// Your own numbers that disagree with the answer.
export const sudokuWrong = (entries, solution) =>
  Object.entries(entries).filter(([k, v]) => { const [r, c] = k.split(",").map(Number); return solution[r][c] !== v; }).map(([k]) => k);

// Water Sort: what's wrong before solving, or null. Every colour used needs exactly 4 units, and there must be room
// to move (not every tube full).
export function waterProblem(tubes) {
  const count = {};
  for (const t of tubes) for (const c of t) count[c] = (count[c] ?? 0) + 1;
  const used = Object.keys(count);
  if (!used.length) return { kind: "wait", title: "Fill the tubes", text: "Pick a tube, then tap colours to fill it from the bottom up, like your photo." };
  const off = used.filter((c) => count[c] !== TUBE_CAP);
  if (off.length) return { kind: "bad", title: "Each colour needs exactly 4", text: off.sort().map((c) => `${WATER_NAMES[c]} has ${count[c]}`).join(", ") + "." };
  if (used.length * TUBE_CAP >= tubes.length * TUBE_CAP) return { kind: "bad", title: "Leave some room", text: "With every tube full nothing can move. Add an empty tube." };
  return null;
}

// "Today", "Yesterday", or "Oct 18" (with the year if it isn't this year), in the phone's own days.
export function dayLabel(ms, now = Date.now()) {
  const day = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const diff = Math.round((day(now) - day(ms)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const d = new Date(ms);
  const opts = { month: "short", day: "numeric", ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}) };
  return d.toLocaleDateString("en-US", opts);
}

// Groups in day order: [{ day: "Today", items: [...] }, ...]. newest = newest day first (and newest first within a day).
export function groupByDay(items, newest = true, now = Date.now()) {
  const sorted = [...items].sort((a, b) => (newest ? b.at - a.at : a.at - b.at));
  const groups = [];
  for (const it of sorted) {
    const day = dayLabel(it.at, now);
    if (groups.at(-1)?.day === day) groups.at(-1).items.push(it);
    else groups.push({ day, items: [it] });
  }
  return groups;
}

// What the editor's check says about a board, before and after counting answers.
// grid = rows of letters ("" = not painted yet). Returns { kind, title, text } with kind "wait" | "bad" | "warn" | "good".
export function boardProblem(grid, size) {
  const cells = grid.flat();
  const blank = cells.filter((l) => !l).length;
  if (blank) return { kind: "wait", title: "Paint every cell", text: `${blank} cell${blank === 1 ? "" : "s"} still need a colour.` };
  const used = new Set(cells).size;
  if (used !== size) return { kind: "bad", title: `${size} regions needed, you have ${used}`, text: "Each colour is one region; a board has as many regions as rows." };
  return null;
}
export function answerVerdict(count) {
  if (count === 0) return { kind: "bad", title: "No answer with this board", text: "Check the regions against your photo." };
  if (count > 1) return { kind: "bad", title: "More than one answer", text: "Check the regions: one may be painted wrong." };
  return { kind: "good", title: "One answer, ready to solve", text: "" };
}
// Starting marks that disagree with the answer: a ★ where it has none, or an × on one of its stars.
export function markClashes(marks, solution) {
  const out = [];
  for (const [k, v] of Object.entries(marks)) {
    const [r, c] = k.split(",").map(Number);
    const star = solution[r]?.includes(c);
    if ((v === 2 && !star) || (v === 1 && star)) out.push([r, c]);
  }
  return out;
}
