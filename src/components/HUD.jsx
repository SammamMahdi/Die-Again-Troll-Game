import React, { useEffect, useState } from 'react';
import './HUD.css';

function HUD({ level, deathCount, gameState, deathReason, onRestart }) {
  const [isMobile, setIsMobile] = useState(false);

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

  return (
    <div className="hud">
      <div className="hud-top-left">
        <div className="hud-level">LEVEL {level}</div>
        {!isMobile && (
          <div className="hud-controls">Arrow Keys: Camera | WASD: Move | SPACE: Jump</div>
        )}
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
            {isMobile ? 'Tap to Restart' : 'Press R to Restart'}
          </button>
        </div>
      )}
    </div>
  );
}

export default HUD;
