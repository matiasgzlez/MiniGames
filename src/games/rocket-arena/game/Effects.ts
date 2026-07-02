import * as THREE from "three";

const MAX = 600;
const _c = new THREE.Color();

/** Sprite radial suave para que las partículas sean puntos redondos con fade. */
function makeSoftDot(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Pool único de partículas con blending aditivo: el color se apaga hacia
 * negro con la vida, así no hace falta alpha por-punto. Cubre la estela
 * supersónica, las explosiones de demolición y el festejo de gol.
 */
export class Effects {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly base: Float32Array;
  private cursor = 0;

  constructor() {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.base = new Float32Array(MAX * 3);
    this.pos.fill(-999);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.2,
      map: typeof document !== "undefined" ? makeSoftDot() : null,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: number,
    life: number,
  ): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    _c.setHex(color);
    this.base[i * 3] = _c.r;
    this.base[i * 3 + 1] = _c.g;
    this.base[i * 3 + 2] = _c.b;
    this.life[i] = life;
    this.maxLife[i] = life;
  }

  /** Estela supersónica: un par de chispas detrás del auto por frame. */
  trail(pos: THREE.Vector3, back: THREE.Vector3, color: number): void {
    for (let k = 0; k < 2; k++) {
      this.spawn(
        pos.x + back.x * 2 + (Math.random() - 0.5) * 0.8,
        pos.y + 0.3 + (Math.random() - 0.5) * 0.5,
        pos.z + back.z * 2 + (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2,
        color,
        0.35 + Math.random() * 0.2,
      );
    }
  }

  /** Explosión radial (demolición de un auto). */
  explode(pos: THREE.Vector3, color: number): void {
    for (let k = 0; k < 50; k++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = 6 + Math.random() * 14;
      this.spawn(
        pos.x,
        pos.y + 0.5,
        pos.z,
        Math.cos(a) * Math.cos(b) * s,
        Math.abs(Math.sin(b)) * s + 3,
        Math.sin(a) * Math.cos(b) * s,
        k % 3 === 0 ? 0xffffff : color,
        0.7 + Math.random() * 0.5,
      );
    }
  }

  /** Festejo de gol: lluvia grande del color del equipo que anotó. */
  goalBurst(pos: THREE.Vector3, color: number): void {
    for (let k = 0; k < 90; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 8 + Math.random() * 20;
      this.spawn(
        pos.x,
        pos.y + 1,
        pos.z,
        Math.cos(a) * s,
        4 + Math.random() * 16,
        Math.sin(a) * s,
        k % 4 === 0 ? 0xffffff : color,
        1.0 + Math.random() * 0.7,
      );
    }
  }

  update(dt: number): void {
    const g = -14 * dt;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        continue;
      }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] += g;
      const f = this.life[i] / this.maxLife[i];
      this.col[i * 3] = this.base[i * 3] * f;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * f;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
}
