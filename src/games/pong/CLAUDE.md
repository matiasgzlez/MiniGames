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

## Room mode (multiplayer)

Wired to the shared party mode: the constructor calls `initRoomMode("pong", { getScore: () => this.score, onStart: () => this.beginCountdown() })` (see root `CLAUDE.md`, "Salas (multiplayer rooms)"). With `?room=` in the URL the game becomes **same-device PvP**: two human players share one screen. No AI. Player 1 (left paddle, W/S) is the room participant; Player 2 (right paddle, Arrow keys) is a guest on the same keyboard. The game ends when either player reaches 7 goals (`SCORE_LIMIT`). Player 1's goals are reported as their room score. Player 2's goals display on screen but are not individually reported to the room (guest player). The restart input is blocked — the room overlay handles the round lifecycle.
