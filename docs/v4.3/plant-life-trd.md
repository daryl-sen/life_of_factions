# Plant Life TRD

**PRD:** `docs/v4.3/plant-life-prd.md`
**Issue:** #55 — feat: Plant life
**Version target:** 4.3.0
**Status:** Draft

---

## 1. Scope

This TRD covers the technical implementation of all changes described in the Plant Life PRD:
- Tree variant system (tropical, evergreen, regular)
- New plant block types (medicine, flower, cactus)
- Farm crop standardization (🌾)
- Obstacle categories
- Emoji conflict resolution

---

## 2. Interface Changes

### 2.1 `world/types.ts` — Modified Interfaces

**`ITreeBlock`** — add `variant` field:

```typescript
// Current (lines 67-76)
export interface ITreeBlock {
  id: string;
  x: number;
  y: number;
  emoji: string;
  units: number;
  maxUnits: number;
  ageTotalMs: number;
  maxAgeMs: number;
}

// New
export interface ITreeBlock {
  id: string;
  x: number;
  y: number;
  emoji: string;
  variant: TreeVariant;
  units: number;
  maxUnits: number;
  ageTotalMs: number;
  maxAgeMs: number;
}
```

The `emoji` field becomes derived from `variant` instead of random. It is still stored for rendering, but always set to the variant's emoji at creation time.

**`ISeedling`** — add `variant` field:

```typescript
// Current (lines 78-85)
export interface ISeedling {
  id: string;
  x: number;
  y: number;
  plantedAtTick: number;
  growthDurationMs: number;
  growthElapsedMs: number;
}

// New
export interface ISeedling {
  id: string;
  x: number;
  y: number;
  variant: TreeVariant;
  plantedAtTick: number;
  growthDurationMs: number;
  growthElapsedMs: number;
}
```

**`IObstacle`** — add `category` field:

```typescript
// Current (lines 23-31)
export interface IObstacle {
  id: string;
  x: number;
  y: number;
  emoji: string;
  hp: number;
  maxHp: number;
  size?: '2x2';
}

// New
export interface IObstacle {
  id: string;
  x: number;
  y: number;
  emoji: string;
  category: ObstacleCategory;
  hp: number;
  maxHp: number;
  size?: '2x2';
}
```

### 2.2 `world/types.ts` — New Types

```typescript
export type TreeVariant = 'tropical' | 'evergreen' | 'regular';

export type ObstacleCategory = 'mountain' | 'rock' | 'wood';

export interface IMedicineBlock {
  id: string;
  x: number;
  y: number;
}

export interface IFlowerBlock {
  id: string;
  x: number;
  y: number;
  emoji: string;
  lifespanMs: number;
}

export interface ICactusBlock {
  id: string;
  x: number;
  y: number;
  units: number;
  maxUnits: number;
}
```

Design notes:
- `IMedicineBlock` has no units — harvesting removes the entire block.
- `IFlowerBlock` has a `lifespanMs` countdown for auto-removal.
- `ICactusBlock` follows the same `units`/`maxUnits` pattern as `IWaterBlock` and `ITreeBlock`, since it's a depletable resource.
- Flowers and medicine are passable, so they are not added to blocking checks. Cactus blocks movement, so it is added to `isBlocked`/`isBlockedTerrain`/`isCellOccupied`.

### 2.3 `decision/types.ts` — Extend Resource Types

```typescript
// Current (line 14-18)
export interface NearbyResource {
  readonly type: 'food' | 'water' | 'wood' | 'seedling';
  readonly pos: IPosition;
  readonly dist: number;
}

// New — add 'medicine' and 'cactus'
export interface NearbyResource {
  readonly type: 'food' | 'water' | 'wood' | 'seedling' | 'medicine' | 'cactus';
  readonly pos: IPosition;
  readonly dist: number;
}
```

---

## 3. Grid & Blocking Changes

**File:** `world/grid.ts`

### 3.1 New Collections

Add to the `Grid` class (after line 19):

```typescript
readonly medicineBlocks: Map<string, IMedicineBlock> = new Map();
readonly flowerBlocks: Map<string, IFlowerBlock> = new Map();
readonly cactusBlocks: Map<string, ICactusBlock> = new Map();
```

### 3.2 Blocking Updates

**`isBlocked()`** (line 21) — add cactus check:

```typescript
if (this.cactusBlocks.has(k)) return true;
```

Add after the `treeBlocks` check (line 28). Cactus blocks movement like trees.

**`isBlockedTerrain()`** (line 35) — add cactus check:

```typescript
if (this.cactusBlocks.has(k)) return true;
```

Add after the `treeBlocks` check (line 43).

**`isCellOccupied()`** (line 48) — add all three new block types:

```typescript
this.medicineBlocks.has(k) ||
this.flowerBlocks.has(k) ||
this.cactusBlocks.has(k)
```

Medicine and flowers are passable but still occupy the cell for spawn-stacking prevention.

**`clear()`** (line 76) — add:

```typescript
this.medicineBlocks.clear();
this.flowerBlocks.clear();
this.cactusBlocks.clear();
```

### 3.3 Medicine/Flower Passability

Medicine and flower blocks must NOT appear in `isBlocked()` or `isBlockedTerrain()`. They only appear in `isCellOccupied()` to prevent stacking. This means agents can walk through them, and pathfinding treats them as open cells.

---

## 4. World State Changes

**File:** `world/world.ts`

### 4.1 New Accessors

Add convenience accessors (after line 89):

```typescript
get medicineBlocks() { return this.grid.medicineBlocks; }
get flowerBlocks() { return this.grid.flowerBlocks; }
get cactusBlocks() { return this.grid.cactusBlocks; }
```

---

## 5. Constants Changes

**File:** `core/constants.ts`

### 5.1 Tree Emojis

Remove 🎄. The array is still used only by `randomTreeEmoji()` in spawner.ts for water-spawned seedlings (random variant). For parent-spawned seedlings and mature trees, the emoji is derived from the variant.

```typescript
// Current (lines 107-112)
export const TREE_EMOJIS = [
  '\u{1F332}', // 🌲
  '\u{1F333}', // 🌳
  '\u{1F334}', // 🌴
  '\u{1F384}', // 🎄
];

// New
export const TREE_VARIANT_EMOJI: Record<TreeVariant, string> = {
  tropical:  '\u{1F334}', // 🌴
  evergreen: '\u{1F332}', // 🌲
  regular:   '\u{1F333}', // 🌳
};
```

