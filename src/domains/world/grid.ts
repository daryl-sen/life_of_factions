import { GRID } from '../../shared/constants';
import { key } from '../../shared/utils';
import type { IFoodBlock, IFarm, IWall, IFlag, IWaterBlock, ITreeBlock, ISeedling, ILootBag } from '../../shared/types';

export class Grid {
  readonly size: number = GRID;
  readonly walls: Map<string, IWall> = new Map();
  readonly foodBlocks: Map<string, IFoodBlock> = new Map();
  readonly farms: Map<string, IFarm> = new Map();
  readonly flags: Map<string, IFlag> = new Map();
  readonly flagCells: Set<string> = new Set();
  readonly agentsByCell: Map<string, string> = new Map();
  readonly waterBlocks: Map<string, IWaterBlock> = new Map();
  readonly treeBlocks: Map<string, ITreeBlock> = new Map();
  readonly seedlings: Map<string, ISeedling> = new Map();
  readonly lootBags: Map<string, ILootBag> = new Map();

  isBlocked(x: number, y: number, ignoreId: string | null = null): boolean {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return true;
    const k = key(x, y);
    if (this.walls.has(k)) return true;
    if (this.farms.has(k)) return true;
    if (this.flagCells.has(k)) return true;
    if (this.waterBlocks.has(k)) return true;
    if (this.treeBlocks.has(k)) return true;
    const occ = this.agentsByCell.get(k);
    if (occ && occ !== ignoreId) return true;
    return false;
  }

  /** Checks if any interactable block occupies the cell (for spawn no-stacking rule). */
  isCellOccupied(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return true;
    const k = key(x, y);
    return (
      this.walls.has(k) ||
      this.farms.has(k) ||
      this.flagCells.has(k) ||
      this.foodBlocks.has(k) ||
      this.waterBlocks.has(k) ||
      this.treeBlocks.has(k) ||
      this.seedlings.has(k) ||
      this.agentsByCell.has(k)
    );
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
    this.foodBlocks.clear();
    this.farms.clear();
    this.flags.clear();
    this.flagCells.clear();
    this.agentsByCell.clear();
    this.waterBlocks.clear();
    this.treeBlocks.clear();
    this.seedlings.clear();
    this.lootBags.clear();
  }
}
