import React from 'react';
import { Stars } from '@react-three/drei';
import { useGraphics } from './GraphicsProvider';

/**
 * <Stars> wrapper that scales `count` by the active preset's `starsScale`.
 * If the scale is 0 the component renders nothing (skips the geometry
 * upload entirely).
 */
function QualityStars({ count = 2000, ...rest }) {
  const q = useGraphics();
  if (q.starsScale <= 0) return null;
  const scaled = Math.max(1, Math.round(count * q.starsScale));
  return <Stars {...rest} count={scaled} />;
}

export default QualityStars;
