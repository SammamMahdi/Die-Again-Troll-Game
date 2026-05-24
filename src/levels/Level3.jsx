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
import { playSonar } from '../utils/sounds';
import './Level.css';

// Mechanics constants (mirror level3.py)
const REVEAL_DURATION = 0.8;      // seconds the sonar pulse stays active
const ICE_FRICTION = 0.98;
const PLAYER_HALF = 0.5;

// Block "types" purely for color/material picking — physics is governed by
// per-block fields (friction, collidable, solid, kill).
const T_NORMAL      = 'normal';
const T_ICE         = 'ice';
const T_GHOST       = 'ghost';
const T_GHOST_ICE   = 'ghost_ice';
const T_KILL        = 'kill';
const T_FAKE        = 'fake';
const T_BLINK       = 'blink';
const T_MOVING_KILL = 'moving_kill';

const COLORS = {
  [T_NORMAL]:      [0.72, 0.74, 0.82],
  [T_ICE]:         [0.55, 0.85, 1.0],
  [T_GHOST]:       [0.35, 0.55, 0.7],
  [T_GHOST_ICE]:   [0.5, 0.85, 1.0],
  [T_KILL]:        [0.95, 0.15, 0.15],
  [T_FAKE]:        [0.72, 0.74, 0.82], // looks identical to normal — the trick
  [T_BLINK]:       [0.2, 0.85, 0.9],
  [T_MOVING_KILL]: [0.7, 0.1, 0.85],
};

function makeBlock(opts) {
  const {
    type, x, y, z, w, h, d,
    moveAxis = 'x', moveRange = 0, moveSpeed = 2.0,
    phaseOffset = 0,
  } = opts;
  const isGhost = type === T_GHOST || type === T_GHOST_ICE;
  const isIce = type === T_ICE || type === T_GHOST_ICE;
  const isFake = type === T_FAKE;
  const isKill = type === T_KILL || type === T_MOVING_KILL;
  const isBlink = type === T_BLINK;
  return {
    type, x, y, z, w, h, d,
    startX: x, startY: y, startZ: z,
    color: [...COLORS[type]],
    // Visibility starts:
    //   ghost variants are hidden by default until sonar reveals them
    //   blink starts visible
    visible: !isGhost,
    // Collidable:
    //   ghosts are always collidable (solid even when invisible)
    //   blinks toggle their collidability with visibility
    collidable: isGhost ? true : undefined,
    // Solid:
    //   fakes look real but you fall through them
    //   kill blocks are passed through; lethal check is in Level3Sim
    solid: (isFake || isKill) ? false : true,
    // Physics:
    friction: isIce ? ICE_FRICTION : undefined,
    // Per-type runtime state
    isKill,
    isBlink,
    isMoving: type === T_MOVING_KILL,
    blinkTimer: 0,
    blinkPhaseOffset: phaseOffset,
    moveTimer: 0,
    moveAxis,
    moveRange,
    moveSpeed,
  };
}

