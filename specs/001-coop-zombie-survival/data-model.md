# Data Model: Supervivencia co-op contra zombis (MVP)

Hay dos capas:

1. **Estado sincronizado**: schema de Colyseus, en `server/src/state.ts`, que se replica a los
   clientes.
2. **Datos estáticos**: tablas de configuración en `shared/src/config.ts`, que no se sincronizan.

Las funciones de `shared/` operan sobre interfaces estructurales (`{ x, y, hp }`, …). Así pueden
mutar directamente las instancias del schema sin copiarlas.

Unidades: posiciones en píxeles de mundo (casilla = 32 px), tiempos en segundos y ángulos como
dirección 0-7. La dirección 0 es este y el sentido es horario: 0=E, 1=SE, 2=S, 3=SO, 4=O, 5=NO,
6=N, 7=NE.

## Estado sincronizado

### GameState (raíz de la sala)

| Campo | Tipo | Notas |
|-------|------|-------|
| phase | string | `lobby` \| `playing` \| `intermission` \| `gameover` |
| hostId | string | sessionId del anfitrión (FR-036, FR-038) |
| wave | uint16 | 0 en el lobby |
| waveTimer | float32 | segundos que faltan para la siguiente oleada (en `intermission`) |
| toSpawn | uint16 | enemigos de la oleada pendientes de aparecer |
| players | map<Player> | clave: sessionId |
| enemies | map<Enemy> | clave: id incremental (string) |
| projectiles | map<Projectile> | granadas y bolas de fuego |
| placeables | map<Placeable> | clave: `"tx,ty"` (una por casilla) |
| crates | map<Crate> | |

### Player

| Campo | Tipo | Notas |
|-------|------|-------|
| name | string | 1-12 caracteres, recortado. Si está vacío, `Jugador N` (FR-006) |
| color | uint8 | 0-3. Es el primer color libre al entrar |
| joinOrder | uint32 | contador de la sala. Determina el sucesor del anfitrión (FR-038) |
| x, y | float32 | |
| dir | uint8 | 0-7. Se actualiza al moverse (FR-008) |
| hp | uint8 | 0-100 |
| alive | boolean | `false` = espectador hasta la siguiente oleada (FR-030) |
| score | uint32 | |
| combo | uint16 | |
| comboTime | float32 | segundos que le quedan a la ventana de combo (barra del HUD) |
| weapon | uint8 | índice del arma seleccionada (tabla de armas) |
| ammo | array<int16> | una entrada por arma: `-1` = bloqueada, `0..n` = munición. La pistola usa `-2` = infinita |

El input del jugador (`dx`, `dy`, `fire`) y su `cooldown` viven solo en el servidor, en un
`Map<sessionId, …>` de la sala. No se sincronizan.

### Enemy

| Campo | Tipo | Notas |
|-------|------|-------|
| kind | uint8 | 0 = zombi, 1 = diablo |
| x, y | float32 | |
| dir | uint8 | |
| hp | int16 | |

Solo en el servidor: `attackCooldown` y `fireCooldown`.

### Projectile

| Campo | Tipo | Notas |
|-------|------|-------|
| kind | uint8 | 0 = granada, 1 = bola de fuego |
| x, y | float32 | |

Solo en el servidor: `vx`, `vy`, `fuse` (granada), `ownerId` (puntos de la granada).

### Placeable

| Campo | Tipo | Notas |
|-------|------|-------|
| kind | uint8 | 0 = barricada, 1 = barril, 2 = mina |
| tx, ty | uint8 | casilla |
| hp | int16 | barricada 150 y barril 1. La mina no lo usa |

Solo en el servidor: `ownerId` (para atribuir muertes).

### Crate

| Campo | Tipo | Notas |
|-------|------|-------|
| kind | uint8 | 0 = munición, 1 = vida |
| x, y | float32 | |

## Datos estáticos (`shared/src/config.ts`)

- **WEAPONS**: tabla ordenada. El índice es el id del arma y también la tecla numérica 1-7.
  - Orden: `pistol`, `uzi`, `shotgun`, `barricade`, `grenade`, `barrel`, `mine`. Este orden
    coincide con el de desbloqueo de FR-024.
  - Campos: `name`, `kind` (`hitscan` \| `thrown` \| `placeable`), `damage`, `rate`, `range`,
    `pellets`, `spread`, `radius`, `ammo` (dotación), `unlockMultiplier`.
