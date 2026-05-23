// Procedural sound effects + per-level ambient loops + UI sounds via the
// Web Audio API. No audio files in the bundle — every sound is synthesised.
//
// Mixer channels: master, sfx (gameplay events), ui (button clicks),
// ambient (level loops). Each has its own 0..1 slider in Settings; sounds
// scale by master * channel.

const MUTE_KEY = 'die-again-sound-muted-v1';
const VOL_KEY = 'die-again-volumes-v1';

const DEFAULT_VOLUMES = { master: 0.7, sfx: 1.0, ui: 0.8, ambient: 0.45 };

let _ctx = null;
let _muted = (() => {
  try { return localStorage.getItem(MUTE_KEY) === 'true'; }
  catch { return false; }
})();
let _volumes = (() => {
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (raw) return { ...DEFAULT_VOLUMES, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_VOLUMES };
})();

function ctx() {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ctx = new AC();
    } catch {
      return null;
    }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

// ===== Mute + volume API =====
export function setMuted(v) {
  _muted = !!v;
  try { localStorage.setItem(MUTE_KEY, String(_muted)); } catch {}
  applyAmbientGain();
}
export function isMuted() { return _muted; }

export function getVolumes() { return { ..._volumes }; }
export function setVolume(channel, value) {
  if (!(channel in _volumes)) return;
  _volumes[channel] = Math.max(0, Math.min(1, Number(value) || 0));
  try { localStorage.setItem(VOL_KEY, JSON.stringify(_volumes)); } catch {}
  applyAmbientGain();
}
export function resetVolumes() {
  _volumes = { ...DEFAULT_VOLUMES };
  try { localStorage.setItem(VOL_KEY, JSON.stringify(_volumes)); } catch {}
  applyAmbientGain();
}

function channelVolume(channel = 'sfx') {
  if (_muted) return 0;
  return (_volumes.master || 0) * (_volumes[channel] || 0);
}

// ===== One-shot building blocks =====
function tone({ freq, freqEnd, duration, type = 'sine', volume = 0.18, delay = 0, channel = 'sfx' }) {
  const c = ctx();
  if (!c) return;
  const ch = channelVolume(channel);
  if (ch <= 0) return;
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(freq, 1), now);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);
  }
  gain.gain.setValueAtTime(volume * ch, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

function noiseBurst({ duration = 0.18, volume = 0.12, freq = 800, delay = 0, channel = 'sfx' }) {
  const c = ctx();
  if (!c) return;
  const ch = channelVolume(channel);
  if (ch <= 0) return;
  const now = c.currentTime + delay;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + duration);
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume * ch, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(now);
  src.stop(now + duration + 0.05);
}

// ===== Gameplay sounds (sfx channel) =====
export function playJump() {
  tone({ freq: 260, freqEnd: 480, duration: 0.09, type: 'square', volume: 0.14 });
}
export function playDeath() {
  tone({ freq: 240, freqEnd: 55, duration: 0.55, type: 'sawtooth', volume: 0.2 });
  tone({ freq: 120, freqEnd: 30, duration: 0.55, type: 'triangle', volume: 0.14, delay: 0.04 });
  noiseBurst({ duration: 0.3, volume: 0.08, freq: 600, delay: 0.05 });
}
export function playWin() {
  [523.25, 659.25, 783.99].forEach((f, i) => {
    tone({ freq: f, duration: 0.22, type: 'sine', volume: 0.22, delay: i * 0.11 });
  });
  tone({ freq: 1046.5, duration: 0.55, type: 'sine', volume: 0.16, delay: 0.32 });
  tone({ freq: 1318.5, duration: 0.45, type: 'sine', volume: 0.12, delay: 0.36 });
}
export function playDisappear() {
  tone({ freq: 720, freqEnd: 220, duration: 0.16, type: 'triangle', volume: 0.1 });
  noiseBurst({ duration: 0.12, volume: 0.06, freq: 1200 });
}
export function playFall() {
  tone({ freq: 380, freqEnd: 50, duration: 0.55, type: 'sawtooth', volume: 0.13 });
  noiseBurst({ duration: 0.4, volume: 0.07, freq: 400, delay: 0.05 });
}
export function playLaunch() {
  tone({ freq: 180, freqEnd: 540, duration: 0.18, type: 'square', volume: 0.16 });
  tone({ freq: 540, freqEnd: 300, duration: 0.15, type: 'triangle', volume: 0.12, delay: 0.16 });
}
export function playImpact() {
  tone({ freq: 90, freqEnd: 30, duration: 0.25, type: 'sawtooth', volume: 0.22 });
  noiseBurst({ duration: 0.18, volume: 0.16, freq: 400 });
}

