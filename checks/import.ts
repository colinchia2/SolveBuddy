// Import tab checks (Colin, 10/22): the list's day groups, the size → stars rule, which imports are valid, and the
// hand builder's verdicts on a known 6×6 board. Run: node checks/import.ts
import { readFileSync } from "node:fs";
import { countAnswers } from "../engine/starbattle/countAnswers.ts";
import { countSolutions } from "../engine/sudoku/countSolutions.ts";
import { solve } from "../engine/watersort/solve.ts";
import { allImports, answerVerdict, boardProblem, dayLabel, groupByDay, markClashes, maxStars, sudokuClashes, sudokuWrong, validImport,
  waterProblem } from "../web/importdata.js";

let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };

// Days: fixed "now" = Oct 22 2026, 10:00 local.
const now = new Date(2026, 9, 22, 10, 0).getTime();
const at = (d: number, h = 9) => new Date(2026, 9, d, h, 0).getTime();
check("day labels: Today, Yesterday, then a date", dayLabel(at(22, 1), now) === "Today" && dayLabel(at(21, 23), now) === "Yesterday"
  && dayLabel(at(18), now) === "Oct 18" && dayLabel(new Date(2025, 11, 31).getTime(), now) === "Dec 31, 2025");
const items = [{ at: at(22, 9) }, { at: at(18) }, { at: at(22, 8) }, { at: at(21) }];
const newest = groupByDay(items, true, now), oldest = groupByDay(items, false, now);
check("grouped by day added, newest first (and newest first inside a day)",
  newest.map((g) => g.day).join() === "Today,Yesterday,Oct 18" && newest[0].items[0].at === at(22, 9));
check("oldest first flips both", oldest.map((g) => g.day).join() === "Oct 18,Yesterday,Today" && oldest[2].items[0].at === at(22, 8));

check("stars per size: 1 up to 7×7, 2 on 8–9, 3 from 10", [5, 7, 8, 9, 10, 12].map(maxStars).join() === "1,1,2,2,3,3");

// A known 6×6, 1-star board with one answer.
const regions = ["AAACBB", "CCCCDB", "EECCDB", "EEEFDD", "FEFFFD", "FFFFFD"];
const answer = [[0], [5], [2], [4], [1], [3]];
const found: number[][][] = [];
check("a good 6×6 has exactly one answer, the right one", countAnswers(regions, 1, 2, found) === 1 && JSON.stringify(found[0]) === JSON.stringify(answer));
const good = { id: "imp-1", game: "starbattle", size: 6, stars: 1, regions, marks: {}, solution: answer, addedAt: at(22), source: "hand" };
check("a well-formed import is valid", validImport(good));
check("bad imports are rejected (size, stars, region count, wrong game)", !validImport({ ...good, size: 13 }) && !validImport({ ...good, stars: 2 })
  && !validImport({ ...good, regions: regions.map((r) => r.replace(/F/g, "E")) }) && !validImport({ ...good, game: "sudoku" }));
const merged = allImports([{ ...good, id: "c-1", addedAt: "2026-10-21T15:00:00Z", source: undefined }, { id: "broken" }], [good]);
check("Claude's imports merge with yours; broken ones are left out; ISO dates read", merged.length === 2
  && merged.find((x) => x.id === "c-1")?.source === "claude" && merged.every((x) => x.at > 0));

// The builder's verdicts.
const blank = regions.map((r) => [...r]);
blank[2][3] = "";
check("unpainted cells: 'Paint every cell'", boardProblem(blank, 6)?.title === "Paint every cell");
check("too few regions is caught before counting", boardProblem(regions.map((r) => [...r.replace(/F/g, "E")]), 6)?.kind === "bad");
check("a full board with 6 regions goes on to the answer count", boardProblem(regions.map((r) => [...r]), 6) === null);
check("answer verdicts: none / many / one", answerVerdict(0).kind === "bad" && answerVerdict(2).title === "More than one answer" && answerVerdict(1).kind === "good");
check("starting marks that clash with the answer are found", markClashes({ "0,0": 2, "1,5": 1, "2,2": 2, "3,0": 1 }, answer).map((p) => p.join()).join("|") === "1,5");

