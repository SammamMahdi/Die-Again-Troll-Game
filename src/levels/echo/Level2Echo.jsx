import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
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
import { playLightRed } from '../../utils/sounds';
import { getEchoMechanic, getEchoVisual } from '../../utils/echoThemes';
import { PLAYER_HALF } from '../../constants/gameConstants';
import useRestartOnR from '../../hooks/useRestartOnR';
import useVictoryTimer from '../../hooks/useVictoryTimer';
import useTeleportOnRequest from '../../hooks/useTeleportOnRequest';
import '../Level.css';

// =============================================================
// Level 2 ECHO — "Bloodlamps"
//
//   Spec:
//   - Permanent RED phase. No blue safety windows. Movement is always
//     dangerous.
//   - Floating crimson paper lanterns replace the patrolling globes.
//     They orbit the path slowly while the player stands still and
//     accelerate toward the player the instant any movement begins.
//   - Platforms ~70% the size of the main level — narrower footing.
//   - Pitch-black void with no stars; only the lamps + the player
//     glow read.
// =============================================================

const BLOCK_SIZE = 4;
const STEP_SIZE = 7;
const LAMP_HOVER_HEIGHT = 12.0;
const LAMP_RADIUS = 1.0;
const LAMP_CHASE_SPEED = 5.5;
const LAMP_ORBIT_SPEED = 0.45;
const LAMP_ORBIT_RADIUS = 9;
const MOVE_EPSILON = 0.015;
const DEFAULT_START = [0, 3, 25];

function buildBlocks(scale) {
  const blocks = [];
  const startZ = 25;
  const s = scale * BLOCK_SIZE;
  for (let i = 0; i < 10; i++) {
    const z = startZ - i * STEP_SIZE;
    const isGoal = i === 9;
    blocks.push({
      index: i,
      x: 0, y: 0, z,
      startX: 0, startY: 0, startZ: z,
      // Start + goal stay full-size; mid-path stones shrink.
      w: i === 0 || isGoal ? BLOCK_SIZE : s,
      h: 1,
      d: i === 0 || isGoal ? BLOCK_SIZE : s,
      visible: true,
      color: isGoal ? [0.65, 0.18, 0.18] : [0.55, 0.12, 0.12],
      isGoal,
    });
  }
  return blocks;
}

function buildLamps() {
  return [
    { id: 0, x:  9, y: LAMP_HOVER_HEIGHT, z:  6, orbitTheta: 0,                   chasing: false },
    { id: 1, x: -9, y: LAMP_HOVER_HEIGHT, z:  0, orbitTheta: Math.PI / 2,         chasing: false },
    { id: 2, x:  6, y: LAMP_HOVER_HEIGHT, z:-10, orbitTheta: Math.PI,             chasing: false },
    { id: 3, x: -6, y: LAMP_HOVER_HEIGHT, z:-20, orbitTheta: (3 * Math.PI) / 2,   chasing: false },
  ];
}

const __l2e_fresh = buildBlocks(0.7);
const JEWEL_CANDIDATES = candidatesFromBlocks(__l2e_fresh);

