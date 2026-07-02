import { CAR_LENGTH, CAR_WIDTH } from "./constants";
import type { Track } from "./tracks";

/** Auto de otro jugador, con posicion interpolada para dibujar suave. */
export interface RemoteCar {
  player: string;
  color: string;
  /** Posicion dibujada (se acerca al target en cada frame). */
  x: number;
  y: number;
  angle: number;
  /** Ultimo snapshot recibido. */
  tx: number;
  ty: number;
  ta: number;
  lap: number;
  s: number;
  finished: boolean;
  lastAt: number;
}

const GRID_STEP = 140;

export class Renderer {
  draw(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    track: Track,
    me: { x: number; y: number; angle: number },
    myColor: string,
    remotes: RemoteCar[],
  ): void {
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.fillStyle = "#0d0f12";
    ctx.fillRect(0, 0, viewW, viewH);

    const camX = me.x - viewW / 2;
    const camY = me.y - viewH / 2;

    this.drawGrid(ctx, viewW, viewH, camX, camY);

    ctx.save();
    ctx.translate(-camX, -camY);

    this.drawTrack(ctx, track);

    for (const car of remotes) {
      this.drawCar(ctx, car.x, car.y, car.angle, car.color, 0.8);
      this.drawName(ctx, car);
    }
    this.drawCar(ctx, me.x, me.y, me.angle, myColor, 1);

    ctx.restore();

    this.drawMinimap(ctx, viewW, track, me, myColor, remotes);
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    camX: number,
    camY: number,
  ): void {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -(camX % GRID_STEP); x < viewW; x += GRID_STEP) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewH);
    }
    for (let y = -(camY % GRID_STEP); y < viewH; y += GRID_STEP) {
      ctx.moveTo(0, y);
      ctx.lineTo(viewW, y);
    }
    ctx.stroke();
  }

  private tracePath(ctx: CanvasRenderingContext2D, track: Track): void {
    ctx.beginPath();
    ctx.moveTo(track.pts[0].x, track.pts[0].y);
    for (let i = 1; i < track.pts.length; i++) {
      ctx.lineTo(track.pts[i].x, track.pts[i].y);
    }
    ctx.closePath();
  }

  private drawTrack(ctx: CanvasRenderingContext2D, track: Track): void {
    const width = track.def.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Halo neon del circuito.
    this.tracePath(ctx, track);
    ctx.strokeStyle = track.def.accent + "22";
    ctx.lineWidth = width + 34;
    ctx.stroke();

    // Borde (banquina).
    this.tracePath(ctx, track);
    ctx.strokeStyle = "#3c4356";
    ctx.lineWidth = width + 12;
    ctx.stroke();

    // Asfalto.
    this.tracePath(ctx, track);
    ctx.strokeStyle = "#23283a";
    ctx.lineWidth = width;
    ctx.stroke();

    // Linea central punteada.
    this.tracePath(ctx, track);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 22]);
    ctx.stroke();
    ctx.setLineDash([]);

    this.drawStartLine(ctx, track);
  }

  /** Banda a cuadros perpendicular a la pista en s = 0. */
  private drawStartLine(ctx: CanvasRenderingContext2D, track: Track): void {
    const start = track.pointAt(0);
    const width = track.def.width;
    const cell = 10;
    const cols = 3;

    ctx.save();
    ctx.translate(start.x, start.y);
    ctx.rotate(start.angle);
    const rows = Math.floor(width / cell);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = (c + r) % 2 === 0 ? "#e8e8e8" : "#14161d";
        ctx.fillRect(c * cell - (cols * cell) / 2, r * cell - (rows * cell) / 2, cell, cell);
      }
    }
    ctx.restore();
  }

  private drawCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    color: string,
    alpha: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    const l = CAR_LENGTH;
    const w = CAR_WIDTH;

    // Ruedas.
    ctx.fillStyle = "#0a0b0e";
    ctx.fillRect(-l / 2 + 3, -w / 2 - 2, 8, 4);
    ctx.fillRect(-l / 2 + 3, w / 2 - 2, 8, 4);
    ctx.fillRect(l / 2 - 11, -w / 2 - 2, 8, 4);
    ctx.fillRect(l / 2 - 11, w / 2 - 2, 8, 4);

    // Carroceria con brillo neon.
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-l / 2, -w / 2, l, w, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Parabrisas.
    ctx.fillStyle = "rgba(10, 12, 16, 0.75)";
    ctx.beginPath();
    ctx.roundRect(l * 0.05, -w / 2 + 3, l * 0.28, w - 6, 3);
    ctx.fill();

    ctx.restore();
  }

  private drawName(ctx: CanvasRenderingContext2D, car: RemoteCar): void {
    ctx.save();
    ctx.font = "600 13px 'Outfit', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    const label = car.finished ? `${car.player} 🏁` : car.player;
    const w = ctx.measureText(label).width + 12;
    ctx.beginPath();
    ctx.roundRect(car.x - w / 2, car.y - 40, w, 19, 9);
    ctx.fill();
    ctx.fillStyle = car.color;
    ctx.fillText(label, car.x, car.y - 26);
    ctx.restore();
  }

  private drawMinimap(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    track: Track,
    me: { x: number; y: number },
    myColor: string,
    remotes: RemoteCar[],
  ): void {
    const mapW = 168;
    const mapH = 118;
    const pad = 14;
    const x0 = viewW - mapW - 16;
    const y0 = 16;

    ctx.save();
    ctx.fillStyle = "rgba(10, 12, 16, 0.65)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, y0, mapW, mapH, 12);
    ctx.fill();
    ctx.stroke();

    const b = track.bounds;
    const scale = Math.min((mapW - pad * 2) / (b.maxX - b.minX), (mapH - pad * 2) / (b.maxY - b.minY));
    const ox = x0 + mapW / 2 - ((b.minX + b.maxX) / 2) * scale;
    const oy = y0 + mapH / 2 - ((b.minY + b.maxY) / 2) * scale;

    ctx.beginPath();
    ctx.moveTo(track.pts[0].x * scale + ox, track.pts[0].y * scale + oy);
    for (let i = 1; i < track.pts.length; i++) {
      ctx.lineTo(track.pts[i].x * scale + ox, track.pts[i].y * scale + oy);
    }
    ctx.closePath();
    ctx.strokeStyle = track.def.accent + "88";
    ctx.lineWidth = 3;
    ctx.stroke();

    for (const car of remotes) {
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.arc(car.x * scale + ox, car.y * scale + oy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = myColor;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(me.x * scale + ox, me.y * scale + oy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
