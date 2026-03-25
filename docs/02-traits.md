# Agent Traits

Traits are personality attributes that influence agent behavior. Each agent has two primary traits: **aggression** and **cooperation**, both ranging from 0 to 1.

## Aggression

**Range:** 0.0 to 1.0 (randomly assigned at creation)

**Influence:** Determines likelihood of attacking nearby agents.

### Attack Decision Formula

When considering attacking a nearby agent:

```
baseProbability = aggression + (hasEnemyNearby ? 0.25 : 0) - relationshipPenalty

relationshipPenalty = max(0, bestRelationship) * 0.6

finalProbability = clamp(baseProbability, 0, 1)
```

### Behavioral Effects

| Aggression | Behavior |
|------------|----------|
| 0.0-0.3 | Rarely attacks, prefers peaceful interactions |
| 0.3-0.7 | Moderately aggressive, attacks when provoked |
| 0.7-1.0 | Highly aggressive, frequently initiates combat |

### Target Selection

When attacking, agents sort potential targets by:

1. **Relationship value** (lower = more likely target)
2. **Faction membership** (different faction = -0.5 bonus)
3. **Avoidance of friends** (85% chance to skip targets with relationship > 0.5)

## Cooperation

**Range:** 0.0 to 1.0 (randomly assigned at creation)

**Influence:** Determines likelihood of helping/healing nearby agents.

### Help Decision Formula

```
baseProbability = cooperation + (sameFactionNearby ? 0.25 : 0)
finalProbability = clamp(baseProbability, 0, 1)
```

### Help Target Selection

When helping, agents prioritize targets by:

1. **Same faction** (-0.3 bonus, higher priority)
2. **Health need** (lower health percentage = -0.2 bonus)

### Action Choice: Heal vs Help

```javascript
if (target.health < target.maxHealth * 0.85) {
  action = "heal"  // Restores 2 HP per tick
} else {
  action = "help"  // Transfers energy (10-20% of donor's energy)
}
```

## Travel Preference

While not strictly a "trait," travel preference is a fixed personality attribute assigned at birth.

### Values

| Value | Behavior |
|-------|----------|
| `"near"` | Stays close to faction flag or world center |
| `"far"` | Explores distant areas from flag/center |
| `"wander"` | Random movement, no preference |

### Near Behavior

Agents with `travelPref = "near"`:

1. Prefer destinations ~4 cells from faction flag
2. Avoid crowded areas (faction members within radius 2)
3. Without faction: gravitate toward world center (31, 31)

### Far Behavior

Agents with `travelPref = "far"`:

1. Actively move away from faction flag
2. Without faction: move toward world edges

### Wander Behavior

Agents with `travelPref = "wander"`:

1. Choose random destinations within range 6
2. No bias toward or away from any location

## Trait Inheritance

When agents reproduce, offspring inherit traits:

```javascript
child.aggression = clamp((parent1.aggression + parent2.aggression) / 2, 0, 1)
child.cooperation = clamp((parent1.cooperation + parent2.cooperation) / 2, 0, 1)
child.travelPref = (Math.random() < 0.5) ? parent1.travelPref : parent2.travelPref
```

## Interaction with Relationships

Traits work in tandem with the relationship system:

- **High aggression + negative relationship** = likely attack
- **High aggression + positive relationship** = unlikely attack (85% skip if rel > 0.5)
- **High cooperation + same faction** = likely to help/heal
- **Low cooperation** = rarely initiates help, may still talk

## Practical Examples

### The Peacemaker
- Aggression: 0.1, Cooperation: 0.9
- Rarely attacks, frequently helps faction members
- Ideal for maintaining faction cohesion

### The Lone Wolf
- Aggression: 0.8, Cooperation: 0.2
- Frequently attacks, rarely helps
- Likely to leave factions or form solo groups

### The Protector
- Aggression: 0.6, Cooperation: 0.8
- Defends faction (attacks outsiders) while supporting allies
- Balanced faction member

### The Drifter
- Aggression: 0.3, Cooperation: 0.3, travelPref: "wander"
- Low engagement, explores randomly
- Unlikely to form strong relationships
