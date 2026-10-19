import { expect, test } from 'vitest';
import { buildFlowField, nextStep } from '../src/flowfield.ts';
import { parseMap } from '../src/map.ts';

const open = parseMap([
  '#######',
  '#.....#',
  '#.....#',
  '#.....#',
  '#######',
]);
const at = (f: Float32Array, m: { w: number }, tx: number, ty: number) => f[ty * m.w + tx];

test('distances grow away from every source', () => {
  const f = buildFlowField(open, [{ tx: 1, ty: 1 }, { tx: 5, ty: 3 }]);
  expect(at(f, open, 1, 1)).toBe(0);
  expect(at(f, open, 5, 3)).toBe(0);
  expect(at(f, open, 2, 1)).toBeCloseTo(1);
  expect(at(f, open, 3, 2)).toBeGreaterThan(at(f, open, 2, 1));
});

test('walls force a detour, unreachable cells are Infinity', () => {
  const m = parseMap([
    '#######',
    '#..#..#',
    '#..#..#',
    '#.....#',
    '#######',
    '#.#####',
    '#######',
  ]);
  const f = buildFlowField(m, [{ tx: 1, ty: 1 }]);
  expect(at(f, m, 4, 1)).toBeGreaterThan(3); // Manhattan distance is 3
  expect(at(f, m, 1, 5)).toBe(Infinity);
});

test('no corner cutting between two walls', () => {
  const m = parseMap([
    '#####',
    '#.#.#',
    '##..#',
    '#####',
  ]);
  const f = buildFlowField(m, [{ tx: 1, ty: 1 }]);
  // (2,2) is diagonal to (1,1) but both orthogonal neighbours are walls
  expect(at(f, m, 2, 2)).toBe(Infinity);
});

test('every floor cell of the game map is reached from the centre', () => {
  const m = parseMap();
  const f = buildFlowField(m, [{ tx: 17, ty: 16 }]);
  for (let i = 0; i < f.length; i++) if (!m.solid[i]) expect(f[i]).toBeLessThan(Infinity);
});

test('nextStep moves to the lowest neighbour', () => {
  const f = buildFlowField(open, [{ tx: 1, ty: 1 }]);
  expect(nextStep(f, open, 5, 3)).toEqual({ tx: 4, ty: 2 });
  expect(nextStep(f, open, 1, 1)).toBeNull();
});
