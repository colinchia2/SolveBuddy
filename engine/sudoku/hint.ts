// The Hint button. Looks only at what's on the board right now (Colin, 10/20: a hint must never lean on
// something you can't see): your numbers, your center pencil marks ("this cell is one of these"), and your corner
// marks read the usual way ("this box's N is in one of these cells"), used only when they're right.
// 1. Mistakes first: a wrong number, or pencil marks that leave out the right number.
// 2. A number you can place right now.
// 3. Otherwise one rule-out (a trick), and Show me writes it into your pencil marks: just the cells the trick is
//    about (Colin, 10/21: a 5 in the two cells where 5 can go, not every number in the other cells). The next
//    hint reads those marks and places the number. The trick and the number are two hints, never one jump.
//    The rule-out picked is the first step of the shortest path (up to MAX_CHAIN) to a number.
// Each hint has three levels the player clicks through: Nudge → Explain → Show me.
import { type Grid, fits } from "./fullGrid.ts";
import { type RuledOut, type Step, PLACING, allRuleOuts, applyStep, cellName, list, nextStep } from "./techniques.ts";

type Cell = [number, number];
export type Marks = Record<string, number[]>; // "row,col" → center (or corner) pencil marks
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
  blockers?: Step["blockers"]; // numbers that block the other cells (red outline, red line)
  inferred?: Cell[]; // cells ruled out by your marks rather than a number in plain sight (striped, Colin 10/21)
  pencil?: { cell: Cell; marks: number[] }[]; // a rule-out: Show me writes these center pencil marks
  corner?: { cells: Cell[]; n: number }; // a rule-out: Show me adds `n` as a corner mark in these cells
  nudge: string;
  explain: string;
  showMe: string;
};

const NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const firstOf = (grid: Grid, out: RuledOut) => nextStep(grid, out, PLACING);
const withStep = (out: RuledOut, step: Step) => {
  const next = new Set(out);
  applyStep([], next, step); // a rule-out only touches `out`
  return next;
};

// Where a ruled-out fact came from: a cell's center marks leaving it out, or a group of marks (a note, the
// marked cells, and the line they block, shown like blocking numbers).
// `why` says it for one cell and number, e.g. "column 6's 2 is at R2C6 or R7C6".
type Group = { note: string; why: (r: number, c: number, n: number) => string; cells: Cell[]; line: Cell[] };
type Sources = Map<string, Cell | Group>;

// "R2C6 or R7C6"
const either = (cells: Cell[]) => list(cells.map((p) => cellName(...p)), "or");

// Add the step's sources to its explanation, e.g. "(Your pencil marks at row 8, column 2 leave out 5.)"
// A step that says {ruled} gets one short reason per ruled-out number instead, in place.
function withNotes(step: Step, from: Sources) {
  if (step.why.includes("{ruled}")) {
    const reasons = (step.uses ?? []).map(([r, c, n]) => {
      const src = from.get(`${r},${c},${n}`);
      const because = !src ? "it's ruled out" : Array.isArray(src) ? "your pencil marks there leave it out" : src.why(r, c, n);
      return `It can't be ${n}: ${because}.`;
    });
    return step.why.replace("{ruled}", [...new Set(reasons)].join(" "));
  }
  const byCell = new Map<string, number[]>();
  const texts = new Set<string>();
  for (const [r, c, n] of step.uses ?? []) {
    const src = from.get(`${r},${c},${n}`);
    if (src && !Array.isArray(src)) texts.add(src.note);
    else if (src) byCell.set(`${src[0]},${src[1]}`, [...(byCell.get(`${src[0]},${src[1]}`) ?? []), n]);
  }
  const notes = [...byCell].map(([k, ns]) => {
    const [r, c] = k.split(",").map(Number);
    return `Your pencil marks at ${cellName(r, c)} leave out ${ns.join(" and ")}.`;
  });
  notes.push(...texts);
  return notes.length ? `${step.why} (${notes.join(" ")})` : step.why;
}

