import { useState } from 'react';

/**
 * Custom hook for game logic
 * Can be extended for level-specific mechanics
 */
function useGameLogic(levelNumber) {
  const [gameState, setGameState] = useState('playing');
  
  return {
    gameState,
    setGameState
  };
}

export default useGameLogic;
