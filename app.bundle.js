(() => {
  /* ====== tiny helpers from the original bundle ====== */
  const __defProp = Object.defineProperty;
  const __getOwnPropNames = Object.getOwnPropertyNames;
  const __esm = (fn, res) =>
    function __init() {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res;
    };
  const __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  /* ====== constants.js (mostly unchanged) ====== */
  var CELL,
    GRID,
    WORLD_PX,
    BASE_TICK_MS,
    TUNE,
    ACTION_DURATIONS,
    ACTION_BASE_ADDED,
    COLORS,
    FACTION_COLORS,
    LOG_CATS,
    ENERGY_CAP;
  var init_constants = __esm({
    "constants.js"() {
      CELL = 16;
      GRID = 62;
      WORLD_PX = GRID * CELL;
      BASE_TICK_MS = 40;
      ENERGY_CAP = 200;
      TUNE = {
        moveEnergy: 0.12,
        actionCost: {
          talk: 0.4,
          quarrel: 0.8,
          attack: 2.2,
          heal: 3,
          help: 1.6,
          attack_flag: 2,
          reproduce: 3,
        },
        cropGain: 28,
        starveHpPerSec: 1.0,
        regenHpPerSec: 0.5,
        healAuraRadius: 4,
        healAuraPerTick: 0.6,
        baseDamage: 8,
        flagHp: [12, 18],
        farmBoostRadius: 3,
        farmEnergyCost: 12,
        buildFarmChance: 5e-3,
        factionThreshold: 0.5,
        factionMinSize: 2,
        factionFormRelThreshold: 0.6,
        helpConvertChance: 0.5,
        helpConvertRelThreshold: 0.4,
        energyLowThreshold: 40,
        levelCap: 20,
        maxCrops: 100,
        reproduction: { relationshipThreshold: 0.1, relationshipEnergy: 85 },
        pathBudgetPerTick: 30,
      };
      ACTION_DURATIONS = {
        talk: [900, 1800],
        quarrel: [900, 1800],
        attack: [450, 900],
        heal: [900, 1800],
        help: [900, 1800],
        attack_flag: [1000, 2000],
        reproduce: [2000, 3200],
      };
      ACTION_BASE_ADDED = 0;
      COLORS = {
        agentFill: "#e6e9ff",
        crop: "#3adf7e",
        farm: "#edd65a",
        wall: "#9aa2d6",
        wallDam: "#ff7b8b",
        flagPole: "#c7c7d2",
        hp: "#60e6a8",
        energy: "#7bdcff",
        grid: "#1a1e3f",
        attackLine: "#ff6d7a",
      };
      FACTION_COLORS = [
        "#ff5252",
        "#42a5f5",
        "#66bb6a",
        "#ffa726",
        "#ab47bc",
        "#26c6da",
        "#ec407a",
        "#8d6e63",
      ];
      LOG_CATS = [
        "talk",
        "quarrel",
        "attack",
        "heal",
        "help",
        "reproduce",
        "build",
        "destroy",
        "death",
        "faction",
        "level",
        "spawn",
        "info",
      ];
    },
  });

  /* ====== utils.js ====== */
  var rnd, rndi, clamp, key, fromKey, manhattan, name6, RingLog;
  var init_utils = __esm({
    "utils.js"() {
      rnd = (a, b) => Math.random() * (b - a) + a;
      rndi = (a, b) => Math.floor(rnd(a, b + 1));
      clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
      key = (x, y) => `${x},${y}`;
      fromKey = (k) => {
        const [x, y] = k.split(",").map(Number);
        return { x, y };
      };
      manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
      name6 = () =>
        Array.from({ length: 6 }, () =>
          Math.random() < 0.5
            ? String.fromCharCode(65 + rndi(0, 25))
            : String(rndi(0, 9))
        ).join("");
      RingLog = class {
        constructor(limit = 100) {
          this.limit = limit;
          this.arr = [];
        }
        push(item) {
          this.arr.push(item);
          if (this.arr.length > this.limit) this.arr.shift();
        }
        list(activeSet, agentId = null) {
          if (!activeSet || activeSet.size === 0) return [];
          return this.arr.filter((x) => {
            if (!activeSet.has(x.cat)) return false;
            if (!agentId) return true;
            const to = x.extra?.to ?? null;
            const targetId = x.extra?.targetId ?? null;
            return (
              x.actorId === agentId || to === agentId || targetId === agentId
            );
          });
        }
      };
    },
  });

  /* ====== UI log renderer ====== */
  function renderLog(world, logList) {
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

  /* ====== spatial.js ====== */
  function isBlocked(world, x, y, ignoreId = null) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
    const k = key(x, y);
    if (world.walls.has(k)) return true;
    if (world.farms.has(k)) return true;
    if (world.flagCells.has(k)) return true;
    const occ = world.agentsByCell.get(k);
    if (occ && occ !== ignoreId) return true;
    return false;
  }

  /* ====== harvest.js ====== */
  var log; // defined after
  function harvestAt(world, a, x, y) {
    const k = key(x, y);
    const crop = world.crops.get(k);
    if (!crop) return false;
    world.crops.delete(k);
    a.energy = Math.min(ENERGY_CAP, a.energy + TUNE.cropGain);
    levelCheck(world, a);
    if (a.factionId) {
      const recips = world.agents.filter(
        (m) =>
          m.factionId === a.factionId &&
          m.id !== a.id &&
          manhattan(a.cellX, a.cellY, m.cellX, m.cellY) <= 5
      );
      if (recips.length) {
        const share = TUNE.cropGain * 0.3,
          per = share / recips.length;
        for (const m of recips) m.energy = Math.min(ENERGY_CAP, m.energy + per);
      }
    }
    return true;
  }
  log = (world, cat, msg, actorId = null, extra = {}) => {
    world.log.push({ t: performance.now(), cat, msg, actorId, extra });
  };

  /* ====== A* pathfinding (unchanged) ====== */
  function astar(start, goal, isBlocked2) {
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = new Map(),
      came = new Map(),
      g = new Map(),
      f = new Map();
    const sk = (x, y) => key(x, y);
    const neighbors = (x, y) =>
      [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].filter(
        ([nx, ny]) =>
          nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && !isBlocked2(nx, ny)
      );
    const sK = sk(start.x, start.y);
    g.set(sK, 0);
    f.set(sK, h(start.x, start.y));
    open.set(sK, [start.x, start.y]);
    let expansions = 0;
    const MAX_EXP = 900;
    while (open.size) {
      if (++expansions > MAX_EXP) return null;
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
        const nk = sk(nx, ny),
          tentative = (g.get(currentKey) ?? Infinity) + 1;
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

  /* ====== build farms ====== */
  function tryBuildFarm(world, a) {
    if (a.energy < TUNE.farmEnergyCost) return;
    if (Math.random() >= TUNE.buildFarmChance) return;
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1],
    ];
    const free = adj.filter(
      ([x2, y2]) => !isBlocked(world, x2, y2) && !world.farms.has(key(x2, y2))
    );
    if (!free.length) return;
    const [x, y] = free[rndi(0, free.length - 1)];
    world.farms.set(key(x, y), { id: crypto.randomUUID(), x, y });
    a.energy -= TUNE.farmEnergyCost;
    log(world, "build", `${a.name} built farm`, a.id, { x, y });
  }

  /* ====== actions.js (trimmed to what we need) ====== */
  var actions_exports = {};
  __export(actions_exports, {
    addAgentAt: () => addAgentAt,
    addCrop: () => addCrop,
    considerInteract: () => considerInteract,
    findNearest: () => findNearest,
    getRel: () => getRel,
    lockAgent: () => lockAgent,
    planPathTo: () => planPathTo,
    processAction: () => processAction,
    seekFoodWhenHungry: () => seekFoodWhenHungry,
    setRel: () => setRel,
  });
  function planPathTo(world, a, gx, gy, force = false) {
    if (!force) {
      if (world._pathWhitelist && !world._pathWhitelist.has(a.id)) return;
      if (world.tick < (a.replanAtTick || 0)) return;
      if (world.pathBudget <= 0) return;
      world.pathBudget--;
    }
    a.goal = { x: gx, y: gy };
    const path = astar({ x: a.cellX, y: a.cellY }, { x: gx, y: gy }, (x, y) =>
      isBlocked(world, x, y, a.id)
    );
    a.path = path;
    a.pathIdx = 0;
    a.replanAtTick = world.tick + 6 + rndi(0, 6);
  }
  function findNearest(world, a, coll) {
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
  function lockAgent(world, id, ms) {
    const ag = world.agentsById.get(id);
    if (!ag) return;
    ag.lockMsRemaining = Math.max(ag.lockMsRemaining || 0, ms);
  }
  const FF_INF = 0xffff,
    ffIdx = (x, y) => y * GRID + x;
  function recomputeFoodField(world) {
    const N = GRID * GRID;
    if (!world.foodField || world.foodField.length !== N)
      world.foodField = new Uint16Array(N);
    world.foodField.fill(FF_INF);
    if (world.crops.size === 0) {
      world._foodFieldTick = world.tick;
      return;
    }
    const staticBlocked = (x, y) => {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
      const k = key(x, y);
      if (world.walls.has(k)) return true;
      if (world.farms.has(k)) return true;
      if (world.flagCells.has(k)) return true;
      return false;
    };
    const qx = new Int16Array(N),
      qy = new Int16Array(N);
    let head = 0,
      tail = 0;
    for (const c of world.crops.values()) {
      const i = ffIdx(c.x, c.y);
      world.foodField[i] = 0;
      qx[tail] = c.x;
      qy[tail] = c.y;
      tail++;
    }
    while (head < tail) {
      const x = qx[head],
        y = qy[head];
      head++;
      const d0 = world.foodField[ffIdx(x, y)];
      const nbrs = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of nbrs) {
        if (staticBlocked(nx, ny)) continue;
        const ii = ffIdx(nx, ny);
        if (world.foodField[ii] > d0 + 1) {
          world.foodField[ii] = d0 + 1;
          qx[tail] = nx;
          qy[tail] = ny;
          tail++;
        }
      }
    }
    world._foodFieldTick = world.tick;
  }
  function stepTowardFood(world, a) {
    const here = world.foodField[ffIdx(a.cellX, a.cellY)];
    if (here === FF_INF) return false;
    let best = { d: here, x: a.cellX, y: a.cellY };
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1],
    ];
    for (const [nx, ny] of adj) {
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      if (isBlocked(world, nx, ny, a.id)) continue;
      const d = world.foodField[ffIdx(nx, ny)];
      if (d < best.d) best = { d, x: nx, y: ny };
    }
    if (best.x === a.cellX && best.y === a.cellY) return false;
    a.path = [{ x: best.x, y: best.y }];
    a.pathIdx = 0;
    a.goal = null;
    return true;
  }
  function chooseAttack(world, a, preferEnemies = false) {
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
    if (!candidates.length) return false;
    let pool = candidates;
    let p;
    if (preferEnemies) {
      const enemies = candidates.filter(
        (b) => a.factionId && b.factionId && a.factionId !== b.factionId
      );
      if (enemies.length) {
        pool = enemies;
        p = 1;
      }
    }
    if (p === undefined) {
      const hasEnemyNearby = candidates.some(
        (b) => a.factionId && b.factionId && a.factionId !== b.factionId
      );
      const bestRel = Math.max(
        ...candidates.map((b) => a.relationships.get(b.id) ?? 0)
      );
      const relPenalty = Math.max(0, bestRel) * 0.6;
      p = clamp(a.aggression + (hasEnemyNearby ? 0.25 : 0) - relPenalty, 0, 1);
    }
    if (Math.random() >= p) return false;
    pool.sort((b1, b2) => {
      const f1 =
        a.factionId && b1.factionId && a.factionId !== b1.factionId ? -0.5 : 0;
      const f2 =
        a.factionId && b2.factionId && a.factionId !== b2.factionId ? -0.5 : 0;
      return getRel(a, b1.id) + f1 - (getRel(a, b2.id) + f2);
    });
    const target = pool[0];
    if (getRel(a, target.id) > 0.5 && Math.random() < 0.85) return false;
    if (tryStartAction(a, "attack", { targetId: target.id })) return true;
    return false;
  }
  function chooseHelpHealTalk(world, a) {
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1],
    ];
    const neighbors = [];
    for (const [nx, ny] of adj) {
      const id = world.agentsByCell.get(key(nx, ny));
      if (!id) continue;
      neighbors.push(world.agentsById.get(id));
    }
    if (!neighbors.length) return false;
    const sameFactionNearby = neighbors.some(
      (b) => a.factionId && b.factionId && a.factionId === b.factionId
    );
    const pHelp = clamp(a.cooperation + (sameFactionNearby ? 0.25 : 0), 0, 1);
    if (Math.random() < pHelp) {
      const sorted = neighbors.slice().sort((b1, b2) => {
        const same1 =
          a.factionId && b1.factionId && a.factionId === b1.factionId
            ? -0.3
            : 0;
        const same2 =
          a.factionId && b2.factionId && a.factionId === b2.factionId
            ? -0.3
            : 0;
        const need1 =
          b1.health / b1.maxHealth < b2.health / b2.maxHealth ? -0.2 : 0.2;
        return (
          same1 +
          need1 -
          (same2 +
            (b2.health / b2.maxHealth < b1.health / b1.maxHealth ? -0.2 : 0.2))
        );
      });
      const targ = sorted[0];
      const doHeal = targ.health < targ.maxHealth * 0.85;
      const type = doHeal ? "heal" : "help";
      if (tryStartAction(a, type, { targetId: targ.id })) {
        lockAgent(world, a.id, a.action.remainingMs);
        lockAgent(world, targ.id, a.action.remainingMs);
        return true;
      }
    }
    const targ = neighbors[rndi(0, neighbors.length - 1)];
    const rel = getRel(a, targ.id);
    const pickQuarrel = rel < 0 && Math.random() < 0.5;
    const type = pickQuarrel ? "quarrel" : "talk";
    if (tryStartAction(a, type, { targetId: targ.id })) {
      lockAgent(world, a.id, a.action.remainingMs);
      lockAgent(world, targ.id, a.action.remainingMs);
      return true;
    }
    return false;
  }
  function considerInteract(world, a) {
    if (a.energy < TUNE.energyLowThreshold) {
      chooseAttack(world, a, true);
    }
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
          const dur = a.action.remainingMs,
            reserve = 4;
          a.energy -= reserve;
          b.energy -= reserve;
          lockAgent(world, a.id, dur);
          lockAgent(world, b.id, dur);
          return;
        }
      }
    }
    if (chooseAttack(world, a)) return;
    if (chooseHelpHealTalk(world, a)) return;
  }
  function processAction(world, a, dtMs) {
    if (!a.action) return;
    const act = a.action;
    if (a.energy < TUNE.energyLowThreshold && act.type !== "attack") {
      a.action = null;
      return;
    }
    act.remainingMs -= dtMs;
    act.tickCounterMs += dtMs;
    const costPerMs = (TUNE.actionCost[act.type] || 1) / 1000;
    a.energy -= costPerMs * dtMs;
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
    if (act.tickCounterMs >= 500) {
      act.tickCounterMs = 0;
      if (act.type === "attack" && targ) {
        targ.health -= a.attack * 0.4;
        if (a.factionId === targ.factionId) {
          // dangerous, retaliation
          Math.random() < 0.3
            ? (targ.factionId = null)
            : chooseAttack(world, targ, false);
        }
        setRel(a, targ.id, getRel(a, targ.id) - 0.2);

        log(world, "attack", `${a.name} hit ${targ.name}`, a.id, {
          to: targ.id,
        });
        if (targ.health <= 0 && a.level < TUNE.levelCap) {
          a.level++;
          a.maxHealth += 8;
          a.attack += 1.5;
          log(world, "level", `${a.name} leveled to ${a.level}`, a.id, {});
        }
      } else if (act.type === "heal" && targ) {
        targ.health = Math.min(targ.maxHealth, targ.health + 2);
        log(world, "heal", `${a.name} healed ${targ.name}`, a.id, {
          to: targ.id,
        });
      } else if (act.type === "help" && targ) {
        const high = a.energy > ENERGY_CAP * 0.7;
        const ratio = high ? 0.2 : 0.1;
        const transfer = Math.max(0, a.energy * ratio);
        if (transfer > 0) {
          a.energy = Math.max(0, a.energy - transfer);
          targ.energy = Math.min(ENERGY_CAP, targ.energy + transfer);
          log(
            world,
            "help",
            `${a.name} gave ${transfer.toFixed(1)} energy to ${targ.name}`,
            a.id,
            { to: targ.id, transfer }
          );
        }
      } else if (act.type === "quarrel" && targ) {
        const delta =
          (Math.random() < 0.5 ? -0.1 : 0.1) *
          (a.factionId === targ.factionId ? 0.6 : 1);
        setRel(a, targ.id, getRel(a, targ.id) + delta);
        setRel(targ, a.id, getRel(targ, a.id) + delta);
        log(
          world,
          "quarrel",
          `${a.name} ${delta > 0 ? "made peace with" : "argued with"} ${
            targ.name
          }`,
          a.id,
          { to: targ.id, delta }
        );
      } else if (act.type === "talk" && targ) {
        const delta =
          (Math.random() < 0.75 ? 0.14 : -0.06) *
          (a.factionId === targ.factionId ? 1.1 : 0.8);
        setRel(a, targ.id, getRel(a, targ.id) + delta);
        setRel(targ, a.id, getRel(targ, a.id) + delta);
        log(world, "talk", `${a.name} talked with ${targ.name}`, a.id, {
          to: targ.id,
          delta,
        });
      }
    }
    if (act.remainingMs <= 0) {
      const targ2 = act.payload?.targetId
        ? world.agentsById.get(act.payload.targetId)
        : null;
      if (targ2 && !a.factionId && !targ2.factionId) {
        const rel = getRel(a, targ2.id);
        if (
          (act.type === "talk" || act.type === "help" || act.type === "heal") &&
          rel >= TUNE.factionFormRelThreshold
        ) {
          createFaction(world, [a, targ2]);
        }
      }
      if (act.type === "help" && targ2 && a.factionId) {
        if (
          Math.random() < TUNE.helpConvertChance &&
          getRel(a, targ2.id) >= TUNE.helpConvertRelThreshold &&
          targ2.factionId !== a.factionId
        ) {
          setFaction(world, targ2, a.factionId, "recruitment");
        }
      }
      if (act.type === "reproduce" && targ2) {
        if (manhattan(a.cellX, a.cellY, targ2.cellX, targ2.cellY) === 1) {
          const spots = [
            [a.cellX + 1, a.cellY],
            [a.cellX - 1, a.cellY],
            [a.cellX, a.cellY + 1],
            [a.cellX, a.cellY - 1],
          ];
          const free = spots.find(([x, y]) => !isBlocked(world, x, y));
          if (free) {
            a.energy -= 12;
            targ2.energy -= 12;
            const [x, y] = free;
            const child = addAgentAt(world, x, y);
            child.energy = 60;
            child.health = 80;
            child.aggression = clamp(
              (a.aggression + targ2.aggression) / 2,
              0,
              1
            );
            child.cooperation = clamp(
              (a.cooperation + targ2.cooperation) / 2,
              0,
              1
            );
            child.travelPref =
              Math.random() < 0.5 ? a.travelPref : targ2.travelPref;
            const pa = a.factionId || null,
              pb = targ2.factionId || null;
            let chosen = null;
            if (pa && pb) chosen = Math.random() < 0.5 ? pa : pb;
            else chosen = pa || pb;
            if (chosen) setFaction(world, child, chosen, "birth");
            log(
              world,
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
  function addAgentAt(world, x, y) {
    const id = crypto.randomUUID();
    const rp = Math.random();
    const pref = rp < 1 / 3 ? "near" : rp < 2 / 3 ? "far" : "wander";
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
      factionId: null,
      relationships: new Map(),
      path: null,
      pathIdx: 0,
      action: null,
      lockMsRemaining: 0,
      travelPref: pref,
      aggression: Math.random(),
      cooperation: Math.random(),
      replanAtTick: 0,
      goal: null,
    };
    world.agents.push(a);
    world.agentsById.set(id, a);
    world.agentsByCell.set(key(x, y), id);
    return a;
  }
  function seekFoodWhenHungry(world, a) {
    if (world.crops.has(key(a.cellX, a.cellY))) {
      harvestAt(world, a, a.cellX, a.cellY);
      return;
    }
    if (world.tick - (world._foodFieldTick || 0) >= 5) {
      recomputeFoodField(world);
    }
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1],
    ];
    for (const [nx, ny] of adj) {
      const k = key(nx, ny);
      if (world.crops.has(k) && !world.flagCells.has(k)) {
        a.path = [{ x: nx, y: ny }];
        a.pathIdx = 0;
        a.goal = null;
        return;
      }
    }
    const scarcity = world.crops.size / Math.max(1, world.agents.length);
    if (scarcity < 0.35) {
      if (stepTowardFood(world, a)) return;
    }
    const filtered = [...world.crops.values()].filter(
      (c) => !world.flagCells.has(key(c.x, c.y))
    );
    if (filtered.length) {
      const near = findNearest(world, a, filtered);
      if (near) {
        planPathTo(world, a, near.target.x, near.target.y);
        return;
      }
    }
  }
  function addCrop(world, x, y) {
    if (world.crops.size >= TUNE.maxCrops) return false;
    const k = key(x, y);
    if (
      world.crops.has(k) ||
      world.walls.has(k) ||
      world.farms.has(k) ||
      world.flagCells.has(k)
    )
      return false;
    world.crops.set(k, { id: crypto.randomUUID(), x, y });
    log(world, "spawn", `crop @${x},${y}`, null, { x, y });
    return true;
  }
  var getRel, setRel;
  getRel = (a, bId) => a.relationships.get(bId) ?? 0;
  setRel = (a, bId, val) => {
    val = clamp(val, -1, 1);
    if (Math.abs(val) < 0.02) {
      a.relationships.delete(bId);
      return;
    }
    a.relationships.set(bId, val);
    const MAX_REL = 80;
    if (a.relationships.size > MAX_REL) {
      const prunable = [...a.relationships.entries()].sort(
        ([_1, v1], [_2, v2]) => Math.abs(v1) - Math.abs(v2)
      );
      const toDrop = a.relationships.size - MAX_REL;
      for (let i = 0; i < toDrop; i++) a.relationships.delete(prunable[i][0]);
    }
  };

  /* ====== world.js ====== */
  init_constants();
  init_utils();
  var World = class {
    constructor() {
      this.walls = new Map();
      this.crops = new Map();
      this.farms = new Map();
      this.flags = new Map();
      this.flagCells = new Set();
      this.agents = [];
      this.agentsById = new Map();
      this.agentsByCell = new Map();
      this.factions = new Map();
      this.log = new RingLog(200);
      this.activeLogCats = new Set(LOG_CATS);
      this.activeLogAgentId = null;
      this.tick = 0;
      this.speedPct = 50;
      this.spawnMult = 1;
      this.running = false;
      this.selectedId = null;
      this.pauseOnBlur = true;
      this._lastFactionsDomAt = 0;
      this._lastAgentCount = 0;
      this._rebuildAgentOptions = null;
      this._lastFactionsSig = "";
      this.pathBudgetMax = Number.isFinite(TUNE.pathBudgetPerTick)
        ? TUNE.pathBudgetPerTick
        : 30;
      this.pathBudget = 0;
      this._pathRR = 0;
      this._pathWhitelist = new Set();
      this.foodField = new Uint16Array(GRID * GRID);
      this.foodField.fill(0xffff);
      this._foodFieldTick = -1;
      this.drawGrid = true; // NEW
    }
  };

  /* ====== render.js with CAMERA ====== */
  init_constants();
  init_utils();

  function drawAgentCircle(ctx, x, y, radius, stroke) {
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + CELL / 2, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  function drawFactionPennant(ctx, cx, topY, color) {
    ctx.save();
    ctx.fillStyle = "#c7c7d2";
    ctx.fillRect(cx - 1, topY - 6, 2, 7);
    ctx.fillStyle = color || "#cccccc";
    ctx.beginPath();
    ctx.moveTo(cx + 1, topY - 5);
    ctx.lineTo(cx + 8, topY - 2);
    ctx.lineTo(cx + 1, topY + 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawStar(ctx, cx, cy) {
    const spikes = 5,
      outer = 6,
      inner = 3.2;
    let rot = (Math.PI / 2) * 3;
    let x = cx,
      y = cy;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - outer);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outer;
      y = cy + Math.sin(rot) * outer;
      ctx.lineTo(x, y);
      rot += Math.PI / spikes;
      x = cx + Math.cos(rot) * inner;
      y = cy + Math.sin(rot) * inner;
      ctx.lineTo(x, y);
      rot += Math.PI / spikes;
    }
    ctx.lineTo(cx, cy - outer);
    ctx.closePath();
    ctx.fillStyle = "#ffd166";
    ctx.strokeStyle = "#7a5f1d";
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function drawTriangle(ctx, x, y) {
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
  function drawActionIndicator(ctx, cx, topY, type, factionColor = "#ccc") {
    ctx.save();
    ctx.fillStyle = "#c7c7d2";
    ctx.fillRect(cx - 1, topY - 6, 2, 7);
    let fill = "#cccccc",
      stroke = "#333333";
    switch (type) {
      case "attack":
        fill = "#ff6d7a";
        break;
      case "heal":
        fill = "#60e6a8";
        break;
      case "help":
        fill = "#7bdcff";
        break;
      case "talk":
        fill = "#a5b4fc";
        break;
      case "quarrel":
        fill = "#ffb74d";
        break;
      case "reproduce":
        fill = "#f472b6";
        break;
      case "attack_flag":
        fill = factionColor || "#cccccc";
        break;
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    const x = cx + 2,
      y = topY - 5;
    switch (type) {
      case "attack":
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8, y + 8);
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x, y + 8);
        ctx.strokeStyle = fill;
        ctx.stroke();
        break;
      case "heal":
        ctx.beginPath();
        ctx.fillRect(x + 3, y, 2, 8);
        ctx.fillRect(x, y + 3, 8, 2);
        break;
      case "help":
        ctx.beginPath();
        ctx.moveTo(x + 4, y);
        ctx.lineTo(x + 4, y + 8);
        ctx.moveTo(x + 1, y + 3);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x + 7, y + 3);
        ctx.strokeStyle = fill;
        ctx.stroke();
        break;
      case "talk":
        ctx.beginPath();
        ctx.rect(x, y, 8, 6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 6);
        ctx.lineTo(x + 4, y + 8);
        ctx.lineTo(x + 4, y + 6);
        ctx.closePath();
        ctx.fill();
        break;
      case "quarrel":
        ctx.beginPath();
        ctx.moveTo(x + 2, y);
        ctx.lineTo(x + 6, y + 3);
        ctx.lineTo(x + 4, y + 3);
        ctx.lineTo(x + 7, y + 8);
        ctx.lineTo(x + 1, y + 4);
        ctx.lineTo(x + 3, y + 4);
        ctx.closePath();
        ctx.fill();
        break;
      case "reproduce":
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 7);
        ctx.bezierCurveTo(x + 8, y + 4, x + 7, y + 0.5, x + 5, y + 1.2);
        ctx.bezierCurveTo(x + 4, y + 1.8, x + 4, y + 3, x + 4, y + 3);
        ctx.bezierCurveTo(x + 4, y + 3, x + 4, y + 1.8, x + 3, y + 1.2);
        ctx.bezierCurveTo(x + 1, y + 0.5, x + 0, y + 4, x + 4, y + 7);
        ctx.fill();
        break;
      case "attack_flag":
        drawFactionPennant(ctx, cx, topY, factionColor);
        break;
      default:
        ctx.fillRect(x, y, 8, 8);
    }
    ctx.restore();
  }
  function drawLowEnergyIcon(ctx, cx, topY) {
    const w = 6,
      h = 4;
    const x = Math.round(cx) - 10;
    const y = Math.round(topY) - 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.closePath();
    ctx.fillStyle = "#ff6d7a";
    ctx.fill();
    ctx.restore();
  }

  /** Camera & transforms */
  function makeCamera() {
    return { x: 0, y: 0, scale: 1, min: 0.25, max: 4 };
  }
  function setCanvasSize(canvas) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    return { w, h, dpr };
  }
  function fitScaleForCanvas(canvas) {
    return Math.min(canvas.width / WORLD_PX, canvas.height / WORLD_PX);
  }
  function screenToWorld(camera, sx, sy) {
    return { x: sx / camera.scale + camera.x, y: sy / camera.scale + camera.y };
  }
  function zoomAt(camera, sx, sy, factor) {
    const w = screenToWorld(camera, sx, sy);
    const newScale = clamp(camera.scale * factor, camera.min, camera.max);
    camera.scale = newScale;
    camera.x = w.x - sx / camera.scale;
    camera.y = w.y - sy / camera.scale;
  }
  function panBy(camera, dx, dy) {
    camera.x += dx / camera.scale;
    camera.y += dy / camera.scale;
    // clamp to world bounds with a bit of slack
    const slack = 40;
    camera.x = clamp(
      camera.x,
      -slack,
      WORLD_PX + slack - window.innerWidth / camera.scale
    );
    camera.y = clamp(
      camera.y,
      -slack,
      WORLD_PX + slack - window.innerHeight / camera.scale
    );
  }

  /** Main world renderer using camera.setTransform */
  function render(world, ctx, canvas, hud, stats, factionsList, camera) {
    // clear to background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // world-space
    ctx.setTransform(
      camera.scale,
      0,
      0,
      camera.scale,
      -camera.x * camera.scale,
      -camera.y * camera.scale
    );

    // grid (toggleable)
    if (world.drawGrid) {
      ctx.save();
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1 / camera.scale;
      ctx.beginPath();
      for (let i = 0; i <= GRID; i++) {
        const y = i * CELL + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(GRID * CELL, y);
      }
      for (let i = 0; i <= GRID; i++) {
        const x = i * CELL + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GRID * CELL);
      }
      ctx.stroke();
      ctx.restore();
    }

    // crops
    ctx.fillStyle = COLORS.crop;
    for (const c of world.crops.values())
      drawTriangle(ctx, c.x * CELL, c.y * CELL);

    // farms
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

    // flags
    for (const f of world.flags.values()) {
      const faction = world.factions.get(f.factionId);
      const col = faction?.color || "#cccccc";
      ctx.fillStyle = COLORS.flagPole;
      ctx.fillRect(f.x * CELL + 6, f.y * CELL + 2, 3, CELL - 4);
      ctx.fillStyle = col;
      ctx.fillRect(f.x * CELL + 9, f.y * CELL + 4, CELL - 8, 8);
    }

    // pending attack lines
    const pendingAttackLines = [];

    // agents
    for (const a of world.agents) {
      const x = a.cellX * CELL,
        y = a.cellY * CELL;
      ctx.fillStyle = COLORS.agentFill;
      const col = a.factionId
        ? world.factions.get(a.factionId)?.color || "#fff"
        : "#6b7280";
      drawAgentCircle(ctx, x, y, CELL / 2 - 3, col);
      // hp
      const hpw = Math.max(
        0,
        Math.floor((CELL - 6) * (a.health / a.maxHealth))
      );
      ctx.fillStyle = COLORS.hp;
      ctx.fillRect(x + 3, y + 1, hpw, 2);
      const glyphTop = y - 8;
      const cx = x + CELL / 2;
      if (a.energy < TUNE.energyLowThreshold)
        drawLowEnergyIcon(ctx, cx, glyphTop);
      if (a.action) {
        const fcol = a.factionId
          ? world.factions.get(a.factionId)?.color || "#cccccc"
          : "#cccccc";
        if (a.action.type === "attack" && a.action.payload?.targetId) {
          const t = world.agentsById.get(a.action.payload.targetId);
          if (t) pendingAttackLines.push([a, t]);
        }
        drawActionIndicator(ctx, cx, glyphTop, a.action.type, fcol);
      }
      if (world.selectedId === a.id) drawStar(ctx, x + CELL / 2, y - 16);
    }

    // attack lines on top
    ctx.strokeStyle = COLORS.attackLine;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1 / camera.scale;
    for (const [att, tgt] of pendingAttackLines) {
      ctx.beginPath();
      ctx.moveTo(att.cellX * CELL + CELL / 2, att.cellY * CELL + CELL / 2);
      ctx.lineTo(tgt.cellX * CELL + CELL / 2, tgt.cellY * CELL + CELL / 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // reset for HUD/UI drawing if needed
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ====== UI helpers & lists ====== */
  init_constants();
  function qs(sel) {
    return document.querySelector(sel);
  }
  function bindDom() {
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
    const gridChk = qs("#cbDrawGrid"); // NEW
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
  function setupLogFilters(world, logFilters, renderLog2) {
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
  function renderHUD(world, hud, stats) {
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
  function rebuildFactionsListIfNeeded(world, factionsList) {
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

  /* ====== factions.js (trimmed) ====== */
  init_constants();
  init_utils();
  function _nextFactionColor(world) {
    const used = new Set([...world.factions.values()].map((f) => f.color));
    for (let i = 0; i < FACTION_COLORS.length; i++) {
      const col = FACTION_COLORS[i];
      if (!used.has(col)) return col;
    }
    return FACTION_COLORS[world.factions.size % FACTION_COLORS.length];
  }
  function _placeFlag(world, fid, members) {
    if (world.flags.has(fid)) return;
    const cells = members.map((a) => ({ x: a.cellX, y: a.cellY }));
    const cx = Math.round(cells.reduce((s, c) => s + c.x, 0) / cells.length);
    const cy = Math.round(cells.reduce((s, c) => s + c.y, 0) / cells.length);
    let spot = { x: cx, y: cy };
    if (isBlocked(world, cx, cy)) spot = randomFreeCell(world);
    world.flags.set(fid, {
      id: crypto.randomUUID(),
      factionId: fid,
      x: spot.x,
      y: spot.y,
      hp: rndi(TUNE.flagHp[0], TUNE.flagHp[1]),
      maxHp: TUNE.flagHp[1],
    });
    world.flagCells.add(key(spot.x, spot.y));
    log(
      world,
      "faction",
      `Faction ${fid} placed flag @${spot.x},${spot.y}`,
      null,
      { factionId: fid }
    );
  }
  function createFaction(world, members) {
    const fid = "F" + crypto.randomUUID().slice(0, 8);
    const color = _nextFactionColor(world);
    world.factions.set(fid, { id: fid, members: new Set(), color });
    for (const a of members) {
      if (a.factionId) {
        const old = world.factions.get(a.factionId);
        if (old) old.members.delete(a.id);
      }
      a.factionId = fid;
      world.factions.get(fid).members.add(a.id);
    }
    _placeFlag(world, fid, members);
    const names = members.map((m) => m.name).join(" & ");
    log(world, "faction", `${names} founded faction ${fid}`, null, {
      factionId: fid,
    });
    return fid;
  }
  function _disbandFaction(world, fid, reason = "rule: <=1 member") {
    const f = world.factions.get(fid);
    if (!f) return;
    for (const id of f.members) {
      const a = world.agentsById.get(id);
      if (a) a.factionId = null;
    }
    world.factions.delete(fid);
    const flag = world.flags.get(fid);
    if (flag) {
      world.flagCells.delete(key(flag.x, flag.y));
      world.flags.delete(fid);
      log(world, "destroy", `Flag ${fid} destroyed`, null, { factionId: fid });
    }
    log(world, "faction", `Faction ${fid} disbanded (${reason})`, null, {
      factionId: fid,
    });
  }
  function _destroyFactionIfLonely(world, fid) {
    const f = world.factions.get(fid);
    if (!f) return;
    let aliveCount = 0;
    for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
    if (aliveCount <= 1) _disbandFaction(world, fid, "<=1 alive");
  }
  function setFaction(world, agent, newFid, reason = null) {
    const oldFid = agent.factionId || null;
    if (oldFid === newFid) return;
    if (oldFid) {
      const old = world.factions.get(oldFid);
      if (old) old.members.delete(agent.id);
    }
    agent.factionId = newFid || null;
    if (newFid) {
      if (!world.factions.has(newFid)) {
        world.factions.set(newFid, {
          id: newFid,
          members: new Set(),
          color: _nextFactionColor(world),
        });
        _placeFlag(world, newFid, [agent]);
      }
      world.factions.get(newFid).members.add(agent.id);
    }
    if (oldFid && !newFid) {
      log(
        world,
        "faction",
        `${agent.name} left faction ${oldFid}${reason ? ` (${reason})` : ""}`,
        agent.id,
        { from: oldFid, to: null, reason }
      );
      _destroyFactionIfLonely(world, oldFid);
    } else if (!oldFid && newFid) {
      log(
        world,
        "faction",
        `${agent.name} joined faction ${newFid}${reason ? ` (${reason})` : ""}`,
        agent.id,
        { from: null, to: newFid, reason }
      );
    } else if (oldFid && newFid) {
      log(
        world,
        "faction",
        `${agent.name} moved ${oldFid} → ${newFid}${
          reason ? ` (${reason})` : ""
        }`,
        agent.id,
        { from: oldFid, to: newFid, reason }
      );
      _destroyFactionIfLonely(world, oldFid);
    }
  }
  function reconcileFactions(world) {
    const actual = new Map();
    for (const a of world.agents) {
      if (!a.factionId) continue;
      if (!actual.has(a.factionId)) actual.set(a.factionId, new Set());
      actual.get(a.factionId).add(a.id);
    }
    for (const [fid, set] of actual) {
      if (!world.factions.has(fid)) {
        world.factions.set(fid, {
          id: fid,
          members: set,
          color: _nextFactionColor(world),
        });
      } else {
        world.factions.get(fid).members = set;
      }
      if (!world.flags.has(fid)) {
        const members = [...set]
          .map((id) => world.agentsById.get(id))
          .filter(Boolean);
        if (members.length) _placeFlag(world, fid, members);
      }
    }
    for (const [fid, f] of [...world.factions]) {
      let aliveCount = 0;
      for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
      if (aliveCount <= 1) _disbandFaction(world, fid, "reconcile");
    }
  }
  function randomFreeCell(world) {
    for (let tries = 0; tries < 5000; tries++) {
      const x = Math.floor(Math.random() * 62),
        y = Math.floor(Math.random() * 62);
      if (!isBlocked(world, x, y)) return { x, y };
    }
    return { x: 0, y: 0 };
  }

  /* ===== spawn.js ===== */
  init_constants();
  init_utils();
  function maybeSpawnCrops(world) {
    if (world.crops.size >= TUNE.maxCrops) return;
    const attempts = GRID;
    const base = 6e-4 * world.spawnMult;
    for (let i = 0; i < attempts; i++) {
      if (world.crops.size >= TUNE.maxCrops) break;
      const x = rndi(0, GRID - 1),
        y = rndi(0, GRID - 1);
      const k = key(x, y);
      if (
        world.crops.has(k) ||
        world.walls.has(k) ||
        world.farms.has(k) ||
        world.agentsByCell.has(k) ||
        world.flagCells.has(k)
      )
        continue;
      let prob = base;
      for (const fm of world.farms.values()) {
        const d = Math.abs(x - fm.x) + Math.abs(y - fm.y);
        if (d <= TUNE.farmBoostRadius)
          prob *= 1 + (TUNE.farmBoostRadius - d + 1) * 0.6;
      }
      if (Math.random() < prob)
        world.crops.set(k, { id: crypto.randomUUID(), x, y });
    }
  }

  /* ===== upkeep.js ===== */
  init_constants();
  init_utils();
  function applyFlagHealing(world) {
    for (const a of world.agents) {
      if (!a.factionId) continue;
      const flag = world.flags.get(a.factionId);
      if (!flag) continue;
      const d = Math.abs(a.cellX - flag.x) + Math.abs(a.cellY - flag.y);
      if (d <= TUNE.healAuraRadius)
        a.health = Math.min(a.maxHealth, a.health + TUNE.healAuraPerTick);
    }
  }
  function cleanDead(world) {
    const removedIds = [];
    world.agents = world.agents.filter((a) => {
      if (a.health <= 0) {
        world.agentsByCell.delete(key(a.cellX, a.cellY));
        world.agentsById.delete(a.id);
        removedIds.push(a.id);
        if (a.factionId && world.factions.has(a.factionId)) {
          const f = world.factions.get(a.factionId);
          f.members.delete(a.id);
        }
        log(world, "death", `${a.name} died`, a.id, {});
        return false;
      }
      return true;
    });
    if (removedIds.length) {
      for (const a of world.agents) {
        for (const rid of removedIds) a.relationships.delete(rid);
      }
    }
    for (const a of world.agents) {
      for (const rid of a.relationships.keys()) {
        if (!world.agentsById.has(rid)) a.relationships.delete(rid);
      }
    }
    for (const [fid, f] of [...world.factions]) {
      let aliveCount = 0;
      for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
      if (aliveCount <= 1) _disbandFaction(world, fid, "no members");
    }
    const wallsToDelete = [];
    for (const [k, w] of world.walls) {
      if (w.hp <= 0) wallsToDelete.push(k);
    }
    for (const k of wallsToDelete) {
      const w = world.walls.get(k);
      world.walls.delete(k);
      if (w) log(world, "destroy", `Wall @${w.x},${w.y} destroyed`, null, {});
    }
  }
  function levelCheck(world, a) {
    if (a.level >= TUNE.levelCap) return;
    if (a.energy > ENERGY_CAP * 0.7) {
      a.level++;
      if (a.level > TUNE.levelCap) a.level = TUNE.levelCap;
      if (a.level <= TUNE.levelCap) {
        a.maxHealth += 8;
        a.attack += 1.5;
        a.energy = Math.min(ENERGY_CAP, 140);
        log(world, "level", `${a.name} leveled to ${a.level}`, a.id, {});
      }
    }
  }

  /* ===== main.js ===== */
  init_constants();
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

    // Save/Load
    function serializeWorld(world2) {
      const factions = [...world2.factions.values()].map((f) => ({
        id: f.id,
        color: f.color,
        members: [...f.members],
      }));
      const flags = [...world2.flags.values()];
      const walls = [...world2.walls.values()];
      const farms = [...world2.farms.values()];
      const crops = [...world2.crops.values()];
      const agents = world2.agents.map((a) => ({
        id: a.id,
        name: a.name,
        cellX: a.cellX,
        cellY: a.cellY,
        health: a.health,
        maxHealth: a.maxHealth,
        energy: a.energy,
        attack: a.attack,
        level: a.level,
        ageTicks: a.ageTicks,
        factionId: a.factionId,
        relationships: [...a.relationships.entries()],
        path: a.path ? a.path.slice(a.pathIdx) : null,
        pathIdx: 0,
        action: a.action
          ? {
              type: a.action.type,
              remainingMs: a.action.remainingMs,
              tickCounterMs: a.action.tickCounterMs,
              payload: a.action.payload || null,
            }
          : null,
        lockMsRemaining: a.lockMsRemaining,
        travelPref: a.travelPref,
        aggression: a.aggression,
        cooperation: a.cooperation,
      }));
      return {
        meta: { version: "1.4.3-camera+ui", savedAt: Date.now() },
        grid: { CELL, GRID },
        state: {
          tick: world2.tick,
          speedPct: world2.speedPct,
          spawnMult: world2.spawnMult,
          drawGrid: world2.drawGrid,
        },
        factions,
        flags,
        walls,
        farms,
        crops,
        agents,
        log: { limit: world2.log.limit, arr: world2.log.arr },
        selectedId: world2.selectedId,
        activeLogCats: [...world2.activeLogCats],
        activeLogAgentId: world2.activeLogAgentId || null,
      };
    }
    function exportState(world2) {
      const blob = new Blob([JSON.stringify(serializeWorld(world2))], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        "life_of_factions_" +
        new Date().toISOString().replace(/[:.]/g, "-") +
        ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 0);
      world2.log.push({
        t: performance.now(),
        cat: "info",
        msg: "State exported",
        actorId: null,
        extra: {},
      });
      doRenderLog();
    }
    function restoreWorld(world2, data) {
      world2.running = false;
      world2.walls.clear();
      world2.crops.clear();
      world2.farms.clear();
      world2.flags.clear();
      world2.flagCells.clear();
      world2.agents.length = 0;
      world2.agentsById.clear();
      world2.agentsByCell.clear();
      world2.factions.clear();
      world2.tick = data.state?.tick ?? 0;
      world2.speedPct = data.state?.speedPct ?? world2.speedPct;
      world2.spawnMult = data.state?.spawnMult ?? world2.spawnMult;
      world2.drawGrid = data.state?.drawGrid ?? true;
      for (const f of data.factions || [])
        world2.factions.set(f.id, {
          id: f.id,
          color: f.color,
          members: new Set(f.members || []),
        });
      for (const fl of data.flags || []) {
        world2.flags.set(fl.factionId, { ...fl });
        world2.flagCells.add(key(fl.x, fl.y));
      }
      for (const w of data.walls || [])
        world2.walls.set(key(w.x, w.y), { ...w });
      for (const fm of data.farms || [])
        world2.farms.set(key(fm.x, fm.y), { ...fm });
      for (const c of data.crops || [])
        world2.crops.set(key(c.x, c.y), { ...c });
      for (const a of data.agents || []) {
        const ag = {
          id: a.id,
          name: a.name,
          cellX: a.cellX,
          cellY: a.cellY,
          health: a.health,
          maxHealth: a.maxHealth,
          energy: a.energy,
          attack: a.attack,
          level: a.level,
          ageTicks: a.ageTicks,
          factionId: a.factionId || null,
          relationships: new Map(a.relationships || []),
          path: a.path || null,
          pathIdx: a.pathIdx || 0,
          action: a.action ? { ...a.action } : null,
          lockMsRemaining: a.lockMsRemaining || 0,
          travelPref: a.travelPref || "near",
          aggression: a.aggression ?? Math.random(),
          cooperation: a.cooperation ?? Math.random(),
          replanAtTick: 0,
          goal: null,
        };
        if (
          ag.action &&
          ag.action.payload?.targetId &&
          !(data.agents || []).some((x) => x.id === ag.action.payload.targetId)
        )
          ag.action = null;
        world2.agents.push(ag);
        world2.agentsById.set(ag.id, ag);
        world2.agentsByCell.set(key(ag.cellX, ag.cellY), ag.id);
      }
      reconcileFactions(world2);
      if (world2._rebuildAgentOptions) world2._rebuildAgentOptions();
      doRenderLog();
      world2.log.push({
        t: performance.now(),
        cat: "info",
        msg: "State loaded",
        actorId: null,
        extra: {},
      });
      if (dom.gridChk) dom.gridChk.checked = world2.drawGrid;
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
      buttons.btnSave?.addEventListener("click", () => exportState(world));
      buttons.btnLoad?.addEventListener("click", () => dom.fileLoad.click());
      dom.fileLoad?.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            restoreWorld(world, data);
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

    // Inspector
    function updateInspector(world2, el) {
      if (!el) return;
      if (!world2.selectedId) {
        el.innerHTML = '<div class="muted">Click an agent on the canvas.</div>';
        return;
      }
      const a = world2.agentsById.get(world2.selectedId);
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
})();
