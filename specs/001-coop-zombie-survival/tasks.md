---

description: "Lista de tareas para Supervivencia co-op contra zombis (MVP)"
---

# Tasks: Supervivencia co-op contra zombis (MVP)

**Input**: documentos de diseño en `/specs/001-coop-zombie-survival/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/network.md, quickstart.md

**Tests**: el principio V de la constitución exige tests de Vitest para la lógica no trivial de
`shared/`. Se escriben antes que la función que cubren y deben fallar primero. El servidor y el
cliente se validan a mano con [quickstart.md](./quickstart.md).

**Organization**: las tareas se agrupan por historia de usuario. Cada historia termina jugable y
con un commit.

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (archivos distintos y sin dependencias pendientes).
- **[Story]**: historia de la spec a la que pertenece (US1…US5).
- Las rutas son relativas a la raíz del repo `D:\boxhead`.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: monorepo con 3 workspaces, versiones fijadas (research R1) y arranque en
desarrollo (R11).

- [X] T001 Crear el `package.json` raíz:
  - `"private": true`, `"type": "module"` y `"workspaces": ["shared","server","client"]`;
  - scripts `"dev": "node scripts/dev.mjs"`, `"test": "npm test -w @game/shared"` y
    `"typecheck": "npm run typecheck --workspaces"`;
  - crear también `.gitignore` con `node_modules/` y `dist/`.
- [X] T002 [P] Crear `tsconfig.base.json` con estas opciones:
  - `strict: true`;
  - `target`/`lib` `ES2023` + `DOM`;
  - `module`/`moduleResolution` `NodeNext`;
  - `erasableSyntaxOnly: true`;
  - `allowImportingTsExtensions: true`;
  - `rewriteRelativeImportExtensions: true`;
  - `noEmit: true`;
  - `skipLibCheck: true`;
  - `verbatimModuleSyntax: true`.
- [X] T003 [P] Crear `shared/package.json` y `shared/tsconfig.json` (extiende la base):
  - nombre `@game/shared`, `"type": "module"`;
  - `"main"` y `"exports"`: `"./src/index.ts"`;
  - scripts `test: vitest run` y `typecheck: tsc -p .`;
  - devDeps `vitest@~5.0.5` y `typescript@~7.0.2`.
- [X] T004 [P] Crear `server/package.json` y `server/tsconfig.json`:
  - nombre `@game/server`, `"type": "module"`;
  - deps `@colyseus/core@~0.18.19`, `@colyseus/ws-transport@~0.18.4`,
    `@colyseus/schema@~5.0.41` y `@game/shared@*`;
  - scripts `dev: node --watch src/index.ts` y `typecheck: tsc -p .`.
- [X] T005 [P] Crear `client/package.json` y `client/tsconfig.json`:
  - nombre `@game/client`, `"type": "module"`;
  - deps `phaser@~4.2.1`, `@colyseus/sdk@~0.18.5` y `@game/shared@*`;
  - devDep `vite@~8.3.4`;
  - scripts `dev: vite --host` y `typecheck: tsc -p .`;
  - el `tsconfig` usa `moduleResolution: Bundler`.
- [X] T006 [P] Crear `scripts/dev.mjs` (~10 líneas). Lanza `npm run dev -w @game/server` y
  `npm run dev -w @game/client` con `{ stdio: 'inherit', shell: true }`, y si uno termina mata
  al otro.
- [X] T007 Ejecutar `npm install` y comprobar que `node_modules/@game/shared` enlaza a `shared/`.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: datos estáticos, mapa, física pura, schema del estado, servidor vacío y cascarón del
cliente. Todo esto lo usan todas las historias.

**⚠️ CRITICAL**: no empezar ninguna historia antes de terminar esta fase.

- [X] T008 [P] Crear `shared/src/config.ts` con todas las tablas y constantes de research R12:
  - `TILE=32`, `TICK_HZ=30` y `PATCH_MS=50`.
  - `PLAYER`: `{ hp:100, speed:150, radius:12 }`.
  - `ENEMIES`: índice 0 zombi, índice 1 diablo.
  - `WEAPONS`, en el orden `pistol, uzi, shotgun, barricade, grenade, barrel, mine`. Campos:
    `name` (nombre visible en español), `kind` (`'hitscan'|'thrown'|'placeable'`), `damage`,
    `rate`, `range`, `pellets`, `spread`, `radius`, `ammo` y `unlockMultiplier`. La pistola tiene
    `ammo: -2` (infinita).
  - `COMBO`: `{ window:2.5, perLevel:5 }`.
  - `WAVES`: `{ intermission:5, spawnEvery:0.4, maxAlive:60 }`.
  - `DROPS`: `{ chance:0.12, ammoShare:0.7, ammoRefill:0.5, heal:25 }`.
  - `DIRS`: 8 vectores unitarios, índice 0=E y en sentido horario (0=E, 1=SE, 2=S, 3=SO, 4=O,
    5=NO, 6=N, 7=NE).
  - Helper `dirFrom(dx,dy)`.
- [X] T009 [P] Escribir en `shared/test/map.test.ts` tests que fallen y comprueben:
  - `parseMap(MAP)` devuelve `w=40` y `h=30`;
  - el borde es todo pared;
  - hay ≥4 `P` y ≥6 `S`;
  - toda casilla `P` y `S` es suelo y se alcanza desde la primera `P` (BFS en el test).
- [X] T010 [P] Crear `shared/src/map.ts` con:
  - `MAP`: 30 strings de 40 caracteres con la leyenda `#` pared, `.` suelo, `P` inicio de
    jugador (≥4) y `S` aparición de enemigos (≥6). El diseño es de "habitaciones": 4-6 salas
    unidas por pasillos y puertas de 2 casillas, con las apariciones en los bordes del mapa;
  - `parseMap()`, que devuelve
    `{ w, h, solid: Uint8Array, playerSpawns: {x,y}[], enemySpawns: {x,y}[] }`, con los puntos en
    coordenadas de casilla;
  - helpers `isSolid(map,tx,ty)` (fuera de límites cuenta como sólido) y `tileCenter(t)`.

  Debe hacer pasar T009.
