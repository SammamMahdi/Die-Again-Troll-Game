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
  startAmbient, stopAmbient,
} from './utils/sounds';
import Level0 from './levels/Level0';
import LevelHost from './components/LevelHost';
import WarpOverlay from './components/WarpOverlay';
import ModeSelectScreen from './components/ModeSelectScreen';
import PracticeLevelSelect from './components/PracticeLevelSelect';
import RunFailedScreen from './components/RunFailedScreen';
import ExtraLifePrompt from './components/ExtraLifePrompt';
import Shop from './components/Shop';
import UpdateBanner from './components/UpdateBanner';
import {
  getMedal,
  evaluateLevelComplete,
  recordLevelComplete,
  recordRunComplete,
  recordTutorialComplete,
  loadProgress,
  computeScore,
  medalCounts,
  pointsForLevelResult,
  achievementPoints,
} from './utils/rewards';
import { RunStatsProvider } from './components/RunStatsContext';
import { getRealJewels, setAdminUnlimited, subscribeJewels, addJewels } from './utils/jewels';
import { getCosmetics, subscribeCosmetics } from './utils/cosmetics';
import {
  getInventory, consumeOne, subscribeConsumables, getUpgrades,
} from './utils/consumables';
import {
  isCloudEnabled,
  subscribeToAuth,
  signOutUser,
  submitScore,
} from './firebase';
import { initDesktopAuth } from './firebase/desktopAuth';
import { HARDCORE_TRIES, TOTAL_LEVELS, WARP_DURATION_MS } from './constants/gameConstants';
import useCloudProgressSync from './hooks/useCloudProgressSync';
// Side-effect import: mounts the global F11 fullscreen hotkey at module load.
import './utils/fullscreen';

const LEVEL_SCREENS = {
  0: 'level0',
  1: 'level1', 2: 'level2', 3: 'level3', 4: 'level4', 5: 'level5',
  6: 'level6', 7: 'level7', 8: 'level8', 9: 'level9', 10: 'level10',
};

// Echo Dimension screen names per level (Phase 3b). Entering a portal in
// Hardcore swaps the player to the matching echo screen, which renders
// the same level component wrapped in <EchoLevel> for the universal
// "wrong dimension" framing.
const ECHO_SCREENS = {
  1: 'level1Echo', 2: 'level2Echo', 3: 'level3Echo', 4: 'level4Echo', 5: 'level5Echo',
  6: 'level6Echo', 7: 'level7Echo', 8: 'level8Echo', 9: 'level9Echo', 10: 'level10Echo',
};

// Keyboard shortcuts: 1-9 = levels 1-9, 0 = level 10
const ADMIN_KEY_TO_LEVEL = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '0': 10 };

