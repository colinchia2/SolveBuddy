// Whole-board solving: line logic until nothing changes (what a person can do one row or column at a time), and an
// answer counter that also guesses, so "exactly one answer" is checked independently of the logic.
import { type Cell, type Clue, UNKNOWN, EMPTY, FILLED, solveLine } from "./line.ts";

export type Grid = Cell[][];
export const blankGrid = (h: number, w: number): Grid => Array.from({ length: h }, () => Array(w).fill(UNKNOWN) as Cell[]);
const col = (g: Grid, c: number) => g.map((row) => row[c]);

// Line logic only. Returns the grid as far as it gets, or null if the clues contradict the grid.
export function lineSolve(rows: Clue[], cols: Clue[], start?: Grid): Grid | null {
  const g = start ? start.map((r) => [...r]) : blankGrid(rows.length, cols.length);
  const dirtyR = new Set(rows.keys()), dirtyC = new Set(cols.keys());
  while (dirtyR.size || dirtyC.size) {
    for (const r of [...dirtyR]) {
      dirtyR.delete(r);
      const out = solveLine(rows[r], g[r]);
      if (!out) return null;
      out.forEach((v, c) => { if (g[r][c] !== v) { g[r][c] = v; dirtyC.add(c); } });
    }
    for (const c of [...dirtyC]) {
      dirtyC.delete(c);
      const out = solveLine(cols[c], col(g, c));
      if (!out) return null;
      out.forEach((v, r) => { if (g[r][c] !== v) { g[r][c] = v; dirtyR.add(r); } });
    }
  }
  return g;
}
export const isComplete = (g: Grid) => g.every((row) => row.every((v) => v !== UNKNOWN));

// How many answers (0, 1, or 2 meaning "2 or more"). Line logic, then a guess on the first open cell.
export function countSolutions(rows: Clue[], cols: Clue[], start?: Grid, cap = 2): number {
  const g = lineSolve(rows, cols, start);
  if (!g) return 0;
  if (isComplete(g)) return 1;
  const r = g.findIndex((row) => row.includes(UNKNOWN)), c = g[r].indexOf(UNKNOWN);
  let n = 0;
  for (const v of [FILLED, EMPTY] as Cell[]) {
    const next = g.map((row) => [...row]);
    next[r][c] = v;
    n += countSolutions(rows, cols, next, cap - n);
    if (n >= cap) return cap;
  }
  return n;
}

// "Solvable by logic alone": line logic finishes the board, and the result is the picture.
export function logicSolves(rows: Clue[], cols: Clue[], picture: string[]): boolean {
  const g = lineSolve(rows, cols);
  return !!g && isComplete(g) && g.every((row, r) => row.every((v, c) => (v === FILLED) === (picture[r][c] === "X")));
}
