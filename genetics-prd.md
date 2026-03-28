# PRD: Genetics System

**Version:** 0.1 (Draft)
**Status:** Requirements Gathering
**Target:** v4.0.0

---

## 1. Goals

1. **Auto-balancing through evolution.** Agents with maladaptive gene combinations die out; well-adapted ones reproduce. Over many generations, the population self-tunes without manual constant tweaking.
2. **Emergent personality.** Every agent becomes meaningfully unique — not just "aggression 0.47 vs 0.52" but genuinely different builds with different survival strategies.
3. **Lineage tracking.** Family names create observable dynasties. Players can follow a bloodline's rise and fall.
4. **Structural cleanup.** Replace the patched-together if-statement chains with a clean, composable system for decisions, actions, and needs.

### Non-Goals (this release)
- Mood system (future feature, but architecture should support it)
- Faction laws (future)
- Proficiency / job class system (future)

---

## 2. Genetic Encoding

### 2.1 DNA Structure

A DNA string of **variable length**, minimum 100 characters, maximum 255 characters. Each **gene** occupies exactly **5 characters**:

```
[A-Za-z][A-Za-z][0-9][0-9][0-9]
```

- **Characters 1–2 (identifier):** Two letters that determine what the gene codes for. Both letters must be the **same case** to be valid.
  - **Uppercase pair** (e.g., `AA`) = reinforcing (positive) effect on a trait.
  - **Lowercase pair** (e.g., `aa`) = reducing (negative) effect on the same trait.
  - **Mixed case** (e.g., `Aa`, `aB`) = **non-coding** (invalid gene, ignored during expression).
  - The letter pair (ignoring case) identifies the trait category: 26 first letters x 26 second letters = **676 trait categories**, each with a reinforcing (uppercase) and reducing (lowercase) variant.
- **Characters 3–5 (magnitude):** Three digits `000`–`999` representing the gene's effect strength.

**Examples:**
```
AA102  → Strength gene,    +102
AA122  → Strength gene,    +122
aa020  → Weakness gene,    -20
aa100  → Weakness gene,    -100
BB450  → Longevity gene,   +450
Cd200  → Non-coding gene   (mixed case — invalid)
Xy100  → Non-coding gene   (mixed case — invalid)
ZZ500  → Non-coding gene   ("ZZ" not mapped to any trait in catalog)
```

### 2.2 Gene Count & DNA Length

- DNA length is always a multiple of 5 (enforced at creation).
- Min: 100 chars = **20 genes**
- Max: 255 chars → rounded to 250 = **50 genes**
- Initial population DNA length: **200 chars = 40 genes** (can evolve longer/shorter via mutation — see 2.6).

### 2.3 Gene Catalog

Each trait is coded by one gene pair (uppercase = positive, lowercase = negative). The gene code, trait name, and mapping are:

| Gene Code | Trait | Positive Effect | Negative (Antagonist) | Essential? |
|-----------|-------|-----------------|----------------------|------------|
| `AA`/`aa` | **Strength** | Higher base attack, better per-level growth | Lower base attack | Yes |
| `BB`/`bb` | **Longevity** | Longer max lifespan | Shorter max lifespan | Yes |
| `CC`/`cc` | **Vigor** | Higher max energy, better per-level growth | Lower max energy | Yes |
| `DD`/`dd` | **Metabolism** | Slower fullness decay, faster movement & actions | Faster fullness decay, slower movement | Yes |
| `EE`/`ee` | **Resilience** | Higher base max health, better per-level growth | Lower base max health | Yes |
| `FF`/`ff` | **Immunity** | Lower disease contraction chance | Higher disease contraction chance | No |
| `GG`/`gg` | **Agility** | Faster movement speed | Slower movement speed | No |
| `HH`/`hh` | **Aptitude** | Less XP needed per level | More XP needed per level | No |
| `II`/`ii` | **Cooperation** | More likely to help/heal/share | Less likely | No |
| `JJ`/`jj` | **Aggression** | More likely to attack | Less likely to attack | No |
| `KK`/`kk` | **Courage** | Will fight at lower HP before fleeing | Flees at higher HP | No |
| `LL`/`ll` | **Fertility** | Stronger urge to reproduce, lower energy threshold | Weaker urge | No |
| `MM`/`mm` | **Recall** | Larger resource memory (more entries) | Smaller resource memory | No |
| `NN`/`nn` | **Charisma** | More relationship slots | Fewer relationship slots | No |
| `OO`/`oo` | **Gregariousness** | Social need decays faster (needs interaction), higher thresholds | Social need decays slower | No |
| `PP`/`pp` | **Appetite** | Higher fullness thresholds (seeks food earlier) | Lower thresholds (tolerates hunger longer) | No |
| `QQ`/`qq` | **Maturity** | Shorter baby duration (matures faster) | Longer baby duration | No |
| `RR`/`rr` | **Endurance** | Larger inventory capacity | Smaller inventory capacity | No |
| `SS`/`ss` | **Fidelity** | Less likely to leave faction, less likely to join new one | More likely to switch | No |
| `TT`/`tt` | **Parthenogenesis** | Can reproduce asexually | Requires a partner (default) | No |

**Non-coding genes:** A gene is non-coding if:
1. Its identifier has **mixed case** (e.g., `Cd`, `aB`, `xY`) — structurally invalid.
2. Its identifier is **same-case but not in the catalog** (e.g., `ZZ`, `WW`, `vv`) — valid format but unmapped.

Non-coding genes occupy space in the DNA, participate in crossover and mutation, but have no effect on traits. This is intentional — it provides a pool for mutations to accidentally create new functional genes.

