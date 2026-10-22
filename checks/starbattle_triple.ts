// Triple Star Battle check (12×12, 3 stars): every puzzle has exactly one answer, the stored answer is it, and
// pressing Hint over and over from an empty board finishes it with no wrong move, never stuck, each hint quick.
// Also: a wrong star gets a mistake hint. Run: node checks/starbattle_triple.ts
import { readFileSync } from "node:fs";
import { countAnswers } from "../engine/starbattle/countAnswers.ts";
import { hint, EMPTY, CROSS, STAR } from "../engine/starbattle/hint.ts";
import { withStars } from "../engine/starbattle/layout.ts";
import { timeLimits } from "../engine/starbattle/techniques.ts";

// Lifted: every Triple hint must be quick on its own, never cut short by a time limit (so phones get the same hints).
timeLimits.whatIfMs = timeLimits.fullMs = Infinity;

const MAX_MS = 600; // picked under 400ms; some room for a busy machine
const pack = JSON.parse(readFileSync("packs/starbattle12-triple-expert.json", "utf8"));
let bad = 0;
if (pack.puzzles.length !== 10 || pack.stars !== 3) { bad++; console.log("FAIL pack shape"); }
for (const p of pack.puzzles) {
  const n = p.regions.length, regions = withStars(p.regions, 3);
  const found: number[][][] = [];
  const answers = countAnswers(p.regions, 3, 2, found);
  const b = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  let presses = 0, slowest = 0, wrong = 0, end = "";
  for (; presses < 600; presses++) {
    const t = performance.now();
    const h = hint(b.map((r) => [...r]), regions, p.solution);
    slowest = Math.max(slowest, performance.now() - t);
    if (h.kind !== "step") { end = h.kind; break; }
    if (h.star) { if (!p.solution[h.star[0]].includes(h.star[1])) wrong++; b[h.star[0]][h.star[1]] = STAR; }
    for (const [r, c] of h.cross) { if (p.solution[r].includes(c)) wrong++; b[r][c] = CROSS; }
    if (b.flat().filter((v) => v === STAR).length === n * 3) { end = "solved"; break; }
  }
  const w = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  w[0][[...Array(n).keys()].find((c) => !p.solution[0].includes(c))!] = STAR;
  const m = hint(w, regions, p.solution);
  const ok = answers === 1 && JSON.stringify(found[0]) === JSON.stringify(p.solution) && end === "solved" && wrong === 0
    && slowest < MAX_MS && m.kind === "mistake";
  if (!ok) bad++;
  console.log(`${p.id}: ${ok ? "ok" : "FAIL"} · answers ${answers} · ${presses + 1} hints, ${end}, ${wrong} wrong · slowest ${Math.round(slowest)}ms · wrong star → ${m.kind}`);
}
console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
