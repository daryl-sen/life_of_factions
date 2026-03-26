# Emoji Life — Technical Specification (v3.2.0, 2026-03-25)

## Purpose

A **zero-player**, real-time 2D sandbox where autonomous agents (“little people”) live on a small grid world, gather **crops**, interact, form **factions**, reproduce, build/destroy **walls**, build **farms**, and fight over **faction spawn points** (flags). The simulation is designed for smooth visual playback, tweakable parameters, and emergent social dynamics.

---

## 1) Core World

### 1.1 Space & Scale

* **Canvas/viewport:** 1000 × 1000 px (visual may letterbox; logic uses grid)
* **Grid:** 62 × 62 **integer cells**
* **Cell size:** 16 × 16 px
* **Coordinate conversions:** px = cell * 16, cell = floor(px/16)
  No sub-cell movement.

### 1.2 Time & Loop

* **Rendering:** requestAnimationFrame (vsync)
* **Simulation tick:** fixed-step accumulator
  Base tick: **40 ms**; effective tick: 40ms / (speed% / 100)
* **Game speed:** 5%–300% (default 50%)
* **Performance target:** visually 30–60 FPS; logic stable under \~200 agents

### 1.3 Game Start

* Simulation does **not** start automatically
* **Config panel** allows adjusting:

  * Starting agents (20–300, default 20)
  * Game speed (%)
  * Crop spawn multiplier (0.1×–5×, default 1.0×)
* Simulation starts only after **Start** button is clicked

---

## 2) Entities & Data Model

### 2.1 Agents

```ts
Agent {
  id: ID
  name: string              // 6-char A–Z0–9
  cellX, cellY: int         // grid coords
  health: float             // 0..maxHealth
  maxHealth: float          // base 100; increases with level (+8/level)
  energy: float             // 0..maxEnergy
  maxEnergy: float          // base 200; +5 per level (level 20 = 295)
  attack: float             // base ~8; increases with level (+1.5/level)
  level: int                // capped at 20
  xp: int                   // current XP toward next level
  ageTicks: int
  starvingSeconds: float
  factionId: string|null
  relationships: Map<agentId, float> // -1..1
  path: Cell[]|null
  pathIdx: int
  lockMsRemaining: float    // movement lock for non-attack interactions

  // Needs system
  fullness: float           // 0..100; passive decay, restored by eating
  hygiene: float            // 0..100; decay from movement/actions/poop, restored by drinking water
  social: float             // 0..100 (placeholder, not active)
  inspiration: float        // 0..100; passive decay −0.015/tick; recovered by play (+15), clean (+10), build farm (+25)

  // Disease system (Phase 5)
  diseased: boolean         // true if agent is currently sick
  poopCooldown: float       // seconds remaining in post-eat poop window (30s after eating)

  // Inventory (Phase 2)
  inventory: {
    food: int               // 0..20 (shared cap)
    water: int              // 0..20 (shared cap)
    wood: int               // 0..20 (shared cap)
  }                         // Total units across all types capped at 20

  action: null | {
    type: 'talk'|'quarrel'|'attack'|'under_attack'|'heal'|'share'|'attack_wall'|'attack_flag'|'reproduce'|'sleep'|'harvest'|'harvest_water'|'harvest_wood'|'eat'|'drink'|'deposit'|'withdraw'|'pickup'|'poop'|'clean'|'play'|'build_farm'
    remainingMs: float
    tickCounterMs: float
    payload?: { targetId?: ID, ... }
  }
}
```


### 2.2 Terrain & Objects

* **Wall**: destructible, blocks movement
* **Food block (HQ)**: high-quality food from farms; emojis 🥔🍎🍑🌽🍅; 2–4 units; passable; depletes when all units harvested
* **Food block (LQ)**: low-quality food from nature/world-gen; emojis 🌿🥬🥦🍀; 1–2 units; passable; depletes when all units harvested
* **Farm**: spawns HQ food in radius 1; blocks movement; agents **build** farms via explicit build_farm action (3 wood + 6 energy); tracks spawnsRemaining (max 10) and spawnTimerMs (15–25s interval); destroyed when spawns exhausted
* **FlagSpawn**: faction spawn point, destructible, blocks movement
* **Water block (small)**: 1-cell, impassable, 5 units; emojis based on size; harvest 1 unit per 1000ms
* **Water block (large)**: 2×2 cells, impassable, 20 units (single entity); shrinks to small water block at 25% threshold (≤5 units). Harvest 1 unit per 1000ms
* **Tree block**: 1-cell, impassable, 3–6 units; random emoji from 🌲🌳🌴🎄; harvest 1 unit (wood) per 1500ms
* **Seedling**: 🌱, 1-cell, passable, protected from other block spawns; grows into a tree in 45–90 seconds
* **Poop block**: 💩, 1-cell, passable, −5 hygiene per step through it, decays after 30 seconds; will not spawn on interactable blocks

---

## 3) Mechanics

### 3.1 Movement & Pathfinding

* Grid movement: 4-connected (N/E/S/W)
* Pathfinding: A\* with Manhattan heuristic
* Impassable: walls, farms, flags, agents (except self), water blocks, trees
* If blocked mid-path: drop path and replan later
* **Move-first, plan-second order** per tick:

  * Agents advance along any existing path before planning a new one
  * Prevents path reset loops when adjacent to crops
* **Movement locks:** while performing **non-attack** interactions (talk/heal/share/reproduce), participants are **locked** in place; lock is ignored if the agent is being **attacked** (they may move to escape)

### 3.2 Energy, Fullness & Needs

#### Energy

Energy is restored **only** via the **sleep** action (not eating). Per-agent `maxEnergy` starts at 200, +5 per level (level 20 = 295).

* **Passive drain:** 0.0625/tick (~0.25/sec)
* **Movement drain:** 0.12/cell
* **Mandatory sleep:** energy < 20
* **Voluntary sleep:** energy < 40
* Starvation is **not** triggered by energy = 0 (moved to fullness system)
* Health regen is **not** tied to energy (moved to fullness system)

#### Fullness (0–100)

