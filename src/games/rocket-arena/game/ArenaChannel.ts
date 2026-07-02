import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "../../../shared/supabase";
import type { Team } from "./constants";

/** Pose de un auto (jugador o bot del host), ~12 veces por segundo. */
export interface CarPayload {
  /** Nickname del dueño (o nombre del bot, prefijado con ★). */
  p: string;
  /** Equipo del auto: los clientes lo usan para colorearlo. */
  t: Team;
  x: number;
  y: number;
  z: number;
  /** Yaw en radianes. */
  a: number;
  /** Boost encendido (para la llama). */
  b: boolean;
  /** Pitch aéreo en radianes (aéreos; visual en los remotos). */
  q: number;
  /** Supersónico (para la estela). */
  s: boolean;
  /** Demolido (el auto desaparece hasta el respawn). */
  d: boolean;
}

/** Pad de boost consumido (índice en BoostPads). */
export interface PadEvent {
  i: number;
}

/** Elección de equipo de un jugador durante la fase de armado. */
export interface PickEvent {
  p: string;
  t: Team;
}

/** Asignación final de equipos (la difunde el host al cerrar la fase). */
export interface TeamsEvent {
  m: Record<string, Team>;
}

/** Quickchat: índice del mensaje en QUICKCHAT. */
export interface ChatEvent {
  p: string;
  t: Team;
  m: number;
}

/** Snapshot de la pelota + reloj + marcador; solo lo emite el host. */
export interface BallPayload {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Segundos restantes del partido (autoridad del host). */
  t: number;
  /** Marcador (curan a clientes que se perdieron un evento). */
  sb: number;
  so: number;
  /** 1 durante el tiempo extra (t pasa a contar para arriba). */
  ot?: number;
}

/** Eventos de partido, solo del host. */
export interface MatchEvent {
  e: "goal" | "kickoff" | "end" | "ot";
  /** Marcador tras el evento. */
  b: number;
  o: number;
  /** En "goal": equipo que anotó. */
  w?: Team;
}

/**
 * Canal efímero del partido: broadcast puro (sin DB), separado del
 * RoomChannel para no mezclar tráfico de alta frecuencia con el sync de
 * salas. Un canal por sala+ronda. Mismo patrón que RaceChannel de car-race.
 */
export class ArenaChannel {
  private readonly channel: RealtimeChannel | null;
  private readonly carCbs: Array<(p: CarPayload) => void> = [];
  private readonly ballCbs: Array<(p: BallPayload) => void> = [];
  private readonly evCbs: Array<(p: MatchEvent) => void> = [];
  private readonly padCbs: Array<(p: PadEvent) => void> = [];
  private readonly chatCbs: Array<(p: ChatEvent) => void> = [];
  private readonly pickCbs: Array<(p: PickEvent) => void> = [];
  private readonly teamsCbs: Array<(p: TeamsEvent) => void> = [];

  constructor(code: string, round: number) {
    const supabase = getSupabase();
    if (!supabase) {
      this.channel = null;
      return;
    }

    this.channel = supabase.channel(`arena:${code}:${round}`, {
      config: { broadcast: { self: false } },
    });
    this.channel.on("broadcast", { event: "car" }, ({ payload }) => {
      for (const cb of this.carCbs) cb(payload as CarPayload);
    });
    this.channel.on("broadcast", { event: "ball" }, ({ payload }) => {
      for (const cb of this.ballCbs) cb(payload as BallPayload);
    });
    this.channel.on("broadcast", { event: "ev" }, ({ payload }) => {
      for (const cb of this.evCbs) cb(payload as MatchEvent);
    });
    this.channel.on("broadcast", { event: "pad" }, ({ payload }) => {
      for (const cb of this.padCbs) cb(payload as PadEvent);
    });
    this.channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      for (const cb of this.chatCbs) cb(payload as ChatEvent);
    });
    this.channel.on("broadcast", { event: "pick" }, ({ payload }) => {
      for (const cb of this.pickCbs) cb(payload as PickEvent);
    });
    this.channel.on("broadcast", { event: "teams" }, ({ payload }) => {
      for (const cb of this.teamsCbs) cb(payload as TeamsEvent);
    });
    this.channel.subscribe();
  }

  sendCar(payload: CarPayload): void {
    if (this.channel) void this.channel.send({ type: "broadcast", event: "car", payload });
  }

  sendBall(payload: BallPayload): void {
    if (this.channel) void this.channel.send({ type: "broadcast", event: "ball", payload });
  }

  sendEvent(payload: MatchEvent): void {
    if (this.channel) void this.channel.send({ type: "broadcast", event: "ev", payload });
  }

  onCar(cb: (p: CarPayload) => void): void {
    this.carCbs.push(cb);
  }

  onBall(cb: (p: BallPayload) => void): void {
    this.ballCbs.push(cb);
  }

  onEvent(cb: (p: MatchEvent) => void): void {
    this.evCbs.push(cb);
  }

  sendPad(payload: PadEvent): void {
    if (this.channel) void this.channel.send({ type: "broadcast", event: "pad", payload });
  }

  onPad(cb: (p: PadEvent) => void): void {
    this.padCbs.push(cb);
  }

  sendChat(payload: ChatEvent): void {
    if (this.channel) void this.channel.send({ type: "broadcast", event: "chat", payload });
  }

  onChat(cb: (p: ChatEvent) => void): void {
    this.chatCbs.push(cb);
  }

  sendPick(payload: PickEvent): void {
    if (this.channel) void this.channel.send({ type: "broadcast", event: "pick", payload });
  }

  onPick(cb: (p: PickEvent) => void): void {
    this.pickCbs.push(cb);
  }

  sendTeams(payload: TeamsEvent): void {
    if (this.channel) void this.channel.send({ type: "broadcast", event: "teams", payload });
  }

  onTeams(cb: (p: TeamsEvent) => void): void {
    this.teamsCbs.push(cb);
  }

  dispose(): void {
    if (!this.channel) return;
    const supabase = getSupabase();
    if (supabase) void supabase.removeChannel(this.channel);
  }
}
