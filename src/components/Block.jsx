import React from 'react';
import { Box } from '@react-three/drei';
import * as THREE from 'three';

function Block({ position, size, color = [0.8, 0.8, 0.8] }) {
  return (
    <group position={position}>
      {/* Main block */}
      <Box args={size}>
        <meshStandardMaterial color={new THREE.Color(color[0], color[1], color[2])} />
      </Box>
      
      {/* Edge highlight */}
      <Box args={[size[0] * 1.05, size[1] * 0.1, size[2] * 1.05]} position={[0, -size[1] * 0.51, 0]}>
        <meshStandardMaterial color={new THREE.Color(color[0] * 0.5, color[1] * 0.5, color[2] * 0.5)} />
      </Box>
    </group>
  );
}

export default Block;
