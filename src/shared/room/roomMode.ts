import { games } from "../../games";
import { formatScore, getScoring } from "../scoring";
import { getNickname } from "../nickname";
import { getSupabase } from "../supabase";
import {
  beginPlay,
  castVote,
  closeRound,
  fetchRoomState,
  finishRoom,
  markReady,
  openVote,
  reportScore,
  resetRoom,
  sanitizeCode,
  startBriefing,
  startRound,
  takeOverHost,
} from "./api";
import { RoomChannel, type LiveScore } from "./channel";
import { RoomOverlay, type BriefingPlayer, type LiveRow, type WaitingEntry } from "./RoomOverlay";
import { computeTotals, rankRound } from "./points";
import { BRIEFING_TIMEOUT_SEC, type RoomState } from "./types";

/**
 * Juegos que orquestan su propio arranque multijugador y ranking en vivo
 * (autos en pista, partido en vivo, tablero de Monopoly). NO pasan por la fase
 * de briefing generica ni por el ranking-en-vivo compartido: arrancan directo a
 * 'playing' y muestran su propia sincronizacion.
 */
export const SELF_MANAGED = new Set(["car-race", "rocket-arena", "monopoly-mundial"]);

/** Cadencia de emision del puntaje en vivo y ventana de frescura de lo recibido. */
const LIVE_BROADCAST_MS = 1000;
const LIVE_STALE_MS = 4000;

/**
 * Orquestador del modo sala dentro de cada juego. Contrato minimo por juego:
 *
 *   private readonly room = initRoomMode("<id>", { getScore: () => this.score });
 *   // input en estado "dead": if (this.room) return;   // una sola partida
 *   // game over: if (this.room) this.room.reportScore(this.score);
 *   //            else this.hud.showRanking("<id>", this.score);
 *
 * initRoomMode devuelve null sin `?room=` en la URL o sin Supabase, asi que
 * fuera del modo sala el juego no cambia en nada. En modo sala NO se envia el
 * puntaje al ranking global (las partidas cortadas por timeout lo
 * contaminarian).
 */

export interface RoomModeHooks {
  /** Puntaje actual de la partida en curso (para el parcial por timeout). */
  getScore: () => number;
}

export interface RoomMode {
  readonly active: true;
  /** Llamar en el game-over, donde fuera del modo sala va hud.showRanking. */
  reportScore(finalScore: number): void;
}

/** Variante fija que usa cada juego con variantes cuando corre en modo sala. */
export const ROOM_VARIANTS: Record<string, string> = {
  "sliding-puzzle": "4",
};

/** Chequeo barato (sin red) de si la pagina corre en modo sala. */
export function isRoomMode(): boolean {
  return readRoomCode() !== null;
}

function readRoomCode(): string | null {
  const raw = new URLSearchParams(window.location.search).get("room");
  return raw ? sanitizeCode(raw) : null;
}

/** URL de un juego dentro de una sala. */
export function roomGameUrl(gameId: string, code: string): string {
  const game = games.find((g) => g.id === gameId);
  return game ? `${game.path}?room=${code}` : "/";
}

/** Un juego al azar (para la primera ronda sin playlist). */
export function randomGameId(): string {
  return games[Math.floor(Math.random() * games.length)].id;
}

/**
 * Margen extra sobre el tope de ronda para cubrir la navegacion entre paginas
 * y el countdown 3/2/1/YA de cada juego.
 */
const NAV_GRACE_SEC = 10;

/** Deadline de una ronda que arranca ahora. */
export function computeRoundDeadline(roundTimeLimitSec: number): Date {
  return new Date(Date.now() + (roundTimeLimitSec + NAV_GRACE_SEC) * 1000);
}

/** Tope de auto-inicio del briefing (si alguien no da OK, arranca igual). */
export function computeBriefingDeadline(): Date {
  return new Date(Date.now() + BRIEFING_TIMEOUT_SEC * 1000);
}

