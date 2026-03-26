# PRD: Needs, Resources & Inventory System (v3.1)

**Status:** Final
**Last updated:** 2026-03-25

---

## 1. Problem Statement

Agents currently have a flat motivation loop: eat, fight, reproduce. Energy serves as the sole currency for survival, combat, building, and reproduction, which limits behavioral diversity. Agents lack distinct motivations that would drive varied, emergent behaviors.

## 2. Goals

- Introduce **5 distinct needs** (energy, health, hygiene, social, inspiration) each with unique recovery mechanics, creating richer decision-making
- Add **2 new resource types** (water, wood) alongside a reworked food system, giving agents more reasons to explore and interact with the world
- Add an **inventory system** so agents carry, store, and share resources — enabling faction logistics and resource economy
- Replace energy-based leveling with an **XP system** tied to meaningful actions
- Lay groundwork for a future Genetics system by making need decay/fulfillment rates parameterizable per-agent

## 3. Needs System

### 3.1 Needs Overview

| Need | Range | Decay | Recovery | Critical Threshold | Effect When Critical |
|------|-------|-------|----------|-------------------|---------------------|
| Energy | 0-200 | Passive (0.0625/tick) + movement (0.12/step) | **Sleep** action | < 40 | Auto-sleep |
| Health | 0-maxHP | Combat damage, starvation, disease | **Eating food** from inventory | < 30% maxHP | Seek food urgently |
| Hygiene | 0-100 | Movement, social interactions, pooping | **Consuming water** (inventory or source) | < 20 | Disease risk, 🤢 emoji |
| Social | 0-100 | Passive time-based decay | Positive interactions (talk, share, heal) with any agent | < 20 | Reduced cooperation probability |
| Inspiration | 0-100 | Passive time-based decay | **Play** action, **Clean** action | < 20 | Actions take 50% longer |

Agents **proactively** manage needs — they will seek resources before needs hit critical thresholds (e.g., seek water when hygiene drops below 40, play when inspiration drops below 40), not only when in crisis.

### 3.2 Energy (reworked)

**Current:** Recovered by eating crops. Used for everything.
**New:** Recovered **only by sleeping**. Eating food now restores **health** instead. Action energy costs are **halved** across the board since energy is harder to recover.

**Halved energy costs:**

| Action | Old Cost/sec | New Cost/sec |
|--------|-------------|-------------|
| Talk | 0.4 | 0.2 |
| Quarrel | 0.8 | 0.4 |
| Attack | 2.2 | 1.1 |
| Heal | 3.0 | 1.5 |
| Share (was Help) | 1.6 | 0.8 |
| Reproduce | 3.0 | 1.5 |

**Sleep action:**

| Property | Value |
|----------|-------|
| Trigger | Auto-selected when energy < 40 (replaces current food-seeking override) |
| Can also be chosen | When energy < 80 and no threats nearby |
| Duration | 3000-6000ms |
| Energy restored | 8 per 500ms tick (~48-96 total) |
| Interruptible | Yes — cancelled if attacked (agent._underAttack) |
| Movement | Agent is stationary, locked |
| Emoji | 💤 |

### 3.3 Health (reworked)

**Current:** Passive regen at high energy, lost to combat/starvation.
**New:** Recovered **by eating food** from inventory. No more passive regen from high energy.

| Property | Value |
|----------|-------|
| Recovery | Eating food from inventory: +15 HP per unit consumed |
| Starvation | Still lose 1 HP/sec at 0 energy |
| Disease drain | 0.5 HP/sec while diseased (can kill) |
| Flag aura | Still heals faction members near flag (unchanged) |

Note: Food in inventory has no quality distinction. HQ and LQ food blocks differ in harvest speed and yield, but once in inventory it's all just "food" that restores +15 HP per unit.

### 3.4 Hygiene (new)

