import { useEffect } from 'react';
import { VICTORY_DELAY_MS } from '../constants/gameConstants';

// Every level fires onComplete on a 1500ms delay once it enters the
// 'won' state — gives the player a beat to see the victory animation
// before the reward screen takes over. Centralised here so each level
// just calls `useVictoryTimer(gameState, () => onComplete(arg))`.
//
// The callback fires lazily inside the effect so callers can close over
// fresh state (e.g. `sideQuestCompleteRef.current`) at fire time.
export default function useVictoryTimer(gameState, onWin, delay = VICTORY_DELAY_MS) {
  useEffect(() => {
    if (gameState !== 'won') return undefined;
    const t = setTimeout(() => onWin(), delay);
    return () => clearTimeout(t);
  }, [gameState, onWin, delay]);
}
