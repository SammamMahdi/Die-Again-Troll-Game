// Procedural sound effects via the Web Audio API. No audio files needed —
// every sound is generated from oscillators + envelopes on the fly.
//
// AudioContext can't start audio until a user gesture, so the first call
// resumes it (any button click in the UI counts as a gesture).

const STORAGE_KEY = 'die-again-sound-muted-v1';
const MASTER_GAIN = 0.55;

let _ctx = null;
let _muted = (() => {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
  catch { return false; }
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

export function setMuted(v) {
  _muted = !!v;
  try { localStorage.setItem(STORAGE_KEY, String(_muted)); } catch {}
}

export function isMuted() {
  return _muted;
}

// Single tone with linear/exponential pitch sweep + exponential gain envelope.
function tone({ freq, freqEnd, duration, type = 'sine', volume = 0.18, delay = 0 }) {
  const c = ctx();
  if (!c || _muted) return;
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(freq, 1), now);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);
  }
  gain.gain.setValueAtTime(volume * MASTER_GAIN, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

// Quick noise burst with low-pass for "whoosh" sounds.
function noiseBurst({ duration = 0.18, volume = 0.12, freq = 800, delay = 0 }) {
  const c = ctx();
  if (!c || _muted) return;
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
  gain.gain.setValueAtTime(volume * MASTER_GAIN, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(now);
  src.stop(now + duration + 0.05);
}

// Quick ascending blip
export function playJump() {
  tone({ freq: 260, freqEnd: 480, duration: 0.09, type: 'square', volume: 0.14 });
}

// Descending sawtooth — gloomy
export function playDeath() {
  tone({ freq: 240, freqEnd: 55, duration: 0.55, type: 'sawtooth', volume: 0.2 });
  tone({ freq: 120, freqEnd: 30, duration: 0.55, type: 'triangle', volume: 0.14, delay: 0.04 });
  noiseBurst({ duration: 0.3, volume: 0.08, freq: 600, delay: 0.05 });
}

// Three-note arpeggio + bell tail (cheerful)
export function playWin() {
  const notes = [523.25, 659.25, 783.99];   // C5, E5, G5
  notes.forEach((f, i) => {
    tone({ freq: f, duration: 0.22, type: 'sine', volume: 0.22, delay: i * 0.11 });
  });
  // High bell tail
  tone({ freq: 1046.5, duration: 0.55, type: 'sine', volume: 0.16, delay: 0.32 });
  tone({ freq: 1318.5, duration: 0.45, type: 'sine', volume: 0.12, delay: 0.36 });
}

// Short whoosh — block vanish / sequence shift
export function playDisappear() {
  tone({ freq: 720, freqEnd: 220, duration: 0.16, type: 'triangle', volume: 0.1 });
  noiseBurst({ duration: 0.12, volume: 0.06, freq: 1200 });
}

// Falling object — descending sawtooth with rumble
export function playFall() {
  tone({ freq: 380, freqEnd: 50, duration: 0.55, type: 'sawtooth', volume: 0.13 });
  noiseBurst({ duration: 0.4, volume: 0.07, freq: 400, delay: 0.05 });
}

// Launcher / boing — quick rising warble
export function playLaunch() {
  tone({ freq: 180, freqEnd: 540, duration: 0.18, type: 'square', volume: 0.16 });
  tone({ freq: 540, freqEnd: 300, duration: 0.15, type: 'triangle', volume: 0.12, delay: 0.16 });
}

// Heavy impact / orb chase hit — used for L10 if desired
export function playImpact() {
  tone({ freq: 90, freqEnd: 30, duration: 0.25, type: 'sawtooth', volume: 0.22 });
  noiseBurst({ duration: 0.18, volume: 0.16, freq: 400 });
}
