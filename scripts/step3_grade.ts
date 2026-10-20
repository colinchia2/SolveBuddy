// Make puzzles with more or fewer numbers left, and grade each one.
// Run: node scripts/step3_grade.ts
import { makeFullGrid } from "../engine/sudoku/fullGrid.ts";
import { erase } from "../engine/sudoku/erase.ts";
import { grade } from "../engine/sudoku/grade.ts";

for (const target of [40, 34, 30, 0]) {
  const { puzzle } = erase(makeFullGrid(), target);
  const clues = puzzle.flat().filter((n) => n !== 0).length;
  const g = grade(puzzle);
  const used: Record<string, number> = {};
  for (const s of g.steps) used[s.technique] = (used[s.technique] ?? 0) + 1;
  console.log(`${clues} numbers left → ${g.level}` + (g.stuckWith ? ` (stuck with ${g.stuckWith} cells empty)` : ""));
  for (const [name, n] of Object.entries(used)) console.log(`    ${name}: ${n}`);
  if (target === 40) {
    const s = g.steps[0];
    console.log(`    First move: ${s.value} at row ${s.row + 1}, column ${s.col + 1}. ${s.technique}: ${s.why}`);
  }
}
