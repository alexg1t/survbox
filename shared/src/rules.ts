import { COMBO, LOCKED, WEAPONS } from './config.ts';

export interface Scorer {
  combo: number;
  comboTime: number;
  score: number;
  ammo: { [i: number]: number };
}

export const multiplierOf = (combo: number) => 1 + Math.floor(combo / COMBO.perLevel);

// Credits a kill: combo +1, points x multiplier, unlocks weapons whose threshold is reached.
// Returns the indices of newly unlocked weapons (FR-022..FR-025).
export function registerKill(p: Scorer, points: number): number[] {
  p.combo += 1;
  p.comboTime = COMBO.window;
  const m = multiplierOf(p.combo);
  p.score += points * m;
  const unlocked: number[] = [];
  WEAPONS.forEach((w, i) => {
    if (p.ammo[i] === LOCKED && m >= w.unlockMultiplier) {
      p.ammo[i] = w.ammo;
      unlocked.push(i);
    }
  });
  return unlocked;
}

export function tickCombo(p: Scorer, dt: number): void {
  if (p.comboTime <= 0) return;
  p.comboTime = Math.max(0, p.comboTime - dt);
  if (p.comboTime === 0) p.combo = 0;
}

export function waveComposition(n: number, players: number): { zombies: number; devils: number } {
  const total = Math.round((8 + 4 * n) * (1 + 0.5 * (Math.max(1, players) - 1)));
  const devils = Math.floor(total * Math.min(0.05 * (n - 1), 0.4));
  return { zombies: total - devils, devils };
}

export interface Blast { x: number; y: number; r: number }

// Chain reaction: every barrel inside a blast radius explodes too (FR-027).
// Returns the origins followed by the chained barrels, in explosion order.
export function resolveExplosions<B extends Blast>(origins: B[], barrels: B[]): B[] {
  const out = [...origins];
  const left = new Set(barrels);
  for (let i = 0; i < out.length; i++) {
    const b = out[i];
    for (const barrel of left) {
      if (Math.hypot(barrel.x - b.x, barrel.y - b.y) <= b.r) {
        left.delete(barrel);
        out.push(barrel);
      }
    }
  }
  return out;
}
