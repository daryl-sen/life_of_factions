# v5 TRD — Technical Requirements Document

**Version:** 0.1 (Draft)
**Companion to:** `v5-prd.md`
**Status:** Initial draft, ready for review
**Date:** 2026-04-09
**Scope:** Full technical architecture for the v5 unified organism model. Clean break from v4.

---

## 1. Goals and Constraints

### 1.1 Goals

1. **Unify all living entities** under a single `Organism` class. No separate Agent/Tree types.
2. **Continuous-only trait expression** — replace v4's hard min/max clamping with soft floors and unbounded ceilings, governed by trade-off cost functions.
3. **Data-driven phenotype classification** — a rule table maps gene combinations to visual identity and behavior, no hardcoded if-chains.
4. **Modular rendering** — three independent visual layers (movesets, indicators, tools) plus universal animations.
5. **Performance neutral or better** — v4 hits ~25ms max with 300 organisms. v5 must sustain similar or better given trees become organisms.
6. **Clean break** — no v4 save compatibility, no transition shims, no dual code paths.

### 1.2 Constraints

- **Domain-driven, event-bus communication** — preserve v4's architectural principles (no circular imports, no god objects).
- **No new dependencies** — TypeScript + esbuild + Canvas 2D, same as v4.
- **No test framework yet** — but write code that's testable (pure functions, dependency injection where reasonable).
- **Strict TypeScript, no `any`** — same as v4.
- **Browser-only target** — no Node-specific APIs.
- **All `.ts` files ≤ ~300 lines** — split if longer.

### 1.3 Non-Goals

- v4 backward compatibility
- Sexual reproduction for plants (v6+)
- Toxicity, dormancy traits (v6+)
- Player input on individual organisms
- Network multiplayer / persistence to server

---

## 2. Architecture Principles

### 2.1 Inherited from v4 (unchanged)

1. **Domain-driven.** Each domain owns its data, logic, and types. No domain reaches into another's internals.
2. **Event-driven communication.** Domains emit events through a central `EventBus`. Cross-domain side effects use events, not direct calls.
3. **Composition over inheritance.** `Organism` is composed of components (Genome, Needs, Inventory, Relationships, Pregnancy, etc.), not subclassed.
4. **Data flows down, events flow up.** The simulation tick reads state and calls domain update methods. Domains emit events when noteworthy things happen.
5. **Per-organism configuration.** All game-mechanical values that vary per organism come from genetics. Global constants are reserved for truly universal values (tick rate, grid size).

### 2.2 New for v5

6. **Continuous-only trait expression.** Every trait is a continuous value. "Capabilities" are just trait values above their functional minimum (Section 3.5.1 of PRD).
7. **Phenotype-locked behavior.** An organism's phenotype is computed once at birth and never re-derived. Re-parsing DNA per tick is too expensive.
8. **Cost scaling replaces hard caps.** Trait expression has no upper bound; cost functions on actions and passive drains are the natural limiter.
9. **Two tick paths.** Full decision-engine tick for mobile organisms; simplified tick for immobile organisms (plants, fungi, sessile predators).

---

## 3. Directory Structure

```
src/
  core/                          # Framework — imported by all, imports nothing from domains
    index.ts
    event-bus.ts
    types.ts                     # Universal types (IPosition, ResourceType, FoodType)
    constants.ts                 # Truly global: TICK_MS, GRID_SIZE, CELL_PX, LEVEL_CAP
    tuning.ts                    # NEW: All v5 tuning constants in one place
    utils.ts                     # rnd, clamp, key, uuid, manhattan, lerp
    pathfinding.ts               # A* taking IGridQuery interface

  domains/
    genetics/                    # DNA encoding, expression, crossover, mutation
      index.ts
      genome.ts                  # Genome class
      gene-registry.ts           # v5 trait catalog (rewritten)
      expression.ts              # expressGenome(dna) → TraitSet (no hard caps)
      crossover.ts               # Unchanged from v4
      mutation.ts                # Volatility-driven mutation rate
      viability.ts               # Viability checks (BB, DD, energy source)
      cost-functions.ts          # NEW: trait → cost mapping (action cost, passive drain)
      types.ts                   # GeneDef, TraitDef, TraitSet (v5 schema)

    phenotype/                   # NEW DOMAIN: classification, movesets, animations
      index.ts
      phenotype-classifier.ts    # classify(traits) → PhenotypeClass
      phenotype-registry.ts      # Phenotype rule table (data-driven)
      moveset-registry.ts        # PhenotypeClass → moveset (idle, action variants, juvenile, elder)
      animation-registry.ts      # ActionType → animation type mapping
      lifecycle.ts               # Juvenile/Adult/Elder transition logic
      types.ts                   # PhenotypeClass enum, PhenotypeRule, Moveset, AnimationType

    entity/                      # Organism (replaces Agent), components
      index.ts
      organism.ts                # Organism class (was agent.ts) — unified for all life
      organism-factory.ts        # create(), createChild(), createFromSeed()
      family-registry.ts         # Lineage tracking
      components/
        needs.ts                 # NeedSet — animal-like organisms only
        inventory.ts
        relationships.ts
        pregnancy.ts             # v5 transfer mechanic
        memory.ts                # ResourceMemory (extracted from v4 agent.ts)
      types.ts                   # OrganismOpts, etc.

    decision/                    # What should this organism do next?
      index.ts
      decision-engine.ts         # Full engine for mobile organisms
      simplified-tick.ts         # NEW: simplified tick for immobile organisms
      context-builder.ts
      action-scorer.ts
      need-evaluator.ts
      flee-evaluator.ts
      types.ts

    action/                      # Action definitions and execution
      index.ts
      action-registry.ts         # v5 actions: includes hunt, generalized harvest
      action-factory.ts          # Builds IActionState, calculates cost from genetics
      action-processor.ts        # Tick-by-tick execution
      effects/
        combat-effects.ts
        social-effects.ts
        survival-effects.ts
        resource-effects.ts      # Includes corpse harvesting
        build-effects.ts
        hygiene-effects.ts
        reproduce-effects.ts     # Pregnancy transfer mechanic
        photosynthesis-effects.ts # NEW
      types.ts                   # ActionDef gains tool field, targetType field

    world/                       # Grid, terrain, blocks
      index.ts
      world.ts                   # Slim container (was already slim in v4)
      grid.ts
      terrain-field.ts
      food-field.ts
      water-field.ts
      block-manager.ts           # CorpseBlock replaces TreeBlock
      world-generator.ts         # NEW: terrain generation with isolation pockets
      types.ts                   # IFoodBlock, ICorpseBlock (replaces ITreeBlock)

    faction/                     # Faction formation — only for Sociality > min organisms
      index.ts
      faction.ts
      faction-manager.ts

    simulation/                  # Tick orchestration
      index.ts
      simulation-engine.ts       # Top-level tick
      organism-updater.ts        # Routes to full or simplified tick
      world-updater.ts           # Per-tick world updates
      spawner.ts                 # Initial population, seed/spore placement

    rendering/                   # Canvas drawing
      index.ts
      renderer.ts
      camera.ts
      emoji-cache.ts
      organism-renderer.ts       # NEW: unified organism rendering
      indicator-renderer.ts      # NEW: indicator slot system
      tool-renderer.ts           # NEW: directional tool rendering (preserves v4)
      animation-runner.ts        # NEW: animation state per organism

    ui/                          # DOM, inspector, controls
      index.ts
      ui-manager.ts
      input-handler.ts
      controls.ts
      indicator-config.ts        # NEW: per-slot indicator data source dropdowns

    persistence/                 # Save/load
      index.ts
      persistence-manager.ts     # v5 schema, version marker

  main.ts                        # Entry point
```

### 3.1 What Gets Deleted

The clean break removes the following v4 files entirely:

- `src/domains/entity/agent.ts` → renamed and rewritten as `organism.ts`
- `src/domains/entity/entity-class.ts` → replaced by `phenotype/lifecycle.ts`
- `src/domains/world/types.ts:ITreeBlock` and all tree-block code paths
- `src/domains/world/block-manager.ts` tree handling sections
- `src/domains/rendering/renderer.ts` tree rendering paths

The clean break adds these new files (listed above in the directory tree).

---

## 4. Core Framework

### 4.1 Constants (`core/constants.ts`)

Only universal, never-per-organism values. Unchanged in spirit from v4:

```typescript
export const CELL_PX = 16;
export const GRID_SIZE = 120;             // Expanded from v4's 62
export const WORLD_PX = GRID_SIZE * CELL_PX;
export const TICK_MS = 250;
export const LEVEL_CAP = 20;
```

### 4.2 Tuning Constants (`core/tuning.ts`) — NEW

All non-universal numeric tuning lives in a single `tuning.ts` module exporting `TUNE`. This separates tuning from code, enabling rapid iteration without hunting through files.

```typescript
export const TUNE = {
  // Functional minimums (from v5-prd.md Section 3.5.1)
  functionalMin: {
    photosynthesis: 20,
    agility: 5,
    sociality: 15,
    carnivory: 10,
    aquatic: 10,
    saltwaterTolerance: 5,
    aptitude: 5,
    strength: 3,
    emotion: 10,
    pregnancy: 5,
    harvestable: 10,
  },

  // Cost scaling coefficients
  cost: {
    attackEnergyPerStrength: 0.015,        // Energy per attack = base + (strength × this)
    moveEnergyPerAgility: 0.008,
    perceptionPassiveDrain: 0.003,
    immunityPassiveDrain: 0.002,
    recallSlotPassiveDrain: 0.0008,
    photosynthesisHpPenaltyPerUnit: 0.5,    // Max HP reduction per Photo unit
    levelEnergyMultPerLevel: 0.04,          // +4% energy cost per level gained
  },

  // Phenotype thresholds (mid/high values referenced by phenotype rules)
  phenotype: {
    socialityHigh: 30,
    aquaticHigh: 50,
    aquaticMid: 25,
    carnivoryMid: 35,
    strengthMid: 15,
  },

  // Pregnancy
  pregnancy: {
    needTransferRate: 0.4,                  // Per-tick fraction of need transferred
    completionThreshold: 80,                // Child needs reach this → birth
  },

  // Mutation
  mutation: {
    baseRate: 0.005,                        // At default Volatility
    geneDupChance: 0.01,
    geneDelChance: 0.01,
    minDnaLength: 100,
    maxDnaLength: 350,                      // Expanded from v4's 250
  },

  // Decay rates (defaults — actual values come from genes per organism)
  decay: {
    baseFullnessPerTick: 0.03,
    baseHygienePerTick: 0.02,
    baseSocialPerTick: 0.01,
    baseEnergyPerTick: 0.01,
  },

  // Photosynthesis
  photosynthesis: {
    baseRatePerUnit: 0.02,                  // Energy per tick per Photo unit
    waterProximityBoost: 1.5,               // Multiplier when near water
    waterProximityRadius: 5,                // Cells
    droughtPenalty: 0.4,                    // Multiplier when far from water
  },

  // Corpse decay
  corpse: {
    decayMs: 60000,                         // 1 minute before disappearing
    plantYieldPerSize: 2.0,                 // Plant food per Size unit
    meatYieldPerSize: 3.0,                  // Meat food per Size unit
  },

  // World generation
  world: {
    obstacleDensity: 0.08,                  // Fraction of cells as obstacles
    isolationPocketCount: 4,                // Target number of regions
  },
} as const;

export type TuneConfig = typeof TUNE;
```

