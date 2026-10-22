// Star Battle grading: solve it like a person, easiest tricks first.
// The grade is the lowest tier whose tricks finish the puzzle:
//   Easy = tricks 1–4 · Medium = + "Would block" · Hard = + groups · Expert = + "What if".
// "Too hard" = even all our tricks get stuck (never shipped, because hints would get stuck too).
import { type Regions, perUnit } from "./layout.ts";
import { type Board, type Step, EMPTY, STAR, EASY_TECHNIQUES, MEDIUM_TECHNIQUES, HARD_TECHNIQUES, EXPERT_TECHNIQUES,
  nextStep, applyStep } from "./techniques.ts";

export type Level = "Easy" | "Medium" | "Hard" | "Expert" | "Too hard";
export type Grade = { level: Level; steps: Step[] };

const TIERS: [Level, typeof EASY_TECHNIQUES][] = [
  ["Easy", EASY_TECHNIQUES], ["Medium", MEDIUM_TECHNIQUES], ["Hard", HARD_TECHNIQUES], ["Expert", EXPERT_TECHNIQUES],
];

export function solveWith(regions: Regions, techniques = EXPERT_TECHNIQUES): { board: Board; steps: Step[] } {
  const n = regions.length;
  const board: Board = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  const steps: Step[] = [];
  let step: Step | null;
  while ((step = nextStep(board, regions, techniques))) {
    applyStep(board, step);
    steps.push(step);
  }
  return { board, steps };
}

const starCount = (b: Board) => b.flat().filter((v) => v === STAR).length;

export function grade(regions: Regions): Grade {
  let last: Step[] = [];
  for (const [level, techniques] of TIERS) {
    const { board, steps } = solveWith(regions, techniques);
    if (starCount(board) === regions.length * perUnit(regions)) return { level, steps };
    last = steps;
  }
  return { level: "Too hard", steps: last };
}
