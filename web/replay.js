// Hint replay (Colin 11/1, mockup https://claude.ai/artifact/XLb4R3AJPcqALtAwC2obDP): a game page opened from a
// puzzle's hint history (?replay=<the solve's time>&i=<which hint>) shows the board and the hint card exactly as
// they were the moment you asked. A bar on top says which hint it is, steps through Nudge / Explain / Show me (as far
// as you went that time) and moves to the other hints. Nothing can be played and nothing is saved (bridge.js REPLAY).
// Each game passes apply(frame, level, hint): put frame.board on the board, frame.hint on the card at that level.
import { REPLAY, frames, goHome, inApp, solves } from "./bridge.js";

const STEPS = ["Nudge", "Explain", "Show me"];
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function startReplay(apply) {
  if (!REPLAY) return false;
  const solve = solves().find((e) => e.at === REPLAY.at), L = solve?.hd?.log ?? [], all = frames();
  let i = Math.max(0, Math.min(L.length - 1, REPLAY.i)), level = 1;
  const bar = document.createElement("div");
  bar.className = "rp-bar";
  bar.setAttribute("role", "toolbar");
  // In the page's own flow, in place of the game's header and timer row, so it pushes the board down instead of
  // covering its top rows (Colin 11/2).
  const screen = document.querySelector(".screen");
  screen.insertBefore(bar, screen.firstChild);
  const back = () => (inApp ? goHome() : history.length > 1 ? history.back() : (location.href = "stats.html"));
  function show() {
    const h = L[i], f = h && all[h.r];
    const trick = h?.k && !["Check this", "Wrong patch"].includes(h.k) ? h.k : "Hint";
    bar.innerHTML = `<div class="rp-r1"><button class="rp-back sq glass" data-rp="back" aria-label="Back to the hints"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5 M11 6l-6 6 6 6"/></svg></button>
        <span class="rp-title"><b>Hint ${i + 1} of ${L.length}</b><span class="rp-trick">${esc(trick)}${h ? ` · at ${fmt(h.t)}` : ""}</span></span><span class="rp-pad"></span></div>
      <div class="rp-r2"><button class="rp-nav" data-rp="prev" ${i ? "" : "disabled"} aria-label="Previous hint">‹</button>
        <span class="rp-steps">${STEPS.map((s, j) => `<button data-rp="step" data-l="${j + 1}" class="${j + 1 === level ? "on" : ""}" ${h && j < h.n ? "" : "disabled"}>${s}</button>`).join("")}</span>
        <button class="rp-nav" data-rp="next" ${i < L.length - 1 ? "" : "disabled"} aria-label="Next hint">›</button></div>
      ${f ? "" : `<p class="rp-none">This hint wasn't saved on this device, so it can't be replayed.</p>`}`;
    if (f) apply(f, level, h);
  }
  bar.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-rp]"); if (!b || b.disabled) return;
    const a = b.dataset.rp;
    if (a === "back") return back();
    if (a === "prev") { i--; level = 1; }
    if (a === "next") { i++; level = 1; }
    if (a === "step") level = Number(b.dataset.l);
    show();
  });
  globalThis.sbLeave = back; // the app's glass back button
  show();
  return true;
}
