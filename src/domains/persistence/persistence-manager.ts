import { CELL, GRID } from '../../shared/constants';
import { VERSION } from '../../shared/version';
import { key } from '../../shared/utils';
import type { World } from '../world';
import type { DomRefs } from '../ui/ui-manager';
import { Agent } from '../agent';
import { Faction, FactionManager } from '../faction';

export class PersistenceManager {
  static serialize(world: World): Record<string, unknown> {
    const factions = [...world.factions.values()].map((f) => ({
      id: f.id,
      color: f.color,
      members: [...f.members],
      createdAtTick: f.createdAtTick,
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
      meta: { version: VERSION, savedAt: Date.now() },
      grid: { CELL, GRID },
      state: {
        tick: world.tick,
        speedPct: world.speedPct,
        spawnMult: world.spawnMult,
        drawGrid: world.drawGrid,
        pauseOnBlur: world.pauseOnBlur,
        totalBirths: world.totalBirths,
        totalDeaths: world.totalDeaths,
        factionSort: world.factionSort,
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

  static export(world: World, doRenderLog: () => void): void {
    const blob = new Blob([JSON.stringify(PersistenceManager.serialize(world))], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      'emoji_life_' +
      new Date().toISOString().replace(/[:.]/g, '-') +
      '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
    world.log.push({
      t: performance.now(),
      cat: 'info',
      msg: 'State exported',
      actorId: null,
      extra: {},
    });
    doRenderLog();
  }

  static restore(
    world: World,
    data: Record<string, unknown>,
    opts: { doRenderLog: () => void; dom: DomRefs }
  ): void {
    const d = data as Record<string, any>;
    world.running = false;
    world.grid.clear();
    world.agents.length = 0;
    world.agentsById.clear();
    world.factions.clear();
    world.tick = d.state?.tick ?? 0;
    world.speedPct = d.state?.speedPct ?? world.speedPct;
    world.spawnMult = d.state?.spawnMult ?? world.spawnMult;
    world.drawGrid = d.state?.drawGrid ?? true;
    world.pauseOnBlur = d.state?.pauseOnBlur ?? false;
    world.totalBirths = d.state?.totalBirths ?? 0;
    world.totalDeaths = d.state?.totalDeaths ?? 0;
    world.factionSort = d.state?.factionSort ?? 'members';

    for (const f of d.factions || []) {
      const faction = new Faction(f.id, f.color, new Set(f.members || []), f.createdAtTick ?? 0);
      world.factions.set(f.id, faction);
    }
    for (const fl of d.flags || []) {
      world.flags.set(fl.factionId, { ...fl });
      world.flagCells.add(key(fl.x, fl.y));
    }
    for (const w of d.walls || [])
      world.walls.set(key(w.x, w.y), { ...w });
    for (const fm of d.farms || [])
      world.farms.set(key(fm.x, fm.y), { ...fm });
    for (const c of d.crops || [])
      world.crops.set(key(c.x, c.y), { ...c });

    for (const a of d.agents || []) {
      let action = a.action ? { ...a.action } : null;
      if (
        action?.payload?.targetId &&
        !(d.agents || []).some((x: Record<string, unknown>) => x.id === action!.payload!.targetId)
      ) {
        action = null;
      }
      const agent = new Agent({
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
        action,
        lockMsRemaining: a.lockMsRemaining || 0,
        travelPref: a.travelPref || 'near',
        aggression: a.aggression ?? Math.random(),
        cooperation: a.cooperation ?? Math.random(),
      });
      world.agents.push(agent);
      world.agentsById.set(agent.id, agent);
      world.agentsByCell.set(key(agent.cellX, agent.cellY), agent.id);
    }

    FactionManager.reconcile(world);
    if (world._rebuildAgentOptions) world._rebuildAgentOptions();
    opts.doRenderLog();
    world.log.push({
      t: performance.now(),
      cat: 'info',
      msg: 'State loaded',
      actorId: null,
      extra: {},
    });
    const { dom } = opts;
    if (dom.gridChk) dom.gridChk.checked = world.drawGrid;
    if (dom.pauseChk) dom.pauseChk.checked = world.pauseOnBlur;
    if (dom.factionSortEl) dom.factionSortEl.value = world.factionSort;
    if (dom.ranges.rngSpeed) dom.ranges.rngSpeed.value = String(world.speedPct);
    if (dom.nums.numSpeed) dom.nums.numSpeed.value = String(world.speedPct);
    if (dom.labels.lblSpeed) dom.labels.lblSpeed.textContent = `${world.speedPct}%`;
    if (dom.ranges.rngSpawn) dom.ranges.rngSpawn.value = String(world.spawnMult);
    if (dom.nums.numSpawn) dom.nums.numSpawn.value = String(world.spawnMult);
    if (dom.labels.lblSpawn) dom.labels.lblSpawn.textContent = world.spawnMult.toFixed(1) + '\u00d7';
  }
}
