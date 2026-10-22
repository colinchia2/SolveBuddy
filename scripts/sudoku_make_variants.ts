// Make Easy Killer and Easy Thermo Sudokus (Colin, 10/22) and save them as packs.
// Full grid → cages (Killer: the whole grid in cages of 2–4) or thermometers (Thermo: 5–7 lines, 3–6 long, each
// climbing in the answer) → erase numbers one at a time, keeping an erase only if there's still exactly one answer
// AND a player who only follows hints finishes it with Easy classic tricks plus the variant tricks.
// Kept only if the extra rules are really needed (without them the puzzle has more than one answer) and a variant
// hint comes up early.
// Run: node scripts/sudoku_make_variants.ts killer 5   ·   node scripts/sudoku_make_variants.ts thermo 5
import { writeFileSync } from "node:fs";
import { makeFullGrid, type Grid } from "../engine/sudoku/fullGrid.ts";
import { countSolutions } from "../engine/sudoku/countSolutions.ts";
import { playHints } from "../engine/sudoku/hint.ts";
import { type Cage, type Rules } from "../engine/sudoku/variants.ts";

type Cell = [number, number];
const variant = process.argv[2] as "killer" | "thermo";
const want = Number(process.argv[3] || 5);
const HARDER = ["Pointing", "Claiming", "Pairs", "Hidden pairs", "X-wing", "Y-wing"];
const VARIANT_TRICKS = ["Last cell in cage", "Cage sum", "Cage digits", "Thermo order"];
const MIN_CLUES = { killer: 12, thermo: 20 }[variant]; // Easy: a few numbers showing to start from
const shuffled = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const near4 = ([r, c]: Cell): Cell[] => ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as Cell[]).filter(([a, b]) => a >= 0 && b >= 0 && a < 9 && b < 9);
const near8 = ([r, c]: Cell): Cell[] => {
  const out: Cell[] = [];
  for (let a = r - 1; a <= r + 1; a++) for (let b = c - 1; b <= c + 1; b++) if ((a !== r || b !== c) && a >= 0 && b >= 0 && a < 9 && b < 9) out.push([a, b]);
  return out;
};

function makeCages(sol: Grid): Cage[] | null {
  const owner: number[][] = Array.from({ length: 9 }, () => Array(9).fill(-1));
  const cages: Cell[][] = [];
  for (const i of shuffled([...Array(81).keys()])) {
    const start: Cell = [Math.floor(i / 9), i % 9];
    if (owner[start[0]][start[1]] >= 0) continue;
    const cells: Cell[] = [start];
    owner[start[0]][start[1]] = cages.length;
    const size = 2 + Math.floor(Math.random() * 3);
    while (cells.length < size) {
      const digits = new Set(cells.map(([r, c]) => sol[r][c]));
      const opts = shuffled(cells.flatMap(near4)).filter(([r, c]) => owner[r][c] < 0 && !digits.has(sol[r][c]));
      if (!opts.length) break;
      const [r, c] = opts[0];
      owner[r][c] = cages.length;
      cells.push([r, c]);
    }
    cages.push(cells);
  }
  // A cage of one gives its number away: join it to a neighbouring cage (no repeats, at most 5 cells).
  for (let k = 0; k < cages.length; k++) {
    if (cages[k].length !== 1) continue;
    const [p] = cages[k];
    const to = shuffled(near4(p)).map(([r, c]) => owner[r][c]).find((o) => o !== k && cages[o].length && cages[o].length < 5 && !cages[o].some(([r, c]) => sol[r][c] === sol[p[0]][p[1]]));
    if (to == null) return null;
    cages[to].push(p);
    owner[p[0]][p[1]] = to;
    cages[k] = [];
  }
  return cages.filter((c) => c.length).map((cells) => {
    cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // the sum sits in the cage's top-left cell
    return { cells, sum: cells.reduce((s, [r, c]) => s + sol[r][c], 0) };
  });
}

function makeThermos(sol: Grid): Cell[][] {
  const used = new Set<string>();
  const lines: Cell[][] = [];
  const count = 5 + Math.floor(Math.random() * 3);
  for (let tries = 0; tries < 400 && lines.length < count; tries++) {
    const start: Cell = [Math.floor(Math.random() * 9), Math.floor(Math.random() * 9)];
    if (used.has(start.join()) || sol[start[0]][start[1]] > 5) continue;
    const line: Cell[] = [start];
    const len = 3 + Math.floor(Math.random() * 4);
    while (line.length < len) {
      const last = line[line.length - 1];
      const next = shuffled(near8(last)).find(([r, c]) => !used.has(`${r},${c}`) && !line.some((p) => p[0] === r && p[1] === c) && sol[r][c] > sol[last[0]][last[1]]);
      if (!next) break;
      line.push(next);
    }
    if (line.length < 3) continue;
    line.forEach((p) => used.add(p.join()));
    lines.push(line);
  }
  return lines;
}

function easyByHints(givens: Grid, sol: Grid, rules: Rules) {
  const play = playHints(givens, sol, 400, rules);
  return play.solved && !play.shown.some((h) => HARDER.includes(h.technique)) ? play : null;
}

const puzzles: any[] = [];
const t0 = Date.now();
for (let attempt = 0; puzzles.length < want && attempt < 400; attempt++) {
  const sol = makeFullGrid();
  const rules: Rules = variant === "killer" ? { variant, cages: makeCages(sol) ?? undefined } : { variant, thermos: makeThermos(sol) };
  if (variant === "killer" && !rules.cages) continue;
  const p = sol.map((r) => [...r]);
  let clues = 81;
  for (const i of shuffled([...Array(81).keys()])) {
    if (clues <= MIN_CLUES) break;
    const [r, c] = [Math.floor(i / 9), i % 9];
    const keep = p[r][c];
    p[r][c] = 0;
    if (countSolutions(p, 2, [], rules) === 1 && easyByHints(p, sol, rules)) clues--;
    else p[r][c] = keep;
  }
  if (countSolutions(p) < 2) continue; // the extra rules must matter
  const play = easyByHints(p, sol, rules)!;
  const firstVariant = play.shown.findIndex((h) => VARIANT_TRICKS.includes(h.technique));
  if (firstVariant < 0 || firstVariant > 4) continue;
  const n = puzzles.length + 1;
  const used = [...new Set(play.shown.map((h) => h.technique))];
  puzzles.push({ id: `sudoku9-${variant}-easy-${n}`, givens: p, solution: sol, clues, variant,
    ...(rules.cages ? { cages: rules.cages } : {}), ...(rules.thermos ? { thermos: rules.thermos } : {}), techniquesUsed: used });
  console.log(`${variant} #${n} · ${clues} numbers showing · ${play.shown.length} hints · ${used.join(", ")} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
const file = `packs/sudoku9-${variant}-easy.json`;
writeFileSync(file, JSON.stringify({ id: `sudoku9-${variant}-easy`, game: "sudoku", size: 9, variant,
  difficulty: "Easy", sizeLabel: variant === "killer" ? "9×9 Killer" : "9×9 Thermo", puzzles }, null, 1));
console.log(`${file}: ${puzzles.length} puzzles`);
