import { TICK_MS } from './core/constants';

const VERSION = '4.0.0';
import { World } from './domains/world';
import { Camera } from './domains/rendering/camera';
import { Renderer } from './domains/rendering/renderer';
import { UIManager } from './domains/ui/ui-manager';
import { InputHandler } from './domains/ui/input-handler';
import { Controls } from './domains/ui/controls';
import { SimulationEngine } from './domains/simulation';

document.addEventListener('DOMContentLoaded', () => {
  document.title = `Emoji Life — v${VERSION}`;
  const versionEl = document.querySelector('.sidebar-version');
  if (versionEl) versionEl.textContent = `V${VERSION}`;

  const dom = UIManager.bindDom();
  const world = new World();
  (window as unknown as Record<string, unknown>).world = world;

  // Pause & Grid toggles
  if (dom.pauseChk) {
    dom.pauseChk.checked = world.pauseOnBlur;
    dom.pauseChk.addEventListener('change', () => (world.pauseOnBlur = dom.pauseChk!.checked));
  }
  if (dom.gridChk) {
    dom.gridChk.checked = world.drawGrid;
    dom.gridChk.addEventListener('change', () => (world.drawGrid = dom.gridChk!.checked));
  }

  // Log UI
  const doRenderLog = () => UIManager.renderLog(world, dom.logList);
  UIManager.setupLogFilters(world, dom.logFilters, doRenderLog);

  const canvas = dom.canvas;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;
  const factionsList = dom.factionsList;
  const familiesList = dom.familiesList;

  // Camera
  const camera = new Camera();
  const renderer = new Renderer();

  let cameraInitialized = false;
  function refreshCanvasSize() {
    const { cw, ch } = Camera.setCanvasSize(canvas);
    camera.viewW = cw;
    camera.viewH = ch;
    if (!cameraInitialized) {
      camera.fitToCanvas(canvas);
      cameraInitialized = true;
    } else {
      // Preserve zoom/pan — just clamp to valid bounds
      camera.panBy(0, 0);
    }
  }
  refreshCanvasSize();
  window.addEventListener('resize', refreshCanvasSize);

  // Wire input + controls
  InputHandler.setup(canvas, camera, world, dom);
  Controls.wire(world, dom, doRenderLog, refreshCanvasSize);

  // Faction sort dropdown
  if (dom.factionSortEl) {
    dom.factionSortEl.addEventListener('change', () => {
      world.factionSort = dom.factionSortEl!.value as 'members' | 'created' | 'name' | 'level';
      world._lastFactionsSig = ''; // force rebuild
    });
  }

  // Sidebar play button
  const sidebarPlay = document.getElementById('sidebarPlay');
  if (sidebarPlay) {
    sidebarPlay.addEventListener('click', () => {
      if (!world.running && world.tick === 0) {
        dom.buttons.btnStart?.click();
      } else if (!world.running) {
        dom.buttons.btnResume?.click();
      } else {
        dom.buttons.btnPause?.click();
      }
    });
  }

  // Timer state
  let lastTs = 0;
  let acc = 0;
  let fps = 0;
  let fpsAcc = 0;
  let fpsCount = 0;

  // Profiler — rolling window of samples from the last 60s
  const PROFILE_WINDOW_MS = 60_000;

  interface ProfileSample { ts: number; dur: number }
  interface ProfileStats { avg: number; min: number; max: number }

  function makeProfiler() {
    const samples: ProfileSample[] = [];
    const stats: ProfileStats = { avg: 0, min: 0, max: 0 };
    return {
      record(dur: number) {
        const now = performance.now();
        samples.push({ ts: now, dur });
        const cutoff = now - PROFILE_WINDOW_MS;
        while (samples.length > 0 && samples[0].ts < cutoff) samples.shift();
        let sum = 0, min = Infinity, max = -Infinity;
        for (const s of samples) {
          sum += s.dur;
          if (s.dur < min) min = s.dur;
          if (s.dur > max) max = s.dur;
        }
        stats.avg = sum / samples.length;
        stats.min = min === Infinity ? 0 : min;
        stats.max = max === -Infinity ? 0 : max;
      },
      stats,
    };
  }

  const tickProfiler = makeProfiler();
  const renderProfiler = makeProfiler();

  const statsWithFps = new Proxy(
    { ...dom.statsEls, ...dom.barEls } as Record<string, unknown>,
    {
      get(target, prop) {
        if (prop === 'fps') return fps;
        if (prop === 'tickAvg') return tickProfiler.stats.avg;
        if (prop === 'tickMin') return tickProfiler.stats.min;
        if (prop === 'tickMax') return tickProfiler.stats.max;
        if (prop === 'renderAvg') return renderProfiler.stats.avg;
        if (prop === 'renderMin') return renderProfiler.stats.min;
        if (prop === 'renderMax') return renderProfiler.stats.max;
        return target[prop as string];
      },
    }
  );

  // Pause on blur/hidden
  function pauseForBlur(reason: string) {
    if (world.pauseOnBlur && world.running) {
      world.running = false;
      if (dom.buttons.btnPause) dom.buttons.btnPause.disabled = true;
      if (dom.buttons.btnResume) dom.buttons.btnResume.disabled = false;
      world.log.push({
        t: performance.now(),
        cat: 'info',
        msg: 'Paused (' + reason + ')',
        actorId: null,
        extra: {},
      });
      doRenderLog();
    }
  }
  window.addEventListener('blur', () => pauseForBlur('window lost focus'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseForBlur('tab hidden');
  });

  // Track selected agent for notification
  let lastSelectedId: string | null = null;

  // Periodic UI refresh
  setInterval(() => {
    UIManager.updateInspector(world, dom.inspector);
    UIManager.renderHUD(world, dom.hud, statsWithFps);
    doRenderLog();
    if (world._rebuildAgentOptions) {
      if (world._lastAgentCount !== world.agents.length) {
        world._rebuildAgentOptions();
        world._lastAgentCount = world.agents.length;
      }
    }
    UIManager.rebuildFactionsListIfNeeded(world, factionsList);
    UIManager.rebuildFamiliesListIfNeeded(world, familiesList);

    // Update sidebar play button icon
    if (sidebarPlay) {
      sidebarPlay.innerHTML = world.running
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }

    if (world.selectedId && world.selectedId !== lastSelectedId) {
      const agent = world.agentsById.get(world.selectedId);
      if (agent) UIManager.showNotification(agent);
    }
    lastSelectedId = world.selectedId;
  }, 400);

  // Game loop
  const MAX_STEPS = 8;
  function loop(ts: number) {
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;
    fpsAcc += dt;
    fpsCount++;
    if (fpsAcc >= 500) {
      fps = 1000 / (fpsAcc / fpsCount);
      fpsAcc = 0;
      fpsCount = 0;
    }
    if (world.running) {
      const effTick = TICK_MS / (world.speedPct / 100);
      acc += dt;
      let steps = 0;
      while (acc >= effTick && steps < MAX_STEPS) {
        const t0 = performance.now();
        SimulationEngine.tick(world);
        tickProfiler.record(performance.now() - t0);
        acc -= effTick;
        steps++;
      }
      if (steps === MAX_STEPS) acc = 0;
      const lerpDelta = dt / (TICK_MS / (world.speedPct / 100));
      for (const a of world.agents) {
        if (a.lerpT < 1) {
          a.lerpT = Math.min(1, a.lerpT + lerpDelta);
        }
      }
    }

    // Tick down death markers
    for (let i = world.deadMarkers.length - 1; i >= 0; i--) {
      world.deadMarkers[i].msRemaining -= dt;
      if (world.deadMarkers[i].msRemaining <= 0) {
        world.deadMarkers.splice(i, 1);
      }
    }
    const rt0 = performance.now();
    renderer.render(world, ctx, canvas, camera);
    renderProfiler.record(performance.now() - rt0);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
