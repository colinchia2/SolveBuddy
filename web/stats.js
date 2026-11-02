// Stats tab (Colin 11/1, the "mix" mockup): this week + weekly streak on top, then a filter (All or one puzzle) that
// changes everything below: how much you play, how fast you are, what you're good at, hints, and tips.
// Everything comes from the solve log on this phone (bridge.js). The tips are plain rules run here, no AI.
import { GAMES, inApp, post, solves } from "./bridge.js";
import { syncStatus } from "./sync.js";
import { $, LOOK, WEEK_GOAL, dayKey, esc, fmt, headerLogo, streaks, tabs, weekCounts, weekKey, weekStart } from "./screens.js";

const LEVELS = ["Easy", "Medium", "Hard", "Expert"];
const DAY = 864e5;
const NOT_TRICKS = new Set(["", "Check this", "Wrong patch"]); // mistakes and "done" aren't tricks
let filter = "all";

// A pack's own name: "Starter · Easy", "5×5 · Easy", "Trick tests"; anything not in GAMES (imports) is "Imported".
function packInfo(g, pack) {
  const row = GAMES[g]?.packs.find((p) => p[0] === pack);
  if (!row) return { label: "Imported", level: null, order: 99 };
  const set = GAMES[g].sets.find((s) => s.levels.includes(pack));
  const level = LEVELS.includes(row[2]) ? row[2] : null;
  const label = !set || set.name === row[2] || (set.name === "Starter" && level) ? row[2] : level ? `${set.name} · ${level}` : set.name;
  return { label, level, order: GAMES[g].packs.indexOf(row) };
}
const hintFree = (e) => !(e.hints > 0.01);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const card = (inner, cls = "") => `<section class="card-glass st ${cls}">${inner}</section>`;
const head = (t, sub) => `<h2 class="st-h">${t}</h2>${sub ? `<p class="st-sub">${sub}</p>` : ""}`;
const emptyNote = (t) => `<p class="st-empty">${t}</p>`;

// A ring cut in thirds: one third per puzzle (colors = what fills each third), with a check in the middle when done.
function thirds(size, stroke, fills, empty, check) {
  const c = size / 2, r = c - stroke / 2 - 1, gap = 0.22;
  const pt = (a) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`;
  let o = "";
  for (let i = 0; i < 3; i++) {
    const a0 = (i * 2 * Math.PI) / 3 + gap / 2, a1 = ((i + 1) * 2 * Math.PI) / 3 - gap / 2;
    o += `<path d="M${pt(a0)}A${r} ${r} 0 0 1 ${pt(a1)}" fill="none" stroke="${fills[i] || empty}" stroke-width="${stroke}" stroke-linecap="round"/>`;
  }
  if (check) o += `<circle cx="${c}" cy="${c}" r="${r - stroke / 2 - 2}" fill="#fff"/><path d="M${c - r * 0.32} ${c + r * 0.02}l${r * 0.22} ${r * 0.22}l${r * 0.42} -${r * 0.44}" fill="none" stroke="var(--brand)" stroke-width="${Math.max(2, size / 14)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${o}</svg>`;
}

