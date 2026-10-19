import { type Client, Room, ServerError } from '@colyseus/core';
import {
  AMMO_CRATE, BARREL, BARRICADE, DEVIL, DIRS, DROPS, ENEMIES, FIREBALL, GRENADE, GRENADE_FUSE, HEALTH_CRATE, LOCKED, MINE,
  PATCH_MS, PLACEABLE_HP, PLAYER, STARTING_AMMO, TICK_HZ, TILE, WAVES, WEAPONS, type WeaponDef, ZOMBIE,
  type Vec, buildFlowField, circlesOverlap, dirFrom, isSolid, moveCircle, nextStep, parseMap, raycast, registerKill,
  resolveExplosions, tickCombo, tileCenter, toTile, waveComposition,
} from '@game/shared';
import { Crate, Enemy, GameState, Placeable, Player, Projectile } from './state.ts';

const MAP = parseMap();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PROJECTILE_RADIUS = 6;
const BULLET_WIDTH = 8; // aim forgiveness: 8-direction aiming needs a wide bullet
const BARRICADE_COST = 20; // flow-field cost: detour up to ~20 tiles before breaking through
const weaponFor = (place: number) => WEAPONS.find((w) => w.place === place)!;

interface Explosion { x: number; y: number; r: number; damage: number; ownerId: string; key?: string }

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
  private queue: number[] = []; // enemy kinds still to spawn this wave

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

    this.onMessage('weapon', (client, msg: { index?: unknown; step?: unknown }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const n = WEAPONS.length;
      if (typeof msg?.step === 'number') {
        const dir = Math.sign(msg.step) || 1;
        for (let k = 1; k <= n; k++) {
          const i = (p.weapon + dir * k + n * k) % n;
          if (p.ammo[i] !== LOCKED) { p.weapon = i; break; }
        }
      } else {
        const i = Number(msg?.index);
        if (Number.isInteger(i) && i >= 0 && i < n && p.ammo[i] !== LOCKED) p.weapon = i;
      }
    });

    this.onMessage('start', (client) => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== 'lobby') return;
      this.resetWorld();
      this.state.wave = 1;
      this.state.phase = 'intermission';
      this.state.waveTimer = WAVES.intermission;
    });

    this.onMessage('debugUnlock', (client) => {
      if (process.env.NODE_ENV === 'production') return;
      const p = this.state.players.get(client.sessionId);
      if (p) WEAPONS.forEach((w, i) => { if (p.ammo[i] === LOCKED) p.ammo[i] = w.ammo; });
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

  // Fresh match: empty world, every player at a spawn with full hp, pistol only, zero score.
  private resetWorld() {
    const s = this.state;
    s.enemies.clear();
    s.projectiles.clear();
    s.placeables.clear();
    s.crates.clear();
    s.toSpawn = 0;
    this.queue = [];
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
      p.score = 0;
      p.combo = 0;
      p.comboTime = 0;
      p.weapon = 0;
      STARTING_AMMO.forEach((a, w) => (p.ammo[w] = a));
    }
  }

  // Barricades and barrels are solid for everyone; mines are not (FR-029).
  private blocked = (tx: number, ty: number) => {
    const p = this.state.placeables.get(`${tx},${ty}`);
    return !!p && p.kind !== MINE;
  };
  private extraCost = (tx: number, ty: number) => (this.blocked(tx, ty) ? BARRICADE_COST : 0);

  private tick(dt: number) {
    const s = this.state;
    if (!this.inGame()) return;
    if (s.phase === 'intermission') {
      s.waveTimer = Math.max(0, s.waveTimer - dt);
      if (s.waveTimer === 0) this.beginWave();
    }
    this.updatePlayers(dt);
    if (s.phase === 'playing') this.spawnEnemies(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.triggerMines();
    this.pickCrates();
    if ([...s.players.values()].every((p) => !p.alive)) {
      s.phase = 'gameover'; // wins over the end of the wave
      return;
    }
    if (s.phase === 'playing' && s.toSpawn === 0 && s.enemies.size === 0) this.endWave();
  }

  private beginWave() {
    const s = this.state;
    const { zombies, devils } = waveComposition(s.wave, s.players.size);
    this.queue = [...Array(zombies).fill(ZOMBIE), ...Array(devils).fill(DEVIL)].sort(() => Math.random() - 0.5);
    s.toSpawn = this.queue.length;
    s.phase = 'playing';
  }

  private endWave() {
    const s = this.state;
    s.wave++;
    s.phase = 'intermission';
    s.waveTimer = WAVES.intermission;
    // FR-030: the dead come back with full hp, keeping weapons, ammo and score
    const alive = [...s.players.values()].filter((p) => p.alive);
    for (const p of s.players.values()) {
      if (p.alive) continue;
      const spawn = MAP.playerSpawns.find((t) => !alive.some((o) => circlesOverlap(o, PLAYER.radius, { x: tileCenter(t.tx), y: tileCenter(t.ty) }, TILE)))
        ?? MAP.playerSpawns[0];
      p.x = tileCenter(spawn.tx);
      p.y = tileCenter(spawn.ty);
      p.hp = PLAYER.hp;
      p.alive = true;
      alive.push(p);
    }
  }

  private updatePlayers(dt: number) {
    for (const [id, p] of this.state.players) {
      tickCombo(p, dt);
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
    const ammo = p.ammo[p.weapon];
    if (ammo === 0 || ammo === LOCKED) return;
    const d = DIRS[p.dir];
    if (w.kind === 'hitscan') {
      const base = Math.atan2(d.y, d.x);
      const targets = [...this.state.enemies].map(([eid, e]) => ({ id: eid, barrel: false, x: e.x, y: e.y, radius: ENEMIES[e.kind].radius + BULLET_WIDTH }));
      for (const [key, b] of this.state.placeables) {
        if (b.kind === BARREL) targets.push({ id: key, barrel: true, x: tileCenter(b.tx), y: tileCenter(b.ty), radius: TILE / 2 });
      }
      for (let i = 0; i < w.pellets; i++) {
        const a = w.pellets > 1 ? base - w.spread / 2 + (w.spread * i) / (w.pellets - 1) : base;
        const r = raycast(MAP, p.x, p.y, Math.cos(a), Math.sin(a), w.range, targets);
        if (r.hit?.barrel) this.damagePlaceable(r.hit.id, w.damage);
        else if (r.hit) this.damageEnemy(r.hit.id, w.damage, id);
        this.broadcast('shot', { x1: p.x, y1: p.y, x2: r.endX, y2: r.endY, w: p.weapon });
      }
    } else if (w.kind === 'thrown') {
      const g = new Projectile();
      const speed = w.range / GRENADE_FUSE;
      g.kind = GRENADE;
      g.x = p.x;
      g.y = p.y;
      g.vx = d.x * speed;
      g.vy = d.y * speed;
      g.life = GRENADE_FUSE;
      g.ownerId = id;
      this.state.projectiles.set(String(this.nextId++), g);
    } else if (!this.place(id, p, w)) {
      return;
    }
    p.cooldown = 1 / w.rate;
    if (ammo > 0) p.ammo[p.weapon] = ammo - 1;
  }

  // FR-013: the tile ahead must be floor with no placeable, player or enemy on it.
  private place(id: string, p: Player, w: WeaponDef): boolean {
    // The tile just past the body edge, so the placer never overlaps it.
    const d = DIRS[p.dir];
    const tx = toTile(p.x + d.x * (PLAYER.radius + TILE));
    const ty = toTile(p.y + d.y * (PLAYER.radius + TILE));
    const key = `${tx},${ty}`;
    if (isSolid(MAP, tx, ty) || this.state.placeables.has(key)) return false;
    const cx = tileCenter(tx);
    const cy = tileCenter(ty);
    const covers = (e: Vec, r: number) => Math.abs(e.x - cx) < TILE / 2 + r && Math.abs(e.y - cy) < TILE / 2 + r;
    for (const o of this.state.players.values()) if (o.alive && covers(o, PLAYER.radius)) return false;
    for (const e of this.state.enemies.values()) if (covers(e, ENEMIES[e.kind].radius)) return false;
    const k = new Placeable();
    k.kind = w.place!;
    k.tx = tx;
    k.ty = ty;
    k.hp = PLACEABLE_HP[k.kind];
    k.ownerId = id;
    this.state.placeables.set(key, k);
    this.flowTimer = 0;
    return true;
  }

  private damagePlaceable(key: string, damage: number) {
    const k = this.state.placeables.get(key);
    if (!k || k.kind === MINE) return;
    k.hp -= damage;
    if (k.hp > 0) return;
    this.state.placeables.delete(key);
    this.flowTimer = 0;
    if (k.kind === BARREL) {
      const w = weaponFor(BARREL);
      this.explode({ x: tileCenter(k.tx), y: tileCenter(k.ty), r: w.radius, damage: w.damage, ownerId: k.ownerId });
    }
  }

  private triggerMines() {
    for (const [key, m] of this.state.placeables) {
      if (m.kind !== MINE) continue;
      const stepped = [...this.state.enemies.values()].some((e) => toTile(e.x) === m.tx && toTile(e.y) === m.ty);
      if (!stepped) continue;
      this.state.placeables.delete(key);
      const w = weaponFor(MINE);
      this.explode({ x: tileCenter(m.tx), y: tileCenter(m.ty), r: w.radius, damage: w.damage, ownerId: m.ownerId });
    }
  }

  private damageEnemy(id: string, damage: number, killerId: string) {
    const s = this.state;
    const e = s.enemies.get(id);
    if (!e) return;
    e.hp -= damage;
    if (e.hp > 0) return;
    s.enemies.delete(id);
    const killer = s.players.get(killerId);
    if (killer) {
      for (const w of registerKill(killer, ENEMIES[e.kind].points)) this.broadcast('unlock', { id: killerId, w });
    }
    if (Math.random() < DROPS.chance) {
      const c = new Crate();
      c.kind = Math.random() < DROPS.ammoShare ? AMMO_CRATE : HEALTH_CRATE;
      c.x = e.x;
      c.y = e.y;
      s.crates.set(String(this.nextId++), c);
    }
  }

  private damagePlayer(p: Player, damage: number) {
    p.hp = Math.max(0, p.hp - damage);
    if (p.hp === 0) {
      p.alive = false;
      p.fire = false;
      p.dx = p.dy = 0;
    }
  }

  // Explosions chain through barrels and hurt enemies and barricades, never players (FR-014, FR-027).
  private explode(origin: Explosion) {
    const s = this.state;
    const w = weaponFor(BARREL);
    const barrels: Explosion[] = [...s.placeables]
      .filter(([, k]) => k.kind === BARREL)
      .map(([key, k]) => ({ key, x: tileCenter(k.tx), y: tileCenter(k.ty), r: w.radius, damage: w.damage, ownerId: k.ownerId }));
    for (const b of resolveExplosions([origin], barrels)) {
      if (b.key) s.placeables.delete(b.key);
      for (const [id, e] of s.enemies) {
        if (circlesOverlap(e, ENEMIES[e.kind].radius, b, b.r)) this.damageEnemy(id, b.damage, b.ownerId);
      }
      for (const [key, k] of s.placeables) {
        if (k.kind === BARRICADE && circlesOverlap({ x: tileCenter(k.tx), y: tileCenter(k.ty) }, TILE / 2, b, b.r)) {
          this.damagePlaceable(key, b.damage);
        }
      }
      this.broadcast('boom', { x: b.x, y: b.y, r: b.r });
    }
    this.flowTimer = 0;
  }

  private spawnEnemies(dt: number) {
    const s = this.state;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || s.toSpawn <= 0 || s.enemies.size >= WAVES.maxAlive) return;
    const alive = [...s.players.values()].filter((p) => p.alive);
    for (let k = 0; k < MAP.enemySpawns.length; k++) {
      const sp = MAP.enemySpawns[this.spawnIndex++ % MAP.enemySpawns.length];
      const at = { x: tileCenter(sp.tx), y: tileCenter(sp.ty) };
      if (alive.some((p) => circlesOverlap(p, PLAYER.radius, at, TILE)) || this.blocked(sp.tx, sp.ty)) continue;
      const e = new Enemy();
      e.kind = this.queue.pop() ?? ZOMBIE;
      e.x = at.x;
      e.y = at.y;
      e.hp = ENEMIES[e.kind].hp;
      e.fireCooldown = Math.random() * (ENEMIES[e.kind].fireEvery ?? 0);
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
      const dist = Math.hypot(target.x - e.x, target.y - e.y);
      let vx = 0;
      let vy = 0;
      let obstacle = ''; // barricade or barrel on the path, attacked when adjacent (FR-021)
      if (dist < TILE * 1.5) {
        vx = target.x - e.x;
        vy = target.y - e.y;
      } else {
        const step = nextStep(this.flow, MAP, toTile(e.x), toTile(e.y));
        if (step) {
          vx = tileCenter(step.tx) - e.x;
          vy = tileCenter(step.ty) - e.y;
          if (this.blocked(step.tx, step.ty) && Math.hypot(vx, vy) < TILE + 2) obstacle = `${step.tx},${step.ty}`;
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
      } else if (e.attackCooldown <= 0 && obstacle) {
        e.attackCooldown = def.meleeEvery;
        this.damagePlaceable(obstacle, def.meleeDamage);
      }

      if (def.fireEvery) {
        e.fireCooldown -= dt;
        const far = Math.hypot(target.x - e.x, target.y - e.y); // re-measured: the devil just moved
        if (e.fireCooldown <= 0 && far <= def.fireRange! && far > 0) {
          const ux = (target.x - e.x) / far;
          const uy = (target.y - e.y) / far;
          const sight = raycast(MAP, e.x, e.y, ux, uy, far, []);
          if (Math.hypot(sight.endX - e.x, sight.endY - e.y) >= far - 1) {
            const f = new Projectile();
            f.kind = FIREBALL;
            f.x = e.x;
            f.y = e.y;
            f.vx = ux * def.fireSpeed!;
            f.vy = uy * def.fireSpeed!;
            f.life = def.fireRange! / def.fireSpeed!;
            s.projectiles.set(String(this.nextId++), f);
            e.fireCooldown = def.fireEvery;
          }
        }
      }
    }
  }

  private updateProjectiles(dt: number) {
    const s = this.state;
    for (const [id, pr] of s.projectiles) {
      pr.life -= dt;
      const nx = pr.x + pr.vx * dt;
      const ny = pr.y + pr.vy * dt;
      const hitsWall = isSolid(MAP, toTile(nx), toTile(ny)) || this.blocked(toTile(nx), toTile(ny));
      if (pr.kind === GRENADE) {
        if (hitsWall) pr.vx = pr.vy = 0;
        else { pr.x = nx; pr.y = ny; }
        if (pr.life <= 0) {
          s.projectiles.delete(id);
          const w = WEAPONS.find((x) => x.kind === 'thrown')!;
          this.explode({ x: pr.x, y: pr.y, r: w.radius, damage: w.damage, ownerId: pr.ownerId });
        }
        continue;
      }
      if (hitsWall || pr.life <= 0) {
        s.projectiles.delete(id);
        continue;
      }
      pr.x = nx;
      pr.y = ny;
      for (const p of s.players.values()) {
        if (p.alive && circlesOverlap(pr, PROJECTILE_RADIUS, p, PLAYER.radius)) {
          this.damagePlayer(p, ENEMIES[DEVIL].fireDamage!);
          s.projectiles.delete(id);
          break;
        }
      }
    }
  }

  private pickCrates() {
    const s = this.state;
    for (const [id, c] of s.crates) {
      const p = [...s.players.values()].find((o) => o.alive && circlesOverlap(o, PLAYER.radius, c, DROPS.radius));
      if (!p) continue;
      if (c.kind === HEALTH_CRATE) p.hp = Math.min(PLAYER.hp, p.hp + DROPS.heal);
      else WEAPONS.forEach((w, i) => { if (w.ammo > 0 && p.ammo[i] >= 0) p.ammo[i] += Math.ceil(w.ammo * DROPS.ammoRefill); });
      s.crates.delete(id);
    }
  }
}
