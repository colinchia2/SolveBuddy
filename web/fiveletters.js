// Five Letters play page (Colin 11/6): six tries, fun letters. Rules in engine/fiveletters/game.ts.
// Numbered words (Colin 11/10, docs/design/fiveletters_all_words_mockup.html): answers are in play order (word #n =
// answers[n - 1]); you play them in order, and "All words" lists every number with how it went. A finished word opens
// read-only; "Play it again" replays it without changing your record. Saved under WORDS_KEY: results { n: { won, g } }.
import { LEN, TRIES, hintSpot, keyMarks, score } from "../engine/fiveletters/game.ts";
import { goHome, haptic, hapticLevel, loadPack } from "./bridge.js";
import { celebrate, openWipe } from "./celebrate.js";

const WORDS_KEY = "solvebuddy.fiveletters";
const words = await loadPack("fiveletters-words.json");
const allowed = new Set(words.guesses);
const $ = (id) => document.getElementById(id);
const read = () => { try { return JSON.parse(localStorage.getItem(WORDS_KEY) || "{}"); } catch { return {}; } };
const store = (patch) => { try { localStorage.setItem(WORDS_KEY, JSON.stringify({ ...read(), ...patch })); } catch {} };
const TOTAL = words.answers.length;
const results = () => read().results ?? {};
// The next word to play: the first unplayed number after `from`, wrapping round to the start.
const nextFree = (from = 0) => { const r = results(); for (let i = 1; i <= TOTAL; i++) { const n = ((from + i - 1) % TOTAL) + 1; if (!r[n]) return n; } return 1; };

let s, busy = false, hint = null;
function fresh(n = nextFree(s?.n ?? 0), replay = false) {
  s = { n, answer: words.answers[n - 1], guesses: [], cur: "", shown: [], done: false, started: Date.now(), replay };
  store({ saved: s });
  hint = null;
  say("");
  render();
}
const say = (t) => { $("say").textContent = t; };
function render(flipRow = -1, winRow = -1) {
  const cells = [];
  for (let r = 0; r < TRIES; r++) {
    const g = s.guesses[r], live = r === s.guesses.length && !s.done;
    const marks = g ? score(g, s.answer) : [];
    for (let i = 0; i < LEN; i++) {
      const ch = g?.[i] ?? (live ? s.cur[i] : "") ?? "";
      const tip = live && !ch && s.shown.includes(i) ? s.answer[i] : "";
      const cls = ["ft", marks[i] ?? "", !g && ch ? "full" : "", tip ? "ghost" : "", r === flipRow ? "flip" : "", r === winRow ? "win" : ""].join(" ");
      cells.push(`<div class="${cls}" data-r="${r}" style="--d:${(i * (r === winRow ? 0.09 : 0.14)).toFixed(2)}s">${(ch || tip || "").toUpperCase()}</div>`);
    }
  }
  $("grid").innerHTML = cells.join("");
  const keys = keyMarks(s.guesses, s.answer);
  const key = (l) => `<button class="k ${flipRow >= 0 ? "" : keys[l] ?? ""}" data-k="${l}">${l.toUpperCase()}</button>`;
  $("pad").innerHTML = ["qwertyuiop", "asdfghjkl"].map((r) => `<div class="kr">${[...r].map(key).join("")}</div>`).join("")
    + `<div class="kr"><button class="k wide" data-k="enter">Enter</button>${[..."zxcvbnm"].map(key).join("")}<button class="k wide" data-k="del" aria-label="Delete">Delete</button></div>`;
  const won = s.guesses.at(-1) === s.answer;
  $("sub").textContent = `#${s.n} · ${s.view ? (won ? `Solved in ${s.guesses.length}` : "Missed") : s.done ? "Finished" : `Try ${s.guesses.length + 1} of ${TRIES}`}${s.replay ? " · replay" : ""}`;
  $("pad").hidden = $("dock").hidden = !!s.view;
  $("viewBar").hidden = !s.view;
  $("hint").hidden = !hint;
  if (hint) {
    $("hintStep").textContent = `Step ${hint.step + 1} of 2`;
    $("hintTitle").textContent = hint.step ? `It's ${/[aefhilmnorsx]/.test(s.answer[hint.spot]) ? "an" : "a"} ${s.answer[hint.spot].toUpperCase()}` : `Look at letter ${hint.spot + 1}`;
    $("hintBody").textContent = hint.step ? "It stays faint in your row until you type it." : "This is the first letter you haven't found yet.";
    $("hintNextLabel").textContent = hint.step ? "Done" : "Show me";
  }
}
function press(k) {
  if (busy || s.done || hint || !$("words").hidden) return;
  if (k === "enter") return submit();
  if (k === "del") s.cur = s.cur.slice(0, -1);
  else if (s.cur.length < LEN) { s.cur += k; hapticLevel?.(1); }
  say("");
  store({ saved: s });
  render();
}
function shake(t) {
  say(t);
  haptic("warn");
  const row = [...document.querySelectorAll(`.ft[data-r="${s.guesses.length}"]`)];
  row.forEach((c) => { c.classList.remove("row-bad"); void c.offsetWidth; c.classList.add("row-bad"); });
}
function submit() {
  if (s.cur.length < LEN) return shake("Five letters, please");
  if (!allowed.has(s.cur)) return shake("That's not in the word list");
  const row = s.guesses.length;
  s.guesses.push(s.cur);
  s.cur = "";
  const won = s.guesses[row] === s.answer, lost = !won && s.guesses.length === TRIES;
  s.done = won || lost;
  busy = true;
  store({ saved: s.done ? null : s });
  render(row);
  [0, 1, 2, 3, 4].forEach((i) => setTimeout(() => haptic("tap"), i * 140 + 260));
  setTimeout(() => {
    busy = false;
    render();
    if (won) finish(row);
    if (lost) lose();
  }, 140 * LEN + 420);
}
function finish(row) {
  render(-1, row);
  haptic("success");
  const d = read(), n = (d.streak ?? 0) + 1;
  if (s.replay) store({ saved: null });
  else store({ played: (d.played ?? 0) + 1, won: (d.won ?? 0) + 1, streak: n, best: Math.max(d.best ?? 0, n), saved: null, results: { ...results(), [s.n]: { won: true, g: s.guesses } } });
  celebrate({ title: "Five Letters", level: `In ${s.guesses.length} ${s.guesses.length === 1 ? "try" : "tries"}`, facts: { ms: Date.now() - (s.started ?? Date.now()), hints: 0 }, hasNext: true, onNext: fresh, delay: 1100 });
}
function lose() {
  const d = read();
  if (s.replay) store({ saved: null });
  else store({ played: (d.played ?? 0) + 1, streak: 0, saved: null, results: { ...results(), [s.n]: { won: false, g: s.guesses } } });
  say(`The word was ${s.answer.toUpperCase()}`);
  haptic("warn");
}

