/**
 * Contrato de mensajes socket.io de Bomba Palabra (namespace `/wordbomb`).
 *
 * El server es autoritativo: mantiene el turno, la mecha (deadline absoluto),
 * las vidas y el set de palabras usadas, y valida cada palabra contra el
 * diccionario embebido. Los clientes solo mandan su intento y animan localmente
 * la mecha entre snapshots. Mismo nivel de confianza spoofeable ya aceptado en el
 * repo (los clientes declaran su nickname); el server no escribe en Supabase.
 */

/** Vista publica de un jugador dentro de la partida. */
export interface WbPlayerView {
  nickname: string;
  lives: number;
  alive: boolean;
  /** Conectado al server ahora mismo (para las luces de estado del cliente). */
  connected: boolean;
}

export type WbPhase = "waiting" | "playing" | "over";

/** Snapshot completo que el server difunde en cada cambio. */
export interface WbState {
  phase: WbPhase;
  /** Nickname del jugador de turno, o null fuera de "playing". */
  turn: string | null;
  /** Fragmento (silaba/combo) que la palabra debe contener. */
  fragment: string | null;
  /** Fin de la mecha en epoch ms (el cliente lo anima), o null. */
  deadline: number | null;
  players: WbPlayerView[];
  /** Palabras aceptadas en la partida (para mostrar el ritmo). */
  usedCount: number;
  /** Ultima palabra aceptada, para animarla una vez en los demas clientes. */
  lastAccepted: { player: string; word: string; seq: number } | null;
}

/** Motivo por el que se rechazo un intento (feedback privado al que lo mando). */
export type WbRejectReason = "not-a-word" | "missing-fragment" | "already-used" | "not-your-turn";

export interface WbGameover {
  /** Puesto por jugador: 1 = ganador (ultimo en pie). */
  ranking: { nickname: string; place: number }[];
}

/** Cliente -> Server. */
export interface WbClientToServer {
  "wb:join": (msg: { code: string; nickname: string; roster: string[] }) => void;
  "wb:submit": (msg: { word: string }) => void;
  /** Texto en vivo del jugador de turno (se retransmite tal cual, sin validar). */
  "wb:typing": (msg: { text: string }) => void;
}

/** Server -> Cliente. */
export interface WbServerToClient {
  "wb:state": (state: WbState) => void;
  "wb:invalid": (msg: { reason: WbRejectReason }) => void;
  "wb:typing": (msg: { player: string; text: string }) => void;
  "wb:gameover": (msg: WbGameover) => void;
}
