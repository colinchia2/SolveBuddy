// Shared by Home, Packs and Stats: the face, game colours, the browser-only tab bar, and streak maths.
import { haptic, solves } from "./bridge.js";

export const $ = (id) => document.getElementById(id);
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

// The SolveBuddy face (the app icon's logo): blue, light-bulb eyes. Classes let the wink move the right eye and smile.
export const FACE = `<svg class="logo" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" fill="#4D96FF"/>
<g fill="#FFFFFF" stroke="#5D4E37" stroke-width="3" stroke-linejoin="round"><path d="M33 22 A8 8 0 0 1 38 36.2 L37 41 H29 L28 36.2 A8 8 0 0 1 33 22 Z"/></g>
<path d="M29.5 45 H36.5 M30.5 49 H35.5" stroke="#5D4E37" stroke-width="3" stroke-linecap="round"/>
<g class="eye-r"><path d="M67 22 A8 8 0 0 1 72 36.2 L71 41 H63 L62 36.2 A8 8 0 0 1 67 22 Z" fill="#FFFFFF" stroke="#5D4E37" stroke-width="3" stroke-linejoin="round"/>
<path d="M63.5 45 H70.5 M64.5 49 H69.5" stroke="#5D4E37" stroke-width="3" stroke-linecap="round"/></g>
<path class="smile" d="M25 57 Q50 85 75 57" stroke="#5D4E37" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

// The header face (Buddy standard §2, 10/21). One "hello" (CSS .hello: wiggle, wink, smile) for a tap and the idle
// wink. Tap = hello + a light haptic, then onTap (Packs and Stats go to Library). Idle = after 10 quiet seconds (no
// touch in this page), hello again with no haptic, every further 10 quiet seconds. Never while the face is hidden (a
// game view on Home), a pop-up is up, the opening animation is playing (html.splash), the tab is in the background
// (the app calls sbFocus), or Reduce Motion is on.
export const IDLE_MS = 10000;
export function headerLogo(btn, onTap) {
  btn.innerHTML = FACE;
  const face = btn.querySelector(".logo");
  const hello = () => {
    face.classList.remove("hello");
    void face.getBoundingClientRect(); // restart it if it's mid-play
    face.classList.add("hello");
  };
  btn.onclick = () => {
    hello();
    haptic("tap");
    onTap?.();
  };
  let quietSince = Date.now(), focused = true;
  const touched = () => (quietSince = Date.now());
  for (const ev of ["pointerdown", "touchstart", "keydown", "wheel", "scroll"]) addEventListener(ev, touched, { capture: true, passive: true });
  globalThis.sbFocus = (on) => { focused = on; touched(); };
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  setInterval(() => {
    if (Date.now() - quietSince < IDLE_MS) return;
    touched();
    if (idleWinkAllowed({ focused, hidden: document.hidden, reduced: calm.matches, splash: document.documentElement.classList.contains("splash"),
      shown: !!btn.offsetParent, popup: !!document.querySelector(".scrim:not([hidden])") })) hello();
  }, 500);
}
// Pure, so the checks can test it.
export const idleWinkAllowed = (s) => s.focused && !s.hidden && !s.reduced && !s.splash && s.shown && !s.popup;

// Each game keeps its own tile colour (Star Battle coral, Sudoku teal); the app around them is blue.
export const LOOK = {
  starbattle: { bg: "#FBE3D6", ink: "#C24E2A", path: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z", size: "8×8" },
  sudoku: { bg: "#D7EEEA", ink: "#1F6F73", path: "M4 4h16v16H4z M4 9.3h16 M4 14.7h16 M9.3 4v16 M14.7 4v16", size: "9×9" },
};
export const gameIcon = (look, box, icon) => `<span class="gico" style="width:${box}px;height:${box}px;border-radius:${Math.round(box / 4.5)}px;background:${look.bg}" aria-hidden="true">
<svg width="${icon}" height="${icon}" viewBox="0 0 24 24" fill="none" stroke="${look.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${look.path}"/></svg></span>`;

export const FLAME = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#E8743F" aria-hidden="true"><path d="M12 2c1.2 3.4 5 5.2 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.2 1.6 1 2.6 2 3 0-3.5.3-6 1-8.5z"/></svg>`;
const TAB_ICONS = {
  home: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  packs: "M21 8l-9-5-9 5 9 5z M3 8v8l9 5 9-5V8 M12 13v8",
  stats: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
};
export const tabIcon = (name, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${TAB_ICONS[name]}"/></svg>`;

// The tab bar a browser shows (the app hides it and uses Apple's native one).
export function tabs(current) {
  const t = [["home", "Library"], ["packs", "Packs"], ["stats", "Stats"]];
  return `<nav class="tabs" aria-label="Tabs">${t.map(([p, label]) =>
    `<a href="${p}.html"${p === current ? ' aria-current="page"' : ""}>${tabIcon(p)}${label}</a>`).join("")}</nav>`;
}

// Days are the phone's local days.
export const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };

// Current streak (today, or up to yesterday if nothing yet today) and best streak, in days.
export function streaks(log = solves()) {
  const days = new Set(log.map((e) => dayKey(e.at)));
  let current = 0;
  let t = days.has(dayKey(Date.now())) ? Date.now() : addDays(Date.now(), -1);
  while (days.has(dayKey(t))) { current++; t = addDays(t, -1); }
  const sorted = [...new Set(log.map((e) => { const d = new Date(e.at); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const d of sorted) {
    run = prev !== null && dayKey(addDays(prev, 1)) === dayKey(d) ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best };
}
