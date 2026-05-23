import React, { useEffect, useState } from 'react';
import { formatTime, getAchievementById } from '../utils/rewards';
import './RewardScreen.css';

function RewardScreen({ data, onContinue }) {
  // data: { level, deaths, time, medal, newlyUnlocked, isFinal, runStats }
  const [revealAchievements, setRevealAchievements] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealAchievements(true), 900);
    return () => clearTimeout(t);
  }, []);

  // Allow pressing Enter or Space to continue
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onContinue]);

  const continueLabel = data.isFinal
    ? 'See Final Results'
    : `Continue to Level ${data.level + 1}`;

  return (
    <div className="reward-screen">
      <div className="reward-bg" />

      <div className="reward-card">
        <div className="reward-level">LEVEL {data.level} CLEARED</div>

        <div className={`medal medal-${data.medal}`}>
          <div className="medal-ring" />
          <div className="medal-core">
            <span className="medal-letter">
              {data.medal === 'gold' ? 'G' : data.medal === 'silver' ? 'S' : 'B'}
            </span>
          </div>
          <div className="medal-tier">{data.medal.toUpperCase()}</div>
        </div>

        <div className="reward-stats">
          <div className="stat">
            <div className="stat-label">Deaths</div>
            <div className="stat-value">{data.deaths}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Time</div>
            <div className="stat-value">{formatTime(data.time)}</div>
          </div>
        </div>

        {data.newlyUnlocked && data.newlyUnlocked.length > 0 && (
          <div className={`achievements ${revealAchievements ? 'revealed' : ''}`}>
            <div className="achievements-title">★ Achievements Unlocked ★</div>
            {data.newlyUnlocked.map((id, idx) => {
              const a = getAchievementById(id);
              if (!a) return null;
              return (
                <div
                  key={id}
                  className="achievement-badge"
                  style={{ transitionDelay: `${idx * 120}ms` }}
                >
                  <div className="achievement-name">{a.name}</div>
                  <div className="achievement-desc">{a.desc}</div>
                </div>
              );
            })}
          </div>
        )}

        <button className="reward-continue" onClick={onContinue}>
          {continueLabel}
        </button>
        <div className="reward-hint">press Enter or Space</div>
      </div>
    </div>
  );
}

export default RewardScreen;
