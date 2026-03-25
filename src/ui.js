import { LOG_CATS, AGENT_EMOJIS } from './constants.js';

const PAGE_LOAD_TIME = Date.now() - performance.now();

export function qs(sel) {
  return document.querySelector(sel);
}

/* ── Log rendering ────────────────────────── */

const CAT_ICONS = {
  talk: "\u{1F4AC}",
  quarrel: "\u{1F4A2}",
  attack: "\u2694\uFE0F",
  heal: "\u{1F49A}",
  help: "\u{1F91D}",
  reproduce: "\u{1F495}",
  build: "\u{1F528}",
  destroy: "\u{1F4A5}",
  death: "\u{1F480}",
  faction: "\u2728",
  level: "\u2B50",
  spawn: "\u{1F331}",
  info: "\u{1F4E1}",
};

function catClass(cat) {
  if (cat === "attack" || cat === "quarrel" || cat === "destroy" || cat === "death")
    return "cat-bad";
  if (cat === "heal" || cat === "help" || cat === "faction" || cat === "level")
    return "cat-good";
  if (cat === "reproduce" || cat === "spawn" || cat === "build")
    return "cat-warn";
  return "cat-info";
}

function formatTime(t) {
  const d = new Date(PAGE_LOAD_TIME + t);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function renderLog(world, logList) {
  if (!world || !world.log || !logList) return;
  const items = world.log.list(world.activeLogCats, world.activeLogAgentId);
  logList.innerHTML = items
    .slice(-100)
    .reverse()
    .map((it) => {
      const cls = catClass(it.cat);
      const icon = CAT_ICONS[it.cat] || "";
      const time = formatTime(it.t);
      return `<div class="log-entry ${cls}">
        <div class="log-entry-time"><span class="log-entry-icon">${icon}</span>${time}</div>
        <div class="log-entry-msg">${it.msg}</div>
      </div>`;
    })
    .join("");
}

/* ── DOM binding ──────────────────────────── */

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
  const barAgents = qs("#barAgents"),
    barFactions = qs("#barFactions"),
    barCrops = qs("#barCrops");
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
    barEls: { barAgents, barFactions, barCrops },
    factionsList,
    inspector,
    logList,
    logFilters,
    pauseChk,
    gridChk,
  };
}

/* ── Log filter pills ─────────────────────── */

