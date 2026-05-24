import React, { createContext, useContext, useEffect, useState } from 'react';
import { getJewels, subscribeJewels } from '../utils/jewels';

// Tiny context that re-renders consumers whenever the jewel balance
// changes (pickup, shop spend, cloud sync). Mirrors GraphicsProvider.
const JewelContext = createContext(getJewels());

export function JewelProvider({ children }) {
  const [balance, setBalance] = useState(getJewels);

  useEffect(() => {
    return subscribeJewels(() => setBalance(getJewels()));
  }, []);

  return (
    <JewelContext.Provider value={balance}>
      {children}
    </JewelContext.Provider>
  );
}

export function useJewels() {
  return useContext(JewelContext);
}
