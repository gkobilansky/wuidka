# Weekly High Score Leaderboard Implementation Plan

## Overview

Introduce a persistent weekly leaderboard backed by Vercel Postgres, expose minimal API endpoints for submitting and reading high scores, surface the top 5 ISO-week scores (UTC) in a new UI panel, and extend the game-over overlay with a submission form that players can skip.

## Current State Analysis

- The DOM only has two panels (`#info-panel`, `#score-panel`) plus the Pixi canvas; there is nowhere to render leaderboard data (`index.html:10-72`, `src/style.css:43-375`).
- `ScorePanelComponent` simply renders static tier metadata pulled from `GAME_CONFIG` and should remain as the “Friends” list, so it cannot be repurposed for dynamic scores (`src/ui/components/score-panel.component.ts:13-55`).
- Gameplay score exists purely in memory inside `GameScene` and is only shown via the overlay (`src/ui/scenes/game.scene.ts:234-393`); there is no persistence, submission hook, or backend plumbing.
- The `GameOverOverlayComponent` only shows a restart button and cannot collect nickname/email (`src/ui/components/game-over-overlay.component.ts:18-99`).
- There is no backend code or dependencies today (`src/api/index.ts` is empty, `package.json:7-18` has no server libraries).

## Desired End State

- A Vercel Postgres database (via `@vercel/postgres`) stores every submitted score with nickname, optional email, numeric score, created timestamp, and derived ISO week id.
- Serverless functions:
  - `POST /api/scores` validates nickname/email/score, inserts a row, and returns the player’s placement within the current ISO week.
  - `GET /api/leaderboard?week=<iso_week>` returns the top 5 submissions for the requested ISO week (defaults to current week) without exposing email.
- Frontend layout displays panels in order: info panel (now also housing the “Friends” tier list) → game → leaderboard. On mobile, leaderboard stacks beneath the game.
- Game-over overlay prompts for nickname + optional email, allows skipping, and posts to the backend. After submission or skip, players can restart immediately.
- Leaderboard panel fetches data on load (and refreshes after a new submission), shows loading/error states, and highlights the player’s latest entry when available.

### Key Discoveries:

- Score accumulation and game-over wiring live in `GameScene`, which is the natural point to trigger leaderboard refreshes once submissions complete (`src/ui/scenes/game.scene.ts:234-393`).
- The overlay is Pixi-based, so new form controls must also be implemented with Pixi display objects or by delegating to DOM overlays that sync with Pixi scenes (`src/ui/components/game-over-overlay.component.ts:18-99`).
- Layout/flex behavior is governed globally in `src/style.css:43-375`, so inserting a third column and reusing the existing score list inside the info panel will require CSS + markup reshuffling.

## What We're NOT Doing

- No authentication, anti-cheat, or email verification flows (emails stay server-side for future outreach).
- No historical leaderboard browsing UI beyond the most recent ISO week (the API can accept `week` but the UI will only hit the default for now).
- No automated pruning of old rows yet; storage growth will be handled later if needed.
- No changes to the in-game scoring logic or tier definitions (`GAME_CONFIG` remains untouched).

## Implementation Approach

1. **Backend first**: add database dependencies, shared DB helper, SQL schema initialization script, and Vercel function handlers for submit/read. Apply input validation (length limits, email format, basic spam guard like minimum drop interval check cookie later).
2. **UI structure**: move the static “Friends” list into the info panel, add a new leaderboard aside, wire responsive CSS, and build a lightweight data-fetch component that renders top 5 entries with friendly formatting.
3. **Submission UX**: extend the game-over overlay with nickname/email inputs plus Submit/Skip actions, call the submit API, show optimistic feedback, and refresh the leaderboard panel when a submission succeeds.

## Phase 1: Backend Foundations

### Overview
Provision Vercel Postgres support, define the `scores` table, and expose `POST /api/scores` and `GET /api/leaderboard` handlers that encapsulate ISO-week logic in UTC.

### Changes Required:

