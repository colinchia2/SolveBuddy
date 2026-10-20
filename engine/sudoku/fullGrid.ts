// Step 1 of making a Sudoku: fill a complete, valid 9×9 grid at random.
// Fill cells left to right, top to bottom. Try the numbers 1–9 in a shuffled order.
// If no number fits a cell, back up to the previous cell and try its next number.

export type Grid = number[][]; // 9 rows of 9 numbers; 0 = empty

export function makeFullGrid(): Grid {
  const grid: Grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  fill(grid, 0);
  return grid;
}

function fill(grid: Grid, cell: number): boolean {
  if (cell === 81) return true; // every cell filled
  const row = Math.floor(cell / 9);
  const col = cell % 9;
  for (const n of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (fits(grid, row, col, n)) {
      grid[row][col] = n;
      if (fill(grid, cell + 1)) return true;
      grid[row][col] = 0; // dead end later on: undo and try the next number
    }
  }
  return false;
}

// Can n go here without repeating in its row, column or 3×3 box?
export function fits(grid: Grid, row: number, col: number, n: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === n || grid[i][col] === n) return false;
  }
  const r0 = row - (row % 3);
  const c0 = col - (col % 3);
  for (let r = r0; r < r0 + 3; r++) {
    for (let c = c0; c < c0 + 3; c++) {
      if (grid[r][c] === n) return false;
    }
  }
  return true;
}

// True if the grid is complete and follows every rule.
export function isValidSolution(grid: Grid): boolean {
  const groups: number[][] = [];
  for (let i = 0; i < 9; i++) {
    groups.push(grid[i]); // row
    groups.push(grid.map((r) => r[i])); // column
    const r0 = Math.floor(i / 3) * 3;
    const c0 = (i % 3) * 3;
    groups.push(grid.slice(r0, r0 + 3).flatMap((r) => r.slice(c0, c0 + 3))); // box
  }
  return groups.every((g) => [...g].sort().join("") === "123456789");
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
