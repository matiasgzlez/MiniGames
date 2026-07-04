# Topos (Whack-a-Mole)

Aplasta topos sobre un canvas 2D. Grid de 3x3 agujeros (`COLS` x `ROWS`); van
asomando topos en agujeros libres y hay que hacerles click antes de que se
escondan. La partida es **a tiempo**: dura `ROUND_SEC` (60 s) y gana quien mas
puntos hace, tanto en solo como en salas.

## Mecanica

- **Topo normal** (`Mole`, tipo `normal`): +`NORMAL_POINTS` (10).
- **Topo dorado** (`golden`, prob. `GOLDEN_CHANCE` 12%): +`GOLDEN_POINTS` (25).
- **Bomba** (`bomb`, prob. `BOMB_CHANCE` 18%): golpearla resta `BOMB_PENALTY`
  (15); el puntaje nunca baja de 0. Hay que **evitarla**.
- Dejar que un topo se esconda no penaliza (es amistoso). Un martillazo al vacio
  (sin topo bajo el cursor) resta `MISS_PENALTY` (3); el puntaje nunca baja de 0.

Cada topo sube (`rising`), se queda arriba (`holding`, `holdDuration`) y baja
(`falling`); `Mole.offset` (0..1) lo posiciona y sirve para recortarlo contra el
nivel del suelo al dibujarlo (asoma desde el agujero). Solo es golpeable con
`whackable` (visible, subiendo/arriba, no golpeado aun). El click elige el topo
con mayor `offset` bajo el cursor.

**Dificultad**: sube linealmente en los primeros `RAMP_SEC` (45 s). Con el
progreso, el intervalo de aparicion (`SPAWN_INTERVAL_BASE`->`_MIN`) y el tiempo
que el topo se queda arriba (`HOLD_DURATION_BASE`->`_MIN`) se acortan.

**Render** (todo en `Game.ts`): fondo cielo+pasto, agujeros (monticulo + abertura
oscura por detras, borde frontal por delante para dar profundidad), topos
recortados al suelo, y un martillo animado (`Swing`) en cada click. Los `+N`/`-N`
flotan en el canvas de popups del `Hud`. Sin emojis: todo dibujado con formas.

Countdown 3/2/1/YA obligatorio con blip de 750 Hz por label
(`SoundEffects.playCountdownTick`, guard `lastCountdownIndex`), ver root
`CLAUDE.md`.

## Scoring

`direction: "higher"` por defecto (mas puntos es mejor), asi que **no** declara
`scoring` en `meta.ts`. Solo guarda el `BEST_KEY` local y llama a
`hud.showRanking("whack-a-mole", score)` en el game over fuera de salas.

## Modo sala (multiplayer)

Cableado al modo fiesta compartido (ver root `CLAUDE.md`, "Salas"):
`initRoomMode("whack-a-mole", { getScore, onStart: beginCountdown })`. Como la
partida ya es a tiempo, el modo sala no cambia la mecanica: solo redirige el
game over (`this.room.reportScore` en vez de `hud.showRanking`) y bloquea el
reintento (`onPrimary` retorna si hay sala, una sola partida por ronda). El
inicio lo dispara `onStart` para que todos arranquen juntos. `getScore` da el
puntaje en vivo para el parcial si el host fija un tope de ronda menor a 60 s.
