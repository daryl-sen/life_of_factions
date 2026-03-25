# Movement and Pathfinding

Movement is how agents navigate the world, find resources, and reach interaction targets.

## Grid System

### Coordinates

- **Grid size:** 62 × 62 cells
- **Cell size:** 16 × 16 pixels
- **Coordinate range:** 0 to 61 (inclusive)
- **World size:** 992 × 992 pixels

### Movement Rules

- **4-connected movement:** North, South, East, West only
- **No diagonal movement**
- **One cell per tick** (when moving)
- **No sub-cell positioning** (logic uses integer coordinates)

## Pathfinding

### A* Algorithm

Agents use A* pathfinding with Manhattan distance heuristic:

```javascript
function astar(start, goal, isBlocked) {
  // f(n) = g(n) + h(n)
  // g(n) = cost from start to n
  // h(n) = manhattan distance from n to goal
}
```

**Heuristic:** `h(x, y) = |x - goal.x| + |y - goal.y|`

**Expansion limit:** 900 nodes (prevents infinite loops)

### Blocked Cells

The following are impassable:

| Type | Description |
|------|-------------|
| Walls | Destructible barriers |
| Farms | Crop boosters (also block) |
| Flags | Faction spawn points |
| Other agents | Dynamic obstacles (except self) |
| Out of bounds | Grid edges (0 and 61) |

### Path Execution

```javascript
if (path && pathIdx < path.length) {
  step = path[pathIdx]
  if (!isBlocked(step.x, step.y, agentId)) {
    // Move to step
    cellX = step.x
    cellY = step.y
    pathIdx++
    energy -= moveEnergy  // 0.12
    // Harvest if on crop
  } else {
    // Path blocked, abandon
    path = null
  }
}
```

**Move-first, plan-second:** Agents execute their current path before planning new routes. This prevents oscillation when adjacent to goals.

## Roaming Behavior

When not pursuing a specific goal, agents roam using `biasedRoam()`.

### Candidate Generation

```javascript
range = 6
candidates = []
for i in 0..5:
  rx = clamp(cellX + random(-range, range), 0, 61)
  ry = clamp(cellY + random(-range, range), 0, 61)
  if (!isBlocked(rx, ry)):
    candidates.push({x: rx, y: ry})
```

### Travel Preferences

#### "near" - Homebody

- Factions: Stay ~4 cells from faction flag
- Avoid crowding: Penalize areas with faction members within radius 2
- No faction: Gravitate toward world center (31, 31)

**Scoring:**
```javascript
score = |distance - desiredDistance| + (crowdCount * 0.7)
choose candidate with lowest score
```

#### "far" - Explorer

- Factions: Move away from faction flag
- No faction: Move toward world edges

**Selection:**
```javascript
choose candidate with MAX distance from flag/center
```

#### "wander" - Drifter

- Pure random selection from candidates
- No spatial bias

## Food Seeking

### Priority Levels

| Energy | Behavior |
|--------|----------|
| < 40 | Critical - food is top priority |
| 40-70 | Low - may seek food |
| ≥ 70 | Well-fed - no active food seeking |

### Food Field

A distance field enables efficient food seeking:

**Computation (multi-source BFS):**
```javascript
foodField = new Uint16Array(62*62).fill(INFINITY)

// Initialize from all crops
for crop in crops:
  foodField[crop.x, crop.y] = 0
  queue.push(crop)

// BFS expansion
while queue not empty:
  (x, y) = queue.pop()
  for neighbor in adjacent:
    if not blocked and foodField[neighbor] > foodField[x,y] + 1:
      foodField[neighbor] = foodField[x,y] + 1
      queue.push(neighbor)
```

**Usage:**
```javascript
// Step toward food
best = current cell
for neighbor in adjacent:
  if foodField[neighbor] < foodField[best]:
    best = neighbor
move to best
```

**Recomputation:** Every 5 ticks or when crops change significantly.

### Seeking Strategy

```javascript
function seekFoodWhenHungry(world, agent) {
  // 1. Harvest if standing on crop
  if (crop at current cell):
    harvest()
    return

  // 2. Check adjacent crops
  for adjacent cell:
    if (crop at cell):
      plan path to cell
      return

  // 3. Use food field if scarce
  scarcity = crops.size / agents.length
  if (scarcity < 0.35):
    step toward food field gradient
    return

  // 4. Find nearest crop and path to it
  nearest = findNearestCrop()
  if (nearest):
    planPathTo(nearest)
}
```

## Movement Locks

Agents cannot move while:

1. Performing locking actions (`talk`, `quarrel`, `heal`, `help`, `reproduce`)
2. `lockMsRemaining > 0`

**Exception:** Agents being attacked can move despite locks (fleeing).

```javascript
locked = lockMsRemaining > 0 && !underAttack
if (!locked) {
  // Can move
}
```

## Path Budget

Pathfinding is computationally expensive. A budget system limits replanning:

```javascript
// Per tick budget
budget = scarcity < 0.25 ? max(6, floor(30 * 0.5)) : 30

// Eligible agents (sorted by energy, hungry first)
eligible = agents where (!locked && pathComplete && !acting)

// Round-robin selection
for i in 0..min(budget, eligible.length):
  whitelist.add(eligible[(roundRobinIndex + i) % eligible.length])
```

**Scarcity penalty:** When crops are very scarce, path budget is reduced to prevent all agents converging on the same food source.

## Visual Interpolation

For smooth animation, agent positions are interpolated:

```javascript
visualX = lerp(prevCellX, cellX, lerpT)
visualY = lerp(prevCellY, cellY, lerpT)

// Each frame:
lerpT = min(1, lerpT + frameDelta / tickDuration)
```

This creates smooth movement between cells even though logic operates on discrete grid positions.
