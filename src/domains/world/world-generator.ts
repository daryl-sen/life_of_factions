import type { IPosition } from '../../core/types';
import { TUNE } from '../../core/tuning';

export interface GeneratedWorld {
  readonly obstacles: ReadonlyArray<IPosition>;
  readonly waterCells: ReadonlyArray<IPosition>;
}

/**
 * World generator for v5.
 * Creates terrain with isolation pockets — Voronoi-style region barriers
 * divide the map into connected sub-regions to enable allopatric speciation.
 */
export class WorldGenerator {
  generate(opts: {
    gridSize: number;
    obstacleDensity?: number;
    pocketCount?: number;
  }): GeneratedWorld {
    const { gridSize } = opts;
    const obstacleDensity = opts.obstacleDensity ?? TUNE.world.obstacleDensity;
    const pocketCount     = opts.pocketCount     ?? TUNE.world.isolationPocketCount;

    const obstacles  = this.createIsolationBarriers(gridSize, pocketCount, obstacleDensity);
    const waterCells = this.placeWater(gridSize, obstacles);

    return { obstacles, waterCells };
  }

  private createIsolationBarriers(
    gridSize: number,
    pocketCount: number,
    density: number,
  ): IPosition[] {
    // Seed random region centers
    const seeds: IPosition[] = [];
    for (let i = 0; i < pocketCount; i++) {
      seeds.push({
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      });
    }

    // Assign each cell to its nearest seed (Voronoi)
    const region = new Uint8Array(gridSize * gridSize);
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let minDist = Infinity;
        let nearest = 0;
        for (let i = 0; i < seeds.length; i++) {
          const dx = x - seeds[i].x;
          const dy = y - seeds[i].y;
          const d  = dx * dx + dy * dy;
          if (d < minDist) { minDist = d; nearest = i; }
        }
        region[y * gridSize + x] = nearest;
      }
    }

    // Place obstacles on region boundaries and random scatter
    const obstacles: IPosition[] = [];
    const occupied  = new Set<string>();

    // Region boundary obstacles
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const r = region[y * gridSize + x];
        const neighbors = [[x + 1, y], [x, y + 1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= gridSize || ny >= gridSize) continue;
          if (region[ny * gridSize + nx] !== r && Math.random() < 0.6) {
            const k = `${x},${y}`;
            if (!occupied.has(k)) {
              occupied.add(k);
              obstacles.push({ x, y });
            }
          }
        }
      }
    }

    // Random scatter to reach target density
    const targetCount = Math.floor(gridSize * gridSize * density);
    let attempts = 0;
    while (obstacles.length < targetCount && attempts < targetCount * 10) {
      attempts++;
      const x = Math.floor(Math.random() * gridSize);
      const y = Math.floor(Math.random() * gridSize);
      const k = `${x},${y}`;
      if (!occupied.has(k)) {
        occupied.add(k);
        obstacles.push({ x, y });
      }
    }

    return obstacles;
  }

  private placeWater(gridSize: number, obstacles: ReadonlyArray<IPosition>): IPosition[] {
    const obstacleSet = new Set(obstacles.map(o => `${o.x},${o.y}`));
    const water: IPosition[] = [];

    // Place a few water bodies distributed across the map
    const bodyCount = 8;
    const bodySize  = 12;

    for (let b = 0; b < bodyCount; b++) {
      const cx = Math.floor(Math.random() * (gridSize - 10)) + 5;
      const cy = Math.floor(Math.random() * (gridSize - 10)) + 5;

      for (let i = 0; i < bodySize; i++) {
        const x = cx + Math.floor(Math.random() * 7) - 3;
        const y = cy + Math.floor(Math.random() * 7) - 3;
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
        const k = `${x},${y}`;
        if (!obstacleSet.has(k)) {
          water.push({ x, y });
        }
      }
    }

    return water;
  }
}
