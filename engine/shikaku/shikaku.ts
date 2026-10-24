// Shikaku (Colin 10/24, docs/design/shikaku_mockup.html v2): cut the square into rectangles ("patches"); each patch
// holds exactly one number, and that number is how many squares it covers.
// A puzzle: size n, clues [row, col, number], and the answer, one rectangle per clue (same order).
// The player's board is a list of patches. A patch is "right" when it holds one number and sits inside that number's
// answer: a whole one is done, a smaller one is a start (hints draw those too, "partial patches"). Hints reason only
// from right patches, so every step is true; anything else on the board is pointed out first.

export type Clue = [number, number, number]; // row, col, number
export type Rect = { r: number; c: number; w: number; h: number };
export type Puzzle = { size: number; clues: Clue[]; solution: Rect[] };
export type Hint = {
  kind: "mistake" | "full" | "partial" | "done";
  technique: string;
  nudge: string; explain: string; showMe: string;
  clue: number; // which clue it's about (-1 for a mistake with no number / done)
  rect: Rect | null; // what Show me draws (full or partial patch)
  remove: Rect | null; // what Show me takes away (a mistake)
  focus: [number, number][]; // squares to stripe while explaining
};

export const area = (R: Rect) => R.w * R.h;
export const inside = (R: Rect, r: number, c: number) => r >= R.r && r < R.r + R.h && c >= R.c && c < R.c + R.w;
export const overlaps = (a: Rect, b: Rect) => a.r < b.r + b.h && b.r < a.r + a.h && a.c < b.c + b.w && b.c < a.c + a.w;
export const contains = (big: Rect, small: Rect) => small.r >= big.r && small.c >= big.c && small.r + small.h <= big.r + big.h && small.c + small.w <= big.c + big.w;
export const same = (a: Rect, b: Rect) => a.r === b.r && a.c === b.c && a.w === b.w && a.h === b.h;
export const cellsOf = (R: Rect): [number, number][] => {
  const o: [number, number][] = [];
  for (let r = R.r; r < R.r + R.h; r++) for (let c = R.c; c < R.c + R.w; c++) o.push([r, c]);
  return o;
};
const meet = (a: Rect, b: Rect): Rect => {
  const r = Math.max(a.r, b.r), c = Math.max(a.c, b.c);
  return { r, c, h: Math.min(a.r + a.h, b.r + b.h) - r, w: Math.min(a.c + a.w, b.c + b.w) - c };
};
export const cluesIn = (p: Puzzle, R: Rect) => p.clues.map((k, i) => i).filter((i) => inside(R, p.clues[i][0], p.clues[i][1]));

// Every rectangle that could be clue i's patch: its area, inside the board, over its own number and no other.
export function candidates(p: Puzzle, i: number): Rect[] {
  const [cr, cc, n] = p.clues[i], out: Rect[] = [];
  for (let h = 1; h <= n; h++) {
    if (n % h) continue;
    const w = n / h;
    for (let r = cr - h + 1; r <= cr; r++) for (let c = cc - w + 1; c <= cc; c++) {
      if (r < 0 || c < 0 || r + h > p.size || c + w > p.size) continue;
      const R = { r, c, w, h };
      if (p.clues.every(([kr, kc], j) => j === i || !inside(R, kr, kc))) out.push(R);
    }
  }
  return out;
}

// How many answers (stops at limit). Fills the square with the fewest choices first.
export function countSolutions(p: Puzzle, limit = 2): number {
  const N = p.size, owner = new Int16Array(N * N).fill(-1), used = new Array(p.clues.length).fill(false);
  const cands = p.clues.map((_, i) => candidates(p, i));
  const byCell: number[][][] = Array.from({ length: N * N }, () => []); // [clue, candidate index]
  cands.forEach((L, i) => L.forEach((R, k) => cellsOf(R).forEach(([r, c]) => byCell[r * N + c].push([i, k]))));
  const free = (R: Rect) => cellsOf(R).every(([r, c]) => owner[r * N + c] < 0);
  let count = 0;
  const rec = (left: number) => {
    if (count >= limit) return;
    if (!left) { count++; return; }
    let best = -1, bestOpts: [number, number][] | null = null;
    for (let x = 0; x < N * N; x++) {
      if (owner[x] >= 0) continue;
      const opts = byCell[x].filter(([i, k]) => !used[i] && free(cands[i][k]));
      if (!bestOpts || opts.length < bestOpts.length) { best = x; bestOpts = opts; if (opts.length <= 1) break; }
    }
    if (!bestOpts || !bestOpts.length) return;
    for (const [i, k] of bestOpts) {
      const R = cands[i][k];
      used[i] = true; cellsOf(R).forEach(([r, c]) => (owner[r * N + c] = i));
      rec(left - area(R));
      used[i] = false; cellsOf(R).forEach(([r, c]) => (owner[r * N + c] = -1));
      if (count >= limit) return;
    }
    void best;
  };
  rec(N * N);
  return count;
}

