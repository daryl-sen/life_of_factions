import { GRID_SIZE } from '../../../core/constants';
import { key, uuid, rndi, log } from '../../../core/utils';
import type { Organism } from '../../entity/organism';
import type { World } from '../../world/world';

// ── Constants ──
const FARM_WOOD_COST = 3;
const FARM_ENERGY_COST = 6;
const FARM_MAX_SPAWNS = 10;
const FARM_SPAWN_INTERVAL_RANGE: [number, number] = [15000, 25000];
const XP_PER_BUILD_FARM = 15;
const BUILD_INSPIRATION_GAIN = 25;

export function onBuildFarmComplete(world: World, organism: Organism): void {
  if (organism.inventory.wood < FARM_WOOD_COST || organism.energy < FARM_ENERGY_COST) return;

  const adj: [number, number][] = [
    [organism.cellX + 1, organism.cellY], [organism.cellX - 1, organism.cellY],
    [organism.cellX, organism.cellY + 1], [organism.cellX, organism.cellY - 1],
  ];
  const free = adj.filter(
    ([x, y]) => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE &&
      !world.grid.isBlocked(x, y) && !world.grid.farms.has(key(x, y))
  );
  if (!free.length) return;

  const [x, y] = free[rndi(0, free.length - 1)];
  organism.inventory.remove('wood', FARM_WOOD_COST);
  organism.drainEnergy(FARM_ENERGY_COST);
  world.grid.farms.set(key(x, y), {
    id: uuid(), x, y,
    spawnsRemaining: FARM_MAX_SPAWNS,
    spawnTimerMs: rndi(FARM_SPAWN_INTERVAL_RANGE[0], FARM_SPAWN_INTERVAL_RANGE[1]),
  });
  organism.addXp(XP_PER_BUILD_FARM);
  organism.needs.inspiration = Math.min(100, organism.needs.inspiration + BUILD_INSPIRATION_GAIN);
  log(world, 'build', `${organism.name} built farm`, organism.id, { x, y });
  checkLevelUp(world, organism);
}

function checkLevelUp(world: World, organism: Organism): void {
  while (organism.canLevelUp()) {
    organism.levelUp();
    log(world, 'level', `${organism.name} leveled to ${organism.level}`, organism.id, {});
  }
}
