# Implementation Plan: Supervivencia co-op contra zombis (MVP)

**Branch**: `001-coop-zombie-survival` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-coop-zombie-survival/spec.md`

## Summary

Shooter co-op en el navegador para 1-4 jugadores por sala privada (código o enlace), con sala de
espera y anfitrión. Inspirado en las mecánicas de Boxhead: oleadas de zombis y diablos, combo que
desbloquea 6 armas y colocables (barricadas, barriles en cadena y minas).

Enfoque técnico:
- **Servidor autoritativo**: Colyseus 0.18. Simula a 30 Hz y envía patches delta cada 50 ms.
- **Cliente**: Phaser 4. Envía solo inputs, predice el movimiento propio y suaviza el de las
  entidades remotas.
- **Reglas**: viven en funciones puras de `shared/`, testeadas con Vitest: colisión, raycast
  hitscan, campo de flujo Dijkstra, combo, oleadas y explosiones.
- **Arte**: generado por código con `Graphics.generateTexture`.
- **Menús y HUD**: HTML/CSS sobre el canvas.

## Technical Context

**Language/Version**: TypeScript 7.0 (`strict`, `erasableSyntaxOnly`) sobre Node 24 LTS. En el
servidor se usa el type stripping nativo de Node.

**Primary Dependencies**:
- runtime: phaser 4.2.1, @colyseus/sdk 0.18.5, @colyseus/core 0.18.19, @colyseus/ws-transport
  0.18.4 y @colyseus/schema 5.0.41;
- desarrollo: vite 8.3.4, vitest 5.0.5 y typescript 7.0.2.

**Storage**: N/A. El estado vive en memoria mientras existe la sala.

**Testing**: Vitest sobre `shared/` (unitarios de funciones puras). Escenas y sala se verifican a
mano según [quickstart.md](./quickstart.md).

**Target Platform**: navegadores de escritorio actuales (Chromium, Firefox, Safari) y servidor
Node 24 en local o LAN.

**Project Type**: juego web multijugador (cliente SPA y servidor de tiempo real).

**Performance Goals**: 50 fps o más en el cliente con 4 jugadores y 60 enemigos. El tick de
servidor de 30 Hz se mantiene estable con 60 enemigos y recalcula el campo de flujo cada 250 ms.

**Constraints**: juego fluido hasta 150 ms de latencia (SC-004), sin assets externos (principio
IV) y sin dependencias de runtime fuera de Phaser y Colyseus.

**Scale/Scope**: unas pocas salas simultáneas en local, 4 jugadores por sala, 1 mapa de 40×30
casillas, 7 armas y 2 tipos de enemigo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|-----------|--------------|--------|
| I. Servidor autoritativo | El cliente solo envía `input`, `weapon`, `start`, `lobby` y `debugUnlock` ([contracts/network.md](./contracts/network.md)). Daño, puntos, spawns y oleadas se calculan en `GameRoom`. | ✅ |
| II. Lógica compartida y pura | Colisión, raycast, flujo, combo, oleadas y explosiones están en `shared/src/*` sin imports de Phaser, Colyseus, DOM ni Node, y operan sobre interfaces estructurales. | ✅ |
| III. Simplicidad (YAGNI) | Hay 5 dependencias de runtime, todas permitidas. No se usan `concurrently` ni `tsx` (R2, R11). La UI es HTML nativo (R9). No hay capas, repositorios ni factorías. Los atajos con techo se marcan con `ponytail:` (R4, R7, R8). | ✅ |
| IV. Arte original | `client/src/art.ts` genera todas las texturas. El nombre público queda pendiente: el `<title>` es "Box Survival" y no se usa la marca. | ✅ |
| V. Verificación por historia | Hay tests de Vitest por función pura ([data-model.md](./data-model.md)) y escenarios manuales por historia ([quickstart.md](./quickstart.md)). | ✅ |
| Restricciones técnicas | Workspaces `shared`, `server` y `client`. Docs en español y código en inglés. Sin despliegue. | ✅ |

**Post-design re-check (Phase 1)**: sin violaciones. El script `scripts/dev.mjs` es una utilidad
de desarrollo, no un paquete, y la constitución lo permite.

## Project Structure

### Documentation (this feature)

```text
specs/001-coop-zombie-survival/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones y valores de balance
├── data-model.md        # Fase 1: estado sincronizado, tablas y transiciones
├── quickstart.md        # Fase 1: guía de validación
├── contracts/
│   └── network.md       # Fase 1: mensajes, eventos y errores de entrada
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json             # workspaces: shared, server, client. Scripts: dev, test, typecheck
tsconfig.base.json       # strict, erasableSyntaxOnly, allowImportingTsExtensions
scripts/dev.mjs          # lanza server y client en paralelo

shared/                  # @game/shared: reglas puras, sin dependencias
├── package.json
├── src/
│   ├── index.ts         # re-exporta
│   ├── config.ts        # PLAYER, ENEMIES, WEAPONS, COMBO, WAVES, DROPS
│   ├── map.ts           # MAP (strings) + parseMap()
│   ├── physics.ts       # moveCircle, raycast, circlesOverlap
│   ├── flowfield.ts     # buildFlowField, nextStep
│   └── rules.ts         # registerKill, tickCombo, waveComposition, resolveExplosions
└── test/
    ├── physics.test.ts
    ├── flowfield.test.ts
    └── rules.test.ts

server/                  # @game/server: Colyseus
├── package.json
└── src/
    ├── index.ts         # defineServer + WebSocketTransport, puerto 2567
    ├── state.ts         # schemas: GameState, Player, Enemy, Projectile, Placeable, Crate
    └── GameRoom.ts      # ciclo de vida, mensajes, tick (usa shared/)

client/                  # @game/client: Vite + Phaser
├── package.json
├── index.html           # canvas + capas HTML (menú, sala de espera, HUD, fin)
└── src/
    ├── main.ts          # arranque, conexión con Colyseus, enrutado de pantallas
    ├── ui.ts            # capas DOM: menú, sala de espera, HUD, fin, avisos
    ├── art.ts           # generación de texturas
    └── GameScene.ts     # render del estado, input, predicción, efectos
```

**Structure Decision**: monorepo con 3 workspaces npm, como fija la constitución. Son 4 archivos
fuente en el cliente, 3 en el servidor y 6 en `shared/`. No se crean más carpetas hasta que un
archivo pase de unas 400 líneas.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
