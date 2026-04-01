import { NeedBand, Mood } from '../entity/types';

/**
 * Compute an agent's mood from their current need bands.
 *
 * Priority (highest first):
 *   1. Any need CRITICAL → Frustrated
 *   2. Any need LOW      → Unhappy
 *   3. All needs HIGH/FULL → Happy
 *   4. Otherwise          → Content
 */
export function computeMood(needBands: Record<string, NeedBand>): Mood {
  const bands = Object.values(needBands);

  if (bands.some(b => b === NeedBand.CRITICAL)) return Mood.FRUSTRATED;
  if (bands.some(b => b === NeedBand.LOW)) return Mood.UNHAPPY;
  if (bands.every(b => b === NeedBand.HIGH || b === NeedBand.FULL)) return Mood.HAPPY;
  return Mood.CONTENT;
}
