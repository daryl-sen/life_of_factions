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
// After talk, help, or heal action completes
if (!agent1.factionId && !agent2.factionId) {
  relationship = getRelationship(agent1, agent2)
  if (relationship >= 0.6) {
    createFaction([agent1, agent2])
  }
}
```

**Condition 2: Help recruitment**
```javascript
// After help action completes
if (helper.factionId && !recipient.factionId) {
  if (random < 0.5 && getRelationship(helper, recipient) >= 0.4) {
    setFaction(recipient, helper.factionId)
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
  maxHp: 18
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

## Faction Membership

### Joining

Agents join factions through:

1. **Formation:** Creating a new faction with another agent
2. **Recruitment:** Being helped by a faction member (50% chance, rel ≥ 0.4)
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

  // Destroy flag
  flag = world.flags.get(fid)
  if (flag):
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

### 2. Food Sharing

- **Share:** 30% of harvested energy
- **Recipients:** Faction members within radius 5
- **Distribution:** Equal split among recipients

```javascript
function harvestAt(world, agent, x, y) {
  // ... harvest crop ...

  if (agent.factionId):
    recipients = agents where:
      factionId === agent.factionId
      id !== agent.id
      distance(agent, member) <= 5

    share = cropGain * 0.3  // 8.4 energy
    perRecipient = share / recipients.length
    for recipient in recipients:
      recipient.energy = min(ENERGY_CAP, recipient.energy + perRecipient)
}
```

### 3. Social Bonuses

- **Cooperation:** +0.25 probability when same-faction neighbors present
- **Talk:** 10% improved relationship gain
- **Quarrel:** 40% reduced relationship loss

### 4. Building Synergy

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
