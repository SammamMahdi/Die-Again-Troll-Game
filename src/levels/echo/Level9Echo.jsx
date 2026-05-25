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
import { candidatesFromBlocks } from '../../utils/jewelCandidates';
import HUD from '../../components/HUD';
import CameraController from '../../components/CameraController';
import ScenePostFX from '../../components/ScenePostFX';
import { playWindGust } from '../../utils/sounds';
import { getEchoMechanic, getEchoVisual } from '../../utils/echoThemes';
import useRestartOnR from '../../hooks/useRestartOnR';
import useVictoryTimer from '../../hooks/useVictoryTimer';
import useTeleportOnRequest from '../../hooks/useTeleportOnRequest';
import '../Level.css';

// =============================================================
// Level 9 ECHO — "The Storm Eye"
//
//   Spec:
//   - 2× wind force.
//   - Platforms 70% width.
//   - Random gust direction shifts — wind no longer only blows
//     along the X axis. Periodically a zone rerolls its direction
//     to a random unit vector in XZ.
//   - Periodic "calm" interval — every ~6-10 seconds the entire
//     storm goes silent for 1.5s. The player can use these windows
//     to commit to risky hops.
//   - Theme: orange ember storm, volcanic fissure sky.
// =============================================================

const DEFAULT_START = [0, 5, 25];
const COLOR_PATH = [0.55, 0.18, 0.10];

function buildBlocks(widthMul) {
  const blocks = [];
  blocks.push({ x: 0, y: 0, z: 25, w: 8, h: 1, d: 6, visible: true, color: [...COLOR_PATH] });
  let z = 18;
  for (let i = 0; i < 8; i++) {
    blocks.push({
      x: 0, y: 0, z, w: 3.2 * widthMul, h: 1, d: 3.5, visible: true, color: [...COLOR_PATH],
    });
    z -= 6;
  }
  blocks.push({ x: 0, y: 0, z: -32, w: 10, h: 1, d: 8, visible: true, color: [0.6, 0.20, 0.10], isGoal: true });
  return { blocks, goal: { x: 0, y: 0.5, z: -32 } };
}

function randDirAtTheta(theta, magnitude) {
  return { dirX: Math.cos(theta) * magnitude, dirZ: Math.sin(theta) * magnitude };
}

function buildWindZones(forceMul) {
  // Each zone holds a baseDir (origin direction) + current dir +
  // its next-shift time. Sim mutates dir periodically.
  const base = [
    { x: 0, y: 0, z: 15,  w: 12, h: 8, d: 8, freq: 1.7, phase: 0.0, magnitude:  7 * forceMul },
    { x: 0, y: 0, z:  5,  w: 12, h: 8, d: 8, freq: 1.5, phase: 1.2, magnitude:  8 * forceMul },
    { x: 0, y: 0, z: -5,  w: 12, h: 8, d: 8, freq: 1.9, phase: 0.6, magnitude:  8 * forceMul },
    { x: 0, y: 0, z: -15, w: 12, h: 8, d: 8, freq: 1.7, phase: 2.0, magnitude:  9 * forceMul },
    { x: 0, y: 0, z: -25, w: 12, h: 8, d: 8, freq: 2.0, phase: 0.4, magnitude:  8 * forceMul },
  ];
  // Initial directions are alternating along X (matches main feel
  // for the first few seconds before the first shift).
  return base.map((z, i) => {
    const theta = (i % 2 === 0) ? 0 : Math.PI;
    const { dirX, dirZ } = randDirAtTheta(theta, z.magnitude);
    return { ...z, theta, dirX, dirZ, nextShiftAt: 4 + i * 2 + Math.random() * 4 };
  });
}

