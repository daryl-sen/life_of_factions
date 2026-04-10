import type { TraitSet } from '../genetics/types';
import { PhenotypeClass } from './types';
import { PHENOTYPE_RULES, PHENOTYPE_TRAITS } from './phenotype-registry';

/**
 * Classify a TraitSet into a PhenotypeClass.
 * Rules are evaluated in priority order; first match wins.
 * Phenotype is locked at birth and never re-derived per tick.
 */
export function classify(traits: TraitSet): PhenotypeClass {
  for (const rule of PHENOTYPE_RULES) {
    if (rule.predicate(traits)) return rule.phenotype;
  }
  return PhenotypeClass.Blob;
}

export function hasHygiene(phenotype: PhenotypeClass): boolean {
  return PHENOTYPE_TRAITS[phenotype].hasHygiene;
}

export function isImmobile(phenotype: PhenotypeClass): boolean {
  return PHENOTYPE_TRAITS[phenotype].immobile;
}

export function usesSimplifiedTick(phenotype: PhenotypeClass): boolean {
  return PHENOTYPE_TRAITS[phenotype].simplifiedTick;
}

export function hasMood(phenotype: PhenotypeClass): boolean {
  return PHENOTYPE_TRAITS[phenotype].hasMood;
}
