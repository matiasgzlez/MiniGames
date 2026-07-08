# Bomba Palabra (word-bomb)

Bomba de palabras por turnos (estilo BombParty), **solo de sala**. Aparece un
fragmento (una silaba o combo de 2-3 letras) y el jugador de turno tiene hasta
que se agota la mecha para escribir una **palabra real** en espanol que lo
contenga y no se haya usado. Si la mecha explota pierde una vida; al quedarse sin
vidas queda eliminado. **Gana el ultimo en pie.**

Es el primer juego que usa el **game server autoritativo** (`server/`, socket.io
en Railway): a diferencia del resto del repo, su estado en-ronda NO vive en
Supabase sino en el server, que ademas valida cada palabra contra un diccionario
de espanol embebido (no spoofeable, y sin peso en el bundle del front). Ver la
seccion "Game server" del `CLAUDE.md` raiz.

## Solo de sala (sin modo un jugador)

No tiene modo solo: sin `?room=` muestra un cartel "Solo en salas" con link a
`/rooms/`. Sin las credenciales de Supabase o sin `VITE_GAME_SERVER_URL` muestra
"No disponible". **Esto es una excepcion deliberada a la regla de degradacion**
del repo (el resto de los juegos siguen jugables sin credenciales): Bomba Palabra
existe por el server, no puede funcionar sin el. Aparece en la landing (para
descubrirlo) y en el picker/votacion de salas como cualquier otro juego de sala.

## Reparto de responsabilidades

- **Supabase / RoomMode**: lobby, briefing, marcador acumulado, rejoin, deadline
  de ronda (corte duro). Igual que Ta-Te-Ti: `initRoomMode("word-bomb", {...})`,
  y al terminar `room.reportScore(...)` en vez de `hud.showRanking(...)`. El
  puntaje de la ronda es **placement-based** (mayor = mejor): `ranking.length -
  place`, asi el ultimo en pie (place 1) suma mas. No va al ranking global.
- **Game server** (`/wordbomb`): turno actual, mecha (deadline absoluto), vidas,
  set de palabras usadas, validacion y orden de eliminacion. Difunde `wb:state`
  en cada cambio; el cliente anima la mecha localmente entre snapshots.

## Module layout

- `main.ts` — monta `Game` en `#app`.
- `game/Game.ts` — orquestador: detecta modo sala (`initRoomMode`), muestra los
  carteles de "solo en salas" / "no disponible", corre el countdown 3/2/1/YA
  (disparado por `onStart` de RoomMode al pasar la ronda a "playing"), conecta el
  transporte al server, renderiza los `wb:state`, maneja rechazos/tipeo y reporta
  el puntaje en el `wb:gameover`.
- `game/Hud.ts` — DOM "mesa de bomba" (ver DESIGN.md): los jugadores forman un
  **circulo** alrededor de la **bomba central** (repartidos por angulo, `i*360/n`
  desde arriba, soporta 2-8 jugadores). Cada jugador es una columna: **nombre
  arriba**, **avatar generico** (silueta violeta SVG sobre placa gris, igual para
  todos — nunca imagenes propias) con corazones/calavera encima, y **debajo lo que
  escribe**. La bomba muestra el fragmento y una **flecha amarilla gira** apuntando
  al jugador de turno; su nombre se pone **verde**. **No hay caja de texto**: un
  `<input>` invisible (opacity 0, cubre la arena) captura el tecleo y summonea el
  teclado en movil, y el texto se refleja bajo el avatar propio; el tipeo ajeno
  llega por el relay `wb:typing` y se muestra bajo el avatar del rival de turno
  (el **eco del tipeo propio se ignora** en `Game.ts` — llega con lag y pisaria lo
  recien escrito, causando parpadeo). La ultima palabra aceptada de cada jugador
  queda bajo su avatar (`lastWords` en `Game.ts`). **La mecha es visible para todos**:
  un **anillo alrededor de la bomba** se consume y bajo el fragmento van los
  **segundos restantes** (de chispa amarilla a rojo, con pulso al final). El server
  manda `fuseMs`/`fuseTotalMs` en cada `wb:state` y `Hud.setFuse` los ancla a
  `performance.now()` para animar sin drift de reloj entre maquinas; el rAF corre
  solo en la Hud (`tickFuse`) y `clearFuse` lo detiene fuera de juego. El server
  sigue siendo el arbitro real del deadline (hace explotar la bomba). Los estados de
  espera/resultados/tablero final los cubre el `RoomOverlay` compartido por encima.
