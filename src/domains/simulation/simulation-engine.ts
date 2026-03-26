import { GRID, BASE_TICK_MS, TUNE, FOOD_EMOJIS, TREE_EMOJIS, WORLD_EMOJIS } from '../../shared/constants';
import { key, manhattan, rndi, log, uuid } from '../../shared/utils';
import { Pathfinder } from '../../shared/pathfinding';
import { FoodField } from '../world/food-field';
import { WaterField } from '../world/water-field';
import { LootBagManager } from '../world/loot-bag-manager';
import { PoopBlockManager } from '../world/poop-block-manager';
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

  private static _randomTreeEmoji(): string {
    return TREE_EMOJIS[Math.floor(Math.random() * TREE_EMOJIS.length)];
  }

  static addCrop(world: World, x: number, y: number): boolean {
    if (world.foodBlocks.size >= TUNE.maxCrops) return false;
    const k = key(x, y);
    if (world.grid.isCellOccupied(x, y)) return false;
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
      if (world.grid.isCellOccupied(x, y)) continue;
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
    const toDelete: string[] = [];
    for (const [fk, fm] of world.farms) {
      if (world.foodBlocks.size >= TUNE.maxCrops) break;
      fm.spawnTimerMs -= BASE_TICK_MS;
      if (fm.spawnTimerMs > 0) continue;

      // Count food blocks within spawn radius
      const r = TUNE.farm.spawnRadius;
      let nearbyFood = 0;
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dy) > r) continue;
          const fx = fm.x + dx;
          const fy = fm.y + dy;
          if (world.foodBlocks.has(key(fx, fy))) nearbyFood++;
        }
      }

      // Reset timer regardless
      fm.spawnTimerMs = rndi(TUNE.farm.spawnIntervalRange[0], TUNE.farm.spawnIntervalRange[1]);

      if (nearbyFood >= TUNE.farm.maxFoodInRadius) continue;

      // Try to spawn HQ food on adjacent free cell
      let spawned = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        const dx = rndi(-r, r);
        const dy = rndi(-r, r);
        if (dx === 0 && dy === 0) continue;
        const x = fm.x + dx;
        const y = fm.y + dy;
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
        if (world.grid.isCellOccupied(x, y)) continue;
        const units = rndi(TUNE.foodBlock.hqUnits[0], TUNE.foodBlock.hqUnits[1]);
        world.foodBlocks.set(key(x, y), {
          id: uuid(), x, y,
          emoji: SimulationEngine._randomFoodEmoji('hq'),
          quality: 'hq', units, maxUnits: units,
        });
        spawned = true;
        break;
      }

      if (spawned) {
        fm.spawnsRemaining--;
        if (fm.spawnsRemaining <= 0) {
          toDelete.push(fk);
        }
      }
    }
    for (const fk of toDelete) {
      const fm = world.farms.get(fk);
      world.farms.delete(fk);
      if (fm) log(world, 'destroy', `Farm @${fm.x},${fm.y} exhausted`, null, { x: fm.x, y: fm.y });
    }
  }

  // ── Water spawning ──

  static spawnWaterBlock(world: World, x: number, y: number, size: 'small' | 'large'): boolean {
    if (size === 'small') {
      if (world.grid.isCellOccupied(x, y)) return false;
      const block = {
        id: uuid(), x, y,
        units: TUNE.water.smallUnits,
        maxUnits: TUNE.water.smallUnits,
        size: 'small' as const,
        cells: [{ x, y }],
      };
      world.waterBlocks.set(key(x, y), block);
      return true;
    }
    // Large: 2x2 region
    const cells = [
      { x, y }, { x: x + 1, y },
      { x, y: y + 1 }, { x: x + 1, y: y + 1 },
    ];
    for (const c of cells) {
      if (c.x < 0 || c.y < 0 || c.x >= GRID || c.y >= GRID) return false;
      if (world.grid.isCellOccupied(c.x, c.y)) return false;
    }
    const block = {
      id: uuid(), x, y,
      units: TUNE.water.largeUnits,
      maxUnits: TUNE.water.largeUnits,
      size: 'large' as const,
      cells,
    };
    for (const c of cells) {
      world.waterBlocks.set(key(c.x, c.y), block);
    }
    return true;
  }

  static seedInitialWater(world: World, count: number): void {
    for (let i = 0; i < count; i++) {
      const isLarge = Math.random() < 0.5;
      if (isLarge) {
        for (let attempt = 0; attempt < 500; attempt++) {
          const x = rndi(0, GRID - 2);
          const y = rndi(0, GRID - 2);
          if (SimulationEngine.spawnWaterBlock(world, x, y, 'large')) break;
        }
      } else {
        for (let attempt = 0; attempt < 200; attempt++) {
          const x = rndi(0, GRID - 1);
          const y = rndi(0, GRID - 1);
          if (SimulationEngine.spawnWaterBlock(world, x, y, 'small')) break;
        }
      }
    }
  }

  // ── Tree spawning ──

  static addTree(world: World): boolean {
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = rndi(0, GRID - 1);
      const y = rndi(0, GRID - 1);
      if (world.grid.isCellOccupied(x, y)) continue;
      const units = rndi(TUNE.tree.unitRange[0], TUNE.tree.unitRange[1]);
      world.treeBlocks.set(key(x, y), {
        id: uuid(), x, y,
        emoji: SimulationEngine._randomTreeEmoji(),
        units, maxUnits: units,
      });
      log(world, 'spawn', `tree @${x},${y}`, null, { x, y });
      return true;
    }
    return false;
  }

  static seedInitialTrees(world: World, count: number): void {
    for (let i = 0; i < count; i++) {
      SimulationEngine.addTree(world);
    }
  }

  // ── Seedling / tree passive spawns ──

  static trySpawnSeedling(world: World, originX: number, originY: number): boolean {
    const r = TUNE.tree.seedlingRadius;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = originX + rndi(-r, r);
      const y = originY + rndi(-r, r);
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
      if (world.grid.isCellOccupied(x, y)) continue;
      const dur = rndi(TUNE.tree.seedlingGrowthRange[0], TUNE.tree.seedlingGrowthRange[1]);
      world.seedlings.set(key(x, y), {
        id: uuid(), x, y,
        plantedAtTick: world.tick,
        growthDurationMs: dur,
        growthElapsedMs: 0,
      });
      return true;
    }
    return false;
  }

  static trySpawnFoodNearTree(world: World, treeX: number, treeY: number): boolean {
    const r = TUNE.tree.foodRadius;
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = treeX + rndi(-r, r);
      const y = treeY + rndi(-r, r);
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
      if (world.grid.isCellOccupied(x, y)) continue;
      return SimulationEngine.addCrop(world, x, y);
    }
    return false;
  }

  private static _tickSeedlings(world: World): void {
    const toConvert: string[] = [];
    for (const [k, s] of world.seedlings) {
      // Near water (within 5 cells): normal speed. Otherwise: 100x slower.
      let nearWater = false;
      for (const wb of world.waterBlocks.values()) {
        if (manhattan(s.x, s.y, wb.x, wb.y) <= 5) { nearWater = true; break; }
      }
      s.growthElapsedMs += nearWater ? BASE_TICK_MS : BASE_TICK_MS / 100;
      if (s.growthElapsedMs >= s.growthDurationMs) {
        toConvert.push(k);
      }
    }
    for (const k of toConvert) {
      const s = world.seedlings.get(k)!;
      world.seedlings.delete(k);
      const units = rndi(TUNE.tree.unitRange[0], TUNE.tree.unitRange[1]);
      world.treeBlocks.set(k, {
        id: uuid(), x: s.x, y: s.y,
        emoji: SimulationEngine._randomTreeEmoji(),
        units, maxUnits: units,
      });
      log(world, 'spawn', `seedling grew into tree @${s.x},${s.y}`, null, { x: s.x, y: s.y });
    }
  }

  private static _tickTreePassiveSpawns(world: World): void {
    // Deduplicate (trees are 1x1 so each key is unique)
    for (const tree of world.treeBlocks.values()) {
      if (tree.units <= 0) continue;
      // 2% chance seedling
      if (Math.random() < TUNE.tree.seedlingPassiveChance) {
        SimulationEngine.trySpawnSeedling(world, tree.x, tree.y);
      }
      // 1% chance food (independent roll)
      else if (Math.random() < TUNE.tree.foodPassiveChance) {
        SimulationEngine.trySpawnFoodNearTree(world, tree.x, tree.y);
      }
    }
  }

  // ── Cloud / rain ──

  private static _tickClouds(world: World): void {
    // Spawn new cloud
    world._nextCloudSpawnMs -= BASE_TICK_MS;
    if (world._nextCloudSpawnMs <= 0) {
      const x = rndi(0, GRID - 1);
      const y = rndi(0, GRID - 1);
      const lifetime = rndi(TUNE.cloud.lifetimeRange[0], TUNE.cloud.lifetimeRange[1]);
      world.clouds.push({
        id: uuid(), x, y,
        spawnedAtMs: performance.now(),
        lifetimeMs: lifetime,
        rained: false,
      });
      world._nextCloudSpawnMs = rndi(TUNE.cloud.spawnIntervalRange[0], TUNE.cloud.spawnIntervalRange[1]);
    }

    // Update existing clouds
    const remaining: typeof world.clouds = [];
    for (const cloud of world.clouds) {
      cloud.lifetimeMs -= BASE_TICK_MS;

      // Rain at mid-life
      if (!cloud.rained && cloud.lifetimeMs < (rndi(TUNE.cloud.lifetimeRange[0], TUNE.cloud.lifetimeRange[1]) * 0.5)) {
        cloud.rained = true;
        const isLarge = Math.random() >= TUNE.cloud.smallChance;
        const size = isLarge ? 'large' as const : 'small' as const;
        // Try to spawn near cloud position
        for (let attempt = 0; attempt < 20; attempt++) {
          const rx = cloud.x + rndi(-3, 3);
          const ry = cloud.y + rndi(-3, 3);
          if (SimulationEngine.spawnWaterBlock(world, rx, ry, size)) break;
        }
      }

      if (cloud.lifetimeMs > 0) {
        remaining.push(cloud);
      }
    }
    world.clouds = remaining;
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
            agent.action = ActionFactory.createHarvest(resourceType, { x: nx, y: ny }, agent.inspiration);
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

  // ── Water seeking ──

  private static _stepTowardWater(world: World, agent: Agent): boolean {
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
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
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

  static seekWaterWhenThirsty(world: World, agent: Agent): void {
    // 1. Drink from inventory if available
    if (agent.inventory.water > 0) {
      ActionFactory.tryStart(agent, 'drink');
      return;
    }

    // 2. Harvest adjacent water block if not inventory full
    if (!agent.inventoryFull()) {
      const adj: [number, number][] = [
        [agent.cellX + 1, agent.cellY],
        [agent.cellX - 1, agent.cellY],
        [agent.cellX, agent.cellY + 1],
        [agent.cellX, agent.cellY - 1],
      ];
      for (const [nx, ny] of adj) {
        const k = key(nx, ny);
        const block = world.waterBlocks.get(k);
        if (block && block.units > 0) {
          if (!agent.action) {
            agent.action = ActionFactory.createHarvest('water', { x: nx, y: ny }, agent.inspiration);
            return;
          }
        }
      }
    }

    // 3. Pathfind to nearest water block
    if (world.tick - world.waterField.lastTick >= 5) {
      world.waterField.recompute(world.grid, world.tick);
    }
    if (SimulationEngine._stepTowardWater(world, agent)) return;

    // Fallback: pathfind to nearest water
    const seen = new Set<string>();
    const waterPositions: Array<{ x: number; y: number }> = [];
    for (const wb of world.waterBlocks.values()) {
      if (seen.has(wb.id)) continue;
      seen.add(wb.id);
      // Target adjacent cells, not the water itself (it's impassable)
      for (const c of wb.cells) {
        const adjCells: [number, number][] = [
          [c.x + 1, c.y], [c.x - 1, c.y],
          [c.x, c.y + 1], [c.x, c.y - 1],
        ];
        for (const [ax, ay] of adjCells) {
          if (ax < 0 || ay < 0 || ax >= GRID || ay >= GRID) continue;
          if (!world.grid.isBlocked(ax, ay, agent.id)) {
            waterPositions.push({ x: ax, y: ay });
          }
        }
      }
    }
    if (waterPositions.length) {
      const near = Pathfinder.findNearest(agent, waterPositions);
      if (near) {
        Pathfinder.planPathTo(world, agent, near.target.x, near.target.y);
      }
    }
  }

  // ── Opportunistic wood harvest ──

  static tryHarvestAdjacentWood(world: World, agent: Agent): boolean {
    if (agent.inventoryFull()) return false;
    const adj: [number, number][] = [
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
          agent.action = ActionFactory.createHarvest('wood', { x: nx, y: ny }, agent.inspiration);
          return true;
        }
      }
    }
    return false;
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
        LootBagManager.dropOnDeath(world, a);
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
    SimulationEngine._tickSeedlings(world);
    SimulationEngine._tickTreePassiveSpawns(world);
    SimulationEngine._tickClouds(world);

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
      // Passive inspiration decay
      agent.inspiration = Math.max(0, agent.inspiration - TUNE.inspiration.passiveDecay);
      // Poop timer decay
      if (agent.poopTimerMs > 0) agent.poopTimerMs -= BASE_TICK_MS;
      agent.lockMsRemaining = Math.max(0, (agent.lockMsRemaining || 0) - BASE_TICK_MS);

      // Don't cancel sleep, attack, harvest, eat, drink, or short utility actions on low energy
      if (agent.energy < TUNE.energyLowThreshold) {
        if (agent.action &&
          agent.action.type !== 'attack' &&
          agent.action.type !== 'sleep' &&
          agent.action.type !== 'harvest' &&
          agent.action.type !== 'eat' &&
          agent.action.type !== 'drink' &&
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
              agent.hygiene = Math.max(0, agent.hygiene - TUNE.hygiene.moveDecay);
              // Step-on-poop hygiene penalty
              if (world.poopBlocks.has(key(agent.cellX, agent.cellY))) {
                agent.hygiene = Math.max(0, agent.hygiene - TUNE.hygiene.stepOnPoopDecay);
              }
            } else {
              agent.path = null;
            }
          } else {
            agent.path = null;
          }

          // Idle decision — delegate to InteractionEngine for priority hierarchy
          if (!agent.path && !agent.action) {
            InteractionEngine.consider(world, agent);

            // Poop trigger: 10% chance per tick for 30s after eating, only when idle
            if (!agent.action && !agent.path && agent.poopTimerMs > 0) {
              if (Math.random() < TUNE.poop.chancePerTick) {
                ActionFactory.tryStart(agent, 'poop');
              }
            }

            // If InteractionEngine returned without action/path, handle seeking
            if (!agent.path && !agent.action) {
              // Withdraw from flag if needing resources and near own flag
              if (!agent.action && agent.factionId && (agent.fullness < TUNE.fullness.seekThreshold || agent.hygiene < TUNE.hygiene.seekThreshold)) {
                const flag = world.flags.get(agent.factionId);
                if (flag && manhattan(agent.cellX, agent.cellY, flag.x, flag.y) <= 1) {
                  const rt = agent.fullness < TUNE.fullness.seekThreshold && agent.inventory.food <= 0 && flag.storage.food > 0 ? 'food'
                    : agent.hygiene < TUNE.hygiene.seekThreshold && agent.inventory.water <= 0 && flag.storage.water > 0 ? 'water'
                    : null;
                  if (rt) ActionFactory.tryStart(agent, 'withdraw', { resourceType: rt });
                }
              }

              if (!agent.action && agent.fullness < TUNE.fullness.seekThreshold) {
                SimulationEngine.seekFoodWhenHungry(world, agent);
              } else if (!agent.action && agent.hygiene < TUNE.hygiene.seekThreshold) {
                SimulationEngine.seekWaterWhenThirsty(world, agent);
              } else if (!agent.action) {
                // Opportunistic loot bag pickup
                if (!agent.inventoryFull()) {
                  const bagKey = key(agent.cellX, agent.cellY);
                  if (world.lootBags.has(bagKey)) {
                    ActionFactory.tryStart(agent, 'pickup', { targetPos: { x: agent.cellX, y: agent.cellY } });
                  } else {
                    // Check adjacent cells for loot bags
                    const adjCells: [number, number][] = [
                      [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
                      [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
                    ];
                    for (const [nx, ny] of adjCells) {
                      const ak = key(nx, ny);
                      if (world.lootBags.has(ak)) {
                        ActionFactory.tryStart(agent, 'pickup', { targetPos: { x: nx, y: ny } });
                        break;
                      }
                    }
                  }
                }

                // Clean adjacent poop blocks when idle and inspiration is low
                if (!agent.action && agent.inspiration < 60) {
                  const adjCells2: [number, number][] = [
                    [agent.cellX, agent.cellY],
                    [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
                    [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
                  ];
                  for (const [nx, ny] of adjCells2) {
                    if (world.poopBlocks.has(key(nx, ny))) {
                      ActionFactory.tryStart(agent, 'clean', { targetPos: { x: nx, y: ny } });
                      break;
                    }
                  }
                }

                // Play near interactable block when inspiration is low
                if (!agent.action && agent.inspiration < TUNE.inspiration.seekThreshold) {
                  const adjPlay: [number, number][] = [
                    [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
                    [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
                  ];
                  for (const [nx, ny] of adjPlay) {
                    const ak = key(nx, ny);
                    if (world.foodBlocks.has(ak) || world.waterBlocks.has(ak) || world.treeBlocks.has(ak) ||
                        world.farms.has(ak) || world.poopBlocks.has(ak) || world.seedlings.has(ak) || world.flagCells.has(ak)) {
                      ActionFactory.tryStart(agent, 'play', { targetPos: { x: nx, y: ny } });
                      break;
                    }
                  }
                }

                // Deposit at own flag if nearby and has surplus inventory
                if (!agent.action && agent.factionId && agent.inventoryTotal() >= 3) {
                  const flag = world.flags.get(agent.factionId);
                  if (flag && manhattan(agent.cellX, agent.cellY, flag.x, flag.y) <= 1) {
                    const { food, water, wood } = agent.inventory;
                    const rt = food >= water && food >= wood ? 'food'
                      : water >= wood ? 'water' : 'wood';
                    ActionFactory.tryStart(agent, 'deposit', { resourceType: rt });
                  }
                }

                // Build farm if agent has enough resources
                if (!agent.action && agent.inventory.wood >= TUNE.farm.woodCost &&
                    agent.energy >= TUNE.farm.energyCost && Math.random() < 0.03) {
                  ActionFactory.tryStart(agent, 'build_farm');
                }

                if (!agent.action) {
                  // Opportunistic wood harvest when passing near trees
                  if (!agent.inventoryFull() && Math.random() < 0.3) {
                    SimulationEngine.tryHarvestAdjacentWood(world, agent);
                  }
                  if (!agent.action) {
                    RoamingStrategy.biasedRoam(world, agent);
                  }
                }
              }
            }
          }

        }
      }

      agent.clampStats();

      // Disease effects
      if (agent.diseased) {
        // 2× energy drain (extra drain on top of passive)
        agent.energy -= 0.0625;
        // HP drain
        agent.health -= (TUNE.disease.hpDrainPerSec * BASE_TICK_MS) / 1000;
        // Cure if hygiene recovers above threshold
        if (agent.hygiene > TUNE.disease.cureHygieneThreshold) {
          agent.diseased = false;
          log(world, 'hygiene', `${agent.name} recovered from disease`, agent.id, {});
        }
      } else if (agent.hygiene < TUNE.disease.contractionThreshold) {
        if (Math.random() < TUNE.disease.contractionChance) {
          agent.diseased = true;
          log(world, 'hygiene', `${agent.name} contracted a disease`, agent.id, {});
        }
      }

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
    SimulationEngine._tickDiseaseSpread(world);
    SimulationEngine._cleanDead(world);
    LootBagManager.tickDecay(world, BASE_TICK_MS);
    PoopBlockManager.tickDecay(world, BASE_TICK_MS);
  }

  private static _tickDiseaseSpread(world: World): void {
    for (const agent of world.agents) {
      if (!agent.diseased) continue;
      const adj: [number, number][] = [
        [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
        [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
      ];
      for (const [nx, ny] of adj) {
        const id = world.agentsByCell.get(key(nx, ny));
        if (!id) continue;
        const target = world.agentsById.get(id);
        if (!target || target.diseased) continue;
        if (target.hygiene > TUNE.disease.spreadBlockThreshold) continue;
        if (Math.random() < TUNE.disease.spreadChance) {
          target.diseased = true;
          log(world, 'hygiene', `${agent.name} spread disease to ${target.name}`, agent.id, { to: target.id });
        }
      }
    }
  }
}
