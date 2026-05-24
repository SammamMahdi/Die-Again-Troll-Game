import React from 'react';
import { Grid } from '@react-three/drei';
import { useGridVisible } from './GraphicsProvider';

// Cosmetic ground grid. Off by default; toggled in Settings via the
// "Show grid" switch. Self-gates on the GridContext so the per-level call
// sites don't need to know about the preference.
function InfiniteGrid() {
  const visible = useGridVisible();
  if (!visible) return null;
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
