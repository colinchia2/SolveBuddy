// Home (Library tab): the face top left, the streak, and the games. Tap a game → pick a pack (skipped when the game
// has one) → the pack's levels with numbered puzzles → tap one: new ones start, solved ones offer View or Restart,
// half-done ones offer Resume or Restart (approved mockup, canvas row "Game page", Colin 10/21).
import { GAMES, OPEN_PACK_KEY, blockScores, clearSaved, finalBoard, haptic, inApp, loadPack, openGame, post, savedGame, smoothClose, solves, solvedIn } from "./bridge.js";
import { boardPreview } from "./preview.js";
import { $, CHEVRON, DOWNLOAD, FLAME, LOOK, esc, fmt, gameIcon, headerLogo, ring, setParts, streaks, tabs } from "./screens.js";

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
  { id: "nonogram", rules: "The numbers beside each row and above each column say how many squares are filled, in order, with a gap between each group. Tap to fill, tap again for ×. Fill them all and a picture appears. 15×15 zooms with two fingers." },
  { id: "shikaku", rules: "Cut the square into rectangles. Each one holds exactly one number and covers that many squares. Drag to draw a patch, drag from a patch to make it bigger, tap one to take it away." },
];
// Games on the list but not built yet: one quiet line under the tiles (calmer screens, Colin 10/23). Never a game
// that's playable (the page test checks).
const SOON = ["Binairo", "Shikaku", "Five Letters", "Groups"].filter((n) => !Object.values(GAMES).some((g) => g.name === n));
const LEVEL_BARS = { easy: 1, medium: 2, hard: 3, expert: 4, killer: 1, thermo: 1, "killer-expert": 4, "thermo-expert": 4, patches: 2 };
// Every pack row's picture (Colin 10/27, mockup "Pack pictures" option C): the pack's first puzzle as it starts (its
// regions, numbers, clues or tubes; never the answer, never your progress, which stays in the ring) with a size
// sticker in the game's colour. The same kind of picture for every pack.
// Nonogram's picture: the empty grid with its clue strips along the top and left, each clue a little bar (its length is
// the number), the way the game looks before you start. Never the picture itself.
function nonoClues(p) {
  const n = p.rows.length, S = 52, band = 15, cs = (S - band) / n, ink = LOOK.nonogram.ink;
  const bars = (clues, i, across) => clues.slice(-4).reverse().map((k, j) => {
    const len = Math.min(band - 3, 1.2 + k * 0.9), off = band - 2 - j * 3.2;
    return across ? `<rect x="${(off - len + 0.6).toFixed(1)}" y="${(band + i * cs + cs / 2 - 0.9).toFixed(1)}" width="${len.toFixed(1)}" height="1.8" rx=".9" fill="${ink}"/>`
      : `<rect x="${(band + i * cs + cs / 2 - 0.9).toFixed(1)}" y="${(off - len + 0.6).toFixed(1)}" width="1.8" height="${len.toFixed(1)}" rx=".9" fill="${ink}"/>`;
  }).join("");
  const lines = Array.from({ length: n - 1 }, (_, i) => { const q = (band + (i + 1) * cs).toFixed(1); return `<path d="M${q} ${band}V${S}M${band} ${q}H${S}" stroke="#E6DACD" stroke-width=".6"/>`; }).join("");
  return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" rx="6" fill="${LOOK.nonogram.bg}"/>`
    + `<rect x="${band}" y="${band}" width="${S - band}" height="${S - band}" fill="#FFFDF9"/>${lines}`
    + `${p.cols.map((cl, i) => bars(cl, i, false)).join("")}${p.rows.map((cl, i) => bars(cl, i, true)).join("")}`
    + `<rect x="${band}" y="${band}" width="${S - band}" height="${S - band}" fill="none" stroke="${ink}" stroke-width="1"/></svg>`;
}
const START = { starbattle: { marks: {} }, sudoku: { entries: {} }, nonogram: { marks: {} }, shikaku: { patches: [] } };
function packThumb(g, s) {
  const pk = data[`${g}/${s.levels[0]}`], p = pk?.puzzles?.[0];
  if (!p) return "";
  if (g === "nonogram") return `<span class="pthumb" aria-hidden="true">${nonoClues(p)}<b class="psize" style="background:${LOOK[g].ink}">${pk.size}×${pk.size}</b></span>`;
  const board = g === "watersort" ? { tubes: p.tubes } : START[g];
  if (!board) return "";
  const n = g === "starbattle" ? p.regions.length : g === "sudoku" ? 9 : pk.size ?? p.size;
  const tag = g === "watersort" ? "" : n ? `${n}×${n}` : "";
  return `<span class="pthumb" aria-hidden="true">${boardPreview(g, p, board)}${tag ? `<b class="psize" style="background:${LOOK[g].ink}">${tag}</b>` : ""}</span>`;
}
const ICON = {
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5 M11 6l-6 6 6 6"/></svg>`,
  help: `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14 M12 17.5v.01"/></svg>`,
  star: (s, fill) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z"/></svg>`,
  play: (s, fill) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>`,
  eye: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  restart: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7 M3 4v5h5"/></svg>`,
  x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18"/></svg>`,
};
const bars = (n, h = [8, 12, 16, 20]) => n ? `<span class="bars" aria-hidden="true">${h.map((px, i) => `<i style="height:${px}px" class="${i < n ? "on" : ""}"></i>`).join("")}</span>` : "";

