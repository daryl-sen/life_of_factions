import { GRID_SIZE } from '../../core/constants';
import { key } from '../../core/utils';
import type { Grid } from './grid';

const WF_INF = 0xffff;
const wfIdx = (x: number, y: number): number => y * GRID_SIZE + x;

export class WaterField {
  data: Uint16Array;
  private _lastTick = -1;
  private _allocSize = 0;

  constructor() {
    const N = GRID_SIZE * GRID_SIZE;
    this._allocSize = N;
    this.data = new Uint16Array(N);
    this.data.fill(WF_INF);
  }

  get lastTick(): number {
    return this._lastTick;
  }

  recompute(grid: Grid, tick: number): void {
    const N = GRID_SIZE * GRID_SIZE;
    if (N !== this._allocSize) {
      this._allocSize = N;
      this.data = new Uint16Array(N);
    }
    this.data.fill(WF_INF);
    if (grid.waterBlocks.size === 0) {
      this._lastTick = tick;
      return;
    }
    const staticBlocked = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return true;
      const k = key(x, y);
      if (grid.obstacles.has(k)) return true;
      if (grid.farms.has(k)) return true;
      if (grid.flagCells.has(k)) return true;
      if (grid.corpseBlocks.has(k)) return true;
      // Water blocks themselves are seeds, not obstacles for this field
      return false;
    };
    const qx = new Int16Array(N);
    const qy = new Int16Array(N);
    let head = 0;
    let tail = 0;

    // Seed BFS with all water block cells (adjacency — cells next to water, not on it)
    const seeded = new Set<number>();
    for (const wb of grid.waterBlocks.values()) {
      for (const c of wb.cells) {
        const adj: [number, number][] = [
          [c.x + 1, c.y], [c.x - 1, c.y],
          [c.x, c.y + 1], [c.x, c.y - 1],
        ];
        for (const [nx, ny] of adj) {
          if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
          if (grid.waterBlocks.has(key(nx, ny))) continue; // skip water cells
          if (staticBlocked(nx, ny)) continue;
          const i = wfIdx(nx, ny);
          if (seeded.has(i)) continue;
          seeded.add(i);
          this.data[i] = 0;
          qx[tail] = nx;
          qy[tail] = ny;
          tail++;
        }
      }
    }
    while (head < tail) {
      const x = qx[head];
      const y = qy[head];
      head++;
      const d0 = this.data[wfIdx(x, y)];
      const nbrs: [number, number][] = [
        [x + 1, y], [x - 1, y],
        [x, y + 1], [x, y - 1],
      ];
      for (const [nx, ny] of nbrs) {
        if (staticBlocked(nx, ny)) continue;
        if (grid.waterBlocks.has(key(nx, ny))) continue;
        const ii = wfIdx(nx, ny);
        if (this.data[ii] > d0 + 1) {
          this.data[ii] = d0 + 1;
          qx[tail] = nx;
          qy[tail] = ny;
          tail++;
        }
      }
    }
    this._lastTick = tick;
  }

  distanceAt(x: number, y: number): number {
    return this.data[wfIdx(x, y)];
  }

  static readonly INF = WF_INF;
}
