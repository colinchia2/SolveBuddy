// Hint walkthroughs (Colin 11/5, mockup https://claude.ai/artifact/MQeXLRWBCVfXdC4fo1Jnpa). A hint is a few short steps,
// each showing its own cells. The rules he set: every hint stands alone and starts by pointing somewhere; it says what we
// know before using it; every ruled-out way or square gets its reason; plain words, with no cell codes and no sums.
// Blue = where it goes, red box = what blocks it, red × = ruled out. The last step places the number.
import { type Grid, fits } from "./fullGrid.ts";
import { blockersFor } from "./techniques.ts";

type Cell = [number, number];
type Cage = { cells: Cell[]; sum: number };
type Opts = (p: Cell) => number[];
export type WalkRow = { label: string; why: string; ok?: boolean };
export type WalkStep = { title: string; body?: string; zone?: Cell[]; no?: Cell[]; block?: Cell[]; spot?: Cell; rows?: WalkRow[] };
type Allows = { empty: Cell[]; placed: number[]; need: number; fitWays: number[][] };

const WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
export const an = (n: number) => `${n === 8 ? "an" : "a"} ${n}`;
const and = (xs: (string | number)[], last = "and") => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${last} ${xs[xs.length - 1]}`);
const way = (nums: number[]) => (nums.length === 2 ? and(nums) : nums.join(", "));
const box = ([r, c]: Cell) => Math.floor(r / 3) * 3 + Math.floor(c / 3);
const BOXES = ["top left", "top", "top right", "left", "middle", "right", "bottom left", "bottom", "bottom right"];
const uniq = (cells: Cell[]) => [...new Map(cells.map((p) => [p.join(), p])).values()] as Cell[];
const inCage = (cg: Cage, [r, c]: Cell) => cg.cells.some(([a, b]) => a === r && b === c);

// The row, column or box that holds both cells, named from where the player is looking.
function lineOf(b: Cell, p: Cell) {
  if (b[0] === p[0]) return `row ${b[0] + 1}`;
  if (b[1] === p[1]) return `column ${b[1] + 1}`;
  return "this box";
}
// What all these cells share, for a number that must go somewhere among the rest of it.
function sharedUnit(cells: Cell[]) {
  if (cells.every((p) => box(p) === box(cells[0]))) return { name: "box", of: (p: Cell) => box(p) === box(cells[0]) };
  if (cells.every((p) => p[0] === cells[0][0])) return { name: "row", of: (p: Cell) => p[0] === cells[0][0] };
  if (cells.every((p) => p[1] === cells[0][1])) return { name: "column", of: (p: Cell) => p[1] === cells[0][1] };
  return null;
}
// Say why these blockers rule n out: "Row 7 has a 6", "Row 7 and row 8 each have a 6".
function blockedBy(blockers: { cell: Cell }[], cells: Cell[], n: number) {
  const names = [...new Set(blockers.map((b) => lineOf(b.cell, cells.find((p) => lineOf(b.cell, p) !== "this box" || box(p) === box(b.cell)) ?? cells[0])))];
  return `${cap(and(names))} ${names.length > 1 ? "each have" : "has"} ${an(n)}`;
}

// Why a cage's squares can't hold d. `generic` is the same reason with the number left out, so reasons can be grouped.
function whyNot(grid: Grid, cage: Cage, a: Allows, d: number, opts: Opts, cages: Cage[]) {
  if (a.placed.includes(d)) {
    const at = cage.cells.find(([r, c]) => grid[r][c] === d)!;
    return { text: `The cage already has ${an(d)}`, generic: "The cage already has one", block: [at] };
  }
  const blockers = blockersFor(grid, a.empty, d);
  const covered = a.empty.every((p) => !fits(grid, p[0], p[1], d));
  if (covered && blockers.length) {
    const text = blockedBy(blockers, a.empty, d);
    return { text, generic: blockers.length === 1 ? text.replace(` has ${an(d)}`, " already has one") : text, block: blockers.map((b) => b.cell) };
  }
  // Not in plain sight: the number has to go elsewhere in a row, column or box these squares share.
  const unit = sharedUnit(a.empty);
  if (unit) {
    const all: Cell[] = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (unit.of([r, c]) && !grid[r][c] && !inCage(cage, [r, c]) && opts([r, c]).includes(d)) all.push([r, c]);
    const home = cages.find((cg) => cg !== cage && all.length && all.every((p) => inCage(cg, p)));
    if (home) return { text: `The cage of ${home.sum} takes this ${unit.name}'s ${d}`, generic: `The cage of ${home.sum} takes those`, block: all };
    if (all.length) return { text: `This ${unit.name}'s ${d} has to go in another square`, generic: "They have to go in other squares", block: all };
  }
  return { text: `Your pencil marks rule out the ${d} here`, generic: "Your pencil marks rule these out", block: [] as Cell[] };
}