- [X] T011 [P] Escribir en `shared/test/physics.test.ts` tests que fallen y comprueben:
  - `moveCircle` desliza contra una pared sin entrar, también en diagonal contra una esquina;
  - `moveCircle` respeta el callback extra `blocked(tx,ty)`;
  - `raycast` se detiene en una pared con `hit` indefinido;
  - `raycast` devuelve el más cercano de 2 círculos en la línea;
  - `raycast` ignora un círculo que está detrás de una pared;
  - `circlesOverlap`.
- [X] T012 Crear `shared/src/physics.ts` con:
  - `moveCircle(map, blocked, pos, dx, dy, speed, radius, dt)`: resuelve por ejes, normaliza
    las diagonales y muta `pos`;
  - `raycast(map, x, y, dirX, dirY, range, targets: {x,y,radius}[])`: DDA sobre la rejilla y
    test rayo-círculo. Devuelve `{ hit?, endX, endY }`;
  - `circlesOverlap(a, ra, b, rb)`.

  Debe hacer pasar T011. Depende de T010.
- [X] T013 Crear `shared/src/index.ts`, que re-exporta `config.ts`, `map.ts` y `physics.ts`.
  `flowfield.ts` y `rules.ts` se añaden cuando existan.
- [X] T014 [P] Crear `server/src/state.ts` con todos los schemas de data-model.md. Se usa
  `schema({...}, 'Name')` con `t.*` de `@colyseus/schema`, sin decoradores (research R3):
  - **`GameState`**: `phase` string `lobby|playing|intermission|gameover`, `hostId`, `wave`
    uint16, `waveTimer` float32, `toSpawn` uint16 y los maps `players`, `enemies`, `projectiles`,
    `placeables` y `crates`.
  - **`Player`**: `name`, `color` uint8, `joinOrder` uint32, `x`/`y` float32, `dir` uint8, `hp`
    uint8, `alive` boolean, `score` uint32, `combo` uint16, `comboTime` float32, `weapon` uint8 y
    `ammo` array de int16. Para `ammo`: "`-1` = bloqueada, `0..n` = munición. La pistola usa
    `-2` = infinita".
  - **`Enemy`**: `kind`, `x`, `y`, `dir` y `hp`.
  - **`Projectile`**: `kind`, `x` e `y`.
  - **`Placeable`**: `kind`, `tx`, `ty` y `hp`.
  - **`Crate`**: `kind`, `x` e `y`.
