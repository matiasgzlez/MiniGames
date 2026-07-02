import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { RAPIER as R } from "./physics";
import { buildCarMesh, buildFlame, spinWheels } from "./Car";
import type { CarPayload } from "./ArenaChannel";
import { BLUE, CAR_HALF, ORANGE, REMOTE_SNAP_DIST, type Team } from "./constants";

const _q = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _e = new THREE.Euler();
const _X = new THREE.Vector3(1, 0, 0);

/**
 * Auto de otro jugador de la sala: cuerpo kinemático (empuja la pelota pero
 * no lo empujan) que interpola hacia el último snapshot de red. La velocidad
 * se estima con la diferencia entre snapshots para que el host pueda aplicar
 * el "kick" a la pelota también por los golpes de los rivales.
 */
export class RemoteCar {
  readonly body: RAPIER.RigidBody;
  readonly mesh: THREE.Group;
  readonly team: Team;
  private readonly world: RAPIER.World;
  readonly name: string;
  /** Cooldown del golpe a la pelota; lo administra Game.kick(). */
  kickTimer = 0;
  lastAt = Date.now();

  // Pose interpolada (render/física) y objetivo (último snapshot).
  private x: number;
  private y: number;
  private z: number;
  private yaw: number;
  private pitch = 0;
  private tx: number;
  private ty: number;
  private tz: number;
  private tyaw: number;
  private tpitch = 0;
  /** Velocidad estimada entre snapshots (para el kick del host). */
  readonly vel = new THREE.Vector3();
  private boosting = false;
  /** Supersónico según el último snapshot (Game dibuja la estela). */
  supersonic = false;
  /** Demolido según el último snapshot (el auto desaparece). */
  demolished = false;
  private readonly flame: THREE.Mesh;

  constructor(world: RAPIER.World, name: string, first: CarPayload) {
    this.world = world;
    this.name = name;
    this.team = first.t;
    this.x = this.tx = first.x;
    this.y = this.ty = first.y;
    this.z = this.tz = first.z;
    this.yaw = this.tyaw = first.a;

    this.body = this.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(first.x, first.y, first.z),
    );
    this.world.createCollider(
      R.ColliderDesc.cuboid(CAR_HALF.x, CAR_HALF.y, CAR_HALF.z),
      this.body,
    );

    this.mesh = buildCarMesh(first.t === "blue" ? BLUE : ORANGE);
    this.flame = buildFlame();
    this.mesh.add(this.flame);
    this.mesh.add(makeNameLabel(name, first.t));
  }

  /** Nuevo snapshot: actualiza objetivo y estima velocidad. */
  setTarget(p: CarPayload): void {
    const now = Date.now();
    const dt = Math.max((now - this.lastAt) / 1000, 0.02);
    this.vel.set((p.x - this.tx) / dt, (p.y - this.ty) / dt, (p.z - this.tz) / dt);
    this.tx = p.x;
    this.ty = p.y;
    this.tz = p.z;
    this.tyaw = p.a;
    this.tpitch = p.q ?? 0;
    this.boosting = p.b;
    this.supersonic = p.s ?? false;
    this.lastAt = now;

    const wasDemolished = this.demolished;
    this.demolished = p.d ?? false;
    if (this.demolished !== wasDemolished) {
      this.mesh.visible = !this.demolished;
      this.body.setEnabled(!this.demolished);
      // Al reaparecer no interpola desde donde explotó: salta al spawn.
      if (!this.demolished) this.snap();
    }

    // Respawn/teleport lejano: no vale la pena interpolar media cancha.
    if (Math.hypot(p.x - this.x, p.y - this.y, p.z - this.z) > REMOTE_SNAP_DIST) this.snap();
  }

  private snap(): void {
    this.x = this.tx;
    this.y = this.ty;
    this.z = this.tz;
    this.yaw = this.tyaw;
    this.vel.set(0, 0, 0);
  }

  /** Interpola hacia el snapshot y mueve el cuerpo kinemático. */
  update(dt: number): void {
    if (this.demolished) return;
    const k = 1 - Math.exp(-dt * 12);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.z += (this.tz - this.z) * k;
    // Yaw por el camino corto para que el giro no dé la vuelta larga.
    let da = this.tyaw - this.yaw;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    this.yaw += da * k;
    this.pitch += (this.tpitch - this.pitch) * k;

    _q.setFromEuler(_e.set(0, this.yaw, 0));
    this.body.setNextKinematicTranslation({ x: this.x, y: this.y, z: this.z });
    this.body.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });

    this.mesh.position.set(this.x, this.y, this.z);
    _qPitch.setFromAxisAngle(_X, -this.pitch);
    _q.multiply(_qPitch);
    this.mesh.quaternion.copy(_q);
    spinWheels(this.mesh, Math.hypot(this.vel.x, this.vel.z), dt);
    this.flame.visible = this.boosting;
    if (this.boosting) this.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
  }

  /** Saca el auto del mundo y de la escena (jugador desconectado). */
  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.world.removeRigidBody(this.body);
  }
}

/** Sprite con el nickname flotando sobre el auto, tintado por equipo. */
function makeNameLabel(name: string, team: Team): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 34px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = team === "blue" ? "#7cc4ff" : "#ffb37c";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 8;
  ctx.fillText(name.slice(0, 14), 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(6, 1.5, 1);
  sprite.position.set(0, 2.6, 0);
  return sprite;
}
