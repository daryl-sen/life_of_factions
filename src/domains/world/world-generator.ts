import { GRID_SIZE, OBSTACLE_EMOJIS } from '../../core/constants';
import { key, rndi, uuid } from '../../core/utils';
import { TUNE } from '../../core/tuning';
import type { World } from './world';
import { SimulationEngine } from '../simulation';

const SALT_WATER_SPAWN_RANGE: [number, number] = [1, 3];

/**
 * Extracts and expands v4's world setup logic (previously `seedEnvironment` in
 * `controls.ts`) into a dedicated module.
 *
 * v4.2: Adds Voronoi-style isolation barriers that divide the map into
 * semi-separated population pockets.
 */
export class WorldGenerator {
  /**
   * Seed a freshly cleared World with terrain, water, trees, food, obstacles,
   * farms, and isolation barriers.
   */
  seed(world: World): void {
    this._placeFarms(world);
    this._placeRandomObstacles(world);
    this._createIsolationBarriers(world, TUNE.world.isolationPocketCount);
    SimulationEngine.seedInitialSaltWater(world, rndi(SALT_WATER_SPAWN_RANGE[0], SALT_WATER_SPAWN_RANGE[1]));
    SimulationEngine.seedInitialTrees(world, rndi(8, 15));
    SimulationEngine.seedInitialWater(world, rndi(3, 6));
    SimulationEngine.seedInitialFood(world, rndi(5, 10));
    world.terrainField.recomputeAll(world.grid);
    world.terrainField.snapDisplay();
  }

  private _placeFarms(world: World): void {
    for (let i = 0; i < 4; i++) {
      const x = rndi(5, GRID_SIZE - 6);
      const y = rndi(5, GRID_SIZE - 6);
      world.farms.set(key(x, y), { id: uuid(), x, y, spawnsRemaining: 12, spawnTimerMs: rndi(15000, 25000) });
    }
  }

  private _placeRandomObstacles(world: World): void {
    const obstacleCount = rndi(30, 50);
    for (let i = 0; i < obstacleCount; i++) {
      const emoji = OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)];
      if (Math.random() < 0.4) {
        let placed = false;
        for (let attempt = 0; attempt < 50; attempt++) {
          const x = rndi(1, GRID_SIZE - 3);
          const y = rndi(1, GRID_SIZE - 3);
          if (!world.grid.isCellOccupied(x, y) &&
              !world.grid.isCellOccupied(x + 1, y) &&
              !world.grid.isCellOccupied(x, y + 1) &&
              !world.grid.isCellOccupied(x + 1, y + 1)) {
            const obs = { id: uuid(), x, y, emoji, hp: 24, maxHp: 24, size: '2x2' as const };
            world.obstacles.set(key(x, y),         obs);
            world.obstacles.set(key(x + 1, y),     obs);
            world.obstacles.set(key(x, y + 1),     obs);
            world.obstacles.set(key(x + 1, y + 1), obs);
            placed = true;
            break;
          }
        }
        if (!placed) {
          const { x, y } = world.grid.randomFreeCell();
          world.obstacles.set(key(x, y), { id: uuid(), x, y, emoji, hp: 12, maxHp: 12 });
        }
      } else {
        const { x, y } = world.grid.randomFreeCell();
        world.obstacles.set(key(x, y), { id: uuid(), x, y, emoji, hp: 12, maxHp: 12 });
      }
    }
  }

  /**
   * Voronoi-style isolation: pick `pocketCount` random seed cells, assign
   * every cell to its nearest seed, then place obstacles along the boundaries
   * between regions. Boundary cells are placed with ~40% probability to leave
   * occasional gaps for cross-region travel.
   */
  private _createIsolationBarriers(world: World, pocketCount: number): void {
    if (pocketCount < 2) return;

    // Pick random region seeds (avoid edges)
    const margin = 8;
    const seeds: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < pocketCount; i++) {
      seeds.push({ x: rndi(margin, GRID_SIZE - margin), y: rndi(margin, GRID_SIZE - margin) });
    }

    // Assign each cell to its nearest seed
    const region = new Int8Array(GRID_SIZE * GRID_SIZE);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        let minDist = Infinity;
        let nearest = 0;
        for (let s = 0; s < seeds.length; s++) {
          const dx = x - seeds[s].x;
          const dy = y - seeds[s].y;
          const d = dx * dx + dy * dy;
          if (d < minDist) { minDist = d; nearest = s; }
        }
        region[y * GRID_SIZE + x] = nearest;
      }
    }

    // Place obstacles on boundary cells (cells adjacent to a different region)
    const emoji = OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)];
    for (let y = 1; y < GRID_SIZE - 1; y++) {
      for (let x = 1; x < GRID_SIZE - 1; x++) {
        const r = region[y * GRID_SIZE + x];
        const isBoundary =
          region[y * GRID_SIZE + (x - 1)] !== r ||
          region[y * GRID_SIZE + (x + 1)] !== r ||
          region[(y - 1) * GRID_SIZE + x] !== r ||
          region[(y + 1) * GRID_SIZE + x] !== r;
        if (!isBoundary) continue;
        // ~40% fill — leave gaps for cross-region pathfinding
        if (Math.random() > 0.4) continue;
        if (world.grid.isCellOccupied(x, y)) continue;
        world.obstacles.set(key(x, y), { id: uuid(), x, y, emoji, hp: 12, maxHp: 12 });
      }
    }
  }
}
