import { key, rndi, uuid } from '../../shared/utils';
import { LOG_CATS } from '../../shared/constants';
import { RingLog } from '../../shared/utils';
import type { World } from '../world';
import { AgentFactory } from '../agent';
import { SimulationEngine } from '../simulation';
import { PersistenceManager } from '../persistence';
import type { DomRefs } from './ui-manager';
import { UIManager } from './ui-manager';

function seedEnvironment(world: World): void {
  for (let i = 0; i < 4; i++) {
    const x = rndi(5, 56);
    const y = rndi(5, 56);
    world.farms.set(key(x, y), { id: uuid(), x, y });
  }
  SimulationEngine.seedInitialFood(world, rndi(5, 10));
}

export class Controls {
  static wire(world: World, dom: DomRefs, doRenderLog: () => void): void {
    const { buttons, ranges, labels, nums } = dom;

    function spawnAgents(n: number): void {
      for (let i = 0; i < n; i++) {
        const { x, y } = world.grid.randomFreeCell();
        AgentFactory.create(world, x, y);
      }
    }

    const $clamp = (v: number, min: number, max: number): number =>
      isNaN(v) ? min : Math.max(min, Math.min(max, v));

    ranges.rngAgents?.addEventListener('input', () => {
      if (labels.lblAgents) labels.lblAgents.textContent = ranges.rngAgents!.value;
      if (nums.numAgents) nums.numAgents.value = ranges.rngAgents!.value;
    });
    ranges.rngSpeed?.addEventListener('input', () => {
      if (labels.lblSpeed) labels.lblSpeed.textContent = ranges.rngSpeed!.value + '%';
      if (nums.numSpeed) nums.numSpeed.value = ranges.rngSpeed!.value;
      world.speedPct = Number(ranges.rngSpeed!.value);
    });
    ranges.rngSpawn?.addEventListener('input', () => {
      if (labels.lblSpawn) labels.lblSpawn.textContent = Number(ranges.rngSpawn!.value).toFixed(1) + '\u00d7';
      if (nums.numSpawn) nums.numSpawn.value = ranges.rngSpawn!.value;
      world.spawnMult = Number(ranges.rngSpawn!.value);
    });
    nums.numAgents?.addEventListener('input', () => {
      const v = $clamp(Number(nums.numAgents!.value), 20, 300);
      nums.numAgents!.value = String(v);
      if (ranges.rngAgents) ranges.rngAgents.value = String(v);
      if (labels.lblAgents) labels.lblAgents.textContent = String(v);
    });
    nums.numSpeed?.addEventListener('input', () => {
      const v = $clamp(Number(nums.numSpeed!.value), 5, 300);
      nums.numSpeed!.value = String(v);
      if (ranges.rngSpeed) ranges.rngSpeed.value = String(v);
      if (labels.lblSpeed) labels.lblSpeed.textContent = v + '%';
      world.speedPct = v;
    });
    nums.numSpawn?.addEventListener('input', () => {
      const v = $clamp(Number(nums.numSpawn!.value), 0.1, 5);
      nums.numSpawn!.value = String(v);
      if (ranges.rngSpawn) ranges.rngSpawn.value = String(v);
      if (labels.lblSpawn) labels.lblSpawn.textContent = v.toFixed(1) + '\u00d7';
      world.spawnMult = v;
    });

    buttons.btnStart?.addEventListener('click', () => {
      if (world.running) return;
      world.grid.clear();
      world.agents.length = 0;
      world.agentsById.clear();
      world.factions.clear();
      world.log = new RingLog(200);
      world.tick = 0;
      world.totalBirths = 0;
      world.totalDeaths = 0;
      world.selectedId = null;
      world.activeLogCats = new Set(LOG_CATS);
      UIManager.setupLogFilters(world, dom.logFilters, doRenderLog);
      world.speedPct = Number(ranges.rngSpeed?.value || 100);
      world.spawnMult = Number(ranges.rngSpawn?.value || 1);
      seedEnvironment(world);
      spawnAgents(Number(ranges.rngAgents?.value || 20));
      world.running = true;
      if (buttons.btnStart) buttons.btnStart.disabled = true;
      if (buttons.btnPause) buttons.btnPause.disabled = false;
      if (buttons.btnResume) buttons.btnResume.disabled = true;
      if (ranges.rngAgents) ranges.rngAgents.disabled = true;
      if (nums.numAgents) nums.numAgents.disabled = true;
      world.log.push({
        t: performance.now(),
        cat: 'info',
        msg: 'Simulation started',
        actorId: null,
        extra: {},
      });
    });

    buttons.btnPause?.addEventListener('click', () => {
      world.running = false;
      if (buttons.btnPause) buttons.btnPause.disabled = true;
      if (buttons.btnResume) buttons.btnResume.disabled = false;
    });

    buttons.btnResume?.addEventListener('click', () => {
      world.running = true;
      if (buttons.btnPause) buttons.btnPause.disabled = false;
      if (buttons.btnResume) buttons.btnResume.disabled = true;
    });

    buttons.btnSpawnCrop?.addEventListener('click', () => {
      const { x, y } = world.grid.randomFreeCell();
      SimulationEngine.addCrop(world, x, y);
    });

    buttons.btnSave?.addEventListener('click', () => PersistenceManager.export(world, doRenderLog));
    buttons.btnLoad?.addEventListener('click', () => dom.fileLoad?.click());
    dom.fileLoad?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          PersistenceManager.restore(world, data, { doRenderLog, dom });
          if (buttons.btnPause) buttons.btnPause.disabled = true;
          if (buttons.btnResume) buttons.btnResume.disabled = false;
          if (buttons.btnStart) buttons.btnStart.disabled = true;
          if (ranges.rngAgents) ranges.rngAgents.disabled = true;
          if (nums.numAgents) nums.numAgents.disabled = true;
        } catch (err) {
          alert('Failed to load save: ' + (err as Error).message);
        } finally {
          if (dom.fileLoad) dom.fileLoad.value = '';
        }
      };
      reader.readAsText(file);
    });
  }
}
