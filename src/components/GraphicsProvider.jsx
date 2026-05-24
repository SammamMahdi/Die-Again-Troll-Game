import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getQuality, subscribeQuality,
  getGridVisible, subscribeGridVisible,
} from '../utils/graphics';

const GraphicsContext = createContext({
  ...getQuality(),
  gridVisible: getGridVisible(),
});
const GridContext = createContext(getGridVisible());

export function GraphicsProvider({ children }) {
  const [preset, setPreset] = useState(getQuality);
  const [gridVisible, setGridVisible] = useState(getGridVisible);

  useEffect(() => {
    const off1 = subscribeQuality(() => setPreset(getQuality()));
    const off2 = subscribeGridVisible(() => setGridVisible(getGridVisible()));
    return () => { off1(); off2(); };
  }, []);

  return (
    <GraphicsContext.Provider value={preset}>
      <GridContext.Provider value={gridVisible}>
        {children}
      </GridContext.Provider>
    </GraphicsContext.Provider>
  );
}

export function useGraphics() {
  return useContext(GraphicsContext);
}

// Grid visibility is its own context so a toggle doesn't force a re-render
// of components that only care about the active quality preset.
export function useGridVisible() {
  return useContext(GridContext);
}
