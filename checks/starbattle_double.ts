// Double Star Battle check: every puzzle has exactly one answer, the stored answer is it, and pressing Hint
// over and over from an empty board finishes it with no mistakes or "stuck". Also: a wrong star gets a reason.
// Run: node checks/starbattle_double.ts
import { readFileSync } from "node:fs";
import { countDouble } from "../engine/starbattle/makeDouble.ts";
import { hint, EMPTY, CROSS, STAR } from "../engine/starbattle/hint.ts";

const pack = JSON.parse(readFileSync("packs/starbattle10-double-expert.json", "utf8"));
let bad = 0;
for (const p of pack.puzzles) {
  const found: number[][][] = [];
  const answers = countDouble(p.regions, 2, found);
  const n = p.regions.length;
  const b = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  let presses = 0, problem = "";
  for (; presses < 400; presses++) {
    const h = hint(b.map((r) => [...r]), p.regions, p.solution);
    if (h.kind !== "step") { problem = `${h.kind}: ${h.explain}`; break; }
    if (h.star) b[h.star[0]][h.star[1]] = STAR;
    for (const [r, c] of h.cross) b[r][c] = CROSS;
    if (b.flat().filter((v) => v === STAR).length === n * 2) break;
  }
  const solved = p.solution.every((cols: number[], r: number) => cols.every((c) => b[r][c] === STAR));
  // A wrong star in an empty board: the hint must call it a mistake and say why.
  const w = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  const c0 = [...Array(n).keys()].find((c) => !p.solution[0].includes(c))!;
  w[0][c0] = STAR;
  const m = hint(w, p.regions, p.solution);
  const ok = answers === 1 && JSON.stringify(found[0]) === JSON.stringify(p.solution) && solved && m.kind === "mistake";
  if (!ok) bad++;
  console.log(`${p.id}: ${ok ? "ok" : "FAIL"} · answers ${answers} · ${presses + 1} hints${problem ? ` · ${problem}` : ""} · wrong star: ${m.explain}`);
}
console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
