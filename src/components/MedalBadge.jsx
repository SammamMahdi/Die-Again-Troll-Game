import React from 'react';
import './MedalBadge.css';

// Shared medal badge — one consistent visual for medals across MyStats,
// Leaderboard, RewardScreen, and anywhere else medals are surfaced.
//
// Renders an SVG icon (so it scales cleanly + reads as a real badge,
// not just a coloured letter) with a per-tier gradient + glow.
//
// Props:
//   tier:  'diamond' | 'platinum' | 'gold' | 'silver' | 'bronze'
//   size:  number — pixel width/height; defaults to 28
//   count: optional number — shown next to the badge as ×N

const ICONS = {
  diamond:  'diamond',
  platinum: 'platinum',
  gold:     'star',
  silver:   'star',
  bronze:   'star',
};

const LABELS = {
  diamond:  'Diamond',
  platinum: 'Platinum',
  gold:     'Gold',
  silver:   'Silver',
  bronze:   'Bronze',
};

function DiamondGlyph({ id }) {
  // A faceted diamond — two triangles + a crown.
  return (
    <>
      <defs>
        <linearGradient id={`${id}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#e8f7ff" />
          <stop offset="40%"  stopColor="#a0d8ff" />
          <stop offset="100%" stopColor="#6e3cff" />
        </linearGradient>
      </defs>
      {/* Crown (top facets) */}
      <polygon points="20,8 8,18 32,18" fill={`url(#${id}-grad)`} stroke="#e0f0ff" strokeWidth="0.6" />
      {/* Body (point) */}
      <polygon points="8,18 32,18 20,36" fill={`url(#${id}-grad)`} stroke="#e0f0ff" strokeWidth="0.6" />
      {/* Inner facet lines */}
      <line x1="20" y1="8" x2="20" y2="18" stroke="#ffffff" strokeWidth="0.5" opacity="0.8" />
      <line x1="14" y1="18" x2="20" y2="36" stroke="#ffffff" strokeWidth="0.4" opacity="0.7" />
      <line x1="26" y1="18" x2="20" y2="36" stroke="#ffffff" strokeWidth="0.4" opacity="0.7" />
      {/* Top sparkle */}
      <circle cx="13" cy="13" r="0.9" fill="#ffffff" opacity="0.9" />
    </>
  );
}

function PlatinumGlyph({ id }) {
  // Hollow diamond outline + an inner small diamond, silvery.
  return (
    <>
      <defs>
        <linearGradient id={`${id}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="55%"  stopColor="#dde4f2" />
          <stop offset="100%" stopColor="#9aa5c0" />
        </linearGradient>
      </defs>
      <polygon
        points="20,6 34,20 20,34 6,20"
        fill={`url(#${id}-grad)`}
        stroke="#ffffff"
        strokeWidth="1.0"
      />
      <polygon
        points="20,14 26,20 20,26 14,20"
        fill="rgba(255,255,255,0.55)"
        stroke="#ffffff"
        strokeWidth="0.4"
      />
    </>
  );
}

function StarGlyph({ id, tier }) {
  // Classic 5-point star with a per-tier gradient (gold / silver / bronze).
  const grad = tier === 'gold'   ? ['#fff7c8', '#ffd966', '#a07012']
            :  tier === 'silver' ? ['#ffffff', '#d4dceb', '#6a7188']
            :                       ['#ffd9b0', '#e88a4a', '#6b3a1b'];
  return (
    <>
      <defs>
        <linearGradient id={`${id}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={grad[0]} />
          <stop offset="50%"  stopColor={grad[1]} />
          <stop offset="100%" stopColor={grad[2]} />
        </linearGradient>
      </defs>
      <polygon
        points="20,6 24.3,16.4 35.2,16.6 26.5,23.4 29.7,33.9 20,27.6 10.3,33.9 13.5,23.4 4.8,16.6 15.7,16.4"
        fill={`url(#${id}-grad)`}
        stroke="#ffffff"
        strokeWidth="0.6"
        strokeOpacity="0.85"
      />
    </>
  );
}

function MedalBadge({ tier, size = 28, count, title }) {
  // Unique-per-mount id so multiple badges on the same screen don't
  // clobber each other's SVG gradient defs.
  const reactId = React.useId();
  const id = `medal-${tier}-${reactId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
  const kind = ICONS[tier];
  return (
    <span
      className={`medal-badge medal-badge-${tier}`}
      style={{ '--badge-size': `${size}px` }}
      title={title || LABELS[tier]}
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        aria-label={LABELS[tier]}
        role="img"
        className="medal-badge-svg"
      >
        {kind === 'diamond'  && <DiamondGlyph id={id} />}
        {kind === 'platinum' && <PlatinumGlyph id={id} />}
        {kind === 'star'     && <StarGlyph id={id} tier={tier} />}
      </svg>
      {count != null && (
        <span className="medal-badge-count">×{count}</span>
      )}
    </span>
  );
}

export default MedalBadge;
