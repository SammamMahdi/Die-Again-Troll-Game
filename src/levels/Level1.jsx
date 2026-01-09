import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import Player from '../components/Player';
import Block from '../components/Block';
import Gate from '../components/Gate';
import InfiniteGrid from '../components/InfiniteGrid';
import HUD from '../components/HUD';
import CameraController from '../components/CameraController';
import SequenceManager from '../components/SequenceManager';
import MobileControls from '../components/MobileControls';
import './Level.css';

function Level1({ deathCount, onDeath, onComplete, onRestart }) {
  const [gameState, setGameState] = useState('playing'); // 'playing', 'dead', 'won'
  const [deathReason, setDeathReason] = useState('');
  const [blocks, setBlocks] = useState([]);
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
  
  // Mobile controls refs
  const [isMobile, setIsMobile] = useState(false);
  const cameraControlRef = useRef(null);
  const playerControlRef = useRef(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                   || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
      <Canvas
        camera={{ position: [30, 20, 40], fov: 60 }}
        style={{ background: 'linear-gradient(180deg, #0c0c19 0%, #1a1a2e 100%)' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[0, 10, 0]} intensity={0.5} />

        <InfiniteGrid />
        
        {/* Render blocks */}
        {blocks.map((block, index) => {
          if (!block.visible) return null;
          
          // Dynamic color based on sequence state (like Python version)
          let displayColor = block.color;
          if (block.index >= 0 && block.index <= 4) {
            const idx = block.index;
            if (sequenceState > idx + 1) {
              displayColor = [0.3, 0.6, 0.3]; // Greenish for passed blocks
            } else if (sequenceState === idx + 1) {
              displayColor = [0.9, 0.9, 0.2]; // Yellowish for current target block
            } else {
              displayColor = [0.5, 0.5, 0.5]; // Gray for upcoming blocks
            }
          }
          
          return (
            <Block
              key={index}
              position={[block.x, block.y, block.z]}
              size={[block.w, block.h, block.d]}
          mobileControls={isMobile ? mobileControlsRef.current : null}
              color={displayColor}
            />
          );
        })}

        {/* Render gate */}
        {gate.visible && (
          <Gate position={[gate.x, gate.y + 2.5, gate.z]} />
        )}

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
      </Canvas>

      <HUD
        level={1}
        deathCount={deathCount}
        gameState={gameState}
        deathReason={deathReason}
        onRestart={handleRestart}
      />
      
      {/* Mobile Controls */}
      {isMobile && (
        <MobileControls
          enabled={gameState === 'playing'}
          onCameraMove={(deltaX, deltaY) => {
            if (cameraControlRef.current) {
              cameraControlRef.current.rotate(deltaX, deltaY);
            }
          }}
          onMove={(direction, pressed) => {
            if (playerControlRef.current) {
              playerControlRef.current.setMove(direction, pressed);
            }
          }}
          onJump={(pressed) => {
            if (playerControlRef.current) {
              playerControlRef.current.setJump(pressed);
            }
          }}
        />
      )}
    </div>
  );
}

export default Level1;
