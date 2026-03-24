import { TUNE, ENERGY_CAP } from './constants.js';
import { key, log } from './utils.js';
import { _disbandFaction } from './factions.js';

export function applyFlagHealing(world) {
  for (const a of world.agents) {
    if (!a.factionId) continue;
    const flag = world.flags.get(a.factionId);
    if (!flag) continue;
    const d = Math.abs(a.cellX - flag.x) + Math.abs(a.cellY - flag.y);
    if (d <= TUNE.healAuraRadius)
      a.health = Math.min(a.maxHealth, a.health + TUNE.healAuraPerTick);
  }
}

export function cleanDead(world) {
  const removedIds = [];
  world.agents = world.agents.filter((a) => {
    if (a.health <= 0) {
      world.agentsByCell.delete(key(a.cellX, a.cellY));
      world.agentsById.delete(a.id);
      removedIds.push(a.id);
      if (a.factionId && world.factions.has(a.factionId)) {
        const f = world.factions.get(a.factionId);
        f.members.delete(a.id);
      }
      log(world, "death", `${a.name} died`, a.id, {});
      return false;
    }
    return true;
  });
  if (removedIds.length) {
    for (const a of world.agents) {
      for (const rid of removedIds) a.relationships.delete(rid);
    }
  }
  for (const a of world.agents) {
    for (const rid of a.relationships.keys()) {
      if (!world.agentsById.has(rid)) a.relationships.delete(rid);
    }
  }
  for (const [fid, f] of [...world.factions]) {
    let aliveCount = 0;
    for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
    if (aliveCount <= 1) _disbandFaction(world, fid, "no members");
  }
  const wallsToDelete = [];
  for (const [k, w] of world.walls) {
    if (w.hp <= 0) wallsToDelete.push(k);
  }
  for (const k of wallsToDelete) {
    const w = world.walls.get(k);
    world.walls.delete(k);
    if (w) log(world, "destroy", `Wall @${w.x},${w.y} destroyed`, null, {});
  }
}

export function levelCheck(world, a) {
  if (a.level >= TUNE.levelCap) return;
  if (a.energy > ENERGY_CAP * 0.7) {
    a.level++;
    if (a.level > TUNE.levelCap) a.level = TUNE.levelCap;
    if (a.level <= TUNE.levelCap) {
      a.maxHealth += 8;
      a.attack += 1.5;
      a.energy = Math.min(ENERGY_CAP, 140);
      log(world, "level", `${a.name} leveled to ${a.level}`, a.id, {});
    }
  }
}
