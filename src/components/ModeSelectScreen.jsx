import React from 'react';
import { playUIClick } from '../utils/sounds';
import { loadProgress } from '../utils/rewards';
import './ModeSelectScreen.css';

// Three-tile launcher: Tutorial · Hardcore · Practice.
// Hardcore and Practice both produce per-level RewardScreens. Tutorial is
// a one-off teaching pass. Practice is locked behind tutorial completion
// (and Hardcore is locked until Level 1 has been cleared once — a small
// gate so a brand-new player meets L0 first).
function ModeSelectScreen({ onChoose, onBack }) {
  const progress = loadProgress();
  const tutorialDone = !!progress.tutorialComplete;
  const anyLevelDone = (progress.medals && Object.keys(progress.medals).length > 0);

  const handle = (mode) => {
    playUIClick();
    onChoose(mode);
  };

  return (
    <div className="mode-select">
      <div className="mode-select-inner">
        <button className="mode-back" onClick={() => { playUIClick(); onBack(); }}>← Back</button>
        <h1 className="mode-title">CHOOSE YOUR PATH</h1>
        <p className="mode-subtitle">All progress is shared between modes.</p>

        <div className="mode-grid">
          <button
            className="mode-tile mode-tile-tutorial"
            onClick={() => handle('tutorial')}
          >
            <div className="mode-tile-icon">🌱</div>
            <div className="mode-tile-name">Tutorial</div>
            <div className="mode-tile-desc">Five platforms. Learn to walk, jump, and look around. Always replayable.</div>
            {tutorialDone && <div className="mode-tile-badge">Cleared</div>}
          </button>

          <button
            className={`mode-tile mode-tile-hardcore ${!tutorialDone ? 'locked' : ''}`}
            onClick={() => tutorialDone && handle('hardcore')}
            disabled={!tutorialDone}
          >
            <div className="mode-tile-icon">🔥</div>
            <div className="mode-tile-name">Hardcore</div>
            <div className="mode-tile-desc">L1 → L10 linear. Three tries per level. Lose them all, the run ends.</div>
            {!tutorialDone && <div className="mode-tile-lock">Clear the Tutorial first</div>}
          </button>

          <button
            className={`mode-tile mode-tile-practice ${!anyLevelDone && !tutorialDone ? 'locked' : ''}`}
            onClick={() => (anyLevelDone || tutorialDone) && handle('practice')}
            disabled={!anyLevelDone && !tutorialDone}
          >
            <div className="mode-tile-icon">🧭</div>
            <div className="mode-tile-name">Practice</div>
            <div className="mode-tile-desc">Pick any level you've unlocked. Unlimited tries. Hunt jewels and grind Platinum.</div>
            {!anyLevelDone && !tutorialDone && <div className="mode-tile-lock">Clear the Tutorial first</div>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModeSelectScreen;
