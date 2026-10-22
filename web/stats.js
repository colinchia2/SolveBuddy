// Stats tab: streaks, puzzles per day this month, each game, and how many were solved without a hint.
// Everything comes from the solve log on this phone (bridge.js); nothing is made up.
import { GAMES, inApp, post, solves } from "./bridge.js";
import { $, FLAME, LOOK, dayKey, fmt, gameIcon, headerLogo, streaks, tabs } from "./screens.js";

const SHADES = ["rgba(42,33,27,0.07)", "#D6E6FD", "#A9C9F8", "#6FA4EE", "#2F6FD6"];

function render() {
  const log = solves();
  const { current, best } = streaks(log);
  $("kpis").innerHTML = [
    [FLAME, current, "Day streak"],
    [`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2F6B4A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`, log.length, "Solved"],
    [`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8C5F00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v2a3 3 0 0 0 3 3 M17 6h3v2a3 3 0 0 1-3 3"/></svg>`, best, "Best streak"],
  ].map(([ico, n, label]) => `<div class="card-glass kpi">${ico}<span class="big">${n}</span><small>${label}</small></div>`).join("");

  // This month, Monday first.
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const perDay = {};
  for (const e of log) perDay[dayKey(e.at)] = (perDay[dayKey(e.at)] ?? 0) + 1;
  const cells = Array.from({ length: (first.getDay() + 6) % 7 }, () => `<span></span>`);
  for (let d = 1; d <= days; d++) {
    const k = `${now.getFullYear()}-${now.getMonth() + 1}-${d}`;
    const n = perDay[k] ?? 0;
    const cls = d === now.getDate() ? "day today" : d > now.getDate() ? "day future" : "day";
    cells.push(`<span class="${cls}" style="background:${d > now.getDate() ? "transparent" : SHADES[Math.min(n, 4)]}" aria-label="${d}: ${n} puzzle${n === 1 ? "" : "s"}"></span>`);
  }
  $("month").textContent = now.toLocaleString("en", { month: "long" });
  $("cal").innerHTML = ["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span class="dow">${d}</span>`).join("") + cells.join("");
  $("legend").innerHTML = `Less${SHADES.map((s) => `<i style="background:${s}"></i>`).join("")}More`;

  $("games").innerHTML = Object.entries(GAMES).map(([g, game]) => {
    const mine = log.filter((e) => e.g === g);
    const avg = mine.length ? fmt(mine.reduce((t, e) => t + e.ms, 0) / mine.length) : "–";
    const most = Math.max(1, ...Object.keys(GAMES).map((x) => log.filter((e) => e.g === x).length));
    return `<div class="line">${gameIcon(LOOK[g], 34, 18)}<span class="grow" style="gap:4px">
      <span style="display:flex;justify-content:space-between;font-size:14px"><b>${game.name}</b><span style="color:var(--body)">${mine.length} solved · avg ${avg}</span></span>
      <span class="prog"><span class="track"><span class="fill" style="display:block;width:${Math.round((mine.length / most) * 100)}%;background:${LOOK[g].ink}"></span></span></span></span></div>`;
  }).join("");

  const clean = log.filter((e) => !e.hints).length;
  const pct = log.length ? Math.round((clean / log.length) * 100) : 0;
  $("clean").innerHTML = `<svg width="52" height="52" viewBox="0 0 36 36" role="img" aria-label="${pct} percent solved without hints"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(42,33,27,0.1)" stroke-width="4"/>
    <circle cx="18" cy="18" r="15" fill="none" stroke="#2F6FD6" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(pct / 100) * 94.2} 94.2" transform="rotate(-90 18 18)"/></svg>
    <span class="grow"><b>${log.length ? `${pct}% solved without hints` : "No puzzles solved yet"}</b><small>${log.length ? `${clean} of ${log.length} puzzles` : "Finish one and your stats start here."}</small></span>`;
}

// The header face: tap = hello, and back to Library (Buddy standard §2); it also winks when idle.
headerLogo($("logoBtn"), () => (inApp ? post({ type: "tab", name: "Library" }) : (location.href = "home.html")));
document.querySelector(".phone").insertAdjacentHTML("beforeend", tabs("stats"));
globalThis.sbRefresh = render;
render();
