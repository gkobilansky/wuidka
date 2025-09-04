# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript source.
  - `app/`: App bootstrap and wiring.
  - `systems/`: Core game logic (physics, merging, spawner).
  - `shared/`: Config, constants, utilities (`shared/config/game-config.ts`).
  - `ui/`: PixiJS UI components.
  - `plugins/`: Engine integrations.
- `public/`: Static assets served by Vite.
- `index.html`: App entry for Vite.
- `Dockerfile`: Dev server container (Vite with `--host`).

## Build, Test, and Development Commands
- `npm install`: Install dependencies (Node 18+).
- `npm run dev`: Start Vite dev server at `http://localhost:5173`.
- `npm run dev -- --host`: Expose dev server on LAN (mobile testing).
- `npm run build`: Type-check (`tsc`) and build for production.
- `npm run preview`: Preview the production build locally.
- Docker: `docker build -t wuidka . && docker run -p 5173:5173 wuidka`.

## Coding Style & Naming Conventions
- TypeScript, 2-space indentation, semicolons, single quotes.
- Filenames: kebab-case (e.g., `physics-world.ts`, `merge-system.ts`).
- Exports: prefer named exports; avoid default exports where practical.
- Classes: `PascalCase`; variables/functions: `camelCase`.
- Configuration: add/edit gameplay constants in `shared/config/game-config.ts` (avoid scattering magic numbers).

## Testing Guidelines
- No test runner is configured yet. If adding tests, use Vitest.
  - Location: alongside sources as `*.spec.ts` (e.g., `src/systems/merge-system.spec.ts`).
  - Focus: deterministic logic in `systems/` and helpers in `shared/`.
  - Script: add `"test": "vitest"` to `package.json` and run `npm test`.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:` (scopes optional).
- Pull Requests should include:
  - Summary of changes and rationale.
  - Linked issues or TODOs.
  - Screenshots/GIFs for UI/gameplay changes.
  - Verification steps: `npm run build` (and `npm run preview` when relevant).

## Security & Configuration Tips
- Target Node 18+. Do not commit secrets; this app uses no runtime env vars by default.
- Keep physics and gameplay tuning in `game-config.ts` to make reviews straightforward.
- For mobile validation, prefer `npm run dev -- --host` on a trusted network.