- `game/WordBombTransport.ts` — interfaz de transporte + tipos que **espejan**
  `server/src/protocol.ts` (no se comparte modulo entre `src/` y `server/` por la
  regla de decoupling; si cambia el protocolo, tocar los dos lados).
- `game/SocketTransport.ts` — implementacion socket.io-client (import dinamico)
  contra el namespace `/wordbomb`. Anuncia `{code, nickname, roster}`; el server
  fija el orden de turnos con el `roster` (= `room.players()`, por `joined_at`).
- `game/SoundEffects.ts` — Web Audio sintetizado (countdown tick, sello de
  aceptada, zumbido de rechazo, explosion, ganar/perder).
- `game/constants.ts` — countdown, `GAME_SERVER_URL` (de `VITE_GAME_SERVER_URL`),
  paleta y umbral de peligro de la mecha.

## Flujo de una ronda

1. RoomMode pasa la sala a "playing" y dispara `onStart` -> `beginCountdown()`.
2. El countdown arranca y en paralelo el cliente conecta al server (`connect()`),
   anunciando el roster.
3. El server arranca la partida cuando **todos los del roster** conectaron, o al
   vencer una gracia (`START_GRACE_MS`, 8s). Los del roster que no conectaron a
   tiempo quedan afuera (miran).
4. Se juega por turnos hasta que queda uno vivo -> `wb:gameover` con el ranking.
5. Cada cliente reporta su puntaje placement-based; el `RoomOverlay` muestra el
   resultado de la ronda y el marcador acumulado.

## Diccionario y fragmentos (server-side)

`server/src/dictionary.ts` carga `an-array-of-spanish-words` (~636k palabras),
normaliza (minuscula, saca acentos de vocales y dieresis pero **conserva la ñ**,
descarta lo que no sea `[a-zñ]`) y **precomputa los fragmentos jugables**: todas
las subcadenas de 2-3 letras que existen en al menos `MIN_WORDS_PER_FRAGMENT`
(500) palabras (~1800 fragmentos). Asi nunca se ofrece un reto sin solucion. Una
palabra es valida si (contiene el fragmento) + (esta en el diccionario) + (no se
uso antes en la partida).

## Tuning (server, `server/src/games/wordbomb.ts`)

- `STARTING_LIVES` (3), mecha `FUSE_BASE_MS` (13s) que se acorta `FUSE_STEP_MS`
  (150ms) por palabra aceptada con piso `FUSE_MIN_MS` (6s), `START_GRACE_MS` (8s).
- Desconexion = NO elimina: la mecha castiga el turno del ausente como a un AFK y,
  si vuelve (recarga de pagina), se reengancha. Solo se elimina al quedarse sin
  vidas.
- Reto (silaba/combo) y su dificultad se ajustan con `MIN_WORDS_PER_FRAGMENT` y
  `FRAGMENT_LENGTHS` en `dictionary.ts`.

## Gotchas

- Los tipos del protocolo estan **duplicados** en cliente y server a proposito
  (regla de decoupling del repo). Mantenerlos en sync a mano.
- La mecha del cliente es solo visual: la verdad la tiene el server (el `setTimeout`
  del deadline). Si hay drift de reloj, el corte real lo decide el server.
- El puntaje de sala es placement-based y **no** va al ranking global (como el
  resto de los juegos de sala).
