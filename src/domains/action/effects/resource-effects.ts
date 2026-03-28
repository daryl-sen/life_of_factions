import { key, log } from '../../../core/utils';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';
import type { IActionState } from '../types';

// ── Constants ──
const XP_PER_HARVEST = 2;
const WATER_SHRINK_THRESHOLD = 0.25;
const TREE_SEEDLING_CHANCE_ON_HARVEST = 0.10;
const TREE_FOOD_CHANCE_ON_HARVEST = 0.05;
const TREE_FOOD_REQUIRES_POOP_RADIUS = 3;
const FLAG_STORAGE_CAP = 30;

// ── Harvest ──

export function onHarvestComplete(world: World, agent: Agent): void {
  const act = agent.action!;
  const tp = act.payload?.targetPos;
  if (!tp) return;
  if (agent.inventoryFull()) return;

  const rt = act.payload?.resourceType || 'food_lq';

  if (rt === 'food_hq' || rt === 'food_lq') {
    harvestFood(world, agent, tp);
  } else if (rt === 'water') {
    harvestWater(world, agent, tp);
  } else if (rt === 'wood') {
    harvestWood(world, agent, tp);
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

  // Roll for seedling (10%) or food (5%)
  const roll = Math.random();
  if (roll < TREE_SEEDLING_CHANCE_ON_HARVEST) {
    world.events.emit('harvest:seedling-chance', { x: tree.x, y: tree.y });
  } else if (roll < TREE_SEEDLING_CHANCE_ON_HARVEST + TREE_FOOD_CHANCE_ON_HARVEST) {
    world.events.emit('harvest:food-chance', { x: tree.x, y: tree.y, poopRadius: TREE_FOOD_REQUIRES_POOP_RADIUS });
  }

  if (tree.units <= 0) {
    world.grid.treeBlocks.delete(k);
    world.deadMarkers.push({ cellX: tree.x, cellY: tree.y, cause: 'tree', msRemaining: 10000 });
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
