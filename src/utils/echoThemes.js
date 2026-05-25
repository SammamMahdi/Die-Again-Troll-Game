// Per-level Echo Dimension theme configuration.
//
// Each entry describes the "harder, weirder" variant of a main level that
// the player is teleported into when they enter a portal during Hardcore.
//
// Aesthetic: every echo is rendered in an INFERNAL key — crimson /
// vermilion / molten-gold palettes with clean contrast, never muddy.
// Skies use saturated mid-tone anchors (no pitch-black ceilings) and
// fog is pushed out so the world reads cleanly. Each level still gets
// its own distinct flavor of hell.
//
// Fields:
//  name      — display title shown on the EchoLevel banner
//  tagline   — one-line hint under the title
//  accent    — hex color used for banner accent
//  mechanic  — bag of numeric/boolean overrides the inner echo Level
//              reads. Each Level{N}Echo decides which keys to honor.
//  visual    — atmospheric overrides applied by each echo level

export const ECHO_THEMES = {
  1: {
    name: 'Sequence Inverted',
    tagline: 'Step and the ground cracks behind you.',
    accent: '#ff7755',
    mechanic: { reverseSequence: true, vanishDelay: 1.6 },
    visual: {
      sky: 'radial-gradient(ellipse at 50% 30%, #ff5530 0%, #aa2210 45%, #4a0a05 100%)',
      fogColor: '#3a0a05', fogNear: 50, fogFar: 220,
      ambientColor: '#ffaa77', ambientIntensity: 0.6,
      hemiTop: '#ff7744', hemiBottom: '#3a0a05', hemiIntensity: 0.6,
      sparkleColor: '#ffaa55',
      overlay: 'crackedearth',
    },
  },
  2: {
    name: 'Bloodlamps',
    tagline: 'The light is always red. Always watching.',
    accent: '#ff3344',
    mechanic: { permanentRed: true, platformScale: 0.7 },
    visual: {
      sky: 'radial-gradient(circle at 50% 40%, #aa1122 0%, #5a0410 50%, #1a0205 100%)',
      fogColor: '#2a0408', fogNear: 45, fogFar: 200,
      ambientColor: '#ff5566', ambientIntensity: 0.5,
      hemiTop: '#ff4455', hemiBottom: '#2a0408', hemiIntensity: 0.55,
      sparkleColor: '#ff4466',
      overlay: 'bloodlamps',
    },
  },
  3: {
    name: 'Furnace Echo',
    tagline: 'Half of what burns is a lie.',
    accent: '#ff8833',
    mechanic: { sonarAlwaysOn: true, fakeBlockRatio: 0.3, ghostBlockMultiplier: 2 },
    visual: {
      sky: 'linear-gradient(180deg, #4a1505 0%, #aa3010 50%, #ff6622 100%)',
      fogColor: '#3a0a02', fogNear: 40, fogFar: 180,
      ambientColor: '#ffaa66', ambientIntensity: 0.65,
      hemiTop: '#ff8844', hemiBottom: '#3a0a02', hemiIntensity: 0.65,
      sparkleColor: '#ffaa55',
      overlay: 'infernalwire',
    },
  },
  4: {
    name: 'Magma Slick',
    tagline: 'Trust nothing. Especially the cool tones.',
    accent: '#ff7733',
    mechanic: { illusionRatio: 0.8, disableLaunchers: true },
    visual: {
      sky: 'linear-gradient(135deg, #5a1000 0%, #aa3010 30%, #ff7722 60%, #ffaa44 100%)',
      fogColor: '#4a1200', fogNear: 45, fogFar: 220,
      ambientColor: '#ffbb77', ambientIntensity: 0.7,
      hemiTop: '#ff8844', hemiBottom: '#4a1200', hemiIntensity: 0.65,
      sparkleColor: '#ff9944',
      overlay: 'magmaslick',
    },
  },
  5: {
    name: 'Bladestorm',
    tagline: 'Faster scythes. Lightning lies.',
    accent: '#ff5533',
    mechanic: { pendulumSpeedMul: 1.6, pendulumExtraCount: 4, platformShrink: 0.62 },
    visual: {
      sky: 'linear-gradient(180deg, #4a0a02 0%, #8a2008 40%, #4a0a02 100%)',
      fogColor: '#3a0c05', fogNear: 45, fogFar: 200,
      ambientColor: '#ff8855', ambientIntensity: 0.55,
      hemiTop: '#ff7755', hemiBottom: '#2a0a02', hemiIntensity: 0.55,
      sparkleColor: '#ff5533',
      overlay: 'hellstorm',
    },
  },
  6: {
    name: "Ifrit's Eye",
    tagline: 'The pit pulls. The discs scream.',
    accent: '#ff6622',
    mechanic: { discSpeedMul: 1.8, laserSpeedMul: 1.4, gravityPull: 1.5 },
    visual: {
      sky: 'radial-gradient(ellipse at 50% 50%, #ffaa44 0%, #aa3010 30%, #3a0a02 100%)',
      fogColor: '#2a0a02', fogNear: 50, fogFar: 260,
      ambientColor: '#ff8844', ambientIntensity: 0.6,
      hemiTop: '#ff8844', hemiBottom: '#2a0a02', hemiIntensity: 0.6,
      sparkleColor: '#ffaa44',
      overlay: 'ifritseye',
    },
  },
  7: {
    name: 'The Void Throat',
    tagline: 'Less light. More teeth.',
    accent: '#ff4422',
    mechanic: { lanternRadiusMul: 0.5, wallSpeedMul: 1.8, wallExtraCount: 3 },
    visual: {
      // Keep this one dark — it's the LANTERN level. Brightening the
      // sky defeats the gimmick. But warm the near tones a touch so
      // the walls + path read clean instead of muddy.
      sky: 'radial-gradient(ellipse at 50% 50%, #2a0a05 0%, #0a0200 80%, #000000 100%)',
      fogColor: '#0a0200', fogNear: 38, fogFar: 70,
      ambientColor: '#552210', ambientIntensity: 0.25,
      hemiTop: '#552211', hemiBottom: '#000000', hemiIntensity: 0.3,
      sparkleColor: '#ff6644',
      overlay: 'voidthroat',
    },
  },
  8: {
    name: 'Hall of Mirrors',
    tagline: 'Three of you. Three deaths.',
    accent: '#ff4466',
    mechanic: { doubleShadow: true, hazardExtraCount: 6 },
    visual: {
      sky: 'linear-gradient(180deg, #aa1133 0%, #5a0820 50%, #2a0410 100%)',
      fogColor: '#3a0a18', fogNear: 50, fogFar: 240,
      ambientColor: '#ff6688', ambientIntensity: 0.65,
      hemiTop: '#ff5577', hemiBottom: '#2a0410', hemiIntensity: 0.6,
      sparkleColor: '#ff5577',
      overlay: 'obsidianmirrors',
    },
  },
  9: {
    name: 'The Storm Eye',
    tagline: 'The ash shifts. Time your hops.',
    accent: '#ff9933',
    mechanic: { windForceMul: 2.0, platformWidthMul: 0.7, randomGusts: true, calmInterval: 1.5 },
    visual: {
      sky: 'linear-gradient(180deg, #2a0a02 0%, #8a2810 30%, #ee5520 65%, #ffaa44 100%)',
      fogColor: '#4a1408', fogNear: 50, fogFar: 220,
      ambientColor: '#ffaa66', ambientIntensity: 0.7,
      hemiTop: '#ffbb77', hemiBottom: '#2a0a02', hemiIntensity: 0.6,
      sparkleColor: '#ff9944',
      overlay: 'ashstorm',
    },
  },
  10: {
    name: "Architect's Wrath",
    tagline: 'Five pillars. The arena shrinks.',
    accent: '#ff8822',
    mechanic: { pillarCount: 5, orbSpeedMul: 1.4, arenaShrink: 0.92, iceEverywhere: true },
    visual: {
      sky: 'radial-gradient(ellipse at 50% 40%, #5a1810 0%, #2a0808 60%, #0a0402 100%)',
      fogColor: '#1a0604', fogNear: 50, fogFar: 240,
      ambientColor: '#ff9944', ambientIntensity: 0.55,
      hemiTop: '#ffbb55', hemiBottom: '#1a0604', hemiIntensity: 0.5,
      sparkleColor: '#ff8822',
      overlay: 'infernofiligree',
    },
  },
};

export function getEchoTheme(level) {
  return ECHO_THEMES[level] || null;
}

export function getEchoMechanic(level) {
  const t = ECHO_THEMES[level];
  return t ? t.mechanic : {};
}

export function getEchoVisual(level) {
  const t = ECHO_THEMES[level];
  return t && t.visual ? t.visual : null;
}
