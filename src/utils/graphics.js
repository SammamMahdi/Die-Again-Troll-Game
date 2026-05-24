// Global graphics-quality preset.
//
// Two-tier picker in Settings: Potato (maximum performance) or High
// (everything on). Mirrors the audio-mixer pattern in src/utils/sounds.js.

const STORAGE_KEY = 'die-again-graphics-v1';
const CHANGE_EVENT = 'die-again-graphics-changed';

export const QUALITY_ORDER = ['potato', 'high'];

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
    l7FogFar: 14,
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
    l7FogFar: 18,
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
