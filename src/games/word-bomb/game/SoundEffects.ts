let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

function blip(
  type: OscillatorType,
  freq: number,
  dur: number,
  peak: number,
  slideTo?: number,
): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.start(now);
  osc.stop(now + dur);
}

/** Efectos sintetizados con Web Audio (sin assets), en clave "prensa de papel". */
export class SoundEffects {
  /** Countdown tick (3 / 2 / 1 / YA) — mismo blip que el resto del repo. */
  static playCountdownTick(): void {
    blip("sine", 750, 0.05, 0.08);
  }

  /** Palabra aceptada: un "sello" seco y satisfactorio. */
  static playAccept(): void {
    blip("triangle", 320, 0.09, 0.14);
    blip("sine", 640, 0.12, 0.06);
  }

  /** Palabra rechazada: un zumbido corto y opaco. */
  static playReject(): void {
    blip("sawtooth", 150, 0.16, 0.1, 90);
  }

  /** La mecha exploto en el turno de alguien: golpe seco. */
  static playExplode(): void {
    blip("square", 110, 0.28, 0.16, 55);
  }

  /** Paso de turno: un tic breve. */
  static playTurn(): void {
    blip("sine", 520, 0.05, 0.05);
  }

  /** Fin de la partida (ganaste). */
  static playWin(): void {
    blip("triangle", 523.25, 0.14, 0.12);
    blip("triangle", 659.25, 0.18, 0.1);
  }

  /** Fin de la partida (perdiste / eliminado). */
  static playLose(): void {
    blip("sawtooth", 220, 0.3, 0.1, 110);
  }
}