// Where you are: null = the game tiles; { g } = pick a pack; { g, set } = inside a pack.
let at = null;
let picked = null; // the tile tapped in a pack: { g, k, p, state }

// One puzzle's state: solved (and its best time), half-done (saved), or new.
// justLeft = the puzzle you just came back from, as the game itself saw it (trusted for a few seconds).
let justLeft = null;
const leftHere = (g, k, p) => justLeft && Date.now() < justLeft.until && justLeft.g === g && justLeft.pack === k && justLeft.p === p ? justLeft : null;
const savedHere = (g, k, p) => savedGame(g, k, p) ?? leftHere(g, k, p)?.saved ?? null;
function tileState(g, k, p) {
  const left = leftHere(g, k, p);
  if (left) return { state: left.state, ms: left.ms };
  if (savedGame(g, k, p)) return { state: "progress" };
  const times = solves().filter((e) => e.g === g && e.pack === k && e.p === p).map((e) => e.ms);
  return times.length ? { state: "solved", ms: Math.min(...times) } : { state: "new" };
}
const setDone = (g, set) => set.levels.reduce((n, k) => n + solvedIn(g, k).size, 0);
const setSize = (g, set) => set.levels.reduce((n, k) => n + size(g, k), 0);
const label = (g, k) => GAMES[g].packs.find(([key]) => key === k)[2];
// "8×8" when every level in the pack is the same size (Star Battle, Sudoku); nothing for Water Sort.
const setBoard = (g, set) => {
  const sizes = new Set(set.levels.map((k) => data[`${g}/${k}`].size));
  const [n] = sizes;
  return sizes.size === 1 && n ? `${n}×${n}` : "";
};

