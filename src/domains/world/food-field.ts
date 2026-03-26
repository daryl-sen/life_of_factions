import { GRID } from '../../shared/constants';
import { key } from '../../shared/utils';
import type { Grid } from './grid';

const FF_INF = 0xffff;
const ffIdx = (x: number, y: number): number => y * GRID + x;

export class FoodField {
  readonly data: Uint16Array;
  private _lastTick = -1;

  constructor() {
    const N = GRID * GRID;
    this.data = new Uint16Array(N);
    this.data.fill(FF_INF);
  }

  get lastTick(): number {
    return this._lastTick;
  }

  recompute(grid: Grid, tick: number): void {
    const N = GRID * GRID;
    this.data.fill(FF_INF);
    if (grid.foodBlocks.size === 0) {
      this._lastTick = tick;
      return;
    }
    const staticBlocked = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
      const k = key(x, y);
      if (grid.walls.has(k)) return true;
      if (grid.farms.has(k)) return true;
      if (grid.flagCells.has(k)) return true;
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
