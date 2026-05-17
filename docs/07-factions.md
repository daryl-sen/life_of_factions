# Factions

Factions are groups of agents bound by strong relationships. They provide structure, benefits, and territorial markers in the simulation.

## Faction Structure

```javascript
{
  id: string,              // 6-character pronounceable name
  members: Set<string>,    // Agent IDs
  color: string            // Display color
}
```

### Faction Colors

Eight predefined colors, assigned in order:

| Index | Color | Hex |
|-------|-------|-----|
| 0 | Red | #ff5252 |
| 1 | Blue | #42a5f5 |
| 2 | Green | #66bb6a |
| 3 | Orange | #ffa726 |
| 4 | Purple | #ab47bc |
| 5 | Cyan | #26c6da |
| 6 | Pink | #ec407a |
| 7 | Brown | #8d6e63 |

Colors recycle if more than 8 factions exist.

## Faction Formation

### Automatic Formation

Factions form automatically under these conditions:

**Condition 1: Social bonding**
```javascript
// After talk, share, or heal action completes
if (!agent1.factionId && !agent2.factionId) {
  relationship = getRelationship(agent1, agent2)
  if (relationship >= 0.6) {
    createFaction([agent1, agent2])
  }
}
```

**Condition 2: Share recruitment**
```javascript
// After share action completes
if (sharer.factionId && !recipient.factionId) {
  if (random < 0.5 && getRelationship(sharer, recipient) >= 0.4) {
    setFaction(recipient, sharer.factionId)
  }
}
```

### Creating a Faction

```javascript
function createFaction(world, members) {
  fid = generatePronounceableString(6)
  color = nextAvailableColor()
  world.factions.set(fid, {id, members: new Set(), color})

  for agent in members:
    agent.factionId = fid
    faction.members.add(agent.id)

  placeFlag(fid, members)
}
```

## Faction Flags

### Flag Placement

When a faction forms, a flag is placed:

```javascript
// Calculate centroid of members
centroidX = average(member.cellX for member in members)
centroidY = average(member.cellY for member in members)

// Try centroid first, fall back to random free cell
if (isBlocked(centroidX, centroidY)):
  spot = randomFreeCell()
else:
  spot = {centroidX, centroidY}

flag = {
  id: uuid(),
  factionId: fid,
  x: spot.x,
  y: spot.y,
  hp: random(12, 18),
  maxHp: 18,
  storage: { food: 0, water: 0, wood: 0 }  // Phase 4
}
```

### Flag Properties

| Property | Value |
|----------|-------|
| Health | 12-18 (random) |
| Max Health | 18 |
| Heal Aura Radius | 4 cells |
| Heal Aura Rate | 3.75 HP/tick |
| Blocks movement | Yes |
| Storage capacity (Phase 4) | 30 per resource type (food, water, wood) |

### Healing Aura

Agents within radius 4 of their faction flag regenerate health:

```javascript
function applyFlagHealing(world) {
  for agent in agents:
    if (!agent.factionId) continue
    flag = world.flags.get(agent.factionId)
    if (!flag) continue

    distance = manhattan(agent.cellX, agent.cellY, flag.x, flag.y)
    if (distance <= 4):
      agent.health = min(agent.maxHealth, agent.health + 3.75)
}
```

**Effective healing:** ~15 HP per tick (at 40ms tick rate)

### Flag Storage (Phase 4)

Faction flags serve as communal resource storage for faction members. Each flag can store up to 30 units of each resource type (food, water, wood).

#### Depositing Resources

Agents deposit resources into their faction flag when they are adjacent to the flag and have >= 3 items in inventory. This is an opportunistic action -- agents deposit when passing near their flag, not as a high-priority seek action.

```javascript
function tryDeposit(world, agent, flag) {
  if (manhattanDistance(agent, flag) !== 1) return false
  if (agent.factionId !== flag.factionId) return false
  if (agent.inventoryTotal() < 3) return false

  // Start deposit action (300-500ms, no energy cost)
  // On completion: transfer resources from inventory to flag storage
  // Respects flag storage cap of 30 per type
}
```

#### Withdrawing Resources

Agents withdraw resources from their faction flag when they need food or water and are adjacent to the flag with stored resources.

```javascript
function tryWithdraw(world, agent, flag) {
  if (manhattanDistance(agent, flag) !== 1) return false
  if (agent.factionId !== flag.factionId) return false
  // Agent must need resources (e.g., low fullness or hygiene)
  // Flag must have relevant stored resources

  // Start withdraw action (300-500ms, no energy cost)
  // On completion: transfer resources from flag storage to inventory
  // Respects agent inventory cap of 20 total
}
```

#### Flag Destruction and Loot

When a faction flag is destroyed, all stored resources are dropped as a loot bag (👝) at the flag's location. This makes flag destruction strategically significant -- destroying an enemy flag not only removes their healing aura but also makes their stored resources available for pickup.

```javascript
function destroyFlag(world, flag) {
  // If flag has stored resources, spawn a loot bag
  if (flag.storage.food > 0 || flag.storage.water > 0 || flag.storage.wood > 0) {
    spawnLootBag(world, flag.x, flag.y, {
      food: flag.storage.food,
      water: flag.storage.water,
      wood: flag.storage.wood
    })
  }

  world.flagCells.delete(key(flag.x, flag.y))
  world.flags.delete(flag.factionId)
}
```

## Faction Membership

### Joining

Agents join factions through:

1. **Formation:** Creating a new faction with another agent
2. **Recruitment:** Being shared with by a faction member (50% chance, rel ≥ 0.4)
3. **Birth:** Inheriting from parent(s)

