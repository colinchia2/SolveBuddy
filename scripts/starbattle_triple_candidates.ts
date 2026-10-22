// Make 12×12 3-star Star Battle candidates for the Triple pack and score each one: does Hint alone finish it from an
// empty board (no wrong move, never stuck), how slow is its slowest hint, does it need What if. One JSON line each.
// Run: node scripts/starbattle_triple_candidates.ts <minutes> > candidates.jsonl   (scripts/starbattle_make_triple.ts picks 10)
import { makeAny } from "../engine/starbattle/makeAny.ts";
import { hint, EMPTY, CROSS, STAR } from "../engine/starbattle/hint.ts";
import { withStars } from "../engine/starbattle/layout.ts";
import { timeLimits } from "../engine/starbattle/techniques.ts";

// No time limits here: a pack puzzle must be quick without them, so it plays the same on any phone.
timeLimits.whatIfMs = timeLimits.fullMs = Infinity;

const N = 12, K = 3;
const until = Date.now() + Number(process.argv[2] || 5) * 60000;
while (Date.now() < until) {
  const p = makeAny(N, K, { maxTries: 300 });
  if (!p || p.level === "Too hard") continue;
  const regions = withStars(p.regions, K);
  const b = Array.from({ length: N }, () => Array(N).fill(EMPTY));
  let slowest = 0, end = "", wrong = 0, presses = 0, whatIfs = 0;
  for (; presses < 600; presses++) {
    const t = performance.now();
    const h = hint(b.map((r) => [...r]), regions, p.solution);
    slowest = Math.max(slowest, performance.now() - t);
    if (slowest > 1500) { end = "slow"; break; }
    if (h.kind !== "step") { end = h.kind; break; }
    if (h.technique === "What if") whatIfs++;
    if (h.star) { if (!p.solution[h.star[0]].includes(h.star[1])) wrong++; b[h.star[0]][h.star[1]] = STAR; }
    for (const [r, c] of h.cross) { if (p.solution[r].includes(c)) wrong++; b[r][c] = CROSS; }
    if (b.flat().filter((v) => v === STAR).length === N * K) { end = "solved"; break; }
  }
  console.log(JSON.stringify({ regions: p.regions, solution: p.solution, level: p.level, techniquesUsed: p.techniquesUsed,
    end, wrong, presses: presses + 1, slowest: Math.round(slowest), whatIfs }));
}
