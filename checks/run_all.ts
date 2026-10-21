// Free checks. Run before every push: npm run checks
import { makeFullGrid, isValidSolution } from "../engine/sudoku/fullGrid.ts";
import { countSolutions } from "../engine/sudoku/countSolutions.ts";
import { erase } from "../engine/sudoku/erase.ts";
import { grade } from "../engine/sudoku/grade.ts";
import { makeEasy, spread, EASY_MIN_PER, EASY_MAX_PER } from "../engine/sudoku/makePuzzle.ts";
import { hint } from "../engine/sudoku/hint.ts";
import { existsSync, readFileSync } from "node:fs";
import { placeStars, regionSizes, growRegions, repair } from "../engine/starbattle/layout.ts";
import { solveWith as sbSolveWith } from "../engine/starbattle/grade.ts";
import { countSolutions as sbCount } from "../engine/starbattle/countSolutions.ts";
import { grade as sbGrade } from "../engine/starbattle/grade.ts";
import { MIN_REGION, MAX_REGION } from "../engine/starbattle/makePuzzle.ts";
import { hint as sbHint, EMPTY as SB_EMPTY, CROSS as SB_CROSS, STAR as SB_STAR } from "../engine/starbattle/hint.ts";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

// A broken grid must be caught, or the check below proves nothing.
const broken = makeFullGrid();
[broken[0][0], broken[0][1]] = [broken[0][1], broken[0][0]];
check("validity test catches a broken grid", !isValidSolution(broken));

const grids = Array.from({ length: 200 }, makeFullGrid);
check("200 full Sudoku grids all follow the rules", grids.every(isValidSolution));
check("grids are random (no two of 200 alike)", new Set(grids.map((g) => g.join())).size === 200);

// The checker must tell 1 answer from 2+, or erasing can't be trusted.
const empty = Array.from({ length: 9 }, () => Array(9).fill(0));
check("checker: an empty grid has 2+ answers", countSolutions(empty) === 2);
check("checker: a full grid has exactly 1 answer", countSolutions(grids[0]) === 1);
const clash = grids[0].map((r) => [...r]);
clash[0][0] = clash[0][1]; // same number twice in a row
check("checker: a rule-breaking grid has 0 answers", countSolutions(clash) === 0);

const erased = Array.from({ length: 10 }, () => {
  const solution = makeFullGrid();
  const { puzzle } = erase(solution, 0);
  const keepsGivens = puzzle.every((row, r) => row.every((n, c) => n === 0 || n === solution[r][c]));
  return keepsGivens && countSolutions(puzzle) === 1;
});
check("10 erased puzzles each have exactly one answer", erased.every(Boolean));

// Every move the tricks make must match the real answer, or a hint could be wrong.
// The Medium and Hard packs: one answer, the right grade, and "Show me" over and over solves them using only
// what's on the board (numbers + pencil marks the hints write). Every rule-out must be true, every number right.
for (const [file, level] of [["packs/sudoku9-medium.json", "Medium"], ["packs/sudoku9-hard.json", "Hard"]]) {
  if (!existsSync(file)) continue;
  const m = JSON.parse(readFileSync(file, "utf8")).puzzles[0];
  check(`${level} pack: one answer, graded ${level}`, countSolutions(m.givens) === 1 && grade(m.givens).level === level);
  const b = m.givens.map((r: number[]) => [...r]);
  const marks: Record<string, number[]> = {};
  let ok = true, chains = 0, pencils = 0;
  const sound = (cells: [number, number][], values: number[]) => cells.every(([r, c]) => !values.includes(m.solution[r][c]));
  for (let i = 0; i < 200 && ok; i++) {
    const h = hint(b, m.solution, marks);
    if (h.kind !== "step") { ok = h.kind !== "mistake"; break; }
    if (h.pencil) {
      pencils++;
      ok = sound(h.remove!, h.values!) && h.pencil.every((p) => p.marks.includes(m.solution[p.cell[0]][p.cell[1]]));
      h.pencil.forEach((p) => (marks[`${p.cell[0]},${p.cell[1]}`] = p.marks));
      continue;
    }
    if (h.chain) chains++, (ok = h.chain.every((s) => sound(s.remove!, s.values!)));
    const [r, c] = h.target!;
    ok &&= h.value === m.solution[r][c];
    b[r][c] = h.value;
    delete marks[`${r},${c}`];
  }
  check(`${level}: hints alone solve it from the board only (${chains} chains, ${pencils} pencil-mark hints)`,
    ok && b.every((row: number[], r: number) => row.every((v, c) => v === m.solution[r][c])));
}

