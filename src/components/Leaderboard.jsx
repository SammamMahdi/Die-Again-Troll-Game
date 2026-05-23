import React, { useEffect, useState } from 'react';
import { isCloudEnabled, fetchLeaderboard } from '../firebase';
import { formatTime, ACHIEVEMENTS } from '../utils/rewards';
import './Leaderboard.css';

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Leaderboard({ currentUserUid, onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedUid, setExpandedUid] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isCloudEnabled()) {
        setLoading(false);
        setError('Cloud not configured. See src/firebase/config.js.');
        return;
      }
      try {
        const data = await fetchLeaderboard(50);
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load leaderboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const toggleExpand = (uid) => {
    setExpandedUid(prev => (prev === uid ? null : uid));
  };

  return (
    <div className="leaderboard">
      <div className="leaderboard-bg" />
      <div className="leaderboard-card">
        <div className="leaderboard-header">
          <button className="leaderboard-back" onClick={onBack}>← Back</button>
          <h1 className="leaderboard-title">LEADERBOARD</h1>
          <div className="leaderboard-subtitle">Top 50 players · click a row to expand</div>
        </div>

        {loading && <div className="leaderboard-message">Loading…</div>}
        {error && <div className="leaderboard-message leaderboard-error">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="leaderboard-message">No scores yet — be the first!</div>
        )}

        {rows.length > 0 && (
          <div className="leaderboard-table">
            <div className="lb-row lb-header-row">
              <div className="lb-rank">#</div>
              <div className="lb-name">Player</div>
              <div className="lb-medals" title="Gold / Silver / Bronze counts">GSB</div>
              <div className="lb-score">Score</div>
            </div>
            {rows.map((row, idx) => {
              const isMe = row.uid === currentUserUid;
              const isExpanded = expandedUid === row.uid;
              return (
                <div key={row.uid || idx} className={`lb-row-wrap ${isExpanded ? 'expanded' : ''}`}>
                  <button
                    type="button"
                    className={`lb-row ${isMe ? 'lb-me' : ''}`}
                    onClick={() => toggleExpand(row.uid)}
                  >
                    <div className="lb-rank">
                      {idx < 3 ? (
                        <span className={`lb-medal-icon lb-medal-${['gold','silver','bronze'][idx]}`}>★</span>
                      ) : (idx + 1)}
                    </div>
                    <div className="lb-name">
                      <div className="lb-username">
                        {row.username || 'anon'}{isMe && ' (you)'}
                        <span className="lb-expand-caret">{isExpanded ? '▼' : '▶'}</span>
                      </div>
                      <div className="lb-substats">
                        Runs {row.totalRuns ?? 0} · Cleared {row.totalCompletes ?? 0} · ★ {row.achievements?.length ?? 0}/{ACHIEVEMENTS.length}
                      </div>
                    </div>
                    <div className="lb-medals">
                      <span className="lb-gold">{row.medalCounts?.gold ?? 0}</span>
                      <span className="lb-silver">{row.medalCounts?.silver ?? 0}</span>
                      <span className="lb-bronze">{row.medalCounts?.bronze ?? 0}</span>
                    </div>
                    <div className="lb-score">{row.totalScore ?? 0}</div>
                  </button>

                  {isExpanded && <ExpandedDetail row={row} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandedDetail({ row }) {
  const medals = row.medals || {};
  const bestTimes = row.bestTimes || {};
  const bestDeaths = row.bestDeaths || {};
  const ach = row.achievements || [];

  return (
    <div className="lb-detail">
      <div className="lb-detail-section">
        <div className="lb-detail-label">Medals by level</div>
        <div className="lb-pips">
          {LEVELS.map(n => {
            const m = medals[n] || medals[String(n)];
            return (
              <div
                key={n}
                className={`lb-pip ${m ? `lb-pip-${m}` : 'lb-pip-none'}`}
                title={m ? `Level ${n}: ${m}` : `Level ${n}: not cleared`}
              >
                <span className="lb-pip-num">{n}</span>
                <span className="lb-pip-tier">
                  {m ? m[0].toUpperCase() : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lb-detail-section">
        <div className="lb-detail-label">Best run per level</div>
        <div className="lb-times">
          {LEVELS.map(n => {
            const t = bestTimes[n] ?? bestTimes[String(n)];
            const d = bestDeaths[n] ?? bestDeaths[String(n)];
            const has = Number.isFinite(t);
            return (
              <div key={n} className={`lb-time ${has ? '' : 'lb-time-empty'}`}>
                <div className="lb-time-lvl">L{n}</div>
                <div className="lb-time-val">{has ? formatTime(t) : '—'}</div>
                <div className="lb-time-deaths">{has ? `${d ?? 0}† ` : ''}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lb-detail-section">
        <div className="lb-detail-label">Achievements ({ach.length}/{ACHIEVEMENTS.length})</div>
        <div className="lb-achievements">
          {ACHIEVEMENTS.map(a => {
            const owned = ach.includes(a.id);
            return (
              <div key={a.id} className={`lb-ach ${owned ? 'lb-ach-owned' : ''}`}
                   title={`${a.name} — ${a.desc}${owned ? '' : ' (locked)'}`}>
                <span className="lb-ach-star">{owned ? '★' : '☆'}</span>
                <span className="lb-ach-name">{a.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;