function buildLevel3() {
  return [
    // 1. Start platform (above the rest, so player drops onto it)
    makeBlock({ type: T_NORMAL, x: 0, y: 0, z: 5, w: 4, h: 1, d: 6 }),

    // 2. Ice slope intro
    makeBlock({ type: T_ICE, x: 0, y: -1, z: -2, w: 4, h: 1, d: 8 }),

    // 3. Ghost-ice zigzag bridge (5 platforms, x alternates ±2)
    makeBlock({ type: T_GHOST_ICE, x:  2, y: -1, z: -10, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST_ICE, x: -2, y: -1, z: -14, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST_ICE, x:  2, y: -1, z: -18, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST_ICE, x: -2, y: -1, z: -22, w: 3, h: 1, d: 3 }),
    makeBlock({ type: T_GHOST_ICE, x:  2, y: -1, z: -26, w: 3, h: 1, d: 3 }),

    // 4. Safe haven
    makeBlock({ type: T_NORMAL, x: 0, y: -1, z: -30, w: 6, h: 1, d: 4 }),

    // Phase 3 side-branch: violet stone off the safe haven, sideways jump
    // off the +X edge. Portal sits here.
    makeBlock({ type: T_NORMAL, x: 8, y: -1, z: -30, w: 3, h: 1, d: 3 }),

    // 5. Timing trap: two blinking bridges out of phase + a moving kill cube
    makeBlock({ type: T_BLINK,       x: 0, y: -1,   z: -36, w: 2, h: 1, d: 4, phaseOffset: 0.0 }),
    makeBlock({ type: T_MOVING_KILL, x: 0, y: 0.5,  z: -36, w: 1, h: 1, d: 1, moveRange: 2.5, moveSpeed: 2.0 }),
    makeBlock({ type: T_BLINK,       x: 0, y: -1,   z: -41, w: 2, h: 1, d: 4, phaseOffset: 1.5 }),

    // 6. Fake-out fork
    makeBlock({ type: T_NORMAL, x:  0, y: -1, z: -46, w: 6, h: 1, d: 4 }),
    makeBlock({ type: T_FAKE,   x: -3, y: -1, z: -52, w: 2, h: 1, d: 6 }),
    makeBlock({ type: T_GHOST,  x:  3, y: -1, z: -52, w: 2, h: 1, d: 2 }),
    makeBlock({ type: T_GHOST,  x:  3, y: -1, z: -55, w: 2, h: 1, d: 2 }),

    // 7. Goal platform + gate at (0, -0.5, -60)
    makeBlock({ type: T_NORMAL, x: 0, y: -1, z: -60, w: 10, h: 1, d: 6 }),
  ];
}

const GATE = { x: 0, y: -0.5, z: -60 };
const WIN_RADIUS = 3.0;

// Module-level jewel candidates derived once from the initial layout.
const __l3_fresh = buildLevel3();
const JEWEL_CANDIDATES = candidatesFromBlocks(
  Array.isArray(__l3_fresh) ? __l3_fresh : __l3_fresh.blocks
);

