export interface IPosition {
  readonly x: number;
  readonly y: number;
}

export type TravelPref = 'near' | 'far' | 'wander';

export type ActionType =
  | 'talk'
  | 'quarrel'
  | 'attack'
  | 'heal'
  | 'help'
  | 'attack_flag'
  | 'reproduce'
  | 'sleep'
  | 'harvest'
  | 'eat'
  | 'drink';

export type LogCategory =
  | 'talk'
  | 'quarrel'
  | 'attack'
  | 'heal'
  | 'help'
  | 'reproduce'
  | 'build'
  | 'destroy'
  | 'death'
  | 'faction'
  | 'level'
  | 'spawn'
  | 'info'
  | 'sleep'
  | 'eat'
  | 'harvest';

export type PaintMode = 'none' | 'draw' | 'erase';

export interface IActionState {
  type: ActionType;
  remainingMs: number;
  tickCounterMs: number;
  payload: IActionPayload | null;
}

export interface IActionPayload {
  targetId?: string;
  targetPos?: { x: number; y: number };
  resourceType?: string;
}

export interface ILogEntry {
  t: number;
  cat: LogCategory;
  msg: string;
  actorId: string | null;
  extra: Record<string, unknown>;
}

export type FoodQuality = 'hq' | 'lq';

export interface IFoodBlock {
  id: string;
  x: number;
  y: number;
  emoji: string;
  quality: FoodQuality;
  units: number;
  maxUnits: number;
}

export interface IInventory {
  food: number;
  water: number;
  wood: number;
}

export interface IFarm {
  id: string;
  x: number;
  y: number;
}

export interface IWall {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface IFlag {
  id: string;
  factionId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface ICameraState {
  x: number;
  y: number;
  scale: number;
  min: number;
  max: number;
  viewW: number;
  viewH: number;
}
