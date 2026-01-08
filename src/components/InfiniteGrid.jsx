import React from 'react';
import { Grid } from '@react-three/drei';

function InfiniteGrid() {
  return (
    <Grid
      args={[2000, 2000]}
      position={[0, -20, 0]}
      cellSize={20}
      cellThickness={0.5}
      cellColor="#444466"
      sectionSize={100}
      sectionThickness={1}
      sectionColor="#666688"
      fadeDistance={1000}
      fadeStrength={1}
      infiniteGrid
    />
  );
}

export default InfiniteGrid;
