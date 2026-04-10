import { RingLog } from '../../core/utils';
import { EventBus } from '../../core/event-bus';
import type { LogCategory } from '../action/types';
import type { Organism } from '../entity/organism';
import type { Faction } from '../faction/faction';
import { FamilyRegistry } from '../entity/family-registry';
import { Grid } from './grid';
import { FoodField } from './food-field';
import { WaterField } from './water-field';
import { TerrainField } from './terrain-field';
import { BlockManager } from './block-manager';
import type { PaintMode, ICloud } from './types';

export class World {
  // Core infrastructure
  readonly events: EventBus = new EventBus();
  readonly grid: Grid = new Grid();
  readonly foodField: FoodField = new FoodField();
  readonly waterField: WaterField = new WaterField();
  readonly terrainField: TerrainField = new TerrainField();
  readonly blockManager: BlockManager = new BlockManager(this.grid, this.events);
  readonly familyRegistry: FamilyRegistry = new FamilyRegistry();

  // Entity collections (v5: unified organisms — replaces agents + trees)
  organisms: Organism[] = [];
  readonly organismsById: Map<string, Organism> = new Map();
  readonly factions: Map<string, Faction> = new Map();

  // Logging
  log: RingLog = new RingLog(200);
  readonly activeLogCats: Set<LogCategory> = new Set<LogCategory>([
    'talk', 'quarrel', 'attack', 'hunt', 'heal', 'share', 'reproduce',
    'build', 'destroy', 'death', 'faction', 'level', 'spawn', 'info',
    'sleep', 'eat', 'harvest', 'loot', 'hygiene',
  ]);
  activeLogOrganismId: string | null = null;

  // Simulation state
  tick = 0;
  totalBirths = 0;
  totalDeaths = 0;
  running = false;
  speedPct = 100;
  cloudSpawnRate = 1;

  // Birth/death rate tracking
  birthTimestamps: number[] = [];
  deathTimestamps: number[] = [];

  // UI state
  selectedId: string | null = null;
  paintMode: PaintMode = 'none';
  pauseOnBlur = false;
  drawGrid = false;
  factionSort: 'members' | 'created' | 'name' | 'level' = 'members';
  familySort: 'alive' | 'total' | 'name' | 'lifespan' | 'generation' = 'alive';

  // Pathfinding budget
  pathBudgetMax = 30;
  pathBudget = 0;
  _pathRR = 0;
  readonly _pathWhitelist: Set<string> = new Set();

  // Ephemeral cloud state
  clouds: ICloud[] = [];
  _nextCloudSpawnMs = 0;

  // Convenience accessors
  get obstacles()      { return this.grid.obstacles; }
  get foodBlocks()     { return this.grid.foodBlocks; }
  get farms()          { return this.grid.farms; }
  get flags()          { return this.grid.flags; }
  get flagCells()      { return this.grid.flagCells; }
  get waterBlocks()    { return this.grid.waterBlocks; }
  get lootBags()       { return this.grid.lootBags; }
  get poopBlocks()     { return this.grid.poopBlocks; }
  get eggs()           { return this.grid.eggs; }
  get saltWaterBlocks(){ return this.grid.saltWaterBlocks; }
  get corpseBlocks()   { return this.grid.corpseBlocks; }

  addOrganism(o: Organism): void {
    this.organisms.push(o);
    this.organismsById.set(o.id, o);
    this.grid.setOccupied(o.cellX, o.cellY, o.id);
  }

  removeOrganism(o: Organism): void {
    const idx = this.organisms.indexOf(o);
    if (idx >= 0) this.organisms.splice(idx, 1);
    this.organismsById.delete(o.id);
    this.grid.clearOccupied(o.cellX, o.cellY, o.id);
  }

  removeDeadOrganisms(): void {
    const dead = this.organisms.filter(o => o.isDead);
    for (const o of dead) this.removeOrganism(o);
  }
}
