# Feature Specification: Supervivencia co-op contra zombis (MVP)

**Feature Branch**: `001-coop-zombie-survival`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Juego web multijugador co-op inspirado en las mecánicas de Boxhead (shooter de supervivencia contra hordas de zombis, vista cenital pseudo-isométrica, personajes con forma de caja). Salas privadas de 1 a 4 jugadores con código de 5 letras o enlace; quinto jugador recibe 'sala llena'. Mapa de habitaciones, oleadas de zombis y diablos, controles de teclado estilo original, combo que desbloquea armas (pistola, uzi, escopeta, granadas, barriles, barricadas, minas), cajas de munición y vida, HUD, fin de partida con puntuación y reinicio. Fuera de alcance: PvP, lista pública de salas, varios mapas, cuentas, despliegue en internet, sonido."

## Clarifications

### Session 2026-10-18

- Q: ¿Qué pasa cuando un jugador muere y aún quedan compañeros vivos? → A: Queda como espectador
  y reaparece al empezar la siguiente oleada, con vida completa y conservando armas, munición y
  puntos.
- Q: ¿El combo y los desbloqueos de armas son de cada jugador o compartidos por todo el equipo?
  → A: Por jugador. Cada uno tiene su combo, su multiplicador y sus desbloqueos.
- Q: ¿Cómo entra en juego un jugador que se une a la sala en mitad de una oleada? → A: No puede.
  Solo se entra en la sala de espera, antes de empezar. Con la partida en curso, la sala rechaza
  la entrada con "Partida en curso".
- Q: En la sala de espera, ¿quién puede pulsar "Empezar" y "Volver a la sala"? → A: Solo el
  anfitrión (el creador). Si sale, el anfitrión pasa al jugador que lleva más tiempo en la sala.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear sala y sobrevivir en solitario (Priority: P1)

Un jugador abre el juego en el navegador y pulsa "Crear sala". Entra como anfitrión en la sala
de espera y pulsa "Empezar". Aparece en un mapa de habitaciones con paredes, pasillos y puertas,
armado con una pistola de munición infinita. Se
mueve en 8 direcciones con flechas o WASD y dispara con espacio en la dirección en la que mira.
Los zombis aparecen en puntos fijos del mapa, le persiguen esquivando paredes y le quitan vida al
tocarle. Si su vida llega a 0, la partida termina.

**Why this priority**: es el bucle de juego mínimo. Sin él no hay juego, y todo lo demás se
construye encima.

**Independent Test**: se prueba completo con una sola pestaña: crear sala, moverse, matar zombis
con la pistola y morir.

**Acceptance Scenarios**:

1. **Given** la pantalla de inicio, **When** el jugador pulsa "Crear sala", **Then** entra como
   anfitrión en la sala de espera en menos de 5 s y ve el código de sala y el botón "Empezar".
2. **Given** el anfitrión en la sala de espera, **When** pulsa "Empezar", **Then** la partida
   empieza y ve su personaje en el mapa.
3. **Given** el jugador en partida, **When** mantiene dos teclas de dirección a la vez
   (p. ej. arriba+derecha), **Then** se mueve en diagonal y el personaje mira hacia esa diagonal.
4. **Given** el jugador quieto mirando a un zombi, **When** pulsa espacio, **Then** la bala sale
   en la dirección en la que mira, impacta al zombi y le quita vida. Tras suficientes impactos, el
   zombi muere y desaparece.
5. **Given** una pared entre el jugador y un zombi, **When** el zombi persigue al jugador,
   **Then** rodea la pared por pasillos y puertas, sin atravesarla.
6. **Given** un zombi tocando al jugador, **When** pasa el tiempo, **Then** el jugador pierde vida
   a intervalos regulares, y su vida visible baja.
7. **Given** el jugador con vida 0 y sin compañeros, **When** muere, **Then** la partida termina.

---

### User Story 2 - Jugar con amigos por código o enlace (Priority: P2)

En la sala de espera, el anfitrión ve un código de 5 letras y un botón "Copiar enlace". Otro
jugador escribe el código en la pantalla de inicio o abre el enlace, y entra en la misma sala de
espera. Todos ven la lista de jugadores, y el anfitrión pulsa "Empezar" cuando están todos. Hasta
4 jugadores comparten mapa y enemigos, y cada uno ve a los demás moverse y disparar en tiempo
real. Cada jugador tiene un color distinto y su nombre sobre la cabeza.

