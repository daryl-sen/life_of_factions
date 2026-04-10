import { TICK_MS } from '../../core/constants';
import type { LogCategory } from '../action/types';
import type { World } from '../world';
import type { Organism } from '../entity/organism';
import { Mood } from '../entity/types';
import { LifecycleStage } from '../phenotype/types';

const LOG_CATS_ALL = ['talk', 'quarrel', 'attack', 'hunt', 'heal', 'share', 'reproduce',
  'build', 'destroy', 'death', 'faction', 'level', 'spawn', 'info', 'sleep', 'eat',
  'harvest', 'loot', 'hygiene'] as const;
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

/** Look up a trait's inverted flag for a gene code (v5: no min/max in TraitComponentDef) */
function traitRange(geneCode: string): { min: number; max: number; inverted: boolean } {
  const def = GENE_REGISTRY.get(geneCode);
  if (!def || def.components.length === 0) return { min: 0, max: 1, inverted: false };
  const c = def.components[0];
  // v5: use floor as min, default+4*scale as approximate max
  return { min: c.floor, max: c.default + c.scale * 4, inverted: c.inverted };
}

/** Format a trait cell with color coding and tooltip */
function traitCell(label: string, value: string, numValue: number, geneCode: string, tooltip: string): string {
  const { min, max, inverted } = traitRange(geneCode);
  const color = traitColor(numValue, min, max, inverted);
  return `<div title="${tooltip}" style="color:${color};cursor:help">${label} ${value}</div>`;
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
    const items = world.log.list(world.activeLogCats, world.activeLogOrganismId);
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
    LOG_CATS_ALL.forEach((cat) => {
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
        allPill.classList.toggle('active', world.activeLogCats.size === LOG_CATS_ALL.length);
        renderLogFn();
      });
    });

    allPill.addEventListener('click', () => {
      const allActive = world.activeLogCats.size === LOG_CATS_ALL.length;
      if (allActive) {
        world.activeLogCats.clear();
        pills.forEach((p) => p.classList.remove('active'));
        allPill.classList.remove('active');
      } else {
        world.activeLogCats.clear();
        for (const c of LOG_CATS_ALL) world.activeLogCats.add(c);
        pills.forEach((p) => p.classList.add('active'));
        allPill.classList.add('active');
      }
      renderLogFn();
    });

    const agentSelect = qs('#agentFilterSelect') as HTMLSelectElement | null;
    if (agentSelect) {
      const rebuildAgentOptions = () => {
        const cur = world.activeLogOrganismId;
        const opts = [{ value: '', label: 'All Agents' }].concat(
          world.organisms.map((a) => ({
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
      UIManager._rebuildOrganismOptions = rebuildAgentOptions;
      agentSelect.addEventListener('change', () => {
        world.activeLogOrganismId = agentSelect.value || null;
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
    if (s.stAgents) s.stAgents.textContent = compactNum(world.organisms.length);
    if (s.stFactions) s.stFactions.textContent = compactNum(world.factions.size);
    if (s.stCrops) s.stCrops.textContent = compactNum(world.foodBlocks.size);
    if (s.stFarms) s.stFarms.textContent = compactNum(world.farms.size);
    if (s.stObstacles) s.stObstacles.textContent = compactNum(world.obstacles.size);
    if (s.stFlags) s.stFlags.textContent = compactNum(world.flags.size);

    const birthsPerMin = UIManager._ratePerMinute(world.birthTimestamps);
    const deathsPerMin = UIManager._ratePerMinute(world.deathTimestamps);
    if (s.stBirths) s.stBirths.textContent = `${compactNum(world.totalBirths)} (${compactNum(birthsPerMin)}/m)`;
    if (s.stDeaths) s.stDeaths.textContent = `${compactNum(world.totalDeaths)} (${compactNum(deathsPerMin)}/m)`;
    // Count unique water blocks (large blocks share references across cells)
    const seenWater = new Set<string>();
    for (const wb of world.waterBlocks.values()) seenWater.add(wb.id);
    if (s.stWater) s.stWater.textContent = compactNum(seenWater.size);
    if (s.stTrees) s.stTrees.textContent = compactNum(world.corpseBlocks.size);
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
    if (sig !== UIManager._lastFactionsSig || now - UIManager._lastFactionsDomAt >= 2000) {
      factionsList.innerHTML = '';

      // Build sortable entries
      const entries = [...world.factions].map(([fid, f]) => {
        const members = [...f.members]
          .map((id) => world.organismsById.get(id))
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
          ? ` &middot; 🍖${(flag.storage.plantFood ?? 0) + (flag.storage.meatFood ?? 0)} 💧${flag.storage.water} 🪵${flag.storage.wood}`
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
      UIManager._lastFactionsDomAt = now;
      UIManager._lastFactionsSig = sig;
    }
  }

  static _lastFamiliesSig = '';
  private static _lastFamiliesDomAt = 0;
  static _rebuildOrganismOptions: (() => void) | null = null;
  static _lastFactionsSig = '';
  private static _lastFactionsDomAt = 0;

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
      el.innerHTML = '<div class="muted">Click an agent on the canvas.</div>';
      if (badge) (badge as HTMLElement).style.display = 'none';
      return;
    }
    const a = world.organismsById.get(world.selectedId);
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
    const emoji = a.currentEmoji;
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
            ${a.lifecycleStage !== LifecycleStage.Adult
              ? `<span class="badge-action" style="background:#fbbf2422;color:#fbbf24;border-color:#fbbf2455">${a.lifecycleStage.toUpperCase()}</span>`
              : ''
            }
            ${a.factionId
              ? `<span class="badge-faction" style="background:${factionColor}22;color:${factionColor};border-color:${factionColor}55">${a.factionId.slice(0, 8).toUpperCase()}</span>`
              : ''
            }
            ${a.pregnancy?.active
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
            <span>${a.needs.fullness.toFixed(1)}/100</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill" style="background:#f0a040;width:${a.needs.fullness}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>INSPIRATION</span>
            <span>${a.needs.inspiration.toFixed(1)}/100</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill" style="background:#c084fc;width:${a.needs.inspiration}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>SOCIAL</span>
            <span>${a.needs.social.toFixed(1)}/100</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill" style="background:#f472b6;width:${a.needs.social}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>HYGIENE</span>
            <span>${a.needs.hygiene.toFixed(1)}/100</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill" style="background:#38bdf8;width:${a.needs.hygiene}%"></div>
          </div>
        </div>
        <div>
          <div class="agent-stat-header">
            <span>INVENTORY</span>
            <span>${a.inventory.total()}/${a.inventory.capacity}</span>
          </div>
          <div style="font-size:10px;margin-top:2px;color:var(--muted)">
            \u{1F356} ${a.inventory.plantFood + a.inventory.meatFood} &nbsp; \u{1F4A7} ${a.inventory.water} &nbsp; \u{1FAB5} ${a.inventory.wood}
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
          ${traitCell('STR', a.traits.strength.value.toFixed(1), a.traits.strength.value, 'AA', 'Strength — Attack power')}
          ${traitCell('RES', a.traits.resilience.baseMaxHp.toFixed(0), a.traits.resilience.baseMaxHp, 'EE', 'Resilience — Base max health')}
          ${traitCell('VIG', a.traits.vigor.baseMaxEnergy.toFixed(0), a.traits.vigor.baseMaxEnergy, 'CC', 'Vigor — Base max energy')}
          ${traitCell('LON', (a.traits.longevity.maxAgeMs / 1000).toFixed(0) + 's', a.traits.longevity.maxAgeMs, 'BB', 'Longevity — Max lifespan')}
          ${traitCell('AGI', a.traits.agility.speedMult.toFixed(2) + 'x', a.traits.agility.speedMult, 'GG', 'Agility — Movement speed multiplier')}
          ${traitCell('MET', a.traits.metabolism.fullnessDecay.toFixed(3), a.traits.metabolism.fullnessDecay, 'DD', 'Metabolism — Fullness decay rate (lower = slower hunger)')}
          ${traitCell('AGG', a.traits.aggression.baseProbability.toFixed(2), a.traits.aggression.baseProbability, 'JJ', 'Aggression — Likelihood to attack')}
          ${traitCell('COP', a.traits.cooperation.baseProbability.toFixed(2), a.traits.cooperation.baseProbability, 'II', 'Cooperation — Likelihood to help/heal/share')}
          ${traitCell('CRG', a.traits.courage.fleeHpRatio.toFixed(2), a.traits.courage.fleeHpRatio, 'KK', 'Courage — Flee HP threshold (lower = braver)')}
          ${traitCell('FER', a.traits.fertility.energyThreshold.toFixed(0), a.traits.fertility.energyThreshold, 'LL', 'Fertility — Energy needed to reproduce (lower = more fertile)')}
          ${traitCell('APT', a.traits.aptitude.xpPerLevel.toFixed(0), a.traits.aptitude.xpPerLevel, 'HH', 'Aptitude — XP per level (lower = faster leveling)')}
          ${traitCell('FID', a.traits.fidelity.leaveProbability.toFixed(2), a.traits.fidelity.leaveProbability, 'SS', 'Fidelity — Chance to leave faction (lower = more loyal)')}
          ${traitCell('RCL', a.traits.recall.memorySlots.toFixed(0), a.traits.recall.memorySlots, 'MM', 'Recall — Resource memory slots')}
          ${traitCell('CHR', a.traits.charisma.relationshipSlots.toFixed(0), a.traits.charisma.relationshipSlots, 'NN', 'Charisma — Max relationship slots')}
          ${traitCell('END', a.traits.endurance.inventoryCapacity.toFixed(0), a.traits.endurance.inventoryCapacity, 'RR', 'Endurance — Inventory capacity')}
          ${traitCell('MAT', (a.traits.maturity.juvenileMs / 1000).toFixed(0) + 's', a.traits.maturity.juvenileMs, 'QQ', 'Maturity — Juvenile stage duration (lower = matures faster)')}
          ${traitCell('GRD', a.traits.greed.hoardProbability.toFixed(2), a.traits.greed.hoardProbability, 'UU', 'Greed — Probability of opportunistic resource hoarding')}
          ${traitCell('MTN', a.traits.maternity.feedProbability.toFixed(2), a.traits.maternity.feedProbability, 'VV', 'Maternity — Probability of feeding nearby babies')}
          ${a.traits.parthenogenesis.canSelfReproduce ? '<div title="Parthenogenesis — Can reproduce without a partner" style="color:#f9a8d4;cursor:help">ASEXUAL</div>' : ''}
        </div>
      </div>
      <div style="font-size:11px;margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid var(--border)">
        <div style="color:var(--muted);margin-bottom:4px;font-weight:600">RELATIONSHIPS (${a.relationships.size}/${a.relationships.maxSlots})</div>
        ${a.relationships.size > 0
          ? `<div style="font-size:10px;max-height:80px;overflow-y:auto">${
              Array.from(a.relationships.entries()).map(([rid, val]: [string, number]) => {
                const other = world.organismsById.get(rid);
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
        ${(['plantFood', 'water', 'wood'] as const).map(type => {
          const entries = a.memory.recall(type) || [];
          const maxSlots = a.traits.recall.memorySlots;
          const icon = type === 'plantFood' ? '\u{1F356}' : type === 'water' ? '\u{1F4A7}' : '\u{1FAB5}';
          return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:2px 0">${icon} <span style="color:var(--muted);font-size:9px">${entries.length}/${maxSlots}</span>${entries.map(e =>
                `<span style="display:inline-block;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.06);border:1px solid var(--border);font-size:9px;font-family:monospace">${e.x},${e.y}</span>`
              ).join('')}</div>`;
        }).join('')}
      </div>`;
  }

  static showNotification(agent: Organism): void {
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
