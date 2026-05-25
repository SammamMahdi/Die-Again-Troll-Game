// Consumables — usable items players buy in the shop and burn during a
// run. Distinct from cosmetics (which are permanent unlocks).
//
// Each potion has TWO layers of progression:
//   1. Inventory count — how many you own; consumed when you press the hotkey.
//   2. Upgrade level (1-5) — permanent shop unlock. Higher level = longer
//      duration (Speed / Invisibility) or stronger pull (Magnet).
//
// The upgrade level affects EVERY future use of that potion. Buying more
// of a potion stocks your inventory; upgrading it makes every drink more
// powerful.

const STORAGE_KEY = 'die-again-consumables-v1';
const CHANGE_EVENT = 'die-again-consumables-changed';

// ---------- Base catalogue ----------
// `baseDuration` is the LEVEL 1 duration. Effective duration scales per
// upgrade level (see UPGRADE_TIERS below).
export const CONSUMABLES_CATALOG = [
  {
    id: 'extra_life',
    name: 'Extra Life',
    cost: 350,
    icon: '❤',
    desc: 'Saves a Hardcore run from a 3rd-try death (prompts you first). Refills tries to 3.',
    hotkey: null,    // passive (prompt-on-death)
  },
  {
    id: 'jewel_magnet',
    name: 'Jewel Magnet',
    cost: 200,
    icon: '🧲',
    desc: 'Nearby jewels fly toward you. Activate with key 1.',
    hotkey: '1',
    baseDuration: 12,
  },
  {
    id: 'invisibility_potion',
    name: 'Invisibility Potion',
    cost: 400,
    icon: '👻',
    desc: 'Hazards pass through you. Activate with key 2.',
    hotkey: '2',
    baseDuration: 8,
  },
];

// ---------- Upgrade tiers ----------
//
// `cost` is the price to GO FROM the previous level TO this level. Level 1
// is the starting state — no purchase required. Levels 2–5 cost the listed
// amount (steep curve so maxing out is genuine endgame grind).
//
// `mods` is what changes at this level vs. base:
//   - duration: effective seconds when activated
//   - radius:   magnet pull radius (units)
//   - strength: magnet pull acceleration (units/s²)
//
// Invisibility Potion — pure duration scaling.
const INVIS_TIERS = [
  { level: 1, cost: 0,    duration: 8  },
  { level: 2, cost: 600,  duration: 10 },
  { level: 3, cost: 1400, duration: 13 },
  { level: 4, cost: 3200, duration: 17 },
  { level: 5, cost: 7000, duration: 22 },
];

// Jewel Magnet — radius grows modestly, pull strength scales steeply so
// higher tiers feel snappy. At L1 the pull is just barely active; at L5
// jewels actively chase the player from across small platforms.
const MAGNET_TIERS = [
  { level: 1, cost: 0,    duration: 12, radius: 4.5,  strength: 6   },
  { level: 2, cost: 400,  duration: 13, radius: 5.5,  strength: 11  },
  { level: 3, cost: 1000, duration: 15, radius: 6.5,  strength: 18  },
  { level: 4, cost: 2400, duration: 17, radius: 7.5,  strength: 28  },
  { level: 5, cost: 5000, duration: 20, radius: 9.0,  strength: 42  },
];

export const UPGRADE_TIERS = {
  invisibility_potion: INVIS_TIERS,
  jewel_magnet:        MAGNET_TIERS,
};

// IDs that can be upgraded. Extra Life is one-shot save, no upgrades.
export const UPGRADABLE_IDS = Object.keys(UPGRADE_TIERS);
export const MAX_UPGRADE_LEVEL = 5;

// ---------- Persistence ----------
function defaultState() {
  return {
    counts:   {},                                                  // { [id]: number }
    upgrades: { jewel_magnet: 1, invisibility_potion: 1 },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const def = defaultState();
    return {
      counts:   parsed.counts   || {},
      upgrades: { ...def.upgrades, ...(parsed.upgrades || {}) },
    };
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

// ---------- Inventory ----------
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
    ..._state,
    counts: { ..._state.counts, [id]: (_state.counts[id] || 0) + 1 },
  };
  persist();
  dispatch();
  return true;
}

export function consumeOne(id) {
  const cur = _state.counts[id] || 0;
  if (cur <= 0) return false;
  _state = {
    ..._state,
    counts: { ..._state.counts, [id]: cur - 1 },
  };
  persist();
  dispatch();
  return true;
}

// ---------- Upgrades ----------
export function getUpgrades() {
  return _state.upgrades;
}

export function getUpgradeLevel(id) {
  return _state.upgrades[id] || 1;
}

// Effective tier object (duration / radius / strength) for an id at the
// player's current upgrade level. Falls back to L1 if id has no tiers.
export function getEffectiveTier(id) {
  const tiers = UPGRADE_TIERS[id];
  if (!tiers) return null;
  const lvl = Math.min(getUpgradeLevel(id), MAX_UPGRADE_LEVEL);
  return tiers.find(t => t.level === lvl) || tiers[0];
}

// Effective duration in seconds for a Speed / Invisibility / Magnet
// potion at the player's current upgrade level.
export function getEffectiveDuration(id) {
  const tier = getEffectiveTier(id);
  return tier ? tier.duration : 0;
}

// Cost to reach the NEXT level (level + 1). null if already maxed.
export function getNextUpgradeCost(id) {
  const tiers = UPGRADE_TIERS[id];
  if (!tiers) return null;
  const lvl = getUpgradeLevel(id);
  if (lvl >= MAX_UPGRADE_LEVEL) return null;
  const next = tiers.find(t => t.level === lvl + 1);
  return next ? next.cost : null;
}

// Bump upgrade level by 1. Caller must verify affordability + spend the
// jewels themselves (this function doesn't touch the purse).
export function applyUpgrade(id) {
  const tiers = UPGRADE_TIERS[id];
  if (!tiers) return false;
  const cur = getUpgradeLevel(id);
  if (cur >= MAX_UPGRADE_LEVEL) return false;
  _state = {
    ..._state,
    upgrades: { ..._state.upgrades, [id]: cur + 1 },
  };
  persist();
  dispatch();
  return true;
}

// ---------- Cloud sync ----------
export function applyCloudInventory(cloud) {
  if (!cloud) return;
  const merged = { ..._state.counts };
  for (const k of Object.keys(cloud)) {
    merged[k] = Math.max(0, Number(cloud[k]) || 0);
  }
  const same = Object.keys(merged).every(k => merged[k] === (_state.counts[k] || 0))
    && Object.keys(_state.counts).every(k => merged[k] === _state.counts[k]);
  if (same) return;
  _state = { ..._state, counts: merged };
  persist();
  dispatch();
}

// Cloud-side upgrade levels — same merge rule (cloud wins, clamp 1..MAX).
export function applyCloudUpgrades(cloud) {
  if (!cloud) return;
  const merged = { ..._state.upgrades };
  for (const k of Object.keys(cloud)) {
    const n = Math.max(1, Math.min(MAX_UPGRADE_LEVEL, Math.floor(Number(cloud[k]) || 1)));
    merged[k] = n;
  }
  const same = Object.keys(merged).every(k => merged[k] === (_state.upgrades[k] || 1))
    && Object.keys(_state.upgrades).every(k => merged[k] === _state.upgrades[k]);
  if (same) return;
  _state = { ..._state, upgrades: merged };
  persist();
  dispatch();
}

export function subscribeConsumables(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
