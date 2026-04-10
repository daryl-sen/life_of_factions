import type { TraitDef } from './types';

/**
 * v5 gene registry — 32 traits, all continuous, soft floors only (no hard ceilings).
 * Gene code polarity: uppercase = reinforcing, lowercase = diminishing.
 * Mixed case (e.g., "Ab") = non-coding junk DNA.
 */
export const GENE_REGISTRY: ReadonlyMap<string, TraitDef> = new Map<string, TraitDef>([

  // ── Essential ──────────────────────────────────────────────────────
  ['BB', {
    code: 'BB', name: 'Longevity', essential: true,
    components: [
      { key: 'maxAgeMs', default: 120000, scale: 1000, floor: 1000, inverted: false },
    ],
  }],
  ['DD', {
    code: 'DD', name: 'Metabolism', essential: true,
    components: [
      { key: 'fullnessDecay',      default: 0.03, scale: 100, floor: 0.001, inverted: false },
      { key: 'actionDurationMult', default: 1.0,  scale: 50,  floor: 0.5,   inverted: true },
    ],
  }],

  // ── Body & Physiology ──────────────────────────────────────────────
  ['AA', {
    code: 'AA', name: 'Strength', essential: false,
    components: [
      { key: 'value', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['CC', {
    code: 'CC', name: 'Vigor', essential: false,
    components: [
      { key: 'baseMaxEnergy', default: 100, scale: 2, floor: 10, inverted: false },
      { key: 'perLevel',      default: 5,   scale: 2, floor: 0,  inverted: false },
    ],
  }],
  ['EE', {
    code: 'EE', name: 'Resilience', essential: false,
    components: [
      { key: 'baseMaxHp', default: 100, scale: 2, floor: 10, inverted: false },
      { key: 'perLevel',  default: 5,   scale: 2, floor: 0,  inverted: false },
    ],
  }],
  ['FF', {
    code: 'FF', name: 'Immunity', essential: false,
    components: [
      { key: 'contractionChance', default: 0.1, scale: 100, floor: 0, inverted: true },
    ],
  }],
  ['GG', {
    code: 'GG', name: 'Agility', essential: false,
    components: [
      { key: 'speedMult', default: 0, scale: 10, floor: 0, inverted: false },
    ],
  }],
  ['AJ', {
    code: 'AJ', name: 'Size', essential: false,
    components: [
      { key: 'value', default: 10, scale: 1, floor: 1, inverted: false },
    ],
  }],
  ['AL', {
    code: 'AL', name: 'Regeneration', essential: false,
    components: [
      { key: 'hpPerTick', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['RR', {
    code: 'RR', name: 'Endurance', essential: false,
    components: [
      { key: 'inventoryCapacity', default: 20, scale: 1, floor: 5, inverted: false },
    ],
  }],

  // ── Mobility, Senses & Diet ────────────────────────────────────────
  ['ZZ', {
    code: 'ZZ', name: 'Aquatic', essential: false,
    components: [
      { key: 'value', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['AH', {
    code: 'AH', name: 'SaltwaterTolerance', essential: false,
    components: [
      { key: 'extractionRate', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['XX', {
    code: 'XX', name: 'Photosynthesis', essential: false,
    components: [
      { key: 'value', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['AB', {
    code: 'AB', name: 'Carnivory', essential: false,
    components: [
      { key: 'value', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['MM', {
    code: 'MM', name: 'Perception', essential: false,
    components: [
      { key: 'radius', default: 3, scale: 0.5, floor: 1, inverted: false },
    ],
  }],

  // ── Mind & Behavior ────────────────────────────────────────────────
  ['YY', {
    code: 'YY', name: 'Emotion', essential: false,
    components: [
      { key: 'value', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['HH', {
    code: 'HH', name: 'Aptitude', essential: false,
    components: [
      { key: 'xpPerLevel', default: 100, scale: 1, floor: 10, inverted: true },
    ],
  }],
  ['KK', {
    code: 'KK', name: 'Courage', essential: false,
    components: [
      { key: 'fleeHpRatio', default: 0.3, scale: 20, floor: 0.05, inverted: true },
    ],
  }],
  ['JJ', {
    code: 'JJ', name: 'Aggression', essential: false,
    components: [
      { key: 'baseProbability', default: 0.2, scale: 10, floor: 0, inverted: false },
    ],
  }],
  ['AN', {
    code: 'AN', name: 'Recall', essential: false,
    components: [
      { key: 'memorySlots', default: 3, scale: 0.5, floor: 1, inverted: false },
    ],
  }],

  // ── Social ─────────────────────────────────────────────────────────
  ['AD', {
    code: 'AD', name: 'Sociality', essential: false,
    components: [
      { key: 'value', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['NN', {
    code: 'NN', name: 'Charisma', essential: false,
    components: [
      { key: 'relationshipSlots', default: 3, scale: 0.5, floor: 1, inverted: false },
    ],
  }],
  ['II', {
    code: 'II', name: 'Cooperation', essential: false,
    components: [
      { key: 'baseProbability', default: 0.5, scale: 20, floor: 0, inverted: false },
    ],
  }],
  ['SS', {
    code: 'SS', name: 'Fidelity', essential: false,
    components: [
      { key: 'leaveProbability', default: 0.1, scale: 10, floor: 0, inverted: true },
    ],
  }],

  // ── Reproduction & Lifecycle ───────────────────────────────────────
  ['LL', {
    code: 'LL', name: 'Fertility', essential: false,
    components: [
      { key: 'energyThreshold', default: 80,  scale: 2,  floor: 10,  inverted: true },
      { key: 'urgencyAge',      default: 0.5, scale: 10, floor: 0.1, inverted: true },
    ],
  }],
  ['AG', {
    code: 'AG', name: 'Pregnancy', essential: false,
    components: [
      { key: 'gestationMs', default: 0, scale: 500, floor: 0, inverted: false },
    ],
  }],
  ['TT', {
    code: 'TT', name: 'Parthenogenesis', essential: false,
    components: [
      { key: 'canSelfReproduce', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['VV', {
    code: 'VV', name: 'Maternity', essential: false,
    components: [
      { key: 'feedProbability', default: 0, scale: 10, floor: 0, inverted: false },
    ],
  }],
  ['QQ', {
    code: 'QQ', name: 'Maturity', essential: false,
    components: [
      { key: 'juvenileMs', default: 30000, scale: 500, floor: 1000, inverted: true },
    ],
  }],
  ['AE', {
    code: 'AE', name: 'Harvestable', essential: false,
    components: [
      { key: 'value', default: 0, scale: 1, floor: 0, inverted: false },
    ],
  }],
  ['AP', {
    code: 'AP', name: 'Volatility', essential: false,
    components: [
      { key: 'mutationRate', default: 0.005, scale: 100, floor: 0.001, inverted: false },
    ],
  }],

  // ── Resource Behavior ──────────────────────────────────────────────
  ['PP', {
    code: 'PP', name: 'Appetite', essential: false,
    components: [
      { key: 'seekThreshold',     default: 0.7, scale: 20, floor: 0.3,  inverted: false },
      { key: 'criticalThreshold', default: 0.2, scale: 20, floor: 0.05, inverted: false },
    ],
  }],
  ['UU', {
    code: 'UU', name: 'Greed', essential: false,
    components: [
      { key: 'hoardProbability', default: 0.3, scale: 10, floor: 0, inverted: false },
    ],
  }],
]);

/**
 * Look up a gene code to find its trait definition and polarity.
 * Returns null for non-coding genes (mixed case or unmapped codes).
 */
export function lookupGene(code: string): { trait: TraitDef; reinforcing: boolean } | null {
  if (code.length !== 2) return null;

  const c0 = code[0];
  const c1 = code[1];

  const isLetter0 = /[A-Za-z]/.test(c0);
  const isLetter1 = /[A-Za-z]/.test(c1);
  if (!isLetter0 || !isLetter1) return null;

  const isUpper0 = c0 === c0.toUpperCase();
  const isUpper1 = c1 === c1.toUpperCase();

  // Mixed case = non-coding
  if (isUpper0 !== isUpper1) return null;

  const reinforcing = isUpper0;
  const normalized = code.toUpperCase();
  const trait = GENE_REGISTRY.get(normalized);
  if (!trait) return null;

  return { trait, reinforcing };
}
