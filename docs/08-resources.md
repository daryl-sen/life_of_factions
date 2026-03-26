# Resources and Economy

Resources drive agent behavior. Energy, fullness, and hygiene are the three survival resources. Energy is restored only via sleep; fullness is restored by eating food from inventory; hygiene is restored by drinking water. Agents carry resources in a personal inventory and must harvest food blocks before consuming them. Low hygiene can cause disease (Phase 5), which accelerates health and energy loss.

## Energy System

### Energy Properties

| Property | Value |
|----------|-------|
| Minimum | 0 |
| Starting | 100 |
| maxEnergy (base) | 200 |
| maxEnergy (per level) | +5 per level (level 20 = 295) |
| Passive drain | 0.0625 per tick (~0.25/sec) |
| Recovery | Sleep action only (+8 per 500ms tick) |

### Energy Thresholds

| Threshold | Value | Behavior |
|-----------|-------|----------|
| Mandatory sleep | < 20 | Force sleep action |
| Voluntary sleep | < 40 | May choose to sleep |
| Normal | 40+ | Normal behavior |

Energy reaching 0 does **not** trigger starvation (see Fullness System below).

### Energy Drain

**Passive drain:**
```javascript
agent.energy -= 0.0625  // Per tick
```

**Movement cost:**
```javascript
agent.energy -= 0.12  // Per cell moved
```

**Action costs (per second) — halved from previous version:**
- talk: 0.2
- quarrel: 0.4
- attack: 1.1
- heal: 1.5
- share: 0.4
- reproduce: 1.5

### Energy Recovery (Sleep)

Energy is restored **only** via the sleep action:
- Duration: 8–12 seconds
- Restores: +8 energy per 500ms tick (total 128–192 energy)
- Mandatory at energy < 20, voluntary at energy < 40
- Interruptible by attack
- Emoji: 😴

## Fullness System (0–100)

Fullness is a survival resource that replaces energy's former role in starvation and health regeneration.

### Fullness Properties

| Property | Value |
|----------|-------|
| Minimum | 0 |
| Maximum | 100 |
| Starting | 100 |
| Passive decay | -0.03 per tick |
| Movement decay | -0.08 per cell |
| Action decay | -0.02 per second during any action |
| Recovery | Eating food from inventory: +20 fullness |

### Fullness Thresholds

| Threshold | Value | Behavior |
|-----------|-------|----------|
| Starvation | 0 | Lose 1 HP/sec |
| Urgent food seeking | < 20 | High-priority food seeking |
| Proactive food seeking | < 40 | Seek food before other activities |
| Health regen | > 90 | +0.5 HP/sec |

### Starvation

When fullness reaches 0:

```javascript
if (agent.fullness === 0):
  agent.health -= 1.0 * (tickMs / 1000)  // 1 HP per second
```

**Time to death at 0 fullness:**
- Level 1 agent (100 HP): ~100 seconds
- Level 10 agent (168 HP): ~168 seconds
- Level 20 agent (252 HP): ~252 seconds

### Health Regeneration

When fullness > 90:

```javascript
agent.health = min(agent.maxHealth, agent.health + 0.5 * (tickMs / 1000))
```

**Rate:** 0.5 HP per second when well-fed.

## Hygiene System (0–100)

Hygiene is a survival need restored by drinking water. It was activated in Phase 3 alongside the introduction of water blocks. In Phase 5, hygiene gains additional decay sources (movement, social actions, poop) and drives the disease system.

### Hygiene Properties

| Property | Value |
|----------|-------|
| Minimum | 0 |
| Maximum | 100 |
| Starting | 100 |
| Passive decay | -0.02 per tick |
| Movement decay | -0.05 per cell |
| Social action decay | -0.5 on completion of talk, quarrel, share, or heal |
| Poop action decay | -5 on poop action completion |
| Stepping on poop | -5 per step through a 💩 block |
| Recovery | Drinking water from inventory: +30 hygiene |

### Hygiene Thresholds

| Threshold | Value | Behavior |
|-----------|-------|----------|
| Critical water seeking | < 20 | High-priority water seeking (decision priority 5) |
| Proactive water seeking | < 40 | Seek water before other activities (decision priority 7b) |
| Normal | 40+ | Normal behavior |

### Hygiene Decay Sources

