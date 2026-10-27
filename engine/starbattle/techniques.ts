// Star Battle human-style tricks, easiest first. Each looks at the board and finds one next move, or nothing.
// The grader uses these to rate a puzzle, and the Hint button uses the same list.
// Double Star Battle (10×10, 2 stars per row, column and region) uses the same tricks, counting stars needed
// instead of "has a star yet"; with one star per unit every trick behaves exactly as it always has.
import { type Regions, perUnit } from "./layout.ts";

export const EMPTY = 0, CROSS = 1, STAR = 2;
export type Board = number[][]; // EMPTY, CROSS or STAR per cell
type Cell = [number, number];

export type Step = {
  technique: string; // chip name shown in a hint
  star: Cell | null; // a star to place, or...
  cross: Cell[]; // ...cells to cross out
  focus: Cell[]; // cells to highlight
  nudge: string; // "Nudge" level of a hint
  why: string; // "Explain" level of a hint
  // What if only: the forced moves after the pretend star, in order, and the line that runs dry.
  chain?: { star: Cell | null; cross: Cell[]; focus: Cell[]; why: string }[]; // a star's cross = what it rules out
  pretendCross?: Cell[]; // what the pretend star rules out
  dead?: { label: string; cells: Cell[] };
};

// Friendly names for regions A–L, matching the colors on screen.
export const COLOR_NAMES: Record<string, string> = {
  A: "purple", B: "yellow", C: "teal", D: "green", E: "pink", F: "orange", G: "blue", H: "tan", I: "lime", J: "grey",
  K: "brown", L: "magenta",
};

type Unit = { kind: "row" | "column" | "region"; label: string; cells: Cell[]; letter?: string };

// Built once per puzzle: the hint runs every trick many times (Double "What if" chains especially).
const unitCache = new WeakMap<Regions, Unit[]>();
export function units(regions: Regions): Unit[] {
  let out = unitCache.get(regions);
  if (!out) unitCache.set(regions, (out = buildUnits(regions)));
  return out;
}
function buildUnits(regions: Regions): Unit[] {
  const n = regions.length;
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ kind: "row", label: `row ${i + 1}`, cells: [...Array(n).keys()].map((c) => [i, c] as Cell) });
    out.push({ kind: "column", label: `column ${i + 1}`, cells: [...Array(n).keys()].map((r) => [r, i] as Cell) });
  }
  for (const letter of [...new Set(regions.join(""))].sort()) {
    const cells: Cell[] = [];
    regions.forEach((row, r) => [...row].forEach((l, c) => l === letter && cells.push([r, c])));
    out.push({ kind: "region", label: `the ${COLOR_NAMES[letter]} region`, cells, letter });
  }
  return out;
}

const at = (b: Board, [r, c]: Cell) => b[r][c];
const open = (b: Board, cells: Cell[]) => cells.filter((p) => at(b, p) === EMPTY);
const hasStar = (b: Board, cells: Cell[]) => cells.some((p) => at(b, p) === STAR);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const touch = ([a, b]: Cell, [c, d]: Cell) => Math.abs(a - c) <= 1 && Math.abs(b - d) <= 1;
// Stars a row, column or region still needs (0 = done).
const needOf = (b: Board, regions: Regions, u: Unit) => perUnit(regions) - u.cells.filter((p) => at(b, p) === STAR).length;
// How many more stars fit in a unit's open cells without touching, counted up to `upTo` (2 unless 3 are needed).
function room(b: Board, cells: Cell[], upTo = 2) {
  const o = open(b, cells);
  if (upTo <= 2) {
    for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) if (!touch(o[i], o[j])) return 2;
    return Math.min(o.length, 1);
  }
  // 3 stars: search for the most non-touching cells, stopping as soon as there are enough (one shared list, no copies:
  // this runs thousands of times per hint on a 12×12).
  let best = 0;
  const chosen: Cell[] = [];
  const grow = (from: number) => {
    if (chosen.length > best) best = chosen.length;
    if (best >= upTo) return;
    for (let i = from; i < o.length && best < upTo; i++) {
      let free = true;
      for (const p of chosen) if (touch(p, o[i])) { free = false; break; }
      if (free) { chosen.push(o[i]); grow(i + 1); chosen.pop(); }
    }
  };
  grow(0);
  return best;
}
// A row, column or region that can no longer fit the stars it still needs.
const noRoom = (b: Board, regions: Regions, u: Unit) => { const need = needOf(b, regions, u); return need > 0 && room(b, u.cells, need) < need; };
const nowhere = (regions: Regions) => (perUnit(regions) === 1 ? "nowhere left for its star" : "no room left for its stars");
const stars = (k: number) => (k === 1 ? "1 more star" : `${k} more stars`);

