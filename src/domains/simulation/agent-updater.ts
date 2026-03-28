import { GRID_SIZE, TICK_MS } from '../../core/constants';
import type { ResourceMemoryType } from '../../core/types';
import { key, manhattan, rndi, log } from '../../core/utils';
import { findPath, findNearest, planPath } from '../../core/pathfinding';
import type { World } from '../world/world';
import type { Agent } from '../entity/agent';
import { AgentFactory } from '../entity/agent-factory';
import { FoodField } from '../world/food-field';
import { WaterField } from '../world/water-field';
import { ActionFactory } from '../action/action-factory';
import { ActionProcessor } from '../action/action-processor';
import { DecisionEngine } from '../decision/decision-engine';
import { ContextBuilder } from '../decision/context-builder';

// ── Inlined TUNE constants ──

const PASSIVE_ENERGY_DRAIN = 0.0625;
const FULLNESS_PASSIVE_DECAY = 0.03;
const INSPIRATION_PASSIVE_DECAY = 0.015;
const SOCIAL_PASSIVE_DECAY = 0.01;

const ENERGY_LOW_THRESHOLD = 40;

const MOVE_ENERGY = 0.12;
const FULLNESS_MOVE_DECAY = 0.10;
const HYGIENE_MOVE_DECAY = 0.05;
const HYGIENE_STEP_ON_POOP_DECAY = 5;

const FULLNESS_SEEK_THRESHOLD = 40;
const FULLNESS_CRITICAL_THRESHOLD = 20;
const FULLNESS_REGEN_THRESHOLD = 70;
const HYGIENE_SEEK_THRESHOLD = 40;
const INSPIRATION_SEEK_THRESHOLD = 40;

const POOP_CHANCE_PER_TICK = 0.10;

const STARVE_HP_PER_SEC = 1.0;
const REGEN_HP_PER_SEC = 0.5;

const DISEASE_HP_DRAIN_PER_SEC = 0.3;
const DISEASE_CURE_HYGIENE_THRESHOLD = 80;
const DISEASE_CONTRACTION_THRESHOLD = 20;
const DISEASE_CONTRACTION_CHANCE = 0.05;

const VISION_RANGE = 10;

const FARM_WOOD_COST = 3;
const FARM_ENERGY_COST = 6;

const MANDATORY_SLEEP_THRESHOLD = 20;
const CRITICAL_HEALTH_PCT = 0.3;
const CRITICAL_FULLNESS_THRESHOLD = 20;
const CRITICAL_HYGIENE_THRESHOLD = 20;

// ── Helper ──

function findAdjacentOpen(
  world: World, cx: number, cy: number, selfId: string
): { x: number; y: number } | null {
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (!world.grid.isBlocked(nx, ny, selfId)) return { x: nx, y: ny };
  }
  return null;
}

// ── Budget-aware path planning (wraps core planPath) ──

function agentPlanPath(world: World, agent: Agent, gx: number, gy: number): void {
  const budget = { remaining: world.pathBudget };
  planPath(
    { isBlocked: (x, y) => world.grid.isBlockedTerrain(x, y), isOccupied: () => false, width: GRID_SIZE, height: GRID_SIZE },
    agent,
    gx, gy,
    world.tick,
    budget,
    world._pathWhitelist
  );
  world.pathBudget = budget.remaining;
}

// ── Inline ActionFactory.tryStart (old API compat) ──

function tryStartAction(agent: Agent, type: Parameters<typeof ActionFactory.create>[0], payload?: Parameters<typeof ActionFactory.create>[2]): boolean {
  if (agent.action) return false;
  agent.action = ActionFactory.create(type, agent, payload ?? undefined);
  return true;
}

// ── Inline ActionFactory.createHarvest (old API compat) ──

function createHarvestAction(agent: Agent, resourceType: string, targetPos: { x: number; y: number }): void {
  agent.action = ActionFactory.create('harvest', agent, { targetPos, resourceType });
}

// ── Biased roaming (inline of old RoamingStrategy.biasedRoam) ──