| Source | Amount | Trigger |
|--------|--------|---------|
| Passive decay | -0.02/tick | Every simulation tick |
| Movement | -0.05/cell | Each cell moved |
| Social actions | -0.5 | On completion of talk, quarrel, share, or heal |
| Poop action | -5 | On poop action completion |
| Stepping on 💩 | -5/step | Each step through a poop block |

### Water-Seeking Decision Priority

When an agent needs water (hygiene < 40 proactive, < 20 critical):

1. **Drink from inventory** if agent has water in inventory
2. **Harvest adjacent water block** if one is within distance 1
3. **Pathfind to nearest water block** and harvest it

### Disease System (Phase 5)

Disease is a condition caused by low hygiene that accelerates health and energy loss.

#### Contraction

When an agent's hygiene drops below 20, there is a **5% chance per tick** to contract disease.

#### Spread

Diseased agents spread disease to adjacent agents at **3% per tick**. Spread is **blocked** if the target agent's hygiene is above 60.

#### Effects

| Effect | Value |
|--------|-------|
| Emoji | 🤢 |
| Energy drain | 2x normal passive drain (0.125/tick instead of 0.0625/tick) |
| Health drain | -0.5 HP/sec |
| Lethal | Yes (health can reach 0 from disease) |

#### Cure

Disease can be cured in two ways:

1. **Heal action** from another agent (on heal completion, disease is removed)
2. **Hygiene recovery** above 80 (automatic cure)

## Inspiration System (Phase 6)

Inspiration is an active need that affects agent action efficiency. It decays passively and is recovered through specific actions.

### Inspiration Properties

| Property | Value |
|----------|-------|
| Minimum | 0 |
| Maximum | 100 |
| Starting | 50 |
| Passive decay | -0.015 per tick |
| Seek threshold | < 40 (decision priority 7c: seek play or clean poop) |

### Recovery Sources

| Source | Amount | Details |
|--------|--------|---------|
| Play action | +15 | Adjacent to any interactable block (1500–2500ms, 0.15 energy/sec) |
| Clean action | +10 | Adjacent to poop block (800–1200ms, 0.25 energy/sec) |
| Build farm action | +25 | Explicit build action (2000ms, 0.25 energy/sec, requires 3 wood + 6 energy) |

### Duration Scaling

Inspiration affects action duration at creation time:

| Inspiration Level | Duration Multiplier | Effect |
|-------------------|-------------------|--------|
| < 20 | ×1.5 | Sluggish — actions take 50% longer |
| 20–70 | ×1.0 | Normal — no scaling |
| > 70 | ×0.75 | Efficient — actions complete 25% faster |

This scaling is applied **once** when the action is created, not continuously during the action. It affects all action types.

### Inspiration-Seeking Decision Priority

When inspiration < 40 (decision priority 7c):

1. **Play** if adjacent to any interactable block (food, water, tree, farm, poop, seedling, or flag)
2. **Clean poop** if adjacent to a poop block (also grants +10 inspiration)

## Placeholder Needs

The following needs are tracked on agents but have limited gameplay effect:

| Need | Starting Value | Range | Notes |
|------|---------------|-------|-------|
| Social | 50 | 0–100 | No gameplay effect |

## Inventory System

Agents carry resources in a personal inventory. All resource consumption requires harvesting into inventory first, then consuming from inventory via a separate action.

### Inventory Properties

| Property | Value |
|----------|-------|
| Capacity | **20 total units** across all resource types |
| Resource types | food, water, wood |
| Starting inventory | 0 (agents start with nothing) |

```typescript
interface IInventory {
  food: number;     // food units (no quality distinction once harvested)
  water: number;    // water units
  wood: number;     // wood units
}
// Total: food + water + wood <= 20
```

When inventory is full, harvest actions are blocked (agent will not attempt to harvest). Agents should prioritize consuming or depositing before harvesting more.

## Food Blocks

Food exists as blocks on the grid with a unit count that must be harvested before consumption. Two quality tiers affect harvest speed and yield, but once in inventory all food is identical (fungible).

### Food Block Properties

