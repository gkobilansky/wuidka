# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Wuidka**, a Suika-style 2D physics merge puzzle game built with PixiJS 8, TypeScript, and Vite. The project follows an MVP architecture where business logic is separated from UI components.

The game is designed as a mobile-first PWA where players drop pieces that merge when identical types collide, creating a chain reaction scoring system.

## Development Commands

```bash
# Install dependencies  
npm install

# Development server with hot reload
npm run dev

# Development server accessible from other devices
npm run dev -- --host

# Build for production
npm run build

# TypeScript compilation (part of build process)
tsc

# Preview production build locally
npm run preview
```

## Architecture Overview

The codebase follows **MVP (Model-View-Presenter)** design pattern with clear separation of concerns:

```
(Entities) <-- (Plugins) <-- (Shared) <-- (UI) <-- (Shared | AppBootstrap)
```

### Core Architecture Components

- **Entities** (`src/entities/`): Core business logic and game systems
  - `manager/`: Scene management, application lifecycle, window resize handling
  - `loader/`: Asset loading system with progress tracking
  
- **Plugins** (`src/plugins/`): Core engine integrations
  - `engine/`: PixiJS abstractions and application setup
  - `storage/`: Game state persistence (localStorage)
  
- **Shared** (`src/shared/`): Reusable utilities and configuration
  - `config/game-config.ts`: Game configuration with tier system and physics settings
  - `config/manifest.ts`: Asset manifest for loader system
  - `constant/`: Global constants like colors and settings
  
- **Systems** (`src/systems/`): Core game logic systems
  - `physics-world.ts`: Matter.js physics engine integration
  - `spawner.ts`: Piece spawning with bag randomization
  - `merge-system.ts`: Collision detection and merge handling
  
- **UI** (`src/ui/`): PixiJS-based user interface components
  - `scenes/`: Game scenes (loader, gameplay)
  - `containers/`: Reusable UI containers 
  - `sprites/`: Individual sprite components
  - `textures/`: Texture definitions and factories

### Key Systems

**Manager System** (`src/entities/manager/`):
- Singleton scene manager handling scene transitions
- Provides global width/height calculations
- Manages application ticker and resize events
- Scene lifecycle: init → update loop → resize → destroy

**Loader System** (`src/entities/loader/`):
- Asset bundle loading with progress callbacks
- Manifest-based asset management
- Prevents duplicate loads with `isLoaded` state

**Physics World** (`src/systems/physics-world.ts`):
- Matter.js engine integration with fixed timestep
- Boundary creation (walls, floor) and piece management
- Collision detection and body lifecycle management
- Debug rendering support for development

**Spawner System** (`src/systems/spawner.ts`):
- Bag randomization preventing duplicate sequences
- Difficulty scaling based on game time
- Drop rate limiting (6 drops per 10 seconds)
- Preview system for next piece

**Merge System** (`src/systems/merge-system.ts`):
- Collision detection for same-tier pieces
- Merge confirmation with velocity and overlap checks
- Combo system with 2-second window and multipliers
- Score calculation with tier-based points

**Game Scene Integration**:
- Real-time physics simulation with visual sync
- Touch/mouse input handling for piece aiming
- Ghost piece preview system
- Score and combo UI updates

**Bootstrap Flow** (`src/main.ts`):
1. Create PixiJS application with device-aware settings
2. Initialize Manager with application instance
3. Create Loader and LoaderScene
4. Load assets with progress display
5. Transition to GameScene when loading completes

## Asset Management

Assets are organized into bundles defined in `src/shared/config/manifest.ts`:
- `logo` bundle: UI assets (vite-logo.png, ts-logo.png, pixi-logo.png)
- `sound` bundle: Audio files (forklift-effect.wav, sound-gif.gif)

Assets should be placed in `public/` directory and referenced without the public prefix in the manifest.

## TypeScript Configuration

- Strict mode enabled with comprehensive error checking
- ESNext target for modern browser features
- No unused locals/parameters enforcement
- Module resolution optimized for Vite bundling
- DOM types included for browser APIs

## Development Patterns

### Scene Implementation
- Extend base scene interfaces with update/resize/destroy lifecycle
- Use Manager.changeScene() for transitions
- Clean up resources in destroy() method

### Entity Pattern
- Business logic in entities/ with interface definitions
- Implementation classes separated from interfaces
- Dependency injection via constructor parameters

### Asset Loading
- Define assets in manifest.ts before using
- Use bundle-based loading for better organization
- Progress callbacks for loading screens

## Game Design Context

This is a fully functional Suika-style merge puzzle game with:
- **Physics Engine**: Matter.js with configurable gravity, restitution, and friction
- **Tier System**: 12-tier progression from Dot to Nova with exponential scoring
- **Merge Mechanics**: Same-tier collision detection with velocity/overlap confirmation
- **Scoring**: Base points + combo multipliers (up to 1.5x) within 2-second windows
- **Spawning**: Bag randomization with difficulty scaling over time
- **Controls**: Touch/mouse aiming with ghost preview and drop rate limiting
- **Mobile-first**: Portrait orientation with responsive scaling

## Game Configuration

All game parameters are centralized in `src/shared/config/game-config.ts`:
- Physics settings (gravity: 1.6, restitution: 0.03, friction: 0.05)
- Tier definitions with radius and scoring
- Timing constants (merge delay: 80ms, combo window: 2000ms)
- Performance limits (max bodies: 120)

## Development Workflow

1. **Core Systems**: Physics, spawning, and merge systems are independent modules
2. **Game Scene**: Integrates all systems with PixiJS rendering
3. **Configuration**: Modify `GAME_CONFIG` to adjust gameplay parameters
4. **Debug Mode**: Physics world debug rendering available in development
5. **Performance**: Automatic body cleanup and limits prevent memory issues

See PRD.md for complete game design specification.