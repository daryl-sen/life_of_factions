import { ACTION_DURATIONS, ACTION_BASE_ADDED, TUNE, ENERGY_CAP } from './constants.js';
import { key, rndi, clamp, manhattan, log } from './utils.js';
import { isBlocked } from './spatial.js';
import { getRel, setRel } from './relationships.js';
import { createFaction, setFaction } from './factions.js';
import { addAgentAt } from './agent.js';

function tryStartAction(a, type, payload) {
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

function lockAgent(world, id, ms) {
  const ag = world.agentsById.get(id);
  if (!ag) return;
  ag.lockMsRemaining = Math.max(ag.lockMsRemaining || 0, ms);
}

function chooseAttack(world, a, preferEnemies = false) {
  const candidates = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d === 0 || d > 2) continue;
      const id = world.agentsByCell.get(key(a.cellX + dx, a.cellY + dy));
      if (!id) continue;
      const b = world.agentsById.get(id);
      candidates.push(b);
    }
  }
  if (!candidates.length) return false;
  let pool = candidates;
  let p;
  if (preferEnemies) {
    const enemies = candidates.filter(
      (b) => a.factionId && b.factionId && a.factionId !== b.factionId
    );
    if (enemies.length) {
      pool = enemies;
      p = 1;
    }
  }
  if (p === undefined) {
    const hasEnemyNearby = candidates.some(
      (b) => a.factionId && b.factionId && a.factionId !== b.factionId
    );
    const bestRel = Math.max(
      ...candidates.map((b) => a.relationships.get(b.id) ?? 0)
    );
    const relPenalty = Math.max(0, bestRel) * 0.6;
    p = clamp(a.aggression + (hasEnemyNearby ? 0.25 : 0) - relPenalty, 0, 1);
  }
  if (Math.random() >= p) return false;
  pool.sort((b1, b2) => {
    const f1 =
      a.factionId && b1.factionId && a.factionId !== b1.factionId ? -0.5 : 0;
    const f2 =
      a.factionId && b2.factionId && a.factionId !== b2.factionId ? -0.5 : 0;
    return getRel(a, b1.id) + f1 - (getRel(a, b2.id) + f2);
  });
  const target = pool[0];
  if (getRel(a, target.id) > 0.5 && Math.random() < 0.85) return false;
  if (tryStartAction(a, "attack", { targetId: target.id })) return true;
  return false;
}

function chooseHelpHealTalk(world, a) {
  const adj = [
    [a.cellX + 1, a.cellY],
    [a.cellX - 1, a.cellY],
    [a.cellX, a.cellY + 1],
    [a.cellX, a.cellY - 1],
  ];
  const neighbors = [];
  for (const [nx, ny] of adj) {
    const id = world.agentsByCell.get(key(nx, ny));
    if (!id) continue;
    neighbors.push(world.agentsById.get(id));
  }
  if (!neighbors.length) return false;
  const sameFactionNearby = neighbors.some(
    (b) => a.factionId && b.factionId && a.factionId === b.factionId
  );
  const pHelp = clamp(a.cooperation + (sameFactionNearby ? 0.25 : 0), 0, 1);
  if (Math.random() < pHelp) {
    const sorted = neighbors.slice().sort((b1, b2) => {
      const same1 =
        a.factionId && b1.factionId && a.factionId === b1.factionId
          ? -0.3
          : 0;
      const same2 =
        a.factionId && b2.factionId && a.factionId === b2.factionId
          ? -0.3
          : 0;
      const need1 =
        b1.health / b1.maxHealth < b2.health / b2.maxHealth ? -0.2 : 0.2;
      return (
        same1 +
        need1 -
        (same2 +
          (b2.health / b2.maxHealth < b1.health / b1.maxHealth ? -0.2 : 0.2))
      );
    });
    const targ = sorted[0];
    const doHeal = targ.health < targ.maxHealth * 0.85;
    const type = doHeal ? "heal" : "help";
    if (tryStartAction(a, type, { targetId: targ.id })) {
      lockAgent(world, a.id, a.action.remainingMs);
      lockAgent(world, targ.id, a.action.remainingMs);
      return true;
    }
  }
  const targ = neighbors[rndi(0, neighbors.length - 1)];
  const rel = getRel(a, targ.id);
  const pickQuarrel = rel < 0 && Math.random() < 0.5;
  const type = pickQuarrel ? "quarrel" : "talk";
  if (tryStartAction(a, type, { targetId: targ.id })) {
    lockAgent(world, a.id, a.action.remainingMs);
    lockAgent(world, targ.id, a.action.remainingMs);
    return true;
  }
  return false;
}

