// Shikaku (Colin 10/24): every pack puzzle has exactly one answer, Hint → Show me alone finishes each with simple
// steps, and no hint is ever wrong (a full patch is the answer's, a partial one sits inside it and holds its number,
// a mistake hint points at a patch that really is wrong) — from a blank board, from boards half done, and with
// mistakes on them. Run: node checks/shikaku.ts
import { readFileSync } from "node:fs";
import { type Puzzle, type Rect, applyHint, area, cluesIn, contains, countSolutions, hint, inside, isSolved, playHints, same, sortPatches } from "../engine/shikaku/shikaku.ts";

let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };

// The answer counter tells 1 from 2+: two 2s on a 2×2's diagonal can lie flat or stand up.
check("answer counter: a 2×2 with 2s on a diagonal has 2 answers, one with 2s in a column has 1",
  countSolutions({ size: 2, clues: [[0, 0, 2], [1, 1, 2]], solution: [] }) === 2
  && countSolutions({ size: 2, clues: [[0, 0, 2], [1, 0, 2]], solution: [] }) === 1);

// A hint is never wrong on this board.
function hintOk(p: Puzzle, board: Rect[]) {
  const h = hint(p, board);
  if (h.kind === "done") return isSolved(p, board);
  if (!h.nudge || !h.explain || !h.showMe || !h.technique) return false;
  if (h.kind === "mistake") return !!h.remove && sortPatches(p, board).wrong.some((R) => same(R, h.remove!));
  if (!h.rect || h.clue < 0) return false;
  const sol = p.solution[h.clue];
  const holds = cluesIn(p, h.rect);
  if (holds.length !== 1 || holds[0] !== h.clue) return false;
  return h.kind === "full" ? same(h.rect, sol) : contains(sol, h.rect) && area(h.rect) < area(sol);
}
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const PACKS = [["shikaku8-easy.json", 8, "Easy"], ["shikaku10-medium.json", 10, "Medium"], ["shikaku12-hard.json", 12, "Hard"]] as const;
let partials = 0;
for (const [file, size, level] of PACKS) {
  const pk = JSON.parse(readFileSync(`packs/${file}`, "utf8"));
  const ps: Puzzle[] = pk.puzzles;
  check(`${file}: 10 puzzles, ${size}×${size}, ${level}`, ps.length === 10 && pk.size === size && pk.difficulty === level && ps.every((p) => p.size === size));
  check(`${file}: each answer cuts the square into rectangles, one number in each, the right size`, ps.every((p) => {
    const seen = new Uint8Array(size * size);
    return p.solution.length === p.clues.length && p.solution.every((R, i) => {
      const k = cluesIn(p, R);
      if (k.length !== 1 || k[0] !== i || area(R) !== p.clues[i][2]) return false;
      for (let r = R.r; r < R.r + R.h; r++) for (let c = R.c; c < R.c + R.w; c++) { if (seen[r * size + c]) return false; seen[r * size + c] = 1; }
      return true;
    }) && seen.every((v) => v === 1) && isSolved(p, p.solution);
  }));
  check(`${file}: exactly one answer each`, ps.every((p) => countSolutions(p) === 1));
  // Hint alone, from blank: every step right and explained, never "Show the answer", quick.
  let slow = 0, ok = true;
  const steps: number[] = [], used: Record<string, number> = {};
  for (const p of ps) {
    const t0 = performance.now();
    let b: Rect[] = [];
    for (let n = 0; n < 400 && !isSolved(p, b); n++) {
      if (!hintOk(p, b)) ok = false;
      const h = hint(p, b);
      used[h.technique] = (used[h.technique] ?? 0) + 1;
      if (h.kind === "partial") partials++;
      b = applyHint(b, h);
    }
    steps.push(isSolved(p, b) ? 1 : 0);
    slow = Math.max(slow, performance.now() - t0);
  }
  check(`${file}: Hint alone solves all 10, every step right and explained (${Object.entries(used).map(([t, n]) => `${t} ${n}`).join(", ")}; slowest ${Math.round(slow)}ms)`,
    ok && steps.every((s) => s === 1) && !used["Show the answer"] && slow < 1500);
  // Half-done boards (random right patches, some partial) and boards with a wrong patch: hints stay right and finish.
  let mixOk = true, firstMistake = true;
  for (const p of ps) for (let t = 0; t < 6; t++) {
    const board: Rect[] = [];
    p.solution.forEach((R, i) => {
      if (rnd() < 0.3) board.push(R);
      else if (rnd() < 0.2) { // a partial: shrink the answer's rectangle around its number
        const [cr, cc] = p.clues[i];
        const r = R.r + Math.floor(rnd() * (cr - R.r + 1)), c = R.c + Math.floor(rnd() * (cc - R.c + 1));
        board.push({ r, c, h: cr - r + 1, w: cc - c + 1 });
      }
    });
    if (!hintOk(p, board) || !playHints(p, board).steps) mixOk = false;
    // A wrong patch: a 1×2 over the first number that isn't part of its answer.
    const i = p.clues.findIndex(([r, c]) => c + 1 < size && !inside(p.solution[p.clues.indexOf(p.clues[0])], r, c + 1));
    const [wr, wc] = p.clues[Math.max(0, i)];
    const bad: Rect = { r: wr, c: wc, w: 2, h: 1 };
    if (wc + 1 < size && !contains(p.solution[Math.max(0, i)], bad)) {
      const withBad = [...board.filter((R) => !(R.r <= wr && wr < R.r + R.h && R.c <= wc + 1 && wc < R.c + R.w)), bad];
      const h = hint(p, withBad);
      if (h.kind !== "mistake" || !h.remove || !same(h.remove, bad)) firstMistake = false;
      if (!playHints(p, withBad).steps) mixOk = false;
    }
  }
  check(`${file}: from 60 half-done boards hints stay right and finish; a wrong patch is pointed at first (${firstMistake})`, mixOk && firstMistake);
}
check(`hints draw partial patches along the way (${partials} across the packs)`, partials > 0);
if (failed) process.exit(1);
