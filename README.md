## Wuidka

A Suika-style 2D physics merge puzzle game built with PixiJS 8, TypeScript, and Vite.

**Wuidka** is a mobile-first PWA where players drop pieces that merge when identical types collide, creating a chain reaction scoring system with physics-based gameplay.

## Features

:white_check_mark: **Physics-based gameplay** - Matter.js integration for realistic piece movement \
:white_check_mark: **11-tier progression** - From Speedy Seedy to Big Stoner with increasing scoring \
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

## Offline / PWA

- Always run `npm run build` before every push or pull request. It type-checks the project and generates the production service worker, so failures here catch SW regressions before review.

### Local install & offline smoke test
1. `npm run build && npm run preview -- --host`
2. Visit the preview URL (default `http://localhost:4173`) in Chrome/Edge, open the install prompt (`+` icon or browser menu), and confirm the app installs.
3. In DevTools, open **Application → Service Workers** and verify the `autoUpdate` service worker is registered without errors.
4. Flip the **Network** tab to *Offline* and reload—Pixi boots from the precache while leaderboard/email submissions stay disabled with their inline “offline” copy until you reconnect.

### Clearing cached builds
- DevTools → Application → Storage → **Clear site data** removes cached assets and the service worker for the local origin.
- Alternatively, DevTools → Application → Service Workers → **Unregister** clears only the worker so the next refresh grabs the newest files.
- When validating on devices, use `npm run preview -- --host` so the scope matches the device hostname, then clear caches from the device browser’s site settings.

### Known limitations
- The game intentionally does not queue leaderboard/email submissions; those buttons remain disabled while offline and resume automatically once the browser reports an online state.
- Background sync is not enabled—reopen the app after reconnecting to ensure the service worker pulls the latest leaderboard data.

### Leaderboard Storage & API

The weekly leaderboard uses **Vercel Postgres** via `@vercel/postgres`. To enable it locally:

1. Run `vercel link` (if you haven't) and add a Postgres database from the Vercel dashboard.
2. Pull the generated environment variables into a local file:  
   ```bash
   vercel env pull .env.local
   ```
3. Restart `npm run dev` so Vite picks up the connection string.

The API needs these variables (Vercel manages them automatically when you add Postgres):

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_DATABASE`

Serverless endpoints (available in `vercel dev`/deployed builds):

| Method | Path                   | Description                                                                 |
| ------ | ---------------------- | --------------------------------------------------------------------------- |
| POST   | `/api/scores`          | Submit `{ nickname, score, email? }`, returns placement + stored entry.     |
| GET    | `/api/leaderboard`     | Returns the top 5 scores for the current ISO week (UTC).                    |
| GET    | `/api/leaderboard?week=YYYY-Www` | Fetch a specific ISO week (e.g., `2025-W02`) without exposing emails. |
| POST   | `/api/users`           | Register `{ email, nickname? }` for prize drops/updates.                    |

`POST /api/scores` enforces nickname (2–24 chars), non-negative integer scores, and optional valid emails. All responses are JSON and set `Cache-Control: no-store`.

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
