// Sudoku variants (Colin, 10/22): Killer (cages that add up to their number, no repeats inside a cage) and Thermo
// (numbers climb from the bulb along each thermometer). Classic rules still hold; these add to them.
// The Hint button tries a variant trick first (Colin: "whenever there is a hint based on THOSE rules, that takes
// priority"), then the classic ones. Classic tricks stay sound here: the extra rules only ever remove options.
import { type Grid, fits } from "./fullGrid.ts";
import { type RuledOut, type Step, blockersFor, cellName, list } from "./techniques.ts";

type Cell = [number, number];
export type Cage = { cells: Cell[]; sum: number };
// advanced: also use the Expert tricks (45 rule, cage claims, squeezes). Easy puzzles leave it off, so their hints
// stay exactly as they were.
export type Rules = { variant?: "killer" | "thermo"; cages?: Cage[]; thermos?: Cell[][]; advanced?: boolean };
const NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const ord = (n: number) => ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"][n];

export const rulesOf = (p: { variant?: string; cages?: Cage[]; thermos?: Cell[][]; advanced?: boolean }): Rules | undefined =>
  p.variant ? { variant: p.variant as Rules["variant"], cages: p.cages, thermos: p.thermos, ...(p.advanced ? { advanced: true } : {}) } : undefined;

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

type Blockers = NonNullable<Step["blockers"]>;
// A way to make a cage's sum, shown as a chip in the hint (Colin 10/27, S15): the wrong ones crossed out, each with
// the number on the board that rules it out (lit red when its chip is picked).
export type CageWay = { nums: number[]; ok: boolean; why: string; blockers: Blockers };
export type VariantStep = {
  technique: string; focus: Cell[]; nudge: string; why: string;
  place?: { cell: Cell; value: number }; // a number to place, or…
  pencil?: { cell: Cell; marks: number[] }[]; // …what a cage or thermo leaves in these cells (written as pencil marks)
  ways?: CageWay[]; // a cage: every way to make it, the wrong ones crossed out
  where?: { why: string; blockers: Blockers }; // Show me: why the number goes in this cell of the cage
  struck?: Cell[]; // cells ruled out (striped), e.g. a squeeze's other spots
};

// What a cell can still be by its row, column and box (and what's ruled out). Worked out once per cell per hint:
// the cage searches ask it thousands of times (backlog E: a Killer Expert hint took 640ms). Never mutated.
const optsFor = (grid: Grid, out: RuledOut) => {
  const memo: number[][] = [];
  return ([r, c]: Cell) => (memo[r * 9 + c] ??= NUMS.filter((n) => fits(grid, r, c, n) && !out.has(`${r},${c},${n}`)));
};
const wayText = (ways: number[][]) => list(ways.map((w) => w.join(" + ")), "or");