| Property | Value |
|----------|-------|
| Starting value | 100 |
| Decay: movement | -0.05 per cell moved |
| Decay: social interactions | -0.5 per social action completed (talk, share, heal, quarrel) |
| Decay: combat | No decay from combat |
| Decay: poop | -15 instant on poop action |
| Decay: stepping on poop | -5 instant per step |
| Decay: playing near poop | -3 per play action near poop block |
| Recovery | Consume 1 water from inventory or adjacent water block → +30 hygiene |
| Proactive threshold | Agent seeks water when hygiene < 40 |
| Disease threshold | < 20 hygiene → 5% chance per tick of contracting disease |
| Disease spread | Diseased agent adjacent to another agent → 3% chance per tick to spread (blocked if target hygiene > 60) |
| Disease duration | 10-20 seconds, or until hygiene > 50 |
| Disease effects | 🤢 idle emoji, energy drain 2x normal rate, -0.5 HP/sec, **can kill** |

**Poop action:**

| Property | Value |
|----------|-------|
| Trigger | Random chance (2% per tick) when energy > 60 **and agent is idle** (not performing another action) |
| Duration | 500-1000ms |
| Cost | None |
| Effect | Spawns 💩 block on agent's cell (or adjacent free cell if occupied). Agent hygiene -15. |
| Poop block | Passable. Causes -5 hygiene per step. Decays after 30 seconds naturally. |
| Spawn rule | Will not spawn on another interactable block. |

**Clean action:**

| Property | Value |
|----------|-------|
| Target | Adjacent 💩 block |
| Duration | 800-1200ms |
| Cost | 0.25 energy/sec (halved from draft) |
| Effect | Removes poop block, +10 inspiration to cleaner |

### 3.5 Social (new)

Social interactions can be performed with **any agent**, not just faction members.

| Property | Value |
|----------|-------|
| Starting value | 50 |
| Passive decay | -0.02 per tick |
| Recovery: talk | +5 per completed talk |
| Recovery: share | +8 per completed share (was help) |
| Recovery: heal | +6 per completed heal |
| Recovery: quarrel | +2 (still social, just negative) |
| Proactive threshold | Agent seeks interactions when social < 40 |
| Low social effect | When < 20: cooperation probability halved, reproduction relationship threshold raised to 0.3 (from 0.1) |
| High social effect | When > 70: reproduction relationship threshold lowered to 0.05 |

### 3.6 Inspiration (new)

| Property | Value |
|----------|-------|
| Starting value | 50 |
| Passive decay | -0.015 per tick |
| Recovery: play | +15 per completed play action |
| Recovery: clean | +10 per completed clean action |
| Proactive threshold | Agent seeks play when inspiration < 40 |
| Low effect (< 20) | All action durations × 1.5 |
| High effect (> 70) | All action durations × 0.75 |

**Play action:**

| Property | Value |
|----------|-------|
| Target | Must be adjacent to any interactable block (water, wood, food, farm, poop) |
| Duration | 1500-2500ms |
| Cost | 0.15 energy/sec (halved from draft) |
| Emoji | 🎭 |
| Effect | +15 inspiration on completion. If played near poop block: also -3 hygiene. |

### 3.7 XP and Leveling System (replaces energy-based leveling)

**Old system:** Level up when energy > 140.
**New system:** XP-based with scaling level curve.

**XP sources:**

| Action | XP Gained |
|--------|-----------|
| Kill an agent | +50 |
| Eat food (from inventory) | +5 |
| Heal another agent (completed) | +10 |
| Share with another agent (completed) | +5 |
| Build a farm | +15 |
| Harvest any resource (per unit) | +2 |

**Level curve (scaling):** XP required = level × 50

| Level | Total XP Required | Cumulative XP |
|-------|-------------------|---------------|
| 2 | 100 | 100 |
| 3 | 150 | 250 |
| 5 | 250 | 750 |
| 10 | 500 | 2,750 |
| 15 | 750 | 5,750 |
| 20 | 1,000 | 10,250 |

**Level-up effects (unchanged):**
- maxHealth += 8
- attack += 1.5
- Level cap: 20

