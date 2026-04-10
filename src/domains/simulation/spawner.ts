import { GRID_SIZE, TICK_MS } from '../../core/constants';
import { key, manhattan, rndi, log, uuid } from '../../core/utils';
import type { World } from '../world/world';
import type { OrganismFactory } from '../entity/organism-factory';

// ── Inlined food emojis ──
const FOOD_EMOJIS_LQ = ['🌽', '🍅', '🍓', '🫐', '🍇', '🥕'];
const FOOD_EMOJIS_HQ = ['🍎', '🍊', '🍋', '🍑', '🍒', '🥝'];

// ── Inlined TUNE constants ──
const FOOD_HQ_UNITS: [number, number] = [2, 4];
const FOOD_LQ_UNITS: [number, number] = [1, 2];

const WATER_SMALL_UNITS = 5;
const WATER_LARGE_UNITS = 20;
const WATER_SHRINK_THRESHOLD = 0.25;

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
  const arr = quality === 'hq' ? FOOD_EMOJIS_HQ : FOOD_EMOJIS_LQ;
  return arr[Math.floor(Math.random() * arr.length)];
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

  // ── Poop proximity utility ──

  static hasPoopNearby(world: World, x: number, y: number, radius: number): boolean {
    for (const poop of world.poopBlocks.values()) {
      if (manhattan(x, y, poop.x, poop.y) <= radius) return true;
    }
    return false;
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

      if (cloud.lifetimeMs > 0) remaining.push(cloud);
    }
    world.clouds = remaining;
  }

  // ── Egg spawning and hatching ──

  static tickEggs(world: World, factory: OrganismFactory): void {
    const seenWater = new Set<string>();
    for (const wb of world.waterBlocks.values()) {
      if (seenWater.has(wb.id)) continue;
      seenWater.add(wb.id);
      if (wb.size !== 'large') continue;
      if (Math.random() >= EGG_SPAWN_CHANCE_PER_LARGE_WATER) continue;

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

    const toHatch: string[] = [];
    for (const [k, egg] of world.eggs) {
      egg.hatchTimerMs -= TICK_MS;
      if (egg.hatchTimerMs <= 0) toHatch.push(k);
    }
    for (const k of toHatch) {
      const egg = world.eggs.get(k)!;
      world.eggs.delete(k);
      const organism = factory.create({ cellX: egg.x, cellY: egg.y });
      if (!organism) continue;
      world.addOrganism(organism);
      world.totalBirths++;
      world.birthTimestamps.push(performance.now());
      world.familyRegistry.registerBirth(organism.familyName);
      log(world, 'spawn', `Egg hatched into ${organism.name} @${egg.x},${egg.y}`, organism.id, {});
    }
  }

  // ── Combined tick ──

  static tick(world: World, factory?: OrganismFactory): void {
    Spawner.maybeSpawnCrops(world);
    Spawner.tickClouds(world);
    if (factory) Spawner.tickEggs(world, factory);
  }
}
