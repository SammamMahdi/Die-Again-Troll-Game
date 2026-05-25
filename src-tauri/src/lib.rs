// Tauri runtime entry point.
//
// Plugins:
//   tauri-plugin-single-instance — ensures only ONE app instance runs at a
//                                  time. Required on Windows for the deep-
//                                  link plugin to work, because Windows
//                                  launches a NEW .exe instance for every
//                                  `dieagain://` URL click. Without this,
//                                  the OAuth callback would land in a fresh
//                                  process and the user's open window
//                                  (where they pressed sign-in) would never
//                                  see the credential. The `deep-link`
//                                  feature flag wires the URL forwarding
//                                  automatically.
//   tauri-plugin-shell           — `shell.open(url)` to launch the system
//                                  browser (used for Google OAuth: we pop
//                                  the user out to their real browser
//                                  instead of trying to handle OAuth
//                                  inside WebView2, which is flaky).
//   tauri-plugin-deep-link       — registers the dieagain:// URL scheme
//                                  and dispatches incoming URLs to the JS
//                                  layer. The OAuth relay page redirects
//                                  to dieagain://auth once the user
//                                  finishes signing in, and the JS handler
//                                  turns that into a Firebase signin.
//   tauri-plugin-log             — captures Rust-side logs (debug builds).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // Single-instance plugin must be registered FIRST so it can short-circuit
  // subsequent .exe launches before any other plugin sees them. The
  // callback fires when Windows tries to spawn a second instance (e.g.
  // because the user clicked a dieagain:// link). With the "deep-link"
  // feature enabled on the plugin, the URL is automatically forwarded
  // to the deep-link plugin's onOpenUrl listeners in the running instance.
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      // Bring the existing window forward so the user sees the result of
      // the OAuth flow they just completed in their browser.
      use tauri::Manager;
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
        let _ = window.unminimize();
      }
    }));
  }

  builder = builder
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_deep_link::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // In dev (cargo run / tauri dev) the NSIS installer hasn't registered
      // the dieagain:// URL scheme with Windows yet — the installer only
      // does that at install time. `register_all` writes the registry entry
      // so dev-mode OAuth callbacks find their way back to the running app.
      #[cfg(any(target_os = "windows", target_os = "linux"))]
      {
        use tauri_plugin_deep_link::DeepLinkExt;
        let _ = app.deep_link().register_all();
      }
      Ok(())
    });

  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
