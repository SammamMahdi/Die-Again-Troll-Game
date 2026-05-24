// Rewards system: medals + achievements + localStorage persistence.
// All state is keyed under one localStorage entry so a single read/write
// round-trip captures everything.

const STORAGE_KEY = 'die-again-rewards-v1';

// ----- Medals -----
// "Best medal achieved" per level. The thresholds tell us, at completion
// time, which medal the run earned based on deaths used.
//
// gold:   deaths <= gold threshold
// silver: deaths <= silver threshold
// bronze: any completion (you have to die a lot to be human about it)
export const MEDAL_THRESHOLDS = {
  1:  { gold: 0, silver: 2 },
  2:  { gold: 0, silver: 2 },
  3:  { gold: 0, silver: 3 },
  4:  { gold: 0, silver: 3 },
  5:  { gold: 0, silver: 3 },
  6:  { gold: 0, silver: 4 },
  7:  { gold: 0, silver: 4 },
  8:  { gold: 0, silver: 4 },
  9:  { gold: 0, silver: 5 },
  10: { gold: 0, silver: 5 },
};

export const MEDAL_RANK = { none: 0, bronze: 1, silver: 2, gold: 3 };

export function getMedal(levelNumber, deathsUsed) {
  const t = MEDAL_THRESHOLDS[levelNumber];
  if (!t) return 'bronze';
  if (deathsUsed <= t.gold) return 'gold';
  if (deathsUsed <= t.silver) return 'silver';
  return 'bronze';
}

// ----- Achievement catalog -----
// Each achievement carries its own score value so totals are easy to compute.
export const ACHIEVEMENTS = [
  { id: 'first_steps',       name: 'First Steps',         desc: 'Complete Level 1.',                             score: 25 },
  { id: 'phantom_runner',    name: 'Phantom Runner',      desc: 'Clear Level 1 with 0 deaths.',                  score: 25 },
  { id: 'red_light_winner',  name: 'Red Light Winner',    desc: 'Clear Level 2 with 0 deaths.',                  score: 25 },
  { id: 'frost_master',      name: 'Frost Master',        desc: 'Clear Level 3 with 0 deaths.',                  score: 25 },
  { id: 'betrayal_survivor', name: 'Trust Issues',        desc: 'Clear Level 4 with 0 deaths.',                  score: 25 },
  { id: 'pendulum_dancer',   name: 'Pendulum Dancer',     desc: 'Clear Level 5 with 0 deaths.',                  score: 25 },
  { id: 'spin_master',       name: 'Spin Master',         desc: 'Clear Level 6 with 0 deaths.',                  score: 25 },
  { id: 'walks_in_dark',     name: 'Walks in Darkness',   desc: 'Clear Level 7 with 0 deaths.',                  score: 25 },
  { id: 'mirror_mind',       name: 'Mirror Mind',         desc: 'Clear Level 8 with 0 deaths.',                  score: 25 },
  { id: 'storm_walker',      name: 'Storm Walker',        desc: 'Clear Level 9 with 0 deaths.',                  score: 25 },
  { id: 'architect_slayer',  name: 'Architect Slayer',    desc: 'Clear Level 10 with 0 deaths.',                 score: 50 },
  { id: 'iron_will',         name: 'Iron Will',           desc: 'Complete all 10 levels in one run.',            score: 250 },
  { id: 'flawless',          name: 'Flawless',            desc: 'Complete all 10 levels with 0 deaths each.',    score: 500 },
  { id: 'speed_demon_1',     name: 'Speed Demon I',       desc: 'Complete Level 1 in under 30s.',                score: 50 },
  { id: 'speed_demon_2',     name: 'Speed Demon II',      desc: 'Complete Level 2 in under 45s.',                score: 50 },
  { id: 'speed_demon_3',     name: 'Speed Demon III',     desc: 'Complete Level 3 in under 60s.',                score: 50 },
];

// Medal point values (per level). Exported so the HUD + RewardScreen can show
// "+100 (Gold medal)" lines without re-deriving the table.
export const MEDAL_POINTS = { gold: 100, silver: 50, bronze: 20, none: 0 };

/**
 * Compute total score for a progress object.
 *   Sum of medal points (10 levels × up to 100 = 1000) + achievement points.
 *
 * Achievement maximum = 25 (first_steps) + 9×25 (per-level no-deaths L1–L9)
 *                     + 50 (architect_slayer / L10 no-deaths) + 250 (iron_will)
 *                     + 500 (flawless) + 3×50 (speed_demon_1..3) = 1200.
 *
 * Theoretical max ≈ 1000 (medals) + 1200 (achievements) = 2200.
 */
export function computeScore(progress) {
  if (!progress) return 0;
  let total = 0;
  for (const lvl of Object.keys(progress.medals || {})) {
    total += MEDAL_POINTS[progress.medals[lvl]] || 0;
  }
  const ownedAch = progress.achievements || [];
  for (const id of ownedAch) {
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (def) total += def.score || 0;
  }
  return total;
}

export function medalCounts(progress) {
  const out = { gold: 0, silver: 0, bronze: 0 };
  for (const m of Object.values(progress?.medals || {})) {
    if (out[m] != null) out[m]++;
  }
  return out;
}

