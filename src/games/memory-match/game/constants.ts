export const BEST_KEY = "memory_match_best";
export const COUNTDOWN_LABELS = ["3", "2", "1", "YA!"];
export const COUNTDOWN_STEP = 0.8; // seconds per label
export const MAX_DT = 0.1; // clamp delta time to avoid large jumps

/** Duracion del contrarreloj del modo solo, en segundos. */
export const SOLO_TIME_LIMIT = 60;

/** Cuanto quedan visibles dos cartas que no eran par antes de voltearse. */
export const REVEAL_HOLD_MS = 900;

/** Inactividad del jugador de turno antes de que el host lo saltee (sala). */
export const AFK_SKIP_MS = 20000;

/** Poll de respaldo del estado compartido (ademas del broadcast "sync"). */
export const MATCH_POLL_MS = 5000;
