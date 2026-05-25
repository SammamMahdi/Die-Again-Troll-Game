import React, { useEffect, useState } from 'react';
import {
  getVolumes, setVolume, resetVolumes,
  isMuted, setMuted,
  playUIClick, playUIClose,
} from '../utils/sounds';
import {
  PRESETS, QUALITY_ORDER, getQualityId, setQuality, resetQuality,
  getGridVisible, setGridVisible,
} from '../utils/graphics';
import {
  ACTIONS, getBindings, setBinding, resetBindings, displayKey, subscribeControls,
} from '../utils/controls';
import {
  isFullscreen, toggleFullscreen, subscribeFullscreen,
} from '../utils/fullscreen';
import './Settings.css';

const CHANNELS = [
  { key: 'master',  label: 'Master',      desc: 'Affects everything.' },
  { key: 'sfx',     label: 'Game sounds', desc: 'Jumps, deaths, gates, hazards.' },
  { key: 'ui',      label: 'UI clicks',   desc: 'Buttons and menu navigation.' },
  { key: 'ambient', label: 'Ambient',     desc: 'Background music per level.' },
];

function Settings({ onClose }) {
  const [vols, setVols] = useState(getVolumes());
  const [muted, setMutedState] = useState(isMuted());
  const [quality, setQualityState] = useState(getQualityId());
  const [gridOn, setGridOn] = useState(getGridVisible());
  const [fsOn, setFsOn] = useState(isFullscreen());
  const [bindings, setBindings] = useState(getBindings());
  // While `listeningFor` holds an action id, the next keystroke captures
  // a new binding for it. ESC cancels. Click another action to switch
  // capture target.
  const [listeningFor, setListeningFor] = useState(null);

  useEffect(() => subscribeControls(() => setBindings(getBindings())), []);
  useEffect(() => subscribeFullscreen(setFsOn), []);

  // Global key listener for rebind capture. Active only while
  // listeningFor is set; takes the next keypress as the new binding.
  useEffect(() => {
    if (!listeningFor) return undefined;
    const onKey = (e) => {
      e.preventDefault();
      if (e.key === 'Escape') {
        setListeningFor(null);
        return;
      }
      // Avoid keys the browser uses (Tab, Enter) as bindings — they'd
      // also activate the listening button itself.
      const banned = new Set(['Tab', 'Enter', 'Shift', 'Control', 'Alt', 'Meta']);
      if (banned.has(e.key)) return;
      setBinding(listeningFor, e.key);
      setListeningFor(null);
      playUIClick();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listeningFor]);

  const update = (channel, value) => {
    const v = Number(value);
    setVolume(channel, v);
    setVols(prev => ({ ...prev, [channel]: v }));
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) playUIClick();
  };

  const pickQuality = (id) => {
    setQuality(id);
    setQualityState(id);
    playUIClick();
  };

  const toggleGrid = () => {
    const next = !gridOn;
    setGridVisible(next);
    setGridOn(next);
    playUIClick();
  };

  const toggleFs = () => {
    playUIClick();
    toggleFullscreen();
  };

  const reset = () => {
    resetVolumes();
    resetQuality();
    setVols(getVolumes());
    setQualityState(getQualityId());
    playUIClick();
  };

  const resetControls = () => {
    resetBindings();
    setBindings(getBindings());
    setListeningFor(null);
    playUIClick();
  };

  const startCapture = (actionId) => {
    setListeningFor(actionId);
    playUIClick();
  };

  // Group actions for the rendered list (preserves the ACTIONS-array order).
  const groupedActions = ACTIONS.reduce((acc, a) => {
    if (!acc[a.group]) acc[a.group] = [];
    acc[a.group].push(a);
    return acc;
  }, {});

  const handleClose = () => {
    playUIClose();
    onClose();
  };

  const activePreset = PRESETS[quality];

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={handleClose} aria-label="Close">×</button>
        <h2 className="settings-title">SETTINGS</h2>

        {/* ===== Graphics ===== */}
        <div className="settings-section">
          <div className="settings-section-title">Graphics</div>
          <div className="settings-graphics-row">
            {QUALITY_ORDER.map((id) => {
              const preset = PRESETS[id];
              const active = id === quality;
              return (
                <button
                  key={id}
                  className={`settings-graphics-btn ${active ? 'active' : ''}`}
                  onClick={() => pickQuality(id)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="settings-graphics-tagline">{activePreset.tagline}</div>
          <div className="settings-graphics-note">
            Switching presets restarts the current level — the only way to apply MSAA / antialias cleanly.
          </div>
          <button
            className={`settings-grid-toggle ${gridOn ? 'on' : ''}`}
            onClick={toggleGrid}
          >
            <span className="settings-grid-toggle-box">{gridOn ? '☑' : '☐'}</span>
            <span>Show void grid (under platforms)</span>
          </button>
          <button
            className={`settings-grid-toggle ${fsOn ? 'on' : ''}`}
            onClick={toggleFs}
          >
            <span className="settings-grid-toggle-box">{fsOn ? '☑' : '☐'}</span>
            <span>Fullscreen <kbd style={{ marginLeft: 6, padding: '0 5px', fontSize: '0.7rem', border: '1px solid rgba(160,100,220,0.4)', borderRadius: 4, background: 'rgba(40,10,70,0.6)' }}>F11</kbd></span>
          </button>
        </div>

        {/* ===== Sound ===== */}
        <div className="settings-section">
          <div className="settings-section-title">Sound</div>

          <button
            className={`settings-mute ${muted ? 'settings-mute-on' : ''}`}
            onClick={toggleMute}
          >
            {muted ? '🔇 Sound is muted (click to enable)' : '🔊 Sound is on'}
          </button>

          {CHANNELS.map(ch => (
            <div key={ch.key} className={`settings-slider ${muted ? 'settings-slider-disabled' : ''}`}>
              <div className="settings-slider-head">
                <label htmlFor={`vol-${ch.key}`}>{ch.label}</label>
                <span className="settings-slider-value">{Math.round((vols[ch.key] || 0) * 100)}%</span>
              </div>
              <input
                id={`vol-${ch.key}`}
                type="range"
                min="0" max="1" step="0.01"
                value={vols[ch.key] ?? 0}
                onChange={(e) => update(ch.key, e.target.value)}
                disabled={muted}
                style={{ '--filled': `${(vols[ch.key] || 0) * 100}%` }}
              />
              <div className="settings-slider-desc">{ch.desc}</div>
            </div>
          ))}

          <button className="settings-reset" onClick={reset}>Reset to defaults</button>
        </div>

        {/* ===== Controls ===== */}
        <div className="settings-section">
          <div className="settings-section-title">Controls</div>
          <div className="settings-controls-hint">
            Click a key to rebind. Press <kbd>Esc</kbd> to cancel. Conflicting
            keys reset the other action to its default.
          </div>
          <div className="settings-controls-note">
            <strong>Mouse:</strong> drag anywhere in the level to rotate the
            camera. Arrow keys also rotate (see Camera bindings below).
          </div>
          {Object.keys(groupedActions).map((group) => (
            <div className="settings-controls-group" key={group}>
              <div className="settings-controls-group-title">{group}</div>
              <div className="settings-controls-rows">
                {groupedActions[group].map((a) => {
                  const isListening = listeningFor === a.id;
                  return (
                    <div key={a.id} className="settings-controls-row">
                      <span className="settings-controls-label">{a.label}</span>
                      <button
                        className={`settings-controls-key ${isListening ? 'listening' : ''}`}
                        onClick={() => startCapture(a.id)}
                      >
                        {isListening ? 'Press any key…' : displayKey(bindings[a.id])}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button className="settings-reset" onClick={resetControls}>Reset controls to defaults</button>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">About</div>
          <p className="settings-about">
            <strong>Die Again — Troll Game</strong>. A 10-level 3D platformer with cloud
            accounts and a global leaderboard.
          </p>
          <p className="settings-about settings-about-quiet">
            Sound is procedural (no audio files in the bundle). Ambient loops are tuned per
            level. All settings are saved in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
