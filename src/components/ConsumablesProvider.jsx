import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  CONSUMABLES_CATALOG,
  getInventory, consumeOne, subscribeConsumables,
} from '../utils/consumables';

// State tracked by this provider:
//   - inventory:        { [id]: count } — re-rendered when counts change
//   - speedBoostUntil:  epoch ms (0 if inactive)
//   - magnetUntil:      epoch ms (0 if inactive)
//
// activate(id) burns one of `id` and applies its effect for the catalogue
// duration. Player.jsx reads `speedBoostUntil` each frame to scale velocity.
// Jewel.jsx reads `magnetUntil` to widen its pickup radius.
//
// activeRef gives non-render-triggering live access for per-frame consumers.
const ConsumablesContext = createContext({
  inventory: {},
  activeRef: { current: { speedBoostUntil: 0, magnetUntil: 0 } },
  activate: () => {},
});

export function ConsumablesProvider({ children }) {
  const [inventory, setInventory] = useState(getInventory);
  // Single shared mutable object so the Player + Jewels can poll it each
  // frame without subscribing to re-renders.
  const activeRef = useRef({ speedBoostUntil: 0, magnetUntil: 0 });
  // Mirror for components that DO want to re-render on activation
  // (e.g. an HUD chip turning gold while active).
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return subscribeConsumables(() => setInventory(getInventory()));
  }, []);

  const activate = useCallback((id) => {
    const def = CONSUMABLES_CATALOG.find(c => c.id === id);
    if (!def || !def.duration) return false;
    if ((getInventory()[id] || 0) <= 0) return false;
    if (!consumeOne(id)) return false;
    const until = Date.now() + def.duration * 1000;
    if (id === 'speed_potion') activeRef.current.speedBoostUntil = until;
    if (id === 'jewel_magnet') activeRef.current.magnetUntil = until;
    setTick(t => t + 1);
    return true;
  }, []);

  // Hotkey binding: numeric digits trigger activations. Lives outside
  // any specific level so the player can use potions everywhere they
  // have the keyboard.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key === '1') activate('speed_potion');
      else if (e.key === '2') activate('jewel_magnet');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activate]);

  // Sweep expired effects every 250ms so the HUD chip turns off promptly
  // when a potion runs out. Per-frame consumers don't need this sweep
  // (they read the timestamp directly), but the visual indicator does.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      let changed = false;
      if (activeRef.current.speedBoostUntil && now > activeRef.current.speedBoostUntil) {
        activeRef.current.speedBoostUntil = 0;
        changed = true;
      }
      if (activeRef.current.magnetUntil && now > activeRef.current.magnetUntil) {
        activeRef.current.magnetUntil = 0;
        changed = true;
      }
      if (changed) setTick(t => t + 1);
    }, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <ConsumablesContext.Provider value={{ inventory, activeRef, activate, _tick: tick }}>
      {children}
    </ConsumablesContext.Provider>
  );
}

export function useConsumables() {
  return useContext(ConsumablesContext);
}