Fullness is a new survival resource. Eating crops restores fullness (not energy).

* **Starting value:** 100
* **Passive decay:** −0.03/tick
* **Movement decay:** −0.08/cell
* **Action decay:** −0.02/sec during any action
* **Recovery:** eating a crop → +20 fullness
* **Starvation:** fullness = 0 → −1 HP/sec
* **Health regen:** fullness > 90 → +0.5 HP/sec
* **Proactive food seeking:** fullness < 40

#### Hygiene (0–100)

Hygiene is a survival need restored by drinking water from inventory. In Phase 5, hygiene gains additional decay sources and drives the disease system.

* **Starting value:** 100
* **Passive decay:** −0.02/tick
* **Movement decay:** −0.05/cell
* **Social action decay:** −0.5 on completion of talk, quarrel, share, or heal
* **Poop action decay:** −5 on poop action completion
* **Stepping on poop block:** −5 per step through a 💩 block
* **Recovery:** drinking water from inventory → +30 hygiene
* **Proactive water seeking:** hygiene < 40 (decision priority 7b)
* **Critical water seeking:** hygiene < 20 (decision priority 5)
* **Water seeking behavior:** drink from inventory first; if no water in inventory, harvest adjacent water block; if none adjacent, pathfind to nearest water block

#### Disease System (Phase 5)

Disease is a condition caused by low hygiene that drains health and energy at an accelerated rate.

* **Contraction:** when hygiene < 20, 5% chance per tick to become diseased
* **Spread:** diseased agents spread disease to adjacent agents at 3% per tick; blocked if target's hygiene > 60
* **Effects:**
  * Emoji: 🤢
  * Energy drain: 2× normal passive energy drain (0.125/tick instead of 0.0625/tick)
  * Health drain: −0.5 HP/sec
  * Disease can kill (health reaches 0)
* **Cure:** heal action from another agent, or hygiene recovers above 80

#### Inspiration System (Phase 6)

Inspiration is a need that affects action efficiency. It decays passively and is recovered through play, cleaning, and building farms.

* **Starting value:** 50
* **Range:** 0–100
* **Passive decay:** −0.015/tick
* **Recovery sources:**
  * Play action: +15
  * Clean action: +10
  * Build farm action: +25
* **Seek threshold:** inspiration < 40 → agent seeks play or clean poop (decision priority 7c)

**Inspiration duration scaling:** At action creation time, the base duration of an action is scaled by the agent's current inspiration level:
* Inspiration < 20: duration multiplied by **1.5** (sluggish, uninspired)
* Inspiration > 70: duration multiplied by **0.75** (efficient, inspired)
* Inspiration 20–70: no scaling (normal)

This scaling is applied once when the action is created, not continuously during the action.

#### Placeholder Needs

* **Social:** starts 50 (tracked on agents but no gameplay effect)

### 3.3 Resources & Inventory

#### Inventory System (Phase 2)

Agents carry resources in a personal inventory:

* **Capacity:** 20 total units across all resource types (food + water + wood)
* **Starting inventory:** empty (0 of each)
* **Resource types:** food, water, wood (food is fungible once harvested — no HQ/LQ distinction in inventory)
* When inventory is full, harvest actions are blocked

#### Food Blocks

Food exists as blocks on the grid with a unit count. Two quality tiers affect harvest speed and yield, but once in inventory all food is identical.

| Property | High Quality (HQ) | Low Quality (LQ) |
|----------|-------------------|-------------------|
| Emojis | 🥔🍎🍑🌽🍅 | 🌿🥬🥦🍀 |
| Source | Farms only | Nature (world-gen near trees) |
| Units per block | 2–4 | 1–2 |
| Harvest time per unit | 600ms | 1200ms |
| Passable | Yes | Yes |
| Depletion | Block removed when 0 units remain | Block removed when 0 units remain |

**Random food spawning is removed.** Food comes only from farms, world-gen, and tree passive/harvest spawns.

**World-gen food:** 5–10 LQ food blocks scattered near trees at world creation, providing initial food.

**Instant-consume on step is removed.** Agents must harvest food into inventory, then eat from inventory.

#### Water Blocks (Phase 3)

Water exists as blocks on the grid that agents harvest for drinking water.

| Property | Small | Large |
|----------|-------|-------|
| Size | 1 cell | 2×2 cells (single entity) |
| Units | 5 | 20 |
| Passable | No | No |
| Harvest time per unit | 1000ms | 1000ms |
| Shrinking | N/A | Shrinks to small at 25% threshold (≤5 units) |
| Depletion | Block removed when 0 units remain | Becomes small water block at ≤5 units |

**World-gen water:** 3–6 water sources placed at world creation (mix of small and large).

**Cloud/rain system:** Clouds spawn periodically to replenish water on the map.

| Property | Value |
|----------|-------|
| Cloud spawn rate | 1 cloud every 60–120 seconds |
| Cloud duration | 5–10 seconds |
| Cloud emoji | 🌧️ |
| Rain spawn | Spawns water blocks below the cloud |
| Water type odds | 90% small (1-cell, 5 units), 10% large (2×2, 20 units) |

#### Tree Blocks (Phase 3)

Trees are a source of wood and contribute to the food economy through passive spawning.

| Property | Value |
|----------|-------|
| Size | 1 cell |
| Units | 3–6 (wood) |
| Passable | No |
| Emojis | 🌲🌳🌴🎄 (random) |
| Harvest time per unit | 1500ms |
| Depletion | Block removed when 0 units remain |

**World-gen trees:** 8–15 trees placed at world creation.

**Seedling mechanic:** When a tree is harvested, there is a 10% chance per harvest to spawn a seedling (🌱) on an adjacent cell. Additionally, each tree has a 2% passive chance per tick to spawn a seedling. Seedlings are passable and protected from other block spawns. A seedling grows into a full tree in 45–90 seconds.

**Tree food spawning:** When a tree is harvested, there is a 5% chance (instead of seedling) to spawn 1 LQ food block within a 3-cell radius. Additionally, each tree has a 1% passive chance per tick to spawn LQ food in a 3-cell radius.

