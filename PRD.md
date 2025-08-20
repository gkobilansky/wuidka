Here’s a drop-in **PRD.md** you can paste into `wuidka/` and point Claude Code at.

```markdown
# WUIDKA — Product Requirements Document (PRD)
_Last updated: 2025-08-20_

> **Purpose:** Spec for building a polished, Suika-style 2D physics merge puzzler using **PixiJS + TypeScript + Vite** (with Matter.js for physics and Howler.js for audio). This PRD is written to be actionable by an AI code assistant (Claude Code) and a human dev.

---

## 1) One-liner
Drop-and-merge puzzle game where similarly ranked pieces collide, combine, and evolve up a tier ladder until the board overflows.

## 2) Goals & Non-Goals
**Goals (MVP)**
- Mobile-first, portrait web game that runs at 60 FPS on modern phones.
- Core loop: spawn → fall → collide → merge → score → survive.
- Tight, juicy feel: squash & stretch, particle pops, light screenshake.
- Fair randomization (bag RNG) and escalating difficulty curve.
- Offline-capable PWA with “Add to Home Screen”.
- No backend dependency; local high scores persisted.

**Non-Goals (MVP)**
- Accounts, cloud saves, social features.
- Real-money purchases, ads, rewarded videos.
- Cross-platform native binaries (Capacitor is optional/post-MVP).

## 3) Audience & Theme
- **Default audience:** casual mobile players (ages 8+), short sessions (2–6 minutes).
- **Theme placeholder:** _You_ supply art/brand. For MVP we’ll ship with **generic shapes** (Tier 1…12) so engineering can progress. Art can swap later without code changes (texture atlas).

> **TODO:[Design]** Replace generic shapes with your theme (e.g., “Space Slimes”, “Ocean Critters”, “Candy Orbs”). Sizes should stay proportional to preserve difficulty.

## 4) Platforms & Performance Targets
- **Target**: Mobile browsers iOS Safari 16+, Android Chrome 120+; Desktop Chrome/Edge/Safari current.
- **FPS**: 60 FPS target; degrade gracefully to 30 FPS on low-end.
- **Cold load**: ≤ 2.5s on fast 4G; first interaction ≤ 3.5s.
- **Bundle**: initial ≤ 1.2 MB gz (excluding webfont/audio), lazy-load non-critical SFX.

## 5) Tech Stack
- **Renderer:** PixiJS 8
- **Physics:** Matter.js (circle bodies; fixed time step)
- **Audio:** Howler.js (music + sfx, mute toggle)
- **Build:** Vite + TypeScript
- **PWA:** vite-plugin-pwa (offline cache, icons, manifest)

> **Optional (post-MVP):** Capacitor wrapper for iOS/Android.

## 6) Core Game Design

### 6.1 Board & Camera
- **Orientation:** Portrait.
- **Logical resolution:** 720 × 1280 (scaled to fit, devicePixelRatio aware).
- **Playfield:** Bucket/well with left/right walls and a floor (slightly curved floor OK).
- **Danger line:** Visual line ~160 px from top; crossing triggers “panic” state UI and audio cue.

### 6.2 Controls
- Tap/drag to position a **ghost** of the next piece along the top spawn bar; release to drop.
- Desktop: mouse; Mobile: single-finger touch.
- **Input rate-limit:** 6 drops per 10 seconds initially; ramps harder later.

### 6.3 Spawn System
- **Bag RNG**: full set of low-tier pieces shuffled; draw without replacement; refill when empty.
- **Preview:** Show next piece (right side UI).
- **Anti-frustration:** don’t spawn largest piece in first 30 seconds.

### 6.4 Physics
- Gravity: 1.6 × default (tweakable).
- Restitution: 0.03 (low bounciness).
- Friction: 0.05; airFriction: 0.02.
- Solver: fixed 60 Hz; render interpolated.
- Max active bodies: 120 (older/small bodies auto-sleep; off-screen cull safety).

### 6.5 Merge Ladder (MVP placeholder)
| Tier | Name (placeholder) | Radius(px) | Points on Merge |
|-----:|---------------------|-----------:|----------------:|
| 1    | Dot                 | 20         | 2               |
| 2    | Bead                | 26         | 5               |
| 3    | Pebble              | 33         | 10              |
| 4    | Marble              | 42         | 20              |
| 5    | Orb                 | 54         | 35              |
| 6    | Bubble              | 70         | 55              |
| 7    | Moonlet             | 90         | 85              |
| 8    | Planetseed          | 115        | 130             |
| 9    | Small Planet        | 145        | 190             |
| 10   | Giant Planet        | 180        | 270             |
| 11   | Star                | 220        | 380             |
| 12   | Nova (cap)          | 260        | 520             |

**Rule:** When two bodies of same tier collide and rest ≥ N ms (e.g., 60–100 ms) within overlap threshold, they merge into the next tier at the averaged position. Tier 12 cannot merge; large reward + celebratory effects.

### 6.6 Scoring
- **Drop bonus:** +1 per drop that settles below midline.
- **Merge points:** from table above.
- **Combo:** merging within 2s window adds +10% per extra merge (caps at +50%).
- **Survival bonus:** +1 per 5 seconds alive.
- **High score:** saved locally.

### 6.7 Lose Condition
- If any body’s centroid is above the top boundary for > 1.5s, trigger **Game Over**.
- Provide “last-chance wobble” (screenshake + slow-mo 0.7× for 1s) before final check.

### 6.8 Game Feel (Juice)
- **Merge FX:** scale up 1.15×, then ease back; small particle burst.
- **Impact FX:** tiny screenshake for heavy pieces (tiers 9+).
- **Audio:** soft click on drop, pop on merge, rising jingle on combo.
- **Haptics (mobile):** short vibration on big merges (if allowed).

## 7) UX & UI

### 7.1 Screens/States
- **Boot/Loading → Menu → Gameplay → Pause → Game Over**
- Menu: Play, Sound toggle, How to Play.
- HUD: Score (top-left), Next piece (top-right), Danger line indicator (near top).

### 7.2 Accessibility
- Colorblind-safe default palette.
- **Reduce Motion** toggle (disables screenshake/large squash).
- Sound on/off remembered.
- Tap targets ≥ 44 px.

## 8) Audio
- Single looping track (≤30s loop) at low volume.
- SFX sprite sheet: drop, merge small/medium/big, game over, line danger.
- Mute persists in localStorage.

## 9) PWA
- Installable; offline-first cache of core bundle, textures, and SFX.
- App name: **Wuidka**
- Icons: 192/512 PNG.
- Display mode: `standalone`.
- Orientation: `portrait`.
- Start URL: `/`.

## 10) Telemetry (Local, no backend in MVP)
- Local session summaries: duration, score, max tier reached, pieces dropped, merges.
- Optional: export JSON for debugging (hidden dev button).

> **Privacy:** No external analytics in MVP.

## 11) Content & Asset Guidelines
- One texture atlas for pieces (tiers 1–12) with @1x/@2x.
- Separate atlas for UI/effects.
- SFX in compressed formats (AAC/OGG) with short duration.
- All assets original or licensed; no borrowed IP.

## 12) Difficulty Curve
- First 30s: more Tier 1–3 in bag; gravity gentle.
- After 60s: raise spawn rate slightly; enable more Tier 4–6.
- After 120s: increase danger line pulsation frequency; tiny gravity bump.

## 13) Acceptance Criteria (MVP)
- ✅ Game plays in portrait on mobile, 60 FPS on modern devices.
- ✅ Pieces spawn, collide, and merge per spec; Tier 12 attainable.
- ✅ Lose condition triggers correctly with telegraphed warning.
- ✅ Scoring, combos, and high score saving work.
- ✅ PWA install works; app launches offline with full functionality.
- ✅ Sound and haptics toggles persist.
- ✅ No console errors; memory stable across 15 minutes of play.

## 14) Risks & Mitigations
- **Jank on low-end devices:** cap active bodies; sleep small items; reduce effect density via “Low Performance” mode.
- **Physics tunneling:** use lower time step or enable continuous collision for fast/large bodies.
- **Audio unlock on iOS:** play silent buffer on first tap to unlock.

## 15) Open Questions (fill as you decide)
- Target theme, art direction?
- Branding requirements (logos, fonts)?
- Age gating or COPPA considerations for kids?
- Monetization (post-MVP): cosmetic themes? daily challenges?

---

# Engineering Plan

## A) Project Structure (recommended)
```

