import {
  ACCEL,
  BRAKE_DECEL,
  DRAG,
  MAX_DT,
  MAX_REVERSE,
  MAX_SPEED,
  OFFTRACK_DRAG,
  OFFTRACK_SPEED_FACTOR,
  TURN_FULL_SPEED,
  TURN_RATE,
} from "./constants";

export interface CarInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/** Auto propio: cinematica arcade top-down (acelerar, frenar, doblar). */
export class Car {
  x = 0;
  y = 0;
  angle = 0;
  speed = 0;

  reset(x: number, y: number, angle: number): void {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
  }

  update(dt: number, input: CarInput, onTrack: boolean): void {
    dt = Math.min(dt, MAX_DT);

    const maxFwd = onTrack ? MAX_SPEED : MAX_SPEED * OFFTRACK_SPEED_FACTOR;
    const accel = onTrack ? ACCEL : ACCEL * 0.5;

    if (input.up) {
      this.speed += accel * dt;
    } else if (input.down) {
      // Frena, y si ya esta detenido, da marcha atras.
      this.speed -= (this.speed > 0 ? BRAKE_DECEL : ACCEL * 0.6) * dt;
    }

    // Freno natural (mas fuerte sobre el pasto).
    const drag = onTrack ? DRAG : OFFTRACK_DRAG;
    this.speed -= this.speed * drag * dt;

    this.speed = Math.max(-MAX_REVERSE, Math.min(maxFwd, this.speed));
    if (!input.up && !input.down && Math.abs(this.speed) < 4) this.speed = 0;

    // La direccion responde en proporcion a la velocidad (parado no dobla).
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (steer !== 0 && this.speed !== 0) {
      const effect = Math.min(1, Math.abs(this.speed) / TURN_FULL_SPEED);
      const dir = this.speed >= 0 ? 1 : -1;
      this.angle += steer * dir * TURN_RATE * effect * dt;
    }

    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
  }
}
