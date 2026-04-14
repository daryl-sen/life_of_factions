# Plant Life PRD

**Issue:** #55 — feat: Plant life
**Version target:** 4.3.0
**Status:** Draft

---

## 1. Problem Statement

The current vegetation system is simplistic: all trees are functionally identical, differ only by a random emoji, and can overgrow uncontrollably — blocking pathfinding, trapping agents, and cutting off access to water. There is no botanical variety beyond trees, and the map lacks visual and ecological diversity.

## 2. Goals

1. **Differentiated tree variants** with distinct growth rules, density limits, terrain preferences, and fruit types — so the right trees survive in the right areas through natural selection.
2. **New non-tree plant types** (medicine, flowers, cacti) that add ecological richness and gameplay utility.
3. **Solve overgrowth** by introducing per-variant density caps and terrain-dependent survival pressure.
4. **More visually interesting maps** with biome-like zones emerging organically from terrain layout.

## 3. Non-Goals

- Biome system or explicit terrain zones (biomes should emerge from terrain, not be assigned).
- Agent farming or planting actions (agents interact with plants passively, as they do today).
- Temporary buff/effect system for special resources (future work).

---

## 4. Tree Variants

All three variants share the existing tree lifecycle (spawn → seedling 🌱 → mature → age → die) but differ in terrain affinity, density, and fruit production. All three variants are harvestable for wood, exactly as trees work today. Christmas tree (🎄) is removed from the emoji pool.

### 4.1 Variant Inheritance

Seedlings inherit their parent tree's variant. A 🌴 produces 🌴 seedlings, a 🌲 produces 🌲 seedlings, a 🌳 produces 🌳 seedlings. The variant is fixed at spawn time and stored on the seedling.

**Exception — water-spawned seedlings:** Seedlings that spawn spontaneously near water blocks (the existing `tickSeedlingNearWater` mechanic, which has no parent tree) receive a random variant. This serves as a natural reintroduction mechanism, preventing any variant from going permanently extinct even if all trees of that type die out.

The initial world seed spawns a random mix of all three variants. Natural selection then takes over: trees in unsuitable environments die off before reproducing, while trees in the right terrain thrive and spread. Over time, biome-like zones emerge organically. Water-spawned seedlings ensure the ecosystem can always recover.

### 4.2 Tropical (🌴)

| Property | Value |
|----------|-------|
| Emoji | 🌴 |
| Terrain affinity | Saltwater or fresh water |
| Density | Sparse — ~1-2 mature trees per 3×3 area |
| Fruit | 🥥 Coconut, spawns adjacent, max 3 per tree |
| Water dependency | Dies (resource drain → death) without nearby saltwater or fresh water |

**Behavior notes:**
- Can grow near any water type (salt or fresh).
- Coconuts spawn passively on adjacent free cells using the existing fruit spawn mechanic, but capped at 3 coconuts alive within 2 cells of the parent tree. Coconuts are food items (existing `IFoodBlock`).
- When no water (salt or fresh) is within range, the tree enters decline: loses resource over time and dies when resource hits 0.
- Density enforcement: before a seedling matures into 🌴, check the 3×3 area centered on the seedling. If there are already 2+ tropical trees, the seedling dies instead of maturing.

### 4.3 Evergreen (🌲)

| Property | Value |
|----------|-------|
| Emoji | 🌲 |
| Terrain affinity | Fresh water; mountains sustain adults |
| Density | Dense — can fully saturate an area if conditions allow |
| Fruit | None |
| Water dependency | Adults survive without water if within 3 cells of a mountain obstacle. Saplings always need water or they die. |

**Behavior notes:**
- Uses existing tree growth behavior with no density cap — this is the variant that can form thick forests, which is fine since it produces no fruit and doesn't block resources as aggressively.
- Grows near fresh water only (not saltwater).
- **Mountain sustain rule:** An adult 🌲 that has no water within range will still survive if it is within 3 cells of a mountain-category obstacle (🏔️, ⛰️, 🗻). Saplings do not benefit from this rule — they need water to grow.
- When neither water nor mountain is nearby, the tree enters decline and dies.
- No fruit production.

### 4.4 Regular Tree (🌳)