// Every cell a star at (r, c) rules out: the 8 cells touching it, and its row, column and region once they're
// full (with one star per unit that's always). b = the board, to count a Double board's stars.
export function ruledOutBy(regions: Regions, [r, c]: Cell, b?: Board): Cell[] {
  const n = regions.length, k = perUnit(regions);
  const full = (inUnit: (a: number, d: number) => boolean) => {
    if (k === 1) return true;
    let count = 1;
    if (b) for (let a = 0; a < n; a++) for (let d = 0; d < n; d++) if (inUnit(a, d) && b[a][d] === STAR && !(a === r && d === c)) count++;
    return count >= k;
  };
  const rowFull = full((a) => a === r), colFull = full((_, d) => d === c), regFull = full((a, d) => regions[a][d] === regions[r][c]);
  const out: Cell[] = [];
  for (let a = 0; a < n; a++) {
    for (let d = 0; d < n; d++) {
      if (a === r && d === c) continue;
      const touching = Math.abs(a - r) <= 1 && Math.abs(d - c) <= 1;
      if ((a === r && rowFull) || (d === c && colFull) || (regions[a][d] === regions[r][c] && regFull) || touching) out.push([a, d]);
    }
  }
  return out;
}

// 1. A star rules out its row, column, region and every touching cell.
function starRulesOut(b: Board, regions: Regions): Step | null {
  for (let r = 0; r < b.length; r++) {
    for (let c = 0; c < b.length; c++) {
      if (b[r][c] !== STAR) continue;
      const cross = open(b, ruledOutBy(regions, [r, c], b));
      if (!cross.length) continue;
      return { technique: "Star rules out", star: null, cross, focus: [[r, c]],
        nudge: `Look at the star in row ${r + 1}.`,
        why: perUnit(regions) === 1 ? "A star rules out the rest of its row, column and region, and every cell touching it."
          : `A star rules out every cell touching it. Once a row, column or region has ${perUnit(regions) === 2 ? "both" : "all"} its stars, the rest of it is out too.` };
    }
  }
  return null;
}

// 2. A row, column or region with only as many open cells as stars it still needs gets its stars there.
function lastCell(b: Board, regions: Regions): Step | null {
  const k = perUnit(regions);
  for (const u of units(regions)) {
    const need = needOf(b, regions, u);
    if (need <= 0) continue;
    const o = open(b, u.cells);
    if (o.length !== need) continue;
    return { technique: need === 1 ? `Last cell in ${u.kind}` : `Last cells in ${u.kind}`, star: o[0], cross: [], focus: u.cells,
      nudge: `Look at ${u.label}.`,
      why: k === 1 ? `${cap(u.label)} has only one cell left that can hold a star, so its star goes there.`
        : `${cap(u.label)} needs ${stars(need)} and has only ${need} cell${need === 1 ? "" : "s"} left, so ${need === 1 ? "it gets" : "they all get"} a star.` };
  }
  return null;
}

