// Import tab (approved mockups, canvas row "Import a puzzle", Colin 10/22): your imported puzzles by day added, and a
// new import: type and size → photo → "Does this look right?" (here also the hand builder) → play it. Star Battle, Sudoku
// and Water Sort (Colin 10/22).
// The app can't read photos yet (no AI key): Colin sends the screenshot to Claude in chat and it lands in
// packs/imports.json. Rules: normal rules for now (Classic Sudoku); variant rules (a rules photo) come later.
import { countAnswers } from "../engine/starbattle/countAnswers.ts";
import { countSolutions } from "../engine/sudoku/countSolutions.ts";
import { isSolved } from "../engine/watersort/rules.ts";
import { solve } from "../engine/watersort/solve.ts";
import { haptic, inApp, loadPack, openGame, post, savedGame, solves, smoothClose } from "./bridge.js";
import { $, LOOK, esc, fmt, gameIcon, headerLogo, tabs } from "./screens.js";
import { LETTERS, MAX_SIZE, MAX_TUBES, MIN_SIZE, MIN_TUBES, REGION_COLORS, TUBE_CAP, WATER_COLORS, WATER_NAMES, addImport, allImports,
  answerVerdict, boardProblem, deleteImport, groupByDay, markClashes, maxStars, sudokuClashes, sudokuWrong, waterProblem } from "./importdata.js";

