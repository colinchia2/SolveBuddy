// Star Battle steps 1 and 2: place the answer stars, then grow colored regions around them.
// A puzzle is just its regions: one letter per cell, e.g. "AAABBBCC" for a row.

export type Regions = string[]; // N rows of N letters; each letter is one region
// stars[row] = the column of that row's star. Double Star Battle: stars[row] = the two columns, e.g. [1, 6].
export type Stars = number[] | number[][];

export const LETTERS = "ABCDEFGHIJKL";

// Stars per row, column and region. A puzzle can say (imports: 5×5 to 12×12 with 1, 2 or 3 stars, Colin 10/22) by
// tagging its regions with withStars(); untagged packs keep the old rule: 1 on 8×8, 2 on 10×10 (Double).
const starTags = new WeakMap<Regions, number>();
export function withStars(regions: Regions, stars: number): Regions {
  starTags.set(regions, stars);
  return regions;
}
export const perUnit = (regions: Regions) => starTags.get(regions) ?? (regions.length >= 10 ? 2 : 1);
// Is (r, c) one of the answer's stars?
export const isAnswer = (stars: Stars, r: number, c: number) => {
  const x = stars[r];
  return Array.isArray(x) ? x.includes(c) : x === c;
};

// Step 1: one star per row and column, none touching (not even diagonally). Random order, back up when stuck.
export function placeStars(n: number): Stars {
  const stars: Stars = [];
  const used = new Set<number>();
  function place(row: number): boolean {
    if (row === n) return true;
    for (const col of shuffled([...Array(n).keys()])) {
      if (used.has(col)) continue;
      if (row > 0 && Math.abs(stars[row - 1] - col) <= 1) continue; // would touch the star above
      stars.push(col);
      used.add(col);
      if (place(row + 1)) return true;
      stars.pop();
      used.delete(col);
    }
    return false;
  }
  place(0);
  return stars;
}

// Step 2: each star starts its own region (one cell). Then, over and over, pick a region and let it take
// one empty cell next to it, until every cell belongs to a region. Smaller regions get picked more often,
// so sizes stay fairly even.
export function growRegions(stars: Stars): Regions {
  const n = stars.length;
  const grid: string[][] = Array.from({ length: n }, () => Array(n).fill(""));
  const size: Record<string, number> = {};
  stars.forEach((col, row) => {
    grid[row][col] = LETTERS[row];
    size[LETTERS[row]] = 1;
  });
  const near = (r: number, c: number) =>
    [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n);
  for (;;) {
    const room: Record<string, [number, number][]> = {}; // empty cells each region could take
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c]) continue;
        for (const [a, b] of near(r, c)) if (grid[a][b]) (room[grid[a][b]] ??= []).push([r, c]);
      }
    }
    const growable = Object.keys(room);
    if (!growable.length) break;
    const weights = growable.map((l) => 1 / size[l]);
    let pick = Math.random() * weights.reduce((a, b) => a + b, 0);
    const letter = growable.find((_, i) => (pick -= weights[i]) <= 0) ?? growable[growable.length - 1];
    const [r, c] = room[letter][Math.floor(Math.random() * room[letter].length)];
    grid[r][c] = letter;
    size[letter]++;
  }
  return grid.map((row) => row.join(""));
}

// Step 3b, repair: if the checker finds a second answer, move one of that answer's star cells into a
// neighboring region. That region now holds two of the wrong answer's stars, so the wrong answer breaks,
// while the real answer still works. Repeat until only the real answer is left (or give up: null).
export function repair(regions: Regions, solution: Stars, count: (r: Regions, found: Stars[]) => number): Regions | null {
  const n = regions.length;
  const grid = regions.map((row) => [...row]);
  for (let round = 0; round < 40; round++) {
    const found: Stars[] = [];
    const current = grid.map((row) => row.join(""));
    if (count(current, found) === 1) return current;
    const wrong = found.find((s) => s.some((c, r) => c !== solution[r]))!;
    let fixed = false;
    for (const r of shuffled([...Array(n).keys()])) {
      const c = wrong[r];
      if (c === solution[r]) continue;
      const own = grid[r][c];
      const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && grid[a][b] !== own)
        .map(([a, b]) => grid[a][b]);
      if (!neighbors.length || !staysConnected(grid, r, c)) continue;
      grid[r][c] = neighbors[Math.floor(Math.random() * neighbors.length)];
      fixed = true;
      break;
    }
    if (!fixed) return null;
  }
  return null;
}

// Would the cell's region still be one connected piece (and not empty) without this cell?
function staysConnected(grid: string[][], r: number, c: number): boolean {
  const n = grid.length;
  const letter = grid[r][c];
  const cells: [number, number][] = [];
  grid.forEach((row, a) => row.forEach((l, b) => l === letter && !(a === r && b === c) && cells.push([a, b])));
  if (!cells.length) return false;
  const seen = new Set([cells[0].join()]);
  const queue = [cells[0]];
  while (queue.length) {
    const [a, b] = queue.pop()!;
    for (const [x, y] of [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]]) {
      if (x < 0 || y < 0 || x >= n || y >= n || grid[x][y] !== letter || (x === r && y === c)) continue;
      if (!seen.has(`${x},${y}`)) seen.add(`${x},${y}`), queue.push([x, y]);
    }
  }
  return seen.size === cells.length;
}

// Smallest and largest region size.
export function regionSizes(regions: Regions): { min: number; max: number } {
  const count: Record<string, number> = {};
  for (const l of regions.join("")) count[l] = (count[l] ?? 0) + 1;
  const sizes = Object.values(count);
  return { min: Math.min(...sizes), max: Math.max(...sizes) };
}

export function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
