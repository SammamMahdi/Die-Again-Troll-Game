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

// Mirror mechanic: a "shadow" pawn is rendered at (-px, py, pz). Hazards
// (spikes) exist on the shadow's side — touching them with the shadow kills you.
// You have to move OPPOSITE your instincts: pulling LEFT moves the shadow RIGHT.

const PLAYER_HALF = 0.5;
const COLOR_PATH = [0.78, 0.78, 0.95];
const COLOR_GOAL = [1.0, 0.84, 0.0];

function buildLevel8() {
  const blocks = [];
  // NARROWER path than before so the player has less room to escape
  // mirror-side hazards by repositioning.
  blocks.push({ x: 0, y: 0, z: 25, w: 8, h: 1, d: 6, visible: true, color: [...COLOR_PATH] });
  for (let i = 0; i < 5; i++) {
    blocks.push({
      x: 0, y: 0, z: 18 - i * 7, w: 8, h: 1, d: 5,        // was 12 wide
      visible: true, color: [...COLOR_PATH],
    });
  }
  blocks.push({ x: 0, y: 0, z: -22, w: 8, h: 1, d: 6, visible: true, color: [...COLOR_GOAL], isGoal: true });
  return { blocks, goal: { x: 0, y: 0.5, z: -22 } };
}

function buildShadowHazards() {
  // Twice as many spikes — clustered to leave only narrow safe corridors.
  return [
    // First section
    { x:  3, y: 0.7, z: 18,  w: 1.6, h: 1.6, d: 1.6 },
    { x: -3, y: 0.7, z: 18,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  3, y: 0.7, z: 11,  w: 1.6, h: 1.6, d: 1.6 },
    { x: -3, y: 0.7, z: 11,  w: 1.6, h: 1.6, d: 1.6 },
    // Middle: tight clusters
    { x:  2, y: 0.7, z: 4,   w: 1.6, h: 1.6, d: 1.6 },
    { x: -2, y: 0.7, z: 4,   w: 1.6, h: 1.6, d: 1.6 },
    { x:  3, y: 0.7, z: -3,  w: 1.6, h: 1.6, d: 1.6 },
    { x: -3, y: 0.7, z: -3,  w: 1.6, h: 1.6, d: 1.6 },
    { x:  0, y: 0.7, z: -3,  w: 1.6, h: 1.6, d: 1.6 },
    // Late stretch
    { x:  2.5, y: 0.7, z: -10, w: 1.6, h: 1.6, d: 1.6 },
    { x: -2.5, y: 0.7, z: -10, w: 1.6, h: 1.6, d: 1.6 },
    { x:  0,   y: 0.7, z: -17, w: 1.6, h: 1.6, d: 1.6 },
    { x:  3,   y: 0.7, z: -17, w: 1.6, h: 1.6, d: 1.6 },
    { x: -3,   y: 0.7, z: -17, w: 1.6, h: 1.6, d: 1.6 },
  ];
}

function ShadowAvatar({ playerPosRef }) {
  const ref = useRef();
  const headRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (!ref.current) return;
    const [px, py, pz] = playerPosRef.current;
    ref.current.position.set(-px, py, pz);
    if (headRef.current) {
      const pulse = 0.7 + 0.3 * Math.sin(t.current * 3.0);
      headRef.current.material.emissiveIntensity = 0.6 + 0.4 * pulse;
    }
  });
  return (
    <group ref={ref}>
      <mesh position={[0, -0.4, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#cc4499" roughness={0.4} metalness={0.3} emissive="#aa3377" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.8, 16]} />
        <meshStandardMaterial color="#cc4499" emissive="#cc4499" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={headRef} position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color="#ff66cc" emissive="#ff66cc" emissiveIntensity={1.0} roughness={0.3} toneMapped={false} />
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
        emissive="#ff2244"
        emissiveIntensity={0.9}
        roughness={0.3}
        metalness={0.5}
        toneMapped={false}
      />
    </mesh>
  );
}

function Level8({ deathCount, onDeath, onComplete }) {
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState([0, 5, 25]);

  const initial = useRef(buildLevel8());
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const hazardsRef = useRef(buildShadowHazards());
  const playerPosRef = useRef([0, 5, 25]);

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
    const fresh = buildLevel8();
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh.blocks[i]));
    goalRef.current = fresh.goal;
    hazardsRef.current = buildShadowHazards();
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
        camera={{ position: [0, 18, 45], fov: 60 }}
        style={{
          background: 'linear-gradient(180deg, #100020 0%, #1c0440 60%, #4a1080 100%)',
          touchAction: 'none',
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <fog attach="fog" args={['#1a0830', 45, 200]} />
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#aaddff', '#330055', 0.5]} />
        <directionalLight position={[0, 25, 15]} intensity={1.0} color="#ddccff" />
        <pointLight position={[0, 8, 0]} intensity={0.7} color="#ff66ee" distance={45} />
        <pointLight position={[0, 5, -22]} intensity={0.9} color="#ffd055" distance={32} />

        <Stars radius={200} depth={70} count={2400} factor={4} saturation={0} fade speed={0.6} />
        <Sparkles position={[0, 3, -22]} count={45} scale={[10, 6, 4]} size={3.5} speed={0.35} color="#ffd966" />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? '#ffd966' : '#aaffff'}
            emissiveBoost={b.isGoal ? 0.55 : 0.05}
          />
        ))}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} />

        {hazardsRef.current.map((h, i) => (
          <ShadowSpike key={`${restartKey}-spike-${i}`} hazard={h} />
        ))}

        <ShadowAvatar playerPosRef={playerPosRef} />

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

        <Level8Sim
          gameState={gameState}
          hazardsRef={hazardsRef}
          playerPosRef={playerPosRef}
          onShadowHit={() => handlePlayerDeath('Your shadow was impaled!')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />
      </Canvas>

      <HUD
        level={8}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Your shadow mirrors you. Don't stab it.</div>
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

function Level8Sim({ gameState, hazardsRef, playerPosRef, onShadowHit }) {
  const hitRef = useRef(false);
  useFrame(() => {
    if (gameState !== 'playing') { hitRef.current = false; return; }
    if (hitRef.current) return;
    const [px, py, pz] = playerPosRef.current;
    const sx = -px, sy = py, sz = pz;
    for (const h of hazardsRef.current) {
      if (
        Math.abs(sx - h.x) < h.w / 2 + PLAYER_HALF &&
        Math.abs(sy - h.y) < h.h / 2 + PLAYER_HALF &&
        Math.abs(sz - h.z) < h.d / 2 + PLAYER_HALF
      ) {
        hitRef.current = true;
        onShadowHit();
        return;
      }
    }
  });
  return null;
}

export default Level8;
