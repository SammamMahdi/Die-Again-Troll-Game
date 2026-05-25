import React, { useState } from 'react';
import './Guide.css';

// Level entries read like myth, not manuals. Each one is a prologue, a
// handful of whispers (oblique hints), and a closing warning (mantra).
const LEVELS = [
  {
    n: 1, name: 'The Vanishing Path', accent: '#ffe14a',
    ability: 'A sense of order — the next safe stone glows brighter than the others. Follow the yellow.',
    abilityHint: '✨ Follow the yellow — the path comes in order',
    prologue:
      'You wake on a stone island in the dark. Beyond you, a row of stepping stones flickers in and out, never quite committing to being real. A gold light pulses where the path ends, patient and a little smug.',
    whispers: [
      'The path remembers your footsteps. Only briefly.',
      'The light moves where you should follow.',
      'When you reach the gate, it may not stay where it promised. Be ready to retrace your steps faster than they vanish.',
    ],
    warning: 'Patience is the path. Haste is the void.',
  },
  {
    n: 2, name: 'Globe Chase', accent: '#ff6fb5',
    ability: 'Stillness. The watchers cannot see what does not move. Standing perfectly still disarms them while the red light burns.',
    abilityHint: '🔴 RED = freeze · 🔵 BLUE = run',
    prologue:
      'Four watchers hang in the purple air, asleep behind blue eyes. The path passes beneath them. They will not wake unless you give them a reason.',
    whispers: [
      'Blue is dream. Red is hunt.',
      'They only chase what runs.',
      'One platform along the way will betray its weight to you. Read the colour before you trust it.',
    ],
    warning: 'Stillness shields you. Speed is a confession.',
  },
  {
    n: 3, name: 'Phantom Frost', accent: '#82eaff',
    ability: 'Sonar Pulse. Holding SPACE sends out a brief pulse of light that reveals invisible blocks for as long as you hold it. The world re-hides them the moment you let go.',
    abilityHint: '🌀 Hold SPACE — sonar reveals hidden stones',
    prologue:
      'A wind that knows your shape rolls over the ice. Some platforms are visible. Some are not. Some lie about being either.',
    whispers: [
      'A pulse from your hand reveals the hidden — but the world hides again the moment your breath catches.',
      'Trust the silence between the blink. The two halves of the bridge breathe in turn.',
      'Where the path forks, the safe-looking road is a lie. The truest road is one no eye has seen.',
    ],
    warning: 'Believe the world only when you have touched it.',
  },
  {
    n: 4, name: 'The Betrayal', accent: '#ffaa44',
    ability: 'A flicker-sense. When a platform is about to drop, the world flashes yellow for a beat. When something is an illusion, it shimmers a fraction off-rhythm. Look for the wrongness.',
    abilityHint: '👁 Watch for the flicker — it warns before it betrays',
    prologue:
      'Everything in this place is wearing a face. The blue blocks smile. The gray ones whisper. The orange ones laugh, and then they throw you.',
    whispers: [
      'Trust no platform that smiles. Some blues are doors with the floor missing.',
      'Gray is a memory of solidness, not solidness itself.',
      'When something flings you, do not fight the air. Land soft, look around, find the next lie.',
    ],
    warning: 'Trust nothing. Move anyway.',
  },
  {
    n: 5, name: 'Pendulum Pass', accent: '#ff4466',
    ability: 'Read the rhythm. The bells repeat in a pattern. If you watch one full swing before stepping forward, your body will already know when to move.',
    abilityHint: '⏱ Wait the swing — step on the silence',
    prologue:
      'The bells of the dead are swinging. Each one faster than the last. They have all the time in the world. You do not.',
    whispers: [
      'Walk in the silence between the swings.',
      'The first bells are gentle teachers. Use them to learn the rhythm before the harder ones begin.',
      'A square of stone is wider than it looks. Tuck yourself into a corner if the room must shrink.',
    ],
    warning: 'You cannot outrun a pendulum. You can only outwait one.',
  },
  {
    n: 6, name: 'The Gauntlet', accent: '#ff3366',
    ability: 'Counter-rotation. While you stand on a spinning disc, walking opposite to its motion holds you in place. Walking with it sends you over the edge faster.',
    abilityHint: '🔄 Walk against the spin · time the twin beams',
    prologue:
      'The wheels of the gauntlet turn for no one. Beams of light open and close like eyes. Three discs, each angrier than the last, expect you to know your place on them.',
    whispers: [
      'Move with the world, or against it — but never stand still.',
      'There is no safe side of a beam that has another beam on its back.',
      'The bridges between are narrow. The discs are not. Choose where to commit.',
    ],
    warning: 'A still foot is a fallen one.',
  },
  {
    n: 7, name: 'Eclipse', accent: '#c8e6ff',
    ability: 'A small light follows your gaze. Wherever the camera looks, the world appears for a short distance. Look forward and the path emerges.',
    abilityHint: '🔦 Your gaze is your lantern — look where you walk',
    prologue:
      'A great hand has dimmed the sky. You carry a small lamp in your chest. The world only exists as far as the lamp can reach.',
    whispers: [
      'The dark forgets you. Keep walking and it cannot remember where you were.',
      'Things move in the unseen. Their colour glows where their shape does not.',
      'Do not look back. The path behind has rearranged itself.',
    ],
    warning: 'The dark does not chase. It waits.',
  },
  {
    n: 8, name: 'Mirror', accent: '#ff66cc',
    ability: 'A reflection. Your shadow walks beside you at the mirror of your position. Every step you take, the shadow takes the same step on the other side of zero.',
    abilityHint: '🪞 Your shadow mirrors at -X — move opposite',
    prologue:
      'A shadow remembers your shape and walks beside you, on the other side of the river that runs through this hall. What hurts the shadow hurts you.',
    whispers: [
      'You are not alone. Each step you take, your shadow takes the opposite.',
      'The spikes hunger for it, not for you. To save yourself, save the shadow.',
      'When fear pulls you one way, pull the other. Your instinct is a betrayer here.',
    ],
    warning: 'What you fear lives on the other side of yourself.',
  },
  {
    n: 9, name: 'Storm Surge', accent: '#88ddff',
    ability: 'Wind-sense. The streaks in each zone tell you which way the gust will push you. The pulse rises and falls — between gusts there is a moment of still.',
    abilityHint: '🌬 Gusts pulse · wait the silence',
    prologue:
      'The wind has thoughts. Each gust is a sentence it speaks once before fading. Stand in the wrong one and it will carry you into nothing.',
    whispers: [
      'Lean into the wind. It whispers its direction in the way the air moves before it arrives.',
      'Between the gusts is a pause. The pause is the path.',
      'At the end the wind speaks in two directions at once. Listen for the corner.',
    ],
    warning: 'The wind is not your enemy. It is your map.',
  },
  {
    n: 10, name: 'The Architect', accent: '#ffd066',
    ability: 'No new gift. Everything you have learned will be tested at once. Movement, friction, timing, courage. The Architect grants nothing — it only takes from those who pause.',
    abilityHint: '💎 Wake all 3 pillars · then sprint to the centre',
    prologue:
      'You stand in the centre of a place that knows you have been here before. The Architect remembers each fall. Three pillars sing at the corners of the world. To reach the gate, you must wake all three.',
    whispers: [
      'It is always behind you. Keep moving. Direction matters less than motion.',
      'Each pillar you touch summons another hunter. The price of progress is more company.',
      'The bridges between are slick with ice. Plan your slide before you start it.',
      'When the third pillar sings, the centre opens. Do not pause to admire — sprint.',
    ],
    warning: 'Crown yourself, or be consumed.',
  },
];