| Property | High Quality (HQ) | Low Quality (LQ) |
|----------|-------------------|-------------------|
| Emojis | 🥔🍎🍑🌽🍅 | 🌿🥬🥦🍀 |
| Source | Farms only | Nature (world-gen near trees) |
| Units per block | 2–4 | 1–2 |
| Harvest time per unit | 600ms | 1200ms |
| Passable | Yes | Yes |
| Depletion | Block removed when 0 units remain | Block removed when 0 units remain |

### Food Spawning

**Random food spawning is removed.** Food comes only from:

1. **Farms:** Produce HQ food blocks in their vicinity
2. **World-gen:** 5–10 LQ food blocks scattered near trees at world creation

**Instant-consume on step is removed.** Agents must:
1. Harvest food into inventory (harvest action, 🫨 emoji)
2. Eat from inventory (eat action, 🤔 emoji)

### Harvest Action

The harvest action transfers 1 unit from an adjacent food block to the agent's inventory.

```javascript
function tryHarvest(world, agent, foodBlock) {
  if (manhattanDistance(agent, foodBlock) !== 1) return false
  if (agent.inventoryTotal() >= 20) return false  // Inventory full
  if (foodBlock.units <= 0) return false

  // Start harvest action
  // Duration: HQ food 600ms, LQ food 1200ms
  // Energy cost: 0.25/sec
  // On completion:
  foodBlock.units -= 1
  agent.inventory.food += 1
  agent.xp += 2  // harvest XP

  if (foodBlock.units <= 0) {
    world.foodBlocks.delete(key(foodBlock.x, foodBlock.y))
  }

  return true
}
```

### Eat Action (from inventory)

```javascript
function tryEat(agent) {
  if (agent.inventory.food <= 0) return false

  // Start eat action (300-500ms, no energy cost)
  // On completion:
  agent.inventory.food -= 1
  agent.fullness = min(100, agent.fullness + 20)
  agent.xp += 5

  levelCheck(world, agent)
  return true
}
```

### Drink Action (from inventory)

```javascript
function tryDrink(agent) {
  if (agent.inventory.water <= 0) return false

  // Start drink action (300-500ms, no energy cost)
  // On completion:
  agent.inventory.water -= 1
  agent.hygiene = min(100, agent.hygiene + 30)

  return true
}
```

### Food-Seeking Decision Priority

When an agent needs food (fullness < 40 proactive, < 20 urgent):

1. **Eat from inventory** if agent has food in inventory
2. **Harvest adjacent food block** if one is within distance 1
3. **Pathfind to nearest food block** and harvest it

## Water Blocks (Phase 3)

Water exists as blocks on the grid that agents harvest for drinking water to restore hygiene. There are two sizes of water blocks.

### Water Block Properties

| Property | Small | Large |
|----------|-------|-------|
| Size | 1 cell | 2×2 cells (single entity) |
| Units | 5 | 20 |
| Passable | No | No |
| Harvest time per unit | 1000ms | 1000ms |
| Shrinking | N/A | Shrinks to small at 25% threshold (≤5 units) |
| Depletion | Block removed when 0 units remain | Becomes small water block at ≤5 units |

### Water Spawning

Water is replenished by the cloud/rain system:

| Property | Value |
|----------|-------|
| Cloud spawn rate | 1 cloud every 60–120 seconds |
| Cloud duration | 5–10 seconds |
| Cloud emoji | 🌧️ |
| Water type odds | 90% small (1-cell, 5 units), 10% large (2×2, 20 units) |

Clouds spawn periodically, persist for a short duration, and rain water blocks onto the map. This provides a steady replenishment of water resources.

### World-Gen Water

At world creation, 3–6 water sources are placed on the map (mix of small and large blocks), providing agents with initial water access.

### Water Harvest Action

```javascript
function tryHarvestWater(world, agent, waterBlock) {
  if (manhattanDistance(agent, waterBlock) !== 1) return false
  if (agent.inventoryTotal() >= 20) return false  // Inventory full
  if (waterBlock.units <= 0) return false

  // Start harvest action
  // Duration: 1000ms per unit
  // Energy cost: 0.25/sec
  // On completion:
  waterBlock.units -= 1
  agent.inventory.water += 1
  agent.xp += 2  // harvest XP

  // Large water block shrinks to small at 25% threshold
  if (waterBlock.type === 'large' && waterBlock.units <= 5) {
    // Convert to small water block (1-cell)
  }

  if (waterBlock.units <= 0) {
    world.waterBlocks.delete(key(waterBlock.x, waterBlock.y))
  }

  return true
}
```

