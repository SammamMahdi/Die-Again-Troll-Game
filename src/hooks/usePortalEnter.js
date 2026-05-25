import { useCallback } from 'react';

// Every Level's <Portal onEnter={...}> follows the same pattern:
//   - If the parent (App.js) provided an onPortalEnter callback, forward
//     the portal world position to it (used by Phase 3b portal-teleport
//     routing).
//   - Otherwise (dev / standalone contexts), fall back to flipping the
//     level's local sideQuestCompleteRef — the legacy "touch portal =
//     side-quest complete" behavior.
//
// Returns a stable callback ready to drop into <Portal onEnter={...}>.
export default function usePortalEnter(onPortalEnter, sideQuestCompleteRef) {
  return useCallback((pos) => {
    if (onPortalEnter) {
      onPortalEnter(pos);
    } else if (sideQuestCompleteRef) {
      sideQuestCompleteRef.current = true;
    }
  }, [onPortalEnter, sideQuestCompleteRef]);
}
