import { useEffect } from 'react';
import { isCloudEnabled, fetchMyScore } from '../firebase';
import { saveProgress } from '../utils/rewards';
import { setJewelsFromCloud } from '../utils/jewels';
import { applyCloudCosmetics } from '../utils/cosmetics';
import { applyCloudInventory } from '../utils/consumables';

const EMPTY_PROGRESS = {
  bestDeaths: {}, bestTimes: {}, medals: {},
  achievements: [], totalRuns: 0, totalCompletes: 0, lastRun: null,
};

// Owns the auth → local progress sync side-effect.
//
//   - Signed-out: clear local progress so the previous account's data
//     isn't visible to whoever uses this device next.
//   - Signed-in: pull the cloud doc; the cloud is the truth.
//     Replace local display + persisted storage with the cloud
//     snapshot, and apply cloud-side jewel balance, cosmetics, and
//     consumable counts.
//
// `setPersistedProgress` is the App-level setter for the in-memory
// progress mirror. The hook depends on `authUser` so any sign-in /
// sign-out toggle re-runs the effect.
export default function useCloudProgressSync(authUser, setPersistedProgress) {
  useEffect(() => {
    if (!isCloudEnabled()) return undefined;

    // Signed out — wipe local mirror + storage.
    if (!authUser) {
      setPersistedProgress(EMPTY_PROGRESS);
      saveProgress(EMPTY_PROGRESS);
      return undefined;
    }

    // Signed in — fetch + overwrite local with cloud truth.
    let cancelled = false;
    fetchMyScore(authUser.uid)
      .then((cloudData) => {
        if (cancelled) return;
        const adapted = cloudData
          ? {
              bestDeaths: cloudData.bestDeaths || {},
              bestTimes: cloudData.bestTimes || {},
              medals: cloudData.medals || {},
              achievements: cloudData.achievements || [],
              totalRuns: cloudData.totalRuns || 0,
              totalCompletes: cloudData.totalCompletes || 0,
              lastRun: cloudData.lastRun || null,
            }
          : EMPTY_PROGRESS;
        setPersistedProgress(adapted);
        saveProgress(adapted);
        if (cloudData && typeof cloudData.jewels === 'number') {
          setJewelsFromCloud(cloudData.jewels);
        }
        if (cloudData && cloudData.cosmetics) {
          applyCloudCosmetics(cloudData.cosmetics);
        }
        if (cloudData && cloudData.consumables) {
          applyCloudInventory(cloudData.consumables);
        }
        // eslint-disable-next-line no-console
        console.log('[progress sync] loaded for', authUser.email,
          'medals:', Object.keys(adapted.medals).length,
          'achievements:', adapted.achievements.length,
          'jewels:', cloudData?.jewels ?? 0);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[progress sync] failed to read cloud doc:', err?.message || err);
        if (cancelled) return;
        setPersistedProgress(EMPTY_PROGRESS);
        saveProgress(EMPTY_PROGRESS);
      });
    return () => { cancelled = true; };
  }, [authUser, setPersistedProgress]);
}
