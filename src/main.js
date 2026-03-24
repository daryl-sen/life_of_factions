import { CELL, GRID, WORLD_PX, BASE_TICK_MS, TUNE, ENERGY_CAP } from './constants.js';
import { key, rndi, clamp, log } from './utils.js';
import { World } from './world.js';
import { isBlocked, randomFreeCell } from './spatial.js';
import { planPathTo } from './pathfinding.js';
import { addAgentAt } from './agent.js';
import { reconcileFactions } from './factions.js';
import { applyFlagHealing, cleanDead } from './upkeep.js';
import { harvestAt } from './harvest.js';
import { seekFoodWhenHungry } from './food.js';
import { addCrop, maybeSpawnCrops } from './spawn.js';
import { tryBuildFarm } from './building.js';
import { considerInteract, processAction } from './actions.js';
import { makeCamera, setCanvasSize, fitScaleForCanvas, screenToWorld, zoomAt, panBy, render } from './renderer.js';
import { qs, renderLog, bindDom, setupLogFilters, renderHUD, rebuildFactionsListIfNeeded, updateInspector } from './ui.js';
import { exportState, restoreWorld } from './persistence.js';

document.addEventListener("DOMContentLoaded", () => {
  // DOM
  const dom = bindDom();
  // World
  const world = new World();
  window.world = world;
  // Wall paint mode state
  world.paintMode = "none"; // "none" | "draw" | "erase"

  // Helpers to toggle paint mode and reflect UI state
  const { btnDrawWalls, btnEraseWalls } = dom.buttons;
  function setPaintMode(mode) {
    const next = world.paintMode === mode ? "none" : mode;
    world.paintMode = next;
    if (btnDrawWalls)
      btnDrawWalls.classList.toggle("toggled", next === "draw");
    if (btnEraseWalls)
      btnEraseWalls.classList.toggle("toggled", next === "erase");
  }
  btnDrawWalls?.addEventListener("click", () => setPaintMode("draw"));
  btnEraseWalls?.addEventListener("click", () => setPaintMode("erase"));

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

  // Pre-bind log UI
  const doRenderLog = () => renderLog(world, dom.logList);
  setupLogFilters(world, dom.logFilters, doRenderLog);

  const canvas = dom.canvas;
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const hud = dom.hud;
  const factionsList = dom.factionsList;

  // Camera ----------------------------------------------------
  const camera = makeCamera();
  function refreshCanvasSize() {
    const { w, h, dpr } = setCanvasSize(canvas);
    const fit = fitScaleForCanvas(canvas);
    const levels = [fit * 0.75, fit * 1.0, fit * 1.3, fit * 1.7, fit * 2.2];
    camera._levels = levels.map((v) => clamp(v, 0.2, 6));
    camera._levelIdx = 2;
    camera.scale = camera._levels[camera._levelIdx];
    camera.x = (WORLD_PX - canvas.width / camera.scale) / 2;
    camera.y = (WORLD_PX - canvas.height / camera.scale) / 2;
    panBy(camera, 0, 0);
  }
  refreshCanvasSize();
  window.addEventListener("resize", refreshCanvasSize);

  // Input: panning and zooming (mouse)
  let dragging = false,
    lastX = 0,
    lastY = 0,
    allowDrag = false;
  // Painting state
  let painting = false;
  let lastPaintKey = null;

  function paintAtEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const wpos = screenToWorld(camera, sx, sy);
    const x = Math.floor(wpos.x / CELL),
      y = Math.floor(wpos.y / CELL);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    const k = key(x, y);
    if (k === lastPaintKey) return;
    lastPaintKey = k;
    if (world.paintMode === "draw") {
      if (
        !world.walls.has(k) &&
        !world.farms.has(k) &&
        !world.flagCells.has(k) &&
        !world.crops.has(k) &&
        !world.agentsByCell.has(k)
      ) {
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "w_" + Math.random().toString(36).slice(2);
        world.walls.set(k, { id, x, y, hp: 12, maxHp: 12 });
        if (typeof log === "function")
          try {
            log(world, "build", `Wall @${x},${y} (user)`, null, { x, y });
          } catch {}
      }
    } else if (world.paintMode === "erase") {
      if (world.walls.has(k)) {
        const w = world.walls.get(k);
        world.walls.delete(k);
        if (typeof log === "function")
          try {
            log(world, "destroy", `Wall @${x},${y} removed (user)`, null, {
              x,
              y,
            });
          } catch {}
      }
    }
  }

  function setAllowDrag(e) {
    allowDrag =
      e.buttons === 2 ||
      (e.buttons === 1 && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey));
  }
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    setAllowDrag(e);
    if (allowDrag) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (e.button === 0 && !allowDrag && world.paintMode !== "none") {
      painting = true;
      lastPaintKey = null;
      paintAtEvent(e);
    }
  });
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    setAllowDrag(e);
    if (dragging && allowDrag) {
      const dx = e.clientX - lastX,
        dy = e.clientY - lastY;
      panBy(camera, -dx, -dy);
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (painting && e.buttons & 1 && world.paintMode !== "none") {
      paintAtEvent(e);
    }
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
    painting = false;
    lastPaintKey = null;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const dir = e.deltaY < 0 ? 1 : -1;
      camera._levelIdx = clamp(
        camera._levelIdx + dir,
        0,
        camera._levels.length - 1
      );
      const target = camera._levels[camera._levelIdx];
      const ratio = target / camera.scale;
      zoomAt(camera, sx, sy, ratio);
      e.preventDefault();
    },
    { passive: false }
  );

  // On-screen NavPad wiring (buttons)
  const stepWorld = CELL * 6; // pan by 6 cells
  function zoomCenter(factor) {
    zoomAt(camera, canvas.width / 2, canvas.height / 2, factor);
  }
  qs("#btnPanUp")?.addEventListener("click", () =>
    panBy(camera, 0, -stepWorld * camera.scale)
  );
  qs("#btnPanDown")?.addEventListener("click", () =>
    panBy(camera, 0, stepWorld * camera.scale)
  );
  qs("#btnPanLeft")?.addEventListener("click", () =>
    panBy(camera, -stepWorld * camera.scale, 0)
  );
  qs("#btnPanRight")?.addEventListener("click", () =>
    panBy(camera, stepWorld * camera.scale, 0)
  );
  qs("#btnZoomIn")?.addEventListener("click", () => {
    camera._levelIdx = clamp(
      (camera._levelIdx ?? 2) + 1,
      0,
      (camera._levels?.length || 1) - 1
    );
    const target = camera._levels[camera._levelIdx];
    zoomCenter(target / camera.scale);
  });
  qs("#btnZoomOut")?.addEventListener("click", () => {
    camera._levelIdx = clamp(
      (camera._levelIdx ?? 2) - 1,
      0,
      (camera._levels?.length || 1) - 1
    );
    const target = camera._levels[camera._levelIdx];
    zoomCenter(target / camera.scale);
  });

  // Selection with screen->world
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width,
      scaleY = canvas.height / rect.height;
    const sx = (e.clientX - rect.left) * scaleX,
      sy = (e.clientY - rect.top) * scaleY;
    const wpos = screenToWorld(camera, sx, sy);
    const x = Math.floor(wpos.x / CELL),
      y = Math.floor(wpos.y / CELL);
    if (x < 0 || y < 0 || x >= 62 || y >= 62) return;
    const id = world.agentsByCell.get(key(x, y));
    world.selectedId = id || null;
    updateInspector(world, dom.inspector);
  });

  // Seed environment
  function seedEnvironment() {
    for (let i = 0; i < 4; i++) {
      const x = rndi(5, 56),
        y = rndi(5, 56);
      world.farms.set(key(x, y), { id: crypto.randomUUID(), x, y });
    }
  }

  // Controls wiring -----------------------------------------
  (function wireControls() {
    const { buttons, ranges, labels, nums } = dom;
    function spawnAgents(n) {
      for (let i = 0; i < n; i++) {
        const { x, y } = randomFreeCell(world);
        addAgentAt(world, x, y);
      }
    }
    const $clamp = (v, min, max) =>
      isNaN(v) ? min : Math.max(min, Math.min(max, v));
    ranges.rngAgents?.addEventListener("input", () => {
      labels.lblAgents.textContent = ranges.rngAgents.value;
      nums.numAgents.value = ranges.rngAgents.value;
    });
    ranges.rngSpeed?.addEventListener("input", () => {
      labels.lblSpeed.textContent = ranges.rngSpeed.value + "%";
      nums.numSpeed.value = ranges.rngSpeed.value;
      world.speedPct = Number(ranges.rngSpeed.value);
    });
    ranges.rngSpawn?.addEventListener("input", () => {
      labels.lblSpawn.textContent =
        Number(ranges.rngSpawn.value).toFixed(1) + "×";
      nums.numSpawn.value = ranges.rngSpawn.value;
      world.spawnMult = Number(ranges.rngSpawn.value);
    });
    nums.numAgents?.addEventListener("input", () => {
      const v = $clamp(Number(nums.numAgents.value), 20, 300);
      nums.numAgents.value = v;
      ranges.rngAgents.value = v;
      labels.lblAgents.textContent = v;
    });
    nums.numSpeed?.addEventListener("input", () => {
      const v = $clamp(Number(nums.numSpeed.value), 5, 300);
      nums.numSpeed.value = v;
      ranges.rngSpeed.value = v;
      labels.lblSpeed.textContent = v + "%";
      world.speedPct = v;
    });
    nums.numSpawn?.addEventListener("input", () => {
      let v = Number(nums.numSpawn.value);
      v = $clamp(v, 0.1, 5);
      nums.numSpawn.value = v;
      ranges.rngSpawn.value = v;
      labels.lblSpawn.textContent = v.toFixed(1) + "×";
      world.spawnMult = v;
    });
    buttons.btnStart?.addEventListener("click", () => {
      if (world.running) return;
      world.walls.clear();
      world.crops.clear();
      world.farms.clear();
      world.flags.clear();
      world.flagCells.clear();
      world.agents.length = 0;
      world.agentsById.clear();
      world.agentsByCell.clear();
      world.factions.clear();
      world.log = new world.log.constructor(200);
      world.tick = 0;
      world.selectedId = null;
      world.activeLogCats = new Set([...world.activeLogCats.values()]);
      setupLogFilters(world, dom.logFilters, doRenderLog);
      world.speedPct = Number(ranges.rngSpeed?.value || 50);
      world.spawnMult = Number(ranges.rngSpawn?.value || 1);
      seedEnvironment();
      spawnAgents(Number(ranges.rngAgents?.value || 20));
      world.running = true;
      buttons.btnStart.disabled = true;
      buttons.btnPause.disabled = false;
      buttons.btnResume.disabled = true;
      world.log.push({
        t: performance.now(),
        cat: "info",
        msg: "Simulation started",
        actorId: null,
        extra: {},
      });
    });
    buttons.btnPause?.addEventListener("click", () => {
      world.running = false;
      buttons.btnPause.disabled = true;
      buttons.btnResume.disabled = false;
    });
    buttons.btnResume?.addEventListener("click", () => {
      world.running = true;
      buttons.btnPause.disabled = false;
      buttons.btnResume.disabled = true;
    });
    buttons.btnSpawnCrop?.addEventListener("click", () => {
      const { x, y } = randomFreeCell(world);
      addCrop(world, x, y);
    });
    buttons.btnSave?.addEventListener("click", () => exportState(world, doRenderLog));
    buttons.btnLoad?.addEventListener("click", () => dom.fileLoad.click());
    dom.fileLoad?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          restoreWorld(world, data, { doRenderLog, gridChk: dom.gridChk });
          buttons.btnPause.disabled = true;
          buttons.btnResume.disabled = false;
          const startBtn = buttons.btnStart;
          if (startBtn) startBtn.disabled = true;
        } catch (err) {
          alert("Failed to load save: " + err.message);
        } finally {
          dom.fileLoad.value = "";
        }
      };
      reader.readAsText(file);
    });
  })();

  // Timers & main loop ---------------------------------------
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

  // periodic UI refresh
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

  function biasedRoam(world2, a) {
    const range = 6;
    const candidates = [];
    for (let i = 0; i < 6; i++) {
      const rx = Math.max(0, Math.min(61, a.cellX + rndi(-range, range)));
      const ry = Math.max(0, Math.min(61, a.cellY + rndi(-range, range)));
      if (!isBlocked(world2, rx, ry, a.id)) candidates.push({ x: rx, y: ry });
    }
    if (!candidates.length) return;
    const centerX = Math.floor(GRID / 2),
      centerY = Math.floor(GRID / 2);
    const distToCenter = (c) =>
      Math.abs(c.x - centerX) + Math.abs(c.y - centerY);
    let choice = candidates[0];
    if (a.travelPref === "wander") {
      choice = candidates[rndi(0, candidates.length - 1)];
    } else if (a.travelPref === "near") {
      if (a.factionId) {
        const flag = world2.flags.get(a.factionId);
        if (flag) {
          let bestScore = Infinity;
          for (const c of candidates) {
            const d = Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y);
            const desired = 4;
            let crowd = 0;
            for (let dx = -2; dx <= 2; dx++) {
              for (let dy = -2; dy <= 2; dy++) {
                if (Math.abs(dx) + Math.abs(dy) > 2) continue;
                const id = world2.agentsByCell.get(key(c.x + dx, c.y + dy));
                if (!id) continue;
                const b = world2.agentsById.get(id);
                if (b && b.factionId === a.factionId) crowd++;
              }
            }
            const score = Math.abs(d - desired) + crowd * 0.7;
            if (score < bestScore) {
              bestScore = score;
              choice = c;
            }
          }
        } else {
          choice = candidates.reduce((best, c) =>
            distToCenter(c) < distToCenter(best) ? c : best
          );
        }
      } else {
        choice = candidates.reduce((best, c) =>
          distToCenter(c) < distToCenter(best) ? c : best
        );
      }
    } else if (a.travelPref === "far") {
      if (a.factionId) {
        const flag = world2.flags.get(a.factionId);
        if (flag) {
          choice = candidates.reduce((best, c) =>
            Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y) >
            Math.abs(best.x - flag.x) + Math.abs(best.y - flag.y)
              ? c
              : best
          );
        } else {
          choice = candidates.reduce((best, c) =>
            distToCenter(c) > distToCenter(best) ? c : best
          );
        }
      } else {
        choice = candidates.reduce((best, c) =>
          distToCenter(c) > distToCenter(best) ? c : best
        );
      }
    }
    planPathTo(world2, a, choice.x, choice.y);
  }

  function updateTick() {
    world.tick++;
    const scarcity = world.crops.size / Math.max(1, world.agents.length);
    const budgetThisTick =
      scarcity < 0.25
        ? Math.max(6, Math.floor(world.pathBudgetMax * 0.5))
        : world.pathBudgetMax;
    world.pathBudget = budgetThisTick;
    world._pathWhitelist.clear();
    const n = world.agents.length;
    if (n > 0) {
      const eligible = world.agents.filter(
        (a) =>
          (a.lockMsRemaining || 0) <= 0 &&
          (!a.path || a.pathIdx >= a.path.length) &&
          !a.action
      );
      let pool;
      if (eligible.length) {
        eligible.sort((a, b) => a.energy - b.energy);
        pool = eligible;
      } else pool = world.agents;
      const k = Math.min(budgetThisTick || 30, pool.length);
      for (let i = 0; i < k; i++) {
        const idx = (world._pathRR + i) % pool.length;
        world._pathWhitelist.add(pool[idx].id);
      }
      world._pathRR = (world._pathRR + k) % pool.length;
    }

    maybeSpawnCrops(world);
    for (const b of world.agents) b._underAttack = false;
    for (const b of world.agents) {
      if (
        b.action &&
        b.action.type === "attack" &&
        b.action.payload?.targetId
      ) {
        const t = world.agentsById.get(b.action.payload.targetId);
        if (t) t._underAttack = true;
      }
    }

    for (const a of world.agents) {
      a.ageTicks++;
      a.energy -= 0.01;
      a.lockMsRemaining = Math.max(
        0,
        (a.lockMsRemaining || 0) - BASE_TICK_MS
      );
      if (!a.action && a.lockMsRemaining <= 0) {
        /* noop */
      }
      if (a.energy < TUNE.energyLowThreshold) {
        if (a.action && a.action.type !== "attack") a.action = null;
      }
      if (a.action) {
        processAction(world, a, BASE_TICK_MS);
      } else {
        const locked = a.lockMsRemaining > 0 && !a._underAttack;
        if (!locked) {
          if (a.path && a.pathIdx < a.path.length) {
            const step = a.path[a.pathIdx];
            if (!isBlocked(world, step.x, step.y, a.id)) {
              world.agentsByCell.delete(key(a.cellX, a.cellY));
              a.cellX = step.x;
              a.cellY = step.y;
              world.agentsByCell.set(key(a.cellX, a.cellY), a.id);
              a.pathIdx++;
              a.energy -= TUNE.moveEnergy;
              if (world.crops.has(key(a.cellX, a.cellY)))
                harvestAt(world, a, a.cellX, a.cellY);
            } else {
              a.path = null;
            }
          } else {
            a.path = null;
          }
          if (!a.path) {
            if (a.energy < TUNE.energyLowThreshold) {
              if (Math.random() < 0.4) {
                considerInteract(world, a);
              } else {
                if (world.crops.has(key(a.cellX, a.cellY)))
                  harvestAt(world, a, a.cellX, a.cellY);
                else seekFoodWhenHungry(world, a);
              }
            } else {
              considerInteract(world, a);
              if (!a.path && !a.action) biasedRoam(world, a);
            }
          }
          if (a.energy >= 120 && Math.random() < 0.01) tryBuildFarm(world, a);
        }
      }
      if (a.energy < 0) a.energy = 0;
      if (a.energy > ENERGY_CAP) a.energy = ENERGY_CAP;
      if (a.energy === 0) {
        a.health -= (TUNE.starveHpPerSec * BASE_TICK_MS) / 1000;
      }
      if (a.energy >= ENERGY_CAP * 0.8) {
        a.health = Math.min(
          a.maxHealth,
          a.health + (TUNE.regenHpPerSec * BASE_TICK_MS) / 1000
        );
      }
    }

    if (world.tick % 25 === 0) reconcileFactions(world);
    applyFlagHealing(world);
    cleanDead(world);
  }

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
        updateTick();
        acc -= effTick;
        steps++;
      }
      if (steps === MAX_STEPS) acc = 0;
    }
    render(world, ctx, canvas, hud, statsWithFps, factionsList, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
