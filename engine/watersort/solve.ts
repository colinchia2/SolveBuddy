// Water Sort solver: best-first search (fewest colour breaks first), skipping states already seen.
// Used to prove a made level can be solved, and by the Hint button for the next good move.
import { type Move, type State, isSolved, moves, pour, stateKey } from "./rules.ts";

// How messy a state is: each place two different colours touch, plus each colour split over extra tubes' bottoms.
export function mess(s: State) {
  let n = 0;
  const bottoms = new Set<string>();
  for (const t of s) {
    for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1]) n++;
    if (t.length) {
      if (bottoms.has(t[0])) n++;
      bottoms.add(t[0]);
    }
  }
  return n;
}

// Tiny binary heap on a number.
class Heap<T> {
  items: [number, T][] = [];
  push(p: number, v: T) {
    const a = this.items;
    a.push([p, v]);
    for (let i = a.length - 1; i > 0; ) {
      const j = (i - 1) >> 1;
      if (a[j][0] <= a[i][0]) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const out = a[0][1], last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return out;
  }
  get size() { return this.items.length; }
}

export type Solution =
  | { kind: "solved"; path: Move[] } // a way to finish (not always the shortest)
  | { kind: "stuck" } // every move tried: it can't be finished from here
  | { kind: "unsure" }; // gave up after `cap` states

// cap = most states to look at. weight > 1 favours tidier states over shorter paths (faster, slightly longer).
export function solve(start: State, cap = 20000, weight = 2): Solution {
  if (isSolved(start)) return { kind: "solved", path: [] };
  type Node = { s: State; path: Move[] };
  const seen = new Set([stateKey(start)]);
  const open = new Heap<Node>();
  open.push(0, { s: start, path: [] });
  let looked = 0;
  while (open.size) {
    const { s, path } = open.pop()!;
    if (++looked > cap) return { kind: "unsure" };
    for (const m of moves(s)) {
      const next = pour(s, ...m);
      const k = stateKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      const p = [...path, m];
      if (isSolved(next)) return { kind: "solved", path: p };
      open.push(p.length + weight * mess(next), { s: next, path: p });
    }
  }
  return { kind: "stuck" };
}

// When the search gives up: the move that leaves the tidiest board.
export function tidiestMove(s: State): Move | null {
  let best: Move | null = null, score = Infinity;
  for (const m of moves(s)) {
    const v = mess(pour(s, ...m));
    if (v < score) score = v, best = m;
  }
  return best;
}
