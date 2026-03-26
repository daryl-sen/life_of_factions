# Emoji Life — Technical Specification (v1.4.0, 2026-03-25)

## Purpose

A **zero-player**, real-time 2D sandbox where autonomous agents (“little people”) live on a small grid world, gather **crops**, interact, form **factions**, reproduce, build/destroy **walls**, build **farms**, and fight over **faction spawn points** (flags). The simulation is designed for smooth visual playback, tweakable parameters, and emergent social dynamics.

---

## 1) Core World

### 1.1 Space & Scale

* **Canvas/viewport:** 1000 × 1000 px (visual may letterbox; logic uses grid)
* **Grid:** 62 × 62 **integer cells**
* **Cell size:** 16 × 16 px
* **Coordinate conversions:** px = cell * 16, cell = floor(px/16)
  No sub-cell movement.

### 1.2 Time & Loop

* **Rendering:** requestAnimationFrame (vsync)
* **Simulation tick:** fixed-step accumulator
  Base tick: **40 ms**; effective tick: 40ms / (speed% / 100)
* **Game speed:** 5%–300% (default 50%)
* **Performance target:** visually 30–60 FPS; logic stable under \~200 agents

### 1.3 Game Start

* Simulation does **not** start automatically
* **Config panel** allows adjusting:

  * Starting agents (20–300, default 20)
  * Game speed (%)
  * Crop spawn multiplier (0.1×–5×, default 1.0×)
* Simulation starts only after **Start** button is clicked

---

## 2) Entities & Data Model

### 2.1 Agents

```ts
Agent {
  id: ID
  name: string              // 6-char A–Z0–9
  cellX, cellY: int         // grid coords
  health: float             // 0..maxHealth
  maxHealth: float          // base 100; increases with level (+8/level)
  energy: float             // 0..maxEnergy
  maxEnergy: float          // base 200; +5 per level (level 20 = 295)
  attack: float             // base ~8; increases with level (+1.5/level)
  level: int                // capped at 20
  xp: int                   // current XP toward next level
  ageTicks: int
  starvingSeconds: float
  factionId: string|null
  relationships: Map<agentId, float> // -1..1
  path: Cell[]|null
  pathIdx: int
  lockMsRemaining: float    // movement lock for non-attack interactions

  // Needs system
  fullness: float           // 0..100; passive decay, restored by eating
  hygiene: float            // 0..100 (placeholder, not active)
  social: float             // 0..100 (placeholder, not active)
  inspiration: float        // 0..100 (placeholder, not active)

  action: null | {
    type: 'talk'|'quarrel'|'attack'|'under_attack'|'heal'|'help'|'attack_wall'|'attack_flag'|'reproduce'|'sleep'
    remainingMs: float
    tickCounterMs: float
    payload?: { targetId?: ID, ... }
  }
}
```


### 2.2 Terrain & Objects

* **Wall**: destructible, blocks movement
* **Crop**: harvestable resource (global cap)
* **Farm**: boosts nearby crop spawn probability; blocks movement; agents can **build** new farms (energy cost)
* **FlagSpawn**: faction spawn point, destructible, blocks movement

---

## 3) Mechanics

### 3.1 Movement & Pathfinding

* Grid movement: 4-connected (N/E/S/W)
* Pathfinding: A\* with Manhattan heuristic
* Impassable: walls, farms, flags, agents (except self)
* If blocked mid-path: drop path and replan later
* **Move-first, plan-second order** per tick:

  * Agents advance along any existing path before planning a new one
  * Prevents path reset loops when adjacent to crops
* **Movement locks:** while performing **non-attack** interactions (talk/heal/help/reproduce), participants are **locked** in place; lock is ignored if the agent is being **attacked** (they may move to escape)

### 3.2 Energy, Fullness & Needs

#### Energy

Energy is restored **only** via the **sleep** action (not eating). Per-agent `maxEnergy` starts at 200, +5 per level (level 20 = 295).

