# Actions

Actions are discrete behaviors agents perform. Each action has a duration, energy cost, and effects.

## Action Reference

| Action | Duration | Energy/sec | Distance | Locks | Emoji |
|--------|----------|------------|----------|-------|-------|
| `talk` | 0.9-1.8s | 0.2 | 1 | Yes | |
| `quarrel` | 0.9-1.8s | 0.4 | 1 | Yes | |
| `attack` | 0.45-0.9s | 1.1 | ≤2 | No | |
| `heal` | 0.9-1.8s | 1.5 | 1 | Yes | |
| `share` | 300-500ms | 0.4 | 1 | Yes | |
| `reproduce` | 2.0-3.2s | 1.5 | 1 | Yes | |
| `sleep` | 8-12s | 0 (restores) | self | Yes | 😴 |
| `harvest` | 600-1200ms | 0.25 | 1 (adjacent food block) | Yes | 🫨 |
| `harvest_water` | 1000ms | 0.25 | 1 (adjacent water block) | Yes | 🫨 |
| `harvest_wood` | 1500ms | 0.25 | 1 (adjacent tree block) | Yes | 🫨 |
| `eat` | 300-500ms | 0 | self (from inventory) | Yes | 🤔 |
| `drink` | 300-500ms | 0 | self (from inventory) | Yes | 🤔 |
| `deposit` | 300-500ms | 0 | 1 (adjacent own flag) | Yes | |
| `withdraw` | 300-500ms | 0 | 1 (adjacent own flag) | Yes | |
| `pickup` | 300-500ms | 0 | on cell or adjacent loot bag | Yes | |
| `poop` | 500-1000ms | 0 | self | Yes | 💩 |
| `clean` | 800-1200ms | 0.25 | 1 (adjacent poop block) | Yes | |
| `play` | 1500-2500ms | 0.15 | 1 (adjacent interactable block) | Yes | 🤪 |
| `build_farm` | 2000ms | 0.25 | self (spawns on adjacent free cell) | Yes | |

> **Note:** All action energy costs were halved in Phase 1 to account for the new sleep-based energy economy. Harvest, eat, and drink actions were added in Phase 2. Water harvest, wood harvest, and hygiene-driven water seeking were added in Phase 3. Share (renamed from help), deposit, withdraw, and pickup actions were added in Phase 4. Poop and clean actions were added in Phase 5. Play and build_farm actions were added in Phase 6.

## Social Actions

### Talk

**Purpose:** Build relationships through conversation.

**Effect (every 500ms):**
```javascript
delta = (random < 0.75 ? 0.14 : -0.06) * (sameFaction ? 1.1 : 0.8)
setRelationship(both agents, current + delta)
```

**Outcome:**
- 75% chance to improve relationship (+0.14 or +0.154 if same faction)
- 25% chance to worsen relationship (-0.06 or -0.048 if same faction)

### Quarrel

**Purpose:** Argument that may improve or worsen relationships.

**Effect (every 500ms):**
```javascript
delta = (random < 0.5 ? -0.1 : 0.1) * (sameFaction ? 0.6 : 1)
setRelationship(both agents, current + delta)
```

**Outcome:**
- 50/50 chance to improve or worsen
- Same-faction quarrels have reduced impact (0.6x)

### Heal

**Purpose:** Restore target's health and cure disease.

**Requirements:** Target health < 85% of max, or target is diseased.

**Effect (every 500ms):**
```javascript
target.health = min(target.maxHealth, target.health + 2)
```

**Disease cure (Phase 5):** On heal completion, if the target is diseased, the disease is cured (diseased flag set to false).

### Share (formerly Help)

**Purpose:** Transfer inventory resources (food, water, wood) from sharer to target.

**Duration:** 300–500ms

**Energy cost:** 0.4/sec

**Effect (on completion):**
```javascript
// Transfer inventory resources from sharer to target
// Resources transferred: food, water, wood (up to target's inventory cap)
sharer.social += 8
target.social += 5
setRelationship(both agents, current + 0.14)
sharer.xp += 5
```

