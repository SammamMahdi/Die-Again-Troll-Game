// Cosmetic catalogue + equip/own persistence. Mirrors the persistence
// pattern from graphics.js / sounds.js / jewels.js: one localStorage key,
// a change-event dispatcher, module-local cache.
//
// Player.jsx reads the *equipped* body + crown each frame and applies them
// to the player visual. Shop.jsx reads the *owned* set + balance to gate
// the Buy / Equip buttons.

const STORAGE_KEY = 'die-again-cosmetics-v1';
const CHANGE_EVENT = 'die-again-cosmetics-changed';

// ----- Catalogue -----
// Defaults (id 'default' / 'classic') are always owned + free, so a new
// player has a player to render before they earn anything.

// Prices are tuned so the cheapest item costs ~50 plays' worth of jewels
// (a typical play yields ~10-15 jewels: 5 commons + 2 bonuses, often
// missing one or two). Cheapest body = 500. Premium body = 3000.
// Crown Diamond = 1500. Halo = 3500. Full collection = ~12-13k jewels,
// i.e. real endgame grind.
export const BODY_CATALOG = [
  { id: 'default',  name: 'Default Green',    cost: 0,    color: '#37d164', emissive: '#33cc55', baseColor: '#1f7a39', baseEmissive: '#1a8a33', headColor: '#aeffce', headEmissive: '#5cff8a' },
  { id: 'cyan',     name: 'Cyan',             cost: 500,  color: '#38d8ff', emissive: '#33b8e6', baseColor: '#1f6e8a', baseEmissive: '#1a8aa8', headColor: '#aef0ff', headEmissive: '#5cdaff' },
  { id: 'sunset',   name: 'Sunset Orange',    cost: 800,  color: '#ff9844', emissive: '#ff6a1f', baseColor: '#8a4a1c', baseEmissive: '#aa5c20', headColor: '#ffd0a8', headEmissive: '#ffa05c' },
  { id: 'royal',    name: 'Royal Purple',     cost: 1000, color: '#a060ff', emissive: '#8a4ce0', baseColor: '#4e2a8a', baseEmissive: '#6038a8', headColor: '#d8b8ff', headEmissive: '#a888ff' },
  { id: 'crimson',  name: 'Crimson',          cost: 1200, color: '#ff4060', emissive: '#e02040', baseColor: '#8a1f2e', baseEmissive: '#a8243a', headColor: '#ffadbc', headEmissive: '#ff5c7a' },
  { id: 'frost',    name: 'Frostbite White',  cost: 1500, color: '#e8f0ff', emissive: '#c8d6ff', baseColor: '#9aa6c0', baseEmissive: '#b0bce0', headColor: '#ffffff', headEmissive: '#dde6ff' },
  { id: 'gold',     name: 'Gold',             cost: 2000, color: '#ffd233', emissive: '#ffa820', baseColor: '#8a6610', baseEmissive: '#a87a20', headColor: '#fff0a0', headEmissive: '#ffd966' },
  { id: 'void',     name: 'Void Black',       cost: 3000, color: '#1a1428', emissive: '#382a55', baseColor: '#0a0814', baseEmissive: '#1a1428', headColor: '#5040a0', headEmissive: '#8060d0' },
];

export const CROWN_CATALOG = [
  // 'none' (no crown) is the starting state — players begin bare-headed
  // and must buy a crown variant to wear one. Always owned + always free.
  { id: 'none',     name: 'No Crown',         cost: 0,    kind: 'none' },
  { id: 'classic',  name: 'Classic Torus',    cost: 300,  kind: 'torus' },
  { id: 'diamond',  name: 'Diamond',          cost: 1500, kind: 'diamond' },
  { id: 'halo',     name: 'Halo Ring',        cost: 3500, kind: 'halo' },
];

function defaultState() {
  return {
    ownedBody:    ['default'],
    ownedCrown:   ['none'],              // bare-headed by default
    equippedBody:  'default',
    equippedCrown: 'none',
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const def = defaultState();
    return {
      ownedBody:    Array.from(new Set([...def.ownedBody,  ...(parsed.ownedBody  || [])])),
      ownedCrown:   Array.from(new Set([...def.ownedCrown, ...(parsed.ownedCrown || [])])),
      equippedBody:  parsed.equippedBody  || def.equippedBody,
      equippedCrown: parsed.equippedCrown || def.equippedCrown,
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

// ----- Read -----

export function getCosmetics() {
  return _state;
}

export function getEquippedBody() {
  return BODY_CATALOG.find(b => b.id === _state.equippedBody) || BODY_CATALOG[0];
}

export function getEquippedCrown() {
  return CROWN_CATALOG.find(c => c.id === _state.equippedCrown) || CROWN_CATALOG[0];
}

export function isOwnedBody(id) {
  return _state.ownedBody.includes(id);
}

export function isOwnedCrown(id) {
  return _state.ownedCrown.includes(id);
}

// ----- Write -----

export function purchaseBody(id) {
  if (_state.ownedBody.includes(id)) return false;
  _state = { ..._state, ownedBody: [..._state.ownedBody, id] };
  persist();
  dispatch();
  return true;
}

export function purchaseCrown(id) {
  if (_state.ownedCrown.includes(id)) return false;
  _state = { ..._state, ownedCrown: [..._state.ownedCrown, id] };
  persist();
  dispatch();
  return true;
}

export function equipBody(id) {
  if (!_state.ownedBody.includes(id)) return false;
  if (_state.equippedBody === id) return false;
  _state = { ..._state, equippedBody: id };
  persist();
  dispatch();
  return true;
}

export function equipCrown(id) {
  if (!_state.ownedCrown.includes(id)) return false;
  if (_state.equippedCrown === id) return false;
  _state = { ..._state, equippedCrown: id };
  persist();
  dispatch();
  return true;
}

// Cloud-merge: takes the cloud-stored cosmetics record and unions the
// owned arrays into the local state. Equipped picks come from cloud if
// owned there, otherwise keep local.
export function applyCloudCosmetics(cloud) {
  if (!cloud) return;
  const merged = {
    ownedBody:    Array.from(new Set([..._state.ownedBody,  ...(cloud.ownedBody  || [])])),
    ownedCrown:   Array.from(new Set([..._state.ownedCrown, ...(cloud.ownedCrown || [])])),
    equippedBody:  (cloud.equippedBody  && (cloud.ownedBody  || []).includes(cloud.equippedBody))  ? cloud.equippedBody  : _state.equippedBody,
    equippedCrown: (cloud.equippedCrown && (cloud.ownedCrown || []).includes(cloud.equippedCrown)) ? cloud.equippedCrown : _state.equippedCrown,
  };
  // Skip dispatch if nothing changed (avoid spurious re-renders).
  if (
    merged.equippedBody === _state.equippedBody &&
    merged.equippedCrown === _state.equippedCrown &&
    merged.ownedBody.length === _state.ownedBody.length &&
    merged.ownedCrown.length === _state.ownedCrown.length
  ) return;
  _state = merged;
  persist();
  dispatch();
}

// ----- Subscribe -----

export function subscribeCosmetics(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
