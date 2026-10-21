// Human-style tricks, easiest first. Each one looks at the board and finds one next move, or nothing.
// The grader uses these to rate a puzzle, and the Hint button uses the same list.
import { type Grid, fits } from "./fullGrid.ts";

export type Step = {
  technique: string; // the chip name shown in a hint
  row: number;
  col: number;
  value: number;
  // Harder tricks don't place a number: they rule `value` out of these cells instead (row/col = the first one).
  remove?: [number, number][];
  values?: number[]; // when it rules out more than one number (Pairs); otherwise just `value`
  spots?: [number, number][]; // Pointing: the cells in the box where the number can still go (ringed in a hint)
  focus: [number, number][]; // cells to highlight (the row, column or box the trick looks at)
  // The placed numbers that block the other cells, each with the row, column or box it blocks through
  // (shown from Explain on; Colin, 10/20).
  blockers?: { cell: [number, number]; line: [number, number][] }[];
  // Ruled-out facts the step relied on ([row, col, number]), so a hint can say where they came from.
  uses?: [number, number, number][];
  nudge: string; // where to look (the "Nudge" level of a hint)
  why: string; // plain-English reason (the "Explain" level of a hint)
};

// Which placed n's block these empty cells? Picks few: a number that already blocks a cell is reused.
function blockersFor(grid: Grid, cells: [number, number][], n: number): NonNullable<Step["blockers"]> {
  const placed: [number, number][] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] === n) placed.push([r, c]);
  const sameBox = (a: [number, number], b: [number, number]) =>
    Math.floor(a[0] / 3) === Math.floor(b[0] / 3) && Math.floor(a[1] / 3) === Math.floor(b[1] / 3);
  const covers = (p: [number, number], q: [number, number]) => p[0] === q[0] || p[1] === q[1] || sameBox(p, q);
  const chosen: [number, number][] = [];
  let left = cells.filter((q) => placed.some((p) => covers(p, q)));
  while (left.length) {
    const best = placed.reduce((a, b) => (left.filter((q) => covers(b, q)).length > left.filter((q) => covers(a, q)).length ? b : a));
    chosen.push(best);
    left = left.filter((q) => !covers(best, q));
  }
  // Each blocker shows the row, column or box it blocks through (more than one if it blocks several ways).
  return chosen.map((p) => {
    const line = new Map<string, [number, number]>();
    for (const q of cells.filter((q) => covers(p, q))) {
      const through = q[0] === p[0] ? UNITS.find((u) => u.label === `row ${p[0] + 1}`)!.cells
        : q[1] === p[1] ? UNITS.find((u) => u.label === `column ${p[1] + 1}`)!.cells
        : boxCells(Math.floor(p[0] / 3) * 3 + Math.floor(p[1] / 3));
      for (const x of through) line.set(`${x[0]},${x[1]}`, x);
    }
    return { cell: p, line: [...line.values()] };
  });
}

// Numbers already ruled out of cells by harder tricks, as "row,col,number" keys.
export type RuledOut = Set<string>;
const outKey = (r: number, c: number, n: number) => `${r},${c},${n}`;
const canGo = (grid: Grid, out: RuledOut, r: number, c: number, n: number) =>
  grid[r][c] === 0 && !out.has(outKey(r, c, n)) && fits(grid, r, c, n);

// Which of these numbers in these cells fit the basic rules but are ruled out: facts a step relies on.
const usedOut = (grid: Grid, out: RuledOut, cells: [number, number][], nums: number[]) =>
  cells.flatMap(([r, c]) => nums.filter((n) => grid[r][c] === 0 && out.has(outKey(r, c, n)) && fits(grid, r, c, n)).map((n) => [r, c, n] as [number, number, number]));
const ALL_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Apply a step: place its number, or remember what it ruled out.
export function applyStep(grid: Grid, out: RuledOut, step: Step) {
  if (step.remove) for (const [r, c] of step.remove) for (const n of step.values ?? [step.value]) out.add(outKey(r, c, n));
  else grid[step.row][step.col] = step.value;
}

