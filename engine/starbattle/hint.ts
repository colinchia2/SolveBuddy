// Star Battle Hint button. Looks at the board as it is right now:
// 1. A wrong star first (a star where the answer has none), with why it can't be right.
// 2. Otherwise: the easiest trick that finds a next move, worked out from your CORRECT marks only.
// A hint never says something it can't explain (Colin, 10/22): a wrong × is not flagged on sight (that would give
// away a star the logic hasn't reached). It only comes up when the next step puts a star on it, and then the step's
// reason is the explanation.
import { type Regions, type Stars, isAnswer, perUnit } from "./layout.ts";
import { type Board, type Step, EMPTY, CROSS, STAR, nextStep, chainFrom } from "./techniques.ts";

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
      if (board[r][c] !== STAR || isAnswer(solution, r, c)) continue;
      const why = whyWrong(board, regions, solution, [r, c]);
      return {
        kind: "mistake", technique: "Check this", focus: [...Array(n).keys()].map((i) => [r, i] as Cell),
        star: null, cross: [], clear: [r, c],
        nudge: `Something's off in row ${r + 1}.`,
        explain: `The star at R${r + 1}C${c + 1} can't be right. ${why.text}`,
        showMe: "Cleared it. Keep going from here.",
        ...why.found,
      };
    }
  }
  // Your × marks on answer cells are left out, so the step only builds on what you got right.
  const base = board.map((row, r) => row.map((v, c) => (v === CROSS && isAnswer(solution, r, c) ? EMPTY : v)));
  const step = nextStep(base.map((row) => [...row]), regions);
  if (!step) {
    return { kind: "stuck", technique: "", focus: [], star: null, cross: [], clear: null,
      nudge: "No easy step left.", explain: "This spot needs a harder trick than SolveBuddy knows yet.", showMe: "" };
  }
  // The step's star lands on one of your × marks: its reason is why that × is wrong. Show me swaps it for the star.
  if (step.star && board[step.star[0]][step.star[1]] === CROSS) {
    const [r, c] = step.star;
    return {
      kind: "step", technique: step.technique, focus: step.focus, star: step.star, cross: [], clear: [r, c],
      nudge: step.nudge, explain: `${step.why} Your × at R${r + 1}C${c + 1} is in the way.`,
      showMe: "Swapped your × for the star.",
    };
  }
  return {
    kind: "step", technique: step.technique, focus: step.focus, star: step.star, cross: step.cross, clear: null,
    nudge: step.nudge, explain: step.why,
    showMe: step.star ? "Star placed!" : `Crossed out ${step.cross.length === 1 ? "1 cell" : `${step.cross.length} cells`}.`,
    chain: step.chain, pretendCross: step.pretendCross, dead: step.dead,
  };
}

// Why a wrong star is wrong (Colin, 10/20: "otherwise we are just saying it's wrong, not why").
// It clashes with another star, or it's treated as a What if: follow the forced moves from it until a
// row, column or region runs dry. Only the player's correct marks are used, so the reasoning is sound.
function whyWrong(board: Board, regions: Regions, solution: Stars, [r, c]: Cell) {
  const n = regions.length;
  const base = board.map((row, a) => row.map((v, b) => {
    if (a === r && b === c) return EMPTY;
    const isStar = isAnswer(solution, a, b);
    return (v === STAR && !isStar) || (v === CROSS && isStar) ? EMPTY : v;
  }));
  const per = perUnit(regions);
  if (per === 1) {
    for (let a = 0; a < n; a++) {
      const b = base[a].indexOf(STAR);
      if (b < 0) continue;
      const clash = a === r ? "is in the same row as" : b === c ? "is in the same column as"
        : regions[a][b] === regions[r][c] ? "is in the same region as"
        : Math.abs(a - r) <= 1 && Math.abs(b - c) <= 1 ? "touches" : "";
      if (clash) return { text: `It ${clash} the star at R${a + 1}C${b + 1}.`, found: null };
    }
  } else {
    // 2 or 3 stars: it touches a star, or makes one too many in a row, column or region.
    const all: [number, number][] = [];
    base.forEach((row, a) => row.forEach((v, b) => v === STAR && all.push([a, b])));
    const near = all.find(([a, b]) => Math.abs(a - r) <= 1 && Math.abs(b - c) <= 1);
    if (near) return { text: `It touches the star at R${near[0] + 1}C${near[1] + 1}.`, found: null };
    const full = all.filter(([a]) => a === r).length >= per ? `row ${r + 1}`
      : all.filter(([, b]) => b === c).length >= per ? `column ${c + 1}`
      : all.filter(([a, b]) => regions[a][b] === regions[r][c]).length >= per ? "its region" : "";
    if (full) return { text: `It would be a ${per === 2 ? "third" : "fourth"} star in ${full}.`, found: null };
  }
  const found = chainFrom(base, regions, [r, c]);
  if (!found || found.chain.length > 5) {
    return { text: "It only breaks after a long chain of moves, so take it off and look elsewhere.", found: null };
  }
  const k = found.chain.length;
  const nowhere = per === 1 ? "nowhere left for its star" : "no room left for its stars";
  return {
    text: k === 0
      ? (per === 1 ? `It rules out the last open cells of ${found.dead.label}, so that would have ${nowhere}.`
        : `With a star there, ${found.dead.label} would have ${nowhere}.`)
      : `With a star there, after ${k} forced move${k === 1 ? "" : "s"} ${found.dead.label} would have ${nowhere}.`,
    found,
  };
}

export { EMPTY, CROSS, STAR };
