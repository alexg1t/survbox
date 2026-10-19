import { type GameMap, type Tile, isSolid } from './map.ts';

const NEIGHBOURS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const;

// A diagonal move is allowed only when both orthogonal cells are open (no corner cutting).
function canStep(map: GameMap, tx: number, ty: number, dx: number, dy: number): boolean {
  if (isSolid(map, tx + dx, ty + dy)) return false;
  return !(dx && dy) || (!isSolid(map, tx + dx, ty) && !isSolid(map, tx, ty + dy));
}

// Multi-source Dijkstra over the tile grid. extraCost is added when entering a cell.
export function buildFlowField(
  map: GameMap, sources: Tile[], extraCost: (tx: number, ty: number) => number = () => 0,
): Float32Array {
  const dist = new Float32Array(map.w * map.h).fill(Infinity);
  // ponytail: plain binary heap, fine for 1200 cells
  const heap: [number, number][] = [];
  const push = (d: number, i: number) => {
    heap.push([d, i]);
    for (let c = heap.length - 1; c > 0;) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let p = 0; ;) {
        const l = p * 2 + 1, r = l + 1;
        let m = p;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]];
        p = m;
      }
    }
    return top;
  };

  for (const s of sources) {
    const i = s.ty * map.w + s.tx;
    if (dist[i] !== 0) { dist[i] = 0; push(0, i); }
  }
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i]) continue;
    const tx = i % map.w, ty = (i - tx) / map.w;
    for (const [dx, dy, cost] of NEIGHBOURS) {
      if (!canStep(map, tx, ty, dx, dy)) continue;
      const n = i + dy * map.w + dx;
      const nd = d + cost + extraCost(tx + dx, ty + dy);
      if (nd < dist[n]) { dist[n] = nd; push(nd, n); }
    }
  }
  return dist;
}

// Neighbour with the lowest distance, or null when already at a local minimum.
export function nextStep(field: Float32Array, map: GameMap, tx: number, ty: number): Tile | null {
  let best = field[ty * map.w + tx];
  let step: Tile | null = null;
  for (const [dx, dy] of NEIGHBOURS) {
    if (!canStep(map, tx, ty, dx, dy)) continue;
    const d = field[(ty + dy) * map.w + tx + dx];
    if (d < best) { best = d; step = { tx: tx + dx, ty: ty + dy }; }
  }
  return step;
}
