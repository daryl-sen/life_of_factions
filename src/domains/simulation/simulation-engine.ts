import { GRID, BASE_TICK_MS, TUNE, FOOD_EMOJIS, TREE_EMOJIS, WORLD_EMOJIS } from '../../shared/constants';
import type { ResourceMemoryType } from '../../shared/types';
import { key, manhattan, rndi, log, uuid } from '../../shared/utils';
import { Pathfinder } from '../../shared/pathfinding';
import { FoodField } from '../world/food-field';
import { WaterField } from '../world/water-field';
import { LootBagManager } from '../world/loot-bag-manager';
import { PoopBlockManager } from '../world/poop-block-manager';
import type { World, DeathCause } from '../world';
import type { Agent } from '../agent';
import { ActionFactory, ActionProcessor, InteractionEngine } from '../action';
import { AgentFactory } from '../agent/agent-factory';
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
    const toDelete: string[] = [];
    for (const [fk, fm] of world.farms) {
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
      const maxAgeMs = rndi(TUNE.tree.maxAgeRange[0], TUNE.tree.maxAgeRange[1]);
      world.treeBlocks.set(key(x, y), {
        id: uuid(), x, y,
        emoji: SimulationEngine._randomTreeEmoji(),
        units, maxUnits: units,
        ageTotalMs: 0, maxAgeMs,
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
    // Require water within range to spawn seedling
    let nearWater = false;
    for (const wb of world.waterBlocks.values()) {
      if (manhattan(originX, originY, wb.x, wb.y) <= TUNE.tree.waterRequiredForSeedling) {
        nearWater = true;
        break;
      }
    }
    if (!nearWater) return false;

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
      const maxAgeMs = rndi(TUNE.tree.maxAgeRange[0], TUNE.tree.maxAgeRange[1]);
      world.treeBlocks.set(k, {
        id: uuid(), x: s.x, y: s.y,
        emoji: SimulationEngine._randomTreeEmoji(),
        units, maxUnits: units,
        ageTotalMs: 0, maxAgeMs,
      });
      log(world, 'spawn', `seedling grew into tree @${s.x},${s.y}`, null, { x: s.x, y: s.y });
    }
  }

  static hasPoopNearby(world: World, x: number, y: number, radius: number): boolean {
    for (const poop of world.poopBlocks.values()) {
      if (manhattan(x, y, poop.x, poop.y) <= radius) return true;
    }
    return false;
  }

  private static _tickTreePassiveSpawns(world: World): void {
    for (const tree of world.treeBlocks.values()) {
      if (tree.units <= 0) continue;
      const nearPoop = SimulationEngine.hasPoopNearby(world, tree.x, tree.y, TUNE.tree.poopBoostSeedlingRadius);
      // Seedling chance: doubled if poop nearby
      const seedlingChance = nearPoop
        ? TUNE.tree.seedlingPassiveChance * 2
        : TUNE.tree.seedlingPassiveChance;
      if (Math.random() < seedlingChance) {
        SimulationEngine.trySpawnSeedling(world, tree.x, tree.y);
      }
      // Food spawn: only if poop within range
      else if (nearPoop && Math.random() < TUNE.tree.foodPassiveChance) {
        SimulationEngine.trySpawnFoodNearTree(world, tree.x, tree.y);
      }
    }
  }

  // ── Water decay ──

  private static _tickWaterDecay(world: World): void {
    const toDelete: string[] = [];
    const seen = new Set<string>();
    for (const [k, wb] of world.waterBlocks) {
      if (seen.has(wb.id)) continue;
      seen.add(wb.id);
      wb.units -= TUNE.water.baseDecayPerTick;
      if (wb.units <= 0) {
        for (const c of wb.cells) toDelete.push(key(c.x, c.y));
      } else if (wb.size === 'large' && wb.units < wb.maxUnits * TUNE.water.shrinkThreshold) {
        // Shrink large to small (keep first cell only)
        const keep = wb.cells[0];
        for (let i = 1; i < wb.cells.length; i++) {
          world.waterBlocks.delete(key(wb.cells[i].x, wb.cells[i].y));
        }
        wb.size = 'small' as const;
        wb.cells = [keep];
        wb.x = keep.x;
        wb.y = keep.y;
      }
    }
    for (const k of toDelete) world.waterBlocks.delete(k);
  }

  // ── Seedling near water ──

  private static _tickSeedlingNearWater(world: World): void {
    const seen = new Set<string>();
    for (const wb of world.waterBlocks.values()) {
      if (seen.has(wb.id)) continue;
      seen.add(wb.id);
      if (Math.random() < TUNE.tree.seedlingNearWaterChance) {
        // Spawn seedling within 3 cells of this water block
        for (let attempt = 0; attempt < 10; attempt++) {
          const x = wb.x + rndi(-3, 3);
          const y = wb.y + rndi(-3, 3);
          if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
          if (world.grid.isCellOccupied(x, y)) continue;
          const dur = rndi(TUNE.tree.seedlingGrowthRange[0], TUNE.tree.seedlingGrowthRange[1]);
          world.seedlings.set(key(x, y), {
            id: uuid(), x, y,
            plantedAtTick: world.tick,
            growthDurationMs: dur,
            growthElapsedMs: 0,
          });
          break;
        }
      }
    }
  }

  // ── Terrain ──

  private static _tickTerrain(world: World): void {
    world.terrainField.tick(world.grid, world.tick);
  }

  // ── Saltwater spawning ──

  static seedInitialSaltWater(world: World, count: number): void {
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < count; i++) {
      const bodySize = rndi(TUNE.saltWater.bodySize[0], TUNE.saltWater.bodySize[1]);
      const startX = rndi(3, GRID - 4);
      const startY = rndi(3, GRID - 4);
      // BFS-style flood growth from the seed for a continuous body
      const frontier: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
      let placed = 0;
      while (frontier.length > 0 && placed < bodySize) {
        // Pick a random cell from the frontier for organic shapes
        const idx = Math.floor(Math.random() * frontier.length);
        const cell = frontier[idx];
        frontier[idx] = frontier[frontier.length - 1];
        frontier.pop();
        const k = key(cell.x, cell.y);
        if (world.saltWaterBlocks.has(k)) continue;
        if (world.grid.isCellOccupied(cell.x, cell.y)) continue;
        world.saltWaterBlocks.set(k, { id: uuid(), x: cell.x, y: cell.y });
        placed++;
        // Add neighbors to frontier
        for (const [dx, dy] of dirs) {
          const nx = cell.x + dx;
          const ny = cell.y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          if (!world.saltWaterBlocks.has(key(nx, ny))) {
            frontier.push({ x: nx, y: ny });
          }
        }
      }
    }
  }

  // ── Cloud / rain ──

  private static _tickClouds(world: World): void {
    // Dynamic cloud spawn rate based on water coverage
    const totalCells = GRID * GRID;
    const seenWater = new Set<string>();
    let waterCellCount = 0;
    for (const wb of world.waterBlocks.values()) {
      if (!seenWater.has(wb.id)) {
        seenWater.add(wb.id);
        waterCellCount += wb.cells.length;
      }
    }
    const currentCoverage = waterCellCount / totalCells;
    const target = TUNE.cloud.targetWaterCoverage;
    // Scale: when coverage is 0, rate multiplier is ~3x; when at target, ~1x; when 2x target, ~0.2x
    const dynamicMultiplier = Math.max(0.1, Math.min(4, (target / Math.max(0.001, currentCoverage))));

    // Spawn new rain cloud (rate-adjusted by both slider and dynamic multiplier)
    if (world.cloudSpawnRate > 0) {
      world._nextCloudSpawnMs -= BASE_TICK_MS;
      if (world._nextCloudSpawnMs <= 0) {
        const x = rndi(0, GRID - 1);
        const y = rndi(0, GRID - 1);
        const lifetime = rndi(TUNE.cloud.lifetimeRange[0], TUNE.cloud.lifetimeRange[1]);
        world.clouds.push({
          id: uuid(), x, y, xF: x,
          spawnedAtMs: performance.now(),
          lifetimeMs: lifetime,
          totalLifetimeMs: lifetime,
          rained: false,
        });
        const baseInterval = rndi(TUNE.cloud.spawnIntervalRange[0], TUNE.cloud.spawnIntervalRange[1]);
        world._nextCloudSpawnMs = Math.max(1000, baseInterval / (world.cloudSpawnRate * dynamicMultiplier));
      }
    }

    // Randomly spawn decorative (non-raining) clouds
    if (Math.random() < 0.025) {
      const x = rndi(-2, GRID - 1);
      const y = rndi(0, GRID - 1);
      const lifetime = rndi(15000, 28000);
      world.clouds.push({
        id: uuid(), x, y, xF: x,
        spawnedAtMs: performance.now(),
        lifetimeMs: lifetime,
        totalLifetimeMs: lifetime,
        rained: true,
        decorative: true,
      });
    }

    // Update existing clouds
    const remaining: typeof world.clouds = [];
    for (const cloud of world.clouds) {
      cloud.lifetimeMs -= BASE_TICK_MS;

      // Drift speed based on lifecycle phase
      const progress = 1 - cloud.lifetimeMs / cloud.totalLifetimeMs;
      let speed: number;
      if (progress < 0.35 || progress > 0.65) {
        speed = cloud.decorative ? 0.04 : 0.05; // fast phase
      } else {
        speed = cloud.decorative ? 0.025 : 0.004; // slow (rain) phase
      }
      cloud.xF = (cloud.xF ?? cloud.x) + speed;

      // Rain at mid-life (rain clouds only)
      if (!cloud.rained && cloud.lifetimeMs < (cloud.totalLifetimeMs * 0.5)) {
        cloud.rained = true;
        const isLarge = Math.random() >= TUNE.cloud.smallChance;
        const size = isLarge ? 'large' as const : 'small' as const;
        for (let attempt = 0; attempt < 20; attempt++) {
          const rx = Math.round(cloud.xF) + rndi(-3, 3);
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

  // ── Vision scan — agents observe nearby resources ──

  static scanVision(world: World, agent: Agent): void {
    const range = TUNE.agent.visionRange;
    const x0 = Math.max(0, agent.cellX - range);
    const x1 = Math.min(GRID - 1, agent.cellX + range);
    const y0 = Math.max(0, agent.cellY - range);
    const y1 = Math.min(GRID - 1, agent.cellY + range);

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

  /** Try to pathfind to a remembered resource location. Returns true if path was set. */
  static seekFromMemory(world: World, agent: Agent, type: ResourceMemoryType): boolean {
    const entries = agent.resourceMemory.get(type)!;
    if (entries.length === 0) return false;

    // Check each remembered location — if resource is gone, forget it
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
    // For water, target adjacent cell (water is impassable)
    if (type === 'water') {
      const adjCells: [number, number][] = [
        [target.x + 1, target.y], [target.x - 1, target.y],
        [target.x, target.y + 1], [target.x, target.y - 1],
      ];
      for (const [ax, ay] of adjCells) {
        if (ax < 0 || ay < 0 || ax >= GRID || ay >= GRID) continue;
        if (!world.grid.isBlocked(ax, ay, agent.id)) {
          Pathfinder.planPathTo(world, agent, ax, ay);
          return agent.path !== null && agent.path.length > 0;
        }
      }
      return false;
    }
    Pathfinder.planPathTo(world, agent, target.x, target.y);
    return agent.path !== null && agent.path.length > 0;
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

    // 2. Harvest nearby food block if not inventory full
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
            agent.action = ActionFactory.createHarvest(resourceType, { x: nx, y: ny }, agent.inspiration);
            return;
          }
        }
        // Seedlings are harvestable as low-quality food
        if (world.seedlings.has(k) && !agent.action) {
          agent.action = ActionFactory.createHarvest('food_lq', { x: nx, y: ny }, agent.inspiration);
          return;
        }
      }
    }

    // 3. Look within vision range for food
    const vr = TUNE.agent.visionRange;
    let closestFood: { x: number; y: number; d: number } | null = null;
    for (let dx = -vr; dx <= vr; dx++) {
      for (let dy = -vr; dy <= vr; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > vr) continue;
        const fx = agent.cellX + dx;
        const fy = agent.cellY + dy;
        if (fx < 0 || fy < 0 || fx >= GRID || fy >= GRID) continue;
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
      Pathfinder.planPathTo(world, agent, closestFood.x, closestFood.y);
      if (agent.path && agent.path.length > 0) return;
    }

    // 4. Use resource memory
    if (SimulationEngine.seekFromMemory(world, agent, 'food')) return;

    // 5. Full pathfind (global search)
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

    // 6. Nothing found — wander
    RoamingStrategy.biasedRoam(world, agent);
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

    // 2. Harvest nearby water block if not inventory full
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
            agent.action = ActionFactory.createHarvest('water', { x: nx, y: ny }, agent.inspiration);
            return;
          }
        }
      }
    }

    // 3. Look within vision range for water
    const vr = TUNE.agent.visionRange;
    let closestWater: { x: number; y: number; d: number } | null = null;
    for (let dx = -vr; dx <= vr; dx++) {
      for (let dy = -vr; dy <= vr; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > vr) continue;
        const wx = agent.cellX + dx;
        const wy = agent.cellY + dy;
        if (wx < 0 || wy < 0 || wx >= GRID || wy >= GRID) continue;
        const block = world.waterBlocks.get(key(wx, wy));
        if (block && block.units > 0) {
          if (!closestWater || d < closestWater.d) {
            closestWater = { x: wx, y: wy, d };
          }
        }
      }
    }
    if (closestWater) {
      // Target adjacent cell to water (water is impassable)
      const adjCells: [number, number][] = [
        [closestWater.x + 1, closestWater.y], [closestWater.x - 1, closestWater.y],
        [closestWater.x, closestWater.y + 1], [closestWater.x, closestWater.y - 1],
      ];
      for (const [ax, ay] of adjCells) {
        if (ax < 0 || ay < 0 || ax >= GRID || ay >= GRID) continue;
        if (!world.grid.isBlocked(ax, ay, agent.id)) {
          Pathfinder.planPathTo(world, agent, ax, ay);
          if (agent.path && agent.path.length > 0) return;
        }
      }
    }

    // 4. Use resource memory
    if (SimulationEngine.seekFromMemory(world, agent, 'water')) return;

    // 5. Full pathfind (global search)
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
        const adjWater: [number, number][] = [
          [c.x + 1, c.y], [c.x - 1, c.y],
          [c.x, c.y + 1], [c.x, c.y - 1],
        ];
        for (const [ax, ay] of adjWater) {
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
        return;
      }
    }

    // 6. Nothing found — wander
    RoamingStrategy.biasedRoam(world, agent);
  }

  // ── Opportunistic resource harvest ──

  static tryHarvestAdjacentFood(world: World, agent: Agent): boolean {
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
          agent.action = ActionFactory.createHarvest(resourceType, { x: nx, y: ny }, agent.inspiration);
          return true;
        }
      }
      // Seedlings are harvestable as low-quality food
      if (world.seedlings.has(k)) {
        if (!agent.action) {
          agent.action = ActionFactory.createHarvest('food_lq', { x: nx, y: ny }, agent.inspiration);
          return true;
        }
      }
    }
    return false;
  }

  static tryHarvestAdjacentWood(world: World, agent: Agent): boolean {
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

  /** Find an adjacent cell (4-directional) that is not blocked by terrain or another agent. */
  private static _findAdjacentOpen(
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

  private static _cleanDead(world: World): void {
    const removedIds: string[] = [];
    const now = performance.now();
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
        world.deathTimestamps.push(now);

        // Determine death cause
        let cause: DeathCause = 'killed';
        if (a.ageTicks >= a.maxAgeTicks) {
          cause = 'old_age';
        } else if (a.fullness <= 0) {
          cause = 'hunger';
        } else if (a.diseased) {
          cause = 'disease';
        }
        world.deadMarkers.push({
          cellX: a.cellX, cellY: a.cellY,
          cause, msRemaining: 10000,
        });

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
    const obstaclesToDelete: string[] = [];
    for (const [k, o] of world.obstacles) {
      if (o.hp <= 0) obstaclesToDelete.push(k);
    }
    for (const k of obstaclesToDelete) {
      const o = world.obstacles.get(k);
      world.obstacles.delete(k);
      if (o) log(world, 'destroy', `Obstacle @${o.x},${o.y} destroyed`, null, {});
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
    SimulationEngine._tickWaterDecay(world);
    SimulationEngine._tickSeedlingNearWater(world);
    SimulationEngine._tickTerrain(world);

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
      // Passive social decay
      agent.social = Math.max(0, agent.social - TUNE.social.passiveDecay);
      // Poop timer decay
      if (agent.poopTimerMs > 0) agent.poopTimerMs -= BASE_TICK_MS;
      agent.lockMsRemaining = Math.max(0, (agent.lockMsRemaining || 0) - BASE_TICK_MS);
      if (agent.babyMsRemaining > 0) agent.babyMsRemaining = Math.max(0, agent.babyMsRemaining - BASE_TICK_MS);

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
          // Follow path — agents walk through each other but cannot land on the same cell
          if (agent.path && agent.pathIdx < agent.path.length) {
            const step = agent.path[agent.pathIdx];
            // Terrain blocked → abandon path
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
                // Final destination occupied — fall back to an adjacent open cell
                const fallback = SimulationEngine._findAdjacentOpen(world, step.x, step.y, agent.id);
                if (fallback) {
                  targetX = fallback.x;
                  targetY = fallback.y;
                } else {
                  canMove = false;
                }
              }
              // Intermediate steps: walk through other agents freely

              if (canMove) {
                agent.prevCellX = agent.cellX;
                agent.prevCellY = agent.cellY;
                agent.lerpT = 0;
                // Conditional delete: only remove if we still own this cell
                const oldKey = key(agent.cellX, agent.cellY);
                if (world.agentsByCell.get(oldKey) === agent.id) {
                  world.agentsByCell.delete(oldKey);
                }
                agent.cellX = targetX;
                agent.cellY = targetY;
                // Only register in cell map if not passing through another agent
                const newKey = key(agent.cellX, agent.cellY);
                const newOccupant = world.agentsByCell.get(newKey);
                if (!newOccupant || newOccupant === agent.id) {
                  world.agentsByCell.set(newKey, agent.id);
                }
                agent.pathIdx++;
                agent.energy -= TUNE.moveEnergy;
                agent.drainFullness(TUNE.fullness.moveDecay);
                agent.hygiene = Math.max(0, agent.hygiene - TUNE.hygiene.moveDecay);
                if (world.poopBlocks.has(key(agent.cellX, agent.cellY))) {
                  agent.hygiene = Math.max(0, agent.hygiene - TUNE.hygiene.stepOnPoopDecay);
                }
              } else {
                agent.path = null;
              }
            }
          } else {
            agent.path = null;
          }

          // Ensure stationary agents are registered on a unique cell
          // (handles agents who passed through an occupied cell and then stopped)
          if (!agent.path || agent.pathIdx >= agent.path.length) {
            const ck = key(agent.cellX, agent.cellY);
            const occupant = world.agentsByCell.get(ck);
            if (occupant && occupant !== agent.id) {
              const open = SimulationEngine._findAdjacentOpen(world, agent.cellX, agent.cellY, agent.id);
              if (open) {
                agent.prevCellX = agent.cellX;
                agent.prevCellY = agent.cellY;
                agent.lerpT = 0;
                agent.cellX = open.x;
                agent.cellY = open.y;
                world.agentsByCell.set(key(open.x, open.y), agent.id);
              }
              // If no open cell, agent stays unregistered temporarily — next tick will retry
            } else if (!occupant) {
              world.agentsByCell.set(ck, agent.id);
            }
          }

          // Vision scan — update resource memory
          if (!agent.action) {
            SimulationEngine.scanVision(world, agent);
          }

          // Idle decision — delegate to InteractionEngine for priority hierarchy
          if (!agent.path && !agent.action) {
            InteractionEngine.consider(world, agent);

            // Babies can only eat/drink/move — skip all other idle actions
            if (agent.babyMsRemaining > 0) {
              // babies just roam if they have no action
              if (!agent.action && !agent.path) {
                RoamingStrategy.biasedRoam(world, agent);
              }
            } else {

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
                  // Opportunistic food/wood harvest when passing near resources
                  if (!agent.inventoryFull() && Math.random() < 0.4) {
                    SimulationEngine.tryHarvestAdjacentFood(world, agent);
                  }
                  if (!agent.action && !agent.inventoryFull() && Math.random() < 0.3) {
                    SimulationEngine.tryHarvestAdjacentWood(world, agent);
                  }
                  if (!agent.action) {
                    RoamingStrategy.biasedRoam(world, agent);
                  }
                }
              }
            }
          }

            } // end baby guard else

        }
      }

      // Age-based death for agents
      if (agent.ageTicks >= agent.maxAgeTicks) {
        agent.health = 0;
        log(world, 'death', `${agent.name} died of old age`, agent.id, {});
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
    SimulationEngine._tickTreeAging(world);
    SimulationEngine._tickEggs(world);
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

  private static _tickTreeAging(world: World): void {
    const toRemove: string[] = [];
    for (const [k, tree] of world.treeBlocks) {
      tree.ageTotalMs += BASE_TICK_MS;
      if (tree.ageTotalMs >= tree.maxAgeMs) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) {
      const tree = world.treeBlocks.get(k);
      world.treeBlocks.delete(k);
      if (tree) {
        world.deadMarkers.push({ cellX: tree.x, cellY: tree.y, cause: 'tree', msRemaining: 10000 });
        log(world, 'death', `Tree @${tree.x},${tree.y} died of old age`, null, { x: tree.x, y: tree.y });
      }
    }
  }

  private static _tickEggs(world: World): void {
    // Spawn eggs from trees when no agents exist
    if (world.agents.length === 0) {
      for (const tree of world.treeBlocks.values()) {
        if (Math.random() < TUNE.egg.spawnChance) {
          const adj: [number, number][] = [
            [tree.x + 1, tree.y], [tree.x - 1, tree.y],
            [tree.x, tree.y + 1], [tree.x, tree.y - 1],
          ];
          for (const [nx, ny] of adj) {
            if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
            if (world.grid.isCellOccupied(nx, ny)) continue;
            world.eggs.set(key(nx, ny), {
              id: uuid(), x: nx, y: ny,
              hatchTimerMs: TUNE.egg.hatchTimeMs,
            });
            log(world, 'spawn', `Egg appeared @${nx},${ny}`, null, { x: nx, y: ny });
            break;
          }
        }
      }
    }

    // Hatch eggs
    const toHatch: string[] = [];
    for (const [k, egg] of world.eggs) {
      egg.hatchTimerMs -= BASE_TICK_MS;
      if (egg.hatchTimerMs <= 0) toHatch.push(k);
    }
    for (const k of toHatch) {
      const egg = world.eggs.get(k)!;
      world.eggs.delete(k);
      const babyMs = TUNE.baby.durationRange[0] + Math.random() * (TUNE.baby.durationRange[1] - TUNE.baby.durationRange[0]);
      const agent = AgentFactory.create(world, egg.x, egg.y);
      agent.babyMsRemaining = babyMs;
      agent.health = 80;
      agent.energy = 60;
      agent.fullness = 50;
      world.totalBirths++;
      world.birthTimestamps.push(performance.now());
      log(world, 'spawn', `Egg hatched into ${agent.name} @${egg.x},${egg.y}`, agent.id, {});
    }
  }
}
