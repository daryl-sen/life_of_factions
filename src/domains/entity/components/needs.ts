import type { TraitSet } from '../../genetics/types';
import { NeedBand } from '../types';

export type NeedName = 'fullness' | 'hygiene' | 'social' | 'inspiration';

/**
 * Compute the band boundaries for a need based on genetic thresholds.
 *
 * The seekThreshold (boundary between LOW and NORMAL) comes from genetics.
 * Other boundaries are derived:
 *   critical = seekThreshold * 0.5
 *   low      = seekThreshold
 *   normal   = seekThreshold + (100 - seekThreshold) * 0.4
 *   high     = seekThreshold + (100 - seekThreshold) * 0.75
 */
function getBandBoundaries(seekThreshold: number): {
  critical: number;
  low: number;
  normal: number;
  high: number;
} {
  return {
    critical: seekThreshold * 0.5,
    low: seekThreshold,
    normal: seekThreshold + (100 - seekThreshold) * 0.4,
    high: seekThreshold + (100 - seekThreshold) * 0.75,
  };
}

/** Get the seek threshold for a specific need from traits */
function getSeekThreshold(need: NeedName, traits: TraitSet): number {
  switch (need) {
    case 'fullness':
      return traits.appetite.seekThreshold;
    case 'hygiene':
      return 40; // No gene for hygiene yet, use default
    case 'social':
      // Gregariousness: higher decay = higher thresholds (needs interaction more)
      // Scale: socialDecay 0.002-0.025, default 0.01 -> seekThreshold 20-60, default 40
      return 20 + (traits.gregariousness.socialDecay - 0.002) / (0.025 - 0.002) * 40;
    case 'inspiration':
      return 40; // No gene yet, use default
  }
}

export class NeedSet {
  fullness: number;
  hygiene: number;
  social: number;
  inspiration: number;

  constructor(
    fullness = 50,
    hygiene = 50,
    social = 50,
    inspiration = 50
  ) {
    this.fullness = fullness;
    this.hygiene = hygiene;
    this.social = social;
    this.inspiration = inspiration;
  }

  /** Get the band for a given need using the agent's genetic thresholds */
  getBand(need: NeedName, traits: TraitSet): NeedBand {
    const value = this[need];
    const seekThreshold = getSeekThreshold(need, traits);
    const bounds = getBandBoundaries(seekThreshold);

    if (value <= bounds.critical) return NeedBand.CRITICAL;
    if (value <= bounds.low) return NeedBand.LOW;
    if (value <= bounds.normal) return NeedBand.NORMAL;
    if (value <= bounds.high) return NeedBand.HIGH;
    return NeedBand.FULL;
  }

  clamp(): void {
    this.fullness = Math.max(0, Math.min(100, this.fullness));
    this.hygiene = Math.max(0, Math.min(100, this.hygiene));
    this.social = Math.max(0, Math.min(100, this.social));
    this.inspiration = Math.max(0, Math.min(100, this.inspiration));
  }
}
