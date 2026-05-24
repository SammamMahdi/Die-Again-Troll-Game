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
import { goalPlatformColor } from '../utils/palette';
import './Level.css';

const PLAYER_HALF = 0.5;
// Stepping platforms in L7 are pure white. The lantern catches white better
// than the prior light-blue tone, so the path you can walk on reads clearly
// once it enters the lantern's bubble.
const COLOR_PATH = [0.98, 0.98, 1.0];
// Lantern level: pure-white gate reads as a final beacon at the end of the
// dark hallway. Platform stays nearly white (goalPlatformColor pastels it).
const JEWEL_HEX  = '#ffffff';
const COLOR_GOAL = goalPlatformColor(JEWEL_HEX);

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

  // Phase 3 side-branch: violet stone at (6, 0, -8), inside the safe z gap
  // between wall sweeps z=-12 and z=-4. Jump sideways off the stepping
  // stone at (0, 0, -6) to reach it. Portal sits here.
  blocks.push({
    x: 6, y: 0, z: -8, w: 3, h: 1, d: 3,
    visible: true, color: [0.45, 0.32, 0.6],
  });
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

// Lantern the player carries.
//
//   pointLight    — illuminates a sphere of light around the player. Linear
//                   decay so the whole bubble is bright, not falling to zero
//                   too quickly.
//   spotLight     — floods directly downward onto the platform so the floor
//                   you're standing on is obvious. Its `target` is mounted as
//                   a sibling Object3D and the spotLight is wired to it
//                   imperatively — without that, three.js leaves the target
//                   at world origin and the cone aims toward (0,0,0).
// Platform top in L7 is y=0.5 and the player's center sits ~y=1.0 when
// grounded, so any py above ~1.3 means the player is in the air.
const GROUNDED_Y = 1.0;
const AIR_THRESHOLD = 0.3;        // py - GROUNDED_Y above this counts as airborne
const AIR_FULL = 1.6;             // py - GROUNDED_Y at/above this is fully lit
const POINT_MAX = 6;              // peak point-light intensity while airborne
const SPOT_MAX = 5;               // peak spot-light intensity while airborne
const GROUND_FLOOR = 0.25;        // dim residual glow when grounded
const LERP_SPEED = 8.0;           // 1/seconds — smooth ramp up/down

function PlayerFlashlight({ playerPosRef }) {
  const pointRef = useRef();
  const spotRef = useRef();
  const targetRef = useRef();
  // Smoothed airborne factor (0 = grounded, 1 = fully in the air).
  const airRef = useRef(0);

  useFrame((_, deltaRaw) => {
    const dt = Math.min(deltaRaw, 0.05);
    const [px, py, pz] = playerPosRef.current || [0, 0, 0];

    // Raw airborne: linearly ramps from 0 at AIR_THRESHOLD to 1 at AIR_FULL.
    const altitude = Math.max(0, py - GROUNDED_Y);
    let targetAir;
    if (altitude < AIR_THRESHOLD) targetAir = 0;
    else if (altitude > AIR_FULL) targetAir = 1;
    else targetAir = (altitude - AIR_THRESHOLD) / (AIR_FULL - AIR_THRESHOLD);

    // Lerp toward target so the torch doesn't blink on/off frame-to-frame.
    const k = 1 - Math.exp(-LERP_SPEED * dt);
    airRef.current += (targetAir - airRef.current) * k;

    // Compose final intensities: a tiny floor + the airborne ramp.
    const air = airRef.current;
    const pointI = GROUND_FLOOR + (POINT_MAX - GROUND_FLOOR) * air;
    const spotI  = GROUND_FLOOR + (SPOT_MAX  - GROUND_FLOOR) * air;

    if (pointRef.current) {
      pointRef.current.position.set(px, py + 0.6, pz);
      pointRef.current.intensity = pointI;
    }
    if (spotRef.current && targetRef.current) {
      // Spot follows the player vertically, so the downward cone tracks
      // them through the apex of every jump.
      spotRef.current.position.set(px, py + 4, pz);
      spotRef.current.intensity = spotI;
      if (spotRef.current.target !== targetRef.current) {
        spotRef.current.target = targetRef.current;
      }
      targetRef.current.position.set(px, py - 6, pz);
      targetRef.current.updateMatrixWorld();
    }
  });

  return (
    <>
      {/* Tight white bubble — distance halved vs. the old always-on
          lantern. Intensity is driven per-frame from the airborne ramp
          above, so this is a "torch that flares while you jump". */}
      <pointLight
        ref={pointRef}
        intensity={GROUND_FLOOR}
        distance={6}
        decay={1.0}
        color="#ffffff"
      />
      {/* Downward white flood — also distance-clamped so the lit pool
          is a tight circle around the player rather than a level-wide
          spotlight. */}
      <spotLight
        ref={spotRef}
        angle={0.85}
        penumbra={0.5}
        intensity={GROUND_FLOOR}
        distance={7}
        decay={1.0}
        color="#ffffff"
      />
      <object3D ref={targetRef} />
    </>
  );
}


