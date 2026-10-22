// Water Sort check: every level has 4 of each colour, no tube starts finished, no repeats, the solver finishes it,
// and following the Hint button's move from the start solves it.
// Run: node checks/watersort.ts
import { readFileSync } from "node:fs";
import { CAP, isDone, isSolved, pour } from "../engine/watersort/rules.ts";
import { solve, tidiestMove } from "../engine/watersort/solve.ts";

let bad = 0;
const seen = new Set<string>();
for (const key of ["easy", "medium", "hard"]) {
  const pack = JSON.parse(readFileSync(`packs/watersort-${key}.json`, "utf8"));
  for (const p of pack.puzzles) {
    const counts: Record<string, number> = {};
    for (const c of p.tubes.flat()) counts[c] = (counts[c] ?? 0) + 1;
    const fair = Object.keys(counts).length === p.colors && Object.values(counts).every((n) => n === CAP);
    const fresh = !p.tubes.some((t: string[]) => t.length && isDone(t)) && !seen.has(JSON.stringify(p.tubes));
    seen.add(JSON.stringify(p.tubes));
    // Press Hint, do its move, repeat (as a player following hints would), timing the slowest.
    let s = p.tubes, presses = 0, slowest = 0;
    for (; presses < 300 && !isSolved(s); presses++) {
      const t0 = performance.now();
      const sol = solve(s, 20000);
      const m = sol.kind === "solved" ? sol.path[0] : sol.kind === "unsure" ? tidiestMove(s) : null;
      slowest = Math.max(slowest, performance.now() - t0);
      if (!m) break;
      s = pour(s, ...m);
    }
    const ok = fair && fresh && isSolved(s);
    if (!ok) bad++;
    console.log(`${p.id}: ${ok ? "ok" : "FAIL"} · ${p.colors} colours · ${presses} hints · slowest ${Math.round(slowest)}ms`);
  }
}
console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
