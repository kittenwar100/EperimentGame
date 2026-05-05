# Cursor Prompt: Phaser Multiplayer Arena Game

Copy everything inside the block below into a fresh Cursor chat with `GPT-5.4`.

```text
Build a complete, production-minded 2D browser multiplayer game using Phaser, TypeScript, Vite, Node.js, and Colyseus. The result must be a fully playable online game, not a prototype or design doc.

The game should be strongly inspired by the broad appeal of Diep.io, but it must be original in mechanics, balancing, naming, code, visuals, assets, audio, and presentation. Do not clone Diep.io directly. Preserve only the high-level strengths: instant readability, satisfying arena combat, upgrade-driven progression, strong replayability, high-action sessions, simple controls, and low art complexity with high visual clarity.

I want a gameplay-heavy, not graphically heavy, highly addictive game that looks clean and eye-catching through motion, feedback, color, contrast, particles, and silhouette clarity rather than expensive art. Keep the UI minimal. The game should feel ready to ship on CrazyGames after polish, and the codebase should be organized as if it may continue into live ops.

Non-negotiable goals:
- Create a full multiplayer online game with an authoritative server.
- Use Phaser on the client and Colyseus + Node.js on the server.
- Use TypeScript everywhere practical.
- Generate original local assets yourself. Do not depend on external art packs, icon packs, audio packs, or paid assets.
- Keep the initial version focused on one excellent core mode rather than many shallow modes.
- Make it SDK-ready for CrazyGames from the start.
- Favor fun, retention, clarity, and responsiveness over feature bloat.
- Produce modular, maintainable code with clear separation of concerns.
- Keep files reasonably small; avoid large files over about 300 lines when practical by splitting responsibilities.
- Add concise comments only where logic is non-obvious.
- Include targeted tests for important pure logic and server-side gameplay rules where valuable.

Core product direction:
- Make a top-down 2D online arena shooter with geometric visuals and a powerful, readable combat loop.
- Core mode: one polished free-for-all arena mode with drop-in multiplayer.
- Match size target: support a practical room size around 12 to 20 players, with bots allowed to backfill low-population rooms so the game always feels alive.
- Session length target: short but sticky rounds, roughly 4 to 8 minutes of high action, with immediate re-entry.
- Primary platform target: desktop web first for CrazyGames, with responsive scaling and graceful fallback behavior on smaller screens.
- Controls target: keyboard + mouse, with the movement/shooting feel tuned for instant satisfaction.
- The player should be in action within one click from load.

Make the game original by centering it around this hook:
- Every player controls a combat vehicle built around a glowing energy core.
- Combat, movement, and upgrades are readable like an io arena shooter, but each build also revolves around a unique active ability called a Core Surge.
- Core Surge is short, impactful, and easy to understand visually. It creates memorable skill moments without adding UI complexity.
- Examples of Surge patterns you may implement across build paths: short overdrive burst, defensive pulse, piercing shot mode, deployable drone burst, recoil dash, temporary shield reflect, or area suppression pulse.
- The game should still feel easy to learn in seconds, but should have enough build variety and combat expression to keep players playing.

Define and implement an original game identity:
- Choose an original game name.
- Use a consistent original visual theme, color system, and terminology.
- Avoid naming anything after Diep.io systems or classes directly.

MVP content scope:
- One polished free-for-all arena.
- One map with strong readability, good spawn safety, and a few clear risk/reward hotspots.
- Neutral AI targets or destructible objective shapes that grant XP and create map activity.
- Real player combat with projectiles, collisions, health, death, respawn, kill feed, score, and leaderboard.
- XP and level-ups during a run.
- Meaningful upgrade choices during a run.
- A small but strong set of original build archetypes, around 4 to 6, unlocked through level progression or branching upgrades.
- A small set of core stat upgrades, around 6 to 8, such as fire rate, damage, projectile speed, max health, regen, movement, ability cooldown, or drone capacity.
- Bots that can move, fight, level, and keep rooms populated if not enough humans are present.
- Spectator or soft waiting behavior only if necessary; prefer immediate respawn and continuous play.

Game feel requirements:
- Strong hit feedback, recoil, impact flashes, particles, camera shake used sparingly, satisfying sound cues, and crisp motion.
- Excellent readability under chaos. Bullets, hazards, allies, enemies, pickups, and objective targets must be easy to distinguish.
- Minimal UI. Most information should be readable in the world.
- Fast onboarding. No long menu flow. The player should quickly enter gameplay.
- Make the moment-to-moment feel addictive: chaining kills, leveling up, escaping with low health, hitting power spikes, and using Core Surge at clutch moments.

Visual and asset requirements:
- Create all assets locally and originally.
- Prefer lightweight generated visuals:
  - Phaser Graphics drawing
  - procedural shapes
  - generated textures
  - small SVG or canvas-generated assets
  - tiny shader or post-processing touches only where valuable
- Create original particle effects, muzzle flashes, explosions, trails, damage flashes, spawn effects, and upgrade effects.
- Create original audio locally:
  - lightweight synthesized SFX via code or generated audio files
  - simple original music loop only if it materially improves the experience
- Keep download size lean and web-friendly.
- No external CDN game assets except allowed platform SDK scripts.

Multiplayer and netcode requirements:
- The server must be authoritative for player state, combat, health, deaths, projectiles or validated projectile simulation, XP, upgrades, bots, and scoring.
- Clients may only send inputs and menu/intention actions.
- Use a fixed simulation tick on the server.
- Implement client-side prediction for the local player where appropriate.
- Implement interpolation for remote entities.
- Implement reconciliation for local player correction if divergence gets too large.
- Validate all upgrade choices, fire requests, ability triggers, and movement-related actions server-side.
- Build with anti-cheat basics in mind: assume clients are untrusted.
- Design state synchronization carefully so it is efficient and understandable.
- Keep shared gameplay constants and message contracts in a shared package/module.

Project architecture requirements:
- Use a clean monorepo or clearly separated workspace structure such as:
  - client/
  - server/
  - shared/
- Client responsibilities should be separated into areas like:
  - boot/config
  - asset generation/loading
  - scenes
  - entities/renderers
  - input
  - networking
  - interpolation/prediction
  - UI/HUD
  - audio
  - SDK integration
- Server responsibilities should be separated into areas like:
  - room setup
  - simulation loop
  - entity systems
  - bot AI
  - combat rules
  - progression/balance
  - validation
- Shared code should include:
  - gameplay constants
  - enums/types
  - ability/build definitions
  - upgrade data
  - utility functions safe to share

Engineering quality requirements:
- Use descriptive names.
- Keep functions focused.
- Avoid deep nesting and giant god-classes.
- Add basic error handling and safe fallbacks.
- Make local development easy with clear scripts.
- Include a short README with setup, run, build, and deployment notes.
- Add focused tests for important pure logic such as upgrade math, bot utility logic, combat calculations, or progression rules.
- If a system becomes large, split it into small files instead of bloating one file.

CrazyGames readiness requirements:
- Integrate the CrazyGames HTML5 v3 SDK through a small wrapper service with local no-op or mock-friendly fallbacks for localhost.
- Await SDK initialization before using SDK-only features.
- Use loading hooks when the game starts loading and completes loading.
- Call gameplay start/stop at appropriate times.
- Support invite-link multiplayer flow.
- Support room join handling from invite parameters.
- Support instant multiplayer flow using the SDK flag so users can land in a joinable multiplayer room immediately when needed.
- Structure the game so keeping rooms across rounds is straightforward.
- Keep the path to gameplay extremely short.
- Do not include external ads. Only prepare SDK-friendly integration points.
- Keep build size and asset strategy aligned with web portal constraints.

Recommended CrazyGames integration details:
- Add a thin service module that wraps:
  - init
  - gameplayStart
  - gameplayStop
  - sdkGameLoadingStart
  - sdkGameLoadingStop
  - inviteLink
  - invite params access
  - join room listener
  - isInstantMultiplayer
- Make the game work normally outside CrazyGames.
- If the SDK is unavailable, fall back cleanly without crashing.

Gameplay design expectations:
- The very first playable version should already include:
  - movement
  - shooting
  - damage/death
  - XP gain
  - at least one level-up choice
  - at least one working bot
  - leaderboard
  - online room join flow
- Then expand into a polished MVP with build archetypes, Core Surge abilities, better bots, particles, audio, and CrazyGames hooks.
- Tune for satisfying progression ramps and frequent moments of reward.
- Make death frustrating enough to matter but quick to recover from.
- Encourage aggressive play and movement rather than passive camping.

Original build direction:
- Create around 4 to 6 original archetypes with distinct combat identities.
- Each archetype should have:
  - base weapon behavior
  - stat tendencies
  - one Core Surge active ability
  - one clear strength
  - one clear weakness
- Keep the archetypes readable and balanced enough for a launchable MVP.

Bot design requirements:
- Bots should do more than wander randomly.
- They should pursue nearby XP opportunities, avoid obvious danger when low health, fire at visible enemies, and use abilities on simple but sensible rules.
- Keep bot logic simple, deterministic where useful, and server-side.
- Bots should make low-population matches fun without feeling impossible.

UI requirements:
- Minimal UI only.
- Include just the essentials:
  - start/play entry
  - nickname field or guest default if needed
  - HUD with health, XP/level, ability cooldown, and small leaderboard
  - upgrade selection overlay
  - death/respawn feedback
- The game should rely more on world feedback than panels.

Audio requirements:
- Use lightweight original audio.
- Strong priority on gameplay SFX over music.
- Add audio toggles or sensible mute handling if easy.

Performance requirements:
- Keep rendering efficient.
- Be careful with particle counts and object lifecycles.
- Pool objects when it materially helps.
- Avoid unnecessary allocations in the hot path.
- Keep both client and server code suitable for browser play at scale.

Security and robustness requirements:
- Never trust client combat or progression claims.
- Validate inputs and clamp values server-side.
- Avoid hidden coupling between render state and authority state.
- Keep network messages explicit and limited.

Delivery requirements:
- Actually create the codebase and files.
- Generate the assets as local project assets or in-code asset generators.
- Do not stop at a plan unless blocked.
- If you must make a tradeoff, choose the option that gets the game playable sooner while preserving long-term structure.
- Keep the project runnable locally with simple commands.
- Provide a final README and a short list of follow-up improvements after the MVP is done.

Implementation order:
1. Scaffold the workspace and package structure.
2. Implement shared gameplay definitions and constants.
3. Implement the authoritative Colyseus room, state, simulation loop, combat, XP, upgrades, and bots.
4. Implement the Phaser client boot flow, networking, interpolation/prediction, rendering, input, and HUD.
5. Add build archetypes and Core Surge abilities.
6. Add generated visuals, particles, audio, and strong feedback polish.
7. Integrate CrazyGames SDK wrapper and multiplayer invite/instant-join flow.
8. Add targeted tests and write the README.
9. Run the game locally and fix major issues until the loop is playable.

Acceptance criteria:
- A player can load the game and reach gameplay almost immediately.
- Multiple players can connect to a room and fight in real time.
- The game feels responsive and readable.
- XP, leveling, upgrades, deaths, respawns, and leaderboard all work.
- Bots keep low-pop rooms lively.
- Core Surge abilities create meaningful combat moments.
- Visuals are simple but striking and polished.
- The codebase is modular and maintainable.
- The game runs without requiring third-party art or audio downloads.
- The project is structured to be ready for CrazyGames SDK usage and deployment.

Important constraints:
- Do not create a gray-box tech demo with weak feel.
- Do not create a giant scope with multiple unfinished modes.
- Do not depend on Firebase, Unity, PlayCanvas, or other alternate stacks.
- Do not use external art generators or online-hosted assets.
- Do not create messy giant files.
- Do not leave the server as a stub. Multiplayer must be real.

When you respond, start implementing immediately. Briefly state the chosen original game name and high-level structure, then create the project. Make pragmatic decisions yourself without asking unnecessary clarifying questions unless truly blocked.
```
