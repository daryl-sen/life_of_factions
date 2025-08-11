// ui.js
import { LOG_CATS } from "./constants.js";

export function qs(sel) {
  return document.querySelector(sel);
}

export function bindDom() {
  const canvas = qs("#canvas"),
    hud = qs("#hud");
  const btnStart = qs("#btnStart"),
    btnPause = qs("#btnPause"),
    btnResume = qs("#btnResume");
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

  return {
    canvas,
    hud,
    buttons: { btnStart, btnPause, btnResume, btnSpawnCrop },
    ranges: { rngAgents, rngSpeed, rngSpawn },
    labels: { lblAgents, lblSpeed, lblSpawn },
    nums: { numAgents, numSpeed, numSpawn },
    statsEls: { stAgents, stFactions, stCrops, stFarms, stWalls, stFlags },
    factionsList,
    inspector,
    logList,
    logFilters,
  };
}

export function setupLogFilters(world, logFilters, renderLog) {
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
      renderLog();
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
  all.addEventListener("click", () => {
    world.activeLogCats = new Set(LOG_CATS);
    LOG_CATS.forEach(
      (cat) => (logFilters.querySelector("#flt_" + cat).checked = true)
    );
    renderLog();
  });
  none.addEventListener("click", () => {
    world.activeLogCats.clear();
    LOG_CATS.forEach(
      (cat) => (logFilters.querySelector("#flt_" + cat).checked = false)
    );
    renderLog();
  });
}

export function renderLog(world, logList) {
  const items = world.log.list(world.activeLogCats);
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
            it.cat === "share" ||
            it.cat === "faction" ||
            it.cat === "level"
          ? "good"
          : "info";
      return `<div class="logItem"><span class="pill ${cls}">${it.cat}</span>${it.msg}</div>`;
    })
    .join("");
}
