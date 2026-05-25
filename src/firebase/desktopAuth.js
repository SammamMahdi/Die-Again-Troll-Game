// Desktop-only OAuth glue. Listens for dieagain:// deep-link callbacks
// fired by the hosted OAuth relay page, extracts the Google idToken, and
// hands it to Firebase's signInWithCredential.
//
// Flow (all stages happen in the user's *system* browser EXCEPT step 4):
//   1. User clicks "Continue with Google" on the desktop AuthModal.
//   2. Tauri's shell.open launches the system browser at
//      https://<host>/desktop-oauth.html — a page hosted on the same
//      Firebase Hosting site as the regular web build.
//   3. The relay page runs signInWithPopup (works fine in a real browser)
//      then redirects to dieagain://auth?id_token=<token>.
//   4. Windows routes the dieagain:// URL to the running desktop app via
//      the deep-link plugin, and onOpenUrl below fires.
//   5. We parse the idToken, call signInWithGoogleIdToken, and Firebase's
//      onAuthStateChanged subscribers light up across the app — same code
//      path as web Google sign-in.

import { signInWithGoogleIdToken } from './index';

const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Where the relay page is hosted. Firebase Hosting maps the project ID
// `die-again-troll-game` to this domain by default — see firebase.json
// in the repo root. If you point the desktop build at a different host,
// change this string.
const RELAY_URL = 'https://die-again-troll-game.web.app/desktop-oauth.html';

let _initialized = false;
let _pendingResolvers = [];   // resolved when a deep-link signin completes

// Listen for incoming dieagain:// URLs. Should be called ONCE at app
// startup. Subsequent calls are no-ops.
export async function initDesktopAuth() {
  if (!isDesktop || _initialized) return;
  _initialized = true;
  try {
    const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link');

    // Cold start: app launched FROM a deep-link (Windows started the app
    // because the user clicked dieagain://... in the browser AFTER signing
    // in). getCurrent() returns those startup URLs once.
    const initial = await getCurrent();
    if (Array.isArray(initial)) {
      for (const url of initial) handleDeepLink(url);
    }

    // Hot path: app was already running; the deep-link is forwarded live.
    await onOpenUrl((urls) => {
      for (const url of urls) handleDeepLink(url);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[desktopAuth] init failed:', err?.message || err);
  }
}

async function handleDeepLink(url) {
  try {
    const u = new URL(url);
    // Accept dieagain://auth or dieagain:///auth or dieagain:auth — different
    // OS callers normalize the URL slightly differently.
    const path = (u.host || u.pathname || '').replace(/^\/+/, '');
    if (!path.startsWith('auth')) return;
    const idToken = u.searchParams.get('id_token');
    const error = u.searchParams.get('error');
    if (error) {
      const err = new Error(error);
      _pendingResolvers.forEach(r => r.reject(err));
      _pendingResolvers = [];
      return;
    }
    if (!idToken) return;
    const user = await signInWithGoogleIdToken(idToken);
    _pendingResolvers.forEach(r => r.resolve(user));
    _pendingResolvers = [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[desktopAuth] handleDeepLink failed:', err?.message || err);
    _pendingResolvers.forEach(r => r.reject(err));
    _pendingResolvers = [];
  }
}

// Open the system browser at the relay page, then return a promise that
// resolves with the Firebase user once the deep-link callback completes.
// Rejects after `timeoutMs` if no callback arrives (user closed the
// browser, dismissed the OAuth prompt, etc.).
export async function signInWithGoogleViaSystemBrowser(timeoutMs = 120000) {
  if (!isDesktop) throw new Error('Desktop-only API');
  const { open } = await import('@tauri-apps/plugin-shell');
  // Cache-bust so the relay page never lands on a stale signed-in state
  // from a previous attempt — the page expects to start fresh.
  const url = `${RELAY_URL}?t=${Date.now()}`;
  await open(url);

  return new Promise((resolve, reject) => {
    const entry = { resolve, reject, timer: null };
    entry.timer = setTimeout(() => {
      _pendingResolvers = _pendingResolvers.filter(r => r !== entry);
      reject(new Error('Sign-in timed out. Did you finish in the browser?'));
    }, timeoutMs);
    const wrappedResolve = (u) => { clearTimeout(entry.timer); resolve(u); };
    const wrappedReject  = (e) => { clearTimeout(entry.timer); reject(e); };
    _pendingResolvers.push({ resolve: wrappedResolve, reject: wrappedReject });
  });
}
