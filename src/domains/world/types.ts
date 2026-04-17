// Block and world-level types — moved from shared/types.ts

export type FoodQuality = 'hq' | 'lq';

export type TreeVariant = 'tropical' | 'evergreen' | 'regular';

export type ObstacleCategory = 'mountain' | 'rock' | 'wood';

export interface IFoodBlock {
  id: string;
  x: number;
  y: number;
  emoji: string;
  quality: FoodQuality;
  units: number;
  maxUnits: number;
}

export interface IFarm {
  id: string;
  x: number;
  y: number;
  spawnsRemaining: number;
  spawnTimerMs: number;
  occupantId: string | null;
}

export interface IObstacle {
  id: string;
  x: number;
  y: number;
  emoji: string;
  category: ObstacleCategory;
  hp: number;
  maxHp: number;
  size?: '2x2';
}

export interface IFlagStorage {
  food: number;
  water: number;
  wood: number;
}

export interface IFlag {
  id: string;
  factionId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  storage: IFlagStorage;
}

export interface ILootBag {
  id: string;
  x: number;
  y: number;
  inventory: { food: number; water: number; wood: number };
  decayMs: number;
}

export interface IWaterBlock {
  id: string;
  x: number;
  y: number;
  units: number;
  maxUnits: number;
  size: 'small' | 'large';
  cells: Array<{ x: number; y: number }>;
}

export interface ITreeBlock {
  id: string;
  x: number;
  y: number;
  emoji: string;
  variant: TreeVariant;
  units: number;
  maxUnits: number;
  ageTotalMs: number;
  maxAgeMs: number;
}

export interface ISeedling {
  id: string;
  x: number;
  y: number;
  variant: TreeVariant;
  plantedAtTick: number;
  growthDurationMs: number;
  growthElapsedMs: number;
}

export interface IMedicineBlock {
  id: string;
  x: number;
  y: number;
}

export interface IFlowerBlock {
  id: string;
  x: number;
  y: number;
  emoji: string;
  lifespanMs: number;
}

export interface ICactusBlock {
  id: string;
  x: number;
  y: number;
  units: number;
  maxUnits: number;
}

export interface ICloud {
  id: string;
  x: number;
  y: number;
  xF: number;
  spawnedAtMs: number;
  lifetimeMs: number;
  totalLifetimeMs: number;
  rained: boolean;
  decorative?: boolean;
}

export interface IPoopBlock {
  id: string;
  x: number;
  y: number;
  decayMs: number;
}

export interface IEgg {
  id: string;
  x: number;
  y: number;
  hatchTimerMs: number;
}

export interface ISaltWaterBlock {
  id: string;
  x: number;
  y: number;
}

export type HouseTier = 'tent' | 'house' | 'big_house' | 'settlement';

export interface IHouse {
  id: string;
  x: number;
  y: number;
  tier: HouseTier;
  emoji: string;
  hp: number;
  maxHp: number;
  capacity: number;
  size: '1x1' | '2x2';
  cells: Array<{ x: number; y: number }>;
  ownerId: string;
  familyName: string;
  occupantIds: string[];
  decayTimerMs: number;
}

export type PaintMode = 'none' | 'draw' | 'erase' | 'replenish' | 'paintSaltWater' | 'paintLand';

export type DeathCause = 'hunger' | 'killed' | 'disease' | 'old_age' | 'tree';

export interface DeadAgentMarker {
  cellX: number;
  cellY: number;
  cause: DeathCause;
  msRemaining: number;
}
