import type { LogCategory } from '../domains/action/types';
import type { TreeVariant, ObstacleCategory, HouseTier } from '../domains/world/types';

export const CELL_PX = 16;
export let GRID_SIZE = 62;
export let WORLD_PX: number = GRID_SIZE * CELL_PX;

export function setGridSize(size: number): void {
  GRID_SIZE = size;
  WORLD_PX = GRID_SIZE * CELL_PX;
}

export const TICK_MS = 250;
export const LEVEL_CAP = 20;
export const PATH_BUDGET_PER_TICK = 30;

// ── Rendering Constants ──

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
  terrainDry: '#C4A946',
  terrainMud: '#8B7355',
  terrainGrass: '#5C7A3A',
  terrainSaltWater: '#2B5A7B',
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

export interface HouseTierConfig {
  readonly capacity: number;
  readonly size: '1x1' | '2x2';
  readonly hp: number;
  readonly woodCost: number;
  readonly emoji: string;
}

export const HOUSE_TIER_CONFIG: Record<HouseTier, HouseTierConfig> = {
  tent:        { capacity: 2, size: '1x1', hp: 20, woodCost: 3,  emoji: '\u26FA' },          // ⛺
  house:       { capacity: 4, size: '1x1', hp: 35, woodCost: 5,  emoji: '\u{1F3E0}' },       // 🏠
  big_house:   { capacity: 6, size: '2x2', hp: 50, woodCost: 8,  emoji: '\u{1F3E0}' },       // 🏠
  settlement:  { capacity: 8, size: '2x2', hp: 70, woodCost: 12, emoji: '\u{1F3D8}\uFE0F' }, // 🏘️
};

export const HOUSE_DECAY_INTERVAL_MS = 60_000;
export const HOUSE_DECAY_AMOUNT = 1;
export const HOUSE_SLEEP_ENERGY_BONUS = 1.5;
export const HOUSE_DERELICT_EMOJI = '\u{1F3DA}\uFE0F'; // 🏚️
export const HOUSE_RUBBLE_EMOJI = '\u{1FAB5}';          // 🪵 (wood log)

export const AGENT_EMOJIS: Record<string, string> = {
  talk: '\u{1F604}',      // 😄
  quarrel: '\u{1F624}',   // 😤
  attack: '\u{1F621}',    // 😡
  heal: '\u{1F917}',      // 🤗
  share: '\u{1FAE2}',     // 🫢
  reproduce: '\u{1F60D}', // 😍
  sleep: '\u{1F634}',     // 😴
  harvest: '\u{1FAE8}',   // 🫨
  eat: '\u{1F914}',       // 🤔
  wash: '\u{1F914}',      // 🤔
  deposit: '\u{1F617}',   // 😗
  withdraw: '\u{1F617}',  // 😗
  pickup: '\u{1F914}',    // 🤔
  poop: '\u{1F623}',      // 😣
  clean: '\u{1F637}',     // 😷
  play: '\u{1F92A}',      // 🤪
  build_farm: '\u{1F920}',  // 🤠
  seek_mate: '\u{1F495}',  // 💕
  await_mate: '\u{1F497}', // 💗
  build_house: '\u{1F6E0}\uFE0F',  // 🛠️
  upgrade_house: '\u{1F528}',      // 🔨
  enter_house: '\u{1F6B6}',        // 🚶
  exit_house: '\u{1F6B6}',         // 🚶
  sleep_in_house: '\u{1F634}',     // 😴
};

export const IDLE_EMOJIS = {
  baby: '\u{1F476}',        // 👶
  babyEating: '\u{1F47C}',  // 👼
  diseased: '\u{1F922}',    // 🤢
  // Mood-based idle emojis
  happy: '\u{1F600}',       // 😀
  content: '\u{1F642}',     // 🙂
  unhappy: '\u{1F629}',     // 😩
  frustrated: '\u{1F621}',  // 😡
  default: '\u{1F642}',     // 🙂
};

export const FOOD_EMOJIS = {
  hq: ['\u{1F954}', '\u{1F33D}', '\u{1F345}'],
  //    🥔           🌽           🍅
  lq: ['\u{1F96C}', '\u{1F966}', '\u{1F340}'],
  //    🥬           🥦           🍀
} as const;

export const OBSTACLE_EMOJIS = [
  '\u{1FAA8}',    // 🪨
  '\u26F0\uFE0F', // ⛰️
  '\u{1F5FB}',    // 🗻
  '\u{1F3D4}\uFE0F', // 🏔️
  '\u{1FAB5}',    // 🪵
] as const;

export const WORLD_EMOJIS = {
  farm:        '\u{1F3E1}',        // 🏡
  obstacle: '\u{1FAA8}',    // 🪨
  flag: '\u{1F6A9}',        // 🚩
  water: '\u{1F4A6}',       // 💦
  cloud: '\u{1F327}\uFE0F', // 🌧️
  seedling: '\u{1F331}',    // 🌱
  lootBag:     '\u{1F45D}',        // 👝
  poop:        '\u{1F4A9}',        // 💩
  egg:         '\u{1F95A}',        // 🥚
} as const;

export const TREE_VARIANT_EMOJI: Record<TreeVariant, string> = {
  tropical:  '\u{1F334}', // 🌴
  evergreen: '\u{1F332}', // 🌲
  regular:   '\u{1F333}', // 🌳
};

export const TREE_FRUIT_EMOJIS: readonly string[] = [
  '\u{1F34E}', // 🍎 apple
  '\u{1F350}', // 🍐 pear
  '\u{1F34A}', // 🍊 orange
  '\u{1F34B}', // 🍋 lemon
  '\u{1F351}', // 🍑 peach
  '\u{1F352}', // 🍒 cherry
  '\u{1F34F}', // 🍏 green apple
] as const;

export const FLOWER_EMOJIS: readonly string[] = [
  '\u{1F339}', // 🌹
  '\u{1F33A}', // 🌺
  '\u{1F337}', // 🌷
  '\u{1F33B}', // 🌻
  '\u{1FAB7}', // 🪻
] as const;

export const FARM_CROP_EMOJI = '\u{1F33E}'; // 🌾

export const MEDICINE_EMOJI = '\u{1F33F}'; // 🌿

export const CACTUS_EMOJI = '\u{1F335}'; // 🌵

export const COCONUT_EMOJI = '\u{1F965}'; // 🥥

export const OBSTACLE_CATEGORY: Record<string, ObstacleCategory> = {
  '\u26F0\uFE0F':    'mountain', // ⛰️
  '\u{1F5FB}':       'mountain', // 🗻
  '\u{1F3D4}\uFE0F': 'mountain', // 🏔️
  '\u{1FAA8}':       'rock',     // 🪨
  '\u{1FAB5}':       'wood',     // 🪵
};

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
  'housing',
];
