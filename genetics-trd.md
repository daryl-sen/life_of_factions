# TRD: Genetics System — Technical Requirements Document

**Version:** 0.1 (Draft)
**Companion to:** `genetics-prd.md`
**Scope:** New code architecture for v4.0, designed to support genetics and all planned future features.

---

## 1. Architecture Principles

### 1.1 Core Tenets

1. **Domain-driven.** Each domain owns its data, logic, and types. No domain reaches into another's internals.
2. **Event-driven communication.** Domains communicate through a central event bus, not direct imports. The simulation tick orchestrates *when* things run; events handle *what happens between domains*.
3. **Composition over inheritance.** Entities are composed of well-defined components (Genome, Needs, Inventory, etc.), not deep class hierarchies.
4. **Data flows down, events flow up.** The simulation loop reads state and calls domain methods. Domains emit events when something noteworthy happens. Other domains subscribe and react.
5. **Per-agent configuration.** No game-mechanical constant lives in a global config if it varies per agent. Genetics determines per-agent values; global constants are for truly universal values (tick rate, grid size, rendering).

### 1.2 What This Replaces

| Old Pattern | Problem | New Pattern |
|------------|---------|-------------|
| `World` god-object with 30+ accessors | Everything depends on everything | `World` is a thin container; domains own their own state |
| `SimulationEngine.tick()` at 1300 lines | Monolithic, impossible to extend | Tick loop delegates to domain-specific update methods |
| `InteractionEngine.consider()` as 175-line if-chain | Rigid priority, can't add factors | Scored action selection via `DecisionEngine` |
| `ActionProcessor` imports `SimulationEngine` (circular) | Tight coupling | Events: action completion emits events, simulation subscribes |
| `TUNE.*` thresholds used directly in decision logic | No per-agent variation | Agent reads thresholds from its expressed traits |
| Two flat numbers for personality (aggression, cooperation) | No genetic depth | `Genome` component with full DNA expression |

---

## 2. Directory Structure

```
src/
  core/                          # Framework-level, imported by all domains
    index.ts
    event-bus.ts                 # Pub/sub event system
    types.ts                     # Universal types (IPosition, ActionType, etc.)
    constants.ts                 # Truly global: TICK_MS, GRID_SIZE, CELL_PX
    utils.ts                     # Pure functions: rnd, clamp, key, uuid, manhattan
    pathfinding.ts               # A* pathfinder (stateless, takes grid as param)

  domains/
    genetics/                    # DNA, genes, traits, expression
      index.ts
      genome.ts                  # Genome class — DNA string, parse, serialize
      gene-registry.ts           # Static map: gene code → trait definition
      expression.ts              # expressGenome(dna) → TraitSet
      crossover.ts               # recombine(dnaA, dnaB) → childDna
      mutation.ts                # mutate(dna) → mutatedDna
      viability.ts               # isViable(traitSet) → boolean
      types.ts                   # GeneDef, TraitDef, TraitSet, RawGeneEntry

    entity/                      # Agents and entity class system
      index.ts
      agent.ts                   # Agent class (composed of components below)
      agent-factory.ts           # create(), createChild(), createFromEgg()
      entity-class.ts            # Class definitions: Baby, Adult, Elder, etc.
      family-registry.ts         # Dynasty tracking (Map<familyName, FamilyStats>)
      components/
        needs.ts                 # NeedSet: fullness, hygiene, social, inspiration, energy
        inventory.ts             # Inventory with genetic capacity
        relationships.ts         # RelationshipMap with genetic capacity
        pregnancy.ts             # Pregnancy state and timer
      types.ts                   # AgentOpts, EntityClassName, NeedBand, etc.

    decision/                    # What should this agent do next?
      index.ts
      decision-engine.ts         # Core loop: build context → score candidates → select
      context-builder.ts         # Snapshot of agent's surroundings
      action-scorer.ts           # Score = base + genetic + situational + [future factors]
      need-evaluator.ts          # Maps need values to bands (CRITICAL/LOW/NORMAL/HIGH/FULL)
      flee-evaluator.ts          # Courage-based flee decisions
      types.ts                   # DecisionContext, ActionCandidate, ScoredAction

    action/                      # Action definitions and execution
      index.ts
      action-registry.ts         # All action definitions: tags, costs, durations, requirements
      action-factory.ts          # Creates IActionState from registry + agent traits
      action-processor.ts        # Tick-by-tick execution (periodic effects, completion)
      effects/                   # Completion effects, one per action category
        combat-effects.ts        # Attack completion: damage, XP, kill
        social-effects.ts        # Talk, quarrel, heal, share completion
        survival-effects.ts      # Sleep, eat, wash completion
        resource-effects.ts      # Harvest, pickup, deposit, withdraw completion
        build-effects.ts         # Build farm completion
        hygiene-effects.ts       # Poop, clean completion
        reproduce-effects.ts     # Reproduction completion: spawn child
      types.ts                   # ActionDef, ActionTag, IActionState

    world/                       # Grid, terrain, blocks — environmental state
      index.ts
      world.ts                   # Slim container: grid + agents list + factions map + event bus
      grid.ts                    # Spatial data: block storage, cell queries
      terrain-field.ts           # Terrain moisture/type
      food-field.ts              # Food distance field
      water-field.ts             # Water distance field
      block-manager.ts           # Unified lifecycle for all block types (spawn, decay, remove)
      types.ts                   # Block interfaces (IFoodBlock, IWaterBlock, etc.)

    faction/                     # Faction formation and management
      index.ts
      faction.ts                 # Faction class
      faction-manager.ts         # Formation, reconciliation, membership

    simulation/                  # Tick orchestration — thin coordinator
      index.ts
      simulation-engine.ts       # Tick loop: delegates to domain update methods
      spawner.ts                 # Egg, seedling, cloud, resource spawning
      agent-updater.ts           # Per-agent tick: drain stats, check death, delegate decisions
      world-updater.ts           # Per-tick world updates: farms, trees, water decay

    rendering/                   # Canvas drawing
      index.ts
      renderer.ts
      camera.ts
      emoji-cache.ts

    ui/                          # DOM, inspector, controls
      index.ts
      ui-manager.ts
      input-handler.ts
      controls.ts

    persistence/                 # Save/load
      index.ts
      persistence-manager.ts

  main.ts                        # Entry point: creates World, wires event bus, starts loop
```

