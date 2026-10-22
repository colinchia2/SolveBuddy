// Snapshot of how every packed Star Battle (one-star and Double) grades and hints. Engine changes must leave it
// byte-identical: node checks/starbattle_snapshot.ts > before.json, change the engine, run again, compare.
// starbattle_any.ts does that comparison against checks/starbattle_snapshot.json.
import { readFileSync } from "node:fs";
import { grade, solveWith } from "../engine/starbattle/grade.ts";
import { hint } from "../engine/starbattle/hint.ts";
import { isAnswer } from "../engine/starbattle/layout.ts";
import { EMPTY, CROSS, STAR } from "../engine/starbattle/techniques.ts";

export function snapshot() {
  const out: any[] = [];
  // The puzzles that existed when the snapshot was taken (packs only grow at the end, so later ones don't change it).
  const SNAP: [string, number][] = [["starbattle8-easy-starter.json", 5], ["starbattle8-expert.json", 10], ["starbattle10-double-expert.json", 10]];
  for (const [f, count] of SNAP) {
    for (const p of JSON.parse(readFileSync(`packs/${f}`, "utf8")).puzzles.slice(0, count)) {
      const g = grade(p.regions);
      out.push({ id: p.id, level: g.level, steps: g.steps });
      const all = solveWith(p.regions).steps;
      for (const depth of [0, 12, 30]) {
        const n = p.regions.length;
        const b = Array.from({ length: n }, () => Array(n).fill(EMPTY));
        for (const s of all.slice(0, depth)) { if (s.star) b[s.star[0]][s.star[1]] = STAR; for (const [r, c] of s.cross) b[r][c] = CROSS; }
        out.push(hint(b.map((r) => [...r]), p.regions, p.solution));
        // ...and with one wrong star added.
        const w = b.map((r) => [...r]);
        const r0 = w.findIndex((row, r) => row.some((v, c) => v === EMPTY && !isAnswer(p.solution, r, c)));
        if (r0 >= 0) { w[r0][w[r0].findIndex((v, c) => v === EMPTY && !isAnswer(p.solution, r0, c))] = STAR; out.push(hint(w, p.regions, p.solution)); }
      }
    }
  }
  return out;
}
if (import.meta.main) console.log(JSON.stringify(snapshot()));
