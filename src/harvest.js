import { ENERGY_CAP, TUNE } from './constants.js';
import { key, manhattan } from './utils.js';
import { levelCheck } from './upkeep.js';

export function harvestAt(world, a, x, y) {
  const k = key(x, y);
  const crop = world.crops.get(k);
  if (!crop) return false;
  world.crops.delete(k);
  a.energy = Math.min(ENERGY_CAP, a.energy + TUNE.cropGain);
  levelCheck(world, a);
  if (a.factionId) {
    const recips = world.agents.filter(
      (m) =>
        m.factionId === a.factionId &&
        m.id !== a.id &&
        manhattan(a.cellX, a.cellY, m.cellX, m.cellY) <= 5
    );
    if (recips.length) {
      const share = TUNE.cropGain * 0.3,
        per = share / recips.length;
      for (const m of recips) m.energy = Math.min(ENERGY_CAP, m.energy + per);
    }
  }
  return true;
}
