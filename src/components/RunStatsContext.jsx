import React, { createContext, useContext } from 'react';

// Run-level state read by the in-level HUD without having to thread props
// through every Level*.jsx file. Provider is wrapped around the level
// rendering in App.js.
const RunStatsContext = createContext({
  runScore: 0,
  levelStartDeaths: 0,
});

export function RunStatsProvider({ runScore, levelStartDeaths, children }) {
  return (
    <RunStatsContext.Provider value={{ runScore, levelStartDeaths }}>
      {children}
    </RunStatsContext.Provider>
  );
}

export function useRunStats() {
  return useContext(RunStatsContext);
}