- [X] T015 Crear `server/src/index.ts`: `defineServer` con `WebSocketTransport`, la sala
  `"game"` registrada como `GameRoom` vía `defineRoom`, y escucha en el puerto `2567`. Crear
  `server/src/GameRoom.ts` como una subclase vacía de `Room` con `state = new GameState()`.
  Verificar que arranca con `npm run dev -w @game/server`.
- [X] T016 [P] Crear `client/index.html`:
  - título "Box Survival";
  - contenedor `#game` del canvas;
  - capas `#menu`, `#lobby`, `#hud`, `#gameover` y `#toast`, todas ocultas salvo `#menu`;
  - CSS mínimo inline: fondo oscuro, paneles centrados, botones grandes y HUD arriba a la
    izquierda con `pointer-events:none`.
- [X] T017 [P] Crear `client/src/ui.ts` con:
  - `show(screen)`, que alterna qué capa se ve;
  - `toast(text, ms)`;
  - el helper de consulta `$()`.

  No contiene lógica de juego.
- [X] T018 Crear `client/src/main.ts`:
  - el `Game` de Phaser (`parent: 'game'`, `pixelArt: false`, `scale: RESIZE`), con la escena
    `GameScene` sin arrancar;
  - el `Client` de Colyseus apuntando a `ws://${location.hostname}:2567`.

  Comprobar con `npm run dev` que el menú aparece en `http://localhost:5173`.

**Checkpoint**:
- `npm test` está en verde (mapa y física);
- `npm run typecheck` termina limpio;
- `npm run dev` sirve el menú y arranca el servidor vacío.

---

## Phase 3: User Story 1 - Crear sala y sobrevivir en solitario (Priority: P1) 🎯 MVP

**Goal**: un jugador crea una sala, espera en el lobby como anfitrión y pulsa "Empezar". Se
mueve en 8 direcciones y dispara la pistola (hitscan) contra zombis que lo persiguen rodeando
paredes. Al morir, la partida termina.

**Independent Test**: [quickstart.md](./quickstart.md) "Historia 1", con una sola pestaña.

### Tests de la User Story 1

- [X] T019 [P] [US1] Escribir en `shared/test/flowfield.test.ts` tests que fallen y comprueben:
  - las distancias crecen al alejarse de 2 orígenes;
  - una pared obliga a rodear, así que la distancia es mayor que la Manhattan;
  - no se cortan esquinas: no se toma una diagonal entre 2 paredes;
  - una casilla inalcanzable vale `Infinity`;
  - `nextStep` devuelve el vecino de menor distancia.

### Implementación de la User Story 1

- [X] T020 [US1] Crear `shared/src/flowfield.ts` y exportarlo desde `shared/src/index.ts`:
  - `buildFlowField(map, sources: {tx,ty}[], extraCost?: (tx,ty)=>number)`: Dijkstra
    multi-origen con 8 vecinos.
    - La diagonal cuesta 1,414.
    - Una diagonal no se permite si alguno de sus vecinos ortogonales es sólido.
    - Las paredes son infranqueables.
    - `extraCost` se suma al entrar en una casilla.
    - Devuelve un `Float32Array`.
  - `nextStep(field, map, tx, ty)`, que devuelve `{tx,ty} | null`.

  Usar un heap binario sobre array con el comentario
  `// ponytail: plain binary heap, fine for 1200 cells`. Debe hacer pasar T019.
- [X] T021 [US1] Ciclo de vida de la sala en `server/src/GameRoom.ts`:
  - **`onCreate`**:
    - `this.roomId` = código aleatorio de 5 letras de `ABCDEFGHJKLMNPQRSTUVWXYZ`, con el
      comentario `// ponytail: no collision check, query matchMaker if deployed`;
    - `maxClients = 4`, `setSimulationInterval(tick, 1000/TICK_HZ)` y `setPatchRate(PATCH_MS)`.
  - **`onJoin(client, {name})`**: crea un `Player` así:
    - nombre: "se recorta a 12 caracteres y se eliminan los caracteres de control. Si queda
      vacío, se usa `Jugador N`";
    - `color` = primer libre 0-3 y `joinOrder` = contador de la sala;
    - `ammo = [-2,-1,-1,-1,-1,-1,-1]`;
    - si `hostId` está vacío, toma el sessionId del jugador.
  - **`onLeave`**: borra al jugador.
  - Mapa solo de servidor: `inputs: Map<sessionId,{dx,dy,fire,cooldown}>`.