function hero(log, now) {
  const wk = log.filter((e) => weekKey(e.at) === weekKey(now)).sort((a, b) => a.at - b.at);
  const start = weekStart(now), end = start + 6 * DAY;
  const range = `${new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const done = wk.length >= WEEK_GOAL, today = (new Date(now).getDay() + 6) % 7;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => {
    const ss = wk.filter((e) => dayKey(e.at) === dayKey(start + i * DAY + 3 * 36e5));
    return `<div class="hd-day${i === today ? " today" : ""}${i > today ? " later" : ""}" aria-label="${d}: ${plural(ss.length, "puzzle")}"><span>${d}</span>
      ${thirds(38, 6, ss.slice(0, 3).map((e) => LOOK[e.g]?.bg), "rgba(255,255,255,0.22)", false)}<small>${ss.length || ""}</small></div>`;
  }).join("");
  const counts = weekCounts(log);
  const past = Array.from({ length: 8 }, (_, i) => {
    const n = counts[weekKey(start - (7 - i) * 7 * DAY)] ?? 0;
    return thirds(24, 4, [0, 1, 2].map((j) => (j < n ? "#fff" : null)), "rgba(255,255,255,0.25)", n >= WEEK_GOAL);
  }).join("");
  const { current, best } = streaks(log, now);
  const streakTxt = current ? `<b>${current}-week streak</b>best: ${best}` : `<b>No streak yet</b>${WEEK_GOAL} puzzles in a week starts one`;
  return `<section class="st-hero" id="week">
    <div class="hd-top"><div><h2>This week</h2><p>${range} · goal: ${WEEK_GOAL} puzzles</p></div>
      <div class="hd-goal">${thirds(58, 7, [0, 1, 2].map((j) => (j < wk.length ? "#fff" : null)), "rgba(255,255,255,0.25)", done)}<small>${Math.min(wk.length, WEEK_GOAL)} of ${WEEK_GOAL} done</small></div></div>
    <div class="hd-days">${days}</div>
    <div class="hd-weeks">${past}<div class="hd-streak" id="streakTxt">${streakTxt}</div></div></section>`;
}

function chips() {
  return `<div class="st-chips" role="tablist" aria-label="Show stats for">${[["all", "All"], ...Object.entries(GAMES).map(([g, v]) => [g, v.name])].map(([k, n]) =>
    `<button class="st-chip${filter === k ? " on" : ""}" role="tab" aria-selected="${filter === k}" data-f="${k}">${k === "all" ? "" : `<i style="background:${LOOK[k].ink}"></i>`}${n}</button>`).join("")}</div>`;
}

function playCard(F, now) {
  const start = weekStart(now) - 11 * 7 * DAY;
  const recent = F.filter((e) => e.at >= start);
  const per = Array.from({ length: 12 }, (_, w) => recent.filter((e) => Math.round((weekStart(e.at) - start) / (7 * DAY)) === w));
  const max = Math.max(1, ...per.map((p) => p.length));
  const W = 326, H = 110, bw = 18, gap = (W - 24 - 12 * bw) / 11;
  let bars = "";
  per.forEach((p, w) => {
    let y = H; const x = 24 + w * (bw + gap);
    for (const g of Object.keys(GAMES)) {
      const k = p.filter((e) => e.g === g).length; if (!k) continue;
      const h = (k / max) * (H - 8);
      bars += `<rect x="${x}" y="${(y - h + 1).toFixed(1)}" width="${bw}" height="${Math.max(h - 2, 2).toFixed(1)}" rx="3" fill="${LOOK[g].ink}"/>`; y -= h;
    }
    if (w % 3 === 2 || w === 11) bars += `<text x="${w === 11 ? x + bw : x + bw / 2}" y="${H + 14}" text-anchor="${w === 11 ? "end" : "middle"}" font-size="9.5" fill="var(--muted)">${w === 11 ? "This wk" : new Date(start + w * 7 * DAY).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text>`;
  });
  const games = Object.keys(GAMES).filter((g) => recent.some((e) => e.g === g));
  return card(`<div class="st-big">${recent.length}</div><p class="st-sub">${recent.length === 1 ? "puzzle" : "puzzles"} solved in the last 12 weeks</p>
    <svg viewBox="0 0 ${W} ${H + 18}" width="100%" role="img" aria-label="Puzzles per week"><text x="0" y="10" font-size="9.5" fill="var(--muted)">${max}</text>
    <line x1="20" x2="${W}" y1="${H + 1}" y2="${H + 1}" stroke="rgba(42,33,27,0.12)"/>${bars}</svg>
    <div class="st-legend">${games.map((g) => `<span><i style="background:${LOOK[g].ink}"></i>${GAMES[g].name}</span>`).join("")}</div>`, "play");
}

function heatCard(F, now) {
  const start = weekStart(now) - 11 * 7 * DAY, per = {};
  for (const e of F) per[dayKey(e.at)] = (per[dayKey(e.at)] ?? 0) + 1;
  const SH = ["rgba(42,33,27,0.07)", "#B9CFF2", "#7EA6E8", "#2F6FD6"];
  const cs = 22, g = 4; let o = "";
  ["M", "", "W", "", "F", "", "S"].forEach((d, i) => { if (d) o += `<text x="0" y="${i * (cs + g) + cs * 0.7}" font-size="10" fill="var(--muted)">${d}</text>`; });
  for (let w = 0; w < 12; w++) for (let d = 0; d < 7; d++) {
    const t = start + (w * 7 + d) * DAY + 3 * 36e5, later = t > now;
    o += later ? `<rect x="${24 + w * (cs + g) + 0.5}" y="${d * (cs + g) + 0.5}" width="${cs - 1}" height="${cs - 1}" rx="5" fill="none" stroke="rgba(42,33,27,0.12)" stroke-dasharray="2 2"/>`
      : `<rect x="${24 + w * (cs + g)}" y="${d * (cs + g)}" width="${cs}" height="${cs}" rx="5" fill="${SH[Math.min(per[dayKey(t)] ?? 0, 3)]}"/>`;
  }
  return card(`${head("Days you played", "Darker = more puzzles that day")}<svg viewBox="0 0 ${24 + 12 * (cs + g)} ${7 * (cs + g)}" width="100%" role="img" aria-label="Days you played, last 12 weeks">${o}</svg>
    <div class="st-legend">${SH.map((c, i) => `<span><i style="background:${c}"></i>${i === 3 ? "3+" : i}</span>`).join("")}</div>`);
}

function clockCard(F) {
  if (!F.length) return card(`${head("When you play")}${emptyNote("Solve a puzzle and your hours show up here.")}`);
  const hrs = Array(24).fill(0); F.forEach((e) => hrs[new Date(e.at).getHours()]++);
  const max = Math.max(...hrs), top = hrs.indexOf(max), lab = (h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  const S = 220, c = S / 2, r0 = 44, r1 = 96; let o = `<circle cx="${c}" cy="${c}" r="${r0 - 6}" fill="rgba(42,33,27,0.05)"/>`;
  for (let h = 0; h < 24; h++) {
    const a = (h / 24) * 2 * Math.PI, len = hrs[h] ? 6 + ((r1 - r0 - 6) * hrs[h]) / max : 3;
    o += `<line x1="${(c + r0 * Math.sin(a)).toFixed(1)}" y1="${(c - r0 * Math.cos(a)).toFixed(1)}" x2="${(c + (r0 + len) * Math.sin(a)).toFixed(1)}" y2="${(c - (r0 + len) * Math.cos(a)).toFixed(1)}" stroke="${hrs[h] ? "var(--brand)" : "rgba(42,33,27,0.12)"}" stroke-width="7" stroke-linecap="round" opacity="${hrs[h] ? (0.35 + (0.65 * hrs[h]) / max).toFixed(2) : 1}"/>`;
  }
  [["12am", 0], ["6am", 6], ["12pm", 12], ["6pm", 18]].forEach(([t, h]) => { const a = (h / 24) * 2 * Math.PI; o += `<text x="${(c + (r0 - 18) * Math.sin(a)).toFixed(1)}" y="${(c - (r0 - 18) * Math.cos(a) + 3.5).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="600" fill="var(--body)">${t}</text>`; });
  return card(`${head("When you play", `Mostly around ${lab(top)}`)}<svg viewBox="0 0 ${S} ${S}" width="100%" class="st-clock" role="img" aria-label="Puzzles by hour of the day">${o}</svg>`);
}

function groups(F) {
  const out = {};
  for (const e of F) (out[`${e.g}|${e.pack}`] ??= []).push(e);
  return Object.entries(out).map(([k, ss]) => { const [g, pack] = k.split("|"); return { g, pack, ss, ...packInfo(g, pack) }; });
}

function podiumCard(F, one) {
  const top = groups(F).sort((a, b) => b.ss.length - a.ss.length).slice(0, 3);
  if (!top.length) return card(`${head("Your podium")}${emptyNote("Your most-played puzzles stand here.")}`);
  const medal = ["#C99A1B", "#8E98A8", "#B06A3A"], hts = [126, 102, 86];
  const pod = [1, 0, 2].map((i) => {
    const t = top[i]; if (!t) return "<div></div>";
    return `<div class="pod"><span class="pod-m" style="background:${medal[i]}">${i + 1}</span><b>${esc(one ? t.label : GAMES[t.g].name)}</b><small>${one ? "" : esc(t.label)}</small>
      <div class="pod-step" style="height:${hts[i]}px;background:${LOOK[t.g].ink}"><strong>${t.ss.length}</strong><span>solved</span><span class="pod-best">best ${fmt(Math.min(...t.ss.map((e) => e.ms)))}</span></div></div>`;
  }).join("");
  return card(`${head("Your podium", `Most-played ${one ? "packs" : "puzzles"}, with your fastest time`)}<div class="podium" id="podium">${pod}</div>`);
}

const STAR = (x, y, R, fill) => { let d = ""; for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.45 : R, a = (i * Math.PI) / 5; d += `${i ? "L" : "M"}${(x + r * Math.sin(a)).toFixed(1)} ${(y - r * Math.cos(a)).toFixed(1)}`; } return `<path d="${d}Z" fill="${fill}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`; };

