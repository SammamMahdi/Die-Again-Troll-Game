import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import QualityCanvas from '../components/QualityCanvas';
import QualityStars from '../components/QualityStars';
import QualitySparkles from '../components/QualitySparkles';
import { useGraphics } from '../components/GraphicsProvider';
import Player from '../components/Player';
import Globe from '../components/Globe';
import AnimatedBlock from '../components/AnimatedBlock';
import Gate from '../components/Gate';
import InfiniteGrid from '../components/InfiniteGrid';
import JewelField from '../components/JewelField';
import Portal from '../components/Portal';
import { useRunStats } from '../components/RunStatsContext';
import { candidatesFromBlocks } from '../utils/jewelCandidates';
import HUD from '../components/HUD';
import CameraController from '../components/CameraController';
import ScenePostFX from '../components/ScenePostFX';
import { playLightRed, playLightBlue, playCreak } from '../utils/sounds';
import { goalPlatformColor } from '../utils/palette';
import './Level.css';

// Mechanics constants (mirror level2.py)
const BLOCK_SIZE = 4;
const GAP_SIZE = 3;
const STEP_SIZE = BLOCK_SIZE + GAP_SIZE;
const BLUE_DURATION = 5.0;
const RED_DURATION = 3.0;
const CYCLE = BLUE_DURATION + RED_DURATION;
const GLOBE_HOVER_HEIGHT = 15.0;
const GLOBE_SCALE = 3.0;
const GLOBE_RADIUS = GLOBE_SCALE / 2.0;
const GLOBE_CHASE_SPEED = 5.0;
const PLAYER_HALF = 0.5;
const MOVE_EPSILON = 0.015; // per-frame XZ delta that counts as "moving"

const COLOR_FLOOR = [0.78, 0.78, 0.85];
// Goal platform tinted to match the jewel for visual cohesion.
const JEWEL_HEX = '#ff6fb5';
const COLOR_GOAL = goalPlatformColor(JEWEL_HEX);

function buildLevel2() {
  const blocks = [];
  const startZ = 25;
  for (let i = 0; i < 10; i++) {
    const z = startZ - (i * STEP_SIZE);
    const isGoal = i === 9;
    const moveX = i === 3 || i === 5;
    const moveY = i === 6;
    const breakable = i === 8;
    blocks.push({
      index: i,
      x: 0, y: 0, z,
      startX: 0, startY: 0, startZ: z,
      w: BLOCK_SIZE, h: 1, d: BLOCK_SIZE,
      visible: true,
      color: isGoal ? [...COLOR_GOAL] : [...COLOR_FLOOR],
      isGoal,
      moveX,
      moveY,
      breakable,
      stepped: false,
      breakTimer: 0,
      falling: false,
      fallSpeed: 0,
      moveTimer: 0,
    });
  }
  return blocks;
}

function buildGlobes() {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const x = (Math.random() * 20) - 10;     // [-10, 10]
    const z = (Math.random() * 50) - 30;     // [-30, 20]
    out.push({
      startX: x,
      startZ: z,
      x,
      y: GLOBE_HOVER_HEIGHT,
      z,
      state: 'BLUE',
      chasing: false,
      radius: GLOBE_RADIUS,
    });
  }
  return out;
}

// Module-level precompute: jewel candidate positions float above every
// landable block in the initial layout. <JewelField> random-subsets these
// on each level entry.
const JEWEL_CANDIDATES = candidatesFromBlocks(buildLevel2());

