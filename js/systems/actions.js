// systems/actions.js
import {
  ACTION_DURATIONS,
  ACTION_BASE_ADDED,
  BASE_TICK_MS,
  TUNE,
} from "../constants.js";
import { manhattan, rndi, clamp, key } from "../utils.js";
import { astar } from "../pathfinding.js";
import { isBlocked } from "./spatial.js";
import { harvestAt, log } from "./harvest.js";
import { tryBuildWall, tryBuildFarm } from "./building.js";

export const getRel = (a, bId) => a.relationships.get(bId) ?? 0;
export const setRel = (a, bId, val) =>
  a.relationships.set(bId, clamp(val, -1, 1));

export function planPathTo(world, a, gx, gy) {
  const path = astar({ x: a.cellX, y: a.cellY }, { x: gx, y: gy }, (x, y) =>
    isBlocked(world, x, y, a.id)
  );
  a.path = path;
  a.pathIdx = 0;
}

export function findNearest(world, a, coll) {
  let best = null,
    bestD = 1e9;
  for (const it of coll) {
    const d = Math.abs(a.cellX - it.x) + Math.abs(a.cellY - it.y);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best ? { target: best, dist: bestD } : null;
}

export function tryStartAction(a, type, payload) {
  if (a.action) return false;
  const [mn, mx] = ACTION_DURATIONS[type];
  a.action = {
    type,
    remainingMs: rndi(mn, mx) + ACTION_BASE_ADDED,
    tickCounterMs: 0,
    payload,
  };
  return true;
}

export function lockAgent(world, id, ms) {
  const ag = world.agentsById.get(id);
  if (!ag) return;
  ag.lockMsRemaining = Math.max(ag.lockMsRemaining || 0, ms);
}

export function considerInteract(world, a) {
  if (a.energy < TUNE.energyLowThreshold) return;

  // 1) Reproduction (adjacent; lock both)
  for (const [nx, ny] of [
    [a.cellX + 1, a.cellY],
    [a.cellX - 1, a.cellY],
    [a.cellX, a.cellY + 1],
    [a.cellX, a.cellY - 1],
  ]) {
    const id = world.agentsByCell.get(key(nx, ny));
    if (!id) continue;
    const b = world.agentsById.get(id);
    const rel = getRel(a, b.id);
    if (
      rel >= TUNE.reproduction.relationshipThreshold &&
      a.energy >= TUNE.reproduction.relationshipEnergy &&
      b.energy >= TUNE.reproduction.relationshipEnergy
    ) {
      if (tryStartAction(a, "reproduce", { targetId: b.id })) {
        const dur = a.action.remainingMs,
          reserve = 4;
        a.energy -= reserve;
        b.energy -= reserve;
        lockAgent(world, a.id, dur);
        lockAgent(world, b.id, dur);
        return;
      }
    }
  }

  // 2) Social (adjacent; lock both)
  const adj = [
    [a.cellX + 1, a.cellY],
    [a.cellX - 1, a.cellY],
    [a.cellX, a.cellY + 1],
    [a.cellX, a.cellY - 1],
  ];
  for (const [nx, ny] of adj) {
    const id = world.agentsByCell.get(key(nx, ny));
    if (!id) continue;
    const b = world.agentsById.get(id);
    const rel = getRel(a, b.id);
    const otherFaction =
      (a.factionId && b.factionId && a.factionId !== b.factionId) ||
      (!a.factionId && b.factionId) ||
      (a.factionId && !b.factionId);
    const hostileBias = otherFaction || rel < 0 ? 0.5 : 0.2;
    const r = Math.random();
    if (r >= hostileBias) {
      if (
        Math.random() < 0.65 &&
        tryStartAction(a, "talk", { targetId: b.id })
      ) {
        lockAgent(world, a.id, a.action.remainingMs);
        lockAgent(world, b.id, a.action.remainingMs);
        return;
      }
      if (
        Math.random() < 0.25 &&
        tryStartAction(a, "heal", { targetId: b.id })
      ) {
        lockAgent(world, a.id, a.action.remainingMs);
        lockAgent(world, b.id, a.action.remainingMs);
        return;
      }
      if (
        Math.random() < 0.25 &&
        tryStartAction(a, "help", { targetId: b.id })
      ) {
        lockAgent(world, a.id, a.action.remainingMs);
        lockAgent(world, b.id, a.action.remainingMs);
        return;
      }
    }
  }

  // 3) Combat (range ≤2; do NOT lock target)
  const candidates = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d === 0 || d > 2) continue;
      const id = world.agentsByCell.get(key(a.cellX + dx, a.cellY + dy));
      if (!id) continue;
      candidates.push(world.agentsById.get(id));
    }
  }
  if (candidates.length) {
    candidates.sort(
      (b1, b2) =>
        getRel(a, b1.id) -
        (a.factionId && b1.factionId && a.factionId !== b1.factionId
          ? -0.2
          : 0) -
        (getRel(a, b2.id) -
          (a.factionId && b2.factionId && a.factionId !== b2.factionId
            ? -0.2
            : 0))
    );
    const target = candidates[0];
    if (tryStartAction(a, "attack", { targetId: target.id })) return;
  }
}

