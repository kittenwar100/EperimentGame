import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOOST_CHARGES_PER_LIFE,
  BOOST_COOLDOWN_MS,
  BOOST_DURATION_MS,
  BOOST_SPEED_MULTIPLIER,
  CAPTURE_DURATION_MS,
  CAPTURE_RADIUS,
  EMPTY_INPUT,
  EXTRA_BULLET_CHARGES,
  ENDGAME_LAST_MS,
  FFA_FRENZY_AFTER_MS,
  FFA_MATCH_DURATION_MS,
  FFA_TEAM_IDS,
  MATCH_DURATION_MS,
  MAX_BOTS,
  PICKUP_RESPAWN_MS,
  PICKUP_RADIUS,
  PLAYER_BASE_ACCEL,
  PLAYER_DRAG,
  PLAYER_MAX_SPEED,
  PLAYER_RADIUS,
  PLAYER_RESPAWN_MS,
  PROJECTILE_EXPLOSION_FORCE,
  PROJECTILE_SHOOTER_RECOIL,
  PROJECTILE_EXPLOSION_RADIUS,
  PROJECTILE_MAX_RANGE,
  PROJECTILE_RADIUS,
  PROJECTILE_SPEED,
  PUSH_COOLDOWN_MS,
  ROUND_COUNTDOWN_MS,
  ROUND_RESULTS_MS,
  SAFE_ZONE_SIZE,
  SPIKE_COUNT,
  SPIKE_DRIFT_SPEED,
  SPIKE_RADIUS,
  SPIKE_SLOW_DURATION_MS,
  SPIKE_SLOW_MULTIPLIER,
  SPIKE_PERM_SLOW_MULTIPLIER,
  SPEED_POWERUP_DURATION_MS,
  WORLD_EVENT_DURATION_MS,
  WORLD_EVENT_INTERVAL_MS,
  FFA_OCTAGON_CENTER_X,
  FFA_OCTAGON_CENTER_Y,
  FFA_OCTAGON_RADIUS,
  FFA_CORNER_BASE_ZONE_RADIUS,
  clampToOctagon,
  ffaBaseCenters,
  pointInOctagon,
  octagonVertices,
  type GameModeId,
  type Team,
  clamp,
  normalizeVector,
  randomInt,
  randomRange,
  type InputState,
  type PickupKind,
} from "../../shared/src";
import { ArenaState, FlagState, PickupState, PlayerState, ProjectileState, SlowZoneState, SpikeState } from "./state";

const BOT_NAMES = ["Flux", "Nova", "Zip", "Echo", "Drift", "Volt", "Nyx", "Blitz"];
const BOT_IDS = "bot-";
const PICKUP_WEIGHTS: readonly PickupKind[] = [
  "speed",
  "speed",
  "speed",
  "ammo",
  "ammo",
  "ammo",
  "shield",
  "magnet",
  "repel",
];
const SLOW_ZONE_RADIUS = 210;
const SLOW_ZONE_DURATION_MS = 2800;
const MAGNET_RADIUS = 360;
const MAGNET_PULL_PER_SEC = 520;
const REPEL_RADIUS = 240;
const REPEL_FORCE = 420;
const BASE_PERK_DURATION_MS = 3200;
const BASE_PERK_ON_ENTER_MS = 2400;
const CARRIER_TEAMMATE_HELP_RADIUS = 480;
const CARRIER_ALONE_EXTRA_SLOW = 0.82;
const CARRIER_ALONE_AFTER_MS = 2000;
const NEUTRAL_CARRIER_PING_MS = 3500;
const WORLD_EVENTS = ["low_gravity", "surge_ammo", "midfield_sting"] as const;
const SPAWN_EDGE_PADDING = 220;
const SPAWN_PLAYER_CLEARANCE = PLAYER_RADIUS * 2.3;
const FLAG_PICKUP_RADIUS = 72;
const FLAG_CAPTURE_SCORE = 1;
/** Multiplier on accel + max speed while carrying the neutral flag (0.5 = 50% slower). */
const FLAG_CARRIER_SPEED_MULTIPLIER = 0.5;
/** Human flag carriers move 50% faster than bot flag carriers (relative to bot carrier speed). Capped at full speed. */
const HUMAN_FLAG_CARRIER_SPEED_MULTIPLIER = Math.min(1, FLAG_CARRIER_SPEED_MULTIPLIER * 1.5);
const NEUTRAL_FLAG_ID = "flag-neutral";
const HUMAN_FLAG_PICKUP_SPEED_MS = 2000;
const HUMAN_FLAG_PICKUP_SCORE = 10;
const HUMAN_FLAG_STEAL_SPEED_MS = 2400;
const HUMAN_FLAG_STEAL_SCORE = 12;
const HUMAN_FLAG_STEAL_BOOST_MS = 700;
const HUMAN_DIRECT_HIT_EXTRA_SCORE = 6;
const HUMAN_CAPTURE_ROUND_BONUS_SCORE = 18;
const HUMAN_FLAG_SCORE_BONUS = 15;
const TEAM_RED: Team = "red";
const TEAM_BLUE: Team = "blue";
const TEAM_GREEN: Team = "green";
const TEAM_YELLOW: Team = "yellow";
const TEAMS: readonly Team[] = [TEAM_RED, TEAM_BLUE, TEAM_GREEN, TEAM_YELLOW];
const PLAYER_SPEED_MULTIPLIER = 3.8;
/** Human-only: round 1 of the match moves faster so new players can reach the flag quickly. */
const FIRST_ROUND_HUMAN_MOVE_MULTIPLIER = 1.5;
const TARGET_BOT_COUNT_SANDBOX = 3;
const MIDFIELD_RADIUS = 1050;
const MIDFIELD_SPEED_MULTIPLIER = 1.28;
const PLAYER_COLLISION_RADIUS = PLAYER_RADIUS * 1.48;
const BOT_COLLISION_RADIUS = PLAYER_RADIUS * 2.45;
const BOT_PAIR_COLLISION_EXTRA = 1.4;
const BOT_PAIR_PUSH_MULTIPLIER = 1.25;
const PLAYER_COLLISION_PUSH = 0.36;
const RAM_SPEED_THRESHOLD = 260;
const RAM_IMPULSE_SCALE = 0.52;
const RAM_RECOIL_FACTOR = 0.08;
const BOT_COMBAT_STANDOFF_DISTANCE = 420;
const BOT_SPIKE_AVOID_DISTANCE = 230;
const BOT_EDGE_AVOID_PADDING = 280;
const BOT_SUPPORT_RADIUS = 2813;
/** Negative = aim behind the target along their velocity (very bad leading). */
const BOT_PREDICTIVE_AIM_SECONDS = -0.14;
/** Random yaw added to bot shot direction each tick (radians); ~±28° max. */
const BOT_AIM_MAX_ANGLE_ERROR_RAD = 0.5;
const BOT_SPEED_MULTIPLIER = 0.75;
const BASE_AMMO_RECHARGE_MS = 2100;
const TRAILING_AMMO_RECHARGE_MS = 1300;
const MAP_LAYOUT_COUNT = 3;
type BotRole = "attacker" | "defender" | "interceptor";
type SafeZone = { team: Team; minX: number; minY: number; maxX: number; maxY: number };
type FfaCircleZone = { team: string; cx: number; cy: number; r: number };
/** Solo FFA: every player is on a unique team. One base at each of the 8 octagon vertices. */
const OCTAGON_FFA_BASE_SLOTS: readonly { team: string; vertexIndex: number }[] = [
  { team: "ffa0", vertexIndex: 0 },
  { team: "ffa1", vertexIndex: 1 },
  { team: "ffa2", vertexIndex: 2 },
  { team: "ffa3", vertexIndex: 3 },
  { team: "ffa4", vertexIndex: 4 },
  { team: "ffa5", vertexIndex: 5 },
  { team: "ffa6", vertexIndex: 6 },
  { team: "ffa7", vertexIndex: 7 },
];
/** Race mode rectangle layout: all players spawn in a left-side band; the flag sits on the right edge. */
const RACE_SPAWN_BAND_MIN_X = PLAYER_RADIUS;
const RACE_SPAWN_BAND_MAX_X = ARENA_WIDTH * 0.12;
const RACE_FLAG_HOME_X = ARENA_WIDTH * 0.92;
const RACE_FLAG_HOME_Y = ARENA_HEIGHT * 0.5;
const FFA_SCORE_KEYS = [
  "ffa0Score",
  "ffa1Score",
  "ffa2Score",
  "ffa3Score",
  "ffa4Score",
  "ffa5Score",
  "ffa6Score",
  "ffa7Score",
] as const;
const PICKUP_DASH_KEYS = [
  "pickupDash0",
  "pickupDash1",
  "pickupDash2",
  "pickupDash3",
  "pickupDash4",
  "pickupDash5",
  "pickupDash6",
  "pickupDash7",
] as const;
const MUTATOR_POOL = ["megaboom", "hasty_caps", "dense_loot"] as const;
const PLAYABLE_MIN_X = PLAYER_RADIUS;
const PLAYABLE_MIN_Y = PLAYER_RADIUS;
const PLAYABLE_MAX_X = ARENA_WIDTH - PLAYER_RADIUS;
const PLAYABLE_MAX_Y = ARENA_HEIGHT - PLAYER_RADIUS;
const SAFE_ZONES: readonly SafeZone[] = [
  { team: TEAM_RED, minX: PLAYABLE_MIN_X, minY: PLAYABLE_MIN_Y, maxX: PLAYABLE_MIN_X + SAFE_ZONE_SIZE, maxY: PLAYABLE_MIN_Y + SAFE_ZONE_SIZE },
  { team: TEAM_BLUE, minX: PLAYABLE_MAX_X - SAFE_ZONE_SIZE, minY: PLAYABLE_MIN_Y, maxX: PLAYABLE_MAX_X, maxY: PLAYABLE_MIN_Y + SAFE_ZONE_SIZE },
  { team: TEAM_GREEN, minX: PLAYABLE_MIN_X, minY: PLAYABLE_MAX_Y - SAFE_ZONE_SIZE, maxX: PLAYABLE_MIN_X + SAFE_ZONE_SIZE, maxY: PLAYABLE_MAX_Y },
  { team: TEAM_YELLOW, minX: PLAYABLE_MAX_X - SAFE_ZONE_SIZE, minY: PLAYABLE_MAX_Y - SAFE_ZONE_SIZE, maxX: PLAYABLE_MAX_X, maxY: PLAYABLE_MAX_Y },
];

export class GameSimulation {
  readonly inputs = new Map<string, InputState>();
  private elapsedMs = 0;
  private serial = 0;
  private roundRestartAtMs: number | null = null;
  private nextTeam: Team = TEAM_RED;
  private botEdgeSpawnPoints: Array<{ x: number; y: number }> = [];
  private botEdgeSpawnCursor = 0;
  private mapLayoutIndex = 0;
  private readonly ammoRechargeAtMs = new Map<string, number>();
  private readonly captureAssistIds = new Set<string>();
  private readonly wasInOwnSafeZone = new Map<string, boolean>();
  private nextWorldEventAtElapsedMs = WORLD_EVENT_INTERVAL_MS;
  private worldEventCursor = 0;
  /** {@link GameSimulation.update} sets this when the round leaves countdown (FFA frenzy is relative to live time). */
  private roundLiveStartedAtElapsedMs = 0;

  constructor(private readonly state: ArenaState) {
    state.elapsedMs = 0;
    state.matchDurationMs = this.getMatchDurationMs();
    state.phase = "live";
    state.redScore = 0;
    state.blueScore = 0;
    state.greenScore = 0;
    state.yellowScore = 0;
    state.roundNumber = 1;
    state.countdownMs = ROUND_COUNTDOWN_MS;
    state.captureX = ARENA_WIDTH * 0.5;
    state.captureY = ARENA_HEIGHT * 0.5;
    state.captureAnchorX = state.captureX;
    state.captureAnchorY = state.captureY;
    state.captureRadius = CAPTURE_RADIUS;
    state.captureTeam = "";
    state.captureProgress = 0;
    state.mapTheme = 0;
    state.worldEvent = "";
    state.worldEventEndsAtElapsedMs = 0;
    state.captureVariant = 0;
    state.neutralCarrierPing = false;
    state.phase = "countdown";
    state.projectiles.clear();
    state.slowZones.clear();
    this.resetBotEdgeSpawnPoints();
    this.initializePickups();
    this.initializeSpikes();
    this.initializeNeutralFlag();
    state.gameMode = "sandbox";
    state.mutatorA = "";
    state.mutatorB = "";
    this.resetFfaScores();
    this.resetPickupDash();
  }

