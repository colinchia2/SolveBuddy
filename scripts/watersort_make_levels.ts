// Make the Water Sort Starter levels: 10 each of Easy (4–5 colours), Medium (6–7) and Hard (9–10), 2 empty tubes.
// Every level is checked solvable by the solver; colours grow through each pack.
// Run: node scripts/watersort_make_levels.ts
import { writeFileSync } from "node:fs";
import { makeLevel } from "../engine/watersort/makeLevel.ts";

const LEVELS: [string, string, string, number[]][] = [
  ["easy", "Easy", "4–5 colours", [4, 4, 4, 4, 4, 5, 5, 5, 5, 5]],
  ["medium", "Medium", "6–7 colours", [6, 6, 6, 6, 6, 7, 7, 7, 7, 7]],
  ["hard", "Hard", "9–10 colours", [9, 9, 9, 9, 9, 10, 10, 10, 10, 10]],
];
const seen = new Set<string>();
for (const [key, difficulty, sizeLabel, colours] of LEVELS) {
  const id = `watersort-${key}`;
  const puzzles = colours.map((c, i) => {
    for (;;) {
      const L = makeLevel(c)!;
      const k = JSON.stringify(L.tubes);
      if (seen.has(k)) continue;
      seen.add(k);
      return { id: `${id}-${i + 1}`, ...L };
    }
  });
  writeFileSync(`packs/${id}.json`, JSON.stringify({ id, game: "watersort", difficulty, sizeLabel, puzzles }, null, 1));
  console.log(`packs/${id}.json: ${puzzles.length} levels · moves ${puzzles.map((p) => p.moves).join(" ")}`);
}
