// Tauri runtime entry point.
//
// Plugins:
//   tauri-plugin-log        — captures Rust-side logs
//   tauri-plugin-shell      — `shell.open(url)` to launch the system browser
//                             (used for Google OAuth: we pop the user out to
//                             their real browser instead of trying to handle
//                             OAuth inside WebView2, which is flaky)
//   tauri-plugin-deep-link  — registers the dieagain:// URL scheme and
//                             dispatches incoming URLs to the JS layer. The
//                             OAuth relay page redirects to dieagain://auth
//                             once the user finishes signing in, and the
//                             JS handler turns that into a Firebase signin.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_deep_link::init());

  builder = builder.setup(|app| {
    if cfg!(debug_assertions) {
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;
    }
    // In dev (cargo run / tauri dev) the NSIS installer hasn't registered
    // the dieagain:// URL scheme with Windows yet — the installer only
    // does that at install time. `register` writes the registry entry so
    // dev-mode OAuth callbacks find their way back to the running app.
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
