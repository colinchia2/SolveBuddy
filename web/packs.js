// Packs tab (calmer screens, Colin 10/23): every pack on this phone, grouped by game, as 2-wide blocks. Each pack is
// named once with the levels it holds underneath (Sudoku Starter = one 40-puzzle block, Easy · Medium · Hard ·
// Expert). Names, counts and progress come from the real pack data. Tap a block to open that pack on Library.
import { GAMES, inApp, loadPack, openPack, post, solvedIn } from "./bridge.js";
import { $, LOOK, esc, gameIcon, headerLogo, ring, setParts, tabs } from "./screens.js";

const sizes = {}; // "sudoku/easy" → { n, size }
for (const [g, game] of Object.entries(GAMES))
  for (const [k, file] of game.packs) {
    const f = await loadPack(file);
    sizes[`${g}/${k}`] = { n: f.puzzles.length, size: f.size };
  }
const label = (g, k) => GAMES[g].packs.find(([key]) => key === k)[2];

// One block per pack (a "set" in bridge.js), with its levels and its board size when the game's packs differ in size.
function blocks() {
  return Object.entries(GAMES).map(([g, game]) => {
    const boards = new Set(game.sets.flatMap((s) => s.levels.map((k) => sizes[`${g}/${k}`].size)));
    return { g, name: game.name, packs: game.sets.map((s, i) => {
      const own = [...new Set(s.levels.map((k) => sizes[`${g}/${k}`].size))];
      const levels = s.note ?? s.levels.map((k) => label(g, k)).join(" · ");
      return { i, name: setParts(s.name).short, full: s.name,
        levels: boards.size > 1 && own.length === 1 && own[0] ? `${own[0]}×${own[0]} · ${levels}` : levels,
        n: s.levels.reduce((t, k) => t + sizes[`${g}/${k}`].n, 0),
        done: s.levels.reduce((t, k) => t + solvedIn(g, k).size, 0) };
    }) };
  });
}

function render() {
  $("games").innerHTML = blocks().map(({ g, name, packs }) => `<section class="c-group" data-game="${g}">
      <h2 class="c-ghead game">${gameIcon(LOOK[g], 26, 15)}${esc(name)}</h2>
      <div class="btiles">${packs.map((p) => `<button class="btile" data-g="${g}" data-set="${p.i}" aria-label="Open ${esc(name)} ${esc(p.full)} pack, ${p.n} puzzles, ${p.done} done">
        <span class="top"><span class="n">${esc(p.name)}</span><span class="c">${p.n}</span></span>
        <span class="c">${esc(p.levels)}</span>
        <span class="p">${ring(p.done, p.n, 14)}${p.done}/${p.n} done</span></button>`).join("")}</div>
    </section>`).join("");
}
$("games").onclick = (e) => {
  const b = e.target.closest("[data-set]");
  if (b) openPack(b.dataset.g, Number(b.dataset.set));
};

// The header face: tap = hello, and back to Library (Buddy standard §2); it also winks when idle.
headerLogo($("logoBtn"), () => (inApp ? post({ type: "tab", name: "Library" }) : (location.href = "home.html")));
document.querySelector(".phone").insertAdjacentHTML("beforeend", tabs("packs"));
globalThis.sbRefresh = render;
render();