#### Water Harvest Action (Phase 3)

| Property | Value |
|----------|-------|
| Target | Adjacent water block (distance = 1) |
| Duration | 1000ms per unit |
| Energy cost | 0.25 energy/sec |
| Effect | Transfers 1 unit from water block to agent inventory (water) |
| XP | +2 per harvest |
| Emoji | 🫨 |
| Blocked when | Inventory is full |

#### Wood Harvest Action (Phase 3)

| Property | Value |
|----------|-------|
| Target | Adjacent tree block (distance = 1) |
| Duration | 1500ms per unit |
| Energy cost | 0.25 energy/sec |
| Effect | Transfers 1 unit from tree block to agent inventory (wood) |
| XP | +2 per harvest |
| Emoji | 🫨 |
| Blocked when | Inventory is full |
| Side effects | 10% chance to spawn seedling on adjacent cell; 5% chance to spawn LQ food within 3-cell radius (mutually exclusive with seedling) |

**Wood harvesting behavior:** Agents harvest wood opportunistically when passing near trees, rather than actively seeking them out. Wood harvesting is a low-priority action attempted when agents are adjacent to a tree and have inventory space.

#### Farms (Reworked in Phase 6)

* **Farm emoji:** 🌻
* **Blocks movement:** Yes
* **Build cost:** 3 wood + 6 energy (explicit build_farm action)
* **Build duration:** 2000ms fixed
* **Build energy cost:** 0.25 energy/sec
* **Build rewards:** +15 XP, +25 inspiration
* **Spawn system:** each farm tracks `spawnsRemaining` (starts at 10) and `spawnTimerMs` (15–25 second interval between spawns)
* **Spawn radius:** 1 cell (adjacent cells only)
* **Max nearby food:** a farm will not spawn food if there are already 4 or more food blocks within radius 1
* **Farm destruction:** when `spawnsRemaining` reaches 0, the farm is removed from the grid
* **Replaces** the old random-chance farm building mechanic (no more random % per tick)

#### Harvest Action

| Property | Value |
|----------|-------|
| Target | Adjacent resource block (distance = 1) |
| Duration | HQ food: 600ms; LQ food: 1200ms; Water: 1000ms; Wood: 1500ms |
| Energy cost | 0.25 energy/sec |
| Effect | Transfers 1 unit from resource block to agent inventory (food/water/wood) |
| XP | +2 per harvest |
| Emoji | 🫨 |
| Blocked when | Inventory is full |

#### Eat Action (from inventory)

| Property | Value |
|----------|-------|
| Duration | 300–500ms |
| Energy cost | None |
| Effect | -1 food from inventory, +20 fullness, +5 XP |
| Emoji | 🤔 |

#### Drink Action (from inventory)

| Property | Value |
|----------|-------|
| Duration | 300–500ms |
| Energy cost | None |
| Effect | -1 water from inventory, +30 hygiene |
| Emoji | 🤔 |
| Note | Requires water in inventory (water blocks added in Phase 3) |

#### Share Action (Phase 4 — replaces "help")

The former "help" action is renamed to "share." Instead of transferring energy, it transfers inventory resources (food, water, wood) from sharer to target.

| Property | Value |
|----------|-------|
| Duration | 300–500ms |
| Energy cost | 0.4/sec |
| Effect | Transfers inventory resources (food, water, wood) from sharer to target |
| XP | +5 for sharer |
| Social | +8 social for sharer, +5 social for recipient |
| Relationship | +0.14 for both agents |
| Emoji | (inherited from former help action) |
| Faction recruitment | 50% chance to recruit target if relationship ≥ 0.4 (preserved from help) |

#### Deposit Action (Phase 4)

| Property | Value |
|----------|-------|
| Target | Own faction flag (adjacent, distance = 1) |
| Duration | 300–500ms |
| Energy cost | None |
| Effect | Transfers resources from agent inventory to flag storage |
| Trigger | Opportunistic: agent near own flag with inventory ≥ 3 |

#### Withdraw Action (Phase 4)

| Property | Value |
|----------|-------|
| Target | Own faction flag (adjacent, distance = 1) |
| Duration | 300–500ms |
| Energy cost | None |
| Effect | Transfers resources from flag storage to agent inventory |
| Trigger | Agent needs food/water and is near own flag with stored resources |

#### Pickup Action (Phase 4)

| Property | Value |
|----------|-------|
| Target | Loot bag on agent's cell or adjacent cell |
| Duration | 300–500ms |
| Energy cost | None |
| Effect | Takes all contents from loot bag up to agent's inventory cap |

#### Poop Action (Phase 5)

| Property | Value |
|----------|-------|
| Duration | 500–1000ms |
| Energy cost | None |
| Effect | Spawns 💩 block on agent's cell, −5 hygiene |
| Trigger | 10% chance per tick for 30 seconds after eating, only when idle (no current action) |
| Spawn rules | Will not spawn on interactable blocks (food, water, trees, farms, flags, walls, seedlings) |

**Poop cooldown:** After an agent completes the eat action, a 30-second poop window begins. During this window, each tick has a 10% chance of triggering the poop action (only if the agent is idle).

#### Clean Action (Phase 5)

| Property | Value |
|----------|-------|
| Target | Adjacent poop block (distance = 1) |
| Duration | 800–1200ms |
| Energy cost | 0.25/sec |
| Effect | Removes adjacent poop block, +10 inspiration |

#### Play Action (Phase 6)

| Property | Value |
|----------|-------|
| Duration | 1500–2500ms |
| Energy cost | 0.15/sec |
| Target | Adjacent interactable block (food, water, tree, farm, poop, seedling, or flag) |
| Effect | +15 inspiration |
| Hygiene penalty | −3 hygiene if adjacent to a poop block during play |
| Emoji | 🤪 |
| Trigger | Inspiration < 40 (decision priority 7c) |

#### Build Farm Action (Phase 6)