// Which of the player's patches are right (inside their number's answer) and which aren't.
export function sortPatches(p: Puzzle, patches: Rect[]) {
  const right = new Map<number, Rect>(), wrong: Rect[] = [];
  for (const R of patches) {
    const k = cluesIn(p, R);
    if (k.length === 1 && contains(p.solution[k[0]], R) && !right.has(k[0])) right.set(k[0], R);
    else wrong.push(R);
  }
  return { right, wrong };
}
export const isDone = (p: Puzzle, R: Rect) => { const k = cluesIn(p, R); return k.length === 1 && same(p.solution[k[0]], R); };
// Solved: every square covered by patches that each hold one number and match it in size (one answer, so that's the
// answer).
export function isSolved(p: Puzzle, patches: Rect[]) {
  const N = p.size, seen = new Uint8Array(N * N);
  for (const R of patches) {
    const k = cluesIn(p, R);
    if (k.length !== 1 || p.clues[k[0]][2] !== area(R)) return false;
    for (const [r, c] of cellsOf(R)) { if (seen[r * N + c]) return false; seen[r * N + c] = 1; }
  }
  return seen.every((v) => v === 1);
}

const squares = (n: number) => `${n} square${n === 1 ? "" : "s"}`;
const where = ([r, c]: [number, number]) => `row ${r + 1}, column ${c + 1}`;
const core = (L: Rect[]) => L.reduce(meet);

