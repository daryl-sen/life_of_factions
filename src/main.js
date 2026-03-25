import { WORLD_PX, BASE_TICK_MS } from './constants.js';
import { clamp } from './utils.js';
import { World } from './world.js';
import { makeCamera, setCanvasSize, fitScaleForCanvas, panBy } from './camera.js';
import { render } from './renderer.js';
import { renderLog, bindDom, setupLogFilters, renderHUD, rebuildFactionsListIfNeeded, updateInspector } from './ui.js';
import { setupInput } from './input.js';
import { wireControls } from './controls.js';
import { updateTick } from './simulation.js';

document.addEventListener("DOMContentLoaded", () => {
  const dom = bindDom();
  const world = new World();
  window.world = world;
  world.paintMode = "none";

  // Pause & Grid toggles
  if (dom.pauseChk) {
    dom.pauseChk.checked = world.pauseOnBlur;
    dom.pauseChk.addEventListener(
      "change",
      () => (world.pauseOnBlur = dom.pauseChk.checked)
    );
  }
  if (dom.gridChk) {
    dom.gridChk.checked = world.drawGrid;
    dom.gridChk.addEventListener(
      "change",
      () => (world.drawGrid = dom.gridChk.checked)
    );
  }

  // Log UI
  const doRenderLog = () => renderLog(world, dom.logList);
  setupLogFilters(world, dom.logFilters, doRenderLog);

  const canvas = dom.canvas;
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const factionsList = dom.factionsList;

  // Camera
  const camera = makeCamera();
  function refreshCanvasSize() {
    setCanvasSize(canvas);
    const fit = fitScaleForCanvas(canvas);
    camera.scale = clamp(fit, camera.min, camera.max);
    camera.x = (WORLD_PX - canvas.width / camera.scale) / 2;
    camera.y = (WORLD_PX - canvas.height / camera.scale) / 2;
    panBy(camera, 0, 0);
  }
  refreshCanvasSize();
  window.addEventListener("resize", refreshCanvasSize);

  // Wire input + controls
  setupInput(canvas, camera, world, dom);
  wireControls(world, dom, doRenderLog);

  // Timer state
  let lastTs = 0,
    acc = 0,
    fps = 0,
    fpsAcc = 0,
    fpsCount = 0;
  const statsWithFps = new Proxy(dom.statsEls, {
    get(target, prop) {
      if (prop === "fps") return fps;
      return target[prop];
    },
  });

  // Pause on blur/hidden
  function pauseForBlur(reason) {
    if (world.pauseOnBlur && world.running) {
      world.running = false;
      const btnPause = dom.buttons.btnPause,
        btnResume = dom.buttons.btnResume;
      if (btnPause) btnPause.disabled = true;
      if (btnResume) btnResume.disabled = false;
      world.log.push({
        t: performance.now(),
        cat: "info",
        msg: "Paused (" + reason + ")",
        actorId: null,
        extra: {},
      });
      doRenderLog();
    }
  }
  window.addEventListener("blur", () => pauseForBlur("window lost focus"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseForBlur("tab hidden");
  });

  // Periodic UI refresh
  setInterval(() => {
    updateInspector(world, dom.inspector);
    renderHUD(world, dom.hud, statsWithFps);
    doRenderLog();
    if (world._rebuildAgentOptions) {
      if (world._lastAgentCount !== world.agents.length) {
        world._rebuildAgentOptions();
        world._lastAgentCount = world.agents.length;
      }
    }
    rebuildFactionsListIfNeeded(world, factionsList);
  }, 400);

  // Game loop
  const MAX_STEPS = 8;
  function loop(ts) {
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
        updateTick(world);
        acc -= effTick;
        steps++;
      }
      if (steps === MAX_STEPS) acc = 0;
    }
    render(world, ctx, canvas, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
