// Lightweight "is there a newer release?" check against the GitHub
// Releases API. Runs once on app startup (desktop only — web users always
// get the latest via Vercel auto-deploy, so the banner is pointless there).
//
// No auth needed: GitHub allows 60 unauthenticated requests per IP per
// hour, which is wildly more than one check per launch.

import { APP_VERSION } from '../constants/version';

const RELEASES_API =
  'https://api.github.com/repos/SammamMahdi/Die-Again-Troll-Game/releases/latest';

const DISMISS_KEY = 'die-again-update-dismissed-v1';

// True only when running inside the Tauri desktop wrapper.
const isDesktop =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Compare two semver-ish strings ("1.0.0", "v1.0.1"). Returns true iff
// `remote` is strictly newer than `local`. Missing components count as 0
// so "1.1" > "1.0.5" works ("1.1.0" > "1.0.5").
export function isNewer(remote, local) {
  if (!remote || !local) return false;
  const parse = (s) => s.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const r = parse(remote);
  const l = parse(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] || 0;
    const b = l[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

// Returns { available, latestTag, htmlUrl, notes } if a newer release exists;
// returns null otherwise (or on any error — silent fail, no UI noise).
//
// Network errors, missing release, malformed JSON: all return null. The
// banner just won't show. That's the right default for a non-critical
// feature.
export async function checkForUpdate() {
  if (!isDesktop) return null;   // web users get updates via Vercel; skip the check
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tag = data?.tag_name;
    if (!tag) return null;
    if (!isNewer(tag, APP_VERSION)) return null;
    // User previously dismissed THIS exact version → don't pester them again
    // until a newer one comes out.
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed === tag) return null;
    } catch { /* localStorage might be unavailable, just ignore */ }
    return {
      available: true,
      latestTag: tag,
      htmlUrl: data?.html_url || `https://github.com/SammamMahdi/Die-Again-Troll-Game/releases/latest`,
      notes: data?.body || '',
    };
  } catch {
    return null;
  }
}

// Remember that the user dismissed this specific version's banner so it
// doesn't reappear on the next launch. When a newer tag ships, the
// stored dismissal value won't match and the banner shows again.
export function dismissUpdate(tag) {
  try { localStorage.setItem(DISMISS_KEY, tag); } catch { /* ignore */ }
}

// Open the GitHub release page in the user's default browser. On desktop
// this routes through Tauri's shell plugin (no permission prompt — we've
// already allowed https://** in the capabilities). On web it falls back
// to a regular `window.open`.
export async function openReleasePage(url) {
  if (isDesktop) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
      return;
    } catch {
      // Fall through to window.open if the Tauri import fails for any reason.
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
