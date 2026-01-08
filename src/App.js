import React, { useState } from 'react';
import './App.css';
import StartScreen from './components/StartScreen';
import Level1 from './levels/Level1';

function App() {
  const [currentScreen, setCurrentScreen] = useState('start'); // 'start', 'level1', 'level2', 'level3', 'complete'
  const [deathCount, setDeathCount] = useState(0);

  const handleStartGame = () => {
    setDeathCount(0); // Reset death counter
    setCurrentScreen('level1');
  };

  const handleDeath = () => {
    setDeathCount(prev => prev + 1);
  };

  const handleLevelComplete = (levelNumber) => {
    if (levelNumber === 1) {
      setCurrentScreen('level2');
    } else if (levelNumber === 2) {
      setCurrentScreen('level3');
    } else if (levelNumber === 3) {
      setCurrentScreen('complete');
    }
  };

  const handleRestart = (levelNumber) => {
    // Stay in the same level on restart
    // Just triggers the level's internal restart logic
  };

  return (
    <div className="App">
      {currentScreen === 'start' && <StartScreen onStart={handleStartGame} />}
      {currentScreen === 'level1' && (
        <Level1
          deathCount={deathCount}
          onDeath={handleDeath}
          onComplete={() => handleLevelComplete(1)}
          onRestart={handleRestart}
        />
      )}
      {currentScreen === 'level2' && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh', 
          color: 'white',
          fontSize: '24px'
        }}>
          Level 2 - Coming Soon
        </div>
      )}
      {currentScreen === 'level3' && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh', 
          color: 'white',
          fontSize: '24px'
        }}>
          Level 3 - Coming Soon
        </div>
      )}
      {currentScreen === 'complete' && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh', 
          color: 'white',
          fontSize: '24px'
        }}>
          <h1>CONGRATULATIONS!</h1>
          <p>All Levels Complete</p>
          <p>Total Deaths: {deathCount}</p>
          <button onClick={handleRestart} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '18px' }}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
