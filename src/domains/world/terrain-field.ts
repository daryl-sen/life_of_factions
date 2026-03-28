import { GRID_SIZE } from '../../core/constants';
import { manhattan } from '../../core/utils';
import type { Grid } from './grid';

/** Per-frame step size for display moisture lerp (higher = faster transition). */
const LERP_STEP = 3;

export class TerrainField {
  /** Target moisture per cell: 0 = dry, 127 = neutral, 255 = wet. Set by recomputeAll(). */
  moisture: Uint8Array;
  /** Display moisture — what the renderer actually draws. Lerps toward `moisture` each frame. */
  displayMoisture: Uint8Array;
  /** Incremented whenever display values change — used by the renderer to invalidate its terrain cache. */
  version = 0;
  /** True while displayMoisture is still converging toward moisture. */
  transitioning = false;

  constructor() {
    const N = GRID_SIZE * GRID_SIZE;
    this.moisture = new Uint8Array(N);
    this.displayMoisture = new Uint8Array(N);
  }

  /** Reallocate arrays for a new grid size. Call this whenever GRID_SIZE changes. */
  resize(size: number): void {
    const N = size * size;
    this.moisture = new Uint8Array(N);
    this.displayMoisture = new Uint8Array(N);
    this.version++;
    this.transitioning = false;
  }

  /** Full recompute of all cell moisture values based on water proximity. */
  recomputeAll(grid: Grid): void {
    const radius = 5; // terrain.waterRadius

    const waterPositions: Array<{ x: number; y: number }> = [];
    const seen = new Set<string>();
    for (const wb of grid.waterBlocks.values()) {
      if (seen.has(wb.id)) continue;
      seen.add(wb.id);
      for (const c of wb.cells) {
        waterPositions.push(c);
      }
    }

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const i = y * GRID_SIZE + x;

        if (grid.saltWaterBlocks.has(`${x},${y}`)) {
          this.moisture[i] = 0;
          continue;
        }

        let minDist = radius + 1;
        for (const wp of waterPositions) {
          const d = manhattan(x, y, wp.x, wp.y);
          if (d < minDist) {
            minDist = d;
            if (d === 0) break;
          }
        }

        let m: number;
        if (minDist <= radius) {
          m = Math.round(128 + 127 * (1 - minDist / radius));
        } else {
          m = 0;
        }
        this.moisture[i] = m;
      }
    }
    this.transitioning = true;
  }

  /**
   * Snap display moisture to target immediately (used on first init / load).
   */
  snapDisplay(): void {
    this.displayMoisture.set(this.moisture);
    this.transitioning = false;
    this.version++;
  }

  /**
   * Step display moisture toward target. Call once per render frame.
   * Returns true if any values changed (terrain cache needs rebuild).
   */
  stepDisplay(): boolean {
    if (!this.transitioning) return false;

    let changed = false;
    const N = this.moisture.length;
    for (let i = 0; i < N; i++) {
      const cur = this.displayMoisture[i];
      const tgt = this.moisture[i];
      if (cur === tgt) continue;

      let next: number;
      if (cur < tgt) {
        next = Math.min(tgt, cur + LERP_STEP);
      } else {
        next = Math.max(tgt, cur - LERP_STEP);
      }
      this.displayMoisture[i] = next;
      changed = true;
    }

    if (changed) {
      this.version++;
    }
    this.transitioning = changed;
    return changed;
  }

  moistureAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return 0;
    return this.displayMoisture[y * GRID_SIZE + x];
  }
}
