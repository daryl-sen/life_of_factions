"use strict";
(() => {
  // src/shared/constants.ts
  var CELL = 16;
  var GRID = 62;
  var WORLD_PX = GRID * CELL;
  var BASE_TICK_MS = 250;
  var ENERGY_CAP = 200;
  var TUNE = {
    moveEnergy: 0.12,
    actionCost: {
      talk: 0.4,
      quarrel: 0.8,
      attack: 2.2,
      heal: 3,
      help: 1.6,
      attack_flag: 2,
      reproduce: 3
    },
    cropGain: 28,
    starveHpPerSec: 1,
    regenHpPerSec: 0.5,
    healAuraRadius: 4,
    healAuraPerTick: 3.75,
    baseDamage: 8,
    flagHp: [12, 18],
    farmBoostRadius: 3,
    farmEnergyCost: 12,
    buildFarmChance: 0.03125,
    factionThreshold: 0.5,
    factionMinSize: 2,
    factionFormRelThreshold: 0.6,
    helpConvertChance: 0.5,
    helpConvertRelThreshold: 0.4,
    energyLowThreshold: 40,
    levelCap: 20,
    maxCrops: 100,
    reproduction: { relationshipThreshold: 0.1, relationshipEnergy: 85 },
    pathBudgetPerTick: 30
  };
  var ACTION_DURATIONS = {
    talk: [900, 1800],
    quarrel: [900, 1800],
    attack: [450, 900],
    heal: [900, 1800],
    help: [900, 1800],
    attack_flag: [1e3, 2e3],
    reproduce: [2e3, 3200]
  };
  var COLORS = {
    agentFill: "#e6e9ff",
    crop: "#3adf7e",
    farm: "#edd65a",
    wall: "#9aa2d6",
    wallDam: "#ff7b8b",
    flagPole: "#c7c7d2",
    hp: "#60e6a8",
    energy: "#7bdcff",
    grid: "#1a1e3f",
    attackLine: "#ff6d7a"
  };
  var FACTION_COLORS = [
    "#ff5252",
    "#42a5f5",
    "#66bb6a",
    "#ffa726",
    "#ab47bc",
    "#26c6da",
    "#ec407a",
    "#8d6e63"
  ];
  var AGENT_EMOJIS = {
    talk: "\u{1F604}",
    quarrel: "\u{1F624}",
    attack: "\u{1F621}",
    heal: "\u{1F917}",
    help: "\u{1FAE2}",
    reproduce: "\u{1F60D}"
  };
  var IDLE_EMOJIS = {
    lowEnergy: "\u{1F924}",
    lowHealth: "\u{1F915}",
    highEnergy: "\u{1F600}",
    default: "\u{1F642}"
  };
  var WORLD_EMOJIS = {
    crops: ["\u{1F33F}", "\u{1F331}", "\u{1F340}", "\u{1F33E}", "\u{1F955}", "\u{1F345}", "\u{1FADB}"],
    farm: "\u{1F3E1}",
    wall: "\u{1FAA8}",
    flag: "\u{1F6A9}"
  };
  var LOG_CATS = [
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
    "info"
  ];

  // package.json
  var package_default = {
    name: "emoji-life",
    version: "3.1.1",
    private: true,
    scripts: {
      build: "esbuild src/main.ts --bundle --outfile=dist/app.js",
      serve: "npx serve .",
      typecheck: "tsc --noEmit"
    },
    devDependencies: {
      esbuild: "^0.27.4",
      typescript: "^6.0.2"
    }
  };

  // src/shared/version.ts
  var VERSION = package_default.version;

  // src/shared/utils.ts
  var rnd = (a, b) => Math.random() * (b - a) + a;
  var rndi = (a, b) => Math.floor(rnd(a, b + 1));
  var clamp = (v, min, max) => v < min ? min : v > max ? max : v;
  var key = (x, y) => `${x},${y}`;
  var fromKey = (k) => {
    const [x, y] = k.split(",").map(Number);
    return { x, y };
  };
  var manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  var uuid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "x_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  var generatePronounceableString = (length) => {
    const consonants = "BCDFGHJKLMNPQRSTVWXYZ";
    const vowels = "AEIOU";
    let result = "";
    const startWithConsonant = Math.random() < 0.5;
    for (let i = 0; i < length; i++) {
      if (i % 2 === 0 && startWithConsonant || i % 2 !== 0 && !startWithConsonant) {
        result += consonants.charAt(Math.floor(Math.random() * consonants.length));
      } else {
        result += vowels.charAt(Math.floor(Math.random() * vowels.length));
      }
    }
    return result;
  };
  var RingLog = class {
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
  var getIdleEmoji = (a) => {
    if (a.energy <= 20) return IDLE_EMOJIS.lowEnergy;
    if (a.health <= 30) return IDLE_EMOJIS.lowHealth;
    if (a.energy >= 80) return IDLE_EMOJIS.highEnergy;
    return IDLE_EMOJIS.default;
  };
  var log = (world, cat, msg, actorId = null, extra = {}) => {
    world.log.push({ t: performance.now(), cat, msg, actorId, extra });
  };

  // src/domains/world/grid.ts
  var Grid = class {
    constructor() {
      this.size = GRID;
      this.walls = /* @__PURE__ */ new Map();
      this.crops = /* @__PURE__ */ new Map();
      this.farms = /* @__PURE__ */ new Map();
      this.flags = /* @__PURE__ */ new Map();
      this.flagCells = /* @__PURE__ */ new Set();
      this.agentsByCell = /* @__PURE__ */ new Map();
    }
    isBlocked(x, y, ignoreId = null) {
      if (x < 0 || y < 0 || x >= this.size || y >= this.size) return true;
      const k = key(x, y);
      if (this.walls.has(k)) return true;
      if (this.farms.has(k)) return true;
      if (this.flagCells.has(k)) return true;
      const occ = this.agentsByCell.get(k);
      if (occ && occ !== ignoreId) return true;
      return false;
    }
    randomFreeCell() {
      for (let tries = 0; tries < 5e3; tries++) {
        const x = Math.floor(Math.random() * this.size);
        const y = Math.floor(Math.random() * this.size);
        if (!this.isBlocked(x, y)) return { x, y };
      }
      return { x: 0, y: 0 };
    }
    clear() {
      this.walls.clear();
      this.crops.clear();
      this.farms.clear();
      this.flags.clear();
      this.flagCells.clear();
      this.agentsByCell.clear();
    }
  };

  // src/domains/world/food-field.ts
  var FF_INF = 65535;
  var ffIdx = (x, y) => y * GRID + x;
  var FoodField = class {
    constructor() {
      this._lastTick = -1;
      const N = GRID * GRID;
      this.data = new Uint16Array(N);
      this.data.fill(FF_INF);
    }
    get lastTick() {
      return this._lastTick;
    }
    recompute(grid, tick) {
      const N = GRID * GRID;
      this.data.fill(FF_INF);
      if (grid.crops.size === 0) {
        this._lastTick = tick;
        return;
      }
      const staticBlocked = (x, y) => {
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
        const k = key(x, y);
        if (grid.walls.has(k)) return true;
        if (grid.farms.has(k)) return true;
        if (grid.flagCells.has(k)) return true;
        return false;
      };
      const qx = new Int16Array(N);
      const qy = new Int16Array(N);
      let head = 0;
      let tail = 0;
      for (const c of grid.crops.values()) {
        const i = ffIdx(c.x, c.y);
        this.data[i] = 0;
        qx[tail] = c.x;
        qy[tail] = c.y;
        tail++;
      }
      while (head < tail) {
        const x = qx[head];
        const y = qy[head];
        head++;
        const d0 = this.data[ffIdx(x, y)];
        const nbrs = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1]
        ];
        for (const [nx, ny] of nbrs) {
          if (staticBlocked(nx, ny)) continue;
          const ii = ffIdx(nx, ny);
          if (this.data[ii] > d0 + 1) {
            this.data[ii] = d0 + 1;
            qx[tail] = nx;
            qy[tail] = ny;
            tail++;
          }
        }
      }
      this._lastTick = tick;
    }
    distanceAt(x, y) {
      return this.data[ffIdx(x, y)];
    }
    static {
      this.INF = FF_INF;
    }
  };

  // src/domains/world/world.ts
  var World = class {
    constructor() {
      this.grid = new Grid();
      this.foodField = new FoodField();
      this.agents = [];
      this.agentsById = /* @__PURE__ */ new Map();
      this.factions = /* @__PURE__ */ new Map();
      this.log = new RingLog(200);
      this.activeLogCats = new Set(LOG_CATS);
      this.activeLogAgentId = null;
      this.tick = 0;
      this.speedPct = 50;
      this.spawnMult = 1;
      this.running = false;
      this.selectedId = null;
      this.paintMode = "none";
      this.pauseOnBlur = false;
      this.drawGrid = false;
      this.pathBudgetMax = Number.isFinite(TUNE.pathBudgetPerTick) ? TUNE.pathBudgetPerTick : 30;
      this.pathBudget = 0;
      this._pathRR = 0;
      this._pathWhitelist = /* @__PURE__ */ new Set();
      this._lastFactionsDomAt = 0;
      this._lastAgentCount = 0;
      this._rebuildAgentOptions = null;
      this._lastFactionsSig = "";
    }
    // Convenience accessors that delegate to grid
    get walls() {
      return this.grid.walls;
    }
    get crops() {
      return this.grid.crops;
    }
    get farms() {
      return this.grid.farms;
    }
    get flags() {
      return this.grid.flags;
    }
    get flagCells() {
      return this.grid.flagCells;
    }
    get agentsByCell() {
      return this.grid.agentsByCell;
    }
  };

  // src/domains/rendering/camera.ts
  var Camera = class {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.scale = 1;
      this.min = 0.25;
      this.max = 4;
      this.viewW = 0;
      this.viewH = 0;
    }
    screenToWorld(sx, sy) {
      return { x: sx / this.scale + this.x, y: sy / this.scale + this.y };
    }
    zoomAt(sx, sy, factor) {
      const w = this.screenToWorld(sx, sy);
      this.scale = clamp(this.scale * factor, this.min, this.max);
      this.x = w.x - sx / this.scale;
      this.y = w.y - sy / this.scale;
    }
    panBy(dx, dy) {
      this.x += dx / this.scale;
      this.y += dy / this.scale;
      const slack = 40;
      const vw = this.viewW || window.innerWidth;
      const vh = this.viewH || window.innerHeight;
      this.x = clamp(this.x, -slack, WORLD_PX + slack - vw / this.scale);
      this.y = clamp(this.y, -slack, WORLD_PX + slack - vh / this.scale);
    }
    fitToCanvas(canvas) {
      this.scale = clamp(
        Math.min(canvas.width / WORLD_PX, canvas.height / WORLD_PX),
        this.min,
        this.max
      );
      this.x = (WORLD_PX - canvas.width / this.scale) / 2;
      this.y = (WORLD_PX - canvas.height / this.scale) / 2;
      this.panBy(0, 0);
    }
    static setCanvasSize(canvas) {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const style = getComputedStyle(canvas);
      const cw = parseFloat(style.width) || window.innerWidth;
      const ch = parseFloat(style.height) || window.innerHeight;
      const w = Math.floor(cw * dpr);
      const h = Math.floor(ch * dpr);
      canvas.width = w;
      canvas.height = h;
      return { w, h, dpr, cw, ch };
    }
  };

  // src/domains/rendering/emoji-cache.ts
  var EmojiCache = class {
    constructor() {
      this._cache = /* @__PURE__ */ new Map();
      this._tintCache = /* @__PURE__ */ new Map();
    }
    get(emoji) {
      if (this._cache.has(emoji)) return this._cache.get(emoji);
      const pad = 64;
      const fontSize = 48;
      const tmp = document.createElement("canvas");
      tmp.width = pad * 2;
      tmp.height = pad * 2;
      const tc = tmp.getContext("2d");
      tc.font = `${fontSize}px serif`;
      tc.textAlign = "center";
      tc.textBaseline = "middle";
      tc.fillText(emoji, pad, pad);
      const imgData = tc.getImageData(0, 0, tmp.width, tmp.height);
      const d = imgData.data;
      let top = tmp.height, bottom = 0, left = tmp.width, right = 0;
      for (let py = 0; py < tmp.height; py++) {
        for (let px = 0; px < tmp.width; px++) {
          if (d[(py * tmp.width + px) * 4 + 3] > 10) {
            if (py < top) top = py;
            if (py > bottom) bottom = py;
            if (px < left) left = px;
            if (px > right) right = px;
          }
        }
      }
      const w = right - left + 1;
      const h = bottom - top + 1;
      const trimmed = document.createElement("canvas");
      trimmed.width = w;
      trimmed.height = h;
      trimmed.getContext("2d").drawImage(tmp, left, top, w, h, 0, 0, w, h);
      const entry = { canvas: trimmed, w, h };
      this._cache.set(emoji, entry);
      return entry;
    }
    getTinted(emoji, color) {
      const cacheKey = emoji + color;
      if (this._tintCache.has(cacheKey)) return this._tintCache.get(cacheKey);
      const src = this.get(emoji);
      const c = document.createElement("canvas");
      c.width = src.w;
      c.height = src.h;
      const cx = c.getContext("2d");
      cx.drawImage(src.canvas, 0, 0);
      cx.globalCompositeOperation = "source-in";
      cx.fillStyle = color;
      cx.fillRect(0, 0, c.width, c.height);
      const entry = { canvas: c, w: src.w, h: src.h };
      this._tintCache.set(cacheKey, entry);
      return entry;
    }
  };

  // src/domains/rendering/renderer.ts
  var Renderer = class {
    constructor() {
      this._emojiCache = new EmojiCache();
    }
    render(world, ctx, canvas, camera) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(
        camera.scale,
        0,
        0,
        camera.scale,
        -camera.x * camera.scale,
        -camera.y * camera.scale
      );
      if (world.drawGrid) this._drawGrid(ctx, camera);
      this._drawCrops(ctx, world);
      this._drawFarms(ctx, world);
      this._drawWalls(ctx, world);
      this._drawFlags(ctx, world);
      const pendingAttackLines = [];
      this._drawAgents(ctx, world, pendingAttackLines);
      this._drawAttackLines(ctx, camera, pendingAttackLines);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    _drawGrid(ctx, camera) {
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
    _drawCellEmoji(ctx, cellX, cellY, emoji, size = CELL - 2) {
      const { canvas: ec, w, h } = this._emojiCache.get(emoji);
      const scale = Math.min(size / w, size / h);
      const dw = w * scale;
      const dh = h * scale;
      const x = cellX * CELL;
      const y = cellY * CELL;
      ctx.drawImage(ec, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh);
    }
    _drawCrops(ctx, world) {
      for (const c of world.crops.values())
        this._drawCellEmoji(ctx, c.x, c.y, c.emoji || WORLD_EMOJIS.crops[0]);
    }
    _drawFarms(ctx, world) {
      for (const f of world.farms.values())
        this._drawCellEmoji(ctx, f.x, f.y, WORLD_EMOJIS.farm);
    }
    _drawWalls(ctx, world) {
      for (const w of world.walls.values()) {
        const dmg = 1 - w.hp / w.maxHp;
        ctx.globalAlpha = dmg > 0 ? 1 - Math.min(0.7, dmg) : 1;
        this._drawCellEmoji(ctx, w.x, w.y, WORLD_EMOJIS.wall);
        ctx.globalAlpha = 1;
      }
    }
    _drawFlags(ctx, world) {
      for (const f of world.flags.values()) {
        const faction = world.factions.get(f.factionId);
        const col = faction?.color || "#cccccc";
        const { canvas: ec, w, h } = this._emojiCache.getTinted(WORLD_EMOJIS.flag, col);
        const scale = Math.min((CELL - 2) / w, (CELL - 2) / h);
        const dw = w * scale;
        const dh = h * scale;
        const x = f.x * CELL;
        const y = f.y * CELL;
        ctx.drawImage(ec, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh);
      }
    }
    _drawAgents(ctx, world, attackLines) {
      for (const agent of world.agents) {
        const t = agent.lerpT != null ? agent.lerpT : 1;
        const px = agent.prevCellX != null ? agent.prevCellX : agent.cellX;
        const py = agent.prevCellY != null ? agent.prevCellY : agent.cellY;
        const lx = px + (agent.cellX - px) * t;
        const ly = py + (agent.cellY - py) * t;
        const x = lx * CELL;
        const y = ly * CELL;
        const col = agent.factionId ? world.factions.get(agent.factionId)?.color || "#fff" : "#6b7280";
        const actionType = agent.action?.type;
        const emoji = AGENT_EMOJIS[actionType] || getIdleEmoji(agent);
        this._drawAgentEmoji(ctx, x, y, CELL / 2 - 3, col, emoji);
        const hpw = Math.max(0, Math.floor((CELL - 6) * (agent.health / agent.maxHealth)));
        ctx.fillStyle = COLORS.hp;
        ctx.fillRect(x + 3, y - 4, hpw, 2);
        if (agent.action?.type === "attack" && agent.action.payload?.targetId) {
          const t2 = world.agentsById.get(agent.action.payload.targetId);
          if (t2) attackLines.push([agent, t2]);
        }
        if (world.selectedId === agent.id) this._drawStar(ctx, x + CELL / 2, y - 16);
      }
    }
    _drawAgentEmoji(ctx, x, y, radius, stroke, emoji) {
      ctx.beginPath();
      ctx.arc(x + CELL / 2, y + CELL / 2, radius + 1, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      const { canvas: ec, w, h } = this._emojiCache.get(emoji);
      const drawSize = CELL - 4;
      const scale = Math.min(drawSize / w, drawSize / h);
      const dw = w * scale;
      const dh = h * scale;
      ctx.drawImage(ec, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh);
    }
    _drawStar(ctx, cx, cy) {
      const spikes = 5, outer = 6, inner = 3.2;
      let rot = Math.PI / 2 * 3;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy - outer);
      for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outer;
        let y = cy + Math.sin(rot) * outer;
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
    _drawAttackLines(ctx, camera, lines) {
      ctx.strokeStyle = COLORS.attackLine;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1 / camera.scale;
      for (const [att, tgt] of lines) {
        const at = att.lerpT != null ? att.lerpT : 1;
        const ax = ((att.prevCellX ?? att.cellX) + (att.cellX - (att.prevCellX ?? att.cellX)) * at) * CELL + CELL / 2;
        const ay = ((att.prevCellY ?? att.cellY) + (att.cellY - (att.prevCellY ?? att.cellY)) * at) * CELL + CELL / 2;
        const tt = tgt.lerpT != null ? tgt.lerpT : 1;
        const tx = ((tgt.prevCellX ?? tgt.cellX) + (tgt.cellX - (tgt.prevCellX ?? tgt.cellX)) * tt) * CELL + CELL / 2;
        const ty = ((tgt.prevCellY ?? tgt.cellY) + (tgt.cellY - (tgt.prevCellY ?? tgt.cellY)) * tt) * CELL + CELL / 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  };

  // src/domains/ui/ui-manager.ts
  var PAGE_LOAD_TIME = Date.now() - performance.now();
  function qs(sel) {
    return document.querySelector(sel);
  }
  var CAT_ICONS = {
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
    info: "\u{1F4E1}"
  };
  function catClass(cat) {
    if (cat === "attack" || cat === "quarrel" || cat === "destroy" || cat === "death") return "cat-bad";
    if (cat === "heal" || cat === "help" || cat === "faction" || cat === "level") return "cat-good";
    if (cat === "reproduce" || cat === "spawn" || cat === "build") return "cat-warn";
    return "cat-info";
  }
  function formatTime(t) {
    const d = new Date(PAGE_LOAD_TIME + t);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  var UIManager = class _UIManager {
    static bindDom() {
      return {
        canvas: qs("#canvas"),
        hud: qs("#hud"),
        buttons: {
          btnStart: qs("#btnStart"),
          btnPause: qs("#btnPause"),
          btnResume: qs("#btnResume"),
          btnSpawnCrop: qs("#btnSpawnCrop"),
          btnDrawWalls: qs("#btnDrawWalls"),
          btnEraseWalls: qs("#btnEraseWalls"),
          btnSave: qs("#btnSave"),
          btnLoad: qs("#btnLoad")
        },
        fileLoad: qs("#fileLoad"),
        ranges: {
          rngAgents: qs("#rngAgents"),
          rngSpeed: qs("#rngSpeed"),
          rngSpawn: qs("#rngSpawn")
        },
        labels: {
          lblAgents: qs("#lblAgents"),
          lblSpeed: qs("#lblSpeed"),
          lblSpawn: qs("#lblSpawn")
        },
        nums: {
          numAgents: qs("#numAgents"),
          numSpeed: qs("#numSpeed"),
          numSpawn: qs("#numSpawn")
        },
        statsEls: {
          stAgents: qs("#stAgents"),
          stFactions: qs("#stFactions"),
          stCrops: qs("#stCrops"),
          stFarms: qs("#stFarms"),
          stWalls: qs("#stWalls"),
          stFlags: qs("#stFlags")
        },
        barEls: {
          barAgents: qs("#barAgents"),
          barFactions: qs("#barFactions"),
          barCrops: qs("#barCrops")
        },
        factionsList: qs("#factionsList"),
        inspector: qs("#inspector"),
        logList: qs("#logList"),
        logFilters: qs("#logFilters"),
        pauseChk: qs("#cbPauseOnBlur"),
        gridChk: qs("#cbDrawGrid")
      };
    }
    static renderLog(world, logList) {
      if (!world || !world.log || !logList) return;
      const items = world.log.list(world.activeLogCats, world.activeLogAgentId);
      logList.innerHTML = items.slice(-100).reverse().map((it) => {
        const cls = catClass(it.cat);
        const icon = CAT_ICONS[it.cat] || "";
        const time = formatTime(it.t);
        return `<div class="log-entry ${cls}">
          <div class="log-entry-time"><span class="log-entry-icon">${icon}</span>${time}</div>
          <div class="log-entry-msg">${it.msg}</div>
        </div>`;
      }).join("");
    }
    static setupLogFilters(world, logFilters, renderLogFn) {
      if (!logFilters) return;
      logFilters.innerHTML = "";
      const allPill = document.createElement("button");
      allPill.className = "filter-pill active";
      allPill.textContent = "ALL";
      logFilters.appendChild(allPill);
      const pills = /* @__PURE__ */ new Map();
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
          allPill.classList.toggle("active", world.activeLogCats.size === LOG_CATS.length);
          renderLogFn();
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
        renderLogFn();
      });
      const agentSelect = qs("#agentFilterSelect");
      if (agentSelect) {
        const rebuildAgentOptions = () => {
          const cur = world.activeLogAgentId;
          const opts = [{ value: "", label: "All Agents" }].concat(
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
        world._rebuildAgentOptions = rebuildAgentOptions;
        agentSelect.addEventListener("change", () => {
          world.activeLogAgentId = agentSelect.value || null;
          renderLogFn();
        });
      }
    }
    static renderHUD(world, hud, stats) {
      if (!hud) return;
      const fps = stats.fps || 0;
      hud.textContent = `TICK:${world.tick}  |  FPS:${fps.toFixed(0)}  |  AGENTS:${world.agents.length}`;
      const s = stats;
      if (s.stAgents) s.stAgents.textContent = String(world.agents.length);
      if (s.stFactions) s.stFactions.textContent = String(world.factions.size);
      if (s.stCrops) s.stCrops.textContent = String(world.crops.size);
      if (s.stFarms) s.stFarms.textContent = String(world.farms.size);
      if (s.stWalls) s.stWalls.textContent = String(world.walls.size);
      if (s.stFlags) s.stFlags.textContent = String(world.flags.size);
      if (s.barAgents) s.barAgents.textContent = String(world.agents.length).padStart(2, "0");
      if (s.barFactions) s.barFactions.textContent = String(world.factions.size).padStart(2, "0");
      if (s.barCrops) s.barCrops.textContent = String(world.crops.size).padStart(2, "0");
    }
    static rebuildFactionsListIfNeeded(world, factionsList) {
      if (!factionsList) return;
      const now = performance.now();
      const sig = world.factions.size + "|" + [...world.factions].map(([fid, f]) => fid + ":" + f.members.size).join(",");
      if (sig !== world._lastFactionsSig || now - world._lastFactionsDomAt >= 2e3) {
        factionsList.innerHTML = "";
        for (const [fid, f] of world.factions) {
          const color = f.color;
          const members = [...f.members].map((id) => world.agentsById.get(id)).filter(Boolean);
          const avgLvl = (members.reduce((s, a) => s + a.level, 0) / (members.length || 1)).toFixed(1);
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
    static updateInspector(world, el) {
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
      const emoji = AGENT_EMOJIS[actionType] || getIdleEmoji(a);
      const factionColor = a.factionId ? world.factions.get(a.factionId)?.color || "#888" : null;
      const hpPct = Math.round(a.health / a.maxHealth * 100);
      el.innerHTML = `
      <div class="agent-card">
        <div class="agent-avatar">${emoji}</div>
        <div class="agent-info">
          <div class="agent-name-row">
            <span class="agent-name">${a.name}</span>
            <span class="agent-level">LV. ${String(a.level).padStart(2, "0")}</span>
          </div>
          <div class="agent-badges">
            ${a.factionId ? `<span class="badge-faction" style="background:${factionColor}22;color:${factionColor};border-color:${factionColor}55">${a.factionId.slice(0, 8).toUpperCase()}</span>` : ""}
            ${actionType ? `<span class="badge-action">${actionType.toUpperCase()}</span>` : ""}
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
    static showNotification(agent) {
      const el = document.getElementById("eventNotification");
      const body = document.getElementById("notificationBody");
      if (!el || !body || !agent) return;
      const action = agent.action ? agent.action.type : null;
      const desc = action ? `Unit ${agent.name} is currently ${action === "attack" ? "attacking" : action + "ing"}.` : `Unit ${agent.name} is currently idle.`;
      body.textContent = desc;
      el.classList.remove("hidden");
      clearTimeout(_UIManager._notifTimer);
      _UIManager._notifTimer = window.setTimeout(() => el.classList.add("hidden"), 5e3);
    }
    static {
      this._notifTimer = 0;
    }
  };

  // src/domains/ui/input-handler.ts
  var InputHandler = class {
    static setup(canvas, camera, world, dom) {
      const { btnDrawWalls, btnEraseWalls } = dom.buttons;
      function setPaintMode(mode) {
        const next = world.paintMode === mode ? "none" : mode;
        world.paintMode = next;
        if (btnDrawWalls) btnDrawWalls.classList.toggle("toggled", next === "draw");
        if (btnEraseWalls) btnEraseWalls.classList.toggle("toggled", next === "erase");
      }
      btnDrawWalls?.addEventListener("click", () => setPaintMode("draw"));
      btnEraseWalls?.addEventListener("click", () => setPaintMode("erase"));
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let allowDrag = false;
      let painting = false;
      let lastPaintKey = null;
      function paintAtEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
        const wpos = camera.screenToWorld(sx, sy);
        const x = Math.floor(wpos.x / CELL);
        const y = Math.floor(wpos.y / CELL);
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
        const k = key(x, y);
        if (k === lastPaintKey) return;
        lastPaintKey = k;
        if (world.paintMode === "draw") {
          if (!world.walls.has(k) && !world.farms.has(k) && !world.flagCells.has(k) && !world.crops.has(k) && !world.agentsByCell.has(k)) {
            world.walls.set(k, { id: uuid(), x, y, hp: 12, maxHp: 12 });
            log(world, "build", `Wall @${x},${y} (user)`, null, { x, y });
          }
        } else if (world.paintMode === "erase") {
          if (world.walls.has(k)) {
            world.walls.delete(k);
            log(world, "destroy", `Wall @${x},${y} removed (user)`, null, { x, y });
          }
        }
      }
      function setAllowDrag(e) {
        allowDrag = e.buttons === 2 || e.buttons === 1 && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey);
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
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      canvas.addEventListener("pointermove", (e) => {
        setAllowDrag(e);
        if (dragging && allowDrag) {
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          camera.panBy(-dx, -dy);
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
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
          const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
          let dx = e.deltaX;
          let dy = e.deltaY;
          if (e.deltaMode === 1) {
            dx *= 16;
            dy *= 16;
          }
          if (e.deltaMode === 2) {
            dx *= 100;
            dy *= 100;
          }
          if (e.ctrlKey || e.metaKey) {
            const factor = Math.pow(2, -dy * 0.01);
            camera.zoomAt(sx, sy, factor);
          } else {
            camera.panBy(dx, dy);
          }
        },
        { passive: false }
      );
      let lastTouchDist = 0;
      let lastTouchCenter = null;
      canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const [t1, t2] = [e.touches[0], e.touches[1]];
          lastTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          lastTouchCenter = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
          };
        }
      }, { passive: false });
      canvas.addEventListener("touchmove", (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const [t1, t2] = [e.touches[0], e.touches[1]];
          const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          const center = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
          };
          if (lastTouchDist > 0) {
            const factor = dist / lastTouchDist;
            const rect = canvas.getBoundingClientRect();
            const zx = (center.x - rect.left) * (canvas.width / rect.width);
            const zy = (center.y - rect.top) * (canvas.height / rect.height);
            camera.zoomAt(zx, zy, factor);
          }
          if (lastTouchCenter) {
            camera.panBy(-(center.x - lastTouchCenter.x), -(center.y - lastTouchCenter.y));
          }
          lastTouchDist = dist;
          lastTouchCenter = center;
        }
      }, { passive: false });
      canvas.addEventListener("touchend", (e) => {
        if (e.touches.length < 2) {
          lastTouchDist = 0;
          lastTouchCenter = null;
        }
      });
      canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const sx = (e.clientX - rect.left) * scaleX;
        const sy = (e.clientY - rect.top) * scaleY;
        const wpos = camera.screenToWorld(sx, sy);
        const x = Math.floor(wpos.x / CELL);
        const y = Math.floor(wpos.y / CELL);
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
        const id = world.agentsByCell.get(key(x, y));
        world.selectedId = id || null;
        UIManager.updateInspector(world, dom.inspector);
      });
    }
  };

  // src/domains/agent/relationships.ts
  var MAX_REL = 80;
  var RelationshipMap = class {
    constructor(initial) {
      this._map = initial ? new Map(initial) : /* @__PURE__ */ new Map();
    }
    get(id) {
      return this._map.get(id) ?? 0;
    }
    set(id, val) {
      val = clamp(val, -1, 1);
      if (Math.abs(val) < 0.02) {
        this._map.delete(id);
        return;
      }
      this._map.set(id, val);
      if (this._map.size > MAX_REL) {
        const prunable = [...this._map.entries()].sort(
          ([, v1], [, v2]) => Math.abs(v1) - Math.abs(v2)
        );
        const toDrop = this._map.size - MAX_REL;
        for (let i = 0; i < toDrop; i++) this._map.delete(prunable[i][0]);
      }
    }
    delete(id) {
      this._map.delete(id);
    }
    has(id) {
      return this._map.has(id);
    }
    keys() {
      return this._map.keys();
    }
    entries() {
      return this._map.entries();
    }
    get size() {
      return this._map.size;
    }
    toRawMap() {
      return this._map;
    }
  };

  // src/domains/agent/agent.ts
  var Agent = class {
    constructor(opts) {
      this.id = opts.id;
      this.name = opts.name;
      this.cellX = opts.cellX;
      this.cellY = opts.cellY;
      this.prevCellX = opts.cellX;
      this.prevCellY = opts.cellY;
      this.lerpT = 1;
      this.health = opts.health ?? 100;
      this.maxHealth = opts.maxHealth ?? 100;
      this.energy = opts.energy ?? 100;
      this.attack = opts.attack ?? TUNE.baseDamage;
      this.level = opts.level ?? 1;
      this.ageTicks = opts.ageTicks ?? 0;
      this.factionId = opts.factionId ?? null;
      this.relationships = new RelationshipMap(opts.relationships);
      this.path = opts.path ?? null;
      this.pathIdx = opts.pathIdx ?? 0;
      this.action = opts.action ?? null;
      this.lockMsRemaining = opts.lockMsRemaining ?? 0;
      this.travelPref = opts.travelPref ?? "near";
      this.aggression = opts.aggression ?? Math.random();
      this.cooperation = opts.cooperation ?? Math.random();
      this.replanAtTick = opts.replanAtTick ?? 0;
      this.goal = opts.goal ?? null;
      this._underAttack = false;
    }
    takeDamage(amount) {
      this.health -= amount;
    }
    healBy(amount) {
      this.health = Math.min(this.maxHealth, this.health + amount);
    }
    drainEnergy(amount) {
      this.energy = Math.max(0, this.energy - amount);
    }
    addEnergy(amount) {
      this.energy = Math.min(ENERGY_CAP, this.energy + amount);
    }
    clampStats() {
      if (this.energy < 0) this.energy = 0;
      if (this.energy > ENERGY_CAP) this.energy = ENERGY_CAP;
    }
    get isDead() {
      return this.health <= 0;
    }
    levelUp() {
      if (this.level >= TUNE.levelCap) return;
      this.level++;
      this.maxHealth += 8;
      this.attack += 1.5;
    }
  };

  // src/domains/agent/agent-factory.ts
  var AgentFactory = class {
    static create(world, x, y) {
      const rp = Math.random();
      const pref = rp < 1 / 3 ? "near" : rp < 2 / 3 ? "far" : "wander";
      const agent = new Agent({
        id: uuid(),
        name: generatePronounceableString(6),
        cellX: x,
        cellY: y,
        travelPref: pref,
        aggression: Math.random(),
        cooperation: Math.random()
      });
      world.agents.push(agent);
      world.agentsById.set(agent.id, agent);
      world.agentsByCell.set(key(x, y), agent.id);
      return agent;
    }
    static createChild(world, parent1, parent2, x, y) {
      const child = new Agent({
        id: uuid(),
        name: generatePronounceableString(6),
        cellX: x,
        cellY: y,
        energy: 60,
        health: 80,
        aggression: clamp((parent1.aggression + parent2.aggression) / 2, 0, 1),
        cooperation: clamp((parent1.cooperation + parent2.cooperation) / 2, 0, 1),
        travelPref: Math.random() < 0.5 ? parent1.travelPref : parent2.travelPref
      });
      world.agents.push(child);
      world.agentsById.set(child.id, child);
      world.agentsByCell.set(key(x, y), child.id);
      return child;
    }
  };

  // src/shared/pathfinding.ts
  var Pathfinder = class _Pathfinder {
    static {
      this.MAX_EXP = 900;
    }
    static astar(start, goal, isBlocked) {
      const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
      const open = /* @__PURE__ */ new Map();
      const came = /* @__PURE__ */ new Map();
      const g = /* @__PURE__ */ new Map();
      const f = /* @__PURE__ */ new Map();
      const sk = (x, y) => key(x, y);
      const neighbors = (x, y) => [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ].filter(
        ([nx, ny]) => nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && !isBlocked(nx, ny)
      );
      const sK = sk(start.x, start.y);
      g.set(sK, 0);
      f.set(sK, h(start.x, start.y));
      open.set(sK, [start.x, start.y]);
      let expansions = 0;
      while (open.size) {
        if (++expansions > _Pathfinder.MAX_EXP) return null;
        let currentKey = null;
        let current = null;
        let best = Infinity;
        for (const [k, xy] of open) {
          const fv = f.get(k) ?? Infinity;
          if (fv < best) {
            best = fv;
            currentKey = k;
            current = xy;
          }
        }
        if (!current || !currentKey) break;
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
    static planPathTo(world, a, gx, gy, force = false) {
      if (!force) {
        if (world._pathWhitelist && !world._pathWhitelist.has(a.id)) return;
        if (world.tick < (a.replanAtTick || 0)) return;
        if (world.pathBudget <= 0) return;
        world.pathBudget--;
      }
      a.goal = { x: gx, y: gy };
      const path = _Pathfinder.astar(
        { x: a.cellX, y: a.cellY },
        { x: gx, y: gy },
        (x, y) => world.grid.isBlocked(x, y, a.id)
      );
      a.path = path;
      a.pathIdx = 0;
      a.replanAtTick = world.tick + 1 + rndi(0, 1);
    }
    static findNearest(a, coll) {
      let best = null;
      let bestD = 1e9;
      for (const it of coll) {
        const d = Math.abs(a.cellX - it.x) + Math.abs(a.cellY - it.y);
        if (d < bestD) {
          bestD = d;
          best = it;
        }
      }
      return best ? { target: best, dist: bestD } : null;
    }
  };

  // src/domains/action/action.ts
  var ActionFactory = class _ActionFactory {
    static create(type, payload = null) {
      const [mn, mx] = ACTION_DURATIONS[type];
      return {
        type,
        remainingMs: rndi(mn, mx),
        tickCounterMs: 0,
        payload
      };
    }
    static tryStart(agent, type, payload = null) {
      if (agent.action) return false;
      agent.action = _ActionFactory.create(type, payload);
      return true;
    }
  };

  // src/domains/faction/faction.ts
  var Faction = class {
    constructor(id, color, members) {
      this.id = id;
      this.color = color;
      this.members = members ?? /* @__PURE__ */ new Set();
    }
    get size() {
      return this.members.size;
    }
    addMember(agentId) {
      this.members.add(agentId);
    }
    removeMember(agentId) {
      this.members.delete(agentId);
    }
    hasMember(agentId) {
      return this.members.has(agentId);
    }
  };

  // src/domains/faction/faction-manager.ts
  var FactionManager = class _FactionManager {
    static _nextColor(world) {
      const used = new Set([...world.factions.values()].map((f) => f.color));
      for (let i = 0; i < FACTION_COLORS.length; i++) {
        if (!used.has(FACTION_COLORS[i])) return FACTION_COLORS[i];
      }
      return FACTION_COLORS[world.factions.size % FACTION_COLORS.length];
    }
    static _placeFlag(world, fid, members) {
      if (world.flags.has(fid)) return;
      const cells = members.map((a) => ({ x: a.cellX, y: a.cellY }));
      const cx = Math.round(cells.reduce((s, c) => s + c.x, 0) / cells.length);
      const cy = Math.round(cells.reduce((s, c) => s + c.y, 0) / cells.length);
      let spot = { x: cx, y: cy };
      if (world.grid.isBlocked(cx, cy)) spot = world.grid.randomFreeCell();
      world.flags.set(fid, {
        id: uuid(),
        factionId: fid,
        x: spot.x,
        y: spot.y,
        hp: rndi(TUNE.flagHp[0], TUNE.flagHp[1]),
        maxHp: TUNE.flagHp[1]
      });
      world.flagCells.add(key(spot.x, spot.y));
      log(world, "faction", `Faction ${fid} placed flag @${spot.x},${spot.y}`, null, {
        factionId: fid
      });
    }
    static create(world, members) {
      const fid = generatePronounceableString(6);
      const color = _FactionManager._nextColor(world);
      const faction = new Faction(fid, color);
      world.factions.set(fid, faction);
      for (const a of members) {
        if (a.factionId) {
          const old = world.factions.get(a.factionId);
          if (old) old.members.delete(a.id);
        }
        a.factionId = fid;
        faction.addMember(a.id);
      }
      _FactionManager._placeFlag(world, fid, members);
      const names = members.map((m) => m.name).join(" & ");
      log(world, "faction", `${names} founded faction ${fid}`, null, {
        factionId: fid
      });
      return fid;
    }
    static disband(world, fid, reason = "rule: <=1 member") {
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
        factionId: fid
      });
    }
    static setFaction(world, agent, newFid, reason = null) {
      const oldFid = agent.factionId || null;
      if (oldFid === newFid) return;
      if (oldFid) {
        const old = world.factions.get(oldFid);
        if (old) old.members.delete(agent.id);
      }
      agent.factionId = newFid || null;
      if (newFid) {
        if (!world.factions.has(newFid)) {
          const color = _FactionManager._nextColor(world);
          const faction = new Faction(newFid, color);
          world.factions.set(newFid, faction);
          _FactionManager._placeFlag(world, newFid, [agent]);
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
        _FactionManager._destroyIfLonely(world, oldFid);
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
          `${agent.name} moved ${oldFid} \u2192 ${newFid}${reason ? ` (${reason})` : ""}`,
          agent.id,
          { from: oldFid, to: newFid, reason }
        );
        _FactionManager._destroyIfLonely(world, oldFid);
      }
    }
    static _destroyIfLonely(world, fid) {
      const f = world.factions.get(fid);
      if (!f) return;
      let aliveCount = 0;
      for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
      if (aliveCount <= 1) _FactionManager.disband(world, fid, "<=1 alive");
    }
    static reconcile(world) {
      const actual = /* @__PURE__ */ new Map();
      for (const a of world.agents) {
        if (!a.factionId) continue;
        if (!actual.has(a.factionId)) actual.set(a.factionId, /* @__PURE__ */ new Set());
        actual.get(a.factionId).add(a.id);
      }
      for (const [fid, set] of actual) {
        if (!world.factions.has(fid)) {
          const color = _FactionManager._nextColor(world);
          const faction = new Faction(fid, color, set);
          world.factions.set(fid, faction);
        } else {
          const f = world.factions.get(fid);
          f.members.clear();
          for (const id of set) f.members.add(id);
        }
        if (!world.flags.has(fid)) {
          const members = [...set].map((id) => world.agentsById.get(id)).filter((a) => a !== void 0);
          if (members.length) _FactionManager._placeFlag(world, fid, members);
        }
      }
      for (const [fid, f] of [...world.factions]) {
        let aliveCount = 0;
        for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
        if (aliveCount <= 1) _FactionManager.disband(world, fid, "reconcile");
      }
    }
  };

  // src/domains/action/interaction-engine.ts
  function lockAgent(world, id, ms) {
    const ag = world.agentsById.get(id);
    if (!ag) return;
    ag.lockMsRemaining = Math.max(ag.lockMsRemaining || 0, ms);
  }
  var InteractionEngine = class _InteractionEngine {
    static consider(world, agent) {
      if (agent.energy < TUNE.energyLowThreshold) {
        _InteractionEngine.chooseAttack(world, agent, true);
      }
      const adj = [
        [agent.cellX + 1, agent.cellY],
        [agent.cellX - 1, agent.cellY],
        [agent.cellX, agent.cellY + 1],
        [agent.cellX, agent.cellY - 1]
      ];
      for (const [nx, ny] of adj) {
        const id = world.agentsByCell.get(key(nx, ny));
        if (!id) continue;
        const b = world.agentsById.get(id);
        if (!b) continue;
        const rel = agent.relationships.get(b.id);
        if (rel >= TUNE.reproduction.relationshipThreshold && agent.energy >= TUNE.reproduction.relationshipEnergy && b.energy >= TUNE.reproduction.relationshipEnergy) {
          if (ActionFactory.tryStart(agent, "reproduce", { targetId: b.id })) {
            const dur = agent.action.remainingMs;
            const reserve = 4;
            agent.drainEnergy(reserve);
            b.drainEnergy(reserve);
            lockAgent(world, agent.id, dur);
            lockAgent(world, b.id, dur);
            return;
          }
        }
      }
      if (_InteractionEngine.chooseAttack(world, agent)) return;
      if (_InteractionEngine._chooseHelpHealTalk(world, agent)) return;
    }
    static chooseAttack(world, agent, preferEnemies = false) {
      const candidates = [];
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const d = Math.abs(dx) + Math.abs(dy);
          if (d === 0 || d > 2) continue;
          const id = world.agentsByCell.get(key(agent.cellX + dx, agent.cellY + dy));
          if (!id) continue;
          const b = world.agentsById.get(id);
          if (b) candidates.push(b);
        }
      }
      if (!candidates.length) return false;
      let pool = candidates;
      let p;
      if (preferEnemies) {
        const enemies = candidates.filter(
          (b) => agent.factionId && b.factionId && agent.factionId !== b.factionId
        );
        if (enemies.length) {
          pool = enemies;
          p = 1;
        }
      }
      if (p === void 0) {
        const hasEnemyNearby = candidates.some(
          (b) => agent.factionId && b.factionId && agent.factionId !== b.factionId
        );
        const bestRel = Math.max(
          ...candidates.map((b) => agent.relationships.get(b.id))
        );
        const relPenalty = Math.max(0, bestRel) * 0.6;
        p = clamp(agent.aggression + (hasEnemyNearby ? 0.25 : 0) - relPenalty, 0, 1);
      }
      if (Math.random() >= p) return false;
      pool.sort((b1, b2) => {
        const f1 = agent.factionId && b1.factionId && agent.factionId !== b1.factionId ? -0.5 : 0;
        const f2 = agent.factionId && b2.factionId && agent.factionId !== b2.factionId ? -0.5 : 0;
        return agent.relationships.get(b1.id) + f1 - (agent.relationships.get(b2.id) + f2);
      });
      const target = pool[0];
      if (agent.relationships.get(target.id) > 0.5 && Math.random() < 0.85) return false;
      if (ActionFactory.tryStart(agent, "attack", { targetId: target.id })) return true;
      return false;
    }
    static _chooseHelpHealTalk(world, agent) {
      const adj = [
        [agent.cellX + 1, agent.cellY],
        [agent.cellX - 1, agent.cellY],
        [agent.cellX, agent.cellY + 1],
        [agent.cellX, agent.cellY - 1]
      ];
      const neighbors = [];
      for (const [nx, ny] of adj) {
        const id = world.agentsByCell.get(key(nx, ny));
        if (!id) continue;
        const b = world.agentsById.get(id);
        if (b) neighbors.push(b);
      }
      if (!neighbors.length) return false;
      const sameFactionNearby = neighbors.some(
        (b) => agent.factionId && b.factionId && agent.factionId === b.factionId
      );
      const pHelp = clamp(agent.cooperation + (sameFactionNearby ? 0.25 : 0), 0, 1);
      if (Math.random() < pHelp) {
        const sorted = neighbors.slice().sort((b1, b2) => {
          const same1 = agent.factionId && b1.factionId && agent.factionId === b1.factionId ? -0.3 : 0;
          const same2 = agent.factionId && b2.factionId && agent.factionId === b2.factionId ? -0.3 : 0;
          const need1 = b1.health / b1.maxHealth < b2.health / b2.maxHealth ? -0.2 : 0.2;
          return same1 + need1 - (same2 + (b2.health / b2.maxHealth < b1.health / b1.maxHealth ? -0.2 : 0.2));
        });
        const targ2 = sorted[0];
        const doHeal = targ2.health < targ2.maxHealth * 0.85;
        const type2 = doHeal ? "heal" : "help";
        if (ActionFactory.tryStart(agent, type2, { targetId: targ2.id })) {
          lockAgent(world, agent.id, agent.action.remainingMs);
          lockAgent(world, targ2.id, agent.action.remainingMs);
          return true;
        }
      }
      const targ = neighbors[rndi(0, neighbors.length - 1)];
      const rel = agent.relationships.get(targ.id);
      const pickQuarrel = rel < 0 && Math.random() < 0.5;
      const type = pickQuarrel ? "quarrel" : "talk";
      if (ActionFactory.tryStart(agent, type, { targetId: targ.id })) {
        lockAgent(world, agent.id, agent.action.remainingMs);
        lockAgent(world, targ.id, agent.action.remainingMs);
        return true;
      }
      return false;
    }
  };

  // src/domains/action/action-processor.ts
  var ActionProcessor = class _ActionProcessor {
    static process(world, agent, dtMs) {
      if (!agent.action) return;
      const act = agent.action;
      if (agent.energy < TUNE.energyLowThreshold && act.type !== "attack") {
        agent.action = null;
        return;
      }
      act.remainingMs -= dtMs;
      act.tickCounterMs += dtMs;
      const costPerMs = (TUNE.actionCost[act.type] || 1) / 1e3;
      agent.energy -= costPerMs * dtMs;
      const targ = act.payload?.targetId ? world.agentsById.get(act.payload.targetId) : void 0;
      if (targ) {
        const dist = manhattan(agent.cellX, agent.cellY, targ.cellX, targ.cellY);
        if (act.type === "attack") {
          if (dist > 2) {
            agent.action = null;
            return;
          }
        } else {
          if (dist !== 1) {
            agent.action = null;
            return;
          }
        }
      }
      if (act.tickCounterMs >= 500) {
        act.tickCounterMs = 0;
        _ActionProcessor._applyPeriodicEffect(world, agent, targ);
      }
      if (act.remainingMs <= 0) {
        _ActionProcessor._applyCompletion(world, agent, targ);
        agent.action = null;
      }
    }
    static _applyPeriodicEffect(world, agent, targ) {
      const act = agent.action;
      if (act.type === "attack" && targ) {
        targ.takeDamage(agent.attack * 0.4);
        if (agent.factionId === targ.factionId) {
          Math.random() < 0.3 ? targ.factionId = null : InteractionEngine.chooseAttack(world, targ, false);
        }
        agent.relationships.set(targ.id, agent.relationships.get(targ.id) - 0.2);
        log(world, "attack", `${agent.name} hit ${targ.name}`, agent.id, { to: targ.id });
        if (targ.health <= 0 && agent.level < TUNE.levelCap) {
          agent.levelUp();
          log(world, "level", `${agent.name} leveled to ${agent.level}`, agent.id, {});
        }
      } else if (act.type === "heal" && targ) {
        targ.healBy(2);
        log(world, "heal", `${agent.name} healed ${targ.name}`, agent.id, { to: targ.id });
      } else if (act.type === "help" && targ) {
        const high = agent.energy > ENERGY_CAP * 0.7;
        const ratio = high ? 0.2 : 0.1;
        const transfer = Math.max(0, agent.energy * ratio);
        if (transfer > 0) {
          agent.drainEnergy(transfer);
          targ.addEnergy(transfer);
          log(world, "help", `${agent.name} gave ${transfer.toFixed(1)} energy to ${targ.name}`, agent.id, { to: targ.id, transfer });
        }
      } else if (act.type === "quarrel" && targ) {
        const delta = (Math.random() < 0.5 ? -0.1 : 0.1) * (agent.factionId === targ.factionId ? 0.6 : 1);
        agent.relationships.set(targ.id, agent.relationships.get(targ.id) + delta);
        targ.relationships.set(agent.id, targ.relationships.get(agent.id) + delta);
        log(world, "quarrel", `${agent.name} ${delta > 0 ? "made peace with" : "argued with"} ${targ.name}`, agent.id, { to: targ.id, delta });
      } else if (act.type === "talk" && targ) {
        const delta = (Math.random() < 0.75 ? 0.14 : -0.06) * (agent.factionId === targ.factionId ? 1.1 : 0.8);
        agent.relationships.set(targ.id, agent.relationships.get(targ.id) + delta);
        targ.relationships.set(agent.id, targ.relationships.get(agent.id) + delta);
        log(world, "talk", `${agent.name} talked with ${targ.name}`, agent.id, { to: targ.id, delta });
      }
    }
    static _applyCompletion(world, agent, targ) {
      const act = agent.action;
      if (targ && !agent.factionId && !targ.factionId) {
        const rel = agent.relationships.get(targ.id);
        if ((act.type === "talk" || act.type === "help" || act.type === "heal") && rel >= TUNE.factionFormRelThreshold) {
          FactionManager.create(world, [agent, targ]);
        }
      }
      if (act.type === "help" && targ && agent.factionId) {
        if (Math.random() < TUNE.helpConvertChance && agent.relationships.get(targ.id) >= TUNE.helpConvertRelThreshold && targ.factionId !== agent.factionId) {
          FactionManager.setFaction(world, targ, agent.factionId, "recruitment");
        }
      }
      if (act.type === "reproduce" && targ) {
        if (manhattan(agent.cellX, agent.cellY, targ.cellX, targ.cellY) === 1) {
          const spots = [
            [agent.cellX + 1, agent.cellY],
            [agent.cellX - 1, agent.cellY],
            [agent.cellX, agent.cellY + 1],
            [agent.cellX, agent.cellY - 1]
          ];
          const free = spots.find(([x, y]) => !world.grid.isBlocked(x, y));
          if (free) {
            agent.drainEnergy(12);
            targ.drainEnergy(12);
            const [x, y] = free;
            const child = AgentFactory.createChild(world, agent, targ, x, y);
            const pa = agent.factionId || null;
            const pb = targ.factionId || null;
            let chosen = null;
            if (pa && pb) chosen = Math.random() < 0.5 ? pa : pb;
            else chosen = pa || pb;
            if (chosen) FactionManager.setFaction(world, child, chosen, "birth");
            log(world, "reproduce", `${agent.name} & ${targ.name} had ${child.name}`, agent.id, { child: child.id });
          }
        }
      }
    }
  };

  // src/domains/simulation/roaming.ts
  var RoamingStrategy = class {
    static biasedRoam(world, agent) {
      const range = 6;
      const candidates = [];
      for (let i = 0; i < 6; i++) {
        const rx = Math.max(0, Math.min(61, agent.cellX + rndi(-range, range)));
        const ry = Math.max(0, Math.min(61, agent.cellY + rndi(-range, range)));
        if (!world.grid.isBlocked(rx, ry, agent.id)) candidates.push({ x: rx, y: ry });
      }
      if (!candidates.length) return;
      const centerX = Math.floor(GRID / 2);
      const centerY = Math.floor(GRID / 2);
      const distToCenter = (c) => Math.abs(c.x - centerX) + Math.abs(c.y - centerY);
      let choice = candidates[0];
      if (agent.travelPref === "wander") {
        choice = candidates[rndi(0, candidates.length - 1)];
      } else if (agent.travelPref === "near") {
        if (agent.factionId) {
          const flag = world.flags.get(agent.factionId);
          if (flag) {
            let bestScore = Infinity;
            for (const c of candidates) {
              const d = Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y);
              const desired = 4;
              let crowd = 0;
              for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                  if (Math.abs(dx) + Math.abs(dy) > 2) continue;
                  const id = world.agentsByCell.get(key(c.x + dx, c.y + dy));
                  if (!id) continue;
                  const b = world.agentsById.get(id);
                  if (b && b.factionId === agent.factionId) crowd++;
                }
              }
              const score = Math.abs(d - desired) + crowd * 0.7;
              if (score < bestScore) {
                bestScore = score;
                choice = c;
              }
            }
          } else {
            choice = candidates.reduce(
              (best, c) => distToCenter(c) < distToCenter(best) ? c : best
            );
          }
        } else {
          choice = candidates.reduce(
            (best, c) => distToCenter(c) < distToCenter(best) ? c : best
          );
        }
      } else if (agent.travelPref === "far") {
        if (agent.factionId) {
          const flag = world.flags.get(agent.factionId);
          if (flag) {
            choice = candidates.reduce(
              (best, c) => Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y) > Math.abs(best.x - flag.x) + Math.abs(best.y - flag.y) ? c : best
            );
          } else {
            choice = candidates.reduce(
              (best, c) => distToCenter(c) > distToCenter(best) ? c : best
            );
          }
        } else {
          choice = candidates.reduce(
            (best, c) => distToCenter(c) > distToCenter(best) ? c : best
          );
        }
      }
      Pathfinder.planPathTo(world, agent, choice.x, choice.y);
    }
  };

  // src/domains/simulation/simulation-engine.ts
  var SimulationEngine = class _SimulationEngine {
    // ── Crop spawning ──
    static _randomCropEmoji() {
      return WORLD_EMOJIS.crops[Math.floor(Math.random() * WORLD_EMOJIS.crops.length)];
    }
    static addCrop(world, x, y) {
      if (world.crops.size >= TUNE.maxCrops) return false;
      const k = key(x, y);
      if (world.crops.has(k) || world.walls.has(k) || world.farms.has(k) || world.flagCells.has(k)) return false;
      world.crops.set(k, { id: uuid(), x, y, emoji: _SimulationEngine._randomCropEmoji() });
      log(world, "spawn", `crop @${x},${y}`, null, { x, y });
      return true;
    }
    static _maybeSpawnCrops(world) {
      if (world.crops.size >= TUNE.maxCrops) return;
      const attempts = GRID;
      const base = 375e-5 * world.spawnMult;
      for (let i = 0; i < attempts; i++) {
        if (world.crops.size >= TUNE.maxCrops) break;
        const x = rndi(0, GRID - 1);
        const y = rndi(0, GRID - 1);
        const k = key(x, y);
        if (world.crops.has(k) || world.walls.has(k) || world.farms.has(k) || world.agentsByCell.has(k) || world.flagCells.has(k)) continue;
        let prob = base;
        for (const fm of world.farms.values()) {
          const d = Math.abs(x - fm.x) + Math.abs(y - fm.y);
          if (d <= TUNE.farmBoostRadius)
            prob *= 1 + (TUNE.farmBoostRadius - d + 1) * 0.6;
        }
        if (Math.random() < prob)
          world.crops.set(k, { id: uuid(), x, y, emoji: _SimulationEngine._randomCropEmoji() });
      }
    }
    // ── Harvesting ──
    static _harvestAt(world, agent, x, y) {
      const k = key(x, y);
      const crop = world.crops.get(k);
      if (!crop) return false;
      world.crops.delete(k);
      agent.addEnergy(TUNE.cropGain);
      _SimulationEngine._levelCheck(world, agent);
      if (agent.factionId) {
        const recips = world.agents.filter(
          (m) => m.factionId === agent.factionId && m.id !== agent.id && manhattan(agent.cellX, agent.cellY, m.cellX, m.cellY) <= 5
        );
        if (recips.length) {
          const share = TUNE.cropGain * 0.3;
          const per = share / recips.length;
          for (const m of recips) m.addEnergy(per);
        }
      }
      return true;
    }
    // ── Level check ──
    static _levelCheck(world, agent) {
      if (agent.level >= TUNE.levelCap) return;
      if (agent.energy > ENERGY_CAP * 0.7) {
        agent.levelUp();
        agent.energy = Math.min(ENERGY_CAP, 140);
        log(world, "level", `${agent.name} leveled to ${agent.level}`, agent.id, {});
      }
    }
    // ── Farm building ──
    static _tryBuildFarm(world, agent) {
      if (agent.energy < TUNE.farmEnergyCost) return;
      if (Math.random() >= TUNE.buildFarmChance) return;
      const adj = [
        [agent.cellX + 1, agent.cellY],
        [agent.cellX - 1, agent.cellY],
        [agent.cellX, agent.cellY + 1],
        [agent.cellX, agent.cellY - 1]
      ];
      const free = adj.filter(
        ([x2, y2]) => !world.grid.isBlocked(x2, y2) && !world.farms.has(key(x2, y2))
      );
      if (!free.length) return;
      const [x, y] = free[rndi(0, free.length - 1)];
      world.farms.set(key(x, y), { id: uuid(), x, y });
      agent.drainEnergy(TUNE.farmEnergyCost);
      log(world, "build", `${agent.name} built farm`, agent.id, { x, y });
    }
    // ── Food seeking ──
    static _stepTowardFood(world, agent) {
      const here = world.foodField.distanceAt(agent.cellX, agent.cellY);
      if (here === FoodField.INF) return false;
      let best = { d: here, x: agent.cellX, y: agent.cellY };
      const adj = [
        [agent.cellX + 1, agent.cellY],
        [agent.cellX - 1, agent.cellY],
        [agent.cellX, agent.cellY + 1],
        [agent.cellX, agent.cellY - 1]
      ];
      for (const [nx, ny] of adj) {
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        if (world.grid.isBlocked(nx, ny, agent.id)) continue;
        const d = world.foodField.distanceAt(nx, ny);
        if (d < best.d) best = { d, x: nx, y: ny };
      }
      if (best.x === agent.cellX && best.y === agent.cellY) return false;
      agent.path = [{ x: best.x, y: best.y }];
      agent.pathIdx = 0;
      agent.goal = null;
      return true;
    }
    static _seekFoodWhenHungry(world, agent) {
      if (world.crops.has(key(agent.cellX, agent.cellY))) {
        _SimulationEngine._harvestAt(world, agent, agent.cellX, agent.cellY);
        return;
      }
      if (world.tick - world.foodField.lastTick >= 5) {
        world.foodField.recompute(world.grid, world.tick);
      }
      const adj = [
        [agent.cellX + 1, agent.cellY],
        [agent.cellX - 1, agent.cellY],
        [agent.cellX, agent.cellY + 1],
        [agent.cellX, agent.cellY - 1]
      ];
      for (const [nx, ny] of adj) {
        const k = key(nx, ny);
        if (world.crops.has(k) && !world.flagCells.has(k)) {
          agent.path = [{ x: nx, y: ny }];
          agent.pathIdx = 0;
          agent.goal = null;
          return;
        }
      }
      const scarcity = world.crops.size / Math.max(1, world.agents.length);
      if (scarcity < 0.35) {
        if (_SimulationEngine._stepTowardFood(world, agent)) return;
      }
      const filtered = [...world.crops.values()].filter(
        (c) => !world.flagCells.has(key(c.x, c.y))
      );
      if (filtered.length) {
        const near = Pathfinder.findNearest(agent, filtered);
        if (near) {
          Pathfinder.planPathTo(world, agent, near.target.x, near.target.y);
          return;
        }
      }
    }
    // ── Upkeep ──
    static _applyFlagHealing(world) {
      for (const agent of world.agents) {
        if (!agent.factionId) continue;
        const flag = world.flags.get(agent.factionId);
        if (!flag) continue;
        const d = Math.abs(agent.cellX - flag.x) + Math.abs(agent.cellY - flag.y);
        if (d <= TUNE.healAuraRadius)
          agent.healBy(TUNE.healAuraPerTick);
      }
    }
    static _cleanDead(world) {
      const removedIds = [];
      world.agents = world.agents.filter((a) => {
        if (a.health <= 0) {
          world.agentsByCell.delete(key(a.cellX, a.cellY));
          world.agentsById.delete(a.id);
          removedIds.push(a.id);
          if (a.factionId && world.factions.has(a.factionId)) {
            world.factions.get(a.factionId).members.delete(a.id);
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
        if (aliveCount <= 1) FactionManager.disband(world, fid, "no members");
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
    // ── Main tick ──
    static tick(world) {
      world.tick++;
      const scarcity = world.crops.size / Math.max(1, world.agents.length);
      const budgetThisTick = scarcity < 0.25 ? Math.max(6, Math.floor(world.pathBudgetMax * 0.5)) : world.pathBudgetMax;
      world.pathBudget = budgetThisTick;
      world._pathWhitelist.clear();
      const n = world.agents.length;
      if (n > 0) {
        const eligible = world.agents.filter(
          (a) => (a.lockMsRemaining || 0) <= 0 && (!a.path || a.pathIdx >= a.path.length) && !a.action
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
      _SimulationEngine._maybeSpawnCrops(world);
      for (const b of world.agents) b._underAttack = false;
      for (const b of world.agents) {
        if (b.action && b.action.type === "attack" && b.action.payload?.targetId) {
          const t = world.agentsById.get(b.action.payload.targetId);
          if (t) t._underAttack = true;
        }
      }
      for (const a of world.agents) {
        const agent = a;
        agent.ageTicks++;
        agent.energy -= 0.0625;
        agent.lockMsRemaining = Math.max(0, (agent.lockMsRemaining || 0) - BASE_TICK_MS);
        if (agent.energy < TUNE.energyLowThreshold) {
          if (agent.action && agent.action.type !== "attack") agent.action = null;
        }
        if (agent.action) {
          ActionProcessor.process(world, agent, BASE_TICK_MS);
        } else {
          const locked = agent.lockMsRemaining > 0 && !agent._underAttack;
          if (!locked) {
            if (agent.path && agent.pathIdx < agent.path.length) {
              const step = agent.path[agent.pathIdx];
              if (!world.grid.isBlocked(step.x, step.y, agent.id)) {
                agent.prevCellX = agent.cellX;
                agent.prevCellY = agent.cellY;
                agent.lerpT = 0;
                world.agentsByCell.delete(key(agent.cellX, agent.cellY));
                agent.cellX = step.x;
                agent.cellY = step.y;
                world.agentsByCell.set(key(agent.cellX, agent.cellY), agent.id);
                agent.pathIdx++;
                agent.energy -= TUNE.moveEnergy;
                if (world.crops.has(key(agent.cellX, agent.cellY)))
                  _SimulationEngine._harvestAt(world, agent, agent.cellX, agent.cellY);
              } else {
                agent.path = null;
              }
            } else {
              agent.path = null;
            }
            if (!agent.path) {
              if (agent.energy < TUNE.energyLowThreshold) {
                if (Math.random() < 0.4) {
                  InteractionEngine.consider(world, agent);
                } else {
                  if (world.crops.has(key(agent.cellX, agent.cellY)))
                    _SimulationEngine._harvestAt(world, agent, agent.cellX, agent.cellY);
                  else _SimulationEngine._seekFoodWhenHungry(world, agent);
                }
              } else {
                InteractionEngine.consider(world, agent);
                if (!agent.path && !agent.action) RoamingStrategy.biasedRoam(world, agent);
              }
            }
            if (agent.energy >= 120 && Math.random() < 0.01)
              _SimulationEngine._tryBuildFarm(world, agent);
          }
        }
        agent.clampStats();
        if (agent.energy === 0) {
          agent.health -= TUNE.starveHpPerSec * BASE_TICK_MS / 1e3;
        }
        if (agent.energy >= ENERGY_CAP * 0.8) {
          agent.healBy(TUNE.regenHpPerSec * BASE_TICK_MS / 1e3);
        }
      }
      if (world.tick % 4 === 0) FactionManager.reconcile(world);
      _SimulationEngine._applyFlagHealing(world);
      _SimulationEngine._cleanDead(world);
    }
  };

  // src/domains/persistence/persistence-manager.ts
  var PersistenceManager = class _PersistenceManager {
    static serialize(world) {
      const factions = [...world.factions.values()].map((f) => ({
        id: f.id,
        color: f.color,
        members: [...f.members]
      }));
      const flags = [...world.flags.values()];
      const walls = [...world.walls.values()];
      const farms = [...world.farms.values()];
      const crops = [...world.crops.values()];
      const agents = world.agents.map((a) => ({
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
        action: a.action ? {
          type: a.action.type,
          remainingMs: a.action.remainingMs,
          tickCounterMs: a.action.tickCounterMs,
          payload: a.action.payload || null
        } : null,
        lockMsRemaining: a.lockMsRemaining,
        travelPref: a.travelPref,
        aggression: a.aggression,
        cooperation: a.cooperation
      }));
      return {
        meta: { version: VERSION, savedAt: Date.now() },
        grid: { CELL, GRID },
        state: {
          tick: world.tick,
          speedPct: world.speedPct,
          spawnMult: world.spawnMult,
          drawGrid: world.drawGrid
        },
        factions,
        flags,
        walls,
        farms,
        crops,
        agents,
        log: { limit: world.log.limit, arr: world.log.arr },
        selectedId: world.selectedId,
        activeLogCats: [...world.activeLogCats],
        activeLogAgentId: world.activeLogAgentId || null
      };
    }
    static export(world, doRenderLog) {
      const blob = new Blob([JSON.stringify(_PersistenceManager.serialize(world))], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "emoji_life_" + (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-") + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 0);
      world.log.push({
        t: performance.now(),
        cat: "info",
        msg: "State exported",
        actorId: null,
        extra: {}
      });
      doRenderLog();
    }
    static restore(world, data, opts) {
      const d = data;
      world.running = false;
      world.grid.clear();
      world.agents.length = 0;
      world.agentsById.clear();
      world.factions.clear();
      world.tick = d.state?.tick ?? 0;
      world.speedPct = d.state?.speedPct ?? world.speedPct;
      world.spawnMult = d.state?.spawnMult ?? world.spawnMult;
      world.drawGrid = d.state?.drawGrid ?? true;
      for (const f of d.factions || []) {
        const faction = new Faction(f.id, f.color, new Set(f.members || []));
        world.factions.set(f.id, faction);
      }
      for (const fl of d.flags || []) {
        world.flags.set(fl.factionId, { ...fl });
        world.flagCells.add(key(fl.x, fl.y));
      }
      for (const w of d.walls || [])
        world.walls.set(key(w.x, w.y), { ...w });
      for (const fm of d.farms || [])
        world.farms.set(key(fm.x, fm.y), { ...fm });
      for (const c of d.crops || [])
        world.crops.set(key(c.x, c.y), { ...c });
      for (const a of d.agents || []) {
        let action = a.action ? { ...a.action } : null;
        if (action?.payload?.targetId && !(d.agents || []).some((x) => x.id === action.payload.targetId)) {
          action = null;
        }
        const agent = new Agent({
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
          action,
          lockMsRemaining: a.lockMsRemaining || 0,
          travelPref: a.travelPref || "near",
          aggression: a.aggression ?? Math.random(),
          cooperation: a.cooperation ?? Math.random()
        });
        world.agents.push(agent);
        world.agentsById.set(agent.id, agent);
        world.agentsByCell.set(key(agent.cellX, agent.cellY), agent.id);
      }
      FactionManager.reconcile(world);
      if (world._rebuildAgentOptions) world._rebuildAgentOptions();
      opts.doRenderLog();
      world.log.push({
        t: performance.now(),
        cat: "info",
        msg: "State loaded",
        actorId: null,
        extra: {}
      });
      if (opts.gridChk) opts.gridChk.checked = world.drawGrid;
    }
  };

  // src/domains/ui/controls.ts
  function seedEnvironment(world) {
    for (let i = 0; i < 4; i++) {
      const x = rndi(5, 56);
      const y = rndi(5, 56);
      world.farms.set(key(x, y), { id: uuid(), x, y });
    }
  }
  var Controls = class {
    static wire(world, dom, doRenderLog) {
      const { buttons, ranges, labels, nums } = dom;
      function spawnAgents(n) {
        for (let i = 0; i < n; i++) {
          const { x, y } = world.grid.randomFreeCell();
          AgentFactory.create(world, x, y);
        }
      }
      const $clamp = (v, min, max) => isNaN(v) ? min : Math.max(min, Math.min(max, v));
      ranges.rngAgents?.addEventListener("input", () => {
        if (labels.lblAgents) labels.lblAgents.textContent = ranges.rngAgents.value;
        if (nums.numAgents) nums.numAgents.value = ranges.rngAgents.value;
      });
      ranges.rngSpeed?.addEventListener("input", () => {
        if (labels.lblSpeed) labels.lblSpeed.textContent = ranges.rngSpeed.value + "%";
        if (nums.numSpeed) nums.numSpeed.value = ranges.rngSpeed.value;
        world.speedPct = Number(ranges.rngSpeed.value);
      });
      ranges.rngSpawn?.addEventListener("input", () => {
        if (labels.lblSpawn) labels.lblSpawn.textContent = Number(ranges.rngSpawn.value).toFixed(1) + "\xD7";
        if (nums.numSpawn) nums.numSpawn.value = ranges.rngSpawn.value;
        world.spawnMult = Number(ranges.rngSpawn.value);
      });
      nums.numAgents?.addEventListener("input", () => {
        const v = $clamp(Number(nums.numAgents.value), 20, 300);
        nums.numAgents.value = String(v);
        if (ranges.rngAgents) ranges.rngAgents.value = String(v);
        if (labels.lblAgents) labels.lblAgents.textContent = String(v);
      });
      nums.numSpeed?.addEventListener("input", () => {
        const v = $clamp(Number(nums.numSpeed.value), 5, 300);
        nums.numSpeed.value = String(v);
        if (ranges.rngSpeed) ranges.rngSpeed.value = String(v);
        if (labels.lblSpeed) labels.lblSpeed.textContent = v + "%";
        world.speedPct = v;
      });
      nums.numSpawn?.addEventListener("input", () => {
        const v = $clamp(Number(nums.numSpawn.value), 0.1, 5);
        nums.numSpawn.value = String(v);
        if (ranges.rngSpawn) ranges.rngSpawn.value = String(v);
        if (labels.lblSpawn) labels.lblSpawn.textContent = v.toFixed(1) + "\xD7";
        world.spawnMult = v;
      });
      buttons.btnStart?.addEventListener("click", () => {
        if (world.running) return;
        world.grid.clear();
        world.agents.length = 0;
        world.agentsById.clear();
        world.factions.clear();
        world.log = new RingLog(200);
        world.tick = 0;
        world.selectedId = null;
        world.activeLogCats = new Set(LOG_CATS);
        UIManager.setupLogFilters(world, dom.logFilters, doRenderLog);
        world.speedPct = Number(ranges.rngSpeed?.value || 50);
        world.spawnMult = Number(ranges.rngSpawn?.value || 1);
        seedEnvironment(world);
        spawnAgents(Number(ranges.rngAgents?.value || 20));
        world.running = true;
        if (buttons.btnStart) buttons.btnStart.disabled = true;
        if (buttons.btnPause) buttons.btnPause.disabled = false;
        if (buttons.btnResume) buttons.btnResume.disabled = true;
        world.log.push({
          t: performance.now(),
          cat: "info",
          msg: "Simulation started",
          actorId: null,
          extra: {}
        });
      });
      buttons.btnPause?.addEventListener("click", () => {
        world.running = false;
        if (buttons.btnPause) buttons.btnPause.disabled = true;
        if (buttons.btnResume) buttons.btnResume.disabled = false;
      });
      buttons.btnResume?.addEventListener("click", () => {
        world.running = true;
        if (buttons.btnPause) buttons.btnPause.disabled = false;
        if (buttons.btnResume) buttons.btnResume.disabled = true;
      });
      buttons.btnSpawnCrop?.addEventListener("click", () => {
        const { x, y } = world.grid.randomFreeCell();
        SimulationEngine.addCrop(world, x, y);
      });
      buttons.btnSave?.addEventListener("click", () => PersistenceManager.export(world, doRenderLog));
      buttons.btnLoad?.addEventListener("click", () => dom.fileLoad?.click());
      dom.fileLoad?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            PersistenceManager.restore(world, data, { doRenderLog, gridChk: dom.gridChk });
            if (buttons.btnPause) buttons.btnPause.disabled = true;
            if (buttons.btnResume) buttons.btnResume.disabled = false;
            if (buttons.btnStart) buttons.btnStart.disabled = true;
          } catch (err) {
            alert("Failed to load save: " + err.message);
          } finally {
            if (dom.fileLoad) dom.fileLoad.value = "";
          }
        };
        reader.readAsText(file);
      });
    }
  };

  // src/main.ts
  document.addEventListener("DOMContentLoaded", () => {
    document.title = `Emoji Life \u2014 v${VERSION}`;
    const versionEl = document.querySelector(".sidebar-version");
    if (versionEl) versionEl.textContent = `V${VERSION}`;
    const dom = UIManager.bindDom();
    const world = new World();
    window.world = world;
    if (dom.pauseChk) {
      dom.pauseChk.checked = world.pauseOnBlur;
      dom.pauseChk.addEventListener("change", () => world.pauseOnBlur = dom.pauseChk.checked);
    }
    if (dom.gridChk) {
      dom.gridChk.checked = world.drawGrid;
      dom.gridChk.addEventListener("change", () => world.drawGrid = dom.gridChk.checked);
    }
    const doRenderLog = () => UIManager.renderLog(world, dom.logList);
    UIManager.setupLogFilters(world, dom.logFilters, doRenderLog);
    const canvas = dom.canvas;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    const factionsList = dom.factionsList;
    const camera = new Camera();
    const renderer = new Renderer();
    function refreshCanvasSize() {
      const { cw, ch } = Camera.setCanvasSize(canvas);
      camera.viewW = cw;
      camera.viewH = ch;
      camera.fitToCanvas(canvas);
    }
    refreshCanvasSize();
    window.addEventListener("resize", refreshCanvasSize);
    InputHandler.setup(canvas, camera, world, dom);
    Controls.wire(world, dom, doRenderLog);
    const sidebarPlay = document.getElementById("sidebarPlay");
    if (sidebarPlay) {
      sidebarPlay.addEventListener("click", () => {
        if (!world.running && world.tick === 0) {
          dom.buttons.btnStart?.click();
        } else if (!world.running) {
          dom.buttons.btnResume?.click();
        } else {
          dom.buttons.btnPause?.click();
        }
      });
    }
    let lastTs = 0;
    let acc = 0;
    let fps = 0;
    let fpsAcc = 0;
    let fpsCount = 0;
    const statsWithFps = new Proxy(
      { ...dom.statsEls, ...dom.barEls },
      {
        get(target, prop) {
          if (prop === "fps") return fps;
          return target[prop];
        }
      }
    );
    function pauseForBlur(reason) {
      if (world.pauseOnBlur && world.running) {
        world.running = false;
        if (dom.buttons.btnPause) dom.buttons.btnPause.disabled = true;
        if (dom.buttons.btnResume) dom.buttons.btnResume.disabled = false;
        world.log.push({
          t: performance.now(),
          cat: "info",
          msg: "Paused (" + reason + ")",
          actorId: null,
          extra: {}
        });
        doRenderLog();
      }
    }
    window.addEventListener("blur", () => pauseForBlur("window lost focus"));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseForBlur("tab hidden");
    });
    let lastSelectedId = null;
    setInterval(() => {
      UIManager.updateInspector(world, dom.inspector);
      UIManager.renderHUD(world, dom.hud, statsWithFps);
      doRenderLog();
      if (world._rebuildAgentOptions) {
        if (world._lastAgentCount !== world.agents.length) {
          world._rebuildAgentOptions();
          world._lastAgentCount = world.agents.length;
        }
      }
      UIManager.rebuildFactionsListIfNeeded(world, factionsList);
      if (world.selectedId && world.selectedId !== lastSelectedId) {
        const agent = world.agentsById.get(world.selectedId);
        if (agent) UIManager.showNotification(agent);
      }
      lastSelectedId = world.selectedId;
    }, 400);
    const MAX_STEPS = 8;
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
        let steps = 0;
        while (acc >= effTick && steps < MAX_STEPS) {
          SimulationEngine.tick(world);
          acc -= effTick;
          steps++;
        }
        if (steps === MAX_STEPS) acc = 0;
        const lerpDelta = dt / (BASE_TICK_MS / (world.speedPct / 100));
        for (const a of world.agents) {
          if (a.lerpT < 1) {
            a.lerpT = Math.min(1, a.lerpT + lerpDelta);
          }
        }
      }
      renderer.render(world, ctx, canvas, camera);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
})();
