// Make 8 Expert 8×8 Star Battles and keep the toughest one (most "What if" moves, then most group moves).
// Run: node scripts/starbattle_make_expert.ts
import { writeFileSync } from "node:fs";
import { makePuzzle } from "../engine/starbattle/makePuzzle.ts";
import { grade } from "../engine/starbattle/grade.ts";

const toughness = (regions: string[]) => {
  const steps = grade(regions).steps;
  const whatIf = steps.filter((s) => s.technique === "What if").length;
  const group = steps.filter((s) => /regions|rows|columns/.test(s.technique) && /\d/.test(s.technique)).length;
  return { whatIf, group, score: whatIf * 10 + group };
};

const candidates = Array.from({ length: 8 }, () => makePuzzle("Expert", 8)).map((p) => ({ ...p, ...toughness(p.regions) }));
candidates.forEach((c, i) => console.log(`candidate ${i + 1}: What if ×${c.whatIf}, groups ×${c.group}`));
const best = candidates.sort((a, b) => b.score - a.score)[0];

console.log(`\nKept: What if ×${best.whatIf}, groups ×${best.group} · tricks: ${best.techniquesUsed.join(", ")}`);
best.regions.forEach((row, r) => console.log("  " + [...row].map((l, c) => (best.solution[r] === c ? "*" : l)).join(" ")));
const { tries, whatIf, group, score, ...puzzle } = best;
const pack = { id: "starbattle8-expert", game: "starbattle", size: 8, difficulty: "Expert",
  puzzles: [{ id: "starbattle8-expert-1", ...puzzle }] };
writeFileSync("packs/starbattle8-expert.json", JSON.stringify(pack, null, 1));
console.log("\nSaved to packs/starbattle8-expert.json  (* = where the answer's star is)");
