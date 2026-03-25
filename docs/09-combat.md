# Combat

Combat is the primary mechanism of conflict and agent elimination.

## Attack Mechanics

### Attack Range

**Manhattan distance ≤ 2:**

```
  . X .    (distance 2)
  X A X    (distance 1)
  . X .    (distance 2)
```

Attack is the only action with range > 1. This allows:
- Attacking without being adjacent
- Kiting tactics (attack while moving away)
- Defense from a distance

### Attack Process

**Initiation:**
```javascript
function chooseAttack(world, agent, preferEnemies = false) {
  candidates = agents within distance 2
  if (preferEnemies):
    enemies = candidates where factionId differs
    if (enemies.length > 0):
      pool = enemies
      probability = 1.0
  else:
    pool = candidates
    probability = calculateAttackProbability(agent, candidates)

  if (random() >= probability) return false

  // Sort by relationship (lower = higher priority)
  // Different faction gets -0.5 bonus
  target = pool[0]

  // 85% chance to skip if relationship > 0.5
  if (getRelationship(agent, target) > 0.5 && random() < 0.85) return false

  startAttack(agent, target)
}
```

**Probability calculation:**
```javascript
hasEnemyNearby = any candidate has different faction
bestRel = max(relationship to each candidate)
relPenalty = max(0, bestRel) * 0.6

probability = clamp(
  agent.aggression
  + (hasEnemyNearby ? 0.25 : 0)
  - relPenalty,
  0, 1
)
```

### Attack Execution

**Duration:** 0.45-0.9 seconds (random)

**Tick interval:** Every 500ms

**Damage per tick:**
```javascript
target.health -= agent.attack * 0.4
setRelationship(agent, target, current - 0.2)
```

**Example damage output:**
| Level | Attack | Damage/Tick | DPS (approx) |
|-------|--------|-------------|--------------|
| 1 | 8.0 | 3.2 | ~4.3 |
| 5 | 14.0 | 5.6 | ~7.5 |
| 10 | 21.5 | 8.6 | ~11.5 |
| 20 | 36.5 | 14.6 | ~19.5 |

### Attack vs Other Actions

| Property | Attack | Other Actions |
|----------|--------|---------------|
| Range | ≤ 2 | = 1 |
| Duration | 0.45-0.9s | 0.9-1.8s |
| Locks target | No | Yes |
| Can flee | Yes (both) | No |

**Key difference:** Attack does NOT lock the target, allowing them to flee.

## Combat Scenarios

### Same-Faction Attack

When an agent attacks a faction mate:

```javascript
if (attacker.factionId === target.factionId):
  // 30% chance target is expelled
  if (random() < 0.3):
    target.factionId = null
  else:
    // Target may retaliate
    chooseAttack(world, target, false)
```

**Implications:**
- Internal conflict is punished
- Expelled agents lose faction benefits
- Retaliation is not guaranteed (based on target's aggression)

### Kill and Level Up

When an attack kills the target:

```javascript
if (target.health <= 0 && attacker.level < 20):
  attacker.level++
  attacker.maxHealth += 8
  attacker.attack += 1.5
  log("level", `${attacker.name} leveled to ${attacker.level}`)
```

**Kill requirements:**
- Attacker must be below level 20
- Target must die from the attack (health ≤ 0)

### Fleeing

Agents being attacked can flee:

```javascript
// Under attack check
for agent in agents:
  if (agent.action === "attack"):
    target._underAttack = true

// Movement check
locked = lockMsRemaining > 0 && !underAttack
if (!locked):
  // Can move even if normally locked
```

**Fleeing priority:**
1. Agents being attacked can move despite locks
2. No automatic flee behavior (just ability to move)
3. Path planning still required

## Defense

### Defensive Factors

| Factor | Effect |
|--------|--------|
| High health | Survives more hits |
| Faction healing | Regenerates near flag |
| Distance | Can kite attackers |
| Low relationship | Less likely to be targeted |

### Health Comparison

| Level | HP | Hits to Kill (from level 1) |
|-------|-----|------------------------------|
| 1 | 100 | ~32 ticks (~16 sec) |
| 5 | 132 | ~41 ticks (~20 sec) |
| 10 | 168 | ~53 ticks (~26 sec) |
| 20 | 240 | ~75 ticks (~37 sec) |

**Note:** These assume continuous attack. In practice, agents move, interact, and attack intermittently.

## Attack Decision Tree

```
                    ┌─────────────────┐
                    │ Agents nearby?  │
                    └────────┬────────┘
                             │ NO
                    ┌────────┴────────┐
                    │ No attack       │
                    └─────────────────┘
                             │ YES
                    ┌────────┴────────┐
                    │ Prefer enemies? │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
             YES            NO              │
              │              │               │
              ▼              ▼               │
    ┌──────────────┐  ┌──────────────┐      │
    │ Filter to    │  │ Calculate    │      │
    │ enemies      │  │ probability  │      │
    │ p=1.0        │  └────────┬─────┘      │
    └──────────────┘           │             │
                               │             │
                    ┌──────────┴──────────────┐
                    │ random < probability?   │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
             NO               YES               │
              │                │                 │
              ▼                ▼                 │
    ┌──────────────┐  ┌─────────────────┐       │
    │ No attack    │  │ Relationship >  │       │
    └──────────────┘  │ 0.5?            │       │
                      └────────┬────────┘       │
                               │                │
                    ┌──────────┼───────────┐    │
                   YES         │           NO   │
                    │          │              │
                    ▼          ▼              ▼
          ┌──────────────┐ ┌──────────────┐
          │ 85% skip     │ │ Sort targets │
          │ attack       │ │ by rel       │
          └──────────────┘ └──────┬───────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Attack best     │
                         │ target          │
                         └─────────────────┘
```

## Combat Statistics

### Average Combat Duration

| Scenario | Duration |
|----------|----------|
| Single attack | 0.45-0.9s |
| Fight to death (L1 vs L1) | ~16s |
| Fight to death (L10 vs L1) | ~8s |
| Fight to death (L1 vs L10) | ~32s |

### Energy Cost of Combat

**Per attack:**
```
avgDuration = 0.675 sec
costPerSec = 2.2
totalCost = 1.48 energy
```

**Sustained combat:**
```
attacksPerSecond = 1.5
energyPerSecond = 3.3
// Plus passive drain of 0.25
total = 3.55 energy/sec
```

An agent with 100 energy could fight for ~28 seconds before starving (ignoring health loss).

## Strategic Implications

### Aggression Trade-offs

**High aggression:**
- + More kills, faster leveling
- - More energy spent on attacks
- - More negative relationships
- - Risk of same-faction expulsion

**Low aggression:**
- + Energy preserved for other actions
- + Better relationships
- - Slower progression
- - Vulnerable to attackers

### Optimal Combat Behavior

1. **Target selection:** Attack weak, low-relationship targets
2. **Range advantage:** Use distance-2 attacks to kite
3. **Faction awareness:** Avoid attacking faction mates
4. **Energy management:** Retreat when energy < 40
