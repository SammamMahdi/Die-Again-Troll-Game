# Die Again — Desktop wrapper (Tauri)

Wraps the React web build (`../build/`) into a Windows .exe via Tauri + WebView2.

## One-time setup (per machine)

1. **Install Rust** — https://rustup.rs (one-line installer). Reopen your shell so `cargo` is on PATH.
2. **WebView2 runtime** — already on Windows 11. On older Windows, install once from https://developer.microsoft.com/microsoft-edge/webview2/ (one ~2 MB download).
3. Node deps (`@tauri-apps/cli`, `@tauri-apps/api`, plugin-shell, plugin-deep-link) are already in the parent `package.json` — `npm install` in the project root is enough.

## Running

From the project root (`Die-Again-Web-Game/`), not from `src-tauri/`:

```
npm run tauri:dev     # opens a dev WebView2 window pointed at http://localhost:3000
npm run tauri:build   # compiles the full release build + NSIS installer
```

After `npm run tauri:build` finishes, **two artifacts** appear. Pick whichever fits your distribution.

### A. Plug-and-play single .exe — **recommended for "give to a friend"**

```
src-tauri/target/release/Die Again.exe
```

A single ~10 MB self-contained file. Upload to Google Drive / Dropbox / anywhere. The recipient downloads, double-clicks, and the game opens — no install dialog. Requires WebView2 (built into every Windows 11 install and auto-pushed to Windows 10 since 2021 — so essentially every modern Windows has it) and an internet connection for the cloud features (auth, leaderboard, sync).

### B. NSIS installer — **for users who want Start Menu integration**

```
src-tauri/target/release/bundle/nsis/Die Again_1.0.0_x64-setup.exe
```

Single-file installer (~15 MB). Adds a Start Menu shortcut, Add/Remove Programs entry, and a system-wide `dieagain://` URL scheme handler (required for the desktop Google sign-in flow — see below). Also includes a WebView2 bootstrapper, so it works on the rare Windows 10 system that doesn't already have WebView2.

## Internet requirements

The .exe needs internet for:
- **Firebase auth & Firestore** (sign-in, leaderboard, cloud progress sync)
- **Google OAuth relay page** (only when clicking "Continue with Google" — opens `https://die-again-troll-game.vercel.app/desktop-oauth.html` in the system browser)

Without internet, the game still runs offline: local progress, jewels, cosmetics, and consumables all save to the app's localStorage. Only the leaderboard and account sync are unavailable.

## Google sign-in (desktop)

Desktop Google sign-in works via a system-browser callback:

1. User clicks "Continue with Google" in the desktop app.
2. Default browser opens `https://die-again-troll-game.vercel.app/desktop-oauth.html`.
3. User signs in with Google in their real browser.
4. The relay page redirects to `dieagain://auth?id_token=...`.
5. Windows hands the URL back to the desktop app.
6. App calls `signInWithCredential` — same auth state as a normal sign-in.

**For this to work end-to-end, the relay page must be live on Vercel.** Vercel auto-deploys on git push, so just pushing the branch that contains `public/desktop-oauth.html` is enough. Locally:

```
npm run build    # CRA copies public/desktop-oauth.html into build/desktop-oauth.html
```

…then push to GitHub. Vercel picks up the new `desktop-oauth.html` automatically. Verify it's live by visiting the URL in step 2 in your browser — you should see the "DIE AGAIN" relay card, not a 404.

**Note:** in dev mode (`npm run tauri:dev`), the `dieagain://` scheme is registered at runtime via `app.deep_link().register_all()`. In the released NSIS build, the installer registers it persistently. The portable .exe registers it on first launch via the same runtime call.

## Known limitations

- The portable .exe doesn't share localStorage with the web build (WebView2 stores it under `%LOCALAPPDATA%\com.sammam.dieagain\EBWebView`). Sign in with the same Firebase account to sync progress across the two via cloud.
- Older Windows (pre-Win10 1803) doesn't have WebView2. Users would need to install the WebView2 runtime first. The NSIS installer's bootstrapper handles this automatically; the portable .exe does not.