---

## 3. Core Framework

### 3.1 Event Bus

The event bus is the backbone of cross-domain communication. It replaces direct imports between domains that would otherwise create circular dependencies.

```typescript
// core/event-bus.ts

type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as EventHandler);
    this.handlers.set(event, list);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const idx = list.indexOf(handler as EventHandler);
    if (idx >= 0) list.splice(idx, 1);
  }

  emit<T>(event: string, payload: T): void {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const h of list) h(payload);
  }
}
```

**Event catalog** (typed, not stringly-typed in production — use a union or enum):

| Event | Emitted By | Payload | Subscribers |
|-------|-----------|---------|-------------|
| `agent:died` | agent-updater | `{ agentId, cause, position }` | world (drop loot), faction (remove member), ui (death marker) |
| `agent:born` | reproduce-effects | `{ child, parent1Id, parent2Id }` | family-registry, faction (inherit), ui (log) |
| `agent:stillborn` | reproduce-effects | `{ parentId }` | ui (log) |
| `action:completed` | action-processor | `{ agentId, actionType, target? }` | relevant effect handler, ui (log) |
| `action:started` | action-factory | `{ agentId, actionType }` | ui (emoji update) |
| `faction:formed` | faction-manager | `{ factionId, members }` | ui (log, panel) |
| `faction:member-changed` | faction-manager | `{ factionId, agentId, joined }` | ui (log) |
| `block:removed` | block-manager | `{ blockType, position }` | food-field/water-field (recompute), agents (forget memory) |
| `block:added` | block-manager | `{ blockType, position }` | food-field/water-field (recompute) |
| `combat:kill` | combat-effects | `{ attackerId, targetId }` | agent-updater (xp), ui (log) |
| `pregnancy:started` | reproduce-effects | `{ agentId, duration }` | ui (visual) |
| `pregnancy:birth` | agent-updater | `{ parentId, childId }` | ui (visual clear) |

The event bus lives on `World` and is passed to domains during initialization. Events are processed synchronously within the same tick — no async, no queuing.

### 3.2 Types (core/types.ts)

Universal types that every domain may need:

```typescript
export interface IPosition {
  readonly x: number;
  readonly y: number;
}

export interface IInventory {
  food: number;
  water: number;
  wood: number;
}

export type ResourceType = 'food' | 'water' | 'wood';
```

Action types, log categories, and block interfaces move to their respective domain `types.ts` files. Only truly universal types live in core.

### 3.3 Constants (core/constants.ts)

**Only truly global, never-per-agent values:**

```typescript
export const CELL_PX = 16;
export const GRID_SIZE = 62;
export const WORLD_PX = GRID_SIZE * CELL_PX;
export const TICK_MS = 250;
export const LEVEL_CAP = 20;
```

Everything else (action costs, durations, thresholds, decay rates) moves to either:
- **Action registry** (action costs, durations) — still global per action type
- **Gene expression** (agent stats, thresholds) — per agent
- **Domain constants** (faction formation threshold, farm mechanics) — in the domain's own constants

### 3.4 Pathfinding (core/pathfinding.ts)

Remains a pure function. Takes a grid-query interface, not a concrete World:

```typescript
export interface IGridQuery {
  isBlocked(x: number, y: number): boolean;
  isOccupied(x: number, y: number): boolean;
  width: number;
  height: number;
}

export function findPath(grid: IGridQuery, from: IPosition, to: IPosition, maxSteps?: number): IPosition[] | null;
```