// Per-level sfx
export function playShimmer() {
  tone({ freq: 1200, freqEnd: 1800, duration: 0.12, type: 'sine', volume: 0.08 });
  tone({ freq: 1600, duration: 0.18, type: 'sine', volume: 0.06, delay: 0.05 });
}
export function playTeleport() {
  tone({ freq: 1500, freqEnd: 300, duration: 0.25, type: 'sawtooth', volume: 0.13 });
  tone({ freq: 600, freqEnd: 1400, duration: 0.18, type: 'sine', volume: 0.08, delay: 0.1 });
  noiseBurst({ duration: 0.18, volume: 0.06, freq: 1500 });
}
export function playLightRed() {
  tone({ freq: 220, freqEnd: 320, duration: 0.18, type: 'square', volume: 0.14 });
  tone({ freq: 110, freqEnd: 160, duration: 0.22, type: 'triangle', volume: 0.10, delay: 0.06 });
}
export function playLightBlue() {
  tone({ freq: 440, duration: 0.14, type: 'sine', volume: 0.10 });
  tone({ freq: 660, duration: 0.18, type: 'sine', volume: 0.08, delay: 0.06 });
}
export function playCreak() {
  tone({ freq: 200, freqEnd: 80, duration: 0.4, type: 'sawtooth', volume: 0.07 });
  noiseBurst({ duration: 0.4, volume: 0.05, freq: 380 });
}
export function playSonar() {
  tone({ freq: 800, freqEnd: 1600, duration: 0.22, type: 'sine', volume: 0.12 });
  tone({ freq: 600, duration: 0.3, type: 'triangle', volume: 0.08, delay: 0.08 });
}
export function playWarning() {
  tone({ freq: 880, duration: 0.06, type: 'square', volume: 0.12 });
  tone({ freq: 1320, duration: 0.06, type: 'square', volume: 0.08, delay: 0.08 });
}
export function playWindGust() {
  noiseBurst({ duration: 0.5, volume: 0.07, freq: 900 });
  tone({ freq: 220, freqEnd: 60, duration: 0.45, type: 'sine', volume: 0.04, delay: 0.05 });
}
export function playPillarChime() {
  tone({ freq: 880,  duration: 0.35, type: 'sine', volume: 0.20 });
  tone({ freq: 1175, duration: 0.45, type: 'sine', volume: 0.15, delay: 0.1 });
  tone({ freq: 1568, duration: 0.55, type: 'sine', volume: 0.11, delay: 0.2 });
}
export function playOrbSpawn() {
  tone({ freq: 80, freqEnd: 320, duration: 0.32, type: 'sawtooth', volume: 0.16 });
  tone({ freq: 200, freqEnd: 60, duration: 0.4, type: 'triangle', volume: 0.10, delay: 0.1 });
  noiseBurst({ duration: 0.3, volume: 0.08, freq: 400 });
}
export function playGateUnlock() {
  [392, 494, 587, 784].forEach((f, i) => {
    tone({ freq: f, duration: 0.18, type: 'sine', volume: 0.22, delay: i * 0.08 });
  });
  tone({ freq: 1175, duration: 0.5, type: 'sine', volume: 0.16, delay: 0.32 });
  tone({ freq: 1568, duration: 0.4, type: 'sine', volume: 0.12, delay: 0.4 });
}

// ===== UI sounds (ui channel) =====
export function playUIClick() {
  tone({ freq: 880, duration: 0.04, type: 'square', volume: 0.08, channel: 'ui' });
  tone({ freq: 1320, duration: 0.03, type: 'sine', volume: 0.06, channel: 'ui', delay: 0.02 });
}
export function playUIOpen() {
  tone({ freq: 440, freqEnd: 880, duration: 0.12, type: 'sine', volume: 0.10, channel: 'ui' });
}
export function playUIClose() {
  tone({ freq: 880, freqEnd: 440, duration: 0.12, type: 'sine', volume: 0.10, channel: 'ui' });
}

// ===== Ambient loops (ambient channel) =====
//
// Each ambient is a small graph of oscillators (and possibly a noise source)
// routed through a per-ambient gain node. The gain node lives on the master
// graph and is the volume knob we adjust when sliders change.

let _ambient = null; // { level, gain, nodes: [oscillators / sources to stop] }

function startOsc(c, gain, { freq, type = 'sine', volume = 0.2, lfoFreq = 0, lfoDepth = 0 }) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = volume;
  osc.connect(g).connect(gain);
  osc.start();

  const nodes = [osc, g];
  if (lfoFreq > 0 && lfoDepth > 0) {
    const lfo = c.createOscillator();
    lfo.frequency.value = lfoFreq;
    const lfoGain = c.createGain();
    lfoGain.gain.value = lfoDepth;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start();
    nodes.push(lfo, lfoGain);
  }
  return nodes;
}

function startNoiseBed(c, gain, { duration = 4.0, volume = 0.06, lowpass = 800 }) {
  // A pink-ish noise buffer played on loop, filtered low for "wind" beds.
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // Pink-ish via filtering of white noise (rough)
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.value = volume;
  src.connect(filter).connect(g).connect(gain);
  src.start();
  return [src, filter, g];
}

