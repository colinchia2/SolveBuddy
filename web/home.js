// Home (Library tab): the face top left, the streak, and the games. Tap a game → pick a level → play the next
// unsolved puzzle in that pack.
import { GAMES, buzz, inApp, loadPack, openGame, post, savedGame, solvedIn } from "./bridge.js";
import { $, FACE, FLAME, LOOK, esc, gameIcon, streaks, tabs } from "./screens.js";

const sizes = {}; // "sudoku/easy" → number of puzzles
for (const [g, game] of Object.entries(GAMES))
  for (const [k, file] of game.packs) sizes[`${g}/${k}`] = (await loadPack(file)).puzzles.length;
const total = (g) => GAMES[g].packs.reduce((n, [k]) => n + sizes[`${g}/${k}`], 0);

const TILES = [
  { id: "starbattle", rules: "One star in every row, column and region. Stars never touch." },
  { id: "sudoku", rules: "Every row, column and box holds each number once." },
  { soon: "Binairo", bg: "#F8EBC9", ink: "#8C5F00", path: "M3 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0 M12 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0" },
  { soon: "Shikaku", bg: "#F8DDE5", ink: "#A8325A", path: "M3 3h8v11H3z M13 3h8v6h-8z M13 11h8v10h-8z M3 16h8v5H3z" },
  { soon: "Five Letters", bg: "#ECE2F7", ink: "#6A45B0", path: "M2 8h5.5v8H2z M9.25 8h5.5v8h-5.5z M16.5 8H22v8h-5.5z" },
  { soon: "Groups", bg: "#DDEFD9", ink: "#2F6B4A", path: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z" },
];
const LEVEL_BARS = { easy: 1, medium: 2, hard: 3, expert: 4 };

let picking = null; // { game, pack }

// A half-done game in this pack comes first (Colin, 10/21), then the first one not solved yet.
function nextPuzzle(g, k) {
  const saved = savedGame(g, k);
  if (saved) return saved.p;
  const done = solvedIn(g, k);
  const n = sizes[`${g}/${k}`];
  for (let p = 1; p <= n; p++) if (!done.has(p)) return p;
  return 1;
}

function render() {
  const { current } = streaks();
  $("streak").hidden = current < 1;
  $("streak").innerHTML = `${FLAME}${current} day${current === 1 ? "" : "s"}`;
  $("tiles").innerHTML = TILES.map((t) => t.soon
    ? `<button class="tile" disabled aria-label="${esc(t.soon)}, coming soon">${gameIcon(t, 56, 30)}<span><span class="name">${esc(t.soon)}</span><br><span class="count">Coming soon</span></span></button>`
    : `<button class="tile" data-game="${t.id}" aria-label="Open ${GAMES[t.id].name}">${gameIcon(LOOK[t.id], 56, 30)}<span><span class="name">${GAMES[t.id].name}</span><br><span class="count">${total(t.id)} puzzles</span></span></button>`).join("");
  document.querySelectorAll("[data-game]").forEach((b) => (b.onclick = () => {
    const g = b.dataset.game;
    const resume = GAMES[g].packs.filter(([k]) => savedGame(g, k)).sort(([a], [b]) => savedGame(g, b).at - savedGame(g, a).at)[0];
    const first = resume ?? GAMES[g].packs.find(([k]) => solvedIn(g, k).size < sizes[`${g}/${k}`]) ?? GAMES[g].packs[0];
    picking = { game: g, pack: first[0] };
    renderPick();
  }));
  renderPick();
}

function renderPick() {
  $("pick").hidden = !picking;
  if (!picking) return;
  const { game, pack } = picking;
  const tile = TILES.find((t) => t.id === game);
  const label = GAMES[game].packs.find(([k]) => k === pack)[2];
  $("pick").innerHTML = `<section class="pick" role="dialog" aria-label="${GAMES[game].name}: choose a level">
    <div class="pick-top">${gameIcon(LOOK[game], 72, 40)}
      <button class="x" id="pickClose" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12 M18 6L6 18"/></svg></button></div>
    <div><h3>${GAMES[game].name}</h3><p>${tile.rules}</p></div>
    <div><span class="label">Choose a level</span><div class="levels">${GAMES[game].packs.map(([k, , name]) => {
      const n = sizes[`${game}/${k}`], done = solvedIn(game, k).size, bars = LEVEL_BARS[k];
      return `<button class="level" data-pack="${k}" aria-pressed="${k === pack}">${bars ? `<span class="bars" aria-hidden="true">${[8, 12, 16, 20].map((h, i) => `<i style="height:${h}px" class="${i < bars ? "on" : ""}"></i>`).join("")}</span>` : ""}
        <span><b>${name}</b><small>${savedGame(game, k) ? `#${savedGame(game, k).p} in progress` : done ? `${done} of ${n} solved` : `${n} puzzle${n === 1 ? "" : "s"}`}</small></span></button>`;
    }).join("")}</div></div>
    <button class="play" id="play"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>${savedGame(game, pack) ? "Resume" : "Play"} ${label} #${nextPuzzle(game, pack)}</button>
  </section>`;
  $("pickClose").onclick = () => { picking = null; renderPick(); };
  $("pick").onclick = (e) => { if (e.target === $("pick")) { picking = null; renderPick(); } };
  document.querySelectorAll("[data-pack]").forEach((b) => (b.onclick = () => { picking.pack = b.dataset.pack; renderPick(); }));
  $("play").onclick = () => {
    const q = `?pack=${pack}&p=${nextPuzzle(game, pack)}`;
    picking = null;
    renderPick();
    openGame(game, q);
  };
}

$("logoBtn").innerHTML = `${FACE}<span class="wordmark">SolveBuddy</span>`;
// Tap the face: it winks and hops (like TasteBuddy's logo), with a small buzz.
$("logoBtn").onclick = () => {
  const logo = $("logoBtn").querySelector(".logo");
  logo.classList.remove("wink");
  void logo.getBoundingClientRect();
  logo.classList.add("wink");
  buzz(12);
};
document.querySelector(".phone").insertAdjacentHTML("beforeend", tabs("home"));
globalThis.sbRefresh = render; // the app calls this when you come back from a game
render();

// The app's opening animation lands its logo exactly on this one, so tell it where it is. Ours shows once it lands
// (the app calls sbLanded), or after a few seconds whatever happens.
globalThis.sbLanded = () => document.documentElement.classList.remove("splash");
setTimeout(globalThis.sbLanded, 4000);
if (inApp) {
  const r = $("logoBtn").querySelector(".logo").getBoundingClientRect();
  post({ type: "ready", logo: { x: r.left, y: r.top, size: r.width } });
}
