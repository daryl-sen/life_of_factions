import { LOG_CATS, AGENT_EMOJIS, TICK_MS } from '../../core/constants';
import { getIdleEmoji } from '../../core/utils';
import type { LogCategory } from '../action/types';
import type { World } from '../world';
import type { Agent } from '../entity/agent';
import { Mood } from '../entity/types';
import { GENE_REGISTRY } from '../genetics/gene-registry';
import { evaluateNeeds } from '../decision/need-evaluator';
import { computeMood } from '../decision/mood-evaluator';

const PAGE_LOAD_TIME = Date.now() - performance.now();

/** Format large numbers compactly: 1000→1k, 1500→1.5k, 1000000→1m */
function compactNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  const m = n / 1_000_000;
  return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'm';
}

/**
 * Color-code a trait value based on where it falls in the [min, max] range.
 * Red = 2+ SD below midpoint, Yellow = 1 SD below, normal = within 1 SD,
 * Green = 1 SD above, Blue = 2+ SD above.
 * SD = (max - min) / 4 (so the full range spans ~4 SD).
 */
function traitColor(value: number, min: number, max: number, inverted: boolean): string {
  const mid = (min + max) / 2;
  const sd = (max - min) / 4;
  if (sd === 0) return 'inherit';
  // For inverted traits (lower value = better), flip the interpretation
  const effective = inverted ? -(value - mid) : (value - mid);
  const deviations = effective / sd;
  if (deviations <= -2) return '#ef4444';   // red
  if (deviations <= -1) return '#eab308';   // yellow
  if (deviations >= 2)  return '#3b82f6';   // blue
  if (deviations >= 1)  return '#22c55e';   // green
  return 'inherit';                          // normal
}

/** Look up the first component's min/max/inverted for a gene code */
function traitRange(geneCode: string): { min: number; max: number; inverted: boolean } {
  const def = GENE_REGISTRY.get(geneCode);
  if (!def || def.components.length === 0) return { min: 0, max: 1, inverted: false };
  const c = def.components[0];
  return { min: c.min, max: c.max, inverted: c.inverted };
}

/** Format a trait cell with color coding and tooltip */
function traitCell(label: string, value: string, numValue: number, geneCode: string, tooltip: string): string {
  const { min, max, inverted } = traitRange(geneCode);
  const color = traitColor(numValue, min, max, inverted);
  return `<div title="${tooltip}" style="color:${color};cursor:help">${label} ${value}</div>`;
}

/** Short labels that differ from the first-3-chars-of-gene-name default */
const TRAIT_LABEL_OVERRIDES: Record<string, string> = {
  'II': 'COP', 'KK': 'CRG', 'MM': 'RCL', 'NN': 'CHR',
  'UU': 'GRD', 'VV': 'MTN', 'AG': 'PRG', 'AR': 'TRB',
};

/** Genes excluded from the auto grid (handled separately or superseded) */
const SKIP_TRAIT_GENES = new Set(['OO', 'TT']);

function formatTraitVal(compKey: string, val: number): string {
  if (compKey.endsWith('Ms')) return (val / 1000).toFixed(1) + 's';
  if (compKey === 'speedMult') return val.toFixed(2) + 'x';
  if (compKey === 'mutationRate') return val.toFixed(4);
  if (val >= 100) return val.toFixed(0);
  if (val >= 10) return val.toFixed(1);
  return val.toFixed(2);
}

/** Build all trait cells dynamically from the gene registry — no manual updates needed for new genes */
function buildTraitCells(a: Agent): string {
  const traitMap = a.traits as unknown as Record<string, Record<string, number>>;
  let out = '';
  for (const [code, def] of GENE_REGISTRY) {
    if (SKIP_TRAIT_GENES.has(code)) continue;
    const traitObj = traitMap[def.name.toLowerCase()];
    if (!traitObj) continue;
    const comp = def.components[0];
    if (!comp) continue;
    const val = traitObj[comp.key];
    if (typeof val !== 'number') continue;
    const label = TRAIT_LABEL_OVERRIDES[code] ?? def.name.slice(0, 3).toUpperCase();
    out += traitCell(label, formatTraitVal(comp.key, val), val, code, `${def.name} — ${comp.key}`);
  }
  if (a.traits.parthenogenesis.canSelfReproduce) {
    out += '<div title="Parthenogenesis — Can reproduce without a partner" style="color:#f9a8d4;cursor:help">ASEXUAL</div>';
  }
  return out;
}