export function considerInteract(world, a) {
  if (a.energy < TUNE.energyLowThreshold) {
    chooseAttack(world, a, true);
  }
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
  if (chooseAttack(world, a)) return;
  if (chooseHelpHealTalk(world, a)) return;
}

export function processAction(world, a, dtMs) {
  if (!a.action) return;
  const act = a.action;
  if (a.energy < TUNE.energyLowThreshold && act.type !== "attack") {
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
      if (a.factionId === targ.factionId) {
        // dangerous, retaliation
        Math.random() < 0.3
          ? (targ.factionId = null)
          : chooseAttack(world, targ, false);
      }
      setRel(a, targ.id, getRel(a, targ.id) - 0.2);

      log(world, "attack", `${a.name} hit ${targ.name}`, a.id, {
        to: targ.id,
      });
      if (targ.health <= 0 && a.level < TUNE.levelCap) {
        a.level++;
        a.maxHealth += 8;
        a.attack += 1.5;
        log(world, "level", `${a.name} leveled to ${a.level}`, a.id, {});
      }
    } else if (act.type === "heal" && targ) {
      targ.health = Math.min(targ.maxHealth, targ.health + 2);
      log(world, "heal", `${a.name} healed ${targ.name}`, a.id, {
        to: targ.id,
      });
    } else if (act.type === "help" && targ) {
      const high = a.energy > ENERGY_CAP * 0.7;
      const ratio = high ? 0.2 : 0.1;
      const transfer = Math.max(0, a.energy * ratio);
      if (transfer > 0) {
        a.energy = Math.max(0, a.energy - transfer);
        targ.energy = Math.min(ENERGY_CAP, targ.energy + transfer);
        log(
          world,
          "help",
          `${a.name} gave ${transfer.toFixed(1)} energy to ${targ.name}`,
          a.id,
          { to: targ.id, transfer }
        );
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
        (Math.random() < 0.75 ? 0.14 : -0.06) *
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
    if (targ2 && !a.factionId && !targ2.factionId) {
      const rel = getRel(a, targ2.id);
      if (
        (act.type === "talk" || act.type === "help" || act.type === "heal") &&
        rel >= TUNE.factionFormRelThreshold
      ) {
        createFaction(world, [a, targ2]);
      }
    }
    if (act.type === "help" && targ2 && a.factionId) {
      if (
        Math.random() < TUNE.helpConvertChance &&
        getRel(a, targ2.id) >= TUNE.helpConvertRelThreshold &&
        targ2.factionId !== a.factionId
      ) {
        setFaction(world, targ2, a.factionId, "recruitment");
      }
    }
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
          child.aggression = clamp(
            (a.aggression + targ2.aggression) / 2,
            0,
            1
          );
          child.cooperation = clamp(
            (a.cooperation + targ2.cooperation) / 2,
            0,
            1
          );
          child.travelPref =
            Math.random() < 0.5 ? a.travelPref : targ2.travelPref;
          const pa = a.factionId || null,
            pb = targ2.factionId || null;
          let chosen = null;
          if (pa && pb) chosen = Math.random() < 0.5 ? pa : pb;
          else chosen = pa || pb;
          if (chosen) setFaction(world, child, chosen, "birth");
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
