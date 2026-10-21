// The Hint button. Looks only at what's on the board right now (Colin, 10/20: a hint must never lean on
// something you can't see): your numbers, plus your center pencil marks ("this cell is one of these").
// 1. Mistakes first: a wrong number, or pencil marks that leave out the right number.
// 2. A number you can place right now.
// 3. Otherwise one rule-out (a trick), and Show me writes it into your pencil marks. The next hint reads those
//    marks and places the number. Colin, 10/21: the trick and the number are two hints, never one jump.
//    The rule-out picked is the first step of the shortest path (up to MAX_CHAIN) to a number.
// Each hint has three levels the player clicks through: Nudge → Explain → Show me.
import { type Grid, fits } from "./fullGrid.ts";
import { type RuledOut, type Step, PLACING, allRuleOuts, applyStep, nextStep } from "./techniques.ts";

type Cell = [number, number];
export type Marks = Record<string, number[]>; // "row,col" → center pencil marks
export const MAX_CHAIN = 3;

export type Hint = {
  kind: "mistake" | "step" | "stuck";
  technique: string; // chip name
  focus: Cell[]; // highlighted cells
  target: Cell | null; // the one cell the hint is about (shown from Explain on)
  value: number; // what "Show me" places (0 = clear the cell), or the number it rules out
  remove: Cell[] | null; // a rule-out: `value` (or `values`) can't go in these cells (striped)
  values?: number[];
  spots?: Cell[]; // ringed from Explain on (e.g. where Pointing's number can still go)
  blockers?: Step["blockers"]; // numbers that block the other cells (blue)
  pencil?: { cell: Cell; marks: number[] }[]; // a rule-out: Show me writes these center pencil marks
  nudge: string;
  explain: string;
  showMe: string;
};

const NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const cellName = (r: number, c: number) => `row ${r + 1}, column ${c + 1}`;
const firstOf = (grid: Grid, out: RuledOut) => nextStep(grid, out, PLACING);
const withStep = (out: RuledOut, step: Step) => {
  const next = new Set(out);
  applyStep([], next, step); // a rule-out only touches `out`
  return next;
};