// Crimson Chinese paper lantern — a stretched ellipsoid with bright
// emissive cores and a wisp of orange flame inside.
function BloodLamp({ lamp }) {
  const groupRef = useRef();
  const flameRef = useRef();
  const t = useRef(Math.random() * 4);
  useFrame((_, delta) => {
    t.current += delta;
    const g = groupRef.current;
    if (!g) return;
    g.position.set(lamp.x, lamp.y + Math.sin(t.current * 2.0) * 0.25, lamp.z);
    g.rotation.y += delta * 0.6;
    if (flameRef.current) {
      const flicker = 1 + 0.25 * Math.sin(t.current * 11 + lamp.id);
      flameRef.current.scale.set(flicker, 1 + 0.15 * flicker, flicker);
    }
  });
  return (
    <group ref={groupRef}>
      {/* Crown cap */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.35, 0.5, 0.18, 12]} />
        <meshStandardMaterial color="#3a0a0a" roughness={0.5} />
      </mesh>
      {/* Paper body — ellipsoid via scaled sphere */}
      <mesh scale={[1.05, 1.45, 1.05]}>
        <sphereGeometry args={[LAMP_RADIUS, 24, 18]} />
        <meshStandardMaterial
          color="#ff1a2a"
          emissive="#ff0011"
          emissiveIntensity={lamp.chasing ? 2.4 : 1.4}
          roughness={0.6}
          metalness={0.2}
          transparent
          opacity={0.85}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner flame */}
      <mesh ref={flameRef}>
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshBasicMaterial color="#ffcc66" toneMapped={false} />
      </mesh>
      {/* Bottom tassel */}
      <mesh position={[0, -1.4, 0]}>
        <coneGeometry args={[0.08, 0.4, 8]} />
        <meshStandardMaterial color="#220404" />
      </mesh>
      {/* Halo for chasing state */}
      <mesh>
        <sphereGeometry args={[LAMP_RADIUS * 1.6, 18, 14]} />
        <meshBasicMaterial color="#ff2233" transparent
          opacity={lamp.chasing ? 0.28 : 0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Level2Echo({
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
  const echoMechanic = getEchoMechanic(2);
  const echoVisual = getEchoVisual(2);
  const platformScale = echoMechanic.platformScale || 0.7;

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  const blocksRef = useRef(buildBlocks(platformScale));
  const lampsRef = useRef(buildLamps());
  const playerPosRef = useRef(START);
  const lastPlayerPosRef = useRef(START);
  const isMovingRef = useRef(false);
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
    const fresh = buildBlocks(platformScale);
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh[i]));
    const freshL = buildLamps();
    lampsRef.current.forEach((l, i) => Object.assign(l, freshL[i]));
    isMovingRef.current = false;
    lastPlayerPosRef.current = START;
    playerPosRef.current = START;
    setPlayerPosition(START);
    setDeathReason('');
    setGameState('playing');
    setRestartKey(prev => prev + 1);
  };

  useRestartOnR(gameState, handleRestart);

  const handlePlayerUpdate = (pos, blockIdx) => {
    playerPosRef.current = pos;
    setPlayerPosition(pos);
    const [lx, , lz] = lastPlayerPosRef.current;
    const dx = pos[0] - lx;
    const dz = pos[2] - lz;
    isMovingRef.current = Math.sqrt(dx * dx + dz * dz) > MOVE_EPSILON;
    lastPlayerPosRef.current = pos;
    if (blockIdx === 9 && gameState === 'playing') setGameState('won');
  };

  useVictoryTimer(gameState, () => onComplete({ complete: sideQuestCompleteRef.current }));

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [30, 20, 40], fov: 60 }}
        style={{ background: echoVisual?.sky, touchAction: 'none' }}
      >
        <fog attach="fog" args={[echoVisual?.fogColor || '#180002', echoVisual?.fogNear ?? 30, echoVisual?.fogFar ?? 140]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.35} color={echoVisual?.ambientColor || '#cc2233'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ff3344', echoVisual?.hemiBottom || '#0a0000', echoVisual?.hemiIntensity ?? 0.4]} />
        <directionalLight position={[0, 25, 5]} intensity={0.55} color="#ff5566" />
        {!q.minimalLights && (
          <pointLight position={[0, 12, -15]} intensity={0.55} color="#ff2233" distance={45} />
        )}

        {/* No stars — pitch-black void per spec. */}
        <QualitySparkles
          position={[0, 3, -38]}
          count={26}
          scale={[8, 4, 4]}
          size={2.6}
          speed={0.3}
          color={echoVisual?.sparkleColor || '#ff2244'}
        />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            emissiveBoost={b.isGoal ? 0.45 : 0.18}
            edgeColor={b.isGoal ? '#ff4466' : '#ff3344'}
          />
        ))}

        <Gate position={[0, 0.5, 25 - 9 * STEP_SIZE]} jewelColor="#ff2244" />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {lampsRef.current.map((lamp, i) => (
          <BloodLamp key={`${restartKey}-lamp-${i}`} lamp={lamp} />
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

        <Level2EchoSim
          gameState={paused ? 'paused' : gameState}
          lampsRef={lampsRef}
          playerPosRef={playerPosRef}
          isMovingRef={isMovingRef}
          onLampHit={() => handlePlayerDeath('A blood-lamp caught you moving.')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.7} hue={0.02} />
      </QualityCanvas>

      <HUD
        level={2}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="light-indicator">
          <span className="light-dot light-red" />
          <span className="light-label">RED — DON'T MOVE</span>
        </div>
      )}
    </div>
  );
}

// Sim — lamps orbit the path while the player holds still. The instant
// the player moves, every lamp flips into chase mode and accelerates
// toward them. Collision with a lamp = death.
function Level2EchoSim({ gameState, lampsRef, playerPosRef, isMovingRef, onLampHit }) {
  const lastChaseRef = useRef(false);
  const hitRef = useRef(false);
  const isInvisible = useIsInvisibleNow();
  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') { hitRef.current = false; return; }
    if (hitRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);
    const [px, py, pz] = playerPosRef.current;
    // Invisibility makes every lamp lose interest entirely — they drop
    // out of chase mode and drift back to their idle orbit. The player
    // is briefly off the menu.
    const invisible = isInvisible();
    const chasing = !invisible && isMovingRef.current;
    if (chasing !== lastChaseRef.current) {
      lastChaseRef.current = chasing;
      if (chasing) playLightRed();
    }

    for (const lamp of lampsRef.current) {
      lamp.chasing = chasing;
      if (chasing) {
        const dx = px - lamp.x;
        const dy = py - lamp.y;
        const dz = pz - lamp.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 0) {
          lamp.x += (dx / d) * LAMP_CHASE_SPEED * delta;
          lamp.y += (dy / d) * LAMP_CHASE_SPEED * delta * 0.5;
          lamp.z += (dz / d) * LAMP_CHASE_SPEED * delta;
        }
      } else {
        // Idle orbit around the path centerline.
        lamp.orbitTheta += LAMP_ORBIT_SPEED * delta;
        const targetX = Math.cos(lamp.orbitTheta) * LAMP_ORBIT_RADIUS;
        const targetZ = -lamp.id * 6 + Math.sin(lamp.orbitTheta) * 3;
        const targetY = LAMP_HOVER_HEIGHT;
        const k = 1 - Math.exp(-2.5 * delta);
        lamp.x += (targetX - lamp.x) * k;
        lamp.y += (targetY - lamp.y) * k;
        lamp.z += (targetZ - lamp.z) * k;
      }

      // Collision check (skipped while invisibility is live)
      if (!invisible) {
        const cx = px - lamp.x;
        const cy = py - lamp.y;
        const cz = pz - lamp.z;
        if (Math.sqrt(cx * cx + cy * cy + cz * cz) < LAMP_RADIUS + PLAYER_HALF + 0.1) {
          hitRef.current = true;
          onLampHit();
          return;
        }
      }
    }
  });
  return null;
}

export default Level2Echo;
