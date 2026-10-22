// Import tab (approved mockups, canvas row "Import a puzzle", Colin 10/22): your imported puzzles by day added, and a
// new import: type and size → photo → "Does this look right?" (here also the hand builder) → play it. Star Battle first.
// The app can't read photos yet (no AI key): Colin sends the screenshot to Claude in chat and it lands in
// packs/imports.json. Rules: normal Star Battle rules for now; variant rules (a rules photo) come later.
import { countAnswers } from "../engine/starbattle/countAnswers.ts";
import { haptic, inApp, loadPack, openGame, post, savedGame, solves, smoothClose } from "./bridge.js";
import { $, LOOK, esc, fmt, gameIcon, headerLogo, tabs } from "./screens.js";
import { LETTERS, MAX_SIZE, MIN_SIZE, REGION_COLORS, addImport, allImports, answerVerdict, boardProblem, deleteImport,
  groupByDay, markClashes, maxStars } from "./importdata.js";

const bundled = (await loadPack("imports.json").catch(() => null))?.puzzles ?? [];
const GAME_NAMES = { starbattle: "Star Battle", sudoku: "Sudoku", watersort: "Water Sort" };
const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z" fill="#2A211B"/></svg>`;
const ICON = {
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5 M11 6l-6 6 6 6"/></svg>`,
  cam: (c) => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>`,
  plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14 M5 12h14"/></svg>`,
  down: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
  up: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2A211B" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`,
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
function rowNote(it, s) {
  const time = new Date(it.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const from = it.source === "claude" ? "from your screenshot" : "built by hand";
  if (s.state === "progress") {
    const stars = Object.values(s.saved.marks ?? {}).filter((v) => v === 2).length;
    return `Added ${time} · ${stars} of ${it.size * it.stars} stars`;
  }
  if (s.state === "solved") return `Added ${time} · solved in ${fmt(s.ms)}`;
  return `Added ${time} · ${from}`;
}
function renderList() {
  const items = allImports(bundled).filter((x) => view.game === "all" || x.game === view.game);
  const total = allImports(bundled).length;
  const groups = groupByDay(items, view.newest);
  let i = 0;
  return `<div class="bring">
      <span class="line"><span class="cam" aria-hidden="true">${ICON.cam("#1F57B5")}</span>
        <span class="grow"><b>Bring in a puzzle</b><small>Snap one you're stuck on. Keep playing here, or get a hint from right where you are.</small></span></span>
      <button class="primary" data-act="new">${ICON.plus}New import</button>
    </div>
    <div class="row-head"><span class="label">Your imports · ${total}</span>
      <button class="sort" data-act="sort" aria-label="Sort by day added, ${view.newest ? "newest" : "oldest"} first">Day added: ${view.newest ? "newest" : "oldest"}${view.newest ? ICON.down : ICON.up}</button></div>
    <div class="chips">${[["all", "All"], ["starbattle", "Star Battle"], ["sudoku", "Sudoku"], ["watersort", "Water Sort"]].map(([g, name]) =>
      `<button class="fchip" data-filter="${g}" aria-pressed="${view.game === g}">${name}</button>`).join("")}</div>
    ${groups.length ? groups.map((g) => `<div class="day"><span>${esc(g.day)}</span>${g.items.map((it) => {
      const s = itemState(it);
      return `<div class="imp" style="--i:${i++}">
        <button class="imp-open" data-open="${esc(it.id)}" aria-label="Open ${esc(it.name || GAME_NAMES[it.game])}">
          ${gameIcon(LOOK[it.game], 44, 22)}
          <span class="imp-text"><b>${GAME_NAMES[it.game]} ${it.size}×${it.size} · ${it.stars} star${it.stars === 1 ? "" : "s"}</b><small>${esc(rowNote(it, s))}</small></span>
          <span class="state ${s.state}">${s.state === "progress" ? "In progress" : s.state === "solved" ? "Solved" : "New"}</span>
        </button>
        ${it.source === "hand" ? `<button class="more" data-more="${esc(it.id)}" aria-label="More options">${ICON.dots}</button>` : `<span style="width:6px"></span>`}
      </div>`;
    }).join("")}</div>`).join("")
    : `<div class="card-glass empty">${total ? "None of those yet." : "Nothing imported yet. Tap New import to bring in your first puzzle."}</div>`}`;
}

// ---------- New import ----------
const steps = (n) => `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`;
const head = (title, sub, back) => `<header class="gp-head">
    <button class="sq glass" data-act="${back}" aria-label="Back">${ICON.back}</button>
    <div class="gp-title"><h1>${esc(title)}</h1><span>${esc(sub)}</span></div>
  </header>`;
const what = () => `${GAME_NAMES[draft.game]} ${draft.size}×${draft.size} · ${draft.stars} star${draft.stars === 1 ? "" : "s"}`;

function renderType() {
  const most = maxStars(draft.size);
  return `${head("New import", "Step 1 of 3 · what is it?", "list")}${steps(1)}
    <span class="label">Puzzle</span>
    <div class="types">
      <button class="type" aria-pressed="true">${gameIcon(LOOK.starbattle, 44, 24)}Star Battle</button>
      <button class="type" disabled aria-label="Sudoku, coming soon">${gameIcon(LOOK.sudoku, 44, 24)}Sudoku<small>Soon</small></button>
      <button class="type" disabled aria-label="Water Sort, coming soon">${gameIcon(LOOK.watersort, 44, 24)}Water Sort<small>Soon</small></button>
    </div>
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
    <button class="primary" data-act="photo">Next: the photo${ICON.next}</button>`;
}

function renderPhoto() {
  return `${head(what(), "Step 2 of 3 · the photo", "type")}${steps(2)}
    <div class="note"><span class="cam" aria-hidden="true">${ICON.chat}</span>
      <p><b>For now, send the screenshot to Claude in chat.</b> It reads the puzzle and adds it here, under Today, the next time the app updates. SolveBuddy will read photos by itself later.</p></div>
    <div class="note"><span class="cam" aria-hidden="true" style="background:#FBE3D6"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C24E2A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16z M14 6l3 3"/></svg></span>
      <p><b>Or build it by hand.</b> Paint the regions to match your puzzle and add any stars and × you already have. SolveBuddy checks it has one answer before you start.</p></div>
    <div style="flex:1"></div>
    <button class="primary" data-act="build">Build it by hand${ICON.next}</button>`;
}

// ---------- Editor: "Does this look right?" ----------
const cellPx = (n) => Math.min(44, Math.floor(340 / n));
function regionsOf(grid) { return grid.map((row) => row.join("")); }

function renderEdit() {
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
const snapshot = () => JSON.stringify({ grid: draft.grid, marks: draft.marks });

// The live check: paint first, then count answers after a short pause (a 10×10 two-star board takes ~0.5s).
let checkTimer = 0;
function recheck() {
  clearTimeout(checkTimer);
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
  if (act === "new") { draft = { game: "starbattle", size: 8, stars: 1, mode: "paint", color: 0, marks: {}, undo: [] }; go("type"); }
  else if (act === "list" || act === "type" || act === "photo") go(act);
  else if (act === "sort") { view.newest = !view.newest; haptic("tap"); render(); }
  else if (b.dataset.filter) { view.game = b.dataset.filter; haptic("tap"); render(); }
  else if (b.dataset.open) { haptic("thud"); openGame("starbattle", `?import=${encodeURIComponent(b.dataset.open)}`); }
  else if (b.dataset.more) openMenu(b.dataset.more);
  else if (act === "smaller" || act === "bigger") {
    draft.size += act === "bigger" ? 1 : -1;
    draft.stars = Math.min(draft.stars, maxStars(draft.size));
    haptic("tap"); render();
  }
  else if (b.dataset.stars) { draft.stars = Number(b.dataset.stars); haptic("tap"); render(); }
  else if (act === "build") {
    // A fresh blank board each time the size or stars changed; otherwise keep what you painted.
    if (!draft.grid || draft.grid.length !== draft.size || draft.builtStars !== draft.stars) {
      draft.grid = Array.from({ length: draft.size }, () => Array(draft.size).fill(""));
      draft.marks = {}; draft.undo = []; draft.check = null; draft.color = 0;
    }
    draft.builtStars = draft.stars;
    recheck();
    go("edit");
  }
  else if (b.dataset.mode) { draft.mode = b.dataset.mode; haptic("tap"); render(); }
  else if (b.dataset.color) { draft.color = Number(b.dataset.color); haptic("tap"); render(); }
  else if (act === "undo") {
    const prev = JSON.parse(draft.undo.pop());
    draft.grid = prev.grid; draft.marks = prev.marks;
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

function startImport() {
  const d = draft, sol = d.check?.solution;
  if (!sol) return;
  const id = `imp-${Date.now()}`;
  addImport({ id, game: d.game, size: d.size, stars: d.stars, regions: regionsOf(d.grid), marks: { ...d.marks }, solution: sol,
    name: `${GAME_NAMES[d.game]} ${d.size}×${d.size}`, addedAt: Date.now(), source: "hand" });
  haptic("thud");
  draft = null;
  at = "list";
  render();
  openGame("starbattle", `?import=${encodeURIComponent(id)}`);
}

// "…" on a hand-built import: Delete, after a second tap to be sure.
function openMenu(id) {
  haptic("pick");
  const it = allImports(bundled).find((x) => x.id === id);
  if (!it) return;
  const sheet = $("menu").querySelector(".sheet");
  const draw = (sure) => {
    sheet.innerHTML = `<div class="sheet-top"><h2>${esc(`${GAME_NAMES[it.game]} ${it.size}×${it.size}`)}</h2>
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