---

## 4. Domain Specifications

### 4.1 Genetics Domain

**Responsibility:** DNA encoding, parsing, gene expression, crossover, mutation, viability checks. Pure logic — no side effects, no world state, no events.

**Key classes:**

```typescript
// genome.ts
export class Genome {
  readonly dna: string;                    // Immutable after creation
  readonly genes: ReadonlyArray<RawGeneEntry>;  // Parsed once in constructor
  readonly traits: TraitSet;               // Expressed once in constructor

  constructor(dna: string);
  static random(length?: number): Genome;  // For initial population / egg hatching
  toString(): string;                      // Returns dna string
}

// types.ts
export interface RawGeneEntry {
  code: string;       // 2-char identifier (e.g., "AA", "aa")
  magnitude: number;  // 0-999
  position: number;   // Index in DNA (0, 5, 10, ...)
  coding: boolean;    // Whether this gene maps to a known trait
}

export interface TraitSet {
  // Essential
  strength:       { baseAttack: number; perLevel: number };
  longevity:      { maxAgeMs: number };
  vigor:          { baseMaxEnergy: number; perLevel: number };
  metabolism:     { fullnessDecay: number; actionDurationMult: number };
  resilience:     { baseMaxHp: number; perLevel: number };

  // Non-essential (defaults used if no genes present)
  immunity:       { contractionChance: number };
  agility:        { speedMult: number };
  aptitude:       { xpPerLevel: number };
  cooperation:    { baseProbability: number };
  aggression:     { baseProbability: number };
  courage:        { fleeHpRatio: number };
  fertility:      { energyThreshold: number; urgencyAge: number };
  parthenogenesis:{ canSelfReproduce: boolean };
  recall:         { memorySlots: number };
  charisma:       { relationshipSlots: number };
  gregariousness: { socialDecay: number };
  appetite:       { seekThreshold: number; criticalThreshold: number };
  maturity:       { babyDurationMs: number };
  endurance:      { inventoryCapacity: number };
  fidelity:       { leaveProbability: number };
}

export interface TraitDef {
  code: string;           // e.g., "AA"
  name: string;           // e.g., "Strength"
  essential: boolean;
  components: TraitComponentDef[];
}

export interface TraitComponentDef {
  key: string;            // e.g., "baseAttack"
  min: number;
  default: number;
  max: number;
  scale: number;
  inverted: boolean;      // true = positive genes reduce the value
}
```

**gene-registry.ts** is a static lookup:

```typescript
export const GENE_REGISTRY: ReadonlyMap<string, TraitDef> = new Map([
  ['AA', { code: 'AA', name: 'Strength', essential: true, components: [...] }],
  ['BB', { code: 'BB', name: 'Longevity', essential: true, components: [...] }],
  // ... all 20 traits
]);

// Lookup ignores case to find the trait category,
// then checks case to determine reinforcing vs reducing.
export function lookupGene(code: string): { trait: TraitDef; reinforcing: boolean } | null;
```

**expression.ts:**

```typescript
export function expressGenome(genes: ReadonlyArray<RawGeneEntry>): TraitSet;
// Iterates all genes, sums reinforcing magnitudes, subtracts reducing magnitudes,
// maps raw values to game values using TraitComponentDef scaling.
// Returns a full TraitSet with defaults for missing traits.
```

**crossover.ts:**

```typescript
export function crossover(initiatorDna: string, recipientDna: string): string;
// 1. Copy initiator's DNA
// 2. For each gene position present in BOTH parents, 50% chance to swap
// 3. Return child DNA string
```

**mutation.ts:**

```typescript
export function mutate(dna: string): string;
// Per-character: 0.5% chance of substitution
// 1% chance of gene duplication (append copy of random gene)
// 1% chance of gene deletion (remove random 5-char segment)
// Clamp length to [100, 250]
```

**viability.ts:**

```typescript
export function isViable(traits: TraitSet, genes: ReadonlyArray<RawGeneEntry>): boolean;
// Check: at least one coding gene for each essential trait
// Check: no essential trait at absolute minimum
```

**Testing:** This domain is pure logic with no dependencies — ideal for unit testing. Every function takes input and returns output. Test gene expression, crossover, mutation, and viability exhaustively.

### 4.2 Entity Domain

**Responsibility:** Agent data model, creation, family tracking. Replaces current `agent/` domain.

**Agent class — composed of components:**

