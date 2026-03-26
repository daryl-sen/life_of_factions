import type { ActionType, LogCategory } from './types';

export const CELL = 16;
export const GRID = 62;
export const WORLD_PX: number = GRID * CELL;
export const BASE_TICK_MS = 250;
export const ENERGY_CAP = 200;

export const TUNE = {
  moveEnergy: 0.12,
  actionCost: {
    talk: 0.2,
    quarrel: 0.4,
    attack: 1.1,
    heal: 1.5,
    share: 0.4,
    attack_flag: 1.0,
    reproduce: 1.5,
    sleep: 0,
    harvest: 0.25,
    eat: 0,
    drink: 0,
    deposit: 0,
    withdraw: 0,
    pickup: 0,
    poop: 0,
    clean: 0.25,
    play: 0.15,
    build_farm: 0.25,
  } as Record<ActionType, number>,
  cropGain: 28,
  starveHpPerSec: 1.0,
  regenHpPerSec: 0.5,
  healAuraRadius: 4,
  healAuraPerTick: 3.75,
  baseDamage: 8,
  flagHp: [12, 18] as [number, number],
  farmBoostRadius: 3,
  farmEnergyCost: 12,
  buildFarmChance: 3.125e-2,
  factionThreshold: 0.5,
  factionMinSize: 2,
  factionFormRelThreshold: 0.6,
  shareConvertChance: 0.5,
  shareConvertRelThreshold: 0.4,
  energyLowThreshold: 40,
  levelCap: 20,
  maxCrops: 100,
  reproduction: { relationshipThreshold: 0.1, relationshipEnergy: 85 },
  pathBudgetPerTick: 30,
  fullness: {
    max: 100,
    start: 50,
    passiveDecay: 0.03,
    moveDecay: 0.08,
    actionDecayPerSec: 0.02,
    cropGain: 20,
    regenThreshold: 90,
    seekThreshold: 40,
    criticalThreshold: 20,
  },
  needs: {
    hygieneStart: 50,
    socialStart: 50,
    inspirationStart: 50,
  },
  xp: {
    perKill: 50,
    perEat: 5,
    perHeal: 10,
    perShare: 5,
    perBuildFarm: 15,
    perHarvest: 2,
    perLevel: 50,
  },
  maxEnergyBase: 200,
  maxEnergyPerLevel: 5,
  sleep: {
    energyPerTick: 8,
    mandatoryThreshold: 20,
    voluntaryThreshold: 80,
  },
  inventory: {
    capacity: 20,
  },
  harvest: {
    costPerSec: 0.25,
    duration: {
      food_hq: 600,
      food_lq: 1200,
      water: 1000,
      wood: 1500,
    } as Record<string, number>,
  },
  eat: {
    duration: [300, 500] as [number, number],
    poopWindowMs: 30000,
    poopChance: 0.10,
  },
  drink: {
    duration: [300, 500] as [number, number],
    hygieneGain: 30,
  },
  foodBlock: {
    hqUnits: [2, 4] as [number, number],
    lqUnits: [1, 2] as [number, number],
  },
  water: {
    smallUnits: 5,
    largeUnits: 20,
    spawnRange: [3, 6] as [number, number],
    shrinkThreshold: 0.25,
  },
  tree: {
    spawnRange: [8, 15] as [number, number],
    unitRange: [3, 6] as [number, number],
    seedlingChanceOnHarvest: 0.10,
    seedlingPassiveChance: 0.002,
    foodChanceOnHarvest: 0.05,
    foodPassiveChance: 0.01,
    seedlingRadius: 5,
    seedlingGrowthRange: [45000, 90000] as [number, number],
    foodRadius: 3,
  },
  cloud: {
    spawnIntervalRange: [60000, 120000] as [number, number],
    lifetimeRange: [5000, 10000] as [number, number],
    smallChance: 0.9,
  },
  hygiene: {
    criticalThreshold: 20,
    seekThreshold: 40,
    moveDecay: 0.05,
    socialDecay: 0.5,
    poopDecay: 5,
    stepOnPoopDecay: 5,
  },
  poop: {
    decayMs: 30000,
    chancePerTick: 0.10,
  },
  clean: {
    inspirationGain: 10,
  },
  disease: {
    contractionThreshold: 20,
    contractionChance: 0.05,
    spreadChance: 0.03,
    spreadBlockThreshold: 60,
    cureHygieneThreshold: 80,
    energyDrainMultiplier: 2,
    hpDrainPerSec: 0.5,
  },
  flagStorage: {
    capacityPerType: 30,
  },
  lootBag: {
    decayMs: 30000,
  },
  share: {
    sharerSocial: 8,
    recipientSocial: 5,
    relationshipGain: 0.14,
  },
  inspiration: {
    passiveDecay: 0.015,
    seekThreshold: 40,
    playGain: 15,
    buildGain: 25,
    lowThreshold: 20,
    highThreshold: 70,
    lowMultiplier: 1.5,
    highMultiplier: 0.75,
  },
  farm: {
    woodCost: 3,
    energyCost: 6,
    maxSpawns: 10,
    maxFoodInRadius: 4,
    spawnRadius: 1,
    spawnIntervalRange: [15000, 25000] as [number, number],
  },
  play: {
    hygienePoopPenalty: 3,
  },
} as const;