| Property | Value |
|----------|-------|
| Emoji | 🌳 |
| Terrain affinity | Fresh water only |
| Density | Medium — ~2-3 mature trees per 3×3 area |
| Fruit | Random tree fruit (🍎🍐🍊🍋🍑🍒🍏), same spawn mechanic as current food |
| Water dependency | Dies without nearby fresh water. Mountains do not sustain it. |

**Behavior notes:**
- Can only grow near fresh water (not saltwater).
- Fruit production uses the existing passive food spawn mechanic with a random tree fruit emoji (🍎 apple, 🍐 pear, 🍊 orange, 🍋 lemon, 🍑 peach, 🍒 cherry, 🍏 green apple).
- Density enforcement: before a seedling matures into 🌳, check the 3×3 area. If there are already 3+ regular trees, the seedling dies.

### 4.5 Seedling Behavior (all variants)

- All seedlings display as 🌱 regardless of variant.
- Variant is inherited from the parent tree and stored on the `ISeedling` at spawn time.
- Seedlings require water within range to grow. Without water, seedlings lose resource and die.
- When a seedling dies, it simply disappears (no death marker 🪾).

### 4.6 Death Behavior (all variants)

- Mature trees that die turn into 🪾 (death marker), which disappears after a few seconds. This is the existing death marker behavior.
- Seedlings that die simply disappear with no marker.

---

## 5. New Plant Types

These are new block types distinct from trees. They do not go through the seedling → tree lifecycle. They spawn directly as mature plants.

### 5.1 Medicine (🌿)

| Property | Value |
|----------|-------|
| Emoji | 🌿 |
| Spawn condition | Random spawn near mountain-category obstacles |
| Passable | Yes — agents can walk through this block |
| Harvestable | Yes — via the existing harvest action |
| Yield | No food/water. Cures the harvesting agent's disease. |
| Regrowth | Respawns over time near mountains (passive spawn like seedlings near water) |

**Behavior notes:**
- A new passable block type. Unlike trees, agents can walk over medicine plants.
- Harvested via the existing `harvest` action. When a diseased agent harvests a medicine block, the block is removed and the agent's disease is cured (`agent.diseased = false`). No food or resource yield.
- Non-diseased agents ignore medicine plants (no benefit from harvesting).
- Agents use medicine **opportunistically** — they do not actively pathfind toward it. If a diseased agent happens to be adjacent to a medicine block, they can harvest it.
- Spawns passively near mountain obstacles with a low per-tick chance, similar to how seedlings spawn near water.
- Does not grow, age, or produce offspring. It either exists or has been harvested.
- Medicine is the first "special resource" — future special resources may grant temporary effects or bonus resources, but that system is out of scope for this PRD.

### 5.2 Flowers (🌹 🌺 🌷 🌻 🪻)

| Property | Value |
|----------|-------|
| Emoji | Random from: 🌹 🌺 🌷 🌻 🪻 |
| Spawn condition | Rare spawn near fresh water |
| Passable | Yes |
| Harvestable | No |
| Lifespan | Short-lived — approximately 2 minutes |
| Function | Purely decorative |

**Behavior notes:**
- Cosmetic blocks that add visual variety near water sources.
- Rare spawn rate — they should accent the landscape, not dominate it.
- Passable — agents walk through them without interaction.
- Short-lived (~2 minutes). They bloom, persist briefly, then disappear. New flowers spawn independently, creating a gentle cycle of color near water.
- No gameplay effect. Potential future use (mood boost, faction decoration) is out of scope.

### 5.3 Cactus (🌵)

| Property | Value |
|----------|-------|
| Emoji | 🌵 |
| Spawn condition | Rare spawn far from water (minimum distance from any water source) |
| Passable | No — blocks movement like a tree |
| Harvestable | Yes — yields fresh water (small amount, ~1/10 of a regular water resource) |
| Regrowth | Slow passive respawn in valid locations |

