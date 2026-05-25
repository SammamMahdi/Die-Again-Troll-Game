import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraYawRef, pushShake, pushFovPulse } from './CameraController';
import { playJump } from '../utils/sounds';
import { useGraphics } from './GraphicsProvider';
import { useCosmetics } from './CosmeticsProvider';
import { useConsumables } from './ConsumablesProvider';
import { useRunStats } from './RunStatsContext';
import { getKey, matches } from '../utils/controls';

// Physics constants
const GRAVITY = -45.0;
const JUMP_FORCE = 22.0;
const PLAYER_SPEED = 40.0;
const FRICTION = 0.90;
const AIR_RESISTANCE = 0.98;

// Roll move — press C to roll. Behavior depends on grounded state:
//   - On ground: immediate forward roll. Hitbox top drops so the player
//     passes under low obstacles. Visual: body crouches (scale.y shrinks).
//   - Mid-air: SLAM straight down (vy = -SLAM_SPEED, vx/vz = 0). When the
//     player lands, the slam auto-transitions into the forward roll. This
//     is the "jump → C → drop and roll" combo.
// SPACE cancels either phase and jumps — instant. So roll-jump-roll-jump
// chains flow naturally.
const ROLL_DURATION = 0.35;
// Cooldowns are zero — phase recovery (roll→jump, jump→roll) is INSTANT so
// chains flow without any "you can't act yet" lockout. The only gate is
// "you can't start a new roll while one is already in progress" (handled
// by the phase check, not the cooldown).
const ROLL_COOLDOWN = 0;
const ROLL_JUMP_CANCEL_COOLDOWN = 0;
const ROLL_SPEED = 15.0;            // ~5.25 units of travel per roll
const ROLL_UPPER_OFFSET = -0.25;    // top of hitbox relative to py during roll
const SLAM_SPEED = 25.0;            // downward velocity during the slam dive
                                    // (a touch faster than natural fall, not snap)

