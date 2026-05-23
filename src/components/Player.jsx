import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraYawRef, pushShake, pushFovPulse } from './CameraController';
import { playJump } from '../utils/sounds';

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
  // VFX bookkeeping: trail history, last-frame ground state, landing dust trigger
  const trailRef = useRef([]); // ring buffer of {x,y,z,age}
  const trailTickRef = useRef(0);
  const wasOnGroundRef = useRef(false);
  const dustTriggerRef = useRef({ at: 0, pos: [0, 0, 0] });

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
      playJump();
      pushFovPulse(2.5);   // tiny zoom-in on jump
    }

    // External velocity override (launchers/knockback)
    if (launchRef.current) {
      vx = launchRef.current[0];
      vy = launchRef.current[1];
      vz = launchRef.current[2];
      launchRef.current = null;
      setOnGround(false);
      pushShake(0.6);
      pushFovPulse(6);
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

    // Check for win (reach gate).
    // Level 1 has a teleport-troll: the FIRST time you approach the gate, it
    // teleports back to the start. The real win is when you reach the gate
    // at its post-teleport location. Player tracks that via gate.floatingAtStart.
    // We require it here so the win check doesn't fire on the same frame as
    // the gate-trigger callback (React state updates are async, so the gate
    // prop is one frame stale at that moment otherwise).
    if (
      gate && gate.floatingAtStart === true &&
      Math.abs(px - gate.x) < 2 &&
      Math.abs(py - (gate.y + 2.5)) < 3 &&
      Math.abs(pz - gate.z) < 2
    ) {
      onWin();
    }

    setPosition([px, py, pz]);
    setVelocity([vx, vy, vz]);
    positionRef.current = [px, py, pz];

    // ----- VFX: trail history (sample every ~2 frames) + landing dust -----
    trailTickRef.current = (trailTickRef.current + 1) % 2;
    if (trailTickRef.current === 0) {
      const trail = trailRef.current;
      trail.unshift([px, py, pz]);
      if (trail.length > 14) trail.length = 14;
    }
    if (newOnGround && !wasOnGroundRef.current && Math.abs(vy) < 0.1) {
      // Real landing transition — trigger one dust burst at the foot position.
      dustTriggerRef.current = { at: state.clock.elapsedTime, pos: [px, py - 0.5, pz] };
      // Small camera shake on hard landings (only when coming down fast).
      pushShake(0.15);
    }
    wasOnGroundRef.current = newOnGround;

    if (meshRef.current) {
      meshRef.current.position.set(px, py, pz);
    }
  });

  return (
    <>
      <group ref={meshRef} position={position}>
        <PlayerVisual blocksProp={blocks} positionRef={positionRef} />
      </group>
      <PlayerTrail trailRef={trailRef} />
      <LandingDust triggerRef={dustTriggerRef} />
    </>
  );
}