const bundled = (await loadPack("imports.json").catch(() => null))?.puzzles ?? [];
const GAME_NAMES = { starbattle: "Star Battle", sudoku: "Sudoku", watersort: "Water Sort" };
const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z" fill="#2A211B"/></svg>`;
const ICON = {
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5 M11 6l-6 6 6 6"/></svg>`,
  cam: (c, s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>`,
  caret: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E433A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
  down: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E433A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14 M6 13l6 6 6-6"/></svg>`,
  up: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E433A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5 M6 11l6-6 6 6"/></svg>`,
  tick: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F6FD6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`,
  dots: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
  next: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14 M13 6l6 6-6 6"/></svg>`,
  chat: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1F57B5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>`,
};

// The screen you're on: "list", "type", "photo" or "edit"; plus the new import being made and the list's filters.
let at = "list";
const view = { newest: true, game: "all" };
let draft = null; // { game, size, stars, grid: [[letter|""]], marks, color, mode, undo, check }

// ---------- List ----------
function itemState(it) {
  const saved = savedGame(it.game, "import", it.id);
  if (saved) return { state: "progress", saved };
  const times = solves().filter((e) => e.g === it.game && e.pack === "import" && e.p === it.id).map((e) => e.ms);
  return times.length ? { state: "solved", ms: Math.min(...times) } : { state: "new" };
}
// "Star Battle 8×8 · 1 star", "Sudoku 9×9 · Classic", "Water Sort · 14 tubes".
function itemTitle(it) {
  if (it.game === "sudoku") return "Sudoku 9×9 · Classic";
  if (it.game === "watersort") return `Water Sort · ${it.tubes.length} tubes`;
  return `Star Battle ${it.size}×${it.size} · ${it.stars} star${it.stars === 1 ? "" : "s"}`;
}
function rowNote(it, s) {
  const time = new Date(it.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const from = it.source === "claude" ? "from your screenshot" : "built by hand";
  if (s.state === "progress") {
    if (it.game === "sudoku") {
      const filled = it.givens.flat().filter(Boolean).length + Object.keys(s.saved.entries ?? {}).length;
      return `Added ${time} · ${filled} of 81 filled`;
    }
    if (it.game === "watersort") return `Added ${time} · ${s.saved.moves ?? 0} moves`;
    const stars = Object.values(s.saved.marks ?? {}).filter((v) => v === 2).length;
    return `Added ${time} · ${stars} of ${it.size * it.stars} stars`;
  }
  if (s.state === "solved") return `Added ${time} · solved in ${fmt(s.ms)}`;
  return `Added ${time} · ${from}`;
}
// The block's size line: "10×10 · 2 stars", "9×9 · Classic", "14 tubes".
function itemShape(it) {
  if (it.game === "sudoku") return "9×9 · Classic";
  if (it.game === "watersort") return `${it.tubes.length} tubes`;
  return `${it.size}×${it.size} · ${it.stars} star${it.stars === 1 ? "" : "s"}`;
}
const FILTERS = [["all", "All games"], ["starbattle", "Star Battle"], ["sudoku", "Sudoku"], ["watersort", "Water Sort"]];
const STATE_WORD = { new: "New", progress: "In progress", solved: "Solved" };
// Calmer screens (Colin 10/23): a New import button with one line under it, then your imports as 2-wide blocks under
// their day, with the game filter and the sort in one small row.
function renderList() {
  const items = allImports(bundled).filter((x) => view.game === "all" || x.game === view.game);
  const total = allImports(bundled).length;
  const groups = groupByDay(items, view.newest);
  const shown = FILTERS.find(([g]) => g === view.game)[1];
  let i = 0;
  return `<div class="imp-list">
    <button class="primary c-new" data-act="new">${ICON.cam("#fff", 20)}New import</button>
    <p class="c-under">Snap one you're stuck on, then play it here or get a hint.</p>
    <div class="c-tools"><b>Your imports · ${total}</b>
      <button class="c-pill" data-act="filter" aria-label="Show ${shown}">${shown}${ICON.caret}</button>
      <button class="c-pill" data-act="sort" aria-label="Sort by day added, ${view.newest ? "newest" : "oldest"} first">${view.newest ? "Newest" : "Oldest"}${view.newest ? ICON.down : ICON.up}</button></div>
    ${groups.length ? groups.map((g) => `<div class="day"><span>${esc(g.day)}</span><div class="btiles">${g.items.map((it) => {
      const st = itemState(it);
      return `<div class="btile imp" style="--i:${i++}">
        <button class="imp-open" data-open="${esc(it.id)}" aria-label="Open ${esc(itemTitle(it))}, ${STATE_WORD[st.state]}, ${esc(rowNote(it, st))}">
          <span class="top">${gameIcon(LOOK[it.game], 30, 16)}<span class="state ${st.state}">${STATE_WORD[st.state]}</span></span>
          <span class="n">${GAME_NAMES[it.game]}</span><span class="c">${esc(itemShape(it))}</span>
          <span class="c">${new Date(it.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
        </button>
        ${it.source === "hand" ? `<button class="more" data-more="${esc(it.id)}" aria-label="More options">${ICON.dots}</button>` : ""}
      </div>`;
    }).join("")}</div></div>`).join("")
    : `<div class="empty">${total ? "None of those yet." : "Nothing imported yet. Tap New import to bring in your first puzzle."}</div>`}
  </div>`;
}

// "All games" opens the four choices in a small sheet.
function openFilter() {
  haptic("pick");
  $("menu").querySelector(".sheet").innerHTML = `<div class="sheet-top"><h2>Show</h2>
      <button class="x" data-act="close" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18"/></svg></button></div>
    <div class="card">${FILTERS.map(([g, name]) => `<button class="menu-row" data-filter="${g}" aria-pressed="${view.game === g}">
      ${g === "all" ? `<span class="gico" style="width:30px;height:30px"></span>` : gameIcon(LOOK[g], 30, 16)}<span><b>${name}</b></span>${view.game === g ? ICON.tick : ""}</button>`).join("")}</div>`;
  $("menu").hidden = false;
  $("menu").onclick = (e) => {
    const b = e.target === $("menu") ? null : e.target.closest("button");
    if (e.target === $("menu") || b?.dataset.act === "close") return ($("menu").hidden = true);
    if (!b?.dataset.filter) return;
    view.game = b.dataset.filter;
    haptic("tap");
    $("menu").hidden = true;
    render();
  };
}

// ---------- New import ----------
const steps = (n) => `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`;
const head = (title, sub, back) => `<header class="gp-head">
    <button class="sq glass" data-act="${back}" aria-label="Back">${ICON.back}</button>
    <div class="gp-title"><h1>${esc(title)}</h1><span>${esc(sub)}</span></div>
  </header>`;
const what = () => draft.game === "sudoku" ? "Sudoku 9×9 · Classic"
  : draft.game === "watersort" ? `Water Sort · ${draft.tubeCount} tubes`
  : `Star Battle ${draft.size}×${draft.size} · ${draft.stars} star${draft.stars === 1 ? "" : "s"}`;

function renderType() {
  const most = maxStars(draft.size);
  const g = draft.game;
  const types = `<div class="types">${["starbattle", "sudoku", "watersort"].map((id) =>
    `<button class="type" data-game="${id}" aria-pressed="${g === id}">${gameIcon(LOOK[id], 44, 24)}${GAME_NAMES[id]}</button>`).join("")}</div>`;
  const top = `${head("New import", "Step 1 of 3 · what is it?", "list")}${steps(1)}<span class="label">Puzzle</span>${types}`;
  const next = `<button class="primary" data-act="photo">Next: the photo${ICON.next}</button>`;
  if (g === "sudoku") {
    return `${top}
    <div class="opts"><div class="opt"><span><b>Size</b><small>Classic Sudoku</small></span><b style="font-size:20px">9×9</b></div></div>
    <div class="note"><span class="cam" aria-hidden="true" style="width:40px;height:40px">${ICON.cam("#1F57B5")}</span><p><b>Rules:</b> Classic: every row, column and box holds 1–9 once. Sudokus with their own extra rules (cages, thermometers) come later.</p></div>
    ${next}`;
  }
  if (g === "watersort") {
    return `${top}
    <div class="opts">
      <div class="opt"><span><b>Tubes</b><small>${MIN_TUBES} to ${MAX_TUBES}, 4 units each (up to 3 rows of 6)</small></span>
        <span class="stepper"><button data-act="fewer" aria-label="Fewer tubes" ${draft.tubeCount <= MIN_TUBES ? "disabled" : ""}>−</button>
          <b>${draft.tubeCount}</b><button data-act="more" aria-label="More tubes" ${draft.tubeCount >= MAX_TUBES ? "disabled" : ""}>+</button></span></div>
      <small style="color:var(--muted)">Count every tube in your photo, empty ones too. Colours = tubes minus the empty ones.</small>
    </div>
    ${next}`;
  }
  return `${top}
    <div class="opts">
      <div class="opt"><span><b>Size</b><small>${MIN_SIZE}×${MIN_SIZE} up to ${MAX_SIZE}×${MAX_SIZE}</small></span>
        <span class="stepper"><button data-act="smaller" aria-label="Smaller" ${draft.size <= MIN_SIZE ? "disabled" : ""}>−</button>
          <b>${draft.size}×${draft.size}</b><button data-act="bigger" aria-label="Bigger" ${draft.size >= MAX_SIZE ? "disabled" : ""}>+</button></span></div>
      <div class="opt" style="flex-direction:column; align-items:stretch">
        <span><b>Stars per row, column and region</b><small>${most === 1 ? "Boards this small hold 1 star" : most === 2 ? "8×8 and 9×9 hold up to 2" : "10×10 and up hold up to 3"}</small></span>
        <div class="seg">${[1, 2, 3].map((n) => `<button data-stars="${n}" aria-pressed="${draft.stars === n}" ${n > most ? "disabled" : ""}>${n} star${n === 1 ? "" : "s"}</button>`).join("")}</div>
      </div>
    </div>
    <div class="note"><span class="cam" aria-hidden="true" style="width:40px;height:40px">${ICON.cam("#1F57B5")}</span><p><b>Rules:</b> normal Star Battle rules. Puzzles with their own extra rules come later.</p></div>
    ${next}`;
}

function renderPhoto() {
  return `${head(what(), "Step 2 of 3 · the photo", "type")}${steps(2)}
    <div class="note"><span class="cam" aria-hidden="true">${ICON.chat}</span>
      <p><b>For now, send the screenshot to Claude in chat.</b> It reads the puzzle and adds it here, under Today, the next time the app updates. SolveBuddy will read photos by itself later.</p></div>
    <div class="note"><span class="cam" aria-hidden="true" style="background:#FBE3D6"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C24E2A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16z M14 6l3 3"/></svg></span>
      <p><b>Or build it by hand.</b> ${draft.game === "sudoku" ? "Type in the printed numbers, then any you'd already filled in. SolveBuddy checks it has one answer before you start."
        : draft.game === "watersort" ? "Fill each tube with its colours, bottom to top, as they are now. SolveBuddy checks it can be finished before you start."
        : "Paint the regions to match your puzzle and add any stars and × you already have. SolveBuddy checks it has one answer before you start."}</p></div>
    <div style="flex:1"></div>
    <button class="primary" data-act="build">Build it by hand${ICON.next}</button>`;
}

// ---------- Editor: "Does this look right?" ----------
const banner = (b) => `<div class="banner ${b.kind}" id="banner" role="status"><span class="dot" aria-hidden="true">${b.kind === "good" ? "✓" : b.kind === "bad" || b.kind === "warn" ? "!" : ""}</span>
      <span><b>${esc(b.title)}</b>${b.text ? `<small>${esc(b.text)}</small>` : ""}</span></div>`;
const verdictOf = (fallback) => draft.check?.busy ? { kind: "busy", title: "Checking…", text: "" } : draft.check?.verdict ?? fallback;
const startRow = (b) => `<div class="twin"><button class="plain" data-act="undo" ${draft.undo.length ? "" : "disabled"}>Undo</button>
      <button class="primary" data-act="start" ${b.kind === "good" || b.kind === "warn" ? "" : "disabled"}>${b.kind === "warn" ? "Start anyway" : "Looks right · start"}</button></div>`;

// Sudoku: tap a cell, then a number. "Printed" numbers are the puzzle's own (dark); "Yours" are ones you'd filled in (blue).
function renderSudokuEdit() {
  const d = draft, ck = d.check;
  const red = new Set(ck?.clashes ?? []), wrong = new Set(ck?.wrong ?? []);
  const cells = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const k = `${r},${c}`, g = d.givens[r][c], m = d.entries[k];
    const cls = ["sc", c === 2 || c === 5 ? "br" : "", r === 2 || r === 5 ? "bb" : "", g ? "given" : m ? "mine" : "",
      red.has(k) ? "clash" : "", wrong.has(k) ? "wrong" : "", d.sel === k ? "sel" : ""].filter(Boolean).join(" ");
    cells.push(`<button class="${cls}" data-cell="${k}" aria-label="Row ${r + 1} column ${c + 1}${g ? `, printed ${g}` : m ? `, your ${m}` : ", empty"}">${g || m || ""}</button>`);
  }
  const b = verdictOf({ kind: "wait", title: "Add the printed numbers", text: "" });
  return `${head("Does this look right?", `Step 3 of 3 · ${what()}`, "photo")}${steps(3)}
    ${banner(b)}
    <div class="sboard">${cells.join("")}</div>
    <div class="tools">
      <div class="seg mode" style="grid-template-columns:1fr 1fr"><button data-layer="given" aria-pressed="${d.layer === "given"}">Printed numbers</button><button data-layer="mine" aria-pressed="${d.layer === "mine"}">Yours</button></div>
      <div class="spad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-num="${n}" aria-label="${n}">${n}</button>`).join("")}<button data-num="0" aria-label="Clear" class="clr">Clear</button></div>
      <small style="color:var(--muted)">${d.layer === "given" ? "Tap a cell, then its printed number." : "Tap a cell, then the number you'd written in. Printed cells stay as they are."}</small>
    </div>
    ${startRow(b)}`;
}

// Water Sort: tap a tube, then colours to fill it from the bottom up; Remove top takes the last one off.
function renderWaterEdit() {
  const d = draft;
  const count = {};
  for (const tube of d.tubes) for (const c of tube) count[c] = (count[c] ?? 0) + 1;
  const tubes = d.tubes.map((tube, i) => `<button class="wtube${d.sel === i ? " sel" : ""}" data-tube="${i}" aria-label="Tube ${i + 1}: ${tube.length ? tube.map((c) => WATER_NAMES[c]).join(", ") : "empty"}">
      ${tube.map((c) => `<i style="background:${WATER_COLORS[c]}"></i>`).join("")}</button>`);
  const rows = [];
  for (let i = 0; i < tubes.length; i += 6) rows.push(`<div class="wrow">${tubes.slice(i, i + 6).join("")}</div>`);
  const b = verdictOf({ kind: "wait", title: "Fill the tubes", text: "" });
  return `${head("Does this look right?", `Step 3 of 3 · ${what()}`, "photo")}${steps(3)}
    ${banner(b)}
    <div class="wboard">${rows.join("")}</div>
    <div class="tools">
      <div class="wswatches">${Object.keys(WATER_COLORS).map((c) => `<button class="wsw" data-wcolor="${c}" aria-label="Add ${WATER_NAMES[c]}" style="background:${WATER_COLORS[c]}">${count[c] ? `<b>${count[c]}</b>` : ""}</button>`).join("")}</div>
      <button class="plain" data-act="pop" style="min-height:44px" ${d.sel != null && d.tubes[d.sel]?.length ? "" : "disabled"}>Remove top colour</button>
      <small style="color:var(--muted)">${d.sel == null ? "Pick a tube, then tap its colours from the bottom up." : `Tube ${d.sel + 1}: tap colours to fill it, bottom to top (4 at most). The number on a colour is how many you've used; each needs 4.`}</small>
    </div>
    ${startRow(b)}`;
}
const cellPx = (n) => Math.min(44, Math.floor(340 / n));
function regionsOf(grid) { return grid.map((row) => row.join("")); }

function renderEdit() {
  if (draft.game === "sudoku") return renderSudokuEdit();
  if (draft.game === "watersort") return renderWaterEdit();
  const n = draft.size, d = draft;
  const ck = d.check;
  const clash = new Set((ck?.clashes ?? []).map(([r, c]) => `${r},${c}`));
  const cells = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const l = d.grid[r][c], m = d.marks[`${r},${c}`];
    const br = c < n - 1 && d.grid[r][c + 1] !== l ? " br" : "", bb = r < n - 1 && d.grid[r + 1][c] !== l ? " bb" : "";
    const bg = l ? `background:${REGION_COLORS[LETTERS.indexOf(l)]}` : "";
    cells.push(`<button class="ec${br}${bb}${l ? "" : " blank"}${clash.has(`${r},${c}`) ? " clash" : ""}" data-r="${r}" data-c="${c}" style="${bg}"
      aria-label="Row ${r + 1} column ${c + 1}${m === 2 ? ", star" : m === 1 ? ", crossed" : ""}">${m === 2 ? STAR : m === 1 ? "×" : ""}</button>`);
  }
  const b = ck?.busy ? { kind: "busy", title: "Checking…", text: "" } : ck?.verdict ?? { kind: "wait", title: "Paint every cell", text: "" };
  return `${head("Does this look right?", `Step 3 of 3 · ${what()}`, "photo")}${steps(3)}
    <div class="banner ${b.kind}" id="banner" role="status"><span class="dot" aria-hidden="true">${b.kind === "good" ? "✓" : b.kind === "bad" || b.kind === "warn" ? "!" : ""}</span>
      <span><b>${esc(b.title)}</b>${b.text ? `<small>${esc(b.text)}</small>` : ""}</span></div>
    <div class="eboard" id="eboard" style="--n:${n}; --cell:${cellPx(n)}px">${cells.join("")}</div>
    <div class="tools">
      <div class="seg mode"><button data-mode="paint" aria-pressed="${d.mode === "paint"}">Paint regions</button><button data-mode="marks" aria-pressed="${d.mode === "marks"}">Your marks</button></div>
      ${d.mode === "paint"
        ? `<div class="swatches">${Array.from({ length: n }, (_, i) => `<button class="sw" data-color="${i}" aria-pressed="${d.color === i}" aria-label="Colour ${i + 1}" style="background:${REGION_COLORS[i]}"></button>`).join("")}</div>
           <small style="color:var(--muted)">Pick a colour, then tap or drag across cells. Each colour is one region.</small>`
        : `<small style="color:var(--muted)">Tap a cell: × , then ★ , then empty. Add only marks you already have.</small>`}
    </div>
    <div class="twin"><button class="plain" data-act="undo" ${d.undo.length ? "" : "disabled"}>Undo</button>
      <button class="primary" data-act="start" ${b.kind === "good" || b.kind === "warn" ? "" : "disabled"}>${b.kind === "warn" ? "Start anyway" : "Looks right · start"}</button></div>`;
}

// Paint or mark one cell. Returns true if something changed.
function applyCell(r, c) {
  const d = draft, k = `${r},${c}`;
  if (d.mode === "paint") {
    const l = LETTERS[d.color];
    if (d.grid[r][c] === l) return false;
    d.grid[r][c] = l;
  } else {
    const next = ((d.marks[k] ?? 0) + 1) % 3; // empty → × → ★ → empty
    if (next) d.marks[k] = next; else delete d.marks[k];
  }
  return true;
}
const snapshot = () => JSON.stringify(draft.game === "sudoku" ? { givens: draft.givens, entries: draft.entries }
  : draft.game === "watersort" ? { tubes: draft.tubes } : { grid: draft.grid, marks: draft.marks });

// The live check: paint first, then count answers after a short pause (a 10×10 two-star board takes ~0.5s).
let checkTimer = 0;
function recheck() {
  clearTimeout(checkTimer);
  if (draft.game === "sudoku") return recheckSudoku();
  if (draft.game === "watersort") return recheckWater();
  const d = draft;
  const wasGood = d.check?.verdict?.kind === "good";
  const problem = boardProblem(d.grid, d.size);
  if (problem) { d.check = { verdict: problem }; return; }
  d.check = { busy: true };
  checkTimer = setTimeout(() => {
    const found = [];
    const count = countAnswers(regionsOf(d.grid), d.stars, 2, found);
    let verdict = answerVerdict(count), clashes = [];
    if (count === 1) {
      clashes = markClashes(d.marks, found[0]);
      // Wrong marks are fine to bring in (Colin 10/22: import where you really are); Hint points them out first.
      if (clashes.length) verdict = { kind: "warn", title: "Some of your marks look wrong", text: `The ringed cell${clashes.length === 1 ? "" : "s"} can't be right. Start anyway and Hint will show you why, or fix ${clashes.length === 1 ? "it" : "them"} now.` };
    }
    d.check = { verdict, solution: count === 1 ? found[0] : null, clashes };
    if (verdict.kind === "good" && !wasGood) haptic("success");
    if (at === "edit") render();
  }, 350);
}

