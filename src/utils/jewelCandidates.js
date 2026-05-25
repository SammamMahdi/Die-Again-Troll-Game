// Generate JEWEL_CANDIDATES from a level's block array.
//
// Per-level placement uses a simple rule that works across the codebase:
//   - Common candidates: float ~1.5 units above the center of every
//     reasonably-sized landable block (filters out tiny hazards / walls).
//   - Bonus candidates: same XZ as commons but ~3.5 units above, so they
//     visually float higher and require a jump (or roll-jump combo) to
//     reach — they read as the "harder" pickups.
//
// JewelField then random-subsets these per-attempt, so the same level
// shows different layouts each time. Levels that want hand-tuned spots
// (hidden behind ghost blocks, on illusion tiles, etc.) can extend the
// returned arrays before passing them to <JewelField>.

const DEFAULT_OPTIONS = {
  commonYOffset: 1.5,
  bonusYOffset: 3.5,
  minFootprint: 6,            // skip blocks with w*d < this (filters kills / spike walls)
  maxY: 12,                   // ignore blocks placed in the sky (e.g. L0 roll wall)
};

export function candidatesFromBlocks(blocks, opts = {}) {
  const {
    commonYOffset, bonusYOffset, minFootprint, maxY,
  } = { ...DEFAULT_OPTIONS, ...opts };

  const common = [];
  const bonus = [];

  for (const b of blocks || []) {
    if (!b) continue;
    if (b.solid === false) continue;
    if (b.kill) continue;
    if (b.isLauncher || b.isTrapdoor) continue;   // L4 hazard types
    if (b.w == null || b.h == null || b.d == null) continue;
    if (b.w * b.d < minFootprint) continue;
    if (b.y > maxY) continue;                     // skip overhead walls

    const top = b.y + b.h / 2;
    common.push({ x: b.x, y: top + commonYOffset, z: b.z });
    bonus.push({ x: b.x, y: top + bonusYOffset, z: b.z });
  }

  return { common, bonus };
}

// Convenience: call a level's `buildLevelN()` and run candidatesFromBlocks
// on whatever shape it returns (some return the blocks array directly,
// others return { blocks, goal }). Used at module-load by each level so
// the candidate set is computed once per page session.
export function candidatesFromBuilder(builder, opts) {
  const fresh = builder();
  const blocks = Array.isArray(fresh) ? fresh : fresh.blocks;
  return candidatesFromBlocks(blocks, opts);
}
