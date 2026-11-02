// Stats detail screens (Colin 11/1, mockup https://claude.ai/artifact/34Nyu3RKJkLN5ZdvCsLJ76): tap a card on Stats
// and its own page opens, one level deeper; "‹ Stats" goes back. The filter (All or one puzzle) carries over, except
// the streak, which always counts every puzzle. All from the solve log on this device, plain rules, no AI.
import { GAMES, hintAmount, hintShort, loadPack, openPack } from "./bridge.js";
import { LOOK, WEEK_GOAL, dayKey, esc, fmt, streaks, weekCounts, weekKey, weekStart } from "./screens.js";
import { DAY, LEVELS, NOT_TRICKS, STAR, card, clockCard, emptyNote, groups, head, hintFree, packInfo, plural, thirds, tips } from "./stats.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const md = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const dot = (g) => `<i class="sd-dot" style="background:${LOOK[g]?.ink ?? "var(--muted)"}"></i>`;
const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const name = (g, pack, one) => (one ? packInfo(g, pack).label : `${GAMES[g]?.name ?? g} · ${packInfo(g, pack).label}`);
const kpis = (list) => `<div class="sd-kpis">${list.map(([b, s]) => `<div class="sd-kpi"><b>${b}</b><span>${s}</span></div>`).join("")}</div>`;
const row = (cols, html) => `<div class="sd-row" style="grid-template-columns:${cols}">${html}</div>`;
const bar = (pct, color) => `<span class="sd-bar"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%;background:${color}"></i></span>`;
const badge = (t, on) => `<span class="sd-badge${on ? " on" : ""}">${t}</span>`;
const filtered = (one) => (one ? `${GAMES[one].name} only` : "All puzzles");
const BACK = `<button class="sd-back" id="sdBack"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Stats</button>`;
const when = (t) => { const d = new Date(t), days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : md(t); };
const CHEV = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--muted)"><path d="M9 6l6 6-6 6"/></svg>`;
const top = (title, sub, backTo = "Stats") => `<div class="sd-top">${BACK.replace("Stats</button>", `${backTo}</button>`)}<h2>${title}</h2><p>${sub}</p></div>`;

// 1. This week → your streak (always every puzzle)
function week(log, now) {
  const { current, best } = streaks(log, now), counts = weekCounts(log), start = weekStart(now);
  const hit = Array.from({ length: 12 }, (_, w) => (counts[weekKey(start - w * 7 * DAY)] ?? 0) >= WEEK_GOAL).filter(Boolean).length;
  const today = (new Date(now).getDay() + 6) % 7;
  const days = DAYS.map((d, i) => {
    const ss = log.filter((e) => dayKey(e.at) === dayKey(start + i * DAY + 3 * 36e5)).sort((a, b) => a.at - b.at);
    const list = ss.length ? ss.map((e) => `<span>${dot(e.g)}${esc(name(e.g, e.pack))} <small>${fmt(e.ms)}</small></span>`).join("")
      : `<small>${i > today ? "" : "No puzzles"}</small>`;
    return row("38px 30px 1fr", `<b>${d}</b>${thirds(26, 4, ss.slice(0, 3).map((e) => LOOK[e.g]?.ink), "rgba(42,33,27,0.1)", false)}<span class="sd-list">${list}</span>`);
  }).join("");
  const weeks = Array.from({ length: 12 }, (_, w) => {
    const a = start - w * 7 * DAY, n = counts[weekKey(a)] ?? 0, done = n >= WEEK_GOAL;
    return row("100px 1fr 26px", `<span>${w === 0 ? "This week" : `${md(a)} – ${new Date(a + 6 * DAY).getDate()}`}</span>${bar((n / 7) * 100, done ? "var(--brand)" : "rgba(42,33,27,0.25)")}
      ${done ? thirds(22, 3, ["var(--brand)", "var(--brand)", "var(--brand)"], "", true) : `<small class="r">${n}</small>`}`);
  }).join("");
  const wk = log.filter((e) => weekKey(e.at) === weekKey(now)).length;
  return top("Your streak", `${WEEK_GOAL} puzzles a week keeps it going · counts every puzzle`)
    + kpis([[`${current} wk${current === 1 ? "" : "s"}`, "streak now"], [`${best} wk${best === 1 ? "" : "s"}`, "your best"], [`${hit} of 12`, "weeks hit"]])
    + card(`${head("This week", `${md(start)} – ${md(start + 6 * DAY)} · ${plural(wk, "puzzle")}${wk >= WEEK_GOAL ? ", goal done" : `, ${WEEK_GOAL - wk} to go`}`)}${days}`)
    + card(`${head("Every week", `The last 12 weeks. A tick = ${WEEK_GOAL} or more.`)}${weeks}`);
}