function Level2({ deathCount, onDeath, onComplete }) {
  const q = useGraphics();
  const { portalEligible } = useRunStats();
  const [portalSpawned] = useState(() => portalEligible && Math.random() < 0.35);
  const sideQuestCompleteRef = useRef(false);
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [globeStateLabel, setGlobeStateLabel] = useState('BLUE');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState([0, 3, 25]);

  // Mutable simulation state — never put in React state to avoid re-render storms
  const blocksRef = useRef(buildLevel2());
  const globesRef = useRef(buildGlobes());
  const cycleTimerRef = useRef(0);
  const playerPosRef = useRef([0, 3, 25]);
  const lastPlayerPosRef = useRef([0, 3, 25]);
  const isMovingRef = useRef(false);
  const onGroundRef = useRef(false);
  const currentBlockIndexRef = useRef(-1);

  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  const handlePlayerDeath = (reason) => {
    if (gameState !== 'playing') return;
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handleRestart = () => {
    // Mutate the existing mutable objects in place so AnimatedBlock / Globe
    // components keep their refs valid; only state values are reset.
    const fresh = buildLevel2();
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh[i]));
    const freshG = buildGlobes();
    globesRef.current.forEach((g, i) => Object.assign(g, freshG[i]));

    cycleTimerRef.current = 0;
    isMovingRef.current = false;
    onGroundRef.current = false;
    currentBlockIndexRef.current = -1;
    lastPlayerPosRef.current = [0, 3, 25];
    playerPosRef.current = [0, 3, 25];

    setGlobeStateLabel('BLUE');
    setPlayerPosition([0, 3, 25]);
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
  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlayerUpdate = (pos, blockIdx) => {
    playerPosRef.current = pos;
    currentBlockIndexRef.current = blockIdx;
    setPlayerPosition(pos);

    const [lx, , lz] = lastPlayerPosRef.current;
    const dx = pos[0] - lx;
    const dz = pos[2] - lz;
    isMovingRef.current = Math.sqrt(dx * dx + dz * dz) > MOVE_EPSILON;
    lastPlayerPosRef.current = pos;

    // We don't have direct access to Player's on_ground state; approximate by
    // "is the player currently colliding with a known block index?" This is
    // close enough for the Red-Light / Green-Light trigger.
    onGroundRef.current = blockIdx >= 0;

    // Mark the breakable block as stepped on
    if (blockIdx === 8 && blocksRef.current[8]) {
      if (!blocksRef.current[8].stepped) playCreak();
      blocksRef.current[8].stepped = true;
    }

    // Win condition: stand on goal block
    if (blockIdx === 9 && gameState === 'playing') {
      setGameState('won');
    }
  };

  useEffect(() => {
    if (gameState === 'won') {
      const t = setTimeout(() => onComplete({ complete: sideQuestCompleteRef.current }), 1500);
      return () => clearTimeout(t);
    }
  }, [gameState, onComplete]);

  const goalBlock = blocksRef.current[9];

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [30, 20, 40], fov: 60 }}
        style={{
          background: 'linear-gradient(180deg, #190a18 0%, #2a1a3e 100%)',
          touchAction: 'none',
        }}
      >
        <fog attach="fog" args={['#1f0f30', 45, 180]} />
        <ambientLight intensity={0.45} />
        <hemisphereLight args={['#9fb8ff', '#5a2050', 0.45]} />
        <directionalLight position={[15, 25, 10]} intensity={1.0} />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 14, -10]} intensity={0.6} color="#ff7755" distance={80} />
            <pointLight position={[0, 4, -38]} intensity={0.45} color="#ffd055" distance={24} />
          </>
        )}

        <QualityStars radius={200} depth={70} count={2400} factor={4} saturation={0} fade speed={0.7} />

        <QualitySparkles
          position={[0, 3, -38]}
          count={45}
          scale={[8, 5, 4]}
          size={3.5}
          speed={0.4}
          color="#ffd966"
        />

        <InfiniteGrid />

        {/* Blocks */}
        {blocksRef.current.map((b, i) => {
          let edgeColor = '#7fdaff';  // default cool cyan
          if (b.isGoal) edgeColor = JEWEL_HEX;                  // goal outline matches the jewel
          else if (b.moveX || b.moveY) edgeColor = '#ff6fb5';   // hot pink for moving platforms
          else if (b.breakable) edgeColor = '#ff8855';          // amber for the breakable
          return (
            <AnimatedBlock
              key={`${restartKey}-block-${i}`}
              block={b}
              emissiveBoost={b.isGoal ? 0.22 : (b.moveX || b.moveY ? 0.25 : 0)}
              edgeColor={edgeColor}
            />
          );
        })}

        {/* Goal gate sitting on top of the goal block */}
        {goalBlock && (
          <Gate position={[goalBlock.x, goalBlock.y + 0.5, goalBlock.z]} jewelColor={JEWEL_HEX} />
        )}

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {portalSpawned && (
          <Portal
            position={[0, 0.5, -10]}
            playerPosRef={playerPosRef}
            onEnter={() => { sideQuestCompleteRef.current = true; }}
          />
        )}

        {/* Globes */}
        {globesRef.current.map((g, i) => (
          <Globe key={`${restartKey}-globe-${i}`} globe={g} />
        ))}

        {/* Player — gate is null so Player's win-by-gate check is inert */}
        <Player
          key={restartKey}
          startPosition={[0, 3, 25]}
          blocks={blocksRef.current}
          gate={null}
          onDeath={handlePlayerDeath}
          onWin={() => {}}
          onUpdate={handlePlayerUpdate}
          onGateTrigger={() => {}}
          gameState={gameState}
          mobileControlRef={playerControlRef}
        />

        <Level2Sim
          gameState={gameState}
          blocksRef={blocksRef}
          globesRef={globesRef}
          cycleTimerRef={cycleTimerRef}
          playerPosRef={playerPosRef}
          isMovingRef={isMovingRef}
          onGroundRef={onGroundRef}
          onGlobeHit={() => handlePlayerDeath('Crushed by a Globe!')}
          onLightChange={(state) => {
            setGlobeStateLabel(state);
            if (state === 'RED') playLightRed(); else playLightBlue();
          }}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.5} hue={0.04} />
      </QualityCanvas>

      <HUD
        level={2}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {/* Stoplight indicator */}
      {gameState === 'playing' && (
        <div className="light-indicator">
          <span
            className={`light-dot ${globeStateLabel === 'RED' ? 'light-red' : 'light-blue'}`}
          />
          <span className="light-label">
            {globeStateLabel === 'RED' ? 'RED — STAND STILL!' : 'BLUE — Safe to move'}
          </span>
        </div>
      )}

    </div>
  );
}

