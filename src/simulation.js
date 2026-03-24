import { GRID, BASE_TICK_MS, TUNE, ENERGY_CAP } from './constants.js';
import { key, rndi } from './utils.js';
import { isBlocked } from './spatial.js';
import { planPathTo } from './pathfinding.js';
import { reconcileFactions } from './factions.js';
import { applyFlagHealing, cleanDead } from './upkeep.js';
import { harvestAt } from './harvest.js';
import { seekFoodWhenHungry } from './food.js';
import { maybeSpawnCrops } from './spawn.js';
import { tryBuildFarm } from './building.js';
import { considerInteract, processAction } from './actions.js';

export function biasedRoam(world, a) {
  const range = 6;
  const candidates = [];
  for (let i = 0; i < 6; i++) {
    const rx = Math.max(0, Math.min(61, a.cellX + rndi(-range, range)));
    const ry = Math.max(0, Math.min(61, a.cellY + rndi(-range, range)));
    if (!isBlocked(world, rx, ry, a.id)) candidates.push({ x: rx, y: ry });
  }
  if (!candidates.length) return;
  const centerX = Math.floor(GRID / 2),
    centerY = Math.floor(GRID / 2);
  const distToCenter = (c) =>
    Math.abs(c.x - centerX) + Math.abs(c.y - centerY);
  let choice = candidates[0];
  if (a.travelPref === "wander") {
    choice = candidates[rndi(0, candidates.length - 1)];
  } else if (a.travelPref === "near") {
    if (a.factionId) {
      const flag = world.flags.get(a.factionId);
      if (flag) {
        let bestScore = Infinity;
        for (const c of candidates) {
          const d = Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y);
          const desired = 4;
          let crowd = 0;
          for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
              if (Math.abs(dx) + Math.abs(dy) > 2) continue;
              const id = world.agentsByCell.get(key(c.x + dx, c.y + dy));
              if (!id) continue;
              const b = world.agentsById.get(id);
              if (b && b.factionId === a.factionId) crowd++;
            }
          }
          const score = Math.abs(d - desired) + crowd * 0.7;
          if (score < bestScore) {
            bestScore = score;
            choice = c;
          }
        }
      } else {
        choice = candidates.reduce((best, c) =>
          distToCenter(c) < distToCenter(best) ? c : best
        );
      }
    } else {
      choice = candidates.reduce((best, c) =>
        distToCenter(c) < distToCenter(best) ? c : best
      );
    }
  } else if (a.travelPref === "far") {
    if (a.factionId) {
      const flag = world.flags.get(a.factionId);
      if (flag) {
        choice = candidates.reduce((best, c) =>
          Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y) >
          Math.abs(best.x - flag.x) + Math.abs(best.y - flag.y)
            ? c
            : best
        );
      } else {
        choice = candidates.reduce((best, c) =>
          distToCenter(c) > distToCenter(best) ? c : best
        );
      }
    } else {
      choice = candidates.reduce((best, c) =>
        distToCenter(c) > distToCenter(best) ? c : best
      );
    }
  }
  planPathTo(world, a, choice.x, choice.y);
}

export function updateTick(world) {
  world.tick++;
  const scarcity = world.crops.size / Math.max(1, world.agents.length);
  const budgetThisTick =
    scarcity < 0.25
      ? Math.max(6, Math.floor(world.pathBudgetMax * 0.5))
      : world.pathBudgetMax;
  world.pathBudget = budgetThisTick;
  world._pathWhitelist.clear();
  const n = world.agents.length;
  if (n > 0) {
    const eligible = world.agents.filter(
      (a) =>
        (a.lockMsRemaining || 0) <= 0 &&
        (!a.path || a.pathIdx >= a.path.length) &&
        !a.action
    );
    let pool;
    if (eligible.length) {
      eligible.sort((a, b) => a.energy - b.energy);
      pool = eligible;
    } else pool = world.agents;
    const k = Math.min(budgetThisTick || 30, pool.length);
    for (let i = 0; i < k; i++) {
      const idx = (world._pathRR + i) % pool.length;
      world._pathWhitelist.add(pool[idx].id);
    }
    world._pathRR = (world._pathRR + k) % pool.length;
  }

  maybeSpawnCrops(world);
  for (const b of world.agents) b._underAttack = false;
  for (const b of world.agents) {
    if (
      b.action &&
      b.action.type === "attack" &&
      b.action.payload?.targetId
    ) {
      const t = world.agentsById.get(b.action.payload.targetId);
      if (t) t._underAttack = true;
    }
  }

  for (const a of world.agents) {
    a.ageTicks++;
    a.energy -= 0.01;
    a.lockMsRemaining = Math.max(
      0,
      (a.lockMsRemaining || 0) - BASE_TICK_MS
    );
    if (!a.action && a.lockMsRemaining <= 0) {
      /* noop */
    }
    if (a.energy < TUNE.energyLowThreshold) {
      if (a.action && a.action.type !== "attack") a.action = null;
    }
    if (a.action) {
      processAction(world, a, BASE_TICK_MS);
    } else {
      const locked = a.lockMsRemaining > 0 && !a._underAttack;
      if (!locked) {
        if (a.path && a.pathIdx < a.path.length) {
          const step = a.path[a.pathIdx];
          if (!isBlocked(world, step.x, step.y, a.id)) {
            world.agentsByCell.delete(key(a.cellX, a.cellY));
            a.cellX = step.x;
            a.cellY = step.y;
            world.agentsByCell.set(key(a.cellX, a.cellY), a.id);
            a.pathIdx++;
            a.energy -= TUNE.moveEnergy;
            if (world.crops.has(key(a.cellX, a.cellY)))
              harvestAt(world, a, a.cellX, a.cellY);
          } else {
            a.path = null;
          }
        } else {
          a.path = null;
        }
        if (!a.path) {
          if (a.energy < TUNE.energyLowThreshold) {
            if (Math.random() < 0.4) {
              considerInteract(world, a);
            } else {
              if (world.crops.has(key(a.cellX, a.cellY)))
                harvestAt(world, a, a.cellX, a.cellY);
              else seekFoodWhenHungry(world, a);
            }
          } else {
            considerInteract(world, a);
            if (!a.path && !a.action) biasedRoam(world, a);
          }
        }
        if (a.energy >= 120 && Math.random() < 0.01) tryBuildFarm(world, a);
      }
    }
    if (a.energy < 0) a.energy = 0;
    if (a.energy > ENERGY_CAP) a.energy = ENERGY_CAP;
    if (a.energy === 0) {
      a.health -= (TUNE.starveHpPerSec * BASE_TICK_MS) / 1000;
    }
    if (a.energy >= ENERGY_CAP * 0.8) {
      a.health = Math.min(
        a.maxHealth,
        a.health + (TUNE.regenHpPerSec * BASE_TICK_MS) / 1000
      );
    }
  }

  if (world.tick % 25 === 0) reconcileFactions(world);
  applyFlagHealing(world);
  cleanDead(world);
}