const TICK_MS = 500;
const POLL_MS = 5000;
const VOTE_SECONDS = 20;
/** Espera tras el deadline antes de cerrar, para que lleguen los parciales. */
const CLOSE_LAG_MS = 2500;
/** Cierre anticipado: todos los presentes reportaron y hay ausentes. */
const CLOSE_EARLY_GRACE_MS = 15000;
/** Ausencia continua del host antes de ofrecer "tomar el control". */
const HOST_ABSENT_MS = 20000;
/** Pausa en resultados antes de que el host abra la votacion. */
const RESULTS_TO_VOTE_MS = 5000;

export function initRoomMode(gameId: string, hooks: RoomModeHooks): RoomMode | null {
  const code = readRoomCode();
  if (!code || !getSupabase()) return null;

  const me = getNickname();
  if (!me) {
    // Nunca se unio: que pase por el lobby a elegir nombre.
    window.location.href = `/rooms/?code=${code}`;
    return { active: true, reportScore: () => {} };
  }

  const controller = new RoomModeController(gameId, code, me, hooks);
  void controller.boot();
  return controller;
}

class RoomModeController implements RoomMode {
  readonly active = true as const;

  private readonly overlay = new RoomOverlay();
  private channel: RoomChannel | null = null;
  private state: RoomState | null = null;
  /** Ronda que esta pagina esta jugando (fijada al cargar). */
  private myRound = 0;
  private reported = false;
  private navigating = false;
  private refreshing = false;
  private refreshQueued = false;
  /** Evita disparar dos veces una mutacion de host. */
  private actionInFlight = false;
  private voteScheduledForRound = 0;
  private hostAbsentSince: number | null = null;
  /** Puntajes en vivo recibidos de otros jugadores (efimeros, con timestamp). */
  private readonly liveScores = new Map<string, { score: number; at: number }>();
  private lastLiveBroadcast = 0;

  private readonly gameId: string;
  private readonly code: string;
  private readonly me: string;
  private readonly hooks: RoomModeHooks;
  /** Este juego orquesta su propio arranque/ranking: sin briefing ni live board. */
  private readonly selfManaged: boolean;

  constructor(gameId: string, code: string, me: string, hooks: RoomModeHooks) {
    this.gameId = gameId;
    this.code = code;
    this.me = me;
    this.hooks = hooks;
    this.selfManaged = SELF_MANAGED.has(gameId);
  }

  async boot(): Promise<void> {
    const state = await fetchRoomState(this.code);
    if (!state) {
      this.overlay.showError("La sala no existe o no se pudo cargar.");
      return;
    }
    if (!state.players.includes(this.me)) {
      this.navigate(`/rooms/?code=${this.code}`);
      return;
    }

    this.myRound = state.room.current_round;
    this.reported = state.scores.some(
      (s) => s.round_no === this.myRound && s.player === this.me,
    );

    this.channel = new RoomChannel(this.code, this.me);
    this.channel.onSync(() => void this.refresh());
    this.channel.onPresence(() => this.applyState());
    this.channel.onLive((live) => this.onLive(live));

    // Congela el teclado del juego mientras se muestran las instrucciones, para
    // que nadie pueda arrancar antes de tiempo (el overlay ya tapa el puntero).
    if (!this.selfManaged) {
      window.addEventListener("keydown", this.keyGate, true);
    }

    this.applyState(state);

    window.setInterval(() => this.tick(), TICK_MS);
    window.setInterval(() => void this.refresh(), POLL_MS);
  }

  /** Bloquea las teclas del juego durante el briefing (fase de instrucciones). */
  private readonly keyGate = (e: KeyboardEvent): void => {
    const room = this.state?.room;
    if (!room || room.status !== "briefing") return;
    if (room.current_round !== this.myRound || room.current_game !== this.gameId) return;
    e.stopImmediatePropagation();
  };