**Faction recruitment:** After sharing, there's a 50% chance to recruit the target if:
- Target is not in sharer's faction
- Relationship ≥ 0.4

## Combat Actions

### Attack

**Purpose:** Damage an opposing agent.

**Range:** Manhattan distance ≤ 2 (unique among actions)

**Effect (every 500ms):**
```javascript
target.health -= attacker.attack * 0.4
setRelationship(attacker, target, current - 0.2)
```

**Special cases:**
- If attacker and target are same faction:
  - 30% chance target leaves faction
  - Otherwise target may retaliate
- Attacker levels up on kill (if below level 20)

**No movement lock:** Targets can flee while being attacked.

## Reproduction

### Reproduce

**Purpose:** Create offspring.

**Requirements:**
- Adjacent partner (distance = 1)
- Relationship ≥ 0.1
- Both agents have energy ≥ 85
- Empty adjacent cell for child

**Costs:**
- Upfront reserve: 4 energy each
- On success: 12 energy each (total 16 each)

**Child properties:**
```javascript
child.energy = 60
child.health = 80
child.aggression = avg(parents.aggression)
child.cooperation = avg(parents.cooperation)
child.travelPref = random(parent.travelPref)
child.factionId = random(parent.factionId) // if either has faction
```

**Faction formation:** If both parents are factionless and relationship ≥ 0.6, they form a new faction together.

## Sleep Action

### Sleep

**Purpose:** Restore energy. This is the **only** way agents recover energy.

**Duration:** 8–12 seconds

**Effect (every 500ms):**
```javascript
agent.energy = min(agent.maxEnergy, agent.energy + 8)
```

**Total energy restored:** 128–192 (depending on duration)

**Trigger conditions:**
- **Mandatory:** energy < 20 (highest decision priority)
- **Voluntary:** energy < 40 (lower priority than combat response, low health, and urgent hunger)

**Properties:**
- Solo action (no target required)
- Agent is locked in place during sleep
- Interruptible by incoming attack
- Emoji: 😴

**XP:** Sleep does not grant XP.

## Resource Actions (Phase 2 & 3)

### Harvest (Food)

**Purpose:** Gather food from adjacent food blocks into agent inventory.

**Requirements:**
- Adjacent to a food block (Manhattan distance = 1)
- Inventory not full (total units < 20)
- Food block has units remaining

**Duration:** Depends on food quality:
- High Quality (HQ) food: 600ms per unit
- Low Quality (LQ) food: 1200ms per unit

**Effect (on completion):**
```javascript
foodBlock.units -= 1
agent.inventory.food += 1
agent.xp += 2  // harvest XP

if (foodBlock.units <= 0) {
  world.foodBlocks.delete(key(foodBlock.x, foodBlock.y))
}
```

**Properties:**
- Energy cost: 0.25 energy/sec
- Agent is locked in place during harvest
- Emoji: 🫨
- Blocked when inventory is full
- Food block depletes (removed from grid) when all units are harvested
- Multiple agents can harvest the same block simultaneously; they race for remaining units

### Harvest Water (Phase 3)

**Purpose:** Gather water from adjacent water blocks into agent inventory for drinking.

**Requirements:**
- Adjacent to a water block (Manhattan distance = 1)
- Inventory not full (total units < 20)
- Water block has units remaining

**Duration:** 1000ms per unit

**Effect (on completion):**
```javascript
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
```

**Properties:**
- Energy cost: 0.25 energy/sec
- Agent is locked in place during harvest
- Emoji: 🫨
- Blocked when inventory is full
- Water block depletes (removed from grid) when all units are harvested
- Large water blocks shrink to small (1-cell) when units drop to 25% threshold (≤5 units)

### Harvest Wood (Phase 3)

**Purpose:** Gather wood from adjacent tree blocks into agent inventory.

**Requirements:**
- Adjacent to a tree block (Manhattan distance = 1)
- Inventory not full (total units < 20)
- Tree block has units remaining

**Duration:** 1500ms per unit

