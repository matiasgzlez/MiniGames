import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { RAPIER as R } from "./physics";
import {
  AIR_BOOST_ACCEL,
  AIR_CONTROL,
  AIR_PITCH_MAX,
  AIR_PITCH_RATE,
  AIR_YAW_RATE,
  BOOST_DRAIN,
  BOOST_MAX,
  BOOST_START,
  CAR_ACCEL,
  CAR_BOOST_SPEED,
  CAR_DENSITY,
  CAR_DOUBLE_JUMP_SPEED,
  CAR_GRIP,
  CAR_HALF,
  CAR_JUMP_SPEED,
  CAR_MAX_SPEED,
  CAR_REVERSE_SPEED,
  CAR_STEER_RATE,
  CAR_SUPERSONIC,
  DEMO_RESPAWN,
  DODGE_IMPULSE,
  DODGE_TIME,
  DRIFT_GRIP,
  DRIFT_STEER,
  JUMP_WINDOW,
} from "./constants";

export interface CarInput {
  /** -1 (reversa) .. 1 (acelerar). En el aire: pitch (W = trompa abajo). */
  throttle: number;
  /** -1 (izquierda) .. 1 (derecha). */
  steer: number;
  boost: boolean;
  jump: boolean;
  /** Derrape (freno de mano): rompe el agarre para rotar rápido. */
  drift: boolean;
  /**
   * Click del mouse: en el aire dispara la voltereta hacia donde apunta el
   * auto (o hacia la dirección apretada), sin necesidad de segundo salto.
   */
  flip: boolean;
}

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _qFlip = new THREE.Quaternion();
const _down = { x: 0, y: -1, z: 0 };
const _X = new THREE.Vector3(1, 0, 0);

/**
 * Auto arcade estilo RL: cuerpo dinámico con pitch/roll físicos bloqueados
 * (solo yaw); el pitch aéreo y la voltereta del dodge son visuales pero SÍ
 * afectan la dirección del empuje del boost y del golpe a la pelota.
 */
export class Car {
  readonly body: RAPIER.RigidBody;
  readonly mesh: THREE.Group;
  private readonly world: RAPIER.World;
  private spawnPos: THREE.Vector3;
  private spawnYaw: number;
  /** Estado previo del botón de salto, para disparar solo en el flanco. */
  private jumpHeld = false;
  /** Estado previo del click (voltereta por flanco). */
  private flipHeld = false;
  /** Cooldown del golpe a la pelota; lo administra Game.kick(). */
  kickTimer = 0;
  /** Llama trasera visible durante el boost. */
  private readonly flame: THREE.Mesh;
  private boostingNow = false;

  // ---- Boost como recurso ----
  boost = BOOST_START;

  // ---- Saltos / dodge ----
  private jumpsUsed = 0;
  private jumpWindow = 0;
  /** > 0 mientras dura la voltereta; el arranque da golpe fuerte a la pelota. */
  private flipTimer = 0;
  private readonly flipAxis = new THREE.Vector3(1, 0, 0);

  // ---- Actitud aérea ----
  /** Pitch controlado en el aire (rad, >0 = trompa arriba). */
  pitch = 0;

  // ---- Demolición ----
  demolished = false;
  private respawnTimer = 0;

  constructor(world: RAPIER.World, color: number, spawn: THREE.Vector3, yaw: number) {
    this.world = world;
    this.spawnPos = spawn.clone();
    this.spawnYaw = yaw;

    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setLinearDamping(0.4)
      .enabledRotations(false, true, false); // solo yaw
    this.body = this.world.createRigidBody(desc);
    this.world.createCollider(
      R.ColliderDesc.cuboid(CAR_HALF.x, CAR_HALF.y, CAR_HALF.z).setDensity(CAR_DENSITY).setRestitution(0.2),
      this.body,
    );
    this.setYaw(yaw);

    this.mesh = buildCarMesh(color);
    this.flame = buildFlame();
    this.mesh.add(this.flame);
  }

