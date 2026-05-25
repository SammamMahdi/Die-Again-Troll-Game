import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import QualityCanvas from '../../components/QualityCanvas';
import QualitySparkles from '../../components/QualitySparkles';
import { useGraphics } from '../../components/GraphicsProvider';
import Player from '../../components/Player';
import AnimatedBlock from '../../components/AnimatedBlock';
import Gate from '../../components/Gate';
import InfiniteGrid from '../../components/InfiniteGrid';
import JewelField from '../../components/JewelField';
import { useRunStats } from '../../components/RunStatsContext';
import { candidatesFromBlocks } from '../../utils/jewelCandidates';
import HUD from '../../components/HUD';
import CameraController from '../../components/CameraController';
import ScenePostFX from '../../components/ScenePostFX';
import { getEchoVisual } from '../../utils/echoThemes';
import useRestartOnR from '../../hooks/useRestartOnR';
import useVictoryTimer from '../../hooks/useVictoryTimer';
import useTeleportOnRequest from '../../hooks/useTeleportOnRequest';
import '../Level.css';

// =============================================================
// Level 4 ECHO — "Magma Slick"
//
//   Spec:
//   - 80% of blocks are illusions — they LOOK solid but the player
//     falls right through. Only 1 in 5 is real.
//   - Launchers REMOVED. The shortcut-bounce paths from main L4
//     are gone; every step counts.
//   - Misleading colors: blocks that look red-warning might be the
//     safe ones, while blocks that look obviously safe blue might be
//     traps. The player has to memorize, not eyeball.
//   - Theme: iridescent magma slick, rainbow oil sheen.
// =============================================================

const DEFAULT_START = [0, 5, 40];

// Display types — what the block visually appears as.
const D_SAFE = 'safe';        // appears solid + cool blue
const D_TRAP = 'trap';        // appears red warning
const D_GOAL = 'goal';

const COLOR_SAFE_LOOK = [0.18, 0.30, 0.95];   // calming blue (misleading)
const COLOR_TRAP_LOOK = [0.95, 0.20, 0.18];   // angry red (also misleading)
const COLOR_ILLUSION_LOOK = [0.50, 0.50, 0.65];
const COLOR_GOAL_LOOK = [1.0, 0.55, 0.10];    // honest amber goal

// `displayType` is what it LOOKS like.
// `solid` is whether it actually catches the player.
// Echo trick: D_SAFE can be solid OR illusion. D_TRAP can be solid OR
// illusion. The visual is deliberately decoupled from physical reality.
function mkBlock({ x, z, displayType, solid, w = 4, h = 1, d = 4, isGoal }) {
  const look =
    displayType === D_SAFE ? COLOR_SAFE_LOOK :
    displayType === D_TRAP ? COLOR_TRAP_LOOK :
    displayType === D_GOAL ? COLOR_GOAL_LOOK :
    COLOR_ILLUSION_LOOK;
  return {
    displayType,
    x, y: 0, z,
    startX: x, startY: 0, startZ: z,
    w, h, d,
    visible: true,
    solid: !!solid,
    isGoal: !!isGoal,
    color: [...look],
    // Flash brightly the first time the player falls through an illusion
    // so it briefly visually "betrays" before disappearing.
    betrayalFlash: 0,
  };
}

