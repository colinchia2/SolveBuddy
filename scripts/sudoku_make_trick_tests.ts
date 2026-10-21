// Make the trick tests (one puzzle per harder trick, where following the hints shows that trick) and
// 1 full Expert puzzle. Run: node scripts/sudoku_make_trick_tests.ts
// Each test starts right at its trick (Colin, 10/21: "skip me to the spot"): the easy numbers before it are
// already filled in, so the very first hint names the trick.
import { writeFileSync } from "node:fs";
import { makeLevel } from "../engine/sudoku/makePuzzle.ts";
import { type Grid } from "../engine/sudoku/fullGrid.ts";
import { hint, playHints } from "../engine/sudoku/hint.ts";

// Follow placing hints until the first hint is the trick. Null if a pencil-mark hint comes first.
function skipTo(givens: Grid, solution: Grid, trick: string) {
  const b = givens.map((r) => [...r]);
  for (let i = 0; i < 81; i++) {
    const h = hint(b, solution);
    if (h.kind !== "step" || h.pencil && h.technique !== trick) return null;
    if (h.technique === trick) return playHints(b, solution).solved ? b : null;
    b[h.target![0]][h.target![1]] = h.value;
  }
  return null;
}

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
  for (let tries = 0; ; tries++) {
    if (tries === 50) throw new Error(`No ${t.trick} test found`);
    const p = makeLevel(t.level, [t.trick], 3000);
    const start = p && skipTo(p.givens, p.solution, t.trick);
    if (!p || !start) continue;
    const clues = start.flat().filter((v) => v).length;
    console.log(`${t.trick}: starts with ${clues} numbers · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    puzzles.push({ id: `sudoku9-trick-${i + 1}`, label: `Test: ${t.trick}`, trick: t.trick, ...p, givens: start, clues });
    break;
  }
}
writeFileSync("packs/sudoku9-tricks.json", JSON.stringify({ id: "sudoku9-tricks", game: "sudoku", size: 9, difficulty: "Tricks", puzzles }, null, 1));

// The Expert puzzle is only remade when asked: node scripts/sudoku_make_trick_tests.ts --expert
if (process.argv.includes("--expert")) {
const t0 = Date.now();
const ex = makeLevel("Expert", ["X-wing", "Y-wing"], 3000)!;
console.log(`Expert: ${ex.clues} numbers · hints show ${ex.techniquesUsed.join(", ")} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
writeFileSync("packs/sudoku9-expert.json", JSON.stringify({ id: "sudoku9-expert", game: "sudoku", size: 9, difficulty: "Expert", puzzles: [{ id: "sudoku9-expert-1", ...ex }] }, null, 1));
}
console.log("Saved the trick tests");
