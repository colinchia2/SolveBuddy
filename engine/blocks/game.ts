// Block Drop (Colin, 10/22): the falling-blocks game, as pure logic so the page and the checks share it.
// A 10×20 well, the 7 usual pieces from a shuffled bag of 7, standard rotation with wall kicks, and line scoring.
// The page owns time (gravity, lock delay) and drawing; everything here is a plain function of the state.

export const W = 10, H = 20;
export const NAMES = ["I", "O", "T", "S", "Z", "J", "L"];

// Each piece in its spawn position, drawn in its rotation box (4 for I, 2 for O, 3 for the rest).
const SHAPES: { box: number; cells: [number, number][] }[] = [
  { box: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] }, // I
  { box: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // O
  { box: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] }, // T
  { box: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] }, // S
  { box: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }, // Z
  { box: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] }, // J
  { box: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }, // L
];

// Wall kicks: the spots tried, in order, when a turn doesn't fit where it is (standard tables, y pointing down).
// Key = "from>to" rotation (0 = spawn, 1 = right, 2 = upside down, 3 = left).
const KICKS: Record<string, [number, number][]> = {
  "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
const I_KICKS: Record<string, [number, number][]> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]], "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export type Piece = { t: number; r: number; x: number; y: number };
export type State = {
  board: number[][]; // [row][column]: 0 = empty, 1–7 = a locked block of piece t + 1
  piece: Piece | null;
  bag: number[]; // pieces still to come from the current bag
  next: number;
  score: number;
  lines: number;
  level: number;
  over: boolean;
};

// The cells a piece covers on the board, as [column, row].
export function cellsOf(p: Piece): [number, number][] {
  const { box, cells } = SHAPES[p.t];
  return cells.map(([x, y]) => {
    for (let i = 0; i < p.r; i++) [x, y] = [box - 1 - y, x]; // a quarter turn clockwise in the box
    return [p.x + x, p.y + y] as [number, number];
  });
}

export const fits = (board: number[][], p: Piece) =>
  cellsOf(p).every(([x, y]) => x >= 0 && x < W && y < H && (y < 0 || !board[y][x]));

// A fresh bag holds each piece once, shuffled. rand is swappable so the checks are repeatable.
function takeFromBag(s: State, rand: () => number): number {
  if (!s.bag.length) {
    s.bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = 6; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]]; }
  }
  return s.bag.shift()!;
}

export function newGame(rand: () => number = Math.random): State {
  const s: State = { board: Array.from({ length: H }, () => Array(W).fill(0)), piece: null, bag: [], next: 0,
    score: 0, lines: 0, level: 1, over: false };
  s.next = takeFromBag(s, rand);
  spawn(s, rand);
  return s;
}

// The next piece comes in at the top middle. If it doesn't fit, the game is over.
export function spawn(s: State, rand: () => number = Math.random) {
  const t = s.next;
  s.next = takeFromBag(s, rand);
  const p: Piece = { t, r: 0, x: t === 1 ? 4 : 3, y: t === 0 ? -1 : 0 };
  if (!fits(s.board, p)) { s.over = true; s.piece = null; return; }
  s.piece = p;
}

export function move(s: State, dx: number, dy = 0): boolean {
  if (!s.piece) return false;
  const p = { ...s.piece, x: s.piece.x + dx, y: s.piece.y + dy };
  if (!fits(s.board, p)) return false;
  s.piece = p;
  return true;
}

// Turn a quarter (dir 1 = clockwise, -1 = anticlockwise), trying the wall kicks in order.
export function rotate(s: State, dir = 1): boolean {
  if (!s.piece || s.piece.t === 1) return false; // the square looks the same every way
  const from = s.piece.r, to = (from + dir + 4) % 4;
  for (const [dx, dy] of (s.piece.t === 0 ? I_KICKS : KICKS)[`${from}>${to}`]) {
    const p = { ...s.piece, r: to, x: s.piece.x + dx, y: s.piece.y + dy };
    if (fits(s.board, p)) { s.piece = p; return true; }
  }
  return false;
}

export const grounded = (s: State) => !!s.piece && !fits(s.board, { ...s.piece, y: s.piece.y + 1 });

// Where the piece would land (the faint outline).
export function ghost(s: State): Piece | null {
  if (!s.piece) return null;
  let p = s.piece;
  while (fits(s.board, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
  return p;
}

export const LINE_POINTS = [0, 100, 300, 500, 800];
export const levelFor = (lines: number) => 1 + Math.floor(lines / 10);
// Milliseconds per row of fall: quicker each level, never faster than 70.
export const gravityMs = (level: number) => Math.max(70, Math.round(800 * 0.85 ** (level - 1)));

export type LockResult = { rows: number[]; points: number; levelUp: boolean };

// The piece stops: it joins the board, full rows clear (and score), and the next piece comes in.
export function lock(s: State, rand: () => number = Math.random): LockResult {
  const res: LockResult = { rows: [], points: 0, levelUp: false };
  if (!s.piece) return res;
  for (const [x, y] of cellsOf(s.piece)) if (y >= 0) s.board[y][x] = s.piece.t + 1;
  const above = cellsOf(s.piece).some(([, y]) => y < 0); // locked partly above the well: game over
  res.rows = s.board.map((row, y) => (row.every(Boolean) ? y : -1)).filter((y) => y >= 0);
  if (res.rows.length) {
    s.board = [...res.rows.map(() => Array(W).fill(0)), ...s.board.filter((_, y) => !res.rows.includes(y))];
    res.points = LINE_POINTS[res.rows.length] * s.level;
    s.score += res.points;
    s.lines += res.rows.length;
    const level = levelFor(s.lines);
    res.levelUp = level > s.level;
    s.level = level;
  }
  s.piece = null;
  if (above && !res.rows.length) { s.over = true; return res; }
  spawn(s, rand);
  return res;
}

// One row down by the player: 1 point.
export function softDrop(s: State): boolean {
  if (!move(s, 0, 1)) return false;
  s.score += 1;
  return true;
}

// Straight to the bottom: 2 points a row, then it locks.
export function hardDrop(s: State, rand: () => number = Math.random): LockResult & { dropped: number } {
  let dropped = 0;
  while (move(s, 0, 1)) dropped++;
  s.score += dropped * 2;
  return { ...lock(s, rand), dropped };
}