export function setupLogFilters(world, logFilters, renderLog2) {
  if (!logFilters) return;
  logFilters.innerHTML = "";

  // "ALL" pill
  const allPill = document.createElement("button");
  allPill.className = "filter-pill active";
  allPill.textContent = "ALL";
  logFilters.appendChild(allPill);

  // Category pills
  const pills = new Map();
  LOG_CATS.forEach((cat) => {
    const pill = document.createElement("button");
    pill.className = "filter-pill" + (world.activeLogCats.has(cat) ? " active" : "");
    pill.textContent = cat.toUpperCase();
    pill.dataset.cat = cat;
    logFilters.appendChild(pill);
    pills.set(cat, pill);

    pill.addEventListener("click", () => {
      if (world.activeLogCats.has(cat)) {
        world.activeLogCats.delete(cat);
        pill.classList.remove("active");
      } else {
        world.activeLogCats.add(cat);
        pill.classList.add("active");
      }
      // Update ALL pill state
      allPill.classList.toggle(
        "active",
        world.activeLogCats.size === LOG_CATS.length
      );
      renderLog2();
    });
  });

  allPill.addEventListener("click", () => {
    const allActive = world.activeLogCats.size === LOG_CATS.length;
    if (allActive) {
      world.activeLogCats.clear();
      pills.forEach((p) => p.classList.remove("active"));
      allPill.classList.remove("active");
    } else {
      world.activeLogCats = new Set(LOG_CATS);
      pills.forEach((p) => p.classList.add("active"));
      allPill.classList.add("active");
    }
    renderLog2();
  });

  // Agent filter select (in the event-matrix-header)
  const agentSelect = qs("#agentFilterSelect");
  if (agentSelect) {
    const rebuildAgentOptions = () => {
      const cur = world.activeLogAgentId;
      const opts = [{ value: "", label: "All Agents" }].concat(
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
  }
}

/* ── HUD rendering ────────────────────────── */

export function renderHUD(world, hud, stats) {
  if (!hud) return;
  hud.textContent = `TICK:${world.tick}  |  FPS:${stats.fps.toFixed(0)}  |  AGENTS:${world.agents.length}`;

  // Telemetry (controls panel)
  if (stats.stAgents) stats.stAgents.textContent = world.agents.length;
  if (stats.stFactions) stats.stFactions.textContent = world.factions.size;
  if (stats.stCrops) stats.stCrops.textContent = world.crops.size;
  if (stats.stFarms) stats.stFarms.textContent = world.farms.size;
  if (stats.stWalls) stats.stWalls.textContent = world.walls.size;
  if (stats.stFlags) stats.stFlags.textContent = world.flags.size;

  // Stats bar (always visible)
  if (stats.barAgents)
    stats.barAgents.textContent = String(world.agents.length).padStart(2, "0");
  if (stats.barFactions)
    stats.barFactions.textContent = String(world.factions.size).padStart(2, "0");
  if (stats.barCrops)
    stats.barCrops.textContent = String(world.crops.size).padStart(2, "0");
}

/* ── Factions list ────────────────────────── */

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
      const members = [...f.members]
        .map((id) => world.agentsById.get(id))
        .filter(Boolean);
      const avgLvl = (
        members.reduce((s, a) => s + a.level, 0) / (members.length || 1)
      ).toFixed(1);
      const flag = world.flags.get(fid);
      const div = document.createElement("div");
      div.className = "faction-item";
      div.innerHTML = `
        <div class="faction-color" style="background:${color}"></div>
        <span class="faction-name">${fid.slice(0, 8)}</span>
        <span class="faction-detail">${members.length} members &middot; Lv ${avgLvl}</span>
      `;
      factionsList.appendChild(div);
    }
    world._lastFactionsDomAt = now;
    world._lastFactionsSig = sig;
  }
}

/* ── Inspector (agent detail card) ────────── */

export function updateInspector(world, el) {
  if (!el) return;
  const badge = qs("#inspectorBadge");
  if (!world.selectedId) {
    el.innerHTML = '<div class="muted">Click an agent on the canvas.</div>';
    if (badge) badge.style.display = "none";
    return;
  }
  const a = world.agentsById.get(world.selectedId);
  if (!a) {
    el.innerHTML = '<div class="muted">(agent gone)</div>';
    if (badge) badge.style.display = "none";
    return;
  }
  if (badge) badge.style.display = "";

  const actionType = a.action?.type;
  const emoji =
    AGENT_EMOJIS[actionType] || (a.path ? AGENT_EMOJIS.move : AGENT_EMOJIS.idle);
  const factionColor = a.factionId
    ? world.factions.get(a.factionId)?.color || "#888"
    : null;
  const hpPct = Math.round((a.health / a.maxHealth) * 100);

  el.innerHTML = `
    <div class="agent-card">
      <div class="agent-avatar">${emoji}</div>
      <div class="agent-info">
        <div class="agent-name-row">
          <span class="agent-name">${a.name}</span>
          <span class="agent-level">LV. ${String(a.level).padStart(2, "0")}</span>
        </div>
        <div class="agent-badges">
          ${
            a.factionId
              ? `<span class="badge-faction" style="background:${factionColor}22;color:${factionColor};border-color:${factionColor}55">${a.factionId.slice(0, 8).toUpperCase()}</span>`
              : ""
          }
          ${
            actionType
              ? `<span class="badge-action">${actionType.toUpperCase()}</span>`
              : ""
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
    </div>`;
}

/* ── Notification ─────────────────────────── */

let notifTimer = null;
export function showNotification(agent) {
  const el = document.getElementById("eventNotification");
  const body = document.getElementById("notificationBody");
  if (!el || !body || !agent) return;
  const action = agent.action ? agent.action.type : null;
  const desc = action
    ? `Unit ${agent.name} is currently ${action === "attack" ? "attacking" : action + "ing"}.`
    : `Unit ${agent.name} is currently idle.`;
  body.textContent = desc;
  el.classList.remove("hidden");
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.add("hidden"), 5000);
}