// 2. How much you play
function play(F, one, now) {
  const start = weekStart(now) - 11 * 7 * DAY, recent = F.filter((e) => e.at >= start);
  const per = Array.from({ length: 12 }, (_, w) => recent.filter((e) => Math.round((weekStart(e.at) - start) / (7 * DAY)) === w));
  const max = Math.max(1, ...per.map((p) => p.length)), W = 326, H = 150, bw = 18, gap = (W - 24 - 12 * bw) / 11;
  let bars = "";
  per.forEach((p, w) => {
    let y = H; const x = 24 + w * (bw + gap);
    for (const g of Object.keys(GAMES)) {
      const k = p.filter((e) => e.g === g).length; if (!k) continue;
      const h = (k / max) * (H - 8);
      bars += `<rect x="${x}" y="${(y - h + 1).toFixed(1)}" width="${bw}" height="${Math.max(h - 2, 2).toFixed(1)}" rx="3" fill="${LOOK[g].ink}"/>`; y -= h;
    }
    if (p.length) bars += `<text x="${x + bw / 2}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--muted)">${p.length}</text>`;
    if (w % 3 === 2 || w === 11) bars += `<text x="${w === 11 ? x + bw : x + bw / 2}" y="${H + 14}" text-anchor="${w === 11 ? "end" : "middle"}" font-size="9.5" fill="var(--muted)">${w === 11 ? "This wk" : md(start + w * 7 * DAY)}</text>`;
  });
  const total = F.reduce((a, e) => a + (e.ms || 0), 0);
  const by = (one ? groups(F).map((r) => ({ k: r.label, g: r.g, ss: r.ss, order: r.order })).sort((a, b) => a.order - b.order)
    : Object.keys(GAMES).map((g) => ({ k: GAMES[g].name, g, ss: F.filter((e) => e.g === g) }))).filter((r) => r.ss.length);
  const most = Math.max(1, ...by.map((r) => r.ss.length));
  const table = by.length ? by.map((r) => row("1fr 90px 30px 56px", `<span>${dot(r.g)}${esc(r.k)}</span>${bar((r.ss.length / most) * 100, LOOK[r.g].ink)}<b class="r">${r.ss.length}</b><small class="r">${Math.round(r.ss.reduce((a, e) => a + (e.ms || 0), 0) / 60000)} min</small>`)).join("")
    : emptyNote("Solve a puzzle and it shows up here.");
  return top("How much you play", `${filtered(one)} · ${plural(F.length, "puzzle")} so far`)
    + kpis([[F.length, "puzzles"], [total >= 36e5 ? `${(total / 36e5).toFixed(1)} h` : `${Math.round(total / 60000)} min`, "playing"], [(recent.length / 12).toFixed(1), "a week lately"]])
    + card(`${head("Week by week", "Puzzles each week, last 12 weeks")}<svg viewBox="0 0 ${W} ${H + 18}" width="100%" role="img" aria-label="Puzzles per week"><line x1="20" x2="${W}" y1="${H + 1}" y2="${H + 1}" stroke="rgba(42,33,27,0.12)"/>${bars}</svg>
      <div class="st-legend">${Object.keys(GAMES).filter((g) => recent.some((e) => e.g === g)).map((g) => `<span><i style="background:${LOOK[g].ink}"></i>${GAMES[g].name}</span>`).join("")}</div>`)
    + card(`${head(one ? "By pack" : "By game", "Puzzles and time spent")}${table}`);
}

