// Per-level Echo Dimension theme configuration.
//
// Each entry describes the "harder, weirder" variant of a main level that
// the player is teleported into when they enter a portal during Hardcore.
//
// `name`     — display title shown on the EchoLevel banner.
// `tagline`  — one-line hint under the title.
// `accent`   — hex color used for the banner accent + violet rim-light tint.
//              Each echo gets its own dominant hue so they read distinct
//              from each other even before the per-level visual themes
//              (Phase 3b.4) land.
// `mechanic` — bag of numeric overrides the inner Level reads when
//              `hardMode` is true. Most levels don't consume all the keys —
//              treat this object as a soft contract. Unknown keys are
//              ignored; missing keys mean "use the level's default".
//
// The universal "warped-prism sky + glitch ambient + violet rim" framing
// is provided by <EchoLevel> regardless of per-level config — so even
// before mechanical overrides are wired in, the echo *feels* different.

export const ECHO_THEMES = {
  1: {
    name: 'Sequence Inverted',
    tagline: 'The order has been reversed.',
    accent: '#ff77aa',
    mechanic: { reverseSequence: true, vanishDelay: 1.6 },
  },
  2: {
    name: 'Bloodlamps',
    tagline: 'A perpetual red phase.',
    accent: '#ff3344',
    mechanic: { permanentRed: true, platformScale: 0.7 },
  },
  3: {
    name: 'The Echo Cave',
    tagline: 'Half of what you see is a lie.',
    accent: '#66ff88',
    mechanic: { sonarAlwaysOn: true, fakeBlockRatio: 0.3, ghostBlockMultiplier: 2 },
  },
  4: {
    name: 'Oil Spill',
    tagline: 'Trust nothing. Especially the blue.',
    accent: '#aa88ff',
    mechanic: { illusionRatio: 0.8, disableLaunchers: true },
  },
  5: {
    name: 'Bladestorm',
    tagline: 'Faster pendulums. Narrower path.',
    accent: '#ff6644',
    mechanic: { pendulumSpeedMul: 1.6, pendulumExtraCount: 4, platformShrink: 0.62 },
  },
  6: {
    name: 'Gravity Well',
    tagline: 'The discs spin twice as fast.',
    accent: '#cc66ff',
    mechanic: { discSpeedMul: 1.8, laserSpeedMul: 1.4 },
  },
  7: {
    name: 'The Black Void',
    tagline: 'A smaller lantern. Hungrier walls.',
    accent: '#bbbbbb',
    mechanic: { lanternRadiusMul: 0.5, wallSpeedMul: 1.8, wallExtraCount: 3 },
  },
  8: {
    name: 'Hall of Mirrors',
    tagline: 'Your shadow has a shadow.',
    accent: '#ff66ff',
    mechanic: { doubleShadow: true, hazardExtraCount: 6 },
  },
  9: {
    name: 'The Storm Eye',
    tagline: 'The wind shifts. The path narrows.',
    accent: '#ffaa44',
    mechanic: { windForceMul: 2.0, platformWidthMul: 0.7 },
  },
  10: {
    name: "Architect's Wrath",
    tagline: 'Five pillars. Faster orb. Smaller arena.',
    accent: '#ffd066',
    mechanic: { pillarCount: 5, orbSpeedMul: 1.4, arenaShrink: 0.92 },
  },
};

export function getEchoTheme(level) {
  return ECHO_THEMES[level] || null;
}

export function getEchoMechanic(level) {
  const t = ECHO_THEMES[level];
  return t ? t.mechanic : {};
}
