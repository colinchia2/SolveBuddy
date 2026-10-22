// Snapshot of how every one-star puzzle grades and hints, so engine changes for Double Star Battle can be checked
// against it: node checks/starbattle_one_star_snapshot.ts > before.json, change the engine, run again, compare.
import { readFileSync } from "node:fs";
import { grade, solveWith } from "../engine/starbattle/grade.ts";
import { hint } from "../engine/starbattle/hint.ts";
import { EMPTY, CROSS, STAR } from "../engine/starbattle/techniques.ts";

const out: any[] = [];
for (const f of ["starbattle8-easy-starter.json", "starbattle8-expert.json"]) {
  for (const p of JSON.parse(readFileSync(`packs/${f}`, "utf8")).puzzles) {
    const g = grade(p.regions);
    out.push({ id: p.id, level: g.level, steps: g.steps });
    // Hints on a part-solved board, and with a wrong star and a wrong cross.
    const n = p.regions.length, half = solveWith(p.regions).steps.slice(0, 12);
    const b = Array.from({ length: n }, () => Array(n).fill(EMPTY));
    for (const s of half) { if (s.star) b[s.star[0]][s.star[1]] = STAR; for (const [r, c] of s.cross) b[r][c] = CROSS; }
    out.push(hint(b.map((r) => [...r]), p.regions, p.solution));
    const w = b.map((r) => [...r]);
    const r0 = w.findIndex((row, r) => row.some((v, c) => v === EMPTY && p.solution[r] !== c));
    if (r0 >= 0) { w[r0][w[r0].findIndex((v, c) => v === EMPTY && p.solution[r0] !== c)] = STAR; out.push(hint(w, p.regions, p.solution)); }
  }
}
console.log(JSON.stringify(out));
