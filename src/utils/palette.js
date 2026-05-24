// Per-level theme palette derived from each level's `jewelColor`.
//
// Each level passes a `jewelColor` hex to <Gate>. The same hex feeds three
// helpers below that produce coordinated tones for the gate frame, the gate
// finials, and the goal platform — all in the same hue family but
// differentiable by lightness / saturation so the eye can tell them apart.
//
// Palette intent:
//   - Jewel: vivid, bright, hi-sat        (the focal point)
//   - Finials: bright accent, near-white  (highlights on the gate's corners)
//   - Frame: darker, slightly desaturated (the metallic structure)
//   - Goal platform: soft pastel          (large surface that supports the gate)

import * as THREE from 'three';

// Lighter pastel version of the jewel — used for the goal platform's RGB.
// Returns a [r, g, b] array (0..1) ready for {...COLOR_GOAL} or the existing
// `color` prop on a block.
export function goalPlatformColor(jewelHex) {
  const c = new THREE.Color(jewelHex);
  return [
    Math.min(1, c.r * 0.55 + 0.4),
    Math.min(1, c.g * 0.55 + 0.4),
    Math.min(1, c.b * 0.55 + 0.4),
  ];
}

// Darker, slightly desaturated version of the jewel — used for the gate's
// pillars and top bar (metallic structure tinted by theme).
export function gateFrameColor(jewelHex) {
  const c = new THREE.Color(jewelHex);
  return new THREE.Color(
    Math.max(0, c.r * 0.65 + 0.12),
    Math.max(0, c.g * 0.65 + 0.12),
    Math.max(0, c.b * 0.65 + 0.12),
  );
}

// Bright accent near-white tinted by the jewel — for the gate's corner finials.
export function gateFinialColor(jewelHex) {
  const c = new THREE.Color(jewelHex);
  return new THREE.Color(
    Math.min(1, c.r * 0.4 + 0.6),
    Math.min(1, c.g * 0.4 + 0.6),
    Math.min(1, c.b * 0.4 + 0.6),
  );
}

// Bright edge-outline color for the goal platform — used on <Block edgeColor>.
// Saturated version of the jewel so the gate's surrounding platform reads as
// "this is the goal" rather than the level's normal cyan/red/etc edges.
export function goalEdgeColor(jewelHex) {
  return jewelHex;
}
