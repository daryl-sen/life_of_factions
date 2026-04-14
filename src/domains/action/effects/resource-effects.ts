import { key, log, manhattan } from '../../../core/utils';
import { COCONUT_EMOJI, TREE_FRUIT_EMOJIS } from '../../../core/constants';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';
import type { IActionState } from '../types';
import { Spawner } from '../../simulation/spawner';

// ── Constants ──
const XP_PER_HARVEST = 2;
const WATER_SHRINK_THRESHOLD = 0.25;
const TREE_SEEDLING_CHANCE_ON_HARVEST = 0.10;
const TREE_FOOD_CHANCE_ON_HARVEST = 0.05;
const COCONUT_CAP_PER_TREE = 3;
const COCONUT_RADIUS = 2;
const FLAG_STORAGE_CAP = 30;

// ── Harvest ──

export function onHarvestComplete(world: World, agent: Agent): void {
  const act = agent.action!;
  const tp = act.payload?.targetPos;
  if (!tp) return;

  const rt = act.payload?.resourceType || 'food_lq';

  // Medicine bypasses inventory-full check (it's a status cure, not an item)
  if (rt !== 'medicine' && agent.inventoryFull()) return;

  if (rt === 'food_hq' || rt === 'food_lq') {
    harvestFood(world, agent, tp);
  } else if (rt === 'water') {
    harvestWater(world, agent, tp);
  } else if (rt === 'wood') {
    harvestWood(world, agent, tp);
  } else if (rt === 'medicine') {
    harvestMedicine(world, agent, tp);
  } else if (rt === 'cactus') {
    harvestCactus(world, agent, tp);
  }
}

function harvestFood(world: World, agent: Agent, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const block = world.grid.foodBlocks.get(k);
  if (block && block.units > 0) {
    block.units--;
    agent.addToInventory('food', 1);
    agent.addXp(XP_PER_HARVEST);
    log(world, 'harvest', `${agent.name} harvested food`, agent.id, { x: tp.x, y: tp.y });
    if (block.units <= 0) world.grid.foodBlocks.delete(k);
    checkLevelUp(world, agent);
    return;
  }
  // Fallback: harvest seedling as low-quality food
  const seedling = world.grid.seedlings.get(k);
  if (seedling) {
    world.grid.seedlings.delete(k);
    agent.addToInventory('food', 1);
    agent.addXp(XP_PER_HARVEST);
    log(world, 'harvest', `${agent.name} harvested seedling`, agent.id, { x: tp.x, y: tp.y });
    checkLevelUp(world, agent);
  }
}

function harvestWater(world: World, agent: Agent, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const block = world.grid.waterBlocks.get(k);
  if (!block || block.units <= 0) return;
  block.units--;
  agent.addToInventory('water', 1);
  agent.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${agent.name} harvested water`, agent.id, { x: tp.x, y: tp.y });

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
    log(world, 'info', `Water block shrunk @${keepCell.x},${keepCell.y}`, null, {});
  }
  checkLevelUp(world, agent);
}

function harvestWood(world: World, agent: Agent, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const tree = world.grid.treeBlocks.get(k);
  if (!tree || tree.units <= 0) return;
  tree.units--;
  agent.addToInventory('wood', 1);
  agent.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${agent.name} harvested wood`, agent.id, { x: tp.x, y: tp.y });

  // Roll for seedling (10%) or fruit (5%) — variant-specific
  const roll = Math.random();
  if (roll < TREE_SEEDLING_CHANCE_ON_HARVEST) {
    Spawner.trySpawnSeedling(world, tree.x, tree.y, tree.variant);
  } else if (roll < TREE_SEEDLING_CHANCE_ON_HARVEST + TREE_FOOD_CHANCE_ON_HARVEST) {
    if (tree.variant === 'tropical') {
      let nearby = 0;
      for (const [, fb] of world.foodBlocks) {
        if (manhattan(tree.x, tree.y, fb.x, fb.y) <= COCONUT_RADIUS) nearby++;
      }
      if (nearby < COCONUT_CAP_PER_TREE) {
        Spawner.trySpawnFruitNearTree(world, tree.x, tree.y, COCONUT_EMOJI);
      }
    } else if (tree.variant === 'regular') {
      const emoji = TREE_FRUIT_EMOJIS[Math.floor(Math.random() * TREE_FRUIT_EMOJIS.length)];
      Spawner.trySpawnFruitNearTree(world, tree.x, tree.y, emoji);
    }
    // Evergreen: no fruit
  }

  if (tree.units <= 0) {
    world.grid.treeBlocks.delete(k);
    world.deadMarkers.push({ cellX: tree.x, cellY: tree.y, cause: 'tree', msRemaining: 10000 });
  }
  checkLevelUp(world, agent);
}

