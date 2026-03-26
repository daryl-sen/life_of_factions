import { GRID, BASE_TICK_MS, TUNE, FOOD_EMOJIS } from '../../shared/constants';
import { key, rndi, log, uuid } from '../../shared/utils';
import { Pathfinder } from '../../shared/pathfinding';
import { FoodField } from '../world/food-field';
import type { World } from '../world';
import type { Agent } from '../agent';
import { ActionFactory, ActionProcessor, InteractionEngine } from '../action';
import { FactionManager } from '../faction';
import { RoamingStrategy } from './roaming';

export class SimulationEngine {
  // ── Food block spawning ──

  private static _randomFoodEmoji(quality: 'hq' | 'lq'): string {
    const arr = FOOD_EMOJIS[quality];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  static addCrop(world: World, x: number, y: number): boolean {
    if (world.foodBlocks.size >= TUNE.maxCrops) return false;
    const k = key(x, y);
    if (
      world.foodBlocks.has(k) ||
      world.walls.has(k) ||
      world.farms.has(k) ||
      world.flagCells.has(k)
    ) return false;
    const units = rndi(TUNE.foodBlock.lqUnits[0], TUNE.foodBlock.lqUnits[1]);
    world.foodBlocks.set(k, {
      id: uuid(), x, y,
      emoji: SimulationEngine._randomFoodEmoji('lq'),
      quality: 'lq', units, maxUnits: units,
    });
    log(world, 'spawn', `food @${x},${y}`, null, { x, y });
    return true;
  }

  static seedInitialFood(world: World, count: number): void {
    for (let i = 0; i < count; i++) {
      const { x, y } = world.grid.randomFreeCell();
      const k = key(x, y);
      if (world.foodBlocks.has(k)) continue;
      const units = rndi(TUNE.foodBlock.lqUnits[0], TUNE.foodBlock.lqUnits[1]);
      world.foodBlocks.set(k, {
        id: uuid(), x, y,
        emoji: SimulationEngine._randomFoodEmoji('lq'),
        quality: 'lq', units, maxUnits: units,
      });
    }
  }

  private static _maybeSpawnCrops(world: World): void {
    if (world.foodBlocks.size >= TUNE.maxCrops) return;
    // Only spawn HQ food near farms
    for (const fm of world.farms.values()) {
      if (world.foodBlocks.size >= TUNE.maxCrops) break;
      if (Math.random() >= 0.02 * world.spawnMult) continue;
      for (let attempt = 0; attempt < 4; attempt++) {
        const dx = rndi(-TUNE.farmBoostRadius, TUNE.farmBoostRadius);
        const dy = rndi(-TUNE.farmBoostRadius, TUNE.farmBoostRadius);
        const x = fm.x + dx;
        const y = fm.y + dy;
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
        const k = key(x, y);
        if (
          world.foodBlocks.has(k) ||
          world.walls.has(k) ||
          world.farms.has(k) ||
          world.agentsByCell.has(k) ||
          world.flagCells.has(k)
        ) continue;
        const units = rndi(TUNE.foodBlock.hqUnits[0], TUNE.foodBlock.hqUnits[1]);
        world.foodBlocks.set(k, {
          id: uuid(), x, y,
          emoji: SimulationEngine._randomFoodEmoji('hq'),
          quality: 'hq', units, maxUnits: units,
        });
        break;
      }
    }
  }

  // ── Farm building ──

  private static _tryBuildFarm(world: World, agent: Agent): void {
    if (agent.energy < TUNE.farmEnergyCost) return;
    if (Math.random() >= TUNE.buildFarmChance) return;
    const adj: [number, number][] = [
      [agent.cellX + 1, agent.cellY],
      [agent.cellX - 1, agent.cellY],
      [agent.cellX, agent.cellY + 1],
      [agent.cellX, agent.cellY - 1],
    ];
    const free = adj.filter(
      ([x2, y2]) => !world.grid.isBlocked(x2, y2) && !world.farms.has(key(x2, y2))
    );
    if (!free.length) return;
    const [x, y] = free[rndi(0, free.length - 1)];
    world.farms.set(key(x, y), { id: uuid(), x, y });
    agent.drainEnergy(TUNE.farmEnergyCost);
    agent.addXp(TUNE.xp.perBuildFarm);
    log(world, 'build', `${agent.name} built farm`, agent.id, { x, y });
    while (agent.canLevelUp()) {
      agent.levelUp();
      log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
    }
  }

  // ── Food seeking ──

  private static _stepTowardFood(world: World, agent: Agent): boolean {
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
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
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

  static seekFoodWhenHungry(world: World, agent: Agent): void {
    // 1. Eat from inventory if available
    if (agent.inventory.food > 0) {
      ActionFactory.tryStart(agent, 'eat');
      return;
    }

    // 2. Harvest adjacent food block if not inventory full
    if (!agent.inventoryFull()) {
      const adj: [number, number][] = [
        [agent.cellX + 1, agent.cellY],
        [agent.cellX - 1, agent.cellY],
        [agent.cellX, agent.cellY + 1],
        [agent.cellX, agent.cellY - 1],
      ];
      for (const [nx, ny] of adj) {
        const k = key(nx, ny);
        const block = world.foodBlocks.get(k);
        if (block && block.units > 0 && !world.flagCells.has(k)) {
          const resourceType = block.quality === 'hq' ? 'food_hq' : 'food_lq';
          if (!agent.action) {
            agent.action = ActionFactory.createHarvest(resourceType, { x: nx, y: ny });
            return;
          }
        }
      }
    }

    // 3. Pathfind to nearest food block
    if (world.tick - world.foodField.lastTick >= 5) {
      world.foodField.recompute(world.grid, world.tick);
    }
    const scarcity = world.foodBlocks.size / Math.max(1, world.agents.length);
    if (scarcity < 0.35) {
      if (SimulationEngine._stepTowardFood(world, agent)) return;
    }
    const filtered = [...world.foodBlocks.values()].filter(
      (c) => c.units > 0 && !world.flagCells.has(key(c.x, c.y))
    );
    if (filtered.length) {
      const near = Pathfinder.findNearest(agent, filtered);
      if (near) {
        Pathfinder.planPathTo(world, agent, near.target.x, near.target.y);
        return;
      }
    }
  }

  // ── Upkeep ──

  private static _applyFlagHealing(world: World): void {
    for (const agent of world.agents) {
      if (!agent.factionId) continue;
      const flag = world.flags.get(agent.factionId);
      if (!flag) continue;
      const d = Math.abs(agent.cellX - flag.x) + Math.abs(agent.cellY - flag.y);
      if (d <= TUNE.healAuraRadius)
        agent.healBy(TUNE.healAuraPerTick);
    }
  }

  private static _cleanDead(world: World): void {
    const removedIds: string[] = [];
    world.agents = world.agents.filter((a) => {
      if (a.health <= 0) {
        world.agentsByCell.delete(key(a.cellX, a.cellY));
        world.agentsById.delete(a.id);
        removedIds.push(a.id);
        if (a.factionId && world.factions.has(a.factionId)) {
          world.factions.get(a.factionId)!.members.delete(a.id);
        }
        world.totalDeaths++;
        log(world, 'death', `${a.name} died`, a.id, {});
        return false;
      }
      return true;
    });
    if (removedIds.length) {
      for (const a of world.agents) {
        for (const rid of removedIds) a.relationships.delete(rid);
      }
    }
    for (const a of world.agents) {
      for (const rid of a.relationships.keys()) {
        if (!world.agentsById.has(rid)) a.relationships.delete(rid);
      }
    }
    for (const [fid, f] of [...world.factions]) {
      let aliveCount = 0;
      for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
      if (aliveCount <= 1) FactionManager.disband(world, fid, 'no members');
    }
    const wallsToDelete: string[] = [];
    for (const [k, w] of world.walls) {
      if (w.hp <= 0) wallsToDelete.push(k);
    }
    for (const k of wallsToDelete) {
      const w = world.walls.get(k);
      world.walls.delete(k);
      if (w) log(world, 'destroy', `Wall @${w.x},${w.y} destroyed`, null, {});
    }
  }

  // ── Main tick ──

  static tick(world: World): void {
    world.tick++;

    const scarcity = world.foodBlocks.size / Math.max(1, world.agents.length);
    const budgetThisTick =
      scarcity < 0.25
        ? Math.max(6, Math.floor(world.pathBudgetMax * 0.5))
        : world.pathBudgetMax;
    world.pathBudget = budgetThisTick;
    world._pathWhitelist.clear();

    const n = world.agents.length;
    if (n > 0) {
      const eligible = world.agents.filter(
        (a) =>
          (a.lockMsRemaining || 0) <= 0 &&
          (!a.path || a.pathIdx >= a.path.length) &&
          !a.action
      );
      let pool: typeof world.agents;
      if (eligible.length) {
        eligible.sort((a, b) => a.energy - b.energy);
        pool = eligible;
      } else pool = world.agents;
      const k = Math.min(budgetThisTick || 30, pool.length);
      for (let i = 0; i < k; i++) {
        const idx = (world._pathRR + i) % pool.length;
        world._pathWhitelist.add(pool[idx].id);
      }
      world._pathRR = (world._pathRR + k) % pool.length;
    }

    SimulationEngine._maybeSpawnCrops(world);

    for (const b of world.agents) b._underAttack = false;
    for (const b of world.agents) {
      if (b.action && b.action.type === 'attack' && b.action.payload?.targetId) {
        const t = world.agentsById.get(b.action.payload.targetId);
        if (t) t._underAttack = true;
      }
    }

    for (const a of world.agents) {
      const agent = a;
      agent.ageTicks++;
      // Passive energy drain
      agent.energy -= 0.0625;
      // Passive fullness decay
      agent.drainFullness(TUNE.fullness.passiveDecay);
      // Poop timer decay
      if (agent.poopTimerMs > 0) agent.poopTimerMs -= BASE_TICK_MS;
      agent.lockMsRemaining = Math.max(0, (agent.lockMsRemaining || 0) - BASE_TICK_MS);

      // Don't cancel sleep, attack, harvest, eat, or drink on low energy
      if (agent.energy < TUNE.energyLowThreshold) {
        if (agent.action &&
          agent.action.type !== 'attack' &&
          agent.action.type !== 'sleep' &&
          agent.action.type !== 'harvest' &&
          agent.action.type !== 'eat' &&
          agent.action.type !== 'drink'
        ) {
          agent.action = null;
        }
      }

      if (agent.action) {
        ActionProcessor.process(world, agent, BASE_TICK_MS);
      } else {
        const locked = agent.lockMsRemaining > 0 && !agent._underAttack;
        if (!locked) {
          // Follow path
          if (agent.path && agent.pathIdx < agent.path.length) {
            const step = agent.path[agent.pathIdx];
            if (!world.grid.isBlocked(step.x, step.y, agent.id)) {
              agent.prevCellX = agent.cellX;
              agent.prevCellY = agent.cellY;
              agent.lerpT = 0;
              world.agentsByCell.delete(key(agent.cellX, agent.cellY));
              agent.cellX = step.x;
              agent.cellY = step.y;
              world.agentsByCell.set(key(agent.cellX, agent.cellY), agent.id);
              agent.pathIdx++;
              agent.energy -= TUNE.moveEnergy;
              agent.drainFullness(TUNE.fullness.moveDecay);
            } else {
              agent.path = null;
            }
          } else {
            agent.path = null;
          }

          // Idle decision — delegate to InteractionEngine for priority hierarchy
          if (!agent.path && !agent.action) {
            InteractionEngine.consider(world, agent);

            // If InteractionEngine returned without action/path, agent needs food
            if (!agent.path && !agent.action) {
              if (agent.fullness < TUNE.fullness.seekThreshold) {
                SimulationEngine.seekFoodWhenHungry(world, agent);
              } else {
                RoamingStrategy.biasedRoam(world, agent);
              }
            }
          }

          // Farm building chance
          if (agent.energy >= 120 && Math.random() < 0.01)
            SimulationEngine._tryBuildFarm(world, agent);
        }
      }

      agent.clampStats();

      // Starvation: fullness = 0 causes HP drain (not energy = 0)
      if (agent.fullness <= 0) {
        agent.health -= (TUNE.starveHpPerSec * BASE_TICK_MS) / 1000;
      }
      // Health regen: fullness > 90 (not energy >= 160)
      if (agent.fullness > TUNE.fullness.regenThreshold) {
        agent.healBy((TUNE.regenHpPerSec * BASE_TICK_MS) / 1000);
      }
    }

    if (world.tick % 4 === 0) FactionManager.reconcile(world);
    SimulationEngine._applyFlagHealing(world);
    SimulationEngine._cleanDead(world);
  }
}
