import React, { useEffect, useState } from 'react';
import { formatTime } from '../utils/rewards';
import { playUIClick } from '../utils/sounds';
import './RunFailedScreen.css';

const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉', platinum: '💎' };

// Shown when a Hardcore run ends because the player exhausted 3 tries on
// some level. Summarizes everything they got out of the run + offers a
// "Copy stats" share button (plain-text clipboard) so they can post a
// score brag without us needing html2canvas.
function RunFailedScreen({ summary, onBack }) {
  // summary = {
  //   failedAtLevel: number,
  //   levelsCleared: number,
  //   totalDeaths: number,
  //   totalMs: number,
  //   pointsEarned: number,
  //   jewelsEarned: number,
  //   runStats: { [level]: { medal, deaths, time } },
  //   maxStreak: number,
  // }
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const shareText = [
    `Die Again — Troll Game · Hardcore Run`,
    `Cleared L1–L${summary.levelsCleared} · Failed on L${summary.failedAtLevel}`,
    `${summary.totalDeaths} deaths · ${formatTime(summary.totalMs)} · ${summary.pointsEarned} pts · ${summary.jewelsEarned} 💎`,
    summary.maxStreak >= 2 ? `Best streak: ×${summary.maxStreak}` : null,
  ].filter(Boolean).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      playUIClick();
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied — silently swallow, UI just won't flash "copied" */
    }
  };

  return (
    <div className="rf-screen">
      <div className="rf-bg" />
      <div className="rf-card">
        <h1 className="rf-title">RUN ENDED</h1>
        <p className="rf-subtitle">Three tries lost on Level {summary.failedAtLevel}.</p>

        <div className="rf-stat-row">
          <div className="rf-stat">
            <div className="rf-stat-label">Levels Cleared</div>
            <div className="rf-stat-value">{summary.levelsCleared} / 10</div>
          </div>
          <div className="rf-stat">
            <div className="rf-stat-label">Time</div>
            <div className="rf-stat-value">{formatTime(summary.totalMs)}</div>
          </div>
          <div className="rf-stat">
            <div className="rf-stat-label">Deaths</div>
            <div className="rf-stat-value">{summary.totalDeaths}</div>
          </div>
        </div>

        <div className="rf-stat-row">
          <div className="rf-stat rf-stat-accent">
            <div className="rf-stat-label">Points Earned</div>
            <div className="rf-stat-value">+{summary.pointsEarned}</div>
          </div>
          <div className="rf-stat rf-stat-accent">
            <div className="rf-stat-label">Jewels Banked</div>
            <div className="rf-stat-value">+{summary.jewelsEarned} 💎</div>
          </div>
          {summary.maxStreak >= 2 && (
            <div className="rf-stat rf-stat-accent">
              <div className="rf-stat-label">Best Streak</div>
              <div className="rf-stat-value">×{summary.maxStreak}</div>
            </div>
          )}
        </div>

        {/* Per-level medal grid */}
        <div className="rf-medals">
          {Array.from({ length: 10 }).map((_, i) => {
            const n = i + 1;
            const result = summary.runStats?.[n];
            const medal = result?.medal;
            return (
              <div key={n} className={`rf-medal-slot ${medal ? `medal-${medal}` : 'empty'}`}>
                <div className="rf-medal-num">{n}</div>
                <div className="rf-medal-icon">{medal ? MEDAL_ICON[medal] : '·'}</div>
              </div>
            );
          })}
        </div>

        <div className="rf-buttons">
          <button className="rf-btn rf-btn-secondary" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy Stats'}
          </button>
          <button className="rf-btn rf-btn-primary" onClick={() => { playUIClick(); onBack(); }}>
            Back to Start
          </button>
        </div>
        <div className="rf-hint">Enter or Space to continue</div>
      </div>
    </div>
  );
}

export default RunFailedScreen;