**Behavior notes:**
- Spawns only in arid areas — cells that are beyond a minimum manhattan distance from any water block (salt or fresh).
- Agents can harvest a cactus to gain water via the existing harvest action. Yields a small amount of water (~1/10 of a regular water block's units). When depleted, the cactus is removed.
- Blocks movement like trees and obstacles.
- Provides a scarce water source in otherwise dry areas, giving agents a reason to explore away from water.
- Should not be abundant — rare enough that finding one in the desert is meaningful.

---

## 6. Farm Crop Standardization

Farms currently produce food with a random emoji from the high-quality food pool (🥔, 🍎, 🍑, 🌽, 🍅). With this update, farms should exclusively produce wheat/grain crops using the 🌾 emoji. This:
- Visually distinguishes farm output from tree fruit (🍎, 🥥) and foraged food.
- Makes farms feel like agricultural plots rather than random food generators.
- Keeps 🍎 exclusive to regular trees and 🥥 exclusive to tropical trees.

**Change:** When a farm spawns a food block, it always uses the 🌾 emoji instead of a random `FOOD_EMOJIS.hq` entry. Quality remains `'hq'`.

---

## 7. Obstacle Categories

To support the evergreen mountain-sustain rule and medicine spawning, obstacles need a category field.

| Emoji | Category |
|-------|----------|
| 🏔️ | mountain |
| ⛰️ | mountain |
| 🗻 | mountain |
| 🪨 | rock |
| 🪵 | wood |

The `IObstacle` interface gains a `category` field: `'mountain' | 'rock' | 'wood'`. Category is assigned based on the obstacle's emoji at creation time. No behavioral changes for rocks or wood — the category is only used for mountain-proximity checks by evergreens and medicine plants.

---

## 8. Emoji Conflict Resolution

The 🌿 emoji is currently used as a low-quality food emoji (`FOOD_EMOJIS.lq`). This PRD reassigns it to medicine plants. To resolve:
- Remove 🌿 from `FOOD_EMOJIS.lq`.
- Replace it with another leafy emoji (e.g., 🍃) or simply drop it (3 remaining LQ emojis is sufficient).

---

## 9. Affected Domains

| Domain | Changes |
|--------|---------|
| **world** | New block types (medicine, flower, cactus). `ITreeBlock` gains a `variant` field. `ISeedling` gains a `variant` field. `IObstacle` gains `category`. New interfaces for plant blocks. |
| **simulation** | Spawner updates for variant-aware tree spawning, seedling maturation logic (seedling inherits parent variant), new plant passive spawning. World-updater changes for tree water/mountain survival checks, flower lifespan, plant spawning. |
| **action** | Extend harvest action to handle medicine (cure disease) and cactus (yield water). |
| **rendering** | Render new plant block types. Variant-specific tree emojis (no more random). |
| **persistence** | Save/load new block types, tree variant field, seedling variant field. |
| **core/constants** | Remove 🎄 from `TREE_EMOJIS`. Add plant emojis. Add obstacle category mapping. Remove 🌿 from `FOOD_EMOJIS.lq` (now medicine). Add 🌾 for farm crops. |

Domains **not** affected: genetics, entity, decision, faction, UI (inspector may show new block info but no new controls needed).

---

## 10. Summary of Visual Changes

| Element | Current | New |
|---------|---------|-----|
| Trees | Random from 🌲🌳🌴🎄 | Variant-specific: 🌴, 🌲, or 🌳 |
| Seedlings | 🌱 | 🌱 (unchanged, but now carries variant) |
| Tree death | 🪾 death marker | 🪾 death marker (unchanged) |
| Seedling death | Death marker | No marker, just disappears |
| Coconuts | N/A | 🥥 (adjacent to 🌴) |
| Tree fruit | Generic food emoji | Random from 🍎🍐🍊🍋🍑🍒🍏 (near 🌳) |
| Medicine | N/A | 🌿 (near mountains, passable) |
| Flowers | N/A | Random 🌹🌺🌷🌻🪻 (near fresh water, ~2min lifespan) |
| Cacti | N/A | 🌵 (far from water) |
| Farm crops | Random HQ food emoji | 🌾 exclusively |

---

## 11. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Medicine action type | Extend existing `harvest` action. Medicine is the first "special resource" — future ones may grant temporary effects. |
| 2 | Cactus water yield | ~1/10 of a regular water resource. |
| 3 | Flower lifespan | Short-lived, approximately 2 minutes. |
| 4 | Tree variant assignment | Seedlings inherit parent variant. Initial world seed is random mix; natural selection sorts them. |
| 5 | Variant determination timing | At spawn (inherited from parent). |
| 6 | Diseased agent seeking | Opportunistic only — no active pathfinding toward medicine. |
| 7 | Scope | Bundled — new plants ship with tree rework in one PR. |
