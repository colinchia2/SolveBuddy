// Home (Library tab): the face top left, the streak, and the games. Tap a game → pick a pack (skipped when the game
// has one) → the pack's levels with numbered puzzles → tap one: new ones start, solved ones offer View or Restart,
// half-done ones offer Resume or Restart (approved mockup, canvas row "Game page", Colin 10/21).
import { GAMES, blockScores, clearSaved, haptic, inApp, loadPack, openGame, post, savedGame, smoothClose, solves, solvedIn } from "./bridge.js";
import { $, FLAME, LOOK, esc, fmt, gameIcon, headerLogo, streaks, tabs } from "./screens.js";

const data = {}; // "sudoku/easy" → the pack file (its puzzles draw the little preview)
for (const [g, game] of Object.entries(GAMES))
  for (const [k, file] of game.packs) data[`${g}/${k}`] = await loadPack(file);
const size = (g, k) => data[`${g}/${k}`].puzzles.length;
const total = (g) => GAMES[g].packs.reduce((n, [k]) => n + size(g, k), 0);

const TILES = [
  { id: "starbattle", rules: "One star in every row, column and region (two in Double). Stars never touch." },
  { id: "sudoku", rules: "Every row, column and box holds each number once." },
  { id: "watersort", rules: "Tap a tube, then another, to pour its top colour across. You can only pour onto the same colour or into an empty tube, and only if there's room. Finish when every tube holds one colour." },
  { id: "blocks", rules: "Blocks fall one at a time. Move and turn them so they fill whole rows: a full row clears and scores. It gets faster as you go. The game ends when the blocks reach the top." },
  { soon: "Binairo", bg: "#FBE3D6", ink: "#C24E2A", path: "M3 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0 M12 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0" },
  { soon: "Shikaku", bg: "#F8DDE5", ink: "#A8325A", path: "M3 3h8v11H3z M13 3h8v6h-8z M13 11h8v10h-8z M3 16h8v5H3z" },
  { soon: "Five Letters", bg: "#DCEAFE", ink: "#1F57B5", path: "M2 8h5.5v8H2z M9.25 8h5.5v8h-5.5z M16.5 8H22v8h-5.5z" },
  { soon: "Groups", bg: "#DDEFD9", ink: "#2F6B4A", path: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z" },
];
const LEVEL_BARS = { easy: 1, medium: 2, hard: 3, expert: 4 };
const ICON = {
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5 M11 6l-6 6 6 6"/></svg>`,
  help: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14 M12 17.5v.01"/></svg>`,
  chevron: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B5D52" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
  star: (s, fill) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z"/></svg>`,
  play: (s, fill) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>`,
  download: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F57B5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12 M7 10l5 5 5-5 M4 19h16"/></svg>`,
  eye: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  restart: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7 M3 4v5h5"/></svg>`,
  x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18"/></svg>`,
};
const bars = (n, h = [8, 12, 16, 20]) => n ? `<span class="bars" aria-hidden="true">${h.map((px, i) => `<i style="height:${px}px" class="${i < n ? "on" : ""}"></i>`).join("")}</span>` : "";
const barFill = (done, n) => `<span class="track"><span class="fill" style="width:${Math.round((done / Math.max(1, n)) * 100)}%"></span></span>`;

// Where you are: null = the game tiles; { g } = pick a pack; { g, set } = inside a pack.
let at = null;
let picked = null; // the tile tapped in a pack: { g, k, p, state }

// One puzzle's state: solved (and its best time), half-done (saved), or new.
function tileState(g, k, p) {
  if (savedGame(g, k, p)) return { state: "progress" };
  const times = solves().filter((e) => e.g === g && e.pack === k && e.p === p).map((e) => e.ms);
  return times.length ? { state: "solved", ms: Math.min(...times) } : { state: "new" };
}
const setDone = (g, set) => set.levels.reduce((n, k) => n + solvedIn(g, k).size, 0);
const setSize = (g, set) => set.levels.reduce((n, k) => n + size(g, k), 0);
const label = (g, k) => GAMES[g].packs.find(([key]) => key === k)[2];

function render() {
  const { current } = streaks();
  $("streak").hidden = current < 1;
  $("streak").innerHTML = `${FLAME}${current} day${current === 1 ? "" : "s"}`;
  $("tiles").innerHTML = TILES.map((t) => t.soon
    ? `<button class="tile" disabled aria-label="${esc(t.soon)}, coming soon">${gameIcon(t, 56, 30)}<span><span class="name">${esc(t.soon)}</span><br><span class="count">Coming soon</span></span></button>`
    : t.id === "blocks" ? `<button class="tile" data-game="blocks" aria-label="Play Block Drop">${gameIcon(LOOK.blocks, 56, 30)}<span><span class="name">Block Drop</span><br><span class="count">${blockScores().best ? `Best ${blockScores().best.toLocaleString()}` : "Endless"}</span></span></button>`
    : `<button class="tile" data-game="${t.id}" aria-label="Open ${GAMES[t.id].name}">${gameIcon(LOOK[t.id], 56, 30)}<span><span class="name">${GAMES[t.id].name}</span><br><span class="count">${total(t.id)} ${t.id === "watersort" ? "levels" : "puzzles"}</span></span></button>`).join("");
  document.querySelectorAll("[data-game]").forEach((b) => (b.onclick = () => {
    const g = b.dataset.game;
    if (g === "blocks") { haptic("thud"); return openGame("blocks", ""); } // endless: straight into the game
    go(GAMES[g].sets.length === 1 ? { g, set: 0 } : { g });
  }));
  renderView(false);
}

function go(next) {
  haptic("pick"); // a tick each time you move between screens
  at = next;
  renderView(true);
  scrollTo(0, 0);
}

function renderView(moved) {
  const home = !at;
  document.querySelector(".brandbar").hidden = !home;
  document.querySelector(".home-main").hidden = !home;
  const v = $("view");
  v.hidden = home;
  if (home) return;
  const g = at.g, game = GAMES[g];
  const many = game.sets.length > 1;
  v.className = `gameview${moved ? " enter" : ""}`;
  if (at.set == null) {
    const done = game.sets.reduce((n, s) => n + setDone(g, s), 0);
    v.innerHTML = `<header class="gp-head">
        <button class="sq glass" data-act="back" aria-label="Back to library">${ICON.back}</button>
        ${gameIcon(LOOK[g], 44, 26)}
        <div class="gp-title"><h1>${game.name}</h1><span>${game.sets.length} packs · ${done} of ${total(g)} done</span></div>
        <button class="sq glass" data-act="rules" aria-label="How to play">${ICON.help}</button>
      </header>
      <span class="label">Select a pack</span>
      <div class="gp-packs">${game.sets.map((s, i) => {
        const n = setSize(g, s), d = setDone(g, s);
        return `<button class="pack-card" data-set="${i}" style="--i:${i}" aria-label="${esc(s.name)} pack, ${d} of ${n} done">
          <span class="pack-art" style="background:${LOOK[g].bg};color:${LOOK[g].ink}"><b>${n}</b><small>PUZZLES</small></span>
          <span class="pack-text"><b>${esc(s.name)}</b><small>${s.levels.map((k) => `${s.note ?? label(g, k)} ${size(g, k)}`).join(" · ")}</small>
            <em>${d} of ${n} done</em>${barFill(d, n)}</span>
          ${d === n ? `<span class="pack-done">${ICON.star(14, "#fff")}</span>` : ""}${ICON.chevron}
        </button>`;
      }).join("")}</div>
      ${moreCard(`Get more ${game.name} packs`)}`;
  } else {
    const s = game.sets[at.set];
    let i = 0;
    v.innerHTML = `<header class="gp-head">
        <button class="sq glass" data-act="${many ? "packs" : "back"}" aria-label="${many ? "Back to packs" : "Back to library"}">${ICON.back}</button>
        <div class="gp-title"><h1>${esc(s.name)} pack</h1><span>${game.name} · ${setDone(g, s)} of ${setSize(g, s)} done</span></div>
        <button class="sq glass" data-act="rules" aria-label="How to play">${ICON.help}</button>
      </header>
      ${s.levels.map((k) => {
        const n = size(g, k), d = solvedIn(g, k).size;
        return `<section class="gp-level">
          <div class="gp-level-head">${bars(LEVEL_BARS[k])}<h2>${s.note ?? label(g, k)}</h2><span>${d} of ${n}</span></div>
          <div class="gp-bar">${barFill(d, n)}</div>
          <div class="gp-tiles">${data[`${g}/${k}`].puzzles.map((_, j) => {
            const p = j + 1, t = tileState(g, k, p);
            return `<button class="ptile ${t.state}" style="--i:${i++}" data-k="${k}" data-p="${p}" data-state="${t.state}"
              aria-label="${esc(label(g, k))} ${p}, ${t.state === "solved" ? "solved" : t.state === "progress" ? "resume" : "new"}">
              ${t.state === "progress" ? `${ICON.play(18, "#2F6FD6")}<small>Resume #${p}</small>`
                : `<b>${p}</b>${t.state === "solved" ? `<small>${fmt(t.ms)}</small><span class="ptile-star">${ICON.star(12, "#fff")}</span>` : ""}`}
            </button>`;
          }).join("")}</div>
        </section>`;
      }).join("")}
      <div class="gp-legend"><span><i class="solved"></i>Solved</span><span><i class="progress"></i>Resume</span><span><i class="new"></i>New: tap to start</span></div>
      ${moreCard(`More ${game.name} packs`)}`;
  }
  v.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "back") go(null);
    else if (act === "packs") go({ g });
    else if (act === "rules") openRules(g);
    else if (act === "more") inApp ? post({ type: "tab", name: "Packs" }) : (location.href = "packs.html");
    else if (b.dataset.set) go({ g, set: Number(b.dataset.set) });
    else if (b.dataset.p) tapTile(g, b.dataset.k, Number(b.dataset.p), b.dataset.state);
  };
}

const moreCard = (title) => `<button class="more-card" data-act="more"><span class="more-ico">${ICON.download}</span>
  <span class="pack-text"><b>${title}</b><small>Download a pack, then play it offline</small></span>${ICON.chevron}</button>`;

function tapTile(g, k, p, state) {
  const q = `?pack=${k}&p=${p}`;
  if (state === "new") { haptic("thud"); return openGame(g, q); }
  haptic("tap");
  picked = { g, k, p, state };
  const t = tileState(g, k, p), saved = savedGame(g, k, p);
  const puzzle = data[`${g}/${k}`].puzzles[p - 1];
  const setName = GAMES[g].sets.find((s) => s.levels.includes(k)).name;
  const title = setName === label(g, k) ? `${setName} #${p}` : `${setName} · ${label(g, k)} #${p}`;
  const note = state === "solved" ? `Your best time: ${fmt(t.ms)}`
    : g === "watersort" ? `${fmt(saved.ms ?? 0)} so far · ${saved.moves ?? 0} moves`
    : g === "starbattle" ? `${fmt(saved.ms ?? 0)} so far · ${Object.values(saved.marks ?? {}).filter((v) => v === 2).length} of ${puzzle.regions.length * (data[`${g}/${k}`].stars ?? 1)} stars`
    : `${fmt(saved.ms ?? 0)} so far · ${puzzle.givens.flat().filter(Boolean).length + Object.keys(saved.entries ?? {}).length} of 81 filled`;
  $("tile").querySelector(".sheet").innerHTML = `
    <div class="tile-top">${gameIcon(LOOK[g], 64, 34)}
      <div class="tile-text"><h2>${esc(title)}</h2>
        <span class="chip ${state}">${state === "solved" ? "Solved" : "In progress"}</span><p>${note}</p></div>
      <button class="x" data-act="close" aria-label="Close">${ICON.x}</button></div>
    <button class="tile-main" data-act="main">${state === "solved" ? `${ICON.eye}View solved puzzle` : `${ICON.play(18, "#fff")}Resume`}</button>
    <button class="ghost tile-restart" data-act="restart">${ICON.restart}Restart</button>`;
  $("tile").hidden = false;
}

// While a pop-up is up, Apple's tab bar hides so the pop-up sits fully in front (Colin, 10/21); it comes back once the
// pop-up has slid away.
for (const el of [$("tile"), $("rules")]) {
  let t;
  new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(() => post({ type: "tabbar", hidden: !$("tile").hidden || !$("rules").hidden }), 30);
  }).observe(el, { attributes: true, attributeFilter: ["hidden"] });
}

