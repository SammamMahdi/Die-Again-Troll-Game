import React, { useState } from 'react';
import { ACHIEVEMENTS } from '../utils/rewards';
import './StartScreen.css';

function StartScreen({
  onStart, adminMode, onToggleAdmin, onAdminJump, progress,
  authUser, onSignIn, onRegister, onSignOut, onLeaderboard, cloudEnabled, isAdmin,
}) {
  const [levelInput, setLevelInput] = useState('');
  const [error, setError] = useState('');
  const [showTrophies, setShowTrophies] = useState(false);

  const hasProgress = progress && (
    Object.keys(progress.medals || {}).length > 0 ||
    (progress.achievements && progress.achievements.length > 0)
  );

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

      {/* Auth chip / sign-in buttons top-right */}
      <div className="auth-chip">
        {authUser ? (
          <>
            <span className="auth-chip-name">👤 {displayName}</span>
            <button className="auth-chip-btn" onClick={onSignOut}>Sign out</button>
          </>
        ) : (
          <>
            <button className="auth-chip-btn auth-chip-primary" onClick={onSignIn}>Sign in</button>
            <button className="auth-chip-btn" onClick={onRegister}>Register</button>
          </>
        )}
        <button className="auth-chip-btn" onClick={onLeaderboard}>🏆 Leaderboard</button>
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

      <div className="controls">
        <p>Controls:</p>
        <p>WASD — Move</p>
        <p>SPACE — Jump (Level 3: also Sonar Pulse)</p>
        <p>Arrow Keys / Drag — Rotate Camera</p>
        <p>R — Restart Level</p>
        <p>ESC / Q — Quit to Menu</p>
      </div>

      {hasProgress && (
        <div className="trophy-summary">
          <div className="trophy-row">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const m = progress.medals?.[n];
              const cls = m ? `trophy-medal trophy-${m}` : 'trophy-medal trophy-empty';
              return (
                <div key={n} className={cls} title={m ? `Level ${n}: ${m}` : `Level ${n}: not yet`}>
                  <span className="trophy-medal-label">L{n}</span>
                  <span className="trophy-medal-tier">{m ? m[0].toUpperCase() : '—'}</span>
                </div>
              );
            })}
          </div>
          <div className="trophy-stats">
            <span>Runs: {progress.totalRuns ?? 0}</span>
            <span>Cleared: {progress.totalCompletes ?? 0}</span>
          </div>
          <button className="trophy-toggle" onClick={() => setShowTrophies(prev => !prev)}>
            {showTrophies ? 'Hide Achievements' : `Achievements (${progress.achievements?.length ?? 0}/${ACHIEVEMENTS.length})`}
          </button>
          {showTrophies && (
            <div className="trophy-list">
              {ACHIEVEMENTS.map(a => {
                const owned = (progress.achievements || []).includes(a.id);
                return (
                  <div key={a.id} className={`trophy-item ${owned ? 'owned' : ''}`}>
                    <div className="trophy-item-name">{owned ? '★' : '☆'} {a.name}</div>
                    <div className="trophy-item-desc">{a.desc}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
