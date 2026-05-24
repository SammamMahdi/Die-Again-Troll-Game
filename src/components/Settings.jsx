import React, { useState } from 'react';
import {
  getVolumes, setVolume, resetVolumes,
  isMuted, setMuted,
  playUIClick, playUIClose,
} from '../utils/sounds';
import {
  PRESETS, QUALITY_ORDER, getQualityId, setQuality, resetQuality,
  getGridVisible, setGridVisible,
} from '../utils/graphics';
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

  const reset = () => {
    resetVolumes();
    resetQuality();
    setVols(getVolumes());
    setQualityState(getQualityId());
    playUIClick();
  };

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
