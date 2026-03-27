import { GRID, TUNE } from '../../shared/constants';
import { manhattan } from '../../shared/utils';
import type { Grid } from './grid';

const tfIdx = (x: number, y: number): number => y * GRID + x;

export class TerrainField {
  /** Moisture per cell: 0 = dry (yellow), 127 = neutral (brown), 255 = wet (green) */
  readonly moisture: Uint8Array;
  /** Next tick at which each cell should update */
  private readonly _nextUpdate: Uint32Array;
  private _allocSize = 0;

  constructor() {
    const N = GRID * GRID;
    this._allocSize = N;
    this.moisture = new Uint8Array(N);
    this._nextUpdate = new Uint32Array(N);
    // Stagger initial updates: each cell gets a random offset so they don't all fire together
    for (let i = 0; i < N; i++) {
      this._nextUpdate[i] = Math.floor(Math.random() * 40);
    }
  }

  /**
   * Called every tick. Updates only the cells whose scheduled tick has arrived.
   * Each cell reschedules itself with a random interval of 16-40 ticks (4-10 seconds).
   */
  tick(grid: Grid, currentTick: number): void {
    const radius = TUNE.terrain.waterRadius;

    // Collect water block positions once (deduplicated by id)
    const waterPositions: Array<{ x: number; y: number }> = [];
    const seen = new Set<string>();
    for (const wb of grid.waterBlocks.values()) {
      if (seen.has(wb.id)) continue;
      seen.add(wb.id);
      for (const c of wb.cells) {
        waterPositions.push(c);
      }
    }

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = tfIdx(x, y);
        if (currentTick < this._nextUpdate[i]) continue;

        // Reschedule with random interval: 16-40 ticks (4-10 seconds)
        this._nextUpdate[i] = currentTick + 16 + Math.floor(Math.random() * 25);

        // Skip saltwater cells — they keep moisture 0
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
          // Scale: distance 0 → 255 (max wet), distance=radius → 128 (barely above neutral)
          m = Math.round(128 + 127 * (1 - minDist / radius));
        } else {
          // No water nearby — dry
          m = 0;
        }
        this.moisture[i] = m;
      }
    }
  }

  /** Full recompute — used at world init */
  recomputeAll(grid: Grid): void {
    const radius = TUNE.terrain.waterRadius;

    const waterPositions: Array<{ x: number; y: number }> = [];
    const seen = new Set<string>();
    for (const wb of grid.waterBlocks.values()) {
      if (seen.has(wb.id)) continue;
      seen.add(wb.id);
      for (const c of wb.cells) {
        waterPositions.push(c);
      }
    }

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = tfIdx(x, y);

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
  }

  moistureAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return 0;
    return this.moisture[tfIdx(x, y)];
  }
}
