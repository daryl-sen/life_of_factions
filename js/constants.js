// constants.js
export const CELL = 16;
export const GRID = 62;
export const WORLD_PX = GRID * CELL;
export const CANVAS_PX = 1000;
export const OFFSET = Math.floor((CANVAS_PX - WORLD_PX) / 2);

export const BASE_TICK_MS = 40;

// v1.3.5 tuned values
export const TUNE = {
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
  farmEnergyCost: 12,
  buildWallChance: 0.0002,
  buildFarmChance: 0.005, // “small, periodic” attempt when well-fed

  factionThreshold: 0.5,
  factionMinSize: 2,

  energyLowThreshold: 40, // override threshold
  foodPlanThreshold: 70, // seek food only when below this
  lowEnergyExploreRange: 14,

  levelCap: 20,
  maxCrops: 150,

  reproduction: {
    relationshipThreshold: 0.1,
    relationshipEnergy: 85,
  },

  helpConvertChance: 0.5,            // 50% by default
  helpConvertRelThreshold: 0.4,      // "good relationship" threshold
};

export const ACTION_DURATIONS = {
  talk: [900, 1800],
  quarrel: [900, 1800],
  attack: [450, 900], // faster attacks
  heal: [900, 1800],
  help: [900, 1800],
  attack_wall: [1000, 2000],
  attack_flag: [1000, 2000],
  reproduce: [2000, 3200],
};
export const ACTION_BASE_ADDED = 0;

export const COLORS = {
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

export const FACTION_COLORS = [
  "#ff5252",
  "#42a5f5",
  "#66bb6a",
  "#ffa726",
  "#ab47bc",
  "#26c6da",
  "#ec407a",
  "#8d6e63",
];

export const LOG_CATS = [
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
