import { expect, test } from 'vitest';
import { MAP, isSolid, parseMap } from '../src/map.ts';

const map = parseMap(MAP);

test('map is 40x30 with a closed border', () => {
  expect([map.w, map.h]).toEqual([40, 30]);
  for (let x = 0; x < map.w; x++) expect(isSolid(map, x, 0) && isSolid(map, x, map.h - 1)).toBe(true);
  for (let y = 0; y < map.h; y++) expect(isSolid(map, 0, y) && isSolid(map, map.w - 1, y)).toBe(true);
});

test('has enough spawns, all reachable floor', () => {
  expect(map.playerSpawns.length).toBeGreaterThanOrEqual(4);
  expect(map.enemySpawns.length).toBeGreaterThanOrEqual(6);
  const seen = new Set<number>();
  const start = map.playerSpawns[0];
  const queue = [start.ty * map.w + start.tx];
  seen.add(queue[0]);
  while (queue.length) {
    const i = queue.shift()!;
    const x = i % map.w, y = Math.floor(i / map.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (y + dy) * map.w + x + dx;
      if (!isSolid(map, x + dx, y + dy) && !seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  for (const s of [...map.playerSpawns, ...map.enemySpawns]) {
    expect(isSolid(map, s.tx, s.ty)).toBe(false);
    expect(seen.has(s.ty * map.w + s.tx)).toBe(true);
  }
});