  /** Puntaje en vivo recibido de otro jugador: actualiza el ranking en tiempo real. */
  private onLive(live: LiveScore): void {
    if (this.selfManaged || live.player === this.me) return;
    this.liveScores.set(live.player, { score: live.score, at: Date.now() });
    this.renderLive();
  }

  reportScore(finalScore: number): void {
    void this.submitScore(finalScore, true);
  }

  // ---------- Estado ----------

  private async refresh(): Promise<void> {
    if (this.navigating) return;
    if (this.refreshing) {
      this.refreshQueued = true;
      return;
    }
    this.refreshing = true;
    const state = await fetchRoomState(this.code);
    this.refreshing = false;
    if (state) this.applyState(state);
    if (this.refreshQueued) {
      this.refreshQueued = false;
      void this.refresh();
    }
  }

  /** Re-renderiza segun el ultimo snapshot (o uno nuevo si se pasa). */
  private applyState(state?: RoomState): void {
    if (state) this.state = state;
    if (!this.state || this.navigating) return;
    const room = this.state.room;

    if (room.status === "lobby") {
      this.navigate(`/rooms/?code=${this.code}`);
      return;
    }
    if (room.status === "finished") {
      this.overlay.setStrip(null);
      // El host puede volver a la sala al lobby para jugar otra vez con los
      // mismos jugadores; todos navegan solos al ver status='lobby'.
      this.overlay.showFinal(computeTotals(this.state), this.me, {
        hostAction: this.isHost()
          ? { label: "Jugar otra vez", onClick: () => void this.hostAction(() => resetRoom(this.code)) }
          : null,
        waitingText: "El anfitrion puede iniciar otra partida",
      });
      this.updateTakeover();
      return;
    }

    // Otra ronda u otro juego: esta pagina ya no es la vigente.
    if (room.current_round !== this.myRound || room.current_game !== this.gameId) {
      void this.leaveForCurrentRound();
      return;
    }

    switch (room.status) {
      case "briefing":
        this.updateStripBriefing();
        this.renderBriefing();
        if (this.isHost()) void this.maybeBeginPlay();
        break;
      case "playing":
        this.updateStrip();
        if (this.selfManaged) {
          if (this.reported) this.renderWaiting();
          else this.overlay.hide();
        } else if (this.reported) {
          this.renderLive();
        } else {
          this.overlay.hide();
          this.renderLiveBoard();
        }
        if (this.isHost()) void this.maybeCloseRound();
        break;
      case "results":
        this.overlay.setStrip(null);
        this.renderResults();
        break;
      case "voting":
        this.overlay.setStrip(null);
        this.renderVoting();
        break;
    }
    this.updateTakeover();
  }

  /** Reporta el parcial si hacia falta y navega a la ronda vigente. */
  private async leaveForCurrentRound(): Promise<void> {
    const room = this.state!.room;
    if (!this.reported && this.myRound > 0) {
      await this.submitScore(this.hooks.getScore(), false);
    }
    this.navigate(roomGameUrl(room.current_game ?? "", this.code));
  }

  private async submitScore(score: number, finished: boolean): Promise<void> {
    if (this.reported) return;
    this.reported = true;
    this.renderWaiting();
    const ok = await reportScore(this.code, this.myRound, this.me, score, finished);
    if (ok) this.channel?.ping();
    void this.refresh();
  }

  private navigate(url: string): void {
    if (this.navigating) return;
    this.navigating = true;
    window.location.href = url;
  }

  private isHost(): boolean {
    return this.state?.room.host === this.me;
  }

  private deadlineMs(): number | null {
    const iso = this.state?.room.deadline;
    return iso ? new Date(iso).getTime() : null;
  }

  private totalRounds(): number {
    const settings = this.state!.room.settings;
    return settings.playlist ? settings.playlist.length : settings.totalRounds;
  }

  private roundScores() {
    return this.state!.scores.filter((s) => s.round_no === this.state!.room.current_round);
  }

