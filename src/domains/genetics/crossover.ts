/**
 * Recombine two parent DNA strings via positional crossover.
 *
 * 1. Start with a full copy of the initiator's DNA.
 * 2. For each gene position present in BOTH parents, 50% chance to swap.
 * 3. Genes beyond the shorter parent's length are inherited unchanged from initiator.
 */
export function crossover(initiatorDna: string, recipientDna: string): string {
  const initiatorGenes: string[] = [];
  for (let i = 0; i + 4 < initiatorDna.length; i += 5) {
    initiatorGenes.push(initiatorDna.substring(i, i + 5));
  }

  const recipientGenes: string[] = [];
  for (let i = 0; i + 4 < recipientDna.length; i += 5) {
    recipientGenes.push(recipientDna.substring(i, i + 5));
  }

  const childGenes: string[] = [];
  const minLen = Math.min(initiatorGenes.length, recipientGenes.length);

  for (let i = 0; i < initiatorGenes.length; i++) {
    if (i < minLen && Math.random() < 0.5) {
      childGenes.push(recipientGenes[i]);
    } else {
      childGenes.push(initiatorGenes[i]);
    }
  }

  return childGenes.join('');
}
