import React from 'react';
import './SettingsButton.css';

function SettingsButton({ onClick }) {
  return (
    <button className="settings-button" onClick={onClick} title="Open Settings">
      <span className="settings-button-icon">⚙️</span>
      <span className="settings-button-label">Settings</span>
    </button>
  );
}

export default SettingsButton;
