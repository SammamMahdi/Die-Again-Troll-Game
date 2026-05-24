import React, { createContext, useContext } from 'react';

// Run-level state read by the in-level HUD without having to thread props
// through every Level*.jsx file. Provider is wrapped around the level
// rendering in App.js.
const RunStatsContext = createContext({
  runScore: 0,
  levelStartDeaths: 0,
  mode: null,
  triesLeft: Infinity,
  streak: 0,
  portalEligible: false,
  portalAlwaysSpawn: false,
});

export function RunStatsProvider({
  runScore,
  levelStartDeaths,
  mode = null,
  triesLeft = Infinity,
  streak = 0,
  portalEligible = false,
  // Admin / dev override: skip the 35% spawn roll so portals always
  // appear when eligible. App.js flips this true when adminMode is on.
  portalAlwaysSpawn = false,
  children,
}) {
  return (
    <RunStatsContext.Provider value={{
      runScore, levelStartDeaths, mode, triesLeft, streak,
      portalEligible, portalAlwaysSpawn,
    }}>
      {children}
    </RunStatsContext.Provider>
  );
}

export function useRunStats() {
  return useContext(RunStatsContext);
}
