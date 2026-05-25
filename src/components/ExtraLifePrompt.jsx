import React from 'react';
import { playUIClick, playUIClose } from '../utils/sounds';
import './ExtraLifePrompt.css';

// Hardcore "out of lives" prompt — appears when the player would have
// otherwise dropped to the RunFailed screen, BUT they have at least one
// Extra Life in inventory. Asks whether to burn one to refill tries.
//
// onUse: parent burns one Extra Life and refills triesLeft to 3.
// onDecline: parent proceeds to the RunFailed screen.
function ExtraLifePrompt({ availableExtraLives, onUse, onDecline }) {
  const yes = () => { playUIClick(); onUse(); };
  const no  = () => { playUIClose(); onDecline(); };
  return (
    <div className="extralife-overlay">
      <div className="extralife-card">
        <div className="extralife-heart">❤</div>
        <h2 className="extralife-title">Out of Lives</h2>
        <p className="extralife-message">
          You used your last try. Burn an <strong>Extra Life</strong> to refill
          your tries to <strong>3</strong> and keep the run alive?
        </p>
        <div className="extralife-stock">
          In stock: <strong>{availableExtraLives}</strong> ❤
        </div>
        <div className="extralife-buttons">
          <button className="extralife-btn extralife-btn-use" onClick={yes}>
            Use Extra Life
          </button>
          <button className="extralife-btn extralife-btn-decline" onClick={no}>
            End the Run
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExtraLifePrompt;
