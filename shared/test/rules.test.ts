import { expect, test } from 'vitest';
import { COMBO, STARTING_AMMO, WEAPONS } from '../src/config.ts';
import { registerKill, tickCombo, waveComposition } from '../src/rules.ts';

const fresh = () => ({ combo: 0, comboTime: 0, score: 0, ammo: [...STARTING_AMMO] });

test('registerKill raises combo, multiplies points and unlocks in order', () => {
  const p = fresh();
  for (let i = 0; i < 4; i++) expect(registerKill(p, 10)).toEqual([]);
  expect(p.score).toBe(40);
  expect(registerKill(p, 10)).toEqual([1]); // 5th kill: x2, uzi
  expect(p.score).toBe(60);
  expect(p.ammo[1]).toBe(WEAPONS[1].ammo);
  expect(p.comboTime).toBe(COMBO.window);
  for (let i = 0; i < 4; i++) registerKill(p, 10);
  expect(registerKill(p, 10)).toEqual([2]); // 10th kill: x3, shotgun
  p.ammo[1] = 0;
  registerKill(p, 10);
  expect(p.ammo[1]).toBe(0); // never re-unlocked
});

test('tickCombo resets the combo when the window runs out', () => {
  const p = fresh();
  registerKill(p, 10);
  tickCombo(p, COMBO.window / 2);
  expect(p.combo).toBe(1);
  tickCombo(p, COMBO.window);
  expect(p.combo).toBe(0);
  expect(p.comboTime).toBe(0);
});

test('waveComposition grows with wave and players, devils capped at 40%', () => {
  const total = (c: { zombies: number; devils: number }) => c.zombies + c.devils;
  expect(waveComposition(1, 1).devils).toBe(0);
  expect(total(waveComposition(2, 1))).toBeGreaterThan(total(waveComposition(1, 1)));
  expect(total(waveComposition(3, 4))).toBeGreaterThan(total(waveComposition(3, 1)));
  const late = waveComposition(30, 2);
  expect(late.devils).toBeGreaterThan(0);
  expect(late.devils / total(late)).toBeLessThanOrEqual(0.4);
});
