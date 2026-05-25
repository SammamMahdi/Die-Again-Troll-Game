import React, { useRef, useState, useEffect } from 'react';
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
import { playPillarChime, playOrbSpawn, playGateUnlock } from '../../utils/sounds';
import { getEchoMechanic, getEchoVisual } from '../../utils/echoThemes';
import useRestartOnR from '../../hooks/useRestartOnR';
import useVictoryTimer from '../../hooks/useVictoryTimer';
import useTeleportOnRequest from '../../hooks/useTeleportOnRequest';
import '../Level.css';

// =============================================================
// Level 10 ECHO — "Architect's Wrath"
//
//   Spec:
//   - 5 pillars (was 3). Must touch all 5 to unlock the gate.
//   - Boss orb 1.4× faster + every chase orb proportionally faster.
//   - Arena platform shrinks 5% every 10 seconds — lava encroaches
//     from the edges so the playable space tightens over time.
//   - Ice friction patches everywhere (every platform slides), not
//     just one corner.
//   - Theme: matte black with gold-only highlights, gold filigree.
// =============================================================

const COLOR_BASE = [0.18, 0.04, 0.02];
const COLOR_GOAL = [0.95, 0.55, 0.15];
const ICE_FRICTION = 0.985;
const DEFAULT_START = [0, 5, 8];
const ARENA_START_W = 20;
const ARENA_START_D = 20;
const SHRINK_INTERVAL = 10;     // seconds between shrinks

function buildBlocks() {
  const blocks = [];
  // Arena platform — mutated by Sim as it shrinks.
  blocks.push({
    x: 0, y: 0, z: 0, w: ARENA_START_W, h: 1, d: ARENA_START_D,
    visible: true, color: [...COLOR_BASE],
    friction: ICE_FRICTION, isArena: true,
  });
  // Corner safe platforms — also icy in echo per spec.
  const corners = [[13, -13], [-13, -13], [13, 13], [-13, 13]];
  for (const [cx, cz] of corners) {
    blocks.push({
      x: cx, y: 0, z: cz, w: 5, h: 1, d: 5, visible: true,
      color: [...COLOR_BASE], friction: ICE_FRICTION,
    });
  }
  // Bridges — also icy.
  blocks.push({ x:  6.5, y: 0, z: -13, w: 5, h: 1, d: 1.8, visible: true, color: [...COLOR_BASE], friction: ICE_FRICTION });
  blocks.push({ x: -6.5, y: 0, z: -13, w: 5, h: 1, d: 1.8, visible: true, color: [...COLOR_BASE], friction: ICE_FRICTION });
  blocks.push({ x:  6.5, y: 0, z:  13, w: 5, h: 1, d: 1.8, visible: true, color: [...COLOR_BASE], friction: ICE_FRICTION });
  blocks.push({ x: -6.5, y: 0, z:  13, w: 5, h: 1, d: 1.8, visible: true, color: [...COLOR_BASE], friction: ICE_FRICTION });
  // Central goal — only collidable visually once gate unlocks.
  blocks.push({
    x: 0, y: 0.5, z: 0, w: 4, h: 1, d: 4, visible: true,
    color: [...COLOR_GOAL], isGoal: true,
  });
  return { blocks };
}

// 5 pillars (was 3 in main) — placed at 4 corners + one in dead-center.
function buildPillars() {
  return [
    { id: 0, x:  13, y: 1.5, z: -13, color: '#ff7711', touched: false },
    { id: 1, x: -13, y: 1.5, z: -13, color: '#ff5500', touched: false },
    { id: 2, x:   0, y: 1.5, z:  13, color: '#ff8822', touched: false },
    { id: 3, x:  13, y: 1.5, z:  13, color: '#ff9933', touched: false },
    { id: 4, x: -13, y: 1.5, z:  13, color: '#ffaa44', touched: false },
  ];
}

function PillarVisual({ pillar }) {
  const ref = useRef();
  const matRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (ref.current) ref.current.rotation.y += delta * 0.85;
    if (matRef.current) {
      const pulse = pillar.touched ? 0.25 : 0.75 + 0.25 * Math.sin(t.current * 4);
      matRef.current.emissiveIntensity = pulse * (pillar.touched ? 0.5 : 1.3);
    }
  });
  return (
    <group ref={ref} position={[pillar.x, pillar.y, pillar.z]}>
      <mesh>
        <cylinderGeometry args={[0.65, 0.65, 3, 24]} />
        <meshStandardMaterial
          ref={matRef}
          color={pillar.color}
          emissive={pillar.color}
          emissiveIntensity={1.3}
          roughness={0.3}
          metalness={0.4}
          toneMapped={false}
        />
      </mesh>
      {!pillar.touched && (
        <QualitySparkles position={[0, 1.5, 0]} count={20} scale={[2, 4, 2]} size={2.5} speed={0.6} color={pillar.color} />
      )}
    </group>
  );
}

