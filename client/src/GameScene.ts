import type { Room } from '@colyseus/sdk';
import { MINE, PLAYER, TILE, moveCircle, parseMap } from '@game/shared';
import type { GameState } from '@game/server/src/state.ts';
import * as Phaser from 'phaser';
import { CHAR_H, CHAR_W, WALL_HEIGHT, makeTextures } from './art.ts';
import { $ } from './ui.ts';

const map = parseMap();
const SMOOTH = 0.25;

type Img = Phaser.GameObjects.Image;

export class GameScene extends Phaser.Scene {
  room!: Room<any, GameState>;
  private sprites = new Map<string, Img>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private me = { x: 0, y: 0, dir: 2 };
  private sent = { dx: 0, dy: 0, fire: false };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('game');
  }

  init(data: { room: Room<any, GameState> }) {
    this.room = data.room;
    this.sprites.clear();
    this.labels.clear();
  }

  create() {
    makeTextures(this);
    this.add.tileSprite(0, 0, map.w * TILE, map.h * TILE, 'floor').setOrigin(0).setDepth(-1e6);
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        if (map.solid[ty * map.w + tx]) {
          this.add.image(tx * TILE, ty * TILE - WALL_HEIGHT, 'wall').setOrigin(0).setDepth((ty + 1) * TILE);
        }
      }
    }
    this.cameras.main.setBounds(0, -WALL_HEIGHT, map.w * TILE, map.h * TILE + WALL_HEIGHT).setZoom(1.6);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.events.once('shutdown', () => this.input.keyboard?.clearCaptures());

    const self = this.room.state.players.get(this.room.sessionId);
    if (self) Object.assign(this.me, { x: self.x, y: self.y, dir: self.dir });

    const hint = $('#hud-hint');
    hint.textContent = 'Flechas/WASD: mover · Espacio: disparar';
    this.time.delayedCall(10_000, () => (hint.textContent = ''));
  }

  shot(m: { x1: number; y1: number; x2: number; y2: number }) {
    const line = this.add.graphics().setDepth(1e6);
    line.lineStyle(2, 0xfff2a8, 0.9).lineBetween(m.x1, m.y1 - 14, m.x2, m.y2 - 14);
    this.time.delayedCall(100, () => line.destroy());
  }

  private blocked = (tx: number, ty: number) => {
    const p = this.room.state.placeables.get(`${tx},${ty}`);
    return !!p && p.kind !== MINE;
  };

  update(_time: number, deltaMs: number) {
    const state = this.room.state;
    const dt = deltaMs / 1000;
    const k = this.keys;
    const dx = Number(k.RIGHT.isDown || k.D.isDown) - Number(k.LEFT.isDown || k.A.isDown);
    const dy = Number(k.DOWN.isDown || k.S.isDown) - Number(k.UP.isDown || k.W.isDown);
    const fire = k.SPACE.isDown;
    if (dx !== this.sent.dx || dy !== this.sent.dy || fire !== this.sent.fire) {
      this.sent = { dx, dy, fire };
      this.room.send('input', this.sent);
    }

    const self = state.players.get(this.room.sessionId);
    if (self?.alive) {
      moveCircle(map, this.blocked, this.me, dx, dy, PLAYER.speed, PLAYER.radius, dt);
      if (dx || dy) this.me.dir = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
      // ponytail: lerp correction, snapshot buffer if jitter
      const ex = self.x - this.me.x;
      const ey = self.y - this.me.y;
      if (Math.hypot(ex, ey) > 96) Object.assign(this.me, { x: self.x, y: self.y });
      else {
        const f = dx || dy ? 0.02 : 0.2;
        this.me.x += ex * f;
        this.me.y += ey * f;
      }
    }

    const seen = new Set<string>();
    for (const [id, p] of state.players) {
      const local = id === this.room.sessionId;
      const s = this.sync(`p:${id}`, seen, local ? this.me.x : p.x, local ? this.me.y : p.y, !local);
      s.setTexture(`p${p.color}_d${local ? this.me.dir : p.dir}`).setVisible(p.alive);
      let label = this.labels.get(`p:${id}`);
      if (!label) {
        label = this.add.text(0, 0, p.name, { fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 });
        this.labels.set(`p:${id}`, label.setOrigin(0.5, 1).setDepth(1e6));
      }
      label.setPosition(s.x, s.y - CHAR_H + 4).setVisible(p.alive);
    }
    for (const [id, e] of state.enemies) {
      this.sync(`e:${id}`, seen, e.x, e.y, true).setTexture(`z_d${e.dir}`);
    }
    for (const [key, s] of this.sprites) {
      if (!seen.has(key)) {
        s.destroy();
        this.sprites.delete(key);
        this.labels.get(key)?.destroy();
        this.labels.delete(key);
      }
    }

    this.cameras.main.centerOn(this.me.x, this.me.y);
  }

  // Creates or moves the sprite for one synced entity; depth sorts by feet y.
  private sync(key: string, seen: Set<string>, x: number, y: number, smooth: boolean): Img {
    seen.add(key);
    let s = this.sprites.get(key);
    if (!s) {
      s = this.add.image(x, y, '__DEFAULT').setOrigin(0.5, (CHAR_H - 6) / CHAR_H).setSize(CHAR_W, CHAR_H);
      this.sprites.set(key, s);
    } else if (smooth) {
      s.x += (x - s.x) * SMOOTH;
      s.y += (y - s.y) * SMOOTH;
    } else {
      s.setPosition(x, y);
    }
    return s.setDepth(s.y);
  }
}