**Effect (on completion):**
```javascript
treeBlock.units -= 1
agent.inventory.wood += 1
agent.xp += 2  // harvest XP

// Side effects (mutually exclusive):
// 10% chance: spawn seedling (🌱) on adjacent free cell
// 5% chance: spawn LQ food within 3-cell radius

if (treeBlock.units <= 0) {
  world.treeBlocks.delete(key(treeBlock.x, treeBlock.y))
}
```

**Properties:**
- Energy cost: 0.25 energy/sec
- Agent is locked in place during harvest
- Emoji: 🫨
- Blocked when inventory is full
- Tree block depletes (removed from grid) when all units are harvested
- 10% chance per harvest to spawn a seedling on an adjacent free cell
- 5% chance per harvest (instead of seedling) to spawn LQ food within 3-cell radius
- Wood harvesting is **opportunistic**: agents harvest when passing near trees, not as a high-priority seek action

### Eat

**Purpose:** Consume food from inventory to restore fullness.

**Requirements:**
- Agent has food in inventory (inventory.food > 0)

**Duration:** 300–500ms

**Effect (on completion):**
```javascript
agent.inventory.food -= 1
agent.fullness = min(100, agent.fullness + 20)
agent.xp += 5
levelCheck(world, agent)
```

**Properties:**
- No energy cost
- Solo action (no target required)
- Emoji: 🤔
- Grants +5 XP

### Drink

**Purpose:** Consume water from inventory to restore hygiene.

**Requirements:**
- Agent has water in inventory (inventory.water > 0)

**Duration:** 300–500ms

**Effect (on completion):**
```javascript
agent.inventory.water -= 1
agent.hygiene = min(100, agent.hygiene + 30)
```

**Properties:**
- No energy cost
- Solo action (no target required)
- Emoji: 🤔
- Water is obtained by harvesting water blocks (added in Phase 3)

## Faction Storage Actions (Phase 4)

### Deposit

**Purpose:** Transfer resources from agent inventory to faction flag storage.

**Requirements:**
- Adjacent to own faction flag (Manhattan distance = 1)
- Agent has inventory >= 3 total items

**Duration:** 300–500ms

**Effect (on completion):**
```javascript
// Transfer resources from agent inventory to flag storage
// Flag storage capacity: 30 per resource type (food, water, wood)
// Transfers as much as flag can hold
```

**Properties:**
- No energy cost
- Opportunistic: agents deposit when passing near their own flag with sufficient inventory
- Agent is locked in place during deposit

### Withdraw

**Purpose:** Take resources from faction flag storage into agent inventory.

**Requirements:**
- Adjacent to own faction flag (Manhattan distance = 1)
- Agent needs resources (food or water) and flag has stored resources
- Agent has inventory space

**Duration:** 300–500ms

**Effect (on completion):**
```javascript
// Transfer resources from flag storage to agent inventory
// Takes what the agent needs, up to inventory cap
```

**Properties:**
- No energy cost
- Triggered when agent needs food/water and is near own flag with stored resources
- Agent is locked in place during withdraw

### Pickup

**Purpose:** Collect resources from a loot bag on the ground.

**Requirements:**
- Loot bag on agent's cell or adjacent cell
- Agent has inventory space

**Duration:** 300–500ms

**Effect (on completion):**
```javascript
// Takes all contents from loot bag up to agent's inventory cap (20 total)
// If bag is emptied, it is removed
// If bag still has contents (agent was full), bag remains with reduced contents
```

**Properties:**
- No energy cost
- Checked before roaming in decision priority
- Agent is locked in place during pickup

## Loot Bags (Phase 4)

Loot bags (👝) are temporary resource containers that appear on the grid when agents die or faction flags are destroyed.

### Loot Bag Properties

| Property | Value |
|----------|-------|
| Emoji | 👝 |
| Passable | Yes |
| Decay timer | 30 seconds |
| Fade effect | Visual fade as decay timer counts down |

### Spawn Triggers

1. **Agent death:** A loot bag spawns at the agent's death location containing the agent's full inventory (food, water, wood).
2. **Flag destruction:** A loot bag spawns at the flag's location containing all resources stored in the flag.

### Merging

When multiple loot bags exist on the same cell, they merge into a single bag:
- All contents are combined
- The decay timer is reset to 30 seconds

