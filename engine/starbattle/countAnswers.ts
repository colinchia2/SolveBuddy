// Star Battle answers for any board (5×5 to 12×12) and any stars per row, column and region (1–3), for imported
// puzzles (Colin, 10/22). Tries every way row by row, so it is never wrong; stops counting at `limit`.
// found gets each answer as rows of star columns, e.g. [[1, 6], [3, 8], …].
import { type Regions } from "./layout.ts";

export function countAnswers(regions: Regions, stars: number, limit = 2, found: number[][][] = []): number {
  const n = regions.length;
  const col = Array(n).fill(0);
  const reg: Record<string, number> = {};
  const lastRow: Record<string, number> = {};
  regions.forEach((row, r) => [...row].forEach((l) => (lastRow[l] = r)));
  // Every way to put `stars` stars in one row without two side by side.
  const picks: number[][] = [];
  const pick = (from: number, chosen: number[]) => {
    if (chosen.length === stars) return void picks.push([...chosen]);
    for (let c = from; c < n; c++) pick(c + 2, [...chosen, c]);
  };
  pick(0, []);
  const rows: number[][] = [];
  let count = 0;
  function search(r: number) {
    if (count >= limit) return;
    if (r === n) {
      count++;
      found.push(rows.map((p) => [...p]));
      return;
    }
    const above = rows[r - 1] ?? [];
    for (const p of picks) {
      if (p.some((c) => col[c] >= stars || above.some((a) => Math.abs(a - c) <= 1))) continue;
      const add: Record<string, number> = {};
      for (const c of p) add[regions[r][c]] = (add[regions[r][c]] ?? 0) + 1;
      if (Object.entries(add).some(([l, k]) => (reg[l] ?? 0) + k > stars)) continue;
      for (const c of p) col[c]++;
      for (const [l, k] of Object.entries(add)) reg[l] = (reg[l] ?? 0) + k;
      rows.push(p);
      // A region that ends on this row must be full; a column can't need more stars than it has rows for
      // (its stars can't sit in rows next to each other).
      const left = n - 1 - r;
      if (Object.keys(lastRow).every((l) => lastRow[l] !== r || reg[l] === stars) && col.every((k) => stars - k <= Math.ceil(left / 2))) search(r + 1);
      for (const c of p) col[c]--;
      for (const [l, k] of Object.entries(add)) reg[l] -= k;
      rows.pop();
    }
  }
  // Each region needs room for its stars at all: as many regions as rows, or no answer.
  if (Object.keys(lastRow).length !== n) return 0;
  search(0);
  return count;
}
