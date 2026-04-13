import { GENE_REGISTRY, lookupGene } from './gene-registry';
import { TUNE } from '../../core/tuning';
import type { RawGeneEntry, TraitSet, TraitComponentDef } from './types';

/**
 * Express a gene component: map raw value to a game value.
 *
 * v4.2 change: replaces v4's clamp(default + ..., min, max) with
 * Math.max(min, default + ...). Traits are unbounded above; cost
 * functions are the natural limiter for high-value traits.
 */
function expressComponent(rawValue: number, comp: TraitComponentDef): number {
  const direction = comp.inverted ? -1 : 1;
  return Math.max(comp.min, comp.default + (direction * rawValue) / comp.scale);
}

/**
 * Express a full genome into a TraitSet.
 * Iterates all coding genes, sums reinforcing magnitudes, subtracts reducing magnitudes
 * per trait, then maps raw sums to game values.
 */
export function expressGenome(genes: ReadonlyArray<RawGeneEntry>): TraitSet {
  // Accumulate raw values per trait code (uppercase)
  const rawSums = new Map<string, number>();

  for (const gene of genes) {
    if (!gene.coding) continue;
    const lookup = lookupGene(gene.code);
    if (!lookup) continue;

    const traitCode = lookup.trait.code;
    const current = rawSums.get(traitCode) ?? 0;
    rawSums.set(traitCode, current + (lookup.reinforcing ? gene.magnitude : -gene.magnitude));
  }

  // Build the trait set, using defaults for missing traits
  function expressTraitComponents(traitCode: string): Record<string, number> {
    const trait = GENE_REGISTRY.get(traitCode);
    if (!trait) return {};
    const raw = rawSums.get(traitCode) ?? 0;
    const result: Record<string, number> = {};
    for (const comp of trait.components) {
      result[comp.key] = expressComponent(raw, comp);
    }
    return result;
  }

  const s = (code: string) => expressTraitComponents(code);

  const strength      = s('AA');
  const longevity     = s('BB');
  const vigor         = s('CC');
  const metabolism    = s('DD');
  const resilience    = s('EE');
  const immunity      = s('FF');
  const agility       = s('GG');
  const aptitude      = s('HH');
  const cooperation   = s('II');
  const aggression    = s('JJ');
  const courage       = s('KK');
  const fertility     = s('LL');
  const recall        = s('MM');
  const charisma      = s('NN');
  const gregariousness = s('OO');
  const appetite      = s('PP');
  const maturity      = s('QQ');
  const endurance     = s('RR');
  const fidelity      = s('SS');
  const greed         = s('UU');
  const maternity     = s('VV');

  // v4.2 new traits
  const volatility    = s('AP');
  const pregnancyTrait = s('AG');

  // Sociality: use AD expression when AD genes are present;
  // otherwise fall back to the gregariousness value so all callers
  // can unconditionally read `traits.sociality.socialDecay`.
  const socialDecayValue = rawSums.has('AD')
    ? (s('AD')['socialDecay'] ?? gregariousness['socialDecay'] ?? 0.01)
    : (gregariousness['socialDecay'] ?? 0.01);

  // Parthenogenesis is special: boolean based on raw > 0
  const partRaw = rawSums.get('TT') ?? 0;

  return {
    strength: {
      baseAttack: strength['baseAttack'] ?? 8,
      perLevel:   strength['perLevel'] ?? 1.5,
    },
    longevity: {
      maxAgeMs: longevity['maxAgeMs'] ?? 300000,
    },
    vigor: {
      baseMaxEnergy: vigor['baseMaxEnergy'] ?? 200,
      perLevel:      vigor['perLevel'] ?? 5,
    },
    metabolism: {
      fullnessDecay:      metabolism['fullnessDecay'] ?? 0.03,
      actionDurationMult: metabolism['actionDurationMult'] ?? 1.0,
    },
    resilience: {
      baseMaxHp: resilience['baseMaxHp'] ?? 100,
      perLevel:  resilience['perLevel'] ?? 8,
    },
    immunity: {
      contractionChance: immunity['contractionChance'] ?? 0.05,
    },
    agility: {
      speedMult: agility['speedMult'] ?? 1.0,
    },
    aptitude: {
      xpPerLevel: Math.round(aptitude['xpPerLevel'] ?? 25),
    },
    cooperation: {
      baseProbability: cooperation['baseProbability'] ?? 0.5,
    },
    aggression: {
      baseProbability: aggression['baseProbability'] ?? 0.5,
    },
    courage: {
      fleeHpRatio: courage['fleeHpRatio'] ?? 0.5,
    },
    fertility: {
      energyThreshold: Math.round(fertility['energyThreshold'] ?? 90),
      urgencyAge:      fertility['urgencyAge'] ?? 0.8,
    },
    parthenogenesis: {
      canSelfReproduce: partRaw > 0,
    },
    recall: {
      memorySlots: Math.round(recall['memorySlots'] ?? 2),
    },
    charisma: {
      relationshipSlots: Math.round(charisma['relationshipSlots'] ?? 80),
    },
    gregariousness: {
      socialDecay: gregariousness['socialDecay'] ?? 0.01,
    },
    appetite: {
      seekThreshold:     Math.round(appetite['seekThreshold'] ?? 40),
      criticalThreshold: Math.round(appetite['criticalThreshold'] ?? 20),
    },
    maturity: {
      babyDurationMs: Math.round(maturity['babyDurationMs'] ?? 60000),
    },
    endurance: {
      inventoryCapacity: Math.round(endurance['inventoryCapacity'] ?? 20),
    },
    fidelity: {
      leaveProbability: fidelity['leaveProbability'] ?? 0.5,
    },
    greed: {
      hoardProbability: greed['hoardProbability'] ?? 0.4,
    },
    maternity: {
      feedProbability: maternity['feedProbability'] ?? 0.5,
    },

    // v4.2 additions
    sociality: {
      socialDecay: socialDecayValue,
    },
    pregnancy: {
      gestationMs: Math.round(pregnancyTrait['gestationMs'] ?? 0),
    },
    volatility: {
      mutationRate: volatility['mutationRate'] ?? TUNE.mutation.baseRate,
    },
  };
}