// 2b. (2 or 3 stars) Squeeze: try every way to fit a unit's missing stars without touching or overfilling a row,
//     column or region. A cell every way uses is a star; cells no way uses are out. E.g. 2 stars in 3 cells
//     side by side must go at both ends.
function squeeze(b: Board, regions: Regions): Step | null {
  const n = regions.length;
  if (perUnit(regions) < 2) return null;
  const all = units(regions);
  const needs = all.map((u) => needOf(b, regions, u));
  // units() lists row i at 2i, column i at 2i + 1, then the regions in letter order.
  const regAt = new Map(all.slice(2 * n).map((u, i) => [u.letter, 2 * n + i]));
  const unitsOf = ([r, c]: Cell) => [2 * r, 2 * c + 1, regAt.get(regions[r][c])!];
  const fitsOne = (p: Cell) => unitsOf(p).every((i) => needs[i] >= 1);
  const fitsTwo = (p: Cell, q: Cell) => {
    if (touch(p, q) || !fitsOne(p) || !fitsOne(q)) return false;
    const [pr, pc, pg] = unitsOf(p), [qr, qc, qg] = unitsOf(q);
    return (pr !== qr || needs[pr] >= 2) && (pc !== qc || needs[pc] >= 2) && (pg !== qg || needs[pg] >= 2);
  };
  for (const [ui, u] of all.entries()) {
    const need = needs[ui];
    if (need <= 0) continue;
    const o = open(b, u.cells);
    if (o.length <= need) continue;
    let total = 0, used: (p: Cell) => number;
    if (need <= 2) {
      const ways: Cell[][] = [];
      if (need === 1) { for (const p of o) if (fitsOne(p)) ways.push([p]); }
      else { for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) if (fitsTwo(o[i], o[j])) ways.push([o[i], o[j]]); }
      total = ways.length;
      used = (p: Cell) => ways.filter((w) => w.includes(p)).length;
    } else {
      // 3 stars: every pair must fit, and no unit may get more stars than it needs. Counted per cell rather than
      // listing every triple (a 12×12 region can have thousands); same answer, much quicker.
      const m = o.length, us = o.map(unitsOf), fit2 = o.map((p) => o.map((q) => fitsTwo(p, q)));
      const count = new Array(m).fill(0);
      for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
        if (!fit2[i][j]) continue;
        for (let x = j + 1; x < m; x++) {
          if (!fit2[i][x] || !fit2[j][x]) continue;
          // Pairs already fit, so the only overfill left is all three in one row, column or region needing fewer than 3.
          let over = false;
          for (let s = 0; s < 3; s++) if (us[i][s] === us[j][s] && us[j][s] === us[x][s] && needs[us[i][s]] < 3) over = true;
          if (over) continue;
          count[i]++; count[j]++; count[x]++; total++;
        }
      }
      used = (p: Cell) => count[o.indexOf(p)];
    }
    if (!total) continue; // a broken board: the mistake check deals with it
    const star = o.find((p) => used(p) === total);
    if (star) {
      return { technique: "Squeeze", star, cross: [], focus: u.cells, nudge: `Look at ${u.label}.`,
        why: `${cap(u.label)} needs ${stars(need)}. Every way to fit ${need === 1 ? "it" : "them"} without touching uses R${star[0] + 1}C${star[1] + 1}, so that's a star.` };
    }
    const cross = o.filter((p) => !used(p));
    if (cross.length) {
      return { technique: "Squeeze", star: null, cross, focus: u.cells, nudge: `Look at ${u.label}.`,
        why: `${cap(u.label)} needs ${stars(need)}. No way to fit ${need === 1 ? "it" : "them"} without touching, or overfilling a row, column or region, uses the striped cells, so they're out.` };
    }
  }
  return null;
}

