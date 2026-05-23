import React, { useEffect, useState, useRef } from 'react';
import './HUD.css';

function HUD({ level, deathCount, gameState, deathReason, onRestart }) {
  const [isMobile, setIsMobile] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                   || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
            {isMobile ? 'Tap to Restart' : 'Press R to Restart'}
          </button>
        </div>
      )}
    </div>
  );
}

export default HUD;
