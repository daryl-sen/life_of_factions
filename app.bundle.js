(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/constants.js
  var CELL, GRID, WORLD_PX, CANVAS_PX, OFFSET, BASE_TICK_MS, TUNE, ACTION_DURATIONS, ACTION_BASE_ADDED, COLORS, FACTION_COLORS, LOG_CATS, ENERGY_CAP;
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
          reproduce: 1.2
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
        // “small, periodic” attempt when well-fed
        factionThreshold: 0.5,
        factionMinSize: 2,
        energyLowThreshold: 40,
        // override threshold
        foodPlanThreshold: 70,
        // seek food only when below this
        lowEnergyExploreRange: 14,
        levelCap: 20,
        maxCrops: 150,
        reproduction: {
          relationshipThreshold: 0.1,
          relationshipEnergy: 85
        },
        helpConvertChance: 0.5,
        // 50% by default
        helpConvertRelThreshold: 0.4
        // "good relationship" threshold
      };
      ACTION_DURATIONS = {
        talk: [900, 1800],
        quarrel: [900, 1800],
        attack: [450, 900],
        // faster attacks
        heal: [900, 1800],
        help: [900, 1800],
        attack_wall: [1e3, 2e3],
        attack_flag: [1e3, 2e3],
        reproduce: [2e3, 3200]
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
        grid: "#1a1e3f"
      };
      FACTION_COLORS = [
        "#ff5252",
        "#42a5f5",
        "#66bb6a",
        "#ffa726",
        "#ab47bc",
        "#26c6da",
        "#ec407a",
        "#8d6e63"
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
        "info"
      ];
    }
  });

  // js/utils.js
  var rnd, rndi, clamp, key, fromKey, manhattan, name6, RingLog;
  var init_utils = __esm({
    "js/utils.js"() {
      rnd = (a, b) => Math.random() * (b - a) + a;
      rndi = (a, b) => Math.floor(rnd(a, b + 1));
      clamp = (v, min, max) => v < min ? min : v > max ? max : v;
      key = (x, y) => `${x},${y}`;
      fromKey = (k) => {
        const [x, y] = k.split(",").map(Number);
        return { x, y };
      };
      manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
      name6 = () => Array.from(
        { length: 6 },
        () => Math.random() < 0.5 ? String.fromCharCode(65 + rndi(0, 25)) : String(rndi(0, 9))
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
            return x.actorId === agentId || to === agentId || targetId === agentId;
          });
        }
      };
    }
  });

  // js/systems/spatial.js
  function isBlocked(world, x, y, ignoreId = null) {
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
  var init_spatial = __esm({
    "js/systems/spatial.js"() {
      init_constants();
      init_utils();
    }
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
        const shareTotal = TUNE.cropGain * 0.3; // share 30% of gain
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
    }
  });

  // js/pathfinding.js
  function astar(start, goal, isBlocked2) {
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = /* @__PURE__ */ new Map(), came = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map();
    const sk = (x, y) => key(x, y);
    const neighbors = (x, y) => [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ].filter(
      ([nx, ny]) => nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && !isBlocked2(nx, ny)
    );
    const sK = sk(start.x, start.y);
    g.set(sK, 0);
    f.set(sK, h(start.x, start.y));
    open.set(sK, [start.x, start.y]);
    while (open.size) {
      let currentKey = null, current = null, best = Infinity;
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
        const nk = sk(nx, ny), tentative = (g.get(currentKey) ?? Infinity) + 1;
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
    }
  });

  // js/systems/building.js
  function tryBuildWall(world, a) {
    if (Math.random() >= TUNE.buildWallChance) return;
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1]
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
      maxHp: TUNE.wallHp[1]
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
      [a.cellX, a.cellY - 1]
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
    }
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
    tryStartAction: () => tryStartAction
  });
  function planPathTo(world, a, gx, gy) {
    const path = astar(
      { x: a.cellX, y: a.cellY },
      { x: gx, y: gy },
      (x, y) => isBlocked(world, x, y, a.id)
    );
    a.path = path;
    a.pathIdx = 0;
  }
  function findNearest(world, a, coll) {
    let best = null, bestD = 1e9;
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
      payload
    };
    return true;
  }
  function lockAgent(world, id, ms) {
    const ag = world.agentsById.get(id);
    if (!ag) return;
    ag.lockMsRemaining = Math.max(ag.lockMsRemaining || 0, ms);
  }

  // NEW: aggression & cooperation-driven interaction chooser
  function chooseAttack(world, a) {
    // Look for attack candidates in range <=2 (prefer different faction / low relation)
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
    const hasEnemyNearby = candidates.some(
      (b) => a.factionId && b.factionId && a.factionId !== b.factionId
    );
    const p = clamp(a.aggression + (hasEnemyNearby ? 0.25 : 0), 0, 1);
    if (Math.random() >= p) return false;
    candidates.sort((b1, b2) => {
      const f1 = a.factionId && b1.factionId && a.factionId !== b1.factionId ? -0.5 : 0;
      const f2 = a.factionId && b2.factionId && a.factionId !== b2.factionId ? -0.5 : 0;
      return (getRel(a, b1.id) + f1) - (getRel(a, b2.id) + f2);
    });
    const target = candidates[0];
    if (tryStartAction(a, "attack", { targetId: target.id })) return true;
    return false;
  }
  function chooseHelpHealTalk(world, a) {
    // Only consider neighbors at distance 1
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1]
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
      // Prefer same-faction targets
      const sorted = neighbors.slice().sort((b1, b2) => {
        const same1 = a.factionId && b1.factionId && a.factionId === b1.factionId ? -0.3 : 0;
        const same2 = a.factionId && b2.factionId && a.factionId === b2.factionId ? -0.3 : 0;
        const need1 = (b1.health / b1.maxHealth) < (b2.health / b2.maxHealth) ? -0.2 : 0.2;
        return same1 + need1 - (same2 + ((b2.health / b2.maxHealth) < (b1.health / b1.maxHealth) ? -0.2 : 0.2));
      });
      const targ = sorted[0];
      // Pick heal if target needs HP, else help
      const doHeal = (targ.health < targ.maxHealth * 0.85);
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

    // Reproduction attempt first when adjacent partner available (unchanged)
    for (const [nx, ny] of [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1]
    ]) {
      const id = world.agentsByCell.get(key(nx, ny));
      if (!id) continue;
      const b = world.agentsById.get(id);
      const rel = getRel(a, b.id);
      if (rel >= TUNE.reproduction.relationshipThreshold && a.energy >= TUNE.reproduction.relationshipEnergy && b.energy >= TUNE.reproduction.relationshipEnergy) {
        if (tryStartAction(a, "reproduce", { targetId: b.id })) {
          const dur = a.action.remainingMs, reserve = 4;
          a.energy -= reserve;
          b.energy -= reserve;
          lockAgent(world, a.id, dur);
          lockAgent(world, b.id, dur);
          return;
        }
      }
    }

    // Aggression / cooperation driven choices
    if (chooseAttack(world, a)) return;
    if (chooseHelpHealTalk(world, a)) return;

    // If nothing chosen, no interaction this time
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
    const targ = act.payload?.targetId ? world.agentsById.get(act.payload.targetId) : null;
    if (targ) {
      const dist = manhattan(a.cellX, a.cellY, targ.cellX, targ.cellY);
      if (act.type === "attack") {
        if (dist > 2) {
          a.action = null;
          return;
        }
      } else {
        // Ensure non-attack actions only within 1 block
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
        log(world, "attack", `${a.name} hit ${targ.name}`, a.id, { to: targ.id });

        // Same-faction infighting: 20% chance lower-level leaves faction
        if (a.factionId && targ.factionId && a.factionId === targ.factionId && Math.random() < 0.2) {
          let quitter = a;
          if (targ.level < a.level) quitter = targ;
          else if (targ.level === a.level) quitter = Math.random() < 0.5 ? a : targ;
          const old = quitter.factionId;
          quitter.factionId = null;
          log(world, "faction", `${quitter.name} left faction ${old} after infighting`, quitter.id, { from: old, to: null });
          if (typeof recomputeFactions2 === "function") recomputeFactions2(world);
        }
      } else if (act.type === "attack_wall") {
        const wx = act.payload?.x, wy = act.payload?.y;
        const w = world.walls.get(key(wx, wy));
        if (w) {
          w.hp -= a.attack * 0.35;
          log(world, "attack_wall", `${a.name} damaged wall @${wx},${wy}`, a.id, { x: wx, y: wy });
        } else {
          a.action = null;
          return;
        }
      } else if (act.type === "heal" && targ) {
        targ.health = Math.min(targ.maxHealth, targ.health + 2);
        log(world, "heal", `${a.name} healed ${targ.name}`, a.id, { to: targ.id });
      } else if (act.type === "help" && targ) {
        // Give 20% if helper >70% energy, else 10%
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
        if (targ.action) {
          targ.action.remainingMs *= 0.9;
        }
      } else if (act.type === "quarrel" && targ) {
        const delta = (Math.random() < 0.5 ? -0.1 : 0.1) * (a.factionId === targ.factionId ? 0.6 : 1);
        setRel(a, targ.id, getRel(a, targ.id) + delta);
        setRel(targ, a.id, getRel(targ, a.id) + delta);
        log(
          world,
          "quarrel",
          `${a.name} ${delta > 0 ? "made peace with" : "argued with"} ${targ.name}`,
          a.id,
          { to: targ.id, delta }
        );
      } else if (act.type === "talk" && targ) {
        const delta = (Math.random() < 0.75 ? 0.14 : -0.06) * (a.factionId === targ.factionId ? 1.1 : 0.8);
        setRel(a, targ.id, getRel(a, targ.id) + delta);
        setRel(targ, a.id, getRel(targ, a.id) + delta);
        log(world, "talk", `${a.name} talked with ${targ.name}`, a.id, { to: targ.id, delta });
      }
    }
    if (act.remainingMs <= 0) {
      const targ2 = act.payload?.targetId ? world.agentsById.get(act.payload.targetId) : null;
      if (act.type === "reproduce" && targ2) {
        if (manhattan(a.cellX, a.cellY, targ2.cellX, targ2.cellY) === 1) {
          const spots = [
            [a.cellX + 1, a.cellY],
            [a.cellX - 1, a.cellY],
            [a.cellX, a.cellY + 1],
            [a.cellX, a.cellY - 1]
          ];
          const free = spots.find(([x, y]) => !isBlocked(world, x, y));
          if (free) {
            a.energy -= 12;
            targ2.energy -= 12;
            const [x, y] = free;
            const child = addAgentAt(world, x, y);
            child.energy = 60;
            child.health = 80;

            // Inherit aggression/cooperation (average + small noise)
            child.aggression = clamp((a.aggression + targ2.aggression) / 2 + rnd(-0.15, 0.15), 0, 1);
            child.cooperation = clamp((a.cooperation + targ2.cooperation) / 2 + rnd(-0.15, 0.15), 0, 1);
            child.travelPref = Math.random() < 0.5 ? a.travelPref : targ2.travelPref;

            // Child faction: choose randomly from parents' factions, or sole parent's faction
            const pa = a.factionId || null;
            const pb = targ2.factionId || null;
            let chosen = null;
            if (pa && pb) chosen = Math.random() < 0.5 ? pa : pb;
            else chosen = pa || pb;
            if (chosen) {
              child.factionId = chosen;
              const f = world.factions.get(chosen);
              const req = TUNE.factionThreshold + 0.05;
              if (f) {
                for (const mid of f.members) {
                  const m = world.agentsById.get(mid);
                  if (!m) continue;
                  setRel(child, mid, Math.max(getRel(child, mid), req));
                  setRel(m, child.id, Math.max(getRel(m, child.id), req));
                }
              } else {
                setRel(child, a.id, Math.max(getRel(child, a.id), req));
                setRel(a, child.id, Math.max(getRel(a, child.id), req));
                setRel(child, targ2.id, Math.max(getRel(child, targ2.id), req));
                setRel(targ2, child.id, Math.max(getRel(targ2, child.id), req));
              }
              log(world, "faction", `${child.name} joined faction ${chosen}`, child.id, { factionId: chosen });
            }
            log(world, "reproduce", `${a.name} & ${targ2.name} had ${child.name}`, a.id, { child: child.id });
          }
        }
      } else if (act.type === "help" && targ2) {
        // 70% chance to convert recipient to helper's faction, if helper has one
        if (a.factionId && Math.random() < 0.7) {
          const fid = a.factionId;
          const f = world.factions.get(fid);
          const req = TUNE.factionThreshold + 0.05;
          if (f) {
            for (const mid of f.members) {
              const m = world.agentsById.get(mid);
              if (!m) continue;
              setRel(targ2, mid, Math.max(getRel(targ2, mid), req));
              setRel(m, targ2.id, Math.max(getRel(m, targ2.id), req));
            }
          } else {
            setRel(targ2, a.id, Math.max(getRel(targ2, a.id), req));
            setRel(a, targ2.id, Math.max(getRel(a, targ2.id), req));
          }
          log(world, "faction", `${a.name} convinced ${targ2.name} to join ${fid}`, a.id, { to: targ2.id, factionId: fid });
          if (typeof recomputeFactions2 === "function") recomputeFactions2(world);
        }
      }
      a.action = null;
    }
  }

  function addAgentAt(world, x, y) {
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
      relationships: /* @__PURE__ */ new Map(),
      path: null,
      pathIdx: 0,
      action: null,
      lockMsRemaining: 0,
      // travel preference: "near" prefers to stay near faction flag, "far" prefers roaming away
      travelPref: Math.random() < 0.5 ? "near" : "far",
      // new behavioral traits
      aggression: Math.random(),   // 0..1
      cooperation: Math.random()   // 0..1
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
    const adj = [
      [a.cellX + 1, a.cellY],
      [a.cellX - 1, a.cellY],
      [a.cellX, a.cellY + 1],
      [a.cellX, a.cellY - 1]
    ];
    for (const [nx, ny] of adj) {
      if (world.crops.has(key(nx, ny))) {
        planPathTo(world, a, nx, ny);
        return;
      }
    }
    const near = findNearest(world, a, world.crops.values());
    if (near) {
      planPathTo(world, a, near.target.x, near.target.y);
      return;
    }
    if (world.farms.size) {
      let best = null, bestD = 1e9;
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
    if (world.crops.has(k) || world.walls.has(k) || world.farms.has(k))
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
      setRel = (a, bId, val) => a.relationships.set(bId, clamp(val, -1, 1));
    }
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
      this.flags = /* @__PURE__ */ new Map();
      this.agents = [];
      this.agentsById = /* @__PURE__ */ new Map();
      this.agentsByCell = /* @__PURE__ */ new Map();
      this.factions = /* @__PURE__ */ new Map();
      this.log = new RingLog(100);
      this.activeLogCats = new Set(LOG_CATS);
      this.activeLogAgentId;
      this.tick = 0;
      this.speedPct = 50;
      this.spawnMult = 1;
      this.running = false;
      this.selectedId = null;
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
  function drawTriangle(ctx, x, y) {
    const cx = x + CELL / 2, cy = y + CELL / 2;
    const r = CELL / 2 - 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx - r * 0.866, cy + r * 0.5);
    ctx.lineTo(cx + r * 0.866, cy + r * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  function render(world, ctx, canvas, hud, stats, factionsList) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      const x = a.cellX * CELL, y = a.cellY * CELL;
      ctx.fillStyle = COLORS.agentFill;
      const col = a.factionId ? world.factions.get(a.factionId)?.color || "#fff" : "#6b7280";
      drawAgentCircle(ctx, x, y, CELL / 2 - 3, col);
      const hpw = Math.max(0, Math.floor((CELL - 6) * (a.health / a.maxHealth)));
      ctx.fillStyle = COLORS.hp;
      ctx.fillRect(x + 3, y + 1, hpw, 2);
      if (a.energy < 40) {
        ctx.fillStyle = COLORS.energy;
        ctx.fillRect(x + CELL / 2 - 3, y - 5, 6, 3);
      }
    }
    ctx.restore();
    hud.textContent = `tick:${world.tick} | fps:${stats.fps.toFixed(0)} | agents:${world.agents.length}`;
    stats.stAgents.textContent = world.agents.length;
    stats.stFactions.textContent = world.factions.size;
    stats.stCrops.textContent = world.crops.size;
    stats.stFarms.textContent = world.farms.size;
    stats.stWalls.textContent = world.walls.size;
    stats.stFlags.textContent = world.flags.size;
    factionsList.innerHTML = "";
    for (const [fid, f] of world.factions) {
      const color = f.color || FACTION_COLORS[[...world.factions.keys()].indexOf(fid) % FACTION_COLORS.length];
      const div = document.createElement("div");
      const members = [...f.members].map((id) => world.agentsById.get(id)).filter(Boolean);
      const avgLvl = (members.reduce((s, a) => s + a.level, 0) / (members.length || 1)).toFixed(1);
      const flag = world.flags.get(fid);
      div.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin:6px 0">
      <div style="width:12px;height:12px;border-radius:3px;background:${color}"></div>
      <div class="mono" style="flex:1">${fid}</div>
    </div>
    <div class="kv">
      <div class="muted">Members</div><div>${members.length}</div>
      <div class="muted">Avg level</div><div>${avgLvl}</div>
      <div class="muted">Flag</div><div>${flag ? `${flag.x},${flag.y} (${flag.hp}/${flag.maxHp})` : "\u2014"}</div>
    </div>`;
      factionsList.appendChild(div);
    }
  }

  // js/ui.js
  init_constants();
  function qs(sel) {
    return document.querySelector(sel);
  }
  function bindDom() {
    const canvas = qs("#canvas"), hud = qs("#hud");
    const btnStart = qs("#btnStart"), btnPause = qs("#btnPause"), btnResume = qs("#btnResume");
    const rngAgents = qs("#rngAgents"), lblAgents = qs("#lblAgents");
    const rngSpeed = qs("#rngSpeed"), lblSpeed = qs("#lblSpeed");
    const rngSpawn = qs("#rngSpawn"), lblSpawn = qs("#lblSpawn");
    const numAgents = qs("#numAgents"), numSpeed = qs("#numSpeed"), numSpawn = qs("#numSpawn");
    const btnSpawnCrop = qs("#btnSpawnCrop");
    const stAgents = qs("#stAgents"), stFactions = qs("#stFactions"), stCrops = qs("#stCrops"), stFarms = qs("#stFarms"), stWalls = qs("#stWalls"), stFlags = qs("#stFlags");
    const factionsList = qs("#factionsList");
    const inspector = qs("#inspector"), logList = qs("#logList"), logFilters = qs("#logFilters");
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
      logFilters
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
          label: `${a.name} (${a.id.slice(0, 4)})`
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
    agentSelect.addEventListener("change", () => {
      world.activeLogAgentId = agentSelect.value || null;
      renderLog2();
    });
    agentRow.appendChild(agentLabel);
    agentRow.appendChild(agentSelect);
    logFilters.appendChild(agentRow);
    setInterval(rebuildAgentOptions, 1500);
    all.addEventListener("click", () => {
      world.activeLogCats = new Set(LOG_CATS);
      LOG_CATS.forEach(
        (cat) => logFilters.querySelector("#flt_" + cat).checked = true
      );
      renderLog2();
    });
    none.addEventListener("click", () => {
      world.activeLogCats.clear();
      LOG_CATS.forEach(
        (cat) => logFilters.querySelector("#flt_" + cat).checked = false
      );
      renderLog2();
    });
  }
  function renderLog(world, logList) {
    const items = world.log.list(world.activeLogCats, world.activeLogAgentId);
    logList.innerHTML = items.slice(-100).reverse().map((it) => {
      const cls =
        it.cat === "attack" || it.cat === "quarrel" || it.cat === "destroy" || it.cat === "death"
          ? "bad"
          : it.cat === "heal" || it.cat === "help" || it.cat === "faction" || it.cat === "level"
          ? "good"
          : "info";
      return `<div class="logItem"><span class="pill ${cls}">${it.cat}</span>${it.msg}</div>`;
    }).join("");
  }

  // js/systems/factions.js
  init_constants();
  init_utils();
  init_spatial();
  init_harvest();
  function recomputeFactions2(world) {
    const ids = world.agents.map((a) => a.id);
    const idx = new Map(ids.map((id, i) => [id, i]));
    const parent = ids.map((_, i) => i);
    const find = (i) => parent[i] === i ? i : parent[i] = find(parent[i]);
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
    const groups = /* @__PURE__ */ new Map();
    ids.forEach((id, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(id);
    });
    const newFactions = /* @__PURE__ */ new Map();
    let colorIdx = 0;
    for (const [, members] of groups) {
      if (members.length >= TUNE.factionMinSize) {
        const fid = members.slice().sort().join("|").slice(0, 8) + "-" + members.length;
        const color = FACTION_COLORS[colorIdx++ % FACTION_COLORS.length];
        newFactions.set(fid, { id: fid, members: new Set(members), color });
      }
    }

    // Update agent factionIds to match computed groups
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
        log(
          world,
          "faction",
          `${a.name} now ${newFid ? "in faction " + newFid : "factionless"}`,
          a.id,
          { from: old, to: newFid }
        );
      }
    }

    // Flags: keep existing; only create for factions missing a flag
    const nextFlags = /* @__PURE__ */ new Map();
    for (const [fid, f] of newFactions) {
      if (world.flags.has(fid)) {
        nextFlags.set(fid, world.flags.get(fid));
        continue; // don't spawn a new one if it already exists
      }
      // Place a new flag for newly formed faction only
      const cells = [...f.members].map((id) => world.agentsById.get(id)).map((a) => ({ x: a.cellX, y: a.cellY }));
      const cx = Math.round(cells.reduce((s, c) => s + c.x, 0) / cells.length);
      const cy = Math.round(cells.reduce((s, c) => s + c.y, 0) / cells.length);
      let spot = { x: cx, y: cy };
      if (isBlocked(world, cx, cy)) spot = randomFreeCell(world);
      nextFlags.set(fid, {
        id: crypto.randomUUID(),
        factionId: fid,
        x: spot.x,
        y: spot.y,
        hp: rndi(TUNE.flagHp[0], TUNE.flagHp[1]),
        maxHp: TUNE.flagHp[1]
      });
      log(world, "faction", `Faction ${fid} formed flag @${spot.x},${spot.y}`, null, { factionId: fid });
    }
    // carry over any flags for factions that no longer meet min size? -> remove them
    for (const [fid, fl] of world.flags) {
      if (newFactions.has(fid)) continue;
      // faction dissolved -> flag removed (logged below)
    }
    const prevFlags = new Set(world.flags.keys());
    world.flags = nextFlags;
    for (const fid of prevFlags) {
      if (!world.flags.has(fid))
        log(world, "destroy", `Flag ${fid} removed`, null, { factionId: fid });
    }

    // Store factions
    world.factions = /* @__PURE__ */ new Map();
    for (const [fid, f] of newFactions) {
      world.factions.set(fid, { id: fid, members: f.members, color: f.color });
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
    const base = 6e-3 * world.spawnMult;
    for (let i = 0; i < attempts; i++) {
      if (world.crops.size >= TUNE.maxCrops) break;
      const x = rndi(0, GRID - 1), y = rndi(0, GRID - 1);
      const k = key(x, y);
      if (world.crops.has(k) || world.walls.has(k) || world.farms.has(k) || world.agentsByCell.has(k))
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
    world.agents = world.agents.filter((a) => {
      if (a.health <= 0) {
        world.agentsByCell.delete(key(a.cellX, a.cellY));
        world.agentsById.delete(a.id);
        log(world, "death", `${a.name} died`, a.id, {});
        return false;
      }
      return true;
    });
    for (const [fid, f] of [...world.flags]) {
      if (f.hp <= 0 || !world.agents.some((a) => a.factionId === fid)) {
        world.flags.delete(fid);
        log(world, "destroy", `Flag ${fid} destroyed`, null, { factionId: fid });
      }
    }
    for (const [k, w] of [...world.walls]) {
      if (w.hp <= 0) {
        world.walls.delete(k);
        log(world, "destroy", `Wall @${w.x},${w.y} destroyed`, null, {});
      }
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
    function seedEnvironment() {
      for (let i = 0; i < 4; i++) {
        const x = rndi(5, 56), y = rndi(5, 56);
        world.farms.set(key(x, y), { id: crypto.randomUUID(), x, y });
      }
      for (let i = 0; i < 40; i++) {
        const x = rndi(0, 61), y = rndi(0, 61);
        const k = key(x, y);
        if (world.walls.has(k)) continue;
        world.walls.set(k, {
          id: crypto.randomUUID(),
          x,
          y,
          hp: rndi(TUNE.wallHp[0], TUNE.wallHp[1]),
          maxHp: TUNE.wallHp[1]
        });
      }
    }
    function addAgentAt2(x, y) {
      return processAction.addAgentAt ? processAction.addAgentAt : null;
    }
    function spawnAgents(n) {
      for (let i = 0; i < n; i++) {
        const { x, y } = randomFreeCell(world);
      }
    }
    Promise.resolve().then(() => (init_actions(), actions_exports)).then(({ addAgentAt: addAgentAt3 }) => {
      function spawnAgents2(n) {
        for (let i = 0; i < n; i++) {
          const { x, y } = randomFreeCell(world);
          addAgentAt3(world, x, y);
        }
      }
      const $clamp = (v, min, max) => isNaN(v) ? min : Math.max(min, Math.min(max, v));
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
        dom.labels.lblSpawn.textContent = Number(dom.ranges.rngSpawn.value).toFixed(1) + "\xD7";
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
        dom.labels.lblSpawn.textContent = v.toFixed(1) + "\xD7";
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
        world.activeLogCats = /* @__PURE__ */ new Set([...world.activeLogCats.values()]);
        setupLogFilters(world, dom.logFilters, doRenderLog);
        world.speedPct = Number(dom.ranges.rngSpeed.value);
        world.spawnMult = Number(dom.ranges.rngSpawn.value);
        seedEnvironment();
        spawnAgents2(Number(dom.ranges.rngAgents.value));
        world.running = true;
        dom.buttons.btnStart.disabled = true;
        dom.buttons.btnPause.disabled = false;
        dom.buttons.btnResume.disabled = true;
        world.log.push({
          t: performance.now(),
          cat: "info",
          msg: "Simulation started",
          actorId: null,
          extra: {}
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
      dom.canvas.addEventListener("click", (e) => {
        const rect = dom.canvas.getBoundingClientRect();
        const scaleX = dom.canvas.width / rect.width;
        const scaleY = dom.canvas.height / rect.height;
        const px = (e.clientX - rect.left) * scaleX - OFFSET;
        const py = (e.clientY - rect.top) * scaleY - OFFSET;
        const x = Math.floor(px / 16), y = Math.floor(py / 16);
        if (x < 0 || y < 0 || x >= 62 || y >= 62) return;
        const id = world.agentsByCell.get(key(x, y));
        world.selectedId = id || null;
        updateInspector(world, dom.inspector);
      });
      function updateInspector(world2, el) {
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
        el.innerHTML = `
        <div class="kv">
          <div class="muted">Name</div><div class="mono">${a.name}</div>
          <div class="muted">Faction</div><div>${a.factionId || "\u2014"}</div>
          <div class="muted">Level</div><div>${a.level}</div>
          <div class="muted">Attack</div><div>${a.attack.toFixed(1)}</div>
          <div class="muted">HP</div><div>${a.health.toFixed(1)} / ${a.maxHealth.toFixed(0)}</div>
          <div class="muted">Energy</div><div>${a.energy.toFixed(1)}</div>
          <div class="muted">Age (ticks)</div><div>${a.ageTicks}</div>
          <div class="muted">Relationships</div><div>${relCount}</div>
          <div class="muted">Travel Pref</div><div>${a.travelPref}</div>
          <div class="muted">Aggression</div><div>${a.aggression.toFixed(2)}</div>
          <div class="muted">Cooperation</div><div>${a.cooperation.toFixed(2)}</div>
          <div class="muted">Action</div><div>${a.action ? a.action.type : "\u2014"}</div>
          <div class="muted">Remaining</div><div>${a.action ? (a.action.remainingMs / 1e3).toFixed(1) + "s" : "\u2014"}</div>
        </div>`;
      }
      setInterval(() => {
        updateInspector(world, dom.inspector);
        doRenderLog();
      }, 400);
      let lastTs = 0, acc = 0, fps = 0, fpsAcc = 0, fpsCount = 0;

      function isTrappedByWalls(world2, a) {
        const adj = [
          [a.cellX + 1, a.cellY],
          [a.cellX - 1, a.cellY],
          [a.cellX, a.cellY + 1],
          [a.cellX, a.cellY - 1]
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
          [a.cellX, a.cellY - 1]
        ];
        const walls = neighbors.filter(([nx, ny]) => world2.walls.has(key(nx, ny)));
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
          if (!isBlocked(world2, rx, ry, a.id)) candidates.push({ x: rx, y: ry });
        }
        if (!candidates.length) return;
        let choice = candidates[rndi(0, candidates.length - 1)];
        if (a.factionId) {
          const flag = world2.flags.get(a.factionId);
          if (flag) {
            const dist = (c) => Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y);
            if (a.travelPref === "near") {
              choice = candidates.reduce((best, c) => dist(c) < dist(best) ? c : best, candidates[0]);
            } else if (a.travelPref === "far") {
              choice = candidates.reduce((best, c) => dist(c) > dist(best) ? c : best, candidates[0]);
            }
          }
        }
        planPathTo(world2, a, choice.x, choice.y);
      }

      function updateTick() {
        world.tick++;
        maybeSpawnCrops(world);
        const underAttack = /* @__PURE__ */ new Set();
        for (const b of world.agents) {
          if (b.action && b.action.type === "attack" && b.action.payload?.targetId) {
            underAttack.add(b.action.payload.targetId);
          }
        }
        for (const a of world.agents) {
          a.ageTicks++;
          a.energy -= 0.01;
          a.lockMsRemaining = Math.max(0, (a.lockMsRemaining || 0) - BASE_TICK_MS);

          // Priority: if trapped by walls, attack a wall to escape
          if (!a.action && a.lockMsRemaining <= 0) startAttackWallIfTrapped(world, a);

          const energyHigh = a.energy >= ENERGY_CAP * 0.7; // >= 140
          const energyOkay = a.energy >= ENERGY_CAP * 0.3; // >= 60

          if (a.energy < TUNE.energyLowThreshold) {
            if (a.action && a.action.type !== "reproduce") a.action = null;
          }

          if (a.action) {
            processAction(world, a, BASE_TICK_MS);
          } else {
            const locked = a.lockMsRemaining > 0 && !underAttack.has(a.id);
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
                  // < 30%: prioritize harvesting
                  if (world.crops.has(key(a.cellX, a.cellY))) {
                    harvestAt(world, a, a.cellX, a.cellY);
                  } else {
                    seekFoodWhenHungry(world, a);
                  }
                } else {
                  // >= 30%: interactions
                  if (energyHigh) {
                    considerInteract(world, a); // reproduction possible
                  } else {
                    considerInteract(world, a);
                  }
                  if (!a.path && !a.action) {
                    biasedRoam(world, a);
                  }
                }
              }

              if (Math.random() < 0.02) tryBuildWall(world, a);
              if (a.energy >= 120 && Math.random() < 0.01) tryBuildFarm(world, a);
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
        if (world.tick % 25 === 0) recomputeFactions2(world);
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
          fps = 1e3 / (fpsAcc / fpsCount);
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
})();
