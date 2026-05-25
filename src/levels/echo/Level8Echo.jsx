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
import { useIsInvisibleNow } from '../../components/ConsumablesProvider';
import { candidatesFromBlocks } from '../../utils/jewelCandidates';
import HUD from '../../components/HUD';
import CameraController from '../../components/CameraController';
import ScenePostFX from '../../components/ScenePostFX';
import { getEchoVisual } from '../../utils/echoThemes';
import { PLAYER_HALF } from '../../constants/gameConstants';
import useRestartOnR from '../../hooks/useRestartOnR';
import useVictoryTimer from '../../hooks/useVictoryTimer';
import useTeleportOnRequest from '../../hooks/useTeleportOnRequest';
import '../Level.css';

// =============================================================
// Level 8 ECHO — "Hall of Mirrors"
//
//   Spec:
//   - TWO shadow doppelgangers: one mirrored on X (the main-level
//     shadow), one mirrored on Z. The player has three avatars in
//     the world — themselves + two shadows.
//   - Hazards exist on YOUR side too — touching one with any of the
//     three avatars kills you.
//   - 6 extra spikes vs main, filling in the safe corridors.
//   - Theme: obsidian mirrors with crimson prismatic shards.
// =============================================================

const DEFAULT_START = [0, 5, 25];
const COLOR_PATH = [0.55, 0.18, 0.22];          // dark obsidian-red

function buildBlocks() {
  const blocks = [];
  blocks.push({ x: 0, y: 0, z: 25, w: 8, h: 1, d: 6, visible: true, color: [...COLOR_PATH] });
  for (let i = 0; i < 5; i++) {
    blocks.push({
      x: 0, y: 0, z: 18 - i * 7, w: 8, h: 1, d: 5,
      visible: true, color: [...COLOR_PATH],
    });
  }
  blocks.push({ x: 0, y: 0, z: -22, w: 8, h: 1, d: 6, visible: true, color: [0.6, 0.20, 0.25], isGoal: true });
  return { blocks, goal: { x: 0, y: 0.5, z: -22 } };
}

function buildHazards() {
  // Original 14 + 6 extras filling the gap-of-zero (the safe x=0 lane).
  return [
    // Originals
    { x:  3, y: 0.7, z: 18,  w: 1.6, h: 1.6, d: 1.6 },
    { x: -3, y: 0.7, z: 18,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  3, y: 0.7, z: 11,  w: 1.6, h: 1.6, d: 1.6 },
    { x: -3, y: 0.7, z: 11,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  2, y: 0.7, z:  4,  w: 1.6, h: 1.6, d: 1.6 },
    { x: -2, y: 0.7, z:  4,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  3, y: 0.7, z: -3,  w: 1.6, h: 1.6, d: 1.6 },
    { x: -3, y: 0.7, z: -3,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  0, y: 0.7, z: -3,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  2.5, y: 0.7, z: -10, w: 1.6, h: 1.6, d: 1.6 },
    { x: -2.5, y: 0.7, z: -10, w: 1.6, h: 1.6, d: 1.6 },
    { x:  0,   y: 0.7, z: -17, w: 1.6, h: 1.6, d: 1.6 },
    { x:  3,   y: 0.7, z: -17, w: 1.6, h: 1.6, d: 1.6 },
    { x: -3,   y: 0.7, z: -17, w: 1.6, h: 1.6, d: 1.6 },
    // 6 extras
    { x:  0, y: 0.7, z: 18,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  0, y: 0.7, z: 11,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  0, y: 0.7, z:  4,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  0, y: 0.7, z: -10, w: 1.6, h: 1.6, d: 1.6 },
    { x:  2, y: 0.7, z: -17, w: 1.6, h: 1.6, d: 1.6 },
    { x: -2, y: 0.7, z: -17, w: 1.6, h: 1.6, d: 1.6 },
  ];
}

