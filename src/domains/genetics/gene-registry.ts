import type { TraitDef } from './types';

/**
 * Static registry mapping 2-char gene codes (uppercase) to trait definitions.
 * Lookup is case-insensitive for the trait category; case determines reinforcing vs reducing.
 *
 * Defaults here match the v3 TUNE values exactly so that a "default genome"
 * (all traits at 0 raw value) produces v3-equivalent behavior.
 */
export const GENE_REGISTRY: ReadonlyMap<string, TraitDef> = new Map<string, TraitDef>([
  ['AA', {
    code: 'AA', name: 'Strength', essential: true,
    components: [
      { key: 'baseAttack', min: 3, default: 8, max: 18, scale: 100, inverted: false },
      { key: 'perLevel', min: 0.5, default: 1.5, max: 3.5, scale: 100, inverted: false },
    ],
  }],
  ['BB', {
    code: 'BB', name: 'Longevity', essential: true,
    components: [
      { key: 'maxAgeMs', min: 120000, default: 300000, max: 600000, scale: 0.005, inverted: false },
    ],
  }],
  ['CC', {
    code: 'CC', name: 'Vigor', essential: true,
    components: [
      { key: 'baseMaxEnergy', min: 100, default: 200, max: 350, scale: 1, inverted: false },
      { key: 'perLevel', min: 2, default: 5, max: 10, scale: 100, inverted: false },
    ],
  }],
  ['DD', {
    code: 'DD', name: 'Metabolism', essential: true,
    components: [
      { key: 'fullnessDecay', min: 0.01, default: 0.03, max: 0.06, scale: 10000, inverted: true },
      { key: 'actionDurationMult', min: 0.7, default: 1.0, max: 1.4, scale: 500, inverted: false },
    ],
  }],
  ['EE', {
    code: 'EE', name: 'Resilience', essential: true,
    components: [
      { key: 'baseMaxHp', min: 60, default: 100, max: 180, scale: 1, inverted: false },
      { key: 'perLevel', min: 3, default: 8, max: 15, scale: 100, inverted: false },
    ],
  }],
  ['FF', {
    code: 'FF', name: 'Immunity', essential: false,
    components: [
      { key: 'contractionChance', min: 0.0, default: 0.05, max: 0.15, scale: 10000, inverted: true },
    ],
  }],
  ['GG', {
    code: 'GG', name: 'Agility', essential: false,
    components: [
      { key: 'speedMult', min: 0.5, default: 1.0, max: 2.0, scale: 500, inverted: false },
    ],
  }],
  ['HH', {
    code: 'HH', name: 'Aptitude', essential: false,
    components: [
      { key: 'xpPerLevel', min: 10, default: 25, max: 50, scale: 100, inverted: true },
    ],
  }],
  ['II', {
    code: 'II', name: 'Cooperation', essential: false,
    components: [
      { key: 'baseProbability', min: 0.0, default: 0.5, max: 1.0, scale: 500, inverted: false },
    ],
  }],
  ['JJ', {
    code: 'JJ', name: 'Aggression', essential: false,
    components: [
      { key: 'baseProbability', min: 0.0, default: 0.5, max: 1.0, scale: 500, inverted: false },
    ],
  }],
  ['KK', {
    code: 'KK', name: 'Courage', essential: false,
    components: [
      { key: 'fleeHpRatio', min: 0.1, default: 0.5, max: 0.9, scale: 500, inverted: true },
    ],
  }],
  ['LL', {
    code: 'LL', name: 'Fertility', essential: false,
    components: [
      { key: 'energyThreshold', min: 50, default: 90, max: 130, scale: 1, inverted: true },
      { key: 'urgencyAge', min: 0.6, default: 0.8, max: 0.95, scale: 500, inverted: true },
    ],
  }],
  ['MM', {
    code: 'MM', name: 'Recall', essential: false,
    components: [
      { key: 'memorySlots', min: 1, default: 2, max: 8, scale: 200, inverted: false },
    ],
  }],
  ['NN', {
    code: 'NN', name: 'Charisma', essential: false,
    components: [
      { key: 'relationshipSlots', min: 5, default: 20, max: 40, scale: 1, inverted: false },
    ],
  }],
  ['OO', {
    code: 'OO', name: 'Gregariousness', essential: false,
    components: [
      { key: 'socialDecay', min: 0.002, default: 0.01, max: 0.025, scale: 10000, inverted: false },
    ],
  }],
  ['PP', {
    code: 'PP', name: 'Appetite', essential: false,
    components: [
      { key: 'seekThreshold', min: 20, default: 40, max: 70, scale: 10, inverted: false },
      { key: 'criticalThreshold', min: 10, default: 20, max: 35, scale: 10, inverted: false },
    ],
  }],
  ['QQ', {
    code: 'QQ', name: 'Maturity', essential: false,
    components: [
      { key: 'babyDurationMs', min: 20000, default: 60000, max: 120000, scale: 1, inverted: true },
    ],
  }],
  ['RR', {
    code: 'RR', name: 'Endurance', essential: false,
    components: [
      { key: 'inventoryCapacity', min: 8, default: 20, max: 40, scale: 10, inverted: false },
    ],
  }],
  ['SS', {
    code: 'SS', name: 'Fidelity', essential: false,
    components: [
      { key: 'leaveProbability', min: 0.0, default: 0.5, max: 1.0, scale: 500, inverted: true },
    ],
  }],
  ['TT', {
    code: 'TT', name: 'Parthenogenesis', essential: false,
    components: [
      // Special: expressed as boolean (rawValue > 0 = true)
      { key: 'canSelfReproduce', min: 0, default: 0, max: 1, scale: 1, inverted: false },
    ],
  }],
  ['UU', {
    code: 'UU', name: 'Greed', essential: false,
    components: [
      { key: 'hoardProbability', min: 0.0, default: 0.4, max: 1.0, scale: 500, inverted: false },
    ],
  }],
  ['VV', {
    code: 'VV', name: 'Maternity', essential: false,
    components: [
      { key: 'feedProbability', min: 0.0, default: 0.5, max: 1.0, scale: 500, inverted: false },
    ],
  }],

  // v4.2 additions
  ['AD', {
    code: 'AD', name: 'Sociality', essential: false,
    // Same component structure as OO (Gregariousness) — replaces it for new agents.
    // Existing OO genes continue to write to `gregariousness`; AD writes to `sociality`.
    components: [
      { key: 'socialDecay', min: 0.002, default: 0.01, max: 0.025, scale: 10000, inverted: false },
    ],
  }],
  ['AG', {
    code: 'AG', name: 'Pregnancy', essential: false,
    // gestationMs > 0: gradual need-transfer gestation.
    // gestationMs = 0 (gene present but at floor): instant birth with zero needs.
    // No AG gene at all: v4 countdown-timer fallback.
    components: [
      { key: 'gestationMs', min: 0, default: 0, max: 120000, scale: 0.005, inverted: false },
    ],
  }],
  ['AP', {
    code: 'AP', name: 'Volatility', essential: false,
    // Controls per-lineage mutation rate. Default matches v4 hardcoded MUTATION_RATE (0.005).
    components: [
      { key: 'mutationRate', min: 0.001, default: 0.005, max: 0.02, scale: 10000, inverted: false },
    ],
  }],
  ['AQ', {
    code: 'AQ', name: 'Nomadism', essential: false,
    // High = prefers wandering outside territory. Low = prefers staying inside own territory.
    components: [
      { key: 'wanderBias', min: 0.0, default: 0.5, max: 1.0, scale: 500, inverted: false },
    ],
  }],
  ['AR', {
    code: 'AR', name: 'Tribalism', essential: false,
    // How strongly territorial context amplifies/modulates this agent's behavior.
    components: [
      { key: 'territorialSensitivity', min: 0.0, default: 0.5, max: 1.0, scale: 500, inverted: false },
    ],
  }],
]);

/**
 * Look up a gene code to find its trait definition and polarity.
 * Returns null for non-coding genes (mixed case, unmapped codes).
 */
export function lookupGene(code: string): { trait: TraitDef; reinforcing: boolean } | null {
  if (code.length !== 2) return null;

  const c0 = code[0];
  const c1 = code[1];

  // Both must be letters
  const isLetter0 = /[A-Za-z]/.test(c0);
  const isLetter1 = /[A-Za-z]/.test(c1);
  if (!isLetter0 || !isLetter1) return null;

  const isUpper0 = c0 === c0.toUpperCase();
  const isUpper1 = c1 === c1.toUpperCase();

  // Mixed case = non-coding
  if (isUpper0 !== isUpper1) return null;

  const reinforcing = isUpper0; // both uppercase = reinforcing
  const normalized = code.toUpperCase();

  const trait = GENE_REGISTRY.get(normalized);
  if (!trait) return null; // same case but unmapped

  return { trait, reinforcing };
}