type Unit = { kind: "row" | "column" | "box"; label: string; cells: [number, number][] };

const UNITS: Unit[] = [];
for (let i = 0; i < 9; i++) {
  UNITS.push({ kind: "box", label: `box ${i + 1}`, cells: boxCells(i) });
}
for (let i = 0; i < 9; i++) {
  UNITS.push({ kind: "row", label: `row ${i + 1}`, cells: Array.from({ length: 9 }, (_, c) => [i, c]) });
  UNITS.push({ kind: "column", label: `column ${i + 1}`, cells: Array.from({ length: 9 }, (_, r) => [r, i]) });
}

function boxCells(b: number): [number, number][] {
  const r0 = Math.floor(b / 3) * 3;
  const c0 = (b % 3) * 3;
  const cells: [number, number][] = [];
  for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 3; c++) cells.push([r, c]);
  return cells;
}

// A cell's short name, e.g. R8C6 (Colin, 10/21: "row 8, column 6" with commas read badly).
export const cellName = (r: number, c: number) => `R${r + 1}C${c + 1}`;

// 1. A box, row or column has just one empty cell left.
function lastCell(grid: Grid): Step | null {
  for (const unit of UNITS) {
    const empty = unit.cells.filter(([r, c]) => grid[r][c] === 0);
    if (empty.length !== 1) continue;
    const [row, col] = empty[0];
    const present = new Set(unit.cells.map(([r, c]) => grid[r][c]));
    const value = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !present.has(n))!;
    return { technique: `Last cell in ${unit.kind}`, row, col, value, focus: unit.cells,
      nudge: `Look at ${unit.label}.`,
      why: `${cap(unit.label)} has only one empty cell, and ${value} is the only number missing.` };
  }
  return null;
}

// 2. A number has only one place it can go in a box, row or column.
function onlySpot(grid: Grid, out: RuledOut): Step | null {
  for (const unit of UNITS) {
    for (let n = 1; n <= 9; n++) {
      if (unit.cells.some(([r, c]) => grid[r][c] === n)) continue;
      const spots = unit.cells.filter(([r, c]) => canGo(grid, out, r, c, n));
      if (spots.length !== 1) continue;
      const [row, col] = spots[0];
      const others = unit.cells.filter(([r, c]) => grid[r][c] === 0 && !(r === row && c === col));
      return { technique: `Only spot in ${unit.kind}`, row, col, value: n, focus: unit.cells,
        blockers: blockersFor(grid, others, n), uses: usedOut(grid, out, others, [n]),
        nudge: `Where can ${n} go in ${unit.label}?`,
        why: `In ${unit.label}, every other empty cell already sees ${n === 8 ? "an" : "a"} ${n}, so ${n} must go at ${cellName(row, col)}.` };
    }
  }
  return null;
}

// 3. A cell has only one number that fits.
function onlyNumber(grid: Grid, out: RuledOut): Step | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== 0) continue;
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => canGo(grid, out, row, col, n));
      if (options.length !== 1) continue;
      const uses = usedOut(grid, out, [[row, col]], ALL_NUMS);
      // Two steps when marks are involved (Colin, 10/21: "every number except 3… or ruled out" was too much at once):
      // what its row, column and box already have, then why the rest are out. The hint fills in {ruled}.
      const seen = ALL_NUMS.filter((n) => !fits(grid, row, col, n));
      const left = ALL_NUMS.filter((n) => fits(grid, row, col, n));
      return { technique: "Only number for cell", row, col, value: options[0], focus: peers(row, col), uses,
        nudge: `Which numbers could go at ${cellName(row, col)}?`,
        why: uses.length
          ? `${cellName(row, col)}'s row, column and box already have ${list(seen)}. That leaves ${list(left, "or")}. {ruled} So it's ${options[0] === 8 ? "an" : "a"} ${options[0]}.`
          : `At ${cellName(row, col)}, every number except ${options[0]} is already in its row, column or box.` };
    }
  }
  return null;
}

