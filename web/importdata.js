// Imported puzzles (Colin, 10/22): the ones you build by hand on this phone, plus the ones Claude adds from your
// screenshots (packs/imports.json, until the app reads photos itself). Plain logic, no page, so the checks can test it.
//
// One import: { id: "imp-<time>", game: "starbattle", size, stars, regions: ["AABB…", …], marks: { "r,c": 1 (×) | 2 (★) },
//   solution: [[cols of row 0's stars], …], name, addedAt (ms or an ISO date), source: "hand" | "claude" }

export const IMPORTS_KEY = "solvebuddy.imports";
export const LETTERS = "ABCDEFGHIJKL";
// Region colours: the game's ten (layout A–J) plus two more for 11×11 and 12×12 boards.
export const REGION_COLORS = ["#D8C3EA", "#FFD08A", "#A6D8D0", "#C6E2A6", "#F5C2C9", "#FFB48A", "#BFD3F2", "#E9D9B8", "#E2EA98", "#D3D0C8", "#F2C6E8", "#BDE6F0"];
export const MIN_SIZE = 5, MAX_SIZE = 12;

// Most stars per row a board can hold in practice: 1 up to 7×7, 2 on 8×8 and 9×9, 3 from 10×10.
export const maxStars = (size) => (size >= 10 ? 3 : size >= 8 ? 2 : 1);

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
  if (!x || typeof x.id !== "string" || x.game !== "starbattle") return false;
  const n = x.size;
  if (!Number.isInteger(n) || n < MIN_SIZE || n > MAX_SIZE || !Number.isInteger(x.stars) || x.stars < 1 || x.stars > maxStars(n)) return false;
  if (!Array.isArray(x.regions) || x.regions.length !== n || x.regions.some((r) => typeof r !== "string" || r.length !== n)) return false;
  if (new Set(x.regions.join("")).size !== n) return false;
  return Array.isArray(x.solution) && x.solution.length === n && x.solution.every((r) => Array.isArray(r) && r.length === x.stars);
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
