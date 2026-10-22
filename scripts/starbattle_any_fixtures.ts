// Make the fixed test boards for checks/starbattle_any.ts (seeded, so they never change): 5×5 and 6×6 with 1 star,
// 9×9 with 2, 12×12 with 3, and an 11×11 2-star one our tricks can't finish (hints must say "stuck", never guess).
// Run: node scripts/starbattle_any_fixtures.ts
import { writeFileSync } from "node:fs";
import { makeAny, seeded } from "../engine/starbattle/makeAny.ts";

const want: [number, number, number][] = [[5, 1, 1], [6, 1, 2], [9, 2, 4], [12, 3, 7], [11, 2, 6]];
const boards = want.map(([n, k, seed]) => {
  const p = makeAny(n, k, { rng: seeded(seed), maxTries: 400 })!;
  console.log(`${n}×${n} ${k} star: ${p.level}`);
  return { id: `test-${n}x${n}-${k}`, size: n, stars: k, regions: p.regions, solution: p.solution, level: p.level };
});
writeFileSync("checks/starbattle_any_fixtures.json", JSON.stringify(boards, null, 1));
