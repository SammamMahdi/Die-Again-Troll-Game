// Single source of truth for the running app's version. Read by the
// UpdateBanner to compare against the latest GitHub Release.
//
// RELEASE WORKFLOW:
//   1. Bump this string before tagging a release.
//   2. Also bump version in package.json + src-tauri/tauri.conf.json +
//      src-tauri/Cargo.toml so everything stays in sync.
//   3. npm run tauri:build
//   4. Upload Die-Again_setup.exe to a new GitHub Release with tag
//      v<this-string> (e.g. "v1.0.1"). Mark as latest.
//
// The banner uses semver-ish comparison (major.minor.patch) so as long
// as new tag > APP_VERSION the desktop client shows the update prompt.
export const APP_VERSION = '1.0.0';
