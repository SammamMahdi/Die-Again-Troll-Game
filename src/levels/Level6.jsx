import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import QualityCanvas from '../components/QualityCanvas';
import QualityStars from '../components/QualityStars';
import QualitySparkles from '../components/QualitySparkles';
import { useGraphics } from '../components/GraphicsProvider';
import * as THREE from 'three';
import Player from '../components/Player';
import AnimatedBlock from '../components/AnimatedBlock';
import Gate from '../components/Gate';
import InfiniteGrid from '../components/InfiniteGrid';
import JewelField from '../components/JewelField';
import HardcoreDrop from '../components/HardcoreDrop';
import Portal from '../components/Portal';
import { useRunStats } from '../components/RunStatsContext';
import { useIsInvisibleNow } from '../components/ConsumablesProvider';
import { candidatesFromBlocks } from '../utils/jewelCandidates';
import HUD from '../components/HUD';
import CameraController from '../components/CameraController';
import ScenePostFX from '../components/ScenePostFX';
import { goalPlatformColor } from '../utils/palette';
import { getEchoMechanic, getEchoVisual } from '../utils/echoThemes';
import { PORTAL_SPAWN_CHANCE, PLAYER_HALF } from '../constants/gameConstants';
import useRestartOnR from '../hooks/useRestartOnR';
import useVictoryTimer from '../hooks/useVictoryTimer';
import useTeleportOnRequest from '../hooks/useTeleportOnRequest';
import usePortalEnter from '../hooks/usePortalEnter';
import './Level.css';

const COLOR_DISC  = [0.55, 0.6, 0.95];
const COLOR_BRIDGE = [0.7, 0.7, 0.85];
const JEWEL_HEX   = '#ff3366';                       // rotating-disc red-pink theme
const COLOR_GOAL  = goalPlatformColor(JEWEL_HEX);    // pastel-pink goal platform

function buildLevel6(params = {}) {
  const ds = params.discSpeedMul || 1;
  // Pattern: start → small bridge → DISC → bridge → DISC → bridge → DISC → bridge → GOAL
  // Discs are square hitboxes for our collision system but rendered as cylinders.
  const blocks = [];

  // Start
  blocks.push({ x: 0, y: 0, z: 25, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_BRIDGE] });

  // Wider bridges so you have solid footing between discs.
  blocks.push({ x: 0, y: 0, z: 15, w: 3.5, h: 1, d: 3.5, visible: true, color: [...COLOR_BRIDGE] });

  // Disc 1 — gentle spin
  blocks.push({
    x: 0, y: 0, z: 5, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_DISC],
    isDisc: true, rotateSpeed: 0.65 * ds, radius: 4,
  });

  blocks.push({ x: 0, y: 0, z: -5, w: 3.5, h: 1, d: 3.5, visible: true, color: [...COLOR_BRIDGE] });

  // Phase 3 side-branch: violet stone at (8, 0, -5), sideways jump off the
  // mid-route bridge. Safely outside the disc and laser sweep zones.
  blocks.push({
    x: 8, y: 0, z: -5, w: 3, h: 1, d: 3,
    visible: true, color: [0.45, 0.32, 0.6],
  });

  // Disc 2 — counter-clockwise, moderate
  blocks.push({
    x: 0, y: 0, z: -15, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_DISC],
    isDisc: true, rotateSpeed: -0.95 * ds, radius: 4,
  });

  blocks.push({ x: 0, y: 0, z: -25, w: 3.5, h: 1, d: 3.5, visible: true, color: [...COLOR_BRIDGE] });

  // Disc 3 — the fastest, but still readable
  blocks.push({
    x: 0, y: 0, z: -35, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_DISC],
    isDisc: true, rotateSpeed: 1.15 * ds, radius: 4,
  });

  blocks.push({ x: 0, y: 0, z: -45, w: 3.5, h: 1, d: 3.5, visible: true, color: [...COLOR_BRIDGE] });

  // Goal
  const goalZ = -55;
  blocks.push({
    x: 0, y: 0, z: goalZ, w: 10, h: 1, d: 10, visible: true,
    color: [...COLOR_GOAL], isGoal: true,
  });

  return { blocks, goal: { x: 0, y: 0.5, z: goalZ } };
}