#### 1. Dependencies & Environment
**File**: `package.json`  
**Changes**: Add `@vercel/postgres` (DB client) and `zod` (input validation). Optionally add `date-fns` for ISO-week formatting if we don’t want to hand-roll the logic.

```json
"dependencies": {
  "@vercel/postgres": "^0.10.0",
  "zod": "^3.23.8",
  "date-fns": "^3.6.0"
}
```

Document required env vars (`POSTGRES_URL`, `POSTGRES_PRISMA_URL`, etc.) plus `vercel env pull` workflow in `README.md`.

#### 2. Shared DB Helper & Schema Bootstrap
**File**: `api/_db.ts` (new)  
**Changes**: Export a helper to run queries with `sql` from `@vercel/postgres`, wrap error handling, and expose a `ensureScoresTable()` lazy initializer (idempotent).

```ts
import { sql } from '@vercel/postgres';

export async function ensureScoresTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nickname TEXT NOT NULL,
      email TEXT,
      score INTEGER NOT NULL CHECK (score >= 0),
      iso_week TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS scores_iso_week_idx ON scores(iso_week, score DESC);
  `;
}
```

Provide a utility `getIsoWeekId(date = new Date())` that formats `YYYY-Www` using UTC (`to_char` in SQL or `date-fns/formatISOWeek`). This keeps ISO week logic consistent across handlers.

#### 3. Score Submission Endpoint
**File**: `api/scores.ts` (new Vercel function)  
**Changes**:
- Accept `POST` with JSON `{ score: number, nickname: string, email?: string }`.
- Validate shape via `zod` (nickname 2–20 chars, ascii/emoji allowed; email optional but must match RFC basic).
- Call `ensureScoresTable()`, compute iso week server-side, insert row, and return `{ placement, isoWeek, entry }`.
- (Optional) implement basic rate limiting via IP header + short-duration memory using Vercel Edge Config or a simple `try/catch` on DB unique constraint if we later add dedupe.

```ts
const result = await sql`
  INSERT INTO scores (nickname, email, score, iso_week)
  VALUES (${nickname}, ${email ?? null}, ${score}, ${isoWeek})
  RETURNING id, nickname, score, iso_week AS "isoWeek", created_at;
`;
```

Compute placement by selecting `COUNT(*)` of rows with `score > submittedScore` within same iso week and returning `rank = count + 1`.

#### 4. Leaderboard Endpoint
**File**: `api/leaderboard.ts`  
**Changes**:
- Support `GET` only. Optional `week` query param (defaults to current iso week).
- Query top 5 rows ordered by score DESC, tie-breaking on `created_at ASC`.
- Return JSON list with `nickname`, `score`, `createdAt`, `isoWeek`. Emails are never returned.
- Add `Cache-Control: no-store` for now (leaderboard should always be fresh).

Sample SQL:

```ts
const rows = await sql`
  WITH ranked AS (
    SELECT nickname, score, created_at
    FROM scores
    WHERE iso_week = ${isoWeek}
    ORDER BY score DESC, created_at ASC
    LIMIT 5
  )
  SELECT * FROM ranked;
`;
```

#### 5. Local Dev Support
**File**: `README.md`  
**Changes**: Document steps for `vercel env pull .env.local`, running `vercel dev`, and manual table bootstrap via `psql < init.sql` if needed. Mention privacy expectations for emails.

### Success Criteria:

#### Automated Verification:
- [x] Type-check & build succeeds: `npm run build`
- [x] Database helper compiles when imported by both API routes
- [ ] `vercel dev` starts without runtime errors when hitting the new endpoints *(not run — Vercel CLI is not configured in this environment)*

#### Manual Verification:
- [ ] `curl -X POST http://localhost:3000/api/scores ...` inserts a row and returns rank
- [ ] `curl http://localhost:3000/api/leaderboard` returns at most 5 entries, sorted correctly, with no emails
- [ ] Invalid payloads (empty nickname, negative score) return 400 with helpful message

**Implementation Note**: After completing this phase and validating endpoints locally (including table creation), pause for confirmation before touching the UI.

---

## Phase 2: Leaderboard Panel UI

