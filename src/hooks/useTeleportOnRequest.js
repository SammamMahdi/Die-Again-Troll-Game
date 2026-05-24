import { useEffect } from 'react';

// Phase 3b — every Level watches the RunStatsContext `teleportRequest`
// signal. When App.js bumps it after an echo ends, the level hands the
// position to its Player via playerControlRef.teleportTo(pos). The
// signal value (App uses Date.now()) is what triggers the effect; pos
// is just the payload.
//
// All 10 levels need this exact wiring — centralising it keeps the
// per-level files focused on the unique mechanics.
export default function useTeleportOnRequest(playerControlRef, teleportRequest) {
  useEffect(() => {
    const teleportTo = playerControlRef.current && playerControlRef.current.teleportTo;
    if (teleportRequest && teleportRequest.pos && teleportTo) {
      teleportTo(teleportRequest.pos);
    }
    // signal is the change trigger; pos is read at fire time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teleportRequest && teleportRequest.signal]);
}
