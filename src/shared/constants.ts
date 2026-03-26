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
    help: 0.8,
    attack_flag: 1.0,
    reproduce: 1.5,
    sleep: 0,
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
  helpConvertChance: 0.5,
  helpConvertRelThreshold: 0.4,
  energyLowThreshold: 40,
  levelCap: 20,
  maxCrops: 100,
  reproduction: { relationshipThreshold: 0.1, relationshipEnergy: 85 },
  pathBudgetPerTick: 30,
  fullness: {
    max: 100,
    start: 100,
    passiveDecay: 0.03,
    moveDecay: 0.08,
    actionDecayPerSec: 0.02,
    cropGain: 20,
    regenThreshold: 90,
    seekThreshold: 40,
    criticalThreshold: 20,
  },
  needs: {
    hygieneStart: 100,
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
} as const;

export const ACTION_DURATIONS: Record<ActionType, [number, number]> = {
  talk: [900, 1800],
  quarrel: [900, 1800],
  attack: [450, 900],
  heal: [900, 1800],
  help: [900, 1800],
  attack_flag: [1000, 2000],
  reproduce: [2000, 3200],
  sleep: [8000, 12000],
};


export const COLORS = {
  agentFill: '#e6e9ff',
  crop: '#3adf7e',
  farm: '#edd65a',
  wall: '#9aa2d6',
  wallDam: '#ff7b8b',
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
  help: '🫢',
  reproduce: '😍',
  sleep: '😴',
};

export const IDLE_EMOJIS = {
  lowEnergy: '🤤',
  lowHealth: '🤕',
  lowFullness: '😩',
  highEnergy: '😀',
  default: '🙂',
};

export const WORLD_EMOJIS = {
  crops: ['🌿', '🌱', '🍀', '🌾', '🥕', '🍅', '🫛'],
  farm: '🏡',
  wall: '🪨',
  flag: '🚩',
} as const;

export const LOG_CATS: readonly LogCategory[] = [
  'talk',
  'quarrel',
  'attack',
  'heal',
  'help',
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
];
