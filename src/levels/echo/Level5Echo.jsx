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
import { getEchoMechanic, getEchoVisual } from '../../utils/echoThemes';
import { PLAYER_HALF } from '../../constants/gameConstants';
import useRestartOnR from '../../hooks/useRestartOnR';
import useVictoryTimer from '../../hooks/useVictoryTimer';
import useTeleportOnRequest from '../../hooks/useTeleportOnRequest';
import '../Level.css';

// =============================================================
// Level 5 ECHO — "Bladestorm"
//
//   Spec:
//   - 4 extra pendulums (10 total — main has 6).
//   - 1.6× swing speed.
//   - Platforms shrunk to ~62% width.
//   - Periodic lightning flashes briefly HIDE pendulum visibility
//     (~0.25s blink every ~3-4s) — the player has to time off the
//     rhythm of the swings, not their eyes.
//   - Pendulum bobs become SERRATED blade discs (geometry swap).
//   - Theme: lightning-cracked sky, rust-iron tint, ash storm.
// =============================================================

const STEP = 7;
const PLAYER_HALF_LOCAL = PLAYER_HALF;
const DEFAULT_START = [0, 5, 25];

function buildBlocks(scale) {
  const s = scale * 4.0;
  const blocks = [];
  blocks.push({ x: 0, y: 0, z: 25, w: 8, h: 1, d: 8, visible: true, color: [0.45, 0.18, 0.10] });
  for (let i = 0; i < 8; i++) {
    const z = 25 - (i + 1) * STEP;
    blocks.push({
      x: 0, y: 0, z,
      startX: 0, startY: 0, startZ: z,
      w: s, h: 1, d: s,
      visible: true,
      color: [0.55, 0.20, 0.12],
    });
  }
  const goalZ = 25 - 9 * STEP;
  blocks.push({
    x: 0, y: 0, z: goalZ, w: 10, h: 1, d: 10,
    visible: true, color: [0.55, 0.18, 0.10], isGoal: true,
  });
  return { blocks, goal: { x: 0, y: 0.5, z: goalZ } };
}

function buildPendulums(sm, extraCount) {
  // Base set of 6 + extras filling in between, for 10 total when
  // extraCount = 4.
  const base = [
    { pivot: [0, 9,  15], arm: 6, freq: 1.0 * sm, phase: 0.0, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9,   6], arm: 7, freq: 1.3 * sm, phase: 1.4, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9,  -3], arm: 6, freq: 1.6 * sm, phase: 0.7, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9, -12], arm: 7, freq: 1.9 * sm, phase: 2.1, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9, -21], arm: 6, freq: 2.2 * sm, phase: 1.0, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9, -30], arm: 7, freq: 2.5 * sm, phase: 0.4, bobRadius: 1.3, angle: 0 },
  ];
  const extras = [
    { pivot: [0, 9,  10], arm: 6, freq: 1.2 * sm, phase: 0.9, bobRadius: 1.2, angle: 0 },
    { pivot: [0, 9,   1], arm: 7, freq: 1.5 * sm, phase: 2.3, bobRadius: 1.2, angle: 0 },
    { pivot: [0, 9,  -8], arm: 6, freq: 1.8 * sm, phase: 1.6, bobRadius: 1.2, angle: 0 },
    { pivot: [0, 9, -17], arm: 7, freq: 2.1 * sm, phase: 0.2, bobRadius: 1.2, angle: 0 },
  ];
  return base.concat(extras.slice(0, Math.max(0, extraCount)));
}

