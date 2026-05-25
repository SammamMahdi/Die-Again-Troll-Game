import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import QualityCanvas from '../../components/QualityCanvas';
import QualityStars from '../../components/QualityStars';
import QualitySparkles from '../../components/QualitySparkles';
import { useGraphics } from '../../components/GraphicsProvider';
import Player from '../../components/Player';
import Block from '../../components/Block';
import Gate from '../../components/Gate';
import InfiniteGrid from '../../components/InfiniteGrid';
import JewelField from '../../components/JewelField';
import { useRunStats } from '../../components/RunStatsContext';
import { candidatesFromBlocks } from '../../utils/jewelCandidates';
import HUD from '../../components/HUD';
import CameraController from '../../components/CameraController';
import ScenePostFX from '../../components/ScenePostFX';
import { playDisappear, playWarning } from '../../utils/sounds';
import { getEchoMechanic, getEchoVisual } from '../../utils/echoThemes';
import useRestartOnR from '../../hooks/useRestartOnR';
import useVictoryTimer from '../../hooks/useVictoryTimer';
import useTeleportOnRequest from '../../hooks/useTeleportOnRequest';
import '../Level.css';

// =============================================================
// Level 1 ECHO — "Sequence Inverted"
//
//   Spec (from the design plan):
//   - All 5 middle stones START visible (vs main, where they reveal
//     progressively as the player crosses a trigger line).
//   - The instant the player steps on a middle stone, a brief warning
//     blink fires and that stone vanishes after VANISH_DELAY seconds.
//   - No going back: stones don't come back; the player has to commit
//     to forward motion.
//   - Theme: cracked-earth with magma seams glowing through the gaps;
//     deep red-black sky, fire ambient.
// =============================================================

const PLANE_SIZE = 20;
const BLOCK_SIZE = 4;
const GAP_SIZE = 4;
const STEP_SIZE = BLOCK_SIZE + GAP_SIZE;
const DEFAULT_START = [0, 3, 20];
const WARN_DURATION = 0.5;       // last fraction of the timer flashes a warning

function buildBlocks() {
  const blocks = [];
  const startZ = 20;
  blocks.push({
    x: 0, y: 0, z: startZ,
    w: PLANE_SIZE, h: 1, d: PLANE_SIZE,
    visible: true, index: -1,
    color: [0.55, 0.18, 0.12],  // dark obsidian-red
  });
  let currentZ = startZ - (PLANE_SIZE / 2) - (GAP_SIZE + BLOCK_SIZE / 2);
  for (let i = 0; i < 5; i++) {
    blocks.push({
      x: 0, y: 0, z: currentZ,
      w: BLOCK_SIZE, h: 1, d: BLOCK_SIZE,
      visible: true,                 // ECHO: all middle stones start visible
      index: i,
      color: [0.5, 0.18, 0.12],      // cracked-earth red
      vanishTimer: null,             // null = untriggered; >0 = ticking down
      stepped: false,
      warned: false,
    });
    currentZ -= STEP_SIZE;
  }
  const endPlaneZ = currentZ - (GAP_SIZE + PLANE_SIZE / 2 - BLOCK_SIZE / 2);
  blocks.push({
    x: 0, y: 0, z: endPlaneZ,
    w: PLANE_SIZE, h: 1, d: PLANE_SIZE,
    visible: true, index: -1,
    color: [0.55, 0.18, 0.12],
  });
  return { blocks, endPlaneZ };
}

const __l1e_fresh = buildBlocks();
const JEWEL_CANDIDATES = candidatesFromBlocks(__l1e_fresh.blocks);