function biasedRoam(world: World, agent: Agent): void {
  const range = 6;
  const candidates: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const rx = Math.max(0, Math.min(GRID_SIZE - 1, agent.cellX + rndi(-range, range)));
    const ry = Math.max(0, Math.min(GRID_SIZE - 1, agent.cellY + rndi(-range, range)));
    if (!world.grid.isBlocked(rx, ry, agent.id)) candidates.push({ x: rx, y: ry });
  }
  if (!candidates.length) return;
  const choice = candidates[rndi(0, candidates.length - 1)];
  agentPlanPath(world, agent, choice.x, choice.y);
}

// ── Inline InteractionEngine.consider (priority hierarchy) ──

function interactionConsider(world: World, agent: Agent): void {
  // Babies can only eat/drink from inventory
  if (agent.babyMsRemaining > 0) {
    if (agent.fullness < FULLNESS_SEEK_THRESHOLD && agent.inventory.food > 0) {
      tryStartAction(agent, 'eat');
    } else if (agent.hygiene < HYGIENE_SEEK_THRESHOLD && agent.inventory.water > 0) {
      tryStartAction(agent, 'wash');
    }
    return;
  }

  // 1. Mandatory sleep
  if (agent.energy < MANDATORY_SLEEP_THRESHOLD) {
    if (tryStartAction(agent, 'sleep')) return;
  }

  // 2. Under attack — handled by DecisionEngine (flee/retaliate)

  // 3. Critical health — seek faction flag for aura healing
  if (agent.health < agent.maxHealth * CRITICAL_HEALTH_PCT) {
    if (agent.factionId) {
      const flag = world.flags.get(agent.factionId);
      if (flag && manhattan(agent.cellX, agent.cellY, flag.x, flag.y) > 2) {
        agentPlanPath(world, agent, flag.x, flag.y);
        if (agent.path && agent.path.length > 0) return;
      }
    }
  }

  // 4. Critical fullness
  if (agent.fullness < CRITICAL_FULLNESS_THRESHOLD) {
    if (agent.inventory.food > 0) {
      tryStartAction(agent, 'eat');
      return;
    }
    return;
  }

  // 5. Critical hygiene
  if (agent.hygiene < CRITICAL_HYGIENE_THRESHOLD) {
    if (agent.inventory.water > 0) {
      tryStartAction(agent, 'wash');
      return;
    }
    return;
  }

  // 6. Voluntary sleep
  if (agent.energy < ENERGY_LOW_THRESHOLD) {
    if (tryStartAction(agent, 'sleep')) return;
  }
}

// ── Vision scan ──

function scanVision(world: World, agent: Agent): void {
  const range = VISION_RANGE;
  const x0 = Math.max(0, agent.cellX - range);
  const x1 = Math.min(GRID_SIZE - 1, agent.cellX + range);
  const y0 = Math.max(0, agent.cellY - range);
  const y1 = Math.min(GRID_SIZE - 1, agent.cellY + range);

  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (manhattan(agent.cellX, agent.cellY, x, y) > range) continue;
      const k = key(x, y);
      if (world.foodBlocks.has(k) || world.seedlings.has(k)) {
        agent.rememberResource('food', x, y, world.tick);
      }
      if (world.waterBlocks.has(k)) {
        agent.rememberResource('water', x, y, world.tick);
      }
      if (world.treeBlocks.has(k)) {
        agent.rememberResource('wood', x, y, world.tick);
      }
    }
  }
}

// ── Seek from memory ──

function seekFromMemory(world: World, agent: Agent, type: ResourceMemoryType): boolean {
  const entries = agent.resourceMemory.get(type)!;
  if (entries.length === 0) return false;

  let bestEntry: { x: number; y: number; tick: number } | null = null;
  let bestDist = Infinity;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const k = key(e.x, e.y);
    let stillExists = false;
    if (type === 'food') {
      stillExists = world.foodBlocks.has(k) || world.seedlings.has(k);
    } else if (type === 'water') {
      stillExists = world.waterBlocks.has(k);
    } else {
      stillExists = world.treeBlocks.has(k);
    }
    if (!stillExists) {
      entries.splice(i, 1);
      continue;
    }
    const d = manhattan(agent.cellX, agent.cellY, e.x, e.y);
    if (d < bestDist) {
      bestDist = d;
      bestEntry = e;
    }
  }

  if (!bestEntry) return false;
  const target = bestEntry;
  if (type === 'water') {
    const adjCells: [number, number][] = [
      [target.x + 1, target.y], [target.x - 1, target.y],
      [target.x, target.y + 1], [target.x, target.y - 1],
    ];
    for (const [ax, ay] of adjCells) {
      if (ax < 0 || ay < 0 || ax >= GRID_SIZE || ay >= GRID_SIZE) continue;
      if (!world.grid.isBlocked(ax, ay, agent.id)) {
        agentPlanPath(world, agent,ax, ay);
        return agent.path !== null && agent.path.length > 0;
      }
    }
    return false;
  }
  agentPlanPath(world, agent,target.x, target.y);
  return agent.path !== null && agent.path.length > 0;
}

