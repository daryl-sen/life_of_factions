# Actions

Actions are discrete behaviors agents perform. Each action has a duration, energy cost, and effects.

## Action Reference

| Action | Duration | Energy/sec | Distance | Locks | Emoji |
|--------|----------|------------|----------|-------|-------|
| `talk` | 2.3-4.7s | 0.2 | 1 | Yes | |
| `quarrel` | 2.3-4.7s | 0.4 | 1 | Yes | |
| `attack` | 1.2-2.3s | 1.1 | ≤2 | No | |
| `heal` | 2.3-4.7s | 1.5 | 1 | Yes | |
| `share` | 0.8-1.3s | 0.4 | 1 | Yes | |
| `reproduce` | 5.2-8.3s | 1.5 | 1 | Yes | |
| `sleep` | 20.8-31.2s | 0 (restores) | self | Yes | 😴 |
| `harvest` | 1.6-3.9s | 0.25 | 1 (adjacent resource block) | Yes | 🫨 |
| `eat` | 0.8-1.3s | 0 | self (from inventory) | Yes | 🤔 |
| `wash` | 0.8-1.3s | 0 | self (from inventory) | Yes | 🤔 |
| `deposit` | 0.8-1.3s | 0 | 1 (adjacent own flag) | Yes | |
| `withdraw` | 0.8-1.3s | 0 | 1 (adjacent own flag) | Yes | |
| `pickup` | 0.8-1.3s | 0 | on cell or adjacent loot bag | Yes | |
| `poop` | 1.3-2.6s | 0 | self | Yes | 💩 |
| `clean` | 2.1-3.1s | 0.25 | 1 (adjacent poop block) | Yes | |
| `play` | 3.9-6.5s | 0.15 | 1 (adjacent interactable block) | Yes | 🤪 |
| `build_farm` | 5.2s | 0.25 | self (spawns on adjacent free cell) | Yes | |
| `build_house` | 5.2s | 0.3 | self (spawns adjacent tent) | Yes | 🏗️ |
| `upgrade_house` | 5.2s | 0.3 | 1 (adjacent owned house) | Yes | 🔨 |
| `enter_house` | 0.5s | 0 | 1 (adjacent accessible house) | Yes | |
| `exit_house` | 0.5s | 0 | self (inside house) | Yes | |
| `sleep_in_house` | 15.6-23.4s | 0 (restores) | self (inside house) | Yes | 😴 |

> **Note:** `harvest` is a single consolidated action covering food, water, and wood — the `resourceType` in the action payload determines which block type is harvested. The `wash` action (formerly `drink`) consumes water from inventory to restore hygiene.

## Housing Actions

### build_house

**Requirements:** 3+ wood in inventory, adult or elder, no owned house nearby.

**Effect (on completion):** Spawns a tent (⛺) on an adjacent free cell. The builder becomes owner. Awards 10 XP. Logs `'housing'` category event. Consumes 3 wood.

### upgrade_house

**Requirements:** Agent owns adjacent house; sufficient wood for next tier. Costs: tent→house: 5 wood, house→big_house: 8 wood, big_house→settlement: 12 wood.

**Effect (on completion):** Upgrades house to next tier in place. 1x1→2x2 upgrade expands to an adjacent free cell; aborts (refunds wood) if no expansion space.

| Current | Next | Wood Cost | Size |
|---------|------|-----------|------|
| ⛺ tent | 🏠 house | 5 | 1x1 |
| 🏠 house | 🏠 big_house | 8 | 2x2 |
| 🏠 big_house | 🏘️ settlement | 12 | 2x2 |

### enter_house / exit_house

Agents enter adjacent houses they own or that are vacant with capacity. Inside, agents are removed from the visible grid and cannot be targeted. Farms hold 1 occupant.

### sleep_in_house

Like `sleep` but with **1.5× energy recovery** (12 energy per 500ms vs 8). Only available when inside a house. Preferred over outdoor sleep when energy is low.

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

**Duration:** 0.8–1.3s

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

**Duration:** 20.8–31.2 seconds

**Effect (every 500ms):**
```javascript
agent.energy = min(agent.maxEnergy, agent.energy + 8)
```