// A way that fails even though each number has a square: two numbers both need the same one.
function clash(nums: number[], a: Allows, opts: Opts) {
  const only = nums.map((d) => ({ d, cells: a.empty.filter((p) => opts(p).includes(d)) })).filter((x) => x.cells.length === 1);
  for (const x of only) for (const y of only) if (x.d < y.d && x.cells[0].join() === y.cells[0].join()) return `The ${x.d} and ${y.d} would both need the same square`;
  return "These numbers can't all fit";
}

// Cage sum: point at the cage, rule out what can't work, say what's left, then place the number.
export function cageWalk(grid: Grid, cage: Cage, a: Allows, opts: Opts, cages: Cage[], cell: Cell, v: number): WalkStep[] {
  const n = a.empty.length, placedCells = cage.cells.filter(([r, c]) => grid[r][c]), rest = a.empty.filter((p) => p.join() !== cell.join());
  const all: number[][] = [];
  const pick = (from: number, chosen: number[], left: number) => {
    if (chosen.length === n) { if (left === 0) all.push(chosen); return; }
    for (let d = from; d <= 9 && d <= left; d++) pick(d + 1, [...chosen, d], left - d);
  };
  pick(1, [], a.need);
  const fit = new Set(a.fitWays.map((w) => w.join()));
  const steps: WalkStep[] = [{
    title: `Look at this cage. ${cap(WORD[n])} square${n > 1 ? "s" : ""} ${placedCells.length ? (n > 1 ? "are" : "is") + " left" : "make " + a.need}.`,
    body: placedCells.length ? `The cage totals ${cage.sum} and already has ${and(a.placed.map(an))}, so ${n > 1 ? "these squares make" : "this square is"} ${a.need}.`
      : all.length <= 3 ? `There ${all.length > 1 ? `are only ${WORD[all.length]} ways` : "is only one way"} to do it.` : "Let's see which numbers it can use.",
    zone: a.empty, block: placedCells,
  }];
  const wrong = all.filter((w) => !fit.has(w.join()));
  if (wrong.length && all.length <= 6) {
    const rows = wrong.map((w) => {
      const d = w.find((x) => a.placed.includes(x)) ?? w.find((x) => !a.empty.some((p) => opts(p).includes(x)));
      const r = d ? whyNot(grid, cage, a, d, opts, cages) : null;
      return { row: { label: way(w), why: r ? r.text : clash(w, a, opts) }, block: r?.block ?? [] };
    });
    steps.push({ title: "Check each way", zone: a.empty, block: uniq([...placedCells, ...rows.flatMap((x) => x.block)]), rows: rows.map((x) => x.row) });
  } else if (wrong.length) {
    const usable = new Set(a.fitWays.flat());
    const groups = new Map<string, { nums: number[]; block: Cell[] }>();
    for (let d = 1; d <= 9; d++) {
      if (usable.has(d) || !all.some((w) => w.includes(d))) continue;
      const r = a.placed.includes(d) || !a.empty.some((p) => opts(p).includes(d)) ? whyNot(grid, cage, a, d, opts, cages) : null;
      const k = r?.generic ?? "These numbers can't all fit";
      const g = groups.get(k) ?? { nums: [], block: [] };
      g.nums.push(d);
      g.block.push(...(r?.block ?? []));
      groups.set(k, g);
    }
    const shared = sharedUnit(a.empty);
    steps.push({ title: "Some numbers can't be used", body: shared ? `All of these squares sit in the same ${shared.name}.` : undefined, zone: a.empty,
      block: uniq([...placedCells, ...[...groups.values()].flatMap((g) => g.block)]),
      rows: [...groups].map(([why, g]) => ({ label: `No ${and(g.nums, "or")}`, why })) });
  }
  const has = a.fitWays.every((w) => w.includes(v));
  if (a.fitWays.length === 1) {
    if (n > 1) steps.push({ title: `So it's ${and(a.fitWays[0])}`, body: `That's the only way left, so ${n === 2 ? "these two squares hold" : "these squares hold"} those numbers.`, zone: a.empty });
  } else {
    steps.push({ title: has ? `Every way left has ${an(v)}` : "That leaves these ways", zone: a.empty,
      rows: a.fitWays.map((w) => ({ label: way(w), why: has ? `Has ${an(v)}` : "Still possible", ok: true })) });
  }
  // Which square: the other numbers are blocked here, or this number is blocked everywhere else.
  const others = [...new Set(a.fitWays.flat())].filter((d) => d !== v);
  const wb = others.map((d) => ({ d, b: blockersFor(grid, [cell], d) })).filter((x) => x.b.length && !fits(grid, cell[0], cell[1], x.d));
  const vb = rest.length ? blockersFor(grid, rest, v) : [];
  const vCovers = rest.length > 0 && vb.length > 0 && rest.every((p) => !fits(grid, p[0], p[1], v));
  const last: WalkStep = { title: `It's ${an(v)}`, spot: cell };
  if (vCovers) Object.assign(last, { body: `${blockedBy(vb, rest, v)}, so the ${v} goes in this square.`, no: rest, block: vb.map((b) => b.cell) });
  else if (others.length && wb.length === others.length) {
    Object.assign(last, { body: `${cap(and(wb.map((x) => `${lineOf(x.b[0].cell, cell)} has ${an(x.d)}`)))}, so this square is the ${v}.`, zone: rest, block: wb.map((x) => x.b[0].cell) });
  } else Object.assign(last, { body: rest.length ? `This is the only square here that can take the ${v}.` : `That makes this square the ${v}.`, zone: rest });
  steps.push(last);
  return steps;
}

