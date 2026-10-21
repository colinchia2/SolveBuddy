// Packs tab: every pack on this phone with how far you are, and what's coming. Tap a pack to play its next puzzle.
import { GAMES, loadPack, openGame, solvedIn } from "./bridge.js";
import { $, LOOK, gameIcon, tabs } from "./screens.js";

const packs = [];
for (const [g, game] of Object.entries(GAMES))
  for (const [k, file, label] of game.packs) packs.push({ g, k, label, n: (await loadPack(file)).puzzles.length });

// Ideas on the list (backlog), shown as "Soon" only. No dates promised.
const SOON = [
  ["Killer Sudoku", "9×9 · cages that add up", LOOK.sudoku],
  ["Thermo Sudoku", "9×9 · numbers climb the thermometer", LOOK.sudoku],
  ["Two-star Star Battle", "10×10 · two stars per row", LOOK.starbattle],
];
const CHECK = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2F6B4A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="On this phone"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`;

function render() {
  $("count").textContent = packs.length;
  $("mine").innerHTML = packs.map(({ g, k, label, n }) => {
    const done = solvedIn(g, k).size;
    return `<button class="card-glass" data-g="${g}" data-k="${k}" aria-label="Play ${GAMES[g].name} ${label}">
      <span class="line">${gameIcon(LOOK[g], 44, 24)}<span class="grow"><b>${GAMES[g].name} · ${label}</b><small>${LOOK[g].size} · ${n} puzzle${n === 1 ? "" : "s"}</small></span>${CHECK}</span>
      <span class="prog"><span class="track"><span class="fill" style="display:block;width:${Math.round((done / n) * 100)}%"></span></span>${done} / ${n}</span>
    </button>`;
  }).join("");
  document.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => {
    const { g, k } = b.dataset;
    const { n } = packs.find((p) => p.g === g && p.k === k);
    const done = solvedIn(g, k);
    let p = 1;
    while (p <= n && done.has(p)) p++;
    openGame(g, `?pack=${k}&p=${p > n ? 1 : p}`);
  }));
  $("soon").innerHTML = SOON.map(([name, note, look]) =>
    `<div class="card-glass"><span class="line">${gameIcon(look, 44, 24)}<span class="grow"><b>${name}</b><small>${note}</small></span><span class="soon">Soon</span></span></div>`).join("");
}

document.querySelector(".phone").insertAdjacentHTML("beforeend", tabs("packs"));
globalThis.sbRefresh = render;
render();