function Level2Sim({
  gameState, blocksRef, globesRef, cycleTimerRef,
  playerPosRef, isMovingRef, onGroundRef,
  onGlobeHit, onLightChange,
}) {
  const lastStateRef = useRef('BLUE');
  const hitRef = useRef(false);

  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') {
      hitRef.current = false;
      return;
    }
    if (hitRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);

    cycleTimerRef.current += delta;
    const cyclePos = cycleTimerRef.current % CYCLE;
    const state = cyclePos < BLUE_DURATION ? 'BLUE' : 'RED';
    if (state !== lastStateRef.current) {
      lastStateRef.current = state;
      onLightChange(state);
    }

    const [px, py, pz] = playerPosRef.current;

    // Globe simulation
    for (const g of globesRef.current) {
      g.state = state;
      if (state === 'BLUE') {
        g.chasing = false;
      } else if (isMovingRef.current && onGroundRef.current) {
        g.chasing = true;
      }
      if (g.chasing && state === 'RED' && isMovingRef.current) {
        const dx = px - g.x;
        const dy = py - g.y;
        const dz = pz - g.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 0) {
          g.x += (dx / d) * GLOBE_CHASE_SPEED * delta;
          g.y += (dy / d) * GLOBE_CHASE_SPEED * delta;
          g.z += (dz / d) * GLOBE_CHASE_SPEED * delta;
        }
      }
      // Player collision
      const cx = px - g.x;
      const cy = py - g.y;
      const cz = pz - g.z;
      if (Math.sqrt(cx * cx + cy * cy + cz * cz) < (g.radius + PLAYER_HALF)) {
        hitRef.current = true;
        onGlobeHit();
        return;
      }
    }

    // Block simulation
    for (const b of blocksRef.current) {
      b.moveTimer = (b.moveTimer || 0) + delta;
      if (b.moveX) {
        b.x = b.startX + Math.sin(b.moveTimer * 0.8) * 3.5;
      }
      if (b.moveY) {
        b.y = b.startY + Math.sin(b.moveTimer * 1.5) * 2.5;
      }
      if (b.breakable && b.stepped && !b.falling) {
        b.breakTimer = (b.breakTimer || 0) + delta;
        const t = b.breakTimer;
        const gb = Math.max(0.0, 0.8 - t * 0.4);
        b.color = [1.0, gb, gb];
        if (t > 2.0) {
          b.falling = true;
          b.fallSpeed = 0;
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

export default Level2;