```typescript
// agent.ts
export class Agent {
  readonly id: string;
  readonly genome: Genome;                  // Immutable DNA
  readonly traits: TraitSet;                // Expressed from genome, immutable
  readonly familyName: string;

  // Components (mutable state)
  readonly needs: NeedSet;
  readonly inventory: Inventory;
  readonly relationships: RelationshipMap;
  readonly pregnancy: PregnancyState;

  // Derived from traits (set once at birth, updated on level-up)
  maxHealth: number;
  maxEnergy: number;
  attack: number;

  // Mutable runtime state
  name: string;
  health: number;
  energy: number;
  level: number;
  xp: number;
  ageTicks: number;
  maxAgeTicks: number;
  factionId: string | null;
  entityClass: EntityClassName;             // 'baby' | 'adult' | 'elder'
  diseased: boolean;

  // Movement / action (transient)
  cellX: number;
  cellY: number;
  path: IPosition[] | null;
  action: IActionState | null;
  lockMsRemaining: number;
  _underAttack: boolean;

  constructor(opts: AgentOpts);
  levelUp(): void;                          // Uses traits for growth rates
  get isDead(): boolean;
}
```

**Components are plain classes with focused responsibilities:**

```typescript
// components/needs.ts
export class NeedSet {
  fullness: number;
  hygiene: number;
  social: number;
  inspiration: number;

  // Returns the band for a given need, using agent's genetic thresholds
  getBand(need: 'fullness' | 'hygiene' | 'social' | 'inspiration', traits: TraitSet): NeedBand;
}

export enum NeedBand {
  CRITICAL = 'critical',
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  FULL = 'full',
}

// components/inventory.ts
export class Inventory {
  food: number = 0;
  water: number = 0;
  wood: number = 0;
  readonly capacity: number;  // From Endurance trait

  constructor(capacity: number);
  total(): number;
  isFull(): boolean;
  add(type: ResourceType, amount: number): number;   // Returns actual added
  remove(type: ResourceType, amount: number): number; // Returns actual removed
}

// components/pregnancy.ts
export class PregnancyState {
  active: boolean = false;
  remainingMs: number = 0;
  childDna: string | null = null;
  childFamilyName: string | null = null;
  childFactionId: string | null = null;

  start(dna: string, durationMs: number, familyName: string, factionId: string | null): void;
  tick(dtMs: number): boolean;  // Returns true when birth occurs
  clear(): void;
}
```

**Entity classes** define what an entity can do:

```typescript
// entity-class.ts
export type EntityClassName = 'baby' | 'adult' | 'elder';

export interface EntityClassDef {
  name: EntityClassName;
  availableActions: Set<ActionType>;
  emojiMap: Record<string, string>;       // Action/state → emoji
  statModifiers?: {                        // Multipliers applied on top of genetics
    attackMult?: number;
    speedMult?: number;
  };
}

export const ENTITY_CLASSES: Record<EntityClassName, EntityClassDef> = {
  baby: {
    name: 'baby',
    availableActions: new Set(['eat', 'wash']),  // Babies can only eat, wash, and roam
    emojiMap: { idle: '👶', eat: '👼', wash: '👼' },
  },
  adult: {
    name: 'adult',
    availableActions: new Set([/* all 17 actions */]),
    emojiMap: { /* current AGENT_EMOJIS + IDLE_EMOJIS */ },
  },
  elder: {
    name: 'elder',
    availableActions: new Set([/* adult set minus reproduce, reduced combat */]),
    emojiMap: { idle: '🧓', /* ... */ },
    statModifiers: { attackMult: 0.7 },
  },
};
```

### 4.3 Decision Domain

**Responsibility:** Determining what an agent should do next. Pure logic — reads agent state and world context, returns an action recommendation. No mutations, no side effects.

```typescript
// decision-engine.ts
export class DecisionEngine {
  static decide(agent: Agent, context: DecisionContext): ActionCandidate | null;
  // 1. Get available actions from entity class
  // 2. Filter by requirements (can't attack if no targets, etc.)
  // 3. Score each candidate
  // 4. Return highest-scored action (with noise)
}

// context-builder.ts
export class ContextBuilder {
  static build(world: World, agent: Agent): DecisionContext;
  // Scans surroundings, builds snapshot:
  // - Nearby agents (with relationships, factions)
  // - Nearby resources (food, water, wood, loot)
  // - Nearby blocks (poop, flag, farm)
  // - Agent's need bands (from NeedEvaluator)
  // - Under attack status
  // - Pregnancy status
}

// types.ts
export interface DecisionContext {
  agent: Readonly<Agent>;
  nearbyAgents: NearbyAgent[];
  nearbyResources: NearbyResource[];
  nearbyBlocks: NearbyBlock[];
  needBands: Record<string, NeedBand>;
  underAttack: boolean;
  pregnant: boolean;
  nearOwnFlag: boolean;
  // Future: mood, faction laws, proficiency
}

export interface ActionCandidate {
  actionType: ActionType;
  targetId?: string;
  targetPos?: IPosition;
  score: number;
}
```

**Scoring formula:**

