/** Fisica del auto (unidades: px, segundos, radianes). */
export const ACCEL = 560;
export const BRAKE_DECEL = 900;
export const MAX_SPEED = 430;
export const MAX_REVERSE = 130;
/** Freno natural por rodadura (proporcional a la velocidad). */
export const DRAG = 0.6;
/** Velocidad de giro maxima, alcanzada a velocidad media. */
export const TURN_RATE = 2.9;
/** Velocidad a la que la direccion ya responde al 100%. */
export const TURN_FULL_SPEED = 150;
/** Multiplicadores fuera del asfalto (pasto). */
export const OFFTRACK_SPEED_FACTOR = 0.38;
export const OFFTRACK_DRAG = 3.2;

export const CAR_LENGTH = 36;
export const CAR_WIDTH = 19;

export const MAX_DT = 0.05;

/** Cadencia de envio de la posicion propia al resto de la sala. */
export const NET_SEND_MS = 100;
/** Un auto remoto sin updates por este tiempo se considera desconectado. */
export const REMOTE_STALE_MS = 6000;

export const BEST_KEY = "car-race:best";

/** Paleta de autos; cada jugador recibe un color estable por hash del nick. */
export const CAR_COLORS = [
  "#00f0ff",
  "#ff3f81",
  "#39ff14",
  "#ffd700",
  "#ff8a3d",
  "#a020f0",
  "#ff2a5f",
  "#5ce1a6",
];

/** Hash 32-bit deterministico (djb2) para seeds y colores por nick. */
export function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

export function colorFor(player: string): string {
  return CAR_COLORS[hashStr(player) % CAR_COLORS.length];
}

/** Formatea milisegundos de carrera como "1:02.34". */
export function formatRaceTime(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
