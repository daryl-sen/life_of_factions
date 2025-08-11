// systems/harvest.js
import { TUNE } from "../constants.js";
import { key } from "../utils.js";

export function harvestAt(world, a, x, y) {
  const k = key(x, y);
  const crop = world.crops.get(k);
  if (!crop) return false;
  world.crops.delete(k);
  a.energy += TUNE.cropGain;
  log(world, "harvest", `${a.name} harvested`, a.id, { x, y });

  if (a.factionId) {
    const adj = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of adj) {
      const id = world.agentsByCell.get(key(nx, ny));
      if (!id) continue;
      const b = world.agentsById.get(id);
      if (b.factionId === a.factionId) {
        const s = TUNE.cropGain * 0.35;
        b.energy += s;
        log(
          world,
          "share",
          `${a.name} shared ${s.toFixed(1)} with ${b.name}`,
          a.id,
          { to: b.id }
        );
      }
    }
  }
  return true;
}

export function log(world, cat, msg, actorId = null, extra = {}) {
  world.log.push({ t: performance.now(), cat, msg, actorId, extra });
}
