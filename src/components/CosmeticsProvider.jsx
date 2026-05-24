import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getCosmetics, getEquippedBody, getEquippedCrown, subscribeCosmetics,
} from '../utils/cosmetics';

// Combined context: every cosmetic-aware component re-renders when the
// equipped or owned set changes. Player.jsx reads equippedBody +
// equippedCrown to apply skins; the Shop UI reads everything.
const CosmeticsContext = createContext({
  state: getCosmetics(),
  body: getEquippedBody(),
  crown: getEquippedCrown(),
});

export function CosmeticsProvider({ children }) {
  const [value, setValue] = useState(() => ({
    state: getCosmetics(),
    body: getEquippedBody(),
    crown: getEquippedCrown(),
  }));

  useEffect(() => {
    return subscribeCosmetics(() => {
      setValue({
        state: getCosmetics(),
        body: getEquippedBody(),
        crown: getEquippedCrown(),
      });
    });
  }, []);

  return (
    <CosmeticsContext.Provider value={value}>
      {children}
    </CosmeticsContext.Provider>
  );
}

export function useCosmetics() {
  return useContext(CosmeticsContext);
}
