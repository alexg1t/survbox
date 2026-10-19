# Contrato de red: cliente ↔ servidor

- **Transporte**: WebSocket de Colyseus 0.18.
- **Puerto**: el servidor escucha en `2567`.
- **Sala**: un único tipo, `"game"`.
- **Estado**: el estado sincronizado está descrito en [../data-model.md](../data-model.md).

## Entrar en una sala

| Acción | Llamada del SDK | Opciones |
|--------|-----------------|----------|
| Crear sala | `client.create("game", { name })` | `name`: string ≤12 (opcional) |
| Entrar por código o enlace | `client.joinById(code, { name })` | `code`: 5 letras. Se normaliza en el cliente: `trim().toUpperCase()` |

El enlace para compartir tiene la forma `http(s)://<host>:<puerto-cliente>/?room=<CODE>`. Al
cargar con `?room=`, el cliente rellena el código y entra directamente después de pedir el nombre.

### Errores de entrada (cliente → mensaje mostrado)

| Situación | Origen | Mensaje |
|-----------|--------|---------|
| La sala no existe o está cerrada | Error de matchmaking: room id inválido | "Sala no encontrada" |
| La sala tiene 4 jugadores | Error de matchmaking: sala bloqueada (autolock por `maxClients`) | "Sala llena" |
| La partida está en curso | `onAuth` lanza un error con mensaje `IN_PROGRESS` | "Partida en curso" |
| Error de red | Cualquier otro | "No se pudo conectar" |

## Mensajes cliente → servidor (`room.send(type, payload)`)

| Tipo | Payload | Cuándo | Validación en el servidor |
|------|---------|--------|---------------------------|
| `input` | `{ dx: -1\|0\|1, dy: -1\|0\|1, fire: boolean }` | Solo cuando cambia el estado de las teclas | Se fuerzan los valores. Se ignora si el jugador está muerto |
| `weapon` | `{ index: 0-6 }` o `{ step: -1\|1 }` | Teclas 1-7 o Q/E | Se ignora si el arma está bloqueada. `step` salta las bloqueadas |
| `start` | — | Botón "Empezar" | Solo el anfitrión y solo en `lobby` |
| `lobby` | — | Botón "Volver a la sala" | Solo el anfitrión y solo en `gameover` |
| `debugUnlock` | — | Modo de prueba (`?debug=1`) | Solo si `NODE_ENV !== "production"` |

## Eventos servidor → cliente (`room.broadcast`)

Son efectos visuales efímeros que no viven en el estado.

| Tipo | Payload | Uso en el cliente |
|------|---------|-------------------|
| `shot` | `{ x1, y1, x2, y2, w }` | Dibuja la estela de un disparo hitscan (`w` = índice del arma) |
| `boom` | `{ x, y, r }` | Dibuja la explosión (granada, barril o mina) |
| `unlock` | `{ id: sessionId, w }` | Aviso "¡Nueva arma: X!". Solo lo muestra el jugador `id` |

## Garantías

- El cliente nunca envía posiciones, daño ni puntuación (constitución, principio I).
- Los eventos son solo visuales. Si se pierde uno, el estado sigue siendo correcto.
- El servidor procesa como máximo el último `input` por tick. Un cliente que envía más mensajes
  no gana ventaja.
