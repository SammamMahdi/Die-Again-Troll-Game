import React, { useRef, useState, useEffect, useMemo } from 'react';
import QualityCanvas from '../components/QualityCanvas';
import QualityStars from '../components/QualityStars';
import QualitySparkles from '../components/QualitySparkles';
import { useGraphics } from '../components/GraphicsProvider';
import Player from '../components/Player';
import Block from '../components/Block';
import Gate from '../components/Gate';
import InfiniteGrid from '../components/InfiniteGrid';
import JewelField from '../components/JewelField';
import { candidatesFromBlocks } from '../utils/jewelCandidates';
import HUD from '../components/HUD';
import CameraController from '../components/CameraController';
import SequenceManager from '../components/SequenceManager';
import ScenePostFX from '../components/ScenePostFX';
import { playTeleport } from '../utils/sounds';
import './Level.css';

function Level1({ deathCount, onDeath, onComplete, onRestart }) {
  const q = useGraphics();
  const [gameState, setGameState] = useState('playing'); // 'playing', 'dead', 'won'
  const [deathReason, setDeathReason] = useState('');
  const [blocks, setBlocks] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [middleBlocks, setMiddleBlocks] = useState([]);
  const [gate, setGate] = useState({ x: 0, y: 1, z: 0, visible: true });
  
  // Sequence state management (like Python version)
  const [startTriggered, setStartTriggered] = useState(false);
  const [sequenceState, setSequenceState] = useState(0);
  const [vanishTimer, setVanishTimer] = useState(0);
  const [trapTimer, setTrapTimer] = useState(0);
  const [gateFloating, setGateFloating] = useState(false);
  const [gateAtStart, setGateAtStart] = useState(false);
  const [reverseVanishActive, setReverseVanishActive] = useState(false);
  const [reverseVanishTimer, setReverseVanishTimer] = useState(0);
  const [reverseVanishIndex, setReverseVanishIndex] = useState(4);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(-1);
  const [restartKey, setRestartKey] = useState(0);
  const [playerPosition, setPlayerPosition] = useState([0, 3, 20]);
  // Mirror as ref so jewel pickups can poll without forcing a re-render.
  const playerPosRef = useRef([0, 3, 20]);

  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  // JEWEL_CANDIDATES — derive from the level's static block layout once.
  // Random-subset spawning happens inside <JewelField>.
  const JEWEL_CANDIDATES = useMemo(() => candidatesFromBlocks(blocks), [blocks]);
  // (mobile detection removed — PC only)
  useEffect(() => {
    return () => {};
  }, []);

  // Level setup
  const PLANE_SIZE = 20;
  const BLOCK_SIZE = 4;
  const GAP_SIZE = 4;
  const STEP_SIZE = BLOCK_SIZE + GAP_SIZE;

  // Create blocks
  useEffect(() => {
    // Initialize blocks
    const blockList = [];
    const middleList = [];

    const startZ = 20;
    
    // Starting platform
    blockList.push({
      x: 0, y: 0, z: startZ,
      w: PLANE_SIZE, h: 1, d: PLANE_SIZE,
      visible: true, index: -1, color: [0.8, 0.8, 0.8]
    });

    // Middle blocks (5 stepping stones) - start as VISIBLE (they vanish when triggered)
    let currentZ = startZ - (PLANE_SIZE / 2) - (GAP_SIZE + BLOCK_SIZE / 2);
    for (let i = 0; i < 5; i++) {
      const block = {
        x: 0, y: 0, z: currentZ,
        w: BLOCK_SIZE, h: 1, d: BLOCK_SIZE,
        visible: true, // Start visible, will vanish when player triggers
        index: i, 
        color: [0.5, 0.5, 0.5]
      };
      blockList.push(block);
      middleList.push(block);
      currentZ -= STEP_SIZE;
    }

    // End platform
    const endPlaneZ = currentZ - (GAP_SIZE + PLANE_SIZE / 2 - BLOCK_SIZE / 2);
    blockList.push({
      x: 0, y: 0, z: endPlaneZ,
      w: PLANE_SIZE, h: 1, d: PLANE_SIZE,
      visible: true, index: -1, color: [0.8, 0.8, 0.8]
    });

    setBlocks(blockList);
    setMiddleBlocks(middleList);
    setGate({ x: 0, y: 1, z: endPlaneZ, visible: true, floatingAtStart: false });
    
    // Reset sequence state
    setStartTriggered(false);
    setSequenceState(0);
    setVanishTimer(0);
    setTrapTimer(0);
    setGateFloating(false);
    setGateAtStart(false);
    setReverseVanishActive(false);
    setReverseVanishTimer(0);
    setReverseVanishIndex(4);
    setCurrentBlockIndex(-1);
  }, [PLANE_SIZE, BLOCK_SIZE, GAP_SIZE, STEP_SIZE]);

  const handlePlayerDeath = (reason) => {
    setGameState('dead');
    setDeathReason(reason);
    onDeath();
  };

  const handlePlayerWin = () => {
    setGameState('won');
  };
  
  // Add keyboard listener for R key restart
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key.toLowerCase() === 'r' && gameState === 'dead') {
        handleRestart();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, PLANE_SIZE, BLOCK_SIZE, GAP_SIZE, STEP_SIZE]);

  const handleRestart = () => {
    // Reset game state
    setGameState('playing');
    setDeathReason('');
    
    // Reset all sequence state
    setStartTriggered(false);
    setSequenceState(0);
    setVanishTimer(0);
    setTrapTimer(0);
    setGateFloating(false);
    setGateAtStart(false);
    setReverseVanishActive(false);
    setReverseVanishTimer(0);
    setReverseVanishIndex(4);
    setCurrentBlockIndex(-1);
    
    // Recreate blocks
    const blockList = [];
    const middleList = [];
    const startZ = 20;
    
    blockList.push({
      x: 0, y: 0, z: startZ,
      w: PLANE_SIZE, h: 1, d: PLANE_SIZE,
      visible: true, index: -1, color: [0.8, 0.8, 0.8]
    });
    
    let currentZ = startZ - (PLANE_SIZE / 2) - (GAP_SIZE + BLOCK_SIZE / 2);
    for (let i = 0; i < 5; i++) {
      const block = {
        x: 0, y: 0, z: currentZ,
        w: BLOCK_SIZE, h: 1, d: BLOCK_SIZE,
        visible: true, index: i, color: [0.5, 0.5, 0.5]
      };
      blockList.push(block);
      middleList.push(block);
      currentZ -= STEP_SIZE;
    }
    
    const endPlaneZ = currentZ - (GAP_SIZE + PLANE_SIZE / 2 - BLOCK_SIZE / 2);
    blockList.push({
      x: 0, y: 0, z: endPlaneZ,
      w: PLANE_SIZE, h: 1, d: PLANE_SIZE,
      visible: true, index: -1, color: [0.8, 0.8, 0.8]
    });
    
    setBlocks(blockList);
    setMiddleBlocks(middleList);
    setGate({ x: 0, y: 1, z: endPlaneZ, visible: true, floatingAtStart: false });
    
    // Increment restart key to force Player component remount
    setRestartKey(prev => prev + 1);
  };
  
  // Callback for player position updates
  const handlePlayerUpdate = (playerPos, blockIdx) => {
    setPlayerPosition(playerPos);
    playerPosRef.current = playerPos;
    setCurrentBlockIndex(blockIdx);
    
    // Check if player crossed z=12 to trigger sequence
    if (!startTriggered && playerPos[2] < 12) {
      setStartTriggered(true);
      setVanishTimer(2.0); // 2 second delay before first block appears
      setSequenceState(1);
      
      // Hide all middle blocks
      setMiddleBlocks(prevMiddle => {
        return prevMiddle.map(b => ({ ...b, visible: false }));
      });
      setBlocks(prevBlocks => {
        return prevBlocks.map(b => {
          if (b.index >= 0 && b.index <= 4) {
            return { ...b, visible: false };
          }
          return b;
        });
      });
    }
  };
  
  // Callback for gate trigger
  const handleGateTrigger = () => {
    if (!gateFloating && !gateAtStart && gate) {
      setGateFloating(true);
      // Teleport gate to start position
      setGate(prev => ({ ...prev, z: 20, floatingAtStart: true }));
      setGateAtStart(true);
      playTeleport();
    }
  };

  // Victory timer
  useEffect(() => {
    if (gameState === 'won') {
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState, onComplete]);

  return (
    <div className="level-container">
      <QualityCanvas
        camera={{ position: [30, 20, 40], fov: 60 }}
        style={{ background: 'linear-gradient(180deg, #05051a 0%, #160c3e 55%, #3a1f6a 100%)', touchAction: 'none' }}
      >
        <fog attach="fog" args={['#100a26', 45, 200]} />
        <ambientLight intensity={0.4} />
        <hemisphereLight args={['#b8c4ff', '#150b30', 0.55]} />
        <directionalLight position={[12, 22, 8]} intensity={1.1} color="#dde6ff" />
        {!q.minimalLights && (
          <>
            <pointLight position={[-25, 14, 5]} intensity={0.6} color="#7a90ff" distance={80} />
            <pointLight position={[0, 4, -28]} intensity={0.9} color="#ffc245" distance={32} />
            <pointLight position={[0, 6, 20]} intensity={0.45} color="#a0c0ff" distance={28} />
          </>
        )}

        <QualityStars radius={180} depth={60} count={2200} factor={4} saturation={0} fade speed={0.6} />

        <QualitySparkles
          position={[0, 3, -28]}
          count={45}
          scale={[8, 5, 4]}
          size={3.5}
          speed={0.35}
          color="#ffd966"
        />

        <InfiniteGrid />

        {/* Render blocks */}
        {blocks.map((block, index) => {
          if (!block.visible) return null;

          // Dynamic color + neon edge per sequence-state phase
          let displayColor = block.color;
          let edgeColor = '#7fe9ff';      // default cyan platform outline
          let emissive = 0;
          if (block.index >= 0 && block.index <= 4) {
            const idx = block.index;
            if (sequenceState > idx + 1) {
              displayColor = [0.3, 0.7, 0.4];      // Passed: green
              edgeColor = '#5fff9c';
              emissive = 0.35;
            } else if (sequenceState === idx + 1) {
              displayColor = [1.0, 0.95, 0.25];    // Current target: bright yellow
              edgeColor = '#ffe14a';
              emissive = 0.9;                       // strong glow draws the eye
            } else {
              displayColor = [0.55, 0.55, 0.65];   // Upcoming: muted gray
              edgeColor = '#8a8ab8';
              emissive = 0.05;
            }
          }

          return (
            <Block
              key={index}
              position={[block.x, block.y, block.z]}
              size={[block.w, block.h, block.d]}
              color={displayColor}
              edgeColor={edgeColor}
              emissiveIntensity={emissive}
            />
          );
        })}

        {/* Render gate */}
        {gate.visible && (
          <Gate position={[gate.x, 0.5, gate.z]} jewelColor="#ffe14a" />
        )}

        <JewelField
          key={`jewels-${restartKey}`}
          candidates={JEWEL_CANDIDATES}
          playerPosRef={playerPosRef}
        />

        {/* Player */}
        <Player
          key={restartKey}
          startPosition={[0, 3, 20]}
          blocks={blocks}
          gate={gate}
          onDeath={handlePlayerDeath}
          onWin={handlePlayerWin}
          onUpdate={handlePlayerUpdate}
          onGateTrigger={handleGateTrigger}
          gameState={gameState}
          mobileControlRef={playerControlRef}
        />

        <SequenceManager
          gameState={gameState}
          startTriggered={startTriggered}
          sequenceState={sequenceState}
          setSequenceState={setSequenceState}
          vanishTimer={vanishTimer}
          setVanishTimer={setVanishTimer}
          trapTimer={trapTimer}
          setTrapTimer={setTrapTimer}
          currentBlockIndex={currentBlockIndex}
          gateFloating={gateFloating}
          gateAtStart={gateAtStart}
          reverseVanishActive={reverseVanishActive}
          setReverseVanishActive={setReverseVanishActive}
          reverseVanishTimer={reverseVanishTimer}
          setReverseVanishTimer={setReverseVanishTimer}
          reverseVanishIndex={reverseVanishIndex}
          setReverseVanishIndex={setReverseVanishIndex}
          setMiddleBlocks={setMiddleBlocks}
          setBlocks={setBlocks}
        />

        <CameraController
          target={playerPosition}
          cameraControlRef={cameraControlRef}
        />

        <ScenePostFX bloomIntensity={1.3} hue={0} />
      </QualityCanvas>

      <HUD
        level={1}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />
      
    </div>
  );
}

export default Level1;