function buildBlocks() {
  // 1 in 5 is real (solid). Layout is the same z-line as main L4 but
  // with no launchers — pure platforming.
  // Real (solid) blocks marked SOLID; illusions marked NOT-solid.
  return [
    // Start big platform — always solid + safe-looking.
    mkBlock({ x: 0, z: 40, displayType: D_SAFE, solid: true, w: 8, d: 8 }),

    // Path stones — display vs real are scrambled.
    //   safe-look but illusion (the "trust your eyes" trap)
    mkBlock({ x: 0,  z: 30, displayType: D_SAFE, solid: false }),
    //   trap-look but REAL (the "fear the red" trick)
    mkBlock({ x: -6, z: 24, displayType: D_TRAP, solid: true }),
    //   trap-look + illusion (looks bad, is bad — dead end)
    mkBlock({ x: -6, z: 18, displayType: D_TRAP, solid: false }),
    //   safe-look + REAL
    mkBlock({ x:  0, z: 12, displayType: D_SAFE, solid: true }),
    //   safe-look + illusion
    mkBlock({ x:  6, z: 12, displayType: D_SAFE, solid: false }),

    //   trap-look + REAL — keep going
    mkBlock({ x:  6, z:  6, displayType: D_TRAP, solid: true }),
    mkBlock({ x: 12, z:  0, displayType: D_SAFE, solid: false }),
    //   trap-look + REAL again
    mkBlock({ x:  6, z: -6, displayType: D_TRAP, solid: true }),
    mkBlock({ x:  0, z:-12, displayType: D_SAFE, solid: false }),
    mkBlock({ x: -6, z:-12, displayType: D_SAFE, solid: true }),

    //   long middle stretch — all the safe-look ones are illusions
    mkBlock({ x:-12, z:-18, displayType: D_SAFE, solid: false }),
    mkBlock({ x:-12, z:-24, displayType: D_TRAP, solid: true }),
    mkBlock({ x: -6, z:-30, displayType: D_SAFE, solid: false }),
    mkBlock({ x:  0, z:-30, displayType: D_TRAP, solid: true }),
    mkBlock({ x:  0, z:-36, displayType: D_SAFE, solid: true }),
    mkBlock({ x:  6, z:-42, displayType: D_SAFE, solid: false }),
    mkBlock({ x:  0, z:-42, displayType: D_TRAP, solid: true }),

    //   final stretch — trap-look REAL straight line
    mkBlock({ x:  0, z:-48, displayType: D_TRAP, solid: true }),
    mkBlock({ x:  0, z:-54, displayType: D_SAFE, solid: false }),
    mkBlock({ x:  0, z:-60, displayType: D_TRAP, solid: true }),

    // Goal
    mkBlock({ x:  0, z:-70, displayType: D_GOAL, solid: true, w: 10, d: 10, isGoal: true }),
  ];
}

const GATE = { x: 0, y: 0.5, z: -70 };
const __l4e_fresh = buildBlocks();
const JEWEL_CANDIDATES = candidatesFromBlocks(__l4e_fresh);

