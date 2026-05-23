import React from 'react';
import { Box, Edges } from '@react-three/drei';
import * as THREE from 'three';

function Block({
  position,
  size,
  color = [0.8, 0.8, 0.8],
  emissiveIntensity = 0,
  edgeColor = null,
  edgeOpacity = 0.9,
}) {
  const topColor = new THREE.Color(color[0], color[1], color[2]);
  const baseColor = new THREE.Color(color[0] * 0.45, color[1] * 0.45, color[2] * 0.6);

  return (
    <group position={position}>
      {/* Main block */}
      <Box args={size}>
        <meshStandardMaterial
          color={topColor}
          roughness={0.55}
          metalness={0.15}
          emissive={topColor}
          emissiveIntensity={emissiveIntensity}
        />
        {edgeColor && (
          <Edges scale={1.002} threshold={15}>
            <meshBasicMaterial
              color={edgeColor}
              transparent
              opacity={edgeOpacity}
              toneMapped={false}
            />
          </Edges>
        )}
      </Box>

      {/* Edge / base highlight underneath */}
      <Box args={[size[0] * 1.05, size[1] * 0.1, size[2] * 1.05]} position={[0, -size[1] * 0.51, 0]}>
        <meshStandardMaterial color={baseColor} roughness={0.85} metalness={0.05} />
      </Box>
    </group>
  );
}

export default Block;