### Overview
Restructure the DOM/CSS to host both the info panel (plus “Friends” list) and a new leaderboard panel, then build a frontend layer that fetches & displays the weekly top 5.

### Changes Required:

#### 1. Markup & Layout
**File**: `index.html`  
**Changes**:
- Keep the main info panel in the left column.
- Introduce a `#sidebar-panels` wrapper on the right that stacks two cards: the new `aside#leaderboard-panel` (with header + `<div id="leaderboard-list">`) and a `section#friends-panel` that sits directly beneath it for the tier list.

```html
<div id="sidebar-panels">
  <aside id="leaderboard-panel" aria-live="polite">
    <h2>Weekly Top 5</h2>
    <div id="leaderboard-list" data-state="loading"></div>
  </aside>
  <section id="friends-panel" aria-label="Friends tier list"></section>
</div>
```

#### 2. CSS
**File**: `src/style.css`  
**Changes**:
- Adjust `#app` flex order if necessary, ensuring desktop order info → game → leaderboard column.
- Style the new `#sidebar-panels` stack so `#leaderboard-panel` sits on top and `#friends-panel` matches the card aesthetic, with responsive rules to place the column below the game on screens ≤768px.
- Add classes for leaderboard entries (`.leaderboard-item`, `.leaderboard-rank`, etc.) plus states for loading/error/empty.
- Ensure the “Friends” section inherits info panel colors and remains scrollable.

#### 3. Friends Panel Mount Point Update
**File**: `src/main.ts` & `src/ui/components/score-panel.component.ts`  
**Changes**:
- Update `new ScorePanelComponent()` to target the new standalone container (e.g., `friends-panel`).
- Ensure `ScorePanelComponent.render()` prepends a header label (“Friends”) so the dedicated card communicates tier values.

#### 4. Leaderboard Client
**Files**: `src/api/leaderboard-client.ts` (new), `src/ui/components/leaderboard-panel.component.ts` (new)  
**Changes**:
- Build a fetch helper that calls `/api/leaderboard`, handles aborts, and normalizes responses.
- Component should manage states (loading, success, error) and re-render with top 5 entries.
- Accept an optional `highlightNickname` to style the player’s recent submission later.
- Hook component initialization in `src/main.ts` after assets load similarly to the friends panel.

### Success Criteria:

#### Automated Verification:
- [x] `npm run build` still passes with the new components/types
- [x] `npm run preview` serves the updated layout without console errors

#### Manual Verification:
- [ ] Desktop layout shows panels ordered info → game → leaderboard column (Weekly Top 5 card stacked above Friends card)
- [ ] On mobile (≤768px) the leaderboard stacks beneath the game container
- [ ] Leaderboard panel shows placeholder skeleton while loading, an error message when API fails, and formatted nickname/score rows when data exists
- [ ] “Friends” list remains visible inside the info panel with the same content as before

**Implementation Note**: After layout and data fetch rendering are in place, confirm UX with stakeholders before wiring submissions to refresh the list.

---

## Phase 3: Game-Over Submission Flow

### Overview
Add nickname/email inputs to the Pixi overlay, submit scores to the backend, allow skipping, and refresh the leaderboard panel when a submission succeeds.

### Changes Required:

#### 1. Overlay UI & State
**File**: `src/ui/components/game-over-overlay.component.ts`  
**Changes**:
- Embed a DOM form overlay positioned absolutely within `#game-container` that the Pixi overlay shows/hides, avoiding complex Pixi text-input handling but keeping visuals consistent.
- Include fields: nickname (required), email (optional), Submit, Skip, Restart buttons.
- Track submission states (idle, submitting, success, error) and disable buttons accordingly.

```ts
interface GameOverOverlayOptions {
  ...
  onSubmitScore?: (payload: ScorePayload) => Promise<void>;
}
```

#### 2. Submission Hook
**File**: `src/ui/scenes/game.scene.ts`  
**Changes**:
- When constructing `GameOverOverlayComponent`, pass `score` and a handler that calls a new `submitScore` helper (wrapping `fetch('/api/scores')`).
- After a successful submission, call into the leaderboard panel instance to trigger `refresh()` so the UI reflects the new entry.
- Store the last used nickname/email locally (e.g., in `localStorage`) to pre-fill future submissions.

