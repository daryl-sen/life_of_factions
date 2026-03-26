import { key, rndi, uuid } from '../../shared/utils';
import { GRID, LOG_CATS, OBSTACLE_EMOJIS, TUNE, setGridSize } from '../../shared/constants';
import { RingLog } from '../../shared/utils';
import type { World } from '../world';
import { AgentFactory } from '../agent';
import { SimulationEngine } from '../simulation';
import { PersistenceManager } from '../persistence';
import type { DomRefs } from './ui-manager';
import { UIManager } from './ui-manager';

function seedEnvironment(world: World): void {
  for (let i = 0; i < 4; i++) {
    const x = rndi(5, GRID - 6);
    const y = rndi(5, GRID - 6);
    world.farms.set(key(x, y), { id: uuid(), x, y });
  }
  // Scatter random obstacles — mix of 1x1 and 2x2
  const obstacleCount = rndi(30, 50);
  for (let i = 0; i < obstacleCount; i++) {
    const emoji = OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)];
    if (Math.random() < 0.4) {
      // Try 2x2 placement — one shared obstacle object across all 4 cells
      let placed = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const x = rndi(1, GRID - 3);
        const y = rndi(1, GRID - 3);
        if (!world.grid.isCellOccupied(x, y) &&
            !world.grid.isCellOccupied(x + 1, y) &&
            !world.grid.isCellOccupied(x, y + 1) &&
            !world.grid.isCellOccupied(x + 1, y + 1)) {
          const obs = { id: uuid(), x, y, emoji, hp: 24, maxHp: 24, size: '2x2' as const };
          world.obstacles.set(key(x, y),         obs);
          world.obstacles.set(key(x + 1, y),     obs);
          world.obstacles.set(key(x, y + 1),     obs);
          world.obstacles.set(key(x + 1, y + 1), obs);
          placed = true;
          break;
        }
      }
      if (!placed) {
        const { x, y } = world.grid.randomFreeCell();
        world.obstacles.set(key(x, y), { id: uuid(), x, y, emoji, hp: 12, maxHp: 12 });
      }
    } else {
      const { x, y } = world.grid.randomFreeCell();
      world.obstacles.set(key(x, y), { id: uuid(), x, y, emoji, hp: 12, maxHp: 12 });
    }
  }
  SimulationEngine.seedInitialTrees(world, rndi(8, 15));
  SimulationEngine.seedInitialWater(world, rndi(3, 6));
  SimulationEngine.seedInitialFood(world, rndi(5, 10));
}

export class Controls {
  static wire(world: World, dom: DomRefs, doRenderLog: () => void, onWorldResize?: () => void): void {
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
    ranges.rngCloudRate?.addEventListener('input', () => {
      if (labels.lblCloudRate) labels.lblCloudRate.textContent = Number(ranges.rngCloudRate!.value).toFixed(1) + '\u00d7';
      if (nums.numCloudRate) nums.numCloudRate.value = ranges.rngCloudRate!.value;
      world.cloudSpawnRate = Number(ranges.rngCloudRate!.value);
    });
    ranges.rngWorldSize?.addEventListener('input', () => {
      const v = Number(ranges.rngWorldSize!.value);
      if (labels.lblWorldSize) labels.lblWorldSize.textContent = v + '\u00d7' + v;
      if (nums.numWorldSize) nums.numWorldSize.value = ranges.rngWorldSize!.value;
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
    nums.numCloudRate?.addEventListener('input', () => {
      const v = $clamp(Number(nums.numCloudRate!.value), 0, 10);
      nums.numCloudRate!.value = String(v);
      if (ranges.rngCloudRate) ranges.rngCloudRate.value = String(v);
      if (labels.lblCloudRate) labels.lblCloudRate.textContent = v.toFixed(1) + '\u00d7';
      world.cloudSpawnRate = v;
    });
    nums.numWorldSize?.addEventListener('input', () => {
      const v = $clamp(Number(nums.numWorldSize!.value), 20, 120);
      nums.numWorldSize!.value = String(v);
      if (ranges.rngWorldSize) ranges.rngWorldSize.value = String(v);
      if (labels.lblWorldSize) labels.lblWorldSize.textContent = v + '\u00d7' + v;
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
      // Apply world size before seeding
      const worldSize = Number(ranges.rngWorldSize?.value || 62);
      setGridSize(worldSize);
      world.grid.size = worldSize;

      world.speedPct = Number(ranges.rngSpeed?.value || 100);
      world.cloudSpawnRate = Number(ranges.rngCloudRate?.value || 1);
      seedEnvironment(world);
      spawnAgents(Number(ranges.rngAgents?.value || 20));
      world.running = true;
      if (buttons.btnStart) buttons.btnStart.disabled = true;
      if (buttons.btnPause) buttons.btnPause.disabled = false;
      if (buttons.btnResume) buttons.btnResume.disabled = true;
      if (ranges.rngAgents) ranges.rngAgents.disabled = true;
      if (nums.numAgents) nums.numAgents.disabled = true;
      if (ranges.rngWorldSize) ranges.rngWorldSize.disabled = true;
      if (nums.numWorldSize) nums.numWorldSize.disabled = true;
      if (onWorldResize) onWorldResize();
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

    buttons.btnSpawnTree?.addEventListener('click', () => {
      SimulationEngine.addTree(world);
    });

    buttons.btnSpawnCloud?.addEventListener('click', () => {
      const x = rndi(0, GRID - 1);
      const y = rndi(0, GRID - 1);
      const lifetime = rndi(TUNE.cloud.lifetimeRange[0], TUNE.cloud.lifetimeRange[1]);
      world.clouds.push({ id: uuid(), x, y, spawnedAtMs: performance.now(), lifetimeMs: lifetime, rained: false });
    });

    buttons.btnReplenish?.addEventListener('click', () => {
      const next = world.paintMode === 'replenish' ? 'none' as const : 'replenish' as const;
      world.paintMode = next;
      buttons.btnReplenish!.classList.toggle('toggled', next === 'replenish');
      // Deactivate other paint modes
      if (next === 'replenish') {
        if (dom.buttons.btnDrawObstacles) dom.buttons.btnDrawObstacles.classList.remove('toggled');
        if (dom.buttons.btnEraseObstacles) dom.buttons.btnEraseObstacles.classList.remove('toggled');
      }
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