function qs(sel: string): HTMLElement | null {
  return document.querySelector(sel);
}

const CAT_ICONS: Record<string, string> = {
  talk: '\u{1F4AC}',
  quarrel: '\u{1F4A2}',
  attack: '\u2694\uFE0F',
  heal: '\u{1F49A}',
  share: '\u{1F91D}',
  loot: '\uD83D\uDC5D',
  hygiene: '\uD83E\uDDFC',
  reproduce: '\u{1F495}',
  build: '\u{1F528}',
  destroy: '\u{1F4A5}',
  death: '\u{1F480}',
  faction: '\u2728',
  level: '\u2B50',
  spawn: '\u{1F331}',
  info: '\u{1F4E1}',
};

function catClass(cat: string): string {
  if (cat === 'attack' || cat === 'quarrel' || cat === 'destroy' || cat === 'death') return 'cat-bad';
  if (cat === 'heal' || cat === 'share' || cat === 'faction' || cat === 'level') return 'cat-good';
  if (cat === 'reproduce' || cat === 'spawn' || cat === 'build' || cat === 'loot' || cat === 'hygiene') return 'cat-warn';
  return 'cat-info';
}

function formatTime(t: number): string {
  const d = new Date(PAGE_LOAD_TIME + t);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export interface DomRefs {
  canvas: HTMLCanvasElement;
  hud: HTMLElement | null;
  buttons: {
    btnStart: HTMLButtonElement | null;
    btnReset: HTMLButtonElement | null;
    btnPause: HTMLButtonElement | null;
    btnResume: HTMLButtonElement | null;
    btnSpawnCrop: HTMLButtonElement | null;
    btnDrawObstacles: HTMLButtonElement | null;
    btnEraseObstacles: HTMLButtonElement | null;
    btnQuickSave: HTMLButtonElement | null;
    btnExport: HTMLButtonElement | null;
    btnImport: HTMLButtonElement | null;
    btnSpawnTree: HTMLButtonElement | null;
    btnSpawnCloud: HTMLButtonElement | null;
    btnReplenish: HTMLButtonElement | null;
    btnPaintSaltWater: HTMLButtonElement | null;
    btnPaintLand: HTMLButtonElement | null;
    btnSpeedSlow: HTMLButtonElement | null;
    btnSpeedNormal: HTMLButtonElement | null;
    btnSpeedFast: HTMLButtonElement | null;
    btnSpeedVFast: HTMLButtonElement | null;
    btnSize62: HTMLButtonElement | null;
    btnSize124: HTMLButtonElement | null;
    btnSize160: HTMLButtonElement | null;
    btnSize200: HTMLButtonElement | null;
  };
  fileLoad: HTMLInputElement | null;
  ranges: {
    rngAgents: HTMLInputElement | null;
    rngSpeed: HTMLInputElement | null;
    rngCloudRate: HTMLInputElement | null;
    rngWorldSize: HTMLInputElement | null;
  };
  labels: {
    lblAgents: HTMLElement | null;
    lblSpeed: HTMLElement | null;
    lblCloudRate: HTMLElement | null;
    lblWorldSize: HTMLElement | null;
  };
  nums: {
    numAgents: HTMLInputElement | null;
    numSpeed: HTMLInputElement | null;
    numCloudRate: HTMLInputElement | null;
    numWorldSize: HTMLInputElement | null;
  };
  statsEls: {
    stAgents: HTMLElement | null;
    stFactions: HTMLElement | null;
    stCrops: HTMLElement | null;
    stFarms: HTMLElement | null;
    stObstacles: HTMLElement | null;
    stFlags: HTMLElement | null;
    stTick: HTMLElement | null;
    stFps: HTMLElement | null;
    stTickAvg: HTMLElement | null;
    stTickMin: HTMLElement | null;
    stTickMax: HTMLElement | null;
    stRenderAvg: HTMLElement | null;
    stRenderMin: HTMLElement | null;
    stRenderMax: HTMLElement | null;
    stBirths: HTMLElement | null;
    stDeaths: HTMLElement | null;
    stWater: HTMLElement | null;
    stTrees: HTMLElement | null;
    stHouses: HTMLElement | null;
  };
  barEls: {
    barAgents: HTMLElement | null;
    barFactions: HTMLElement | null;
    barCrops: HTMLElement | null;
  };
  factionsList: HTMLElement | null;
  familiesList: HTMLElement | null;
  inspector: HTMLElement | null;
  logList: HTMLElement | null;
  logFilters: HTMLElement | null;
  pauseChk: HTMLInputElement | null;
  gridChk: HTMLInputElement | null;
  territoriesChk: HTMLInputElement | null;
  factionSortEl: HTMLSelectElement | null;
  familySortEl: HTMLSelectElement | null;
}

export class UIManager {
  static bindDom(): DomRefs {
    return {
      canvas: qs('#canvas') as HTMLCanvasElement,
      hud: qs('#hud'),
      buttons: {
        btnStart: qs('#btnStart') as HTMLButtonElement | null,
        btnReset: qs('#btnReset') as HTMLButtonElement | null,
        btnPause: qs('#btnPause') as HTMLButtonElement | null,
        btnResume: qs('#btnResume') as HTMLButtonElement | null,
        btnSpawnCrop: qs('#btnSpawnCrop') as HTMLButtonElement | null,
        btnDrawObstacles: qs('#btnDrawObstacles') as HTMLButtonElement | null,
        btnEraseObstacles: qs('#btnEraseObstacles') as HTMLButtonElement | null,
        btnQuickSave: qs('#btnQuickSave') as HTMLButtonElement | null,
        btnExport: qs('#btnExport') as HTMLButtonElement | null,
        btnImport: qs('#btnImport') as HTMLButtonElement | null,
        btnSpawnTree: qs('#btnSpawnTree') as HTMLButtonElement | null,
        btnSpawnCloud: qs('#btnSpawnCloud') as HTMLButtonElement | null,
        btnReplenish: qs('#btnReplenish') as HTMLButtonElement | null,
        btnPaintSaltWater: qs('#btnPaintSaltWater') as HTMLButtonElement | null,
        btnPaintLand: qs('#btnPaintLand') as HTMLButtonElement | null,
        btnSpeedSlow: qs('#btnSpeedSlow') as HTMLButtonElement | null,
        btnSpeedNormal: qs('#btnSpeedNormal') as HTMLButtonElement | null,
        btnSpeedFast: qs('#btnSpeedFast') as HTMLButtonElement | null,
        btnSpeedVFast: qs('#btnSpeedVFast') as HTMLButtonElement | null,
        btnSize62: qs('#btnSize62') as HTMLButtonElement | null,
        btnSize124: qs('#btnSize124') as HTMLButtonElement | null,
        btnSize160: qs('#btnSize160') as HTMLButtonElement | null,
        btnSize200: qs('#btnSize200') as HTMLButtonElement | null,
      },
      fileLoad: qs('#fileLoad') as HTMLInputElement | null,
      ranges: {
        rngAgents: qs('#rngAgents') as HTMLInputElement | null,
        rngSpeed: qs('#rngSpeed') as HTMLInputElement | null,
        rngCloudRate: qs('#rngCloudRate') as HTMLInputElement | null,
        rngWorldSize: qs('#rngWorldSize') as HTMLInputElement | null,
      },
      labels: {
        lblAgents: qs('#lblAgents'),
        lblSpeed: qs('#lblSpeed'),
        lblCloudRate: qs('#lblCloudRate'),
        lblWorldSize: qs('#lblWorldSize'),
      },
      nums: {
        numAgents: qs('#numAgents') as HTMLInputElement | null,
        numSpeed: qs('#numSpeed') as HTMLInputElement | null,
        numCloudRate: qs('#numCloudRate') as HTMLInputElement | null,
        numWorldSize: qs('#numWorldSize') as HTMLInputElement | null,
      },
      statsEls: {
        stAgents: qs('#stAgents'),
        stFactions: qs('#stFactions'),
        stCrops: qs('#stCrops'),
        stFarms: qs('#stFarms'),
        stObstacles: qs('#stObstacles'),
        stFlags: qs('#stFlags'),
        stTick: qs('#stTick'),
        stFps: qs('#stFps'),
        stTickAvg: qs('#stTickAvg'),
        stTickMin: qs('#stTickMin'),
        stTickMax: qs('#stTickMax'),
        stRenderAvg: qs('#stRenderAvg'),
        stRenderMin: qs('#stRenderMin'),
        stRenderMax: qs('#stRenderMax'),
        stBirths: qs('#stBirths'),
        stDeaths: qs('#stDeaths'),
        stWater: qs('#stWater'),
        stTrees: qs('#stTrees'),
        stHouses: qs('#stHouses'),
      },
      barEls: {
        barAgents: qs('#barAgents'),
        barFactions: qs('#barFactions'),
        barCrops: qs('#barCrops'),
      },
      factionsList: qs('#factionsList'),
      familiesList: qs('#familiesList'),
      inspector: qs('#inspector'),
      logList: qs('#logList'),
      logFilters: qs('#logFilters'),
      pauseChk: qs('#cbPauseOnBlur') as HTMLInputElement | null,
      gridChk: qs('#cbDrawGrid') as HTMLInputElement | null,
      territoriesChk: qs('#cbDrawTerritories') as HTMLInputElement | null,
      factionSortEl: qs('#factionSort') as HTMLSelectElement | null,
      familySortEl: qs('#familySort') as HTMLSelectElement | null,
    };
  }

  static formatTickCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 100_000) return (n / 1_000).toFixed(0) + 'K';
    if (n >= 10_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  static renderLog(world: World, logList: HTMLElement | null): void {
    if (!world || !world.log || !logList) return;
    const items = world.log.list(world.activeLogCats, world.activeLogAgentId);
    logList.innerHTML = items
      .slice(-100)
      .reverse()
      .map((it) => {
        const cls = catClass(it.cat);
        const icon = CAT_ICONS[it.cat] || '';
        const time = formatTime(it.t);
        return `<div class="log-entry ${cls}">
          <div class="log-entry-time"><span class="log-entry-icon">${icon}</span>${time}</div>
          <div class="log-entry-msg">${it.msg}</div>
        </div>`;
      })
      .join('');
  }

  static setupLogFilters(world: World, logFilters: HTMLElement | null, renderLogFn: () => void): void {
    if (!logFilters) return;
    logFilters.innerHTML = '';

    const allPill = document.createElement('button');
    allPill.className = 'filter-pill active';
    allPill.textContent = 'ALL';
    logFilters.appendChild(allPill);

    const pills = new Map<LogCategory, HTMLButtonElement>();
    LOG_CATS.forEach((cat) => {
      const pill = document.createElement('button');
      pill.className = 'filter-pill' + (world.activeLogCats.has(cat) ? ' active' : '');
      pill.textContent = cat.toUpperCase();
      pill.dataset.cat = cat;
      logFilters.appendChild(pill);
      pills.set(cat, pill);

      pill.addEventListener('click', () => {
        if (world.activeLogCats.has(cat)) {
          world.activeLogCats.delete(cat);
          pill.classList.remove('active');
        } else {
          world.activeLogCats.add(cat);
          pill.classList.add('active');
        }
        allPill.classList.toggle('active', world.activeLogCats.size === LOG_CATS.length);
        renderLogFn();
      });
    });

    allPill.addEventListener('click', () => {
      const allActive = world.activeLogCats.size === LOG_CATS.length;
      if (allActive) {
        world.activeLogCats.clear();
        pills.forEach((p) => p.classList.remove('active'));
        allPill.classList.remove('active');
      } else {
        world.activeLogCats = new Set(LOG_CATS);
        pills.forEach((p) => p.classList.add('active'));
        allPill.classList.add('active');
      }
      renderLogFn();
    });

    const agentSelect = qs('#agentFilterSelect') as HTMLSelectElement | null;
    if (agentSelect) {
      const rebuildAgentOptions = () => {
        const cur = world.activeLogAgentId;
        const opts = [{ value: '', label: 'All Agents' }].concat(
          world.agents.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.id.slice(0, 4)})`,
          }))
        );
        agentSelect.innerHTML = '';
        for (const o of opts) {
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.label;
          if (cur === o.value) opt.selected = true;
          agentSelect.appendChild(opt);
        }
      };
      rebuildAgentOptions();
      world._rebuildAgentOptions = rebuildAgentOptions;
      agentSelect.addEventListener('change', () => {
        world.activeLogAgentId = agentSelect.value || null;
        renderLogFn();
      });
    }
  }

  private static _ratePerMinute(timestamps: number[]): number {
    const now = performance.now();
    const cutoff = now - 60_000;
    // Evict old entries
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
    return timestamps.length;
  }

  static renderHUD(world: World, _hud: HTMLElement | null, stats: Record<string, unknown>): void {
    const fps = (stats.fps as number) || 0;
    const tAvg = (stats.tickAvg as number) || 0;
    const tMin = (stats.tickMin as number) || 0;
    const tMax = (stats.tickMax as number) || 0;
    const rAvg = (stats.renderAvg as number) || 0;
    const rMin = (stats.renderMin as number) || 0;
    const rMax = (stats.renderMax as number) || 0;

    const s = stats as Record<string, HTMLElement | null>;
    if (s.stAgents) s.stAgents.textContent = compactNum(world.agents.length);
    if (s.stFactions) s.stFactions.textContent = compactNum(world.factions.size);
    if (s.stCrops) s.stCrops.textContent = compactNum(world.foodBlocks.size);
    if (s.stFarms) s.stFarms.textContent = compactNum(world.farms.size);
    if (s.stObstacles) s.stObstacles.textContent = compactNum(world.obstacles.size);
    if (s.stFlags) s.stFlags.textContent = compactNum(world.flags.size);
    // Count unique houses (multi-cell houses share the same object)
    if (s.stHouses) {
      const seenHouses = new Set<string>();
      for (const h of world.houses.values()) seenHouses.add(h.id);
      s.stHouses.textContent = compactNum(seenHouses.size);
    }

    const birthsPerMin = UIManager._ratePerMinute(world.birthTimestamps);
    const deathsPerMin = UIManager._ratePerMinute(world.deathTimestamps);
    if (s.stBirths) s.stBirths.textContent = `${compactNum(world.totalBirths)} (${compactNum(birthsPerMin)}/m)`;
    if (s.stDeaths) s.stDeaths.textContent = `${compactNum(world.totalDeaths)} (${compactNum(deathsPerMin)}/m)`;
    // Count unique water blocks (large blocks share references across cells)
    const seenWater = new Set<string>();
    for (const wb of world.waterBlocks.values()) seenWater.add(wb.id);
    if (s.stWater) s.stWater.textContent = compactNum(seenWater.size);
    if (s.stTrees) s.stTrees.textContent = compactNum(world.treeBlocks.size);
    if (s.stTick) s.stTick.textContent = UIManager.formatTickCount(world.tick);
    if (s.stFps) s.stFps.textContent = fps.toFixed(0);
    if (s.stTickAvg) s.stTickAvg.textContent = tAvg.toFixed(1);
    if (s.stTickMin) s.stTickMin.textContent = tMin.toFixed(1);
    if (s.stTickMax) s.stTickMax.textContent = tMax.toFixed(1);
    if (s.stRenderAvg) s.stRenderAvg.textContent = rAvg.toFixed(1);
    if (s.stRenderMin) s.stRenderMin.textContent = rMin.toFixed(1);
    if (s.stRenderMax) s.stRenderMax.textContent = rMax.toFixed(1);
    // Nav bar stats are now dynamically synced from telemetry elements via inline script
  }

  static rebuildFactionsListIfNeeded(world: World, factionsList: HTMLElement | null): void {
    if (!factionsList) return;
    const now = performance.now();
    const sig =
      world.factions.size +
      '|' +
      world.factionSort +
      '|' +
      [...world.factions]
        .map(([fid, f]) => fid + ':' + f.members.size)
        .join(',');
    if (sig !== world._lastFactionsSig || now - world._lastFactionsDomAt >= 2000) {
      factionsList.innerHTML = '';

      // Build sortable entries
      const entries = [...world.factions].map(([fid, f]) => {
        const members = [...f.members]
          .map((id) => world.agentsById.get(id))
          .filter(Boolean);
        const avgLvl = members.reduce((s, a) => s + a!.level, 0) / (members.length || 1);
        return { fid, f, members, avgLvl };
      });

      // Sort
      switch (world.factionSort) {
        case 'members':
          entries.sort((a, b) => b.members.length - a.members.length);
          break;
        case 'created':
          entries.sort((a, b) => a.f.createdAtTick - b.f.createdAtTick);
          break;
        case 'name':
          entries.sort((a, b) => a.fid.localeCompare(b.fid));
          break;
        case 'level':
          entries.sort((a, b) => b.avgLvl - a.avgLvl);
          break;
      }

      for (const { fid, f, members, avgLvl } of entries) {
        const color = f.color;
        const flag = world.flags.get(fid);
        const storageStr = flag?.storage
          ? ` &middot; 🍖${flag.storage.food} 💧${flag.storage.water} 🪵${flag.storage.wood}`
          : '';
        const div = document.createElement('div');
        div.className = 'faction-item';
        div.innerHTML = `
          <div class="faction-color" style="background:${color}"></div>
          <span class="faction-name">${fid.slice(0, 8)}</span>
          <span class="faction-detail">${members.length} members &middot; Lv ${avgLvl.toFixed(1)}${storageStr}</span>
        `;
        factionsList.appendChild(div);
      }
      world._lastFactionsDomAt = now;
      world._lastFactionsSig = sig;
    }
  }

  static _lastFamiliesSig = '';
  private static _lastFamiliesDomAt = 0;

  static rebuildFamiliesListIfNeeded(world: World, familiesList: HTMLElement | null): void {
    if (!familiesList) return;
    const now = performance.now();
    const families = world.familyRegistry.getAllFamilies();
    const sig = world.familySort + '|' + families.map(f => f.familyName + ':' + f.currentlyAlive + ':' + f.totalBorn).join(',');
    if (sig === UIManager._lastFamiliesSig && now - UIManager._lastFamiliesDomAt < 2000) return;

    familiesList.innerHTML = '';

    if (families.length === 0) {
      familiesList.innerHTML = '<div style="color:var(--muted);font-size:11px">No families recorded yet.</div>';
      UIManager._lastFamiliesSig = sig;
      UIManager._lastFamiliesDomAt = now;
      return;
    }

    // Sort
    switch (world.familySort) {
      case 'alive':
        families.sort((a, b) => b.currentlyAlive - a.currentlyAlive);
        break;
      case 'total':
        families.sort((a, b) => b.totalBorn - a.totalBorn);
        break;
      case 'name':
        families.sort((a, b) => a.familyName.localeCompare(b.familyName));
        break;
      case 'lifespan':
        families.sort((a, b) => {
          const aAvg = a.deathCount > 0 ? a.totalAgeMs / a.deathCount : 0;
          const bAvg = b.deathCount > 0 ? b.totalAgeMs / b.deathCount : 0;
          return bAvg - aAvg;
        });
        break;
      case 'generation':
        families.sort((a, b) => b.maxGeneration - a.maxGeneration);
        break;
    }

    for (const f of families) {
      const avgLife = f.deathCount > 0 ? (f.totalAgeMs / f.deathCount / 1000).toFixed(0) + 's' : '\u2014';
      const div = document.createElement('div');
      div.className = 'faction-item';
      div.innerHTML = `
        <span class="faction-name" style="min-width:70px">${f.familyName}</span>
        <span class="faction-detail">
          \u{1F464} ${f.currentlyAlive} alive &middot;
          \u{1F4CA} ${f.totalBorn} total &middot;
          \u{23F1}\u{FE0F} ${avgLife} avg &middot;
          Gen ${f.maxGeneration}
        </span>
      `;
      familiesList.appendChild(div);
    }

    UIManager._lastFamiliesSig = sig;
    UIManager._lastFamiliesDomAt = now;
  }

  static updateInspector(world: World, el: HTMLElement | null): void {
    if (!el) return;
    const badge = qs('#inspectorBadge');
    if (!world.selectedId) {
      // Check for selected house
      if (world.selectedHouseId) {
        let house = null;
        for (const [, h] of world.grid.houses) {
          if (h.id === world.selectedHouseId) { house = h; break; }
        }
        if (house) {
          if (badge) (badge as HTMLElement).style.display = '';
          const owner = world.agentsById.get(house.ownerId);
          const ownerName = owner ? `${owner.name} ${owner.familyName}` : house.ownerId ? '(deceased)' : 'Vacant';
          const hpPct = Math.round((house.hp / house.maxHp) * 100);
          const occupants = house.occupantIds
            .map(id => world.agentsById.get(id)?.name ?? '?')
            .join(', ') || 'Empty';
          const tierLabel = house.tier.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
          el.innerHTML = `
            <div class="agent-card">
              <div class="agent-avatar">${house.emoji}</div>
              <div class="agent-info">
                <div class="agent-name-row">
                  <span class="agent-name">${tierLabel}</span>
                </div>
                <div class="stat-row"><span>Owner:</span><span>${ownerName}</span></div>
                <div class="stat-row"><span>Family:</span><span>${house.familyName || 'Unclaimed'}</span></div>
                <div class="stat-row"><span>Occupants:</span><span>${occupants}</span></div>
                <div class="stat-row"><span>Capacity:</span><span>${house.occupantIds.length}/${house.capacity}</span></div>
                <div class="stat-row"><span>Durability:</span><span>${hpPct}%</span></div>
                <div class="progress-wrap"><div class="progress-bar hp-bar" style="width:${hpPct}%"></div></div>
              </div>
            </div>`;
          return;
        }
      }
      el.innerHTML = '<div class="muted">Click an agent on the canvas.</div>';
      if (badge) (badge as HTMLElement).style.display = 'none';
      return;
    }
    const a = world.agentsById.get(world.selectedId);
    if (!a) {
      el.innerHTML = '<div class="muted">(agent gone)</div>';
      if (badge) (badge as HTMLElement).style.display = 'none';
      return;
    }
    if (badge) (badge as HTMLElement).style.display = '';

    const mood = computeMood(evaluateNeeds(a));
    const moodColors: Record<string, { bg: string; fg: string; border: string }> = {
      [Mood.HAPPY]: { bg: '#22c55e22', fg: '#22c55e', border: '#22c55e55' },
      [Mood.CONTENT]: { bg: '#3b82f622', fg: '#3b82f6', border: '#3b82f655' },
      [Mood.UNHAPPY]: { bg: '#eab30822', fg: '#eab308', border: '#eab30855' },
      [Mood.FRUSTRATED]: { bg: '#ef444422', fg: '#ef4444', border: '#ef444455' },
    };
    const mc = moodColors[mood] ?? moodColors[Mood.CONTENT];
    const moodEmoji = mood === Mood.HAPPY ? '\u{1F600}' : mood === Mood.CONTENT ? '\u{1F642}' : mood === Mood.UNHAPPY ? '\u{1F629}' : '\u{1F621}';

    const actionType = a.action?.type;
    const emoji =
      AGENT_EMOJIS[actionType as string] || getIdleEmoji(a, mood);
    const factionColor = a.factionId
      ? world.factions.get(a.factionId)?.color || '#888'
      : null;
    const hpPct = Math.round((a.health / a.maxHealth) * 100);

    el.innerHTML = `
      <div class="agent-card">
        <div class="agent-avatar">${emoji}</div>
        <div class="agent-info">
          <div class="agent-name-row">
            <span class="agent-name" data-action="center-agent" title="Click to pan to agent" style="cursor:pointer;text-decoration:underline dotted">${a.name} ${a.familyName !== a.name ? a.familyName : ''}</span>
            <span class="agent-level">LV. ${String(a.level).padStart(2, '0')}</span>
          </div>
          <div class="agent-badges">
            ${a.entityClass !== 'adult'
              ? `<span class="badge-action" style="background:#fbbf2422;color:#fbbf24;border-color:#fbbf2455">${a.entityClass.toUpperCase()}</span>`
              : ''
            }
            ${a.factionId
              ? `<span class="badge-faction" style="background:${factionColor}22;color:${factionColor};border-color:${factionColor}55">${a.factionId.slice(0, 8).toUpperCase()}</span>`
              : ''
            }
            ${a.pregnancy.active
              ? `<span class="badge-action" style="background:#f9a8d422;color:#f9a8d4;border-color:#f9a8d455">\u{1F95A} PREGNANT</span>`
              : ''
            }
            ${a.diseased
              ? `<span class="badge-action" style="background:#4ade8022;color:#4ade80;border-color:#4ade8055">\u{1F922} DISEASED</span>`
              : ''
            }
            <span class="badge-action" style="background:${mc.bg};color:${mc.fg};border-color:${mc.border}">${moodEmoji} ${mood.toUpperCase()}</span>
            ${a.matingTargetId
              ? `<span class="badge-action" style="background:#f9a8d422;color:#f9a8d4;border-color:#f9a8d455">\u{1F495} SEEKING MATE</span>`
              : ''
            }
            ${actionType
              ? `<span class="badge-action">${actionType.toUpperCase()}</span>`
              : ''
            }
          </div>
        </div>
      </div>
      <div class="agent-stats">
        <div>
          <div class="agent-stat-header">
            <span>VITALITY</span>
            <span>${a.health.toFixed(0)}/${a.maxHealth.toFixed(0)}</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill hp" style="width:${hpPct}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>ENERGY</span>
            <span>${a.energy.toFixed(1)}/${a.maxEnergy}</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill energy" style="width:${Math.min(100, (a.energy / a.maxEnergy) * 100)}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>FULLNESS</span>
            <span>${a.fullness.toFixed(1)}/100</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill" style="background:#f0a040;width:${a.fullness}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>INSPIRATION</span>
            <span>${a.inspiration.toFixed(1)}/100</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill" style="background:#c084fc;width:${a.inspiration}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>SOCIAL</span>
            <span>${a.social.toFixed(1)}/100</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill" style="background:#f472b6;width:${a.social}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>HYGIENE</span>
            <span>${a.hygiene.toFixed(1)}/100</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill" style="background:#38bdf8;width:${a.hygiene}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>INVENTORY</span>
            <span>${a.inventoryTotal()}/${a.inventory.capacity}</span>
          </div>
          <div style="font-size:10px;margin-top:2px;color:var(--muted)">
            \u{1F356} ${a.inventory.food} &nbsp; \u{1F4A7} ${a.inventory.water} &nbsp; \u{1FAB5} ${a.inventory.wood}
          </div>
        </div>
      </div>
      <div class="agent-details" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid var(--border)">
        <div style="color:var(--muted)">POSITION</div><div>${a.cellX}, ${a.cellY}</div>
        <div style="color:var(--muted)">XP</div><div>${a.xp} / ${a.xpToNextLevel()}</div>
        <div style="color:var(--muted)">AGE</div><div>${(a.ageTicks * TICK_MS / 1000).toFixed(0)}s / ${(a.maxAgeTicks * TICK_MS / 1000).toFixed(0)}s</div>
        <div style="color:var(--muted)">FAMILY</div><div>${a.familyName} <span style="color:var(--muted)">(Gen ${a.generation})</span></div>
        <div style="color:var(--muted)">DNA</div><div>${a.genome.genes.length} genes (${a.genome.dna.length} chars)</div>
      </div>
      <div style="font-size:11px;margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid var(--border)">
        <div style="color:var(--muted);margin-bottom:4px;font-weight:600">TRAITS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10px">
          ${buildTraitCells(a)}
        </div>
      </div>
      <div style="font-size:11px;margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid var(--border)">
        <div style="color:var(--muted);margin-bottom:4px;font-weight:600">RELATIONSHIPS (${a.relationships.size}/${a.relationships.maxSlots})</div>
        ${a.relationships.size > 0
          ? `<div style="font-size:10px;max-height:80px;overflow-y:auto">${
              Array.from(a.relationships.entries()).map(([rid, val]) => {
                const other = world.agentsById.get(rid);
                const name = other ? other.name : rid.slice(0, 6);
                const barColor = val >= 0 ? '#22c55e' : '#ef4444';
                const pct = Math.abs(val) * 50;
                const side = val >= 0 ? 'left' : 'right';
                return `<div style="display:flex;align-items:center;gap:4px;margin:1px 0">
                  <span style="width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
                  <div style="flex:1;height:4px;background:rgba(255,255,255,0.05);border-radius:2px;position:relative">
                    <div style="position:absolute;${side}:50%;width:${pct}%;height:100%;background:${barColor};border-radius:2px"></div>
                  </div>
                  <span style="width:30px;text-align:right;color:var(--muted)">${val.toFixed(2)}</span>
                </div>`;
              }).join('')
            }</div>`
          : '<div style="font-size:10px;color:var(--muted)">No relationships</div>'
        }
      </div>
      <div style="font-size:11px;margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid var(--border)">
        <div style="color:var(--muted);margin-bottom:4px;font-weight:600">MEMORY</div>
        ${(['food', 'water', 'wood'] as const).map(type => {
          const entries = a.resourceMemory.get(type) || [];
          const maxSlots = a.traits.recall.memorySlots;
          const icon = type === 'food' ? '\u{1F356}' : type === 'water' ? '\u{1F4A7}' : '\u{1FAB5}';
          return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:2px 0">${icon} <span style="color:var(--muted);font-size:9px">${entries.length}/${maxSlots}</span>${entries.map(e =>
                `<span style="display:inline-block;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.06);border:1px solid var(--border);font-size:9px;font-family:monospace">${e.x},${e.y}</span>`
              ).join('')}</div>`;
        }).join('')}
      </div>`;
  }

  static showNotification(agent: Agent): void {
    const el = document.getElementById('eventNotification');
    const body = document.getElementById('notificationBody');
    if (!el || !body || !agent) return;
    const action = agent.action ? agent.action.type : null;
    const desc = action
      ? `Unit ${agent.name} is currently ${action === 'attack' ? 'attacking' : action + 'ing'}.`
      : `Unit ${agent.name} is currently idle.`;
    body.textContent = desc;
    el.classList.remove('hidden');
    clearTimeout(UIManager._notifTimer);
    UIManager._notifTimer = window.setTimeout(() => el.classList.add('hidden'), 5000);
  }

  private static _notifTimer = 0;
}