### 3.8 Decision Priority (revised)

The agent decision hierarchy changes to accommodate new needs. Agents proactively manage needs before they become critical.

```
1. Energy < 20:            → Sleep (mandatory, highest priority)
2. Under attack:           → Flee or retaliate
3. Health < 30%:           → Eat food from inventory, or seek food
4. Hygiene < 20:           → Drink water from inventory, or seek water source
5. Energy < 40:            → Sleep (voluntary)
6. Poop check:             → 2% chance per tick if energy > 60 and idle
7. Energy >= 40 (normal state), proactive need management:
   a. Hygiene < 40:        → Seek water
   b. Social < 40:         → Seek agent to interact with
   c. Inspiration < 40:    → Seek resource block to play near, or clean poop
8. Energy >= 40 (normal state), standard behaviors:
   a. Check reproduction (if social > 50)
   b. Check harvest nearby resources (if inventory not full)
   c. Check interactions (attack / share / heal / talk)
   d. Check build farm (if has >= 3 wood)
   e. Check deposit at flag (if near flag and has resources)
   f. Biased roam
```

## 4. Resource System

### 4.1 General Rule: No Block Stacking

**No interactable block may spawn on another interactable block.** This applies to all resource blocks, poop, seedlings, loot bags, farms, walls, and flags. Spawn logic must check that the target cell is free of all interactable objects before placing.

### 4.2 Water 💦

| Property | Value |
|----------|-------|
| Emoji | 💦 |
| Sizes | Small (1 cell, 5 units) or Large (2×2 cells, 20 units) |
| Passable | No |
| World gen | 3-6 water sources spawned at world creation (mix of small and large) |
| Harvest action | 1 unit per harvest (1000ms duration) |
| Depletion | Block disappears when 0 units remain |
| Agent spawned on | Agent can move out; water doesn't destroy agent |
| Consumption priority | Agents prefer using water from **inventory first**, then seek a water source |

**Large water block (2×2):**
- One entity occupying 4 cells. Harvestable from any adjacent cell to any of its 4 cells.
- Shrinks to 1×1 (small) when resource drops below 25% of max (below 5 units). The remaining block occupies one of the original 4 cells (chosen randomly), freeing the other 3 cells.

**Clouds and rain:**

| Property | Value |
|----------|-------|
| Cloud emoji | 🌧️ |
| Spawn rate | 1 cloud every 60-120 seconds |
| Behavior | Cloud appears at random position, persists for 5-10 seconds |
| Rain effect | Spawns 1 water block on a free cell beneath/near cloud |
| Block size | 90% chance small (1 cell), 10% chance large (2×2) |
| Constraints | Water won't spawn on occupied cells (agents, resources, walls, flags, seedlings, or any interactable block) |

### 4.3 Wood 🌲🌳🌴🎄

| Property | Value |
|----------|-------|
| Emojis | Random from: 🌲🌳🌴🎄 |
| Size | 1 cell |
| Passable | No |
| World gen | 8-15 trees spawned at world creation |
| Resource units | 3-6 per tree |
| Harvest action | 1 unit per harvest (1500ms — slower than other resources) |
| Depletion | Block disappears when 0 units remain |

**Seedling mechanic:**

| Property | Value |
|----------|-------|
| Spawn trigger (harvest) | 10% chance per harvest action on a tree |
| Spawn trigger (passive) | 2% chance per tick per tree |
| Spawn location | Random free cell within 5-cell radius (must be free of all interactable blocks) |
| Emoji | 🌱 |
| Passable | Yes |
| Harvestable | No |
| Protected | No other interactable block may spawn on a seedling's cell |
| Growth time | 45-90 seconds → becomes a full tree (random emoji, 3-6 units) |

**Food spawn from trees:**

| Property | Value |
|----------|-------|
| Trigger (harvest) | 5% chance per harvest action (instead of seedling, not in addition to) |
| Trigger (passive) | 1% chance per tick per tree |
| Spawn location | Random free cell within 3-cell radius |
| Type | Low-quality food block |

