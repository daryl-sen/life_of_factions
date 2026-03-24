import { CELL, GRID } from './constants.js';
import { key } from './utils.js';
import { reconcileFactions } from './factions.js';

export function serializeWorld(world) {
  const factions = [...world.factions.values()].map((f) => ({
    id: f.id,
    color: f.color,
    members: [...f.members],
  }));
  const flags = [...world.flags.values()];
  const walls = [...world.walls.values()];
  const farms = [...world.farms.values()];
  const crops = [...world.crops.values()];
  const agents = world.agents.map((a) => ({
    id: a.id,
    name: a.name,
    cellX: a.cellX,
    cellY: a.cellY,
    health: a.health,
    maxHealth: a.maxHealth,
    energy: a.energy,
    attack: a.attack,
    level: a.level,
    ageTicks: a.ageTicks,
    factionId: a.factionId,
    relationships: [...a.relationships.entries()],
    path: a.path ? a.path.slice(a.pathIdx) : null,
    pathIdx: 0,
    action: a.action
      ? {
          type: a.action.type,
          remainingMs: a.action.remainingMs,
          tickCounterMs: a.action.tickCounterMs,
          payload: a.action.payload || null,
        }
      : null,
    lockMsRemaining: a.lockMsRemaining,
    travelPref: a.travelPref,
    aggression: a.aggression,
    cooperation: a.cooperation,
  }));
  return {
    meta: { version: "1.4.3-camera+ui", savedAt: Date.now() },
    grid: { CELL, GRID },
    state: {
      tick: world.tick,
      speedPct: world.speedPct,
      spawnMult: world.spawnMult,
      drawGrid: world.drawGrid,
    },
    factions,
    flags,
    walls,
    farms,
    crops,
    agents,
    log: { limit: world.log.limit, arr: world.log.arr },
    selectedId: world.selectedId,
    activeLogCats: [...world.activeLogCats],
    activeLogAgentId: world.activeLogAgentId || null,
  };
}

export function exportState(world, doRenderLog) {
  const blob = new Blob([JSON.stringify(serializeWorld(world))], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    "life_of_factions_" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
  world.log.push({
    t: performance.now(),
    cat: "info",
    msg: "State exported",
    actorId: null,
    extra: {},
  });
  doRenderLog();
}

export function restoreWorld(world, data, { doRenderLog, gridChk }) {
  world.running = false;
  world.walls.clear();
  world.crops.clear();
  world.farms.clear();
  world.flags.clear();
  world.flagCells.clear();
  world.agents.length = 0;
  world.agentsById.clear();
  world.agentsByCell.clear();
  world.factions.clear();
  world.tick = data.state?.tick ?? 0;
  world.speedPct = data.state?.speedPct ?? world.speedPct;
  world.spawnMult = data.state?.spawnMult ?? world.spawnMult;
  world.drawGrid = data.state?.drawGrid ?? true;
  for (const f of data.factions || [])
    world.factions.set(f.id, {
      id: f.id,
      color: f.color,
      members: new Set(f.members || []),
    });
  for (const fl of data.flags || []) {
    world.flags.set(fl.factionId, { ...fl });
    world.flagCells.add(key(fl.x, fl.y));
  }
  for (const w of data.walls || [])
    world.walls.set(key(w.x, w.y), { ...w });
  for (const fm of data.farms || [])
    world.farms.set(key(fm.x, fm.y), { ...fm });
  for (const c of data.crops || [])
    world.crops.set(key(c.x, c.y), { ...c });
  for (const a of data.agents || []) {
    const ag = {
      id: a.id,
      name: a.name,
      cellX: a.cellX,
      cellY: a.cellY,
      health: a.health,
      maxHealth: a.maxHealth,
      energy: a.energy,
      attack: a.attack,
      level: a.level,
      ageTicks: a.ageTicks,
      factionId: a.factionId || null,
      relationships: new Map(a.relationships || []),
      path: a.path || null,
      pathIdx: a.pathIdx || 0,
      action: a.action ? { ...a.action } : null,
      lockMsRemaining: a.lockMsRemaining || 0,
      travelPref: a.travelPref || "near",
      aggression: a.aggression ?? Math.random(),
      cooperation: a.cooperation ?? Math.random(),
      replanAtTick: 0,
      goal: null,
    };
    if (
      ag.action &&
      ag.action.payload?.targetId &&
      !(data.agents || []).some((x) => x.id === ag.action.payload.targetId)
    )
      ag.action = null;
    world.agents.push(ag);
    world.agentsById.set(ag.id, ag);
    world.agentsByCell.set(key(ag.cellX, ag.cellY), ag.id);
  }
  reconcileFactions(world);
  if (world._rebuildAgentOptions) world._rebuildAgentOptions();
  doRenderLog();
  world.log.push({
    t: performance.now(),
    cat: "info",
    msg: "State loaded",
    actorId: null,
    extra: {},
  });
  if (gridChk) gridChk.checked = world.drawGrid;
}
