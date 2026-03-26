# Agent Decision Making

This document explains the decision-making process agents use each simulation tick.

## The Decision Loop

Each tick, agents follow this decision hierarchy:

```
1. Process current action (if any)
2. If not acting:
   a. Energy < 20: mandatory sleep
   b. Under attack: flee or retaliate
   c. Health < 30% maxHP: seek faction flag for healing
   d. Fullness < 20: urgent food seeking
   e. Energy < 40: voluntary sleep
   f. Normal state:
      - Fullness < 40: proactive food seeking
      - Reproduction, attack, help/heal/talk
      - Roam
```

## State Machine

### State 1: Acting

If `agent.action` is not null:

1. Decrement `remainingMs` by tick duration
2. Drain energy based on action cost
3. Apply periodic effects (every 500ms)
4. Check distance requirements
5. On completion: apply final effects, clear action

**Action cancellation:**
- If target moves out of range
- Sleep is interruptible by attack

### State 2: Moving

If agent has a valid path (`path` and `pathIdx < path.length`):

1. Move to next path cell (if not blocked)
2. Harvest crop if landing on one
3. Advance `pathIdx`
4. Drain movement energy (0.12 per step)

**Path invalidation:**
- If target cell becomes blocked
- Path is cleared, agent replans next tick

### State 3: Deciding

When not acting and not moving, agents follow the priority-based decision hierarchy:

```
if (energy < 20) {
  startSleep()                    // Mandatory sleep
} else if (underAttack) {
  fleeOrRetaliate()               // Survival response
} else if (health < maxHealth * 0.3) {
  seekFactionFlag()               // Seek healing aura
} else if (fullness < 20) {
  seekFoodUrgently()              // Urgent food seeking
} else if (energy < 40) {
  startSleep()                    // Voluntary sleep
} else {
  // Normal state
  if (fullness < 40) {
    seekFoodProactively()         // Proactive food seeking
  } else {
    considerInteract()            // Reproduce, attack, help/heal/talk
    if (!action && !path) {
      biasedRoam()
    }
  }
}
```

## Priority System

### Priority 1: Mandatory Sleep (energy < 20)
Agent immediately begins sleep action. Cannot be overridden except by attack interruption.

### Priority 2: Under Attack
Flee or retaliate based on personality traits.

### Priority 3: Low Health (health < 30% maxHP)
Seek nearest faction flag for healing aura.

### Priority 4: Urgent Hunger (fullness < 20)
1. **Harvest** - If standing on crop
2. **Move to food** - Use food field or pathfinding

### Priority 5: Voluntary Sleep (energy < 40)
Agent chooses to sleep to restore energy before it becomes critical.

### Priority 6: Normal State
1. **Proactive food seeking** - If fullness < 40, seek crops
2. **Interact** - Consider reproduction, combat, social actions
3. **Roam** - Biased wandering based on travel preference
4. **Build** - 1% chance to build farm if energy >= 120

## Path Planning Budget

Pathfinding is expensive, so a budget system limits replanning:

```javascript
// Each tick:
budget = scarcity < 0.25 ? max(6, floor(maxBudget * 0.5)) : maxBudget

// Eligible agents sorted by energy (hungry first)
eligible = agents where (!locked && (!path || pathComplete) && !acting)

// Round-robin selection from eligible
selected = min(budget, eligible.length)
```

**Scarcity impact:** When crops are scarce (< 25% of agents), path budget is halved to prevent congestion.

## The Interaction Consideration

`considerInteract(world, agent)` is called when agents are well-fed and not moving:

1. **Reproduction check** - If adjacent partner has sufficient relationship and energy
2. **Attack check** - Based on aggression and nearby agents
3. **Social check** - Help, heal, talk, or quarrel with neighbors

See [Social Behavior](05-social-behavior.md) for details.

## Movement Locks

Agents are locked in place during certain actions:

**Locking actions:**
- `talk`, `quarrel`, `heal`, `help`, `reproduce`, `sleep`

**Non-locking actions:**
- `attack` (agents can flee while being attacked)

**Sleep interruption:**
- Sleep is interruptible by incoming attack

**Lock exceptions:**
- If locked agent is being attacked, they can move

## Food Field System

For efficient food seeking, a distance field is maintained:

1. Multi-source BFS from all crop locations
2. Stored in `world.foodField` (62×62 array)
3. Recomputed every 5 ticks or when crops change
4. Agents step toward decreasing distance values

**Scarcity threshold:** Food field is used when crops/agents < 0.35 ratio.

## Decision Flowchart

```
                    ┌─────────────────┐
                    │  Has action?    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
             YES            NO              │
              │              │               │
              ▼              ▼               │
    ┌──────────────┐  ┌──────────────────┐  │
    │ Process      │  │ energy < 20?     │  │
    │ action       │  └────────┬─────────┘  │
    └──────────────┘      YES  │  NO        │
                           │   │            │
                           ▼   ▼            │
                    ┌────────┐ ┌───────────────┐
                    │ SLEEP  │ │ Under attack? │
                    │(mand.) │ └───────┬───────┘
                    └────────┘    YES  │  NO
                                  │   │
                                  ▼   ▼
                           ┌────────┐ ┌────────────────┐
                           │ Flee / │ │ HP < 30% max?  │
                           │ Fight  │ └───────┬────────┘
                           └────────┘    YES  │  NO
                                         │   │
                                         ▼   ▼
                                  ┌────────┐ ┌────────────────┐
                                  │ Seek   │ │ fullness < 20? │
                                  │ flag   │ └───────┬────────┘
                                  └────────┘    YES  │  NO
                                                │   │
                                                ▼   ▼
                                         ┌────────┐ ┌────────────────┐
                                         │ Urgent │ │ energy < 40?   │
                                         │ food   │ └───────┬────────┘
                                         └────────┘    YES  │  NO
                                                       │   │
                                                       ▼   ▼
                                                ┌────────┐ ┌──────────────┐
                                                │ SLEEP  │ │ Normal state │
                                                │(vol.)  │ └──────┬───────┘
                                                └────────┘        │
                                                     ┌────────────┼────────────┐
                                                     │            │            │
                                               fullness<40   fullness>=40   energy>=120
                                                     │            │            │
                                                     ▼            ▼            ▼
                                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                                              │ Seek     │ │ Consider │ │ 1% build │
                                              │ food     │ │ interact │ │ farm     │
                                              └──────────┘ └────┬─────┘ └──────────┘
                                                                │
                                                                ▼
                                                         ┌──────────┐
                                                         │ Biased   │
                                                         │ roam     │
                                                         └──────────┘
```

## Timing

- **Base tick:** 40ms (at 100% speed)
- **Effective tick:** `40ms / (speedPct / 100)`
- **Action ticks:** Effects apply every 500ms