  private gameTitle(gameId: string): string {
    return games.find((g) => g.id === gameId)?.title ?? gameId;
  }

  // ---------- Ticker ----------

  private tick(): void {
    if (!this.state || this.navigating) return;
    const room = this.state.room;
    const deadline = this.deadlineMs();
    const now = Date.now();

    if (room.status === "briefing") {
      this.updateStripBriefing();
      if (deadline !== null) {
        this.overlay.setTimeText(`Empieza en ${formatClock(deadline - now)}`);
      }
      if (this.isHost()) void this.maybeBeginPlay();
    } else if (room.status === "playing") {
      this.updateStrip();
      // Ranking en vivo: emitir el puntaje propio y refrescar el panel-esquina.
      if (!this.selfManaged && !this.reported) {
        if (now - this.lastLiveBroadcast >= LIVE_BROADCAST_MS) {
          this.lastLiveBroadcast = now;
          this.channel?.broadcastLive(this.hooks.getScore());
        }
        this.renderLiveBoard();
      }
      if (deadline !== null) {
        this.overlay.setTimeText(`La ronda termina en ${formatClock(deadline - now)}`);
        if (!this.reported && now >= deadline) {
          void this.submitScore(this.hooks.getScore(), false);
        }
        if (this.isHost() && now >= deadline + CLOSE_LAG_MS) {
          void this.maybeCloseRound(true);
        }
      }
    } else if (room.status === "voting" && deadline !== null) {
      this.overlay.setTimeText(formatClock(deadline - now));
      if (this.isHost() && now >= deadline + CLOSE_LAG_MS) {
        void this.closeVoting();
      }
    }

    this.updateTakeover();
  }

  private updateStrip(): void {
    const room = this.state!.room;
    const deadline = this.deadlineMs();
    const time = deadline !== null ? ` - ${formatClock(deadline - Date.now())}` : "";
    this.overlay.setStrip(
      `SALA ${this.code} - Ronda ${room.current_round}/${this.totalRounds()}${time}`,
    );
  }

  private updateStripBriefing(): void {
    this.overlay.setStrip(
      `SALA ${this.code} - Ronda ${this.myRound}/${this.totalRounds()} - Instrucciones`,
    );
  }

  // ---------- Vistas ----------

  private renderWaiting(): void {
    const state = this.state;
    const present = this.channel?.presentPlayers() ?? [];
    const done = new Set(state ? this.roundScores().map((s) => s.player) : [this.me]);
    const players = state?.players ?? [this.me];

    const entries: WaitingEntry[] = players.map((player) => ({
      player,
      state: done.has(player) ? "done" : present.includes(player) ? "playing" : "offline",
    }));
    this.overlay.showWaiting(entries, this.me);
  }

  // ---------- Briefing (instrucciones antes de la ronda) ----------

  private readyPlayers(): Set<string> {
    return new Set(
      this.state!.ready.filter((r) => r.round_no === this.myRound).map((r) => r.player),
    );
  }

  private renderBriefing(): void {
    const state = this.state!;
    const present = this.channel?.presentPlayers() ?? [];
    const ready = this.readyPlayers();
    const players: BriefingPlayer[] = state.players.map((player) => ({
      player,
      ready: ready.has(player),
      present: present.includes(player) || player === this.me,
    }));

    this.overlay.showBriefing({
      roundNo: this.myRound,
      totalRounds: this.totalRounds(),
      gameTitle: this.gameTitle(this.gameId),
      instructions: games.find((g) => g.id === this.gameId)?.instructions ?? "",
      players,
      me: this.me,
      iAmReady: ready.has(this.me),
      onReady: () => void this.sendReady(),
      hostAction: this.isHost() ? { label: "Empezar ya", onClick: () => void this.forceBegin() } : null,
    });
  }

