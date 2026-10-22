// Water Sort rules: tubes hold 4 units of colour. A pour moves the top run of one colour onto an empty tube or onto
// the same colour, as much as fits. Solved = every tube empty or full of one colour.
export const CAP = 4;
export type Tube = string[]; // bottom → top, one letter per unit of colour
export type State = Tube[];
export type Move = [number, number]; // pour from tube a into tube b

export const top = (t: Tube) => t[t.length - 1];
// How many units of the top colour sit together at the top.
export function topRun(t: Tube) {
  let n = 0;
  while (n < t.length && t[t.length - 1 - n] === top(t)) n++;
  return n;
}
export const isDone = (t: Tube) => t.length === 0 || (t.length === CAP && t.every((c) => c === t[0]));
export const isSolved = (s: State) => s.every(isDone);

export function canPour(s: State, a: number, b: number) {
  const from = s[a], to = s[b];
  return a !== b && from.length > 0 && to.length < CAP && (to.length === 0 || top(to) === top(from));
}

// A pour that changes nothing worth having: a tube of one colour poured into an empty tube.
export function pointless(s: State, a: number, b: number) {
  const from = s[a];
  return s[b].length === 0 && topRun(from) === from.length;
}

export function pour(s: State, a: number, b: number): State {
  const amount = Math.min(topRun(s[a]), CAP - s[b].length);
  const next = s.map((t) => [...t]);
  for (let i = 0; i < amount; i++) next[b].push(next[a].pop()!);
  return next;
}

export function moves(s: State): Move[] {
  const out: Move[] = [];
  for (let a = 0; a < s.length; a++) {
    if (isDone(s[a]) && s[a].length) continue; // a finished tube never moves
    for (let b = 0; b < s.length; b++) if (canPour(s, a, b) && !pointless(s, a, b)) out.push([a, b]);
  }
  return out;
}

// Tube order doesn't matter for solving, so equal states with tubes swapped count once.
export const stateKey = (s: State) => s.map((t) => t.join("")).sort().join("|");
