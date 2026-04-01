export type ActionType =
  | 'talk'
  | 'quarrel'
  | 'attack'
  | 'heal'
  | 'share'
  | 'reproduce'
  | 'sleep'
  | 'harvest'
  | 'eat'
  | 'wash'
  | 'deposit'
  | 'withdraw'
  | 'pickup'
  | 'poop'
  | 'clean'
  | 'play'
  | 'build_farm'
  | 'seek_mate'
  | 'await_mate';

export enum ActionTag {
  COMBAT = 'combat',
  SOCIAL = 'social',
  HELPFUL = 'helpful',
  SURVIVAL = 'survival',
  RESOURCE = 'resource',
  BUILD = 'build',
  HYGIENE = 'hygiene',
  LEISURE = 'leisure',
  FACTION = 'faction',
}

export interface ActionDef {
  readonly type: ActionType;
  readonly tags: ReadonlySet<ActionTag>;
  readonly energyCost: number;
  readonly durationRange: readonly [number, number];
  readonly requiresTarget: boolean;
  readonly targetRange: number;
  readonly interruptible: boolean;
}

export interface IActionState {
  type: ActionType;
  remainingMs: number;
  tickCounterMs: number;
  payload: IActionPayload | null;
  startedAtMs: number;
  totalMs: number;
}

export interface IActionPayload {
  targetId?: string;
  targetPos?: { x: number; y: number };
  resourceType?: string;
  amount?: number;
}

export type LogCategory =
  | 'talk'
  | 'quarrel'
  | 'attack'
  | 'heal'
  | 'share'
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
  | 'harvest'
  | 'loot'
  | 'hygiene';

export interface ILogEntry {
  t: number;
  cat: LogCategory;
  msg: string;
  actorId: string | null;
  extra: Record<string, unknown>;
}
