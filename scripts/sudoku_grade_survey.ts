// How hard are random Sudokus? Make 100 (erased as far as one answer allows) and grade each one.
// Run: node scripts/sudoku_grade_survey.ts
import { makeFullGrid } from "../engine/sudoku/fullGrid.ts";
import { erase } from "../engine/sudoku/erase.ts";
import { grade } from "../engine/sudoku/grade.ts";

const tally: Record<string, number> = {};
let pointingUsed = 0, pairsUsed = 0, claimingUsed = 0, hiddenUsed = 0, xwingUsed = 0;
for (let i = 0; i < 100; i++) {
  const g = grade(erase(makeFullGrid(), 0).puzzle);
  tally[g.level] = (tally[g.level] || 0) + 1;
  if (g.steps.some((s) => s.technique === "Pointing")) pointingUsed++;
  if (g.steps.some((s) => s.technique === "Pairs")) pairsUsed++;
  if (g.steps.some((s) => s.technique === "Claiming")) claimingUsed++;
  if (g.steps.some((s) => s.technique === "Hidden pairs")) hiddenUsed++;
  if (g.steps.some((s) => s.technique === "X-wing")) xwingUsed++;
}
console.log(tally);
console.log(`Puzzles where Pointing was used: ${pointingUsed} · Claiming: ${claimingUsed} · Pairs: ${pairsUsed} · Hidden pairs: ${hiddenUsed} · X-wing: ${xwingUsed}`);
