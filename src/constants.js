export const CELL = 16;
export const GRID = 62;
export const WORLD_PX = GRID * CELL;
export const BASE_TICK_MS = 40;
export const ENERGY_CAP = 200;
export const TUNE = {
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
export const ACTION_DURATIONS = {
  talk: [900, 1800],
  quarrel: [900, 1800],
  attack: [450, 900],
  heal: [900, 1800],
  help: [900, 1800],
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
  attackLine: "#ff6d7a",
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
  "reproduce",
  "build",
  "destroy",
  "death",
  "faction",
  "level",
  "spawn",
  "info",
];