// On hard random puzzles, keep tapping Show me (numbers + pencil marks only) until solved or stuck:
// every number right, every rule-out true, every pencil mark keeps the answer.
{
  let bad = 0, pencils = 0, chains = 0;
  for (let i = 0; i < 10; i++) {
    const sol = makeFullGrid();
    const b = erase(sol, 0).puzzle;
    const marks: Record<string, number[]> = {};
    const sound = (cells: [number, number][], vals: number[]) => cells.every(([r, c]) => !vals.includes(sol[r][c]));
    for (let j = 0; j < 300; j++) {
      const h = hint(b, sol, marks);
      if (h.kind !== "step") { bad += h.kind === "mistake" ? 1 : 0; break; }
      if (h.pencil) {
        pencils++;
        if (!sound(h.remove!, h.values!) || !h.pencil.every((p) => p.marks.includes(sol[p.cell[0]][p.cell[1]]))) bad++;
        h.pencil.forEach((p) => (marks[`${p.cell[0]},${p.cell[1]}`] = p.marks));
        continue;
      }
      if (h.chain) chains++, (bad += h.chain.every((s) => sound(s.remove!, s.values!)) ? 0 : 1);
      const [r, c] = h.target!;
      if (sol[r][c] !== h.value) bad++;
      b[r][c] = h.value;
      delete marks[`${r},${c}`];
    }
  }
  check(`board-only hints on 10 hard puzzles: no wrong move (${chains} chains, ${pencils} pencil-mark hints)`, bad === 0);
}

// A hint never leans on hidden memory: wrong pencil marks are pointed out first.
{
  const m = JSON.parse(readFileSync("packs/sudoku9-hard.json", "utf8")).puzzles[0];
  const r = m.givens.findIndex((row: number[]) => row.includes(0));
  const c = m.givens[r].indexOf(0);
  const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => n !== m.solution[r][c]).slice(0, 2);
  const h = hint(m.givens, m.solution, { [`${r},${c}`]: wrong });
  check("a pencil mark that leaves out the answer is flagged first", h.kind === "mistake" && h.target![0] === r && h.target![1] === c);
}

// Harder tricks rule a number out of cells instead: none of those cells may hold it in the answer.
// Erased all the way down so the harder tricks actually get used.
let pointingSeen = 0, pairsSeen = 0, claimingSeen = 0, hiddenSeen = 0, xwingSeen = 0, ywingSeen = 0;
const graded = Array.from({ length: 30 }, () => {
  const solution = makeFullGrid();
  const g = grade(erase(solution, 0).puzzle);
  pointingSeen += g.steps.filter((s) => s.technique === "Pointing").length;
  pairsSeen += g.steps.filter((s) => s.technique === "Pairs").length;
  claimingSeen += g.steps.filter((s) => s.technique === "Claiming").length;
  hiddenSeen += g.steps.filter((s) => s.technique === "Hidden pairs").length;
  xwingSeen += g.steps.filter((s) => s.technique === "X-wing").length;
  ywingSeen += g.steps.filter((s) => s.technique === "Y-wing").length;
  return g.steps.every((s) => s.remove
    ? s.remove.every(([r, c]) => !(s.values ?? [s.value]).includes(solution[r][c]))
    : solution[s.row][s.col] === s.value);
});
check(`grader: every trick move in 30 puzzles matches the answer (Pointing used ${pointingSeen} times, Claiming ${claimingSeen}, Pairs ${pairsSeen}, Hidden pairs ${hiddenSeen}, X-wing ${xwingSeen}, Y-wing ${ywingSeen})`,
  graded.every(Boolean) && pointingSeen > 0 && claimingSeen > 0 && pairsSeen > 0);
const oneHole = grids[1].map((r) => [...r]);
oneHole[4][4] = 0;
check("grader: one missing number = Easy", grade(oneHole).level === "Easy");
check("grader: empty grid is not Easy", grade(empty).level !== "Easy");

