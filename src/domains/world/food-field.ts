import { GRID_SIZE } from '../../core/constants';
import { key } from '../../core/utils';
import type { Grid } from './grid';

const FF_INF = 0xffff;
const ffIdx = (x: number, y: number): number => y * GRID_SIZE + x;

export class FoodField {
  data: Uint16Array;
  private _lastTick = -1;
  private _allocSize = 0;

  constructor() {
    const N = GRID_SIZE * GRID_SIZE;
    this._allocSize = N;
    this.data = new Uint16Array(N);
    this.data.fill(FF_INF);
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
    this.data.fill(FF_INF);
    if (grid.foodBlocks.size === 0) {
      this._lastTick = tick;
      return;
    }
    const staticBlocked = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return true;
      const k = key(x, y);
      if (grid.obstacles.has(k)) return true;
      if (grid.farms.has(k)) return true;
      if (grid.flagCells.has(k)) return true;
      if (grid.waterBlocks.has(k)) return true;
      if (grid.treeBlocks.has(k)) return true;
      return false;
    };
    const qx = new Int16Array(N);
    const qy = new Int16Array(N);
    let head = 0;
    let tail = 0;
    for (const c of grid.foodBlocks.values()) {
      const i = ffIdx(c.x, c.y);
      this.data[i] = 0;
      qx[tail] = c.x;
      qy[tail] = c.y;
      tail++;
    }
    while (head < tail) {
      const x = qx[head];
      const y = qy[head];
      head++;
      const d0 = this.data[ffIdx(x, y)];
      const nbrs: [number, number][] = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of nbrs) {
        if (staticBlocked(nx, ny)) continue;
        const ii = ffIdx(nx, ny);
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
    return this.data[ffIdx(x, y)];
  }

  static readonly INF = FF_INF;
}
