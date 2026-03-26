import { GRID, TUNE } from '../../shared/constants';
import { key, uuid } from '../../shared/utils';
import type { World } from './world';

export class PoopBlockManager {
  static spawnPoop(world: World, x: number, y: number): boolean {
    const k = key(x, y);
    // Try agent's cell first, then adjacent
    if (!world.grid.isCellOccupied(x, y) || world.grid.agentsByCell.has(k)) {
      // Cell is free (or only has the agent on it) — only block if another interactable is there
      if (!world.grid.walls.has(k) && !world.grid.farms.has(k) && !world.grid.flagCells.has(k) &&
          !world.grid.foodBlocks.has(k) && !world.grid.waterBlocks.has(k) && !world.grid.treeBlocks.has(k) &&
          !world.grid.seedlings.has(k) && !world.grid.poopBlocks.has(k) && !world.grid.lootBags.has(k)) {
        world.poopBlocks.set(k, { id: uuid(), x, y, decayMs: TUNE.poop.decayMs });
        return true;
      }
    }

    // Try adjacent cells
    const adj: [number, number][] = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
    ];
    for (const [nx, ny] of adj) {
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const nk = key(nx, ny);
      if (world.grid.walls.has(nk) || world.grid.farms.has(nk) || world.grid.flagCells.has(nk) ||
          world.grid.foodBlocks.has(nk) || world.grid.waterBlocks.has(nk) || world.grid.treeBlocks.has(nk) ||
          world.grid.seedlings.has(nk) || world.grid.poopBlocks.has(nk) || world.grid.lootBags.has(nk)) continue;
      world.poopBlocks.set(nk, { id: uuid(), x: nx, y: ny, decayMs: TUNE.poop.decayMs });
      return true;
    }
    return false;
  }

  static tickDecay(world: World, dtMs: number): void {
    const toDelete: string[] = [];
    for (const [k, poop] of world.poopBlocks) {
      poop.decayMs -= dtMs;
      if (poop.decayMs <= 0) toDelete.push(k);
    }
    for (const k of toDelete) {
      world.poopBlocks.delete(k);
    }
  }
}