// A puzzle is only good if it has one answer, that answer is the saved one, and the easy tricks solve it.
type Saved = { givens: number[][]; solution: number[][] };
function goodEasy(p: Saved) {
  const givensMatch = p.givens.every((row, r) => row.every((n, c) => n === 0 || n === p.solution[r][c]));
  const { min, max } = spread(p.givens);
  const evenSpread = min >= EASY_MIN_PER && max <= EASY_MAX_PER;
  return isValidSolution(p.solution) && givensMatch && evenSpread && countSolutions(p.givens) === 1 && grade(p.givens).level === "Easy";
}
const lopsided = grids[2].map((r) => [...r]);
lopsided[8].fill(0); // an empty bottom row
check("spread test catches an empty row", spread(lopsided).min === 0);
check("maker: 10 new Easy puzzles are all good", Array.from({ length: 10 }, makeEasy).every(goodEasy));
const packFile = "packs/sudoku9-easy-starter.json";
if (existsSync(packFile)) {
  const pack = JSON.parse(readFileSync(packFile, "utf8"));
  check("saved pack: 5 puzzles, all good", pack.puzzles.length === 5 && pack.puzzles.every(goodEasy));

  // Hints: tapping "Show me" over and over must finish every puzzle, with only correct moves.
  const solvedByHints = pack.puzzles.every((p: Saved) => {
    const b = p.givens.map((r) => [...r]);
    for (let i = 0; i < 81; i++) {
      const h = hint(b, p.solution);
      if (h.kind !== "step") break;
      const [r, c] = h.target!;
      if (b[r][c] !== 0 || h.value !== p.solution[r][c]) return false;
      b[r][c] = h.value;
    }
    return b.every((row, r) => row.every((v, c) => v === p.solution[r][c]));
  });
  check("hints alone solve all 5 pack puzzles", solvedByHints);

  // A wrong number must be pointed out before any other hint.
  const p0: Saved = pack.puzzles[0];
  const b = p0.givens.map((r) => [...r]);
  const firstStep = hint(b, p0.solution);
  const [er, ec] = firstStep.target!;
  b[er][ec] = (p0.solution[er][ec] % 9) + 1; // a wrong number
  const h = hint(b, p0.solution);
  check("hint points at a mistake first", h.kind === "mistake" && h.target![0] === er && h.target![1] === ec);
}

// ---------- Star Battle ----------
const sbBroken = ["ABC", "ABC", "ABC"]; // 3×3 can't fit 3 non-touching stars
check("SB checker: an impossible layout has 0 answers", sbCount(sbBroken) === 0);
const sbTwo = ["ABCDEF", "ABCDEF", "ABCDEF", "ABCDEF", "ABCDEF", "ABCDEF"]; // columns as regions: many answers
check("SB checker: a loose layout has 2+ answers", sbCount(sbTwo) === 2);

const sbStars = Array.from({ length: 50 }, () => placeStars(8));
const starsOk = (s: number[]) => new Set(s).size === 8 && s.every((c, r) => r === 0 || Math.abs(c - s[r - 1]) > 1);
check("SB step 1: 50 star placements follow the rules", sbStars.every(starsOk));

type SbSaved = { regions: string[]; solution: number[] };
function goodSb(p: SbSaved) {
  const oneStarPerRegion = new Set(p.solution.map((c, r) => p.regions[r][c])).size === 8;
  const { min, max } = regionSizes(p.regions);
  return starsOk(p.solution) && oneStarPerRegion && min >= MIN_REGION && max <= MAX_REGION &&
    sbCount(p.regions) === 1 && sbGrade(p.regions).level === "Easy";
}
const sbPackFile = "packs/starbattle8-easy-starter.json";
if (existsSync(sbPackFile)) {
  const sbPack = JSON.parse(readFileSync(sbPackFile, "utf8"));
  check("SB saved pack: 5 puzzles, one answer each, even regions, Easy", sbPack.puzzles.length === 5 && sbPack.puzzles.every(goodSb));

  // Every trick move must agree with the answer, and "Show me" over and over must finish each puzzle.
  const sbHintsOk = sbPack.puzzles.every((p: SbSaved) => {
    const b = p.regions.map(() => Array(8).fill(SB_EMPTY));
    for (let i = 0; i < 200; i++) {
      const h = sbHint(b, p.regions, p.solution);
      if (h.kind !== "step") break;
      if (h.star) {
        if (p.solution[h.star[0]] !== h.star[1]) return false;
        b[h.star[0]][h.star[1]] = SB_STAR;
      }
      for (const [r, c] of h.cross) {
        if (p.solution[r] === c) return false;
        b[r][c] = SB_CROSS;
      }
    }
    return p.solution.every((c, r) => b[r][c] === SB_STAR);
  });
  check("SB hints alone solve all 5 pack puzzles, every move correct", sbHintsOk);

  const p1: SbSaved = sbPack.puzzles[0];
  const b1 = p1.regions.map(() => Array(8).fill(SB_EMPTY));
  const wrongCol = p1.solution[0] === 0 ? 1 : 0;
  b1[0][wrongCol] = SB_STAR;
  const h1 = sbHint(b1, p1.regions, p1.solution);
  check("SB hint points at a wrong star first", h1.kind === "mistake" && h1.clear![1] === wrongCol);
}