// Serrated blade disc — replaces the spherical pendulum bob.
function BladeBob({ pendulum, hidden }) {
  const bobRef = useRef();
  const cordRef = useRef();
  useFrame(() => {
    const a = pendulum.angle || 0;
    const bx = pendulum.pivot[0] + Math.sin(a) * pendulum.arm;
    const by = pendulum.pivot[1] - Math.cos(a) * pendulum.arm;
    if (bobRef.current) {
      bobRef.current.position.set(bx, by, pendulum.pivot[2]);
      bobRef.current.rotation.z = a;
      bobRef.current.rotation.x += 0.15;  // constant spin for blade gleam
      bobRef.current.visible = !hidden;
    }
    if (cordRef.current) {
      const dx = bx - pendulum.pivot[0];
      const dy = by - pendulum.pivot[1];
      const len = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
      cordRef.current.position.set(
        (pendulum.pivot[0] + bx) / 2,
        (pendulum.pivot[1] + by) / 2,
        pendulum.pivot[2],
      );
      cordRef.current.scale.y = len;
      cordRef.current.rotation.z = Math.atan2(dx, -dy);
      cordRef.current.visible = !hidden;
    }
  });
  return (
    <group>
      <mesh position={pendulum.pivot}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#2a0a05" emissive="#440000" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={cordRef}>
        <cylinderGeometry args={[0.06, 0.06, 1, 8]} />
        <meshBasicMaterial color="#552222" />
      </mesh>
      {/* Saw blade disc — cylinder with thin profile + serration ring */}
      <mesh ref={bobRef}>
        <cylinderGeometry args={[pendulum.bobRadius, pendulum.bobRadius, 0.18, 16]} />
        <meshStandardMaterial
          color="#aa3322"
          emissive="#ff3322"
          emissiveIntensity={1.0}
          roughness={0.25}
          metalness={0.85}
        />
      </mesh>
    </group>
  );
}

const __l5e_fresh = buildBlocks(0.62);
const JEWEL_CANDIDATES = candidatesFromBlocks(__l5e_fresh.blocks);

function Level5Echo({
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
  const echoMechanic = getEchoMechanic(5);
  const echoVisual = getEchoVisual(5);
  const speedMul = echoMechanic.pendulumSpeedMul || 1.6;
  const extraCount = echoMechanic.pendulumExtraCount || 4;
  const platformShrink = echoMechanic.platformShrink || 0.62;

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);
  // Flash state: when true, all pendulums are momentarily HIDDEN (the
  // lightning blanks the eye). Toggled by Sim.
  const [pendHidden, setPendHidden] = useState(false);

  const initial = useRef(buildBlocks(platformShrink));
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const pendulumsRef = useRef(buildPendulums(speedMul, extraCount));
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
    const fresh = buildBlocks(platformShrink);
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh.blocks[i]));
    goalRef.current = fresh.goal;
    pendulumsRef.current = buildPendulums(speedMul, extraCount);
    playerPosRef.current = START;
    setPlayerPosition(START);
    setDeathReason('');
    setGameState('playing');
    setPendHidden(false);
    setRestartKey(prev => prev + 1);
  };

  useRestartOnR(gameState, handleRestart);

  const handlePlayerUpdate = (pos) => {
    playerPosRef.current = pos;
    setPlayerPosition(pos);
    let onGoal = false;
    for (const b of blocksRef.current) {
      if (!b.isGoal || !b.visible) continue;
      const top = b.y + b.h / 2;
      if (pos[1] - 0.5 < top - 0.1 || pos[1] - 0.5 > top + 0.4) continue;
      if (Math.abs(pos[0] - b.x) > b.w / 2 + 0.4) continue;
      if (Math.abs(pos[2] - b.z) > b.d / 2 + 0.4) continue;
      onGoal = true;
      break;
    }
    if (onGoal && gameState === 'playing') setGameState('won');
  };

  useVictoryTimer(gameState, () => onComplete({ complete: sideQuestCompleteRef.current }));

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [30, 18, 40], fov: 60 }}
        style={{ background: echoVisual?.sky, touchAction: 'none' }}
      >
        <fog attach="fog" args={[echoVisual?.fogColor || '#2a0500', echoVisual?.fogNear ?? 32, echoVisual?.fogFar ?? 150]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.4} color={echoVisual?.ambientColor || '#ff6644'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ff7755', echoVisual?.hemiBottom || '#0a0000', echoVisual?.hemiIntensity ?? 0.4]} />
        <directionalLight position={[15, 25, 10]} intensity={0.85} color="#ff8866" />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 14, 0]} intensity={0.55} color="#ff3322" distance={45} />
            <pointLight position={[0, 5, -38]} intensity={0.55} color="#ffaa44" distance={26} />
          </>
        )}

        <QualitySparkles
          position={[0, 6, -10]} count={70} scale={[18, 8, 50]} size={1.4} speed={0.7}
          color="#ff7733"
        />
        <QualitySparkles
          position={[0, 3, -38]} count={28} scale={[8, 5, 4]} size={2.4} speed={0.3}
          color={echoVisual?.sparkleColor || '#ff4422'}
        />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? '#ff4422' : '#ff5533'}
            emissiveBoost={b.isGoal ? 0.4 : 0.15}
          />
        ))}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} jewelColor="#ff4422" />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {pendulumsRef.current.map((p, i) => (
          <BladeBob key={`${restartKey}-pen-${i}`} pendulum={p} hidden={pendHidden} />
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

        <Level5EchoSim
          gameState={paused ? 'paused' : gameState}
          pendulumsRef={pendulumsRef}
          playerPosRef={playerPosRef}
          onPendulumHit={() => handlePlayerDeath('A blade caught you in the dark.')}
          onLightningBlink={(hide) => setPendHidden(hide)}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.7} hue={0.03} />
      </QualityCanvas>

      <HUD
        level={5}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Hear the swings. The lightning lies.</div>
      )}
    </div>
  );
}

