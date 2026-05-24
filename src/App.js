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
import Level0 from './levels/Level0';
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
import ModeSelectScreen from './components/ModeSelectScreen';
import PracticeLevelSelect from './components/PracticeLevelSelect';
import RunFailedScreen from './components/RunFailedScreen';
import Shop from './components/Shop';
import {
  getMedal,
  evaluateLevelComplete,
  recordLevelComplete,
  recordRunComplete,
  recordTutorialComplete,
  loadProgress,
  saveProgress,
  computeScore,
  medalCounts,
  formatTime,
  getAchievementById,
  pointsForLevelResult,
} from './utils/rewards';
import { RunStatsProvider } from './components/RunStatsContext';
import { getJewels, setJewelsFromCloud } from './utils/jewels';
import { getCosmetics, applyCloudCosmetics } from './utils/cosmetics';
import { getInventory, consumeOne, applyCloudInventory } from './utils/consumables';
import {
  isCloudEnabled,
  subscribeToAuth,
  signOutUser,
  submitScore,
  fetchMyScore,
} from './firebase';

const LEVEL_SCREENS = {
  0: 'level0',
  1: 'level1', 2: 'level2', 3: 'level3', 4: 'level4', 5: 'level5',
  6: 'level6', 7: 'level7', 8: 'level8', 9: 'level9', 10: 'level10',
};

