(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) =>
    function __init() {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res;
    };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/constants.js
  var CELL,
    GRID,
    WORLD_PX,
    CANVAS_PX,
    OFFSET,
    BASE_TICK_MS,
    TUNE,
    ACTION_DURATIONS,
    ACTION_BASE_ADDED,
    COLORS,
    FACTION_COLORS,
    LOG_CATS,
    ENERGY_CAP;
  var init_constants = __esm({
    "js/constants.js"() {
      CELL = 16;
      GRID = 62;
      WORLD_PX = GRID * CELL;
      CANVAS_PX = 1e3;
      OFFSET = Math.floor((CANVAS_PX - WORLD_PX) / 2);
      BASE_TICK_MS = 40;
      ENERGY_CAP = 200;
      TUNE = {
        moveEnergy: 0.1,
        actionCost: {
          talk: 0.4,
          quarrel: 0.8,
          attack: 2.2,
          heal: 3,
          help: 1.6,
          attack_wall: 1.5,
          attack_flag: 2,
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
        farmEnergyCost: 12,
        buildWallChance: 2e-4,
        buildFarmChance: 5e-3,

        // Factions (explicit, not graph-based)
        factionThreshold: 0.5,
        factionMinSize: 2,
        factionFormRelThreshold: 0.6,
        helpConvertChance: 0.5,
        helpConvertRelThreshold: 0.4,

        energyLowThreshold: 40,
        foodPlanThreshold: 70,
        lowEnergyExploreRange: 14,
        levelCap: 20,
        maxCrops: 100,

        // Reproduction
        reproduction: {
          relationshipThreshold: 0.1,
          relationshipEnergy: 85,
        },

        // Pathfinding budget per tick (CONFIGURABLE)
        pathBudgetPerTick: 30,
      };
      ACTION_DURATIONS = {
        talk: [900, 1800],
        quarrel: [900, 1800],
        attack: [450, 900],
        heal: [900, 1800],
        help: [900, 1800],
        attack_wall: [1e3, 2e3],
        attack_flag: [1e3, 2e3],
        reproduce: [2e3, 3200],
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
        "attack_wall",
        "attack_flag",
        "reproduce",
        "harvest",
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

  // js/utils.js
  var rnd, rndi, clamp, key, fromKey, manhattan, name6, RingLog;
  var init_utils = __esm({
    "js/utils.js"() {
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

  // js/systems/spatial.js
  function isBlocked(world, x, y, ignoreId = null) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
    const k = key(x, y);
    if (world.walls.has(k)) return true;
    if (world.farms.has(k)) return true;
    if (world.flagCells.has(k)) return true; // O(1) flag collision
    const occ = world.agentsByCell.get(k);
    if (occ && occ !== ignoreId) return true;
    return false;
  }
  var init_spatial = __esm({
    "js/systems/spatial.js"() {
      init_constants();
      init_utils();
    },
  });

  // js/systems/harvest.js
  function harvestAt(world, a, x, y) {
    const k = key(x, y);
    const crop = world.crops.get(k);
    if (!crop) return false;
    world.crops.delete(k);
    a.energy = Math.min(ENERGY_CAP, a.energy + TUNE.cropGain);
    log(world, "harvest", `${a.name} harvested`, a.id, { x, y });
    // Auto-share to faction members within 5 blocks (Manhattan)
    if (a.factionId) {
      const recipients = world.agents.filter(
        (m) =>
          m.factionId === a.factionId &&
          m.id !== a.id &&
          manhattan(a.cellX, a.cellY, m.cellX, m.cellY) <= 5
      );
      if (recipients.length) {
        const shareTotal = TUNE.cropGain * 0.3; // share 30%
        const per = shareTotal / recipients.length;
        for (const m of recipients) {
          m.energy = Math.min(ENERGY_CAP, m.energy + per);
        }
      }
    }
    return true;
  }
  function log(world, cat, msg, actorId = null, extra = {}) {
    world.log.push({ t: performance.now(), cat, msg, actorId, extra });
  }
  var init_harvest = __esm({
    "js/systems/harvest.js"() {
      init_constants();
      init_utils();
    },
  });

  // js/pathfinding.js
  function astar(start, goal, isBlocked2) {
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = /* @__PURE__ */ new Map(),
      came = /* @__PURE__ */ new Map(),
      g = /* @__PURE__ */ new Map(),
      f = /* @__PURE__ */ new Map();
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
    // Safety cap to prevent pathological searches from blowing the frame
    let expansions = 0;
    const MAX_EXP = 900; // ~quarter of grid; tune as needed
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
  var init_pathfinding = __esm({
    "js/pathfinding.js"() {
      init_constants();
      init_utils();
    },
  });

  // js/systems/building.js
  function tryBuildWall(world, a) {
    if (Math.random() >= TUNE.buildWallChance) return;
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1],
    ];
    const free = adj.filter(([x2, y2]) => !isBlocked(world, x2, y2));
    if (!free.length) return;
    const [x, y] = free[rndi(0, free.length - 1)];
    const k = key(x, y);
    world.walls.set(k, {
      id: crypto.randomUUID(),
      x,
      y,
      hp: rndi(TUNE.wallHp[0], TUNE.wallHp[1]),
      maxHp: TUNE.wallHp[1],
    });
    log(world, "build", `${a.name} built wall`, a.id, { x, y });
  }
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
  var init_building = __esm({
    "js/systems/building.js"() {
      init_constants();
      init_utils();
      init_spatial();
      init_harvest();
    },
  });

  // js/systems/actions.js
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
    tryStartAction: () => tryStartAction,
  });
  function planPathTo(world, a, gx, gy) {
    // Only let whitelisted agents run A* this tick — do NOT push cooldowns if not allowed
    if (world._pathWhitelist && !world._pathWhitelist.has(a.id)) {
      return; // wait for your RR turn
    }

    // Replan throttle + goal caching
    const cooldown = a.replanAtTick || 0;
    const sameGoal = a.goal && a.goal.x === gx && a.goal.y === gy;
    if (sameGoal && a.path && a.pathIdx < a.path.length) return;
    if (world.tick < cooldown) return;

    // Global per-tick budget to prevent A* stampede — also do NOT push cooldown here
    if (world.pathBudget <= 0) {
      return; // try again when budget resets next tick
    }
    world.pathBudget--;

    a.goal = { x: gx, y: gy };
    const path = astar({ x: a.cellX, y: a.cellY }, { x: gx, y: gy }, (x, y) =>
      isBlocked(world, x, y, a.id)
    );
    a.path = path;
    a.pathIdx = 0;
    a.replanAtTick = world.tick + 6 + rndi(0, 6); // ~0.5s @40ms
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

  // Flow-field helpers to avoid low-food A* stampede
  const FF_INF = 0xffff;
  const ffIdx = (x, y) => y * GRID + x;

  function recomputeFoodField(world) {
    const N = GRID * GRID;
    if (!world.foodField || world.foodField.length !== N) {
      world.foodField = new Uint16Array(N);
    }
    world.foodField.fill(FF_INF);

    if (world.crops.size === 0) {
      world._foodFieldTick = world.tick;
      return;
    }

    // static-only obstacle check (ignore agents)
    const staticBlocked = (x, y) => {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
      const k = key(x, y);
      if (world.walls.has(k)) return true;
      if (world.farms.has(k)) return true;
      if (world.flagCells.has(k)) return true;
      return false;
    };

    // FIFO queues (typed arrays)
    const Nmax = N;
    const qx = new Int16Array(Nmax);
    const qy = new Int16Array(Nmax);
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

  // Try to set a single step toward smaller distance; returns true if stepped
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
    // take ONE tile without A*
    a.path = [{ x: best.x, y: best.y }];
    a.pathIdx = 0;
    a.goal = null;
    return true;
  }

  // chooser helpers
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
        p = 1; // force attack if any enemy is nearby when food is absent
      }
    }
    if (p === undefined) {
      const hasEnemyNearby = candidates.some(
        (b) => a.factionId && b.factionId && a.factionId !== b.factionId
      );
      p = clamp(a.aggression + (hasEnemyNearby ? 0.25 : 0), 0, 1);
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
    if (tryStartAction(a, "attack", { targetId: target.id })) return true;
    return false;
  }
  function chooseHelpHealTalk(world, a) {
    // Only consider neighbors at distance 1
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

    // Try help/heal first according to cooperation
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

    // Else try talk/quarrel (still only at distance 1)
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
    if (a.energy < TUNE.energyLowThreshold) return;

    // If there's no food anywhere, prioritize attacking enemies nearby
    if (
      world.crops.size < world.agents.length * 0.15 &&
      a.energy < TUNE.energyLowThreshold
    ) {
      if (chooseAttack(world, a, true)) return;
      // (fall through to other interactions if no enemy in range)
    }

    // Reproduction attempt first when adjacent partner available
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
    if (a.energy < TUNE.energyLowThreshold && act.type !== "reproduce") {
      a.action = null;
      return;
    }
    act.remainingMs -= dtMs;
    act.tickCounterMs += dtMs;
    const costPerMs = (TUNE.actionCost[act.type] || 1) / 1e3;
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
        log(world, "attack", `${a.name} hit ${targ.name}`, a.id, {
          to: targ.id,
        });

        // Same-faction infighting: 20% chance lower-level leaves faction
        if (
          a.factionId &&
          targ.factionId &&
          a.factionId === targ.factionId &&
          Math.random() < 0.2
        ) {
          let quitter = a;
          if (targ.level < a.level) quitter = targ;
          else if (targ.level === a.level)
            quitter = Math.random() < 0.5 ? a : targ;
          setFaction(world, quitter, null, "infighting");
        }
      } else if (act.type === "attack_wall") {
        const wx = act.payload?.x,
          wy = act.payload?.y;
        const w = world.walls.get(key(wx, wy));
        if (w) {
          w.hp -= a.attack * 0.35;
          log(
            world,
            "attack_wall",
            `${a.name} damaged wall @${wx},${wy}`,
            a.id,
            { x: wx, y: wy }
          );
        } else {
          a.action = null;
          return;
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

      // Explicit faction logic on completion (no graph-based recompute)
      if (targ2 && !a.factionId && !targ2.factionId) {
        const rel = getRel(a, targ2.id);
        if (
          (act.type === "talk" || act.type === "help" || act.type === "heal") &&
          rel >= TUNE.factionFormRelThreshold &&
          a.id < targ2.id
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
              (a.aggression + targ2.aggression) / 2 + rnd(-0.15, 0.15),
              0,
              1
            );
            child.cooperation = clamp(
              (a.cooperation + targ2.cooperation) / 2 + rnd(-0.15, 0.15),
              0,
              1
            );
            child.travelPref =
              Math.random() < 0.5 ? a.travelPref : targ2.travelPref;

            const pa = a.factionId || null;
            const pb = targ2.factionId || null;
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
    // random travel preference: near, far, wander (even split)
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
      starvingSeconds: 0,
      factionId: null,
      relationships: /* @__PURE__ */ new Map(),
      path: null,
      pathIdx: 0,
      action: null,
      lockMsRemaining: 0,
      travelPref: pref,
      aggression: Math.random(),
      cooperation: Math.random(),
      // replan throttle + goal cache
      replanAtTick: 0,
      goal: null,
    };
    world.agents.push(a);
    world.agentsById.set(id, a);
    world.agentsByCell.set(key(x, y), id);
    return a;
  }

  function seekFoodWhenHungry(world, a) {
    // harvest if standing on a crop
    if (world.crops.has(key(a.cellX, a.cellY))) {
      harvestAt(world, a, a.cellX, a.cellY);
      return;
    }

    // Maintain the food flow-field every few ticks (cheap ~ O(grid))
    if (world.tick - (world._foodFieldTick || 0) >= 5) {
      recomputeFoodField(world);
    }

    // If ANY adjacent crop, take a single step WITHOUT A* (bypass whitelist/budget)
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

    // If no crops on the map, avoid A* entirely: take ONE greedy/random step
    if (world.crops.size === 0) {
      // prefer stepping toward a farm if any
      let goal = null,
        bestD = 1e9;
      for (const fm of world.farms.values()) {
        const d = Math.abs(a.cellX - fm.x) + Math.abs(a.cellY - fm.y);
        if (d < bestD) {
          bestD = d;
          goal = fm;
        }
      }
      const stepChoices = adj.filter(([x, y]) => !isBlocked(world, x, y, a.id));
      if (stepChoices.length) {
        let pick;
        if (goal) {
          stepChoices.sort(
            (p1, p2) =>
              Math.abs(p1[0] - goal.x) +
              Math.abs(p1[1] - goal.y) -
              (Math.abs(p2[0] - goal.x) + Math.abs(p2[1] - goal.y))
          );
        }
        pick =
          pick ||
          stepChoices[0] ||
          stepChoices[rndi(0, stepChoices.length - 1)];
        // move one tile WITHOUT A* by setting a 1-step path
        a.path = [{ x: pick[0], y: pick[1] }];
        a.pathIdx = 0;
        a.goal = null;
      }
      return;
    }

    // If crops are scarce relative to agents, follow the flow-field one step.
    // This avoids dozens of concurrent long A* searches to the same few crops.
    const scarcity = world.crops.size / Math.max(1, world.agents.length);
    if (scarcity < 0.35) {
      if (stepTowardFood(world, a)) return;

      // Fallback: when very low energy, allow any free sidestep to break crowd lock
      if (a.energy < TUNE.energyLowThreshold) {
        const freeAdj = adj.filter(([x, y]) => !isBlocked(world, x, y, a.id));
        if (freeAdj.length) {
          const [nx, ny] = freeAdj[rndi(0, freeAdj.length - 1)];
          a.path = [{ x: nx, y: ny }];
          a.pathIdx = 0;
          a.goal = null;
          return;
        }
      }
      // If no gradient (unreachable pocket), fall through to other options.
    }

    // Otherwise: head to nearest crop (A* is allowed but budget-gated)
    const filteredCrops = [...world.crops.values()].filter(
      (c) => !world.flagCells.has(key(c.x, c.y))
    );
    if (filteredCrops.length) {
      const near = findNearest(world, a, filteredCrops);
      if (near) {
        planPathTo(world, a, near.target.x, near.target.y);
        return;
      }
    }

    // Fallback: try a farm (A* will be budget-gated)
    if (world.farms.size) {
      let best = null,
        bestD = 1e9;
      for (const fm of world.farms.values()) {
        const d = Math.abs(a.cellX - fm.x) + Math.abs(a.cellY - fm.y);
        if (d < bestD) {
          bestD = d;
          best = fm;
        }
      }
      if (best && !isBlocked(world, best.x, best.y, a.id)) {
        planPathTo(world, a, best.x, best.y);
        return;
      }
    }

    // Last resort: short exploration target (A* will be budgeted)
    for (let tries = 0; tries < 5; tries++) {
      const r = TUNE.lowEnergyExploreRange;
      const rx = clamp(a.cellX + rndi(-r, r), 0, 61);
      const ry = clamp(a.cellY + rndi(-r, r), 0, 61);
      if (!isBlocked(world, rx, ry, a.id)) {
        planPathTo(world, a, rx, ry);
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
  var init_actions = __esm({
    "js/systems/actions.js"() {
      init_constants();
      init_utils();
      init_pathfinding();
      init_spatial();
      init_harvest();
      init_building();
      init_utils();
      getRel = (a, bId) => a.relationships.get(bId) ?? 0;
      // Relationship setter with decay-to-zero + hard cap
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
          for (let i = 0; i < toDrop; i++)
            a.relationships.delete(prunable[i][0]);
        }
      };
    },
  });

  // js/main.js
  init_constants();

  // js/world.js
  init_constants();
  init_utils();
  var World = class {
    constructor() {
      this.walls = /* @__PURE__ */ new Map();
      this.crops = /* @__PURE__ */ new Map();
      this.farms = /* @__PURE__ */ new Map();
      this.flags = /* @__PURE__ */ new Map(); // fid -> {id,factionId,x,y,hp,maxHp}
      this.flagCells = new Set(); // keyed "x,y" for O(1) isBlocked checks
      this.agents = [];
      this.agentsById = /* @__PURE__ */ new Map();
      this.agentsByCell = /* @__PURE__ */ new Map();
      this.factions = /* @__PURE__ */ new Map(); // fid -> {id, members:Set, color}
      this.log = new RingLog(100);
      this.activeLogCats = new Set(LOG_CATS);
      this.activeLogAgentId;
      this.tick = 0;
      this.speedPct = 50;
      this.spawnMult = 1;
      this.running = false;
      this.selectedId = null;
      this.pauseOnBlur = true; // NEW: toggleable pause on blur

      // UI throttling/memo
      this._lastFactionsDomAt = 0;
      this._lastAgentCount = 0;
      this._rebuildAgentOptions = null;
      this._lastFactionsSig = "";
      // A* per-tick budget
      this.pathBudgetMax = Number.isFinite(TUNE.pathBudgetPerTick)
        ? TUNE.pathBudgetPerTick
        : 30;
      this.pathBudget = 0;
      // NEW: round-robin cursor + per-tick whitelist for fair A*
      this._pathRR = 0;
      this._pathWhitelist = new Set();

      // Flow field to nearest crop (Uint16: 0..65534, 65535 = unreachable)
      this.foodField = new Uint16Array(GRID * GRID);
      this.foodField.fill(0xffff);
      this._foodFieldTick = -1; // last recompute tick
    }
  };

  // js/render.js
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

  // NEW: per-action compact indicator (fast vector glyphs)
  function drawActionIndicator(ctx, cx, topY, type, factionColor = "#ccc") {
    ctx.save();
    // background stem
    ctx.fillStyle = "#c7c7d2";
    ctx.fillRect(cx - 1, topY - 6, 2, 7);

    // color by type
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
      case "attack_wall":
        fill = "#cfc08b";
        break;
      case "attack_flag":
        fill = factionColor || "#cccccc";
        break;
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;

    // draw simple glyphs 9×8 box to the right of stem
    const x = cx + 2,
      y = topY - 5;
    switch (type) {
      case "attack": // crossed blades (X)
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8, y + 8);
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x, y + 8);
        ctx.strokeStyle = fill;
        ctx.stroke();
        break;
      case "heal": // plus
        ctx.beginPath();
        ctx.fillRect(x + 3, y, 2, 8);
        ctx.fillRect(x, y + 3, 8, 2);
        break;
      case "help": // up arrow
        ctx.beginPath();
        ctx.moveTo(x + 4, y);
        ctx.lineTo(x + 4, y + 8);
        ctx.moveTo(x + 1, y + 3);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x + 7, y + 3);
        ctx.strokeStyle = fill;
        ctx.stroke();
        break;
      case "talk": // chat bubble
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
      case "quarrel": // lightning
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
      case "reproduce": // heart
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 7);
        ctx.bezierCurveTo(x + 8, y + 4, x + 7, y + 0.5, x + 5, y + 1.2);
        ctx.bezierCurveTo(x + 4, y + 1.8, x + 4, y + 3, x + 4, y + 3);
        ctx.bezierCurveTo(x + 4, y + 3, x + 4, y + 1.8, x + 3, y + 1.2);
        ctx.bezierCurveTo(x + 1, y + 0.5, x + 0, y + 4, x + 4, y + 7);
        ctx.fill();
        break;
      case "attack_wall": // hammer
        ctx.fillRect(x + 1, y + 1, 6, 2);
        ctx.fillRect(x + 3, y + 3, 2, 5);
        break;
      case "attack_flag": // mini flag colored by faction
        drawFactionPennant(ctx, cx, topY, factionColor);
        break;
      default:
        ctx.fillRect(x, y, 8, 8);
    }
    ctx.restore();
  }

  // Compact "low energy" icon
  function drawLowEnergyIcon(ctx, cx, topY) {
    const w = 6,
      h = 4;
    const x = Math.round(cx) - 10; // shift left of center/action glyph
    const y = Math.round(topY) - 2; // aligns nicely above the head

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y); // top-left
    ctx.lineTo(x + w, y); // top-right
    ctx.lineTo(x + w / 2, y + h); // bottom apex (downward)
    ctx.closePath();
    ctx.fillStyle = "#ff6d7a"; // red
    ctx.fill();
    ctx.restore();
  }

  function render(
    world,
    ctx,
    canvas,
    hud,
    stats,
    factionsList,
    gridLayer = null
  ) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw pre-rendered grid if provided
    if (gridLayer) {
      ctx.drawImage(gridLayer, 0, 0);
    } else {
      ctx.save();
      ctx.translate(OFFSET, OFFSET);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= GRID; i++) {
        ctx.moveTo(0, i * CELL + 0.5);
        ctx.lineTo(GRID * CELL, i * CELL + 0.5);
      }
      for (let i = 0; i <= GRID; i++) {
        ctx.moveTo(i * CELL + 0.5, 0);
        ctx.lineTo(i * CELL + 0.5, GRID * CELL);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(OFFSET, OFFSET);

    ctx.fillStyle = COLORS.crop;
    for (const c of world.crops.values()) {
      drawTriangle(ctx, c.x * CELL, c.y * CELL);
    }
    for (const f of world.farms.values()) {
      ctx.fillStyle = COLORS.farm;
      ctx.fillRect(f.x * CELL + 2, f.y * CELL + 2, CELL - 4, CELL - 4);
    }
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
    for (const f of world.flags.values()) {
      const faction = world.factions.get(f.factionId);
      const col = faction?.color || "#cccccc";
      ctx.fillStyle = COLORS.flagPole;
      ctx.fillRect(f.x * CELL + 6, f.y * CELL + 2, 3, CELL - 4);
      ctx.fillStyle = col;
      ctx.fillRect(f.x * CELL + 9, f.y * CELL + 4, CELL - 8, 8);
    }
    for (const a of world.agents) {
      const x = a.cellX * CELL,
        y = a.cellY * CELL;
      ctx.fillStyle = COLORS.agentFill;
      const col = a.factionId
        ? world.factions.get(a.factionId)?.color || "#fff"
        : "#6b7280";
      drawAgentCircle(ctx, x, y, CELL / 2 - 3, col);

      // HP bar
      const hpw = Math.max(
        0,
        Math.floor((CELL - 6) * (a.health / a.maxHealth))
      );
      ctx.fillStyle = COLORS.hp;
      ctx.fillRect(x + 3, y + 1, hpw, 2);

      const glyphTop = y - 8;
      const cx = x + CELL / 2;

      // Low-energy blip
      if (a.energy < TUNE.energyLowThreshold) {
        drawLowEnergyIcon(ctx, cx, glyphTop);
      }

      // per-action indicator above head (color-coded)
      if (a.action) {
        const fcol = a.factionId
          ? world.factions.get(a.factionId)?.color || "#cccccc"
          : "#cccccc";
        drawActionIndicator(ctx, cx, glyphTop, a.action.type, fcol);
      }

      // selection star above selected agent
      if (world.selectedId === a.id) {
        drawStar(ctx, x + CELL / 2, y - 16);
      }
    }
    ctx.restore();

    hud.textContent = `tick:${world.tick} | fps:${stats.fps.toFixed(
      0
    )} | agents:${world.agents.length}`;
    stats.stAgents.textContent = world.agents.length;
    stats.stFactions.textContent = world.factions.size;
    stats.stCrops.textContent = world.crops.size;
    stats.stFarms.textContent = world.farms.size;
    stats.stWalls.textContent = world.walls.size;
    stats.stFlags.textContent = world.flags.size;

    // THROTTLED FACTIONS LIST REBUILD (only on change or every ~2s)
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

  // js/ui.js
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
      buttons: {
        btnStart,
        btnPause,
        btnResume,
        btnSpawnCrop,
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
    };
  }
  function setupLogFilters(world, logFilters, renderLog2) {
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
  function renderLog(world, logList) {
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

  // js/systems/factions.js
  init_constants();
  init_utils();
  init_spatial();
  init_harvest();

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

  function _destroyFactionIfEmpty(world, fid) {
    const f = world.factions.get(fid);
    if (!f) return;
    let aliveCount = 0;
    for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
    if (aliveCount === 0) {
      world.factions.delete(fid);
      if (world.flags.has(fid)) {
        const flag = world.flags.get(fid);
        if (flag) world.flagCells.delete(key(flag.x, flag.y));
        world.flags.delete(fid);
        log(world, "destroy", `Flag ${fid} destroyed`, null, {
          factionId: fid,
        });
      }
      log(world, "faction", `Faction ${fid} disbanded`, null, {
        factionId: fid,
      });
    }
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
        `${agent.name} left faction ${oldFid}${
          reason ? " (" + reason + ")" : ""
        }`,
        agent.id,
        { from: oldFid, to: null, reason }
      );
    } else if (!oldFid && newFid) {
      log(
        world,
        "faction",
        `${agent.name} joined faction ${newFid}${
          reason ? " (" + reason + ")" : ""
        }`,
        agent.id,
        { from: null, to: newFid, reason }
      );
    } else if (oldFid && newFid) {
      log(
        world,
        "faction",
        `${agent.name} moved ${oldFid} → ${newFid}${
          reason ? " (" + reason + ")" : ""
        }`,
        agent.id,
        { from: oldFid, to: newFid, reason }
      );
    }
    if (oldFid) _destroyFactionIfEmpty(world, oldFid);
  }

  function reconcileFactions(world) {
    const actual = new Map();
    for (const a of world.agents) {
      if (!a.factionId) continue;
      if (!actual.has(a.factionId)) actual.set(a.factionId, new Set());
      actual.get(a.factionId).add(a.id);
    }

    const toDelete = [];
    for (const [fid, f] of world.factions) {
      const set = actual.get(fid) || new Set();
      f.members = set;
      if (set.size === 0) toDelete.push(fid);
    }
    for (const fid of toDelete) {
      world.factions.delete(fid);
      if (world.flags.has(fid)) {
        const flag = world.flags.get(fid);
        if (flag) world.flagCells.delete(key(flag.x, flag.y));
        world.flags.delete(fid);
        log(world, "destroy", `Flag ${fid} destroyed`, null, {
          factionId: fid,
        });
      }
    }

    for (const [fid, set] of actual) {
      if (!world.factions.has(fid)) {
        world.factions.set(fid, {
          id: fid,
          members: set,
          color: _nextFactionColor(world),
        });
      }
      if (!world.flags.has(fid)) {
        const members = [...set]
          .map((id) => world.agentsById.get(id))
          .filter(Boolean);
        if (members.length) _placeFlag(world, fid, members);
      }
    }
  }

  function randomFreeCell(world) {
    for (let tries = 0; tries < 5e3; tries++) {
      const x = Math.floor(Math.random() * 62);
      const y = Math.floor(Math.random() * 62);
      if (!isBlocked(world, x, y)) return { x, y };
    }
    return { x: 0, y: 0 };
  }

  // js/systems/spawn.js
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
        world.flagCells.has(k) // ← prevent crops on flags
      )
        continue;
      let prob = base;
      for (const fm of world.farms.values()) {
        const d = Math.abs(x - fm.x) + Math.abs(y - fm.y);
        if (d <= TUNE.farmBoostRadius)
          prob *= 1 + (TUNE.farmBoostRadius - d + 1) * 0.6;
      }
      if (Math.random() < prob) {
        world.crops.set(k, { id: crypto.randomUUID(), x, y });
      }
    }
  }

  // js/systems/upkeep.js
  init_constants();
  init_utils();
  init_harvest();
  function applyFlagHealing(world) {
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

    // Disband empty factions (no cloning)
    const factionsToDelete = [];
    for (const [fid, f] of world.factions) {
      let aliveCount = 0;
      for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
      if (aliveCount === 0) factionsToDelete.push(fid);
    }
    for (const fid of factionsToDelete) {
      world.factions.delete(fid);
      const flag = world.flags.get(fid);
      if (flag) {
        world.flagCells.delete(key(flag.x, flag.y));
        world.flags.delete(fid);
        log(world, "destroy", `Flag ${fid} destroyed`, null, {
          factionId: fid,
        });
      }
      log(world, "faction", `Faction ${fid} disbanded`, null, {
        factionId: fid,
      });
    }

    // Clean up destroyed walls (no cloning)
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

  // js/main.js
  init_actions();
  init_spatial();
  init_utils();
  init_building();
  init_harvest();
  document.addEventListener("DOMContentLoaded", () => {
    const dom = bindDom();
    const ctx = dom.canvas.getContext("2d");
    const world = new World();
    window.world = world;
    const doRenderLog = () => renderLog(world, dom.logList);
    setupLogFilters(world, dom.logFilters, doRenderLog);

    // Pre-render static grid layer to avoid per-frame line drawing
    const gridLayer = document.createElement("canvas");
    gridLayer.width = dom.canvas.width;
    gridLayer.height = dom.canvas.height;
    {
      const gctx = gridLayer.getContext("2d");
      gctx.translate(OFFSET, OFFSET);
      gctx.strokeStyle = COLORS.grid;
      gctx.lineWidth = 1;
      gctx.beginPath();
      for (let i = 0; i <= GRID; i++) {
        gctx.moveTo(0, i * CELL + 0.5);
        gctx.lineTo(GRID * CELL, i * CELL + 0.5);
      }
      for (let i = 0; i <= GRID; i++) {
        gctx.moveTo(i * CELL + 0.5, 0);
        gctx.lineTo(i * CELL + 0.5, GRID * CELL);
      }
      gctx.stroke();
    }

    // NEW: UI toggle for Pause on Focus Loss (append without changing HTML file)
    (function addPauseToggle() {
      const controls = document.querySelector(".card.controls");
      if (!controls) return;
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "8px";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = "cbPauseOnBlur";
      cb.checked = world.pauseOnBlur;
      const span = document.createElement("span");
      span.textContent = "Pause when unfocused";
      label.appendChild(cb);
      label.appendChild(span);
      row.appendChild(label);
      controls.appendChild(row);
      cb.addEventListener("change", () => {
        world.pauseOnBlur = cb.checked;
      });
    })();

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

    // Save/Load helpers
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
        starvingSeconds: a.starvingSeconds,
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
        meta: { version: "1.3.6-perfcap", savedAt: Date.now() },
        grid: { CELL, GRID },
        state: {
          tick: world2.tick,
          speedPct: world2.speedPct,
          spawnMult: world2.spawnMult,
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

      for (const f of data.factions || []) {
        world2.factions.set(f.id, {
          id: f.id,
          color: f.color,
          members: new Set(f.members || []),
        });
      }
      for (const fl of data.flags || []) {
        world2.flags.set(fl.factionId, { ...fl });
        world2.flagCells.add(key(fl.x, fl.y));
      }
      for (const w of data.walls || []) {
        world2.walls.set(key(w.x, w.y), { ...w });
      }
      for (const fm of data.farms || []) {
        world2.farms.set(key(fm.x, fm.y), { ...fm });
      }
      for (const c of data.crops || []) {
        world2.crops.set(key(c.x, c.y), { ...c });
      }
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
          starvingSeconds: a.starvingSeconds,
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
        ) {
          ag.action = null;
        }
        world2.agents.push(ag);
        world2.agentsById.set(ag.id, ag);
        world2.agentsByCell.set(key(ag.cellX, ag.cellY), ag.id);
      }

      world2.log = new RingLog((data.log && data.log.limit) || 100);
      for (const it of data.log?.arr || []) world2.log.push(it);
      world2.selectedId = data.selectedId || null;
      world2.activeLogCats = new Set(data.activeLogCats || LOG_CATS);
      world2.activeLogAgentId = data.activeLogAgentId || null;

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
    }

    Promise.resolve()
      .then(() => (init_actions(), actions_exports))
      .then(({ addAgentAt: addAgentAt3 }) => {
        function spawnAgents(n) {
          for (let i = 0; i < n; i++) {
            const { x, y } = randomFreeCell(world);
            addAgentAt3(world, x, y);
          }
        }
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
          world.flagCells.clear();
          world.agents.length = 0;
          world.agentsById.clear();
          world.agentsByCell.clear();
          world.factions.clear();
          world.log = new world.log.constructor(100);
          world.tick = 0;
          world.selectedId = null;
          world.activeLogCats = /* @__PURE__ */ new Set([
            ...world.activeLogCats.values(),
          ]);
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

        dom.buttons.btnSave.addEventListener("click", () => {
          exportState(world);
        });
        dom.buttons.btnLoad.addEventListener("click", () => {
          dom.fileLoad.click();
        });
        dom.fileLoad.addEventListener("change", (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = JSON.parse(reader.result);
              restoreWorld(world, data);
              dom.buttons.btnPause.disabled = true;
              dom.buttons.btnResume.disabled = false;
              dom.buttons.btnStart.disabled = true;
            } catch (err) {
              alert("Failed to load save: " + err.message);
            } finally {
              dom.fileLoad.value = "";
            }
          };
          reader.readAsText(file);
        });

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
        function updateInspector(world2, el) {
          if (!world2.selectedId) {
            el.innerHTML =
              '<div class="muted">Click an agent on the canvas.</div>';
            return;
          }
          const a = world2.agentsById.get(world2.selectedId);
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
          <div class="muted">Travel Pref</div><div>${a.travelPref}</div>
          <div class="muted">Aggression</div><div>${a.aggression.toFixed(
            2
          )}</div>
          <div class="muted">Cooperation</div><div>${a.cooperation.toFixed(
            2
          )}</div>
          <div class="muted">Action</div><div>${
            a.action ? a.action.type : "—"
          }</div>
          <div class="muted">Remaining</div><div>${
            a.action ? (a.action.remainingMs / 1e3).toFixed(1) + "s" : "—"
          }</div>
        </div>`;
        }

        // 400ms UI refresh
        setInterval(() => {
          updateInspector(world, dom.inspector);
          doRenderLog();
          if (world._rebuildAgentOptions) {
            if (world._lastAgentCount !== world.agents.length) {
              world._rebuildAgentOptions();
              world._lastAgentCount = world.agents.length;
            }
          }
        }, 400);

        let lastTs = 0,
          acc = 0,
          fps = 0,
          fpsAcc = 0,
          fpsCount = 0;

        function isTrappedByWalls(world2, a) {
          const adj = [
            [a.cellX + 1, a.cellY],
            [a.cellX - 1, a.cellY],
            [a.cellX, a.cellY + 1],
            [a.cellX, a.cellY - 1],
          ];
          for (const [nx, ny] of adj) {
            if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) return false;
            if (!world2.walls.has(key(nx, ny))) return false;
          }
          return true;
        }

        function startAttackWallIfTrapped(world2, a) {
          if (!isTrappedByWalls(world2, a)) return false;
          const neighbors = [
            [a.cellX + 1, a.cellY],
            [a.cellX - 1, a.cellY],
            [a.cellX, a.cellY + 1],
            [a.cellX, a.cellY - 1],
          ];
          const walls = neighbors.filter(([nx, ny]) =>
            world2.walls.has(key(nx, ny))
          );
          if (!walls.length) return false;
          const [wx, wy] = walls[rndi(0, walls.length - 1)];
          if (tryStartAction(a, "attack_wall", { x: wx, y: wy })) {
            lockAgent(world2, a.id, a.action.remainingMs);
            return true;
          }
          return false;
        }

        function biasedRoam(world2, a) {
          const range = 6;
          const candidates = [];
          for (let i = 0; i < 6; i++) {
            const rx = Math.max(0, Math.min(61, a.cellX + rndi(-range, range)));
            const ry = Math.max(0, Math.min(61, a.cellY + rndi(-range, range)));
            if (!isBlocked(world2, rx, ry, a.id))
              candidates.push({ x: rx, y: ry });
          }
          if (!candidates.length) return;

          const centerX = Math.floor(GRID / 2);
          const centerY = Math.floor(GRID / 2);
          const distToCenter = (c) =>
            Math.abs(c.x - centerX) + Math.abs(c.y - centerY);

          let choice = candidates[0];

          if (a.travelPref === "wander") {
            choice = candidates[rndi(0, candidates.length - 1)];
          } else if (a.travelPref === "near") {
            if (a.factionId) {
              const flag = world2.flags.get(a.factionId);
              if (flag) {
                // prefer a small ring around flag and avoid bunching with same-faction members
                let bestScore = Infinity;
                for (const c of candidates) {
                  const d = Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y);
                  const desired = 4; // ring distance from flag center
                  // compute small local crowd penalty (radius 2)
                  let crowd = 0;
                  for (let dx = -2; dx <= 2; dx++) {
                    for (let dy = -2; dy <= 2; dy++) {
                      if (Math.abs(dx) + Math.abs(dy) > 2) continue;
                      const id = world2.agentsByCell.get(
                        key(c.x + dx, c.y + dy)
                      );
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
                // no flag (shouldn't happen often) — prefer center
                choice = candidates.reduce((best, c) =>
                  distToCenter(c) < distToCenter(best) ? c : best
                );
              }
            } else {
              // no faction — prefer center of map
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
                // no faction — prefer edges (far from center)
                choice = candidates.reduce((best, c) =>
                  distToCenter(c) > distToCenter(best) ? c : best
                );
              }
            } else {
              // no faction — prefer edges
              choice = candidates.reduce((best, c) =>
                distToCenter(c) > distToCenter(best) ? c : best
              );
            }
          }

          planPathTo(world2, a, choice.x, choice.y);
        }

        function updateTick() {
          world.tick++;

          // Refill per-tick A* budget, but cut it when food is scarce.
          const scarcity = world.crops.size / Math.max(1, world.agents.length);
          const budgetThisTick =
            scarcity < 0.25
              ? Math.max(6, Math.floor(world.pathBudgetMax * 0.5))
              : world.pathBudgetMax;
          world.pathBudget = budgetThisTick;

          // NEW: rotate a fair whitelist of agents that may use A* this tick
          world._pathWhitelist.clear();
          const n = world.agents.length;
          if (n > 0) {
            const eligible = world.agents.filter(
              (a) =>
                (a.lockMsRemaining || 0) <= 0 &&
                (!a.path || a.pathIdx >= a.path.length) &&
                !a.action
            );
            // Prioritize hungry agents for A* when there are many contenders
            let pool;
            if (eligible.length) {
              eligible.sort((a, b) => a.energy - b.energy);
              pool = eligible;
            } else {
              pool = world.agents;
            }
            const k = Math.min(budgetThisTick || 30, pool.length);
            for (let i = 0; i < k; i++) {
              const idx = (world._pathRR + i) % pool.length;
              world._pathWhitelist.add(pool[idx].id);
            }
            world._pathRR = (world._pathRR + k) % pool.length;
          }

          maybeSpawnCrops(world);

          // mark who is under attack without allocating a Set each tick
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
              startAttackWallIfTrapped(world, a);
            }

            const energyHigh = a.energy >= ENERGY_CAP * 0.7;
            const energyOkay = a.energy >= ENERGY_CAP * 0.3;

            if (a.energy < TUNE.energyLowThreshold) {
              if (a.action && a.action.type !== "reproduce") a.action = null;
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
                  if (!energyOkay) {
                    if (world.crops.has(key(a.cellX, a.cellY))) {
                      harvestAt(world, a, a.cellX, a.cellY);
                    } else {
                      seekFoodWhenHungry(world, a);
                    }
                  } else {
                    if (energyHigh) {
                      considerInteract(world, a);
                    } else {
                      considerInteract(world, a);
                    }
                    if (!a.path && !a.action) {
                      biasedRoam(world, a);
                    }
                  }
                }

                if (Math.random() < 0.02) tryBuildWall(world, a);
                if (a.energy >= 120 && Math.random() < 0.01)
                  tryBuildFarm(world, a);
              }
            }

            if (a.energy <= 0) {
              a.starvingSeconds += BASE_TICK_MS / 1e3;
              if (a.starvingSeconds > TUNE.starvationSeconds) a.health = 0;
            } else {
              a.starvingSeconds = 0;
            }
            a.energy = Math.min(ENERGY_CAP, a.energy);

            levelCheck(world, a);
          }

          if (world.tick % 25 === 0) reconcileFactions(world);

          applyFlagHealing(world);
          cleanDead(world);
        }

        const MAX_STEPS = 8; // cap fixed steps per frame to avoid spiral-of-death
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
            if (steps === MAX_STEPS) {
              // drop backlog to keep UI responsive
              acc = 0;
            }
          }

          render(
            world,
            ctx,
            dom.canvas,
            dom.hud,
            { fps, ...dom.statsEls },
            dom.factionsList,
            gridLayer
          );
          requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);

        function pauseForBlur(reason) {
          if (world.pauseOnBlur && world.running) {
            world.running = false;
            dom.buttons.btnPause.disabled = true;
            dom.buttons.btnResume.disabled = false;
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
        window.addEventListener("blur", () =>
          pauseForBlur("window lost focus")
        );
        document.addEventListener("visibilitychange", () => {
          if (document.hidden) pauseForBlur("tab hidden");
        });
      });
  });
})();
