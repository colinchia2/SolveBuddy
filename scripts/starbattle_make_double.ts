// Make Double Star Battle Experts (10×10, 2 stars each) and add them to the pack, keeping the ones already there.
// Run: node scripts/starbattle_make_double.ts 10
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { makeDouble } from "../engine/starbattle/makeDouble.ts";

const FILE = "packs/starbattle10-double-expert.json";
const want = Number(process.argv[2] || 10);
const pack = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8"))
  : { id: "starbattle10-double-expert", game: "starbattle", size: 10, stars: 2, difficulty: "Expert", puzzles: [] };
while (pack.puzzles.length < want) {
  const t0 = Date.now();
  const { tries, level, ...p } = makeDouble(["Expert"])!;
  if (pack.puzzles.some((q: any) => q.regions.join() === p.regions.join())) continue;
  pack.puzzles.push({ id: `${pack.id}-${pack.puzzles.length + 1}`, ...p });
  writeFileSync(FILE, JSON.stringify(pack, null, 1)); // save as we go
  console.log(`#${pack.puzzles.length} · ${p.techniquesUsed.join(", ")} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log(`${FILE}: ${pack.puzzles.length} puzzles`);