$("tile").onclick = (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (e.target === $("tile") || act === "close") return ($("tile").hidden = true);
  if (!act || !picked) return;
  const { g, k, p, state } = picked;
  $("tile").hidden = true;
  if (act === "restart") clearSaved(g, k, p);
  haptic("thud");
  openGame(g, `?pack=${k}&p=${p}${act === "main" && state === "solved" ? "&view=1" : ""}`);
};

function openRules(g) {
  $("rules").querySelector(".sheet").innerHTML = `<div class="sheet-top"><h2>How to play</h2>
      <button class="x" data-act="close" aria-label="Close">${ICON.x}</button></div>
    <p>${TILES.find((t) => t.id === g).rules}</p>
    <button class="dark" data-act="close">Got it</button>`;
  $("rules").hidden = false;
}
$("rules").onclick = (e) => {
  if (e.target === $("rules") || e.target.closest("[data-act='close']")) $("rules").hidden = true;
};

// Tap the face: it says hello (wiggle and wink, like TasteBuddy's logo) with a light tap; it also winks when idle.
headerLogo($("logoBtn"));
document.querySelector(".phone").insertAdjacentHTML("beforeend", tabs("home"));
smoothClose();
globalThis.sbRefresh = render; // the app calls this when you come back from a game (you stay on the pack you were in)
render();

// The app's opening animation lands its logo exactly on this one, so tell it where it is. Ours shows once it lands
// (the app calls sbLanded), or after a few seconds whatever happens.
globalThis.sbLanded = () => document.documentElement.classList.remove("splash");
setTimeout(globalThis.sbLanded, 6000); // the app reveals anyway after 5s
if (inApp) {
  const r = $("logoBtn").querySelector(".logo").getBoundingClientRect();
  post({ type: "ready", logo: { x: r.left, y: r.top, size: r.width } });
}
