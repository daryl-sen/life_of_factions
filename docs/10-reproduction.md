# Reproduction (v4.2)

Reproduction creates offspring through genetic crossover and mutation. The v4 genetics system uses DNA-based recombination; v4.2 adds three gestation paths and volatility-driven mutation rates.

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
Agents with the `TT` gene expressed (`traits.parthenogenesis.canSelfReproduce = true`) can reproduce without a partner. No crossover occurs; genetic diversity comes solely from mutation using the agent's own `mutationRate`.

## Process

### Step 1: Decision
The `DecisionEngine` scores the `reproduce` action using:
- **Fertility trait**: Lower energy threshold = higher eagerness
- **Age urgency**: Score boost when age exceeds `traits.fertility.urgencyAge`
- **Adjacent partner availability**: Large score boost if a valid partner is next to the agent

### Step 2: Action Execution
The reproduce action has duration range `[5200, 8320]` ms, scaled by `traits.metabolism.actionDurationMult`.

### Step 3: Completion (`reproduce-effects.ts`)

1. **Energy costs**: `TUNE.reproduce.energyCost` (both parents)
2. **DNA crossover**: Child DNA starts as initiator's DNA; each gene position has 50% chance of swapping with recipient's gene
3. **Mutation**: Applied with probability from `volatility.mutationRate` (sexual = average of both parents; asexual = agent's own rate)
4. **Viability check**: Child must have at least one coding gene per essential trait and no essential trait at absolute minimum. Failure = stillborn.
5. **Pregnancy begins** on the initiator — path depends on the `AG` gene (see below)

## Gestation Paths (v4.2)

v4.2 introduces three gestation paths, selected at pregnancy start:

### Path A: Transfer Mechanic (AG gene present, gestationMs > 0)
The parent gradually transfers needs to the child. Each tick, `TUNE.pregnancy.needTransferRate` is added to each child need (fullness, hygiene, social, inspiration) and drained from the parent. Birth triggers when **all** child needs reach `TUNE.pregnancy.completionThreshold` (80).

- Incentivises the parent to stay fed, clean, social, and inspired during gestation
- Visual: egg emoji (🥚) floats above the agent

### Path B: Instant Birth (AG gene present, gestationMs = 0)
Birth is immediate — no gestation period. The newborn starts with **all needs at 0** (hungry, dirty, lonely, uninspired) and must meet its own needs from birth.

### Path C: v4 Countdown (no AG gene)
Legacy path. A timer (`childGenome.traits.maturity.babyDurationMs * TUNE.pregnancy.v4DurationMult`) counts down. At zero, the parent donates `TUNE.pregnancy.v4FullnessDonateRange` fullness to the child and birth occurs.

## Pregnancy State

| Property | Transfer (A) | Instant (B) | v4 Countdown (C) |
|----------|-------------|-------------|------------------|
| `useTransferMechanic` | `true` | — (instant) | `false` |
| `childNeeds` | accumulates | — | — |
| `transferRate` | from `TUNE` | — | — |
| `remainingMs` | — | — | timer |
| `donatedFullness` | — | — | random range |

## Birth

When the gestation condition is met:
1. An adjacent free cell is found for the child
2. `AgentFactory.createChild()` creates a baby agent with the child's DNA
3. Child inherits family name from initiator
4. Child inherits faction (initiator's, or 50/50 if both parents had factions)
5. Family registry records the birth
6. Events: `agent:born`, `pregnancy:birth`

If no free cell is available, birth is delayed by one tick (transfer path) or the action is retried (instant path).

## Family Names

- **First-generation agents**: Family name = their first name (they found a lineage)
- **Born agents**: Inherit family name from the initiator (carrier parent)

## Family Registry

`World.familyRegistry` tracks per-family statistics:
- `totalBorn`: All members ever born
- `currentlyAlive`: Currently living members
- `totalAgeMs` / `deathCount`: For average longevity calculation
- `maxGeneration`: Deepest generational depth from founder

## Genetic Inheritance

### Crossover (`crossover.ts`)
1. Start with a full copy of the initiator's DNA
2. For each 5-char gene position present in both parents: 50% chance to swap
3. Genes beyond the shorter parent's length are inherited unchanged from the initiator

### Mutation (`mutation.ts`)
Applied after crossover to the child's DNA:
- **Per-character**: `mutationRate` chance of random substitution
- **Gene duplication**: `TUNE.mutation.geneDupChance` (1%) chance a random gene is appended
- **Gene deletion**: `TUNE.mutation.geneDelChance` (1%) chance a random 5-char segment is removed
- DNA length clamped to `[TUNE.mutation.minDnaLength, TUNE.mutation.maxDnaLength]` (100–250)

### Viability (`viability.ts`)
Essential traits: Strength (AA), Longevity (BB), Vigor (CC), Metabolism (DD), Resilience (EE).
- Must have at least one coding gene per essential trait
- No essential trait may be at its absolute minimum value
- DNA length must be within [100, 250]
- Failure = stillborn (logged, `agent:stillborn` event emitted)

## Persistence

Pregnancy state (all paths) is serialized in the v4.2 save format:
- Shared: `childDna`, `childFamilyName`, `childFactionId`, `partnerId`
- Path A: `useTransferMechanic: true`, `childNeeds`, `transferRate`, `gestationStartTick`
- Path C: `useTransferMechanic: false`, `remainingMs`, `donatedFullness`

## Faction Inheritance

| Initiator | Recipient | Child's Faction |
|-----------|-----------|-----------------|
| None | None | None |
| A | None | A |
| None | B | B |
| A | A | A |
| A | B | A or B (50/50) |
