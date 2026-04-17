import { LOG_CATS, PATH_BUDGET_PER_TICK } from '../../core/constants';
import { RingLog } from '../../core/utils';
import { EventBus } from '../../core/event-bus';
import type { LogCategory } from '../action/types';
import type { Agent } from '../entity/agent';
import type { Faction } from '../faction/faction';
import { FamilyRegistry } from '../entity/family-registry';
import { Grid } from './grid';
import { FoodField } from './food-field';
import { WaterField } from './water-field';
import { TerrainField } from './terrain-field';
import { BlockManager } from './block-manager';
import type { PaintMode, ICloud, DeadAgentMarker } from './types';

export class World {
  // Core infrastructure
  readonly events: EventBus = new EventBus();
  readonly grid: Grid = new Grid();
  readonly foodField: FoodField = new FoodField();
  readonly waterField: WaterField = new WaterField();
  readonly terrainField: TerrainField = new TerrainField();
  readonly blockManager: BlockManager = new BlockManager(this.grid, this.events);
  readonly familyRegistry: FamilyRegistry = new FamilyRegistry();

  // Entity collections
  agents: Agent[] = [];
  readonly agentsById: Map<string, Agent> = new Map();
  readonly factions: Map<string, Faction> = new Map();

  // Logging
  log: RingLog = new RingLog(200);
  activeLogCats: Set<LogCategory> = new Set(LOG_CATS);
  activeLogAgentId: string | null = null;

  // Simulation state
  tick = 0;
  totalBirths = 0;
  totalDeaths = 0;
  running = false;
  speedPct = 100;
  cloudSpawnRate = 1;

  // Death animation markers
  deadMarkers: DeadAgentMarker[] = [];

  // Birth/death timestamps for per-minute rate tracking
  birthTimestamps: number[] = [];
  deathTimestamps: number[] = [];

  // UI state
  selectedId: string | null = null;
  paintMode: PaintMode = 'none';
  pauseOnBlur = false;
  drawGrid = false;
  drawTerritories = false;
  factionSort: 'members' | 'created' | 'name' | 'level' = 'members';
  familySort: 'alive' | 'total' | 'name' | 'lifespan' | 'generation' = 'alive';
  starredStats: string[] = ['agents', 'factions', 'crops'];

  // Pathfinding budget
  pathBudgetMax: number = PATH_BUDGET_PER_TICK;
  pathBudget = 0;
  _pathRR = 0;
  readonly _pathWhitelist: Set<string> = new Set();

  // UI callbacks
  _lastFactionsDomAt = 0;
  _lastAgentCount = 0;
  _rebuildAgentOptions: (() => void) | null = null;
  _lastFactionsSig = '';

  // Ephemeral cloud state (not persisted)
  clouds: ICloud[] = [];
  _nextCloudSpawnMs = 0;

  // Convenience accessors that delegate to grid (backward compat)
  get obstacles() { return this.grid.obstacles; }
  get foodBlocks() { return this.grid.foodBlocks; }
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
  get saltWaterBlocks() { return this.grid.saltWaterBlocks; }
  get medicineBlocks() { return this.grid.medicineBlocks; }
  get flowerBlocks() { return this.grid.flowerBlocks; }
  get cactusBlocks() { return this.grid.cactusBlocks; }
  get houses() { return this.grid.houses; }
  get houseCells() { return this.grid.houseCells; }

  // UI state for house inspector
  selectedHouseId: string | null = null;
}
