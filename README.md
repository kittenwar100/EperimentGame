# Core Surge Arena

`Core Surge Arena` is a lightweight Phaser + Colyseus multiplayer arena prototype built for fast browser play. It uses a server-authoritative simulation, procedural visuals, bot backfill, level-up upgrades, and a CrazyGames-friendly integration wrapper.

## What is here

- `client/`: Phaser + Vite frontend
- `server/`: Colyseus authoritative game server
- `shared/`: gameplay constants, archetypes, upgrade data, and shared types
- `docs/GDD_VEHICLE_TERRITORY_BRAWLER.md`: pivot design, data model, and milestone backlog for the vehicle territory-brawler direction
- `CURSOR_PROMPT_DIEP_STYLE_MULTIPLAYER_GAME.md`: the reusable high-level Cursor prompt that can generate or extend this game further

## Run locally

Copy `client/.env.example` to `client/.env` and set your Railway Colyseus URL:

```env
VITE_SERVER_URL=wss://your-app.up.railway.app
```

```bash
npm install
npm run dev
```

This starts the client on `http://localhost:5173` and connects to the server in `client/.env` (Railway). It does **not** start a local Colyseus server.

To run a **local** server plus client (for server development):

```bash
npm run dev:local
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Controls

- `WASD` or arrow keys: move
- mouse: aim
- left click: fire
- `Space`: use Core Surge ability

## Current gameplay scope

- one free-for-all arena
- four archetypes: `Pulse`, `Lancer`, `Sentinel`, `Drifter`
- XP orbs, kills, leaderboard, respawns, and upgrade choices
- bot fill when player count is low
- local synthesized sound effects
- local-safe CrazyGames SDK wrapper

## CrazyGames notes

The client includes a wrapper for:

- SDK init
- loading start/stop
- gameplay start/stop
- invite room param lookup
- instant multiplayer detection
- join-room listener

On localhost, all of these fail safely without crashing.

## Suggested next improvements

- room-based invites with private/public queue split
- more readable VFX, hit flashes, and death explosions
- stronger bot behaviors and map hotspots
- mobile fallback input
- production asset splitting to reduce the Phaser bundle warning