export const ACTION_DURATIONS: Record<ActionType, [number, number]> = {
  talk: [900, 1800],
  quarrel: [900, 1800],
  attack: [450, 900],
  heal: [900, 1800],
  share: [300, 500],
  attack_flag: [1000, 2000],
  reproduce: [2000, 3200],
  sleep: [8000, 12000],
  harvest: [600, 1500],
  eat: [300, 500],
  drink: [300, 500],
  deposit: [300, 500],
  withdraw: [300, 500],
  pickup: [300, 500],
  poop: [500, 1000],
  clean: [800, 1200],
  play: [1500, 2500],
  build_farm: [2000, 2000],
};


export const COLORS = {
  agentFill: '#e6e9ff',
  crop: '#3adf7e',
  farm: '#edd65a',
  obstacle: '#9aa2d6',
  obstacleDam: '#ff7b8b',
  flagPole: '#c7c7d2',
  hp: '#60e6a8',
  energy: '#7bdcff',
  grid: '#1a1e3f',
  attackLine: '#ff6d7a',
} as const;

export const FACTION_COLORS: readonly string[] = [
  '#ff5252',
  '#42a5f5',
  '#66bb6a',
  '#ffa726',
  '#ab47bc',
  '#26c6da',
  '#ec407a',
  '#8d6e63',
];

export const AGENT_EMOJIS: Record<string, string> = {
  talk: '😄',
  quarrel: '😤',
  attack: '😡',
  heal: '🤗',
  share: '🫢',
  reproduce: '😍',
  sleep: '😴',
  harvest: '🫨',
  eat: '🤔',
  drink: '🤔',
  deposit: '📦',
  withdraw: '📦',
  pickup: '🤔',
  poop: '😣',
  clean: '🧹',
  play: '🤪',
  build_farm: '🌾',
};

export const IDLE_EMOJIS = {
  lowEnergy: '🤤',
  lowHealth: '🤕',
  lowFullness: '😩',
  diseased: '🤢',
  highEnergy: '😀',
  default: '🙂',
};

export const FOOD_EMOJIS = {
  hq: ['🥔', '🍎', '🍑', '🌽', '🍅'],
  lq: ['🌿', '🥬', '🥦', '🍀'],
} as const;

export const OBSTACLE_EMOJIS = ['🪨', '⛰️', '🗻', '🏔️', '🪵'] as const;

export const WORLD_EMOJIS = {
  farm: '🏡',
  obstacle: '🪨',
  flag: '🚩',
  water: '💦',
  cloud: '🌧️',
  seedling: '🌱',
  lootBag: '👝',
  poop: '💩',
} as const;

export const TREE_EMOJIS: readonly string[] = ['🌲', '🌳', '🌴', '🎄'];

export const LOG_CATS: readonly LogCategory[] = [
  'talk',
  'quarrel',
  'attack',
  'heal',
  'share',
  'reproduce',
  'build',
  'destroy',
  'death',
  'faction',
  'level',
  'spawn',
  'info',
  'sleep',
  'eat',
  'harvest',
  'loot',
  'hygiene',
];