/src
/assets/atlases
/audio
/game
Game.ts
/scenes
BootScene.ts
MenuScene.ts
PlayScene.ts
PauseScene.ts
GameOverScene.ts
/systems
PhysicsWorld.ts
Spawner.ts
MergeSystem.ts
Scoring.ts
Effects.ts
Input.ts
/ui
Hud.ts
Buttons.ts
/pwa
register-sw\.ts
main.ts
config.ts

````

## B) Key Systems

### PhysicsWorld.ts
- Initialize Matter.Engine with fixed step (1000/60 ms).
- World bounds: left/right walls, floor.
- Unit conversion helpers (px ↔ physics units).
- Body factory: `createPiece(tier, x, y)` with circle bodies, density proportional to radius.

### Spawner.ts
- Bag RNG implementation.
- Ghost preview sprite at top clamp(x in [left+radius, right−radius]).
- Drop rate cooldown.

### MergeSystem.ts
- On collisionStart between same-tier bodies → queue candidate.
- Confirm merge when velocity < ε and overlap persists > N ms.
- Remove both; spawn next-tier at averaged position with merge VFX.
- Combo timer window management.

### Scoring.ts
- Merge/Combo/Survival scoring; emits events for HUD.

### Effects.ts
- Particle bursts; tween squash/stretch; optional screenshake.
- Respect “Reduce Motion”.