### Drink Action (from inventory)

```javascript
function tryDrink(agent) {
  if (agent.inventory.water <= 0) return false

  // Start drink action (300-500ms, no energy cost)
  // On completion:
  agent.inventory.water -= 1
  agent.hygiene = min(100, agent.hygiene + 30)

  return true
}
```

## Tree Blocks (Phase 3)

Trees are a source of wood and contribute to the food economy through passive and harvest-triggered spawning.

### Tree Block Properties

| Property | Value |
|----------|-------|
| Size | 1 cell |
| Units | 3–6 (wood) |
| Passable | No |
| Emojis | 🌲🌳🌴🎄 (random) |
| Harvest time per unit | 1500ms |
| Depletion | Block removed when 0 units remain |

### World-Gen Trees

At world creation, 8–15 trees are placed on the map, providing initial wood resources and contributing to early food economy via passive spawns.

### Seedling Mechanic

When a tree is harvested or passively each tick, seedlings may spawn:

| Trigger | Chance | Details |
|---------|--------|---------|
| Tree harvest | 10% per harvest | Spawns seedling on adjacent free cell |
| Passive (per tick per tree) | 2% | Spawns seedling on adjacent free cell |

Seedling properties:

| Property | Value |
|----------|-------|
| Emoji | 🌱 |
| Passable | Yes |
| Protected | Other block spawns cannot overwrite seedlings |
| Growth time | 45–90 seconds (random) |
| Result | Grows into a full tree (random emoji from 🌲🌳🌴🎄, 3–6 units) |

### Tree Food Spawning

Trees contribute to the food economy by spawning LQ food blocks:

| Trigger | Chance | Details |
|---------|--------|---------|
| Tree harvest | 5% (instead of seedling) | Spawns 1 LQ food block within 3-cell radius |
| Passive (per tick per tree) | 1% | Spawns 1 LQ food block within 3-cell radius |

On harvest, the seedling and food spawn chances are mutually exclusive: 10% seedling, 5% food, 85% neither.

### Wood Harvest Action

```javascript
function tryHarvestWood(world, agent, treeBlock) {
  if (manhattanDistance(agent, treeBlock) !== 1) return false
  if (agent.inventoryTotal() >= 20) return false  // Inventory full
  if (treeBlock.units <= 0) return false

  // Start harvest action
  // Duration: 1500ms per unit
  // Energy cost: 0.25/sec
  // On completion:
  treeBlock.units -= 1
  agent.inventory.wood += 1
  agent.xp += 2  // harvest XP

  // Side effects (mutually exclusive):
  // 10% chance: spawn seedling on adjacent free cell
  // 5% chance: spawn LQ food within 3-cell radius

  if (treeBlock.units <= 0) {
    world.treeBlocks.delete(key(treeBlock.x, treeBlock.y))
  }

  return true
}
```

**Wood harvesting behavior:** Agents harvest wood opportunistically when passing near trees, rather than actively seeking them out. Wood harvesting is a low-priority action attempted when agents are adjacent to a tree and have inventory space.

## Loot Bags (Phase 4)

Loot bags (👝) are temporary resource containers that spawn on the grid when agents die or faction flags are destroyed.

### Loot Bag Properties

| Property | Value |
|----------|-------|
| Emoji | 👝 |
| Passable | Yes |
| Decay timer | 30 seconds |
| Fade effect | Visual opacity decreases as decay timer counts down |

### Death Drops

When an agent dies, a loot bag spawns at the agent's death location containing the agent's full inventory:

```javascript
function onAgentDeath(world, agent) {
  if (agent.inventory.food > 0 || agent.inventory.water > 0 || agent.inventory.wood > 0) {
    spawnLootBag(world, agent.cellX, agent.cellY, {
      food: agent.inventory.food,
      water: agent.inventory.water,
      wood: agent.inventory.wood
    })
  }
}
```

### Flag Destruction Drops

When a faction flag is destroyed, all stored resources drop as a loot bag at the flag's location. See `docs/07-factions.md` for details on flag storage.

### Loot Bag Merging

When multiple loot bags exist on the same cell, they merge into a single bag:
- All contents are combined
- The decay timer is reset to 30 seconds

