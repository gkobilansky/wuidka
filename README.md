## Wuidka

A Suika-style 2D physics merge puzzle game built with PixiJS 8, TypeScript, and Vite.

**Wuidka** is a mobile-first PWA where players drop pieces that merge when identical types collide, creating a chain reaction scoring system with physics-based gameplay.

## Features

:white_check_mark: **Physics-based gameplay** - Matter.js integration for realistic piece movement \
:white_check_mark: **11-tier progression** - From Greedy Seedy to Big Stoner with increasing scoring \
:white_check_mark: **Combo system** - Chain merges within 2-second windows for bonus points \
:white_check_mark: **Turn-based difficulty** - Progressive tier unlocking system \
:white_check_mark: **Mobile-optimized** - Touch controls with portrait orientation \
:white_check_mark: **PWA ready** - Installable web application

## Game Mechanics

- **Drop & Merge**: Click anywhere to drop pieces that merge when identical tiers collide
- **Physics Simulation**: Realistic gravity, bounce, and friction using Matter.js
- **Tier Progression**: Start with basic Dot pieces, merge to unlock higher tiers
- **Scoring System**: Base points + combo multipliers for consecutive merges
- **Turn Limits**: First 2 turns drop only Dot pieces, then random tiers 1-5
- **Performance Optimized**: Automatic cleanup prevents lag with body limits

## Architecture

The game follows **MVP (Model-View-Presenter)** design pattern with clear separation of concerns:

1. **Entities** (`src/entities/`) - Core business logic and game systems
2. **Systems** (`src/systems/`) - Game logic (physics, spawning, merging)  
3. **Plugins** (`src/plugins/`) - Engine integrations (PixiJS, storage)
4. **Shared** (`src/shared/`) - Configuration, constants, and utilities
5. **UI** (`src/ui/`) - PixiJS-based user interface components

```
(Entities) <-- (Plugins) <-- (Shared) <-- (UI) <-- (Systems | AppBootstrap)
```

## Quick Start

**Installation**

```bash
$ git clone [repository-url] wuidka
$ cd wuidka
$ npm install
```

**Development**

```bash
$ npm run dev                    # Local development server
$ npm run dev -- --host         # Accessible from other devices (mobile testing)
```

**Build**

```bash
$ npm run build                  # Production build
$ npm run preview               # Preview production build locally
```

## Technical Stack

**Core Technologies**

- **PixiJS 8** - 2D WebGL rendering engine
- **Matter.js** - 2D physics engine for realistic collisions
- **TypeScript** - Type-safe development 
- **Vite** - Fast build tool and development server

**Key Libraries**

- **@pixi/sound** - Audio system integration
- **@pixi/gif** - GIF animation support

## Configuration

Game parameters are centralized in `src/shared/config/game-config.ts`:

## Requirements

:white_check_mark: **OS** - Linux, Windows, macOS \
:white_check_mark: **Node.js** - ^18.x \
:white_check_mark: **Browser** - Modern browsers with WebGL support

## References

- [PixiJS Official Documentation](https://pixijs.com/)
- [Matter.js Physics Engine](https://brm.io/matter-js/)
- [Vite Build Tool](https://vitejs.dev/guide/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
