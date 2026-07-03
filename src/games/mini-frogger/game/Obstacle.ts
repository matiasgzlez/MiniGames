import { GRID_SIZE, VIEW_WIDTH } from "./constants";

export class Obstacle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public speed: number;
  public dir: number; // 1 = right, -1 = left
  public type: "car" | "log" | "turtle";
  public color: string;
  public laneIndex: number;

  constructor(
    x: number,
    laneIndex: number,
    width: number,
    speed: number,
    dir: number,
    type: "car" | "log" | "turtle",
    color: string = "#ffffff"
  ) {
    this.x = x;
    this.laneIndex = laneIndex;
    this.y = laneIndex * GRID_SIZE;
    this.width = width;
    this.height = GRID_SIZE - 4; // slight vertical padding
    this.speed = speed;
    this.dir = dir;
    this.type = type;
    this.color = color;
  }

  public update(dt: number): void {
    // Move obstacle
    this.x += this.speed * this.dir * dt;

    // Wrap around screen
    if (this.dir === 1 && this.x > VIEW_WIDTH) {
      this.x = -this.width;
    } else if (this.dir === -1 && this.x < -this.width) {
      this.x = VIEW_WIDTH;
    }
  }

  /**
   * The visible body is inset from the raw AABB by this much on each horizontal
   * end (cars are drawn at `x + 2`, logs at `x + 1`). Collisions test against the
   * visible body so a death only fires when the frog truly overlaps what's drawn.
   */
  private static readonly VISUAL_INSET = 3;

  private get bodyLeft(): number {
    return this.x + Obstacle.VISUAL_INSET;
  }

  private get bodyRight(): number {
    return this.x + this.width - Obstacle.VISUAL_INSET;
  }

  /**
   * True when a frog hitbox centred at `cx` with the given half-width overlaps
   * the obstacle's visible body horizontally. The frog is always inside the
   * obstacle's lane row, so a 1D test is exact.
   */
  public overlapsX(cx: number, half: number): boolean {
    return cx + half > this.bodyLeft && cx - half < this.bodyRight;
  }

  /**
   * True when the point `cx` sits over the obstacle's visible body. Used for
   * river support: if the frog's centre is on a log/turtle, it floats safely.
   */
  public containsX(cx: number): boolean {
    return cx > this.bodyLeft && cx < this.bodyRight;
  }
}