// ── Food field step ──

function stepTowardFood(world: World, agent: Agent): boolean {
  const here = world.foodField.distanceAt(agent.cellX, agent.cellY);
  if (here === FoodField.INF) return false;
  let best = { d: here, x: agent.cellX, y: agent.cellY };
  const adj: [number, number][] = [
    [agent.cellX + 1, agent.cellY],
    [agent.cellX - 1, agent.cellY],
    [agent.cellX, agent.cellY + 1],
    [agent.cellX, agent.cellY - 1],
  ];
  for (const [nx, ny] of adj) {
    if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
    if (world.grid.isBlocked(nx, ny, agent.id)) continue;
    const d = world.foodField.distanceAt(nx, ny);
    if (d < best.d) best = { d, x: nx, y: ny };
  }
  if (best.x === agent.cellX && best.y === agent.cellY) return false;
  agent.path = [{ x: best.x, y: best.y }];
  agent.pathIdx = 0;
  agent.goal = null;
  return true;
}

// ── Water field step ──

function stepTowardWater(world: World, agent: Agent): boolean {
  const here = world.waterField.distanceAt(agent.cellX, agent.cellY);
  if (here === WaterField.INF) return false;
  let best = { d: here, x: agent.cellX, y: agent.cellY };
  const adj: [number, number][] = [
    [agent.cellX + 1, agent.cellY],
    [agent.cellX - 1, agent.cellY],
    [agent.cellX, agent.cellY + 1],
    [agent.cellX, agent.cellY - 1],
  ];
  for (const [nx, ny] of adj) {
    if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
    if (world.grid.isBlocked(nx, ny, agent.id)) continue;
    const d = world.waterField.distanceAt(nx, ny);
    if (d < best.d) best = { d, x: nx, y: ny };
  }
  if (best.x === agent.cellX && best.y === agent.cellY) return false;
  agent.path = [{ x: best.x, y: best.y }];
  agent.pathIdx = 0;
  agent.goal = null;
  return true;
}

// ── Food seeking ──

function seekFoodWhenHungry(world: World, agent: Agent): void {
  // 1. Eat from inventory
  if (agent.inventory.food > 0) {
    tryStartAction(agent,'eat');
    return;
  }

  // 2. Harvest nearby food block
  if (!agent.inventoryFull()) {
    const nearby: [number, number][] = [
      [agent.cellX, agent.cellY],
      [agent.cellX + 1, agent.cellY],
      [agent.cellX - 1, agent.cellY],
      [agent.cellX, agent.cellY + 1],
      [agent.cellX, agent.cellY - 1],
    ];
    for (const [nx, ny] of nearby) {
      const k = key(nx, ny);
      const block = world.foodBlocks.get(k);
      if (block && block.units > 0 && !world.flagCells.has(k)) {
        const resourceType = block.quality === 'hq' ? 'food_hq' : 'food_lq';
        if (!agent.action) {
          createHarvestAction(agent, resourceType, { x: nx, y: ny });
          return;
        }
      }
      if (world.seedlings.has(k) && !agent.action) {
        createHarvestAction(agent, 'food_lq', { x: nx, y: ny });
        return;
      }
    }
  }

  // 3. Look within vision range
  const vr = VISION_RANGE;
  let closestFood: { x: number; y: number; d: number } | null = null;
  for (let dx = -vr; dx <= vr; dx++) {
    for (let dy = -vr; dy <= vr; dy++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d > vr) continue;
      const fx = agent.cellX + dx;
      const fy = agent.cellY + dy;
      if (fx < 0 || fy < 0 || fx >= GRID_SIZE || fy >= GRID_SIZE) continue;
      const k = key(fx, fy);
      const block = world.foodBlocks.get(k);
      if ((block && block.units > 0 && !world.flagCells.has(k)) || world.seedlings.has(k)) {
        if (!closestFood || d < closestFood.d) {
          closestFood = { x: fx, y: fy, d };
        }
      }
    }
  }
  if (closestFood) {
    agentPlanPath(world, agent,closestFood.x, closestFood.y);
    if (agent.path && agent.path.length > 0) return;
  }

  // 4. Resource memory
  if (seekFromMemory(world, agent, 'food')) return;

  // 5. Full pathfind (global)
  if (world.tick - world.foodField.lastTick >= 5) {
    world.foodField.recompute(world.grid, world.tick);
  }
  const scarcity = world.foodBlocks.size / Math.max(1, world.agents.length);
  if (scarcity < 0.35) {
    if (stepTowardFood(world, agent)) return;
  }
  const filtered = [...world.foodBlocks.values()].filter(
    (c) => c.units > 0 && !world.flagCells.has(key(c.x, c.y))
  );
  if (filtered.length) {
    const near = findNearest({ x: agent.cellX, y: agent.cellY },filtered);
    if (near) {
      agentPlanPath(world, agent,near.target.x, near.target.y);
      if (agent.path && agent.path.length > 0) return;
    }
  }

  // 6. Wander
  biasedRoam(world, agent);
}

