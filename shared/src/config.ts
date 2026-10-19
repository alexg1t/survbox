// Static game data. Balance values from research R12; tune here only.

export const TILE = 32;
export const TICK_HZ = 30;
export const PATCH_MS = 50;

export const PLAYER = { hp: 100, speed: 150, radius: 12 };

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  radius: number;
  meleeDamage: number;
  meleeEvery: number;
  points: number;
  fireDamage?: number;
  fireEvery?: number;
  fireRange?: number;
  fireSpeed?: number;
}

export const ZOMBIE = 0;
export const DEVIL = 1;

export const ENEMIES: EnemyDef[] = [
  { name: 'zombie', hp: 30, speed: 70, radius: 12, meleeDamage: 10, meleeEvery: 1, points: 10 },
  {
    name: 'devil', hp: 80, speed: 105, radius: 13, meleeDamage: 15, meleeEvery: 1, points: 30,
    fireDamage: 15, fireEvery: 2.5, fireRange: 350, fireSpeed: 250,
  },
];

export type WeaponKind = 'hitscan' | 'thrown' | 'placeable';

export interface WeaponDef {
  name: string;
  kind: WeaponKind;
  damage: number;
  rate: number; // shots per second
  range: number;
  pellets: number;
  spread: number; // total fan angle in radians
  radius: number; // explosion radius
  ammo: number; // allotment on unlock; -2 = infinite
  unlockMultiplier: number;
  place?: number; // placeable kind
}

export const BARRICADE = 0;
export const BARREL = 1;
export const MINE = 2;
export const PLACEABLE_HP = [150, 1, 0];

export const INFINITE = -2;
export const LOCKED = -1;

// Index = weapon id = number key - 1. Order is the unlock order (FR-024).
export const WEAPONS: WeaponDef[] = [
  { name: 'Pistola', kind: 'hitscan', damage: 15, rate: 3, range: 400, pellets: 1, spread: 0, radius: 0, ammo: INFINITE, unlockMultiplier: 1 },
  { name: 'Uzi', kind: 'hitscan', damage: 10, rate: 10, range: 380, pellets: 1, spread: 0, radius: 0, ammo: 150, unlockMultiplier: 2 },
  { name: 'Escopeta', kind: 'hitscan', damage: 10, rate: 1.2, range: 220, pellets: 7, spread: Math.PI / 6, radius: 0, ammo: 30, unlockMultiplier: 3 },
  { name: 'Barricada', kind: 'placeable', damage: 0, rate: 3, range: 0, pellets: 0, spread: 0, radius: 0, ammo: 10, unlockMultiplier: 4, place: BARRICADE },
  { name: 'Granadas', kind: 'thrown', damage: 80, rate: 1.5, range: 200, pellets: 0, spread: 0, radius: 90, ammo: 10, unlockMultiplier: 5 },
  { name: 'Barril', kind: 'placeable', damage: 100, rate: 3, range: 0, pellets: 0, spread: 0, radius: 80, ammo: 8, unlockMultiplier: 6, place: BARREL },
  { name: 'Mina', kind: 'placeable', damage: 90, rate: 3, range: 0, pellets: 0, spread: 0, radius: 70, ammo: 8, unlockMultiplier: 7, place: MINE },
];

export const STARTING_AMMO: number[] = WEAPONS.map((w) => (w.ammo === INFINITE ? INFINITE : LOCKED));

export const GRENADE_FUSE = 1.2;
export const GRENADE = 0;
export const FIREBALL = 1;

export const COMBO = { window: 2.5, perLevel: 5 };
export const WAVES = { intermission: 5, spawnEvery: 0.4, maxAlive: 60, flowEvery: 0.25 };
export const DROPS = { chance: 0.12, ammoShare: 0.7, ammoRefill: 0.5, heal: 25, radius: 10 };
export const AMMO_CRATE = 0;
export const HEALTH_CRATE = 1;

// 8 directions, 0 = east, clockwise on screen (y grows down).
const D = Math.SQRT1_2;
export const DIRS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 1, y: 0 }, { x: D, y: D }, { x: 0, y: 1 }, { x: -D, y: D },
  { x: -1, y: 0 }, { x: -D, y: -D }, { x: 0, y: -1 }, { x: D, y: -D },
];

export function dirFrom(dx: number, dy: number): number {
  return (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
}
