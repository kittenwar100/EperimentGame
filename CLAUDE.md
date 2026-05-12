# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root and use npm workspaces.

- `npm install` — installs all three workspaces.
- `npm run dev` — runs server (`tsx watch` on `:2567`) and client (Vite on `:5173`) in parallel via `concurrently`.
- `npm run build` — builds `shared`, then `server` (tsc), then `client` (vite build), in that order.
- `npm test` — runs the server test suite only (`node --test --import tsx server/src/**/*.test.ts`). There are no client tests.
- Run a single server test file: `npm test --workspace @core-surge/server -- server/src/simulation.test.ts` (or `node --test --import tsx server/src/simulation.test.ts` from `server/`).
- Server health probe (when running): `GET http://localhost:2567/health`.
- Client dev override: set `VITE_SERVER_URL=ws://host:port` to point the Colyseus client at a non-default server (otherwise it derives `ws[s]://<window.location.hostname>:2567`).

## Architecture

### Workspaces and module wiring

Three npm workspaces — `client`, `server`, `shared` — sharing `tsconfig.base.json` (ES2022, strict, `noUncheckedIndexedAccess`, `experimentalDecorators`, `module: ESNext`, `moduleResolution: Bundler`).

`shared` is consumed two different ways and both must work:

- **Client** imports it as `@shared`, resolved by the Vite alias in `client/vite.config.ts` and the `paths` entry in `tsconfig.base.json`, both pointing at `shared/src/index.ts`.
- **Server** imports it via relative paths (`../../shared/src/...`) and includes `../shared/src/**/*.ts` directly in its `tsconfig.json` (`rootDir: ".."`, so compiled output lands under `server/dist/shared/...` and `server/dist/server/...`).

When adding a new shared symbol, re-export it from `shared/src/index.ts` and use the appropriate import style on each side. `shared/src/archetypes.ts` and `shared/src/upgrades.ts` are intentionally empty stubs kept only so legacy imports still resolve — don't add new content there without a reason.

### Server-authoritative simulation

The server is a thin Colyseus shell around one big simulation class:

- `server/src/index.ts` — boots `colyseus.Server` with `WebSocketTransport` + Express (CORS open, `/health`), and registers `ArenaRoom` under the room name from `shared/src/constants.ts` (`ROOM_NAME = "core-surge-grid-clash"`).
- `server/src/rooms/ArenaRoom.ts` — single room class. `autoDispose = false`, `patchRate = 1000/20` (20 Hz state diffs), `setSimulationInterval` at `1000/SERVER_TICK_RATE` (30 Hz). Handles two messages: `"input"` (per-client `InputState`) and `"restart"` (any current player can restart). The **first joining human picks the game mode** (`options.mode === "ffa"` → octagon FFA, else rectangular sandbox); subsequent humans drop into the in-progress match.
- `server/src/simulation.ts` (`GameSimulation`) — owns *all* gameplay: movement, projectiles, pickups, drifting spikes, slow zones, flag carry/capture, capture rings, mutators, world events, FFA frenzy, bot AI and backfill, respawns, score, match phases (`countdown` → `live` → `results`). Reads inputs via `setInput(sessionId, input)`; writes everything to the `ArenaState` schema it was constructed with. Tests poke it through the `state` private field by string-indexing — keep that surface stable when refactoring.
- `server/src/state.ts` — a re-export shim. The actual schema lives in `shared/src/schema.ts`.

### Networked state (Colyseus schema)

`shared/src/schema.ts` defines every replicated entity (`PlayerState`, `ZoneState`, `FlagState`, `ProjectileState`, `PickupState`, `SpikeState`, `SlowZoneState`, `ArenaState`) using the **functional `schema({...}, "Name")` form** from `@colyseus/schema` (string-typed fields), not the decorator form. Adding a field requires editing the schema *and* updating any client/server code that depends on the field — the client receives `ArenaState` typed via `@colyseus/sdk`'s `joinOrCreate<ArenaState>(...)` in `client/src/network/NetClient.ts`.

