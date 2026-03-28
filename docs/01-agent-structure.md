# Agent Structure

## Data Model

Agents are the core autonomous entities in the simulation. Each agent is composed of a `Genome` plus several components (`NeedSet`, `Inventory`, `RelationshipMap`, `PregnancyState`). All per-agent stats derive from genetic traits.

### Core Properties

```typescript
{
  // Identity
  id: string,                          // UUID
  name: string,                        // 6-character pronounceable string
  familyName: string,                  // Inherited from parent (or = name for founders)
  generation: number,                  // Lineage depth (1 = founder)

  // Genetics
  genome: Genome,                      // Immutable DNA, parsed once at birth
  traits: TraitSet,                    // Expressed trait values (derived from genome)

  // Entity class
  entityClass: 'baby' | 'adult' | 'elder', // Determines available actions and stat modifiers

  // Position / movement
  cellX: number,                       // Grid X coordinate (0-61)
  cellY: number,                       // Grid Y coordinate (0-61)
  prevCellX: number,                   // Previous position for interpolation
  prevCellY: number,                   // Previous position for interpolation
  lerpT: number,                       // Interpolation progress (0-1)
  path: IPosition[] | null,            // Current navigation path
  pathIdx: number,                     // Current index in path
  goal: IPosition | null,              // Current pathfinding goal
  replanAtTick: number,                // Earliest tick for path replanning
  pathFailCount: number,               // Navigation failure counter (resets on success)

  // Stats (base values from genetics, scaled by level)
  health: number,                      // Current health (0 to maxHealth)
  maxHealth: number,                   // From traits.resilience.baseMaxHp + perLevel * (level-1)
  energy: number,                      // Current energy (0 to maxEnergy)
  maxEnergy: number,                   // From traits.vigor.baseMaxEnergy + perLevel * (level-1)
  attack: number,                      // From traits.strength.baseAttack + perLevel * (level-1)
  level: number,                       // Level (1 to LEVEL_CAP)
  xp: number,                         // Experience points toward next level
  ageTicks: number,                    // Age in simulation ticks
  maxAgeTicks: number,                 // From traits.longevity.maxAgeMs / TICK_MS

  // State
  factionId: string | null,            // Current faction or null
  diseased: boolean,                   // Disease status (low hygiene can cause this)
  action: IActionState | null,         // Current action being performed
  lockMsRemaining: number,             // Movement lock timer

  // Components
  needs: NeedSet,                      // fullness, hygiene, social, inspiration (0-100 each)
  inventory: Inventory,                // food, water, wood (genetic capacity)
  relationships: RelationshipMap,      // Agent ID → value (-1 to 1), genetic slot limit
  pregnancy: PregnancyState,           // Pregnancy state machine

  // Memory
  resourceMemory: Map<ResourceMemoryType, IResourceMemoryEntry[]>,  // Remembered resource locations

  // Legacy
  poopTimerMs: number,                 // Countdown after eating → triggers poop
  babyMsRemaining: number,             // Time remaining as baby before promotion to adult
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

## Entity Classes

Agents progress through three entity classes during their lifetime:

| Class | Available Actions | Modifiers |
|-------|-------------------|-----------|
| Baby | `eat`, `wash` only | Cannot reproduce, limited action set |
| Adult | All actions | Full capabilities |
| Elder | All actions | 0.7× attack, cannot reproduce |

- **Baby → Adult**: After `babyMsRemaining` expires (from `traits.maturity.babyDurationMs`)
- **Adult → Elder**: When `ageTicks` exceeds elder threshold (from genetics)
- **Death**: When `ageTicks >= maxAgeTicks` (from `traits.longevity.maxAgeMs`)

## Agent Lifecycle

### Creation

Agents are created via `AgentFactory.create()` or `AgentFactory.createChild()`:

- **Starting stats**: Derived from random (or inherited) Genome
- **Base stats**: `maxHealth`, `maxEnergy`, `attack` all from genetic traits
- **Name**: Generated 6-character pronounceable string
- **Family name**: Own name (founders) or inherited from parent

### Death

Agents die when health reaches 0 or age exceeds `maxAgeTicks`:

1. Loot bag dropped if inventory is non-empty
2. Removed from `world.agents` array
3. Removed from spatial index (`world.agentsByCell`)
4. Removed from ID index (`world.agentsById`)
5. All relationships to this agent are pruned
6. Faction membership is removed
7. Faction may disband if only 0-1 members remain
8. Death cause recorded (hunger, killed, disease, old_age)
9. Family registry updated

### Leveling

Agents level up when accumulated XP exceeds the threshold for the current level:

- **Trigger**: After eating, harvesting, killing, healing, sharing, or building
- **Benefits**: `+traits.resilience.perLevel` maxHealth, `+traits.strength.perLevel` attack, `+traits.vigor.perLevel` maxEnergy
- **XP formula**: `xpToNextLevel = level * 50`
- **Cap**: `LEVEL_CAP` (cannot exceed)

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

Each agent can store up to `traits.charisma.relationshipSlots` relationships (genetic, per-agent). When exceeded:

1. All relationships are sorted by absolute value
2. Weakest relationships (closest to 0) are pruned first
3. Values below 0.02 are deleted immediately (considered neutral)

### Resource Memory

Agents remember where they've seen food, water, and wood blocks (`resourceMemory`). These memories are shared during social interactions and decay when the agent can see the resource is gone. This state is persisted across saves.