### Pickup

Any agent can pick up a loot bag via the pickup action (300–500ms, no energy cost). The agent takes all contents up to their inventory cap.

## Inspiration Actions (Phase 6)

### Play

**Purpose:** Recover inspiration by interacting with nearby objects.

**Requirements:**
- Adjacent to any interactable block (food, water, tree, farm, poop, seedling, or flag — Manhattan distance = 1)

**Duration:** 1500–2500ms

**Energy cost:** 0.15/sec

**Effect (on completion):**
```javascript
agent.inspiration = min(100, agent.inspiration + 15)

// Hygiene penalty if near poop
if (adjacentToPoopBlock(agent)) {
  agent.hygiene = max(0, agent.hygiene - 3)
}
```

**Properties:**
- Agent is locked in place during play
- Emoji: 🤪
- Triggered when inspiration < 40 (decision priority 7c)
- Interactable blocks include: food blocks, water blocks, tree blocks, farms, poop blocks, seedlings, and faction flags

### Build Farm (Phase 6 — replaces old farm building)

**Purpose:** Construct a farm on an adjacent cell using wood resources.

**Requirements:**
- 3 wood in inventory
- 6 energy available
- Adjacent free cell available for farm placement

**Duration:** 2000ms (fixed)

**Energy cost:** 0.25/sec

**Effect (on completion):**
```javascript
agent.inventory.wood -= 3
// Energy is drained via the standard 0.25/sec mechanism during the action

// Spawn farm on adjacent free cell
const spot = findFreeAdjacentCell(agent)
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
```

**Properties:**
- Agent is locked in place during build
- Replaces the old random-chance farm building mechanic (no more % roll per tick)
- The farm blocks movement once placed
- Farm tracks spawn count and timer (see `docs/08-resources.md` for farm spawn system details)

## Hygiene Actions (Phase 5)

### Poop

**Purpose:** Involuntary action that spawns a poop block on the agent's cell.

**Duration:** 500–1000ms

**Energy cost:** None

**Trigger:** 10% chance per tick for 30 seconds after the agent completes an eat action. Only triggers when the agent is idle (no current action).

**Effect (on completion):**
```javascript
// Spawn poop block at agent's current cell
world.poopBlocks.set(key(agent.cellX, agent.cellY), {
  x: agent.cellX,
  y: agent.cellY,
  decayTimer: 30  // seconds
})
agent.hygiene -= 5
```

**Properties:**
- Solo action (no target required)
- Agent is locked in place during poop
- Emoji: 💩
- Will not spawn on interactable blocks (food, water, trees, farms, flags, walls, seedlings)
- Only one poop block per cell (no stacking)

### Clean

**Purpose:** Remove an adjacent poop block and gain inspiration.

**Duration:** 800–1200ms

**Energy cost:** 0.25/sec

**Requirements:**
- Adjacent to a poop block (Manhattan distance = 1)

**Effect (on completion):**
```javascript
world.poopBlocks.delete(key(poopBlock.x, poopBlock.y))
agent.inspiration += 10
```

**Properties:**
- Agent is locked in place during clean
- Opportunistic: agents clean when adjacent to poop blocks during normal state
- Grants +10 inspiration

---

## Action Mechanics

### Starting an Action

```javascript
function tryStartAction(agent, type, payload) {
  if (agent.action) return false  // Already acting
  const [min, max] = ACTION_DURATIONS[type]
  let duration = random(min, max)

  // Inspiration duration scaling (Phase 6)
  // Applied once at action creation time
  if (agent.inspiration < 20) {
    duration *= 1.5   // Sluggish when uninspired
  } else if (agent.inspiration > 70) {
    duration *= 0.75  // Efficient when inspired
  }

  agent.action = {
    type,
    remainingMs: duration,
    tickCounterMs: 0,
    payload
  }
  return true
}
```

### Processing an Action

Each tick:
1. Subtract tick duration from `remainingMs`
2. Add tick duration to `tickCounterMs`
3. Drain energy: `costPerMs * dtMs`
4. If `tickCounterMs >= 500`: reset and apply effects
5. Check distance requirements (cancel if violated)
6. When `remainingMs <= 0`: apply completion effects