```typescript
// action-scorer.ts
export class ActionScorer {
  static score(action: ActionDef, agent: Agent, context: DecisionContext): number {
    let score = 0;

    // 1. Need-based score (highest weight)
    score += needScore(action, context.needBands);

    // 2. Genetic modifier
    score += geneticScore(action, agent.traits);

    // 3. Situational modifier
    score += situationalScore(action, context);

    // 4. Hard overrides (returns Infinity for forced actions)
    const override = hardOverride(action, agent, context);
    if (override !== null) return override;

    // 5. Small random noise (±5% of score)
    score *= 1 + (Math.random() - 0.5) * 0.1;

    return score;
  }
}
```

**Need-based scoring:**

| Need Band | Score Contribution |
|-----------|-------------------|
| CRITICAL | +1000 (emergency) |
| LOW | +200 (proactive) |
| NORMAL | +20 (opportunistic) |
| HIGH | +0 (satisfied) |
| FULL | -50 (surplus — may trigger sharing) |

**Hard overrides:**

| Condition | Action | Score |
|-----------|--------|-------|
| Energy < mandatory threshold | sleep | `Infinity` |
| Baby entity class | Only eat/wash available | N/A (filtered) |
| Pregnant + reproduce attempted | blocked | `-Infinity` |

### 4.4 Action Domain

**Responsibility:** Defining what actions exist (registry) and executing them tick-by-tick (processor). Does NOT decide which action to take — that's the decision domain.

```typescript
// action-registry.ts
export interface ActionDef {
  type: ActionType;
  tags: Set<ActionTag>;
  energyCost: number;           // Per second
  durationRange: [number, number]; // Base ms range (scaled by traits + inspiration)
  requiresTarget: boolean;
  targetRange: number;          // Manhattan distance
  interruptible: boolean;       // Can be canceled on low energy
  requirements: ActionRequirement[]; // Checked before action is available
}

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

export type ActionType =
  | 'talk' | 'quarrel' | 'attack' | 'heal' | 'share'
  | 'reproduce' | 'sleep' | 'harvest' | 'eat' | 'wash'
  | 'deposit' | 'withdraw' | 'pickup' | 'poop' | 'clean'
  | 'play' | 'build_farm';

// Static registry — no "attack_flag" (merged into "attack")
// "drink" renamed to "wash"
export const ACTION_REGISTRY: ReadonlyMap<ActionType, ActionDef>;
```

**Action effects** are split into focused modules by category:

```typescript
// effects/combat-effects.ts
export function onAttackTick(world: World, agent: Agent, target: Agent, dtMs: number): void;
export function onAttackComplete(world: World, agent: Agent, target: Agent): void;
export function onKill(world: World, attacker: Agent, victim: Agent): void;

// effects/reproduce-effects.ts
export function onReproduceComplete(world: World, initiator: Agent, recipient: Agent | null): void;
// Handles: crossover, mutation, viability check, pregnancy start, family name
```

This replaces the current 350-line `action-processor.ts` that mixes all action types in one switch. Each effect module is ~50-80 lines, focused and testable.

### 4.5 World Domain

**Responsibility:** Environmental state — the grid, blocks, terrain. The container for all spatial data.

**Slimmed World:**

```typescript
// world.ts
export class World {
  // Core infrastructure
  readonly events: EventBus;
  readonly grid: Grid;
  readonly terrainField: TerrainField;
  readonly foodField: FoodField;
  readonly waterField: WaterField;
  readonly blockManager: BlockManager;
  readonly familyRegistry: FamilyRegistry;

  // Entity collections
  agents: Agent[];
  readonly agentsById: Map<string, Agent>;
  readonly factions: Map<string, Faction>;

  // Simulation state
  tick: number;
  running: boolean;
  speedPct: number;

  // UI state (could extract further but low priority)
  selectedId: string | null;
  paintMode: PaintMode;

  // Stats
  totalBirths: number;
  totalDeaths: number;
}
```

**Key difference:** World no longer has 20+ accessor properties that proxy to Grid. Code accesses `world.grid.foodBlocks` directly, or uses `world.blockManager` for lifecycle operations.

**BlockManager** unifies block lifecycle:

```typescript
// block-manager.ts
export class BlockManager {
  constructor(private grid: Grid, private events: EventBus);

  addBlock(type: BlockType, block: IBlock): void;
  // Adds to grid, emits 'block:added'

  removeBlock(type: BlockType, id: string): void;
  // Removes from grid, emits 'block:removed'

  tickDecay(dtMs: number): void;
  // Handles loot bag decay, poop decay, water evaporation, tree aging
}
```

### 4.6 Simulation Domain

**Responsibility:** Orchestrating the tick loop. Delegates to domain-specific updaters. Thin coordinator, not a monolith.

