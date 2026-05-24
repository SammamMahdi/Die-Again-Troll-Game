import { useEffect } from 'react';

// Wires the "R restarts after death" hotkey for a level. Every Level*
// has the same listener; this centralises it.
//
// Only fires while `gameState === 'dead'` so a player can't accidentally
// reset the level mid-run by hitting R.
export default function useRestartOnR(gameState, onRestart) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key && e.key.toLowerCase() === 'r' && gameState === 'dead') {
        onRestart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, onRestart]);
}