// Exported for the in-game HUD so each level can show its own ability hint.
export const ABILITY_HINTS = Object.fromEntries(
  LEVELS.map(l => [l.n, { hint: l.abilityHint, accent: l.accent, ability: l.ability }])
);

const CORE_MECHANICS = [
  { title: 'Movement', detail: 'WASD moves relative to the camera. "Forward" always means whatever way you’re looking.' },
  { title: 'Jumping', detail: 'SPACE jumps from any solid platform. No double-jump.' },
  { title: 'Roll (ground)', detail: 'Tap C on the ground to roll: shorter hitbox, +30% forward boost, ~0.45s window with ~0.8s cooldown. Pass under low obstacles.' },
  { title: 'Slam-dive (air)', detail: 'Tap C while airborne to dive forward and downward — useful for closing gaps when a jump is short.' },
  { title: 'Friction', detail: 'Normal blocks slow you quickly. Ice blocks let you slide far past where you wanted to stop.' },
  { title: 'Void death', detail: 'Falling below the world resets you to the level start. The death counter remembers.' },
  { title: 'Shadow projection', detail: 'A faint disc under your pawn shows where you would land if you fell. It fades the higher you jump.' },
  { title: 'Camera', detail: 'Arrow keys or mouse drag rotate the view. The camera follows the pawn at a fixed distance.' },
];

