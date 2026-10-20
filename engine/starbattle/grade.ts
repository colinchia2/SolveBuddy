// Star Battle step 4, grading: solve it like a person, easiest tricks first.
// Easy = the four easy tricks finish it. Medium = it also needs "Would block". Otherwise: Hard.
import { type Regions } from "./layout.ts";
import { type Board, type Step, EMPTY, STAR, EASY_TECHNIQUES, ALL_TECHNIQUES, nextStep, applyStep } from "./techniques.ts";

export type Grade = { level: "Easy" | "Medium" | "Hard"; steps: Step[] };

export function solveWith(regions: Regions, techniques = ALL_TECHNIQUES): { board: Board; steps: Step[] } {
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
  const easy = solveWith(regions, EASY_TECHNIQUES);
  if (starCount(easy.board) === regions.length) return { level: "Easy", steps: easy.steps };
  const all = solveWith(regions, ALL_TECHNIQUES);
  if (starCount(all.board) === regions.length) return { level: "Medium", steps: all.steps };
  return { level: "Hard", steps: all.steps };
}
