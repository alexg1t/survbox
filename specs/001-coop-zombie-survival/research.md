# Research: Supervivencia co-op contra zombis (MVP)

Fecha: 2026-10-18. Las versiones se comprobaron con `npm view` y las APIs con los `.d.ts` publicados.

## R1. Versiones fijadas

- **Decisión**: fijar estas versiones con `~` en `package.json`:

  | Paquete | Versión |
  |---------|---------|
  | Node | 24 LTS (instalado 24.12.0) |
  | phaser | 4.2.1 |
  | @colyseus/core | 0.18.19 |
  | @colyseus/ws-transport | 0.18.4 |
  | @colyseus/schema | 5.0.41 |
  | @colyseus/sdk | 0.18.5 |
  | vite | 8.3.4 |
  | vitest | 5.0.5 |
  | typescript | 7.0.2 |

- **Razón**: son las últimas estables. Los paquetes de Colyseus 0.18 comparten protocolo, así que
  servidor y SDK van en la misma minor.
- **Alternativas**: el meta-paquete `colyseus` se descarta porque arrastra redis-driver,
  redis-presence, monitor, playground y auth, que no se usan (principio III). Phaser 3.x se descarta
  porque la 4 es la estable actual y mantiene `Graphics.generateTexture`.
- **Riesgo**: TypeScript 7 (compilador nativo) solo se usa para `tsc --noEmit`. Si da problemas de
  tooling, se fija `typescript@5.9` sin más cambios.

## R2. Ejecución del servidor TypeScript

- **Decisión**: el servidor se ejecuta con `node --watch src/index.ts`, usando el type stripping
  nativo de Node 24. El `tsconfig` activa:
  - `erasableSyntaxOnly`;
  - `allowImportingTsExtensions`;
  - `rewriteRelativeImportExtensions`.
  Los imports relativos llevan la extensión `.ts`.
- **Razón**: no hace falta `tsx` ni un paso de build en desarrollo, y es una dependencia menos.
- **Consecuencia**: las definiciones de schema no pueden usar decoradores (no son "erasable"). Se
  usa `schema({...})` con `t.*` (R3).
- **Alternativa / plan B**: `tsx` si Node rechaza el workspace `@game/shared` por estar enlazado en
  `node_modules`. Node resuelve el symlink a la ruta real (`shared/src`), así que no se espera ese
  problema.

## R3. Definición del estado sincronizado

- **Decisión**: definir el estado con `schema({ campo: t.number(), ... }, 'Nombre')` de
  `@colyseus/schema` 5.
- **Razón**: no requiere `experimentalDecorators`, es compatible con type stripping y lo
  documentan los `.d.ts` de la versión 5.
- **Alternativas**: clases con `@type()` (requieren decoradores) y `defineTypes` (más verboso).

## R4. Códigos de sala y errores de entrada

