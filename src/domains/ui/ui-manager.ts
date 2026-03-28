import { LOG_CATS, AGENT_EMOJIS, TICK_MS } from '../../core/constants';
import { getIdleEmoji } from '../../core/utils';
import type { LogCategory } from '../action/types';
import type { World } from '../world';
import type { Agent } from '../entity/agent';
import { GENE_REGISTRY } from '../genetics/gene-registry';

const PAGE_LOAD_TIME = Date.now() - performance.now();

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
    btnPause: HTMLButtonElement | null;
    btnResume: HTMLButtonElement | null;
    btnSpawnCrop: HTMLButtonElement | null;
    btnDrawObstacles: HTMLButtonElement | null;
    btnEraseObstacles: HTMLButtonElement | null;
    btnSave: HTMLButtonElement | null;
    btnLoad: HTMLButtonElement | null;
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
}

export class UIManager {
  static bindDom(): DomRefs {
    return {
      canvas: qs('#canvas') as HTMLCanvasElement,
      hud: qs('#hud'),
      buttons: {
        btnStart: qs('#btnStart') as HTMLButtonElement | null,
        btnPause: qs('#btnPause') as HTMLButtonElement | null,
        btnResume: qs('#btnResume') as HTMLButtonElement | null,
        btnSpawnCrop: qs('#btnSpawnCrop') as HTMLButtonElement | null,
        btnDrawObstacles: qs('#btnDrawObstacles') as HTMLButtonElement | null,
        btnEraseObstacles: qs('#btnEraseObstacles') as HTMLButtonElement | null,
        btnSave: qs('#btnSave') as HTMLButtonElement | null,
        btnLoad: qs('#btnLoad') as HTMLButtonElement | null,
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
    if (s.stAgents) s.stAgents.textContent = String(world.agents.length);
    if (s.stFactions) s.stFactions.textContent = String(world.factions.size);
    if (s.stCrops) s.stCrops.textContent = String(world.foodBlocks.size);
    if (s.stFarms) s.stFarms.textContent = String(world.farms.size);
    if (s.stObstacles) s.stObstacles.textContent = String(world.obstacles.size);
    if (s.stFlags) s.stFlags.textContent = String(world.flags.size);

    const birthsPerMin = UIManager._ratePerMinute(world.birthTimestamps);
    const deathsPerMin = UIManager._ratePerMinute(world.deathTimestamps);
    if (s.stBirths) s.stBirths.textContent = `${world.totalBirths} (${birthsPerMin}/m)`;
    if (s.stDeaths) s.stDeaths.textContent = `${world.totalDeaths} (${deathsPerMin}/m)`;
    // Count unique water blocks (large blocks share references across cells)
    const seenWater = new Set<string>();
    for (const wb of world.waterBlocks.values()) seenWater.add(wb.id);
    if (s.stWater) s.stWater.textContent = String(seenWater.size);
    if (s.stTrees) s.stTrees.textContent = String(world.treeBlocks.size);
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

  private static _lastFamiliesSig = '';
  private static _lastFamiliesDomAt = 0;

  static rebuildFamiliesListIfNeeded(world: World, familiesList: HTMLElement | null): void {
    if (!familiesList) return;
    const now = performance.now();
    const families = world.familyRegistry.getAllFamilies();
    const sig = families.map(f => f.familyName + ':' + f.currentlyAlive + ':' + f.totalBorn).join(',');
    if (sig === UIManager._lastFamiliesSig && now - UIManager._lastFamiliesDomAt < 2000) return;

    familiesList.innerHTML = '';

    if (families.length === 0) {
      familiesList.innerHTML = '<div style="color:var(--muted);font-size:11px">No families recorded yet.</div>';
      UIManager._lastFamiliesSig = sig;
      UIManager._lastFamiliesDomAt = now;
      return;
    }

    for (const f of families) {
      const avgLife = f.deathCount > 0 ? (f.totalAgeMs / f.deathCount / 1000).toFixed(0) + 's' : '—';
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
    const a = world.agentsById.get(world.selectedId);
    if (!a) {
      el.innerHTML = '<div class="muted">(agent gone)</div>';
      if (badge) (badge as HTMLElement).style.display = 'none';
      return;
    }
    if (badge) (badge as HTMLElement).style.display = '';

    const actionType = a.action?.type;
    const emoji =
      AGENT_EMOJIS[actionType as string] || getIdleEmoji(a);
    const factionColor = a.factionId
      ? world.factions.get(a.factionId)?.color || '#888'
      : null;
    const hpPct = Math.round((a.health / a.maxHealth) * 100);

    el.innerHTML = `
      <div class="agent-card">
        <div class="agent-avatar">${emoji}</div>
        <div class="agent-info">
          <div class="agent-name-row">
            <span class="agent-name">${a.name} ${a.familyName !== a.name ? a.familyName : ''}</span>
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
        <div style="color:var(--muted)">ATTACK</div><div>${a.effectiveAttack.toFixed(1)}${a.pregnancy.active ? ' (debuffed)' : ''}</div>
        <div style="color:var(--muted)">XP</div><div>${a.xp} / ${a.xpToNextLevel()}</div>
        <div style="color:var(--muted)">AGE</div><div>${(a.ageTicks * TICK_MS / 1000).toFixed(0)}s / ${(a.maxAgeTicks * TICK_MS / 1000).toFixed(0)}s</div>
        <div style="color:var(--muted)">FAMILY</div><div>${a.familyName}</div>
        <div style="color:var(--muted)">DNA</div><div>${a.genome.genes.length} genes (${a.genome.dna.length} chars)</div>
      </div>
      <div style="font-size:11px;margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid var(--border)">
        <div style="color:var(--muted);margin-bottom:4px;font-weight:600">TRAITS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10px">
          ${traitCell('STR', a.traits.strength.baseAttack.toFixed(1), a.traits.strength.baseAttack, 'AA', 'Strength — Base attack damage')}
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
          ${traitCell('MAT', (a.traits.maturity.babyDurationMs / 1000).toFixed(0) + 's', a.traits.maturity.babyDurationMs, 'QQ', 'Maturity — Baby stage duration (lower = matures faster)')}
          ${a.traits.parthenogenesis.canSelfReproduce ? '<div title="Parthenogenesis — Can reproduce without a partner" style="color:#f9a8d4;cursor:help">ASEXUAL</div>' : ''}
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
          const icon = type === 'food' ? '\u{1F356}' : type === 'water' ? '\u{1F4A7}' : '\u{1FAB5}';
          return entries.length > 0
            ? `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:2px 0">${icon} ${entries.map(e =>
                `<span style="display:inline-block;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.06);border:1px solid var(--border);font-size:9px;font-family:monospace">${e.x},${e.y}</span>`
              ).join('')}</div>`
            : `<div style="color:var(--muted);margin:2px 0">${icon} none</div>`;
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
