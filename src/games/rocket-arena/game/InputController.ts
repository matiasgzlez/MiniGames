import type { CarInput } from "./Car";

/** Teclado + botones táctiles para el auto del jugador. */
export class InputController {
  private readonly keys = new Set<string>();
  private readonly touch = { throttle: 0, steer: 0, boost: false, jump: false, drift: false };
  /** Click izquierdo sostenido: turbo. En el aire, el flanco dispara la voltereta. */
  private mouseHeld = false;
  /** Toggle de ball cam pendiente de consumir (tecla E o botón CAM). */
  private camQueued = false;
  /** Quickchat pendiente (teclas 1-4 → índice 0-3). */
  private chatQueued = -1;

  constructor(container: HTMLElement) {
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    // Turbo con el mouse: solo clicks sobre el canvas (no sobre botones/HUD).
    container.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if ((e.target as HTMLElement).tagName !== "CANVAS") return;
      this.mouseHeld = true;
    });
    window.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse" && e.button === 0) this.mouseHeld = false;
    });
    window.addEventListener("pointercancel", () => (this.mouseHeld = false));
    window.addEventListener("blur", () => (this.mouseHeld = false));
    this.buildTouch(container);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const down = e.type === "keydown";
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (down) this.keys.add(k);
    else this.keys.delete(k);

    if (down && k === "e") this.camQueued = true;
    if (down && k >= "1" && k <= "4") this.chatQueued = Number(k) - 1;
  };

  getInput(): CarInput {
    let throttle = this.touch.throttle;
    let steer = this.touch.steer;
    if (this.keys.has("w") || this.keys.has("ArrowUp")) throttle = 1;
    if (this.keys.has("s") || this.keys.has("ArrowDown")) throttle = -1;
    if (this.keys.has("a") || this.keys.has("ArrowLeft")) steer = -1;
    if (this.keys.has("d") || this.keys.has("ArrowRight")) steer = 1;
    const boost = this.touch.boost || this.mouseHeld;
    const jump = this.touch.jump || this.keys.has(" ");
    const drift = this.touch.drift || this.keys.has("Shift");
    return { throttle, steer, boost, jump, drift, flip: this.mouseHeld };
  }

  /** True una sola vez por pulsación de la tecla de cámara. */
  consumeCamToggle(): boolean {
    const q = this.camQueued;
    this.camQueued = false;
    return q;
  }

  /** Índice 0-3 del quickchat pedido, o -1. Se consume al leer. */
  consumeChat(): number {
    const q = this.chatQueued;
    this.chatQueued = -1;
    return q;
  }

  private buildTouch(container: HTMLElement): void {
    const pad = document.createElement("div");
    pad.className = "touch-pad";

    const mk = (label: string, cls: string, on: (v: boolean) => void): HTMLButtonElement => {
      const b = document.createElement("button");
      b.className = `touch-btn ${cls}`;
      b.textContent = label;
      const set = (v: boolean) => (e: PointerEvent) => {
        e.preventDefault();
        on(v);
        b.classList.toggle("is-active", v);
      };
      b.addEventListener("pointerdown", set(true));
      b.addEventListener("pointerup", set(false));
      b.addEventListener("pointerleave", set(false));
      b.addEventListener("pointercancel", set(false));
      return b;
    };

    const left = document.createElement("div");
    left.className = "touch-cluster touch-left";
    left.append(
      mk("◀", "", (v) => (this.touch.steer = v ? -1 : 0)),
      mk("▶", "", (v) => (this.touch.steer = v ? 1 : 0)),
      mk("DRIFT", "touch-drift", (v) => (this.touch.drift = v)),
    );

    const right = document.createElement("div");
    right.className = "touch-cluster touch-right";
    right.append(
      mk("BOOST", "touch-boost", (v) => (this.touch.boost = v)),
      mk("REV", "", (v) => (this.touch.throttle = v ? -1 : 0)),
      mk("GAS", "touch-gas", (v) => (this.touch.throttle = v ? 1 : 0)),
      mk("SALTO", "", (v) => (this.touch.jump = v)),
    );

    // Botón de cámara: es un toggle, alcanza con el flanco de bajada.
    const cam = document.createElement("button");
    cam.className = "touch-btn touch-cam";
    cam.textContent = "CAM";
    cam.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.camQueued = true;
    });

    pad.append(left, right, cam);
    container.append(pad);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
  }
}