**Total energy restored:** ~333–499 (depending on duration)

**Trigger conditions:**
- **Mandatory:** energy < 20 (highest decision priority)
- **Voluntary:** energy < 40 (lower priority than combat response, low health, and urgent hunger)

**Properties:**
- Solo action (no target required)
- Agent is locked in place during sleep
- Interruptible by incoming attack
- Emoji: 😴

**XP:** Sleep does not grant XP.

## Resource Actions

### Harvest

**Purpose:** Gather resources (food, water, or wood) from adjacent blocks into agent inventory. This is a single consolidated action — the `resourceType` in the action payload determines which block type is harvested.

**Requirements:**
- Adjacent to a resource block (Manhattan distance = 1)
- Inventory not full (total units < genetic capacity)
- Block has units remaining

**Duration:** 1.6–3.9s (from action registry). Actual duration varies by resource type and quality.

**Effect (on completion):**
```javascript
block.units -= 1
agent.inventory[resourceType] += 1
agent.xp += 2  // harvest XP

if (block.units <= 0) {
  // Block removed from grid
}
```

**Resource-specific behavior:**

| Resource | Block types | Notes |
|----------|-------------|-------|
| Food | HQ (farm-grown), LQ (wild) | Multiple agents can race for remaining units |
| Water | Small (5 units), Large (2×2, 20 units) | Large blocks shrink to small at ≤5 units |
| Wood | Trees (3–6 units) | 10% seedling spawn, 5% LQ food spawn per harvest. Opportunistic — agents don't actively seek wood |

**Properties:**
- Energy cost: 0.25 energy/sec
- Agent is locked in place during harvest
- Emoji: 🫨
- Blocked when inventory is full

### Eat

**Purpose:** Consume food from inventory to restore fullness.

**Requirements:**
- Agent has food in inventory (inventory.food > 0)

**Duration:** 0.8–1.3s

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

### Wash (formerly Drink)

**Purpose:** Consume water from inventory to restore hygiene.

**Requirements:**
- Agent has water in inventory (inventory.water > 0)

**Duration:** 0.8–1.3s

**Effect (on completion):**
```javascript
agent.inventory.water -= 1
agent.hygiene = min(100, agent.hygiene + 30)
```

**Properties:**
- No energy cost
- Solo action (no target required)
- Emoji: 🤔
- Water is obtained by harvesting water blocks

## Faction Storage Actions (Phase 4)

### Deposit

**Purpose:** Transfer resources from agent inventory to faction flag storage.

**Requirements:**
- Adjacent to own faction flag (Manhattan distance = 1)
- Agent has inventory >= 3 total items

**Duration:** 0.8–1.3s

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

**Duration:** 0.8–1.3s

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

**Duration:** 0.8–1.3s

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

**Duration:** 3.9–6.5s

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

**Duration:** 5.2s (fixed)

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

**Duration:** 1.3–2.6s

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

**Duration:** 2.1–3.1s

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
| talk | 0.47 | 0.94 | 0.70 |
| quarrel | 0.94 | 1.87 | 1.40 |
| attack | 1.29 | 2.57 | 1.93 |
| heal | 3.51 | 7.02 | 5.27 |
| share | 0.31 | 0.52 | 0.42 |
| reproduce | 7.80 | 12.48 | 10.14 (+energy upfront) |
| sleep | 0 (restores ~333–499) | -- | -- |
| harvest | 0.39 | 0.98 | 0.68 |
| eat | 0 | 0 | 0 |
| wash | 0 | 0 | 0 |
| deposit | 0 | 0 | 0 |
| withdraw | 0 | 0 | 0 |
| pickup | 0 | 0 | 0 |
| poop | 0 | 0 | 0 |
| clean | 0.52 | 0.78 | 0.65 |
| play | 0.59 | 0.98 | 0.78 |
| build_farm | 1.30 | 1.30 | 1.30 |

> **Note:** Eat, wash, deposit, withdraw, pickup, and poop have zero energy cost.

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
| 5 | Hygiene < 20 | Critical water seeking (wash from inventory > harvest adjacent water > pathfind to water) |
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
