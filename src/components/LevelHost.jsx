import React from 'react';
import { RunStatsProvider } from './RunStatsContext';
import EchoLevel from './EchoLevel';
import Level1 from '../levels/Level1';
import Level2 from '../levels/Level2';
import Level3 from '../levels/Level3';
import Level4 from '../levels/Level4';
import Level5 from '../levels/Level5';
import Level6 from '../levels/Level6';
import Level7 from '../levels/Level7';
import Level8 from '../levels/Level8';
import Level9 from '../levels/Level9';
import Level10 from '../levels/Level10';

const LEVEL_COMPONENTS = {
  1: Level1, 2: Level2, 3: Level3, 4: Level4, 5: Level5,
  6: Level6, 7: Level7, 8: Level8, 9: Level9, 10: Level10,
};

// Derive the main level number from currentScreen. Both `level{n}` and
// `level{n}Echo` map to the same main level — the main component stays
// mounted across the portal round-trip so its game state survives.
// Returns null for non-level screens (start, reward, leaderboard, ...).
export function deriveMainLevelNum(currentScreen) {
  const s = currentScreen || '';
  if (!s.startsWith('level') || s === 'level0') return null;
  const tail = s.slice(5);
  const num = parseInt(tail.replace('Echo', ''), 10);
  if (!Number.isInteger(num) || num < 1 || num > 10) return null;
  return num;
}

// LevelHost owns the critical invariant: the main-level component MUST
// NOT unmount while its echo is active. If it did, all of its game
// state (blocks visibility, vanishing timers, pendulum positions, the
// sequence index, mid-level deaths, etc.) would be lost and the player
// couldn't resume the main level after returning from the echo.
//
// So this component renders the main level whenever currentScreen is
// either `level{n}` OR `level{n}Echo`. While echo is active, main is
// wrapped in `display:none` and gets `paused=true` via RunStatsProvider
// (which short-circuits its useFrame physics). The echo overlay mounts
// on top via the same Level component (with `hardMode` enabled and
// portals gated off so the player can't recurse).
function LevelHost({
  currentScreen,
  qid,
  deathCount,
  runScore,
  levelStartDeaths,
  mode,
  triesLeft,
  streak,
  portalEligibleFor,
  portalAlwaysSpawn,
  mainTeleportRequest,
  onDeath,
  onComplete,
  onRestart,
  onPortalEnter,
  onEchoDeath,
  onEchoComplete,
}) {
  const mainLevelNum = deriveMainLevelNum(currentScreen);
  if (mainLevelNum == null) return null;
  const echoActive = currentScreen.endsWith('Echo');
  const Main = LEVEL_COMPONENTS[mainLevelNum];
  const Echo = LEVEL_COMPONENTS[mainLevelNum];

  return (
    <>
      {/* Main level — stays mounted across portal round-trips. Hidden
          + paused while an echo is overlaid. */}
      <div
        key={`main-host-${mainLevelNum}`}
        style={{
          display: echoActive ? 'none' : 'block',
          width: '100%',
          height: '100%',
        }}
      >
        <RunStatsProvider
          runScore={runScore}
          levelStartDeaths={levelStartDeaths}
          mode={mode}
          triesLeft={triesLeft}
          streak={streak}
          portalEligible={portalEligibleFor(mainLevelNum)}
          portalAlwaysSpawn={portalAlwaysSpawn}
          paused={echoActive}
          teleportRequest={mainTeleportRequest}
        >
          <Main
            key={`level${mainLevelNum}-${qid}`}
            deathCount={deathCount}
            onDeath={onDeath}
            onComplete={(arg) => onComplete(mainLevelNum, arg)}
            onRestart={onRestart}
            onPortalEnter={(pos) => onPortalEnter(mainLevelNum, pos)}
            startPositionOverride={null}
          />
        </RunStatsProvider>
      </div>

      {/* Echo overlay — mounted only while currentScreen is an echo.
          Same Level component inside <EchoLevel> with hardMode + the
          universal echo framing. Portal is gated off so the player can't
          recurse. Deaths bail back to main without spending Hardcore
          tries. */}
      {echoActive && (
        <RunStatsProvider
          key={`echo-prov-${mainLevelNum}`}
          runScore={runScore}
          levelStartDeaths={levelStartDeaths}
          mode={mode}
          triesLeft={triesLeft}
          streak={streak}
          portalEligible={false}
          portalAlwaysSpawn={false}
        >
          <EchoLevel level={mainLevelNum}>
            <Echo
              key={`level${mainLevelNum}Echo-${qid}`}
              deathCount={0}
              onDeath={() => onEchoDeath(mainLevelNum)}
              onComplete={() => onEchoComplete(mainLevelNum)}
              onRestart={onRestart}
              onPortalEnter={() => {}}
              startPositionOverride={null}
              hardMode
            />
          </EchoLevel>
        </RunStatsProvider>
      )}
    </>
  );
}

export default LevelHost;