// 3. A region whose open cells all sit in one row (or column) claims that line:
//    no other cell in that line can have a star.
function confinedRegion(b: Board, regions: Regions): Step | null {
  const all = units(regions);
  const k = perUnit(regions);
  for (const reg of all.filter((u) => u.kind === "region")) {
    const need = needOf(b, regions, reg);
    if (need <= 0) continue;
    const o = open(b, reg.cells);
    for (const kind of ["row", "column"] as const) {
      const idx = kind === "row" ? 0 : 1;
      if (!o.length || !o.every((p) => p[idx] === o[0][idx])) continue;
      const line = all.find((u) => u.kind === kind && u.cells[0][idx] === o[0][idx])!;
      if (k > 1 && needOf(b, regions, line) !== need) continue; // the line has room for more than the region's stars
      const cross = open(b, line.cells).filter(([r, c]) => regions[r][c] !== reg.letter);
      if (!cross.length) continue;
      return { technique: "Confined region", star: null, cross, focus: reg.cells,
        nudge: `Look at ${reg.label}.`,
        why: k === 1 ? `${cap(reg.label)} can only have its star in ${line.label}. So nothing else in ${line.label} can have one: cross out the striped cells.`
          : `${cap(reg.label)} can only put its ${stars(need)} in ${line.label}, and that's all ${line.label} still needs. So nothing else in ${line.label} can have one: cross out the striped cells.` };
    }
  }
  return null;
}

// 4. A row (or column) whose open cells all sit in one region: that line's star is the region's star,
//    so the rest of the region is ruled out.
function lineInsideRegion(b: Board, regions: Regions): Step | null {
  const all = units(regions);
  const k = perUnit(regions);
  for (const line of all.filter((u) => u.kind !== "region")) {
    const need = needOf(b, regions, line);
    if (need <= 0) continue;
    const o = open(b, line.cells);
    if (!o.length) continue;
    const letter = regions[o[0][0]][o[0][1]];
    if (!o.every(([r, c]) => regions[r][c] === letter)) continue;
    const reg = all.find((u) => u.letter === letter)!;
    if (k > 1 && needOf(b, regions, reg) !== need) continue;
    const inLine = new Set(line.cells.map((p) => p.join()));
    const cross = open(b, reg.cells).filter((p) => !inLine.has(p.join()));
    if (!cross.length) continue;
    return { technique: `${cap(line.kind)} inside one region`, star: null, cross, focus: line.cells,
      nudge: `Look at ${line.label}.`,
      why: k === 1 ? `Every open cell in ${line.label} is in ${reg.label}. So that region's star is in ${line.label}, and the rest of ${reg.label} is out.`
        : `Every open cell in ${line.label} is in ${reg.label}, and they need the same number of stars. So that region's stars are in ${line.label}, and the rest of ${reg.label} is out.` };
  }
  return null;
}

// 5. (Harder) A cell that, if it held a star, would leave some row, column or region with nowhere to go.
function wouldBlock(b: Board, regions: Regions): Step | null {
  const all = units(regions);
  for (let r = 0; r < b.length; r++) {
    for (let c = 0; c < b.length; c++) {
      if (b[r][c] !== EMPTY) continue;
      const trial = b.map((row) => [...row]);
      trial[r][c] = STAR;
      for (const [a, d] of ruledOutBy(regions, [r, c], trial)) if (trial[a][d] === EMPTY) trial[a][d] = CROSS;
      const blocked = all.find((u) => noRoom(trial, regions, u));
      if (!blocked) continue;
      return { technique: "Would block", star: null, cross: [[r, c]], focus: blocked.cells,
        nudge: `Look at ${blocked.label}.`,
        why: perUnit(regions) === 1 ? `A star at R${r + 1}C${c + 1} would rule out every open cell of ${blocked.label}. So that cell can't have a star.`
          : `A star at R${r + 1}C${c + 1} would leave ${blocked.label} with ${nowhere(regions)}. So that cell can't have a star.` };
    }
  }
  return null;
}

