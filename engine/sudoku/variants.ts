// Sudoku variants (Colin, 10/22): Killer (cages that add up to their number, no repeats inside a cage) and Thermo
// (numbers climb from the bulb along each thermometer). Classic rules still hold; these add to them.
// The Hint button tries a variant trick first (Colin: "whenever there is a hint based on THOSE rules, that takes
// priority"), then the classic ones. Classic tricks stay sound here: the extra rules only ever remove options.
import { type Grid, fits } from "./fullGrid.ts";
import { type RuledOut, cellName, list } from "./techniques.ts";

type Cell = [number, number];
export type Cage = { cells: Cell[]; sum: number };
export type Rules = { variant?: "killer" | "thermo"; cages?: Cage[]; thermos?: Cell[][] };
const NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const ord = (n: number) => ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"][n];

export const rulesOf = (p: { variant?: string; cages?: Cage[]; thermos?: Cell[][] }): Rules | undefined =>
  p.variant ? { variant: p.variant as Rules["variant"], cages: p.cages, thermos: p.thermos } : undefined;

// Can n go at (r, c) without breaking a cage or thermo, given the numbers already placed?
export function variantFits(grid: Grid, rules: Rules | undefined, r: number, c: number, n: number): boolean {
  if (!rules) return true;
  for (const cage of rules.cages ?? []) {
    if (!cage.cells.some((p) => same(p, [r, c]))) continue;
    let sum = n, empty = 0;
    const used = new Set([n]);
    for (const [a, b] of cage.cells) {
      if (a === r && b === c) continue;
      const v = grid[a][b];
      if (!v) { empty++; continue; }
      if (used.has(v)) return false;
      used.add(v);
      sum += v;
    }
    // The empty cells need different numbers not used yet: is the rest of the sum still reachable?
    const free = NUMS.filter((d) => !used.has(d));
    const lo = free.slice(0, empty).reduce((a, b) => a + b, 0), hi = free.slice(free.length - empty).reduce((a, b) => a + b, 0);
    if (sum + lo > cage.sum || sum + hi < cage.sum) return false;
  }
  for (const line of rules.thermos ?? []) {
    const i = line.findIndex((p) => same(p, [r, c]));
    if (i < 0) continue;
    if (n < i + 1 || n > 9 - (line.length - 1 - i)) return false;
    for (let j = 0; j < line.length; j++) {
      const v = grid[line[j][0]][line[j][1]];
      if (!v || j === i) continue;
      if (j < i ? n - v < i - j : v - n < j - i) return false;
    }
  }
  return true;
}

// What a cage or thermo still allows in each of its empty cells, given each cell's classic options (`opts`).
type Unit = { kind: "cage" | "thermo"; cells: Cell[]; cage?: Cage; line?: Cell[] };
const unitsOf = (rules: Rules): Unit[] => [
  ...(rules.cages ?? []).map((cage) => ({ kind: "cage" as const, cells: cage.cells, cage })),
  ...(rules.thermos ?? []).map((line) => ({ kind: "thermo" as const, cells: line, line })),
];

function cageAllows(grid: Grid, cage: Cage, opts: (p: Cell) => number[]) {
  const empty = cage.cells.filter(([r, c]) => !grid[r][c]);
  const placed = cage.cells.filter(([r, c]) => grid[r][c]).map(([r, c]) => grid[r][c]);
  const need = cage.sum - placed.reduce((a, b) => a + b, 0);
  // Every set of different numbers that makes the rest of the sum (ignoring where they go): the "ways".
  const ways: number[][] = [];
  const pick = (from: number, chosen: number[], left: number) => {
    if (chosen.length === empty.length) { if (left === 0) ways.push(chosen); return; }
    for (let d = from; d <= 9 && d <= left; d++) if (!placed.includes(d)) pick(d + 1, [...chosen, d], left - d);
  };
  pick(1, [], need);
  // Which number each cell can hold in some way that also fits every cell's own options.
  const allow = empty.map(() => new Set<number>());
  const fitWays: number[][] = [];
  for (const way of ways) {
    let fitsSomewhere = false;
    const place = (i: number, left: number[], got: number[]) => {
      if (i === empty.length) { got.forEach((d, k) => allow[k].add(d)); fitsSomewhere = true; return; }
      for (const d of left) if (opts(empty[i]).includes(d)) place(i + 1, left.filter((x) => x !== d), [...got, d]);
    };
    place(0, way, []);
    if (fitsSomewhere) fitWays.push(way);
  }
  return { empty, placed, need, ways, fitWays, allow: empty.map((p, i) => ({ cell: p, nums: [...allow[i]].sort((a, b) => a - b) })) };
}

