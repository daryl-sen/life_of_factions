/** A single parsed gene from a DNA string */
export interface RawGeneEntry {
  readonly code: string;
  readonly magnitude: number;
  readonly position: number;
  readonly coding: boolean;
}

/** Complete set of expressed traits derived from a genome (v5) */
export interface TraitSet {
  // Essential
  readonly longevity:          { readonly maxAgeMs: number };
  readonly metabolism:         { readonly fullnessDecay: number; readonly actionDurationMult: number };

  // Body & Physiology
  readonly strength:           { readonly value: number };
  readonly vigor:              { readonly baseMaxEnergy: number; readonly perLevel: number };
  readonly resilience:         { readonly baseMaxHp: number; readonly perLevel: number };
  readonly immunity:           { readonly contractionChance: number };
  readonly agility:            { readonly speedMult: number };
  readonly size:               { readonly value: number };
  readonly regeneration:       { readonly hpPerTick: number };
  readonly endurance:          { readonly inventoryCapacity: number };

  // Mobility, Senses & Diet
  readonly aquatic:            { readonly value: number };
  readonly saltwaterTolerance: { readonly extractionRate: number };
  readonly photosynthesis:     { readonly value: number };
  readonly carnivory:          { readonly value: number };
  readonly perception:         { readonly radius: number };

  // Mind & Behavior
  readonly emotion:            { readonly value: number };
  readonly aptitude:           { readonly xpPerLevel: number };
  readonly courage:            { readonly fleeHpRatio: number };
  readonly aggression:         { readonly baseProbability: number };
  readonly recall:             { readonly memorySlots: number };

  // Social
  readonly sociality:          { readonly value: number };
  readonly charisma:           { readonly relationshipSlots: number };
  readonly cooperation:        { readonly baseProbability: number };
  readonly fidelity:           { readonly leaveProbability: number };

  // Reproduction & Lifecycle
  readonly fertility:          { readonly energyThreshold: number; readonly urgencyAge: number };
  readonly pregnancy:          { readonly gestationMs: number };
  readonly parthenogenesis:    { readonly canSelfReproduce: boolean };
  readonly maternity:          { readonly feedProbability: number };
  readonly maturity:           { readonly juvenileMs: number };
  readonly harvestable:        { readonly value: number };
  readonly volatility:         { readonly mutationRate: number };

  // Resource Behavior
  readonly appetite:           { readonly seekThreshold: number; readonly criticalThreshold: number };
  readonly greed:              { readonly hoardProbability: number };
}

/**
 * Definition of a single trait component's scaling.
 * NOTE: No `max` field in v5 — traits are unbounded above; cost functions limit them naturally.
 */
export interface TraitComponentDef {
  readonly key: string;
  readonly default: number;
  readonly scale: number;
  readonly floor: number;
  readonly inverted: boolean;
}

/** Definition of a trait (maps gene code to one or more components) */
export interface TraitDef {
  readonly code: string;
  readonly name: string;
  readonly essential: boolean;
  readonly components: readonly TraitComponentDef[];
}