// Admin mode is reserved for these accounts. Anyone signed in with a
// different email (or signed out) sees no admin UI and cannot use the
// 1–9/0 jump shortcuts.
const ADMIN_EMAILS = ['sammam.mahdi@gmail.com', 'abrarsamin100@gmail.com', 'ahammadalislam755@gmail.com'];

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

  // Sound mute state is owned + toggled inside Settings.jsx directly.

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAuth((user) => setAuthUser(user));
    // On desktop, start listening for dieagain:// OAuth callbacks. No-op
    // on the web build.
    initDesktopAuth();
    return () => unsub && unsub();
  }, []);

  // Admin mode is gated by email — non-admin sign-ins (or sign-out) cannot
  // keep adminMode true.
  const isAdmin = isAdminAccount(authUser);
  useEffect(() => {
    if (!isAdmin && adminMode) setAdminMode(false);
  }, [isAdmin, adminMode]);

  // Admin perks: while adminMode is on, the jewel purse is treated as
  // unlimited (shop reads "you can afford this" and purchases are no-ops
  // so the real persisted purse isn't drained while testing).
  useEffect(() => {
    setAdminUnlimited(adminMode);
  }, [adminMode]);

  // Live cloud sync — whenever the local jewel purse, equipped/owned
  // cosmetics, or consumable inventory mutate, push a fresh snapshot
  // to Firestore. Debounced 1.2s so rapid edits (e.g. binge-buying
  // skins in the shop) coalesce into one write instead of N.
  // Per-level cloud sync still fires on level complete; this hook
  // catches all the OTHER mutation paths (shop purchases, in-level
  // potion pickups, jewel earnings between levels, etc.) so nothing
  // is ever lost just because the player closed the tab mid-shop.
  useEffect(() => {
    if (!authUser || !isCloudEnabled()) return undefined;
    let pending = null;
    const push = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        submitScore({
          uid: authUser.uid,
          username: authUser.displayName || authUser.email?.split('@')[0] || 'anon',
          scoreData: {
            jewels: getRealJewels(),
            cosmetics: getCosmetics(),
            consumables: getInventory(),
            consumableUpgrades: getUpgrades(),
          },
        }).catch((e) => {
          // eslint-disable-next-line no-console
          console.warn('Live sync failed:', e?.message || e);
        });
      }, 1200);
    };
    const u1 = subscribeJewels(push);
    const u2 = subscribeCosmetics(push);
    const u3 = subscribeConsumables(push);
    return () => {
      if (pending) clearTimeout(pending);
      u1(); u2(); u3();
    };
  }, [authUser]);

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

  // Phase 3b — Echo Dimension state.
  //   pendingSideQuestComplete: set by handleEchoComplete; OR'd into the
  //     next handleLevelComplete's sideQuest result so finishing the main
  //     level after an echo clear awards Platinum (or Diamond on 0 deaths).
  //   returnPortalPos: portal world position captured at entry. After the
  //     echo ends, mainTeleportRequest fires so the main level (still
  //     mounted under the hidden echo screen) teleports its Player to
  //     this exact spot.
  //   mainTeleportRequest: { signal, pos } — bumped each round-trip to
  //     trigger the teleport useEffect inside the active main level.
  //   warpPhase: 'in' | 'out' | null — drives the rotating-blur warp
  //     overlay rendered above everything during the screen swap.
  const [pendingSideQuestComplete, setPendingSideQuestComplete] = useState(false);
  const returnPortalPosRef = useRef(null);
  const [mainTeleportRequest, setMainTeleportRequest] = useState(null);
  const [warpPhase, setWarpPhase] = useState(null);
  const warpTimerRef = useRef(null);

  const playWarp = (phase) => {
    setWarpPhase(phase);
    if (warpTimerRef.current) clearTimeout(warpTimerRef.current);
    warpTimerRef.current = setTimeout(() => setWarpPhase(null), WARP_DURATION_MS);
  };

  const [persistedProgress, setPersistedProgress] = useState(() => loadProgress());

  // When auth state changes, progress is owned by whoever is signed in.
  // Extracted to useCloudProgressSync — handles signed-out clear and
  // signed-in cloud-fetch + jewel/cosmetics/consumables hydration.
  useCloudProgressSync(authUser, setPersistedProgress);

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
        runStartJewelsRef.current = getRealJewels();
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

  // Phase 3b — Echo Dimension routing.
  //
  // handlePortalEnter: fired by a Level when the player walks through
  //   its portal. Stores the portal's world position for the return
  //   respawn anchor and swaps the screen to that level's echo variant.
  // handleEchoComplete: fired by the inner Level (running inside
  //   EchoLevel) when the player clears the echo. Sets pendingSideQuest
  //   so the next main-level complete awards Platinum/Diamond; swaps
  //   back to the main level which remounts at the portal position.
  // handleEchoDeath: a death inside the echo just drops the player back
  //   to the main level — no Hardcore tries consumed, no side-quest
  //   credit. Entering the portal was a one-shot attempt.
  const handlePortalEnter = (levelNumber, pos) => {
    const echoScreen = ECHO_SCREENS[levelNumber];
    if (!echoScreen) return;
    returnPortalPosRef.current = pos || null;
    setPendingSideQuestComplete(false);
    playWarp('in');
    setCurrentScreen(echoScreen);
  };

  const finishEcho = (levelNumber, sideQuestCleared) => {
    setPendingSideQuestComplete(sideQuestCleared);
    const main = LEVEL_SCREENS[levelNumber];
    if (!main) return;
    playWarp('out');
    setCurrentScreen(main);
    // Bump the teleport request so the main level (still mounted under
    // the now-unmounting echo subtree) drops the player back at the
    // portal world position. Using Date.now() as the signal value
    // guarantees a fresh value even if two echoes resolve in the same
    // millisecond.
    if (returnPortalPosRef.current) {
      setMainTeleportRequest({ signal: Date.now(), pos: returnPortalPosRef.current });
    }
  };

  const handleEchoComplete = (levelNumber) => finishEcho(levelNumber, true);
  const handleEchoDeath = (levelNumber) => finishEcho(levelNumber, false);

  const handleToggleAdmin = (next) => {
    if (!isAdmin) {
      setAdminMode(false);
      return;
    }
    setAdminMode(next);
  };

  // Snapshot the run state for the RunFailed screen. Called when the
  // player exhausts their tries (and has no Extra Life, OR declines to
  // burn one).
  const bailToRunFailed = () => {
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
      jewelsEarned: Math.max(0, getRealJewels() - runStartJewelsRef.current),
      maxStreak,
      runStats,
    });
    setCurrentScreen('runFailed');
  };

  const handleDeath = () => {
    playDeath();
    setDeathCount(prev => prev + 1);
    // Hardcore: drain a try; on the transition to 0, ASK the player
    // whether to burn an Extra Life (if owned) or end the run.
    // Guard against repeated deaths after the run is already over so
    // the screen swap only fires once.
    if (mode === 'hardcore' && runFailedSummary == null) {
      setStreak(0);
      setTriesLeft(prev => {
        const next = prev - 1;
        if (prev > 0 && next <= 0) {
          // Defer the prompt/RunFailed by 200 ms so the death sound
          // plays + HUD-dead overlay shows before the modal pops.
          setTimeout(() => {
            if ((getInventory().extra_life || 0) > 0) {
              setExtraLifePromptOpen(true);
            } else {
              bailToRunFailed();
            }
          }, 200);
        }
        return next;
      });
    }
  };

  // ExtraLife prompt — open when the player would otherwise hit
  // RunFailed AND they have ≥1 Extra Life in inventory.
  const [extraLifePromptOpen, setExtraLifePromptOpen] = useState(false);

  const handleUseExtraLife = () => {
    if (consumeOne('extra_life')) {
      setTriesLeft(HARDCORE_TRIES);
      setExtraLifePromptOpen(false);
      // Player is still on the dead overlay; press R restarts the
      // level with refilled tries — matches the original Hardcore loop.
    } else {
      // Stock disappeared between roll and confirm — bail anyway.
      setExtraLifePromptOpen(false);
      bailToRunFailed();
    }
  };

  const handleDeclineExtraLife = () => {
    setExtraLifePromptOpen(false);
    bailToRunFailed();
  };

  const handleLevelComplete = (levelNumber, sideQuest = null) => {
    // sideQuest: { complete: boolean } | null — Hardcore-only. The level
    // sets `complete: true` when the player entered + cleared the portal's
    // side-level (Phase 3 portal mechanic). Used by getMedal to award
    // Platinum (sideQuest cleared) or Diamond (sideQuest cleared + 0 deaths).
    playWin();
    // Tutorial: no medal / time / runStats — just flag completion + show a
    // simple reward screen with the tutorial_complete achievement (if new).
    if (levelNumber === 0) {
      const { progress: tutorialProg, newlyUnlocked: tutorialNewly } = recordTutorialComplete();
      setPersistedProgress(tutorialProg);
      const tutorialPoints = pointsForLevelResult({ medal: 'none', newlyUnlocked: tutorialNewly });
      if (tutorialNewly.length > 0) {
        setRunScore(prev => prev + tutorialPoints);
        // First-Footing pays out as jewels too — gives the player their
        // first economy unlock right after clearing the tutorial.
        const tutorialBounty = achievementPoints(tutorialNewly);
        if (tutorialBounty > 0) addJewels(tutorialBounty);
      }
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
    // Portal side-quest: prefer the App-tracked pendingSideQuestComplete
    // (set by handleEchoComplete after the player clears the echo) OR
    // the level's own legacy fallback flag in `sideQuest.complete`.
    // Practice mode never qualifies — Echo is Hardcore-only.
    const sideQuestComplete = !!(
      mode === 'hardcore' &&
      (pendingSideQuestComplete || (sideQuest && sideQuest.complete))
    );
    if (pendingSideQuestComplete) setPendingSideQuestComplete(false);
    const medal = getMedal(levelNumber, deathsUsed, sideQuestComplete);

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
      medal,
      persistedProgress,
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

    // Achievement bounty: every newly-unlocked achievement also pays its
    // `score` value as jewels (one-time, since `newlyUnlocked` only fires
    // the first time each id is earned). Stacks on top of any jewels the
    // player picked up in the level.
    const achPoints = achievementPoints(newlyUnlocked);
    if (achPoints > 0) addJewels(achPoints);

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
          tutorialComplete: !!updated.tutorialComplete,
          jewels: getRealJewels(),
          cosmetics: getCosmetics(),
          consumables: getInventory(),
          consumableUpgrades: getUpgrades(),
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
      sideQuestComplete,
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

    // Hardcore final (cleared L10) → bank the run-complete record + cloud
    // sync, then bounce straight back to the Start menu. The previous flow
    // showed an intermediate CompleteScreen, but the per-level RewardScreen
    // already surfaces the L10 medal, points, and achievements — a second
    // summary felt redundant, so end-of-game just returns the player home.
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
            tutorialComplete: !!updated.tutorialComplete,
            jewels: getRealJewels(),
          },
        }).catch(() => {});
      }
      goToStart();
      return;
    }

    // Practice → return to the Practice level-select grid (single-level loop).
    if (rewardData.mode === 'practice') {
      setCurrentScreen('practiceSelect');
      return;
    }

    // Hardcore (non-final) → next sequential level. The "isFinal" branch
    // above already handles L10 → home; this just walks the chain for
    // levels 1-9.
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

  // Phase 3 portal gating: portals only spawn in Hardcore on levels the
  // player has already Gold'd (i.e. shown they can clear cleanly). Used
  // as a prop on each RunStatsProvider so the level can decide whether
  // to attempt a spawn roll.
  //
  // Dev override: when adminMode is ON, portals spawn in EVERY mode +
  // EVERY level + bypass the 35% random roll (see portalAlwaysSpawn).
  // Lets developers test the portal mechanic without first Gold-clearing
  // the level in Hardcore.
  // Master switch — flip back to `false` to re-enable the Phase 3b
  // portal-to-echo flow. While true, no level reports `portalEligible`,
  // so the portal mesh never spawns and the admin always-spawn override
  // is also blocked. Echo Dimension code stays intact and reachable via
  // direct screen routing if needed.
  const PORTALS_DISABLED = true;
  const PORTAL_MEDALS = ['gold', 'platinum', 'diamond'];
  const portalEligibleFor = (lvl) => {
    if (PORTALS_DISABLED) return false;
    if (adminMode) return true;
    return mode === 'hardcore'
      && PORTAL_MEDALS.includes(persistedProgress.medals?.[lvl]);
  };
  // Force every gated portal to spawn (skip 35% roll) when in admin mode.
  // Also gated by PORTALS_DISABLED so the master switch fully turns the
  // portal mechanic off.
  const portalAlwaysSpawn = !PORTALS_DISABLED && adminMode;

  return (
    <div className="App">
      {/* Top-of-screen "Update available" banner — desktop builds only,
          no-op on the web. Renders above every screen so the player sees
          it whether they're on the start screen, in a level, or in a
          menu. */}
      <UpdateBanner />
      {currentScreen === 'start' && (
        <StartScreen
          onStart={handleStartGame}
          adminMode={adminMode}
          onToggleAdmin={handleToggleAdmin}
          onAdminJump={handleAdminJump}
          authUser={authUser}
          onSignIn={() => setAuthModalMode('signin')}
          onRegister={() => setAuthModalMode('register')}
          onSignOut={async () => { await signOutUser(); }}
          onLeaderboard={() => setCurrentScreen('leaderboard')}
          onMyStats={() => setCurrentScreen('mystats')}
          onGuide={() => setCurrentScreen('guide')}
          onShop={() => setCurrentScreen('shop')}
          onSettings={() => { playUIOpen(); setSettingsOpen(true); }}
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
      <LevelHost
        currentScreen={currentScreen}
        qid={qid}
        deathCount={deathCount}
        runScore={runScore}
        levelStartDeaths={levelStartDeaths}
        mode={mode}
        triesLeft={triesLeft}
        streak={streak}
        portalEligibleFor={portalEligibleFor}
        portalAlwaysSpawn={portalAlwaysSpawn}
        mainTeleportRequest={mainTeleportRequest}
        onDeath={handleDeath}
        onComplete={handleLevelComplete}
        onRestart={handleRestart}
        onPortalEnter={handlePortalEnter}
        onEchoDeath={handleEchoDeath}
        onEchoComplete={handleEchoComplete}
      />

      <WarpOverlay phase={warpPhase} />
      {currentScreen === 'reward' && rewardData && (
        <RewardScreen data={rewardData} onContinue={handleRewardContinue} />
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

      {/* Hardcore "use Extra Life?" modal — appears when the player
          exhausts their 3 tries AND has at least one Extra Life. */}
      {extraLifePromptOpen && (
        <ExtraLifePrompt
          availableExtraLives={getInventory().extra_life || 0}
          onUse={handleUseExtraLife}
          onDecline={handleDeclineExtraLife}
        />
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

export default App;
