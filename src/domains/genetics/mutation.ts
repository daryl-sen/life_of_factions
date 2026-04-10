import { TUNE } from '../../core/tuning';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

function randomChar(position: number): string {
  const posInGene = position % 5;
  if (posInGene < 2) {
    const allLetters = UPPER + LOWER;
    return allLetters[Math.floor(Math.random() * allLetters.length)];
  }
  return DIGITS[Math.floor(Math.random() * DIGITS.length)];
}

/**
 * Apply mutations to a DNA string.
 * Rate is now a parameter (driven by parent Volatility trait) instead of a constant.
 * Default = TUNE.mutation.baseRate (0.5%) when called without a rate argument.
 *
 * - Per-character substitution at `mutationRate`
 * - Gene duplication (1% chance)
 * - Gene deletion (1% chance)
 * - Length clamped to [minDnaLength, maxDnaLength], multiple of 5
 */
export function mutate(dna: string, mutationRate: number = TUNE.mutation.baseRate): string {
  const chars = dna.split('');

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

  // Clamp to maxDnaLength
  if (result.length > TUNE.mutation.maxDnaLength) {
    result = result.substring(0, TUNE.mutation.maxDnaLength);
  }

  // Trim to multiple of 5
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
