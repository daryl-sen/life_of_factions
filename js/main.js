// main.js
import { BASE_TICK_MS, TUNE, OFFSET } from "./constants.js";
import { World } from "./world.js";
import { render } from "./render.js";
import { bindDom, setupLogFilters, renderLog as renderLogUI } from "./ui.js";
import { recomputeFactions, randomFreeCell } from "./systems/factions.js";
import { maybeSpawnCrops } from "./systems/spawn.js";
import { applyFlagHealing, cleanDead, levelCheck } from "./systems/upkeep.js";
import {
  addCrop,
  considerInteract,
  processAction,
  seekFoodWhenHungry,
  planPathTo,
} from "./systems/actions.js";
import { isBlocked } from "./systems/spatial.js";
import { key, rndi } from "./utils.js";
import { tryBuildWall, tryBuildFarm } from "./systems/building.js";
import { harvestAt } from "./systems/harvest.js";

document.addEventListener("DOMContentLoaded", () => {
  const dom = bindDom();
  const ctx = dom.canvas.getContext("2d");
  const world = new World();
  window.world = world; // debug access

  // ---- UI: filters
  const doRenderLog = () => renderLogUI(world, dom.logList);
  setupLogFilters(world, dom.logFilters, doRenderLog);

  // ---- Seed world items
  function seedEnvironment() {
    for (let i = 0; i < 4; i++) {
      const x = rndi(5, 56),
        y = rndi(5, 56);
      world.farms.set(key(x, y), { id: crypto.randomUUID(), x, y });
    }
    for (let i = 0; i < 40; i++) {
      const x = rndi(0, 61),
        y = rndi(0, 61);
      const k = key(x, y);
      if (world.walls.has(k)) continue;
      world.walls.set(k, {
        id: crypto.randomUUID(),
        x,
        y,
        hp: rndi(TUNE.wallHp[0], TUNE.wallHp[1]),
        maxHp: TUNE.wallHp[1],
      });
    }
  }
  function addAgentAt(x, y) {
    return processAction.addAgentAt ? processAction.addAgentAt : null;
  }

  function spawnAgents(n) {
    for (let i = 0; i < n; i++) {
      const { x, y } = randomFreeCell(world);
      // re-use actions.addAgentAt (exported) to keep maps consistent
      // (imported from actions module as named export)
    }
  }

  // We’ll inline addAgentAt/spawnAgents via actions module exports
  import("./systems/actions.js").then(({ addAgentAt }) => {
    // expose spawnAgents now that addAgentAt is available
    function spawnAgents(n) {
      for (let i = 0; i < n; i++) {
        const { x, y } = randomFreeCell(world);
        addAgentAt(world, x, y);
      }
    }

    // ===== Controls =====
    const $clamp = (v, min, max) =>
      isNaN(v) ? min : Math.max(min, Math.min(max, v));
    dom.ranges.rngAgents.addEventListener("input", () => {
      dom.labels.lblAgents.textContent = dom.ranges.rngAgents.value;
      dom.nums.numAgents.value = dom.ranges.rngAgents.value;
    });
    dom.ranges.rngSpeed.addEventListener("input", () => {
      dom.labels.lblSpeed.textContent = dom.ranges.rngSpeed.value + "%";
      dom.nums.numSpeed.value = dom.ranges.rngSpeed.value;
      world.speedPct = Number(dom.ranges.rngSpeed.value);
    });
    dom.ranges.rngSpawn.addEventListener("input", () => {
      dom.labels.lblSpawn.textContent =
        Number(dom.ranges.rngSpawn.value).toFixed(1) + "×";
      dom.nums.numSpawn.value = dom.ranges.rngSpawn.value;
      world.spawnMult = Number(dom.ranges.rngSpawn.value);
    });
    dom.nums.numAgents.addEventListener("input", () => {
      const v = $clamp(Number(dom.nums.numAgents.value), 20, 300);
      dom.nums.numAgents.value = v;
      dom.ranges.rngAgents.value = v;
      dom.labels.lblAgents.textContent = v;
    });
    dom.nums.numSpeed.addEventListener("input", () => {
      const v = $clamp(Number(dom.nums.numSpeed.value), 5, 300);
      dom.nums.numSpeed.value = v;
      dom.ranges.rngSpeed.value = v;
      dom.labels.lblSpeed.textContent = v + "%";
      world.speedPct = v;
    });
    dom.nums.numSpawn.addEventListener("input", () => {
      let v = Number(dom.nums.numSpawn.value);
      v = $clamp(v, 0.1, 5);
      dom.nums.numSpawn.value = v;
      dom.ranges.rngSpawn.value = v;
      dom.labels.lblSpawn.textContent = v.toFixed(1) + "×";
      world.spawnMult = v;
    });

    dom.buttons.btnStart.addEventListener("click", () => {
      if (world.running) return;
      world.walls.clear();
      world.crops.clear();
      world.farms.clear();
      world.flags.clear();
      world.agents.length = 0;
      world.agentsById.clear();
      world.agentsByCell.clear();
      world.factions.clear();
      world.log = new world.log.constructor(100);
      world.tick = 0;
      world.selectedId = null;
      world.activeLogCats = new Set([...world.activeLogCats.values()]);
      setupLogFilters(world, dom.logFilters, doRenderLog);
      world.speedPct = Number(dom.ranges.rngSpeed.value);
      world.spawnMult = Number(dom.ranges.rngSpawn.value);
      seedEnvironment();
      spawnAgents(Number(dom.ranges.rngAgents.value));
      world.running = true;
      dom.buttons.btnStart.disabled = true;
      dom.buttons.btnPause.disabled = false;
      dom.buttons.btnResume.disabled = true;
      world.log.push({
        t: performance.now(),
        cat: "info",
        msg: "Simulation started",
        actorId: null,
        extra: {},
      });
    });
    dom.buttons.btnPause.addEventListener("click", () => {
      world.running = false;
      dom.buttons.btnPause.disabled = true;
      dom.buttons.btnResume.disabled = false;
    });
    dom.buttons.btnResume.addEventListener("click", () => {
      world.running = true;
      dom.buttons.btnPause.disabled = false;
      dom.buttons.btnResume.disabled = true;
    });
    dom.buttons.btnSpawnCrop.addEventListener("click", () => {
      const { x, y } = randomFreeCell(world);
      addCrop(world, x, y);
    });

    // ===== Canvas interactions =====
    dom.canvas.addEventListener("click", (e) => {
      const rect = dom.canvas.getBoundingClientRect();
      const scaleX = dom.canvas.width / rect.width;
      const scaleY = dom.canvas.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX - OFFSET;
      const py = (e.clientY - rect.top) * scaleY - OFFSET;
      const x = Math.floor(px / 16),
        y = Math.floor(py / 16);
      if (x < 0 || y < 0 || x >= 62 || y >= 62) return;
      const id = world.agentsByCell.get(key(x, y));
      world.selectedId = id || null;
      updateInspector(world, dom.inspector);
    });

    // ===== Inspector & Log refresh =====
    function updateInspector(world, el) {
      if (!world.selectedId) {
        el.innerHTML = '<div class="muted">Click an agent on the canvas.</div>';
        return;
      }
      const a = world.agentsById.get(world.selectedId);
      if (!a) {
        el.innerHTML = '<div class="muted">(agent gone)</div>';
        return;
      }
      const relCount = a.relationships.size;
      el.innerHTML = `
        <div class="kv">
          <div class="muted">Name</div><div class="mono">${a.name}</div>
          <div class="muted">Faction</div><div>${a.factionId || "—"}</div>
          <div class="muted">Level</div><div>${a.level}</div>
          <div class="muted">Attack</div><div>${a.attack.toFixed(1)}</div>
          <div class="muted">HP</div><div>${a.health.toFixed(
            1
          )} / ${a.maxHealth.toFixed(0)}</div>
          <div class="muted">Energy</div><div>${a.energy.toFixed(1)}</div>
          <div class="muted">Age (ticks)</div><div>${a.ageTicks}</div>
          <div class="muted">Relationships</div><div>${relCount}</div>
          <div class="muted">Action</div><div>${
            a.action ? a.action.type : "—"
          }</div>
          <div class="muted">Remaining</div><div>${
            a.action ? (a.action.remainingMs / 1000).toFixed(1) + "s" : "—"
          }</div>
        </div>`;
    }
    setInterval(() => {
      updateInspector(world, dom.inspector);
      doRenderLog();
    }, 400);

    // ===== Main loop =====
    let lastTs = 0,
      acc = 0,
      fps = 0,
      fpsAcc = 0,
      fpsCount = 0;
    function updateTick() {
      world.tick++;
      maybeSpawnCrops(world);

      // under-attack set (for lock exceptions)
      const underAttack = new Set();
      for (const b of world.agents) {
        if (
          b.action &&
          b.action.type === "attack" &&
          b.action.payload?.targetId
        ) {
          underAttack.add(b.action.payload.targetId);
        }
      }

      for (const a of world.agents) {
        a.ageTicks++;
        a.energy -= 0.01;
        a.lockMsRemaining = Math.max(
          0,
          (a.lockMsRemaining || 0) - BASE_TICK_MS
        );

        // hunger planning
        if (a.energy < TUNE.energyLowThreshold) {
          if (a.action && a.action.type !== "reproduce") a.action = null;
          if (!a.path || a.pathIdx >= (a.path?.length || 0))
            seekFoodWhenHungry(world, a);
        }

        if (a.action) {
          processAction(world, a, BASE_TICK_MS);
        } else {
          const locked = a.lockMsRemaining > 0 && !underAttack.has(a.id);
          if (!locked) {
            // MOVE FIRST
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

            // THEN PLAN
            if (!a.path) {
              if (a.energy < TUNE.foodPlanThreshold) {
                if (world.crops.has(key(a.cellX, a.cellY)))
                  harvestAt(world, a, a.cellX, a.cellY);
                else {
                  const adj = [
                    [a.cellX + 1, a.cellY],
                    [a.cellX - 1, a.cellY],
                    [a.cellX, a.cellY + 1],
                    [a.cellX, a.cellY - 1],
                  ];
                  const t = adj.find(
                    ([nx, ny]) =>
                      world.crops.has(key(nx, ny)) &&
                      !isBlocked(world, nx, ny, a.id)
                  );
                  if (t) planPathTo(world, a, t[0], t[1]);
                  else {
                    const near = (function () {
                      let best = null,
                        bestD = 1e9;
                      for (const c of world.crops.values()) {
                        const d =
                          Math.abs(a.cellX - c.x) + Math.abs(a.cellY - c.y);
                        if (d < bestD) {
                          bestD = d;
                          best = c;
                        }
                      }
                      return best;
                    })();
                    if (near) planPathTo(world, a, near.x, near.y);
                  }
                }
              }
              if (!a.path) {
                const range = 6;
                const rx = Math.max(
                  0,
                  Math.min(61, a.cellX + rndi(-range, range))
                );
                const ry = Math.max(
                  0,
                  Math.min(61, a.cellY + rndi(-range, range))
                );
                if (!isBlocked(world, rx, ry, a.id))
                  planPathTo(world, a, rx, ry);
              }
            }

            if (Math.random() < 0.1) considerInteract(world, a);
            if (Math.random() < 0.02) tryBuildWall(world, a);
            if (a.energy >= 120 && Math.random() < 0.01) tryBuildFarm(world, a);
          }
        }

        // starvation & level-up
        if (a.energy <= 0) {
          a.starvingSeconds += BASE_TICK_MS / 1000;
          if (a.starvingSeconds > TUNE.starvationSeconds) a.health = 0;
        } else {
          a.starvingSeconds = 0;
        }
        levelCheck(world, a);
      }

      if (world.tick % 25 === 0) recomputeFactions(world);
      applyFlagHealing(world);
      cleanDead(world);
    }

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
        while (acc >= effTick) {
          updateTick();
          acc -= effTick;
        }
      }
      render(
        world,
        ctx,
        dom.canvas,
        dom.hud,
        { fps, ...dom.statsEls },
        dom.factionsList
      );
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
});