// Sudoku: same number twice in a row, column or box shows red at once; then the printed numbers must have one answer.
// Your own numbers that disagree with it are a warning only (Hint points them out).
function recheckSudoku() {
  const d = draft;
  const wasGood = d.check?.verdict?.kind === "good";
  const board = d.givens.map((row, r) => row.map((v, c) => v || d.entries[`${r},${c}`] || 0));
  const clashes = sudokuClashes(board);
  const givenClash = sudokuClashes(d.givens).length > 0;
  const nGiven = d.givens.flat().filter(Boolean).length;
  if (givenClash) { d.check = { verdict: { kind: "bad", title: "Two printed numbers clash", text: "The same number is twice in a row, column or box (red)." }, clashes }; return; }
  if (nGiven < 17) { d.check = { verdict: { kind: "wait", title: "Add the printed numbers", text: `${nGiven} so far; a Sudoku needs at least 17.` }, clashes }; return; }
  d.check = { busy: true, clashes };
  checkTimer = setTimeout(() => {
    const found = [];
    const count = countSolutions(d.givens, 2, found);
    let verdict = count === 0 ? { kind: "bad", title: "No answer with these numbers", text: "Check the printed numbers against your photo." }
      : count > 1 ? { kind: "bad", title: "More than one answer", text: "A printed number may be missing or wrong." }
      : { kind: "good", title: "One answer, ready to solve", text: "" };
    const wrong = count === 1 ? sudokuWrong(d.entries, found[0]) : [];
    if (count === 1 && (wrong.length || clashes.length)) {
      verdict = { kind: "warn", title: "Some of your numbers look wrong", text: `The ringed cell${wrong.length === 1 ? "" : "s"} can't be right. Start anyway and Hint will show you, or fix ${wrong.length === 1 ? "it" : "them"} now.` };
    }
    d.check = { verdict, solution: count === 1 ? found[0] : null, clashes, wrong };
    if (verdict.kind === "good" && !wasGood) haptic("success");
    if (at === "edit") render();
  }, 300);
}

