// Writes the three Nonogram packs (Colin 10/23): 5×5 Easy, 10×10 Medium, 15×15 Hard, 5 each. Every puzzle is a real
// picture with a name and a colour (the finish says "A heart!" and shows it in its colour). Each must have exactly one
// answer and be solvable one row or column at a time (checked here and again by checks/nonogram.ts).
// Run: node scripts/nonogram_make_packs.ts   (overwrites packs/nonogram*.json)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cluesOf } from "../engine/nonogram/line.ts";
import { countSolutions, logicSolves } from "../engine/nonogram/solve.ts";

type Pic = { name: string; say: string; color: string; rows: string[] };
const PACKS: { file: string; id: string; size: number; difficulty: string; pics: Pic[] }[] = [
  { file: "nonogram5-easy.json", id: "nonogram5-easy", size: 5, difficulty: "Easy", pics: [
    { name: "Heart", say: "A heart!", color: "#C24E2A", rows: [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."] },
    { name: "Tree", say: "A tree!", color: "#2F7A4A", rows: ["..X..", ".XXX.", "XXXXX", "..X..", ".XXX."] },
    { name: "House", say: "A house!", color: "#A8552E", rows: ["..X..", ".XXX.", "XXXXX", ".XXX.", ".X.X."] },
    { name: "Boat", say: "A boat!", color: "#2F6FD6", rows: ["..X..", "..XX.", "..X..", "XXXXX", ".XXX."] },
    { name: "Cat", say: "A cat!", color: "#6A45B0", rows: ["X...X", "XXXXX", "X.X.X", "XXXXX", ".XXX."] },
  ] },
  { file: "nonogram10-medium.json", id: "nonogram10-medium", size: 10, difficulty: "Medium", pics: [
    { name: "Fish", say: "A fish!", color: "#E07A1F", rows: ["....XXX...", "..XXXXXX..", ".XXXXXXXX.", "XX.XXXXXX.", "XXXXXXXXXX", ".XXXXXXX.X", "..XXXXXX.X", "...XXXX..X", "....XX....", "...XX....."] },
    { name: "Mushroom", say: "A mushroom!", color: "#C0392B", rows: ["...XXXX...", ".XX.XXXXX.", "XX...XX.XX", "XXX.XXXXXX", "XXXXXXXXXX", "...XXXX...", "...XXXX...", "...XXXX...", "..XXXXXX..", ".........."] },
    { name: "Umbrella", say: "An umbrella!", color: "#1F6F73", rows: ["....XX....", "..XXXXXX..", ".XXXXXXXX.", "XXXXXXXXXX", "X.X.XX.X.X", "....XX....", "....XX....", "....XX....", ".XX.XX....", "..XXX....."] },
    { name: "Apple", say: "An apple!", color: "#4A8C2A", rows: [".....XX...", "....X.....", ".XXX.XXXX.", "XX.XXXXXXX", "XXXXXXXXXX", "XXXXXXXXXX", "XXXXXXXXXX", ".XXXXXXXX.", ".XXXXXXXX.", "..XX..XX.."] },
    { name: "Rocket", say: "A rocket!", color: "#3D4C8F", rows: ["....XX....", "...XXXX...", "...XXXX...", "...X..X...", "...X..X...", "...XXXX...", "..XXXXXX..", ".XXXXXXXX.", ".XX.XX.XX.", "....XX...."] },
  ] },
  { file: "nonogram15-hard.json", id: "nonogram15-hard", size: 15, difficulty: "Hard", pics: [
    { name: "Sailboat", say: "A sailboat!", color: "#1F57B5", rows: ["........X......", ".......XX......", "......XXX.X....", ".....XXXX.XX...", "....XXXXX.XXX..", "...XXXXXX.XXXX.", "..XXXXXXX.XXXXX", "........X......", "XXXXXXXXXXXXXXX", ".XXXXXXXXXXXXX.", "..XXXXXXXXXXX..", ".XX...XX...XX..", "X..XX..XX..XX.X", ".XX..XX..XX..XX", "XXXXXXXXXXXXXXX"] },
    { name: "Teacup", say: "A teacup!", color: "#8C5F00", rows: ["....X..X..X....", "...X..X..X.....", "....X..X..X....", "...............", ".XXXXXXXXXXX...", ".XXXXXXXXXXXXX.", ".XXXXXXXXXXX.XX", ".XXXXXXXXXXX..X", "..XXXXXXXXX..XX", "..XXXXXXXXXXXX.", "...XXXXXXXX....", "....XXXXXX.....", "...............", "XXXXXXXXXXXXXX.", ".XXXXXXXXXXXX.."] },
    { name: "Butterfly", say: "A butterfly!", color: "#B23A86", rows: ["......X.X......", "XXX...X.X...XXX", "XXXXX..X..XXXXX", "XXXXXX.X.XXXXXX", "XX..XXXXXXX..XX", "XX..XXXXXXX..XX", "XXXXXX.X.XXXXXX", ".XXXXX.X.XXXXX.", "...XXX.X.XXX...", "..XXXX.X.XXXX..", ".XXXXX.X.XXXXX.", ".XX.XX.X.XX.XX.", ".XXXX..X..XXXX.", "..XX...X...XX..", "..............."] },
    { name: "Snail", say: "A snail!", color: "#9C6B2E", rows: ["...............", "...........X.X.", "...........X.X.", "...XXXXX...X.X.", "..XX...XX..X.X.", ".XX.XXX.XX.XXX.", ".X.XX..X.X.XXXX", ".X.X.X.X.X.XXXX", ".X.X..XX.X.XXX.", ".XX.XX..XX.XX..", "..XX...XX..XX..", "...XXXXX...XX..", "XXXXXXXXXXXXX..", ".XXXXXXXXXXXX..", "..............."] },
    { name: "Whale", say: "A whale!", color: "#2F4A8A", rows: ["....X.X........", ".....X.........", "...XXXXXX......", "..XXXXXXXXX.X.X", ".XXXXXXXXXXX.XX", ".X.XXXXXXXXXXX.", "XXXXXXXXXXXXXX.", "XXXXXXXXXXXXX..", "X..XXXXXXXXXX..", ".XX..XXXXXXX...", "..XXX.XXXXX....", "....XXXX.......", "...............", ".XXX..XXXX..XXX", "XXXXXXXXXXXXXXX"] },
  ] },
];

for (const pk of PACKS) {
  const puzzles = pk.pics.map((pic, i) => {
    if (pic.rows.length !== pk.size || pic.rows.some((r) => r.length !== pk.size)) throw new Error(`${pic.name}: not ${pk.size}×${pk.size}`);
    const { rows, cols } = cluesOf(pic.rows);
    if (countSolutions(rows, cols) !== 1) throw new Error(`${pic.name}: not exactly one answer`);
    if (!logicSolves(rows, cols, pic.rows)) throw new Error(`${pic.name}: not solvable one line at a time`);
    return { id: `${pk.id}-${i + 1}`, name: pic.name, say: pic.say, color: pic.color, rows, cols, solution: pic.rows };
  });
  writeFileSync(join(import.meta.dirname, "..", "packs", pk.file),
    JSON.stringify({ id: pk.id, game: "nonogram", size: pk.size, difficulty: pk.difficulty, puzzles }, null, 1) + "\n");
  console.log(`${pk.file}: ${puzzles.map((p) => p.name).join(", ")}`);
}
