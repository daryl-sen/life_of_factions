import type { LogCategory } from '../domains/action/types';

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
  build_farm: '\u{1F920}',// 🤠
  seek_mate: '\u{1F495}', // 💕
  await_mate: '\u{1F497}',// 💗
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
  hq: ['\u{1F954}', '\u{1F34E}', '\u{1F351}', '\u{1F33D}', '\u{1F345}'],
  //    🥔           🍎           🍑           🌽           🍅
  lq: ['\u{1F33F}', '\u{1F96C}', '\u{1F966}', '\u{1F340}'],
  //    🌿           🥬           🥦           🍀
} as const;

export const OBSTACLE_EMOJIS = [
  '\u{1FAA8}',    // 🪨
  '\u26F0\uFE0F', // ⛰️
  '\u{1F5FB}',    // 🗻
  '\u{1F3D4}\uFE0F', // 🏔️
  '\u{1FAB5}',    // 🪵
] as const;

export const WORLD_EMOJIS = {
  farm: '\u{1F3E1}',        // 🏡
  obstacle: '\u{1FAA8}',    // 🪨
  flag: '\u{1F6A9}',        // 🚩
  water: '\u{1F4A6}',       // 💦
  cloud: '\u{1F327}\uFE0F', // 🌧️
  seedling: '\u{1F331}',    // 🌱
  lootBag: '\u{1F45D}',     // 👝
  poop: '\u{1F4A9}',        // 💩
  egg: '\u{1F95A}',         // 🥚
} as const;

export const TREE_EMOJIS: readonly string[] = [
  '\u{1F332}', // 🌲
  '\u{1F333}', // 🌳
  '\u{1F334}', // 🌴
  '\u{1F384}', // 🎄
];

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
