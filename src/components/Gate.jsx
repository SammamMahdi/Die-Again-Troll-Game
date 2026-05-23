import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Goal gate frame + themed floating jewel.
 *
 * The `position` prop is now the BASE of the gate (where the pillars rest on
 * the platform). Internally we shift everything +2.5 on Y so the pillars
 * stand on the platform instead of half-sinking into it.
 *
 * Pass `jewelColor` to colour the jewel + ground halo to match each level's
 * theme. Defaults to a neutral gold.
 */
function Gate({ position, jewelColor = '#ffd966' }) {
  const gateRef = useRef();
  const jewelRef = useRef();
  const ringRef = useRef();
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    if (gateRef.current) {
      gateRef.current.rotation.y += delta * 0.5;
    }
    if (jewelRef.current) {
      jewelRef.current.rotation.y += delta * 1.6;
      jewelRef.current.rotation.x = Math.sin(t.current * 0.7) * 0.25;
      jewelRef.current.position.y = 2.0 + Math.sin(t.current * 1.8) * 0.15;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.4;
      const pulse = 1 + 0.06 * Math.sin(t.current * 2.0);
      ringRef.current.scale.set(pulse, pulse, 1);
    }
  });

  const pulse = 0.7 + 0.3 * Math.sin(t.current * 3.0);
  const goldColor = new THREE.Color(1.0 * pulse, 0.84 * pulse, 0);
  const jewelThree = new THREE.Color(jewelColor);

  return (
    <group position={position}>
      {/* Themed ground halo at platform level */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 3.4, 64]} />
        <meshBasicMaterial color={jewelThree} transparent opacity={0.22} depthWrite={false}
          side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* A slow-rotating thin accent ring on the platform, matches theme */}
      <mesh ref={ringRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.3, 2.45, 64]} />
        <meshBasicMaterial color={jewelThree} transparent opacity={0.65} depthWrite={false}
          side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* Gate frame — shifted up by 2.5 so pillar bottoms rest on the platform. */}
      <group ref={gateRef} position={[0, 2.5, 0]}>
        {/* Left pillar */}
        <mesh position={[-1.5, 0, 0]}>
          <boxGeometry args={[0.5, 5, 0.5]} />
          <meshStandardMaterial color={goldColor} emissive={goldColor} emissiveIntensity={0.22} roughness={0.3} metalness={0.55} />
        </mesh>

        {/* Right pillar */}
        <mesh position={[1.5, 0, 0]}>
          <boxGeometry args={[0.5, 5, 0.5]} />
          <meshStandardMaterial color={goldColor} emissive={goldColor} emissiveIntensity={0.22} roughness={0.3} metalness={0.55} />
        </mesh>

        {/* Top bar */}
        <mesh position={[0, 2.25, 0]}>
          <boxGeometry args={[3.5, 0.5, 0.5]} />
          <meshStandardMaterial color={goldColor} emissive={goldColor} emissiveIntensity={0.22} roughness={0.3} metalness={0.55} />
        </mesh>

        {/* Decorative finials */}
        <mesh position={[-1.5, 2.5, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ffff66" emissive="#ffff00" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[1.5, 2.5, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ffff66" emissive="#ffff00" emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* Themed floating jewel inside the gate opening */}
      <group ref={jewelRef} position={[0, 2.0, 0]}>
        {/* Main octahedron facet */}
        <mesh>
          <octahedronGeometry args={[0.52, 0]} />
          <meshStandardMaterial
            color={jewelThree}
            emissive={jewelThree}
            emissiveIntensity={0.6}
            roughness={0.12}
            metalness={0.8}
            toneMapped={false}
          />
        </mesh>
        {/* Inner core for bloom anchor */}
        <mesh>
          <octahedronGeometry args={[0.22, 0]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        {/* Faint outer aura */}
        <mesh>
          <sphereGeometry args={[0.75, 24, 16]} />
          <meshBasicMaterial color={jewelThree} transparent opacity={0.08} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export default Gate;