Replace the array with a variant→emoji map. The `randomTreeEmoji()` helper in spawner.ts is replaced by variant-based lookup.

### 5.2 Food Emojis

```typescript
// Current (lines 80-85)
export const FOOD_EMOJIS = {
  hq: ['\u{1F954}', '\u{1F34E}', '\u{1F351}', '\u{1F33D}', '\u{1F345}'],
  //    🥔           🍎           🍑           🌽           🍅
  lq: ['\u{1F33F}', '\u{1F96C}', '\u{1F966}', '\u{1F340}'],
  //    🌿           🥬           🥦           🍀
};

// New
export const FOOD_EMOJIS = {
  hq: ['\u{1F954}', '\u{1F33D}', '\u{1F345}'],
  //    🥔           🌽           🍅
  lq: ['\u{1F96C}', '\u{1F966}', '\u{1F340}'],
  //    🥬           🥦           🍀
};
```

Changes:
- Remove 🌿 from `lq` (reassigned to medicine plant).
- Remove 🍎 and 🍑 from `hq` (now exclusive to regular tree fruit).
- 3 remaining HQ emojis are ground crops (potato, corn, tomato) — these are still used for initial food seeding and non-farm food spawns.

### 5.3 New Plant Emojis

```typescript
export const TREE_FRUIT_EMOJIS = [
  '\u{1F34E}', // 🍎 apple
  '\u{1F350}', // 🍐 pear
  '\u{1F34A}', // 🍊 orange
  '\u{1F34B}', // 🍋 lemon
  '\u{1F351}', // 🍑 peach
  '\u{1F352}', // 🍒 cherry
  '\u{1F34F}', // 🍏 green apple
] as const;

export const FLOWER_EMOJIS = [
  '\u{1F339}', // 🌹
  '\u{1F33A}', // 🌺
  '\u{1F337}', // 🌷
  '\u{1F33B}', // 🌻
  '\u{1FAB7}', // 🪻
] as const;

export const FARM_CROP_EMOJI = '\u{1F33E}'; // 🌾

export const MEDICINE_EMOJI = '\u{1F33F}'; // 🌿

export const CACTUS_EMOJI = '\u{1F335}'; // 🌵

export const COCONUT_EMOJI = '\u{1F965}'; // 🥥
```

### 5.4 Obstacle Category Mapping

```typescript
export const OBSTACLE_CATEGORY: Record<string, ObstacleCategory> = {
  '\u26F0\uFE0F':     'mountain', // ⛰️
  '\u{1F5FB}':        'mountain', // 🗻
  '\u{1F3D4}\uFE0F':  'mountain', // 🏔️
  '\u{1FAA8}':        'rock',     // 🪨
  '\u{1FAB5}':        'wood',     // 🪵
};
```

---

## 6. Spawner Changes

**File:** `simulation/spawner.ts`

This file receives the most changes. The current `Spawner` class has these tree/seedling methods:
- `addTree()` (line 198) — spawns a random tree
- `seedInitialTrees()` (line 217) — seeds N trees on init
- `trySpawnSeedling()` (line 225) — spawns seedling near a parent tree
- `trySpawnFoodNearTree()` (line 253) — spawns food near tree
- `tickSeedlings()` (line 265) — grows seedlings, converts to trees
- `tickSeedlingNearWater()` (line 294) — spontaneous seedling near water
- `tickTreePassiveSpawns()` (line 329) — parent-tree passive reproduction
- `maybeSpawnCrops()` (line 86) — farm crop spawning

### 6.1 New Constants

Add to the constants block (after line 38):

```typescript
// ── Tree variant tuning ──
const TROPICAL_DENSITY_CAP = 2;           // max 🌴 in 3x3 area
const REGULAR_DENSITY_CAP = 3;            // max 🌳 in 3x3 area
// Evergreen has no density cap

const TREE_WATER_SUSTAIN_RANGE = 5;       // manhattan distance for water sustain check
const TREE_DECLINE_RATE_PER_TICK = 0.01;  // units lost per tick when dehydrated
const EVERGREEN_MOUNTAIN_RANGE = 3;       // manhattan distance for mountain sustain

// ── New plant tuning ──
const MEDICINE_SPAWN_CHANCE = 0.0003;     // per mountain obstacle per tick
const MEDICINE_SPAWN_RADIUS = 3;          // manhattan distance from mountain

const FLOWER_SPAWN_CHANCE = 0.0002;       // per water block per tick
const FLOWER_SPAWN_RADIUS = 3;            // manhattan distance from water
const FLOWER_LIFESPAN_RANGE: [number, number] = [100000, 140000]; // ~100-140s (~2 min)

const CACTUS_SPAWN_CHANCE = 0.0001;       // per tick, global roll
const CACTUS_MIN_WATER_DISTANCE = 15;     // minimum manhattan dist from any water
const CACTUS_UNITS = 1;                   // ~1/10 of small water (5 units)
const CACTUS_MAX_UNITS = 1;

const COCONUT_CAP_PER_TREE = 3;           // max coconuts within 2 cells of parent 🌴
const COCONUT_RADIUS = 2;                 // proximity radius for cap check
```

All values are tunable constants, not magic numbers.

### 6.2 `addTree()` — Variant-Aware

**Current behavior (line 198):** Spawns tree with `randomTreeEmoji()`.

**New behavior:** Accept an optional `variant` parameter. If not provided, pick a random variant (for initial seeding).

```typescript
static addTree(world: World, variant?: TreeVariant): boolean {
  const v = variant ?? randomVariant();
  // ... existing placement logic ...
  world.treeBlocks.set(key(x, y), {
    id: uuid(), x, y,
    emoji: TREE_VARIANT_EMOJI[v],
    variant: v,
    units, maxUnits: units,
    ageTotalMs: 0,
    maxAgeMs: rndi(TREE_MAX_AGE_RANGE[0], TREE_MAX_AGE_RANGE[1]),
  });
}
```

Add helper:
```typescript
function randomVariant(): TreeVariant {
  const variants: TreeVariant[] = ['tropical', 'evergreen', 'regular'];
  return variants[Math.floor(Math.random() * variants.length)];
}
```

`seedInitialTrees()` (line 217) calls `addTree()` without a variant, so initial trees are randomly assigned.

### 6.3 `trySpawnSeedling()` — Variant Inheritance

**Current behavior (line 225):** Spawns seedling if water is nearby. No variant tracking.

**New behavior:** Accept the parent tree's variant and store it on the seedling.

