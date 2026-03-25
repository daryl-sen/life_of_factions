# Agent Decision Making

This document explains the decision-making process agents use each simulation tick.

## The Decision Loop

Each tick, agents follow this decision hierarchy:

```
1. Process current action (if any)
2. If not acting:
   a. Move along path (if has path)
   b. Plan new behavior (if no path)
      - If hungry (energy < 40): seek food
      - Otherwise: consider interactions, then roam
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
- If energy drops below 40 (except for attack)
- If target moves out of range

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

When not acting and not moving, agents decide their next behavior:

```
if (energy < 40) {
  // Hungry - food is priority
  if (random < 0.4) {
    considerInteract()  // May attack for resources
  } else {
    seekFoodWhenHungry()
  }
} else {
  // Well-fed - social and exploration
  considerInteract()
  if (!action && !path) {
    biasedRoam()
  }
}
```

## Priority System

### Hungry State (energy < 40)

1. **Harvest** - If standing on crop
2. **Move to food** - Use food field or pathfinding
3. **Attack** - 40% chance to consider interaction (may attack)

### Well-Fed State (energy >= 40)

1. **Interact** - Consider social/combat actions
2. **Roam** - Biased wandering based on travel preference
3. **Build** - 1% chance to build farm if energy >= 120

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
- `talk`, `quarrel`, `heal`, `help`, `reproduce`

**Non-locking actions:**
- `attack` (agents can flee while being attacked)

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
    ┌──────────────┐  ┌──────────────┐      │
    │ Process      │  │ Has path?    │      │
    │ action       │  └────────┬─────┘      │
    └──────────────┘           │             │
                               │      ┌──────┴──────┐
                          ┌────┴─────┐NO           YES│
                          │ Move one │               │
                          │ step     │               │
                          └────┬─────┘               │
                               │                     │
                               ▼                     │
                        ┌──────────────┐            │
                        │ Need path?   │◄───────────┘
                        └────────┬─────┘
                                 │
                   ┌─────────────┼─────────────┐
                   │             │             │
             energy<40     energy>=40    energy>=120
                   │             │             │
                   ▼             ▼             ▼
            ┌──────────┐  ┌──────────┐  ┌──────────┐
            │ Seek     │  │ Consider │  │ 1% build │
            │ food     │  │ interact │  │ farm     │
            └──────────┘  └────┬─────┘  └──────────┘
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