### Loot Bag Decay

Loot bags decay after 30 seconds if not picked up:
- A visual fade effect indicates remaining time
- When the timer reaches 0, the bag and all its contents are removed from the grid

### Pickup Action

Any agent can pick up a loot bag via the pickup action:
- **Duration:** 300–500ms
- **Energy cost:** None
- **Effect:** Takes all contents from the loot bag up to the agent's inventory cap (20 total)
- **Decision priority:** Checked before roaming (priority 7e)

## Poop Blocks (Phase 5)

Poop blocks (💩) are passable terrain hazards spawned by the poop action. They penalize hygiene and contribute to disease spread.

### Poop Block Properties

| Property | Value |
|----------|-------|
| Emoji | 💩 |
| Passable | Yes |
| Hygiene penalty | -5 per step through the block |
| Decay timer | 30 seconds (removed from grid on expiry) |
| Stacking | No — only one poop block per cell |

### Spawn Rules

Poop blocks are spawned by the poop action (see `docs/04-actions.md`). They will **not** spawn on cells occupied by interactable blocks:
- Food blocks (HQ or LQ)
- Water blocks
- Tree blocks
- Farms
- Faction flags
- Walls
- Seedlings

### Poop Trigger

After an agent completes the eat action, a 30-second poop cooldown window begins. During this window:
- Each tick has a **10% chance** of triggering the poop action
- Only triggers when the agent is **idle** (no current action)
- The poop action lasts 500–1000ms and costs no energy
- On completion, a 💩 block is placed at the agent's cell and the agent loses 5 hygiene

### Decay

Poop blocks have a 30-second decay timer. When the timer reaches 0, the block is removed from the grid. Poop blocks do not have a visual fade effect.

### Clean Action

Any agent can remove an adjacent poop block via the clean action:
- **Duration:** 800–1200ms
- **Energy cost:** 0.25/sec
- **Effect:** Removes the poop block and grants +10 inspiration to the cleaning agent
- **Decision priority:** Opportunistic (priority 7g, before social actions)

## Faction Flag Storage (Phase 4)

Faction flags serve as communal resource storage. See `docs/07-factions.md` for full details.

| Property | Value |
|----------|-------|
| Storage capacity | 30 per resource type (food, water, wood) |
| Deposit trigger | Adjacent to own flag, inventory >= 3 items |
| Withdraw trigger | Adjacent to own flag, needing resources, flag has stored resources |
| Deposit/Withdraw duration | 300–500ms |
| Deposit/Withdraw energy cost | None |
| On flag destruction | All stored resources drop as a loot bag |

## Farms (Reworked in Phase 6)

### Farm Properties

| Property | Value |
|----------|-------|
| Build cost | 3 wood + 6 energy (explicit build_farm action) |
| Build duration | 2000ms (fixed) |
| Build energy cost | 0.25 energy/sec |
| Build rewards | +15 XP, +25 inspiration |
| Emoji | 🌻 |
| Blocks movement | Yes |
| Spawn radius | 1 cell (adjacent cells only) |
| Spawns remaining | 10 (max, per farm) |
| Spawn interval | 15–25 seconds between food spawns |
| Max nearby food | 4 food blocks within radius 1 |
| Destruction | Farm removed when spawnsRemaining reaches 0 |

### Building Farms (Phase 6 — Explicit Action)

The old random-chance farm building mechanic has been replaced by an explicit `build_farm` action. Agents must have sufficient resources and energy to build.

**Requirements:**
1. 3 wood in inventory
2. 6 energy available
3. Adjacent free cell available

```javascript
function tryBuildFarm(world, agent) {
  if (agent.inventory.wood < 3) return
  if (agent.energy < 6) return

  const adjacent = getFreeAdjacentCells(agent)
  if (adjacent.length === 0) return

  // Start build_farm action (2000ms, 0.25 energy/sec)
  // On completion:
  agent.inventory.wood -= 3
  const spot = random(adjacent)
  world.farms.set(key(spot.x, spot.y), {
    id: generateId(),
    x: spot.x,
    y: spot.y,
    spawnsRemaining: 10,
    spawnTimerMs: random(15000, 25000)
  })
  agent.xp += 15
  agent.inspiration = min(100, agent.inspiration + 25)
  levelCheck(world, agent)
}
```

