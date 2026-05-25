// Persistent, user-rebindable keyboard bindings. Mirrors the pattern from
// graphics.js / sounds.js: one localStorage key, a change-event dispatcher,
// module-local cache.
//
// Action ids map to a single key string (the value of `KeyboardEvent.key`,
// lowercased for letters, or the literal name for arrows and space).
// Player.jsx and ConsumablesProvider read these via getKey(actionId) — so
// switching from WASD to e.g. arrow-keys takes effect the moment Settings
// saves the new binding.

const STORAGE_KEY = 'die-again-controls-v1';
const CHANGE_EVENT = 'die-again-controls-changed';

// Default bindings. The KEY VALUES below are exactly what
// `KeyboardEvent.key` reports (browsers send 'ArrowUp', ' ', 'a', etc.).
// We normalize letters to lowercase + treat ' ' as 'Space' for display.
export const ACTIONS = [
  // Group: Movement
  { id: 'moveForward',  group: 'Movement', label: 'Move forward',   default: 'w' },
  { id: 'moveBack',     group: 'Movement', label: 'Move back',      default: 's' },
  { id: 'moveLeft',     group: 'Movement', label: 'Strafe left',    default: 'a' },
  { id: 'moveRight',    group: 'Movement', label: 'Strafe right',   default: 'd' },
  { id: 'jump',         group: 'Movement', label: 'Jump',           default: ' '     },  // Space
  { id: 'roll',         group: 'Movement', label: 'Roll / dive',    default: 'c' },
  // Group: Camera
  { id: 'camLeft',      group: 'Camera',   label: 'Rotate camera left',  default: 'ArrowLeft' },
  { id: 'camRight',     group: 'Camera',   label: 'Rotate camera right', default: 'ArrowRight' },
  { id: 'camUp',        group: 'Camera',   label: 'Pitch up',            default: 'ArrowUp' },
  { id: 'camDown',      group: 'Camera',   label: 'Pitch down',          default: 'ArrowDown' },
  // Group: Game
  { id: 'restart',      group: 'Game',     label: 'Restart level',  default: 'r' },
  // Group: Potions
  { id: 'potionSpeed',  group: 'Potions',  label: 'Speed Potion',         default: '1' },
  { id: 'potionMagnet', group: 'Potions',  label: 'Jewel Magnet',         default: '2' },
  { id: 'potionGhost',  group: 'Potions',  label: 'Invisibility Potion',  default: '3' },
];

const DEFAULTS = Object.fromEntries(ACTIONS.map(a => [a.id, a.default]));

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    // Drop unknown keys, fill in missing with defaults.
    const merged = { ...DEFAULTS };
    for (const a of ACTIONS) {
      if (typeof parsed[a.id] === 'string' && parsed[a.id].length > 0) {
        merged[a.id] = parsed[a.id];
      }
    }
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

let _bindings = load();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_bindings)); } catch {}
}

function dispatch() {
  if (typeof window === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT)); } catch {}
}

// Returns the key string for an action. Letter keys always lowercase.
export function getKey(actionId) {
  return _bindings[actionId] || DEFAULTS[actionId];
}

export function getBindings() {
  return { ..._bindings };
}

// Compare a KeyboardEvent's `.key` against a bound key string. Handles
// the letter case (event.key is uppercase if shift is held, etc.) and
// normalizes space.
export function matches(eventKey, actionId) {
  if (typeof eventKey !== 'string') return false;
  const bound = getKey(actionId);
  if (!bound) return false;
  if (bound === ' ') return eventKey === ' ' || eventKey === 'Spacebar';
  // Letters: lowercase both sides for case-insensitive match.
  if (bound.length === 1) return eventKey.toLowerCase() === bound.toLowerCase();
  return eventKey === bound;
}

// Set a new binding. If the key is already used by another action, the
// other action is RESET to its default (so the player isn't stuck with
// no jump key etc. after a swap).
export function setBinding(actionId, key) {
  if (!ACTIONS.find(a => a.id === actionId)) return false;
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  // Detect conflict
  for (const id of Object.keys(_bindings)) {
    if (id !== actionId && _bindings[id] === normalized) {
      _bindings[id] = DEFAULTS[id];
    }
  }
  _bindings = { ..._bindings, [actionId]: normalized };
  persist();
  dispatch();
  return true;
}

export function resetBindings() {
  _bindings = { ...DEFAULTS };
  persist();
  dispatch();
}

export function subscribeControls(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

// Pretty label for a key string (used by Settings UI + Guide).
export function displayKey(key) {
  if (key === ' ') return 'Space';
  if (key === 'ArrowLeft')  return '←';
  if (key === 'ArrowRight') return '→';
  if (key === 'ArrowUp')    return '↑';
  if (key === 'ArrowDown')  return '↓';
  if (key.length === 1)     return key.toUpperCase();
  return key;
}