// ── Water seeking ──

function seekWaterWhenThirsty(world: World, agent: Agent): void {
  // 1. Drink from inventory
  if (agent.inventory.water > 0) {
    tryStartAction(agent,'wash');
    return;
  }

  // 2. Harvest nearby water
  if (!agent.inventoryFull()) {
    const nearby: [number, number][] = [
      [agent.cellX, agent.cellY],
      [agent.cellX + 1, agent.cellY],
      [agent.cellX - 1, agent.cellY],
      [agent.cellX, agent.cellY + 1],
      [agent.cellX, agent.cellY - 1],
    ];
    for (const [nx, ny] of nearby) {
      const k = key(nx, ny);
      const block = world.waterBlocks.get(k);
      if (block && block.units > 0) {
        if (!agent.action) {
          createHarvestAction(agent, 'water', { x: nx, y: ny });
          return;
        }
      }
    }
  }

  // 3. Vision range
  const vr = VISION_RANGE;
  let closestWater: { x: number; y: number; d: number } | null = null;
  for (let dx = -vr; dx <= vr; dx++) {
    for (let dy = -vr; dy <= vr; dy++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d > vr) continue;
      const wx = agent.cellX + dx;
      const wy = agent.cellY + dy;
      if (wx < 0 || wy < 0 || wx >= GRID_SIZE || wy >= GRID_SIZE) continue;
      const block = world.waterBlocks.get(key(wx, wy));
      if (block && block.units > 0) {
        if (!closestWater || d < closestWater.d) {
          closestWater = { x: wx, y: wy, d };
        }
      }
    }
  }
  if (closestWater) {
    const adjCells: [number, number][] = [
      [closestWater.x + 1, closestWater.y], [closestWater.x - 1, closestWater.y],
      [closestWater.x, closestWater.y + 1], [closestWater.x, closestWater.y - 1],
    ];
    for (const [ax, ay] of adjCells) {
      if (ax < 0 || ay < 0 || ax >= GRID_SIZE || ay >= GRID_SIZE) continue;
      if (!world.grid.isBlocked(ax, ay, agent.id)) {
        agentPlanPath(world, agent,ax, ay);
        if (agent.path && agent.path.length > 0) return;
      }
    }
  }

  // 4. Resource memory
  if (seekFromMemory(world, agent, 'water')) return;

  // 5. Full pathfind (global)
  if (world.tick - world.waterField.lastTick >= 5) {
    world.waterField.recompute(world.grid, world.tick);
  }
  if (stepTowardWater(world, agent)) return;

  // Fallback: pathfind to nearest water
  const seen = new Set<string>();
  const waterPositions: Array<{ x: number; y: number }> = [];
  for (const wb of world.waterBlocks.values()) {
    if (seen.has(wb.id)) continue;
    seen.add(wb.id);
    for (const c of wb.cells) {
      const adjWater: [number, number][] = [
        [c.x + 1, c.y], [c.x - 1, c.y],
        [c.x, c.y + 1], [c.x, c.y - 1],
      ];
      for (const [ax, ay] of adjWater) {
        if (ax < 0 || ay < 0 || ax >= GRID_SIZE || ay >= GRID_SIZE) continue;
        if (!world.grid.isBlocked(ax, ay, agent.id)) {
          waterPositions.push({ x: ax, y: ay });
        }
      }
    }
  }
  if (waterPositions.length) {
    const near = findNearest({ x: agent.cellX, y: agent.cellY },waterPositions);
    if (near) {
      agentPlanPath(world, agent,near.target.x, near.target.y);
      if (agent.path && agent.path.length > 0) return;
    }
  }

  // 6. Wander
  biasedRoam(world, agent);
}