```typescript
static trySpawnSeedling(world: World, originX: number, originY: number, variant: TreeVariant): boolean {
  // ... existing water proximity check ...
  // ... existing placement loop ...
  world.seedlings.set(key(x, y), {
    id: uuid(), x, y,
    variant,
    plantedAtTick: world.tick,
    growthDurationMs: rndi(TREE_SEEDLING_GROWTH_RANGE[0], TREE_SEEDLING_GROWTH_RANGE[1]),
    growthElapsedMs: 0,
  });
}
```

The water proximity check in this function (lines 226-233) currently only checks fresh water (`world.waterBlocks`). For tropical seedlings, also check `world.saltWaterBlocks`:

```typescript
let hasWater = false;
for (const wb of world.waterBlocks.values()) {
  if (manhattan(originX, originY, wb.x, wb.y) <= TREE_WATER_REQUIRED_FOR_SEEDLING) {
    hasWater = true;
    break;
  }
}
if (!hasWater && variant === 'tropical') {
  for (const sw of world.saltWaterBlocks.values()) {
    if (manhattan(originX, originY, sw.x, sw.y) <= TREE_WATER_REQUIRED_FOR_SEEDLING) {
      hasWater = true;
      break;
    }
  }
}
if (!hasWater) return false;
```

### 6.4 `tickSeedlings()` — Density Check at Maturation

**Current behavior (line 265):** Converts seedling to tree with `randomTreeEmoji()` when growth completes.

**New behavior:** At maturation, check variant-specific density cap. If density exceeds the cap, the seedling dies silently (no death marker). Otherwise, convert to tree with the seedling's variant.

```typescript
static tickSeedlings(world: World): void {
  for (const [k, s] of world.seedlings) {
    // ... existing growth acceleration logic (water proximity check) ...

    if (s.growthElapsedMs >= s.growthDurationMs) {
      // Density check for tropical and regular variants
      if (s.variant === 'tropical' || s.variant === 'regular') {
        const cap = s.variant === 'tropical' ? TROPICAL_DENSITY_CAP : REGULAR_DENSITY_CAP;
        const count = countVariantInArea(world, s.x, s.y, s.variant, 1); // 3x3 = radius 1
        if (count >= cap) {
          world.seedlings.delete(k); // silently die, no death marker
          continue;
        }
      }
      // Convert to tree
      world.seedlings.delete(k);
      world.treeBlocks.set(k, {
        id: uuid(), x: s.x, y: s.y,
        emoji: TREE_VARIANT_EMOJI[s.variant],
        variant: s.variant,
        units: rndi(TREE_UNIT_RANGE[0], TREE_UNIT_RANGE[1]),
        maxUnits: units,
        ageTotalMs: 0,
        maxAgeMs: rndi(TREE_MAX_AGE_RANGE[0], TREE_MAX_AGE_RANGE[1]),
      });
    }
  }
}
```

Add helper:
```typescript
function countVariantInArea(world: World, cx: number, cy: number, variant: TreeVariant, radius: number): number {
  let count = 0;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const tree = world.treeBlocks.get(key(cx + dx, cy + dy));
      if (tree && tree.variant === variant) count++;
    }
  }
  return count;
}
```

Also update the seedling growth water check — for tropical seedlings, saltwater should also provide growth acceleration:

```typescript
let nearWater = false;
for (const wb of world.waterBlocks.values()) {
  if (manhattan(s.x, s.y, wb.x, wb.y) <= TREE_WATER_REQUIRED_FOR_SEEDLING) {
    nearWater = true;
    break;
  }
}
if (!nearWater && s.variant === 'tropical') {
  for (const sw of world.saltWaterBlocks.values()) {
    if (manhattan(s.x, s.y, sw.x, sw.y) <= TREE_WATER_REQUIRED_FOR_SEEDLING) {
      nearWater = true;
      break;
    }
  }
}
```

### 6.5 `tickSeedlingNearWater()` — Random Variant

**Current behavior (line 294):** Spawns seedlings near water blocks with `randomTreeEmoji()`.

**New behavior:** Seedlings spawned by this method get a random variant (no parent tree).

```typescript
world.seedlings.set(key(x, y), {
  id: uuid(), x, y,
  variant: randomVariant(),  // random since no parent
  plantedAtTick: world.tick,
  growthDurationMs: rndi(TREE_SEEDLING_GROWTH_RANGE[0], TREE_SEEDLING_GROWTH_RANGE[1]),
  growthElapsedMs: 0,
});
```

### 6.6 `tickTreePassiveSpawns()` — Pass Variant to Seedling

**Current behavior (line 329):** Calls `trySpawnSeedling(world, tree.x, tree.y)`.

**New behavior:** Pass the parent tree's variant:

```typescript
Spawner.trySpawnSeedling(world, tree.x, tree.y, tree.variant);
```

Also, the fruit spawn logic changes per variant:
- **Tropical:** Spawn 🥥 coconut food block instead of generic food. Cap at `COCONUT_CAP_PER_TREE` within `COCONUT_RADIUS` cells.
- **Regular:** Spawn random `TREE_FRUIT_EMOJIS` food block.
- **Evergreen:** No fruit spawn. Skip the food roll entirely.

```typescript
static tickTreePassiveSpawns(world: World): void {
  for (const [, tree] of world.treeBlocks) {
    if (tree.units <= 0) continue;
    const hasPoop = hasPoopNearby(world, tree.x, tree.y, TREE_POOP_BOOST_SEEDLING_RADIUS);
    const hasWater = hasWaterNearby(world, tree.x, tree.y, TREE_WATER_REQUIRED_FOR_SEEDLING);

    let chance = TREE_SEEDLING_PASSIVE_CHANCE;
    if (hasWater) chance *= 3;
    if (hasPoop) chance *= 2;

    if (Math.random() < chance) {
      Spawner.trySpawnSeedling(world, tree.x, tree.y, tree.variant);
    }

    // Variant-specific fruit spawning
    if (tree.variant === 'tropical' && hasPoop && Math.random() < TREE_FOOD_PASSIVE_CHANCE) {
      // Check coconut cap
      const nearbyCoconuts = countFoodInRadius(world, tree.x, tree.y, COCONUT_RADIUS);
      if (nearbyCoconuts < COCONUT_CAP_PER_TREE) {
        trySpawnFruitNearTree(world, tree.x, tree.y, COCONUT_EMOJI);
      }
    } else if (tree.variant === 'regular' && hasPoop && Math.random() < TREE_FOOD_PASSIVE_CHANCE) {
      const emoji = TREE_FRUIT_EMOJIS[Math.floor(Math.random() * TREE_FRUIT_EMOJIS.length)];
      trySpawnFruitNearTree(world, tree.x, tree.y, emoji);
    }
    // Evergreen: no fruit
  }
}
```

