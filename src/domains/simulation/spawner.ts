import { GRID_SIZE, TICK_MS, FOOD_EMOJIS, TREE_EMOJIS } from '../../core/constants';
import { key, manhattan, rndi, log, uuid } from '../../core/utils';
import type { World } from '../world/world';
import { AgentFactory } from '../entity/agent-factory';

// ── Inlined TUNE constants ──

const FOOD_HQ_UNITS: [number, number] = [2, 4];
const FOOD_LQ_UNITS: [number, number] = [1, 2];

const WATER_SMALL_UNITS = 5;
const WATER_LARGE_UNITS = 20;
const WATER_SHRINK_THRESHOLD = 0.25;

const TREE_UNIT_RANGE: [number, number] = [3, 6];
const TREE_MAX_AGE_RANGE: [number, number] = [780000, 1020000];
const TREE_SEEDLING_PASSIVE_CHANCE = 0.002;
const TREE_FOOD_PASSIVE_CHANCE = 0.01;
const TREE_SEEDLING_RADIUS = 5;
const TREE_SEEDLING_GROWTH_RANGE: [number, number] = [31500, 63000];
const TREE_FOOD_RADIUS = 3;
const TREE_WATER_REQUIRED_FOR_SEEDLING = 5;
const TREE_POOP_BOOST_SEEDLING_RADIUS = 3;
const TREE_SEEDLING_NEAR_WATER_CHANCE = 0.0005;

const EGG_HATCH_TIME_MS = 60000;
const EGG_SPAWN_CHANCE_PER_LARGE_WATER = 0.0002;

const CLOUD_SPAWN_INTERVAL_RANGE: [number, number] = [60000, 120000];
const CLOUD_LIFETIME_RANGE: [number, number] = [5000, 10000];
const CLOUD_SMALL_CHANCE = 0.5;
const CLOUD_TARGET_WATER_COVERAGE = 0.05;

const FARM_SPAWN_RADIUS = 1;
const FARM_MAX_FOOD_IN_RADIUS = 4;
const FARM_SPAWN_INTERVAL_RANGE: [number, number] = [15000, 25000];

const SALT_WATER_BODY_SIZE: [number, number] = [60, 150];

// ── Helpers ──

