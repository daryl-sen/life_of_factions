import { GRID } from '../../shared/constants';
import { key } from '../../shared/utils';
import type { IFoodBlock, IFarm, IObstacle, IFlag, IWaterBlock, ITreeBlock, ISeedling, ILootBag, IPoopBlock, IEgg } from '../../shared/types';

export class Grid {
  size: number = GRID;
  readonly obstacles: Map<string, IObstacle> = new Map();
  readonly foodBlocks: Map<string, IFoodBlock> = new Map();
  readonly farms: Map<string, IFarm> = new Map();
  readonly flags: Map<string, IFlag> = new Map();
  readonly flagCells: Set<string> = new Set();
  readonly agentsByCell: Map<string, string> = new Map();
  readonly waterBlocks: Map<string, IWaterBlock> = new Map();
  readonly treeBlocks: Map<string, ITreeBlock> = new Map();
  readonly seedlings: Map<string, ISeedling> = new Map();
  readonly lootBags: Map<string, ILootBag> = new Map();
  readonly poopBlocks: Map<string, IPoopBlock> = new Map();
  readonly eggs: Map<string, IEgg> = new Map();

  isBlocked(x: number, y: number, ignoreId: string | null = null): boolean {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return true;
    const k = key(x, y);
    if (this.obstacles.has(k)) return true;
    if (this.farms.has(k)) return true;
    if (this.flagCells.has(k)) return true;
    if (this.waterBlocks.has(k)) return true;
    if (this.treeBlocks.has(k)) return true;
    const occ = this.agentsByCell.get(k);
    if (occ && occ !== ignoreId) return true;
    return false;
  }

  /** Checks terrain blocking only — agents are ignored. Used for pathfinding so agents can route through each other. */
  isBlockedTerrain(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return true;
    const k = key(x, y);
    if (this.obstacles.has(k)) return true;
    if (this.farms.has(k)) return true;
    if (this.flagCells.has(k)) return true;
    if (this.waterBlocks.has(k)) return true;
    if (this.treeBlocks.has(k)) return true;
    return false;
  }

  /** Checks if any interactable block occupies the cell (for spawn no-stacking rule). */
  isCellOccupied(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return true;
    const k = key(x, y);
    return (
      this.obstacles.has(k) ||
      this.farms.has(k) ||
      this.flagCells.has(k) ||
      this.foodBlocks.has(k) ||
      this.waterBlocks.has(k) ||
      this.treeBlocks.has(k) ||
      this.seedlings.has(k) ||
      this.poopBlocks.has(k) ||
      this.agentsByCell.has(k) ||
      this.eggs.has(k)
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
    this.obstacles.clear();
    this.foodBlocks.clear();
    this.farms.clear();
    this.flags.clear();
    this.flagCells.clear();
    this.agentsByCell.clear();
    this.waterBlocks.clear();
    this.treeBlocks.clear();
    this.seedlings.clear();
    this.lootBags.clear();
    this.poopBlocks.clear();
    this.eggs.clear();
  }
}
