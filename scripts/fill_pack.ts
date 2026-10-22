// Top a pack up to a number of puzzles, keeping the ones already in it (saves and solves point at puzzle numbers).
// Run: node scripts/fill_pack.ts sudoku medium 10   ·   node scripts/fill_pack.ts starbattle expert 10
import { readFileSync, writeFileSync } from "node:fs";
import { makeEasy as sudokuEasy, makeLevel } from "../engine/sudoku/makePuzzle.ts";
import { makeEasy as starEasy, makePuzzle } from "../engine/starbattle/makePuzzle.ts";
import { grade } from "../engine/starbattle/grade.ts";

const [game, level, want] = [process.argv[2], process.argv[3], Number(process.argv[4] || 10)];
const FILES: Record<string, string> = {
  "sudoku/easy": "packs/sudoku9-easy-starter.json", "starbattle/easy": "packs/starbattle8-easy-starter.json",
  "sudoku/medium": "packs/sudoku9-medium.json", "sudoku/hard": "packs/sudoku9-hard.json",
  "sudoku/expert": "packs/sudoku9-expert.json", "starbattle/expert": "packs/starbattle8-expert.json",
};
// Each level must show its own trick at least once (same rule as the first puzzle of each pack).
const SUDOKU_TRICKS: Record<string, string[]> = { medium: ["Pointing"], hard: ["Pairs"], expert: ["X-wing", "Y-wing"] };
// A hint must never show a trick from a harder level (a Medium once showed a Y-wing).
const ABOVE: Record<string, string[]> = { easy: ["Pointing", "Claiming", "Pairs", "Hidden pairs", "X-wing", "Y-wing"], medium: ["Pairs", "Hidden pairs", "X-wing", "Y-wing"], hard: ["X-wing", "Y-wing"] };
const file = FILES[`${game}/${level}`];
if (!file) throw new Error(`no pack for ${game}/${level}`);
const pack = JSON.parse(readFileSync(file, "utf8"));
const Level = level[0].toUpperCase() + level.slice(1);

// Star Battle Expert: of 6 tries keep the toughest (most "What if" moves, then most group moves), like puzzle 1.
function starExpert() {
  const tough = (regions: string[]) => {
    const steps = grade(regions).steps;
    return steps.filter((s) => s.technique === "What if").length * 10
      + steps.filter((s) => /regions|rows|columns/.test(s.technique) && /\d/.test(s.technique)).length;
  };
  const best = Array.from({ length: 6 }, () => makePuzzle("Expert", 8)).map((p) => ({ p, score: tough(p.regions) }))
    .sort((a, b) => b.score - a.score)[0].p;
  const { tries, ...puzzle } = best;
  return puzzle;
}

const seen = new Set(pack.puzzles.map((p: any) => JSON.stringify(p.givens ?? p.regions)));
while (pack.puzzles.length < want) {
  const t0 = Date.now();
  const p: any = game === "sudoku" ? (level === "easy" ? sudokuEasy() : makeLevel(Level as any, SUDOKU_TRICKS[level])!)
    : level === "easy" ? (({ tries, ...q }) => q)(starEasy()) : starExpert();
  const k = JSON.stringify(p.givens ?? p.regions);
  if (seen.has(k) || p.techniquesUsed.some((t: string) => (ABOVE[level] ?? []).includes(t))) continue;
  seen.add(k);
  const n = pack.puzzles.length + 1;
  pack.puzzles.push({ id: `${pack.id.replace(/-starter$/, "")}-${n}`, ...p });
  writeFileSync(file, JSON.stringify(pack, null, 1)); // save as we go
  console.log(`${game} ${level} #${n} · ${p.techniquesUsed.join(", ")} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
console.log(`${file}: ${pack.puzzles.length} puzzles`);
