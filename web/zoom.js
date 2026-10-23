// Two-finger zoom for the big boards (Colin 10/23, docs/design/zoom_nonogram_mockup.html): Star Battle 10×10 and up,
// Nonogram 15×15. One finger always plays (the game's own pointer handlers); two fingers pinch to zoom and slide to
// move; zooming out past the whole board springs back with a small bounce; two-finger double-tap = fit; a Fit control
// (tiny map + zoom level + Fit) shows while zoomed, with "Two fingers to move · pinch to zoom out" under it; at fit, the
// first few times, the tip line says "Pinch with two fingers to zoom". Touch events only, in the page: no app change.
//
// The game gives:
//   view      the element the fingers touch (it clips the board)
//   geom(z)   where the board sits at zoom z: { ox, oy, visW, visH, w, h } = the visible board area's offset and size
//             inside view, and the board's full size at that zoom
//   apply(s)  draw the board at { z, x, y } (x, y = how far it's panned, in px at that zoom)
//   mapColors() → n×n colours for the tiny map;  onTwoFingers() = cancel any one-finger mark in progress
//   ctl, tip  where the Fit control and the tip line go; onZoomed(on) to swap the game's own info (count) out
import { haptic } from "./bridge.js";

const TIPS_KEY = "solvebuddy.zoomTips";
const TIP_TIMES = 3; // the pinch tip shows on the first 3 zoomable boards you open, until you've zoomed twice
const readTips = () => { try { return JSON.parse(localStorage.getItem(TIPS_KEY) || "{}"); } catch { return {}; } };
const writeTips = (t) => { try { localStorage.setItem(TIPS_KEY, JSON.stringify(t)); } catch {} };

const PINCH = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5l5 5 M5 5h4 M5 5v4 M19 19l-5-5 M19 19h-4 M19 19v-4"/></svg>`;
const HAND = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5a1.5 1.5 0 0 1 3 0v5 M12 10V4a1.5 1.5 0 0 1 3 0v6 M15 10V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.5 13a1.5 1.5 0 0 1 2.5-1.6L9 14"/></svg>`;
const FIT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5"/></svg>`;

// Rubber band: past a limit, the board follows the fingers less and less.
const rubber = (v, lo, hi, k = 0.35) => (v < lo ? lo - (lo - v) * k : v > hi ? hi + (v - hi) * k : v);
// A small overshoot, then settle (the "spring back with a small bounce").
const easeOutBack = (t) => { const s = 1.4; return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2; };

// A second finger's pointer (the first finger plays; two fingers zoom). Test events without a pointer type count as first.
export const second = (e) => e.pointerType === "touch" && !e.isPrimary;

