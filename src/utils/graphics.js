// Global graphics-quality preset.
//
// Four-tier picker in Settings: Potato (maximum performance), Medium
// (balanced — the sweet spot for integrated GPUs), High (everything on,
// needs a discrete GPU), or Very High (the same plus heavier bloom,
// higher MSAA, denser particles, mipmap-blur — for high-end GPUs / 4K).
// Mirrors the audio-mixer pattern in src/utils/sounds.js.

const STORAGE_KEY = 'die-again-graphics-v1';
const CHANGE_EVENT = 'die-again-graphics-changed';
// Independent toggle for the cosmetic ground grid. Lives in localStorage on
// its own key so it survives preset switches and can be flipped freely.
const GRID_KEY = 'die-again-grid-v1';
const GRID_EVENT = 'die-again-grid-changed';

export const QUALITY_ORDER = ['potato', 'medium', 'high', 'veryHigh'];

// `postFX` is read by ScenePostFX.jsx:
//   'off'     → render nothing (early return)
//   'minimal' → Bloom only (skip Chromatic, Vignette, ToneMapping)
//   anything  → Bloom + Chromatic + Vignette + ACES tone mapping
//   else      else (e.g. 'medium')
//   'ultra'   → above + HueSaturation grade + filmic grain
export const PRESETS = {
  potato: {
    id: 'potato',
    label: 'Potato',
    tagline: 'Maximum performance. No bloom, no particles, no bevels, no neon edges, no player trail. Built for very old hardware or weak GPUs.',
    // PostFX
    postFX: 'off',
    bloomScale: 0,
    multisampling: 0,
    mipmapBlur: false,
    // Renderer
    antialias: false,
    dprCap: 1,
    // Background
    starsScale: 0,
    sparklesScale: 0,
    // Player VFX
    trailSegments: 0,
    dustParticles: 0,
    minimalPlayer: true,         // strip crown, ground halo, inner head core
    // Geometry
    useRoundedBox: false,
    roundedBoxSmoothness: 1,
    minimalEdges: true,          // skip <Edges> outlines on blocks
    // Lighting
    minimalLights: true,         // skip accent point lights per level
    l7FogFar: 56,                // ramp from fog NEAR (~38) to pitch black
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    tagline: 'Balanced. Bloom, chromatic aberration, vignette, ACES tone mapping, 2× MSAA, half-density stars + sparkles, bevelled geometry, neon edges, modest player trail. Skips hue grading + filmic grain. Sweet spot for integrated GPUs.',
    // PostFX (kept on but lighter — Bloom + Chrom + Vignette + ACES, no Hue / grain)
    postFX: 'medium',
    bloomScale: 0.65,
    multisampling: 2,
    mipmapBlur: false,
    // Renderer (AA on, half-DPR cap)
    antialias: true,
    dprCap: 1.5,
    // Background (half density)
    starsScale: 0.55,
    sparklesScale: 0.55,
    // Player VFX (modest)
    trailSegments: 8,
    dustParticles: 5,
    minimalPlayer: false,
    // Geometry (bevels on, less smooth)
    useRoundedBox: true,
    roundedBoxSmoothness: 2,
    minimalEdges: false,
    // Lighting (accent point lights on)
    minimalLights: false,
    l7FogFar: 62,                // between Potato (56) and High (68)
  },
  high: {
    id: 'high',
    label: 'High',
    tagline: 'Everything on. Bloom, chromatic aberration, vignette, ACES tone mapping, hue tinting, 4× MSAA, all particles, full bevelled geometry, neon edges, player trail and landing dust. Needs a discrete GPU.',
    postFX: 'ultra',
    bloomScale: 1.0,
    multisampling: 4,
    mipmapBlur: false,           // off — caused a visible flicker on some GPUs
    antialias: true,
    dprCap: 2,
    starsScale: 1.0,
    sparklesScale: 1.0,
    trailSegments: 14,
    dustParticles: 10,
    minimalPlayer: false,
    useRoundedBox: true,
    roundedBoxSmoothness: 4,
    minimalEdges: false,
    minimalLights: false,
    l7FogFar: 68,                // longer ramp for smoother fade on High
  },
  veryHigh: {
    id: 'veryHigh',
    label: 'Very High',
    tagline: 'Maxed out. Heavier bloom + mipmap-blur bleed, 8× MSAA, 2.5× device-pixel-ratio cap, denser stars + sparkles, longer player trail and extra landing dust, smoother bevels. For high-end discrete GPUs on 1440p / 4K displays.',
    postFX: 'ultra',
    bloomScale: 1.4,             // heavier glow halo on emissive surfaces
    multisampling: 8,             // 8× MSAA on the postprocess composer
    mipmapBlur: true,             // softer, prettier bloom bleed (was flickery
                                  //   on weaker GPUs at High — fine on Very High)
    antialias: true,
    dprCap: 2.5,                  // lets HiDPI displays render at near-native rez
    starsScale: 1.5,              // denser starfield
    sparklesScale: 1.5,           // denser particle clouds
    trailSegments: 22,            // longer afterimage trail
    dustParticles: 16,            // bigger landing dust burst
    minimalPlayer: false,
    useRoundedBox: true,
    roundedBoxSmoothness: 6,      // even smoother platform bevels
    minimalEdges: false,
    minimalLights: false,
    l7FogFar: 72,                 // longest fog ramp — softest dark fade
  },
};

const DEFAULT_QUALITY = 'high';

function loadQualityId() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && PRESETS[v]) return v;
  } catch {}
  return DEFAULT_QUALITY;
}

let _quality = loadQualityId();

export function getQuality() {
  return PRESETS[_quality];
}

export function getQualityId() {
  return _quality;
}

export function setQuality(id) {
  if (!PRESETS[id]) return;
  if (id === _quality) return;
  _quality = id;
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  dispatchChange();
}

export function resetQuality() {
  setQuality(DEFAULT_QUALITY);
}

function dispatchChange() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {}
}

export function subscribeQuality(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

// ----- Cosmetic grid toggle (independent of the quality preset) -----

function loadGridVisible() {
  try {
    const v = localStorage.getItem(GRID_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {}
  return false;   // default: off (clean void background)
}

let _gridVisible = loadGridVisible();

export function getGridVisible() {
  return _gridVisible;
}

export function setGridVisible(visible) {
  const next = !!visible;
  if (next === _gridVisible) return;
  _gridVisible = next;
  try { localStorage.setItem(GRID_KEY, next ? '1' : '0'); } catch {}
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent(GRID_EVENT)); } catch {}
  }
}

export function subscribeGridVisible(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(GRID_EVENT, handler);
  return () => window.removeEventListener(GRID_EVENT, handler);
}