function speedCard(F, one) {
  let rows = groups(F).filter((r) => r.ss.length >= 2);
  if (!one) { const by = {}; for (const r of rows) if (!by[r.g] || r.ss.length > by[r.g].ss.length) by[r.g] = r; rows = Object.values(by); }
  rows.sort((a, b) => (one ? a.order - b.order : b.ss.length - a.ss.length));
  const sub = `Fastest to slowest, for each ${one ? "pack" : "puzzle's most-played level"}`;
  if (!rows.length) return card(`${head("How fast you are", sub)}${emptyNote("Solve the same level twice and your times show up here.")}`, "speed");
  const W = 326, rowH = 54, L = 8, R = W - 8;
  const o = rows.map((r, i) => {
    const y0 = i * rowH, y = y0 + 34, ms = r.ss.map((e) => e.ms), lo = Math.min(...ms), hi = Math.max(...ms), avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    const X = (v) => L + 14 + ((R - L - 28) * (v - lo)) / (hi - lo || 1), ink = LOOK[r.g].ink;
    const name = one ? r.label : `${GAMES[r.g].name}${r.level ? ` · ${r.level}` : ""}`;
    return `<text x="${L}" y="${y0 + 14}" font-size="12.5" font-weight="600" fill="var(--ink)">${esc(name)}</text>
      <text x="${R}" y="${y0 + 14}" font-size="11.5" text-anchor="end" fill="var(--muted)"><tspan fill="${ink}" font-weight="700">best ${fmt(lo)}</tspan>  ·  avg ${fmt(avg)}</text>
      <line x1="${X(lo)}" x2="${X(hi)}" y1="${y}" y2="${y}" stroke="${LOOK[r.g].bg}" stroke-width="12" stroke-linecap="round"/>
      ${ms.map((m) => `<circle cx="${X(m).toFixed(1)}" cy="${y}" r="2.6" fill="${ink}" opacity="0.45"/>`).join("")}
      <line x1="${X(avg).toFixed(1)}" x2="${X(avg).toFixed(1)}" y1="${y - 10}" y2="${y + 10}" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>${STAR(X(lo), y, 10, ink)}`;
  }).join("");
  return card(`${head("How fast you are", sub)}<svg viewBox="0 0 ${W} ${rows.length * rowH}" width="100%" role="img" aria-label="Your best and average times">${o}</svg>
    <div class="st-legend"><span><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8 5.7 21.5l1.7-7.3L2 9.5l7.1-.6z" fill="var(--body)"/></svg>your best</span><span><i style="width:3px;height:12px;background:var(--ink)"></i>your average</span><span><i style="width:16px;background:rgba(42,33,27,0.1)"></i>fastest to slowest</span></div>
    ${fasterRows(F, one)}`, "speed");
}