// 4. (Medium) Pointing: in a box, every spot for a number sits in one row (or column). The box's number
//    must be in that line, so the number can't go anywhere else in the line. Twin of Star Battle's
//    "Confined region".
// With `all`, every step found is collected there instead of returning the first (used to search hint chains).
function pointing(grid: Grid, out: RuledOut, all?: Step[]): Step | null {
  for (let b = 0; b < 9; b++) {
    const box = boxCells(b);
    for (let n = 1; n <= 9; n++) {
      if (box.some(([r, c]) => grid[r][c] === n)) continue;
      const spots = box.filter(([r, c]) => canGo(grid, out, r, c, n));
      if (spots.length < 2) continue;
      for (const kind of ["row", "column"] as const) {
        const i = kind === "row" ? 0 : 1;
        if (!spots.every((p) => p[i] === spots[0][i])) continue;
        const line = UNITS.find((u) => u.kind === kind && u.label === `${kind} ${spots[0][i] + 1}`)!;
        const remove = line.cells.filter(([r, c]) => !box.some(([a, d]) => a === r && d === c) && canGo(grid, out, r, c, n));
        if (!remove.length) continue;
        const others = box.filter(([r, c]) => grid[r][c] === 0 && !spots.some(([a, d]) => a === r && d === c));
        const st: Step = { technique: "Pointing", row: remove[0][0], col: remove[0][1], value: n, remove, spots,
          blockers: blockersFor(grid, others, n), uses: usedOut(grid, out, others, [n]),
          focus: [...box, ...line.cells.filter((p) => !box.some(([a, d]) => a === p[0] && d === p[1]))],
          nudge: `Where can ${n} go in box ${b + 1}?`,
          why: `In box ${b + 1}, ${n} can only go in ${line.label}. So the box's ${n} is in that ${kind}, and ${n} can't go anywhere else in ${line.label}.` };
        if (!all) return st;
        all.push(st);
      }
    }
  }
  return null;
}

// 5. (Medium) Claiming: Pointing in reverse. In a row (or column), every spot for a number sits inside one box.
//    The line's number must be in that box, so the number can't go anywhere else in the box.
function claiming(grid: Grid, out: RuledOut, all?: Step[]): Step | null {
  for (const line of UNITS.filter((u) => u.kind !== "box")) {
    for (let n = 1; n <= 9; n++) {
      if (line.cells.some(([r, c]) => grid[r][c] === n)) continue;
      const spots = line.cells.filter(([r, c]) => canGo(grid, out, r, c, n));
      if (spots.length < 2) continue;
      const b = Math.floor(spots[0][0] / 3) * 3 + Math.floor(spots[0][1] / 3);
      if (!spots.every(([r, c]) => Math.floor(r / 3) * 3 + Math.floor(c / 3) === b)) continue;
      const box = boxCells(b);
      const inLine = (r: number, c: number) => line.cells.some(([a, d]) => a === r && d === c);
      const remove = box.filter(([r, c]) => !inLine(r, c) && canGo(grid, out, r, c, n));
      if (!remove.length) continue;
      const others = line.cells.filter(([r, c]) => grid[r][c] === 0 && !spots.some(([a, d]) => a === r && d === c));
      const st: Step = { technique: "Claiming", row: remove[0][0], col: remove[0][1], value: n, remove, spots,
        blockers: blockersFor(grid, others, n), uses: usedOut(grid, out, others, [n]),
        focus: [...line.cells, ...box.filter(([r, c]) => !inLine(r, c))],
        nudge: `Where can ${n} go in ${line.label}?`,
        why: `In ${line.label}, ${n} can only go inside box ${b + 1}. So the ${line.kind}'s ${n} is in that box, and ${n} can't go anywhere else in box ${b + 1}.` };
      if (!all) return st;
      all.push(st);
    }
  }
  return null;
}

