import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  CONSUMABLES_CATALOG,
  getInventory, getUpgrades, consumeOne, subscribeConsumables,
  getEffectiveDuration, getEffectiveTier,
} from '../utils/consumables';
import { matches } from '../utils/controls';
import {
  playPotionMagnet, playPotionGhost, playPotionEmpty,
} from '../utils/sounds';

const POTION_SOUND = {
  jewel_magnet:        playPotionMagnet,
  invisibility_potion: playPotionGhost,
};

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
  activeRef: { current: {
    magnetUntil: 0,
    magnetRadius: 0,
    magnetStrength: 0,
    invisibleUntil: 0,
  }},
  activate: () => {},
});

export function ConsumablesProvider({ children }) {
  const [inventory, setInventory] = useState(getInventory);
  // Upgrade levels are stored alongside counts in the consumables module
  // but change less often. Tracking them here makes the Shop re-render
  // immediately when the player buys an upgrade.
  const [upgrades, setUpgrades] = useState(getUpgrades);
  // Single shared mutable object so the Player + Jewels + level Sims can
  // poll it each frame without subscribing to re-renders.
  //   magnetRadius / magnetStrength are written when a magnet potion is
  //   activated. Jewels read them per frame to pull themselves toward
  //   the player; reading 0 means no pull active.
  const activeRef = useRef({
    magnetUntil: 0,
    magnetRadius: 0,
    magnetStrength: 0,
    invisibleUntil: 0,
  });
  // Mirror for components that DO want to re-render on activation
  // (e.g. an HUD chip turning gold while active).
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return subscribeConsumables(() => {
      // Always allocate fresh objects so React picks up the change even
      // when only one of inventory / upgrades was actually mutated. The
      // dispatch event is fired for any change to either map.
      setInventory({ ...getInventory() });
      setUpgrades({ ...getUpgrades() });
    });
  }, []);

  const activate = useCallback((id) => {
    const def = CONSUMABLES_CATALOG.find(c => c.id === id);
    // Only the three time-bounded potions activate by hotkey. Extra Life
    // has no baseDuration; it's prompt-on-death.
    if (!def || !def.baseDuration) return false;
    if ((getInventory()[id] || 0) <= 0) {
      playPotionEmpty();
      return false;
    }
    if (!consumeOne(id)) return false;
    const sound = POTION_SOUND[id];
    if (sound) sound();
    // Per-tier duration: scales with the player's upgrade level for this id.
    const durationSec = getEffectiveDuration(id);
    const now = Date.now();
    const addMs = durationSec * 1000;
    // Duration stacking — re-activating while an effect is still live ADDS
    // the new duration to the remaining timer instead of resetting it.
    if (id === 'jewel_magnet') {
      const prev = activeRef.current.magnetUntil;
      activeRef.current.magnetUntil = (prev > now ? prev : now) + addMs;
      // Magnet radius + pull-strength come from the current tier. They're
      // re-written on every activation so a freshly-upgraded magnet takes
      // effect immediately. Jewel.jsx reads these per frame.
      const tier = getEffectiveTier(id);
      if (tier) {
        activeRef.current.magnetRadius   = tier.radius;
        activeRef.current.magnetStrength = tier.strength;
      }
    }
    if (id === 'invisibility_potion') {
      const prev = activeRef.current.invisibleUntil;
      activeRef.current.invisibleUntil = (prev > now ? prev : now) + addMs;
    }
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
      // Hotkeys live in the rebindable Controls table — Settings can
      // remap either potion slot.
      if (matches(e.key, 'potionMagnet'))     activate('jewel_magnet');
      else if (matches(e.key, 'potionGhost')) activate('invisibility_potion');
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
      if (activeRef.current.magnetUntil && now > activeRef.current.magnetUntil) {
        activeRef.current.magnetUntil = 0;
        activeRef.current.magnetRadius = 0;
        activeRef.current.magnetStrength = 0;
        changed = true;
      }
      if (activeRef.current.invisibleUntil && now > activeRef.current.invisibleUntil) {
        activeRef.current.invisibleUntil = 0;
        changed = true;
      }
      if (changed) setTick(t => t + 1);
    }, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <ConsumablesContext.Provider value={{ inventory, upgrades, activeRef, activate, _tick: tick }}>
      {children}
    </ConsumablesContext.Provider>
  );
}

export function useConsumables() {
  return useContext(ConsumablesContext);
}

// Tiny helper for hazard-collision Sims: returns a function that checks
// whether invisibility is currently live. Cheaper than dragging the
// whole context in just to read one field.
export function useIsInvisibleNow() {
  const { activeRef } = useContext(ConsumablesContext);
  return () => activeRef.current.invisibleUntil > Date.now();
}