  private async sendReady(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const round = this.myRound;
    // Optimista: reflejar el OK al instante sin esperar la red.
    if (!state.ready.some((r) => r.round_no === round && r.player === this.me)) {
      state.ready.push({ round_no: round, player: this.me });
    }
    this.renderBriefing();
    const ok = await markReady(this.code, round, this.me);
    if (ok) this.channel?.ping();
    void this.refresh();
  }

  // ---------- Ranking en vivo ----------

  /** Combina puntajes ya reportados (DB), en vivo (broadcast) y presencia. */
  private buildLiveRows(): LiveRow[] {
    const state = this.state!;
    const direction = getScoring(this.gameId).direction;
    const done = new Map<string, number>();
    for (const s of this.roundScores()) done.set(s.player, s.score);
    const present = new Set(this.channel?.presentPlayers() ?? []);
    const now = Date.now();

    type Tmp = { player: string; score: number | null; state: "done" | "playing" | "offline" };
    const tmp: Tmp[] = state.players.map((player) => {
      if (done.has(player)) return { player, score: done.get(player)!, state: "done" };
      if (player === this.me && !this.reported) {
        return { player, score: this.hooks.getScore(), state: "playing" };
      }
      const live = this.liveScores.get(player);
      const fresh = live !== undefined && now - live.at < LIVE_STALE_MS;
      if (present.has(player) || fresh) {
        return { player, score: fresh ? live!.score : null, state: "playing" };
      }
      return { player, score: null, state: "offline" };
    });

    // Orden: con puntaje (por direction) > sin puntaje aun > desconectado.
    const tier = (t: Tmp): number => (t.state === "offline" ? 2 : t.score === null ? 1 : 0);
    tmp.sort((a, b) => {
      const ta = tier(a);
      const tb = tier(b);
      if (ta !== tb) return ta - tb;
      if (ta === 0) {
        const cmp = direction === "lower" ? a.score! - b.score! : b.score! - a.score!;
        if (cmp !== 0) return cmp;
      }
      return a.player < b.player ? -1 : a.player > b.player ? 1 : 0;
    });

    return tmp.map((t, i) => ({
      rank: i + 1,
      player: t.player,
      scoreText: t.score === null ? "-" : formatScore(this.gameId, t.score),
      state: t.state,
    }));
  }

  /** Panel-esquina en vivo (mientras juego). */
  private renderLiveBoard(): void {
    this.overlay.setLiveBoard(this.buildLiveRows(), this.me);
  }

  /** Elige la vista en vivo segun si ya termine (espera) o sigo jugando (panel). */
  private renderLive(): void {
    if (!this.state || this.navigating) return;
    if (this.state.room.status !== "playing" || this.selfManaged) return;
    if (this.reported) this.overlay.showLiveWaiting(this.buildLiveRows(), this.me);
    else this.renderLiveBoard();
  }

  private renderResults(): void {
    const state = this.state!;
    const room = state.room;
    const ranked = rankRound(this.gameId, state.players, this.roundScores());

    const rows = ranked.map((r) => ({
      rank: r.rank,
      player: r.player,
      scoreText:
        r.score === null
          ? "sin jugar"
          : formatScore(this.gameId, r.score) + (r.finished ? "" : " (parcial)"),
      points: r.points,
    }));

    const isLast = room.current_round >= this.totalRounds();
    const playlist = room.settings.playlist;

    let hostAction: { label: string; onClick: () => void } | null = null;
    let waitingText: string | null = "Esperando al anfitrion...";

    if (this.isHost()) {
      if (isLast) {
        hostAction = { label: "Ver resultados finales", onClick: () => void this.finish() };
      } else if (playlist) {
        hostAction = {
          label: "Siguiente juego",
          onClick: () => void this.startNextRound(playlist[room.current_round]),
        };
      } else {
        // Sin playlist: la votacion arranca sola tras una pausa para leer.
        waitingText = "La votacion arranca en unos segundos...";
        this.scheduleVote();
      }
    } else if (!isLast && !playlist) {
      waitingText = "La votacion arranca en unos segundos...";
    }

    this.overlay.showResults({
      roundNo: room.current_round,
      totalRounds: this.totalRounds(),
      gameTitle: this.gameTitle(this.gameId),
      rows,
      totals: computeTotals(state),
      me: this.me,
      hostAction,
      waitingText,
    });
  }