**Why this priority**: el multijugador co-op es el objetivo principal del proyecto. Se apoya en
el bucle de la historia 1.

**Independent Test**: se prueba con 5 pestañas. Una crea la sala, tres entran (una por código y
dos por enlace), y la quinta recibe "sala llena". Las cuatro ven los mismos enemigos y
movimientos.

**Acceptance Scenarios**:

1. **Given** una sala de espera con 1 jugador, **When** otro jugador introduce el código correcto,
   **Then** entra en la misma sala de espera y ambos aparecen en la lista de jugadores. Tras
   "Empezar", ambos se ven mutuamente en el mapa.
2. **Given** el enlace de una sala, **When** un jugador lo abre, **Then** entra directamente en
   esa sala sin escribir el código.
3. **Given** una sala con 4 jugadores, **When** un quinto intenta entrar, **Then** ve el mensaje
   "Sala llena" y sigue en la pantalla de inicio.
4. **Given** un código que no existe, **When** un jugador lo introduce, **Then** ve el mensaje
   "Sala no encontrada".
5. **Given** 4 jugadores en partida, **When** uno dispara y mata un zombi, **Then** los 4 ven
   morir ese zombi.
6. **Given** un jugador en partida, **When** cierra la pestaña, **Then** su personaje desaparece
   para los demás en menos de 5 s y la partida sigue.
7. **Given** una sala con la partida ya empezada, **When** un jugador intenta entrar con su
   código o enlace, **Then** ve el mensaje "Partida en curso" y sigue en la pantalla de inicio.
8. **Given** una sala de espera con 2 jugadores, **When** el que no es anfitrión mira la sala,
   **Then** no ve el botón "Empezar", sino el aviso "Esperando al anfitrión".
9. **Given** una sala con varios jugadores, **When** el anfitrión sale, **Then** el jugador que
   lleva más tiempo en la sala pasa a ser anfitrión.

---

### User Story 3 - Oleadas, diablos, combos y nuevas armas (Priority: P3)

La partida avanza por oleadas numeradas. Cada oleada trae más enemigos y más diablos. Los diablos
son más rápidos y resistentes que los zombis, y lanzan bolas de fuego a distancia. Matar enemigos
seguidos en poco tiempo sube el combo del jugador. El combo multiplica los puntos y, al alcanzar
ciertos umbrales, desbloquea armas nuevas: uzi, escopeta y granadas. Los enemigos muertos sueltan
a veces cajas de munición o de vida.

**Why this priority**: da progresión y rejugabilidad, lo que distingue a Boxhead de un shooter
plano.

**Independent Test**: se prueba en solitario. Se juegan varias oleadas y se comprueban cuatro
cosas: suben el número de oleada y la cantidad de enemigos, aparecen diablos, el combo desbloquea
la uzi y las cajas reponen munición o vida.

**Acceptance Scenarios**:

1. **Given** la oleada N completada (no quedan enemigos vivos), **When** termina la pausa entre
   oleadas, **Then** empieza la oleada N+1 con más enemigos que la N.
2. **Given** una oleada con diablos, **When** un diablo tiene línea de visión con un jugador,
   **Then** le lanza bolas de fuego que dañan al jugador si le impactan y se detienen en las
   paredes.
3. **Given** un jugador que mata enemigos en rápida sucesión, **When** cada muerte llega dentro de
   la ventana de combo, **Then** el combo sube y los puntos por muerte se multiplican.
4. **Given** un jugador con combo activo, **When** pasa la ventana de combo sin matar,
   **Then** el combo vuelve a cero.
5. **Given** un jugador que alcanza un umbral de combo, **When** se cruza el umbral,
   **Then** se desbloquea el arma siguiente en el orden fijo, con un aviso en pantalla, y el
   jugador puede seleccionarla con Q/E o con su tecla numérica.
6. **Given** un arma con munición limitada, **When** su munición llega a 0, **Then** no dispara y
   el jugador debe cambiar de arma o recoger munición.
7. **Given** una caja de munición o de vida en el suelo, **When** un jugador pasa por encima,
   **Then** la recoge, recibe munición para sus armas desbloqueadas o recupera vida, y la caja
   desaparece para todos.

