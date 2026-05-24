import React from 'react';
import { Box, RoundedBox, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphics } from './GraphicsProvider';

function Block({
  position,
  size,
  color = [0.8, 0.8, 0.8],
  emissiveIntensity = 0,
  edgeColor = null,
  edgeOpacity = 0.9,
}) {
  const q = useGraphics();
  const topColor = new THREE.Color(color[0], color[1], color[2]);
  const baseColor = new THREE.Color(color[0] * 0.45, color[1] * 0.45, color[2] * 0.6);
  // Potato skips neon outlines entirely to cut a draw call per block.
  const showEdges = edgeColor && !q.minimalEdges;

  const topGeometry = q.useRoundedBox ? (
    <RoundedBox
      args={size}
      radius={Math.min(0.14, size[0] * 0.07)}
      smoothness={q.roundedBoxSmoothness}
      creaseAngle={0.4}
    >
      <meshStandardMaterial
        color={topColor}
        roughness={0.5}
        metalness={0.2}
        emissive={topColor}
        emissiveIntensity={emissiveIntensity}
      />
      {showEdges && (
        <Edges scale={1.001} threshold={15}>
          <meshBasicMaterial color={edgeColor} transparent opacity={edgeOpacity} toneMapped={false} />
        </Edges>
      )}
    </RoundedBox>
  ) : (
    <Box args={size}>
      <meshStandardMaterial
        color={topColor}
        roughness={0.5}
        metalness={0.2}
        emissive={topColor}
        emissiveIntensity={emissiveIntensity}
      />
      {showEdges && (
        <Edges scale={1.001} threshold={15}>
          <meshBasicMaterial color={edgeColor} transparent opacity={edgeOpacity} toneMapped={false} />
        </Edges>
      )}
    </Box>
  );

  const baseGeometry = q.useRoundedBox ? (
    <RoundedBox
      args={[size[0] * 1.05, size[1] * 0.1, size[2] * 1.05]}
      position={[0, -size[1] * 0.51, 0]}
      radius={0.05}
      smoothness={Math.max(1, q.roundedBoxSmoothness - 1)}
    >
      <meshStandardMaterial color={baseColor} roughness={0.85} metalness={0.05} />
    </RoundedBox>
  ) : (
    <Box args={[size[0] * 1.05, size[1] * 0.1, size[2] * 1.05]} position={[0, -size[1] * 0.51, 0]}>
      <meshStandardMaterial color={baseColor} roughness={0.85} metalness={0.05} />
    </Box>
  );

  return (
    <group position={position}>
      {topGeometry}
      {baseGeometry}
    </group>
  );
}

export default Block;
