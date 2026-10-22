// Double Star Battle (Colin, 10/22): 10×10, two stars in every row, column and region, none touching.
// Grow 10 random regions, find an answer, then repair the regions until it's the only answer (same repair
// idea as one-star puzzles). Keep it only if the regions are evenly sized and our tricks can finish it.
import { LETTERS, regionSizes, shuffled, type Regions } from "./layout.ts";
import { grade, type Level } from "./grade.ts";

export type Pairs = number[][]; // pairs[row] = that row's two star columns, left first

export const N = 10;
const MIN_REGION = 5;
const MAX_REGION = 17;

// Every answer up to `limit`, row by row: two non-touching columns per row, at most 2 per column and region,
// nothing touching the row above.
export function countDouble(regions: Regions, limit = 2, found: Pairs[] = []): number {
  const n = regions.length;
  const col = Array(n).fill(0);
  const reg: Record<string, number> = {};
  const lastRow: Record<string, number> = {};
  regions.forEach((row, r) => [...row].forEach((l) => (lastRow[l] = r)));
  const rows: Pairs = [];
  const pairs: [number, number][] = [];
  for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) pairs.push([a, b]);
  let count = 0;
  function search(r: number) {
    if (count >= limit) return;
    if (r === n) {
      count++;
      found.push(rows.map((p) => [...p]));
      return;
    }
    const above = rows[r - 1] ?? [];
    for (const [a, b] of pairs) {
      if (col[a] >= 2 || col[b] >= 2) continue;
      if (above.some((c) => Math.abs(c - a) <= 1 || Math.abs(c - b) <= 1)) continue;
      const la = regions[r][a], lb = regions[r][b];
      if ((reg[la] ?? 0) + (la === lb ? 2 : 1) > 2 || (la !== lb && (reg[lb] ?? 0) >= 2)) continue;
      col[a]++, col[b]++, (reg[la] = (reg[la] ?? 0) + 1), (reg[lb] = (reg[lb] ?? 0) + 1), rows.push([a, b]);
      // Every region that ends on this row must be full, and no column can need more stars than rows left
      // (a column's two stars can't sit in rows next to each other).
      const left = n - 1 - r;
      const ok = Object.keys(lastRow).every((l) => lastRow[l] !== r || reg[l] === 2) &&
        col.every((k) => 2 - k <= Math.ceil(left / 2));
      if (ok) search(r + 1);
      col[a]--, col[b]--, reg[la]--, reg[lb]--, rows.pop();
    }
  }
  search(0);
  return count;
}

// 10 regions grown from random seeds, smaller ones picked more often so sizes stay even.
function randomRegions(n: number): Regions {
  const grid: string[][] = Array.from({ length: n }, () => Array(n).fill(""));
  const size: Record<string, number> = {};
  shuffled([...Array(n * n).keys()]).slice(0, n).forEach((i, k) => {
    grid[Math.floor(i / n)][i % n] = LETTERS[k];
    size[LETTERS[k]] = 1;
  });
  for (;;) {
    const room: Record<string, [number, number][]> = {};
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (grid[r][c]) continue;
      for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (a >= 0 && b >= 0 && a < n && b < n && grid[a][b]) (room[grid[a][b]] ??= []).push([r, c]);
      }
    }
    const growable = Object.keys(room);
    if (!growable.length) break;
    const w = growable.map((l) => 1 / size[l] ** 2);
    let pick = Math.random() * w.reduce((a, b) => a + b, 0);
    const l = growable.find((_, i) => (pick -= w[i]) <= 0) ?? growable[growable.length - 1];
    const [r, c] = room[l][Math.floor(Math.random() * room[l].length)];
    grid[r][c] = l;
    size[l]++;
  }
  return grid.map((row) => row.join(""));
}

// Move one of a wrong answer's star cells (not a real star) into a neighbouring region, until one answer is left.
function repair(regions: Regions, real: Pairs): Regions | null {
  const n = regions.length;
  const grid = regions.map((row) => [...row]);
  const isReal = (r: number, c: number) => real[r].includes(c);
  for (let round = 0; round < 60; round++) {
    const found: Pairs[] = [];
    const now = grid.map((row) => row.join(""));
    const k = countDouble(now, 2, found);
    if (k === 1) return now;
    if (k === 0) return null;
    const wrong = found.find((s) => s.some((p, r) => p.join() !== real[r].join()))!;
    const cells = shuffled(wrong.flatMap((p, r) => p.map((c) => [r, c] as [number, number])).filter(([r, c]) => !isReal(r, c)));
    let moved = false;
    for (const [r, c] of cells) {
      const own = grid[r][c];
      const next = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && grid[a][b] !== own).map(([a, b]) => grid[a][b]);
      if (!next.length || !connectedWithout(grid, r, c)) continue;
      grid[r][c] = next[Math.floor(Math.random() * next.length)];
      moved = true;
      break;
    }
    if (!moved) return null;
  }
  return null;
}

function connectedWithout(grid: string[][], r: number, c: number): boolean {
  const n = grid.length, l = grid[r][c];
  const cells: [number, number][] = [];
  grid.forEach((row, a) => row.forEach((x, b) => x === l && !(a === r && b === c) && cells.push([a, b])));
  if (!cells.length) return false;
  const seen = new Set([cells[0].join()]);
  const queue = [cells[0]];
  while (queue.length) {
    const [a, b] = queue.pop()!;
    for (const [x, y] of [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]]) {
      if (x < 0 || y < 0 || x >= n || y >= n || grid[x][y] !== l || (x === r && y === c) || seen.has(`${x},${y}`)) continue;
      seen.add(`${x},${y}`);
      queue.push([x, y]);
    }
  }
  return seen.size === cells.length;
}

export type DoublePuzzle = { regions: Regions; solution: Pairs; techniquesUsed: string[]; level: Level; tries: number };

// levels = the grades to accept (our tricks must finish it: never "Too hard").
export function makeDouble(levels: Level[] = ["Expert"], maxTries = Infinity): DoublePuzzle | null {
  for (let tries = 1; tries <= maxTries; tries++) {
    const start = randomRegions(N);
    const found: Pairs[] = [];
    if (!countDouble(start, 1, found)) continue;
    const regions = repair(start, found[0]);
    if (!regions) continue;
    const { min, max } = regionSizes(regions);
    if (min < MIN_REGION || max > MAX_REGION) continue;
    const g = grade(regions);
    if (!levels.includes(g.level)) continue;
    return { regions, solution: found[0], techniquesUsed: [...new Set(g.steps.map((s) => s.technique))], level: g.level, tries };
  }
  return null;
}