---

### User Story 4 - Armas colocables: barricadas, barriles y minas (Priority: P4)

El combo desbloquea también objetos que se colocan en el suelo, en la casilla libre delante del
jugador:
- **barricadas**: bloquean el paso de los enemigos; los enemigos las golpean hasta romperlas;
- **barriles explosivos**: explotan al recibir un disparo o una explosión, dañan todo lo cercano
  y hacen estallar en cadena otros barriles;
- **minas**: explotan cuando un enemigo las pisa.

**Why this priority**: añaden la táctica característica de Boxhead (encerrarse, crear trampas).
Necesitan antes el combo y el desbloqueo de la historia 3.

**Independent Test**: se prueba en solitario con desbloqueos forzados en modo de prueba. Se
coloca una barricada en un pasillo y los zombis se detienen a golpearla. Una fila de barriles
estalla en cadena al disparar uno. Una mina mata al zombi que la pisa.

**Acceptance Scenarios**:

1. **Given** un jugador con barricadas desbloqueadas, **When** pulsa disparar con la barricada
   seleccionada y la casilla de delante está libre, **Then** aparece una barricada en esa casilla
   y se descuenta una unidad.
2. **Given** una casilla de delante ocupada por pared, objeto o entidad, **When** el jugador
   intenta colocar, **Then** no se coloca nada y no se descuenta munición.
3. **Given** una barricada en un pasillo, **When** los zombis persiguen al jugador,
   **Then** buscan otra ruta si existe o golpean la barricada hasta romperla.
4. **Given** varios barriles adyacentes, **When** un jugador dispara a uno, **Then** explota y
   los barriles dentro del radio explotan en cadena.
5. **Given** una mina colocada, **When** un enemigo la pisa, **Then** explota y daña a los
   enemigos en su radio.
6. **Given** cualquier explosión, **When** alcanza a jugadores, **Then** no les hace daño (sin
   fuego amigo).

---

### User Story 5 - HUD completo, fin de partida y reinicio (Priority: P5)

Durante la partida, cada jugador ve en pantalla:
- su vida;
- el arma seleccionada y su munición;
- su combo;
- la oleada actual;
- su puntuación;
- el código de sala;
- la lista de jugadores con sus puntuaciones.

Cuando mueren todos los jugadores, aparece una pantalla de fin con la oleada alcanzada y la
puntuación de cada jugador. Desde ahí el anfitrión pulsa "Volver a la sala" y todos regresan a
la sala de espera. Ahí pueden entrar jugadores nuevos antes de volver a empezar.

**Why this priority**: pule la experiencia y cierra el ciclo de partida. El juego ya es jugable
sin ello, con un HUD mínimo.

**Independent Test**: se prueba con 2 pestañas. Se verifica que el HUD refleja cambios de vida,
munición, combo y oleada. Después mueren ambos jugadores, aparece la pantalla de fin con las dos
puntuaciones. Al volver a la sala y empezar, ambos juegan la oleada 1 desde cero.

**Acceptance Scenarios**:

1. **Given** un jugador en partida, **When** recibe daño, gasta munición, sube el combo o cambia
   la oleada, **Then** el HUD lo refleja en menos de 0,5 s.
2. **Given** 2 jugadores con uno muerto, **When** el otro sigue vivo, **Then** la partida
   continúa y el muerto ve la partida como espectador hasta reaparecer al inicio de la siguiente
   oleada.
3. **Given** todos los jugadores muertos, **When** muere el último, **Then** todos ven la pantalla
   de fin con la oleada alcanzada y la puntuación de cada jugador.
4. **Given** la pantalla de fin, **When** el anfitrión pulsa "Volver a la sala", **Then** todos
   los jugadores vuelven a la sala de espera. Al pulsar "Empezar", todos juegan la oleada 1 con
   puntuación 0, vida completa, combo 0 y solo la pistola.
5. **Given** la pantalla de fin, **When** un jugador que no es anfitrión la mira, **Then** no ve el
   botón "Volver a la sala", sino el aviso "Esperando al anfitrión".

---

### Edge Cases

- **Entrada con la partida en curso**: se rechaza con "Partida en curso", también durante la
  pantalla de fin. La sala vuelve a admitir jugadores cuando el anfitrión pulsa "Volver a la sala".