  /** Solo FFA — the octagon layout, 8 unique teams (`ffa0..ffa7`) chasing one neutral flag. */
  private isFfa(): boolean {
    return this.state.gameMode === "ffa";
  }

  private isTeamCtf(): boolean {
    return this.state.gameMode === "team_ctf";
  }

  private isRace(): boolean {
    return this.state.gameMode === "race";
  }

  /** True when the active mode treats every player as their own team (solo FFA + race). */
  private isSoloMode(): boolean {
    return this.isFfa() || this.isRace();
  }

  /** Team ids that `pickBalancedTeam` is allowed to assign in the active mode. */
  private getActiveTeams(): readonly string[] {
    if (this.isFfa() || this.isRace()) return FFA_TEAM_IDS;
    if (this.isTeamCtf()) return [TEAM_RED, TEAM_BLUE];
    return TEAMS;
  }

  private getMatchDurationMs(): number {
    return this.isFfa() ? FFA_MATCH_DURATION_MS : MATCH_DURATION_MS;
  }

  /** FFA: first {@link FFA_FRENZY_AFTER_MS} of live play are normal; then faster movement and spammable shots. */
  private isFfaFrenzy(): boolean {
    return (
      this.isFfa() &&
      this.state.phase === "live" &&
      this.elapsedMs - this.roundLiveStartedAtElapsedMs >= FFA_FRENZY_AFTER_MS
    );
  }

  /** FFA: same four teams as sandbox, small bases at alternating octagon vertices. */
  private getFfaCircles(): FfaCircleZone[] {
    const bases = ffaBaseCenters(FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, FFA_OCTAGON_RADIUS, 0.11);
    return OCTAGON_FFA_BASE_SLOTS.map(({ team, vertexIndex }) => {
      const p = bases[vertexIndex]!;
      return { team, cx: p.x, cy: p.y, r: FFA_CORNER_BASE_ZONE_RADIUS };
    });
  }

  private resetFfaScores(): void {
    const row = this.state as unknown as Record<string, number>;
    for (const k of FFA_SCORE_KEYS) row[k] = 0;
  }

  private resetPickupDash(): void {
    const row = this.state as unknown as Record<string, number>;
    for (const k of PICKUP_DASH_KEYS) row[k] = 0;
  }

  private rollMutators(): void {
    const pool = [...MUTATOR_POOL];
    const a = pool.splice(randomInt(pool.length), 1)[0] ?? "";
    const b = pool.length ? (pool.splice(randomInt(pool.length), 1)[0] ?? "") : "";
    this.state.mutatorA = a;
    this.state.mutatorB = b;
  }

  private hasMutator(tag: string): boolean {
    return this.state.mutatorA === tag || this.state.mutatorB === tag;
  }

  private clampEntityToArena(x: number, y: number, clearance: number): { x: number; y: number } {
    if (this.isFfa()) {
      return clampToOctagon(x, y, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, FFA_OCTAGON_RADIUS - clearance);
    }
    return { x: clamp(x, clearance, ARENA_WIDTH - clearance), y: clamp(y, clearance, ARENA_HEIGHT - clearance) };
  }