// Water Sort: each colour exactly 4 and room to move, then the solver tries to finish it (bounded).
function recheckWater() {
  const d = draft;
  const wasGood = d.check?.verdict?.kind === "good";
  const problem = waterProblem(d.tubes);
  if (problem) { d.check = { verdict: problem }; return; }
  if (isSolved(d.tubes)) { d.check = { verdict: { kind: "bad", title: "It's already sorted", text: "Fill the tubes as they are in your photo." } }; return; }
  d.check = { busy: true };
  checkTimer = setTimeout(() => {
    const sol = solve(d.tubes.map((t) => [...t]), 40000);
    const verdict = sol.kind === "solved" ? { kind: "good", title: "Solvable, ready", text: "" }
      : sol.kind === "stuck" ? { kind: "warn", title: "Couldn't find a way to finish this one", text: "Check the colours against your photo, or start anyway." }
      : { kind: "warn", title: "Couldn't check it all the way", text: "It's a big one. Check the colours, or start anyway." };
    d.check = { verdict };
    if (verdict.kind === "good" && !wasGood) haptic("success");
    if (at === "edit") render();
  }, 250);
}

// ---------- Render + events ----------
function render() {
  document.querySelector(".brandbar").hidden = at !== "list";
  $("view").innerHTML = at === "list" ? renderList() : at === "type" ? renderType() : at === "photo" ? renderPhoto() : renderEdit();
}
function go(next) {
  haptic("pick");
  at = next;
  $("view").classList.remove("enter");
  void $("view").offsetWidth;
  $("view").classList.add("enter");
  render();
  scrollTo(0, 0);
}

