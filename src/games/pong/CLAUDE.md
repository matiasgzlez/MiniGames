# PONG

Single-player classic Pong: the player controls a paddle on the left with up/down arrows (or W/S); the ball bounces between paddles. Each time the player returns the ball the score increments and the ball speeds up (`BALL_SPEED_INCREMENT` per hit, capped at `BALL_SPEED_MAX`). Missing the ball ends the run (1 life). When the ball passes the AI's right edge it resets to the center and serves back toward the player — score keeps climbing. Plain 2D `<canvas>`, no Three.js.

## Module layout

- `main.ts` — entry point, mounts `Game` into `#app`.
- `game/Game.ts` — orchestrates the canvas, `ready -> countdown -> playing -> dead` state machine, collision detection, scoring, and the `requestAnimationFrame` loop. Owns canvas-to-window letterbox scaling.
- `game/Paddle.ts` — paddle state (position, dimensions, clamp to play area).
- `game/Ball.ts` — ball physics (speed, angle, wall bounce, paddle bounce with angle-from-impact-position, speed ramp per hit).
- `game/Ai.ts` — computer opponent: follows the ball's Y with a configurable `AI_MARGIN` dead zone and slightly slower speed than the player.
- `game/Renderer.ts` — all canvas drawing: dark background, glowing white paddles/ball with `shadowBlur`, dashed center line.
- `game/InputController.ts` — keyboard (up/down arrows or W/S for movement, Enter/Space for action) + pointer (tap for action, movement via keys only). Exposes `moveDir` for the game loop to read.
- `game/Hud.ts` — DOM overlay (score, start / game-over screens, countdown).
- `game/SoundEffects.ts` — synthesized Web Audio effects (no assets): paddle hit blip, wall bounce tick, score chime, lose swoop, countdown tick.
- `game/constants.ts` — all tunable values (speeds, sizes, margins, acceleration). **Tune here first.**

## Non-obvious decisions

**Landscape view box.** Unlike most games in the repo (480x720 portrait), Pong uses 720x480 landscape since the gameplay demands horizontal space. The same letterbox scaling still works — portrait screens get bars at top/bottom.

**One life, score by returns.** The player has exactly one life. Each successful return increments the score. When the ball passes the AI it resets to center and serves again toward the player; the score continues accumulating. This creates an endless survival mode where the only fail state is missing the ball.

**Speed ramp per hit.** Every paddle hit (by either side) adds `BALL_SPEED_INCREMENT` up to `BALL_SPEED_MAX`. The ball launches at `BALL_SPEED_INITIAL` after each reset-through-AI.

**Bounce angle from paddle position.** Where the ball hits the paddle determines the outgoing angle: center hits go straight, edge hits go steep. Formula: `(relY - 0.5) * PI * 0.7` where `relY = (ball.y - paddle.y) / paddle.h`.

**AI with dead zone.** The AI has a `AI_MARGIN` dead band so it doesn't jitter when the ball is near center, giving the player an opening to exploit.

**`dt` is clamped** (`MAX_DT`) so a tab-switch or hitch can't integrate one giant step and teleport the ball through a paddle.

**Enter-to-start countdown.** Standard repo pattern: 3 / 2 / 1 / YA (`COUNTDOWN_LABELS`, `COUNTDOWN_STEP` in `Game.ts`), 0.6 s restart guard after dying.

## Room mode (multiplayer) — online PvP

Wired to the shared party mode: the constructor calls `initRoomMode("pong", { getScore: () => this.score, onStart: () => this.beginCountdown() })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)").

With `?room=` in the URL and Supabase connected, Pong becomes **online player-vs-player**. Each player controls one paddle from their own device:

- **Pairing by index.** The room's player list is paired `(0,1), (2,3), ...`. Index even = P1 (left paddle, W/S). Index odd = P2 (right paddle, Arrow keys). If the count is odd, the last player is unpaired and plays vs AI (standard left-paddle controls, first to 7).

- **P1 is ball authority.** P1 (even index, left paddle) runs the full game simulation (both paddles, ball physics, collisions) and broadcasts the ball state via a dedicated Supabase Realtime channel (`room:{code}:pong`, event `"ball"`) at 20 fps.

- **P2 is ball receiver.** P2 (odd index, right paddle) receives ball state from P1 via broadcast and renders it with dead reckoning (velocity advances + 30% correction per frame toward the latest target). P2 sends their own paddle position to P1 via broadcast (event `"paddle"`).

- **Both paddle positions are synced** via the same channel (event `"paddle"`). Each player broadcasts their own paddle Y at 20 fps. The opponent's paddle is displayed at the latest received position.

- **Scoring.** The ball state includes `p1Score` and `p2Score`. P1 updates scores locally on goals; P2 receives them via each ball broadcast. Both clients display `P1 - P2` (P1 on the left, P2 on the right). First to 7 (`SCORE_LIMIT`) ends the match.

- **Score reporting.** Each player reports their OWN goals to the room via `this.room.reportScore(this.score)` on game-over. P1 reports P1's goals; P2 reports P2's goals. Unpaired players report their own score against the AI.

- **Architecture files:**
  - `game/PongChannel.ts` — Realtime channel wrapper: subscribes to `room:{code}:pong`, handles `"paddle"` and `"ball"` broadcast events, no-op without Supabase credentials.
  - `game/Game.ts` — routing: `updateOnline` (paired human), `updateUnpaired` (vs AI), `updateSolo` (no room). `checkCollisionsRoom` handles first-to-7 scoring and paddle bounces for P1.

File `PongChannel.ts` is game-specific and independent of `src/shared/room/channel.ts`. It creates its own Supabase channel subscription and does not touch the shared room infrastructure.

Without `?room=` param, no Supabase, or no opponent — the game falls back to standard solo or AI mode seamlessly.