$("pad").onclick = (e) => { const b = e.target.closest("[data-k]"); if (b) press(b.dataset.k); };
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey) return;
  if (e.key === "Enter") press("enter");
  else if (e.key === "Backspace") press("del");
  else if (/^[a-z]$/i.test(e.key)) press(e.key.toLowerCase());
});
$("hintBtn").onclick = () => {
  if (s.done || busy) return;
  if (hint) { hint = null; return render(); }
  const spot = hintSpot(s.guesses, s.answer, s.shown);
  if (spot < 0) return say("You've found every letter");
  haptic("pick");
  hint = { spot, step: 0 };
  render();
};
$("hintNext").onclick = () => {
  if (!hint) return;
  if (hint.step) { hint = null; store({ saved: s }); return render(); }
  hint.step = 1;
  s.shown.push(hint.spot);
  render();
};
$("hintClose").onclick = () => { hint = null; render(); };
$("newBtn").onclick = () => { haptic("pick"); if (!s.done && s.guesses.length && !s.replay) store({ streak: 0 }); fresh(); };

// All words: a sheet with a summary and every number (green = won, with tries; grey = missed; blue = this one).
function showWords() {
  const r = results(), ns = Object.keys(r), won = ns.filter((n) => r[n].won);
  const avg = won.length ? (won.reduce((t, n) => t + r[n].g.length, 0) / won.length).toFixed(1) : "–";
  $("wordsSum").innerHTML = [[ns.length, "played"], [won.length, "won"], [avg, "tries on average"]].map(([b, t]) => `<div><b>${b}</b><span>${t}</span></div>`).join("");
  const tiles = [];
  for (let n = 1; n <= TOTAL; n++) {
    const x = r[n], now = n === s.n && !s.view && !s.done;
    const cls = now ? "now" : x ? (x.won ? "won" : "lost") : "";
    const tag = now ? "PLAYING" : x ? (x.won ? `${x.g.length} ${x.g.length === 1 ? "TRY" : "TRIES"}` : "MISSED") : "&nbsp;";
    tiles.push(`<button class="w ${cls}" data-n="${n}"><b>${n}</b><small>${tag}</small></button>`);
  }
  $("wordsList").innerHTML = tiles.join("");
  $("words").hidden = false;
  requestAnimationFrame(() => $("wordsList").querySelector(".now, .w:not(.won):not(.lost)")?.scrollIntoView({ block: "center" }));
}
function openWord(n) {
  const x = results()[n];
  $("words").hidden = true;
  if (n === s.n && !s.done && !s.view) return render();
  if (x) { s = { n, answer: words.answers[n - 1], guesses: x.g, cur: "", shown: [], done: true, view: true }; hint = null; say(x.won ? "" : `The word was ${s.answer.toUpperCase()}`); render(); }
  else fresh(n);
}
$("wordsBtn").onclick = () => { haptic("pick"); hint = null; render(); showWords(); };
$("wordsList").onclick = (e) => { const b = e.target.closest("[data-n]"); if (b) { haptic("pick"); openWord(Number(b.dataset.n)); } };
$("wordsClose").onclick = () => { $("words").hidden = true; };
$("words").onclick = (e) => { if (e.target === $("words")) $("words").hidden = true; };
$("againBtn").onclick = () => { haptic("pick"); fresh(s.n, true); };
$("allBtn").onclick = () => { haptic("pick"); showWords(); };
$("backBtn").onclick = () => goHome();

// The next word in order each time you open it, unless a game is half played (a half game from before numbers is dropped).
const saved = read().saved;
if (saved?.n && saved.answer && !saved.done) { s = saved; render(); } else fresh(nextFree());
openWipe?.();