function applyAmbientGain() {
  if (!_ambient) return;
  // Smooth fade to new value to avoid clicks
  const c = ctx();
  if (!c) return;
  const target = channelVolume('ambient');
  const now = c.currentTime;
  _ambient.gain.gain.cancelScheduledValues(now);
  _ambient.gain.gain.setTargetAtTime(target, now, 0.08);
}

export function stopAmbient() {
  if (!_ambient) return;
  const c = ctx();
  const now = c ? c.currentTime : 0;
  try {
    _ambient.gain.gain.setTargetAtTime(0, now, 0.15);
  } catch {}
  // Stop oscillators after a short fade
  const nodes = _ambient.nodes;
  setTimeout(() => {
    for (const n of nodes) {
      try { n.stop && n.stop(); } catch {}
      try { n.disconnect && n.disconnect(); } catch {}
    }
  }, 300);
  _ambient = null;
}

export function startAmbient(level) {
  const c = ctx();
  if (!c) return;
  if (_ambient && _ambient.level === level) return; // already playing
  stopAmbient();

  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(c.destination);
  const nodes = [];

  // Per-level ambience config.
  switch (level) {
    case 1: // Vanishing — slow mystery
      nodes.push(...startOsc(c, gain, { freq: 80, type: 'triangle', volume: 0.55, lfoFreq: 0.15, lfoDepth: 3 }));
      nodes.push(...startOsc(c, gain, { freq: 320, type: 'sine', volume: 0.18, lfoFreq: 0.3, lfoDepth: 10 }));
      break;
    case 2: // Globe Chase — tension
      nodes.push(...startOsc(c, gain, { freq: 90, type: 'triangle', volume: 0.5 }));
      nodes.push(...startOsc(c, gain, { freq: 180, type: 'square', volume: 0.12, lfoFreq: 0.4, lfoDepth: 4 }));
      break;
    case 3: // Phantom Frost — cold wind
      nodes.push(...startOsc(c, gain, { freq: 60, type: 'sine', volume: 0.45 }));
      nodes.push(...startNoiseBed(c, gain, { duration: 6.0, volume: 0.10, lowpass: 700 }));
      nodes.push(...startOsc(c, gain, { freq: 1100, type: 'sine', volume: 0.06, lfoFreq: 0.2, lfoDepth: 40 }));
      break;
    case 4: // Betrayal — discordant
      nodes.push(...startOsc(c, gain, { freq: 90, type: 'triangle', volume: 0.5 }));
      nodes.push(...startOsc(c, gain, { freq: 95, type: 'triangle', volume: 0.20 })); // beating
      nodes.push(...startOsc(c, gain, { freq: 220, type: 'sawtooth', volume: 0.08, lfoFreq: 0.5, lfoDepth: 12 }));
      break;
    case 5: // Pendulum Pass — rhythmic
      nodes.push(...startOsc(c, gain, { freq: 70, type: 'triangle', volume: 0.45 }));
      nodes.push(...startOsc(c, gain, { freq: 220, type: 'sine', volume: 0.18, lfoFreq: 0.6, lfoDepth: 30 }));
      break;
    case 6: // Gauntlet — mechanical
      nodes.push(...startOsc(c, gain, { freq: 110, type: 'square', volume: 0.32 }));
      nodes.push(...startOsc(c, gain, { freq: 220, type: 'sawtooth', volume: 0.10, lfoFreq: 0.8, lfoDepth: 10 }));
      break;
    case 7: // Eclipse — deep void
      nodes.push(...startOsc(c, gain, { freq: 50, type: 'sine', volume: 0.55 }));
      nodes.push(...startNoiseBed(c, gain, { duration: 6.0, volume: 0.04, lowpass: 240 }));
      break;
    case 8: // Mirror — ethereal
      nodes.push(...startOsc(c, gain, { freq: 200, type: 'triangle', volume: 0.30 }));
      nodes.push(...startOsc(c, gain, { freq: 400, type: 'sine', volume: 0.18, lfoFreq: 0.18, lfoDepth: 5 }));
      nodes.push(...startOsc(c, gain, { freq: 800, type: 'sine', volume: 0.06, lfoFreq: 0.35, lfoDepth: 15 }));
      break;
    case 9: // Storm Surge — wind
      nodes.push(...startOsc(c, gain, { freq: 70, type: 'triangle', volume: 0.35 }));
      nodes.push(...startNoiseBed(c, gain, { duration: 5.0, volume: 0.16, lowpass: 1100 }));
      break;
    case 10: // Architect — boss tension
      nodes.push(...startOsc(c, gain, { freq: 55, type: 'square', volume: 0.45 }));
      nodes.push(...startOsc(c, gain, { freq: 90, type: 'triangle', volume: 0.22, lfoFreq: 0.3, lfoDepth: 4 }));
      nodes.push(...startOsc(c, gain, { freq: 180, type: 'sine', volume: 0.10, lfoFreq: 1.2, lfoDepth: 8 })); // pulse
      break;
    default:
      // No ambient (start screen, menus, etc.)
      try { gain.disconnect(); } catch {}
      return;
  }

  _ambient = { level, gain, nodes };
  applyAmbientGain();
}