export function processAction(world, a, dtMs) {
  if (!a.action) return;
  const act = a.action;

  // hungry override cancels everything except reproduction
  if (a.energy < TUNE.energyLowThreshold && act.type !== "reproduce") {
    a.action = null;
    return;
  }

  act.remainingMs -= dtMs;
  act.tickCounterMs += dtMs;
  const costPerMs = (TUNE.actionCost[act.type] || 1) / 1000;
  a.energy -= costPerMs * dtMs;

  const targ = act.payload?.targetId
    ? world.agentsById.get(act.payload.targetId)
    : null;
  if (targ) {
    const dist = manhattan(a.cellX, a.cellY, targ.cellX, targ.cellY);
    if (act.type === "attack") {
      if (dist > 2) {
        a.action = null;
        return;
      }
    } else {
      if (dist !== 1) {
        a.action = null;
        return;
      }
    }
  }

  if (act.tickCounterMs >= 500) {
    act.tickCounterMs = 0;
    if (act.type === "attack" && targ) {
      targ.health -= a.attack * 0.4;
      log(world, "attack", `${a.name} hit ${targ.name}`, a.id, { to: targ.id });
    } else if (act.type === "heal" && targ) {
      targ.health = Math.min(targ.maxHealth, targ.health + 2.0);
      log(world, "heal", `${a.name} healed ${targ.name}`, a.id, {
        to: targ.id,
      });
    } else if (act.type === "help" && targ) {
      const transfer = Math.min(6, Math.max(0, a.energy - 1));
      if (transfer > 0) {
        a.energy -= transfer;
        targ.energy += transfer;
        log(
          world,
          "help",
          `${a.name} gave ${transfer.toFixed(1)} energy to ${targ.name}`,
          a.id,
          { to: targ.id, transfer }
        );
      }
      if (targ.action) {
        targ.action.remainingMs *= 0.9;
      }
    } else if (act.type === "quarrel" && targ) {
      const delta =
        (Math.random() < 0.5 ? -0.1 : 0.1) *
        (a.factionId === targ.factionId ? 0.6 : 1);
      setRel(a, targ.id, getRel(a, targ.id) + delta);
      setRel(targ, a.id, getRel(targ, a.id) + delta);
      log(
        world,
        "quarrel",
        `${a.name} ${delta > 0 ? "made peace with" : "argued with"} ${
          targ.name
        }`,
        a.id,
        { to: targ.id, delta }
      );
    } else if (act.type === "talk" && targ) {
      const delta =
        (Math.random() < 0.75 ? +0.14 : -0.06) *
        (a.factionId === targ.factionId ? 1.1 : 0.8);
      setRel(a, targ.id, getRel(a, targ.id) + delta);
      setRel(targ, a.id, getRel(targ, a.id) + delta);
      log(world, "talk", `${a.name} talked with ${targ.name}`, a.id, {
        to: targ.id,
        delta,
      });
    }
  }

  if (act.remainingMs <= 0) {
    const targ2 = act.payload?.targetId
      ? world.agentsById.get(act.payload.targetId)
      : null;
    if (act.type === "reproduce" && targ2) {
      if (manhattan(a.cellX, a.cellY, targ2.cellX, targ2.cellY) === 1) {
        const spots = [
          [a.cellX + 1, a.cellY],
          [a.cellX - 1, a.cellY],
          [a.cellX, a.cellY + 1],
          [a.cellX, a.cellY - 1],
        ];
        const free = spots.find(([x, y]) => !isBlocked(world, x, y));
        if (free) {
          a.energy -= 12;
          targ2.energy -= 12;
          const [x, y] = free;
          const child = addAgentAt(world, x, y);
          child.energy = 60;
          child.health = 80;
          log(
            world,
            "reproduce",
            `${a.name} & ${targ2.name} had ${child.name}`,
            a.id,
            { child: child.id }
          );
        }
      }
    }
    a.action = null;
  }
}