// Say where each ruled-out fact a step relies on came from: your pencil marks, or a step earlier in this hint.
function withNotes(step: Step, fromMarks: RuledOut) {
  const notes: string[] = [];
  const byCell = new Map<string, number[]>(); // from your pencil marks, grouped by cell
  const byNum = new Map<number, string[]>(); // from earlier in this hint, grouped by number
  for (const [r, c, n] of step.uses ?? []) {
    if (fromMarks.has(`${r},${c},${n}`)) byCell.set(`${r},${c}`, [...(byCell.get(`${r},${c}`) ?? []), n]);
    else byNum.set(n, [...(byNum.get(n) ?? []), cellName(r, c)]);
  }
  for (const [k, ns] of byCell) {
    const [r, c] = k.split(",").map(Number);
    notes.push(`Your pencil marks at ${cellName(r, c)} leave out ${ns.join(" and ")}.`);
  }
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join("; ")} and ${xs.at(-1)}` : xs[0]);
  for (const [n, cells] of byNum) notes.push(`${n} was ruled out of ${list(cells)} earlier in this hint.`);
  return notes.length ? `${step.why} (${notes.join(" ")})` : step.why;
}

// Shortest list of rule-outs after which a number can be placed. Breadth first, so every step is needed.
function findChain(grid: Grid, out: RuledOut) {
  let frontier = [{ out, steps: [] as Step[] }];
  const seen = new Set<string>();
  for (let depth = 1; depth <= MAX_CHAIN; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const step of allRuleOuts(grid, node.out)) {
        const out2 = withStep(node.out, step);
        const id = [...out2].sort().join(" ");
        if (seen.has(id)) continue;
        seen.add(id);
        const steps = [...node.steps, step];
        const place = firstOf(grid, out2);
        if (place) return { steps, place };
        next.push({ out: out2, steps });
      }
    }
    frontier = next;
  }
  return null;
}

// `board` = givens plus the player's numbers (0 = empty). `marks` = the player's center pencil marks.
export function hint(board: Grid, solution: Grid, marks: Marks = {}): Hint {
  const none = { remove: null, value: 0 };
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0 && board[r][c] !== solution[r][c]) {
        return {
          kind: "mistake", technique: "Check this", focus: board[r].map((_, i) => [r, i] as Cell), target: [r, c], ...none,
          nudge: `Something's off in row ${r + 1}.`,
          explain: `The ${board[r][c]} at row ${r + 1}, column ${c + 1} doesn't fit the answer.`,
          showMe: "Cleared it. Try that cell again.",
        };
      }
    }
  }
  const out: RuledOut = new Set();
  for (const [k, list] of Object.entries(marks)) {
    const [r, c] = k.split(",").map(Number);
    if (board[r][c] !== 0 || !list.length) continue;
    if (!list.includes(solution[r][c])) {
      return {
        kind: "mistake", technique: "Check this", focus: board[r].map((_, i) => [r, i] as Cell), target: [r, c], ...none,
        nudge: `Check your pencil marks in row ${r + 1}.`,
        explain: `Your pencil marks at ${cellName(r, c)} leave out the number that goes there.`,
        showMe: "Cleared those pencil marks.",
      };
    }
    for (const n of NUMS) if (!list.includes(n)) out.add(`${r},${c},${n}`);
  }
  const fromMarks = new Set(out);

  const place = firstOf(board, out);
  if (place) {
    return {
      kind: "step", technique: place.technique, focus: place.focus, target: [place.row, place.col], value: place.value,
      remove: null, blockers: place.blockers, nudge: place.nudge, explain: withNotes(place, fromMarks), showMe: `It's ${place.value === 8 ? "an" : "a"} ${place.value}!`,
    };
  }

  // No number yet: give one rule-out, and write it into pencil marks so it's on the board.
  // Prefer the one that leads to a number soonest.
  const step = findChain(board, out)?.steps[0] ?? nextStep(board, out);
  if (!step || !step.remove) {
    return { kind: "stuck", technique: "", focus: [], target: null, ...none,
      nudge: "No step left that SolveBuddy knows.", explain: "This spot needs a harder trick than SolveBuddy knows yet.", showMe: "" };
  }
  const after = withStep(out, step);
  const left = ([r, c]: Cell) => NUMS.filter((n) => fits(board, r, c, n) && !after.has(`${r},${c},${n}`));
  const values = step.values ?? [step.value];
  // Pairs and Y-wing also mark their own cells, so the pair (or the three cells) is written on the board.
  const own = step.technique === "Pairs" || step.technique === "Y-wing" ? step.spots! : [];
  const pencil = [...own, ...step.remove.filter((p) => !own.some((q) => q[0] === p[0] && q[1] === p[1]))]
    .map((cell) => ({ cell, marks: left(cell) }));
  const k = step.remove.length;
  return {
    kind: "step", technique: step.technique, focus: step.focus, target: null, value: step.value, values, remove: step.remove,
    spots: step.spots, blockers: step.blockers, pencil, nudge: step.nudge, explain: withNotes(step, fromMarks),
    showMe: step.technique === "Hidden pairs" ? `Those two cells can only be ${pencil[0].marks.join(" or ")}. Pencil marks added.`
      : `${values.join(" and ")} ${values.length > 1 ? "are" : "is"} ruled out of ${k === 1 ? "1 cell" : `${k} cells`}. Pencil marks added, so the next hint can use them.`,
  };
}

// Tap the bulb and "Show me" over and over, like a player who only follows hints (numbers + the pencil marks
// hints write). Returns every hint shown and whether it finished. Used by the puzzle maker and the checks.
export function playHints(givens: Grid, solution: Grid, limit = 300) {
  const b = givens.map((r) => [...r]);
  const marks: Marks = {};
  const shown: Hint[] = [];
  for (let i = 0; i < limit; i++) {
    const h = hint(b, solution, marks);
    if (h.kind !== "step") break;
    shown.push(h);
    if (h.pencil) {
      for (const p of h.pencil) marks[`${p.cell[0]},${p.cell[1]}`] = p.marks;
      continue;
    }
    const [r, c] = h.target!;
    b[r][c] = h.value;
    delete marks[`${r},${c}`];
  }
  return { shown, board: b, solved: b.every((row, r) => row.every((v, c) => v === solution[r][c])) };
}

// Every trick name a list of hints showed.
export const tricksShown = (shown: Hint[]) => new Set(shown.map((h) => h.technique));