// Getting faster: each solve as a share of that pack's usual (median) time, averaged per two weeks; first vs last.
function fasterRows(F, one) {
  const med = {};
  for (const r of groups(F)) { const s = r.ss.map((e) => e.ms).sort((a, b) => a - b); med[`${r.g}|${r.pack}`] = s[Math.floor(s.length / 2)]; }
  const now = Date.now(), rows = [];
  for (const g of one ? [one] : Object.keys(GAMES)) {
    const pts = [];
    for (let b = 0; b < 6; b++) {
      const from = now - (12 - b * 2) * 7 * DAY, to = from + 14 * DAY;
      const k = F.filter((e) => e.g === g && e.at >= from && e.at < to);
      if (k.length) pts.push([b, k.reduce((a, e) => a + e.ms / med[`${e.g}|${e.pack}`], 0) / k.length]);
    }
    if (pts.length < 3) continue;
    const pct = Math.round((1 - pts.at(-1)[1] / pts[0][1]) * 100);
    const mx = Math.max(...pts.map((p) => p[1])), mn = Math.min(...pts.map((p) => p[1]));
    const d = pts.map((p, i) => `${i ? "L" : "M"}${((p[0] / 5) * 144 + 3).toFixed(1)} ${(3 + ((mx - p[1]) / (mx - mn || 1)) * 22).toFixed(1)}`).join("");
    rows.push(`<div class="st-spark"><span>${GAMES[g].name}</span><svg viewBox="0 0 150 28" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${LOOK[g].ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
      <b style="color:${pct >= 0 ? "#2E7D4F" : "#C24E2A"}">${Math.abs(pct)}% ${pct >= 0 ? "faster" : "slower"}</b></div>`);
  }
  return `<h2 class="st-h" style="margin-top:6px">Getting faster?</h2>${rows.length ? `<p class="st-sub">Your usual time every two weeks, last 12 weeks</p>${rows.join("")}<p class="st-fine">Line going down = getting faster.</p>`
    : emptyNote("Play a few weeks and your trend shows up here.")}`;
}

