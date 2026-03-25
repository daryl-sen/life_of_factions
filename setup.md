# Setup & Testing — Life of Factions

## Prerequisites

- Node.js 18+
- npm

## Install

```bash
npm install
```

## Build

Compile TypeScript and bundle to `dist/app.js`:

```bash
npm run build
```

## Development

Start a local server and open `http://localhost:3000`:

```bash
npm run serve
```

Run the build first — the HTML loads `dist/app.js`, not the raw source files.

## Type checking

Run the TypeScript compiler without emitting output:

```bash
npm run typecheck
```

This reports any type errors across all files in `src/`.

## Manual testing checklist

After building and opening in the browser:

**Simulation**
- [ ] Click **Start** — agents should appear on the grid and begin moving
- [ ] Agents harvest crops (🌾 emoji, crop count decreases in telemetry)
- [ ] Agents talk, quarrel, help, heal, attack (log panel shows events)
- [ ] Factions form and appear in the Factions panel
- [ ] Agents reproduce and population grows
- [ ] Agents die when health reaches 0 (💀 in log)
- [ ] Agents level up (⭐ in log)
- [ ] Farms are built autonomously (🌻 appear on grid)

**Controls**
- [ ] **Pause / Resume** halts and restarts the simulation
- [ ] **Speed** slider changes simulation rate
- [ ] **Spawn multiplier** slider affects crop spawn rate
- [ ] **Draw Walls / Erase Walls** paints and removes walls on the grid
- [ ] **Spawn Crop** places a single crop on a free cell
- [ ] **Pause on blur** checkbox pauses when switching tabs

**Camera**
- [ ] Mouse wheel scrolls / two-finger trackpad scroll pans the map
- [ ] Ctrl+scroll (or pinch on trackpad) zooms in and out
- [ ] Right-click drag (or Shift+drag) pans the map

**Inspector**
- [ ] Click an agent on the canvas — inspector panel shows name, level, HP, energy, faction, and current action
- [ ] Notification banner appears briefly when an agent is selected

**Log**
- [ ] Log entries scroll in the event log panel
- [ ] Category filter pills toggle which event types are shown
- [ ] **ALL** pill toggles all categories at once
- [ ] Agent filter dropdown narrows log to a single agent

**Save / Load**
- [ ] **Save** downloads a `.json` file
- [ ] **Load** restores the simulation from a previously saved file — agents, factions, crops, walls, and tick counter should all be preserved

**Grid toggle**
- [ ] Grid checkbox shows/hides the tile grid lines

## Project structure

```
src/
  main.ts                    # Entry point, RAF loop, wiring
  shared/
    constants.ts             # Game tuning values, colors, emojis
    types.ts                 # Shared TypeScript interfaces
    utils.ts                 # Pure utility functions, RingLog
    pathfinding.ts           # A* Pathfinder class
  domains/
    world/                   # World, Grid, FoodField
    agent/                   # Agent, RelationshipMap, AgentFactory
    action/                  # ActionFactory, ActionProcessor, InteractionEngine
    faction/                 # Faction, FactionManager
    simulation/              # SimulationEngine, RoamingStrategy
    rendering/               # Renderer, Camera, EmojiCache
    ui/                      # UIManager, InputHandler, Controls
    persistence/             # PersistenceManager
dist/
  app.js                     # Bundled output (generated — do not edit)
```
