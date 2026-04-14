/**
 * Central tuning constants for v4.2.
 * All non-universal numeric tuning lives here, enabling rapid iteration
 * without hunting through domain files.
 *
 * Import as: import { TUNE } from '../../core/tuning';
 */
export const TUNE = {
  // Base action energy costs (v4 values, preserved)
  actionBaseCost: {
    attack:     1.1,
    reproduce:  1.5,
    heal:       1.5,
    harvest:    0.25,
    talk:       0.2,
    quarrel:    0.4,
    share:      0.4,
    move:       0.12,   // Per-step movement energy
  },

  // v4.2 cost scaling coefficients (applied on top of base costs)
  cost: {
    attackEnergyPerStrength:  0.015,   // Extra energy per attack = strength × this
    moveEnergyPerAgility:     0.008,   // Extra energy per move = agility × this
    recallSlotPassiveDrain:   0.0008,  // Passive drain per memory slot per tick
    immunityPassiveDrain:     0.002,   // Passive drain per immunity unit per tick
    levelEnergyMultPerLevel:  0.04,    // +4% energy cost per level gained
  },

  // Pregnancy — v4.2 need-transfer mechanic and v4 fallback
  pregnancy: {
    needTransferRate:         0.4,              // Per-tick fraction of need transferred to child
    completionThreshold:      80,               // Child needs reach this → birth
    v4DurationMult:           0.5,              // v4 fallback: pregnancy = babyDurationMs × this
    v4FullnessDonateRange:    [15, 25] as const, // v4 fallback: fullness donated per parent
  },

  // Mutation (v4 values; now configurable per-agent via Volatility gene)
  mutation: {
    baseRate:       0.005,   // At default Volatility (matches v4 hardcoded MUTATION_RATE)
    geneDupChance:  0.01,    // Per reproduction (matches v4 GENE_DUP_CHANCE)
    geneDelChance:  0.01,    // Per reproduction (matches v4 GENE_DEL_CHANCE)
    minDnaLength:   100,
    maxDnaLength:   250,
  },

  // Passive stat decay rates per tick (v4 values from agent-updater.ts)
  decay: {
    baseFullnessPerTick:    0.03,    // v4: FULLNESS_PASSIVE_DECAY
    baseEnergyPerTick:      0.0625,  // v4: PASSIVE_ENERGY_DRAIN
    baseInspirationPerTick: 0.015,   // v4: INSPIRATION_PASSIVE_DECAY
    baseSocialPerTick:      0.01,    // v4: SOCIAL_PASSIVE_DECAY
    baseHygienePerTick:     0.0,     // Hygiene decays on movement, not passively
    moveFullnessDecay:      0.10,    // v4: FULLNESS_MOVE_DECAY
    moveHygieneDecay:       0.05,    // v4: HYGIENE_MOVE_DECAY
  },

  // Reproduction costs (v4 values)
  reproduce: {
    energyCost: 12,   // v4: REPRODUCE_ENERGY_COST per parent
  },

  // World generation (v4.2 geographic isolation)
  world: {
    obstacleDensity:      0.08,
    isolationPocketCount: 4,
  },
} as const;

export type TuneConfig = typeof TUNE;
