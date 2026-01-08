# Die Again - Web Version

A React + Three.js web recreation of the Die Again troll game.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm start
```

3. Build for production:
```bash
npm run build
```

## Project Structure

```
web/
├── src/
│   ├── components/       # Reusable 3D components
│   │   ├── Player.jsx
│   │   ├── Block.jsx
│   │   ├── Gate.jsx
│   │   ├── InfiniteGrid.jsx
│   │   ├── HUD.jsx
│   │   └── StartScreen.jsx
│   ├── levels/          # Level implementations
│   │   ├── Level1.jsx
│   │   ├── Level2.jsx (coming)
│   │   └── Level3.jsx (coming)
│   ├── hooks/           # Custom React hooks
│   │   └── useGameLogic.js
│   ├── utils/           # Utility functions
│   │   └── DeathCounter.js
│   ├── App.js           # Main app component
│   └── index.js         # Entry point
└── public/
    └── index.html
```

## Level Status

- ✅ Level 1: Vanishing Platforms - COMPLETE
- ⏳ Level 2: Globe Chase - Coming Soon
- ⏳ Level 3: Phantom Frost - Coming Soon

## Controls

- **WASD** - Move
- **SPACE** - Jump
- **Arrow Keys** - Rotate Camera
- **R** - Restart Level
- **ESC/Q** - Quit to Menu

## Technologies

- React 18
- Three.js
- @react-three/fiber (React renderer for Three.js)
- @react-three/drei (Helper components)
