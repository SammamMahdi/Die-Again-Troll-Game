import React from 'react';
import {
  EffectComposer, Bloom, ChromaticAberration, Vignette, HueSaturation,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Shared compositor for every level's Canvas.
 *
 *   Bloom              — neon edges + emissive surfaces actually glow.
 *   ChromaticAberration — subtle colour fringing around the screen edges.
 *   HueSaturation       — gentle per-level tint (hue 0 = neutral, +/-0.2 ≈ ±35°).
 *   Vignette            — dark corners for cinematic framing.
 *   ToneMapping ACES    — filmic curve, lifts shadows and tames highlights.
 *
 * Per-level tuning lives in the `bloomIntensity` / `hue` props.
 */
function ScenePostFX({
  bloomIntensity = 0.85,
  bloomThreshold = 0.35,
  hue = 0,
  vignette = 0.4,
  chromatic = 0.00018,
}) {
  return (
    <EffectComposer multisampling={2}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.4}
        radius={0.5}
      />
      <ChromaticAberration offset={[chromatic, chromatic]} radialModulation={false} />
      <HueSaturation hue={hue} saturation={0.04} />
      <Vignette eskil={false} offset={0.25} darkness={vignette} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export default ScenePostFX;
