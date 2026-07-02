import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "../../../shared/supabase";

/** Snapshot de posicion que cada cliente emite ~10 veces por segundo. */
export interface RacePayload {
  /** Nickname del emisor. */
  p: string;
  x: number;
  y: number;
  /** Angulo del auto en radianes. */
  a: number;
  /** Vuelta actual (0-based). */
  l: number;
  /** Progreso dentro de la vuelta ∈ [0,1). */
  s: number;
  /** True cuando el emisor ya cruzo la meta final. */
  f: boolean;
}

/**
 * Canal efimero de la carrera: broadcast puro (sin DB) de las posiciones de
 * cada auto, separado del RoomChannel para no mezclar el trafico de alta
 * frecuencia con el sync de salas. Un canal por sala+ronda.
 */
export class RaceChannel {
  private readonly channel: RealtimeChannel | null;
  private readonly cbs: Array<(p: RacePayload) => void> = [];

  constructor(code: string, round: number) {
    const supabase = getSupabase();
    if (!supabase) {
      this.channel = null;
      return;
    }

    this.channel = supabase.channel(`race:${code}:${round}`, {
      config: { broadcast: { self: false } },
    });
    this.channel.on("broadcast", { event: "pos" }, ({ payload }) => {
      for (const cb of this.cbs) cb(payload as RacePayload);
    });
    this.channel.subscribe();
  }

  send(payload: RacePayload): void {
    if (!this.channel) return;
    void this.channel.send({ type: "broadcast", event: "pos", payload });
  }

  onPos(cb: (p: RacePayload) => void): void {
    this.cbs.push(cb);
  }

  dispose(): void {
    if (!this.channel) return;
    const supabase = getSupabase();
    if (supabase) void supabase.removeChannel(this.channel);
  }
}