* **Passive drain:** 0.0625/tick (~0.25/sec)
* **Movement drain:** 0.12/cell
* **Mandatory sleep:** energy < 20
* **Voluntary sleep:** energy < 40
* Starvation is **not** triggered by energy = 0 (moved to fullness system)
* Health regen is **not** tied to energy (moved to fullness system)

#### Fullness (0–100)

Fullness is a new survival resource. Eating crops restores fullness (not energy).

* **Starting value:** 100
* **Passive decay:** −0.03/tick
* **Movement decay:** −0.08/cell
* **Action decay:** −0.02/sec during any action
* **Recovery:** eating a crop → +20 fullness
* **Starvation:** fullness = 0 → −1 HP/sec
* **Health regen:** fullness > 90 → +0.5 HP/sec
* **Proactive food seeking:** fullness < 40

#### Placeholder Needs (fields added, not active yet)

* **Hygiene:** starts 100
* **Social:** starts 50
* **Inspiration:** starts 50

These are tracked on agents but have no gameplay effect in Phase 1.

### 3.3 Resources

* **Crops (green triangle)**: restore **fullness** (+20); small sharing to adjacent same-faction agents
* **Farms (yellow square)**: increase nearby crop spawn probability within radius 3
* **Global crop cap:** **150** concurrent crops (hard limit)

### 3.4 Interactions

* All **non-attack** interactions require **adjacency** (Manhattan distance = 1) and **lock** both agents for the duration.
* **Attack**:

  * **Range:** Manhattan distance ≤ **2**
  * Does **not** lock the target; targets remain free to move
  * Shorter action window; ticks faster (see 3.10)
* Action cancellation if distance rule no longer satisfied (e.g., partner walked away or attacker out of range).

### 3.5 Factions

* Formed via union-find on relationship graph when relationship ≥ threshold
* Each faction has:

  * Unique color (also applied to its flag)
  * Member set
* Flags heal nearby members (aura), can be destroyed

### 3.6 Building & Destruction

* **Build Wall:** chance each tick; blocks movement; destructible
* **Build Farm (new):**

  * Attempt when agent is well-fed
  * Consumes **energy** (see 5. Balancing)
  * Placed on an adjacent free cell; blocks movement; boosts crop spawns
* Walls and flags destructible

### 3.7 Reproduction

* Requires adjacency, sufficient energy, and time
* **Behavioral priority:** reproduction is attempted **before** other interactions
* Upfront small energy **reserve** is consumed to commit; additional **finishing cost** on success
* Spawns child in adjacent free cell

### 3.8 Leveling (XP-Based)

* Triggered by accumulating XP (replaces energy-surplus leveling)
* **XP sources:** kill +50, eat +5, heal complete +10, share complete +5, build farm +15, harvest +2
* **Level curve:** level × 50 XP required per level
* **Level-up effects:** maxHealth += 8, attack += 1.5, maxEnergy += 5
* **Level cap:** **20**

### 3.9 Health, Fullness, Starvation

* Health decays slowly over time
* Movement costs energy and fullness
* **Starvation:** triggered by fullness = 0 (not energy = 0); deals −1 HP/sec
* **Health regen:** fullness > 90 → +0.5 HP/sec
* Flags apply heal aura within radius

### 3.10 Action System (durations, costs, distance rules)

* **Base durations** (randomized per action):

  * talk/quarrel/heal/help: **0.9–1.8s**
  * **attack:** **0.45–0.9s** (faster)
  * reproduce: **2.0–3.2s**
  * **sleep:** **8–12s** (new)
* **Distance rules:**

  * Non-attack actions: distance **=1**
  * Attack: distance **≤2**
  * Sleep: no target (solo action)
