import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { addJewels } from '../utils/jewels';
import { playJewelPickup } from '../utils/sounds';

// Floating octahedron pickup — collidable via AABB against the live player
// position read from the level's playerPosRef. On collect, increments the
// purse, plays a chime, and hides itself. Won't re-trigger.
//
// Two visual variants:
//   common  — gold, value 1, smaller
//   bonus   — iridescent cyan, value 5, larger + aura
function Jewel({ position, kind = 'common', playerPosRef, onCollect, hidden }) {
  const groupRef = useRef();
  const meshRef = useRef();
  const [picked, setPicked] = useState(false);
  const t = useRef(Math.random() * Math.PI * 2);   // random phase per jewel

  // Per-variant visual config.
  const cfg = kind === 'bonus'
    ? { size: 0.45, color: '#88e6ff', emissive: '#3cc8ff', emissiveI: 1.4, auraColor: '#aaf0ff', auraOpacity: 0.18, value: 5 }
    : { size: 0.32, color: '#ffd966', emissive: '#ffae3b', emissiveI: 1.2, auraColor: '#ffe28b', auraOpacity: 0.12, value: 1 };

  useFrame((_, delta) => {
    if (picked || hidden) return;
    t.current += delta;
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t.current * 1.8) * 0.18;
      groupRef.current.rotation.y += delta * 1.4;
    }
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(t.current * 0.9) * 0.25;
    }
    // AABB pickup: small box around the jewel vs. player half-extent (~0.5).
    const p = playerPosRef && playerPosRef.current;
    if (!p) return;
    const dx = Math.abs(p[0] - position[0]);
    const dy = Math.abs(p[1] - (position[1] + Math.sin(t.current * 1.8) * 0.18));
    const dz = Math.abs(p[2] - position[2]);
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
      {/* Main octahedron facet */}
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
      {/* White inner core for bloom anchor */}
      <mesh>
        <octahedronGeometry args={[cfg.size * 0.42, 0]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* Soft outer aura */}
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