// 6. (Hard) Groups: N regions whose open cells all fit inside N rows (or columns) use up those rows' stars,
//    so nothing else in those rows can have one. And the mirror: N rows (or columns) whose open cells all
//    sit inside N regions use up those regions' stars. (N = 1 is tricks 3 and 4; this is N = 2 to 4.)
// Double: the same, counting stars: regions that fit inside some rows and need exactly as many stars as those
// rows still need (and the mirror), from 1 region or row up.
function groups(b: Board, regions: Regions): Step | null {
  const all = units(regions);
  const k = perUnit(regions);
  // Each unit's need and open cells, worked out once (this trick tries hundreds of combinations).
  const needs = new Map(all.map((u) => [u, needOf(b, regions, u)]));
  const opens = new Map(all.map((u) => [u, open(b, u.cells)]));
  const need = (u: Unit) => needs.get(u)!;
  const sum = (us: Unit[]) => us.reduce((t, u) => t + need(u), 0);
  const regs = all.filter((u) => u.kind === "region" && need(u) > 0);
  for (const kind of ["row", "column"] as const) {
    const idx = kind === "row" ? 0 : 1;
    const lines = all.filter((u) => u.kind === kind && need(u) > 0);
    const plural = kind === "row" ? "rows" : "columns";
    const lineAt = (i: number) => all.find((u) => u.kind === kind && u.cells[0][idx] === i)!;
    // Quick first test as bit masks: which lines a region's open cells use, which regions a line's use.
    const letterBit = new Map(regs.map((u, i) => [u.letter, 1 << i]));
    const linesOf = new Map(regs.map((u) => [u, opens.get(u)!.reduce((m, p) => m | (1 << p[idx]), 0)]));
    const regsOf = new Map(lines.map((l) => [l, opens.get(l)!.reduce((m, [r, c]) => m | (letterBit.get(regions[r][c]) ?? 0), 0)]));
    const lineNeed = [...Array(regions.length).keys()].map((i) => need(lineAt(i)));
    const bits = (m: number) => { let c = 0; for (; m; m &= m - 1) c++; return c; };
    const needIn = (m: number, needOfBit: (i: number) => number) => { let s = 0; for (let i = 0; m; i++, m >>= 1) if (m & 1) s += needOfBit(i); return s; };
    for (let n = k === 1 ? 2 : 1; n <= 4; n++) {
      // N regions squeezed into N lines.
      for (const set of combos(regs, n)) {
        const m = set.reduce((a, u) => a | linesOf.get(u)!, 0), count = bits(m);
        if (k === 1 ? count !== n : count === 1 || needIn(m, (i) => lineNeed[i]) !== sum(set)) continue;
        const cells = set.flatMap((u) => opens.get(u)!);
        const used = [...new Set(cells.map((p) => p[idx]))].sort((x, y) => x - y);
        if (k === 1 ? used.length !== n : used.length === 1 || sum(used.map(lineAt)) !== sum(set)) continue;
        const letters = new Set(set.map((u) => u.letter));
        const cross = lines.filter((l) => used.includes(l.cells[0][idx]))
          .flatMap((l) => open(b, l.cells)).filter(([r, c]) => !letters.has(regions[r][c]));
        if (!cross.length) continue;
        const names = listOf(set.map((u) => COLOR_NAMES[u.letter!]));
        const where = `${plural} ${listOf(used.map((i) => String(i + 1)))}`;
        if (k > 1) {
          const rs = n === 1 ? "region" : "regions";
          return { technique: `${n} ${rs}, ${used.length} ${plural}`, star: null, cross, focus: set.flatMap((u) => u.cells),
            nudge: `Look at the ${names} ${rs}${n === 1 ? "" : " together"}.`,
            why: `The ${names} ${rs} ${n === 1 ? "fits" : "all fit"} inside ${where}, and ${n === 1 ? "needs" : "need"} ${sum(set)} stars: everything ${where} still need. So nothing else in ${where} can have a star.` };
        }
        return { technique: `${n} regions, ${n} ${plural}`, star: null, cross, focus: set.flatMap((u) => u.cells),
          nudge: `Look at the ${names} regions together.`,
          why: `The ${names} regions all fit inside ${where}. That's ${n} regions in ${n} ${plural}, so those ${plural}' stars all belong to them. Nothing else in ${where} can have a star.` };
      }
      // N lines squeezed into N regions.
      for (const set of combos(lines, n)) {
        const m = set.reduce((a, l) => a | regsOf.get(l)!, 0), count = bits(m);
        if (k === 1 ? count !== n : count === 1 || needIn(m, (i) => need(regs[i])) !== sum(set)) continue;
        const cells = set.flatMap((l) => opens.get(l)!);
        const used = [...new Set(cells.map(([r, c]) => regions[r][c]))];
        if (k === 1 ? used.length !== n : used.length === 1 || sum(all.filter((u) => used.includes(u.letter!))) !== sum(set)) continue;
        const inLines = new Set(set.flatMap((l) => l.cells).map((p) => p.join()));
        const cross = regs.filter((u) => used.includes(u.letter!))
          .flatMap((u) => open(b, u.cells)).filter((p) => !inLines.has(p.join()));
        if (!cross.length) continue;
        const where = `${plural} ${listOf(set.map((l) => String(l.cells[0][idx] + 1)))}`;
        const names = listOf(used.sort().map((l) => COLOR_NAMES[l]));
        if (k > 1) {
          const here = n === 1 ? `${kind} ${set[0].cells[0][idx] + 1}` : where;
          return { technique: `${n} ${n === 1 ? kind : plural}, ${used.length} regions`, star: null, cross, focus: set.flatMap((l) => l.cells),
            nudge: `Look at ${here}${n === 1 ? "" : " together"}.`,
            why: `Every open cell in ${here} is in the ${names} regions, and they need the same number of stars (${sum(set)}). So the rest of those regions is out.` };
        }
        return { technique: `${n} ${plural}, ${n} regions`, star: null, cross, focus: set.flatMap((l) => l.cells),
          nudge: `Look at ${where} together.`,
          why: `Every open cell in ${where} is in the ${names} regions. ${n} ${plural} need ${n} stars from just those ${n} regions, so the rest of those regions is out.` };
      }
    }
  }
  return null;
}

