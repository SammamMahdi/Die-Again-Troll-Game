import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Gate({ position }) {
  const gateRef = useRef();
  const time = useRef(0);

  useFrame((state, delta) => {
    time.current += delta;
    if (gateRef.current) {
      gateRef.current.rotation.y += delta * 0.5;
    }
  });

  const pulse = 0.7 + 0.3 * Math.sin(time.current * 3);
  const goldColor = new THREE.Color(1.0 * pulse, 0.84 * pulse, 0);

  return (
    <group ref={gateRef} position={position}>
      {/* Soft outer glow disc on the ground */}
      <mesh position={[0, -2.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 3.2, 32]} />
        <meshBasicMaterial color={goldColor} transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Left pillar */}
      <mesh position={[-1.5, 0, 0]}>
        <boxGeometry args={[0.5, 5, 0.5]} />
        <meshStandardMaterial color={goldColor} emissive={goldColor} emissiveIntensity={0.6} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Right pillar */}
      <mesh position={[1.5, 0, 0]}>
        <boxGeometry args={[0.5, 5, 0.5]} />
        <meshStandardMaterial color={goldColor} emissive={goldColor} emissiveIntensity={0.6} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Top bar */}
      <mesh position={[0, 2.25, 0]}>
        <boxGeometry args={[3.5, 0.5, 0.5]} />
        <meshStandardMaterial color={goldColor} emissive={goldColor} emissiveIntensity={0.6} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Decorative spheres */}
      <mesh position={[-1.5, 2.5, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#ffff66" emissive="#ffff00" emissiveIntensity={1.0} />
      </mesh>
      <mesh position={[1.5, 2.5, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#ffff66" emissive="#ffff00" emissiveIntensity={1.0} />
      </mesh>
    </group>
  );
}

export default Gate;
