# El Trile (shell-game)

Juego clasico de encontrar la moneda debajo de un vaso (shell game, donde esta la bolita) con dificultad progresiva y sincronizacion multijugador online.

## Mecanica de Juego

- **Individual (sin ?room=)**: El jugador comienza la partida y avanza de nivel si acierta. En cada nivel, una moneda dorada se oculta bajo un vaso. Los vasos se cierran y se mezclan. Al terminar el barajado, el jugador debe seleccionar el vaso correcto. Si falla, se produce el game over inmediatamente. Para agilizar el juego, la cuenta regresiva 3-2-1-YA solo se ejecuta en el nivel 1. Los siguientes niveles comienzan directamente tras una pausa de 1 segundo ("Listo"). El puntaje del leaderboard es el nivel alcanzado. El coin conserva su posicion final como punto de inicio de la siguiente ronda.
- **Sala (?room=)**: En el modo online, el juego funciona como un **Battle Royale**. Comienza en el Nivel 1 con todos los jugadores registrados como sobrevivientes (`surviving`). En cada nivel, el host baraja los vasos de manera sincronizada. Solo los jugadores sobrevivientes pueden elegir un vaso. Al revelar la moneda, los jugadores sobrevivientes que acierten avanzan al siguiente nivel, mientras que los que fallen quedan eliminados (pasan a modo espectador, observando las mezclas subsiguientes). Esto continua ronda a ronda hasta que quede **un solo sobreviviente** (que gana la sala) o hasta que todos fallen en el mismo nivel (en cuyo caso empatan como ganadores). Los puntajes finales se otorgan segun el nivel maximo alcanzado (`1000` puntos por nivel superado + `5000` de bonus de victoria).

## Module Layout

- `main.ts` — Punto de entrada del juego, inicializa la clase `Game`.
- `style.css` — Estilos de la interfaz, incluyendo las animaciones de curva 3D para los swaps, brillo neon, vasos con relieve 3D con forma de vaso real (cuerpo con rotacion de perspectiva y rim/borde plano en el fondo), y la moneda flotante.
- `game/constants.ts` — Configuraciones del juego y dificultad (vasos, swaps, velocidad) por nivel.
- `game/SoundEffects.ts` — Efectos de sonido generados mediante la API Web Audio (blips de cuenta regresiva, clicks de seleccion, whoosh de swaps, acordes de victoria y de fallo).
- `game/Hud.ts` — Controlador del DOM para los marcadores, la grilla de vasos y moneda, overlays de inicio/fin, panel de eleccion multijugador y leaderboard.
- `game/Game.ts` — Logica principal del juego y sincronizacion de estado para salas multijugador.

## Sincronizacion en Modo Sala

Utiliza la tabla Supabase `room_match_state` con el siguiente esquema en su columna JSONB `state`:
- `level`: Nivel actual del sub-juego (1, 2, 3...).
- `surviving`: Listado de jugadores activos sobrevivientes.
- `cupsCount`: Numero de vasos (3 a 5).
- `initialCoinSlot`: Ranura inicial donde se coloca la moneda antes de barajar.
- `swaps`: Array de pares `[slotA, slotB]` que representan los intercambios ordenados que realizan los vasos.
- `speed`: Duracion en milisegundos de cada swap.
- `choices`: Record de elecciones `{ [playerName]: chosenSlot }` para la ronda/nivel.
- `revealed`: Flag booleano que indica si todos los jugadores sobrevivientes eligieron y se debe levantar los vasos.
- `eliminated`: Record de fallos `{ [playerName]: levelFailed }` para dar puntajes progresivos.
- `winners`: Listado de jugadores ganadores de la sala.

### Decisiones de diseno:
- **Shuffling Determinista**: Para garantizar que "todos ven como mezcla igual", el host genera los swaps en la base de datos y todos los clientes los leen y reproducen de forma identica.
- **El que elige ultimo se auto-sincroniza**: el broadcast `sync` no vuelve al emisor (`broadcast.self=false`), asi que el jugador cuya eleccion completa la ronda (escribe `revealed=true`) no recibiria ping para disparar su propio reveal. Tras escribir en `submitRoomChoice` se llama `syncRoomState()` local ademas de `ping()`, si no ese jugador queda colgado en `waitingChoice` mientras el resto revela y avanza.
- **Cheating Prevention**: Durante el barajado, la moneda se oculta en el DOM (removiendo el elemento o la clase visible) y el index de la moneda solo se asigna a su posicion final al momento de revelarse, evitando que los jugadores puedan inspeccionar el arbol HTML para adivinar el vaso ganador.
- **Nivel de sala independiente de la ronda del playlist**: El nivel del Battle Royale (`data.level`) vive en `room_match_state` y arranca en 1, sin relacion con `room.round()` (que juego del playlist es). El cliente sincroniza `this.level` desde `config.level` en `playShufflingSequence`, y el avance de nivel se detecta con `data.level > this.level`. **No** derivar `this.level` de `this.room.round()`: rompe el avance de los invitados cuando El Trile no es el primer juego de la sala.
- **Puntajes de sala**: El puntaje final se calcula en `endMultiplayerGame` sobre la base de `1000` por nivel: el ganador suma `data.level * 1000 + 5000` de bonus, y los eliminados `failLevel * 1000`. El parcial por timeout (`calculateRoomScore`, el hook `getScore`) devuelve el mismo standing en esa escala (nivel de eliminacion o nivel actual si sigue vivo) para que un corte por tope de tiempo no distorsione el placement.