// Cells the step relies on being ruled out by marks (not by a number you can see in their row, column or box).
const inferredOf = (step: Step): Cell[] => [...new Map((step.uses ?? []).map(([r, c]) => [`${r},${c}`, [r, c] as Cell])).values()];

// The step's blocking numbers, plus any groups of marks it relies on (outlined, with the line they block).
function blockersWith(step: Step, from: Sources): Step["blockers"] {
  const groups = new Set<Group>();
  for (const [r, c, n] of step.uses ?? []) {
    const src = from.get(`${r},${c},${n}`);
    if (src && !Array.isArray(src)) groups.add(src);
  }
  return [...(step.blockers ?? []), ...[...groups].flatMap((g) => g.cells.map((cell) => ({ cell, line: g.line })))];
}

const boxOf = (r: number, c: number) => Math.floor(r / 3) * 3 + Math.floor(c / 3);
const boxCells = (b: number) => NUMS.map((_, i) => [Math.floor(b / 3) * 3 + Math.floor(i / 3), (b % 3) * 3 + (i % 3)] as Cell);
const UNITS = [
  ...NUMS.map((_, i) => ({ label: `row ${i + 1}`, cells: NUMS.map((_, j) => [i, j] as Cell) })),
  ...NUMS.map((_, i) => ({ label: `column ${i + 1}`, cells: NUMS.map((_, j) => [j, i] as Cell) })),
  ...NUMS.map((_, i) => ({ label: `box ${i + 1}`, cells: boxCells(i) })),
];

