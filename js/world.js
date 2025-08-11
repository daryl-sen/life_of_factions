// world.js
import { LOG_CATS } from "./constants.js";
import { RingLog } from "./utils.js";

export class World {
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
    this.activeLogCats = new Set(LOG_CATS);
    this.activeLogAgentId
    this.tick = 0;
    this.speedPct = 50;
    this.spawnMult = 1.0;
    this.running = false;
    this.selectedId = null;
  }
}