$("view").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled || b.classList.contains("ec")) return;
  const act = b.dataset.act;
  if (act === "new") { draft = { game: "starbattle", size: 8, stars: 1, mode: "paint", color: 0, marks: {}, undo: [], tubeCount: 14 }; go("type"); }
  else if (b.dataset.game && at === "type") { draft.game = b.dataset.game; haptic("tap"); render(); }
  else if (act === "fewer" || act === "more") { draft.tubeCount += act === "more" ? 1 : -1; haptic("tap"); render(); }
  else if (b.dataset.cell) { draft.sel = b.dataset.cell; haptic("tap"); render(); }
  else if (b.dataset.layer) { draft.layer = b.dataset.layer; haptic("tap"); render(); }
  else if (b.dataset.num) sudokuNumber(Number(b.dataset.num));
  else if (b.dataset.tube) { const i = Number(b.dataset.tube); draft.sel = draft.sel === i ? null : i; haptic("tap"); render(); }
  else if (b.dataset.wcolor) waterAdd(b.dataset.wcolor);
  else if (act === "pop") waterPop();
  else if (act === "list" || act === "type" || act === "photo") go(act);
  else if (act === "sort") { view.newest = !view.newest; haptic("tap"); render(); }
  else if (act === "filter") openFilter();
  else if (b.dataset.open) {
    const it = allImports(bundled).find((x) => x.id === b.dataset.open);
    haptic("thud");
    openGame(it?.game ?? "starbattle", `?import=${encodeURIComponent(b.dataset.open)}`);
  }
  else if (b.dataset.more) openMenu(b.dataset.more);
  else if (act === "smaller" || act === "bigger") {
    draft.size += act === "bigger" ? 1 : -1;
    draft.stars = Math.min(draft.stars, maxStars(draft.size));
    haptic("tap"); render();
  }
  else if (b.dataset.stars) { draft.stars = Number(b.dataset.stars); haptic("tap"); render(); }
  else if (act === "build" && draft.game === "sudoku") {
    if (draft.built !== "sudoku") {
      Object.assign(draft, { givens: Array.from({ length: 9 }, () => Array(9).fill(0)), entries: {}, layer: "given", sel: "0,0", undo: [], check: null, built: "sudoku" });
    }
    recheck();
    go("edit");
  }
  else if (act === "build" && draft.game === "watersort") {
    // A fresh set of empty tubes when the count changed; otherwise keep what you filled.
    if (draft.built !== "watersort" || draft.tubes.length !== draft.tubeCount) {
      Object.assign(draft, { tubes: Array.from({ length: draft.tubeCount }, () => []), sel: 0, undo: [], check: null, built: "watersort" });
    }
    recheck();
    go("edit");
  }
  else if (act === "build") {
    // A fresh blank board each time the size or stars changed; otherwise keep what you painted.
    if (draft.built !== "starbattle" || !draft.grid || draft.grid.length !== draft.size || draft.builtStars !== draft.stars) {
      draft.grid = Array.from({ length: draft.size }, () => Array(draft.size).fill(""));
      draft.marks = {}; draft.undo = []; draft.check = null; draft.color = 0;
    }
    draft.builtStars = draft.stars;
    draft.built = "starbattle";
    recheck();
    go("edit");
  }
  else if (b.dataset.mode) { draft.mode = b.dataset.mode; haptic("tap"); render(); }
  else if (b.dataset.color) { draft.color = Number(b.dataset.color); haptic("tap"); render(); }
  else if (act === "undo") {
    Object.assign(draft, JSON.parse(draft.undo.pop()));
    haptic("tap"); recheck(); render();
  }
  else if (act === "start") startImport();
});

