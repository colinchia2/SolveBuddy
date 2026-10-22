// Star Battle for imports (Colin, 10/22): any size 5–12, 1–3 stars. Checks, on fixed boards
// (scripts/starbattle_any_fixtures.ts): one answer each; pressing Hint from an empty board only ever places answer
// stars and crosses non-answer cells, and either finishes or says "stuck" (never a wrong move); each hint stays quick;
// a wrong star gets a mistake hint. Also: packed puzzles still grade and hint byte-identically (snapshot hash).
// Run: node checks/starbattle_any.ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { countAnswers } from "../engine/starbattle/countAnswers.ts";
import { hint, EMPTY, CROSS, STAR } from "../engine/starbattle/hint.ts";
import { withStars } from "../engine/starbattle/layout.ts";
import { snapshot } from "./starbattle_snapshot.ts";

let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };

for (const p of JSON.parse(readFileSync("checks/starbattle_any_fixtures.json", "utf8"))) {
  const regions = withStars([...p.regions], p.stars), n = p.size;
  const found: number[][][] = [];
  check(`${p.id}: exactly one answer, the stored one`, countAnswers(regions, p.stars, 2, found) === 1 && JSON.stringify(found[0]) === JSON.stringify(p.solution));
  const b = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  let wrong = 0, slowest = 0, end = "";
  for (let i = 0; i < 600; i++) {
    const t = performance.now();
    const h = hint(b.map((r) => [...r]), regions, p.solution);
    slowest = Math.max(slowest, performance.now() - t);
    if (h.kind !== "step") { end = h.kind; break; }
    if (h.star) { if (!p.solution[h.star[0]].includes(h.star[1])) wrong++; b[h.star[0]][h.star[1]] = STAR; }
    for (const [r, c] of h.cross) { if (p.solution[r].includes(c)) wrong++; b[r][c] = CROSS; }
    if (b.flat().filter((v) => v === STAR).length === n * p.stars) { end = "solved"; break; }
  }
  // A "Too hard" board may end stuck, or solved now that a stuck hint retries with fuller chains (10/22); never wrong.
  const ok = p.level === "Too hard" ? ["stuck", "solved"].includes(end) : end === "solved";
  check(`${p.id}: Hint never makes a wrong move and ends ${p.level === "Too hard" ? "stuck or solved" : "solved"} (got ${end}, ${wrong} wrong)`, wrong === 0 && ok);
  const cap = p.level === "Too hard" ? 1300 : 600; // a stuck-then-fuller hint gets two short budgets
  check(`${p.id}: slowest hint ${Math.round(slowest)}ms (< ${cap})`, slowest < cap);
  const w = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  w[0][[...Array(n).keys()].find((c) => !p.solution[0].includes(c))!] = STAR;
  check(`${p.id}: a wrong star gets a mistake hint`, hint(w, regions, p.solution).kind === "mistake");
}

const hash = createHash("sha256").update(JSON.stringify(snapshot())).digest("hex");
check("packed Star Battles (single and Double) grade and hint exactly as before", hash === readFileSync("checks/starbattle_snapshot.sha256", "utf8").trim());

process.exit(failed ? 1 : 0);
