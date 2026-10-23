// Nonogram hints you can trust (Colin 10/23): mistakes first, then ONE row or column at a time, with why.
// The player's board: 0 = empty, 1 = filled, 2 = ×. The hint reasons only from marks that are right (a wrong × is
// treated as unknown, like Star Battle), so every step is true; a wrong filled square is pointed out first.
import { type Cell, type Clue, UNKNOWN, EMPTY, FILLED, solveLine, sameClue, runs } from "./line.ts";

export const BLANK = 0, FILL = 1, CROSS = 2;
export type Mark = 0 | 1 | 2;
export type Pos = [number, number];
export type Hint = {
  kind: "mistake" | "step" | "done";
  technique: string;
  nudge: string; explain: string; showMe: string;
  line?: { axis: "row" | "col"; i: number };
  fill: Pos[]; cross: Pos[]; clear: Pos[]; // what Show me does
  focus: Pos[]; // the cells the hint is about (the whole line)
};
export type Puzzle = { rows: Clue[]; cols: Clue[]; solution: string[] };

const clueText = (c: Clue) => (c[0] === 0 || !c.length ? "0" : c.join(" "));
const name = (axis: "row" | "col", i: number) => `${axis === "row" ? "Row" : "Column"} ${i + 1}`;
const squares = (n: number) => `${n} square${n === 1 ? "" : "s"}`;

// One line's deduction and what kind of reasoning it is (the simplest that explains it).
type Step = { axis: "row" | "col"; i: number; clue: Clue; fill: number[]; empty: number[]; technique: string; rank: number };
function lineStep(axis: "row" | "col", i: number, clue: Clue, known: Cell[]): Step | null {
  const out = solveLine(clue, known);
  if (!out) return null; // can't happen with right marks only
  const fill: number[] = [], empty: number[] = [];
  out.forEach((v, x) => { if (known[x] === UNKNOWN && v === FILLED) fill.push(x); if (known[x] === UNKNOWN && v === EMPTY) empty.push(x); });
  if (!fill.length && !empty.length) return null;
  const blocks = clue.filter((b) => b > 0);
  const n = known.length, need = blocks.reduce((t, b) => t + b, 0) + Math.max(0, blocks.length - 1);
  const blank = known.every((v) => v === UNKNOWN);
  const filledNow = known.filter((v) => v === FILLED).length;
  let technique: string, rank: number;
  if (!blocks.length) { technique = "Empty line"; rank = 0; }
  else if (!fill.length && filledNow === blocks.reduce((t, b) => t + b, 0) && sameClue(runs(known.map((v) => (v === FILLED ? 1 : 0))), clue)) { technique = "Line done"; rank = 1; }
  else if (blank && need === n) { technique = "Fits exactly"; rank = 2; }
  else if (blank) { technique = "Overlap"; rank = 3; }
  else if (!fill.length) { technique = "Out of reach"; rank = 4; }
  else { technique = "Every fit"; rank = 5; }
  return { axis, i, clue, fill, empty, technique, rank };
}

// Pick the next step: a line that fills squares beats one that only rules them out (filling is what moves the
// picture on); among those, the simplest reasoning, then the most squares, then rows before columns.
const better = (a: Step, b: Step) => {
  const af = a.fill.length > 0 ? 0 : 1, bf = b.fill.length > 0 ? 0 : 1;
  if (af !== bf) return af < bf;
  if (a.rank !== b.rank) return a.rank < b.rank;
  const an = a.fill.length + a.empty.length, bn = b.fill.length + b.empty.length;
  return an > bn;
};

