// Writes the three Shikaku packs (Colin 10/24): 8×8 Easy, 10×10 Medium, 12×12 Hard, 10 each. Each puzzle is a random
// cut of the square into rectangles with one number in each; kept only if it has exactly one answer and Hint alone
// solves it with simple steps (never "Show the answer"). Seeded, so the same packs come out every run.
// Plus Patches (Colin 10/24, LinkedIn Patches style): 8×8, each clue a shape (square / tall / wide, or "any" with a
// number), half of them with no number at all.
// Run: node scripts/shikaku_make_packs.ts   (overwrites packs/shikaku*.json)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Clue, type Puzzle, type Rect, type Shape, countSolutions, playHints } from "../engine/shikaku/shikaku.ts";

const PACKS = [
  { file: "shikaku8-easy.json", id: "shikaku8-easy", size: 8, difficulty: "Easy", maxArea: 8, maxSide: 5, ones: 0, seed: 81 },
  { file: "shikaku10-medium.json", id: "shikaku10-medium", size: 10, difficulty: "Medium", maxArea: 12, maxSide: 6, ones: 1, seed: 101 },
  { file: "shikaku12-hard.json", id: "shikaku12-hard", size: 12, difficulty: "Hard", maxArea: 16, maxSide: 7, ones: 1, seed: 121 },
  { file: "shikaku8-patches.json", id: "shikaku8-patches", size: 8, difficulty: "Patches", maxArea: 9, maxSide: 5, ones: 0, seed: 88, patches: true },
];
// A Patches clue for rectangle R: its true shape with no number (half), its shape with the number, or "any" with the
// number.
function patchesClue(R: Rect, r: number, c: number): Clue {
  const shape: Shape = R.w === R.h ? "s" : R.h > R.w ? "t" : "w", x = rnd();
  return x < 0.5 ? [r, c, 0, shape] : x < 0.75 ? [r, c, R.w * R.h, shape] : [r, c, R.w * R.h, "a"];
}

let seed = 1;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];

// Cut the square into rectangles, top-left first; each rectangle picked at random from the ones that fit.
function cut(N: number, maxArea: number, maxSide: number): Rect[] {
  const g = Array.from({ length: N }, () => Array(N).fill(-1)), rects: Rect[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (g[r][c] >= 0) continue;
    let maxW = 0;
    while (c + maxW < N && g[r][c + maxW] < 0) maxW++;
    const opts: Rect[] = [];
    for (let w = 1; w <= Math.min(maxW, maxSide); w++) for (let h = 1; h <= Math.min(N - r, maxSide); h++) {
      const a = w * h;
      if (a < 2 || a > maxArea) continue;
      let ok = true;
      for (let y = r; y < r + h && ok; y++) for (let x = c; x < c + w; x++) if (g[y][x] >= 0) { ok = false; break; }
      if (ok) opts.push({ r, c, w, h });
    }
    const R = opts.length ? pick(opts) : { r, c, w: 1, h: 1 };
    for (let y = R.r; y < R.r + R.h; y++) for (let x = R.c; x < R.c + R.w; x++) g[y][x] = rects.length;
    rects.push(R);
  }
  return rects;
}

for (const pk of PACKS) {
  seed = pk.seed;
  const puzzles: (Puzzle & { id: string })[] = [];
  let tries = 0;
  while (puzzles.length < 10) {
    tries++;
    const rects = cut(pk.size, pk.maxArea, pk.maxSide);
    if (rects.filter((R) => R.w * R.h === 1).length > pk.ones) continue;
    // One number per rectangle, somewhere inside it; listed in reading order.
    const pairs = rects.map((R) => {
      const r = R.r + Math.floor(rnd() * R.h), c = R.c + Math.floor(rnd() * R.w);
      return { R, k: pk.patches ? patchesClue(R, r, c) : [r, c, R.w * R.h] as Clue };
    })
      .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1]);
    const p: Puzzle = { size: pk.size, clues: pairs.map((x) => x.k), solution: pairs.map((x) => x.R), ...(pk.patches ? { style: "patches" as const } : {}) };
    if (countSolutions(p) !== 1) continue;
    const run = playHints(p);
    if (!run.steps || run.used["Show the answer"]) continue;
    puzzles.push({ id: `${pk.id}-${puzzles.length + 1}`, ...p });
  }
  writeFileSync(join(import.meta.dirname, "..", "packs", pk.file),
    JSON.stringify({ id: pk.id, game: "shikaku", size: pk.size, difficulty: pk.difficulty, puzzles }) + "\n");
  console.log(`${pk.file}: 10 puzzles (${tries} tries), ${puzzles.map((p) => p.clues.length).join(", ")} patches`);
}
