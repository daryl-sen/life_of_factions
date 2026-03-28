const MIN_DNA_LENGTH = 100;
const MAX_DNA_LENGTH = 250;
const MUTATION_RATE = 0.005;       // 0.5% per character
const GENE_DUP_CHANCE = 0.01;     // 1% per reproduction
const GENE_DEL_CHANCE = 0.01;     // 1% per reproduction

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

function randomChar(position: number): string {
  // Positions 0,1 in a gene (mod 5) are letters; 2,3,4 are digits
  const posInGene = position % 5;
  if (posInGene < 2) {
    // Random letter (upper or lower)
    const allLetters = UPPER + LOWER;
    return allLetters[Math.floor(Math.random() * allLetters.length)];
  }
  return DIGITS[Math.floor(Math.random() * DIGITS.length)];
}

/**
 * Apply mutations to a DNA string.
 *
 * - Per-character: 0.5% chance of substitution (letter or digit depending on position)
 * - 1% chance of gene duplication (random 5-char gene copied and appended)
 * - 1% chance of gene deletion (random 5-char segment removed)
 * - Length clamped to [100, 250] (rounded to multiple of 5)
 */
export function mutate(dna: string): string {
  const chars = dna.split('');

  // Per-character mutation
  for (let i = 0; i < chars.length; i++) {
    if (Math.random() < MUTATION_RATE) {
      chars[i] = randomChar(i);
    }
  }

  let result = chars.join('');

  // Gene duplication (1% chance)
  if (Math.random() < GENE_DUP_CHANCE && result.length >= 5) {
    const geneCount = Math.floor(result.length / 5);
    const idx = Math.floor(Math.random() * geneCount) * 5;
    const gene = result.substring(idx, idx + 5);
    result = result + gene;
  }

  // Gene deletion (1% chance)
  if (Math.random() < GENE_DEL_CHANCE && result.length > 5) {
    const geneCount = Math.floor(result.length / 5);
    const idx = Math.floor(Math.random() * geneCount) * 5;
    result = result.substring(0, idx) + result.substring(idx + 5);
  }

  // Clamp length to [MIN, MAX] and ensure multiple of 5
  if (result.length > MAX_DNA_LENGTH) {
    result = result.substring(0, MAX_DNA_LENGTH);
  }
  // Trim to multiple of 5
  result = result.substring(0, Math.floor(result.length / 5) * 5);

  // If too short, pad with non-coding genes
  while (result.length < MIN_DNA_LENGTH) {
    const c0 = UPPER[Math.floor(Math.random() * 26)];
    const c1 = LOWER[Math.floor(Math.random() * 26)];
    const mag = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    result += c0 + c1 + mag;
  }

  return result;
}
