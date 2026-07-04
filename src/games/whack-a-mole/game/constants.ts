// ── Canvas ──────────────────────────────────────────────────────────
export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 560;
export const MAX_DT = 0.1;

// ── Grid de agujeros ────────────────────────────────────────────────
export const COLS = 3;
export const ROWS = 3;
export const HOLE_RX = 95;
export const HOLE_RY = 34;

// ── Ronda a tiempo ──────────────────────────────────────────────────
/**
 * Tanto en solo como en salas la partida es a tiempo: dura este tanto y gana
 * quien mas puntos hizo. En salas el host puede fijar un tope de ronda menor
 * que corta el parcial antes (ver CLAUDE.md).
 */
export const ROUND_SEC = 60;

// ── Countdown (obligatorio, ver root CLAUDE.md) ─────────────────────
export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"];
export const COUNTDOWN_STEP = 0.75;

// ── Topos ───────────────────────────────────────────────────────────
export type MoleType = "normal" | "golden" | "bomb";

export const MOLE_RADIUS = 56;
/** Cuanto asoma el topo por encima del nivel del agujero. */
export const EMERGE_HEIGHT = 84;
/** Tiempo que tarda en subir / bajar. */
export const RISE_TIME = 0.14;
export const FALL_TIME = 0.12;

export const NORMAL_POINTS = 10;
export const GOLDEN_POINTS = 25;
/** Golpear una bomba resta este tanto (el puntaje nunca baja de 0). */
export const BOMB_PENALTY = 15;
/** Martillazo al vacio (sin topo): resta este tanto (el puntaje nunca baja de 0). */
export const MISS_PENALTY = 3;

/** Probabilidad de cada tipo al aparecer (el resto es normal). */
export const GOLDEN_CHANCE = 0.12;
export const BOMB_CHANCE = 0.18;

// ── Dificultad ──────────────────────────────────────────────────────
/** Segundos en los que la dificultad sube de base a maxima. */
export const RAMP_SEC = 45;
/** Intervalo entre apariciones (segundos): base -> minimo. */
export const SPAWN_INTERVAL_BASE = 0.9;
export const SPAWN_INTERVAL_MIN = 0.35;
/** Cuanto se queda arriba un topo (segundos): base -> minimo. */
export const HOLD_DURATION_BASE = 1.1;
export const HOLD_DURATION_MIN = 0.55;

// ── Scoring ─────────────────────────────────────────────────────────
export const BEST_KEY = "whack-a-mole-best";

// ── Sonido ──────────────────────────────────────────────────────────
export const SOUND_VOLUME = 0.35;
