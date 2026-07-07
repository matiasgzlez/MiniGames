import type { Socket } from "socket.io-client";
import type { PongMatchState, PongTransport } from "./PongProtocol";

/**
 * Transporte socket.io contra el namespace `/pong` del game server. Se conecta
 * con la lib cargada dinamicamente (no se incluye en juegos que no la usan) y
 * anuncia {code, nickname, roster} al conectar; el server empareja por el roster
 * (room.players() de Supabase, por joined_at) y arbitra la fisica. El cliente
 * manda su paleta (Y) y recibe `pg:state` para renderizar.
 */
export class PongSocket implements PongTransport {
  private socket: Socket | null = null;
  private stateCb: (s: PongMatchState) => void = () => {};

  private readonly serverUrl: string;
  private readonly code: string;
  private readonly nickname: string;
  private readonly roster: string[];

  constructor(serverUrl: string, code: string, nickname: string, roster: string[]) {
    this.serverUrl = serverUrl;
    this.code = code;
    this.nickname = nickname;
    this.roster = roster;
  }

  async connect(): Promise<void> {
    const { io } = await import("socket.io-client");
    const base = this.serverUrl.replace(/\/$/, "");
    const socket = io(`${base}/pong`, {
      transports: ["websocket"],
      reconnection: true,
    });
    this.socket = socket;

    socket.on("connect", () => {
      socket.emit("pg:join", { code: this.code, nickname: this.nickname, roster: this.roster });
    });
    socket.on("pg:state", (s: PongMatchState) => this.stateCb(s));
  }

  onState(cb: (s: PongMatchState) => void): void {
    this.stateCb = cb;
  }

  sendPaddle(y: number): void {
    this.socket?.emit("pg:paddle", { y });
  }

  dispose(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