// Squeeze: a number has one square left in a row, column or box. Reasons are grouped so a step never gets too busy.
export function squeezeWalk(grid: Grid, cages: Cage[], label: string, cells: Cell[], d: number, cell: Cell, opts: Opts, allows: (cg: Cage) => Allows): WalkStep[] {
  const empty = cells.filter(([r, c]) => !grid[r][c]), others = empty.filter((p) => p.join() !== cell.join());
  const name = ([r, c]: Cell) => (label.startsWith("row") ? `Column ${c + 1}` : label.startsWith("column") ? `Row ${r + 1}` : `Square ${(r % 3) * 3 + (c % 3) + 1}`);
  const plain = new Map<string, { label: string; why: string; cells: Cell[]; block: Cell[] }>();
  const partner: { row: WalkRow; cells: Cell[]; block: Cell[] }[] = [], cant: { row: WalkRow; cells: Cell[]; block: Cell[] }[] = [];
  const seen = new Set<string>();
  for (const p of others) {
    if (seen.has(p.join())) continue;
    if (!fits(grid, p[0], p[1], d)) {
      const b = blockersFor(grid, [p], d)[0];
      if (b) {
        const line = lineOf(b.cell, p);
        const lab = line === "this box" ? `${cap(BOXES[box(p)])} box` : cap(line);
        const g = plain.get(lab) ?? { label: lab, why: `Already has ${an(d)}`, cells: [], block: [b.cell] };
        g.cells.push(p);
        plain.set(lab, g);
        seen.add(p.join());
        continue;
      }
    }
    const cg = cages.find((x) => inCage(x, p));
    const a = cg ? allows(cg) : null;
    if (cg && a && a.empty.length === 2 && a.need - d !== d) {
      const buddy = a.empty.find((q) => q.join() !== p.join())!, needs = a.need - d;
      if (needs >= 1 && needs <= 9 && !opts(buddy).includes(needs)) {
        const b = blockersFor(grid, [buddy], needs).filter(() => !fits(grid, buddy[0], buddy[1], needs));
        partner.push({ row: { label: name(p), why: `Cage of ${cg.sum} needs ${an(needs)} here${b[0] ? `, and ${lineOf(b[0].cell, buddy)} has ${an(needs)}` : ", and it can't go there"}` }, cells: [p], block: b.map((x) => x.cell) });
        seen.add(p.join());
        continue;
      }
    }
    if (cg && a) {
      const mates = a.empty.filter((q) => others.some((o) => o.join() === q.join()) && !a.fitWays.flat().includes(d));
      const nums = [...new Set(a.fitWays.flat())].sort((x, y) => x - y);
      const why = a.need - d === d && a.empty.length === 2 ? `Cage of ${cg.sum} would need two ${d}s`
        : a.fitWays.length === 1 ? `Cage of ${cg.sum} must be ${and(nums)} here` : `Cage of ${cg.sum} can't use ${an(d)} here`;
      const these = mates.length ? mates : [p];
      cant.push({ row: { label: these.length > 1 ? `Cage of ${cg.sum}` : name(p), why }, cells: these, block: cage2(cg, grid) });
      these.forEach((q) => seen.add(q.join()));
      continue;
    }
    cant.push({ row: { label: name(p), why: "Your pencil marks rule it out" }, cells: [p], block: [] });
    seen.add(p.join());
  }
  const blockedRows = [...plain.values()];
  const count = others.length;
  const steps: WalkStep[] = [{ title: `Look at ${label}. Where can the ${d} go?`, body: `${cap(WORD[empty.length])} squares are still empty.`, zone: empty }];
  const groups = [
    { title: "Their cage partner is blocked", body: `${an(d) === `an ${d}` ? "An" : "A"} ${d} here needs a certain number next to it, and that number can't go there.`, items: partner },
    { title: `Their cage can't hold ${an(d)}`, body: "These cages only work with other numbers.", items: cant },
    { title: `Already has ${an(d)}`, body: "", items: blockedRows.map((g) => ({ row: { label: g.label, why: g.why }, cells: g.cells, block: g.block })) },
  ].filter((g) => g.items.length);
  const rowsTotal = groups.reduce((t, g) => t + g.items.length, 0);
  if (rowsTotal <= 4) {
    const items = groups.flatMap((g) => g.items);
    steps.push({ title: count > 1 ? "Everything but one is out" : "One square is out", zone: [cell], no: items.flatMap((x) => x.cells), block: uniq(items.flatMap((x) => x.block)), rows: items.map((x) => x.row) });
  } else {
    const done: Cell[] = [];
    for (const g of groups) {
      done.push(...g.items.flatMap((x) => x.cells));
      steps.push({ title: g.title, body: g.body || undefined, zone: [cell], no: [...done], block: uniq(g.items.flatMap((x) => x.block)), rows: g.items.map((x) => x.row) });
    }
  }
  steps.push({ title: `It's ${an(d)}`, body: "That leaves one square.", spot: cell });
  return steps;
}
const cage2 = (cg: Cage, grid: Grid) => cg.cells.filter(([r, c]) => grid[r][c]);