- **El anfitrión abandona la sala**: la sala sigue mientras quede algún jugador, y el anfitrión
  pasa al que lleva más tiempo en ella. Cuando sale el último, la sala se cierra y su código deja
  de ser válido.
- **Código mal escrito**: el código no distingue mayúsculas de minúsculas y se ignoran los
  espacios. Si aun así no existe, se muestra "Sala no encontrada".
- **Desconexión momentánea**: se trata igual que salir. El jugador no puede volver hasta que la
  sala esté de nuevo en espera.
- **Demasiados enemigos a la vez**: el número de enemigos vivos simultáneos tiene un tope. Los
  enemigos restantes de la oleada aparecen a medida que mueren otros.
- **Punto de aparición bloqueado**: si hay una barricada o un jugador encima, el enemigo aparece en
  otro punto de aparición libre.
- **Encierro total**: si una barricada deja al jugador sin camino posible, los zombis van a la
  barricada más cercana que bloquea su ruta y la golpean.
- **Cambio a arma sin munición**: el arma se puede seleccionar, pero no dispara, y el HUD muestra
  munición 0.
- **Muerte simultánea de todos**: si el último jugador muere a la vez que el último enemigo de la
  oleada, gana el fin de partida.

## Requirements *(mandatory)*

### Functional Requirements

**Salas y conexión**

- **FR-001**: El sistema MUST permitir a un jugador crear una sala privada. Ese jugador pasa a
  ser el anfitrión, entra en la sala de espera y ve un código único de 5 letras y un enlace para
  compartir.
- **FR-002**: El sistema MUST permitir entrar en una sala en espera introduciendo su código
  (sin distinguir mayúsculas ni espacios) o abriendo su enlace.
- **FR-036**: La sala de espera MUST mostrar a todos el código, el enlace y la lista de jugadores
  con nombre y color. Solo el anfitrión MUST ver y poder pulsar "Empezar". Los demás ven
  "Esperando al anfitrión".
- **FR-037**: Mientras la partida está en curso, incluida la pantalla de fin, el sistema MUST
  rechazar nuevas entradas con el mensaje "Partida en curso".
- **FR-038**: Si el anfitrión sale de la sala, el sistema MUST nombrar anfitrión al jugador que
  lleva más tiempo en ella.
- **FR-003**: El sistema MUST limitar cada sala a 4 jugadores y rechazar al quinto con el mensaje
  "Sala llena".
- **FR-004**: El sistema MUST mostrar "Sala no encontrada" cuando el código no corresponde a una
  sala abierta.
- **FR-005**: El sistema MUST cerrar una sala cuando no queda ningún jugador en ella.
- **FR-006**: El sistema MUST pedir un nombre opcional de hasta 12 caracteres y, si está vacío,
  asignar "Jugador N". Cada jugador de la sala MUST tener un color distinto.
- **FR-007**: El sistema MUST ser la única autoridad sobre posiciones finales, daño, muertes,
  puntuación, combos, desbloqueos, apariciones y oleadas. Todos los jugadores de una sala MUST ver
  el mismo estado de partida.

**Movimiento, disparo y armas**

- **FR-008**: El jugador MUST poder moverse en 8 direcciones con flechas o WASD. Su personaje MUST
  mirar en la última dirección de movimiento.
- **FR-009**: El jugador MUST disparar con espacio en la dirección en la que mira, y MUST mantener
  espacio pulsado para disparar de forma continua según la cadencia del arma.
- **FR-010**: El jugador MUST poder cambiar de arma con Q (anterior), E (siguiente) o con las
  teclas numéricas 1-7 (acceso directo), entre las armas que tiene desbloqueadas.
- **FR-011**: Las paredes MUST bloquear a jugadores, enemigos, balas y bolas de fuego.
- **FR-012**: El sistema MUST ofrecer 7 armas. La pistola tiene munición infinita y está
  disponible desde el inicio. Las demás tienen munición limitada:

  | Arma | Comportamiento |
  |------|----------------|
  | Pistola | Disparo simple. |
  | Uzi | Ráfaga rápida. |
  | Escopeta | Abanico de perdigones de corto alcance. |
  | Granadas | Lanzadas a distancia fija; explotan tras un breve retardo. |
  | Barricadas | Colocables. |
  | Barriles explosivos | Colocables. |
  | Minas | Colocables. |

