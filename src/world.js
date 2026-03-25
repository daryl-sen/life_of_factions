import { GRID, TUNE, LOG_CATS } from './constants.js';
import { RingLog } from './utils.js';

export class World {
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
    this.pauseOnBlur = false;
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
    this.drawGrid = false;
  }
}
