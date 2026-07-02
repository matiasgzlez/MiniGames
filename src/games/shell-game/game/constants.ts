export const BEST_KEY = "mg:shell-game:best";
export const TOTAL_LIVES = 1;

export const COUNTDOWN_LABELS = ["3", "2", "1", "YA!"];
export const COUNTDOWN_STEP = 0.5; // seconds per tick
export const MAX_DT = 0.1; // clamp delta-time to avoid jumps on tab switch

export interface LevelConfig {
  cups: number;
  swaps: number;
  speed: number; // Duration of each swap in ms
}

export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: { cups: 3, swaps: 3, speed: 650 },
  2: { cups: 3, swaps: 5, speed: 550 },
  3: { cups: 4, swaps: 5, speed: 500 },
  4: { cups: 4, swaps: 7, speed: 450 },
  5: { cups: 5, swaps: 8, speed: 400 },
};

export function getLevelConfig(level: number): LevelConfig {
  if (LEVEL_CONFIGS[level]) return LEVEL_CONFIGS[level];
  // Infinite difficulty scaling beyond level 5:
  // Add more swaps and make it slightly faster (minimum speed 250ms)
  const cups = Math.min(5, 3 + Math.floor((level - 1) / 2));
  const swaps = 8 + (level - 5) * 2;
  const speed = Math.max(250, 400 - (level - 5) * 20);
  return { cups, swaps, speed };
}