// Every way to make what's left of a cage, right or wrong, with why each wrong one fails and what on the board shows
// it (Colin 10/27: "9+2: there's already a 2 … 4+7: there's a 4 … so that leaves 5 and 6"). Null when there are too
// many to show as chips.
function cageWays(grid: Grid, cage: Cage, a: ReturnType<typeof cageAllows>, opts: (p: Cell) => number[]): CageWay[] | null {
  const n = a.empty.length, all: number[][] = [];
  const pick = (from: number, chosen: number[], left: number) => {
    if (chosen.length === n) { if (left === 0) all.push(chosen); return; }
    for (let d = from; d <= 9 && d <= left; d++) pick(d + 1, [...chosen, d], left - d);
  };
  pick(1, [], a.need);
  if (all.length < 2 || all.length > 6) return null;
  const fit = new Set(a.fitWays.map((w) => w.join()));
  const spots = either(a.empty);
  return all.map((nums) => {
    const dup = nums.find((d) => a.placed.includes(d));
    if (dup) {
      const at = cage.cells.find(([r, c]) => grid[r][c] === dup)!;
      return { nums, ok: false, why: `The cage already has a ${dup}.`, blockers: [{ cell: at, line: cage.cells }] };
    }
    if (fit.has(nums.join())) return { nums, ok: true, why: `${nums.join(" + ")} fits.`, blockers: [] };
    const stuck = nums.find((d) => !a.empty.some((p) => opts(p).includes(d)));
    if (stuck) {
      const blockers = blockersFor(grid, a.empty, stuck);
      const shown = blockers.map((b) => cellName(...b.cell));
      return { nums, ok: false, blockers,
        why: blockers.length
          ? `No room for the ${stuck}: the ${stuck}${shown.length > 1 ? "s" : ""} at ${list(shown)} block${shown.length > 1 ? "" : "s"} ${n === 2 ? "both cells" : "every cell"}.`
          : `No room for the ${stuck} in ${spots}.` };
    }
    return { nums, ok: false, why: `${list(nums.map(String))} won't fit: two of them need the same cell.`, blockers: [] };
  });
}
const either = (cells: Cell[]) => list(cells.map((p) => cellName(...p)), "or");

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
      // Short, and shown on the board (S15): the sum left, then the ways as chips; Show me says which cell gets which.
      const taken = a.placed.reduce((s, d) => s + d, 0);
      const sumLine = `${cage.sum}${taken ? ` − ${a.placed.join(" − ")} = ${a.need}` : ""}, from ${a.empty.length} number${a.empty.length > 1 ? "s" : ""}.`;
      const ways = cageWays(grid, cage, a, opts) ?? undefined;
      const which = a.fitWays.length === 1 ? ` Only ${a.fitWays[0].join(" + ")} works.` : ` It's ${wayText(a.fitWays)}.`;
      // Why v and not the cage's other numbers here: a number on the board blocks each of them at this cell.
      const others = [...new Set(a.fitWays.flat())].filter((d) => d !== v);
      const wb = others.map((d) => ({ d, b: blockersFor(grid, [cell], d) }));
      const blocked = wb.filter((x) => x.b.length);
      // Or the other way round (Colin's R7C5 = 3): v is blocked from the cage's other cells, so it lands here.
      const rest = a.empty.filter((p) => !same(p, cell));
      const vb = blockersFor(grid, rest, v);
      const vCovers = rest.every((p) => vb.some((x) => sees(x.cell, p)));
      const where = !others.length ? { why: `So ${at} is ${v}.`, blockers: [] }
        : blocked.length === others.length
          ? { why: `${at} can't be ${list(others.map(String), "or")}: ${list(blocked.map((x) => `the ${x.d} at ${cellName(...x.b[0].cell)}`))} block${blocked.length > 1 ? "" : "s"} it. So it's ${v}.`, blockers: blocked.flatMap((x) => x.b) }
          : vCovers
            ? { why: `The ${v} can't go in ${either(rest)}: the ${v}${vb.length > 1 ? "s" : ""} at ${list(vb.map((x) => cellName(...x.cell)))} block${vb.length > 1 ? "" : "s"} ${rest.length > 1 ? "them" : "it"}. So it goes at ${at}.`, blockers: vb }
            : { why: `Of ${list(a.fitWays[0].map(String))}, only ${v} can go at ${at}.`, blockers: blocked.flatMap((x) => x.b) };
      return { technique: "Cage sum", focus: cage.cells, place: { cell, value: v }, ways, where,
        nudge: `Look at the cage at ${head}. What numbers can make ${cage.sum}?`,
        why: `${sumLine}${ways ? "" : which}` };
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

// ---- Expert tricks (rules.advanced) ----