  private renderVoting(): void {
    const state = this.state!;
    const room = state.room;
    const optionIds = room.vote_options ?? [];
    const voteRound = room.current_round + 1;

    const votes = state.votes.filter(
      (v) => v.round_no === voteRound && optionIds.includes(v.game_id),
    );
    const counts: Record<string, number> = {};
    for (const v of votes) counts[v.game_id] = (counts[v.game_id] ?? 0) + 1;
    const myVote = votes.find((v) => v.player === this.me)?.game_id ?? null;

    this.overlay.showVoting({
      options: optionIds.map((id) => {
        const game = games.find((g) => g.id === id);
        return { id, title: game?.title ?? id, accent: game?.accent };
      }),
      counts,
      myVote,
      onVote: (id) => {
        void castVote(this.code, voteRound, this.me, id).then((ok) => {
          if (ok) this.channel?.ping();
          void this.refresh();
        });
      },
    });

    if (this.isHost()) {
      const voters = new Set(votes.map((v) => v.player));
      if (state.players.every((p) => voters.has(p))) void this.closeVoting();
    }
  }

  // ---------- Logica de host ----------

  private async hostAction(action: () => Promise<unknown>): Promise<void> {
    if (this.actionInFlight) return;
    this.actionInFlight = true;
    try {
      await action();
      this.channel?.ping();
      await this.refresh();
    } finally {
      this.actionInFlight = false;
    }
  }

  /** Cierra la ronda si todos reportaron, vencio el tope, o solo faltan ausentes. */
  private async maybeCloseRound(deadlinePassed = false): Promise<void> {
    const state = this.state;
    if (!state || state.room.status !== "playing") return;

    const done = new Set(this.roundScores().map((s) => s.player));
    const allReported = state.players.every((p) => done.has(p));

    let onlyAbsentMissing = false;
    if (!allReported) {
      const present = this.channel?.presentPlayers() ?? [];
      const presentAllDone = state.players
        .filter((p) => present.includes(p))
        .every((p) => done.has(p));
      const deadline = this.deadlineMs();
      const roundStart =
        deadline !== null
          ? deadline - (state.room.settings.roundTimeLimitSec + NAV_GRACE_SEC) * 1000
          : 0;
      // Gracia para que la presencia se estabilice tras la navegacion.
      onlyAbsentMissing =
        presentAllDone && done.has(this.me) && Date.now() - roundStart > CLOSE_EARLY_GRACE_MS;
    }

    if (!allReported && !deadlinePassed && !onlyAbsentMissing) return;
    await this.hostAction(() => closeRound(this.code));
  }

  private scheduleVote(): void {
    const round = this.state!.room.current_round;
    if (this.voteScheduledForRound === round) return;
    this.voteScheduledForRound = round;

    window.setTimeout(() => {
      void (async () => {
        // Revalidar contra la DB: pudo cambiar el host o la fase mientras tanto.
        const fresh = await fetchRoomState(this.code);
        if (!fresh || fresh.room.status !== "results" || fresh.room.host !== this.me) return;
        if (fresh.room.current_round !== round) return;
        this.state = fresh;
        const options = pickVoteOptions(fresh);
        const deadline = new Date(Date.now() + VOTE_SECONDS * 1000);
        await this.hostAction(() => openVote(this.code, options, deadline));
      })();
    }, RESULTS_TO_VOTE_MS);
  }

