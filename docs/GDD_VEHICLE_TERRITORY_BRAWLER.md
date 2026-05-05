# Core Surge Arena Pivot GDD (Lite)

This document defines the recommended pivot from the current tunnel-race prototype into a viral-friendly multiplayer vehicle brawler for CrazyGames and mobile.

## 1) Product Direction

- **Working title:** `Core Surge: Grid Clash`
- **Genre:** real-time 2D `.io` arena brawler with vehicle combat + territory control
- **Session target:** 3-5 minutes
- **Players:** 2-8 (humans + bot backfill)
- **Camera/UI:** low-UI, readable, bright colors, instant gameplay
- **USP:** easy controls, high-chaos highlights, clutch last-second objective steals

### Why this direction

- Keeps your vehicle-based multiplayer foundation.
- Avoids expensive character animation pipelines.
- Improves spectator/share moments compared to pure race scoring.
- Fits CrazyGames launch KPIs (fast onboarding, longer sessions, replay loops).

## 2) Core Loop

1. Queue and spawn instantly in a live arena.
2. Drive to collect `energy` orbs for speed and ability charge.
3. Enter objective zones to capture and score teamless control points.
4. Use map pickups to disrupt opponents (EMP, mine, ram burst).
5. Score by objective hold ticks + eliminations + streak bonuses.
6. End match, show rank and rewards, offer one-tap rematch.

## 3) Design Pillars

- **Immediate fun:** first control response in under 1 second after spawn.
- **Readable chaos:** effects are flashy but never hide threats.
- **Short mastery arc:** beginners survive quickly; experts optimize routes/combos.
- **High replayability:** rotating zones and loadout variation each match.
- **Fair F2P:** monetization is cosmetic and convenience only.

## 4) Audience & Platform Fit

- **Primary:** CrazyGames desktop browser players (quick-entry sessions).
- **Secondary:** mobile web/native users with touch controls.
- **Content rating target:** PEGI 12-compatible combat style.
- **Onboarding constraint:** gameplay starts immediately (at most one click).

## 5) Game Rules (v1)

- Free-for-all scoring format.
- Match timer: 240 seconds.
- Arena contains 2 active control zones at a time.
- Zone scoring:
  - +2 score/sec while being uncontested in zone.
  - +1 bonus/sec if player is on a streak (3+ eliminations without death).
- Elimination scoring:
  - +12 attacker, +4 assister (if support actions added in v2).
  - Victim respawns after 2.5 seconds with short spawn shield.
- Win condition: highest score when timer ends.

## 6) Vehicle Classes (No Animation Dependency)

Each class uses the same base sprite rig and differs via stats and ability timers.

- `Interceptor`: high speed, low durability, burst dash.
- `Bulwark`: high durability, low speed, frontal damage reduction.
- `Trickster`: medium stats, short cloak/juke pulse.

### Shared pickups

- `EMP`: disables boost/ability in radius for 1.2s.
- `Mine`: drops delayed area hazard.
- `Overdrive`: temporary acceleration + collision force bonus.

## 7) Meta & Retention Hooks

- Profile level from match XP.
- Cosmetic unlock track (paint, wheel trail, decal, horn/emote).
- Daily objective cards (3 quick tasks).
- Streak bonus chest after 2/4/6 completed matches.
- Rematch chain bonus (+10% XP if replaying immediately).

## 8) Virality Features (Must-Have)

- Party code and invite link support.
- Post-match "revenge" CTA against last eliminator.
- Auto-generated short highlight event feed (e.g., "Zone steal at 00:03").
- Player nameplates with optional country flag icon.
- Seasonal leaderboard reset cadence (weekly for launch).

## 9) Monetization Strategy

- Cosmetics sold by soft currency + premium currency.
- Rewarded ad options:
  - one post-match double reward
  - one daily free chest reroll
- No stat-selling items in competitive queue.
- Interstitials only at natural breaks (never during active driving).

## 10) Technical Architecture Mapping

## Current baseline (already in repo)

- Authoritative server simulation (`server/src/simulation.ts`)
- Colyseus room lifecycle (`server/src/rooms/ArenaRoom.ts`)
- Shared schema package (`shared/src/schema.ts`)
- Phaser scene + network client (`client/src/game/GameScene.ts`, `client/src/network/NetClient.ts`)

## Target architecture additions

- **Server simulation modules**
  - `MovementSystem`
  - `CombatSystem`
  - `ZoneControlSystem`
  - `SpawnSystem`
  - `BotDecisionSystem`