const SPEED_THRESHOLDS_MS = {
  1: 30 * 1000,
  2: 45 * 1000,
  3: 60 * 1000,
};

const NO_DEATH_ACHIEVEMENT = {
  1: 'phantom_runner',
  2: 'red_light_winner',
  3: 'frost_master',
  4: 'betrayal_survivor',
  5: 'pendulum_dancer',
  6: 'spin_master',
  7: 'walks_in_dark',
  8: 'mirror_mind',
  9: 'storm_walker',
  10: 'architect_slayer',
};

// Evaluate which achievements unlock right now (filtering ones already owned).
// Inputs:
//   level         number 1-10 (the level just completed)
//   deathsUsed    deaths for THIS level only
//   timeMs        elapsed ms for THIS level (pass 0 / -1 if the timer was
//                 never started — speed achievements will be skipped)
//   runStats      { [lvl]: {deaths, time, medal} } accumulated this run incl. current
//   usedAdmin     whether admin jump was used in this run (gates iron_will / flawless)
//   alreadyOwned  ids already in the user's persistent set
export function evaluateLevelComplete({ level, deathsUsed, timeMs, runStats, usedAdmin, alreadyOwned }) {
  const newly = [];
  const own = new Set(alreadyOwned);

  const add = (id) => {
    if (!own.has(id) && !newly.includes(id)) newly.push(id);
  };

  // Per-level basics
  if (level === 1) add('first_steps');
  if (deathsUsed === 0 && NO_DEATH_ACHIEVEMENT[level]) {
    add(NO_DEATH_ACHIEVEMENT[level]);
  }

  // Speed achievements — require a positive elapsed time. `timeMs <= 0` means
  // the timer was never started (defensive: prevents false-triggering a
  // sub-30s achievement when elapsedMs defaulted to 0).
  if (SPEED_THRESHOLDS_MS[level] && timeMs > 0 && timeMs < SPEED_THRESHOLDS_MS[level]) {
    add(`speed_demon_${level}`);
  }

  // Run-spanning (only when this is the final level AND no admin jumping)
  if (level === 10 && !usedAdmin) {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const playedAll = all.every(n => runStats[n]);
    if (playedAll) {
      add('iron_will');
      const allFlawless = all.every(n => runStats[n]?.deaths === 0);
      if (allFlawless) add('flawless');
    }
  }

  return newly;
}

// ----- Persistence -----
const EMPTY = {
  bestDeaths: {},   // { [level]: number }
  bestTimes:  {},   // { [level]: ms }
  medals:     {},   // { [level]: 'bronze' | 'silver' | 'gold' }
  achievements: [], // string[]
  totalRuns: 0,
  totalCompletes: 0,
  lastRun: null,    // { date, totals, perLevel }
};

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(EMPTY);
    const parsed = JSON.parse(raw);
    return { ...clone(EMPTY), ...parsed };
  } catch {
    return clone(EMPTY);
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* storage full / disabled — fail silently */
  }
}

// Updates the persistent record with the result of a single level completion.
// Returns the new progress object.
export function recordLevelComplete({ level, deathsUsed, timeMs, medal, newlyUnlocked }) {
  const prog = loadProgress();
  prog.bestDeaths[level] = Math.min(prog.bestDeaths[level] ?? Infinity, deathsUsed);
  // Only update bestTimes if we have a real elapsed time. `timeMs <= 0`
  // means the level start ref was missing — using it would corrupt the
  // user's record to 0ms forever.
  if (timeMs > 0) {
    prog.bestTimes[level] = Math.min(prog.bestTimes[level] ?? Infinity, timeMs);
  }
  const currentRank = MEDAL_RANK[prog.medals[level] || 'none'];
  const newRank = MEDAL_RANK[medal];
  if (newRank > currentRank) prog.medals[level] = medal;
  for (const id of newlyUnlocked) {
    if (!prog.achievements.includes(id)) prog.achievements.push(id);
  }
  saveProgress(prog);
  return prog;
}

// Sum the points a player earned from one level completion. Used by the HUD
// (running run total) and the RewardScreen (per-level breakdown) so both
// show the same number from the same source of truth.
export function pointsForLevelResult({ medal, newlyUnlocked }) {
  let total = MEDAL_POINTS[medal] || 0;
  for (const id of newlyUnlocked || []) {
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (def) total += def.score || 0;
  }
  return total;
}

export function recordRunComplete({ runStats, totalDeaths, totalMs }) {
  const prog = loadProgress();
  prog.totalRuns = (prog.totalRuns || 0) + 1;
  // A "complete" run requires all 10 levels in this run record
  if ([1,2,3,4,5,6,7,8,9,10].every(n => runStats[n])) {
    prog.totalCompletes = (prog.totalCompletes || 0) + 1;
  }
  prog.lastRun = {
    at: Date.now(),
    totalDeaths,
    totalMs,
    perLevel: runStats,
  };
  saveProgress(prog);
  return prog;
}

export function formatTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function getAchievementById(id) {
  return ACHIEVEMENTS.find(a => a.id === id);
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
