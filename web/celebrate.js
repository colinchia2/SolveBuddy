// Fun bits shared by the game pages (approved mockups, canvas row "Game polish", 10/21):
// - celebrate(): the Solved! card (medal, star burst, badges, Next / View puzzle / Home) with a buzz.
// - openWipe(): the blue wipe as a game opens.
// - shootingStar(): a star arcs from one spot into another (Star Battle's counter).
import { goHome, haptic, solves } from "./bridge.js";
import { streaks } from "./screens.js";

const STAR = "M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z";
const star = (size, fill, style = "") => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="${style}" aria-hidden="true"><path d="${STAR}" fill="${fill}"/></svg>`;
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

// What the card says about this solve, worked out BEFORE it goes into the solve log.
export function solveFacts(game, pack, ms, hints) {
  const before = solves().filter((e) => e.g === game && e.pack === pack);
  return { ms, hints, best: before.length > 0 && before.every((e) => ms < e.ms) };
}

// The card rises after the board's own win wave (delay ms). Returns nothing; buttons call back.
export function celebrate({ title, level, facts, hasNext, onNext, delay = 1000 }) {
  document.getElementById("won")?.remove();
  const { current } = streaks(); // the solve is already logged, so today counts
  const fills = ["#2F6FD6", "#FFC94D", "#C24E2A", "#4D96FF", "#FFC94D"];
  const burst = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2, dist = 70 + (i % 3) * 18;
    return star(16, fills[i % 5], `position:absolute;left:40px;top:40px;--dx:${Math.round(Math.cos(a) * dist)}px;--dy:${Math.round(Math.sin(a) * dist)}px;animation:sbBurst .9s calc(var(--wait) + ${(0.45 + (i % 4) * 0.04).toFixed(2)}s) ease-out both`);
  }).join("");
  const badges = [
    facts.hints === 0 && `<span class="badge blue" style="--at:.75s"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>No hints</span>`,
    facts.best && `<span class="badge gold" style="--at:.9s">${star(14, "#C98A00")}Your best ${level} time</span>`,
    current > 1 && `<span class="badge coral" style="--at:1.05s"><svg width="14" height="14" viewBox="0 0 24 24" fill="#E8743F" aria-hidden="true"><path d="M12 2c1.2 3.4 5 5.2 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.2 1.6 1 2.6 2 3 0-3.5.3-6 1-8.5z"/></svg>${current}-day streak</span>`,
  ].filter(Boolean).join("");

  const el = document.createElement("div");
  el.id = "won";
  el.style.setProperty("--wait", `${delay / 1000}s`);
  el.innerHTML = `<div class="won-scrim"></div>
    <section class="won-card" role="dialog" aria-label="Solved">
      <div class="medal">
        <span class="ring"></span>${burst}
        <span class="disc">${star(46, "#fff")}</span>
      </div>
      <div class="won-in" style="--at:.5s"><h2>Solved!</h2><p>You finished ${title} in <b>${fmt(facts.ms)}</b></p></div>
      ${badges ? `<div class="badges">${badges}</div>` : ""}
      ${hasNext ? `<button class="won-next won-in" style="--at:1.1s" data-act="next">Next puzzle<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14 M13 6l6 6-6 6"/></svg></button>` : ""}
      <div class="two won-in" style="--at:1.2s">
        <button class="ghost" data-act="view">View puzzle</button>
        <button class="ghost" data-act="home">Home</button>
      </div>
    </section>
    <div class="won-bar" hidden>
      <button class="won-pill" data-act="again">${star(18, "#2F6FD6")}Solved in ${fmt(facts.ms)}</button>
      ${hasNext ? `<button class="won-go" data-act="next">Next<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14 M13 6l6 6-6 6"/></svg></button>` : ""}
    </div>`;
  document.querySelector(".phone").appendChild(el);
  setTimeout(() => haptic("thud"), delay + 350); // the medal lands

  const bar = el.querySelector(".won-bar");
  const show = (card) => {
    el.querySelector(".won-scrim").hidden = !card;
    el.querySelector(".won-card").hidden = !card;
    bar.hidden = card;
    el.classList.toggle("viewing", !card);
  };
  el.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "next") { el.remove(); onNext(); }
    else if (act === "home") goHome();
    else if (act === "view") show(false);
    else if (act === "again") { el.style.setProperty("--wait", "0s"); show(true); }
  };
}

// "View solved puzzle" (from a pack's numbers): the finished board with a small bar, and Play again.
export function solvedBar(ms, onAgain) {
  document.getElementById("won")?.remove();
  const el = document.createElement("div");
  el.id = "won";
  el.className = "viewing";
  el.innerHTML = `<div class="won-bar">
    <span class="won-pill">${star(18, "#2F6FD6")}Solved in ${fmt(ms)}</span>
    <button class="won-go" data-act="again"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7 M3 4v5h5"/></svg>Play again</button>
  </div>`;
  document.querySelector(".phone").appendChild(el);
  el.querySelector("[data-act=again]").onclick = () => { el.remove(); onAgain(); };
}

// The blue wipe a game opens with: a circle grows from near the bottom, then fades to show the page.
export function openWipe() {
  const w = document.createElement("div");
  w.className = "wipe";
  w.setAttribute("aria-hidden", "true");
  document.querySelector(".phone").appendChild(w);
  w.addEventListener("animationend", () => w.remove());
}

// A star arcs up from the bottom-left of `from` into `to`, with a short sparkle trail; `to` bumps when it lands.
export function shootingStar(from, to, wait = 0.75) {
  const phone = document.querySelector(".phone").getBoundingClientRect();
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const x0 = a.left - phone.left + 12, y0 = a.bottom - phone.top + 20;
  const x1 = b.left - phone.left + 8, y1 = b.top - phone.top + b.height / 2 - 12;
  const path = `path('M ${x0} ${y0} Q ${(x0 + x1) / 2 - 40} ${y1 + (y0 - y1) * 0.35} ${x1} ${y1}')`;
  const fills = ["#C24E2A", "#FFC94D", "#4D96FF", "#FFC94D", "#4D96FF"];
  fills.forEach((fill, i) => {
    const s = document.createElement("div");
    s.className = "flyer";
    s.innerHTML = star(i ? 14 - i * 2 : 26, fill);
    s.style.offsetPath = path;
    s.style.animationDelay = `${(wait + i * 0.06).toFixed(2)}s`;
    document.querySelector(".phone").appendChild(s);
    s.addEventListener("animationend", () => s.remove());
  });
  to.style.animation = `sbBump .35s ${wait + 0.8}s ease both`;
}