function thermoAllows(grid: Grid, line: Cell[], opts: (p: Cell) => number[]) {
  const A = line.map(([r, c]) => (grid[r][c] ? [grid[r][c]] : opts([r, c])));
  const lo: number[] = [], hi: number[] = [];
  for (let i = 0; i < line.length; i++) lo[i] = Math.min(...A[i].filter((v) => i === 0 || v > lo[i - 1]), 99);
  for (let i = line.length - 1; i >= 0; i--) hi[i] = Math.max(...A[i].filter((v) => i === line.length - 1 || v < hi[i + 1]), -1);
  return { lo, hi, allow: line.map((p, i) => ({ cell: p, nums: A[i].filter((v) => v >= lo[i] && v <= hi[i]) })).filter((x) => !grid[x.cell[0]][x.cell[1]]) };
}

export type VariantStep = {
  technique: string; focus: Cell[]; nudge: string; why: string;
  place?: { cell: Cell; value: number }; // a number to place, or…
  pencil?: { cell: Cell; marks: number[] }[]; // …what a cage or thermo leaves in these cells (written as pencil marks)
};

const optsFor = (grid: Grid, out: RuledOut) => ([r, c]: Cell) => NUMS.filter((n) => fits(grid, r, c, n) && !out.has(`${r},${c},${n}`));
const wayText = (ways: number[][]) => list(ways.map((w) => w.join(" + ")), "or");

function cageStep(grid: Grid, cage: Cage, opts: (p: Cell) => number[], wantPlace: boolean): VariantStep | null {
  const a = cageAllows(grid, cage, opts);
  if (!a.empty.length) return null;
  const head = cellName(...cage.cells[0]);
  for (const { cell, nums } of a.allow) {
    const own = opts(cell);
    if (wantPlace && nums.length === 1 && own.length > 1) {
      const v = nums[0], at = cellName(...cell);
      if (a.empty.length === 1) {
        return { technique: "Last cell in cage", focus: cage.cells, place: { cell, value: v },
          nudge: `Look at the cage at ${head}.`,
          why: `The cage adds up to ${cage.sum}. Its other cells already make ${cage.sum - v}, so ${at} is ${v}.` };
      }
      const has = a.placed.length ? ` It already has ${list(a.placed)}, so the rest must make ${a.need}.` : "";
      const fit = a.fitWays.length === 1 && a.fitWays[0].length === a.empty.length && own.filter((d) => a.fitWays[0].includes(d)).length === 1
        ? `Of those, only ${v} fits at ${at}: its row, column and box rule out the others.`
        : `Its row, column and box allow ${list(own, "or")} at ${at}, and of those only ${v} works in the cage.`;
      return { technique: "Cage sum", focus: cage.cells, place: { cell, value: v },
        nudge: `Look at the cage at ${head}. What numbers can make ${cage.sum}?`,
        why: `The cage adds up to ${cage.sum} using ${cage.cells.length} different numbers.${has} The only way${a.fitWays.length > 1 ? "s are" : " is"} ${wayText(a.fitWays)}. ${fit}` };
    }
  }
  if (wantPlace) return null;
  // Rule-out: the cage leaves fewer numbers than a cell's row, column and box do.
  const pencil = a.allow.filter(({ cell, nums }) => nums.length && nums.length < opts(cell).length).map(({ cell, nums }) => ({ cell, marks: nums }));
  if (!pencil.length) return null;
  const digits = [...new Set(a.fitWays.flat())].sort((x, y) => x - y);
  const has = a.placed.length ? ` It already has ${list(a.placed)}, so the rest must make ${a.need}.` : "";
  return { technique: "Cage digits", focus: cage.cells, pencil,
    nudge: `Look at the cage at ${head}. Which numbers can make ${cage.sum}?`,
    why: `The cage adds up to ${cage.sum} using ${cage.cells.length} different numbers.${has} The only way${a.fitWays.length > 1 ? "s are" : " is"} ${wayText(a.fitWays)}, so its cells can only be ${list(digits, "or")}.` };
}

