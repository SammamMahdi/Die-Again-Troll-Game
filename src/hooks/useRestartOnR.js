import { useEffect } from 'react';
import { matches } from '../utils/controls';

// Wires the "restart on death" hotkey for a level. The bound key lives
// in the controls table (default 'r') so Settings can remap it.
//
// Only fires while `gameState === 'dead'` so a player can't accidentally
// reset the level mid-run.
export default function useRestartOnR(gameState, onRestart) {
  useEffect(() => {
    const onKey = (e) => {
      if (gameState === 'dead' && matches(e.key, 'restart')) onRestart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, onRestart]);
}
