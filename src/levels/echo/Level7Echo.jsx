import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import QualityCanvas from '../../components/QualityCanvas';
import QualitySparkles from '../../components/QualitySparkles';
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
import { getEchoMechanic, getEchoVisual } from '../../utils/echoThemes';
import { PLAYER_HALF } from '../../constants/gameConstants';
import useRestartOnR from '../../hooks/useRestartOnR';
import useVictoryTimer from '../../hooks/useVictoryTimer';
import useTeleportOnRequest from '../../hooks/useTeleportOnRequest';
import '../Level.css';

// =============================================================
// Level 7 ECHO — "The Void Throat"
//
//   Spec:
//   - Lantern radius HALVED (~3 units of visible pool).
//   - 9 sliding walls (was 6) — 3 extra walls fill the safe gaps.
//   - Walls 1.8× faster.
//   - Total black void with red-throb infernal vignette overlay.
// =============================================================

const DEFAULT_START = [0, 5, 30];
const COLOR_PATH = [0.92, 0.86, 0.85];          // pale bone-white so the
                                                // tiny lantern bubble can
                                                // still catch them at all.

function buildBlocks() {
  const blocks = [];
  blocks.push({ x: 0, y: 0, z: 30, w: 6, h: 1, d: 6, visible: true, color: [...COLOR_PATH] });
  let z = 24;
  for (let i = 0; i < 10; i++) {
    blocks.push({
      x: 0, y: 0, z, w: 2.5, h: 1, d: 2.5, visible: true,
      color: [...COLOR_PATH],
    });
    z -= 5;
  }
  blocks.push({ x: 0, y: 0, z: -32, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_PATH], isGoal: true });
  return { blocks, goal: { x: 0, y: 0.5, z: -32 } };
}

function buildSlidingWalls(sm, extraCount) {
  const base = [
    { x: -12, y: 0.5, z: 17,  w: 1, h: 3, d: 4, vx:  7.5 * sm, range: 12 },
    { x:  12, y: 0.5, z: 10,  w: 1, h: 3, d: 4, vx: -8.0 * sm, range: 12 },
    { x: -12, y: 0.5, z:  3,  w: 1, h: 3, d: 4, vx:  7.0 * sm, range: 12 },
    { x:  12, y: 0.5, z: -4,  w: 1, h: 3, d: 4, vx: -7.5 * sm, range: 12 },
    { x: -12, y: 0.5, z: -12, w: 1, h: 3, d: 4, vx:  8.0 * sm, range: 12 },
    { x:  12, y: 0.5, z: -22, w: 1, h: 3, d: 4, vx: -8.5 * sm, range: 12 },
  ];
  // Extra walls fill the empty z-gaps so the player has fewer safe lanes.
  const extras = [
    { x:  12, y: 0.5, z: 21,  w: 1, h: 3, d: 4, vx: -8.0 * sm, range: 12 },
    { x: -12, y: 0.5, z: -8,  w: 1, h: 3, d: 4, vx:  8.5 * sm, range: 12 },
    { x:  12, y: 0.5, z: -16, w: 1, h: 3, d: 4, vx: -7.0 * sm, range: 12 },
  ];
  return base.concat(extras.slice(0, Math.max(0, extraCount)));
}

const GROUNDED_Y = 1.0;
const AIR_THRESHOLD = 0.3;
const AIR_FULL = 1.6;
const GROUND_FLOOR = 0.25;
const POINT_MAX = 6;
const SPOT_MAX = 5;
const LERP_SPEED = 8.0;

// Reduced-radius lantern — half the main level's lit pool.
function PlayerFlashlight({ playerPosRef, radiusMul }) {
  const pointRef = useRef();
  const spotRef = useRef();
  const targetRef = useRef();
  const airRef = useRef(0);

  useFrame((_, deltaRaw) => {
    const dt = Math.min(deltaRaw, 0.05);
    const [px, py, pz] = playerPosRef.current || [0, 0, 0];
    const altitude = Math.max(0, py - GROUNDED_Y);
    let targetAir;
    if (altitude < AIR_THRESHOLD) targetAir = 0;
    else if (altitude > AIR_FULL) targetAir = 1;
    else targetAir = (altitude - AIR_THRESHOLD) / (AIR_FULL - AIR_THRESHOLD);
    const k = 1 - Math.exp(-LERP_SPEED * dt);
    airRef.current += (targetAir - airRef.current) * k;
    const air = airRef.current;
    const pointI = GROUND_FLOOR + (POINT_MAX - GROUND_FLOOR) * air;
    const spotI  = GROUND_FLOOR + (SPOT_MAX  - GROUND_FLOOR) * air;
    if (pointRef.current) {
      pointRef.current.position.set(px, py + 0.6, pz);
      pointRef.current.intensity = pointI;
    }
    if (spotRef.current && targetRef.current) {
      spotRef.current.position.set(px, py + 4, pz);
      spotRef.current.intensity = spotI;
      if (spotRef.current.target !== targetRef.current) {
        spotRef.current.target = targetRef.current;
      }
      targetRef.current.position.set(px, py - 6, pz);
      targetRef.current.updateMatrixWorld();
    }
  });

  return (
    <>
      <pointLight ref={pointRef} intensity={GROUND_FLOOR} distance={6 * radiusMul} decay={1.0} color="#ffeecc" />
      <spotLight ref={spotRef} angle={0.85} penumbra={0.5}
        intensity={GROUND_FLOOR} distance={7 * radiusMul} decay={1.0} color="#ffeecc" />
      <object3D ref={targetRef} />
    </>
  );
}

