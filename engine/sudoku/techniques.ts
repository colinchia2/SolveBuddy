// Human-style tricks, easiest first. Each one looks at the board and finds one next move, or nothing.
// The grader uses these to rate a puzzle; later the Hint button will use the same list.
import { type Grid, fits } from "./fullGrid.ts";

export type Step = {
  technique: string; // the chip name shown in a hint
  row: number;
  col: number;
  value: number;
  why: string; // plain-English reason (the "Explain" level of a hint)
};

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
    return { technique: `Last cell in ${unit.kind}`, row, col, value,
      why: `${cap(unit.label)} has only one empty cell, and ${value} is the only number missing.` };
  }
  return null;
}

// 2. A number has only one place it can go in a box, row or column.
function onlySpot(grid: Grid): Step | null {
  for (const unit of UNITS) {
    for (let n = 1; n <= 9; n++) {
      if (unit.cells.some(([r, c]) => grid[r][c] === n)) continue;
      const spots = unit.cells.filter(([r, c]) => grid[r][c] === 0 && fits(grid, r, c, n));
      if (spots.length !== 1) continue;
      const [row, col] = spots[0];
      return { technique: `Only spot in ${unit.kind}`, row, col, value: n,
        why: `In ${unit.label}, every other empty cell already sees a ${n}, so ${n} must go at ${cellName(row, col)}.` };
    }
  }
  return null;
}

// 3. A cell has only one number that fits.
function onlyNumber(grid: Grid): Step | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== 0) continue;
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => fits(grid, row, col, n));
      if (options.length !== 1) continue;
      return { technique: "Only number for cell", row, col, value: options[0],
        why: `Every number except ${options[0]} is already in this cell's row, column or box.` };
    }
  }
  return null;
}

export const EASY_TECHNIQUES = [lastCell, onlySpot, onlyNumber];

// Next move using the easiest trick that works, or null if none of them do.
export function nextStep(grid: Grid): Step | null {
  for (const technique of EASY_TECHNIQUES) {
    const step = technique(grid);
    if (step) return step;
  }
  return null;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
