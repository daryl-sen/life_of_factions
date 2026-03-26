# Actions

Actions are discrete behaviors agents perform. Each action has a duration, energy cost, and effects.

## Action Reference

| Action | Duration | Energy/sec | Distance | Locks | Emoji |
|--------|----------|------------|----------|-------|-------|
| `talk` | 0.9-1.8s | 0.2 | 1 | Yes | |
| `quarrel` | 0.9-1.8s | 0.4 | 1 | Yes | |
| `attack` | 0.45-0.9s | 1.1 | ≤2 | No | |
| `heal` | 0.9-1.8s | 1.5 | 1 | Yes | |
| `help` | 0.9-1.8s | 0.8 | 1 | Yes | |
| `reproduce` | 2.0-3.2s | 1.5 | 1 | Yes | |
| `sleep` | 8-12s | 0 (restores) | self | Yes | 😴 |

> **Note:** All action energy costs were halved in Phase 1 to account for the new sleep-based energy economy.

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

**Purpose:** Restore target's health.

**Requirements:** Target health < 85% of max.

**Effect (every 500ms):**
```javascript
target.health = min(target.maxHealth, target.health + 2)
```

### Help

**Purpose:** Share energy with another agent.

**Effect (on completion):**
```javascript
ratio = donor.energy > ENERGY_CAP * 0.7 ? 0.2 : 0.1
transfer = max(0, donor.energy * ratio)
donor.energy -= transfer
target.energy = min(ENERGY_CAP, target.energy + transfer)
```

**Faction recruitment:** After helping, there's a 50% chance to recruit the target if:
- Target is not in donor's faction
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

---

## Action Mechanics

### Starting an Action

```javascript
function tryStartAction(agent, type, payload) {
  if (agent.action) return false  // Already acting
  const [min, max] = ACTION_DURATIONS[type]
  agent.action = {
    type,
    remainingMs: random(min, max),
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
| help | 0.72 | 1.44 | 1.08 |
| reproduce | 3.0 | 4.8 | 3.9 (+16 upfront) |
| sleep | 0 (restores 128–192) | — | — |

> **Note:** Costs halved from previous version to balance with sleep-only energy recovery.

## Action Completion Effects

### XP Rewards

| Completion | XP |
|------------|-----|
| Kill (attack) | +50 |
| Eat (crop) | +5 |
| Heal complete | +10 |
| Share/help complete | +5 |
| Build farm | +15 |
| Harvest | +2 |

### Faction Formation

After `talk`, `help`, or `heal`:
- If both agents are factionless
- And relationship ≥ 0.6
- Create new faction with both agents

### Faction Recruitment

After `help`:
- 50% chance if relationship ≥ 0.4
- Target joins helper's faction (if different)