const MODES = [
  {
    name: 'Tutorial',
    accent: '#82eaff',
    desc:
      'A single short level (L0) that teaches movement, jumping, rolling, restarting, and the void. Always replayable. Clearing it ONCE unlocks Hardcore and Practice — your tutorial-cleared flag is synced to the cloud, so it stays cleared on every device.',
    rules: [
      'No medals, no jewels, no achievements (except the one-time First Footing).',
      'Floating signs label each platform. You cannot fail a tutorial run.',
      'Required as the gate to the rest of the game.',
    ],
  },
  {
    name: 'Hardcore',
    accent: '#ff6677',
    desc:
      'The full L1 → L10 campaign with rage-game stakes. You start each level with 3 tries. Die a 3rd time and the run ends — unless you spend an Extra Life from your inventory (you’ll be prompted).',
    rules: [
      'Tries reset per level on entry. The tries badge shows ❤×N in the HUD.',
      'Earning Iron Will and Flawless requires a clean, no-admin Hardcore run.',
      'Random potion drops can appear on platforms during a Hardcore run — grab them before you finish.',
      'Echo Dimension portals (Diamond/Platinum route) only appear in Hardcore.',
      'Run-end shows a shareable Run Summary card with deaths, medals, time, and jewels.',
    ],
  },
  {
    name: 'Practice',
    accent: '#a8ffd6',
    desc:
      'A level-select grid for grinding individual levels. Unlimited tries, no run penalty. Every level you’ve unlocked through Hardcore is available — plus L1 is always open after the Tutorial.',
    rules: [
      'Per-level RewardScreen still fires — medals, points, achievements, jewels all count.',
      'Iron Will / Flawless / streak-spanning achievements do NOT trigger in Practice.',
      'No Echo portals, no Diamond/Platinum medals — those belong to Hardcore.',
      'Best place to grind jewels, hunt speed-run times, or learn a level cleanly.',
    ],
  },
];

const ECHO_NOTES = [
  'Echo portals only appear in HARDCORE — never in Practice or Tutorial.',
  'A level becomes Echo-eligible once you have earned Gold (0 deaths) on its main form.',
  'After that, each Hardcore entry has a chance to spawn a glowing portal somewhere on the level.',
  'Walk into the portal to be pulled into the Echo Dimension — a thematically distinct, harder reflection of the level (lightning storms, hall of mirrors, gravity wells, etc.).',
  'You have 3 tries in the Echo. Clearing it earns Platinum on completion of the main level. Cleared Echo + 0 deaths on the main level → Diamond.',
  'Failing the Echo (3 deaths or pressing Esc) returns you to the main level — you can still finish for Silver/Gold, just no Platinum/Diamond this attempt.',
  'The portal is OPTIONAL. Skipping it and finishing normally still earns Gold or worse based on your death count.',
];

