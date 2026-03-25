import { FACTION_COLORS, TUNE } from './constants.js';
import { generatePronounceableString, key, rndi, log, uuid } from './utils.js';
import { isBlocked, randomFreeCell } from './spatial.js';

function _nextFactionColor(world) {
  const used = new Set([...world.factions.values()].map((f) => f.color));
  for (let i = 0; i < FACTION_COLORS.length; i++) {
    const col = FACTION_COLORS[i];
    if (!used.has(col)) return col;
  }
  return FACTION_COLORS[world.factions.size % FACTION_COLORS.length];
}

function _placeFlag(world, fid, members) {
  if (world.flags.has(fid)) return;
  const cells = members.map((a) => ({ x: a.cellX, y: a.cellY }));
  const cx = Math.round(cells.reduce((s, c) => s + c.x, 0) / cells.length);
  const cy = Math.round(cells.reduce((s, c) => s + c.y, 0) / cells.length);
  let spot = { x: cx, y: cy };
  if (isBlocked(world, cx, cy)) spot = randomFreeCell(world);
  world.flags.set(fid, {
    id: uuid(),
    factionId: fid,
    x: spot.x,
    y: spot.y,
    hp: rndi(TUNE.flagHp[0], TUNE.flagHp[1]),
    maxHp: TUNE.flagHp[1],
  });
  world.flagCells.add(key(spot.x, spot.y));
  log(
    world,
    "faction",
    `Faction ${fid} placed flag @${spot.x},${spot.y}`,
    null,
    { factionId: fid }
  );
}

export function createFaction(world, members) {
  const fid = generatePronounceableString(6);
  const color = _nextFactionColor(world);
  world.factions.set(fid, { id: fid, members: new Set(), color });
  for (const a of members) {
    if (a.factionId) {
      const old = world.factions.get(a.factionId);
      if (old) old.members.delete(a.id);
    }
    a.factionId = fid;
    world.factions.get(fid).members.add(a.id);
  }
  _placeFlag(world, fid, members);
  const names = members.map((m) => m.name).join(" & ");
  log(world, "faction", `${names} founded faction ${fid}`, null, {
    factionId: fid,
  });
  return fid;
}

export function _disbandFaction(world, fid, reason = "rule: <=1 member") {
  const f = world.factions.get(fid);
  if (!f) return;
  for (const id of f.members) {
    const a = world.agentsById.get(id);
    if (a) a.factionId = null;
  }
  world.factions.delete(fid);
  const flag = world.flags.get(fid);
  if (flag) {
    world.flagCells.delete(key(flag.x, flag.y));
    world.flags.delete(fid);
    log(world, "destroy", `Flag ${fid} destroyed`, null, { factionId: fid });
  }
  log(world, "faction", `Faction ${fid} disbanded (${reason})`, null, {
    factionId: fid,
  });
}

function _destroyFactionIfLonely(world, fid) {
  const f = world.factions.get(fid);
  if (!f) return;
  let aliveCount = 0;
  for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
  if (aliveCount <= 1) _disbandFaction(world, fid, "<=1 alive");
}

export function setFaction(world, agent, newFid, reason = null) {
  const oldFid = agent.factionId || null;
  if (oldFid === newFid) return;
  if (oldFid) {
    const old = world.factions.get(oldFid);
    if (old) old.members.delete(agent.id);
  }
  agent.factionId = newFid || null;
  if (newFid) {
    if (!world.factions.has(newFid)) {
      world.factions.set(newFid, {
        id: newFid,
        members: new Set(),
        color: _nextFactionColor(world),
      });
      _placeFlag(world, newFid, [agent]);
    }
    world.factions.get(newFid).members.add(agent.id);
  }
  if (oldFid && !newFid) {
    log(
      world,
      "faction",
      `${agent.name} left faction ${oldFid}${reason ? ` (${reason})` : ""}`,
      agent.id,
      { from: oldFid, to: null, reason }
    );
    _destroyFactionIfLonely(world, oldFid);
  } else if (!oldFid && newFid) {
    log(
      world,
      "faction",
      `${agent.name} joined faction ${newFid}${reason ? ` (${reason})` : ""}`,
      agent.id,
      { from: null, to: newFid, reason }
    );
  } else if (oldFid && newFid) {
    log(
      world,
      "faction",
      `${agent.name} moved ${oldFid} → ${newFid}${
        reason ? ` (${reason})` : ""
      }`,
      agent.id,
      { from: oldFid, to: newFid, reason }
    );
    _destroyFactionIfLonely(world, oldFid);
  }
}

export function reconcileFactions(world) {
  const actual = new Map();
  for (const a of world.agents) {
    if (!a.factionId) continue;
    if (!actual.has(a.factionId)) actual.set(a.factionId, new Set());
    actual.get(a.factionId).add(a.id);
  }
  for (const [fid, set] of actual) {
    if (!world.factions.has(fid)) {
      world.factions.set(fid, {
        id: fid,
        members: set,
        color: _nextFactionColor(world),
      });
    } else {
      world.factions.get(fid).members = set;
    }
    if (!world.flags.has(fid)) {
      const members = [...set]
        .map((id) => world.agentsById.get(id))
        .filter(Boolean);
      if (members.length) _placeFlag(world, fid, members);
    }
  }
  for (const [fid, f] of [...world.factions]) {
    let aliveCount = 0;
    for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
    if (aliveCount <= 1) _disbandFaction(world, fid, "reconcile");
  }
}
