// Nonogram (Colin 10/23): the line solver is right, every pack puzzle is a named picture with exactly one answer, and
// pressing Hint → Show me alone finishes each one with every step correct and explained, from a blank board and from a
// board with mistakes on it. Run: node checks/nonogram.ts
import { readFileSync } from "node:fs";
import { UNKNOWN, FILLED, EMPTY, cluesOf, runs, solveLine, type Cell } from "../engine/nonogram/line.ts";
import { countSolutions, lineSolve, logicSolves } from "../engine/nonogram/solve.ts";
import { BLANK, FILL, CROSS, type Mark, applyHint, hint, isSolved, playHints } from "../engine/nonogram/hint.ts";

let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };

// The line solver, by brute force: on random short lines, what it forces must be exactly what every arrangement shares.
{
  let ok = true;
  const rand = (n: number) => Math.floor(Math.random() * n);
  for (let t = 0; t < 3000 && ok; t++) {
    const n = 1 + rand(9);
    const truth = Array.from({ length: n }, () => rand(2));
    const clue = runs(truth);
    const known = truth.map((v) => (rand(3) === 0 ? v : UNKNOWN)) as Cell[];
    const all: number[][] = [];
    for (let m = 0; m < 1 << n; m++) {
      const line = Array.from({ length: n }, (_, i) => (m >> i) & 1);
      if (runs(line).join() === clue.join() && known.every((v, i) => v === UNKNOWN || v === line[i])) all.push(line);
    }
    const out = solveLine(clue, known)!;
    ok = !!out && out.every((v, i) => {
      const f = all.every((l) => l[i] === 1), e = all.every((l) => l[i] === 0);
      return v === (f ? FILLED : e ? EMPTY : UNKNOWN);
    });
    // A line that breaks its clue must be caught.
    const wrong = truth.map((v) => 1 - v) as Cell[];
    if (runs(wrong).join() !== clue.join() && solveLine(clue, wrong) !== null) ok = false;
  }
  check("line solver: forces exactly what every arrangement shares (3000 random lines), catches broken lines", ok);
}
// The answer counter tells 1 from 2+: a checkerboard 2×2 has two answers.
check("answer counter: a 2×2 diagonal has 2 answers, a heart has 1",
  countSolutions([[1], [1]], [[1], [1]]) === 2 && countSolutions(cluesOf([".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."]).rows, cluesOf([".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."]).cols) === 1);
check("line logic alone can't finish an ambiguous board", lineSolve([[1], [1]], [[1], [1]])!.flat().every((v) => v === UNKNOWN));

const PACKS = [["nonogram5-easy.json", 5, "Easy"], ["nonogram10-medium.json", 10, "Medium"], ["nonogram15-hard.json", 15, "Hard"]] as const;
for (const [file, size, level] of PACKS) {
  const pk = JSON.parse(readFileSync(`packs/${file}`, "utf8"));
  const ps = pk.puzzles;
  check(`${file}: 5 puzzles, ${size}×${size}, ${level}`, ps.length === 5 && pk.size === size && pk.difficulty === level
    && ps.every((p: any) => p.solution.length === size && p.solution.every((r: string) => r.length === size)));
  check(`${file}: each is a named picture with a colour (${ps.map((p: any) => p.name).join(", ")})`,
    ps.every((p: any) => p.name && /!$/.test(p.say) && /^#[0-9A-F]{6}$/i.test(p.color)) && new Set(ps.map((p: any) => p.name)).size === 5);
  check(`${file}: clues match the picture`, ps.every((p: any) => {
    const c = cluesOf(p.solution);
    return JSON.stringify(c.rows) === JSON.stringify(p.rows) && JSON.stringify(c.cols) === JSON.stringify(p.cols);
  }));
  check(`${file}: exactly one answer each`, ps.every((p: any) => countSolutions(p.rows, p.cols) === 1));
  check(`${file}: solvable one row or column at a time`, ps.every((p: any) => logicSolves(p.rows, p.cols, p.solution)));
  // Hint alone, every step correct, explained, and quick.
  let slow = 0, steps: number[] = [], explained = true;
  for (const p of ps) {
    const t0 = performance.now();
    steps.push(playHints(p));
    slow = Math.max(slow, performance.now() - t0);
    let b: Mark[][] = p.rows.map(() => p.cols.map(() => BLANK));
    for (let i = 0; i < 400 && !isSolved(p, b); i++) {
      const h = hint(p, b);
      if (!h.nudge || !h.explain || !h.showMe || !h.technique || !h.line) explained = false;
      b = applyHint(b, h);
    }
  }
  check(`${file}: Hint alone solves all 5, every step correct (${steps.join(", ")} steps, slowest whole run ${Math.round(slow)}ms)`, steps.every((n) => n > 0) && slow < 1500);
  check(`${file}: every hint names its row or column, its technique and why`, explained);
  // With mistakes: a wrong filled square is pointed out first, a wrong × is never trusted; hints still finish it.
  const p = ps[ps.length - 1];
  const b: Mark[][] = p.rows.map(() => p.cols.map(() => BLANK));
  let wr = -1, wc = -1, xr = -1, xc = -1;
  p.solution.forEach((row: string, r: number) => [...row].forEach((v, c) => {
    if (v === "." && wr < 0) { wr = r; wc = c; }
    if (v === "X" && xr < 0) { xr = r; xc = c; }
  }));
  b[wr][wc] = FILL; b[xr][xc] = CROSS;
  const first = hint(p, b);
  check(`${file}: a wrong filled square is flagged first ("${first.technique}"), then hints finish it despite a wrong ×`,
    first.kind === "mistake" && first.clear[0][0] === wr && first.clear[0][1] === wc && playHints(p, b) > 0);
}
// A puzzle with no picture name still plays (future imports): the engine needs only clues and solution.
{
  const sol = ["XXX", "X..", "X.."], c = cluesOf(sol);
  check("a puzzle with no picture name plays and hints fine", playHints({ ...c, solution: sol }) > 0);
}
if (failed) process.exit(1);