function Player({ startPosition, blocks, gate, onDeath, onWin, onUpdate, onGateTrigger, gameState, mobileControlRef }) {
  // Per-frame access to active potions (speed boost). Bypasses re-renders.
  const { activeRef: effectsRef } = useConsumables();
  // Phase 3b: pause flag flows from the RunStatsProvider that wraps each
  // level. When main is hidden behind an active Echo Dimension, App.js
  // sets paused=true on main's provider — Player's useFrame short-circuits
  // and keyboard input is ignored.
  const { paused } = useRunStats();
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
  // External velocity-override signal (launchers, knockback, etc.)
  const launchRef = useRef(null);
  // External per-frame position delta (rotating platforms, wind, etc.)
  const externalDeltaRef = useRef([0, 0, 0]);
  // VFX bookkeeping: trail history, last-frame ground state, landing dust trigger
  const trailRef = useRef([]); // ring buffer of {x,y,z,age}
  const trailTickRef = useRef(0);
  const wasOnGroundRef = useRef(false);
  const dustTriggerRef = useRef({ at: 0, pos: [0, 0, 0] });
  // Roll state. Edge-triggered: rollRequestRef goes true on Shift-keydown
  // and the physics loop consumes it (so a held Shift doesn't auto-rebuy
  // a roll the instant cooldown ticks down).
  const rollRequestRef = useRef(false);
  // phase: 'idle' | 'slam' | 'rolling'
  const rollStateRef = useRef({
    phase: 'idle',
    timer: 0,
    cooldown: 0,
    dirX: 0,
    dirZ: 0,
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Store keys by normalized form so the lookup table works whether
      // the key is a letter, space, or arrow. Letters are lower-cased;
      // everything else is stored verbatim.
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysPressed.current[k] = true;
      // Roll is edge-triggered so holding the bound key doesn't auto-
      // chain rolls. Read the latest binding live so a rebind in Settings
      // takes effect without remounting Player.
      if (matches(e.key, 'roll')) rollRequestRef.current = true;
    };
    const handleKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysPressed.current[k] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Expose level-side gameplay hooks via ref (named `mobileControlRef` for
  // historical reasons; mobile UI is gone but levels still push launches /
  // external deltas through this same handle).
  useEffect(() => {
    if (mobileControlRef) {
      mobileControlRef.current = {
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
        // Phase 3b: hard-teleport the player to an absolute position. Used
        // by App.js after an Echo Dimension clears, so the main level's
        // Player resumes at the portal spot. Resets velocity + roll state
        // so the player doesn't carry mid-air motion across the warp.
        teleportTo: (pos) => {
          if (!Array.isArray(pos)) return;
          const next = [pos[0], pos[1], pos[2]];
          positionRef.current = next;
          setPosition(next);
          setVelocity([0, 0, 0]);
          launchRef.current = null;
          externalDeltaRef.current = [0, 0, 0];
          rollStateRef.current = { phase: 'idle', timer: 0, cooldown: 0, dirX: 0, dirZ: 0 };
        },
      };
    }
  }, [mobileControlRef]);

  useFrame((state, deltaRaw) => {
    if (paused) return;  // Phase 3b: main level frozen while echo is active.
    if (gameState !== 'playing') return;
    if (!blocks || blocks.length === 0) return; // Wait for blocks to be ready

    // Clamp delta to ~20 FPS worst-case. Browsers throttle requestAnimationFrame
    // when the tab is unfocused, so on refocus you get one huge dt that
    // teleports the player through platforms (gravity carries them past
    // collision bounds in a single step). Capping it preserves the physics.
    const delta = Math.min(deltaRaw, 0.05);

    const keys = keysPressed.current;
    let [px, py, pz] = position;
    let [vx, vy, vz] = velocity;

    // Apply movement relative to camera direction
    const camYawRad = (cameraYawRef.current * Math.PI) / 180;
    const fx = -Math.cos(camYawRad);
    const fz = -Math.sin(camYawRad);
    const rx = -fz;
    const rz = fx;
    
    // Read movement keys via the rebindable bindings. getKey returns the
    // currently-bound key for each action; keys[k] is true while held.
    let ax = 0, az = 0;
    if (keys[getKey('moveForward')]) { ax += fx; az += fz; }
    if (keys[getKey('moveBack')])    { ax -= fx; az -= fz; }
    if (keys[getKey('moveLeft')])    { ax -= rx; az -= rz; }
    if (keys[getKey('moveRight')])   { ax += rx; az += rz; }

    const length = Math.sqrt(ax * ax + az * az);
    // Speed Potion: 1.5× walking acceleration while the timer is live.
    const speedMul = (effectsRef.current.speedBoostUntil > Date.now()) ? 1.5 : 1.0;
    if (length > 0) {
      ax /= length;
      az /= length;
      vx += ax * PLAYER_SPEED * speedMul * delta;
      vz += az * PLAYER_SPEED * speedMul * delta;
    }

    // ---------------- Roll / Slam handling ----------------
    // C requests a roll. Ground → immediate forward roll. Air → slam dive,
    // which auto-transitions to a forward roll on landing (the air-roll
    // combo). SPACE in either phase cancels and triggers a jump.
    const roll = rollStateRef.current;
    if (rollRequestRef.current) {
      rollRequestRef.current = false;
      if (roll.phase === 'idle' && roll.cooldown <= 0) {
        if (onGround) {
          roll.phase = 'rolling';
          roll.timer = ROLL_DURATION;
          roll.dirX = length > 0 ? ax : fx;
          roll.dirZ = length > 0 ? az : fz;
        } else {
          // Mid-air: enter the slam dive. Direction is captured now so we
          // can auto-roll forward on landing using either input or facing.
          roll.phase = 'slam';
          roll.dirX = length > 0 ? ax : fx;
          roll.dirZ = length > 0 ? az : fz;
        }
      }
    }
    if (roll.phase === 'slam') {
      // Slam dive: vertical only, very fast. Horizontal motion is killed
      // so the player drops in place exactly under where they pressed C.
      vy = -SLAM_SPEED;
      vx = 0;
      vz = 0;
    } else if (roll.phase === 'rolling') {
      vx = roll.dirX * ROLL_SPEED;
      vz = roll.dirZ * ROLL_SPEED;
      roll.timer -= delta;
      if (roll.timer <= 0) {
        roll.phase = 'idle';
        roll.cooldown = ROLL_COOLDOWN;
      }
    } else if (roll.cooldown > 0) {
      roll.cooldown = Math.max(0, roll.cooldown - delta);
    }
    const rolling = roll.phase === 'rolling';
    const slamming = roll.phase === 'slam';

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

    // Jump (keyboard) — instant cancellation of any active roll or slam.
    // Grounded → normal jump. Mid-slam → abort the dive and jump back up
    // (lets you tap C then immediately SPACE to bounce out of a slam).
    // Mid-roll → carry horizontal momentum into the leap (roll-jump combo).
    if (keys[getKey('jump')] && (onGround || slamming)) {
      vy = JUMP_FORCE;
      setOnGround(false);
      playJump();
      pushFovPulse(2.5);
      if (rolling || slamming) {
        roll.phase = 'idle';
        roll.timer = 0;
        roll.cooldown = ROLL_JUMP_CANCEL_COOLDOWN;
      }
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

    // Collision detection. Asymmetric Y while rolling: bottom stays at
    // py-0.5 (so the player still rests on platforms / takes ground hits),
    // but the top drops to py+ROLL_UPPER_OFFSET so low obstacles (arches,
    // partial walls) clear over the head.
    let newOnGround = false;
    let currentBlockIndex = -1;
    const upperY = rolling ? (py + ROLL_UPPER_OFFSET) : (py + 0.5);
    const playerBox = {
      minX: px - 0.5, maxX: px + 0.5,
      minY: py - 0.5, maxY: upperY,
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

    // Slam landed this frame → flip into the forward roll automatically.
    // This is the "C in air drops you down and rolls" handoff.
    if (roll.phase === 'slam' && newOnGround) {
      roll.phase = 'rolling';
      roll.timer = ROLL_DURATION;
      // dir was captured at slam-start; keep it so the roll goes the way
      // the player was facing when they tapped C.
    }

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
      // Outer mesh stays upright — the body inside PlayerVisual reads from
      // rollStateRef and rotates itself, so the projected shadow and ground
      // halo (siblings of the body) keep their world-flat orientation.
    }
  });

  return (
    <>
      <group ref={meshRef} position={position}>
        <PlayerVisual blocksProp={blocks} positionRef={positionRef} rollStateRef={rollStateRef} />
      </group>
      <PlayerTrail trailRef={trailRef} />
      <LandingDust triggerRef={dustTriggerRef} />
    </>
  );
}

// Visual-only pawn with a rotating crown, pulsing head, projected halo + shadow.
// Quality-aware: Potato (q.minimalPlayer) strips the crown, ground halo and
// inner head core down to just the base+body+head+shadow.
function PlayerVisual({ blocksProp, positionRef, rollStateRef }) {
  const q = useGraphics();
  const minimal = q.minimalPlayer;
  // Equipped cosmetic body + crown — drives the colors of capsule/base/head
  // and the crown variant. Defaults to the original green / classic torus.
  const { body: equippedBody, crown: equippedCrown } = useCosmetics();
  // Per-frame access to active potion timestamps (e.g. invisibility) so
  // the player visual can fade alpha without re-rendering.
  const { activeRef: effectsRef } = useConsumables();
  const haloRef = useRef();
  const shadowRef = useRef();
  const headMatRef = useRef();
  const crownRef = useRef();
  const bodyRef = useRef();
  const allMatsRef = useRef([]);   // every player-visual material for opacity sweep
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const pulse = 0.6 + 0.4 * Math.sin(t.current * 3.0);

    // Invisibility fade — when the potion is live, walk every material
    // under bodyRef and crownRef and drop opacity to a low ghost level
    // with a slight flicker. Restore to 1.0 when the effect ends.
    const now = Date.now();
    const invisible = effectsRef.current.invisibleUntil > now;
    const targetOpacity = invisible ? 0.25 + 0.10 * Math.sin(t.current * 6.5) : 1;
    const applyFade = (obj) => {
      if (!obj) return;
      obj.traverse((child) => {
        const m = child.material;
        if (!m) return;
        // Some materials are arrays — handle both shapes.
        const list = Array.isArray(m) ? m : [m];
        for (const mat of list) {
          if (!mat) continue;
          if (!mat.transparent) mat.transparent = true;
          mat.opacity = targetOpacity;
          // depthWrite=false while invisible so the player ghost doesn't
          // occlude what's behind them; restore when fully visible.
          mat.depthWrite = !invisible;
        }
      });
    };
    if (invisible || allMatsRef.current.faded) {
      applyFade(bodyRef.current);
      applyFade(crownRef.current);
      allMatsRef.current.faded = invisible;   // remembers we mutated, so we restore on transition
    }

    // Crown rotates constantly (skipped on Potato)
    if (crownRef.current) {
      crownRef.current.rotation.y += delta * 1.2;
      crownRef.current.rotation.x = Math.sin(t.current * 1.3) * 0.15;
    }
    // Body breathes + crouches. While rolling or slamming the body shrinks
    // vertically (squash) and faces the roll direction. Shadow + halo are
    // SIBLINGS of bodyRef so they stay flat on the ground at all times.
    if (bodyRef.current) {
      const roll = rollStateRef && rollStateRef.current;
      const phase = roll ? roll.phase : 'idle';
      // Target body scale + y-offset per phase. We lerp toward these so the
      // crouch + uncrouch transitions are smooth, not snappy.
      let targetScaleY, targetOffsetY, targetYaw;
      if (phase === 'rolling') {
        targetScaleY = 0.45;     // crouched flat
        targetOffsetY = -0.3;    // body lowered so feet stay near the ground
        targetYaw = Math.atan2(-roll.dirZ, roll.dirX);
      } else if (phase === 'slam') {
        targetScaleY = 0.65;     // half-crouched tucked dive
        targetOffsetY = -0.15;
        targetYaw = Math.atan2(-roll.dirZ, roll.dirX);
      } else {
        targetScaleY = 1.0;
        targetOffsetY = !minimal ? Math.sin(t.current * 2.0) * 0.04 : 0;
        targetYaw = 0;
      }
      const k = 1 - Math.exp(-18 * delta);   // ~5x faster than visible
      bodyRef.current.scale.y += (targetScaleY - bodyRef.current.scale.y) * k;
      // Subtle widening to preserve volume when squashed.
      const sxz = 1 + (1 - bodyRef.current.scale.y) * 0.15;
      bodyRef.current.scale.x = sxz;
      bodyRef.current.scale.z = sxz;
      bodyRef.current.position.y += (targetOffsetY - bodyRef.current.position.y) * k;
      // Yaw lerps shortest-path. For first ship a snap on phase entry is fine.
      bodyRef.current.rotation.y = targetYaw;
      // No X tumble — the crouch IS the visual cue.
      bodyRef.current.rotation.x = 0;
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
    // Shadow only shows when an actual landable block is below the player.
    // Over the void there is no ground to project onto — shadow stays hidden.
    const hasGround = groundY > -Infinity;
    const localY = hasGround ? (groundY + 0.02 - py) : -100;
    const altitude = hasGround ? Math.max(0, py - groundY - 0.5) : 0;
    // Slow altitude falloff with a healthy minimum floor so the shadow stays
    // readable even high up — but only while there's still ground beneath.
    const fade = Math.max(0.32, Math.min(1, 1 - altitude * 0.02));
    const scale = Math.max(0.55, 1 + altitude * 0.05);

    if (shadowRef.current) {
      shadowRef.current.position.y = localY;
      // Visible in BOTH Potato and High, but ONLY when over a landable block.
      shadowRef.current.visible = hasGround;
      shadowRef.current.scale.set(scale, scale, 1);
      if (shadowRef.current.material) {
        shadowRef.current.material.opacity = 0.6 * fade;
      }
    }
    if (haloRef.current) {
      haloRef.current.position.y = localY + 0.01;
      // Halo is the High-only neon ring; gated by minimal AND landable ground.
      haloRef.current.visible = hasGround && !minimal;
      const haloPulse = (1 + 0.08 * Math.sin(t.current * 2.5)) * scale;
      haloRef.current.scale.set(haloPulse, haloPulse, 1);
      if (haloRef.current.material) {
        haloRef.current.material.opacity = (0.25 + 0.18 * pulse) * fade;
      }
    }
  });

  return (
    <group>
      {/* Soft neon ground halo (skipped on Potato). Color tracks the
          equipped body skin so cyan/gold/crimson skins all leave a
          matching glow on the ground. */}
      {!minimal && (
        <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 1.4, 48]} />
          <meshBasicMaterial color={equippedBody.headEmissive} transparent opacity={0.4} depthWrite={false}
            side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}

      {/* Ground shadow — always rendered, sphere-sub-counts shrink on Potato */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, minimal ? 12 : 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.5} depthWrite={false} />
      </mesh>

      {/* Body group (breathes — bob disabled on Potato). Colors come from
          the equipped cosmetic body skin (defaults to original green). */}
      <group ref={bodyRef}>
        {/* Base "feet" */}
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.45, minimal ? 10 : 24, minimal ? 8 : 16]} />
          <meshStandardMaterial color={equippedBody.baseColor} roughness={0.4} metalness={0.35}
            emissive={equippedBody.baseEmissive} emissiveIntensity={minimal ? 0 : 0.5} />
        </mesh>

        {/* Capsule body */}
        <mesh position={[0, -0.05, 0]}>
          <capsuleGeometry args={[0.32, 0.55, minimal ? 4 : 8, minimal ? 8 : 16]} />
          <meshStandardMaterial color={equippedBody.color} roughness={0.35} metalness={0.4}
            emissive={equippedBody.emissive} emissiveIntensity={minimal ? 0 : 0.7} />
        </mesh>

        {/* Head — non-emissive on Potato (no bloom anyway) */}
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.38, minimal ? 12 : 32, minimal ? 10 : 24]} />
          <meshStandardMaterial
            ref={headMatRef}
            color={equippedBody.headColor}
            emissive={equippedBody.headEmissive}
            emissiveIntensity={minimal ? 0 : 1.2}
            roughness={0.18}
            metalness={0.15}
            toneMapped={!minimal ? false : true}
          />
        </mesh>

        {/* Tiny inner core for extra bloom punch (skipped on Potato) */}
        {!minimal && (
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[0.18, 16, 12]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        )}

        {/* Rotating crown variant (skipped on Potato OR if 'none' is equipped) */}
        {!minimal && equippedCrown.kind !== 'none' && (
          <group ref={crownRef} position={[0, 0.95, 0]}>
            {equippedCrown.kind === 'torus' && (
              <>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.4, 0.04, 12, 36]} />
                  <meshStandardMaterial color="#ffd966" emissive="#ffd966" emissiveIntensity={2.0}
                    roughness={0.2} metalness={0.7} toneMapped={false} />
                </mesh>
                <mesh position={[0.4, 0, 0]}>
                  <sphereGeometry args={[0.08, 12, 8]} />
                  <meshBasicMaterial color="#fff5b3" toneMapped={false} />
                </mesh>
                <mesh position={[-0.4, 0, 0]}>
                  <sphereGeometry args={[0.08, 12, 8]} />
                  <meshBasicMaterial color="#fff5b3" toneMapped={false} />
                </mesh>
              </>
            )}
            {equippedCrown.kind === 'diamond' && (
              <mesh position={[0, 0.1, 0]}>
                <octahedronGeometry args={[0.28, 0]} />
                <meshStandardMaterial color="#aef0ff" emissive="#5cdaff" emissiveIntensity={1.8}
                  roughness={0.1} metalness={0.85} toneMapped={false} />
              </mesh>
            )}
            {equippedCrown.kind === 'halo' && (
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                <torusGeometry args={[0.55, 0.03, 8, 64]} />
                <meshStandardMaterial color="#ffffff" emissive="#aef0ff" emissiveIntensity={2.2}
                  roughness={0.1} metalness={0.6} toneMapped={false} />
              </mesh>
            )}
          </group>
        )}
      </group>
    </group>
  );
}

