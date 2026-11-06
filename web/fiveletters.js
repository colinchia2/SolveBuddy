// Five Letters play page (Colin 11/6): a random word each time, six tries, fun letters. Rules in engine/fiveletters/game.ts.
import { LEN, TRIES, hintSpot, keyMarks, score } from "../engine/fiveletters/game.ts";
import { goHome, haptic, hapticLevel, loadPack } from "./bridge.js";
import { celebrate, openWipe } from "./celebrate.js";

const WORDS_KEY = "solvebuddy.fiveletters";
const words = await loadPack("fiveletters-words.json");
const allowed = new Set(words.guesses);
const $ = (id) => document.getElementById(id);
const read = () => { try { return JSON.parse(localStorage.getItem(WORDS_KEY) || "{}"); } catch { return {}; } };
const store = (patch) => { try { localStorage.setItem(WORDS_KEY, JSON.stringify({ ...read(), ...patch })); } catch {} };
const pick = () => words.answers[Math.floor(Math.random() * words.answers.length)];

let s, busy = false, hint = null;
function fresh() {
  s = { answer: pick(), guesses: [], cur: "", shown: [], done: false, started: Date.now() };
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
  $("sub").textContent = s.done ? "Finished" : `Try ${s.guesses.length + 1} of ${TRIES}`;
  $("hint").hidden = !hint;
  if (hint) {
    $("hintStep").textContent = `Step ${hint.step + 1} of 2`;
    $("hintTitle").textContent = hint.step ? `It's ${/[aefhilmnorsx]/.test(s.answer[hint.spot]) ? "an" : "a"} ${s.answer[hint.spot].toUpperCase()}` : `Look at letter ${hint.spot + 1}`;
    $("hintBody").textContent = hint.step ? "It stays faint in your row until you type it." : "This is the first letter you haven't found yet.";
    $("hintNextLabel").textContent = hint.step ? "Done" : "Show me";
  }
}
function press(k) {
  if (busy || s.done || hint) return;
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
  store({ played: (d.played ?? 0) + 1, won: (d.won ?? 0) + 1, streak: n, best: Math.max(d.best ?? 0, n), saved: null });
  celebrate({ title: "Five Letters", level: `In ${s.guesses.length} ${s.guesses.length === 1 ? "try" : "tries"}`, facts: { ms: Date.now() - (s.started ?? Date.now()), hints: 0 }, hasNext: true, onNext: fresh, delay: 1100 });
}
function lose() {
  const d = read();
  store({ played: (d.played ?? 0) + 1, streak: 0, saved: null });
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
$("newBtn").onclick = () => { haptic("pick"); if (!s.done && s.guesses.length) store({ streak: 0 }); fresh(); };
$("backBtn").onclick = () => goHome();

// A new word each time you open it, unless a game is half played.
const saved = read().saved;
if (saved?.answer && !saved.done) { s = saved; render(); } else fresh();
openWipe?.();
