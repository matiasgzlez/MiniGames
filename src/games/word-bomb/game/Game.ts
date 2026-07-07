import { initRoomMode, isRoomMode, type RoomMode } from "../../../shared/room/roomMode";
import { COUNTDOWN_LABELS, COUNTDOWN_STEP, GAME_SERVER_URL } from "./constants";
import { Hud } from "./Hud";
import { SocketTransport } from "./SocketTransport";
import { SoundEffects } from "./SoundEffects";
import type { WbGameover, WbRejectReason, WbState } from "./WordBombTransport";

type State = "message" | "countdown" | "playing" | "over";

const REJECT_MESSAGES: Record<WbRejectReason, string> = {
  "not-a-word": "no esta en el diccionario",
  "missing-fragment": "no contiene el fragmento",
  "already-used": "ya se uso esa palabra",
  "not-your-turn": "no es tu turno",
};

/**
 * Bomba Palabra: juego SOLO de sala. Supabase maneja lobby / marcador / rejoin
 * (via RoomMode); el estado en-ronda (turno, mecha, vidas, validacion contra el
 * diccionario) lo maneja el game server autoritativo por socket.io. Sin sala o
 * sin server configurado no se puede jugar: se muestra un cartel (excepcion
 * deliberada a la degradacion del repo, ver CLAUDE.md).
 */
export class Game {
  private readonly hud: Hud;
  private state: State = "message";

  private readonly room: RoomMode | null;
  private transport: SocketTransport | null = null;

  private lastCountdownIndex = -1;

  private latest: WbState | null = null;
  private prev: WbState | null = null;
  private lastAcceptSeq = 0;
  private fuseTotal = 0;
  private fuseKey = "";

  constructor(root: HTMLElement) {
    this.hud = new Hud(root);
    this.hud.onSubmit((word) => this.onSubmitWord(word));
    this.hud.onType((text) => this.transport?.sendTyping(text));

    this.room = initRoomMode("word-bomb", {
      getScore: () => this.liveScore(),
      onStart: () => this.beginCountdown(),
    });

    if (!this.room) {
      // Sin ?room= (o sin Supabase): el juego es solo de sala.
      if (isRoomMode()) {
        this.hud.showMessage(
          "No disponible",
          "Bomba Palabra necesita las credenciales de la sala y no estan configuradas.",
        );
      } else {
        this.hud.showMessage(
          "Solo en salas",
          "Bomba Palabra se juega con amigos en una sala. Cre&aacute; o un&iacute;te a una para jugar.",
          { label: "Ir a las salas", onClick: () => (window.location.href = "/rooms/") },
        );
      }
      return;
    }

    if (!GAME_SERVER_URL) {
      this.hud.showMessage(
        "No disponible",
        "Bomba Palabra necesita el game server y no est&aacute; configurado (VITE_GAME_SERVER_URL).",
      );
      return;
    }

    // En sala: RoomMode dispara onStart al pasar a "playing" y arranca el countdown.
    this.hud.showMessage("Bomba Palabra", "Esper&aacute; a que empiece la ronda...");
  }

  // ---------- Countdown ----------

  private beginCountdown(): void {
    if (this.state === "countdown" || this.state === "playing") return;
    this.state = "countdown";
    this.lastCountdownIndex = -1;
    this.connect();

    let i = 0;
    const step = () => {
      if (i >= COUNTDOWN_LABELS.length) {
        this.hud.showCountdown(null);
        this.startPlaying();
        return;
      }
      if (i !== this.lastCountdownIndex) {
        this.lastCountdownIndex = i;
        SoundEffects.playCountdownTick();
      }
      this.hud.showCountdown(COUNTDOWN_LABELS[i]);
      i += 1;
      window.setTimeout(step, COUNTDOWN_STEP);
    };
    step();
  }

  private startPlaying(): void {
    this.state = "playing";
    this.hud.showStage();
    if (this.latest) this.applyState(this.latest);
  }

  // ---------- Transporte ----------

  private connect(): void {
    if (this.transport || !this.room || !GAME_SERVER_URL) return;
    const transport = new SocketTransport(
      GAME_SERVER_URL,
      this.room.code,
      this.room.me,
      this.room.players(),
    );
    transport.onState((s) => this.onState(s));
    transport.onInvalid((r) => this.onInvalid(r));
    transport.onTyping((player, text) => {
      if (this.state === "playing") this.hud.showTyping(player, text);
    });
    transport.onGameover((r) => this.onGameover(r));
    this.transport = transport;
    void transport.connect();
  }

