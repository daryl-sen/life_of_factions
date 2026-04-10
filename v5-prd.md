# Emoji Life v5.0 PRD — Unified Organism Model

**Status:** Draft (revision 2)
**Version:** 5.0.0
**Date:** 2026-04-09
**Breaking:** Clean break from v4 — no backward compatibility

---

## 1. Vision

Emoji Life v5 replaces the agent-centric model with a **unified organism model**. Every living entity — trees, animals, and anything in between — is an organism with its own genome. "Species" are not designed; they **emerge** from gene combinations. A tree is simply an organism whose genes happen to express immobility and photosynthesis. A fish is simply an organism that traverses water but not land. If a tree evolves combat ability, it becomes a stationary turret. If a "plant" evolves mobility, it stops being a plant — visually and functionally — and becomes something else.

The genetics system is overhauled with **trade-off-driven traits**. Every beneficial trait carries a cost. High Strength means expensive attacks. High Fertility means demanding reproduction. There are no hard caps on trait values — instead, the energy economy naturally limits how powerful any single organism can become.

The rendering system is standardized into three modular layers — **movesets**, **indicators**, and **tools** — that adapt to whatever organism the genome produces.

### Goals

- Emergent taxonomy from a shared gene pool — no predefined species
- Self-balancing genetics through trade-offs, not hard limits
- Visual system that coherently represents any gene combination
- Modular, extensible rendering layers (movesets, indicators, tools)
- Geographic isolation through terrain — natural population pockets
- Clean break from v4

### Non-Goals

- Manually designed species or creature types
- Guaranteed balanced starting populations (natural selection sorts it out)
- Territories, biomes, weather (future versions)
- Player-controllable organisms
- Backward compatibility with v4 save files

---

## 2. Core Design Principles

### 2.1 Everything is an Organism

All entities with a lifecycle (birth, growth, death) are organisms with genomes. Environmental objects (water, terrain, obstacles, food blocks) remain non-organisms. The distinction between "tree" and "agent" is dissolved — both are organisms expressing different gene combinations.

**v4:** Trees are stateless grid objects (`{ id, x, y, emoji, units, maxUnits }`). Agents are composed entities with genomes, needs, and decisions.

**v5:** Both are organisms. A tree is an organism expressing high Photosynthesis, zero Agility, and the Harvestable trait. It has HP, can die, and its corpse can be harvested.

### 2.2 Trade-off-Driven Genetics

Every trait has paired costs. Higher Strength → higher attack energy cost. Higher Agility → higher movement energy cost. Higher Fertility → more demanding reproduction. The cumulative cost of many high traits creates an **emergent energy budget**: an organism with everything maxed would starve. Natural selection emerges from the economy, not arbitrary caps.

**v4:** `value = clamp(default + (direction × raw / scale), min, max)` — hard min/max bounds.

**v5:** No hard ceilings. Traits scale freely from a soft floor of zero (or other functional minimum). Cost functions scale with trait values, making extreme values self-limiting.

### 2.3 All Traits Are Continuous

There is **no distinction between "capability" and "continuous" traits**. Every trait is a continuous value. What v4 modeled as binary capabilities (can attack, can move, can socialize) become continuous traits with a **functional minimum** — a value at or below which the capability is effectively unexpressed.

**Example:** Saltwater Tolerance defaults to 0. At 0, the organism cannot drink saltwater at all. Above 0, it extracts water from saltwater at a rate proportional to expression — slow at low values, faster at high values. The capability exists on a continuum, not as a switch.

This same pattern applies to every "capability" that v4 would have treated as binary: combat, mobility, leveling, sociality, photosynthesis, emotion, etc. The phenotype rules (Section 4) use trait thresholds to classify organisms into visual groups, but the underlying genetics is uniformly continuous.

### 2.4 Emergent Taxonomy

Organisms are not assigned to species. Instead, their **phenotype** (visual appearance, available actions) is derived from their expressed gene combination. The system defines classification rules in a data-driven table, and new categories emerge as new genes are introduced in future updates.

### 2.5 Visual Coherence Through Mobility-First Phenotype

An organism's base emoji must match its movement model. **A mobile organism can never display a plant or fungus emoji.** Mobility is the dominant axis of phenotype classification — if Agility > 0, the organism is classified as some form of mobile creature regardless of any other trait. A "mobile photosynthesizer" still functions metabolically (it generates passive energy from photosynthesis) but visually appears as a critter, amphibian, or other appropriate mobile form.

Animations (shake, bob, bounce) are the universal action indicator — they work for any organism. Action-specific emojis are an optional layer that fires only when a coherent emoji exists for the organism's phenotype + action combination.

---

## 3. Genetics System

### 3.1 Trade-off Philosophy

**Primary mechanism: Paired costs.** Every trait has an explicit cost dimension — typically increased energy cost for the actions or subsystems enabled by that trait. A strong organism pays more energy per attack. A fast organism pays more energy per move. An organism with keen perception pays passive energy every tick.

**Secondary mechanism: Pleiotropy.** Some traits affect multiple stats simultaneously, with mixed positive/negative effects. The Size trait increases attack power AND max HP AND inventory capacity, but also increases food needs AND decreases movement speed.

**Emergent mechanism: Energy budget.** The cumulative effect of paired costs means an organism with many high traits has proportionally high total energy costs. An organism with maxed Strength, Agility, Perception, and Resilience would starve unless it also evolved exceptional foraging ability — which itself has costs. This self-balancing loop replaces v4's hard min/max caps. No artificial point budget is needed; the energy economy IS the budget.

### 3.2 Expression Changes

**v4:** `value = clamp(default + (direction × raw / scale), min, max)`

**v5:**
- **Soft floor only:** Traits cannot go below their functional minimum (often 0)
- **No hard ceilings:** Traits scale freely with accumulated gene expression
- **Cost scaling:** Each trait's paired cost scales with its expressed value (linear, quadratic, or other curves — TRD decides per-trait)
- **Functional thresholds:** Some traits define a minimum value below which the capability doesn't activate (e.g., Photosynthesis below 5 generates zero energy because the structures are too underdeveloped to function)

### 3.3 Trait Naming and Disambiguation

To prevent confusion between related traits, here is the canonical glossary. Every trait belongs to exactly one concept.