function goodCard(F, one) {
  if (one) {
    const rows = GAMES[one].packs.map((p) => {
      const k = F.filter((e) => e.pack === p[0]), info = packInfo(one, p[0]);
      return k.length ? `<div class="pk"><b>${esc(info.label)}</b><span>${k.length}</span><span>${Math.round((k.filter(hintFree).length / k.length) * 100)}%</span><span style="color:${LOOK[one].ink};font-weight:700">${fmt(Math.min(...k.map((e) => e.ms)))}</span></div>`
        : `<div class="pk off"><b>${esc(info.label)}</b><span class="pk-none">Not tried yet</span></div>`;
    }).join("");
    return card(`${head(`${GAMES[one].name}, pack by pack`, "Your own mini stats for each pack")}<div id="games"><div class="pk head"><b>Pack</b><span>Solved</span><span>No hints</span><span>Best</span></div>${rows}</div>`);
  }
  let strong = null;
  const rows = Object.keys(GAMES).map((g) => {
    const rungs = LEVELS.map((L, li) => {
      if (!GAMES[g].packs.some((p) => p[2] === L)) return `<span class="rung na"></span>`;
      const k = F.filter((e) => e.g === g && packInfo(g, e.pack).level === L);
      if (!k.length) return `<span class="rung">${L}</span>`;
      const solid = k.filter(hintFree).length / k.length >= 0.6;
      if (solid && k.length >= 2 && (!strong || li > strong.li || (li === strong.li && k.length > strong.n))) strong = { g, li, n: k.length };
      return `<span class="rung" style="border:0;background:${solid ? LOOK[g].ink : LOOK[g].bg};color:${solid ? "#fff" : LOOK[g].ink}">${L}</span>`;
    }).join("");
    return `<div class="lad"><b>${GAMES[g].name}</b><div class="rungs">${rungs}</div></div>`;
  }).join("");
  const top = strong ? `<div class="st-strong">${thirds(40, 6, [LOOK[strong.g].ink, LOOK[strong.g].ink, LOOK[strong.g].ink], "", false)}<span><b>Strongest: ${GAMES[strong.g].name} ${LEVELS[strong.li]}</b>Mostly solved with no hints</span></div>` : "";
  return card(`${head("What you're good at", "The levels you've cleared, per puzzle")}${top}<div id="games">${rows}</div>
    <div class="st-legend"><span><i style="background:var(--ink)"></i>Solid = mostly no hints</span><span><i style="background:rgba(42,33,27,0.08)"></i>Light = with hints</span><span><i style="border:1.5px dashed var(--muted);background:none"></i>Not tried</span></div>`);
}