function buildLasers(params = {}) {
  const ls = params.laserSpeedMul || 1;
  return [
    { origin: [0, 2, 5],   length: 10, speed:  0.8 * ls, phase: 0.0,           thickness: 0.38 },
    { origin: [0, 2, 5],   length: 10, speed:  0.8 * ls, phase: Math.PI,       thickness: 0.38 },
    { origin: [0, 2, -15], length: 10, speed: -1.0 * ls, phase: 1.2,           thickness: 0.38 },
    { origin: [0, 2, -15], length: 10, speed: -1.0 * ls, phase: 1.2 + Math.PI, thickness: 0.38 },
    { origin: [0, 2, -35], length: 10, speed: 0.95 * ls, phase: 0.5,           thickness: 0.38 },
    { origin: [0, 2, -35], length: 10, speed: 0.95 * ls, phase: 0.5 + Math.PI, thickness: 0.38 },
  ];
}

// Visualizes the laser as a long thin glowing cylinder
function LaserBeam({ laser }) {
  const beamRef = useRef();
  const matRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (beamRef.current) {
      // Rotate around Y axis at origin
      const angle = laser.angle || 0;
      const dx = Math.cos(angle) * (laser.length / 2);
      const dz = Math.sin(angle) * (laser.length / 2);
      beamRef.current.position.set(
        laser.origin[0] + dx,
        laser.origin[1],
        laser.origin[2] + dz,
      );
      beamRef.current.rotation.y = -angle + Math.PI / 2;
    }
    if (matRef.current) {
      // Subtle pulsing intensity
      const pulse = 0.7 + 0.3 * Math.sin(t.current * 6);
      matRef.current.emissiveIntensity = 1.4 * pulse;
    }
  });

  return (
    <group>
      {/* Emitter base */}
      <mesh position={laser.origin}>
        <cylinderGeometry args={[0.35, 0.5, 0.6, 16]} />
        <meshStandardMaterial color="#222244" emissive="#660033" emissiveIntensity={0.4} />
      </mesh>
      {/* Beam */}
      <mesh ref={beamRef}>
        <cylinderGeometry args={[laser.thickness, laser.thickness, laser.length, 12]} />
        <meshStandardMaterial
          ref={matRef}
          color="#ff3366"
          emissive="#ff3366"
          emissiveIntensity={1.4}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// Disc visual (rotates the player feels) — rendered as a cylinder
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
          roughness={0.5}
          metalness={0.3}
          emissive={new THREE.Color(...block.color)}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Surface stripes for spin visibility */}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, 0.51, 0]} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <ringGeometry args={[block.radius * 0.6, block.radius * 0.95, 32, 1, 0, Math.PI / 8]} />
          <meshBasicMaterial color="#a0e0ff" transparent opacity={0.7} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const __l6_fresh = buildLevel6();
const JEWEL_CANDIDATES = candidatesFromBlocks(
  Array.isArray(__l6_fresh) ? __l6_fresh : __l6_fresh.blocks
);

