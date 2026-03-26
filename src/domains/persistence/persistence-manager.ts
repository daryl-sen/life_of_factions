import { CELL, GRID, TUNE } from '../../shared/constants';
import { VERSION } from '../../shared/version';
import { key, rndi } from '../../shared/utils';
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
    const obstacles = [...world.obstacles.values()];
    const farms = [...world.farms.values()];
    const foodBlocks = [...world.foodBlocks.values()];
    const agents = world.agents.map((a) => ({
      id: a.id,
      name: a.name,
      cellX: a.cellX,
      cellY: a.cellY,
      health: a.health,
      maxHealth: a.maxHealth,
      energy: a.energy,
      maxEnergy: a.maxEnergy,
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
      aggression: a.aggression,
      cooperation: a.cooperation,
      fullness: a.fullness,
      hygiene: a.hygiene,
      social: a.social,
      inspiration: a.inspiration,
      xp: a.xp,
      inventory: a.inventory,
      poopTimerMs: a.poopTimerMs,
      diseased: a.diseased,
      babyMsRemaining: a.babyMsRemaining,
      maxAgeTicks: a.maxAgeTicks,
    }));
    return {
      meta: { version: VERSION, savedAt: Date.now() },
      grid: { CELL, GRID },
      state: {
        tick: world.tick,
        speedPct: world.speedPct,
        cloudSpawnRate: world.cloudSpawnRate,
        drawGrid: world.drawGrid,
        pauseOnBlur: world.pauseOnBlur,
        totalBirths: world.totalBirths,
        totalDeaths: world.totalDeaths,
        factionSort: world.factionSort,
      },
      factions,
      flags,
      obstacles,
      farms,
      foodBlocks,
      waterBlocks: PersistenceManager._serializeWaterBlocks(world),
      treeBlocks: [...world.treeBlocks.values()],
      seedlings: [...world.seedlings.values()],
      lootBags: [...world.lootBags.values()],
      poopBlocks: [...world.poopBlocks.values()],
      agents,
      log: { limit: world.log.limit, arr: world.log.arr },
      selectedId: world.selectedId,
      activeLogCats: [...world.activeLogCats],
      activeLogAgentId: world.activeLogAgentId || null,
    };
  }

  private static _serializeWaterBlocks(world: World): unknown[] {
    const seen = new Set<string>();
    const result: unknown[] = [];
    for (const wb of world.waterBlocks.values()) {
      if (seen.has(wb.id)) continue;
      seen.add(wb.id);
      result.push({
        id: wb.id, x: wb.x, y: wb.y,
        units: wb.units, maxUnits: wb.maxUnits,
        size: wb.size, cells: wb.cells,
      });
    }
    return result;
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
    world.cloudSpawnRate = d.state?.cloudSpawnRate ?? world.cloudSpawnRate;
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
      world.flags.set(fl.factionId, {
        ...fl,
        storage: fl.storage ?? { food: 0, water: 0, wood: 0 },
      });
      world.flagCells.add(key(fl.x, fl.y));
    }
    for (const o of d.obstacles || d.walls || [])
      world.obstacles.set(key(o.x, o.y), { ...o, emoji: o.emoji || '🪨' });
    for (const fm of d.farms || []) {
      world.farms.set(key(fm.x, fm.y), {
        ...fm,
        spawnsRemaining: fm.spawnsRemaining ?? TUNE.farm.maxSpawns,
        spawnTimerMs: fm.spawnTimerMs ?? rndi(TUNE.farm.spawnIntervalRange[0], TUNE.farm.spawnIntervalRange[1]),
      });
    }
    for (const c of (d.foodBlocks || d.crops || [])) {
      world.foodBlocks.set(key(c.x, c.y), {
        id: c.id,
        x: c.x,
        y: c.y,
        emoji: c.emoji,
        quality: c.quality ?? 'lq',
        units: c.units ?? 1,
        maxUnits: c.maxUnits ?? 1,
      });
    }

    // Restore water blocks
    for (const wb of d.waterBlocks || []) {
      const block = {
        id: wb.id, x: wb.x, y: wb.y,
        units: wb.units ?? 5, maxUnits: wb.maxUnits ?? 5,
        size: wb.size ?? 'small',
        cells: wb.cells ?? [{ x: wb.x, y: wb.y }],
      };
      for (const c of block.cells) {
        world.waterBlocks.set(key(c.x, c.y), block);
      }
    }
    // Restore tree blocks
    for (const tb of d.treeBlocks || []) {
      world.treeBlocks.set(key(tb.x, tb.y), {
        id: tb.id, x: tb.x, y: tb.y,
        emoji: tb.emoji, units: tb.units ?? 3,
        maxUnits: tb.maxUnits ?? 3,
        ageTotalMs: tb.ageTotalMs ?? 0,
        maxAgeMs: tb.maxAgeMs ?? rndi(TUNE.tree.maxAgeRange[0], TUNE.tree.maxAgeRange[1]),
      });
    }
    // Restore seedlings
    for (const s of d.seedlings || []) {
      world.seedlings.set(key(s.x, s.y), {
        id: s.id, x: s.x, y: s.y,
        plantedAtTick: s.plantedAtTick ?? 0,
        growthDurationMs: s.growthDurationMs ?? 60000,
        growthElapsedMs: s.growthElapsedMs ?? 0,
      });
    }
    // Restore loot bags
    for (const lb of d.lootBags || []) {
      world.lootBags.set(key(lb.x, lb.y), {
        id: lb.id,
        x: lb.x,
        y: lb.y,
        inventory: lb.inventory ?? { food: 0, water: 0, wood: 0 },
        decayMs: lb.decayMs ?? 30000,
      });
    }
    // Restore poop blocks
    for (const pb of d.poopBlocks || []) {
      world.poopBlocks.set(key(pb.x, pb.y), {
        id: pb.id,
        x: pb.x,
        y: pb.y,
        decayMs: pb.decayMs ?? 30000,
      });
    }
    // Reset ephemeral cloud state
    world.clouds = [];
    world._nextCloudSpawnMs = 0;

    for (const a of d.agents || []) {
      let action = a.action ? { ...a.action } : null;
      // Backward compat: rename 'help' → 'share'
      if (action && (action as any).type === 'help') action.type = 'share';
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
        maxEnergy: a.maxEnergy ?? TUNE.maxEnergyBase,
        attack: a.attack,
        level: a.level,
        ageTicks: a.ageTicks,
        factionId: a.factionId || null,
        relationships: new Map(a.relationships || []),
        path: a.path || null,
        pathIdx: a.pathIdx || 0,
        action,
        lockMsRemaining: a.lockMsRemaining || 0,
        aggression: a.aggression ?? Math.random(),
        cooperation: a.cooperation ?? Math.random(),
        fullness: a.fullness ?? TUNE.fullness.start,
        hygiene: a.hygiene ?? TUNE.needs.hygieneStart,
        social: a.social ?? TUNE.needs.socialStart,
        inspiration: a.inspiration ?? TUNE.needs.inspirationStart,
        xp: a.xp ?? 0,
        inventory: a.inventory ?? { food: 0, water: 0, wood: 0 },
        poopTimerMs: a.poopTimerMs ?? 0,
        diseased: a.diseased ?? false,
        babyMsRemaining: a.babyMsRemaining ?? 0,
        maxAgeTicks: a.maxAgeTicks,
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
    if (dom.ranges.rngCloudRate) dom.ranges.rngCloudRate.value = String(world.cloudSpawnRate);
    if (dom.nums.numCloudRate) dom.nums.numCloudRate.value = String(world.cloudSpawnRate);
    if (dom.labels.lblCloudRate) dom.labels.lblCloudRate.textContent = world.cloudSpawnRate.toFixed(1) + '\u00d7';
  }
}
