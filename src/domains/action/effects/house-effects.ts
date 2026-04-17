import { GRID_SIZE, HOUSE_TIER_CONFIG, HOUSE_SLEEP_ENERGY_BONUS, HOUSE_DERELICT_EMOJI, HOUSE_RUBBLE_EMOJI } from '../../../core/constants';
import { key, uuid, rndi, log, manhattan } from '../../../core/utils';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';
import type { IHouse, HouseTier, IObstacle } from '../../world/types';

// ── Constants ──
const SLEEP_ENERGY_PER_TICK = 8;
const BUILD_HOUSE_ENERGY_COST = 6;
const XP_PER_BUILD_HOUSE = 20;
const XP_PER_UPGRADE_HOUSE = 15;
const BUILD_INSPIRATION_GAIN = 25;

// ── Tier helpers ──

const TIER_ORDER: HouseTier[] = ['tent', 'house', 'big_house', 'settlement'];

export function getNextTier(current: HouseTier): HouseTier | null {
  const idx = TIER_ORDER.indexOf(current);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

/** Find house by id (deduplicating multi-cell houses). */
export function findHouseById(world: World, id: string): IHouse | null {
  for (const h of world.grid.houses.values()) {
    if (h.id === id) return h;
  }
  return null;
}

/** Find house at a grid cell (null if none). */
export function findHouseAt(world: World, x: number, y: number): IHouse | null {
  return world.grid.houses.get(key(x, y)) ?? null;
}

/** Find the farm a given agent is currently occupying. */
export function findFarmForOccupant(world: World, agentId: string) {
  for (const farm of world.grid.farms.values()) {
    if (farm.occupantId === agentId) return farm;
  }
  return null;
}

/** Register a house's cells on the grid, placing the same object at every key. */
function registerHouseCells(world: World, house: IHouse): void {
  for (const c of house.cells) {
    world.grid.houses.set(key(c.x, c.y), house);
    world.grid.houseCells.add(key(c.x, c.y));
  }
}

/** Remove a house's cells from the grid. */
export function unregisterHouseCells(world: World, house: IHouse): void {
  for (const c of house.cells) {
    world.grid.houses.delete(key(c.x, c.y));
    world.grid.houseCells.delete(key(c.x, c.y));
  }
}

/** Find a free adjacent cell that fits a single-cell footprint, or null. */
function findFreeAdjacent(world: World, cx: number, cy: number): { x: number; y: number } | null {
  const adj: [number, number][] = [
    [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
  ];
  for (const [x, y] of adj) {
    if (x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE && !world.grid.isBlocked(x, y)) {
      return { x, y };
    }
  }
  return null;
}

/**
 * Find a free cell adjacent to (bx, by) that can anchor a 2x2 block,
 * meaning (bx,by), (bx+1,by), (bx,by+1), (bx+1,by+1) are all free.
 * We try all 4 cardinal directions as anchor offsets relative to bx,by.
 */
function findFree2x2Adjacent(world: World, bx: number, by: number): { x: number; y: number } | null {
  // offsets: anchor corner that is adjacent to (bx,by)
  const anchors: [number, number][] = [
    [bx + 1, by], [bx, by + 1], [bx - 1, by - 1], [bx + 1, by - 1],
    [bx - 1, by], [bx, by - 1], [bx + 1, by + 1], [bx - 1, by + 1],
  ];
  for (const [ax, ay] of anchors) {
    const cells: [number, number][] = [
      [ax, ay], [ax + 1, ay], [ax, ay + 1], [ax + 1, ay + 1],
    ];
    if (cells.every(([x, y]) =>
      x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE && !world.grid.isBlocked(x, y)
    )) {
      return { x: ax, y: ay };
    }
  }
  return null;
}

// ── Build house ──

export function onBuildHouseComplete(world: World, agent: Agent): void {
  const cfg = HOUSE_TIER_CONFIG.tent;
  if (agent.inventory.wood < cfg.woodCost || agent.energy < BUILD_HOUSE_ENERGY_COST) return;

  const pos = findFreeAdjacent(world, agent.cellX, agent.cellY);
  if (!pos) return;

  agent.removeFromInventory('wood', cfg.woodCost);
  agent.drainEnergy(BUILD_HOUSE_ENERGY_COST);

  const house: IHouse = {
    id: uuid(),
    x: pos.x,
    y: pos.y,
    tier: 'tent',
    emoji: cfg.emoji,
    hp: cfg.hp,
    maxHp: cfg.hp,
    capacity: cfg.capacity,
    size: '1x1',
    cells: [{ x: pos.x, y: pos.y }],
    ownerId: agent.id,
    familyName: agent.familyName,
    occupantIds: [],
    decayTimerMs: rndi(50_000, 70_000),
  };

  registerHouseCells(world, house);
  agent.rememberResource('shelter', pos.x, pos.y, world.tick);
  agent.addXp(XP_PER_BUILD_HOUSE);
  agent.inspiration = Math.min(100, agent.inspiration + BUILD_INSPIRATION_GAIN);
  log(world, 'housing', `${agent.name} built a tent`, agent.id, { x: pos.x, y: pos.y });
  world.events.emit('house:built', { house, agent });
  checkLevelUp(world, agent);
}

// ── Upgrade house ──

export function onUpgradeHouseComplete(world: World, agent: Agent): void {
  const tp = agent.action?.payload?.targetPos;
  if (!tp) return;

  const house = findHouseAt(world, tp.x, tp.y);
  if (!house || house.ownerId !== agent.id) return;

  const nextTier = getNextTier(house.tier);
  if (!nextTier) return;

  const nextCfg = HOUSE_TIER_CONFIG[nextTier];
  if (agent.inventory.wood < nextCfg.woodCost) return;

  // Handle 1x1 -> 2x2 expansion
  if (nextCfg.size === '2x2' && house.size === '1x1') {
    const anchor = findFree2x2Adjacent(world, house.x, house.y);
    if (!anchor) return; // blocked, abort without cost

    agent.removeFromInventory('wood', nextCfg.woodCost);

    // Remove old cell registrations
    unregisterHouseCells(world, house);

    // Update house in-place (same object — all grid refs will update)
    house.tier = nextTier;
    house.emoji = nextCfg.emoji;
    house.maxHp = nextCfg.hp;
    house.hp = nextCfg.hp;
    house.capacity = nextCfg.capacity;
    house.size = '2x2';
    house.x = anchor.x;
    house.y = anchor.y;
    house.cells = [
      { x: anchor.x, y: anchor.y },
      { x: anchor.x + 1, y: anchor.y },
      { x: anchor.x, y: anchor.y + 1 },
      { x: anchor.x + 1, y: anchor.y + 1 },
    ];
    house.decayTimerMs = rndi(50_000, 70_000);

    registerHouseCells(world, house);
  } else {
    // 1x1 -> 1x1 or 2x2 -> 2x2 upgrade
    agent.removeFromInventory('wood', nextCfg.woodCost);
    house.tier = nextTier;
    house.emoji = nextCfg.emoji;
    house.maxHp = nextCfg.hp;
    house.hp = nextCfg.hp;
    house.capacity = nextCfg.capacity;
    house.decayTimerMs = rndi(50_000, 70_000);
  }

  agent.addXp(XP_PER_UPGRADE_HOUSE);
  log(world, 'housing', `${agent.name} upgraded house to ${nextTier.replace('_', ' ')}`, agent.id, {});
  world.events.emit('house:upgraded', { house, agent });
  checkLevelUp(world, agent);
}

// ── Enter house (also handles farm shelter) ──

export function onEnterHouseComplete(world: World, agent: Agent): void {
  const tp = agent.action?.payload?.targetPos;
  if (!tp) return;

  const house = findHouseAt(world, tp.x, tp.y);
  if (house) {
    if (house.occupantIds.length >= house.capacity) return;
    // Access: owner family or vacant house
    if (house.ownerId && house.familyName !== agent.familyName && house.familyName !== '') return;

    house.occupantIds.push(agent.id);
    agent.houseId = house.id;
    agent.isInsideHouse = true;

    const k = key(agent.cellX, agent.cellY);
    if (world.grid.agentsByCell.get(k) === agent.id) {
      world.grid.agentsByCell.delete(k);
    }

    agent.rememberResource('shelter', house.x, house.y, world.tick);
    log(world, 'housing', `${agent.name} entered shelter`, agent.id, { houseId: house.id });
    return;
  }

  // Farm shelter variant
  const farm = world.grid.farms.get(key(tp.x, tp.y));
  if (!farm) return;
  if (farm.occupantId !== null) return; // already occupied

  farm.occupantId = agent.id;
  agent.houseId = `farm:${farm.id}`;
  agent.isInsideHouse = true;

  const k = key(agent.cellX, agent.cellY);
  if (world.grid.agentsByCell.get(k) === agent.id) {
    world.grid.agentsByCell.delete(k);
  }

  log(world, 'housing', `${agent.name} took shelter in a farm`, agent.id, {});
}

// ── Exit house ──

export function onExitHouseComplete(world: World, agent: Agent): void {
  if (!agent.houseId) return;

  if (agent.houseId.startsWith('farm:')) {
    _exitFarm(world, agent);
    return;
  }

  const house = findHouseById(world, agent.houseId);
  if (house) {
    const idx = house.occupantIds.indexOf(agent.id);
    if (idx >= 0) house.occupantIds.splice(idx, 1);

    const exitPos = findFreeAdjacent(world, house.x, house.y) ??
      { x: house.x, y: house.y > 0 ? house.y - 1 : house.y + 1 };
    agent.cellX = exitPos.x;
    agent.cellY = exitPos.y;
    agent.prevCellX = exitPos.x;
    agent.prevCellY = exitPos.y;
    world.grid.agentsByCell.set(key(exitPos.x, exitPos.y), agent.id);
  }

  agent.houseId = null;
  agent.isInsideHouse = false;
  log(world, 'housing', `${agent.name} left shelter`, agent.id, {});
}

function _exitFarm(world: World, agent: Agent): void {
  const farm = findFarmForOccupant(world, agent.id);
  if (farm) {
    farm.occupantId = null;
    const exitPos = findFreeAdjacent(world, farm.x, farm.y) ??
      { x: farm.x, y: farm.y > 0 ? farm.y - 1 : farm.y + 1 };
    agent.cellX = exitPos.x;
    agent.cellY = exitPos.y;
    agent.prevCellX = exitPos.x;
    agent.prevCellY = exitPos.y;
    world.grid.agentsByCell.set(key(exitPos.x, exitPos.y), agent.id);
  }
  agent.houseId = null;
  agent.isInsideHouse = false;
  log(world, 'housing', `${agent.name} left the farm`, agent.id, {});
}

// ── Sleep in house ──

export function onSleepInHouseTick(_world: World, agent: Agent): void {
  agent.addEnergy(SLEEP_ENERGY_PER_TICK * HOUSE_SLEEP_ENERGY_BONUS);
}

export function onSleepInHouseComplete(world: World, agent: Agent): void {
  log(world, 'sleep', `${agent.name} woke up (sheltered)`, agent.id, {});
}

// ── Evict all occupants from a house (called on destruction) ──

export function evictOccupants(world: World, house: IHouse): void {
  const houseX = house.x;
  const houseY = house.y;
  for (const agentId of [...house.occupantIds]) {
    const agent = world.agentsById.get(agentId);
    if (!agent) continue;

    const exitPos = findFreeAdjacent(world, houseX, houseY) ??
      { x: houseX, y: houseY > 0 ? houseY - 1 : houseY + 1 };
    agent.cellX = exitPos.x;
    agent.cellY = exitPos.y;
    agent.prevCellX = exitPos.x;
    agent.prevCellY = exitPos.y;
    world.grid.agentsByCell.set(key(exitPos.x, exitPos.y), agentId);
    agent.houseId = null;
    agent.isInsideHouse = false;
  }
  house.occupantIds = [];
}

// ── Place rubble after house destruction ──

export function placeHouseRubble(world: World, house: IHouse): void {
  const isSmallest = house.tier === 'tent';
  const emoji = isSmallest ? HOUSE_RUBBLE_EMOJI : HOUSE_DERELICT_EMOJI;
  const rubble: IObstacle = {
    id: uuid(),
    x: house.x,
    y: house.y,
    emoji,
    category: 'wood',
    hp: isSmallest ? 5 : 10,
    maxHp: isSmallest ? 5 : 10,
  };
  world.grid.obstacles.set(key(house.x, house.y), rubble);
}

// ── Level-up check ──

function checkLevelUp(world: World, agent: Agent): void {
  while (agent.canLevelUp()) {
    agent.levelUp();
    log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
  }
}
