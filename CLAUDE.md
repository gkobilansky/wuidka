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
- Exposes PixiJS application instance with renderer access
- Scene lifecycle: init → update loop → resize → destroy

**Loader System** (`src/entities/loader/`):
- Asset bundle loading with progress callbacks
- Manifest-based asset management
- Prevents duplicate loads with `isLoaded` state

**Physics World** (`src/systems/physics-world.ts`):
- Matter.js engine integration with fixed timestep
- Boundary creation (walls, floor) and piece management
- Collision detection and body lifecycle management
- Debug rendering support for development (currently disabled in production)

**Spawner System** (`src/systems/spawner.ts`):
- Turn-based tier progression: First 2 turns drop only tier 1 (Dot) pieces
- Bag randomization for tiers 1-5 after initial turns (higher tiers only reachable through merging)
- Drop rate limiting (6 drops per 10 seconds)
- Turn counter tracking for progressive difficulty

**Merge System** (`src/systems/merge-system.ts`):
- Collision detection for same-tier pieces
- Merge confirmation with velocity and overlap checks
- Combo system with 2-second window and multipliers
- Score calculation with tier-based points

**Game Scene Integration**:
- Real-time physics simulation with visual sync
- Click-to-drop input handling with animated piece movement to target location
- Score and combo UI updates
- Centered portrait-oriented canvas with phone-like dimensions (400x700px)
- Game container with responsive constraints and modern styling

**Bootstrap Flow** (`src/main.ts`):
1. Create PixiJS application with device-aware settings
2. Initialize Manager with application instance
3. Create Loader and LoaderScene
4. Load assets with progress display
5. Transition to GameScene when loading completes

## Asset Management

Assets are organized into bundles defined in `src/shared/config/manifest.ts`:
- `game-pieces` bundle: Game piece sprites (pieces.png atlas with pieces.json data)
- `ui` bundle: User interface elements (ui.png atlas with ui.json data)  
- `audio` bundle: Game sound effects and music (drop, merge, combo, danger, gameover sfx, background music)
  - **Note**: Audio bundle is currently commented out to prevent loading issues during development

Assets should be placed in `public/` directory and referenced without the public prefix in the manifest.

**Texture Generation**: Game pieces are generated procedurally using PixiJS Graphics and converted to textures via the renderer's `generateTexture()` method when atlas sprites are not available.

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
- **Tier System**: 11-tier progression from Greedy Seedy to Big Stoner with increasing scoring
- **Merge Mechanics**: Same-tier collision detection with velocity/overlap confirmation
- **Scoring**: Base points + combo multipliers (up to 1.5x) within 2-second windows
- **Spawning**: Turn-based tier progression (tier 1 only for first 2 turns, then tiers 1-5 via bag randomization)
- **Controls**: Click/touch anywhere on game board to drop pieces at that x-coordinate with animated piece movement
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

## Testing and Verification

- **Development Server**: The project typically runs with `npm run dev` in a separate browser tab with hot reload enabled
- **UI/UX Changes**: User manually tests UI/UX updates in the running development server to verify functionality
- **No Build Required**: Skip `npm run build` during development iterations unless specifically requested
- **Manual Verification**: User will test game interactions, input handling, and visual changes directly in the browser

See PRD.md for complete game design specification.