This module is imported by domains that need numerical tuning. The TUNE object is `as const` for compile-time safety. Future iteration: a debug UI could mutate TUNE values at runtime for live tuning, but this is out of v5 scope.

### 4.3 Universal Types (`core/types.ts`)

```typescript
export interface IPosition {
  readonly x: number;
  readonly y: number;
}

export type FoodType = 'plant' | 'meat';

export interface IInventory {
  plantFood: number;
  meatFood: number;
  water: number;
  wood: number;
}

export type ResourceType = keyof IInventory;
export type ResourceMemoryType = 'plantFood' | 'meatFood' | 'water' | 'wood' | 'corpse';

export interface IResourceMemoryEntry {
  x: number;
  y: number;
  tick: number;
}
```

### 4.4 EventBus (`core/event-bus.ts`)

Unchanged from v4 — same `on/off/emit` interface. Synchronous, single-threaded.

### 4.5 Pathfinding (`core/pathfinding.ts`)

Unchanged from v4 — pure function, takes `IGridQuery`.

---

## 5. Domain: Genetics

**Responsibility:** DNA encoding, gene parsing, trait expression, crossover, mutation, viability, cost calculation. Pure functions only — no side effects, no world state.

### 5.1 Gene Code Allocation

The v5 trait catalog requires 30 distinct gene codes. v4 used letter pairs for both essential and non-essential traits (AA, BB, ... VV) and we extend with additional pairs.

```typescript
// Essential
'BB' Longevity
'DD' Metabolism

// Body & Physiology
'AA' Strength
'CC' Vigor
'EE' Resilience
'FF' Immunity
'GG' Agility
'AJ' Size
'AL' Regeneration
'RR' Endurance

// Mobility, Senses, Diet
'ZZ' Aquatic
'AH' Saltwater Tolerance
'XX' Photosynthesis
'AB' Carnivory
'MM' Perception

// Mind & Behavior
'YY' Emotion
'HH' Aptitude
'KK' Courage
'JJ' Aggression
'AN' Recall

// Social
'AD' Sociality
'NN' Charisma
'II' Cooperation
'SS' Fidelity

// Reproduction & Lifecycle
'LL' Fertility
'AG' Pregnancy
'TT' Parthenogenesis
'VV' Maternity
'QQ' Maturity
'AE' Harvestable
'AP' Volatility

// Resource Behavior
'PP' Appetite
'UU' Greed
```

### 5.2 TraitSet (`genetics/types.ts`)

The v5 `TraitSet` is significantly larger than v4's. It is a single immutable object built once during expression.

```typescript
export interface TraitSet {
  // Essential
  longevity:          { maxAgeMs: number };
  metabolism:         { fullnessDecay: number; actionDurationMult: number };

  // Body
  strength:           { value: number };       // Continuous, raw expression
  vigor:              { baseMaxEnergy: number; perLevel: number };
  resilience:         { baseMaxHp: number; perLevel: number };
  immunity:           { contractionChance: number };
  agility:            { speedMult: number };
  size:               { value: number };
  regeneration:       { hpPerTick: number };
  endurance:          { inventoryCapacity: number };

  // Mobility / Senses / Diet
  aquatic:            { value: number };       // Swim speed, gates water
  saltwaterTolerance: { extractionRate: number };
  photosynthesis:     { value: number };       // Energy per tick at default conditions
  carnivory:          { value: number };       // Diet efficiency curve input
  perception:         { radius: number };

  // Mind
  emotion:            { value: number };
  aptitude:           { xpPerLevel: number };
  courage:            { fleeHpRatio: number };
  aggression:         { baseProbability: number };
  recall:             { memorySlots: number };

  // Social
  sociality:          { value: number };       // Capability + drive
  charisma:           { relationshipSlots: number };
  cooperation:        { baseProbability: number };
  fidelity:           { leaveProbability: number };

  // Reproduction
  fertility:          { energyThreshold: number; urgencyAge: number };
  pregnancy:          { gestationMs: number };
  parthenogenesis:    { canSelfReproduce: boolean };
  maternity:          { feedProbability: number };
  maturity:           { juvenileMs: number };
  harvestable:        { value: number };
  volatility:         { mutationRate: number };

  // Resources
  appetite:           { seekThreshold: number; criticalThreshold: number };
  greed:              { hoardProbability: number };
}
```

Each trait has either a single `value` field (for continuous traits whose magnitude is the entire meaning) or named subfields (for traits that derive multiple game stats).

### 5.3 TraitDef Schema (`genetics/types.ts`)

```typescript
export interface TraitDef {
  code: string;
  name: string;
  essential: boolean;
  components: TraitComponentDef[];
}

export interface TraitComponentDef {
  key: string;
  default: number;        // Value when no genes are present
  scale: number;          // Raw gene magnitude divisor
  floor: number;          // Soft minimum (often 0)
  inverted: boolean;      // True = positive genes reduce the value
  // NOTE: no `max` field — v5 has no hard ceilings
}
```

### 5.4 Expression Function (`genetics/expression.ts`)

Replaces v4's `clamp(default + (direction × raw / scale), min, max)` with `max(floor, default + (direction × raw / scale))`.

```typescript
export function expressGenome(dna: string): TraitSet {
  const genes = parseDna(dna);
  const traitSet: Partial<TraitSet> = {};

  for (const [code, def] of GENE_REGISTRY) {
    const matchingGenes = genes.filter(g => g.code.toUpperCase() === code);
    const positive = matchingGenes
      .filter(g => isReinforcing(g.code))
      .reduce((sum, g) => sum + g.magnitude, 0);
    const negative = matchingGenes
      .filter(g => !isReinforcing(g.code))
      .reduce((sum, g) => sum + g.magnitude, 0);
    const raw = positive - negative;

    for (const comp of def.components) {
      const direction = comp.inverted ? -1 : 1;
      const value = Math.max(
        comp.floor,
        comp.default + (direction * raw / comp.scale)
      );
      // Assign into traitSet[def.name][comp.key] = value
      assignTraitComponent(traitSet, def, comp, value);
    }
  }

  return finalizeTraitSet(traitSet);
}
```

The key change from v4: **no `Math.min(comp.max, ...)` clamp.** Traits are unbounded above; cost functions limit them naturally.

### 5.5 Cost Functions (`genetics/cost-functions.ts`) — NEW

This module exposes pure functions that derive per-organism cost values from a `TraitSet`. Other domains call these instead of using global TUNE values directly when the cost should scale with traits.

```typescript
export function attackEnergyCost(traits: TraitSet): number {
  return TUNE.actionBaseCost.attack
    + traits.strength.value * TUNE.cost.attackEnergyPerStrength;
}

export function moveEnergyCost(traits: TraitSet): number {
  return TUNE.actionBaseCost.move
    + traits.agility.speedMult * TUNE.cost.moveEnergyPerAgility;
}

export function passiveEnergyDrainPerTick(traits: TraitSet): number {
  return TUNE.decay.baseEnergyPerTick
    + traits.perception.radius * TUNE.cost.perceptionPassiveDrain
    + traits.immunity.contractionChance * 0  // immunity inverts; use a different calc
    + traits.recall.memorySlots * TUNE.cost.recallSlotPassiveDrain;
}

export function maxHpAdjustment(traits: TraitSet): number {
  // Photosynthesis fragility penalty
  return -traits.photosynthesis.value * TUNE.cost.photosynthesisHpPenaltyPerUnit;
}

export function levelEnergyMultiplier(level: number): number {
  return 1 + (level - 1) * TUNE.cost.levelEnergyMultPerLevel;
}

export function carnivoryEfficiency(traits: TraitSet, foodType: FoodType): number {
  const c = traits.carnivory.value;
  if (foodType === 'meat') {
    if (c < TUNE.functionalMin.carnivory) return 0;
    return Math.min(1, c / 50);
  } else {
    // Plant food efficiency drops at extreme carnivory
    if (c < 30) return 1;
    if (c > 100) return 0;
    return 1 - (c - 30) / 70;
  }
}
```

