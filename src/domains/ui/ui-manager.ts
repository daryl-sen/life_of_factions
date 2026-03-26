import { LOG_CATS, AGENT_EMOJIS } from '../../shared/constants';
import { getIdleEmoji } from '../../shared/utils';
import type { LogCategory } from '../../shared/types';
import type { World } from '../world';
import type { Agent } from '../agent';

const PAGE_LOAD_TIME = Date.now() - performance.now();

function qs(sel: string): HTMLElement | null {
  return document.querySelector(sel);
}

const CAT_ICONS: Record<string, string> = {
  talk: '\u{1F4AC}',
  quarrel: '\u{1F4A2}',
  attack: '\u2694\uFE0F',
  heal: '\u{1F49A}',
  help: '\u{1F91D}',
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
  if (cat === 'heal' || cat === 'help' || cat === 'faction' || cat === 'level') return 'cat-good';
  if (cat === 'reproduce' || cat === 'spawn' || cat === 'build') return 'cat-warn';
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
    btnDrawWalls: HTMLButtonElement | null;
    btnEraseWalls: HTMLButtonElement | null;
    btnSave: HTMLButtonElement | null;
    btnLoad: HTMLButtonElement | null;
  };
  fileLoad: HTMLInputElement | null;
  ranges: {
    rngAgents: HTMLInputElement | null;
    rngSpeed: HTMLInputElement | null;
    rngSpawn: HTMLInputElement | null;
  };
  labels: {
    lblAgents: HTMLElement | null;
    lblSpeed: HTMLElement | null;
    lblSpawn: HTMLElement | null;
  };
  nums: {
    numAgents: HTMLInputElement | null;
    numSpeed: HTMLInputElement | null;
    numSpawn: HTMLInputElement | null;
  };
  statsEls: {
    stAgents: HTMLElement | null;
    stFactions: HTMLElement | null;
    stCrops: HTMLElement | null;
    stFarms: HTMLElement | null;
    stWalls: HTMLElement | null;
    stFlags: HTMLElement | null;
    stTick: HTMLElement | null;
    stFps: HTMLElement | null;
    stTickAvg: HTMLElement | null;
    stTickMin: HTMLElement | null;
    stTickMax: HTMLElement | null;
    stBirths: HTMLElement | null;
    stDeaths: HTMLElement | null;
  };
  barEls: {
    barAgents: HTMLElement | null;
    barFactions: HTMLElement | null;
    barCrops: HTMLElement | null;
  };
  factionsList: HTMLElement | null;
  inspector: HTMLElement | null;
  logList: HTMLElement | null;
  logFilters: HTMLElement | null;
  pauseChk: HTMLInputElement | null;
  gridChk: HTMLInputElement | null;
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
        btnDrawWalls: qs('#btnDrawWalls') as HTMLButtonElement | null,
        btnEraseWalls: qs('#btnEraseWalls') as HTMLButtonElement | null,
        btnSave: qs('#btnSave') as HTMLButtonElement | null,
        btnLoad: qs('#btnLoad') as HTMLButtonElement | null,
      },
      fileLoad: qs('#fileLoad') as HTMLInputElement | null,
      ranges: {
        rngAgents: qs('#rngAgents') as HTMLInputElement | null,
        rngSpeed: qs('#rngSpeed') as HTMLInputElement | null,
        rngSpawn: qs('#rngSpawn') as HTMLInputElement | null,
      },
      labels: {
        lblAgents: qs('#lblAgents'),
        lblSpeed: qs('#lblSpeed'),
        lblSpawn: qs('#lblSpawn'),
      },
      nums: {
        numAgents: qs('#numAgents') as HTMLInputElement | null,
        numSpeed: qs('#numSpeed') as HTMLInputElement | null,
        numSpawn: qs('#numSpawn') as HTMLInputElement | null,
      },
      statsEls: {
        stAgents: qs('#stAgents'),
        stFactions: qs('#stFactions'),
        stCrops: qs('#stCrops'),
        stFarms: qs('#stFarms'),
        stWalls: qs('#stWalls'),
        stFlags: qs('#stFlags'),
        stTick: qs('#stTick'),
        stFps: qs('#stFps'),
        stTickAvg: qs('#stTickAvg'),
        stTickMin: qs('#stTickMin'),
        stTickMax: qs('#stTickMax'),
        stBirths: qs('#stBirths'),
        stDeaths: qs('#stDeaths'),
      },
      barEls: {
        barAgents: qs('#barAgents'),
        barFactions: qs('#barFactions'),
        barCrops: qs('#barCrops'),
      },
      factionsList: qs('#factionsList'),
      inspector: qs('#inspector'),
      logList: qs('#logList'),
      logFilters: qs('#logFilters'),
      pauseChk: qs('#cbPauseOnBlur') as HTMLInputElement | null,
      gridChk: qs('#cbDrawGrid') as HTMLInputElement | null,
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

  static renderHUD(world: World, _hud: HTMLElement | null, stats: Record<string, unknown>): void {
    const fps = (stats.fps as number) || 0;
    const tAvg = (stats.tickAvg as number) || 0;
    const tMin = (stats.tickMin as number) || 0;
    const tMax = (stats.tickMax as number) || 0;

    const s = stats as Record<string, HTMLElement | null>;
    if (s.stAgents) s.stAgents.textContent = String(world.agents.length);
    if (s.stFactions) s.stFactions.textContent = String(world.factions.size);
    if (s.stCrops) s.stCrops.textContent = String(world.crops.size);
    if (s.stFarms) s.stFarms.textContent = String(world.farms.size);
    if (s.stWalls) s.stWalls.textContent = String(world.walls.size);
    if (s.stFlags) s.stFlags.textContent = String(world.flags.size);
    if (s.stBirths) s.stBirths.textContent = String(world.totalBirths);
    if (s.stDeaths) s.stDeaths.textContent = String(world.totalDeaths);
    if (s.stTick) s.stTick.textContent = UIManager.formatTickCount(world.tick);
    if (s.stFps) s.stFps.textContent = fps.toFixed(0);
    if (s.stTickAvg) s.stTickAvg.textContent = tAvg.toFixed(1);
    if (s.stTickMin) s.stTickMin.textContent = tMin.toFixed(1);
    if (s.stTickMax) s.stTickMax.textContent = tMax.toFixed(1);
    if (s.barAgents) s.barAgents.textContent = String(world.agents.length).padStart(2, '0');
    if (s.barFactions) s.barFactions.textContent = String(world.factions.size).padStart(2, '0');
    if (s.barCrops) s.barCrops.textContent = String(world.crops.size).padStart(2, '0');
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
        const div = document.createElement('div');
        div.className = 'faction-item';
        div.innerHTML = `
          <div class="faction-color" style="background:${color}"></div>
          <span class="faction-name">${fid.slice(0, 8)}</span>
          <span class="faction-detail">${members.length} members &middot; Lv ${avgLvl.toFixed(1)}</span>
        `;
        factionsList.appendChild(div);
      }
      world._lastFactionsDomAt = now;
      world._lastFactionsSig = sig;
    }
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
            <span class="agent-name">${a.name}</span>
            <span class="agent-level">LV. ${String(a.level).padStart(2, '0')}</span>
          </div>
          <div class="agent-badges">
            ${a.factionId
              ? `<span class="badge-faction" style="background:${factionColor}22;color:${factionColor};border-color:${factionColor}55">${a.factionId.slice(0, 8).toUpperCase()}</span>`
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
            <span>${a.energy.toFixed(1)}</span>
          </div>
          <div class="agent-stat-bar">
            <div class="agent-stat-fill energy" style="width:${Math.min(100, a.energy / 2)}%"></div>
          </div>
        </div>
      </div>
      <div class="agent-details" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid var(--border)">
        <div style="color:var(--muted)">POSITION</div><div>${a.cellX}, ${a.cellY}</div>
        <div style="color:var(--muted)">ATTACK</div><div>${a.attack.toFixed(1)}</div>
        <div style="color:var(--muted)">AGE</div><div>${a.ageTicks} ticks</div>
        <div style="color:var(--muted)">TRAVEL</div><div>${a.travelPref}</div>
        <div style="color:var(--muted)">AGGRESSION</div><div>${a.aggression.toFixed(2)}</div>
        <div style="color:var(--muted)">COOPERATION</div><div>${a.cooperation.toFixed(2)}</div>
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
