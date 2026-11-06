// Star Battle hints head for the next star (Colin 11/6, mockup https://claude.ai/artifact/MQeXLRWBCVfXdC4fo1Jnpa). A hint
// finds the shortest route to a star and walks it, so most stars take one hint. Routes longer than LIMIT steps say so and
// offer the star outright: a really hard puzzle stays really hard, and the player chooses.
// Same rules as Sudoku's hints: it stands alone, starts by pointing somewhere, plain words, no cell codes.
import { type Hint, hint } from "./hint.ts";
import { CROSS, EMPTY, HARD_TECHNIQUES, STAR, type Board, type Step, chainFrom, nextStep } from "./techniques.ts";
import { type Regions, type Stars, isAnswer } from "./layout.ts";

type Cell = [number, number];
export type StarWalkStep = { title: string; body?: string; zone?: Cell[]; dead?: Cell[]; no?: Cell[]; spot?: Cell; pretend?: Cell[]; ghost?: Cell[] };
export type StarHint = Hint & { walk?: StarWalkStep[]; long?: { steps: number }; give?: Cell | null };

export const LIMIT = 5; // the most steps a hint shows without asking (Colin 11/6)
const MAX_EASY = 8, MAX_CHAIN = 6, BUDGET_MS = 500;
const RULES_OUT = "Star rules out"; // an already-placed star's neighbours: nothing to teach, so never a step

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
// Plain words: no cell codes, and squares, not cells.
export const plain = (t: string) => cap(t.replace(/A star at R\d+C\d+/g, "A star here").replace(/\bat R\d+C\d+/g, "here").replace(/R\d+C\d+/g, "this square")
  .replace(/the striped cells/g, "the squares marked ×").replace(/\bcells\b/g, "squares").replace(/\bcell\b/g, "square"));

const copy = (b: Board) => b.map((row) => [...row]);
const mark = (b: Board, cells: Cell[]) => { for (const [r, c] of cells) if (b[r][c] === EMPTY) b[r][c] = CROSS; };

// Follow the easy moves until one gives a star. Null if they run out or it's too far.
function easyRoute(b0: Board, regions: Regions) {
  const b = copy(b0), steps: Step[] = [];
  for (let i = 0; i < MAX_EASY; i++) {
    const s = nextStep(b, regions, HARD_TECHNIQUES);
    if (!s) return null;
    if (s.star) return [...steps, s];
    mark(b, s.cross);
    if (s.technique !== RULES_OUT) steps.push(s);
  }
  return null;
}
type Route = { easy: Step[]; whatIf?: { cell: Cell; chain: NonNullable<Step["chain"]>; pretendCross: Cell[]; dead: { label: string; cells: Cell[] } } };
const size = (r: Route) => r.easy.length + (r.whatIf ? r.whatIf.chain.length + 2 : 0);

// The shortest route to a star: easy moves alone, or one What if and then easy moves.
function bestRoute(b: Board, regions: Regions, solution: Stars): Route | null {
  const easy = easyRoute(b, regions);
  let best: Route | null = easy ? { easy } : null;
  if (best && size(best) <= 1) return best;
  const stop = Date.now() + BUDGET_MS;
  for (let r = 0; r < b.length; r++) {
    for (let c = 0; c < b.length; c++) {
      if (b[r][c] !== EMPTY || isAnswer(solution, r, c)) continue;
      if (Date.now() > stop) return best;
      const found = chainFrom(b, regions, [r, c], best ? Math.min(MAX_CHAIN, Math.max(0, size(best) - 3)) : MAX_CHAIN);
      if (!found) continue;
      const t = copy(b);
      t[r][c] = CROSS;
      const after = easyRoute(t, regions);
      if (!after) continue;
      const route: Route = { easy: after, whatIf: { cell: [r, c], chain: found.chain, pretendCross: found.pretendCross, dead: found.dead } };
      if (!best || size(route) < size(best)) best = route;
    }
  }
  return best;
}

