/**
 * Overlay DOM autocontenido del modo sala (patron LeaderboardPanel: inyecta su
 * propio CSS una sola vez y no depende del estilo de cada juego). Es fixed
 * full-screen con z-index por encima del overlay de cada juego, asi tapa el
 * "presiona ENTER para reintentar" sin tocar ningun Hud.
 *
 * Vistas: briefing (instrucciones + checklist de "listos"), esperando con
 * ranking en vivo, resultados de ronda, votacion del proximo juego, tablero
 * final y error. Ademas un strip superior permanente con codigo / ronda /
 * tiempo, y un panel-esquina con el ranking en vivo mientras se juega.
 */

const STYLE_ID = "mg-room-styles";

const CSS = `
.mg-room-strip {
  position: fixed; top: 0; left: 50%; transform: translateX(-50%);
  z-index: 9999; padding: 0.3rem 1rem; border-radius: 0 0 10px 10px;
  background: rgba(10, 12, 24, 0.78); color: #fff;
  font-family: system-ui, sans-serif; font-size: 0.85rem; font-weight: 600;
  letter-spacing: 0.08em; font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35); pointer-events: none;
  white-space: nowrap;
}
.mg-room {
  position: fixed; inset: 0; z-index: 10000; display: flex;
  align-items: center; justify-content: center; padding: 1rem;
  background: rgba(8, 10, 20, 0.86); backdrop-filter: blur(6px);
  color: #fff; font-family: system-ui, sans-serif;
}
.mg-room__box { width: 100%; max-width: 420px; text-align: center; }
.mg-room__kicker { font-size: 0.8rem; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.6; margin-bottom: 0.4rem; }
.mg-room__title { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.35rem; }
.mg-room__subtitle { font-size: 0.95rem; opacity: 0.75; margin: 0 0 1rem; }
.mg-room__time { font-size: 1.1rem; font-weight: 700; font-variant-numeric: tabular-nums; margin-bottom: 1rem; opacity: 0.9; }
.mg-room__list { list-style: none; margin: 0 0 1.2rem; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.mg-room__row {
  display: grid; grid-template-columns: 2rem 1fr auto; align-items: center;
  gap: 0.5rem; padding: 0.42rem 0.7rem; border-radius: 9px;
  background: rgba(255, 255, 255, 0.06); font-size: 0.95rem; text-align: left;
}
.mg-room__row--me { background: rgba(255, 255, 255, 0.16); font-weight: 700; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3) inset; }
.mg-room__rank { opacity: 0.6; text-align: right; font-variant-numeric: tabular-nums; }
.mg-room__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mg-room__value { font-variant-numeric: tabular-nums; white-space: nowrap; }
.mg-room__value small { opacity: 0.6; font-size: 0.8em; margin-left: 0.35rem; }
.mg-room__state { font-size: 0.8rem; opacity: 0.7; }
.mg-room__state--done { color: #6dffa8; opacity: 1; }
.mg-room__state--offline { opacity: 0.4; }
.mg-room__section { font-size: 0.78rem; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.55; margin: 1.1rem 0 0.45rem; }
.mg-room__votes { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.mg-room__vote {
  --accent: #7dd8ff;
  display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;
  padding: 0.7rem 0.9rem; border-radius: 12px; cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.05);
  color: #fff; font: inherit; font-size: 1rem; font-weight: 700; text-align: left;
}
.mg-room__vote:hover { border-color: var(--accent); }
.mg-room__vote--mine { border-color: var(--accent); background: rgba(255, 255, 255, 0.12); box-shadow: 0 0 14px -4px var(--accent); }
.mg-room__vote-count { font-size: 0.85rem; opacity: 0.7; font-variant-numeric: tabular-nums; white-space: nowrap; }
.mg-room__btn {
  display: inline-block; padding: 0.6rem 1.4rem; border-radius: 999px;
  border: none; background: #fff; color: #111; font: inherit; font-size: 1rem;
  font-weight: 800; cursor: pointer; text-decoration: none;
}
.mg-room__btn:hover { opacity: 0.85; }
.mg-room__hint { font-size: 0.82rem; opacity: 0.55; margin-top: 0.8rem; }
.mg-room__winner { font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem; color: #ffd75e; }
.mg-room__takeover {
  display: block; margin: 1rem auto 0; padding: 0.5rem 1.1rem; border-radius: 999px;
  border: 1px solid rgba(255, 215, 94, 0.5); background: transparent; color: #ffd75e;
  font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer;
}
.mg-room__takeover:hover { background: rgba(255, 215, 94, 0.12); }
.mg-room__exit {
  display: block; margin-top: 1rem; font-size: 0.82rem; letter-spacing: 0.08em;
  color: #fff; opacity: 0.55; text-decoration: none;
}
.mg-room__exit:hover { opacity: 0.9; text-decoration: underline; }
.mg-room__instructions {
  font-size: 1rem; line-height: 1.5; opacity: 0.95; text-align: left;
  background: rgba(255, 255, 255, 0.06); border-radius: 12px;
  padding: 0.9rem 1rem; margin: 0 0 1.1rem;
}
.mg-room__ready { color: #6dffa8; }
.mg-room__value--pending { opacity: 0.55; }

/* Panel-esquina con el ranking en vivo mientras se juega. */
.mg-room-live {
  position: fixed; top: 44px; right: 10px; z-index: 9998;
  background: rgba(10, 12, 24, 0.72); color: #fff; border-radius: 10px;
  padding: 0.4rem 0.55rem; font-family: system-ui, sans-serif; font-size: 0.8rem;
  min-width: 128px; max-width: 44vw; pointer-events: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35); backdrop-filter: blur(4px);
}
.mg-room-live__title {
  font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase;
  opacity: 0.55; margin-bottom: 0.32rem;
}
.mg-room-live__row {
  display: grid; grid-template-columns: 1rem 1fr auto; gap: 0.4rem;
  align-items: center; padding: 0.12rem 0; font-variant-numeric: tabular-nums;
}
.mg-room-live__row--me { font-weight: 800; }
.mg-room-live__row--offline { opacity: 0.4; }
.mg-room-live__rank { opacity: 0.55; text-align: right; }
.mg-room-live__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mg-room-live__score { white-space: nowrap; }
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

export interface WaitingEntry {
  player: string;
  state: "done" | "playing" | "offline";
}

/** Fila del ranking en vivo (panel-esquina y pantalla de espera). */
export interface LiveRow {
  rank: number;
  player: string;
  /** Puntaje ya formateado, o "-" si todavia no puntuo. */
  scoreText: string;
  state: "done" | "playing" | "offline";
}

/** Jugador en la pantalla de instrucciones (fase briefing). */
export interface BriefingPlayer {
  player: string;
  ready: boolean;
  present: boolean;
}

export interface ResultEntry {
  rank: number;
  player: string;
  /** Puntaje ya formateado ("12", "213 ms", "sin jugar"). */
  scoreText: string;
  points: number;
}

export interface TotalEntry {
  rank: number;
  player: string;
  points: number;
}

export interface VoteOption {
  id: string;
  title: string;
  accent?: string;
}

const STATE_LABELS: Record<WaitingEntry["state"], string> = {
  done: "listo",
  playing: "jugando",
  offline: "desconectado",
};

export class RoomOverlay {
  private readonly root: HTMLDivElement;
  private readonly boxEl: HTMLDivElement;
  private readonly stripEl: HTMLDivElement;
  private readonly liveEl: HTMLDivElement;
  private timeEl: HTMLDivElement | null = null;
  private takeoverEl: HTMLButtonElement | null = null;

  constructor() {
    ensureStyles();

    this.stripEl = document.createElement("div");
    this.stripEl.className = "mg-room-strip";
    this.stripEl.style.display = "none";

    this.liveEl = document.createElement("div");
    this.liveEl.className = "mg-room-live";
    this.liveEl.style.display = "none";

    this.root = document.createElement("div");
    this.root.className = "mg-room";
    this.root.style.display = "none";
    // Que ningun toque/clic dentro del overlay llegue a los listeners de
    // "toca para reiniciar" que los juegos ponen en su contenedor.
    for (const type of ["pointerdown", "mousedown", "click", "touchstart"]) {
      this.root.addEventListener(type, (e) => e.stopPropagation());
    }

    this.boxEl = document.createElement("div");
    this.boxEl.className = "mg-room__box";
    this.root.append(this.boxEl);

    document.body.append(this.stripEl, this.liveEl, this.root);
  }

  /**
   * Ranking en vivo en el panel-esquina mientras se juega. null lo oculta.
   * Es solo lectura (pointer-events: none) para no molestar al juego debajo.
   */
  setLiveBoard(rows: LiveRow[] | null, me: string): void {
    if (!rows || rows.length === 0) {
      this.liveEl.style.display = "none";
      return;
    }
    this.liveEl.style.display = "";
    this.liveEl.innerHTML = "";

    const title = document.createElement("div");
    title.className = "mg-room-live__title";
    title.textContent = "En vivo";
    this.liveEl.append(title);

    for (const row of rows) {
      const el = document.createElement("div");
      el.className =
        "mg-room-live__row" +
        (row.player === me ? " mg-room-live__row--me" : "") +
        (row.state === "offline" ? " mg-room-live__row--offline" : "");

      const rank = document.createElement("span");
      rank.className = "mg-room-live__rank";
      rank.textContent = String(row.rank);

      const name = document.createElement("span");
      name.className = "mg-room-live__name";
      name.textContent = row.player;

      const score = document.createElement("span");
      score.className = "mg-room-live__score";
      score.textContent = row.scoreText;

      el.append(rank, name, score);
      this.liveEl.append(el);
    }
  }

  /** Strip superior con codigo / ronda / tiempo. null lo oculta. */
  setStrip(text: string | null): void {
    if (text === null) {
      this.stripEl.style.display = "none";
      return;
    }
    this.stripEl.style.display = "";
    this.stripEl.textContent = text;
  }

  /** Actualiza solo el countdown de la vista actual (esperando / votacion). */
  setTimeText(text: string | null): void {
    if (!this.timeEl) return;
    this.timeEl.textContent = text ?? "";
  }

  hide(): void {
    this.root.style.display = "none";
    this.timeEl = null;
  }

  private show(): void {
    // Cualquier vista modal tapa el panel-esquina: son mutuamente excluyentes.
    this.liveEl.style.display = "none";
    this.root.style.display = "";
    this.boxEl.innerHTML = "";
    this.timeEl = null;
    this.takeoverEl = null;
  }

  /**
   * Agrega (una sola vez por vista) el boton para tomar el control cuando el
   * host se desconecto. Idempotente: si ya esta en la vista actual, no hace nada.
   */
  offerTakeover(onClick: () => void): void {
    if (this.root.style.display === "none") return;
    if (this.takeoverEl && this.boxEl.contains(this.takeoverEl)) return;
    const btn = document.createElement("button");
    btn.className = "mg-room__takeover";
    btn.type = "button";
    btn.textContent = "El anfitrion se desconecto - tomar el control";
    btn.addEventListener("click", onClick);
    this.takeoverEl = btn;
    this.boxEl.append(btn);
  }

  private addKicker(text: string): void {
    const el = document.createElement("div");
    el.className = "mg-room__kicker";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private addTitle(text: string): void {
    const el = document.createElement("h2");
    el.className = "mg-room__title";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private addSubtitle(text: string): void {
    const el = document.createElement("p");
    el.className = "mg-room__subtitle";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private addTime(): void {
    this.timeEl = document.createElement("div");
    this.timeEl.className = "mg-room__time";
    this.boxEl.append(this.timeEl);
  }

  private addSection(text: string): void {
    const el = document.createElement("div");
    el.className = "mg-room__section";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private addButton(label: string, onClick: () => void): void {
    const btn = document.createElement("button");
    btn.className = "mg-room__btn";
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    this.boxEl.append(btn);
  }

  private addHint(text: string): void {
    const el = document.createElement("div");
    el.className = "mg-room__hint";
    el.textContent = text;
    this.boxEl.append(el);
  }

  private buildRow(
    left: string,
    name: string,
    right: HTMLElement | string,
    isMe: boolean,
  ): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "mg-room__row" + (isMe ? " mg-room__row--me" : "");

    const rankEl = document.createElement("span");
    rankEl.className = "mg-room__rank";
    rankEl.textContent = left;

    const nameEl = document.createElement("span");
    nameEl.className = "mg-room__name";
    nameEl.textContent = name;

    let rightEl: HTMLElement;
    if (typeof right === "string") {
      rightEl = document.createElement("span");
      rightEl.className = "mg-room__value";
      rightEl.textContent = right;
    } else {
      rightEl = right;
    }

    li.append(rankEl, nameEl, rightEl);
    return li;
  }

  private addTotals(totals: TotalEntry[], me: string): void {
    this.addSection("Tablero acumulado");
    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const row of totals) {
      list.append(this.buildRow(String(row.rank), row.player, `${row.points} pts`, row.player === me));
    }
    this.boxEl.append(list);
  }

  /** Pantalla "esperando a los demas" con checklist de jugadores. */
  showWaiting(entries: WaitingEntry[], me: string): void {
    this.show();
    this.addKicker("Sala");
    this.addTitle("Esperando a los demas...");
    this.addTime();

    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const e of entries) {
      const state = document.createElement("span");
      state.className = `mg-room__state mg-room__state--${e.state}`;
      state.textContent = STATE_LABELS[e.state];
      list.append(this.buildRow(e.state === "done" ? "OK" : "...", e.player, state, e.player === me));
    }
    this.boxEl.append(list);
  }

  /**
   * Pantalla de instrucciones antes de la ronda (fase briefing). Muestra el
   * como se juega, el checklist de quien dio OK y el countdown de auto-inicio.
   * El reloj de la ronda todavia no corre.
   */
  showBriefing(opts: {
    roundNo: number;
    totalRounds: number;
    gameTitle: string;
    instructions: string;
    players: BriefingPlayer[];
    me: string;
    iAmReady: boolean;
    onReady: () => void;
    /** Accion del host para forzar el inicio ("Empezar ya"), o null. */
    hostAction: { label: string; onClick: () => void } | null;
  }): void {
    this.show();
    this.addKicker(`Ronda ${opts.roundNo}/${opts.totalRounds}`);
    this.addTitle(opts.gameTitle);

    const instr = document.createElement("p");
    instr.className = "mg-room__instructions";
    instr.textContent = opts.instructions;
    this.boxEl.append(instr);

    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const p of opts.players) {
      const state = document.createElement("span");
      state.className = "mg-room__state" + (p.ready ? " mg-room__state--done" : p.present ? "" : " mg-room__state--offline");
      state.textContent = p.ready ? "listo" : p.present ? "leyendo..." : "desconectado";
      list.append(this.buildRow(p.ready ? "OK" : "...", p.player, state, p.player === opts.me));
    }
    this.boxEl.append(list);

    if (!opts.iAmReady) {
      this.addButton("Estoy listo", opts.onReady);
    } else {
      const ok = document.createElement("div");
      ok.className = "mg-room__hint mg-room__ready";
      ok.textContent = "Listo. Esperando a los demas...";
      this.boxEl.append(ok);
    }

    if (opts.hostAction) {
      const btn = document.createElement("button");
      btn.className = "mg-room__takeover";
      btn.type = "button";
      btn.textContent = opts.hostAction.label;
      btn.addEventListener("click", opts.hostAction.onClick);
      this.boxEl.append(btn);
    }

    this.addTime();
  }

  /**
   * Pantalla de espera con ranking en vivo: el jugador ya termino su ronda y
   * ve como van los demas en tiempo real (los que siguen jugando, los que ya
   * terminaron y los desconectados).
   */
  showLiveWaiting(rows: LiveRow[], me: string): void {
    this.show();
    this.addKicker("Sala");
    this.addTitle("Esperando a los demas...");
    this.addTime();

    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const row of rows) {
      const value = document.createElement("span");
      value.className = "mg-room__value" + (row.scoreText === "-" ? " mg-room__value--pending" : "");
      value.textContent = row.scoreText;
      const small = document.createElement("small");
      small.className = row.state === "done" ? "mg-room__ready" : "";
      small.textContent = row.state === "done" ? "listo" : row.state === "offline" ? "desconectado" : "jugando";
      value.append(small);
      list.append(this.buildRow(String(row.rank), row.player, value, row.player === me));
    }
    this.boxEl.append(list);
  }

  /** Resultados de la ronda + tablero acumulado. */
  showResults(opts: {
    roundNo: number;
    totalRounds: number;
    gameTitle: string;
    rows: ResultEntry[];
    totals: TotalEntry[];
    me: string;
    /** Accion del host ("Siguiente juego" / "Ver resultados finales"), o null. */
    hostAction: { label: string; onClick: () => void } | null;
    /** Texto de espera para los no-host (o mientras arranca la votacion). */
    waitingText: string | null;
  }): void {
    this.show();
    this.addKicker(`Ronda ${opts.roundNo}/${opts.totalRounds} - ${opts.gameTitle}`);
    this.addTitle("Resultados");

    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const row of opts.rows) {
      const value = document.createElement("span");
      value.className = "mg-room__value";
      value.textContent = `+${row.points}`;
      const small = document.createElement("small");
      small.textContent = row.scoreText;
      value.append(small);
      list.append(this.buildRow(String(row.rank), row.player, value, row.player === opts.me));
    }
    this.boxEl.append(list);

    this.addTotals(opts.totals, opts.me);

    if (opts.hostAction) {
      this.addButton(opts.hostAction.label, opts.hostAction.onClick);
    } else if (opts.waitingText) {
      this.addHint(opts.waitingText);
    }
  }

  /** Votacion del proximo juego. */
  showVoting(opts: {
    options: VoteOption[];
    /** Cantidad de votos por juego. */
    counts: Record<string, number>;
    myVote: string | null;
    onVote: (gameId: string) => void;
  }): void {
    this.show();
    this.addKicker("Votacion");
    this.addTitle("Elegi el proximo juego");
    this.addTime();

    const wrap = document.createElement("div");
    wrap.className = "mg-room__votes";
    for (const opt of opts.options) {
      const btn = document.createElement("button");
      btn.className = "mg-room__vote" + (opts.myVote === opt.id ? " mg-room__vote--mine" : "");
      btn.type = "button";
      if (opt.accent) btn.style.setProperty("--accent", opt.accent);

      const title = document.createElement("span");
      title.textContent = opt.title;

      const count = document.createElement("span");
      count.className = "mg-room__vote-count";
      const n = opts.counts[opt.id] ?? 0;
      count.textContent = n === 1 ? "1 voto" : `${n} votos`;

      btn.append(title, count);
      btn.addEventListener("click", () => opts.onVote(opt.id));
      wrap.append(btn);
    }
    this.boxEl.append(wrap);
    this.addHint("Gana la mayoria; empate se define al azar");
  }

  /** Tablero final con el ganador. El host puede iniciar otra partida. */
  showFinal(
    totals: TotalEntry[],
    me: string,
    opts: {
      /** Accion del host ("Jugar otra vez"), o null para los demas. */
      hostAction: { label: string; onClick: () => void } | null;
      /** Texto de espera para los no-host. */
      waitingText: string | null;
    } = { hostAction: null, waitingText: null },
  ): void {
    this.show();
    this.addKicker("Fin de la sala");
    this.addTitle("Resultados finales");

    const winners = totals.filter((t) => t.rank === 1).map((t) => t.player);
    const winnerEl = document.createElement("div");
    winnerEl.className = "mg-room__winner";
    winnerEl.textContent =
      winners.length === 1 ? `Ganador: ${winners[0]}` : `Empate: ${winners.join(", ")}`;
    this.boxEl.append(winnerEl);

    const list = document.createElement("ul");
    list.className = "mg-room__list";
    for (const row of totals) {
      list.append(this.buildRow(String(row.rank), row.player, `${row.points} pts`, row.player === me));
    }
    this.boxEl.append(list);

    if (opts.hostAction) this.addButton(opts.hostAction.label, opts.hostAction.onClick);
    else if (opts.waitingText) this.addHint(opts.waitingText);

    const exit = document.createElement("a");
    exit.className = "mg-room__exit";
    exit.href = "/";
    exit.textContent = "Salir al inicio";
    this.boxEl.append(exit);
  }

  /** Error terminal (sala inexistente, etc.). */
  showError(message: string): void {
    this.show();
    this.addKicker("Sala");
    this.addTitle("Ups");
    this.addSubtitle(message);
    this.addButton("Volver al inicio", () => {
      window.location.href = "/";
    });
  }
}
