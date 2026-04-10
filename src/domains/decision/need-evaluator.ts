import type { Organism } from '../entity/organism';
import { NeedBand } from '../entity/types';
import type { NeedName } from '../entity/components/needs';

const NEED_NAMES: NeedName[] = ['fullness', 'hygiene', 'social', 'inspiration'];

/** Map each need to its current band using the organism's genetic thresholds */
export function evaluateNeeds(organism: Organism): Record<string, NeedBand> {
  const result: Record<string, NeedBand> = {};
  for (const need of NEED_NAMES) {
    result[need] = organism.needs.getBand(need, organism.traits);
  }

  // Energy band (uses fixed thresholds, not genetic)
  const e = organism.energy;
  if (e < 20) result['energy'] = NeedBand.CRITICAL;
  else if (e < 40) result['energy'] = NeedBand.LOW;
  else if (e < organism.maxEnergy * 0.6) result['energy'] = NeedBand.NORMAL;
  else if (e < organism.maxEnergy * 0.85) result['energy'] = NeedBand.HIGH;
  else result['energy'] = NeedBand.FULL;

  // Health band
  const hRatio = organism.maxHealth > 0 ? organism.health / organism.maxHealth : 1;
  if (hRatio < 0.3) result['health'] = NeedBand.CRITICAL;
  else if (hRatio < 0.5) result['health'] = NeedBand.LOW;
  else if (hRatio < 0.75) result['health'] = NeedBand.NORMAL;
  else result['health'] = NeedBand.HIGH;

  return result;
}
