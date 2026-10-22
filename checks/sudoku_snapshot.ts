// Snapshot of how every classic Sudoku pack grades and plays by hints. Variant work (Killer, Thermo, 10/22) must
// leave it byte-identical: sudoku_variants.ts compares its hash with checks/sudoku_snapshot.sha256.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { grade } from "../engine/sudoku/grade.ts";
import { playHints } from "../engine/sudoku/hint.ts";

// The puzzles that existed when the snapshot was taken (packs only grow at the end).
const SNAP: [string, number][] = [["sudoku9-easy-starter.json", 10], ["sudoku9-medium.json", 10], ["sudoku9-hard.json", 10],
  ["sudoku9-expert.json", 10], ["sudoku9-tricks.json", 6]];
export function snapshot() {
  const out: any[] = [];
  for (const [f, count] of SNAP) {
    for (const p of JSON.parse(readFileSync(`packs/${f}`, "utf8")).puzzles.slice(0, count)) {
      const g = grade(p.givens);
      const play = playHints(p.givens, p.solution);
      out.push({ id: p.id, level: g.level, steps: g.steps, shown: play.shown, solved: play.solved });
    }
  }
  return out;
}
export const snapshotHash = () => createHash("sha256").update(JSON.stringify(snapshot())).digest("hex");
if (import.meta.main ?? process.argv[1]?.endsWith("sudoku_snapshot.ts")) console.log(snapshotHash());
