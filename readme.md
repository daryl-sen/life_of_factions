# Emoji Life

A zero-player, real-time 2D sandbox simulation. Autonomous agents live on a 62x62 grid — gathering food, forming factions, reproducing, building, and fighting. The simulation is "cozy-chaotic": designed to produce emergent stories, not follow a script.

**[Play it live](https://daryl-sen.github.io/life_of_factions/)**

## What happens

- Agents roam the grid, harvest crops for energy, and build farms
- Positive interactions build relationships that lead to factions
- Factions place flags that heal nearby members
- Agents reproduce when relationships and energy are high enough
- Combat breaks out based on aggression traits and faction rivalries
- Children inherit traits from both parents
- Agents level up, gaining health and attack power
- Factions disband when membership drops too low

No two runs play out the same way.

## Setup

```bash
npm install
npm run build
npx serve .
```

Open `http://localhost:3000`. See [setup.md](setup.md) for the full testing checklist.

## Tech stack

- **TypeScript** with strict mode
- **esbuild** for bundling
- **Canvas 2D** for rendering
- Static deployment on **GitHub Pages**

## Architecture

Domain-driven design with 8 bounded contexts:

```
src/
  main.ts                          # Entry point
  shared/                          # Types, constants, utilities, pathfinding
  domains/
    world/                         # Grid, spatial state, food field BFS
    agent/                         # Agent class, relationships, factory
    action/                        # Action processing, interaction decisions
    faction/                       # Faction class, membership management
    simulation/                    # Tick loop, roaming, crop/farm/harvest logic
    rendering/                     # Canvas renderer, camera, emoji cache
    ui/                            # DOM binding, inspector, log, controls
    persistence/                   # Save/load serialization
```

See [CLAUDE.md](CLAUDE.md) for detailed architecture docs and contribution guidelines.

---

## Player Guide

### What you'll see on screen

**Canvas (middle):** The world. Each agent is a small circle with a colored border (faction color, or gray if unaffiliated). Crops, farms, walls, and faction flags populate the grid.

**Over an agent's head:**
- **Tiny red triangle** = low energy
- **HP bar** (thin green bar) = health. When it empties, the agent dies.

**HUD (top-left):** Tick counter, FPS, and totals for agents, factions, crops, farms, walls, flags.

**Event Log (right):** A live feed of talks, fights, births, building, deaths, and faction news.

**Inspector (right, above the log):** Click any agent to see their name, faction, level, HP, energy, traits, and current action.

### Controls

| Control | Action |
|---------|--------|
| **Start** | Initialize a fresh world |
| **Pause / Resume** | Freeze or continue time |
| **Speed slider** | Adjust simulation rate |
| **Crop Spawn Multiplier** | Control crop spawn frequency |
| **Spawn Crop** | Instantly add a random crop |
| **Draw / Erase Walls** | Paint or remove obstacles |
| **Save / Load** | Export or restore state as JSON |
| **Pause When Unfocused** | Auto-pause when switching tabs |
| **Scroll / two-finger** | Pan the map |
| **Ctrl+scroll / pinch** | Zoom in and out |
| **Click an agent** | Open the inspector |
| **Log filter pills** | Toggle event categories |
| **Agent dropdown** | Follow one agent's story in the log |

### How agents live

**Energy** slowly ticks down and is restored by eating crops. Zero energy for too long means starvation.

**Health (HP)** is damaged in fights. Heals near their faction's flag or when another agent heals them. HP hitting zero means death.

**Levels:** Well-fed agents level up, gaining max HP and attack power (capped).

**Personalities:** Every agent has **aggression**, **cooperation**, and a travel style (near base, far, or wander).

### How they interact

- **Talking & Quarreling** — builds or hurts relationships
- **Helping & Healing** — shares energy or patches wounds, especially with faction mates. Can recruit outsiders to join a faction
- **Attacking** — triggered by aggression, scarcity, or faction rivalry. Infighting can cause agents to leave their faction
- **Farms** — make nearby crops more likely to spawn. Costs energy to build
- **Walls** — block movement. Agents try to break walls when trapped
- **Reproduction** — two compatible, well-fed, neighboring agents with good relations may have a child who inherits blended traits

### Factions & flags

Two unfactioned friends who get along well enough will found a faction and place a **flag**. Being near your flag heals you. Rivals may attack it. Factions grow through recruitment and shrink through death or infighting.

### Reading the drama

**Prosperity:** lots of crops, few red triangles, friendly logs (talk/help/heal/reproduce).

**Trouble:** many red triangles, empty HP bars, frequent attacks, agents clustering without eating.

**Quick fixes:** spawn crops to break a famine, lower speed to follow tense scenes, raise the crop multiplier for a gentler world, or start with fewer agents.

### First-run mini tour

1. Set starting agents to ~40
2. Set speed around 50-80%
3. Keep crop spawn at 1.0x
4. Click **Start** and watch
5. Click an agent to open the **Inspector**
6. Select that agent in the log's **Agent** dropdown to follow their story
7. When the first flag appears, watch the quiet healing and faction life unfold

---

## License

Private project.
