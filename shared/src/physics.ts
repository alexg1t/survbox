import { TILE } from './config.ts';
import { type GameMap, isSolid } from './map.ts';

export interface Vec { x: number; y: number }
export interface Circle extends Vec { radius: number }
export type Blocked = (tx: number, ty: number) => boolean;

// Moves pos by (dx, dy) * speed * dt, resolving x then y against solid tiles.
// The body is treated as a square of half-size `radius`. Steps must stay below one tile.
export function moveCircle(
  map: GameMap, blocked: Blocked, pos: Vec, dx: number, dy: number, speed: number, radius: number, dt: number,
): void {
  if (!dx && !dy) return;
  const step = (speed * dt) / Math.hypot(dx, dy);
  pos.x = sweep(map, blocked, pos.x, pos.y, dx * step, radius, true);
  pos.y = sweep(map, blocked, pos.y, pos.x, dy * step, radius, false);
}

function sweep(
  map: GameMap, blocked: Blocked, v: number, other: number, delta: number, r: number, xAxis: boolean,
): number {
  if (!delta) return v;
  const next = v + delta;
  const lead = Math.floor((delta > 0 ? next + r : next - r) / TILE);
  const from = Math.floor((other - r) / TILE);
  const to = Math.floor((other + r - 1e-6) / TILE);
  for (let o = from; o <= to; o++) {
    const [tx, ty] = xAxis ? [lead, o] : [o, lead];
    if (isSolid(map, tx, ty) || blocked(tx, ty)) {
      return delta > 0 ? lead * TILE - r - 1e-3 : (lead + 1) * TILE + r + 1e-3;
    }
  }
  return next;
}

// Distance along a unit direction until the first solid tile (grid DDA), capped at range.
function wallDistance(map: GameMap, x: number, y: number, dx: number, dy: number, range: number): number {
  let tx = Math.floor(x / TILE);
  let ty = Math.floor(y / TILE);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const deltaX = dx ? Math.abs(TILE / dx) : Infinity;
  const deltaY = dy ? Math.abs(TILE / dy) : Infinity;
  let maxX = dx ? (dx > 0 ? (tx + 1) * TILE - x : x - tx * TILE) / Math.abs(dx) : Infinity;
  let maxY = dy ? (dy > 0 ? (ty + 1) * TILE - y : y - ty * TILE) / Math.abs(dy) : Infinity;
  for (;;) {
    let t: number;
    if (maxX < maxY) { t = maxX; maxX += deltaX; tx += stepX; } else { t = maxY; maxY += deltaY; ty += stepY; }
    if (t >= range) return range;
    if (isSolid(map, tx, ty)) return t;
  }
}

// Casts a ray from (x, y) along the unit vector (dx, dy). Returns the nearest target hit before a wall.
export function raycast<T extends Circle>(
  map: GameMap, x: number, y: number, dx: number, dy: number, range: number, targets: Iterable<T>,
): { hit?: T; endX: number; endY: number } {
  let best = wallDistance(map, x, y, dx, dy, range);
  let hit: T | undefined;
  for (const c of targets) {
    const ox = c.x - x;
    const oy = c.y - y;
    const proj = ox * dx + oy * dy;
    if (proj < 0) continue;
    const d2 = ox * ox + oy * oy - proj * proj;
    const r2 = c.radius * c.radius;
    if (d2 > r2) continue;
    const t = Math.max(0, proj - Math.sqrt(r2 - d2));
    if (t < best) { best = t; hit = c; }
  }
  return { hit, endX: x + dx * best, endY: y + dy * best };
}

export function circlesOverlap(a: Vec, ra: number, b: Vec, rb: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < (ra + rb) * (ra + rb);
}
