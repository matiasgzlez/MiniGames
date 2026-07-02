import * as THREE from "three";
import {
  BOOST_MAX,
  FIELD_LEN,
  FIELD_WID,
  PAD_BIG_RADIUS,
  PAD_BIG_RESPAWN,
  PAD_SMALL_AMOUNT,
  PAD_SMALL_RADIUS,
  PAD_SMALL_RESPAWN,
} from "./constants";
import type { Car } from "./Car";

interface Pad {
  x: number;
  z: number;
  big: boolean;
  active: boolean;
  timer: number;
  /** Grupo visual completo (se oculta mientras el pad está consumido). */
  mesh: THREE.Group;
  /** Gema flotante que rota/pulsa; solo los pads grandes la tienen. */
  gem: THREE.Mesh | null;
}

/**
 * Pads de boost estilo RL: 6 grandes (100%) y una grilla de chicos (12%),
 * dispuestos en espejo sobre la cancha. El pickup lo detecta cada peer para
 * sus propios autos; en sala se propaga con un evento "pad" para que todos
 * lo vean consumido y arranque el respawn (4 s chicos, 10 s grandes).
 */
export class BoostPads {
  readonly group = new THREE.Group();
  readonly pads: Pad[] = [];

  constructor() {
    for (const [x, z, big] of padLayout()) {
      const mesh = big ? buildBigPad() : buildSmallPad();
      mesh.position.set(x, 0, z);
      this.group.add(mesh);
      this.pads.push({
        x,
        z,
        big,
        active: true,
        timer: 0,
        mesh,
        gem: big ? (mesh.children[mesh.children.length - 1] as THREE.Mesh) : null,
      });
    }
  }

  /** Respawns + animación (rotación/flote de la gema). */
  update(dt: number, elapsed: number): void {
    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      if (!pad.active) {
        pad.timer -= dt;
        if (pad.timer <= 0) {
          pad.active = true;
          pad.mesh.visible = true;
        }
        continue;
      }
      if (pad.gem) {
        pad.gem.rotation.y = elapsed * 1.5 + i;
        pad.gem.position.y = 2.2 + Math.sin(elapsed * 2 + i) * 0.15;
      }
    }
  }

  /**
   * Intenta consumir un pad bajo el auto. Devuelve el índice consumido
   * (para propagarlo por red) o -1. No consume con el medidor lleno.
   */
  tryPickup(car: Car): number {
    if (car.demolished || car.boost >= BOOST_MAX) return -1;
    const p = car.body.translation();
    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      if (!pad.active) continue;
      const r = pad.big ? PAD_BIG_RADIUS : PAD_SMALL_RADIUS;
      const dx = p.x - pad.x;
      const dz = p.z - pad.z;
      if (dx * dx + dz * dz > r * r || p.y > 4) continue;
      car.addBoost(pad.big ? BOOST_MAX : PAD_SMALL_AMOUNT);
      this.take(i);
      return i;
    }
    return -1;
  }

  /** Marca un pad como consumido (local o por evento de red). */
  take(i: number): void {
    const pad = this.pads[i];
    if (!pad || !pad.active) return;
    pad.active = false;
    pad.timer = pad.big ? PAD_BIG_RESPAWN : PAD_SMALL_RESPAWN;
    pad.mesh.visible = false;
  }

  /** Kickoff: todos los pads vuelven a estar disponibles (como en RL). */
  resetAll(): void {
    for (const pad of this.pads) {
      pad.active = true;
      pad.timer = 0;
      pad.mesh.visible = true;
    }
  }
}

/**
 * Distribución estilo RL escalada a la cancha: 6 grandes (2 al medio de las
 * bandas + 4 cerca de las esquinas) y ~30 chicos en cuadrícula espejada.
 */
function padLayout(): Array<[number, number, boolean]> {
  const out: Array<[number, number, boolean]> = [];
  const seen = new Set<string>();
  const push = (x: number, z: number, big: boolean): void => {
    const key = `${x.toFixed(1)}:${z.toFixed(1)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push([x, z, big]);
  };

  const L = FIELD_LEN / 2;
  const W = FIELD_WID / 2;

  // Grandes: bandas centrales y esquinas (proporciones de RL).
  for (const sz of [1, -1]) push(0, sz * (W * 0.86), true);
  for (const sx of [1, -1]) for (const sz of [1, -1]) push(sx * (L * 0.8), sz * (W * 0.72), true);

  // Chicos: cuadrante espejado en X y Z.
  const quadrant: Array<[number, number]> = [
    [0, W * 0.4],
    [L * 0.25, 0],
    [L * 0.25, W * 0.2],
    [L * 0.25, W * 0.62],
    [L * 0.47, W * 0.35],
    [L * 0.47, W * 0.78],
    [L * 0.68, 0],
    [L * 0.68, W * 0.28],
    [L * 0.9, W * 0.24],
  ];
  for (const [qx, qz] of quadrant) {
    for (const sx of qx === 0 ? [1] : [1, -1]) {
      for (const sz of qz === 0 ? [1] : [1, -1]) {
        push(sx * qx, sz * qz, false);
      }
    }
  }
  return out;
}

const BOOST_COLOR = 0xffa62b;

// Geometrías y materiales compartidos entre los ~36 pads (una sola copia).
let shared: {
  ring: THREE.TorusGeometry;
  gem: THREE.OctahedronGeometry;
  disc: THREE.CylinderGeometry;
  flat: THREE.MeshBasicMaterial;
  glow: THREE.MeshStandardMaterial;
} | null = null;

function padShared() {
  if (shared) return shared;
  shared = {
    ring: new THREE.TorusGeometry(2.4, 0.18, 10, 32),
    gem: new THREE.OctahedronGeometry(1.1),
    disc: new THREE.CylinderGeometry(1.2, 1.2, 0.1, 18),
    flat: new THREE.MeshBasicMaterial({ color: BOOST_COLOR }),
    glow: new THREE.MeshStandardMaterial({
      color: BOOST_COLOR,
      emissive: BOOST_COLOR,
      emissiveIntensity: 1.6,
      roughness: 0.3,
    }),
  };
  return shared;
}

function buildBigPad(): THREE.Group {
  const g = new THREE.Group();
  const s = padShared();
  const ring = new THREE.Mesh(s.ring, s.flat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  g.add(ring);

  const gem = new THREE.Mesh(s.gem, s.glow);
  gem.position.y = 2.2;
  g.add(gem);
  return g;
}

/** Pad chico: solo un disco brillante al ras del piso (sin gema flotante). */
function buildSmallPad(): THREE.Group {
  const g = new THREE.Group();
  const s = padShared();
  const base = new THREE.Mesh(s.disc, s.flat);
  base.position.y = 0.05;
  g.add(base);
  return g;
}
