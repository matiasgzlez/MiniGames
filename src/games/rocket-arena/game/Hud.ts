import type { Difficulty, Team } from "./constants";

/**
 * Overlay DOM: marcador, reloj, medidor de boost, feed de quickchat,
 * pantalla de inicio (dificultad) y resultado.
 */
export class Hud {
  private readonly blueEl: HTMLSpanElement;
  private readonly orangeEl: HTMLSpanElement;
  private readonly timeEl: HTMLDivElement;
  private readonly overlayEl: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly subEl: HTMLDivElement;
  private readonly actionsEl: HTMLDivElement;
  private readonly flashEl: HTMLDivElement;
  private readonly countdownEl: HTMLDivElement;
  private readonly noteEl: HTMLDivElement;
  private readonly boostEl: HTMLDivElement;
  private readonly boostNumEl: HTMLDivElement;
  private readonly chatEl: HTMLDivElement;
  private overtime = false;

  constructor(container: HTMLElement) {
    const board = document.createElement("div");
    board.className = "scoreboard";
    this.blueEl = document.createElement("span");
    this.blueEl.className = "score-blue";
    this.blueEl.textContent = "0";
    this.orangeEl = document.createElement("span");
    this.orangeEl.className = "score-orange";
    this.orangeEl.textContent = "0";
    this.timeEl = document.createElement("div");
    this.timeEl.className = "score-time";
    this.timeEl.textContent = "2:00";
    const sep = document.createElement("span");
    sep.className = "score-sep";
    sep.textContent = "–";
    board.append(this.blueEl, sep, this.orangeEl);

    this.overlayEl = document.createElement("div");
    this.overlayEl.className = "overlay";
    this.titleEl = document.createElement("div");
    this.titleEl.className = "overlay__title";
    this.subEl = document.createElement("div");
    this.subEl.className = "overlay__subtitle";
    this.actionsEl = document.createElement("div");
    this.actionsEl.className = "overlay__actions";
    this.overlayEl.append(this.titleEl, this.subEl, this.actionsEl);

    this.flashEl = document.createElement("div");
    this.flashEl.className = "goal-flash";
    this.countdownEl = document.createElement("div");
    this.countdownEl.className = "countdown";

    this.noteEl = document.createElement("div");
    this.noteEl.className = "match-note";

    // Medidor de boost estilo RL: anillo + número, abajo al centro.
    this.boostEl = document.createElement("div");
    this.boostEl.className = "boost-meter";
    this.boostNumEl = document.createElement("div");
    this.boostNumEl.className = "boost-meter__num";
    this.boostNumEl.textContent = "33";
    const boostLabel = document.createElement("div");
    boostLabel.className = "boost-meter__label";
    boostLabel.textContent = "BOOST";
    this.boostEl.append(this.boostNumEl, boostLabel);

    // Feed de quickchat (modo sala).
    this.chatEl = document.createElement("div");
    this.chatEl.className = "chat-feed";

    // Ayuda de controles (solo desktop; se oculta por CSS en táctil).
    const hint = document.createElement("div");
    hint.className = "controls-hint";
    hint.innerHTML =
      "WASD manejar · Click turbo · Espacio saltar (en el aire, click = voltereta) · " +
      "Shift derrape · E cámara · en el aire: S trompa arriba + turbo = volar";

    container.append(
      board,
      this.timeEl,
      this.noteEl,
      this.boostEl,
      this.chatEl,
      hint,
      this.overlayEl,
      this.flashEl,
      this.countdownEl,
    );
  }

  /** Nota bajo el reloj (modo sala: "EQUIPO AZUL"; overtime: "GOL DE ORO"). */
  setMatchNote(text: string, team: "blue" | "orange"): void {
    this.noteEl.textContent = text;
    this.noteEl.className = `match-note is-shown ${team}`;
  }

  setScore(blue: number, orange: number): void {
    this.blueEl.textContent = String(blue);
    this.orangeEl.textContent = String(orange);
  }

  setTime(seconds: number): void {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const text = `${m}:${String(s % 60).padStart(2, "0")}`;
    this.timeEl.textContent = this.overtime ? `+${text}` : text;
  }

  /** Modo tiempo extra: el reloj cuenta para arriba con "+" y queda naranja. */
  setOvertime(on: boolean): void {
    this.overtime = on;
    this.timeEl.classList.toggle("is-overtime", on);
    if (on) {
      this.noteEl.textContent = "TIEMPO EXTRA · GOL DE ORO";
      this.noteEl.className = "match-note is-shown orange";
    }
  }

  setBoost(amount: number): void {
    const pct = Math.round(amount);
    this.boostNumEl.textContent = String(pct);
    this.boostEl.style.setProperty("--pct", String(pct));
    this.boostEl.classList.toggle("is-empty", pct <= 0);
  }

