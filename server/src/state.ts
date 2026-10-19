import { type SchemaType, schema, t } from '@colyseus/schema';

// Synced room state (data-model.md). `.noSync()` fields are server-only scratch data.

export const Player = schema({
  name: t.string().default(''),
  color: t.uint8().default(0),
  joinOrder: t.uint32().default(0),
  x: t.float32().default(0),
  y: t.float32().default(0),
  dir: t.uint8().default(2),
  hp: t.uint8().default(100),
  alive: t.boolean().default(true),
  score: t.uint32().default(0),
  combo: t.uint16().default(0),
  comboTime: t.float32().default(0),
  weapon: t.uint8().default(0),
  ammo: t.array('int16'), // -1 locked, -2 infinite, else rounds left
  dx: t.number().noSync().default(0),
  dy: t.number().noSync().default(0),
  fire: t.boolean().noSync().default(false),
  cooldown: t.number().noSync().default(0),
}, 'Player');
export type Player = SchemaType<typeof Player>;

export const Enemy = schema({
  kind: t.uint8().default(0),
  x: t.float32().default(0),
  y: t.float32().default(0),
  dir: t.uint8().default(2),
  hp: t.int16().default(0),
  attackCooldown: t.number().noSync().default(0),
  fireCooldown: t.number().noSync().default(0),
}, 'Enemy');
export type Enemy = SchemaType<typeof Enemy>;

export const Projectile = schema({
  kind: t.uint8().default(0),
  x: t.float32().default(0),
  y: t.float32().default(0),
  vx: t.number().noSync().default(0),
  vy: t.number().noSync().default(0),
  life: t.number().noSync().default(0), // grenade fuse or fireball range left (seconds)
  ownerId: t.string().noSync().default(''),
}, 'Projectile');
export type Projectile = SchemaType<typeof Projectile>;

export const Placeable = schema({
  kind: t.uint8().default(0),
  tx: t.uint8().default(0),
  ty: t.uint8().default(0),
  hp: t.int16().default(0),
  ownerId: t.string().noSync().default(''),
}, 'Placeable');
export type Placeable = SchemaType<typeof Placeable>;

export const Crate = schema({
  kind: t.uint8().default(0),
  x: t.float32().default(0),
  y: t.float32().default(0),
}, 'Crate');
export type Crate = SchemaType<typeof Crate>;

export type Phase = 'lobby' | 'playing' | 'intermission' | 'gameover';

export const GameState = schema({
  phase: t.string<Phase>().default('lobby'),
  hostId: t.string().default(''),
  wave: t.uint16().default(0),
  waveTimer: t.float32().default(0),
  toSpawn: t.uint16().default(0),
  players: t.map(Player),
  enemies: t.map(Enemy),
  projectiles: t.map(Projectile),
  placeables: t.map(Placeable),
  crates: t.map(Crate),
}, 'GameState');
export type GameState = SchemaType<typeof GameState>;
