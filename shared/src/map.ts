import { TILE } from './config.ts';

// # wall, . floor, P player spawn, S enemy spawn. 40 x 30, 3x3 rooms joined by 2-tile doors.
export const MAP = [
  '########################################',
  '#S...........#.....S......#...........S#',
  '#............#............#............#',
  '#...##.......#............#............#',
  '#...##.................................#',
  '#...............##....##...............#',
  '#............#............#.....##.....#',
  '#............#............#.....##.....#',
  '#............#............#............#',
  '#............#............#............#',
  '######..###########..###########..######',
  '#............#............#............#',
  '#............#..#......#..#............#',
  '#............#............#............#',
  '#.................P..P.................#',
  '#S...###........................###...S#',
  '#............#....P..P....#............#',
  '#............#............#............#',
  '#............#..#......#..#............#',
  '#............#............#............#',
  '######..###########..###########..######',
  '#............#............#............#',
  '#............#............#............#',
  '#.......##...#............#............#',
  '#.......##......##....##......##.......#',
  '#.............................##.......#',
  '#............#............#............#',
  '#............#............#............#',
  '#S...........#.....S......#...........S#',
  '########################################',
];

export interface Tile { tx: number; ty: number }

export interface GameMap {
  w: number;
  h: number;
  solid: Uint8Array;
  playerSpawns: Tile[];
  enemySpawns: Tile[];
}

export function parseMap(rows: string[] = MAP): GameMap {
  const h = rows.length;
  const w = rows[0].length;
  const solid = new Uint8Array(w * h);
  const playerSpawns: Tile[] = [];
  const enemySpawns: Tile[] = [];
  rows.forEach((row, ty) => {
    for (let tx = 0; tx < w; tx++) {
      const c = row[tx];
      if (c === '#') solid[ty * w + tx] = 1;
      else if (c === 'P') playerSpawns.push({ tx, ty });
      else if (c === 'S') enemySpawns.push({ tx, ty });
    }
  });
  return { w, h, solid, playerSpawns, enemySpawns };
}

export function isSolid(map: GameMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  return map.solid[ty * map.w + tx] === 1;
}

export const tileCenter = (t: number) => t * TILE + TILE / 2;
export const toTile = (px: number) => Math.floor(px / TILE);
