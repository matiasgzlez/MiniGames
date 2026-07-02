import { getNickname } from "../../../shared/nickname";
import { fetchRoomState, sanitizeCode } from "../../../shared/room/api";
import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import { getSupabase } from "../../../shared/supabase";
import { Car, type CarInput } from "./Car";
import {
  BEST_KEY,
  MAX_DT,
  NET_SEND_MS,
  REMOTE_STALE_MS,
  colorFor,
  formatRaceTime,
  hashStr,
} from "./constants";
import { Hud } from "./Hud";
import { RaceChannel } from "./RaceChannel";
import { SoundEffects } from "./SoundEffects";
import { Renderer, type RemoteCar } from "./Renderer";
import { TRACK_DEFS, buildTrack, type Track } from "./tracks";

type State = "loading" | "ready" | "countdown" | "racing" | "finished";

const COUNTDOWN_SEC = 3;

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hud: Hud;
  private readonly renderer = new Renderer();
  private readonly car = new Car();
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;
  private readonly roomCode: string | null;

  private track!: Track;
  private state: State = "loading";
  private readonly me: string;
  private readonly myColor: string;

  /** Autos de los demas jugadores de la sala, por nickname. */
  private readonly remotes = new Map<string, RemoteCar>();
  private channel: RaceChannel | null = null;
  private sendAccMs = 0;

  private countdownLeft = 0;
  /** Ultimo numero de cuenta regresiva que sono, para pitar una vez por tick. */
  private lastCountdownBeep = 0;
  private startTime = 0;
  private finalMs = 0;
  private lap = 0;
  private prevS = 0;
  private sectors = [false, false, false];
  private best = Number(localStorage.getItem(BEST_KEY)) || 0;

  private readonly keys: CarInput = { up: false, down: false, left: false, right: false };
  private lastTime = 0;
  private viewW = 0;
  private viewH = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.hud = new Hud(container, () => this.onAction());

    const rawCode = new URLSearchParams(window.location.search).get("room");
    this.roomCode = rawCode ? sanitizeCode(rawCode) : null;
    this.me = getNickname() ?? "yo";
    this.myColor = colorFor(this.me);

    this.room = initRoomMode("car-race", { getScore: () => Math.round(this.elapsedMs()) });

    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    this.resize();
    window.addEventListener("resize", () => this.resize());

    void this.boot();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  /**
   * Elige el circuito y arma el canal de posiciones. En modo sala el mapa sale
   * de un seed deterministico (codigo + ronda), asi todos corren en el mismo;
   * en solitario es aleatorio puro.
   */
  private async boot(): Promise<void> {
    let trackIdx = Math.floor(Math.random() * TRACK_DEFS.length);

    if (this.roomCode && getSupabase()) {
      const state = await fetchRoomState(this.roomCode);
      const round = state?.room.current_round ?? 0;
      trackIdx = hashStr(`${this.roomCode}:${round}`) % TRACK_DEFS.length;

      this.channel = new RaceChannel(this.roomCode, round);
      this.channel.onPos((p) => {
        if (p.p === this.me) return;
        let car = this.remotes.get(p.p);
        if (!car) {
          car = {
            player: p.p,
            color: colorFor(p.p),
            x: p.x,
            y: p.y,
            angle: p.a,
            tx: p.x,
            ty: p.y,
            ta: p.a,
            lap: p.l,
            s: p.s,
            finished: p.f,
            lastAt: Date.now(),
          };
          this.remotes.set(p.p, car);
          return;
        }
        car.tx = p.x;
        car.ty = p.y;
        car.ta = p.a;
        car.lap = p.l;
        car.s = p.s;
        car.finished = p.f;
        car.lastAt = Date.now();
      });
    }

    this.setupTrack(trackIdx);

    if (this.room) {
      // En sala la carrera arranca sola: todos cargan casi a la vez y el
      // countdown de 3s los deja practicamente sincronizados.
      this.beginCountdown();
    } else {
      this.state = "ready";
      this.hud.showStart(this.track.def.name, this.track.def.laps, this.bestText());
    }
  }

  private setupTrack(trackIdx: number): void {
    this.track = buildTrack(trackIdx);
    this.hud.setTrackName(`${this.track.def.name} · ${this.track.def.laps} vueltas`);
    this.hud.setLap(1, this.track.def.laps);
    this.hud.setTime(formatRaceTime(0));
    this.placeAtGrid();
  }

  /** Grilla de largada: detras de la meta, con offset lateral estable por nick. */
  private placeAtGrid(): void {
    const start = this.track.pointAt(1 - 60 / this.track.total);
    const lane = ((hashStr(this.me) % 5) - 2) * (this.track.def.width / 6.5);
    const perp = start.angle + Math.PI / 2;
    this.car.reset(start.x + Math.cos(perp) * lane, start.y + Math.sin(perp) * lane, start.angle);
    this.prevS = this.track.progressAt(this.car.x, this.car.y).s;
    this.lap = 0;
    this.sectors = [false, false, false];
  }

  private onAction(): void {
    // En modo sala se corre una sola carrera por ronda: sin reintento.
    if (this.room) return;
    if (this.state === "ready" || this.state === "finished") {
      // Al reintentar toca un circuito aleatorio nuevo; el primer arranque
      // usa el que ya se anuncio en el overlay.
      if (this.state === "finished") {
        this.setupTrack(Math.floor(Math.random() * TRACK_DEFS.length));
      }
      this.hud.hideOverlay();
      this.beginCountdown();
    }
  }

  private beginCountdown(): void {
    this.state = "countdown";
    this.countdownLeft = COUNTDOWN_SEC;
    this.lastCountdownBeep = COUNTDOWN_SEC + 1;
    this.hud.hideOverlay();
  }

  private go(): void {
    this.state = "racing";
    this.startTime = performance.now();
    SoundEffects.playCountdownTick();
    this.hud.showCountdown("¡YA!", this.track.def.accent);
    window.setTimeout(() => this.hud.hideCountdown(), 700);
  }

  private elapsedMs(): number {
    if (this.state === "racing") return performance.now() - this.startTime;
    if (this.state === "finished") return this.finalMs;
    return 0;
  }

  private bestText(): string {
    return this.best > 0 ? formatRaceTime(this.best) : "-";
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        this.keys.up = down;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this.keys.down = down;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        this.keys.left = down;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this.keys.right = down;
        break;
      case "Enter":
      case " ":
        if (down) this.onAction();
        return;
      default:
        return;
    }
    e.preventDefault();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = this.viewW * dpr;
    this.canvas.height = this.viewH * dpr;
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Loop ----------

  private tick(timestamp: number): void {
    let dt = (timestamp - this.lastTime) / 1000;
    if (dt > MAX_DT) dt = MAX_DT;
    this.lastTime = timestamp;

    this.update(dt);
    if (this.track) {
      this.renderer.draw(
        this.ctx,
        this.viewW,
        this.viewH,
        this.track,
        this.car,
        this.myColor,
        [...this.remotes.values()],
      );
    }

    requestAnimationFrame((t) => this.tick(t));
  }

  private update(dt: number): void {
    if (this.state === "loading") return;

    this.updateRemotes(dt);

    if (this.state === "countdown") {
      this.countdownLeft -= dt;
      if (this.countdownLeft <= 0) {
        this.go();
      } else {
        const shown = Math.ceil(this.countdownLeft);
        if (shown !== this.lastCountdownBeep) {
          this.lastCountdownBeep = shown;
          SoundEffects.playCountdownTick();
        }
        this.hud.showCountdown(String(shown), this.track.def.accent);
      }
      return;
    }

    if (this.state !== "racing" && this.state !== "finished") return;

    if (this.state === "racing") {
      const input: CarInput = {
        up: this.keys.up || this.hud.touchInput.up,
        down: this.keys.down || this.hud.touchInput.down,
        left: this.keys.left || this.hud.touchInput.left,
        right: this.keys.right || this.hud.touchInput.right,
      };
      const { dist } = this.track.progressAt(this.car.x, this.car.y);
      this.car.update(dt, input, dist <= this.track.def.width / 2);
      this.trackLapProgress();
      this.hud.setTime(formatRaceTime(this.elapsedMs()));
      this.hud.setLap(this.lap + 1, this.track.def.laps);
    }

    this.updatePosition();
    this.netSend(dt);
  }

  /** Vueltas con checkpoints: hay que pasar los 3 sectores antes de la meta. */
  private trackLapProgress(): void {
    const { s } = this.track.progressAt(this.car.x, this.car.y);

    if (s > 0.2 && s < 0.4) this.sectors[0] = true;
    if (this.sectors[0] && s > 0.45 && s < 0.65) this.sectors[1] = true;
    if (this.sectors[1] && s > 0.7 && s < 0.9) this.sectors[2] = true;

    // Cruce de meta hacia adelante (el progreso salta de ~1 a ~0).
    if (this.prevS > 0.9 && s < 0.1 && this.sectors.every(Boolean)) {
      this.lap++;
      this.sectors = [false, false, false];
      if (this.lap >= this.track.def.laps) this.finishRace();
      else SoundEffects.playLap();
    }
    this.prevS = s;
  }

  private finishRace(): void {
    this.finalMs = performance.now() - this.startTime;
    this.state = "finished";
    SoundEffects.playFinish();
    this.hud.setTime(formatRaceTime(this.finalMs));
    this.hud.setLap(this.track.def.laps, this.track.def.laps);

    // Aviso inmediato de llegada al resto de la sala.
    this.emitPos();

    const ms = Math.round(this.finalMs);
    if (this.room) {
      this.room.reportScore(ms);
      return;
    }

    const isRecord = this.best === 0 || ms < this.best;
    if (isRecord) {
      this.best = ms;
      localStorage.setItem(BEST_KEY, String(this.best));
    }
    this.hud.showGameOver(formatRaceTime(ms), this.bestText(), isRecord, true);
    this.hud.showRanking("car-race", ms);
  }

  // ---------- Red ----------

  private netSend(dt: number): void {
    if (!this.channel) return;
    this.sendAccMs += dt * 1000;
    // Terminado, baja la cadencia: solo mantiene vivo el auto en pantalla.
    const interval = this.state === "finished" ? NET_SEND_MS * 5 : NET_SEND_MS;
    if (this.sendAccMs < interval) return;
    this.sendAccMs = 0;
    this.emitPos();
  }

  private emitPos(): void {
    if (!this.channel) return;
    this.channel.send({
      p: this.me,
      x: Math.round(this.car.x),
      y: Math.round(this.car.y),
      a: Number(this.car.angle.toFixed(3)),
      l: this.lap,
      s: Number(this.prevS.toFixed(4)),
      f: this.state === "finished",
    });
  }

  /** Interpola los autos remotos hacia su ultimo snapshot y purga inactivos. */
  private updateRemotes(dt: number): void {
    const now = Date.now();
    const k = 1 - Math.exp(-dt * 10);
    for (const [player, car] of this.remotes) {
      if (now - car.lastAt > REMOTE_STALE_MS) {
        this.remotes.delete(player);
        continue;
      }
      car.x += (car.tx - car.x) * k;
      car.y += (car.ty - car.y) * k;
      // Angulo por el camino corto para que el giro no de la vuelta larga.
      let da = car.ta - car.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      car.angle += da * k;
    }
  }

  /** Posicion en carrera comparando progreso total (vueltas + fraccion). */
  private updatePosition(): void {
    if (this.remotes.size === 0) {
      this.hud.setPos(null);
      return;
    }
    const myTotal = this.state === "finished" ? this.track.def.laps : this.lap + this.prevS;
    let rank = 1;
    for (const car of this.remotes.values()) {
      const theirTotal = car.finished ? this.track.def.laps : car.lap + car.s;
      if (theirTotal > myTotal) rank++;
    }
    this.hud.setPos(`${rank}°/${this.remotes.size + 1}`);
  }
}