// The next hint. Order: a patch that isn't right → a number with only one shape left → squares every shape of a number
// covers → a square only one number can reach. Reasoning uses the right patches on the board (they block other
// shapes) and nothing else, so each step is one a person can see.
export function hint(p: Puzzle, patches: Rect[]): Hint {
  const blank = { clue: -1, rect: null, remove: null, focus: [] as [number, number][] };
  const { right, wrong } = sortPatches(p, patches);
  if (wrong.length) {
    const R = wrong[0], k = cluesIn(p, R);
    const why = k.length === 0 ? "It has no number in it." : k.length > 1 ? `It has ${k.length} numbers in it; a patch holds one.`
      : area(R) > p.clues[k[0]][2] ? `The ${p.clues[k[0]][2]} needs ${squares(p.clues[k[0]][2])}, and this one has ${area(R)}.`
      : `The ${p.clues[k[0]][2]} can't be that shape here: it doesn't fit with the rest of the board.`;
    return { ...blank, kind: "mistake", technique: "Wrong patch", clue: k.length === 1 ? k[0] : -1, remove: R, focus: cellsOf(R),
      nudge: "One of your patches isn't right.", explain: why, showMe: "Take that patch away." };
  }
  if (isSolved(p, patches)) return { ...blank, kind: "done", technique: "", nudge: "It's solved!", explain: "", showMe: "" };
  // Each number's shapes: over its right patch (if any), clear of every other right patch.
  const placed = [...right.entries()];
  const cands = p.clues.map((_, i) => {
    const mine = right.get(i);
    return candidates(p, i).filter((R) => (!mine || contains(R, mine)) && placed.every(([j, P]) => j === i || !overlaps(R, P)));
  });
  const open = p.clues.map((_, i) => i).filter((i) => !(right.has(i) && area(right.get(i)!) === p.clues[i][2]));
  const start = (i: number): Rect => right.get(i) ?? { r: p.clues[i][0], c: p.clues[i][1], w: 1, h: 1 };
  const num = (i: number) => p.clues[i][2];
  const near = (i: number) => `the ${num(i)} (${where([p.clues[i][0], p.clues[i][1]])})`;
  // 1. Only one shape left.
  for (const i of open) if (cands[i].length === 1) {
    const R = cands[i][0], blocked = candidates(p, i).length > 1;
    return { kind: "full", technique: "Only one shape", clue: i, rect: R, remove: null, focus: cellsOf(R),
      nudge: `Look at ${near(i)}.`,
      explain: blocked ? `Every other ${num(i)}-square rectangle around it would run into another number, a patch you've drawn, or the edge. Only this one fits.`
        : `A ${num(i)}-square rectangle over it can only go one way without leaving the board or covering another number.`,
      showMe: `Draw the ${num(i)}'s patch.` };
  }
  // 2. Squares every shape covers (more than it has now).
  let best: { i: number; R: Rect } | null = null;
  for (const i of open) {
    if (!cands[i].length) continue;
    const C = core(cands[i]);
    if (area(C) > area(start(i)) && (!best || area(C) - area(start(i)) > area(best.R) - area(start(best.i)))) best = { i, R: C };
  }
  if (best) {
    const { i, R } = best;
    return { kind: "partial", technique: "Must cover", clue: i, rect: R, remove: null, focus: cellsOf(R),
      nudge: `Look at ${near(i)}.`,
      explain: `It has ${cands[i].length} possible shapes, and every one of them covers these ${squares(area(R))}. They're the ${num(i)}'s, whichever shape it ends up.`,
      showMe: `Draw that much of the ${num(i)}'s patch; drag from it later to finish.` };
  }
  // 3. A square only one number can reach.
  const N = p.size, taken = new Uint8Array(N * N);
  for (const [, P] of placed) for (const [r, c] of cellsOf(P)) taken[r * N + c] = 1;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (taken[r * N + c]) continue;
    const who = open.filter((i) => cands[i].some((R) => inside(R, r, c)));
    if (who.length !== 1) continue;
    const i = who[0], L = cands[i].filter((R) => inside(R, r, c)), R = core(L);
    if (area(R) <= area(start(i))) continue;
    return { kind: L.length === 1 ? "full" : "partial", technique: "Only one reaches", clue: i, rect: R, remove: null, focus: cellsOf(R),
      nudge: `Look at the square in ${where([r, c])}.`,
      explain: `Only ${near(i)} can reach that square; every other number's shapes stop short or are blocked. So the ${num(i)}'s patch stretches to it${L.length === 1 ? "" : ", covering at least these squares"}.`,
      showMe: L.length === 1 ? `Draw the ${num(i)}'s patch.` : `Draw that much of the ${num(i)}'s patch.` };
  }
  // Nothing simple left (the packs never get here; checks/shikaku.ts makes sure): show one patch from the answer.
  const i = open.reduce((a, b) => (cands[b].length < cands[a].length ? b : a));
  return { kind: "full", technique: "Show the answer", clue: i, rect: p.solution[i], remove: null, focus: cellsOf(p.solution[i]),
    nudge: `Look at ${near(i)}.`, explain: `Working it through takes a few steps at once here, so here's where the ${num(i)}'s patch goes.`,
    showMe: `Draw the ${num(i)}'s patch.` };
}

// What Show me does to the board.
export function applyHint(patches: Rect[], h: Hint): Rect[] {
  if (h.remove) return patches.filter((P) => P !== h.remove && !same(P, h.remove!));
  if (!h.rect) return patches;
  return [...patches.filter((P) => !overlaps(P, h.rect!)), h.rect];
}
// Hint → Show me until solved. Returns the number of steps (0 = it got stuck), and the techniques used.
export function playHints(p: Puzzle, start: Rect[] = []) {
  let b = start.slice(), steps = 0;
  const used: Record<string, number> = {};
  for (; steps < 400 && !isSolved(p, b); steps++) {
    const h = hint(p, b);
    if (h.kind === "done") break;
    used[h.technique] = (used[h.technique] ?? 0) + 1;
    b = applyHint(b, h);
  }
  return { steps: isSolved(p, b) ? steps : 0, used };
}
