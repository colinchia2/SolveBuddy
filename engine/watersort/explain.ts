// Why a hint's pour helps (Colin, 10/22: "say why, a step or two, not just the move"). It looks up to 3 moves ahead in
// the solver's plan and names what this pour sets up: the colour it frees, a tube it finishes or empties, and where
// that leads next. Never the whole solution.
import { type Move, type State, CAP, isDone, pour, top } from "./rules.ts";

export type Why = {
  nudge: string; // Nudge: a short pointer at the tube to pour from
  title: string; // Explain: the move…
  body: string; // …and what it sets up (at most 2 follow-ups)
  after: string; // Show me, once poured: what to do now
  // Explain as a short numbered chain (Colin 10/27, S15): this pour, the colour it frees, and the move that uses it.
  // Each step names the tubes it touches, so the page can outline them when its chip is picked.
  chain: { text: string; color: string; tubes: number[] }[];
};

const fullOf = (t: string[]) => t.length === CAP && isDone(t);
const an = (w: string) => (/^[aeiou]/.test(w) ? `an ${w}` : `a ${w}`);

// plan = the solver's moves from s (plan[0] is the hint's pour). name = colour letter → word ("red").
export function explain(s: State, plan: Move[], name: (c: string) => string): Why {
  const [a, b] = plan[0];
  const A = a + 1, B = b + 1;
  const c = top(s[a]);
  const s1 = pour(s, a, b);
  const finishes = fullOf(s1[b]);
  const revealed = s1[a].length && top(s1[a]) !== c ? top(s1[a]) : null;
  const emptied = s1[a].length === 0;

  // The next move in the plan that uses what this pour opened up: the freed colour leaving tube a, more of that colour
  // poured onto it, or a colour coming into the now-empty tube a.
  let next = "";
  let nextStep: { text: string; color: string; tubes: number[] } | null = null;
  let soon = false; // the follow-up isn't the very next move (another pour comes first)
  let st = s1;
  for (const [i, [x, y]] of plan.slice(1, 4).entries()) {
    const after = pour(st, x, y);
    soon = i > 0;
    if (revealed && x === a) {
      const where = st[y].length ? `onto the ${name(revealed)} in tube ${y + 1}` : `into the empty tube ${y + 1}`;
      next = `that ${name(revealed)} can go ${where}${fullOf(after[y]) ? ", which finishes that tube" : ""}`;
      nextStep = { text: `${name(revealed)} → tube ${y + 1}${fullOf(after[y]) ? " (done!)" : ""}`, color: revealed, tubes: [x, y] };
      break;
    }
    if (revealed && y === a) {
      next = `the ${name(revealed)} from tube ${x + 1} can go onto the ${name(revealed)} in tube ${A}${fullOf(after[y]) ? ", which finishes that tube" : ""}`;
      nextStep = { text: `${name(revealed)} from tube ${x + 1} joins it${fullOf(after[y]) ? " (done!)" : ""}`, color: revealed, tubes: [x, y] };
      break;
    }
    if (emptied && y === a) {
      next = `tube ${A} can take the ${name(top(st[x]))} from tube ${x + 1}`;
      nextStep = { text: `${name(top(st[x]))} → the empty tube ${A}`, color: top(st[x]), tubes: [x, y] };
      break;
    }
    st = after;
  }

  const what = finishes ? `That finishes the ${name(c)} tube`
    : s[b].length ? `That puts the ${name(c)}s together`
    : `That moves the ${name(c)} out of the way`;
  const opens = revealed ? ` and frees the ${name(revealed)} under it` : emptied ? ` and empties tube ${A}, so you have a spare tube` : "";
  const body = `${what}${opens}.${next ? ` ${soon ? "Soon" : "Then"} ${next}.` : ""}`;

  const nudge = finishes ? `Its ${name(c)} can finish a tube.`
    : revealed ? `Its ${name(c)} on top is hiding ${an(name(revealed))}${next ? (soon ? " you'll need" : " you need next") : ""}.`
    : emptied ? `It's nearly empty, and a spare tube helps.`
    : s[b].length ? `Its ${name(c)} can join the other ${name(c)}.`
    : `Its ${name(c)} is in the way.`;

  const chain = [{ text: `${name(c)} → tube ${B}${finishes ? " (done!)" : ""}`, color: c, tubes: [a, b] }];
  if (revealed) chain.push({ text: `${name(revealed)} is on top`, color: revealed, tubes: [a] });
  else if (emptied) chain.push({ text: `tube ${A} is empty`, color: "", tubes: [a] });
  if (nextStep) chain.push(nextStep);
  return {
    chain,
    nudge,
    title: `Pour tube ${A} into tube ${B}.`,
    body,
    after: next && !soon ? `Now ${next}.` : "",
  };
}