// The harder tricks (Would block, groups, What if) must never make a move that disagrees with the answer.
const sbSound = Array.from({ length: 15 }, () => {
  const sol = placeStars(8);
  const regions = repair(growRegions(sol), sol, (r, found) => sbCount(r, 2, found));
  if (!regions) return true;
  return sbSolveWith(regions).steps.every((st) =>
    (!st.star || sol[st.star[0]] === st.star[1]) && st.cross.every(([r, c]) => sol[r] !== c));
});
check("SB all tricks: every move in 15 random puzzles matches the answer", sbSound.every(Boolean));

const sbExpertFile = "packs/starbattle8-expert.json";
if (existsSync(sbExpertFile)) {
  const ex = JSON.parse(readFileSync(sbExpertFile, "utf8")).puzzles[0] as SbSaved;
  check("SB Expert puzzle: one answer, graded Expert", sbCount(ex.regions) === 1 && sbGrade(ex.regions).level === "Expert");
  const b = ex.regions.map(() => Array(8).fill(SB_EMPTY));
  let ok = true;
  let chainsOk = true, chains = 0;
  for (let i = 0; i < 300 && ok; i++) {
    const h = sbHint(b, ex.regions, ex.solution);
    if (h.kind !== "step") break;
    // The What if play-through must be honest: pretend star + each forced move really empties the named line.
    if (h.chain) {
      chains++;
      const t = b.map((row) => [...row]);
      t[h.cross[0][0]][h.cross[0][1]] = SB_STAR;
      for (const [r, c] of h.pretendCross!) if (t[r][c] === SB_EMPTY) t[r][c] = SB_CROSS;
      for (const st of h.chain) {
        if (st.star) t[st.star[0]][st.star[1]] = SB_STAR;
        for (const [r, c] of st.cross) if (t[r][c] === SB_EMPTY) t[r][c] = SB_CROSS;
      }
      chainsOk &&= h.chain.length <= 5 && h.dead!.cells.every(([r, c]) => t[r][c] === SB_CROSS);
    }
    if (h.star) ok = ex.solution[h.star[0]] === h.star[1], b[h.star[0]][h.star[1]] = SB_STAR;
    for (const [r, c] of h.cross) ok &&= ex.solution[r] !== c, b[r][c] = SB_CROSS;
  }
  check("SB Expert: hints alone solve it, every move correct", ok && ex.solution.every((c, r) => b[r][c] === SB_STAR));
  check(`SB Expert: every What if play-through (${chains}) ends with its line empty, 5 moves or fewer`, chains > 0 && chainsOk);

  // A wrong star's hint says WHY (Colin, 10/20), and its play-through really empties the line it names.
  let whyOk = true, played = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (ex.solution[r] === c) continue;
      const w = ex.regions.map(() => Array(8).fill(SB_EMPTY));
      w[r][c] = SB_STAR;
      const h = sbHint(w, ex.regions, ex.solution);
      whyOk &&= h.kind === "mistake" && /can't be right\. \S/.test(h.explain);
      if (!h.chain) continue;
      played++;
      const t = w.map((row) => [...row]);
      for (const [a, b] of h.pretendCross!) if (t[a][b] === SB_EMPTY) t[a][b] = SB_CROSS;
      for (const st of h.chain) {
        if (st.star) t[st.star[0]][st.star[1]] = SB_STAR;
        for (const [a, b] of st.cross) if (t[a][b] === SB_EMPTY) t[a][b] = SB_CROSS;
      }
      whyOk &&= h.chain.length <= 5 && h.dead!.cells.every(([a, b]) => t[a][b] === SB_CROSS);
    }
  }
  console.log(`      (${played} of 56 wrong stars get a play-through)`);
  check("SB wrong star: every hint says why, and every play-through is honest", whyOk);
}

if (failed) process.exit(1);
