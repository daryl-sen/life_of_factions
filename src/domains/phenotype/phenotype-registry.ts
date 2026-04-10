import type { TraitSet } from '../genetics/types';
import { TUNE } from '../../core/tuning';
import { PhenotypeClass, PhenotypeTraitFlags } from './types';
import type { PhenotypeRule } from './types';

/**
 * Priority-ordered rule table: first match wins.
 * Mobility is the dominant axis — immobile phenotypes (plant/fungus) are locked
 * behind Agility < functional minimum so no mobile organism ever shows a plant emoji.
 */
export const PHENOTYPE_RULES: ReadonlyArray<PhenotypeRule> = [
  // ── Immobile branch ───────────────────────────────────────────────
  {
    phenotype: PhenotypeClass.Plant,
    predicate: (t: TraitSet) =>
      t.agility.speedMult < TUNE.functionalMin.agility &&
      t.photosynthesis.value >= TUNE.functionalMin.photosynthesis,
  },
  {
    phenotype: PhenotypeClass.SessilePredator,
    predicate: (t: TraitSet) =>
      t.agility.speedMult < TUNE.functionalMin.agility &&
      t.photosynthesis.value < TUNE.functionalMin.photosynthesis &&
      t.strength.value >= TUNE.functionalMin.strength &&
      t.carnivory.value >= TUNE.functionalMin.carnivory,
  },
  {
    phenotype: PhenotypeClass.Fungus,
    predicate: (t: TraitSet) => t.agility.speedMult < TUNE.functionalMin.agility,
  },

  // ── Mobile branch — water-first ───────────────────────────────────
  {
    phenotype: PhenotypeClass.Fish,
    predicate: (t: TraitSet) =>
      t.agility.speedMult >= TUNE.functionalMin.agility &&
      t.aquatic.value >= TUNE.phenotype.aquaticHigh &&
      t.agility.speedMult <= 10,
  },
  {
    phenotype: PhenotypeClass.Amphibian,
    predicate: (t: TraitSet) =>
      t.agility.speedMult >= TUNE.functionalMin.agility &&
      t.aquatic.value >= TUNE.phenotype.aquaticMid,
  },
  {
    phenotype: PhenotypeClass.PhotoCritter,
    predicate: (t: TraitSet) =>
      t.agility.speedMult >= TUNE.functionalMin.agility &&
      t.photosynthesis.value >= TUNE.functionalMin.photosynthesis,
  },
  {
    phenotype: PhenotypeClass.Person,
    predicate: (t: TraitSet) =>
      t.agility.speedMult >= TUNE.functionalMin.agility &&
      t.sociality.value >= TUNE.functionalMin.sociality &&
      t.emotion.value >= TUNE.functionalMin.emotion,
  },
  {
    phenotype: PhenotypeClass.ColonyInsect,
    predicate: (t: TraitSet) =>
      t.agility.speedMult >= TUNE.functionalMin.agility &&
      t.sociality.value >= TUNE.functionalMin.sociality,
  },
  {
    phenotype: PhenotypeClass.Predator,
    predicate: (t: TraitSet) =>
      t.agility.speedMult >= TUNE.functionalMin.agility &&
      t.sociality.value < TUNE.functionalMin.sociality &&
      t.carnivory.value >= TUNE.phenotype.carnivoryMid &&
      t.strength.value >= TUNE.phenotype.strengthMid,
  },
  {
    phenotype: PhenotypeClass.Critter,
    predicate: (t: TraitSet) => t.agility.speedMult >= TUNE.functionalMin.agility,
  },

  // ── Fallback ──────────────────────────────────────────────────────
  { phenotype: PhenotypeClass.Blob, predicate: () => true },
];

export const PHENOTYPE_TRAITS: Record<PhenotypeClass, PhenotypeTraitFlags> = {
  [PhenotypeClass.Plant]:           { hasHygiene: false, immobile: true,  simplifiedTick: true,  hasMood: false },
  [PhenotypeClass.SessilePredator]: { hasHygiene: false, immobile: true,  simplifiedTick: true,  hasMood: false },
  [PhenotypeClass.Fungus]:          { hasHygiene: false, immobile: true,  simplifiedTick: true,  hasMood: false },
  [PhenotypeClass.Fish]:            { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: true  },
  [PhenotypeClass.Amphibian]:       { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: true  },
  [PhenotypeClass.PhotoCritter]:    { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: false },
  [PhenotypeClass.Person]:          { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: true  },
  [PhenotypeClass.ColonyInsect]:    { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: false },
  [PhenotypeClass.Predator]:        { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: true  },
  [PhenotypeClass.Critter]:         { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: false },
  [PhenotypeClass.Blob]:            { hasHygiene: true,  immobile: false, simplifiedTick: false, hasMood: false },
};
