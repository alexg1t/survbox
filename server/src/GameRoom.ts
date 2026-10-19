import { type Client, Room, ServerError } from '@colyseus/core';
import {
  DIRS, ENEMIES, PATCH_MS, PLAYER, STARTING_AMMO, TICK_HZ, TILE, WAVES, WEAPONS, ZOMBIE,
  type Vec, buildFlowField, circlesOverlap, dirFrom, moveCircle, nextStep, parseMap, raycast, tileCenter, toTile,
} from '@game/shared';
import { Enemy, GameState, Player } from './state.ts';

const MAP = parseMap();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const axis = (v: unknown) => Math.sign(Number(v) || 0);
const cleanName = (v: unknown) => String(v ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 12);

function nearest<T extends Vec>(list: T[], from: Vec): T {
  let best = list[0];
  let bestD = Infinity;
  for (const p of list) {
    const d = (p.x - from.x) ** 2 + (p.y - from.y) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = 4;
  state = new GameState();
  private joins = 0;
  private nextId = 0;
  private flow: Float32Array = new Float32Array(0);
  private flowTimer = 0;
  private spawnTimer = 0;
  private spawnIndex = 0;

  onCreate() {
    // ponytail: no collision check, query matchMaker if deployed
    this.roomId = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    this.setPatchRate(PATCH_MS);
    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), 1000 / TICK_HZ);

    this.onMessage('input', (client, msg: { dx?: unknown; dy?: unknown; fire?: unknown }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.alive || !this.inGame()) return;
      p.dx = axis(msg?.dx);
      p.dy = axis(msg?.dy);
      p.fire = msg?.fire === true;
    });

    this.onMessage('start', (client) => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== 'lobby') return;
      this.resetWorld();
      this.state.phase = 'playing';
      this.state.wave = 1;
      this.state.toSpawn = 12;
    });
  }

  // Joining is only allowed from the lobby (FR-037). Full rooms are rejected by maxClients.
  onAuth() {
    if (this.state.phase !== 'lobby') throw new ServerError(4000, 'IN_PROGRESS');
    return true;
  }

  onJoin(client: Client, options?: { name?: unknown }) {
    const used = new Set([...this.state.players.values()].map((p) => p.color));
    const color = [0, 1, 2, 3].find((c) => !used.has(c)) ?? 0;
    const p = new Player();
    p.name = cleanName(options?.name) || `Jugador ${color + 1}`;
    p.color = color;
    p.joinOrder = this.joins++;
    p.ammo.push(...STARTING_AMMO);
    this.state.players.set(client.sessionId, p);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
  }

  onLeave(client: Client) {
    const s = this.state;
    s.players.delete(client.sessionId);
    if (s.hostId === client.sessionId) {
      // FR-038: the oldest remaining player becomes host
      let next = '';
      let order = Infinity;
      for (const [id, p] of s.players) if (p.joinOrder < order) { order = p.joinOrder; next = id; }
      s.hostId = next;
    }
  }

  private inGame() {
    return this.state.phase === 'playing' || this.state.phase === 'intermission';
  }

  private resetWorld() {
    const s = this.state;
    s.enemies.clear();
    s.projectiles.clear();
    s.placeables.clear();
    s.crates.clear();
    this.flowTimer = 0;
    let i = 0;
    for (const p of s.players.values()) {
      const spawn = MAP.playerSpawns[i++ % MAP.playerSpawns.length];
      p.x = tileCenter(spawn.tx);
      p.y = tileCenter(spawn.ty);
      p.hp = PLAYER.hp;
      p.alive = true;
      p.dir = 2;
      p.dx = p.dy = 0;
      p.fire = false;
    }
  }

  private blocked = (_tx: number, _ty: number) => false;
  private extraCost = (_tx: number, _ty: number) => 0;

  private tick(dt: number) {
    const s = this.state;
    if (!this.inGame()) return;
    this.updatePlayers(dt);
    if (s.phase === 'playing') this.spawnEnemies(dt);
    this.updateEnemies(dt);
    if ([...s.players.values()].every((p) => !p.alive)) s.phase = 'gameover';
  }

  private updatePlayers(dt: number) {
    for (const [id, p] of this.state.players) {
      if (!p.alive) continue;
      if (p.dx || p.dy) {
        moveCircle(MAP, this.blocked, p, p.dx, p.dy, PLAYER.speed, PLAYER.radius, dt);
        p.dir = dirFrom(p.dx, p.dy);
      }
      p.cooldown -= dt;
      if (p.fire && p.cooldown <= 0) this.fire(id, p);
    }
  }

  private fire(id: string, p: Player) {
    const w = WEAPONS[p.weapon];
    p.cooldown = 1 / w.rate;
    const d = DIRS[p.dir];
    const base = Math.atan2(d.y, d.x);
    const targets = [...this.state.enemies].map(([eid, e]) => ({ id: eid, x: e.x, y: e.y, radius: ENEMIES[e.kind].radius }));
    for (let i = 0; i < w.pellets; i++) {
      const a = w.pellets > 1 ? base - w.spread / 2 + (w.spread * i) / (w.pellets - 1) : base;
      const r = raycast(MAP, p.x, p.y, Math.cos(a), Math.sin(a), w.range, targets);
      if (r.hit) this.damageEnemy(r.hit.id, w.damage, id);
      this.broadcast('shot', { x1: p.x, y1: p.y, x2: r.endX, y2: r.endY, w: p.weapon });
    }
  }

  private damageEnemy(id: string, damage: number, _killerId: string) {
    const e = this.state.enemies.get(id);
    if (!e) return;
    e.hp -= damage;
    if (e.hp <= 0) this.state.enemies.delete(id);
  }

  private damagePlayer(p: Player, damage: number) {
    p.hp = Math.max(0, p.hp - damage);
    if (p.hp === 0) {
      p.alive = false;
      p.fire = false;
      p.dx = p.dy = 0;
    }
  }

  private spawnEnemies(dt: number) {
    const s = this.state;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || s.toSpawn <= 0 || s.enemies.size >= WAVES.maxAlive) return;
    const alive = [...s.players.values()].filter((p) => p.alive);
    for (let k = 0; k < MAP.enemySpawns.length; k++) {
      const sp = MAP.enemySpawns[this.spawnIndex++ % MAP.enemySpawns.length];
      const at = { x: tileCenter(sp.tx), y: tileCenter(sp.ty) };
      if (alive.some((p) => circlesOverlap(p, PLAYER.radius, at, TILE))) continue;
      const e = new Enemy();
      e.kind = ZOMBIE;
      e.x = at.x;
      e.y = at.y;
      e.hp = ENEMIES[e.kind].hp;
      s.enemies.set(String(this.nextId++), e);
      s.toSpawn--;
      this.spawnTimer = WAVES.spawnEvery;
      return;
    }
  }

  private updateEnemies(dt: number) {
    const s = this.state;
    const alive = [...s.players.values()].filter((p) => p.alive);
    if (!alive.length) return;
    this.flowTimer -= dt;
    if (this.flowTimer <= 0) {
      this.flow = buildFlowField(MAP, alive.map((p) => ({ tx: toTile(p.x), ty: toTile(p.y) })), this.extraCost);
      this.flowTimer = WAVES.flowEvery;
    }
    const list = [...s.enemies.values()];
    for (const e of list) {
      const def = ENEMIES[e.kind];
      const target = nearest(alive, e);
      let vx = 0;
      let vy = 0;
      if (Math.hypot(target.x - e.x, target.y - e.y) < TILE * 1.5) {
        vx = target.x - e.x;
        vy = target.y - e.y;
      } else {
        const step = nextStep(this.flow, MAP, toTile(e.x), toTile(e.y));
        if (step) {
          vx = tileCenter(step.tx) - e.x;
          vy = tileCenter(step.ty) - e.y;
        }
      }
      const len = Math.hypot(vx, vy);
      if (len > 1) {
        vx = (vx / len) * def.speed;
        vy = (vy / len) * def.speed;
        e.dir = dirFrom(vx, vy);
      } else {
        vx = vy = 0;
      }
      // ponytail: O(n²) separation, spatial hash if maxAlive grows
      for (const o of list) {
        if (o === e) continue;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const min = def.radius + ENEMIES[o.kind].radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < min * min) {
          const d = Math.sqrt(d2);
          vx += (dx / d) * (min - d) * 8;
          vy += (dy / d) * (min - d) * 8;
        }
      }
      const speed = Math.min(Math.hypot(vx, vy), def.speed * 1.5);
      if (speed > 0) moveCircle(MAP, this.blocked, e, vx, vy, speed, def.radius, dt);

      e.attackCooldown -= dt;
      if (e.attackCooldown <= 0 && circlesOverlap(e, def.radius + 4, target, PLAYER.radius)) {
        e.attackCooldown = def.meleeEvery;
        this.damagePlayer(target, def.meleeDamage);
      }
    }
  }
}