- **ENEMIES**: tabla con `hp`, `speed`, `radius`, `meleeDamage`, `meleeRate` y `points`. Para el
  diablo, además: `fireDamage`, `fireRate`, `fireRange` y `fireSpeed`.
- **PLAYER**, **COMBO**, **WAVES** y **DROPS**: constantes. Los valores están en la sección R12 de
  [research.md](./research.md).
- **MAP**: array de strings, una fila por línea, con esta leyenda:

  | Carácter | Significado |
  |----------|-------------|
  | `#` | pared |
  | `.` | suelo |
  | `P` | punto de inicio de jugador (≥4) |
  | `S` | punto de aparición de enemigos (≥6) |

  `parseMap()` devuelve `{ w, h, solid: Uint8Array, playerSpawns, enemySpawns }`.

## Funciones puras de `shared/` (contrato interno)

| Función | Qué hace | Requisitos |
|---------|----------|------------|
| `moveCircle(map, blocked, pos, dx, dy, speed, radius, dt)` | Mueve y resuelve colisiones por ejes. `blocked(tx,ty)` incluye los colocables sólidos. | FR-008, FR-011, FR-029 |
| `raycast(map, x, y, dir, range, targets)` | Devuelve `{ hit?: target, endX, endY }`: primer círculo alcanzado antes de una pared. | FR-009, FR-011 |
| `buildFlowField(map, sources, extraCost)` | Dijkstra multi-origen. Devuelve `Float32Array` de distancias. | FR-016, FR-021 |
| `nextStep(field, map, tx, ty)` | Casilla vecina con menor distancia, sin cortar esquinas. | FR-016 |
| `registerKill(player, points, now)` | Sube el combo, suma `points × multiplier` y devuelve las armas recién desbloqueadas. | FR-022, FR-023, FR-024, FR-025 |
| `tickCombo(player, dt)` | Descuenta `comboTime`. Al llegar a 0, `combo = 0`. | FR-023 |
| `waveComposition(n, players)` | Devuelve `{ zombies, devils }`. | FR-019 |
| `resolveExplosions(origins, barrels)` | Expande la cadena de barriles alcanzados (BFS por radio). | FR-027 |

## Transiciones de estado de la sala

```text
lobby ──(host: start)──▶ intermission ──(waveTimer=0)──▶ playing
  ▲                          ▲                              │
  │                          └──(toSpawn=0 y sin enemigos)──┤
  │                                                         │
  └──────────(host: lobby)─── gameover ◀──(todos muertos)───┘
```

Qué ocurre en cada transición:

- **`lobby → intermission`**: se resetean todos los jugadores (vida 100, puntos 0, combo 0, solo
  la pistola, `alive=true`, en los puntos `P`). Además, `wave=1`, `waveTimer=5`, y se vacían
  enemigos, proyectiles, colocables y cajas.
- **`intermission → playing`**: `toSpawn = waveComposition(wave, players.size)`.
- **`playing → intermission`**: ocurre cuando `toSpawn = 0` y no quedan enemigos.
  - `wave++` y `waveTimer = 5`.
  - Los jugadores muertos reaparecen con vida completa en un punto `P` libre (FR-030).
- **`playing | intermission → gameover`**: ocurre en cuanto todos los jugadores tienen
  `alive=false`. Tiene prioridad sobre el fin de oleada.
- **`gameover → lobby`**: solo por mensaje del anfitrión. Se limpia el mundo y se acepta de nuevo
  a jugadores (FR-032, FR-037).

## Reglas de validación (servidor)

- **Nombre**: se recorta a 12 caracteres y se eliminan los caracteres de control. Si queda vacío,
  se usa `Jugador N`.
- **`input`**: `dx` y `dy` se fuerzan a {-1, 0, 1} y `fire` a booleano. Se ignora si el jugador
  está muerto o si la fase no es `playing` ni `intermission`.
- **`weapon`**: se ignora si el arma está bloqueada (`ammo[i] === -1`). Se permite seleccionar
  armas con munición 0 (spec, Edge Cases).
- **`start` y `lobby`**: se ignoran si el emisor no es `hostId` o si la fase no es la esperada.
- **Colocar**: la casilla destino es la adyacente en la dirección `dir`. Debe ser suelo, sin
  colocable y sin jugador ni enemigo encima. Si no, no se coloca nada ni se consume munición
  (FR-013).