* **Tick cadence:** effects apply roughly every **0.5s** during actions
* **Per-second energy costs** (approx., halved from v1.3): talk 0.2, quarrel 0.4, **attack 1.1**, heal 1.5, help 0.8, attack\_wall 0.75, attack\_flag 1.0, **reproduce 1.5**
* **Sleep:** restores +8 energy per 500ms tick (total 128–192 energy over full duration); mandatory at energy < 20, voluntary at energy < 40; interruptible by attack; emoji 😴
* **Damage:** base 8; attack deals periodic damage scaled by level

---

## 4) User Interface

### 4.1 Controls

* **Start/Pause/Resume**
* Input fields for:

  * Starting agents
  * Speed (%)
  * Crop spawn multiplier
* **Spawn Crop** button (respects crop cap)

### 4.2 Stats

* Counts for: Agents, Factions, Crops, Farms, Walls, Flags

### 4.3 Inspector

* Click agent to see:

  * Name, Faction, Level (cap 20), Attack, HP, Energy, Age (ticks), #Relationships
  * Current Action & Remaining time

### 4.4 Event Log

* Filterable by action type (select all/none)
* Logs: interactions, reproduction, faction changes, builds (wall/farm), destruction, crop spawns, deaths, level-ups

### 4.5 Factions Panel

* Lists: ID, member count, avg level, flag status, color

### 4.6 Visuals

* Agents: **circle** with faction-colored border, HP bar, low-energy glyph
* Crops: **triangle**
* Farms: **yellow square**
* Walls: block with damage tint
* Flags: colored banner matching faction

### 4.7 Layout/Overflow

* Factions and logs lists are height-capped and scrollable; long IDs wrap to avoid overflow.

---

## 5) Balancing (defaults)

**Economy & thresholds**

* Move cost: **0.12** energy / step, **0.08** fullness / step
* Crop gain: **+20 fullness** (no longer gives energy)
* **Mandatory sleep threshold:** energy < 20
* **Voluntary sleep threshold:** energy < 40
* **Proactive food seeking:** fullness < 40
* **Urgent food seeking:** fullness < 20
* Starvation: fullness = 0 → −1 HP/sec

**Actions (energy/sec) — halved from v1.3**

* talk 0.2, quarrel 0.4, **attack 1.1**, heal 1.5, help 0.8, attack\_wall 0.75, attack\_flag 1.0, **reproduce 1.5**

**Action durations**

* talk/quarrel/heal/help: **0.9–1.8s**
* **attack:** **0.45–0.9s**
* reproduce: **2.0–3.2s**
* **sleep:** **8–12s** (restores +8 energy per 500ms tick)

**Combat & leveling (XP-based)**

* Base damage/tick: 8 (scales with level)
* Level-up trigger: accumulate level × 50 XP
* XP sources: kill +50, eat +5, heal complete +10, share complete +5, build farm +15, harvest +2
* Level-up effects: +8 max HP, +1.5 attack, +5 maxEnergy
* **Level cap:** **20**

**World objects**

* Wall HP: 10–15
* Flag HP: 12–18
* **Farm boost radius:** 3
* **Build farm energy cost:** **12**
* Farm build attempt probability (when well-fed): small, periodic
* **Crop spawn cap:** **150** total

**Factions**

* Formation threshold: 0.5, min size 2
* Heal aura radius: 4 (+0.6 HP/tick)

---

## 6) Simulation Order (per logic tick)