// 7. (Expert) What if: pretend a cell has a star and follow the forced moves (tricks 1–6).
//    If that ends with a row, column or region that has nowhere left for its star, the cell can't have one.
// Of all the cells that fail, the hint uses the one with the shortest chain: easiest to follow in your head.
// Put a star at `from` and follow the forced moves (tricks 1–6) until a row, column or region has nowhere
// left for its star. Null if the moves run out first. Also explains a wrong star in a mistake hint.
// maxLen: give up (null) once the chain reaches this many moves; the hint only wants the shortest one.
// full: let the chain use group moves too (multi-star boards normally skip them to stay quick; see whatIf).
export function chainFrom(b: Board, regions: Regions, from: Cell, maxLen = Infinity, full = false) {
  const all = units(regions);
  const trial = b.map((row) => [...row]);
  // Each star (the pretend one too) crosses its own neighbors in the same move, so the chain only
  // counts moves that teach something (Colin, 10/20: "rules out" filler steps were confusing).
  const place = (p: Cell) => {
    trial[p[0]][p[1]] = STAR;
    const cross = open(trial, ruledOutBy(regions, p, trial));
    for (const [a, d] of cross) trial[a][d] = CROSS;
    return cross;
  };
  const pretendCross = place(from);
  const chain: NonNullable<Step["chain"]> = [];
  for (;;) {
    const dead = all.find((u) => noRoom(trial, regions, u));
    if (dead) return { chain, pretendCross, dead: { label: dead.label, cells: dead.cells } };
    if (chain.length >= maxLen) return null;
    const step = nextStep(trial, regions, full || perUnit(regions) === 1 ? HARD_TECHNIQUES : MEDIUM_TECHNIQUES);
    if (!step) return null;
    if (step.star) {
      chain.push({ star: step.star, cross: place(step.star), focus: step.focus, why: step.why });
    } else {
      applyStep(trial, step);
      chain.push({ star: null, cross: step.cross, focus: step.focus, why: step.why });
    }
  }
}

