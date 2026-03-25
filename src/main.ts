import { BASE_TICK_MS } from './shared/constants';
import { VERSION } from './shared/version';
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

  // Camera
  const camera = new Camera();
  const renderer = new Renderer();

  function refreshCanvasSize() {
    const { cw, ch } = Camera.setCanvasSize(canvas);
    camera.viewW = cw;
    camera.viewH = ch;
    camera.fitToCanvas(canvas);
  }
  refreshCanvasSize();
  window.addEventListener('resize', refreshCanvasSize);

  // Wire input + controls
  InputHandler.setup(canvas, camera, world, dom);
  Controls.wire(world, dom, doRenderLog);

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
  const statsWithFps = new Proxy(
    { ...dom.statsEls, ...dom.barEls } as Record<string, unknown>,
    {
      get(target, prop) {
        if (prop === 'fps') return fps;
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
      const effTick = BASE_TICK_MS / (world.speedPct / 100);
      acc += dt;
      let steps = 0;
      while (acc >= effTick && steps < MAX_STEPS) {
        SimulationEngine.tick(world);
        acc -= effTick;
        steps++;
      }
      if (steps === MAX_STEPS) acc = 0;
      const lerpDelta = dt / (BASE_TICK_MS / (world.speedPct / 100));
      for (const a of world.agents) {
        if (a.lerpT < 1) {
          a.lerpT = Math.min(1, a.lerpT + lerpDelta);
        }
      }
    }
    renderer.render(world, ctx, canvas, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