function Level3({ deathCount, onDeath, onComplete, onPortalEnter, startPositionOverride }) {
  const q = useGraphics();
  const { portalEligible, portalAlwaysSpawn, paused, teleportRequest } = useRunStats();
  const [portalSpawned] = useState(() => portalEligible && (portalAlwaysSpawn || Math.random() < 0.35));
  const sideQuestCompleteRef = useRef(false);
  // Extra spaces inside the literal so the per-level replace_all that
  // swaps `[0, Y, Z]` → `START` leaves this default initializer alone.
  const START = startPositionOverride || [ 0, 5, 5 ];
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [sonarActive, setSonarActive] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  // Mutable simulation state
  const blocksRef = useRef(buildLevel3());
  const playerPosRef = useRef(START);
  const sonarTimerRef = useRef(0);
  const sonarPressedRef = useRef(false);

  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  useEffect(() => {
    if (teleportRequest && teleportRequest.pos && playerControlRef.current?.teleportTo) {
      playerControlRef.current.teleportTo(teleportRequest.pos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teleportRequest?.signal]);

  // Track SPACE press for sonar pulse (in addition to its jump function in Player)
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' || e.key === ' ') sonarPressedRef.current = true;
    };
    const up = (e) => {
      if (e.code === 'Space' || e.key === ' ') sonarPressedRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const handlePlayerDeath = (reason) => {
    if (gameState !== 'playing') return;
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handleRestart = () => {
    const fresh = buildLevel3();
    // Replace fields in place so existing AnimatedBlock refs stay valid.
    // Length should be the same; if not (shouldn't happen), fall back to swap.
    if (blocksRef.current.length === fresh.length) {
      blocksRef.current.forEach((b, i) => Object.assign(b, fresh[i]));
    } else {
      blocksRef.current = fresh;
    }
    sonarTimerRef.current = 0;
    sonarPressedRef.current = false;
    playerPosRef.current = START;
    setSonarActive(false);
    setPlayerPosition(START);
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

  const handlePlayerUpdate = (pos /*, blockIdx */) => {
    playerPosRef.current = pos;
    setPlayerPosition(pos);
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
        camera={{ position: [30, 18, 35], fov: 60 }}
        style={{
          background: 'linear-gradient(180deg, #06101e 0%, #163455 55%, #4a7ab0 100%)',
          touchAction: 'none',
        }}
      >
        <fog attach="fog" args={['#1a3050', 35, 170]} />
        <ambientLight intensity={0.5} color="#c8dbff" />
        <hemisphereLight args={['#dbe9ff', '#0c1830', 0.55]} />
        <directionalLight position={[15, 25, 10]} intensity={1.0} color="#e8f2ff" />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 8, -36]} intensity={0.8} color="#9affff" distance={28} />
            <pointLight position={[0, 5, -60]} intensity={0.45} color="#ffd055" distance={24} />
          </>
        )}

        <QualityStars radius={200} depth={70} count={2200} factor={4} saturation={0} fade speed={0.5} />

        {/* Frost flurries above the path */}
        <QualitySparkles position={[0, 4, -25]} count={80} scale={[14, 6, 70]} size={2.5} speed={0.25} color="#c8efff" />

        {/* Goal glow */}
        <QualitySparkles position={[0, 3, -60]} count={26} scale={[8, 5, 4]} size={2.2} speed={0.3} color="#ffd966" />

        <InfiniteGrid />

        {/* Blocks — pick a renderer per type */}
        {blocksRef.current.map((b, i) => {
          const isGhost = b.type === T_GHOST || b.type === T_GHOST_ICE;
          const isIce = b.type === T_ICE || b.type === T_GHOST_ICE;
          const isBlink = b.type === T_BLINK;

          // Per-type neon outline (skipped for ghosts — wireframe IS the outline)
          let edgeColor = '#82eaff';                            // default normal: cool cyan
          if (b.type === T_ICE)         edgeColor = '#a0f0ff';  // bright icy cyan
          else if (b.type === T_BLINK)  edgeColor = '#66ffe0';  // teal pulse
          else if (b.type === T_MOVING_KILL) edgeColor = '#ff44ff'; // hot magenta
          // T_FAKE intentionally uses the same cyan as normal — that's the trick

          return (
            <AnimatedBlock
              key={`${restartKey}-block-${i}`}
              block={b}
              wireframe={isGhost}
              emissiveBoost={isBlink ? 0.55 : (isGhost ? 0.35 : (isIce ? 0.18 : 0))}
              metalness={isIce ? 0.4 : 0.08}
              roughness={isIce ? 0.22 : 0.6}
              edgeColor={isGhost ? null : edgeColor}
            />
          );
        })}

        {/* Goal gate */}
        <Gate position={[GATE.x, GATE.y, GATE.z]} jewelColor="#82eaff" />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {/* L3 side branch: violet stone at (8, -1, -30) off the safe haven.
            Portal faces -X back toward the main safe-haven block. */}
        {portalSpawned && (
          <Portal
            position={[8, -0.5, -30]}
            rotationY={Math.PI / 2}
            playerPosRef={playerPosRef}
            onEnter={(pos) => {
              if (onPortalEnter) onPortalEnter(pos);
              else sideQuestCompleteRef.current = true;
            }}
          />
        )}

        {/* Player */}
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

        <Level3Sim
          gameState={paused ? 'paused' : gameState}
          blocksRef={blocksRef}
          playerPosRef={playerPosRef}
          sonarTimerRef={sonarTimerRef}
          sonarPressedRef={sonarPressedRef}
          onKill={(reason) => handlePlayerDeath(reason)}
          onWin={() => setGameState('won')}
          onSonarChange={(active) => {
            setSonarActive(active);
            if (active) playSonar();
          }}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.4} hue={-0.04} />
      </QualityCanvas>

      <HUD
        level={3}
        deathCount={deathCount}
        gameState={paused ? 'paused' : gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {/* Sonar indicator badge */}
      {gameState === 'playing' && (
        <div className="light-indicator">
          <span className={`light-dot ${sonarActive ? 'light-sonar' : 'light-blue'}`} />
          <span className="light-label">
            {sonarActive ? 'SONAR ACTIVE' : 'SPACE — Jump & Sonar Pulse'}
          </span>
        </div>
      )}

    </div>
  );
}

