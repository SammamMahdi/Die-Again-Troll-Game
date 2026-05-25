import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { addJewels } from '../utils/jewels';
import { playJewelPickup } from '../utils/sounds';
import { useConsumables } from './ConsumablesProvider';

// Floating octahedron pickup. Two collection modes:
//
// 1. Walk into it — close-AABB check against player position (~0.5 unit
//    half-extent each side). Default behaviour.
//
// 2. Jewel Magnet active — when the player is within the magnet's
//    `magnetRadius`, the jewel accelerates toward the player position
//    (velocity-based, capped). The pull strength scales with the magnet's
//    upgrade level. Pickup still happens via the close-AABB once it gets
//    near the player.
//
// Variants:
//   common — gold, value 1
//   bonus  — iridescent cyan, value 5
function Jewel({ position, kind = 'common', playerPosRef, onCollect, hidden }) {
  const { activeRef: effectsRef } = useConsumables();
  const groupRef = useRef();
  const meshRef = useRef();
  const [picked, setPicked] = useState(false);
  const t = useRef(Math.random() * Math.PI * 2);

  // Live mutable position so the magnet can drag the jewel through space.
  // Seeded from `position` on first frame and kept in sync; the original
  // prop only matters for the initial place.
  const livePos = useRef([position[0], position[1], position[2]]);
  const vel     = useRef([0, 0, 0]);
  const baseY   = position[1];   // for the idle bob — frozen at spawn height

  const cfg = kind === 'bonus'
    ? { size: 0.45, color: '#88e6ff', emissive: '#3cc8ff', emissiveI: 1.4, auraColor: '#aaf0ff', auraOpacity: 0.18, value: 5 }
    : { size: 0.32, color: '#ffd966', emissive: '#ffae3b', emissiveI: 1.2, auraColor: '#ffe28b', auraOpacity: 0.12, value: 1 };

  useFrame((_, deltaRaw) => {
    if (picked || hidden) return;
    const delta = Math.min(deltaRaw, 0.05);
    t.current += delta;

    const p = playerPosRef && playerPosRef.current;
    if (!p) return;

    const fx = effectsRef.current;
    const magnetActive = fx.magnetUntil > Date.now() && fx.magnetRadius > 0;
    const dxRaw = p[0] - livePos.current[0];
    const dyRaw = p[1] - livePos.current[1];
    const dzRaw = p[2] - livePos.current[2];
    const distSq = dxRaw * dxRaw + dyRaw * dyRaw + dzRaw * dzRaw;
    const dist = Math.sqrt(distSq);

    if (magnetActive && dist < fx.magnetRadius && dist > 0.001) {
      // Pull: accelerate toward player. Acceleration scales with how
      // CLOSE the jewel is — close jewels snap in fast, distant ones
      // crawl. That keeps the effect readable across the radius without
      // a single uniform whoosh.
      const t01 = 1.0 - dist / fx.magnetRadius;
      const accel = fx.magnetStrength * (0.35 + 0.65 * t01);
      const invDist = 1.0 / dist;
      vel.current[0] += dxRaw * invDist * accel * delta;
      vel.current[1] += dyRaw * invDist * accel * delta;
      vel.current[2] += dzRaw * invDist * accel * delta;
      // Soft damping so the jewel doesn't overshoot and orbit forever.
      const damp = Math.pow(0.18, delta);
      vel.current[0] *= damp;
      vel.current[1] *= damp;
      vel.current[2] *= damp;
      // Cap top speed so a max-level magnet can't slingshot a jewel past
      // the player. Speed cap scales with the player's magnet strength.
      const maxSpeed = Math.max(6, fx.magnetStrength * 0.55);
      const vMag = Math.sqrt(
        vel.current[0] * vel.current[0] +
        vel.current[1] * vel.current[1] +
        vel.current[2] * vel.current[2],
      );
      if (vMag > maxSpeed) {
        const s = maxSpeed / vMag;
        vel.current[0] *= s; vel.current[1] *= s; vel.current[2] *= s;
      }
      livePos.current[0] += vel.current[0] * delta;
      livePos.current[1] += vel.current[1] * delta;
      livePos.current[2] += vel.current[2] * delta;
    } else {
      // Idle: lazily lerp back to the spawn-bob curve when the magnet
      // is OFF. The horizontal position also drifts back toward the
      // spawn point so a half-dragged jewel doesn't sit out in the air.
      vel.current[0] *= 0.86;
      vel.current[1] *= 0.86;
      vel.current[2] *= 0.86;
      const targetY = baseY + Math.sin(t.current * 1.8) * 0.18;
      livePos.current[0] += (position[0] - livePos.current[0]) * Math.min(1, 3 * delta);
      livePos.current[1] += (targetY    - livePos.current[1]) * Math.min(1, 3 * delta);
      livePos.current[2] += (position[2] - livePos.current[2]) * Math.min(1, 3 * delta);
    }

    // Push the new position out to three.js
    if (groupRef.current) {
      groupRef.current.position.set(
        livePos.current[0],
        livePos.current[1],
        livePos.current[2],
      );
      groupRef.current.rotation.y += delta * (magnetActive ? 4.0 : 1.4);
    }
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(t.current * 0.9) * 0.25;
    }

    // Pickup: tight AABB around the live jewel position. Magnet only
    // moves the jewel — the collision still has to happen.
    const dx = Math.abs(p[0] - livePos.current[0]);
    const dy = Math.abs(p[1] - livePos.current[1]);
    const dz = Math.abs(p[2] - livePos.current[2]);
    if (dx < cfg.size + 0.5 && dy < cfg.size + 0.7 && dz < cfg.size + 0.5) {
      setPicked(true);
      addJewels(cfg.value);
      playJewelPickup(kind);
      if (onCollect) onCollect(cfg.value, kind);
    }
  });

  if (picked || hidden) return null;

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[cfg.size, 0]} />
        <meshStandardMaterial
          color={cfg.color}
          emissive={cfg.emissive}
          emissiveIntensity={cfg.emissiveI}
          roughness={0.15}
          metalness={0.7}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <octahedronGeometry args={[cfg.size * 0.42, 0]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[cfg.size * 2.0, 16, 12]} />
        <meshBasicMaterial
          color={cfg.auraColor}
          transparent
          opacity={cfg.auraOpacity}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export default Jewel;
