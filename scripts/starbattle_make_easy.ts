// Make 5 Easy 8×8 Star Battles, print them, and save them as a pack.
// Run: node scripts/starbattle_make_easy.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { makeEasy } from "../engine/starbattle/makePuzzle.ts";

const puzzles = Array.from({ length: 5 }, (_, i) => ({ id: `starbattle8-easy-${i + 1}`, ...makeEasy(8) }));
puzzles.forEach((p, i) => {
  console.log(`\nPuzzle ${i + 1}: took ${p.tries} tries · tricks: ${p.techniquesUsed.join(", ")}`);
  p.regions.forEach((row, r) => console.log("  " + [...row].map((l, c) => (p.solution[r] === c ? "*" : l)).join(" ")));
});
const pack = { id: "starbattle8-easy-starter", game: "starbattle", size: 8, difficulty: "Easy",
  puzzles: puzzles.map(({ tries, ...p }) => p) };
mkdirSync("packs", { recursive: true });
writeFileSync("packs/starbattle8-easy-starter.json", JSON.stringify(pack, null, 1));
console.log("\nSaved to packs/starbattle8-easy-starter.json  (* = where the answer's star is)");
