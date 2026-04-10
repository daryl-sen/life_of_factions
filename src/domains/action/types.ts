export type ActionType =
  | 'talk'
  | 'quarrel'
  | 'attack'
  | 'hunt'
  | 'heal'
  | 'share'
  | 'reproduce'
  | 'sleep'
  | 'harvest'
  | 'eat'
  | 'drink'
  | 'drink_saltwater'
  | 'wash'
  | 'deposit'
  | 'withdraw'
  | 'pickup'
  | 'poop'
  | 'clean'
  | 'play'
  | 'build_farm'
  | 'seek_mate'
  | 'await_mate'
  | 'photosynthesize'
  | 'idle';

export enum ActionTag {
  COMBAT   = 'combat',
  SOCIAL   = 'social',
  HELPFUL  = 'helpful',
  SURVIVAL = 'survival',
  RESOURCE = 'resource',
  BUILD    = 'build',
  HYGIENE  = 'hygiene',
  LEISURE  = 'leisure',
  FACTION  = 'faction',
}

export type ActionTargetType = 'self' | 'external_cell' | 'area' | 'none';

export interface ActionDef {
  readonly type: ActionType;
  readonly tags: ReadonlySet<ActionTag>;
  /** Base cost; actual per-organism cost computed via cost-functions.ts */
  readonly baseEnergyCost: number;
  readonly durationRange: readonly [number, number];
  readonly requiresTarget: boolean;
  readonly targetType: ActionTargetType;
  readonly targetRange: number;
  readonly interruptible: boolean;
  /** Tool emoji displayed between organism and target (only for external_cell targets) */
  readonly tool: string | null;
}

export interface IActionState {
  type: ActionType;
  remainingMs: number;
  tickCounterMs: number;
  payload: IActionPayload | null;
  startedAtMs: number;
  totalMs: number;
  target?: { x: number; y: number } | null;
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
  | 'hunt'
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
