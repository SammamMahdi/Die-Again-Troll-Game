import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const BLUE_COLOR = new THREE.Color(0.2, 0.4, 1.0);
const RED_COLOR = new THREE.Color(1.0, 0.1, 0.1);
const BLUE_INNER = new THREE.Color(0.7, 0.85, 1.0);
const RED_INNER = new THREE.Color(1.0, 0.7, 0.7);

/**
 * Globe reads its position/state from a mutable `globe` object, updating
 * the mesh imperatively each frame so the simulation can run at 60fps
 * without thrashing React state.
 *
 * Expected mutable fields on `globe`:
 *   x, y, z, state ('BLUE' | 'RED'), chasing (bool), radius
 */
function Globe({ globe }) {
  const groupRef = useRef();
  const haloRef = useRef();
  const coreMatRef = useRef();
  const innerMatRef = useRef();
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += delta;
    const g = groupRef.current;
    if (!g) return;

    const bob = Math.sin(time.current * 1.5 + globe.x * 0.3) * 0.4;
    g.position.set(globe.x, globe.y + bob, globe.z);
    g.rotation.y += delta * 0.6;

    const isRed = globe.state === 'RED';
    const chasing = !!globe.chasing;
    const color = isRed ? RED_COLOR : BLUE_COLOR;
    const inner = isRed ? RED_INNER : BLUE_INNER;
    const emissiveIntensity = isRed ? (chasing ? 1.8 : 1.1) : 0.5;

    if (coreMatRef.current) {
      coreMatRef.current.color.copy(color);
      coreMatRef.current.emissive.copy(color);
      coreMatRef.current.emissiveIntensity = emissiveIntensity;
    }
    if (innerMatRef.current) {
      innerMatRef.current.color.copy(inner);
    }
    if (haloRef.current) {
      const pulse = isRed
        ? 1.0 + Math.sin(time.current * (chasing ? 14 : 6)) * 0.18
        : 1.0 + Math.sin(time.current * 2) * 0.05;
      haloRef.current.scale.setScalar(pulse);
      haloRef.current.material.color.copy(color);
      haloRef.current.material.opacity = isRed ? (chasing ? 0.32 : 0.22) : 0.15;
    }
  });

  const radius = globe.radius || 1.5;

  return (
    <group ref={groupRef} position={[globe.x, globe.y, globe.z]}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[radius * 1.4, 24, 24]} />
        <meshBasicMaterial color={BLUE_COLOR} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color={BLUE_COLOR}
          emissive={BLUE_COLOR}
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 0.55, 16, 16]} />
        <meshBasicMaterial ref={innerMatRef} color={BLUE_INNER} />
      </mesh>
    </group>
  );
}

export default Globe;