const __l7_fresh = buildLevel7();
const JEWEL_CANDIDATES = candidatesFromBlocks(
  Array.isArray(__l7_fresh) ? __l7_fresh : __l7_fresh.blocks
);

function Level7({ deathCount, onDeath, onComplete, onPortalEnter, startPositionOverride }) {
  const q = useGraphics();
  const { portalEligible, portalAlwaysSpawn, paused, teleportRequest } = useRunStats();
  const [portalSpawned] = useState(() => portalEligible && (portalAlwaysSpawn || Math.random() < 0.35));
  const sideQuestCompleteRef = useRef(false);
  const START = startPositionOverride || [ 0, 5, 30 ];
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(START);

  const initial = useRef(buildLevel7());
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const wallsRef = useRef(buildSlidingWalls());
  const playerPosRef = useRef(START);

  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  useEffect(() => {
    if (teleportRequest && teleportRequest.pos && playerControlRef.current?.teleportTo) {
      playerControlRef.current.teleportTo(teleportRequest.pos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teleportRequest?.signal]);

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
    playerPosRef.current = START;
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
      const t = setTimeout(() => onComplete({ complete: sideQuestCompleteRef.current }), 1500);
      return () => clearTimeout(t);
    }
  }, [gameState, onComplete]);

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [20, 14, 40], fov: 60 }}
        style={{
          background: 'linear-gradient(180deg, #000004 0%, #000010 100%)',
          touchAction: 'none',
        }}
      >
        {/* Fog is measured CAMERA → fragment, not player → fragment. The
            camera trails the player at CAM_DIST≈40, so anything in front of
            the player sits ~38-46 units from the camera. We have to push
            fog NEAR past the camera-to-player distance, otherwise the
            lantern's brightly-lit floor gets fog-blended to black BEFORE
            it reaches your eyes — that was the "lantern only works when
            the camera is close to a surface" bug. */}
        <fog attach="fog" args={['#000000', 38, q.l7FogFar]} />
        {/* Slightly stronger baseline so the white platforms catch a hint
            of light at the lantern's edge — bright enough to read as
            "there is a platform there", dim enough to keep the dread. */}
        <ambientLight intensity={0.28} color="#2a3a60" />
        <hemisphereLight args={['#3a4870', '#000010', 0.35]} />

        {/* Player-following flashlight (gameplay-essential — never disabled).
            Bright pure-white pool that reveals the white tiles directly
            beneath and around the player. */}
        <PlayerFlashlight playerPosRef={playerPosRef} />

        {/* Star field — only mounts at High preset (QualityStars returns null
            when starsScale=0). drei <Stars> uses its own shader that isn't
            fog-attenuated, so the stars stay crisp against the pitch-black
            void even though everything else in L7 fades to fog. */}
        <QualityStars radius={180} depth={60} count={2200} factor={4} saturation={0} fade speed={0.4} />

        <QualitySparkles position={[0, 3, -32]} count={28} scale={[8, 4, 4]} size={2.2} speed={0.3} color="#ffd966" />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? JEWEL_HEX : '#5fb8ff'}
            // No self-emissive on path tiles — they should be VISIBLE because
            // the torch is lighting them, not because they're glowing on
            // their own. Goal keeps a small emissive so it's recognisable
            // from a distance.
            emissiveBoost={b.isGoal ? 0.12 : 0}
          />
        ))}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} jewelColor={JEWEL_HEX} />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {/* L7 side branch: violet stone at (6, 0, -8), in the wall-free z gap.
            Portal faces -X back toward the main lantern path. */}
        {portalSpawned && (
          <Portal
            position={[6, 0.5, -8]}
            rotationY={Math.PI / 2}
            playerPosRef={playerPosRef}
            onEnter={(pos) => {
              if (onPortalEnter) onPortalEnter(pos);
              else sideQuestCompleteRef.current = true;
            }}
          />
        )}

        {/* Sliding walls — rendered + tracked */}
        {wallsRef.current.map((w, i) => (
          <SlidingWall key={`${restartKey}-wall-${i}`} wall={w} />
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

        <Level7Sim
          gameState={paused ? 'paused' : gameState}
          wallsRef={wallsRef}
          playerPosRef={playerPosRef}
          onWallHit={() => handlePlayerDeath('Crushed in the dark!')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.25} bloomThreshold={0.55} vignette={0.6} hue={0} />
      </QualityCanvas>

      <HUD
        level={7}
        deathCount={deathCount}
        gameState={paused ? 'paused' : gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Walk toward the light. Something else is walking too.</div>
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
        {/* No self-emissive — the walls are deep red but only become visible
            once the player's torch radius lands on them. Outside the lantern
            bubble they should blend into the void. */}
        <meshStandardMaterial
          color="#882233"
          emissiveIntensity={0}
          roughness={0.5}
          metalness={0.2}
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
