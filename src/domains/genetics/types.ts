/** A single parsed gene from a DNA string */
export interface RawGeneEntry {
  /** 2-char identifier (e.g., "AA", "aa") */
  readonly code: string;
  /** 0-999 magnitude */
  readonly magnitude: number;
  /** Index in DNA string (0, 5, 10, ...) */
  readonly position: number;
  /** Whether this gene maps to a known trait */
  readonly coding: boolean;
}

/** Complete set of expressed traits derived from a genome */
export interface TraitSet {
  // Essential traits
  readonly strength: { readonly baseAttack: number; readonly perLevel: number };
  readonly longevity: { readonly maxAgeMs: number };
  readonly vigor: { readonly baseMaxEnergy: number; readonly perLevel: number };
  readonly metabolism: { readonly fullnessDecay: number; readonly actionDurationMult: number };
  readonly resilience: { readonly baseMaxHp: number; readonly perLevel: number };

  // Non-essential traits
  readonly immunity: { readonly contractionChance: number };
  readonly agility: { readonly speedMult: number };
  readonly aptitude: { readonly xpPerLevel: number };
  readonly cooperation: { readonly baseProbability: number };
  readonly aggression: { readonly baseProbability: number };
  readonly courage: { readonly fleeHpRatio: number };
  readonly fertility: { readonly energyThreshold: number; readonly urgencyAge: number };
  readonly parthenogenesis: { readonly canSelfReproduce: boolean };
  readonly recall: { readonly memorySlots: number };
  readonly charisma: { readonly relationshipSlots: number };
  readonly gregariousness: { readonly socialDecay: number };
  readonly appetite: { readonly seekThreshold: number; readonly criticalThreshold: number };
  readonly maturity: { readonly babyDurationMs: number };
  readonly endurance: { readonly inventoryCapacity: number };
  readonly fidelity: { readonly leaveProbability: number };
  readonly greed: { readonly hoardProbability: number };
}

/** Definition of a single trait component's scaling */
export interface TraitComponentDef {
  readonly key: string;
  readonly min: number;
  readonly default: number;
  readonly max: number;
  readonly scale: number;
  /** true = positive genes reduce the value (e.g., metabolism decay, immunity contraction) */
  readonly inverted: boolean;
}

/** Definition of a trait (maps gene code to one or more components) */
export interface TraitDef {
  readonly code: string;
  readonly name: string;
  readonly essential: boolean;
  readonly components: readonly TraitComponentDef[];
}
