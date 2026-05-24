import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { playJewelPickup } from '../utils/sounds';

// Phase 3 portal — a full-size gate-like entry the player can walk through.
// Same structural shape as the goal Gate (two pillars + crossbar) but
// glowing purple/cyan with a shimmering inner disc.
//
// `position` is the BASE of the portal (where the pillars rest on the
// platform). Internally we shift everything up so the structure stands
// on the platform instead of half-sinking into it.
//
// Spawns only in Hardcore on Gold'd levels (gated upstream). AABB pickup
// is generous — anywhere within the gate opening counts as "entered".
function Portal({ position, rotationY = 0, playerPosRef, onEnter, hidden }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const innerRef = useRef();
  const swirlRef = useRef();
  const [entered, setEntered] = useState(false);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (entered || hidden) return;
    t.current += delta;
    // Outer group rotation is now driven by the `rotationY` prop so each
    // level can face the portal toward its approach direction. The inner
    // swirl rings (innerRef, swirlRef) carry the spin animation instead.
    if (ringRef.current) {
      const pulse = 1 + 0.04 * Math.sin(t.current * 2.0);
      ringRef.current.scale.set(pulse, pulse, 1);
    }
    if (innerRef.current) {
      innerRef.current.rotation.z += delta * 1.2;
    }
    if (swirlRef.current) {
      swirlRef.current.rotation.z -= delta * 1.8;
      const pulse = 1 + 0.08 * Math.sin(t.current * 2.5);
      swirlRef.current.scale.set(pulse, pulse, 1);
    }

    // AABB pickup — walking through the gate footprint counts. The base
    // y is the platform top; the gate spans roughly 0.5 → 5.0 above that,
    // so we accept any player y inside the pillar range. This means a
    // walking player (y≈1.0 on a y=0.5 platform) registers as entered
    // just by passing through the doorway.
    const p = playerPosRef && playerPosRef.current;
    if (!p) return;
    const baseY = position[1];
    // Rotate the player offset into the portal's local frame so the wide
    // (2.1) and narrow (1.3) AABB axes track the portal's facing direction.
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    const ox = p[0] - position[0];
    const oz = p[2] - position[2];
    const localX = ox * cos + oz * sin;
    const localZ = -ox * sin + oz * cos;
    const inFootprint =
      Math.abs(localX) < 2.1 &&
      Math.abs(localZ) < 1.3 &&
      p[1] > baseY + 0.3 && p[1] < baseY + 5.2;
    if (inFootprint) {
      setEntered(true);
      playJewelPickup('bonus');
      if (onEnter) onEnter();
    }
  });

  if (entered || hidden) return null;

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {/* Ground halo at base — marks the spawn footprint */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 3.2, 64]} />
        <meshBasicMaterial color="#c060ff" transparent opacity={0.28} depthWrite={false}
          side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* Gate frame — shifted up by 2.5 so pillar bottoms rest on the platform */}
      <group position={[0, 2.5, 0]}>
        {/* Left pillar */}
        <mesh position={[-1.7, 0, 0]}>
          <boxGeometry args={[0.5, 5, 0.5]} />
          <meshStandardMaterial color="#9050d0" emissive="#a040ff" emissiveIntensity={1.4}
            roughness={0.2} metalness={0.7} toneMapped={false} />
        </mesh>
        {/* Right pillar */}
        <mesh position={[1.7, 0, 0]}>
          <boxGeometry args={[0.5, 5, 0.5]} />
          <meshStandardMaterial color="#9050d0" emissive="#a040ff" emissiveIntensity={1.4}
            roughness={0.2} metalness={0.7} toneMapped={false} />
        </mesh>
        {/* Top crossbar */}
        <mesh position={[0, 2.25, 0]}>
          <boxGeometry args={[3.9, 0.5, 0.5]} />
          <meshStandardMaterial color="#9050d0" emissive="#a040ff" emissiveIntensity={1.4}
            roughness={0.2} metalness={0.7} toneMapped={false} />
        </mesh>
        {/* Corner finials — bright cyan beacons */}
        <mesh position={[-1.7, 2.5, 0]}>
          <sphereGeometry args={[0.32, 18, 18]} />
          <meshStandardMaterial color="#ffffff" emissive="#aef0ff" emissiveIntensity={2.5}
            toneMapped={false} />
        </mesh>
        <mesh position={[1.7, 2.5, 0]}>
          <sphereGeometry args={[0.32, 18, 18]} />
          <meshStandardMaterial color="#ffffff" emissive="#aef0ff" emissiveIntensity={2.5}
            toneMapped={false} />
        </mesh>

        {/* Portal disc — the walk-through opening, sits between the pillars */}
        <mesh>
          <circleGeometry args={[1.55, 64]} />
          <meshBasicMaterial color="#5022aa" transparent opacity={0.78} side={THREE.DoubleSide} />
        </mesh>
        {/* Inner swirling ring (counter-rotating) */}
        <mesh ref={innerRef}>
          <torusGeometry args={[1.25, 0.1, 12, 48]} />
          <meshStandardMaterial color="#aef0ff" emissive="#88ddff" emissiveIntensity={2.0}
            roughness={0.1} metalness={0.6} toneMapped={false} />
        </mesh>
        {/* Outer pulsing ring */}
        <mesh ref={ringRef}>
          <torusGeometry args={[1.55, 0.08, 14, 64]} />
          <meshStandardMaterial color="#c060ff" emissive="#a040ff" emissiveIntensity={1.8}
            roughness={0.2} metalness={0.6} toneMapped={false} />
        </mesh>
        {/* Tighter inner swirl */}
        <mesh ref={swirlRef}>
          <torusGeometry args={[0.85, 0.06, 10, 36]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        {/* Bloom anchor in the center */}
        <mesh>
          <sphereGeometry args={[0.18, 12, 10]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export default Portal;
