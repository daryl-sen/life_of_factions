import type { ActionType } from '../action/types';

export enum PhenotypeClass {
  Plant           = 'plant',
  SessilePredator = 'sessile_predator',
  Fungus          = 'fungus',
  Fish            = 'fish',
  Amphibian       = 'amphibian',
  PhotoCritter    = 'photo_critter',
  Person          = 'person',
  ColonyInsect    = 'colony_insect',
  Predator        = 'predator',
  Critter         = 'critter',
  Blob            = 'blob',
}

export enum LifecycleStage {
  Juvenile = 'juvenile',
  Adult    = 'adult',
  Elder    = 'elder',
}

export type AnimationType =
  | 'shake' | 'bob' | 'pulse' | 'bounce'
  | 'shrink' | 'wiggle' | 'flash' | 'sway' | 'none';

export interface PhenotypeTraitFlags {
  readonly hasHygiene:     boolean;
  readonly immobile:       boolean;
  readonly simplifiedTick: boolean;
  readonly hasMood:        boolean;
}

export interface Moveset {
  readonly idle:           readonly string[];
  readonly juvenile:       string;
  readonly elder:          string | null;
  readonly actionVariants: Partial<Record<ActionType, string>>;
}

export interface PhenotypeRule {
  readonly phenotype: PhenotypeClass;
  readonly predicate: (traits: import('../genetics/types').TraitSet) => boolean;
}
