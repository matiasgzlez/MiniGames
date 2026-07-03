import {
  MAX_DT,
  PADDLE_MARGIN,
  PADDLE_WIDTH,
  PLAYER_SPEED,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./constants";
import { Paddle } from "./Paddle";
import { Ball } from "./Ball";
import { Ai } from "./Ai";
import { Renderer } from "./Renderer";
import { InputController } from "./InputController";
import { Hud } from "./Hud";
import { SoundEffects } from "./SoundEffects";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";

type State = "ready" | "countdown" | "playing" | "dead";

const BEST_KEY = "pong:best";
const SCORE_LIMIT = 7;

const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
const COUNTDOWN_STEP = 0.75;

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly player = new Paddle(PADDLE_MARGIN);
  private readonly aiPaddle = new Paddle(VIEW_WIDTH - PADDLE_WIDTH - PADDLE_MARGIN);
  private readonly ai = new Ai(this.aiPaddle);
  private readonly ball = new Ball();
  private readonly renderer = new Renderer();
  private readonly hud: Hud;
  private readonly input: InputController;
  private readonly room: RoomMode | null;
  private readonly isRoomMode: boolean;

  private state: State = "ready";
  private score = 0;
  private score2 = 0;
  private best = Number(localStorage.getItem(BEST_KEY)) || 0;
  private lastTime = 0;
  private deadFor = 0;
  private countdownTime = 0;
  private lastCountdownIndex = -1;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.hud = new Hud(container);
    this.hud.showScore(false);
    this.hud.showStart();

    this.room = initRoomMode("pong", {
      getScore: () => this.score,
      onStart: () => this.beginCountdown(),
    });
    this.isRoomMode = this.room !== null;

    this.hud.setHintText(
      this.isRoomMode ? "J1: W/S  |  J2: FLECHAS" : "flechas / W S para mover",
    );

    this.input = new InputController(
      container,
      () => this.onAction(),
    );

    this.resize();
    window.addEventListener("resize", this.resize);

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private onAction(): void {
    switch (this.state) {
      case "ready":
        this.beginCountdown();
        break;
      case "dead":
        if (this.room) return;
        if (this.deadFor > 0.6) this.beginCountdown();
        break;
    }
  }

  private beginCountdown(): void {
    this.state = "countdown";
    this.countdownTime = 0;
    this.lastCountdownIndex = -1;
    this.player.reset();
    this.aiPaddle.reset();
    this.ball.reset();
    this.hud.showScore(false);
    this.hud.hide();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);
  }

  private start(): void {
    this.state = "playing";
    this.score = 0;
    this.score2 = 0;
    if (this.isRoomMode) {
      this.hud.showScoreRoom(0, 0);
      this.ball.launch(Math.random() < 0.5);
    } else {
      this.hud.setScore(0);
      this.hud.showScore(true);
      this.ball.launch(true);
    }
    this.hud.hide();
    this.hud.showCountdown(null);
  }

  private die(): void {
    this.state = "dead";
    this.deadFor = 0;
    SoundEffects.playLose();
    this.hud.showScore(false);
    if (!this.isRoomMode) {
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem(BEST_KEY, String(this.best));
      }
    }
    this.hud.showGameOver(this.score, this.best, this.score2, this.isRoomMode);
    if (this.room) this.room.reportScore(this.score);
    else this.hud.showRanking("pong", this.score);
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    if (this.state === "playing") {
      const p1Dir = this.isRoomMode ? this.input.p1Dir : this.input.moveDir;
      this.player.y += p1Dir * PLAYER_SPEED * dt;
      this.player.clamp();

      if (this.isRoomMode) {
        this.aiPaddle.y += this.input.p2Dir * PLAYER_SPEED * dt;
        this.aiPaddle.clamp();
      } else {
        this.ai.update(dt, this.ball);
      }

      this.ball.update(dt);

      this.checkCollisions();
    } else if (this.state === "countdown") {
      this.updateCountdown(dt);
    } else if (this.state === "dead") {
      this.deadFor += dt;
    }
  }

  private checkCollisions(): void {
    if (this.ball.left <= 0) {
      if (this.isRoomMode) {
        this.score2++;
        this.hud.showScoreRoom(this.score, this.score2);
        SoundEffects.playScore();
        if (this.score2 >= SCORE_LIMIT) { this.die(); return; }
        this.ball.launch(true);
        return;
      }
      this.die();
      return;
    }

    if (this.ball.right >= VIEW_WIDTH) {
      if (this.isRoomMode) {
        this.score++;
        this.hud.showScoreRoom(this.score, this.score2);
        SoundEffects.playScore();
        if (this.score >= SCORE_LIMIT) { this.die(); return; }
        this.ball.launch(false);
        return;
      }
      this.score++;
      this.hud.setScore(this.score);
      SoundEffects.playScore();
      this.ball.launch(true);
      return;
    }

    if (
      this.ball.vx < 0 &&
      this.ball.left <= this.player.right &&
      this.ball.x > this.player.x &&
      this.ball.bottom > this.player.top &&
      this.ball.top < this.player.bottom
    ) {
      this.ball.x = this.player.right + this.ball.radius;
      this.ball.bouncePaddle(this.player);
      SoundEffects.playHit();
    }

    if (
      this.ball.vx > 0 &&
      this.ball.right >= this.aiPaddle.left &&
      this.ball.x < this.aiPaddle.x + this.aiPaddle.w &&
      this.ball.bottom > this.aiPaddle.top &&
      this.ball.top < this.aiPaddle.bottom
    ) {
      this.ball.x = this.aiPaddle.left - this.ball.radius;
      this.ball.bouncePaddle(this.aiPaddle);
      SoundEffects.playHit();
    }

    if (this.ball.top <= 0 || this.ball.bottom >= VIEW_HEIGHT) {
      SoundEffects.playWall();
    }
  }

  private updateCountdown(dt: number): void {
    this.countdownTime += dt;
    const index = Math.floor(this.countdownTime / COUNTDOWN_STEP);
    if (index >= COUNTDOWN_LABELS.length) this.start();
    else if (index !== this.lastCountdownIndex) {
      this.lastCountdownIndex = index;
      SoundEffects.playCountdownTick();
      this.hud.showCountdown(COUNTDOWN_LABELS[index]);
    }
  }

  private render(): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.clip();
    this.renderer.draw(ctx, this.player, this.aiPaddle, this.ball);
    ctx.restore();
  }

  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const fit = Math.min(w / VIEW_WIDTH, h / VIEW_HEIGHT);
    this.scale = fit * dpr;
    this.offsetX = (w / fit - VIEW_WIDTH) / 2;
    this.offsetY = (h / fit - VIEW_HEIGHT) / 2;
  };

  dispose(): void {
    window.removeEventListener("resize", this.resize);
    this.input.dispose();
  }
}
