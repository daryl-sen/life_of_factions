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
  | 'sleep';

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
  | 'eat';

export type PaintMode = 'none' | 'draw' | 'erase';

export interface IActionState {
  type: ActionType;
  remainingMs: number;
  tickCounterMs: number;
  payload: IActionPayload | null;
}

export interface IActionPayload {
  targetId?: string;
}

export interface ILogEntry {
  t: number;
  cat: LogCategory;
  msg: string;
  actorId: string | null;
  extra: Record<string, unknown>;
}

export interface ICrop {
  id: string;
  x: number;
  y: number;
  emoji: string;
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