// Painting: tap a cell, or press and drag across cells (one Undo for the whole drag). Marks: tap only.
let drag = null;
$("view").addEventListener("pointerdown", (e) => {
  const cell = e.target.closest(".ec");
  if (!cell || at !== "edit") return;
  e.preventDefault();
  const board = $("eboard");
  try { board.setPointerCapture(e.pointerId); } catch {}
  drag = { id: e.pointerId, before: snapshot(), changed: false, last: null };
  paintAt(cell);
});
addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id || draft.mode !== "paint") return;
  const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".ec");
  if (cell) paintAt(cell);
});
const endDrag = () => {
  if (!drag) return;
  if (drag.changed) { draft.undo.push(drag.before); recheck(); render(); }
  drag = null;
};
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", endDrag);
function paintAt(cell) {
  const key = `${cell.dataset.r},${cell.dataset.c}`;
  if (drag.last === key) return;
  drag.last = key;
  if (draft.mode === "marks" && drag.changed) return; // marks: one cell per tap
  if (!applyCell(Number(cell.dataset.r), Number(cell.dataset.c))) return;
  drag.changed = true;
  haptic("tap");
  draft.check = { busy: true };
  render();
}

// Sudoku: a number (0 = clear) into the picked cell, as printed or as yours. Printed cells keep their number in "Yours".
function sudokuNumber(n) {
  const d = draft;
  if (!d.sel) return;
  const [r, c] = d.sel.split(",").map(Number);
  const before = snapshot();
  if (d.layer === "given") {
    d.givens[r][c] = n;
    delete d.entries[d.sel];
  } else {
    if (d.givens[r][c]) return;
    if (n) d.entries[d.sel] = n; else delete d.entries[d.sel];
  }
  if (snapshot() === before) return;
  d.undo.push(before);
  haptic("tap");
  // Move on to the next cell, so a row can be typed straight through.
  if (n) { const k = r * 9 + c + 1; if (k < 81) d.sel = `${Math.floor(k / 9)},${k % 9}`; }
  recheck();
  render();
}
// Water Sort: add a colour on top of the picked tube, or take the top one off.
function waterAdd(color) {
  const d = draft;
  if (d.sel == null) return;
  const tube = d.tubes[d.sel];
  if (tube.length >= TUBE_CAP) { haptic("thud"); return; }
  d.undo.push(snapshot());
  tube.push(color);
  haptic("tap");
  recheck();
  render();
}
function waterPop() {
  const d = draft;
  if (d.sel == null || !d.tubes[d.sel].length) return;
  d.undo.push(snapshot());
  d.tubes[d.sel].pop();
  haptic("tap");
  recheck();
  render();
}