export function addAgentAt(world, x, y) {
  const id = crypto.randomUUID();
  const a = {
    id,
    name: name6(),
    cellX: x,
    cellY: y,
    health: 100,
    maxHealth: 100,
    energy: 100,
    attack: TUNE.baseDamage,
    level: 1,
    ageTicks: 0,
    starvingSeconds: 0,
    factionId: null,
    relationships: new Map(),
    path: null,
    pathIdx: 0,
    action: null,
    lockMsRemaining: 0,
  };
  world.agents.push(a);
  world.agentsById.set(id, a);
  world.agentsByCell.set(key(x, y), id);
  return a;
}

import { name6 } from "../utils.js";

export function seekFoodWhenHungry(world, a) {
  if (world.crops.has(key(a.cellX, a.cellY))) {
    harvestAt(world, a, a.cellX, a.cellY);
    return;
  }
  const adj = [
    [a.cellX + 1, a.cellY],
    [a.cellX - 1, a.cellY],
    [a.cellX, a.cellY + 1],
    [a.cellX, a.cellY - 1],
  ];
  for (const [nx, ny] of adj) {
    if (world.crops.has(key(nx, ny))) {
      planPathTo(world, a, nx, ny);
      return;
    }
  }
  const near = findNearest(world, a, world.crops.values());
  if (near) {
    planPathTo(world, a, near.target.x, near.target.y);
    return;
  }

  if (world.farms.size) {
    let best = null,
      bestD = 1e9;
    for (const fm of world.farms.values()) {
      const d = Math.abs(a.cellX - fm.x) + Math.abs(a.cellY - fm.y);
      if (d < bestD) {
        bestD = d;
        best = fm;
      }
    }
    if (best && !isBlocked(world, best.x, best.y, a.id)) {
      planPathTo(world, a, best.x, best.y);
      return;
    }
  }

  for (let tries = 0; tries < 5; tries++) {
    const r = TUNE.lowEnergyExploreRange;
    const rx = clamp(a.cellX + rndi(-r, r), 0, 61);
    const ry = clamp(a.cellY + rndi(-r, r), 0, 61);
    if (!isBlocked(world, rx, ry, a.id)) {
      planPathTo(world, a, rx, ry);
      return;
    }
  }
}

export function addCrop(world, x, y) {
  if (world.crops.size >= TUNE.maxCrops) return false;
  const k = key(x, y);
  if (world.crops.has(k) || world.walls.has(k) || world.farms.has(k))
    return false;
  world.crops.set(k, { id: crypto.randomUUID(), x, y });
  log(world, "spawn", `crop @${x},${y}`, null, { x, y });
  return true;
}