### Distance Validation

```javascript
// During action processing
if (action.type === "attack") {
  if (distance > 2) cancel()
} else {
  if (distance !== 1) cancel()
}
```

### Locking

Actions that lock prevent movement:

```javascript
function lockAgent(world, agentId, ms) {
  agent.lockMsRemaining = max(agent.lockMsRemaining, ms)
}
```

Locks are applied to both agents for social actions. Locks are decremented each tick and expired agents can move again.

## Energy Costs (Total per Action)

| Action | Min Cost | Max Cost | Avg Cost |
|--------|----------|----------|----------|
| talk | 0.18 | 0.36 | 0.27 |
| quarrel | 0.36 | 0.72 | 0.54 |
| attack | 0.50 | 0.99 | 0.74 |
| heal | 1.35 | 2.70 | 2.03 |
| share | 0.12 | 0.20 | 0.16 |
| reproduce | 3.0 | 4.8 | 3.9 (+16 upfront) |
| sleep | 0 (restores 128–192) | -- | -- |
| harvest (HQ) | 0.15 | 0.15 | 0.15 |
| harvest (LQ) | 0.30 | 0.30 | 0.30 |
| harvest (water) | 0.25 | 0.25 | 0.25 |
| harvest (wood) | 0.375 | 0.375 | 0.375 |
| eat | 0 | 0 | 0 |
| drink | 0 | 0 | 0 |
| deposit | 0 | 0 | 0 |
| withdraw | 0 | 0 | 0 |
| pickup | 0 | 0 | 0 |
| poop | 0 | 0 | 0 |
| clean | 0.20 | 0.30 | 0.25 |
| play | 0.225 | 0.375 | 0.30 |
| build_farm | 0.50 | 0.50 | 0.50 |

> **Note:** Costs halved from previous version to balance with sleep-only energy recovery. Eat, drink, deposit, withdraw, pickup, and poop have zero energy cost. Play and build_farm added in Phase 6.

## Action Completion Effects

### XP Rewards

| Completion | XP |
|------------|-----|
| Kill (attack) | +50 |
| Eat (from inventory) | +5 |
| Heal complete | +10 |
| Share complete | +5 |
| Build farm | +15 |
| Harvest (per unit) | +2 |
| Clean complete | +0 (grants +10 inspiration instead) |
| Play complete | +0 (grants +15 inspiration instead) |

## Decision Priority (Action Selection)

Agents select actions based on the following priority order. Higher-priority needs override lower ones.

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 | Energy < 20 | Mandatory sleep |
| 2 | Under attack | Flee or retaliate |
| 3 | Health < 30% maxHP | Seek faction flag |
| 4 | Fullness < 20 | Urgent food seeking (eat from inventory > harvest adjacent food > pathfind to food) |
| 5 | Hygiene < 20 | Critical water seeking (drink from inventory > harvest adjacent water > pathfind to water) |
| 6 | Energy < 40 | Voluntary sleep |
| 7a | Fullness < 40 | Proactive food seeking (same priority as #4) |
| 7b | Hygiene < 40 | Proactive water seeking (same priority as #5) |
| 7c | Inspiration < 40 | Seek play (adjacent to interactable block) or clean poop block |
| 7c2 | In poop cooldown & idle & 10% roll | Poop action (involuntary, 30s window after eating) |
| 7d | Near own flag with inventory >= 3 | Deposit resources to faction flag (opportunistic) |
| 7e | Adjacent resource block & inventory not full | Harvest nearby resources (wood harvesting is opportunistic) |
| 7f | Loot bag nearby | Pickup loot bag |
| 7g | Adjacent poop block | Clean poop block (opportunistic) |
| 7h | Normal social/combat | Reproduction, attack, share/heal/talk |
| 7i | Nothing else to do | Roam |

### Faction Formation

After `talk`, `share`, or `heal`:
- If both agents are factionless
- And relationship ≥ 0.6
- Create new faction with both agents

### Faction Recruitment

After `share`:
- 50% chance if relationship ≥ 0.4
- Target joins sharer's faction (if different)
