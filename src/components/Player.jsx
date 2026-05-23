import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraYawRef } from './CameraController';

// Physics constants
const GRAVITY = -45.0;
const JUMP_FORCE = 22.0;
const PLAYER_SPEED = 40.0;
const FRICTION = 0.90;
const AIR_RESISTANCE = 0.98;

function Player({ startPosition, blocks, gate, onDeath, onWin, onUpdate, onGateTrigger, gameState, mobileControlRef }) {
  const meshRef = useRef();
  const [position, setPosition] = useState(startPosition);
  const [velocity, setVelocity] = useState([0, 0, 0]);
  const [onGround, setOnGround] = useState(false);
  // Live player position read by PlayerVisual for shadow projection
  const positionRef = useRef(startPosition);
  // Remembers the block the player is currently standing on so per-block
  // properties (like ice friction) can affect movement on the next frame.
  const lastPlatformRef = useRef(null);

  const keysPressed = useRef({});
  const mobileButtonsPressed = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
  });
  // External velocity-override signal (launchers, knockback, etc.)
  const launchRef = useRef(null);
  // External per-frame position delta (rotating platforms, wind, etc.)
  const externalDeltaRef = useRef([0, 0, 0]);

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
  
  // Expose mobile control + level-side control via ref
  useEffect(() => {
    if (mobileControlRef) {
      mobileControlRef.current = {
        setMove: (direction, pressed) => {
          mobileButtonsPressed.current[direction] = pressed;
        },
        setJump: (pressed) => {
          mobileButtonsPressed.current.jump = pressed;
        },
        // Launchers / knockback: overrides player's velocity once.
        setLaunch: (vx, vy, vz) => {
          launchRef.current = [vx, vy, vz];
        },
        // Rotating platforms / wind: additive position delta applied per frame
        // (caller decides delta magnitude based on dt).
        addExternalDelta: (dx, dy, dz) => {
          externalDeltaRef.current[0] += dx;
          externalDeltaRef.current[1] += dy;
          externalDeltaRef.current[2] += dz;
        },
      };
    }
  }, [mobileControlRef]);

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    if (!blocks || blocks.length === 0) return; // Wait for blocks to be ready

    const keys = keysPressed.current;
    const mobileButtons = mobileButtonsPressed.current;
    let [px, py, pz] = position;
    let [vx, vy, vz] = velocity;

    // Apply movement relative to camera direction
    const camYawRad = (cameraYawRef.current * Math.PI) / 180;
    const fx = -Math.cos(camYawRad);
    const fz = -Math.sin(camYawRad);
    const rx = -fz;
    const rz = fx;
    
    let ax = 0, az = 0;
    // Keyboard controls
    if (keys['w']) { ax += fx; az += fz; }
    if (keys['s']) { ax -= fx; az -= fz; }
    if (keys['a']) { ax -= rx; az -= rz; }
    if (keys['d']) { ax += rx; az += rz; }
    
    // Mobile button controls
    if (mobileButtons.forward) { ax += fx; az += fz; }
    if (mobileButtons.backward) { ax -= fx; az -= fz; }
    if (mobileButtons.left) { ax -= rx; az -= rz; }
    if (mobileButtons.right) { ax += rx; az += rz; }

    const length = Math.sqrt(ax * ax + az * az);
    if (length > 0) {
      ax /= length;
      az /= length;
      vx += ax * PLAYER_SPEED * delta;
      vz += az * PLAYER_SPEED * delta;
    }

    // Apply friction — use per-block friction if the last-stood-on platform
    // declares one (e.g. ice = 0.98). Defaults to the global FRICTION constant.
    let groundFriction = FRICTION;
    if (onGround && lastPlatformRef.current && typeof lastPlatformRef.current.friction === 'number') {
      groundFriction = lastPlatformRef.current.friction;
    }
    vx *= onGround ? groundFriction : AIR_RESISTANCE;
    vz *= onGround ? groundFriction : AIR_RESISTANCE;

    // Apply gravity
    vy += GRAVITY * delta;

    // Jump (keyboard or mobile button)
    if ((keys[' '] || mobileButtons.jump) && onGround) {
      vy = JUMP_FORCE;
      setOnGround(false);
    }

    // External velocity override (launchers/knockback)
    if (launchRef.current) {
      vx = launchRef.current[0];
      vy = launchRef.current[1];
      vz = launchRef.current[2];
      launchRef.current = null;
      setOnGround(false);
    }

    // Apply velocity
    px += vx * delta;
    py += vy * delta;
    pz += vz * delta;

    // Apply external position delta (rotating platforms, wind, etc.) BEFORE
    // collision so penetrations get resolved this frame.
    if (externalDeltaRef.current[0] !== 0 || externalDeltaRef.current[1] !== 0 || externalDeltaRef.current[2] !== 0) {
      px += externalDeltaRef.current[0];
      py += externalDeltaRef.current[1];
      pz += externalDeltaRef.current[2];
      externalDeltaRef.current[0] = 0;
      externalDeltaRef.current[1] = 0;
      externalDeltaRef.current[2] = 0;
    }

    // Collision detection
    let newOnGround = false;
    let currentBlockIndex = -1;
    const playerBox = {
      minX: px - 0.5, maxX: px + 0.5,
      minY: py - 0.5, maxY: py + 0.5,
      minZ: pz - 0.5, maxZ: pz + 0.5
    };

    blocks.forEach(block => {
      // Visibility / collidability:
      //   - default: invisible blocks are skipped (back-compat with L1/L2)
      //   - block.collidable === true overrides: still collide while hidden
      //     (used for L3 ghost blocks — invisible until "sonar" reveals them)
      //   - block.solid === false makes the block never collide
      //     (used for L3 FAKE blocks and kill blocks handled by the sim)
      if (!block.visible && block.collidable !== true) return;
      if (block.solid === false) return;

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
            // Remember this platform so its friction applies next frame
            lastPlatformRef.current = block;
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
    positionRef.current = [px, py, pz];

    if (meshRef.current) {
      meshRef.current.position.set(px, py, pz);
    }
  });

  return (
    <group ref={meshRef} position={position}>
      <PlayerVisual blocksProp={blocks} positionRef={positionRef} />
    </group>
  );
}

