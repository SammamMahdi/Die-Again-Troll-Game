// Procedural sound effects + per-level ambient loops + UI sounds via the
// Web Audio API. No audio files in the bundle — every sound is synthesised.
//
// Mixer channels: master, sfx (gameplay events), ui (button clicks),
// ambient (level loops). Each has its own 0..1 slider in Settings; sounds
// scale by master * channel.

const MUTE_KEY = 'die-again-sound-muted-v1';
const VOL_KEY = 'die-again-volumes-v1';

const DEFAULT_VOLUMES = { master: 0.7, sfx: 1.0, ui: 0.8, ambient: 0.25 };

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

// Install a one-shot primer that resumes the AudioContext on the first
// real user gesture. Without this, sounds scheduled against a suspended
// context's currentTime can be inaudible (they were scheduled "in the past"
// relative to the clock once it finally started).
if (typeof window !== 'undefined') {
  const prime = () => {
    const c = ctx();
    if (c && c.state !== 'running') c.resume().catch(() => {});
  };
  const events = ['pointerdown', 'keydown', 'touchstart', 'click'];
  events.forEach(ev => window.addEventListener(ev, prime, { passive: true }));
}

// Helper: run callback once the context is actually running. If it's already
// running, run synchronously; otherwise resume() first, then run.
function withRunningCtx(fn) {
  const c = ctx();
  if (!c) return;
  if (c.state === 'running') { fn(c); return; }
  c.resume().then(() => fn(c)).catch(() => {});
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
  const ch = channelVolume(channel);
  if (ch <= 0) return;
  withRunningCtx((c) => {
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
  });
}

function noiseBurst({ duration = 0.18, volume = 0.12, freq = 800, delay = 0, channel = 'sfx' }) {
  const ch = channelVolume(channel);
  if (ch <= 0) return;
  withRunningCtx((c) => {
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
  });
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
  if (_ambient && _ambient.level === level) return; // already playing
  stopAmbient();
  withRunningCtx((c) => buildAmbient(c, level));
}

