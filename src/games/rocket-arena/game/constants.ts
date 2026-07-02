/**
 * Dimensiones y tuning del arena. Todo en unidades de mundo (metros aprox).
 * Eje X = largo de la cancha (arcos en ±FIELD_LEN/2). Eje Z = ancho.
 * El equipo azul (jugador) defiende -X y ataca +X; el naranja al revés.
 * Proporciones estilo Rocket League: cancha 1.3:1 con esquinas ochavadas.
 */

// Cancha
export const FIELD_LEN = 260;
export const FIELD_WID = 200;
export const WALL_H = 30;
export const WALL_T = 1;
/** Chaflán de las esquinas (estilo RL: la pelota nunca muere en un rincón). */
export const CORNER_CUT = 40;
/** Alto y ancho de las faldas inclinadas al pie de las paredes. */
export const SKIRT_H = 3;

// Arco: hueco en la pared de fondo (ancho en Z, alto en Y) y profundidad de la red.
export const GOAL_W = 44;
export const GOAL_H = 16;
export const GOAL_DEPTH = 14;

/** Línea de gol de cada lado (centro del auto/pelota debe cruzarla). */
export const GOAL_LINE = FIELD_LEN / 2;

// Auto (semi-ejes: ancho X, alto Y, largo Z; forward local = +Z)
export const CAR_HALF = { x: 1, y: 0.5, z: 2 } as const;
export const CAR_MAX_SPEED = 34;
export const CAR_BOOST_SPEED = 52;
/** Velocidad a partir de la cual el auto es "supersónico" (estela + demolición). */
export const CAR_SUPERSONIC = 47;
export const CAR_REVERSE_SPEED = 18;
export const CAR_ACCEL = 60;
export const CAR_STEER_RATE = 2.7;
/** Fracción de velocidad lateral que se conserva por frame (agarre). */
export const CAR_GRIP = 0.8;
/** Agarre durante el derrape: casi no se corrige el lateral (patina). */
export const DRIFT_GRIP = 0.97;
/** Multiplicador de giro durante el derrape. */
export const DRIFT_STEER = 1.45;
export const CAR_JUMP_SPEED = 13;
export const CAR_DOUBLE_JUMP_SPEED = 11;
export const CAR_DENSITY = 1;
/** Fracción de la autoridad de control (accel/giro) que queda en el aire. */
export const AIR_CONTROL = 0.25;
/** Control de actitud en el aire (rad/s): pitch con W/S, yaw con A/D. */
export const AIR_PITCH_RATE = 3.0;
export const AIR_YAW_RATE = 2.4;
export const AIR_PITCH_MAX = 1.35;
/** Aceleración del boost en el aire, en la dirección de la trompa (aéreos). */
export const AIR_BOOST_ACCEL = 46;

// Dodge (voltereta): segundo salto + dirección = tirón de velocidad y golpe fuerte.
export const DODGE_IMPULSE = 18;
/** Duración de la animación de voltereta (y ventana de golpe fuerte al inicio). */
export const DODGE_TIME = 0.6;
export const DODGE_KICK_MULT = 1.9;
/** Ventana tras el primer salto para gastar el segundo (RL: 1.25 + salto). */
export const JUMP_WINDOW = 1.4;

// Boost como recurso (medidor 0-100, se recarga con pads).
export const BOOST_MAX = 100;
/** Boost inicial en cada kickoff (RL: 33). */
export const BOOST_START = 33;
/** Consumo por segundo mientras se mantiene el turbo (RL: ~33/s). */
export const BOOST_DRAIN = 33;
export const PAD_SMALL_AMOUNT = 12;
export const PAD_SMALL_RESPAWN = 4;
export const PAD_BIG_RESPAWN = 10;
export const PAD_SMALL_RADIUS = 3;
export const PAD_BIG_RADIUS = 4.5;

// Demolición: contacto supersónico contra un rival lo destruye.
export const DEMO_SPEED = CAR_SUPERSONIC;
export const DEMO_DIST = 3.6;
export const DEMO_RESPAWN = 3;

// Golpe a la pelota: impulso extra al contacto para que los tiros tengan fuerza.
export const KICK_RANGE = 0.6; // margen sobre la distancia de contacto
export const KICK_SPEED_MIN = 6; // velocidad mínima del auto para "patear"
export const KICK_FACTOR = 0.55; // impulso ∝ velocidad del auto
export const KICK_UP = 0.3; // componente vertical mínima del tiro
export const KICK_COOLDOWN = 0.25; // s entre golpes del mismo auto

// Pelota (más grande, estilo RL: ~1.2 largos de auto de diámetro)
export const BALL_R = 2.4;
export const BALL_DENSITY = 0.12;
export const BALL_RESTITUTION = 0.7;
export const BALL_LINEAR_DAMPING = 0.35;
export const BALL_ANGULAR_DAMPING = 0.6;

// Física global
export const GRAVITY = -30;
/** Paso fijo de simulación; el bucle acumula dt real y da varios pasos. */
export const FIXED_STEP = 1 / 60;

// Colores por equipo
export const BLUE = 0x3ba7ff;
export const ORANGE = 0xff8a3d;

export const BEST_KEY = "rocket-arena-best";

// Red (modo sala)
/** Cadencia de envío del auto propio y (en el host) pelota y bots. */
export const NET_SEND_MS = 80;
/** Un auto remoto sin updates por este tiempo se considera desconectado. */
export const REMOTE_STALE_MS = 6000;
/** Error de posición de la pelota que fuerza teleport en vez de corrección. */
export const BALL_SNAP_ERR = 4;
/** Distancia a partir de la cual un auto remoto se teletransporta al snapshot. */
export const REMOTE_SNAP_DIST = 30;

// Quickchat (modo sala): teclas 1-4.
export const QUICKCHAT: string[] = ["¡Golazo!", "¡Qué atajada!", "¡Perdón!", "¡Wow!"];

export type Team = "blue" | "orange";
/** Lado que ataca cada equipo: azul patea hacia +X, naranja hacia -X. */
export const ATTACK_X: Record<Team, number> = { blue: 1, orange: -1 };

export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultyParams {
  /** Multiplicador de velocidad máxima del bot. */
  speed: number;
  /** Usa boost al ir hacia la pelota. */
  boost: boolean;
  /** Segundos que "predice" el movimiento de la pelota. */
  lead: number;
  /** Ruido angular al apuntar (radianes); más = peor puntería. */
  aimError: number;
  /** Retraso de reacción a cambios de la pelota (s). */
  reaction: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyParams> = {
  easy: { speed: 0.6, boost: false, lead: 0.0, aimError: 0.45, reaction: 0.35 },
  medium: { speed: 0.85, boost: true, lead: 0.25, aimError: 0.18, reaction: 0.15 },
  hard: { speed: 1.0, boost: true, lead: 0.45, aimError: 0.05, reaction: 0.05 },
};
