// Water Sort check: every level has 4 of each colour, no tube starts finished, no repeats, the solver finishes it,
// and following the Hint button's move from the start solves it.
// Run: node checks/watersort.ts
import { readFileSync } from "node:fs";
import { CAP, isDone, isSolved, moves, pour, stateKey } from "../engine/watersort/rules.ts";
import { par } from "../engine/watersort/par.ts";
import { solve, tidiestMove } from "../engine/watersort/solve.ts";
import { explain } from "../engine/watersort/explain.ts";

// Every hint says why (Colin, 10/22): a nudge and a reason, short, and never a move count.
const why = (s: string[][], plan: [number, number][]) => explain(s, plan, (c) => `colour ${c}`);
let explained = 0, ledOn = 0, badText = 0;

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
      const w = why(s, sol.kind === "solved" ? sol.path : [m]);
      explained++;
      if (/ (Then|Soon) /.test(w.body)) ledOn++;
      if (!w.nudge || !w.body || /moves to go/.test(w.body) || w.body.length > 180) badText++;
      s = pour(s, ...m);
    }
    const ok = fair && fresh && isSolved(s);
    if (!ok) bad++;
    console.log(`${p.id}: ${ok ? "ok" : "FAIL"} · ${p.colors} colours · ${presses} hints · slowest ${Math.round(slowest)}ms`);
  }
}
console.log(`hint reasons: ${explained} hints, ${ledOn} say what comes next, ${badText} bad`);
if (badText) bad++;

// Par (Colin 10/27, S17): every pack level gets one, fast, never more than the solver's own path; on the Easy levels
// a plain breadth-first search (the slow sure way) agrees it's the fewest.
const bfs = (start: string[][]) => {
  let layer = [start], d = 0;
  const seenB = new Set([stateKey(start)]);
  while (layer.length) {
    if (layer.some(isSolved)) return d;
    const next: string[][][] = [];
    for (const st of layer) for (const m of moves(st)) { const n = pour(st, ...m), k = stateKey(n); if (!seenB.has(k)) { seenB.add(k); next.push(n); } }
    layer = next; d++;
  }
  return -1;
};
let parBad = 0, parSlow = 0;
for (const level of ["easy", "medium", "hard"]) {
  for (const p of JSON.parse(readFileSync(`packs/watersort-${level}.json`, "utf8")).puzzles) {
    const t0 = performance.now(), n = par(p.tubes);
    parSlow = Math.max(parSlow, performance.now() - t0);
    if (n === null || n > p.moves || (level === "easy" && bfs(p.tubes) !== n)) { parBad++; console.log(`${p.id}: par ${n} FAIL`); }
  }
}
console.log(`par: 30 levels, ${parBad} wrong, slowest ${Math.round(parSlow)}ms`);
if (parBad || parSlow > 500) bad++;
console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
