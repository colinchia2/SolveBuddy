// Snapshot of how the Easy Killer and Easy Thermo packs play by hints. Expert variant work (45 rule etc., 10/22) must
// leave it byte-identical: sudoku_variants.ts compares its hash with checks/sudoku_variants_snapshot.sha256.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { playHints } from "../engine/sudoku/hint.ts";
import { rulesOf } from "../engine/sudoku/variants.ts";

export function snapshot() {
  const out: any[] = [];
  for (const f of ["sudoku9-killer-easy.json", "sudoku9-thermo-easy.json"]) {
    for (const p of JSON.parse(readFileSync(`packs/${f}`, "utf8")).puzzles.slice(0, 5)) {
      const play = playHints(p.givens, p.solution, 400, rulesOf(p));
      out.push({ id: p.id, shown: play.shown, solved: play.solved });
    }
  }
  return out;
}
export const snapshotHash = () => createHash("sha256").update(JSON.stringify(snapshot())).digest("hex");
if (process.argv[1]?.endsWith("sudoku_variants_snapshot.ts")) console.log(snapshotHash());
