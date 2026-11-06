// Five Letters (Colin 11/6, mockup https://claude.ai/artifact/815yFdPy1tvKmMJmkE8zb2): guess a five-letter word in six tries.
// r = right spot, n = in the word but elsewhere, m = not in the word. No AI: a word list and these rules.
export const TRIES = 6, LEN = 5;
export type Mark = "r" | "n" | "m";

// A repeated letter only scores as many times as it's in the word, and right spots count first.
export function score(guess: string, answer: string): Mark[] {
  const out: Mark[] = Array(LEN).fill("m");
  const left: Record<string, number> = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === answer[i]) out[i] = "r";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (out[i] === "r" || !left[guess[i]]) continue;
    out[i] = "n";
    left[guess[i]]--;
  }
  return out;
}
// What a keyboard letter shows: its best result so far.
export function keyMarks(guesses: string[], answer: string) {
  const rank: Record<Mark, number> = { m: 1, n: 2, r: 3 }, keys: Record<string, Mark> = {};
  for (const g of guesses) score(g, answer).forEach((m, i) => { if (!keys[g[i]] || rank[m] > rank[keys[g[i]]]) keys[g[i]] = m; });
  return keys;
}
// A hint: the first spot you haven't got right yet.
export function hintSpot(guesses: string[], answer: string, shown: number[]) {
  const got = new Set(shown);
  for (const g of guesses) score(g, answer).forEach((m, i) => { if (m === "r") got.add(i); });
  for (let i = 0; i < LEN; i++) if (!got.has(i)) return i;
  return -1;
}
