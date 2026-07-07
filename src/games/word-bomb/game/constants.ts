/** Etiquetas y paso del countdown 3/2/1/YA compartido con todo el repo. */
export const COUNTDOWN_LABELS = ["3", "2", "1", "YA"] as const;
export const COUNTDOWN_STEP = 700;

/**
 * URL del game server autoritativo (socket.io). Sin esta env el juego no puede
 * funcionar: Bomba Palabra depende del server para validar palabras (diccionario
 * server-side) y arbitrar la mecha. A diferencia del resto del repo, no degrada a
 * un modo local; sin server muestra "no disponible". Es una excepcion deliberada
 * a la regla de degradacion (documentada en el CLAUDE.md del juego).
 */
export const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL as string | undefined;

/** Paleta "Prensa de papel" (ver DESIGN.md). Hardcodeada, familia de la landing. */
export const COLORS = {
  paper: "#f4ecd8",
  ink: "#1c1a17",
  inkSoft: "#6b6455",
  stamp: "#c0392b",
  word: "#2e7d5b",
} as const;

/** Umbral (fraccion de mecha restante) a partir del cual la regla de tiempo vira al rojo. */
export const FUSE_DANGER_FRACTION = 0.28;
