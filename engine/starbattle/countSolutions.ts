// Star Battle step 3, the checker: how many ways can the stars go? Stops counting at 2.
// It tries every column in every row (no human tricks), so it is never wrong.
import { type Regions, type Stars } from "./layout.ts";

export function countSolutions(regions: Regions, limit = 2, found: Stars[] = []): number {
  const n = regions.length;
  const cols = new Set<number>();
  const regs = new Set<string>();
  const stars: Stars = [];
  let count = 0;
  function search(row: number) {
    if (count >= limit) return;
    if (row === n) {
      count++;
      found.push([...stars]);
      return;
    }
    for (let col = 0; col < n; col++) {
      const reg = regions[row][col];
      if (cols.has(col) || regs.has(reg)) continue;
      if (row > 0 && Math.abs(stars[row - 1] - col) <= 1) continue;
      cols.add(col), regs.add(reg), stars.push(col);
      search(row + 1);
      cols.delete(col), regs.delete(reg), stars.pop();
    }
  }
  search(0);
  return count;
}