| Trait | Concept | NOT to be confused with |
|-------|---------|-------------------------|
| **Strength** | Physical combat power and attack damage | Size (mass), Resilience (HP) |
| **Vigor** | Energy pool size | Endurance (carrying capacity), Metabolism (consumption rate) |
| **Resilience** | Maximum HP / damage absorption | Regeneration (HP recovery rate), Immunity (disease resistance) |
| **Metabolism** | Action speed multiplier and base fullness decay | Vigor (energy pool), Appetite (when to seek food) |
| **Longevity** | Maximum lifespan | Maturity (juvenile duration) |
| **Agility** | Movement speed (zero = immobile) | Strength (attack), Perception (awareness) |
| **Endurance** | Inventory capacity | Resilience (HP), Vigor (energy) |
| **Size** | Physical mass — pleiotropic across attack, HP, inventory, food cost, speed | Strength (combat-only) |
| **Regeneration** | Passive HP recovery rate | Immunity, Resilience |
| **Immunity** | Disease resistance (only meaningful for organisms with hygiene) | Regeneration, Resilience |
| **Perception** | Awareness radius for decisions | Recall (memory), Aptitude (learning) |
| **Recall** | Memory slot count | Perception, Aptitude |
| **Aptitude** | Leveling rate and XP gain (zero = no XP system) | Perception, Recall |
| **Sociality** | Social drive — capability AND strength of social need (zero = solitary, no factions) | Charisma (slots), Cooperation (disposition), Fidelity (loyalty) |
| **Charisma** | Maximum relationship slot count | Sociality (drive), Cooperation (kindness) |
| **Cooperation** | Disposition toward positive social outcomes (kindness, helping) | Sociality (capability), Fidelity (loyalty) |
| **Aggression** | Disposition toward initiating combat | Strength (combat power), Courage (flee threshold) |
| **Courage** | Resistance to fleeing when injured | Aggression (combat initiative) |
| **Fidelity** | Loyalty to faction (low chance of leaving) | Sociality, Cooperation |
| **Maternity** | Disposition to feed and care for own offspring | Fertility (reproduction drive) |
| **Fertility** | Reproduction drive and energy efficiency for breeding | Maternity (childcare), Pregnancy (gestation) |
| **Pregnancy** | Gestation period — zero = instant birth | Fertility, Maternity |
| **Parthenogenesis** | Asexual reproduction capability | Fertility, Pregnancy |
| **Maturity** | Speed of juvenile-to-adult transition | Longevity (overall lifespan) |
| **Appetite** | Fullness threshold for seeking food (proactive vs reactive eating) | Metabolism (decay rate), Greed (hoarding) |
| **Greed** | Hoarding drive — accumulating resources | Appetite, Endurance |
| **Photosynthesis** | Passive energy generation rate (zero = none) | Carnivory (diet) |
| **Carnivory** | Ability and efficiency at eating meat (zero = strict herbivore) | Photosynthesis, Aggression |
| **Aquatic** | Water traversal ability and swim speed (zero = cannot enter water) | Saltwater Tolerance |
| **Saltwater Tolerance** | Rate of water extraction from saltwater (zero = cannot drink saltwater) | Aquatic (movement) |
| **Emotion** | Mood system intensity — drives both bonuses (happy) and penalties (unhappy) | (none) |
| **Harvestable** | Whether corpse persists on death and how much it yields | (none) |
| **Volatility** | Mutation rate applied to offspring DNA | (none) |

### 3.4 Trait Catalog

#### 3.4.1 Essential Traits

Required for viability. An organism must have at least one gene for each essential trait or it is stillborn at birth.

| Code | Trait | What It Does | Trade-off |
|------|-------|-------------|-----------|
| BB | **Longevity** | Maximum lifespan in milliseconds | Higher lifespan → higher base fullness decay (maintaining a long-lived body costs more) |
| DD | **Metabolism** | Fullness decay rate AND action speed multiplier | Faster actions and more energetic existence → proportionally higher fullness decay |

In addition, every viable organism must have **at least one functional energy acquisition method** — either Photosynthesis > functional minimum, OR the default heterotrophic ability (eating food, which is enabled by default unless explicitly disabled). Vigor and Resilience also have functional minimums — an organism with zero Vigor (zero energy pool) or zero Resilience (zero HP) is stillborn, but does not require a dedicated essential gene since these defaults are provided by the entity framework.

#### 3.4.2 Body & Physiology

Continuous traits affecting the organism's physical body.

| Code | Trait | Benefit | Trade-off |
|------|-------|---------|-----------|
| AA | **Strength** | Higher attack damage. At zero, organism has no combat capability — attacks deal no damage and the attack action is never selected. | Higher energy cost per attack. Continuous from 0; cost scales with damage. |
| CC | **Vigor** | Larger maximum energy pool | Higher fullness decay to maintain energy reserves |
| EE | **Resilience** | Higher maximum HP | Reduced base movement speed (heavier, more durable body) |
| FF | **Immunity** | Lower disease contraction chance (only meaningful for organisms with hygiene needs) | Higher passive energy drain (immune system maintenance) |
| GG | **Agility** | Higher movement speed. At zero, organism is immobile — cannot pathfind, cannot flee, cannot perform any action requiring movement. | Higher energy cost per movement tick. Continuous from 0. |
| AJ | **Size** | Pleiotropic: increases attack damage, max HP, AND inventory capacity. Larger organisms also render bigger within their cell (visual scaling). | Increases food consumption. Decreases movement speed. Larger organisms are easier targets for predators. |
| AL | **Regeneration** | Passive HP recovery per tick | Increases fullness decay (healing costs energy) |
| RR | **Endurance** | Larger inventory capacity | Slower movement when inventory is loaded (carrying penalty scales with load) |

#### 3.4.3 Mobility, Senses & Diet

Continuous traits affecting how the organism moves through and perceives its environment.

| Code | Trait | Benefit | Trade-off |
|------|-------|---------|-----------|
| ZZ | **Aquatic** | Enables water cell traversal and increases swim speed. At zero, organism cannot enter water at all. At very high values combined with low Agility on land, organism is water-only. | Reduced land movement speed. At extreme expression, becomes incompatible with land. |
| AH | **Saltwater Tolerance** | Allows the organism to extract fresh water from saltwater cells, slowly. Rate of extraction scales with expression. At zero, organism cannot use saltwater. | Higher overall water consumption (the desalination process itself costs water reserves). |
| XX | **Photosynthesis** | Generates passive energy each tick proportional to expression. Below the functional minimum (20), generates nothing. **Efficiency is gated by water proximity** — far from water, Photosynthesis output drops sharply, naturally limiting where photosynthesizers can thrive. | **Moderate max HP penalty** — photosynthetic structures are fragile, but plants are not paper-thin. They take a few hits to kill, not one. The water-proximity dependency is the primary population limiter, not HP. |
| AB | **Carnivory** | Enables eating of meat (animal corpses). Efficiency at processing meat scales with expression. At zero, organism is strict herbivore. At extreme expression, becomes obligate carnivore (loses ability to digest plant food). | Reduced energy yield from plant food at moderate expression. Creates a harder food acquisition path (requires hunting and killing). |
| MM | **Perception** | Larger awareness radius for decision-making — can see further to find food, mates, threats | Higher passive energy drain per tick (maintaining sensory systems) |

#### 3.4.4 Mind & Behavior

Continuous traits affecting decision-making and personality.