// Motion trail: up to 14 short-lived sphere "ghosts" of recent player
// positions. Quality-aware — Potato skips it entirely, Low/Medium render
// fewer segments than High.
function PlayerTrail({ trailRef }) {
  const q = useGraphics();
  // Trail tint follows the equipped skin so swapping body colors keeps
  // the motion ghosts visually consistent with the player avatar.
  const { body: equippedBody } = useCosmetics();
  const segments = q.trailSegments;
  const groupRef = useRef();
  const meshRefs = useRef([]);

  useFrame(() => {
    const trail = trailRef.current;
    if (!groupRef.current) return;
    for (let i = 0; i < segments; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const pos = trail[i];
      if (!pos) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(pos[0], pos[1], pos[2]);
      const f = 1 - i / segments;
      const s = 0.05 + 0.25 * f;
      mesh.scale.set(s, s, s);
      if (mesh.material) {
        mesh.material.opacity = 0.55 * f;
      }
    }
  });

  if (segments <= 0) return null;
  return (
    <group ref={groupRef}>
      {Array.from({ length: segments }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) meshRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color={equippedBody.headEmissive} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// Landing dust: up to 10 small particles spawned once on each ground
// transition. Quality-aware — Potato skips, lower tiers use fewer particles.
function LandingDust({ triggerRef }) {
  const q = useGraphics();
  const count = q.dustParticles;
  const meshRefs = useRef([]);
  const dustState = useRef([]);
  const lastFiredRef = useRef(0);

  useFrame((state, delta) => {
    if (count <= 0) return;
    const trigger = triggerRef.current;
    if (trigger && trigger.at && trigger.at !== lastFiredRef.current) {
      lastFiredRef.current = trigger.at;
      dustState.current = Array.from({ length: count }, () => {
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
    for (let i = 0; i < count; i++) {
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

  if (count <= 0) return null;

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
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
