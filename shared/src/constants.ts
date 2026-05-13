export const GAME_NAME = "Core Surge Grid Clash";
export const ROOM_NAME = "core-surge-grid-clash";
export const SERVER_TICK_RATE = 30;

export const MATCH_DURATION_MS = 240_000;
/** FFA rounds use this cap (flag score ends earlier). First {@link FFA_FRENZY_AFTER_MS} are normal; then frenzy rules apply. */
export const FFA_MATCH_DURATION_MS = 120_000;
/** FFA only: elapsed live time before 2× move speed and zero ammo / shot delays. */
export const FFA_FRENZY_AFTER_MS = 30_000;
export const ROUND_RESULTS_MS = 4_500;
/** Last portion of the match: larger capture ring and double neutral-flag score. */
export const ENDGAME_LAST_MS = 60_000;
export const WORLD_EVENT_INTERVAL_MS = 60_000;
export const WORLD_EVENT_DURATION_MS = 12_000;

export const ARENA_WIDTH = 12000;
export const ARENA_HEIGHT = 8250;
export const PLAYER_RADIUS = 13;
export const PLAYER_RESPAWN_MS = 2500;
export const PLAYER_BASE_ACCEL = 700;
export const PLAYER_MAX_SPEED = 310;
export const PLAYER_DRAG = 0.9985;
export const BOOST_DURATION_MS = 5000;
export const BOOST_SPEED_MULTIPLIER = 2.0;
export const BOOST_CHARGES_PER_LIFE = 4;
export const BOOST_COOLDOWN_MS = 10_000;
/** Spike slow lingers this long after a hit, at {@link SPIKE_SLOW_MULTIPLIER} of normal speed. */
export const SPIKE_SLOW_DURATION_MS = 10_000;
/** Speed factor while in the 10s spike slow window. 0.25 = 75% slower. */
export const SPIKE_SLOW_MULTIPLIER = 0.25;
/** Speed factor for the per-round permanent penalty after first spike hit. 0.75 = 25% slower. */
export const SPIKE_PERM_SLOW_MULTIPLIER = 0.75;
export const MAX_BOTS = 8;
export const DESIRED_PLAYERS = 6;
export const INPUT_SEND_RATE_MS = 50;
export const PICKUP_RESPAWN_MS = 7000;
export const PICKUP_RADIUS = 54;
export const PUSH_COOLDOWN_MS = 700;
export const PROJECTILE_SPEED = 1960;
export const PROJECTILE_RADIUS = 135;
export const PROJECTILE_MAX_RANGE = 920;
/** Tuned down vs older builds: smaller splash radius fights feel less like one giant scrum. */
export const PROJECTILE_EXPLOSION_RADIUS = 340;
/** Knockback impulse on blast hits (higher = stronger shove). */
export const PROJECTILE_EXPLOSION_FORCE = 560_000;
/** Shooter knockback when firing (velocity delta opposite aim; applied after speed clamp). Keep moderate so large sim steps do not wall-splat the shooter. */
export const PROJECTILE_SHOOTER_RECOIL = 3200;
export const CAPTURE_RADIUS = 220;
export const CAPTURE_DURATION_MS = 5200;
export const ROUND_COUNTDOWN_MS = 3000;
export const SPEED_POWERUP_DURATION_MS = 3200;
export const EXTRA_BULLET_CHARGES = 2;
export const SAFE_ZONE_SIZE = PLAYER_RADIUS * 35;
export const SPIKE_COUNT = 5;
export const SPIKE_RADIUS = PLAYER_RADIUS * 2.7;
export const SPIKE_STUN_MS = 1000;
export const SPIKE_DRIFT_SPEED = 30;

export interface InputState {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  boost: boolean;
  fire: boolean;
}

/** `ffa` is solo FFA (octagon, 8 vertex bases). `team_ctf` is 2-team CTF (rectangle, red vs blue). `race` is 8-player rectangle race-to-the-flag. `sandbox` is an internal/dev mode. */
export type GameModeId = "sandbox" | "ffa" | "team_ctf" | "race";

export interface JoinOptions {
  name?: string;
  /** Sandbox = rectangle arena. FFA = same capture-the-flag + center ring rules on an octagon. */
  mode?: GameModeId;
}

export type PickupKind = "speed" | "ammo" | "shield" | "magnet" | "repel";
export type MatchPhase = "countdown" | "live" | "results";
export type Team = "red" | "blue" | "green" | "yellow";
/** Legacy 8-slot team ids (schema); live FFA uses red/blue/green/yellow on the octagon. */
export type FfaTeamId = "ffa0" | "ffa1" | "ffa2" | "ffa3" | "ffa4" | "ffa5" | "ffa6" | "ffa7";
export const FFA_TEAM_IDS: readonly FfaTeamId[] = ["ffa0", "ffa1", "ffa2", "ffa3", "ffa4", "ffa5", "ffa6", "ffa7"];

export const EMPTY_INPUT: InputState = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: false };

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeVector(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}