```typescript
// simulation-engine.ts
export class SimulationEngine {
  static tick(world: World): void {
    world.tick++;

    // 1. World updates (farms, trees, clouds, spawning)
    WorldUpdater.update(world);
    Spawner.tick(world);

    // 2. Agent updates (stats drain, death checks, decisions, actions)
    for (const agent of world.agents) {
      AgentUpdater.update(world, agent);
    }

    // 3. Post-tick (faction reconciliation, disease spread, cleanup)
    PostTickUpdater.update(world);
  }
}

// agent-updater.ts
export class AgentUpdater {
  static update(world: World, agent: Agent): void {
    // 1. Drain passive stats (energy, fullness, hygiene, social, inspiration)
    //    Rates come from agent.traits (genetic)
    drainStats(agent);

    // 2. Check death conditions (age, starvation, disease)
    if (checkDeath(world, agent)) return;

    // 3. Tick pregnancy
    if (agent.pregnancy.active) {
      if (agent.pregnancy.tick(TICK_MS)) {
        spawnChild(world, agent);
      }
    }

    // 4. If has active action → ActionProcessor.process()
    if (agent.action) {
      ActionProcessor.process(world, agent, TICK_MS);
      return;
    }

    // 5. If has path → follow path
    if (agent.path) {
      followPath(world, agent);
      return;
    }

    // 6. If idle → DecisionEngine.decide()
    const candidate = DecisionEngine.decide(agent, ContextBuilder.build(world, agent));
    if (candidate) {
      executeCandidate(world, agent, candidate);
    }
  }
}
```

**spawner.ts** handles all spontaneous entity creation:

```typescript
// spawner.ts
export class Spawner {
  static tick(world: World): void {
    tickEggSpawning(world);       // Water → eggs (constant, no population check)
    tickSeedlingSpawning(world);  // Water → seedlings (same rate as eggs)
    tickFarmCrops(world);         // Farms → food blocks
    tickTreeSeeding(world);       // Trees near water → seedlings
    tickCloudSpawning(world);     // Clouds → rain → water
    tickEggHatching(world);       // Eggs → agents (with random DNA)
  }
}
```

### 4.7 Faction Domain

Largely unchanged in scope. The key change is that faction membership changes emit events instead of being called directly:

```typescript
// faction-manager.ts
export class FactionManager {
  static formFaction(world: World, agent1: Agent, agent2: Agent): void;
  // Emits 'faction:formed'

  static changeMembers(world: World, agent: Agent, newFactionId: string | null, reason?: string): void;
  // Emits 'faction:member-changed'

  static reconcile(world: World): void;
  // Periodic cleanup: dissolve empty factions, recalculate stats
}
```

### 4.8 Rendering, UI, Persistence

These are **consumer domains** — they read state and subscribe to events but don't produce game-mechanical side effects.

**Rendering:** No structural changes. Update emoji lookups to use `EntityClassDef.emojiMap` instead of global constants.

**UI:** Subscribe to events for real-time updates (death markers, log entries) instead of polling.

**Persistence:** Updated serialization format including DNA, family name, pregnancy state. Old saves incompatible (per PRD).

---

## 5. Dependency Rules

### 5.1 Import Direction

```
core/  ← (imported by all, imports nothing from domains)
  │
  ▼
genetics/  ← (pure logic, imports only core/)
  │
  ▼
entity/  ← (imports core/, genetics/)
  │
  ▼
decision/  ← (imports core/, entity/, action/ types only)
  │
  ▼
action/  ← (imports core/, entity/, world/ for effects)
  │
  ▼
world/  ← (imports core/, entity/ types only)
faction/  ← (imports core/, entity/ types only)
  │
  ▼
simulation/  ← (imports all above, orchestrates)
  │
  ▼
rendering/  ← (imports core/, entity/, world/ for reading)
ui/  ← (imports core/, entity/, world/ for reading)
persistence/  ← (imports core/, entity/, world/, genetics/ for serialization)
  │
  ▼
main.ts  ← (imports everything, wires together)
```

### 5.2 Rules

1. **No circular imports.** If domain A imports from domain B, domain B must not import from domain A. Use events or shared interfaces in `core/` to break cycles.
2. **Type-only imports are OK across any boundary.** `import type { Agent }` doesn't create runtime coupling.
3. **Domains import from their own `types.ts` and `core/types.ts`.** Never from another domain's `types.ts` directly — re-export in the domain's barrel `index.ts` if needed externally.
4. **Effect modules in `action/effects/`** may import from `world/` and `entity/` because they apply side effects. This is the designated "integration point" and the only place where multiple domains are touched in a single function.

### 5.3 Breaking the Current Circular Dependency

The current `ActionProcessor → SimulationEngine` circular dependency is eliminated:

**Before:** `ActionProcessor.process()` calls `SimulationEngine.seekFood()` when an action completes and the agent needs to find food.

**After:** `ActionProcessor.process()` emits `action:completed`. The agent-updater (in simulation domain) handles post-action seeking as part of its normal idle decision flow. The action processor never needs to know about the simulation engine.

---

## 6. Data Flow — A Single Tick