// 3. Every day you played: the heat map, bigger, with the count on each day
function heat(F, one, now) {
  const start = weekStart(now) - 11 * 7 * DAY, per = {};
  for (const e of F) per[dayKey(e.at)] = (per[dayKey(e.at)] ?? 0) + 1;
  const SH = ["rgba(42,33,27,0.07)", "#B9CFF2", "#7EA6E8", "#2F6FD6"], cs = 23, g = 3, x0 = 30;
  let o = "", played = 0, past = 0, run = 0, bestRun = 0, most = 0;
  DAYS.forEach((d, i) => { o += `<text x="0" y="${i * (cs + g) + cs * 0.68}" font-size="9.5" fill="var(--muted)">${d}</text>`; });
  for (let w = 0; w < 12; w++) for (let d = 0; d < 7; d++) {
    const t = start + (w * 7 + d) * DAY + 3 * 36e5, n = per[dayKey(t)] ?? 0, x = x0 + w * (cs + g), y = d * (cs + g);
    if (t > now) { o += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${cs - 1}" height="${cs - 1}" rx="5" fill="none" stroke="rgba(42,33,27,0.12)" stroke-dasharray="2 2"/>`; continue; }
    past++; if (n) played++; most = Math.max(most, n);
    o += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" rx="5" fill="${SH[Math.min(n, 3)]}"/>`;
    if (n) o += `<text x="${x + cs / 2}" y="${y + cs / 2 + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="${n >= 2 ? "#fff" : "var(--ink)"}">${n}</text>`;
  }
  [0, 4, 8].forEach((w) => { o += `<text x="${x0 + w * (cs + g)}" y="${7 * (cs + g) + 10}" font-size="9" fill="var(--muted)">${md(start + w * 7 * DAY)}</text>`; });
  const days = [...new Set(F.map((e) => dayKey(e.at)))].map((k) => F.filter((e) => dayKey(e.at) === k)).sort((a, b) => a[0].at - b[0].at);
  for (let i = 0, r = 0; i < days.length; i++) { r = i && dayKey(days[i - 1][0].at + DAY) === dayKey(days[i][0].at) ? r + 1 : 1; run = r; bestRun = Math.max(bestRun, r); }
  const busy = [...days].sort((a, b) => b.length - a.length || b[0].at - a[0].at).slice(0, 3)
    .map((l) => row("110px 1fr", `<b>${DAYS[(new Date(l[0].at).getDay() + 6) % 7]} ${md(l[0].at)}</b><span>${l.map((e) => dot(e.g)).join("")} ${plural(l.length, "puzzle")}</span>`)).join("");
  return top("Every day you played", `${filtered(one)} · last 12 weeks`)
    + kpis([[`${played} of ${past}`, "days played"], [plural(bestRun, "day"), "longest run"], [most, "most in a day"]])
    + card(`<svg viewBox="0 0 ${x0 + 12 * (cs + g)} ${7 * (cs + g) + 14}" width="100%" role="img" aria-label="Puzzles each day, last 12 weeks">${o}</svg>`)
    + card(`${head("Your busiest days")}${busy || emptyNote("Solve a puzzle and your days show up here.")}`);
}

// 4. When you play: the clock, the days of the week, and when you're fastest
function clock(F, one, day = null) {
  const wd = Array(7).fill(0); F.forEach((e) => wd[(new Date(e.at).getDay() + 6) % 7]++);
  const wm = Math.max(1, ...wd);
  // Tap a day (Colin 11/1): every puzzle played on that weekday, newest first, grouped by date, with the time of day.
  const time = (t) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = DAYS.map((d, i) => {
    const on = day === i && wd[i];
    let list = "";
    if (on) {
      const l = F.filter((e) => (new Date(e.at).getDay() + 6) % 7 === i).sort((a, b) => b.at - a.at), dates = [...new Set(l.map((e) => dayKey(e.at)))];
      list = `<div class="sd-day">${dates.map((k) => { const ss = l.filter((e) => dayKey(e.at) === k);
        return `<p class="sd-date">${d} ${md(ss[0].at)} · ${plural(ss.length, "puzzle")}</p>${ss.map((e) => `<span>${dot(e.g)}${esc(name(e.g, e.pack, one))} <small>· ${time(e.at)} · ${fmt(e.ms)}</small></span>`).join("")}`; }).join("")}</div>`;
    }
    return `<button class="sd-row sd-wd${on ? " on" : ""}" data-wd="${i}" style="grid-template-columns:40px 1fr 28px 14px"${wd[i] ? "" : " disabled"}><span>${d}</span>${bar((wd[i] / wm) * 100, "var(--brand)")}<b class="r">${wd[i]}</b>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--muted);opacity:${wd[i] ? 1 : 0}"><path d="${on ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"}"/></svg></button>${list}`;
  }).join("");
  const med = {}; for (const r of groups(F)) med[`${r.g}|${r.pack}`] = median(r.ss.map((e) => e.ms));
  const rel = (e) => e.ms / (med[`${e.g}|${e.pack}`] || e.ms);
  const bands = [["Morning", "6 am – noon", 6, 12], ["Afternoon", "noon – 6 pm", 12, 18], ["Evening", "6 – 10 pm", 18, 22], ["Late", "10 pm – 6 am", 22, 30]];
  const fast = bands.map(([n, t, a, b]) => {
    const l = F.filter((e) => { const h = new Date(e.at).getHours(); return (h >= a && h < b) || (h + 24 >= a && h + 24 < b); });
    if (l.length < 2) return "";
    const pct = Math.round((1 - avg(l.map(rel))) * 100);
    return row("1fr auto", `<span><b>${n}</b> <small>${t} · ${plural(l.length, "puzzle")}</small></span>${badge(pct === 0 ? "your usual" : `${Math.abs(pct)}% ${pct > 0 ? "faster" : "slower"}`, pct > 0)}`);
  }).join("");
  return top("When you play", `${filtered(one)} · your puzzle hours and days`) + clockCard(F)
    + card(`${head("Through the week", "Tap a day to see what you played")}${days}`)
    + card(`${head("When you're fastest", "Compared with your usual time for the same pack")}${fast || emptyNote("Play at a few different times and it shows up here.")}`);
}

// 5. Your favourites: every pack, ranked
function podium(F, one) {
  const MED = ["#C99A1B", "#8E98A8", "#B06A3A"];
  const list = groups(F).sort((a, b) => b.ss.length - a.ss.length || Math.max(...b.ss.map((e) => e.at)) - Math.max(...a.ss.map((e) => e.at)));
  const rows = list.map((r, i) => row("26px 1fr auto", `<span class="sd-medal" style="${i < 3 ? `background:${MED[i]};color:#fff` : ""}">${i + 1}</span>
    <span>${dot(r.g)}<b>${esc(one ? r.label : GAMES[r.g].name)}</b>${one ? "" : ` · ${esc(r.label)}`}<br><small>Best ${fmt(Math.min(...r.ss.map((e) => e.ms)))} · last played ${md(Math.max(...r.ss.map((e) => e.at)))}</small></span>
    <span class="r"><b>${r.ss.length}</b><br><small>solved</small></span>`)).join("");
  return top("Your favourites", `${filtered(one)} · every pack you've played, most first`) + card(rows || emptyNote("Your most-played packs show up here."));
}

// 6. How fast you are: one pack at a time, every solve in order
function speed(F, one, pick) {
  const packs = groups(F).filter((r) => r.ss.length >= 2).sort((a, b) => b.ss.length - a.ss.length);
  if (!packs.length) return top("How fast you are", filtered(one)) + card(emptyNote("Solve the same pack twice and your times show up here."));
  const cur = packs.find((r) => `${r.g}|${r.pack}` === pick) ?? packs[0], l = [...cur.ss].sort((a, b) => a.at - b.at), ms = l.map((e) => e.ms);
  const chips = `<div class="st-chips sd-packs">${packs.map((r) => `<button class="st-chip${r === cur ? " on" : ""}" data-sp="${r.g}|${r.pack}">${one ? "" : `<i style="background:${LOOK[r.g].ink}"></i>`}${esc(name(r.g, r.pack, one))}</button>`).join("")}</div>`;
  const W = 326, H = 150, hi = Math.max(...ms), X = (i) => 14 + (i * (W - 28)) / Math.max(1, l.length - 1), Y = (v) => H - 6 - (v / hi) * (H - 22);
  const usual = median(ms), k = Math.max(1, Math.floor(l.length / 3)), a0 = avg(ms.slice(0, k)), a1 = avg(ms.slice(-k)), bi = ms.indexOf(Math.min(...ms)), ink = LOOK[cur.g].ink;
  const pct = l.length >= 4 ? Math.round((1 - a1 / a0) * 100) : null;
  let o = `<line x1="8" x2="${W - 8}" y1="${Y(usual).toFixed(1)}" y2="${Y(usual).toFixed(1)}" stroke="var(--muted)" stroke-dasharray="4 4"/><text x="8" y="${(Y(usual) - 5).toFixed(1)}" font-size="9.5" fill="var(--muted)">usual ${fmt(usual)}</text>`;
  if (pct !== null) o += `<line x1="${X(0)}" y1="${Y(a0).toFixed(1)}" x2="${X(l.length - 1)}" y2="${Y(a1).toFixed(1)}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" opacity="0.45"/>`;
  o += l.map((e, i) => (i === bi ? "" : `<circle cx="${X(i).toFixed(1)}" cy="${Y(e.ms).toFixed(1)}" r="4" fill="${ink}" opacity="0.7"/>`)).join("") + STAR(X(bi), Y(ms[bi]), 9, "#C99A1B");
  o += `<text x="14" y="${H + 12}" font-size="9" fill="var(--muted)">${md(l[0].at)}</text><text x="${W - 14}" y="${H + 12}" text-anchor="end" font-size="9" fill="var(--muted)">${md(l.at(-1).at)}</text>`;
  const best5 = [...l].sort((a, b) => a.ms - b.ms).slice(0, 5).map((e, i) => row("22px 1fr auto", `<b>${i + 1}</b><span>${md(e.at)} <small>· ${e.hints > 0.01 ? hintAmount(e.hints) : "no hints"}</small></span><b class="r">${fmt(e.ms)}</b>`)).join("");
  return top("How fast you are", `${esc(name(cur.g, cur.pack))} · every solve, oldest to newest`) + chips
    + kpis([[fmt(ms[bi]), "your best"], [fmt(usual), "usual"], [pct === null ? "—" : `${Math.abs(pct)}%`, pct === null ? "needs 4 solves" : pct >= 0 ? "faster lately" : "slower lately"]])
    + card(`<svg viewBox="0 0 ${W} ${H + 16}" width="100%" role="img" aria-label="Every solve's time">${o}</svg>
      <div class="st-legend"><span><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8 5.7 21.5l1.7-7.3L2 9.5l7.1-.6z" fill="#C99A1B"/></svg>your best</span><span><i style="width:14px;height:0;border-top:2px dashed var(--muted);border-radius:0"></i>your usual</span>${pct === null ? "" : `<span><i style="width:14px;height:3px;background:${ink}"></i>getting ${pct >= 0 ? "faster" : "slower"}</span>`}</div>`)
    + card(`${head("Your fastest 5")}${best5}`);
}

// 7. What you're good at: each level, how many, how fast, how many hints
const sizes = {}; // "sudoku|easy" → puzzles in the pack (loaded the first time this screen opens)
export async function loadSizes() {
  for (const [g, game] of Object.entries(GAMES)) for (const [k, file] of game.packs) {
    if (sizes[`${g}|${k}`] != null) continue;
    try { sizes[`${g}|${k}`] = (await loadPack(file)).puzzles.length; } catch { sizes[`${g}|${k}`] = 0; }
  }
}
function good(F, one) {
  const out = (one ? [one] : Object.keys(GAMES)).map((g) => {
    const rows = GAMES[g].packs.map(([k]) => {
      const l = F.filter((e) => e.g === g && e.pack === k), info = packInfo(g, k), n = new Set(l.map((e) => e.p)).size, total = sizes[`${g}|${k}`];
      const free = l.length ? l.filter(hintFree).length / l.length : 0;
      const [t, on] = !l.length ? ["Not tried yet", false] : total && n >= total ? ["All done", true] : l.length >= 5 && free >= 0.8 ? ["Mastered", true]
        : l.length >= 3 && free >= 0.6 ? ["Ready for the next one", true] : ["Keep going", false];
      return row("1fr auto", `<span><b>${esc(info.label)}</b> <small>${n}${total ? ` of ${total}` : ""} solved${l.length ? ` · usual ${fmt(median(l.map((e) => e.ms)))} · ${Math.round(free * 100)}% no hints` : ""}</small>
        ${bar(total ? (n / total) * 100 : 0, LOOK[g].ink)}</span>${badge(t, on)}`);
    }).join("");
    return card(`${head(GAMES[g].name)}${rows}`);
  }).join("");
  return top("What you're good at", `${filtered(one)} · each level: how many, how fast, how many with no hints`) + out;
}

// 8. How you use hints
function hints(F, one, now) {
  const start = weekStart(now) - 11 * 7 * DAY, st = [0, 0, 0], tricks = {};
  for (const e of F) if (e.hd) {
    e.hd.steps?.forEach((n, i) => (st[i] += n));
    for (const [t, n] of Object.entries(e.hd.tricks ?? {})) if (!NOT_TRICKS.has(t)) { const r = (tricks[t] ??= { n: 0, last: 0, g: e.g }); r.n += n; r.last = Math.max(r.last, e.at); }
  }
  const pct = F.length ? Math.round((F.filter(hintFree).length / F.length) * 100) : 0;
  const per = F.length ? avg(F.map((e) => e.hints || 0)) : 0, topT = Object.entries(tricks).sort((a, b) => b[1].n - a[1].n);
  const W = 326, H = 110; let o = "";
  for (let w = 0; w < 12; w++) {
    const l = F.filter((e) => e.at >= start + w * 7 * DAY && e.at < start + (w + 1) * 7 * DAY), x = 24 + w * 25;
    o += `<rect x="${x}" y="10" width="18" height="${H - 10}" rx="4" fill="rgba(42,33,27,0.06)"/>`;
    if (l.length) { const h = (l.filter(hintFree).length / l.length) * (H - 10); o += `<rect x="${x}" y="${(H - h).toFixed(1)}" width="18" height="${h.toFixed(1)}" rx="4" fill="var(--brand)"/>`; }
    if (w % 3 === 0) o += `<text x="${x + 9}" y="${H + 13}" text-anchor="middle" font-size="9" fill="var(--muted)">${md(start + w * 7 * DAY)}</text>`;
  }
  o += `<text x="0" y="16" font-size="9" fill="var(--muted)">100%</text><text x="0" y="${H}" font-size="9" fill="var(--muted)">0</text>`;
  const funnel = st[0] ? ["Nudge", "Explain", "Show me"].map((t, i) => row("70px 1fr 40px", `<span>${t}</span>${bar((st[i] / st[0]) * 100, "var(--brand)")}<b class="r">${Math.round((st[i] / st[0]) * 100)}%</b>`)).join("")
    + `<p class="st-fine">Of ${plural(st[0], "time")} you asked: how often you went on to each step.</p>` : emptyNote("Ask for a hint and how far you go shows up here.");
  const trickRows = topT.length ? topT.map(([t, r]) => { const fresh = now - r.last < 14 * DAY;
    return row("1fr auto auto", `<span><b>${esc(t)}</b><br><small>${GAMES[r.g]?.name ?? ""} · last asked ${md(r.last)}</small></span><b class="r">${r.n}×</b>${badge(fresh ? "Still learning" : "Got it", fresh)}`); }).join("")
    : emptyNote("Ask for a hint and the trick it teaches shows up here.");
  // Your puzzles with hints (Colin 11/1): newest first; tap one for its hint history (solves from before 11/1 have none).
  const withHints = F.filter((e) => e.hints > 0.01).sort((a, b) => b.at - a.at).slice(0, 40);
  const most = withHints.map((e) => { const has = !!e.hd?.log?.length, tr = [...new Set((e.hd?.log ?? []).map((h) => h.k).filter((k) => k && !NOT_TRICKS.has(k)))];
    const inner = `<span>${dot(e.g)}<b>${esc(name(e.g, e.pack, one))}${e.p ? ` #${e.p}` : ""}</b><br><small>${when(e.at)} · ${fmt(e.ms)}${has ? (tr.length ? ` · ${esc(tr.join(", "))}` : "") : " · before hint history"}</small></span><b class="r">${hintShort(e.hints)}</b>${has ? CHEV : "<span></span>"}`;
    return has ? `<button class="sd-row sd-solve" data-solve="${e.at}" style="grid-template-columns:1fr auto 14px">${inner}</button>` : row("1fr auto 14px", inner); }).join("");
  return top("How you use hints", `${filtered(one)} · which tricks you ask about, and whether it's dropping`)
    + kpis([[`${pct}%`, "solved with none"], [per.toFixed(1), "hints a puzzle"], [topT[0] ? esc(topT[0][0]) : "—", "most asked"]])
    + card(`${head("Solved with no hints", "Each week, the share of puzzles with no hints")}<svg viewBox="0 0 ${W} ${H + 16}" width="100%" role="img" aria-label="Share solved with no hints each week">${o}</svg>`)
    + card(`${head("How far you go")}${funnel}`)
    + card(`${head("Tricks you've asked about", "\"Got it\" = you haven't needed it in 2 weeks")}${trickRows}`)
    + card(`${head("Your puzzles with hints", "Newest first. Tap one to see each hint.")}${most || emptyNote("No hints yet.")}`);
}

// 9. How to get better: every tip, with a button where there's somewhere to go
function tipsAll(F, one) {
  const t = tips(F, one, Date.now(), 99);
  const ICONS = { up: "M7 17 17 7M9 7h8v8", bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z", clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2", star: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" };
  const list = t.map(([k, g, a, b, go]) => `<div class="st-tip"><span class="tip-ic" style="background:${LOOK[g].bg}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${LOOK[g].ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[k]}"/></svg></span>
    <span><b>${esc(a)}</b>${esc(b)}${go ? `<br><button class="sd-go" data-go="${g}|${esc(go)}">Open ${esc(GAMES[g].name)} ›</button>` : ""}</span></div>`).join("");
  return top("How to get better", `${filtered(one)} · every tip, and the numbers behind it`)
    + card(list || emptyNote("Solve a few more and tips show up here."))
    + `<p class="st-fine" style="margin:0 4px">Worked out by plain rules on this device each time you open Stats. No AI.</p>`;
}

// One puzzle's hints (Colin 11/1): when you asked, on a line from start to solved, then each hint in order.
const STEP = ["Nudge", "Explain", "Show me"], SHADE = ["#7EA6E8", "#2F6FD6", "#18337A"];
function solve(log, at, backTo) {
  const e = log.find((x) => x.at === at);
  if (!e) return top("Your hints", "That puzzle isn't on this device.", backTo);
  const L = e.hd?.log ?? [], tr = {};
  for (const h of L) if (h.k && !NOT_TRICKS.has(h.k)) tr[h.k] = (tr[h.k] ?? 0) + 1;
  const topT = Object.entries(tr).sort((a, b) => b[1] - a[1])[0];
  const at12 = new Date(e.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  const marks = L.map((h, i) => `<span class="sd-tm" style="left:${Math.min(100, (h.t / Math.max(e.ms, 1)) * 100).toFixed(1)}%;background:${SHADE[h.n - 1]}">${i + 1}</span>`).join("");
  const steps = L.map((h) => row("48px 1fr", `<b class="sd-t">${fmt(h.t)}</b><span><b>${esc(h.k && !NOT_TRICKS.has(h.k) ? h.k : h.k || "Hint")}</b>
    <span class="sd-steps">${STEP.map((s, j) => `<i class="${j < h.n ? "on" : ""}">${s}</i>`).join("")}</span></span>`)).join("");
  return top(`${GAMES[e.g]?.name ?? e.g}${e.p ? ` #${e.p}` : ""}`, `${esc(packInfo(e.g, e.pack).label)} · ${when(e.at).toLowerCase() === "today" ? "today" : when(e.at)} at ${at12} · solved in ${fmt(e.ms)}`, backTo)
    + kpis([[hintShort(e.hints), "hints"], [L.length ? fmt(L[0].t) : "—", "first one"], [topT ? esc(topT[0]) : "—", topT ? "needed most" : "trick"]])
    + (L.length ? card(`${head("When you asked", "Start to solved. Darker = you went further.")}<div class="sd-tl"><span class="sd-tline"></span>${marks}<span class="sd-tend"></span><small style="left:0">0:00</small><small style="right:0">${fmt(e.ms)}</small></div>`)
      + card(`${head("Each hint")}${steps}`)
      : card(emptyNote("This puzzle was solved before hint history, so only the total is kept.")));
}

export const DETAILS = { week, play, heat, clock, podium, speed, good, hints, tips: tipsAll };
export function detail(kind, { log, F, one, now, pick, day, at, backTo }) {
  if (kind === "solve") return solve(log, at, backTo);
  if (kind === "week") return week(log, now);
  if (kind === "speed") return speed(F, one, pick);
  if (kind === "clock") return clock(F, one, day);
  return DETAILS[kind]?.(F, one, now) ?? "";
}
export const openTip = (go) => { const [g, set] = go.split("|"); openPack(g, set); };
