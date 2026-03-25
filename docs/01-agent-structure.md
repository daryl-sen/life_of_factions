# Agent Structure

## Data Model

Agents are the core autonomous entities in the simulation. Each agent has a comprehensive set of properties that define its state, behavior, and relationships.

### Core Properties

```javascript
{
  id: string,              // UUID
  name: string,            // 6-character pronounceable string
  cellX: number,           // Grid X coordinate (0-61)
  cellY: number,           // Grid Y coordinate (0-61)
  prevCellX: number,       // Previous position for interpolation
  prevCellY: number,       // Previous position for interpolation
  lerpT: number,           // Interpolation progress (0-1)
  health: number,          // Current health (0 to maxHealth)
  maxHealth: number,       // Maximum health (base 100, +8 per level)
  energy: number,          // Current energy (0 to 200 cap)
  attack: number,          // Attack power (base 8, +1.5 per level)
  level: number,           // Level (1 to 20 cap)
  ageTicks: number,        // Age in simulation ticks
  factionId: string|null,  // Current faction or null
  relationships: Map<string, number>, // Agent ID -> relationship value (-1 to 1)
  path: Array<{x, y}>|null, // Current navigation path
  pathIdx: number,         // Current index in path
  action: Action|null,     // Current action being performed
  lockMsRemaining: number, // Movement lock timer
  travelPref: string,      // "near" | "far" | "wander"
  aggression: number,      // Personality trait (0-1)
  cooperation: number,     // Personality trait (0-1)
  replanAtTick: number,    // Earliest tick for path replanning
  goal: {x, y}|null,       // Current pathfinding goal
}
```

### The Action Object

When an agent is performing an action, the `action` property contains:

```javascript
{
  type: string,            // Action type
  remainingMs: number,     // Milliseconds remaining
  tickCounterMs: number,   // Accumulator for periodic effects
  payload: Object          // Action-specific data (e.g., targetId)
}
```

## Agent Lifecycle

### Creation

Agents are created via `addAgentAt(world, x, y)`:

- **Starting stats**: health=100, energy=100, attack=8, level=1
- **Travel preference**: Randomly assigned (1/3 each for "near", "far", "wander")
- **Traits**: Random aggression and cooperation values (0-1)
- **Name**: Generated 6-character pronounceable string

### Death

Agents die when health reaches 0:

1. Removed from `world.agents` array
2. Removed from spatial index (`world.agentsByCell`)
3. Removed from ID index (`world.agentsById`)
4. All relationships to this agent are pruned
5. Faction membership is removed
6. Faction may disband if only 0-1 members remain

### Leveling

Agents level up when energy exceeds 70% of cap (140+):

- **Trigger**: After harvesting or gaining energy
- **Benefits**: +8 maxHealth, +1.5 attack
- **Energy reset**: Clamped to 140
- **Cap**: Level 20 (cannot exceed)

## Movement Interpolation

For smooth visual movement between grid cells:

```javascript
visualX = lerp(prevCellX, cellX, lerpT)
visualY = lerp(prevCellY, cellY, lerpT)
```

- `lerpT` starts at 0 when movement begins
- Advances each frame based on game speed
- Reaches 1 when the agent is visually at the new cell

## Spatial Indexing

Agents are indexed for O(1) lookups:

| Index | Purpose |
|-------|---------|
| `world.agentsByCell` | Find agent at (x, y) |
| `world.agentsById` | Find agent by UUID |
| `world.agents` | Iterate all agents |

## Memory Management

### Relationship Pruning

Each agent can store at most 80 relationships. When exceeded:

1. All relationships are sorted by absolute value
2. Weakest relationships (closest to 0) are pruned first
3. Values below 0.02 are deleted immediately (considered neutral)
