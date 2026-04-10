import type { TraitSet } from './types';
import { TUNE } from '../../core/tuning';

/**
 * Check whether an organism is viable (not stillborn).
 * Stillbirth is purely viability-driven — no separate probability roll.
 * High Volatility produces more stillbirths only by breaking essential genes more often.
 */
export function isViable(traits: TraitSet, dna: string): boolean {
  // Essential traits must be functional
  if (traits.longevity.maxAgeMs <= 0) return false;
  if (traits.metabolism.fullnessDecay <= 0) return false;

  // Must have an energy pool and HP
  if (traits.vigor.baseMaxEnergy <= 0) return false;
  if (traits.resilience.baseMaxHp <= 0) return false;

  // DNA must meet minimum length
  if (dna.length < TUNE.mutation.minDnaLength) return false;

  return true;
}