function harvestMedicine(world: World, agent: Agent, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const block = world.grid.medicineBlocks.get(k);
  if (!block) return;
  if (!agent.diseased) return; // no benefit if healthy
  world.grid.medicineBlocks.delete(k);
  agent.diseased = false;
  agent.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${agent.name} used medicine to cure disease`, agent.id, { x: tp.x, y: tp.y });
  checkLevelUp(world, agent);
}

function harvestCactus(world: World, agent: Agent, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const cactus = world.grid.cactusBlocks.get(k);
  if (!cactus || cactus.units <= 0) return;
  cactus.units--;
  agent.addToInventory('water', 1);
  agent.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${agent.name} harvested water from cactus`, agent.id, { x: tp.x, y: tp.y });
  if (cactus.units <= 0) {
    world.grid.cactusBlocks.delete(k);
  }
  checkLevelUp(world, agent);
}

// ── Pickup ──

export function onPickupComplete(world: World, agent: Agent): void {
  const act = agent.action!;
  const tp = act.payload?.targetPos;
  if (!tp) return;
  const k = key(tp.x, tp.y);
  const bag = world.grid.lootBags.get(k);
  if (!bag) return;
  const types = ['food', 'water', 'wood'] as const;
  for (const rt of types) {
    if (bag.inventory[rt] <= 0) continue;
    const added = agent.addToInventory(rt, bag.inventory[rt]);
    bag.inventory[rt] -= added;
  }
  const remaining = bag.inventory.food + bag.inventory.water + bag.inventory.wood;
  if (remaining <= 0) {
    world.grid.lootBags.delete(k);
  }
  log(world, 'loot', `${agent.name} picked up loot`, agent.id, { x: tp.x, y: tp.y });
}

// ── Deposit ──

export function onDepositComplete(world: World, agent: Agent): void {
  if (!agent.factionId) return;
  const flag = world.grid.flags.get(agent.factionId);
  if (!flag) return;
  const act = agent.action! as IActionState;
  const rt = (act.payload?.resourceType || 'food') as 'food' | 'water' | 'wood';
  const space = FLAG_STORAGE_CAP - flag.storage[rt];
  if (space <= 0) return;
  const amount = act.payload?.amount ?? agent.inventory[rt];
  const actual = Math.min(amount, agent.inventory[rt], space);
  if (actual <= 0) return;
  agent.removeFromInventory(rt, actual);
  flag.storage[rt] += actual;
  log(world, 'share', `${agent.name} deposited ${actual} ${rt}`, agent.id, { resource: rt, amount: actual });
}

// ── Withdraw ──

export function onWithdrawComplete(world: World, agent: Agent): void {
  if (!agent.factionId) return;
  const flag = world.grid.flags.get(agent.factionId);
  if (!flag) return;
  const act = agent.action! as IActionState;
  const rt = (act.payload?.resourceType || 'food') as 'food' | 'water' | 'wood';
  if (flag.storage[rt] <= 0) return;
  const amount = act.payload?.amount ?? flag.storage[rt];
  const actual = agent.addToInventory(rt, Math.min(amount, flag.storage[rt]));
  if (actual <= 0) return;
  flag.storage[rt] -= actual;
  log(world, 'share', `${agent.name} withdrew ${actual} ${rt}`, agent.id, { resource: rt, amount: actual });
}

function checkLevelUp(world: World, agent: Agent): void {
  while (agent.canLevelUp()) {
    agent.levelUp();
    log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
  }
}