function render() {
  const { current } = streaks();
  $("streak").hidden = current < 1;
  $("streak").innerHTML = `${FLAME}${current} day${current === 1 ? "" : "s"}`;
  $("tiles").innerHTML = TILES.map((t) => t.id === "nonogram"
    ? `<button class="tile" data-game="nonogram" aria-label="Open Nonogram">${gameIcon(LOOK.nonogram, 38, 21)}<span><span class="name">Nonogram</span><span class="count">${total("nonogram")} puzzles</span></span></button>`
    : t.id === "blocks"
    ? `<button class="tile" data-game="blocks" aria-label="Play Block Drop">${gameIcon(LOOK.blocks, 38, 21)}<span><span class="name">Block Drop</span><span class="count">${blockScores().best ? `Best ${blockScores().best.toLocaleString()}` : "Endless"}</span></span></button>`
    : `<button class="tile" data-game="${t.id}" aria-label="Open ${GAMES[t.id].name}">${gameIcon(LOOK[t.id], 38, 21)}<span><span class="name">${GAMES[t.id].name}</span><span class="count">${total(t.id)} ${t.id === "watersort" ? "levels" : "puzzles"}</span></span></button>`).join("");
  $("soon").hidden = !SOON.length;
  $("soon").innerHTML = `<b>Coming soon</b>${SOON.map(esc).join(" · ")}`;
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
  const nav = (back) => `<div class="c-nav">
      <button class="iconbtn" data-act="${back}" aria-label="${back === "packs" ? "Back to packs" : "Back to library"}">${ICON.back}</button>
      <button class="iconbtn" data-act="rules" aria-label="How to play">${ICON.help}</button></div>`;
  if (at.set == null) {
    // Calmer screens (Colin 10/23): one soft list per pack family ("Starter"), rows named just Single / Double / Triple.
    const done = game.sets.reduce((n, s) => n + setDone(g, s), 0);
    const groups = [];
    game.sets.forEach((s, i) => {
      const { group, short } = setParts(s.name);
      if (groups.at(-1)?.group === group) groups.at(-1).rows.push({ s, i, short });
      else groups.push({ group, rows: [{ s, i, short }] });
    });
    v.innerHTML = `${nav("back")}
      <div class="c-title"><h1>${game.name}</h1><span>${done} of ${total(g)} done</span></div>
      ${groups.map(({ group, rows }) => `<div class="c-group"><div class="c-ghead">${esc(group || "Packs")}</div>
        <div class="c-list">${rows.map(({ s, i, short }) => {
          const n = setSize(g, s), d = setDone(g, s);
          if (g === "nonogram" || g === "shikaku") { // size is the level (no "zoom" label, Colin 10/24)
            const k = s.levels[0];
            return `<button class="c-row" data-set="${i}" style="--i:${i}" aria-label="${esc(s.name)} pack, ${d} of ${n} done">
              ${packThumb(g, s)}
              <span class="g"><b>${esc(short)}</b><small class="nsub">${bars(LEVEL_BARS[k], [5, 7, 9, 11])}${esc(label(g, k))} · ${n} puzzles</small></span>
              <span class="cnt">${ring(d, n)}${d}/${n}</span>${CHEVRON}</button>`;
          }
          const sub = [setBoard(g, s), s.note ?? s.levels.map((k) => label(g, k)).join(", ")].filter(Boolean).join(" · ");
          return `<button class="c-row" data-set="${i}" style="--i:${i}" aria-label="${esc(s.name)} pack, ${d} of ${n} done">
            ${packThumb(g, s)}<span class="g"><b>${esc(short)}</b><small>${esc(sub)}</small></span><span class="cnt">${ring(d, n)}${d}/${n}</span>${CHEVRON}</button>`;
        }).join("")}</div></div>`).join("")}
      ${g === "nonogram" ? `<p class="c-lead">Size is the level: bigger pictures, longer clues.</p>` : ""}
      ${g === "shikaku" ? `<p class="c-lead">Size is the level: bigger boards, more patches.</p>` : ""}
      ${moreLink(`Get more ${game.name} packs`)}`;
  } else {
    const s = game.sets[at.set];
    const { group, short } = setParts(s.name);
    let i = 0;
    v.innerHTML = `${nav(many ? "packs" : "back")}
      <div class="c-title"><h1>${esc(short)}</h1><span>${[game.name, group, `${setDone(g, s)} of ${setSize(g, s)} done`].filter(Boolean).map(esc).join(" · ")}</span></div>
      ${s.levels.map((k) => {
        const n = size(g, k), d = solvedIn(g, k).size;
        return `<section class="gp-level">
          <div class="gp-level-head">${bars(LEVEL_BARS[k], [6, 9, 12, 15])}<b>${s.note ?? label(g, k)}</b><span>${d}/${n}</span></div>
          <div class="gp-tiles">${data[`${g}/${k}`].puzzles.map((_, j) => {
            const p = j + 1, t = tileState(g, k, p);
            return `<button class="ptile ${t.state}" style="--i:${i++}" data-k="${k}" data-p="${p}" data-state="${t.state}"
              aria-label="${esc(label(g, k))} ${p}, ${t.state === "solved" ? `solved, best ${fmt(t.ms)}` : t.state === "progress" ? "in progress, resume" : "new"}">
              <b>${p}</b>${t.state === "solved" ? `<small>${fmt(t.ms)}</small>` : t.state === "progress" ? "<small>Resume</small>" : ""}
            </button>`;
          }).join("")}</div>
        </section>`;
      }).join("")}
      <div class="gp-key"><span><i class="solved"></i>Solved, best time</span><span><i class="progress"></i>In progress</span></div>
      ${moreLink(`More ${game.name} packs`)}`;
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

const moreLink = (title) => `<button class="c-link" data-act="more">${DOWNLOAD}${title}</button>`;

function tapTile(g, k, p, state) {
  const q = `?pack=${k}&p=${p}`;
  if (state === "new") { haptic("thud"); return openGame(g, q); }
  haptic("tap");
  picked = { g, k, p, state };
  const t = tileState(g, k, p), saved = savedHere(g, k, p) ?? {};
  const puzzle = data[`${g}/${k}`].puzzles[p - 1];
  const setName = GAMES[g].sets.find((s) => s.levels.includes(k)).name;
  const title = setName === label(g, k) ? `${setName} #${p}` : `${setName} · ${label(g, k)} #${p}`;
  const note = state === "solved" ? `Your best time: ${fmt(t.ms)}`
    : g === "watersort" ? `${fmt(saved.ms ?? 0)} so far · ${saved.moves ?? 0} moves`
    : g === "nonogram" ? `${fmt(saved.ms ?? 0)} so far · ${Object.values(saved.marks ?? {}).filter((v) => v === 1).length} squares filled`
    : g === "shikaku" ? `${fmt(saved.ms ?? 0)} so far · ${(saved.patches ?? []).length} of ${puzzle.clues.length} patches drawn`
    : g === "starbattle" ? `${fmt(saved.ms ?? 0)} so far · ${Object.values(saved.marks ?? {}).filter((v) => v === 2).length} of ${puzzle.regions.length * (data[`${g}/${k}`].stars ?? 1)} stars`
    : `${fmt(saved.ms ?? 0)} so far · ${puzzle.givens.flat().filter(Boolean).length + Object.keys(saved.entries ?? {}).length} of 81 filled`;
  $("tile").querySelector(".sheet").innerHTML = `
    <div class="tile-top">${gameIcon(LOOK[g], 64, 34)}
      <div class="tile-text"><h2>${esc(title)}</h2>
        <span class="chip ${state}">${state === "solved" ? "Solved" : "In progress"}</span><p>${note}</p></div>
      <button class="x" data-act="close" aria-label="Close">${ICON.x}</button></div>
    ${boardPreview(g, puzzle, state === "solved" ? finalBoard(g, k, p) : saved)}
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
  if (act === "restart") { clearSaved(g, k, p); justLeft = null; }
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
// The app calls sbRefresh when you come back from a game (you stay on the pack you were in). The game's save can reach
// this page a moment later (Colin 10/22: Resume showed up late), so keep looking for 2 seconds and redraw when it lands.
const STATE_KEYS = ["solvebuddy.saved", "solvebuddy.solves", "solvebuddy.blocks"];
const stateNow = () => STATE_KEYS.map((k) => { try { return localStorage.getItem(k); } catch { return null; } }).join("|");
let drawn = "";
function fresh() {
  const now = stateNow();
  if (now === drawn) return;
  drawn = now;
  render();
}
// The Packs tab asked to open one of its packs here (bridge.js openPack): in the app as a note in storage, in a
// browser as ?g=…&set=… on this page's address.
let askedByUrl = false;
function openAsked() {
  let ask = null;
  try { ask = JSON.parse(localStorage.getItem(OPEN_PACK_KEY) || "null"); if (ask) localStorage.removeItem(OPEN_PACK_KEY); } catch {}
  const q = new URLSearchParams(location.search);
  if (!ask && q.has("g") && !askedByUrl) ask = { g: q.get("g"), set: Number(q.get("set")), at: Date.now() };
  askedByUrl = true;
  if (!ask || Date.now() - ask.at > 30000 || !GAMES[ask.g]?.sets[ask.set]) return;
  at = { g: ask.g, set: ask.set };
  renderView(true);
  scrollTo(0, 0);
}
let watching = 0;
globalThis.sbRefresh = (left) => {
  if (left) justLeft = { ...left, until: Date.now() + 4000 };
  drawn = "";
  fresh();
  openAsked();
  clearInterval(watching);
  const until = Date.now() + 2000;
  watching = setInterval(() => (Date.now() > until ? clearInterval(watching) : fresh()), 100);
};
// Tapping the Library tab while you're on it (the app calls this) goes straight back to the Library's first screen
// from a game's packs or a pack, or scrolls to the top when you're already there (Colin 10/24).
globalThis.sbHome = () => (at ? go(null) : scrollTo({ top: 0, behavior: "smooth" }));
addEventListener("storage", () => { fresh(); openAsked(); });
addEventListener("pageshow", fresh); // the browser's back button
render();
drawn = stateNow();
openAsked();

// The app's opening animation lands its logo exactly on this one, so tell it where it is. Ours shows once it lands
// (the app calls sbLanded), or after a few seconds whatever happens.
globalThis.sbLanded = () => document.documentElement.classList.remove("splash");
setTimeout(globalThis.sbLanded, 6000); // the app reveals anyway after 5s
if (inApp) {
  const r = $("logoBtn").querySelector(".logo").getBoundingClientRect();
  post({ type: "ready", logo: { x: r.left, y: r.top, size: r.width } });
}