function hintsCard(F, one) {
  const sub = `${one ? `${GAMES[one].name} only` : "All puzzles"}`;
  if (!F.length) return card(`${head("Hints you use", sub)}${emptyNote("Solve a puzzle and your hints show up here.")}`, "hints");
  const pct = Math.round((F.filter(hintFree).length / F.length) * 100);
  const st = [0, 0, 0], tricks = {};
  for (const e of F) if (e.hd) { e.hd.steps?.forEach((n, i) => (st[i] += n)); for (const [t, n] of Object.entries(e.hd.tricks ?? {})) if (!NOT_TRICKS.has(t)) tricks[t] = (tricks[t] ?? 0) + n; }
  const stop = [st[0] - st[1], st[1] - st[2], st[2]], asked = st[0];
  const steps = asked ? `<div class="st-steps">${["Nudge", "Explain", "Show me"].map((t, i) => stop[i] ? `<span style="flex:${stop[i]};opacity:${1 - i * 0.28}">${stop[i] / asked >= 0.3 ? t : ""}</span>` : "").join("")}</div>
      <div class="st-legend">${["Nudge", "Explain", "Show me"].map((t, i) => `<span><i style="background:var(--brand);opacity:${1 - i * 0.28}"></i>${t} ${Math.round((stop[i] / asked) * 100)}%</span>`).join("")}</div>
      <p class="st-fine">${stop[0] >= stop[1] && stop[0] >= stop[2] ? "Mostly a nudge is enough." : stop[2] >= stop[1] ? "You often let it show you. Try stopping at Explain." : "Explain usually does it."}</p>`
    : `<p class="st-fine">Ask for a hint and how far you go shows up here.</p>`;
  let per = "";
  if (!one) {
    const rows = Object.keys(GAMES).map((g) => { const k = F.filter((e) => e.g === g); return [g, k.length ? k.reduce((a, e) => a + (e.hints || 0), 0) / k.length : null]; }).filter((r) => r[1] !== null).sort((a, b) => b[1] - a[1]);
    const mx = Math.max(0.1, ...rows.map((r) => r[1]));
    per = `<h3 class="st-h3">Hints per puzzle</h3>${rows.map(([g, v]) => `<div class="st-bar"><span>${GAMES[g].name}</span><span class="tr"><i style="width:${(v / mx) * 100}%;background:${LOOK[g].ink}"></i></span><span>${v.toFixed(1)}</span></div>`).join("")}`;
  }
  const top = Object.entries(tricks).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const trickList = top.length ? top.map(([t, n]) => `<div class="st-trick"><span>${esc(t)}</span><small>${n}×</small></div>`).join("") : `<p class="st-fine">Ask for a hint and the trick it teaches shows up here.</p>`;
  return card(`${head("Hints you use", sub)}<div class="st-row"><span class="st-big">${pct}%</span><span class="st-sub" style="margin:0">solved with no hints</span></div>
    <h3 class="st-h3">How far you go when you ask</h3>${steps}${per}<h3 class="st-h3">Tricks you ask about most</h3>${trickList}`, "hints");
}