// 6. (Hard) Pairs: two empty cells in a row, column or box can each only hold the same two numbers. They take
//    those two numbers between them, so no other cell in that unit can hold either one.
function pairs(grid: Grid, out: RuledOut, all?: Step[]): Step | null {
  for (const unit of UNITS) {
    const two = unit.cells
      .filter(([r, c]) => grid[r][c] === 0)
      .map((p) => ({ p, opts: [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => canGo(grid, out, p[0], p[1], n)) }))
      .filter((x) => x.opts.length === 2);
    for (let i = 0; i < two.length; i++) {
      for (let j = i + 1; j < two.length; j++) {
        const [a, b] = two[i].opts;
        if (two[j].opts[0] !== a || two[j].opts[1] !== b) continue;
        const pair = [two[i].p, two[j].p];
        const remove = unit.cells.filter(([r, c]) => !pair.some(([x, y]) => x === r && y === c)
          && (canGo(grid, out, r, c, a) || canGo(grid, out, r, c, b)));
        if (!remove.length) continue;
        const [p, q] = pair;
        const uses = usedOut(grid, out, pair, ALL_NUMS);
        // Two steps (Colin, 10/21): what the unit still needs, then where the pair's other options are
        // already taken (those numbers shown in red, with their line).
        const needs = ALL_NUMS.filter((n) => !unit.cells.some(([r, c]) => grid[r][c] === n));
        const gone = needs.filter((n) => n !== a && n !== b);
        const blockers = gone.flatMap((n) => blockersFor(grid, pair, n));
        const shared = uses.length ? undefined : UNITS.find((u) => u !== unit
          && pair.every(([r, c]) => u.cells.some(([x, y]) => x === r && y === c))
          && gone.every((n) => u.cells.some(([r, c]) => grid[r][c] === n)));
        const both = `${cellName(...p)} and ${cellName(...q)}`;
        const taken = shared
          ? `${cap(shared.label)} already has ${list(gone)}, so ${both} can only be ${a} or ${b}.`
          : `${both} already have ${list(gone)} in their row, column or box${uses.length ? ", or ruled out" : ""}, so they can only be ${a} or ${b}.`;
        const st: Step = { technique: "Pairs", row: remove[0][0], col: remove[0][1], value: a, values: [a, b], remove, spots: pair,
          focus: unit.cells, blockers, uses,
          nudge: `Look for two cells in ${unit.label} that can only hold the same two numbers.`,
          why: `${cap(unit.label)} still needs ${list(needs)}. ${taken} They take the ${a} and the ${b} between them, so no other cell in ${unit.label} can be ${a} or ${b}.` };
        if (!all) return st;
        all.push(st);
      }
    }
  }
  return null;
}

// 7. (Hard) Hidden pairs: the twin of Pairs. In a row, column or box, two numbers can each only go in the same
//    two cells. Those two cells are those two numbers, so every other number is ruled out of them.
function hiddenPairs(grid: Grid, out: RuledOut, all?: Step[]): Step | null {
  for (const unit of UNITS) {
    const spotsOf = (n: number) => unit.cells.filter(([r, c]) => canGo(grid, out, r, c, n));
    const missing = ALL_NUMS.filter((n) => !unit.cells.some(([r, c]) => grid[r][c] === n));
    const two = missing.map((n) => ({ n, spots: spotsOf(n) })).filter((x) => x.spots.length === 2);
    for (let i = 0; i < two.length; i++) {
      for (let j = i + 1; j < two.length; j++) {
        const same = two[i].spots.every(([r, c], k) => two[j].spots[k][0] === r && two[j].spots[k][1] === c);
        if (!same) continue;
        const a = two[i].n, b = two[j].n;
        const pair = two[i].spots;
        const values = ALL_NUMS.filter((n) => n !== a && n !== b && pair.some(([r, c]) => canGo(grid, out, r, c, n)));
        if (!values.length) continue;
        const remove = pair.filter(([r, c]) => values.some((n) => canGo(grid, out, r, c, n)));
        const others = unit.cells.filter(([r, c]) => grid[r][c] === 0 && !pair.some(([x, y]) => x === r && y === c));
        const [p, q] = pair;
        const st: Step = { technique: "Hidden pairs", row: remove[0][0], col: remove[0][1], value: values[0], values, remove,
          spots: pair, focus: unit.cells,
          blockers: [...blockersFor(grid, others, a), ...blockersFor(grid, others, b)],
          uses: usedOut(grid, out, others, [a, b]),
          nudge: `In ${unit.label}, look for two numbers that can only go in the same two cells.`,
          why: `In ${unit.label}, ${a} and ${b} can only go in ${cellName(...p)} and ${cellName(...q)}. So those two cells are the ${a} and the ${b}, and nothing else can go in them.` };
        if (!all) return st;
        all.push(st);
      }
    }
  }
  return null;
}

