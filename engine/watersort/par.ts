// Water Sort par (Colin 10/27, S17): the fewest pours that solve a level. A* search: every colour run that isn't the
// bottom of its tube, and every extra tube a colour starts at the bottom of, has to be poured at least once, so that
// count (solve.ts mess()) never overestimates and the first finish found is the shortest. Every pack level takes
// under 50ms on a computer (checks/watersort.ts); a level too big to finish inside the cap gets no par (null).
import { type State, isSolved, moves, pour, stateKey } from "./rules.ts";
import { mess } from "./solve.ts";

const CAP = 300_000; // most states to look at

class Heap {
  items: [number, State, number][] = [];
  push(f: number, s: State, g: number) {
    const a = this.items;
    a.push([f, s, g]);
    for (let i = a.length - 1; i > 0; ) {
      const j = (i - 1) >> 1;
      if (a[j][0] <= a[i][0]) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop() {
    const a = this.items, out = a[0], last = a.pop()!;
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

export function par(start: State, cap = CAP): number | null {
  if (isSolved(start)) return 0;
  const best = new Map([[stateKey(start), 0]]);
  const open = new Heap();
  open.push(mess(start), start, 0);
  let looked = 0;
  while (open.size) {
    const [, s, g] = open.pop();
    if (best.get(stateKey(s))! < g) continue; // a shorter way here was found later
    if (isSolved(s)) return g;
    if (++looked > cap) return null;
    for (const m of moves(s)) {
      const next = pour(s, ...m), k = stateKey(next);
      if ((best.get(k) ?? Infinity) <= g + 1) continue;
      best.set(k, g + 1);
      open.push(g + 1 + mess(next), next, g + 1);
    }
  }
  return null;
}
