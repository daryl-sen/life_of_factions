import type { Agent } from '../entity/agent';
import type { DecisionContext } from './types';

/**
 * Determine if an agent should flee based on its courage trait.
 *
 * An agent flees when under attack AND their HP ratio drops below
 * their genetic courage threshold (fleeHpRatio).
 *
 * High courage (low fleeHpRatio) = fights to near-death.
 * Low courage (high fleeHpRatio) = flees at high HP.
 */
export function shouldFlee(agent: Agent, context: DecisionContext): boolean {
  if (!context.underAttack) return false;

  const hpRatio = agent.maxHealth > 0 ? agent.health / agent.maxHealth : 1;
  return hpRatio < agent.traits.courage.fleeHpRatio;
}