- **Decisión**: el código de sala se asigna en `onCreate` con `this.roomId = code`. Es un código
  de 5 letras sobre el alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ` (sin I ni O). El cliente entra con
  `client.joinById(code.trim().toUpperCase())`.
- **"Partida en curso"**: `onAuth` lanza un error con el código `IN_PROGRESS` si
  `state.phase !== 'lobby'`. **No** se usa `lock()`.
- **"Sala llena"**: `maxClients = 4`. Colyseus bloquea la sala automáticamente al llenarse, y el
  error de "sala bloqueada" se traduce a "Sala llena".
- **"Sala no encontrada"**: corresponde al error de room id inexistente.
- **Razón**: con `lock()`, una sala en partida y una sala llena dan el mismo error y no se pueden
  distinguir los mensajes de FR-003 y FR-037. Rechazar en `onAuth` sí da un mensaje propio.
- **Límite conocido**: si la sala está llena *y* en partida, se muestra "Sala llena". En ambos
  casos se rechaza la entrada, así que es aceptable.
- **Colisión de códigos**: hay 24⁵ ≈ 8 M combinaciones. En local se ignora, con un comentario
  `ponytail:` que indica comprobar con `matchMaker.query` si se despliega.

## R5. Disparo: hitscan frente a proyectiles

- **Decisión**: la pistola, la uzi y la escopeta son **hitscan**. El servidor lanza un rayo (DDA
  sobre la rejilla y test rayo-círculo contra enemigos y barriles), aplica el impacto al primer
  objetivo y emite un evento `shot` para que el cliente dibuje la estela. Solo las **granadas** y
  las **bolas de fuego** son proyectiles con estado.
- **Razón**: en Boxhead las balas son prácticamente instantáneas. El hitscan evita sincronizar
  decenas de balas por tick y es una función pura fácil de testear.
- **Alternativa**: balas como entidades en el estado. Se descarta por más tráfico, más código y
  ningún beneficio visible.
- **Ajuste tras implementar**: con puntería en 8 direcciones, un rayo fino casi nunca acierta. El
  radio de los enemigos se amplía 8 px para el hitscan (`BULLET_WIDTH` en `GameRoom.ts`).

## R6. Pathfinding de enemigos

- **Decisión**: un **campo de flujo** por Dijkstra multi-origen desde las casillas de los jugadores
  vivos, con 8 vecinos y sin cortar esquinas:
  - coste 1 por casilla de suelo;
  - coste 20 por casilla con barricada o barril;
  - las paredes son infranqueables.

  Se recalcula cada 250 ms o cuando se coloca o destruye un objeto colocable. Cada enemigo avanza
  hacia la casilla vecina de menor distancia. Si esa casilla tiene barricada o barril, se para y
  la golpea (FR-021).
- **Razón**: una sola pasada sirve a todos los enemigos. El coste de la barricada da gratis el
  comportamiento "rodear si hay ruta corta y romper si no".
- **Alternativas**: A* por enemigo (60 búsquedas por tick) y BFS puro con barricadas
  infranqueables (deja enemigos atascados si el jugador se encierra).

## R7. Netcode

- **Decisión**:
  - **Inputs**: el cliente envía `input` solo cuando cambia: dirección (-1/0/1 en cada eje) y
    disparo mantenido. El servidor guarda el último input de cada jugador y lo aplica en cada tick.
    El tick es de 30 Hz (`setSimulationInterval`) y el patch de 50 ms (`setPatchRate(50)`).
  - **Predicción local**: el cliente mueve su jugador con la misma función `moveCircle` de
    `shared/`. Mientras se mueve no corrige, porque la copia del servidor va ~RTT por detrás y
    corregir frenaría el movimiento. Parado, corrige con un lerp del 20 % por frame. Si el error
    supera 3 casillas (96 px), hace snap. Con 150 ms simulados (`COLYSEUS_LATENCY=150`), el
    movimiento propio es inmediato y al parar converge en <0,5 s.
  - **Entidades remotas**: suavizado exponencial hacia la última posición recibida.
- **Razón**: es el mínimo que cumple SC-004 (≤150 ms sin retraso perceptible) sin un búfer de
  snapshots ni reconciliación por secuencia.
- **Límite**: se marca con un comentario `ponytail:`. Si hay tirones con latencia variable, se
  pasa a interpolación con búfer de snapshots.

## R8. Colisiones

- **Decisión**: círculo contra rejilla, resuelto por ejes. Se mueve X, se empuja fuera de las
  casillas sólidas; luego se repite con Y.
  - Las casillas sólidas son paredes, barricadas y barriles.
  - Los enemigos se separan entre sí con un empuje por pares, O(n²) con n ≤ 60.
  - Los jugadores no chocan entre sí.
- **Razón**: son pocas líneas, deterministas y testeables. No hace falta motor de física.
- **Límite**: la separación O(n²) lleva comentario `ponytail:`. Si se sube el tope de enemigos,
  se cambia por un hash espacial.

## R9. Interfaz de menú, sala de espera, HUD y fin

- **Decisión**: capas **HTML/CSS** sobre el canvas, usando `index.html` y `ui.ts`. Phaser solo
  pinta el mundo y los efectos.
- **Razón**: los inputs de texto, botones y portapapeles (`navigator.clipboard`) son nativos
  (rung 4). Además son accesibles y no requieren el plugin DOM de Phaser.
- **Alternativa**: escenas de UI en Phaser. Implica más código para texto editable y botones.

## R10. Arte generado

- **Decisión**: `art.ts` genera al arrancar todas las texturas con `Graphics` →
  `generateTexture`. Vista oblicua 3/4: cada objeto es una caja con cara superior clara y cara
  frontal oscura. Texturas:
  - personaje (4 colores de jugador, zombi y diablo) × 8 direcciones: cuerpo, cabeza y
    "brazo/arma" orientado;
  - pared, suelo, barricada, barril, mina, cajas de munición y vida, granada y bola de fuego.

  La profundidad de cada sprite es su `y` en el mundo.
- **Razón**: cumple el principio IV con cero assets externos y un solo archivo.

## R11. Arranque en desarrollo

- **Decisión**: `npm run dev` ejecuta `scripts/dev.mjs`, un script de ~10 líneas con
  `child_process.spawn` que lanza en paralelo los scripts `dev` de `@game/server` (puerto 2567) y
  `@game/client` (Vite, puerto 5173) con `stdio: 'inherit'`. El cliente conecta a
  `ws://${location.hostname}:2567`, y eso funciona también en LAN.
