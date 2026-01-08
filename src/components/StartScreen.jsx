import React from 'react';
import './StartScreen.css';

function StartScreen({ onStart }) {
  return (
    <div className="start-screen">
      <h1 className="title">DIE AGAIN - TROLL GAME</h1>
      <button className="start-button" onClick={onStart}>
        Click to Start
      </button>
      <div className="controls">
        <p>Controls:</p>
        <p>WASD - Move</p>
        <p>SPACE - Jump</p>
        <p>Arrow Keys - Rotate Camera</p>
        <p>R - Restart Level</p>
        <p>ESC/Q - Quit to Menu</p>
      </div>
    </div>
  );
}

export default StartScreen;
