<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Modified principles: placeholders → I. Servidor autoritativo; II. Lógica de juego compartida y
  pura; III. Simplicidad (YAGNI); IV. Arte original generado por código; V. Verificación por historia
- Added sections: Restricciones técnicas; Flujo de desarrollo; Governance
- Removed sections: none
- Templates: plan/spec/tasks templates read the constitution at runtime; no edits made here
- Deferred TODOs: none
-->

# Boxhead Online Constitution

## Core Principles

### I. Servidor autoritativo

- El cliente MUST enviar solo inputs: movimiento, dirección, disparo, cambio de arma y colocación.
- El servidor MUST decidir posiciones finales, daño, muertes, puntuación, combos, desbloqueos,
  spawns y oleadas.
- El cliente MAY predecir el movimiento propio e interpolar entidades remotas. Ante divergencia,
  MUST converger al estado del servidor.

**Razón**: es un co-op en red. Un único árbitro evita desincronización y trampas triviales.

### II. Lógica de juego compartida y pura

- Las reglas de juego MUST vivir en `shared/`: tablas de armas y enemigos, colisión, combo,
  oleadas y pathfinding.
- El código de `shared/` MUST NOT importar Phaser, Colyseus ni APIs del navegador o de Node.
- Las funciones de `shared/` MUST ser deterministas dado su input y MUST poder testearse con Vitest
  sin arrancar servidor ni cliente.

**Razón**: el servidor y la predicción del cliente usan las mismas reglas. Los bugs de gameplay
se reproducen en un test.

### III. Simplicidad (YAGNI)

- El código MUST NOT incluir abstracciones especulativas: interfaces con una sola implementación,
  factorías de un producto o configuración para valores que no cambian.
- Las dependencias de runtime permitidas son Phaser (cliente) y Colyseus (servidor). Las de
  herramientas son Vite, Vitest y TypeScript.
- Toda dependencia nueva MUST justificarse en el `plan.md` de la feature: qué resuelve y por qué
  no basta la plataforma o pocas líneas propias.
- Se prefiere la solución más corta que funciona. Los atajos con techo conocido MUST marcarse con
  un comentario `ponytail:` que nombre el límite y la mejora futura.

**Razón**: un proyecto pequeño se mantiene si el código es poco y aburrido.

### IV. Arte original generado por código

- El proyecto MUST NOT incluir sprites, sonidos, música, fuentes ni textos copiados del juego Flash
  original ni de otras obras con copyright.
- Los gráficos MUST generarse por código (Phaser Graphics → texturas) o venir de fuentes con
  licencia libre compatible (CC0), con la licencia registrada en el repo.
- El nombre público del juego MUST NOT usar la marca "Boxhead". "Boxhead Online" es un nombre de
  trabajo interno.

**Razón**: es una réplica de mecánicas, no de propiedad intelectual ajena.

### V. Verificación por historia

- Una historia de usuario MUST NOT darse por cerrada sin dos cosas:
  - `npm test` (Vitest sobre `shared/`) en verde;
  - una prueba manual con 4 pestañas en la misma sala que confirme sus criterios de aceptación.
- Toda lógica no trivial de `shared/` MUST tener al menos un test que falle si la lógica se rompe.
  Esto incluye ramas, bucles, cálculos de daño y puntuación, y pathfinding.
- El código de escenas Phaser y de salas Colyseus se verifica manualmente. No se exige suite de
  tests propia.

**Razón**: los tests cubren las reglas; la prueba multi-pestaña cubre la red y la sensación de juego.

## Restricciones técnicas

- **Lenguaje**: TypeScript con `strict: true` en todos los paquetes.
- **Runtime**: Node LTS.
- **Estructura**: npm workspaces `shared`, `server` y `client`. No hay más paquetes sin
  justificación en el plan.
- **Cliente**: Phaser con Vite.
- **Servidor**: Colyseus. Salas co-op de 1 a 4 jugadores, con acceso por código o enlace privado.
- **Idioma**: la documentación (constitución, spec, plan y tareas) MUST estar en español. El
  código, los identificadores y los mensajes de commit MUST estar en inglés.
- **Despliegue**: primero local. El despliegue remoto queda fuera del MVP y requiere su propia
  feature.

## Flujo de desarrollo

- Cada feature MUST seguir spec-kit: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`. `/speckit-analyze` es opcional antes de implementar.
- `tasks.md` MUST agrupar las tareas por historia de usuario en orden de prioridad, y cada
  historia MUST quedar jugable por sí sola.
- MUST hacerse un commit por historia completada, con formato Conventional Commits.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica del repo. Si un plan la contradice, el
  plan MUST incluir una tabla de "Complexity Tracking" que justifique la excepción.
- Las enmiendas MUST hacerse con `/speckit-constitution`, actualizar la versión y la fecha
  `Last Amended`, y documentar el cambio en el Sync Impact Report.
- Versionado semántico:
  - MAJOR: eliminar o redefinir un principio;
  - MINOR: añadir un principio o sección, o ampliar materialmente una regla;
  - PATCH: redacción o aclaraciones.
- `/speckit-plan` y `/speckit-analyze` MUST verificar el cumplimiento de estos principios en su
  "Constitution Check".

**Version**: 1.0.0 | **Ratified**: 2026-10-18 | **Last Amended**: 2026-10-18