const ACHIEVEMENT_CATEGORIES = [
  {
    title: 'Onboarding & per-level',
    items: [
      'First Steps — Complete Level 1 (any deaths).',
      'First Footing — Clear the Tutorial.',
      'Phantom Runner / Red Light Winner / Frost Master / Trust Issues / Pendulum Dancer / Spin Master / Walks in Darkness / Mirror Mind / Storm Walker — Clear L1–L9 with 0 deaths.',
      'Architect Slayer — Clear L10 with 0 deaths.',
    ],
  },
  {
    title: 'Speed-run',
    items: [
      'Speed Demon I — Clear L1 in under 30 seconds.',
      'Speed Demon II — Clear L2 in under 45 seconds.',
      'Speed Demon III — Clear L3 in under 60 seconds.',
    ],
  },
  {
    title: 'Run-spanning (Hardcore only)',
    items: [
      'Iron Will — Complete the full L1 → L10 Hardcore campaign in one run.',
      'Flawless — Complete L1 → L10 in one Hardcore run with 0 deaths on every level.',
    ],
  },
  {
    title: 'Echo Dimension mastery',
    items: [
      'Platinum Initiate — Earn your first Platinum medal.',
      'Royal Court — Earn Platinum on 5 different levels.',
      'Platinum Emperor — Earn Platinum on all 10 levels.',
      'Diamond Initiate — Earn your first Diamond medal.',
      'Diamond Emperor — Earn Diamond on all 10 levels.',
    ],
  },
];

const TIPS = [
  'Press **ESC** anytime to bail to the home screen — your in-run jewels and inventory stay.',
  'Clearing the **Tutorial** is the gate to Hardcore + Practice. The flag syncs to the cloud once you sign in.',
  '**Sign in** to save medals, jewels, skins, and consumables to the cloud and compete on the leaderboard.',
  'Open **Settings** (gear icon) to remap any key, tune audio per channel, and pick a graphics preset.',
  'Use jewels in the **Shop** for skin colors, crown variants, and consumable potions (Speed, Magnet, Invisibility, Extra Life).',
  '**Hardcore runs** randomly drop a free potion on one of the level platforms — keep your eyes open.',
  '**Iron Will** and **Flawless** need a clean L1→L10 Hardcore run — admin jumps disqualify.',
  '**Echo Dimension portals** are optional. They appear only in Hardcore on levels you’ve already Gold’d — entering one is the only path to Platinum + Diamond.',
  'The **Roll** (C) under low arches is faster than jumping over them. Roll cooldown is ~0.8s.',
  '**Don’t fear death.** Most levels become readable after a handful of attempts. The death counter is your trophy.',
];

const MEDAL_TIERS = [
  { tier: 'Diamond',  desc: 'Echo Dimension cleared AND main level finished with 0 deaths.', points: 300 },
  { tier: 'Platinum', desc: 'Echo Dimension cleared (any number of deaths in the main level).', points: 200 },
  { tier: 'Gold',     desc: 'Main level cleared with 0 deaths.', points: 100 },
  { tier: 'Silver',   desc: 'Main level cleared with only a handful of deaths.', points: 50 },
  { tier: 'Bronze',   desc: 'Main level cleared — any death count.', points: 20 },
];

const CONSUMABLES = [
  { icon: '⚡', name: 'Speed Potion',        desc: 'Press 1: +50% movement speed for 15 seconds. Stacks duration.' },
  { icon: '🧲', name: 'Jewel Magnet',        desc: 'Press 2: wider jewel pickup radius for 12 seconds.' },
  { icon: '👻', name: 'Invisibility Potion', desc: 'Press 3: hazards (globes, orbs, pendulums, lasers, walls, spikes) pass through you for 8 seconds.' },
  { icon: '❤', name: 'Extra Life',           desc: 'Auto-consumed on a 3rd-try death in Hardcore — refills tries to 3 and saves the run.' },
];

