// Persistent jewel purse — the in-game currency picked up as floating
// octahedron pickups, spent in the shop on cosmetics. Mirrors the pattern
// from graphics.js / sounds.js: one localStorage key, a custom event for
// change notifications, a tiny module-local cache.
//
// The Firebase sync (in App.js) reads the purse from progress.jewels when
// the user is signed in; cloud writes happen after every level complete.
// Local storage is the source of truth between sessions when offline.

const STORAGE_KEY = 'die-again-jewels-v1';
const CHANGE_EVENT = 'die-again-jewels-changed';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  } catch {}
  return 0;
}

let _balance = load();

export function getJewels() {
  return _balance;
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, String(_balance)); } catch {}
}

function dispatchChange() {
  if (typeof window === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT)); } catch {}
}

// Add (positive) jewels to the purse. Returns the new balance.
export function addJewels(amount) {
  const n = Math.max(0, Math.floor(amount));
  if (n === 0) return _balance;
  _balance += n;
  persist();
  dispatchChange();
  return _balance;
}

// Spend `amount` jewels — refuses if the player can't afford it.
// Returns true on success, false if balance was insufficient.
export function spendJewels(amount) {
  const n = Math.max(0, Math.floor(amount));
  if (n > _balance) return false;
  _balance -= n;
  persist();
  dispatchChange();
  return true;
}

// Overwrite the local balance from a cloud sync. Doesn't dispatch a change
// event if the value is identical (avoids unnecessary re-renders).
export function setJewelsFromCloud(amount) {
  const n = Math.max(0, Math.floor(amount));
  if (n === _balance) return;
  _balance = n;
  persist();
  dispatchChange();
}

export function subscribeJewels(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
