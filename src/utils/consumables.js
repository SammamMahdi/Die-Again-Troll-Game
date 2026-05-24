// Consumables — usable items players buy in the shop and burn during a
// run. Distinct from cosmetics (which are permanent unlocks).
//
// Catalogue:
//   - extra_life  : auto-consumed on the would-be-last death in Hardcore;
//                   refills triesLeft to HARDCORE_TRIES so the run survives.
//   - speed_potion: press 1 during a level → +50% movement speed for 15s.
//   - jewel_magnet: press 2 during a level → +4-unit pickup radius on
//                   jewels for 12s. Useful for tricky bonus jewels.
//
// Persistence + sync mirrors cosmetics.js / jewels.js: localStorage key,
// custom event for re-renders, module-local cache. Counts roll into the
// Firestore scores doc on every level complete.

const STORAGE_KEY = 'die-again-consumables-v1';
const CHANGE_EVENT = 'die-again-consumables-changed';

export const CONSUMABLES_CATALOG = [
  {
    id: 'extra_life',
    name: 'Extra Life',
    cost: 750,
    icon: '❤',
    desc: 'Auto-saves a Hardcore run from a 3rd-try death. Refills tries to 3.',
    hotkey: null,    // passive (auto)
  },
  {
    id: 'speed_potion',
    name: 'Speed Potion',
    cost: 500,
    icon: '⚡',
    desc: '+50% movement speed for 15 seconds. Activate with key 1.',
    hotkey: '1',
    duration: 15,
  },
  {
    id: 'jewel_magnet',
    name: 'Jewel Magnet',
    cost: 600,
    icon: '🧲',
    desc: 'Pulls nearby jewels for 12 seconds — wider pickup radius. Activate with key 2.',
    hotkey: '2',
    duration: 12,
  },
];

function defaultState() {
  return {
    counts: {},   // { [id]: number }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { counts: parsed.counts || {} };
  } catch {
    return defaultState();
  }
}

let _state = load();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch {}
}

function dispatch() {
  if (typeof window === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT)); } catch {}
}

export function getInventory() {
  return _state.counts;
}

export function countOf(id) {
  return _state.counts[id] || 0;
}

export function purchaseConsumable(id) {
  const def = CONSUMABLES_CATALOG.find(c => c.id === id);
  if (!def) return false;
  _state = {
    counts: { ..._state.counts, [id]: (_state.counts[id] || 0) + 1 },
  };
  persist();
  dispatch();
  return true;
}

// Decrement (consume one). Returns true if there was one to consume.
export function consumeOne(id) {
  const cur = _state.counts[id] || 0;
  if (cur <= 0) return false;
  _state = {
    counts: { ..._state.counts, [id]: cur - 1 },
  };
  persist();
  dispatch();
  return true;
}

export function applyCloudInventory(cloud) {
  if (!cloud) return;
  const merged = { ..._state.counts };
  for (const k of Object.keys(cloud)) {
    // Cloud wins: it's the truth across devices. But never go negative.
    merged[k] = Math.max(0, Number(cloud[k]) || 0);
  }
  // Skip dispatch if identical.
  const same = Object.keys(merged).every(k => merged[k] === (_state.counts[k] || 0))
    && Object.keys(_state.counts).every(k => merged[k] === _state.counts[k]);
  if (same) return;
  _state = { counts: merged };
  persist();
  dispatch();
}

export function subscribeConsumables(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