  /** Mensaje de quickchat en el feed; desaparece solo. */
  addChat(from: string, msg: string, team: "blue" | "orange"): void {
    const row = document.createElement("div");
    row.className = `chat-row ${team}`;
    const name = document.createElement("span");
    name.className = "chat-name";
    name.textContent = from;
    row.append(name, document.createTextNode(` ${msg}`));
    this.chatEl.prepend(row);
    while (this.chatEl.children.length > 4) this.chatEl.lastChild?.remove();
    window.setTimeout(() => row.remove(), 4500);
  }

  showCountdown(text: string | null): void {
    if (text === null) {
      this.countdownEl.classList.remove("is-shown");
      return;
    }
    if (this.countdownEl.textContent === text) return;
    this.countdownEl.textContent = text;
    this.countdownEl.classList.remove("is-shown");
    void this.countdownEl.offsetWidth;
    this.countdownEl.classList.add("is-shown");
  }

  showGoal(team: "blue" | "orange"): void {
    this.flash(team === "blue" ? "¡GOL!" : "GOL RIVAL", team);
  }

  showDemolished(): void {
    this.flash("¡DEMOLIDO!", "orange");
  }

  private flash(text: string, team: "blue" | "orange"): void {
    this.flashEl.textContent = text;
    this.flashEl.className = `goal-flash is-shown ${team}`;
    void this.flashEl.offsetWidth;
    window.setTimeout(() => this.flashEl.classList.remove("is-shown"), 1600);
  }

  private pickButtons: { blue: HTMLButtonElement; orange: HTMLButtonElement } | null = null;
  private pickRosters: { blue: HTMLDivElement; orange: HTMLDivElement } | null = null;

  /** Fase de armado en salas: dos botones de equipo con sus listas. */
  showTeamPick(onPick: (t: Team) => void): void {
    this.titleEl.textContent = "ELEGÍ EQUIPO";
    this.subEl.textContent = "";
    this.actionsEl.replaceChildren();

    const mk = (team: Team, label: string): [HTMLButtonElement, HTMLDivElement] => {
      const btn = document.createElement("button");
      btn.className = `team-btn ${team}`;
      const head = document.createElement("div");
      head.className = "team-btn__label";
      head.textContent = label;
      const roster = document.createElement("div");
      roster.className = "team-btn__roster";
      btn.append(head, roster);
      btn.addEventListener("click", () => onPick(team));
      return [btn, roster];
    };

    const [blueBtn, blueRoster] = mk("blue", "AZUL");
    const [orangeBtn, orangeRoster] = mk("orange", "NARANJA");
    this.pickButtons = { blue: blueBtn, orange: orangeBtn };
    this.pickRosters = { blue: blueRoster, orange: orangeRoster };
    this.actionsEl.append(blueBtn, orangeBtn);
    this.overlayEl.classList.remove("hidden");
  }

  /** Refresca listas, selección propia y el reloj de la fase de armado. */
  updateTeamPick(
    players: string[],
    picks: Map<string, Team>,
    me: string,
    seconds: number,
  ): void {
    if (!this.pickButtons || !this.pickRosters) return;
    for (const team of ["blue", "orange"] as const) {
      const names = players.filter((p) => picks.get(p) === team);
      this.pickRosters[team].replaceChildren(
        ...names.map((n) => {
          const row = document.createElement("div");
          row.textContent = n === me ? `${n} (vos)` : n;
          return row;
        }),
      );
      this.pickButtons[team].classList.toggle("is-picked", picks.get(me) === team);
    }
    const missing = players.filter((p) => !picks.has(p)).length;
    const wait = missing > 0 ? ` · faltan ${missing}` : "";
    this.subEl.textContent = `El partido arranca en ${Math.max(0, Math.ceil(seconds))}s${wait}`;
  }

  showStart(onStart: (d: Difficulty) => void): void {
    this.titleEl.textContent = "ROCKET SPACEX";
    this.subEl.textContent = "Elegí la dificultad de los bots (2v2 con un compañero)";
    this.actionsEl.replaceChildren();
    const labels: Array<[Difficulty, string]> = [
      ["easy", "Fácil"],
      ["medium", "Medio"],
      ["hard", "Difícil"],
    ];
    for (const [d, label] of labels) {
      const b = document.createElement("button");
      b.className = `overlay__btn diff-${d}`;
      b.textContent = label;
      b.addEventListener("click", () => onStart(d));
      this.actionsEl.append(b);
    }
    this.overlayEl.classList.remove("hidden");
  }

  /** Resultado desde la perspectiva del jugador (mine vs theirs). */
  showResult(mine: number, theirs: number, onRematch: (() => void) | null): void {
    const win = mine > theirs ? "¡GANASTE!" : mine < theirs ? "PERDISTE" : "EMPATE";
    this.titleEl.textContent = win;
    this.subEl.textContent = `${mine} – ${theirs}`;
    this.actionsEl.replaceChildren();
    if (onRematch) {
      const b = document.createElement("button");
      b.className = "overlay__btn diff-medium";
      b.textContent = "Revancha";
      b.addEventListener("click", onRematch);
      this.actionsEl.append(b);
    }
    this.overlayEl.classList.remove("hidden");
  }

  hide(): void {
    this.overlayEl.classList.add("hidden");
  }
}