// Houses for the 45 rule: every row, column and box adds up to 45; 2 or 3 rows (or columns) side by side add up
// to 90 or 135.
type House = { label: string; k: number; cells: Cell[] };
const key = ([r, c]: Cell) => `${r},${c}`;
const rowCells = (r: number): Cell[] => NUMS.map((n) => [r, n - 1] as Cell);
const colCells = (c: number): Cell[] => NUMS.map((n) => [n - 1, c] as Cell);
const boxCells = (b: number): Cell[] => NUMS.map((n) => [Math.floor(b / 3) * 3 + Math.floor((n - 1) / 3), (b % 3) * 3 + ((n - 1) % 3)] as Cell);
const SINGLE: House[] = [
  ...[...Array(9).keys()].map((i) => ({ label: `row ${i + 1}`, k: 1, cells: rowCells(i) })),
  ...[...Array(9).keys()].map((i) => ({ label: `column ${i + 1}`, k: 1, cells: colCells(i) })),
  ...[...Array(9).keys()].map((i) => ({ label: `box ${i + 1}`, k: 1, cells: boxCells(i) })),
];
const HOUSES: House[] = [...SINGLE];
for (const k of [2, 3]) {
  for (let i = 0; i + k <= 9; i++) {
    const idx = [...Array(k).keys()].map((j) => i + j);
    HOUSES.push({ label: `rows ${i + 1}–${i + k}`, k, cells: idx.flatMap(rowCells) });
    HOUSES.push({ label: `columns ${i + 1}–${i + k}`, k, cells: idx.flatMap(colCells) });
  }
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const addsUp = (h: House) => `${cap(h.label)} add${h.k === 1 ? "s" : ""} up to ${45 * h.k}`;
const sees = (a: Cell, b: Cell) => a[0] === b[0] || a[1] === b[1] || (Math.floor(a[0] / 3) === Math.floor(b[0] / 3) && Math.floor(a[1] / 3) === Math.floor(b[1] / 3));
const named = (cells: Cell[], grid: Grid) => list(cells.map(([r, c]) => `${cellName(r, c)} is ${grid[r][c]}`));

// What two cells that add up to x can still be (different numbers if they see each other or share a cage).
function pairCands(a: Cell, b: Cell, x: number, opts: (p: Cell) => number[], cages: Cage[]) {
  const diff = sees(a, b) || cages.some((cg) => cg.cells.some((p) => same(p, a)) && cg.cells.some((p) => same(p, b)));
  const oa = opts(a), ob = opts(b);
  return [oa.filter((d) => ob.some((e) => d + e === x && (!diff || d !== e))), ob.filter((e) => oa.some((d) => d + e === x && (!diff || d !== e)))];
}

// The 45 rule. Innie: the cages fully inside a house leave one cell (or two) of it uncovered. Outie: the cages that
// touch a house stick out of it by one cell (or two). place: only one-cell versions (a number); else two-cell sums.
function rule45(grid: Grid, cages: Cage[], opts: (p: Cell) => number[], place: boolean): VariantStep | null {
  for (const h of HOUSES) {
    const inH = new Set(h.cells.map(key));
    const inside = cages.filter((cg) => cg.cells.every((p) => inH.has(key(p))));
    const partial = cages.filter((cg) => !inside.includes(cg) && cg.cells.some((p) => inH.has(key(p))));
    const covered = new Set(inside.flatMap((cg) => cg.cells.map(key)));
    const total = 45 * h.k;
    const sIn = inside.reduce((s, cg) => s + cg.sum, 0);
    // Innies: the house's cells no inside cage covers.
    const rest = h.cells.filter((p) => !covered.has(key(p)));
    const restPlaced = rest.filter(([r, c]) => grid[r][c]), restEmpty = rest.filter(([r, c]) => !grid[r][c]);
    const known = restPlaced.reduce((s, [r, c]) => s + grid[r][c], 0);
    const innie = total - sIn - known;
    const inText = `The cages fully inside it make ${sIn}${restPlaced.length ? `, and ${named(restPlaced, grid)}` : ""}`;
    const inSum = `${total} − ${sIn}${restPlaced.length ? ` − ${known}` : ""}`;
    if (inside.length && restEmpty.length === 1 && place) {
      const [cell] = restEmpty, own = opts(cell);
      if (innie >= 1 && innie <= 9 && own.includes(innie) && own.length > 1) {
        return { technique: "45 rule", focus: h.cells, place: { cell, value: innie },
          nudge: `Look at ${h.label}. What does it add up to?`,
          why: `${addsUp(h)}. ${inText}, so the one cell left, ${cellName(...cell)}, is ${inSum} = ${innie}.` };
      }
    }
    if (inside.length && restEmpty.length === 2 && !place) {
      const [a, b] = restEmpty;
      const [ca, cb] = pairCands(a, b, innie, opts, cages);
      const pencil = [{ cell: a, marks: ca }, { cell: b, marks: cb }].filter((x) => x.marks.length && x.marks.length < opts(x.cell).length);
      if (pencil.length) {
        return { technique: "45 rule", focus: h.cells, pencil,
          nudge: `Look at ${h.label}. What does it add up to?`,
          why: `${addsUp(h)}. ${inText}, so the two cells left, ${cellName(...a)} and ${cellName(...b)}, add up to ${inSum} = ${innie}. So ${cellName(...a)} can only be ${list(ca, "or")} and ${cellName(...b)} ${list(cb, "or")}.` };
      }
    }
    // Outies: every cell of the house is in some cage, and the cages that touch it stick out of it.
    if (!partial.length || !h.cells.every((p) => covered.has(key(p)) || partial.some((cg) => cg.cells.some((q) => same(p, q))))) continue;
    const sTouch = sIn + partial.reduce((s, cg) => s + cg.sum, 0);
    const outCells = partial.flatMap((cg) => cg.cells.filter((p) => !inH.has(key(p))));
    const outPlaced = outCells.filter(([r, c]) => grid[r][c]), outEmpty = outCells.filter(([r, c]) => !grid[r][c]);
    const oKnown = outPlaced.reduce((s, [r, c]) => s + grid[r][c], 0);
    const outie = sTouch - total - oKnown;
    const outText = `The cages touching it add up to ${sTouch}, so the cells sticking out make the extra ${sTouch - total}`; // short (S15)
    const outSum = `${sTouch} − ${total}${outPlaced.length ? ` − ${oKnown}` : ""}`;
    const plus = outPlaced.length ? ` ${cap(named(outPlaced, grid))}` : "";
    if (outEmpty.length === 1 && place) {
      const [cell] = outEmpty, own = opts(cell);
      if (outie >= 1 && outie <= 9 && own.includes(outie) && own.length > 1) {
        return { technique: "45 rule", focus: [...h.cells, ...outCells], place: { cell, value: outie },
          nudge: `Look at ${h.label} and the cages poking out of it.`,
          why: `${addsUp(h)}. ${outText}.${plus}${plus ? "." : ""} So ${cellName(...cell)} is ${outSum} = ${outie}.` };
      }
    }
    if (outEmpty.length === 2 && !place) {
      const [a, b] = outEmpty;
      const [ca, cb] = pairCands(a, b, outie, opts, cages);
      const pencil = [{ cell: a, marks: ca }, { cell: b, marks: cb }].filter((x) => x.marks.length && x.marks.length < opts(x.cell).length);
      if (pencil.length) {
        return { technique: "45 rule", focus: [...h.cells, ...outCells], pencil,
          nudge: `Look at ${h.label} and the cages poking out of it.`,
          why: `${addsUp(h)}. ${outText}.${plus}${plus ? "." : ""} So ${cellName(...a)} and ${cellName(...b)} add up to ${outSum} = ${outie}: ${cellName(...a)} can only be ${list(ca, "or")} and ${cellName(...b)} ${list(cb, "or")}.` };
      }
    }
  }
  return null;
}

// What the cages and thermos leave in each empty cell (on top of its row, column and box).
function variantOpts(grid: Grid, rules: Rules, opts: (p: Cell) => number[]) {
  const left = new Map<string, number[]>();
  const narrow = (cell: Cell, nums: number[]) => left.set(key(cell), (left.get(key(cell)) ?? opts(cell)).filter((n) => nums.includes(n)));
  for (const cage of rules.cages ?? []) for (const { cell, nums } of cageAllows(grid, cage, opts).allow) narrow(cell, nums);
  for (const line of rules.thermos ?? []) for (const { cell, nums } of thermoAllows(grid, line, opts).allow) narrow(cell, nums);
  return (cell: Cell) => left.get(key(cell)) ?? opts(cell);
}

// Squeeze: in a row, column or box, a number has only one cell left once the cages or thermos rule out the others.
function squeeze(grid: Grid, rules: Rules, opts: (p: Cell) => number[]): VariantStep | null {
  const vopts = variantOpts(grid, rules, opts);
  const thermo = rules.variant === "thermo";
  for (const h of SINGLE) {
    const empty = h.cells.filter(([r, c]) => !grid[r][c]);
    for (const d of NUMS) {
      if (h.cells.some(([r, c]) => grid[r][c] === d)) continue;
      const classic = empty.filter((p) => opts(p).includes(d));
      const spots = classic.filter((p) => vopts(p).includes(d));
      if (spots.length !== 1 || classic.length < 2) continue;
      const [cell] = spots, others = classic.filter((p) => !same(p, cell));
      const what = thermo ? "thermometers" : "cages";
      // Short (Colin 10/27: "a wall of text"): the other spots are striped on the board; one line says why.
      const one = others.length === 1 ? ` (${cellName(...others[0])} can only be ${list(vopts(others[0]), "or")})` : "";
      return { technique: thermo ? "Thermo squeeze" : "Cage squeeze", focus: h.cells, place: { cell, value: d }, struck: others,
        nudge: `Where can ${d} go in ${h.label}?`,
        why: `${cap(h.label)} has ${classic.length} spots for ${d}, but the ${what} rule out the striped ${others.length > 1 ? "ones" : "one"}${one}. So ${d} goes at ${cellName(...cell)}.` };
    }
  }
  return null;
}

// Cage claims a number: every way to make the cage uses d, and inside the cage d can only go in one row, column or
// box. So d can't go anywhere else there (like Pointing, for a cage).
function cageClaims(grid: Grid, cages: Cage[], opts: (p: Cell) => number[]): VariantStep | null {
  for (const cage of cages) {
    const a = cageAllows(grid, cage, opts);
    if (!a.fitWays.length || !a.empty.length) continue;
    const must = NUMS.filter((d) => a.fitWays.every((w) => w.includes(d)));
    for (const d of must) {
      const where = a.allow.filter((x) => x.nums.includes(d)).map((x) => x.cell);
      if (!where.length) continue;
      for (const h of SINGLE) {
        if (!where.every((p) => h.cells.some((q) => same(p, q)))) continue;
        const pencil = h.cells.filter((p) => !grid[p[0]][p[1]] && !cage.cells.some((q) => same(p, q)) && opts(p).includes(d))
          .map((cell) => ({ cell, marks: opts(cell).filter((n) => n !== d) }));
        if (!pencil.length) continue;
        return { technique: "Cage claims a number", focus: [...h.cells, ...cage.cells], pencil,
          nudge: `Look at the cage at ${cellName(...cage.cells[0])}. Which number must it use?`,
          why: `The cage at ${cellName(...cage.cells[0])} adds up to ${cage.sum}, and every way to make it uses ${d} (${wayText(a.fitWays)}). In the cage, ${d} can only go in ${list(where.map((p) => cellName(...p)), "or")}, all in ${h.label}. So ${d} can't go anywhere else in ${h.label}.` };
      }
    }
  }
  return null;
}

// The first variant trick that places a number right now (Expert tricks after the basic ones).
export function variantPlace(grid: Grid, out: RuledOut, rules: Rules): VariantStep | null {
  const opts = optsFor(grid, out);
  for (const u of unitsOf(rules)) {
    const st = u.kind === "cage" ? cageStep(grid, u.cage!, opts, true) : thermoStep(grid, u.line!, opts, true);
    if (st) return st;
  }
  if (!rules.advanced) return null;
  return (rules.cages ? rule45(grid, rules.cages, opts, true) : null) ?? squeeze(grid, rules, opts);
}

// Variant rule-outs (pencil marks). Prefer one that lets a number be placed right after (variant or classic).
export function variantRuleOut(grid: Grid, out: RuledOut, rules: Rules, placesAfter: (out: RuledOut) => boolean): VariantStep | null {
  const opts = optsFor(grid, out);
  const all: VariantStep[] = [];
  for (const u of unitsOf(rules)) {
    const st = u.kind === "cage" ? cageStep(grid, u.cage!, opts, false) : thermoStep(grid, u.line!, opts, false);
    if (st) all.push(st);
  }
  if (rules.advanced && rules.cages) {
    const r45 = rule45(grid, rules.cages, opts, false), claim = cageClaims(grid, rules.cages, opts);
    if (r45) all.push(r45);
    if (claim) all.push(claim);
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
