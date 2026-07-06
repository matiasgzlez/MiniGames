/**
 * Estado de una sala a lo largo de su vida. "briefing" es la pantalla de
 * instrucciones previa a cada ronda: se muestra el como se juega, cada jugador
 * da OK y recien cuando estan todos (o el host fuerza / vence el tope) la sala
 * pasa a "playing" y arranca el reloj de la ronda.
 */
export type RoomStatus =
  | "lobby"
  | "briefing"
  | "playing"
  | "results"
  | "voting"
  | "finished";

/** Ajustes elegidos por el host al crear la sala. */
export interface RoomSettings {
  /** Cantidad total de rondas (si hay playlist, es playlist.length). */
  totalRounds: number;
  /** Lista explicita de juegos en orden, o null para votar despues de cada ronda. */
  playlist: string[] | null;
  /** Tope de tiempo por ronda, en segundos. */
  roundTimeLimitSec: number;
}

/** Fila de public.rooms tal como la devuelve Supabase. */
export interface RoomRow {
  code: string;
  host: string;
  status: RoomStatus;
  settings: RoomSettings;
  current_round: number;
  current_game: string | null;
  vote_options: string[] | null;
  /** timestamptz ISO del fin aproximado de la ronda o votacion en curso. */
  deadline: string | null;
  created_at: string;
}

/** Fila de public.room_rounds: que juego salio en cada ronda. */
export interface RoundRow {
  round_no: number;
  game_id: string;
}

/** Fila de public.room_round_scores. */
export interface RoundScoreRow {
  round_no: number;
  player: string;
  score: number;
  /** false = parcial reportado al vencer el tope de tiempo. */
  finished: boolean;
}

/** Fila de public.room_votes. */
export interface VoteRow {
  round_no: number;
  player: string;
  game_id: string;
}

/** Fila de public.room_ready: quien dio OK a las instrucciones de cada ronda. */
export interface ReadyRow {
  round_no: number;
  player: string;
}

/** Snapshot completo del estado durable de una sala. */
export interface RoomState {
  room: RoomRow;
  /** Nicknames registrados en la sala (room_players). */
  players: string[];
  rounds: RoundRow[];
  scores: RoundScoreRow[];
  votes: VoteRow[];
  /** Confirmaciones "estoy listo" de la fase briefing (room_ready). */
  ready: ReadyRow[];
}

/** Tope de seguridad del briefing: si alguien no da OK, arranca solo igual. */
export const BRIEFING_TIMEOUT_SEC = 30;

export const ROUND_TIME_LIMIT_OPTIONS = [60, 120, 180] as const;
export const DEFAULT_ROUND_TIME_LIMIT = 120;
export const DEFAULT_TOTAL_ROUNDS = 5;
export const TOTAL_ROUNDS_OPTIONS = [3, 5, 7] as const;
