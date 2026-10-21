// The Hint button. Looks only at what's on the board right now (Colin, 10/20: a hint must never lean on
// something you can't see): your numbers, plus your center pencil marks ("this cell is one of these").
// 1. Mistakes first: a wrong number, or pencil marks that leave out the right number.
// 2. A number you can place right now.
// 3. Otherwise the shortest chain of rule-outs (up to MAX_CHAIN) that leads to a number. Show me plays it out.
// 4. Otherwise one rule-out on its own, and Show me writes it into your pencil marks so the next hint can see it.
// Each hint has three levels the player clicks through: Nudge → Explain → Show me.
import { type Grid, fits } from "./fullGrid.ts";
import { type RuledOut, type Step, PLACING, allRuleOuts, applyStep, nextStep } from "./techniques.ts";

type Cell = [number, number];
export type Marks = Record<string, number[]>; // "row,col" → center pencil marks
export const MAX_CHAIN = 3;

// One rule-out step inside a chain (played out by Show me before the number goes in).
export type ChainStep = Pick<Step, "technique" | "remove" | "values" | "spots" | "blockers" | "focus"> & { value: number; why: string };

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
  chain?: ChainStep[]; // rule-outs that lead to the number, played out one at a time by Show me
  place?: { focus: Cell[]; blockers?: Step["blockers"]; why: string }; // the final placement of a chain
  pencil?: { cell: Cell; marks: number[] }[]; // a lone rule-out: Show me writes these center pencil marks
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
  const byCell = new Map<string, number[]>();
  for (const [r, c, n] of step.uses ?? []) {
    if (fromMarks.has(`${r},${c},${n}`)) byCell.set(`${r},${c}`, [...(byCell.get(`${r},${c}`) ?? []), n]);
    else notes.push(`${n} was ruled out of ${cellName(r, c)} in the step above.`);
  }
  for (const [k, ns] of byCell) {
    const [r, c] = k.split(",").map(Number);
    notes.unshift(`Your pencil marks at ${cellName(r, c)} leave out ${ns.join(" and ")}.`);
  }
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
      remove: null, blockers: place.blockers, nudge: place.nudge, explain: withNotes(place, fromMarks), showMe: `It's a ${place.value}!`,
    };
  }

  const found = findChain(board, out);
  if (found) {
    const { steps, place } = found;
    const chain: ChainStep[] = steps.map((s) => ({ technique: s.technique, remove: s.remove, values: s.values ?? [s.value],
      value: s.value, spots: s.spots, blockers: s.blockers, focus: s.focus, why: withNotes(s, fromMarks) }));
    const first = steps[0];
    return {
      kind: "step", technique: first.technique, // the chip names the first trick; Show me walks the rest
      focus: first.focus, target: [place.row, place.col], value: place.value,
      remove: first.remove!, values: first.values ?? [first.value], spots: first.spots, blockers: first.blockers,
      chain, place: { focus: place.focus, blockers: place.blockers, why: withNotes(place, fromMarks) },
      nudge: first.nudge,
      explain: [...chain.map((s, i) => `${i ? "Then: " : ""}${s.why}`), `So: ${withNotes(place, fromMarks)}`].join(" "),
      showMe: `It's a ${place.value}!`,
    };
  }

  // No short path to a number: give one rule-out, and write it into pencil marks so it's on the board.
  const step = nextStep(board, out);
  if (!step || !step.remove) {
    return { kind: "stuck", technique: "", focus: [], target: null, ...none,
      nudge: "No step left that SolveBuddy knows.", explain: "This spot needs a harder trick than SolveBuddy knows yet.", showMe: "" };
  }
  const after = withStep(out, step);
  const left = ([r, c]: Cell) => NUMS.filter((n) => fits(board, r, c, n) && !after.has(`${r},${c},${n}`));
  const values = step.values ?? [step.value];
  const pencil = [...(step.technique === "Pairs" ? step.spots! : []), ...step.remove].map((cell) => ({ cell, marks: left(cell) }));
  const k = step.remove.length;
  return {
    kind: "step", technique: step.technique, focus: step.focus, target: null, value: step.value, values, remove: step.remove,
    spots: step.spots, blockers: step.blockers, pencil, nudge: step.nudge, explain: withNotes(step, fromMarks),
    showMe: `${values.join(" and ")} ${values.length > 1 ? "are" : "is"} ruled out of ${k === 1 ? "1 cell" : `${k} cells`}. Pencil marks added so you can see it.`,
  };
}
