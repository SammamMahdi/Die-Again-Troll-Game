import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Sparkles } from '@react-three/drei';
import Player from '../components/Player';
import AnimatedBlock from '../components/AnimatedBlock';
import Gate from '../components/Gate';
import InfiniteGrid from '../components/InfiniteGrid';
import HUD from '../components/HUD';
import CameraController from '../components/CameraController';
import MobileControls from '../components/MobileControls';
import './Level.css';

const STEP = 7;
const PLAYER_HALF = 0.5;

const COLOR_NORMAL  = [0.7, 0.7, 0.85];
const COLOR_CRUMBLE = [0.8, 0.55, 0.3];
const COLOR_GOAL    = [1.0, 0.84, 0.0];

function buildLevel5Blocks() {
  const blocks = [];
  // Start
  blocks.push({
    x: 0, y: 0, z: 25, w: 8, h: 1, d: 8,
    visible: true, color: [...COLOR_NORMAL], isCrumble: false,
  });
  // 8 path platforms (NARROWER than before) — first 2 stable, the next 6 all crumble
  for (let i = 0; i < 8; i++) {
    const z = 25 - (i + 1) * STEP;
    const isCrumble = i >= 2;            // was: i >= 4
    blocks.push({
      x: 0, y: 0, z,
      startX: 0, startY: 0, startZ: z,
      w: 3.0, h: 1, d: 3.0,              // tighter than BLOCK_SIZE (was 4)
      visible: true,
      color: isCrumble ? [...COLOR_CRUMBLE] : [...COLOR_NORMAL],
      isCrumble,
      stepped: false,
      crumbleTimer: 0.4,                  // was 0.6 — less time to react
      warning: false,
      falling: false,
      fallSpeed: 0,
    });
  }
  // Goal
  const goalZ = 25 - 9 * STEP;
  blocks.push({
    x: 0, y: 0, z: goalZ, w: 10, h: 1, d: 10,
    visible: true, color: [...COLOR_GOAL],
    isGoal: true,
  });
  return { blocks, goal: { x: 0, y: 0.5, z: goalZ } };
}

function buildPendulums() {
  // 6 pendulums (was 4), all faster and reaching further out
  return [
    { pivot: [0, 9, 15],  arm: 6, freq: 1.7, phase: 0.0, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9, 6],   arm: 7, freq: 1.3, phase: 1.2, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9, -3],  arm: 6, freq: 1.9, phase: 0.6, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9, -12], arm: 7, freq: 1.5, phase: 2.0, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9, -21], arm: 6, freq: 2.0, phase: 1.5, bobRadius: 1.3, angle: 0 },
    { pivot: [0, 9, -30], arm: 7, freq: 1.6, phase: 0.3, bobRadius: 1.3, angle: 0 },
  ];
}

function Pendulum({ pendulum }) {
  const bobRef = useRef();
  const cordRef = useRef();
  useFrame(() => {
    const a = pendulum.angle || 0;
    const bx = pendulum.pivot[0] + Math.sin(a) * pendulum.arm;
    const by = pendulum.pivot[1] - Math.cos(a) * pendulum.arm;
    if (bobRef.current) bobRef.current.position.set(bx, by, pendulum.pivot[2]);
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
    }
  });

  return (
    <group>
      {/* Pivot point */}
      <mesh position={pendulum.pivot}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color="#33334a" emissive="#222233" emissiveIntensity={0.3} />
      </mesh>
      {/* Cord */}
      <mesh ref={cordRef}>
        <cylinderGeometry args={[0.06, 0.06, 1, 8]} />
        <meshBasicMaterial color="#666688" />
      </mesh>
      {/* Spiked bob */}
      <mesh ref={bobRef}>
        <sphereGeometry args={[pendulum.bobRadius, 28, 28]} />
        <meshStandardMaterial
          color="#ff4466"
          emissive="#ff2244"
          emissiveIntensity={0.9}
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>
    </group>
  );
}

