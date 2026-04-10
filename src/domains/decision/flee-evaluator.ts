import type { Organism } from '../entity/organism';
import type { DecisionContext } from './types';

/**
 * Determine if an organism should flee based on its courage trait.
 *
 * An organism flees when under attack AND their HP ratio drops below
 * their genetic courage threshold (fleeHpRatio).
 */
export function shouldFlee(organism: Organism, context: DecisionContext): boolean {
  if (!context.underAttack) return false;

  const hpRatio = organism.maxHealth > 0 ? organism.health / organism.maxHealth : 1;
  return hpRatio < organism.traits.courage.fleeHpRatio;
}