| Property | Value |
|----------|-------|
| Duration | 2000ms (fixed) |
| Energy cost | 0.25/sec |
| Resource cost | 3 wood from inventory |
| Energy requirement | 6 energy minimum |
| Effect | Spawns farm (🌻) on adjacent free cell, +15 XP, +25 inspiration |
| Replaces | Old random-chance farm building mechanic |

**Build farm replaces the previous farm building system.** Agents no longer build farms via random chance when well-fed. Instead, agents must have 3 wood in inventory and 6 energy to initiate the explicit build_farm action.

#### Poop Blocks (Phase 5)

💩 blocks are passable terrain hazards spawned by the poop action.

| Property | Value |
|----------|-------|
| Emoji | 💩 |
| Passable | Yes |
| Hygiene penalty | −5 per step through the block |
| Decay timer | 30 seconds (removed from grid on expiry) |
| Spawn rules | Will not spawn on cells with interactable blocks (food, water, trees, farms, flags, walls, seedlings) |
| Stacking | No stacking — only one poop block per cell |

#### Loot Bags (Phase 4)

Loot bags (👝) are temporary resource containers that spawn on the grid.

| Property | Value |
|----------|-------|
| Emoji | 👝 |
| Passable | Yes |
| Decay timer | 30 seconds with fade effect |
| Spawn triggers | Agent death (agent's full inventory), flag destruction (all stored resources) |
| Pickup | Any agent can pick up (300–500ms action, takes all contents up to inventory cap) |
| Merging | Multiple bags on the same cell merge; merge resets decay timer |

#### Faction Flag Storage (Phase 4)

Faction flags now store resources for the faction.

| Property | Value |
|----------|-------|
| Storage capacity | 30 per resource type (food, water, wood) |
| Deposit | Agent adjacent to own flag with ≥ 3 inventory items (300–500ms action, no energy cost) |
| Withdraw | Agent adjacent to own flag, needing resources, flag has stored resources (300–500ms action, no energy cost) |
| On flag destruction | All stored resources drop as a loot bag at the flag's location |

### 3.4 Interactions

* All **non-attack** interactions require **adjacency** (Manhattan distance = 1) and **lock** both agents for the duration.
* **Attack**:

  * **Range:** Manhattan distance ≤ **2**
  * Does **not** lock the target; targets remain free to move
  * Shorter action window; ticks faster (see 3.10)
* Action cancellation if distance rule no longer satisfied (e.g., partner walked away or attacker out of range).

### 3.5 Factions

* Formed via union-find on relationship graph when relationship ≥ threshold
* Each faction has:

  * Unique color (also applied to its flag)
  * Member set
* Flags heal nearby members (aura), can be destroyed
* **Flag storage (Phase 4):** flags store resources (30 per type: food, water, wood). Agents deposit and withdraw resources when near their flag. On flag destruction, all stored resources drop as a loot bag.

### 3.6 Building & Destruction

* **Build Wall:** chance each tick; blocks movement; destructible
* **Build Farm (reworked Phase 6):**

  * Explicit `build_farm` action (2000ms, 0.25 energy/sec)
  * Requires **3 wood** in inventory + **6 energy**
  * Placed on an adjacent free cell; blocks movement
  * Grants +15 XP, +25 inspiration
  * Farm spawns HQ food in radius 1 (max 10 spawns, 15–25s interval, max 4 nearby food)
  * Farm destroyed when all spawns exhausted
* Walls and flags destructible

### 3.7 Reproduction

* Requires adjacency, sufficient energy, and time
* **Behavioral priority:** reproduction is attempted **before** other interactions
* Upfront small energy **reserve** is consumed to commit; additional **finishing cost** on success
* Spawns child in adjacent free cell

### 3.8 Leveling (XP-Based)

* Triggered by accumulating XP (replaces energy-surplus leveling)
* **XP sources:** kill +50, eat (from inventory) +5, heal complete +10, share complete +5, build farm +15 (Phase 6: explicit action), harvest (per unit) +2
* **Level curve:** level × 50 XP required per level
* **Level-up effects:** maxHealth += 8, attack += 1.5, maxEnergy += 5
* **Level cap:** **20**

### 3.9 Health, Fullness, Starvation

* Health decays slowly over time
* Movement costs energy and fullness
* **Starvation:** triggered by fullness = 0 (not energy = 0); deals −1 HP/sec
* **Health regen:** fullness > 90 → +0.5 HP/sec
* Flags apply heal aura within radius

### 3.10 Action System (durations, costs, distance rules)

* **Base durations** (randomized per action):

  * talk/quarrel/heal: **0.9–1.8s**
  * **share:** **300–500ms** (formerly "help")
  * **attack:** **0.45–0.9s** (faster)
  * reproduce: **2.0–3.2s**
  * **sleep:** **8–12s**
  * **harvest:** HQ food 600ms, LQ food 1200ms, water 1000ms, wood 1500ms
  * **eat/drink:** **300–500ms**
  * **deposit/withdraw/pickup:** **300–500ms**
  * **poop:** **500–1000ms**
  * **clean:** **800–1200ms**
  * **play:** **1500–2500ms**
  * **build_farm:** **2000ms** (fixed)
* **Inspiration duration scaling (Phase 6):** at action creation time, inspiration < 20 → duration ×1.5; inspiration > 70 → duration ×0.75
* **Distance rules:**

  * Non-attack actions: distance **=1**
  * Attack: distance **≤2**
  * Sleep, eat, drink, poop: no target (solo/self actions)
  * Harvest: adjacent to resource block (distance **=1**; applies to food, water, and tree blocks)
  * Clean: adjacent to poop block (distance **=1**)
  * Deposit/withdraw: adjacent to own faction flag (distance **=1**)
  * Pickup: on loot bag cell or adjacent
* **Tick cadence:** effects apply roughly every **0.5s** during actions
* **Per-second energy costs** (approx., halved from v1.3): talk 0.2, quarrel 0.4, **attack 1.1**, heal 1.5, **share 0.4**, attack\_wall 0.75, attack\_flag 1.0, **reproduce 1.5**, **harvest 0.25**
* **Zero-cost actions:** eat, drink, deposit, withdraw, pickup, poop
* **Clean:** 0.25 energy/sec
* **Play:** 0.15 energy/sec
* **Build farm:** 0.25 energy/sec (also costs 3 wood from inventory)
* **Sleep:** restores +8 energy per 500ms tick (total 128–192 energy over full duration); mandatory at energy < 20, voluntary at energy < 40; interruptible by attack; emoji 😴
* **Damage:** base 8; attack deals periodic damage scaled by level

---

## 4) User Interface

### 4.1 Controls

* **Start/Pause/Resume**
* Input fields for:

  * Starting agents
  * Speed (%)
  * Crop spawn multiplier
* **Spawn Crop** button (respects crop cap)

### 4.2 Stats

* Counts for: Agents, Factions, Crops, Farms, Walls, Flags

### 4.3 Inspector

* Click agent to see:

  * Name, Faction, Level (cap 20), Attack, HP, Energy, Age (ticks), #Relationships
  * Current Action & Remaining time

### 4.4 Event Log

* Filterable by action type (select all/none)
* Logs: interactions, reproduction, faction changes, builds (wall/farm), destruction, crop spawns, deaths, level-ups

### 4.5 Factions Panel

* Lists: ID, member count, avg level, flag status, color

### 4.6 Visuals

* Agents: **circle** with faction-colored border, HP bar, low-energy glyph
* Crops: **triangle**
* Farms: **yellow square**
* Walls: block with damage tint
* Flags: colored banner matching faction

### 4.7 Layout/Overflow

* Factions and logs lists are height-capped and scrollable; long IDs wrap to avoid overflow.

---

## 5) Balancing (defaults)

**Economy & thresholds**

* Move cost: **0.12** energy / step, **0.08** fullness / step
* Eat (from inventory): **+20 fullness**, +5 XP (no longer gives energy)
* Drink (from inventory): **+30 hygiene** (requires water from water blocks)
* **Mandatory sleep threshold:** energy < 20
* **Voluntary sleep threshold:** energy < 40
* **Proactive food seeking:** fullness < 40
* **Urgent food seeking:** fullness < 20
* **Proactive water seeking:** hygiene < 40
* **Critical water seeking:** hygiene < 20
* Starvation: fullness = 0 → −1 HP/sec

**Actions (energy/sec) — halved from v1.3**

* talk 0.2, quarrel 0.4, **attack 1.1**, heal 1.5, **share 0.4**, attack\_wall 0.75, attack\_flag 1.0, **reproduce 1.5**

**Action durations**

* talk/quarrel/heal: **0.9–1.8s**
* **share:** **300–500ms** (formerly "help")
* **attack:** **0.45–0.9s**
* reproduce: **2.0–3.2s**
* **sleep:** **8–12s** (restores +8 energy per 500ms tick)
* **harvest:** HQ food 600ms, LQ food 1200ms, water 1000ms, wood 1500ms
* **eat/drink:** **300–500ms**
* **deposit/withdraw/pickup:** **300–500ms** (no energy cost)
* **poop:** **500–1000ms** (no energy cost)
* **clean:** **800–1200ms** (0.25 energy/sec)
* **play:** **1500–2500ms** (0.15 energy/sec)
* **build_farm:** **2000ms** fixed (0.25 energy/sec, also costs 3 wood)

**Inspiration (Phase 6)**

* Passive decay: −0.015/tick
* Recovery: play +15, clean +10, build farm +25
* Seek threshold: < 40 → seek play or clean poop
* Duration scaling: < 20 → ×1.5; > 70 → ×0.75 (applied at action creation)

**Hygiene decay sources (Phase 5)**

* Passive: −0.02/tick
* Movement: −0.05/cell
* Social action completion (talk, quarrel, share, heal): −0.5
* Poop action: −5
* Stepping on 💩 block: −5/step

**Disease (Phase 5)**

* Contraction: hygiene < 20 → 5% chance/tick
* Spread: 3%/tick to adjacent agents (blocked if target hygiene > 60)
* Effects: 2× energy drain, −0.5 HP/sec, 🤢 emoji
* Cure: heal from another agent, or hygiene > 80

**Combat & leveling (XP-based)**

* Base damage/tick: 8 (scales with level)
* Level-up trigger: accumulate level × 50 XP
* XP sources: kill +50, eat +5, heal complete +10, share complete +5, build farm +15, harvest +2
* Level-up effects: +8 max HP, +1.5 attack, +5 maxEnergy
* **Level cap:** **20**

**World objects**

* Wall HP: 10–15
* Flag HP: 12–18
* **Build farm cost:** **3 wood + 6 energy** (explicit action, 2000ms, 0.25 energy/sec)
* **Build farm rewards:** +15 XP, +25 inspiration
* **Farm spawn limit:** 10 spawns per farm (farm destroyed when exhausted)
* **Farm spawn interval:** 15–25 seconds between food spawns
* **Farm spawn radius:** 1 cell (max 4 food blocks within radius 1)
* **Food blocks:** HQ from farms (2–4 units), LQ from world-gen and tree spawns (1–2 units)
* **Water blocks:** small (1-cell, 5 units), large (2×2, 20 units); large shrinks to small at ≤5 units
* **Tree blocks:** 1-cell, 3–6 wood units; 🌲🌳🌴🎄
* **Seedling growth time:** 45–90 seconds
* **Cloud spawn rate:** 1 every 60–120 seconds, persists 5–10 seconds
* **World-gen water sources:** 3–6
* **World-gen trees:** 8–15
* **Inventory cap:** **20** total units (food + water + wood)

**Factions**

* Formation threshold: 0.5, min size 2
* Heal aura radius: 4 (+0.6 HP/tick)

---

## 6) Simulation Order (per logic tick)

1. Attempt crop spawns (farm-biased, stop at global crop cap)
1b. Process cloud/rain system (spawn clouds on timer, rain spawns water blocks; 90% small, 10% large)
1c. Process seedling growth (seedlings that have reached maturity grow into trees)
1d. Process tree passive effects (2% per tick seedling spawn chance; 1% per tick LQ food spawn in 3-cell radius)
1e. Process poop block decay (remove blocks whose 30s timer has expired)
2. Compute “under attack” set for this tick (for lock exceptions)
3. For each agent:

   * Age & passive health decay
   * Passive fullness decay (−0.03/tick)
   * Passive hygiene decay (−0.02/tick)
   * Passive energy drain (−0.0625/tick)
   * Decrement movement **lock** time
   * **Decision priority:**
     1. Energy < 20 → mandatory sleep
     2. Under attack → flee/retaliate
     3. Health < 30% maxHP → seek faction flag
     4. Fullness < 20 → urgent food seeking: eat from inventory first; if no food in inventory, harvest adjacent food block; if none adjacent, pathfind to nearest food block
     5. Hygiene < 20 → critical water seeking: drink from inventory first; if no water in inventory, harvest adjacent water block; if none adjacent, pathfind to nearest water block
     6. Energy < 40 → voluntary sleep
     7. Normal state:
        a. Fullness < 40 → proactive food seeking (same eat/harvest/pathfind priority as above); withdraw from own flag if nearby and flag has food
        b. Hygiene < 40 → proactive water seeking (same drink/harvest/pathfind priority as water seeking above); withdraw from own flag if nearby and flag has water
        c. Inspiration < 40 → seek play (adjacent to interactable block) or clean poop block
        c2. Poop check: if in poop cooldown window (30s after eating), 10% chance per tick to poop (only when idle)
        d. Deposit resources to own faction flag (opportunistic: near own flag with inventory ≥ 3)
        e. Harvest nearby resources (if inventory not full and adjacent to resource block; wood harvesting is opportunistic)
        f. Pickup loot bags (before roaming)
        g. Clean adjacent poop block (opportunistic)
        h. Reproduction, attack, share/heal/talk
        i. Roam
   * If acting: process action (distance rules; energy drain; effects)
   * If not acting:

     * If **not locked** (or locked but being attacked):
       **Move-first**: walk one path step
       **Plan-second**: if no path, follow decision priority above
     * Consider interactions (reproduce first, then social, then combat with range 2)
     * Try building (wall or farm; farm consumes energy)
   * Disease check: if hygiene < 20, 5% chance to contract disease; if diseased, apply 2× energy drain and −0.5 HP/sec; if hygiene > 80, cure disease
   * Disease spread: diseased agents spread to adjacent agents at 3% per tick (blocked if target hygiene > 60)
   * Poop cooldown tick: decrement post-eat poop timer
   * Starvation death check (fullness = 0 → −1 HP/sec)
   * XP-based level-up check (respect level cap)
4. Recompute factions on interval (with union-find)
5. Apply flag healing aura
6. Remove destroyed objects / dead agents
7. Update UI (stats, lists, inspector, logs)

---

## 7) Non-Functional

* Modular, commented code
* Smooth performance with \~200 agents
* Adjustable constants (TUNE & durations)
* Browser-based implementation; single HTML file

---

## 8) Debug/Telemetry

* Stats overlay (tick, fps, agent count)
* Path debug via inspector (selected agent)
* Performance counters
* Ring buffer event log with filters
* Optional log export (future)

---

## 9) Acceptance Criteria

1. **Start** button initializes world; **Pause/Resume** work.
2. **Crop cap**: total concurrent crops never exceeds **150** (Spawn Crop button respects this).
3. **Interactions lock**: during talk/heal/share/reproduce, agents do **not move**; if they’re **attacked**, they may move despite being locked.
4. **Attack range & speed**: agents can attack targets at Manhattan distance **≤2**; attack completes in **≤0.9s**.
5. **Adjacency rule**: all non-attack actions (including reproduction) only occur at **distance = 1**; actions cancel if distance rule is violated.
6. **Reproduction**: occurs noticeably over long runs (under default settings); upfront commitment and finishing energy costs are deducted from parents.
7. **Farm building**: agents occasionally **build farms** on adjacent cells when well-fed, consuming **12 energy**; farms block movement and increase local crop spawns.
8. **Fullness-driven food seeking**: agents with fullness < 40 proactively seek crops; fullness < 20 triggers urgent food seeking. Eating crops restores +20 fullness (not energy).
9. **Level cap**: agent level never exceeds **20**; leveling is XP-based and grants +8 maxHP, +1.5 attack, +5 maxEnergy.
10. **Sleep action**: agents sleep when energy < 20 (mandatory) or < 40 (voluntary); sleep lasts 8–12s and restores +8 energy per 500ms tick; interruptible by attack.
10. **Faction visuals**: flags use faction colors; faction list shows ID, members, avg level, and flag status.
11. **UI overflow**: factions list and log are scrollable and do not overflow their containers.
12. **Inventory system** (Phase 2): agents have a 20-unit shared inventory for food, water, and wood. Harvest is blocked when inventory is full.
13. **Food blocks** (Phase 2): food exists as grid blocks with unit counts; HQ food (from farms) harvests in 600ms, LQ food (from world-gen) harvests in 1200ms. Blocks deplete when all units are harvested.
14. **Harvest/eat/drink actions** (Phase 2): harvest transfers 1 unit to inventory (🫨); eat consumes 1 food for +20 fullness and +5 XP (🤔); drink consumes 1 water for +30 hygiene (🤔).
15. **No random food spawning** (Phase 2): food comes only from farms (HQ) and world-gen (LQ near trees). Stepping on food no longer auto-consumes.
16. **Water blocks** (Phase 3): small (1-cell, 5 units) and large (2×2, 20 units) water sources. Large blocks shrink to small at 25% threshold. Harvested at 1000ms per unit.
17. **Tree blocks** (Phase 3): 1-cell blocks with 3–6 wood units (🌲🌳🌴🎄). Harvested at 1500ms per unit. Spawn seedlings (10% on harvest, 2% passive) and LQ food (5% on harvest, 1% passive).
18. **Seedlings** (Phase 3): 🌱 passable blocks that grow into trees in 45–90 seconds. Protected from other block spawns.
19. **Cloud/rain system** (Phase 3): clouds (🌧️) spawn every 60–120 seconds, persist 5–10 seconds, and rain water blocks (90% small, 10% large).
20. **Hygiene system activated** (Phase 3): hygiene decays at −0.02/tick, restored by drinking water (+30). Critical water seeking at hygiene < 20, proactive at < 40.
21. **Wood harvesting** (Phase 3): opportunistic harvesting when agents pass near trees. 1500ms per unit, adds wood to inventory.
22. **World-gen updated** (Phase 3): 3–6 water sources and 8–15 trees placed at world creation.
23. **Share action** (Phase 4): the former "help" action is renamed to "share" and transfers inventory resources (food, water, wood) instead of energy. Duration 300–500ms, cost 0.4/sec, +5 XP, +8 social for sharer, +5 social for recipient, +0.14 relationship. Faction recruitment preserved (50% at rel >= 0.4).
24. **Faction flag storage** (Phase 4): flags store up to 30 of each resource type (food, water, wood). Agents deposit when near own flag with >= 3 inventory (300–500ms, no energy cost). Agents withdraw when needing resources and near own flag with stored resources (300–500ms, no energy cost). On flag destruction, all stored resources drop as a loot bag.
25. **Loot bags** (Phase 4): 👝 emoji, passable, 30s decay timer with fade effect. Spawn on agent death (agent's full inventory) and on flag destruction (stored resources). Any agent can pick up (300–500ms, takes all contents up to inventory cap). Multiple bags on same cell merge; merge resets decay timer.
26. **Deposit/withdraw/pickup actions** (Phase 4): deposit (300–500ms, no energy cost), withdraw (300–500ms, no energy cost), pickup (300–500ms, no energy cost).
27. **Decision priority updated** (Phase 4): deposit is opportunistic (near own flag with inventory >= 3). Withdraw when needing food/water and near own flag with stored resources. Pickup loot bags checked before roaming.
28. **Hygiene decay expanded** (Phase 5): hygiene decays from movement (−0.05/cell), social action completion (−0.5 for talk/quarrel/share/heal), and poop action (−5), in addition to passive decay.
29. **Poop system** (Phase 5): 10% chance per tick for 30s after eating (only when idle) to trigger poop action (500–1000ms). Spawns 💩 block (passable, −5 hygiene per step, 30s decay, no spawn on interactable blocks).
30. **Clean action** (Phase 5): 800–1200ms, 0.25 energy/sec, removes adjacent poop block, +10 inspiration.
31. **Disease system** (Phase 5): hygiene < 20 → 5% chance/tick to contract disease. Diseased agents show 🤢, suffer 2× energy drain and −0.5 HP/sec (can kill). Spread at 3%/tick to adjacent agents (blocked if target hygiene > 60). Cured by heal action from another agent or hygiene recovering above 80.
32. **Heal cures disease** (Phase 5): the heal action now also cures disease on the target agent.
33. **Inspiration system** (Phase 6): inspiration decays passively at −0.015/tick. Recovered by play (+15), clean (+10), and build farm (+25). When inspiration < 40, agents seek play or clean poop. Duration scaling: < 20 → ×1.5 (slower), > 70 → ×0.75 (faster), applied at action creation.
34. **Play action** (Phase 6): 1500–2500ms, 0.15 energy/sec, requires adjacency to an interactable block (food, water, tree, farm, poop, seedling, or flag). Grants +15 inspiration. −3 hygiene if near poop. Emoji: 🤪.
35. **Build farm reworked** (Phase 6): explicit build_farm action (2000ms, 0.25 energy/sec) requiring 3 wood + 6 energy. Grants +15 XP, +25 inspiration. Replaces old random-chance farm building.
36. **Farm spawn system** (Phase 6): farms track spawnsRemaining (max 10) and spawnTimerMs (15–25s interval). Max 4 food blocks within radius 1. Farm destroyed when spawns exhausted.
37. **Decision priority updated** (Phase 6): inspiration < 40 added at priority 7c (seek play or clean poop). Poop check moved to 7c2.

---

## 10) Notable Changes Since v2

* **Interaction locks** added (freeze movement during non-attack interactions; escape allowed if attacked).
* **Attack** is **faster** and **range-2**.
* **Farm construction** by agents (energy-consuming).
* **Global crop cap** (**150**).
* **Level cap** (**20**).
* UI lists made scrollable to prevent overflow.

### Phase 1 Changes (v1.4.0)

* **Fullness system** added (0–100): eating restores fullness, not energy. Starvation and health regen moved from energy to fullness.
* **Sleep action** added: only way to recover energy. Mandatory at energy < 20, voluntary at < 40.
* **XP-based leveling** replaces energy-surplus leveling. Multiple XP sources (kill, eat, heal, share, build, harvest).
* **maxEnergy is per-agent:** starts 200, +5 per level.
* **Action energy costs halved** across the board.
* **Needs system scaffolding:** hygiene, social, inspiration fields added (placeholder, not active).
* **Decision hierarchy rewritten** with sleep, fullness-based food seeking, and health-based flag seeking.

### Phase 2 Changes (v3.2.0)

* **Inventory system** added: agents carry food, water, and wood with a shared 20-unit cap.
* **Food blocks reworked** with unit tracking and two quality tiers: HQ (from farms, 2–4 units, 600ms harvest) and LQ (from nature/world-gen, 1–2 units, 1200ms harvest). Food is fungible once in inventory.
* **Harvest action** added (🫨): adjacent to food block, transfers 1 unit to inventory, costs 0.25 energy/sec, grants +2 XP. Food blocks deplete when all units harvested.
* **Eat action** added (🤔): consumes 1 food from inventory, +20 fullness, +5 XP, no energy cost.
* **Drink action** added (🤔): consumes 1 water from inventory, +30 hygiene, no energy cost. Requires water from Phase 3.
* **Random food spawning removed.** Farms produce HQ food; world-gen seeds LQ food near trees.
* **Instant-consume on step removed.** Agents must harvest into inventory then eat.
* **Decision engine updated:** eat from inventory first, then harvest adjacent food, then pathfind to food block.

### Phase 3 Changes (v3.2.0 — Water and Trees)

* **Water blocks** added: small (1-cell, 5 units, impassable) and large (2×2, 20 units, single entity). Large blocks shrink to small when units drop to 25% threshold (≤5 units). Harvest rate: 1 unit per 1000ms.
* **Tree blocks** added: 1-cell, impassable, 3–6 wood units, random emoji from 🌲🌳🌴🎄. Harvest rate: 1 unit per 1500ms.
* **Seedling mechanic:** 10% chance on tree harvest (or 2% passive per tick) to spawn a seedling (🌱) on adjacent cell. Seedlings are passable and protected from other block spawns. Grows into a full tree in 45–90 seconds.
* **Tree food spawning:** 5% chance on tree harvest (instead of seedling) to spawn 1 LQ food in 3-cell radius. 1% passive chance per tick for each tree.
* **Cloud/rain system:** 1 cloud (🌧️) spawns every 60–120 seconds, persists 5–10 seconds, spawns water blocks (90% small, 10% large).
* **Hygiene system activated:** passive decay −0.02/tick, restored by drinking water (+30 hygiene). Critical water seeking at hygiene < 20 (priority 5), proactive at hygiene < 40 (priority 7b).
* **Water seeking behavior:** drink from inventory first; if no water, harvest adjacent water block; if none adjacent, pathfind to nearest water block.
* **Wood harvesting:** opportunistic when agents pass near trees. Low-priority action.
* **World-gen updated:** 3–6 water sources and 8–15 trees placed at world creation.
* **Decision priorities updated:** added hygiene < 20 as priority 5 (critical) and hygiene < 40 as priority 7b (proactive).

### Phase 4 Changes (v3.2.0 — Faction Storage and Sharing)

* **Help renamed to Share:** the "help" action is now "share." Instead of transferring energy, it transfers inventory resources (food, water, wood) from sharer to target. Duration reduced to 300–500ms, energy cost 0.4/sec, +5 XP, +8 social for sharer, +5 social for recipient, +0.14 relationship. Faction recruitment mechanic preserved (50% chance at relationship >= 0.4).
* **Faction flag storage:** flags now store resources (30 per type: food, water, wood). Agents deposit when near their flag with >= 3 inventory items (300–500ms, no energy cost). Agents withdraw when needing resources and near their flag with stored resources (300–500ms, no energy cost).
* **Loot bags (👝):** spawn on agent death (agent's full inventory) and on flag destruction (all stored resources). Passable, 30-second decay timer with fade effect. Any agent can pick up (300–500ms, takes all contents up to inventory cap). Multiple bags on the same cell merge; merge resets decay timer.
* **New actions:** deposit (300–500ms, no energy cost), withdraw (300–500ms, no energy cost), pickup (300–500ms, no energy cost).
* **Decision priority updated:** deposit is opportunistic (near own flag with inventory >= 3). Withdraw when needing food/water and near own flag. Pickup loot bags checked before roaming.

### Phase 5 Changes (v3.2.0 — Hygiene and Disease)

* **Hygiene decay expanded:** hygiene now decays from movement (−0.05/cell), social action completion (−0.5 on talk/quarrel/share/heal), poop action (−5), and stepping on 💩 blocks (−5/step), in addition to passive decay (−0.02/tick).
* **Poop system:** after eating, agents enter a 30-second poop window. During this window, each tick has a 10% chance of triggering the poop action (only when idle). Poop action duration: 500–1000ms, no energy cost. Spawns a 💩 block on the agent's cell (passable, −5 hygiene per step, 30s decay timer, will not spawn on interactable blocks, no stacking).
* **Clean action:** 800–1200ms, 0.25 energy/sec, targets an adjacent poop block, removes it, grants +10 inspiration.
* **Disease system:** when hygiene drops below 20, agents have a 5% chance per tick to contract disease. Diseased agents display the 🤢 emoji, suffer 2× passive energy drain (0.125/tick), and lose 0.5 HP/sec. Disease can kill. Diseased agents spread disease to adjacent agents at 3% per tick (blocked if target hygiene > 60). Disease is cured by the heal action from another agent, or by hygiene recovering above 80.
* **Heal action updated:** heal now also cures disease on the target agent.
* **Decision priority updated:** poop check added at priority 7c (after proactive water seeking). Clean adjacent poop blocks added as opportunistic action at priority 7g (before social actions).

### Phase 6 Changes (v3.2.0 — Inspiration, Play, and Farms)

* **Inspiration system activated:** inspiration is no longer a placeholder. Passive decay at −0.015/tick. Recovered by play (+15), clean (+10), and build farm (+25). When inspiration < 40, agents seek play or clean poop (decision priority 7c).
* **Inspiration duration scaling:** at action creation time, inspiration level modifies action duration. Inspiration < 20 → duration ×1.5 (sluggish). Inspiration > 70 → duration ×0.75 (efficient). Applied once at action creation, not continuously.
* **Play action added:** 1500–2500ms, 0.15 energy/sec. Requires adjacency to any interactable block (food, water, tree, farm, poop, seedling, or flag). Grants +15 inspiration. If adjacent to a poop block during play, agent loses 3 hygiene. Emoji: 🤪.
* **Build farm reworked:** the old random-chance farm building mechanic is replaced by an explicit `build_farm` action. Requires 3 wood in inventory + 6 energy. Duration: 2000ms fixed, 0.25 energy/sec. Spawns a farm (🌻) on an adjacent free cell. Grants +15 XP and +25 inspiration.
* **Farm spawn system reworked:** each farm now tracks `spawnsRemaining` (starts at 10) and `spawnTimerMs` (15–25 second interval between spawns). Farms spawn HQ food on adjacent cells (radius 1), with a maximum of 4 food blocks within radius 1. When `spawnsRemaining` reaches 0, the farm is destroyed and removed from the grid.
* **Decision priority updated:** inspiration < 40 inserted at priority 7c (seek play or clean poop). Old poop check moved to priority 7c2.

---

To bundle all the js files:

```
npx esbuild js/main.js --bundle --outfile=app.bundle.js
```