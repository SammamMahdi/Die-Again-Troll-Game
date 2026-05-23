import React, { useEffect, useState } from 'react';
import { isCloudEnabled, fetchLeaderboard } from '../firebase';
import './Leaderboard.css';

function Leaderboard({ currentUserUid, onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="leaderboard">
      <div className="leaderboard-bg" />
      <div className="leaderboard-card">
        <div className="leaderboard-header">
          <button className="leaderboard-back" onClick={onBack}>← Back</button>
          <h1 className="leaderboard-title">LEADERBOARD</h1>
          <div className="leaderboard-subtitle">Top 50 players by total score</div>
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
              return (
                <div key={row.uid || idx} className={`lb-row ${isMe ? 'lb-me' : ''}`}>
                  <div className="lb-rank">
                    {idx < 3 ? <span className={`lb-medal-icon lb-medal-${['gold','silver','bronze'][idx]}`}>★</span> : (idx + 1)}
                  </div>
                  <div className="lb-name">
                    <div className="lb-username">{row.username || 'anon'}{isMe && ' (you)'}</div>
                    <div className="lb-substats">
                      Runs {row.totalRuns ?? 0} · Cleared {row.totalCompletes ?? 0}
                    </div>
                  </div>
                  <div className="lb-medals">
                    <span className="lb-gold">{row.medalCounts?.gold ?? 0}</span>
                    <span className="lb-silver">{row.medalCounts?.silver ?? 0}</span>
                    <span className="lb-bronze">{row.medalCounts?.bronze ?? 0}</span>
                  </div>
                  <div className="lb-score">{row.totalScore ?? 0}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
