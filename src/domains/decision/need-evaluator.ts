import type { Agent } from '../entity/agent';
import { NeedBand } from '../entity/types';
import type { NeedName } from '../entity/components/needs';

const NEED_NAMES: NeedName[] = ['fullness', 'hygiene', 'social', 'inspiration'];

/** Map each need to its current band using the agent's genetic thresholds */
export function evaluateNeeds(agent: Agent): Record<string, NeedBand> {
  const result: Record<string, NeedBand> = {};
  for (const need of NEED_NAMES) {
    result[need] = agent.needs.getBand(need, agent.traits);
  }

  // Energy band (uses fixed thresholds, not genetic)
  const e = agent.energy;
  if (e < 20) result['energy'] = NeedBand.CRITICAL;
  else if (e < 40) result['energy'] = NeedBand.LOW;
  else if (e < agent.maxEnergy * 0.6) result['energy'] = NeedBand.NORMAL;
  else if (e < agent.maxEnergy * 0.85) result['energy'] = NeedBand.HIGH;
  else result['energy'] = NeedBand.FULL;

  // Health band
  const hRatio = agent.maxHealth > 0 ? agent.health / agent.maxHealth : 1;
  if (hRatio < 0.3) result['health'] = NeedBand.CRITICAL;
  else if (hRatio < 0.5) result['health'] = NeedBand.LOW;
  else if (hRatio < 0.75) result['health'] = NeedBand.NORMAL;
  else result['health'] = NeedBand.HIGH;

  return result;
}
