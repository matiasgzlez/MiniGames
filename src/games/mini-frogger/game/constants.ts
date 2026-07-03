import { Obstacle } from "./Obstacle";

export const GRID_SIZE = 40;
export const COLS = 13;
export const ROWS = 13;

export const VIEW_WIDTH = COLS * GRID_SIZE; // 520px
export const VIEW_HEIGHT = ROWS * GRID_SIZE; // 520px

export const MAX_DT = 0.1;

export const LIVES_START = 1;

/**
 * Half-width of the frog's collision hitbox, in pixels. The visible body is a
 * circle of radius ~10 centred in the 40px cell; a slightly smaller hitbox makes
 * near-misses survivable (die only on a real visual overlap) instead of punishing.
 */
export const FROG_HITBOX_HALF = 9;

export interface LaneData {
  row: number;
  type: "grass" | "road" | "river";
  speed: number;
  dir: number;
  obstacleType: "car" | "log" | "turtle";
  color: string;
  width: number;
  spacing: number;
  obstacles: Obstacle[];
}
