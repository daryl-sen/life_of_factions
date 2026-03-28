import { CELL_PX, GRID_SIZE } from '../../core/constants';
import { key, rndi, RingLog } from '../../core/utils';
import type { ResourceMemoryType, IResourceMemoryEntry } from '../../core/types';
import type { World } from '../world';
import type { DomRefs } from '../ui/ui-manager';
import { Agent } from '../entity/agent';
import { Genome } from '../genetics';
import { Faction, FactionManager } from '../faction';

const VERSION = '4.1.2';

// Inlined TUNE constants
const FARM_MAX_SPAWNS = 12;
const FARM_SPAWN_INTERVAL_RANGE: [number, number] = [15000, 25000];
const TREE_MAX_AGE_RANGE: [number, number] = [780000, 1020000];

const AUTOSAVE_KEY = 'emoji_life_autosave';
const AUTOSAVE_INTERVAL_MS = 60_000;

export class PersistenceManager {
  private static _lastAutosaveMs = 0;

  static maybeAutosave(world: World): void {
    const now = performance.now();
    if (now - PersistenceManager._lastAutosaveMs < AUTOSAVE_INTERVAL_MS) return;
    PersistenceManager._lastAutosaveMs = now;

    const data = PersistenceManager.serialize(world);
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        try {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
        } catch { /* QuotaExceededError — skip silently */ }
      });
    } else {
      setTimeout(() => {
        try {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
        } catch { /* QuotaExceededError — skip silently */ }
      }, 0);
    }
  }

  static loadAutosave(): Record<string, unknown> | null {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  static clearAutosave(): void {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch { /* ignore */ }
  }
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
      dna: a.genome.dna,
      familyName: a.familyName,
      entityClass: a.entityClass,
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
      fullness: a.fullness,
      hygiene: a.hygiene,
      social: a.social,
      inspiration: a.inspiration,
      xp: a.xp,
      inventory: { food: a.inventory.food, water: a.inventory.water, wood: a.inventory.wood },
      poopTimerMs: a.poopTimerMs,
      diseased: a.diseased,
      babyMsRemaining: a.babyMsRemaining,
      maxAgeTicks: a.maxAgeTicks,
      generation: a.generation,
      goal: a.goal,
      replanAtTick: a.replanAtTick,
      pathFailCount: a.pathFailCount,
      resourceMemory: [
        ['food', a.resourceMemory.get('food') ?? []],
        ['water', a.resourceMemory.get('water') ?? []],
        ['wood', a.resourceMemory.get('wood') ?? []],
      ],
      pregnancy: a.pregnancy.active ? {
        remainingMs: a.pregnancy.remainingMs,
        childDna: a.pregnancy.childDna,
        childFamilyName: a.pregnancy.childFamilyName,
        childFactionId: a.pregnancy.childFactionId,
        partnerId: a.pregnancy.partnerId,
      } : null,
    }));
    return {
      meta: { version: VERSION, savedAt: Date.now() },
      grid: { CELL: CELL_PX, GRID: GRID_SIZE },
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
      saltWaterBlocks: [...world.saltWaterBlocks.values()],
      eggs: [...world.eggs.values()],
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
        spawnsRemaining: fm.spawnsRemaining ?? FARM_MAX_SPAWNS,
        spawnTimerMs: fm.spawnTimerMs ?? rndi(FARM_SPAWN_INTERVAL_RANGE[0], FARM_SPAWN_INTERVAL_RANGE[1]),
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
        maxAgeMs: tb.maxAgeMs ?? rndi(TREE_MAX_AGE_RANGE[0], TREE_MAX_AGE_RANGE[1]),
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
    // Restore salt water blocks
    for (const sw of d.saltWaterBlocks || []) {
      world.saltWaterBlocks.set(key(sw.x, sw.y), {
        id: sw.id,
        x: sw.x,
        y: sw.y,
      });
    }
    // Restore eggs
    for (const eg of d.eggs || []) {
      world.eggs.set(eg.id, {
        id: eg.id,
        x: eg.x,
        y: eg.y,
        hatchTimerMs: eg.hatchTimerMs ?? 0,
      });
    }
    // Recompute terrain moisture from restored water/saltwater state
    world.terrainField.recomputeAll(world.grid);
    world.terrainField.snapDisplay();
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
      const genome = a.dna ? new Genome(a.dna) : Genome.random();
      const agent = new Agent({
        id: a.id,
        name: a.name,
        genome,
        familyName: a.familyName ?? a.name,
        entityClass: a.entityClass ?? 'adult',
        cellX: a.cellX,
        cellY: a.cellY,
        health: a.health,
        energy: a.energy ?? 100,
        level: a.level,
        ageTicks: a.ageTicks,
        factionId: a.factionId || null,
        relationships: new Map(a.relationships || []),
        path: a.path || null,
        pathIdx: a.pathIdx || 0,
        action,
        lockMsRemaining: a.lockMsRemaining || 0,
        fullness: a.fullness ?? 50,
        hygiene: a.hygiene ?? 50,
        social: a.social ?? 50,
        inspiration: a.inspiration ?? 50,
        xp: a.xp ?? 0,
        inventory: a.inventory ?? { food: 0, water: 0, wood: 0 },
        poopTimerMs: a.poopTimerMs ?? 0,
        diseased: a.diseased ?? false,
        babyMsRemaining: a.babyMsRemaining ?? 0,
        maxAgeTicks: a.maxAgeTicks,
        generation: a.generation ?? 1,
        goal: a.goal ?? null,
        replanAtTick: a.replanAtTick ?? 0,
      });
      // Restore pathFailCount (not in AgentOpts, set directly)
      agent.pathFailCount = a.pathFailCount ?? 0;
      // Restore resource memory
      if (Array.isArray(a.resourceMemory)) {
        for (const [rType, entries] of a.resourceMemory as [ResourceMemoryType, IResourceMemoryEntry[]][]) {
          agent.resourceMemory.set(rType, entries ?? []);
        }
      }
      // Restore pregnancy state
      if (a.pregnancy && a.pregnancy.childDna) {
        agent.pregnancy.start(
          a.pregnancy.childDna,
          a.pregnancy.remainingMs ?? 0,
          a.pregnancy.childFamilyName ?? agent.familyName,
          a.pregnancy.childFactionId ?? null,
          a.pregnancy.partnerId ?? null
        );
      }

      world.agents.push(agent);
      world.agentsById.set(agent.id, agent);
      world.agentsByCell.set(key(agent.cellX, agent.cellY), agent.id);

      // Register in family registry
      world.familyRegistry.registerBirth(agent.familyName);
    }

    FactionManager.reconcile(world);

    // Restore log history
    if (d.log?.arr) {
      world.log = new RingLog(d.log.limit ?? 200);
      world.log.arr = d.log.arr;
    }
    // Restore log filter state
    if (Array.isArray(d.activeLogCats)) {
      world.activeLogCats = new Set(d.activeLogCats);
    }
    world.activeLogAgentId = d.activeLogAgentId ?? null;
    // Restore selection
    world.selectedId = d.selectedId ?? null;

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