- [X] T022 [US1] Mensajes en `server/src/GameRoom.ts`:
  - **`start`**: se ignora si el emisor no es `hostId` o si `phase!=='lobby'`. Resetea mundo y
    jugadores (hp 100, `alive`, posiciones en las `P`) y pone `phase='playing'`, `wave=1` y
    `toSpawn=12`. La US3 sustituye este valor provisional por `waveComposition`.
  - **`input`**: aplica "`dx` y `dy` se fuerzan a {-1, 0, 1} y `fire` a booleano. Se ignora si
    el jugador está muerto o si la fase no es `playing` ni `intermission`".
- [X] T023 [US1] Jugadores en `tick(dtMs)` de `server/src/GameRoom.ts`. Para cada jugador vivo:
  - mover con `moveCircle` según su input;
  - si se mueve, `dir = dirFrom(dx,dy)`;
  - disparo de pistola cuando `fire` y `cooldown<=0`:
    - `raycast` desde el jugador en `DIRS[dir]` contra los círculos de los enemigos;
    - aplicar el daño;
    - `broadcast('shot',{x1,y1,x2,y2,w})`;
    - `cooldown = 1/rate`.
- [X] T024 [US1] Zombis en `tick` de `server/src/GameRoom.ts`:
  - aparece un zombi cada `WAVES.spawnEvery` s mientras `toSpawn>0` y `enemies.size<maxAlive`,
    en las `S` por turnos, saltando las ocupadas por un jugador;
  - el campo de flujo se reconstruye cada 250 ms desde las casillas de los jugadores vivos;
  - cada enemigo avanza hacia el centro de `nextStep` a su velocidad y actualiza `dir`;
  - separación por pares, con el comentario
    `// ponytail: O(n²) separation, spatial hash if maxAlive grows`;
  - daño cuerpo a cuerpo al contacto cada `meleeRate`;
  - un jugador con hp 0 pasa a `alive=false`;
  - los enemigos muertos se eliminan;
  - si todos los jugadores están muertos, `phase='gameover'`.
- [X] T025 [P] [US1] Crear `client/src/art.ts` con `makeTextures(scene)`, usando
  `Graphics.generateTexture` (research R10). Genera:
  - `floor` (casilla 32×32) y `wall` (cubo 32×48 con cara superior clara y frontal oscura);
  - personajes `p0..p3_d0..d7` (4 colores de jugador) y `z_d0..d7` (zombi verde). Cada uno es
    una caja de cuerpo en vista 3/4, una caja de cabeza y un brazo/arma orientado hacia la
    dirección d.
- [X] T026 [US1] Crear `client/src/GameScene.ts`:
  - **`create()`**: llama a `makeTextures`, pinta el mapa desde `parseMap(MAP)` (paredes con
    depth = y) y mantiene un `Map<id, Sprite>` para jugadores y enemigos.
  - **`update()`**, en cada frame:
    - sincroniza los sprites con `room.state`: crea los que faltan y destruye los que sobran;
    - fija la textura por tipo, color y dirección, y depth = y;
    - acerca las entidades remotas a la posición del servidor con factor 0,25.
  - La cámara sigue al jugador local.
- [X] T027 [US1] Input y predicción en `client/src/GameScene.ts`:
  - lee flechas, WASD y espacio, y envía `room.send('input',{dx,dy,fire})` solo cuando cambia el
    estado;
  - predice el movimiento propio con el mismo `moveCircle`;
  - corrige un 20 % por frame hacia la posición del servidor y hace snap si el error supera
    64 px, con el comentario `// ponytail: lerp correction, snapshot buffer if jitter`;
  - con el evento `shot`, dibuja una estela de 100 ms;
  - muestra el recordatorio de controles los primeros 10 s (FR-034).
- [X] T028 [US1] Flujo de pantallas en `client/src/main.ts` y `client/src/ui.ts`:
  - `#menu` tiene el input de nombre (`maxlength=12`) y "Crear sala", que llama a
    `client.create('game',{name})`;
  - `#lobby` muestra el código, la lista de jugadores y "Empezar". Ese botón solo es visible si
    `room.sessionId===state.hostId` y envía `start`;
  - el enrutado sigue `state.phase`:
    - `lobby` → `#lobby`;
    - `playing|intermission` → arranca `GameScene` y muestra `#hud`;
    - `gameover` → `#gameover` con el texto "Fin de la partida".
  - El `#hud` mínimo muestra la vida y el código de sala.
