import { lookupGene } from './gene-registry';
import { expressGenome } from './expression';
import type { RawGeneEntry, TraitSet } from './types';

const DEFAULT_DNA_LENGTH = 200; // 40 genes
const MIN_DNA_LENGTH = 100;     // 20 genes
const MAX_DNA_LENGTH = 250;     // 50 genes

// Essential gene codes that must be present for viability
const ESSENTIAL_CODES = ['AA', 'BB', 'CC', 'DD', 'EE'];

// All catalog codes (uppercase)
const ALL_CODES = [
  'AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH', 'II', 'JJ',
  'KK', 'LL', 'MM', 'NN', 'OO', 'PP', 'QQ', 'RR', 'SS', 'TT',
];

/** Parse a 5-character gene segment into a RawGeneEntry */
function parseGene(segment: string, position: number): RawGeneEntry {
  const code = segment.substring(0, 2);
  const magStr = segment.substring(2, 5);
  const magnitude = parseInt(magStr, 10);

  // Check if all three magnitude chars are digits
  const validMagnitude = /^\d{3}$/.test(magStr);
  if (!validMagnitude) {
    return { code, magnitude: 0, position, coding: false };
  }

  const lookup = lookupGene(code);
  return {
    code,
    magnitude,
    position,
    coding: lookup !== null,
  };
}

/** Parse a full DNA string into gene entries */
function parseDna(dna: string): RawGeneEntry[] {
  const genes: RawGeneEntry[] = [];
  for (let i = 0; i + 4 < dna.length; i += 5) {
    genes.push(parseGene(dna.substring(i, i + 5), i));
  }
  return genes;
}

/** Generate a random 3-digit magnitude string */
function randomMagnitude(): string {
  return String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

/** Generate a random gene (5 characters) */
function randomGene(type: 'functional' | 'noncoding' | 'antagonist'): string {
  if (type === 'noncoding') {
    // Mixed case = non-coding
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const c0 = letters[Math.floor(Math.random() * 26)]; // uppercase
    const c1 = letters[26 + Math.floor(Math.random() * 26)]; // lowercase
    return c0 + c1 + randomMagnitude();
  }

  const code = ALL_CODES[Math.floor(Math.random() * ALL_CODES.length)];
  if (type === 'antagonist') {
    return code.toLowerCase() + randomMagnitude();
  }
  return code + randomMagnitude();
}

/** Generate a random essential gene (uppercase, from essential codes) */
function randomEssentialGene(): string {
  const code = ESSENTIAL_CODES[Math.floor(Math.random() * ESSENTIAL_CODES.length)];
  return code + randomMagnitude();
}

export class Genome {
  readonly dna: string;
  readonly genes: ReadonlyArray<RawGeneEntry>;
  readonly traits: TraitSet;

  constructor(dna: string) {
    // Ensure length is multiple of 5
    const trimmed = dna.substring(0, Math.floor(dna.length / 5) * 5);
    this.dna = trimmed;
    this.genes = parseDna(trimmed);
    this.traits = expressGenome(this.genes);
  }

  toString(): string {
    return this.dna;
  }

  /**
   * Generate a random genome for initial population or egg hatching.
   * Guarantees at least one positive gene for each essential trait.
   */
  static random(length: number = DEFAULT_DNA_LENGTH): Genome {
    // Clamp length to valid range and round to multiple of 5
    const clamped = Math.max(MIN_DNA_LENGTH, Math.min(MAX_DNA_LENGTH, length));
    const geneCount = Math.floor(clamped / 5);
    const genes: string[] = [];

    // First: guarantee one positive gene per essential trait
    for (const code of ESSENTIAL_CODES) {
      genes.push(code + randomMagnitude());
    }

    // Fill remaining positions with a mix
    const remaining = geneCount - ESSENTIAL_CODES.length;
    for (let i = 0; i < remaining; i++) {
      const roll = Math.random();
      if (roll < 0.50) {
        genes.push(randomGene('functional'));
      } else if (roll < 0.80) {
        genes.push(randomGene('noncoding'));
      } else {
        genes.push(randomGene('antagonist'));
      }
    }

    // Shuffle so essential genes aren't always at the start
    for (let i = genes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [genes[i], genes[j]] = [genes[j], genes[i]];
    }

    return new Genome(genes.join(''));
  }
}
