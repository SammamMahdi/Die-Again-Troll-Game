import React, { useEffect } from 'react';
import { getEchoTheme } from '../utils/echoThemes';
import { startEchoAmbient, stopEchoAmbient } from '../utils/sounds';
import EchoVisualOverlay from './EchoVisualOverlay';
import './EchoLevel.css';

// EchoLevel wraps the inner Level component during a portal-teleport
// session and provides the universal "you're not in the real world"
// framing on top of whatever the child level renders:
//
//  - A warped-prism violet→magenta→black gradient overlay covers the
//    sky behind the level (positioned absolutely behind the canvas).
//  - A glitch ambient drone starts on mount and stops on unmount, layered
//    over (not replacing) the per-level ambient — so the player still
//    hears, say, L5's pendulum bass beneath the warble.
//  - A vignette + chromatic-aberration tint overlay sits above the canvas
//    to oil-slick the edges.
//  - A top banner announces the echo's name + tagline so the player
//    immediately knows which echo they're in.
//
// The inner level component is unmodified except for receiving
// `hardMode={true}` (so it reads from echoThemes for tightened
// constants where wired) and the same Player / Portal callbacks the
// main level uses, redirected by App.js.
function EchoLevel({ level, children }) {
  const theme = getEchoTheme(level);

  useEffect(() => {
    startEchoAmbient();
    return () => stopEchoAmbient();
  }, []);

  return (
    <div className="echo-wrap">
      {/* Warped-prism sky behind the canvas (z-index < canvas). The level's
          own background still renders inside the canvas, but most of our
          levels use semi-transparent fog gradients so this leaks through
          enough to read as "wrong sky". */}
      <div className="echo-sky" aria-hidden="true" />

      {children}

      {/* Phase 3b.4 per-level atmospheric overlay (scanlines, embers,
          lightning, gold filigree, …). Sits above the canvas but below
          the banner and vignette. */}
      <EchoVisualOverlay level={level} />

      {/* Top banner — fixed position, doesn't block canvas pointer events. */}
      <div className="echo-banner">
        <div className="echo-banner-tag">ECHO DIMENSION</div>
        {theme && (
          <>
            <div className="echo-banner-name" style={{ color: theme.accent }}>
              {theme.name}
            </div>
            <div className="echo-banner-tagline">{theme.tagline}</div>
          </>
        )}
      </div>

      {/* Oil-slick edge overlay above the canvas — pointer-events:none so
          the canvas still gets clicks/drags for camera control. */}
      <div className="echo-vignette" aria-hidden="true" />
    </div>
  );
}

export default EchoLevel;
