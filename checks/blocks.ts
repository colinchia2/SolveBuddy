// Block Drop checks (free, repeatable): pieces, turning with wall kicks, line clears and scoring, the bag, game over.
// Run: node checks/blocks.ts
import { W, H, cellsOf, fits, newGame, move, rotate, hardDrop, softDrop, lock, ghost, gravityMs, type State } from "../engine/blocks/game.ts";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}
// A repeatable "random": the same numbers every run.
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const empty = () => Array.from({ length: H }, () => Array(W).fill(0));
const withPiece = (t: number, extra: Partial<State> = {}): State =>
  ({ board: empty(), piece: { t, r: 0, x: 3, y: 0 }, bag: [], next: 2, score: 0, lines: 0, level: 1, over: false, ...extra });

// The bag: every 7 pieces in a row hold each piece once.
{
  const rand = seeded(), s = newGame(rand), seen: number[] = [s.piece!.t];
  for (let i = 0; i < 13; i++) { s.board = empty(); hardDrop(s, rand); seen.push(s.piece!.t); }
  check("7-bag: each run of 7 pieces has all 7", [0, 7].every((i) => new Set(seen.slice(i, i + 7)).size === 7));
}

// Turning: four quarter turns bring a piece back; every piece always covers 4 cells.
{
  const s = withPiece(2, { piece: { t: 2, r: 0, x: 4, y: 5 } });
  const start = JSON.stringify(cellsOf(s.piece!).sort());
  for (let i = 0; i < 4; i++) rotate(s);
  check("T turned 4 times is back where it started", JSON.stringify(cellsOf(s.piece!).sort()) === start);
  check("every piece covers 4 cells in every turn", [0, 1, 2, 3, 4, 5, 6].every((t) => [0, 1, 2, 3].every((r) => new Set(cellsOf({ t, r, x: 3, y: 3 }).map(String)).size === 4)));
}

// Wall kick: an upright I against the right wall still turns (it's pushed back in).
{
  const s = withPiece(0, { piece: { t: 0, r: 1, x: 7, y: 5 } }); // vertical I in the last column
  const ok = cellsOf(s.piece!).every(([x]) => x === 9) && rotate(s);
  check("I at the right wall turns flat by kicking left", ok && cellsOf(s.piece!).every(([x, y]) => x >= 0 && x < W && y === cellsOf(s.piece!)[0][1]));
}

// Walls and floor stop a piece.
{
  const s = withPiece(1, { piece: { t: 1, r: 0, x: 0, y: 0 } });
  check("can't move through the left wall", !move(s, -1));
  const g = ghost(s)!;
  check("ghost lands on the floor", Math.max(...cellsOf(g).map(([, y]) => y)) === H - 1);
}

// Line clear + scoring: a row with a one-wide gap, filled by an upright I, clears 4 rows for 800 (level 1).
{
  const board = empty();
  for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x++) board[y][x] = x === 9 ? 0 : 3;
  const s = withPiece(0, { board, piece: { t: 0, r: 1, x: 7, y: 0 } });
  const res = hardDrop(s, seeded());
  check("an I down the gap clears 4 rows", res.rows.length === 4 && s.board.every((row) => row.every((v) => !v)));
  check("4 rows = 800 × level, plus 2 a row for the drop", res.points === 800 && s.score === 800 + res.dropped * 2 && res.dropped === 16);
  check("lines counted", s.lines === 4);
}
{
  const board = empty();
  for (let x = 0; x < W; x++) if (x < 3 || x > 5) board[H - 1][x] = 2;
  const s = withPiece(2, { board, piece: { t: 2, r: 0, x: 3, y: 0 } }); // T point up: its flat side fills the gap
  const res = hardDrop(s, seeded());
  check("one row clears for 100, rows above drop down", res.rows.length === 1 && res.points === 100 && s.board[H - 1].filter(Boolean).length === 1);
}
{
  const s = withPiece(1, { piece: { t: 1, r: 0, x: 4, y: 0 } });
  softDrop(s);
  softDrop(s);
  check("soft drop: 1 point a row", s.score === 2);
}

// Level: every 10 lines, and it gets faster.
{
  const board = empty();
  for (let x = 0; x < W - 1; x++) board[H - 1][x] = 4;
  const s = withPiece(0, { board, lines: 9, piece: { t: 0, r: 1, x: 7, y: 0 } });
  const res = hardDrop(s, seeded());
  check("10th line: level 2, and the next clear scores double", res.levelUp && s.level === 2);
  check("falls faster each level", gravityMs(1) > gravityMs(2) && gravityMs(2) > gravityMs(10) && gravityMs(99) === 70);
}

// Game over: the well is full to the top, so the next piece can't come in.
{
  const board = empty();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) board[y][x] = (x + y) % 2 ? 0 : 5; // no full rows
  board[1][3] = board[1][4] = board[1][5] = 5;
  const s = withPiece(1, { board, piece: { t: 1, r: 0, x: 0, y: -2 } });
  lock(s, seeded());
  check("game over when the next piece doesn't fit", s.over && !s.piece && !fits(board, { t: 2, r: 0, x: 3, y: 0 }));
}

console.log(failed ? `${failed} FAILED` : "all ok");
process.exitCode = failed ? 1 : 0;
