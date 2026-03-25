import { GRID } from '../../shared/constants';
import { key } from '../../shared/utils';
import type { ICrop, IFarm, IWall, IFlag } from '../../shared/types';

export class Grid {
  readonly size: number = GRID;
  readonly walls: Map<string, IWall> = new Map();
  readonly crops: Map<string, ICrop> = new Map();
  readonly farms: Map<string, IFarm> = new Map();
  readonly flags: Map<string, IFlag> = new Map();
  readonly flagCells: Set<string> = new Set();
  readonly agentsByCell: Map<string, string> = new Map();

  isBlocked(x: number, y: number, ignoreId: string | null = null): boolean {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return true;
    const k = key(x, y);
    if (this.walls.has(k)) return true;
    if (this.farms.has(k)) return true;
    if (this.flagCells.has(k)) return true;
    const occ = this.agentsByCell.get(k);
    if (occ && occ !== ignoreId) return true;
    return false;
  }

  randomFreeCell(): { x: number; y: number } {
    for (let tries = 0; tries < 5000; tries++) {
      const x = Math.floor(Math.random() * this.size);
      const y = Math.floor(Math.random() * this.size);
      if (!this.isBlocked(x, y)) return { x, y };
    }
    return { x: 0, y: 0 };
  }

  clear(): void {
    this.walls.clear();
    this.crops.clear();
    this.farms.clear();
    this.flags.clear();
    this.flagCells.clear();
    this.agentsByCell.clear();
  }
}