- **Client modules**
  - `ArenaRenderer`
  - `InputController` (keyboard + touch)
  - `HudController` (minimal score/timer/state)
  - `VfxController` (non-blocking readability-first effects)
- **Shared data**
  - message enums
  - config tables for vehicles/pickups/zones
  - deterministic tick constants

## 11) Data Model (Shared Schema v2)

The current schema is race/lane oriented and should pivot to free-movement arena state.

### ArenaState

- `players: Map<PlayerState>`
- `projectiles: Map<ProjectileState>`
- `pickups: Map<PickupState>`
- `zones: Map<ZoneState>`
- `elapsedMs: number`
- `matchDurationMs: number`
- `phase: string` (`warmup|live|results`)

### PlayerState

- `id: string`
- `name: string`
- `isBot: boolean`
- `alive: boolean`
- `x: number`
- `y: number`
- `vx: number`
- `vy: number`
- `rotation: number`
- `vehicleClass: string`
- `hp: number`
- `shieldMs: number`
- `abilityCooldownMs: number`
- `respawnMs: number`
- `score: number`
- `streak: number`
- `zoneTicks: number`

### ZoneState

- `id: string`
- `x: number`
- `y: number`
- `radius: number`
- `controllerId: string`
- `captureProgress: number`
- `scoreTickMs: number`

### PickupState

- `id: string`
- `kind: string` (`emp|mine|overdrive|energy`)
- `x: number`
- `y: number`
- `respawnAtMs: number`

### ProjectileState

- `id: string`
- `ownerId: string`
- `kind: string`
- `x: number`
- `y: number`
- `vx: number`
- `vy: number`
- `ttlMs: number`

## 12) Networking Contract (High Level)

- Client -> Server:
  - `input` `{ throttle, steer, ability, fire, brake }`
  - `quickchat` `{ type }` (optional v2)
- Server -> Client:
  - authoritative state patches
  - event messages (`elimination`, `zoneCaptured`, `countdown`, `matchEnded`)

## 13) Migration Plan from Current Skeleton

1. Replace lane-distance movement with XY velocity + friction model.
2. Remove track entities (obstacles/orbs/powerups on distance axis).
3. Introduce arena map bounds and obstacle colliders.
4. Add zone capture simulation and score tick logic.
5. Add combat hit resolution and respawn cycle.
6. Update client projection from tunnel perspective to top-down arena.
7. Keep bot backfill but retune AI for nearest-zone behavior.

## 14) Prioritized Backlog

## Milestone A - Vertical Slice (week 1)

- [ ] Replace race state fields with arena XY fields in `shared/src/schema.ts`.
- [ ] Implement deterministic movement and collision in `server/src/simulation.ts`.
- [ ] Render top-down arena + 8 vehicles in `client/src/game/GameScene.ts`.
- [ ] Add one capture zone and score tick loop.
- [ ] Show score, timer, rank with minimal HUD.
- [ ] Ensure bots spawn to fill to 4 players.

**Exit criteria:** 4-player matches run end-to-end with scoring and win screen.

## Milestone B - Core Fun (week 2)

- [ ] Add 3 vehicle classes with config-driven stats.
- [ ] Add 3 pickups (`EMP`, `Mine`, `Overdrive`).
- [ ] Add elimination + respawn + spawn shield.
- [ ] Add kill feed and brief hit feedback.
- [ ] Implement party code join flow.

**Exit criteria:** objective + combat interplay creates replayable 3-5 minute rounds.

## Milestone C - Retention & Viral Hooks (week 3)

- [ ] Add progression XP and cosmetic unlock track.
- [ ] Add daily objectives and rematch bonus chain.
- [ ] Add end-match shareable highlights text summary.
- [ ] Add weekly leaderboard endpoint and client widget.

**Exit criteria:** players have clear return and social-share reasons.

## Milestone D - Platform Optimization (week 4)

- [ ] Mobile touch controls and responsive safe-area UI.
- [ ] Performance pass (draw calls, object pooling, bundle reduction).
- [ ] First-play UX tuning to gameplay in <=1 click.
- [ ] CrazyGames integration polish and launch checklist.

**Exit criteria:** ready for CrazyGames Basic Launch KPIs and mobile test rollout.

## 15) KPIs to Track from Day 1

- Conversion to >=1 minute session.
- Average session length.
- D1 retention.
- Rematch rate.
- Party-play share (matches with invite codes).
- Rewarded ad opt-in rate.

## 16) Immediate Next Implementation Step

Start Milestone A with schema migration and simulation refactor first, because every downstream feature depends on authoritative movement/combat fields.
