import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphics } from './GraphicsProvider';

/**
 * AnimatedBlock renders a block that can change position/color/visibility
 * per frame WITHOUT triggering React re-renders. It mutates the underlying
 * Three.js mesh imperatively by reading from the (mutable) `block` object.
 *
 * Quality-aware: at Potato the bevelled <RoundedBox> is replaced with a plain
 * <boxGeometry> to save GPU work.
 */
function AnimatedBlock({
  block,
  emissiveBoost = 0,
  wireframe = false,
  metalness = 0.15,
  roughness = 0.5,
  edgeColor = null,
  edgeOpacity = 0.9,
}) {
  const q = useGraphics();
  const groupRef = useRef();
  const topMatRef = useRef();
  const baseMatRef = useRef();

  const initColor = useMemo(() => new THREE.Color(
    block.color ? block.color[0] : 0.8,
    block.color ? block.color[1] : 0.8,
    block.color ? block.color[2] : 0.8,
  ), [block.color]);
  const baseColor = useMemo(() => initColor.clone().multiplyScalar(0.5), [initColor]);

  const radius = Math.min(0.14, Math.min(block.w, block.h, block.d) * 0.08);

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

  const useRounded = q.useRoundedBox;
  const smooth = q.roundedBoxSmoothness;
  // Potato skips neon outlines on every animated block (per-frame edge geometry
  // is one of the heavier draws in the level).
  const showEdges = edgeColor && !wireframe && !q.minimalEdges;

  const topMesh = useRounded ? (
    <RoundedBox args={[block.w, block.h, block.d]} radius={radius} smoothness={smooth} creaseAngle={0.4}>
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
      {showEdges && (
        <Edges scale={1.002} threshold={15}>
          <meshBasicMaterial color={edgeColor} transparent opacity={edgeOpacity} toneMapped={false} />
        </Edges>
      )}
    </RoundedBox>
  ) : (
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
      {showEdges && (
        <Edges scale={1.002} threshold={15}>
          <meshBasicMaterial color={edgeColor} transparent opacity={edgeOpacity} toneMapped={false} />
        </Edges>
      )}
    </mesh>
  );

  const baseMesh = !wireframe && (useRounded ? (
    <RoundedBox
      args={[block.w * 1.05, block.h * 0.1, block.d * 1.05]}
      position={[0, -block.h * 0.51, 0]}
      radius={0.04}
      smoothness={Math.max(1, smooth - 1)}
    >
      <meshStandardMaterial ref={baseMatRef} color={baseColor} roughness={0.85} />
    </RoundedBox>
  ) : (
    <mesh position={[0, -block.h * 0.51, 0]}>
      <boxGeometry args={[block.w * 1.05, block.h * 0.1, block.d * 1.05]} />
      <meshStandardMaterial ref={baseMatRef} color={baseColor} roughness={0.85} />
    </mesh>
  ));

  return (
    <group ref={groupRef} position={[block.x, block.y, block.z]}>
      {topMesh}
      {baseMesh}
    </group>
  );
}

export default AnimatedBlock;
