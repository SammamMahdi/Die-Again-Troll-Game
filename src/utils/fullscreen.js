// Cross-platform fullscreen toggle. Works in both the Tauri desktop wrapper
// (via the @tauri-apps/api/window API) and the plain web build (via the
// browser Fullscreen API). The two backends are kept behind one isDesktop
// guard so callers don't have to care which environment they're in.
//
// Public API:
//   isFullscreen()          → boolean, current state
//   toggleFullscreen()      → flips state; resolves to the new state
//   subscribeFullscreen(fn) → fn(isFull) called whenever state changes
//
// Notes:
// - On web, the browser only honors a fullscreen request from a real user
//   gesture (click/keydown). Calls outside a gesture get rejected silently.
// - On desktop, Tauri's setFullscreen has no gesture requirement, and
//   restores the previous window state cleanly on exit.

const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let _state = false;
const _listeners = new Set();

function notify() {
  for (const fn of _listeners) {
    try { fn(_state); } catch { /* ignore one bad subscriber */ }
  }
}

// Web side: keep _state in sync with the browser's own fullscreenchange event.
if (!isDesktop && typeof document !== 'undefined') {
  const onChange = () => {
    const next = !!document.fullscreenElement;
    if (next !== _state) {
      _state = next;
      notify();
    }
  };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
}

export function isFullscreen() {
  return _state;
}

export function subscribeFullscreen(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

async function toggleDesktop(next) {
  // Lazy-load the Tauri API so the web bundle doesn't pull in the module.
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().setFullscreen(next);
  _state = next;
  notify();
}

async function toggleWeb(next) {
  if (next) {
    const el = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } else if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
  }
  // fullscreenchange handler will sync _state.
}

export async function toggleFullscreen() {
  const next = !_state;
  try {
    if (isDesktop) await toggleDesktop(next);
    else await toggleWeb(next);
  } catch (err) {
    // Browser may reject the request (no user gesture, iframe restriction).
    // Swallow — we just leave _state untouched.
    // eslint-disable-next-line no-console
    console.warn('Fullscreen toggle failed:', err?.message || err);
  }
  return _state;
}

// Global F11 hotkey. Mounted once at import time. F11 is the universal
// fullscreen key on Windows so we hijack it from the browser's default
// (which on web would normally do native browser-chrome fullscreen, and
// in Tauri does nothing at all).
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullscreen();
    }
  });
}
