import type { IPosition, IInventory } from '../../core/types';
import type { Genome } from '../genetics';
import type { IActionState } from '../action/types';

export type EntityClassName = 'baby' | 'adult' | 'elder';

export enum NeedBand {
  CRITICAL = 'critical',
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  FULL = 'full',
}

export enum Mood {
  FRUSTRATED = 'frustrated',
  UNHAPPY = 'unhappy',
  CONTENT = 'content',
  HAPPY = 'happy',
}

export interface AgentOpts {
  id: string;
  name: string;
  cellX: number;
  cellY: number;
  genome: Genome;
  familyName: string;

  // Optional overrides (used for save/load)
  health?: number;
  energy?: number;
  level?: number;
  xp?: number;
  ageTicks?: number;
  maxAgeTicks?: number;
  factionId?: string | null;
  relationships?: Map<string, number>;
  path?: IPosition[] | null;
  pathIdx?: number;
  action?: IActionState | null;
  lockMsRemaining?: number;
  replanAtTick?: number;
  goal?: IPosition | null;
  fullness?: number;
  hygiene?: number;
  social?: number;
  inspiration?: number;
  inventory?: IInventory;
  poopTimerMs?: number;
  diseased?: boolean;
  babyMsRemaining?: number;
  entityClass?: EntityClassName;
  generation?: number;
  matingTargetId?: string | null;
  parentIds?: string[];
}
