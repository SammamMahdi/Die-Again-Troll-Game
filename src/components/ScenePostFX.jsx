import React from 'react';
import {
  EffectComposer, Bloom, ChromaticAberration, Vignette, HueSaturation,
  ToneMapping, Noise,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { useGraphics } from './GraphicsProvider';

/**
 * Shared compositor for every level's Canvas, quality-aware.
 *
 *   Potato : returns null entirely (no composer mounted, no extra passes)
 *   High   : full posh pipeline — wider soft bloom, ACES tone mapping, hue
 *            grade, lens chromatic, cinematic vignette, subtle film grain
 *
 * Per-level callers pass `bloomIntensity` / `hue` / `vignette` to dial in
 * each level's mood; those values get scaled by `q.bloomScale` so Potato
 * still effectively kills bloom even though it returns null anyway.
 */
function ScenePostFX({
  bloomIntensity = 1.25,
  bloomThreshold = 0.28,
  hue = 0,
  vignette = 0.55,
  chromatic = 0.00026,
}) {
  const q = useGraphics();
  if (q.postFX === 'off') return null;

  // Posh bonus on top of the per-level intensity: at high quality we push
  // bloom a touch hotter and run a softer/wider radius for that AAA-bloom
  // look. At lower (potato) we don't reach this branch.
  const bloom = bloomIntensity * q.bloomScale * 1.18;
  const bloomRadius = 0.78;

  // KEY the EffectComposer on the active preset id. Switching presets at
  // runtime swaps the composer's child passes AND its `multisampling` —
  // @react-three/postprocessing doesn't reconfigure those cleanly mid-life,
  // which used to produce blink/flicker/garbled frames. Keying forces a
  // clean teardown + remount when the user flips Potato↔High in Settings.
  return (
    <EffectComposer key={q.id} multisampling={q.multisampling}>
      <Bloom
        intensity={bloom}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.42}
        radius={bloomRadius}
        mipmapBlur={q.mipmapBlur}
      />
      {q.postFX !== 'minimal' && (
        <ChromaticAberration offset={[chromatic, chromatic]} radialModulation={false} />
      )}
      {q.postFX === 'ultra' && (
        // Slightly punchier color grade — a touch of warmth lift via small
        // hue rotation per-level + global saturation bump.
        <HueSaturation hue={hue} saturation={0.11} />
      )}
      {q.postFX !== 'minimal' && (
        <Vignette eskil={false} offset={0.22} darkness={vignette} />
      )}
      {q.postFX !== 'minimal' && (
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      )}
      {q.postFX === 'ultra' && (
        // Subtle filmic grain — barely perceptible until you look closely,
        // adds the "shot on camera" feel that lifts the scene out of plastic.
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.06} />
      )}
    </EffectComposer>
  );
}

export default ScenePostFX;
