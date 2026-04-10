import type { TraitSet } from '../../genetics/types';
import { NeedBand } from '../types';
import { TUNE } from '../../../core/tuning';

export type NeedName = 'fullness' | 'hygiene' | 'social' | 'inspiration';

function getBandBoundaries(seekThreshold: number): {
  critical: number; low: number; normal: number; high: number;
} {
  return {
    critical: seekThreshold * 0.5,
    low: seekThreshold,
    normal: seekThreshold + (100 - seekThreshold) * 0.4,
    high: seekThreshold + (100 - seekThreshold) * 0.75,
  };
}

function getSeekThreshold(need: NeedName, traits: TraitSet): number {
  switch (need) {
    case 'fullness':
      // v5: seekThreshold is 0..1, scale to 0..100
      return traits.appetite.seekThreshold * 100;
    case 'hygiene':
      return 40;
    case 'social':
      return TUNE.functionalMin.sociality > 0 ? 40 : 0;
    case 'inspiration':
      return 40;
  }
}

export class NeedSet {
  fullness: number;
  hygiene: number;
  social: number;
  inspiration: number;

  constructor(init: { fullness: number; hygiene: number; social: number; inspiration: number }) {
    this.fullness    = init.fullness;
    this.hygiene     = init.hygiene;
    this.social      = init.social;
    this.inspiration = init.inspiration;
  }

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
    this.fullness    = Math.max(0, Math.min(100, this.fullness));
    this.hygiene     = Math.max(0, Math.min(100, this.hygiene));
    this.social      = Math.max(0, Math.min(100, this.social));
    this.inspiration = Math.max(0, Math.min(100, this.inspiration));
  }
}