```
┌─────────────────────────────────────────────────────┐
│ SimulationEngine.tick(world)                         │
│                                                      │
│  ┌─ WorldUpdater.update() ─────────────────────┐    │
│  │  Farm crop spawning                          │    │
│  │  Tree aging / seeding (near water only)      │    │
│  │  Water decay                                 │    │
│  │  Block decay (loot, poop)                    │    │
│  │  Terrain recomputation                       │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Spawner.tick() ────────────────────────────┐    │
│  │  Water → eggs (0.0002/tick/large block)      │    │
│  │  Water → seedlings (same rate)               │    │
│  │  Egg hatching → Agent with random DNA        │    │
│  │  Cloud spawning → rain → water               │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ For each agent: AgentUpdater.update() ─────┐    │
│  │                                              │    │
│  │  1. Drain stats (rates from agent.traits)    │    │
│  │     energy  -= passive + (action cost)       │    │
│  │     fullness -= agent.traits.metabolism       │    │
│  │     social  -= agent.traits.gregariousness    │    │
│  │     inspiration -= passive                    │    │
│  │                                              │    │
│  │  2. Check death                              │    │
│  │     age >= maxAge? → die                     │    │
│  │     health <= 0? → die                       │    │
│  │     → emit 'agent:died'                      │    │
│  │                                              │    │
│  │  3. Tick pregnancy (if active)               │    │
│  │     → on birth: emit 'pregnancy:birth'       │    │
│  │                                              │    │
│  │  4. If has action → ActionProcessor          │    │
│  │     ├─ Drain energy (action cost/sec)        │    │
│  │     ├─ Apply periodic effects (every 500ms)  │    │
│  │     ├─ Check completion                      │    │
│  │     └─ On complete: emit 'action:completed'  │    │
│  │                                              │    │
│  │  5. If has path → Follow path                │    │
│  │     ├─ Move cell (speed from Agility trait)  │    │
│  │     ├─ Drain movement energy/fullness        │    │
│  │     └─ Pregnancy speed penalty applied       │    │
│  │                                              │    │
│  │  6. If idle → DecisionEngine.decide()        │    │
│  │     ├─ ContextBuilder.build()                │    │
│  │     ├─ Filter available actions (class)      │    │
│  │     ├─ Score each candidate                  │    │
│  │     │  ├─ needScore (from NeedEvaluator)     │    │
│  │     │  ├─ geneticScore (from traits)         │    │
│  │     │  ├─ situationalScore (from context)    │    │
│  │     │  └─ [future: mood, laws, proficiency]  │    │
│  │     └─ Execute top-scored action             │    │
│  │                                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ PostTickUpdater.update() ──────────────────┐    │
│  │  Faction reconciliation (every N ticks)      │    │
│  │  Flag healing aura                           │    │
│  │  Disease spread                              │    │
│  │  Dead agent cleanup                          │    │
│  │  Entity class transitions (baby→adult, etc.) │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 7. Entity Class Transitions

An agent's class changes over its lifetime:

```
  Birth                 Baby duration ends        Age > 90% maxAge       Death
    │                        │                          │                  │
    ▼                        ▼                          ▼                  ▼
  Baby ─────────────────► Adult ──────────────────► Elder ────────────► Dead
  (restricted actions)    (full actions)            (no reproduce,
                                                    reduced attack)
