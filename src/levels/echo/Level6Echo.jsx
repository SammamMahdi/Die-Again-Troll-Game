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
import { getEchoMechanic, getEchoVisual } from '../../utils/echoThemes';
import { PLAYER_HALF } from '../../constants/gameConstants';
import useRestartOnR from '../../hooks/useRestartOnR';
import useVictoryTimer from '../../hooks/useVictoryTimer';
import useTeleportOnRequest from '../../hooks/useTeleportOnRequest';
import '../Level.css';

// =============================================================
// Level 6 ECHO — "Ifrit's Eye"
//
//   Spec:
//   - Discs spin 1.8× faster + wobble ±0.3 units vertically.
//   - Lasers 1.4× speed.
//   - Smaller bridge widths.
//   - Central "well" drags slow-moving players slightly toward
//     the arena center (constant lateral pull).
//   - Theme: burning accretion-ring backdrop, magma discs.
// =============================================================

const DEFAULT_START = [0, 5, 25];
const COLOR_DISC = [0.85, 0.30, 0.10];
const COLOR_BRIDGE = [0.55, 0.18, 0.10];
const COLOR_GOAL = [0.95, 0.45, 0.15];
const DISC_WOBBLE_AMPL = 0.3;

function buildBlocks() {
  const blocks = [];
  blocks.push({ x: 0, y: 0, z: 25, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_BRIDGE] });
  // Narrow bridges (was 3.5 → 2.5).
  blocks.push({ x: 0, y: 0, z: 15, w: 2.5, h: 1, d: 2.5, visible: true, color: [...COLOR_BRIDGE] });
  blocks.push({
    x: 0, y: 0, z: 5, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_DISC],
    isDisc: true, rotateSpeed: 0.65 * 1.8, radius: 4,
    startY: 0, wobblePhase: 0,
  });
  blocks.push({ x: 0, y: 0, z: -5, w: 2.5, h: 1, d: 2.5, visible: true, color: [...COLOR_BRIDGE] });
  blocks.push({
    x: 0, y: 0, z: -15, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_DISC],
    isDisc: true, rotateSpeed: -0.95 * 1.8, radius: 4,
    startY: 0, wobblePhase: 1.1,
  });
  blocks.push({ x: 0, y: 0, z: -25, w: 2.5, h: 1, d: 2.5, visible: true, color: [...COLOR_BRIDGE] });
  blocks.push({
    x: 0, y: 0, z: -35, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_DISC],
    isDisc: true, rotateSpeed: 1.15 * 1.8, radius: 4,
    startY: 0, wobblePhase: 2.2,
  });
  blocks.push({ x: 0, y: 0, z: -45, w: 2.5, h: 1, d: 2.5, visible: true, color: [...COLOR_BRIDGE] });
  const goalZ = -55;
  blocks.push({
    x: 0, y: 0, z: goalZ, w: 10, h: 1, d: 10, visible: true,
    color: [...COLOR_GOAL], isGoal: true,
  });
  return { blocks, goal: { x: 0, y: 0.5, z: goalZ } };
}

function buildLasers(ls) {
  return [
    { origin: [0, 2, 5],   length: 10, speed:  0.8 * ls, phase: 0.0,            thickness: 0.38 },
    { origin: [0, 2, 5],   length: 10, speed:  0.8 * ls, phase: Math.PI,        thickness: 0.38 },
    { origin: [0, 2, -15], length: 10, speed: -1.0 * ls, phase: 1.2,            thickness: 0.38 },
    { origin: [0, 2, -15], length: 10, speed: -1.0 * ls, phase: 1.2 + Math.PI,  thickness: 0.38 },
    { origin: [0, 2, -35], length: 10, speed: 0.95 * ls, phase: 0.5,            thickness: 0.38 },
    { origin: [0, 2, -35], length: 10, speed: 0.95 * ls, phase: 0.5 + Math.PI,  thickness: 0.38 },
  ];
}

