// Make a Water Sort level: shuffle 4 units of each colour into full tubes, add empty tubes, and keep it only if
// no tube starts finished and the solver can finish it.
import { CAP, type State, isDone } from "./rules.ts";
import { solve } from "./solve.ts";

export const COLOURS = "ABCDEFGHIJKL"; // up to 12 colours

export type Level = { tubes: State; colors: number; moves: number };

export function makeLevel(colors: number, empty = 2, tries = Infinity): Level | null {
  for (let i = 0; i < tries; i++) {
    const units = [...COLOURS.slice(0, colors)].flatMap((c) => Array(CAP).fill(c));
    for (let j = units.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [units[j], units[k]] = [units[k], units[j]];
    }
    const tubes: State = Array.from({ length: colors }, (_, t) => units.slice(t * CAP, (t + 1) * CAP));
    // No finished tube, and no tube with 3 of a colour stacked on top (too easy a start).
    if (tubes.some((t) => isDone(t) || (t[1] === t[2] && t[2] === t[3]))) continue;
    for (let e = 0; e < empty; e++) tubes.push([]);
    const sol = solve(tubes, 200000);
    if (sol.kind !== "solved") continue;
    return { tubes, colors, moves: sol.path.length };
  }
  return null;
}
