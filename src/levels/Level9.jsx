import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import QualityCanvas from '../components/QualityCanvas';
import QualityStars from '../components/QualityStars';
import QualitySparkles from '../components/QualitySparkles';
import { useGraphics } from '../components/GraphicsProvider';
import * as THREE from 'three';
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
import { playWindGust } from '../utils/sounds';
import { goalPlatformColor } from '../utils/palette';
import './Level.css';

const COLOR_PATH = [0.7, 0.78, 0.95];
const JEWEL_HEX  = '#88ddff';                       // wind-sky theme
const COLOR_GOAL = goalPlatformColor(JEWEL_HEX);    // pale sky-blue goal platform

function buildLevel9() {
  const blocks = [];
  // Eased: widened path slightly (2.5 → 3.2) so light gusts don't insta-kill.
  blocks.push({ x: 0, y: 0, z: 25, w: 8, h: 1, d: 6, visible: true, color: [...COLOR_PATH] });
  let z = 18;
  for (let i = 0; i < 8; i++) {
    blocks.push({
      x: 0, y: 0, z, w: 3.2, h: 1, d: 3.5, visible: true, color: [...COLOR_PATH],
    });
    z -= 6;
  }
  // Phase 3 side-branch: violet stone off the +X side at z=0 — mid-route,
  // outside the wind zones' x extent (zones are w=12 → x range ±6). Place
  // at x=10 so the player can hop sideways without being blown off.
  blocks.push({
    x: 10, y: 0, z: 0, w: 3, h: 1, d: 3,
    visible: true, color: [0.45, 0.32, 0.6],
  });
  blocks.push({ x: 0, y: 0, z: -32, w: 10, h: 1, d: 8, visible: true, color: [...COLOR_GOAL], isGoal: true });
  return { blocks, goal: { x: 0, y: 0.5, z: -32 } };
}

function buildWindZones() {
  // Eased: 5 zones with moderately strong gusts (was ±10/12 → ±7/9). Final
  // diagonal zone keeps its kicker but with a smaller Z component.
  return [
    { x: 0, y: 0, z: 15,  w: 12, h: 8, d: 8, dirX:  7, dirZ: 0,  freq: 1.7, phase: 0.0 },
    { x: 0, y: 0, z:  5,  w: 12, h: 8, d: 8, dirX: -8, dirZ: 0,  freq: 1.5, phase: 1.2 },
    { x: 0, y: 0, z:  -5, w: 12, h: 8, d: 8, dirX:  8, dirZ: 0,  freq: 1.9, phase: 0.6 },
    { x: 0, y: 0, z: -15, w: 12, h: 8, d: 8, dirX: -9, dirZ: 0,  freq: 1.7, phase: 2.0 },
    { x: 0, y: 0, z: -25, w: 12, h: 8, d: 8, dirX:  6, dirZ: 4,  freq: 2.0, phase: 0.4 },
  ];
}

