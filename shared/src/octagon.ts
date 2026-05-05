import { ARENA_HEIGHT, ARENA_WIDTH, FFA_TEAM_IDS, PLAYER_RADIUS, clamp } from "./constants";

/** Classic sandbox teams on rectangle map (not FFA octagon slots). */
const OCTAGON_SANDBOX_VERTEX_BY_TEAM: Readonly<Record<string, number>> = {
  red: 0,
  blue: 2,
  green: 4,
  yellow: 6,
};

/** Large octagon playfield (center → vertex). */
export const FFA_OCTAGON_RADIUS = Math.min(ARENA_WIDTH, ARENA_HEIGHT) * 0.64;
/** Legacy / large zone radius (rectangle sandbox corners). */
export const FFA_BASE_ZONE_RADIUS = PLAYER_RADIUS * 26;
/** Small capture ring at each octagon vertex (FFA). */
export const FFA_CORNER_BASE_ZONE_RADIUS = PLAYER_RADIUS * 12;
export const FFA_OCTAGON_CENTER_X = ARENA_WIDTH * 0.5;
export const FFA_OCTAGON_CENTER_Y = ARENA_HEIGHT * 0.5;

const OCT_EDGES = 8;

export type OctagonVertex = { x: number; y: number };

export function octagonVertices(cx: number, cy: number, radius: number): OctagonVertex[] {
  const out: OctagonVertex[] = [];
  for (let i = 0; i < OCT_EDGES; i += 1) {
    const a = -Math.PI / 2 + (i * (2 * Math.PI)) / OCT_EDGES;
    out.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  }
  return out;
}

/** Base camp centers slightly inset from each vertex toward the arena center. */
export function ffaBaseCenters(cx: number, cy: number, radius: number, inset = 0.1): OctagonVertex[] {
  return octagonVertices(cx, cy, radius).map((v) => {
    const dx = cx - v.x;
    const dy = cy - v.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: v.x + (dx / d) * radius * inset, y: v.y + (dy / d) * radius * inset };
  });
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** True if point lies inside convex octagon (same vertices as octagonVertices). */
export function pointInOctagon(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  const v = octagonVertices(cx, cy, radius);
  for (let i = 0; i < v.length; i += 1) {
    const a = v[i]!;
    const b = v[(i + 1) % v.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const ref = cross(ex, ey, cx - a.x, cy - a.y);
    const cp = cross(ex, ey, px - a.x, py - a.y);
    if (Math.abs(ref) < 1e-8) continue;
    if (cp * ref < 0) return false;
  }
  return true;
}

/** Clamp position to stay inside octagon; if inside, unchanged. */
export function clampToOctagon(px: number, py: number, cx: number, cy: number, radius: number): { x: number; y: number } {
  if (pointInOctagon(px, py, cx, cy, radius - PLAYER_RADIUS)) {
    return { x: px, y: py };
  }
  const v = octagonVertices(cx, cy, radius - PLAYER_RADIUS);
  let bestX = px;
  let bestY = py;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < v.length; i += 1) {
    const a = v[i]!;
    const b = v[(i + 1) % v.length]!;
    const { x, y } = closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
    const d = Math.hypot(px - x, py - y);
    if (d < bestD) {
      bestD = d;
      bestX = x;
      bestY = y;
    }
  }
  return { x: bestX, y: bestY };
}

/** Home base for octagon “FFA” mode (four teams, sandbox-style rules). */
export function octagonSandboxTeamHome(team: string): { x: number; y: number } | null {
  const vi = OCTAGON_SANDBOX_VERTEX_BY_TEAM[team];
  if (vi === undefined) return null;
  const bases = ffaBaseCenters(FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, FFA_OCTAGON_RADIUS, 0.11);
  const p = bases[vi];
  return p ? { x: p.x, y: p.y } : null;
}

/** FFA octagon: one base per vertex (`ffa0`…`ffa7`). Sandbox colors use {@link octagonSandboxTeamHome}. */
export function ffaTeamHomeCenter(team: string): { x: number; y: number } | null {
  const idx = FFA_TEAM_IDS.indexOf(team as (typeof FFA_TEAM_IDS)[number]);
  if (idx >= 0) {
    const bases = ffaBaseCenters(FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, FFA_OCTAGON_RADIUS, 0.11);
    const p = bases[idx];
    return p ? { x: p.x, y: p.y } : null;
  }
  return octagonSandboxTeamHome(team);
}

function closestPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number } {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c2 = vx * vx + vy * vy;
  const t = c2 < 1e-8 ? 0 : clamp((wx * vx + wy * vy) / c2, 0, 1);
  return { x: x1 + t * vx, y: y1 + t * vy };
}
