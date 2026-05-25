import React, { useEffect, useState } from 'react';
import { formatTime, getAchievementById, MEDAL_POINTS } from '../utils/rewards';
import './RewardScreen.css';

function RewardScreen({ data, onContinue }) {
  // data: { level, deaths, time, medal, newlyUnlocked, pointsEarned,
  //         runScoreAfter, isFinal, runStats, sideQuestComplete }
  const [revealAchievements, setRevealAchievements] = useState(false);
  const medalPoints = MEDAL_POINTS[data.medal] || 0;
  const newlyUnlocked = data.newlyUnlocked || [];

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
              {data.medal === 'diamond' ? 'D'
                : data.medal === 'platinum' ? 'P'
                : data.medal === 'gold' ? 'G'
                : data.medal === 'silver' ? 'S' : 'B'}
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

        {/* Side-quest result line — shown when the player entered + cleared
            the Hardcore portal (Phase 3 side-quest mechanic). */}
        {data.sideQuestComplete && (
          <div className="reward-quest reward-quest-done">
            <span className="reward-quest-tag">PORTAL CLEARED</span>
            <span className="reward-quest-name">Side-quest completed</span>
            <span className="reward-quest-result">
              {data.medal === 'diamond' ? '✦ DIAMOND' : '✓ Platinum'}
            </span>
          </div>
        )}

        {/* Points breakdown — medal + each newly-unlocked achievement, with a
            total earned this level and the resulting run-total readout. */}
        <div className="reward-points">
          <div className="reward-points-line">
            <span className="reward-points-label">{data.medal[0].toUpperCase() + data.medal.slice(1)} medal</span>
            <span className="reward-points-value">+{medalPoints}</span>
          </div>
          {newlyUnlocked.map((id) => {
            const a = getAchievementById(id);
            if (!a) return null;
            return (
              <div key={`pts-${id}`} className="reward-points-line">
                <span className="reward-points-label">{a.name}</span>
                <span className="reward-points-value">+{a.score}</span>
              </div>
            );
          })}
          <div className="reward-points-total">
            <span className="reward-points-label">Earned this level</span>
            <span className="reward-points-value">+{data.pointsEarned ?? medalPoints}</span>
          </div>
          {typeof data.runScoreAfter === 'number' && (
            <div className="reward-points-run">
              Run total: <strong>{data.runScoreAfter} pts</strong>
            </div>
          )}
          {newlyUnlocked.reduce((sum, id) => {
            const a = getAchievementById(id);
            return sum + (a?.score || 0);
          }, 0) > 0 && (
            <div className="reward-points-jewels">
              💎 First-unlock bounty: <strong>+{
                newlyUnlocked.reduce((sum, id) => {
                  const a = getAchievementById(id);
                  return sum + (a?.score || 0);
                }, 0)
              } jewels</strong> added to your purse
            </div>
          )}
        </div>

        {newlyUnlocked.length > 0 && (
          <div className={`achievements ${revealAchievements ? 'revealed' : ''}`}>
            <div className="achievements-title">★ Achievements Unlocked ★</div>
            {newlyUnlocked.map((id, idx) => {
              const a = getAchievementById(id);
              if (!a) return null;
              return (
                <div
                  key={id}
                  className="achievement-badge"
                  style={{ transitionDelay: `${idx * 120}ms` }}
                >
                  <div className="achievement-row">
                    <div className="achievement-name">{a.name}</div>
                    <div className="achievement-score">+{a.score}</div>
                  </div>
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
