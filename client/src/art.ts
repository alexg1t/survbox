import type * as Phaser from 'phaser';
import { DIRS, TILE } from '@game/shared';

// All textures are drawn here at boot (constitution IV: no external assets).
// Oblique 3/4 view: every object is a box with a light top face and a darker front face.

export const PLAYER_COLORS = [0x3d7be0, 0xe0c23d, 0x9b59d0, 0xe07b3d];
export const WALL_HEIGHT = 16;
export const CHAR_W = 32;
export const CHAR_H = 44;

export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function shade(color: number, f: number): number {
  const ch = (s: number) => Math.min(255, Math.round(((color >> s) & 255) * f));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, depth: number, h: number, color: number) {
  g.fillStyle(shade(color, 1.15)).fillRect(x, y, w, depth);
  g.fillStyle(shade(color, 0.75)).fillRect(x, y + depth, w, h);
  g.lineStyle(1, shade(color, 0.45)).strokeRect(x + 0.5, y + 0.5, w - 1, depth + h - 1);
}

interface Look { body: number; skin: number; horns?: boolean }

function character(g: Phaser.GameObjects.Graphics, look: Look, dir: number) {
  const d = DIRS[dir];
  const gun = () => {
    g.lineStyle(4, 0x222222);
    g.lineBetween(16, 27, 16 + d.x * 14, 27 + d.y * 9);
  };
  if (d.y < 0) gun(); // facing away: weapon goes behind the body
  box(g, 8, 18, 16, 6, 16, look.body);
  box(g, 9, 4, 14, 6, 9, look.skin);
  if (look.horns) {
    g.fillStyle(0x2a0a0a);
    g.fillTriangle(9, 4, 12, 4, 9, 0);
    g.fillTriangle(20, 4, 23, 4, 23, 0);
  }
  if (d.y >= 0) {
    const ex = 16 + d.x * 4;
    g.fillStyle(0x111111).fillRect(ex - 4, 12, 2, 2).fillRect(ex + 2, 12, 2, 2);
    gun();
  }
}

export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('floor')) return;
  const g = scene.make.graphics({}, false);
  const make = (key: string, w: number, h: number, draw: () => void) => {
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  make('floor', TILE, TILE, () => {
    g.fillStyle(0x3a3d44).fillRect(0, 0, TILE, TILE);
    g.lineStyle(1, 0x33363c).strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
  });
  make('wall', TILE, TILE + WALL_HEIGHT, () => box(g, 0, 0, TILE, TILE, WALL_HEIGHT, 0x6b6f78));

  const looks: [string, Look][] = [
    ...PLAYER_COLORS.map((c, i): [string, Look] => [`p${i}`, { body: c, skin: 0xf0c9a0 }]),
    ['z', { body: 0x5a6b3a, skin: 0x8fbf5a }],
    ['d', { body: 0x7a1a1a, skin: 0xd03030, horns: true }],
  ];
  for (const [prefix, look] of looks) {
    for (let dir = 0; dir < 8; dir++) make(`${prefix}_d${dir}`, CHAR_W, CHAR_H, () => character(g, look, dir));
  }

  make('fireball', 14, 14, () => {
    g.fillStyle(0xff5a1a).fillCircle(7, 7, 7);
    g.fillStyle(0xffd23a).fillCircle(7, 7, 4);
  });
  make('grenade', 10, 10, () => {
    g.fillStyle(0x2f4a2a).fillCircle(5, 5, 5);
    g.fillStyle(0x9a9a9a).fillRect(4, 0, 3, 3);
  });
  make('crate_ammo', 20, 20, () => {
    box(g, 0, 0, 20, 6, 14, 0x8a7a3a);
    g.fillStyle(0xe0c23d).fillRect(3, 11, 14, 3);
  });
  make('barricade', TILE, TILE + 8, () => {
    box(g, 1, 0, TILE - 2, 14, TILE - 6, 0x9a6a3a);
    g.lineStyle(2, 0x5a3a1a).lineBetween(3, 22, TILE - 3, 22).lineBetween(3, 32, TILE - 3, 32);
  });
  make('barrel', 22, 30, () => {
    box(g, 0, 0, 22, 8, 22, 0xc03a2a);
    g.fillStyle(0x2a2a2a).fillRect(0, 13, 22, 3).fillRect(0, 23, 22, 3);
  });
  make('mine', 18, 10, () => {
    g.fillStyle(0x3a3a3a).fillEllipse(9, 5, 18, 10);
    g.fillStyle(0xff3a2a).fillCircle(9, 5, 2);
  });
  make('crate_hp', 20, 20, () => {
    box(g, 0, 0, 20, 6, 14, 0xe8e8e8);
    g.fillStyle(0xd03030).fillRect(8, 8, 4, 10).fillRect(5, 11, 10, 4);
  });
  g.destroy();
}
