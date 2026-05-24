// Centralised gameplay tuning constants previously duplicated across
// levels, hooks, and App.js. Import from here so a change to any tuning
// value (portal spawn rate, victory delay, total-level count) only has
// to happen in one place.

// Probability that a portal spawns for an eligible level in Hardcore.
// Used inside each LevelN's portalSpawned useState initializer. Admin
// mode (portalAlwaysSpawn) bypasses the roll.
export const PORTAL_SPAWN_CHANCE = 0.35;

// Player AABB half-extent. Used by per-level collision checks against
// hazards (pendulums, lasers, spikes, walls, etc.) that don't go
// through the Player component's own collision pipeline.
export const PLAYER_HALF = 0.5;

// Delay between a level reporting `gameState === 'won'` and the level
// firing its onComplete prop. Gives the player a moment to see the
// victory animation before the reward screen swaps in.
export const VICTORY_DELAY_MS = 1500;

// Number of deaths per level a player is allowed in Hardcore before
// the entire run fails (or an Extra Life is auto-consumed). Practice
// and Tutorial modes ignore this.
export const HARDCORE_TRIES = 3;

// Highest main-level number in the campaign. Used by App.js to detect
// "this was the final level" so the post-L10 reward returns to start.
export const TOTAL_LEVELS = 10;

// Echo Dimension warp overlay duration (ms). Must match the longest
// .warp-* keyframe duration in App.css so the overlay tears down right
// as the animation finishes.
export const WARP_DURATION_MS = 1500;