// What groups of marks say, beyond each cell on its own:
// - Two cells in a row, column or box whose center marks are the same two numbers: no other cell there has them.
// - Corner marks for N in a box: the box's N is in one of those cells (used only if that's right), so N can't go
//   in the box's other cells, and if they're all in one row or column, nowhere else in that line either.
function fromGroups(board: Grid, solution: Grid, marks: Marks, corners: Marks, out: RuledOut, from: Sources) {
  const add = (r: number, c: number, n: number, g: Group) => {
    if (board[r][c] !== 0 || out.has(`${r},${c},${n}`)) return;
    out.add(`${r},${c},${n}`);
    from.set(`${r},${c},${n}`, g);
  };
  const same = (p: Cell, q: Cell) => p[0] === q[0] && p[1] === q[1];
  for (const u of UNITS) {
    const two = u.cells.filter(([r, c]) => board[r][c] === 0 && marks[`${r},${c}`]?.length === 2);
    for (let i = 0; i < two.length; i++) {
      for (let j = i + 1; j < two.length; j++) {
        const [p, q] = [two[i], two[j]];
        const [a, b] = marks[`${p[0]},${p[1]}`];
        const m = marks[`${q[0]},${q[1]}`];
        if (m[0] !== a || m[1] !== b) continue;
        const g = { note: `Your pencil marks ${a}${b} at ${cellName(...p)} and ${cellName(...q)} make a pair, so no other cell in ${u.label} can be ${a} or ${b}.`,
          why: () => `your pencil marks ${a}${b} at ${cellName(...p)} and ${cellName(...q)} take the ${a} and ${b} for ${u.label}`,
          cells: [p, q], line: u.cells };
        for (const x of u.cells) if (!same(x, p) && !same(x, q)) add(x[0], x[1], a, g), add(x[0], x[1], b, g);
      }
    }
  }
  for (let b = 0; b < 9; b++) {
    const box = boxCells(b);
    for (const n of NUMS) {
      const at = box.filter(([r, c]) => board[r][c] === 0 && corners[`${r},${c}`]?.includes(n));
      // One mark alone isn't "one of these" (X-wing marks one cell per box), so it says nothing about the box.
      if (at.length < 2 || !at.some(([r, c]) => solution[r][c] === n)) continue;
      const sameRow = at.length > 1 && at.every((p) => p[0] === at[0][0]);
      const sameCol = at.length > 1 && at.every((p) => p[1] === at[0][1]);
      const line = sameRow ? `row ${at[0][0] + 1}` : sameCol ? `column ${at[0][1] + 1}` : "";
      const g = {
        note: line
          ? `Your ${n}s marked in box ${b + 1} are all in ${line}. The box's ${n} is one of them, so ${n} can't go in the rest of box ${b + 1} or ${line}.`
          : `Your ${n} marks in box ${b + 1} show where the box's ${n} goes, so ${n} can't go in the rest of box ${b + 1}.`,
        why: (r: number, c: number) => `your marked ${n}s say ${boxOf(r, c) === b ? `box ${b + 1}` : line}'s ${n} is at ${either(at)}`,
        cells: at,
        line: line ? NUMS.map((_, i) => (sameRow ? [at[0][0], i] : [i, at[0][1]]) as Cell) : box, // shade just the row or column
      };
      for (const x of box) if (!at.some((p) => same(p, x))) add(x[0], x[1], n, g);
      for (let i = 0; i < 9; i++) {
        if (sameRow && boxOf(at[0][0], i) !== b) add(at[0][0], i, n, g);
        if (sameCol && boxOf(i, at[0][1]) !== b) add(i, at[0][1], n, g);
      }
    }
  }
  // X-wing marks: two rows each with N corner-marked in just the same two columns (each row's N is one of its
  // two, used only if that's right), so N can't go anywhere else in those columns. Same with rows and columns swapped.
  for (const byRow of [true, false]) {
    const at = (i: number, j: number): Cell => (byRow ? [i, j] : [j, i]);
    const [kind, other] = byRow ? ["row", "column"] : ["column", "row"];
    for (const n of NUMS) {
      const two = NUMS.map((_, i) => ({ i, js: NUMS.map((_, j) => j).filter((j) => {
        const [r, c] = at(i, j);
        return board[r][c] === 0 && corners[`${r},${c}`]?.includes(n);
      }) })).filter((x) => x.js.length === 2 && x.js.some((j) => solution[at(x.i, j)[0]][at(x.i, j)[1]] === n));
      for (let a = 0; a < two.length; a++) {
        for (let b = a + 1; b < two.length; b++) {
          const [j1, j2] = two[a].js;
          if (two[b].js.join() !== [j1, j2].join()) continue;
          const cells = [at(two[a].i, j1), at(two[a].i, j2), at(two[b].i, j1), at(two[b].i, j2)];
          const g = {
            note: `Your ${n}s marked in ${kind}s ${two[a].i + 1} and ${two[b].i + 1} are in ${other}s ${j1 + 1} and ${j2 + 1}. Each ${kind}'s ${n} is one of them, so ${n} can't go anywhere else in ${other}s ${j1 + 1} and ${j2 + 1}.`,
            // The cell's own column (or row): its N is one of your two marks in it.
            why: (r: number, c: number) => {
              const j = byRow ? c : r;
              return `your marked ${n}s say ${other} ${j + 1}'s ${n} is at ${either(cells.filter((p) => (byRow ? p[1] : p[0]) === j))}`;
            },
            cells,
            line: [j1, j2].flatMap((j) => NUMS.map((_, i) => at(i, j))),
          };
          for (const j of [j1, j2]) for (let i = 0; i < 9; i++) if (i !== two[a].i && i !== two[b].i) add(...at(i, j), n, g);
        }
      }
    }
  }
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

// `board` = givens plus the player's numbers (0 = empty). `marks` / `corners` = the player's center / corner marks.
export function hint(board: Grid, solution: Grid, marks: Marks = {}, corners: Marks = {}): Hint {
  const none = { remove: null, value: 0 };
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0 && board[r][c] !== solution[r][c]) {
        return {
          kind: "mistake", technique: "Check this", focus: board[r].map((_, i) => [r, i] as Cell), target: [r, c], ...none,
          nudge: `Something's off in row ${r + 1}.`,
          explain: `The ${board[r][c]} at ${cellName(r, c)} doesn't fit the answer.`,
          showMe: "Cleared it. Try that cell again.",
        };
      }
    }
  }
  const out: RuledOut = new Set();
  const from: Sources = new Map();
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
    for (const n of NUMS) if (!list.includes(n)) out.add(`${r},${c},${n}`), from.set(`${r},${c},${n}`, [r, c]);
  }
  fromGroups(board, solution, marks, corners, out, from);

  const place = firstOf(board, out);
  if (place) {
    return {
      kind: "step", technique: place.technique, focus: place.focus, target: [place.row, place.col], value: place.value,
      remove: null, blockers: blockersWith(place, from), inferred: inferredOf(place), nudge: place.nudge, explain: withNotes(place, from), showMe: `It's ${place.value === 8 ? "an" : "a"} ${place.value}!`,
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
  const base = { kind: "step" as const, technique: step.technique, focus: step.focus, target: null, value: step.value, values,
    remove: step.remove, spots: step.spots, blockers: blockersWith(step, from), inferred: inferredOf(step), nudge: step.nudge, explain: withNotes(step, from) };
  // Pointing, Claiming and X-wing: mark the number in the cells where it can still go (Colin, 10/21: X-wing's
  // marks go in its four corners, not the cells it clears).
  if (step.technique === "Pointing" || step.technique === "Claiming" || step.technique === "X-wing") {
    const a = step.value === 8 ? "an" : "a";
    return { ...base, corner: { cells: step.spots!, n: step.value }, showMe: `Marked ${a} ${step.value} in the cells where it can go.` };
  }
  // Pairs and Hidden pairs: write the two numbers in the pair's two cells.
  if (step.technique === "Pairs" || step.technique === "Hidden pairs") {
    const pencil = step.spots!.map((cell) => ({ cell, marks: left(cell) }));
    return { ...base, pencil, showMe: `Wrote ${pencil[0].marks.join(" ")} in the pair.` };
  }
  // Y-wing: write what's left in the cells it clears.
  const k = step.remove.length;
  const pencil = step.remove.map((cell) => ({ cell, marks: left(cell) }));
  return { ...base, pencil,
    showMe: `${values.join(" and ")} ${values.length > 1 ? "are" : "is"} ruled out of ${k === 1 ? "1 cell" : `${k} cells`}. Pencil marks added.` };
}

// Show me on a rule-out hint: write its marks into the player's center and corner marks (the page does the same).
export function writeMarks(h: Hint, marks: Marks, corners: Marks) {
  for (const p of h.pencil ?? []) marks[`${p.cell[0]},${p.cell[1]}`] = p.marks;
  for (const [r, c] of h.corner?.cells ?? []) {
    const k = `${r},${c}`;
    if (!corners[k]?.includes(h.corner!.n)) corners[k] = [...(corners[k] ?? []), h.corner!.n].sort();
  }
}

// Tap the bulb and "Show me" over and over, like a player who only follows hints (numbers + the pencil marks
// hints write). Returns every hint shown and whether it finished. Used by the puzzle maker and the checks.
export function playHints(givens: Grid, solution: Grid, limit = 300) {
  const b = givens.map((r) => [...r]);
  const marks: Marks = {};
  const corners: Marks = {};
  const shown: Hint[] = [];
  for (let i = 0; i < limit; i++) {
    const h = hint(b, solution, marks, corners);
    if (h.kind !== "step") break;
    shown.push(h);
    if (!h.target) {
      writeMarks(h, marks, corners);
      continue;
    }
    const [r, c] = h.target;
    b[r][c] = h.value;
    delete marks[`${r},${c}`];
    delete corners[`${r},${c}`];
  }
  return { shown, board: b, solved: b.every((row, r) => row.every((v, c) => v === solution[r][c])) };
}

// Every trick name a list of hints showed.
export const tricksShown = (shown: Hint[]) => new Set(shown.map((h) => h.technique));