const ICON = { up: "M7 17 17 7M9 7h8v8", bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z", clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2", star: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" };
// Tips: plain rules over your own solves, worked out each time Stats opens (no AI, nothing leaves the phone).
export function tips(F, one, now = Date.now()) {
  const out = [], games = one ? [one] : Object.keys(GAMES);
  for (const g of games) { // next level: you clear one level with no hints, and haven't tried the next
    const packs = GAMES[g].packs.filter((p) => LEVELS.includes(p[2]));
    for (let i = 0; i < packs.length - 1; i++) {
      const a = F.filter((e) => e.g === g && e.pack === packs[i][0]), b = F.filter((e) => e.g === g && e.pack === packs[i + 1][0]);
      const r = a.length ? a.filter(hintFree).length / a.length : 0;
      if (a.length >= 3 && r >= 0.6 && !b.length) { out.push(["up", g, `Ready for ${GAMES[g].name} ${packInfo(g, packs[i + 1][0]).label}`, `You solve ${packInfo(g, packs[i][0]).label} with no hints ${Math.round(r * 100)}% of the time.`]); break; }
    }
  }
  let worst = null; // most hints: a pack you've played 3+ times
  for (const r of groups(F)) { if (r.ss.length < 3) continue; const h = r.ss.reduce((a, e) => a + (e.hints || 0), 0) / r.ss.length; if (!worst || h > worst.h) worst = { ...r, h }; }
  if (worst && worst.h >= 0.5) out.push(["bulb", worst.g, `${GAMES[worst.g].name} ${worst.label}: one fewer hint`, `You use about ${worst.h.toFixed(1)} hints there. Try waiting a minute before the next one.`]);
  const last = {}; for (const e of F) last[e.g] = Math.max(last[e.g] ?? 0, e.at);
  const stale = Object.entries(last).sort((a, b) => a[1] - b[1])[0];
  if (stale && now - stale[1] >= 7 * DAY) out.push(["clock", stale[0], `Back to ${GAMES[stale[0]].name}?`, `Your last one was ${Math.round((now - stale[1]) / DAY)} days ago. A quick Easy keeps it fresh.`]);
  const fresh = Object.keys(GAMES).filter((g) => !F.some((e) => e.g === g));
  if (!one && fresh.length && F.length >= 3) out.push(["star", fresh[0], `Try ${GAMES[fresh[0]].name}`, "You haven't played it yet. The Easy pack starts gentle."]);
  return out.slice(0, 3);
}
function tipsCard(F, one) {
  const t = tips(F, one);
  return card(`${head("How to get better", "Picked from your own solves")}<div id="tips">${t.length ? t.map(([k, g, a, b]) =>
    `<div class="st-tip"><span class="tip-ic" style="background:${LOOK[g].bg}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${LOOK[g].ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"/></svg></span><span><b>${esc(a)}</b>${esc(b)}</span></div>`).join("")
    : emptyNote("Solve a few more and tips show up here.")}</div>`);
}

function render() {
  const log = solves(), now = Date.now();
  const F = filter === "all" ? log : log.filter((e) => e.g === filter), one = filter === "all" ? null : filter;
  $("stats").innerHTML = hero(log, now) + chips() + (one ? `<p class="st-fine" style="margin:-6px 4px 0">Your streak counts every puzzle.</p>` : "")
    + `<p class="st-sec">How much you play</p>` + playCard(F, now) + heatCard(F, now) + clockCard(F) + podiumCard(F, one)
    + `<p class="st-sec">How fast you are</p>` + speedCard(F, one)
    + `<p class="st-sec">What you're good at</p>` + goodCard(F, one) + hintsCard(F, one)
    + `<p class="st-sec">How to get better</p>` + tipsCard(F, one) + syncLine();
}
// iCloud (Colin 11/1): what sync has done on this device. Tap it to send everything again.
const ago = (t) => { if (!t) return "never"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
function syncLine() {
  const s = syncStatus();
  if (!s.inApp) return "";
  const text = !s.on ? "iCloud sync: not in this version of the app"
    : `iCloud sync on · ${s.keys} kept in iCloud · sent ${ago(s.sentAt)} · from your other device ${ago(s.gotAt)}`;
  return `<button class="st-fine st-sync" id="syncLine">${esc(text)}</button>`;
}
$("stats").addEventListener("click", (ev) => {
  if (ev.target.closest("#syncLine")) { globalThis.sbResync?.(); setTimeout(render, 600); return; }
  const b = ev.target.closest(".st-chip"); if (!b) return;
  filter = b.dataset.f;
  const x = document.querySelector(".st-chips")?.scrollLeft ?? 0;
  render();
  const c = document.querySelector(".st-chips"); if (c) c.scrollLeft = x;
});

// The header face: tap = hello, and back to Library (Buddy standard §2); it also winks when idle.
headerLogo($("logoBtn"), () => (inApp ? post({ type: "tab", name: "Library" }) : (location.href = "home.html")));
document.querySelector(".phone").insertAdjacentHTML("beforeend", tabs("stats"));
globalThis.sbRefresh = render;
globalThis.sbHome = () => scrollTo({ top: 0, behavior: "smooth" }); // tapping this tab again (Colin 10/24)
render();
