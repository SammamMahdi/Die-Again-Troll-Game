import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import QualityCanvas from '../components/QualityCanvas';
import QualityStars from '../components/QualityStars';
import QualitySparkles from '../components/QualitySparkles';
import { useGraphics } from '../components/GraphicsProvider';
import Player from '../components/Player';
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
import { playFall, playLaunch, playWarning } from '../utils/sounds';
import { goalPlatformColor } from '../utils/palette';
import './Level.css';

// Block "types" — matches level4.py
const T_SAFE      = 'safe';        // blue — looks safe (may be a disguised trapdoor)
const T_TRAPDOOR  = 'trapdoor';    // red — obvious trapdoor
const T_ILLUSION  = 'illusion';    // gray, flickering — no collision
const T_LAUNCHER  = 'launcher';    // orange — flings you on landing
const T_GOAL      = 'goal';

const COLOR_SAFE     = [0.32, 0.42, 0.95];
const COLOR_TRAPDOOR = [0.85, 0.22, 0.22];
const COLOR_ILLUSION = [0.55, 0.55, 0.65];
const COLOR_LAUNCHER = [1.0, 0.55, 0.05];
const JEWEL_HEX      = '#ffaa44';                       // orange theme
const COLOR_GOAL     = goalPlatformColor(JEWEL_HEX);    // pastel orange platform

const DISGUISED_TRAPDOOR_CHANCE = 0.3;

function rand(min, max) { return Math.random() * (max - min) + min; }

function makeBlock({ x, z, type, w = 4, h = 1, d = 4 }) {
  // 40% chance for a "safe" block to actually be a disguised trapdoor
  const isDisguised = type === T_SAFE && Math.random() < DISGUISED_TRAPDOOR_CHANCE;
  const actualType = isDisguised ? T_TRAPDOOR : type;
  const displayColor = type === T_SAFE ? COLOR_SAFE :
                       type === T_ILLUSION ? COLOR_ILLUSION :
                       type === T_LAUNCHER ? COLOR_LAUNCHER :
                       type === T_GOAL ? COLOR_GOAL :
                       COLOR_TRAPDOOR;

  return {
    type: actualType,
    displayType: type,     // what it LOOKS like
    isDisguised,
    x, y: 0, z,
    startX: x, startY: 0, startZ: z,
    w, h, d,
    visible: true,
    // Illusions are non-solid; launchers and trapdoors stay solid until fallen
    solid: actualType !== T_ILLUSION,
    isLauncher: actualType === T_LAUNCHER,
    isTrapdoor: actualType === T_TRAPDOOR,
    isIllusion: actualType === T_ILLUSION,
    isGoal: actualType === T_GOAL,
    color: [...displayColor],
    // Trapdoor state
    stepped: false,
    fallTimer: rand(2.2, 4.5),   // seconds before betrayal — eased
    warning: false,
    falling: false,
    fallSpeed: 0,
    // Launcher: pre-computed random launch vector per block (matches level4.py)
    launchVx: (Math.random() < 0.5 ? -1 : 1) * rand(20, 32),
    launchVy: rand(20, 26),
    launchVz: (Math.random() < 0.5 ? -1 : 1) * rand(20, 32),
    blinkTimer: 0,
  };
}

function buildLevel4() {
  // Layout straight from level4.py
  const layout = [
    [0, 40, T_SAFE, 8, 1, 8],     // big start platform
    [0, 30, T_SAFE],
    [-6, 24, T_SAFE],
    [-6, 18, T_TRAPDOOR],         // obvious red trapdoor
    [0, 12, T_ILLUSION],
    [6, 12, T_SAFE],

    [12, 6, T_LAUNCHER],
    [12, 0, T_SAFE],
    [6, -6, T_SAFE],
    [0, -12, T_ILLUSION],
    [-6, -12, T_SAFE],

    [-12, -18, T_LAUNCHER],
    [-12, -24, T_TRAPDOOR],
    [-6, -30, T_SAFE],
    [0, -36, T_SAFE],
    [6, -42, T_ILLUSION],
    [0, -42, T_SAFE],

    [0, -48, T_LAUNCHER],
    [0, -54, T_SAFE],
    [0, -60, T_SAFE],
    [0, -70, T_GOAL, 10, 1, 10],  // end goal platform
  ];

  return layout.map(([x, z, type, w, h, d]) => makeBlock({ x, z, type, w, h, d }));
}

const GATE = { x: 0, y: 0.5, z: -70 };

const __l4_fresh = buildLevel4();
const JEWEL_CANDIDATES = candidatesFromBlocks(
  Array.isArray(__l4_fresh) ? __l4_fresh : __l4_fresh.blocks
);

