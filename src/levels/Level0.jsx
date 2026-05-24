import React, { useRef, useState, useEffect } from 'react';
import { Text } from '@react-three/drei';
import QualityCanvas from '../components/QualityCanvas';
import QualityStars from '../components/QualityStars';
import { useGraphics } from '../components/GraphicsProvider';
import Player from '../components/Player';
import Block from '../components/Block';
import Gate from '../components/Gate';
import InfiniteGrid from '../components/InfiniteGrid';
import HUD from '../components/HUD';
import CameraController from '../components/CameraController';
import ScenePostFX from '../components/ScenePostFX';
import './Level.css';

// Tutorial level — teaches WASD / SPACE / camera / R-to-retry through
// floating 3D text labels next to each platform. No coins, no side-quest,
// no medal. Just on-ramp.

const PLATFORMS = [
  { x: 0, y: 0, z: 12,  w: 8, h: 1, d: 8,
    label: 'WASD to walk',
    sub: 'Move toward the next platform' },
  { x: 0, y: 0, z: 2,   w: 4, h: 1, d: 4,
    label: 'SPACE to jump',
    sub: 'The gap is small — hop across' },
  { x: 0, y: 0, z: -8,  w: 4, h: 1, d: 4,
    label: 'Arrow keys or mouse to rotate',
    sub: 'Look around the world' },
  { x: 0, y: 0, z: -18, w: 8, h: 1, d: 8,
    label: 'Reach the gate to finish',
    sub: 'Fall off? Press R to retry' },
];

const GATE = { x: 0, y: 0.5, z: -18 };

function Level0({ deathCount, onDeath, onComplete }) {
  const q = useGraphics();
  const [gameState, setGameState] = useState('playing');
  const [deathReason, setDeathReason] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState([0, 3, 12]);

  const blocks = PLATFORMS.map((p, i) => ({
    x: p.x, y: p.y, z: p.z,
    w: p.w, h: p.h, d: p.d,
    visible: true, index: i,
    color: [0.78, 0.82, 0.95],
  }));

  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  const handlePlayerDeath = (reason) => {
    if (gameState !== 'playing') return;
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handlePlayerWin = () => {
    if (gameState === 'won') return;
    setGameState('won');
  };

  const handleRestart = () => {
    setDeathReason('');
    setGameState('playing');
    setPlayerPosition([0, 3, 12]);
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
    setPlayerPosition(pos);
    // Win when the player lands on the final platform near the gate.
    const dx = pos[0] - GATE.x;
    const dz = pos[2] - GATE.z;
    if (gameState === 'playing' && Math.sqrt(dx * dx + dz * dz) < 3.5 && pos[1] < 2.5) {
      handlePlayerWin();
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
      <QualityCanvas
        camera={{ position: [20, 14, 30], fov: 60 }}
        style={{
          background: 'linear-gradient(180deg, #060720 0%, #11163a 55%, #1f2a5a 100%)',
          touchAction: 'none',
        }}
      >
        <fog attach="fog" args={['#060720', 60, 220]} />
        <ambientLight intensity={0.5} color="#cfd8ff" />
        <hemisphereLight args={['#c8d4ff', '#0a0e22', 0.65]} />
        <directionalLight position={[12, 22, 8]} intensity={1.0} color="#dde6ff" />

        <QualityStars radius={180} depth={60} count={1600} factor={3.5} saturation={0} fade speed={0.4} />

        <InfiniteGrid />

        {/* Platforms */}
        {blocks.map((b, i) => (
          <Block
            key={i}
            position={[b.x, b.y, b.z]}
            size={[b.w, b.h, b.d]}
            color={b.color}
            edgeColor="#9ec8ff"
            emissiveIntensity={0.05}
          />
        ))}

        {/* Floating teaching labels above each platform. drei <Text> uses
            an SDF font so it stays crisp at every camera distance. */}
        {PLATFORMS.map((p, i) => (
          <group key={`label-${i}`} position={[p.x, p.y + 3.2, p.z]}>
            <Text
              fontSize={0.55}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.04}
              outlineColor="#06061a"
              fillOpacity={1}
            >
              {p.label}
            </Text>
            <Text
              position={[0, -0.55, 0]}
              fontSize={0.32}
              color="#9ec8ff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.025}
              outlineColor="#06061a"
              fillOpacity={0.85}
            >
              {p.sub}
            </Text>
          </group>
        ))}

        {/* White beacon gate at the end. */}
        <Gate position={[GATE.x, GATE.y, GATE.z]} jewelColor="#ffffff" />

        <Player
          key={restartKey}
          startPosition={[0, 3, 12]}
          blocks={blocks}
          gate={null}
          onDeath={handlePlayerDeath}
          onWin={() => {}}
          onUpdate={handlePlayerUpdate}
          onGateTrigger={() => {}}
          gameState={gameState}
          mobileControlRef={playerControlRef}
        />

        <CameraController target={playerPosition} cameraControlRef={cameraControlRef} />

        <ScenePostFX bloomIntensity={1.1} hue={0} vignette={0.4} />
        {/* `q` is read so the import isn't unused — graphics preset affects
            QualityCanvas internally and we may add quality-aware decoration
            here later. */}
        {q.id && null}
      </QualityCanvas>

      <HUD
        level={0}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />

      {gameState === 'playing' && (
        <div className="level-tagline">A short walk. Just learn the steps.</div>
      )}
    </div>
  );
}

export default Level0;
