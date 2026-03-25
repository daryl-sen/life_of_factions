import { key, rndi, uuid } from './utils.js';
import { randomFreeCell } from './spatial.js';
import { addAgentAt } from './agent.js';
import { addCrop } from './spawn.js';
import { setupLogFilters } from './ui.js';
import { exportState, restoreWorld } from './persistence.js';

function seedEnvironment(world) {
  for (let i = 0; i < 4; i++) {
    const x = rndi(5, 56),
      y = rndi(5, 56);
    world.farms.set(key(x, y), { id: uuid(), x, y });
  }
}

export function wireControls(world, dom, doRenderLog) {
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
    seedEnvironment(world);
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
}
