import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

/**
 * AnimatedBlock renders a block that can change position/color/visibility
 * per frame WITHOUT triggering React re-renders. It mutates the underlying
 * Three.js mesh imperatively by reading from the (mutable) `block` object
 * passed in. Use this for moving platforms, breaking blocks, ghost blocks, etc.
 *
 * Expected mutable fields on `block`:
 *   x, y, z, w, h, d, visible, color: [r, g, b]
 *
 * Props:
 *   block          — mutable block object (see above)
 *   emissiveBoost  — extra emissive intensity (gold goal, blink blocks, etc.)
 *   wireframe      — render as wireframe only (ghost blocks)
 *   metalness      — material metalness (icy blocks look good high)
 *   roughness      — material roughness
 *   edgeColor      — if set, adds a neon line-outline (skipped when wireframe)
 *   edgeOpacity    — opacity of the neon outline
 */
function AnimatedBlock({
  block,
  emissiveBoost = 0,
  wireframe = false,
  metalness = 0.1,
  roughness = 0.6,
  edgeColor = null,
  edgeOpacity = 0.9,
}) {
  const groupRef = useRef();
  const topMatRef = useRef();
  const baseMatRef = useRef();

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = block.visible !== false;
    if (!groupRef.current.visible) return;

    groupRef.current.position.set(block.x, block.y, block.z);

    const c = block.color || [0.8, 0.8, 0.8];
    if (topMatRef.current) {
      topMatRef.current.color.setRGB(c[0], c[1], c[2]);
      if (emissiveBoost > 0) {
        topMatRef.current.emissive.setRGB(c[0], c[1], c[2]);
        topMatRef.current.emissiveIntensity = emissiveBoost;
      }
    }
    if (baseMatRef.current) {
      baseMatRef.current.color.setRGB(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5);
    }
  });

  const initColor = new THREE.Color(
    block.color ? block.color[0] : 0.8,
    block.color ? block.color[1] : 0.8,
    block.color ? block.color[2] : 0.8,
  );
  const baseColor = initColor.clone().multiplyScalar(0.5);

  return (
    <group ref={groupRef} position={[block.x, block.y, block.z]}>
      <mesh>
        <boxGeometry args={[block.w, block.h, block.d]} />
        <meshStandardMaterial
          ref={topMatRef}
          color={initColor}
          roughness={roughness}
          metalness={metalness}
          emissive={initColor}
          emissiveIntensity={emissiveBoost}
          wireframe={wireframe}
          transparent={wireframe}
          opacity={wireframe ? 0.85 : 1.0}
        />
        {edgeColor && !wireframe && (
          <Edges scale={1.002} threshold={15}>
            <meshBasicMaterial
              color={edgeColor}
              transparent
              opacity={edgeOpacity}
              toneMapped={false}
            />
          </Edges>
        )}
      </mesh>
      {!wireframe && (
        <mesh position={[0, -block.h * 0.51, 0]}>
          <boxGeometry args={[block.w * 1.05, block.h * 0.1, block.d * 1.05]} />
          <meshStandardMaterial ref={baseMatRef} color={baseColor} roughness={0.85} />
        </mesh>
      )}
    </group>
  );
}

export default AnimatedBlock;