1. Attempt crop spawns (farm-biased, stop at global crop cap)
2. Compute “under attack” set for this tick (for lock exceptions)
3. For each agent:

   * Age & passive health decay
   * Passive fullness decay (−0.03/tick)
   * Passive energy drain (−0.0625/tick)
   * Decrement movement **lock** time
   * **Decision priority:**
     1. Energy < 20 → mandatory sleep
     2. Under attack → flee/retaliate
     3. Health < 30% maxHP → seek faction flag
     4. Fullness < 20 → urgent food seeking
     5. Energy < 40 → voluntary sleep
     6. Normal state:
        a. Fullness < 40 → proactive food seeking
        b. Reproduction, attack, help/heal/talk
        c. Roam
   * If acting: process action (distance rules; energy drain; effects)
   * If not acting:

     * If **not locked** (or locked but being attacked):
       **Move-first**: walk one path step (harvest if landed on crop; crops give +20 fullness)
       **Plan-second**: if no path, follow decision priority above
     * Consider interactions (reproduce first, then social, then combat with range 2)
     * Try building (wall or farm; farm consumes energy)
   * Starvation death check (fullness = 0 → −1 HP/sec)
   * XP-based level-up check (respect level cap)
4. Recompute factions on interval (with union-find)
5. Apply flag healing aura
6. Remove destroyed objects / dead agents
7. Update UI (stats, lists, inspector, logs)

---

## 7) Non-Functional

* Modular, commented code
* Smooth performance with \~200 agents
* Adjustable constants (TUNE & durations)
* Browser-based implementation; single HTML file

---

## 8) Debug/Telemetry

* Stats overlay (tick, fps, agent count)
* Path debug via inspector (selected agent)
* Performance counters
* Ring buffer event log with filters
* Optional log export (future)

---

## 9) Acceptance Criteria

1. **Start** button initializes world; **Pause/Resume** work.
2. **Crop cap**: total concurrent crops never exceeds **150** (Spawn Crop button respects this).
3. **Interactions lock**: during talk/heal/help/reproduce, agents do **not move**; if they’re **attacked**, they may move despite being locked.
4. **Attack range & speed**: agents can attack targets at Manhattan distance **≤2**; attack completes in **≤0.9s**.
5. **Adjacency rule**: all non-attack actions (including reproduction) only occur at **distance = 1**; actions cancel if distance rule is violated.
6. **Reproduction**: occurs noticeably over long runs (under default settings); upfront commitment and finishing energy costs are deducted from parents.
7. **Farm building**: agents occasionally **build farms** on adjacent cells when well-fed, consuming **12 energy**; farms block movement and increase local crop spawns.
8. **Fullness-driven food seeking**: agents with fullness < 40 proactively seek crops; fullness < 20 triggers urgent food seeking. Eating crops restores +20 fullness (not energy).
9. **Level cap**: agent level never exceeds **20**; leveling is XP-based and grants +8 maxHP, +1.5 attack, +5 maxEnergy.
10. **Sleep action**: agents sleep when energy < 20 (mandatory) or < 40 (voluntary); sleep lasts 8–12s and restores +8 energy per 500ms tick; interruptible by attack.
10. **Faction visuals**: flags use faction colors; faction list shows ID, members, avg level, and flag status.
11. **UI overflow**: factions list and log are scrollable and do not overflow their containers.

---

## 10) Notable Changes Since v2

* **Interaction locks** added (freeze movement during non-attack interactions; escape allowed if attacked).
* **Attack** is **faster** and **range-2**.
* **Farm construction** by agents (energy-consuming).
* **Global crop cap** (**150**).
* **Level cap** (**20**).
* UI lists made scrollable to prevent overflow.

### Phase 1 Changes (v1.4.0)

* **Fullness system** added (0–100): eating restores fullness, not energy. Starvation and health regen moved from energy to fullness.
* **Sleep action** added: only way to recover energy. Mandatory at energy < 20, voluntary at < 40.
* **XP-based leveling** replaces energy-surplus leveling. Multiple XP sources (kill, eat, heal, share, build, harvest).
* **maxEnergy is per-agent:** starts 200, +5 per level.
* **Action energy costs halved** across the board.
* **Needs system scaffolding:** hygiene, social, inspiration fields added (placeholder, not active).
* **Decision hierarchy rewritten** with sleep, fullness-based food seeking, and health-based flag seeking.


--- 

To bundle all the js files:

```
npx esbuild js/main.js --bundle --outfile=app.bundle.js
```