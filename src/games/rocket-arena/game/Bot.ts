import * as THREE from "three";
import type { Ball } from "./Ball";
import type { Car, CarInput } from "./Car";
import { BALL_R, CAR_HALF, DIFFICULTY, GOAL_LINE, type Difficulty, type DifficultyParams } from "./constants";

/**
 * IA de un auto: se posiciona detrás de la pelota (respecto al arco que
 * ataca) y la empuja hacia ese arco. La dificultad ajusta velocidad,
 * predicción, puntería y reacción.
 */
export class Bot {
  private readonly params: DifficultyParams;
  /** Arco que ataca el bot (x = ±GOAL_LINE según su equipo). */
  private readonly targetGoal: THREE.Vector3;
  /**
   * Corrimiento lateral (z) del punto de aproximación cuando está lejos de
   * la pelota: dos bots del mismo equipo cubren carriles distintos en vez
   * de amontonarse. Cerca de la pelota convergen igual.
   */
  private readonly spread: number;
  private reactTimer = 0;
  private aimNoise = 0;

  constructor(difficulty: Difficulty, targetX: number = -GOAL_LINE, spread = 0) {
    this.params = DIFFICULTY[difficulty];
    this.targetGoal = new THREE.Vector3(targetX, 1, 0);
    this.spread = spread;
  }

  update(dt: number, car: Car, ball: Ball): CarInput {
    // Refresca el ruido de puntería cada "reaction" segundos.
    this.reactTimer -= dt;
    if (this.reactTimer <= 0) {
      this.reactTimer = this.params.reaction + Math.random() * this.params.reaction;
      this.aimNoise = (Math.random() * 2 - 1) * this.params.aimError;
    }

    const carPos = car.body.translation();
    const predicted = ball.position().addScaledVector(ball.velocity(), this.params.lead);

    // Dirección hacia la que el bot quiere enviar la pelota.
    const attackDir = this.targetGoal.clone().sub(predicted).setY(0).normalize();
    // Punto de aproximación: detrás de la pelota respecto a esa dirección.
    const approach = predicted.clone().addScaledVector(attackDir, -(BALL_R + CAR_HALF.z + 0.8));

    if (this.spread !== 0) {
      const farFactor = Math.min(1, Math.hypot(predicted.x - carPos.x, predicted.z - carPos.z) / 50);
      approach.z += this.spread * farFactor;
    }

    const toTarget = approach.clone().sub(new THREE.Vector3(carPos.x, carPos.y, carPos.z)).setY(0);
    const dist = toTarget.length();

    const desiredYaw = Math.atan2(toTarget.x, toTarget.z) + this.aimNoise;
    const fwd = car.forward();
    const currentYaw = Math.atan2(fwd.x, fwd.z);
    const diff = wrapPi(desiredYaw - currentYaw);

    // diff>0 pide aumentar yaw (girar a la izquierda) ⇒ steer negativo,
    // porque steer=+1 significa "derecha" (ver Car.applyInput).
    const steer = THREE.MathUtils.clamp(-diff / (Math.PI / 5), -1, 1);
    // Baja la velocidad cuando está desalineado: menos v = radio de giro más
    // chico, así llega a la pelota en vez de orbitarla.
    const align = Math.max(0, 1 - Math.abs(diff) / 1.4);
    const throttle = this.params.speed * (0.4 + 0.6 * align) * (dist > 3 ? 1 : 0.45);
    const boost = this.params.boost && Math.abs(diff) < 0.3 && dist > 12;

    return { throttle, steer, boost, jump: false, drift: false, flip: false };
  }
}

function wrapPi(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