// Visual-only pawn with a rotating crown, pulsing head, projected halo + shadow.
function PlayerVisual({ blocksProp, positionRef }) {
  const haloRef = useRef();
  const shadowRef = useRef();
  const headMatRef = useRef();
  const crownRef = useRef();
  const bodyRef = useRef();
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const pulse = 0.6 + 0.4 * Math.sin(t.current * 3.0);

    // Crown rotates constantly
    if (crownRef.current) {
      crownRef.current.rotation.y += delta * 1.2;
      crownRef.current.rotation.x = Math.sin(t.current * 1.3) * 0.15;
    }
    // Body breathes (subtle vertical bob)
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t.current * 2.0) * 0.04;
    }
    if (headMatRef.current) {
      headMatRef.current.emissiveIntensity = 1.0 + 0.6 * pulse;
    }

    // ----- Project shadow + halo onto the ground below the player -----
    // Two-pass search: first look for a block whose footprint we're over (tight
    // tolerance, so the shadow lands on the right block when several stack).
    // If we miss (jumped over an edge / between platforms), fall back to a
    // generous radius so the shadow still appears on the nearest tile rather
    // than vanishing mid-flight.
    const [px, py, pz] = positionRef.current || [0, 0, 0];
    let groundY = -Infinity;
    if (blocksProp) {
      for (const b of blocksProp) {
        if (b.visible === false || b.solid === false) continue;
        const top = b.y + b.h / 2;
        if (top > py - 0.45) continue;
        if (top <= groundY) continue;
        if (Math.abs(px - b.x) > b.w / 2 + 0.6) continue;
        if (Math.abs(pz - b.z) > b.d / 2 + 0.6) continue;
        groundY = top;
      }
      // Fallback: widest reasonable search if no block is directly under us.
      if (groundY === -Infinity) {
        for (const b of blocksProp) {
          if (b.visible === false || b.solid === false) continue;
          const top = b.y + b.h / 2;
          if (top > py - 0.45) continue;
          if (top <= groundY) continue;
          if (Math.abs(px - b.x) > b.w / 2 + 3.0) continue;
          if (Math.abs(pz - b.z) > b.d / 2 + 3.0) continue;
          groundY = top;
        }
      }
    }
    const hasGround = groundY > -Infinity;
    const localY = hasGround ? (groundY + 0.02 - py) : -100;
    const altitude = hasGround ? Math.max(0, py - groundY - 0.5) : 30;
    // Much slower altitude falloff + minimum floor: shadow stays visible
    // even when you're high up.
    const fade = Math.max(0.18, Math.min(1, 1 - altitude * 0.025));
    const scale = Math.max(0.55, 1 + altitude * 0.05);

    if (shadowRef.current) {
      shadowRef.current.position.y = localY;
      shadowRef.current.visible = hasGround;
      shadowRef.current.scale.set(scale, scale, 1);
      if (shadowRef.current.material) {
        shadowRef.current.material.opacity = 0.55 * fade;
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
  });

  return (
    <group>
      {/* Soft neon ground halo */}
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 1.4, 48]} />
        <meshBasicMaterial color="#5cff8a" transparent opacity={0.4} depthWrite={false}
          side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* Ground shadow */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.5} depthWrite={false} />
      </mesh>

      {/* Body group (breathes) */}
      <group ref={bodyRef}>
        {/* Base "feet" */}
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.45, 24, 16]} />
          <meshStandardMaterial color="#1f7a39" roughness={0.4} metalness={0.35}
            emissive="#1a8a33" emissiveIntensity={0.5} />
        </mesh>

        {/* Capsule body */}
        <mesh position={[0, -0.05, 0]}>
          <capsuleGeometry args={[0.32, 0.55, 8, 16]} />
          <meshStandardMaterial color="#37d164" roughness={0.35} metalness={0.4}
            emissive="#33cc55" emissiveIntensity={0.7} />
        </mesh>

        {/* Glowing head */}
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.38, 32, 24]} />
          <meshStandardMaterial
            ref={headMatRef}
            color="#aeffce"
            emissive="#5cff8a"
            emissiveIntensity={1.2}
            roughness={0.18}
            metalness={0.15}
            toneMapped={false}
          />
        </mesh>

        {/* Tiny inner core for extra bloom punch */}
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.18, 16, 12]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>

        {/* Rotating crown — bright, gets caught by bloom */}
        <group ref={crownRef} position={[0, 0.95, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.04, 12, 36]} />
            <meshStandardMaterial color="#ffd966" emissive="#ffd966" emissiveIntensity={2.0}
              roughness={0.2} metalness={0.7} toneMapped={false} />
          </mesh>
          {/* Two orbiting dots on the crown */}
          <mesh position={[0.4, 0, 0]}>
            <sphereGeometry args={[0.08, 12, 8]} />
            <meshBasicMaterial color="#fff5b3" toneMapped={false} />
          </mesh>
          <mesh position={[-0.4, 0, 0]}>
            <sphereGeometry args={[0.08, 12, 8]} />
            <meshBasicMaterial color="#fff5b3" toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// Motion trail: ~14 short-lived sphere "ghosts" of recent player positions.
function PlayerTrail({ trailRef }) {
  const groupRef = useRef();
  const meshRefs = useRef([]);

  useFrame(() => {
    const trail = trailRef.current;
    if (!groupRef.current) return;
    for (let i = 0; i < 14; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const pos = trail[i];
      if (!pos) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(pos[0], pos[1], pos[2]);
      const f = 1 - i / 14;        // closer-to-current = brighter
      const s = 0.05 + 0.25 * f;
      mesh.scale.set(s, s, s);
      if (mesh.material) {
        mesh.material.opacity = 0.55 * f;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) meshRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#5cff8a" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// Landing dust: 10 small particles spawned once on each ground transition.
function LandingDust({ triggerRef }) {
  const meshRefs = useRef([]);
  const dustState = useRef([]); // [{ origin, vx, vy, vz, born }]
  const lastFiredRef = useRef(0);

  useFrame((state, delta) => {
    const trigger = triggerRef.current;
    if (trigger && trigger.at && trigger.at !== lastFiredRef.current) {
      lastFiredRef.current = trigger.at;
      // Spawn 10 particles
      dustState.current = Array.from({ length: 10 }, () => {
        const a = Math.random() * Math.PI * 2;
        const speed = 1.6 + Math.random() * 1.4;
        return {
          x: trigger.pos[0],
          y: trigger.pos[1],
          z: trigger.pos[2],
          vx: Math.cos(a) * speed,
          vy: 1.2 + Math.random() * 1.4,
          vz: Math.sin(a) * speed,
          life: 0.55 + Math.random() * 0.2,
          age: 0,
        };
      });
    }
    for (let i = 0; i < 10; i++) {
      const m = meshRefs.current[i];
      const p = dustState.current[i];
      if (!m) continue;
      if (!p || p.age >= p.life) {
        m.visible = false;
        continue;
      }
      p.age += delta;
      p.vy -= 6 * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.vx *= 0.9;
      p.vz *= 0.9;
      m.visible = true;
      m.position.set(p.x, p.y, p.z);
      const f = 1 - p.age / p.life;
      const s = 0.08 + 0.18 * (1 - f);
      m.scale.set(s, s, s);
      if (m.material) {
        m.material.opacity = 0.7 * f;
      }
    }
  });

  return (
    <group>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) meshRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#dde6f5" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default Player;