**Non-essential traits with no genes:** If an agent's DNA contains zero genes (neither reinforcing nor reducing) for a non-essential trait, that trait uses its **default value**. For example, an agent with no Courage genes at all gets the default 0.5 flee threshold. This is safe because non-essential traits are, by definition, survivable at their defaults.

### 2.4 Trait Calculation (Expression)

At birth, the DNA is read once. For each trait:

```
rawValue = sum(all matching uppercase gene magnitudes) - sum(all matching lowercase gene magnitudes)
```

The raw value is then **normalized** to a game-useful range using a mapping function:

```
traitValue = mapToRange(rawValue, traitMin, traitDefault, traitMax)
```

**Normalization approach — clamped linear with a baseline:**

Each trait defines:
- `min`: Absolute floor (game can't function below this)
- `default`: Value when rawValue = 0 (no genes for this trait, or perfectly balanced)
- `max`: Absolute ceiling (prevents degenerate builds)
- `scale`: How many raw points = 1 unit of game stat

```typescript
function expressGene(rawValue: number, min: number, default: number, max: number, scale: number): number {
  return clamp(default + (rawValue / scale), min, max);
}
```

**Trait Ranges & Defaults:**

| Trait | Min | Default | Max | Scale | Unit | Notes |
|-------|-----|---------|-----|-------|------|-------|
| Strength (base attack) | 3 | 8 | 18 | 100 | damage | +raw/100 from base 8 |
| Strength (per-level) | 0.5 | 1.5 | 3.5 | 100 | damage/lvl | |
| Longevity | 120k | 300k | 600k | 0.5 | ms | max age |
| Vigor (base max energy) | 100 | 200 | 350 | 1 | energy | |
| Vigor (per-level) | 2 | 5 | 10 | 100 | energy/lvl | |
| Metabolism (fullness decay) | 0.01 | 0.03 | 0.06 | 10000 | /tick | Lower = slower, so inverted: high raw = slow decay |
| Metabolism (speed mult) | 0.7 | 1.0 | 1.4 | 500 | multiplier | Also affects action time reduction |
| Resilience (base max HP) | 60 | 100 | 180 | 1 | HP | |
| Resilience (per-level) | 3 | 8 | 15 | 100 | HP/lvl | |
| Immunity | 0.0 | 0.05 | 0.15 | 10000 | contraction chance | Inverted: high raw = lower chance |
| Agility | 0.5 | 1.0 | 2.0 | 500 | speed multiplier | Cells per tick scaling |
| Aptitude | 10 | 25 | 50 | 100 | XP/level | Inverted: high raw = less XP needed |
| Cooperation | 0.0 | 0.5 | 1.0 | 500 | probability | |
| Aggression | 0.0 | 0.5 | 1.0 | 500 | probability | |
| Courage (flee HP%) | 0.1 | 0.5 | 0.9 | 500 | HP ratio | High courage = flees at lower HP |
| Fertility (energy threshold) | 50 | 90 | 130 | 1 | energy | Inverted: high raw = lower threshold |
| Recall | 1 | 2 | 8 | 200 | entries | Resource memory slots |
| Charisma | 5 | 20 | 40 | 1 | relationships | Max relationship slots |
| Gregariousness (social decay) | 0.002 | 0.01 | 0.025 | 10000 | /tick | |
| Appetite (seek threshold) | 20 | 40 | 70 | 10 | fullness | When to start seeking food |
| Maturity (baby duration) | 20k | 60k | 120k | 1 | ms | Lower = matures faster |
| Endurance (inventory) | 8 | 20 | 40 | 10 | slots | |
| Fidelity | 0.0 | 0.5 | 1.0 | 500 | probability | Faction loyalty |
| Parthenogenesis | 0/1 | 0 | 1 | — | boolean | Special: expressed if raw > 0 |

### 2.5 Essential Genes & Viability

Essential traits: **Strength, Longevity, Vigor, Metabolism, Resilience.**

At birth, after DNA is parsed:
1. Check that at least one functional gene exists for each essential trait (either positive or negative variant).
2. Check that final expressed values are within survivable ranges (i.e., none hit the absolute minimum).
3. If either check fails → **stillborn**. The reproduce action completes but no child is created. Log: `"{parent} had a stillborn child"`.

This creates natural selection pressure: mutations that destroy essential genes are lethal.

### 2.6 Mutation

Mutations occur during reproduction, after crossover (see 3.2), applied to the child's DNA.

**Mutation rate:** Per-character chance: **0.5%** (1 in 200 characters).

**Mutation types (per character position):**

| Position | Original | Mutation | Example |
|----------|----------|---------|---------|
| Letter (pos 1 or 2) | `A` | Random letter (A-Z or a-z) | `AA102` → `BA102` (now maps to a different trait, or non-coding if unmapped) |
| Digit (pos 3, 4, or 5) | `1` | Random digit (0-9) | `AA102` → `AA192` |

**Special mutation outcomes:**
- **Gene nullification:** If a mutation produces an invalid format (e.g., a digit in letter position), the gene becomes non-coding. Example: `AA102` → `A2102` is unreadable → treated as non-coding.
- **Gene activation:** A non-coding gene could mutate into a functional one. `Cd200` → `CC200` (now a Vigor gene).
- **Trait swap:** A gene could mutate from one trait to another. E.g., `AA102` → `BA102` — if `BA` is mapped to a different trait, the gene now codes for that trait instead of Strength. If `BA` is not in the catalog, it becomes non-coding.
- **Polarity flip:** `AA102` → `aA102` — becomes non-coding (mixed case isn't in the catalog). But `AA102` → `aa102` requires both letters to mutate (very rare but possible over generations).

**Length mutation (rare):**
- **1% chance per reproduction** of a gene duplication (a random 5-char gene is copied and appended).
- **1% chance per reproduction** of a gene deletion (a random 5-char segment is removed).
- DNA length is always clamped to [100, 250] after mutation.

---

## 3. Reproduction & Inheritance

### 3.1 Gender Model

There are no fixed genders. The agent who **initiates** the reproduce action assumes two roles:

| Role | Aspect | Effect |
|------|--------|--------|
| **Carrier** (maternal analog) | Pregnancy | Bears the pregnancy (egg over head, movement/attack debuff, faster hunger) |
| **Lineage holder** (paternal analog) | Name & faction | Child inherits family name and faction membership |

The **recipient** contributes DNA through crossover but is otherwise unaffected after the reproduce action completes.

### 3.2 Crossover (DNA Recombination)

1. Start with a **full copy** of the initiator's DNA.
2. For each gene position (every 5-char block), there is a **50% chance** the gene is replaced by the gene at the **same position** in the recipient's DNA.
3. If one parent's DNA is longer than the other:
   - The child's DNA starts as a copy of the initiator's (full length).
   - Crossover only applies to positions that exist in **both** parents.
   - Genes beyond the shorter parent's length are inherited unchanged from the initiator.
4. Apply mutations (Section 2.6) to the resulting DNA.
5. Check viability (Section 2.5). If not viable → stillborn.

**Asexual reproduction (Parthenogenesis trait):**
- No crossover. Child DNA = copy of parent DNA + mutations only.
- No partner required. The parent both initiates and carries.
- Genetic diversity comes solely from mutation.

### 3.3 Pregnancy

After the reproduce action completes, the initiator enters a **pregnancy state**:

| Property | Value |
|----------|-------|
| Visual | Egg emoji (🥚) rendered above the agent |
| Duration | `babyDuration * 0.5` (half the child's eventual baby duration, from Maturity gene) |
| Movement speed | Reduced by 30% |
| Attack stat | Reduced by 40% |
| Fullness decay | Increased by 50% (eating for two) |
| Can be attacked | Yes (pregnant agents are vulnerable) |
| Can reproduce again | No (blocked until birth) |
| On death while pregnant | Child is lost (no stillborn, just death) |

At the end of pregnancy:
- Child agent is spawned in an adjacent free cell.
- Child enters baby stage (duration determined by Maturity gene).
- Initiator returns to normal stats.

### 3.4 Family Names

**Structure:** `FirstName FamilyName`

- **FirstName:** 6-character pronounceable string (existing system).
- **FamilyName:** Assigned based on reproduction context:
  - **First-generation agents** (spawned at world init or from eggs): Family name = their first name (they found a lineage).
  - **Born agents:** Inherit the family name of the **initiator** (the carrier parent).

**Display:** UI inspector shows full name. Event log uses first name only (for brevity). Faction panel shows `FirstName F.` (initial).

**Dynasty tracking:** The World should maintain a `familyRegistry: Map<string, FamilyStats>` that tracks:
- Family name
- Total members ever born
- Currently alive count
- Average longevity
- Generation count (max depth from founder)

---

## 4. Trait Definitions

Each trait below includes: what it affects, which genes code for it, and the game-mechanical effects.

### 4.1 Strength
**Genes:** `AA` (positive), `aa` (negative) | **Essential:** Yes

Determines base attack damage and per-level attack growth.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Base attack | `expressGene(raw, 3, 8, 18, 100)` | 8.0 |
| Per-level growth | `expressGene(raw, 0.5, 1.5, 3.5, 100)` | +1.5/level |

**Interactions:**
- Damage dealt per tick = `attack * 0.4`
- Pregnancy reduces effective attack by 40%

### 4.2 Resilience
**Genes:** `EE` (positive), `ee` (negative) | **Essential:** Yes

Determines base max health and per-level health growth.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Base max HP | `expressGene(raw, 60, 100, 180, 1)` | 100 |
| Per-level growth | `expressGene(raw, 3, 8, 15, 100)` | +8/level |

### 4.3 Vigor
**Genes:** `CC` (positive), `cc` (negative) | **Essential:** Yes

Determines max energy pool and per-level energy growth.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Base max energy | `expressGene(raw, 100, 200, 350, 1)` | 200 |
| Per-level growth | `expressGene(raw, 2, 5, 10, 100)` | +5/level |

### 4.4 Longevity
**Genes:** `BB` (positive), `bb` (negative) | **Essential:** Yes

Determines how long an agent lives.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Max age | `expressGene(raw, 120000, 300000, 600000, 0.5)` ms | 300k ms |

Agents die when `ageTicks >= maxAgeTicks`. Longer-lived agents have more time to reproduce but consume more resources over their lifetime.

### 4.5 Metabolism
**Genes:** `DD` (positive), `dd` (negative) | **Essential:** Yes

Determines fullness decay rate. Higher metabolism = slower fullness decay BUT also reduces action durations and increases movement efficiency.

| Component | Formula | Defaults | Notes |
|-----------|---------|----------|-------|
| Fullness passive decay | `expressGene(-raw, 0.01, 0.03, 0.06, 10000)` /tick | 0.03 | Inverted: positive genes reduce decay |
| Action duration multiplier | `expressGene(raw, 0.7, 1.0, 1.4, 500)` | 1.0 | Stacks with inspiration multiplier |

**Design intent:** This is a core tradeoff gene. High metabolism agents eat less often and act faster, but the gene "costs" DNA slots that could be used for other traits.

### 4.6 Agility
**Genes:** `GG` (positive), `gg` (negative) | **Essential:** No

Determines movement speed.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Move speed multiplier | `expressGene(raw, 0.5, 1.0, 2.0, 500)` | 1.0 |

**Implementation:** Speed multiplier affects the tick-based movement system. At 1.0x, agents move 1 cell per movement tick (current behavior). At 2.0x, they move every other tick costs half, effectively doubling speed. At 0.5x, movement takes 2 ticks per cell.

Pregnancy reduces effective agility by 30%.

### 4.7 Immunity
**Genes:** `FF` (positive), `ff` (negative) | **Essential:** No

Determines disease resistance.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Contraction chance | `expressGene(-raw, 0.0, 0.05, 0.15, 10000)` | 0.05 (5%) |

Inverted: positive genes reduce contraction chance. An agent with enough Immunity genes can be effectively immune to disease. An agent with many negative immunity genes can contract disease even at moderate hygiene.

### 4.8 Aptitude
**Genes:** `HH` (positive), `hh` (negative) | **Essential:** No

Determines XP required per level.

| Component | Formula | Defaults |
|-----------|---------|----------|
| XP per level | `expressGene(-raw, 10, 25, 50, 100)` | 25 |

Inverted: positive genes reduce XP cost. Formula remains `level * xpPerLevel`.

### 4.9 Cooperation
**Genes:** `II` (positive), `ii` (negative) | **Essential:** No

Likelihood of performing helpful actions (heal, share, talk).

| Component | Formula | Defaults |
|-----------|---------|----------|
| Base probability | `expressGene(raw, 0.0, 0.5, 1.0, 500)` | 0.5 |

Used in the action selection system when evaluating "helpful" tagged actions.

### 4.10 Aggression
**Genes:** `JJ` (positive), `jj` (negative) | **Essential:** No

Likelihood of performing harmful actions (attack, quarrel).

| Component | Formula | Defaults |
|-----------|---------|----------|
| Base probability | `expressGene(raw, 0.0, 0.5, 1.0, 500)` | 0.5 |

### 4.11 Courage
**Genes:** `KK` (positive), `kk` (negative) | **Essential:** No

Determines the HP threshold at which an agent flees combat.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Flee HP ratio | `expressGene(-raw, 0.1, 0.5, 0.9, 500)` | 0.5 |

Inverted: high courage = lower flee threshold (fights to the death). An agent with flee ratio 0.1 will only flee when below 10% HP. An agent with 0.9 flees when below 90% HP (extremely cowardly).

**Replaces** the current implicit health penalty in attack probability.

### 4.12 Fertility
**Genes:** `LL` (positive), `ll` (negative) | **Essential:** No

Determines how eagerly an agent seeks reproduction.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Reproduce energy threshold | `expressGene(-raw, 50, 90, 130, 1)` | 90 |
| End-of-life urgency age | `expressGene(-raw, 0.6, 0.8, 0.95, 500)` | 0.8 |

Inverted: high fertility = lower energy threshold to reproduce and earlier urgency.

### 4.13 Parthenogenesis
**Genes:** `TT` (positive), `tt` (negative) | **Essential:** No

Boolean trait: expressed if `rawValue > 0`.

| Expression | Effect |
|-----------|--------|
| `rawValue <= 0` | Requires a partner to reproduce (default) |
| `rawValue > 0` | Can reproduce alone (DNA is copied + mutated, no crossover) |

**Balance note:** Asexual agents reproduce faster (no partner search) but have less genetic diversity, making their lineage more vulnerable to environmental shifts. This is the natural balancing mechanism.

### 4.14 Recall
**Genes:** `MM` (positive), `mm` (negative) | **Essential:** No

Resource memory capacity.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Memory entries | `expressGene(raw, 1, 2, 8, 200)` | 2 per resource type |

Agents with high Recall remember more resource locations, making foraging more efficient.

### 4.15 Charisma
**Genes:** `NN` (positive), `nn` (negative) | **Essential:** No

Maximum number of relationships.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Relationship slots | `expressGene(raw, 20, 80, 200, 1)` | 80 |

More slots = more nuanced social behavior, more potential allies/enemies remembered.

### 4.16 Gregariousness
**Genes:** `OO` (positive), `oo` (negative) | **Essential:** No

How quickly social need decays and the thresholds for social need levels.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Social decay rate | `expressGene(raw, 0.002, 0.01, 0.025, 10000)` /tick | 0.01 |
| Social critical threshold | Scaled proportionally | 20 |

Highly gregarious agents become socially deprived quickly and seek out interaction more urgently. Low gregariousness agents are more self-sufficient.

### 4.17 Appetite
**Genes:** `PP` (positive), `pp` (negative) | **Essential:** No

Determines when an agent considers itself hungry.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Seek threshold | `expressGene(raw, 20, 40, 70, 10)` | 40 |
| Critical threshold | `seekThreshold * 0.5` (derived) | 20 |

High appetite agents start seeking food earlier (more cautious about hunger), while low appetite agents tolerate hunger longer (risk-takers).

### 4.18 Maturity
**Genes:** `QQ` (positive), `qq` (negative) | **Essential:** No

How long the baby stage lasts.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Baby duration | `expressGene(-raw, 20000, 60000, 120000, 1)` ms | 60k ms |

Inverted: positive genes = shorter baby duration (matures faster). Faster-maturing agents enter the active population sooner, but spend less time in the protected baby state.

### 4.19 Endurance
**Genes:** `RR` (positive), `rr` (negative) | **Essential:** No

Inventory capacity (how many items an agent can carry).

| Component | Formula | Defaults |
|-----------|---------|----------|
| Inventory capacity | `expressGene(raw, 8, 20, 40, 10)` | 20 |

### 4.20 Fidelity
**Genes:** `SS` (positive), `ss` (negative) | **Essential:** No

Faction loyalty.

| Component | Formula | Defaults |
|-----------|---------|----------|
| Leave probability modifier | `expressGene(-raw, 0.0, 0.5, 1.0, 500)` | 0.5 |

Inverted: high fidelity = lower chance of leaving faction when attacked by same-faction member, lower chance of being recruited away by a share action.

---

## 5. Needs System Overhaul

### 5.1 Need Bands

Each need now has **five bands** instead of two thresholds. The boundaries between bands are determined by genetics (specifically, the relevant trait) plus a fixed structure.

```
  0          critical    low        normal     high       100
  |------------|----------|----------|----------|----------|
   CRITICAL      LOW        NORMAL      HIGH       FULL
```

For each need, genetics determines the `seekThreshold` (boundary between LOW and NORMAL). Other boundaries are derived:

```
critical = seekThreshold * 0.5
low      = seekThreshold
normal   = seekThreshold + (100 - seekThreshold) * 0.4
high     = seekThreshold + (100 - seekThreshold) * 0.75
```

| Band | Behavior |
|------|----------|
| **CRITICAL** | Emergency action. Overrides almost everything. |
| **LOW** | Proactive seeking. Agent will go out of its way. |
| **NORMAL** | Opportunistic. Will act if convenient. |
| **HIGH** | Satisfied. No seeking behavior. |
| **FULL** | Fully satisfied. May share surplus. |

### 5.2 Need Definitions (Updated)

| Need | Genetic Influence | Decay | Replenishment | Band Source |
|------|------------------|-------|---------------|-------------|
| **Fullness** | Metabolism (decay rate), Appetite (thresholds) | Metabolism gene | +20 per eat | Appetite gene |
| **Hygiene** | — (no gene yet, uses defaults) | Move, social, poop | +30 per wash | Fixed defaults |
| **Social** | Gregariousness (decay + thresholds) | Gregariousness gene | +8 per share, talk | Gregariousness gene |
| **Inspiration** | — (no gene yet, uses defaults) | Passive | +15 play, +10 clean, +25 build | Fixed defaults |
| **Energy** | Vigor (max), Metabolism (passive drain scaling) | Passive + movement + actions | +8/tick sleeping | Vigor gene |

### 5.3 Rename: Drink → Wash

The "drink" action is renamed to **"wash"** across the entire codebase:
- Action type: `wash`
- Effect: +30 hygiene (unchanged)
- Emoji: `🧼` or `🚿` (TBD)
- Log messages: `"{name} washed up"`
- Consumes 1 water from inventory (unchanged)

---

## 6. Action System Refactor

### 6.1 Action Tags

Every action gets one or more **tags** from a fixed set:

```typescript
enum ActionTag {
  COMBAT    = 'combat',     // Harmful to others
  SOCIAL    = 'social',     // Involves another agent
  HELPFUL   = 'helpful',    // Benefits another agent
  SURVIVAL  = 'survival',   // Self-preservation
  RESOURCE  = 'resource',   // Gathering/managing resources
  BUILD     = 'build',      // Creating world structures
  HYGIENE   = 'hygiene',    // Cleanliness-related
  LEISURE   = 'leisure',    // Inspiration/play
  FACTION   = 'faction',    // Faction-related
}
```

**Action → Tag Mapping:**

| Action | Tags |
|--------|------|
| `attack` | `combat` |
| `talk` | `social` |
| `quarrel` | `social`, `combat` |
| `heal` | `social`, `helpful` |
| `share` | `social`, `helpful` |
| `reproduce` | `social` |
| `sleep` | `survival` |
| `eat` | `survival` |
| `wash` | `survival`, `hygiene` |
| `harvest` | `resource` |
| `pickup` | `resource` |
| `deposit` | `resource`, `faction` |
| `withdraw` | `resource`, `faction` |
| `poop` | `hygiene` |
| `clean` | `hygiene`, `leisure` |
| `play` | `leisure` |
| `build_farm` | `build`, `resource` |

### 6.2 Removed/Merged Actions

| Action | Status | Reason |
|--------|--------|--------|
| `attack_flag` | **Merged into `attack`** | Attack target can be an agent OR a flag. Same action, different target type. |
| `drink` | **Renamed to `wash`** | Hygiene, not consumption. |

### 6.3 Action Selection Architecture

The current inline if-chain is replaced with a **scored action selector**:

```
For each candidate action:
  score = baseScore(need bands)
         + geneticModifier(relevant traits)
         + situationalModifier(context)
         + [future: moodModifier]
         + [future: factionLawModifier]
         + [future: proficiencyModifier]
         + [future: jobClassModifier]

Select action with highest score (with some randomness to prevent determinism)
```

**Base scores** come from need bands — actions that address CRITICAL needs get very high scores, LOW needs get moderate scores, etc.

**Genetic modifiers** come from traits:
- Aggression boosts `combat` tagged actions
- Cooperation boosts `helpful` tagged actions
- Appetite affects the base score of `eat`
- Fidelity affects `deposit` and faction-related actions

**Situational modifiers:**
- Under attack: massive boost to `combat` or flee
- Adjacent to resource: boost to `harvest`
- Near faction flag: boost to `deposit`/`withdraw`
- Adjacent to partner with good relationship: boost to `reproduce`

**Hard overrides** still exist for truly critical situations:
- Energy < mandatory sleep threshold → sleep (non-negotiable)
- Baby state → eat/wash/roam only

### 6.4 Entity Classes

Different entity classes have different **action sets**, **emoji sets**, and **behavioral constraints**. The architecture must support per-class configuration from day one, even if most classes ship later.

**v4.0 classes (ship with genetics):**

| Class | Action Set | Emoji | Notes |
|-------|-----------|-------|-------|
| **Baby** | `eat`, `wash`, roam only | 👶 (idle), 👼 (eating) | Already exists but hardcoded. Formalize as a class with restricted action set. Duration from Maturity gene. |
| **Adult** | Full action set | 🙂 (idle) + action emojis | Standard agent. All 17 actions available. |

**v4.1 classes (near-future, architecture must support):**

| Class | Action Set | Emoji | Notes |
|-------|-----------|-------|-------|
| **Elder** | Adult set minus `reproduce`, reduced `attack` | 🧓 | Triggers at age > 90% of max lifespan. Wisdom bonus: higher Aptitude. Cannot reproduce but can still contribute. |
| **Animal** | `eat`, `wash`, `attack`, `reproduce`, `sleep`, `harvest`, roam | 🐾 (TBD per species) | No social actions (talk/share/heal/quarrel). No faction. No building. Biological survival only. Could have own gene catalog subset. |

**v4.2+ classes (future, architecture must support):**

| Class | Concept | Notes |
|-------|---------|-------|
| **Warrior** | Enhanced `attack` action, unique combat emoji | Job class derived from high Strength + Aggression + Courage genes |
| **Engineer** | Unique `build` actions, construction emoji | Job class derived from high Aptitude + Endurance genes |
| **Healer** | Enhanced `heal`, unique healing emoji | Job class derived from high Cooperation + Resilience genes |
| **Plant (tree)** | `grow`, `seed`, `photosynthesize` | Not a first-class agent but a close second. Different plant types adapted to different environments (dry, wet, fertile). Own gene catalog for growth rate, seed range, water needs. |
| **Plant (crop)** | `grow`, `fruit` | Simpler than trees. Farms produce crops; crops have genetic variation in yield and growth speed. |

**Architecture requirement:** Each entity class is defined by:
1. An **action set** (which actions are available)
2. An **emoji map** (which emojis represent each state/action)
3. A **gene catalog subset** (which genes are relevant — animals don't need Charisma)
4. A **decision weight override** (class-specific scoring adjustments)

Action sets and emoji maps must be configurable per class, not hardcoded as global lists. The `Agent` class should reference its class definition rather than containing this directly.

---

## 7. Decision Tree Refactor

### 7.1 Module Extraction

The decision tree moves from inline code in `simulation-engine.ts` and `interaction-engine.ts` into a dedicated module:

```
src/domains/decision/
  index.ts                 # Public API
  decision-engine.ts       # Core scored selection loop
  need-evaluator.ts        # Need band calculations
  action-scorer.ts         # Score calculation per action
  context-builder.ts       # Builds situational context (nearby agents, resources, etc.)
```

### 7.2 Decision Flow

```
Every tick (for idle agents):
  1. context = ContextBuilder.build(world, agent)
     - Nearby agents (with relationships, factions)
     - Nearby resources
     - Agent's need bands
     - Agent's current state (pregnant, baby, under attack)

  2. candidates = agent.actionSet.filter(isAvailable(context))
     - Remove actions the agent can't perform right now
     - e.g., can't attack if no targets, can't eat if no food

  3. scores = candidates.map(action => ActionScorer.score(action, agent, context))
     - Each action's score is the sum of factors

  4. selected = weightedSelect(scores)
     - Highest score wins, with small random noise to prevent perfect determinism

  5. Execute selected action or pathfind toward its target
```

### 7.3 Flee Behavior (New)

Currently there's no explicit flee. With the Courage gene, we add real flee behavior:

```
When agent is under attack AND health ratio < agent.courage.fleeThreshold:
  → Pathfind AWAY from attacker (opposite direction, 6-10 cells)
  → Movement speed is normal (or boosted by Agility)
  → Cannot be "locked" by the attacker

When agent is under attack AND health ratio >= agent.courage.fleeThreshold:
  → Retaliate (existing behavior)
```

---

## 8. World Changes

### 8.1 Egg Spawning

**Remove:** Eggs no longer spawn from trees.

**Add:** Water resource blocks have a small chance to produce an egg:
- Chance: `0.0002` per tick per large water block (reduced from previous rates)
- Only large water blocks (units > 10) can spawn eggs
- **No limit** on concurrent eggs — multiple eggs can exist on the map
- **No agent count requirement** — eggs spawn regardless of how many agents are alive. This serves as a constant failsafe against population collapse AND introduces genetic variety (egg-born agents get fully randomized DNA)
- Egg hatches after 60s (unchanged)
- Hatched agent gets randomized DNA (full random generation, like initial population)

**Narrative:** Water is the source of all life — both for agents (eggs) and for flora (seedlings/trees).

### 8.2 Seedling & Tree Changes

**Seedlings:**
- Seedlings **only grow when near water** (Manhattan distance ≤ 5 from a water block, matching `TUNE.tree.seedlingRadius`).
- If a seedling is not near water, its growth timer **pauses** (does not reset).
- Seedlings that lose water proximity (water dries up) pause but don't die.

**Trees:**
- Trees can **only produce seedlings when near water** (Manhattan distance ≤ 5 from a water block).
- The existing `seedlingNearWaterChance` constant becomes the primary seedling spawn chance; the non-water-adjacent passive chance is removed.

### 8.3 Water as Life Source

Water blocks now serve as the universal source of life, spawning both agents and flora:

1. **Agent hydration** (existing): Harvested for hygiene/washing
2. **Flora growth** (updated): Required for seedling growth and tree reproduction
3. **Agent spawning** (new): Rare egg generation from large water blocks
4. **Seedling spawning** (new): Water blocks can directly spawn seedlings at the same rate as eggs (`0.0002` per tick per large water block). This provides a failsafe against total plant population collapse, just as eggs do for agents.

Both egg and seedling spawning from water are rare, constant background events — not triggered by population thresholds.

---

## 9. UI Changes

### 9.1 Agent Inspector Additions

The inspector panel (shown when clicking an agent) adds:

- **Full name:** `FirstName FamilyName`
- **Family lineage:** `Generation N of the FamilyName family`
- **Expressed traits:** Table of trait name → value (the game-usable numbers)
- **Pregnancy status:** If pregnant, show progress bar and remaining time
- **DNA string:** Not displayed in the UI. Available via console/debug tools only for debugging purposes.

### 9.2 Pregnancy Visual

- Egg emoji (🥚) rendered above the pregnant agent's head.
- Slight size increase to the agent sprite during pregnancy (optional).

### 9.3 Family Registry Panel

New UI panel (accessible from sidebar) showing:
- All known family names, sorted by living members
- Total born / currently alive / average lifespan
- Expandable to show family tree

---

## 10. Initial Population DNA Generation

When the world is first created, agents need valid starting DNA:

1. Generate DNA of length 200 (40 genes).
2. For each **essential trait**, guarantee at least 1 positive gene at a random position.
3. Fill remaining positions with a mix of:
   - Random functional genes (from the catalog) — 50%
   - Non-coding genes — 30%
   - Antagonistic (lowercase) genes — 20%
4. Randomize all magnitudes (000–999).
5. Express traits and verify viability (re-roll if not viable).

This ensures the first generation is diverse but viable.

---

## 11. Persistence (Save/Load)

### 11.1 Saved Agent Data

Add to the serialized agent:
- `dna: string` — The full DNA string
- `familyName: string` — Family surname
- `pregnantMsRemaining: number` — Pregnancy timer (0 if not pregnant)
- `pregnantChildDna: string | null` — The unborn child's DNA (computed at conception)

### 11.2 Migration

No backwards compatibility required (per user instruction). Old saves will not load in v4.0. A version check on load can show a message: "This save is from a previous version and is not compatible."

---

## 12. Balancing & Tuning Levers

### 12.1 Constants That Remain Global

Not everything should be genetic. These remain in `constants.ts` as global tuning:

- Tick rate (250ms)
- Grid size (62x62)
- Action energy costs (per action type)
- Action base durations (per action type)
- Heal aura radius and amount
- Relationship gain/loss rates
- Faction formation threshold
- Farm mechanics (wood cost, spawn rates)
- World block properties (water decay, tree age, etc.)

### 12.2 Constants That Move to Genetics

Everything listed in Section 4 (Trait Definitions) moves from global constants to per-agent gene expression.

### 12.3 Emergent Balance Mechanisms

The genetics system creates self-balancing feedback loops:

| Imbalance | Natural Correction |
|-----------|--------------------|
| Too many aggressive agents | They kill each other off, cooperative survivors reproduce |
| Too many passive agents | Can't defend resources, aggressive mutants thrive |
| High metabolism dominant | Resources deplete faster, slow-metabolism agents survive famine |
| Long-lived agents dominant | Population pressure increases, disease and starvation favor shorter-lived agents |
| Parthenogenesis dominant | Low genetic diversity → vulnerable to environmental shift |
| High fertility dominant | Population boom → resource crash → die-off |

---

## 13. Design Discussion Points

### 13.1 DNA String Length: 255 Hard Max

The 255 cap means a max of 50 genes. With 20 traits needing at least a couple genes each, plus non-coding DNA, this is tight but functional. It means agents can't max out everything — they must "specialize." This is a **feature**, not a limitation. It forces tradeoffs.

**Alternative considered:** Unlimited length. Rejected because it removes the constraint that drives specialization and could lead to unbounded memory growth over many generations.

### 13.2 Normalization Approach

The linear scaling with clamp is simple and predictable. An alternative would be sigmoid mapping (soft ceiling), which would make extreme values progressively harder to achieve. Linear is recommended for v4.0 for simplicity; sigmoid can be explored if balance issues emerge.

### 13.3 Non-Essential Trait Convergence Risk

Non-essential traits (those that don't cause stillbirth if missing) could theoretically converge toward their default values over time. However, this is unlikely due to several counterforces:

1. **Mutation is directionless.** A mutation is equally likely to create, destroy, strengthen, or weaken a gene. There is no directional pressure toward "fewer genes" — only random drift.
2. **Gene duplication/deletion** (1% each per birth) randomly amplifies or removes genes, preventing stasis.
3. **Non-essential doesn't mean unimportant.** An agent with default Recall (2 memory slots) is outcompeted by one with high Recall (8 slots) during food scarcity. An agent with zero Courage flees from everything and never gains combat XP. Selection pressure exists for all traits — "non-essential" only means "won't cause stillbirth if absent."
4. **Crossover preserves variance.** Unlike simple averaging, positional crossover can produce children with more extreme values than either parent (e.g., parent A has `GG500` at position 3, parent B has `GG700` at position 7 — child inherits both → raw +1200).

The real convergence risk comes from **crossover on shared positions**. If both parents have the same gene at the same position, it passes through unchanged. Over many generations in a small population, this could reduce diversity at specific positions. Counterforces: mutation, gene duplication, and egg-born agents (who get fully randomized DNA, injecting fresh genetic material).

**Tuning lever:** If playtesting shows homogenization, increase mutation rate or increase egg spawn rate (more random DNA injection).

### 13.4 Mutation Rate

0.5% per character = ~1.25 mutations per reproduction (at 250 chars). This is high enough to see evolution over 10-20 generations but low enough that children resemble parents. This is a critical tuning value — too high and lineages are meaningless, too low and adaptation is glacial.

### 13.5 Essential Gene Lethality

Stillborn mechanics add emotional weight and natural selection pressure, but could frustrate players if too common. The viability check should be tuned so stillbirths are rare (<5% of births) but not unheard of.

### 13.6 Metabolism as a Super-Trait

Metabolism affects both fullness decay AND speed/action time, making it extremely powerful. This is intentional (it should be a desirable gene), but the scaling needs careful tuning to prevent "high metabolism" from being strictly dominant. The tradeoff is that high-metabolism agents use DNA slots on Metabolism genes that could go to other traits.

### 13.7 Entity Classes

Baby and Adult classes ship in v4.0. Elder, Animal, and Plant classes are planned for v4.1–4.2. Job classes (Warrior, Engineer, Healer) are v4.2+. The architecture must support all of these from the start:
- Per-class action sets (which actions are available)
- Per-class emoji maps (visual identity)
- Per-class gene catalog subsets (animals don't need Charisma)
- Per-class decision weight overrides

Plants are not first-class agents but are a close second — they should be modeled with enough flexibility to support genetic variation (growth rates, water needs, seed dispersal) in future versions.

---

## 14. Implementation Phases

### Phase 1: Genetic Foundation
- `Genome` class: DNA parsing, gene expression, trait calculation
- `GeneRegistry`: Maps gene codes to trait definitions
- Gene expression unit tests (not in codebase yet, but critical for this)
- Agent class refactor: Replace hardcoded stats with gene-expressed values
- Agent factory refactor: DNA generation for initial population, crossover for children

### Phase 2: Reproduction Overhaul
- Family name system
- Pregnancy state and mechanics
- Crossover and mutation
- Viability checks (essential genes)
- Asexual reproduction (Parthenogenesis)
- Remove old inheritance logic entirely

### Phase 3: Needs & Decision Refactor
- Need bands system (critical/low/normal/high/full)
- Decision engine extraction into `domains/decision/`
- Action tag system
- Scored action selection (replacing if-chain)
- Flee behavior (Courage gene)
- Rename drink → wash

### Phase 4: World & Balance
- Water egg spawning (replace tree eggs)
- Seedling/tree water proximity requirements
- Tune all gene ranges through playtesting
- Family registry and dynasty tracking

### Phase 5: UI & Polish
- Agent inspector: DNA viewer, expressed traits, family info
- Pregnancy visual (egg above head)
- Family registry panel
- Updated event log messages

---

## Appendix A: Gene Code Quick Reference

```
AA/aa  Strength          (essential)
BB/bb  Longevity         (essential)
CC/cc  Vigor             (essential)
DD/dd  Metabolism        (essential)
EE/ee  Resilience        (essential)
FF/ff  Immunity
GG/gg  Agility
HH/hh  Aptitude
II/ii  Cooperation
JJ/jj  Aggression
KK/kk  Courage
LL/ll  Fertility
MM/mm  Recall
NN/nn  Charisma
OO/oo  Gregariousness
PP/pp  Appetite
QQ/qq  Maturity
RR/rr  Endurance
SS/ss  Fidelity
TT/tt  Parthenogenesis
```

## Appendix B: Example DNA String

```
AA350BB200CC150DD400EE250FF100GG300HH200II450JJ150KK250LL200MM100NN300OO050PP200QQ150RR250SS200Cd000Ab999Xy100ee050jj300aa100
```

Parsed:
- `AA350` → Strength +350
- `BB200` → Longevity +200
- `CC150` → Vigor +150
- `DD400` → Metabolism +400
- `EE250` → Resilience +250
- `FF100` → Immunity +100
- `GG300` → Agility +300
- `HH200` → Aptitude +200
- `II450` → Cooperation +450
- `JJ150` → Aggression +150
- `KK250` → Courage +250
- `LL200` → Fertility +200
- `MM100` → Recall +100
- `NN300` → Charisma +300
- `OO050` → Gregariousness +50
- `PP200` → Appetite +200
- `QQ150` → Maturity +150
- `RR250` → Endurance +250
- `SS200` → Fidelity +200
- `Cd000` → Non-coding (junk DNA)
- `Ab999` → Non-coding (junk DNA)
- `Xy100` → Non-coding (junk DNA)
- `ee050` → Resilience -50
- `jj300` → Aggression -300
- `aa100` → Strength -100

**Expressed:**
- Strength raw = 350 - 100 = 250 → base attack = clamp(8 + 250/100, 3, 18) = 10.5
- Resilience raw = 250 - 50 = 200 → base max HP = clamp(100 + 200/1, 60, 180) = 180 (capped)
- Aggression raw = 150 - 300 = -150 → probability = clamp(0.5 + (-150)/500, 0, 1) = 0.2 (pacifist)
- Net: A tough, pacifist agent with good metabolism. Would likely survive through resource efficiency rather than combat.
