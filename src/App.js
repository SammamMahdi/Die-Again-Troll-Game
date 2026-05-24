import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import StartScreen from './components/StartScreen';
import AdminBadge from './components/AdminBadge';
import RewardScreen from './components/RewardScreen';
import AuthModal from './components/AuthModal';
import Leaderboard from './components/Leaderboard';
import MyStats from './components/MyStats';
import HomeButton from './components/HomeButton';
import SettingsButton from './components/SettingsButton';
import AbilityHUD from './components/AbilityHUD';
import Guide from './components/Guide';
import Settings from './components/Settings';
import { useGraphics } from './components/GraphicsProvider';
import {
  playDeath, playWin, playUIClick, playUIOpen,
  isMuted, setMuted,
  startAmbient, stopAmbient,
} from './utils/sounds';
import Level1 from './levels/Level1';
import Level2 from './levels/Level2';
import Level3 from './levels/Level3';
import Level4 from './levels/Level4';
import Level5 from './levels/Level5';
import Level6 from './levels/Level6';
import Level7 from './levels/Level7';
import Level8 from './levels/Level8';
import Level9 from './levels/Level9';
import Level10 from './levels/Level10';
import {
  getMedal,
  evaluateLevelComplete,
  recordLevelComplete,
  recordRunComplete,
  loadProgress,
  saveProgress,
  computeScore,
  medalCounts,
  formatTime,
  getAchievementById,
  pointsForLevelResult,
} from './utils/rewards';
import { RunStatsProvider } from './components/RunStatsContext';
import {
  isCloudEnabled,
  subscribeToAuth,
  signOutUser,
  submitScore,
  fetchMyScore,
} from './firebase';

const LEVEL_SCREENS = {
  1: 'level1', 2: 'level2', 3: 'level3', 4: 'level4', 5: 'level5',
  6: 'level6', 7: 'level7', 8: 'level8', 9: 'level9', 10: 'level10',
};
// Keyboard shortcuts: 1-9 = levels 1-9, 0 = level 10
const ADMIN_KEY_TO_LEVEL = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '0': 10 };
const TOTAL_LEVELS = 10;

// Admin mode is reserved for these accounts. Anyone signed in with a
// different email (or signed out) sees no admin UI and cannot use the
// 1–9/0 jump shortcuts.
const ADMIN_EMAILS = ['sammam.mahdi@gmail.com'];

function isAdminAccount(authUser) {
  return !!authUser && ADMIN_EMAILS.includes((authUser.email || '').toLowerCase());
}