// Boss orb — gold-cored fireball instead of red sphere.
function ArchitectOrb({ orb }) {
  const ref = useRef();
  const haloRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (!ref.current) return;
    ref.current.position.set(orb.x, orb.y, orb.z);
    if (haloRef.current) {
      const pulse = 1 + 0.12 * Math.sin(t.current * 5);
      haloRef.current.scale.setScalar(pulse);
    }
  });
  return (
    <group ref={ref}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[orb.radius * 1.4, 24, 24]} />
        <meshBasicMaterial color="#ff6611" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[orb.radius, 32, 32]} />
        <meshStandardMaterial
          color="#ff5500"
          emissive="#ff8822"
          emissiveIntensity={1.8}
          roughness={0.25}
          metalness={0.45}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[orb.radius * 0.5, 16, 16]} />
        <meshBasicMaterial color="#ffeecc" toneMapped={false} />
      </mesh>
    </group>
  );
}

const __l10e_fresh = buildBlocks();
const JEWEL_CANDIDATES = candidatesFromBlocks(__l10e_fresh.blocks);

function Level10Echo({
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
  const echoMechanic = getEchoMechanic(10);
  const echoVisual = getEchoVisual(10);
  const pillarCount = echoMechanic.pillarCount || 5;
  const orbSpeedMul = echoMechanic.orbSpeedMul || 1.4;
  const arenaShrink = echoMechanic.arenaShrink || 0.92;

  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);
  const [pillarsTouched, setPillarsTouched] = useState(0);
  const [gateUnlocked, setGateUnlocked] = useState(false);

  const initial = useRef(buildBlocks());
  const blocksRef = useRef(initial.current.blocks);
  const pillarsRef = useRef(buildPillars().slice(0, pillarCount));
  const orbRef = useRef({ x: 0, y: 5, z: -10, radius: 1.75, speed: 5.0 * orbSpeedMul });
  const extraOrbsRef = useRef([]);
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
    pillarsRef.current = buildPillars().slice(0, pillarCount);
    orbRef.current = { x: 0, y: 5, z: -10, radius: 1.75, speed: 5.0 * orbSpeedMul };
    extraOrbsRef.current = [];
    playerPosRef.current = START;
    setPlayerPosition(START);
    setPillarsTouched(0);
    setGateUnlocked(false);
    setDeathReason('');
    setGameState('playing');
    setRestartKey(prev => prev + 1);
  };

  useRestartOnR(gameState, handleRestart);

  const handlePlayerUpdate = (pos) => {
    playerPosRef.current = pos;
    setPlayerPosition(pos);
    let newlyTouched = 0;
    for (const p of pillarsRef.current) {
      if (p.touched) continue;
      const dx = pos[0] - p.x;
      const dz = pos[2] - p.z;
      if (Math.sqrt(dx * dx + dz * dz) < 1.6) {
        p.touched = true;
        newlyTouched++;
        playPillarChime();
        const idx = extraOrbsRef.current.length;
        const spawnSide = idx % 2 === 0 ? 1 : -1;
        extraOrbsRef.current.push({
          x: spawnSide * 10,
          y: 5,
          z: -spawnSide * 10,
          radius: 1.25,
          speed: (5.6 + idx * 0.3) * orbSpeedMul,
        });
        playOrbSpawn();
      }
    }
    if (newlyTouched > 0) {
      setPillarsTouched(prev => prev + newlyTouched);
    }
  };

  useEffect(() => {
    if (pillarsTouched >= pillarCount && !gateUnlocked) {
      setGateUnlocked(true);
      playGateUnlock();
      extraOrbsRef.current.push({
        x: 0, y: 9, z: 0,
        radius: 1.45,
        speed: 7.0 * orbSpeedMul,
      });
      playOrbSpawn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pillarsTouched, gateUnlocked, pillarCount]);

  useVictoryTimer(gameState, () => onComplete({ complete: sideQuestCompleteRef.current }));

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [25, 22, 25], fov: 60 }}
        style={{ background: echoVisual?.sky, touchAction: 'none' }}
      >
        <fog attach="fog" args={[echoVisual?.fogColor || '#0a0000', echoVisual?.fogNear ?? 30, echoVisual?.fogFar ?? 180]} />
        <ambientLight intensity={echoVisual?.ambientIntensity ?? 0.35} color={echoVisual?.ambientColor || '#ff8822'} />
        <hemisphereLight args={[echoVisual?.hemiTop || '#ffaa44', echoVisual?.hemiBottom || '#0a0000', echoVisual?.hemiIntensity ?? 0.3]} />
        <directionalLight position={[15, 25, 10]} intensity={0.85} color="#ffaa55" />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 12, 0]} intensity={1.1} color="#ff7711" distance={50} />
            <pointLight position={[16, 6, -16]} intensity={0.65} color="#ff5500" distance={20} />
            <pointLight position={[-16, 6, -16]} intensity={0.65} color="#ff5500" distance={20} />
            <pointLight position={[0, 6, 16]} intensity={0.65} color="#ff8822" distance={20} />
          </>
        )}

        <QualitySparkles
          position={[0, 5, 0]} count={80} scale={[16, 7, 16]} size={3.5} speed={0.35}
          color={echoVisual?.sparkleColor || '#ff7722'}
        />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? (gateUnlocked ? '#ffaa44' : '#664422') : '#cc6622'}
            emissiveBoost={b.isGoal ? (gateUnlocked ? 0.45 : 0.1) : 0.05}
            metalness={0.5}
            roughness={0.3}
          />
        ))}

        {gateUnlocked && <Gate position={[0, 0.5, 0]} jewelColor="#ff7722" grand />}

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {pillarsRef.current.map(p => (
          <PillarVisual key={`${restartKey}-pillar-${p.id}`} pillar={p} />
        ))}

        <ArchitectOrb orb={orbRef.current} />
        {extraOrbsRef.current.map((o, i) => (
          <ArchitectOrb key={`${restartKey}-extra-orb-${i}`} orb={o} />
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

        <Level10EchoSim
          gameState={paused ? 'paused' : gameState}
          blocksRef={blocksRef}
          orbRef={orbRef}
          extraOrbsRef={extraOrbsRef}
          playerPosRef={playerPosRef}
          gateUnlocked={gateUnlocked}
          arenaShrink={arenaShrink}
          onOrbHit={() => handlePlayerDeath('Consumed by the Architect.')}
          onArenaFall={() => handlePlayerDeath('The lava swallowed you.')}
          onWin={() => setGameState('won')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.85} hue={0.03} />
      </QualityCanvas>

      <HUD
        level={10}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">
          Pillars: <strong>{pillarsTouched}/{pillarCount}</strong>
          {gateUnlocked ? ' — return to the center!' : ' — the arena is collapsing.'}
        </div>
      )}
    </div>
  );
}