function Level3Sim({
  gameState, blocksRef, playerPosRef,
  sonarTimerRef, sonarPressedRef,
  onKill, onWin, onSonarChange,
}) {
  const lastSonarRef = useRef(false);
  const hitRef = useRef(false);
  const wonRef = useRef(false);

  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') {
      hitRef.current = false;
      wonRef.current = false;
      return;
    }
    if (hitRef.current || wonRef.current) return;
    const delta = Math.min(deltaRaw, 0.05);

    // ----- Sonar pulse -----
    if (sonarPressedRef.current) {
      sonarTimerRef.current = REVEAL_DURATION;
    } else if (sonarTimerRef.current > 0) {
      sonarTimerRef.current = Math.max(0, sonarTimerRef.current - delta);
    }
    const sonarActive = sonarTimerRef.current > 0;
    if (sonarActive !== lastSonarRef.current) {
      lastSonarRef.current = sonarActive;
      onSonarChange(sonarActive);
    }

    const [px, py, pz] = playerPosRef.current;

    // ----- Per-block updates -----
    for (const b of blocksRef.current) {
      // Ghost visibility follows the sonar pulse; collidable stays true.
      if (b.type === T_GHOST || b.type === T_GHOST_ICE) {
        b.visible = sonarActive;
      }

      // Blink blocks: 1.5s on, 1.5s off, with per-block phase offset.
      if (b.isBlink) {
        b.blinkTimer = (b.blinkTimer || 0) + delta;
        const cyclePos = (b.blinkTimer + (b.blinkPhaseOffset || 0)) % 3.0;
        const on = cyclePos < 1.5;
        b.visible = on;
        b.collidable = on ? undefined : false; // when off, also non-collidable
        b.solid = on ? true : false;
      }

      // Moving kill: oscillate along its axis.
      if (b.isMoving) {
        b.moveTimer = (b.moveTimer || 0) + delta;
        const offset = Math.sin(b.moveTimer * (b.moveSpeed || 2.0)) * (b.moveRange || 2.5);
        if (b.moveAxis === 'x') b.x = b.startX + offset;
        else if (b.moveAxis === 'z') b.z = b.startZ + offset;
        else if (b.moveAxis === 'y') b.y = b.startY + offset;
      }

      // Kill check (static or moving) — only when visible
      if (b.isKill && b.visible !== false) {
        const dxPlayer = Math.abs(px - b.x);
        const dyPlayer = Math.abs(py - b.y);
        const dzPlayer = Math.abs(pz - b.z);
        if (
          dxPlayer < (b.w / 2 + PLAYER_HALF) &&
          dyPlayer < (b.h / 2 + PLAYER_HALF) &&
          dzPlayer < (b.d / 2 + PLAYER_HALF)
        ) {
          hitRef.current = true;
          onKill(b.isMoving ? 'Smashed by a Moving Block!' : 'Touched a Lethal Block!');
          return;
        }
      }
    }

    // ----- Win check -----
    const dxG = px - GATE.x;
    const dzG = pz - GATE.z;
    if (Math.sqrt(dxG * dxG + dzG * dzG) < WIN_RADIUS && py > GATE.y - 2) {
      wonRef.current = true;
      onWin();
    }
  });

  return null;
}

export default Level3;