Some FFA bookkeeping is denormalized into flat fields (`ffa0Score`…`ffa7Score`, `pickupDash0`…`pickupDash7`) and accessed in `simulation.ts` via `state as unknown as Record<string, number>` — schema doesn't easily support indexed numeric arrays in v0.17.

### Modes and arena geometry

Two modes share the same simulation:

- `sandbox` — rectangular arena (`ARENA_WIDTH × ARENA_HEIGHT`), four corner safe zones, four team home bases.
- `ffa` — octagonal playfield centered at `(ARENA_WIDTH/2, ARENA_HEIGHT/2)` with radius `FFA_OCTAGON_RADIUS`. Player/projectile/pickup positions are clamped with `clampToOctagon` / `pointInOctagon` from `shared/src/octagon.ts`. FFA has a "frenzy" stage after `FFA_FRENZY_AFTER_MS` of live play with 2× move speed and no ammo cooldowns.

The four team ids are `red | blue | green | yellow`; FFA octagon assigns these to vertices 0/2/4/6 (`OCTAGON_FFA_BASE_SLOTS`). Legacy 8-slot `ffa0`…`ffa7` ids exist in the schema for older clients but live FFA uses the four-color set.

### Client

Phaser 4 + Vite, single-scene game:

- `client/src/main.ts` — boots `CrazyGamesService`, `NetClient`, `SfxController`, then renders the launcher (`mountHomePage`) to collect `{ name, mode }` before constructing `Phaser.Game` with `GameScene`.
- `client/src/game/GameScene.ts` — the entire renderer/interpolator/input loop. Subscribes to `room.state`, draws everything as Phaser graphics primitives (no sprites/assets), sends `InputState` at `INPUT_SEND_RATE_MS` (50 ms).
- `client/src/network/NetClient.ts` — Colyseus wrapper. Supports `joinById` for invite links with a fallback to `joinOrCreate`.
- `client/src/sdk/CrazyGamesService.ts` — defensive wrapper around `window.CrazyGames.SDK`. Every method no-ops on localhost; never throws. Adding new SDK touchpoints must preserve this "fail safe when unavailable" property.
- `client/src/launcher/mountHomePage.ts`, `client/src/ui/hud.ts`, `client/src/audio/SfxController.ts` — launcher UI, in-game HUD, and Web Audio synth (no audio files shipped).

### Tests

`server/src/simulation.test.ts` runs `GameSimulation` against a fresh `ArenaState`, advances simulated time with `simulation.update(ms)`, and asserts on observable state mutations. Note the boundary it checks: countdown is `ROUND_COUNTDOWN_MS` of inert state before `phase === "live"`; many tests step forward by that amount before issuing inputs. Tests reach into `simulation["state"]` directly — don't add a getter that breaks that.

## Notable conventions

- Tuning numbers all live in `shared/src/constants.ts` (with constants like `PLAYER_MAX_SPEED`, `PROJECTILE_EXPLOSION_RADIUS`, `FFA_FRENZY_AFTER_MS`) and are consumed by both client (for prediction/visuals) and server (for authority). Change them in one place; do not hardcode duplicates on either side.
- The product is referred to as **Core Surge Arena** in docs and **Neon Drift Arena** in the launcher/`<title>` — both names appear in the live codebase, don't "fix" one without checking the other.
- Phaser 4 (`phaser@^4.0.0`) and TypeScript 6 (`typescript@^6.0.3`) are intentional; `ignoreDeprecations: "6.0"` in `tsconfig.base.json` is what lets the experimental-decorators flag continue compiling under TS 6.
- The README's mention of "WASD/arrows + mouse + Space (Core Surge)" and `Pulse/Lancer/Sentinel/Drifter` archetypes describes the *prior* design; archetypes/upgrades are now stubs and the live game is the territory/flag brawler described in `docs/GDD_VEHICLE_TERRITORY_BRAWLER.md`. Treat the GDD and the code as the source of truth over the README when they conflict.