// Last cell in a cage: the cage is full but for one square.
export function lastCageWalk(grid: Grid, cage: Cage, cell: Cell, v: number): WalkStep[] {
  const placed = cage.cells.filter(([r, c]) => grid[r][c]);
  return [
    { title: "Look at this cage. One square is left.", body: `The cage totals ${cage.sum} and already has ${and(placed.map(([r, c]) => grid[r][c]))}.`, zone: [cell], block: placed },
    { title: `It's ${an(v)}`, body: `That leaves ${v} for this square.`, spot: cell },
  ];
}

// Last cell in a row, column or box.
export function lastCellWalk(label: string, cell: Cell, v: number): WalkStep[] {
  return [
    { title: `Look at ${label}. One square is left.`, body: `It has every number except the ${v}.`, zone: [cell] },
    { title: `It's ${an(v)}`, body: "That's the only number missing.", spot: cell },
  ];
}

// Only number for a square: its row, column and box use up the other eight.
export function onlyNumberWalk(grid: Grid, cell: Cell, v: number, opts: Opts): WalkStep[] {
  const groups = new Map<string, { nums: number[]; block: Cell[] }>();
  for (let n = 1; n <= 9; n++) {
    if (n === v) continue;
    const b = fits(grid, cell[0], cell[1], n) ? null : blockersFor(grid, [cell], n)[0];
    const line = b ? lineOf(b.cell, cell) : "marks";
    const g = groups.get(line) ?? { nums: [], block: [] };
    g.nums.push(n);
    if (b) g.block.push(b.cell);
    groups.set(line, g);
  }
  const rows = [...groups].map(([line, g]) => (line === "marks" ? { label: "Your marks", why: `Rule out ${and(g.nums)}` } : { label: cap(line), why: `Has ${and(g.nums)}` }));
  return [
    { title: "Look at this square. What can it be?", body: "Check its row, column and box.", zone: [cell] },
    { title: "Eight numbers are out", zone: [cell], block: uniq([...groups.values()].flatMap((g) => g.block)), rows },
    { title: `It's ${an(v)}`, body: "That's the only number left.", spot: cell },
  ];
}

// The 45 rule, in words: what the whole area adds up to, what the cages use, and what that leaves for one square.
export function rule45Walk(label: string, k: number, cells: Cell[], cell: Cell, v: number, line: string, inside: boolean, placed: Cell[]): WalkStep[] {
  const total = 45 * k;
  return [
    { title: `Look at ${label}. It adds up to ${total}.`, body: k === 1 ? "Every row, column and box holds 1 to 9, which adds up to 45." : `That's ${WORD[k]} rows or columns of 1 to 9, at 45 each.`, zone: cells },
    { title: inside ? "One square is left over" : "One square sticks out", body: line, zone: [cell], block: placed },
    { title: `It's ${an(v)}`, body: inside ? `That leaves ${v} for this square.` : `That extra is the ${v} in this square.`, spot: cell },
  ];
}