// Hell-themed laser: orange-red molten beam with serrated emitter.
function LaserBeam({ laser }) {
  const beamRef = useRef();
  const matRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (beamRef.current) {
      const angle = laser.angle || 0;
      const dx = Math.cos(angle) * (laser.length / 2);
      const dz = Math.sin(angle) * (laser.length / 2);
      beamRef.current.position.set(laser.origin[0] + dx, laser.origin[1], laser.origin[2] + dz);
      beamRef.current.rotation.y = -angle + Math.PI / 2;
    }
    if (matRef.current) {
      const pulse = 0.7 + 0.3 * Math.sin(t.current * 8);
      matRef.current.emissiveIntensity = 1.7 * pulse;
    }
  });
  return (
    <group>
      <mesh position={laser.origin}>
        <cylinderGeometry args={[0.35, 0.5, 0.6, 16]} />
        <meshStandardMaterial color="#3a0500" emissive="#aa1100" emissiveIntensity={0.55} />
      </mesh>
      <mesh ref={beamRef}>
        <cylinderGeometry args={[laser.thickness, laser.thickness, laser.length, 12]} />
        <meshStandardMaterial
          ref={matRef}
          color="#ff5511"
          emissive="#ff3300"
          emissiveIntensity={1.7}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// Disc visual — glowing magma ring around a hot core.
function DiscVisual({ block }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(block.x, block.y - 0.4, block.z);
    ref.current.rotation.y = block.rotation || 0;
  });
  return (
    <group ref={ref}>
      <mesh>
        <cylinderGeometry args={[block.radius, block.radius, 1, 48]} />
        <meshStandardMaterial
          color={new THREE.Color(...block.color)}
          roughness={0.35}
          metalness={0.5}
          emissive={new THREE.Color(...block.color)}
          emissiveIntensity={0.55}
        />
      </mesh>
      {/* Hot bright pinpoint at center — the "eye". */}
      <mesh position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshBasicMaterial color="#ffeecc" toneMapped={false} />
      </mesh>
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, 0.51, 0]} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <ringGeometry args={[block.radius * 0.6, block.radius * 0.95, 32, 1, 0, Math.PI / 8]} />
          <meshBasicMaterial color="#ffaa55" transparent opacity={0.75} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const __l6e_fresh = buildBlocks();
const JEWEL_CANDIDATES = candidatesFromBlocks(__l6e_fresh.blocks);

function Level6Echo({
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
  const echoMechanic = getEchoMechanic(6);
  const echoVisual = getEchoVisual(6);
  const laserSpeedMul = echoMechanic.laserSpeedMul || 1.4;
  const gravityPull = echoMechanic.gravityPull || 1.5;

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  const initial = useRef(buildBlocks());
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const lasersRef = useRef(buildLasers(laserSpeedMul));
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
    lasersRef.current = buildLasers(laserSpeedMul);
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
        camera={{ position: [30, 18, 40], fov: 60 }}
        style={{ background: echoVisual?.sky, touchAction: 'none' }}
      >
        <fog attach="fog" args={[echoVisual?.fogColor || '#1a0400', echoVisual?.fogNear ?? 35, echoVisual?.fogFar ?? 200]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.4} color={echoVisual?.ambientColor || '#ff6622'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ff7733', echoVisual?.hemiBottom || '#0a0200', echoVisual?.hemiIntensity ?? 0.4]} />
        <directionalLight position={[15, 25, 10]} intensity={0.85} color="#ff8855" />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 12, 0]} intensity={0.85} color="#ff4400" distance={50} />
            <pointLight position={[0, 5, -55]} intensity={0.55} color="#ffaa44" distance={26} />
          </>
        )}

        <QualitySparkles
          position={[0, 8, -20]} count={80} scale={[24, 10, 60]} size={1.5} speed={0.5}
          color="#ff6622"
        />
        <QualitySparkles
          position={[0, 3, -55]} count={28} scale={[8, 5, 4]} size={2.4} speed={0.3}
          color={echoVisual?.sparkleColor || '#ff5511'}
        />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => {
          if (b.isDisc) {
            return <DiscVisual key={`${restartKey}-block-${i}`} block={b} />;
          }
          return (
            <AnimatedBlock
              key={`${restartKey}-block-${i}`}
              block={b}
              edgeColor={b.isGoal ? '#ff7722' : '#ff5511'}
              emissiveBoost={b.isGoal ? 0.4 : 0.15}
            />
          );
        })}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} jewelColor="#ff7722" />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {lasersRef.current.map((l, i) => (
          <LaserBeam key={`${restartKey}-laser-${i}`} laser={l} />
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

        <Level6EchoSim
          gameState={paused ? 'paused' : gameState}
          blocksRef={blocksRef}
          lasersRef={lasersRef}
          playerPosRef={playerPosRef}
          playerControlRef={playerControlRef}
          gravityPull={gravityPull}
          onLaserHit={() => handlePlayerDeath('Vaporized by a hellbeam.')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.75} hue={0.04} />
      </QualityCanvas>

      <HUD
        level={6}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">The pit watches. Don't slow.</div>
      )}
    </div>
  );
}

