import React, { useState } from 'react';
import {
  getVolumes, setVolume, resetVolumes,
  isMuted, setMuted,
  playUIClick, playUIClose,
} from '../utils/sounds';
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

  const reset = () => {
    resetVolumes();
    setVols(getVolumes());
    playUIClick();
  };

  const handleClose = () => {
    playUIClose();
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={handleClose} aria-label="Close">×</button>
        <h2 className="settings-title">SETTINGS</h2>

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