#### 3. API Client
**File**: `src/api/scores-client.ts` (new)  
**Changes**:
- Expose `submitScore({ nickname, email, score }): Promise<SubmitResult>` that performs JSON fetch, handles HTTP errors, and returns placement info for UI feedback.
- Surface friendly error messages for validation failures vs server errors.

#### 4. Skip & Restart Flow
**Files**: `src/ui/components/game-over-overlay.component.ts`, `src/ui/scenes/game.scene.ts`  
**Changes**:
- Provide a visible “Skip” button that simply closes the form and allows the restart button to function without calling the API.
- Ensure restarting a game while a submission is in-flight cancels/ignores the promise to avoid state leaks.

### Success Criteria:

#### Automated Verification:
- [x] `npm run build` (Pixi + DOM overlay types compile)
- [x] Submission helpers covered by focused unit tests (Vitest) for payload validation and error mapping

#### Manual Verification:
- [ ] Game-over overlay shows nickname/email fields, a Submit action, and a Skip path
- [ ] Submitting a valid score hits the API, displays confirmation (rank or toast), and refreshes the leaderboard panel without page reload
- [ ] Skip + Restart works immediately without API calls
- [ ] Optional email never appears in the leaderboard UI but is visible in the database record
- [ ] Duplicate submissions (same player) simply add multiple rows; the leaderboard reflects the highest scores automatically

**Implementation Note**: After manual testing across desktop/mobile and confirming leaderboard refresh behavior, hand off for stakeholder approval before deployment.

---

## Testing Strategy

### Unit Tests:
- Add Vitest specs for ISO week helper functions (ensuring UTC behavior across year boundaries).
- Test `submitScore`/`fetchLeaderboard` clients with mocked `fetch` to ensure error branches are handled.
- Validate overlay form logic (e.g., nickname length enforcement).

### Integration Tests:
- Add a lightweight API integration test (run via `vitest --runInBand`) that spins up a local Postgres (or uses `@vercel/postgres` test client) to verify insertion + leaderboard query ordering.

### Manual Testing Steps:
1. Run `vercel dev`, finish a game, submit a score with nickname only—confirm leaderboard updates.
2. Submit another score with email; check DB manually (`SELECT * FROM scores ORDER BY created_at DESC LIMIT 1`) to ensure email stored but not shown in UI.
3. Change system date to Monday boundary or manually pass `?week=<prev_week>` to verify API respects ISO week filtering.
4. Test mobile viewport (Chrome dev tools, ≤768px) to ensure layout stacks correctly and form inputs remain accessible.

## Performance Considerations

- Leaderboard queries are limited to 5 rows and indexed by `(iso_week, score DESC)`, so latency stays low even with large history.
- Cache-busting: for now we always fetch fresh data; if traffic grows, we can add `stale-while-revalidate` headers or SWR caching on the client.
- Avoid blocking the render loop: all fetches occur outside Pixi’s main update cycle, and DOM overlays should be decoupled from Pixi tick logic.

## Migration Notes

- Run `vercel env pull .env.local` to populate local connection strings, then execute `npm run db:init` (a script that calls `ensureScoresTable()`) before first use.
- Existing deployments need the Postgres database provisioned via `vercel link` → “Storage” → “Add Postgres” and redeploy with the new environment variables.
- If we ever need to backfill iso-week data for legacy rows, run `UPDATE scores SET iso_week = to_char(created_at AT TIME ZONE 'UTC', 'IYYY-"W"IW') WHERE iso_week IS NULL;`.

## References

- Layout + friends list: `index.html:10-72`, `src/style.css:43-375`, `src/ui/components/score-panel.component.ts:13-55`
- Score handling and overlay creation: `src/ui/scenes/game.scene.ts:234-393`, `src/ui/components/game-over-overlay.component.ts:18-99`
- Package scripts/context: `package.json:7-18`
