import { GRID_SIZE } from '../../../core/constants';
import { key, uuid, rndi, log, manhattan } from '../../../core/utils';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';

// ── Constants ──
const FARM_WOOD_COST = 3;
const FARM_ENERGY_COST = 6;
const FARM_MAX_SPAWNS = 10;
const FARM_SPAWN_INTERVAL_RANGE: [number, number] = [15000, 25000];
const XP_PER_BUILD_FARM = 15;
const BUILD_INSPIRATION_GAIN = 25;

export function onBuildFarmComplete(world: World, agent: Agent): void {
  if (agent.inventory.wood < FARM_WOOD_COST || agent.energy < FARM_ENERGY_COST) return;

  // Faction members may only build within their own territory
  if (agent.factionId) {
    const flag = world.flags.get(agent.factionId);
    const faction = world.factions.get(agent.factionId);
    if (flag && faction) {
      const inTerritory = manhattan(agent.cellX, agent.cellY, flag.x, flag.y) <= faction.territoryRadius();
      if (!inTerritory) return;
    }
  }

  const adj: [number, number][] = [
    [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
    [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
  ];
  const free = adj.filter(
    ([x, y]) => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE &&
      !world.grid.isBlocked(x, y) && !world.grid.farms.has(key(x, y))
  );
  if (!free.length) return;

  const [x, y] = free[rndi(0, free.length - 1)];
  agent.removeFromInventory('wood', FARM_WOOD_COST);
  agent.drainEnergy(FARM_ENERGY_COST);
  world.grid.farms.set(key(x, y), {
    id: uuid(), x, y,
    spawnsRemaining: FARM_MAX_SPAWNS,
    spawnTimerMs: rndi(FARM_SPAWN_INTERVAL_RANGE[0], FARM_SPAWN_INTERVAL_RANGE[1]),
  });
  agent.addXp(XP_PER_BUILD_FARM);
  agent.inspiration = Math.min(100, agent.inspiration + BUILD_INSPIRATION_GAIN);
  log(world, 'build', `${agent.name} built farm`, agent.id, { x, y });
  checkLevelUp(world, agent);
}

function checkLevelUp(world: World, agent: Agent): void {
  while (agent.canLevelUp()) {
    agent.levelUp();
    log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
  }
}
