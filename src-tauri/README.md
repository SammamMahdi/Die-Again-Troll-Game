# Die Again — Desktop wrapper (Tauri)

Wraps the React web build (`../build/`) into a Windows .exe via Tauri + WebView2.

## One-time setup (per machine)

1. **Install Rust** — https://rustup.rs (one-line installer). Reopen your shell so `cargo` is on PATH.
2. **WebView2 runtime** — already on Windows 11. On older Windows, the NSIS installer Tauri builds will fetch it automatically (~1.5 MB bootstrapper).
3. Node deps (`@tauri-apps/cli`, `@tauri-apps/api`) are already in the parent `package.json` — `npm install` in the project root is enough.

## Running

From the project root (`Die-Again-Web-Game/`), not from `src-tauri/`:

```
npm run tauri:dev     # opens a dev WebView2 window pointed at http://localhost:3000
npm run tauri:build   # produces the NSIS installer
```

The installer lands at:

```
src-tauri/target/release/bundle/nsis/Die Again_1.0.0_x64-setup.exe
```

## Known limitations (Phase 1)

- **Google sign-in is hidden in the desktop build.** `signInWithPopup` is unreliable inside WebView2. Phase 2 will restore Google auth via a system-browser deep-link flow. Email / password works.
- Localstorage is isolated per-app (WebView2 stores it under `%LOCALAPPDATA%\com.sammam.dieagain\EBWebView`). The desktop build does NOT share progress with the web build — sign in with the same account to sync via Firebase instead.