These are referenced by `action-factory.ts` (when materializing an action's cost) and `organism-updater.ts` (per-tick passive drain).

### 5.6 Viability (`genetics/viability.ts`)

```typescript
export function isViable(traits: TraitSet, dna: string): boolean {
  // Essential traits
  if (traits.longevity.maxAgeMs <= 0) return false;
  if (traits.metabolism.fullnessDecay <= 0) return false;

  // Energy source (heterotrophy is default; only fail if Photo present but below min)
  // Heterotrophy has no gene — it's the absence of a "no-eating" gene, which v5 doesn't have
  // So the only failure mode is: Vigor or Resilience at zero
  if (traits.vigor.baseMaxEnergy <= 0) return false;
  if (traits.resilience.baseMaxHp <= 0) return false;

  // DNA length
  if (dna.length < TUNE.mutation.minDnaLength) return false;

  return true;
}
```

Note: There is **no separate stillbirth probability**. Viability is the only stillbirth check. Volatility increases stillbirth indirectly by mutating more genes, sometimes breaking essentials.

### 5.7 Mutation (`genetics/mutation.ts`)

```typescript
export function mutate(dna: string, mutationRate: number): string {
  // Same logic as v4 but `mutationRate` is now a parameter
  // (was constant 0.005 in v4)
  const chars = dna.split('');
  for (let i = 0; i < chars.length; i++) {
    if (Math.random() < mutationRate) {
      chars[i] = randomChar(i);
    }
  }
  // ... gene duplication, gene deletion, length clamp, padding (unchanged from v4)
}
```

Callers (in `reproduce-effects.ts`) compute the rate from parents' Volatility:

```typescript
const childMutationRate = (parentA.traits.volatility.mutationRate
                         + parentB.traits.volatility.mutationRate) / 2;
const childDna = mutate(crossover(parentA.dna, parentB.dna), childMutationRate);
```

For asexual reproduction:

```typescript
const childMutationRate = parent.traits.volatility.mutationRate;
const childDna = mutate(parent.dna, childMutationRate);
```

### 5.8 Crossover (`genetics/crossover.ts`)

Unchanged from v4. Pure positional gene swap.

---

## 6. Domain: Phenotype (NEW)

**Responsibility:** Classify organisms into phenotype classes, provide moveset and animation lookups, manage lifecycle stage transitions.

### 6.1 PhenotypeClass Enum

```typescript
// phenotype/types.ts
export enum PhenotypeClass {
  Plant            = 'plant',
  SessilePredator  = 'sessile_predator',
  Fungus           = 'fungus',
  Fish             = 'fish',
  Amphibian        = 'amphibian',
  PhotoCritter     = 'photo_critter',
  Person           = 'person',
  ColonyInsect     = 'colony_insect',
  Predator         = 'predator',
  Critter          = 'critter',
  Blob             = 'blob',
}

export enum LifecycleStage {
  Juvenile = 'juvenile',
  Adult    = 'adult',
  Elder    = 'elder',
}

export type AnimationType =
  | 'shake' | 'bob' | 'pulse' | 'bounce'
  | 'shrink' | 'wiggle' | 'flash' | 'sway' | 'none';
```

### 6.2 Phenotype Rule Table (`phenotype/phenotype-registry.ts`)

```typescript
export interface PhenotypeRule {
  phenotype: PhenotypeClass;
  predicate: (traits: TraitSet) => boolean;
}

export const PHENOTYPE_RULES: ReadonlyArray<PhenotypeRule> = [
  // Immobile branch (plant emoji is locked behind Agility = 0)
  {
    phenotype: PhenotypeClass.Plant,
    predicate: (t) => t.agility.speedMult < TUNE.functionalMin.agility
                   && t.photosynthesis.value >= TUNE.functionalMin.photosynthesis,
  },
  {
    phenotype: PhenotypeClass.SessilePredator,
    predicate: (t) => t.agility.speedMult < TUNE.functionalMin.agility
                   && t.photosynthesis.value < TUNE.functionalMin.photosynthesis
                   && t.strength.value >= TUNE.functionalMin.strength
                   && t.carnivory.value >= TUNE.functionalMin.carnivory,
  },
  {
    phenotype: PhenotypeClass.Fungus,
    predicate: (t) => t.agility.speedMult < TUNE.functionalMin.agility,
  },

  // Mobile branch — water-first
  {
    phenotype: PhenotypeClass.Fish,
    predicate: (t) => t.agility.speedMult >= TUNE.functionalMin.agility
                   && t.aquatic.value >= TUNE.phenotype.aquaticHigh
                   && t.agility.speedMult <= 10,  // Land speed effectively zero
  },
  {
    phenotype: PhenotypeClass.Amphibian,
    predicate: (t) => t.agility.speedMult >= TUNE.functionalMin.agility
                   && t.aquatic.value >= TUNE.phenotype.aquaticMid,
  },
  {
    phenotype: PhenotypeClass.PhotoCritter,
    predicate: (t) => t.agility.speedMult >= TUNE.functionalMin.agility
                   && t.photosynthesis.value >= TUNE.functionalMin.photosynthesis,
  },
  {
    phenotype: PhenotypeClass.Person,
    predicate: (t) => t.agility.speedMult >= TUNE.functionalMin.agility
                   && t.sociality.value >= TUNE.functionalMin.sociality
                   && t.emotion.value >= TUNE.functionalMin.emotion,
  },
  {
    phenotype: PhenotypeClass.ColonyInsect,
    predicate: (t) => t.agility.speedMult >= TUNE.functionalMin.agility
                   && t.sociality.value >= TUNE.functionalMin.sociality,
  },
  {
    phenotype: PhenotypeClass.Predator,
    predicate: (t) => t.agility.speedMult >= TUNE.functionalMin.agility
                   && t.sociality.value < TUNE.functionalMin.sociality
                   && t.carnivory.value >= TUNE.phenotype.carnivoryMid
                   && t.strength.value >= TUNE.phenotype.strengthMid,
  },
  {
    phenotype: PhenotypeClass.Critter,
    predicate: (t) => t.agility.speedMult >= TUNE.functionalMin.agility,
  },

  // Fallback
  {
    phenotype: PhenotypeClass.Blob,
    predicate: () => true,
  },
];
```

### 6.3 Classifier (`phenotype/phenotype-classifier.ts`)

```typescript
export function classify(traits: TraitSet): PhenotypeClass {
  for (const rule of PHENOTYPE_RULES) {
    if (rule.predicate(traits)) return rule.phenotype;
  }
  return PhenotypeClass.Blob;
}

export function hasHygiene(phenotype: PhenotypeClass): boolean {
  return PHENOTYPE_TRAITS[phenotype].hasHygiene;
}

export function isImmobile(phenotype: PhenotypeClass): boolean {
  return PHENOTYPE_TRAITS[phenotype].immobile;
}

export function usesSimplifiedTick(phenotype: PhenotypeClass): boolean {
  return PHENOTYPE_TRAITS[phenotype].simplifiedTick;
}

export interface PhenotypeTraitFlags {
  hasHygiene: boolean;
  immobile: boolean;
  simplifiedTick: boolean;
  hasMood: boolean;
}

export const PHENOTYPE_TRAITS: Record<PhenotypeClass, PhenotypeTraitFlags> = {
  [PhenotypeClass.Plant]:           { hasHygiene: false, immobile: true,  simplifiedTick: true,  hasMood: false },
  [PhenotypeClass.SessilePredator]: { hasHygiene: false, immobile: true,  simplifiedTick: true,  hasMood: false },
  [PhenotypeClass.Fungus]:          { hasHygiene: false, immobile: true,  simplifiedTick: true,  hasMood: false },
  [PhenotypeClass.Fish]:            { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: true  },
  [PhenotypeClass.Amphibian]:       { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: true  },
  [PhenotypeClass.PhotoCritter]:    { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: false },
  [PhenotypeClass.Person]:          { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: true  },
  [PhenotypeClass.ColonyInsect]:    { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: false },
  [PhenotypeClass.Predator]:        { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: true  },
  [PhenotypeClass.Critter]:         { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: false },
  [PhenotypeClass.Blob]:            { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: false },
};
```

### 6.4 Movesets (`phenotype/moveset-registry.ts`)

```typescript
export interface Moveset {
  idle: string[];                              // Pool of base emojis (one chosen at birth)
  juvenile: string;                            // Single emoji for juvenile stage
  elder: string | null;                        // Null = no elder variant (plants, fungi)
  actionVariants: Partial<Record<ActionType, string>>;
  // If a key is missing, the action falls back to idle + animation
}

export const MOVESETS: Record<PhenotypeClass, Moveset> = {
  [PhenotypeClass.Plant]: {
    idle: ['🌲', '🌳', '🌴', '🌵', '🌻'],
    juvenile: '🌱',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.SessilePredator]: {
    idle: ['🪸'],
    juvenile: '🌱',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Fungus]: {
    idle: ['🍄', '🪨'],
    juvenile: '🟤',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Fish]: {
    idle: ['🐟', '🐠', '🐡'],
    juvenile: '🐟',
    elder: '🐡',
    actionVariants: {},
  },
  [PhenotypeClass.Amphibian]: {
    idle: ['🐸', '🦎', '🐢'],
    juvenile: '🐸',
    elder: '🐢',
    actionVariants: {},
  },
  [PhenotypeClass.PhotoCritter]: {
    idle: ['🐸', '🦎', '🐛', '🐌'],   // Greenish-tinted creatures (Section 4.2 of PRD)
    juvenile: '🐛',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Person]: {
    idle: ['😊', '😐', '😟'],
    juvenile: '👶',
    elder: '🧓',
    actionVariants: {
      attack: '😡',
      sleep: '😴',
      eat: '😋',
    },
  },
  [PhenotypeClass.ColonyInsect]: {
    idle: ['🐜', '🐝'],
    juvenile: '🥚',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Predator]: {
    idle: ['🐺', '🦊', '🐍'],
    juvenile: '🐺',
    elder: null,
    actionVariants: { attack: '🐺' },
  },
  [PhenotypeClass.Critter]: {
    idle: ['🐛', '🦎', '🐌'],
    juvenile: '🐛',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Blob]: {
    idle: ['🫧'],
    juvenile: '🫧',
    elder: null,
    actionVariants: {},
  },
};

export function pickIdleEmoji(phenotype: PhenotypeClass, seed: number): string {
  const set = MOVESETS[phenotype].idle;
  return set[seed % set.length];
}
```

### 6.5 Animation Registry (`phenotype/animation-registry.ts`)

```typescript
export const ACTION_ANIMATIONS: Record<ActionType, AnimationType> = {
  attack:        'shake',
  hunt:          'shake',
  harvest:       'wiggle',
  eat:           'wiggle',
  drink:         'wiggle',
  reproduce:     'bounce',
  sleep:         'sway',
  wash:          'wiggle',
  talk:          'bob',
  share:         'bob',
  heal:          'pulse',
  build_farm:    'wiggle',
  poop:          'wiggle',
  // ... etc
  idle:          'none',
};

// Stand-alone animation triggers (not tied to action)
export const EVENT_ANIMATIONS = {
  takeDamage: 'shake' as AnimationType,
  death:      'shrink' as AnimationType,
  levelUp:    'flash' as AnimationType,
  birth:      'bounce' as AnimationType,
};
```

### 6.6 Lifecycle (`phenotype/lifecycle.ts`)

```typescript
export function getLifecycleStage(
  ageTicks: number,
  juvenileTicks: number,
  maxAgeTicks: number
): LifecycleStage {
  if (ageTicks < juvenileTicks) return LifecycleStage.Juvenile;
  if (ageTicks > maxAgeTicks * 0.8) return LifecycleStage.Elder;
  return LifecycleStage.Adult;
}

export function getCurrentEmoji(
  phenotype: PhenotypeClass,
  stage: LifecycleStage,
  baseIdleEmoji: string,
  actionType: ActionType | null
): string {
  const moveset = MOVESETS[phenotype];

  // Stage variant takes precedence
  if (stage === LifecycleStage.Juvenile) return moveset.juvenile;
  if (stage === LifecycleStage.Elder && moveset.elder) return moveset.elder;

  // Action variant if available
  if (actionType && moveset.actionVariants[actionType]) {
    return moveset.actionVariants[actionType]!;
  }

  // Fallback to base idle (selected at birth, so each organism uses the same one consistently)
  return baseIdleEmoji;
}
```

---

## 7. Domain: Entity

**Responsibility:** The `Organism` class (the unified entity), components, factory, family registry.

### 7.1 Organism Class (`entity/organism.ts`)

The `Organism` class is a generalization of v4's `Agent`. It includes everything an agent had plus phenotype, lifecycle, and conditional components.

```typescript
export class Organism {
  readonly id: string;
  readonly genome: Genome;
  readonly traits: TraitSet;
  readonly familyName: string;
  readonly phenotype: PhenotypeClass;       // Locked at birth
  readonly baseIdleEmoji: string;            // Selected from moveset at birth
  readonly hasHygiene: boolean;              // Derived from phenotype at birth

  // Components (some conditional based on phenotype)
  readonly needs: NeedSet;                   // Always present, but hygiene field unused if !hasHygiene
  readonly inventory: Inventory;
  readonly relationships: RelationshipMap;   // Empty if Sociality < min
  readonly pregnancy: PregnancyState | null; // Null if Pregnancy < min
  readonly memory: ResourceMemory;

  // Stats derived from traits, updated on level-up
  maxHealth: number;
  maxEnergy: number;

  // Mutable state
  name: string;
  health: number;
  energy: number;
  level: number;
  xp: number;
  ageTicks: number;
  maxAgeTicks: number;
  juvenileTicks: number;
  factionId: string | null;
  diseased: boolean;
  lifecycleStage: LifecycleStage;

  // Movement / action
  cellX: number;
  cellY: number;
  prevCellX: number;
  prevCellY: number;
  lerpT: number;
  path: IPosition[] | null;
  pathIdx: number;
  goal: IPosition | null;
  replanAtTick: number;
  action: IActionState | null;
  lockMsRemaining: number;
  matingTargetId: string | null;
  moveCredit: number;

  // Lineage
  generation: number;
  parentIds: string[];

  constructor(opts: OrganismOpts);

  // ── Computed views ──
  get isImmobile(): boolean;
  get usesSimplifiedTick(): boolean;
  get effectiveAttack(): number;            // Strength × pregnancy/level mods
  get speedMult(): number;
  get fullnessDecayMult(): number;
  get currentEmoji(): string;

  // ── Mutation methods ──
  takeDamage(amount: number): void;
  healBy(amount: number): void;
  drainEnergy(amount: number): void;
  addEnergy(amount: number): void;
  drainFullness(amount: number): void;
  addFullness(amount: number): void;
  addXp(amount: number): void;
  levelUp(): void;
  clampStats(): void;

  get isDead(): boolean;
}
```

### 7.2 Components

#### 7.2.1 NeedSet (`entity/components/needs.ts`)

```typescript
export class NeedSet {
  fullness: number;
  hygiene: number;        // Unused if organism has no hygiene
  social: number;         // Unused if Sociality < min
  inspiration: number;    // Animal-like only

  constructor(init: { fullness: number; hygiene: number; social: number; inspiration: number });

  clamp(): void;

  // Band evaluation against organism-specific thresholds
  fullnessBand(traits: TraitSet): NeedBand;
  // ... etc
}
```

#### 7.2.2 Inventory (`entity/components/inventory.ts`)

Updated for v5's `IInventory` shape (plantFood, meatFood, water, wood):

```typescript
export class Inventory {
  capacity: number;
  plantFood: number;
  meatFood: number;
  water: number;
  wood: number;

  constructor(capacity: number, init?: Partial<IInventory>);

  add(type: ResourceType, amount: number): number;
  remove(type: ResourceType, amount: number): number;
  total(): number;
  isFull(): boolean;
}
```

#### 7.2.3 PregnancyState (`entity/components/pregnancy.ts`)

v5's pregnancy is significantly different — it tracks the offspring's needs being filled gradually:

```typescript
export class PregnancyState {
  active: boolean;
  childDna: string | null;
  childFamilyName: string | null;
  childFactionId: string | null;
  partnerId: string | null;

  // v5 transfer mechanic
  childNeeds: { fullness: number; hygiene: number; social: number; inspiration: number };
  transferRate: number;                 // Per-tick rate, derived from parent's Pregnancy expression
  gestationStartTick: number;

  start(opts: {
    childDna: string;
    childFamilyName: string;
    childFactionId: string | null;
    partnerId: string | null;
    transferRate: number;
    startTick: number;
  }): void;

  /**
   * Per-tick transfer step. Returns the amount drained from each of the parent's needs
   * (the parent's needs decay by this amount on top of their normal decay).
   */
  tickTransfer(): { fullnessDrained: number; hygieneDrained: number; socialDrained: number; inspirationDrained: number };

  isReadyForBirth(): boolean;            // True when all child needs ≥ TUNE.pregnancy.completionThreshold

  end(): void;
}
```

#### 7.2.4 RelationshipMap (`entity/components/relationships.ts`)

Largely unchanged. Capacity is still genetic (Charisma).

#### 7.2.5 ResourceMemory (`entity/components/memory.ts`)

Extracted from v4's inline `agent.resourceMemory` Map. Now its own component, with `corpse` as a new memory type.

```typescript
export class ResourceMemory {
  private entries: Map<ResourceMemoryType, IResourceMemoryEntry[]>;
  private maxSlots: number;             // From traits.recall.memorySlots

  constructor(maxSlots: number);

  remember(type: ResourceMemoryType, x: number, y: number, tick: number): void;
  forget(type: ResourceMemoryType, x: number, y: number): void;
  recall(type: ResourceMemoryType): readonly IResourceMemoryEntry[];
}
```

### 7.3 Organism Factory (`entity/organism-factory.ts`)

```typescript
export class OrganismFactory {
  create(opts: { dna?: string; cellX: number; cellY: number; familyName?: string }): Organism | null;
  createChild(parentA: Organism, parentB: Organism | null, cellX: number, cellY: number): Organism | null;
  createFromSeed(parent: Organism, cellX: number, cellY: number): Organism | null;
  // Returns null if viability fails (stillborn).
}
```

The factory:
1. Generates or accepts DNA
2. Calls `mutate()` with parent volatility (if applicable)
3. Crosses over (if sexual reproduction)
4. Constructs `Genome` and runs `expressGenome` to get `TraitSet`
5. Calls `viability.isViable()` — if false, emits `organism:stillborn` and returns null
6. Calls `phenotype.classify()` to get phenotype class
7. Picks `baseIdleEmoji` from phenotype moveset using a hash of the genome
8. Constructs `Organism` with all derived fields

---

## 8. Domain: Decision

**Responsibility:** Decide what an organism does next. Two distinct paths: full decision engine (mobile organisms) and simplified tick (immobile organisms).

### 8.1 Routing (`simulation/organism-updater.ts`)

```typescript
export function updateOrganism(
  organism: Organism,
  world: World,
  decisionEngine: DecisionEngine,
  simplifiedTick: SimplifiedTick,
  tickMs: number,
): void {
  // Drain stats (same for all)
  drainStats(organism, tickMs);
  if (checkDeath(organism, world)) return;

  // Branch on phenotype
  if (organism.usesSimplifiedTick) {
    simplifiedTick.process(organism, world, tickMs);
  } else {
    decisionEngine.tick(organism, world, tickMs);
  }
}
```

### 8.2 Full Decision Engine (`decision/decision-engine.ts`)

Largely inherited from v4 with these v5 changes:

- Action availability filtering uses `phenotype.classify()` flags + trait expression
- Action scoring includes new genetic factors from v5 traits
- Hunt action is added to combat scoring path
- Flee evaluator unchanged

### 8.3 Simplified Tick (`decision/simplified-tick.ts`) — NEW

For plants, fungi, sessile predators. No action scoring, no decision tree, no movement.

```typescript
export class SimplifiedTick {
  constructor(
    private world: World,
    private bus: EventBus,
    private organismFactory: OrganismFactory,
  ) {}

  process(organism: Organism, world: World, tickMs: number): void {
    // 1. Photosynthesis: passive energy gain if Photosynthesis > min
    if (organism.traits.photosynthesis.value >= TUNE.functionalMin.photosynthesis) {
      this.applyPhotosynthesis(organism, world, tickMs);
    }

    // 2. Regeneration: passive HP recovery if Regeneration > 0
    if (organism.traits.regeneration.hpPerTick > 0) {
      organism.healBy(organism.traits.regeneration.hpPerTick * (tickMs / 1000));
    }

    // 3. Reproduction: periodic seed/spore dispersal
    if (this.shouldReproduce(organism)) {
      this.attemptDispersal(organism, world);
    }

    // 4. Sessile attack: if Strength > 0, attack adjacent prey on contact
    if (organism.traits.strength.value > TUNE.functionalMin.strength) {
      this.tryReactiveAttack(organism, world);
    }

    // 5. Lifecycle stage update
    this.updateLifecycleStage(organism);

    // 6. Death check happens in the caller (drainStats path)
  }

  private applyPhotosynthesis(organism: Organism, world: World, tickMs: number): void {
    const base = organism.traits.photosynthesis.value * TUNE.photosynthesis.baseRatePerUnit;
    const waterDist = world.waterField.distanceFrom(organism.cellX, organism.cellY);
    const proximityMult = waterDist <= TUNE.photosynthesis.waterProximityRadius
      ? TUNE.photosynthesis.waterProximityBoost
      : TUNE.photosynthesis.droughtPenalty;
    const energyGain = base * proximityMult * (tickMs / 1000);
    organism.addEnergy(energyGain);

    // Photosynthesis also fills fullness slowly (energy is converted from sunlight, not food)
    organism.addFullness(energyGain * 0.5);
  }

  private shouldReproduce(organism: Organism): boolean {
    return organism.energy >= organism.traits.fertility.energyThreshold
        && organism.lifecycleStage === LifecycleStage.Adult
        && Math.random() < 0.02;  // ~2% per tick when eligible
  }

  private attemptDispersal(organism: Organism, world: World): void {
    // Pick a random nearby cell, attempt to place a juvenile
    const dx = Math.floor(Math.random() * 5) - 2;
    const dy = Math.floor(Math.random() * 5) - 2;
    const tx = organism.cellX + dx;
    const ty = organism.cellY + dy;
    if (!world.grid.isInBounds(tx, ty)) return;
    if (world.grid.isOccupied(tx, ty) || world.grid.isBlocked(tx, ty)) return;

    const child = this.organismFactory.createFromSeed(organism, tx, ty);
    if (child) {
      world.addOrganism(child);
      organism.drainEnergy(organism.traits.fertility.energyThreshold * 0.3);
    }
  }

  private tryReactiveAttack(organism: Organism, world: World): void {
    // Check 4 adjacent cells for prey, attack the first one found
    // ...
  }

  private updateLifecycleStage(organism: Organism): void {
    const newStage = getLifecycleStage(
      organism.ageTicks,
      organism.juvenileTicks,
      organism.maxAgeTicks
    );
    if (newStage !== organism.lifecycleStage) {
      organism.lifecycleStage = newStage;
    }
  }
}
```

The simplified tick is **dramatically cheaper** than the full decision engine — no scoring, no pathfinding, no context building. This is what makes it feasible to convert all trees into organisms without a performance hit.

---

## 9. Domain: Action

**Responsibility:** Action definitions, instantiation, execution, completion effects.

### 9.1 v5 Action Registry Changes

The v4 action registry is rewritten to match v5 mechanics:

```typescript
export const ACTION_REGISTRY: ReadonlyMap<ActionType, ActionDef> = new Map<ActionType, ActionDef>([
  // ... all v4 actions retained, with these changes:

  // Generalized attack: works against any organism
  ['attack', {
    type: 'attack',
    tags: new Set([ActionTag.COMBAT]),
    baseEnergyCost: 0.4,                   // Base; actual cost computed per-organism via cost-functions
    durationRange: [1170, 2340],
    requiresTarget: true,
    targetType: 'external_cell',           // NEW: enables tool rendering
    targetRange: 2,
    interruptible: false,
    tool: '⚔️',                              // NEW: tool emoji
  }],

  // NEW: hunt — like attack, but specifically for food acquisition
  ['hunt', {
    type: 'hunt',
    tags: new Set([ActionTag.COMBAT, ActionTag.RESOURCE]),
    baseEnergyCost: 0.5,
    durationRange: [1500, 2600],
    requiresTarget: true,
    targetType: 'external_cell',
    targetRange: 2,
    interruptible: false,
    tool: '⚔️',
  }],

  // Generalized harvest: works against corpses (not trees, those are organisms now)
  ['harvest', {
    type: 'harvest',
    tags: new Set([ActionTag.RESOURCE]),
    baseEnergyCost: 0.25,
    durationRange: [1560, 3900],
    requiresTarget: true,
    targetType: 'external_cell',
    targetRange: 1,
    interruptible: false,
    tool: '✋',
  }],

  // NEW: photosynthesize — for organisms with Photosynthesis (called by simplified tick OR full engine)
  ['photosynthesize', {
    type: 'photosynthesize',
    tags: new Set([ActionTag.SURVIVAL]),
    baseEnergyCost: 0,
    durationRange: [0, 0],                 // Continuous, not a discrete action
    requiresTarget: false,
    targetType: 'self',
    targetRange: 0,
    interruptible: true,
    tool: null,
  }],

  // NEW: drink_saltwater
  ['drink_saltwater', {
    type: 'drink_saltwater',
    tags: new Set([ActionTag.SURVIVAL]),
    baseEnergyCost: 0.05,
    durationRange: [2000, 3000],
    requiresTarget: false,
    targetType: 'self',
    targetRange: 0,
    interruptible: true,
    tool: null,
  }],

  // Sleep, wash, eat — unchanged in spec but targetType set explicitly
  ['sleep', {
    type: 'sleep',
    // ...
    targetType: 'self',
    tool: null,
  }],
  // ...
]);
```

### 9.2 ActionDef Schema Changes

```typescript
export interface ActionDef {
  type: ActionType;
  tags: Set<ActionTag>;
  baseEnergyCost: number;                 // RENAMED from energyCost; per-organism cost computed via cost-functions
  durationRange: [number, number];
  requiresTarget: boolean;
  targetType: 'self' | 'external_cell' | 'area' | 'none';   // NEW
  targetRange: number;
  interruptible: boolean;
  tool: string | null;                    // NEW: tool emoji or null
}
```

### 9.3 Action Factory (`action/action-factory.ts`)

```typescript
export class ActionFactory {
  build(organism: Organism, def: ActionDef, target?: Target): IActionState {
    // Compute per-organism cost from cost-functions
    const cost = computeActionCost(organism.traits, organism.level, def);

    // Compute duration with metabolism multiplier
    const baseDuration = randomInRange(def.durationRange);
    const duration = baseDuration * organism.traits.metabolism.actionDurationMult;

    return {
      type: def.type,
      target,
      energyCostPerTick: cost,
      msRemaining: duration,
      // ...
    };
  }
}
```

### 9.4 Combat Effects (`action/effects/combat-effects.ts`)

Updated for v5:
- Attack damage = `organism.effectiveAttack * 0.4` (effectiveAttack now includes Strength + Size pleiotropy + level + pregnancy debuff)
- Kills with Harvestable > min trigger `block-manager.spawnCorpse()`
- Kills emit `corpse:created` event
- Hunt action's completion effect is identical to attack but emits `combat:hunt_kill` instead of `combat:kill` for differentiation

### 9.5 Reproduce Effects (`action/effects/reproduce-effects.ts`)

```typescript
export function applyReproduce(parent: Organism, partner: Organism | null, factory: OrganismFactory, bus: EventBus, currentTick: number): void {
  // Determine mutation rate from Volatility
  const rate = partner
    ? (parent.traits.volatility.mutationRate + partner.traits.volatility.mutationRate) / 2
    : parent.traits.volatility.mutationRate;

  // Generate child DNA
  const childDna = partner
    ? mutate(crossover(parent.genome.dna, partner.genome.dna), rate)
    : mutate(parent.genome.dna, rate);

  // Check pregnancy expression — does the parent gestate?
  if (parent.traits.pregnancy.gestationMs >= TUNE.pregnancy.completionThreshold) {
    // Start pregnancy state — child is NOT born yet
    parent.pregnancy!.start({
      childDna,
      childFamilyName: deriveFamilyName(parent, partner),
      childFactionId: parent.factionId,
      partnerId: partner?.id ?? null,
      transferRate: TUNE.pregnancy.needTransferRate,  // Or compute from gestationMs
      startTick: currentTick,
    });
    bus.emit('pregnancy:started', { organismId: parent.id });
  } else {
    // Instant birth — no gestation
    const child = factory.createChildFromDna(childDna, parent, partner, parent.cellX, parent.cellY);
    if (child) {
      bus.emit('organism:born', { childId: child.id, parentIds: [parent.id, partner?.id].filter(Boolean) });
    } else {
      bus.emit('organism:stillborn', { parentId: parent.id });
    }
  }
}
```

The pregnancy transfer logic runs in `organism-updater.ts` per tick:

```typescript
function processPregnancyTransfer(organism: Organism, currentTick: number, bus: EventBus): void {
  if (!organism.pregnancy?.active) return;

  const drained = organism.pregnancy.tickTransfer();
  organism.drainFullness(drained.fullnessDrained);
  organism.needs.hygiene = Math.max(0, organism.needs.hygiene - drained.hygieneDrained);
  organism.needs.social = Math.max(0, organism.needs.social - drained.socialDrained);
  organism.needs.inspiration = Math.max(0, organism.needs.inspiration - drained.inspirationDrained);

  if (organism.pregnancy.isReadyForBirth()) {
    // Birth: create child, emit event, end pregnancy
    const child = createChildFromPregnancy(organism);
    if (child) {
      bus.emit('organism:born', { childId: child.id, parentIds: [organism.id] });
    }
    organism.pregnancy.end();
  }
}
```

### 9.6 Resource Effects (`action/effects/resource-effects.ts`)

`harvest` effect now operates on `CorpseBlock`:

```typescript
export function applyHarvest(organism: Organism, corpse: CorpseBlock, world: World, bus: EventBus): void {
  // Determine harvest yield based on corpse type and organism diet
  const efficiency = corpse.foodType === 'meat'
    ? carnivoryEfficiency(organism.traits, 'meat')
    : carnivoryEfficiency(organism.traits, 'plant');

  if (efficiency === 0) return;  // Cannot eat this corpse

  const yieldAmount = Math.min(corpse.remainingResources, 5) * efficiency;
  if (corpse.foodType === 'meat') {
    organism.inventory.add('meatFood', yieldAmount);
  } else {
    organism.inventory.add('plantFood', yieldAmount);
    // Plant corpses also yield wood
    organism.inventory.add('wood', yieldAmount * 0.3);
  }

  corpse.remainingResources -= yieldAmount;
  if (corpse.remainingResources <= 0) {
    world.blockManager.removeCorpse(corpse.id);
  }
}
```

### 9.7 Photosynthesis Effects (`action/effects/photosynthesis-effects.ts`) — NEW

Used by mobile organisms with Photosynthesis. Immobile organisms get this in their simplified tick directly without going through the action system.

---

## 10. Domain: World

**Responsibility:** Grid, terrain, blocks, environmental fields, world generation.

### 10.1 Grid

Largely unchanged from v4. The grid stores organism IDs per cell and supports occupancy checks.

### 10.2 Block Manager (`world/block-manager.ts`)

The v4 BlockManager handled trees, food, water, etc. For v5:

- **TreeBlock removed entirely** — trees are now organisms
- **CorpseBlock added** — replaces TreeBlock as the resource-yielding block
- Other block types (food, water, salt water, eggs, loot, poop, farms, flags, obstacles) remain

```typescript
// world/types.ts
export interface ICorpseBlock {
  id: string;
  x: number;
  y: number;
  foodType: FoodType;                     // 'plant' or 'meat'
  totalResources: number;                  // Initial resource amount
  remainingResources: number;              // Decreases as harvested
  decayMs: number;                         // Time until full decay
  emoji: string;                           // Visual representation (🪵, 🍖, etc.)
  sourcePhenotype: PhenotypeClass;         // What kind of organism this came from
}

// block-manager.ts
export class BlockManager {
  spawnCorpse(organism: Organism): ICorpseBlock | null {
    if (organism.traits.harvestable.value < TUNE.functionalMin.harvestable) return null;

    const isPlantLike = PHENOTYPE_TRAITS[organism.phenotype].immobile;
    const foodType: FoodType = isPlantLike ? 'plant' : 'meat';
    const yieldPerSize = isPlantLike
      ? TUNE.corpse.plantYieldPerSize
      : TUNE.corpse.meatYieldPerSize;

    const total = organism.traits.size.value * yieldPerSize
                + organism.traits.harvestable.value * 0.5;

    const corpse: ICorpseBlock = {
      id: uuid(),
      x: organism.cellX,
      y: organism.cellY,
      foodType,
      totalResources: total,
      remainingResources: total,
      decayMs: TUNE.corpse.decayMs,
      emoji: isPlantLike ? '🪵' : '🍖',
      sourcePhenotype: organism.phenotype,
    };

    this.corpses.set(corpse.id, corpse);
    this.world.bus.emit('corpse:created', { corpseId: corpse.id, position: { x: corpse.x, y: corpse.y } });
    return corpse;
  }

  removeCorpse(id: string): void { /* ... */ }
  decayCorpses(tickMs: number): void { /* per-tick decay */ }
}
```

### 10.3 World Generator (`world/world-generator.ts`) — NEW

Replaces v4's inline world setup logic in `main.ts`.

```typescript
export class WorldGenerator {
  generate(opts: { gridSize: number; obstacleDensity: number; pocketCount: number }): GeneratedWorld {
    // 1. Generate base terrain (noise-based)
    const terrain = this.generateTerrain(opts.gridSize);

    // 2. Place water bodies
    const water = this.placeWater(terrain);

    // 3. Place obstacle barriers to create isolation pockets
    //    - Use a region-growing algorithm seeded with `pocketCount` centers
    //    - Place obstacles along region boundaries to create barriers
    //    - Ensure each region is internally connected
    const obstacles = this.createIsolationBarriers(terrain, opts.pocketCount);

    return { terrain, water, obstacles };
  }

  private createIsolationBarriers(terrain: TerrainGrid, pocketCount: number): IPosition[] {
    // Voronoi-style: pick N random seeds, assign each cell to nearest seed,
    // place obstacles along boundaries between regions
    const seeds = pickRandomSeeds(pocketCount, terrain.width, terrain.height);
    const regions = assignRegions(terrain, seeds);
    return findRegionBoundaries(regions);
  }
}
```

The exact algorithm is tunable; the principle is "carve the map into N connected regions with obstacle barriers between them."

### 10.4 World Class (`world/world.ts`)

Slim container, mostly unchanged. Add:

- `addOrganism()` / `removeOrganism()` (replaces add/removeAgent and add/removeTree)
- `organisms[]` and `organismsById{}` (replaces both agents and trees)
- All tree-specific methods removed

---

## 11. Domain: Faction

Mostly unchanged from v4. The only v5 difference: only organisms with `Sociality >= TUNE.functionalMin.sociality` can join factions. This check is enforced in `faction-manager.ts`:

```typescript
export class FactionManager {
  canJoinFaction(organism: Organism): boolean {
    return organism.traits.sociality.value >= TUNE.functionalMin.sociality;
  }
}
```

---

## 12. Domain: Simulation

### 12.1 Tick Orchestration (`simulation/simulation-engine.ts`)

The top-level tick loop:

```typescript
export class SimulationEngine {
  tick(): void {
    const tickMs = TICK_MS;
    this.currentTick++;

    // 1. World updates (passive: water, terrain, decay)
    this.worldUpdater.update(this.world, tickMs);

    // 2. Per-organism updates
    for (const organism of this.world.organisms) {
      if (organism.isDead) continue;
      this.organismUpdater.update(organism, this.world, tickMs);
    }

    // 3. Process births from completed pregnancies
    //    (handled inside organism-updater, this is just here for clarity)

    // 4. Process action completions
    this.actionProcessor.processCompletions(tickMs);

    // 5. Cleanup dead organisms
    this.world.removeDeadOrganisms();
  }
}
```

### 12.2 Organism Updater (`simulation/organism-updater.ts`)

Routes between full and simplified tick paths:

```typescript
export class OrganismUpdater {
  update(organism: Organism, world: World, tickMs: number): void {
    // Common: drain stats, update age, check death
    this.drainPassive(organism, tickMs);
    organism.ageTicks++;
    if (this.checkAgeDeath(organism, world)) return;
    if (organism.isDead) {
      this.handleDeath(organism, world);
      return;
    }

    // Pregnancy transfer (if applicable)
    if (organism.pregnancy?.active) {
      this.processPregnancyTransfer(organism, this.currentTick, this.bus);
    }

    // Branch on phenotype
    if (organism.usesSimplifiedTick) {
      this.simplifiedTick.process(organism, world, tickMs);
    } else {
      this.decisionEngine.tick(organism, world, tickMs);
    }
  }

  private drainPassive(organism: Organism, tickMs: number): void {
    const seconds = tickMs / 1000;

    // Fullness decay (from Metabolism)
    organism.drainFullness(organism.traits.metabolism.fullnessDecay * seconds);

    // Energy passive drain (from cost-functions)
    organism.drainEnergy(passiveEnergyDrainPerTick(organism.traits) * seconds);

    // Hygiene/social/inspiration decay only for animal-like
    if (organism.hasHygiene) {
      organism.needs.hygiene -= TUNE.decay.baseHygienePerTick * seconds;
    }
    if (organism.traits.sociality.value >= TUNE.functionalMin.sociality) {
      organism.needs.social -= TUNE.decay.baseSocialPerTick * seconds;
    }
  }

  private handleDeath(organism: Organism, world: World): void {
    // Spawn corpse if Harvestable
    world.blockManager.spawnCorpse(organism);
    // Drop loot
    if (organism.inventory.total() > 0) {
      world.blockManager.spawnLootBag(organism);
    }
    // Emit event
    this.bus.emit('organism:died', {
      organismId: organism.id,
      cause: organism.deathCause,
      position: { x: organism.cellX, y: organism.cellY },
    });
  }
}
```

### 12.3 World Updater (`simulation/world-updater.ts`)

Per-tick world updates:
- Corpse decay
- Food block respawn timers
- Water block lifecycle
- Cloud movement
- Farm growth
- Poop fertilization effect on adjacent plants (NEW)

---

## 13. Domain: Rendering

### 13.1 Layer Order

The rendering pipeline draws in this order each frame:

1. Terrain (cached offscreen, redraws only when dirty)
2. Salt water overlay
3. Grid (if enabled)
4. Water blocks
5. Food blocks (typed: plant 🌿, meat 🍖)
6. Corpse blocks (replaces tree blocks visually — 🪵 for plants, 🍖 for animals, etc.)
7. Eggs, seedlings, poop
8. Loot bags, farms, obstacles
9. Flags
10. **Organisms (unified pass)** — base emoji + indicators + tools + animations
11. Clouds
12. Selection / debug overlays

### 13.2 Organism Rendering (`rendering/organism-renderer.ts`) — NEW

Single function that draws an organism with all its visual layers.

```typescript
export class OrganismRenderer {
  render(ctx: CanvasRenderingContext2D, organism: Organism, camera: Camera): void {
    const { sx, sy } = camera.worldToScreen(organism.cellX, organism.cellY);
    const scale = camera.scale;

    // 1. Base emoji (selected by phenotype, lifecycle stage, action variant)
    const emoji = organism.currentEmoji;

    // 2. Apply animation transform (shake, bob, etc.)
    const transform = this.animationRunner.getTransform(organism);
    ctx.save();
    ctx.translate(sx + transform.dx, sy + transform.dy);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scale * sizeScale(organism), transform.scale * sizeScale(organism));

    // 3. Draw the emoji from cache
    this.emojiCache.draw(ctx, emoji, 0, 0);
    ctx.restore();

    // 4. Indicators (top-left, top-right, top-middle)
    this.indicatorRenderer.render(ctx, organism, sx, sy, scale);

    // 5. Tool (only if action has external_cell target and tool emoji)
    if (organism.action?.target && this.shouldRenderTool(organism.action)) {
      this.toolRenderer.render(ctx, organism, organism.action, camera);
    }

    // 6. Health/energy bars (if enabled in UI options)
    if (this.options.showHealthBars) {
      this.drawHealthBar(ctx, organism, sx, sy);
    }
  }

  private sizeScale(organism: Organism): number {
    // Larger Size trait → bigger render (within the cell)
    return 1 + Math.min(0.8, organism.traits.size.value * 0.01);
  }
}
```

### 13.3 Indicator Renderer (`rendering/indicator-renderer.ts`) — NEW

```typescript
export interface IndicatorSlotConfig {
  source: 'faction_flag' | 'pregnancy' | 'health_band' | 'mood' | 'level' | 'phenotype' | 'none';
}

export class IndicatorRenderer {
  constructor(private slotConfig: { topLeft: IndicatorSlotConfig; topRight: IndicatorSlotConfig; topMiddle: IndicatorSlotConfig }) {}

  render(ctx: CanvasRenderingContext2D, organism: Organism, sx: number, sy: number, scale: number): void {
    const indicatorSize = CELL_PX * scale * 0.5;
    const px = (sx: number, sy: number) => ({ sx, sy });

    const positions = {
      topLeft:   { sx: sx - CELL_PX * scale * 0.3, sy: sy - CELL_PX * scale * 0.4 },
      topRight:  { sx: sx + CELL_PX * scale * 0.3, sy: sy - CELL_PX * scale * 0.4 },
      topMiddle: { sx: sx,                          sy: sy - CELL_PX * scale * 0.5 },
    };

    this.renderSlot(ctx, organism, this.slotConfig.topLeft, positions.topLeft, indicatorSize);
    this.renderSlot(ctx, organism, this.slotConfig.topRight, positions.topRight, indicatorSize);
    this.renderSlot(ctx, organism, this.slotConfig.topMiddle, positions.topMiddle, indicatorSize);
  }

  private renderSlot(ctx: CanvasRenderingContext2D, organism: Organism, config: IndicatorSlotConfig, pos: { sx: number; sy: number }, size: number): void {
    const emoji = this.resolveIndicatorEmoji(organism, config.source);
    if (!emoji) return;
    this.emojiCache.drawAt(ctx, emoji, pos.sx, pos.sy, size);
  }

  private resolveIndicatorEmoji(organism: Organism, source: string): string | null {
    switch (source) {
      case 'faction_flag':
        return organism.factionId ? this.world.factions[organism.factionId].flag : null;
      case 'pregnancy':
        return organism.pregnancy?.active ? '🥚' : null;
      case 'health_band': {
        const ratio = organism.health / organism.maxHealth;
        if (ratio > 0.7) return '💚';
        if (ratio > 0.3) return '💛';
        return '❤️';
      }
      case 'mood':
        return organism.lifecycleStage === LifecycleStage.Juvenile ? null : organism.currentMoodEmoji;
      case 'level':
        return null; // Level uses text rendering, not emoji
      case 'phenotype':
        return PHENOTYPE_ICONS[organism.phenotype];
      case 'none':
        return null;
    }
  }
}
```

### 13.4 Tool Renderer (`rendering/tool-renderer.ts`) — NEW

Preserves v4's directional tool rendering. Tool emoji is drawn between organism and target, oriented toward target.

```typescript
export class ToolRenderer {
  render(ctx: CanvasRenderingContext2D, organism: Organism, action: IActionState, camera: Camera): void {
    const def = ACTION_REGISTRY.get(action.type);
    if (!def?.tool || def.targetType !== 'external_cell') return;
    if (!action.target) return;

    const targetPos = this.resolveTargetPosition(action.target);
    if (!targetPos) return;

    const { sx: ox, sy: oy } = camera.worldToScreen(organism.cellX, organism.cellY);
    const { sx: tx, sy: ty } = camera.worldToScreen(targetPos.x, targetPos.y);

    // Midpoint between organism and target
    const mx = (ox + tx) / 2;
    const my = (oy + ty) / 2;

    // Angle from origin to target
    const angle = Math.atan2(ty - oy, tx - ox);

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    this.emojiCache.drawAt(ctx, def.tool, 0, 0, CELL_PX * camera.scale * 0.6);
    ctx.restore();
  }
}
```

### 13.5 Animation Runner (`rendering/animation-runner.ts`) — NEW

Tracks per-organism animation state. Each animation is a short transformation (translation, rotation, scale) applied during rendering.

```typescript
export interface AnimationState {
  type: AnimationType;
  startTime: number;
  durationMs: number;
}

export interface AnimationTransform {
  dx: number;
  dy: number;
  rotation: number;
  scale: number;
}

export class AnimationRunner {
  private states = new Map<string, AnimationState>();   // organismId → state

  trigger(organismId: string, type: AnimationType, durationMs: number = 500): void {
    this.states.set(organismId, { type, startTime: performance.now(), durationMs });
  }

  getTransform(organism: Organism): AnimationTransform {
    // Combine action-based animation with state-based animation
    const stateAnim = this.states.get(organism.id);
    const actionAnim = organism.action ? ACTION_ANIMATIONS[organism.action.type] : 'none';

    const animType = stateAnim?.type ?? actionAnim;
    return this.computeTransform(animType, stateAnim?.startTime ?? performance.now(), stateAnim?.durationMs ?? 500);
  }

  private computeTransform(type: AnimationType, startTime: number, duration: number): AnimationTransform {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);

    switch (type) {
      case 'shake':
        return { dx: Math.sin(elapsed / 30) * 3 * (1 - t), dy: 0, rotation: 0, scale: 1 };
      case 'bob':
        return { dx: 0, dy: Math.sin(elapsed / 200) * 2, rotation: 0, scale: 1 };
      case 'pulse':
        return { dx: 0, dy: 0, rotation: 0, scale: 1 + Math.sin(elapsed / 200) * 0.1 };
      case 'bounce':
        return { dx: 0, dy: -Math.abs(Math.sin(elapsed / 150)) * 6 * (1 - t), rotation: 0, scale: 1 };
      case 'shrink':
        return { dx: 0, dy: 0, rotation: 0, scale: 1 - t };
      case 'wiggle':
        return { dx: 0, dy: 0, rotation: Math.sin(elapsed / 80) * 0.1, scale: 1 };
      case 'flash':
        return { dx: 0, dy: 0, rotation: 0, scale: 1 + Math.sin(elapsed / 100) * 0.2 };
      case 'sway':
        return { dx: Math.sin(elapsed / 1000) * 1, dy: 0, rotation: Math.sin(elapsed / 1000) * 0.05, scale: 1 };
      case 'none':
      default:
        return { dx: 0, dy: 0, rotation: 0, scale: 1 };
    }
  }
}
```

The animation runner is updated:
- Action-based animations are derived from `ACTION_ANIMATIONS[organism.action.type]` automatically each frame
- Event-based animations (damage, death, level up) are triggered explicitly via `trigger()`

---

## 14. Domain: UI

### 14.1 Indicator Configuration

A new UI panel allows users to switch what each indicator slot displays.

```typescript
// ui/indicator-config.ts
export class IndicatorConfigPanel {
  constructor(private indicatorRenderer: IndicatorRenderer) {}

  render(): HTMLElement {
    // Three dropdowns: Top-Left, Top-Right, Top-Middle
    // Each dropdown lists: faction_flag, pregnancy, health_band, mood, level, phenotype, none
    // On change: updates indicatorRenderer.slotConfig
  }
}
```

### 14.2 Inspector

The organism inspector (single-organism details panel) shows:
- Phenotype class and lifecycle stage
- All trait values (organized by category)
- Current action with progress bar
- Needs (with bands)
- Inventory contents (typed)
- Relationships (if Sociality > min)
- Pregnancy state with child needs progress (if pregnant)
- Lineage (parents, generation)

This replaces v4's Agent inspector with the broader Organism view. Plant organisms show only the relevant subset (no relationships, no needs except fullness/energy, etc.).

---

## 15. Domain: Persistence

### 15.1 v5 Schema

```typescript
export interface SavedState {
  version: 'v5.0';
  tick: number;
  worldGen: { gridSize: number; seed: number };
  organisms: SavedOrganism[];
  factions: SavedFaction[];
  blocks: SavedBlocks;
}

export interface SavedOrganism {
  id: string;
  dna: string;
  cellX: number;
  cellY: number;
  health: number;
  energy: number;
  age: number;
  level: number;
  xp: number;
  needs: { fullness: number; hygiene: number; social: number; inspiration: number };
  inventory: IInventory;
  factionId: string | null;
  pregnancy: SavedPregnancy | null;
  generation: number;
  parentIds: string[];
  // Phenotype is not saved — it's derived from DNA via classification on load
}
```

The phenotype is **not** persisted because it's a deterministic function of DNA. On load, organisms are reconstructed: parse DNA → express genome → classify phenotype → instantiate Organism.

### 15.2 Version Marker

The save format includes `version: 'v5.0'`. The loader rejects any file without this exact marker (no v4 compatibility).

```typescript
export function load(json: string): World {
  const state = JSON.parse(json);
  if (state.version !== 'v5.0') {
    throw new Error(`Save file version ${state.version} is not compatible with this build (v5.0)`);
  }
  // ... reconstruct
}
```

---

## 16. Event Bus Schema

Complete catalog of v5 events. The bus is single-threaded and synchronous.

| Event | Emitted By | Payload | Subscribers |
|-------|-----------|---------|-------------|
| `organism:born` | reproduce-effects, simplified-tick | `{ childId, parentIds }` | family-registry, faction-manager (inherit), ui (log) |
| `organism:died` | organism-updater | `{ organismId, cause, position, phenotype }` | block-manager (drop loot, spawn corpse), faction-manager (remove member), ui (log) |
| `organism:stillborn` | organism-factory | `{ parentId }` | ui (log) |
| `organism:phenotype_assigned` | organism-factory | `{ organismId, phenotype }` | ui (inspector init) |
| `corpse:created` | block-manager | `{ corpseId, position, foodType, sourcePhenotype }` | resource-memory updates, ui (log) |
| `corpse:decayed` | block-manager | `{ corpseId, position }` | ui (log) |
| `pregnancy:started` | reproduce-effects | `{ organismId }` | ui (visual indicator) |
| `pregnancy:transfer_tick` | organism-updater | `{ organismId, childNeedsProgress }` | ui (only if inspector open on this organism) |
| `pregnancy:birth` | organism-updater | `{ parentId, childId }` | ui (visual clear) |
| `action:started` | action-factory | `{ organismId, actionType, target? }` | rendering (animation trigger), ui (log) |
| `action:completed` | action-processor | `{ organismId, actionType, target? }` | relevant effect handler, ui (log) |
| `combat:attack` | combat-effects | `{ attackerId, targetId, damage }` | rendering (shake animation on target), ui |
| `combat:kill` | combat-effects | `{ attackerId, targetId }` | organism-updater (xp), ui (log) |
| `combat:hunt_kill` | combat-effects | `{ hunterId, preyId }` | organism-updater (xp), ui (log) |
| `faction:formed` | faction-manager | `{ factionId, members }` | ui (log, panel) |
| `faction:member-changed` | faction-manager | `{ factionId, organismId, joined }` | ui (log) |
| `block:added` | block-manager | `{ blockType, position }` | food-field/water-field (recompute) |
| `block:removed` | block-manager | `{ blockType, position }` | food-field/water-field (recompute), memory updates |

To minimize per-tick overhead, `pregnancy:transfer_tick` is only emitted if a UI subscriber has registered interest in the specific organism (UI sets a flag on the organism when its inspector is opened).

---

## 17. Tick Orchestration & Performance

### 17.1 Tick Path Comparison

| Path | Used For | Per-Tick Work |
|------|----------|---------------|
| **Full** | Person, Predator, Critter, Fish, Amphibian, ColonyInsect, PhotoCritter, Blob | Drain stats, age, decision context build, action scoring, action state advance, target resolution, pathfinding (occasionally), animation update |
| **Simplified** | Plant, Fungus, SessilePredator | Drain stats, age, photosynthesis tick, regeneration tick, reproduction roll, reactive attack check, lifecycle stage update |

The simplified tick is **expected to be 5–10× cheaper** than the full tick. With ~50% of the population on the simplified path (per the world seeding template), total per-tick cost should be lower than v4 despite trees becoming entities.

### 17.2 Performance Targets

- **Baseline:** v4 with 300 organisms on 120×120 grid = ~25ms max, ~13.5ms avg
- **v5 target:** Same population (300 mobile + ~300 plant organisms = 600 total) at similar timing
- **Stretch goal:** 1000 organisms total at <30ms avg

### 17.3 Optimization Levers

If performance is insufficient:

1. **Plant tick batching** — process plants in batches of N per tick instead of all per tick (plants don't need every-tick updates)
2. **Phenotype-class fast paths** — avoid component lookups for phenotypes that don't have certain components (e.g., skip relationship updates for phenotypes with `Sociality < min`)
3. **Spatial indexing** — already in v4 (grid lookups), but perception checks for high-Perception organisms could become hot
4. **Cost function memoization** — derived values like passive drain rate can be precomputed at organism creation and stored as fields, since they're functions of immutable traits

---

## 18. Tuning Constants Philosophy

All numeric tuning lives in `core/tuning.ts` as the `TUNE` object. This includes:

- Functional minimums (Section 3.5.1 of PRD)
- Cost scaling coefficients
- Phenotype classification thresholds
- Pregnancy parameters
- Mutation rates
- Decay rates
- Photosynthesis rates
- Corpse decay
- World generation parameters

**Rule:** No magic numbers in domain code. Anything that might change during tuning belongs in `TUNE`.

**Exception:** Truly universal values (TICK_MS, GRID_SIZE, CELL_PX, LEVEL_CAP) live in `core/constants.ts` and are not considered "tunable."

---

## 19. Testing Strategy

v5 inherits v4's lack of test framework, but the architecture should support testing if/when one is added:

- **Pure functions** (gene expression, viability, phenotype classification, cost functions, lifecycle stage derivation) are trivially unit-testable
- **Components** (NeedSet, Inventory, RelationshipMap, PregnancyState) are testable in isolation
- **Domains** that emit events can be tested with a stub EventBus
- **Simplified tick** is testable with a stub World and OrganismFactory

If a test framework is added during v5 implementation, the priority targets are:
1. `genetics/expression.ts` — DNA → TraitSet correctness
2. `phenotype/phenotype-classifier.ts` — Rule table coverage
3. `genetics/viability.ts` — Stillbirth correctness
4. `genetics/cost-functions.ts` — Cost scaling math
5. `entity/components/pregnancy.ts` — Need transfer mechanic

---

## 20. Migration & Cleanup Plan

### 20.1 Branch Strategy

v5 is a clean break and a major version. The recommended approach:

1. Create `feat/v5-overhaul` branch off `main`
2. All v5 work happens on this branch and feature branches off it
3. v4 remains the production branch until v5 is feature-complete
4. v5 ships as a single major version bump with no transitional period

### 20.2 Implementation Phases

The v5 implementation should be broken into ordered phases. Each phase produces a working build:

**Phase 1: Foundation**
- New `core/tuning.ts`
- New `core/types.ts` (FoodType, IInventory)
- New `genetics/types.ts` v5 trait schema
- New `genetics/gene-registry.ts` v5 trait catalog
- Update `genetics/expression.ts` to remove hard caps
- Add `genetics/cost-functions.ts`
- Update `genetics/viability.ts` for v5 viability
- Update `genetics/mutation.ts` to take rate parameter

Build target: genetics module compiles and produces v5 TraitSets from DNA.

**Phase 2: Phenotype Domain**
- Create `phenotype/` directory
- Implement `phenotype-registry.ts`, `phenotype-classifier.ts`
- Implement `moveset-registry.ts`, `animation-registry.ts`, `lifecycle.ts`

Build target: any TraitSet can be classified into a PhenotypeClass.

**Phase 3: Entity Refactor**
- Rename `agent.ts` → `organism.ts`, restructure to v5 Organism class
- Update `agent-factory.ts` → `organism-factory.ts`
- Add `entity/components/memory.ts`
- Update `entity/components/pregnancy.ts` for transfer mechanic
- Update `entity/components/inventory.ts` for typed food
- Delete `entity/entity-class.ts`
- Update all consumers (decision, action, rendering, ui)

Build target: world can host Organisms (still all mobile/animal-like for now).

**Phase 4: World & Block Manager**
- Remove TreeBlock entirely
- Add CorpseBlock to `world/types.ts`
- Update `block-manager.ts`: remove tree handling, add corpse handling
- Add `world-generator.ts` with isolation pockets
- Update `world.ts` to manage organisms instead of agents+trees

Build target: world generates with isolation pockets, no trees.

**Phase 5: Action System**
- Update `action-registry.ts` for v5 actions
- Add `targetType` and `tool` fields to ActionDef
- Add `hunt`, `photosynthesize`, `drink_saltwater` actions
- Update `action-factory.ts` to compute costs from cost-functions
- Update all effects modules for v5 mechanics
- Add `photosynthesis-effects.ts`

Build target: mobile organisms can perform v5 actions.

**Phase 6: Decision Engine & Simplified Tick**
- Update `decision-engine.ts` for v5 trait references
- Implement `simplified-tick.ts`
- Update `organism-updater.ts` to route between paths

Build target: plant organisms run on the simplified tick.

**Phase 7: Rendering**
- Implement `organism-renderer.ts`, `indicator-renderer.ts`, `tool-renderer.ts`, `animation-runner.ts`
- Remove tree rendering code from `renderer.ts`
- Wire up new layers in render pipeline

Build target: organisms render with movesets, indicators, tools, animations.

**Phase 8: UI**
- Update inspector for Organism + Phenotype display
- Implement `indicator-config.ts` panel
- Update controls panel for v5

Build target: full UI for v5 mechanics.

**Phase 9: Persistence & Polish**
- Implement v5 persistence schema
- Version marker enforcement
- World seeding with templates
- Tuning pass: adjust TUNE values based on observed behavior

Build target: shippable v5.0.0.

**Phase 10: Documentation**
- Rewrite all docs in `docs/` for v5
- Create new docs listed in PRD Section 9
- Update `tech_specs.md`
- Update `CLAUDE.md` for v5 architecture

Build target: docs match shipped code.

### 20.3 Sequencing Notes

- Phase 1 must complete before Phase 2 (phenotype depends on TraitSet)
- Phase 2 must complete before Phase 3 (Organism depends on phenotype classification)
- Phases 4–6 can overlap once Phase 3 is done
- Phase 7 (rendering) requires Phase 3 (Organism) but can be developed in parallel with Phase 5–6
- Phase 9 (persistence) should wait until the data shape is stable
- Phase 10 (docs) should run in parallel with implementation, not be deferred to the end

---

## 21. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Plant population explodes / collapses** because Photosynthesis tuning is wrong | Ecosystem broken | Tunable TUNE values; add a debug overlay showing population per phenotype to spot drift early |
| **Carnivores starve** because corpses decay too fast | Population collapse | Tune `TUNE.corpse.decayMs` aggressively; consider scavenging buffs |
| **Stillbirth rate too high** because Volatility default produces broken genomes | No reproduction → extinction | Start with low default Volatility; only high-Volatility lineages take stillbirth risk |
| **Phenotype rule misclassification** — organisms get wrong visual identity | Visual confusion | Comprehensive rule table tests; inspector shows actual phenotype for verification |
| **Performance regression** — simplified tick isn't fast enough | <30 fps | Plant tick batching; profile early in Phase 6 |
| **Decision engine breaks** — v5 action availability is more complex | Mobile organisms idle or thrash | Phase 6 includes integration testing; keep v4 logic as reference |
| **Save format churn** — TUNE values affect organism construction | Old saves incompatible with new tuning | Save TUNE snapshot in save file; on load, use saved TUNE for reconstruction (defer actual decision to TRD revision if needed) |
| **Tool rendering breaks** because targetType is set wrong on actions | No tools visible OR wrong tools | Default `targetType` values in registry; comprehensive registry review during Phase 5 |
| **Indicator slot config UI is unfamiliar** | Player confusion | Default config matches v4 expectations (faction flag + pregnancy egg) |
| **Plant reproduction fails** because dispersal cells are always blocked | Plants don't multiply | Reproduction tries multiple cells, falls back to wider radius |

---

## 22. Open Technical Questions

These are TRD-level questions requiring decisions during implementation. They are NOT design questions (the PRD has resolved those) but technical choices.

### 22.1 Phenotype Rule Table — Tuning Values

The phenotype rule table references thresholds like `TUNE.phenotype.aquaticHigh`. The exact values are tuning, but they need initial values. Suggested starting points are in `tuning.ts` Section 4.2 above; early playtest will refine them.

### 22.2 Cost Scaling Curves

`cost-functions.ts` uses simple linear scaling for most costs. Some traits may need quadratic or capped curves to feel right (e.g., movement cost might need to scale super-linearly so very fast organisms become impractical). Defer to Phase 5–6 playtest.

### 22.3 Plant Tick Frequency

The simplified tick currently runs every tick. For 300+ plant organisms, this may still be too much. Consider:
- Run simplified tick every Nth tick per plant (round-robin batches)
- Run simplified tick on a slower scheduler (every 4th simulation tick)

The choice affects the responsiveness of plant behavior (reproduction rate, regeneration smoothness) vs total CPU. Decide during Phase 6.

### 22.4 Memoized Cost Values

Should `passiveEnergyDrainPerTick`, `attackEnergyCost`, etc. be precomputed and cached on the Organism at construction (since traits are immutable)? This is faster but adds fields. Suggested: yes, add precomputed `cachedDrains` and `cachedActionCosts` on Organism. Implement during Phase 3.

### 22.5 World Generator Algorithm

The exact algorithm for isolation pockets (Voronoi vs noise-based vs maze carving) needs implementation choice. Voronoi is simplest and produces clear regions. Decide during Phase 4.

### 22.6 Animation State Storage

`AnimationRunner` stores per-organism animation state in a Map. For 1000 organisms, this is 1000 Map entries. Alternative: store the animation state field directly on the Organism. The Map approach decouples rendering from entity, but field-on-entity is faster. Decide during Phase 7.

### 22.7 Corpse Block ID Strategy

Corpse IDs need to be unique. Use the same `uuid()` from `core/utils.ts` that v4 uses. No issue, just confirm during Phase 4.

### 22.8 Pregnancy Need Transfer Rate Formula

The transfer rate is currently a flat `TUNE.pregnancy.needTransferRate`. Should it instead scale inversely with `Pregnancy.gestationMs`? Longer gestation = slower transfer per tick = less per-tick burden but longer total burden. Suggested: yes, formula is `transferRate = TUNE.pregnancy.completionThreshold / Pregnancy.gestationMs * tickMs`. Implement during Phase 5.

### 22.9 Hygiene-less Organisms and Disease Events

If a disease event fires for a no-hygiene organism (e.g., a plant gets close to a poop block), it should be silently ignored. Add a guard in `disease-effects.ts`.

### 22.10 Photo-Critter Fragility

The PRD says Photosynthesis applies an HP penalty. For Photo-Critters (mobile photosynthesizers), this penalty applies just like for plants. Confirmed: no exception, the cost function is global.

---

## 23. Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-04-09 | Claude | Initial draft based on v5-prd.md revision 2 |
