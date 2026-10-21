// Make the trick tests (one puzzle per harder trick, where following the hints shows that trick) and
// 1 full Expert puzzle. Run: node scripts/sudoku_make_trick_tests.ts
import { writeFileSync } from "node:fs";
import { makeLevel } from "../engine/sudoku/makePuzzle.ts";

const TESTS = [
  { trick: "Pointing", level: "Medium" },
  { trick: "Claiming", level: "Medium" },
  { trick: "Pairs", level: "Hard" },
  { trick: "Hidden pairs", level: "Hard" },
  { trick: "X-wing", level: "Expert" },
  { trick: "Y-wing", level: "Expert" },
] as const;

const puzzles = [];
for (const [i, t] of TESTS.entries()) {
  const t0 = Date.now();
  const p = makeLevel(t.level, [t.trick], 3000);
  if (!p) throw new Error(`No ${t.trick} test found`);
  console.log(`${t.trick}: ${p.clues} numbers · hints show ${p.techniquesUsed.join(", ")} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  puzzles.push({ id: `sudoku9-trick-${i + 1}`, label: `Test: ${t.trick}`, trick: t.trick, ...p });
}
writeFileSync("packs/sudoku9-tricks.json", JSON.stringify({ id: "sudoku9-tricks", game: "sudoku", size: 9, difficulty: "Tricks", puzzles }, null, 1));

const t0 = Date.now();
const ex = makeLevel("Expert", ["X-wing", "Y-wing"], 3000)!;
console.log(`Expert: ${ex.clues} numbers · hints show ${ex.techniquesUsed.join(", ")} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
writeFileSync("packs/sudoku9-expert.json", JSON.stringify({ id: "sudoku9-expert", game: "sudoku", size: 9, difficulty: "Expert", puzzles: [{ id: "sudoku9-expert-1", ...ex }] }, null, 1));
console.log("Saved packs/sudoku9-tricks.json and packs/sudoku9-expert.json");