// Big boards with 3 stars (imports) get a time budget so a hint stays quick: past it, the shortest chain found so far
// is used (still a sound deduction), or none, and the hint says it's stuck. Packed puzzles never hit it.
// Packs are picked so no hint comes near these (checks lift them with timeLimits to prove it); imports may.
export const timeLimits = { whatIfMs: 450, fullMs: 700 };
// Multi-star boards try quick chains first; only if none works, chains with group moves (Colin's hard imported
// 10×10 got stuck without them, 10/22). Pack puzzles never need the second pass, so their hints don't change.
function whatIf(b: Board, regions: Regions): Step | null {
  return whatIfWith(b, regions, false) ?? (perUnit(regions) > 1 ? whatIfWith(b, regions, true) : null);
}
function whatIfWith(b: Board, regions: Regions, full: boolean): Step | null {
  let best: (Step & { forced: number }) | null = null;
  // The fuller second pass always has a budget, so a hint never freezes the phone for long.
  const budget = full ? Date.now() + timeLimits.fullMs : perUnit(regions) >= 3 || regions.length > 10 ? Date.now() + timeLimits.whatIfMs : Infinity;
  for (let r = 0; r < b.length; r++) {
    for (let c = 0; c < b.length; c++) {
      if (b[r][c] !== EMPTY) continue;
      if (Date.now() > budget) break;
      const found = chainFrom(b, regions, [r, c], best ? best.forced : Infinity, full);
      if (!found || (best && best.forced <= found.chain.length)) continue;
      const { chain, pretendCross, dead } = found;
      const forced = chain.length;
      best = { technique: "What if", star: null, cross: [[r, c]], focus: dead.cells, forced, chain, pretendCross, dead,
        nudge: `Imagine a star at R${r + 1}C${c + 1}. What happens?`,
        why: forced === 0
          ? (perUnit(regions) === 1 ? `A star at R${r + 1}C${c + 1} would rule out the last open cells of ${dead.label}. So that cell can't have one.`
            : `A star at R${r + 1}C${c + 1} would leave ${dead.label} with ${nowhere(regions)}. So that cell can't have one.`)
          : `Pretend R${r + 1}C${c + 1} has a star and follow the ${forced} move${forced === 1 ? "" : "s"} it forces: ${dead.label} runs out of room. So that cell can't have one.` }; // stepped through on the board (S15)
    }
  }
  if (!best) return null;
  const { forced, ...step } = best;
  return step;
}

function combos<T>(items: T[], n: number, start = 0): T[][] {
  if (n === 0) return [[]];
  const out: T[][] = [];
  for (let i = start; i <= items.length - n; i++) for (const rest of combos(items, n - 1, i + 1)) out.push([items[i], ...rest]);
  return out;
}
const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// The ladder, easiest first. A puzzle's grade is the lowest tier whose tricks solve it.
export const EASY_TECHNIQUES = [starRulesOut, lastCell, squeeze, confinedRegion, lineInsideRegion];
export const MEDIUM_TECHNIQUES = [...EASY_TECHNIQUES, wouldBlock];
export const HARD_TECHNIQUES = [...MEDIUM_TECHNIQUES, groups];
export const EXPERT_TECHNIQUES = [...HARD_TECHNIQUES, whatIf];
export const ALL_TECHNIQUES = EXPERT_TECHNIQUES;

export function nextStep(b: Board, regions: Regions, techniques = ALL_TECHNIQUES): Step | null {
  for (const t of techniques) {
    const step = t(b, regions);
    if (step) return step;
  }
  return null;
}

export function applyStep(b: Board, step: Step) {
  if (step.star) b[step.star[0]][step.star[1]] = STAR;
  for (const [r, c] of step.cross) b[r][c] = CROSS;
}