export function makeZoom({ view, geom, apply, mapColors, onTwoFingers, onZoomed, ctl, tip, tipText = "", zmax = 2.5 }) {
  const st = { z: 1, x: 0, y: 0 };
  let enabled = false, anim = 0, gesture = null, lastTwoTap = 0, zoomedNow = false;
  const z0 = { busy: false };
  const waiting = []; // things to do once every finger is up (see whenFree)

  ctl.innerHTML = `<span class="zoomctl glass" hidden><svg class="zmap" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"></svg>
    <span class="zx"></span><button class="zfit" aria-label="Fit the whole board">${FIT}Fit</button></span>
    <span class="zcap" hidden>${HAND}Two fingers to move · pinch to zoom out</span>`;
  const box = ctl.querySelector(".zoomctl"), cap = ctl.querySelector(".zcap"), map = ctl.querySelector(".zmap"), zx = ctl.querySelector(".zx");
  ctl.querySelector(".zfit").onclick = () => { haptic("tap"); fit(); };

  // Pan limits at zoom z; a board smaller than its window stays centred.
  function limits(z) {
    const g = geom(z);
    const lo = (w, vis) => (w <= vis ? -(vis - w) / 2 : 0), hi = (w, vis) => (w <= vis ? -(vis - w) / 2 : w - vis);
    return { g, xlo: lo(g.w, g.visW), xhi: hi(g.w, g.visW), ylo: lo(g.h, g.visH), yhi: hi(g.h, g.visH) };
  }
  function draw() {
    apply({ ...st });
    const on = enabled && st.z > 1.02;
    if (on !== zoomedNow) { zoomedNow = on; box.hidden = cap.hidden = ctl.hidden = !on; onZoomed?.(on); showTip(); }
    if (on) {
      const { g } = limits(st.z);
      const f = (v) => Math.max(0, Math.min(26, v));
      const x0 = f((st.x / g.w) * 26), y0 = f((st.y / g.h) * 26), x1 = f(((st.x + g.visW) / g.w) * 26), y1 = f(((st.y + g.visH) / g.h) * 26);
      const b = map.querySelector(".zbox");
      if (b) { b.setAttribute("x", x0); b.setAttribute("y", y0); b.setAttribute("width", Math.max(1, x1 - x0)); b.setAttribute("height", Math.max(1, y1 - y0)); }
      zx.textContent = `${st.z.toFixed(1)}×`;
    }
  }
  function refreshMap() {
    if (!enabled) return;
    const cols = mapColors();
    const n = cols.length, u = 26 / n;
    let cells = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < cols[r].length; c++) cells += `<rect x="${(c * u).toFixed(2)}" y="${(r * u).toFixed(2)}" width="${(u + 0.06).toFixed(2)}" height="${(u + 0.06).toFixed(2)}" fill="${cols[r][c]}"/>`;
    map.innerHTML = `<rect width="26" height="26" fill="#FFFDF9"/>${cells}<rect class="zbox" fill="rgba(47,111,214,0.18)" stroke="#2F6FD6" stroke-width="1.6" rx="1.5"/>`;
    draw();
  }
  // The tip line: the pinch hint at fit (first few times), nothing while zoomed (the caption by Fit says it).
  let tipThisBoard = false;
  function showTip() {
    if (!tip) return;
    const pinch = enabled && !zoomedNow && tipThisBoard;
    tip.innerHTML = pinch ? `${PINCH}Pinch with two fingers to zoom` : tipText;
    tip.classList.toggle("zoomtip", pinch);
    tip.hidden = zoomedNow || !tip.innerHTML;
  }

  function animateTo(target, ms = 380, ease = easeOutBack) {
    cancelAnimationFrame(anim);
    const from = { ...st }, t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms), e = ease(t);
      st.z = from.z + (target.z - from.z) * e;
      st.x = from.x + (target.x - from.x) * e;
      st.y = from.y + (target.y - from.y) * e;
      draw();
      if (t < 1) anim = requestAnimationFrame(step);
      else { Object.assign(st, target); draw(); }
    };
    anim = requestAnimationFrame(step);
  }
  // Back inside the limits: zoom between fit and the most, the board within its window.
  function settle() {
    const z = Math.max(1, Math.min(zmax, st.z));
    const L = limits(z);
    // Keep the middle of what you see in the middle while the zoom springs back.
    const g = limits(st.z).g;
    const cx = (st.x + g.visW / 2) / st.z, cy = (st.y + g.visH / 2) / st.z;
    let x = cx * z - L.g.visW / 2, y = cy * z - L.g.visH / 2;
    if (z === 1) { x = L.xlo; y = L.ylo; }
    x = Math.max(L.xlo, Math.min(L.xhi, x));
    y = Math.max(L.ylo, Math.min(L.yhi, y));
    if (Math.abs(z - st.z) > 0.001 || Math.abs(x - st.x) > 0.5 || Math.abs(y - st.y) > 0.5) animateTo({ z, x, y });
  }
  function fit() { const L = limits(1); animateTo({ z: 1, x: L.xlo, y: L.ylo }); }

  // Touches. Two fingers anywhere on the board start a zoom/move; from then until every finger lifts, one-finger
  // play is off (busy), so the first finger never leaves a mark. No page scroll or bounce while touching the board.
  const pt = (t) => { const r = view.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; };
  function start(e) {
    if (!enabled || e.touches.length < 2) return;
    e.preventDefault();
    cancelAnimationFrame(anim);
    const was = z0.busy;
    z0.busy = true; // first, so the game's cancel waits for the fingers to lift before redrawing
    if (!was) onTwoFingers?.();
    const a = pt(e.touches[0]), b = pt(e.touches[1]);
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const g = geom(st.z);
    gesture = { d0: d, m0: m, z0: st.z, u: (m.x - g.ox + st.x) / st.z, v: (m.y - g.oy + st.y) / st.z, t0: Date.now(), moved: 0 };
  }
  function move(e) {
    e.preventDefault(); // the board owns its touches: no page scroll, no rubber-band bounce, no browser zoom
    if (!gesture || e.touches.length < 2) return;
    const a = pt(e.touches[0]), b = pt(e.touches[1]);
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    gesture.moved = Math.max(gesture.moved, Math.abs(d - gesture.d0), Math.hypot(m.x - gesture.m0.x, m.y - gesture.m0.y));
    const z = rubber(gesture.z0 * (d / gesture.d0), 1, zmax, 0.4);
    const g = geom(z);
    const L = limits(z);
    st.z = z;
    st.x = rubber(gesture.u * z - (m.x - g.ox), L.xlo, L.xhi);
    st.y = rubber(gesture.v * z - (m.y - g.oy), L.ylo, L.yhi);
    draw();
  }
  function end(e) {
    if (gesture && e.touches.length < 2) {
      const quick = Date.now() - gesture.t0 < 300 && gesture.moved < 18;
      gesture = null;
      if (quick && Date.now() - lastTwoTap < 450) { lastTwoTap = 0; fit(); } // two-finger double-tap = fit
      else { if (quick) lastTwoTap = Date.now(); settle(); }
      if (st.z > 1.05 || zoomedNow) { const t = readTips(); t.zoomed = (t.zoomed ?? 0) + 1; writeTips(t); }
    }
    if (e.touches.length === 0) setTimeout(() => { z0.busy = false; const q = waiting.splice(0); q.forEach((f) => f()); }, 0);
  }
  view.addEventListener("touchstart", start, { passive: false });
  view.addEventListener("touchmove", move, { passive: false });
  view.addEventListener("touchend", end);
  view.addEventListener("touchcancel", end);
  // Safari's own pinch events: never let the page zoom.
  view.addEventListener("gesturestart", (e) => e.preventDefault());
  // A trackpad pinch in a desktop browser (ctrl + wheel): handy for testing.
  view.addEventListener("wheel", (e) => {
    if (!enabled || !e.ctrlKey) return;
    e.preventDefault();
    const r = view.getBoundingClientRect(), g = geom(st.z);
    const mx = e.clientX - r.left, my = e.clientY - r.top, u = (mx - g.ox + st.x) / st.z, v = (my - g.oy + st.y) / st.z;
    const z = Math.max(1, Math.min(zmax, st.z * Math.exp(-e.deltaY / 200))), g2 = geom(z), L = limits(z);
    Object.assign(st, { z, x: Math.max(L.xlo, Math.min(L.xhi, u * z - (mx - g2.ox))), y: Math.max(L.ylo, Math.min(L.yhi, v * z - (my - g2.oy))) });
    draw();
  }, { passive: false });

  return Object.assign(z0, {
    // A new board: zoom on or off for it, starting from its saved zoom or fit.
    reset(on, saved) {
      enabled = on;
      cancelAnimationFrame(anim);
      view.classList.toggle("zoomable", on);
      const L = limits(1);
      Object.assign(st, { z: 1, x: L.xlo, y: L.ylo });
      if (on && saved?.z > 1) { const S = limits(saved.z); Object.assign(st, { z: Math.min(zmax, saved.z), x: Math.max(S.xlo, Math.min(S.xhi, saved.x)), y: Math.max(S.ylo, Math.min(S.yhi, saved.y)) }); }
      tipThisBoard = false;
      if (on) {
        const t = readTips();
        tipThisBoard = (t.shown ?? 0) < TIP_TIMES && (t.zoomed ?? 0) < 2;
        if (tipThisBoard) { t.shown = (t.shown ?? 0) + 1; writeTips(t); }
      }
      zoomedNow = null; // so draw() syncs the controls either way
      draw();
      refreshMap();
      showTip();
    },
    fit, refreshMap, redraw: draw,
    // Run fn once every finger has lifted. A board that rebuilds its cells must wait: a touched cell taken out of the
    // page mid-gesture stops sending its touches to the board.
    whenFree(fn) { if (z0.busy) waiting.push(fn); else fn(); },
    state: () => ({ ...st }),
    isOn: () => enabled,
    setTipText(t) { tipText = t; showTip(); },
  });
}
