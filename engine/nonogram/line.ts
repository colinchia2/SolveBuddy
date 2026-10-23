// Nonogram rules and the line solver: everything one row or column can tell you on its own.
// A cell is UNKNOWN (-1), EMPTY (0) or FILLED (1). A clue is the run lengths in order; [0] (or []) = no filled squares.

export const UNKNOWN = -1, EMPTY = 0, FILLED = 1;
export type Cell = -1 | 0 | 1;
export type Clue = number[];

// The run lengths of a finished line: "X.XX" → [1, 2]; an empty line → [0].
export function runs(line: ArrayLike<number>): Clue {
  const out: number[] = [];
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === FILLED) n++;
    else if (n) { out.push(n); n = 0; }
  }
  if (n) out.push(n);
  return out.length ? out : [0];
}
const blocksOf = (clue: Clue) => clue.filter((b) => b > 0);
export const sameClue = (a: Clue, b: Clue) => blocksOf(a).join() === blocksOf(b).join();

// Clues of a picture given as rows of "X" (filled) and "." (empty).
export function cluesOf(picture: string[]) {
  const grid = picture.map((row) => [...row].map((ch) => (ch === "X" ? FILLED : EMPTY)));
  const rows = grid.map((row) => runs(row));
  const cols = grid[0].map((_, c) => runs(grid.map((row) => row[c])));
  return { rows, cols };
}

// What every arrangement of the clue that agrees with the known cells has in common.
// Returns null if no arrangement fits (the line contradicts its clue), else the line with every forced cell set.
// Works by dynamic programming: fits[i][j] = cells i.. can hold blocks j.. ; then a forward walk over the reachable
// states records, for each cell, whether some fitting arrangement fills it and whether some leaves it empty.
export function solveLine(clue: Clue, line: Cell[]): Cell[] | null {
  const b = blocksOf(clue), n = line.length, k = b.length;
  // A filled cell can't sit in [from, to) if any cell there is known empty; precompute the last known-empty index.
  const emptyBefore = new Int32Array(n + 1); // number of known-empty cells in [0, i)
  for (let i = 0; i < n; i++) emptyBefore[i + 1] = emptyBefore[i] + (line[i] === EMPTY ? 1 : 0);
  const noEmpty = (from: number, to: number) => emptyBefore[to] - emptyBefore[from] === 0;
  const fits: boolean[][] = Array.from({ length: n + 2 }, () => Array(k + 1).fill(false));
  fits[n][k] = true;
  fits[n + 1][k] = true;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = k; j >= 0; j--) {
      let ok = line[i] !== FILLED && fits[i + 1][j]; // leave cell i empty
      if (!ok && j < k) {
        const e = i + b[j];
        ok = e <= n && noEmpty(i, e) && (e === n ? fits[n][j + 1] : line[e] !== FILLED && fits[e + 1][j + 1]);
      }
      fits[i][j] = ok;
    }
  }
  if (!fits[0][0]) return null;
  const canFill = new Uint8Array(n), canEmpty = new Uint8Array(n);
  const seen: boolean[][] = Array.from({ length: n + 2 }, () => Array(k + 1).fill(false));
  seen[0][0] = true;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      if (!seen[i][j] || !fits[i][j]) continue;
      if (line[i] !== FILLED && fits[i + 1][j]) { canEmpty[i] = 1; seen[i + 1][j] = true; }
      if (j < k) {
        const e = i + b[j];
        if (e <= n && noEmpty(i, e)) {
          if (e === n && fits[n][j + 1]) { for (let x = i; x < e; x++) canFill[x] = 1; seen[n][j + 1] = true; }
          else if (e < n && line[e] !== FILLED && fits[e + 1][j + 1]) {
            for (let x = i; x < e; x++) canFill[x] = 1;
            canEmpty[e] = 1;
            seen[e + 1][j + 1] = true;
          }
        }
      }
    }
  }
  return line.map((v, i) => (v !== UNKNOWN ? v : canFill[i] && !canEmpty[i] ? FILLED : canEmpty[i] && !canFill[i] ? EMPTY : UNKNOWN)) as Cell[];
}
