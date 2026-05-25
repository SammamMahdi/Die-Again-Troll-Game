import React from 'react';
import { getEchoVisual } from '../utils/echoThemes';
import './EchoVisualOverlay.css';

// Phase 3b.4 — per-level atmospheric CSS layer above the canvas. Each
// echo gets a distinct overlay (scanlines, embers, lightning, gold
// filigree, etc.) so the dimensions read as visually unique even
// without changing 3D geometry. The class name is selected by
// `theme.visual.overlay` from echoThemes.
//
// Rendered by <EchoLevel> (not by individual Level files) so the
// per-level Level component stays focused on its 3D scene.
function EchoVisualOverlay({ level }) {
  const visual = getEchoVisual(level);
  if (!visual || !visual.overlay) return null;
  return <div className={`echo-fx echo-fx-${visual.overlay}`} aria-hidden="true" />;
}

export default EchoVisualOverlay;
