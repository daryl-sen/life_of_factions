import { LOG_CATS } from './constants.js';

export function qs(sel) {
  return document.querySelector(sel);
}

export function renderLog(world, logList) {
  if (!world || !world.log || !logList) return;
  const items = world.log.list(world.activeLogCats, world.activeLogAgentId);
  logList.innerHTML = items
    .slice(-100)
    .reverse()
    .map((it) => {
      const cls =
        it.cat === "attack" ||
        it.cat === "quarrel" ||
        it.cat === "destroy" ||
        it.cat === "death"
          ? "bad"
          : it.cat === "heal" ||
            it.cat === "help" ||
            it.cat === "faction" ||
            it.cat === "level"
          ? "good"
          : "info";
      return `<div class="logItem"><span class="pill ${cls}">${it.cat}</span>${it.msg}</div>`;
    })
    .join("");
}

export function bindDom() {
  const canvas = qs("#canvas"),
    hud = qs("#hud");
  const btnStart = qs("#btnStart"),
    btnPause = qs("#btnPause"),
    btnResume = qs("#btnResume");
  const btnSave = qs("#btnSave"),
    btnLoad = qs("#btnLoad"),
    fileLoad = qs("#fileLoad");
  const rngAgents = qs("#rngAgents"),
    lblAgents = qs("#lblAgents");
  const rngSpeed = qs("#rngSpeed"),
    lblSpeed = qs("#lblSpeed");
  const rngSpawn = qs("#rngSpawn"),
    lblSpawn = qs("#lblSpawn");
  const numAgents = qs("#numAgents"),
    numSpeed = qs("#numSpeed"),
    numSpawn = qs("#numSpawn");
  const btnSpawnCrop = qs("#btnSpawnCrop");
  const btnDrawWalls = qs("#btnDrawWalls");
  const btnEraseWalls = qs("#btnEraseWalls");
  const stAgents = qs("#stAgents"),
    stFactions = qs("#stFactions"),
    stCrops = qs("#stCrops"),
    stFarms = qs("#stFarms"),
    stWalls = qs("#stWalls"),
    stFlags = qs("#stFlags");
  const factionsList = qs("#factionsList");
  const inspector = qs("#inspector"),
    logList = qs("#logList"),
    logFilters = qs("#logFilters");
  const pauseChk = qs("#cbPauseOnBlur");
  const gridChk = qs("#cbDrawGrid");
  return {
    canvas,
    hud,
    buttons: {
      btnStart,
      btnPause,
      btnResume,
      btnSpawnCrop,
      btnDrawWalls,
      btnEraseWalls,
      btnSave,
      btnLoad,
    },
    fileLoad,
    ranges: { rngAgents, rngSpeed, rngSpawn },
    labels: { lblAgents, lblSpeed, lblSpawn },
    nums: { numAgents, numSpeed, numSpawn },
    statsEls: { stAgents, stFactions, stCrops, stFarms, stWalls, stFlags },
    factionsList,
    inspector,
    logList,
    logFilters,
    pauseChk,
    gridChk,
  };
}