  private pickRandomPointInArena(): { x: number; y: number } {
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const x = randomRange(120, ARENA_WIDTH - 120);
      const y = randomRange(120, ARENA_HEIGHT - 120);
      if (this.isFfa()) {
        if (pointInOctagon(x, y, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, FFA_OCTAGON_RADIUS - 220)) {
          return { x, y };
        }
      } else {
        return { x, y };
      }
    }
    return { x: ARENA_WIDTH * 0.5, y: ARENA_HEIGHT * 0.5 };
  }

  restartMatch(): void {
    this.elapsedMs = 0;
    this.state.elapsedMs = 0;
    this.state.matchDurationMs = this.getMatchDurationMs();
    this.state.redScore = 0;
    this.state.blueScore = 0;
    this.state.greenScore = 0;
    this.state.yellowScore = 0;
    this.resetFfaScores();
    this.resetPickupDash();
    this.state.mutatorA = "";
    this.state.mutatorB = "";
    this.state.roundNumber = 0;
    this.nextWorldEventAtElapsedMs = WORLD_EVENT_INTERVAL_MS;
    this.state.worldEvent = "";
    this.state.worldEventEndsAtElapsedMs = 0;
    this.worldEventCursor = 0;
    this.startNextRound(true);
    for (const player of this.state.players.values()) {
      player.wins = 0;
    }
  }

  addPlayer(id: string, name: string, isBot = false): void {
    const player = new PlayerState();
    player.id = id;
    player.name = name || (isBot ? (BOT_NAMES[randomInt(BOT_NAMES.length)] ?? "Runner") : "Runner");
    player.isBot = isBot;
    player.team = this.pickBalancedTeam();
    player.alive = true;
    const spawn = isBot
      ? this.pickUniqueBotEdgeSpawnPoint()
      : this.isSoloMode() || this.isTeamCtf()
        ? this.pickTeamBaseSpawnPoint(player)
        : this.pickSpawnPoint(undefined, false);
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.rotation = randomRange(-Math.PI, Math.PI);
    player.hp = 100;
    player.boostMs = 0;
    player.speedBoostMs = 0;
    player.stunnedMs = 0;
    player.pushCooldownMs = 0;
    player.bulletCharges = 1;
    player.respawnMs = 0;
    player.vehicleClass = "interceptor";
    player.score = 0;
    player.streak = 0;
    player.zoneTicks = 0;
    player.color = this.pickColor();
    player.basePerkMs = 0;
    player.shieldHits = 0;
    player.magnetMs = 0;
    player.repelMs = 0;
    player.challengeCaps = 0;
    player.challengeSteals = 0;
    player.challengeTier = 0;
    player.wins = 0;
    player.spikeSlowMs = 0;
    player.spikePermSlow = false;
    player.boostCharges = BOOST_CHARGES_PER_LIFE;
    player.boostCooldownMs = 0;
    this.state.players.set(id, player);
  }

  removePlayer(id: string): void {
    this.state.players.delete(id);
    this.inputs.delete(id);
    this.ammoRechargeAtMs.delete(id);
    this.wasInOwnSafeZone.delete(id);
  }

  setInput(id: string, input: InputState): void {
    const moveX = clamp(input?.moveX ?? 0, -1, 1);
    const moveY = clamp(input?.moveY ?? 0, -1, 1);
    const aim = normalizeVector(input?.aimX ?? 1, input?.aimY ?? 0);
    this.inputs.set(id, {
      moveX,
      moveY,
      aimX: aim.x,
      aimY: aim.y,
      boost: Boolean(input?.boost),
      fire: Boolean(input?.fire),
    });
  }

  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    if (this.roundRestartAtMs !== null) {
      this.state.elapsedMs = this.getMatchDurationMs();
      if (this.elapsedMs >= this.roundRestartAtMs) {
        this.restartRound();
      }
      return;
    }

    const matchDurationMs = this.getMatchDurationMs();
    if (this.elapsedMs >= matchDurationMs) {
      this.endRoundFromTimeout();
      this.state.elapsedMs = matchDurationMs;
      return;
    }
    this.state.elapsedMs = this.elapsedMs;
    this.ensureBots();
    if (this.state.phase === "countdown") {
      this.state.countdownMs = Math.max(0, this.state.countdownMs - deltaMs);
      if (this.state.countdownMs > 0) {
        return;
      }
      this.state.phase = "live";
      this.roundLiveStartedAtElapsedMs = this.elapsedMs;
    }
    this.state.phase = "live";
    this.tickWorldEvents();
    this.updateDynamicCapturePoint();
    this.updatePlayers(deltaMs);
    this.updateSpikes(deltaMs);
    this.resolvePlayerCollisions();
    this.updateNeutralFlag(deltaMs);
    this.updateProjectiles(deltaMs);
    this.updatePickups(deltaMs);
    this.updateSlowZones(deltaMs);
    this.updateCaptureCircle(deltaMs);
    this.applyRepelFields(deltaMs);
    this.updateMagnetPickups(deltaMs);
  }

  private tickWorldEvents(): void {
    if (this.state.worldEvent && this.elapsedMs >= this.state.worldEventEndsAtElapsedMs) {
      this.state.worldEvent = "";
      this.state.worldEventEndsAtElapsedMs = 0;
    }
    if (this.elapsedMs >= this.nextWorldEventAtElapsedMs && !this.state.worldEvent) {
      const tag = WORLD_EVENTS[this.worldEventCursor % WORLD_EVENTS.length] ?? "low_gravity";
      this.worldEventCursor += 1;
      this.state.worldEvent = tag;
      this.state.worldEventEndsAtElapsedMs = this.elapsedMs + WORLD_EVENT_DURATION_MS;
      this.nextWorldEventAtElapsedMs = this.elapsedMs + WORLD_EVENT_INTERVAL_MS;
    }
  }

  private updateDynamicCapturePoint(): void {
    const anchorX = this.state.captureAnchorX;
    const anchorY = this.state.captureAnchorY;
    let radius = CAPTURE_RADIUS;
    const matchDur = this.getMatchDurationMs();
    const t = clamp(this.elapsedMs / matchDur, 0, 1);
    if (this.state.captureVariant === 1) {
      radius = CAPTURE_RADIUS * (1.22 - 0.52 * t);
    }
    if (this.state.captureVariant === 2) {
      this.state.captureX = anchorX + Math.sin(this.elapsedMs * 0.0011) * 340;
      this.state.captureY = anchorY + Math.cos(this.elapsedMs * 0.00095) * 240;
    } else {
      this.state.captureX = anchorX;
      this.state.captureY = anchorY;
    }
    if (matchDur - this.elapsedMs <= ENDGAME_LAST_MS) {
      radius *= 1.34;
    }
    this.state.captureRadius = Math.max(CAPTURE_RADIUS * 0.55, radius);

    if (this.isFfa()) {
      const margin = this.state.captureRadius + 90;
      const rIn = Math.max(120, FFA_OCTAGON_RADIUS - margin);
      if (!pointInOctagon(this.state.captureX, this.state.captureY, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, rIn)) {
        const c = clampToOctagon(this.state.captureX, this.state.captureY, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, rIn);
        this.state.captureX = c.x;
        this.state.captureY = c.y;
        this.state.captureAnchorX = c.x;
        this.state.captureAnchorY = c.y;
      }
    }
  }

  private updateSlowZones(deltaMs: number): void {
    for (const [id, zone] of this.state.slowZones.entries()) {
      if (this.elapsedMs >= zone.expiresAtElapsedMs) {
        this.state.slowZones.delete(id);
      }
    }
    for (const player of this.state.players.values()) {
      if (!player.alive || player.stunnedMs > 0) continue;
      if (!this.isInAnySlowZone(player.x, player.y)) continue;
      const damp = Math.pow(0.88, deltaMs / 16);
      player.vx *= damp;
      player.vy *= damp;
    }
  }

  private isInAnySlowZone(x: number, y: number): boolean {
    for (const zone of this.state.slowZones.values()) {
      if (Math.hypot(x - zone.x, y - zone.y) <= zone.radius) return true;
    }
    return false;
  }

  private spawnSlowZoneAt(x: number, y: number): void {
    const zone = new SlowZoneState();
    zone.id = this.id("slow");
    zone.x = x;
    zone.y = y;
    zone.radius = SLOW_ZONE_RADIUS;
    zone.expiresAtElapsedMs = this.elapsedMs + SLOW_ZONE_DURATION_MS;
    this.state.slowZones.set(zone.id, zone);
  }

  private applyRepelFields(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const source of this.state.players.values()) {
      if (!source.alive || source.repelMs <= 0 || source.stunnedMs > 0) continue;
      for (const target of this.state.players.values()) {
        if (!target.alive || target.id === source.id || target.team === source.team) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.hypot(dx, dy);
        if (dist > REPEL_RADIUS || dist < 1) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        target.vx += nx * REPEL_FORCE * dt;
        target.vy += ny * REPEL_FORCE * dt;
      }
    }
  }

  private updateMagnetPickups(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const player of this.state.players.values()) {
      if (!player.alive || player.magnetMs <= 0) continue;
      for (const pickup of this.state.pickups.values()) {
        if (!pickup.active) continue;
        const dx = player.x - pickup.x;
        const dy = player.y - pickup.y;
        const dist = Math.hypot(dx, dy);
        if (dist > MAGNET_RADIUS || dist < 1) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const step = MAGNET_PULL_PER_SEC * dt;
        const pulled = this.clampEntityToArena(pickup.x + nx * step, pickup.y + ny * step, 90);
        pickup.x = pulled.x;
        pickup.y = pulled.y;
      }
    }
  }

  private updatePlayers(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const lowGravity = this.state.worldEvent === "low_gravity";
    const effectiveDrag = lowGravity ? PLAYER_DRAG - 0.0011 : PLAYER_DRAG;
    const gravitySpeedBonus = lowGravity ? 1.14 : 1;

    for (const player of this.state.players.values()) {
      if (!player.alive) {
        player.respawnMs = Math.max(0, player.respawnMs - deltaMs);
        if (player.respawnMs <= 0) this.respawnPlayer(player);
        continue;
      }

      const input = player.isBot ? this.createBotInput(player) : this.inputs.get(player.id) ?? EMPTY_INPUT;
      const wasBoosting = player.boostMs > 0;
      player.boostMs = Math.max(0, player.boostMs - deltaMs);
      // Releasing Space mid-boost ends the boost immediately and starts the cooldown.
      if (wasBoosting && !input.boost && player.boostMs > 0) {
        player.boostMs = 0;
      }
      if (wasBoosting && player.boostMs <= 0) {
        player.boostCooldownMs = BOOST_COOLDOWN_MS;
      }
      player.boostCooldownMs = Math.max(0, player.boostCooldownMs - deltaMs);
      player.speedBoostMs = Math.max(0, player.speedBoostMs - deltaMs);
      player.stunnedMs = Math.max(0, player.stunnedMs - deltaMs);
      player.spikeSlowMs = Math.max(0, player.spikeSlowMs - deltaMs);
      player.pushCooldownMs = Math.max(0, player.pushCooldownMs - deltaMs);
      player.basePerkMs = Math.max(0, player.basePerkMs - deltaMs);
      player.magnetMs = Math.max(0, player.magnetMs - deltaMs);
      player.repelMs = Math.max(0, player.repelMs - deltaMs);
      if (player.stunnedMs > 0) {
        player.vx = 0;
        player.vy = 0;
        continue;
      }
      const movement = normalizeVector(clamp(input.moveX, -1, 1), clamp(input.moveY, -1, 1));
      const moving = Math.hypot(input.moveX, input.moveY) > 0.02;
      const midfieldBoost = this.isInsideMidfield(player.x, player.y) ? MIDFIELD_SPEED_MULTIPLIER : 1;
      const powerupBoost = player.speedBoostMs > 0 ? 1.55 : 1;
      const firstRoundHumanBoost =
        !player.isBot && this.state.roundNumber === 1 && this.state.phase === "live"
          ? FIRST_ROUND_HUMAN_MOVE_MULTIPLIER
          : 1;
      const spikeSlowFactor = player.spikeSlowMs > 0 ? SPIKE_SLOW_MULTIPLIER : 1;
      const spikePermFactor = player.spikePermSlow ? SPIKE_PERM_SLOW_MULTIPLIER : 1;
      const speedFactor =
        PLAYER_SPEED_MULTIPLIER *
        midfieldBoost *
        powerupBoost *
        (player.boostMs > 0 ? BOOST_SPEED_MULTIPLIER : 1) *
        spikeSlowFactor *
        spikePermFactor *
        gravitySpeedBonus *
        firstRoundHumanBoost;
      const carriesNeutralFlag = this.getNeutralFlag()?.carrierId === player.id;
      const neutralFlag = this.getNeutralFlag();
      let flagCarrierSlow = 1;
      if (carriesNeutralFlag) {
        flagCarrierSlow = player.isBot ? FLAG_CARRIER_SPEED_MULTIPLIER : HUMAN_FLAG_CARRIER_SPEED_MULTIPLIER;
      }
      if (carriesNeutralFlag && neutralFlag && neutralFlag.carryAgeMs >= CARRIER_ALONE_AFTER_MS) {
        const helped = this.hasTeammateWithin(player, CARRIER_TEAMMATE_HELP_RADIUS);
        if (!helped) flagCarrierSlow *= CARRIER_ALONE_EXTRA_SLOW;
      }
      const basePerkBoost = player.basePerkMs > 0 ? 1.16 : 1;
      const frenzyMove = this.isFfaFrenzy() ? 2 : 1;
      const tunedSpeedFactor =
        (player.isBot ? speedFactor * BOT_SPEED_MULTIPLIER : speedFactor) * flagCarrierSlow * basePerkBoost;
      const accel = PLAYER_BASE_ACCEL * tunedSpeedFactor * (player.basePerkMs > 0 ? 1.12 : 1) * frenzyMove;
      if (moving) {
        player.vx += movement.x * accel * dt;
        player.vy += movement.y * accel * dt;
        player.rotation = Math.atan2(movement.y, movement.x);
      }
      player.vx *= effectiveDrag;
      player.vy *= effectiveDrag;

      const slowMul = this.isInAnySlowZone(player.x, player.y) ? 0.62 : 1;
      const speed = Math.hypot(player.vx, player.vy);
      const maxSpeed = PLAYER_MAX_SPEED * tunedSpeedFactor * slowMul * frenzyMove;
      if (speed > maxSpeed) {
        const normalized = normalizeVector(player.vx, player.vy);
        player.vx = normalized.x * maxSpeed;
        player.vy = normalized.y * maxSpeed;
      }

      if (this.state.worldEvent === "midfield_sting" && this.isInsideMidfield(player.x, player.y)) {
        player.hp -= deltaMs * 0.009;
        if (player.hp <= 0) {
          this.knockOutPlayer(player);
          continue;
        }
      }

      if (
        input.boost &&
        player.boostMs <= 0 &&
        player.boostCooldownMs <= 0 &&
        player.boostCharges > 0
      ) {
        player.boostMs = BOOST_DURATION_MS;
        player.boostCharges = Math.max(0, player.boostCharges - 1);
      }
      const shotSpacingMs = this.isFfaFrenzy() ? 0 : PUSH_COOLDOWN_MS;
      if (input.fire && player.pushCooldownMs <= 0 && this.canFireProjectile(player)) {
        this.spawnProjectile(player, input);
        player.pushCooldownMs = shotSpacingMs;
        player.bulletCharges = Math.max(0, player.bulletCharges - 1);
      }
      this.tryRechargeAmmo(player);

      const previousX = player.x;
      const previousY = player.y;
      const nextX = player.x + player.vx * dt;
      const nextY = player.y + player.vy * dt;
      let touchedArenaBoundary = false;
      if (this.isFfa()) {
        const rIn = FFA_OCTAGON_RADIUS - PLAYER_RADIUS;
        const prevIn = pointInOctagon(previousX, previousY, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, rIn);
        const nextIn = pointInOctagon(nextX, nextY, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, rIn);
        const c = clampToOctagon(nextX, nextY, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, rIn);
        player.x = c.x;
        player.y = c.y;
        touchedArenaBoundary = prevIn && !nextIn;
      } else {
        touchedArenaBoundary =
          nextX <= PLAYER_RADIUS || nextX >= ARENA_WIDTH - PLAYER_RADIUS || nextY <= PLAYER_RADIUS || nextY >= ARENA_HEIGHT - PLAYER_RADIUS;
        player.x = clamp(nextX, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
        player.y = clamp(nextY, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
      }
      if (touchedArenaBoundary) {
        this.eliminateToTeamBase(player);
        continue;
      }
      this.applyEnemySafeZoneBlocking(player);
      this.tryHitSpike(player);
      this.tryCollectPickup(player, previousX, previousY);
      if (this.isTeamCtf()) {
        this.tryPickupOrReturnFlags(player);
        this.tryCaptureFlag(player);
      } else {
        this.tryPickupNeutralFlag(player, previousX, previousY);
        if (this.isRace()) {
          this.tryScoreRaceFlag(player);
        } else {
          this.tryScoreNeutralFlag(player);
        }
      }
      this.refreshBasePerkOnHomeEnter(player);
    }
  }

  private hasTeammateWithin(player: PlayerState, radius: number): boolean {
    for (const other of this.state.players.values()) {
      if (!other.alive || other.id === player.id || other.team !== player.team) continue;
      if (Math.hypot(other.x - player.x, other.y - player.y) <= radius) return true;
    }
    return false;
  }

  private refreshBasePerkOnHomeEnter(player: PlayerState): void {
    const inside = this.isInsideTeamSafeZone(player, player.team);
    const was = this.wasInOwnSafeZone.get(player.id) ?? false;
    if (inside && !was) {
      player.basePerkMs = Math.max(player.basePerkMs, BASE_PERK_ON_ENTER_MS);
    }
    this.wasInOwnSafeZone.set(player.id, inside);
  }

  private updateProjectiles(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const [id, projectile] of this.state.projectiles.entries()) {
      const previousX = projectile.x;
      const previousY = projectile.y;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.traveled += Math.hypot(projectile.x - previousX, projectile.y - previousY);

      const hitSpikeId = this.findProjectileSpikeHitId(projectile, previousX, previousY);
      const hitPlayer = this.findProjectileHit(projectile, previousX, previousY);
      const outOfBounds = this.isFfa()
        ? !pointInOctagon(
            projectile.x,
            projectile.y,
            FFA_OCTAGON_CENTER_X,
            FFA_OCTAGON_CENTER_Y,
            FFA_OCTAGON_RADIUS - projectile.radius * 0.5 - 8,
          )
        : projectile.x < PLAYER_RADIUS ||
            projectile.x > ARENA_WIDTH - PLAYER_RADIUS ||
            projectile.y < PLAYER_RADIUS ||
            projectile.y > ARENA_HEIGHT - PLAYER_RADIUS;

      if (hitSpikeId) {
        const deadSpike = this.state.spikes.get(hitSpikeId);
        if (deadSpike) {
          this.spawnSlowZoneAt(deadSpike.x, deadSpike.y);
        }
        this.state.spikes.delete(hitSpikeId);
        this.state.projectiles.delete(id);
        this.restoreBulletCharge(projectile.ownerId);
        continue;
      }

      if (hitPlayer || outOfBounds) {
        this.explodeProjectile(projectile, hitPlayer?.id);
        this.state.projectiles.delete(id);
        this.restoreBulletCharge(projectile.ownerId);
      }
    }
  }

  private resolvePlayerCollisions(): void {
    const alivePlayers = [...this.state.players.values()].filter((player) => player.alive);
    for (let i = 0; i < alivePlayers.length; i += 1) {
      const a = alivePlayers[i];
      if (!a) continue;
      for (let j = i + 1; j < alivePlayers.length; j += 1) {
        const b = alivePlayers[j];
        if (!b) continue;
        const radiusA = a.isBot ? BOT_COLLISION_RADIUS : PLAYER_COLLISION_RADIUS;
        const radiusB = b.isBot ? BOT_COLLISION_RADIUS : PLAYER_COLLISION_RADIUS;
        const botPairFactor = a.isBot && b.isBot ? BOT_PAIR_COLLISION_EXTRA : 1;
        const minDistance = (radiusA + radiusB) * botPairFactor;
        const minDistanceSq = minDistance * minDistance;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= 0 || distSq >= minDistanceSq) continue;

        const dist = Math.sqrt(distSq);
        const overlap = minDistance - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const pushMultiplier = a.isBot && b.isBot ? BOT_PAIR_PUSH_MULTIPLIER : 1;
        const push = overlap * PLAYER_COLLISION_PUSH * pushMultiplier;
        const speedA = Math.hypot(a.vx, a.vy);
        const speedB = Math.hypot(b.vx, b.vy);
        const mobilityA = clamp(speedA / PLAYER_MAX_SPEED, 0, 1);
        const mobilityB = clamp(speedB / PLAYER_MAX_SPEED, 0, 1);
        // Heavy-at-rest behavior: slow targets resist movement, moving targets displace others more.
        const pushToA = push * (0.16 + 0.84 * mobilityB);
        const pushToB = push * (0.16 + 0.84 * mobilityA);

        const pa = this.clampEntityToArena(a.x - nx * pushToA, a.y - ny * pushToA, PLAYER_RADIUS);
        const pb = this.clampEntityToArena(b.x + nx * pushToB, b.y + ny * pushToB, PLAYER_RADIUS);
        a.x = pa.x;
        a.y = pa.y;
        b.x = pb.x;
        b.y = pb.y;

        // One-way momentum transfer: attacker barely recoils, target flies back.
        const relAlongNormal = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (relAlongNormal > 0) {
          const impulse = Math.max(10, (Math.max(0, speedA - RAM_SPEED_THRESHOLD) * RAM_IMPULSE_SCALE) + relAlongNormal * 0.42);
          b.vx += nx * impulse;
          b.vy += ny * impulse;
          a.vx -= nx * impulse * RAM_RECOIL_FACTOR;
          a.vy -= ny * impulse * RAM_RECOIL_FACTOR;
        } else if (relAlongNormal < 0) {
          const impulse = Math.max(10, (Math.max(0, speedB - RAM_SPEED_THRESHOLD) * RAM_IMPULSE_SCALE) + Math.abs(relAlongNormal) * 0.42);
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse * RAM_RECOIL_FACTOR;
          b.vy += ny * impulse * RAM_RECOIL_FACTOR;
        }
      }
    }
  }

  private updateCaptureCircle(deltaMs: number): void {
    const teamsInside = new Map<string, number>();
    for (const player of this.state.players.values()) {
      if (!player.alive) continue;
      if (Math.hypot(player.x - this.state.captureX, player.y - this.state.captureY) <= this.state.captureRadius) {
        teamsInside.set(player.team, (teamsInside.get(player.team) ?? 0) + 1);
      }
    }

    if (teamsInside.size === 0) {
      this.state.captureTeam = "";
      this.captureAssistIds.clear();
      this.state.captureProgress = Math.max(0, this.state.captureProgress - deltaMs / (CAPTURE_DURATION_MS * 1.7));
      return;
    }

    let leadingTeam = "";
    let leadingCount = -1;
    let secondCount = -1;
    for (const [team, count] of teamsInside.entries()) {
      if (count > leadingCount) {
        secondCount = leadingCount;
        leadingCount = count;
        leadingTeam = team;
      } else if (count > secondCount) {
        secondCount = count;
      }
    }

    if (leadingCount <= 0 || leadingCount === secondCount) {
      this.captureAssistIds.clear();
      this.state.captureProgress = Math.max(0, this.state.captureProgress - deltaMs / (CAPTURE_DURATION_MS * 2.5));
      return;
    }

    if (this.state.captureTeam !== leadingTeam) {
      this.captureAssistIds.clear();
      this.state.captureTeam = leadingTeam;
      this.state.captureProgress = Math.max(0, this.state.captureProgress - deltaMs * 0.08);
    }
    for (const player of this.state.players.values()) {
      if (!player.alive || player.team !== leadingTeam) continue;
      if (Math.hypot(player.x - this.state.captureX, player.y - this.state.captureY) <= this.state.captureRadius) {
        this.captureAssistIds.add(player.id);
      }
    }
    const majorityBonus = 1 + (leadingCount - Math.max(0, secondCount)) * 0.5;
    const capSpeed = this.hasMutator("hasty_caps") ? 1.35 : 1;
    this.state.captureProgress = clamp(
      this.state.captureProgress + (deltaMs / CAPTURE_DURATION_MS) * majorityBonus * capSpeed,
      0,
      1,
    );
    if (this.state.captureProgress >= 1) {
      this.awardRound(leadingTeam);
    }
  }

  private awardRound(team: string): void {
    const combo = this.captureAssistIds.size >= 2;
    const bonus = combo ? 1 : 0;
    if (team === TEAM_RED) this.state.redScore += 1 + bonus;
    if (team === TEAM_BLUE) this.state.blueScore += 1 + bonus;
    if (team === TEAM_GREEN) this.state.greenScore += 1 + bonus;
    if (team === TEAM_YELLOW) this.state.yellowScore += 1 + bonus;
    for (const id of this.captureAssistIds) {
      const participant = this.state.players.get(id);
      if (!participant?.alive || participant.team !== team) continue;
      participant.wins += 1;
      if (!participant.isBot) {
        participant.score += HUMAN_CAPTURE_ROUND_BONUS_SCORE;
      }
    }
    this.captureAssistIds.clear();
    this.startNextRound();
  }

  private updatePickups(_deltaMs: number): void {
    for (const pickup of this.state.pickups.values()) {
      if (pickup.active || this.elapsedMs < pickup.respawnAtMs) continue;
      pickup.active = true;
      pickup.kind = PICKUP_WEIGHTS[randomInt(PICKUP_WEIGHTS.length)] ?? "speed";
      const p = this.pickRandomPointInArena();
      pickup.x = p.x;
      pickup.y = p.y;
    }
  }

  private updateFlags(): void {
    for (const flag of this.state.flags.values()) {
      if (!flag.carrierId) continue;
      const carrier = this.state.players.get(flag.carrierId);
      if (!carrier || !carrier.alive) {
        flag.carrierId = "";
        flag.atBase = false;
        continue;
      }
      flag.x = carrier.x;
      flag.y = carrier.y;
    }
  }

  private updateNeutralFlag(deltaMs: number): void {
    const flag = this.getNeutralFlag();
    if (!flag) return;
    if (!flag.carrierId) {
      flag.carryAgeMs = 0;
      this.state.neutralCarrierPing = false;
      if (flag.atBase) {
        if (this.isRace()) {
          flag.homeX = RACE_FLAG_HOME_X;
          flag.homeY = RACE_FLAG_HOME_Y;
        } else {
          flag.homeX = this.state.captureX;
          flag.homeY = this.state.captureY;
        }
        flag.x = flag.homeX;
        flag.y = flag.homeY;
      }
      return;
    }
    const carrier = this.state.players.get(flag.carrierId);
    if (!carrier || !carrier.alive) {
      this.resetNeutralFlag();
      return;
    }
    flag.carryAgeMs += deltaMs;
    flag.x = carrier.x;
    flag.y = carrier.y;
    this.state.neutralCarrierPing = flag.carryAgeMs >= NEUTRAL_CARRIER_PING_MS;
  }

  private ensureBots(): void {
    const humanCount = [...this.state.players.values()].filter((p) => !p.isBot).length;
    if (humanCount === 0) {
      for (const id of [...this.state.players.keys()].filter((id) => id.startsWith(BOT_IDS))) {
        this.removePlayer(id);
      }
      return;
    }
    const target = this.getTargetBotCount(humanCount);
    const wantedBots = clamp(target, 0, MAX_BOTS);
    const botIds = [...this.state.players.keys()].filter((id) => id.startsWith(BOT_IDS));

    while (botIds.length < wantedBots) {
      const botId = `${BOT_IDS}${this.id("runner")}`;
      botIds.push(botId);
      this.addPlayer(botId, "", true);
    }
    while (botIds.length > wantedBots) {
      const botId = botIds.pop();
      if (botId) this.removePlayer(botId);
    }
  }

  /** Bot backfill target. Solo FFA/race fill to 8 total. Team CTF fills to 8 total (4 vs 4). Sandbox keeps the legacy target. */
  private getTargetBotCount(humanCount: number): number {
    if (this.isFfa() || this.isRace() || this.isTeamCtf()) {
      return Math.max(0, MAX_BOTS - humanCount);
    }
    return TARGET_BOT_COUNT_SANDBOX;
  }

  private jitterBotAim(dx: number, dy: number): { x: number; y: number } {
    const base = normalizeVector(dx, dy);
    const yaw = randomRange(-BOT_AIM_MAX_ANGLE_ERROR_RAD, BOT_AIM_MAX_ANGLE_ERROR_RAD);
    const angle = Math.atan2(base.y, base.x) + yaw;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const perp = randomRange(-0.22, 0.22);
    return normalizeVector(c - s * perp, s + c * perp);
  }

  private createBotInput(player: PlayerState): InputState {
    const enemy = this.findNearestEnemy(player, PROJECTILE_MAX_RANGE * 1.45);
    const threateningEnemy = this.findMostThreateningEnemy(player);
    const needsAmmo = player.bulletCharges <= 0;
    const pickupTarget = needsAmmo ? this.findNearestActivePickup(player.x, player.y, "ammo") : this.findNearestActivePickup(player.x, player.y);
    const neutralFlag = this.getNeutralFlag();
    const carryingNeutralFlag = neutralFlag?.carrierId === player.id;
    const teammateCarrier = this.findNearestTeammateNeutralFlagCarrier(player, BOT_SUPPORT_RADIUS);
    const teamHomeTarget = this.getTeamSafeZoneCenter(player.team);
    const neutralFlagTarget = neutralFlag && !neutralFlag.carrierId ? { x: neutralFlag.x, y: neutralFlag.y } : undefined;
    const enemyCarrierTarget = this.findEnemyFlagCarrierForTeam(player.team);

    const target = carryingNeutralFlag
      ? teamHomeTarget
      : teammateCarrier ??
        enemyCarrierTarget ??
        neutralFlagTarget ??
        threateningEnemy ??
        enemy ??
        pickupTarget ??
        { x: this.state.captureX, y: this.state.captureY };
    const toTargetX = target.x - player.x;
    const toTargetY = target.y - player.y;
    const chase = normalizeVector(toTargetX, toTargetY);

    // Keep a bit of lateral movement in combat so bots are harder to line up.
    const strafeSide = (this.elapsedMs + player.id.length * 97) % 2600 < 1300 ? 1 : -1;
    const strafe = { x: -chase.y * strafeSide, y: chase.x * strafeSide };
    let direction = enemy ? normalizeVector(chase.x * 0.8 + strafe.x * 0.2, chase.y * 0.8 + strafe.y * 0.2) : chase;

    if (enemy) {
      const enemyDistance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (enemyDistance < BOT_COMBAT_STANDOFF_DISTANCE && !carryingNeutralFlag) {
        const retreat = normalizeVector(player.x - enemy.x, player.y - enemy.y);
        direction = normalizeVector(retreat.x * 0.68 + strafe.x * 0.32, retreat.y * 0.68 + strafe.y * 0.32);
      }
    }

    // Avoid drifting into hazards and arena edges.
    const spike = this.findNearestSpike(player.x, player.y, BOT_SPIKE_AVOID_DISTANCE);
    if (spike) {
      const fleeSpike = normalizeVector(player.x - spike.x, player.y - spike.y);
      direction = normalizeVector(direction.x * 0.6 + fleeSpike.x * 0.4, direction.y * 0.6 + fleeSpike.y * 0.4);
    }
    const inward = this.getArenaInwardVector(player.x, player.y, BOT_EDGE_AVOID_PADDING);
    if (inward) {
      direction = normalizeVector(direction.x * 0.72 + inward.x * 0.28, direction.y * 0.72 + inward.y * 0.28);
    }

    const aimTarget = threateningEnemy ?? enemy;
    const aim = aimTarget
      ? this.jitterBotAim(
          aimTarget.x + aimTarget.vx * BOT_PREDICTIVE_AIM_SECONDS - player.x,
          aimTarget.y + aimTarget.vy * BOT_PREDICTIVE_AIM_SECONDS - player.y,
        )
      : direction;
    const distanceToTarget = Math.hypot(toTargetX, toTargetY);
    const fire = Boolean(
      aimTarget && player.pushCooldownMs <= 0 && this.canFireProjectile(player) && this.hasLinePressureTarget(player, aimTarget),
    );
    const boost = distanceToTarget > 620 && !spike;
    return { moveX: direction.x, moveY: direction.y, aimX: aim.x, aimY: aim.y, boost, fire };
  }

  private pickColor(): number {
    const palette = [0xff4fc6, 0x4ff2ff, 0xffd84f, 0x79ff6d, 0xbb7dff, 0xff8f66];
    return palette[randomInt(palette.length)] ?? 0xffffff;
  }

  private id(prefix: string): string {
    this.serial += 1;
    return `${prefix}-${this.serial.toString(36)}`;
  }

  private restartRound(): void {
    this.startNextRound(false);
  }

  /** @param skipCountdown If true (match reset / join), go live immediately; round transitions keep the normal freeze. */
  private startNextRound(skipCountdown = false): void {
    this.elapsedMs = 0;
    this.state.elapsedMs = 0;
    this.roundRestartAtMs = null;
    this.state.phase = "countdown";
    this.state.countdownMs = skipCountdown ? 0 : ROUND_COUNTDOWN_MS;
    this.state.roundNumber += 1;
    this.mapLayoutIndex = (this.mapLayoutIndex + 1) % MAP_LAYOUT_COUNT;
    this.state.captureTeam = "";
    this.state.captureProgress = 0;
    const layoutCenter = this.getCaptureCenterForLayout(this.mapLayoutIndex);
    this.state.captureX = layoutCenter.x;
    this.state.captureY = layoutCenter.y;
    this.state.captureAnchorX = layoutCenter.x;
    this.state.captureAnchorY = layoutCenter.y;
    this.state.captureVariant = this.state.roundNumber % 3;
    this.state.mapTheme = this.mapLayoutIndex;
    this.rollMutators();
    this.captureAssistIds.clear();
    this.wasInOwnSafeZone.clear();
    this.resetBotEdgeSpawnPoints();
    this.state.pickups.clear();
    this.state.flags.clear();
    this.state.spikes.clear();
    this.state.slowZones.clear();
    this.state.projectiles.clear();
    this.initializePickups();
    this.initializeSpikes(this.mapLayoutIndex);
    this.initializeFlagsForMode();

    for (const player of this.state.players.values()) {
      player.alive = true;
      const spawn = player.isBot
        ? this.pickUniqueBotEdgeSpawnPoint(player.id)
        : this.isSoloMode() || this.isTeamCtf()
          ? this.pickTeamBaseSpawnPoint(player)
          : this.pickSpawnPoint(player.id, false);
      player.x = spawn.x;
      player.y = spawn.y;
      player.vx = 0;
      player.vy = 0;
      player.rotation = randomRange(-Math.PI, Math.PI);
      player.hp = 100;
      player.boostMs = 0;
      player.speedBoostMs = 0;
      player.stunnedMs = 0;
      player.pushCooldownMs = 0;
      player.bulletCharges = 1;
      player.respawnMs = 0;
      player.streak = 0;
      player.zoneTicks = 0;
      player.basePerkMs = 0;
      player.shieldHits = 0;
      player.magnetMs = 0;
      player.repelMs = 0;
      player.spikeSlowMs = 0;
      player.spikePermSlow = false;
      player.boostCharges = BOOST_CHARGES_PER_LIFE;
      player.boostCooldownMs = 0;
      this.ammoRechargeAtMs.delete(player.id);
    }
  }

  /** Spawns the appropriate flags for the active mode: team flags for team_ctf, neutral for ffa/race/sandbox. */
  private initializeFlagsForMode(): void {
    if (this.isTeamCtf()) {
      this.initializeTeamCtfFlags();
    } else if (this.isRace()) {
      this.initializeRaceFlag();
    } else {
      this.initializeNeutralFlag();
    }
  }

  private initializeTeamCtfFlags(): void {
    const redFlag = new FlagState();
    redFlag.id = "flag-red";
    redFlag.team = TEAM_RED;
    redFlag.homeX = ARENA_WIDTH * 0.08;
    redFlag.homeY = ARENA_HEIGHT * 0.5;
    redFlag.x = redFlag.homeX;
    redFlag.y = redFlag.homeY;
    redFlag.carrierId = "";
    redFlag.atBase = true;
    this.state.flags.set(redFlag.id, redFlag);

    const blueFlag = new FlagState();
    blueFlag.id = "flag-blue";
    blueFlag.team = TEAM_BLUE;
    blueFlag.homeX = ARENA_WIDTH * 0.92;
    blueFlag.homeY = ARENA_HEIGHT * 0.5;
    blueFlag.x = blueFlag.homeX;
    blueFlag.y = blueFlag.homeY;
    blueFlag.carrierId = "";
    blueFlag.atBase = true;
    this.state.flags.set(blueFlag.id, blueFlag);
  }

  private initializeRaceFlag(): void {
    const flag = new FlagState();
    flag.id = NEUTRAL_FLAG_ID;
    flag.team = "neutral";
    flag.homeX = RACE_FLAG_HOME_X;
    flag.homeY = RACE_FLAG_HOME_Y;
    flag.x = flag.homeX;
    flag.y = flag.homeY;
    flag.carrierId = "";
    flag.atBase = true;
    flag.carryAgeMs = 0;
    this.state.flags.set(flag.id, flag);
  }

  private endRoundFromTimeout(): void {
    this.state.phase = "results";
    this.roundRestartAtMs = this.elapsedMs + ROUND_RESULTS_MS;
  }

  private initializeFlags(): void {
    const redFlag = new FlagState();
    redFlag.id = "flag-red";
    redFlag.team = TEAM_RED;
    redFlag.homeX = ARENA_WIDTH * 0.12;
    redFlag.homeY = ARENA_HEIGHT * 0.5;
    redFlag.x = redFlag.homeX;
    redFlag.y = redFlag.homeY;
    redFlag.carrierId = "";
    redFlag.atBase = true;
    this.state.flags.set(redFlag.id, redFlag);

    const blueFlag = new FlagState();
    blueFlag.id = "flag-blue";
    blueFlag.team = TEAM_BLUE;
    blueFlag.homeX = ARENA_WIDTH * 0.88;
    blueFlag.homeY = ARENA_HEIGHT * 0.5;
    blueFlag.x = blueFlag.homeX;
    blueFlag.y = blueFlag.homeY;
    blueFlag.carrierId = "";
    blueFlag.atBase = true;
    this.state.flags.set(blueFlag.id, blueFlag);
  }

  private initializeNeutralFlag(): void {
    const flag = new FlagState();
    flag.id = NEUTRAL_FLAG_ID;
    flag.team = "neutral";
    flag.homeX = this.state.captureX;
    flag.homeY = this.state.captureY;
    flag.x = flag.homeX;
    flag.y = flag.homeY;
    flag.carrierId = "";
    flag.atBase = true;
    flag.carryAgeMs = 0;
    this.state.flags.set(flag.id, flag);
  }

  private initializePickups(): void {
    const count = this.hasMutator("dense_loot") ? 14 : 10;
    for (let i = 0; i < count; i += 1) {
      const pickup = new PickupState();
      pickup.id = this.id("pickup");
      pickup.kind = PICKUP_WEIGHTS[i % PICKUP_WEIGHTS.length] ?? "speed";
      const p = this.pickRandomPointInArena();
      pickup.x = p.x;
      pickup.y = p.y;
      pickup.active = true;
      pickup.respawnAtMs = 0;
      this.state.pickups.set(pickup.id, pickup);
    }
  }

  private initializeSpikes(layoutIndex = 0): void {
    this.state.spikes.clear();
    const presets = this.getSpikeLayout(layoutIndex);
    for (let i = 0; i < SPIKE_COUNT; i += 1) {
      const spike = new SpikeState();
      spike.id = this.id("spike");
      spike.radius = SPIKE_RADIUS;
      const preset = presets[i];
      spike.x = preset?.x ?? randomRange(SAFE_ZONE_SIZE + 120, ARENA_WIDTH - SAFE_ZONE_SIZE - 120);
      spike.y = preset?.y ?? randomRange(SAFE_ZONE_SIZE + 120, ARENA_HEIGHT - SAFE_ZONE_SIZE - 120);
      const heading = preset?.heading ?? randomRange(0, Math.PI * 2);
      spike.vx = Math.cos(heading) * SPIKE_DRIFT_SPEED;
      spike.vy = Math.sin(heading) * SPIKE_DRIFT_SPEED;
      spike.spikeKind = i < 2 ? "pull" : "standard";
      if (this.isFfa()) {
        const inner = FFA_OCTAGON_RADIUS - spike.radius - 40;
        const c = clampToOctagon(spike.x, spike.y, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, inner);
        spike.x = c.x;
        spike.y = c.y;
      }
      this.state.spikes.set(spike.id, spike);
    }
  }

  private getCaptureCenterForLayout(layoutIndex: number): { x: number; y: number } {
    const index = ((layoutIndex % MAP_LAYOUT_COUNT) + MAP_LAYOUT_COUNT) % MAP_LAYOUT_COUNT;
    if (index === 1) return { x: ARENA_WIDTH * 0.42, y: ARENA_HEIGHT * 0.58 };
    if (index === 2) return { x: ARENA_WIDTH * 0.62, y: ARENA_HEIGHT * 0.43 };
    return { x: ARENA_WIDTH * 0.5, y: ARENA_HEIGHT * 0.5 };
  }

  private getSpikeLayout(layoutIndex: number): Array<{ x: number; y: number; heading: number }> {
    const centerX = this.state.captureX;
    const centerY = this.state.captureY;
    const index = ((layoutIndex % MAP_LAYOUT_COUNT) + MAP_LAYOUT_COUNT) % MAP_LAYOUT_COUNT;
    if (index === 1) {
      return [
        { x: centerX - 460, y: centerY - 40, heading: Math.PI * 0.2 },
        { x: centerX - 220, y: centerY + 300, heading: Math.PI * 1.1 },
        { x: centerX + 40, y: centerY - 300, heading: Math.PI * 0.8 },
        { x: centerX + 260, y: centerY + 280, heading: Math.PI * 1.6 },
        { x: centerX + 500, y: centerY - 20, heading: Math.PI * 0.45 },
      ];
    }
    if (index === 2) {
      return [
        { x: centerX - 420, y: centerY - 260, heading: Math.PI * 0.7 },
        { x: centerX - 140, y: centerY + 320, heading: Math.PI * 1.35 },
        { x: centerX + 110, y: centerY - 10, heading: Math.PI * 0.15 },
        { x: centerX + 330, y: centerY - 320, heading: Math.PI * 1.75 },
        { x: centerX + 520, y: centerY + 230, heading: Math.PI * 0.95 },
      ];
    }
    return [
      { x: centerX - 470, y: centerY, heading: Math.PI * 0.1 },
      { x: centerX - 230, y: centerY - 260, heading: Math.PI * 0.65 },
      { x: centerX + 10, y: centerY + 280, heading: Math.PI * 1.2 },
      { x: centerX + 250, y: centerY - 250, heading: Math.PI * 1.55 },
      { x: centerX + 500, y: centerY + 10, heading: Math.PI * 0.4 },
    ];
  }

  private updateSpikes(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const minX = SAFE_ZONE_SIZE + 80;
    const maxX = ARENA_WIDTH - SAFE_ZONE_SIZE - 80;
    const minY = SAFE_ZONE_SIZE + 80;
    const maxY = ARENA_HEIGHT - SAFE_ZONE_SIZE - 80;
    for (const spike of this.state.spikes.values()) {
      spike.x += spike.vx * dt;
      spike.y += spike.vy * dt;
      if (this.isFfa()) {
        const margin = spike.radius + 12;
        const inner = FFA_OCTAGON_RADIUS - margin;
        if (!pointInOctagon(spike.x, spike.y, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, inner)) {
          const c = clampToOctagon(spike.x, spike.y, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, inner);
          spike.x = c.x;
          spike.y = c.y;
          spike.vx *= -0.9;
          spike.vy *= -0.9;
        }
        continue;
      }
      if (spike.x < minX || spike.x > maxX) {
        spike.x = clamp(spike.x, minX, maxX);
        spike.vx *= -1;
      }
      if (spike.y < minY || spike.y > maxY) {
        spike.y = clamp(spike.y, minY, maxY);
        spike.vy *= -1;
      }
    }
  }

  private tryCollectPickup(player: PlayerState, previousX: number, previousY: number): void {
    for (const pickup of this.state.pickups.values()) {
      if (!pickup.active) continue;
      const pickupRadius = PLAYER_RADIUS + PICKUP_RADIUS;
      const sweptHit = this.distancePointToSegmentSquared(pickup.x, pickup.y, previousX, previousY, player.x, player.y) <= pickupRadius * pickupRadius;
      if (!sweptHit) continue;

      pickup.active = false;
      pickup.respawnAtMs = this.elapsedMs + PICKUP_RESPAWN_MS;
      if (pickup.kind === "speed") {
        player.speedBoostMs = SPEED_POWERUP_DURATION_MS;
        player.score += 3;
      }
      if (pickup.kind === "ammo") {
        const maxCharges = player.isBot ? 1 : 3;
        player.bulletCharges = Math.min(maxCharges, player.bulletCharges + EXTRA_BULLET_CHARGES);
        player.score += 3;
      }
      if (pickup.kind === "shield") {
        player.shieldHits = Math.min(1, player.shieldHits + 1);
        player.score += 4;
      }
      if (pickup.kind === "magnet") {
        player.magnetMs = 5200;
        player.score += 4;
      }
      if (pickup.kind === "repel") {
        player.repelMs = 4800;
        player.score += 4;
      }
    }
  }

  private tryHitSpike(player: PlayerState): void {
    for (const spike of this.state.spikes.values()) {
      const hitRadius = PLAYER_RADIUS + spike.radius;
      if (Math.hypot(player.x - spike.x, player.y - spike.y) > hitRadius) continue;
      if (spike.spikeKind === "pull") {
        const dx = spike.x - player.x;
        const dy = spike.y - player.y;
        const len = Math.hypot(dx, dy) || 1;
        player.vx += (dx / len) * 640;
        player.vy += (dy / len) * 640;
      }
      player.spikeSlowMs = SPIKE_SLOW_DURATION_MS;
      player.spikePermSlow = true;
      return;
    }
  }

  private findNearestActivePickup(x: number, y: number, preferredKind?: PickupKind): PickupState | undefined {
    let best: PickupState | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const pickup of this.state.pickups.values()) {
      if (!pickup.active) continue;
      if (preferredKind && pickup.kind !== preferredKind) continue;
      const distance = Math.hypot(pickup.x - x, pickup.y - y);
      if (distance < bestDistance) {
        best = pickup;
        bestDistance = distance;
      }
    }
    return best;
  }

  private knockOutPlayer(player: PlayerState): void {
    if (!player.alive) return;
    for (const flag of this.state.flags.values()) {
      if (flag.carrierId === player.id) {
        flag.carrierId = "";
        flag.atBase = false;
        flag.x = player.x;
        flag.y = player.y;
      }
    }
    player.streak = 0;
    player.score = Math.max(0, player.score - 5);
    // Solo FFA: respawn instantly at the player's own vertex base instead of running a death timer.
    if (this.isSoloMode()) {
      this.respawnPlayer(player);
      return;
    }
    player.alive = false;
    player.respawnMs = PLAYER_RESPAWN_MS;
  }

  private eliminateToTeamBase(player: PlayerState): void {
    const neutral = this.getNeutralFlag();
    if (neutral?.carrierId === player.id) {
      this.resetNeutralFlag();
    }
    this.knockOutPlayer(player);
    if (!player.alive) this.respawnPlayer(player);
  }

  private respawnPlayer(player: PlayerState): void {
    player.alive = true;
    player.respawnMs = 0;
    player.hp = 100;
    player.basePerkMs = Math.max(player.basePerkMs, BASE_PERK_DURATION_MS);
    const spawn = this.pickTeamBaseSpawnPoint(player);
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.stunnedMs = 0;
    player.spikeSlowMs = 0;
    player.boostCharges = BOOST_CHARGES_PER_LIFE;
    player.boostCooldownMs = 0;
    player.boostMs = 0;
    player.rotation = randomRange(-Math.PI, Math.PI);
  }

  private pickTeamBaseSpawnPoint(player: PlayerState): { x: number; y: number } {
    if (this.isFfa()) {
      const c = this.getFfaCircles().find((z) => z.team === player.team);
      if (c) {
        return { x: c.cx + randomRange(-36, 36), y: c.cy + randomRange(-36, 36) };
      }
    }
    if (this.isRace()) {
      return {
        x: randomRange(RACE_SPAWN_BAND_MIN_X + 60, RACE_SPAWN_BAND_MAX_X - 40),
        y: randomRange(ARENA_HEIGHT * 0.1, ARENA_HEIGHT * 0.9),
      };
    }
    const zone = SAFE_ZONES.find((candidate) => candidate.team === this.asTeam(player.team)) ?? SAFE_ZONES[0];
    if (!zone) return this.pickSpawnPoint(player.id, false);
    return { x: (zone.minX + zone.maxX) * 0.5, y: (zone.minY + zone.maxY) * 0.5 };
  }

  private pickSpawnPoint(ignorePlayerId?: string, outsideOnly = false): { x: number; y: number } {
    if (this.isFfa()) {
      const verts = octagonVertices(
        FFA_OCTAGON_CENTER_X,
        FFA_OCTAGON_CENTER_Y,
        FFA_OCTAGON_RADIUS - SPAWN_EDGE_PADDING * 0.85,
      );
      const edgeAttempts = outsideOnly ? 56 : 40;
      for (let attempt = 0; attempt < edgeAttempts; attempt += 1) {
        let p: { x: number; y: number };
        if (outsideOnly) {
          const ei = randomInt(verts.length);
          const a = verts[ei]!;
          const b = verts[(ei + 1) % verts.length]!;
          const f = randomRange(0.08, 0.92);
          p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        } else {
          p = this.pickRandomPointInArena();
        }
        const tooClose = [...this.state.players.values()].some((other) => {
          if (!other.alive) return false;
          if (ignorePlayerId && other.id === ignorePlayerId) return false;
          return Math.hypot(p.x - other.x, p.y - other.y) < SPAWN_PLAYER_CLEARANCE;
        });
        if (!tooClose) return p;
      }
      return clampToOctagon(
        FFA_OCTAGON_CENTER_X,
        FFA_OCTAGON_CENTER_Y,
        FFA_OCTAGON_CENTER_X,
        FFA_OCTAGON_CENTER_Y,
        FFA_OCTAGON_RADIUS - SPAWN_PLAYER_CLEARANCE,
      );
    }
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const side = randomInt(4);
      const candidateX =
        outsideOnly && (side === 0 || side === 1)
          ? side === 0
            ? SPAWN_EDGE_PADDING
            : ARENA_WIDTH - SPAWN_EDGE_PADDING
          : randomRange(SPAWN_EDGE_PADDING, ARENA_WIDTH - SPAWN_EDGE_PADDING);
      const candidateY =
        outsideOnly && (side === 2 || side === 3)
          ? side === 2
            ? SPAWN_EDGE_PADDING
            : ARENA_HEIGHT - SPAWN_EDGE_PADDING
          : randomRange(SPAWN_EDGE_PADDING, ARENA_HEIGHT - SPAWN_EDGE_PADDING);

      const tooCloseToPlayer = [...this.state.players.values()].some((other) => {
        if (!other.alive) return false;
        if (ignorePlayerId && other.id === ignorePlayerId) return false;
        return Math.hypot(candidateX - other.x, candidateY - other.y) < SPAWN_PLAYER_CLEARANCE;
      });
      if (tooCloseToPlayer) continue;

      return { x: candidateX, y: candidateY };
    }

    return { x: SPAWN_EDGE_PADDING, y: SPAWN_EDGE_PADDING };
  }

  private applyEnemySafeZoneBlocking(player: PlayerState): void {
    if (this.isFfa()) {
      for (const z of this.getFfaCircles()) {
        if (z.team === player.team) continue;
        const dx = player.x - z.cx;
        const dy = player.y - z.cy;
        const d = Math.hypot(dx, dy);
        if (d >= z.r || d < 1e-4) continue;
        const nx = dx / d;
        const ny = dy / d;
        player.x = z.cx + nx * (z.r + 0.5);
        player.y = z.cy + ny * (z.r + 0.5);
        const inward = player.vx * nx + player.vy * ny;
        if (inward < 0) {
          player.vx -= inward * nx;
          player.vy -= inward * ny;
        }
      }
      return;
    }
    // Race mode has a shared spawn band; no per-team safe zones to block.
    if (this.isRace()) return;
    const activeTeams = this.getActiveTeams();
    for (const zone of SAFE_ZONES) {
      if (zone.team === player.team) continue;
      // Team CTF: only the active teams' safe zones are real walls; others are inert.
      if (!activeTeams.includes(zone.team)) continue;
      const overlapsX = player.x > zone.minX && player.x < zone.maxX;
      const overlapsY = player.y > zone.minY && player.y < zone.maxY;
      if (!overlapsX || !overlapsY) continue;
      const exits = [
        { axis: "x" as const, value: zone.minX, distance: Math.abs(zone.minX - player.x), velocity: -1 },
        { axis: "x" as const, value: zone.maxX, distance: Math.abs(zone.maxX - player.x), velocity: 1 },
        { axis: "y" as const, value: zone.minY, distance: Math.abs(zone.minY - player.y), velocity: -1 },
        { axis: "y" as const, value: zone.maxY, distance: Math.abs(zone.maxY - player.y), velocity: 1 },
      ];
      const exit = exits.sort((a, b) => a.distance - b.distance)[0];
      if (!exit) continue;
      if (exit.axis === "x") {
        player.x = exit.value;
        player.vx = exit.velocity < 0 ? Math.min(0, player.vx) : Math.max(0, player.vx);
      } else {
        player.y = exit.value;
        player.vy = exit.velocity < 0 ? Math.min(0, player.vy) : Math.max(0, player.vy);
      }
    }
  }

  private pickUniqueBotEdgeSpawnPoint(ignorePlayerId?: string): { x: number; y: number } {
    if (this.botEdgeSpawnPoints.length === 0) {
      this.resetBotEdgeSpawnPoints();
    }

    for (let attempt = 0; attempt < this.botEdgeSpawnPoints.length; attempt += 1) {
      const index = (this.botEdgeSpawnCursor + attempt) % this.botEdgeSpawnPoints.length;
      const candidate = this.botEdgeSpawnPoints[index];
      if (!candidate) continue;
      const tooClose = [...this.state.players.values()].some((other) => {
        if (!other.alive) return false;
        if (ignorePlayerId && other.id === ignorePlayerId) return false;
        return Math.hypot(candidate.x - other.x, candidate.y - other.y) < SPAWN_PLAYER_CLEARANCE;
      });
      if (tooClose) continue;
      this.botEdgeSpawnCursor = (index + 1) % this.botEdgeSpawnPoints.length;
      return { x: candidate.x, y: candidate.y };
    }

    return this.pickSpawnPoint(ignorePlayerId, true);
  }

  private resetBotEdgeSpawnPoints(): void {
    const target = TARGET_BOT_COUNT_SANDBOX;
    const count = clamp(target, 1, MAX_BOTS);
    const points: Array<{ x: number; y: number }> = [];
    if (this.isFfa()) {
      const verts = octagonVertices(
        FFA_OCTAGON_CENTER_X,
        FFA_OCTAGON_CENTER_Y,
        FFA_OCTAGON_RADIUS - SPAWN_EDGE_PADDING * 0.9,
      );
      const perim = verts.length;
      for (let i = 0; i < count; i += 1) {
        const along = ((i + 0.5) / count) * perim;
        const vi = Math.floor(along) % perim;
        const vj = (vi + 1) % perim;
        const f = along - Math.floor(along);
        const a = verts[vi]!;
        const b = verts[vj]!;
        points.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
      }
      this.botEdgeSpawnPoints = points.sort(() => randomRange(-1, 1));
      this.botEdgeSpawnCursor = 0;
      return;
    }
    const step = 1 / count;
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) * step;
      const perimeter = t * 2 * (ARENA_WIDTH + ARENA_HEIGHT);
      const widthSpan = ARENA_WIDTH - SPAWN_EDGE_PADDING * 2;
      const heightSpan = ARENA_HEIGHT - SPAWN_EDGE_PADDING * 2;
      const edgeA = widthSpan;
      const edgeB = edgeA + heightSpan;
      const edgeC = edgeB + widthSpan;
      const edgeD = edgeC + heightSpan;

      if (perimeter < edgeA) {
        points.push({ x: SPAWN_EDGE_PADDING + perimeter, y: SPAWN_EDGE_PADDING });
      } else if (perimeter < edgeB) {
        points.push({ x: ARENA_WIDTH - SPAWN_EDGE_PADDING, y: SPAWN_EDGE_PADDING + (perimeter - edgeA) });
      } else if (perimeter < edgeC) {
        points.push({ x: ARENA_WIDTH - SPAWN_EDGE_PADDING - (perimeter - edgeB), y: ARENA_HEIGHT - SPAWN_EDGE_PADDING });
      } else {
        points.push({ x: SPAWN_EDGE_PADDING, y: ARENA_HEIGHT - SPAWN_EDGE_PADDING - (perimeter - edgeC) });
      }
    }

    this.botEdgeSpawnPoints = points.sort(() => randomRange(-1, 1));
    this.botEdgeSpawnCursor = 0;
  }

  private getNeutralFlag(): FlagState | undefined {
    return this.state.flags.get(NEUTRAL_FLAG_ID);
  }

  private resetNeutralFlag(): void {
    const flag = this.getNeutralFlag();
    if (!flag) return;
    flag.carrierId = "";
    flag.atBase = true;
    flag.carryAgeMs = 0;
    flag.homeX = this.state.captureX;
    flag.homeY = this.state.captureY;
    flag.x = flag.homeX;
    flag.y = flag.homeY;
  }

  private tryPickupNeutralFlag(player: PlayerState, previousX: number, previousY: number): void {
    if (!player.alive) return;
    const flag = this.getNeutralFlag();
    if (!flag || flag.carrierId) return;
    const pickupRadius = PLAYER_RADIUS + FLAG_PICKUP_RADIUS;
    const touchesFlag =
      this.distancePointToSegmentSquared(flag.x, flag.y, previousX, previousY, player.x, player.y) <= pickupRadius * pickupRadius;
    const inCaptureCircle = Math.hypot(player.x - this.state.captureX, player.y - this.state.captureY) <= this.state.captureRadius;
    if (!touchesFlag && !inCaptureCircle) return;
    flag.carrierId = player.id;
    flag.atBase = false;
    flag.carryAgeMs = 0;
    flag.x = player.x;
    flag.y = player.y;
    if (!player.isBot) {
      player.speedBoostMs = Math.max(player.speedBoostMs, HUMAN_FLAG_PICKUP_SPEED_MS);
      player.score += HUMAN_FLAG_PICKUP_SCORE;
    }
  }

  private tryScoreNeutralFlag(player: PlayerState): void {
    const flag = this.getNeutralFlag();
    if (!flag || flag.carrierId !== player.id) return;
    if (!this.isInsideTeamSafeZone(player, player.team)) return;
    const endgame = this.isFfa()
      ? this.isFfaFrenzy()
      : this.getMatchDurationMs() - this.elapsedMs <= ENDGAME_LAST_MS;
    const add = endgame ? FLAG_CAPTURE_SCORE * 2 : FLAG_CAPTURE_SCORE;
    if (player.team === TEAM_RED) this.state.redScore += add;
    if (player.team === TEAM_BLUE) this.state.blueScore += add;
    if (player.team === TEAM_GREEN) this.state.greenScore += add;
    if (player.team === TEAM_YELLOW) this.state.yellowScore += add;
    const ffaIndex = FFA_TEAM_IDS.indexOf(player.team as (typeof FFA_TEAM_IDS)[number]);
    if (ffaIndex >= 0) {
      const row = this.state as unknown as Record<string, number>;
      const key = FFA_SCORE_KEYS[ffaIndex];
      if (key) row[key] = (row[key] ?? 0) + add;
    }
    player.score += (endgame ? 40 : 25) + (player.isBot ? 0 : HUMAN_FLAG_SCORE_BONUS);
    player.wins += 1;
    if (!player.isBot) {
      player.challengeCaps += 1;
      player.challengeTier = Math.floor(player.challengeCaps / 3);
    }
    this.startNextRound();
  }

  /** Race win: carrier crosses the left spawn band carrying the flag. Round ends, player.score gets a big bonus. */
  private tryScoreRaceFlag(player: PlayerState): void {
    const flag = this.getNeutralFlag();
    if (!flag || flag.carrierId !== player.id) return;
    if (player.x > RACE_SPAWN_BAND_MAX_X) return;
    player.score += 100;
    player.wins += 1;
    if (!player.isBot) {
      player.challengeCaps += 1;
      player.challengeTier = Math.floor(player.challengeCaps / 3);
    }
    this.startNextRound();
  }

  private isInsideTeamSafeZone(player: PlayerState, team: string): boolean {
    if (this.isFfa()) {
      const circ = this.getFfaCircles().find((c) => c.team === team);
      return Boolean(circ && Math.hypot(player.x - circ.cx, player.y - circ.cy) < circ.r);
    }
    const teamT = this.asTeam(team);
    return SAFE_ZONES.some(
      (zone) =>
        zone.team === teamT &&
        player.x > zone.minX &&
        player.x < zone.maxX &&
        player.y > zone.minY &&
        player.y < zone.maxY,
    );
  }

  private pickBalancedTeam(): string {
    const active = this.getActiveTeams();
    const counts = new Map<string, number>(active.map((team) => [team, 0]));
    for (const player of this.state.players.values()) {
      if (!counts.has(player.team)) continue;
      counts.set(player.team, (counts.get(player.team) ?? 0) + 1);
    }
    return [...active].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0] ?? TEAM_RED;
  }

  private spawnProjectile(source: PlayerState, input: InputState): void {
    const aim = normalizeVector(input.aimX, input.aimY);
    const projectile = new ProjectileState();
    projectile.id = this.id("shot");
    projectile.ownerId = source.id;
    projectile.team = source.team;
    projectile.x = source.x + aim.x * (PLAYER_RADIUS + PROJECTILE_RADIUS + 4);
    projectile.y = source.y + aim.y * (PLAYER_RADIUS + PROJECTILE_RADIUS + 4);
    projectile.vx = aim.x * PROJECTILE_SPEED;
    projectile.vy = aim.y * PROJECTILE_SPEED;
    projectile.traveled = 0;
    projectile.radius = PROJECTILE_RADIUS;
    this.state.projectiles.set(projectile.id, projectile);
    const recoil = PROJECTILE_SHOOTER_RECOIL * (source.isBot ? 0.38 : 1);
    source.vx -= aim.x * recoil;
    source.vy -= aim.y * recoil;
  }

  private canFireProjectile(player: PlayerState): boolean {
    return player.bulletCharges > 0;
  }

  private restoreBulletCharge(ownerId: string): void {
    const owner = this.state.players.get(ownerId);
    if (!owner?.alive) return;
    if (owner.isBot) return;
    const maxCharges = owner.isBot ? 1 : 3;
    owner.bulletCharges = Math.min(maxCharges, owner.bulletCharges + 1);
  }

  private tryRechargeAmmo(player: PlayerState): void {
    const maxCharges = player.isBot ? 1 : 3;
    if (this.isFfaFrenzy()) {
      if (player.bulletCharges < maxCharges) {
        player.bulletCharges = maxCharges;
      }
      this.ammoRechargeAtMs.delete(player.id);
      return;
    }
    if (player.bulletCharges >= maxCharges || !player.alive) return;
    const readyAt = this.ammoRechargeAtMs.get(player.id) ?? this.elapsedMs;
    if (this.elapsedMs < readyAt) return;
    player.bulletCharges = Math.min(maxCharges, player.bulletCharges + 1);
    let rechargeMs = this.isTrailingTeam(player.team) ? TRAILING_AMMO_RECHARGE_MS : BASE_AMMO_RECHARGE_MS;
    if (this.state.worldEvent === "surge_ammo") {
      rechargeMs *= 0.5;
    }
    this.ammoRechargeAtMs.set(player.id, this.elapsedMs + rechargeMs);
  }

  private isTrailingTeam(team: string): boolean {
    const teamT = this.asTeam(team);
    const scores = new Map<Team, number>([
      [TEAM_RED, this.state.redScore],
      [TEAM_BLUE, this.state.blueScore],
      [TEAM_GREEN, this.state.greenScore],
      [TEAM_YELLOW, this.state.yellowScore],
    ]);
    const teamScore = scores.get(teamT) ?? 0;
    const bestScore = Math.max(...scores.values());
    return teamScore < bestScore;
  }

  private findProjectileHit(projectile: ProjectileState, fromX: number, fromY: number): PlayerState | undefined {
    for (const player of this.state.players.values()) {
      if (!player.alive || player.id === projectile.ownerId) continue;
      const hitRadius = PLAYER_RADIUS + projectile.radius;
      const sweptHit = this.distancePointToSegmentSquared(player.x, player.y, fromX, fromY, projectile.x, projectile.y) <= hitRadius * hitRadius;
      const overlapHit = Math.hypot(player.x - projectile.x, player.y - projectile.y) <= hitRadius;
      if (sweptHit || overlapHit) {
        return player;
      }
    }
    return undefined;
  }

  private findProjectileSpikeHitId(projectile: ProjectileState, fromX: number, fromY: number): string | undefined {
    for (const [id, spike] of this.state.spikes.entries()) {
      const hitRadius = spike.radius + projectile.radius;
      const sweptHit =
        this.distancePointToSegmentSquared(spike.x, spike.y, fromX, fromY, projectile.x, projectile.y) <= hitRadius * hitRadius;
      const overlapHit = Math.hypot(spike.x - projectile.x, spike.y - projectile.y) <= hitRadius;
      if (sweptHit || overlapHit) {
        return id;
      }
    }
    return undefined;
  }

  private explodeProjectile(projectile: ProjectileState, directHitPlayerId?: string): void {
    const owner = this.state.players.get(projectile.ownerId);
    const directVictimPreview = directHitPlayerId ? this.state.players.get(directHitPlayerId) : undefined;
    const shieldBlocksFlagSteal = Boolean(directVictimPreview && directVictimPreview.shieldHits > 0);
    const explosionR = this.hasMutator("megaboom") ? PROJECTILE_EXPLOSION_RADIUS * 1.38 : PROJECTILE_EXPLOSION_RADIUS;
    for (const target of this.state.players.values()) {
      if (!target.alive || target.id === projectile.ownerId) continue;
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0 || distance > explosionR) continue;
      if (target.shieldHits > 0) {
        target.shieldHits -= 1;
        if (owner) {
          owner.score += 1;
        }
        continue;
      }
      const falloff = 1 - distance / explosionR;
      const direction = normalizeVector(dx, dy);
      const directHitBonus = target.id === directHitPlayerId ? 1.78 : 1;
      target.vx += direction.x * PROJECTILE_EXPLOSION_FORCE * falloff * directHitBonus;
      target.vy += direction.y * PROJECTILE_EXPLOSION_FORCE * falloff * directHitBonus;
      if (owner) {
        const basePts = target.id === directHitPlayerId ? 8 : 3;
        const humanDirect =
          !owner.isBot && target.id === directHitPlayerId ? HUMAN_DIRECT_HIT_EXTRA_SCORE : 0;
        owner.score += basePts + humanDirect;
      }
    }

    if (owner?.alive && directHitPlayerId && !shieldBlocksFlagSteal) {
      const directVictim = this.state.players.get(directHitPlayerId);
      if (directVictim?.alive && owner.team !== directVictim.team) {
        this.stealCarrierFlagsFromVictim(owner, directVictim);
      }
    }

    if (owner?.alive && directHitPlayerId && !owner.isBot) {
      const dv = this.state.players.get(directHitPlayerId);
      if (dv?.alive && dv.id !== owner.id) owner.streak += 1;
    }
  }

  /** Direct bullet hit: any flag the victim is carrying moves to the shooter (enemy teams only). */
  private stealCarrierFlagsFromVictim(shooter: PlayerState, victim: PlayerState): void {
    const hadNeutral = this.getNeutralFlag()?.carrierId === victim.id;
    for (const flag of this.state.flags.values()) {
      if (flag.carrierId !== victim.id) continue;
      flag.carrierId = shooter.id;
      flag.atBase = false;
      flag.x = shooter.x;
      flag.y = shooter.y;
    }
    if (hadNeutral && !shooter.isBot) {
      shooter.challengeSteals += 1;
      shooter.speedBoostMs = Math.max(shooter.speedBoostMs, HUMAN_FLAG_STEAL_SPEED_MS);
      shooter.score += HUMAN_FLAG_STEAL_SCORE;
      shooter.boostMs = Math.max(shooter.boostMs, HUMAN_FLAG_STEAL_BOOST_MS);
    }
  }

  private distancePointToSegmentSquared(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const wx = px - x1;
    const wy = py - y1;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return (px - x2) * (px - x2) + (py - y2) * (py - y2);
    const t = c1 / c2;
    const projX = x1 + t * vx;
    const projY = y1 + t * vy;
    return (px - projX) * (px - projX) + (py - projY) * (py - projY);
  }

  private pickBotTarget(player: PlayerState): { x: number; y: number } | null {
    const playerTeam = this.asTeam(player.team);
    const ownFlag = this.getFlagByTeam(playerTeam);
    const enemyFlag = this.getFlagByTeam(playerTeam === TEAM_RED ? TEAM_BLUE : TEAM_RED);
    if (!ownFlag || !enemyFlag) return null;
    if (enemyFlag.carrierId === player.id) return { x: ownFlag.homeX, y: ownFlag.homeY };

    const friendlyCarrier = [...this.state.flags.values()].find((flag) => flag.team !== player.team && flag.carrierId);
    if (friendlyCarrier?.carrierId) {
      const carrier = this.state.players.get(friendlyCarrier.carrierId);
      if (carrier?.team === player.team && carrier.id !== player.id) {
        return { x: carrier.x, y: carrier.y };
      }
    }

    const enemyCarrier = this.getEnemyFlagCarrier(playerTeam);
    if (enemyCarrier) return { x: enemyCarrier.x, y: enemyCarrier.y };

    const role = this.getBotRole(player);
    if (role === "defender") {
      const nearestEnemy = this.findNearestEnemyToPoint(ownFlag.homeX, ownFlag.homeY, 1200, player.team);
      return nearestEnemy ? { x: nearestEnemy.x, y: nearestEnemy.y } : { x: ownFlag.homeX, y: ownFlag.homeY };
    }
    if (role === "interceptor") {
      const nearestEnemy = this.findNearestEnemy(player, 1800);
      if (nearestEnemy) return { x: nearestEnemy.x, y: nearestEnemy.y };
      return { x: ARENA_WIDTH * 0.5, y: ARENA_HEIGHT * 0.5 };
    }

    return { x: enemyFlag.x, y: enemyFlag.y };
  }

  private getBotRole(player: PlayerState): BotRole {
    const hash = [...player.id].reduce((total, char) => total + char.charCodeAt(0), 0);
    const roles: readonly BotRole[] = ["attacker", "defender", "interceptor"];
    return roles[hash % roles.length] ?? "attacker";
  }

  private findNearestEnemy(player: PlayerState, maxDistance: number): PlayerState | undefined {
    return this.findNearestEnemyToPoint(player.x, player.y, maxDistance, "", player.id);
  }

  private findMostThreateningEnemy(player: PlayerState): PlayerState | undefined {
    const ownBase = this.getTeamSafeZoneCenter(player.team);
    let best: PlayerState | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const enemy of this.state.players.values()) {
      if (!enemy.alive || enemy.id === player.id || enemy.team === player.team) continue;
      const toBot = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (toBot > PROJECTILE_MAX_RANGE * 1.7) continue;
      const toBase = Math.hypot(enemy.x - ownBase.x, enemy.y - ownBase.y);
      const carriesNeutralFlag = this.getNeutralFlag()?.carrierId === enemy.id;
      const pressureScore = (carriesNeutralFlag ? 1500 : 0) + (1400 - Math.min(1400, toBase)) + (1200 - Math.min(1200, toBot));
      if (pressureScore > bestScore) {
        best = enemy;
        bestScore = pressureScore;
      }
    }
    return best;
  }

  private findNearestTeammateNeutralFlagCarrier(player: PlayerState, maxDistance: number): PlayerState | undefined {
    const flag = this.getNeutralFlag();
    if (!flag?.carrierId || flag.carrierId === player.id) return undefined;
    const carrier = this.state.players.get(flag.carrierId);
    if (!carrier?.alive || carrier.team !== player.team) return undefined;
    const distance = Math.hypot(carrier.x - player.x, carrier.y - player.y);
    return distance <= maxDistance ? carrier : undefined;
  }

  private findNearestSpike(x: number, y: number, maxDistance: number): SpikeState | undefined {
    let nearest: SpikeState | undefined;
    let nearestDistance = maxDistance;
    for (const spike of this.state.spikes.values()) {
      const distance = Math.hypot(spike.x - x, spike.y - y);
      if (distance < nearestDistance) {
        nearest = spike;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private findNearestEnemyToPoint(
    x: number,
    y: number,
    maxDistance: number,
    team: string,
    ignorePlayerId?: string,
  ): PlayerState | undefined {
    let best: PlayerState | undefined;
    let bestDistance = maxDistance;
    for (const other of this.state.players.values()) {
      if (!other.alive || other.id === ignorePlayerId) continue;
      if (team && other.team === team) continue;
      const distance = Math.hypot(other.x - x, other.y - y);
      if (distance < bestDistance) {
        best = other;
        bestDistance = distance;
      }
    }
    return best;
  }

  private getEnemyFlagCarrier(team: Team): PlayerState | undefined {
    for (const flag of this.state.flags.values()) {
      if (flag.team !== team || !flag.carrierId) continue;
      const carrier = this.state.players.get(flag.carrierId);
      if (carrier?.alive && carrier.team !== team) return carrier;
    }
    return undefined;
  }

  private findEnemyFlagCarrierForTeam(team: string): PlayerState | undefined {
    const flag = this.getNeutralFlag();
    if (!flag?.carrierId) return undefined;
    const carrier = this.state.players.get(flag.carrierId);
    if (!carrier?.alive || carrier.team === team) return undefined;
    return carrier;
  }

  private getTeamSafeZoneCenter(team: string): { x: number; y: number } {
    if (this.isFfa()) {
      const c = this.getFfaCircles().find((z) => z.team === team);
      if (c) return { x: c.cx, y: c.cy };
      return { x: FFA_OCTAGON_CENTER_X, y: FFA_OCTAGON_CENTER_Y };
    }
    if (this.isRace()) {
      return { x: (RACE_SPAWN_BAND_MIN_X + RACE_SPAWN_BAND_MAX_X) * 0.5, y: ARENA_HEIGHT * 0.5 };
    }
    const teamT = this.asTeam(team);
    const zone = SAFE_ZONES.find((candidate) => candidate.team === teamT) ?? SAFE_ZONES[0];
    if (!zone) return { x: ARENA_WIDTH * 0.5, y: ARENA_HEIGHT * 0.5 };
    return { x: (zone.minX + zone.maxX) * 0.5, y: (zone.minY + zone.maxY) * 0.5 };
  }

  private getArenaInwardVector(x: number, y: number, padding: number): { x: number; y: number } | null {
    if (this.isFfa()) {
      const inner = FFA_OCTAGON_RADIUS - padding * 1.15;
      if (pointInOctagon(x, y, FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, inner)) return null;
      return normalizeVector(FFA_OCTAGON_CENTER_X - x, FFA_OCTAGON_CENTER_Y - y);
    }
    const leftPressure = x < padding ? (padding - x) / padding : 0;
    const rightPressure = x > ARENA_WIDTH - padding ? (x - (ARENA_WIDTH - padding)) / padding : 0;
    const topPressure = y < padding ? (padding - y) / padding : 0;
    const bottomPressure = y > ARENA_HEIGHT - padding ? (y - (ARENA_HEIGHT - padding)) / padding : 0;
    const vx = leftPressure - rightPressure;
    const vy = topPressure - bottomPressure;
    if (Math.hypot(vx, vy) < 0.01) return null;
    return normalizeVector(vx, vy);
  }

  private hasLinePressureTarget(player: PlayerState, enemy: PlayerState): boolean {
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance > PROJECTILE_MAX_RANGE * 0.9) return false;
    const carrying = this.isCarryingEnemyFlag(enemy);
    return carrying || distance < PROJECTILE_MAX_RANGE * 0.65;
  }

  private tryPickupOrReturnFlags(player: PlayerState): void {
    for (const flag of this.state.flags.values()) {
      if (Math.hypot(player.x - flag.x, player.y - flag.y) > FLAG_PICKUP_RADIUS) continue;

      const ownFlag = flag.team === player.team;
      if (ownFlag && !flag.atBase && !flag.carrierId) {
        this.resetFlagToBase(flag);
        player.score += 6;
        continue;
      }

      if (!ownFlag && !flag.carrierId) {
        flag.carrierId = player.id;
        flag.atBase = false;
      }
    }
  }

  private tryCaptureFlag(player: PlayerState): void {
    const playerTeam = this.asTeam(player.team);
    const ownFlag = this.getFlagByTeam(playerTeam);
    if (!ownFlag || !ownFlag.atBase) return;
    const carryingEnemyFlag = [...this.state.flags.values()].find((flag) => flag.team !== player.team && flag.carrierId === player.id);
    if (!carryingEnemyFlag) return;
    if (Math.hypot(player.x - ownFlag.homeX, player.y - ownFlag.homeY) > FLAG_PICKUP_RADIUS) return;

    if (playerTeam === TEAM_RED) this.state.redScore += FLAG_CAPTURE_SCORE;
    else this.state.blueScore += FLAG_CAPTURE_SCORE;
    player.score += 40;
    this.resetFlagToBase(carryingEnemyFlag);
  }

  private resetFlagToBase(flag: FlagState): void {
    flag.carrierId = "";
    flag.atBase = true;
    flag.x = flag.homeX;
    flag.y = flag.homeY;
  }

  private getFlagByTeam(team: Team): FlagState | undefined {
    for (const flag of this.state.flags.values()) {
      if (flag.team === team) return flag;
    }
    return undefined;
  }

  private asTeam(team: string): Team {
    if (team === TEAM_BLUE) return TEAM_BLUE;
    if (team === TEAM_GREEN) return TEAM_GREEN;
    if (team === TEAM_YELLOW) return TEAM_YELLOW;
    return TEAM_RED;
  }

  private isInsideMidfield(x: number, y: number): boolean {
    return Math.hypot(x - ARENA_WIDTH * 0.5, y - ARENA_HEIGHT * 0.5) <= MIDFIELD_RADIUS;
  }

  private isCarryingEnemyFlag(player: PlayerState): boolean {
    for (const flag of this.state.flags.values()) {
      if (flag.team !== player.team && flag.carrierId === player.id) return true;
    }
    return false;
  }
}