// How many tries (deaths) a player gets per level in Hardcore mode before
// the whole run ends. Practice + Tutorial = unlimited.
const HARDCORE_TRIES = 3;
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
      // Pull the persisted jewel purse from the cloud doc too.
      if (cloudData && typeof cloudData.jewels === 'number') {
        setJewelsFromCloud(cloudData.jewels);
      }
      // Merge cloud cosmetics (owned arrays unioned; equipped picks kept
      // if owned in cloud, else stay local).
      if (cloudData && cloudData.cosmetics) {
        applyCloudCosmetics(cloudData.cosmetics);
      }
      // Cloud-side consumable counts win (truth across devices).
      if (cloudData && cloudData.consumables) {
        applyCloudInventory(cloudData.consumables);
      }
      // eslint-disable-next-line no-console
      console.log('[progress sync] loaded for', authUser.email,
        'medals:', Object.keys(adapted.medals).length,
        'achievements:', adapted.achievements.length,
        'jewels:', cloudData?.jewels ?? 0);
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
        setMode(null);
        setTriesLeft(HARDCORE_TRIES);
        setStreak(0);
        setMaxStreak(0);
        setRunFailedSummary(null);
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
  // Jewel-balance snapshot at the start of the current run. Lets us report
  // "jewels earned this run" without having to instrument every pickup.
  const runStartJewelsRef = useRef(0);
  // Mirror of the levelStartDeaths ref as state, so the in-level HUD can
  // re-render when a fresh level starts and recompute "next medal" hints.
  const [levelStartDeaths, setLevelStartDeaths] = useState(0);
  // Running total score for the CURRENT run only. Resets on resetRun /
  // handleLevelJump. Surfaced in the HUD so the player feels each medal +
  // achievement land in real time, not just on the CompleteScreen.
  const [runScore, setRunScore] = useState(0);

  // Mode + Hardcore state.
  // mode: null (start screen), 'tutorial', 'hardcore', 'practice'
  const [mode, setMode] = useState(null);
  const [triesLeft, setTriesLeft] = useState(HARDCORE_TRIES);
  // Streak in Hardcore = consecutive levels cleared without using a try.
  // Resets to 0 on death; bumps on level clear with deathsUsed === 0.
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  // Snapshot of stats when a Hardcore run ended (for the RunFailed screen).
  const [runFailedSummary, setRunFailedSummary] = useState(null);

  const [persistedProgress, setPersistedProgress] = useState(() => loadProgress());

  // Whenever the screen changes into a level, mark start time + start deaths.
  useEffect(() => {
    if (currentScreen.startsWith('level')) {
      levelStartTimeRef.current = Date.now();
      levelStartDeathsRef.current = deathCount;
      setLevelStartDeaths(deathCount);     // mirror for the HUD context
      if (runStartTimeRef.current == null) {
        runStartTimeRef.current = Date.now();
        // Snapshot jewel balance so the RunFailed/Complete screens can
        // show "+N jewels earned this run".
        runStartJewelsRef.current = getJewels();
      }
      // Reset the per-level tries counter on every Hardcore level entry.
      // Practice + Tutorial don't use it.
      if (mode === 'hardcore') setTriesLeft(HARDCORE_TRIES);
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
    setTriesLeft(HARDCORE_TRIES);
    setStreak(0);
    setMaxStreak(0);
    setRunFailedSummary(null);
    runStartTimeRef.current = null;
  };

  // Old direct-start behavior removed. The Start button now takes the player
  // to the mode-select screen instead of dumping them into L1.
  const handleStartGame = () => {
    setCurrentScreen('modeSelect');
  };

  const handleModeChoose = (chosen) => {
    setMode(chosen);
    resetRun();
    if (chosen === 'tutorial') {
      setCurrentScreen('level0');
    } else if (chosen === 'hardcore') {
      setCurrentScreen('level1');
    } else if (chosen === 'practice') {
      setCurrentScreen('practiceSelect');
    }
  };

  const handlePracticeChoose = (levelNumber) => {
    // Practice = single-level. Reset run book-keeping but keep mode=practice
    // so per-level reward screens know to return to practiceSelect on continue.
    setDeathCount(0);
    setRunStats({});
    setRunScore(0);
    setStreak(0);
    setRunFailedSummary(null);
    runStartTimeRef.current = null;
    // usedAdmin stays true in practice — it prevents the run-spanning
    // achievements (iron_will / flawless) from accidentally firing on L10.
    setUsedAdmin(true);
    const screen = LEVEL_SCREENS[levelNumber];
    if (screen) setCurrentScreen(screen);
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
    // Hardcore: drain a try; on the transition to 0, bail to RunFailed.
    // Guard against repeated deaths after the run is already over (e.g. the
    // player presses R during the 200ms tear-down) so the screen swap only
    // fires once.
    if (mode === 'hardcore' && runFailedSummary == null) {
      // Death also breaks any active streak.
      setStreak(0);
      setTriesLeft(prev => {
        const next = prev - 1;
        if (prev > 0 && next <= 0) {
          // Extra Life consumable: if owned, burn one and refill tries
          // instead of ending the run. The player keeps everything they
          // earned so far.
          if ((getInventory().extra_life || 0) > 0 && consumeOne('extra_life')) {
            return HARDCORE_TRIES;
          }
          // Snapshot everything for the RunFailed screen + bail. setTimeout
          // so the death sound + state update lands before the screen swap.
          setTimeout(() => {
            const failedAt = parseInt((currentScreen || '').replace('level', ''), 10) || 0;
            const totalDeaths = Object.values(runStats).reduce((s, r) => s + (r?.deaths ?? 0), 0) + HARDCORE_TRIES;
            const totalMs = runStartTimeRef.current ? Date.now() - runStartTimeRef.current : 0;
            const levelsCleared = Object.keys(runStats).length;
            setRunFailedSummary({
              failedAtLevel: failedAt,
              levelsCleared,
              totalDeaths,
              totalMs,
              pointsEarned: runScore,
              jewelsEarned: Math.max(0, getJewels() - runStartJewelsRef.current),
              maxStreak,
              runStats,
            });
            setCurrentScreen('runFailed');
          }, 200);
        }
        return next;
      });
    }
  };

  const handleLevelComplete = (levelNumber) => {
    playWin();
    // Tutorial: no medal / time / runStats — just flag completion + show a
    // simple reward screen with the tutorial_complete achievement (if new).
    if (levelNumber === 0) {
      const { progress: tutorialProg, newlyUnlocked: tutorialNewly } = recordTutorialComplete();
      setPersistedProgress(tutorialProg);
      const tutorialPoints = pointsForLevelResult({ medal: 'none', newlyUnlocked: tutorialNewly });
      if (tutorialNewly.length > 0) setRunScore(prev => prev + tutorialPoints);
      if (authUser && isCloudEnabled()) {
        submitScore({
          uid: authUser.uid,
          username: authUser.displayName || authUser.email?.split('@')[0] || 'anon',
          scoreData: {
            totalScore: computeScore(tutorialProg),
            achievements: tutorialProg.achievements || [],
            tutorialComplete: true,
          },
        }).catch(() => {});
      }
      setRewardData({
        level: 0,
        deaths: 0,
        time: 0,
        medal: 'none',
        newlyUnlocked: tutorialNewly,
        pointsEarned: tutorialPoints,
        runScoreAfter: runScore + tutorialPoints,
        isFinal: false,
        isTutorial: true,
        runStats: {},
      });
      setCurrentScreen('reward');
      return;
    }

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

    // Hardcore: clearing a level without losing a try grows the streak.
    if (mode === 'hardcore' && deathsUsed === 0) {
      setStreak(prev => {
        const next = prev + 1;
        if (next > maxStreak) setMaxStreak(next);
        return next;
      });
    } else if (mode === 'hardcore') {
      // Lost at least one try on this level → streak breaks.
      setStreak(0);
    }
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
          jewels: getJewels(),
          cosmetics: getCosmetics(),
          consumables: getInventory(),
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
      // Run is "final" only if we're in Hardcore AND we just cleared L10.
      // In Practice, every level is treated as standalone.
      isFinal: mode === 'hardcore' && levelNumber === TOTAL_LEVELS,
      mode,
      runStats: nextRunStats,
    });
    setCurrentScreen('reward');
  };

  const handleRewardContinue = () => {
    if (!rewardData) return;

    // Tutorial → bounce back to mode select.
    if (rewardData.isTutorial) {
      setCurrentScreen('modeSelect');
      return;
    }

    // Hardcore final → final summary CompleteScreen (existing path).
    if (rewardData.isFinal) {
      const totalDeaths = Object.values(rewardData.runStats).reduce(
        (sum, r) => sum + (r?.deaths ?? 0), 0,
      );
      const totalMs = runStartTimeRef.current ? Date.now() - runStartTimeRef.current : 0;
      const updated = recordRunComplete({ runStats: rewardData.runStats, totalDeaths, totalMs });
      setPersistedProgress(updated);
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
            jewels: getJewels(),
          },
        }).catch(() => {});
      }
      setCurrentScreen('complete');
      return;
    }

    // Practice → return to the Practice level-select grid (single-level loop).
    if (rewardData.mode === 'practice') {
      setCurrentScreen('practiceSelect');
      return;
    }

    // Hardcore (non-final) → next sequential level.
    const next = rewardData.level + 1;
    setCurrentScreen(`level${next}`);
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
          onShop={() => setCurrentScreen('shop')}
          onSettings={() => { playUIOpen(); setSettingsOpen(true); }}
          muted={muted}
          onToggleMute={toggleMuted}
          cloudEnabled={isCloudEnabled()}
          isAdmin={isAdmin}
        />
      )}
      {currentScreen === 'modeSelect' && (
        <ModeSelectScreen onChoose={handleModeChoose} onBack={goToStart} />
      )}
      {currentScreen === 'practiceSelect' && (
        <PracticeLevelSelect onChooseLevel={handlePracticeChoose} onBack={() => setCurrentScreen('modeSelect')} />
      )}
      {currentScreen === 'runFailed' && runFailedSummary && (
        <RunFailedScreen summary={runFailedSummary} onBack={goToStart} />
      )}
      {currentScreen === 'shop' && (
        <Shop onClose={() => setCurrentScreen('start')} />
      )}
      {currentScreen === 'level0' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
          <Level0
            key={`level0-${qid}`}
            deathCount={deathCount}
            onDeath={handleDeath}
            onComplete={() => handleLevelComplete(0)}
            onRestart={handleRestart}
          />
        </RunStatsProvider>
      )}
      {currentScreen === 'level1' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
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
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
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
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
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
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
          <Level4 key={`level4-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(4)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level5' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
          <Level5 key={`level5-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(5)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level6' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
          <Level6 key={`level6-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(6)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level7' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
          <Level7 key={`level7-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(7)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level8' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
          <Level8 key={`level8-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(8)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level9' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
          <Level9 key={`level9-${qid}`} deathCount={deathCount} onDeath={handleDeath} onComplete={() => handleLevelComplete(9)} onRestart={handleRestart} />
        </RunStatsProvider>
      )}
      {currentScreen === 'level10' && (
        <RunStatsProvider runScore={runScore} levelStartDeaths={levelStartDeaths} mode={mode} triesLeft={triesLeft} streak={streak}>
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
