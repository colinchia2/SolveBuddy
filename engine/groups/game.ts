// Groups (Colin 11/6, mockup https://claude.ai/artifact/VXRHLipgS4hsHdEqGSAUqM): he makes his own groups of 4 to 8 words, each
// with a difficulty colour, and a game deals 16 words from 4 of them. A word in two groups is a trap: it shows in one and
// looks like it fits the other. A board always has exactly one answer.
export type Group = { id: number; name: string; d: number; words: string[] };
export type Dealt = { g: Group; words: string[] }[];
export const SIZE = 4, MIN = 4, MAX = 8;
const low = (w: string) => w.trim().toLowerCase();
export const same = (a: string, b: string) => low(a) === low(b);
export const inGroups = (groups: Group[], word: string) => groups.filter((g) => g.words.some((w) => same(w, word)));
// Words in more than one of these groups.
export function traps(set: Group[]) {
  const seen: Record<string, number> = {};
  for (const g of set) for (const w of new Set(g.words.map(low))) seen[w] = (seen[w] ?? 0) + 1;
  return Object.values(seen).filter((n) => n > 1).length;
}
export const cleanWords = (words: string[]) => {
  const out: string[] = [];
  for (const w of words.map((x) => x.trim()).filter(Boolean)) if (!out.some((x) => same(x, w))) out.push(w);
  return out.slice(0, MAX);
};
function shuffled<T>(a: T[], rng: () => number) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
export { shuffled };
// How many ways the board's 16 words split into its 4 groups.
export function answers(dealt: Dealt) {
  const tiles = dealt.flatMap((x) => x.words), groups = dealt.map((x) => x.g);
  const room = groups.map(() => SIZE);
  const go = (i: number): number => {
    if (i === tiles.length) return 1;
    let n = 0;
    groups.forEach((g, k) => {
      if (room[k] && g.words.some((w) => same(w, tiles[i]))) { room[k]--; n += go(i + 1); room[k]++; }
    });
    return n;
  };
  return go(0);
}
// 4 words from each group, with shared words used as traps. Null if no board with one answer turned up.
export function deal(set: Group[], rng: () => number = Math.random): Dealt | null {
  let best: Dealt | null = null, shared = -1;
  for (let t = 0; t < 60; t++) {
    const used = new Set<string>(), out: Dealt = [];
    for (const g of shuffled(set, rng)) {
      const spare = shuffled(g.words, rng).sort((a, b) => Number(set.filter((x) => x.words.some((w) => same(w, b))).length > 1) - Number(set.filter((x) => x.words.some((w) => same(w, a))).length > 1));
      const mine = spare.filter((w) => !used.has(low(w))).slice(0, SIZE);
      mine.forEach((w) => used.add(low(w)));
      out.push({ g, words: mine });
    }
    if (out.some((x) => x.words.length < SIZE) || answers(out) !== 1) continue;
    const onBoard = out.flatMap((x) => x.words).filter((w) => set.filter((g) => g.words.some((v) => same(v, w))).length > 1).length;
    if (onBoard > shared) { shared = onBoard; best = out; }
  }
  return best;
}
// The 4 groups with the most traps that make a good board, mixing difficulties. Ties break at random.
export function bestFour(groups: Group[], rng: () => number = Math.random): Group[] | null {
  const ok = shuffled(groups.filter((g) => g.words.length >= MIN), rng);
  let best: Group[] | null = null, top = -1, tried = 0;
  const pick = (i: number, c: Group[]) => {
    if (tried > 4000) return;
    if (c.length === SIZE) {
      tried++;
      const s = traps(c) * 10 + new Set(c.map((g) => g.d)).size;
      if (s > top && deal(c, rng)) { top = s; best = [...c]; }
      return;
    }
    for (let k = i; k < ok.length; k++) pick(k + 1, [...c, ok[k]]);
  };
  pick(0, []);
  return best;
}
export const STARTERS: Group[] = [
  { id: 1, name: "Coffee orders", d: 0, words: ["Latte", "Mocha", "Cortado", "Americano"] },
  { id: 2, name: "Things with teeth", d: 1, words: ["Saw", "Comb", "Zipper", "Key", "Gear"] },
  { id: 3, name: "Things you can crack", d: 2, words: ["Joke", "Code", "Egg", "Knuckle"] },
  { id: 4, name: "Words before \"board\"", d: 3, words: ["Skate", "Surf", "Key", "Chess", "Snow", "Dash"] },
  { id: 5, name: "Hidden body part", d: 3, words: ["Chinese", "Shipping", "Alarm", "Earth"] },
];