| Code | Trait | Benefit | Trade-off |
|------|-------|---------|-----------|
| YY | **Emotion** | Enables the mood system. Happy organisms gain action effectiveness bonuses (faster actions, slightly stronger combat, better social outcomes). Mood-driven idle emojis. At zero, organism is moodless. | Unhappy organisms suffer matching penalties. The system is symmetric — emotion is a double-edged sword that punishes unmet needs and rewards met needs. Emotional organisms are also less consistent decision-makers (some random noise from mood). |
| HH | **Aptitude** | Faster XP gain and lower XP requirement per level. At zero, organism has no XP/leveling system at all and lives with flat stats. | Per-action energy cost increases with each level gained. Organisms that level up rapidly become metabolically expensive — high Aptitude is self-limiting because the higher you go, the more food you need just to function. |
| KK | **Courage** | Less likely to flee when injured | More likely to die in losing fights (stays too long against a stronger opponent) |
| JJ | **Aggression** | Higher combat initiative — more readily picks fights | Reduced social interaction success; generates more enemies |
| AN | **Recall** | More memory slots for remembered locations, organisms, events | Passive energy drain scales with slot count (maintaining neural structures) |

#### 3.4.5 Social

Continuous traits affecting interaction with other organisms. Note: Sociality is the master "social capability" trait — at zero, the organism cannot form factions, has no social need, and never selects social actions.

| Code | Trait | Benefit | Trade-off |
|------|-------|---------|-----------|
| AD | **Sociality** | Enables faction formation and social actions. Strength of the social need (faster social need decay = stronger drive to interact). At zero, organism is fully solitary — no factions, no social actions, no loneliness penalty. | Severe loneliness penalty when isolated (mood and performance decay). Time spent socializing is time not spent on survival or reproduction. |
| NN | **Charisma** | More relationship slots | Higher social need decay (maintaining many relationships is draining) |
| II | **Cooperation** | Higher probability of positive social outcomes (sharing, helping, alliance formation) | Reduced combat effectiveness (non-confrontational instincts) |
| SS | **Fidelity** | Less likely to leave faction, loyal to allies | Cannot easily abandon failing or disadvantaged factions, even when leaving would be beneficial |

#### 3.4.6 Reproduction & Lifecycle

Continuous traits affecting how the organism produces and cares for offspring.

| Code | Trait | Benefit | Trade-off |
|------|-------|---------|-----------|
| LL | **Fertility** | Lower energy threshold to reproduce, stronger reproductive urge | Higher energy cost per reproduction event |
| AG | **Pregnancy** | Length of gestation period in milliseconds. At zero, birth is instant after conception. Higher values trade time for offspring quality — see notes below. | During pregnancy, the parent's needs decay faster because the gestating offspring's needs are being filled by drawing from the parent (see Section 6.7 for full mechanic). The parent is also vulnerable: reduced speed, reduced combat ability. |
| TT | **Parthenogenesis** | Enables asexual reproduction (no mate required). | Offspring receive no crossover (only mutation), reducing genetic diversity. Lineages converge faster, becoming vulnerable to environmental shifts. |
| VV | **Maternity** | Higher probability of feeding and caring for own offspring (the parent shares food with the child after birth) | Energy and resources spent on offspring instead of self |
| QQ | **Maturity** | Shorter juvenile phase (faster transition to adult) | Reduced initial adult stats — an organism that grew up too fast starts adulthood smaller and weaker, taking longer to reach peak via XP |
| AE | **Harvestable** | When the organism dies, a corpse block persists at its death location, yielding resources proportional to the organism's traits (Size, Endurance, age). At zero, organism simply disappears on death with no corpse. | Higher base food needs (denser, more resource-rich body). The corpse attracts scavengers/predators to the area, creating a posthumous risk to nearby kin. |
| AP | **Volatility** | Higher mutation rate applied to offspring DNA, accelerating evolutionary change | Higher rate of stillborn offspring (mutations frequently break essential genes). High-volatility lineages evolve fast but lose more children. |

#### 3.4.7 Resource Behavior

| Code | Trait | Benefit | Trade-off |
|------|-------|---------|-----------|
| PP | **Appetite** | Seeks food at higher fullness (proactive foraging — never gets caught hungry) | Consumes more food per meal (bigger appetite uses more resources per eating action) |
| UU | **Greed** | Stronger hoarding drive — accumulates more inventory before stopping | Less likely to share with others; weakens alliance formation |

### 3.5 Viability Rules

An organism is **viable** (not stillborn) if all of the following are true:

1. Has at least one **Longevity (BB)** gene — must have a defined lifespan
2. Has at least one **Metabolism (DD)** gene — must process energy
3. Has a functional energy source: either Photosynthesis expression above its functional minimum, OR the default heterotrophic ability (always present unless future genes disable it)
4. Vigor expression > 0 (must have an energy pool)
5. Resilience expression > 0 (must have HP)
6. DNA length is within valid bounds (TRD-defined; v4 used [100, 250] characters, v5 will likely expand to accommodate the larger trait pool)

Stillborn organisms are not added to the world. Their parent loses the energy spent on reproduction but no child entity exists.

**Stillbirth is purely viability-driven.** There is no separate stillbirth probability roll based on Volatility or any other trait. High Volatility produces more stillbirths only because more mutations break essential genes more often, causing the viability check above to fail. This means lineages that build genomic robustness through gene duplication can absorb more mutations without losing offspring — a natural and emergent reward for redundancy.

### 3.5.1 Functional Minimums

Each "capability via continuous trait" defines a **functional minimum** — a value below which the capability is effectively unexpressed. These thresholds are design contracts and the anchor points for phenotype classification. They are starting values; tuning may adjust them during implementation.

| Trait | Functional Min | Below this value... |
|-------|----------------|---------------------|
| Photosynthesis | 20 | Generates zero passive energy (structures too underdeveloped) |
| Agility | 5 | Functionally immobile — cannot pathfind, flee, or perform movement actions |
| Sociality | 15 | No faction formation, no social actions, no loneliness penalty |
| Carnivory | 10 | Cannot digest meat at all (strict herbivore) |
| Aquatic | 10 | Cannot enter water cells |
| Saltwater Tolerance | 5 | Cannot extract water from saltwater |
| Aptitude | 5 | No XP system — flat stats for life |
| Strength | 3 | Attacks deal effectively zero damage; combat AI ignores attack actions |
| Emotion | 10 | No mood system — flat performance regardless of needs |
| Pregnancy | 5 | Instant birth — no gestation period |
| Harvestable | 10 | No corpse appears on death |

These values are tunable in the TRD's tuning constants module, but the conceptual thresholds are locked here. Phenotype classification rules (Section 4.2) reference these thresholds.

### 3.6 Crossover & Mutation

Inherited from v4 unchanged in mechanism, with one v5 enhancement:

