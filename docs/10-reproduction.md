# Reproduction

Reproduction is how agents create offspring, passing down traits and potentially forming new factions.

## Requirements

For reproduction to occur, all conditions must be met:

| Requirement | Value |
|-------------|-------|
| Adjacency | Distance = 1 |
| Relationship | ≥ 0.1 |
| Energy (each parent) | ≥ 85 |
| Empty adjacent cell | For child placement |

## Reproduction Process

### Step 1: Consideration

Reproduction is checked first among all interactions:

```javascript
function considerInteract(world, agent) {
  // Check all 4 adjacent cells
  for [nx, ny] in adjacent:
    partner = agent at (nx, ny)
    if (!partner) continue

    relationship = getRelationship(agent, partner)

    if (relationship >= 0.1 &&
        agent.energy >= 85 &&
        partner.energy >= 85) {

      startReproduction(agent, partner)
      return
    }
}
```

### Step 2: Commitment

When reproduction starts, both agents are locked:

```javascript
function startReproduction(agent, partner) {
  reserve = 4  // Upfront energy cost

  agent.energy -= reserve
  partner.energy -= reserve

  lockAgent(agent.id, duration)
  lockAgent(partner.id, duration)

  agent.action = {
    type: "reproduce",
    remainingMs: random(2000, 3200),  // 2-3.2 seconds
    tickCounterMs: 0,
    payload: { targetId: partner.id }
  }
}
```

### Step 3: Completion

After the duration elapses:

```javascript
function completeReproduction(world, agent, partner) {
  // Verify still adjacent
  if (manhattan(agent, partner) !== 1) return

  // Find empty adjacent cell
  spots = adjacent cells to agent
  freeSpot = first spot where !isBlocked(spot)

  if (!freeSpot) return  // No room for child

  // Final energy cost
  agent.energy -= 12
  partner.energy -= 12

  // Create child
  child = createChild(agent, partner, freeSpot)
}
```

## Child Properties

### Stats

| Property | Value |
|----------|-------|
| Energy | 60 |
| Health | 80 |
| Level | 1 |
| Attack | 8 (base) |
| Fullness | Transferred from parents (see below) |

### Fullness Transfer

Fullness is not materialized from nothing — it is transferred from the parents:

```
p1Donate = random(15, 25), capped at parent1.fullness
p2Donate = random(15, 25), capped at parent2.fullness
child.fullness = min(100, p1Donate + p2Donate)
parent1.fullness -= p1Donate
parent2.fullness -= p2Donate
```

### Baby Stage

Newborns begin in a baby stage lasting a random duration (~60s):

```
babyMs = random(50000, 70000)  // ms
```

While `babyMsRemaining > 0`:
- The agent displays the 👶 emoji
- No actions can be taken (only movement is allowed)
- The timer decrements each simulation tick until it reaches 0

### Inherited Traits

```javascript
child.aggression = clamp(
  (parent1.aggression + parent2.aggression) / 2,
  0, 1
)

child.cooperation = clamp(
  (parent1.cooperation + parent2.cooperation) / 2,
  0, 1
)

child.travelPref = (random() < 0.5)
  ? parent1.travelPref
  : parent2.travelPref
```

### Faction Inheritance

```javascript
pa = parent1.factionId || null
pb = parent2.factionId || null

if (pa && pb):
  // Both in factions - child picks one randomly
  childFaction = (random() < 0.5) ? pa : pb
else if (pa):
  childFaction = pa
else if (pb):
  childFaction = pb
else:
  childFaction = null

if (childFaction):
  setFaction(world, child, childFaction, "birth")
```

## Energy Economics

### Total Cost

| Cost Type | Amount (each parent) |
|-----------|---------------------|
| Upfront reserve | 4 |
| Action duration | ~2.2 (avg) |
| Completion (energy) | 12 |
| Completion (fullness) | 15–25 |
| **Total energy** | **~18.2** |
| **Total fullness** | **~15–25** |

### Energy After Reproduction

```
Starting energy: 85 (minimum)
- Reserve: 4
- Action cost: 2.2
- Completion: 12
= Remaining: 66.8
```

Both parents end up with ~67 energy, which is above the critical threshold (40) but below the comfortable zone.

### Recovery Time

To recover from reproduction:

```
targetEnergy = 100 (comfortable)
currentEnergy = 67
needed = 33

// Each crop gives 28 energy
cropsNeeded = ceil(33 / 28) = 2 crops
```

Parents need to harvest approximately 2 crops each to fully recover.

## Population Dynamics

### Breeding Rate

Assuming optimal conditions:

```
reproductionDuration = 2.6 sec (average)
recoveryTime = 2 crops * foragingTime

// If foraging takes 10 sec per crop:
totalCycleTime = 2.6 + 20 = 22.6 sec

// Maximum births per agent pair:
maxBirthsPerHour = 3600 / 22.6 = 159
```

**Realistic rate:** Much lower due to:
- Finding partners
- Energy constraints
- Competition for food
- Other activities

### Population Growth

**Exponential potential:**
```
Generation time: ~30 seconds
If all agents reproduce: 2x population per 30 sec

// After 5 minutes: 2^10 = 1024x
// After 10 minutes: 2^20 = 1,000,000x
```

**Limiting factors:**
1. **Food scarcity:** More agents = more competition
2. **Space:** Grid fills up, fewer free cells for children
3. **Energy:** Reproduction drains parents
4. **Death:** Combat and starvation remove agents

## Faction Implications

### New Faction Formation

When two factionless agents reproduce with relationship ≥ 0.6:

```javascript
if (!parent1.factionId && !parent2.factionId) {
  relationship = getRelationship(parent1, parent2)
  if (relationship >= 0.6):
    createFaction(world, [parent1, parent2])
}
```

This creates a new faction with:
- Both parents as members
- Child inherits the faction
- Flag placed near the family

### Faction Continuation

When parents are in factions:

| Parent 1 | Parent 2 | Child's Faction |
|----------|----------|-----------------|
| None | None | None (or new if rel ≥ 0.6) |
| A | None | A |
| None | B | B |
| A | A | A |
| A | B | A or B (50/50) |

## Reproduction Challenges

### Finding Space

Children need an empty adjacent cell:

```javascript
spots = [
  [agent.cellX + 1, agent.cellY],
  [agent.cellX - 1, agent.cellY],
  [agent.cellY, agent.cellY + 1],
  [agent.cellY, agent.cellY - 1]
]

freeSpot = first spot where !isBlocked(spot)
```

**Failure conditions:**
- All adjacent cells occupied
- All adjacent cells have walls/farms/flags

**Implication:** Reproduction fails in crowded areas, even with willing partners.

### Energy Management

**Optimal strategy:**
1. Build energy to 100+ (above minimum 85)
2. Reproduce (drops to ~67)
3. Recover with 1-2 crops
4. Repeat

**Risky strategy:**
1. Reproduce at minimum energy (85)
2. Drop to ~67, vulnerable to interruptions
3. May fall below critical (40) if delayed

## Reproduction Statistics

### Success Factors

| Factor | Impact |
|--------|--------|
| High relationship | Enables reproduction at all |
| Sufficient energy | Must both have 85+ |
| Adjacent partner | Must be distance 1 |
| Free cell | Must have space for child |
| No interruption | Action must complete |

### Average Outcomes

| Metric | Estimate |
|--------|----------|
| Energy cost per parent | ~18 |
| Duration | 2.6 seconds |
| Child starting energy | 60 |
| Child survival rate | Variable (depends on conditions) |
