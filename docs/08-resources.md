# Resources and Economy

Resources drive agent behavior. Energy is the primary currency, obtained through harvesting crops and shared within factions.

## Energy System

### Energy Properties

| Property | Value |
|----------|-------|
| Minimum | 0 |
| Starting | 100 |
| Cap | 200 |
| Passive drain | 0.0625 per tick (~0.25/sec) |

### Energy Thresholds

| Threshold | Value | Behavior |
|-----------|-------|----------|
| Starvation | 0 | Lose 1 HP/sec |
| Critical | 40 | Cancel actions, seek food urgently |
| Low | 70 | May seek food |
| Well-fed | 70+ | No active food seeking |
| Level-up | 140+ | Eligible for leveling |

### Energy Drain

**Passive drain:**
```javascript
agent.energy -= 0.0625  // Per tick
```

**Movement cost:**
```javascript
agent.energy -= 0.12  // Per cell moved
```

**Action costs (per second):**
- talk: 0.4
- quarrel: 0.8
- attack: 2.2
- heal: 3.0
- help: 1.6
- reproduce: 3.0

### Starvation

When energy reaches 0:

```javascript
if (agent.energy === 0):
  agent.health -= 1.0 * (tickMs / 1000)  // 1 HP per second
```

**Time to death at 0 energy:**
- Level 1 agent (100 HP): ~100 seconds
- Level 10 agent (162 HP): ~162 seconds
- Level 20 agent (238 HP): ~238 seconds

### Health Regeneration

When energy >= 80% of cap (160+):

```javascript
agent.health = min(agent.maxHealth, agent.health + 0.5 * (tickMs / 1000))
```

**Rate:** 0.5 HP per second when well-fed.

## Crops

### Crop Properties

| Property | Value |
|----------|-------|
| Energy gain | 28 |
| Global cap | 100 |
| Emojis | 🌿 🌱 🍀 🌾 🥕 🍅 🫛 |

### Crop Spawning

Crops spawn each tick based on:

1. **Global cap:** Maximum 100 crops
2. **Farm boost:** Higher probability near farms
3. **Spawn multiplier:** User-configurable (0.1x to 5x)

**Farm boost calculation:**
```javascript
for each potential spawn location:
  baseProbability = random()
  for each farm within radius 3:
    boost = (distance / radius)^2
    baseProbability *= boost

if (baseProbability < threshold) and (total crops < 100):
  spawn crop
```

### Harvesting

```javascript
function harvestAt(world, agent, x, y) {
  crop = world.crops.get(key(x, y))
  if (!crop) return false

  world.crops.delete(key(x, y))

  // Agent gains energy
  agent.energy = min(ENERGY_CAP, agent.energy + 28)

  // Level check
  levelCheck(world, agent)

  // Faction sharing
  if (agent.factionId):
    shareWithFactionMembers(agent)

  return true
}
```

### Faction Sharing

30% of harvested energy is shared:

```javascript
recipients = faction members within radius 5
share = 28 * 0.3 = 8.4 energy
perRecipient = 8.4 / recipients.length

for recipient in recipients:
  recipient.energy = min(200, recipient.energy + perRecipient)
```

**Example:** With 4 nearby faction members, each gets ~2.1 energy from another's harvest.

## Farms

### Farm Properties

| Property | Value |
|----------|-------|
| Build cost | 12 energy |
| Build chance | 3.125% per tick (when eligible) |
| Boost radius | 3 cells |
| Emoji | 🌻 |
| Blocks movement | Yes |

### Building Farms

Agents build farms when:

1. Energy >= 120 (well-fed)
2. Random check passes (1% per tick)
3. Adjacent free cell available

```javascript
function tryBuildFarm(world, agent) {
  if (agent.energy < 12) return
  if (random() >= 0.03125) return

  adjacent = getFreeAdjacentCells(agent)
  if (adjacent.length === 0) return

  spot = random(adjacent)
  world.farms.set(key(spot.x, spot.y), {id, x, y})
  agent.energy -= 12
}
```

### Farm Benefits

**Crop spawn boost:**
- Cells within radius 3 have increased spawn probability
- Boost decreases with distance from farm
- Multiple farms stack multiplicatively

**Strategic value:**
- Creates local food abundance
- Reduces foraging time
- Benefits all agents (not just builder)

## Economy Balance

### Energy Flow

```
Harvest (+28)
    │
    ├─→ Agent keeps 70% (+19.6)
    └─→ Faction shares 30% (+8.4 total)

    ▼
Spending:
  - Passive: ~0.25/sec
  - Movement: 0.12/step
  - Actions: 0.4-3.0/sec
  - Building: 12 (farm)
  - Reproduction: 16 total (12 + 4 reserve)
```

### Sustainability Calculation

**Minimum harvest rate to survive:**

```
passiveDrain = 0.25/sec
movementDrain = 0.12 * stepsPerSec
actionDrain = varies

// Assuming 2 steps/sec and minimal actions:
totalDrain = 0.25 + 0.24 = 0.49/sec
harvestNeeded = 0.49 / 19.6 = 0.025 harvests/sec
// One harvest every 40 seconds minimum
```

**With faction sharing (4 members):**
```
sharedPerHarvest = 8.4 / 4 = 2.1
effectiveGain = 19.6 + 2.1 = 21.7
harvestNeeded = 0.49 / 21.7 = 0.023 harvests/sec
// Slight improvement with faction
```

### Scarcity Dynamics

| Crops/Agent Ratio | Behavior |
|-------------------|----------|
| < 0.25 | Path budget halved (congestion prevention) |
| < 0.35 | Food field used for seeking |
| 0.35-1.0 | Normal seeking behavior |
| > 1.0 | Abundant, minimal food seeking |

## Leveling

### Level-Up Trigger

When energy exceeds 70% of cap after gaining energy:

```javascript
function levelCheck(world, agent) {
  if (agent.level >= 20) return  // Cap

  if (agent.energy > 140):  // 70% of 200
    agent.level++
    agent.maxHealth += 8
    agent.attack += 1.5
    agent.energy = 140  // Reset
}
```

### Level Progression

| Level | Max Health | Attack |
|-------|------------|--------|
| 1 | 100 | 8.0 |
| 5 | 132 | 14.0 |
| 10 | 168 | 21.5 |
| 15 | 204 | 29.0 |
| 20 | 240 | 36.5 |

**Formula:**
- `maxHealth = 100 + (level - 1) * 8`
- `attack = 8 + (level - 1) * 1.5`

### Level Cap

Level 20 is the maximum. Agents at level 20:
- Cannot level up further
- Continue to cap energy at 200
- Have maximum stats (240 HP, 36.5 attack)