function thermoStep(grid: Grid, line: Cell[], opts: (p: Cell) => number[], wantPlace: boolean): VariantStep | null {
  const t = thermoAllows(grid, line, opts);
  const bulb = cellName(...line[0]);
  const L = line.length;
  // "must be more than the 3 just before it and at most 7 (2 bigger numbers come after it)"
  const range = (p: Cell) => {
    const i = line.findIndex((q) => same(p, q));
    const lo = t.lo[i], hi = t.hi[i];
    let low = "", high = "";
    if (i > 0) {
      const j = [...Array(i).keys()].reverse().find((k) => grid[line[k][0]][line[k][1]]);
      if (j != null && lo === grid[line[j][0]][line[j][1]] + (i - j)) low = i - j === 1 ? `more than the ${lo - 1} just before it` : `at least ${lo} (it's ${i - j} steps above the ${lo - (i - j)})`;
      else low = lo === i + 1 ? `at least ${lo} (${i} smaller number${i > 1 ? "s come" : " comes"} before it)` : `more than ${cellName(...line[i - 1])}, which is at least ${t.lo[i - 1]}`;
    }
    if (i < L - 1) {
      const j = [...Array(L).keys()].slice(i + 1).find((k) => grid[line[k][0]][line[k][1]]);
      const up = L - 1 - i;
      if (j != null && hi === grid[line[j][0]][line[j][1]] - (j - i)) high = j - i === 1 ? `less than the ${hi + 1} just after it` : `at most ${hi} (it's ${j - i} steps below the ${hi + (j - i)})`;
      else high = hi === 9 - up ? `at most ${hi} (${up} bigger number${up > 1 ? "s come" : " comes"} after it)` : `less than ${cellName(...line[i + 1])}, which is at most ${t.hi[i + 1]}`;
    }
    const where = i === 0 ? `${cellName(...p)} is the bulb, so it's the smallest` : `${cellName(...p)} is ${ord(i)} from the bulb`;
    return `${where}: it must be ${[low, high].filter(Boolean).join(low.includes(",") ? ", and " : " and ")}`;
  };
  for (const { cell, nums } of t.allow) {
    const own = opts(cell);
    if (wantPlace && nums.length === 1 && own.length > 1) {
      return { technique: "Thermo order", focus: line, place: { cell, value: nums[0] },
        nudge: `Look at the thermometer starting at ${bulb}. Numbers climb from the bulb.`,
        why: `Numbers climb from the bulb at ${bulb}. ${range(cell)}. Its row, column and box allow ${list(own, "or")}, and only ${nums[0]} fits that.` };
    }
  }
  if (wantPlace) return null;
  const pencil = t.allow.filter(({ cell, nums }) => nums.length && nums.length < opts(cell).length).map(({ cell, nums }) => ({ cell, marks: nums }));
  if (!pencil.length) return null;
  const first = pencil[0];
  return { technique: "Thermo order", focus: line, pencil,
    nudge: `Look at the thermometer starting at ${bulb}. Numbers climb from the bulb.`,
    why: `Numbers climb from the bulb at ${bulb}. ${range(first.cell)}. Its row, column and box allow ${list(opts(first.cell), "or")}, so it can only be ${list(first.marks, "or")}.${pencil.length > 1 ? " The same climb narrows the other cells on it too." : ""}` };
}

// The first variant trick that places a number right now.
export function variantPlace(grid: Grid, out: RuledOut, rules: Rules): VariantStep | null {
  const opts = optsFor(grid, out);
  for (const u of unitsOf(rules)) {
    const st = u.kind === "cage" ? cageStep(grid, u.cage!, opts, true) : thermoStep(grid, u.line!, opts, true);
    if (st) return st;
  }
  return null;
}

// Variant rule-outs (pencil marks). Prefer one that lets a number be placed right after (variant or classic).
export function variantRuleOut(grid: Grid, out: RuledOut, rules: Rules, placesAfter: (out: RuledOut) => boolean): VariantStep | null {
  const opts = optsFor(grid, out);
  const all: VariantStep[] = [];
  for (const u of unitsOf(rules)) {
    const st = u.kind === "cage" ? cageStep(grid, u.cage!, opts, false) : thermoStep(grid, u.line!, opts, false);
    if (st) all.push(st);
  }
  const outAfter = (st: VariantStep) => {
    const next = new Set(out);
    for (const { cell: [r, c], marks } of st.pencil!) for (const n of NUMS) if (!marks.includes(n)) next.add(`${r},${c},${n}`);
    return next;
  };
  return all.find((st) => placesAfter(outAfter(st)) || variantPlace(grid, outAfter(st), rules)) ?? all[0] ?? null;
}

// Numbers on the board that break a cage or thermo (for "show mistakes" and the page's red clashes).
export function variantClashes(grid: Grid, rules: Rules | undefined): Set<string> {
  const bad = new Set<string>();
  if (!rules) return bad;
  for (const cage of rules.cages ?? []) {
    const vals = cage.cells.map(([r, c]) => grid[r][c]);
    cage.cells.forEach(([r, c], i) => { if (vals[i] && vals.filter((v) => v === vals[i]).length > 1) bad.add(`${r},${c}`); });
    if (vals.every(Boolean) && vals.reduce((a, b) => a + b, 0) !== cage.sum) cage.cells.forEach(([r, c]) => bad.add(`${r},${c}`));
  }
  for (const line of rules.thermos ?? []) {
    for (let i = 0; i < line.length; i++) for (let j = i + 1; j < line.length; j++) {
      const a = grid[line[i][0]][line[i][1]], b = grid[line[j][0]][line[j][1]];
      if (a && b && a >= b) bad.add(`${line[i][0]},${line[i][1]}`), bad.add(`${line[j][0]},${line[j][1]}`);
    }
  }
  return bad;
}
