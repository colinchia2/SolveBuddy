// Killer and Thermo Sudoku (Colin, 10/22): every puzzle has exactly one answer under its extra rules, needs them
// (without them there's more than one answer), Hint alone solves it with no wrong numbers and only Easy classic
// tricks plus the variant ones, and a variant hint comes up early. Classic packs must grade and hint as before.
// Run: node checks/sudoku_variants.ts
import { readFileSync } from "node:fs";
import { countSolutions } from "../engine/sudoku/countSolutions.ts";
import { hint, playHints } from "../engine/sudoku/hint.ts";
import { rulesOf, variantClashes } from "../engine/sudoku/variants.ts";
import { snapshotHash } from "./sudoku_snapshot.ts";

let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };
const HARDER = ["Pointing", "Claiming", "Pairs", "Hidden pairs", "X-wing", "Y-wing"];
const VARIANT = ["Last cell in cage", "Cage sum", "Cage digits", "Thermo order"];

for (const v of ["killer", "thermo"]) {
  const pack = JSON.parse(readFileSync(`packs/sudoku9-${v}-easy.json`, "utf8"));
  check(`${v}: 5 Easy puzzles`, pack.puzzles.length === 5 && pack.difficulty === "Easy");
  for (const p of pack.puzzles) {
    const rules = rulesOf(p)!;
    const found: number[][][] = [];
    check(`${p.id}: one answer with the ${v} rules, and it's the stored one`, countSolutions(p.givens, 2, found, rules) === 1 && JSON.stringify(found[0]) === JSON.stringify(p.solution));
    check(`${p.id}: the ${v} rules are needed (more than one answer without them)`, countSolutions(p.givens) > 1);
    check(`${p.id}: the answer breaks no ${v} rule`, variantClashes(p.solution, rules).size === 0);
    const play = playHints(p.givens, p.solution, 400, rules);
    const wrong = play.shown.filter((h) => h.target && h.value !== p.solution[h.target[0]][h.target[1]]).length;
    check(`${p.id}: Hint alone solves it, no wrong numbers (${play.shown.length} hints)`, play.solved && wrong === 0);
    check(`${p.id}: only Easy classic tricks plus ${v} ones`, !play.shown.some((h) => HARDER.includes(h.technique)));
    const first = play.shown.findIndex((h) => VARIANT.includes(h.technique));
    check(`${p.id}: a ${v} hint comes up early (hint ${first + 1})`, first >= 0 && first <= 4);
  }
}
// Priority: on a fresh Killer board the very first hint is a cage hint when one places a number.
const k1 = JSON.parse(readFileSync("packs/sudoku9-killer-easy.json", "utf8")).puzzles[0];
check(`killer: the first hint is a cage trick (${hint(k1.givens, k1.solution, {}, {}, rulesOf(k1)).technique})`,
  VARIANT.includes(hint(k1.givens, k1.solution, {}, {}, rulesOf(k1)).technique));
check("classic Sudoku packs grade and hint exactly as before", snapshotHash() === readFileSync("checks/sudoku_snapshot.sha256", "utf8").trim());
process.exit(failed ? 1 : 0);