function WindZoneVisual({ zone, calm }) {
  const groupRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (!groupRef.current) return;
    groupRef.current.position.set(zone.x, zone.y + zone.h / 2, zone.z);
    const strength = calm ? 0 : Math.max(0, Math.sin(t.current * zone.freq + zone.phase));
    groupRef.current.children.forEach(child => {
      if (child.material && child.material.transparent) {
        child.material.opacity = 0.10 + 0.25 * strength;
      }
    });
    // Visually rotate streak children based on the zone's CURRENT theta
    // (which Sim mutates) so the visualization tracks the random gust
    // direction shifts.
    const streakGroup = groupRef.current.children[1];
    if (streakGroup && streakGroup.rotation) {
      streakGroup.rotation.y = zone.theta;
    }
  });
  const color = zone.dirX > 0 ? '#ff8833' : '#ff4422';
  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[zone.w, zone.h, zone.d]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <group>
        {[0, 1, 2].map(i => (
          <mesh key={i} position={[-3, -2 + i * 2, 0]}>
            <boxGeometry args={[6, 0.05, 0.05]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const __l9e_fresh = buildBlocks(0.7);
const JEWEL_CANDIDATES = candidatesFromBlocks(__l9e_fresh.blocks);

function Level9Echo({
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
  const echoMechanic = getEchoMechanic(9);
  const echoVisual = getEchoVisual(9);
  const forceMul = echoMechanic.windForceMul || 2.0;
  const widthMul = echoMechanic.platformWidthMul || 0.7;
  const calmInterval = echoMechanic.calmInterval || 1.5;
  const enableRandomGusts = echoMechanic.randomGusts !== false;

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);
  // calm: storm pauses entirely for `calmInterval` seconds.
  const [calm, setCalm] = useState(false);

  const initial = useRef(buildBlocks(widthMul));
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const zonesRef = useRef(buildWindZones(forceMul));
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
    const fresh = buildBlocks(widthMul);
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh.blocks[i]));
    goalRef.current = fresh.goal;
    zonesRef.current = buildWindZones(forceMul);
    playerPosRef.current = START;
    setPlayerPosition(START);
    setDeathReason('');
    setGameState('playing');
    setCalm(false);
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
        <fog attach="fog" args={[echoVisual?.fogColor || '#2a0800', echoVisual?.fogNear ?? 32, echoVisual?.fogFar ?? 160]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.5} color={echoVisual?.ambientColor || '#ff8844'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ffaa66', echoVisual?.hemiBottom || '#1a0400', echoVisual?.hemiIntensity ?? 0.45]} />
        <directionalLight position={[15, 25, 10]} intensity={0.95} color="#ffaa66" />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 8, 0]} intensity={0.7} color="#ff5511" distance={50} />
            <pointLight position={[0, 5, -32]} intensity={0.55} color="#ffaa44" distance={24} />
          </>
        )}

        <QualitySparkles
          position={[0, 4, -5]} count={140} scale={[24, 10, 60]} size={1.7} speed={2.5}
          color="#ff7733"
        />
        <QualitySparkles
          position={[0, 3, -32]} count={28} scale={[8, 5, 4]} size={2.2} speed={0.3}
          color={echoVisual?.sparkleColor || '#ff8833'}
        />

        <InfiniteGrid />

        {zonesRef.current.map((z, i) => (
          <WindZoneVisual key={`${restartKey}-zone-${i}`} zone={z} calm={calm} />
        ))}

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? '#ff8833' : '#ff5522'}
            emissiveBoost={b.isGoal ? 0.35 : 0.10}
          />
        ))}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} jewelColor="#ff8833" />

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

        <Level9EchoSim
          gameState={paused ? 'paused' : gameState}
          zonesRef={zonesRef}
          playerPosRef={playerPosRef}
          playerControlRef={playerControlRef}
          calmInterval={calmInterval}
          enableRandomGusts={enableRandomGusts}
          onCalmChange={setCalm}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.55} hue={0.05} />
      </QualityCanvas>

      <HUD
        level={9}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">
          {calm ? 'EYE OF THE STORM — MOVE NOW.' : 'Ash shifts. Watch the lulls.'}
        </div>
      )}
    </div>
  );
}

function Level9EchoSim({
  gameState, zonesRef, playerPosRef, playerControlRef,
  calmInterval, enableRandomGusts, onCalmChange,
}) {
  const tRef = useRef(0);
  // Calm scheduler — every 6-10s of normal storm, drop into calm for
  // `calmInterval` seconds.
  const stateRef = useRef({ phase: 'storm', untilTime: 6 + Math.random() * 4 });
  const lastCalmReportedRef = useRef(false);

  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') return;
    const delta = Math.min(deltaRaw, 0.05);
    tRef.current += delta;
    const now = tRef.current;

    // Calm/storm phase machine.
    if (now >= stateRef.current.untilTime) {
      if (stateRef.current.phase === 'storm') {
        stateRef.current.phase = 'calm';
        stateRef.current.untilTime = now + calmInterval;
      } else {
        stateRef.current.phase = 'storm';
        stateRef.current.untilTime = now + 6 + Math.random() * 4;
      }
    }
    const isCalm = stateRef.current.phase === 'calm';
    if (isCalm !== lastCalmReportedRef.current) {
      lastCalmReportedRef.current = isCalm;
      onCalmChange(isCalm);
    }

    const [px, py, pz] = playerPosRef.current;

    for (const z of zonesRef.current) {
      // Per-zone random direction shift (independent of pulse).
      if (enableRandomGusts && now >= z.nextShiftAt) {
        z.theta = Math.random() * Math.PI * 2;
        const { dirX, dirZ } = randDirAtTheta(z.theta, z.magnitude);
        z.dirX = dirX;
        z.dirZ = dirZ;
        z.nextShiftAt = now + 2.5 + Math.random() * 3.5;
      }

      // Periodic gust sound on each crest.
      const raw = Math.sin(now * z.freq + z.phase);
      const peaking = !isCalm && raw > 0.92;
      if (peaking && !z._peaking) playWindGust();
      z._peaking = peaking;

      // Calm intervals zero the force entirely.
      if (isCalm) continue;

      // Inside the zone?
      if (Math.abs(px - z.x) > z.w / 2) continue;
      if (Math.abs(py - (z.y + z.h / 2)) > z.h / 2) continue;
      if (Math.abs(pz - z.z) > z.d / 2) continue;

      const strength = Math.max(0, raw);
      const dx = z.dirX * strength * delta;
      const dz = z.dirZ * strength * delta;
      if (playerControlRef.current?.addExternalDelta) {
        playerControlRef.current.addExternalDelta(dx, 0, dz);
      }
    }
  });
  return null;
}

export default Level9Echo;
