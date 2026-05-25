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
// Level 3 ECHO — "Furnace Echo"
//
//   Spec:
//   - Sonar permanently ON. Every ghost block is visible without
//     the player having to charge SPACE.
//   - ~30% of the "real-looking" path blocks are FAKE — they look
//     solid but kill on touch (no collision; the player falls
//     through into the lava).
//   - Ghost-block count is doubled (two zigzag bridges of them).
//   - Wireframe-on-black aesthetic with red brimstone glow.
// =============================================================

const DEFAULT_START = [0, 5, 5];

// Block types
const T_NORMAL = 'normal';
const T_ICE = 'ice';
const T_GHOST = 'ghost';
const T_FAKE = 'fake';

const COLORS = {
  [T_NORMAL]: [0.55, 0.18, 0.10],
  [T_ICE]:    [0.6, 0.25, 0.15],
  [T_GHOST]:  [0.85, 0.4, 0.1],
  // Fakes look IDENTICAL to normals — the trick.
  [T_FAKE]:   [0.55, 0.18, 0.10],
};

function makeBlock(opts) {
  const { type, x, y, z, w, h, d } = opts;
  const isGhost = type === T_GHOST;
  const isIce = type === T_ICE;
  const isFake = type === T_FAKE;
  return {
    type, x, y, z, w, h, d,
    startX: x, startY: y, startZ: z,
    color: [...COLORS[type]],
    // Ghosts visible by default (sonarAlwaysOn). Visible = renderable;
    // collidable = participates in player physics.
    visible: true,
    collidable: !isFake,           // FAKES are non-solid — the player falls through
    solid: !isFake,
    friction: isIce ? 0.98 : undefined,
    isKill: false,
    isFake,
    isGhost,
  };
}

function buildBlocks() {
  return [
    // Start
    makeBlock({ type: T_NORMAL, x: 0, y: 0, z: 5, w: 4, h: 1, d: 6 }),

    // Ice approach (slippery — same as main but smaller for echo)
    makeBlock({ type: T_ICE,   x: 0, y: -1, z: -2, w: 4, h: 1, d: 8 }),

    // Doubled ghost-block zigzag bridge (10 instead of 5).
    makeBlock({ type: T_GHOST, x:  2, y: -1, z: -10, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST, x: -2, y: -1, z: -14, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST, x:  2, y: -1, z: -18, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST, x: -2, y: -1, z: -22, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST, x:  2, y: -1, z: -26, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST, x: -2, y: -1, z: -30, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST, x:  2, y: -1, z: -34, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST, x: -2, y: -1, z: -38, w: 3, h: 1, d: 3 }),

    // Mid haven — a normal-looking PAIR. One is real, one is FAKE.
    makeBlock({ type: T_NORMAL, x: -3, y: -1, z: -44, w: 4, h: 1, d: 4 }),
    makeBlock({ type: T_FAKE,   x:  3, y: -1, z: -44, w: 4, h: 1, d: 4 }),

    // Fake-out fork — visually three identical safe-looking stones.
    // The middle is fake (kills if you step on it).
    makeBlock({ type: T_NORMAL, x: -3, y: -1, z: -50, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_FAKE,   x:  0, y: -1, z: -50, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_NORMAL, x:  3, y: -1, z: -50, w: 3, h: 1, d: 3 }),

    // Second fake-out — only one path is real.
    makeBlock({ type: T_NORMAL, x: -3, y: -1, z: -55, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_FAKE,   x:  3, y: -1, z: -55, w: 3, h: 1, d: 3 }),

    // Goal
    makeBlock({ type: T_NORMAL, x: 0, y: -1, z: -62, w: 10, h: 1, d: 6 }),
  ];
}

const GATE = { x: 0, y: -0.5, z: -62 };
const WIN_RADIUS = 3.5;

const __l3e_fresh = buildBlocks();
const JEWEL_CANDIDATES = candidatesFromBlocks(__l3e_fresh);

function Level3Echo({
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
  const echoVisual = getEchoVisual(3);

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  const blocksRef = useRef(buildBlocks());
  const playerPosRef = useRef(START);
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
  };

  useVictoryTimer(gameState, () => onComplete({ complete: sideQuestCompleteRef.current }));

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [30, 18, 35], fov: 60 }}
        style={{ background: echoVisual?.sky, touchAction: 'none' }}
      >
        <fog attach="fog" args={[echoVisual?.fogColor || '#1a0500', echoVisual?.fogNear ?? 28, echoVisual?.fogFar ?? 130]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.45} color={echoVisual?.ambientColor || '#ff7733'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ff6622', echoVisual?.hemiBottom || '#0a0200', echoVisual?.hemiIntensity ?? 0.5]} />
        <directionalLight position={[15, 25, 10]} intensity={0.85} color="#ff8844" />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 8, -36]} intensity={0.8} color="#ff5511" distance={28} />
            <pointLight position={[0, 5, -62]} intensity={0.6} color="#ff8844" distance={26} />
          </>
        )}

        {/* Sparse ember points instead of stars in this infernal cave. */}
        <QualitySparkles
          position={[0, 6, -25]} count={50} scale={[16, 8, 60]} size={1.6} speed={0.5}
          color="#ff6622"
        />
        <QualitySparkles
          position={[0, 3, -62]} count={26} scale={[8, 5, 4]} size={2.2} speed={0.3}
          color={echoVisual?.sparkleColor || '#ff8844'}
        />

        <InfiniteGrid />

        {/* Render blocks. Ghost blocks wireframe; fakes look identical to
            normals so the player can't tell from sight alone — the only
            clue is geometric position (fakes are next to confirmed real
            stones in the fork sections). */}
        {blocksRef.current.map((b, i) => {
          const isGhost = b.isGhost;
          const isIce = b.type === T_ICE;
          let edgeColor = '#ff5522';
          if (isGhost) edgeColor = '#ffaa55';
          else if (isIce) edgeColor = '#ff7755';
          return (
            <AnimatedBlock
              key={`${restartKey}-block-${i}`}
              block={b}
              wireframe={isGhost}
              emissiveBoost={isGhost ? 0.55 : (isIce ? 0.25 : 0.18)}
              metalness={isIce ? 0.4 : 0.1}
              roughness={isIce ? 0.22 : 0.55}
              edgeColor={isGhost ? null : edgeColor}
            />
          );
        })}

        <Gate position={[GATE.x, GATE.y, GATE.z]} jewelColor="#ff8844" />

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

        <Level3EchoSim
          gameState={paused ? 'paused' : gameState}
          blocksRef={blocksRef}
          playerPosRef={playerPosRef}
          onWin={() => setGameState('won')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.6} hue={0.04} />
      </QualityCanvas>

      <HUD
        level={3}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Stones lie. Trust the burn.</div>
      )}
    </div>
  );
}

// Sim — just a win-check. Fake-block "kill on touch" is implicit: since
// solid=false on fakes, the player walks through them and falls into
// the void, triggering the standard fall-out-of-world death from
// Player.jsx — exactly what we want.
function Level3EchoSim({ gameState, blocksRef /* eslint-disable-line no-unused-vars */, playerPosRef, onWin }) {
  const wonRef = useRef(false);
  useFrame(() => {
    if (gameState !== 'playing') { wonRef.current = false; return; }
    if (wonRef.current) return;
    const [px, py, pz] = playerPosRef.current;
    const dx = px - GATE.x;
    const dz = pz - GATE.z;
    if (Math.sqrt(dx * dx + dz * dz) < WIN_RADIUS && py > GATE.y - 2 && py < 4) {
      wonRef.current = true;
      onWin();
    }
  });
  return null;
}

export default Level3Echo;
