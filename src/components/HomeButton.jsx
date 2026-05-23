import React from 'react';
import './HomeButton.css';

function HomeButton({ onHome }) {
  return (
    <button className="home-button" onClick={onHome} title="Return to home screen (Esc)">
      <span className="home-icon">🏠</span>
      <span className="home-label">Home</span>
      <kbd className="home-kbd">Esc</kbd>
    </button>
  );
}

export default HomeButton;