function Level5({ deathCount, onDeath, onComplete }) {
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState([0, 5, 25]);

  const initial = useRef(buildLevel5Blocks());
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const pendulumsRef = useRef(buildPendulums());
  const playerPosRef = useRef([0, 5, 25]);
  const prevBlockIdxRef = useRef(-1);

  const [showMobileControls, setShowMobileControls] = useState(false);
  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches)
        || ('ontouchstart' in window);
      setShowMobileControls(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handlePlayerDeath = (reason) => {
    if (gameState !== 'playing') return;
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handleRestart = () => {
    const fresh = buildLevel5Blocks();
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh.blocks[i]));
    goalRef.current = fresh.goal;
    pendulumsRef.current = buildPendulums();
    prevBlockIdxRef.current = -1;
    playerPosRef.current = [0, 5, 25];
    setPlayerPosition([0, 5, 25]);
    setDeathReason('');
    setGameState('playing');
    setRestartKey(prev => prev + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === 'r' && gameState === 'dead') handleRestart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState]); // eslint-disable-line

  const handlePlayerUpdate = (pos) => {
    playerPosRef.current = pos;
    setPlayerPosition(pos);

    // Find which block player is on (by AABB top)
    let onIdx = -1;
    for (let i = 0; i < blocksRef.current.length; i++) {
      const b = blocksRef.current[i];
      if (!b.visible || b.solid === false) continue;
      const top = b.y + b.h / 2;
      if (pos[1] - 0.5 < top - 0.1 || pos[1] - 0.5 > top + 0.4) continue;
      if (Math.abs(pos[0] - b.x) > b.w / 2 + 0.4) continue;
      if (Math.abs(pos[2] - b.z) > b.d / 2 + 0.4) continue;
      onIdx = i;
      break;
    }
    if (onIdx !== prevBlockIdxRef.current) {
      const cur = onIdx >= 0 ? blocksRef.current[onIdx] : null;
      if (cur?.isCrumble) cur.stepped = true;
      if (cur?.isGoal && gameState === 'playing') setGameState('won');
      prevBlockIdxRef.current = onIdx;
    }
  };

  useEffect(() => {
    if (gameState === 'won') {
      const t = setTimeout(() => onComplete(), 1500);
      return () => clearTimeout(t);
    }
  }, [gameState, onComplete]);

  return (
    <div className="level-container">
      <Canvas
        camera={{ position: [30, 18, 40], fov: 60 }}
        style={{
          background: 'linear-gradient(180deg, #0a0a14 0%, #1c1c2e 60%, #2a2540 100%)',
          touchAction: 'none',
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <fog attach="fog" args={['#15151f', 45, 180]} />
        <ambientLight intensity={0.45} />
        <hemisphereLight args={['#b0c4ff', '#1a1a30', 0.5]} />
        <directionalLight position={[15, 25, 10]} intensity={1.1} />
        <pointLight position={[0, 14, 0]} intensity={0.55} color="#ff5577" distance={45} />
        <pointLight position={[0, 5, -38]} intensity={0.9} color="#ffd055" distance={32} />

        <Stars radius={200} depth={70} count={2400} factor={4} saturation={0} fade speed={0.6} />
        <Sparkles position={[0, 3, -38]} count={45} scale={[10, 6, 4]} size={3.5} speed={0.35} color="#ffd966" />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? '#ffd966' : (b.isCrumble ? '#ff8855' : '#7fdaff')}
            emissiveBoost={b.isGoal ? 0.55 : (b.isCrumble ? 0.2 : 0)}
          />
        ))}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} />

        {pendulumsRef.current.map((p, i) => (
          <Pendulum key={`${restartKey}-pen-${i}`} pendulum={p} />
        ))}

        <Player
          key={restartKey}
          startPosition={[0, 5, 25]}
          blocks={blocksRef.current}
          gate={null}
          onDeath={handlePlayerDeath}
          onWin={() => {}}
          onUpdate={handlePlayerUpdate}
          onGateTrigger={() => {}}
          gameState={gameState}
          mobileControlRef={playerControlRef}
        />

        <Level5Sim
          gameState={gameState}
          blocksRef={blocksRef}
          pendulumsRef={pendulumsRef}
          playerPosRef={playerPosRef}
          onPendulumHit={() => handlePlayerDeath('Smashed by a pendulum!')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />
      </Canvas>

      <HUD
        level={5}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Time the swings. Don't linger.</div>
      )}

      {showMobileControls && (
        <MobileControls
          enabled={gameState === 'playing'}
          onCameraMove={(dx, dy) => cameraControlRef.current?.rotate(dx, dy)}
          onMove={(dir, p) => playerControlRef.current?.setMove(dir, p)}
          onJump={(p) => playerControlRef.current?.setJump(p)}
        />
      )}
    </div>
  );
}

function Level5Sim({ gameState, blocksRef, pendulumsRef, playerPosRef, onPendulumHit }) {
  const timerRef = useRef(0);
  const hitRef = useRef(false);
  const PEND_ANGLE_MAX = 1.25; // ~72° — pendulums reach further out into the path

  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') { hitRef.current = false; return; }
    if (hitRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);
    timerRef.current += delta;

    const [px, py, pz] = playerPosRef.current;

    // Pendulums: update angle, check collision
    for (const p of pendulumsRef.current) {
      p.angle = Math.sin(timerRef.current * p.freq + p.phase) * PEND_ANGLE_MAX;
      const bx = p.pivot[0] + Math.sin(p.angle) * p.arm;
      const by = p.pivot[1] - Math.cos(p.angle) * p.arm;
      const bz = p.pivot[2];
      const dx = px - bx;
      const dy = py - by;
      const dz = pz - bz;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < (p.bobRadius + PLAYER_HALF + 0.1)) {
        hitRef.current = true;
        onPendulumHit();
        return;
      }
    }

    // Crumbling tiles
    for (const b of blocksRef.current) {
      if (b.isCrumble && b.stepped && !b.falling) {
        b.crumbleTimer -= delta;
        // warn with quick orange/red flash near end
        if (b.crumbleTimer <= 0.25) {
          b.warning = true;
          b.color = Math.floor(timerRef.current * 12) % 2 === 0
            ? [1.0, 0.4, 0.2]
            : [...COLOR_CRUMBLE];
        }
        if (b.crumbleTimer <= 0) {
          b.falling = true;
          b.fallSpeed = 0;
          b.solid = false;
        }
      }
      if (b.falling) {
        b.fallSpeed += 50 * delta;
        b.y -= b.fallSpeed * delta;
        if (b.y < -30) b.visible = false;
      }
    }
  });
  return null;
}

export default Level5;
