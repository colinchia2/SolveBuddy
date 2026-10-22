// Killer and Thermo Sudoku (Colin, 10/22): every puzzle has exactly one answer under its extra rules, needs them
// (without them there's more than one answer), Hint alone solves it with no wrong numbers and only Easy classic
// tricks plus the variant ones, and a variant hint comes up early. Classic packs must grade and hint as before.
// Run: node checks/sudoku_variants.ts
import { readFileSync } from "node:fs";
import { countSolutions } from "../engine/sudoku/countSolutions.ts";
import { hint, playHints, writeMarks } from "../engine/sudoku/hint.ts";
import { rulesOf, variantClashes } from "../engine/sudoku/variants.ts";
import { snapshotHash } from "./sudoku_snapshot.ts";
import { snapshotHash as variantsHash } from "./sudoku_variants_snapshot.ts";

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
check("Easy Killer and Thermo play by hints exactly as before", variantsHash() === readFileSync("checks/sudoku_variants_snapshot.sha256", "utf8").trim());

// Expert Killer (10/22): the 45 rule. (Thermo Expert comes later.)
for (const v of ["killer"]) {
  const pack = JSON.parse(readFileSync(`packs/sudoku9-${v}-expert.json`, "utf8"));
  check(`${v}: 5 Expert puzzles`, pack.puzzles.length === 5 && pack.difficulty === "Expert");
  for (const p of pack.puzzles) {
    const rules = rulesOf(p)!;
    const found: number[][][] = [];
    check(`${p.id}: one answer, the stored one; the ${v} rules are needed`, countSolutions(p.givens, 2, found, rules) === 1
      && JSON.stringify(found[0]) === JSON.stringify(p.solution) && countSolutions(p.givens) > 1 && variantClashes(p.solution, rules).size === 0);
    check(`${p.id}: ${p.clues} numbers showing (at most 4)`, p.clues <= 4);
    let slowest = 0;
    const timed = (b: number[][], m: any, c: any) => { const t0 = performance.now(); const h = hint(b, p.solution, m, c, rules); slowest = Math.max(slowest, performance.now() - t0); return h; };
    const b = p.givens.map((r: number[]) => [...r]), marks: any = {}, corners: any = {}, shown: string[] = [];
    let wrong = 0;
    for (let i = 0; i < 500; i++) {
      const h = timed(b, marks, corners);
      if (h.kind !== "step") break;
      shown.push(h.technique);
      if (!h.target) { writeMarks(h, marks, corners); continue; }
      if (h.value !== p.solution[h.target[0]][h.target[1]]) wrong++;
      b[h.target[0]][h.target[1]] = h.value;
      delete marks[`${h.target[0]},${h.target[1]}`];
    }
    const solved = b.every((row: number[], r: number) => row.every((x, c) => x === p.solution[r][c]));
    check(`${p.id}: Hint alone solves it, no wrong numbers (${shown.length} hints)`, solved && wrong === 0);
    check(`${p.id}: slowest hint ${Math.round(slowest)}ms (< 500)`, slowest < 500);
    if (v === "killer") check(`${p.id}: the 45 rule comes up ${shown.filter((s) => s === "45 rule").length}× (≥ 1)`, shown.filter((s) => s === "45 rule").length >= 1);
    else check(`${p.id}: a Thermo squeeze and a harder classic trick come up`, shown.includes("Thermo squeeze") && shown.some((s) => HARDER.includes(s)));
  }
}
process.exit(failed ? 1 : 0);
