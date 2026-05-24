import React, { useEffect, useState, useRef } from 'react';
import './HUD.css';
import { useRunStats } from './RunStatsContext';
import { MEDAL_THRESHOLDS } from '../utils/rewards';

function HUD({ level, deathCount, gameState, deathReason, onRestart }) {
  const { runScore, levelStartDeaths } = useRunStats();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Reset + tick a per-level elapsed timer. Pauses when the level ends.
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
  }, [level]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    return () => clearInterval(id);
  }, [gameState]);

  const totalSec = Math.floor(elapsed / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

  // Live medal-track hint: turn the medal thresholds into a "still going for
  // silver — N deaths left" / "Bronze locked in" readout. Makes the medal
  // tension visible mid-run instead of revealed only on the reward screen.
  const deathsThisLevel = Math.max(0, deathCount - levelStartDeaths);
  const t = MEDAL_THRESHOLDS[level];
  let medalHint = null;
  if (t) {
    if (deathsThisLevel <= t.gold) {
      medalHint = { tier: 'Gold', text: deathsThisLevel === 0 ? 'no deaths' : `${t.gold - deathsThisLevel} death${t.gold - deathsThisLevel === 1 ? '' : 's'} left` };
    } else if (deathsThisLevel <= t.silver) {
      const left = t.silver - deathsThisLevel;
      medalHint = { tier: 'Silver', text: `${left} death${left === 1 ? '' : 's'} left` };
    } else {
      medalHint = { tier: 'Bronze', text: 'best you can earn here' };
    }
  }

  return (
    <div className="hud">
      {/* TOP LEFT — level info card */}
      <div className="hud-card hud-card-tl">
        <div className="hud-level-row">
          <span className="hud-level-label">Level</span>
          <span className="hud-level-num">{level}</span>
          <span className="hud-level-of">/ 10</span>
        </div>
        <div className="hud-progress">
          {Array.from({ length: 10 }).map((_, i) => {
            const cls = i < level - 1 ? 'hud-pip hud-pip-cleared'
              : i === level - 1 ? 'hud-pip hud-pip-current'
              : 'hud-pip';
            return <span key={i} className={cls} />;
          })}
        </div>
        {medalHint && (
          <div className={`hud-medal-hint hud-medal-${medalHint.tier.toLowerCase()}`}>
            <span className="hud-medal-tier">{medalHint.tier}</span>
            <span className="hud-medal-text">{medalHint.text}</span>
          </div>
        )}
      </div>

      {/* TOP RIGHT — stats card */}
      <div className="hud-card hud-card-tr">
        <div className="hud-stat">
          <span className="hud-stat-icon">💀</span>
          <span className="hud-stat-value">{deathCount}</span>
        </div>
        <div className="hud-stat hud-stat-dim">
          <span className="hud-stat-icon">⏱</span>
          <span className="hud-stat-value">{timeStr}</span>
        </div>
        <div className="hud-stat hud-stat-score">
          <span className="hud-stat-icon">★</span>
          <span className="hud-stat-value">{runScore}</span>
          <span className="hud-stat-unit">pts</span>
        </div>
      </div>

      {/* GAME STATE OVERLAYS */}
      {gameState === 'won' && (
        <div className="hud-center hud-center-won">
          <h1>VICTORY!</h1>
          <p>Loading next level…</p>
        </div>
      )}

      {gameState === 'dead' && (
        <div className="hud-center hud-center-dead">
          <h1>GAME OVER</h1>
          <p>{deathReason}</p>
          <button className="restart-button" onClick={onRestart}>
            Press R to Restart
          </button>
        </div>
      )}
    </div>
  );
}

export default HUD;
