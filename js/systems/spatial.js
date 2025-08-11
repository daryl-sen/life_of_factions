// systems/spatial.js
import { GRID } from "../constants.js";
import { key } from "../utils.js";

export function isBlocked(world, x, y, ignoreId = null) {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
  const k = key(x, y);
  if (world.walls.has(k)) return true;
  if (world.farms.has(k)) return true;
  if ([...world.flags.values()].some((f) => f.x === x && f.y === y))
    return true;
  const occ = world.agentsByCell.get(k);
  if (occ && occ !== ignoreId) return true;
  return false;
}
