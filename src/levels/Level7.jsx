import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import Player from '../components/Player';
import AnimatedBlock from '../components/AnimatedBlock';
import Gate from '../components/Gate';
import InfiniteGrid from '../components/InfiniteGrid';
import HUD from '../components/HUD';
import CameraController from '../components/CameraController';
import MobileControls from '../components/MobileControls';
import './Level.css';

const PLAYER_HALF = 0.5;
const COLOR_PATH = [0.68, 0.7, 0.85];
const COLOR_GOAL = [1.0, 0.84, 0.0];

function buildLevel7() {
  const blocks = [];
  // Start
  blocks.push({ x: 0, y: 0, z: 30, w: 6, h: 1, d: 6, visible: true, color: [...COLOR_PATH] });

  // 10 stepping platforms forward — narrower than before (2.5 vs 3)
  let z = 24;
  for (let i = 0; i < 10; i++) {
    blocks.push({
      x: 0, y: 0, z, w: 2.5, h: 1, d: 2.5, visible: true,
      color: [...COLOR_PATH],
    });
    z -= 5;
  }

  // Goal
  blocks.push({ x: 0, y: 0, z: -32, w: 8, h: 1, d: 8, visible: true, color: [...COLOR_GOAL], isGoal: true });
  return { blocks, goal: { x: 0, y: 0.5, z: -32 } };
}

function buildSlidingWalls() {
  // 6 walls (was 3), all faster (was ~5 → 7-8), with wider sweep range.
  return [
    { x: -12, y: 0.5, z: 17,  w: 1, h: 3, d: 4, vx:  7.5, range: 12 },
    { x:  12, y: 0.5, z: 10,  w: 1, h: 3, d: 4, vx: -8.0, range: 12 },
    { x: -12, y: 0.5, z:  3,  w: 1, h: 3, d: 4, vx:  7.0, range: 12 },
    { x:  12, y: 0.5, z: -4,  w: 1, h: 3, d: 4, vx: -7.5, range: 12 },
    { x: -12, y: 0.5, z: -12, w: 1, h: 3, d: 4, vx:  8.0, range: 12 },
    { x:  12, y: 0.5, z: -22, w: 1, h: 3, d: 4, vx: -8.5, range: 12 },
  ];
}

// Add a spotlight that follows the camera/player like a flashlight.
function PlayerFlashlight({ playerPosRef }) {
  const lightRef = useRef();
  useFrame(() => {
    if (!lightRef.current) return;
    const [px, py, pz] = playerPosRef.current;
    lightRef.current.position.set(px, py + 4, pz);
    if (lightRef.current.target) {
      lightRef.current.target.position.set(px, py - 1, pz);
      lightRef.current.target.updateMatrixWorld();
    }
  });
  return (
    <spotLight
      ref={lightRef}
      angle={1.2}
      penumbra={0.6}
      intensity={2.0}
      distance={20}
      color="#c8e6ff"
      castShadow={false}
    />
  );
}

function Level7({ deathCount, onDeath, onComplete }) {
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState([0, 5, 30]);

  const initial = useRef(buildLevel7());
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const wallsRef = useRef(buildSlidingWalls());
  const playerPosRef = useRef([0, 5, 30]);

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
    const fresh = buildLevel7();
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh.blocks[i]));
    goalRef.current = fresh.goal;
    wallsRef.current = buildSlidingWalls();
    playerPosRef.current = [0, 5, 30];
    setPlayerPosition([0, 5, 30]);
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
    const g = goalRef.current;
    const dx = pos[0] - g.x;
    const dz = pos[2] - g.z;
    if (gameState === 'playing' && Math.sqrt(dx * dx + dz * dz) < 4.0 && pos[1] < 2.5) {
      setGameState('won');
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
        camera={{ position: [20, 14, 40], fov: 60 }}
        style={{
          background: 'linear-gradient(180deg, #000004 0%, #000010 100%)',
          touchAction: 'none',
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        {/* Tighter fog than before — visibility ~10 units */}
        <fog attach="fog" args={['#000000', 4, 14]} />
        <ambientLight intensity={0.05} color="#1a1f30" />
        <hemisphereLight args={['#1a2030', '#000005', 0.1]} />

        {/* Player-following flashlight */}
        <PlayerFlashlight playerPosRef={playerPosRef} />

        <Sparkles position={[0, 3, -32]} count={45} scale={[10, 5, 4]} size={3.5} speed={0.35} color="#ffd966" />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? '#ffd966' : '#5fb8ff'}
            emissiveBoost={b.isGoal ? 0.6 : 0.05}
          />
        ))}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} />

        {/* Sliding walls — rendered + tracked */}
        {wallsRef.current.map((w, i) => (
          <SlidingWall key={`${restartKey}-wall-${i}`} wall={w} />
        ))}

        <Player
          key={restartKey}
          startPosition={[0, 5, 30]}
          blocks={blocksRef.current}
          gate={null}
          onDeath={handlePlayerDeath}
          onWin={() => {}}
          onUpdate={handlePlayerUpdate}
          onGateTrigger={() => {}}
          gameState={gameState}
          mobileControlRef={playerControlRef}
        />

        <Level7Sim
          gameState={gameState}
          wallsRef={wallsRef}
          playerPosRef={playerPosRef}
          onWallHit={() => handlePlayerDeath('Crushed in the dark!')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />
      </Canvas>

      <HUD
        level={7}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Walk toward the light. Something else is walking too.</div>
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
          color="#552233"
          emissive="#ff3355"
          emissiveIntensity={0.6}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
}

function Level7Sim({ gameState, wallsRef, playerPosRef, onWallHit }) {
  const hitRef = useRef(false);
  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') { hitRef.current = false; return; }
    if (hitRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);

    const [px, py, pz] = playerPosRef.current;

    for (const w of wallsRef.current) {
      // Reverse direction at edges of `range`
      const startX = w.startX ?? (w.startX = w.x);
      w.x += w.vx * delta;
      if (Math.abs(w.x - startX) > w.range) {
        w.vx *= -1;
        w.x = startX + Math.sign(w.x - startX) * w.range;
      }
      // AABB death check
      if (
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

export default Level7;
