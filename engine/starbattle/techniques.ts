// Star Battle human-style tricks, easiest first. Each looks at the board and finds one next move, or nothing.
// The grader uses these to rate a puzzle, and the Hint button uses the same list.
import { type Regions } from "./layout.ts";

export const EMPTY = 0, CROSS = 1, STAR = 2;
export type Board = number[][]; // EMPTY, CROSS or STAR per cell
type Cell = [number, number];

export type Step = {
  technique: string; // chip name shown in a hint
  star: Cell | null; // a star to place, or...
  cross: Cell[]; // ...cells to cross out
  focus: Cell[]; // cells to highlight
  nudge: string; // "Nudge" level of a hint
  why: string; // "Explain" level of a hint
};

// Friendly names for regions A–H, matching the colors on screen.
export const COLOR_NAMES: Record<string, string> = {
  A: "purple", B: "yellow", C: "teal", D: "green", E: "pink", F: "orange", G: "blue", H: "tan",
};

type Unit = { kind: "row" | "column" | "region"; label: string; cells: Cell[]; letter?: string };

export function units(regions: Regions): Unit[] {
  const n = regions.length;
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ kind: "row", label: `row ${i + 1}`, cells: [...Array(n).keys()].map((c) => [i, c] as Cell) });
    out.push({ kind: "column", label: `column ${i + 1}`, cells: [...Array(n).keys()].map((r) => [r, i] as Cell) });
  }
  for (const letter of [...new Set(regions.join(""))].sort()) {
    const cells: Cell[] = [];
    regions.forEach((row, r) => [...row].forEach((l, c) => l === letter && cells.push([r, c])));
    out.push({ kind: "region", label: `the ${COLOR_NAMES[letter]} region`, cells, letter });
  }
  return out;
}

const at = (b: Board, [r, c]: Cell) => b[r][c];
const open = (b: Board, cells: Cell[]) => cells.filter((p) => at(b, p) === EMPTY);
const hasStar = (b: Board, cells: Cell[]) => cells.some((p) => at(b, p) === STAR);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Every cell a star at (r, c) rules out: its row, column, region, and the 8 cells touching it.
export function ruledOutBy(regions: Regions, [r, c]: Cell): Cell[] {
  const n = regions.length;
  const out: Cell[] = [];
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === r && b === c) continue;
      const touching = Math.abs(a - r) <= 1 && Math.abs(b - c) <= 1;
      if (a === r || b === c || regions[a][b] === regions[r][c] || touching) out.push([a, b]);
    }
  }
  return out;
}

// 1. A star rules out its row, column, region and every touching cell.
function starRulesOut(b: Board, regions: Regions): Step | null {
  for (let r = 0; r < b.length; r++) {
    for (let c = 0; c < b.length; c++) {
      if (b[r][c] !== STAR) continue;
      const cross = open(b, ruledOutBy(regions, [r, c]));
      if (!cross.length) continue;
      return { technique: "Star rules out", star: null, cross, focus: [[r, c]],
        nudge: `Look at the star in row ${r + 1}.`,
        why: "A star rules out the rest of its row, column and region, and every cell touching it." };
    }
  }
  return null;
}

// 2. A row, column or region with only one open cell left gets its star there.
function lastCell(b: Board, regions: Regions): Step | null {
  for (const u of units(regions)) {
    if (hasStar(b, u.cells)) continue;
    const o = open(b, u.cells);
    if (o.length !== 1) continue;
    return { technique: `Last cell in ${u.kind}`, star: o[0], cross: [], focus: u.cells,
      nudge: `Look at ${u.label}.`,
      why: `${cap(u.label)} has only one cell left that can hold a star, so its star goes there.` };
  }
  return null;
}

// 3. A region whose open cells all sit in one row (or column) claims that line:
//    no other cell in that line can have a star.
function confinedRegion(b: Board, regions: Regions): Step | null {
  const all = units(regions);
  for (const reg of all.filter((u) => u.kind === "region")) {
    if (hasStar(b, reg.cells)) continue;
    const o = open(b, reg.cells);
    for (const kind of ["row", "column"] as const) {
      const idx = kind === "row" ? 0 : 1;
      if (!o.length || !o.every((p) => p[idx] === o[0][idx])) continue;
      const line = all.find((u) => u.kind === kind && u.cells[0][idx] === o[0][idx])!;
      const cross = open(b, line.cells).filter(([r, c]) => regions[r][c] !== reg.letter);
      if (!cross.length) continue;
      return { technique: "Confined region", star: null, cross, focus: reg.cells,
        nudge: `Look at ${reg.label}.`,
        why: `${cap(reg.label)} can only have its star in ${line.label}. So nothing else in ${line.label} can have one: cross out the striped cells.` };
    }
  }
  return null;
}

// 4. A row (or column) whose open cells all sit in one region: that line's star is the region's star,
//    so the rest of the region is ruled out.
function lineInsideRegion(b: Board, regions: Regions): Step | null {
  const all = units(regions);
  for (const line of all.filter((u) => u.kind !== "region")) {
    if (hasStar(b, line.cells)) continue;
    const o = open(b, line.cells);
    if (!o.length) continue;
    const letter = regions[o[0][0]][o[0][1]];
    if (!o.every(([r, c]) => regions[r][c] === letter)) continue;
    const reg = all.find((u) => u.letter === letter)!;
    const inLine = new Set(line.cells.map((p) => p.join()));
    const cross = open(b, reg.cells).filter((p) => !inLine.has(p.join()));
    if (!cross.length) continue;
    return { technique: `${cap(line.kind)} inside one region`, star: null, cross, focus: line.cells,
      nudge: `Look at ${line.label}.`,
      why: `Every open cell in ${line.label} is in ${reg.label}. So that region's star is in ${line.label}, and the rest of ${reg.label} is out.` };
  }
  return null;
}

// 5. (Harder) A cell that, if it held a star, would leave some row, column or region with nowhere to go.
function wouldBlock(b: Board, regions: Regions): Step | null {
  const all = units(regions);
  for (let r = 0; r < b.length; r++) {
    for (let c = 0; c < b.length; c++) {
      if (b[r][c] !== EMPTY) continue;
      const gone = new Set([[r, c], ...ruledOutBy(regions, [r, c])].map((p) => p.join()));
      const blocked = all.find((u) => !hasStar(b, u.cells) && !u.cells.some((p) => p[0] === r && p[1] === c) &&
        open(b, u.cells).every((p) => gone.has(p.join())));
      if (!blocked) continue;
      return { technique: "Would block", star: null, cross: [[r, c]], focus: blocked.cells,
        nudge: `Look at ${blocked.label}.`,
        why: `A star at row ${r + 1}, column ${c + 1} would rule out every open cell of ${blocked.label}. So that cell can't have a star.` };
    }
  }
  return null;
}

export const EASY_TECHNIQUES = [starRulesOut, lastCell, confinedRegion, lineInsideRegion];
export const ALL_TECHNIQUES = [...EASY_TECHNIQUES, wouldBlock];

export function nextStep(b: Board, regions: Regions, techniques = ALL_TECHNIQUES): Step | null {
  for (const t of techniques) {
    const step = t(b, regions);
    if (step) return step;
  }
  return null;
}

export function applyStep(b: Board, step: Step) {
  if (step.star) b[step.star[0]][step.star[1]] = STAR;
  for (const [r, c] of step.cross) b[r][c] = CROSS;
}
