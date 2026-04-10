import { key, log } from '../../../core/utils';
import type { Organism } from '../../entity/organism';
import type { World } from '../../world/world';
import type { IActionState } from '../types';
import type { ResourceType } from '../../../core/types';

// ── Constants ──
const XP_PER_HARVEST = 2;
const WATER_SHRINK_THRESHOLD = 0.25;
const FLAG_STORAGE_CAP = 30;

// ── Harvest ──

export function onHarvestComplete(world: World, organism: Organism): void {
  const act = organism.action!;
  const tp = act.payload?.targetPos;
  if (!tp) return;
  if (organism.inventory.isFull()) return;

  const rt = act.payload?.resourceType || 'plantFood';

  if (rt === 'plantFood' || rt === 'food_lq' || rt === 'food_hq') {
    harvestFood(world, organism, tp);
  } else if (rt === 'water') {
    harvestWater(world, organism, tp);
  } else if (rt === 'wood') {
    harvestWood(world, organism, tp);
  } else if (rt === 'meatFood' || rt === 'corpse') {
    harvestCorpse(world, organism, tp);
  }
}

function harvestFood(world: World, organism: Organism, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const block = world.grid.foodBlocks.get(k);
  if (block && block.units > 0) {
    block.units--;
    organism.inventory.add('plantFood', 1);
    organism.addXp(XP_PER_HARVEST);
    log(world, 'harvest', `${organism.name} harvested food`, organism.id, { x: tp.x, y: tp.y });
    if (block.units <= 0) world.grid.foodBlocks.delete(k);
    checkLevelUp(world, organism);
  }
}

function harvestWater(world: World, organism: Organism, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const block = world.grid.waterBlocks.get(k);
  if (!block || block.units <= 0) return;
  block.units--;
  organism.inventory.add('water', 1);
  organism.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${organism.name} harvested water`, organism.id, { x: tp.x, y: tp.y });

  if (block.units <= 0) {
    for (const c of block.cells) world.grid.waterBlocks.delete(key(c.x, c.y));
  } else if (block.size === 'large' && block.units < block.maxUnits * WATER_SHRINK_THRESHOLD) {
    const keepCell = block.cells[Math.floor(Math.random() * block.cells.length)];
    for (const c of block.cells) world.grid.waterBlocks.delete(key(c.x, c.y));
    block.size = 'small';
    block.x = keepCell.x;
    block.y = keepCell.y;
    block.cells = [keepCell];
    world.grid.waterBlocks.set(key(keepCell.x, keepCell.y), block);
  }
  checkLevelUp(world, organism);
}

function harvestWood(world: World, organism: Organism, tp: { x: number; y: number }): void {
  // In v5, wood could come from a corpse block sourced from a plant organism
  const k = key(tp.x, tp.y);
  const corpse = world.grid.corpseBlocks.get(k);
  if (!corpse || corpse.remainingResources <= 0) return;
  corpse.remainingResources--;
  organism.inventory.add('wood', 1);
  organism.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${organism.name} harvested wood from corpse`, organism.id, { x: tp.x, y: tp.y });
  if (corpse.remainingResources <= 0) {
    world.blockManager.removeCorpse(corpse.id);
  }
  checkLevelUp(world, organism);
}

function harvestCorpse(world: World, organism: Organism, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const corpse = world.grid.corpseBlocks.get(k);
  if (!corpse || corpse.remainingResources <= 0) return;
  corpse.remainingResources--;
  const rt: ResourceType = corpse.foodType === 'meat' ? 'meatFood' : 'plantFood';
  organism.inventory.add(rt, 1);
  organism.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${organism.name} harvested ${rt} from corpse`, organism.id, { x: tp.x, y: tp.y });
  if (corpse.remainingResources <= 0) {
    world.blockManager.removeCorpse(corpse.id);
  }
  checkLevelUp(world, organism);
}

// ── Pickup ──

export function onPickupComplete(world: World, organism: Organism): void {
  const act = organism.action!;
  const tp = act.payload?.targetPos;
  if (!tp) return;
  const k = key(tp.x, tp.y);
  const bag = world.grid.lootBags.get(k);
  if (!bag) return;
  const types: ResourceType[] = ['plantFood', 'meatFood', 'water', 'wood'];
  for (const rt of types) {
    if (bag.inventory[rt] <= 0) continue;
    const added = organism.inventory.add(rt, bag.inventory[rt]);
    bag.inventory[rt] -= added;
  }
  const remaining = bag.inventory.plantFood + bag.inventory.meatFood + bag.inventory.water + bag.inventory.wood;
  if (remaining <= 0) {
    world.grid.lootBags.delete(k);
  }
  log(world, 'loot', `${organism.name} picked up loot`, organism.id, { x: tp.x, y: tp.y });
}

// ── Deposit ──

export function onDepositComplete(world: World, organism: Organism): void {
  if (!organism.factionId) return;
  const flag = world.grid.flags.get(organism.factionId);
  if (!flag) return;
  const act = organism.action! as IActionState;
  const rt = (act.payload?.resourceType || 'plantFood') as ResourceType;
  if (!(rt in flag.storage)) return;
  const storage = flag.storage as unknown as Record<string, number>;
  const space = FLAG_STORAGE_CAP - (storage[rt] ?? 0);
  if (space <= 0) return;
  const amount = act.payload?.amount ?? organism.inventory[rt];
  const actual = Math.min(amount, organism.inventory[rt], space);
  if (actual <= 0) return;
  organism.inventory.remove(rt, actual);
  storage[rt] += actual;
  log(world, 'share', `${organism.name} deposited ${actual} ${rt}`, organism.id, { resource: rt, amount: actual });
}

// ── Withdraw ──

export function onWithdrawComplete(world: World, organism: Organism): void {
  if (!organism.factionId) return;
  const flag = world.grid.flags.get(organism.factionId);
  if (!flag) return;
  const act = organism.action! as IActionState;
  const rt = (act.payload?.resourceType || 'plantFood') as ResourceType;
  if (!(rt in flag.storage)) return;
  const storage = flag.storage as unknown as Record<string, number>;
  const stored = storage[rt] ?? 0;
  if (stored <= 0) return;
  const amount = act.payload?.amount ?? stored;
  const actual = organism.inventory.add(rt, Math.min(amount, stored));
  if (actual <= 0) return;
  storage[rt] -= actual;
  log(world, 'share', `${organism.name} withdrew ${actual} ${rt}`, organism.id, { resource: rt, amount: actual });
}

function checkLevelUp(world: World, organism: Organism): void {
  while (organism.canLevelUp()) {
    organism.levelUp();
    log(world, 'level', `${organism.name} leveled to ${organism.level}`, organism.id, {});
  }
}