  /** Fuerza el estado visual del boost (Game lo apaga fuera de "playing"). */
  setBoosting(on: boolean): void {
    this.boostingNow = on && this.boost > 0;
  }

  isBoosting(): boolean {
    return this.boostingNow;
  }

  /** Recarga del medidor (pads); satura en BOOST_MAX. */
  addBoost(amount: number): void {
    this.boost = Math.min(BOOST_MAX, this.boost + amount);
  }

  /** Velocidad escalar actual (3D). */
  speed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  isSupersonic(): boolean {
    return !this.demolished && this.speed() >= CAR_SUPERSONIC;
  }

  /** Golpe fuerte: primeras décimas de la voltereta del dodge. */
  isDodging(): boolean {
    return this.flipTimer > DODGE_TIME * 0.45;
  }

  /** Cambia el punto de salida (modo sala: depende del equipo y el slot). */
  setSpawn(pos: THREE.Vector3, yaw: number): void {
    this.spawnPos = pos.clone();
    this.spawnYaw = yaw;
  }

  /** Yaw actual (rotaciones bloqueadas salvo Y, alcanza para la red). */
  yaw(): number {
    const f = this.forward();
    return Math.atan2(f.x, f.z);
  }

  reset(): void {
    this.body.setEnabled(true);
    this.body.setTranslation(this.spawnPos, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.setYaw(this.spawnYaw);
    this.demolished = false;
    this.mesh.visible = true;
    this.pitch = 0;
    this.flipTimer = 0;
    this.jumpsUsed = 0;
    this.jumpWindow = 0;
    this.boost = BOOST_START;
  }

  /** Explota el auto: desaparece y reaparece en su spawn tras unos segundos. */
  demolish(): void {
    if (this.demolished) return;
    this.demolished = true;
    this.respawnTimer = DEMO_RESPAWN;
    this.mesh.visible = false;
    this.body.setEnabled(false);
  }

  /** Avanza el timer de respawn; devuelve true en el frame que reaparece. */
  tickRespawn(dt: number): boolean {
    if (!this.demolished) return false;
    this.respawnTimer -= dt;
    if (this.respawnTimer > 0) return false;
    const keep = this.boost; // la demolición no regala boost de kickoff
    this.reset();
    this.boost = keep;
    return true;
  }

  private setYaw(yaw: number): void {
    _q.setFromEuler(new THREE.Euler(0, yaw, 0));
    this.body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
  }

  /** Vector forward (unitario, en el plano) según la orientación del cuerpo. */
  forward(): THREE.Vector3 {
    const r = this.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    return _fwd.set(0, 0, 1).applyQuaternion(_q).setY(0).normalize();
  }

  /** Dirección de la trompa incluyendo el pitch aéreo (para boost y golpes). */
  noseDir(): THREE.Vector3 {
    const f = this.forward();
    const cos = Math.cos(this.pitch);
    return new THREE.Vector3(f.x * cos, Math.sin(this.pitch), f.z * cos);
  }

  private isGrounded(): boolean {
    const p = this.body.translation();
    const ray = new R.Ray({ x: p.x, y: p.y, z: p.z }, _down);
    const hit = this.world.castRay(ray, CAR_HALF.y + 0.2, true, undefined, undefined, undefined, this.body);
    return hit !== null;
  }

  applyInput(input: CarInput, dt: number): void {
    this.jumpWindow = Math.max(0, this.jumpWindow - dt);
    this.flipTimer = Math.max(0, this.flipTimer - dt);
    if (this.demolished) {
      this.jumpHeld = input.jump;
      this.flipHeld = input.flip;
      this.boostingNow = false;
      return;
    }

    const fwd = this.forward();
    const vel = this.body.linvel();
    const v = new THREE.Vector3(vel.x, vel.y, vel.z);
    const grounded = this.isGrounded();

    // Boost: gasta el medidor. En el piso empuja hacia adelante; en el aire
    // empuja hacia donde apunta la trompa (pitch incluido) → aéreos.
    const wantBoost = input.boost && this.boost > 0 && (grounded ? input.throttle >= 0 : true);
    if (wantBoost) this.boost = Math.max(0, this.boost - BOOST_DRAIN * dt);
    this.boostingNow = wantBoost;

    if (grounded) {
      if (!input.jump) this.jumpsUsed = 0;
      // La trompa vuelve a nivel al aterrizar.
      this.pitch *= Math.exp(-dt * 10);

      const drifting = input.drift && Math.abs(v.dot(fwd)) > 4;
      const grip = drifting ? DRIFT_GRIP : CAR_GRIP;
      const steerRate = CAR_STEER_RATE * (drifting ? DRIFT_STEER : 1);

      // Componente hacia adelante actual y objetivo según acelerador.
      const forwardSpeed = v.dot(fwd);
      const topSpeed = input.throttle >= 0 ? (wantBoost ? CAR_BOOST_SPEED : CAR_MAX_SPEED) : CAR_REVERSE_SPEED;
      const accel = CAR_ACCEL * (wantBoost ? 1.5 : 1);
      const target = input.throttle * topSpeed;
      const newForward = moveToward(forwardSpeed, target, accel * dt);

      // Velocidad lateral: se amortigua para dar "agarre" (no patina)…
      // salvo durante el derrape, donde se conserva casi entera.
      const lateral = v.clone().sub(fwd.clone().multiplyScalar(forwardSpeed));
      lateral.multiplyScalar(Math.pow(grip, dt * 60));

      const next = fwd.clone().multiplyScalar(newForward).add(lateral);
      next.y = v.y; // la gravedad maneja el eje vertical

      // Salto por flanco: solo al presionar, no al mantener.
      if (input.jump && !this.jumpHeld) {
        next.y = CAR_JUMP_SPEED;
        this.jumpsUsed = 1;
        this.jumpWindow = JUMP_WINDOW;
      }

      this.body.setLinvel({ x: next.x, y: next.y, z: next.z }, true);

      // Giro: proporcional al acelerador y algo a la velocidad (no gira parado).
      // angvel.y positivo = girar a la IZQUIERDA; steer=+1 es derecha ⇒ negado.
      const speedFactor = THREE.MathUtils.clamp(Math.abs(forwardSpeed) / 8, 0.35, 1);
      const dir = input.throttle < 0 ? -1 : 1;
      this.body.setAngvel({ x: 0, y: -input.steer * steerRate * speedFactor * dir, z: 0 }, true);
    } else {
      // ---- En el aire ----
      // Actitud: A/D gira en yaw, W baja la trompa y S la levanta (como RL).
      this.body.setAngvel({ x: 0, y: -input.steer * AIR_YAW_RATE, z: 0 }, true);
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - input.throttle * AIR_PITCH_RATE * dt,
        -AIR_PITCH_MAX,
        AIR_PITCH_MAX,
      );

      // Momento casi intacto; una corrección lateral mínima (AIR_CONTROL).
      const forwardSpeed = v.dot(fwd);
      const lateral = v.clone().sub(fwd.clone().multiplyScalar(forwardSpeed)).setY(0);
      lateral.multiplyScalar(Math.pow(CAR_GRIP, dt * 60 * AIR_CONTROL));
      const next = fwd.clone().multiplyScalar(forwardSpeed).add(lateral);
      next.y = v.y;

      if (wantBoost) {
        const nose = this.noseDir();
        next.addScaledVector(nose, AIR_BOOST_ACCEL * dt);
        const sp = next.length();
        if (sp > CAR_BOOST_SPEED * 1.1) next.multiplyScalar((CAR_BOOST_SPEED * 1.1) / sp);
      }

      // Segundo salto (Espacio) o click: doble salto o dodge (voltereta).
      const jumpEdge = input.jump && !this.jumpHeld;
      const flipEdge = input.flip && !this.flipHeld;
      if ((jumpEdge || flipEdge) && this.jumpsUsed === 1 && this.jumpWindow > 0) {
        this.jumpsUsed = 2;
        let dx = input.steer;
        let dz = input.throttle;
        // Click sin dirección apretada: voltereta hacia donde apunta el auto.
        if (flipEdge && Math.abs(dx) + Math.abs(dz) <= 0.3) {
          dx = 0;
          dz = 1;
        }
        if (Math.abs(dx) + Math.abs(dz) > 0.3) {
          // Dodge direccional: tirón horizontal + voltereta visual.
          _right.crossVectors(_up, fwd).normalize();
          const dir = fwd.clone().multiplyScalar(dz).addScaledVector(_right, dx).normalize();
          next.addScaledVector(dir, DODGE_IMPULSE);
          next.y = Math.max(next.y * 0.25, 1.5);
          this.flipAxis.set(dz, 0, -dx).normalize();
          this.flipTimer = DODGE_TIME;
        } else {
          next.y = Math.max(next.y, 0) + CAR_DOUBLE_JUMP_SPEED;
        }
      }

      this.body.setLinvel({ x: next.x, y: next.y, z: next.z }, true);
    }

    this.jumpHeld = input.jump;
    this.flipHeld = input.flip;
  }

