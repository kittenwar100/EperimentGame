import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  FFA_CORNER_BASE_ZONE_RADIUS,
  FFA_TEAM_IDS,
  PLAYER_RADIUS,
  SAFE_ZONE_SIZE,
  ffaTeamHomeCenter,
  type ArenaState,
  type PlayerState,
} from "@shared";

const NEUTRAL_FLAG_ID = "flag-neutral";
const RACE_SPAWN_BAND_MAX_X = ARENA_WIDTH * 0.12;
const RACE_FLAG_HOME_X = ARENA_WIDTH * 0.92;
const RACE_FLAG_HOME_Y = ARENA_HEIGHT * 0.5;

function isFfaMode(state: ArenaState): boolean {
  return state.gameMode === "ffa";
}

function teamHomeCenter(team: string, gameMode?: string): { x: number; y: number } {
  if (gameMode === "ffa") {
    const o = ffaTeamHomeCenter(team);
    if (o) return o;
  }
  if (gameMode === "race") {
    return { x: (PLAYER_RADIUS + RACE_SPAWN_BAND_MAX_X) * 0.5, y: ARENA_HEIGHT * 0.5 };
  }
  const baseMinX = PLAYER_RADIUS;
  const baseMinY = PLAYER_RADIUS;
  const baseMaxX = ARENA_WIDTH - PLAYER_RADIUS;
  const baseMaxY = ARENA_HEIGHT - PLAYER_RADIUS;
  const half = SAFE_ZONE_SIZE * 0.5;
  if (gameMode === "team_ctf") {
    if (team === "blue") return { x: baseMaxX - half, y: baseMaxY - half };
    return { x: baseMinX + half, y: baseMinY + half };
  }
  if (team === "blue") return { x: baseMaxX - half, y: baseMinY + half };
  if (team === "green") return { x: baseMinX + half, y: baseMaxY - half };
  if (team === "yellow") return { x: baseMaxX - half, y: baseMaxY - half };
  return { x: baseMinX + half, y: baseMinY + half };
}

/** Where to point the player and a short HUD line for the neutral-flag mode. */
export function getObjectiveWorldTarget(state: ArenaState, local: PlayerState): { x: number; y: number; hint: string } {
  const neutral = state.flags.get(NEUTRAL_FLAG_ID);
  const home = teamHomeCenter(local.team, state.gameMode);

  if (neutral?.carrierId === local.id) {
    if (state.gameMode === "race") {
      return { x: home.x, y: home.y, hint: "Bring the flag back to the spawn band to win" };
    }
    return {
      x: home.x,
      y: home.y,
      hint: isFfaMode(state) ? "Run to your base ring on the octagon to score" : "Run to your corner zone to score",
    };
  }

  if (neutral?.carrierId) {
    const carrier = state.players.get(neutral.carrierId);
    if (carrier?.alive) {
      const steal = neutral.carrierId !== local.id;
      return {
        x: carrier.x,
        y: carrier.y,
        hint: steal ? "Enemy has the flag — direct blast steals it" : "",
      };
    }
  }

  if (neutral && !neutral.carrierId) {
    return {
      x: neutral.x,
      y: neutral.y,
      hint: state.gameMode === "race" ? "Race to the flag on the far side" : "Pick up the neutral flag at center",
    };
  }

  return {
    x: state.captureX,
    y: state.captureY,
    hint: "Hold the center circle — majority wins the round",
  };
}

/** True when the point lies inside another team's corner safe zone. */
export function isInEnemySafeZone(
  worldX: number,
  worldY: number,
  myTeam: string,
  state?: Pick<ArenaState, "gameMode">,
): boolean {
  if (state?.gameMode === "ffa") {
    for (const tid of FFA_TEAM_IDS) {
      if (tid === myTeam) continue;
      const c = ffaTeamHomeCenter(tid);
      if (!c) continue;
      if (Math.hypot(worldX - c.x, worldY - c.y) < FFA_CORNER_BASE_ZONE_RADIUS) return true;
    }
    return false;
  }
  // Race mode has a shared spawn band, no enemy safe zones to flag.
  if (state?.gameMode === "race") return false;
  const baseMinX = PLAYER_RADIUS;
  const baseMinY = PLAYER_RADIUS;
  const baseMaxX = ARENA_WIDTH - PLAYER_RADIUS;
  const baseMaxY = ARENA_HEIGHT - PLAYER_RADIUS;
  const allZones: Array<{ team: string; minX: number; minY: number; maxX: number; maxY: number }> = [
    { team: "red", minX: baseMinX, minY: baseMinY, maxX: baseMinX + SAFE_ZONE_SIZE, maxY: baseMinY + SAFE_ZONE_SIZE },
    { team: "blue", minX: baseMaxX - SAFE_ZONE_SIZE, minY: baseMinY, maxX: baseMaxX, maxY: baseMinY + SAFE_ZONE_SIZE },
    { team: "green", minX: baseMinX, minY: baseMaxY - SAFE_ZONE_SIZE, maxX: baseMinX + SAFE_ZONE_SIZE, maxY: baseMaxY },
    { team: "yellow", minX: baseMaxX - SAFE_ZONE_SIZE, minY: baseMaxY - SAFE_ZONE_SIZE, maxX: baseMaxX, maxY: baseMaxY },
  ];
  // Team CTF places blue at bottom-right (matches server initializeTeamCtfFlags layout).
  const zones = state?.gameMode === "team_ctf"
    ? [
        { team: "red", minX: baseMinX, minY: baseMinY, maxX: baseMinX + SAFE_ZONE_SIZE, maxY: baseMinY + SAFE_ZONE_SIZE },
        { team: "blue", minX: baseMaxX - SAFE_ZONE_SIZE, minY: baseMaxY - SAFE_ZONE_SIZE, maxX: baseMaxX, maxY: baseMaxY },
      ]
    : allZones;
  return zones.some(
    (z) =>
      z.team !== myTeam &&
      worldX > z.minX &&
      worldX < z.maxX &&
      worldY > z.minY &&
      worldY < z.maxY,
  );
}

/** Screen position for an objective marker; if the target is off-screen, clamp to viewport edge. */
export function objectiveScreenMarker(
  screenW: number,
  screenH: number,
  screenX: number,
  screenY: number,
  margin: number,
): { drawX: number; drawY: number; offScreen: boolean } {
  const inside =
    screenX >= margin && screenX <= screenW - margin && screenY >= margin && screenY <= screenH - margin;
  if (inside) return { drawX: screenX, drawY: screenY, offScreen: false };

  const cx = screenW * 0.5;
  const cy = screenH * 0.5;
  const dx = screenX - cx;
  const dy = screenY - cy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const maxT = Math.min(
    nx > 1e-6 ? (screenW - margin - cx) / nx : Number.POSITIVE_INFINITY,
    nx < -1e-6 ? (margin - cx) / nx : Number.POSITIVE_INFINITY,
    ny > 1e-6 ? (screenH - margin - cy) / ny : Number.POSITIVE_INFINITY,
    ny < -1e-6 ? (margin - cy) / ny : Number.POSITIVE_INFINITY,
  );
  const t = Math.max(0, Math.min(maxT, len));
  return { drawX: cx + nx * t, drawY: cy + ny * t, offScreen: true };
}