export function setupLogFilters(world, logFilters, renderLog2) {
  if (!logFilters) return;
  logFilters.innerHTML = "";
  LOG_CATS.forEach((cat) => {
    const id = "flt_" + cat;
    const w = document.createElement("label");
    w.innerHTML = `<input type="checkbox" id="${id}" checked /> ${cat}`;
    logFilters.appendChild(w);
    const cb = w.querySelector("input");
    cb.addEventListener("change", () => {
      if (cb.checked) world.activeLogCats.add(cat);
      else world.activeLogCats.delete(cat);
      renderLog2();
    });
  });
  const btns = document.createElement("div");
  btns.className = "buttons";
  const all = document.createElement("button");
  all.className = "secondary";
  all.textContent = "Select All";
  const none = document.createElement("button");
  none.className = "secondary";
  none.textContent = "None";
  btns.appendChild(all);
  btns.appendChild(none);
  logFilters.appendChild(btns);

  const agentRow = document.createElement("div");
  agentRow.style.marginTop = "8px";
  const agentLabel = document.createElement("label");
  agentLabel.textContent = "Agent";
  agentLabel.style.display = "block";
  agentLabel.style.margin = "10px 0 4px";
  const agentSelect = document.createElement("select");
  agentSelect.id = "agentFilter";
  agentSelect.style.width = "100%";
  agentSelect.style.background = "#0e1130";
  agentSelect.style.border = "1px solid #2b316a";
  agentSelect.style.color = "var(--text)";
  agentSelect.style.borderRadius = "8px";
  agentSelect.style.padding = "6px";
  const rebuildAgentOptions = () => {
    const cur = world.activeLogAgentId;
    const opts = [{ value: "", label: "All agents" }].concat(
      world.agents.map((a) => ({
        value: a.id,
        label: `${a.name} (${a.id.slice(0, 4)})`,
      }))
    );
    agentSelect.innerHTML = "";
    for (const o of opts) {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (cur === o.value) opt.selected = true;
      agentSelect.appendChild(opt);
    }
  };
  rebuildAgentOptions();
  world._rebuildAgentOptions = rebuildAgentOptions;
  agentSelect.addEventListener("change", () => {
    world.activeLogAgentId = agentSelect.value || null;
    renderLog2();
  });
  agentRow.appendChild(agentLabel);
  agentRow.appendChild(agentSelect);
  logFilters.appendChild(agentRow);

  all.addEventListener("click", () => {
    world.activeLogCats = new Set(LOG_CATS);
    LOG_CATS.forEach(
      (cat) => (logFilters.querySelector("#flt_" + cat).checked = true)
    );
    renderLog2();
  });
  none.addEventListener("click", () => {
    world.activeLogCats.clear();
    LOG_CATS.forEach(
      (cat) => (logFilters.querySelector("#flt_" + cat).checked = false)
    );
    renderLog2();
  });
}

export function renderHUD(world, hud, stats) {
  if (!hud) return;
  hud.textContent = `tick:${world.tick} | fps:${stats.fps.toFixed(
    0
  )} | agents:${world.agents.length}`;
  stats.stAgents.textContent = world.agents.length;
  stats.stFactions.textContent = world.factions.size;
  stats.stCrops.textContent = world.crops.size;
  stats.stFarms.textContent = world.farms.size;
  stats.stWalls.textContent = world.walls.size;
  stats.stFlags.textContent = world.flags.size;
}

export function rebuildFactionsListIfNeeded(world, factionsList) {
  if (!factionsList) return;
  const now = performance.now();
  const sig =
    world.factions.size +
    "|" +
    [...world.factions]
      .map(([fid, f]) => fid + ":" + f.members.size)
      .join(",");
  if (
    sig !== world._lastFactionsSig ||
    now - world._lastFactionsDomAt >= 2000
  ) {
    factionsList.innerHTML = "";
    for (const [fid, f] of world.factions) {
      const color = f.color;
      const div = document.createElement("div");
      const members = [...f.members]
        .map((id) => world.agentsById.get(id))
        .filter(Boolean);
      const avgLvl = (
        members.reduce((s, a) => s + a.level, 0) / (members.length || 1)
      ).toFixed(1);
      const flag = world.flags.get(fid);
      div.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin:6px 0">
        <div style="width:12px;height:12px;border-radius:3px;background:${color}"></div>
        <div class="mono" style="flex:1">${fid}</div>
      </div>
      <div class="kv">
        <div class="muted">Members</div><div>${members.length}</div>
        <div class="muted">Avg level</div><div>${avgLvl}</div>
        <div class="muted">Flag</div><div>${
          flag ? `${flag.x},${flag.y} (${flag.hp}/${flag.maxHp})` : "—"
        }</div>
      </div>`;
      factionsList.appendChild(div);
    }
    world._lastFactionsDomAt = now;
    world._lastFactionsSig = sig;
  }
}

export function updateInspector(world, el) {
  if (!el) return;
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
  el.innerHTML = `<div class="kv">
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
      <div class="muted">Travel Pref</div><div>${a.travelPref}</div>
      <div class="muted">Aggression</div><div>${a.aggression.toFixed(2)}</div>
      <div class="muted">Cooperation</div><div>${a.cooperation.toFixed(2)}</div>
      <div class="muted">Action</div><div>${
        a.action ? a.action.type : "—"
      }</div>
      <div class="muted">Remaining</div><div>${
        a.action ? (a.action.remainingMs / 1000).toFixed(1) + "s" : "—"
      }</div>
    </div>`;
}
