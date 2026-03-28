# Reproduction

Reproduction creates offspring through genetic crossover and mutation. The genetics system (v4.0+) replaces the old trait-averaging inheritance with DNA-based recombination.

## Requirements

| Requirement | Value |
|-------------|-------|
| Adjacency | Distance = 1 (or none for parthenogenesis) |
| Relationship | >= 0.4 (sexual) |
| Energy | >= `traits.fertility.energyThreshold` (per-agent, genetic) |
| Entity class | Adult only (babies and elders cannot reproduce) |
| Not pregnant | Agent must not already be pregnant |
| Free adjacent cell | For child placement (checked at birth, not at mating) |

## Reproduction Modes

### Sexual Reproduction
Requires an adjacent partner meeting relationship and energy thresholds. The **initiator** becomes the carrier (pregnant) and lineage holder. The recipient contributes DNA but is otherwise unaffected.

### Asexual Reproduction (Parthenogenesis)
Agents with the `TT` gene expressed (`traits.parthenogenesis.canSelfReproduce = true`) can reproduce without a partner. No crossover occurs; genetic diversity comes solely from mutation.

## Process

### Step 1: Decision
The `DecisionEngine` scores the `reproduce` action using:
- **Fertility trait**: Lower energy threshold = higher eagerness
- **Age urgency**: Score boost when age exceeds `traits.fertility.urgencyAge`
- **Adjacent partner availability**: Large score boost if a valid partner is next to the agent

### Step 2: Action Execution
The reproduce action has duration range `[5200, 8320]` ms, scaled by `traits.metabolism.actionDurationMult`.

### Step 3: Completion (reproduce-effects.ts)
1. **Energy/fullness costs**: Both parents lose 12 energy and 15-25 fullness
2. **DNA crossover**: Child DNA starts as initiator's DNA; each gene position has 50% chance of swapping with recipient's gene at the same position
3. **Mutation**: Per-character 0.5% substitution rate; 1% chance gene duplication; 1% chance gene deletion
4. **Viability check**: Child must have at least one coding gene per essential trait (Strength, Longevity, Vigor, Metabolism, Resilience) and no essential trait at absolute minimum. Failure = stillborn.
5. **Pregnancy begins** on the initiator

## Pregnancy

After successful reproduction, the initiator enters a pregnancy state:

| Property | Value |
|----------|-------|
| Visual | Egg emoji (🥚) floating above the agent |
| Duration | `childGenome.traits.maturity.babyDurationMs * 0.5` |
| Attack | Reduced by 40% (`agent.effectiveAttack`) |
| Fullness decay | Increased by 50% (`agent.fullnessDecayMult`) |
| Speed | Reduced by 30% (`agent.speedMult`) |
| Can reproduce again | No (blocked until birth) |
| On death while pregnant | Child is lost |

### Birth
When pregnancy timer reaches 0:
- An adjacent free cell is found for the child
- `AgentFactory.createChild()` creates a baby agent with the child's DNA
- Child inherits family name from initiator
- Child inherits faction (initiator's, or 50/50 if both parents had factions)
- Family registry records the birth
- Events emitted: `agent:born`, `pregnancy:birth`

If no free cell is available, birth is delayed by one tick.

## Family Names

- **First-generation agents** (spawned at init or from eggs): Family name = their first name (they found a lineage)
- **Born agents**: Inherit family name from the initiator (carrier parent)
- **Display**: Inspector shows `FirstName FamilyName`

## Family Registry

`World.familyRegistry` tracks per-family statistics:
- `totalBorn`: All members ever born
- `currentlyAlive`: Currently living members
- `totalAgeMs` / `deathCount`: For average longevity calculation
- `maxGeneration`: Deepest generational depth from founder

Registry is updated on:
- Agent creation (initial spawn, egg hatch, birth)
- Agent death

## Genetic Inheritance

### Crossover (crossover.ts)
1. Start with a full copy of the initiator's DNA
2. For each 5-char gene position present in both parents: 50% chance to swap
3. Genes beyond the shorter parent's length are inherited unchanged from the initiator

### Mutation (mutation.ts)
Applied after crossover to the child's DNA:
- **Per-character**: 0.5% chance of random substitution (letter → random letter, digit → random digit)
- **Gene duplication**: 1% chance per reproduction (random gene copied and appended)
- **Gene deletion**: 1% chance per reproduction (random 5-char segment removed)
- DNA length clamped to [100, 250]

### Viability (viability.ts)
Essential traits: Strength (AA), Longevity (BB), Vigor (CC), Metabolism (DD), Resilience (EE).
- Must have at least one coding gene per essential trait
- No essential trait may be at its absolute minimum value
- Failure = stillborn (logged, `agent:stillborn` event emitted)

## Persistence

Pregnancy state is serialized and restored on save/load, including:
- `remainingMs`, `childDna`, `childFamilyName`, `childFactionId`

## Faction Inheritance

| Initiator | Recipient | Child's Faction |
|-----------|-----------|-----------------|
| None | None | None |
| A | None | A |
| None | B | B |
| A | A | A |
| A | B | A or B (50/50) |
