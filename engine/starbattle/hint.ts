// Star Battle Hint button. Looks at the board as it is right now:
// 1. Mistakes first: a star where the answer has none, or an × on the answer's star.
// 2. Otherwise: the easiest trick that finds a next move.
import { type Regions, type Stars } from "./layout.ts";
import { type Board, type Step, EMPTY, CROSS, STAR, nextStep } from "./techniques.ts";

type Cell = [number, number];

export type Hint = {
  kind: "mistake" | "step" | "stuck";
  technique: string;
  focus: Cell[]; // highlighted cells (shown in full color)
  star: Cell | null; // "Show me" places this star...
  cross: Cell[]; // ...or crosses out these cells (striped from Explain on)
  clear: Cell | null; // ...or clears this wrong mark
  nudge: string;
  explain: string;
  showMe: string;
  // What if only: "Show me" plays these forced moves out one at a time before crossing the cell.
  chain?: Step["chain"];
  pretendCross?: Cell[];
  dead?: Step["dead"];
};

export function hint(board: Board, regions: Regions, solution: Stars): Hint {
  const n = regions.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const isStar = solution[r] === c;
      const wrongStar = board[r][c] === STAR && !isStar;
      const wrongCross = board[r][c] === CROSS && isStar;
      if (!wrongStar && !wrongCross) continue;
      return {
        kind: "mistake", technique: "Check this", focus: [...Array(n).keys()].map((i) => [r, i] as Cell),
        star: null, cross: [], clear: [r, c],
        nudge: `Something's off in row ${r + 1}.`,
        explain: wrongStar
          ? `The star at row ${r + 1}, column ${c + 1} can't be right.`
          : `The × at row ${r + 1}, column ${c + 1} is on a cell that needs a star.`,
        showMe: "Cleared it. Keep going from here.",
      };
    }
  }
  const step = nextStep(board.map((row) => [...row]), regions);
  if (!step) {
    return { kind: "stuck", technique: "", focus: [], star: null, cross: [], clear: null,
      nudge: "No easy step left.", explain: "This spot needs a harder trick than SolveBuddy knows yet.", showMe: "" };
  }
  return {
    kind: "step", technique: step.technique, focus: step.focus, star: step.star, cross: step.cross, clear: null,
    nudge: step.nudge, explain: step.why,
    showMe: step.star ? "Star placed!" : `Crossed out ${step.cross.length === 1 ? "1 cell" : `${step.cross.length} cells`}.`,
    chain: step.chain, pretendCross: step.pretendCross, dead: step.dead,
  };
}

export { EMPTY, CROSS, STAR };