// Sim — advances pendulum angles + collision-checks the player, and
// periodically blanks every pendulum's visibility for ~0.25s as a
// lightning flash. The flash interval is randomized within a band so
// the player can't reflexively memorize the rhythm.
function Level5EchoSim({ gameState, pendulumsRef, playerPosRef, onPendulumHit, onLightningBlink }) {
  const timerRef = useRef(0);
  const nextBlinkAtRef = useRef(2.5);
  const blinkUntilRef = useRef(0);
  const isHiddenRef = useRef(false);
  const hitRef = useRef(false);
  const isInvisible = useIsInvisibleNow();
  const PEND_ANGLE_MAX = 1.25;

  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') { hitRef.current = false; return; }
    if (hitRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);
    timerRef.current += delta;
    const now = timerRef.current;

    // Lightning blink scheduler: every 2.5-4.5s, hide the pendulums
    // for 0.22-0.32s.
    if (!isHiddenRef.current && now >= nextBlinkAtRef.current) {
      isHiddenRef.current = true;
      blinkUntilRef.current = now + 0.22 + Math.random() * 0.10;
      nextBlinkAtRef.current = blinkUntilRef.current + 2.5 + Math.random() * 2.0;
      onLightningBlink(true);
    } else if (isHiddenRef.current && now >= blinkUntilRef.current) {
      isHiddenRef.current = false;
      onLightningBlink(false);
    }

    const [px, py, pz] = playerPosRef.current;
    for (const p of pendulumsRef.current) {
      p.angle = Math.sin(now * p.freq + p.phase) * PEND_ANGLE_MAX;
      const bx = p.pivot[0] + Math.sin(p.angle) * p.arm;
      const by = p.pivot[1] - Math.cos(p.angle) * p.arm;
      const bz = p.pivot[2];
      const dx = px - bx;
      const dy = py - by;
      const dz = pz - bz;
      // Blade is a flat disc, but for gameplay we use a sphere
      // collider — small radius is more forgiving than the visual
      // suggests, on purpose.
      if (!isInvisible() && Math.sqrt(dx * dx + dy * dy + dz * dz) < (p.bobRadius + PLAYER_HALF_LOCAL + 0.1)) {
        hitRef.current = true;
        onPendulumHit();
        return;
      }
    }
  });
  return null;
}

export default Level5Echo;
