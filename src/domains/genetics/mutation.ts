import { TUNE } from '../../core/tuning';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

function randomChar(position: number): string {
  // Positions 0,1 in a gene (mod 5) are letters; 2,3,4 are digits
  const posInGene = position % 5;
  if (posInGene < 2) {
    const allLetters = UPPER + LOWER;
    return allLetters[Math.floor(Math.random() * allLetters.length)];
  }
  return DIGITS[Math.floor(Math.random() * DIGITS.length)];
}

/**
 * Apply mutations to a DNA string.
 *
 * v4.2 change: `mutationRate` is now a parameter (was hardcoded 0.005).
 * Callers derive it from the agent's Volatility trait. Defaults to
 * TUNE.mutation.baseRate to preserve v4 behavior for existing callers.
 *
 * - Per-character: `mutationRate` chance of substitution
 * - TUNE.mutation.geneDupChance: gene duplication (append random existing gene)
 * - TUNE.mutation.geneDelChance: gene deletion (remove random gene)
 * - Length clamped to [minDnaLength, maxDnaLength] (rounded to multiple of 5)
 */
export function mutate(dna: string, mutationRate: number = TUNE.mutation.baseRate): string {
  const chars = dna.split('');

  // Per-character mutation
  for (let i = 0; i < chars.length; i++) {
    if (Math.random() < mutationRate) {
      chars[i] = randomChar(i);
    }
  }

  let result = chars.join('');

  // Gene duplication
  if (Math.random() < TUNE.mutation.geneDupChance && result.length >= 5) {
    const geneCount = Math.floor(result.length / 5);
    const idx = Math.floor(Math.random() * geneCount) * 5;
    const gene = result.substring(idx, idx + 5);
    result = result + gene;
  }

  // Gene deletion
  if (Math.random() < TUNE.mutation.geneDelChance && result.length > 5) {
    const geneCount = Math.floor(result.length / 5);
    const idx = Math.floor(Math.random() * geneCount) * 5;
    result = result.substring(0, idx) + result.substring(idx + 5);
  }

  // Clamp length to [min, max] and ensure multiple of 5
  if (result.length > TUNE.mutation.maxDnaLength) {
    result = result.substring(0, TUNE.mutation.maxDnaLength);
  }
  result = result.substring(0, Math.floor(result.length / 5) * 5);

  // Pad if too short
  while (result.length < TUNE.mutation.minDnaLength) {
    const c0 = UPPER[Math.floor(Math.random() * 26)];
    const c1 = LOWER[Math.floor(Math.random() * 26)];
    const mag = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    result += c0 + c1 + mag;
  }

  return result;
}