  /** Copia la pose física al mesh (yaw físico + pitch aéreo + voltereta). */
  sync(dt: number): void {
    const p = this.body.translation();
    const r = this.body.rotation();
    this.mesh.position.set(p.x, p.y, p.z);

    const vel = this.body.linvel();
    const fwd = this.forward();
    spinWheels(this.mesh, vel.x * fwd.x + vel.z * fwd.z, dt);

    _q.set(r.x, r.y, r.z, r.w);
    _qPitch.setFromAxisAngle(_X, -this.pitch);
    _q.multiply(_qPitch);
    if (this.flipTimer > 0) {
      const angle = (1 - this.flipTimer / DODGE_TIME) * Math.PI * 2;
      _qFlip.setFromAxisAngle(this.flipAxis, angle);
      _q.multiply(_qFlip);
    }
    this.mesh.quaternion.copy(_q);

    this.flame.visible = this.boostingNow;
    if (this.boostingNow) {
      // Parpadeo simple: la llama vibra en largo cada frame.
      const s = 0.8 + Math.random() * 0.5;
      this.flame.scale.set(1, s, 1);
    }
  }
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

// Geometrías y materiales compartidos entre autos (se crean una sola vez).
let sharedCarGeos: {
  hull: THREE.ExtrudeGeometry;
  wheel: THREE.CylinderGeometry;
  rim: THREE.CylinderGeometry;
} | null = null;
const carMats = new Map<number, { body: THREE.MeshStandardMaterial; rim: THREE.MeshStandardMaterial; tail: THREE.MeshStandardMaterial; glow: THREE.MeshStandardMaterial }>();
const tireMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9, metalness: 0.1 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.12, metalness: 0.9 });
const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeaff, emissiveIntensity: 2 });

