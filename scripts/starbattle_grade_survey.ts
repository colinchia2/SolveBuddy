// How often does each grade come up? Makes 100 one-answer layouts and grades them.
// Run: node scripts/starbattle_grade_survey.ts
import { placeStars, growRegions, repair, regionSizes } from "../engine/starbattle/layout.ts";
import { countSolutions } from "../engine/starbattle/countSolutions.ts";
import { grade } from "../engine/starbattle/grade.ts";
import { MIN_REGION, MAX_REGION } from "../engine/starbattle/makePuzzle.ts";

const tally: Record<string, number> = {};
let made = 0;
const t0 = Date.now();
while (made < 100) {
  const solution = placeStars(8);
  const regions = repair(growRegions(solution), solution, (r, found) => countSolutions(r, 2, found));
  if (!regions) continue;
  const { min, max } = regionSizes(regions);
  if (min < MIN_REGION || max > MAX_REGION) continue;
  made++;
  const level = grade(regions).level;
  tally[level] = (tally[level] ?? 0) + 1;
}
console.log(tally, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