// 8. (Expert) X-wing: in two rows, a number can only go in the same two columns. The two rows need two of that
//    number, one in each column, so it can't go anywhere else in those two columns. Same with rows and columns swapped.
function xWing(grid: Grid, out: RuledOut, all?: Step[]): Step | null {
  for (const kind of ["row", "column"] as const) {
    const other = kind === "row" ? "column" : "row";
    const line = (i: number) => UNITS.find((u) => u.label === `${kind} ${i + 1}`)!;
    const cross = (j: number) => UNITS.find((u) => u.label === `${other} ${j + 1}`)!;
    const at = (p: [number, number]) => (kind === "row" ? p[1] : p[0]); // the cell's position along the line
    for (let n = 1; n <= 9; n++) {
      const two = [0, 1, 2, 3, 4, 5, 6, 7, 8]
        .map((i) => ({ i, spots: line(i).cells.filter(([r, c]) => canGo(grid, out, r, c, n)) }))
        .filter((x) => x.spots.length === 2 && !line(x.i).cells.some(([r, c]) => grid[r][c] === n));
      for (let a = 0; a < two.length; a++) {
        for (let b = a + 1; b < two.length; b++) {
          const [j1, j2] = two[a].spots.map(at);
          if (two[b].spots.map(at).join() !== [j1, j2].join()) continue;
          const corners = [...two[a].spots, ...two[b].spots];
          const remove = [...cross(j1).cells, ...cross(j2).cells]
            .filter((p) => !corners.some((q) => q[0] === p[0] && q[1] === p[1]) && canGo(grid, out, p[0], p[1], n));
          if (!remove.length) continue;
          const bases = [line(two[a].i), line(two[b].i)];
          const others = bases.flatMap((u) => u.cells).filter(([r, c]) => grid[r][c] === 0 && !corners.some((q) => q[0] === r && q[1] === c));
          const lines = `${kind}s ${two[a].i + 1} and ${two[b].i + 1}`;
          const crosses = `${other}s ${j1 + 1} and ${j2 + 1}`;
          const st: Step = { technique: "X-wing", row: remove[0][0], col: remove[0][1], value: n, remove, spots: corners,
            focus: bases.flatMap((u) => u.cells), blockers: blockersFor(grid, others, n), uses: usedOut(grid, out, others, [n]),
            nudge: `Where can ${n} go in ${lines}?`,
            why: `In ${lines}, ${n} can only go in ${crosses}. The two ${kind}s need two ${n}s, one in each of those ${other}s, so ${n} can't go anywhere else in ${crosses}.` };
          if (!all) return st;
          all.push(st);
        }
      }
    }
  }
  return null;
}

