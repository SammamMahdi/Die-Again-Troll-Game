import React from 'react';
import { Sparkles } from '@react-three/drei';
import { useGraphics } from './GraphicsProvider';

/**
 * <Sparkles> wrapper that scales `count` by the active preset's
 * `sparklesScale`. At Potato the scale is 0 and we skip the whole component.
 */
function QualitySparkles({ count = 30, ...rest }) {
  const q = useGraphics();
  if (q.sparklesScale <= 0) return null;
  const scaled = Math.max(1, Math.round(count * q.sparklesScale));
  return <Sparkles {...rest} count={scaled} />;
}

export default QualitySparkles;