function WindZoneVisual({ zone }) {
  const groupRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (groupRef.current) {
      groupRef.current.position.set(zone.x, zone.y + zone.h / 2, zone.z);
      // Pulse opacity based on current wind strength
      const strength = Math.max(0, Math.sin(t.current * zone.freq + zone.phase));
      groupRef.current.children.forEach(child => {
        if (child.material && child.material.transparent) {
          child.material.opacity = 0.12 + 0.22 * strength;
        }
      });
    }
  });
  // Wind direction visualized as semi-transparent box + horizontal streaks
  const color = zone.dirX > 0 ? '#88ddff' : '#ff99cc';
  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[zone.w, zone.h, zone.d]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Streak lines indicating wind direction */}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[zone.dirX > 0 ? -3 : 3, -2 + i * 2, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[6, 0.05, 0.05]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const __l9_fresh = buildLevel9();
const JEWEL_CANDIDATES = candidatesFromBlocks(
  Array.isArray(__l9_fresh) ? __l9_fresh : __l9_fresh.blocks
);

function Level9({ deathCount, onDeath, onComplete }) {
  const q = useGraphics();
  const { portalEligible, portalAlwaysSpawn } = useRunStats();
  const [portalSpawned] = useState(() => portalEligible && (portalAlwaysSpawn || Math.random() < 0.35));
  const sideQuestCompleteRef = useRef(false);
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState([0, 5, 25]);

  const initial = useRef(buildLevel9());
  const blocksRef = useRef(initial.current.blocks);
  const goalRef = useRef(initial.current.goal);
  const zonesRef = useRef(buildWindZones());
  const playerPosRef = useRef([0, 5, 25]);

  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  const handlePlayerDeath = (reason) => {
    if (gameState !== 'playing') return;
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handleRestart = () => {
    const fresh = buildLevel9();
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh.blocks[i]));
    goalRef.current = fresh.goal;
    zonesRef.current = buildWindZones();
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
      const t = setTimeout(() => onComplete({ complete: sideQuestCompleteRef.current }), 1500);
      return () => clearTimeout(t);
    }
  }, [gameState, onComplete]);

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [30, 18, 40], fov: 60 }}
        style={{
          background: 'linear-gradient(180deg, #00141a 0%, #023a4a 60%, #0a6080 100%)',
          touchAction: 'none',
        }}
      >
        <fog attach="fog" args={['#0a2a3a', 40, 180]} />
        <ambientLight intensity={0.5} color="#aaddff" />
        <hemisphereLight args={['#ccf0ff', '#001830', 0.55]} />
        <directionalLight position={[15, 25, 10]} intensity={1.0} color="#e8f8ff" />
        {!q.minimalLights && (
          <>
            <pointLight position={[0, 8, 0]} intensity={0.7} color="#88ccff" distance={50} />
            <pointLight position={[0, 5, -32]} intensity={0.45} color="#ffd055" distance={24} />
          </>
        )}

        <QualityStars radius={200} depth={70} count={2400} factor={4} saturation={0} fade speed={0.7} />
        <QualitySparkles position={[0, 3, -32]} count={28} scale={[8, 5, 4]} size={2.2} speed={0.3} color="#ffd966" />
        {/* Whipping wind particles across the level */}
        <QualitySparkles position={[0, 4, -5]} count={120} scale={[20, 8, 50]} size={1.5} speed={2.5} color="#cceeff" />

        <InfiniteGrid />

        {zonesRef.current.map((z, i) => (
          <WindZoneVisual key={`${restartKey}-zone-${i}`} zone={z} />
        ))}

        {blocksRef.current.map((b, i) => (
          <AnimatedBlock
            key={`${restartKey}-block-${i}`}
            block={b}
            edgeColor={b.isGoal ? JEWEL_HEX : '#7fdaff'}
            emissiveBoost={b.isGoal ? 0.22 : 0.05}
          />
        ))}

        <Gate position={[goalRef.current.x, goalRef.current.y, goalRef.current.z]} jewelColor={JEWEL_HEX} />

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {/* L9 side branch: violet stone at (10, 0, 0), outside both the wind
            zones' x extent and the z-gap between zones. */}
        {portalSpawned && (
          <Portal
            position={[10, 0.5, 0]}
            rotationY={Math.PI / 2}
            playerPosRef={playerPosRef}
            onEnter={() => { sideQuestCompleteRef.current = true; }}
          />
        )}

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

        <Level9Sim
          gameState={gameState}
          zonesRef={zonesRef}
          playerPosRef={playerPosRef}
          playerControlRef={playerControlRef}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.4} hue={-0.05} />
      </QualityCanvas>

      <HUD
        level={9}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">Lean into the wind. Watch the gusts.</div>
      )}

    </div>
  );
}

function Level9Sim({ gameState, zonesRef, playerPosRef, playerControlRef }) {
  const tRef = useRef(0);
  useFrame((_, deltaRaw) => {
    if (gameState !== 'playing') return;
    const delta = Math.min(deltaRaw, 0.05);
    tRef.current += delta;
    const [px, py, pz] = playerPosRef.current;

    for (const z of zonesRef.current) {
      // Track gust peak per-zone to play a whoosh sound at each crest
      const raw = Math.sin(tRef.current * z.freq + z.phase);
      const peaking = raw > 0.92;
      if (peaking && !z._peaking) playWindGust();
      z._peaking = peaking;

      // Inside the zone?
      if (Math.abs(px - z.x) > z.w / 2) continue;
      if (Math.abs(py - (z.y + z.h / 2)) > z.h / 2) continue;
      if (Math.abs(pz - z.z) > z.d / 2) continue;
      // Wind strength pulses (gust)
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

export default Level9;
