import { FUSE_DANGER_FRACTION } from "./constants";

export interface HudPlayer {
  nickname: string;
  lives: number;
  alive: boolean;
  connected: boolean;
  isTurn: boolean;
  isMe: boolean;
}

export interface PlayView {
  players: HudPlayer[];
  fragment: string | null;
  statusText: string;
  myTurn: boolean;
  usedCount: number;
}

/**
 * DOM de Bomba Palabra (estetica "prensa de papel": papel crema, tinta, pastillas
 * y una regla de tiempo, ver DESIGN.md). Renderiza la escena en-juego (fila de
 * jugadores con vidas, tarjeta del fragmento, mecha y el input). Los estados de
 * espera / resultados / tablero final los cubre el `RoomOverlay` compartido por
 * encima.
 */
export class Hud {
  private readonly stage: HTMLDivElement;
  private readonly playersEl: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;
  private readonly fragmentEl: HTMLDivElement;
  private readonly fuseFill: HTMLDivElement;
  private readonly form: HTMLFormElement;
  private readonly input: HTMLInputElement;
  private readonly typingEl: HTMLDivElement;
  private readonly usedEl: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly countdownEl: HTMLDivElement;

  private fuseRaf = 0;
  private submitCb: (word: string) => void = () => {};
  private typeCb: (text: string) => void = () => {};

  constructor(root: HTMLElement) {
    root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "wb";
    wrap.innerHTML = `
      <div class="wb__stage" hidden>
        <div class="wb__players"></div>
        <div class="wb__center">
          <div class="wb__status"></div>
          <div class="wb__fragment"></div>
          <div class="wb__fuse"><div class="wb__fuse-fill"></div></div>
          <form class="wb__form" autocomplete="off">
            <input class="wb__input" type="text" inputmode="text" autocapitalize="off"
                   autocomplete="off" spellcheck="false" maxlength="32"
                   placeholder="escribi una palabra..." />
          </form>
          <div class="wb__typing"></div>
          <div class="wb__used"></div>
        </div>
      </div>
      <div class="wb__overlay"></div>
      <div class="wb__countdown" hidden></div>
    `;
    root.appendChild(wrap);

    this.stage = wrap.querySelector(".wb__stage")!;
    this.playersEl = wrap.querySelector(".wb__players")!;
    this.statusEl = wrap.querySelector(".wb__status")!;
    this.fragmentEl = wrap.querySelector(".wb__fragment")!;
    this.fuseFill = wrap.querySelector(".wb__fuse-fill")!;
    this.form = wrap.querySelector(".wb__form")!;
    this.input = wrap.querySelector(".wb__input")!;
    this.typingEl = wrap.querySelector(".wb__typing")!;
    this.usedEl = wrap.querySelector(".wb__used")!;
    this.overlay = wrap.querySelector(".wb__overlay")!;
    this.countdownEl = wrap.querySelector(".wb__countdown")!;

    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const word = this.input.value.trim();
      if (word) this.submitCb(word);
    });
    this.input.addEventListener("input", () => this.typeCb(this.input.value));
  }

  onSubmit(cb: (word: string) => void): void {
    this.submitCb = cb;
  }
  onType(cb: (text: string) => void): void {
    this.typeCb = cb;
  }

  // ---------- Mensajes / countdown ----------

  /** Cartel a pantalla (start, requiere sala, no disponible). `bodyHtml` es HTML. */
  showMessage(title: string, bodyHtml: string, action?: { label: string; onClick: () => void }): void {
    this.stage.hidden = true;
    this.overlay.hidden = false;
    this.overlay.innerHTML = `
      <div class="wb__card">
        <h1 class="wb__title">${title}</h1>
        <div class="wb__body">${bodyHtml}</div>
        ${action ? `<button class="wb__btn" type="button">${action.label}</button>` : ""}
      </div>
    `;
    if (action) {
      this.overlay.querySelector<HTMLButtonElement>(".wb__btn")!.addEventListener(
        "click",
        action.onClick,
      );
    }
  }

  hideMessage(): void {
    this.overlay.hidden = true;
    this.overlay.innerHTML = "";
  }

  showCountdown(text: string | null): void {
    if (text === null) {
      this.countdownEl.hidden = true;
      return;
    }
    this.countdownEl.hidden = false;
    this.countdownEl.textContent = text;
    this.countdownEl.classList.remove("is-pop");
    // reflow para reiniciar la animacion
    void this.countdownEl.offsetWidth;
    this.countdownEl.classList.add("is-pop");
  }

  // ---------- Escena en-juego ----------

  showStage(): void {
    this.hideMessage();
    this.stage.hidden = false;
  }

  render(view: PlayView): void {
    this.playersEl.innerHTML = "";
    for (const p of view.players) {
      const el = document.createElement("div");
      el.className = "wb__player";
      if (p.isTurn) el.classList.add("is-turn");
      if (p.isMe) el.classList.add("is-me");
      if (!p.alive) el.classList.add("is-out");
      if (!p.connected) el.classList.add("is-off");
      const lives = Array.from({ length: 3 }, (_, i) =>
        `<span class="wb__life${i < p.lives ? "" : " is-lost"}"></span>`,
      ).join("");
      el.innerHTML = `<span class="wb__pname">${escapeHtml(p.nickname)}</span><span class="wb__lives">${lives}</span>`;
      this.playersEl.appendChild(el);
    }

    this.statusEl.textContent = view.statusText;
    this.statusEl.classList.toggle("is-mine", view.myTurn);
    this.fragmentEl.textContent = view.fragment ? view.fragment.toUpperCase() : "";
    this.usedEl.textContent = view.usedCount > 0 ? `${view.usedCount} palabras` : "";

    this.setInputEnabled(view.myTurn);
    if (!view.myTurn) this.typingEl.textContent = "";
  }

  setInputEnabled(on: boolean): void {
    this.input.disabled = !on;
    if (on) {
      this.input.focus();
    } else {
      this.input.value = "";
    }
  }

  clearInput(): void {
    this.input.value = "";
  }

  focusInput(): void {
    if (!this.input.disabled) this.input.focus();
  }

  /** Muestra lo que el jugador de turno (otro) esta tecleando. */
  showTyping(player: string, text: string): void {
    this.typingEl.textContent = text ? `${player}: ${text}` : "";
  }

  /** Rechazo: sacude el input y muestra el motivo brevemente. */
  flashReject(message: string): void {
    this.input.classList.remove("is-reject");
    void this.input.offsetWidth;
    this.input.classList.add("is-reject");
    this.typingEl.textContent = message;
    this.typingEl.classList.add("is-reject");
    window.setTimeout(() => this.typingEl.classList.remove("is-reject"), 900);
  }

  /** Resalta una palabra aceptada al centro por un instante. */
  flashAccept(word: string): void {
    this.typingEl.textContent = word;
    this.typingEl.classList.remove("is-reject");
    this.typingEl.classList.add("is-accept");
    window.setTimeout(() => this.typingEl.classList.remove("is-accept"), 700);
  }

  // ---------- Mecha ----------

  /** Anima la regla de tiempo hasta `deadline` (epoch ms), sabiendo su `total`. */
  startFuse(deadline: number, total: number): void {
    this.stopFuse();
    const tick = () => {
      const remaining = deadline - Date.now();
      const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
      this.fuseFill.style.transform = `scaleX(${frac})`;
      this.fuseFill.classList.toggle("is-danger", frac <= FUSE_DANGER_FRACTION);
      if (remaining > 0) this.fuseRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  stopFuse(): void {
    if (this.fuseRaf) cancelAnimationFrame(this.fuseRaf);
    this.fuseRaf = 0;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
