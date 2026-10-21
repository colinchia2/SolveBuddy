// Step 4: put steps 1–3 together to make one Easy 9×9 Sudoku.
// Fill a full grid, then erase down to EASY_CLUES numbers, keeping an erase only if
// the puzzle still has one answer, the easy tricks can still solve it, and no row, column or box
// drops below EASY_MIN_PER numbers. If a row, column or box ends up with more than EASY_MAX_PER, start over.
import { makeFullGrid, type Grid } from "./fullGrid.ts";
import { erase } from "./erase.ts";
import { grade } from "./grade.ts";
import { playHints, tricksShown } from "./hint.ts";

export const EASY_CLUES = 36; // numbers left showing; more = gentler start
export const EASY_MIN_PER = 2; // every row, column and box keeps at least this many
export const EASY_MAX_PER = 6; // ...and at most this many, so none looks almost finished

export type Puzzle = { givens: Grid; solution: Grid; clues: number; techniquesUsed: string[] };

export function makeEasy(): Puzzle {
  for (;;) {
    const solution = makeFullGrid();
    const { puzzle } = erase(solution, EASY_CLUES, (p) => spread(p).min >= EASY_MIN_PER && grade(p).level === "Easy");
    if (spread(puzzle).max > EASY_MAX_PER) continue; // lopsided: try a fresh grid
    const used = new Set(grade(puzzle).steps.map((s) => s.technique));
    return {
      givens: puzzle,
      solution,
      clues: puzzle.flat().filter((n) => n !== 0).length,
      techniquesUsed: [...used],
    };
  }
}

// Medium / Hard / Expert: same idea, erasing further, but the puzzle must be exactly that level, and a player
// following hints must be shown `trick` at least once (so a trick test really teaches that trick).
export const MEDIUM_CLUES = 26;
const UP_TO: Record<string, string[]> = {
  Medium: ["Easy", "Medium"], Hard: ["Easy", "Medium", "Hard"], Expert: ["Easy", "Medium", "Hard", "Expert"],
};
export function makeLevel(level: "Medium" | "Hard" | "Expert", tricks: string[], tries = Infinity): Puzzle | null {
  for (let i = 0; i < tries; i++) {
    const solution = makeFullGrid();
    const { puzzle } = erase(solution, MEDIUM_CLUES, (p) => spread(p).min >= EASY_MIN_PER && UP_TO[level].includes(grade(p).level));
    const g = grade(puzzle);
    if (g.level !== level || spread(puzzle).max > EASY_MAX_PER) continue;
    const play = playHints(puzzle, solution);
    const seen = tricksShown(play.shown);
    if (!play.solved || !tricks.some((t) => seen.has(t))) continue;
    return { givens: puzzle, solution, clues: puzzle.flat().filter((n) => n !== 0).length,
      techniquesUsed: [...seen] };
  }
  return null;
}
export const makeMedium = () => makeLevel("Medium", ["Pointing"])!;

// Fewest and most numbers showing in any row, column or box.
export function spread(grid: Grid): { min: number; max: number } {
  const counts: number[] = [];
  for (let i = 0; i < 9; i++) {
    const r0 = Math.floor(i / 3) * 3;
    const c0 = (i % 3) * 3;
    const box = grid.slice(r0, r0 + 3).flatMap((r) => r.slice(c0, c0 + 3));
    for (const unit of [grid[i], grid.map((r) => r[i]), box]) counts.push(unit.filter((n) => n !== 0).length);
  }
  return { min: Math.min(...counts), max: Math.max(...counts) };
}