- [X] T029 [US1] Validar los 6 pasos de quickstart "Historia 1", ejecutar `npm test` y hacer
  commit `feat: playable solo room with pistol and chasing zombies (US1)`.

**Checkpoint**: MVP jugable en solitario.

---

## Phase 4: User Story 2 - Jugar con amigos por código o enlace (Priority: P2)

**Goal**: hasta 4 jugadores entran en el lobby por código o enlace y juegan sincronizados. El
anfitrión puede cambiar y los rechazos dan mensajes claros.

**Independent Test**: [quickstart.md](./quickstart.md) "Historia 2", con 5 pestañas.

- [X] T030 [US2] En `server/src/GameRoom.ts`:
  - `onAuth` lanza un error con mensaje `IN_PROGRESS` si `state.phase!=='lobby'`;
  - si sale el anfitrión, `onLeave` pasa `hostId` al jugador restante de menor `joinOrder`
    (FR-038);
  - se mantiene el `autoDispose` por defecto para que la sala se cierre al quedar vacía
    (FR-005).
- [X] T031 [P] [US2] Entrar por código o enlace en `client/src/main.ts`:
  - el input de código de `#menu` y "Entrar" llaman a
    `client.joinById(code.trim().toUpperCase(),{name})`;
  - al cargar con `?room=CODE`, rellena el código y pone el foco en el nombre, de forma que
    Enter entra.
- [X] T032 [US2] En `client/src/main.ts`, traducir los errores de entrada:
  - room id inválido → "Sala no encontrada";
  - sala bloqueada → "Sala llena";
  - `IN_PROGRESS` → "Partida en curso";
  - cualquier otro → "No se pudo conectar".

  El mensaje se muestra en `#menu`, que sigue visible.
- [X] T033 [P] [US2] Sala de espera en `client/src/ui.ts`:
  - "Copiar enlace" hace `navigator.clipboard.writeText(location.origin+'/?room='+code)`;
  - la lista de jugadores muestra nombre, muestra de color y la marca "(anfitrión)";
  - quien no es anfitrión ve "Esperando al anfitrión" en lugar de "Empezar".
- [X] T034 [US2] En `client/src/GameScene.ts`, poner el nombre de cada jugador como etiqueta de
  texto sobre la cabeza, siguiendo al sprite. Al salir un jugador, borrar su sprite y su
  etiqueta.
- [X] T035 [US2] Validar los 9 pasos de quickstart "Historia 2" y hacer commit
  `feat: join rooms by code or link with host handover (US2)`.

**Checkpoint**: 4 jugadores sincronizados, y la US1 sigue funcionando sola.

---

## Phase 5: User Story 3 - Oleadas, diablos, combos y nuevas armas (Priority: P3)

**Goal**:
- oleadas numeradas que escalan;
- diablos con bolas de fuego;
- combo por jugador que multiplica puntos y desbloquea uzi, escopeta y granadas;
- cajas de munición y vida;
- reaparición en la siguiente oleada.

**Independent Test**: [quickstart.md](./quickstart.md) "Historia 3", en solitario.

### Tests de la User Story 3

- [X] T036 [P] [US3] Escribir en `shared/test/rules.test.ts` tests que fallen:
  - **`registerKill`**:
    - suma 1 al combo;
    - `score += points × (1+floor(combo/5))`;
    - en combo 5 devuelve `[1]` (uzi) y pone `ammo[1]` a la dotación de la uzi;
    - en combo 10 devuelve `[2]`;
    - nunca desbloquea dos veces.
  - **`tickCombo`**: pone `combo` a 0 cuando `comboTime` llega a 0.
  - **`waveComposition`**:
    - el total crece con n y con el número de jugadores;
    - hay 0 diablos en la oleada 1;
    - los diablos no pasan del 40 % del total.

### Implementación de la User Story 3

- [X] T037 [US3] Crear `shared/src/rules.ts` con `registerKill(player, points)`,
  `tickCombo(player, dt)` y `waveComposition(n, players)`, según research R12 y data-model.md.
  Exportarlas desde `shared/src/index.ts` y hacer pasar T036.