  private async closeVoting(): Promise<void> {
    const state = this.state;
    if (!state || state.room.status !== "voting" || this.actionInFlight) return;
    const options = state.room.vote_options ?? [];
    if (options.length === 0) return;

    const voteRound = state.room.current_round + 1;
    const counts = new Map<string, number>();
    for (const v of state.votes) {
      if (v.round_no === voteRound && options.includes(v.game_id)) {
        counts.set(v.game_id, (counts.get(v.game_id) ?? 0) + 1);
      }
    }
    const max = Math.max(0, ...counts.values());
    const top = max > 0 ? options.filter((id) => counts.get(id) === max) : options;
    const winner = top[Math.floor(Math.random() * top.length)];
    await this.startNextRound(winner);
  }

  private async startNextRound(gameId: string): Promise<void> {
    const state = this.state;
    if (!state) return;
    const roundNo = state.room.current_round + 1;
    // Juegos con arranque propio: directo a 'playing'. El resto: fase briefing.
    if (SELF_MANAGED.has(gameId)) {
      const deadline = computeRoundDeadline(state.room.settings.roundTimeLimitSec);
      await this.hostAction(() => startRound(this.code, roundNo, gameId, deadline));
    } else {
      await this.hostAction(() => startBriefing(this.code, roundNo, gameId, computeBriefingDeadline()));
    }
  }

  /**
   * Cierra el briefing cuando todos los presentes dieron OK, o al vencer el tope.
   * Solo el host. "Empezar ya" (forceBegin) fuerza el inicio sin esperar.
   */
  private async maybeBeginPlay(): Promise<void> {
    const state = this.state;
    if (!state || state.room.status !== "briefing") return;
    const ready = this.readyPlayers();
    const present = this.channel?.presentPlayers() ?? [];
    const presentAllReady = state.players.filter((p) => present.includes(p)).every((p) => ready.has(p));
    const anyPresentReady = present.some((p) => ready.has(p));
    const deadline = this.deadlineMs();
    const timedOut = deadline !== null && Date.now() >= deadline;
    if (!((presentAllReady && anyPresentReady) || timedOut)) return;
    await this.beginPlayNow();
  }

  private async beginPlayNow(): Promise<void> {
    const state = this.state;
    if (!state || state.room.status !== "briefing" || this.actionInFlight) return;
    const deadline = computeRoundDeadline(state.room.settings.roundTimeLimitSec);
    await this.hostAction(() => beginPlay(this.code, deadline));
  }

  private async forceBegin(): Promise<void> {
    await this.beginPlayNow();
  }

  private async finish(): Promise<void> {
    await this.hostAction(() => finishRoom(this.code));
  }

  // ---------- Migracion de host ----------

  private updateTakeover(): void {
    const state = this.state;
    if (!state || this.isHost()) {
      this.hostAbsentSince = null;
      return;
    }
    // Solo en fases estables: la presencia parpadea durante la navegacion.
    const stable =
      state.room.status === "briefing" ||
      state.room.status === "results" ||
      state.room.status === "voting" ||
      state.room.status === "finished" ||
      (state.room.status === "playing" && this.reported);
    const present = this.channel?.presentPlayers() ?? [];
    if (!stable || present.includes(state.room.host)) {
      this.hostAbsentSince = null;
      return;
    }
    if (this.hostAbsentSince === null) this.hostAbsentSince = Date.now();
    if (Date.now() - this.hostAbsentSince < HOST_ABSENT_MS) return;

    this.overlay.offerTakeover(() => {
      void takeOverHost(this.code, this.me).then((ok) => {
        if (ok) this.channel?.ping();
        void this.refresh();
      });
    });
  }
}

/** 3 juegos al azar que todavia no salieron (o los que queden; nunca vacio). */
export function pickVoteOptions(state: RoomState): string[] {
  const played = new Set(state.rounds.map((r) => r.game_id));
  let pool = games.map((g) => g.id).filter((id) => !played.has(id));
  if (pool.length === 0) pool = games.map((g) => g.id);

  const picked: string[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool[i]);
    pool.splice(i, 1);
  }
  return picked;
}

/** "1:43" a partir de milisegundos restantes (piso 0:00). */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