// 9. (Expert) Y-wing: a cell that can only be a or b sees one cell that's a-or-c and another that's b-or-c.
//    Whichever the first cell is, one of the other two must be c, so a cell that sees both of them can't be c.
function yWing(grid: Grid, out: RuledOut, all?: Step[]): Step | null {
  const opts = (r: number, c: number) => ALL_NUMS.filter((n) => canGo(grid, out, r, c, n));
  const sees = (p: [number, number], q: [number, number]) => (p[0] !== q[0] || p[1] !== q[1])
    && (p[0] === q[0] || p[1] === q[1] || (Math.floor(p[0] / 3) === Math.floor(q[0] / 3) && Math.floor(p[1] / 3) === Math.floor(q[1] / 3)));
  const twos: { p: [number, number]; o: number[] }[] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && opts(r, c).length === 2) twos.push({ p: [r, c], o: opts(r, c) });
  for (const pivot of twos) {
    const [a, b] = pivot.o;
    const near = twos.filter((x) => sees(pivot.p, x.p));
    for (const w1 of near.filter((x) => x.o.includes(a) && !x.o.includes(b))) {
      const c = w1.o.find((n) => n !== a)!;
      for (const w2 of near.filter((x) => x.o.includes(b) && x.o.includes(c) && !x.o.includes(a))) {
        if (!sees(pivot.p, w2.p) || (w1.p[0] === w2.p[0] && w1.p[1] === w2.p[1])) continue;
        const remove: [number, number][] = [];
        for (let r = 0; r < 9; r++) for (let d = 0; d < 9; d++) {
          const q: [number, number] = [r, d];
          if (sees(q, w1.p) && sees(q, w2.p) && !(r === pivot.p[0] && d === pivot.p[1]) && canGo(grid, out, r, d, c)) remove.push(q);
        }
        if (!remove.length) continue;
        const [pv, p1, p2] = [pivot.p, w1.p, w2.p].map(([r, d]) => cellName(r, d));
        const st: Step = { technique: "Y-wing", row: remove[0][0], col: remove[0][1], value: c, remove,
          spots: [pivot.p, w1.p, w2.p], focus: [pivot.p, w1.p, w2.p], uses: usedOut(grid, out, [pivot.p, w1.p, w2.p], ALL_NUMS),
          nudge: "Look for three cells that can each only be two numbers.",
          why: `${cap(pv)} can only be ${a} or ${b}. If it's ${a}, then ${p1} (${a} or ${c}) must be ${c}. If it's ${b}, then ${p2} (${b} or ${c}) must be ${c}. Either way one of them is ${c}, so no cell that sees both can be ${c}.` };
        if (!all) return st;
        all.push(st);
      }
    }
  }
  return null;
}

type Technique = (grid: Grid, out: RuledOut) => Step | null;
export const PLACING: Technique[] = [lastCell, onlySpot, onlyNumber];
// Every rule-out step available right now (for searching short hint chains).
export function allRuleOuts(grid: Grid, out: RuledOut): Step[] {
  const all: Step[] = [];
  for (const t of [pointing, claiming, pairs, hiddenPairs, xWing, yWing]) t(grid, out, all);
  return all;
}
export const EASY_TECHNIQUES: Technique[] = [lastCell, onlySpot, onlyNumber];
export const MEDIUM_TECHNIQUES: Technique[] = [...EASY_TECHNIQUES, pointing, claiming];
export const HARD_TECHNIQUES: Technique[] = [...MEDIUM_TECHNIQUES, pairs, hiddenPairs];
export const EXPERT_TECHNIQUES: Technique[] = [...HARD_TECHNIQUES, xWing, yWing];
export const ALL_TECHNIQUES = EXPERT_TECHNIQUES;

// Next move using the easiest trick that works, or null if none of them do.
export function nextStep(grid: Grid, out: RuledOut = new Set(), techniques = ALL_TECHNIQUES): Step | null {
  for (const technique of techniques) {
    const step = technique(grid, out);
    if (step) return step;
  }
  return null;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
// 2, 3 and 9
export const list = (ns: (number | string)[], and = "and") => (ns.length < 2 ? `${ns.join("")}` : `${ns.slice(0, -1).join(", ")} ${and} ${ns[ns.length - 1]}`);

// Every cell that shares a row, column or box with this one.
function peers(row: number, col: number): [number, number][] {
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  const seen = new Set<string>();
  const out: [number, number][] = [];
  const add = (r: number, c: number) => {
    if (!seen.has(`${r},${c}`)) seen.add(`${r},${c}`), out.push([r, c]);
  };
  for (let i = 0; i < 9; i++) add(row, i), add(i, col);
  for (const [r, c] of boxCells(box)) add(r, c);
  return out;
}
