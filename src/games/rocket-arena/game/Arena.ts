import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { RAPIER as R } from "./physics";
import {
  BLUE,
  CORNER_CUT,
  FIELD_LEN,
  FIELD_WID,
  GOAL_DEPTH,
  GOAL_H,
  GOAL_W,
  ORANGE,
  SKIRT_H,
  WALL_H,
  WALL_T,
} from "./constants";

const WALL_COLOR = 0x2b3242;
const _q = new THREE.Quaternion();

/**
 * Cancha estática estilo RL: piso, techo, paredes con esquinas ochavadas
 * (la pelota no muere en los rincones), faldas inclinadas al pie de las
 * paredes (la pelota sube suave y los autos pueden trepar un poco) y los
 * dos arcos con hueco y red. Genera geometría visual (THREE) y colliders
 * fijos (Rapier). El gol se detecta por posición en Game, no acá.
 */
export class Arena {
  readonly group = new THREE.Group();
  private readonly world: RAPIER.World;
  /** Luces de arco que pulsan; ver update(). */
  private readonly goalLights: THREE.PointLight[] = [];

  constructor(world: RAPIER.World) {
    this.world = world;
    this.buildFloor();
    this.buildCeiling();
    this.buildSideWalls();
    this.buildCorners();
    this.buildEndWall(1, ORANGE); // arco naranja en +X
    this.buildEndWall(-1, BLUE); // arco azul en -X
    this.buildSkirts();
    this.buildLines();
    this.buildNeonTrim();
    this.buildLightTowers();
    this.buildHorizon();
  }

  /** Pulso suave de las luces de los arcos (ambiente vivo). */
  update(elapsed: number): void {
    const pulse = 0.75 + 0.25 * Math.sin(elapsed * 2.2);
    for (const light of this.goalLights) light.intensity = 70 * pulse;
  }

  /** Cuboide fijo (opcionalmente rotado): collider Rapier + mesh opcional. */
  private box(
    cx: number,
    cy: number,
    cz: number,
    hx: number,
    hy: number,
    hz: number,
    color: number | null,
    opacity = 1,
    rot: THREE.Quaternion | null = null,
  ): void {
    let desc = R.RigidBodyDesc.fixed().setTranslation(cx, cy, cz);
    if (rot) desc = desc.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
    const body = this.world.createRigidBody(desc);
    this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setRestitution(0.4), body);