- **Crossover** (`crossover.ts`): positional gene swap between two parent DNA strings, 50% chance per gene position. Used for sexual reproduction.
- **Mutation** (`mutation.ts`): per-character substitution, gene duplication, gene deletion. Length clamped to valid bounds.
- **v5 enhancement:** The mutation rate applied to offspring is now derived from the parents' **Volatility** trait, not a global constant. For sexual reproduction, child mutation rate = average of both parents' Volatility expressions. For asexual, it equals the single parent's Volatility. The exact mapping (Volatility value → mutation probability) is a TRD concern.

The base global mutation rate from v4 (0.5% per character) becomes the rate at default Volatility expression. High-Volatility lineages mutate faster; low-Volatility lineages mutate slower.

---

## 4. Phenotype Classification

### 4.1 How It Works

An organism's **phenotype class** is determined by evaluating its expressed traits against a priority-ordered rule table. The first matching rule wins. Each phenotype class defines:

- **Base emoji set** — idle appearance + lifecycle variants
- **Moveset** — which action emojis are available
- **Action filter** — which actions the organism can perform given its body plan (genes can override these defaults)
- **Animations enabled** — which animation types apply

Phenotype classification is a **data-driven rule table**, not hardcoded if-chains. Adding new phenotypes requires only configuration changes.

**Critical rule (locked):** The first axis of classification is **mobility**. Any organism with Agility > 0 is mobile and is classified as some form of mobile creature. Plant and fungus phenotypes are reserved for organisms with Agility = 0. This rule guarantees that no mobile organism ever displays a plant or fungus emoji, regardless of its other traits.

Phenotype is **locked at birth** and never recalculates. This is a deliberate performance choice — re-parsing DNA and re-deriving phenotype each tick would be expensive and the visual identity should be stable.

### 4.2 Classification Rules

Rules evaluated top-to-bottom; first match wins. Threshold values reference the functional minimums defined in Section 3.5.1. Higher-order thresholds (mid, high) are tuning constants in the TRD.

| # | Condition | Phenotype | Base Emojis |
|---|-----------|-----------|-------------|
| 1 | Agility < 5 (immobile), Photosynthesis ≥ 20 | **Plant** | 🌲🌳🌴🌵🌻 |
| 2 | Agility < 5 (immobile), Photosynthesis < 20, Strength ≥ 3, Carnivory ≥ 10 | **Sessile Predator** | 🪸 (carnivorous-plant analog) |
| 3 | Agility < 5 (immobile), all else | **Fungus** | 🍄🪨 |
| 4 | Agility ≥ 5 (mobile), Aquatic ≥ high, land speed effectively 0 | **Fish** | 🐟🐠🐡 |
| 5 | Agility ≥ 5 (mobile), Aquatic ≥ mid, can also walk | **Amphibian** | 🐸🦎🐢 |
| 6 | Agility ≥ 5 (mobile), Photosynthesis ≥ 20 (mobile photosynthesizer) | **Photo-Critter** | 🐸🦎🐛🐌 (greenish-tinted creatures) |
| 7 | Agility ≥ 5, Sociality ≥ 15, Emotion ≥ 10 | **Person** | 😊😐😟 |
| 8 | Agility ≥ 5, Sociality ≥ 15, Emotion < 10 | **Colony Insect** | 🐜🐝 |
| 9 | Agility ≥ 5, Sociality < 15, Carnivory > mid, Strength > mid | **Predator** | 🐺🦊🐍 |
| 10 | Agility ≥ 5, Sociality < 15, all else | **Critter** | 🐛🦎🐌 |
| 11 | (fallback) | **Blob** | 🫧 |