// ── Opportunistic harvests ──

function tryHarvestAdjacentFood(world: World, agent: Agent): boolean {
  if (agent.inventoryFull()) return false;
  const adj: [number, number][] = [
    [agent.cellX, agent.cellY],
    [agent.cellX + 1, agent.cellY],
    [agent.cellX - 1, agent.cellY],
    [agent.cellX, agent.cellY + 1],
    [agent.cellX, agent.cellY - 1],
  ];
  for (const [nx, ny] of adj) {
    const k = key(nx, ny);
    const block = world.foodBlocks.get(k);
    if (block && block.units > 0 && !world.flagCells.has(k)) {
      if (!agent.action) {
        const resourceType = block.quality === 'hq' ? 'food_hq' : 'food_lq';
        createHarvestAction(agent, resourceType, { x: nx, y: ny });
        return true;
      }
    }
    if (world.seedlings.has(k)) {
      if (!agent.action) {
        createHarvestAction(agent, 'food_lq', { x: nx, y: ny });
        return true;
      }
    }
  }
  return false;
}

function tryHarvestAdjacentWood(world: World, agent: Agent): boolean {
  if (agent.inventoryFull()) return false;
  const adj: [number, number][] = [
    [agent.cellX, agent.cellY],
    [agent.cellX + 1, agent.cellY],
    [agent.cellX - 1, agent.cellY],
    [agent.cellX, agent.cellY + 1],
    [agent.cellX, agent.cellY - 1],
  ];
  for (const [nx, ny] of adj) {
    const k = key(nx, ny);
    const tree = world.treeBlocks.get(k);
    if (tree && tree.units > 0) {
      if (!agent.action) {
        createHarvestAction(agent, 'wood', { x: nx, y: ny });
        return true;
      }
    }
  }
  return false;
}

// ── Main Agent Update ──

export class AgentUpdater {

