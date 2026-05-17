# Agent Traits (v4.2)

Traits are per-agent numeric values derived from the agent's **DNA** at birth. Each agent carries an immutable `Genome` (a string of 5-character gene codes). At creation, `expressGenome(dna)` converts the DNA into a `TraitSet` — the agent's definitive stats for its entire lifetime.

## Trait Expression

Each gene code maps to a gene definition in the gene registry. Multiple genes of the same code stack additively. Expression uses the **continuous** formula:

```
value = Math.max(comp.min, comp.default + (direction * rawSum) / comp.scale)
```

Unlike v4.0, there is **no hard upper ceiling** — traits with high gene counts can exceed the default range. This enables genetic specialization (e.g. an agent with 5× aggression genes becomes truly dangerous).

## Trait Categories

### Core Combat Traits

| Gene | Trait | Key | Range | Effect |
|------|-------|-----|-------|--------|
| `AA` | Strength | `attack` | ≥ 0.5 | Attack damage per tick |
| `BB` | Longevity | `maxAgeTicks` | ≥ 500 | Lifespan in ticks |
| `BB` | Longevity | `maxHealth` | ≥ 10 | Maximum HP |
| `CC` | Vigor | `maxEnergy` | ≥ 20 | Maximum energy |

### Metabolism & Movement

| Gene | Trait | Key | Range | Effect |
|------|-------|-----|-------|--------|
| `DD` | Metabolism | `actionDurationMult` | ≥ 0.3 | Action speed multiplier |
| `DD` | Metabolism | `fullnessDecayRate` | ≥ 0.01 | Fullness loss per tick |
| `FF` | Agility | `moveCost` | ≥ 0.05 | Energy per move (lower = cheaper) |
| `FF` | Agility | `speed` | ≥ 0.5 | Movement speed multiplier |

### Social Traits

| Gene | Trait | Key | Range | Effect |
|------|-------|-----|-------|--------|
| `GG` | Charisma | `relationshipSlots` | ≥ 2 | Max tracked relationships |
| `HH` | Empathy | `healAmount` | ≥ 1 | HP restored per heal tick |
| `AD` | Sociality | `socialDecay` | ≥ 0.002 | Social need drain per tick |

> **Note**: The older `OO` (Gregariousness) gene maps to the same `socialDecay` behavior as `AD`. Both are recognized by the gene registry; `AD` is the canonical v4.2 name.

### Reproductive Traits

| Gene | Trait | Key | Range | Effect |
|------|-------|-----|-------|--------|
| `JJ` | Fertility | `energyThreshold` | ≥ 20 | Min energy to reproduce |
| `JJ` | Fertility | `urgencyAge` | ≥ 100 | Tick age at which urgency kicks in |
| `TT` | Parthenogenesis | `canSelfReproduce` | boolean | Enables asexual reproduction |
| `AG` | Pregnancy | `gestationMs` | ≥ 0 | Transfer-mechanic gestation duration (ms); 0 = instant birth |

### Genetic Variability

| Gene | Trait | Key | Range | Effect |
|------|-------|-----|-------|--------|
| `AP` | Volatility | `mutationRate` | ≥ 0.001 | Per-character mutation probability for offspring |

Agents with high `AP` produce more varied children — useful for exploring trait space but risky in stable environments. The `mutationRate` for a sexual offspring is the average of both parents' rates; for asexual offspring it is the agent's own rate.

### Territory Traits

| Gene | Trait | Key | Range | Effect |
|------|-------|-----|-------|--------|
| `AQ` | Nomadism | `wanderBias` | 0.0–1.0 | 0 = stays inside faction territory; 1 = wanders freely outside |
| `AR` | Tribalism | `territorialSensitivity` | 0.0–1.0 | How strongly territorial context amplifies social/combat decisions |

Agents with high **Tribalism** (`AR`) respond strongly to territory: inside their own territory they become friendlier to allies and more aggressive toward intruders. Outside their territory, the same effects apply but are dampened.

Agents with low **Nomadism** (`AQ`) home-body agents that are outside their territory get a pull back toward the flag (deposit actions are boosted), keeping them clustered near their base. High Nomadism agents explore freely.

### Survivability

| Gene | Trait | Key | Range | Effect |
|------|-------|-----|-------|--------|
| `EE` | Resilience | `diseaseResistance` | ≥ 0.0 | Chance to resist disease spread |
| `EE` | Resilience | `healRate` | ≥ 0.1 | Passive HP recovery per tick |
| `KK` | Recall | `memorySlots` | ≥ 1 | Resource memory capacity |

## Action Energy Costs (v4.2)

Action energy costs are **per-agent** and computed at action creation via `computeActionCost()`. The formula combines:

- **Base cost** (`TUNE.actionBaseCost[type]`)
- **Trait scaling** (e.g. attack cost scales with `strength`, move cost scales with `agility`)
- **Level multiplier** (each level adds `TUNE.cost.levelEnergyMultPerLevel` to the cost factor)

This means a high-level, high-strength agent pays significantly more energy per attack than a rookie.

## DNA Length Bounds

Viable DNA must be 100–250 characters. Shorter DNA lacks enough gene copies; longer DNA is unstable. These bounds are checked at birth via `isViable(traitSet, genome, dna)`.

## Trait Inheritance (v4)

v4+ uses **DNA crossover and mutation** rather than trait averaging:

1. Child DNA starts as a copy of the initiator's DNA
2. Each 5-char gene position has 50% chance of swapping with the partner's gene
3. Mutation is applied with probability from the parent's `volatility.mutationRate`

See `docs/10-reproduction.md` for full details.
