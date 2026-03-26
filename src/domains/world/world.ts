import { TUNE, LOG_CATS } from '../../shared/constants';
import { RingLog } from '../../shared/utils';
import type { LogCategory, PaintMode, ICloud } from '../../shared/types';
import type { Agent } from '../agent/agent';
import type { Faction } from '../faction/faction';
import { Grid } from './grid';
import { FoodField } from './food-field';
import { WaterField } from './water-field';

export type DeathCause = 'hunger' | 'killed' | 'disease' | 'old_age' | 'tree';

export interface DeadAgentMarker {
  cellX: number;
  cellY: number;
  cause: DeathCause;
  msRemaining: number;
}

export class World {
  readonly grid: Grid = new Grid();
  readonly foodField: FoodField = new FoodField();
  readonly waterField: WaterField = new WaterField();

  agents: Agent[] = [];
  readonly agentsById: Map<string, Agent> = new Map();
  readonly factions: Map<string, Faction> = new Map();

  log: RingLog = new RingLog(200);
  activeLogCats: Set<LogCategory> = new Set(LOG_CATS);
  activeLogAgentId: string | null = null;

  tick = 0;
  totalBirths = 0;
  totalDeaths = 0;

  // Death animation markers
  deadMarkers: DeadAgentMarker[] = [];

  // Birth/death timestamps for per-minute rate tracking
  birthTimestamps: number[] = [];
  deathTimestamps: number[] = [];
  speedPct = 100;
  cloudSpawnRate = 1;
  running = false;
  selectedId: string | null = null;
  paintMode: PaintMode = 'none';
  pauseOnBlur = false;
  drawGrid = false;
  factionSort: 'members' | 'created' | 'name' | 'level' = 'members';

  pathBudgetMax: number = Number.isFinite(TUNE.pathBudgetPerTick)
    ? TUNE.pathBudgetPerTick
    : 30;
  pathBudget = 0;
  _pathRR = 0;
  readonly _pathWhitelist: Set<string> = new Set();

  _lastFactionsDomAt = 0;
  _lastAgentCount = 0;
  _rebuildAgentOptions: (() => void) | null = null;
  _lastFactionsSig = '';

  // Ephemeral cloud state (not persisted)
  clouds: ICloud[] = [];
  _nextCloudSpawnMs = 0;

  // Convenience accessors that delegate to grid
  get obstacles() { return this.grid.obstacles; }
  get foodBlocks() { return this.grid.foodBlocks; }
  /** @deprecated Use foodBlocks */
  get crops() { return this.grid.foodBlocks; }
  get farms() { return this.grid.farms; }
  get flags() { return this.grid.flags; }
  get flagCells() { return this.grid.flagCells; }
  get agentsByCell() { return this.grid.agentsByCell; }
  get waterBlocks() { return this.grid.waterBlocks; }
  get treeBlocks() { return this.grid.treeBlocks; }
  get seedlings() { return this.grid.seedlings; }
  get lootBags() { return this.grid.lootBags; }
  get poopBlocks() { return this.grid.poopBlocks; }
  get eggs() { return this.grid.eggs; }
}
