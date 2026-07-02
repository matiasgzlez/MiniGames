import { initRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import {
  applyFlip,
  canFlip,
  createState,
  isComplete,
  SOLO_DIMS,
  type MemoryState,
} from "./board";
import {
  BEST_KEY,
  COUNTDOWN_LABELS,
  COUNTDOWN_STEP,
  MAX_DT,
  REVEAL_HOLD_MS,
  SOLO_TIME_LIMIT,
} from "./constants";
import { Hud } from "./Hud";
import { SharedMatch } from "./sharedMatch";
import { SoundEffects } from "./SoundEffects";

type State = "ready" | "countdown" | "playing" | "over";

/** Nombre del unico jugador del modo solo (turnOrder de un solo lugar). */
const SOLO_PLAYER = "yo";

export class Game {
  private readonly hud: Hud;
  /** Modo sala (multijugador): activo solo con ?room= en la URL. */
  private readonly room: RoomMode | null;
  /** Tablero compartido; existe solo en modo sala y tras el countdown. */
  private shared: SharedMatch | null = null;
  private state: State = "ready";

  // Modo solo (contrarreloj)
  private soloState: MemoryState | null = null;
  private score = 0;
  private timeLeft = SOLO_TIME_LIMIT;
  private holdUp: number[] = [];
  private animating = false;

  private countdownTime = 0;
  private lastTime = 0;

  constructor(container: HTMLElement) {
    this.hud = new Hud(container);
    // Parcial por timeout: pares propios del tablero compartido (o del
    // contrarreloj, aunque en sala el solo nunca corre).
    this.room = initRoomMode("memory-match", {
      getScore: () => (this.shared ? this.shared.myPairs() : this.score),
    });

    this.hud.showStart(this.loadBest(), this.room !== null);
    this.hud.onOverlayTap(() => this.tryStart());
    window.addEventListener("keydown", this.handleKeyDown);

    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") this.tryStart();
  };

  private tryStart(): void {
    // En sala se juega una sola partida por ronda: sin reintento.
    if (this.state === "over" && this.room) return;
    if (this.state === "ready" || this.state === "over") this.beginCountdown();
  }

  private beginCountdown(): void {
    this.state = "countdown";
    this.countdownTime = 0;
    this.hud.hideOverlay();
    this.hud.showCountdown(COUNTDOWN_LABELS[0]);

    if (this.room) {
      this.hud.setTurnText("");
    } else {
      this.score = 0;
      this.timeLeft = SOLO_TIME_LIMIT;
      this.newSoloBoard();
    }
  }

  private startPlay(): void {
    this.state = "playing";
    if (this.room) {
      this.shared = new SharedMatch(this.room, this.hud, () => {
        this.state = "over";
      });
      this.shared.start();
    }
  }

  // ---------- Modo solo ----------

  private newSoloBoard(): void {
    this.soloState = createState(SOLO_DIMS.pairs, [SOLO_PLAYER]);
    this.holdUp = [];
    this.animating = false;
    this.hud.setupBoard(SOLO_DIMS.cols, this.soloState.cards, (i) => this.handleSoloFlip(i));
    this.renderSolo();
  }

  private handleSoloFlip(index: number): void {
    const state = this.soloState;
    if (this.state !== "playing" || !state || this.animating) return;
    if (!canFlip(state, SOLO_PLAYER, index)) return;

    const next = applyFlip(state, SOLO_PLAYER, index);
    this.soloState = next;
    SoundEffects.playFlip();

    const reveal = next.reveal;
    if (!reveal) {
      // Primera carta del intento.
      this.renderSolo();
      return;
    }

    if (reveal.matchedBy !== null) {
      this.score++;
      SoundEffects.playMatch();
      this.renderSolo();
      if (isComplete(next)) {
        // Tablero completo: se renueva y el reloj sigue corriendo.
        this.animating = true;
        window.setTimeout(() => {
          if (this.state === "playing") this.newSoloBoard();
        }, 600);
      }
    } else {
      SoundEffects.playFail();
      this.animating = true;
      this.holdUp = [reveal.a, reveal.b];
      this.renderSolo();
      window.setTimeout(() => {
        this.holdUp = [];
        this.animating = false;
        this.renderSolo();
      }, REVEAL_HOLD_MS);
    }
  }

  private renderSolo(): void {
    const state = this.soloState;
    if (!state) return;
    const faceUp = state.cards.map(
      (_, i) =>
        state.matchedBy[i] !== null || state.flipped.includes(i) || this.holdUp.includes(i),
    );
    const owners = state.matchedBy.map((owner) => (owner === null ? null : 0));
    this.hud.renderCards(faceUp, owners);
    this.hud.setStats(this.score, this.timeLeft);
  }

  private endSolo(): void {
    this.state = "over";
    this.timeLeft = 0;
    SoundEffects.playVictory();

    const best = this.loadBest();
    const isNewBest = best === null || this.score > best;
    if (isNewBest) localStorage.setItem(BEST_KEY, String(this.score));

    this.hud.showGameOver(this.score, isNewBest ? this.score : best ?? this.score, isNewBest);
    this.hud.showRanking("memory-match", this.score);
  }

  private loadBest(): number | null {
    const raw = localStorage.getItem(BEST_KEY);
    return raw === null ? null : parseInt(raw, 10);
  }

  // ---------- Loop ----------

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;
    this.update(dt);
    requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    if (this.state === "countdown") {
      this.countdownTime += dt;
      const index = Math.floor(this.countdownTime / COUNTDOWN_STEP);
      if (index >= COUNTDOWN_LABELS.length) {
        this.hud.showCountdown(null);
        this.startPlay();
      } else {
        this.hud.showCountdown(COUNTDOWN_LABELS[index]);
      }
    } else if (this.state === "playing" && !this.room) {
      this.timeLeft -= dt;
      this.hud.setStats(this.score, this.timeLeft);
      if (this.timeLeft <= 0) this.endSolo();
    }
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
