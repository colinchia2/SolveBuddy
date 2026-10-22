// Pick the Triple pack (12×12, 3 stars per row, column and region; Colin 10/22) from candidate files made by
// scripts/starbattle_triple_candidates.ts. Keeps only puzzles Hint alone finishes (no wrong move, never stuck) with
// every hint under MAX_MS, prefers ones that need What if (Expert), then the quickest hints. Only What if has a time
// limit (450ms), so a puzzle that needs it must stay under WHAT_IF_MAX_MS here: a phone up to 3× slower still never hits
// the limit and gets the same hints. (Candidates are timed with the limits off.)
// Run: node scripts/starbattle_make_triple.ts candidates1.jsonl candidates2.jsonl …
import { readFileSync, writeFileSync } from "node:fs";
import { countAnswers } from "../engine/starbattle/countAnswers.ts";
import { regionSizes } from "../engine/starbattle/layout.ts";

const MAX_MS = 400, WHAT_IF_MAX_MS = 150, WANT = 10;
const all = process.argv.slice(2).flatMap((f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const good = all.filter((c) => c.level !== "Easy" && c.end === "solved" && c.wrong === 0 && c.slowest < (c.whatIfs ? WHAT_IF_MAX_MS : MAX_MS) && regionSizes(c.regions).min >= 3
  && countAnswers(c.regions, 3, 2) === 1);
const seen = new Set<string>();
const picked = good.sort((a, b) => (b.whatIfs > 0 ? 1 : 0) - (a.whatIfs > 0 ? 1 : 0) || a.slowest - b.slowest)
  .filter((c) => !seen.has(c.regions.join()) && seen.add(c.regions.join())).slice(0, WANT);
console.log(`${all.length} candidates, ${good.length} pass, kept ${picked.length}:`);
picked.forEach((c, i) => console.log(`  #${i + 1} ${c.level} · What if ×${c.whatIfs} · ${c.presses} hints · slowest ${c.slowest}ms`));
if (picked.length < WANT) throw new Error(`only ${picked.length} good puzzles: make more candidates`);
const pack = { id: "starbattle12-triple-expert", game: "starbattle", size: 12, stars: 3, difficulty: "Expert",
  puzzles: picked.map((c, i) => ({ id: `starbattle12-triple-expert-${i + 1}`, regions: c.regions, solution: c.solution, techniquesUsed: c.techniquesUsed })) };
writeFileSync("packs/starbattle12-triple-expert.json", JSON.stringify(pack, null, 1));
console.log("Saved to packs/starbattle12-triple-expert.json");