**UI manual tree spawn:** God-mode button in UI to place a tree at a clicked location. No in-game cost.

### 4.4 Food (reworked)

**Current:** Spawns randomly, instant consumption for energy.
**New:** Two quality tiers affecting harvest speed and yield. Once harvested into inventory, food is fungible — no quality distinction in inventory.

| Property | High Quality (HQ) | Low Quality (LQ) |
|----------|-------------------|-------------------|
| Emojis | 🥔🍎🍑🌽🍅 | 🌿🥬🥦🍀 |
| Source | Farms only | Nature (tree spawn, passive tree spawn) + world gen |
| Units per block | 2-4 | 1-2 |
| Harvest time per unit | 600ms | 1200ms |
| Spawn | Farms spawn in 1-cell radius | Trees 5% on harvest / 1% passive; 5-10 at world gen near trees |

**In inventory:** All food is just "food." Consuming 1 food unit restores **+15 HP**.

**Random food spawning:** Removed. Food only comes from farms, trees, and world gen.

**World gen food:** 5-10 low-quality food blocks scattered near trees at world creation, so agents have initial food available.

**Farm rework:**

| Property | Value |
|----------|-------|
| Build cost | **3 wood + 6 energy** |
| Build action | 2000ms duration, 0.25 energy/sec |
| Emoji | 🌾 |
| Behavior | Spawns 1 high-quality food block in 1-cell radius every 15-25 seconds |
| Max food near farm | 4 blocks within radius (won't spawn more until consumed) |
| Spawn limit | Each farm can spawn a **maximum of 10 food blocks** total before being destroyed |
| Destruction | Farm disappears after exhausting its spawn limit. Emoji changes to withered state before disappearing. |

### 4.5 Resource Harvesting (multiple agents)

Multiple agents can harvest the same resource block simultaneously, as long as each is within 1 cell (adjacent). They race for remaining units — if two agents finish a harvest action at the same tick for the last unit, one gets it and the other's harvest fails silently (no resource gained, no energy refunded).

## 5. Inventory System

### 5.1 Agent Inventory

```typescript
interface IInventory {
  food: number;     // food units (no quality distinction once harvested)
  water: number;    // water units
  wood: number;     // wood units
}
```

| Property | Value |
|----------|-------|
| Capacity | **20 total units** across all resource types |
| Starting inventory | 0 (agents start with nothing) |

When inventory is full, harvest actions are blocked (agent will not attempt to harvest). Agents should prioritize consuming or depositing before harvesting more.

### 5.2 Harvest Action (universal)

A generic "harvest" action that applies to all resource blocks:

| Property | Value |
|----------|-------|
| Target | Adjacent resource block (food, water, wood) or loot bag or faction flag (withdraw) |
| Duration (resource blocks) | Varies by resource type (food HQ: 600ms, food LQ: 1200ms, water: 1000ms, wood: 1500ms) |
| Duration (loot bag/flag) | 300-500ms (short action) |
| Cost | 0.25 energy/sec (halved from draft) |
| Effect | Transfers 1 unit from resource block to agent inventory |
| Inventory full | Action blocked; agent will not attempt |

### 5.3 Consume Actions (from inventory)

Short actions for consuming resources from inventory:

**Eat (from inventory):**

| Property | Value |
|----------|-------|
| Duration | 300-500ms |
| Cost | None |
| Effect | -1 food from inventory, +15 HP, +5 XP |

**Drink (from inventory):**

| Property | Value |
|----------|-------|
| Duration | 300-500ms |
| Cost | None |
| Effect | -1 water from inventory, +30 hygiene |

### 5.4 Share Action (replaces Help)

The old "help" action transferred energy to another agent. Renamed to **"share"** — now transfers resources from inventory to an adjacent agent.

| Property | Value |
|----------|-------|
| Duration | 300-500ms (short action) |
| Cost | 0.4 energy/sec (halved from 0.8) |
| Target | Adjacent agent |
| Effect | Transfer chosen resource units from sharer's inventory to target's inventory |
| Transfer amount | Agent chooses specific resource type and amount |
| Social recovery | +8 social for sharer, +5 social for recipient |
| Relationship | +0.14 relationship (same as talk) |
| XP | +5 XP for sharer |
| Recruitment | 50% chance to recruit target to faction if relationship >= 0.4 (same as old help) |

### 5.5 Faction Storage

| Property | Value |
|----------|-------|
| Location | Faction flag |
| Capacity | **30 per resource type** (30 food, 30 water, 30 wood) |
| Deposit action | 300-500ms, agent adjacent to own flag, transfers chosen resources from inventory to flag storage |
| Withdraw action | 300-500ms, agent adjacent to own flag, transfers chosen resources from flag storage to inventory (respects inventory cap) |
| On flag destroyed | All stored resources dropped as a single 👝 loot bag |

### 5.6 Death Drops

| Property | Value |
|----------|-------|
| Trigger | Agent health <= 0 |
| Effect | Spawn 👝 loot bag on agent's cell |
| Contents | Agent's full inventory |
| Passable | Yes |
| Pickup | Any agent, 300-500ms action, takes **entire contents** (up to inventory cap; excess remains in bag) |
| Decay | Disappears after 30 seconds if not picked up |
| Stacking | If multiple agents die on the same cell, contents merge into **one bag** |

### 5.7 Gift Receiving

When an agent receives resources via the share action, or withdraws from a flag, or picks up a loot bag, these are all **short actions (300-500ms)**.

## 6. Impact on Existing Systems

### 6.1 Faction Changes

- **Food sharing rework**: The old "30% energy share on harvest" mechanic is **removed**. Instead, faction members deposit resources at the flag and others withdraw. This is more strategic and requires physical proximity to the flag.
- **Flag becomes a depot**: The flag now stores resources (30 per type), making it far more strategically important.
- **Flag destruction drops loot**: Destroying a faction flag drops its stored resources as a 👝 loot bag, creating a strong motivation for faction warfare.
- **Share action replaces help**: The "help" action is renamed to "share" and now transfers inventory resources instead of energy. Recruitment mechanic (50% chance at relationship >= 0.4) is preserved.

### 6.2 Combat Changes

- **Attack still drains health** (unchanged, but energy cost halved to 1.1/sec)
- **Kill reward**: Killer gains XP (+50) and can pick up victim's loot bag
- **Disease as biological warfare**: Low-hygiene agents near enemies can spread disease — an emergent "dirty fighter" archetype

### 6.3 Reproduction Changes

- **Energy cost unchanged** (still requires energy >= 85 each parent)
- **Social requirement added**: Both parents need social > 50
- **Child starts with**: energy 60, health 80, hygiene 80, social 50, inspiration 50, empty inventory, 0 XP, level 1

### 6.4 Leveling

Old energy-based leveling is **removed**. See Section 3.7 for the new XP system.

### 6.5 Persistence / Save-Load

Save format must now include:
- Agent inventory (food, water, wood counts)
- Agent needs (hygiene, social, inspiration — all as numbers)
- Agent XP (current XP, current level)
- Agent disease state (diseased: boolean, diseaseRemainingMs: number)
- Resource block units remaining (water, wood, food blocks each track current/max units)
- Resource block metadata (large water block links to its 4 cells; farm tracks spawns remaining)
- Faction flag storage (food, water, wood counts)
- New world object types: poop blocks (with decay timer), seedlings (with growth timer), loot bags (with decay timer and contents)
- Cloud state: **not saved** — clouds are ephemeral and will simply not exist on load

## 7. New World Objects Summary

| Object | Emoji | Passable | Harvestable | Decays | Notes |
|--------|-------|----------|-------------|--------|-------|
| Water (small) | 💦 | No | Yes (1 unit/harvest) | When depleted | 5 units |
| Water (large) | 💦×4 | No | Yes (1 unit/harvest) | Shrinks to small at < 5 units; depletes at 0 | 2×2, 20 units, single entity |
| Tree | 🌲🌳🌴🎄 | No | Yes (1 unit/harvest) | When depleted | 3-6 units, passive seedling/food spawn |
| Seedling | 🌱 | Yes | No | Grows into tree (45-90s) | Protected from block spawning |
| Food (HQ) | 🥔🍎🍑🌽🍅 | Yes | Yes (faster harvest) | When depleted | From farms, 2-4 units |
| Food (LQ) | 🌿🥬🥦🍀 | Yes | Yes (slower harvest) | When depleted | From nature/trees, 1-2 units |
| Poop | 💩 | Yes | No (cleaned) | 30s natural decay | -5 hygiene per step |
| Loot bag | 👝 | Yes | Yes (all contents, short action) | 30s | From dead agents or destroyed flags. Multiple bags on same cell merge. |
| Cloud | 🌧️ | N/A (visual overlay) | No | 5-10s | Spawns water (90% small, 10% large) |
| Farm | 🌾 | No | No | After 10 food spawns | Spawns HQ food in 1-cell radius |

## 8. All Actions Summary

### Existing Actions (modified)

| Action | Duration | Energy Cost (halved) | Changes |
|--------|----------|---------------------|---------|
| Talk | 900-1800ms | 0.2/sec | +5 social on completion |
| Quarrel | 900-1800ms | 0.4/sec | +2 social on completion |
| Attack | 450-900ms | 1.1/sec | +50 XP on kill |
| Heal | 900-1800ms | 1.5/sec | +6 social, +10 XP on completion |
| Share (was Help) | 300-500ms | 0.4/sec | Transfers inventory resources instead of energy. +8 social, +5 XP. Keeps recruitment mechanic. |
| Reproduce | 2000-3200ms | 1.5/sec | Requires social > 50 for both parents |

### New Actions

| Action | Duration | Energy Cost | Target | Effect |
|--------|----------|-------------|--------|--------|
| Sleep | 3000-6000ms | Restores +8/500ms tick | Self | Recovers energy. Interruptible by attack. 💤 |
| Harvest | 600-1500ms (varies) | 0.25/sec | Adjacent resource block | +1 unit to inventory. +2 XP. |
| Poop | 500-1000ms | None | Self (idle only) | Spawns 💩 block. -15 hygiene. |
| Clean | 800-1200ms | 0.25/sec | Adjacent 💩 | Removes poop. +10 inspiration. |
| Play | 1500-2500ms | 0.15/sec | Adjacent to any interactable block | +15 inspiration. -3 hygiene if near poop. 🎭 |
| Build Farm | 2000ms | 0.25/sec | Adjacent free cell | -3 wood -6 energy. Spawns 🌾. +15 XP. |
| Eat | 300-500ms | None | Self (from inventory) | -1 food. +15 HP. +5 XP. |
| Drink | 300-500ms | None | Self (from inventory) | -1 water. +30 hygiene. |
| Deposit | 300-500ms | None | Own faction flag | Transfer chosen resources: inventory → flag storage. |
| Withdraw | 300-500ms | None | Own faction flag | Transfer chosen resources: flag storage → inventory. |
| Pickup | 300-500ms | None | Adjacent 👝 loot bag | Take contents up to inventory cap. |

## 9. Future Considerations

### Genetics System (not in scope)

The needs system is designed with per-agent parameterization in mind. Future genetics will affect:
- Rate of need decay (some agents get hungrier faster, some stay cleaner longer)
- Rate of need fulfillment (some agents recover more from sleep, others need less food)
- Inventory capacity (some agents can carry more)
- These rates should be stored as multipliers on the agent, defaulting to 1.0

This PRD does NOT implement genetics — it just ensures the architecture supports it by using parameterizable rates rather than hardcoded constants wherever possible.

## 10. Implementation Phases

**Phase 1 — Core Needs, Sleep, and XP**
- Add hygiene, social, inspiration fields to agent
- Add XP field and scaling level curve
- Implement sleep action
- Remove energy recovery from eating
- Remove energy-based leveling
- Update decision engine with new priority hierarchy

**Phase 2 — Inventory and Resource Rework**
- Add agent inventory (food, water, wood with 20-unit cap)
- Add resource units (current/max) to food blocks
- Split food into HQ/LQ block types (fungible once in inventory)
- Implement universal harvest action
- Implement eat/drink consume actions
- Rework food: remove random spawning, add world-gen food near trees

**Phase 3 — Water and Trees**
- Add water blocks (small 1-cell, large 2×2 single entity)
- Implement 2×2 → 1×1 shrink at 25% threshold
- Add tree blocks with resource units
- Add seedling mechanic (harvest-triggered + passive)
- Add passive tree food spawning
- Cloud/rain system (90% small, 10% large water)
- UI god-mode tree spawn button

**Phase 4 — Faction Storage and Sharing**
- Faction flag storage (30 per resource type)
- Deposit/withdraw actions with resource selection
- Rename help → share (inventory resource transfer)
- Loot bags on death (merge on same cell, 30s decay)
- Loot bags on flag destruction
- Remove old 30% energy sharing mechanic

**Phase 5 — Hygiene and Disease**
- Hygiene decay from movement, interactions, poop
- Poop action (idle-only trigger) and 💩 blocks (30s decay)
- Clean action (+10 inspiration)
- Disease mechanic (contraction at hygiene < 20, spread blocked by hygiene > 60, 10-20s duration, 🤢 emoji, 2× energy drain, -0.5 HP/sec, can kill)
- No-stacking rule enforcement for all interactable blocks

**Phase 6 — Inspiration, Play, and Farms**
- Play action (near any interactable block, -3 hygiene if near poop)
- Inspiration effects on action durations (< 20: ×1.5, > 70: ×0.75)
- Farm rework: 3 wood + 6 energy cost, 10 spawn limit before destruction
- Farm HQ food spawning (every 15-25s, max 4 nearby)

## Appendix: Resolved Design Decisions

For reference, these questions were raised during design and resolved:

| # | Question | Decision |
|---|----------|----------|
| 1 | Leveling trigger | XP-based with scaling curve (level × 50 XP per level) |
| 2 | Action energy costs | Halved across the board |
| 3 | Farm building cost | Both: 3 wood + 6 energy |
| 4 | Proactive need management | Yes, agents seek resources before critical |
| 5 | Large water from clouds | Yes, 10% chance large, 90% small |
| 6 | Water consumption priority | Inventory first, then seek source |
| 7 | Passive tree growth | Yes, 2% seedling / 1% food per tick per tree |
| 8 | Farm decay | Farm itself doesn't decay; destroyed after 10 food spawns |
| 9 | Starting food | Scatter LQ food near trees at world gen |
| 10 | Inventory capacity | Capped at 20 total units |
| 11 | Consumption from inventory | Short action (300-500ms) |
| 12 | Faction storage capacity | 30 per resource type |
| 13 | 2×2 water blocks | One entity occupying 4 cells |
| 14 | Deposit/withdraw granularity | Agent chooses specific resource type and amount |
| 15 | Multiple harvesters | Yes, within 1 cell range, race for last unit |
| 16 | Loot bag stacking | Merge into one bag on same cell |
| 17 | Tree UI spawn | God-mode feature, no cost |
| 18 | Disease mortality | Yes, disease can kill |
| 19 | Poop interruption | Only triggers when idle |
| 20 | Play action scope | All interactable blocks including farms and poop (poop decays hygiene) |
| 21 | Seedling protection | No interactable block may spawn on a seedling |
| 22 | Hygiene from combat | No decay from combat |
| 23 | Social recovery | Any agent, not faction-only |
| 24 | Large water depletion | Shrinks to 1×1 at < 25% (below 5 units) |
| 25 | Food quality in inventory | No distinction — fungible once harvested |