function startImport() {
  const d = draft;
  const id = `imp-${Date.now()}`;
  if (d.game === "sudoku") {
    if (!d.check?.solution) return;
    addImport({ id, game: "sudoku", size: 9, givens: d.givens.map((r) => [...r]), entries: { ...d.entries }, solution: d.check.solution,
      name: "Sudoku 9×9", addedAt: Date.now(), source: "hand" });
    return opened(id, "sudoku");
  }
  if (d.game === "watersort") {
    const kind = d.check?.verdict?.kind;
    if (kind !== "good" && kind !== "warn") return;
    addImport({ id, game: "watersort", tubes: d.tubes.map((t) => [...t]), colors: new Set(d.tubes.flat()).size,
      name: `Water Sort · ${d.tubes.length} tubes`, addedAt: Date.now(), source: "hand" });
    return opened(id, "watersort");
  }
  const sol = d.check?.solution;
  if (!sol) return;
  addImport({ id, game: d.game, size: d.size, stars: d.stars, regions: regionsOf(d.grid), marks: { ...d.marks }, solution: sol,
    name: `${GAME_NAMES[d.game]} ${d.size}×${d.size}`, addedAt: Date.now(), source: "hand" });
  opened(id, "starbattle");
}
function opened(id, game) {
  haptic("thud");
  draft = null;
  at = "list";
  render();
  openGame(game, `?import=${encodeURIComponent(id)}`);
}

