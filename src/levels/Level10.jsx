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
import ScenePostFX from '../components/ScenePostFX';
import { playPillarChime, playOrbSpawn, playGateUnlock } from '../utils/sounds';
import './Level.css';

// Composite arena: collect 3 pillars while a boss orb chases you. Once all
// pillars are touched, the central gate unlocks and you can finish.

const COLOR_PLATFORM = [0.7, 0.7, 0.85];
const COLOR_ICE = [0.55, 0.85, 1.0];
const COLOR_GOAL = [1.0, 0.84, 0.0];

function buildLevel10() {
  const blocks = [];

  // Central arena platform — TIGHTER than before so the chase has less room.
  blocks.push({
    x: 0, y: 0, z: 0, w: 20, h: 1, d: 20, visible: true,
    color: [...COLOR_PLATFORM],
  });

  // 4 outer corner platforms — also slightly smaller and closer.
  const corners = [
    [13, -13], [-13, -13], [13, 13], [-13, 13],
  ];
  for (const [cx, cz] of corners) {
    blocks.push({
      x: cx, y: 0, z: cz, w: 5, h: 1, d: 5, visible: true,
      color: [...COLOR_PLATFORM],
    });
  }

  // Ice bridges (friction 0.98) — narrower AND slightly longer.
  blocks.push({ x:  6.5, y: 0, z: -13, w: 5, h: 1, d: 1.8, visible: true, color: [...COLOR_ICE], friction: 0.98 });
  blocks.push({ x: -6.5, y: 0, z: -13, w: 5, h: 1, d: 1.8, visible: true, color: [...COLOR_ICE], friction: 0.98 });
  blocks.push({ x:  6.5, y: 0, z:  13, w: 5, h: 1, d: 1.8, visible: true, color: [...COLOR_ICE], friction: 0.98 });
  blocks.push({ x: -6.5, y: 0, z:  13, w: 5, h: 1, d: 1.8, visible: true, color: [...COLOR_ICE], friction: 0.98 });

  // Central goal pillar (small disc) — only collidable once all pillars touched
  blocks.push({
    x: 0, y: 0.5, z: 0, w: 4, h: 1, d: 4, visible: true,
    color: [...COLOR_GOAL], isGoal: true,
  });

  return { blocks };
}

function buildPillars() {
  // 3 colored pillars to touch — placed at 3 of the 4 corner platforms.
  return [
    { id: 0, x: 13,  y: 1.5, z: -13, color: '#ff5577', touched: false },
    { id: 1, x: -13, y: 1.5, z: -13, color: '#55ddff', touched: false },
    { id: 2, x: 0,   y: 1.5, z:  13, color: '#aaff66', touched: false },
  ];
}

function PillarVisual({ pillar }) {
  const ref = useRef();
  const matRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (ref.current) ref.current.rotation.y += delta * 0.8;
    if (matRef.current) {
      const pulse = pillar.touched ? 0.2 : 0.7 + 0.3 * Math.sin(t.current * 4);
      matRef.current.emissiveIntensity = pulse * (pillar.touched ? 0.6 : 1.2);
    }
  });
  return (
    <group ref={ref} position={[pillar.x, pillar.y, pillar.z]}>
      <mesh>
        <cylinderGeometry args={[0.6, 0.6, 3, 24]} />
        <meshStandardMaterial
          ref={matRef}
          color={pillar.color}
          emissive={pillar.color}
          emissiveIntensity={1.2}
          roughness={0.3}
          metalness={0.4}
          toneMapped={false}
        />
      </mesh>
      {!pillar.touched && (
        <Sparkles position={[0, 1.5, 0]} count={20} scale={[2, 4, 2]} size={2.5} speed={0.6} color={pillar.color} />
      )}
    </group>
  );
}

