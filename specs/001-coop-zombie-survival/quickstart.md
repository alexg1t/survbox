# Quickstart: validar el MVP

## Requisitos

- Node 24 LTS y npm 11.
- Un navegador de escritorio. Para probar varios jugadores se usan varias pestañas o ventanas.

## Instalar y comprobar

```bash
npm install
npm test            # Vitest sobre shared/
npm run typecheck   # tsc --noEmit en los 3 paquetes
npm run dev         # servidor en :2567 y cliente en :5173
```

Abre `http://localhost:5173`. Desde otro equipo de la LAN, usa `http://<ip-local>:5173`.

`npm test` cubre en verde:
- colisión con la rejilla;
- raycast;
- campo de flujo, incluida la barricada;
- combo y desbloqueos;
- composición de oleadas;
- explosiones en cadena.

## Escenarios por historia

El comportamiento esperado está en [spec.md](./spec.md). Aquí solo se indican los pasos de
verificación.

### Historia 1: solo

1. Pulsa "Crear sala". Comprueba que ves la sala de espera con el código y "Empezar".
2. Pulsa "Empezar" y, tras el aviso "Oleada 1", aparecen zombis.
3. Muévete en diagonal y comprueba que el personaje mira hacia la diagonal.
4. Dispara con espacio. Una estela sale hacia donde miras y el zombi muere en 2 disparos.
5. Ponte detrás de una pared. Los zombis la rodean.
6. Deja que te toquen. La vida baja y, al llegar a 0, aparece la pantalla de fin.

### Historia 2: 4 pestañas y una quinta

1. En la pestaña A, crea la sala y pulsa "Copiar enlace".
2. En la pestaña B, escribe el código en minúsculas y con espacios. Entra.
3. Abre las pestañas C y D con el enlace. Entran sin escribir el código.
4. Abre la pestaña E con el enlace. Debe mostrar "Sala llena".
5. B, C y D ven "Esperando al anfitrión". A pulsa "Empezar".
6. Comprueba que los 4 ven los mismos enemigos y que una muerte se ve en todas las pestañas.
7. Cierra la pestaña E y abre otra con el enlace. Debe mostrar "Partida en curso".
8. Cierra A. Comprueba que B pasa a ser anfitrión.
9. Introduce el código `ZZZZZ`. Debe mostrar "Sala no encontrada".

### Historia 3: oleadas y combo

1. Juega hasta la oleada 3 o más. El número de enemigos crece y aparecen diablos.
2. Comprueba que las bolas de fuego te dañan y que se detienen en las paredes.
3. Mata 5 enemigos seguidos. Aparece el aviso "¡Nueva arma: Uzi!" y puedes seleccionarla con E
   o con 2.
4. Gasta toda la munición de la uzi. El arma no dispara.
5. Recoge una caja de munición. La munición sube.

### Historia 4: colocables

Abre el enlace con `?debug=1` para desbloquear todas las armas.

1. Coloca una barricada en un pasillo. Los zombis rodean el bloqueo o la golpean hasta romperla.
2. Intenta colocar contra una pared. No se coloca nada y la munición no baja.
3. Pon 3 barriles en fila y dispara a uno. Explotan los 3.
4. Pon una mina. El zombi que la pisa muere.
5. Ponte junto a la explosión. Tu vida no baja.

### Historia 5: HUD y fin (2 pestañas)

1. Comprueba que el HUD cambia al instante con el daño, la munición, el combo y la oleada.
2. Muere con una pestaña. Pasas a espectador y reapareces en la siguiente oleada.
3. Mueren ambos jugadores. Aparece la pantalla de fin con la oleada y las 2 puntuaciones.
4. Solo el anfitrión ve "Volver a la sala". Al pulsarlo, ambos vuelven a la sala de espera.
5. Pulsa "Empezar". Ambos empiezan en la oleada 1 con 0 puntos y solo la pistola.

## Rendimiento y latencia (SC-003, SC-004)

- Con 4 pestañas y 60 enemigos, el contador de FPS de las DevTools marca 50 o más en la pestaña
  activa.
- Con `COLYSEUS_LATENCY=150 npm run dev` (latencia simulada en el servidor), o con DevTools →
  Network → throttling personalizado de 150 ms:
  - el movimiento propio responde al instante;
  - los demás jugadores se mueven suaves, sin saltos.
