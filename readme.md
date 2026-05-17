# Emoji Life

A zero-player, real-time 2D sandbox simulation. Autonomous agents live on a configurable grid — gathering food, forming factions, reproducing, building, and fighting. The simulation is "cozy-chaotic": designed to produce emergent stories, not follow a script.

**[Play it live](https://daryl-sen.github.io/life_of_factions/)**

## What happens

- Agents roam the grid, harvest crops, water, and wood for their inventories, and build farms
- DNA-based genetics determine per-agent traits (strength, longevity, agility, sociality, etc.) and are inherited via crossover and mutation
- Positive interactions build relationships that lead to faction formation
- Factions place flags that heal nearby members and store resources for deposit/withdrawal
- Agents reproduce through sexual or asexual means, with three gestation paths
- Combat breaks out based on aggression traits and faction rivalries
- Agents level up from XP gains, increasing health, attack, and energy (cap: 20)
- Factions disband when membership drops to 0–1
- Poop blocks spawn from agents, causing hygiene loss and potential disease
- Clouds rain water; trees spawn seedlings; farms produce food over time

No two runs play out the same way.

## Setup

```bash
npm install
npm run build
npx serve .
```

Open `http://localhost:3000`.

## Tech stack

- **TypeScript** with strict mode
- **esbuild** for bundling
- **Canvas 2D** for rendering
- Static deployment on **GitHub Pages**

## Architecture

Domain-driven design with 10 bounded contexts:

```
src/
  main.ts                          # Entry point
  core/                            # Types, constants, utilities, pathfinding, event bus
  domains/
    genetics/                      # DNA encoding, gene expression, crossover, mutation
    entity/                        # Agent class, components (needs, inventory, relationships, pregnancy)
    decision/                      # Scored action selection, context building, need evaluation
    action/                        # Action registry, processing, completion effects
    world/                         # Grid, terrain, food/water/tree blocks, farms, obstacles, clouds
    faction/                       # Faction formation, management, flag placement
    simulation/                    # Tick orchestration, agent/world updates, spawner
    rendering/                     # Canvas renderer, camera, emoji cache
    ui/                            # DOM binding, inspector, telemetry, controls, logs
    persistence/                   # Save/load serialization
```

See [CLAUDE.md](CLAUDE.md) for detailed architecture docs and contribution guidelines.

---

## Player Guide

### What you'll see on screen

**Canvas (center):** The world. Each agent is a small circle with a faction-colored border (or gray if unaffiliated). Terrain shows dry (yellow) → mud (brown) → grass (green) based on proximity to water. Food blocks, farms, obstacles, trees, water blocks, flags, poop, and seedlings populate the grid.

**Over an agent's head:**
- **HP bar** (thin green bar) = health. When it empties, the agent dies.
- **Indicators** (configurable 3-slot system): faction flag, pregnancy status, health/mood level

**Navigation bar (top):** Tick counter, FPS, and pinned stats for agents, factions, crops, and other world metrics. Click the ★ on any telemetry item to pin it to the nav bar (max 3).

**Left sidebar:** Buttons to open overlay panels — simulation controls, interaction tools, telemetry, factions, families, target inspection, and event logs.

**Overlay panels (right):**
- **Simulation Controls:** Start, pause, resume, reset, save/export/import. Sliders for starting agents, speed, cloud spawn rate, and world size.
- **Interaction Tools:** Spawn crop cluster, spawn tree, spawn cloud. Draw/erase obstacles, replenish agents, paint salt water or land. Toggle options: pause when unfocused, draw grid overlays.
- **Telemetry:** World stats (agents, factions, crops, farms, obstacles, flags, water, trees, births, deaths) and performance counters (tick/FPS/avg/min/max).
- **Factions:** Sortable list of factions by members, creation time, name, or average level.
- **Families:** Sortable list of family lineages by alive count, total born, name, average lifespan, or generation depth.
- **Target Inspection:** Click any agent to see their full details — name, family name, generation, faction, level, HP, energy, traits, needs, inventory, relationships, action, and more.
- **Event Log:** Filterable event matrix with log pills for each category (talk, quarrel, attack, heal, share, reproduce, build, destroy, death, faction, level, spawn, info, sleep, eat, harvest, loot, hygiene) and an agent dropdown to follow a specific agent.

### Controls

| Control | Action |
|---------|--------|
| **Start / Pause / Resume / Reset** | Control simulation state (reset requires confirmation) |
| **Starting Agents slider** | Set initial population (20–300, default 20) |
| **Speed slider** | Adjust simulation rate (5–300%, default 100%) |
| **Cloud Spawn Rate slider** | Control water replenishment frequency (0–10×, default 1×) |
| **World Size slider** | Change grid dimensions (20×20 to 120×120, default 62×62) |
| **Save / Export / Import** | Export or restore state as JSON |
| **Spawn Crop Cluster** | Instantly add multiple crops |
| **Spawn Tree** | Instantly add a tree |
| **Spawn Cloud** | Instantly spawn a rain cloud |
| **Draw / Erase Obstacles** | Paint or remove obstacles |
| **Replenish Agent** | Restore a selected agent's HP and energy |
| **Paint Salt Water / Land** | Modify terrain |
| **Pause When Unfocused** | Auto-pause when switching tabs |
| **Draw Grid Overlays** | Show grid lines |
| **Scroll / two-finger** | Pan the map |
| **Ctrl+scroll / pinch** | Zoom in and out |
| **Click an agent** | Open Target Inspection panel |

### How agents live

**Energy** slowly drains (passive + movement + actions) and is restored **only** by the sleep action (+8 per 500ms tick). Mandatory sleep at energy < 20, voluntary at energy < 40. Max energy is genetic (base 200 + per-level scaling).

**Fullness** (0–100) drains passively and with movement. Eating food from inventory restores +20 fullness. At fullness = 0, agents lose 1 HP/sec (starvation). When fullness > 90, agents regenerate 0.5 HP/sec.

**Health (HP)** is damaged in fights and by disease. Heals near faction flags (aura radius 4), when fullness > 90, or via the heal action from another agent (which also cures disease). HP hitting zero means death.

**Hygiene** (0–100) drains from passive decay, movement, social actions, stepping on poop, and the poop action itself. Washing with water from inventory restores +30 hygiene. Below 20 hygiene, agents risk contracting disease (5% per tick).

**Inspiration** (0–100) drains passively. When below 40, agents seek play or clean poop blocks. High inspiration (>70) makes actions 25% faster; low inspiration (<20) makes them 50% slower. Recovered by play (+15), cleaning (+10), and building farms (+25).

**Disease** (🤢): Contracted when hygiene < 20. Causes 2× energy drain, -0.5 HP/sec, and spreads to adjacent agents (3% per tick, blocked if target hygiene > 60). Cured by heal action or hygiene recovering above 80.

**Levels:** Agents earn XP from killing (+50), eating (+5), healing (+10), sharing (+5), building farms (+15), and harvesting (+2 per unit). Level-up grants increased max HP, attack, and max energy. Level cap is 20.

### Genetics and traits

Every agent's genome is a DNA string parsed into expressed traits at birth. Key trait categories:

| Category | Genes | Effects |
|----------|-------|---------|
| **Combat** | Strength (AA), Resilience (EE) | Attack damage, max HP, disease resistance |
| **Vitality** | Longevity (BB), Vigor (CC) | Lifespan, base HP, max energy |
| **Metabolism** | Metabolism (DD), Agility (FF) | Action speed, fullness decay, movement cost, speed |
| **Social** | Charisma (GG), Empathy (HH), Sociality (AD) | Relationship slots, heal amount, social decay |
| **Reproduction** | Fertility (JJ), Parthenogenesis (TT), Pregnancy (AG) | Energy threshold for breeding, asexual reproduction, gestation type |
| **Variability** | Volatility (AP) | Offspring mutation rate |

Traits are **continuous** (no hard upper ceiling), enabling genetic specialization.

### Reproduction

Agents reproduce through **sexual** (requires adjacent partner with relationship ≥ 0.4) or **asexual** (parthenogenesis via TT gene) means. Child DNA is created by **crossover** (50% gene swap at each position) and **mutation** (per-character substitution, gene duplication/deletion). Three gestation paths exist: **transfer** (gradual need transfer from parent), **instant** (immediate birth), and **countdown** (legacy timer-based).

Factions are inherited from the initiating parent (or 50/50 if both parents belong to different factions). Children inherit their parent's family name.

### How they interact

- **Talking & Quarreling** — talk has a 75% chance to improve relationships (+0.14, or +0.154 if same faction); 25% chance to worsen (-0.06). Quarrel is 50/50 improve/worsen.
- **Share** (formerly "Help") — transfers inventory resources (food, water, wood) from one agent to another. Grants +5 XP, social bonuses (+8/+5), relationship boost (+0.14), and 50% recruitment chance at relationship ≥ 0.4.
- **Healing** — restores target HP and cures disease. Targeted at agents with < 85% max HP.
- **Attacking** — triggered by aggression, scarcity, or faction rivalry. Range is Manhattan distance ≤ 2 (unique among actions). Does not lock the target. Same-faction attacks have a 30% chance to expel the target.
- **Farms** — built via explicit `build_farm` action (3 wood + 6 energy, 5.2s). Each farm spawns up to 10 HQ food blocks over its lifetime (15–25s intervals), then is destroyed.
- **Inventory** — agents carry food, water, and wood (shared genetic capacity cap). Harvest into inventory first, then consume via separate eat/wash actions.
- **Poop & Clean** — after eating, agents have a 30-second window with 10% per-tick chance to poop (spawns 💩 block, -5 hygiene). Other agents can clean adjacent poop blocks (+10 inspiration).

### Factions & flags

Two unfactioned friends who get along well enough (relationship ≥ 0.6) will found a faction and place a **flag**. Flags provide:

1. **Healing aura** — 3.75 HP per tick within radius 4
2. **Resource storage** — 30 units per type (food, water, wood). Agents deposit when adjacent with ≥ 3 inventory items; withdraw when needing resources.
3. **On destruction** — all stored resources drop as a loot bag (👝)

Rivals may attack flags. Factions grow through recruitment and shrink through death or infighting. A faction disbands when it has 0–1 living members.

### Families & lineages

Agents have family names and generation depth. First-generation agents set their own family name; all descendants inherit it from the initiating (carrier) parent. The Families panel tracks total born, currently alive, average lifespan, and maximum generation per family.

### Reading the drama

**Prosperity:** lots of crops, well-fed agents (no energy warnings), friendly logs (talk/share/heal/reproduce), growing factions.

**Trouble:** many agents at low fullness/energy, frequent attacks, disease outbreaks (🤢 emoji), factions collapsing, poop block clusters.

**Quick fixes:** spawn crop clusters or trees to break famine, spawn a cloud for water, lower speed to follow tense scenes, adjust the cloud spawn rate slider, or reset with different starting parameters.

### First-run mini tour

1. Set starting agents to ~40–60
2. Set speed around 80–100%
3. Keep cloud spawn rate at 1.0×
4. Click **Start** and watch
5. Open **Target Inspection** by clicking an agent
6. Follow that agent in the **Event Log** via the agent dropdown
7. Watch factions form, flags appear, and farm building emerge
8. Explore the **Factions** and **Families** panels to see lineages

---

## License

Private project.
