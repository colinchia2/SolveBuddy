// Human-style tricks, easiest first. Each one looks at the board and finds one next move, or nothing.
// The grader uses these to rate a puzzle, and the Hint button uses the same list.
import { type Grid, fits } from "./fullGrid.ts";

export type Step = {
  technique: string; // the chip name shown in a hint
  row: number;
  col: number;
  value: number;
  // Harder tricks don't place a number: they rule `value` out of these cells instead (row/col = the first one).
  remove?: [number, number][];
  spots?: [number, number][]; // Pointing: the cells in the box where the number can still go (ringed in a hint)
  focus: [number, number][]; // cells to highlight (the row, column or box the trick looks at)
  nudge: string; // where to look (the "Nudge" level of a hint)
  why: string; // plain-English reason (the "Explain" level of a hint)
};

// Numbers already ruled out of cells by harder tricks, as "row,col,number" keys.
export type RuledOut = Set<string>;
const outKey = (r: number, c: number, n: number) => `${r},${c},${n}`;
const canGo = (grid: Grid, out: RuledOut, r: number, c: number, n: number) =>
  grid[r][c] === 0 && !out.has(outKey(r, c, n)) && fits(grid, r, c, n);

// Apply a step: place its number, or remember what it ruled out.
export function applyStep(grid: Grid, out: RuledOut, step: Step) {
  if (step.remove) for (const [r, c] of step.remove) out.add(outKey(r, c, step.value));
  else grid[step.row][step.col] = step.value;
}

type Unit = { kind: "row" | "column" | "box"; label: string; cells: [number, number][] };

const UNITS: Unit[] = [];
for (let i = 0; i < 9; i++) {
  UNITS.push({ kind: "box", label: `box ${i + 1}`, cells: boxCells(i) });
}
for (let i = 0; i < 9; i++) {
  UNITS.push({ kind: "row", label: `row ${i + 1}`, cells: Array.from({ length: 9 }, (_, c) => [i, c]) });
  UNITS.push({ kind: "column", label: `column ${i + 1}`, cells: Array.from({ length: 9 }, (_, r) => [r, i]) });
}

function boxCells(b: number): [number, number][] {
  const r0 = Math.floor(b / 3) * 3;
  const c0 = (b % 3) * 3;
  const cells: [number, number][] = [];
  for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 3; c++) cells.push([r, c]);
  return cells;
}

const cellName = (r: number, c: number) => `row ${r + 1}, column ${c + 1}`;

// 1. A box, row or column has just one empty cell left.
function lastCell(grid: Grid): Step | null {
  for (const unit of UNITS) {
    const empty = unit.cells.filter(([r, c]) => grid[r][c] === 0);
    if (empty.length !== 1) continue;
    const [row, col] = empty[0];
    const present = new Set(unit.cells.map(([r, c]) => grid[r][c]));
    const value = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !present.has(n))!;
    return { technique: `Last cell in ${unit.kind}`, row, col, value, focus: unit.cells,
      nudge: `Look at ${unit.label}.`,
      why: `${cap(unit.label)} has only one empty cell, and ${value} is the only number missing.` };
  }
  return null;
}

// 2. A number has only one place it can go in a box, row or column.
function onlySpot(grid: Grid, out: RuledOut): Step | null {
  for (const unit of UNITS) {
    for (let n = 1; n <= 9; n++) {
      if (unit.cells.some(([r, c]) => grid[r][c] === n)) continue;
      const spots = unit.cells.filter(([r, c]) => canGo(grid, out, r, c, n));
      if (spots.length !== 1) continue;
      const [row, col] = spots[0];
      return { technique: `Only spot in ${unit.kind}`, row, col, value: n, focus: unit.cells,
        nudge: `Where can ${n} go in ${unit.label}?`,
        why: `In ${unit.label}, every other empty cell already sees a ${n}, so ${n} must go at ${cellName(row, col)}.` };
    }
  }
  return null;
}

// 3. A cell has only one number that fits.
function onlyNumber(grid: Grid, out: RuledOut): Step | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== 0) continue;
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => canGo(grid, out, row, col, n));
      if (options.length !== 1) continue;
      const ruled = [1, 2, 3, 4, 5, 6, 7, 8, 9].some((n) => out.has(outKey(row, col, n)) && fits(grid, row, col, n));
      return { technique: "Only number for cell", row, col, value: options[0], focus: peers(row, col),
        nudge: `Which numbers could go at ${cellName(row, col)}?`,
        why: ruled
          ? `Every number except ${options[0]} is already in this cell's row, column or box, or was ruled out by an earlier hint.`
          : `Every number except ${options[0]} is already in this cell's row, column or box.` };
    }
  }
  return null;
}

// 4. (Medium) Pointing: in a box, every spot for a number sits in one row (or column). The box's number
//    must be in that line, so the number can't go anywhere else in the line. Twin of Star Battle's
//    "Confined region".
function pointing(grid: Grid, out: RuledOut): Step | null {
  for (let b = 0; b < 9; b++) {
    const box = boxCells(b);
    for (let n = 1; n <= 9; n++) {
      if (box.some(([r, c]) => grid[r][c] === n)) continue;
      const spots = box.filter(([r, c]) => canGo(grid, out, r, c, n));
      if (spots.length < 2) continue;
      for (const kind of ["row", "column"] as const) {
        const i = kind === "row" ? 0 : 1;
        if (!spots.every((p) => p[i] === spots[0][i])) continue;
        const line = UNITS.find((u) => u.kind === kind && u.label === `${kind} ${spots[0][i] + 1}`)!;
        const remove = line.cells.filter(([r, c]) => !box.some(([a, d]) => a === r && d === c) && canGo(grid, out, r, c, n));
        if (!remove.length) continue;
        return { technique: "Pointing", row: remove[0][0], col: remove[0][1], value: n, remove, spots,
          focus: [...box, ...line.cells.filter((p) => !box.some(([a, d]) => a === p[0] && d === p[1]))],
          nudge: `Where can ${n} go in box ${b + 1}?`,
          why: `In box ${b + 1}, ${n} can only go in ${line.label}. So the box's ${n} is in that ${kind}, and ${n} can't go anywhere else in ${line.label}.` };
      }
    }
  }
  return null;
}

type Technique = (grid: Grid, out: RuledOut) => Step | null;
export const EASY_TECHNIQUES: Technique[] = [lastCell, onlySpot, onlyNumber];
export const MEDIUM_TECHNIQUES: Technique[] = [...EASY_TECHNIQUES, pointing];
export const ALL_TECHNIQUES = MEDIUM_TECHNIQUES;

// Next move using the easiest trick that works, or null if none of them do.
export function nextStep(grid: Grid, out: RuledOut = new Set(), techniques = ALL_TECHNIQUES): Step | null {
  for (const technique of techniques) {
    const step = technique(grid, out);
    if (step) return step;
  }
  return null;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Every cell that shares a row, column or box with this one.
function peers(row: number, col: number): [number, number][] {
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  const seen = new Set<string>();
  const out: [number, number][] = [];
  const add = (r: number, c: number) => {
    if (!seen.has(`${r},${c}`)) seen.add(`${r},${c}`), out.push([r, c]);
  };
  for (let i = 0; i < 9; i++) add(row, i), add(i, col);
  for (const [r, c] of boxCells(box)) add(r, c);
  return out;
}
