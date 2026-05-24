import React from 'react';

// Echo Dimension warp transition — a multi-layer tornado swirl rendered
// above everything else while App.js swaps between the main level and
// its echo (or back). The actual animation is in App.css (the .warp-*
// classes); this component is just the DOM shape so App.js stays free
// of presentation noise.
//
// `phase` is one of 'in' | 'out' | null. When null, nothing renders.
// The phase class flips the CSS animation direction so an exit visually
// unwinds the entry.
function WarpOverlay({ phase }) {
  if (!phase) return null;
  return (
    <div className={`warp-overlay warp-${phase}`} aria-hidden="true">
      <div className="warp-glow" />
      <div className="warp-ribbon warp-ribbon-1" />
      <div className="warp-ribbon warp-ribbon-2" />
      <div className="warp-ribbon warp-ribbon-3" />
      <div className="warp-sparkles" />
    </div>
  );
}

export default WarpOverlay;
