import React, { useState, useEffect, useRef } from 'react';
import ConsumableDrop from './ConsumableDrop';
import { useRunStats } from './RunStatsContext';

// Wrapper: rolls a chance per Hardcore level entry to spawn ONE random
// consumable pickup at a random landable block position. Echo levels +
// Practice + Tutorial never spawn drops — only Hardcore main runs.
//
// All catalogue items can drop here: Jewel Magnet, Invisibility Potion,
// and Extra Life. Extra Life is weighted lower because it's the strongest
// item (auto-saves a run on the 3rd-try death); the two potions are
// equally weighted with each other.
//
// `blocks` is the level's flat block array. Some levels initialize
// their blocks AFTER mount (L1 uses a useEffect to populate them), so
// we defer position selection until blocks are actually populated
// rather than locking in null on first render.
//
// Sporadic spawn rate. Re-rolled fresh on every level entry + every
// R-restart, so any individual level might or might not have a drop.
const DROP_CHANCE = 0.35;
const DROP_WEIGHTS = [
  { id: 'jewel_magnet',        weight: 3 },
  { id: 'invisibility_potion', weight: 3 },
  { id: 'extra_life',          weight: 1 },   // rarer — strongest item
];

function pickItemId() {
  const total = DROP_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of DROP_WEIGHTS) {
    if (r < w.weight) return w.id;
    r -= w.weight;
  }
  return DROP_WEIGHTS[0].id;
}

function pickPosition(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  const candidates = blocks.filter(b =>
    b && b.visible !== false && b.solid !== false && !b.isGoal,
  );
  if (candidates.length === 0) return null;
  // Drop the LARGEST block (almost always the start platform) so the
  // drop isn't placed at spawn where the player would auto-grab it.
  const ranked = candidates.slice().sort((a, b) => (b.w * b.d) - (a.w * a.d));
  const eligible = ranked.length > 1 ? ranked.slice(1) : ranked;
  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  return [pick.x, (pick.y || 0) + (pick.h || 1) / 2 + 1.2, pick.z];
}

function HardcoreDrop({ blocks, playerPosRef }) {
  const { mode } = useRunStats();
  // Lock the spawn DECISION (will/won't drop, which item) once per
  // component mount. The POSITION is computed once blocks are ready.
  const decisionRef = useRef(null);
  if (decisionRef.current === null) {
    const willSpawn = mode === 'hardcore' && Math.random() < DROP_CHANCE;
    decisionRef.current = willSpawn
      ? { itemId: pickItemId() }
      : { skip: true };
  }
  const decision = decisionRef.current;

  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (decision.skip || pos) return;
    const next = pickPosition(blocks);
    if (next) setPos(next);
  }, [blocks, decision.skip, pos]);

  if (decision.skip || !pos) return null;
  return (
    <ConsumableDrop
      position={pos}
      itemId={decision.itemId}
      playerPosRef={playerPosRef}
    />
  );
}

export default HardcoreDrop;