### Farm Spawn System

Each farm autonomously produces HQ food blocks on a timer:

| Property | Value |
|----------|-------|
| `spawnsRemaining` | Starts at 10, decremented each time a food block is spawned |
| `spawnTimerMs` | 15,000–25,000ms (randomized per spawn cycle) |
| Spawn location | Random free cell within radius 1 (adjacent cells) |
| Max nearby food | Farm will **not** spawn food if there are already 4 or more food blocks within radius 1 |
| Food type | HQ food (2–4 units) |
| Farm destruction | When `spawnsRemaining` reaches 0, the farm is removed from the grid |

```javascript
function processFarmSpawns(world, dtMs) {
  for (const farm of world.farms.values()) {
    farm.spawnTimerMs -= dtMs
    if (farm.spawnTimerMs <= 0) {
      // Check nearby food count
      const nearbyFood = countFoodBlocksInRadius(world, farm.x, farm.y, 1)
      if (nearbyFood < 4) {
        // Spawn HQ food on adjacent free cell
        spawnHQFood(world, farm.x, farm.y, radius=1)
        farm.spawnsRemaining -= 1
      }
      // Reset timer regardless
      farm.spawnTimerMs = random(15000, 25000)

      if (farm.spawnsRemaining <= 0) {
        world.farms.delete(key(farm.x, farm.y))
      }
    }
  }
}
```

### Resource Flow: Wood to Food Production

The farm system creates a meaningful resource conversion cycle:

```
Wood (harvested from trees)
  → 3 wood consumed by build_farm action
  → Farm placed (🌻)
  → Farm spawns up to 10 HQ food blocks over its lifetime (15–25s intervals)
  → HQ food harvested by agents into inventory
  → Agents eat food to restore fullness
```

This cycle gives wood a strategic purpose beyond inventory filler and creates a renewable food production pipeline that eventually exhausts, encouraging agents to build new farms.

### Strategic Value

- **Resource investment:** Building farms requires forethought (accumulating 3 wood)
- **Finite production:** Each farm has a limited lifespan (10 spawns), creating ongoing demand for new farms
- **Local food abundance:** Farms create food clusters that attract agents
- **Benefits all agents:** Any agent can harvest from any farm's food output
- **Inspiration reward:** The +25 inspiration bonus from building encourages farm construction

## Economy Balance

### Resource Flows

```
Harvest (food block → inventory):
  → +1 food to inventory
  → +2 XP
  → -0.25 energy/sec (HQ: 600ms, LQ: 1200ms)

Eat (from inventory):
  → -1 food from inventory
  → +20 fullness
  → +5 XP
  → No energy cost (300-500ms)

Drink (from inventory):
  → -1 water from inventory
  → +30 hygiene
  → No energy cost (300-500ms)

Harvest Water (water block → inventory):
  → +1 water to inventory
  → +2 XP
  → -0.25 energy/sec (1000ms per unit)

Harvest Wood (tree block → inventory):
  → +1 wood to inventory
  → +2 XP
  → -0.25 energy/sec (1500ms per unit)
  → 10% seedling spawn, 5% LQ food spawn

Share (inventory → target inventory):
  → Transfers food, water, wood to target
  → +5 XP for sharer
  → +8 social for sharer, +5 social for recipient
  → +0.14 relationship
  → -0.4 energy/sec (300-500ms)

Deposit (inventory → flag storage):
  → Transfers resources to faction flag
  → No energy cost (300-500ms)

Withdraw (flag storage → inventory):
  → Transfers resources from faction flag
  → No energy cost (300-500ms)

Pickup (loot bag → inventory):
  → Takes all contents up to inventory cap
  → No energy cost (300-500ms)

Loot Bag Spawn:
  → Agent death: drops full inventory
  → Flag destruction: drops all stored resources
  → 30s decay timer, bags on same cell merge

Sleep Action (8–12s):
  → +8 energy per 500ms tick
  → Total: 128–192 energy restored

Energy Drains:
  - Passive: ~0.25/sec
  - Movement: 0.12/step
  - Actions: 0.2–1.5/sec (halved from v1.3)
  - Harvest (food): 0.25/sec
  - Harvest (water): 0.25/sec
  - Harvest (wood): 0.25/sec
  - Build farm: 0.25/sec over 2000ms (+ 3 wood from inventory)

Clean (poop block → removed):
  → Removes adjacent poop block
  → +10 inspiration
  → -0.25 energy/sec (800-1200ms)

Play (adjacent to interactable block):
  → +15 inspiration
  → -3 hygiene if near poop
  → -0.15 energy/sec (1500-2500ms)

Build Farm (3 wood → farm):
  → -3 wood from inventory
  → Spawns farm (🌻) on adjacent free cell
  → +15 XP, +25 inspiration
  → -0.25 energy/sec (2000ms fixed)
  → Farm produces up to 10 HQ food blocks (15-25s interval)

Inspiration Drains:
  - Passive: -0.015/tick
  - Duration scaling: < 20 → ×1.5 (slower actions); > 70 → ×0.75 (faster actions)

Hygiene Drains:
  - Passive: ~0.02/tick
  - Movement: 0.05/step
  - Social action completion (talk/quarrel/share/heal): 0.5
  - Poop action: 5
  - Stepping on 💩 block: 5/step

Fullness Drains:
  - Passive: ~0.03/tick
  - Movement: 0.08/step
  - Actions: 0.02/sec
```

