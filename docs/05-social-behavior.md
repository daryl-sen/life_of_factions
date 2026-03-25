# Social Behavior

Social behavior encompasses all interactions between agents: relationship management, faction dynamics, and interpersonal actions.

## Relationship System

### Relationship Values

Relationships are bidirectional values stored per agent pair:

```javascript
agent.relationships = Map<agentId, number>  // Range: -1.0 to 1.0
```

| Value Range | Meaning |
|-------------|---------|
| -1.0 to -0.5 | Hostile |
| -0.5 to -0.1 | Unfriendly |
| -0.1 to 0.1 | Neutral (stored as 0, not kept) |
| 0.1 to 0.5 | Friendly |
| 0.5 to 1.0 | Close |

### Storage Optimization

- Values with absolute value < 0.02 are deleted (considered neutral)
- Each agent stores at most 80 relationships
- Weakest relationships are pruned first when limit reached

### Relationship Modification

#### Positive Changes

| Action | Delta | Conditions |
|--------|-------|------------|
| talk | +0.14 (75%) | Same faction: +0.154 |
| talk | -0.06 (25%) | Same faction: -0.048 |
| quarrel | +0.1 (50%) | Same faction: +0.06 |
| heal | implicit | Healer gains favor |
| help | implicit | Recipient gains favor |
| reproduction | implicit | Parents' bond strengthens |

#### Negative Changes

| Action | Delta | Conditions |
|--------|-------|------------|
| attack | -0.2 | Per tick of attack |
| quarrel | -0.1 (50%) | Same faction: -0.06 |
| talk | -0.06 (25%) | Same faction: -0.048 |

## Interaction Selection

### Neighbor Discovery

Agents check 4 adjacent cells (N, S, E, W) for interaction targets:

```javascript
adjacent = [
  [cellX + 1, cellY],
  [cellX - 1, cellY],
  [cellX, cellY + 1],
  [cellX, cellY - 1]
]
```

### Attack Selection

Attack candidates include agents within Manhattan distance 2:

```javascript
// 5x5 area excluding center and corners (distance > 2)
for dx in -2..2:
  for dy in -2..2:
    if manhattan(dx, dy) in [1, 2]:
      consider agent at (cellX + dx, cellY + dy)
```

**Target sorting:**
1. Different faction agents prioritized (-0.5 bonus)
2. Lower relationship = higher priority
3. 85% chance to skip targets with relationship > 0.5

### Help/Heal Selection

**Target sorting:**
1. Same faction members prioritized (-0.3 bonus)
2. Lower health percentage = higher priority (-0.2 bonus)

**Action choice:**
- `heal` if target health < 85% of max
- `help` (energy transfer) otherwise

## Faction Dynamics

### Faction Formation Thresholds

| Condition | Threshold |
|-----------|-----------|
| Relationship to form faction | ≥ 0.6 |
| Minimum faction size | 2 members |
| Help recruitment relationship | ≥ 0.4 |
| Help recruitment chance | 50% |

### Automatic Faction Creation

Factions form automatically when:

1. Two factionless agents complete `talk`, `help`, or `heal`
2. Their relationship is ≥ 0.6
3. New faction is created with unique ID and color
4. Flag is placed near the faction members

### Faction Disbanding

A faction is disbanded when:

1. Only 0-1 living members remain
2. Last member dies or leaves
3. All members leave voluntarily

**On disbanding:**
- All members become factionless
- Flag is destroyed
- Members' factionId is set to null

### Faction Loyalty

Agents stay loyal to factions through:

1. **Proximity bonus:** +0.25 to cooperation probability when same-faction neighbors present
2. **Healing aura:** Regenerate health near faction flag
3. **Food sharing:** 30% of harvested energy shared with nearby faction members

## Quarrel Behavior

Quarrels occur as an alternative to talking:

```javascript
target = random(adjacent neighbors)
relationship = getRelationship(agent, target)

if (relationship < 0 && random < 0.5) {
  action = "quarrel"  // Argue with someone you dislike
} else {
  action = "talk"     // Friendly conversation
}
```

**Quarrel outcomes:**
- 50% chance to improve relationship (made up)
- 50% chance to worsen relationship (argument escalated)
- Same-faction quarrels have reduced impact

## Energy Sharing

When harvesting crops, faction members share energy:

```javascript
if (harvester.factionId) {
  recipients = factionMembers within radius 5
  share = cropGain * 0.3  // 30% of harvest
  perRecipient = share / recipients.length
  for recipient in recipients:
    recipient.energy += perRecipient
}
```

**Implications:**
- Strong incentive to form factions
- Clustered factions benefit more (more recipients nearby)
- 30% overhead for sharing (harvester keeps 70%)

## Social Priority

When multiple interactions are possible:

1. **Reproduction** (highest priority)
2. **Attack** (if energy < 40 or aggression triggers)
3. **Help/Heal** (if cooperation triggers)
4. **Talk/Quarrel** (fallback social action)

## Relationship Decay

Relationships do NOT decay over time. Once established, they persist until:
- Modified by another interaction
- Pruned due to memory limits
- One agent dies

This means early interactions have lasting impact on agent behavior.