function Level6({ deathCount, onDeath, onComplete, onPortalEnter, startPositionOverride, hardMode }) {
  const q = useGraphics();
  const { portalEligible, portalAlwaysSpawn, paused, teleportRequest } = useRunStats();
  const [portalSpawned] = useState(() => portalEligible && (portalAlwaysSpawn || Math.random() < PORTAL_SPAWN_CHANCE));
  const sideQuestCompleteRef = useRef(false);
  const START = startPositionOverride || [ 0, 5, 25 ];
  const echoMechanic = hardMode ? getEchoMechanic(6) : {};
  const echoVisual = hardMode ? getEchoVisual(6) : null;
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  const initial = useRef(buildLevel6(echoMechanic));
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const lasersRef = useRef(buildLasers(echoMechanic));
  const playerPosRef = useRef(START);

  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  useTeleportOnRequest(playerControlRef, teleportRequest);
  const handlePortalEnterCb = usePortalEnter(onPortalEnter, sideQuestCompleteRef);

  const handlePlayerDeath = (reason) => {
    if (gameState !== 'playing') return;
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handleRestart = () => {
    const fresh = buildLevel6(echoMechanic);
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh.blocks[i]));
    goalRef.current = fresh.goal;
    lasersRef.current = buildLasers(echoMechanic);
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
    // Check goal touch
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
        style={{
          background: echoVisual?.sky || 'linear-gradient(180deg, #0a0010 0%, #1c0420 60%, #310c30 100%)',
          touchAction: 'none',
        }}
      >
        <fog attach="fog" args={[echoVisual?.fogColor || '#1a0820', echoVisual?.fogNear ?? 45, echoVisual?.fogFar ?? 180]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.45} color={echoVisual?.ambientColor || '#ffffff'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ffaaff', echoVisual?.hemiBottom || '#2a0020', echoVisual?.hemiIntensity ?? 0.5]} />
        <directionalLight position={[15, 25, 10]} intensity={1.0} />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 12, 0]} intensity={0.7} color="#ff3366" distance={50} />
            <pointLight position={[0, 5, -55]} intensity={0.45} color="#ffd055" distance={24} />
          </>
        )}

        <QualityStars radius={200} depth={70} count={2400} factor={4} saturation={0} fade speed={0.6} />
        <QualitySparkles position={[0, 3, -55]} count={28} scale={[8, 5, 4]} size={2.2} speed={0.3} color={echoVisual?.sparkleColor || '#ffd966'} />

        <InfiniteGrid />

        {/* Blocks: regular ones via AnimatedBlock, discs via DiscVisual */}
        {blocksRef.current.map((b, i) => {
          if (b.isDisc) {
            return <DiscVisual key={`${restartKey}-block-${i}`} block={b} />;
          }
          return (
            <AnimatedBlock
              key={`${restartKey}-block-${i}`}
              block={b}
              edgeColor={b.isGoal ? JEWEL_HEX : '#7fdaff'}
              emissiveBoost={b.isGoal ? 0.22 : 0}
            />
          );
        })}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} jewelColor={JEWEL_HEX} />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        <HardcoreDrop key={`drop-${restartKey}`} blocks={blocksRef.current} playerPosRef={playerPosRef} />

        {/* L6 side branch: violet stone at (8, 0, -5), off the mid bridge. */}
        {portalSpawned && (
          <Portal
            position={[8, 0.5, -5]}
            rotationY={Math.PI / 2}
            playerPosRef={playerPosRef}
            onEnter={handlePortalEnterCb}
          />
        )}

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

        <Level6Sim
          gameState={paused ? 'paused' : gameState}
          blocksRef={blocksRef}
          lasersRef={lasersRef}
          playerPosRef={playerPosRef}
          playerControlRef={playerControlRef}
          onLaserHit={() => handlePlayerDeath('Vaporized by a laser!')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.5} hue={0.05} />
      </QualityCanvas>

      <HUD
        level={6}
        deathCount={deathCount}
        gameState={paused ? 'paused' : gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Walk against the spin. Mind the beams.</div>
      )}

    </div>
  );
}

function Level6Sim({ gameState, blocksRef, lasersRef, playerPosRef, playerControlRef, onLaserHit }) {
  const timerRef = useRef(0);
  const hitRef = useRef(false);
  const isInvisible = useIsInvisibleNow();

  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') { hitRef.current = false; return; }
    if (hitRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);
    timerRef.current += delta;

    const [px, py, pz] = playerPosRef.current;

    // ----- Rotating discs: spin them + carry the player if standing on top -----
    for (const b of blocksRef.current) {
      if (!b.isDisc) continue;
      b.rotation = (b.rotation || 0) + b.rotateSpeed * delta;

      // If player is on top of this disc, apply tangential delta from rotation.
      const top = b.y + b.h / 2;
      if (py - 0.5 < top - 0.1 || py - 0.5 > top + 0.4) continue;
      const dxLocal = px - b.x;
      const dzLocal = pz - b.z;
      const r = Math.sqrt(dxLocal * dxLocal + dzLocal * dzLocal);
      if (r > b.radius) continue;            // off the disc — no carry
      // Tangent velocity: ω × r, perpendicular to radius
      // For a disc spinning by angular velocity ω around Y, a point at (dx, dz)
      // gets velocity (-ω·dz, ω·dx)
      const tdx = -b.rotateSpeed * dzLocal;
      const tdz =  b.rotateSpeed * dxLocal;
      if (playerControlRef.current?.addExternalDelta) {
        playerControlRef.current.addExternalDelta(tdx * delta, 0, tdz * delta);
      }
    }

    // ----- Laser beams: rotate + check perpendicular distance to player -----
    for (const l of lasersRef.current) {
      l.angle = (l.angle || l.phase) + l.speed * delta;
      // The beam ray runs from origin O in direction (cosθ, 0, sinθ) for length L.
      const ox = l.origin[0], oy = l.origin[1], oz = l.origin[2];
      const dx = Math.cos(l.angle);
      const dz = Math.sin(l.angle);
      // Vector from O to player (XZ plane only — beam is horizontal)
      const vx = px - ox;
      const vz = pz - oz;
      const along = vx * dx + vz * dz;
      // Only counts if player is within the beam segment
      if (along < 0 || along > l.length) continue;
      // Perpendicular distance from player to the line
      const perpX = vx - dx * along;
      const perpZ = vz - dz * along;
      const perp = Math.sqrt(perpX * perpX + perpZ * perpZ);
      // Y check: beam is horizontal at oy; player center is at py
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

export default Level6;