function buildAmbient(c, level) {
  // ===== Master ambient bus =====
  // gain -> lowpass -> (dry to destination) + (delay-feedback "space reverb"
  // tail to destination). The feedback loop gives every note a long cosmic
  // decay so the ambient feels like a vast void, not a synth patch.
  const gain = c.createGain();
  gain.gain.value = 0;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 560;     // very mellow — kills harsh harmonics
  lp.Q.value = 0.4;

  const delay = c.createDelay(4.0);
  delay.delayTime.value = 0.55;
  const feedback = c.createGain();
  feedback.gain.value = 0.42;   // long, washy tail
  const wet = c.createGain();
  wet.gain.value = 0.7;         // tail volume relative to dry

  // Routing
  gain.connect(lp);
  lp.connect(c.destination);    // dry signal
  lp.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);      // feedback loop
  delay.connect(wet).connect(c.destination); // wet tail

  const nodes = [lp, delay, feedback, wet];

  // Per-level void ambience.
  //
  // Each bed is a deep sub-bass + an octave + (optionally) a sparse high
  // shimmer that drifts via a slow LFO. The delay-feedback master tail
  // smears every note into a long cosmic echo, so the actual oscillator
  // volumes are deliberately tiny — the tail carries most of the sound.
  switch (level) {
    case 1: { // Vanishing — open 5th over a void
      nodes.push(...startOsc(c, gain, { freq: 49.00, type: 'sine', volume: 0.10 })); // G1 sub
      nodes.push(...startOsc(c, gain, { freq: 73.42, type: 'sine', volume: 0.06 })); // D2 (5th)
      nodes.push(...startOsc(c, gain, { freq: 587.33, type: 'sine', volume: 0.018, lfoFreq: 0.08, lfoDepth: 4 })); // D5 shimmer
      break;
    }
    case 2: { // Globe Chase — uneasy minor 3rd in deep space
      nodes.push(...startOsc(c, gain, { freq: 55.00, type: 'sine', volume: 0.10 })); // A1
      nodes.push(...startOsc(c, gain, { freq: 65.41, type: 'sine', volume: 0.06 })); // C2 (minor 3rd)
      nodes.push(...startOsc(c, gain, { freq: 440.00, type: 'sine', volume: 0.014, lfoFreq: 0.12, lfoDepth: 6 })); // A4 shimmer
      break;
    }
    case 3: { // Phantom Frost — cold breath of vacuum
      nodes.push(...startOsc(c, gain, { freq: 43.65, type: 'sine', volume: 0.10 })); // F1
      nodes.push(...startOsc(c, gain, { freq: 87.31, type: 'sine', volume: 0.05 })); // F2 octave
      nodes.push(...startNoiseBed(c, gain, { duration: 8.0, volume: 0.03, lowpass: 280 })); // distant wind
      nodes.push(...startOsc(c, gain, { freq: 698.46, type: 'sine', volume: 0.012, lfoFreq: 0.1, lfoDepth: 8 })); // F5 ice
      break;
    }
    case 4: { // Betrayal — beating-frequency dread
      nodes.push(...startOsc(c, gain, { freq: 51.91, type: 'sine', volume: 0.10 })); // G#1
      nodes.push(...startOsc(c, gain, { freq: 52.65, type: 'sine', volume: 0.07 })); // tiny detune ⇒ ~0.7 Hz beat
      nodes.push(...startOsc(c, gain, { freq: 415.30, type: 'sine', volume: 0.012, lfoFreq: 0.07, lfoDepth: 5 })); // G#4
      break;
    }
    case 5: { // Pendulum Pass — slow far-off bell
      nodes.push(...startOsc(c, gain, { freq: 65.41, type: 'sine', volume: 0.10 })); // C2
      nodes.push(...startOsc(c, gain, { freq: 98.00, type: 'sine', volume: 0.05 })); // G2 (5th)
      nodes.push(...startOsc(c, gain, { freq: 523.25, type: 'sine', volume: 0.012, lfoFreq: 0.18, lfoDepth: 7 })); // C5 bell
      break;
    }
    case 6: { // Gauntlet — distant mechanical hum
      nodes.push(...startOsc(c, gain, { freq: 55.00, type: 'sine', volume: 0.10 })); // A1
      nodes.push(...startOsc(c, gain, { freq: 110.00, type: 'sine', volume: 0.05 })); // A2
      nodes.push(...startOsc(c, gain, { freq: 220.00, type: 'sine', volume: 0.014, lfoFreq: 0.2, lfoDepth: 4 })); // A3 hum LFO
      break;
    }
    case 7: { // Eclipse — pure void
      nodes.push(...startOsc(c, gain, { freq: 41.20, type: 'sine', volume: 0.12 })); // E1 sub
      nodes.push(...startNoiseBed(c, gain, { duration: 10.0, volume: 0.02, lowpass: 160 })); // very faint breath
      nodes.push(...startOsc(c, gain, { freq: 82.41, type: 'sine', volume: 0.04, lfoFreq: 0.06, lfoDepth: 0.4 })); // E2
      break;
    }
    case 8: { // Mirror — celestial fifth above the void
      nodes.push(...startOsc(c, gain, { freq: 61.74, type: 'sine', volume: 0.09 })); // B1
      nodes.push(...startOsc(c, gain, { freq: 92.50, type: 'sine', volume: 0.06 })); // F#2 (5th)
      nodes.push(...startOsc(c, gain, { freq: 740.00, type: 'sine', volume: 0.018, lfoFreq: 0.13, lfoDepth: 9 })); // F#5 shimmer
      nodes.push(...startOsc(c, gain, { freq: 988.00, type: 'sine', volume: 0.010, lfoFreq: 0.17, lfoDepth: 7 })); // B5 sparkle
      break;
    }
    case 9: { // Storm Surge — cosmic gale
      nodes.push(...startOsc(c, gain, { freq: 49.00, type: 'sine', volume: 0.07 })); // G1
      nodes.push(...startNoiseBed(c, gain, { duration: 7.0, volume: 0.07, lowpass: 500 })); // wind
      nodes.push(...startOsc(c, gain, { freq: 392.00, type: 'sine', volume: 0.010, lfoFreq: 0.22, lfoDepth: 10 })); // G4 thin
      break;
    }
    case 10: { // Architect — ominous void heartbeat
      nodes.push(...startOsc(c, gain, { freq: 36.71, type: 'sine', volume: 0.12 })); // D1 deep sub
      nodes.push(...startOsc(c, gain, { freq: 55.00, type: 'sine', volume: 0.06 })); // A1 (5th)
      nodes.push(...startOsc(c, gain, { freq: 110.00, type: 'sine', volume: 0.04, lfoFreq: 0.4, lfoDepth: 1.5 })); // A2 pulse
      nodes.push(...startOsc(c, gain, { freq: 880.00, type: 'sine', volume: 0.012, lfoFreq: 0.09, lfoDepth: 6 })); // A5 echo
      break;
    }
    default:
      try { gain.disconnect(); lp.disconnect(); delay.disconnect(); feedback.disconnect(); wet.disconnect(); } catch {}
      return;
  }

  _ambient = { level, gain, nodes };
  applyAmbientGain();
}
