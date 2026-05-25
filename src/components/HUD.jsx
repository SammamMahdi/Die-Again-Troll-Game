import React, { useEffect, useState, useRef } from 'react';
import './HUD.css';
import { useRunStats } from './RunStatsContext';
import { useJewels } from './JewelProvider';
import { useConsumables } from './ConsumablesProvider';
import { CONSUMABLES_CATALOG } from '../utils/consumables';
import { MEDAL_THRESHOLDS } from '../utils/rewards';

function HUD({ level, deathCount, gameState, deathReason, onRestart }) {
  const { runScore, levelStartDeaths, mode, triesLeft, streak } = useRunStats();
  const jewels = useJewels();
  const { inventory, activeRef: effectsRef } = useConsumables();
  const [elapsed, setElapsed] = useState(0);
  // Tick once a second so the active-glow chips refresh while a potion is live.
  const [, forceRefresh] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRefresh(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);
  const now = Date.now();
  const magnetActive = effectsRef.current.magnetUntil > now;
  const invisibleActive = effectsRef.current.invisibleUntil > now;
  const startRef = useRef(Date.now());
  const isTutorial = level === 0;
  const isHardcore = mode === 'hardcore';
  const isPractice = mode === 'practice';

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
        {isTutorial ? (
          <div className="hud-level-row">
            <span className="hud-level-label">Tutorial</span>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* TOP RIGHT — stats card */}
      <div className="hud-card hud-card-tr">
        {isHardcore && Number.isFinite(triesLeft) && (
          <div className={`hud-stat hud-stat-tries ${triesLeft <= 1 ? 'critical' : ''}`}>
            <span className="hud-stat-icon">❤</span>
            <span className="hud-stat-value">{triesLeft}/3</span>
          </div>
        )}
        {isHardcore && streak >= 2 && (
          <div className="hud-stat hud-stat-streak">
            <span className="hud-stat-icon">🔥</span>
            <span className="hud-stat-value">×{streak}</span>
          </div>
        )}
        {/* Hardcore tracks LIVES (❤ chip above). Practice tracks DEATHS
            (the 💀 chip is purely for self-pacing — no try cap). Tutorial
            shows neither since it's a single teaching session. */}
        {isPractice && (
          <div className="hud-stat">
            <span className="hud-stat-icon">💀</span>
            <span className="hud-stat-value">{deathCount}</span>
          </div>
        )}
        <div className="hud-stat hud-stat-dim">
          <span className="hud-stat-icon">⏱</span>
          <span className="hud-stat-value">{timeStr}</span>
        </div>
        {!isTutorial && (
          <div className="hud-stat hud-stat-score">
            <span className="hud-stat-icon">★</span>
            <span className="hud-stat-value">{runScore}</span>
            <span className="hud-stat-unit">pts</span>
          </div>
        )}
        <div className="hud-stat hud-stat-jewels">
          <span className="hud-stat-icon">💎</span>
          <span className="hud-stat-value">{jewels >= 999000000 ? '∞' : jewels}</span>
        </div>
      </div>

      {/* BOTTOM-LEFT — consumable inventory chips */}
      {!isTutorial && (
        <div className="hud-inventory">
          {CONSUMABLES_CATALOG.map((item) => {
            const count = inventory[item.id] || 0;
            if (count <= 0) return null;
            const active =
              (item.id === 'jewel_magnet' && magnetActive) ||
              (item.id === 'invisibility_potion' && invisibleActive);
            return (
              <div
                key={item.id}
                className={`hud-chip ${active ? 'active' : ''}`}
                title={item.hotkey ? `Press ${item.hotkey} — ${item.desc}` : item.desc}
              >
                <span className="hud-chip-icon">{item.icon}</span>
                <span className="hud-chip-count">×{count}</span>
                {item.hotkey && <span className="hud-chip-key">[{item.hotkey}]</span>}
              </div>
            );
          })}
        </div>
      )}

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