function easyStep(s: Step, done: Cell[]): StarWalkStep {
  return { title: s.nudge, body: plain(s.why), zone: s.focus, no: [...done, ...s.cross], spot: s.star ?? undefined };
}
// The What if: try a star, see what it forces, and rule the square out. Short chains fit in one step.
function whatIfSteps(w: NonNullable<Route["whatIf"]>, b: Board): StarWalkStep[] {
  const stars: Cell[] = [w.cell], ghost: Cell[] = [...w.pretendCross], open = () => w.dead.cells.filter(([r, c]) => b[r][c] === EMPTY && !ghost.some((p) => p[0] === r && p[1] === c) && !stars.some((p) => p[0] === r && p[1] === c));
  const name = w.dead.label;
  if (w.chain.length <= 2) {
    for (const m of w.chain) { if (m.star) stars.push(m.star); ghost.push(...m.cross); }
    const forced = w.chain.length ? `That forces ${w.chain.length === 1 ? "one more move" : "two more moves"}, and then ` : "Then ";
    return [{ title: "Try a star here", body: `${forced}${name} has no room left. So this square is out.`, pretend: stars, ghost, dead: open() }];
  }
  const steps: StarWalkStep[] = [{ title: "Try a star here", body: "Faint marks are pretend. See what it forces.", pretend: [...stars], ghost: [...ghost] }];
  for (const m of w.chain) {
    if (m.star) stars.push(m.star);
    ghost.push(...m.cross);
    steps.push({ title: plain(m.why), pretend: [...stars], ghost: [...ghost], zone: m.focus });
  }
  steps.push({ title: `${cap(name)} has no room left`, body: "So the first pretend star can't be right, and that square is out.", pretend: [...stars], ghost: [...ghost], dead: open() });
  return steps;
}

export function starHint(board: Board, regions: Regions, solution: Stars): StarHint {
  const old = hint(board, regions, solution);
  if (old.kind !== "step") return old;
  const b = board.map((row, r) => row.map((v, c) => (v === CROSS && isAnswer(solution, r, c) ? EMPTY : v)));
  const route = bestRoute(b, regions, solution);
  const give = route?.easy.at(-1)?.star ?? firstStar(board, solution);
  if (!route) {
    const walk: StarWalkStep[] = old.chain
      ? whatIfSteps({ cell: old.cross[0], chain: old.chain, pretendCross: old.pretendCross!, dead: old.dead! }, b)
      : [{ title: old.nudge, body: plain(old.explain), zone: old.focus }];
    walk.push({ title: old.cross.length === 1 ? "So this square is out" : "So these squares are out", no: old.cross }); // the last step does the move
    return { ...old, chain: undefined, walk, long: { steps: 0 }, give };
  }
  const walk: StarWalkStep[] = [];
  const last = route.easy.at(-1)!;
  const done: Cell[] = [];
  if (route.whatIf) {
    walk.push({ title: last.nudge, body: "To place its star, one square has to be ruled out first.", zone: last.focus });
    walk.push(...whatIfSteps(route.whatIf, b));
    done.push(route.whatIf.cell);
  }
  for (const s of route.easy) {
    walk.push(easyStep(s, done));
    done.push(...s.cross);
  }
  const star = last.star!;
  if (walk.length === 1) { // the last step places the star, so the reason comes first
    walk[0].spot = undefined;
    walk.push({ title: "It's a star", body: "That's the next star.", spot: star });
  }
  return { ...old, technique: route.whatIf ? "What if" : last.technique, star, cross: done, focus: last.focus, chain: undefined, pretendCross: undefined, dead: undefined,
    clear: board[star[0]][star[1]] === CROSS ? star : null, walk, give, long: walk.length > LIMIT ? { steps: walk.length } : undefined };
}

// A star for "Just show me the star" when there's no route: the first one of the answer not on the board.
function firstStar(board: Board, solution: Stars): Cell | null {
  for (let r = 0; r < board.length; r++) for (let c = 0; c < board.length; c++) if (board[r][c] !== STAR && isAnswer(solution, r, c)) return [r, c];
  return null;
}