function carGeos() {
  if (sharedCarGeos) return sharedCarGeos;
  // Casco con silueta de costado (cola alta → capot → trompa en cuña),
  // extruido a lo ancho. Perfil en (x = eje largo, y = altura desde el piso).
  const s = new THREE.Shape();
  s.moveTo(-2, 0.12);
  s.lineTo(-1.92, 0.6);
  s.lineTo(-0.7, 0.66);
  s.lineTo(0.5, 0.56);
  s.lineTo(1.45, 0.38);
  s.lineTo(2, 0.26);
  s.lineTo(2, 0.12);
  s.closePath();
  const hull = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: false });
  // rotY(-90°) manda el perfil-x a +Z (trompa adelante) y la extrusión
  // (z 0..1.9) queda en x ∈ [-1.9, 0]: se recentra sumando la mitad.
  hull.rotateY(-Math.PI / 2);
  hull.translate(0.95, -CAR_HALF.y, 0);

  const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14);
  wheel.rotateZ(Math.PI / 2); // eje de giro = X
  const rim = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10);
  rim.rotateZ(Math.PI / 2);
  sharedCarGeos = { hull, wheel, rim };
  return sharedCarGeos;
}

function carMatsFor(color: number) {
  let m = carMats.get(color);
  if (!m) {
    m = {
      body: new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 }),
      rim: new THREE.MeshStandardMaterial({ color: 0x222831, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 }),
      tail: new THREE.MeshStandardMaterial({ color: 0x11141c, emissive: color, emissiveIntensity: 2.2 }),
      glow: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: 1.1 }),
    };
    carMats.set(color, m);
  }
  return m;
}