function Level4({ deathCount, onDeath, onComplete }) {
  const q = useGraphics();
  const { portalEligible } = useRunStats();
  const [portalSpawned] = useState(() => portalEligible && Math.random() < 0.35);
  const sideQuestCompleteRef = useRef(false);
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState([0, 5, 40]);

  const blocksRef = useRef(buildLevel4());
  const playerPosRef = useRef([0, 5, 40]);
  const prevBlockIdxRef = useRef(-1);

  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  const handlePlayerDeath = (reason) => {
    if (gameState !== 'playing') return;
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handleRestart = () => {
    const fresh = buildLevel4();
    // Replace in place to keep AnimatedBlock refs valid.
    if (blocksRef.current.length === fresh.length) {
      blocksRef.current.forEach((b, i) => Object.assign(b, fresh[i]));
    } else {
      blocksRef.current = fresh;
    }
    prevBlockIdxRef.current = -1;
    playerPosRef.current = [0, 5, 40];
    setPlayerPosition([0, 5, 40]);
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

  const handlePlayerUpdate = (pos, blockIdx) => {
    playerPosRef.current = pos;
    setPlayerPosition(pos);

    // Find which block index corresponds to blockIdx — Level4 doesn't use
    // sequence indices, so we have to derive it from the player position.
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
      if (cur) {
        // Trapdoor: start fall timer on first step
        if (cur.isTrapdoor) cur.stepped = true;
        // Launcher: launch immediately on transition
        if (cur.isLauncher && playerControlRef.current?.setLaunch) {
          playerControlRef.current.setLaunch(cur.launchVx, cur.launchVy, cur.launchVz);
          playLaunch();
        }
        // Goal: win on touch
        if (cur.isGoal && gameState === 'playing') setGameState('won');
      }
      prevBlockIdxRef.current = onIdx;
    }
  };

  useEffect(() => {
    if (gameState === 'won') {
      const t = setTimeout(() => onComplete({ complete: sideQuestCompleteRef.current }), 1500);
      return () => clearTimeout(t);
    }
  }, [gameState, onComplete]);

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [30, 20, 50], fov: 60 }}
        style={{
          background: 'linear-gradient(180deg, #050018 0%, #1a0530 55%, #3a0050 100%)',
          touchAction: 'none',
        }}
      >
        <fog attach="fog" args={['#150528', 45, 200]} />
        <ambientLight intensity={0.45} />
        <hemisphereLight args={['#a0a0ff', '#2a0030', 0.55]} />
        <directionalLight position={[15, 25, 10]} intensity={1.0} />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 8, 40]} intensity={0.5} color="#5577ff" distance={50} />
            <pointLight position={[0, 8, -70]} intensity={0.5} color="#ffd055" distance={26} />
          </>
        )}

        <QualityStars radius={200} depth={70} count={2400} factor={4} saturation={0} fade speed={0.6} />
        <QualitySparkles position={[0, 4, -70]} count={30} scale={[8, 5, 4]} size={2.2} speed={0.3} color="#ffd966" />

        <InfiniteGrid />

        {/* Blocks */}
        {blocksRef.current.map((b, i) => {
          let edgeColor = '#5cd9ff';
          if (b.displayType === T_TRAPDOOR) edgeColor = '#ff5555';
          else if (b.displayType === T_ILLUSION) edgeColor = '#aaaaaa';
          else if (b.displayType === T_LAUNCHER) edgeColor = '#ffaa44';
          else if (b.displayType === T_GOAL) edgeColor = JEWEL_HEX;
          return (
            <AnimatedBlock
              key={`${restartKey}-block-${i}`}
              block={b}
              edgeColor={edgeColor}
              emissiveBoost={b.isGoal ? 0.22 : (b.isLauncher ? 0.35 : (b.displayType === T_TRAPDOOR ? 0.25 : 0))}
            />
          );
        })}

        <Gate position={[GATE.x, GATE.y, GATE.z]} jewelColor={JEWEL_HEX} />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {portalSpawned && (
          <Portal
            position={[12, 0.5, 0]}
            playerPosRef={playerPosRef}
            onEnter={() => { sideQuestCompleteRef.current = true; }}
          />
        )}

        <Player
          key={restartKey}
          startPosition={[0, 5, 40]}
          blocks={blocksRef.current}
          gate={null}
          onDeath={handlePlayerDeath}
          onWin={() => {}}
          onUpdate={handlePlayerUpdate}
          onGateTrigger={() => {}}
          gameState={gameState}
          mobileControlRef={playerControlRef}
        />

        <Level4Sim
          gameState={gameState}
          blocksRef={blocksRef}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.35} hue={0.02} />
      </QualityCanvas>

      <HUD
        level={4}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Trust nothing. Blue might betray.</div>
      )}

    </div>
  );
}

function Level4Sim({ gameState, blocksRef }) {
  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') return;
    const delta = Math.min(deltaRaw, 0.05);

    for (const b of blocksRef.current) {
      b.blinkTimer = (b.blinkTimer || 0) + delta;

      // Illusion: gentle alpha flicker via emissive (visual hint that something's off)
      if (b.isIllusion) {
        const flicker = 0.4 + 0.2 * Math.sin(b.blinkTimer * 5);
        b.color = [COLOR_ILLUSION[0] * flicker, COLOR_ILLUSION[1] * flicker, COLOR_ILLUSION[2] * flicker];
      }

      // Trapdoor logic: stepped → tick down → warn (yellow blink last 1s) → fall
      if (b.isTrapdoor && b.stepped && !b.falling) {
        b.fallTimer -= delta;
        if (b.fallTimer <= 1.0) {
          // Warning flash: yellow strobes (sound once at the start of warning)
          if (!b.warning) playWarning();
          b.warning = true;
          if (Math.floor(b.blinkTimer * 8) % 2 === 0) {
            b.color = [1.0, 0.95, 0.2];
          } else if (b.isDisguised) {
            b.color = [...COLOR_SAFE];
          } else {
            b.color = [...COLOR_TRAPDOOR];
          }
        }
        if (b.fallTimer <= 0) {
          b.falling = true;
          b.fallSpeed = 0;
          b.solid = false;     // disable collision the moment it falls
          playFall();
        }
      }
      if (b.falling) {
        b.fallSpeed += 50 * delta;
        b.y -= b.fallSpeed * delta;
        if (b.y < -40) {
          b.visible = false;
        }
      }
    }
  });
  return null;
}

export default Level4;