### UI/HUD
- Score counter; Next preview; Sound toggle; Pause button.
- Danger line indicator; blink when any centroid > line.

### Game States
- Boot → preload textures/audio.
- Menu → actions.
- Play → core loop; pause overlay.
- Game Over → final score; “Play Again”, “Menu”.

## C) Configuration (`config.ts`)
```ts
export const GAME_CONFIG = {
  width: 720,
  height: 1280,
  gravity: 1.6,
  maxBodies: 120,
  dangerLineY: 160,
  comboWindowMs: 2000,
  mergeRestMs: 80,
  tiers: [
    { id: 1, r: 20, points: 2 },
    { id: 2, r: 26, points: 5 },
    { id: 3, r: 33, points: 10 },
    { id: 4, r: 42, points: 20 },
    { id: 5, r: 54, points: 35 },
    { id: 6, r: 70, points: 55 },
    { id: 7, r: 90, points: 85 },
    { id: 8, r: 115, points: 130 },
    { id: 9, r: 145, points: 190 },
    { id:10, r: 180, points: 270 },
    { id:11, r: 220, points: 380 },
    { id:12, r: 260, points: 520, cap: true },
  ]
};
````

## D) Persistence

* `localStorage` keys:

  * `wuidka:highscore`
  * `wuidka:settings:sound`
  * `wuidka:settings:reduceMotion`

## E) PWA Setup

* vite-plugin-pwa with:

  * `registerType: 'autoUpdate'`
  * cache `index.html`, `manifest.webmanifest`, main chunk(s), atlases, minimal SFX.
* Manifest:

  * `name: "Wuidka"`, `short_name: "Wuidka"`
  * `display: "standalone"`, `orientation: "portrait"`

---

# QA Plan

## Manual Test Checklist

* [ ] First tap unlocks audio on iOS; mute toggle works/persists.
* [ ] Ghost preview clamps within walls; drop feels responsive.
* [ ] Two identical tiers merge reliably (no phantom misses).
* [ ] Combo multiplier increases with rapid merges; decays after 2s.
* [ ] Lose condition only after 1.5s above top; visible/aural warning precedes it.
* [ ] PWA installs on iOS and Android; offline play works.
* [ ] Reduce Motion removes shake and strong tweens.
* [ ] Memory stable after 15-minute idle + play cycles.

## Performance Checks

* [ ] ≤ 120 active bodies; sleep toggles on small/old bodies.
* [ ] 60 FPS steady on mid-range Android; 30 FPS fallback OK.
* [ ] Draw calls reasonable; texture atlas batching verified.

---

# Roadmap (Post-MVP Ideas)

* Daily challenge with fixed seed.
* Themes/skins (swap atlas via settings).
* Lightweight leaderboard (privacy-respecting backend).
* Power-ups: “wind gust”, “shrink”, “slow time”.
* Replay export (seed + inputs).

---

# Claude Code Usage Notes

* Treat this PRD as the source of truth.
* Prefer small, focused files per system (see structure above).
* When uncertain about tuning (gravity, restitution), expose constants in `config.ts`.
* Generate TypeScript types for events and config to keep compile-time safety.
* Add inline TODOs with `// TODO:[Design]` or `// TODO:[Tune]` where assets/tuning needed.
* Use Pixi containers for scenes; keep Matter bodies decoupled from sprites via IDs.

---

# Definition of Done (MVP)

* The game is playable end-to-end in browser and installable as a PWA.
* Visual/aural feedback feels crisp; merges are satisfying.
* No regressions in QA checklist; acceptance criteria met.
* Codebase organized per plan; constants/config externally tunable.
* All TODOs are either resolved or tracked in Roadmap.

