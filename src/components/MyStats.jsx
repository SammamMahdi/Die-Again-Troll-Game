import React, { useEffect, useState } from 'react';
import {
  isCloudEnabled, fetchMyScore, fetchLeaderboard,
} from '../firebase';
import {
  formatTime, ACHIEVEMENTS, computeScore, medalCounts,
} from '../utils/rewards';
import MedalBadge from './MedalBadge';
import './MyStats.css';

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function MyStats({ authUser, progress, onBack }) {
  const [cloudData, setCloudData] = useState(null);
  const [rank, setRank] = useState(null);
  const [totalPlayers, setTotalPlayers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isCloudEnabled() || !authUser?.uid) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const [doc, board] = await Promise.all([
          fetchMyScore(authUser.uid),
          fetchLeaderboard(500),
        ]);
        if (cancelled) return;
        setCloudData(doc);
        const idx = board.findIndex(r => r.uid === authUser.uid);
        setRank(idx >= 0 ? idx + 1 : null);
        setTotalPlayers(board.length);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load stats.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [authUser]);

  // Data source: prefer cloud if available (matches leaderboard), fall back to
  // local progress so the screen still works pre-auth or when offline.
  const source = cloudData || progress || {};
  const medals = source.medals || {};
  const bestTimes = source.bestTimes || {};
  const bestDeaths = source.bestDeaths || {};
  const achievements = source.achievements || [];
  const totalRuns = source.totalRuns || 0;
  const totalCompletes = source.totalCompletes || 0;

  // Total score: prefer cloud's stored value, otherwise recompute locally.
  const totalScore = cloudData?.totalScore ?? computeScore(source);
  const mCounts = source.medalCounts || medalCounts(source);

  const displayName =
    authUser?.displayName ||
    cloudData?.username ||
    authUser?.email?.split('@')[0] ||
    'Player';

  const clearedCount = Object.keys(medals).length;

  return (
    <div className="mystats">
      <div className="mystats-bg" />
      <div className="mystats-card">
        <div className="mystats-header">
          <button className="mystats-back" onClick={onBack}>← Back</button>
          <div>
            <h1 className="mystats-title">MY STATS</h1>
            <div className="mystats-name">
              {displayName}
              {rank ? <span className="mystats-rank"> · Rank #{rank}{totalPlayers ? ` of ${totalPlayers}` : ''}</span> : null}
            </div>
          </div>
        </div>

        {loading && <div className="mystats-message">Loading…</div>}
        {error && <div className="mystats-message mystats-error">{error}</div>}
        {!loading && !authUser && (
          <div className="mystats-message">
            Sign in to see cross-device stats. The local-only view is shown below.
          </div>
        )}

        {/* ===== Top: hero stats ===== */}
        <div className="mystats-hero">
          <div className="mystats-score-card">
            <div className="mystats-score-label">TOTAL SCORE</div>
            <div className="mystats-score-value">{totalScore}</div>
          </div>
          <div className="mystats-key-stats">
            <Stat label="Games started" value={totalRuns}
                  hint="Times you began a fresh run from Level 1" />
            <Stat label="Full clears" value={totalCompletes}
                  hint="Times you finished all 10 levels in one run" />
            <Stat label="Levels cleared" value={`${clearedCount}/10`}
                  hint="Unique levels you've earned at least a bronze medal on" />
            <Stat label="Achievements" value={`${achievements.length}/${ACHIEVEMENTS.length}`}
                  hint="Achievements unlocked" />
          </div>
        </div>

        {/* ===== Medal totals — all five tiers ===== */}
        <div className="mystats-section">
          <div className="mystats-section-label">Medal totals</div>
          <div className="mystats-medal-totals">
            <MedalTotal tier="diamond"  count={mCounts.diamond  || 0} />
            <MedalTotal tier="platinum" count={mCounts.platinum || 0} />
            <MedalTotal tier="gold"     count={mCounts.gold     || 0} />
            <MedalTotal tier="silver"   count={mCounts.silver   || 0} />
            <MedalTotal tier="bronze"   count={mCounts.bronze   || 0} />
          </div>
        </div>

        {/* ===== Per-level breakdown ===== */}
        <div className="mystats-section">
          <div className="mystats-section-label">Per-level best run (medal · time · deaths)</div>
          <div className="mystats-levels">
            {LEVELS.map(n => {
              const m = medals[n] || medals[String(n)];
              const t = bestTimes[n] ?? bestTimes[String(n)];
              const d = bestDeaths[n] ?? bestDeaths[String(n)];
              const cleared = !!m;
              return (
                <div
                  key={n}
                  className={`mystats-level ${cleared ? `mystats-level-${m}` : 'mystats-level-empty'}`}
                  title={cleared ? `Level ${n}: ${m} medal, best time ${formatTime(t)}, ${d ?? 0} deaths on best run` : `Level ${n}: not cleared yet`}
                >
                  <div className="mystats-level-num">Level {n}</div>
                  <div className="mystats-level-medal">
                    {cleared ? <MedalBadge tier={m} size={32} /> : <span className="mystats-level-medal-empty">—</span>}
                  </div>
                  <div className="mystats-level-stats">
                    <span className="mystats-level-time">{Number.isFinite(t) ? formatTime(t) : '—'}</span>
                    <span className="mystats-level-deaths">{Number.isFinite(d) ? `💀 ${d}` : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== Achievements ===== */}
        <div className="mystats-section">
          <div className="mystats-section-label">
            Achievements ({achievements.length}/{ACHIEVEMENTS.length})
          </div>
          <div className="mystats-achievements">
            {ACHIEVEMENTS.map(a => {
              const owned = achievements.includes(a.id);
              return (
                <div key={a.id} className={`mystats-ach ${owned ? 'mystats-ach-owned' : ''}`}>
                  <span className="mystats-ach-star">{owned ? '★' : '☆'}</span>
                  <div className="mystats-ach-text">
                    <div className="mystats-ach-name">{a.name}</div>
                    <div className="mystats-ach-desc">{a.desc}</div>
                  </div>
                  <div className="mystats-ach-points">+{a.score}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="mystats-stat" title={hint || ''}>
      <div className="mystats-stat-label">{label}</div>
      <div className="mystats-stat-value">{value}</div>
    </div>
  );
}

function MedalTotal({ tier, count }) {
  return (
    <div className={`mystats-medal-pill mystats-medal-pill-${tier}`}>
      <MedalBadge tier={tier} size={36} />
      <div className="mystats-medal-count">{count}</div>
      <div className="mystats-medal-tier">{tier}</div>
    </div>
  );
}

export default MyStats;
