import { GRID, BASE_TICK_MS, TUNE, ENERGY_CAP, WORLD_EMOJIS } from '../../shared/constants';
import { key, rndi, log, uuid, manhattan } from '../../shared/utils';
import { Pathfinder } from '../../shared/pathfinding';
import { FoodField } from '../world/food-field';
import type { World } from '../world';
import type { Agent } from '../agent';
import { ActionProcessor, InteractionEngine } from '../action';
import { FactionManager } from '../faction';
import { RoamingStrategy } from './roaming';

export class SimulationEngine {
  // ── Crop spawning ──

  private static _randomCropEmoji(): string {
    return WORLD_EMOJIS.crops[Math.floor(Math.random() * WORLD_EMOJIS.crops.length)];
  }

  static addCrop(world: World, x: number, y: number): boolean {
    if (world.crops.size >= TUNE.maxCrops) return false;
    const k = key(x, y);
    if (
      world.crops.has(k) ||
      world.walls.has(k) ||
      world.farms.has(k) ||
      world.flagCells.has(k)
    ) return false;
    world.crops.set(k, { id: uuid(), x, y, emoji: SimulationEngine._randomCropEmoji() });
    log(world, 'spawn', `crop @${x},${y}`, null, { x, y });
    return true;
  }

  private static _maybeSpawnCrops(world: World): void {
    if (world.crops.size >= TUNE.maxCrops) return;
    const attempts = GRID;
    const base = 3.75e-3 * world.spawnMult;
    for (let i = 0; i < attempts; i++) {
      if (world.crops.size >= TUNE.maxCrops) break;
      const x = rndi(0, GRID - 1);
      const y = rndi(0, GRID - 1);
      const k = key(x, y);
      if (
        world.crops.has(k) ||
        world.walls.has(k) ||
        world.farms.has(k) ||
        world.agentsByCell.has(k) ||
        world.flagCells.has(k)
      ) continue;
      let prob = base;
      for (const fm of world.farms.values()) {
        const d = Math.abs(x - fm.x) + Math.abs(y - fm.y);
        if (d <= TUNE.farmBoostRadius)
          prob *= 1 + (TUNE.farmBoostRadius - d + 1) * 0.6;
      }
      if (Math.random() < prob)
        world.crops.set(k, { id: uuid(), x, y, emoji: SimulationEngine._randomCropEmoji() });
    }
  }

  // ── Harvesting ──

  private static _harvestAt(world: World, agent: Agent, x: number, y: number): boolean {
    const k = key(x, y);
    const crop = world.crops.get(k);
    if (!crop) return false;
    world.crops.delete(k);
    agent.addEnergy(TUNE.cropGain);
    SimulationEngine._levelCheck(world, agent);
    if (agent.factionId) {
      const recips = world.agents.filter(
        (m) =>
          m.factionId === agent.factionId &&
          m.id !== agent.id &&
          manhattan(agent.cellX, agent.cellY, m.cellX, m.cellY) <= 5
      );
      if (recips.length) {
        const share = TUNE.cropGain * 0.3;
        const per = share / recips.length;
        for (const m of recips) m.addEnergy(per);
      }
    }
    return true;
  }

  // ── Level check ──

  private static _levelCheck(world: World, agent: Agent): void {
    if (agent.level >= TUNE.levelCap) return;
    if (agent.energy > ENERGY_CAP * 0.7) {
      agent.levelUp();
      agent.energy = Math.min(ENERGY_CAP, 140);
      log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
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
    log(world, 'build', `${agent.name} built farm`, agent.id, { x, y });
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

  private static _seekFoodWhenHungry(world: World, agent: Agent): void {
    if (world.crops.has(key(agent.cellX, agent.cellY))) {
      SimulationEngine._harvestAt(world, agent, agent.cellX, agent.cellY);
      return;
    }
    if (world.tick - world.foodField.lastTick >= 5) {
      world.foodField.recompute(world.grid, world.tick);
    }
    const adj: [number, number][] = [
      [agent.cellX + 1, agent.cellY],
      [agent.cellX - 1, agent.cellY],
      [agent.cellX, agent.cellY + 1],
      [agent.cellX, agent.cellY - 1],
    ];
    for (const [nx, ny] of adj) {
      const k = key(nx, ny);
      if (world.crops.has(k) && !world.flagCells.has(k)) {
        agent.path = [{ x: nx, y: ny }];
        agent.pathIdx = 0;
        agent.goal = null;
        return;
      }
    }
    const scarcity = world.crops.size / Math.max(1, world.agents.length);
    if (scarcity < 0.35) {
      if (SimulationEngine._stepTowardFood(world, agent)) return;
    }
    const filtered = [...world.crops.values()].filter(
      (c) => !world.flagCells.has(key(c.x, c.y))
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

    const scarcity = world.crops.size / Math.max(1, world.agents.length);
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
      agent.energy -= 0.0625;
      agent.lockMsRemaining = Math.max(0, (agent.lockMsRemaining || 0) - BASE_TICK_MS);

      if (agent.energy < TUNE.energyLowThreshold) {
        if (agent.action && agent.action.type !== 'attack') agent.action = null;
      }

      if (agent.action) {
        ActionProcessor.process(world, agent, BASE_TICK_MS);
      } else {
        const locked = agent.lockMsRemaining > 0 && !agent._underAttack;
        if (!locked) {
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
              if (world.crops.has(key(agent.cellX, agent.cellY)))
                SimulationEngine._harvestAt(world, agent, agent.cellX, agent.cellY);
            } else {
              agent.path = null;
            }
          } else {
            agent.path = null;
          }
          if (!agent.path) {
            if (agent.energy < TUNE.energyLowThreshold) {
              if (Math.random() < 0.4) {
                InteractionEngine.consider(world, agent);
              } else {
                if (world.crops.has(key(agent.cellX, agent.cellY)))
                  SimulationEngine._harvestAt(world, agent, agent.cellX, agent.cellY);
                else SimulationEngine._seekFoodWhenHungry(world, agent);
              }
            } else {
              InteractionEngine.consider(world, agent);
              if (!agent.path && !agent.action) RoamingStrategy.biasedRoam(world, agent);
            }
          }
          if (agent.energy >= 120 && Math.random() < 0.01)
            SimulationEngine._tryBuildFarm(world, agent);
        }
      }

      agent.clampStats();
      if (agent.energy === 0) {
        agent.health -= (TUNE.starveHpPerSec * BASE_TICK_MS) / 1000;
      }
      if (agent.energy >= ENERGY_CAP * 0.8) {
        agent.healBy((TUNE.regenHpPerSec * BASE_TICK_MS) / 1000);
      }
    }

    if (world.tick % 4 === 0) FactionManager.reconcile(world);
    SimulationEngine._applyFlagHealing(world);
    SimulationEngine._cleanDead(world);
  }
}
