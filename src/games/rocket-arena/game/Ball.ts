import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { RAPIER as R } from "./physics";
import { BALL_ANGULAR_DAMPING, BALL_DENSITY, BALL_LINEAR_DAMPING, BALL_R, BALL_RESTITUTION } from "./constants";

/** Pelota física; liviana respecto al auto para que se pueda empujar. */
export class Ball {
  readonly body: RAPIER.RigidBody;
  readonly mesh: THREE.Mesh;
  private readonly world: RAPIER.World;

  constructor(world: RAPIER.World) {
    this.world = world;
    this.body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(0, BALL_R, 0)
        .setLinearDamping(BALL_LINEAR_DAMPING)
        .setAngularDamping(BALL_ANGULAR_DAMPING)
        // Con tiros con dodge la pelota supera 1 unidad por paso: sin CCD
        // atravesaría las paredes finas.
        .setCcdEnabled(true),
    );
    this.world.createCollider(
      R.ColliderDesc.ball(BALL_R).setDensity(BALL_DENSITY).setRestitution(BALL_RESTITUTION),
      this.body,
    );

    const mat = new THREE.MeshStandardMaterial({
      map: typeof document !== "undefined" ? makeBallTexture() : null,
      color: 0xf4f6ff,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0x2a3854,
      emissiveIntensity: 0.45,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), mat);
    this.mesh.castShadow = true;
  }

  position(): THREE.Vector3 {
    const p = this.body.translation();
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  velocity(): THREE.Vector3 {
    const v = this.body.linvel();
    return new THREE.Vector3(v.x, v.y, v.z);
  }

  reset(): void {
    this.body.setTranslation({ x: 0, y: BALL_R, z: 0 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  sync(): void {
    const p = this.body.translation();
    const r = this.body.rotation();
    this.mesh.position.set(p.x, p.y, p.z);
    this.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

/**
 * Patrón procedural estilo pelota de fútbol/RL: paneles hexagonales con
 * costuras oscuras sobre base clara. Hace visible la rodadura y el efecto.
 */
function makeBallTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e9edf6";
  ctx.fillRect(0, 0, size, size);

  // Grilla de hexágonos alternados (costura) con algunos paneles oscuros.
  const r = 22;
  const dx = r * 1.75;
  const dy = r * 1.52;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#8f9ab0";
  let row = 0;
  for (let y = -r; y < size + r; y += dy, row++) {
    for (let x = -r; x < size + r; x += dx) {
      const cx = x + (row % 2 === 0 ? 0 : dx / 2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const px = cx + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      // Panel oscuro cada tanto, determinista para que no cambie por carga.
      if ((Math.round(cx / dx) * 7 + row * 3) % 5 === 0) {
        ctx.fillStyle = "#39435c";
        ctx.fill();
        ctx.fillStyle = "#e9edf6";
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}
