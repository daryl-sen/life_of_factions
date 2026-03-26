# Resources and Economy

Resources drive agent behavior. Energy and fullness are the two primary survival resources. Energy is restored only via sleep; fullness is restored by eating crops.

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
- help: 0.8
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
| Recovery | Eating crops: +20 fullness |

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

## Placeholder Needs

The following needs are tracked on agents but have no gameplay effect in Phase 1:

| Need | Starting Value | Range |
|------|---------------|-------|
| Hygiene | 100 | 0–100 |
| Social | 50 | 0–100 |
| Inspiration | 50 | 0–100 |

## Crops

### Crop Properties

| Property | Value |
|----------|-------|
| Fullness gain | +20 |
| XP gain | +5 (eat) / +2 (harvest) |
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

  // Agent gains fullness (not energy)
  agent.fullness = min(100, agent.fullness + 20)

  // XP gain
  agent.xp += 5  // eat XP

  // Level check (XP-based)
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

### Resource Flows

```
Eating Crop:
  → +20 fullness (not energy)
  → +5 XP
  → Faction sharing (fullness-based)

Sleep Action (8–12s):
  → +8 energy per 500ms tick
  → Total: 128–192 energy restored

Energy Drains:
  - Passive: ~0.25/sec
  - Movement: 0.12/step
  - Actions: 0.2–1.5/sec (halved from v1.3)
  - Building: 12 (farm)

Fullness Drains:
  - Passive: ~0.03/tick
  - Movement: 0.08/step
  - Actions: 0.02/sec
```

### Sustainability Calculation

**Minimum harvest rate to avoid fullness starvation:**

```
passiveDecay = 0.03/tick (~0.75/sec at 40ms ticks)
movementDecay = 0.08 * stepsPerSec
actionDecay = 0.02/sec

// Assuming 2 steps/sec and minimal actions:
totalDecay = 0.75 + 0.16 + 0.02 = 0.93/sec
harvestsNeeded = 0.93 / 20 = 0.047 harvests/sec
// One harvest every ~21 seconds minimum
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
| Eat (crop) | +5 |
| Heal complete | +10 |
| Share complete | +5 |
| Build farm | +15 |
| Harvest | +2 |

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
