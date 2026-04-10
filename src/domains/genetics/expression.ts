import { GENE_REGISTRY, lookupGene } from './gene-registry';
import type { RawGeneEntry, TraitSet, TraitComponentDef } from './types';

/**
 * Express a gene component with v5 semantics:
 * - Soft floor only (no hard ceiling)
 * - value = max(floor, default + direction * raw / scale)
 */
function expressComponent(rawValue: number, comp: TraitComponentDef): number {
  const direction = comp.inverted ? -1 : 1;
  return Math.max(comp.floor, comp.default + (direction * rawValue) / comp.scale);
}

/**
 * Express a full genome into a v5 TraitSet.
 * Unbounded above — cost functions in cost-functions.ts are the natural limiter.
 */
export function expressGenome(genes: ReadonlyArray<RawGeneEntry>): TraitSet {
  const rawSums = new Map<string, number>();

  for (const gene of genes) {
    if (!gene.coding) continue;
    const lookup = lookupGene(gene.code);
    if (!lookup) continue;
    const traitCode = lookup.trait.code;
    const current = rawSums.get(traitCode) ?? 0;
    rawSums.set(traitCode, current + (lookup.reinforcing ? gene.magnitude : -gene.magnitude));
  }

  function s(code: string): Record<string, number> {
    const trait = GENE_REGISTRY.get(code);
    if (!trait) return {};
    const raw = rawSums.get(code) ?? 0;
    const result: Record<string, number> = {};
    for (const comp of trait.components) {
      result[comp.key] = expressComponent(raw, comp);
    }
    return result;
  }

  // Parthenogenesis: value > 0.5 treated as true
  const partRaw = rawSums.get('TT') ?? 0;
  const partValue = Math.max(0, partRaw);

  return {
    longevity:          { maxAgeMs:          s('BB')['maxAgeMs'] ?? 120000 },
    metabolism:         { fullnessDecay:      s('DD')['fullnessDecay'] ?? 0.03,
                          actionDurationMult: s('DD')['actionDurationMult'] ?? 1.0 },

    strength:           { value:              s('AA')['value'] ?? 0 },
    vigor:              { baseMaxEnergy:      s('CC')['baseMaxEnergy'] ?? 100,
                          perLevel:           s('CC')['perLevel'] ?? 5 },
    resilience:         { baseMaxHp:          s('EE')['baseMaxHp'] ?? 100,
                          perLevel:           s('EE')['perLevel'] ?? 5 },
    immunity:           { contractionChance:  s('FF')['contractionChance'] ?? 0.1 },
    agility:            { speedMult:          s('GG')['speedMult'] ?? 0 },
    size:               { value:              s('AJ')['value'] ?? 10 },
    regeneration:       { hpPerTick:          s('AL')['hpPerTick'] ?? 0 },
    endurance:          { inventoryCapacity:  Math.round(s('RR')['inventoryCapacity'] ?? 20) },

    aquatic:            { value:              s('ZZ')['value'] ?? 0 },
    saltwaterTolerance: { extractionRate:     s('AH')['extractionRate'] ?? 0 },
    photosynthesis:     { value:              s('XX')['value'] ?? 0 },
    carnivory:          { value:              s('AB')['value'] ?? 0 },
    perception:         { radius:             s('MM')['radius'] ?? 3 },

    emotion:            { value:              s('YY')['value'] ?? 0 },
    aptitude:           { xpPerLevel:         Math.round(s('HH')['xpPerLevel'] ?? 100) },
    courage:            { fleeHpRatio:        s('KK')['fleeHpRatio'] ?? 0.3 },
    aggression:         { baseProbability:    s('JJ')['baseProbability'] ?? 0.2 },
    recall:             { memorySlots:        Math.round(s('AN')['memorySlots'] ?? 3) },

    sociality:          { value:              s('AD')['value'] ?? 0 },
    charisma:           { relationshipSlots:  Math.round(s('NN')['relationshipSlots'] ?? 3) },
    cooperation:        { baseProbability:    s('II')['baseProbability'] ?? 0.5 },
    fidelity:           { leaveProbability:   s('SS')['leaveProbability'] ?? 0.1 },

    fertility:          { energyThreshold:    s('LL')['energyThreshold'] ?? 80,
                          urgencyAge:         s('LL')['urgencyAge'] ?? 0.5 },
    pregnancy:          { gestationMs:        s('AG')['gestationMs'] ?? 0 },
    parthenogenesis:    { canSelfReproduce:    partValue > 0.5 },
    maternity:          { feedProbability:    s('VV')['feedProbability'] ?? 0 },
    maturity:           { juvenileMs:         Math.round(s('QQ')['juvenileMs'] ?? 30000) },
    harvestable:        { value:              s('AE')['value'] ?? 0 },
    volatility:         { mutationRate:       s('AP')['mutationRate'] ?? 0.005 },

    appetite:           { seekThreshold:      s('PP')['seekThreshold'] ?? 0.7,
                          criticalThreshold:  s('PP')['criticalThreshold'] ?? 0.2 },
    greed:              { hoardProbability:   s('UU')['hoardProbability'] ?? 0.3 },
  };
}
