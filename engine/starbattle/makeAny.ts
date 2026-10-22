// Star Battle of any size (5×5 to 12×12) and any stars per row, column and region (1–3), for tests of imported
// puzzles and for future packs (e.g. 3-star, Colin 10/22). Same idea as makeDouble: grow random regions, find an
// answer, repair the regions until it's the only one, then grade with our tricks.
import { LETTERS, regionSizes, withStars, type Regions } from "./layout.ts";
import { countAnswers } from "./countAnswers.ts";
import { grade, type Level } from "./grade.ts";

// rng: Math.random, or a seeded one for repeatable checks.
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomRegions(n: number, rng: () => number): Regions {
  const grid: string[][] = Array.from({ length: n }, () => Array(n).fill(""));
  const size: Record<string, number> = {};
  shuffle([...Array(n * n).keys()], rng).slice(0, n).forEach((i, k) => {
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
    const growable = Object.keys(room).sort();
    if (!growable.length) break;
    const w = growable.map((l) => 1 / size[l] ** 2);
    let pick = rng() * w.reduce((a, b) => a + b, 0);
    const l = growable.find((_, i) => (pick -= w[i]) <= 0) ?? growable[growable.length - 1];
    const [r, c] = room[l][Math.floor(rng() * room[l].length)];
    grid[r][c] = l;
    size[l]++;
  }
  return grid.map((row) => row.join(""));
}

// A random answer: `stars` stars in every row and column, none touching. Then regions grown around it, each starting
// from one star and taking exactly `stars` of them (used for 3 stars, where random regions almost never fit one).
function placeAnswer(n: number, stars: number, rng: () => number): number[][] | null {
  const picks: number[][] = [];
  const pick = (from: number, chosen: number[]) => {
    if (chosen.length === stars) return void picks.push([...chosen]);
    for (let c = from; c < n; c++) pick(c + 2, [...chosen, c]);
  };
  pick(0, []);
  const col = Array(n).fill(0), rows: number[][] = [];
  let steps = 0;
  const place = (r: number): boolean => {
    if (r === n) return true;
    if (++steps > 20000) return false;
    const above = rows[r - 1] ?? [];
    for (const p of shuffle(picks, rng)) {
      if (p.some((c) => col[c] >= stars || above.some((a) => Math.abs(a - c) <= 1))) continue;
      p.forEach((c) => col[c]++);
      rows.push(p);
      if (col.every((k) => stars - k <= Math.ceil((n - 1 - r) / 2)) && place(r + 1)) return true;
      p.forEach((c) => col[c]--);
      rows.pop();
    }
    return false;
  };
  return place(0) ? rows : null;
}
function regionsAround(answer: number[][], stars: number, rng: () => number): Regions | null {
  const n = answer.length;
  const grid: string[][] = Array.from({ length: n }, () => Array(n).fill(""));
  const isStar = (r: number, c: number) => answer[r].includes(c);
  const all = answer.flatMap((p, r) => p.map((c) => [r, c] as [number, number]));
  const has: Record<string, number> = {}, size: Record<string, number> = {};
  shuffle(all, rng).slice(0, n).forEach(([r, c], k) => { grid[r][c] = LETTERS[k]; has[LETTERS[k]] = 1; size[LETTERS[k]] = 1; });
  for (;;) {
    const room: Record<string, [number, number][]> = {};
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (grid[r][c]) continue;
      for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (a < 0 || b < 0 || a >= n || b >= n || !grid[a][b]) continue;
        const l = grid[a][b];
        if (isStar(r, c) && has[l] >= stars) continue; // a full region can't take another star
        (room[l] ??= []).push([r, c]);
      }
    }
    const growable = Object.keys(room).sort();
    if (!growable.length) break;
    // Regions still short of stars grow first, toward a star cell when they can reach one.
    const w = growable.map((l) => (has[l] < stars ? 4 : 1) / size[l] ** 2);
    let pick = rng() * w.reduce((a, b) => a + b, 0);
    const l = growable.find((_, i) => (pick -= w[i]) <= 0) ?? growable[growable.length - 1];
    const stars_ = room[l].filter(([r, c]) => isStar(r, c));
    const options = has[l] < stars && stars_.length ? stars_ : room[l];
    const [r, c] = options[Math.floor(rng() * options.length)];
    grid[r][c] = l;
    size[l]++;
    if (isStar(r, c)) has[l]++;
  }
  if (grid.some((row) => row.includes("")) || Object.values(has).some((k) => k !== stars)) return null;
  return grid.map((row) => row.join(""));
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

// Move one of a wrong answer's star cells (not a real star) into a neighbouring region, until one answer is left.
function repair(regions: Regions, stars: number, real: number[][], rng: () => number): Regions | null {
  const n = regions.length;
  const grid = regions.map((row) => [...row]);
  for (let round = 0; round < 80; round++) {
    const found: number[][][] = [];
    const now = grid.map((row) => row.join(""));
    const k = countAnswers(now, stars, 2, found);
    if (k === 1) return now;
    if (k === 0) return null;
    const wrong = found.find((s) => s.some((p, r) => p.join() !== real[r].join()))!;
    const cells = shuffle(wrong.flatMap((p, r) => p.map((c) => [r, c] as [number, number])).filter(([r, c]) => !real[r].includes(c)), rng);
    let moved = false;
    for (const [r, c] of cells) {
      const own = grid[r][c];
      const next = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && grid[a][b] !== own).map(([a, b]) => grid[a][b]);
      if (!next.length || !connectedWithout(grid, r, c)) continue;
      grid[r][c] = next[Math.floor(rng() * next.length)];
      moved = true;
      break;
    }
    if (!moved) return null;
  }
  return null;
}

export type AnyPuzzle = { regions: Regions; stars: number; solution: number[][]; level: Level; techniquesUsed: string[]; tries: number };

// levels = grades to accept; null = any grade, even "Too hard" (an import can be harder than our tricks).
export function makeAny(n: number, stars: number, { rng = Math.random, levels = null as Level[] | null, maxTries = 500 } = {}): AnyPuzzle | null {
  for (let tries = 1; tries <= maxTries; tries++) {
    let start: Regions | null, real: number[][];
    if (stars >= 3) {
      const answer = placeAnswer(n, stars, rng);
      start = answer && regionsAround(answer, stars, rng);
      if (!start) continue;
      real = answer!;
    } else {
      start = randomRegions(n, rng);
      const found: number[][][] = [];
      if (!countAnswers(start, stars, 1, found)) continue;
      real = found[0];
    }
    const regions = repair(start, stars, real, rng);
    if (!regions) continue;
    const { min } = regionSizes(regions);
    if (min < stars * 2 + 1) continue; // room for its stars with gaps between
    const g = grade(withStars(regions, stars));
    if (levels && !levels.includes(g.level)) continue;
    return { regions, stars, solution: real, level: g.level, techniquesUsed: [...new Set(g.steps.map((s) => s.technique))], tries };
  }
  return null;
}
