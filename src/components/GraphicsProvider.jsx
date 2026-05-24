import React, { createContext, useContext, useEffect, useState } from 'react';
import { getQuality, subscribeQuality } from '../utils/graphics';

const GraphicsContext = createContext(getQuality());

export function GraphicsProvider({ children }) {
  const [preset, setPreset] = useState(getQuality);

  useEffect(() => {
    return subscribeQuality(() => setPreset(getQuality()));
  }, []);

  return (
    <GraphicsContext.Provider value={preset}>
      {children}
    </GraphicsContext.Provider>
  );
}

export function useGraphics() {
  return useContext(GraphicsContext);
}
