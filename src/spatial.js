import { GRID } from './constants.js';
import { key } from './utils.js';

export function isBlocked(world, x, y, ignoreId = null) {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
  const k = key(x, y);
  if (world.walls.has(k)) return true;
  if (world.farms.has(k)) return true;
  if (world.flagCells.has(k)) return true;
  const occ = world.agentsByCell.get(k);
  if (occ && occ !== ignoreId) return true;
  return false;
}

export function randomFreeCell(world) {
  for (let tries = 0; tries < 5000; tries++) {
    const x = Math.floor(Math.random() * 62),
      y = Math.floor(Math.random() * 62);
    if (!isBlocked(world, x, y)) return { x, y };
  }
  return { x: 0, y: 0 };
}
