// Groups page (Colin 11/6, mockup https://claude.ai/artifact/VXRHLipgS4hsHdEqGSAUqM): make your own word groups, tap a word to see
// every group it's in, and play games built from your live groups. Rules in engine/groups/game.ts.
import { MAX, MIN, SIZE, STARTERS, bestFour, cleanWords, deal, inGroups, same, shuffled, traps } from "../engine/groups/game.ts";
import { goHome, haptic } from "./bridge.js";
import { celebrate } from "./celebrate.js";

const KEY = "solvebuddy.groups";
const COLORS = ["Easy", "Medium", "Hard", "Tricky"];
const color = (d) => `var(--d${d})`;
const $ = (x) => document.getElementById(x);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const has = (t, q) => t.toLowerCase().includes(q.trim().toLowerCase());
const SEARCH = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>';
const FILTER = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg>';
const BACK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';

let store = { groups: STARTERS.map((g) => ({ ...g, words: [...g.words] })), games: [], next: 9 };
try { store = { ...store, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };
const groups = () => store.groups;
let tab = "groups", screen = null, play = null, addQ = "", sure = false;
const ui = { groups: { q: "", s: false, f: false, d: [], trap: false }, words: { q: "", s: false, f: false, d: [], trap: false }, create: { q: "", s: false, f: false, d: [], trap: false } };
const allWords = () => {
  const m = new Map();
  groups().forEach((g) => g.words.forEach((w) => { const k = w.toLowerCase(); if (!m.has(k)) m.set(k, { word: w, gs: [] }); m.get(k).gs.push(g); }));
  return [...m.values()].sort((a, b) => b.gs.length - a.gs.length || a.word.localeCompare(b.word));
};
const groupTrap = (g) => g.words.some((w) => inGroups(groups(), w).length > 1);
const head = (title) => {
  const u = ui[tab], hot = u.d.length || u.trap;
  return `<div class="ghead"><button class="sq glass" data-home aria-label="Back to library">${BACK}</button><h1>${title}</h1><button class="gib ${u.s || u.q ? "on" : ""}" data-tog="s" aria-label="Search" aria-pressed="${u.s}">${SEARCH}</button><button class="gib ${u.f || hot ? "on" : ""}" data-tog="f" aria-label="Filter" aria-pressed="${u.f}">${FILTER}</button></div>
  ${u.s ? `<input id="q" value="${esc(u.q)}" placeholder="Search" aria-label="Search">` : ""}
  ${u.f ? `<div class="gchips">${tab === "create" ? "" : COLORS.map((n, i) => `<button class="gchip ${u.d.includes(i) ? "on" : ""}" data-fd="${i}" style="background:${color(i)};color:#2A211B" aria-pressed="${u.d.includes(i)}">${n}</button>`).join("")}<button class="gchip ${u.trap ? "on" : ""}" data-ft aria-pressed="${u.trap}">Traps only</button></div>` : ""}`;
};
const groupRow = (g) => `<button class="grow" data-open="${g.id}"><span class="gdot" style="background:${color(g.d)}"></span><span><b>${esc(g.name)}</b><small>${g.words.map(esc).join(", ") || "No words yet"}</small></span></button>`;
function listGroups() {
  const u = ui.groups, l = groups().filter((g) => (!u.q || has(g.name, u.q) || g.words.some((w) => has(w, u.q))) && (!u.d.length || u.d.includes(g.d)) && (!u.trap || groupTrap(g)));
  return l.map(groupRow).join("") || `<p class="gempty">No groups match.</p>`;
}
function listWords() {
  const u = ui.words, l = allWords().filter(({ word, gs }) => (!u.q || has(word, u.q)) && (!u.d.length || gs.some((g) => u.d.includes(g.d))) && (!u.trap || gs.length > 1));
  return l.map(({ word, gs }) => `<button class="grow" style="grid-template-columns:${gs.length * 8 + (gs.length - 1) * 3}px minmax(0,1fr)" data-word="${esc(word)}"><span style="display:flex;gap:3px">${gs.map((g) => `<span class="gdot" style="width:8px;background:${color(g.d)}"></span>`).join("")}</span><span><b>${esc(word)}</b><small>${gs.length > 1 ? `Trap: in ${gs.length} groups` : esc(gs[0].name)}</small></span></button>`).join("") || `<p class="gempty">No words match.</p>`;
}
const gameGroups = (x) => x.ids.map((v) => groups().find((g) => g.id === v)).filter(Boolean);
function listGames() {
  const u = ui.create;
  if (!store.games.length) return "";
  const l = store.games.map((x, i) => ({ x, i, set: gameGroups(x) })).filter(({ x, set }) => (!u.q || has(x.name, u.q) || set.some((g) => has(g.name, u.q))) && (!u.trap || traps(set) > 0));
  return l.map(({ x, i, set }) => `<button class="grow" data-game="${i}"><span class="gdot" style="background:var(--line)"></span><span><b>${esc(x.name)}</b><small>${set.map((g) => esc(g.name)).join(", ")}${set.length < SIZE ? " · needs another group" : ""}</small></span></button>`).join("") || `<p class="gempty">No games match.</p>`;
}
function listAdd(rest) {
  const l = rest.filter((g) => !addQ || has(g.name, addQ));
  return l.map((g) => `<button class="grow" data-addto="${g.id}"><span class="gdot" style="background:${color(g.d)}"></span><span><b>${esc(g.name)}</b></span></button>`).join("") || `<p class="gempty">No groups match.</p>`;
}
const viewGroups = () => `${head("Groups")}<div class="glist" id="list">${listGroups()}</div><button class="gbtn go" data-new>New group</button>`;
const viewWords = () => `${head("Words")}<div class="glist" id="list">${listWords()}</div>`;
function viewEdit(g) {
  return `<button class="sq glass gback" data-back aria-label="Back">${BACK}</button>
  <label>Group name<input id="gname" value="${esc(g.name)}"></label>
  <label>Difficulty<span class="gcolors">${COLORS.map((n, i) => `<button class="gc ${g.d === i ? "on" : ""}" data-d="${i}" style="background:${color(i)}" aria-pressed="${g.d === i}">${n}</button>`).join("")}</span></label>
  <label>Words${g.words.map((w, i) => `<span class="gw"><input data-w="${i}" value="${esc(w)}" aria-label="Word ${i + 1}"><button class="gmore" data-word="${esc(w)}" ${w ? "" : "disabled"}>${w && inGroups(groups(), w).length > 1 ? `In ${inGroups(groups(), w).length}` : w ? "Open" : ""}</button></span>`).join("")}</label>
  ${g.words.length < MAX ? `<button class="gbtn" data-add>Add a word</button>` : ""}
  <button class="gbtn go" data-save>Save</button><button class="gbtn bad" data-del>${sure ? "Tap again to delete" : "Delete group"}</button>`;
}
function viewWord(w) {
  const gs = inGroups(groups(), w), rest = groups().filter((g) => !gs.includes(g) && g.words.length < MAX);
  return `<button class="sq glass gback" data-back aria-label="Back">${BACK}</button>
  <input class="big" id="wname" value="${esc(w)}" aria-label="Word">
  <h2>In ${gs.length} group${gs.length === 1 ? "" : "s"}</h2>
  ${gs.map((g) => `<div class="grow"><span class="gdot" style="background:${color(g.d)}"></span><span><b>${esc(g.name)}</b><small>${g.words.map((x) => (same(x, w) ? `<span class="gmark" style="background:${color(g.d)}">${esc(x)}</span>` : esc(x))).join(", ")}</small><button class="grm" data-rm="${g.id}">Remove from this group</button></span></div>`).join("")}
  ${rest.length ? `<h2>Add to another group</h2><input id="addq" value="${esc(addQ)}" placeholder="Search your groups" aria-label="Search your groups"><div class="glist" id="addlist">${listAdd(rest)}</div>` : ""}`;
}
function viewCreate() {
  const can = groups().filter((g) => g.words.length >= MIN).length >= SIZE;
  return `${head("Create game")}<button class="gbtn go" data-random ${can ? "" : "disabled"}>Play a random game</button><p class="gnote">${can ? "Picks 4 of your groups, with the most traps it can find." : "You need 4 groups with at least 4 words."}</p>
  ${store.games.length ? `<h2>Your games, which update when you edit your groups</h2>` : ""}<div class="glist" id="list">${listGames()}</div>
  <button class="gbtn" data-make>Make a game</button>`;
}
function viewMake() {
  const sel = screen.sel, set = groups().filter((g) => sel.includes(g.id));
  return `<button class="sq glass gback" data-back aria-label="Back">${BACK}</button><div class="ghead"><h1>Pick 4 groups</h1></div><p class="gnote">${sel.length} of 4 picked${sel.length === SIZE ? ` · ${traps(set)} trap${traps(set) === 1 ? "" : "s"}` : ""}</p>
  ${screen.bad ? `<p class="gnote">These groups share too many words for a board with one answer. Try another mix.</p>` : ""}
  ${groups().map((g) => `<button class="grow gpick" data-sel="${g.id}" ${g.words.length < MIN ? "disabled" : ""} aria-pressed="${sel.includes(g.id)}"><span class="gdot" style="background:${color(g.d)}"></span><span><b>${esc(g.name)}</b><small>${g.words.length} word${g.words.length === 1 ? "" : "s"}</small></span><span class="gtick">${sel.includes(g.id) ? "✓" : ""}</span></button>`).join("")}
  <button class="gbtn go" data-savegame ${sel.length === SIZE ? "" : "disabled"}>Save game</button>`;
}
function viewPlay() {
  if (play.fail) return `<button class="sq glass gback" data-back aria-label="Back">${BACK}</button><p class="gnote">These groups share too many words for a board with one answer. Add more words, or pick another group.</p>`;
  return `<button class="sq glass gback" data-back aria-label="Back">${BACK}</button><div class="ghead"><h1>Find 4 groups</h1></div>
  ${play.solved.map((x) => `<div class="gsolved" style="background:${color(x.g.d)}">${esc(x.g.name)}<small>${x.words.map(esc).join(", ")}</small></div>`).join("")}
  <div class="gtiles" id="tiles">${play.left.map((w) => `<button class="gt ${play.sel.includes(w) ? "on" : ""}" data-t="${esc(w)}" aria-pressed="${play.sel.includes(w)}">${esc(w)}</button>`).join("")}</div>
  <p class="gsay" id="say">${esc(play.say)}</p>${play.left.length ? `<button class="gbtn go" data-check ${play.sel.length === SIZE ? "" : "disabled"}>Check</button><button class="gbtn" data-mix>Shuffle</button>` : ""}`;
}
function draw() {
  $("bar").innerHTML = [["groups", "Groups"], ["words", "Words"], ["create", "Create game"]].map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}" ${tab === k ? 'aria-current="page"' : ""}>${n}</button>`).join("");
  const v = $("view"), top = v.scrollTop;
  v.innerHTML = !screen ? { groups: viewGroups, words: viewWords, create: viewCreate }[tab]() : screen.k === "edit" ? viewEdit(screen.g) : screen.k === "word" ? viewWord(screen.w) : screen.k === "make" ? viewMake() : viewPlay();
  v.scrollTop = screen?.k === "play" ? 0 : top;
}
function start(set) {
  const dealt = set && deal(set);
  play = dealt ? { dealt, left: shuffled(dealt.flatMap((x) => x.words), Math.random), sel: [], solved: [], say: "", at: Date.now() } : { fail: true };
  screen = { k: "play" };
  v0();
  draw();
}
const v0 = () => { $("view").scrollTop = 0; };
function readEdit() {
  const g = screen.g;
  g.name = $("gname").value.trim() || g.name;
  document.querySelectorAll("[data-w]").forEach((i) => { g.words[Number(i.dataset.w)] = i.value.trim(); });
}
function commit() {
  const s = screen.g, live = groups().find((g) => g.id === s.id), row = { ...s, words: cleanWords(s.words) };
  if (live) Object.assign(live, row); else store.groups.push(row);
  save();
}
function rename(from, to) {
  if (!to || same(from, to)) return from;
  groups().forEach((g) => { g.words = cleanWords(g.words.map((w) => (same(w, from) ? to : w))); });
  save();
  return to;
}
function check() {
  const hit = play.dealt.find((x) => x.words.every((w) => play.sel.includes(w)));
  if (hit) {
    haptic("success");
    play.solved.push(hit);
    play.left = play.left.filter((w) => !hit.words.includes(w));
    play.sel = [];
    play.say = "";
    draw();
    if (!play.left.length) celebrate({ title: "Groups", level: "", facts: { ms: Date.now() - play.at, hints: 0 }, hasNext: true, onNext: () => start(bestFour(groups())), delay: 700 });
    return;
  }
  const near = play.dealt.some((x) => x.words.filter((w) => play.sel.includes(w)).length === SIZE - 1);
  play.say = near ? "One away" : "Not a group";
  haptic("warn");
  draw();
  document.querySelectorAll(".gt.on").forEach((t) => t.classList.add("bump"));
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !$("view")) return;
  const d = b.dataset;
  if (d.home !== undefined) return goHome();
  if (d.tab !== undefined) { tab = d.tab; screen = null; play = null; v0(); return draw(); }
  if (d.tog !== undefined) {
    const u = ui[tab];
    if (d.tog === "s") { u.s = !u.s; if (!u.s) u.q = ""; } else u.f = !u.f;
    draw();
    if (u.s && d.tog === "s") $("q")?.focus();
    return;
  }
  if (d.fd !== undefined) { const u = ui[tab], v = Number(d.fd); u.d = u.d.includes(v) ? u.d.filter((x) => x !== v) : [...u.d, v]; return draw(); }
  if (d.ft !== undefined) { ui[tab].trap = !ui[tab].trap; return draw(); }
  if (d.back !== undefined) {
    if (screen?.k === "word" && screen.from) {
      const live = groups().find((g) => g.id === screen.from.g.id);
      screen = live ? { k: "edit", g: { ...live, words: [...live.words] } } : null;
    } else screen = null;
    v0();
    return draw();
  }
  if (d.open !== undefined) { const g = groups().find((x) => x.id === Number(d.open)); sure = false; screen = { k: "edit", g: { ...g, words: [...g.words] } }; v0(); return draw(); }
  if (d.new !== undefined) { sure = false; screen = { k: "edit", g: { id: store.next++, name: "", d: 0, words: ["", "", "", ""] } }; v0(); draw(); $("gname")?.focus(); return; }
  if (d.d !== undefined) { readEdit(); screen.g.d = Number(d.d); return draw(); }
  if (d.add !== undefined) { readEdit(); screen.g.words.push(""); return draw(); }
  if (d.save !== undefined) { readEdit(); if (!screen.g.name) return $("gname").focus(); commit(); screen = null; v0(); return draw(); }
  if (d.del !== undefined) {
    if (!sure) { sure = true; readEdit(); return draw(); }
    store.groups = groups().filter((g) => g.id !== screen.g.id);
    save();
    screen = null;
    return draw();
  }
  if (d.word !== undefined) {
    let from = null;
    if (screen?.k === "edit") { readEdit(); if (screen.g.name) commit(); from = screen; }
    addQ = "";
    screen = { k: "word", w: d.word, from };
    v0();
    return draw();
  }
  if (d.rm !== undefined) { const g = groups().find((x) => x.id === Number(d.rm)); g.words = g.words.filter((w) => !same(w, screen.w)); save(); if (!inGroups(groups(), screen.w).length) screen = null; return draw(); }
  if (d.addto !== undefined) { groups().find((x) => x.id === Number(d.addto)).words.push(screen.w); save(); return draw(); }
  if (d.random !== undefined) return start(bestFour(groups()));
  if (d.game !== undefined) { const set = gameGroups(store.games[Number(d.game)]); return set.length === SIZE ? start(set) : undefined; }
  if (d.make !== undefined) { screen = { k: "make", sel: [] }; v0(); return draw(); }
  if (d.sel !== undefined) { const v = Number(d.sel), s = screen.sel; if (s.includes(v)) screen.sel = s.filter((x) => x !== v); else if (s.length < SIZE) s.push(v); screen.bad = false; return draw(); }
  if (d.savegame !== undefined) {
    const set = groups().filter((g) => screen.sel.includes(g.id));
    if (!deal(set)) { screen.bad = true; return draw(); }
    store.games.push({ name: `Game ${store.games.length + 1}`, ids: screen.sel });
    save();
    screen = null;
    return draw();
  }
  if (d.t !== undefined) { const s = play.sel, w = d.t; play.sel = s.includes(w) ? s.filter((x) => x !== w) : s.length < SIZE ? [...s, w] : s; play.say = ""; haptic("tap"); return draw(); }
  if (d.mix !== undefined) { play.left = shuffled(play.left, Math.random); return draw(); }
  if (d.check !== undefined) return check();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "q") { ui[tab].q = e.target.value; $("list").innerHTML = { groups: listGroups, words: listWords, create: listGames }[tab](); }
  if (e.target.id === "addq") { addQ = e.target.value; const gs = inGroups(groups(), screen.w); $("addlist").innerHTML = listAdd(groups().filter((g) => !gs.includes(g) && g.words.length < MAX)); }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "wname" && screen?.k === "word") { screen.w = rename(screen.w, e.target.value.trim()); draw(); }
});
draw();