- [X] T038 [US3] Máquina de oleadas de data-model.md en `server/src/GameRoom.ts`:
  - **`start`**: pasa a `intermission` con `waveTimer=5`.
  - **`intermission → playing`**: `toSpawn` sale de `waveComposition`. El reparto de diablos se
    guarda en una cola del servidor.
  - **`playing → intermission`**: ocurre con `toSpawn=0` y sin enemigos.
    - `wave++`.
    - Los muertos reaparecen en una `P` libre con vida completa, conservando armas, munición y
      puntos (FR-030).
  - **gameover**: tiene prioridad sobre el fin de oleada si mueren todos.
- [X] T039 [US3] Diablos en `server/src/GameRoom.ts`:
  - aparecen según la cola;
  - lanzan una bola de fuego (`Projectile` kind 1) cuando `fireCooldown<=0`, el objetivo está a
    menos de `fireRange` y hay línea de visión (`raycast` solo contra paredes);
  - los proyectiles avanzan cada tick y se eliminan al entrar en casilla sólida, al agotar el
    alcance o al tocar a un jugador, al que aplican `fireDamage`.
- [X] T040 [US3] Muertes y cajas en `server/src/GameRoom.ts`:
  - cada muerte de enemigo llama a `registerKill(killer, ENEMIES[kind].points)`;
  - por cada índice desbloqueado, `broadcast('unlock',{id,w})`;
  - `tickCombo` se aplica a cada jugador en cada tick;
  - al morir un enemigo puede soltar un `Crate` con probabilidad `DROPS.chance`: de munición con
    probabilidad `ammoShare`, si no de vida;
  - al recogerla (solapamiento):
    - la de munición suma `ceil(WEAPONS[i].ammo*ammoRefill)` a cada arma desbloqueada salvo la
      pistola;
    - la de vida suma `heal`, con tope 100.
