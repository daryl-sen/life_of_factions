(() => {
  // ====== Grid & Viewport ======
  const CELL = 16;
  const GRID = 62;
  const WORLD_PX = GRID * CELL;
  const CANVAS_PX = 1000;
  const OFFSET = Math.floor((CANVAS_PX - WORLD_PX) / 2);

  // ====== Tunables / Balance ======
  const TUNE = {
    moveEnergy: 0.1,
    actionCost: {
      talk: 0.4,
      quarrel: 0.8,
      attack: 2.2,
      heal: 3.0,
      help: 1.6,
      attack_wall: 1.5,
      attack_flag: 2.0,
      reproduce: 1.2,
    },
    cropGain: 28,

    starvationSeconds: 18,
    healAuraRadius: 4,
    healAuraPerTick: 0.6,
    baseDamage: 8,
    wallHp: [10, 15],
    flagHp: [12, 18],
    farmBoostRadius: 3,
    factionThreshold: 0.5,
    factionMinSize: 2,
    buildWallChance: 0.0002,
    buildFarmChance: 0.01, // NEW: chance to attempt farm build per tick (if energy high)
    farmEnergyCost: 12, // NEW: cost to build farm
    energyLowThreshold: 40,
    lowEnergyExploreRange: 14,

    foodPlanThreshold: 10,
    levelCap: 10,
    maxCrops: 100,

    reproduction: {
      relationshipThreshold: 0.1,
      relationshipEnergy: 85,
    },
  };

  // Shorter attacks; others unchanged
  const ACTION_DURATIONS = {
    talk: [900, 1800],
    quarrel: [900, 1800],
    attack: [450, 900],
    heal: [900, 1800],
    help: [900, 1800],
    attack_wall: [1000, 2000],
    attack_flag: [1000, 2000],
    reproduce: [2000, 3200],
  };
  const ACTION_BASE_ADDED = 0;
  const BASE_TICK_MS = 40;

  const COLORS = {
    agentFill: "#e6e9ff",
    crop: "#3adf7e",
    farm: "#edd65a",
    wall: "#9aa2d6",
    wallDam: "#ff7b8b",
    flagPole: "#c7c7d2",
    hp: "#60e6a8",
    energy: "#7bdcff",
    grid: "#1a1e3f",
  };
  const FACTION_COLORS = [
    "#ff5252",
    "#42a5f5",
    "#66bb6a",
    "#ffa726",
    "#ab47bc",
    "#26c6da",
    "#ec407a",
    "#8d6e63",
  ];

  // ====== Logging Categories ======
  const LOG_CATS = [
    "talk",
    "quarrel",
    "attack",
    "heal",
    "help",
    "attack_wall",
    "attack_flag",
    "reproduce",
    "harvest",
    "share",
    "build",
    "destroy",
    "death",
    "faction",
    "level",
    "spawn",
    "info",
  ];

  // ====== Utilities ======
  const rnd = (a, b) => Math.random() * (b - a) + a;
  const rndi = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const key = (x, y) => `${x},${y}`;
  const fromKey = (k) => {
    const [x, y] = k.split(",").map(Number);
    return { x, y };
  };
  const name6 = () =>
    Array.from({ length: 6 }, () =>
      Math.random() < 0.5
        ? String.fromCharCode(65 + rndi(0, 25))
        : String(rndi(0, 9))
    ).join("");
  const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

  class RingLog {
    constructor(limit = 100) {
      this.limit = limit;
      this.arr = [];
    }
    push(item) {
      this.arr.push(item);
      if (this.arr.length > this.limit) this.arr.shift();
    }
    list(activeSet) {
      if (!activeSet || activeSet.size === 0) return [];
      return this.arr.filter((x) => activeSet.has(x.cat));
    }
  }

  class World {
    constructor() {
      this.walls = new Map();
      this.crops = new Map();
      this.farms = new Map();
      this.flags = new Map();
      this.agents = [];
      this.agentsById = new Map();
      this.agentsByCell = new Map();
      this.factions = new Map();
      this.log = new RingLog(100);
      this.activeLogCats = new Set();
      this.tick = 0;
      this.speedPct = 50;
      this.spawnMult = 1.0;
      this.running = false;
      this.selectedId = null;
    }
  }

  // ====== A* ======
  function astar(start, goal, isBlocked) {
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = new Map();
    const came = new Map();
    const g = new Map();
    const f = new Map();
    const sk = (x, y) => key(x, y);
    const neighbors = (x, y) =>
      [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].filter(
        ([nx, ny]) =>
          nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && !isBlocked(nx, ny)
      );
    const sK = sk(start.x, start.y);
    g.set(sK, 0);
    f.set(sK, h(start.x, start.y));
    open.set(sK, [start.x, start.y]);
    while (open.size) {
      let currentKey = null,
        current = null,
        best = Infinity;
      for (const [k, xy] of open) {
        const fv = f.get(k) ?? Infinity;
        if (fv < best) {
          best = fv;
          currentKey = k;
          current = xy;
        }
      }
      if (!current) break;
      const [cx, cy] = current;
      if (cx === goal.x && cy === goal.y) {
        const path = [];
        let ck = currentKey;
        while (ck) {
          const { x, y } = fromKey(ck);
          path.push({ x, y });
          ck = came.get(ck);
        }
        return path.reverse();
      }
      open.delete(currentKey);
      for (const [nx, ny] of neighbors(cx, cy)) {
        const nk = sk(nx, ny);
        const tentative = (g.get(currentKey) ?? Infinity) + 1;
        if (tentative < (g.get(nk) ?? Infinity)) {
          came.set(nk, currentKey);
          g.set(nk, tentative);
          f.set(nk, tentative + h(nx, ny));
          if (!open.has(nk)) open.set(nk, [nx, ny]);
        }
      }
    }
    return null;
  }

  // ====== DOM ======
  const $ = (sel) => document.querySelector(sel);
  const canvas = $("#canvas");
  const hud = $("#hud");
  const ctx = canvas.getContext("2d");
  const btnStart = $("#btnStart"),
    btnPause = $("#btnPause"),
    btnResume = $("#btnResume");
  const rngAgents = $("#rngAgents"),
    lblAgents = $("#lblAgents");
  const rngSpeed = $("#rngSpeed"),
    lblSpeed = $("#lblSpeed");
  const rngSpawn = $("#rngSpawn"),
    lblSpawn = $("#lblSpawn");
  const numAgents = $("#numAgents");
  const numSpeed = $("#numSpeed");
  const numSpawn = $("#numSpawn");
  const btnSpawnCrop = $("#btnSpawnCrop");
  const stAgents = $("#stAgents"),
    stFactions = $("#stFactions"),
    stCrops = $("#stCrops"),
    stFarms = $("#stFarms"),
    stWalls = $("#stWalls"),
    stFlags = $("#stFlags");
  const factionsList = $("#factionsList");
  const inspector = $("#inspector");
  const logList = $("#logList");
  const logFilters = $("#logFilters");

  // ====== World instance ======
  const world = new World();
  world.activeLogCats = new Set(LOG_CATS);
  window.world = world; // debug

  // ====== Filters UI ======
  function setupLogFilters() {
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
  setupLogFilters();

  // ====== Seed World ======
  function seedEnvironment() {
    for (let i = 0; i < 4; i++) {
      const x = rndi(5, GRID - 6),
        y = rndi(5, GRID - 6);
      world.farms.set(key(x, y), { id: crypto.randomUUID(), x, y });
    }
    for (let i = 0; i < 40; i++) {
      const x = rndi(0, GRID - 1),
        y = rndi(0, GRID - 1);
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
    const id = crypto.randomUUID();
    const a = {
      id,
      name: name6(),
      cellX: x,
      cellY: y,
      health: 100,
      maxHealth: 100,
      energy: 100,
      attack: TUNE.baseDamage,
      level: 1,
      ageTicks: 0,
      starvingSeconds: 0,
      factionId: null,
      relationships: new Map(),
      path: null,
      pathIdx: 0,
      action: null,
      lockMsRemaining: 0,
    };
    world.agents.push(a);
    world.agentsById.set(id, a);
    world.agentsByCell.set(key(x, y), id);
    return a;
  }
  function randomFreeCell() {
    for (let tries = 0; tries < 5000; tries++) {
      const x = rndi(0, GRID - 1),
        y = rndi(0, GRID - 1);
      const k = key(x, y);
      if (world.agentsByCell.has(k)) continue;
      if (world.walls.has(k)) continue;
      if (world.farms.has(k)) continue;
      if ([...world.flags.values()].some((f) => f.x === x && f.y === y))
        continue;
      return { x, y };
    }
    return { x: 0, y: 0 };
  }
  function spawnAgents(n) {
    for (let i = 0; i < n; i++) {
      const { x, y } = randomFreeCell();
      addAgentAt(x, y);
    }
  }

  function addCrop(x, y) {
    if (world.crops.size >= TUNE.maxCrops) return false; // cap
    const k = key(x, y);
    if (world.crops.has(k) || world.walls.has(k) || world.farms.has(k))
      return false;
    world.crops.set(k, { id: crypto.randomUUID(), x, y });
    world.log.push({
      t: performance.now(),
      cat: "spawn",
      msg: `crop @${x},${y}`,
      actorId: null,
      extra: { x, y },
    });
    return true;
  }
  function logEvt(cat, msg, actorId, extra = {}) {
    world.log.push({ t: performance.now(), cat, msg, actorId, extra });
  }

  // ====== Factions ======
  function recomputeFactions() {
    const ids = world.agents.map((a) => a.id);
    const idx = new Map(ids.map((id, i) => [id, i]));
    const parent = ids.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a, b) => {
      a = find(a);
      b = find(b);
      if (a !== b) parent[b] = a;
    };
    for (const a of world.agents) {
      for (const [bid, val] of a.relationships) {
        if (val >= TUNE.factionThreshold && world.agentsById.has(bid))
          union(idx.get(a.id), idx.get(bid));
      }
    }
    const groups = new Map();
    ids.forEach((id, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(id);
    });
    const newFactions = new Map();
    let colorIdx = 0;
    for (const [, members] of groups) {
      if (members.length >= TUNE.factionMinSize) {
        const fid =
          members.slice().sort().join("|").slice(0, 8) + "-" + members.length;
        const color = FACTION_COLORS[colorIdx++ % FACTION_COLORS.length];
        newFactions.set(fid, {
          id: fid,
          members: new Set(members),
          color,
        });
      }
    }
    const prevFlags = new Set(world.flags.keys());

    for (const a of world.agents) {
      let newFid = null;
      for (const [fid, f] of newFactions) {
        if (f.members.has(a.id)) {
          newFid = fid;
          break;
        }
      }
      if (a.factionId !== newFid) {
        const old = a.factionId;
        a.factionId = newFid;
        logEvt(
          "faction",
          `${a.name} now ${newFid ? "in faction " + newFid : "factionless"}`,
          a.id,
          { from: old, to: newFid }
        );
      }
    }

    const nextFlags = new Map();
    for (const [fid, f] of newFactions) {
      if (world.flags.has(fid)) {
        nextFlags.set(fid, world.flags.get(fid));
        continue;
      }
      const cells = [...f.members]
        .map((id) => world.agentsById.get(id))
        .map((a) => ({ x: a.cellX, y: a.cellY }));
      const cx = Math.round(cells.reduce((s, c) => s + c.x, 0) / cells.length);
      const cy = Math.round(cells.reduce((s, c) => s + c.y, 0) / cells.length);
      let spot = { x: cx, y: cy };
      if (
        world.agentsByCell.has(key(cx, cy)) ||
        world.walls.has(key(cx, cy)) ||
        world.farms.has(key(cx, cy))
      )
        spot = randomFreeCell();
      nextFlags.set(fid, {
        id: crypto.randomUUID(),
        factionId: fid,
        x: spot.x,
        y: spot.y,
        hp: rndi(TUNE.flagHp[0], TUNE.flagHp[1]),
        maxHp: TUNE.flagHp[1],
      });
      logEvt(
        "faction",
        `Faction ${fid} formed flag @${spot.x},${spot.y}`,
        null,
        { factionId: fid }
      );
    }
    world.flags = nextFlags;

    for (const fid of prevFlags) {
      if (!world.flags.has(fid))
        logEvt("destroy", `Flag ${fid} removed`, null, {
          factionId: fid,
        });
    }

    world.factions = new Map();
    for (const [fid, f] of newFactions) {
      world.factions.set(fid, {
        id: fid,
        members: f.members,
        color: f.color,
      });
    }
  }

  // ====== Helpers ======
  function isBlocked(x, y, ignoreId = null) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
    const k = key(x, y);
    if (world.walls.has(k)) return true;
    if (world.farms.has(k)) return true;
    if ([...world.flags.values()].some((f) => f.x === x && f.y === y))
      return true;
    const occ = world.agentsByCell.get(k);
    if (occ && occ !== ignoreId) return true;
    return false;
  }

  function findNearest(a, coll) {
    let best = null,
      bestD = 1e9;
    for (const it of coll) {
      const d = Math.abs(a.cellX - it.x) + Math.abs(a.cellY - it.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best ? { target: best, dist: bestD } : null;
  }

  function planPathTo(a, gx, gy) {
    const path = astar({ x: a.cellX, y: a.cellY }, { x: gx, y: gy }, (x, y) =>
      isBlocked(x, y, a.id)
    );
    a.path = path;
    a.pathIdx = 0;
  }

  function tryStartAction(a, type, payload) {
    if (a.action) return false;
    const [mn, mx] = ACTION_DURATIONS[type];
    a.action = {
      type,
      remainingMs: rndi(mn, mx) + ACTION_BASE_ADDED,
      tickCounterMs: 0,
      payload,
    };
    return true;
  }

  const getRel = (a, bId) => a.relationships.get(bId) ?? 0;
  const setRel = (a, bId, val) => a.relationships.set(bId, clamp(val, -1, 1));

  // ====== Locking (freeze movement for non-attack interactions) ======
  function lockAgent(id, ms) {
    const ag = world.agentsById.get(id);
    if (!ag) return;
    ag.lockMsRemaining = Math.max(ag.lockMsRemaining || 0, ms);
  }

  // ====== Harvest ======
  function harvestAt(a, x, y) {
    const k = key(x, y);
    const crop = world.crops.get(k);
    if (!crop) return false;
    world.crops.delete(k);
    a.energy += TUNE.cropGain;
    logEvt("harvest", `${a.name} harvested`, a.id, { x, y });
    if (a.factionId) {
      const adj = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of adj) {
        const id = world.agentsByCell.get(key(nx, ny));
        if (!id) continue;
        const b = world.agentsById.get(id);
        if (b.factionId === a.factionId) {
          const s = TUNE.cropGain * 0.35;
          b.energy += s;
          logEvt(
            "share",
            `${a.name} shared ${s.toFixed(1)} with ${b.name}`,
            a.id,
            { to: b.id }
          );
        }
      }
    }
    return true;
  }

  // ====== Interaction ======
  function considerInteract(a) {
    if (a.energy < TUNE.energyLowThreshold) return;

    // 1) Reproduction (adjacent only) — lock both so they don't drift apart
    for (const [nx, ny] of [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1],
    ]) {
      const id = world.agentsByCell.get(key(nx, ny));
      if (!id) continue;
      const b = world.agentsById.get(id);
      const rel = getRel(a, b.id);
      if (
        rel >= TUNE.reproduction.relationshipThreshold &&
        a.energy >= TUNE.reproduction.relationshipEnergy &&
        b.energy >= TUNE.reproduction.relationshipEnergy
      ) {
        if (tryStartAction(a, "reproduce", { targetId: b.id })) {
          const dur = a.action.remainingMs;
          const reserve = 4;
          a.energy -= reserve;
          b.energy -= reserve;
          lockAgent(a.id, dur);
          lockAgent(b.id, dur); // freeze both (non-attack)
          return;
        }
      }
    }

    // 2) Social (adjacent only) — lock both participants
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1],
    ];
    for (const [nx, ny] of adj) {
      const id = world.agentsByCell.get(key(nx, ny));
      if (!id) continue;
      const b = world.agentsById.get(id);
      const rel = getRel(a, b.id);
      const otherFaction =
        (a.factionId && b.factionId && a.factionId !== b.factionId) ||
        (!a.factionId && b.factionId) ||
        (a.factionId && !b.factionId);
      const hostileBias = otherFaction || rel < 0 ? 0.5 : 0.2;
      const r = Math.random();
      if (r >= hostileBias) {
        if (
          Math.random() < 0.65 &&
          tryStartAction(a, "talk", { targetId: b.id })
        ) {
          lockAgent(a.id, a.action.remainingMs);
          lockAgent(b.id, a.action.remainingMs);
          return;
        }
        if (
          Math.random() < 0.25 &&
          tryStartAction(a, "heal", { targetId: b.id })
        ) {
          lockAgent(a.id, a.action.remainingMs);
          lockAgent(b.id, a.action.remainingMs);
          return;
        }
        if (
          Math.random() < 0.25 &&
          tryStartAction(a, "help", { targetId: b.id })
        ) {
          lockAgent(a.id, a.action.remainingMs);
          lockAgent(b.id, a.action.remainingMs);
          return;
        }
      }
    }

    // 3) Combat (range <= 2) — do NOT lock the target
    const candidates = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d === 0 || d > 2) continue;
        const id = world.agentsByCell.get(key(a.cellX + dx, a.cellY + dy));
        if (!id) continue;
        const b = world.agentsById.get(id);
        candidates.push(b);
      }
    }
    if (candidates.length) {
      // pick someone slightly biased toward enemies/low-rel
      candidates.sort(
        (b1, b2) =>
          getRel(a, b1.id) -
          (a.factionId && b1.factionId && a.factionId !== b1.factionId
            ? -0.2
            : 0) -
          (getRel(a, b2.id) -
            (a.factionId && b2.factionId && a.factionId !== b2.factionId
              ? -0.2
              : 0))
      );
      const target = candidates[0];
      if (tryStartAction(a, "attack", { targetId: target.id })) {
        // actor will naturally not move while acting; target stays free to move (no lock)
        return;
      }
    }
  }

  function processAction(a, dtMs) {
    if (!a.action) return;
    const act = a.action;

    // Hungry override: cancel all except reproduction
    if (a.energy < TUNE.energyLowThreshold && act.type !== "reproduce") {
      a.action = null;
      return;
    }

    act.remainingMs -= dtMs;
    act.tickCounterMs += dtMs;
    const costPerMs = (TUNE.actionCost[act.type] || 1) / 1000;
    a.energy -= costPerMs * dtMs;

    // Distance rules: non-attack requires 1; attack allows <=2
    const targ = act.payload?.targetId
      ? world.agentsById.get(act.payload.targetId)
      : null;
    if (targ) {
      const dist = manhattan(a.cellX, a.cellY, targ.cellX, targ.cellY);
      if (act.type === "attack") {
        if (dist > 2) {
          a.action = null;
          return;
        }
      } else {
        if (dist !== 1) {
          a.action = null;
          return;
        }
      }
    }

    // Tick effects (faster cadence to match shorter attack)
    if (act.tickCounterMs >= 500) {
      act.tickCounterMs = 0;

      if (act.type === "attack" && targ) {
        targ.health -= a.attack * 0.4;
        logEvt("attack", `${a.name} hit ${targ.name}`, a.id, {
          to: targ.id,
        });
      } else if (act.type === "heal" && targ) {
        targ.health = Math.min(targ.maxHealth, targ.health + 2.0);
        logEvt("heal", `${a.name} healed ${targ.name}`, a.id, {
          to: targ.id,
        });
      } else if (act.type === "help" && targ) {
        const transfer = Math.min(6, Math.max(0, a.energy - 1));
        if (transfer > 0) {
          a.energy -= transfer;
          targ.energy += transfer;
          logEvt(
            "help",
            `${a.name} gave ${transfer.toFixed(1)} energy to ${targ.name}`,
            a.id,
            { to: targ.id, transfer }
          );
        }
        if (targ.action) {
          targ.action.remainingMs *= 0.9;
        }
      } else if (act.type === "quarrel" && targ) {
        const delta =
          (Math.random() < 0.5 ? -0.1 : 0.1) *
          (a.factionId === targ.factionId ? 0.6 : 1);
        setRel(a, targ.id, getRel(a, targ.id) + delta);
        setRel(targ, a.id, getRel(targ, a.id) + delta);
        logEvt(
          "quarrel",
          `${a.name} ${delta > 0 ? "made peace with" : "argued with"} ${
            targ.name
          }`,
          a.id,
          { to: targ.id, delta }
        );
      } else if (act.type === "talk" && targ) {
        const delta =
          (Math.random() < 0.75 ? +0.14 : -0.06) *
          (a.factionId === targ.factionId ? 1.1 : 0.8);
        setRel(a, targ.id, getRel(a, targ.id) + delta);
        setRel(targ, a.id, getRel(targ, a.id) + delta);
        logEvt("talk", `${a.name} talked with ${targ.name}`, a.id, {
          to: targ.id,
          delta,
        });
      }
    }

    if (act.remainingMs <= 0) {
      const targ2 = act.payload?.targetId
        ? world.agentsById.get(act.payload.targetId)
        : null;
      if (act.type === "reproduce" && targ2) {
        if (manhattan(a.cellX, a.cellY, targ2.cellX, targ2.cellY) === 1) {
          const spots = [
            [a.cellX + 1, a.cellY],
            [a.cellX - 1, a.cellY],
            [a.cellX, a.cellY + 1],
            [a.cellX, a.cellY - 1],
          ];
          const free = spots.find(([x, y]) => !isBlocked(x, y));
          if (free) {
            a.energy -= 12;
            targ2.energy -= 12;
            const [x, y] = free;
            const child = addAgentAt(x, y);
            child.energy = 60;
            child.health = 80;
            logEvt(
              "reproduce",
              `${a.name} & ${targ2.name} had ${child.name}`,
              a.id,
              { child: child.id }
            );
          }
        }
      }
      a.action = null;
    }
  }

  // ====== Building ======
  function tryBuildWall(a) {
    if (Math.random() < TUNE.buildWallChance) {
      const adj = [
        [a.cellX + 1, a.cellY],
        [a.cellX - 1, a.cellY],
        [a.cellX, a.cellY + 1],
        [a.cellX, a.cellY - 1],
      ];
      const free = adj.filter(([x, y]) => !isBlocked(x, y));
      if (free.length) {
        const [x, y] = free[rndi(0, free.length - 1)];
        const k = key(x, y);
        world.walls.set(k, {
          id: crypto.randomUUID(),
          x,
          y,
          hp: rndi(TUNE.wallHp[0], TUNE.wallHp[1]),
          maxHp: TUNE.wallHp[1],
        });
        logEvt("build", `${a.name} built wall`, a.id, { x, y });
      }
    }
  }

  function tryBuildFarm(a) {
    if (a.energy < TUNE.farmEnergyCost) return;
    if (Math.random() < TUNE.buildFarmChance) {
      const adj = [
        [a.cellX + 1, a.cellY],
        [a.cellX - 1, a.cellY],
        [a.cellX, a.cellY + 1],
        [a.cellX, a.cellY - 1],
      ];
      const free = adj.filter(
        ([x, y]) => !isBlocked(x, y) && !world.farms.has(key(x, y))
      );
      if (free.length) {
        const [x, y] = free[rndi(0, free.length - 1)];
        world.farms.set(key(x, y), { id: crypto.randomUUID(), x, y });
        a.energy -= TUNE.farmEnergyCost;
        logEvt("build", `${a.name} built farm`, a.id, { x, y });
      }
    }
  }

  function applyFlagHealing() {
    for (const a of world.agents) {
      if (!a.factionId) continue;
      const flag = world.flags.get(a.factionId);
      if (!flag) continue;
      const d = Math.abs(a.cellX - flag.x) + Math.abs(a.cellY - flag.y);
      if (d <= TUNE.healAuraRadius) {
        a.health = Math.min(a.maxHealth, a.health + TUNE.healAuraPerTick);
      }
    }
  }

  function cleanDead() {
    world.agents = world.agents.filter((a) => {
      if (a.health <= 0) {
        world.agentsByCell.delete(key(a.cellX, a.cellY));
        world.agentsById.delete(a.id);
        logEvt("death", `${a.name} died`, a.id, {});
        return false;
      }
      return true;
    });
    for (const [fid, f] of [...world.flags]) {
      if (f.hp <= 0 || !world.agents.some((a) => a.factionId === fid)) {
        world.flags.delete(fid);
        logEvt("destroy", `Flag ${fid} destroyed`, null, {
          factionId: fid,
        });
      }
    }
    for (const [k, w] of [...world.walls]) {
      if (w.hp <= 0) {
        world.walls.delete(k);
        logEvt("destroy", `Wall @${w.x},${w.y} destroyed`, null, {});
      }
    }
  }

  // ====== Crop Spawn (with cap) ======
  function maybeSpawnCrops() {
    if (world.crops.size >= TUNE.maxCrops) return;
    const attempts = GRID;
    const base = 0.006 * world.spawnMult;
    for (let i = 0; i < attempts; i++) {
      if (world.crops.size >= TUNE.maxCrops) break;
      const x = rndi(0, GRID - 1),
        y = rndi(0, GRID - 1);
      const k = key(x, y);
      if (
        world.crops.has(k) ||
        world.walls.has(k) ||
        world.farms.has(k) ||
        world.agentsByCell.has(k)
      )
        continue;
      let prob = base;
      for (const fm of world.farms.values()) {
        const d = Math.abs(x - fm.x) + Math.abs(y - fm.y);
        if (d <= TUNE.farmBoostRadius) {
          prob *= 1 + (TUNE.farmBoostRadius - d + 1) * 0.6;
        }
      }
      if (Math.random() < prob) {
        world.crops.set(k, { id: crypto.randomUUID(), x, y });
      }
    }
  }

  function levelCheck(a) {
    if (a.level >= TUNE.levelCap) return;
    if (a.energy > 220) {
      a.level++;
      if (a.level > TUNE.levelCap) a.level = TUNE.levelCap;
      if (a.level <= TUNE.levelCap) {
        a.maxHealth += 8;
        a.attack += 1.5;
        a.energy = 140;
        logEvt("level", `${a.name} leveled to ${a.level}`, a.id, {});
      }
    }
  }

  // ====== Main Loop (Move first, then plan; respect locks) ======
  let lastTs = 0,
    acc = 0,
    fps = 0,
    fpsAcc = 0,
    fpsCount = 0;

  function updateTick() {
    world.tick++;
    maybeSpawnCrops();

    // Precompute who is under attack this tick
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
      a.health -= 0.01;
      a.lockMsRemaining = Math.max(0, (a.lockMsRemaining || 0) - BASE_TICK_MS);

      // Hunger: cancel actions (except repro) and plan food when needed
      if (a.energy < TUNE.energyLowThreshold) {
        if (a.action && a.action.type !== "reproduce") a.action = null;
        if (!a.path || a.pathIdx >= a.path.length) {
          seekFoodWhenHungry(a);
        }
      }

      if (a.action) {
        processAction(a, BASE_TICK_MS);
      } else {
        // If locked (because someone is interacting with us), we *do not* move—unless we are being attacked.
        const locked = a.lockMsRemaining > 0 && !underAttack.has(a.id);

        if (!locked) {
          // ----- MOVE STEP FIRST -----
          if (a.path && a.pathIdx < a.path.length) {
            const step = a.path[a.pathIdx];
            if (!isBlocked(step.x, step.y, a.id)) {
              world.agentsByCell.delete(key(a.cellX, a.cellY));
              a.cellX = step.x;
              a.cellY = step.y;
              world.agentsByCell.set(key(a.cellX, a.cellY), a.id);
              a.pathIdx++;
              a.energy -= TUNE.moveEnergy;
              if (world.crops.has(key(a.cellX, a.cellY)))
                harvestAt(a, a.cellX, a.cellY);
            } else {
              a.path = null;
            }
          } else {
            a.path = null;
          }

          // ----- THEN PLAN IF NO PATH -----
          if (!a.path) {
            // Seek food only if below threshold; otherwise wander to create interactions
            if (a.energy < TUNE.foodPlanThreshold) {
              if (world.crops.has(key(a.cellX, a.cellY))) {
                harvestAt(a, a.cellX, a.cellY);
              } else {
                const adjTargets = [
                  [a.cellX + 1, a.cellY],
                  [a.cellX - 1, a.cellY],
                  [a.cellX, a.cellY + 1],
                  [a.cellX, a.cellY - 1],
                ];
                const t = adjTargets.find(
                  ([nx, ny]) =>
                    world.crops.has(key(nx, ny)) && !isBlocked(nx, ny, a.id)
                );
                if (t) {
                  planPathTo(a, t[0], t[1]);
                } else {
                  const near = findNearest(a, world.crops.values());
                  if (near) planPathTo(a, near.target.x, near.target.y);
                }
              }
            }
            if (!a.path) {
              const range = 6;
              const rx = clamp(a.cellX + rndi(-range, range), 0, GRID - 1);
              const ry = clamp(a.cellY + rndi(-range, range), 0, GRID - 1);
              if (!isBlocked(rx, ry, a.id)) planPathTo(a, rx, ry);
            }
          }

          // Interactions/building
          if (Math.random() < 0.1) considerInteract(a);
          if (Math.random() < 0.02) tryBuildWall(a);
          if (a.energy >= 120 && Math.random() < 0.01) tryBuildFarm(a); // prefers well-fed builders
        }
      }

      // Starvation & leveling
      if (a.energy <= 0) {
        a.starvingSeconds += BASE_TICK_MS / 1000;
        if (a.starvingSeconds > TUNE.starvationSeconds) {
          a.health = 0;
        }
      } else {
        a.starvingSeconds = 0;
      }
      levelCheck(a);
    }

    if (world.tick % 25 === 0) recomputeFactions();
    applyFlagHealing();
    cleanDead();
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
    render();
    requestAnimationFrame(loop);
  }

  // ====== Hunger targeting ======
  function seekFoodWhenHungry(a) {
    if (world.crops.has(key(a.cellX, a.cellY))) {
      harvestAt(a, a.cellX, a.cellY);
      return;
    }
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1],
    ];
    for (const [nx, ny] of adj) {
      if (world.crops.has(key(nx, ny))) {
        planPathTo(a, nx, ny);
        return;
      }
    }
    const near = findNearest(a, world.crops.values());
    if (near) {
      planPathTo(a, near.target.x, near.target.y);
      return;
    }
    if (world.farms.size) {
      let bestFarm = null,
        bestD = 1e9;
      for (const fm of world.farms.values()) {
        const d = Math.abs(a.cellX - fm.x) + Math.abs(a.cellY - fm.y);
        if (d < bestD) {
          bestD = d;
          bestFarm = fm;
        }
      }
      if (bestFarm && !isBlocked(bestFarm.x, bestFarm.y, a.id)) {
        planPathTo(a, bestFarm.x, bestFarm.y);
        return;
      }
    }
    for (let tries = 0; tries < 5; tries++) {
      const r = TUNE.lowEnergyExploreRange;
      const rx = clamp(a.cellX + rndi(-r, r), 0, GRID - 1);
      const ry = clamp(a.cellY + rndi(-r, r), 0, GRID - 1);
      if (!isBlocked(rx, ry, a.id)) {
        planPathTo(a, rx, ry);
        return;
      }
    }
  }

  // ====== Rendering ======
  function drawAgentCircle(x, y, radius, stroke) {
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + CELL / 2, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  function drawTriangle(x, y) {
    const cx = x + CELL / 2,
      cy = y + CELL / 2;
    const r = CELL / 2 - 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx - r * 0.866, cy + r * 0.5);
    ctx.lineTo(cx + r * 0.866, cy + r * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(OFFSET, OFFSET);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= GRID; i++) {
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(WORLD_PX, i * CELL + 0.5);
    }
    for (let i = 0; i <= GRID; i++) {
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, WORLD_PX);
    }
    ctx.stroke();

    // crops (triangles)
    ctx.fillStyle = COLORS.crop;
    for (const c of world.crops.values()) {
      drawTriangle(c.x * CELL, c.y * CELL);
    }

    // farms (squares)
    for (const f of world.farms.values()) {
      ctx.fillStyle = COLORS.farm;
      ctx.fillRect(f.x * CELL + 2, f.y * CELL + 2, CELL - 4, CELL - 4);
    }

    // walls
    for (const w of world.walls.values()) {
      const dmg = 1 - w.hp / w.maxHp;
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(w.x * CELL + 1, w.y * CELL + 1, CELL - 2, CELL - 2);
      if (dmg > 0) {
        ctx.fillStyle = COLORS.wallDam;
        ctx.globalAlpha = Math.min(0.7, Math.max(0, dmg));
        ctx.fillRect(w.x * CELL + 1, w.y * CELL + 1, CELL - 2, CELL - 2);
        ctx.globalAlpha = 1;
      }
    }

    // flags (faction-colored banner)
    for (const f of world.flags.values()) {
      const faction = world.factions.get(f.factionId);
      const col = faction?.color || "#cccccc";
      ctx.fillStyle = COLORS.flagPole;
      ctx.fillRect(f.x * CELL + 6, f.y * CELL + 2, 3, CELL - 4); // pole
      ctx.fillStyle = col;
      ctx.fillRect(f.x * CELL + 9, f.y * CELL + 4, CELL - 8, 8); // banner
    }

    // agents (circles)
    for (const a of world.agents) {
      const x = a.cellX * CELL,
        y = a.cellY * CELL;
      ctx.fillStyle = COLORS.agentFill;
      const col = a.factionId
        ? world.factions.get(a.factionId)?.color || "#ffffff"
        : "#6b7280";
      drawAgentCircle(x, y, CELL / 2 - 3, col);
      // hp bar
      const hpw = Math.max(
        0,
        Math.floor((CELL - 6) * (a.health / a.maxHealth))
      );
      ctx.fillStyle = COLORS.hp;
      ctx.fillRect(x + 3, y + 1, hpw, 2);
      // low-energy glyph
      if (a.energy < TUNE.energyLowThreshold) {
        ctx.fillStyle = COLORS.energy;
        ctx.fillRect(x + CELL / 2 - 3, y - 5, 6, 3);
      }
    }

    ctx.restore();

    hud.textContent = `tick:${world.tick} | fps:${fps.toFixed(0)} | agents:${
      world.agents.length
    }`;

    stAgents.textContent = world.agents.length;
    stFactions.textContent = world.factions.size;
    stCrops.textContent = world.crops.size;
    stFarms.textContent = world.farms.size;
    stWalls.textContent = world.walls.size;
    stFlags.textContent = world.flags.size;

    factionsList.innerHTML = "";
    for (const [fid, f] of world.factions) {
      const color =
        f.color ||
        FACTION_COLORS[
          [...world.factions.keys()].indexOf(fid) % FACTION_COLORS.length
        ];
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
  }

  // ====== Inspector & Log ======
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX - OFFSET;
    const py = (e.clientY - rect.top) * scaleY - OFFSET;
    const x = Math.floor(px / CELL),
      y = Math.floor(py / CELL);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    const id = world.agentsByCell.get(key(x, y));
    world.selectedId = id || null;
    updateInspector();
  });

  function updateInspector() {
    if (!world.selectedId) {
      inspector.innerHTML =
        '<div class="muted">Click an agent on the canvas.</div>';
      return;
    }
    const a = world.agentsById.get(world.selectedId);
    if (!a) {
      inspector.innerHTML = '<div class="muted">(agent gone)</div>';
      return;
    }
    const relCount = a.relationships.size;
    inspector.innerHTML = `
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
      </div>
    `;
  }

  function renderLog() {
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
  setInterval(() => {
    updateInspector();
    renderLog();
  }, 400);

  // ====== Controls ======
  const $clamp = (v, min, max) =>
    isNaN(v) ? min : Math.max(min, Math.min(max, v));
  rngAgents.addEventListener("input", () => {
    lblAgents.textContent = rngAgents.value;
    numAgents.value = rngAgents.value;
  });
  rngSpeed.addEventListener("input", () => {
    lblSpeed.textContent = rngSpeed.value + "%";
    numSpeed.value = rngSpeed.value;
    world.speedPct = Number(rngSpeed.value);
  });
  rngSpawn.addEventListener("input", () => {
    lblSpawn.textContent = Number(rngSpawn.value).toFixed(1) + "×";
    numSpawn.value = rngSpawn.value;
    world.spawnMult = Number(rngSpawn.value);
  });
  numAgents.addEventListener("input", () => {
    const v = $clamp(Number(numAgents.value), 20, 300);
    numAgents.value = v;
    rngAgents.value = v;
    lblAgents.textContent = v;
  });
  numSpeed.addEventListener("input", () => {
    const v = $clamp(Number(numSpeed.value), 5, 300);
    numSpeed.value = v;
    rngSpeed.value = v;
    lblSpeed.textContent = v + "%";
    world.speedPct = v;
  });
  numSpawn.addEventListener("input", () => {
    let v = Number(numSpawn.value);
    v = $clamp(v, 0.1, 5);
    numSpawn.value = v;
    rngSpawn.value = v;
    lblSpawn.textContent = v.toFixed(1) + "×";
    world.spawnMult = v;
  });

  btnStart.addEventListener("click", () => {
    if (world.running) return;
    world.walls.clear();
    world.crops.clear();
    world.farms.clear();
    world.flags.clear();
    world.agents.length = 0;
    world.agentsById.clear();
    world.agentsByCell.clear();
    world.factions.clear();
    world.log = new RingLog(100);
    world.tick = 0;
    world.selectedId = null;
    world.activeLogCats = new Set(LOG_CATS);
    setupLogFilters();
    world.speedPct = Number(rngSpeed.value);
    world.spawnMult = Number(rngSpawn.value);
    seedEnvironment();
    spawnAgents(Number(rngAgents.value));
    world.running = true;
    btnStart.disabled = true;
    btnPause.disabled = false;
    btnResume.disabled = true;
    logEvt("info", "Simulation started", null, {});
  });
  btnPause.addEventListener("click", () => {
    world.running = false;
    btnPause.disabled = true;
    btnResume.disabled = false;
  });
  btnResume.addEventListener("click", () => {
    world.running = true;
    btnPause.disabled = false;
    btnResume.disabled = true;
  });
  btnSpawnCrop.addEventListener("click", () => {
    const { x, y } = randomFreeCell();
    addCrop(x, y);
  });

  // ====== Start RAF ======
})();
requestAnimationFrame(loop);
