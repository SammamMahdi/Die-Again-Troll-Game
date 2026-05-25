import React from 'react';
import { playUIClick } from '../utils/sounds';
import { loadProgress, formatTime } from '../utils/rewards';
import './PracticeLevelSelect.css';

const LEVEL_NAMES = {
  0: 'Tutorial',
  1: 'Sequence',
  2: 'Red & Blue',
  3: 'Sonar',
  4: 'Betrayal',
  5: 'Pendulums',
  6: 'Discs',
  7: 'Lantern',
  8: 'Mirror',
  9: 'Wind',
  10: 'Architect',
};

const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' };

function PracticeLevelSelect({ onChooseLevel, onBack }) {
  const progress = loadProgress();
  const medals = progress.medals || {};
  const bestTimes = progress.bestTimes || {};
  const tutorialDone = !!progress.tutorialComplete;
  const hasAnyMedal = Object.keys(medals).length > 0;

  // Unlock rule: L0 always open. L1 open if tutorial done OR any level cleared
  // (don't punish existing players who already beat L1 before tutorial existed).
  // L2..L10 open if the previous level has any medal recorded.
  const isUnlocked = (n) => {
    if (n === 0) return true;
    if (n === 1) return tutorialDone || hasAnyMedal;
    return !!medals[n - 1];
  };

  const handle = (n) => {
    if (!isUnlocked(n)) return;
    playUIClick();
    onChooseLevel(n);
  };

  return (
    <div className="practice-select">
      <div className="practice-select-inner">
        <button className="practice-back" onClick={() => { playUIClick(); onBack(); }}>← Back</button>
        <h1 className="practice-title">PRACTICE — PICK A LEVEL</h1>
        <p className="practice-subtitle">Unlimited tries. Medals + jewels + achievements all count.</p>

        <div className="practice-grid">
          {Array.from({ length: 11 }).map((_, n) => {
            const unlocked = isUnlocked(n);
            const medal = medals[n];
            const time = bestTimes[n];
            return (
              <button
                key={n}
                className={`practice-tile ${unlocked ? '' : 'locked'} ${medal ? `medal-${medal}` : ''}`}
                onClick={() => handle(n)}
                disabled={!unlocked}
              >
                <div className="practice-tile-num">
                  {n === 0 ? 'T' : n}
                </div>
                <div className="practice-tile-name">{LEVEL_NAMES[n]}</div>
                {unlocked ? (
                  <div className="practice-tile-row">
                    {medal && <span className="practice-tile-medal">{MEDAL_ICON[medal]}</span>}
                    {time != null && Number.isFinite(time) && time > 0 && (
                      <span className="practice-tile-time">{formatTime(time)}</span>
                    )}
                    {!medal && time == null && <span className="practice-tile-untried">untried</span>}
                  </div>
                ) : (
                  <div className="practice-tile-row practice-tile-lock">
                    🔒 Clear L{n - 1}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PracticeLevelSelect;