const __l7e_fresh = buildBlocks();
const JEWEL_CANDIDATES = candidatesFromBlocks(__l7e_fresh.blocks);

function Level7Echo({
  deathCount,
  onDeath,
  onComplete,
  onRestart,            // eslint-disable-line no-unused-vars
  onPortalEnter,        // eslint-disable-line no-unused-vars
  startPositionOverride,
}) {
  const { paused, teleportRequest } = useRunStats();
  const sideQuestCompleteRef = useRef(false);
  const START = startPositionOverride || DEFAULT_START;
  const echoMechanic = getEchoMechanic(7);
  const echoVisual = getEchoVisual(7);
  const lanternRadiusMul = echoMechanic.lanternRadiusMul || 0.5;
  const wallSpeedMul = echoMechanic.wallSpeedMul || 1.8;
  const wallExtraCount = echoMechanic.wallExtraCount || 3;

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  const initial = useRef(buildBlocks());
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const wallsRef = useRef(buildSlidingWalls(wallSpeedMul, wallExtraCount));
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
    wallsRef.current = buildSlidingWalls(wallSpeedMul, wallExtraCount);
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
        camera={{ position: [20, 14, 40], fov: 60 }}
        style={{ background: echoVisual?.sky, touchAction: 'none' }}
      >
        {/* Fog NEAR pinned at camera-trail distance so the player +
            lantern pool stay rendered. FAR aggressively tight per
            theme — total darkness past the lantern radius. */}
        <fog attach="fog" args={[echoVisual?.fogColor || '#000000', echoVisual?.fogNear ?? 38, echoVisual?.fogFar ?? 60]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.15} color={echoVisual?.ambientColor || '#220800'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#331100', echoVisual?.hemiBottom || '#000000', echoVisual?.hemiIntensity ?? 0.2]} />

        <PlayerFlashlight playerPosRef={playerPosRef} radiusMul={lanternRadiusMul} />

        {/* No QualityStars in the Void Throat. */}
        <QualitySparkles
          position={[0, 3, -32]} count={20} scale={[6, 3, 3]} size={1.8} speed={0.3}
          color={echoVisual?.sparkleColor || '#ff4422'}
        />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? '#ff4422' : '#cc4422'}
            emissiveBoost={b.isGoal ? 0.15 : 0}
          />
        ))}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} jewelColor="#ff4422" />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {wallsRef.current.map((w, i) => (
          <SlidingWall key={`${restartKey}-wall-${i}`} wall={w} />
        ))}

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

        <Level7EchoSim
          gameState={paused ? 'paused' : gameState}
          wallsRef={wallsRef}
          playerPosRef={playerPosRef}
          onWallHit={() => handlePlayerDeath('Crushed in the throat.')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.4} bloomThreshold={0.55} vignette={0.85} hue={-0.02} />
      </QualityCanvas>

      <HUD
        level={7}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Smaller light. Hungrier teeth.</div>
      )}
    </div>
  );
}

function SlidingWall({ wall }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(wall.x, wall.y, wall.z);
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[wall.w, wall.h, wall.d]} />
        <meshStandardMaterial
          color="#552211"
          emissive="#aa1100"
          emissiveIntensity={0.25}
          roughness={0.45}
          metalness={0.3}
        />
      </mesh>
      {/* Hot red edge so the wall is JUST visible at the lantern's edge. */}
      <mesh>
        <boxGeometry args={[wall.w * 1.04, wall.h * 1.02, wall.d * 1.02]} />
        <meshBasicMaterial color="#ff3322" wireframe transparent opacity={0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Level7EchoSim({ gameState, wallsRef, playerPosRef, onWallHit }) {
  const hitRef = useRef(false);
  const isInvisible = useIsInvisibleNow();
  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') { hitRef.current = false; return; }
    if (hitRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);
    const [px, py, pz] = playerPosRef.current;
    for (const w of wallsRef.current) {
      const startX = w.startX ?? (w.startX = w.x);
      w.x += w.vx * delta;
      if (Math.abs(w.x - startX) > w.range) {
        w.vx *= -1;
        w.x = startX + Math.sign(w.x - startX) * w.range;
      }
      if (
        !isInvisible() &&
        Math.abs(px - w.x) < w.w / 2 + PLAYER_HALF &&
        Math.abs(py - w.y) < w.h / 2 + PLAYER_HALF &&
        Math.abs(pz - w.z) < w.d / 2 + PLAYER_HALF
      ) {
        hitRef.current = true;
        onWallHit();
        return;
      }
    }
  });
  return null;
}

export default Level7Echo;
