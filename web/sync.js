// iCloud sync (Colin 11/1): the same stats on his iPhone and iPad, no account and no server. The app keeps a copy
// of a few saved things in Apple's iCloud key-value store (same Apple ID = same store) and hands it to each page
// before it loads (window.SB_CLOUD = { key: '{"at":…,"v":"…"}' }). Here the page merges that into its own storage,
// and sends back any key it changes ({ type: "cloud", key, value }). When the other device changes something while
// a page is open, the app calls window.sbCloud(changes) and the page merges again and redraws.
// Only in an app build that has iCloud (SB_CLOUD set); in a browser or an older app nothing here runs.
//
// How each kept thing merges, so nothing is lost when both devices play:
// - the solve log (stats, streaks): every solve from both, once each;
// - finished boards ("View solved puzzle"): every puzzle from both;
// - Block Drop: the higher best score, best lines and games played (a game left half-done stays on its device);
// - settings, Water Sort's look per import and your own imports: whichever device changed them last.
// Games left half-done are not synced: each device keeps its own.
export const SYNCED = {
  "solvebuddy.solves": "solves",
  "solvebuddy.finals": "union",
  "solvebuddy.blocks": "blocks",
  "solvebuddy.settings": "last",
  "solvebuddy.waterLook": "last",
  "solvebuddy.imports": "last",
};
const AT_KEY = "solvebuddy.syncAt"; // when this device last changed each "last" key
// What sync has done on this device, for the line at the bottom of Stats (Colin 11/1: "the stats don't match"):
// { on, keys (in iCloud when the page opened), sentAt, gotAt (last time the other device's data changed ours) }.
const INFO_KEY = "solvebuddy.syncInfo";
export function syncStatus(win = globalThis) {
  const info = parse(win.localStorage?.getItem(INFO_KEY), {});
  return { ...info, on: !!(win.SB_CLOUD && typeof win.SB_CLOUD === "object"), inApp: !!win.SOLVEBUDDY_APP, keys: win.SB_CLOUD ? Object.keys(win.SB_CLOUD).filter((k) => k in SYNCED).length : 0 };
}

const parse = (s, d) => { try { return s == null ? d : JSON.parse(s); } catch { return d; } };
const solveId = (e) => `${e.g}|${e.pack}|${e.p}|${e.at}`;

// Merge one key: mine and theirs are the raw stored strings (either may be null). Returns the merged string.
export function mergeValue(key, mine, theirs, mineAt = 0, theirsAt = 0) {
  if (theirs == null) return mine;
  if (mine == null) return theirs;
  const how = SYNCED[key];
  if (how === "solves") {
    const all = new Map();
    for (const e of [...parse(mine, []), ...parse(theirs, [])]) if (e && !all.has(solveId(e))) all.set(solveId(e), e);
    return JSON.stringify([...all.values()].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)));
  }
  if (how === "union") return JSON.stringify({ ...parse(theirs, {}), ...parse(mine, {}) });
  if (how === "blocks") {
    const a = parse(mine, {}), b = parse(theirs, {});
    const top = (k) => Math.max(a[k] ?? 0, b[k] ?? 0);
    return JSON.stringify({ ...a, best: top("best"), bestLines: top("bestLines"), played: top("played") });
  }
  return theirsAt > mineAt ? theirs : mine; // "last"
}
// What goes to iCloud for a key: Block Drop's half-done game stays on this device.
function outgoing(key, raw) {
  if (SYNCED[key] !== "blocks") return raw;
  const { saved, ...rest } = parse(raw, {});
  return JSON.stringify(rest);
}

export function startSync(win = globalThis) {
  if (!win.SB_CLOUD || typeof win.SB_CLOUD !== "object" || !win.localStorage) return false;
  const ls = win.localStorage, proto = Object.getPrototypeOf(ls);
  const rawSet = proto.setItem;
  const set = (k, v) => rawSet.call(ls, k, v); // a write that isn't sent back out
  const ats = () => parse(ls.getItem(AT_KEY), {});
  const note = (patch) => set(INFO_KEY, JSON.stringify({ ...parse(ls.getItem(INFO_KEY), {}), ...patch }));
  const sent = {}; // the last value sent per key, so the same thing isn't sent twice
  const send = (key) => {
    const raw = ls.getItem(key);
    if (raw == null) return;
    const value = JSON.stringify({ at: ats()[key] ?? 0, v: outgoing(key, raw) });
    if (sent[key] === value) return;
    sent[key] = value;
    win.ReactNativeWebView?.postMessage(JSON.stringify({ type: "cloud", key, value }));
    note({ sentAt: Date.now() });
  };
  // Take in what iCloud has; send back anything iCloud is missing. Returns whether this page's storage changed.
  const apply = (cloud) => {
    let changed = false;
    for (const key of Object.keys(SYNCED)) {
      const env = parse(cloud?.[key], null);
      const mine = ls.getItem(key), myAt = ats()[key] ?? 0;
      if (env) sent[key] = cloud[key];
      const merged = mergeValue(key, mine, env?.v ?? null, myAt, env?.at ?? 0);
      if (merged !== mine && merged != null) {
        set(key, merged);
        changed = true;
        if (SYNCED[key] === "last") set(AT_KEY, JSON.stringify({ ...ats(), [key]: env.at }));
      }
      if (merged != null && (!env || outgoing(key, merged) !== env.v)) send(key);
    }
    if (changed) note({ gotAt: Date.now() });
    return changed;
  };
  // Every write to a kept key goes out to iCloud (a moment later, so a burst of writes sends once).
  const timers = {};
  proto.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this !== ls || !(k in SYNCED)) return;
    if (SYNCED[k] === "last") set(AT_KEY, JSON.stringify({ ...ats(), [k]: Date.now() }));
    clearTimeout(timers[k]);
    timers[k] = setTimeout(() => send(k), 300);
  };
  win.addEventListener?.("pagehide", () => { for (const k of Object.keys(timers)) { clearTimeout(timers[k]); send(k); } });
  apply(win.SB_CLOUD);
  // The other device changed something while this page is open: merge it and redraw.
  win.sbCloud = (changes) => { note({ heardAt: Date.now() }); if (apply(changes)) win.sbRefresh?.(); };
  // Send everything again (tapping the line on Stats).
  win.sbResync = () => { for (const k of Object.keys(sent)) delete sent[k]; for (const k of Object.keys(SYNCED)) send(k); };
  return true;
}
startSync();
