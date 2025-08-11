// systems/spawn.js
import { GRID, TUNE } from "../constants.js";
import { rndi, key } from "../utils.js";

export function maybeSpawnCrops(world) {
  if (world.crops.size >= TUNE.maxCrops) return;
  const attempts = GRID;
  const base = 0.006 * world.spawnMult;
  for (let i = 0; i < attempts; i++) {
    if (world.crops.size >= TUNE.maxCrops) break;
    const x = rndi(0, GRID - 1),
      y = rndi(0, GRID - 1);
    const k = key(x, y);
    if (
      world.crops.has(k) ||
      world.walls.has(k) ||
      world.farms.has(k) ||
      world.agentsByCell.has(k)
    )
      continue;
    let prob = base;
    for (const fm of world.farms.values()) {
      const d = Math.abs(x - fm.x) + Math.abs(y - fm.y);
      if (d <= TUNE.farmBoostRadius)
        prob *= 1 + (TUNE.farmBoostRadius - d + 1) * 0.6;
    }
    if (Math.random() < prob) {
      world.crops.set(k, { id: crypto.randomUUID(), x, y });
    }
  }
}
