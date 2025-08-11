// systems/upkeep.js
import { TUNE } from "../constants.js";
import { key } from "../utils.js";
import { log } from "./harvest.js";

export function applyFlagHealing(world) {
  for (const a of world.agents) {
    if (!a.factionId) continue;
    const flag = world.flags.get(a.factionId);
    if (!flag) continue;
    const d = Math.abs(a.cellX - flag.x) + Math.abs(a.cellY - flag.y);
    if (d <= TUNE.healAuraRadius) {
      a.health = Math.min(a.maxHealth, a.health + TUNE.healAuraPerTick);
    }
  }
}

export function cleanDead(world) {
  world.agents = world.agents.filter((a) => {
    if (a.health <= 0) {
      world.agentsByCell.delete(key(a.cellX, a.cellY));
      world.agentsById.delete(a.id);
      log(world, "death", `${a.name} died`, a.id, {});
      return false;
    }
    return true;
  });
  for (const [fid, f] of [...world.flags]) {
    if (f.hp <= 0 || !world.agents.some((a) => a.factionId === fid)) {
      world.flags.delete(fid);
      log(world, "destroy", `Flag ${fid} destroyed`, null, { factionId: fid });
    }
  }
  for (const [k, w] of [...world.walls]) {
    if (w.hp <= 0) {
      world.walls.delete(k);
      log(world, "destroy", `Wall @${w.x},${w.y} destroyed`, null, {});
    }
  }
}

export function levelCheck(world, a) {
  if (a.level >= TUNE.levelCap) return;
  if (a.energy > 220) {
    a.level++;
    if (a.level > TUNE.levelCap) a.level = TUNE.levelCap;
    if (a.level <= TUNE.levelCap) {
      a.maxHealth += 8;
      a.attack += 1.5;
      a.energy = 140;
      log(world, "level", `${a.name} leveled to ${a.level}`, a.id, {});
    }
  }
}