**Inheritance rules:**
```javascript
if (parent1.factionId && parent2.factionId):
  child.factionId = random(parent1.factionId, parent2.factionId)
else if (parent1.factionId):
  child.factionId = parent1.factionId
else if (parent2.factionId):
  child.factionId = parent2.factionId
else:
  child.factionId = null
```

### Leaving

Agents leave factions by:

1. **Attacking same-faction member:** 30% chance to be expelled
2. **Death:** Removed from faction
3. **Disbanding:** All members become factionless

**Expulsion trigger:**
```javascript
if (attacker.factionId === target.factionId):
  if (random < 0.3):
    target.factionId = null  // Expelled
  else:
    target may retaliate
```

### Faction Disbanding

A faction disbands when it has 0-1 living members:

```javascript
function _disbandFaction(world, fid, reason) {
  faction = world.factions.get(fid)
  if (!faction) return

  // Remove factionId from all members
  for memberId in faction.members:
    agent = world.agentsById.get(memberId)
    if (agent):
      agent.factionId = null

  // Destroy flag (drops stored resources as loot bag)
  flag = world.flags.get(fid)
  if (flag):
    if (flag.storage.food > 0 || flag.storage.water > 0 || flag.storage.wood > 0):
      spawnLootBag(world, flag.x, flag.y, flag.storage)
    world.flagCells.delete(key(flag.x, flag.y))
    world.flags.delete(fid)

  // Remove faction
  world.factions.delete(fid)
}
```

## Faction Benefits

### 1. Healing Aura

- **Radius:** 4 cells from flag
- **Rate:** 3.75 HP per tick
- **Requirement:** Must be faction member

### 2. Flag Resource Storage (Phase 4)

- **Storage capacity:** 30 per resource type (food, water, wood)
- **Deposit:** Agents deposit when near own flag with >= 3 inventory items (300–500ms, no energy cost)
- **Withdraw:** Agents withdraw when needing food/water and near own flag (300–500ms, no energy cost)
- **Loot on destruction:** All stored resources drop as a loot bag (👝) when the flag is destroyed

### 3. Resource Sharing (Phase 4)

- **Share action:** Agents transfer inventory resources (food, water, wood) to other agents
- **Duration:** 300–500ms
- **Cost:** 0.4 energy/sec
- **Social bonus:** +8 social for sharer, +5 social for recipient
- **Relationship:** +0.14 for both agents
- **XP:** +5 for sharer
- **Recruitment:** 50% chance at relationship >= 0.4

### 4. Social Bonuses

- **Cooperation:** +0.25 probability when same-faction neighbors present
- **Talk:** 10% improved relationship gain
- **Quarrel:** 40% reduced relationship loss

### 5. Building Synergy

- Faction members cluster near flags
- Farms built by members create local food abundance
- Shared food benefits nearby members

## Faction Reconciliation

Factions are reconciled every 4 ticks:

```javascript
function reconcileFactions(world) {
  // Rebuild faction membership from agent.factionId values
  actual = new Map()
  for agent in agents:
    if (agent.factionId):
      actual.get(agent.factionId).add(agent.id)

  // Create missing factions, update member counts
  // Disband factions with <= 1 members
  // Place flags for factions without flags
}
```

## Territories

Each faction has a **territory** — a circular region centered on its flag. The territory radius starts at 10 cells and grows as the faction gains members.

```
radius = min(25, 10 + floor(memberCount / 5))
```

| Members | Radius |
|---------|--------|
| 1–4     | 10     |
| 5–9     | 11     |
| 10–14   | 12     |
| 25+     | 15     |
| 75+     | 25 (cap) |

### Territory Effects on Behavior

Faction members inside their **own territory** receive behavioral modifiers scaled by their `AR` (Tribalism) trait:

- **Social/helpful actions** toward allies are boosted (+60 × territorialSensitivity)
- **Combat actions** against enemies are boosted (+80 × territorialSensitivity)

Members inside an **enemy faction's territory** receive:

- **Attack against territory owners** is slightly boosted (+50 × territorialSensitivity)

Faction-less agents (not belonging to any faction) are unaffected by territorial modifiers.

### Wandering vs. Staying (Nomadism Gene)

The `AQ` (Nomadism) trait controls whether an agent tends to stay near their faction's flag or wander beyond the territory:

- **High wanderBias** (high Nomadism): agent explores freely outside territory
- **Low wanderBias** (low Nomadism): agent prefers to stay inside territory; deposit actions are boosted when out of territory, pulling the agent back toward the flag

### Farm Construction

Faction members may only build farms **within their faction's territory radius**. Agents who wander outside their territory lose the ability to build until they return. Faction-less agents have no building restriction.

### Territory Overlap

Territories can overlap. When two factions' territories intersect, the resulting competition naturally encourages conflict:

- Members of each faction may become more aggressive toward each other inside the overlap
- Combat and conversion events reduce opposing faction populations, which reduces their territory radius
- The faction that consistently wins will expand while the loser contracts

### Territory Display

Territory boundaries can be toggled via the **Show faction territories** checkbox in the Interaction Tools panel. Each faction's territory is rendered as a semi-transparent filled circle with a dashed border in the faction's color.

## Strategic Implications

### Advantages of Factions

1. **Survival:** Healing aura extends lifespan
2. **Efficiency:** Food sharing reduces individual foraging
3. **Defense:** Group cohesion against outsiders
4. **Growth:** Easier reproduction with stable energy

### Disadvantages

1. **Internal conflict:** Same-faction attacks cause expulsion
2. **Crowding:** Near flags can be congested
3. **Targeting:** Faction members may be targeted by outsiders

### Optimal Faction Size

- **Too small (< 3):** Limited food sharing, flag may be vulnerable
- **Ideal (5-15):** Good sharing, manageable crowding
- **Too large (> 20):** Crowding near flag, per-member sharing decreases
