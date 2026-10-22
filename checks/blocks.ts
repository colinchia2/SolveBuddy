// Block Drop checks (free, repeatable): pieces, turning with wall kicks, line clears and scoring, the bag, game over.
// Run: node checks/blocks.ts
import { W, H, cellsOf, fits, newGame, move, rotate, hardDrop, softDrop, lock, ghost, gravityMs, holdPiece, type State } from "../engine/blocks/game.ts";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}
// A repeatable "random": the same numbers every run.
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const empty = () => Array.from({ length: H }, () => Array(W).fill(0));
const withPiece = (t: number, extra: Partial<State> = {}): State =>
  ({ board: empty(), piece: { t, r: 0, x: 3, y: 0 }, bag: [], next: 2, hold: null, canHold: true, score: 0, lines: 0, level: 1, over: false, ...extra });

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

// Ghost (Colin 10/22 saw it wrong): on an uneven stack it sits right on top of the highest block under the piece.
{
  const board = empty();
  board[19][7] = 7; board[19][8] = 7; board[19][9] = 7; board[18][9] = 7; // an L lying at the bottom right
  const s = withPiece(1, { board, piece: { t: 1, r: 0, x: 6, y: 2 } }); // O over columns 6–7
  const g = ghost(s)!, rows = [...new Set(cellsOf(g).map(([, y]) => y))].sort();
  check("ghost: O over an uneven stack lands on rows 17–18, touching nothing", rows.join() === "17,18" && fits(board, g));
  const i = withPiece(0, { board: empty(), piece: { t: 0, r: 1, x: 3, y: 0 } }); // upright I, empty well
  check("ghost: upright I on an empty well fills rows 16–19", cellsOf(ghost(i)!).map(([, y]) => y).sort((a, b) => a - b).join() === "16,17,18,19");
}

// Save piece: first save takes the next piece; one swap per piece; setting a piece allows the next swap.
{
  const rand = seeded(3), s = newGame(rand);
  const first = s.piece!.t, next = s.next;
  check("save: the first save keeps the piece and brings in the next one", holdPiece(s, rand) && s.hold === first && s.piece!.t === next);
  check("save: no second swap before the piece sets", !holdPiece(s, rand) && s.hold === first);
  hardDrop(s, rand);
  const now = s.piece!.t;
  check("save: after a piece sets, swapping brings the saved piece back at the top", holdPiece(s, rand) && s.piece!.t === first && s.hold === now && s.piece!.r === 0);
}

// The page's touch handling can never get stuck (Colin 10/22: after ~10 turns the controls stopped answering).
// Read the page: a new touch replaces an unfinished one, every way a touch ends is handled, and no text is selectable.
{
  const { readFileSync } = await import("node:fs");
  const js = readFileSync("web/blocks.js", "utf8"), html = readFileSync("web/blocks.html", "utf8");
  const down = js.slice(js.indexOf('pad.addEventListener("pointerdown"'), js.indexOf('addEventListener("pointermove"'));
  check("touch: a new touch never waits on an old one (no early return on an unfinished drag)", !/\|\|\s*drag\)\s*return/.test(down) && down.includes("endDrag()"));
  check("touch: lift and cancel are heard on the whole window, plus lost capture and leaving the app",
    ['addEventListener("pointerup"', 'addEventListener("pointercancel"', '"lostpointercapture"', 'addEventListener("blur"'].every((s) => js.includes(s))
    && /pointerup", safe\(/.test(js));
  check("no selectable text, no Copy / Look Up menu", /user-select: none/.test(html) && /-webkit-touch-callout: none/.test(html)
    && js.includes('"selectstart"') && js.includes('"contextmenu"'));
  check("no buttons under the well; Save sits last (bottom right)", !html.includes('class="dock"') && html.indexOf('id="best"') < html.indexOf('id="saveBtn"'));
}

// Scoring is the modern guideline (Colin, 10/22: "make sure the points are right"): 100/300/500/800 × level for 1–4 rows,
// +1 a row for a soft drop and +2 a row for a hard drop, so dropping faster scores more. No T-spins or combos.
{
  const { LINE_POINTS } = await import("../engine/blocks/game.ts");
  check("line points 100 / 300 / 500 / 800", JSON.stringify(LINE_POINTS) === "[0,100,300,500,800]");
  const a = withPiece(1), b = withPiece(1);
  const soft = (() => { let n = 0; while (softDrop(a)) n++; return a.score; })();
  hardDrop(b, seeded());
  check(`a hard drop scores twice a soft drop over the same rows (${b.score} vs ${soft})`, b.score === soft * 2 && soft > 0);
  const c = withPiece(0, { level: 3 });
  for (let x = 0; x < W; x++) c.board[H - 1][x] = x === 3 || x === 4 || x === 5 || x === 6 ? 0 : 1; // a 4-wide gap
  c.piece = { t: 0, r: 0, x: 3, y: 0 };
  const res = hardDrop(c, seeded());
  check("points scale with the level (1 row at level 3 = 300)", res.points === 300);
  const { readFileSync } = await import("node:fs");
  const js = readFileSync("web/blocks.js", "utf8"), html = readFileSync("web/blocks.html", "utf8");
  check("swipe up saves the piece; a quick flick down drops it", /doHold\(\); \/\/ swipe up = Save/.test(js) && /doDrop\(\); \/\/ quick flick down/.test(js)
    && /Swipe up<\/strong> \(or tap Save\)/.test(html));
  check("scores shrink to fit their card", js.includes("function fit(") && /fit\(\$\("score"\)/.test(js));
}

console.log(failed ? `${failed} FAILED` : "all ok");
process.exitCode = failed ? 1 : 0;