function ArchitectOrb({ orb }) {
  const ref = useRef();
  const haloRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (!ref.current) return;
    ref.current.position.set(orb.x, orb.y, orb.z);
    if (haloRef.current) {
      const pulse = 1 + 0.1 * Math.sin(t.current * 5);
      haloRef.current.scale.setScalar(pulse);
    }
  });
  return (
    <group ref={ref}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[orb.radius * 1.4, 24, 24]} />
        <meshBasicMaterial color="#ff2244" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[orb.radius, 32, 32]} />
        <meshStandardMaterial
          color="#ff2244"
          emissive="#ff2244"
          emissiveIntensity={1.6}
          roughness={0.3}
          metalness={0.4}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[orb.radius * 0.5, 16, 16]} />
        <meshBasicMaterial color="#ffaaaa" />
      </mesh>
    </group>
  );
}

function Level10({ deathCount, onDeath, onComplete }) {
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState([0, 5, 8]);
  const [pillarsTouched, setPillarsTouched] = useState(0);
  const [gateUnlocked, setGateUnlocked] = useState(false);

  const initial = useRef(buildLevel10());
  const blocksRef = useRef(initial.current.blocks);
  const pillarsRef = useRef(buildPillars());
  // The Architect itself is faster + larger than before. Pillar touches spawn
  // chaser orbs at ramped-up speeds. When the gate unlocks, an "executioner"
  // orb spawns at the centre — the final sprint is the most dangerous.
  const orbRef = useRef({ x: 0, y: 5, z: -10, radius: 1.75, speed: 5.0 });
  const extraOrbsRef = useRef([]);
  const playerPosRef = useRef([0, 5, 8]);

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
    const fresh = buildLevel10();
    blocksRef.current.forEach((b, i) => Object.assign(b, fresh.blocks[i]));
    pillarsRef.current = buildPillars();
    orbRef.current = { x: 0, y: 5, z: -10, radius: 1.75, speed: 5.0 };
    extraOrbsRef.current = [];
    playerPosRef.current = [0, 5, 8];
    setPlayerPosition([0, 5, 8]);
    setPillarsTouched(0);
    setGateUnlocked(false);
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
    // Pillar touch detection
    let newlyTouched = 0;
    for (const p of pillarsRef.current) {
      if (p.touched) continue;
      const dx = pos[0] - p.x;
      const dz = pos[2] - p.z;
      if (Math.sqrt(dx * dx + dz * dz) < 1.6) {
        p.touched = true;
        newlyTouched++;
        playPillarChime();
        // Spawn a chasing orb from the opposite corner. Each successive orb
        // is slightly faster than the previous one (you're being hunted by an
        // accelerating pack).
        const idx = extraOrbsRef.current.length;
        const spawnSide = idx % 2 === 0 ? 1 : -1;
        extraOrbsRef.current.push({
          x: spawnSide * 10,
          y: 5,
          z: -spawnSide * 10,
          radius: 1.25,
          speed: 5.6 + idx * 0.3,   // 5.6, 5.9, 6.2 for the three pillars
        });
        playOrbSpawn();
      }
    }
    if (newlyTouched > 0) {
      setPillarsTouched(prev => prev + newlyTouched);
    }
  };

  useEffect(() => {
    if (pillarsTouched >= 3 && !gateUnlocked) {
      setGateUnlocked(true);
      playGateUnlock();
      // The Architect's executioner: a fast, hungry orb that drops in at the
      // centre the moment the gate unlocks. Its job is to make the final
      // dash to the goal feel like a desperate sprint, not a victory lap.
      extraOrbsRef.current.push({
        x: 0,
        y: 9,
        z: 0,
        radius: 1.45,
        speed: 7.0,
      });
      playOrbSpawn();
    }
  }, [pillarsTouched, gateUnlocked]);

  useEffect(() => {
    if (!gateUnlocked) return;
    // Watch for goal touch once unlocked
    // (Done via player update — see below.)
  }, [gateUnlocked]);

  useEffect(() => {
    if (gameState === 'won') {
      const t = setTimeout(() => onComplete(), 1500);
      return () => clearTimeout(t);
    }
  }, [gameState, onComplete]);

  return (
    <div className="level-container">
      <Canvas
        camera={{ position: [25, 22, 25], fov: 60 }}
        style={{
          background: 'radial-gradient(circle at 50% 40%, #1a0040 0%, #050015 70%, #000005 100%)',
          touchAction: 'none',
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <fog attach="fog" args={['#100020', 40, 200]} />
        <ambientLight intensity={0.45} />
        <hemisphereLight args={['#aaaaff', '#1a0033', 0.45]} />
        <directionalLight position={[15, 25, 10]} intensity={0.9} />
        <pointLight position={[0, 12, 0]} intensity={1.0} color="#ffd066" distance={50} />
        <pointLight position={[16, 6, -16]} intensity={0.6} color="#ff5577" distance={20} />
        <pointLight position={[-16, 6, -16]} intensity={0.6} color="#55ddff" distance={20} />
        <pointLight position={[0, 6, 16]} intensity={0.6} color="#aaff66" distance={20} />

        <Stars radius={250} depth={80} count={3000} factor={5} saturation={0} fade speed={0.4} />
        <Sparkles position={[0, 5, 0]} count={70} scale={[14, 6, 14]} size={3.5} speed={0.25} color="#ffd966" />

        <InfiniteGrid />

        {blocksRef.current.map((b, i) => {
          const isIce = b.color === COLOR_ICE || (b.color && b.color[0] === COLOR_ICE[0]);
          return (
            <AnimatedBlock
              key={`${restartKey}-block-${i}`}
              block={b}
              edgeColor={b.isGoal ? (gateUnlocked ? '#ffd966' : '#444466') : (isIce ? '#a0f0ff' : '#7fdaff')}
              emissiveBoost={b.isGoal ? (gateUnlocked ? 0.3 : 0.1) : (isIce ? 0.2 : 0)}
              metalness={isIce ? 0.4 : 0.1}
              roughness={isIce ? 0.22 : 0.55}
            />
          );
        })}

        {/* Goal gate only renders/unlocks once all pillars touched */}
        {gateUnlocked && <Gate position={[0, 0.5, 0]} jewelColor="#ffd066" />}

        {pillarsRef.current.map(p => (
          <PillarVisual key={`${restartKey}-pillar-${p.id}`} pillar={p} />
        ))}

        <ArchitectOrb orb={orbRef.current} />
        {extraOrbsRef.current.map((o, i) => (
          <ArchitectOrb key={`${restartKey}-extra-orb-${i}`} orb={o} />
        ))}

        <Player
          key={restartKey}
          startPosition={[0, 5, 8]}
          blocks={blocksRef.current}
          gate={null}
          onDeath={handlePlayerDeath}
          onWin={() => {}}
          onUpdate={handlePlayerUpdate}
          onGateTrigger={() => {}}
          gameState={gameState}
          mobileControlRef={playerControlRef}
        />

        <Level10Sim
          gameState={gameState}
          orbRef={orbRef}
          extraOrbsRef={extraOrbsRef}
          playerPosRef={playerPosRef}
          gateUnlocked={gateUnlocked}
          onOrbHit={() => handlePlayerDeath('Consumed by the Architect!')}
          onWin={() => setGameState('won')}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.6} hue={0} />
      </Canvas>

      <HUD
        level={10}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">
          Pillars: <strong>{pillarsTouched}/3</strong>
          {gateUnlocked ? ' — return to the center!' : ' — keep running.'}
        </div>
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

function Level10Sim({ gameState, orbRef, extraOrbsRef, playerPosRef, gateUnlocked, onOrbHit, onWin }) {
  const hitRef = useRef(false);
  const wonRef = useRef(false);

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
    const [px, py, pz] = playerPosRef.current;

    // Primary orb
    if (stepOrb(orbRef.current, px, py, pz, delta)) {
      hitRef.current = true; onOrbHit(); return;
    }
    // Extra orbs spawned at pillar touches
    for (const o of extraOrbsRef.current) {
      if (stepOrb(o, px, py, pz, delta)) {
        hitRef.current = true; onOrbHit(); return;
      }
    }

    // Win check (only once gate is unlocked)
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

export default Level10;