// Visual-only pawn with a pulsing neon halo and a shadow projected onto the
// nearest platform below the player. Split into its own component so we can
// use useFrame for animation without touching the physics useFrame above.
function PlayerVisual({ blocksProp, positionRef }) {
  const haloRef = useRef();
  const shadowRef = useRef();
  const headMatRef = useRef();
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const pulse = 0.6 + 0.4 * Math.sin(t.current * 3.0);

    // ----- Project shadow + halo onto the ground below the player -----
    const [px, py, pz] = positionRef.current || [0, 0, 0];
    let groundY = -Infinity;
    if (blocksProp) {
      for (const b of blocksProp) {
        if (b.visible === false || b.solid === false) continue;
        const top = b.y + b.h / 2;
        if (top > py - 0.45) continue;            // not strictly below player feet
        if (top <= groundY) continue;             // not the highest yet
        if (Math.abs(px - b.x) > b.w / 2 + 0.4) continue;
        if (Math.abs(pz - b.z) > b.d / 2 + 0.4) continue;
        groundY = top;
      }
    }
    const hasGround = groundY > -Infinity;
    // In local space the player group sits at world py, so localY = groundY - py.
    const localY = hasGround ? (groundY + 0.02 - py) : -100;
    const altitude = hasGround ? Math.max(0, py - groundY - 0.5) : 30;
    // Smooth fade with altitude
    const fade = Math.max(0, Math.min(1, 1 - altitude * 0.06));
    // Slightly larger shadow when higher (perspective), but fainter
    const scale = Math.max(0.55, 1 + altitude * 0.04);

    if (shadowRef.current) {
      shadowRef.current.position.y = localY;
      shadowRef.current.visible = hasGround;
      shadowRef.current.scale.set(scale, scale, 1);
      if (shadowRef.current.material) {
        shadowRef.current.material.opacity = 0.5 * fade;
      }
    }
    if (haloRef.current) {
      haloRef.current.position.y = localY + 0.01;
      haloRef.current.visible = hasGround;
      const haloPulse = (1 + 0.08 * Math.sin(t.current * 2.5)) * scale;
      haloRef.current.scale.set(haloPulse, haloPulse, 1);
      if (haloRef.current.material) {
        haloRef.current.material.opacity = (0.25 + 0.18 * pulse) * fade;
      }
    }
    if (headMatRef.current) {
      headMatRef.current.emissiveIntensity = 0.8 + 0.5 * pulse;
    }
  });

  return (
    <group>
      {/* Soft neon ground halo disc (projected) */}
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 1.4, 32]} />
        <meshBasicMaterial
          color="#5cff8a"
          transparent
          opacity={0.4}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Shadow disc (projected onto the ground) */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.5} depthWrite={false} />
      </mesh>

      {/* Pawn base */}
      <mesh position={[0, -0.4, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color="#33cc55"
          roughness={0.4}
          metalness={0.2}
          emissive="#1a8a33"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Pawn body */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.8, 16]} />
        <meshStandardMaterial
          color="#33cc55"
          roughness={0.4}
          metalness={0.2}
          emissive="#22aa44"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Pawn head — pulses */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial
          ref={headMatRef}
          color="#5cff8a"
          emissive="#5cff8a"
          emissiveIntensity={1.0}
          roughness={0.3}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export default Player;