// Doppelganger visual — a translucent crimson pawn at the mirrored
// position. Two variants: X-mirrored (head pulse cyan-red), Z-mirrored
// (head pulse violet-red).
function Doppelganger({ playerPosRef, axis }) {
  const ref = useRef();
  const headRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (!ref.current) return;
    const [px, py, pz] = playerPosRef.current;
    if (axis === 'x') ref.current.position.set(-px, py, pz);
    else ref.current.position.set(px, py, -pz);
    if (headRef.current) {
      const pulse = 0.7 + 0.3 * Math.sin(t.current * 3.5);
      headRef.current.material.emissiveIntensity = 0.6 + 0.7 * pulse;
    }
  });
  const tint = axis === 'x' ? '#ff4466' : '#ff6644';
  return (
    <group ref={ref}>
      <mesh position={[0, -0.4, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color={tint} roughness={0.5} metalness={0.3} emissive="#aa1111" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.8, 16]} />
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={headRef} position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={1.0} roughness={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ShadowSpike({ hazard }) {
  return (
    <mesh position={[hazard.x, hazard.y, hazard.z]} rotation={[Math.PI / 4, 0, Math.PI / 4]}>
      <octahedronGeometry args={[hazard.w * 0.7, 0]} />
      <meshStandardMaterial
        color="#ff2244"
        emissive="#ff1133"
        emissiveIntensity={0.95}
        roughness={0.3}
        metalness={0.5}
        toneMapped={false}
      />
    </mesh>
  );
}

const __l8e_fresh = buildBlocks();
const JEWEL_CANDIDATES = candidatesFromBlocks(__l8e_fresh.blocks);

function Level8Echo({
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
  const echoVisual = getEchoVisual(8);

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  const initial = useRef(buildBlocks());
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const hazardsRef = useRef(buildHazards());
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
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh.blocks[i]));
    goalRef.current = fresh.goal;
    hazardsRef.current = buildHazards();
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
    const g = goalRef.current;
    const dx = pos[0] - g.x;
    const dz = pos[2] - g.z;
    if (gameState === 'playing' && Math.sqrt(dx * dx + dz * dz) < 4.0 && pos[1] < 2.5) {
      setGameState('won');
    }
  };

  useVictoryTimer(gameState, () => onComplete({ complete: sideQuestCompleteRef.current }));

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [0, 18, 45], fov: 60 }}
        style={{ background: echoVisual?.sky, touchAction: 'none' }}
      >
        <fog attach="fog" args={[echoVisual?.fogColor || '#1a0008', echoVisual?.fogNear ?? 35, echoVisual?.fogFar ?? 180]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.4} color={echoVisual?.ambientColor || '#ff4466'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ff5577', echoVisual?.hemiBottom || '#0a0000', echoVisual?.hemiIntensity ?? 0.4]} />
        <directionalLight position={[0, 25, 15]} intensity={0.85} color="#ff6677" />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 8, 0]} intensity={0.75} color="#ff2244" distance={45} />
            <pointLight position={[0, 5, -22]} intensity={0.55} color="#ff5566" distance={24} />
          </>
        )}

        <QualitySparkles
          position={[0, 4, -5]} count={80} scale={[14, 6, 50]} size={1.6} speed={0.5}
          color="#ff3366"
        />
        <QualitySparkles
          position={[0, 3, -22]} count={28} scale={[8, 5, 4]} size={2.2} speed={0.3}
          color={echoVisual?.sparkleColor || '#ff4466'}
        />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? '#ff4466' : '#ff3355'}
            emissiveBoost={b.isGoal ? 0.4 : 0.12}
          />
        ))}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} jewelColor="#ff4466" />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {hazardsRef.current.map((h, i) => (
          <ShadowSpike key={`${restartKey}-spike-${i}`} hazard={h} />
        ))}

        <Doppelganger playerPosRef={playerPosRef} axis="x" />
        <Doppelganger playerPosRef={playerPosRef} axis="z" />

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

        <Level8EchoSim
          gameState={paused ? 'paused' : gameState}
          hazardsRef={hazardsRef}
          playerPosRef={playerPosRef}
          onAnyHit={(reason) => handlePlayerDeath(reason)}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.8} hue={0.05} />
      </QualityCanvas>

      <HUD
        level={8}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Three of you. Three deaths.</div>
      )}
    </div>
  );
}

// Sim — every frame, check player + both shadows against every spike.
// Any of the three colliding = death.
function Level8EchoSim({ gameState, hazardsRef, playerPosRef, onAnyHit }) {
  const hitRef = useRef(false);
  const isInvisible = useIsInvisibleNow();
  useFrame(() => {
    if (gameState !== 'playing') { hitRef.current = false; return; }
    if (hitRef.current) return;
    if (isInvisible()) return;
    const [px, py, pz] = playerPosRef.current;
    const avatars = [
      { x:  px, y: py, z:  pz, label: 'self' },
      { x: -px, y: py, z:  pz, label: 'X-shadow' },
      { x:  px, y: py, z: -pz, label: 'Z-shadow' },
    ];
    for (const h of hazardsRef.current) {
      for (const a of avatars) {
        if (
          Math.abs(a.x - h.x) < h.w / 2 + PLAYER_HALF &&
          Math.abs(a.y - h.y) < h.h / 2 + PLAYER_HALF &&
          Math.abs(a.z - h.z) < h.d / 2 + PLAYER_HALF
        ) {
          hitRef.current = true;
          onAnyHit(`Your ${a.label} was impaled.`);
          return;
        }
      }
    }
  });
  return null;
}

export default Level8Echo;
