// Import tab checks (Colin, 10/22): the list's day groups, the size → stars rule, which imports are valid, and the
// hand builder's verdicts on a known 6×6 board. Run: node checks/import.ts
import { readFileSync } from "node:fs";
import { countAnswers } from "../engine/starbattle/countAnswers.ts";
import { allImports, answerVerdict, boardProblem, dayLabel, groupByDay, markClashes, maxStars, validImport } from "../web/importdata.js";

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

check("the bundled imports file is there and valid JSON", Array.isArray(JSON.parse(readFileSync("packs/imports.json", "utf8")).puzzles));

if (failed) process.exit(1);