function randomFoodEmoji(quality: 'hq' | 'lq'): string {
  const arr = FOOD_EMOJIS[quality];
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTreeEmoji(): string {
  return TREE_EMOJIS[Math.floor(Math.random() * TREE_EMOJIS.length)];
}

// ── Public API ──

export class Spawner {

  // ── Food spawning ──

  static addCrop(world: World, x: number, y: number): boolean {
    const k = key(x, y);
    if (world.grid.isCellOccupied(x, y)) return false;
    const units = rndi(FOOD_LQ_UNITS[0], FOOD_LQ_UNITS[1]);
    world.foodBlocks.set(k, {
      id: uuid(), x, y,
      emoji: randomFoodEmoji('lq'),
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
      const units = rndi(FOOD_LQ_UNITS[0], FOOD_LQ_UNITS[1]);
      world.foodBlocks.set(k, {
        id: uuid(), x, y,
        emoji: randomFoodEmoji('lq'),
        quality: 'lq', units, maxUnits: units,
      });
    }
  }

  // ── Farm crop spawning ──

  static maybeSpawnCrops(world: World): void {
    const toDelete: string[] = [];
    for (const [fk, fm] of world.farms) {
      fm.spawnTimerMs -= TICK_MS;
      if (fm.spawnTimerMs > 0) continue;

      const r = FARM_SPAWN_RADIUS;
      let nearbyFood = 0;
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dy) > r) continue;
          const fx = fm.x + dx;
          const fy = fm.y + dy;
          if (world.foodBlocks.has(key(fx, fy))) nearbyFood++;
        }
      }

      fm.spawnTimerMs = rndi(FARM_SPAWN_INTERVAL_RANGE[0], FARM_SPAWN_INTERVAL_RANGE[1]);

      if (nearbyFood >= FARM_MAX_FOOD_IN_RADIUS) continue;

      let spawned = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        const dx = rndi(-r, r);
        const dy = rndi(-r, r);
        if (dx === 0 && dy === 0) continue;
        const x = fm.x + dx;
        const y = fm.y + dy;
        if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
        if (world.grid.isCellOccupied(x, y)) continue;
        const units = rndi(FOOD_HQ_UNITS[0], FOOD_HQ_UNITS[1]);
        world.foodBlocks.set(key(x, y), {
          id: uuid(), x, y,
          emoji: randomFoodEmoji('hq'),
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
        units: WATER_SMALL_UNITS,
        maxUnits: WATER_SMALL_UNITS,
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
      if (c.x < 0 || c.y < 0 || c.x >= GRID_SIZE || c.y >= GRID_SIZE) return false;
      if (world.grid.isCellOccupied(c.x, c.y)) return false;
    }
    const block = {
      id: uuid(), x, y,
      units: WATER_LARGE_UNITS,
      maxUnits: WATER_LARGE_UNITS,
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
          const x = rndi(0, GRID_SIZE - 2);
          const y = rndi(0, GRID_SIZE - 2);
          if (Spawner.spawnWaterBlock(world, x, y, 'large')) break;
        }
      } else {
        for (let attempt = 0; attempt < 200; attempt++) {
          const x = rndi(0, GRID_SIZE - 1);
          const y = rndi(0, GRID_SIZE - 1);
          if (Spawner.spawnWaterBlock(world, x, y, 'small')) break;
        }
      }
    }
  }

  // ── Tree spawning ──

  static addTree(world: World): boolean {
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = rndi(0, GRID_SIZE - 1);
      const y = rndi(0, GRID_SIZE - 1);
      if (world.grid.isCellOccupied(x, y)) continue;
      const units = rndi(TREE_UNIT_RANGE[0], TREE_UNIT_RANGE[1]);
      const maxAgeMs = rndi(TREE_MAX_AGE_RANGE[0], TREE_MAX_AGE_RANGE[1]);
      world.treeBlocks.set(key(x, y), {
        id: uuid(), x, y,
        emoji: randomTreeEmoji(),
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
      Spawner.addTree(world);
    }
  }

  // ── Seedling / tree passive spawns ──

  static trySpawnSeedling(world: World, originX: number, originY: number): boolean {
    let nearWater = false;
    for (const wb of world.waterBlocks.values()) {
      if (manhattan(originX, originY, wb.x, wb.y) <= TREE_WATER_REQUIRED_FOR_SEEDLING) {
        nearWater = true;
        break;
      }
    }
    if (!nearWater) return false;

    const r = TREE_SEEDLING_RADIUS;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = originX + rndi(-r, r);
      const y = originY + rndi(-r, r);
      if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
      if (world.grid.isCellOccupied(x, y)) continue;
      const dur = rndi(TREE_SEEDLING_GROWTH_RANGE[0], TREE_SEEDLING_GROWTH_RANGE[1]);
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
    const r = TREE_FOOD_RADIUS;
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = treeX + rndi(-r, r);
      const y = treeY + rndi(-r, r);
      if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
      if (world.grid.isCellOccupied(x, y)) continue;
      return Spawner.addCrop(world, x, y);
    }
    return false;
  }

  static tickSeedlings(world: World): void {
    const toConvert: string[] = [];
    for (const [k, s] of world.seedlings) {
      let nearWater = false;
      for (const wb of world.waterBlocks.values()) {
        if (manhattan(s.x, s.y, wb.x, wb.y) <= 5) { nearWater = true; break; }
      }
      s.growthElapsedMs += nearWater ? TICK_MS : TICK_MS / 100;
      if (s.growthElapsedMs >= s.growthDurationMs) {
        toConvert.push(k);
      }
    }
    for (const k of toConvert) {
      const s = world.seedlings.get(k)!;
      world.seedlings.delete(k);
      const units = rndi(TREE_UNIT_RANGE[0], TREE_UNIT_RANGE[1]);
      const maxAgeMs = rndi(TREE_MAX_AGE_RANGE[0], TREE_MAX_AGE_RANGE[1]);
      world.treeBlocks.set(k, {
        id: uuid(), x: s.x, y: s.y,
        emoji: randomTreeEmoji(),
        units, maxUnits: units,
        ageTotalMs: 0, maxAgeMs,
      });
      log(world, 'spawn', `seedling grew into tree @${s.x},${s.y}`, null, { x: s.x, y: s.y });
    }
  }

  // ── Seedling near water ──

  static tickSeedlingNearWater(world: World): void {
    const seen = new Set<string>();
    for (const wb of world.waterBlocks.values()) {
      if (seen.has(wb.id)) continue;
      seen.add(wb.id);
      if (Math.random() < TREE_SEEDLING_NEAR_WATER_CHANCE) {
        for (let attempt = 0; attempt < 10; attempt++) {
          const x = wb.x + rndi(-3, 3);
          const y = wb.y + rndi(-3, 3);
          if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
          if (world.grid.isCellOccupied(x, y)) continue;
          const dur = rndi(TREE_SEEDLING_GROWTH_RANGE[0], TREE_SEEDLING_GROWTH_RANGE[1]);
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

  // ── Poop proximity utility ──

  static hasPoopNearby(world: World, x: number, y: number, radius: number): boolean {
    for (const poop of world.poopBlocks.values()) {
      if (manhattan(x, y, poop.x, poop.y) <= radius) return true;
    }
    return false;
  }

  // ── Tree passive spawns ──

  static tickTreePassiveSpawns(world: World): void {
    for (const tree of world.treeBlocks.values()) {
      if (tree.units <= 0) continue;
      const nearPoop = Spawner.hasPoopNearby(world, tree.x, tree.y, TREE_POOP_BOOST_SEEDLING_RADIUS);
      const hydrated = Spawner.hasWaterNearby(world, tree.x, tree.y, TREE_WATER_REQUIRED_FOR_SEEDLING);
      let seedlingChance = TREE_SEEDLING_PASSIVE_CHANCE;
      if (hydrated) seedlingChance *= 3;
      if (nearPoop) seedlingChance *= 2;
      if (Math.random() < seedlingChance) {
        Spawner.trySpawnSeedling(world, tree.x, tree.y);
      } else if (nearPoop && Math.random() < TREE_FOOD_PASSIVE_CHANCE) {
        Spawner.trySpawnFoodNearTree(world, tree.x, tree.y);
      }
    }
  }

  static hasWaterNearby(world: World, x: number, y: number, radius: number): boolean {
    for (const wb of world.waterBlocks.values()) {
      if (manhattan(x, y, wb.x, wb.y) <= radius) return true;
    }
    return false;
  }

  // ── Saltwater spawning ──

  static seedInitialSaltWater(world: World, count: number): void {
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < count; i++) {
      const bodySize = rndi(SALT_WATER_BODY_SIZE[0], SALT_WATER_BODY_SIZE[1]);
      const startX = rndi(3, GRID_SIZE - 4);
      const startY = rndi(3, GRID_SIZE - 4);
      const frontier: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
      let placed = 0;
      while (frontier.length > 0 && placed < bodySize) {
        const idx = Math.floor(Math.random() * frontier.length);
        const cell = frontier[idx];
        frontier[idx] = frontier[frontier.length - 1];
        frontier.pop();
        const k = key(cell.x, cell.y);
        if (world.saltWaterBlocks.has(k)) continue;
        if (world.grid.isCellOccupied(cell.x, cell.y)) continue;
        world.saltWaterBlocks.set(k, { id: uuid(), x: cell.x, y: cell.y });
        placed++;
        for (const [dx, dy] of dirs) {
          const nx = cell.x + dx;
          const ny = cell.y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
          if (!world.saltWaterBlocks.has(key(nx, ny))) {
            frontier.push({ x: nx, y: ny });
          }
        }
      }
    }
  }

  // ── Cloud / rain ──

  static tickClouds(world: World): void {
    const totalCells = GRID_SIZE * GRID_SIZE;
    const seenWater = new Set<string>();
    let waterCellCount = 0;
    for (const wb of world.waterBlocks.values()) {
      if (!seenWater.has(wb.id)) {
        seenWater.add(wb.id);
        waterCellCount += wb.cells.length;
      }
    }
    const currentCoverage = waterCellCount / totalCells;
    const target = CLOUD_TARGET_WATER_COVERAGE;
    const dynamicMultiplier = Math.max(0.1, Math.min(4, (target / Math.max(0.001, currentCoverage))));

    // Spawn new rain cloud
    if (world.cloudSpawnRate > 0) {
      world._nextCloudSpawnMs -= TICK_MS;
      if (world._nextCloudSpawnMs <= 0) {
        const x = rndi(0, GRID_SIZE - 1);
        const y = rndi(0, GRID_SIZE - 1);
        const lifetime = rndi(CLOUD_LIFETIME_RANGE[0], CLOUD_LIFETIME_RANGE[1]);
        world.clouds.push({
          id: uuid(), x, y, xF: x,
          spawnedAtMs: performance.now(),
          lifetimeMs: lifetime,
          totalLifetimeMs: lifetime,
          rained: false,
        });
        const baseInterval = rndi(CLOUD_SPAWN_INTERVAL_RANGE[0], CLOUD_SPAWN_INTERVAL_RANGE[1]);
        world._nextCloudSpawnMs = Math.max(1000, baseInterval / (world.cloudSpawnRate * dynamicMultiplier));
      }
    }

    // Decorative clouds
    if (Math.random() < 0.025) {
      const x = rndi(-2, GRID_SIZE - 1);
      const y = rndi(0, GRID_SIZE - 1);
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
      cloud.lifetimeMs -= TICK_MS;

      const progress = 1 - cloud.lifetimeMs / cloud.totalLifetimeMs;
      let speed: number;
      if (progress < 0.35 || progress > 0.65) {
        speed = cloud.decorative ? 0.04 : 0.05;
      } else {
        speed = cloud.decorative ? 0.025 : 0.004;
      }
      cloud.xF = (cloud.xF ?? cloud.x) + speed;

      // Rain at mid-life (rain clouds only)
      if (!cloud.rained && cloud.lifetimeMs < (cloud.totalLifetimeMs * 0.5)) {
        cloud.rained = true;
        const isLarge = Math.random() >= CLOUD_SMALL_CHANCE;
        const size = isLarge ? 'large' as const : 'small' as const;
        for (let attempt = 0; attempt < 20; attempt++) {
          const rx = Math.round(cloud.xF) + rndi(-3, 3);
          const ry = cloud.y + rndi(-3, 3);
          if (Spawner.spawnWaterBlock(world, rx, ry, size)) break;
        }
      }

      if (cloud.lifetimeMs > 0) {
        remaining.push(cloud);
      }
    }
    world.clouds = remaining;
  }

  // ── Egg spawning and hatching ──
  // Eggs spawn from large water blocks (0.0002 chance/tick/large block), continuously,
  // regardless of agent count.

  static tickEggs(world: World): void {
    // Spawn eggs from large water blocks
    const seenWater = new Set<string>();
    for (const wb of world.waterBlocks.values()) {
      if (seenWater.has(wb.id)) continue;
      seenWater.add(wb.id);
      if (wb.size !== 'large') continue;
      if (Math.random() >= EGG_SPAWN_CHANCE_PER_LARGE_WATER) continue;

      // Place egg adjacent to a water cell
      for (const cell of wb.cells) {
        const adj: [number, number][] = [
          [cell.x + 1, cell.y], [cell.x - 1, cell.y],
          [cell.x, cell.y + 1], [cell.x, cell.y - 1],
        ];
        let placed = false;
        for (const [nx, ny] of adj) {
          if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
          if (world.grid.isCellOccupied(nx, ny)) continue;
          world.eggs.set(key(nx, ny), {
            id: uuid(), x: nx, y: ny,
            hatchTimerMs: EGG_HATCH_TIME_MS,
          });
          log(world, 'spawn', `Egg appeared @${nx},${ny}`, null, { x: nx, y: ny });
          placed = true;
          break;
        }
        if (placed) break;
      }
    }

    // Hatch eggs
    const toHatch: string[] = [];
    for (const [k, egg] of world.eggs) {
      egg.hatchTimerMs -= TICK_MS;
      if (egg.hatchTimerMs <= 0) toHatch.push(k);
    }
    for (const k of toHatch) {
      const egg = world.eggs.get(k)!;
      world.eggs.delete(k);
      const agent = AgentFactory.createFromEgg(egg.x, egg.y);
      world.agents.push(agent);
      world.agentsById.set(agent.id, agent);
      world.agentsByCell.set(key(egg.x, egg.y), agent.id);
      world.totalBirths++;
      world.birthTimestamps.push(performance.now());
      world.familyRegistry.registerBirth(agent.familyName);
      log(world, 'spawn', `Egg hatched into ${agent.name} @${egg.x},${egg.y}`, agent.id, {});
    }
  }

  // ── Combined tick ──

  static tick(world: World): void {
    Spawner.maybeSpawnCrops(world);
    Spawner.tickSeedlings(world);
    Spawner.tickTreePassiveSpawns(world);
    Spawner.tickClouds(world);
    Spawner.tickSeedlingNearWater(world);
    Spawner.tickEggs(world);
  }
}
