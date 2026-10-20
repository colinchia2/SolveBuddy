// Put the steps together: place stars → grow regions → repair until there's exactly one answer →
// keep only if the regions are evenly sized and the easy tricks can solve it. Otherwise start again.
import { placeStars, growRegions, repair, regionSizes, type Regions, type Stars } from "./layout.ts";
import { countSolutions } from "./countSolutions.ts";
import { grade } from "./grade.ts";

export const MIN_REGION = 3; // no tiny regions that hand you a free star
export const MAX_REGION = 14; // no giant region swallowing the board (8×8 averages 8 per region)

export type Puzzle = { regions: Regions; solution: Stars; techniquesUsed: string[]; tries: number };

export function makeEasy(n = 8): Puzzle {
  for (let tries = 1; ; tries++) {
    const solution = placeStars(n);
    const regions = repair(growRegions(solution), solution, (r, found) => countSolutions(r, 2, found));
    if (!regions) continue;
    const { min, max } = regionSizes(regions);
    if (min < MIN_REGION || max > MAX_REGION) continue;
    const g = grade(regions);
    if (g.level !== "Easy") continue;
    return { regions, solution, techniquesUsed: [...new Set(g.steps.map((s) => s.technique))], tries };
  }
}