function Guide({ onBack }) {
  const [expanded, setExpanded] = useState(1);

  return (
    <div className="guide">
      <div className="guide-bg" />
      <div className="guide-card">

        <div className="guide-header">
          <button className="guide-back" onClick={onBack}>← Back</button>
          <h1 className="guide-title">GAME GUIDE</h1>
          <div className="guide-subtitle">How everything works · whispers for each level</div>
        </div>

        {/* Overview */}
        <section className="guide-section">
          <h2 className="guide-section-title">Overview</h2>
          <p className="guide-paragraph">
            <strong>Die Again</strong> is a 10-level 3D platformer. Every level introduces
            a different mechanic — disappearing platforms, swinging hammers, gravity tricks,
            chasers, and worse. Reach the gold gate at the end to advance.
          </p>
          <p className="guide-paragraph">
            Dying is part of the loop. You respawn on the same level instantly, and the
            death counter only matters to you. Each level has its own atmosphere, lighting
            palette, and rules. The hints below are deliberately oblique — the levels are
            meant to be felt out, not solved on paper.
          </p>
        </section>

        {/* Game modes */}
        <section className="guide-section">
          <h2 className="guide-section-title">Game modes</h2>
          <p className="guide-paragraph guide-paragraph-quiet">
            Three distinct paths through the game. Pick one from the Mode
            Select screen after clearing the Tutorial.
          </p>
          <div className="guide-modes">
            {MODES.map(m => (
              <div className="guide-mode" key={m.name} style={{ '--accent': m.accent }}>
                <div className="guide-mode-name">{m.name}</div>
                <p className="guide-mode-desc">{m.desc}</p>
                <ul className="guide-mode-rules">
                  {m.rules.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Echo Dimensions */}
        <section className="guide-section">
          <h2 className="guide-section-title">Echo Dimensions (the portal route)</h2>
          <p className="guide-paragraph">
            Behind every main level lives an <strong>Echo Dimension</strong> —
            a fractured, distinct reflection of that level with harder
            mechanics and a completely different visual theme. Echo clears
            are the only path to <strong>Platinum</strong> and <strong>Diamond</strong> medals.
          </p>
          <ul className="guide-tip-list">
            {ECHO_NOTES.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </section>

        {/* Controls — default bindings; remappable in Settings */}
        <section className="guide-section">
          <h2 className="guide-section-title">Controls</h2>
          <p className="guide-paragraph guide-paragraph-quiet">
            Default keybindings shown below. Every key is rebindable in
            <strong> Settings → Controls</strong>.
          </p>
          <div className="guide-controls-grid">
            <div className="guide-control"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Move (relative to camera)</span></div>
            <div className="guide-control"><kbd>SPACE</kbd><span>Jump</span></div>
            <div className="guide-control"><kbd>C</kbd><span>Roll on ground · slam-dive mid-air</span></div>
            <div className="guide-control"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd><span>Rotate camera</span></div>
            <div className="guide-control"><kbd>Mouse drag</kbd><span>Rotate camera</span></div>
            <div className="guide-control"><kbd>R</kbd><span>Restart level after dying</span></div>
            <div className="guide-control"><kbd>1</kbd><span>Speed Potion (if owned)</span></div>
            <div className="guide-control"><kbd>2</kbd><span>Jewel Magnet (if owned)</span></div>
            <div className="guide-control"><kbd>3</kbd><span>Invisibility Potion (if owned)</span></div>
            <div className="guide-control"><kbd>Esc</kbd><span>Return to home screen / close modals</span></div>
          </div>
        </section>

        {/* Medal tiers */}
        <section className="guide-section">
          <h2 className="guide-section-title">Medals & scoring</h2>
          <p className="guide-paragraph guide-paragraph-quiet">
            Every cleared level awards a medal. Diamond and Platinum are
            unlocked through the Hardcore Echo Dimension portal route.
          </p>
          <div className="guide-mech-grid">
            {MEDAL_TIERS.map(m => (
              <div className="guide-mech" key={m.tier}>
                <div className="guide-mech-title">{m.tier} <span style={{ opacity: 0.65, fontSize: '0.85rem' }}>+{m.points} pts</span></div>
                <div className="guide-mech-detail">{m.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Consumables + shop */}
        <section className="guide-section">
          <h2 className="guide-section-title">Shop & consumables</h2>
          <p className="guide-paragraph guide-paragraph-quiet">
            Jewels collected during levels are spent in the <strong>Shop</strong>
            for skins (body colors + crown variants) and consumable potions.
            Hardcore runs also have a chance to drop one free potion on a
            random platform — pick it up to add to your inventory.
          </p>
          <div className="guide-mech-grid">
            {CONSUMABLES.map(c => (
              <div className="guide-mech" key={c.name}>
                <div className="guide-mech-title">{c.icon} {c.name}</div>
                <div className="guide-mech-detail">{c.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Achievements */}
        <section className="guide-section">
          <h2 className="guide-section-title">Achievements</h2>
          <p className="guide-paragraph guide-paragraph-quiet">
            Every cleared milestone awards points and shows on
            <strong> My Stats</strong>. Run-spanning achievements (Iron Will,
            Flawless) only count in <strong>Hardcore</strong>.
          </p>
          <div className="guide-mech-grid">
            {ACHIEVEMENT_CATEGORIES.map(cat => (
              <div className="guide-mech" key={cat.title}>
                <div className="guide-mech-title">{cat.title}</div>
                <ul className="guide-ach-list">
                  {cat.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Progression + saves */}
        <section className="guide-section">
          <h2 className="guide-section-title">Progression & saves</h2>
          <p className="guide-paragraph">
            <strong>Tutorial first.</strong> Hardcore + Practice unlock once
            you clear the Tutorial. Once cleared, the gate stays open across
            all of your devices (synced via the cloud account).
          </p>
          <p className="guide-paragraph">
            <strong>Tracking.</strong> Open <strong>My Stats</strong> from
            the start screen to see total score, medal counts across all
            five tiers, per-level best times, and your full achievement list.
          </p>
        </section>

        {/* Core mechanics */}
        <section className="guide-section">
          <h2 className="guide-section-title">Core mechanics</h2>
          <div className="guide-mech-grid">
            {CORE_MECHANICS.map(m => (
              <div className="guide-mech" key={m.title}>
                <div className="guide-mech-title">{m.title}</div>
                <div className="guide-mech-detail">{m.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section className="guide-section">
          <h2 className="guide-section-title">Tips & strategy</h2>
          <ul className="guide-tip-list">
            {TIPS.map((t, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            ))}
          </ul>
        </section>

        {/* Per-level whispers */}
        <section className="guide-section">
          <h2 className="guide-section-title">Whispers from the levels</h2>
          <p className="guide-paragraph guide-paragraph-quiet">
            What follows are hints, not instructions. They are arranged in the order you will
            meet them. Read them as you would a rumour about a place you are about to visit.
          </p>
          <div className="guide-level-list">
            {LEVELS.map(lvl => {
              const isOpen = expanded === lvl.n;
              return (
                <div
                  key={lvl.n}
                  className={`guide-level ${isOpen ? 'guide-level-open' : ''}`}
                  style={{ '--accent': lvl.accent }}
                >
                  <button
                    className="guide-level-header"
                    onClick={() => setExpanded(isOpen ? null : lvl.n)}
                  >
                    <span className="guide-level-badge">L{lvl.n}</span>
                    <span className="guide-level-name">{lvl.name}</span>
                    <span className="guide-level-caret">{isOpen ? '▼' : '▶'}</span>
                  </button>

                  {isOpen && (
                    <div className="guide-level-body">
                      <p className="guide-prologue">{lvl.prologue}</p>
                      <div className="guide-ability">
                        <div className="guide-ability-label">What this level gives you</div>
                        <div className="guide-ability-text">{lvl.ability}</div>
                      </div>
                      <ul className="guide-whispers">
                        {lvl.whispers.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                      <div className="guide-warning">— {lvl.warning}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}

export default Guide;
