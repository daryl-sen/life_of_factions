export const TUNE = {
  // Functional minimums (PRD Section 3.5.1)
  functionalMin: {
    photosynthesis: 20,
    agility: 5,
    sociality: 15,
    carnivory: 10,
    aquatic: 10,
    saltwaterTolerance: 5,
    aptitude: 5,
    strength: 3,
    emotion: 10,
    pregnancy: 5,
    harvestable: 10,
  },

  // Cost scaling coefficients
  cost: {
    attackEnergyPerStrength: 0.015,
    moveEnergyPerAgility: 0.008,
    perceptionPassiveDrain: 0.003,
    immunityPassiveDrain: 0.002,
    recallSlotPassiveDrain: 0.0008,
    photosynthesisHpPenaltyPerUnit: 0.5,
    levelEnergyMultPerLevel: 0.04,
  },

  // Base action costs
  actionBaseCost: {
    attack: 0.4,
    move: 0.1,
  },

  // Phenotype classification thresholds (mid/high)
  phenotype: {
    socialityHigh: 30,
    aquaticHigh: 50,
    aquaticMid: 25,
    carnivoryMid: 35,
    strengthMid: 15,
  },

  // Pregnancy
  pregnancy: {
    needTransferRate: 0.4,
    completionThreshold: 80,
  },

  // Mutation
  mutation: {
    baseRate: 0.005,
    geneDupChance: 0.01,
    geneDelChance: 0.01,
    minDnaLength: 100,
    maxDnaLength: 350,
  },

  // Passive decay rates (defaults — per-organism values come from genes)
  decay: {
    baseFullnessPerTick: 0.03,
    baseHygienePerTick: 0.02,
    baseSocialPerTick: 0.01,
    baseEnergyPerTick: 0.01,
  },

  // Photosynthesis
  photosynthesis: {
    baseRatePerUnit: 0.02,
    waterProximityBoost: 1.5,
    waterProximityRadius: 5,
    droughtPenalty: 0.4,
  },

  // Corpse decay
  corpse: {
    decayMs: 60000,
    plantYieldPerSize: 2.0,
    meatYieldPerSize: 3.0,
  },

  // World generation
  world: {
    obstacleDensity: 0.08,
    isolationPocketCount: 4,
  },
} as const;

export type TuneConfig = typeof TUNE;