  static update(world: World, agent: Agent): void {
    agent.ageTicks++;

    // Passive drains (pregnancy increases fullness decay by 50%)
    agent.energy -= PASSIVE_ENERGY_DRAIN;
    agent.drainFullness(FULLNESS_PASSIVE_DECAY * agent.fullnessDecayMult);
    agent.inspiration = Math.max(0, agent.inspiration - INSPIRATION_PASSIVE_DECAY);
    agent.social = Math.max(0, agent.social - SOCIAL_PASSIVE_DECAY);

    // Poop timer
    if (agent.poopTimerMs > 0) agent.poopTimerMs -= TICK_MS;

    // Lock timer
    agent.lockMsRemaining = Math.max(0, (agent.lockMsRemaining || 0) - TICK_MS);

    // Baby timer
    if (agent.babyMsRemaining > 0) {
      agent.babyMsRemaining = Math.max(0, agent.babyMsRemaining - TICK_MS);
    }

    // Pregnancy timer
    if (agent.pregnancy.active) {
      const birth = agent.pregnancy.tick(TICK_MS);
      if (birth) {
        AgentUpdater._handleBirth(world, agent);
      }
    }

    // Cancel non-essential actions when energy is low
    if (agent.energy < ENERGY_LOW_THRESHOLD) {
      if (agent.action &&
        agent.action.type !== 'attack' &&
        agent.action.type !== 'sleep' &&
        agent.action.type !== 'harvest' &&
        agent.action.type !== 'eat' &&
        agent.action.type !== 'wash' &&
        agent.action.type !== 'deposit' &&
        agent.action.type !== 'withdraw' &&
        agent.action.type !== 'pickup' &&
        agent.action.type !== 'poop' &&
        agent.action.type !== 'clean' &&
        agent.action.type !== 'play' &&
        agent.action.type !== 'build_farm'
      ) {
        agent.action = null;
      }
    }

    // ── Action processing or movement/decision ──

    if (agent.action) {
      ActionProcessor.process(world, agent, TICK_MS);
    } else {
      const locked = agent.lockMsRemaining > 0 && !agent._underAttack;
      if (!locked) {
        // ── Path following ──
        if (agent.path && agent.pathIdx < agent.path.length) {
          const step = agent.path[agent.pathIdx];
          if (world.grid.isBlockedTerrain(step.x, step.y)) {
            agent.path = null;
          } else {
            const cellKey = key(step.x, step.y);
            const occupant = world.grid.agentsByCell.get(cellKey);
            const hasOtherAgent = occupant != null && occupant !== agent.id;
            const isLastStep = agent.pathIdx === agent.path.length - 1;

            let targetX = step.x;
            let targetY = step.y;
            let canMove = true;

            if (hasOtherAgent && isLastStep) {
              const fallback = findAdjacentOpen(world, step.x, step.y, agent.id);
              if (fallback) {
                targetX = fallback.x;
                targetY = fallback.y;
              } else {
                canMove = false;
              }
            }

            if (canMove) {
              agent.prevCellX = agent.cellX;
              agent.prevCellY = agent.cellY;
              agent.lerpT = 0;
              const oldKey = key(agent.cellX, agent.cellY);
              if (world.agentsByCell.get(oldKey) === agent.id) {
                world.agentsByCell.delete(oldKey);
              }
              agent.cellX = targetX;
              agent.cellY = targetY;
              const newKey = key(agent.cellX, agent.cellY);
              const newOccupant = world.agentsByCell.get(newKey);
              if (!newOccupant || newOccupant === agent.id) {
                world.agentsByCell.set(newKey, agent.id);
              }
              agent.pathIdx++;
              agent.energy -= MOVE_ENERGY;
              agent.drainFullness(FULLNESS_MOVE_DECAY);
              agent.hygiene = Math.max(0, agent.hygiene - HYGIENE_MOVE_DECAY);
              if (world.poopBlocks.has(key(agent.cellX, agent.cellY))) {
                agent.hygiene = Math.max(0, agent.hygiene - HYGIENE_STEP_ON_POOP_DECAY);
              }
            } else {
              agent.path = null;
            }
          }
        } else {
          agent.path = null;
        }

        // Ensure stationary agents on unique cell
        if (!agent.path || agent.pathIdx >= agent.path.length) {
          const ck = key(agent.cellX, agent.cellY);
          const occupant = world.agentsByCell.get(ck);
          if (occupant && occupant !== agent.id) {
            const open = findAdjacentOpen(world, agent.cellX, agent.cellY, agent.id);
            if (open) {
              agent.prevCellX = agent.cellX;
              agent.prevCellY = agent.cellY;
              agent.lerpT = 0;
              agent.cellX = open.x;
              agent.cellY = open.y;
              world.agentsByCell.set(key(open.x, open.y), agent.id);
            }
          } else if (!occupant) {
            world.agentsByCell.set(ck, agent.id);
          }
        }

        // Vision scan
        if (!agent.action) {
          scanVision(world, agent);
        }

        // ── Idle decision ──
        if (!agent.path && !agent.action) {
          // Try the new DecisionEngine first for scored action selection
          const candidate = DecisionEngine.decide(agent, ContextBuilder.build(world, agent));
          if (candidate && candidate.actionType !== 'sleep') {
            // For social/combat actions that need a target, wire them up
            if (candidate.targetId) {
              tryStartAction(agent,candidate.actionType, { targetId: candidate.targetId });
            } else if (candidate.targetPos) {
              if (candidate.actionType === 'harvest') {
                const resourceType = (candidate as { resourceType?: string }).resourceType ?? 'food_lq';
                createHarvestAction(agent, resourceType, candidate.targetPos);
              } else {
                tryStartAction(agent,candidate.actionType, { targetPos: candidate.targetPos });
              }
            } else {
              tryStartAction(agent,candidate.actionType);
            }
          }

          // Fall back to InteractionEngine for priority hierarchy (sleep, flee, etc.)
          if (!agent.action && !agent.path) {
            interactionConsider(world, agent);
          }

          // Babies can only eat/drink/move
          if (agent.babyMsRemaining > 0) {
            if (!agent.action && !agent.path) {
              biasedRoam(world, agent);
            }
          } else {

            // Poop trigger
            if (!agent.action && !agent.path && agent.poopTimerMs > 0) {
              if (Math.random() < POOP_CHANCE_PER_TICK) {
                tryStartAction(agent,'poop');
              }
            }

            // If still no action/path, handle seeking
            if (!agent.path && !agent.action) {
              // Withdraw from flag if needing resources and near own flag
              if (!agent.action && agent.factionId && (agent.fullness < FULLNESS_SEEK_THRESHOLD || agent.hygiene < HYGIENE_SEEK_THRESHOLD)) {
                const flag = world.flags.get(agent.factionId);
                if (flag && manhattan(agent.cellX, agent.cellY, flag.x, flag.y) <= 1) {
                  const rt = agent.fullness < FULLNESS_SEEK_THRESHOLD && agent.inventory.food <= 0 && flag.storage.food > 0 ? 'food'
                    : agent.hygiene < HYGIENE_SEEK_THRESHOLD && agent.inventory.water <= 0 && flag.storage.water > 0 ? 'water'
                    : null;
                  if (rt) tryStartAction(agent,'withdraw', { resourceType: rt });
                }
              }

              if (!agent.action && agent.fullness < FULLNESS_SEEK_THRESHOLD) {
                seekFoodWhenHungry(world, agent);
              } else if (!agent.action && agent.hygiene < HYGIENE_SEEK_THRESHOLD) {
                seekWaterWhenThirsty(world, agent);
              } else if (!agent.action) {
                // Opportunistic loot bag pickup
                if (!agent.inventoryFull()) {
                  const bagKey = key(agent.cellX, agent.cellY);
                  if (world.lootBags.has(bagKey)) {
                    tryStartAction(agent,'pickup', { targetPos: { x: agent.cellX, y: agent.cellY } });
                  } else {
                    const adjCells: [number, number][] = [
                      [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
                      [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
                    ];
                    for (const [nx, ny] of adjCells) {
                      const ak = key(nx, ny);
                      if (world.lootBags.has(ak)) {
                        tryStartAction(agent,'pickup', { targetPos: { x: nx, y: ny } });
                        break;
                      }
                    }
                  }
                }

                // Clean adjacent poop
                if (!agent.action && agent.inspiration < 60) {
                  const adjCells2: [number, number][] = [
                    [agent.cellX, agent.cellY],
                    [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
                    [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
                  ];
                  for (const [nx, ny] of adjCells2) {
                    if (world.poopBlocks.has(key(nx, ny))) {
                      tryStartAction(agent,'clean', { targetPos: { x: nx, y: ny } });
                      break;
                    }
                  }
                }

                // Play near interactable block
                if (!agent.action && agent.inspiration < INSPIRATION_SEEK_THRESHOLD) {
                  const adjPlay: [number, number][] = [
                    [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
                    [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
                  ];
                  for (const [nx, ny] of adjPlay) {
                    const ak = key(nx, ny);
                    if (world.foodBlocks.has(ak) || world.waterBlocks.has(ak) || world.treeBlocks.has(ak) ||
                        world.farms.has(ak) || world.poopBlocks.has(ak) || world.seedlings.has(ak) || world.flagCells.has(ak)) {
                      tryStartAction(agent,'play', { targetPos: { x: nx, y: ny } });
                      break;
                    }
                  }
                }

                // Deposit at own flag
                if (!agent.action && agent.factionId && agent.inventoryTotal() >= 3) {
                  const flag = world.flags.get(agent.factionId);
                  if (flag && manhattan(agent.cellX, agent.cellY, flag.x, flag.y) <= 1) {
                    const { food, water, wood } = agent.inventory;
                    const rt = food >= water && food >= wood ? 'food'
                      : water >= wood ? 'water' : 'wood';
                    tryStartAction(agent,'deposit', { resourceType: rt });
                  }
                }

                // Build farm
                if (!agent.action && agent.inventory.wood >= FARM_WOOD_COST &&
                    agent.energy >= FARM_ENERGY_COST && Math.random() < 0.03) {
                  tryStartAction(agent,'build_farm');
                }

                if (!agent.action) {
                  // Opportunistic food/wood harvest
                  if (!agent.inventoryFull() && Math.random() < 0.4) {
                    tryHarvestAdjacentFood(world, agent);
                  }
                  if (!agent.action && !agent.inventoryFull() && Math.random() < 0.3) {
                    tryHarvestAdjacentWood(world, agent);
                  }
                  if (!agent.action) {
                    biasedRoam(world, agent);
                  }
                }
              }
            }

          } // end baby guard else
        }
      }
    }

    // ── Age-based death ──
    if (agent.ageTicks >= agent.maxAgeTicks) {
      agent.health = 0;
      log(world, 'death', `${agent.name} died of old age`, agent.id, {});
    }

    agent.clampStats();

    // ── Disease effects ──
    if (agent.diseased) {
      agent.energy -= PASSIVE_ENERGY_DRAIN; // 2x drain
      agent.health -= (DISEASE_HP_DRAIN_PER_SEC * TICK_MS) / 1000;
      if (agent.hygiene > DISEASE_CURE_HYGIENE_THRESHOLD) {
        agent.diseased = false;
        log(world, 'hygiene', `${agent.name} recovered from disease`, agent.id, {});
      }
    } else if (agent.hygiene < DISEASE_CONTRACTION_THRESHOLD) {
      if (Math.random() < DISEASE_CONTRACTION_CHANCE) {
        agent.diseased = true;
        log(world, 'hygiene', `${agent.name} contracted a disease`, agent.id, {});
      }
    }

    // ── Starvation / health regen ──
    if (agent.fullness <= 0) {
      agent.health -= (STARVE_HP_PER_SEC * TICK_MS) / 1000;
    }
    if (agent.fullness > FULLNESS_REGEN_THRESHOLD) {
      agent.healBy((REGEN_HP_PER_SEC * TICK_MS) / 1000);
    }
  }

  /** Handle birth when pregnancy completes */
  private static _handleBirth(world: World, agent: Agent): void {
    const preg = agent.pregnancy;
    if (!preg.childDna) {
      preg.clear();
      return;
    }

    // Find adjacent free cell for child
    const spots: [number, number][] = [
      [agent.cellX + 1, agent.cellY],
      [agent.cellX - 1, agent.cellY],
      [agent.cellX, agent.cellY + 1],
      [agent.cellX, agent.cellY - 1],
    ];
    const free = spots.find(([x, y]) => !world.grid.isBlocked(x, y));
    if (!free) {
      // No space — delay birth by one tick
      preg.remainingMs = 0;
      return;
    }

    const [cx, cy] = free;
    const child = AgentFactory.createChild(
      cx, cy,
      preg.childDna,
      preg.childFamilyName ?? agent.familyName,
      preg.childFactionId,
      agent.generation
    );

    world.agents.push(child);
    world.agentsById.set(child.id, child);
    world.agentsByCell.set(key(cx, cy), child.id);
    world.totalBirths++;
    world.birthTimestamps.push(performance.now());

    // Register with family registry
    world.familyRegistry.registerBirth(child.familyName, child.generation);

    // Set up parent-child relationships (mutual high bond)
    const parentBond = 0.8;
    child.relationships.set(agent.id, parentBond);
    agent.relationships.adjust(child.id, parentBond);
    if (preg.partnerId) {
      const partner = world.agentsById.get(preg.partnerId);
      if (partner) {
        child.relationships.set(preg.partnerId, parentBond);
        partner.relationships.adjust(child.id, parentBond);
      }
    }

    // Inherit faction membership
    if (child.factionId) {
      const faction = world.factions.get(child.factionId);
      if (faction) faction.members.add(child.id);
    }

    world.events.emit('agent:born', {
      child,
      parent1Id: agent.id,
      parent2Id: preg.partnerId,
    });
    world.events.emit('pregnancy:birth', {
      parentId: agent.id,
      childId: child.id,
    });

    log(world, 'reproduce', `${agent.name} gave birth to ${child.name} ${child.familyName}`, agent.id, { childId: child.id });
    preg.clear();
  }
}
