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
  paused: false,
  teleportRequest: null,
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
  // Phase 3b: when true, the level's Player + Sim useFrame loops
  // short-circuit so the main level can be frozen in place while an
  // Echo Dimension plays on top. State (block visibility, timers,
  // sequence position, etc.) is naturally preserved because the level
  // component never unmounts.
  paused = false,
  // Phase 3b: { signal, pos } — when the signal value changes, the level
  // teleports its Player to `pos` (via playerControlRef.teleportTo).
  // App.js sets this after an Echo Dimension ends so the player returns
  // to the portal world position they entered from. The level component
  // never unmounts, so all of its game state survives the round-trip.
  teleportRequest = null,
  children,
}) {
  return (
    <RunStatsContext.Provider value={{
      runScore, levelStartDeaths, mode, triesLeft, streak,
      portalEligible, portalAlwaysSpawn, paused, teleportRequest,
    }}>
      {children}
    </RunStatsContext.Provider>
  );
}

export function useRunStats() {
  return useContext(RunStatsContext);
}