```

Transitions are checked in `PostTickUpdater`:

```typescript
function checkClassTransitions(agent: Agent): void {
  if (agent.entityClass === 'baby' && agent.babyMsRemaining <= 0) {
    agent.entityClass = 'adult';
  }
  if (agent.entityClass === 'adult' && agent.ageTicks > agent.maxAgeTicks * 0.9) {
    agent.entityClass = 'elder';
  }
}
```

The entity class determines `availableActions` and `emojiMap`, which the decision engine and renderer read each tick.

---

## 8. Migration Strategy

### 8.1 Approach: Parallel Build

Rather than incrementally refactoring the existing code file-by-file, the new architecture is built in parallel:

1. **Create `core/` and `domains/genetics/`** — zero dependencies on old code.
2. **Create `domains/entity/`** — new Agent class with genome integration. Can coexist with old Agent temporarily.
3. **Create `domains/decision/`** and `domains/action/` (new)** — extract and rewrite.
4. **Create new `domains/simulation/`** — thin orchestrator using new domains.
5. **Wire `main.ts`** to the new simulation engine.
6. **Delete old files** once the new system is running.

This avoids partial migrations where old and new code must interoperate.

### 8.2 File Mapping (Old → New)

| Old File | New Location(s) | Notes |
|----------|----------------|-------|
| `shared/constants.ts` | `core/constants.ts` (global only) + `action/action-registry.ts` (action costs/durations) + `genetics/gene-registry.ts` (trait defaults) | Split by ownership |
| `shared/types.ts` | `core/types.ts` (universal) + `action/types.ts` + `world/types.ts` + `entity/types.ts` | Split by domain |
| `shared/utils.ts` | `core/utils.ts` | Mostly unchanged |
| `shared/pathfinding.ts` | `core/pathfinding.ts` | Interface instead of World |
| `domains/agent/agent.ts` | `domains/entity/agent.ts` | Rewritten with components |
| `domains/agent/agent-factory.ts` | `domains/entity/agent-factory.ts` | Rewritten with DNA |
| `domains/agent/relationships.ts` | `domains/entity/components/relationships.ts` | Genetic capacity |
| `domains/action/interaction-engine.ts` | `domains/decision/` (entire domain) | Rewritten as scored selection |
| `domains/action/action-processor.ts` | `domains/action/action-processor.ts` + `domains/action/effects/*` | Split effects out |
| `domains/action/action.ts` | `domains/action/action-factory.ts` + `domains/action/action-registry.ts` | Registry pattern |
| `domains/simulation/simulation-engine.ts` | `domains/simulation/simulation-engine.ts` + `agent-updater.ts` + `world-updater.ts` + `spawner.ts` | Decomposed |
| `domains/simulation/roaming.ts` | Integrated into `domains/decision/` | Roaming is a fallback decision |
| `domains/world/world.ts` | `domains/world/world.ts` | Slimmed, add EventBus |
| `domains/world/grid.ts` | `domains/world/grid.ts` | Mostly unchanged |
| `domains/world/loot-bag-manager.ts` | `domains/world/block-manager.ts` | Unified |
| `domains/world/poop-block-manager.ts` | `domains/world/block-manager.ts` | Unified |

### 8.3 Deleted Concepts

| Concept | Replacement |
|---------|-------------|
| `attack_flag` action type | `attack` with flag as target |
| `drink` action type | `wash` |
| `TUNE.*` threshold constants used in decisions | `agent.traits.*` from genetics |
| `agent.aggression` / `agent.cooperation` (flat numbers) | `agent.traits.aggression.baseProbability` etc. from genome |
| `World.agentsByCell` accessor proxy | `world.grid.agentsByCell` directly |
| Egg spawn from trees | Egg spawn from water |
| Egg spawn requires 0 agents | Eggs spawn continuously |

---

## 9. Testing Strategy

### 9.1 Unit-Testable Domains

| Domain | Testability | What to Test |
|--------|------------|--------------|
| **genetics** | Pure functions, zero deps | Gene parsing, expression, crossover, mutation, viability |
| **decision** | Pure functions (given context) | Scoring accuracy, need band mapping, hard overrides |
| **entity/components** | Simple state machines | NeedSet band calculation, Inventory capacity, PregnancyState timer |

### 9.2 Integration Points

The `action/effects/` directory is the primary integration point where multiple domains interact. These should be tested with a minimal World fixture to verify:
- Reproduction creates viable children with correct DNA
- Combat XP and leveling use genetic growth rates
- Sharing respects genetic inventory capacity

### 9.3 Regression via Playtest

Since there's no test framework yet, the primary regression check is playtesting. The new architecture should produce the same "feel" as the old one for default-genetics agents (all traits at default = old behavior).

---

## 10. Performance Considerations

### 10.1 DNA Parsing

DNA is parsed **once at birth**, not every tick. The `Genome` constructor parses the string into `RawGeneEntry[]` and calls `expressGenome()` to produce `TraitSet`. Both are stored as readonly properties. Zero per-tick cost.

### 10.2 Decision Scoring

The scored action selector runs **once per idle agent per tick**. With ~50 agents and ~17 possible actions, that's ~850 score calculations per tick. Each score calculation is a few additions — negligible.

### 10.3 Event Bus

Events are synchronous within a tick. No allocation overhead beyond the payload objects. The handler arrays are pre-allocated. No performance concern.

### 10.4 Context Building

`ContextBuilder.build()` scans the agent's surroundings each time it's called. This replaces the current vision scan + interaction check. Scope it to the agent's `visionRange` (from Recall trait or default 10) to avoid full-grid scans.

---

## 11. Extensibility Points

The architecture is designed so future features plug in without modifying existing code:

| Future Feature | Where It Plugs In |
|---------------|-------------------|
| **Mood system** | New component on Agent (`MoodState`). New scorer term in `ActionScorer.score()`. New domain `domains/mood/`. |
| **Faction laws** | New scorer term reading from `Faction.laws`. Laws stored on Faction class. |
| **Job classes** | New `EntityClassName` values. New entries in `ENTITY_CLASSES` with specialized action sets. |
| **Proficiency** | New component on Agent (`ProficiencySet`). Modifies action duration/effectiveness. New scorer term. |
| **Animal class** | New `EntityClassName`. Own gene catalog subset. Own action set (no social). |
| **Plant genetics** | New entity type alongside Agent. Own `Genome` subclass with plant-specific gene registry. Managed by BlockManager or own domain. |
| **Combat system overhaul** | New effect modules in `action/effects/`. New action types in registry. Decision domain scores automatically pick them up via tags. |