- [X] T041 [US3] Armas en `server/src/GameRoom.ts`:
  - **Mensaje `weapon`**: acepta `{index}` o `{step}` e ignora las armas bloqueadas ("Se permite
    seleccionar armas con munición 0"). `step` salta las bloqueadas.
  - **Disparo según `WEAPONS[weapon].kind`**:
    - `hitscan`, con `pellets` y `spread` (la escopeta lanza 7 rayos en 30°);
    - `thrown`, que crea un `Projectile` granada (kind 0) con velocidad hacia `dir`, que cae a
      200 px y explota cuando `fuse` llega a 0.
  - **Explosiones**: dañan a los enemigos dentro de `radius`, nunca a jugadores (FR-014), y
    emiten `broadcast('boom',{x,y,r})`.
  - **Munición**: cada disparo la consume, y con 0 no se dispara.
  - **Mensaje `debugUnlock`**: solo si `process.env.NODE_ENV!=='production'`. Desbloquea todas las
    armas con su dotación.
- [X] T042 [P] [US3] En `client/src/art.ts`, añadir las texturas `d_d0..d7` (diablo rojo con
  cabeza mayor), `fireball`, `grenade`, `crate_ammo` y `crate_hp`.
- [X] T043 [US3] En `client/src/GameScene.ts`:
  - pintar diablos, proyectiles y cajas, sincronizados igual que los enemigos;
  - con `boom`, un círculo que se expande durante 300 ms;
  - Q/E envían `{step:-1|1}` y las teclas 1-7 envían `{index}`;
  - si el jugador local está muerto, la cámara sigue a un compañero vivo (espectador).
- [X] T044 [US3] En `client/src/main.ts`, `client/src/ui.ts` y `client/index.html`:
  - el `#hud` añade nombre del arma, munición (∞ si es -2), combo `×multiplicador` con una barra
    de `comboTime`, y la oleada;
  - aparece el aviso "Oleada N" cuando `phase` pasa a `intermission`;
  - el evento `unlock` con mi id muestra el toast "¡Nueva arma: X!";
  - con `?debug=1`, se envía `debugUnlock` al empezar la partida.
- [X] T045 [US3] Validar los 5 pasos de quickstart "Historia 3", ejecutar `npm test` y hacer
  commit `feat: waves, devils, combo unlocks and crates (US3)`.

**Checkpoint**: progresión completa con armas de disparo y granadas.

---

## Phase 6: User Story 4 - Armas colocables: barricadas, barriles y minas (Priority: P4)

**Goal**: el jugador coloca barricadas, barriles y minas en la casilla de delante:
- los enemigos rodean o rompen las barricadas;
- los barriles explotan en cadena;
- las minas explotan al pisarlas;
- nada daña a los jugadores.

**Independent Test**: [quickstart.md](./quickstart.md) "Historia 4", con `?debug=1`.

### Tests de la User Story 4

- [X] T046 [P] [US4] Añadir a `shared/test/rules.test.ts` tests que fallen de
  `resolveExplosions`:
  - 3 barriles en fila dentro del radio explotan;
  - un 4.º barril fuera del radio no explota;
  - un origen sin barriles cerca devuelve solo su propia explosión.
- [X] T047 [P] [US4] Añadir a `shared/test/flowfield.test.ts` tests que fallen de `extraCost`:
  - si hay un desvío corto, la ruta evita una barricada de coste 20;
  - si no hay alternativa, la ruta la atraviesa.

### Implementación de la User Story 4

- [X] T048 [US4] Añadir a `shared/src/rules.ts` la función
  `resolveExplosions(origins:{x,y,r}[], barrels:{x,y,r}[])`. Hace un BFS por radio y devuelve la
  lista ordenada de explosiones, incluidos los barriles encadenados. Debe hacer pasar T046 y T047
  (T047 ya debería pasar con el `extraCost` de T020).
- [X] T049 [US4] Colocación (`kind==='placeable'`) en `server/src/GameRoom.ts`:
  - la casilla destino es la adyacente en `DIRS[dir]`;
  - la regla de FR-013 / data-model: "Debe ser suelo, sin colocable y sin jugador ni enemigo
    encima. Si no, no se coloca nada ni se consume munición";
  - se crea un `Placeable` con clave `"tx,ty"` y hp 150 (barricada) o 1 (barril);
  - se fuerza la reconstrucción del campo de flujo.
- [X] T050 [US4] Interacción de los colocables con el mundo, en `server/src/GameRoom.ts`:
  - barricadas y barriles son sólidos en el callback `blocked` de `moveCircle`, para jugadores y
    enemigos;
  - el `extraCost` del campo de flujo devuelve 20 en sus casillas;
  - un enemigo cuyo `nextStep` es una barricada o un barril se detiene y le hace daño cuerpo a
    cuerpo;
  - con hp ≤0, la barricada se elimina y el barril explota;
  - los `targets` del hitscan incluyen los barriles;
  - toda explosión (granada, barril o mina) pasa por `resolveExplosions` y daña a enemigos y
    barricadas dentro del radio, nunca a jugadores;
  - una mina explota cuando un enemigo entra en su casilla;
  - las muertes por explosión se atribuyen al `ownerId` del colocable o de la granada.
- [X] T051 [P] [US4] En `client/src/art.ts`, añadir las texturas `barricade` (cubo de madera),
  `barrel` (caja roja casi cilíndrica) y `mine` (disco plano).
- [X] T052 [US4] En `client/src/GameScene.ts`, pintar los colocables según su tipo en el centro
  de su casilla, con depth = y. Al salir del estado, se borra su sprite.
- [X] T053 [US4] Validar los 5 pasos de quickstart "Historia 4", ejecutar `npm test` y hacer
  commit `feat: placeable barricades, chain-reacting barrels and mines (US4)`.

**Checkpoint**: táctica de colocables completa.

---

## Phase 7: User Story 5 - HUD completo, fin de partida y reinicio (Priority: P5)

**Goal**: HUD completo con marcador, pantalla de fin con la puntuación de cada jugador y vuelta
a la sala controlada por el anfitrión.

**Independent Test**: [quickstart.md](./quickstart.md) "Historia 5", con 2 pestañas.

- [X] T054 [US5] Mensaje `lobby` en `server/src/GameRoom.ts`:
  - se ignora si no viene de `hostId` o si `phase!=='gameover'`;
  - vacía enemigos, proyectiles, colocables y cajas;
  - resetea a cada jugador: puntos 0, combo 0, hp 100, `ammo=[-2,-1,-1,-1,-1,-1,-1]` y arma 0;
  - pone `phase='lobby'` y `wave=0`, de modo que vuelve a aceptar entradas (FR-032, FR-037).
- [X] T055 [P] [US5] En `client/src/ui.ts` y `client/index.html`, añadir al HUD el marcador:
  todos los jugadores con muestra de color, nombre y puntos, ordenados por puntos y actualizados
  en cada frame desde el estado (FR-033).
- [X] T056 [US5] Pantalla `#gameover` en `client/src/ui.ts`, `client/src/main.ts` y
  `client/index.html`:
  - muestra la oleada alcanzada y las puntuaciones de cada jugador, ordenadas;
  - "Volver a la sala" solo aparece para el anfitrión y envía `lobby`;
  - los demás ven "Esperando al anfitrión";
  - cuando `phase` pasa a `lobby`, se para `GameScene` y se muestra `#lobby`.
- [X] T057 [US5] Validar los 5 pasos de quickstart "Historia 5" y hacer commit
  `feat: full HUD, game over screen and return to lobby (US5)`.

**Checkpoint**: ciclo completo de partida.

---

## Phase 8: Polish & cross-cutting

- [X] T058 Ejecutar `npm run typecheck` y `npm test` y corregir todos los errores en todos los
  workspaces.
- [X] T059 Pase de rendimiento (SC-003):
  - con `?debug=1` y 4 pestañas, llegar a 60 enemigos;
  - comprobar que el juego va a 50 fps o más;
  - si no llega, reutilizar los gráficos de estelas y explosiones (pool) en
    `client/src/GameScene.ts`.
- [X] T060 Pase de latencia (SC-004): con throttling de 150 ms en DevTools, ajustar los
  factores de corrección y suavizado de `client/src/GameScene.ts`.
- [X] T061 Recorrer [quickstart.md](./quickstart.md) completo. Verificar que están todos los
  comentarios `ponytail:` de research R4, R7 y R8. Hacer commit `chore: polish and validate MVP`.

---

## Dependencies & Execution Order

### Phase Dependencies

| Fase | Depende de | Nota |
|------|------------|------|
| Setup (1) | — | |
| Foundational (2) | Setup | Bloquea todas las historias |
| US1 (3) | Foundational | |
| US2 (4) | US1 | Comparte `GameRoom.ts`, `main.ts` y `GameScene.ts`, y necesita el lobby de la US1 |
| US3 (5) | US1 | Independiente de la US2; se prueba en solitario |
| US4 (6) | US3 | Necesita el sistema de armas y explosiones, y `debugUnlock` |
| US5 (7) | US1 | Gana con la US2 y la US3, pero se prueba con 2 pestañas sobre US1+US2 |
| Polish (8) | Historias deseadas | |

### Dentro de cada historia

- Orden: primero los tests de `shared/` (que deben fallar), luego la función pura, luego el
  servidor y por último el cliente.
- Las tareas sobre el mismo archivo (`GameRoom.ts`, `GameScene.ts`) van en serie, en orden de ID.
- Commit al cerrar cada historia (constitución: un commit por historia completada).

### Parallel Opportunities

- **Setup**: T002-T006 en paralelo tras T001.
- **Foundational**:
  - T008, T009, T010, T011, T014, T016 y T017 en paralelo;
  - T012 tras T010;
  - T013 tras T008, T010 y T012;
  - T015 tras T014;
  - T018 tras T016 y T017.
- **US1**: T019 y T025 en paralelo con el servidor (T021-T024).
- **US3**: T036 y T042 en paralelo entre sí y con el servidor.
- **US4**: T046, T047 y T051 en paralelo.

## Parallel Example: User Story 1

```bash
Task: "Tests de campo de flujo que fallen en shared/test/flowfield.test.ts"   # T019
Task: "Texturas de personajes y casillas en client/src/art.ts"                # T025
# después, en serie: T020 → T021 → T022 → T023 → T024 (GameRoom.ts) y T026 → T027 (GameScene.ts) → T028
```

## Implementation Strategy

### MVP primero (solo User Story 1)

1. Fase 1 y Fase 2.
2. Fase 3 (US1). **Parar y validar** con quickstart "Historia 1".

### Entrega incremental

1. US1: juego en solitario.
2. US2: multijugador de 4 (el objetivo principal del proyecto).
3. US3: progresión.
4. US4: táctica de colocables.
5. US5: ciclo de partida cerrado.
6. Pulido.

## Notes

- No añadir dependencias de runtime fuera de Phaser y Colyseus (principio III). Si algo parece
  necesitar una, anotarlo antes en plan.md → Complexity Tracking.
- No hay archivos de assets: todas las texturas salen de `client/src/art.ts` (principio IV).
- Los valores de balance solo viven en `shared/src/config.ts`. Se ajustan ahí.