The **mobile photosynthesizer** rule (#6) handles the edge case explicitly: if a normally-plant organism evolves mobility, it becomes a Photo-Critter, not a plant. The Photo-Critter is rendered with **greenish-tinted creature emojis** (🐸🦎🐛🐌) so that this rare emergence is visually identifiable — a player who notices a green frog or green slug knows they're looking at something unusual and can investigate. The rule has minimal cost (one row in the config table) and preserves the rare emergent stories that make the simulation interesting.

**Secondary emoji selection** within a phenotype refines the choice using other traits — e.g., a Plant near water becomes 🌴, a tall/old plant becomes 🌲. These refinements are additive and grow over time.

### 4.3 Action Availability by Phenotype

The phenotype provides default action availability, but **trait expression always has the final say**. If a Plant somehow expresses Strength > 0 (which would normally be impossible without the Sessile Predator path, but mutation could theoretically achieve it), it can attack despite being classified as a Plant.

| Phenotype | Move | Attack | Socialize | Harvest | Reproduce | Eat Plant Food | Eat Meat |
|-----------|------|--------|-----------|---------|-----------|----------------|----------|
| Plant | No | If Strength > 0 | No | No | Asexual only (seed/spore) | No (uses photosynthesis) | No |
| Sessile Predator | No | Yes | No | If carnivory and prey nearby | Asexual only | Conditional | If Carnivory > 0 |
| Fungus | No | If Strength > 0 | No | Absorbs from corpses passively | Asexual only (spore) | No (absorbs) | Absorbs from corpses |
| Person | Yes | If Strength > 0 | Yes | Yes | Sexual or asexual | Yes | If Carnivory > 0 |
| Fish | Swim | If Strength > 0 | If Sociality > 0 | If Carnivory & corpse nearby | Yes | If Carnivory < high | If Carnivory > 0 |
| Amphibian | Yes (both) | If Strength > 0 | If Sociality > 0 | Yes | Yes | If Carnivory < high | If Carnivory > 0 |
| Photo-Critter | Yes | If Strength > 0 | If Sociality > 0 | Yes | Sexual or asexual | Yes | If Carnivory > 0 |
| Colony Insect | Yes | If Strength > 0 | Yes | Yes | Yes | Yes | If Carnivory > 0 |
| Predator | Yes | Yes | No | Corpses only | Yes | Reduced efficiency | Yes |
| Critter | Yes | If Strength > 0 | No | Yes | Yes | Yes | If Carnivory > 0 |
| Blob | Varies | Varies | Varies | Varies | Varies | Varies | Varies |

### 4.4 Lifecycle Stages

Organisms progress through lifecycle stages (replacing v4's Baby/Adult/Elder entity classes).

| Stage | Determined By | Visual | Behavioral |
|-------|--------------|--------|------------|
| **Juvenile** | Birth → Maturity threshold reached | Smaller emoji or juvenile variant (e.g., 🌱 for plants, 👶 for persons) | Restricted action set: cannot reproduce, reduced combat, reduced inventory |
| **Adult** | Maturity reached → Elder threshold | Full phenotype emoji | Full action set |
| **Elder** | Age > Elder threshold (Longevity-based) | Elder variant for organisms that have one (e.g., 🧓 for persons). **Plants do NOT have an elder variant** — they continue using their adult emoji until death. | Reproduce action removed; combat reduced |

The "elder" stage exists primarily for animal-like organisms where aging is visible. Plants and fungi skip the elder visual stage but still experience the behavioral changes (reproduction stops, eventual death).

---

## 5. Visual System

### 5.1 Movesets

A **moveset** is the complete emoji vocabulary for a phenotype class. Each moveset contains:

| Slot | Purpose | Example (Person) | Example (Plant) |
|------|---------|------------------|------------------|
| **Idle** | Default resting appearance | 😊 (mood-modulated if Emotion > 0) | 🌳 |
| **Action variants** | Optional per-action emoji | 😡 attacking, 😴 sleeping, 😋 eating | (none — animation only) |
| **Juvenile** | Pre-adult appearance | 👶 | 🌱 |
| **Elder** | Post-peak appearance (optional, omitted for plants/fungi) | 🧓 | (none) |

**Key rule:** If no action emoji exists for a phenotype + action combination, the organism keeps its idle emoji and relies on **animation** to indicate the action. This protects visual coherence.

### 5.2 Animations

Animations are the **universal action indicator** — they work for every organism regardless of phenotype. They are the primary way the player identifies what an organism is doing. Action emojis (movesets) are the secondary, optional layer.

| Animation | Actions That Trigger It | Visual Effect |
|-----------|------------------------|---------------|
| **Shake** | Attack, taking damage | Rapid horizontal oscillation |
| **Bob** | Walking, swimming | Vertical bounce per step |
| **Pulse** | Healing, regenerating | Scale up/down cycle |
| **Bounce** | Reproducing, social success, leveling up | Vertical hop |
| **Shrink** | Dying, energy critically low | Progressive scale decrease |
| **Wiggle** | Eating, harvesting, drinking | Slight rotation oscillation |
| **Flash** | Level up, important event | Brief brightness burst |
| **Sway** | Idle for plants/fungi, sleeping | Gentle side-to-side drift |

Animations are **composable**: an organism can shake (attack animation) while displaying an angry emoji (attack moveset).

### 5.3 Indicators

Three indicator slots positioned around the organism emoji. Each displays a small emoji or icon. The player can **switch what each slot displays** via the UI control panel.

| Slot | Position | Default Display | Alternative Displays |
|------|----------|----------------|---------------------|
| **Top-left** | Above-left of base emoji | Faction flag 🚩 | Diet type, level number, phenotype icon, lineage marker |
| **Top-right** | Above-right of base emoji | Pregnancy state 🥚 | Health band, energy band, mood icon |
| **Top-middle** | Directly above base emoji | (empty by default) | Alert state, need status, custom label |

Properties:
- Indicator emojis render at ~50% the size of the base organism emoji
- Slots can be empty (hidden) to reduce clutter
- Each slot's data source is independently switchable
- The UI provides a dropdown per slot to select what data to display
- New indicator types can be registered without code changes (data-driven)

### 5.4 Tools (Directional, Origin → Target)

Tools are small emojis rendered **between an organism and its target during a directed action**, oriented to point from origin to target. This preserves v4's existing tool rendering behavior.

The current v4 system shows:
- A sword icon pointing from attacker to defender during attacks
- A hand icon pointing from harvester to harvested block during harvesting

**v5 generalizes this** without changing the visual logic:
- Each action definition in the action registry can declare a tool emoji
- When the action is executed against an **external-cell target** (a different cell containing another organism or block), the tool is rendered along the line between organism and target, oriented toward the target
- **Tools are rendered ONLY for actions whose `targetType === 'external_cell'`**
- For self-targeted actions (sleep, wash, eat from inventory, drink saltwater, photosynthesize), area effects, or untargeted actions, **no tool is rendered**. The action is communicated entirely through animation.

| Action | Tool Emoji | Notes |
|--------|-----------|-------|
| Attack | ⚔️ | Points from attacker to defender |
| Harvest | ✋ | Points from harvester to corpse/resource |
| Build | 🔨 | Points from builder to construction site |
| Heal | 💊 | Points from healer to patient |
| Fish (future) | 🎣 | Points from fisher to water target |
| Forage (future) | 🧺 | Points from forager to plant target |
| Sleep, Wash, Eat (self) | (none) | Animation only |

Adding a new tool requires only a registry entry. The directional rendering logic is shared. The decision rule is in the action registry, not the renderer — the renderer simply asks "does this action have a tool and a directional target?" and renders accordingly.

---

## 6. Game Mechanics

### 6.1 Food Types: Meat and Plant

Food is now split into two types, both stored in inventories and tracked separately:

- **Plant food** — produced by harvesting plant corpses, gathered from farms, or spawned passively in the world. Default for herbivores.
- **Meat food** — produced by harvesting animal corpses (organisms whose phenotype is in the animal-like categories). Required food source for high-Carnivory organisms.

Eating efficiency is a **smooth function** of the organism's Carnivory expression — `efficiency(carnivory, foodType) → 0..1`. There are no discrete behavioral tiers; the engine interpolates smoothly. The four categories below are **documentation labels only** — useful shorthand for designers and players to talk about diet, but the engine itself uses continuous math, not branches.

| Carnivory Level (label only) | Plant Food | Meat Food |
|-----------------|-----------|-----------|
| 0–9 (strict herbivore) | Full nutrition | Cannot eat (below functional minimum) |
| 10–mid (omnivore, plant-leaning) | Full nutrition | Reduced nutrition |
| Mid–high (omnivore, meat-leaning) | Reduced nutrition | Increased nutrition |
| Extreme (obligate carnivore) | Cannot digest (efficiency curve drops to zero at extreme expression) | Full nutrition |

The two cliff effects — "cannot eat meat" at Carnivory < 10, and "cannot digest plants" at extreme Carnivory — are the only discrete branches, and they exist at the functional minimum / maximum thresholds rather than at arbitrary tier boundaries. Everything in between is smooth interpolation.

This creates the food chain: herbivores eat plants, carnivores hunt animals (which means killing them and harvesting their corpses), and omnivores fall in the middle with versatility but no specialization bonus.

### 6.2 Predation, Killing, and Harvesting

**v4:** Agents walk up to trees and harvest directly. Trees lose units. Trees are infinite resource dispensers.

**v5:**
1. To get resources from a living organism, you must **kill it first** (reduce HP to 0 via attack).
2. When an organism with **Harvestable > 0** dies, a **corpse block** appears at its death location. The corpse is the organism's death visual — there is no separate death emoji, the corpse IS the visual.
3. Corpses contain resources proportional to the dead organism's traits (Size, Endurance, age, Harvestable expression).
4. Corpse type:
   - Plant phenotype dies → **plant corpse** (yields plant food and wood)
   - Animal phenotype dies → **animal corpse** (yields meat food)
   - Mixed phenotypes use their dominant body type
5. Any organism with the harvest action available can gather resources from a corpse (subject to diet — herbivores can't process meat corpses).
6. Corpses **decay over time** — unharvested resources are lost.
7. Organisms with **Harvestable = 0** simply disappear on death with no corpse.

**Implications:**
- Trees are no longer infinite dispensers. Killing too many causes resource scarcity, creating selective pressure.
- Carnivores create corpses as a byproduct of feeding, opening a scavenger niche.
- Sessile prey (plants) are easy to find but require kills, gating access to wood/plant material behind combat ability.

**Future feature (out of scope for v5):** Territorial dynamics around corpse-rich areas — predators defending kill sites, scavengers contesting corpses. Mentioned here for awareness; not implemented in v5.

### 6.3 Water and Saltwater

- **Freshwater blocks**: Drinkable by all organisms. Satisfies water needs at full rate.
- **Saltwater blocks**: Only useful to organisms with **Saltwater Tolerance > 0**. Higher tolerance = faster water extraction, but always slower than drinking freshwater. At Tolerance = 0, the organism cannot drink saltwater at all.
- **Aquatic** (separate trait): controls water cell traversal. An organism may have high Aquatic but zero Saltwater Tolerance — it can swim through saltwater but cannot drink it.
- **Plants and water**: Photosynthesis efficiency is enhanced by proximity to water (existing v4 mechanic, retained). Plants far from water have reduced photosynthesis output.

### 6.4 Plant Reproduction (Asexual Only for v5)

Plants and fungi reproduce **asexually only** in v5. The complexity of pollination, sexual reproduction for immobile organisms, and pollinator-organism relationships is deferred to a future version.

Mechanism:
- Immobile organisms with reproduction enabled and sufficient energy will periodically attempt asexual reproduction
- A seed/spore (a juvenile-stage offspring) is placed at a random nearby cell within a dispersal radius determined by trait expression
- The new juvenile is created with the parent's DNA passed through `mutate()` (no crossover)
- If the dispersal cell is occupied or untraversable, the seed/spore fails to plant

This means immobile lineages naturally have lower genetic diversity over time (no crossover) but adapt slowly through mutation alone. Volatility becomes especially important for plants — high-Volatility plant lineages are the only way for stationary organisms to evolve quickly.

### 6.5 Geographic Isolation Through Terrain

To enable allopatric speciation (populations diverging because they cannot interbreed across barriers), v5 expands the world generator to produce more **untraversable terrain**, naturally creating **isolated population pockets**.

- World generation should produce mountain ranges, walls of obstacles, water bodies, or other impassable features that divide the map into multiple connected regions
- Organisms in different regions cannot interbreed (subject to mobility constraints — fish can cross water barriers, walking organisms cannot)
- Over time, isolated populations diverge due to independent mutation and selection pressures
- This is a world-generation concern; mechanics for the existing pathfinding and grid systems do not change

The exact terrain generation algorithm is a TRD concern. Suggested approach: noise-based biome sketching with deliberate barrier placement.

### 6.6 Death

When an organism dies:

1. **Cause of death** is recorded: starvation, combat, old age, disease (if applicable), other
2. If Harvestable > 0: a corpse block appears at the death location. **The corpse IS the death visual** — no separate death emoji is shown.
3. If Harvestable = 0: organism disappears with no corpse and no special visual (a brief shrink animation plays).
4. Resources from the organism's inventory are dropped as a loot bag (existing v4 mechanic, retained).
5. Event emitted: `organism:died` with cause, location, and genome summary.

### 6.7 Pregnancy and Need Transfer

Pregnancy in v5 introduces a **gradual need transfer** from parent to offspring during gestation. This replaces v4's simple "donated fullness" model.

Mechanic:
1. At conception, the offspring's DNA is determined (crossover + mutation) and the gestating organism enters the Pregnancy state.
2. The offspring begins with **all needs at zero** — fullness, hygiene (if applicable), social (if applicable).
3. Each tick during pregnancy, the parent transfers a small amount from each of its needs to the offspring's corresponding needs. The transfer rate is determined by the parent's Pregnancy expression (longer gestation = slower transfer = less burden per tick).
4. **The parent's needs decay at an increased rate** equal to the transfer rate, on top of its normal decay. A pregnant organism is genuinely metabolically taxed because it is feeding the offspring from its own reserves.
5. Pregnancy ends when either:
   - The offspring's needs reach a sufficient threshold (full birth — birth occurs)
   - The parent dies (offspring is lost; no birth)
6. At birth, the offspring is created at the parent's location with its accumulated need values as its starting needs — typically near full if pregnancy completed normally.

For organisms with Pregnancy = 0, this entire system is bypassed: the offspring is created instantly at conception with default starting needs (subject to the entity framework defaults).

### 6.8 Disease and Hygiene (Animal-Like Organisms Only)

**v4:** Disease is contracted via low hygiene and contact with poop. All agents have a hygiene need.

**v5:** Hygiene and disease are restricted to animal-like phenotypes (Person, Fish, Amphibian, Colony Insect, Predator, Critter, Photo-Critter, Blob). **Plants, Sessile Predators, and Fungi do not have hygiene needs and cannot contract diseases.**

**Hygiene is assigned at birth based on phenotype class.** Each phenotype definition carries a `hasHygiene: boolean` field. When the phenotype classifier assigns a phenotype at birth, the organism's hygiene component is created (or omitted) based on this flag. Animal-like phenotypes are flagged `hasHygiene = true`; plant-like phenotypes are flagged `false`. Because phenotype is locked at birth (Section 7.2), an organism's hygiene status is immutable for its lifetime. If a lineage shifts phenotype across generations (e.g., a critter lineage mutates into a sessile critter), the new offspring is born without hygiene while the parent keeps it — a clean per-organism transition.

Additionally, **poop is beneficial to plants** in v5. Plants near poop blocks gain a fertility/growth bonus (faster reproduction, slightly faster photosynthesis). This creates a natural ecological loop: animals defecate → plants thrive → herbivores eat plants → predators eat herbivores → corpses → scavengers. The world fertility cycle becomes a real game mechanic.

Disease is otherwise unchanged from v4 — Immunity gene reduces contraction chance, and infected organisms suffer health drain until they recover or die.

**Future direction (out of scope):** A virus system that affects all organisms regardless of phenotype, with the ability to alter DNA mid-life — providing a horizontal gene transfer mechanism that complements vertical inheritance.

### 6.9 Leveling and Energy Cost Scaling

Organisms with Aptitude > 0 have an XP system. Each level grants stat increases (HP, attack, energy capacity), but **also increases the energy cost of every action** by a small amount.

This is the trade-off for the Aptitude trait: leveling fast is metabolically expensive. An organism with Aptitude near 0 levels slowly but pays normal energy costs forever. An organism with maxed Aptitude levels rapidly to high stats, but its food requirements grow proportionally.

The exact curve (linear vs exponential, percent vs flat) is a TRD concern. The principle is: leveling provides power AND cost in lockstep, so high-Aptitude organisms cannot dominate by leveling alone — they must also evolve adequate metabolism and foraging efficiency.

### 6.10 Emotion Bonuses (Symmetric Mood Effects)

Organisms with Emotion > 0 enter the mood system. Mood states (happy, content, unhappy, frustrated) are derived from need satisfaction.

**v5 makes mood effects symmetric**:
- **Happy** organisms gain bonuses: faster action speed, slightly stronger combat, higher chance of positive social outcomes, mood-driven idle emoji.
- **Content** organisms operate at baseline.
- **Unhappy / frustrated** organisms suffer penalties: slower actions, reduced combat, lower social success, sad idle emoji.

This makes Emotion a genuine double-edged sword. An organism with high Emotion gets bigger bonuses when thriving but also bigger penalties when struggling. Moodless organisms (Emotion = 0) have flat performance regardless of need state.

### 6.11 World Seeding

Initial population is seeded using **template-weighted random DNA**:

| Template | Weight | Key Traits | Purpose |
|----------|--------|-----------|---------|
| Plant | ~50% | High Photosynthesis, Agility = 0, Longevity, Harvestable, Parthenogenesis | Resource base and food source |
| Animal | ~30% | Agility, Emotion, Sociality, moderate Strength | Classic mobile social organisms |
| Predator | ~10% | Agility, Strength, Carnivory, Aggression, Sociality = 0 | Predation pressure |
| Wildcard | ~10% | Fully random DNA | Genetic diversity, possible novel phenotypes |

Templates provide starting DNA, not fixed species. After a few generations of crossover and mutation, the population may look nothing like the templates.

---

## 7. Resolved Design Decisions

The following questions from the previous PRD revision have been resolved:

### 7.1 Heterotrophy as a Default
Eating is a **default capability**. Photosynthesis is an additional gene that adds passive energy generation but does not disable eating. Organisms with high Photosynthesis can still eat, though they have less need to.

### 7.2 Phenotype Mutability
Phenotype is **locked at birth**. Re-deriving phenotype each tick would be too expensive (DNA parsing + trait re-expression). Genes are fixed for an organism's lifetime; only stats from leveling change post-birth.

### 7.3 Size and Grid Cells
**One organism per cell** regardless of Size. Large organisms render visibly larger within their cell (visual scaling), but spatial occupation is unchanged.

### 7.4 Disease and Hygiene
Hygiene and disease are restricted to **animal-like phenotypes**. Plants and fungi have no hygiene needs and cannot contract diseases. Poop becomes a **fertilizer** for plants. (See Section 6.8.)

### 7.5 Toxicity
**Excluded from v5.** Reserved for a future version.

### 7.6 Dormancy
**Excluded from v5.** Reserved for a future version.

### 7.7 Flat Stats for Non-Leveling Organisms
Organisms with Aptitude = 0 have **flat stats for life**. No passive growth.

### 7.8 Plant Decision-Making
Plants and other immobile organisms use a **simplified tick** loop, not the full decision engine. The simplified tick handles only: passive energy generation, growth, reproduction attempts, ambient damage application, death checks. No action scoring, no decision tree, no movement.

### 7.9 Visual Coherence for Mobile Organisms
**Mobile organisms can never have plant or fungus emoji.** Phenotype classification rules order mobility-based phenotypes BEFORE plant/fungus rules, with plants gated behind Agility = 0. Mobile photosynthesizers fall into the "Photo-Critter" phenotype with appropriate creature emoji.

---

## 8. Integration With Existing Systems

This section maps v5 features to the v4 systems they touch and notes integration concerns. This is a working list to inform the TRD.

### 8.1 EventBus

The existing event bus is reused. New events for v5:
- `organism:phenotype_assigned` — fired at birth with phenotype class
- `organism:stillborn` — fired when viability check fails
- `corpse:created` — fired when a Harvestable organism dies
- `corpse:decayed` — fired when an unharvested corpse expires
- `pregnancy:transfer_tick` — fired each tick during gestation (for UI)

Some v4 events (`agent:died`, `agent:born`) are renamed or generalized to `organism:*` since the agent/non-agent distinction is gone.

### 8.2 Decision Engine

The v4 decision engine handles all action scoring for animal-like organisms. For v5:
- The decision engine is unchanged in structure but now serves only **mobile, decision-capable** organisms
- A new **simplified tick** path is added for plants and other immobile organisms (Section 7.8)
- Action availability is filtered by phenotype + trait expression (Section 4.3)

### 8.3 Action Registry

The v4 action registry is extended:
- New action: `hunt` (combat against living organisms specifically for food)
- Existing `attack` is generalized to work against any organism, not just other agents
- Existing `harvest` is generalized to work against corpses, not trees specifically
- Each action gains an optional `tool` field for the directional tool emoji (Section 5.4)
- Tree-specific actions are removed (no more "harvest tree" — it's "harvest corpse")

### 8.4 Block Manager

The v4 BlockManager handles trees, food, water, etc. For v5:
- **TreeBlock is removed entirely** — trees become organisms
- A new **CorpseBlock** type replaces TreeBlock for the resource-yielding lifecycle
- Plant food and meat food are tracked as separate block types or as a typed FoodBlock
- BlockManager continues to handle world block lifecycle for non-organism entities (food, corpses, eggs, loot, poop, farms, flags)

### 8.5 Rendering Pipeline

The v4 renderer needs significant changes:
- Organism rendering replaces agent rendering and tree rendering as a unified pass
- Indicator slots (Section 5.3) are a new layer
- Tool rendering (Section 5.4) is preserved from v4 but generalized to all directed actions
- Animation system (Section 5.2) replaces the v4 emotion-based idle emoji selection as the primary action indicator
- Phenotype-based emoji caching can reuse v4's emoji-cache.ts

### 8.6 World Generator

The v4 world generator produces terrain, water, salt water, and seeds initial trees and agents. For v5:
- Initial seeding uses template-weighted DNA (Section 6.11) to create organisms instead of trees and agents separately
- Terrain generation expands to produce more obstacles and create geographic isolation pockets (Section 6.5)
- Water and saltwater generation is unchanged

### 8.7 Genetics Module

The v4 genetics module is the foundation for v5:
- `genome.ts`, `expression.ts`, `crossover.ts`, `mutation.ts` are largely reused
- `gene-registry.ts` is rewritten with the v5 trait catalog (Section 3.4)
- New functional minimums replace the old min/max clamping
- Volatility integration changes how `mutate()` is called (rate is now per-organism, not global)

### 8.8 Persistence

v4 save files are not compatible. The v5 persistence layer needs:
- New schema for organism (replaces agent + tree separately)
- Phenotype field stored per organism
- Updated trait catalog reference
- Version marker `v5.0` so the loader can reject older saves

---

## 9. Implementation Deliverables

The PRD is the design document. The TRD will define the technical architecture for these features. In addition, the following documentation work is required as part of v5 implementation:

### 9.1 Existing Docs to Rewrite

These v4 docs describe systems that are fundamentally changing in v5 and need full rewrites:

- `docs/00-overview.md` — architecture overview
- `docs/01-agent-structure.md` — rename to `01-organism-structure.md`
- `docs/02-traits.md` — full rewrite for v5 trait catalog
- `docs/03-decision-making.md` — add simplified tick path for immobile organisms
- `docs/04-actions.md` — update for new tool system, hunt action, corpse harvesting
- `docs/05-social-behavior.md` — update for Sociality replacing Social/Gregariousness
- `docs/06-movement.md` — update for Agility replacing Mobility
- `docs/07-factions.md` — update Sociality references
- `docs/08-resources.md` — full rewrite for meat/plant split, corpses
- `docs/09-combat.md` — update for kill-before-harvest model
- `docs/10-reproduction.md` — update for pregnancy transfer mechanic, plant asexual only
- `docs/domains/genetics.md` — full rewrite for v5 genetics
- `docs/domains/entity.md` — full rewrite for organism model
- `docs/domains/decision.md` — add simplified tick documentation
- `docs/domains/action.md` — update for v5 action changes
- `docs/domains/simulation.md` — update for unified organism tick
- `docs/domains/world.md` — update for terrain generation expansion
- `docs/domains/rendering.md` — full rewrite for movesets, indicators, tools, animations
- `docs/domains/ui.md` — update for indicator slot configuration
- `docs/domains/persistence.md` — update for v5 schema

### 9.2 New Docs to Create

- `docs/11-phenotype-classification.md` — phenotype rule table, mobility-first rule, classification logic
- `docs/12-food-chain.md` — meat/plant food types, predation mechanics, scavenging
- `docs/13-corpses-and-harvesting.md` — corpse lifecycle, kill-before-harvest, decay
- `docs/14-animations.md` — universal animation system, animation registry
- `docs/15-indicators-and-tools.md` — indicator slot system, tool directional rendering
- `docs/16-pregnancy-transfer.md` — gradual need transfer mechanic
- `docs/17-volatility-and-mutation.md` — per-organism mutation rate
- `docs/18-geographic-isolation.md` — terrain-driven population pockets
- `docs/domains/phenotype.md` — domain-level phenotype documentation if a new domain is created
- `tech_specs.md` — full update to v5 game mechanics

### 9.3 PRD/TRD Deliverables

- This document (`v5-prd.md`) — the design contract
- A new `v5-trd.md` — the technical architecture document, to be written after PRD approval
- Decision log entries for any further design pivots during implementation

---

## 10. Resolved Design Decisions (Round 2)

The remaining open questions from the previous revision have been resolved. The PRD body sections above have been updated to reflect these decisions; this section is the audit trail.

### 10.1 Functional Minimum Values — RESOLVED
Functional minimums are **defined in this PRD** (Section 3.5.1) rather than deferred to the TRD. They are design contracts that anchor phenotype classification. The TRD may adjust the exact numbers during tuning, but the conceptual thresholds are locked here. Phenotype rules in Section 4.2 reference these values directly.

### 10.2 Diet Categories vs Continuous Carnivory — RESOLVED
**Pure continuous.** Eating efficiency uses smooth interpolation: `efficiency(carnivory, foodType) → 0..1`. The four diet category names (strict herbivore / omnivore / carnivore / obligate carnivore) are documentation labels only — useful for designers and players to talk about diet, but the engine uses smooth math, not branches. The only discrete cliffs are at the functional minimum (Carnivory < 10 cannot eat meat) and at extreme expression (obligate carnivores cannot digest plants). See updated Section 6.1.

### 10.3 Photosynthesis and Maximum HP Trade-off — RESOLVED
**Moderate HP penalty + water proximity dependency.** Photosynthesis reduces max HP moderately (plants take a few hits to kill, not one), and water proximity is the primary population limiter — plants far from water photosynthesize poorly and naturally fail to thrive. This combination keeps plants killable for the food chain to function, but not so fragile that minor predation wipes out the resource base. See updated Section 3.4.3.

### 10.4 Photo-Critter Phenotype — RESOLVED
**Keep with distinctive greenish emojis.** The Photo-Critter phenotype is preserved as a rare emergent category. It uses greenish-tinted creature emojis (🐸🦎🐛🐌) so the rare emergence is visually identifiable. The cost of one config row is justified by preserving rare emergent stories that make the simulation interesting. See updated Section 4.2.

### 10.5 Volatility and Stillbirth Rate — RESOLVED
**Viability-only.** No direct stillbirth probability roll. Volatility increases offspring mutation rate, and stillbirths emerge naturally when mutations break essential genes and the existing viability check fails. This rewards lineages that build genomic robustness through gene duplication — a more genes per essential trait, the more mutations the lineage can absorb. The unpredictability is a feature: high Volatility is genuinely risky in a way that depends on lineage genetic structure. If during testing this proves too weak, a direct probability mechanism can be added in v5.1. See updated Section 3.5.

### 10.6 Per-Action Tool Rendering — RESOLVED
**Tools render only for actions whose `targetType === 'external_cell'`.** Self-targeted actions (sleep, wash, eat from inventory, drink saltwater, photosynthesize), area effects, and untargeted actions render no tool — the action is communicated entirely through animation. The decision is encoded in the action registry, not the renderer. See updated Section 5.4.

### 10.7 Hygiene Assignment — RESOLVED
**Phenotype-derived at birth.** Each phenotype definition carries a `hasHygiene: boolean` field. The phenotype classifier sets the flag at birth based on phenotype class, and the organism's hygiene component is created (or omitted) accordingly. Because phenotype is locked at birth (Section 7.2), hygiene status is immutable per organism. Lineages that mutate across phenotype classes cleanly transition: parent keeps its hygiene status, offspring is born with whatever its new phenotype dictates. See updated Section 6.8.

---

## 11. Deferred to Future Versions

Explicitly NOT part of v5:

- **Toxicity** trait
- **Dormancy** / hibernation trait
- **Flying** / aerial movement (Z-axis)
- **Biome-specific terrain effects** beyond impassable obstacles
- **Tool crafting and equipment**
- **Organism communication** (pheromones, sound, signals)
- **Player-controlled organisms**
- **Symbiosis mechanics** (mutualism, parasitism, commensalism)
- **Weather and seasons**
- **Underground / burrowing layer**
- **Profession / specialization system**
- **Migration patterns**
- **Territorial dynamics** around corpses or resources
- **Pollination** for sexual plant reproduction
- **Viral DNA modification** (horizontal gene transfer)
