import { expect, test } from 'vitest';
import { TILE } from '../src/config.ts';
import { parseMap } from '../src/map.ts';
import { circlesOverlap, moveCircle, raycast } from '../src/physics.ts';

// 6x5 room, wall column at x=3 except a gap at y=3
const map = parseMap([
  '######',
  '#..#.#',
  '#..#.#',
  '#....#',
  '######',
]);
const c = (t: number) => t * TILE + TILE / 2;
const none = () => false;

test('moveCircle slides along a wall without entering it', () => {
  const pos = { x: c(2), y: c(1) };
  for (let i = 0; i < 60; i++) moveCircle(map, none, pos, 1, 0, 150, 12, 1 / 30);
  expect(pos.x + 12).toBeLessThanOrEqual(3 * TILE);
  // diagonal into the top-left corner keeps both axes outside the walls
  const p2 = { x: c(1), y: c(2) };
  for (let i = 0; i < 60; i++) moveCircle(map, none, p2, -1, -1, 150, 12, 1 / 30);
  expect(p2.x - 12).toBeGreaterThanOrEqual(TILE);
  expect(p2.y - 12).toBeGreaterThanOrEqual(TILE);
});

test('moveCircle respects the extra blocked callback', () => {
  const pos = { x: c(1), y: c(3) };
  const blocked = (tx: number, ty: number) => tx === 2 && ty === 3;
  for (let i = 0; i < 60; i++) moveCircle(map, blocked, pos, 1, 0, 150, 12, 1 / 30);
  expect(pos.x + 12).toBeLessThanOrEqual(2 * TILE);
});

test('raycast stops at walls', () => {
  const r = raycast(map, c(1), c(1), 1, 0, 400, []);
  expect(r.hit).toBeUndefined();
  expect(r.endX).toBeCloseTo(3 * TILE);
});

test('raycast hits the nearest circle and ignores circles behind walls', () => {
  const near = { x: c(2), y: c(3), radius: 10 };
  const far = { x: c(4), y: c(3), radius: 10 };
  expect(raycast(map, c(1), c(3), 1, 0, 400, [far, near]).hit).toBe(near);
  const behind = { x: c(4), y: c(1), radius: 10 };
  expect(raycast(map, c(1), c(1), 1, 0, 400, [behind]).hit).toBeUndefined();
});

test('circlesOverlap', () => {
  expect(circlesOverlap({ x: 0, y: 0 }, 5, { x: 9, y: 0 }, 5)).toBe(true);
  expect(circlesOverlap({ x: 0, y: 0 }, 5, { x: 11, y: 0 }, 5)).toBe(false);
});
