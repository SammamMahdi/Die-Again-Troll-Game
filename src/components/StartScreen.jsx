import React, { useState } from 'react';
import './StartScreen.css';

// "Latest release" alias on GitHub. Whichever release is marked as the
// latest in the GitHub Releases UI will be the one served by this URL —
// updating to a new build is a matter of publishing a new release with
// the installer attached as an asset. No code changes needed.
const DESKTOP_INSTALLER_URL =
  'https://github.com/SammamMahdi/Die-Again-Troll-Game/releases/latest/download/Die-Again_setup.exe';

// Detect Tauri so the "Download for Windows" button hides inside the
// already-installed desktop app — no point offering a download from
// inside the app itself.
const isDesktop =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function StartScreen({
  onStart, adminMode, onToggleAdmin, onAdminJump,
  authUser, onSignIn, onRegister, onSignOut, onLeaderboard, onMyStats, onGuide,
  onSettings, onShop,
  cloudEnabled, isAdmin,
}) {
  const [levelInput, setLevelInput] = useState('');
  const [error, setError] = useState('');

  const displayName = authUser?.displayName || authUser?.email?.split('@')[0] || 'Player';

  const submitLevelInput = () => {
    const trimmed = levelInput.trim();
    const n = parseInt(trimmed, 10);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      setError('Enter a level number from 1 to 10.');
      return;
    }
    setError('');
    onAdminJump(n);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitLevelInput();
    }
  };

  return (
    <div className="start-screen">
      <div className="start-screen-bg" />

      {/* Corner-badge logo, top-left. Doesn't conflict with the auth/menu
          chip in the top-right. Uses %PUBLIC_URL% via CRA's PUBLIC_URL
          variable so the relative path works under both Vercel and the
          Tauri custom protocol. */}
      <img
        src={`${process.env.PUBLIC_URL || ''}/logo.png`}
        alt="Die Again"
        className="start-logo"
      />


      {/* Auth chip / sign-in buttons top-right */}
      <div className="auth-chip">
        {authUser ? (
          <>
            <span className="auth-chip-name">👤 {displayName}</span>
            <button className="auth-chip-btn" onClick={onMyStats}>📊 My Stats</button>
            <button className="auth-chip-btn" onClick={onSignOut}>Sign out</button>
          </>
        ) : (
          <>
            <button className="auth-chip-btn auth-chip-primary" onClick={onSignIn}>Sign in</button>
            <button className="auth-chip-btn" onClick={onRegister}>Register</button>
          </>
        )}
        <button className="auth-chip-btn" onClick={onGuide}>📖 Guide</button>
        <button className="auth-chip-btn" onClick={onLeaderboard}>🏆 Leaderboard</button>
        {onShop && (
          <button className="auth-chip-btn" onClick={onShop}>💎 Shop</button>
        )}
        <button
          className="auth-chip-btn"
          onClick={onSettings}
          title="Sound, volumes, and other settings"
        >
          ⚙️ Settings
        </button>
      </div>

      {!cloudEnabled && (
        <div className="cloud-warning">
          Cloud accounts unavailable — paste your Firebase config in <code>src/firebase/config.js</code> to enable.
        </div>
      )}

      <h1 className="title">DIE AGAIN <span className="title-accent">— TROLL GAME</span></h1>

      <button className="start-button" onClick={onStart}>
        Click to Start
      </button>

      {!isDesktop && (
        <a
          className="desktop-download"
          href={DESKTOP_INSTALLER_URL}
          // download attribute hints the browser to save instead of navigate,
          // though GitHub's release-asset URLs already send Content-Disposition.
          download
        >
          <span className="desktop-download-icon" aria-hidden="true">⬇</span>
          <span className="desktop-download-text">
            <span className="desktop-download-headline">Download for Windows</span>
            <span className="desktop-download-sub">Free · ~5 MB installer · Win 10 / 11</span>
          </span>
        </a>
      )}

      {isAdmin && <div className="admin-section">
        <label className="admin-toggle">
          <input
            type="checkbox"
            checked={adminMode}
            onChange={(e) => onToggleAdmin(e.target.checked)}
          />
          <span className="admin-toggle-track">
            <span className="admin-toggle-thumb" />
          </span>
          <span className="admin-toggle-label">Admin Mode</span>
        </label>

        {adminMode && (
          <div className="admin-panel">
            <div className="admin-panel-row">
              <span className="admin-panel-label">Jump to level:</span>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} className="admin-jump-btn" onClick={() => onAdminJump(n)}>{n}</button>
              ))}
            </div>
            <div className="admin-panel-row">
              <span className="admin-panel-label">Or type number:</span>
              <input
                className="admin-level-input"
                type="number"
                min="1"
                max="10"
                placeholder="1"
                value={levelInput}
                onChange={(e) => setLevelInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="admin-go-btn" onClick={submitLevelInput}>Go</button>
            </div>
            {error && <div className="admin-error">{error}</div>}
            <div className="admin-panel-hint">
              Keys <kbd>1</kbd>–<kbd>9</kbd> jump to that level; <kbd>0</kbd> jumps to Level 10.
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}

export default StartScreen;