    if (color === null) return;
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      roughness: 0.85,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), mat);
    mesh.position.set(cx, cy, cz);
    if (rot) mesh.quaternion.copy(rot);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildFloor(): void {
    const hx = FIELD_LEN / 2 + GOAL_DEPTH;
    // Collider sin visual: el piso visible lleva textura de grilla aparte.
    this.box(0, -0.5, 0, hx, 0.5, FIELD_WID / 2, null);

    // La textura usa canvas: en entornos sin DOM (tests) va color plano.
    const tex = typeof document !== "undefined" ? makeGridTexture() : null;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: tex ? 0xffffff : 0x151928,
      roughness: 0.7,
      metalness: 0.25,
    });
    if (tex) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(hx / 5, FIELD_WID / 10);
      tex.anisotropy = 4;
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, FIELD_WID), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    this.group.add(floor);
  }

  private buildCeiling(): void {
    // Techo invisible: solo collider para que la pelota no escape hacia arriba.
    this.box(0, WALL_H + 0.5, 0, FIELD_LEN / 2 + GOAL_DEPTH, 0.5, FIELD_WID / 2, null);
  }

  private buildSideWalls(): void {
    // Acortadas: las esquinas las cubren los chaflanes.
    const z = FIELD_WID / 2 + WALL_T / 2;
    const hx = FIELD_LEN / 2 - CORNER_CUT + 1;
    for (const s of [1, -1]) {
      this.box(0, WALL_H / 2, s * z, hx, WALL_H / 2, WALL_T / 2, WALL_COLOR, 0.55);
    }
  }

  /** Chaflanes de 45° en las cuatro esquinas (estilo RL). */
  private buildCorners(): void {
    const L = FIELD_LEN / 2;
    const W = FIELD_WID / 2;
    const half = (CORNER_CUT * Math.SQRT2) / 2 + WALL_T;
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        _q.setFromEuler(new THREE.Euler(0, sx * sz * (Math.PI / 4), 0));
        const nx = (sx * WALL_T) / 2 / Math.SQRT2;
        const nz = (sz * WALL_T) / 2 / Math.SQRT2;
        this.box(
          sx * (L - CORNER_CUT / 2) + nx,
          WALL_H / 2,
          sz * (W - CORNER_CUT / 2) + nz,
          half,
          WALL_H / 2,
          WALL_T / 2,
          WALL_COLOR,
          0.55,
          _q.clone(),
        );
      }
    }
  }

  private buildEndWall(s: number, color: number): void {
    const xWall = s * (FIELD_LEN / 2 + WALL_T / 2);
    // Los pilares llegan hasta el chaflán de la esquina.
    const pillarHz = (FIELD_WID / 2 - CORNER_CUT - GOAL_W / 2) / 2 + 1;
    const pillarCz = GOAL_W / 2 + pillarHz - 1;

    // Pilares a cada lado del hueco del arco.
    for (const sz of [1, -1]) {
      this.box(xWall, WALL_H / 2, sz * pillarCz, WALL_T / 2, WALL_H / 2, pillarHz, WALL_COLOR, 0.55);
    }
    // Dintel por encima del arco.
    const lintelHy = (WALL_H - GOAL_H) / 2;
    this.box(xWall, GOAL_H + lintelHy, 0, WALL_T / 2, lintelHy, GOAL_W / 2, WALL_COLOR, 0.55);

    // Red del arco (recess) para contener la pelota tras el gol.
    const backX = s * (FIELD_LEN / 2 + GOAL_DEPTH);
    this.box(backX + (s * WALL_T) / 2, WALL_H / 2, 0, WALL_T / 2, WALL_H / 2, GOAL_W / 2 + WALL_T, color, 0.4);
    for (const sz of [1, -1]) {
      this.box(
        s * (FIELD_LEN / 2 + GOAL_DEPTH / 2),
        WALL_H / 2,
        sz * (GOAL_W / 2 + WALL_T / 2),
        GOAL_DEPTH / 2,
        WALL_H / 2,
        WALL_T / 2,
        color,
        0.4,
      );
    }

    // Marco del arco (postes y travesaño) resaltado con el color del equipo.
    // emissiveIntensity alta para que el bloom lo haga brillar de verdad.
    const post = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.5 });
    const postGeo = new THREE.BoxGeometry(0.4, GOAL_H, 0.4);
    for (const sz of [1, -1]) {
      const p = new THREE.Mesh(postGeo, post);
      p.position.set((s * FIELD_LEN) / 2, GOAL_H / 2, (sz * GOAL_W) / 2);
      this.group.add(p);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, GOAL_W + 0.4), post);
    bar.position.set((s * FIELD_LEN) / 2, GOAL_H, 0);
    this.group.add(bar);

    // Luz puntual del color del equipo dentro del arco: baña la boca del arco
    // y pulsa en update(). Sin sombras (caras) — solo ambiente.
    const glow = new THREE.PointLight(color, 90, 90, 1.8);
    glow.position.set(s * (FIELD_LEN / 2 + GOAL_DEPTH / 2), GOAL_H * 0.7, 0);
    this.goalLights.push(glow);
    this.group.add(glow);
  }

  /**
   * Faldas de 45° al pie de las paredes: cajas de sección cuadrada rotadas
   * 45° y hundidas en la unión piso-pared. La pelota sube suave en vez de
   * rebotar seco, y un auto lanzado puede trepar y saltar desde ahí.
   */
  private buildSkirts(): void {
    const s = SKIRT_H;
    const L = FIELD_LEN / 2;
    const W = FIELD_WID / 2;

    // Laterales (a lo largo de X).
    _q.setFromEuler(new THREE.Euler(Math.PI / 4, 0, 0));
    for (const sz of [1, -1]) {
      this.box(0, 0, sz * W, L - CORNER_CUT + 1, s, s, WALL_COLOR, 0.35, _q.clone());
    }

    // Fondos (a lo largo de Z), dejando libre la boca del arco.
    _q.setFromEuler(new THREE.Euler(0, 0, Math.PI / 4));
    const segHz = (W - CORNER_CUT - GOAL_W / 2 - 1.5) / 2;
    const segCz = GOAL_W / 2 + 1.5 + segHz;
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        this.box(sx * L, 0, sz * segCz, s, s, segHz, WALL_COLOR, 0.35, _q.clone());
      }
    }

    // Chaflanes de esquina.
    const cornerHalf = (CORNER_CUT * Math.SQRT2) / 2;
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const yaw = sx * sz * (Math.PI / 4);
        _q.setFromEuler(new THREE.Euler(Math.PI / 4, yaw, 0, "YXZ"));
        this.box(
          sx * (L - CORNER_CUT / 2),
          0,
          sz * (W - CORNER_CUT / 2),
          cornerHalf,
          s,
          s,
          WALL_COLOR,
          0.35,
          _q.clone(),
        );
      }
    }
  }

  private buildLines(): void {
    // Línea de medio campo y círculo central en cian brillante (bloom).
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x35e8ff });
    const mid = new THREE.Mesh(new THREE.PlaneGeometry(0.5, FIELD_WID), lineMat);
    mid.rotation.x = -Math.PI / 2;
    mid.position.set(0, 0.03, 0);
    this.group.add(mid);

    const ring = new THREE.Mesh(new THREE.RingGeometry(17.3, 18, 64), lineMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.03, 0);
    this.group.add(ring);

    // Áreas frente a cada arco (solo decorativas).
    for (const [sx, color] of [
      [1, ORANGE],
      [-1, BLUE],
    ] as Array<[number, number]>) {
      const boxMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
      const w = 34;
      const d = GOAL_W + 16;
      const edges: Array<[number, number, number, number]> = [
        [sx * (FIELD_LEN / 2 - w), 0, 0.5, d], // línea frontal
        [sx * (FIELD_LEN / 2 - w / 2), d / 2, w, 0.5], // lateral +z
        [sx * (FIELD_LEN / 2 - w / 2), -d / 2, w, 0.5], // lateral -z
      ];
      for (const [cx, cz, lw, ld] of edges) {
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), boxMat);
        seg.rotation.x = -Math.PI / 2;
        seg.position.set(cx, 0.03, cz);
        this.group.add(seg);
      }
    }
  }

  /** Tiras de neón en el borde del piso: cian a los lados, color de equipo al fondo. */
  private buildNeonTrim(): void {
    const trim = (w: number, d: number, x: number, z: number, color: number, yaw = 0, y = 0.125): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z);
      m.rotation.y = yaw;
      this.group.add(m);
    };

    const L = FIELD_LEN / 2;
    const W = FIELD_WID / 2;
    // Laterales (recortados por los chaflanes).
    for (const sz of [1, -1]) {
      trim((L - CORNER_CUT) * 2, 0.35, 0, sz * (W - 0.2), 0x1fd7ff);
    }
    // Chaflanes en cian.
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        trim(CORNER_CUT * Math.SQRT2, 0.35, sx * (L - CORNER_CUT / 2 - 0.4), sz * (W - CORNER_CUT / 2 - 0.4), 0x1fd7ff, sx * sz * (Math.PI / 4));
      }
    }
    // Fondo: dos segmentos por lado, dejando libre la boca del arco.
    const segW = W - CORNER_CUT - GOAL_W / 2;
    for (const [sx, color] of [
      [1, ORANGE],
      [-1, BLUE],
    ] as Array<[number, number]>) {
      for (const sz of [1, -1]) {
        trim(0.35, segW, sx * (L - 0.2), sz * (GOAL_W / 2 + segW / 2), color);
      }
    }

    // Borde superior de las paredes en cian tenue: define el volumen de la
    // arena de noche (sin esto las paredes se pierden en el negro).
    const topColor = 0x155a70;
    for (const sz of [1, -1]) {
      trim((L - CORNER_CUT) * 2, 0.4, 0, sz * (W + WALL_T / 2), topColor, 0, WALL_H);
    }
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        trim(
          CORNER_CUT * Math.SQRT2,
          0.4,
          sx * (L - CORNER_CUT / 2),
          sz * (W - CORNER_CUT / 2),
          topColor,
          sx * sz * (Math.PI / 4),
          WALL_H,
        );
      }
    }
    for (const sx of [1, -1]) {
      trim(0.4, (W - CORNER_CUT - GOAL_W / 2) * 2 + GOAL_W, sx * (L + WALL_T / 2), 0, topColor, 0, WALL_H);
    }
  }

  /** Torres de luz en las esquinas: pilar oscuro con cabezal emisivo. */
  private buildLightTowers(): void {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.9 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff });
    const poleGeo = new THREE.CylinderGeometry(0.6, 0.9, WALL_H + 14, 8);
    const headGeo = new THREE.BoxGeometry(3.6, 1.4, 1.4);

    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const x = sx * (FIELD_LEN / 2 + GOAL_DEPTH + 4);
        const z = sz * (FIELD_WID / 2 + 4);
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, (WALL_H + 14) / 2, z);
        this.group.add(pole);

        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(x, WALL_H + 14, z);
        head.lookAt(0, 0, 0);
        this.group.add(head);
      }
    }
  }
  /**
   * Horizonte: cilindro lejano con gradiente vertical (azul profundo →
   * transparente) que da profundidad detrás de las paredes sin costo real.
   */
  private buildHorizon(): void {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 128, 0, 0);
    grad.addColorStop(0, "rgba(38, 70, 140, 0.55)");
    grad.addColorStop(0.45, "rgba(24, 42, 90, 0.22)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.CylinderGeometry(430, 430, 100, 48, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.y = 30;
    this.group.add(ring);
  }
}

/** Textura procedural del piso: base oscura con grilla tenue (sin assets). */
function makeGridTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#151928";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(90, 120, 190, 0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  // Cruz interior más tenue para densidad visual.
  ctx.strokeStyle = "rgba(90, 120, 190, 0.10)";
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