function App() {
  const [currentScreen, setCurrentScreen] = useState('start');
  const [deathCount, setDeathCount] = useState(0);
  const [adminMode, setAdminMode] = useState(false);

  // Quality preset id. We append it to each level's React `key` so that
  // changing graphics presets in Settings cleanly remounts the level —
  // which is the only reliable way to swap WebGL antialias, MSAA on the
  // EffectComposer, and the wholesale geometry/PostFX changes that come
  // with the preset. The level resets to its start state on switch (the
  // accepted trade-off vs. visual chaos from a partial in-place swap).
  const q = useGraphics();
  const qid = q.id;

  // Cloud auth
  const [authUser, setAuthUser] = useState(null);
  const [authModalMode, setAuthModalMode] = useState(null); // 'signin' | 'register' | null

  // Sound mute (persisted via sounds.js)
  const [muted, setMutedState] = useState(isMuted());
  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAuth((user) => setAuthUser(user));
    return () => unsub && unsub();
  }, []);

  // When auth state changes, progress is owned by whoever is signed in.
  // - Signed-in: cloud doc IS the truth; replace local display + storage.
  // - Signed-out: clear local display so the previous account's progress
  //   isn't visible to whoever uses this device next.
  useEffect(() => {
    if (!isCloudEnabled()) return;
    const EMPTY = {
      bestDeaths: {}, bestTimes: {}, medals: {},
      achievements: [], totalRuns: 0, totalCompletes: 0, lastRun: null,
    };

    // Signed out — wipe local
    if (!authUser) {
      setPersistedProgress(EMPTY);
      saveProgress(EMPTY);
      return;
    }

    // Signed in — fetch + overwrite local with cloud truth
    let cancelled = false;
    fetchMyScore(authUser.uid).then((cloudData) => {
      if (cancelled) return;
      const adapted = cloudData ? {
        bestDeaths: cloudData.bestDeaths || {},
        bestTimes: cloudData.bestTimes || {},
        medals: cloudData.medals || {},
        achievements: cloudData.achievements || [],
        totalRuns: cloudData.totalRuns || 0,
        totalCompletes: cloudData.totalCompletes || 0,
        lastRun: cloudData.lastRun || null,
      } : EMPTY;
      setPersistedProgress(adapted);
      saveProgress(adapted);
      // eslint-disable-next-line no-console
      console.log('[progress sync] loaded for', authUser.email,
        'medals:', Object.keys(adapted.medals).length,
        'achievements:', adapted.achievements.length);
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[progress sync] failed to read cloud doc:', err?.message || err);
      if (cancelled) return;
      setPersistedProgress(EMPTY);
      saveProgress(EMPTY);
    });
    return () => { cancelled = true; };
  }, [authUser]);

  // Admin mode is gated by email — non-admin sign-ins (or sign-out) cannot
  // keep adminMode true.
  const isAdmin = isAdminAccount(authUser);
  useEffect(() => {
    if (!isAdmin && adminMode) setAdminMode(false);
  }, [isAdmin, adminMode]);

  // Global Escape handler: close auth modal first, else return to start screen
  // from any non-start screen. Ignores Escape while typing in inputs.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (authModalMode) {
        setAuthModalMode(null);
        return;
      }
      if (currentScreen !== 'start') {
        e.preventDefault();
        // resetRun is defined below; we capture the screen change here.
        setDeathCount(0);
        setRunStats({});
        setUsedAdmin(false);
        setRunScore(0);
        runStartTimeRef.current = null;
        setCurrentScreen('start');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentScreen, authModalMode]);

  // Per-run reward bookkeeping
  const [runStats, setRunStats] = useState({});           // { lvl: { deaths, time, medal } }
  const [usedAdmin, setUsedAdmin] = useState(false);
  const [rewardData, setRewardData] = useState(null);
  const runStartTimeRef = useRef(null);
  const levelStartTimeRef = useRef(null);
  const levelStartDeathsRef = useRef(0);
  // Mirror of the levelStartDeaths ref as state, so the in-level HUD can
  // re-render when a fresh level starts and recompute "next medal" hints.
  const [levelStartDeaths, setLevelStartDeaths] = useState(0);
  // Running total score for the CURRENT run only. Resets on resetRun /
  // handleLevelJump. Surfaced in the HUD so the player feels each medal +
  // achievement land in real time, not just on the CompleteScreen.
  const [runScore, setRunScore] = useState(0);
  const [persistedProgress, setPersistedProgress] = useState(() => loadProgress());

  // Whenever the screen changes into a level, mark start time + start deaths.
  useEffect(() => {
    if (currentScreen.startsWith('level')) {
      levelStartTimeRef.current = Date.now();
      levelStartDeathsRef.current = deathCount;
      setLevelStartDeaths(deathCount);     // mirror for the HUD context
      if (runStartTimeRef.current == null) runStartTimeRef.current = Date.now();
      // Start per-level ambient
      const n = parseInt(currentScreen.replace('level', ''), 10);
      if (Number.isInteger(n)) startAmbient(n);
    } else {
      // Stop ambient on any non-level screen
      stopAmbient();
    }
    if (currentScreen === 'start') {
      // Refresh persisted progress when we land back on the start screen
      setPersistedProgress(loadProgress());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen]);

  // Global UI click sound — fires on any <button> click that isn't inside the
  // 3D canvas or mobile-controls overlay.
  useEffect(() => {
    const onClick = (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest('button')) return;
      if (t.closest('canvas')) return;
      if (t.closest('.mobile-controls')) return;
      if (t.closest('.mobile-touch-area')) return;
      playUIClick();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Global admin shortcut: pressing 1, 2, or 3 (when admin mode is on)
  // jumps to that level from anywhere in the app.
  useEffect(() => {
    if (!adminMode || !isAdmin) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      const lvl = ADMIN_KEY_TO_LEVEL[e.key];
      if (lvl) {
        const screen = LEVEL_SCREENS[lvl];
        if (screen) {
          e.preventDefault();
          setUsedAdmin(true);
          setCurrentScreen(screen);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adminMode, isAdmin]);

  const resetRun = () => {
    setDeathCount(0);
    setRunStats({});
    setUsedAdmin(false);
    setRunScore(0);
    runStartTimeRef.current = null;
  };

  const handleStartGame = () => {
    resetRun();
    setCurrentScreen('level1');
  };

  const handleAdminJump = (levelNumber) => {
    if (!isAdmin) return;
    const screen = LEVEL_SCREENS[levelNumber];
    if (!screen) return;
    setAdminMode(true);
    setUsedAdmin(true);
    setCurrentScreen(screen);
  };

  // Earned level-select: any user can jump to a level N if they've cleared
  // N-1 (or N == 1). Doesn't enable admin mode, but does set usedAdmin so
  // run-spanning achievements (iron_will / flawless) still require a full
  // linear playthrough.
  const handleLevelJump = (levelNumber) => {
    const screen = LEVEL_SCREENS[levelNumber];
    if (!screen) return;
    setDeathCount(0);
    setRunStats({});
    setUsedAdmin(true);
    setRunScore(0);
    runStartTimeRef.current = null;
    setCurrentScreen(screen);
  };

  const handleToggleAdmin = (next) => {
    if (!isAdmin) {
      setAdminMode(false);
      return;
    }
    setAdminMode(next);
  };

  const handleDeath = () => {
    playDeath();
    setDeathCount(prev => prev + 1);
  };

  const handleLevelComplete = (levelNumber) => {
    playWin();
    const deathsUsed = Math.max(0, deathCount - levelStartDeathsRef.current);
    // Defensive: if the level start time ref is null (unlikely but possible
    // around the screen-change useEffect), prefer `0` here AND downstream the
    // rewards module guards `timeMs <= 0` to skip the bestTimes update + the
    // speed achievement check (would otherwise corrupt bestTimes to 0ms and
    // wrongly award `speed_demon_*`).
    const elapsedMs = levelStartTimeRef.current
      ? Date.now() - levelStartTimeRef.current
      : 0;
    const medal = getMedal(levelNumber, deathsUsed);
    const result = { deaths: deathsUsed, time: elapsedMs, medal };
    const nextRunStats = { ...runStats, [levelNumber]: result };
    setRunStats(nextRunStats);

    const newlyUnlocked = evaluateLevelComplete({
      level: levelNumber,
      deathsUsed,
      timeMs: elapsedMs,
      runStats: nextRunStats,
      usedAdmin,
      alreadyOwned: persistedProgress.achievements || [],
    });

    const updated = recordLevelComplete({
      level: levelNumber,
      deathsUsed,
      timeMs: elapsedMs,
      medal,
      newlyUnlocked,
    });
    setPersistedProgress(updated);

    // Per-level points (medal + freshly-unlocked achievements). Surfaced in
    // the running run score (HUD) and the reward screen breakdown.
    const pointsEarned = pointsForLevelResult({ medal, newlyUnlocked });
    setRunScore(prev => prev + pointsEarned);

    // Sync to cloud (best-effort; failures don't break local progress)
    if (authUser && isCloudEnabled()) {
      const totalScore = computeScore(updated);
      const mCounts = medalCounts(updated);
      submitScore({
        uid: authUser.uid,
        username: authUser.displayName || authUser.email?.split('@')[0] || 'anon',
        scoreData: {
          totalScore,
          medals: updated.medals || {},
          medalCounts: mCounts,
          achievements: updated.achievements || [],
          bestTimes: updated.bestTimes || {},
          bestDeaths: updated.bestDeaths || {},
          totalRuns: updated.totalRuns || 0,
          totalCompletes: updated.totalCompletes || 0,
        },
      }).catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('Score sync failed:', e?.message || e);
      });
    }

    setRewardData({
      level: levelNumber,
      deaths: deathsUsed,
      time: elapsedMs,
      medal,
      newlyUnlocked,
      pointsEarned,
      runScoreAfter: runScore + pointsEarned,
      isFinal: levelNumber === TOTAL_LEVELS,
      runStats: nextRunStats,
    });
    setCurrentScreen('reward');
  };

  const handleRewardContinue = () => {
    if (!rewardData) return;
    if (rewardData.isFinal) {
      // Finalize the run record
      const totalDeaths = Object.values(rewardData.runStats).reduce(
        (sum, r) => sum + (r?.deaths ?? 0), 0,
      );
      const totalMs = runStartTimeRef.current ? Date.now() - runStartTimeRef.current : 0;
      const updated = recordRunComplete({ runStats: rewardData.runStats, totalDeaths, totalMs });
      setPersistedProgress(updated);
      // Also push final totalRuns / totalCompletes to cloud
      if (authUser && isCloudEnabled()) {
        submitScore({
          uid: authUser.uid,
          username: authUser.displayName || authUser.email?.split('@')[0] || 'anon',
          scoreData: {
            totalScore: computeScore(updated),
            medals: updated.medals || {},
            medalCounts: medalCounts(updated),
            achievements: updated.achievements || [],
            totalRuns: updated.totalRuns || 0,
            totalCompletes: updated.totalCompletes || 0,
          },
        }).catch(() => {});
      }
      setCurrentScreen('complete');
    } else {
      const next = rewardData.level + 1;
      setCurrentScreen(`level${next}`);
    }
  };

  const handleRestart = () => {
    // Per-level restart hook (level handles internal reset)
  };

  const goToStart = () => {
    resetRun();
    setCurrentScreen('start');
  };

  return (
    <div className="App">
      {currentScreen === 'start' && (
        <StartScreen
          onStart={handleStartGame}
          adminMode={adminMode}
          onToggleAdmin={handleToggleAdmin}
          onAdminJump={handleAdminJump}
          onLevelJump={handleLevelJump}
          progress={persistedProgress}
          authUser={authUser}
          onSignIn={() => setAuthModalMode('signin')}
          onRegister={() => setAuthModalMode('register')}
          onSignOut={async () => { await signOutUser(); }}
          onLeaderboard={() => setCurrentScreen('leaderboard')}
          onMyStats={() => setCurrentScreen('mystats')}
          onGuide={() => setCurrentScreen('guide')}
          onSettings={() => { playUIOpen(); setSettingsOpen(true); }}
          muted={muted}
          onToggleMute={toggleMuted}
          cloudEnabled={isCloudEnabled()}
          isAdmin={isAdmin}
        />
      )}
      {currentScreen === 'level1' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level1
            key={`level1-${qid}`}
            deathCount={deathCount}
            onDeath={handleDeath}
            onComplete={() => handleLevelComplete(1)}
            onRestart={handleRestart}
          />
        </RunStatsProvider>
      )}
      {currentScreen === 'level2' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level2
            key={`level2-${qid}`}
            deathCount={deathCount}
            onDeath={handleDeath}
            onComplete={() => handleLevelComplete(2)}
            onRestart={handleRestart}
          />
        </RunStatsProvider>
      )}
      {currentScreen === 'level3' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level3
            key={`level3-${qid}`}
            deathCount={deathCount}
            onDeath={handleDeath}
            onComplete={() => handleLevelComplete(3)}
            onRestart={handleRestart}
          />
        </RunStatsProvider>
      )}
      {currentScreen === 'level4' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level4 key={`level4-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(4)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level5' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level5 key={`level5-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(5)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level6' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level6 key={`level6-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(6)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level7' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level7 key={`level7-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(7)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level8' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level8 key={`level8-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(8)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level9' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level9 key={`level9-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(9)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level10' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths}>
          <Level10 key={`level10-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(10)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'reward' && rewardData && (
        <RewardScreen data={rewardData} onContinue={handleRewardContinue} />
      )}
      {currentScreen === 'complete' && (
        <CompleteScreen
          runStats={rewardData?.runStats || runStats}
          totalDeaths={deathCount}
          onPlayAgain={goToStart}
          newlyUnlocked={rewardData?.newlyUnlocked || []}
        />
      )}

      {currentScreen === 'leaderboard' && (
        <Leaderboard
          currentUserUid={authUser?.uid}
          onBack={() => setCurrentScreen('start')}
        />
      )}
      {currentScreen === 'mystats' && (
        <MyStats
          authUser={authUser}
          progress={persistedProgress}
          onBack={() => setCurrentScreen('start')}
        />
      )}
      {currentScreen === 'guide' && (
        <Guide onBack={() => setCurrentScreen('start')} />
      )}

      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onSuccess={() => setAuthModalMode(null)}
        />
      )}

      {settingsOpen && (
        <Settings onClose={() => setSettingsOpen(false)} />
      )}

      {currentScreen !== 'start' && currentScreen !== 'leaderboard' && (
        <HomeButton onHome={goToStart} />
      )}

      {/* In-game settings access — shown on every non-start screen */}
      {currentScreen !== 'start' && (
        <SettingsButton onClick={() => { playUIOpen(); setSettingsOpen(true); }} />
      )}

      {/* Ability hint shown only while playing a level */}
      {currentScreen.startsWith('level') && (
        <AbilityHUD level={parseInt(currentScreen.replace('level', ''), 10)} />
      )}

      {adminMode && (
        <AdminBadge
          currentScreen={currentScreen}
          onDisable={() => setAdminMode(false)}
        />
      )}
    </div>
  );
}

function CompleteScreen({ runStats, totalDeaths, onPlayAgain, newlyUnlocked }) {
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const allCompleted = levels.every(n => runStats[n]);
  const totalMs = levels.reduce((sum, n) => sum + (runStats[n]?.time || 0), 0);

  return (
    <div className="reward-screen">
      <div className="reward-bg" />
      <div className="reward-card" style={{ maxWidth: 620 }}>
        <div className="reward-level" style={{ marginBottom: 14 }}>RUN COMPLETE</div>
        <h1 style={{
          margin: 0,
          fontSize: '2.2rem',
          letterSpacing: 3,
          color: '#ff7ad0',
          textShadow: '0 0 12px #ff5cc7, 0 0 28px #c47aff',
        }}>
          DIE AGAIN — CLEARED
        </h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 10,
          justifyItems: 'center',
          margin: '20px 0 4px',
        }}>
          {levels.map(n => {
            const r = runStats[n];
            const medal = r?.medal;
            return (
              <div key={n} className={`medal medal-${medal || 'bronze'}`} style={{
                width: 68, height: 86, opacity: r ? 1 : 0.32,
              }}>
                <div className="medal-ring" style={{ width: 54, height: 54 }} />
                <div className="medal-core" style={{ width: 42, height: 42, marginTop: 4 }}>
                  <span className="medal-letter" style={{ fontSize: '1.0rem' }}>L{n}</span>
                </div>
                <div className="medal-tier" style={{ fontSize: '0.6rem' }}>
                  {medal ? medal.toUpperCase() : 'SKIP'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="reward-stats" style={{ marginTop: 24 }}>
          <div className="stat">
            <div className="stat-label">Total Deaths</div>
            <div className="stat-value">{totalDeaths}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Total Time</div>
            <div className="stat-value">{formatTime(totalMs)}</div>
          </div>
        </div>

        {newlyUnlocked && newlyUnlocked.length > 0 && (
          <div className="achievements revealed" style={{ marginTop: 16 }}>
            <div className="achievements-title">★ Earned This Run ★</div>
            {newlyUnlocked.map(id => {
              const a = getAchievementById(id);
              if (!a) return null;
              return (
                <div key={id} className="achievement-badge" style={{ opacity: 1, transform: 'none' }}>
                  <div className="achievement-name">{a.name}</div>
                  <div className="achievement-desc">{a.desc}</div>
                </div>
              );
            })}
          </div>
        )}

        {!allCompleted && (
          <div style={{
            marginTop: 14, fontSize: '0.85rem', color: '#ffaaaa', opacity: 0.85,
          }}>
            Note: admin jumps were used in this run — some achievements are gated.
          </div>
        )}

        <button className="reward-continue" onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}

export default App;
