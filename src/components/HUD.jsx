import React from 'react';
import './HUD.css';

function HUD({ level, deathCount, gameState, deathReason, onRestart }) {
  return (
    <div className="hud">
      <div className="hud-top-left">
        <div className="hud-level">LEVEL {level}</div>
        <div className="hud-controls">Arrow Keys: Camera | WASD: Move | SPACE: Jump</div>
      </div>

      <div className="hud-top-right">
        <div className="hud-deaths">Deaths: {deathCount}</div>
      </div>

      {gameState === 'won' && (
        <div className="hud-center">
          <h1>VICTORY!</h1>
          <p>Loading next level...</p>
        </div>
      )}

      {gameState === 'dead' && (
        <div className="hud-center">
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
