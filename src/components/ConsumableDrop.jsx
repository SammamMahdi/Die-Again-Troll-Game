import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { purchaseConsumable } from '../utils/consumables';
import { playJewelPickup } from '../utils/sounds';

// In-level consumable drop — a floating pickup that adds one of the
// given item id to the player's inventory on touch. Spawned only during
// Hardcore runs (gated by the level rendering it).
//
// Per-item visual:
//   speed_potion        — yellow bottle + electric blue cap
//   jewel_magnet        — crimson U-shape torus
//   invisibility_potion — translucent violet sphere with darker shell
//
// On collect: purchaseConsumable(itemId) increments the inventory by 1
// (reuses the existing "buy" function — same effect as a free purchase).
// Cloud sync picks the new count up on the next level complete.

const ITEM_VISUALS = {
  speed_potion: {
    bodyColor: '#ffd633',
    bodyEmissive: '#ffaa20',
    capColor: '#3ab4ff',
    auraColor: '#fff080',
  },
  jewel_magnet: {
    bodyColor: '#ff3344',
    bodyEmissive: '#aa1122',
    capColor: '#88ddff',
    auraColor: '#ffaaaa',
  },
  invisibility_potion: {
    bodyColor: '#9966ff',
    bodyEmissive: '#7044dd',
    capColor: '#ffffff',
    auraColor: '#c8aaff',
  },
  extra_life: {
    // Crimson heart bottle with a gold cap and a warm red aura.
    bodyColor: '#ff2244',
    bodyEmissive: '#ff4466',
    capColor: '#ffd966',
    auraColor: '#ff99aa',
  },
};

function ConsumableDrop({ position, itemId, playerPosRef, onCollect, hidden }) {
  const groupRef = useRef();
  const bodyRef = useRef();
  const auraRef = useRef();
  const [picked, setPicked] = useState(false);
  const t = useRef(Math.random() * Math.PI * 2);

  const v = ITEM_VISUALS[itemId] || ITEM_VISUALS.speed_potion;

  useFrame((_, delta) => {
    if (picked || hidden) return;
    t.current += delta;
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t.current * 1.6) * 0.22;
      groupRef.current.rotation.y += delta * 1.0;
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.x = Math.sin(t.current * 0.7) * 0.18;
    }
    if (auraRef.current) {
      const pulse = 1 + 0.12 * Math.sin(t.current * 3.2);
      auraRef.current.scale.set(pulse, pulse, pulse);
    }
    // AABB pickup against the player.
    const p = playerPosRef && playerPosRef.current;
    if (!p) return;
    const dx = Math.abs(p[0] - position[0]);
    const dy = Math.abs(p[1] - (position[1] + Math.sin(t.current * 1.6) * 0.22));
    const dz = Math.abs(p[2] - position[2]);
    if (dx < 1.0 && dy < 1.2 && dz < 1.0) {
      setPicked(true);
      purchaseConsumable(itemId);
      playJewelPickup('bonus');
      if (onCollect) onCollect(itemId);
    }
  });

  if (picked || hidden) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Outer translucent aura */}
      <mesh ref={auraRef}>
        <sphereGeometry args={[0.75, 16, 12]} />
        <meshBasicMaterial color={v.auraColor} transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* Potion bottle — capsule body */}
      <mesh ref={bodyRef} position={[0, 0, 0]}>
        <capsuleGeometry args={[0.35, 0.4, 8, 16]} />
        <meshStandardMaterial
          color={v.bodyColor}
          emissive={v.bodyEmissive}
          emissiveIntensity={1.4}
          roughness={0.3}
          metalness={0.4}
          transparent
          opacity={0.92}
          toneMapped={false}
        />
      </mesh>

      {/* Cap */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.16, 12]} />
        <meshStandardMaterial color={v.capColor} emissive={v.capColor} emissiveIntensity={0.6} roughness={0.4} metalness={0.5} toneMapped={false} />
      </mesh>

      {/* Bright inner pinpoint so each drop reads even at distance */}
      <mesh>
        <sphereGeometry args={[0.12, 12, 8]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  );
}

export default ConsumableDrop;
