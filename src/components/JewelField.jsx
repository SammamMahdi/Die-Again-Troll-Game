import React, { useMemo } from 'react';
import Jewel from './Jewel';
import { useRunStats } from './RunStatsContext';

// Random-subset spawner for a level's jewel candidate pool. On mount,
// rolls which candidates appear. Re-rolls on remount (which happens on
// any level restart / preset change, via the levelN-{qid} key in App.js).
//
// Props:
//   candidates: { common: [{x,y,z}, ...], bonus: [{x,y,z}, ...] }
//   commonCount: how many common jewels to spawn (default 5)
//   bonusCount:  how many bonus jewels to spawn (default 2)
//   playerPosRef: ref to player's live position (from the level)
//   onCollect?:   optional (value, kind) => void  — for side-quest hooks
function JewelField({
  candidates,
  commonCount = 5,
  bonusCount = 2,
  playerPosRef,
  onCollect,
}) {
  const { mode } = useRunStats();
  // Practice mode is for grinding mechanics, not coin farming. Jewels and
  // the Shop economy belong to Hardcore + Tutorial only. If we're in
  // Practice we render nothing — the level still works, just no pickups.
  const skip = mode === 'practice';

  // Pick a random subset of candidates ONCE per mount (level entry).
  const { commons, bonuses } = useMemo(() => {
    if (skip) return { commons: [], bonuses: [] };
    const pickN = (arr, n) => {
      if (!arr || arr.length === 0) return [];
      const pool = arr.slice();
      const out = [];
      const want = Math.min(n, pool.length);
      while (out.length < want) {
        const idx = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(idx, 1)[0]);
      }
      return out;
    };
    return {
      commons: pickN(candidates?.common, commonCount),
      bonuses: pickN(candidates?.bonus, bonusCount),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (skip) return null;

  return (
    <>
      {commons.map((c, i) => (
        <Jewel
          key={`c-${i}-${c.x}-${c.y}-${c.z}`}
          position={[c.x, c.y, c.z]}
          kind="common"
          playerPosRef={playerPosRef}
          onCollect={onCollect}
        />
      ))}
      {bonuses.map((b, i) => (
        <Jewel
          key={`b-${i}-${b.x}-${b.y}-${b.z}`}
          position={[b.x, b.y, b.z]}
          kind="bonus"
          playerPosRef={playerPosRef}
          onCollect={onCollect}
        />
      ))}
    </>
  );
}

export default JewelField;
