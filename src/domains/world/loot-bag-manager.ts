import { TUNE } from '../../shared/constants';
import { key, uuid, log } from '../../shared/utils';
import type { IInventory, IFlag, ILootBag } from '../../shared/types';
import type { World } from './world';
import type { Agent } from '../agent/agent';

export class LootBagManager {
  static spawnBag(world: World, x: number, y: number, inv: IInventory): void {
    const total = inv.food + inv.water + inv.wood;
    if (total <= 0) return;

    const k = key(x, y);
    const existing = world.lootBags.get(k);
    if (existing) {
      existing.inventory.food += inv.food;
      existing.inventory.water += inv.water;
      existing.inventory.wood += inv.wood;
      existing.decayMs = TUNE.lootBag.decayMs;
    } else {
      world.lootBags.set(k, {
        id: uuid(),
        x,
        y,
        inventory: { food: inv.food, water: inv.water, wood: inv.wood },
        decayMs: TUNE.lootBag.decayMs,
      });
    }
  }

  static tickDecay(world: World, dtMs: number): void {
    const toDelete: string[] = [];
    for (const [k, bag] of world.lootBags) {
      bag.decayMs -= dtMs;
      if (bag.decayMs <= 0) toDelete.push(k);
    }
    for (const k of toDelete) {
      world.lootBags.delete(k);
    }
  }

  static dropOnDeath(world: World, agent: Agent): void {
    if (agent.inventoryTotal() <= 0) return;
    LootBagManager.spawnBag(world, agent.cellX, agent.cellY, agent.inventory);
    log(world, 'loot', `${agent.name} dropped a loot bag`, agent.id, {
      x: agent.cellX,
      y: agent.cellY,
    });
  }

  static dropOnFlagDestruction(world: World, flag: IFlag): void {
    const s = flag.storage;
    if (s.food + s.water + s.wood <= 0) return;
    LootBagManager.spawnBag(world, flag.x, flag.y, {
      food: s.food,
      water: s.water,
      wood: s.wood,
    });
    log(world, 'loot', `Flag ${flag.factionId} dropped stored resources`, null, {
      factionId: flag.factionId,
      x: flag.x,
      y: flag.y,
    });
  }
}
