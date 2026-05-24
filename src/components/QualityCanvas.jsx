import React from 'react';
import { Canvas } from '@react-three/fiber';
import { useGraphics } from './GraphicsProvider';

/**
 * Drop-in replacement for r3f <Canvas>. Reads the active graphics preset and
 * applies quality-aware `gl` props (antialias) and a `dpr` cap so weaker
 * machines don't render at native resolution.
 *
 * Per-level callers keep their own `camera`, `style`, and children unchanged.
 */
function QualityCanvas({ children, gl: glProp, dpr: dprProp, ...rest }) {
  const q = useGraphics();
  const gl = {
    preserveDrawingBuffer: true,
    ...glProp,
    antialias: q.antialias,   // quality preset wins
  };
  const dpr = dprProp ?? [1, q.dprCap];
  return (
    <Canvas {...rest} gl={gl} dpr={dpr}>
      {children}
    </Canvas>
  );
}

export default QualityCanvas;