// "…" on a hand-built import: Delete, after a second tap to be sure.
function openMenu(id) {
  haptic("pick");
  const it = allImports(bundled).find((x) => x.id === id);
  if (!it) return;
  const sheet = $("menu").querySelector(".sheet");
  const draw = (sure) => {
    sheet.innerHTML = `<div class="sheet-top"><h2>${esc(itemTitle(it))}</h2>
        <button class="x" data-act="close" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18"/></svg></button></div>
      <p>${sure ? "This removes the puzzle and your progress on it. It can't be undone." : `Added ${esc(new Date(it.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}, built by hand.`}</p>
      ${sure ? `<button class="menu-btn danger" data-act="delete">Delete it</button><button class="plain" data-act="close">Keep it</button>`
        : `<button class="plain" data-act="sure" style="color:#C23B2E">Delete…</button>`}`;
  };
  draw(false);
  $("menu").hidden = false;
  $("menu").onclick = (e) => {
    const act = e.target === $("menu") ? "close" : e.target.closest("button")?.dataset.act;
    if (act === "close") $("menu").hidden = true;
    else if (act === "sure") { haptic("tap"); draw(true); }
    else if (act === "delete") { deleteImport(id); haptic("thud"); $("menu").hidden = true; render(); }
  };
}
// While the pop-up is up, Apple's tab bar hides so it sits fully in front (as on Home).
new MutationObserver(() => post({ type: "tabbar", hidden: !$("menu").hidden })).observe($("menu"), { attributes: true, attributeFilter: ["hidden"] });

headerLogo($("logoBtn"), () => (inApp ? post({ type: "tab", name: "Library" }) : (location.href = "home.html")));
document.querySelector(".phone").insertAdjacentHTML("beforeend", tabs("import"));
smoothClose();
// Coming back from a game refreshes the list (In progress / Solved). A half-made import stays where you left it.
globalThis.sbRefresh = () => { if (at === "list") render(); };
addEventListener("storage", () => { if (at === "list") render(); });
addEventListener("pageshow", () => { if (at === "list") render(); });
render();
