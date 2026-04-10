import { GRID_SIZE } from '../../core/constants';
import { key } from '../../core/utils';
import type { IFoodBlock, IFarm, IObstacle, IFlag, IWaterBlock, ICorpseBlock, ISeedling, ILootBag, IPoopBlock, IEgg, ISaltWaterBlock } from './types';

export class Grid {
  size: number = GRID_SIZE;
  readonly obstacles:       Map<string, IObstacle>       = new Map();
  readonly foodBlocks:      Map<string, IFoodBlock>       = new Map();
  readonly farms:           Map<string, IFarm>            = new Map();
  readonly flags:           Map<string, IFlag>            = new Map();
  readonly flagCells:       Set<string>                   = new Set();
  readonly organismsByCell: Map<string, string>           = new Map();
  readonly waterBlocks:     Map<string, IWaterBlock>      = new Map();
  readonly corpseBlocks:    Map<string, ICorpseBlock>     = new Map();
  readonly seedlings:       Map<string, ISeedling>        = new Map();
  readonly lootBags:        Map<string, ILootBag>         = new Map();
  readonly poopBlocks:      Map<string, IPoopBlock>       = new Map();
  readonly eggs:            Map<string, IEgg>             = new Map();
  readonly saltWaterBlocks: Map<string, ISaltWaterBlock>  = new Map();

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  isOccupied(x: number, y: number): boolean {
    return this.organismsByCell.has(key(x, y));
  }

  isBlocked(x: number, y: number, ignoreId: string | null = null): boolean {
    if (!this.isInBounds(x, y)) return true;
    const k = key(x, y);
    if (this.obstacles.has(k)) return true;
    if (this.farms.has(k)) return true;
    if (this.flagCells.has(k)) return true;
    if (this.waterBlocks.has(k)) return true;
    if (this.saltWaterBlocks.has(k)) return true;
    const occ = this.organismsByCell.get(k);
    if (occ && occ !== ignoreId) return true;
    return false;
  }

  /** Terrain-only block check — organisms are ignored (used for pathfinding) */
  isBlockedTerrain(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return true;
    const k = key(x, y);
    return (
      this.obstacles.has(k) ||
      this.farms.has(k) ||
      this.flagCells.has(k) ||
      this.waterBlocks.has(k) ||
      this.saltWaterBlocks.has(k)
    );
  }

  /** Full occupancy check — used for spawn placement to avoid stacking */
  isCellOccupied(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return true;
    const k = key(x, y);
    return (
      this.obstacles.has(k) ||
      this.farms.has(k) ||
      this.flagCells.has(k) ||
      this.foodBlocks.has(k) ||
      this.waterBlocks.has(k) ||
      this.seedlings.has(k) ||
      this.poopBlocks.has(k) ||
      this.organismsByCell.has(k) ||
      this.eggs.has(k) ||
      this.saltWaterBlocks.has(k)
    );
  }

  setOccupied(x: number, y: number, id: string): void {
    this.organismsByCell.set(key(x, y), id);
  }

  clearOccupied(x: number, y: number, id: string): void {
    const k = key(x, y);
    if (this.organismsByCell.get(k) === id) this.organismsByCell.delete(k);
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
    this.organismsByCell.clear();
    this.waterBlocks.clear();
    this.corpseBlocks.clear();
    this.seedlings.clear();
    this.lootBags.clear();
    this.poopBlocks.clear();
    this.eggs.clear();
    this.saltWaterBlocks.clear();
  }
}
