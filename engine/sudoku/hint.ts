// The Hint button. Looks at the board as it is right now:
// 1. Mistakes first: if a number you placed doesn't match the answer, point at it.
// 2. Otherwise: the easiest trick that finds a next move.
// Each hint has three levels the player clicks through: Nudge → Explain → Show me.
import { type Grid } from "./fullGrid.ts";
import { nextStep, type RuledOut } from "./techniques.ts";

export type Hint = {
  kind: "mistake" | "step" | "stuck";
  technique: string; // chip name
  focus: [number, number][]; // highlighted cells
  target: [number, number] | null; // the one cell the hint is about (shown from Explain on)
  value: number; // what "Show me" places (0 = clear the cell), or the number it rules out
  remove: [number, number][] | null; // harder tricks: rule `value` out of these cells instead of placing it
  values?: number[]; // ...or all of these numbers (Pairs)
  spots?: [number, number][]; // cells ringed from Explain on (e.g. where Pointing's number can still go)
  blockers?: { cell: [number, number]; line: [number, number][] }[]; // numbers that block the other cells (blue)
  nudge: string;
  explain: string;
  showMe: string;
};

// `board` = givens plus the player's numbers (0 = empty). `out` = what earlier hints ruled out.
export function hint(board: Grid, solution: Grid, out: RuledOut = new Set()): Hint {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0 && board[r][c] !== solution[r][c]) {
        return {
          kind: "mistake", technique: "Check this", focus: board[r].map((_, i) => [r, i]), target: [r, c], value: 0, remove: null,
          nudge: `Something's off in row ${r + 1}.`,
          explain: `The ${board[r][c]} at row ${r + 1}, column ${c + 1} doesn't fit the answer.`,
          showMe: "Cleared it. Try that cell again.",
        };
      }
    }
  }
  const step = nextStep(board, out);
  if (!step) {
    return { kind: "stuck", technique: "", focus: [], target: null, value: 0, remove: null,
      nudge: "No easy step left.", explain: "This spot needs a harder trick than SolveBuddy knows yet.", showMe: "" };
  }
  if (step.remove) {
    const k = step.remove.length;
    return {
      kind: "step", technique: step.technique, focus: step.focus, target: null, value: step.value, values: step.values, remove: step.remove, spots: step.spots, blockers: step.blockers,
      nudge: step.nudge, explain: step.why,
      showMe: `${step.values ? step.values.join(" and ") + " are" : `${step.value} is`} ruled out of ${k === 1 ? "1 cell" : `${k} cells`}.`,
    };
  }
  return {
    kind: "step", technique: step.technique, focus: step.focus, target: [step.row, step.col], value: step.value, remove: null, blockers: step.blockers,
    nudge: step.nudge, explain: step.why, showMe: `It's a ${step.value}!`,
  };
}