- **Razón**: los scripts npm en Windows corren en `cmd.exe`, donde `&` no paraleliza. Así se
  evita añadir `concurrently` (principio III).

## R12. Valores de balance iniciales

Los valores viven en `shared/src/config.ts`. Se ajustan jugando sin tocar requisitos.

**Mundo y ritmo**

| Concepto | Valor |
|----------|-------|
| Casilla | 32 px |
| Mapa | 40 × 30 casillas |
| Tick | 30 Hz |
| Patch | 50 ms |

**Jugador**

| Concepto | Valor |
|----------|-------|
| Vida | 100 |
| Velocidad | 150 px/s |
| Radio | 12 px |

**Enemigos**

| Concepto | Zombi | Diablo |
|----------|-------|--------|
| Vida | 30 | 80 |
| Velocidad | 70 px/s | 105 px/s |
| Daño cuerpo a cuerpo | 10 cada 1 s | 15 cada 1 s |
| Puntos | 10 | 30 |

Bola de fuego del diablo: 15 de daño, 250 px/s, cada 2,5 s, alcance de 350 px y requiere línea de
visión.

**Armas**

| Arma | Daño | Cadencia | Alcance | Dotación |
|------|------|----------|---------|----------|
| Pistola | 15 | 3/s | 400 px | infinita |
| Uzi | 10 | 10/s | 380 px | 150 |
| Escopeta | 7 perdigones × 10, abanico de 30° | 1,2/s | 220 px | 30 |
| Granada | 80, radio 90 px | 1,5/s | lanzada a 200 px, mecha 1,2 s | 10 |
| Barricada | 150 de vida | — | — | 10 |
| Barril | 100, radio 80 px | — | — | 8 |
| Mina | 90, radio 70 px | — | — | 8 |

**Combo**

- Cada muerte suma +1 al combo y reinicia una ventana de 2,5 s.
- `multiplier = 1 + floor(combo / 5)`.
- Desbloqueos por multiplicador: ×2 uzi, ×3 escopeta, ×4 barricadas, ×5 granadas, ×6 barriles,
  ×7 minas.

**Oleadas**

- `enemies = round((8 + 4·N) · (1 + 0,5·(players − 1)))`.
- `devilRatio = min(0,05·(N − 1), 0,4)`.
- Tope de 60 enemigos vivos.
- Una aparición cada 0,4 s, rotando entre los puntos de aparición.
- Pausa de 5 s entre oleadas.

**Cajas**

- Probabilidad de caja al morir un enemigo: 12 %.
- De ellas, 70 % son de munición y 30 % de vida.
- La caja de munición da +50 % de la dotación de cada arma desbloqueada.
- La caja de vida da +25 de vida.