function Level4Echo({
  deathCount,
  onDeath,
  onComplete,
  onRestart,            // eslint-disable-line no-unused-vars
  onPortalEnter,        // eslint-disable-line no-unused-vars
  startPositionOverride,
}) {
  const q = useGraphics();
  const { paused, teleportRequest } = useRunStats();
  const sideQuestCompleteRef = useRef(false);
  const START = startPositionOverride || DEFAULT_START;
  const echoVisual = getEchoVisual(4);

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  const blocksRef = useRef(buildBlocks());
  const playerPosRef = useRef(START);
  const prevBlockIdxRef = useRef(-1);
  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  useTeleportOnRequest(playerControlRef, teleportRequest);

  const handlePlayerDeath = (reason) => {
    if (gameState !== 'playing') return;
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handleRestart = () => {
    const fresh = buildBlocks();
    if (blocksRef.current.length === fresh.length) {
      blocksRef.current.forEach((b, i) => Object.assign(b, fresh[i]));
    } else {
      blocksRef.current = fresh;
    }
    prevBlockIdxRef.current = -1;
    playerPosRef.current = START;
    setPlayerPosition(START);
    setDeathReason('');
    setGameState('playing');
    setRestartKey(prev => prev + 1);
  };

  useRestartOnR(gameState, handleRestart);

  const handlePlayerUpdate = (pos) => {
    playerPosRef.current = pos;
    setPlayerPosition(pos);

    // Detect which (solid) block the player is on top of right now,
    // for goal-touch + first-step-on-illusion betrayal flash.
    let onIdx = -1;
    for (let i = 0; i < blocksRef.current.length; i++) {
      const b = blocksRef.current[i];
      if (!b.visible || b.solid === false) continue;
      const top = b.y + b.h / 2;
      if (pos[1] - 0.5 < top - 0.1 || pos[1] - 0.5 > top + 0.4) continue;
      if (Math.abs(pos[0] - b.x) > b.w / 2 + 0.4) continue;
      if (Math.abs(pos[2] - b.z) > b.d / 2 + 0.4) continue;
      onIdx = i;
      break;
    }
    if (onIdx !== prevBlockIdxRef.current) {
      const cur = onIdx >= 0 ? blocksRef.current[onIdx] : null;
      if (cur && cur.isGoal && gameState === 'playing') setGameState('won');
      prevBlockIdxRef.current = onIdx;
    }
  };

  useVictoryTimer(gameState, () => onComplete({ complete: sideQuestCompleteRef.current }));

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [30, 20, 50], fov: 60 }}
        style={{ background: echoVisual?.sky, touchAction: 'none' }}
      >
        <fog attach="fog" args={[echoVisual?.fogColor || '#2a0a00', echoVisual?.fogNear ?? 32, echoVisual?.fogFar ?? 170]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.5} color={echoVisual?.ambientColor || '#ff8844'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ff6633', echoVisual?.hemiBottom || '#220a00', echoVisual?.hemiIntensity ?? 0.5]} />
        <directionalLight position={[15, 25, 10]} intensity={1.0} color="#ff9955" />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 8, 40]} intensity={0.55} color="#ff5511" distance={50} />
            <pointLight position={[0, 8, -70]} intensity={0.65} color="#ffaa44" distance={28} />
          </>
        )}

        <QualitySparkles
          position={[0, 6, -25]} count={60} scale={[20, 8, 100]} size={1.8} speed={0.6}
          color="#ff7733"
        />
        <QualitySparkles
          position={[0, 4, -70]} count={30} scale={[8, 5, 4]} size={2.4} speed={0.3}
          color={echoVisual?.sparkleColor || '#ff7733'}
        />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => {
          let edgeColor = '#ff7733';
          let emissive = 0.18;
          if (b.displayType === D_TRAP) { edgeColor = '#ff3322'; emissive = 0.35; }
          else if (b.displayType === D_GOAL) { edgeColor = '#ffaa44'; emissive = 0.45; }
          else if (b.displayType === D_SAFE) { edgeColor = '#5577ff'; emissive = 0.22; }
          // Illusions get a near-imperceptible alpha shimmer via Sim.
          return (
            <AnimatedBlock
              key={`${restartKey}-block-${i}`}
              block={b}
              edgeColor={edgeColor}
              emissiveBoost={emissive}
            />
          );
        })}

        <Gate position={[GATE.x, GATE.y, GATE.z]} jewelColor="#ff7733" />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        <Player
          key={restartKey}
          startPosition={START}
          blocks={blocksRef.current}
          gate={null}
          onDeath={handlePlayerDeath}
          onWin={() => {}}
          onUpdate={handlePlayerUpdate}
          onGateTrigger={() => {}}
          gameState={paused ? 'paused' : gameState}
          mobileControlRef={playerControlRef}
        />

        <Level4EchoSim
          gameState={paused ? 'paused' : gameState}
          blocksRef={blocksRef}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.6} hue={0.04} />
      </QualityCanvas>

      <HUD
        level={4}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Color lies. Find the true path.</div>
      )}
    </div>
  );
}

// Sim — gives illusion blocks a subtle oily shimmer (slow color hue
// drift) so they're a TINY bit distinguishable to a very patient player.
// Plus: when the player drops through an illusion, briefly flash it
// "real-red" before letting them fall through (sells the betrayal).
function Level4EchoSim({ gameState, blocksRef }) {
  const tRef = useRef(0);
  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') return;
    const delta = Math.min(deltaRaw, 0.05);
    tRef.current += delta;
    const t = tRef.current;
    for (const b of blocksRef.current) {
      if (b.solid === false && b.visible) {
        const flicker = 0.55 + 0.18 * Math.sin(t * 4.5 + b.x + b.z);
        if (b.displayType === D_SAFE) {
          b.color = [
            COLOR_SAFE_LOOK[0] * flicker,
            COLOR_SAFE_LOOK[1] * flicker,
            COLOR_SAFE_LOOK[2] * flicker,
          ];
        } else if (b.displayType === D_TRAP) {
          b.color = [
            COLOR_TRAP_LOOK[0] * flicker,
            COLOR_TRAP_LOOK[1] * flicker,
            COLOR_TRAP_LOOK[2] * flicker,
          ];
        }
      }
    }
  });
  // The "betrayal flash" + fall sound when the player crosses through
  // an illusion is left to the standard fall-out-of-world death from
  // Player.jsx.
  return null;
}

export default Level4Echo;