Add helper:
```typescript
function countFoodInRadius(world: World, cx: number, cy: number, radius: number): number {
  let count = 0;
  for (const [, fb] of world.foodBlocks) {
    if (manhattan(cx, cy, fb.x, fb.y) <= radius) count++;
  }
  return count;
}
```

Rename `trySpawnFoodNearTree()` to `trySpawnFruitNearTree()` and accept an emoji parameter:

```typescript
static trySpawnFruitNearTree(world: World, treeX: number, treeY: number, emoji: string): boolean {
  // ... existing placement logic (10 attempts within TREE_FOOD_RADIUS) ...
  world.foodBlocks.set(key(x, y), {
    id: uuid(), x, y,
    emoji,
    quality: 'hq',
    units: rndi(FOOD_HQ_UNITS[0], FOOD_HQ_UNITS[1]),
    maxUnits: units,
  });
}
```

Tree fruit is `'hq'` quality since it's actively produced by a living tree.

### 6.7 `maybeSpawnCrops()` — Farm Uses 🌾

**Current behavior (line 119):** Uses `randomFoodEmoji('hq')`.

**Change:** Replace with `FARM_CROP_EMOJI`:

```typescript
world.foodBlocks.set(key(x, y), {
  id: uuid(), x, y,
  emoji: FARM_CROP_EMOJI,  // was: randomFoodEmoji('hq')
  quality: 'hq', units, maxUnits: units,
});
```

### 6.8 `harvestWood()` — Variant-Aware Seedling on Harvest

**File:** `action/effects/resource-effects.ts` (line 80)

When wood harvest triggers a seedling spawn (10% chance), the event should include the tree's variant so the spawned seedling inherits it.

Currently the `harvest:seedling-chance` event is emitted but has no subscribers. Two options:

**Option A:** Wire up the event listener in `main.ts` to call `Spawner.trySpawnSeedling(world, x, y, variant)`.

**Option B:** Call `Spawner.trySpawnSeedling()` directly from `harvestWood()` instead of emitting an event.

**Recommendation: Option B** — the events are currently dead code (EventBus has zero subscribers). Calling the spawner directly is simpler and matches the direct-call pattern used everywhere else in the codebase.

