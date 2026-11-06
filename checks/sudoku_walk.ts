// Hint walkthroughs (Colin 11/5): play every Sudoku pack by hints and hold each walkthrough to his rules. It ends on the
// right number, ruled-out squares really can't hold it, it stands alone, and it uses plain words.
import { readFileSync } from "node:fs";
import { playHints } from "../engine/sudoku/hint.ts";
import { rulesOf } from "../engine/sudoku/variants.ts";

let bad = 0, walks = 0, cells = 0, longest = 0, maxRows = 0;
const fail = (id: string, why: string, w: unknown) => { if (bad++ < 12) console.log(`FAIL  ${id}: ${why}\n   ${JSON.stringify(w).slice(0, 320)}`); };
const tally: Record<string, [number, number]> = {};
for (const f of ["easy-starter", "medium", "hard", "expert", "tricks", "killer-easy", "killer-expert", "thermo-easy", "thermo-expert"].map((n) => `sudoku9-${n}.json`)) {
  for (const p of JSON.parse(readFileSync(`packs/${f}`, "utf8")).puzzles) {
    const play = playHints(p.givens, p.solution, 400, rulesOf(p));
    if (!play.solved) fail(p.id, "hints didn't finish it", {});
    for (const h of play.shown) {
      const t = (tally[h.technique] ??= [0, 0]);
      t[0]++;
      if (!h.walk) continue;
      t[1]++;
      walks++;
      const last = h.walk[h.walk.length - 1];
      longest = Math.max(longest, h.walk.length);
      if (last.spot?.join() !== h.target?.join() || !last.title.includes(String(h.value))) fail(p.id, "doesn't end on the answer", last);
      if (p.solution[h.target![0]][h.target![1]] !== h.value) fail(p.id, "wrong number", last);
      if (!/^Look at /.test(h.walk[0].title)) fail(p.id, "doesn't start by pointing somewhere", h.walk[0]);
      for (const s of h.walk) {
        const text = [s.title, s.body ?? "", ...(s.rows ?? []).flatMap((r) => [r.label, r.why])].join(" | ");
        if (/R\dC\d/.test(text) || /\d \+ \d/.test(text) || / − /.test(text) || /\ba 8\b/.test(text) || /undefined|NaN/.test(text)) fail(p.id, "wording", text);
        if (/last time|last hint|earlier|again/i.test(text)) fail(p.id, "leans on another hint", text);
        maxRows = Math.max(maxRows, s.rows?.length ?? 0);
        for (const [r, c] of s.no ?? []) {
          cells++;
          if (/squeeze|Only spot/.test(h.technique) && p.solution[r][c] === h.value) fail(p.id, "ruled out the answer's square", s);
        }
      }
    }
  }
}
console.log(`${bad ? "FAIL" : "PASS"}  ${walks} walkthroughs, up to ${longest} steps and ${maxRows} reasons in a step, ${cells} ruled-out squares, ${bad} problems`);
console.log(Object.entries(tally).map(([k, [n, w]]) => `${k} ${w}/${n}`).join(" · "));
process.exit(bad ? 1 : 0);
