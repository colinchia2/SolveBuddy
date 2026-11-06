// Star Battle route hints (Colin 11/6): play every pack by hints. Every star is right, nothing true gets crossed out, the
// wording follows his rules, and the numbers show how often a star takes one hint.
import { readFileSync } from "node:fs";
import { isAnswer, withStars } from "../engine/starbattle/layout.ts";
import { LIMIT, starHint } from "../engine/starbattle/route.ts";
import { CROSS, STAR, ruledOutBy } from "../engine/starbattle/techniques.ts";

let bad = 0;
const fail = (id: string, why: string, x: unknown) => { if (bad++ < 10) console.log(`FAIL  ${id}: ${why}  ${JSON.stringify(x).slice(0, 300)}`); };
for (const f of ["starbattle8-easy-starter", "starbattle8-expert", "starbattle10-double-expert", "starbattle12-triple-expert"]) {
  const pack = JSON.parse(readFileSync(`packs/${f}.json`, "utf8"));
  const runs: number[] = [], sizes: number[] = [];
  let long = 0, none = 0, slowest = 0;
  for (const p of pack.puzzles) {
    const K = f.includes("double") ? 2 : f.includes("triple") ? 3 : 1, R = withStars(p.regions, K), n = R.length, want = n * K;
    const b = R.map(() => Array(n).fill(0));
    const stars = () => b.flat().filter((v: number) => v === STAR).length;
    let run = 0, guard = 0;
    while (stars() < want && guard++ < 500) {
      const t0 = Date.now();
      const h = starHint(b, R, p.solution);
      slowest = Math.max(slowest, Date.now() - t0);
      if (h.kind !== "step" || !h.walk) { fail(p.id, `no walkthrough (${h.kind})`, h.nudge); break; }
      run++;
      sizes.push(h.walk.length);
      if (h.long) { long++; if (!h.long.steps) none++; }
      if (h.walk.length > LIMIT && !h.long) fail(p.id, "long with no warning", h.walk.length);
      if (h.give && !isAnswer(p.solution, h.give[0], h.give[1])) fail(p.id, "offered a wrong star", h.give);
      if (h.star && !isAnswer(p.solution, h.star[0], h.star[1])) fail(p.id, "wrong star", h.star);
      for (const [r, c] of h.cross) if (isAnswer(p.solution, r, c)) fail(p.id, "crossed out a star", [r, c]);
      const text = h.walk.map((s) => `${s.title} ${s.body ?? ""}`).join(" | ");
      if (/R\d+C\d+/.test(text) || /\bcells?\b/.test(text) || /undefined/.test(text)) fail(p.id, "wording", text);
      if (!/^(Look at|Try|Imagine)/.test(h.walk[0].title)) fail(p.id, "doesn't start by pointing somewhere", h.walk[0]);
      if (h.star) {
        b[h.star[0]][h.star[1]] = STAR;
        for (const [r, c] of ruledOutBy(R, h.star, b)) if (!b[r][c]) b[r][c] = CROSS;
        runs.push(run);
        run = 0;
      }
      for (const [r, c] of h.cross) if (!b[r][c]) b[r][c] = CROSS;
    }
    if (stars() < want) fail(p.id, "not solved", stars());
  }
  const avg = (runs.reduce((a, x) => a + x, 0) / runs.length).toFixed(2), one = Math.round(100 * runs.filter((x) => x === 1).length / runs.length);
  const asks = Math.round(100 * long / sizes.length);
  console.log(`${f}: ${avg} hints a star, ${one}% in one hint, most ${Math.max(...runs)}; ${asks}% of hints ask first (${none} with no short route); longest shown ${Math.max(...sizes)} steps; slowest ${slowest}ms`);
}
console.log(bad ? `FAIL  ${bad} problems` : "PASS  every pack solved by route hints");
process.exit(bad ? 1 : 0);