### Sustainability Calculation

**Minimum eat rate to avoid fullness starvation:**

```
passiveDecay = 0.03/tick (~0.75/sec at 40ms ticks)
movementDecay = 0.08 * stepsPerSec
actionDecay = 0.02/sec

// Assuming 2 steps/sec and minimal actions:
totalDecay = 0.75 + 0.16 + 0.02 = 0.93/sec
eatsNeeded = 0.93 / 20 = 0.047 eats/sec
// One eat every ~21 seconds minimum

// Each eat requires 1 food in inventory, which requires a harvest action:
// HQ harvest: 600ms + eat: ~400ms = ~1s total cycle
// LQ harvest: 1200ms + eat: ~400ms = ~1.6s total cycle
// Agents can sustain themselves with occasional harvests
```

**Energy sustainability via sleep:**
```
passiveDrain = 0.25/sec
movementDrain = 0.12 * 2 = 0.24/sec
totalDrain = 0.49/sec

// Sleep restores ~160 energy over ~10s
// Energy lasts: 160 / 0.49 ≈ 326 seconds between sleeps
// Sleep every ~5.4 minutes
```

### Scarcity Dynamics

| Crops/Agent Ratio | Behavior |
|-------------------|----------|
| < 0.25 | Path budget halved (congestion prevention) |
| < 0.35 | Food field used for seeking |
| 0.35-1.0 | Normal seeking behavior |
| > 1.0 | Abundant, minimal food seeking |

## Leveling (XP-Based)

### XP Sources

| Action | XP Gained |
|--------|-----------|
| Kill | +50 |
| Eat (from inventory) | +5 |
| Heal complete | +10 |
| Share complete | +5 |
| Build farm | +15 |
| Harvest (per unit) | +2 |

### Level-Up Trigger

When accumulated XP exceeds the threshold for the current level:

```javascript
function levelCheck(world, agent) {
  if (agent.level >= 20) return  // Cap

  xpNeeded = agent.level * 50
  if (agent.xp >= xpNeeded):
    agent.xp -= xpNeeded
    agent.level++
    agent.maxHealth += 8
    agent.attack += 1.5
    agent.maxEnergy += 5
}
```

### Level Progression

| Level | Max Health | Attack | Max Energy | XP to Next |
|-------|------------|--------|------------|------------|
| 1 | 100 | 8.0 | 200 | 50 |
| 5 | 132 | 14.0 | 220 | 250 |
| 10 | 172 | 21.5 | 245 | 500 |
| 15 | 212 | 29.0 | 270 | 750 |
| 20 | 252 | 36.5 | 295 | (max) |

**Formula:**
- `maxHealth = 100 + (level - 1) * 8`
- `attack = 8 + (level - 1) * 1.5`
- `maxEnergy = 200 + (level - 1) * 5`
- `xpToNextLevel = level * 50`

### Level Cap

Level 20 is the maximum. Agents at level 20:
- Cannot level up further
- maxEnergy caps at 295
- Have maximum stats (252 HP, 36.5 attack)