// Sim — orbs chase, arena shrinks every SHRINK_INTERVAL seconds, and
// players standing on a chunk of arena that just got eaten by lava
// fall + die.
function Level10EchoSim({
  gameState, blocksRef, orbRef, extraOrbsRef, playerPosRef, gateUnlocked,
  arenaShrink, onOrbHit, onArenaFall, onWin,
}) {
  const hitRef = useRef(false);
  const wonRef = useRef(false);
  const tRef = useRef(0);
  const nextShrinkAtRef = useRef(SHRINK_INTERVAL);
  const isInvisible = useIsInvisibleNow();

  const stepOrb = (o, px, py, pz, delta) => {
    const dx = px - o.x;
    const dy = (py + 1.5) - o.y;
    const dz = pz - o.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > 0) {
      o.x += (dx / d) * o.speed * delta;
      o.y += (dy / d) * o.speed * delta * 0.6;
      o.z += (dz / d) * o.speed * delta;
    }
    return d < o.radius + 0.5;
  };

  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') { hitRef.current = false; wonRef.current = false; return; }
    if (hitRef.current || wonRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);
    tRef.current += delta;
    const now = tRef.current;
    const [px, py, pz] = playerPosRef.current;

    // Periodic arena shrink — multiply arena w/d by `arenaShrink`.
    if (now >= nextShrinkAtRef.current) {
      nextShrinkAtRef.current = now + SHRINK_INTERVAL;
      const arena = blocksRef.current.find(b => b.isArena);
      if (arena) {
        arena.w *= arenaShrink;
        arena.d *= arenaShrink;
      }
    }

    // If the player is on top of the arena but now outside its
    // (shrunk) bounds, drop them into the lava — counts as death.
    const arena = blocksRef.current.find(b => b.isArena);
    if (arena) {
      const onArenaY = py > arena.y - 0.5 && py < arena.y + 2.5;
      if (onArenaY) {
        const outOfBounds =
          Math.abs(px - arena.x) > arena.w / 2 + 0.2 &&
          Math.abs(pz - arena.z) > arena.d / 2 + 0.2;
        // Only count "fell out" if they're NOT on a corner platform.
        let onCorner = false;
        for (const b of blocksRef.current) {
          if (b.isArena || b.isGoal) continue;
          if (Math.abs(px - b.x) < b.w / 2 && Math.abs(pz - b.z) < b.d / 2 &&
              Math.abs(py - b.y) < 2.5) { onCorner = true; break; }
        }
        if (outOfBounds && !onCorner && py < arena.y + 0.4) {
          hitRef.current = true;
          onArenaFall();
          return;
        }
      }
    }

    // Invisibility freezes every orb where it is — they don't track or
    // chase the player at all until the potion wears off.
    const phasing = isInvisible();
    if (!phasing) {
      if (stepOrb(orbRef.current, px, py, pz, delta)) {
        hitRef.current = true; onOrbHit(); return;
      }
      for (const o of extraOrbsRef.current) {
        if (stepOrb(o, px, py, pz, delta)) {
          hitRef.current = true; onOrbHit(); return;
        }
      }
    }

    // Win check.
    if (gateUnlocked) {
      const wx = px, wz = pz;
      if (Math.sqrt(wx * wx + wz * wz) < 2.5 && py < 3.5 && py > -2) {
        wonRef.current = true;
        onWin();
      }
    }
  });
  return null;
}

export default Level10Echo;
