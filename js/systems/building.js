// systems/building.js
import { TUNE } from "../constants.js";
import { key, rndi } from "../utils.js";
import { isBlocked } from "./spatial.js";
import { log } from "./harvest.js";

export function tryBuildWall(world, a) {
  if (Math.random() >= TUNE.buildWallChance) return;
  const adj = [
    [a.cellX + 1, a.cellY],
    [a.cellX - 1, a.cellY],
    [a.cellX, a.cellY + 1],
    [a.cellX, a.cellY - 1],
  ];
  const free = adj.filter(([x, y]) => !isBlocked(world, x, y));
  if (!free.length) return;
  const [x, y] = free[rndi(0, free.length - 1)];
  const k = key(x, y);
  world.walls.set(k, {
    id: crypto.randomUUID(),
    x,
    y,
    hp: rndi(TUNE.wallHp[0], TUNE.wallHp[1]),
    maxHp: TUNE.wallHp[1],
  });
  log(world, "build", `${a.name} built wall`, a.id, { x, y });
}

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
    ([x, y]) => !isBlocked(world, x, y) && !world.farms.has(key(x, y))
  );
  if (!free.length) return;
  const [x, y] = free[rndi(0, free.length - 1)];
  world.farms.set(key(x, y), { id: crypto.randomUUID(), x, y });
  a.energy -= TUNE.farmEnergyCost;
  log(world, "build", `${a.name} built farm`, a.id, { x, y });
}
