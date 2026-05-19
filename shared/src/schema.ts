import { schema } from "@colyseus/schema";

export const PlayerState = schema({
  id: "string",
  name: "string",
  isBot: "boolean",
  team: "string",
  alive: "boolean",
  x: "number",
  y: "number",
  vx: "number",
  vy: "number",
  rotation: "number",
  hp: "number",
  boostMs: "number",
  speedBoostMs: "number",
  stunnedMs: "number",
  pushCooldownMs: "number",
  bulletCharges: "number",
  respawnMs: "number",
  /** Ms remaining of the 10s 75% slow from a spike hit. */
  spikeSlowMs: "number",
  /** Legacy field; no longer written by the server. Cleared on round restart. */
  spikePermSlow: "boolean",
  /** Boost charges remaining this life. Refilled to BOOST_CHARGES_PER_LIFE on respawn. */
  boostCharges: "number",
  /** Ms remaining of the post-boost cooldown. While > 0, boost cannot start. */
  boostCooldownMs: "number",
  vehicleClass: "string",
  score: "number",
  streak: "number",
  zoneTicks: "number",
  color: "number",
  basePerkMs: "number",
  shieldHits: "number",
  magnetMs: "number",
  repelMs: "number",
  challengeCaps: "number",
  challengeSteals: "number",
  challengeTier: "number",
  /** Flag caps + center-ring round wins this match (session). */
  wins: "number",
}, "PlayerState");
export type PlayerState = InstanceType<typeof PlayerState>;

export const ZoneState = schema({
  id: "string",
  x: "number",
  y: "number",
  radius: "number",
  controllerId: "string",
  captureProgress: "number",
  scoreTickMs: "number",
}, "ZoneState");
export type ZoneState = InstanceType<typeof ZoneState>;

export const FlagState = schema({
  id: "string",
  team: "string",
  x: "number",
  y: "number",
  homeX: "number",
  homeY: "number",
  carrierId: "string",
  atBase: "boolean",
  carryAgeMs: "number",
  /** Ms remaining where bump/projectile steals from this carrier are blocked. */
  stealProtectionMs: "number",
}, "FlagState");
export type FlagState = InstanceType<typeof FlagState>;

export const ProjectileState = schema({
  id: "string",
  ownerId: "string",
  team: "string",
  x: "number",
  y: "number",
  vx: "number",
  vy: "number",
  traveled: "number",
  radius: "number",
}, "ProjectileState");
export type ProjectileState = InstanceType<typeof ProjectileState>;

export const PickupState = schema({
  id: "string",
  kind: "string",
  x: "number",
  y: "number",
  active: "boolean",
  respawnAtMs: "number",
}, "PickupState");
export type PickupState = InstanceType<typeof PickupState>;

export const SpikeState = schema({
  id: "string",
  x: "number",
  y: "number",
  radius: "number",
  vx: "number",
  vy: "number",
  /** "standard" stun; "pull" drags players inward before stun. */
  spikeKind: "string",
}, "SpikeState");
export type SpikeState = InstanceType<typeof SpikeState>;

export const SlowZoneState = schema({
  id: "string",
  x: "number",
  y: "number",
  radius: "number",
  expiresAtElapsedMs: "number",
}, "SlowZoneState");
export type SlowZoneState = InstanceType<typeof SlowZoneState>;

export const ArenaState = schema({
  players: { map: PlayerState },
  pickups: { map: PickupState },
  spikes: { map: SpikeState },
  slowZones: { map: SlowZoneState },
  flags: { map: FlagState },
  projectiles: { map: ProjectileState },
  elapsedMs: "number",
  matchDurationMs: "number",
  phase: "string",
  redScore: "number",
  blueScore: "number",
  greenScore: "number",
  yellowScore: "number",
  roundNumber: "number",
  countdownMs: "number",
  captureX: "number",
  captureY: "number",
  captureRadius: "number",
  captureTeam: "string",
  captureProgress: "number",
  /** 0–2 layout index for client map palette. */
  mapTheme: "number",
  /** "", "low_gravity", "surge_ammo", "midfield_sting" */
  worldEvent: "string",
  worldEventEndsAtElapsedMs: "number",
  /** 0 default, 1 shrinking ring, 2 drifting center */
  captureVariant: "number",
  captureAnchorX: "number",
  captureAnchorY: "number",
  neutralCarrierPing: "boolean",
  gameMode: "string",
  ffa0Score: "number",
  ffa1Score: "number",
  ffa2Score: "number",
  ffa3Score: "number",
  ffa4Score: "number",
  ffa5Score: "number",
  ffa6Score: "number",
  ffa7Score: "number",
  mutatorA: "string",
  mutatorB: "string",
  pickupDash0: "number",
  pickupDash1: "number",
  pickupDash2: "number",
  pickupDash3: "number",
  pickupDash4: "number",
  pickupDash5: "number",
  pickupDash6: "number",
  pickupDash7: "number",
}, "ArenaState");
export type ArenaState = InstanceType<typeof ArenaState>;
