export interface Pt {
  x: number;
  y: number;
}

/**
 * Definicion de una pista: curva cerrada generada como radio variable r(θ)
 * alrededor de un centro. Como r(θ) es positivo y univaluado, la curva nunca
 * se autointersecta, lo que permite formas variadas (ovalo, mani, trebol...)
 * sin validacion geometrica extra.
 */
export interface TrackDef {
  id: string;
  name: string;
  laps: number;
  /** Ancho del asfalto en px. */
  width: number;
  accent: string;
  /** Radio base y amplitud/frecuencia de los lobulos. */
  radius: number;
  lobes: number;
  lobeAmp: number;
  /** Estiramiento horizontal/vertical para romper la simetria. */
  scaleX: number;
  scaleY: number;
  /** Rotacion inicial, para que la recta de largada quede comoda. */
  rotation: number;
}

export const TRACK_DEFS: TrackDef[] = [
  {
    id: "gp-aurora",
    name: "GP Aurora",
    laps: 5,
    width: 150,
    accent: "#00f0ff",
    radius: 540,
    lobes: 0,
    lobeAmp: 0,
    scaleX: 1.3,
    scaleY: 0.7,
    rotation: 0,
  },
  {
    id: "ocho-nocturno",
    name: "Ocho Nocturno",
    laps: 5,
    width: 132,
    accent: "#ff3f81",
    radius: 560,
    lobes: 2,
    lobeAmp: 0.3,
    scaleX: 1.2,
    scaleY: 0.85,
    rotation: Math.PI / 2,
  },
  {
    id: "trebol-real",
    name: "Trébol Real",
    laps: 4,
    width: 126,
    accent: "#39ff14",
    radius: 620,
    lobes: 3,
    lobeAmp: 0.27,
    scaleX: 1.05,
    scaleY: 0.95,
    rotation: Math.PI / 6,
  },
  {
    id: "cuatro-vientos",
    name: "Cuatro Vientos",
    laps: 4,
    width: 126,
    accent: "#ffd700",
    radius: 600,
    lobes: 4,
    lobeAmp: 0.2,
    scaleX: 1.1,
    scaleY: 0.9,
    rotation: Math.PI / 4,
  },
  {
    id: "serpiente",
    name: "La Serpiente",
    laps: 4,
    width: 120,
    accent: "#ff8a3d",
    radius: 580,
    lobes: 5,
    lobeAmp: 0.15,
    scaleX: 1.25,
    scaleY: 0.85,
    rotation: 0,
  },
];

const SAMPLES = 260;

/** Pista lista para jugar: centerline densa + longitudes acumuladas. */
export class Track {
  readonly def: TrackDef;
  readonly pts: Pt[] = [];
  /** Longitud acumulada hasta el punto i (cum[0] = 0). */
  private readonly cum: number[] = [];
  readonly total: number;
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };

  constructor(def: TrackDef) {
    this.def = def;

    for (let i = 0; i < SAMPLES; i++) {
      const t = (i / SAMPLES) * Math.PI * 2;
      const r =
        def.radius * (def.lobes === 0 ? 1 : 1 - def.lobeAmp + def.lobeAmp * Math.cos(def.lobes * t));
      const a = t + def.rotation;
      this.pts.push({
        x: Math.cos(a) * r * def.scaleX,
        y: Math.sin(a) * r * def.scaleY,
      });
    }

    let acc = 0;
    for (let i = 0; i < SAMPLES; i++) {
      this.cum.push(acc);
      const a = this.pts[i];
      const b = this.pts[(i + 1) % SAMPLES];
      acc += Math.hypot(b.x - a.x, b.y - a.y);
    }
    this.total = acc;

    const xs = this.pts.map((p) => p.x);
    const ys = this.pts.map((p) => p.y);
    this.bounds = {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  /** Punto y tangente (angulo) sobre la centerline en s ∈ [0,1). */
  pointAt(s: number): { x: number; y: number; angle: number } {
    const target = ((s % 1) + 1) % 1 * this.total;
    let i = 0;
    // cum es creciente; busqueda lineal simple (se llama poco).
    while (i < SAMPLES - 1 && this.cum[i + 1] < target) i++;
    const a = this.pts[i];
    const b = this.pts[(i + 1) % SAMPLES];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = (target - this.cum[i]) / segLen;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  /**
   * Proyecta un punto sobre la centerline: progreso s ∈ [0,1) y distancia.
   * Escaneo lineal de los 260 segmentos; trivial a 60fps.
   */
  progressAt(x: number, y: number): { s: number; dist: number } {
    let bestD2 = Infinity;
    let bestS = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const a = this.pts[i];
      const b = this.pts[(i + 1) % SAMPLES];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const d2 = (x - px) * (x - px) + (y - py) * (y - py);
      if (d2 < bestD2) {
        bestD2 = d2;
        const segLen = Math.sqrt(len2);
        bestS = (this.cum[i] + segLen * t) / this.total;
      }
    }
    return { s: bestS % 1, dist: Math.sqrt(bestD2) };
  }

  /** True si el punto esta sobre el asfalto. */
  onTrack(x: number, y: number): boolean {
    return this.progressAt(x, y).dist <= this.def.width / 2;
  }
}

export function buildTrack(index: number): Track {
  const def = TRACK_DEFS[((index % TRACK_DEFS.length) + TRACK_DEFS.length) % TRACK_DEFS.length];
  return new Track(def);
}
