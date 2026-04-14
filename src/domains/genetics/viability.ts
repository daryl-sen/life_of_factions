import { GENE_REGISTRY, lookupGene } from './gene-registry';
import { TUNE } from '../../core/tuning';
import type { TraitSet, RawGeneEntry } from './types';

/** Essential trait codes */
const ESSENTIAL_CODES = ['AA', 'BB', 'CC', 'DD', 'EE'];

/**
 * Check whether a genome is viable for a living agent.
 *
 * Requirements:
 * 1. At least one coding gene exists for each essential trait (positive or negative variant).
 * 2. No essential trait is at its absolute minimum value.
 *
 * If either check fails, the child is stillborn.
 */
export function isViable(traits: TraitSet, genes: ReadonlyArray<RawGeneEntry>, dna: string): boolean {
  // 0. DNA length bounds
  if (dna.length < TUNE.mutation.minDnaLength) return false;
  if (dna.length > TUNE.mutation.maxDnaLength) return false;

  // 1. Check that at least one functional gene exists for each essential trait
  const essentialCodingFound = new Set<string>();
  for (const gene of genes) {
    if (!gene.coding) continue;
    const lookup = lookupGene(gene.code);
    if (!lookup) continue;
    const traitCode = lookup.trait.code;
    if (ESSENTIAL_CODES.includes(traitCode)) {
      essentialCodingFound.add(traitCode);
    }
  }

  for (const code of ESSENTIAL_CODES) {
    if (!essentialCodingFound.has(code)) return false;
  }

  // 2. Check that no essential trait is at its absolute minimum
  const traitDefs = GENE_REGISTRY;

  // Strength
  const strengthDef = traitDefs.get('AA')!;
  if (traits.strength.baseAttack <= strengthDef.components[0].min) return false;

  // Longevity
  const longevityDef = traitDefs.get('BB')!;
  if (traits.longevity.maxAgeMs <= longevityDef.components[0].min) return false;

  // Vigor
  const vigorDef = traitDefs.get('CC')!;
  if (traits.vigor.baseMaxEnergy <= vigorDef.components[0].min) return false;

  // Metabolism — inverted: min is actually the best (slowest decay)
  // Check that fullnessDecay hasn't hit max (worst case = fastest decay)
  const metaDef = traitDefs.get('DD')!;
  if (traits.metabolism.fullnessDecay >= metaDef.components[0].max) return false;

  // Resilience
  const resDef = traitDefs.get('EE')!;
  if (traits.resilience.baseMaxHp <= resDef.components[0].min) return false;

  return true;
}
