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
  | 'await_mate'
  | 'build_house'
  | 'upgrade_house'
  | 'enter_house'
  | 'exit_house'
  | 'sleep_in_house';

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
  /** Base energy cost per second. v4.2: renamed from energyCost; actual per-agent cost computed via cost-functions. */
  readonly baseEnergyCost: number;
  readonly durationRange: readonly [number, number];
  readonly requiresTarget: boolean;
  /** 'external_cell': action targets another cell (enables tool rendering when tool != null). */
  readonly targetType: 'self' | 'external_cell' | 'area' | 'none';
  readonly targetRange: number;
  readonly interruptible: boolean;
  /** Tool emoji rendered between agent and target during the action, or null for no tool. */
  readonly tool: string | null;
  /** Rotation offset (radians) to align the tool emoji toward the target. Defaults to Math.PI * 1.25 if omitted. */
  readonly toolRotationOffset?: number;
}

export interface IActionState {
  type: ActionType;
  remainingMs: number;
  tickCounterMs: number;
  payload: IActionPayload | null;
  startedAtMs: number;
  totalMs: number;
  /** Per-second energy cost for this action, computed at creation time via cost-functions (includes trait + level scaling). */
  energyCostPerTick: number;
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
  | 'hygiene'
  | 'housing';

export interface ILogEntry {
  t: number;
  cat: LogCategory;
  msg: string;
  actorId: string | null;
  extra: Record<string, unknown>;
}