// Sim — spinning + wobbling discs, faster lasers, central gravity pull
// drags the player toward the arena center (0,0,0) when they move slowly.
function Level6EchoSim({
  gameState, blocksRef, lasersRef, playerPosRef, playerControlRef,
  gravityPull, onLaserHit,
}) {
  const tRef = useRef(0);
  const hitRef = useRef(false);
  const isInvisible = useIsInvisibleNow();
  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') { hitRef.current = false; return; }
    if (hitRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);
    tRef.current += delta;
    const t = tRef.current;
    const [px, py, pz] = playerPosRef.current;

    // Discs: rotate, wobble vertically, carry player tangentially.
    for (const b of blocksRef.current) {
      if (!b.isDisc) continue;
      b.rotation = (b.rotation || 0) + b.rotateSpeed * delta;
      b.y = (b.startY ?? 0) + Math.sin(t * 1.8 + (b.wobblePhase || 0)) * DISC_WOBBLE_AMPL;

      const top = b.y + b.h / 2;
      if (py - 0.5 < top - 0.1 || py - 0.5 > top + 0.4) continue;
      const dxLocal = px - b.x;
      const dzLocal = pz - b.z;
      const r = Math.sqrt(dxLocal * dxLocal + dzLocal * dzLocal);
      if (r > b.radius) continue;
      const tdx = -b.rotateSpeed * dzLocal;
      const tdz =  b.rotateSpeed * dxLocal;
      if (playerControlRef.current?.addExternalDelta) {
        playerControlRef.current.addExternalDelta(tdx * delta, 0, tdz * delta);
      }
    }

    // Central gravity pull — drags the player toward (0,0,0) at a small
    // constant rate. Acts on the XZ plane. The pull is strongest when
    // the player is far from center and weakest near center.
    if (playerControlRef.current?.addExternalDelta) {
      const r = Math.sqrt(px * px + pz * pz);
      if (r > 0.5) {
        const pullSpeed = gravityPull;  // units/sec toward center
        const ndx = -px / r;
        const ndz = -pz / r;
        playerControlRef.current.addExternalDelta(ndx * pullSpeed * delta, 0, ndz * pullSpeed * delta);
      }
    }

    // Lasers — perpendicular distance kill check.
    for (const l of lasersRef.current) {
      l.angle = (l.angle || l.phase) + l.speed * delta;
      const ox = l.origin[0], oy = l.origin[1], oz = l.origin[2];
      const dx = Math.cos(l.angle);
      const dz = Math.sin(l.angle);
      const vx = px - ox;
      const vz = pz - oz;
      const along = vx * dx + vz * dz;
      if (along < 0 || along > l.length) continue;
      const perpX = vx - dx * along;
      const perpZ = vz - dz * along;
      const perp = Math.sqrt(perpX * perpX + perpZ * perpZ);
      if (Math.abs(py - oy) > 1.4) continue;
      if (perp < (l.thickness + PLAYER_HALF + 0.05) && !isInvisible()) {
        hitRef.current = true;
        onLaserHit();
        return;
      }
    }
  });
  return null;
}

export default Level6Echo;