```typescript
function harvestWood(world: World, agent: Agent, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const tree = world.grid.treeBlocks.get(k);
  if (!tree || tree.units <= 0) return;
  tree.units--;
  agent.addToInventory('wood', 1);
  agent.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${agent.name} harvested wood`, agent.id, { x: tp.x, y: tp.y });

  const roll = Math.random();
  if (roll < TREE_SEEDLING_CHANCE_ON_HARVEST) {
    Spawner.trySpawnSeedling(world, tree.x, tree.y, tree.variant);
  } else if (roll < TREE_SEEDLING_CHANCE_ON_HARVEST + TREE_FOOD_CHANCE_ON_HARVEST) {
    // Fruit spawn on harvest — variant-specific
    if (tree.variant === 'tropical') {
      const nearby = countFoodInRadius(world, tree.x, tree.y, COCONUT_RADIUS);
      if (nearby < COCONUT_CAP_PER_TREE) {
        Spawner.trySpawnFruitNearTree(world, tree.x, tree.y, COCONUT_EMOJI);
      }
    } else if (tree.variant === 'regular') {
      const emoji = TREE_FRUIT_EMOJIS[Math.floor(Math.random() * TREE_FRUIT_EMOJIS.length)];
      Spawner.trySpawnFruitNearTree(world, tree.x, tree.y, emoji);
    }
    // Evergreen: no fruit on harvest either
  }

  if (tree.units <= 0) {
    world.grid.treeBlocks.delete(k);
    world.deadMarkers.push({ cellX: tree.x, cellY: tree.y, cause: 'tree', msRemaining: 10000 });
  }
  checkLevelUp(world, agent);
}
```

This imports `Spawner` into `resource-effects.ts`. Since `action/effects/` is already a designated cross-domain integration point (per CLAUDE.md), this is an acceptable import.

### 6.9 New Plant Spawning Methods

Add to `Spawner` class:

**`tickMedicineSpawns()`** — spawn 🌿 near mountains:

```typescript
static tickMedicineSpawns(world: World): void {
  for (const [, obs] of world.obstacles) {
    if (obs.category !== 'mountain') continue;
    if (Math.random() >= MEDICINE_SPAWN_CHANCE) continue;

    for (let attempt = 0; attempt < 10; attempt++) {
      const dx = rndi(-MEDICINE_SPAWN_RADIUS, MEDICINE_SPAWN_RADIUS);
      const dy = rndi(-MEDICINE_SPAWN_RADIUS, MEDICINE_SPAWN_RADIUS);
      const x = obs.x + dx;
      const y = obs.y + dy;
      if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
      if (world.grid.isCellOccupied(x, y)) continue;
      world.medicineBlocks.set(key(x, y), { id: uuid(), x, y });
      break;
    }
  }
}
```

Note: `isCellOccupied` checks prevent stacking, but medicine blocks are passable for movement. 2x2 obstacles will be iterated multiple times (same obstacle ID at 4 keys) — deduplicate using a `seen` Set on `obs.id`, same pattern as egg spawning (spawner.ts line 472).

**`tickFlowerSpawns()`** — spawn flowers near fresh water:

```typescript
static tickFlowerSpawns(world: World): void {
  const seen = new Set<string>();
  for (const [, wb] of world.waterBlocks) {
    if (seen.has(wb.id)) continue;
    seen.add(wb.id);
    if (Math.random() >= FLOWER_SPAWN_CHANCE) continue;

    for (let attempt = 0; attempt < 10; attempt++) {
      const dx = rndi(-FLOWER_SPAWN_RADIUS, FLOWER_SPAWN_RADIUS);
      const dy = rndi(-FLOWER_SPAWN_RADIUS, FLOWER_SPAWN_RADIUS);
      const x = wb.x + dx;
      const y = wb.y + dy;
      if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
      if (world.grid.isCellOccupied(x, y)) continue;
      const emoji = FLOWER_EMOJIS[Math.floor(Math.random() * FLOWER_EMOJIS.length)];
      world.flowerBlocks.set(key(x, y), {
        id: uuid(), x, y, emoji,
        lifespanMs: rndi(FLOWER_LIFESPAN_RANGE[0], FLOWER_LIFESPAN_RANGE[1]),
      });
      break;
    }
  }
}
```

**`tickCactusSpawns()`** — spawn 🌵 far from water:

```typescript
static tickCactusSpawns(world: World): void {
  if (Math.random() >= CACTUS_SPAWN_CHANCE) return;

  for (let attempt = 0; attempt < 50; attempt++) {
    const x = rndi(0, GRID_SIZE - 1);
    const y = rndi(0, GRID_SIZE - 1);
    if (world.grid.isCellOccupied(x, y)) continue;

    // Check minimum distance from all water
    let tooClose = false;
    for (const wb of world.waterBlocks.values()) {
      if (manhattan(x, y, wb.x, wb.y) < CACTUS_MIN_WATER_DISTANCE) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      for (const sw of world.saltWaterBlocks.values()) {
        if (manhattan(x, y, sw.x, sw.y) < CACTUS_MIN_WATER_DISTANCE) {
          tooClose = true;
          break;
        }
      }
    }
    if (tooClose) continue;

    world.cactusBlocks.set(key(x, y), {
      id: uuid(), x, y,
      units: CACTUS_UNITS,
      maxUnits: CACTUS_MAX_UNITS,
    });
    break;
  }
}
```

### 6.10 `Spawner.tick()` — Add New Methods

**Current order (lines 524-531):**
1. `maybeSpawnCrops()`
2. `tickSeedlings()`
3. `tickTreePassiveSpawns()`
4. `tickClouds()`
5. `tickSeedlingNearWater()`
6. `tickEggs()`

**New order:**
1. `maybeSpawnCrops()`
2. `tickSeedlings()`
3. `tickTreePassiveSpawns()`
4. `tickClouds()`
5. `tickSeedlingNearWater()`
6. `tickEggs()`
7. `tickMedicineSpawns()`
8. `tickFlowerSpawns()`
9. `tickCactusSpawns()`

New plant spawns go after existing spawns. Order among the three doesn't matter since they're independent.

---

## 7. World Updater Changes

**File:** `simulation/world-updater.ts`

### 7.1 Tree Dehydration / Decline

**Current behavior (line 50):** Trees age and die only by reaching `maxAgeMs`.

**New behavior:** Add a water/mountain sustain check. Trees that lack water (and mountains for evergreens) lose `units` per tick and die when depleted — independent of age-based death.

Add new method:

```typescript
static tickTreeSustain(world: World): void {
  const toRemove: string[] = [];

  for (const [k, tree] of world.treeBlocks) {
    // Check if tree has water sustain
    let sustained = false;

    // Fresh water check (all variants)
    for (const wb of world.waterBlocks.values()) {
      if (manhattan(tree.x, tree.y, wb.x, wb.y) <= TREE_WATER_SUSTAIN_RANGE) {
        sustained = true;
        break;
      }
    }

    // Saltwater check (tropical only)
    if (!sustained && tree.variant === 'tropical') {
      for (const sw of world.saltWaterBlocks.values()) {
        if (manhattan(tree.x, tree.y, sw.x, sw.y) <= TREE_WATER_SUSTAIN_RANGE) {
          sustained = true;
          break;
        }
      }
    }

    // Mountain sustain (evergreen adults only)
    if (!sustained && tree.variant === 'evergreen') {
      for (const [, obs] of world.obstacles) {
        if (obs.category === 'mountain' &&
            manhattan(tree.x, tree.y, obs.x, obs.y) <= EVERGREEN_MOUNTAIN_RANGE) {
          sustained = true;
          break;
        }
      }
    }

    // If not sustained, decline
    if (!sustained) {
      tree.units -= TREE_DECLINE_RATE_PER_TICK;
      if (tree.units <= 0) {
        toRemove.push(k);
      }
    }
  }

  for (const k of toRemove) {
    const tree = world.treeBlocks.get(k)!;
    world.treeBlocks.delete(k);
    world.deadMarkers.push({ cellX: tree.x, cellY: tree.y, cause: 'tree', msRemaining: 10000 });
    log(world, 'death', `Tree @${tree.x},${tree.y} died of dehydration`, null, { x: tree.x, y: tree.y });
  }
}
```

**Performance note:** Iterating all water/salt/obstacle blocks for every tree every tick is O(trees × water). On a 62×62 grid with ~50 trees and ~20 water blocks, this is ~1000 iterations — acceptable. If performance becomes an issue, cache the water field's BFS distances and look up `waterField.distanceAt(tree.x, tree.y)` instead. The existing `WaterField` already computes this but seeds from adjacent cells rather than the water cells themselves, so using it directly may need a small adjustment.

### 7.2 Seedling Dehydration

Seedlings that are not near water should also decline and die. This is partially handled by the existing growth deceleration (100x slower without water), but per the PRD, seedlings should actively lose resource and die without water — not just grow slowly.

Add to `Spawner.tickSeedlings()` (or as a separate `WorldUpdater.tickSeedlingSustain()`):

```typescript
// Inside the seedling tick loop, after growth acceleration check:
if (!nearWater) {
  // Seedling declines without water
  s.growthElapsedMs -= TICK_MS * 2; // decline twice as fast as slow-growth
  if (s.growthElapsedMs <= -(s.growthDurationMs * 0.5)) {
    // Seedling has declined past the point of no return — die silently
    world.seedlings.delete(k);
    continue;
  }
}
```

This is a simpler approach: seedlings without water have their growth progress reversed. When they've lost enough progress (50% of their total growth time in the negative), they die. This means a seedling placed far from water will die in roughly the same time it would take to grow — but going backwards.

### 7.3 Flower Lifespan Decay

Add new method:

```typescript
static tickFlowerDecay(world: World): void {
  for (const [k, flower] of world.flowerBlocks) {
    flower.lifespanMs -= TICK_MS;
    if (flower.lifespanMs <= 0) {
      world.flowerBlocks.delete(k);
    }
  }
}
```

### 7.4 `WorldUpdater.update()` — Add New Methods

**Current order (lines 76-81):**
1. `tickWaterDecay()`
2. `tickTerrain()`
3. `tickTreeAging()`
4. `tickBlockDecay()`

**New order:**
1. `tickWaterDecay()`
2. `tickTerrain()`
3. `tickTreeAging()`
4. `tickTreeSustain()`
5. `tickFlowerDecay()`
6. `tickBlockDecay()`

`tickTreeSustain()` runs after `tickTreeAging()` — a tree that dies of old age is already removed, so sustain check doesn't process it again.

---

## 8. Harvest Action Changes

### 8.1 `resource-effects.ts` — New Harvest Branches

**File:** `action/effects/resource-effects.ts`

Add two new harvest functions and extend `onHarvestComplete()`:

```typescript
export function onHarvestComplete(world: World, agent: Agent): void {
  const act = agent.action!;
  const tp = act.payload?.targetPos;
  if (!tp) return;
  if (agent.inventoryFull() && act.payload?.resourceType !== 'medicine') return;

  const rt = act.payload?.resourceType || 'food_lq';

  if (rt === 'food_hq' || rt === 'food_lq') {
    harvestFood(world, agent, tp);
  } else if (rt === 'water') {
    harvestWater(world, agent, tp);
  } else if (rt === 'wood') {
    harvestWood(world, agent, tp);
  } else if (rt === 'medicine') {
    harvestMedicine(world, agent, tp);
  } else if (rt === 'cactus') {
    harvestCactus(world, agent, tp);
  }
}
```

Note: medicine harvest bypasses the `inventoryFull()` check since it doesn't add items to inventory.

**`harvestMedicine()`:**

```typescript
function harvestMedicine(world: World, agent: Agent, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const block = world.medicineBlocks.get(k);
  if (!block) return;
  if (!agent.diseased) return; // no benefit if not diseased
  world.medicineBlocks.delete(k);
  agent.diseased = false;
  agent.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${agent.name} used medicine to cure disease`, agent.id, { x: tp.x, y: tp.y });
  checkLevelUp(world, agent);
}
```

**`harvestCactus()`:**

```typescript
function harvestCactus(world: World, agent: Agent, tp: { x: number; y: number }): void {
  const k = key(tp.x, tp.y);
  const cactus = world.cactusBlocks.get(k);
  if (!cactus || cactus.units <= 0) return;
  cactus.units--;
  agent.addToInventory('water', 1);
  agent.addXp(XP_PER_HARVEST);
  log(world, 'harvest', `${agent.name} harvested water from cactus`, agent.id, { x: tp.x, y: tp.y });
  if (cactus.units <= 0) {
    world.cactusBlocks.delete(k);
  }
  checkLevelUp(world, agent);
}
```

### 8.2 Context Builder — Scan New Block Types

**File:** `decision/context-builder.ts`

Add after the tree block scan (line 53):

```typescript
// Scan for nearby medicine blocks (only relevant if diseased)
if (agent.diseased) {
  for (const [, block] of world.grid.medicineBlocks) {
    const dist = manhattan(agent.cellX, agent.cellY, block.x, block.y);
    if (dist <= vr) {
      nearbyResources.push({ type: 'medicine', pos: { x: block.x, y: block.y }, dist });
    }
  }
}

// Scan for nearby cactus blocks
for (const [, block] of world.grid.cactusBlocks) {
  const dist = manhattan(agent.cellX, agent.cellY, block.x, block.y);
  if (dist <= vr) {
    nearbyResources.push({ type: 'cactus', pos: { x: block.x, y: block.y }, dist });
  }
}
```

Medicine blocks are only added to `nearbyResources` when the agent is diseased, matching the PRD's "opportunistic" behavior — agents don't pathfind to medicine, but if adjacent and diseased, the harvest action becomes available.

### 8.3 Decision Engine — Handle New Resource Types

**File:** `decision/decision-engine.ts`

The `harvest` case in requirements check (line 123) already works generically — it checks `ctx.nearbyResources.filter(r => r.dist <= 1)` and returns true if any exist. Medicine and cactus will appear in `nearbyResources`, so harvest becomes available when adjacent.

The target resolution (line 212) needs a small update to map resource types correctly:

```typescript
case 'harvest': {
  const adjRes = ctx.nearbyResources.filter(r => r.dist <= 1);
  if (!adjRes.length) return null;
  const r = adjRes[0];
  let resourceType: string;
  if (r.type === 'food') resourceType = 'food_lq';
  else if (r.type === 'medicine') resourceType = 'medicine';
  else if (r.type === 'cactus') resourceType = 'cactus';
  else resourceType = r.type;
  return { targetPos: { x: r.pos.x, y: r.pos.y }, resourceType };
}
```

---

## 9. Obstacle Category Assignment

### 9.1 World Generator

**File:** `world/world-generator.ts`

Everywhere an obstacle is created (lines 41-72, 80-122), add the `category` field:

```typescript
const emoji = OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)];
const category = OBSTACLE_CATEGORY[emoji] ?? 'rock'; // fallback to rock
// ... existing placement ...
const obs: IObstacle = {
  id: uuid(), x, y, emoji,
  category,
  hp: size === '2x2' ? 24 : 12,
  maxHp: size === '2x2' ? 24 : 12,
  size: size === '2x2' ? '2x2' : undefined,
};
```

### 9.2 Input Handler (Paint Mode)

**File:** `ui/input-handler.ts`

If obstacles can be painted via the UI, ensure the category is set based on emoji. Currently there's no paint-obstacle mode, but if one exists or is added, apply the same `OBSTACLE_CATEGORY[emoji]` lookup.

---

## 10. Rendering Changes

**File:** `rendering/renderer.ts`

### 10.1 Dry Tree Filter — Variant-Aware

The existing dry tree rendering (lines 348-355) applies `DRY_TREE_FILTER` (sepia) to trees not near water. This should now apply to trees that are in decline (units decreasing). The existing `_treeNearWater` cache already serves this purpose — trees near water are "wet", others get the dry filter. This behavior remains correct.

However, the `_treeNearWater` cache (lines 323-335) currently only checks `world.waterBlocks`. For tropical trees, it should also check `world.saltWaterBlocks`. Update the cache rebuild:

```typescript
private _rebuildTreeNearWater(world: World): void {
  this._treeNearWater.clear();
  for (const [k, tree] of world.treeBlocks) {
    let near = false;
    for (const wb of world.waterBlocks.values()) {
      if (manhattan(tree.x, tree.y, wb.x, wb.y) <= 5) { near = true; break; }
    }
    if (!near && tree.variant === 'tropical') {
      for (const sw of world.saltWaterBlocks.values()) {
        if (manhattan(tree.x, tree.y, sw.x, sw.y) <= 5) { near = true; break; }
      }
    }
    if (!near && tree.variant === 'evergreen') {
      for (const [, obs] of world.obstacles) {
        if (obs.category === 'mountain' && manhattan(tree.x, tree.y, obs.x, obs.y) <= 3) {
          near = true; break;
        }
      }
    }
    if (near) this._treeNearWater.add(k);
  }
}
```

### 10.2 New Block Rendering Methods

**`_drawMedicineBlocks()`:**

```typescript
private _drawMedicineBlocks(world: World): void {
  for (const [, block] of world.medicineBlocks) {
    // ... visibility check ...
    if (this._lod) {
      // Green dot
      this._ctx.fillStyle = '#4a8c5c';
      this._ctx.fillRect(px + 4, py + 4, CELL_PX - 8, CELL_PX - 8);
    } else {
      this._drawCellEmoji(MEDICINE_EMOJI, px, py, CELL_PX / 2);
    }
  }
}
```

Rendered at half cell size like food blocks. Passable, so no border/outline.

**`_drawFlowerBlocks()`:**

```typescript
private _drawFlowerBlocks(world: World): void {
  for (const [, flower] of world.flowerBlocks) {
    // ... visibility check ...
    // Fade out in last 20% of lifespan
    const fade = flower.lifespanMs < (FLOWER_LIFESPAN_RANGE[1] * 0.2)
      ? flower.lifespanMs / (FLOWER_LIFESPAN_RANGE[1] * 0.2)
      : 1;
    this._ctx.globalAlpha = fade;
    if (this._lod) {
      // Small colored dot
      this._ctx.fillStyle = '#cc6699';
      this._ctx.fillRect(px + 5, py + 5, CELL_PX - 10, CELL_PX - 10);
    } else {
      this._drawCellEmoji(flower.emoji, px, py, CELL_PX / 2);
    }
    this._ctx.globalAlpha = 1;
  }
}
```

Flowers fade out near the end of their lifespan for a smooth visual transition.

**`_drawCactusBlocks()`:**

```typescript
private _drawCactusBlocks(world: World): void {
  for (const [, cactus] of world.cactusBlocks) {
    // ... visibility check ...
    const alpha = 0.4 + 0.6 * (cactus.units / cactus.maxUnits);
    this._ctx.globalAlpha = alpha;
    if (this._lod) {
      this._ctx.fillStyle = '#2d6b3e';
      this._ctx.fillRect(px, py, CELL_PX, CELL_PX);
    } else {
      this._drawCellEmoji(CACTUS_EMOJI, px, py, CELL_PX);
    }
    this._ctx.globalAlpha = 1;
  }
}
```

Cactus renders at full cell size (like trees) since it blocks movement.

### 10.3 Render Order

Add new draw calls in the `render()` method, after existing block draws and before agent rendering:

```typescript
this._drawMedicineBlocks(world);
this._drawFlowerBlocks(world);
this._drawCactusBlocks(world);
```

These should render after terrain but before agents, at the same layer as food blocks and seedlings.

---

## 11. Persistence Changes

**File:** `persistence/persistence-manager.ts`

### 11.1 Save Format

Add to the serialized object (after line 173):

```typescript
medicineBlocks: [...world.medicineBlocks.values()],
flowerBlocks: [...world.flowerBlocks.values()],
cactusBlocks: [...world.cactusBlocks.values()],
```

Update tree serialization to include `variant`:

```typescript
treeBlocks: [...world.treeBlocks.values()],
// ITreeBlock already includes variant field — serialized as-is
```

Update seedling serialization to include `variant`:

```typescript
seedlings: [...world.seedlings.values()],
// ISeedling already includes variant field — serialized as-is
```

### 11.2 Deserialization

**Trees (lines 315-324)** — add variant with backwards-compatible default:

```typescript
world.treeBlocks.set(key(tb.x, tb.y), {
  id: tb.id, x: tb.x, y: tb.y,
  emoji: tb.emoji,
  variant: tb.variant ?? variantFromEmoji(tb.emoji),
  units: tb.units ?? 3,
  maxUnits: tb.maxUnits ?? 3,
  ageTotalMs: tb.ageTotalMs ?? 0,
  maxAgeMs: tb.maxAgeMs ?? rndi(TREE_MAX_AGE_RANGE[0], TREE_MAX_AGE_RANGE[1]),
});
```

Add helper for backwards compatibility with pre-4.3 saves:

```typescript
function variantFromEmoji(emoji: string): TreeVariant {
  if (emoji === TREE_VARIANT_EMOJI.tropical) return 'tropical';
  if (emoji === TREE_VARIANT_EMOJI.evergreen) return 'evergreen';
  return 'regular'; // default for 🌳, 🎄, or unknown
}
```

**Seedlings (lines 325-333)** — add variant with default:

```typescript
world.seedlings.set(key(s.x, s.y), {
  id: s.id, x: s.x, y: s.y,
  variant: s.variant ?? 'regular',
  plantedAtTick: s.plantedAtTick ?? 0,
  growthDurationMs: s.growthDurationMs ?? 60000,
  growthElapsedMs: s.growthElapsedMs ?? 0,
});
```

**Obstacles** — add category with fallback:

```typescript
const obs: IObstacle = {
  id: o.id, x: o.x, y: o.y,
  emoji: o.emoji,
  category: o.category ?? (OBSTACLE_CATEGORY[o.emoji] ?? 'rock'),
  hp: o.hp, maxHp: o.maxHp,
  size: o.size,
};
```

**New block types:**

```typescript
// Medicine
for (const m of d.medicineBlocks || []) {
  world.medicineBlocks.set(key(m.x, m.y), { id: m.id, x: m.x, y: m.y });
}

// Flowers
for (const f of d.flowerBlocks || []) {
  world.flowerBlocks.set(key(f.x, f.y), {
    id: f.id, x: f.x, y: f.y,
    emoji: f.emoji,
    lifespanMs: f.lifespanMs ?? rndi(FLOWER_LIFESPAN_RANGE[0], FLOWER_LIFESPAN_RANGE[1]),
  });
}

// Cactus
for (const c of d.cactusBlocks || []) {
  world.cactusBlocks.set(key(c.x, c.y), {
    id: c.id, x: c.x, y: c.y,
    units: c.units ?? CACTUS_UNITS,
    maxUnits: c.maxUnits ?? CACTUS_MAX_UNITS,
  });
}
```

All new fields use `|| []` fallback for backwards compatibility with pre-4.3 saves.

### 11.3 Version Bump

Update save version from `'v4.2'` to `'v4.3'` (line 148). Older saves load fine due to `??` defaults throughout.

---

## 12. Food/Water Field Impact

### 12.1 Food Field (`world/food-field.ts`)

Trees currently block the food BFS (line 35-44: `grid.treeBlocks.has(k)`). Cactus blocks should also block:

```typescript
if (grid.cactusBlocks.has(k)) return true; // add to staticBlocked()
```

Medicine and flowers are passable, so they don't affect the food field.

### 12.2 Water Field (`world/water-field.ts`)

Same pattern — add cactus to `staticBlocked()`:

```typescript
if (grid.cactusBlocks.has(k)) return true;
```

---

## 13. Implementation Order

The changes have dependencies that dictate sequencing. Recommended order:

### Phase 1: Foundation (no behavioral changes)

1. **Types & constants** — Add `TreeVariant`, `ObstacleCategory`, new interfaces, emoji constants, `OBSTACLE_CATEGORY` map. Remove 🎄 from `TREE_EMOJIS`.
2. **Grid collections** — Add `medicineBlocks`, `flowerBlocks`, `cactusBlocks` to `Grid`. Update `isCellOccupied`, `isBlocked`, `isBlockedTerrain`, `clear()`.
3. **World accessors** — Add convenience getters.
4. **Obstacle category** — Add `category` to `IObstacle`. Update `world-generator.ts` and `persistence-manager.ts`.

### Phase 2: Tree Variant System

5. **Tree variant on ITreeBlock/ISeedling** — Add `variant` field. Update `spawner.ts`: `addTree()`, `trySpawnSeedling()`, `tickSeedlings()`, `tickSeedlingNearWater()`, `tickTreePassiveSpawns()`.
6. **Tree sustain/decline** — Add `WorldUpdater.tickTreeSustain()`.
7. **Variant-specific fruit** — Update `tickTreePassiveSpawns()` and `harvestWood()` for coconut/tree-fruit/no-fruit per variant.
8. **Farm crop emoji** — Change `maybeSpawnCrops()` to use `FARM_CROP_EMOJI`.

### Phase 3: New Plant Types

9. **Medicine** — Add `tickMedicineSpawns()`, `harvestMedicine()`, context-builder scan, rendering.
10. **Flowers** — Add `tickFlowerSpawns()`, `tickFlowerDecay()`, rendering.
11. **Cactus** — Add `tickCactusSpawns()`, `harvestCactus()`, context-builder scan, food/water field blocking, rendering.

### Phase 4: Polish

12. **Persistence** — Update save/load for all new fields and block types. Version bump to v4.3.
13. **Rendering** — Tree dry filter for variant-aware water/mountain checks. New block render methods.
14. **Emoji cleanup** — Remove 🌿 from `FOOD_EMOJIS.lq`, remove 🍎/🍑 from `FOOD_EMOJIS.hq`.

---

## 14. Files Changed

| File | Change Type | Summary |
|------|-------------|---------|
| `src/domains/world/types.ts` | Modified | Add `TreeVariant`, `ObstacleCategory`, `variant` to `ITreeBlock`/`ISeedling`, `category` to `IObstacle`. New `IMedicineBlock`, `IFlowerBlock`, `ICactusBlock`. |
| `src/domains/world/grid.ts` | Modified | New collections, blocking updates, `clear()`. |
| `src/domains/world/world.ts` | Modified | New accessors. |
| `src/domains/world/food-field.ts` | Modified | Add cactus to `staticBlocked()`. |
| `src/domains/world/water-field.ts` | Modified | Add cactus to `staticBlocked()`. |
| `src/domains/world/world-generator.ts` | Modified | Obstacle `category` assignment. |
| `src/core/constants.ts` | Modified | Replace `TREE_EMOJIS` with `TREE_VARIANT_EMOJI`. Add `TREE_FRUIT_EMOJIS`, `FLOWER_EMOJIS`, `FARM_CROP_EMOJI`, `MEDICINE_EMOJI`, `CACTUS_EMOJI`, `COCONUT_EMOJI`, `OBSTACLE_CATEGORY`. Update `FOOD_EMOJIS`. |
| `src/domains/simulation/spawner.ts` | Modified | Variant-aware tree/seedling spawning, new plant spawn methods, farm crop emoji. |
| `src/domains/simulation/world-updater.ts` | Modified | `tickTreeSustain()`, `tickFlowerDecay()`. |
| `src/domains/action/effects/resource-effects.ts` | Modified | `harvestMedicine()`, `harvestCactus()`, variant-aware `harvestWood()`. |
| `src/domains/decision/types.ts` | Modified | Add `'medicine' | 'cactus'` to `NearbyResource.type`. |
| `src/domains/decision/context-builder.ts` | Modified | Scan medicine (if diseased) and cactus blocks. |
| `src/domains/decision/decision-engine.ts` | Modified | Map medicine/cactus resource types in harvest target resolution. |
| `src/domains/rendering/renderer.ts` | Modified | Variant-aware dry-tree cache, new block render methods. |
| `src/domains/persistence/persistence-manager.ts` | Modified | Save/load new fields and block types, version bump. |

---

## 15. Backwards Compatibility

All changes are backwards-compatible with existing v4.2 saves:

- `ITreeBlock.variant` defaults via `variantFromEmoji(emoji)` — existing trees keep their emoji, gain a matching variant.
- `ISeedling.variant` defaults to `'regular'`.
- `IObstacle.category` defaults via `OBSTACLE_CATEGORY[emoji]` lookup.
- New block collections (`medicineBlocks`, `flowerBlocks`, `cactusBlocks`) default to empty via `|| []` during deserialization.
- `FOOD_EMOJIS` changes don't affect existing food blocks — they already store their emoji. Only new spawns use the updated arrays.
- 🎄 trees in old saves retain their emoji but get `variant: 'regular'` — they'll function as regular trees.

---

## 16. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Performance: tree sustain check iterates all water blocks per tree per tick** | Medium | Acceptable for current scale (~50 trees × ~20 water). If needed, use `waterField.distanceAt()` BFS cache instead of brute-force iteration. |
| **Overgrowth not fully solved** | Low | Density caps on tropical/regular + dehydration death should control growth. Evergreen deliberately has no cap (per PRD). Monitor and tune constants. |
| **Medicine too rare / too common** | Medium | All spawn chances are tuneable constants. Adjust `MEDICINE_SPAWN_CHANCE` and `MEDICINE_SPAWN_RADIUS` based on playtesting. |
| **Cactus water distance check is O(water + salt)** | Low | Only runs once per tick (single global roll), so the scan is infrequent. |
| **Emoji rendering differences across platforms** | Low | All chosen emojis are widely supported. Test on major browsers. |