/**
 * Auto estilo RL construido por partes (receta "hero vehicle"): casco
 * extruido con cuña, cabina de vidrio, 4 ruedas con llanta emisiva (giran;
 * ver userData.wheels), alerón, luces y underglow del color del equipo.
 * El proxy de colisión sigue siendo el cuboide físico, aparte.
 */
export function buildCarMesh(color: number): THREE.Group {
  const g = new THREE.Group();
  const geos = carGeos();
  const mats = carMatsFor(color);

  const hull = new THREE.Mesh(geos.hull, mats.body);
  hull.name = "hull";
  hull.castShadow = true;
  g.add(hull);

  // Cabina de vidrio, apenas inclinada hacia atrás.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.4, 1.35), glassMat);
  cabin.name = "cockpitGlass";
  cabin.position.set(0, 0.32, -0.25);
  cabin.rotation.x = -0.07;
  g.add(cabin);

  // Ruedas con llanta emisiva; Car/RemoteCar las giran cada frame.
  const wheels: THREE.Mesh[] = [];
  for (const [wx, wz] of [
    [0.95, 1.25],
    [-0.95, 1.25],
    [0.95, -1.3],
    [-0.95, -1.3],
  ]) {
    const wheel = new THREE.Mesh(geos.wheel, tireMat);
    wheel.position.set(wx, -0.1, wz);
    const rim = new THREE.Mesh(geos.rim, mats.rim);
    wheel.add(rim);
    wheels.push(wheel);
    g.add(wheel);
  }
  g.userData.wheels = wheels;

  // Alerón trasero (dos parantes + ala).
  const strutGeo = new THREE.BoxGeometry(0.08, 0.32, 0.09);
  for (const sx of [0.55, -0.55]) {
    const strut = new THREE.Mesh(strutGeo, tireMat);
    strut.position.set(sx, 0.26, -1.72);
    g.add(strut);
  }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.45), mats.body);
  wing.name = "spoiler";
  wing.position.set(0, 0.44, -1.78);
  wing.rotation.x = 0.16;
  g.add(wing);

  // Trompa: barra de luz blanca. Cola: strip emisivo del color del equipo.
  const headlight = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.09, 0.07), headlightMat);
  headlight.position.set(0, -0.27, 1.99);
  g.add(headlight);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.07), mats.tail);
  tail.name = "taillight";
  tail.position.set(0, 0, -1.99);
  g.add(tail);

  // Underglow: plano emisivo bajo el chasis (lee el equipo desde arriba).
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 3.1), mats.glow);
  glow.position.set(0, -0.46, 0);
  g.add(glow);

  return g;
}

/** Gira las ruedas de un mesh de auto según la velocidad de avance. */
export function spinWheels(mesh: THREE.Group, forwardSpeed: number, dt: number): void {
  const wheels = mesh.userData.wheels as THREE.Mesh[] | undefined;
  if (!wheels) return;
  const da = (forwardSpeed * dt) / 0.42;
  for (const wheel of wheels) wheel.rotation.x += da;
}

/** Cono emisivo apuntando hacia atrás (-Z); Game lo prende con el boost. */
export function buildFlame(): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 10), mat);
  flame.rotation.x = -Math.PI / 2; // el cono apunta a -Z (cola del auto)
  flame.position.set(0, 0, -(CAR_HALF.z + 1.1));
  flame.visible = false;
  return flame;
}