function Level1Echo({
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
  const echoMechanic = getEchoMechanic(1);
  const echoVisual = getEchoVisual(1);
  const VANISH_DELAY = echoMechanic.vanishDelay || 1.6;

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const initialBuild = useMemo(() => buildBlocks(), []);
  const [blocks, setBlocks] = useState(() => initialBuild.blocks);
  const goalRef = useRef({ x: 0, y: 0.5, z: initialBuild.endPlaneZ });
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  const playerPosRef = useRef(START);
  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);
  // Mirror of blocks for the per-frame Sim — mutating a ref avoids the
  // re-render storm a setBlocks-every-frame would cause.
  const blocksRef = useRef(initialBuild.blocks);

  useTeleportOnRequest(playerControlRef, teleportRequest);

  const handlePlayerDeath = (reason) => {
    if (gameState !== 'playing') return;
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handleRestart = () => {
    const fresh = buildBlocks();
    blocksRef.current = fresh.blocks;
    setBlocks(fresh.blocks);
    goalRef.current = { x: 0, y: 0.5, z: fresh.endPlaneZ };
    setGameState('playing');
    setDeathReason('');
    setRestartKey(prev => prev + 1);
  };

  useRestartOnR(gameState, handleRestart);

  const handlePlayerUpdate = (pos, blockIdx) => {
    playerPosRef.current = pos;
    setPlayerPosition(pos);

    // The instant the player lands on a middle stone (index 0-4),
    // arm its vanish timer. Repeated steps on the same stone don't
    // restart the timer — once tripped, it ticks down to zero.
    if (blockIdx >= 0 && blockIdx <= 4) {
      const target = blocksRef.current.find(b => b.index === blockIdx);
      if (target && !target.stepped && target.visible) {
        target.stepped = true;
        target.vanishTimer = VANISH_DELAY;
        playWarning();
      }
    }

    // Win when the player crosses onto the goal platform.
    const g = goalRef.current;
    const onGoal =
      Math.abs(pos[0] - g.x) < PLANE_SIZE / 2 &&
      Math.abs(pos[2] - g.z) < PLANE_SIZE / 2 &&
      pos[1] < 3;
    if (gameState === 'playing' && onGoal) setGameState('won');
  };

  useVictoryTimer(gameState, () => onComplete({ complete: sideQuestCompleteRef.current }));

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [30, 20, 40], fov: 60 }}
        style={{ background: echoVisual?.sky, touchAction: 'none' }}
      >
        <fog attach="fog" args={[echoVisual?.fogColor || '#1a0400', echoVisual?.fogNear ?? 35, echoVisual?.fogFar ?? 160]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.35} color={echoVisual?.ambientColor || '#ff7744'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ff5522', echoVisual?.hemiBottom || '#1a0400', echoVisual?.hemiIntensity ?? 0.45]} />
        <directionalLight position={[12, 22, 8]} intensity={0.9} color="#ff8866" />
        {!q.minimalLights && (
          <>
            <pointLight position={[-25, 14, 5]} intensity={0.7} color="#ff4422" distance={80} />
            <pointLight position={[0, 4, -28]} intensity={0.9} color="#ffaa33" distance={32} />
            <pointLight position={[0, 6, 20]} intensity={0.55} color="#ff5522" distance={28} />
          </>
        )}

        <QualityStars radius={180} depth={60} count={1400} factor={3} saturation={0.5} fade speed={0.4} />
        <QualitySparkles
          position={[0, 3, -28]}
          count={45}
          scale={[8, 5, 4]}
          size={3.5}
          speed={0.35}
          color={echoVisual?.sparkleColor || '#ff4422'}
        />

        <InfiniteGrid />

        {/* Render every stone — Sim mutates `block.color` to flash a red
            warning while the vanish timer is in its final WARN_DURATION
            window. */}
        {blocks.map((block, i) => {
          if (!block.visible) return null;
          // Highlight a stone the player has stepped on with a heavier
          // emissive while its timer is ticking; deepen during warning.
          let displayColor = block.color;
          let edgeColor = '#ff5522';
          let emissive = 0.25;
          if (block.stepped && block.vanishTimer != null) {
            const t = block.vanishTimer;
            const warning = t > 0 && t < WARN_DURATION;
            if (warning) {
              displayColor = [1.0, 0.6, 0.1];
              edgeColor = '#ffcc44';
              emissive = 1.0;
            } else {
              displayColor = [0.85, 0.3, 0.15];
              emissive = 0.7;
            }
          }
          return (
            <Block
              key={`${restartKey}-block-${i}`}
              position={[block.x, block.y, block.z]}
              size={[block.w, block.h, block.d]}
              color={displayColor}
              edgeColor={edgeColor}
              emissiveIntensity={emissive}
            />
          );
        })}

        <Gate position={[goalRef.current.x, 0.5, goalRef.current.z]} jewelColor="#ff5522" />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        <Player
          key={restartKey}
          startPosition={START}
          blocks={blocks}
          gate={null}
          onDeath={handlePlayerDeath}
          onWin={() => {}}
          onUpdate={handlePlayerUpdate}
          onGateTrigger={() => {}}
          gameState={paused ? 'paused' : gameState}
          mobileControlRef={playerControlRef}
        />

        <Level1EchoSim
          gameState={paused ? 'paused' : gameState}
          blocksRef={blocksRef}
          setBlocks={setBlocks}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.6} hue={-0.02} />
      </QualityCanvas>

      <HUD
        level={1}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Don't stop. The ground remembers.</div>
      )}
    </div>
  );
}

// Sim — ticks every armed block's vanish timer and triggers the actual
// disappearance once it hits zero. We mutate blocksRef in place every
// frame and only setBlocks when a stone's visibility actually flips,
// keeping React renders bounded.
function Level1EchoSim({ gameState, blocksRef, setBlocks }) {
  const dirtyRef = useRef(false);
  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') return;
    const delta = Math.min(deltaRaw, 0.05);
    let changed = false;
    for (const b of blocksRef.current) {
      if (b.vanishTimer != null && b.visible) {
        b.vanishTimer -= delta;
        if (b.vanishTimer <= 0) {
          b.visible = false;
          b.vanishTimer = null;
          changed = true;
          playDisappear();
        }
      }
    }
    if (changed) {
      // Force a re-render with a fresh array reference so AnimatedBlock
      // / Block components see the updated visibility.
      dirtyRef.current = !dirtyRef.current;
      setBlocks(prev => [...prev]);
    }
  });
  return null;
}

export default Level1Echo;
