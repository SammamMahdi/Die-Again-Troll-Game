import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { cameraYawRef } from './CameraController';

// Physics constants
const GRAVITY = -45.0;
const JUMP_FORCE = 22.0;
const PLAYER_SPEED = 40.0;
const FRICTION = 0.90;
const AIR_RESISTANCE = 0.98;

function Player({ startPosition, blocks, gate, onDeath, onWin, onUpdate, onGateTrigger, gameState }) {
  const meshRef = useRef();
  const [position, setPosition] = useState(startPosition);
  const [velocity, setVelocity] = useState([0, 0, 0]);
  const [onGround, setOnGround] = useState(false);
  
  const keysPressed = useRef({});

  useEffect(() => {
    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    if (!blocks || blocks.length === 0) return; // Wait for blocks to be ready

    const keys = keysPressed.current;
    let [px, py, pz] = position;
    let [vx, vy, vz] = velocity;

    // Apply movement relative to camera direction
    const camYawRad = (cameraYawRef.current * Math.PI) / 180;
    const fx = -Math.cos(camYawRad);
    const fz = -Math.sin(camYawRad);
    const rx = -fz;
    const rz = fx;
    
    let ax = 0, az = 0;
    if (keys['w']) { ax += fx; az += fz; }
    if (keys['s']) { ax -= fx; az -= fz; }
    if (keys['a']) { ax -= rx; az -= rz; }
    if (keys['d']) { ax += rx; az += rz; }

    const length = Math.sqrt(ax * ax + az * az);
    if (length > 0) {
      ax /= length;
      az /= length;
      vx += ax * PLAYER_SPEED * delta;
      vz += az * PLAYER_SPEED * delta;
    }

    // Apply friction
    vx *= onGround ? FRICTION : AIR_RESISTANCE;
    vz *= onGround ? FRICTION : AIR_RESISTANCE;

    // Apply gravity
    vy += GRAVITY * delta;

    // Jump
    if (keys[' '] && onGround) {
      vy = JUMP_FORCE;
      setOnGround(false);
    }

    // Apply velocity
    px += vx * delta;
    py += vy * delta;
    pz += vz * delta;

    // Collision detection
    let newOnGround = false;
    let currentBlockIndex = -1;
    const playerBox = {
      minX: px - 0.5, maxX: px + 0.5,
      minY: py - 0.5, maxY: py + 0.5,
      minZ: pz - 0.5, maxZ: pz + 0.5
    };

    blocks.forEach(block => {
      if (!block.visible) return;

      const blockBox = {
        minX: block.x - block.w / 2, maxX: block.x + block.w / 2,
        minY: block.y - block.h / 2, maxY: block.y + block.h / 2,
        minZ: block.z - block.d / 2, maxZ: block.z + block.d / 2
      };

      // Check collision
      if (
        playerBox.maxX > blockBox.minX && playerBox.minX < blockBox.maxX &&
        playerBox.maxY > blockBox.minY && playerBox.minY < blockBox.maxY &&
        playerBox.maxZ > blockBox.minZ && playerBox.minZ < blockBox.maxZ
      ) {
        // Calculate overlap on each axis
        const overlapX = Math.min(playerBox.maxX - blockBox.minX, blockBox.maxX - playerBox.minX);
        const overlapY = Math.min(playerBox.maxY - blockBox.minY, blockBox.maxY - playerBox.minY);
        const overlapZ = Math.min(playerBox.maxZ - blockBox.minZ, blockBox.maxZ - playerBox.minZ);

        // Resolve collision on the axis with smallest overlap
        if (overlapY < overlapX && overlapY < overlapZ) {
          // Vertical collision
          if (py > block.y) {
            // Hitting from above (landing on platform)
            py = block.y + block.h / 2 + 0.5;
            vy = 0;
            newOnGround = true;
            // Track which block player is on
            if (block.index >= 0) {
              currentBlockIndex = block.index;
            }
          } else {
            // Hitting from below
            py = block.y - block.h / 2 - 0.5;
            vy = 0;
          }
        } else if (overlapX < overlapZ) {
          // X-axis collision
          if (px > block.x) {
            px = block.x + block.w / 2 + 0.5;
          } else {
            px = block.x - block.w / 2 - 0.5;
          }
          vx = 0;
        } else {
          // Z-axis collision
          if (pz > block.z) {
            pz = block.z + block.d / 2 + 0.5;
          } else {
            pz = block.z - block.d / 2 - 0.5;
          }
          vz = 0;
        }
      }
    });

    setOnGround(newOnGround);
    
    // Call update callback with player position and current block index
    if (onUpdate) {
      onUpdate([px, py, pz], currentBlockIndex);
    }
    
    // Check for gate trigger (player approaches end gate)
    if (gate && onGateTrigger) {
      const distToGate = Math.sqrt(
        Math.pow(px - gate.x, 2) + 
        Math.pow(py - gate.y, 2) + 
        Math.pow(pz - gate.z, 2)
      );
      if (distToGate < 4.0 && !gate.floatingAtStart) {
        onGateTrigger();
      }
    }

    // Check for death (fall)
    if (py < -30) {
      onDeath('Fell into the Void');
    }

    // Check for win (reach gate)
    if (gate && Math.abs(px - gate.x) < 2 && Math.abs(py - (gate.y + 2.5)) < 3 && Math.abs(pz - gate.z) < 2) {
      onWin();
    }

    setPosition([px, py, pz]);
    setVelocity([vx, vy, vz]);

    if (meshRef.current) {
      meshRef.current.position.set(px, py, pz);
    }
  });

  return (
    <group ref={meshRef} position={position}>
      {/* Shadow */}
      <mesh position={[0, -position[1] + 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial color="#111111" transparent opacity={0.5} />
      </mesh>

      {/* Pawn base */}
      <mesh position={[0, -0.4, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#33cc33" />
      </mesh>

      {/* Pawn body */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.8, 16]} />
        <meshStandardMaterial color="#33cc33" />
      </mesh>

      {/* Pawn head */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color="#33cc33" />
      </mesh>
    </group>
  );
}

export default Player;
