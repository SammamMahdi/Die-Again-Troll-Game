import React from 'react';
import { ABILITY_HINTS } from './Guide';
import './AbilityHUD.css';

function AbilityHUD({ level }) {
  const entry = ABILITY_HINTS[level];
  if (!entry) return null;
  return (
    <div
      className="ability-hud"
      style={{ '--ah-accent': entry.accent }}
      title={entry.ability}
    >
      <div className="ability-hud-label">This level</div>
      <div className="ability-hud-text">{entry.hint}</div>
    </div>
  );
}

export default AbilityHUD;