  private onState(s: WbState): void {
    this.latest = s;
    if (this.state === "playing") this.applyState(s);
  }

  private applyState(s: WbState): void {
    const me = this.room?.me ?? "";
    const turnPlayer = s.turn;
    const myTurn = s.phase === "playing" && turnPlayer === me;

    // Sonidos por diff contra el estado anterior.
    this.playDiffSounds(s);

    let statusText: string;
    if (s.phase === "waiting") statusText = "Preparando la ronda...";
    else if (s.phase === "over") statusText = "Ronda terminada";
    else if (myTurn) statusText = "TU TURNO";
    else statusText = turnPlayer ? `TURNO DE ${turnPlayer}` : "";

    this.hud.render({
      players: s.players.map((p) => ({
        nickname: p.nickname,
        lives: p.lives,
        alive: p.alive,
        connected: p.connected,
        isTurn: s.phase === "playing" && p.nickname === turnPlayer,
        isMe: p.nickname === me,
      })),
      fragment: s.fragment,
      statusText,
      myTurn,
      usedCount: s.usedCount,
    });

    // Mecha: reinicia solo cuando cambia el turno/fragmento (no en cada snapshot).
    const key = `${turnPlayer}|${s.fragment}|${s.deadline}`;
    if (s.phase === "playing" && s.deadline && key !== this.fuseKey) {
      this.fuseKey = key;
      this.fuseTotal = Math.max(1, s.deadline - Date.now());
      this.hud.startFuse(s.deadline, this.fuseTotal);
    }

    this.prev = s;
  }

  private playDiffSounds(s: WbState): void {
    // Palabra aceptada nueva.
    if (s.lastAccepted && s.lastAccepted.seq > this.lastAcceptSeq) {
      this.lastAcceptSeq = s.lastAccepted.seq;
      SoundEffects.playAccept();
      if (s.lastAccepted.player === this.room?.me) this.hud.flashAccept(s.lastAccepted.word);
    }
    if (!this.prev) return;
    // Vida perdida en algun jugador -> exploto la mecha.
    const before = new Map(this.prev.players.map((p) => [p.nickname, p.lives]));
    for (const p of s.players) {
      const was = before.get(p.nickname);
      if (was !== undefined && p.lives < was) {
        SoundEffects.playExplode();
        break;
      }
    }
    // Cambio de turno (sin palabra aceptada por medio ya cubierto arriba).
    if (this.prev.turn !== s.turn && s.phase === "playing") SoundEffects.playTurn();
  }

  private onInvalid(reason: WbRejectReason): void {
    SoundEffects.playReject();
    this.hud.flashReject(REJECT_MESSAGES[reason]);
  }

  private onSubmitWord(word: string): void {
    if (this.state !== "playing") return;
    this.transport?.submit(word);
    this.hud.clearInput();
  }

  private onGameover(result: WbGameover): void {
    if (this.state === "over") return;
    this.state = "over";
    this.hud.stopFuse();
    this.hud.setInputEnabled(false);

    const me = this.room?.me ?? "";
    const mine = result.ranking.find((r) => r.nickname === me);
    const place = mine?.place ?? result.ranking.length;
    if (place === 1) SoundEffects.playWin();
    else SoundEffects.playLose();

    // Puntaje placement-based (mayor = mejor): sobrevivir mas suma mas. El
    // RoomOverlay toma la pantalla con el resultado de la ronda.
    if (this.room) this.room.reportScore(this.placementScore(result, place));
  }

  // ---------- Puntaje ----------

  private placementScore(result: WbGameover, place: number): number {
    return Math.max(0, result.ranking.length - place);
  }

  /** Puntaje en vivo para el parcial por timeout de Supabase (rara vez se usa:
   * la partida casi siempre termina por eliminacion antes del tope de ronda).
   * Proxy: cuantos jugadores ya quedaron afuera (a los que sobrevivi). */
  private liveScore(): number {
    if (!this.latest) return 0;
    return this.latest.players.filter((p) => !p.alive).length;
  }
}
