import { TUNE } from './constants.js';
import { key, rndi, log } from './utils.js';
import { isBlocked } from './spatial.js';

export function tryBuildFarm(world, a) {
  if (a.energy < TUNE.farmEnergyCost) return;
  if (Math.random() >= TUNE.buildFarmChance) return;
  const adj = [
    [a.cellX + 1, a.cellY],
    [a.cellX - 1, a.cellY],
    [a.cellX, a.cellY + 1],
    [a.cellX, a.cellY - 1],
  ];
  const free = adj.filter(
    ([x2, y2]) => !isBlocked(world, x2, y2) && !world.farms.has(key(x2, y2))
  );
  if (!free.length) return;
  const [x, y] = free[rndi(0, free.length - 1)];
  world.farms.set(key(x, y), { id: crypto.randomUUID(), x, y });
  a.energy -= TUNE.farmEnergyCost;
  log(world, "build", `${a.name} built farm`, a.id, { x, y });
}
