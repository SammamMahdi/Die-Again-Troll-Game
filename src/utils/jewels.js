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

// Admin override — when an admin toggles adminMode on, jewels are treated
// as unlimited. `getJewels()` reports a huge ceiling so HUD/Shop reads
// always show "you can afford this", and `spendJewels()` is a no-op so
// the persistent purse isn't drained while testing shop flows.
// The persisted local balance is untouched; toggling admin off reverts
// the player to whatever they actually had.
let _adminUnlimited = false;
const ADMIN_CEILING = 999999999;

export function setAdminUnlimited(on) {
  const next = !!on;
  if (next === _adminUnlimited) return;
  _adminUnlimited = next;
  dispatchChange();
}

export function isAdminUnlimited() {
  return _adminUnlimited;
}

export function getJewels() {
  return _adminUnlimited ? ADMIN_CEILING : _balance;
}

// Returns the actual persisted balance regardless of admin mode. Use this
// when syncing to the cloud so the dev's admin-unlimited override never
// corrupts the real purse stored against their account.
export function getRealJewels() {
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
// In admin-unlimited mode the spend is a no-op (always succeeds, balance
// unchanged) so testing the shop doesn't drain the dev's real purse.
export function spendJewels(amount) {
  if (_adminUnlimited) return true;
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