// Sudoku imports (10/22): shape, clashes, the answer from the printed numbers, your wrong numbers.
const sp = JSON.parse(readFileSync("packs/sudoku9-medium.json", "utf8")).puzzles[0];
const sfound: number[][][] = [];
check("a real Medium's printed numbers have one answer, the pack's", countSolutions(sp.givens, 2, sfound) === 1
  && JSON.stringify(sfound[0]) === JSON.stringify(sp.solution));
const firstOpen = (() => { for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!sp.givens[r][c]) return [r, c]; return [0, 0]; })();
const rightKey = `${firstOpen[0]},${firstOpen[1]}`, right = sp.solution[firstOpen[0]][firstOpen[1]];
const sud = { id: "imp-s", game: "sudoku", size: 9, givens: sp.givens, entries: { [rightKey]: right }, solution: sp.solution, addedAt: at(22), source: "hand" };
check("a well-formed Sudoku import is valid", validImport(sud));
check("bad Sudoku imports are rejected (size, short grid, a 10, a bad key)", !validImport({ ...sud, size: 8 }) && !validImport({ ...sud, givens: sp.givens.slice(1) })
  && !validImport({ ...sud, solution: sp.solution.map((r: number[], i: number) => (i ? r : [10, ...r.slice(1)])) }) && !validImport({ ...sud, entries: { "9,0": 1 } }));
const clashBoard = sp.givens.map((r: number[]) => [...r]);
const [r0, c0] = firstOpen;
const dupe = clashBoard[r0].find((v: number) => v) ?? 1; // a number already in that row
clashBoard[r0][c0] = dupe;
check("same number twice in a row is flagged on both cells", sudokuClashes(clashBoard).includes(rightKey) && sudokuClashes(sp.givens).length === 0);
check("your numbers that disagree with the answer are found", sudokuWrong({ [rightKey]: right % 9 + 1 }, sp.solution).join() === rightKey
  && sudokuWrong({ [rightKey]: right }, sp.solution).length === 0);

// Water Sort imports: each colour exactly 4, room to move, and a real level solves.
const wp = JSON.parse(readFileSync("packs/watersort-easy.json", "utf8")).puzzles[0];
const wat = { id: "imp-w", game: "watersort", tubes: wp.tubes, colors: wp.colors, addedAt: at(22), source: "hand" };
check("a real Easy level is a valid Water Sort import and solvable", validImport(wat) && waterProblem(wp.tubes) === null && solve(wp.tubes, 40000).kind === "solved");
const short = wp.tubes.map((t: string[]) => [...t]); short[0].pop();
check("a colour with only 3 units is caught (and named)", waterProblem(short)?.title === "Each colour needs exactly 4" && /has 3/.test(waterProblem(short)!.text) && !validImport({ ...wat, tubes: short }));
check("no colours yet: 'Fill the tubes'; all tubes full: no room", waterProblem([[], [], [], []])?.kind === "wait"
  && waterProblem([["A", "A", "A", "A"], ["B", "B", "B", "B"], ["C", "C", "C", "C"], ["D", "D", "D", "D"]])?.title === "Leave some room");
check("too few or too many tubes, or a strange colour, are rejected", !validImport({ ...wat, tubes: wp.tubes.slice(0, 3) })
  && !validImport({ ...wat, tubes: [...wp.tubes, ...Array(13).fill([])] }) && !validImport({ ...wat, tubes: [["Z", "Z", "Z", "Z"], [], [], []] }));

check("the bundled imports file is there and valid JSON", Array.isArray(JSON.parse(readFileSync("packs/imports.json", "utf8")).puzzles));

if (failed) process.exit(1);