export function hint(p: Puzzle, board: Mark[][]): Hint {
  const h = p.rows.length, w = p.cols.length;
  const isX = (r: number, c: number) => p.solution[r][c] === "X";
  // 1. A filled square that isn't in the picture.
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (board[r][c] === FILL && !isX(r, c)) {
      return { kind: "mistake", technique: "Check this", line: { axis: "row", i: r },
        nudge: "Something on the board isn't right yet.",
        explain: `Row ${r + 1}, column ${c + 1} is filled, but it isn't part of the picture. Every later step builds on it, so take it off first.`,
        showMe: `Row ${r + 1}, column ${c + 1} is cleared.`,
        fill: [], cross: [], clear: [[r, c]], focus: [[r, c]] };
    }
  }
  // 2. The next line deduction, from the right marks only.
  const known: Cell[][] = board.map((row, r) => row.map((m, c) =>
    (m === FILL ? FILLED : m === CROSS && !isX(r, c) ? EMPTY : UNKNOWN) as Cell));
  let best: Step | null = null;
  for (let r = 0; r < h; r++) { const s = lineStep("row", r, p.rows[r], known[r]); if (s && (!best || better(s, best))) best = s; }
  for (let c = 0; c < w; c++) { const s = lineStep("col", c, p.cols[c], known.map((row) => row[c])); if (s && (!best || better(s, best))) best = s; }
  // Every fill / × the solution needs is already on the board (only blank squares that must stay blank are left).
  if (!best) {
    return { kind: "done", technique: "", nudge: "Every square of the picture is filled in.", explain: "", showMe: "",
      fill: [], cross: [], clear: [], focus: [] };
  }
  const at = (x: number): Pos => (best!.axis === "row" ? [best!.i, x] : [x, best!.i]);
  const line = name(best.axis, best.i), clue = clueText(best.clue), len = best.axis === "row" ? w : h;
  const fill = best.fill.map(at), cross = best.empty.map(at);
  const focus = Array.from({ length: len }, (_, x) => at(x));
  const what = [fill.length ? `${squares(fill.length)} filled` : "", cross.length ? `${squares(cross.length)} crossed out` : ""].filter(Boolean).join(" and ");
  const blocks = best.clue.filter((b) => b > 0);
  const explain = {
    "Empty line": `${line}'s clue is 0, so none of its squares are filled.`,
    "Line done": `${line} already has all of its blocks (${clue}). Every other square in it is empty.`,
    "Fits exactly": `${line}'s blocks (${clue}) with one gap between each take all ${len} squares, so there's only one way to place them.`,
    "Overlap": blocks.length === 1
      ? `${line}'s ${blocks[0]} can sit anywhere along the ${len} squares. Slide it as far left as it goes, then as far right: the squares it covers both times are always filled.`
      : `Push ${line}'s blocks (${clue}) as far to one end as they go, then to the other. Where the same block covers a square both times, that square is always filled.`,
    "Out of reach": `Try every way ${line}'s blocks (${clue}) fit around the squares already marked. None of them can reach these squares, so they're empty.`,
    "Every fit": `Try every way ${line}'s blocks (${clue}) fit around the squares already marked. Every one of them ${fill.length ? "fills these squares" : ""}${fill.length && cross.length ? " and " : ""}${cross.length ? "leaves the striped ones empty" : ""}.`,
  }[best.technique]!;
  return { kind: "step", technique: best.technique, line: { axis: best.axis, i: best.i },
    nudge: `Look at ${line.toLowerCase()} (${clue}).`, explain, showMe: `${line}: ${what}.`,
    fill, cross, clear: [], focus };
}

// Apply a hint's Show me to a board (a copy).
export function applyHint(board: Mark[][], h: Hint): Mark[][] {
  const b = board.map((row) => [...row]) as Mark[][];
  for (const [r, c] of h.clear) b[r][c] = BLANK;
  for (const [r, c] of h.fill) b[r][c] = FILL;
  for (const [r, c] of h.cross) b[r][c] = CROSS;
  return b;
}

// The picture is finished when the filled squares are exactly the picture (× and blanks don't matter).
export const isSolved = (p: Puzzle, board: Mark[][]) => board.every((row, r) => row.every((m, c) => (m === FILL) === (p.solution[r][c] === "X")));

// Press Hint → Show me until solved; returns how many steps (or -1 if it ever stalls or a step is wrong).
export function playHints(p: Puzzle, start?: Mark[][]): number {
  let b: Mark[][] = start ?? p.rows.map(() => p.cols.map(() => BLANK as Mark));
  for (let n = 0; n < 2000; n++) {
    if (isSolved(p, b)) return n;
    const h = hint(p, b);
    if (h.kind === "done") return -1;
    const wrong = h.fill.some(([r, c]) => p.solution[r][c] !== "X") || h.cross.some(([r, c]) => p.solution[r][c] === "X");
    if (wrong) return -1;
    b = applyHint(b, h);
  }
  return -1;
}