- **FR-013**: Las armas colocables MUST colocarse en la casilla libre inmediatamente delante del
  jugador. Si la casilla no está libre, MUST NOT colocarse ni consumir munición.
- **FR-014**: Los ataques de jugadores (balas, perdigones y explosiones) MUST NOT dañar a otros
  jugadores ni a sí mismos.

**Enemigos y oleadas**

- **FR-015**: El sistema MUST generar enemigos en puntos de aparición fijos del mapa. Si un punto
  está ocupado, MUST usar otro libre.
- **FR-016**: Los zombis MUST perseguir al jugador vivo más cercano rodeando paredes y dañarle
  cuerpo a cuerpo al tocarle.
- **FR-017**: Los diablos MUST moverse más rápido, tener más vida que los zombis y lanzar bolas de
  fuego al jugador vivo más cercano cuando tienen línea de visión.
- **FR-018**: La partida MUST organizarse en oleadas numeradas. Una oleada termina cuando han
  aparecido y muerto todos sus enemigos. Entre oleadas MUST haber una pausa de 5 s con un aviso
  "Oleada N".
- **FR-019**: Cada oleada MUST tener más enemigos que la anterior y una proporción de diablos
  igual o mayor. El número de enemigos MUST escalar con el número de jugadores de la sala.
- **FR-020**: El número de enemigos vivos simultáneos MUST tener un tope. Los enemigos pendientes
  de la oleada aparecen a medida que mueren otros.
- **FR-021**: Los enemigos MUST golpear las barricadas que bloquean su ruta hasta destruirlas
  cuando no exista ruta alternativa.

**Combo, puntuación y desbloqueos**

- **FR-022**: Cada muerte de enemigo MUST dar puntos al jugador que la causó: valor base del
  enemigo multiplicado por el multiplicador de combo de ese jugador.
- **FR-023**: Cada jugador MUST tener su propio combo. Cada muerte dentro de la ventana de combo
  desde la anterior lo incrementa. Si pasa la ventana sin muertes, el combo vuelve a cero.
- **FR-024**: Al alcanzar umbrales de combo, el sistema MUST desbloquear para ese jugador la
  siguiente arma, en este orden: uzi, escopeta, barricadas, granadas, barriles, minas. Cada
  desbloqueo MUST notificarse en pantalla.
- **FR-025**: Cada desbloqueo MUST entregar una dotación inicial de munición de esa arma.
- **FR-026**: Los enemigos muertos MUST soltar con cierta probabilidad una caja de munición o una
  caja de vida:
  - la caja de munición repone munición de todas las armas desbloqueadas de quien la recoge;
  - la caja de vida recupera parte de la vida, sin superar el máximo.

**Explosivos y colocables**

- **FR-027**: Los barriles MUST explotar al recibir un disparo o una explosión. Su explosión MUST
  dañar a enemigos y barricadas dentro de su radio y MUST detonar otros barriles alcanzados.
- **FR-028**: Las minas MUST explotar cuando un enemigo entra en su casilla.
- **FR-029**: Las barricadas MUST bloquear el paso de enemigos y jugadores, MUST dejar pasar las
  balas de los jugadores y MUST tener vida propia.

**Muerte, fin y reinicio**

- **FR-030**: Un jugador con vida 0 MUST quedar como espectador y MUST reaparecer al inicio de la
  siguiente oleada con vida completa, conservando armas, munición y puntuación.
- **FR-031**: Cuando todos los jugadores de la sala están muertos a la vez, la partida MUST
  terminar y mostrar a todos una pantalla de fin con la oleada alcanzada y la puntuación de cada
  jugador.
- **FR-032**: Desde la pantalla de fin, solo el anfitrión MUST poder pulsar "Volver a la sala".
  Esto devuelve a todos a la sala de espera. La siguiente partida empieza en la oleada 1 con
  puntuación 0, vida completa, combo 0 y solo la pistola para todos.

**Presentación**

- **FR-033**: Durante la partida, el HUD MUST mostrar al jugador:
  - su vida;
  - el arma seleccionada y su munición;
  - su combo y multiplicador;
  - la oleada actual;
  - su puntuación;
  - el código de sala;
  - la lista de jugadores con sus puntuaciones.
- **FR-034**: La primera partida MUST mostrar un recordatorio breve de controles en pantalla.
- **FR-035**: Todos los gráficos MUST ser originales: personajes, enemigos, mapa, objetos y
  efectos con forma de caja en vista cenital pseudo-isométrica. MUST NOT usarse material del juego
  original.

### Key Entities

- **Sala**: partida compartida. Tiene:
  - código de 5 letras;
  - jugadores (1-4), uno de ellos anfitrión;
  - estado: en espera, en oleada, en pausa entre oleadas o terminada;
  - número de oleada;
  - enemigos pendientes de aparecer.
- **Jugador**: participante de una sala. Tiene:
  - nombre y color;
  - posición y dirección;
  - vida;
  - vivo o muerto;
  - puntuación;
  - combo y multiplicador;
  - armas desbloqueadas con su munición;
  - arma seleccionada.
- **Enemigo**: zombi o diablo. Tiene tipo, posición, vida, velocidad, daño y puntos base.
- **Proyectil**: bala, perdigón, granada o bola de fuego. Tiene posición, dirección, dueño, daño y
  alcance o retardo.
- **Colocable**: barricada, barril o mina. Tiene casilla, vida (barricada y barril) y dueño.
- **Caja**: de munición o de vida. Tiene posición.
- **Mapa**: rejilla de casillas con:
  - paredes y suelo;
  - puntos de inicio de jugadores;
  - puntos de aparición de enemigos.
- **Arma**: definición fija con cadencia, daño, alcance, patrón de disparo, dotación de munición y
  umbral de combo de desbloqueo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un jugador pasa de abrir el juego a estar jugando en una sala nueva en menos de
  10 s.
- **SC-002**: Un segundo jugador con el código o enlace entra en la sala en menos de 10 s.
- **SC-003**: Con 4 jugadores y el tope de enemigos en pantalla, el juego se mantiene fluido, a 50
  fotogramas por segundo o más en un portátil de gama media.
- **SC-004**: Con hasta 150 ms de latencia, el movimiento propio responde sin retraso perceptible,
  y la posición de los demás jugadores y enemigos se ve con menos de 0,5 s de desfase.
- **SC-005**: Una sesión de prueba de 10 minutos con 4 jugadores termina sin cierres ni
  desconexiones. En cualquier momento, los 4 ven la misma oleada, las mismas puntuaciones y el
  mismo número de enemigos.
- **SC-006**: 9 de cada 10 jugadores de prueba matan su primer zombi en los primeros 30 s, sin más
  instrucciones que el recordatorio de controles en pantalla.
- **SC-007**: Un jugador que juega con normalidad desbloquea al menos 3 armas antes de la
  oleada 5.
- **SC-008**: El 100% de los gráficos del juego son de producción propia.

## Assumptions

- **Plataforma**: navegador de escritorio con teclado. Móvil y mando quedan fuera del MVP.
- **Despliegue**: el servidor corre en local o en red LAN durante el MVP. El despliegue en
  internet es una feature posterior.
- **Mapa**: un único mapa de habitaciones fijo, diseñado a mano, con al menos 4 puntos de inicio
  de jugadores y 6 puntos de aparición de enemigos.
- **Sesiones**: no hay cuentas, persistencia de puntuaciones ni ranking. La puntuación vive solo
  mientras existe la sala.
- **Sonido**: no hay sonido ni música en el MVP.
- **Contenido**: solo modo co-op. No hay modo jugador contra jugador.
- **Desbloqueos**: son por jugador, no por equipo, y se conservan al morir hasta el fin de la
  partida (FR-024, FR-030).
- **Fuego amigo**: desactivado por completo (FR-014).
- **Balance**: los valores numéricos se fijan en el plan y se ajustan jugando, sin cambiar los
  requisitos. Esto incluye:
  - vida, daño, velocidades y cadencias;
  - ventana y umbrales de combo;
  - probabilidad de soltar cajas;
  - tope de enemigos y escalado de oleadas.
- **Enemigos**: no se dañan entre sí.
- **Jugadores**: los jugadores no chocan entre sí.
- **Reconexión**: una desconexión equivale a salir de la sala. No hay reconexión con estado
  conservado.
- **Modo de prueba**: solo en desarrollo existe un modo que desbloquea todas las armas para probar
  las historias 3 y 4. No es visible para el jugador final.
